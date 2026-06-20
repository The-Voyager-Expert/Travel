/* Travel — service worker. Cache-as-you-visit so any page/asset opened once is
   readable offline (planes, tunnels, abroad with no data). Lives at the site
   root (Travel Website/ → /Travel/ on GitHub Pages) so its scope covers every
   page. Navigations: network-first with offline cache fallback. Assets:
   stale-while-revalidate (instant from cache, refreshed in the background). */
var CACHE = 'travel-cache-v21';

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

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('Guides/Guides-Index.html');
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) {
          c.put(req, res.clone());
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      });
    })
  );
});
