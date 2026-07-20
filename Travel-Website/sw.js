/* Travel — service worker. NETWORK-FIRST for everything: when you are online you
   ALWAYS get the latest from the server (no stale cached pages/assets), so deploys
   go live immediately on the next load. The cache is only an offline fallback
   (planes, tunnels, abroad with no data) — a page/asset opened once stays readable
   offline. Lives at the site root (→ /Travel/ on GitHub Pages) so its scope covers
   every page.

   History: previously assets were stale-while-revalidate, which served the OLD
   cached copy first and refreshed in the background — so CSS/JS edits only appeared
   on the SECOND visit ("updates don't go live"). Switched to network-first so the
   cache can never hide a fresh deploy. (2026-06-20)

   2026-07-19: Added URL-rewriting to force-flush stale CSS/JS that iOS Safari
   aggressively caches by URL. Requests for guide-style.css?v<30 are rewritten to
   ?v=30; toolbar.js?v<102 to ?v=102. The SW file itself is always byte-checked
   fresh by the browser, so this fix reaches devices without touching any guide HTML.
   2026-07-19: Bumped toolbar.js min to 106 — adds in-page "Add to Home Screen" banner. */
var CACHE = 'travel-cache-v41';

/* Minimum asset versions — any request with a lower v= is rewritten to this version
   so the browser is forced to fetch fresh content even when it has an older copy
   aggressively cached under the old URL. */
var MIN_VERSIONS = { 'guide-style.css': 38, 'toolbar.js': 106 };

function rewriteAssetUrl(urlStr) {
  var u;
  try { u = new URL(urlStr); } catch (_) { return urlStr; }
  for (var asset in MIN_VERSIONS) {
    if (u.pathname.slice(-asset.length - 1) === '/' + asset) {
      var m = u.search.match(/[?&]v=(\d+)/);
      var ver = m ? parseInt(m[1], 10) : 0;
      if (ver < MIN_VERSIONS[asset]) {
        u.search = '?v=' + MIN_VERSIONS[asset];
        return u.toString();
      }
      break;
    }
  }
  return urlStr;
}

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

  /* Rewrite stale asset version URLs so iOS HTTP cache is bypassed */
  var rewrittenUrl = rewriteAssetUrl(req.url);
  var fetchReq = (rewrittenUrl !== req.url)
    ? new Request(rewrittenUrl, { cache: 'reload' })
    : req;

  // Network-first: try the network, cache the fresh copy, and only fall back to
  // the cache when the network fails (offline). Navigations fall back to the
  // Guides index when the exact page isn't cached.
  e.respondWith(
    fetch(fetchReq).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(fetchReq, copy); });
      return res;
    }).catch(function () {
      return caches.match(fetchReq).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('Guides-Index.html');
        return Response.error();
      });
    })
  );
});
