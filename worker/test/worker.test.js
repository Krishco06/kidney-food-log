/*
 * Tests for the USDA proxy Worker.
 *
 * Run: node worker/test/worker.test.js
 *
 * Two things carry real risk here and get the most coverage:
 *   1. The API key must never appear in anything sent back to a browser. That
 *      is the entire reason the Worker exists.
 *   2. Cache-key normalisation must actually collapse equivalent searches. If
 *      it does not, the cache hit rate drops and the shared rate limit that
 *      motivated this proxy comes straight back.
 */

import worker, { normalizeSearchParams, isAllowedOrigin, corsHeaders } from '../src/index.js';

let passed = 0;
const failed = [];

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed++; })
    .catch((err) => { failed.push({ name, message: err.message }); });
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const ORIGIN = 'https://krishco06.github.io';
const KEY = 'SECRET_TEST_KEY_DO_NOT_LEAK';

/* ------------------------------------------------------------------ *
 * Test doubles
 * ------------------------------------------------------------------ */

function makeCache() {
  const store = new Map();
  return {
    store,
    async match(req) {
      const hit = store.get(req.url);
      return hit ? new Response(hit, { status: 200 }) : undefined;
    },
    async put(req, res) { store.set(req.url, await res.text()); }
  };
}

/* waitUntil must run synchronously enough for assertions; collect the promises. */
function makeCtx() {
  const pending = [];
  return { waitUntil: (p) => pending.push(p), settle: () => Promise.all(pending) };
}

function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, opts) => { calls.push(String(url)); return handler(String(url), opts); };
  return calls;
}

function call(path, { origin = ORIGIN, method = 'GET', env, ctx, cache } = {}) {
  globalThis.caches = { default: cache || makeCache() };
  const headers = origin ? { Origin: origin } : {};
  return worker.fetch(
    new Request('https://api.example.workers.dev' + path, { method, headers }),
    env === undefined ? { USDA_API_KEY: KEY } : env,
    ctx || makeCtx()
  );
}

const OK_BODY = JSON.stringify({ foods: [{ fdcId: 1, description: 'Banana, raw' }] });
const okUpstream = () => new Response(OK_BODY, { status: 200 });

/* ------------------------------------------------------------------ *
 * Parameter normalisation
 * ------------------------------------------------------------------ */

const norm = (qs) => normalizeSearchParams(new URLSearchParams(qs));

await test('rejects an empty query', () => {
  const r = norm('query=');
  assert(!r.ok && r.status === 400, 'empty query must be rejected');
  assert(!norm('').ok, 'missing query must be rejected');
});

await test('rejects an overlong query', () => {
  assert(!norm('query=' + 'a'.repeat(200)).ok, 'must cap query length');
});

await test('collapses equivalent queries to one cache key', () => {
  // Without this the cache fragments and the rate limit returns.
  const a = norm('query=Banana%20Raw');
  const b = norm('query=%20%20banana___raw%20'.replace(/___/g, '%20%20'));
  assert(a.ok && b.ok);
  assert(a.canonical === b.canonical,
    'case and whitespace must normalise: ' + a.canonical + ' vs ' + b.canonical);
});

await test('dataType order does not fragment the cache', () => {
  const a = norm('query=x&dataType=Foundation,SR Legacy');
  const b = norm('query=x&dataType=SR Legacy,Foundation');
  assert(a.canonical === b.canonical, 'dataType must be sorted');
});

await test('caps pageSize and rejects junk values', () => {
  assert(norm('query=x&pageSize=9999').params.get('pageSize') === '25', 'must cap at 25');
  assert(norm('query=x&pageSize=abc').params.get('pageSize') === '25', 'junk falls back');
  assert(norm('query=x&pageSize=-3').params.get('pageSize') === '25', 'negative falls back');
  assert(norm('query=x&pageSize=5').params.get('pageSize') === '5', 'valid value kept');
});

await test('drops unknown dataTypes instead of forwarding them', () => {
  const r = norm('query=x&dataType=Foundation,Malicious');
  assert(r.ok && r.params.get('dataType') === 'Foundation', r.params.get('dataType'));
  assert(!norm('query=x&dataType=Malicious').ok, 'all-invalid must be rejected');
});

