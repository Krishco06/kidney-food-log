/*
 * sw.js — offline app shell
 *
 * Offline matters more than usual here. In-center hemodialysis means sitting in
 * a chair for ~4 hours, 3 times a week, often in a basement treatment floor with
 * poor reception — a realistic moment for a patient to actually log meals. The
 * shell must load and the existing log must be readable with no network.
 *
 * Food lookups are network-only. Caching a stale nutrient value and presenting
 * it as current would undercut the whole point of this app.
 */

/* Bump on every shell change so returning users pick up the new bundle. */
var CACHE = 'kidney-food-log-v16';

var SHELL = [
  './',
  'index.html',
  'css/app.css',
  'js/additives.js',
  'js/commonfoods.js',
  'js/commonfoods-desc.js',
  'js/scanner.js',
  'js/barcode.js',
  'js/units.js',
  'js/foods.js',
  'js/log.js',
  'js/app.js',
  'manifest.webmanifest',
  'icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  // Never serve food data from cache — a stale nutrient value is worse than none.
  if (url.hostname !== self.location.hostname) return;
  if (e.request.method !== 'GET') return;

  /*
   * Stale-while-revalidate for the shell: answer instantly from cache (fast on
   * a dialysis-floor connection, works with no network at all), but always
   * refetch in the background so the next launch has the current version.
   *
   * Plain cache-first was tried first and is wrong here — it strands users on
   * whatever version they installed, and this population will not know to hard
   * refresh. A fix to the additive dictionary needs to actually reach them.
   */
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      var network = fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () {
        return hit || caches.match('index.html');
      });
      return hit || network;
    })
  );
});
