/*
 * Kidney Food Log — food data proxy
 *
 * WHY THIS EXISTS
 * ---------------
 * Two separate problems, one Worker.
 *
 * 1. USDA needs a hidden key. The app is a static page, so any key it ships is
 *    public: visible in the bundle, visible in the request URL, scraped from
 *    the public repo within days. The shared DEMO_KEY that avoids this is
 *    capped near 30 requests/hour across every app on earth using it, which
 *    means food search is broken for anyone who opens the URL.
 *
 * 2. Open Food Facts text search is impossible from a browser. Every OFF search
 *    endpoint (/cgi/search.pl, /api/v2/search, search.openfoodfacts.org) returns
 *    no Access-Control-Allow-Origin header — verified live. Only the
 *    per-barcode endpoint sends CORS headers. So without a proxy, packaged
 *    foods can be found ONLY by barcode. That is the app's worst gap, because
 *    packaged foods are exactly where phosphate additives live, and additive
 *    flagging is the whole point of the product.
 *
 * A server-side hop fixes both, and lets us send OFF a proper identifying
 * User-Agent, which their usage policy asks for and a browser cannot set.
 *
 * CACHING IS THE POINT, NOT AN OPTIMISATION
 * Food composition data is effectively immutable — a raw banana's potassium
 * does not change. Caching at the edge means the hundred commonest searches
 * never touch the upstream at all. Without it a few hundred users would
 * exhaust USDA's 1,000 req/hour and we would be back where we started.
 *
 * DELIBERATELY NOT A GENERAL PROXY
 * Two fixed endpoints, GET only, known origins only, capped parameters. An
 * open proxy carrying our key would be abused.
 */

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
/*
 * US-scoped, not world. Verified side by side: "turkey breast" on world returns
 * Spanish, Bulgarian and French deli meat; on us it returns Hillshire Farm and
 * Applegate. The audience is US dialysis patients shopping in US supermarkets,
 * and a result they cannot buy is worse than no result — it teaches them the
 * search does not work. Barcode lookup still uses the world database, since a
 * scanned UPC is unambiguous and coverage matters more there.
 */
const OFF_BASE = 'https://us.openfoodfacts.org';

/*
 * USDA analytical data effectively never changes, so a week is safe. OFF is
 * crowdsourced and corrections land continuously, so a day keeps fixes flowing
 * through while still absorbing the bulk of repeat traffic.
 */
const USDA_TTL_SECONDS = 60 * 60 * 24 * 7;
const OFF_TTL_SECONDS = 60 * 60 * 24;

/* Bump to invalidate every cached entry after a response-shape change. */
const CACHE_VERSION = 'v1';

const MAX_QUERY_LENGTH = 120;
const MAX_USDA_PAGE_SIZE = 25;
const MAX_OFF_PAGE_SIZE = 20;

/* The datasets with laboratory-analysed phosphorus and potassium, plus Branded
 * for ingredient strings. Anything else is rejected rather than forwarded. */
const ALLOWED_DATA_TYPES = ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'];

/* Only the fields the client actually reads. OFF returns enormous documents
 * otherwise, and we pay for that bandwidth twice — once here, once at the edge. */
const OFF_FIELDS = [
  'code', 'product_name', 'brands', 'ingredients_text', 'additives_tags',
  'nutriments', 'serving_size', 'serving_quantity', 'quantity', 'categories_tags'
].join(',');

/*
 * OFF's usage policy asks for an identifying User-Agent with contact details.
 * A browser cannot set this header; a Worker can. Being a good API citizen is
 * a side benefit of proxying, not an afterthought.
 */
const OFF_USER_AGENT =
  'KidneyFoodLog/1.0 (https://github.com/Krishco06/kidney-food-log)';

/* 8741 is this project's dev port, per .claude/launch.json. */
const ALLOWED_ORIGINS = [
  'https://krishco06.github.io',
  'http://localhost:8741',
  'http://127.0.0.1:8741',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

/* ------------------------------------------------------------------ *
 * CORS
 * ------------------------------------------------------------------ */

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.indexOf(origin) !== -1;
}

