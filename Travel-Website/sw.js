/* Travel — service worker. NETWORK-FIRST for everything: when you are online you
   ALWAYS get the latest from the server (no stale cached pages/assets), so deploys
   go live immediately on the next load. The cache is only an offline fallback
   (planes, tunnels, abroad with no data) — a page/asset opened once stays readable
   offline. Lives at the site root (→ /Travel/ on GitHub Pages) so its scope covers
   every page.

   History: previously assets were stale-while-revalidate, which served the OLD
   cached copy first and refreshed in the background — so CSS/JS edits only appeared
   on the SECOND visit ("updates don't go live"). Switched to network-first so the
   cache can never hide a fresh deploy. (2026-06-20) */
var CACHE = 'travel-cache-v30';

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;

  // Network-first: try the network, cache the fresh copy, and only fall back to
  // the cache when the network fails (offline). Navigations fall back to the
  // Guides index when the exact page isn't cached.
  e.respondWith(
    fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('Guides-Index.html');
        return Response.error();
      });
    })
  );
});