await test('defaults to the analysed datasets', () => {
  // These are the ones with real phosphorus and potassium values.
  const dt = norm('query=banana').params.get('dataType');
  assert(dt.includes('Foundation') && dt.includes('SR Legacy') && dt.includes('Survey (FNDDS)'), dt);
});

/* ------------------------------------------------------------------ *
 * CORS
 * ------------------------------------------------------------------ */

await test('allows the Pages origin and localhost, nothing else', () => {
  assert(isAllowedOrigin('https://krishco06.github.io'));
  assert(isAllowedOrigin('http://localhost:8741'), 'the project dev port');
  assert(isAllowedOrigin('http://localhost:8080'));
  assert(!isAllowedOrigin('https://evil.example.com'));
  assert(!isAllowedOrigin(''), 'empty origin is not allowed');
  assert(!isAllowedOrigin(null));
});

await test('no Allow-Origin header is emitted for a disallowed origin', () => {
  assert(!('Access-Control-Allow-Origin' in corsHeaders('https://evil.example.com')));
  assert(corsHeaders(ORIGIN)['Access-Control-Allow-Origin'] === ORIGIN);
  assert(corsHeaders(ORIGIN).Vary === 'Origin', 'must Vary on Origin');
});

await test('preflight returns 204 with CORS headers', async () => {
  const res = await call('/usda/search?query=banana', { method: 'OPTIONS' });
  assert(res.status === 204, 'got ' + res.status);
  assert(res.headers.get('Access-Control-Allow-Origin') === ORIGIN);
});

await test('rejects a cross-site origin', async () => {
  mockFetch(okUpstream);
  const res = await call('/usda/search?query=banana', { origin: 'https://evil.example.com' });
  assert(res.status === 403, 'got ' + res.status);
  assert(!res.headers.get('Access-Control-Allow-Origin'), 'must not grant CORS to a stranger');
});

await test('rejects non-GET methods', async () => {
  const res = await call('/usda/search?query=banana', { method: 'POST' });
  assert(res.status === 405, 'got ' + res.status);
});

await test('unknown paths 404 — this is not a general proxy', async () => {
  assert((await call('/anything-else')).status === 404);
  assert((await call('/usda/food/12345')).status === 404, 'only search is exposed');
});

/* ------------------------------------------------------------------ *
 * The key must never leak
 * ------------------------------------------------------------------ */

await test('the API key is sent upstream but never returned to the browser', async () => {
  const calls = mockFetch(okUpstream);
  const res = await call('/usda/search?query=banana');
  const body = await res.text();

  assert(calls.length === 1 && calls[0].includes(KEY), 'key must reach USDA');
  assert(!body.includes(KEY), 'key must not appear in the response body');
  let headerDump = '';
  res.headers.forEach((v, k) => { headerDump += k + ':' + v + ';'; });
  assert(!headerDump.includes(KEY), 'key must not appear in any response header');
});

await test('an upstream 403 does not echo upstream text back to the browser', async () => {
  // A bad key can make USDA return a body quoting the key. Never pass it through.
  mockFetch(async () => new Response('Invalid api_key ' + KEY, { status: 403 }));
  const res = await call('/usda/search?query=banana');
  const body = await res.text();
  assert(res.status === 502, 'a bad server key is our fault, not a client error: ' + res.status);
  assert(!body.includes(KEY), 'must not echo the key: ' + body);
});

await test('reports a missing secret distinctly from a rate limit', async () => {
  const res = await call('/usda/search?query=banana', { env: {} });
  assert(res.status === 503, 'got ' + res.status);
  const body = await res.json();
  assert(/not configured/i.test(body.error), body.error);
});

await test('health endpoint reports key presence without revealing it', async () => {
  const res = await call('/health');
  const body = await res.json();
  assert(body.ok === true && body.hasKey === true);
  assert(!JSON.stringify(body).includes(KEY), 'must not expose the key');
});

/* ------------------------------------------------------------------ *
 * Upstream failure handling
 * ------------------------------------------------------------------ */

await test('passes a 429 through so the client shows its rate-limit notice', async () => {
  mockFetch(async () => new Response('rate limited', { status: 429 }));
  const res = await call('/usda/search?query=banana');
  assert(res.status === 429, 'got ' + res.status);
});

await test('maps an upstream network failure to 504', async () => {
  mockFetch(async () => { throw new Error('ECONNRESET'); });
  const res = await call('/usda/search?query=banana');
  assert(res.status === 504, 'got ' + res.status);
});