export function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (isAllowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

/* ------------------------------------------------------------------ *
 * Parameter normalisation
 *
 * Normalisation is what makes caching effective: "Banana " and "banana" must
 * produce the same cache key, or the hit rate collapses and the rate limit
 * that motivated this proxy comes straight back.
 * ------------------------------------------------------------------ */

function cleanQuery(searchParams) {
  const raw = (searchParams.get('query') || '').trim().replace(/\s+/g, ' ');
  if (!raw) return { ok: false, status: 400, error: 'A search term is required.' };
  if (raw.length > MAX_QUERY_LENGTH) {
    return { ok: false, status: 400, error: 'That search term is too long.' };
  }
  return { ok: true, query: raw.toLowerCase() };
}

function cleanPageSize(searchParams, max) {
  let n = parseInt(searchParams.get('pageSize'), 10);
  if (!isFinite(n) || n < 1) n = max;
  return Math.min(n, max);
}

/**
 * @returns {{ok: true, canonical: string, params: URLSearchParams}
 *          | {ok: false, status: number, error: string}}
 */
export function normalizeUsdaParams(searchParams) {
  const q = cleanQuery(searchParams);
  if (!q.ok) return q;

  const requested = (searchParams.get('dataType') || '')
    .split(',').map((s) => s.trim()).filter(Boolean);

  /* Sorted so parameter order cannot fragment the cache. */
  const dataTypes = (requested.length
    ? requested.filter((t) => ALLOWED_DATA_TYPES.indexOf(t) !== -1)
    : ['Foundation', 'SR Legacy', 'Survey (FNDDS)']
  ).sort();

  if (!dataTypes.length) {
    return { ok: false, status: 400, error: 'No valid dataType was requested.' };
  }

  const params = new URLSearchParams();
  params.set('query', q.query);
  params.set('pageSize', String(cleanPageSize(searchParams, MAX_USDA_PAGE_SIZE)));
  params.set('dataType', dataTypes.join(','));
  return { ok: true, canonical: params.toString(), params };
}

export function normalizeOffParams(searchParams) {
  const q = cleanQuery(searchParams);
  if (!q.ok) return q;

  const params = new URLSearchParams();
  params.set('query', q.query);
  params.set('pageSize', String(cleanPageSize(searchParams, MAX_OFF_PAGE_SIZE)));
  return { ok: true, canonical: params.toString(), params };
}

/* ------------------------------------------------------------------ *
 * Shared proxy machinery
 * ------------------------------------------------------------------ */

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign(
      { 'Content-Type': 'application/json; charset=utf-8' },
      corsHeaders(origin)
    )
  });
}

function jsonPassthrough(body, origin, cacheState) {
  return new Response(body, {
    status: 200,
    headers: Object.assign(
      { 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': cacheState },
      corsHeaders(origin)
    )
  });
}

/*
 * Entries are RETAINED far longer than they are considered FRESH, so that a
 * stale copy is still on hand when the upstream is down. Freshness is tracked
 * ourselves via X-Fetched-At rather than by Cache-Control expiry, because an
 * expired entry is evicted and cannot be served stale.
 */
const RETENTION_SECONDS = 60 * 60 * 24 * 30;

/* Measured: Open Food Facts' search endpoint returns its "Page temporarily
 * unavailable" 503 roughly half the time under normal conditions, independent
 * of the query. One attempt is not enough to be usable. */
const UPSTREAM_ATTEMPTS = 3;
const RETRY_DELAY_MS = [0, 250, 750];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* A transient upstream hiccup is worth retrying; a rejection is not. */
function isRetryable(status) {
  return status === 500 || status === 502 || status === 503 || status === 504;
}

/**
 * Fetch JSON from an upstream, with retries.
 * @returns {{ok: true, body: string} | {ok: false, status: number, retryable: boolean}}
 */
async function fetchUpstream(upstreamUrl, headers) {
  let last = { ok: false, status: 502, retryable: true };

  for (let attempt = 0; attempt < UPSTREAM_ATTEMPTS; attempt++) {
    if (RETRY_DELAY_MS[attempt]) await sleep(RETRY_DELAY_MS[attempt]);

    let res;
    try {
      res = await fetch(upstreamUrl, {
        headers: Object.assign({ Accept: 'application/json' }, headers || {}),
        signal: AbortSignal.timeout(8000)
      });
    } catch (e) {
      last = { ok: false, status: 504, retryable: true };
      continue;
    }

    /* Rate limits and auth failures are final — retrying makes them worse. */
    if (res.status === 429) return { ok: false, status: 429, retryable: false };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: 403, retryable: false };
    }
    if (!res.ok) {
      last = { ok: false, status: res.status, retryable: isRetryable(res.status) };
      if (!last.retryable) return last;
      continue;
    }

    /*
     * A 200 is not a guarantee of JSON. Open Food Facts serves an HTML overload
     * page, and api.data.gov can return an nginx HTML error page. Passing
     * either through would surface to the user as "Unexpected token '<'", so
     * validate here and treat non-JSON as a retryable upstream failure.
     */
    const body = await res.text();
    try {
      JSON.parse(body);
    } catch (e) {
      last = { ok: false, status: 502, retryable: true };
      continue;
    }

    return { ok: true, body };
  }

  return last;
}

/**
 * Fetch through the edge cache, with stale-on-error.
 *
 * The cache key deliberately excludes the API key and the caller's origin, so
 * every visitor shares one entry and CORS is re-applied per request on the way
 * out. Failed responses are never cached.
 *
 * X-Cache values: HIT (fresh), MISS (fetched now), STALE (upstream failed and a
 * retained copy was served instead).
 */
