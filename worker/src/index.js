/*
 * Kidney Food Log — USDA FoodData Central proxy
 *
 * WHY THIS EXISTS
 * ---------------
 * The app is a static page with no backend, so any API key it ships is a public
 * key: visible in the bundle, visible in the request URL, scraped from the
 * public repo within days. The shared DEMO_KEY that avoids this is capped at
 * ~30 requests/hour across every user of it worldwide, which in practice means
 * food search is broken for anyone who opens the URL.
 *
 * This Worker is the smallest thing that fixes both: the key lives in a Worker
 * secret and never reaches the browser, and every visitor gets the full
 * 1,000 req/hour allowance instead of a throttled shared one.
 *
 * CACHING IS THE POINT, NOT AN OPTIMISATION
 * Food composition data is effectively immutable — a raw banana's potassium
 * does not change. Caching search responses for a week means the hundred
 * commonest searches ("banana", "chicken breast") hit Cloudflare's edge and
 * never touch USDA at all. Without it, a few hundred users would exhaust
 * 1,000 req/hour and we would be back where we started.
 *
 * DELIBERATELY NOT A GENERAL PROXY
 * Only the FDC search endpoint, only GET, only known origins, with capped
 * parameters. An open proxy carrying our key would be abused.
 */

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

/* Seven days. Bump the cache-busting suffix in CACHE_VERSION instead of
 * shortening this if the response shape ever changes. */
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const CACHE_VERSION = 'v1';

const MAX_PAGE_SIZE = 25;
const MAX_QUERY_LENGTH = 120;

/* The datasets with laboratory-analysed phosphorus and potassium, plus Branded
 * for coverage. Anything else is rejected rather than forwarded. */
const ALLOWED_DATA_TYPES = ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'];

/* 8741 is this project's dev port, per .claude/launch.json. */
const ALLOWED_ORIGINS = [
  'https://krishco06.github.io',
  'http://localhost:8741',
  'http://127.0.0.1:8741',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

/* ------------------------------------------------------------------ *
 * Helpers (exported for unit tests)
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

/**
 * Validate and normalise the caller's search parameters.
 *
 * Normalisation is what makes caching effective: "Banana " and "banana" must
 * produce the same cache key, or the cache hit rate collapses and the rate
 * limit comes straight back.
 *
 * @returns {{ok: true, canonical: string, params: URLSearchParams}
 *          | {ok: false, status: number, error: string}}
 */
export function normalizeSearchParams(searchParams) {
  const rawQuery = (searchParams.get('query') || '').trim().replace(/\s+/g, ' ');
  if (!rawQuery) {
    return { ok: false, status: 400, error: 'A search term is required.' };
  }
  if (rawQuery.length > MAX_QUERY_LENGTH) {
    return { ok: false, status: 400, error: 'That search term is too long.' };
  }
  const query = rawQuery.toLowerCase();

  let pageSize = parseInt(searchParams.get('pageSize'), 10);
  if (!isFinite(pageSize) || pageSize < 1) pageSize = 25;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  const requested = (searchParams.get('dataType') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  /* Sorted so parameter order cannot fragment the cache. */
  const dataTypes = (requested.length
    ? requested.filter((t) => ALLOWED_DATA_TYPES.indexOf(t) !== -1)
    : ['Foundation', 'SR Legacy', 'Survey (FNDDS)']
  ).sort();

  if (!dataTypes.length) {
    return { ok: false, status: 400, error: 'No valid dataType was requested.' };
  }

  const params = new URLSearchParams();
  params.set('query', query);
  params.set('pageSize', String(pageSize));
  params.set('dataType', dataTypes.join(','));

  return { ok: true, canonical: params.toString(), params };
}

function json(body, status, origin, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign(
      { 'Content-Type': 'application/json; charset=utf-8' },
      corsHeaders(origin),
      extraHeaders || {}
    )
  });
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

    if (url.pathname !== '/usda/search') {
      return json({ error: 'Not found.' }, 404, origin);
    }

    /*
     * Browsers send Origin on cross-origin fetches, so this blocks casual
     * scraping of the endpoint. It is not a security boundary — Origin is
     * trivially forged outside a browser — which is why the parameter caps and
     * the cache, not this check, are what actually protect the key.
     */
    if (origin && !isAllowedOrigin(origin)) {
      return json({ error: 'This proxy is not open to other sites.' }, 403, null);
    }

    const norm = normalizeSearchParams(url.searchParams);
    if (!norm.ok) {
      return json({ error: norm.error }, norm.status, origin);
    }

    if (!env.USDA_API_KEY) {
      /* Misconfiguration, not the user's fault — say so plainly so it is not
       * mistaken for a rate limit. */
      return json(
        { error: 'The food database key is not configured on the server.' },
        503, origin
      );
    }

    const cache = caches.default;
    /* Cache key deliberately excludes the API key and the caller's origin, so
     * every visitor shares one cache entry. */
    const cacheKey = new Request(
      `${url.origin}/usda/search/${CACHE_VERSION}?${norm.canonical}`,
      { method: 'GET' }
    );

    let cached = await cache.match(cacheKey);
    if (cached) {
      const body = await cached.text();
      return new Response(body, {
        status: 200,
        headers: Object.assign(
          { 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'HIT' },
          corsHeaders(origin)
        )
      });
    }

    const upstream = new URL(USDA_BASE + '/foods/search');
    norm.params.forEach((v, k) => upstream.searchParams.set(k, v));
    upstream.searchParams.set('api_key', env.USDA_API_KEY);

    let res;
    try {
      res = await fetch(upstream.toString(), {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(12000)
      });
    } catch (e) {
      return json({ error: 'The food database did not respond.' }, 504, origin);
    }

    if (res.status === 429) {
      /* Pass the rate limit through unchanged: the client already has a
       * plain-language notice for exactly this status. */
      return json({ error: 'The food database is busy right now.' }, 429, origin);
    }
    if (res.status === 403 || res.status === 401) {
      /* Our key, not theirs. Do not report this as a client error and do not
       * echo any upstream text that might contain the key. */
      return json({ error: 'The food database rejected the server key.' }, 502, origin);
    }
    if (!res.ok) {
      return json({ error: 'The food database returned an error.' }, 502, origin);
    }

    const body = await res.text();

    /* Store without CORS headers so one entry serves every allowed origin. */
    ctx.waitUntil(cache.put(cacheKey, new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`
      }
    })));

    return new Response(body, {
      status: 200,
      headers: Object.assign(
        { 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'MISS' },
        corsHeaders(origin)
      )
    });
  }
};