await test('maps an upstream 500 to 502', async () => {
  mockFetch(async () => new Response('boom', { status: 500 }));
  assert((await call('/usda/search?query=banana')).status === 502);
});

/* ------------------------------------------------------------------ *
 * Caching — what actually keeps us under the rate limit
 * ------------------------------------------------------------------ */

await test('a repeated search hits the cache and does not call USDA again', async () => {
  const cache = makeCache();
  const calls = mockFetch(okUpstream);

  const ctx1 = makeCtx();
  const first = await call('/usda/search?query=banana', { cache, ctx: ctx1 });
  await ctx1.settle();
  assert(first.headers.get('X-Cache') === 'MISS', 'first call is a miss');
  assert(calls.length === 1, 'first call goes upstream');

  const second = await call('/usda/search?query=banana', { cache, ctx: makeCtx() });
  assert(second.headers.get('X-Cache') === 'HIT', 'second call must hit cache');
  assert(calls.length === 1, 'second call must NOT go upstream, got ' + calls.length);
  assert(await second.text() === OK_BODY, 'cached body must match');
});

await test('equivalent-but-differently-typed searches share one cache entry', async () => {
  const cache = makeCache();
  const calls = mockFetch(okUpstream);

  const ctx1 = makeCtx();
  await call('/usda/search?query=Banana', { cache, ctx: ctx1 });
  await ctx1.settle();
  const res = await call('/usda/search?query=%20banana%20', { cache, ctx: makeCtx() });

  assert(res.headers.get('X-Cache') === 'HIT', 'normalisation must produce a cache hit');
  assert(calls.length === 1, 'must not call USDA twice, got ' + calls.length);
});

await test('the cache key never contains the API key', async () => {
  const cache = makeCache();
  mockFetch(okUpstream);
  const ctx = makeCtx();
  await call('/usda/search?query=banana', { cache, ctx });
  await ctx.settle();

  const keys = [...cache.store.keys()];
  assert(keys.length === 1, 'expected one entry, got ' + keys.length);
  assert(!keys[0].includes(KEY), 'cache key must not embed the secret: ' + keys[0]);
});

await test('cached responses still carry per-request CORS headers', async () => {
  // The cached entry is stored origin-agnostic so one entry serves every
  // allowed origin; CORS must be re-applied on the way out.
  const cache = makeCache();
  mockFetch(okUpstream);
  const ctx = makeCtx();
  await call('/usda/search?query=banana', { cache, ctx });
  await ctx.settle();

  const hit = await call('/usda/search?query=banana', { cache, origin: 'http://localhost:8080' });
  assert(hit.headers.get('X-Cache') === 'HIT');
  assert(hit.headers.get('Access-Control-Allow-Origin') === 'http://localhost:8080',
    'CORS must be applied per request, got ' + hit.headers.get('Access-Control-Allow-Origin'));
});

await test('a different search is a separate cache entry', async () => {
  const cache = makeCache();
  const calls = mockFetch(okUpstream);
  const ctx1 = makeCtx();
  await call('/usda/search?query=banana', { cache, ctx: ctx1 });
  await ctx1.settle();
  const ctx2 = makeCtx();
  await call('/usda/search?query=chicken', { cache, ctx: ctx2 });
  await ctx2.settle();
  assert(calls.length === 2, 'distinct searches must both go upstream');
  assert(cache.store.size === 2, 'expected 2 cache entries, got ' + cache.store.size);
});

await test('failures are not cached', async () => {
  const cache = makeCache();
  mockFetch(async () => new Response('rate limited', { status: 429 }));
  const ctx = makeCtx();
  await call('/usda/search?query=banana', { cache, ctx });
  await ctx.settle();
  assert(cache.store.size === 0, 'a 429 must not poison the cache');
});

/* ------------------------------------------------------------------ */

console.log('');
if (failed.length === 0) {
  console.log('  ' + passed + ' passed');
  console.log('');
  process.exit(0);
} else {
  console.log('  ' + passed + ' passed, ' + failed.length + ' FAILED');
  console.log('');
  failed.forEach((f) => {
    console.log('  x ' + f.name);
    console.log('      ' + f.message);
  });
  console.log('');
  process.exit(1);
}