async function cachedFetch({ request, ctx, origin, name, canonical, upstreamUrl, ttl, headers }) {
  const url = new URL(request.url);
  const cache = caches.default;
  const cacheKey = new Request(
    `${url.origin}/${name}/${CACHE_VERSION}?${canonical}`,
    { method: 'GET' }
  );

  let staleBody = null;
  const cached = await cache.match(cacheKey);
  if (cached) {
    const fetchedAt = Number(cached.headers.get('X-Fetched-At') || 0);
    const body = await cached.text();
    if (fetchedAt && (Date.now() - fetchedAt) / 1000 < ttl) {
      return jsonPassthrough(body, origin, 'HIT');
    }
    staleBody = body; // retained but past its freshness window
  }

  const result = await fetchUpstream(upstreamUrl, headers);

  if (result.ok) {
    /* Stored without CORS headers so one entry serves every allowed origin. */
    ctx.waitUntil(cache.put(cacheKey, new Response(result.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${RETENTION_SECONDS}`,
        'X-Fetched-At': String(Date.now())
      }
    })));
    return jsonPassthrough(result.body, origin, 'MISS');
  }

  /*
   * Upstream failed. Week-old food composition data is enormously better than
   * an error message — a banana's potassium has not changed — so serve the
   * retained copy if we have one.
   */
  if (staleBody) return jsonPassthrough(staleBody, origin, 'STALE');

  if (result.status === 429) {
    /* Passed through unchanged: the client already has a plain-language notice
     * for exactly this status. */
    return json({ error: 'The food database is busy right now.' }, 429, origin);
  }
  if (result.status === 403) {
    /* Our credentials, not theirs. Never echo upstream text — a bad-key error
     * can quote the key back. */
    return json({ error: 'The food database rejected the server key.' }, 502, origin);
  }
  if (result.status === 504) {
    return json({ error: 'The food database did not respond.' }, 504, origin);
  }
  return json({ error: 'The food database returned an error.' }, 502, origin);
}

/* ------------------------------------------------------------------ *
 * Worker
 * ------------------------------------------------------------------ */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'GET') {
      return json({ error: 'Only GET is supported.' }, 405, origin);
    }

    if (url.pathname === '/health') {
      return json({ ok: true, hasKey: !!env.USDA_API_KEY }, 200, origin);
    }

    /*
     * Browsers send Origin on cross-origin fetches, so this blocks casual
     * scraping. It is not a security boundary — Origin is trivially forged
     * outside a browser — which is why the parameter caps and the cache, not
     * this check, are what actually protect the key.
     */
    if (origin && !isAllowedOrigin(origin)) {
      return json({ error: 'This proxy is not open to other sites.' }, 403, null);
    }

    /* ---- USDA FoodData Central ---- */
    if (url.pathname === '/usda/search') {
      const norm = normalizeUsdaParams(url.searchParams);
      if (!norm.ok) return json({ error: norm.error }, norm.status, origin);

      if (!env.USDA_API_KEY) {
        /* Misconfiguration, not the user's fault — say so plainly so it is not
         * mistaken for a rate limit. */
        return json(
          { error: 'The food database key is not configured on the server.' },
          503, origin
        );
      }

      const upstream = new URL(USDA_BASE + '/foods/search');
      norm.params.forEach((v, k) => upstream.searchParams.set(k, v));
      upstream.searchParams.set('api_key', env.USDA_API_KEY);

      return cachedFetch({
        request, ctx, origin,
        name: 'usda/search',
        canonical: norm.canonical,
        upstreamUrl: upstream.toString(),
        ttl: USDA_TTL_SECONDS
      });
    }

    /* ---- Open Food Facts text search ---- */
    if (url.pathname === '/off/search') {
      const norm = normalizeOffParams(url.searchParams);
      if (!norm.ok) return json({ error: norm.error }, norm.status, origin);

      const upstream = new URL(OFF_BASE + '/cgi/search.pl');
      upstream.searchParams.set('search_terms', norm.params.get('query'));
      upstream.searchParams.set('search_simple', '1');
      upstream.searchParams.set('action', 'process');
      upstream.searchParams.set('json', '1');
      upstream.searchParams.set('page_size', norm.params.get('pageSize'));
      upstream.searchParams.set('fields', OFF_FIELDS);

      return cachedFetch({
        request, ctx, origin,
        name: 'off/search',
        canonical: norm.canonical,
        upstreamUrl: upstream.toString(),
        ttl: OFF_TTL_SECONDS,
        headers: { 'User-Agent': OFF_USER_AGENT }
      });
    }

    return json({ error: 'Not found.' }, 404, origin);
  }
};
