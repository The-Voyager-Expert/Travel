/**
 * toolbar.js — shared travel navigation bar
 *
 * ⚠️ HOME: Travel Website/assets/toolbar.js — site-wide shared asset.
 * The shared scripts/styles (toolbar.js, weather.js,
 * guide-style.css, mobile.css, climate.json) all live in assets/. Every page
 * loads them from assets/ at its own relative depth below the site root:
 *   · depth-1 pages (Guides-Index.html,
 *     Trip-Essentials/*.html):                    src="./assets/toolbar.js"
 *   · depth-2 pages (Guides/City/*.html,
 *     Trip-Essentials/Maps|Plug Adapter/*.html):  src="../../assets/toolbar.js"
 *
 * Each page needs:
 *   <div id="toolbar-mount" data-depth="N" data-maxwidth="W"></div>
 *   <script src="PATH-TO-assets/toolbar.js"></script>   ← before </body>
 *
 *   data-depth    = directory levels below the site root  (0, 1 or 2)
 *                   (depth describes the PAGE's location, not the script's)
 *   data-maxwidth = inner max-width px  (760 for Trip-Essentials, 940 for Guides)
 *
 * To update the toolbar for every page: edit ONLY this file.
 */

/* ── Pre-hide body immediately — prevents the page-background flash that occurs
   while the browser waits for this script to finish downloading. Injecting a
   <style> rule into <head> takes effect before the next paint; the inline
   body.style.opacity below is a belt-and-suspenders fallback.
   A safety setTimeout removes the rule after 2 s if something goes wrong. */
(function () {
  try {
    var _s = document.createElement('style');
    _s.id = '_tbhide';
    _s.textContent = 'body{opacity:0!important;transition:none!important}';
    (document.head || document.documentElement).appendChild(_s);
    setTimeout(function () {
      var el = document.getElementById('_tbhide');
      if (el) el.parentNode.removeChild(el);
      document.body.style.opacity = '1'; /* always reveal — also clears CSS body{opacity:0} */
    }, 2000);
  } catch (e) {}
})();

/* ── Theme early-init — read stored preference and stamp data-theme on <html>
   before the first paint. Body is opacity:0 (from web-travel-style.css) so
   there is no flash; the html[data-theme] CSS rules injected later by the main
   toolbar IIFE will already match by the time the body is revealed. ── */
(function () {
  try {
    var t = localStorage.getItem('tve_theme');
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();

/* ── Font preload — inject Google Fonts <link> so CSS @import doesn't block render */
(function () {
  try {
    var head = document.head || document.getElementsByTagName('head')[0];
    if (!head || document.querySelector('link[href*="fonts.googleapis.com/css2"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&display=swap';
    head.appendChild(link);
  } catch (e) {}
})();

/* ── CSS version guard — if guide-style.css is cached at v < CURRENT, swap the
   link href so the browser re-fetches the latest styles. Transparent to HTML
   (no guide re-stamp needed); runs before any other toolbar logic.

   CACHE-BUST ARCHITECTURE (2026-07-26):
   • guide-style.css → this CURRENT guard rewrites ?v= at runtime
   • toolbar.js itself → sw.js MIN_VERSIONS rewrites ?v= in the service worker
   • NEVER bump ?v= in any HTML file — it breaks HMAC stamps on guides
   • To deploy a toolbar.js or guide-style.css change:
     1. Bump CURRENT here (for CSS) or MIN_VERSIONS in sw.js (for toolbar.js)
     2. Bump CACHE version in sw.js
     3. Done — one or two files, zero guide re-stamps */
(function () {
  var CURRENT = 102;
  var link = document.querySelector('link[href*="guide-style.css"]');
  if (!link) return;
  var m = link.href.match(/[?&]v=(\d+)/);
  if (m && parseInt(m[1], 10) >= CURRENT) return;
  link.href = link.href.replace(/[?&]v=\d+/, '') + '?v=' + CURRENT;
})();

/* ── PWA wiring — inject the web-app manifest + Apple home-screen tags and
   register the offline service worker. One edit wires the whole site; paths use
   the page's data-depth (same base the nav uses). No-ops on file:// and never
   double-injects. Full notes: Brain/Reference/Toolbar.html § PWA. */
(function () {
  try {
    var d = document, head = d.head || d.getElementsByTagName('head')[0];
    if (!head) return;
    var m = d.getElementById('toolbar-mount');
    var dep = m ? parseInt(m.dataset.depth || '1', 10) : 1;
    var b = new Array(dep + 1).join('../');
    function link(rel, href, attrs) {
      if (d.querySelector('link[rel="' + rel + '"]')) return;
      var l = d.createElement('link'); l.rel = rel; l.href = href;
      if (attrs) for (var k in attrs) l.setAttribute(k, attrs[k]);
      head.appendChild(l);
    }
    function meta(name, content) {
      if (d.querySelector('meta[name="' + name + '"]')) return;
      var el = d.createElement('meta'); el.name = name; el.content = content; head.appendChild(el);
    }
    link('manifest', b + 'manifest.webmanifest');
    link('apple-touch-icon', b + 'assets/icons/apple-touch-icon.png');
    link('icon', b + 'assets/icons/favicon-32.png', { sizes: '32x32', type: 'image/png' });
    /* Beige, matching the page and the toolbar (owner 2026-08-10). Was #b85c2a,
       which painted the phone's status-bar band terracotta above a bar that no
       longer is. */
    meta('theme-color', '#f5f4f0');
    meta('apple-mobile-web-app-capable', 'yes');
    meta('mobile-web-app-capable', 'yes');
    meta('apple-mobile-web-app-status-bar-style', 'default');
    meta('apple-mobile-web-app-title', 'Guide My Days');
    if ('serviceWorker' in navigator &&
        (location.protocol === 'https:' || location.hostname === 'localhost')) {
      var _hadCtl = !!navigator.serviceWorker.controller;
      window.addEventListener('load', function () {
        navigator.serviceWorker.register(b + 'sw.js', { scope: b || './' }).then(function (reg) {
          /* Actively poll for a newer sw.js on every load so a shipped fix
             propagates on its own. Without this, iOS pins the cached service
             worker (and the toolbar.js/CSS it rewrites via MIN_VERSIONS), so
             fixes "never land" until the user manually clears site data. */
          try { reg.update(); } catch (e) {}
        })['catch'](function () {});
      });
      /* When a NEWER service worker takes control of an already-controlled page,
         reload ONCE so the fresh assets are used immediately. The sessionStorage
         guard makes a reload loop impossible; _hadCtl skips the reload on the
         first-ever install (nothing stale to replace). */
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        try {
          if (!_hadCtl) return;
          if (sessionStorage.getItem('tve-sw-reloaded')) return;
          sessionStorage.setItem('tve-sw-reloaded', '1');
          location.reload();
        } catch (e) {}
      });
    }
  } catch (e) {}
})();

/* ── PWA install banner — "Add to home screen" prompt on mobile.
   Android/Chrome: intercepts the native beforeinstallprompt event and shows a
   pill at the bottom of the screen. iOS/Safari: detects the platform and shows
   a manual "Tap Share → Add to Home Screen" hint instead (no programmatic
   prompt exists on iOS). Both dismiss permanently via localStorage.
   Only fires on HTTPS (or localhost) and when the app isn't already installed. */
(function () {
  try {
    var DISMISSED_KEY = 'tve_a2hs_dismissed';
    if (localStorage.getItem(DISMISSED_KEY)) return;

    /* Already running as installed PWA — no banner needed */
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) return;

    /* Only show on mobile viewports */
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

    var _deferredPrompt = null;

    function _dismiss() {
      localStorage.setItem(DISMISSED_KEY, '1');
      var b = document.getElementById('tve-a2hs-banner');
      if (b) {
        b.style.transition = 'opacity .3s';
        b.style.opacity = '0';
        setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 350);
      }
    }

    function _base() {
      var m = document.getElementById('toolbar-mount');
      var dep = m ? parseInt(m.dataset.depth || '1', 10) : 1;
      return new Array(dep + 1).join('../');
    }

    function _showBanner(isIOS) {
      if (document.getElementById('tve-a2hs-banner')) return;
      var banner = document.createElement('div');
      banner.id = 'tve-a2hs-banner';
      banner.setAttribute('role', 'complementary');
      banner.setAttribute('aria-label', 'Add to home screen');
      banner.style.cssText = [
        'position:fixed', 'bottom:0', 'left:0', 'right:0', 'z-index:9999',
        'background:#fff', 'border-top:1.5px solid #c8a44a',
        'padding:12px 16px calc(14px + env(safe-area-inset-bottom,0px))', 'display:flex', 'align-items:center',
        'gap:12px', 'box-shadow:0 -2px 12px rgba(0,0,0,.10)',
        'font-family:inherit', 'font-size:13px', 'color:#3d3a32',
        'animation:tve_slide_up .35s ease'
      ].join(';');

      /* Inline keyframe */
      if (!document.getElementById('tve-a2hs-style')) {
        var st = document.createElement('style');
        st.id = 'tve-a2hs-style';
        st.textContent = '@keyframes tve_slide_up{from{transform:translateY(100%)}to{transform:translateY(0)}}';
        document.head.appendChild(st);
      }

      /* App icon */
      var icon = document.createElement('img');
      icon.src = _base() + 'assets/icons/apple-touch-icon.png';
      icon.alt = '';
      icon.style.cssText = 'width:40px;height:40px;border-radius:9px;flex-shrink:0;';

      /* Text block */
      var txt = document.createElement('div');
      txt.style.cssText = 'flex:1;line-height:1.35;';
      if (isIOS) {
        txt.innerHTML = '<strong style="display:block;font-size:13px;color:#3d3a32;">Add to Home Screen</strong>'
          + '<span style="font-size:11px;color:#6b6860;">Tap \u{1F4E4} Share then <strong>Add to Home Screen</strong></span>';
      } else {
        txt.innerHTML = '<strong style="display:block;font-size:13px;color:#3d3a32;">Add to Home Screen</strong>'
          + '<span style="font-size:11px;color:#6b6860;">Open like an app — works offline too</span>';
      }

      /* Buttons */
      var right = document.createElement('div');
      right.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0;';

      if (!isIOS) {
        var addBtn = document.createElement('button');
        addBtn.textContent = 'Add';
        addBtn.style.cssText = 'background:#b85c2a;color:#fff;border:none;border-radius:6px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;';
        addBtn.onclick = function () {
          if (_deferredPrompt) {
            _deferredPrompt.prompt();
            _deferredPrompt.userChoice.then(function () { _dismiss(); });
          } else {
            _dismiss();
          }
        };
        right.appendChild(addBtn);
      }

      var closeBtn = document.createElement('button');
      closeBtn.setAttribute('aria-label', 'Dismiss');
      closeBtn.innerHTML = '&times;';
      closeBtn.style.cssText = 'background:none;border:none;font-size:20px;color:#9a9690;cursor:pointer;padding:4px 6px;line-height:1;';
      closeBtn.onclick = _dismiss;
      right.appendChild(closeBtn);

      banner.appendChild(icon);
      banner.appendChild(txt);
      banner.appendChild(right);
      document.body.appendChild(banner);
    }

    /* Android/Chrome: browser fires beforeinstallprompt when the PWA criteria are met */
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      _deferredPrompt = e;
      setTimeout(function () { _showBanner(false); }, 2000);
    });

    /* iOS Safari: no programmatic prompt — show the manual instruction instead */
    var ua = navigator.userAgent;
    var isIOS = /iP(hone|ad|od)/.test(ua) && !window.MSStream;
    var isSafariOnly = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    if (isIOS && isSafariOnly) {
      window.addEventListener('load', function () {
        setTimeout(function () { _showBanner(true); }, 3000);
      });
    }
  } catch (e) {}
})();

(function () {
  'use strict';

  /* ── Hide page immediately so the toolbar insertion doesn't cause a visible
     layout shift (flicker). Revealed below once the bar is in the DOM.      */
  document.body.style.opacity = '0';

  var mount      = document.getElementById('toolbar-mount');
  var depth      = mount ? parseInt(mount.dataset.depth    || '1',   10) : 1;
  // maxWidth (data-maxwidth) is retained for backward-compat but NO LONGER caps the
  // bar. The button row is width:max-content + margin:0 auto, so it self-centers on
  // the viewport axis (same axis the page content centers on) regardless of this
  // value. Do NOT reinstate a width cap from this — capping is exactly what broke
  // centering twice (left-pack-with-right-gap, then hidden Trips). See Toolbar.html
  // § 7 Centering; brain_check.py check_toolbar_centering enforces it.
  var maxWidth   = mount ? parseInt(mount.dataset.maxwidth || '760', 10) : 760;
  var base       = new Array(depth + 1).join('../');   // e.g. depth=2 → '../../'
  var curr     = location.pathname.split('/').pop() || 'index.html';
  var prevHref = mount ? (mount.dataset.prev || '') : '';
  var nextHref = mount ? (mount.dataset.next || '') : '';

  /* ── "new" badge on dropdown children ──────────────────────────────────────
     A page shipped within the last NEW_WINDOW_DAYS shows a small gold NEW badge
     next to its name inside its dropdown (and in the mobile hamburger). Set by
     `newSince: 'YYYY-MM-DD'` — the page's ship date — on the child entry.

     Owner rule 2026-08-08: a new page's NEW badge belongs on the toolbar entry,
     beside the name, under the section it sits in ("it is under Safety, and
     there [are] others like that"). Before this, a freshly shipped page had to
     be duplicated into the Also Recommended panel on index.html just to earn a
     badge — that duplication is now banned (brain_check.
     check_also_recommended_excludes_toolbar_pages), so the badge lives here.

     The window matches the Also Recommended / Guides-Index badge exactly (21
     days, index.html "New badge" script), so the badge self-expires and no crib
     has to remember to strip it. A `newSince` date left behind after the window
     closes is harmless — it simply stops rendering.

     Never put the badge on the top strip. A badge widens the tab and the strip
     has no spare width (Nineteenth non-negotiable). Dropdown children only. */
  var NEW_WINDOW_DAYS = 21;
  function isNewEntry(entry) {
    if (!entry || !entry.newSince) return false;
    var d = new Date(entry.newSince + 'T00:00:00');
    if (isNaN(d.getTime())) return false;
    return (Date.now() - d.getTime()) <= NEW_WINDOW_DAYS * 86400000;
  }
  /* Write `text` into `el` as a label span, plus a NEW badge when in-window. */
  function setEntryLabel(el, text, entry, badgeClass) {
    if (!isNewEntry(entry)) { el.textContent = text; return; }
    el.classList.add('tb-has-new');
    var lb = document.createElement('span');
    lb.className = 'tb-entry-label';
    lb.textContent = text;
    var nb = document.createElement('span');
    nb.className = badgeClass;
    nb.textContent = 'new';
    el.appendChild(lb);
    el.appendChild(nb);
  }

  /* ── Links ─────────────────────────────────────────────────────────────── */
  var ITEMS = [
    null,
    { href: base + 'index.html', text: '🌐 Guides', full: '🌐 Travel Guides' },
    null,
    /* OWNER-DIRECTED 2026-08-09: 👕 Packing and 🔌 Plug Adapters were standalone
       top-strip tabs; both are now children here, Packing first. Before You Go
       itself is the FIRST child because a group's parent button carries no href
       of its own (see the ITEMS render loop) — without that row the pre-trip
       dashboard would drop out of the nav entirely. Top strip: 13 tabs -> 11.
       Children keep their own icons, so '🧳 Before You Go' is in
       check_toolbar_group_icon_consistency's EXEMPT_GROUPS alongside
       Flights / Safety / Time Zones. */
    { group: '🧳 Before You Go', children: [
        { href: base + 'Trip-Essentials/Before-You-Go.html',                   text: '🧳 Before You Go' },
        { href: base + 'Trip-Essentials/Travel-Packing.html',                  text: '👕 Packing Checklist' },
        { href: base + 'Trip-Essentials/Plug-Adapter/Plug-Adapter-Guide.html', text: '🔌 Plug Adapters' },
      ] },
    null,
    { group: '🏨 Where to Stay', children: [
        { href: base + 'Trip-Essentials/Neighborhoods.html',                text: '🏨 Neighborhoods' },
        { href: base + 'Trip-Essentials/Hotels-Stays.html',                 text: '🏨 Hotels & Stays' },
        { href: base + 'Trip-Essentials/Best-Most-Luxurious-Hotels.html',   text: '🏨 Most Luxurious Hotels' },
        { href: base + 'Trip-Essentials/Best-Unique-Hotels.html',           text: '🏨 Unique Hotels' },
        { href: base + 'Trip-Essentials/Best-Resorts.html',                 text: '🏨 Resorts' },
        { href: base + 'Trip-Essentials/Best-Ultra-Luxurious-Resorts.html', text: '🏨 Ultra-Luxurious Resorts' },
      ] },
    null,
    /* OWNER-DIRECTED 2026-08-09: every Best-Of page on the top strip, mirroring
       the hamburger's Best Of section (which stays the source for the mobile
       list). Browse by category leads, then A–Z. 35 rows is far taller than a
       viewport, so .tb-menu carries a max-height + scroll — see the styleEl. */
    { group: '🏆 Best Of', children: [
        { href: base + 'Trip-Essentials/Best-Of-Index.html',                      text: '🏆 Browse by category' },
        { href: base + 'Trip-Essentials/Best-Amusement-Parks.html',               text: '🏆 Amusement Parks' },
        { href: base + 'Trip-Essentials/Best-Animal-Encounters.html',             text: '🏆 Animal Encounters' },
        { href: base + 'Trip-Essentials/Best-Aquariums.html',                     text: '🏆 Aquariums' },
        { href: base + 'Trip-Essentials/Best-Architecture.html',                  text: '🏆 Architecture' },
        { href: base + 'Trip-Essentials/Best-Art-Museums.html',                   text: '🏆 Art Museums' },
        { href: base + 'Trip-Essentials/Best-Beaches.html',                       text: '🏆 Beaches' },
        { href: base + 'Trip-Essentials/Best-Castles.html',                       text: '🏆 Castles' },
        { href: base + 'Trip-Essentials/Best-Cathedrals.html',                    text: '🏆 Cathedrals' },
        { href: base + 'Trip-Essentials/Best-Caves.html',                         text: '🏆 Caves' },
        { href: base + 'Trip-Essentials/Best-Gardens.html',                       text: '🏆 Gardens' },
        { href: base + 'Trip-Essentials/Best-Hard-to-Reach-Places.html',          text: '🏆 Hard-to-Reach Places' },
        { href: base + 'Trip-Essentials/Best-Hot-Springs.html',                   text: '🏆 Hot Springs' },
        { href: base + 'Trip-Essentials/Best-Islands.html',                       text: '🏆 Islands' },
        { href: base + 'Trip-Essentials/Best-Kids-Friendly-Places.html',          text: '🏆 Kid-Friendly Destinations' },
        { href: base + 'Trip-Essentials/Best-Kids-Museums.html',                  text: "🏆 Kids' Museums" },
        { href: base + 'Trip-Essentials/Best-Lakes.html',                         text: '🏆 Lakes' },
        { href: base + 'Trip-Essentials/Best-Mountains-and-Rock-Formations.html', text: '🏆 Mountains & Rock Formations' },
        { href: base + 'Trip-Essentials/Best-Museums.html',                       text: '🏆 Museums' },
        { href: base + 'Trip-Essentials/Best-National-Parks-by-Country.html',     text: '🏆 National Parks' },
        { href: base + 'Trip-Essentials/Best-Natural-Phenomena.html',             text: '🏆 Natural Phenomena' },
        { href: base + 'Trip-Essentials/Best-Observation-Decks.html',             text: '🏆 Observation Decks' },
        { href: base + 'Trip-Essentials/Best-Safari.html',                        text: '🏆 Safari' },
        { href: base + 'Trip-Essentials/Best-Scuba-Diving.html',                  text: '🏆 Scuba Diving' },
        { href: base + 'Trip-Essentials/Best-Ski-Resorts.html',                   text: '🏆 Ski Resorts' },
        { href: base + 'Trip-Essentials/Best-Surfing.html',                       text: '🏆 Surfing' },
        { href: base + 'Trip-Essentials/Best-UNESCO-Sites.html',                  text: '🏆 UNESCO Sites' },
        { href: base + 'Trip-Essentials/Best-Unique-Museums.html',                text: '🏆 Unique Museums' },
        { href: base + 'Trip-Essentials/Best-Volcanoes.html',                     text: '🏆 Volcanoes' },
        { href: base + 'Trip-Essentials/Best-Wine-Regions.html',                  text: '🏆 Wine Regions' },
        { href: base + 'Trip-Essentials/Best-Wonders-of-the-World.html',          text: '🏆 Wonders of the World' },
      ] },
    null,
    { href: base + 'Trip-Essentials/Maps/World-Map.html', text: '🗺️ Maps', full: '🗺️ World Map' },
    null,
    { group: '📊 Stats', children: [
        { href: base + 'Trip-Essentials/Destination-Records.html',        text: '📊 Destination Records' },
        { href: base + 'Trip-Essentials/Stats-Across-US.html',            text: '📊 Stats Across US' },
        { href: base + 'Trip-Essentials/Stats-Across-Canada.html',        text: '📊 Stats Across Canada' },
        { href: base + 'Trip-Essentials/Europe-Stats.html',               text: '📊 Stats Across Europe' },
        { href: base + 'Trip-Essentials/Asia-Stats.html',                 text: '📊 Stats Across Asia' },
        { href: base + 'Trip-Essentials/Africa-Stats.html',              text: '📊 Stats Across Africa' },
        { href: base + 'Trip-Essentials/South-America-Stats.html',        text: '📊 Stats Across South America' },
        { href: base + 'Trip-Essentials/Caribbean-Stats.html',            text: '📊 Stats Across the Caribbean' },
        { href: base + 'Trip-Essentials/Oceania-Stats.html',             text: '📊 Stats Across Oceania' },
      ]},
    null,
    { group: '✈️ Flights', children: [
        { href: base + 'Trip-Essentials/Airlines-of-the-World.html', text: '✈️ Airlines', newSince: '2026-08-09' },
        { href: base + 'Trip-Essentials/Delta-Routes-SEA.html',  text: '✈️ Delta Seattle Hub' },
        { href: base + 'Trip-Essentials/Delta-Routes-Full.html', text: '✈️ Delta Full Network' },
        { href: base + 'Trip-Essentials/Airport-Connection-Times.html', text: '⏱️ Connection Times', newSince: '2026-08-07' },
        { href: base + 'Trip-Essentials/Lounges-US.html',        text: '💻 US Lounges' },
        { href: base + 'Trip-Essentials/Lounges-Europe.html',    text: '💻 EU Lounges' },
        { href: base + 'Trip-Essentials/Trusted-Traveler.html',         text: '🛂 Global Entry & CLEAR' },
        { href: base + 'Trip-Essentials/Baggage.html',           text: '🛄 Baggage' },
        { href: base + 'Trip-Essentials/Luggage-Storage.html',        text: '🧳 Luggage Storage', newSince: '2026-08-07' },
        { href: base + 'Trip-Essentials/Passport.html',          text: '📘 Passport' },
      ] },
    null,
    { group: '🚆 Trains', children: [
        { href: base + 'Trip-Essentials/European-Train-Guide.html',    text: '🚆 European Train Guide',      full: '🚆 European Train Guide'      },
        { href: base + 'Trip-Essentials/Day-Trips.html',              text: '🚆 Day Trips by Train',        full: '🚆 Day Trips by Train'        },
        { href: base + 'Trip-Essentials/Scenic-Train-Journeys.html',  text: '🚆 Scenic Train Journeys',    full: '🚆 Scenic Train Journeys',    newSince: '2026-08-07' },
        { href: base + 'Trip-Essentials/Train-Passes.html',           text: '🚆 Train Pass Comparison',    full: '🚆 Train Pass Comparison',    newSince: '2026-08-07' },
      ] },
    null,
    { href: base + 'Trip-Essentials/Currency-Guide.html', text: '💰 Currency', full: '💰 Currency' },
    null,
    { group: '🕐 Time Zones', children: [
        { href: base + 'Trip-Essentials/Time-Zones.html',        text: '🕐 Time Zones',       full: '🕐 Time Zones' },
        { href: base + 'Trip-Essentials/Sunrise-Sunset.html',    text: '🌅 Sunrise & Sunset', full: '🌅 Sunrise & Sunset' },
      ] },
    null,
    { group: '🌤️ Weather', children: [
        { href: base + 'Trip-Essentials/Climate-Finder.html',    text: '🌤️ Browse by Climate' },
        { href: base + 'Trip-Essentials/Weather.html',           text: '🌤️ Browse by City' },
        { href: base + 'Trip-Essentials/When-to-Go.html',        text: '🌤️ When to Go' },
      ] },
    null,
    { group: '🛡️ Safety', children: [
        { href: base + 'Trip-Essentials/Safety-Guide.html',      text: '🛡️ Safety Guide' },
        { href: base + 'Trip-Essentials/Vaccines.html',          text: '💉 Vaccines' },
        { href: base + 'Trip-Essentials/Tap-Water.html',         text: '🚰 Tap Water' },
        { href: base + 'Trip-Essentials/Travel-Insurance.html',  text: '🛟 Travel Insurance' },
        { href: base + 'Trip-Essentials/First-Timer-Mistakes.html', text: '⚠️ First-Timer Mistakes', newSince: '2026-08-07' },
        { href: base + 'Trip-Essentials/Scams-By-City.html',     text: '🕵️ Scams & Traps', newSince: '2026-08-07' },
      ] },
    null,
    { group: '🪪 Visas', children: [
        { href: base + 'Trip-Essentials/Visas.html',                                    text: '🪪 Visas' },
        { href: base + 'Trip-Essentials/Entry-Requirements.html',                       text: '🪪 Entry Requirements' },
        { href: base + 'Trip-Essentials/Digital-Nomad-Visas.html',                        text: '🪪 Digital Nomad Visas' },
        { href: base + 'Trip-Essentials/Visa-Processing-Times.html',                    text: '🪪 Visa Processing Times' },
      ] },
    null,
    /* OWNER-DIRECTED 2026-08-10: new group, built from the width freed by
       removing the desktop site title. These 15 pages previously lived ONLY in
       the "Also Recommended" and "We Recommend" panels on index.html, so they
       were reachable from the homepage and nowhere else; they are now in the nav
       on every page. Both panels were deleted from index.html in the same
       commit — a page in the toolbar must never also sit in Also Recommended
       (CLAUDE.md corollary; check_also_recommended_excludes_toolbar_pages
       hard-fails otherwise, and the fix is always to drop the panel card).
       Children carry their own icons, so this group belongs in
       check_toolbar_group_icon_consistency's EXEMPT_GROUPS. */
    { group: '📋 Also Recommended', groupShort: '📋 Recommended', children: [
        { href: base + 'Trip-Essentials/Budget-Guide.html',       text: '💰 Budget' },
        { href: base + 'Trip-Essentials/Rental-Cars.html',        text: '🚗 Car Rental & Private' },
        { href: base + 'Trip-Essentials/Cards-ATM.html',          text: '💳 Cards & ATM' },
        { href: base + 'Trip-Essentials/City-Transit-Cards.html', text: '🎫 City Transit Cards' },
        { href: base + 'Trip-Essentials/Cruise-Ships.html',       text: '🚢 Cruise Lines', newSince: '2026-08-09' },
        { href: base + 'Trip-Essentials/Disney-Parks.html',       text: '🏰 Disney Parks', newSince: '2026-08-08' },
        { href: base + 'Trip-Essentials/Festival-Finder.html',    text: '🎉 Festival Finder' },
        { href: base + 'Trip-Essentials/More-Resources.html',     text: '📚 More Resources' },
        { href: base + 'Trip-Essentials/Pickleball.html',         text: '🏓 Pickleball' },
        { href: base + 'Trip-Essentials/Restaurants.html',        text: '🍽️ Restaurants' },
        { href: base + 'Trip-Essentials/SIM-Cards.html',          text: '📱 SIM Cards' },
        { href: base + 'Trip-Essentials/Sports-Calendar.html',    text: '🏆 Sports Calendar' },
        { href: base + 'Trip-Essentials/Tipping-Guide.html',      text: '💵 Tipping' },
        { href: base + 'Trip-Essentials/Tours-Tickets.html',      text: '🎟️ Tours & Tickets' },
        { href: base + 'Trip-Essentials/Travel-Apps.html',        text: '📲 Travel Apps' },
      ] },
  ];
  // isGuide: only fires when data-toolbar-theme="guide" is explicitly set (guides_index).
  // Guide pages now share the #f5f4f0 warm background with essentials — colour detection
  // retired 2026-05-31 when the guide palette was reskinned to match essentials.
  var isGuide = (mount && mount.dataset.toolbarTheme === 'guide');
  var accent  = isGuide ? '#6b6860'               : '#8a6c1a';
  var acLt    = isGuide ? 'rgba(107,104,96,.06)'  : 'rgba(138,108,26,.06)';
  var acMd    = isGuide ? 'rgba(107,104,96,.10)'  : 'rgba(138,108,26,.10)';

  var styleEl = document.createElement('style');
  styleEl.textContent =
    /* Toolbar outer — flex row so title + nav sit side by side */
    /* Bar height: padding 16px -> 9px (owner 2026-08-10, "less thicker"), then
       9px -> 8px when the tab font went 13px -> 14px. The tabs' own vertical
       padding was cut 4px -> 2px in the same pass, so the taller text is fully
       absorbed and the bar is no thicker than before. */
    '.tb{padding:8px 0;position:relative;top:auto;z-index:auto;margin-bottom:18px;' +
      'background:transparent;' +
      'border-bottom:none;box-shadow:none;' +
      'display:flex;flex-wrap:wrap;align-items:center;justify-content:center}' +
    /* Site title — desktop only */
    '.tb-scroll-wrap{display:none!important}' +
    /* (owner 2026-08-10) .tb-site-title rules removed with the element itself —
       the desktop title no longer exists, so the whole bar width is the tab row's. */
    /* Site-wide wordmark above the bar. Smaller than the index.html copy on
       purpose (170px vs 300px): it repeats on every page. width/height on the
       <img> reserve the box so the toolbar never jumps as the PNG loads. */
    /* LEFT-aligned, always, on every page (owner 2026-08-10: "always in the same
       place left or middle but not right"). Constrained to the same max-width
       lane as the page content so it lines up with the content's left edge
       rather than the viewport's. Only the SIZE varies: the home page is the
       masthead (300px), every other page a smaller repeat (170px). The bottom
       padding is what pushes the content below it down. */
    /* Aligned to the TOOLBAR's gutter, not to a content lane (owner 2026-08-10 —
       it must sit in the same place on every page). It used to live in a fixed
       1080px centred lane, which lines up on pages whose content is capped at
       that width but floats to the middle on full-width pages — the Maps pages
       set no data-maxwidth, so the wordmark appeared centred there and left
       everywhere else. Anchoring to the toolbar's own gutter keeps it in the same
       place on every page, whatever the content below it does.
       The 120px left inset is deliberate (owner 2026-08-10: "start about there
       before you go start") — it clears the 🌐 Guides pill so the wordmark's left
       edge lines up with the SECOND tab rather than the first. That number tracks
       the rendered width of the Guides pill (~100px + the 10px gutter + the 10px
       tab gap); if that pill's label, padding or font-size changes, re-measure it.
       Mobile keeps the plain 10px gutter — the pill row is replaced by the
       hamburger there, so there is nothing to clear. */
    /* DESKTOP: the wordmark is a full-width first line INSIDE .tb, so it must
   paint the page background over the bar's terracotta — the mark is navy and
   orange and is unreadable on #b85c2a. Mobile overrides this to transparent,
   where the whole bar is beige anyway. */
    /* Scoped under `.tb a` deliberately. The wordmark is an <a> inside .tb, so
   `.tb a{padding:2px 2px}` (class+element) outranks a bare `.tb-brand-logo`
   (class only) and silently ate every padding value set here — computed
   padding was 2px on all sides no matter what this rule said. */
    '.tb a.tb-brand-logo{display:block;flex:0 0 100%;line-height:0;text-decoration:none;' +
      'padding:8px 10px 30px 64px;background:transparent;width:100%;box-sizing:border-box}' +
    '.tb a.tb-brand-logo img{display:block;width:100%;max-width:196px;height:auto;margin:0 auto 0 0}' +
    /* MOBILE ONLY (owner 2026-08-10): the bar turns beige with dark-terracotta
   traces, and the wordmark is CENTRED in the row. Everything else keeps its
   position — hamburger left, theme toggle right — so the logo is absolutely
   positioned and pointer-events:none through its margins, exactly how the old
   centred text label worked. Desktop keeps the terracotta bar untouched. */
    '@media(max-width:1260px){' +
      '.tb{background:transparent!important}' +
      '.tb a,.tb a:visited,.tb-ddbtn,.tb-ham{color:#b85c2a!important}' +
      '.tb-theme-toggle{border-color:#b85c2a!important;background:transparent!important;color:#b85c2a!important}' +
      '.tb-theme-toggle:hover{border-color:#b85c2a!important;background:transparent!important}' +
      '.tb a.tb-brand-logo{position:absolute;left:0;right:0;width:auto;padding:3px 0 0;flex:none;pointer-events:none;text-align:center}' +
      '.tb a.tb-brand-logo img{max-width:168px;margin:0 auto;display:inline-block;pointer-events:auto}' +
    '}' +
    '@media(max-width:600px){.tb a.tb-brand-logo img{max-width:150px}}' +
    /* Nav container — takes remaining space; width:100% on .tb-links fills it exactly */
    /* Gutter matches the .tb-links tab gap exactly (owner 2026-08-10: every space
   in the bar the same) — both use the SAME clamp() so they stay equal at every
   width while shrinking together as the viewport narrows. Left edge -> first tab, tab -> tab, and last tab ->
   theme toggle are all 10px; the toggle's own margin-left is 0 so this padding
   is the only thing between them, otherwise the two would stack to 20px. */
    /* min-width:0 is load-bearing: .tb-inner is a flex item whose default
   min-width:auto refuses to shrink below the nowrap tab row's intrinsic
   width. Without it the bar overflows to the right and pushes the theme
   toggle off the edge — the toggle's own flex-shrink:0 cannot help,
   because the overflow happens upstream of it. */
    /* flex:0 1 auto, not flex:1 (owner 2026-08-10). With flex:1 the container took
   all remaining width and the unused space collected between the last tab and
   the theme toggle — ~21px against a 10px left gutter, and it varied with the
   viewport. Shrink-to-fit removes that slack so the toggle sits one gutter
   after the last tab, as if it were the next tab, and the gap matches the
   left margin exactly at every width. */
    '.tb-inner{flex:0 1 auto;min-width:0;padding-left:clamp(6px,0.78vw,10px);padding-right:clamp(6px,0.78vw,10px)}' +
    /* Flex row — fills full width, edge-to-edge. No scrolling, no gap. */
    /* OWNER 2026-08-10: tabs pushed LEFT with one EQUAL gap between every pair.
       Was justify-content:space-between + gap:0, which spread the row edge to
       edge and made each gap a different width (they absorbed the leftover
       space in proportion to nothing). With the site title gone the row no
       longer needs to fill the bar, so: flex-start + a fixed gap, and
       width:auto so the row is exactly as wide as its tabs. */
    '.tb-links{display:flex;flex-wrap:nowrap;width:auto;margin:0;' +
      'gap:clamp(6px,0.78vw,10px);align-items:center;justify-content:flex-start;min-width:0}' +
    /* Desktop nav links — white text on gradient bar.
       Colours use !important so a page's own `a{}` / `a:visited{}` rules
       (e.g. guide-style.css link colours) can NEVER bleed into the shared bar. */
    '.tb a,.tb a:visited{font-size:14px;font-weight:700;color:#7a3b1e!important;text-decoration:none;padding:2px 2px;' +
      'border:none;border-radius:4px;background:transparent;white-space:nowrap;flex-shrink:0;' +
      'transition:color .15s,background .15s}' +
    '.tb a:hover{color:#7a3b1e!important;background:transparent}' +
    '.tb a.tb-active{color:#7a3b1e!important;background:transparent;border:1.5px solid rgba(184,92,42,0.85);border-radius:14px;padding:4px 12px;font-weight:600}' +
    /* Dropdown group (e.g. 🚆 Trains) — parent button + absolute flyout menu */
    '.tb-dd{position:relative;display:inline-flex;flex-shrink:0}' +
    '.tb-ddbtn{display:inline-flex;align-items:center;gap:3px;font-size:14px;font-weight:700;color:#7a3b1e!important;' +
      'padding:2px 2px;border:none;border-radius:4px;background:transparent;white-space:nowrap;' +
      'cursor:pointer;font-family:inherit;transition:color .15s,background .15s}' +
    '.tb-ddbtn:hover{color:#7a3b1e!important;background:transparent}' +
    '.tb-ddbtn.tb-active{color:#7a3b1e!important;background:transparent;border:1.5px solid rgba(184,92,42,0.85);border-radius:14px;padding:4px 12px;font-weight:600}' +
    '.tb-dd.tb-open>.tb-ddbtn:not(.tb-active){color:#7a3b1e!important;background:transparent}' +
    '.tb-caret{font-size:8px;line-height:1;transition:transform .15s}' +
    '.tb-dd.tb-open .tb-caret{transform:rotate(180deg)}' +
    /* Split dropdown — one-click link + small caret toggle */
    /* Menu is appended to <body> (not inside the overflow-clipped scroll row) and
       positioned with fixed coords on open — otherwise .tb-inner's overflow-x:auto
       forces overflow-y to clip and the flyout gets cut off. */
    '.tb-menu{position:fixed;transform:translateX(-50%);' +
      'background:#fff;border:1px solid #e6e2da;border-radius:8px;box-shadow:0 6px 22px rgba(0,0,0,.13);' +
      'padding:4px;display:none;flex-direction:column;gap:0;min-width:196px;z-index:1000;' +
      /* 🏆 Best Of carries 35 rows — far taller than any viewport. Cap the
         flyout and let it scroll rather than running off the bottom of the
         screen. Every other group is well under the cap and is unaffected. */
      'max-height:calc(100vh - 90px);overflow-y:auto;overscroll-behavior:contain}' +
    '.tb-menu.tb-menu-open{display:flex}' +
    '.tb-menu a,.tb-menu a:visited{display:block;font-size:14px;line-height:1.2;color:#3d3a32!important;text-decoration:none;padding:6px 11px;' +
      'border:none;border-radius:6px;background:transparent;white-space:nowrap}' +
    '.tb-menu a:hover{background:' + acLt + ';color:' + accent + '!important}' +
    '.tb-menu a.tb-active{background:' + acMd + ';color:' + accent + '!important;font-weight:500}' +
    /* "new" badge on a recently shipped dropdown child — name left, badge right.
       Colours are the site's NEW badge exactly (.dest-new-badge in
       guides-index-style.css): 1.5px #e8c97a border, #fdecc8 fill, #7a4d00 text.
       Keep the two in sync — it is one badge appearing on two surfaces. */
    '.tb-menu a.tb-has-new{display:flex;align-items:center;justify-content:space-between;gap:12px}' +
    '.tb-new,.tb-ham-new{flex-shrink:0;font-size:7.5px;font-weight:700;letter-spacing:.07em;' +
      'text-transform:uppercase;padding:1px 4px;border-radius:3px;line-height:12px;' +
      'border:1.5px solid #e8c97a;background:#fdecc8;color:#7a4d00;pointer-events:none}' +
    /* Separator */
    '.tb-sep{display:none}' +
    /* Scroll progress bar — hidden on mobile (overlaps toolbar) */
    '.tb-progress{position:fixed;top:0;left:0;height:2px;width:0%;' +
      'background:' + accent + ';z-index:200;pointer-events:none;' +
      'transition:width .08s linear}' +
    '@media(max-width:1260px){.tb-progress{display:none}}' +
    /* Hide ham elements on desktop — mobile @media shows them */
    '.tb-ham{display:none}.tb-ham-label{display:none}.tb-ham-menu{display:none}' +
    /* Mobile/tablet: hamburger menu replaces the chip row below this width.
       LOCKED AT 1260px — do not raise it. A MacBook Air 13" is a 1280px CSS
       viewport, so anything above 1260 hides the desktop nav on that machine
       (check_toolbar_font_size_unified hard-fails; Rule 582). Raising it to
       1400px for the 14th tab was tried on 2026-08-10 and the check caught it.
       The row must be made to FIT 1260px instead — hence the tab gap cut from
       18px to 10px in the same pass. */
    '@media(max-width:1260px){' +
      '.tb{position:relative;z-index:1002;padding:15px 0 14px;display:flex;align-items:center;justify-content:space-between;min-height:56px;border-bottom:none;background:transparent;box-shadow:none}' +
      '.tb-inner{display:none !important}' +
      '.tb-scroll-wrap{display:none !important}' +
      '.tb::after{display:none}' +
      '.tb-ham{display:flex;align-items:center;gap:3px;cursor:pointer;' +
        'border:none;-webkit-appearance:none;appearance:none;box-shadow:none;outline:none;' +
        '-webkit-tap-highlight-color:transparent;' +
        'padding:10px 14px 10px 8px;font-size:13px;color:#7a3b1e;flex-shrink:0;margin-left:auto;line-height:1;min-height:44px}' +
      '.tb-ham:hover,.tb-ham:focus,.tb-ham:active{box-shadow:none !important;outline:none !important}' +
      /* min-height:0 overrides mobile.css's universal 40px tap-target `a{}` rule — this
         is an <a> linking to Guides-Index.html, and without the override the inflated
         block-level box pushes the text off the bar's vertical center. */
      /* 2026-08-10: the centred 'GUIDE MY DAYS' text label is HIDDEN on mobile.
   The wordmark image now renders above the bar on every page including
   mobile, so the label was a second brand in the same viewport — image
   above, text centred in the bar below it. The element itself is kept
   (check_brand_title_link asserts its href) but never shown. */
      '.tb-ham-label{display:none!important}' +
      /* The menu is position:fixed so it stays fully on-screen as the user
         scrolls — items never disappear off the top. The toolbar (.tb) is
         NOT fixed (scrolls away as usual); only the open menu panel is fixed.
         top:0 covers the full viewport; overflow-y:auto scrolls inside the
         panel; body overflow:hidden (set by toggleHamMenu) locks page scroll
         so only the menu scrolls while it is open. */
      '.tb-ham-menu{display:none;position:fixed;top:64px;left:0;right:0;bottom:0;' +
        'background:#ffffff;border-top:1px solid #e6e2da;z-index:1001;padding:4px 0 16px;' +
        'overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;' +
        'transform:translateZ(0);-webkit-transform:translateZ(0);will-change:transform}' +
      '.tb-ham-menu.tb-ham-open{display:block}' +
      /* While the hamburger menu is open it covers the viewport (z-index:1001),
         but the floating back pills (#tve-back-to-guide / #tve-back-to-byg) sit
         at z-index:1400 and would otherwise punch through and overlap the menu's
         bottom rows. Hide them for as long as the menu is open — body.tve-ham-open
         is toggled by toggleHamMenu()/closeHamMenu(). */
      'body.tve-ham-open #tve-back-to-guide,body.tve-ham-open #tve-back-to-byg{display:none!important}' +
      '.tb-ham-menu a,.tb-ham-menu a:visited{display:block;font-size:14px;color:#3d3a32!important;text-decoration:none;' +
        'padding:10px 24px;border-bottom:none;-webkit-tap-highlight-color:transparent;cursor:pointer;touch-action:manipulation}' +
      /* LOCKED — pill matches desktop .tb-active chip shape (border-radius:14px,
         padding:4px 12px), sized to hug the word only, not full row width.
         Text stays the normal row color — only the border marks it active.
         margin-left:12px so icon at 12+12=24px aligns with inactive item text at 24px.
         Mirrored in mobile.css. Memory: feedback_hamburger_active_pill. */
      '.tb-ham-menu a.tb-active{display:inline-flex;align-items:center;justify-content:center;color:#3d3a32!important;background:transparent;' +
        'border:1.5px solid #b85c2a;border-radius:14px;margin:6px 12px;padding:4px 12px;font-weight:600}' +
      /* "new" badge in the hamburger — inline-flex so the badge sits beside the
         label rather than wrapping. Placed after the .tb-active rule above so an
         item that is both active and new keeps the pill AND shows the badge. */
      '.tb-ham-menu a.tb-has-new{display:inline-flex;align-items:center;gap:8px}' +
      '.tb-ham-menu a:active{background:rgba(0,0,0,.04)}' +
      '.tb-ham-menu .tb-ham-sep{height:1px;background:#e6e2da;margin:4px 24px}' +
      '.tb-ham-menu .tb-ham-hdr{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9e9688;padding:6px 24px 2px}' +
    '}' +
    '@media(max-width:600px){#tve-back-guides{padding-left:14px!important;padding-right:14px!important}}' +
    /* ── Theme toggle button ─────────────────────────────────────────────── */
    '.tb-theme-toggle{flex-shrink:0;margin-left:0;margin-right:10px;width:40px;height:40px;border-radius:50%;' +
      'border:1.5px solid rgba(122,59,30,.55);background:transparent;color:#7a3b1e;' +
      'cursor:pointer;display:flex;align-items:center;justify-content:center;' +
      'transition:background .15s,border-color .15s;outline:none;padding:0;' +
      '-webkit-appearance:none;font-family:inherit;line-height:0}' +
    '.tb-theme-toggle:hover{background:transparent;border-color:rgba(122,59,30,.85)}' +
    '.tb-theme-toggle:active{transform:scale(.93)}' +
    '@media(max-width:1260px){.tb-theme-toggle{order:-1;margin-left:14px;margin-right:0}}' +
    /* ── Dark-mode token override — mirrors @media(prefers-color-scheme:dark) ── */
    /* Covers all tokens from web-travel-style.css + guide-style.css dark blocks. */
    /* html[data-theme="dark"] specificity (0,1,1) > :root (0,1,0) — always wins. */
    'html[data-theme="dark"]{' +
      '--bg:#1a1917;--warm:#242220;--surface:#2a2825;--surface2:#1e1c1a;' +
      '--border:#3a3730;--border2:#332f2a;--text:#e8e5e0;--muted:#9a9690;' +
      '--accent:#c8a040;--hover:#2e2a1e;--navy:#5a8adb;--green:#5aaa5e;' +
      '--gold:#d4a830;--red:#d44040;' +
      '--req-bg:#2a2510;--req-bd:#c8a020;--rec-bg:#0e200e;--rec-bd:#4a9a4a;' +
      '--con-bg:#101525;--con-bd:#7080b0;--med-bg:#250e0e;--med-bd:#c06060;' +
      '--c-tag-good-bg:#0d200d;--c-tag-good-border:rgba(90,170,94,0.4);' +
      '--c-tag-ok-bg:#281f00;--c-tag-ok-text:#d4a830;--c-tag-ok-border:#7a6010;' +
      '--c0:#4aaa70;--c0bg:#0e2415;--c0bd:#285e3a;' +
      '--c1:#6090d8;--c1bg:#0e1525;--c1bd:#304878;' +
      '--c2:#c8a44a;--c2bg:rgba(200,164,74,.12);--c2bd:#9a7830;' +
      '--c-disc-bg:#280e0e;--c-disc:#e07070;--c-rust-tint:#2a1a12;' +
      '--tier-req:#c8a020;--tier-req-text:#1a1200;' +
      '--tier-rec:#4a9a4a;--tier-rec-text:#ffffff;' +
      '--tier-con:#6080c0;--tier-con-text:#ffffff;' +
      '--tier-med:#c07070;--tier-med-text:#ffffff;' +
      '--rust:#d4784a;--border-warm:#5a5040;--track:#3a3530;' +
      '--c-temp-hi:#e05030;--c-temp-lo:#6090e0;--c-rain:#6090b0;' +
      '--c-search-focus-border:#7a6a5a;--c-search-placeholder:#7a6a50;' +
      '--c-section-head:#c8a060;--c-terracotta:#d4784a;' +
      '--badge-top-bg:#2a1e00;--badge-top-text:#e8b060;--badge-top-bd:#7a5810;' +
      '--badge-warn-bg:#2a1408;--badge-warn-text:#e8a880;--badge-warn-bd:rgba(232,168,128,0.4);' +
      '--badge-ok-bg:#0a200a;--badge-ok-text:#80cc80;--badge-ok-bd:#306030;' +
      '--c-page-bg:#1a1917;--c-card-bg:#2a2825;--c-card-shadow:0 2px 8px rgba(0,0,0,0.25);' +
      '--c-warm-bg:#242220;--c-brand:#c8a060;--c-brand-hover:#2e2a1e;' +
      /* Pill palette — mirrors the dark block in guide-style.css. */
      '--c-pill-bg:#2a2825;--c-pill-hover:#332f2a;--c-pill-active:#3d3830;' +
      '--c-pill-text:#c8a060;--c-pill-bd:rgba(200,160,96,.30);' +
      '--c-pill-bd-hover:rgba(200,160,96,.50);--c-pill-bd-active:rgba(200,160,96,.65);' +
      '--c-action-text:#c8a060;--c-action-press:#3d3830;' +
      '--c-float-bg:#2a2825;--c-float-bd:#7a6430;--c-float-text:#c8a060;' +
      '--c-navbtn-bd:#5a5040;--c-navbtn-text:#b0aca4;' +
      '--c-text-primary:#e8e5e0;--c-text-muted:#999;--c-link:#5a9aee;' +
      '--c-next-bg:#222120;--c-next-border:#444;--c-skip-note:#777;' +
      '--c-index-bg:#1e1c1a;--c-index-border:#3a3730;' +
      '--c-index-text-muted:#9a9690;--c-index-accent:#c8a040;' +
      '--c-index-muted-2:#8a8680;--c-index-muted-3:#6a6660;' +
      '--c-index-muted-4:#7a7670;--c-index-muted-5:#666;' +
      '--c-title-bg:#b88a55;--c-title-text:#ffffff;' +
      '--c-warn-text:#e0c080;--c-warn-link:#d4a030;' +
      '--c-tastes-text:#e0d0a0;--c-headsup-text:#e0a0a0;--c-headsup-link:#d06040}' +
    'html[data-theme="dark"] ::selection{background:rgba(200,160,64,.35)}' +
    'html[data-theme="dark"] .also-on-this-site-pill,' +
    'html[data-theme="dark"] .nearby-guide-pill{background:var(--c-card-bg);color:#b8962a;border-color:#8a7a40}' +
    /* ── Light-mode override — forces light tokens even when OS is dark ───── */
    'html[data-theme="light"]{' +
      '--bg:#f5f4f0;--warm:#fdf8f0;--surface:#ffffff;--surface2:#f0ede8;' +
      '--border:#d8d4cc;--border2:#e6e2da;--text:#3d3a32;--muted:#6a6660;' +
      '--accent:#8a6c1a;--hover:#faefd8;--navy:#1a3a8b;--green:#1a5a1a;' +
      '--gold:#c8961a;--red:#a02020;' +
      '--req-bg:#fef9e5;--req-bd:#d4a010;--rec-bg:#f0faf0;--rec-bd:#4a9a4a;' +
      '--con-bg:#eef1f8;--con-bd:#6b7fb8;--med-bg:#fdf0f0;--med-bd:#c06060;' +
      '--c-tag-good-bg:#e8f5e8;--c-tag-good-border:rgba(26,90,26,0.4);' +
      '--c-tag-ok-bg:#fff8e0;--c-tag-ok-text:#7a5800;--c-tag-ok-border:rgba(122,88,0,0.4);' +
      '--c0:#1a5a1a;--c0bg:#e8f5e8;--c0bd:#a0d8a0;' +
      '--c1:#1a3a8b;--c1bg:#e8f0fb;--c1bd:#a0b8e8;' +
      '--c2:#8a5a10;--c2bg:rgba(200,164,74,.10);--c2bd:rgba(122,88,0,0.4);' +
      '--c-disc-bg:#f8e8e8;--c-disc:#7a1010;--c-rust-tint:#fbeee4;' +
      '--tier-req:#f0c040;--tier-req-text:#5a3a00;' +
      '--tier-rec:#6db96d;--tier-rec-text:#ffffff;' +
      '--tier-con:#93a8d8;--tier-con-text:#ffffff;' +
      '--tier-med:#e08080;--tier-med-text:#ffffff;' +
      '--rust:#b85c2a;--border-warm:#c4b896;--track:#ece6dd;' +
      '--c-temp-hi:#a61c00;--c-temp-lo:#3d5282;--c-rain:#4a7c9b;' +
      '--c-search-focus-border:#c8b99a;--c-search-placeholder:#A8895A;' +
      '--c-section-head:#5C3D11;--c-terracotta:#b85c2a;' +
      '--badge-top-bg:#fdecc8;--badge-top-text:#7a4d00;--badge-top-bd:#e8c97a;' +
      '--badge-warn-bg:#fdf0e8;--badge-warn-text:#7a3a1a;--badge-warn-bd:rgba(122,58,26,0.4);' +
      '--badge-ok-bg:#e4f5e4;--badge-ok-text:#1a5c1a;--badge-ok-bd:#90cc90;' +
      '--c-page-bg:#f5f4f0;--c-card-bg:#fff;--c-card-shadow:0 2px 8px rgba(0,0,0,0.07);' +
      '--c-warm-bg:#fdf8f0;--c-brand:#8a6c1a;--c-brand-hover:#faefd8;' +
      /* Pill palette — mirrors the :root defaults in guide-style.css. */
      '--c-pill-bg:#fdf8f0;--c-pill-hover:#faefd8;--c-pill-active:#f5e8c8;' +
      '--c-pill-text:#8a6c1a;--c-pill-bd:rgba(138,108,26,.25);' +
      '--c-pill-bd-hover:rgba(138,108,26,.45);--c-pill-bd-active:rgba(138,108,26,.6);' +
      '--c-action-text:#5a3c0e;--c-action-press:#e5ddc8;' +
      '--c-float-bg:#ffffff;--c-float-bd:#c8a44a;--c-float-text:#8a6c1a;' +
      '--c-navbtn-bd:#c4b896;--c-navbtn-text:#6b6860;' +
      '--c-text-primary:#3d3a32;--c-text-muted:#555;--c-link:#2867c4;' +
      '--c-next-bg:#ede8db;--c-next-border:#bba070;--c-skip-note:#999;' +
      '--c-index-bg:#f0ede8;--c-index-border:#d8d4cc;' +
      '--c-index-text-muted:#6a6660;--c-index-accent:#7a5c0e;' +
      '--c-index-muted-2:#9a9890;--c-index-muted-3:#b8ad9e;' +
      '--c-index-muted-4:#c4b49a;--c-index-muted-5:#aaa;' +
      '--c-title-bg:#6b4422;--c-title-text:#ffffff;' +
      '--c-warn-text:#5a3a05;--c-warn-link:#a36009;' +
      '--c-tastes-text:#3a2a05;--c-headsup-text:#3a1a1a;--c-headsup-link:#a61c00}' +
    'html[data-theme="light"] ::selection{background:rgba(122,59,30,.35);color:inherit}' +
    'html[data-theme="light"] .also-on-this-site-pill,' +
    'html[data-theme="light"] .nearby-guide-pill{background:#ffffff;color:#8a6c1a;border-color:#c8a44a}'
    ;
  document.head.appendChild(styleEl);

  /* ── Scroll progress bar ────────────────────────────────────────────────── */
  var progress = document.createElement('div');
  progress.className = 'tb-progress';
  document.body.appendChild(progress);
  window.addEventListener('scroll', function () {
    var total = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (total > 0 ? (window.scrollY / total * 100) : 0) + '%';
  }, { passive: true });

  /* ── Build toolbar ──────────────────────────────────────────────────────── */
  /* scroller = full-width overflow container; inner = centered flex row inside it */
  var scroller = document.createElement('div');
  scroller.className = 'tb-inner';

  var inner = document.createElement('div');
  inner.className = 'tb-links';

  ITEMS.forEach(function (item) {
    if (item === null) {
      var sep = document.createElement('span');
      sep.className = 'tb-sep';
      inner.appendChild(sep);
      return;
    }
    /* Dropdown group — a parent toggle with a flyout of child links. The parent
       has no href of its own; the children carry the destinations. The group
       highlights active when the current page is one of its children. */
    if (item.children) {
      var dd = document.createElement('span');
      dd.className = 'tb-dd';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tb-ddbtn';
      btn.setAttribute('aria-haspopup', 'true');
      btn.setAttribute('aria-expanded', 'false');
      var lab = document.createElement('span');
      /* groupShort (2026-08-10): top-strip label may be shorter than the group's
         canonical name — the bar has no spare width, while the dropdown header,
         the hamburger and TOOLBAR_ITEMS_LOCK all keep the full name. */
      lab.textContent = item.groupShort || item.group;
      var car = document.createElement('span');
      car.className = 'tb-caret';
      car.textContent = '▾';
      btn.appendChild(lab);
      btn.appendChild(car);

      var menu = document.createElement('div');
      menu.className = 'tb-menu';
      var groupActive = false;
      item.children.forEach(function (ch) {
        var ca = document.createElement('a');
        ca.href = ch.href;
        setEntryLabel(ca, ch.text, ch, 'tb-new');
        if (ch.href.split('/').pop() === curr) { ca.classList.add('tb-active'); groupActive = true; }
        menu.appendChild(ca);
      });
      if (groupActive) btn.classList.add('tb-active');
      /* Append the menu to <body> so it escapes the scroll row's overflow clip. */
      document.body.appendChild(menu);

      function positionMenu() {
        var r = btn.getBoundingClientRect();
        var mw = menu.offsetWidth || 196;          // measurable once tb-menu-open is set
        var half = mw / 2;
        var cx = r.left + r.width / 2;
        var lo = half + 8, hi = window.innerWidth - half - 8;   // keep the menu on-screen
        if (hi < lo) hi = lo;
        if (cx < lo) cx = lo;
        if (cx > hi) cx = hi;
        menu.style.left = Math.round(cx) + 'px';
        menu.style.top  = Math.round(r.bottom + 6) + 'px';
      }
      function openMenu()  {
        /* Only one dropdown open at a time — close any others first. */
        var openMenus = document.querySelectorAll('.tb-menu.tb-menu-open');
        for (var i = 0; i < openMenus.length; i++) openMenus[i].classList.remove('tb-menu-open');
        var openDds = document.querySelectorAll('.tb-dd.tb-open');
        for (var j = 0; j < openDds.length; j++) {
          openDds[j].classList.remove('tb-open');
          var ob = openDds[j].querySelector('.tb-ddbtn');
          if (ob) { ob.setAttribute('aria-expanded', 'false'); ob.classList.remove('tb-dd-open-btn'); }
        }
        menu.classList.add('tb-menu-open'); dd.classList.add('tb-open'); btn.setAttribute('aria-expanded', 'true');
        inner.classList.add('tb-dd-open'); btn.classList.add('tb-dd-open-btn');
        positionMenu();
      }
      function closeMenu() {
        menu.classList.remove('tb-menu-open'); dd.classList.remove('tb-open'); btn.setAttribute('aria-expanded', 'false');
        inner.classList.remove('tb-dd-open'); btn.classList.remove('tb-dd-open-btn');
      }

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (menu.classList.contains('tb-menu-open')) closeMenu(); else openMenu();
      });
      /* Clicks inside the menu shouldn't bubble to the document closer; links still navigate. */
      menu.addEventListener('click', function (e) { e.stopPropagation(); });
      window.addEventListener('scroll', function () { if (menu.classList.contains('tb-menu-open')) closeMenu(); }, { passive: true });
      window.addEventListener('resize', function () { if (menu.classList.contains('tb-menu-open')) closeMenu(); });

      dd.appendChild(btn);
      inner.appendChild(dd);
      return;
    }
    var a = document.createElement('a');
    a.href = item.href;
    a.textContent = item.text;
    var cls = [];
    if (item.guides) cls.push('tb-guides');
    if (item.href.split('/').pop() === curr) cls.push('tb-active');
    if (cls.length) a.className = cls.join(' ');
    a.addEventListener('click', function () {
      var menus = document.querySelectorAll('.tb-menu.tb-menu-open');
      for (var i = 0; i < menus.length; i++) menus[i].classList.remove('tb-menu-open');
      var open = document.querySelectorAll('.tb-dd.tb-open');
      for (var j = 0; j < open.length; j++) {
        open[j].classList.remove('tb-open');
        var b = open[j].querySelector('.tb-ddbtn');
        if (b) { b.setAttribute('aria-expanded', 'false'); b.classList.remove('tb-dd-open-btn'); }
      }
      inner.classList.remove('tb-dd-open');
    });
    inner.appendChild(a);
  });

  /* iOS Safari: :active on <a> elements requires a touchstart listener to be registered */
  document.addEventListener('touchstart', function () {}, { passive: true });

  /* Close any open dropdown when clicking elsewhere (menus live on <body> now) */
  document.addEventListener('click', function () {
    var menus = document.querySelectorAll('.tb-menu.tb-menu-open');
    for (var i = 0; i < menus.length; i++) menus[i].classList.remove('tb-menu-open');
    var open = inner.querySelectorAll('.tb-dd.tb-open');
    for (var j = 0; j < open.length; j++) {
      open[j].classList.remove('tb-open');
      var b = open[j].querySelector('.tb-ddbtn');
      if (b) { b.setAttribute('aria-expanded', 'false'); b.classList.remove('tb-dd-open-btn'); }
    }
    inner.classList.remove('tb-dd-open');
  });

  scroller.appendChild(inner);

  var bar = document.createElement('div');
  bar.className = 'tb';

  /* OWNER 2026-08-10: the desktop site title ("GUIDE MY DAYS") was REMOVED from
     the bar to free its width for more tabs. Do not re-add it — the branding
     now lives in the wordmark on index.html, and this space is reserved for
     nav. The .tb-site-title element and all its CSS went with it; the earlier
     2026-08-09 note about the title being .tb-links' first flex item is moot,
     since space-between now distributes gaps across the tabs alone.
     The MOBILE label (.tb-ham-label) is untouched — mobile has no tab row, so
     removing it there would leave the hamburger bar with no branding at all. */

  bar.appendChild(scroller);


  /* ── Prev / Next sticky nav-bar — sits just below toolbar, sticks to top ── */
  var isRealGuide = /\/Guides\//.test(location.pathname) && location.pathname.indexOf('guides_index') < 0;
  var isReadAbout = /\-read-about\.html$/.test(location.pathname);
  var isStopsMap = /\-stops-map\.html$/.test(location.pathname);
  var _raCityName = '';
  if (isReadAbout) {
    var _raParts = location.pathname.split('/');
    var _raGi = _raParts.indexOf('Guides');
    var _raCityFolder = _raGi >= 0 && _raParts[_raGi + 1] ? _raParts[_raGi + 1] : '';
    _raCityName = _raCityFolder.replace(/-/g, ' ');
  }

  /* ── City hash for Before-You-Go deep-links ────────────────────────────── */
  var cityHash = '';
  if (isRealGuide) {
    var _dc = mount && mount.dataset.city;
    if (_dc) {
      cityHash = '#' + encodeURIComponent(_dc);
    } else {
      var _pathParts = location.pathname.split('/');
      var _gi = _pathParts.indexOf('Guides');
      if (_gi >= 0 && _pathParts[_gi + 1]) {
        cityHash = '#' + encodeURIComponent(_pathParts[_gi + 1].replace(/-/g, ' '));
      }
    }
    if (cityHash) {
      var _navBYG = inner.querySelector('a[href*="Before-You-Go.html"]');
      if (_navBYG) _navBYG.href += cityHash;
    }

    /* Back-pill source is recorded at click time by stashNavSource() below
       (single slot, works from guide OR Before-You-Go), so no per-page
       load-time stash is needed here. */
  }

  function guideNameFromHref(href) {
    if (!href) return '';
    var parts = href.split('/');
    var folder = parts[parts.length - 2];
    return (folder && folder !== '..') ? decodeURIComponent(folder) : '';
  }

  /* ── Prev / Next — arrows flanking the .overview-title ───────────────────── */
  var btnStyle = 'display:inline-flex;align-items:center;justify-content:center;' +
    'width:30px;height:30px;border-radius:6px;border:1.5px solid var(--c-navbtn-bd,#c4b896);' +
    'background:var(--c-float-bg,#ffffff);color:var(--c-navbtn-text,#6b6860);font-size:18px;line-height:1;' +
    'padding:0;text-decoration:none;flex-shrink:0;';

  /* ── Mobile hamburger menu ──────────────────────────────────────────────── */
  var hamLabel = document.createElement('a');
  hamLabel.className = 'tb-ham-label';
  hamLabel.textContent = 'GUIDE MY DAYS';
  hamLabel.href = base + 'index.html';
  hamLabel.style.cssText = 'text-decoration:none;color:#7a3b1e;';
  bar.appendChild(hamLabel);

  var hamBtn = document.createElement('div');
  hamBtn.className = 'tb-ham';
  hamBtn.setAttribute('role', 'button');
  hamBtn.setAttribute('aria-label', 'Menu');
  hamBtn.setAttribute('aria-expanded', 'false');
  hamBtn.setAttribute('tabindex', '0');
  hamBtn.style.cssText = 'background:transparent;border-radius:8px;border:none;box-shadow:none;outline:none;-webkit-tap-highlight-color:transparent;padding:11px 13px;justify-content:center;margin:0 14px 0 0;min-height:auto;cursor:pointer;user-select:none;align-items:center;gap:8px;color:#7a3b1e;flex-shrink:0;';
  hamBtn.innerHTML = '<svg width="25" height="18" viewBox="0 0 18 13" aria-hidden="true"><rect x="0" y="0" width="18" height="2.5" rx="1.25" fill="currentColor"/><rect x="0" y="5.25" width="18" height="2.5" rx="1.25" fill="currentColor"/><rect x="0" y="10.5" width="18" height="2.5" rx="1.25" fill="currentColor"/></svg>';
  bar.appendChild(hamBtn);

  /* ── Theme toggle ───────────────────────────────────────────────────────── */
  (function () {
    var SVG_SUN  = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<circle cx="8" cy="8" r="3.5" fill="currentColor"/>' +
      '<line x1="8" y1="1" x2="8" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '<line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '<line x1="1" y1="8" x2="3" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '<line x1="13" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '<line x1="2.93" y1="2.93" x2="4.34" y2="4.34" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '<line x1="11.66" y1="11.66" x2="13.07" y2="13.07" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '<line x1="13.07" y1="2.93" x2="11.66" y2="4.34" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '<line x1="4.34" y1="11.66" x2="2.93" y2="13.07" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';
    var SVG_MOON = '<svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">' +
      '<path d="M13 8.5A5.5 5.5 0 0 1 6.5 2c0-.18.01-.35.03-.52A6.5 6.5 0 1 0 13.52 8.47' +
      'C13.35 8.49 13.18 8.5 13 8.5z" fill="currentColor"/>' +
      '</svg>';

    var themeBtn = document.createElement('button');
    themeBtn.type = 'button';
    themeBtn.id = 'tve-theme-toggle';
    themeBtn.className = 'tb-theme-toggle';

    function updateIcon() {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      themeBtn.innerHTML = dark ? SVG_MOON : SVG_SUN;
      themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      themeBtn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    }
    updateIcon();

    themeBtn.addEventListener('click', function () {
      var cur  = document.documentElement.getAttribute('data-theme');
      /* No stored preference yet means the page is following OS; treat that as
         the current OS preference so the toggle flips away from it correctly. */
      if (!cur) cur = window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
      var next = (cur === 'dark') ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('tve_theme', next); } catch (e) {}
      updateIcon();
    });

    bar.appendChild(themeBtn);
  })();

  var hamMenu = document.createElement('div');
  hamMenu.className = 'tb-ham-menu';
  bar.style.position = 'relative';

  /* Build flat link list from ITEMS */
  var firstItem = true;
  ITEMS.forEach(function (item) {
    if (item === null) return; /* skip separators */
    if (item.children) {
      if (!firstItem) {
        var sep = document.createElement('div');
        sep.className = 'tb-ham-sep';
        hamMenu.appendChild(sep);
      }
      var hdrG = document.createElement('div');
      hdrG.className = 'tb-ham-hdr';
      hdrG.textContent = item.group.replace(/^[^\x00-\x7E\s]*\s*/, '').trim() || item.group;
      hamMenu.appendChild(hdrG);
      item.children.forEach(function (ch) {
        var a = document.createElement('a');
        a.href = ch.href;
        setEntryLabel(a, ch.full || ch.text, ch, 'tb-ham-new');
        if (ch.href.split('/').pop() === curr) a.classList.add('tb-active');
        hamMenu.appendChild(a);
      });
      firstItem = false;
    } else {
      var isMapsItem = /World-Map\.html$/.test(item.href);
      if (!firstItem) {
        var sep2 = document.createElement('div');
        sep2.className = 'tb-ham-sep';
        hamMenu.appendChild(sep2);
      }
      /* Maps header (added 2026-07-20) — same tb-ham-hdr treatment as the
         Lounges/Flights groups just above/below it, so "World Map" + its
         Region children read as a labeled group like everything else in the
         menu instead of an unlabeled pair of flat items. */
      if (isMapsItem) {
        var hdrM = document.createElement('div');
        hdrM.className = 'tb-ham-hdr';
        hdrM.textContent = 'Maps';
        hamMenu.appendChild(hdrM);
      }
      var a2 = document.createElement('a');
      a2.href = item.href;
      a2.textContent = item.full || item.text;
      if (item.href.split('/').pop() === curr) a2.className = 'tb-active';
      hamMenu.appendChild(a2);
      /* OWNER-DIRECTED 2026-07-20: My Trips — injected mobile-only, right under Guides.
         DO NOT REMOVE. brain_check hard-fails if this injection is missing. See Toolbar.html § 18b + Cleanliness Checks Rule 569. */
      if (/(?:Guides-Index|index)\.html$/.test(item.href)) {
        var aTrips = document.createElement('a');
        var sepTrips = document.createElement('div'); sepTrips.className = 'tb-ham-sep'; hamMenu.appendChild(sepTrips);
        aTrips.href = base + 'Trip-Essentials/Trips.html';
        aTrips.textContent = '✈️ My Trips';
        if ('Trips.html' === curr) aTrips.className = 'tb-active';
        hamMenu.appendChild(aTrips);
        /* OWNER-DIRECTED 2026-07-20: Travel Stats — mobile-only, right under My Trips. (File was Personal-Stats.html until 2026-07-28.) */
        var aPS = document.createElement('a');
        aPS.href = base + 'Trip-Essentials/Travel-Stats.html';
        aPS.textContent = '📊 Travel Stats';
        if ('Travel-Stats.html' === curr) aPS.className = 'tb-active';
        hamMenu.appendChild(aPS);
      }
      firstItem = false;
      /* ── Region links (added 2026-07-19, moved right under World Map and
         merged into it 2026-07-20 — Dani: no separator between them and
         "World Map" (reads as one continuous group now, not two), same
         leading icon as "World Map" on every row (matches the site's locked
         "toolbar dropdown group children share the group's leading icon"
         rule), and no separate "World" entry — that's what tapping
         "World Map" itself already does, no need to repeat it. Works via the
         hash router already built into World-Map.html (World-Map.html#eu
         flies to Europe, etc.), which also fires on in-page hash changes,
         not just initial load. ── */
      if (isMapsItem) {
        var regionLinks = [
          ['Europe', 'eu'], ['North America', 'na'], ['Caribbean', 'cb'],
          ['Asia', 'as'], ['Africa', 'af'], ['South America', 'sa'], ['Oceania', 'oc'],
        ];
        regionLinks.forEach(function (r) {
          var a = document.createElement('a');
          a.href = base + 'Trip-Essentials/Maps/World-Map.html#' + r[1];
          a.textContent = '🗺️ ' + r[0];
          hamMenu.appendChild(a);
        });
      }
    }
  });

  /* ── Best Of section ── */
  (function () {
    var sepBo = document.createElement('div'); sepBo.className = 'tb-ham-sep'; hamMenu.appendChild(sepBo);
    var hdrBo = document.createElement('div'); hdrBo.className = 'tb-ham-hdr'; hdrBo.textContent = 'Best Of'; hamMenu.appendChild(hdrBo);
    var browseLink = document.createElement('a');
    browseLink.href = base + 'Trip-Essentials/Best-Of-Index.html';
    browseLink.textContent = 'Browse by category';
    browseLink.style.cssText = 'color:#b85c2a;font-weight:500;background:#fdf8f4;';
    if ('Best-Of-Index.html' === curr) browseLink.classList.add('tb-active');
    hamMenu.appendChild(browseLink);
    var bestOfPages = [
      ['Amusement Parks',           'Best-Amusement-Parks.html'],
      ['Animal Encounters',         'Best-Animal-Encounters.html'],
      ['Aquariums',                 'Best-Aquariums.html'],
      ['Architecture',              'Best-Architecture.html'],
      ['Art Museums',               'Best-Art-Museums.html'],
      ['Beaches',                   'Best-Beaches.html'],
      ['Castles',                   'Best-Castles.html'],
      ['Cathedrals',                'Best-Cathedrals.html'],
      ['Caves',                     'Best-Caves.html'],
      ['Gardens',                   'Best-Gardens.html'],
      ['Hard-to-Reach Places',      'Best-Hard-to-Reach-Places.html'],
      ['Hot Springs',               'Best-Hot-Springs.html'],
      ['Islands',                   'Best-Islands.html'],
      ['Kid-Friendly Destinations', 'Best-Kids-Friendly-Places.html'],
      ["Kids' Museums",             'Best-Kids-Museums.html'],
      ['Lakes',                     'Best-Lakes.html'],
      ['Mountains & Rock Formations','Best-Mountains-and-Rock-Formations.html'],
      ['Museums',                   'Best-Museums.html'],
      ['National Parks',            'Best-National-Parks-by-Country.html'],
      ['Natural Phenomena',         'Best-Natural-Phenomena.html'],
      ['Observation Decks',         'Best-Observation-Decks.html'],
      ['Safari',                    'Best-Safari.html'],
      ['Scuba Diving',              'Best-Scuba-Diving.html'],
      ['Ski Resorts',               'Best-Ski-Resorts.html'],
      ['Surfing',                   'Best-Surfing.html'],
      ['UNESCO Sites',              'Best-UNESCO-Sites.html'],
      ['Unique Museums',            'Best-Unique-Museums.html'],
      ['Volcanoes',                 'Best-Volcanoes.html'],
      ['Wine Regions',              'Best-Wine-Regions.html'],
      ['Wonders of the World',      'Best-Wonders-of-the-World.html'],
    ];
    bestOfPages.forEach(function (p) {
      var a = document.createElement('a');
      a.href = base + 'Trip-Essentials/' + p[1];
      a.textContent = p[0];
      if (p[1] === curr) a.className = 'tb-active';
      hamMenu.appendChild(a);
    });
  }());

  /* ── Also on this site section ── */
  (function () {
    var sepAo = document.createElement('div'); sepAo.className = 'tb-ham-sep'; hamMenu.appendChild(sepAo);
    var hdrAo = document.createElement('div'); hdrAo.className = 'tb-ham-hdr'; hdrAo.textContent = 'Also on this site'; hamMenu.appendChild(hdrAo);
    var alsoPages = [
      ['Budget',                'Budget-Guide.html'],
      ['Car Rental & Private',  'Rental-Cars.html'],
      ['Cards & ATM',           'Cards-ATM.html'],
      ['City Transit Cards',    'City-Transit-Cards.html'],
      ['Festival Finder',       'Festival-Finder.html'],
      ['Hotels & Stays',        'Hotels-Stays.html'],
      ['More Resources',        'More-Resources.html'],
      ['Pickleball',            'Pickleball.html'],
      ['Restaurants',           'Restaurants.html'],
      ['SIM Cards',             'SIM-Cards.html'],
      ['Tipping',               'Tipping-Guide.html'],
      ['Tours & Tickets',       'Tours-Tickets.html'],
      ['Travel Apps',           'Travel-Apps.html'],
    ];
    alsoPages.forEach(function (p) {
      var a = document.createElement('a');
      a.href = base + 'Trip-Essentials/' + p[1];
      a.textContent = p[0];
      if (p[1] === curr) a.className = 'tb-active';
      hamMenu.appendChild(a);
    });
  }());

  /* Patch hamburger BYG link with city hash so it deep-links like the others. */
  if (cityHash) {
    var _hamBYG = hamMenu.querySelector('a[href*="Before-You-Go.html"]');
    if (_hamBYG) _hamBYG.href += cityHash;
  }

  /* Append menu to body (not bar) so .tb z-index:1002 > menu z-index:1001
     works correctly — a fixed child inside a stacking-context parent can't
     be overlaid by that same parent's z-index. */
  document.body.appendChild(hamMenu);

  var hamMenuClosedHTML = '<svg width="25" height="18" viewBox="0 0 18 13" aria-hidden="true"><rect x="0" y="0" width="18" height="2.5" rx="1.25" fill="currentColor"/><rect x="0" y="5.25" width="18" height="2.5" rx="1.25" fill="currentColor"/><rect x="0" y="10.5" width="18" height="2.5" rx="1.25" fill="currentColor"/></svg>';
  var _hamSavedScroll = 0;
  function _lockBodyScroll() {
    _hamSavedScroll = window.scrollY || window.pageYOffset || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + _hamSavedScroll + 'px';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }
  function _unlockBodyScroll() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo(0, _hamSavedScroll);
  }
  function closeHamMenu() {
    if (!hamMenu.classList.contains('tb-ham-open')) return;
    hamMenu.classList.remove('tb-ham-open');
    document.body.classList.remove('tve-ham-open');
    hamBtn.setAttribute('aria-expanded', 'false');
    hamBtn.innerHTML = hamMenuClosedHTML;
    _unlockBodyScroll();
    var djBtn = document.querySelector('.day-jump-btn');
    if (djBtn) djBtn.style.display = '';
  }
  function toggleHamMenu(e) {
    e.stopPropagation();
    var wasOpen = hamMenu.classList.contains('tb-ham-open');
    // On map pages (World Map + every per-guide stops-map — both mount
    // Leaflet onto #map, which no other page uses), tapping the CLOSE state
    // of this same button reads as "leave the map" rather than "collapse
    // the dropdown" — a map is a detail view you came from the guides
    // index to look at, not a page with its own content below a menu.
    // Picking a link inside the menu (closeHamMenu(), not this function)
    // still just closes the overlay and stays on the map — only the
    // explicit CLOSE tap navigates away.
    if (wasOpen && document.getElementById('map')) {
      // World Map → Guides-Index; per-guide stops-map → back to the guide.
      if (/\-stops-map\.html$/.test(location.pathname)) {
        window.history.back();
      } else {
        window.location.href = base + 'index.html';
      }
      return;
    }
    hamMenu.classList.toggle('tb-ham-open');
    var open = hamMenu.classList.contains('tb-ham-open');
    document.body.classList.toggle('tve-ham-open', open);
    if (open) { _lockBodyScroll(); } else { _unlockBodyScroll(); }
    var djBtn = document.querySelector('.day-jump-btn');
    if (djBtn) djBtn.style.display = open ? 'none' : '';
    hamBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    hamBtn.innerHTML = open
      ? '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><line x1="1" y1="1" x2="13" y2="13" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><line x1="13" y1="1" x2="1" y2="13" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>'
      : hamMenuClosedHTML;
  }
  hamBtn.addEventListener('click', toggleHamMenu);
  hamBtn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHamMenu(e); }
  });
  document.addEventListener('click', closeHamMenu);
  hamMenu.addEventListener('click', function (e) {
    e.stopPropagation();
    // Same-page hash links (World Map's Region jumps) never unload the page,
    // so the document-level outside-click closer above never fires for them —
    // the menu was staying stuck open with the button reading "CLOSE" after
    // picking a region. Close on any in-menu link tap so the map underneath
    // is visible again immediately, same as a real page navigation would.
    if (e.target.closest('a')) closeHamMenu();
  });

  /* ── Site-wide brand wordmark ─────────────────────────────────────────────
     OWNER 2026-08-10: goes on EVERY page, ABOVE the toolbar. Removing the
     desktop site title left every page except index.html with no branding at
     all — this puts it back once, site-wide, instead of editing 800+ files.
     Above the bar (not inside it) for two reasons: the bar is solid terracotta
     #b85c2a and would swallow the wordmark's orange script, and sitting above
     means it scrolls away while the sticky nav stays put.
     ONE copy, every page, index included. index.html briefly had its own larger
     <a class="site-logo"> as well, which rendered the wordmark twice there — the
     guard that was meant to skip it queried for '.site-logo' from a <script>
     that runs BEFORE that element exists in the DOM, so it never matched. The
     index copy is gone; this is the only wordmark on the site. */
  var tveBrandLogo = document.createElement('a');
  tveBrandLogo.className = 'tb-brand-logo';
  /* Links to the site ROOT, not to index.html — the address bar should read
     https://guidemydays.com. base is the relative hop to the root; at depth 0
     it is empty and an empty href re-points at the current page, so './'. */
  tveBrandLogo.href = base || './';
  tveBrandLogo.setAttribute('aria-label', 'Guide My Days — home');
  var _bImg = document.createElement('img');
  _bImg.src = base + 'Images/Logos/guidemydays-wordmark-serif-script-swoosh.png';
  _bImg.alt = 'Guide My Days';
  _bImg.width = 630; _bImg.height = 154;
  tveBrandLogo.appendChild(_bImg);

  /* Wordmark lives INSIDE the bar. Desktop is unchanged: .tb wraps and the logo
     takes a full-width first line, so it still sits above the tabs. MOBILE puts
     it inline with the hamburger — on mobile every nav item is inside the menu,
     so the bar was holding nothing but the menu icon and was pure decoration.
     brand left, menu right. Inserted here, not at bar assembly: tveBrandLogo is
     declared with var below, so an append there is a silent no-op. */
  if (tveBrandLogo) bar.insertBefore(tveBrandLogo, bar.firstChild);

  /* ── Insert toolbar ──────────────────────────────────────────────────────── */
  if (mount) {
    var hoistTarget = mount;
    while (hoistTarget.parentNode && hoistTarget.parentNode !== document.body) {
      hoistTarget = hoistTarget.parentNode;
    }
    document.body.insertBefore(bar, hoistTarget);
    mount.parentNode.removeChild(mount);
  } else {
    document.body.insertBefore(bar, document.body.firstChild);
  }

  /* ── Guide-page back-link — pill strip below toolbar (above country name) ── */
  if (isRealGuide) {
    var backStrip = document.createElement('div');
    backStrip.id = 'tve-back-guides';
    backStrip.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding:2px 32px;background:var(--c-page-bg,#f5f4f0);margin-bottom:12px;overflow-x:auto;';
    var pillStyle = 'display:inline-flex;align-items:center;height:28px;padding:0 12px;' +
      'background:var(--c-float-bg,#fff);border:1.5px solid var(--c-float-bd,#c8a44a);border-radius:14px;' +
      'font-size:12px;font-weight:700;letter-spacing:.03em;color:var(--c-float-text,#8a6c1a);' +
      'text-decoration:none;box-shadow:0 1px 6px rgba(0,0,0,.10);transition:color .12s,border-color .12s;' +
      'white-space:nowrap;line-height:1;box-sizing:border-box;';
    if (isStopsMap) {
      var _smParts = location.pathname.split('/');
      var _smGi = _smParts.indexOf('Guides');
      var _smCity = _smGi >= 0 && _smParts[_smGi + 1] ? _smParts[_smGi + 1].replace(/-/g, ' ') : 'Guide';
      var smPill = document.createElement('a');
      smPill.href = '#';
      smPill.textContent = '‹ ' + _smCity;
      smPill.style.cssText = pillStyle;
      smPill.addEventListener('click', function (e) { e.preventDefault(); history.back(); });
      smPill.addEventListener('mouseenter', function () { smPill.style.color = '#b85c2a'; smPill.style.borderColor = '#b85c2a'; });
      smPill.addEventListener('mouseleave', function () { smPill.style.color = 'var(--c-float-text,#8a6c1a)'; smPill.style.borderColor = 'var(--c-float-bd,#c8a44a)'; });
      backStrip.appendChild(smPill);
      bar.insertAdjacentElement('afterend', backStrip);
    } else {
    var backBYG = document.createElement('a');
    backBYG.href = base + 'Trip-Essentials/Before-You-Go.html' + cityHash;
    backBYG.textContent = 'Before You Go';
    backBYG.style.cssText = pillStyle;
    backBYG.addEventListener('mouseenter', function () {
      backBYG.style.color = '#b85c2a'; backBYG.style.borderColor = '#b85c2a';
    });
    backBYG.addEventListener('mouseleave', function () {
      backBYG.style.color = 'var(--c-float-text,#8a6c1a)'; backBYG.style.borderColor = 'var(--c-float-bd,#c8a44a)';
    });
    var backGuides = document.createElement('a');
    if (isReadAbout) {
      backGuides.textContent = '‹ ' + (_raCityName || 'Guide');
      backGuides.href = './';
      document.addEventListener('DOMContentLoaded', function () {
        var sb = document.querySelector('.story-footer-back');
        if (sb) backGuides.href = sb.getAttribute('href');
        /* Inject a print pill into the story-footer alongside the back link. */
        var sf = document.querySelector('.story-footer');
        if (sf) {
          var fp = document.createElement('button');
          fp.type = 'button';
          fp.textContent = '🖨 Print';
          fp.style.cssText = 'font-size:13px;font-weight:500;color:var(--c-float-text,#8a6c1a);' +
            'background:none;border:none;padding:0;cursor:pointer;font-family:inherit;' +
            'transition:color .12s;-webkit-appearance:none;';
          fp.addEventListener('mouseenter', function () { fp.style.color = '#b85c2a'; });
          fp.addEventListener('mouseleave', function () { fp.style.color = 'var(--c-float-text,#8a6c1a)'; });
          fp.id = 'tve-ra-print';
          fp.addEventListener('click', function () { window.print(); });
          var lbl = sf.querySelector('.story-footer-label');
          if (lbl) sf.insertBefore(fp, lbl); else sf.appendChild(fp);
          var phs = document.createElement('style');
          phs.textContent = '@media print{#tve-ra-print{display:none!important}}';
          document.head.appendChild(phs);
        }
      });
    } else {
      backGuides.href = base + 'index.html';
      backGuides.textContent = '‹ All Guides';
    }
    backGuides.style.cssText = pillStyle;
    backGuides.addEventListener('mouseenter', function () {
      backGuides.style.color = '#b85c2a'; backGuides.style.borderColor = '#b85c2a';
    });
    backGuides.addEventListener('mouseleave', function () {
      backGuides.style.color = 'var(--c-float-text,#8a6c1a)'; backGuides.style.borderColor = 'var(--c-float-bd,#c8a44a)';
    });
    /* ── Print-Ready Full Guide Mode — guide pages only ─────────────────────
       "🖨 Print Guide" sits at the left of the back-strip (margin-right:auto
       pushes the nav pills to the right). Click injects a <style> tag with
       @media print rules that hide all site chrome; the browser print dialog
       opens immediately. The afterprint event auto-reverts the button. A
       second click before printing also removes the style tag. */
    var printBtn = document.createElement('button');
    printBtn.type = 'button';
    printBtn.textContent = '🖨 Print Guide';
    printBtn.style.cssText = 'display:inline-flex;align-items:center;height:28px;padding:0 12px;' +
      'background:var(--c-float-bg,#fff);border:1.5px solid var(--c-float-bd,#c8a44a);border-radius:14px;' +
      'font-size:12px;font-weight:700;letter-spacing:.03em;color:var(--c-float-text,#8a6c1a);' +
      'cursor:pointer;box-shadow:0 1px 6px rgba(0,0,0,.10);transition:color .12s,border-color .12s;' +
      'margin-right:auto;-webkit-appearance:none;box-sizing:border-box;line-height:1;font-family:inherit;';
    printBtn.addEventListener('mouseenter', function () {
      if (document.getElementById('tve-print-mode')) return;
      printBtn.style.color = '#b85c2a'; printBtn.style.borderColor = '#b85c2a';
    });
    printBtn.addEventListener('mouseleave', function () {
      if (document.getElementById('tve-print-mode')) return;
      printBtn.style.color = 'var(--c-float-text,#8a6c1a)'; printBtn.style.borderColor = 'var(--c-float-bd,#c8a44a)';
    });
    printBtn.addEventListener('click', function () {
      var existing = document.getElementById('tve-print-mode');
      if (existing) {
        existing.parentNode.removeChild(existing);
        printBtn.textContent = '🖨 Print Guide';
        printBtn.style.color = 'var(--c-float-text,#8a6c1a)';
        printBtn.style.borderColor = 'var(--c-float-bd,#c8a44a)';
      } else {
        var css = document.createElement('style');
        css.id = 'tve-print-mode';
        css.textContent =
          '@media print{' +
            '.tb,#tve-back-guides,.day-jump-btn,.day-jump-overlay,' +
            '#tve-stop-strip,#tve-wx-strip,#hotel-alternatives,' +
            '#tve-best-of-crosslinks,#also-in-country,#also-on-this-site,' +
            '#nearby-guides,.title-updated,.overview-extras' +
            '{display:none!important}' +
            '.container{max-width:100%!important}' +
          '}';
        document.head.appendChild(css);
        printBtn.textContent = '✕ Exit Print Mode';
        printBtn.style.color = '#b85c2a';
        printBtn.style.borderColor = '#b85c2a';
        window.addEventListener('afterprint', function onAP() {
          var st = document.getElementById('tve-print-mode');
          if (st) { st.parentNode.removeChild(st); }
          printBtn.textContent = '🖨 Print Guide';
          printBtn.style.color = 'var(--c-float-text,#8a6c1a)';
          printBtn.style.borderColor = 'var(--c-float-bd,#c8a44a)';
          window.removeEventListener('afterprint', onAP);
        });
        window.print();
      }
    });
    backStrip.appendChild(printBtn);
    backStrip.appendChild(backBYG);
    backStrip.appendChild(backGuides);
    bar.insertAdjacentElement('afterend', backStrip);
    }
  }

  /* ── Back-to-guide pill on Trip-Essentials pages linked from guides ──
     Uses document.referrer to detect the source guide (no per-guide edits,
     no per-page HTML edits). Injects a MOBILE-ONLY fixed pill at the
     bottom-left of the viewport so it stays visible while the reader
     scrolls. Silently no-ops if the referrer isn't a guide (new tab,
     bookmark, external link, Before-You-Go, etc.), and on every page not
     in the allow-list below. Hidden on desktop (>600px) via inline
     media-query stylesheet.

     Allow-list: EXACTLY the Trip-Essentials pages that guide HTML links
     to (verified via `find Guides -name '*_v1.html' -exec grep -hoE
     'Trip-Essentials/...'`). Adding a new page here without a
     corresponding guide link would show a pill that can never appear;
     removing a page that guides link to would silently break navigation. */
  /* ── Back-pill navigation source (single slot, click-time) ──────────────
     The back-to-guide and back-to-BYG pills prefer document.referrer, but iOS
     standalone/PWA strips it, so the pill silently vanishes. This global
     capture-phase click listener records WHERE the reader is leaving FROM in
     ONE sessionStorage slot ('tve-nav-src' = {kind,url}) the moment they tap
     an outbound link. Exactly one slot → only ONE pill can ever fire, always
     matching the immediate source: BYG→page shows only the BYG pill, guide→
     page shows only the guide pill. A click from any page that is neither a
     guide nor Before-You-Go CLEARS the slot, so arriving at a Trip-Essentials
     page from the index or a direct link shows NO pill. Referrer stays the
     primary signal — this is only the fallback for when it's absent. */
  (function stashNavSource() {
    function _srcOfThisPage() {
      var p = location.pathname;
      if (/\/Guides\//.test(p) && p.indexOf('guides_index') < 0 && p.indexOf('Guides-Index') < 0) {
        return { kind: 'guide', url: location.href };
      }
      if (/\/Before-You-Go\.html/.test(p)) { return { kind: 'byg', url: location.href }; }
      return null;
    }
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') return;   /* in-page anchor — ignore */
      try {
        var src = _srcOfThisPage();
        if (src) { sessionStorage.setItem('tve-nav-src', JSON.stringify(src)); }
        else { sessionStorage.removeItem('tve-nav-src'); }
      } catch (err) {}
    }, true);
  }());

  (function injectBackToGuidePill() {
    var thisPage = location.pathname.replace(/.*\//, '').replace(/\.html$/, '');
    /* Owner rule 2026-07-28: never chain guide-to-guide — a reader who reached
       Guide B from Guide A's strip doesn't need a "back to Guide A" pill.
       Skip any page inside the Guides folder (real guide + stops-map + read-about). */
    if (/\/Guides\/[^\/]+\/[^\/]+\.html/.test(location.pathname)) return;
    /* Owner bug 2026-08-04: guide → Guides Index showed "← Amsterdam" on
       the index. The Guides Index is a pure-navigation hub — exclude it.
       Climate-Finder and When-to-Go were previously excluded here too, but
       owner rule 2026-08-06: every page reachable from a guide must show the
       back pill, so those exclusions are removed. */
    if ({ '': 1, 'index': 1, 'guides_index': 1, 'Guides-Index': 1 }[thisPage]) return;
    /* Source guide = document.referrer when it points at a guide. The
       referrer is empty on a hard refresh, a bookmark/hamburger entry, an
       iOS standalone/PWA launch, or any hop that isn't a direct guide→page
       click — which silently killed the pill. Fall back to the click-time
       'tve-nav-src' slot set by stashNavSource() (only when its kind is
       'guide', so the guide pill never fires when the reader came from BYG). */
    var ref = document.referrer || '';
    if (!/\/Guides\/[^\/]+\/[^\/]+\.html/.test(ref)) {
      ref = '';
      try {
        var _nav = JSON.parse(sessionStorage.getItem('tve-nav-src') || 'null');
        if (_nav && _nav.kind === 'guide' && /\/Guides\/[^\/]+\/[^\/]+\.html/.test(_nav.url)) ref = _nav.url;
      } catch (e) {}
    }
    var m = ref.match(/\/Guides\/([^\/]+)\/[^\/]+\.html(?:[?#].*)?$/);
    if (!m) return;
    var citySlug = m[1];
    var cityName = decodeURIComponent(citySlug).replace(/-/g, ' ');
    /* Owner rule 2026-07-28: the pill ALWAYS returns to the "Also on this
       site" card at the bottom of the guide, never to the top and never to
       the reader's exact scroll position. That card is the origin point for
       every link that leads here — the reader knows to look for it there.
       Strip any existing fragment/query from the referrer and append the
       fixed anchor. */
    var guideHref = ref.split('#')[0].split('?')[0] + '#also-on-this-site';
    function build() {
      var css = document.createElement('style');
      css.textContent =
        '#tve-back-to-guide{position:fixed;bottom:24px;left:16px;z-index:1400;' +
        'display:inline-flex;align-items:center;height:28px;padding:0 11px;' +
        'background:var(--c-float-bg,#fff);border:1.5px solid var(--c-float-bd,#c8a44a);border-radius:14px;' +
        'font-size:12px;font-weight:700;letter-spacing:.03em;color:var(--c-float-text,#8a6c1a);' +
        'text-decoration:none;box-shadow:0 2px 10px rgba(0,0,0,.14);' +
        'transition:color .15s,border-color .15s,box-shadow .15s;' +
        'transform:translateZ(0);-webkit-transform:translateZ(0)}' +
        '#tve-back-to-guide:hover{color:#b85c2a;border-color:#b85c2a;' +
        'box-shadow:0 4px 16px rgba(0,0,0,.18);text-decoration:none}' +
        '@media(min-width:601px){#tve-back-to-guide{display:none}}';
      document.head.appendChild(css);
      var pill = document.createElement('a');
      pill.id = 'tve-back-to-guide';
      pill.href = guideHref;
      pill.textContent = '← ' + cityName;
      document.body.appendChild(pill);
      void pill.offsetHeight;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', build);
    } else {
      build();
    }
  }());

  /* ── Back-to-Before-You-Go pill (mobile only) ────────────────────────── */
  /* Sibling to #tve-back-to-guide. Fires when the reader arrived on a
     Trip-Essentials page FROM Before-You-Go. Same visual, different label
     ("← Back to Before You Go") and destination (the Before-You-Go card
     grid via #byg-results, so a short scroll reaches the next section).
     Referrer is the source of truth — one pill or the other, never both.  */
  (function injectBackToBygPill() {
    var pagesLinkedFromByg = {
      'Asia-Stats': 1, 'Caribbean-Stats': 1, 'Currency-Guide': 1,
      'Day-Trips': 1, 'Entry-Requirements': 1, 'Europe-Stats': 1,
      'European-Train-Guide': 1, 'Lounges-Europe': 1, 'Lounges-US': 1,
      'Oceania-Stats': 1, 'Plug-Adapter-Guide': 1, 'Safety-Guide': 1, 'South-America-Stats': 1,
      'Stats-Across-Canada': 1, 'Stats-Across-US': 1, 'Sunrise-Sunset': 1,
      'Tap-Water': 1, 'Time-Zones': 1, 'Travel-Packing': 1,
      'Trusted-Traveler': 1, 'Vaccines': 1, 'Visas': 1, 'Weather': 1,
      /* The six lodging pages the Where to Stay card on Before-You-Go links
         out to (added 2026-08-09 with that card). Without these rows a reader
         who taps through from Before-You-Go lands with no back pill. */
      'Neighborhoods': 1, 'Hotels-Stays': 1,
      'Best-Most-Luxurious-Hotels': 1, 'Best-Unique-Hotels': 1,
      'Best-Resorts': 1, 'Best-Ultra-Luxurious-Resorts': 1
    };
    var thisPage = location.pathname.replace(/.*\//, '').replace(/\.html$/, '');
    if (!pagesLinkedFromByg[thisPage]) return;
    /* Source = document.referrer when it's Before-You-Go; else the click-time
       'tve-nav-src' slot set by stashNavSource() (only when its kind is 'byg',
       so the BYG pill never fires when the reader came from a guide). */
    var ref = document.referrer || '';
    if (!/\/Before-You-Go\.html(?:[?#].*)?$/.test(ref)) {
      ref = '';
      try {
        var _nav = JSON.parse(sessionStorage.getItem('tve-nav-src') || 'null');
        if (_nav && _nav.kind === 'byg' && /\/Before-You-Go\.html/.test(_nav.url)) ref = _nav.url;
      } catch (e) {}
    }
    if (!/\/Before-You-Go\.html(?:[?#].*)?$/.test(ref)) return;
    /* Preserve referrer's query string (city / month state if URL-encoded)
       and drop any fragment; append #byg-results so the reader lands on the
       card grid, ready to pick the next section with a short scroll. */
    var bygHref = ref.split('#')[0] + '#byg-results';
    function buildByg() {
      var css = document.createElement('style');
      css.textContent =
        '#tve-back-to-byg{position:fixed;bottom:24px;left:16px;z-index:1400;' +
        'display:inline-flex;align-items:center;height:28px;padding:0 11px;' +
        'background:var(--c-float-bg,#fff);border:1.5px solid var(--c-float-bd,#c8a44a);border-radius:14px;' +
        'font-size:12px;font-weight:700;letter-spacing:.03em;color:var(--c-float-text,#8a6c1a);' +
        'text-decoration:none;box-shadow:0 2px 10px rgba(0,0,0,.14);' +
        'transition:color .15s,border-color .15s,box-shadow .15s;' +
        'transform:translateZ(0);-webkit-transform:translateZ(0)}' +
        '#tve-back-to-byg:hover{color:#b85c2a;border-color:#b85c2a;' +
        'box-shadow:0 4px 16px rgba(0,0,0,.18);text-decoration:none}' +
        '@media(min-width:601px){#tve-back-to-byg{display:none}}';
      document.head.appendChild(css);
      var pill = document.createElement('a');
      pill.id = 'tve-back-to-byg';
      pill.href = bygHref;
      pill.textContent = '← Back to Before You Go';
      document.body.appendChild(pill);
      void pill.offsetHeight;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', buildByg);
    } else {
      buildByg();
    }
  }());

  /* ── History back pill (mobile only, guide pages only) ───────────────────
     Replaces the native iOS/Android back arrow that disappears in standalone
     PWA mode. Bottom-left of the floating row.
     There is NO Forward pill (owner rule 2026-08-09): it shipped bottom-right,
     hidden until a popstate revealed it, and the owner cut it — the browser's
     own forward gesture already covers the case, and a third pill crowded a
     row that only has 393px to work with. Do not re-add it.
     Only injected when history.length > 1 (something to go back to).        */
  (function injectHistoryBackPill() {
    if (!/\/Guides\/[^\/]+\/[^\/]+\.html/.test(location.pathname)) return;
    if (history.length <= 1) return;

    function build() {
      var css = document.createElement('style');
      css.textContent =
        /* 28px tall / 12px text — the floating family shrank a size on
           2026-08-09 (owner: the pills were too big). bottom:6px seats the pill
           as low as the viewport allows and puts its centre 20px above the
           floor — the same optical line as the centred .day-jump-btn (28px at
           bottom:6px) and .tve-scroll-top (30px at bottom:5px) in
           guide-style.css. Move all three together. */
        '#tve-nav-back{position:fixed;bottom:6px;left:16px;z-index:1400;' +
        'display:inline-flex;align-items:center;height:28px;padding:0 11px;' +
        'background:var(--c-float-bg,#fff);border:1.5px solid var(--c-float-bd,#c8a44a);border-radius:14px;' +
        'font-size:12px;font-weight:700;letter-spacing:.03em;color:var(--c-float-text,#8a6c1a);' +
        'box-shadow:0 2px 10px rgba(0,0,0,.14);cursor:pointer;' +
        'font-family:inherit;-webkit-appearance:none;' +
        'transition:color .15s,border-color .15s,box-shadow .15s}' +
        '#tve-nav-back:hover{color:#b85c2a;border-color:#b85c2a;' +
        'box-shadow:0 4px 16px rgba(0,0,0,.18)}' +
        'body.tve-ham-open #tve-nav-back{display:none!important}' +
        '@media(min-width:601px){#tve-nav-back{display:none!important}}';
      document.head.appendChild(css);

      var backPill = document.createElement('button');
      backPill.id = 'tve-nav-back';
      backPill.textContent = 'Back';
      backPill.addEventListener('click', function () { history.back(); });

      document.body.appendChild(backPill);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', build);
    } else {
      build();
    }
  }());

  /* ── Arrows inside .overview-title: [‹] · title · [›] — real guides only ─── */
  /* Deferred to DOMContentLoaded: script runs at the top of <body>, before
     .overview-title exists in the DOM. querySelector would return null if run
     synchronously here.                                                       */
  if (isRealGuide && (prevHref || nextHref)) {
    function injectOverviewArrows() {
      var overviewTitle = document.querySelector('.overview-title');
      if (!overviewTitle) return;

      var titleSpan = document.createElement('span');
      titleSpan.style.cssText = 'flex:1;text-align:center;';
      while (overviewTitle.firstChild) titleSpan.appendChild(overviewTitle.firstChild);

      overviewTitle.style.display       = 'flex';
      overviewTitle.style.alignItems    = 'center';
      overviewTitle.style.paddingBottom = '8px';

      if (prevHref) {
        var btnPrev = document.createElement('a');
        btnPrev.href = prevHref;
        btnPrev.textContent = '‹';
        btnPrev.setAttribute('aria-label', 'Previous');
        btnPrev.style.cssText = btnStyle;
        overviewTitle.appendChild(btnPrev);
      } else {
        var sL = document.createElement('span'); sL.style.cssText = 'width:36px;flex-shrink:0;'; overviewTitle.appendChild(sL);
      }

      overviewTitle.appendChild(titleSpan);

      if (nextHref) {
        var btnNext = document.createElement('a');
        btnNext.href = nextHref;
        btnNext.textContent = '›';
        btnNext.setAttribute('aria-label', 'Next');
        btnNext.style.cssText = btnStyle;
        overviewTitle.appendChild(btnNext);
      } else {
        var sR = document.createElement('span'); sR.style.cssText = 'width:36px;flex-shrink:0;'; overviewTitle.appendChild(sR);
      }

    }

    /* On mobile, lift the READ ABOUT link out of the title (guides inject it
       either inside .overview-title or as a sibling — normalise both) to the
       bottom of the overview, where guide-style.css styles it as a full-width
       button. Deferred to window.load: the guide's own read-about injection
       runs AFTER these arrows, so we relocate once everything has settled.
       Desktop keeps it in the title bar. */
    function repositionReadAbout() {
      if (!(window.matchMedia && window.matchMedia('(max-width: 600px)').matches)) return;
      var ovSec = document.querySelector('.overview-section');
      if (!ovSec) return;
      var raLink = [].slice.call(ovSec.querySelectorAll('.overview-extra-link')).filter(function (a) {
        return /read about/i.test(a.textContent || '') && !a.closest('.overview-extras');
      })[0];
      if (raLink) ovSec.appendChild(raLink);
    }
    /* Move the "Updated {Month}" stamp to the end of the guide on all viewports.
       Finds whichever candidate section appears LAST in DOM order — compareDocumentPosition
       flag 4 = DOCUMENT_POSITION_FOLLOWING — so adding new sections never strands the
       stamp in the middle of the page. */
    function repositionUpdatedStamp() {
      var upd = document.querySelector('.title-page .title-updated') || document.querySelector('.title-updated');
      if (!upd) return;
      var ids = ['tve-best-of-crosslinks', 'also-in-country', 'nearby-guides', 'also-on-this-site'];
      var last = null;
      ids.forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        if (!last || (last.compareDocumentPosition(el) & 4)) { last = el; }
      });
      if (last && last.parentNode) {
        var _ne = document.querySelector('.title-no-entries');
        if (_ne) {
          var _row = document.createElement('div');
          _row.className = 'tve-stamp-row';
          _row.insertBefore(upd, null);
          _row.insertBefore(_ne, null);
          last.parentNode.insertBefore(_row, last.nextSibling);
        } else {
          last.parentNode.insertBefore(upd, last.nextSibling);
        }
      }
    }
    function repositionMobileBits() { repositionReadAbout(); repositionUpdatedStamp(); }
    if (document.readyState === 'complete') repositionMobileBits();
    else window.addEventListener('load', repositionMobileBits);

    /* Display the "European Train Guide" resource pill as just "European Train".
       The HTML keeps the full canonical label (so the also-on-site validators
       still pass); this only shortens what the reader sees, so the pill fits a
       50% grid cell without wrapping. Runs on all viewports. */
    function shortenTrainPill() {
      [].slice.call(document.querySelectorAll('.also-on-this-site-pill[href*="European-Train-Guide"]')).forEach(function (a) {
        if (/European Train Guide/.test(a.textContent || '')) a.textContent = (a.textContent || '').replace(/European Train Guide/, 'European Train');
      });
    }
    if (document.readyState !== 'loading') shortenTrainPill();
    else document.addEventListener('DOMContentLoaded', shortenTrainPill);

    /* ── Per-guide stops map pill — injected when {slug}-stops-map.html exists.
       Appended at the END of the .gel overview-extras row, after all static
       pills (including ✨ Worth Knowing). Uses a HEAD request so the guide
       HTML never needs editing; the pill appears automatically once the map file
       has been generated. No-op if the file is absent (404). */
    function injectStopsMapPill() {
      var gelRow = document.querySelector('.overview-extras');
      if (!gelRow) return;
      if (gelRow.querySelector('a[href$="-stops-map.html"]')) return; // already present in HTML
      // Derive slug from the current page filename (e.g. lisbon_v4.html → lisbon)
      var pageName = location.pathname.split('/').pop() || '';
      var slugMatch = pageName.match(/^(.+?)(?:_v\d+)?\.html$/);
      if (!slugMatch) return;
      var slug = slugMatch[1];
      var mapHref = './' + slug + '-stops-map.html';
      var xhr = new XMLHttpRequest();
      xhr.open('HEAD', mapHref, true);
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          var pill = document.createElement('a');
          pill.className = 'overview-extra-link';
          pill.href = mapHref;
          pill.textContent = '🗺 All Stops Map';
          gelRow.appendChild(pill);
        }
      };
      xhr.send();
    }
    if (document.readyState !== 'loading') injectStopsMapPill();
    else document.addEventListener('DOMContentLoaded', injectStopsMapPill);

    /* ── Route Optimizer Preview Button — guide pages with a stops-map only ── */
    function injectOptimizeButton() {
      var gelRow = document.querySelector('.overview-extras');
      if (!gelRow) return;
      var pageName = location.pathname.split('/').pop() || '';
      var slugMatch = pageName.match(/^(.+?)(?:_v\d+)?\.html$/);
      if (!slugMatch) return;
      var mapHref = './' + slugMatch[1] + '-stops-map.html';

      /* Only show the button if the stops-map actually exists */
      var checkXhr = new XMLHttpRequest();
      checkXhr.open('HEAD', mapHref, true);
      checkXhr.onload = function () {
        if (checkXhr.status < 200 || checkXhr.status >= 300) return;

        var optBtn = document.createElement('a');
        optBtn.className = 'overview-extra-link';
        optBtn.id = 'tve-preview-btn';
        optBtn.href = '#';
        optBtn.textContent = '🔀 Preview Optimized';
        optBtn.style.cssText = 'cursor:pointer;';

        optBtn.addEventListener('click', function (e) {
          e.preventDefault();
          if (optBtn.getAttribute('data-busy') === '1') return;
          optBtn.setAttribute('data-busy', '1');
          optBtn.textContent = '⏳ Loading…';

          var fetchXhr = new XMLHttpRequest();
          fetchXhr.open('GET', mapHref, true);
          fetchXhr.onload = function () {
            if (fetchXhr.status < 200 || fetchXhr.status >= 300) {
              optBtn.textContent = '🔀 Preview Optimized';
              optBtn.removeAttribute('data-busy');
              return;
            }
            var m = fetchXhr.responseText.match(/(?:var|const|let)\s+STOPS\s*=\s*(\[[\s\S]*?\]);/);
            if (!m) { optBtn.textContent = '🔀 Preview Optimized'; optBtn.removeAttribute('data-busy'); return; }
            var stops;
            try { stops = JSON.parse(m[1]); } catch (ex) { optBtn.textContent = '🔀 Preview Optimized'; optBtn.removeAttribute('data-busy'); return; }
            runPreview(stops);
            optBtn.textContent = '✅ Optimized (preview)';
          };
          fetchXhr.onerror = function () { optBtn.textContent = '🔀 Preview Optimized'; optBtn.removeAttribute('data-busy'); };
          fetchXhr.send();
        });

        /* Place in the ICS pill row between All Stops Map and Save for Offline */
        optBtn.style.setProperty('flex', '1 1 0', 'important');
        optBtn.style.setProperty('min-width', '0', 'important');
        optBtn.style.setProperty('align-items', 'center', 'important');
        optBtn.style.setProperty('justify-content', 'center', 'important');
        optBtn.style.setProperty('text-align', 'center', 'important');
        optBtn.addEventListener('touchstart', function () {
          optBtn.classList.add('tve-pressed');
          optBtn.style.setProperty('color', '#fff', 'important');
          optBtn.style.setProperty('-webkit-text-fill-color', '#fff', 'important');
        }, { passive: true });
        optBtn.addEventListener('touchend', function () {
          setTimeout(function () {
            optBtn.classList.remove('tve-pressed');
            optBtn.style.removeProperty('color');
            optBtn.style.removeProperty('-webkit-text-fill-color');
          }, 300);
        }, { passive: true });
        optBtn.addEventListener('touchcancel', function () {
          optBtn.classList.remove('tve-pressed');
          optBtn.style.removeProperty('color');
          optBtn.style.removeProperty('-webkit-text-fill-color');
        }, { passive: true });
        var offlineBtn = document.getElementById('tve-offline-btn');
        if (offlineBtn) {
          offlineBtn.parentNode.insertBefore(optBtn, offlineBtn);
        } else {
          var icsRow = document.getElementById('ics-pill-row');
          if (icsRow) icsRow.appendChild(optBtn);
          else gelRow.appendChild(optBtn);
        }
      };
      checkXhr.send();

      /* ── k-means geographic clustering ─────────────────────────────────── */
      function distKm(a, b) {
        var dlat = (a.lat - b.lat) * 111;
        var dlng = (a.lng - b.lng) * 88;
        return Math.sqrt(dlat * dlat + dlng * dlng);
      }

      function kmeans(items, k) {
        var withCoord = items.filter(function (s) { return s.lat !== null && s.lng !== null; });
        var noCoord   = items.filter(function (s) { return s.lat === null || s.lng === null; });
        if (withCoord.length === 0) {
          /* No coordinates: split evenly */
          var even = []; for (var ei = 0; ei < k; ei++) even.push([]);
          items.forEach(function (s, i) { even[i % k].push(s); });
          return even;
        }
        /* k-means++ initialisation */
        var centroids = [withCoord[0]];
        while (centroids.length < Math.min(k, withCoord.length)) {
          var dists2 = withCoord.map(function (s) {
            var mn = Infinity;
            centroids.forEach(function (c) { var d = distKm(s, c); if (d < mn) mn = d; });
            return mn * mn;
          });
          var tot = dists2.reduce(function (a, b) { return a + b; }, 0);
          var r = (tot * 17393 / 65536) % tot; /* deterministic pseudo-random pick */
          var cum = 0;
          for (var j = 0; j < withCoord.length; j++) {
            cum += dists2[j];
            if (cum >= r) { centroids.push(withCoord[j]); break; }
          }
        }
        while (centroids.length < k) centroids.push(centroids[centroids.length - 1]);

        /* Iterate */
        var asgn = new Array(withCoord.length).fill(0);
        for (var iter = 0; iter < 60; iter++) {
          var changed = false;
          withCoord.forEach(function (s, i) {
            var best = 0, bestD = Infinity;
            centroids.forEach(function (c, ci) { var d = distKm(s, c); if (d < bestD) { bestD = d; best = ci; } });
            if (asgn[i] !== best) { asgn[i] = best; changed = true; }
          });
          if (!changed) break;
          centroids = centroids.map(function (_, ci) {
            var mem = withCoord.filter(function (_, i) { return asgn[i] === ci; });
            if (!mem.length) return centroids[ci];
            return { lat: mem.reduce(function (s, m) { return s + m.lat; }, 0) / mem.length,
                     lng: mem.reduce(function (s, m) { return s + m.lng; }, 0) / mem.length };
          });
        }

        /* Build clusters */
        var clusters = []; for (var ci = 0; ci < k; ci++) clusters.push([]);
        withCoord.forEach(function (s, i) { clusters[asgn[i]].push(s); });
        noCoord.forEach(function (s) {
          var mi = 0; clusters.forEach(function (c, i) { if (c.length < clusters[mi].length) mi = i; });
          clusters[mi].push(s);
        });
        return clusters;
      }

      function nearestNeighborOrder(items) {
        if (items.length <= 1) return items.slice();
        var withCoord = items.filter(function (s) { return s.lat !== null && s.lng !== null; });
        var noCoord   = items.filter(function (s) { return s.lat === null || s.lng === null; });
        if (!withCoord.length) return items.slice();
        var ordered = [withCoord[0]];
        var rem = withCoord.slice(1);
        while (rem.length) {
          var last = ordered[ordered.length - 1];
          var bi = 0, bd = Infinity;
          rem.forEach(function (s, i) { var d = distKm(last, s); if (d < bd) { bd = d; bi = i; } });
          ordered.push(rem[bi]);
          rem.splice(bi, 1);
        }
        return ordered.concat(noCoord);
      }

      /* ── DOM rewrite ──────────────────────────────────────────────────── */
      function runPreview(stopsData) {
        /* Build name → coords lookup */
        var coordMap = {};
        stopsData.forEach(function (s) { coordMap[s.name] = { lat: s.lat, lng: s.lng }; });

        /* Collect stop-block elements, keyed by name */
        var dayBlocks = [].slice.call(document.querySelectorAll('.day-block'));
        var nonTrainBlocks = [];
        dayBlocks.forEach(function (db) {
          var hdr = db.querySelector('.day-header');
          if (hdr && /Train Day/i.test(hdr.textContent)) return;
          nonTrainBlocks.push(db);
        });

        /* Gather all stop elements from non-train days */
        var allItems = [];
        nonTrainBlocks.forEach(function (db) {
          [].slice.call(db.querySelectorAll('.stop-block')).forEach(function (sb) {
            var nameEl = sb.querySelector('.stop-name');
            var name = nameEl ? nameEl.textContent.trim() : '';
            var coords = coordMap[name] || { lat: null, lng: null };
            allItems.push({ elem: sb, name: name, lat: coords.lat, lng: coords.lng });
          });
        });
        if (!allItems.length) return;

        /* k-means then nearest-neighbor */
        var k = nonTrainBlocks.length;
        var clusters = kmeans(allItems, k);
        var ordered = clusters.map(function (c) { return nearestNeighborOrder(c); });

        /* Rewrite each non-train day-block */
        nonTrainBlocks.forEach(function (db, ci) {
          var dayStops = ordered[ci] || [];

          /* Detach all stop-blocks and .next / .next-tram / .next-metro banners */
          [].slice.call(db.querySelectorAll('.stop-block, .next, .next-tram, .next-metro')).forEach(function (el) {
            if (el.parentNode) el.parentNode.removeChild(el);
          });

          /* Re-insert in optimized order */
          dayStops.forEach(function (stop, si) {
            /* Inter-stop motion banner */
            if (si > 0) {
              var prev = dayStops[si - 1];
              var banner = document.createElement('div');
              banner.className = 'next';
              if (prev.lat !== null && stop.lat !== null) {
                var dlat = (stop.lat - prev.lat) * 111;
                var dlng = (stop.lng - prev.lng) * 88;
                var km = Math.sqrt(dlat * dlat + dlng * dlng);
                var walkM = Math.round(km / (5 / 60));
                var taxiM = Math.max(2, Math.round(km / (20 / 60)));
                banner.textContent = walkM <= 30
                  ? '🚶 ' + walkM + ' min · 🚕 ' + taxiM + ' min → ' + stop.name
                  : '🚕 ' + taxiM + ' min → ' + stop.name;
              } else {
                banner.textContent = '→ ' + stop.name;
              }
              db.appendChild(banner);
            }

            /* Update stop number */
            var numEl = stop.elem.querySelector('.stop-num');
            if (numEl) numEl.textContent = (si + 1) + '.';

            db.appendChild(stop.elem);
          });

          /* Close with → hotel */
          if (dayStops.length) {
            var hotelBanner = document.createElement('div');
            hotelBanner.className = 'next';
            hotelBanner.textContent = '→ hotel';
            db.appendChild(hotelBanner);
          }
        });

        /* Floating notice */
        var notice = document.createElement('div');
        notice.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);' +
          'background:#2c2c2c;color:#7a3b1e;padding:10px 18px;border-radius:8px;font-size:13px;' +
          'z-index:9999;display:flex;align-items:center;gap:14px;' +
          'box-shadow:0 2px 12px rgba(0,0,0,.35);max-width:90vw;white-space:nowrap;';
        notice.innerHTML = '<span>🔀 Preview only — run <code style="background:rgba(255,255,255,.15);padding:1px 5px;border-radius:3px;">optimize_route.py</code> to commit</span>';
        var resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reset';
        resetBtn.style.cssText = 'background:#fff;color:#2c2c2c;border:none;border-radius:4px;' +
          'padding:4px 12px;font-size:12px;cursor:pointer;font-weight:700;flex-shrink:0;';
        resetBtn.addEventListener('click', function () { location.reload(); });
        notice.appendChild(resetBtn);
        document.body.appendChild(notice);
      }
    }
    if (document.readyState !== 'loading') injectOptimizeButton();
    else document.addEventListener('DOMContentLoaded', injectOptimizeButton);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectOverviewArrows);
    } else {
      injectOverviewArrows();
    }
  }

  /* ── Trip Overview: colour the leading "Day N" label ──────────────────────
     .overview-day-title is plain text: "Day {N}" then a separator (– or ·)
     then the stop list. Wraps just the leading "Day N" token in a span so
     guide-style.css can colour/weight it, without touching any guide's static
     HTML. Runs on all viewports; a title that doesn't start with "Day N" is
     left untouched (safe no-op, e.g. on Guides-Index.html's reused markup). */
  if (isRealGuide) {
    function styleOverviewDayNumbers() {
      [].slice.call(document.querySelectorAll('.overview-day-title')).forEach(function (el) {
        if (el.querySelector('.overview-day-num')) return;
        var text = el.textContent || '';
        var m = /^Day\s+\d+/.exec(text);
        if (!m) return;
        var rest = text.slice(m[0].length).replace(/^\s*–\s*/, ' · ').replace(/🚆\s+(?=Train Day)/, '🚆 · ');
        var num = document.createElement('span');
        num.className = 'overview-day-num';
        num.textContent = m[0];
        el.textContent = '';
        el.appendChild(num);
        el.appendChild(document.createTextNode(rest));
      });
    }
    if (document.readyState !== 'loading') styleOverviewDayNumbers();
    else document.addEventListener('DOMContentLoaded', styleOverviewDayNumbers);
  }

  /* ── Guide content collapse / expand toggle — right side of Trip Overview ───
     Button lives inside .overview-extras (right-aligned via margin-left:auto).
     Clicking hides all day blocks and extra sections that follow .overview-section.
     Targets are re-queried on every click so dynamically-injected sections
     (hotel banner, etc.) are always included. Session-only state. */
  if (isRealGuide) {
    function injectOverviewToggle() {
      var sec = document.querySelector('.overview-section');
      if (!sec || document.getElementById('overview-toggle-btn')) return;
      var btn = document.createElement('button');
      btn.id = 'overview-toggle-btn';
      btn.type = 'button';
      btn.className = 'overview-toggle-btn';
      var expanded = true;
      /* Only a section that carries its OWN control can be collapsed — a
         `> .extras-title` (extras / Worth Knowing / hotel alternatives) or a
         `> .day-header` (day block). Without one there is nothing to click to
         bring the content back. #skip-list is exactly that case: a title-less
         italic footnote. Collapsing it hid its "Skipping: …" line permanently
         and left the section's 36px top margin + 14px collapsed padding behind
         as ~50px of blank space (owner spotted it 2026-08-10). Same gate as the
         mobile auto-collapse in _sectionCollapse. */
      function _hasCollapseControl(el) {
        return !!el.querySelector(':scope > .extras-title, :scope > .day-header');
      }
      function getTargets() {
        return Array.from(document.querySelectorAll(
          '.day-block, .extras-section, .worth-knowing, #hotel-alternatives'
        )).filter(_hasCollapseControl);
      }
      function render() {
        btn.textContent = expanded ? '▲ Collapse' : '▼ Expand';
        btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        getTargets().forEach(function(el) { el.classList.toggle('collapsed', !expanded); });
        var ng = document.getElementById('nearby-guides');
        if (ng) {
          var ngPills = ng.querySelector('.nearby-guides-pills');
          if (ngPills) ngPills.style.display = '';
          var ngTitle = ng.querySelector('.extras-title');
          if (ngTitle) ngTitle.style.marginBottom = '';
          ng.style.paddingBottom = '';
        }
      }
      btn.addEventListener('click', function() { expanded = !expanded; render(); });
      sec.insertAdjacentElement('afterend', btn);
      render();
    }
    if (document.readyState !== 'loading') injectOverviewToggle();
    else document.addEventListener('DOMContentLoaded', injectOverviewToggle);
  }

  /* ── In-guide bookmark — pin this guide as current trip from inside the guide.
     Button sits to the right of .title-city ("LISBON") with a 10px gap.
     All viewports. Resting colour: terracotta #b85c2a (outline when unpinned,
     filled when pinned). Shares tve_pinned_guides localStorage store with the
     Guides Index (plural key, array of up to 3 pins). */
  if (isRealGuide) {
    function injectGuideBookmark() {
      var tc = document.querySelector('.title-city');
      if (!tc || document.getElementById('guide-pin-btn')) return;

      var KEY  = 'tve_pinned_guides';
      var MAX  = 3;
      var name = document.title;
      var pm   = location.pathname.match(/(\/Guides\/.+)$/);
      var href = pm ? '.' + pm[1] : location.pathname;

      var SVG_OUT  = '<svg width="14" height="16" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 1h8a1 1 0 0 1 1 1v10.5l-5-3-5 3V2a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
      var SVG_FILL = '<svg width="14" height="16" viewBox="0 0 12 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 1h8a1 1 0 0 1 1 1v10.5l-5-3-5 3V2a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';

      function getPins() {
        try {
          var raw = localStorage.getItem(KEY);
          if (raw) return JSON.parse(raw) || [];
          var old = localStorage.getItem('tve_pinned_guide');
          if (old) {
            var d = JSON.parse(old);
            if (d && d.href) { var arr = [d]; localStorage.setItem(KEY, JSON.stringify(arr)); localStorage.removeItem('tve_pinned_guide'); return arr; }
          }
          return [];
        } catch (e) { return []; }
      }
      function pinActive() { return getPins().some(function (p) { return p.href === href; }); }

      /* Wrap existing city-name text so .title-city stays flex-able */
      var textSpan = document.createElement('span');
      while (tc.firstChild) textSpan.appendChild(tc.firstChild);
      tc.style.display    = 'inline-flex';
      tc.style.alignItems = 'center';
      tc.appendChild(textSpan);

      var on = pinActive();
      var btn = document.createElement('button');
      btn.id        = 'guide-pin-btn';
      btn.type      = 'button';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.title     = on ? 'Remove bookmark' : 'Bookmark this guide';
      btn.innerHTML = on ? SVG_FILL : SVG_OUT;
      btn.style.cssText =
        'display:inline-flex;align-items:center;flex-shrink:0;' +
        'background:none;border:none;cursor:pointer;padding:0;margin-left:10px;' +
        'color:#8a6c1a;transition:opacity .12s;opacity:' + (on ? '1' : '.65') + ';';

      tc.appendChild(btn);

      btn.addEventListener('mouseenter', function() { btn.style.opacity = '1'; });
      btn.addEventListener('mouseleave', function() { btn.style.opacity = pinActive() ? '1' : '.65'; });

      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var pins = getPins();
        if (pinActive()) {
          pins = pins.filter(function (p) { return p.href !== href; });
          localStorage.setItem(KEY, JSON.stringify(pins));
          btn.innerHTML = SVG_OUT;
          btn.style.opacity = '.65';
          btn.setAttribute('aria-pressed', 'false');
          btn.title = 'Bookmark this guide';
        } else {
          pins = pins.filter(function (p) { return p.href !== href; });
          pins.push({ href: href, name: name, flag: '' });
          if (pins.length > MAX) pins = pins.slice(pins.length - MAX);
          localStorage.setItem(KEY, JSON.stringify(pins));
          btn.innerHTML = SVG_FILL;
          btn.style.opacity = '1';
          btn.setAttribute('aria-pressed', 'true');
          btn.title = 'Remove bookmark';
        }
      });
    }
    if (document.readyState !== 'loading') injectGuideBookmark();
    else document.addEventListener('DOMContentLoaded', injectGuideBookmark);
  }

  /* ── Altitude advisory banner — high-elevation guides only ───────────────── */
  if (isRealGuide) {
    var ALTITUDE_CITIES = {
      'Cusco':       { elev: '3,400 m', text: 'Cusco sits at 3,400 m — roughly 30% less oxygen than at sea level. Allow 48 hours to acclimatize before strenuous activity.' },
      'MachuPicchu': { elev: '2,430 m', text: 'Machu Picchu is at 2,430 m. Most visitors arrive via Cusco first for acclimatization; the altitude still shortens breath on the steeper paths.' },
      'Santa-Fe':    { elev: '2,134 m', text: 'Santa Fe sits at 7,000 ft (2,134 m). Arriving from sea level, expect mild shortness of breath and a possible headache on the first day.' },
      'Lake-Tahoe':  { elev: '1,897 m', text: 'Lake Tahoe\'s basin sits at 6,225 ft (1,897 m). Higher exertion feels harder than expected on arrival; ease into strenuous hikes on day two.' }
    };
    function injectAltitudeBanner() {
      var urlParts = location.pathname.split('/');
      var gi       = urlParts.indexOf('Guides');
      if (gi < 0 || !urlParts[gi + 1]) return;
      var cityData = ALTITUDE_CITIES[urlParts[gi + 1]];
      if (!cityData) return;
      var ovSec    = document.querySelector('.overview-section');
      var extrasEl = document.querySelector('.overview-extras');
      if (!ovSec || !extrasEl) return;
      var pn = (location.pathname.split('/').pop() || '');
      var sm = pn.match(/^(.+?)(?:_v\d+)?\.html$/);
      var raHref = sm ? './' + sm[1] + '-read-about.html#altitude' : null;
      var banner = document.createElement('div');
      banner.id  = 'ams-advisory';
      var icon = document.createElement('span');
      icon.className   = 'ams-icon';
      icon.textContent = '🏔';
      var body = document.createElement('div');
      body.className = 'ams-body';
      var lbl = document.createElement('div');
      lbl.className = 'ams-label';
      var lblSpan = document.createElement('span');
      lblSpan.textContent = 'Altitude Advisory';
      var elev = document.createElement('span');
      elev.className   = 'ams-elev';
      elev.textContent = cityData.elev;
      lbl.appendChild(lblSpan);
      lbl.appendChild(elev);
      var txt = document.createElement('div');
      txt.className = 'ams-text';
      if (raHref) {
        txt.appendChild(document.createTextNode(cityData.text + ' '));
        var a = document.createElement('a');
        a.href        = raHref;
        a.textContent = 'Read more';
        a.className   = 'ams-read-more';
        txt.appendChild(a);
      } else {
        txt.textContent = cityData.text;
      }
      body.appendChild(lbl);
      body.appendChild(txt);
      banner.appendChild(icon);
      banner.appendChild(body);
      ovSec.insertBefore(banner, extrasEl);
    }
    if (document.readyState !== 'loading') injectAltitudeBanner();
    else document.addEventListener('DOMContentLoaded', injectAltitudeBanner);
  }

  /* ── Best Of pages: stamp above terracotta line, arrows below it ─────────── */
  var isBestOf = /\/Trip-Essentials\/Best-/.test(location.pathname) && (prevHref || nextHref);
  if (isBestOf) {
    function injectBestOfArrows() {
      var header = document.querySelector('.page-header');
      if (!header) return;

      /* Move .updated-stamp inside .page-header so it sits right of the h1,
         above the terracotta border-bottom line */
      var stamp = document.querySelector('.updated-stamp');
      if (stamp) {
        stamp.style.cssText = 'font-size:11px;color:var(--muted);margin:0;' +
          'flex-shrink:0;padding-left:16px;align-self:flex-end;letter-spacing:0.01em;';
        header.appendChild(stamp);
      }

      /* Arrow row injected AFTER .page-header — visually below the terracotta line. */
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;' +
        'gap:12px;margin:6px 0 4px;';

      var bPrev = document.createElement('a');
      bPrev.href = prevHref || '#';
      bPrev.textContent = '‹';
      bPrev.setAttribute('aria-label', 'Previous Best Of');
      bPrev.style.cssText = btnStyle + 'flex-shrink:0;' + (prevHref ? '' : 'visibility:hidden;');

      /* Centre spacer — keeps prev/next pinned to opposite edges */
      var centre = document.createElement('div');
      centre.style.cssText = 'flex:1;padding-left:16px;';

      var bNext = document.createElement('a');
      bNext.href = nextHref || '#';
      bNext.textContent = '›';
      bNext.setAttribute('aria-label', 'Next Best Of');
      bNext.style.cssText = btnStyle + 'flex-shrink:0;' + (nextHref ? '' : 'visibility:hidden;');

      row.appendChild(bPrev);
      row.appendChild(centre);
      row.appendChild(bNext);
      /* Insert after .page-intro-card if present; otherwise fall back to after .page-header */
      var introCard = document.querySelector('.page-intro-card');
      var anchor = introCard || header;
      anchor.parentNode.insertBefore(row, anchor.nextSibling);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectBestOfArrows);
    } else {
      injectBestOfArrows();
    }
  }

  /* ── Scroll up / down fixed buttons (right side, all pages) ─────────────── */
  var scrollWrap = document.createElement('div');
  scrollWrap.className = 'tb-scroll-wrap';
  scrollWrap.style.cssText =
    'position:fixed;right:16px;top:50%;transform:translateY(-50%);' +
    'display:flex;flex-direction:column;align-items:center;gap:8px;z-index:150;';

  var scrollBtnBase /* locked 2026-06-16: width:30px height:30px */ =
    'display:flex;align-items:center;justify-content:center;' +
    'width:30px;height:30px;border-radius:6px;border:1.5px solid #c4b896;' +
    'background:#ffffff;cursor:pointer;padding:0;' +
    'box-shadow:0 1px 4px rgba(0,0,0,.10);' +
    'transition:background .15s,border-color .15s;';

  function makeScrollBtn(dir) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = scrollBtnBase;
    btn.setAttribute('aria-label', dir === 'up' ? 'Scroll to top' : 'Scroll to bottom');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '9');
    svg.setAttribute('viewBox', '0 0 14 9');
    svg.setAttribute('fill', 'none');
    var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', dir === 'up' ? '1,8 7,2 13,8' : '1,1 7,7 13,1');
    poly.setAttribute('stroke', '#6b6860');
    poly.setAttribute('stroke-width', '1.8');
    poly.setAttribute('stroke-linecap', 'round');
    poly.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(poly);
    btn.appendChild(svg);
    btn.addEventListener('click', function () {
      window.scrollTo({ top: dir === 'up' ? 0 : document.documentElement.scrollHeight, behavior: 'smooth' });
    });
    btn.addEventListener('mouseenter', function () {
      btn.style.background = acLt;
      btn.style.borderColor = accent;
      poly.setAttribute('stroke', accent);
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.background = '#ffffff';
      btn.style.borderColor = '#c4b896';
      poly.setAttribute('stroke', '#6b6860');
    });
    return btn;
  }

  if (window.innerWidth > 600) {
    var btnUp   = makeScrollBtn('up');
    var btnDown = makeScrollBtn('down');
    scrollWrap.appendChild(btnUp);
    scrollWrap.appendChild(btnDown);
    document.body.appendChild(scrollWrap);
  }

  /* Hide entirely on non-scrollable pages (e.g. maps); dim individual buttons at limits */
  function updateScrollBtns() {
    if (window.innerWidth <= 600 || !scrollWrap.parentNode) { return; }
    var scrollY   = window.scrollY;
    var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    var canScroll = maxScroll > 1;
    scrollWrap.style.display = canScroll ? 'flex' : 'none';
    if (canScroll) {
      var atTop    = scrollY <= 0;
      var atBottom = scrollY >= maxScroll - 1;
      btnUp.style.opacity        = atTop    ? '0.3' : '1';
      btnUp.style.pointerEvents  = atTop    ? 'none' : '';
      btnDown.style.opacity      = atBottom ? '0.3' : '1';
      btnDown.style.pointerEvents = atBottom ? 'none' : '';
    }
  }
  window.addEventListener('scroll', updateScrollBtns, { passive: true });
  window.addEventListener('resize', updateScrollBtns, { passive: true });
  requestAnimationFrame(function () { requestAnimationFrame(updateScrollBtns); });

  /* ── Reveal page — toolbar is now in the DOM, no layout shift visible ───── */
  requestAnimationFrame(function () {
    var hide = document.getElementById('_tbhide');
    if (hide) hide.parentNode.removeChild(hide);
    document.body.style.transition = 'opacity .12s';
    document.body.style.opacity    = '1';
  });

  /* ── Scroll active item into view — horizontal only, no window scroll ───── */
  var activeLink = inner.querySelector('.tb-active');
  if (activeLink) {
    setTimeout(function () {
      var offset = activeLink.offsetLeft - (scroller.offsetWidth - activeLink.offsetWidth) / 2;
      scroller.scrollLeft = Math.max(0, offset);
    }, 50);
  }

  /* ── Last-updated stamp — all pages ─────────────────────────────────────
     Source: the EXPLICIT data-updated="YYYY-MM" or "YYYY-MM-DD" attribute on
     toolbar-mount — NOT document.lastModified (which bumps on every file touch).
     Guide pages: injects a .title-updated div into .title-page (near top), then
       repositionUpdatedStamp() moves it to after the LAST section on the page (bottom).
     Non-guide pages: injects .title-updated at the END of body — always the
       true visual bottom even on stats pages where .wrap closes early. Style
       and mobile padding are set inline; no separate repositioning needed.
     No attribute → no stamp (silent). Spec: Brain/Reference/Toolbar.html § 10. */
  var _updated = mount ? (mount.dataset.updated || '') : '';
  if (_updated) {
    var _MONTHS = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];
    function _injectUpdated() {
      var mFull  = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(_updated);
      var mShort = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(_updated);
      var yr, mo, dy;
      if (mFull)       { yr = +mFull[1];  mo = +mFull[2];  dy = +mFull[3]; }
      else if (mShort) { yr = +mShort[1]; mo = +mShort[2]; dy = null; }
      else             { return; }
      if (yr <= 2000 || mo < 1 || mo > 12) return;
      var el = document.createElement('div');
      el.className = 'title-updated';
      el.textContent = dy
        ? 'Updated ' + _MONTHS[mo - 1] + ' ' + dy + ', ' + yr
        : 'Updated ' + _MONTHS[mo - 1] + ' ' + yr;
      var tp = document.querySelector('.title-page');
      if (tp) {
        tp.appendChild(el);
      } else {
        /* Non-guide pages: inject at end of body so the stamp always lands at
           the true visual bottom (stats pages close .wrap early). padding-left
           is set via inline style; mobile override injected as a <style> tag. */
        el.style.cssText = 'display:block;font-size:11px;color:#9a948a;margin:0 0 20px;padding-left:32px;text-align:left;';
        document.body.appendChild(el);
        /* Mobile: shrink padding-left to match .wrap mobile gutter (14px). */
        if (!document.getElementById('tve-stamp-mobile-style')) {
          var mst = document.createElement('style');
          mst.id = 'tve-stamp-mobile-style';
          mst.textContent = '@media (max-width:600px){body>.title-updated{padding-left:14px!important}}';
          document.head.appendChild(mst);
        }
      }
      /* No-entries footnote: lists sections omitted for having no qualifying
         content. Source: data-no-entries on toolbar-mount (comma-separated).
         Spec: Brain/Reference/Toolbar.html § 10. */
      var _neRaw = mount ? (mount.dataset.noEntries || '') : '';
      if (_neRaw) {
        var _neEl = document.createElement('div');
        _neEl.className = 'title-no-entries';
        _neEl.textContent = 'No entries for: ' + _neRaw.split(',').map(function(s) { return s.trim(); }).filter(Boolean).join(' \xb7 ');
        if (tp) {
          tp.appendChild(_neEl);
        } else {
          _neEl.style.cssText = 'display:block;font-size:10.5px;color:#c0bbb5;margin:-18px 0 20px;padding-left:32px;text-align:left;';
          document.body.appendChild(_neEl);
          if (!document.getElementById('tve-no-entries-mobile-style')) {
            var _nmst = document.createElement('style');
            _nmst.id = 'tve-no-entries-mobile-style';
            _nmst.textContent = '@media (max-width:600px){body>.title-no-entries{padding-left:14px!important}}';
            document.head.appendChild(_nmst);
          }
        }
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _injectUpdated);
    } else {
      _injectUpdated();
    }
  }

  /* ── Calendar (.ics) export — guide pages only ────────────────────────────
     Injects an "Export to Calendar" button between the day pills and the
     extras row in the Trip Overview. Clicking opens a date picker for Day 1;
     on confirm it downloads an .ics file with one all-day VEVENT per guide
     day, each pre-filled with that day's stop list from .stop-name elements.
     Entirely client-side — no backend, no accounts. */
  function _injectICSExport() {
    var overviewDays = document.querySelectorAll('.overview-day');
    if (!overviewDays.length) return;

    var cityEl = document.querySelector('.title-city');
    var city = cityEl ? cityEl.textContent.trim() : (document.title || 'Trip');

    var dayBlocks = document.querySelectorAll('.day-block[id^="day"]');
    if (!dayBlocks.length) return;

    var days = [];
    [].forEach.call(dayBlocks, function (block) {
      var num = parseInt((block.id || '').replace('day', ''), 10);
      if (isNaN(num) || num < 1) return;
      var hEl = block.querySelector('.day-header');
      var header = hEl ? hEl.textContent.trim() : 'Day ' + num;
      var stops = [];
      [].forEach.call(block.querySelectorAll('.stop-block'), function (sb) {
        var nameEl = sb.querySelector('.stop-name');
        var name = nameEl ? nameEl.textContent.trim() : '';
        if (!name) return;
        var stopDesc = '', stopAddr = '', stopAddrHref = '';
        var stopHours = '', stopDuration = '', stopWarning = '', stopTicketUrl = '';
        [].forEach.call(sb.querySelectorAll('.stop-row'), function (row) {
          var txt = row.textContent.trim();
          var mapsEl = row.querySelector('a[href*="google.com/maps"], a[href*="maps.google.com"]');
          if (!stopAddr && mapsEl) {
            stopAddr = mapsEl.textContent.trim();
            stopAddrHref = mapsEl.href;
          } else if (!stopDesc && !txt.startsWith('📖')) {
            stopDesc = txt;
          }
        });
        /* Ticket/tour box rows (plain divs, not .stop-row) — hours, duration, warnings, ticket */
        [].forEach.call(sb.querySelectorAll('.ticket-box > div, .tour-box > div'), function (div) {
          var txt = div.textContent.trim();
          var first = txt.charAt(0);
          if (!stopHours && (first === '🏛' || txt.slice(0,2) === '🏛')) {
            stopHours = txt;
          } else if (!stopDuration && (first === '⏰' || txt.slice(0,2) === '⏰')) {
            stopDuration = txt;
          } else if (!stopWarning && (first === '⚠' || txt.slice(0,2) === '⚠')) {
            stopWarning = txt;
          } else if (!stopTicketUrl) {
            var ticketLink = div.querySelector('a[href]:not([href*="google.com/maps"])');
            if (ticketLink && (txt.slice(0,2) === '🎟' || txt.charAt(0) === '🎟')) {
              stopTicketUrl = ticketLink.href;
            }
          }
        });
        stops.push({ name: name, desc: stopDesc, addr: stopAddr, href: stopAddrHref,
                     hours: stopHours, duration: stopDuration, warning: stopWarning, ticketUrl: stopTicketUrl });
      });
      days.push({ num: num, header: header, stops: stops });
    });
    if (!days.length) return;
    days.sort(function (a, b) { return a.num - b.num; });

    /* ── Date picker overlay ─────────────────────────────────────────────── */
    var overlay = document.createElement('div');
    overlay.style.cssText =
      'display:none;position:fixed;inset:0;z-index:2000;' +
      'background:rgba(0,0,0,.42);align-items:center;justify-content:center;';

    var box = document.createElement('div');
    box.style.cssText =
      'position:relative;background:#fff;border-radius:12px;padding:26px 26px 20px;' +
      'max-width:320px;width:90vw;box-shadow:0 12px 40px rgba(0,0,0,.22);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
    /* Stop touches inside the box from bubbling to the overlay backdrop */
    box.addEventListener('click', function (e) { e.stopPropagation(); });
    box.addEventListener('touchend', function (e) { e.stopPropagation(); });

    var xBtn = document.createElement('button');
    xBtn.type = 'button'; xBtn.textContent = '✕';
    xBtn.style.cssText =
      'position:absolute;top:12px;right:14px;background:none;border:none;' +
      'font-size:13px;color:#7a7068;cursor:pointer;line-height:1;padding:4px;font-family:inherit;';

    var bTitle = document.createElement('div');
    bTitle.style.cssText = 'margin-bottom:5px;padding-right:28px;';
    var bTitleText = document.createElement('span');
    bTitleText.textContent = '📅 Export to Calendar';
    bTitleText.style.cssText = 'font-size:15px;font-weight:700;color:#1b2531;';
    bTitle.appendChild(bTitleText);

    var bSub = document.createElement('div');
    bSub.textContent = 'When does Day 1 start? All ' + days.length +
      ' day' + (days.length === 1 ? '' : 's') + ' will be added to your calendar.';
    bSub.style.cssText = 'font-size:13px;color:#5b636f;margin-bottom:16px;line-height:1.45;';

    var dateInput = document.createElement('input');
    dateInput.type = 'date';
    var _icsD = new Date(); _icsD.setDate(_icsD.getDate() + 1);
    dateInput.value = _icsD.getFullYear() + '-' +
      ('0' + (_icsD.getMonth() + 1)).slice(-2) + '-' + ('0' + _icsD.getDate()).slice(-2);
    dateInput.style.cssText =
      'width:100%;padding:9px 11px;border:1.5px solid #c8a44a;border-radius:6px;' +
      'font-size:16px;font-family:inherit;box-sizing:border-box;margin-bottom:18px;' +
      'color:#1b2531;-webkit-text-fill-color:#1b2531;background:#fff;' +
      'text-align:center;text-align-last:center;direction:ltr;touch-action:manipulation;';
    dateInput.addEventListener('focus', function () {
      dateInput.style.setProperty('-webkit-text-fill-color', '#1b2531', 'important');
      dateInput.style.setProperty('color', '#1b2531', 'important');
    });
    dateInput.addEventListener('blur', function () {
      dateInput.style.setProperty('-webkit-text-fill-color', '#1b2531', 'important');
      dateInput.style.setProperty('color', '#1b2531', 'important');
    });

    var bRow = document.createElement('div');
    bRow.style.cssText = 'display:flex;gap:10px;';

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button'; cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText =
      'flex:1;padding:8px 14px;border:1.5px solid #ccc;border-radius:6px;' +
      'background:#fff;font-size:13px;color:#5b636f;cursor:pointer;font-family:inherit;font-weight:500;';

    var dlBtn = document.createElement('button');
    dlBtn.type = 'button'; dlBtn.textContent = '↓ Download .ics';
    dlBtn.style.cssText =
      'flex:1;padding:8px 16px;border:none;border-radius:6px;' +
      'background:#b85c2a;' +
      'font-size:13px;font-weight:700;color:#7a3b1e;cursor:pointer;font-family:inherit;';

    function _closeICS() { overlay.style.display = 'none'; document.body.style.overflow = ''; }
    /* No click-outside-to-close: on iOS the native date picker dismissal
       fires a tap on the overlay backdrop, which would close the modal
       before the user can pick a date. Close only via X or Cancel. */
    xBtn.addEventListener('click', _closeICS);
    cancelBtn.addEventListener('click', _closeICS);

    dlBtn.addEventListener('click', function () {
      var v = dateInput.value; if (!v) return;
      var p = v.split('-');
      var base = new Date(+p[0], +p[1] - 1, +p[2]);

      function _pad(n) { return n < 10 ? '0' + n : '' + n; }
      function _fmtDate(d) { return '' + d.getFullYear() + _pad(d.getMonth() + 1) + _pad(d.getDate()); }
      function _esc(s) {
        return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;')
                .replace(/,/g, '\\,').replace(/\n/g, '\\n');
      }
      var _ts = new Date().getTime();
      var out = [
        'BEGIN:VCALENDAR', 'VERSION:2.0',
        'PRODID:-//Guide My Days//Guide Calendar//EN',
        'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      ];
      days.forEach(function (day, i) {
        var d0 = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
        var d1 = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i + 1);
        var summary = _esc(day.header + (day.header.indexOf(city) >= 0 ? '' : ' · ' + city));
        var descParts = [];
        day.stops.forEach(function (s, si) {
          var lines = ['▸ ' + (si + 1) + '. ' + s.name.toUpperCase()];
          if (s.desc) lines.push(s.desc);
          /* Location block */
          var hasLoc = s.addr || s.href;
          if (hasLoc) lines.push('');
          if (s.addr) lines.push('📍 ' + s.addr);
          if (s.href) lines.push(s.href);
          /* Practical info block */
          var hasPractical = s.hours || s.duration || s.ticketUrl || s.warning;
          if (hasPractical) lines.push('');
          if (s.hours) lines.push(s.hours);
          if (s.duration) lines.push(s.duration);
          if (s.ticketUrl) lines.push('🎟️ ' + s.ticketUrl);
          if (s.warning) lines.push(s.warning);
          descParts.push(lines.join('\n'));
        });
        var desc = descParts.length ? _esc(descParts.join('\n\n')) : '';
        out.push('BEGIN:VEVENT');
        out.push('UID:' + _ts + '-day' + day.num + '@voyager-expert');
        out.push('DTSTART;VALUE=DATE:' + _fmtDate(d0));
        out.push('DTEND;VALUE=DATE:' + _fmtDate(d1));
        out.push('SUMMARY:' + summary);
        if (desc) out.push('DESCRIPTION:' + desc);
        out.push('END:VEVENT');
      });
      out.push('END:VCALENDAR');

      var icsContent = out.join('\r\n');
      var filename = city.toLowerCase().replace(/\s+/g, '-') + '-trip.ics';
      var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      var blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      _closeICS();
      if (isIOS) {
        /* iOS: navigate to blob URL without download attribute — Safari detects
           text/calendar MIME and routes to Calendar "Add to Calendar" prompt.
           The download attribute caused a share sheet instead; data: URIs are
           blocked by WebKit navigation policy. */
        window.location.href = url;
      } else {
        var a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 1500);
      }
    });

    bRow.appendChild(cancelBtn); bRow.appendChild(dlBtn);
    box.appendChild(xBtn); box.appendChild(bTitle); box.appendChild(bSub);
    box.appendChild(dateInput); box.appendChild(bRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    /* ── Trigger link — <a> matches the other pills exactly, terracotta border only ── */
    var trigBtn = document.createElement('a');
    trigBtn.href = 'javascript:void(0)';
    trigBtn.textContent = '📅 Export to Calendar';
    trigBtn.className = 'overview-extra-link';
    trigBtn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      document.body.style.overflow = 'hidden'; /* prevent iOS scroll-jump on date input focus */
      overlay.style.display = 'flex';
      /* Auto-focus the date input so iOS shows the native picker immediately
         without requiring a second tap (fixed-overlay inputs need the extra nudge) */
      setTimeout(function () { dateInput.focus(); }, 80);
    });

    /* Pull All Stops Map out of .overview-extras and place both terracotta
       pills on their own row above the rest of the extras chips.
       Use a <style> rule with IDs + !important to guarantee terracotta
       overrides any class/pseudo-class CSS on mapPill once it moves context. */
    var lastDay = overviewDays[overviewDays.length - 1];
    var extras = lastDay.parentNode.querySelector('.overview-extras');
    if (extras) {
      var mapPill = extras.querySelector('a[href*="stops-map"]');
      if (mapPill) mapPill.parentNode.removeChild(mapPill);

      /* pillRow uses overview-extras class so both pills inherit all chip CSS */
      var pillRow = document.createElement('div');
      pillRow.className = 'overview-extras';
      pillRow.id = 'ics-pill-row';
      pillRow.setAttribute('style', 'display:flex;gap:0;margin-bottom:16px;width:100%;');
      trigBtn.id = 'ics-cal-pill';
      if (mapPill) mapPill.id = 'ics-map-pill';

      /* Inline !important beats every stylesheet rule (ID selectors, class rules,
         mobile overrides) — CSS attribute-selector approach loses specificity on
         mobile and leaves the pill right-aligned. Desktop unaffected. */
      function _flexPill(el) {
        el.style.setProperty('flex', '1 1 0', 'important');
        el.style.setProperty('min-width', '0', 'important');
        el.style.setProperty('align-items', 'center', 'important');
        el.style.setProperty('justify-content', 'center', 'important');
        el.style.setProperty('text-align', 'center', 'important');
      }
      _flexPill(trigBtn);
      if (mapPill) _flexPill(mapPill);
      pillRow.appendChild(trigBtn);
      if (mapPill) pillRow.appendChild(mapPill);

      /* tve-pressed: iOS doesn't reliably fire :active on touch — add/remove
         the class on touchstart/touchend so the white-text active style shows */
      function _addTvePress(el) {
        el.addEventListener('touchstart', function () {
          el.classList.add('tve-pressed');
          el.style.setProperty('color', '#fff', 'important');
          el.style.setProperty('-webkit-text-fill-color', '#fff', 'important');
        }, { passive: true });
        el.addEventListener('touchend', function () {
          setTimeout(function () {
            el.classList.remove('tve-pressed');
            el.style.removeProperty('color');
            el.style.removeProperty('-webkit-text-fill-color');
          }, 300);
        }, { passive: true });
        el.addEventListener('touchcancel', function () {
          el.classList.remove('tve-pressed');
          el.style.removeProperty('color');
          el.style.removeProperty('-webkit-text-fill-color');
        }, { passive: true });
      }
      _addTvePress(trigBtn);
      if (mapPill) _addTvePress(mapPill);
      extras.parentNode.insertBefore(pillRow, extras);
    } else {
      lastDay.parentNode.appendChild(trigBtn);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectICSExport);
  } else {
    _injectICSExport();
  }


  /* ── Stop duration chip — surfaces ⏰ value from each stop's box into header ──
     For every .stop-block on a real guide page:
       1. Find the ⏰ ~XX div inside .tour-box or .ticket-box
       2. Extract the duration string (e.g. "~30 min", "~1.5 h")
       3. Set display:flex on .stop-header so margin-left:auto can right-align the chip
       4. Append <span class="stop-dur"> with the value
       5. Remove the source ⏰ div (cosmetic — the data was read first)
     Stops without a ⏰ row are silently skipped (no chip, no layout change).
     CSS for .stop-dur lives in guide-style.css. */
  function _injectStopDuration() {
    if (!isRealGuide) return;
    var blocks = document.querySelectorAll('.stop-block');
    if (!blocks.length) return;
    [].forEach.call(blocks, function (sb) {
      var durDiv = null, durText = '';
      [].forEach.call(sb.querySelectorAll('.tour-box > div, .ticket-box > div'), function (div) {
        if (durDiv) return;
        var txt = div.textContent.trim();
        var first = txt.charAt(0);
        if (first === '⏰' || txt.slice(0, 2) === '⏰') {
          durDiv = div;
          durText = txt.replace(/^⏰\s*/, '').trim();
        }
      });
      if (!durDiv || !durText) return;
      var header = sb.querySelector('.stop-header');
      if (!header) return;
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      var nameEl = header.querySelector('.stop-name');
      if (nameEl) nameEl.style.flex = '1';
      var chip = document.createElement('span');
      chip.className = 'stop-dur';
      chip.textContent = durText;
      header.appendChild(chip);
      durDiv.parentNode.removeChild(durDiv);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectStopDuration);
  } else {
    _injectStopDuration();
  }


  /* ── Destination timezone map (guide folder slug → IANA) ─────────────────
     Module scope: both _upgradeStopHours and _injectOpenNowStatus read it. */
  var _TVE_TZ = {
    'abu-dhabi':'Asia/Dubai','aix-en-provence':'Europe/Paris',
    'alaska':'America/Anchorage','alesund':'Europe/Oslo',
    'amalfi':'Europe/Rome','amsterdam':'Europe/Amsterdam',
    'annecy':'Europe/Paris','aracaju':'America/Fortaleza',
    'arenal':'America/Costa_Rica','aruba':'America/Aruba',
    'athens':'Europe/Athens','atlanta':'America/New_York',
    'austin':'America/Chicago','azores':'Atlantic/Azores',
    'bahamas':'America/Nassau','bali':'Asia/Makassar',
    'banff':'America/Edmonton','bangkok':'Asia/Bangkok',
    'barbados':'America/Barbados','barcelona':'Europe/Madrid',
    'beijing':'Asia/Shanghai','bend':'America/Los_Angeles',
    'bergen':'Europe/Oslo','berlin':'Europe/Berlin',
    'bhutan':'Asia/Thimphu','big-island':'Pacific/Honolulu',
    'bilbao':'Europe/Madrid','bologna':'Europe/Rome',
    'bora-bora':'Pacific/Tahiti','bordeaux':'Europe/Paris',
    'boston':'America/New_York','boulder':'America/Denver',
    'bruges':'Europe/Brussels','brussels':'Europe/Brussels',
    'budapest':'Europe/Budapest',
    'buenos-aires':'America/Argentina/Buenos_Aires',
    'buenos aires':'America/Argentina/Buenos_Aires',
    'cairo':'Africa/Cairo','cambridge':'Europe/London',
    'cancun':'America/Cancun','cannes':'Europe/Paris',
    'cape-cod':'America/New_York','cape-town':'Africa/Johannesburg',
    'capri':'Europe/Rome','carmel-by-the-sea':'America/Los_Angeles',
    'cascais':'Europe/Lisbon','cayman-islands':'America/Cayman',
    'charlotte':'America/New_York','chiang-mai':'Asia/Bangkok',
    'chicago':'America/Chicago','chongqing':'Asia/Shanghai',
    'cinque-terre':'Europe/Rome','coeur-dalene':'America/Los_Angeles',
    'colmar':'Europe/Paris','cologne':'Europe/Berlin',
    'colombo':'Asia/Colombo','columbia':'America/New_York',
    'copenhagen':'Europe/Copenhagen','corfu':'Europe/Athens',
    'crete':'Europe/Athens','curacao':'America/Curacao',
    'curitiba':'America/Sao_Paulo','cusco':'America/Lima',
    'dallas':'America/Chicago','denver':'America/Denver',
    'doha':'Asia/Qatar','dubai':'Asia/Dubai',
    'dublin':'Europe/Dublin','dubrovnik':'Europe/Zagreb',
    'edinburgh':'Europe/London','florence':'Europe/Rome',
    'florianopolis':'America/Sao_Paulo',
    'florida keys':'America/New_York',
    'florida-keys':'America/New_York',
    'fortaleza':'America/Fortaleza',
    'foz-do-iguaçu':'America/Sao_Paulo',
    'frankfurt':'Europe/Berlin',
    'galapagos-islands':'Pacific/Galapagos',
    'geneva':'Europe/Zurich',
    'glacier-national-park':'America/Denver',
    'glasgow':'Europe/London','gothenburg':'Europe/Stockholm',
    'granada':'Europe/Madrid','hamburg':'Europe/Berlin',
    'hanoi':'Asia/Bangkok','helsinki':'Europe/Helsinki',
    'hilton-head-island':'America/New_York',
    'hiroshima':'Asia/Tokyo','hoi-an':'Asia/Bangkok',
    'hong-kong':'Asia/Hong_Kong','istanbul':'Europe/Istanbul',
    'joão-pessoa':'America/Fortaleza',
    'kauai':'Pacific/Honolulu','keywest':'America/New_York',
    'kotor':'Europe/Belgrade','kraków':'Europe/Warsaw',
    'kyoto':'Asia/Tokyo','la-jolla':'America/Los_Angeles',
    'lagos':'Africa/Lagos','lake-como':'Europe/Rome',
    'lake-tahoe':'America/Los_Angeles','las-vegas':'America/Los_Angeles',
    'lecce':'Europe/Rome','lille':'Europe/Paris',
    'lima':'America/Lima','lisbon':'Europe/Lisbon',
    'ljubljana':'Europe/Ljubljana','london':'Europe/London',
    'los-angeles':'America/Los_Angeles','los-cabos':'America/Mazatlan',
    'luang-prabang':'Asia/Vientiane','lucerne':'Europe/Zurich',
    'luxembourg':'Europe/Luxembourg','lyon':'Europe/Paris',
    'maceió':'America/Maceio','machupicchu':'America/Lima',
    'madeira':'Atlantic/Madeira','madrid':'Europe/Madrid',
    'malaga':'Europe/Madrid','maldives':'Indian/Maldives',
    'malibu':'America/Los_Angeles',
    'manuel-antonio':'America/Costa_Rica',
    'marco-island':'America/New_York',
    'marktoberdorf':'Europe/Berlin',
    'marrakech':'Africa/Casablanca',
    'marseille':'Europe/Paris','maui':'Pacific/Honolulu',
    'melbourne':'Australia/Melbourne','miami':'America/New_York',
    'milan':'Europe/Rome','monaco':'Europe/Paris',
    'montevideo':'America/Montevideo','montreal':'America/Toronto',
    'munich':'Europe/Berlin','muscat':'Asia/Muscat',
    'mykonos':'Europe/Athens','napa':'America/Los_Angeles',
    'naples':'Europe/Rome','naples-florida':'America/New_York',
    'nashville':'America/Chicago','natal':'America/Fortaleza',
    'new-orleans':'America/Chicago','new-york':'America/New_York',
    'nice':'Europe/Paris','oahu':'Pacific/Honolulu',
    'oaxaca':'America/Mexico_City','olinda':'America/Recife',
    'orcas-island':'America/Los_Angeles','orlando':'America/New_York',
    'osaka':'Asia/Tokyo','oslo':'Europe/Oslo',
    'oxford':'Europe/London','palawan':'Asia/Manila',
    'palm-desert':'America/Los_Angeles','palo-alto':'America/Los_Angeles',
    'paris':'Europe/Paris','pasadena':'America/Los_Angeles',
    'pensacola':'America/Chicago','petra':'Asia/Amman',
    'philadelphia':'America/New_York','phoenix':'America/Phoenix',
    'phuket':'Asia/Bangkok','pisa':'Europe/Rome',
    'pokhara':'Asia/Kathmandu','portland':'America/Los_Angeles',
    'porto':'Europe/Lisbon','porto-alegre':'America/Sao_Paulo',
    'prague':'Europe/Prague','puerto-rico':'America/Puerto_Rico',
    'puerto-vallarta':'America/Mazatlan',
    'quebec-city':'America/Toronto','queenstown':'Pacific/Auckland',
    'recife':'America/Recife','reykjavik':'Atlantic/Reykjavik',
    'rhodes':'Europe/Athens','rio-de-janeiro':'America/Sao_Paulo',
    'rome':'Europe/Rome','salvador':'America/Bahia',
    'salzburg':'Europe/Vienna','san-diego':'America/Los_Angeles',
    'san-francisco':'America/Los_Angeles',
    'san-jose':'America/Los_Angeles',
    'san-jose-costa-rica':'America/Costa_Rica',
    'san-juan-island':'America/Los_Angeles',
    'san-sebastian':'Europe/Madrid',
    'santa-barbara':'America/Los_Angeles',
    'santa-cruz':'America/Los_Angeles',
    'santa-fe':'America/Denver','santa-monica':'America/Los_Angeles',
    'santiago':'America/Santiago','santorini':'Europe/Athens',
    'sarasota':'America/New_York','sardinia':'Europe/Rome',
    'scottsdale':'America/Phoenix','seattle':'America/Los_Angeles',
    'sedona':'America/Phoenix','seoul':'Asia/Seoul',
    'seville':'Europe/Madrid','seychelles':'Indian/Mahe',
    'shanghai':'Asia/Shanghai','sicily':'Europe/Rome',
    'siena':'Europe/Rome','singapore':'Asia/Singapore',
    'sint-maarten':'America/Lower_Princes',
    'sintra':'Europe/Lisbon','sorrento':'Europe/Rome',
    'split':'Europe/Zagreb','stockholm':'Europe/Stockholm',
    'strasbourg':'Europe/Paris','stuttgart':'Europe/Berlin',
    'sydney':'Australia/Sydney',
    'são-luís':'America/Fortaleza','são-paulo':'America/Sao_Paulo',
    'taipei':'Asia/Taipei','tallinn':'Europe/Tallinn',
    'tbilisi':'Asia/Tbilisi','tenerife':'Atlantic/Canary',
    'tokyo':'Asia/Tokyo','toledo':'Europe/Madrid',
    'toronto':'America/Toronto','tromso':'Europe/Oslo',
    'turin':'Europe/Rome','turks-and-caicos':'America/Grand_Turk',
    'valletta':'Europe/Malta','vancouver':'America/Vancouver',
    'venice':'Europe/Rome','verona':'Europe/Rome',
    'victoria':'America/Vancouver','vienna':'Europe/Vienna',
    'virgin-islands':'America/St_Thomas',
    'washington-dc':'America/New_York',
    'wellington':'Pacific/Auckland','whistler':'America/Vancouver',
    'yellowstone':'America/Denver','zakynthos':'Europe/Athens',
    'zhangjiajie':'Asia/Shanghai','zurich':'Europe/Zurich'
  };

  /* ── Destination weekday + clock (shared) ────────────────────────────────────
     Resolves the destination timezone from data-timezone on #toolbar-mount, or
     failing that the Guides/{City}/ folder slug, and reports the weekday index
     and formatted time for THAT city — never the reader's own clock. A guide is
     read weeks before the trip and often from another continent, so "today" has
     to mean today at the destination or it means nothing. `local` is false when
     no timezone could be resolved; callers suppress the today marker then rather
     than showing the reader's own weekday. Shared by the stop-hours injection
     and the Open Now filter. */
  function _tveDestNow() {
    var parts = location.pathname.split('/');
    var gi    = parts.indexOf('Guides');
    var slug  = gi >= 0 && parts[gi + 1] ? parts[gi + 1].toLowerCase() : '';
    var tz    = (mount && mount.dataset && mount.dataset.timezone) || _TVE_TZ[slug] || '';
    var now   = new Date();
    var out   = { dow: now.getDay(), tz: tz, local: false, time: '' };
    if (!tz) return out;
    try {
      var DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      var d = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(now);
      if (DOW[d] !== undefined) { out.dow = DOW[d]; out.local = true; }
      out.time = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true
      }).format(now);
    } catch (err) { /* Intl or tz unsupported → marker suppressed by local:false */ }
    return out;
  }


  /* ── Stop hours — collapsed row, hover-expand week schedule ──────────────────
     Every guide already writes opening hours as a structured 🏛️ row inside the
     stop's .tour-box / .ticket-box, in one consistent authored shape:

         🏛️ Daily 9:00am - 4:00pm
         🏛️ Open 24/7
         🏛️ Tuesday - Sunday 10:00am - 5:00pm
         🏛️ Monday - Saturday 8:30am - 6:00pm · Sunday 1:00pm - 6:00pm

     Segments are separated by " · ". This pass UPGRADES those rows — it reads
     only authored data and never parses narrative prose. (An earlier version
     parsed stop prose instead and skipped any stop that already had a 🏛️ row;
     since 235/235 guides carry 🏛️ rows on essentially every stop, it matched
     nothing anywhere on the site.)

       · one segment  → left exactly as authored. A chevron that expands to a
                        single line is a lie, so simple rows get no affordance.
       · 2+ segments  → the authored row is hidden and replaced by a collapsed
                        row naming TODAY, expanding on hover (pointer devices)
                        or tap / Enter / Space to a Mon–Sun grid.

     Days absent from the listing render as Closed — an hours listing that names
     Tuesday–Sunday is universally read as "shut on Monday".

     🔒 Coupling with the Open Now filter: that filter reads the FIRST
     .tour-box/.ticket-box child whose text starts with 🏛 and parses it. The
     authored row is therefore kept in the DOM (hidden with .tve-ph-src, which
     leaves textContent intact) and the replacement row starts with 🕐, not 🏛,
     so the filter still resolves to the authored string either way.

     "Today" comes from _tveDestNow() — the DESTINATION's weekday, never the
     reader's; a guide is read weeks ahead and often from another continent.
     When no timezone resolves the marker is suppressed rather than shown
     against the wrong day. Zero guide HTML changes — toolbar.js only. */
  function _upgradeStopHours() {
    if (!isRealGuide) return;
    var srcRows = [];
    [].forEach.call(document.querySelectorAll('.tour-box > div, .ticket-box > div'), function (d) {
      if (d.textContent.trim().slice(0, 2) === '🏛') srcRows.push(d);
    });
    if (!srcRows.length) return;

    /* ── CSS — injected once per page load ─────────────────────────────────── */
    if (!document.getElementById('tve-ph-css')) {
      var _phCss = document.createElement('style');
      _phCss.id = 'tve-ph-css';
      _phCss.textContent =
        /* ── Palette ──────────────────────────────────────────────────────────
           Site tokens only — no green, no blue. The guide palette is warm:
           --c-warm-bg #fdf8f0 is "the single shared background — all section
           cards, boxes, banners", #b85c2a is the brand terracotta, and the
           transit-banner pair (--c-next-bg #f5f0e6 / --c-next-border #bba070)
           is the one other warm tone already in use. So:
             terracotta rail = a specific schedule
             tan-gold rail   = open around the clock
           Dark mode uses the palette's own warm gold #c8a060, which the tokens
           declare is "only ever a foreground — never a fill", so it is used for
           rails, text and borders and never as a background. */
        /* Base row */
        /* HORIZONTAL — the band is a FULL-BLEED strip. Its negative side margins
           cancel the card's 14px padding, so the rail sits flush to the card edge
           and the 🕐 lands on exactly the same x as every other icon row in the
           card (🎟️ ⚠️ 🚫 📍). Inset by 10px inside the content column the glyph
           sat 12.5px right of that column and the icon run visibly stepped in and
           back out on every stop (owner report 2026-08-08, "look the spaces it is
           a mess all over the place"). border-left(2.5) + padding-left(11.5) = the
           card's own 14px gutter, which is what puts the text back on the column.
           These two numbers are the DESKTOP default only — the card drops to
           `padding: 10px 12px` at the mobile breakpoint (guide-style.css § mobile),
           so _phFit() re-reads the real padding off the card and overrides both at
           runtime. Hardcoding 14 hung the band 2px off each edge at 393px.
           VERTICAL — with option G (no fill, 2026-08-08) the band is spaced as
           what it now IS: a text row with a rail. Its ink is its TEXT, not a box
           edge, so it takes the card's ordinary 6px row margin, no padding, and
           nothing special at the first/last row — every number here is the card
           default, which is the least driftable outcome available. While the
           band carried a fill the model was the opposite and the numbers below
           were 9.125 / 3.125 / 3.125, because a tint HAS no leading and had to
           supply it from margin. Kept for the next reader: restoring any fill
           means restoring those numbers with it, or the band lands 6px off the
           card's 12.25 constant (measured 18.25 the moment the fill came off
           while the tint-model spacing was still in place).
           HISTORICAL — the card's row gap is 6px, and the tint model SPLIT it: 3px of
           padding inside the tint, 3px of margin outside it, top and bottom. That
           is the whole fix. Two earlier attempts each moved all 6px to one side
           and each was rejected: 6px margin + 6px padding put the band's text 12px
           from its neighbour's while every other pair sat at 6px (the band became
           the odd row out, 35px pitch against 29px), and 0 margin + 6px padding
           kept the pitch right but let the tint run edge-to-edge into the rows
           above and below with no clear space at all — owner, 2026-08-08, on a
           screenshot of this exact card. 3+3 is the only split that satisfies both
           constraints at once: margin+padding still totals the 6px the rhythm
           needs, so every text row in the card stays on one 29.25px grid, and the
           tint now ends 3px short of that gap on each side so it reads as its own
           object rather than a stripe wedged between two lines. Line-height is
           1.55 to match `.tour-box > div` exactly — at 1.45 the band was 1.5px
           short and threw the two pitches around it to 28.4 / 28.9. */
        /* NO FILL — owner pick G, 2026-08-08, from a seven-option sheet rendered
           on the real card. The band had carried #fdf8f0, which is the SAME HEX
           as the .day-block behind the stop card (page #f5f4f0, day #fdf8f0,
           card #f5f0e6, band #fdf8f0). A fill identical to the layer two levels
           behind it does not read as a strip laid on the card — it reads as a
           hole cut through the card, which is why every earlier attempt to fix
           this by changing the RAIL colour felt wrong: the rail was never the
           problem. Dropping the fill sidesteps the collision entirely and the
           row reads as a marked row rather than a strip. The rail moves to brand
           terracotta #b85c2a and the ink to #7a3b1e, which is what the option
           sheet showed; the chevron follows the same pair with a transparent
           chip. Do not restore a background here without re-checking it against
           BOTH #f5f0e6 and #fdf8f0 — the two layers it sits between. */
        /* RIGHT EDGE — with no fill this hairline and the rail are the only
           marks of where the band ends, which is what shows it stopping at the
           background (#faf7f2), so with only a left rail the slab had no visible
           end: on desktop it read as trailing off into the middle of the page
           instead of stopping at the card edge. The hairline closes it. Same
           tint as .tve-ph-hr so the band, its divider and its panel agree. */
        '.tve-ph{border-left:2.5px solid #b85c2a;' +
        'border-right:1px solid rgba(187,160,112,.45);background:transparent;color:#7a3b1e;' +
        'font-weight:500;padding:0 14px 0 11.5px;border-radius:0;' +
        'margin:6px -14px 0;line-height:1.55;font-size:inherit;}' +
        /* Scoping to the card is what wins the specificity fight —
           .tour-box > div (0,1,1) outranks .tve-ph (0,1,0). */
        /* 3px above the tint — the outer half of the 6px gap (see the base rule).
           The scoped selector is what wins the specificity fight against
           `.tour-box > div` (0,1,1) beating `.tve-ph` (0,1,0). */
        '.tour-box > .tve-ph,.ticket-box > .tve-ph,' +
        '.tour-box > .tve-ph-wrap,.ticket-box > .tve-ph-wrap{' +
        'margin:6px -14px 0!important;}' +
        /* The row AFTER the band contributes the other outer half: 3px, not the
           card's usual 6px, because the band's own 3px padding-bottom already
           carries the inner half. Leaving 6px here stacks to 9px and the band
           sits low in its slot. */
        '.tour-box > .tve-ph + *,.ticket-box > .tve-ph + *,' +
        '.tour-box > .tve-ph-wrap + *,.ticket-box > .tve-ph-wrap + *{' +
        'margin-top:6px!important;}' +
        /* First VISIBLE row of the card. The authored 🏛️ rows the band replaces
           stay in the DOM as display:none, so :first-child never matches it — JS
           stamps this class instead. 2,127 cards across the fleet lead with 🏛️,
           so this is the common case, not an edge one: without it the band starts
           14px below the card's top edge where every plain first row starts at 8. */
        '.tour-box > .tve-ph-top,.ticket-box > .tve-ph-top{margin-top:0!important;}' +
        /* Mirror of .tve-ph-top at the other end. A band that is the LAST
           visible row butts onto the photo strip, which pays 9.125px — the
           half-leading of the text row it was sized for. A tint has no
           leading, so the band supplies the missing 3.125 itself or it sits
           3px closer to the photo than every other gap in the card. */
        '.tour-box > .tve-ph-end,.ticket-box > .tve-ph-end{margin-bottom:0!important;}' +
        /* Open-around-the-clock variant — SAME SKIN as every other band
           (owner rule 2026-08-08). The 24h row used to be the only band with
           its own colours: an #f5f0e6 fill on a .tour-box that is ITSELF
           #f5f0e6, so it had no fill contrast at all and vanished into its own
           card while the cream bands on neighbouring stops read as strips —
           one kind of information rendered two different ways down a day.
           Owner: "make sure these that are not toolbar also don't pass the
           middle of the page and match color the same color". Every band now
           shares one skin and the 24h distinction is carried by the label,
           which already says "Open 24h". The rule is kept rather than deleted
           because the class is still stamped in JS and
           check_stop_hours_contract hard-fails a tve-ph-* class with no CSS. */
        '.tve-ph-24{border-left-color:#b85c2a!important;background:transparent!important;' +
        'border-right-color:rgba(187,160,112,.45)!important;color:#7a3b1e!important;}' +
        /* Authored 🏛️ row: hidden, but kept in the DOM so the Open Now
           filter can still read its textContent. */
                /* DESKTOP WIDTH — the band stops at the horizontal centre of the screen
           and no further (owner rule 2026-08-08: "make sure this stops in the
           middle of the desktop screen not more than that"). At 1440px the card
           is 1280px wide, so a full-bleed strip ran nearly the whole window for
           a row that says nine words.
           `calc(50% + 14px)` IS the screen centre, not an approximation: the
           card is centred, so its left edge sits at (V - W) / 2 and the band —
           which is full-bleed, starting on that edge — must be W/2 wide to end
           at V/2. 50% resolves against the card's CONTENT box (W - 28 at the
           14px gutter), so half of that plus the 14px the band bleeds back over
           is exactly W/2. The 14 is re-read at runtime by _phFit for the mobile
           gutter, but this rule is desktop-only, where the gutter is 14.
           Mobile keeps the full-bleed strip: at 393px half the screen cannot
           hold "Today · 10:00am - 8:00pm" and the chevron. */
        '@media(min-width:601px){' +
        '.tour-box > .tve-ph,.ticket-box > .tve-ph,' +
        '.tour-box > .tve-ph-wrap,.ticket-box > .tve-ph-wrap{width:calc(50% + 14px);}' +
        '}' +
        '.tve-ph-src{display:none!important;}' +
        /* Toggle (multi-day) — wrapped with the panel so hover covers both */
        /* The WRAP carries the full-bleed margins (rule above); the toggle inside
           it must not repeat them or the strip bleeds 14px twice and overhangs
           the card on both sides. */
        '.tve-ph-wrap{position:relative;}' +
        '.tve-ph-toggle{display:flex!important;align-items:center;gap:7px;cursor:pointer;' +
        'border-radius:0!important;margin:0!important;' +
        '-webkit-user-select:none;user-select:none;}' +
        '.tve-ph-lbl{flex:1;}' +
        /* Chevron reads as a control, not punctuation. At 11px inline it was
           near-invisible — nothing signalled that the row opened. 22px round chip;
           also gives it a real tap target. Owner-requested 2026-08-07 ("make this
           more obvious so people know these open"). Palette: the TAN family —
           #6b5320 glyph in a #bba070 ring on the cream fill (owner picked option
           G from the 2026-08-08 mockups). It was terracotta, which put a second
           accent colour in a row whose rail is already the band's accent; tan is
           the same family as the rail, so the chip reads as part of the band
           rather than as a competing mark. Hover deepens the fill to #f5f0e6. */
        '.tve-ph-chv{font-size:15px;font-weight:700;color:#7a3b1e;line-height:1;' +
        'display:inline-flex;align-items:center;justify-content:center;flex:none;' +
        'width:22px;height:22px;border-radius:50%;' +
        'border:1px solid #b85c2a;background:transparent;' +
        'transition:transform .2s,background .15s;}' +
        '.tve-ph-wrap:hover .tve-ph-chv{background:#f5f0e6;}' +
        '.tve-ph-toggle[aria-expanded="true"] .tve-ph-chv{transform:rotate(90deg);}' +
        /* Expandable panel — absolute, so it floats OVER the rows beneath it.
           A hover trigger that pushed content down would reflow the page under
           the cursor every time it crossed a stop while scrolling. */
        /* Same 11.5px left padding as the toggle, so the schedule's day column
           starts on the card's icon column instead of 2px off it. padding-top is
           3px because the panel opens at the toggle's bottom edge, which the
           3+3 gap split moved 3px closer to the label — without it the divider
           rides up against the "Today" line. */
        /* Right + bottom hairlines for the same reason as .tve-ph above: the
           open panel is a cream slab on a near-cream page, so without them its
           right end and its foot were invisible and the schedule looked like it
           ran off the page. The shadow alone was not enough at the right edge. */
        '.tve-ph-panel{display:none;position:absolute;left:0;right:0;top:100%;z-index:6;' +
        'border-left:2.5px solid #bba070;background:#fdf8f0;' +
        'border-right:1px solid rgba(187,160,112,.45);' +
        'border-bottom:1px solid rgba(187,160,112,.45);' +
        'padding:3px 14px 8px 11.5px;border-radius:0;' +
        'box-shadow:0 6px 16px rgba(61,58,50,.16);}' +
        '.tve-ph-panel.tve-ph-open{display:block;}' +
        /* Hover expand — pointer devices only. Touch screens report hover:none
           and fall through to the tap handler, so a phone never lands in a
           stuck hover state it cannot clear. */
        '@media(hover:hover){' +
        '.tve-ph-wrap:hover .tve-ph-panel{display:block;}' +
        '.tve-ph-wrap:hover .tve-ph-chv{transform:rotate(90deg);}' +
        '}' +
        '.tve-ph-hr{border:none;border-top:1px solid rgba(187,160,112,.45);margin:0 0 6px;}' +
        /* Schedule grid */
        '.tve-ph-grid{display:grid;grid-template-columns:5.5em 1fr;font-size:13px;}' +
        '.tve-ph-d{font-weight:600;padding:2px 8px 2px 0;color:#3d3a32;line-height:1.45;}' +
        '.tve-ph-t{padding:2px 0;color:#3d3a32;line-height:1.45;}' +
        '.tve-ph-cl{color:#9a9088!important;font-style:italic;}' +
        '.tve-ph-24v{color:#6b5320!important;font-weight:600;}' +
        '.tve-ph-tag24{font-size:10px;font-weight:700;background:#f5f0e6;color:#6b5320;' +
        'border:1px solid #bba070;padding:0 3px;border-radius:3px;margin-right:4px;}' +
        /* Today highlight — the tan family's own wash (#f5f0e6, the palette's
           --c-next-bg and the documented partner of the #bba070 rail), so the
           one highlighted row inside the panel stays in the same family as the
           rail, the divider and the chevron. It was the terracotta wash #f3e3d7,
           left over from when the band was terracotta. */
        '.tve-ph-td{background:#f5f0e6;border-radius:3px 0 0 3px;padding-left:4px;}' +
        '.tve-ph-tt{background:#f5f0e6;border-radius:0 3px 3px 0;padding-left:4px;}' +
        '.tve-ph-now{font-size:10px;font-weight:700;color:#6b5320;' +
        'text-transform:uppercase;letter-spacing:.05em;margin-left:4px;}' +
        /* Dark mode — data-theme="dark" */
        'html[data-theme="dark"] .tve-ph{background:transparent;border-left-color:#c8a060;' +
        'border-right-color:rgba(200,160,96,.28);color:#e8e5e0;}' +
        'html[data-theme="dark"] .tve-ph-24{background:transparent!important;' +
        'border-left-color:#c8a060!important;border-right-color:rgba(200,160,96,.28)!important;' +
        'color:#e8e5e0!important;}' +
        'html[data-theme="dark"] .tve-ph-chv{color:#c8a060;}' +
        'html[data-theme="dark"] .tve-ph-panel{background:#242220;border-left-color:#c8a060;' +
        'border-right-color:rgba(200,160,96,.28);border-bottom-color:rgba(200,160,96,.28);' +
        'box-shadow:0 6px 16px rgba(0,0,0,.5);}' +
        'html[data-theme="dark"] .tve-ph-hr{border-top-color:rgba(200,160,96,.25);}' +
        'html[data-theme="dark"] .tve-ph-d{color:#e8e5e0;}' +
        'html[data-theme="dark"] .tve-ph-t{color:#e8e5e0;}' +
        'html[data-theme="dark"] .tve-ph-cl{color:#999!important;}' +
        'html[data-theme="dark"] .tve-ph-24v{color:#c8a060!important;}' +
        'html[data-theme="dark"] .tve-ph-tag24{background:#2a2825;color:#c8a060;' +
        'border-color:#7a6430;}' +
        'html[data-theme="dark"] .tve-ph-td,' +
        'html[data-theme="dark"] .tve-ph-tt{background:#3d3830;}' +
        'html[data-theme="dark"] .tve-ph-now{color:#c8a060;}' +
        /* Dark mode — prefers-color-scheme fallback (first visit, no data-theme stamped) */
        '@media(prefers-color-scheme:dark){' +
        'html:not([data-theme="light"]) .tve-ph{background:transparent;border-left-color:#c8a060;' +
        'border-right-color:rgba(200,160,96,.28);color:#e8e5e0;}' +
        'html:not([data-theme="light"]) .tve-ph-24{background:transparent!important;' +
        'border-left-color:#c8a060!important;border-right-color:rgba(200,160,96,.28)!important;' +
        'color:#e8e5e0!important;}' +
        'html:not([data-theme="light"]) .tve-ph-chv{color:#c8a060;}' +
        'html:not([data-theme="light"]) .tve-ph-panel{background:#242220;border-left-color:#c8a060;' +
        'border-right-color:rgba(200,160,96,.28);border-bottom-color:rgba(200,160,96,.28);' +
        'box-shadow:0 6px 16px rgba(0,0,0,.5);}' +
        'html:not([data-theme="light"]) .tve-ph-hr{border-top-color:rgba(200,160,96,.25);}' +
        'html:not([data-theme="light"]) .tve-ph-d{color:#e8e5e0;}' +
        'html:not([data-theme="light"]) .tve-ph-t{color:#e8e5e0;}' +
        'html:not([data-theme="light"]) .tve-ph-cl{color:#999!important;}' +
        'html:not([data-theme="light"]) .tve-ph-24v{color:#c8a060!important;}' +
        'html:not([data-theme="light"]) .tve-ph-tag24{background:#2a2825;color:#c8a060;border-color:#7a6430;}' +
        'html:not([data-theme="light"]) .tve-ph-td,' +
        'html:not([data-theme="light"]) .tve-ph-tt{background:#3d3830;}' +
        'html:not([data-theme="light"]) .tve-ph-now{color:#c8a060;}' +
        '}';
      (document.head || document.documentElement).appendChild(_phCss);
    }

    /* ── Parsing ────────────────────────────────────────────────────────────── */
    var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; /* display order */
    var IDX  = { mon:0, monday:0, tue:1, tuesday:1, wed:2, wednesday:2, thu:3, thursday:3,
                 fri:4, friday:4, sat:5, saturday:5, sun:6, sunday:6 };
    var _TM  = '\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)';
    var RE_RANGE = new RegExp('(' + _TM + ')\\s*[-–—]\\s*(' + _TM + ')', 'i');
    var RE_DAYNM = /(Mondays?|Tuesdays?|Wednesdays?|Thursdays?|Fridays?|Saturdays?|Sundays?)/gi;
    var RE_24    = /open\s*24\s*\/\s*7|24\s*hours?|\bopen\s*24h\b|always\s+open|around\s+the\s+clock/i;
    var RE_DAILY = /\b(?:daily|every\s+day)\b/i;
    var RE_CLOSED = /\bclosed\b/i;
    var ALL = [0, 1, 2, 3, 4, 5, 6];

    /* One " · " segment → { days:[idx…], val } | null when unrecognised. */
    function _seg(txt) {
      var val = null;
      if (RE_24.test(txt)) {
        val = '24h';
      } else {
        var m = txt.match(RE_RANGE);
        if (m) val = m[1].trim() + ' – ' + m[2].trim();
      }
      if (!val && RE_CLOSED.test(txt)) val = 'closed';
      if (!val) return null;

      RE_DAYNM.lastIndex = 0;
      var names = txt.match(RE_DAYNM) || [];
      if (!names.length) {
        /* No day named — "Daily …" or a bare "Open 24/7" covers the whole week. */
        if (RE_DAILY.test(txt) || val === '24h') return { days: ALL.slice(), val: val };
        /* A bare time range is the second half of a SPLIT-HOURS listing:
           "Daily 9:00am - 12:00pm · 3:00pm - 6:00pm" names the day once and
           lets the afternoon inherit it. Returning null here failed the whole
           stop (69 stops across 46 guides), which left the authored 🏛️ line
           on screen — the exact leak the 🏛️ ban names. Only the caller knows
           which days came before, so hand it back as a continuation and let
           the merge loop attach it. A bare "Closed" stays unreadable: there is
           no sane way to append "shut" to a set of opening hours. */
        return val === 'closed' ? null : { cont: true, val: val };
      }
      var key = function (n) { return IDX[n.toLowerCase().replace(/s$/, '')]; };
      if (names.length === 1) return { days: [key(names[0])], val: val };
      /* "Monday and Wednesday" lists discrete days; "Monday - Saturday" spans. */
      if (/\band\b|,/.test(txt)) {
        return { days: names.map(key), val: val };
      }
      var a = key(names[0]), b = key(names[names.length - 1]), days = [];
      for (var i = 0; i < 7; i++) { var d = (a + i) % 7; days.push(d); if (d === b) break; }
      return { days: days, val: val };
    }

    /* ── Today, at the destination ──────────────────────────────────────────── */
    var _dest   = _tveDestNow();
    var _todayI = _dest.local ? (_dest.dow + 6) % 7 : -1; /* JS 0=Sun → Mon-first */

    /* ── Build the collapsed row + hover panel for one parsed week ──────────── */
    function _build(week) {
      var panel = document.createElement('div');
      panel.className = 'tve-ph-panel';
      panel.appendChild(document.createElement('div')).className = 'tve-ph-hr';
      var grid = document.createElement('div');
      grid.className = 'tve-ph-grid';
      DAYS.forEach(function (name, i) {
        var v = week[i] === undefined ? 'closed' : week[i];
        var today = i === _todayI;
        var dEl = document.createElement('div');
        dEl.className = 'tve-ph-d' + (today ? ' tve-ph-td' : '');
        dEl.textContent = name;
        if (today) {
          var nw = document.createElement('span');
          nw.className = 'tve-ph-now';
          nw.textContent = 'today';
          dEl.appendChild(nw);
        }
        var tEl = document.createElement('div');
        if (v === 'closed') {
          tEl.className = 'tve-ph-t tve-ph-cl' + (today ? ' tve-ph-tt' : '');
          tEl.textContent = 'Closed';
        } else if (v === '24h') {
          tEl.className = 'tve-ph-t tve-ph-24v' + (today ? ' tve-ph-tt' : '');
          var tag = document.createElement('span');
          tag.className = 'tve-ph-tag24';
          tag.textContent = '24h';
          tEl.appendChild(tag);
          tEl.appendChild(document.createTextNode('Open all day'));
        } else {
          tEl.className = 'tve-ph-t' + (today ? ' tve-ph-tt' : '');
          tEl.textContent = v;
        }
        grid.appendChild(dEl);
        grid.appendChild(tEl);
      });
      panel.appendChild(grid);

      /* Collapsed label. Most readers never expand, so the always-visible line
         answers the question instead of announcing that an answer exists. */
      var tv = _todayI >= 0 ? (week[_todayI] === undefined ? 'closed' : week[_todayI]) : null;
      var txt = 'Hours vary by day';
      if (tv === 'closed')    txt = 'Closed today';
      else if (tv === '24h')  txt = 'Today · open 24h';
      else if (tv)            txt = 'Today · ' + tv;

      var toggle = document.createElement('div');
      toggle.className = 'tve-ph tve-ph-toggle';
      toggle.setAttribute('role', 'button');
      toggle.setAttribute('tabindex', '0');
      toggle.setAttribute('aria-expanded', 'false');
      var lbl = document.createElement('span');
      lbl.className = 'tve-ph-lbl';
      lbl.textContent = '🕐 ' + txt; /* 🕐 */
      var chv = document.createElement('span');
      chv.className = 'tve-ph-chv';
      chv.textContent = '›'; /* › */
      toggle.appendChild(lbl);
      toggle.appendChild(chv);

      function _t() {
        var open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
        panel.classList.toggle('tve-ph-open', !open);
      }
      toggle.addEventListener('click', _t);
      toggle.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _t(); }
      });

      /* The WRAP is the hover target, not the toggle: the panel is absolutely
         positioned beneath the toggle but inside the wrap, so a cursor moving
         down into the schedule stays within the hovered element. */
      var wrap = document.createElement('div');
      wrap.className = 'tve-ph-wrap';
      wrap.appendChild(toggle);
      wrap.appendChild(panel);
      return wrap;
    }

    /* ── Full-bleed fit ─────────────────────────────────────────────────────
       The band cancels its card's horizontal padding so its rail sits on the
       card edge and its text lands on the same column as every other icon row.
       That padding is 14px on desktop and 12px at the mobile breakpoint, so the
       number cannot live in the stylesheet — it is read off the card here and
       re-read on resize, which is also what makes an orientation change land on
       the right value instead of a 2px overhang. 2.5px is the rail width. */
    var _phBands = [];
    function _phFit() {
      _phBands.forEach(function (outer) {
        if (!outer.parentNode) return;
        var cs = getComputedStyle(outer.parentNode);
        var pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
        outer.style.setProperty('margin-left', -pl + 'px', 'important');
        outer.style.setProperty('margin-right', -pr + 'px', 'important');
        var pad = function (n) {
          if (!n) return;
          n.style.setProperty('padding-left', (pl - 2.5) + 'px', 'important');
          n.style.setProperty('padding-right', pr + 'px', 'important');
        };
        /* Flat band paints itself; a wrap paints through its toggle + panel. */
        if (outer.classList.contains('tve-ph')) pad(outer);
        else { pad(outer.querySelector('.tve-ph-toggle')); pad(outer.querySelector('.tve-ph-panel')); }
      });
    }

    /* ── Walk the authored 🏛️ rows, GROUPED BY STOP ─────────────────────────
       A stop can carry more than one 🏛️ row — Carmel Mission ships
       "Mon-Sat 9:30am - 5:00pm" on one and "Sun 10:30am - 5:00pm" on the
       next. That is ONE weekly schedule split across two lines, not two
       schedules, and rendering a band per row stacked two near-identical
       strips with a gap between them (owner report 2026-08-07: "it is all
       over the place"). Grouping by the containing card means exactly one
       band per stop, which is also what makes the vertical rhythm
       deterministic: there is never a band-to-band gap left to tune. */
    var groups = [], boxes = [];
    srcRows.forEach(function (row) {
      var box = row.parentNode;
      var i = boxes.indexOf(box);
      if (i < 0) { boxes.push(box); groups.push({ box: box, rows: [row] }); }
      else { groups[i].rows.push(row); }
    });

    groups.forEach(function (grp) {
      var parts = [];
      grp.rows.forEach(function (r) {
        r.textContent.replace(/^🏛️?\s*/, '').trim().split('·').forEach(function (x) {
          x = x.trim();
          if (x) parts.push(x);
        });
      });
      if (!parts.length) return;

      var week = [], bad = false, prev = null;
      parts.forEach(function (p) {
        var seg = _seg(p);
        if (!seg) { bad = true; return; }
        if (seg.cont) {
          /* Split-hours continuation — inherit the previous segment's days and
             APPEND, so a lunch-break listing reads as one day with two windows
             rather than overwriting the morning. Appending to "closed" or "24h"
             would be nonsense, and a continuation with nothing before it has no
             days to inherit; both stay unreadable. */
          if (!prev || prev.val === 'closed' || prev.val === '24h') { bad = true; return; }
          var merged = prev.val + ', ' + seg.val;
          /* Only days this segment's parent actually wrote are extended — a day
             already claimed by an EARLIER segment keeps its own hours. Rewriting
             prev.val to the merged string is what lets a third and fourth window
             chain on (Dublin ships Sunday as 9–10:30, 12:45–2:30, 4:30–6). */
          prev.days.forEach(function (d) { if (week[d] === prev.val) week[d] = merged; });
          prev.val = merged;
          return;
        }
        seg.days.forEach(function (d) { if (week[d] === undefined) week[d] = seg.val; });
        prev = seg;
      });
      /* Any segment we could not read → leave the stop entirely alone. A
         partially understood schedule is worse than the authored lines. */
      if (bad) return;

      /* Days the listing never names read as closed — an hours listing that
         names Tuesday–Sunday means "shut on Monday" everywhere. */
      var uniform = true;
      for (var i = 1; i < 7; i++) {
        if ((week[i] === undefined ? 'closed' : week[i]) !==
            (week[0] === undefined ? 'closed' : week[0])) { uniform = false; break; }
      }

      var el;
      if (!uniform) {
        el = _build(week);
      } else {
        var v = week[0] === undefined ? 'closed' : week[0];
        if (v === 'closed') return;
        el = document.createElement('div');
        el.className = 'tve-ph' + (v === '24h' ? ' tve-ph-24' : '');
        el.textContent = '🕐 ' + (v === '24h' ? 'Open 24h · every day' : 'Daily · ' + v); /* 🕐 */
      }

      grp.rows.forEach(function (r) { r.classList.add('tve-ph-src'); });
      var last = grp.rows[grp.rows.length - 1];
      last.parentNode.insertBefore(el, last.nextSibling);

      /* Nothing VISIBLE above it → the band is the card's first row and must not
         carry the 6px row margin, or it starts 14px below the card's top edge
         where a plain first row starts at 8px. :first-child cannot express this:
         the authored 🏛️ rows are still there, just display:none. Rect count is
         the test rather than the .tve-ph-src class, so any other hidden row a
         later pass leaves behind is skipped too. */
      var prev = el.previousElementSibling, lead = true;
      while (prev) {
        if (prev.getClientRects().length) { lead = false; break; }
        prev = prev.previousElementSibling;
      }
      if (lead) el.classList.add('tve-ph-top');
      /* Same walk forward: a band with no visible row after it is the card's
         last row and needs the bottom mirror of .tve-ph-top. */
      var nxt = el.nextElementSibling, trail = true;
      while (nxt) {
        if (nxt.getClientRects().length) { trail = false; break; }
        nxt = nxt.nextElementSibling;
      }
      if (trail) el.classList.add('tve-ph-end');
      _phBands.push(el);
    });

    _phFit();
    var _phT;
    window.addEventListener('resize', function () {
      clearTimeout(_phT);
      _phT = setTimeout(_phFit, 120);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _upgradeStopHours);
  } else {
    _upgradeStopHours();
  }


  /* ── Address copy — multi-format clipboard popover on 📍 stop rows ─────────
     Adds a small copy icon button after every 📍 Google Maps address link on
     real guide pages. Clicking opens a fixed-position popover with:
       • Copy address (plain text, decoded from Maps URL query param)
       • Copy Maps link (the full Google Maps URL)
       • Open in Apple Maps (UA-gated; Apple devices only)
     Uses a single shared popover singleton to keep DOM lean across 200+ stops.
     CSS lives in guide-style.css (.addr-copy, .addr-copy-pop). */
  function _injectAddrCopy() {
    if (!isRealGuide) return;
    var rows = document.querySelectorAll('.stop-row');
    if (!rows.length) return;
    var pop = document.createElement('div');
    pop.className = 'addr-copy-pop';
    var optAddr = document.createElement('button');
    optAddr.type = 'button'; optAddr.className = 'acp-btn'; optAddr.textContent = '📋  Copy address';
    var optMaps = document.createElement('button');
    optMaps.type = 'button'; optMaps.className = 'acp-btn'; optMaps.textContent = '🗺  Copy Maps link';
    var done = document.createElement('div');
    done.className = 'addr-copy-done'; done.textContent = '✓ Copied';
    pop.appendChild(optAddr); pop.appendChild(optMaps);
    var optApple = null;
    if (/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)) {
      optApple = document.createElement('button');
      optApple.type = 'button'; optApple.className = 'acp-btn'; optApple.textContent = '🍎  Open in Apple Maps';
      pop.appendChild(optApple);
    }
    pop.appendChild(done);
    document.body.appendChild(pop);
    var curAddr = '', curMapsUrl = '';
    function copyText(str) {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(str);
      var ta = document.createElement('textarea');
      ta.value = str; ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      return Promise.resolve();
    }
    function showDone() {
      done.style.display = 'block';
      setTimeout(function () { done.style.display = 'none'; pop.classList.remove('open'); }, 900);
    }
    function openPop(btn, addr, mapsUrl) {
      curAddr = addr; curMapsUrl = mapsUrl; done.style.display = 'none';
      if (optApple) optApple.setAttribute('data-q', addr);
      var r = btn.getBoundingClientRect();
      pop.style.top = Math.round(r.bottom + 6) + 'px';
      pop.classList.add('open');
      var pw = pop.offsetWidth || 180;
      var left = Math.round(r.left);
      if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
      if (left < 8) left = 8;
      pop.style.left = left + 'px';
    }
    function closePop() { pop.classList.remove('open'); done.style.display = 'none'; }
    optAddr.addEventListener('click', function (e) { e.stopPropagation(); copyText(curAddr).then(showDone).catch(closePop); });
    optMaps.addEventListener('click', function (e) { e.stopPropagation(); copyText(curMapsUrl).then(showDone).catch(closePop); });
    if (optApple) {
      optApple.addEventListener('click', function (e) {
        e.stopPropagation();
        window.location.href = 'maps://?q=' + encodeURIComponent(optApple.getAttribute('data-q') || curAddr);
        closePop();
      });
    }
    document.addEventListener('click', function () { closePop(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePop(); });
    var ICON = '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<rect x="5.5" y="2" width="8.5" height="10.5" rx="1.5" stroke="currentColor" stroke-width="1.4"/>' +
      '<path d="M3 4.5H2.5C1.67 4.5 1 5.17 1 6V14C1 14.83 1.67 15.5 2.5 15.5H9.5C10.33 15.5 11 14.83 11 14V13.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
      '</svg>';
    [].forEach.call(rows, function (row) {
      if (!row.textContent.trimStart().startsWith('📍')) return;
      var anchor = row.querySelector('a[href*="google.com/maps"]');
      if (!anchor) return;
      var addr = anchor.textContent.trim();
      try { var qp = new URL(anchor.href).searchParams.get('query'); if (qp) addr = qp; } catch (e) {}
      var mapsUrl = anchor.href;
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'addr-copy'; btn.setAttribute('aria-label', 'Copy address'); btn.innerHTML = ICON;
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (pop.classList.contains('open')) { closePop(); return; }
        openPop(btn, addr, mapsUrl);
      });
      row.appendChild(btn);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectAddrCopy);
  } else {
    _injectAddrCopy();
  }

  /* ── Day Jump — floating pill + overlay on guide pages ────────────────────
     Shows a small "📅 N days" pill fixed at bottom-right of the viewport.
     Clicking opens a centered overlay card listing every day in the guide with
     the first three stops as a preview. Tapping a day row smooth-scrolls there
     and closes the overlay. CSS lives in guide-style.css (.day-jump-*). */
  function _injectDayJump() {
    if (!isRealGuide) return;
    var dayBlocks = [].slice.call(document.querySelectorAll('.day-block[id^="day"]'));
    if (dayBlocks.length < 2) return;

    var days = [];
    dayBlocks.forEach(function (block) {
      var num = parseInt((block.id || '').replace('day', ''), 10);
      if (isNaN(num) || num < 1) return;
      var stops = [];
      [].forEach.call(block.querySelectorAll('.stop-name'), function (s) {
        var t = s.textContent.trim(); if (t) stops.push(t);
      });
      days.push({ num: num, id: block.id, stops: stops });
    });
    days.sort(function (a, b) { return a.num - b.num; });
    if (!days.length) return;

    var cityEl = document.querySelector('.title-city');
    var city = cityEl ? cityEl.textContent.trim() : '';

    /* ── Floating trigger button ── */
    var trigBtn = document.createElement('button');
    trigBtn.type = 'button';
    trigBtn.className = 'day-jump-btn';
    trigBtn.setAttribute('aria-label', 'Jump to a day');
    trigBtn.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">' +
        '<rect x="1" y="3" width="11" height="9" rx="1.5" stroke="currentColor" stroke-width="1.4"/>' +
        '<path d="M4 1v2M9 1v2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
        '<path d="M1 6h11" stroke="currentColor" stroke-width="1.2"/>' +
      '</svg>' +
      '<span>' + days.length + ' days</span>';

    /* ── Overlay ── */
    var ov = document.createElement('div');
    ov.className = 'day-jump-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Jump to day');

    var card = document.createElement('div');
    card.className = 'day-jump-card';
    card.addEventListener('click', function (e) { e.stopPropagation(); });

    /* Head */
    var head = document.createElement('div');
    head.className = 'day-jump-head';
    if (city) {
      var cityLbl = document.createElement('div');
      cityLbl.className = 'day-jump-city';
      cityLbl.textContent = city;
      head.appendChild(cityLbl);
    }
    var titleEl = document.createElement('div');
    titleEl.className = 'day-jump-title';
    titleEl.textContent = 'Jump to Day';
    head.appendChild(titleEl);
    var xBtn = document.createElement('button');
    xBtn.type = 'button'; xBtn.className = 'day-jump-x'; xBtn.textContent = '✕';
    head.appendChild(xBtn);
    card.appendChild(head);

    /* Day rows */
    var rowEls = [];
    days.forEach(function (d, i) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'day-jump-row';

      var numBadge = document.createElement('span');
      numBadge.className = 'day-jump-num';
      numBadge.textContent = d.num;

      var info = document.createElement('span');
      info.className = 'day-jump-info';

      var lbl = document.createElement('span');
      lbl.className = 'day-jump-lbl';
      lbl.textContent = 'Day ' + d.num;
      info.appendChild(lbl);

      if (d.stops.length) {
        var prev = document.createElement('span');
        prev.className = 'day-jump-preview';
        prev.textContent = d.stops.join(' · ');
        info.appendChild(prev);
      }

      row.appendChild(numBadge);
      row.appendChild(info);
      row.addEventListener('click', function () {
        closeDJ();
        var el = document.getElementById(d.id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      card.appendChild(row);
      rowEls.push(row);
    });

    ov.appendChild(card);

    function getCurrentDayNum() {
      var best = days[0].num;
      dayBlocks.forEach(function (block) {
        if (block.getBoundingClientRect().top <= 80) {
          var n = parseInt((block.id || '').replace('day', ''), 10);
          if (!isNaN(n)) best = n;
        }
      });
      return best;
    }

    function openDJ() {
      var cur = getCurrentDayNum();
      rowEls.forEach(function (r, i) {
        r.classList.toggle('day-jump-row--active', days[i] && days[i].num === cur);
      });
      ov.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeDJ() {
      ov.classList.remove('open');
      document.body.style.overflow = '';
    }

    trigBtn.addEventListener('click', function (e) { e.stopPropagation(); openDJ(); });
    xBtn.addEventListener('click', function (e) { e.stopPropagation(); closeDJ(); });
    ov.addEventListener('click', closeDJ);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDJ(); });

    document.body.appendChild(ov);
    document.body.appendChild(trigBtn);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectDayJump);
  } else {
    _injectDayJump();
  }

  /* ── ?day=N deep link — scroll to Day N on page load ────────────────────
     Sharing guide.html?day=2 opens directly at Day 2 without hunting for it.
     No-ops silently if the parameter is absent, non-numeric, or out of range. */
  function _applyDayParam() {
    if (!isRealGuide) return;
    var raw = new URLSearchParams(location.search).get('day');
    if (!raw) return;
    var n = parseInt(raw, 10);
    if (isNaN(n) || n < 1) return;
    var target = document.getElementById('day' + n);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _applyDayParam);
  } else {
    _applyDayParam();
  }

  /* ── Save for Offline — pill on guide pages so readers can explicitly cache
     the guide before going offline (flight, tunnel, abroad without data).
     The SW already caches every visited page; this button confirms intent and
     persists the saved state in localStorage so returning visits show ✓. ── */
  function _injectOfflineBtn() {
    if (!isRealGuide) return;
    if (!('caches' in window)) return;

    var storageKey = 'tve-offline-' + location.pathname;
    var saved = !!localStorage.getItem(storageKey);

    var btn = document.createElement('a');
    btn.href = 'javascript:void(0)';
    btn.className = 'overview-extra-link';
    btn.id = 'tve-offline-btn';
    btn.textContent = saved ? '✓ Saved for Offline' : '⏬ Save for Offline';
    if (saved) {
      btn.classList.add('tve-saved');
      btn.style.setProperty('cursor', 'default', 'important');
    }

    /* Transient confirmation toast — bottom-centre, auto-dismiss. Only fires on a
       fresh save (not on page load when already saved), so the reader gets a clear
       "this is now available offline" receipt at the moment of action. */
    function showOfflineToast() {
      var t = document.createElement('div');
      t.className = 'tve-toast';
      t.setAttribute('role', 'status');
      t.textContent = '✓ Saved for Offline — available without a connection';
      document.body.appendChild(t);
      /* Force a reflow so the opacity/transform transition fires reliably — more
         robust than requestAnimationFrame, which browsers throttle in background
         tabs (the fade-in would otherwise never start). */
      void t.offsetWidth;
      t.classList.add('tve-toast-in');
      setTimeout(function () {
        t.classList.remove('tve-toast-in');
        setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
      }, 3200);
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (localStorage.getItem(storageKey)) {
        /* Already saved → toggle back to the resting state (mirrors I've Been). */
        localStorage.removeItem(storageKey);
        btn.textContent = '⏬ Save for Offline';
        btn.classList.remove('tve-saved');
        btn.style.setProperty('cursor', 'pointer', 'important');
        return;
      }
      btn.textContent = 'Saving…';
      var markSaved = function () {
        localStorage.setItem(storageKey, '1');
        btn.textContent = '✓ Saved for Offline';
        btn.classList.add('tve-saved');
        btn.style.setProperty('cursor', 'default', 'important');
        showOfflineToast();
      };
      /* caches.match searches all caches — if SW already cached this page on
         load (normal case), confirm immediately without a second network hit. */
      caches.match(location.href).then(function (hit) {
        if (hit) return markSaved();
        /* Not cached yet (first load, SW just registered) — fetch it; the SW
           will intercept and cache the response. */
        return fetch(location.href).then(markSaved)['catch'](markSaved);
      })['catch'](markSaved);
    });

    /* Inject into the ICS pill row (_injectICSExport runs first because it is
       registered above; by the time this runs #ics-cal-pill already exists). */
    var icsCalPill = document.getElementById('ics-cal-pill');
    if (icsCalPill) {
      var pillRow = icsCalPill.parentNode;
      btn.style.setProperty('flex', '1 1 0', 'important');
      btn.style.setProperty('min-width', '0', 'important');
      btn.style.setProperty('align-items', 'center', 'important');
      btn.style.setProperty('justify-content', 'center', 'important');
      btn.style.setProperty('text-align', 'center', 'important');
      pillRow.appendChild(btn);
      /* iOS :active workaround — touch events don't reliably fire :active */
      btn.addEventListener('touchstart', function () {
        if (localStorage.getItem(storageKey)) return;
        btn.classList.add('tve-pressed');
        btn.style.setProperty('color', '#fff', 'important');
        btn.style.setProperty('-webkit-text-fill-color', '#fff', 'important');
      }, { passive: true });
      btn.addEventListener('touchend', function () {
        setTimeout(function () {
          btn.classList.remove('tve-pressed');
          btn.style.removeProperty('color');
          btn.style.removeProperty('-webkit-text-fill-color');
        }, 300);
      }, { passive: true });
      btn.addEventListener('touchcancel', function () {
        btn.classList.remove('tve-pressed');
        btn.style.removeProperty('color');
        btn.style.removeProperty('-webkit-text-fill-color');
      }, { passive: true });
    } else {
      /* Fallback: no ICS row (guide without overview days) — insert before extras */
      var offlineDays = document.querySelectorAll('.overview-day');
      if (!offlineDays.length) return;
      var offlineLast = offlineDays[offlineDays.length - 1];
      var offlineExtras = offlineLast.parentNode.querySelector('.overview-extras');
      if (offlineExtras) {
        offlineExtras.parentNode.insertBefore(btn, offlineExtras);
      } else {
        offlineLast.parentNode.appendChild(btn);
      }
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectOfflineBtn);
  } else {
    _injectOfflineBtn();
  }

  /* ── "I've Been" visited toggle — pill on guide pages so readers can mark a
     destination as visited. Writes tve-visited-{folder} to localStorage; the
     Guides-Index reads the same key to override data-status on cards. ── */
  function _injectVisitedToggle() {
    if (!isRealGuide) return;

    var parts = location.pathname.split('/');
    var gi = parts.indexOf('Guides');
    if (gi < 0 || !parts[gi + 1]) return;
    var cityFolder = parts[gi + 1].toLowerCase();
    var storageKey = 'tve-visited-' + cityFolder;
    var visited = !!localStorage.getItem(storageKey);

    var btn = document.createElement('a');
    btn.href = 'javascript:void(0)';
    btn.className = 'overview-extra-link' + (visited ? ' tve-been' : '');
    btn.id = 'tve-visited-btn';
    btn.textContent = visited ? '✓ I’ve Been' : '📍 I’ve Been';

    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var nowVisited = !!localStorage.getItem(storageKey);
      if (nowVisited) {
        localStorage.removeItem(storageKey);
        btn.textContent = '📍 I’ve Been';
        btn.classList.remove('tve-been');
      } else {
        localStorage.setItem(storageKey, '1');
        btn.textContent = '✓ I’ve Been';
        btn.classList.add('tve-been');
      }
    });

    var icsCalPill = document.getElementById('ics-cal-pill');
    if (icsCalPill) {
      var pillRow = icsCalPill.parentNode;
      btn.style.setProperty('flex', '1 1 0', 'important');
      btn.style.setProperty('min-width', '0', 'important');
      btn.style.setProperty('align-items', 'center', 'important');
      btn.style.setProperty('justify-content', 'center', 'important');
      btn.style.setProperty('text-align', 'center', 'important');
      pillRow.appendChild(btn);
      btn.addEventListener('touchstart', function () {
        btn.classList.add('tve-pressed');
        btn.style.setProperty('color', '#fff', 'important');
        btn.style.setProperty('-webkit-text-fill-color', '#fff', 'important');
      }, { passive: true });
      btn.addEventListener('touchend', function () {
        setTimeout(function () {
          btn.classList.remove('tve-pressed');
          btn.style.removeProperty('color');
          btn.style.removeProperty('-webkit-text-fill-color');
        }, 300);
      }, { passive: true });
      btn.addEventListener('touchcancel', function () {
        btn.classList.remove('tve-pressed');
        btn.style.removeProperty('color');
        btn.style.removeProperty('-webkit-text-fill-color');
      }, { passive: true });
    } else {
      var visitDays = document.querySelectorAll('.overview-day');
      if (!visitDays.length) return;
      var visitLast = visitDays[visitDays.length - 1];
      var visitExtras = visitLast.parentNode.querySelector('.overview-extras');
      if (visitExtras) {
        visitExtras.parentNode.insertBefore(btn, visitExtras);
      } else {
        visitLast.parentNode.appendChild(btn);
      }
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectVisitedToggle);
  } else {
    _injectVisitedToggle();
  }

  /* ── Mark Stops — per-stop checkbox on every .stop-block. The circle carries
     a faint ✓ when unchecked so the affordance is legible; clicking marks the
     stop as visited: the circle fills solid terracotta with a white ✓ and the
     header text dims to 0.4 opacity. State is stored in localStorage as a JSON array of stop
     indices keyed by city folder: tve-stops-{folder}. Saved state is applied
     on every load so marks persist across sessions. CSS in guide-style.css. ── */
  function _injectMarkStops() {
    if (!isRealGuide) return;
    var blocks = document.querySelectorAll('.stop-block');
    if (!blocks.length) return;

    var parts = location.pathname.split('/');
    var gi = parts.indexOf('Guides');
    if (gi < 0 || !parts[gi + 1]) return;
    var cityFolder = parts[gi + 1].toLowerCase();
    var storageKey = 'tve-stops-' + cityFolder;

    var done = {};
    try {
      var raw = localStorage.getItem(storageKey);
      if (raw) { JSON.parse(raw).forEach(function (i) { done[i] = true; }); }
    } catch (e) {}

    function save() {
      var arr = Object.keys(done).filter(function (k) { return done[k]; }).map(Number);
      try { localStorage.setItem(storageKey, JSON.stringify(arr)); } catch (e) {}
    }

    [].forEach.call(blocks, function (sb, idx) {
      var header = sb.querySelector('.stop-header');
      if (!header) return;

      /* Ensure flex layout — _injectStopDuration already sets it when a
         duration chip is present; set it here for stops without one. */
      header.style.display = 'flex';
      header.style.alignItems = 'center';

      /* The control sits against the stop name, not out on the right rail, so
         it reads as part of the title. That means the NAME must size to its
         own content — _injectStopDuration sets flex:1, which would swallow the
         row and push the control back to the far right — and the control
         carries margin-right:auto instead. It, not the name, is now the spacer
         that keeps the duration chip, share and star pinned right. */
      var nameEl = header.querySelector('.stop-name');
      if (nameEl) {
        nameEl.style.flex = '0 1 auto';
        nameEl.style.minWidth = '0';
      }

      var btn = document.createElement('span');
      btn.className = 'stop-mark-btn';
      btn.setAttribute('role', 'checkbox');
      btn.setAttribute('tabindex', '0');
      btn.textContent = '✓'; /* ✓ */

      /* Label + tooltip state the action outright — an unlabelled circle gave
         no clue what it did, and the dimmed header alone read as "disabled". */
      function label(isDone) {
        btn.setAttribute('aria-label', isDone ? 'Visited — click to unmark' : 'Mark stop as visited');
        btn.setAttribute('title', isDone ? 'Visited — click to unmark' : 'Mark as visited');
      }

      if (done[idx]) {
        sb.classList.add('stop-done');
        btn.setAttribute('aria-checked', 'true');
      } else {
        btn.setAttribute('aria-checked', 'false');
      }
      label(!!done[idx]);

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (done[idx]) {
          delete done[idx];
          sb.classList.remove('stop-done');
          btn.setAttribute('aria-checked', 'false');
          label(false);
        } else {
          done[idx] = true;
          sb.classList.add('stop-done');
          btn.setAttribute('aria-checked', 'true');
          label(true);
        }
        save();
      });

      btn.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); btn.click(); }
      });

      /* Directly after the name — insertBefore(x, null) degrades to append. */
      if (nameEl) header.insertBefore(btn, nameEl.nextSibling);
      else header.appendChild(btn);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectMarkStops);
  } else {
    _injectMarkStops();
  }

  /* ── Alternative hotel recommendations — injected before #also-on-this-site on
     guide pages that have a HOTEL_ALT_DATA entry. Runner-up hotels from the same
     search process used to pick the guide hotel; added during each guide build.
     Every slug carries a MINIMUM of 4 hotels — there is NO maximum; list every
     alternative that clears the quality bar. Each hotel needs name + note + url
     (Booking.com property page). Enforced by the FINAL GATE in
     validate_itinerary.py and fleet-wide by check_post_ci_sections.py.          */
  var HOTEL_ALT_DATA = {
    /* entries added per guide during build — see Separation Map.md § Hotels & Rentals */
    'granada': { h: [
      { name: 'Vincci Albayzín Hotel', note: '4-star, free cancellation, Albayzín — eco-friendly, regional cuisine', url: 'https://www.booking.com/hotel/es/vincci-albayzin.html' },
      { name: 'Shine Albayzín Hotel', note: 'Free cancellation, near Mirador de San Nicolás', url: 'https://www.booking.com/hotel/es/shine-darro.html' },
      { name: 'Hotel Palacio de Mariana Pineda', note: '17th-century palace facing the Alhambra, spa treatments', url: 'https://www.booking.com/hotel/es/museo-palacio-de-mariana-pineda.html' },
      { name: 'Palacio Gran Vía, a Royal Hideaway Hotel', note: 'Independent luxury — restored palace on Gran Vía de Colón, spa with hammam, rooftop terrace over the cathedral quarter · 9.5 Booking.com', url: 'https://www.booking.com/hotel/es/palacio-de-gran-via-a-royal-hideaway.html' }
    ] },
    'lisbon': { h: [
      { name: 'Sheraton Lisboa Hotel & Spa', note: 'Marriott family — pool, spa, central location near Marquês de Pombal · 8.6 Booking.com' , url: 'https://www.booking.com/hotel/pt/sheraton-lisboa-hotel-spa.html' },
      { name: 'InterContinental Lisbon by IHG', note: 'First-tier brand — 8.9 Booking.com, scenic views, Avenida da Liberdade area' , url: 'https://www.booking.com/hotel/pt/intercontinental-lisbon.html' },
      { name: 'Bairro Alto Hotel', note: 'Independent — 18th-century Pombaline building in Chiado, rooftop bar with river and city views, Flores da Primavera restaurant, curated art · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/pt/bairro-alto.html' },
      { name: 'Four Seasons Hotel Ritz Lisbon', note: 'Four Seasons brand — Eduardo VII Park, outdoor heated pool, Varanda restaurant with panoramic city views, full-service spa · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/pt/four-seasons-hotel-ritz.html' }
    ] },
    'ljubljana': { h: [
      { name: 'Hotel Cubo', note: 'Independent boutique — design hotel in Old Town pedestrian zone, terrace bar · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/si/cubo.html' },
      { name: 'InterContinental Ljubljana by IHG', note: 'IHG brand — panoramic spa with indoor pool, rooftop restaurant, city-centre location · 8.8 Booking.com' , url: 'https://www.booking.com/hotel/si/intercontinental-ljubljana.html' },
      { name: 'Grand Hotel Union Ljubljana', note: 'Independent — 1905 Art Nouveau landmark on Revolution Square, Congress restaurant, spa with indoor pool, landmark heritage building · 8.9 Booking.com' , url: 'https://www.booking.com/hotel/si/grand-union.html' },
      { name: 'Hotel Vander Urbani Resort', note: 'Independent boutique — Old Town cobblestones, rooftop pool with castle views, Vander kitchen, 16 rooms · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/si/vander-urbani-resort.html' }
    ] },
    'melbourne': { h: [
      { name: 'The Langham Melbourne', note: 'Langham brand — riverside Southbank on the Yarra, pool, spa · 8.9 Booking.com' , url: 'https://www.booking.com/hotel/au/the-langham-melbourne.html' },
      { name: 'Crown Towers Melbourne', note: 'Crown brand — Southbank entertainment precinct, pool, suite-focused luxury · 8.8 Booking.com' , url: 'https://www.booking.com/hotel/au/crown-towers-melbourne.html' },
      { name: 'Park Hyatt Melbourne', note: 'Hyatt brand — Collins and Exhibition Streets, rooftop pool with CBD views, The Lounge afternoon tea, full-service spa · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/au/park-hyatt-melbourne.html' },
      { name: 'InterContinental Melbourne The Rialto', note: 'IHG brand — 1891 Rialto buildings on Collins Street, indoor pool, Alluvial Bar in the heritage atrium, central CBD · 8.9 Booking.com' , url: 'https://www.booking.com/hotel/au/intercontinental-melbourne-the-rialto.html' }
    ] },
    'abu-dhabi': { h: [
      { name: 'Emirates Palace Mandarin Oriental', note: 'Mandarin Oriental brand — iconic West Corniche, 1km private beach, pool and spa · 9.1 Booking.com', url: 'https://www.booking.com/hotel/ae/emirates-palace.html' },
      { name: 'Four Seasons Hotel Abu Dhabi at Al Maryah Island', note: 'Four Seasons brand — Al Maryah Island, rooftop pool with city views, near The Galleria · 9.2 Booking.com', url: 'https://www.booking.com/hotel/ae/four-seasons-abu-dhabi-at-al-maryah-island.html' },
      { name: 'Conrad Abu Dhabi Etihad Towers', note: 'Hilton Conrad brand — Etihad Towers on the Corniche, infinity pool, private beach area, spa with steam room · 9.2 Booking.com', url: 'https://www.booking.com/hotel/ae/conrad-abu-dhabi-etihad-towers.html' },
      { name: 'Park Hyatt Abu Dhabi Hotel and Villas', note: 'Hyatt brand — beachfront on Saadiyat Island, outdoor pool, tennis courts, full-service spa · 9.2 Booking.com', url: 'https://www.booking.com/hotel/ae/park-hyatt-abu-dhabi-and-villas.html' }
    ] },
    'aix-en-provence': { h: [
      { name: 'Le Pigonnet', note: 'Esprit de France — landscaped garden, outdoor pool, views of Mont Sainte-Victoire · 9.1 Booking.com', url: 'https://www.booking.com/hotel/fr/le-pigonnet.html' },
      { name: 'Villa Saint-Ange', note: 'Independent boutique — 18th-century bastide estate, heated pool, Provençal garden · 9.3 Booking.com', url: 'https://www.booking.com/hotel/fr/villa-saint-ange.html' },
      { name: 'Les Suites du Cours & Spa', note: 'Independent boutique — 5-star on Cours Mirabeau in the historic centre, spa with hot tub, soundproofed suites · 9.0 Booking.com', url: 'https://www.booking.com/hotel/fr/les-suites-du-cours.html' },
      { name: 'Château de la Gaude', note: 'Independent — 18th-century château estate north of the centre, heated infinity pool, spa with steam room, gardens · 9.1 Booking.com', url: 'https://www.booking.com/hotel/fr/chateau-de-la-gaude.html' }
    ] },
    'alaska': { h: [
      { name: 'Hotel Captain Cook', note: 'Independent — Anchorage landmark since 1965, three-tower downtown complex with on-site dining · 8.8 Booking.com' , url: 'https://www.booking.com/hotel/us/hotel-captain-cook.html' },
      { name: 'Marriott Anchorage Downtown', note: 'Marriott brand — indoor pool, largest downtown full-service hotel, West 7th Avenue · 7.9 Booking.com' , url: 'https://www.booking.com/hotel/us/anchorage-marriott-downtown.html' },
      { name: 'Hilton Anchorage', note: 'Hilton brand — renovated downtown tower, rooftop bar, on-site fitness centre · 8.1 Booking.com' , url: 'https://www.booking.com/hotel/us/hilton-anchorage.html' },
      { name: 'Sheraton Anchorage Hotel & Spa', note: 'Marriott Sheraton brand — full-service spa and indoor pool, central Anchorage location · 8.0 Booking.com' , url: 'https://www.booking.com/hotel/us/sheraton-anchorage.html' }
    ] },
    'alesund': { h: [
      { name: 'Hotel 1904', note: '', url: 'https://www.booking.com/hotel/no/hotel-1904.html' },
      { name: 'Thon Hotel Ålesund', note: 'Thon Hotels — central location, harbor-facing rooms · 8.7 Booking.com', url: 'https://www.booking.com/hotel/no/thon-alesund-alesund.html' },
      { name: 'Hotel Noreg', note: 'Independent — Kongensgate in the Art Nouveau centre, sauna, fitness centre, hot spring bath · 8.5 Booking.com', url: 'https://www.booking.com/hotel/no/hotel-noreg.html' },
      { name: 'Scandic Parken', note: 'Scandic brand — Storgata below Aksla hill, sauna, fitness centre, on-site restaurant · 8.5 Booking.com', url: 'https://www.booking.com/hotel/no/scandic-parken.html' }
    ] },
    'amalfi': { h: [
      { name: 'Hotel Santa Caterina', note: 'Independent family estate — 1880s cliffside villa, saltwater pool, sea-view terraces, Michelin-starred dining · 9.6 Booking.com', url: 'https://www.booking.com/hotel/it/santa-caterina-amalfi.html' },
      { name: 'Anantara Convento di Amalfi Grand Hotel', note: 'Anantara brand — converted 13th-century convent above town, infinity pool, dramatic coastal views · 9.1 Booking.com', url: 'https://www.booking.com/hotel/it/anantara-convento-di-amalfi-grand-hotel.html' },
      { name: 'Hotel Luna Convento', note: 'Independent — 13th-century clifftop convent on Via Pantaleone Comite, saltwater pool with sea views, cloister, Saracen tower bar · 9.0 Booking.com', url: 'https://www.booking.com/hotel/it/luna-convento-torre-saracena-sas.html' },
      { name: 'Hotel Antica Repubblica', note: 'Independent — historic centre off Salita Truglio, 170 m from the beach, soundproofed rooms, terrace · 9.6 Booking.com', url: 'https://www.booking.com/hotel/it/anticarepubblica.html' }
    ] },
    'amsterdam': { h: [
      { name: 'Waldorf Astoria Amsterdam', note: 'Waldorf Astoria brand — six 17th-century canal palaces on Herengracht, Guerlain Spa with pool, Michelin-recognized dining · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/nl/waldorf-astoria-amsterdam.html' },
      { name: 'InterContinental Amstel Amsterdam', note: 'IHG brand — landmark 1867 riverside building on the Amstel River, indoor pool and health club, river-terrace dining · 8.7 Booking.com' , url: 'https://www.booking.com/hotel/nl/amstel-inter-continental.html' },
      { name: 'Conservatorium Hotel Amsterdam', note: 'Design Hotels — converted 1901 music conservatory in the Museumkwartier, indoor pool and spa, brasserie, all rooms with 6m ceilings · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/nl/conservatorium.html' },
      { name: 'Hotel V Nesplein', note: 'Hotel V collection — trendy Nieuwmarkt-area design hotel, rooftop terrace bar, steps from Waterlooplein market and Rembrandtplein · 8.8 Booking.com' , url: 'https://www.booking.com/hotel/nl/v-nesplein.html' }
    ] },
    'annecy': { h: [
      { name: 'Impérial Palace Annecy', note: 'Independent — lakefront property in central Annecy, La Voile gastronomic restaurant with terrace, spa with pool and hammam · 8.8 Booking.com', url: 'https://www.booking.com/hotel/fr/imperial-palace.html' },
      { name: 'Le Clos des Sens', note: 'Independent boutique — 19th-century mansion in Annecy-le-Vieux, home to a three-Michelin-star restaurant (Laurent Petit) · 8.9 Booking.com' },
      { name: 'Rivage Hôtel & Spa Annecy', note: 'Independent — Avenue du Petit Port by the lake, year-round indoor pool, spa with steam room, sauna · 8.9 Booking.com', url: 'https://www.booking.com/hotel/fr/rivage-amp-spa-annecy.html' },
      { name: 'Les Trésoms Lake and Spa Resort', note: 'Independent — hillside on Boulevard de la Corniche with lake views, seasonal outdoor pool, spa, tennis court · 8.1 Booking.com', url: 'https://www.booking.com/hotel/fr/lestresomsannecy.html' }
    ] },
    'aracaju': { h: [
      { name: 'Vidam Hotel Aracaju - Transamerica Collection', note: 'Transamerica brand — full-service spa, outdoor pool, near Aracaju Oceanarium on Orla de Atalaia · 9.1 Booking.com', url: 'https://www.booking.com/hotel/br/radisson-aracaju.html' },
      { name: 'Hotel da Costa by Nobile', note: 'Nobile Hotels — beachfront on Orla de Atalaia, outdoor pool with sea view, breakfast highly rated · 8.8 Booking.com', url: 'https://www.booking.com/hotel/br/da-costa.html' },
      { name: 'Celi Hotel Aracaju', note: 'Independent — Orla de Atalaia beachfront, Atlantic Ocean views, Maramar Restaurant, rooftop pool · 8.9 Booking.com', url: 'https://www.booking.com/hotel/br/celi-aracaju.html' },
      { name: 'Quality Hotel Aracaju', note: 'Choice Hotels brand — semi-Olympic pool and spa, near Sergipe River and Beira-Mar Avenue · 8.8 Booking.com', url: 'https://www.booking.com/hotel/br/quality-aracaju.html' }
    ] },
    'arenal': { h: [
      { name: 'Nayara Springs', note: 'Small Luxury Hotels — adults-only, 35 private villas each with volcanic hot-spring plunge pool, Arenal Volcano views, 24-hour butler', url: 'https://www.booking.com/hotel/cr/nayara-springs.html' },
      { name: 'Tabacón Thermal Resort & Spa', note: 'Small Luxury Hotels — natural volcanic thermal river on-site, waterfalls and pools up to 100°F, 900+ acres of rainforest · 9.1 Booking.com', url: 'https://www.booking.com/hotel/cr/tabacon-grand-spa-thermal-resort.html' },
      { name: 'Lost Iguana Resort & Spa', note: 'Adults-only boutique — cloud-forest hillside, infinity pool with Arenal Volcano views · 9.0 Booking.com', url: 'https://www.booking.com/hotel/cr/lost-iguana-resort-spa.html' },
      { name: 'Arenal Kioro Suites & Spa', note: 'Independent — direct Arenal Volcano views, natural hot-springs pool complex, full-service spa · 8.9 Booking.com', url: 'https://www.booking.com/hotel/cr/arenal-kioro-suites-spa.html' }
    ] },
    'aruba': { h: [
      { name: 'Bucuti & Tara Beach Resort', note: '' },
      { name: 'Hyatt Regency Aruba Resort Spa & Casino', note: 'Hyatt brand — Palm Beach frontage, 8,000 sq ft pool complex with waterslide, adults-only pool, ZoiA Spa, casino on-site' },
      { name: 'Renaissance Wind Creek Aruba Resort', note: 'Marriott Renaissance brand — Oranjestad harbourfront, private beach area, rooftop and infinity pools, casino · 8.9 Booking.com', url: 'https://www.booking.com/hotel/aw/renaissance-aruba-resort-and-casino.html' },
      { name: 'Aruba Marriott Resort & Stellaris Casino', note: 'Marriott brand — beachfront on Palm Beach, heated pool with swim-up bar, spa, tennis court · 8.8 Booking.com', url: 'https://www.booking.com/hotel/aw/aruba-marriott-resort-stellaris-casino.html' }
    ] },
    'athens': { h: [
      { name: 'Hotel Grande Bretagne', note: 'Marriott Luxury Collection — 1874 landmark on Syntagma Square, Acropolis-view balconies, rooftop restaurant, indoor pool · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/gr/grande-bretagne.html' },
      { name: 'King George, a Luxury Collection Hotel, Athens', note: 'Marriott Luxury Collection — intimate 102-room boutique on Syntagma Square, rooftop Tudor Hall with Acropolis panorama · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/gr/king-george-palace.html' },
      { name: 'Electra Metropolis Athens', note: 'Electra Hotels — Mitropoleos Street in the historic centre, rooftop pool with Acropolis panorama, gym, modern Greek design · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/gr/electra-metropolis-athens.html' },
      { name: 'Hotel Athenaeum InterContinental Athens', note: 'IHG brand — Syngrou Avenue, large outdoor pool complex, full-service spa, 25-min walk to Acropolis · 8.7 Booking.com' , url: 'https://www.booking.com/hotel/gr/athenaeum-intercontinental.html' }
    ] },
    'atlanta': { h: [
      { name: 'Atlanta Marriott Marquis', note: 'Marriott family — iconic 52-story atrium, spa, outdoor pool, downtown Peachtree Center · 8.4 Booking.com', url: 'https://www.booking.com/hotel/us/atlanta-marriott-marquis.html' },
      { name: 'The Westin Peachtree Plaza, Atlanta', note: 'Marriott family — landmark 73-story cylinder tower, indoor/outdoor rooftop pool, city views · 8.5 Booking.com', url: 'https://www.booking.com/hotel/us/the-westin-peachtree-plaza.html' },
      { name: 'The St. Regis Atlanta', note: 'Marriott St. Regis brand — Buckhead on West Paces Ferry Road, heated outdoor pool with pool bar, spa, garden terrace · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/st-regis-buckhead-atlanta.html' },
      { name: 'Four Seasons Hotel Atlanta', note: 'Four Seasons brand — Midtown on 14th Street, year-round indoor pool, full-service spa, sauna · 8.5 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-atlanta.html' }
    ] },
    'austin': { h: [
      { name: 'JW Marriott Austin', note: 'Marriott family — rooftop pool and spa, 2nd Street dining district, downtown luxury · 8.6 Booking.com', url: 'https://www.booking.com/hotel/us/jw-marriott-austin.html' },
      { name: 'Hilton Austin', note: 'Hilton family — convention center adjacency, city-view rooms, downtown · 8.1 Booking.com', url: 'https://www.booking.com/hotel/us/hilton-austin.html' },
      { name: 'Hotel Van Zandt', note: "Hyatt Destination brand — Rainey Street Historic District, heated rooftop pool, live music, Geraldine's restaurant · 8.8 Booking.com", url: 'https://www.booking.com/hotel/us/van-zandt.html' },
      { name: 'W Austin', note: 'Marriott W brand — Downtown on Lavaca Street above ACL Live, rooftop pool with city views, AWAY spa · 8.6 Booking.com', url: 'https://www.booking.com/hotel/us/w-austin.html' }
    ] },
    'azores': { h: [
      { name: 'Delta Hotels by Marriott Azores', note: 'Marriott family — ocean or mountain views, outdoor pool, 10-min from downtown Ponta Delgada · 9.2 Booking.com', url: 'https://www.booking.com/hotel/pt/delta-hotels-by-marriott-azores.html' },
      { name: 'Grand Hotel Açores Atlântico', note: 'Independent — 5-star marina-facing landmark, heated indoor pool, 8 conference rooms · 9.3 Booking.com', url: 'https://www.booking.com/hotel/pt/acores-atlantico.html' },
      { name: 'Hotel Talisman', note: 'Independent boutique — historic center Ponta Delgada, rooftop pool, park views · 8.5 Booking.com', url: 'https://www.booking.com/hotel/pt/talisman.html' },
      { name: 'Mercure Ponta Delgada Azores', note: 'Accor brand — central Ponta Delgada, modern amenities, highly rated WiFi and location · 9.1 Booking.com', url: 'https://www.booking.com/hotel/pt/mercure-ponta-delgada-azores.html' }
    ] },
    'bahamas': { h: [
      { name: 'Courtyard by Marriott Nassau Downtown/Junkanoo Beach', note: 'Marriott family — Junkanoo Beach access, outdoor pool, downtown Nassau · 7.2 Booking.com', url: 'https://www.booking.com/hotel/bs/sunset-resort-bahamas-nassau.html' },
      { name: 'Atlantis Paradise Island', note: 'Independent mega-resort — Aquaventure water park, 11 pools, casino, over 40 restaurants on Paradise Island', url: 'https://www.booking.com/hotel/bs/atlantis-paradise-island.html' },
      { name: 'SLS Baha Mar', note: 'SLS brand — Cable Beach, swim-up suites, Hyde Beach club, Sora rooftop restaurant · 9.0 Booking.com', url: 'https://www.booking.com/hotel/bs/sls-baha-mar.html' },
      { name: 'Rosewood Baha Mar', note: 'Rosewood brand — Cable Beach, private beach, Sense spa, five pools, butlered bungalows · 9.1 Booking.com', url: 'https://www.booking.com/hotel/bs/rosewood-baha-mar.html' }
    ] },
    'bali': { h: [
      { name: 'Hyatt Regency Bali', note: 'Hyatt family — private beach, 3 pools, tropical gardens, Sanur · 9.0 Booking.com', url: 'https://www.booking.com/hotel/id/hyatt-regency-bali.html' },
      { name: 'InterContinental Bali Resort by IHG', note: 'IHG first-tier — 6 pools, beachfront Jimbaran Bay, spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/id/intercontinental-bali-resort.html' },
      { name: 'Four Seasons Resort Bali at Sayan', note: 'Four Seasons brand — Ubud jungle ridge above the Ayung River gorge, signature treetop restaurant, 2 pools, riverside spa · 9.5 Booking.com', url: 'https://www.booking.com/hotel/id/four-seasons-resort-bali-at-sayan.html' },
      { name: 'The St. Regis Bali Resort', note: 'Marriott Luxury Collection — Nusa Dua beachfront, private pool villas, 24-hr butler service, Kayuputi Pan-Asian dining · 9.7 Booking.com', url: 'https://www.booking.com/hotel/id/the-st-regis-bali-resort.html' }
    ] },
    'banff': { h: [
      { name: 'Fairmont Banff Springs', note: 'Fairmont brand — 1888 sandstone castle at the confluence of the Bow and Spray Rivers, 2 outdoor pools, full spa, fine-dining 1888 Chop House · 9.2 Booking.com', url: 'https://www.booking.com/hotel/ca/fairmont-banff-springs.html' },
      { name: 'The Rimrock Resort Hotel', note: 'Independent luxury — clifftop perch 6 km from downtown on Sulphur Mountain Road, panoramic six-range mountain views, Primrose dining room, full-service spa · 9.1 Booking.com', url: 'https://www.booking.com/hotel/ca/rimrock-resort-hotel.html' },
      { name: 'Banff Park Lodge', note: 'Independent — Lynx Street a block off Banff Avenue, year-round indoor pool, steam room, on-site dining · 8.7 Booking.com', url: 'https://www.booking.com/hotel/ca/banff-park-lodge.html' },
      { name: 'Mount Royal Hotel', note: 'Independent — 138 Banff Avenue in the town centre, rooftop hot tubs, ski storage, mountain-view rooms · 8.4 Booking.com', url: 'https://www.booking.com/hotel/ca/mount-royal-banff.html' }
    ] },
    'bangkok': { h: [
      { name: 'Mandarin Oriental Bangkok', note: 'Mandarin Oriental brand — 1876 Chao Phraya River landmark, celebrated Authors\' Wing, riverfront dining, Sala Rim Naam Thai restaurant · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/th/mandarin-oriental.html' },
      { name: 'The Peninsula Bangkok', note: 'Peninsula brand — all-suite riverside tower, rooftop infinity pool over the Chao Phraya, complimentary river ferry · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/th/peninsula-bangkok.html' },
      { name: 'Capella Bangkok', note: 'Capella brand — Chao Phraya riverside, 101 villas and suites, three pools, Côte by Mauro Colagreco dining, Auriga Spa · 9.6 Booking.com' , url: 'https://www.booking.com/hotel/th/capella-bangkok.html' },
      { name: 'Rosewood Bangkok', note: 'Rosewood brand — Ploenchit CBD skyline tower, rooftop pool, Nan Bei Chinese restaurant, Sense, a Rosewood Spa · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/th/rosewood-bangkok.html' }
    ] },
    'barbados': { h: [
      { name: 'Sandy Lane Hotel', note: 'Independent luxury — coral-stone manor on Sandy Lane Bay, 3 golf courses including the Tom Fazio Country Club, spa village · 9.6 Booking.com' },
      { name: 'Coral Reef Club', note: 'Independent boutique — adults-focused west coast retreat, private beach, lush tropical gardens, suites and cottages · 9.5 Booking.com', url: 'https://www.booking.com/hotel/bb/coral-reef-club.html' },
      { name: 'Colony Club by Elegant Hotels', note: 'Marriott Autograph Collection — Holetown beachfront, four pools with swim-up bar, water sports, Orchids restaurant' },
      { name: 'Crystal Cove by Elegant Hotels', note: 'Marriott Autograph Collection — Holetown coral-stone cove, adults-only pool, reef snorkeling, island-cottage feel' }
    ] },
    'barcelona': { h: [
      { name: 'Hotel Arts Barcelona', note: 'Ritz-Carlton brand — 44-floor beachfront tower at Port Olímpic, indoor and outdoor pools, sea-view rooms · 9.0 Booking.com', url: 'https://www.booking.com/hotel/es/arts-barcelona.html' },
      { name: 'Mandarin Oriental, Barcelona', note: 'Mandarin Oriental brand — Passeig de Gràcia design hotel, rooftop pool and spa terrace, acclaimed Blanc restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/es/mandarin-oriental-barcelona.html' },
      { name: 'Cotton House Hotel, Autograph Collection', note: 'Marriott Autograph — 1905 Casa Garriga Nogués on Gran Via, rooftop pool and terrace bar, The Cotton Club restaurant, Eixample · 9.2 Booking.com', url: 'https://www.booking.com/hotel/es/cotton-house-autograph-collection.html' },
      { name: 'W Barcelona', note: 'Marriott W brand — sail-shaped tower on Barceloneta beach, Eclipse rooftop bar, WET pool deck, direct beach access · 8.7 Booking.com', url: 'https://www.booking.com/hotel/es/w-barcelona.html' }
    ] },
    'beijing': { h: [
      { name: 'Rosewood Beijing', note: 'Rosewood brand — 57-floor Chaoyang CBD tower, rooftop infinity pool, spa, Michelin-recognized Sui Tang Li Chinese dining · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/cn/rosewood-beijing.html' },
      { name: 'Aman at Summer Palace', note: 'Aman brand — sole hotel at the Summer Palace gates, 51 courtyard-style suites, private moon-gate garden access · 9.5 Booking.com' , url: 'https://www.booking.com/hotel/cn/aman-at-summer-palace.html' },
      { name: 'The Peninsula Beijing', note: 'Peninsula brand — Wangfujing near the Forbidden City, indoor pool, Jing restaurant, Rolls-Royce fleet transfer, butler service · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/cn/the-peninsula-beijing.html' },
      { name: 'Park Hyatt Beijing', note: 'Hyatt brand — CCTV district skyline tower in Chaoyang, The East restaurant, rooftop bar, indoor pool, spa · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/cn/park-hyatt-beijing.html' }
    ] },
    'bend': { h: [
      { name: 'Oxford Hotel Bend', note: 'Curio Collection by Hilton — boutique downtown Bend, rooftop terrace, walking distance to Old Mill District and Drake Park · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/oxford-bend.html' },
      { name: 'Sunriver Resort', note: 'Independent full-service resort — 15 miles south of Bend, 4 golf courses, Sage Springs spa, outdoor pools, Deschutes River frontage · 8.9 Booking.com', url: 'https://www.booking.com/hotel/us/sun-river-resort.html' },
      { name: 'Riverhouse on the Deschutes', note: 'Independent — on the Deschutes River, indoor pool and hot tub, private beach access · 8.6 Booking.com', url: 'https://www.booking.com/hotel/us/riverhouse-on-the-deschutes.html' },
      { name: 'Lara House Lodge', note: 'Independent boutique — Drake Park, craftsman-style B&B on Mirror Pond, hot tub and sauna · 9.5 Booking.com' }
    ] },
    'bergen': { h: [
      { name: 'Hotel Norge by Scandic', note: 'Scandic brand — grand property on Ole Bulls plass, central Bergen, indoor pool and spa, celebrated Matbørsen restaurant · 8.8 Booking.com', url: 'https://www.booking.com/hotel/no/scandic-hotel-norge.html' },
      { name: 'Clarion Hotel Admiral', note: 'Nordic Choice Hotels — harbourfront position opposite Bryggen, Wharf-view rooms, rooftop bar with Puddefjorden panorama · 8.5 Booking.com', url: 'https://www.booking.com/hotel/no/clarion-admiral.html' },
      { name: 'Opus XVI', note: 'Small Luxury Hotels — Vågsallmenningen in Bergenhus, former bank building steps from Bryggen, fitness centre · 9.0 Booking.com', url: 'https://www.booking.com/hotel/no/opus-xvi.html' },
      { name: 'Bergen Børs Hotel', note: 'Independent — 5-star in the 1862 stock exchange on Vågsallmenningen, Bare restaurant, harbour-side location · 8.6 Booking.com', url: 'https://www.booking.com/hotel/no/bergen-bors.html' }
    ] },
    'berlin': { h: [
      { name: 'Regent Berlin', note: 'IHG Regent brand — Gendarmenmarkt address, neoclassical interiors, Fischers Fritz Michelin-starred dining, spa with pool · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/de/regent.html' },
      { name: 'Waldorf Astoria Berlin', note: 'Hilton brand — landmark Kurfürstendamm tower, Guerlain Spa, rooftop infinity pool with city panorama · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/de/waldorf-astoria-berlin.html' },
      { name: 'Hotel Adlon Kempinski', note: 'Kempinski brand — Pariser Platz beside the Brandenburg Gate, most iconic Berlin address, rooftop spa, Lorenz Adlon Esszimmer restaurant · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/de/adlon.html' },
      { name: 'Das Stue', note: 'Design Hotels — 1939 Danish Embassy conversion in Tiergarten, Cinco by Paco Pérez restaurant, spa with pool, 78 rooms · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/de/das-stue.html' }
    ] },
    'bhutan': { h: [
      { name: 'Zhiwaling Heritage', note: 'Independent Bhutanese-owned heritage hotel — Paro-Thimphu highway, hand-carved timber interiors, indoor heated pool, spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/bt/zhiwaling-heritage.html' },
      { name: 'Rema Resort', note: 'Independent Paro valley resort — garden setting, spa and wellness centre, airport shuttle, 24h reception · 9.1 Booking.com', url: 'https://www.booking.com/hotel/bt/rema-resort-paro1.html' },
      { name: 'Uma by COMO Paro', note: 'COMO brand — 200 acres at 7,400ft, heated pool, COMO Shambhala spa, tailored trek packages', url: 'https://www.booking.com/hotel/bt/uma-paro.html' },
      { name: 'Le Méridien Thimphu', note: 'Marriott Le Méridien brand — Thimphu valley, spa with altitude-adapted treatments, mountain views', url: 'https://www.booking.com/hotel/bt/le-meridien-thimphu.html' }
    ] },
    'big-island': { h: [
      { name: 'Mauna Kea Beach Hotel, Autograph Collection', note: 'Marriott Autograph Collection — iconic 1965 Kohala Coast resort by Laurance Rockefeller, private beach, 2 championship golf courses · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/mauna-kea-beach.html' },
      { name: 'Mauna Lani, Auberge Resorts Collection', note: 'Auberge brand — Kohala Coast, private snorkel beach, adults-only infinity pool, Naupaka Spa in lava fields · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/mauna-lani-auberge-resorts-collection.html' },
      { name: 'Fairmont Orchid', note: 'IHG Luxury & Lifestyle brand — 32-acre Kohala Coast beachfront resort, oceanfront pool, Spa Without Walls, direct beach access · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/the-fairmont-orchid.html' },
      { name: 'Hilton Waikoloa Village', note: 'Hilton brand — 62-acre lagoon resort with 3 pools, canal boat and monorail between buildings, dolphin interaction program · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/hilton-waikoloa-village.html' }
    ] },
    'bilbao': { h: [
      { name: 'Hotel Carlton Bilbao', note: 'Leading Hotels of the World — 1920s grand hotel near the old town, historic rooms where Hemingway and royalty stayed · 8.8 Booking.com', url: 'https://www.booking.com/hotel/es/carlton-bilbao.html' },
      { name: 'Meliá Bilbao', note: 'Meliá brand — contemporary tower beside the Guggenheim, spa, outdoor pool, city-view rooms · 8.7 Booking.com', url: 'https://www.booking.com/hotel/es/melia-bilbao.html' },
      { name: 'Hotel Miró', note: 'Independent boutique — Alameda Mazarredo between the Guggenheim and Fine Arts Museum, spa with hot tub, fitness centre · 9.1 Booking.com', url: 'https://www.booking.com/hotel/es/mirohotel.html' },
      { name: 'Hotel Ercilla de Bilbao, Autograph Collection', note: 'Marriott Autograph Collection — Calle Ercilla in the Ensanche, fitness centre, terrace, on-site Basque restaurant · 8.6 Booking.com', url: 'https://www.booking.com/hotel/es/gtercilla.html' }
    ] },
    'bologna': { h: [
      { name: 'I Portici Hotel Bologna', note: 'Preferred Hotels & Resorts — historic palazzo beneath the famous porticoes, Michelin-starred I Portici restaurant, spa · 9.2 Booking.com', url: 'https://www.booking.com/hotel/it/i-portici.html' },
      { name: 'Hotel Corona d\'Oro', note: 'Independent — 14th-century palazzo steps from Piazza Maggiore, frescoed ceilings, courtyard garden, tasteful historic interiors · 9.0 Booking.com', url: 'https://www.booking.com/hotel/it/hotel-corona-d-oro.html' },
      { name: 'Hotel Art Giovanni', note: 'Independent — Via Indipendenza near Piazza Maggiore, 16th-century palace, vaulted ceilings · 8.8 Booking.com', url: 'https://www.booking.com/hotel/it/art-hotel-commercianti.html' },
      { name: 'Grand Hotel Majestic già Baglioni', note: 'Independent — 18th-century palazzo, I Carracci restaurant with frescoed ceilings, full-service spa · 9.1 Booking.com', url: 'https://www.booking.com/hotel/it/grand-majestic-gia-baglioni.html' }
    ] },
    'bora-bora': { h: [
      { name: 'Four Seasons Resort Bora Bora', note: 'Four Seasons brand — overwater bungalows on private Motu Tehotu islet, lagoon snorkel beach, coral-garden reef access · 9.5 Booking.com', url: 'https://www.booking.com/hotel/pf/four-seasons-resort-bora-bora.html' },
      { name: 'The St. Regis Bora Bora Resort', note: 'Marriott Luxury Collection — private islet on the Bora Bora lagoon, overwater villas, Deep Ocean Spa, Butler service · 9.4 Booking.com', url: 'https://www.booking.com/hotel/pf/the-st-regis-bora-bora-resort.html' },
      { name: 'Le Bora Bora by Pearl Resorts', note: 'Pearl Resorts — Motu Tevairoa with overwater bungalows, private beach, spa, tennis court, lagoon water sports · 9.3 Booking.com', url: 'https://www.booking.com/hotel/pf/bora-bora-pearl-beach-resort-spa.html' },
      { name: 'InterContinental Bora Bora Le Moana Resort by IHG', note: 'IHG brand — Matira Point on the main island, overwater bungalows, private beach area, pool bar, diving and snorkelling · 9.2 Booking.com', url: 'https://www.booking.com/hotel/pf/intercontinental-bora-bora-le-moana-resort.html' }
    ] },
    'bordeaux': { h: [
      { name: 'InterContinental Bordeaux – Le Grand Hotel', note: "IHG brand — 1780 neoclassical palazzo on Place de la Comédie, rooftop pool with Grand Théâtre views, Le Pressoir d'Argent Gordon Ramsay restaurant · 9.0 Booking.com", url: 'https://www.booking.com/hotel/fr/grand-hotel-bordeaux-spa.html' },
      { name: 'Burdigala Hotel by HappyCulture', note: 'HappyCulture — design hotel in the Golden Triangle quarter, Vinothèque wine bar, central to Saint-Pierre and Chartrons · 8.9 Booking.com', url: 'https://www.booking.com/hotel/fr/burdigalabord.html' },
      { name: 'Le Palais Gallien Hôtel & Spa', note: "Independent — 5-star townhouse on Rue Abbé de l'Epée in the city centre, heated indoor and seasonal outdoor pools, spa, garden · 8.9 Booking.com", url: 'https://www.booking.com/hotel/fr/le-palais-gallien.html' },
      { name: 'Le Boutique Hotel & Spa', note: 'Independent — 5-star on Rue Lafaurie de Monbadon in the city centre, heated outdoor pool, spa with steam room, wine bar · 8.6 Booking.com', url: 'https://www.booking.com/hotel/fr/le-boutique-bordeaux.html' }
    ] },
    'boston': { h: [
      { name: 'Four Seasons Hotel Boston', note: 'Four Seasons brand — 200 Boylston Street, indoor pool overlooking the Public Garden, Bristol Lounge, steps from Boston Common · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-boston.html' },
      { name: 'Mandarin Oriental, Boston', note: 'Mandarin Oriental brand — Back Bay on Boylston Street, spa with hot tub, sauna, connected to Copley Place shops · 8.6 Booking.com', url: 'https://www.booking.com/hotel/us/mandarin-oriental-boston.html' },
      { name: 'The Newbury Boston', note: 'Marriott Autograph — 1927 Ritz-Carlton building on Newbury Street, rooftop Contessa Italian restaurant, curated interiors, Back Bay · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/the-newbury-boston.html' },
      { name: 'InterContinental Boston', note: 'IHG brand — 510 Atlantic Avenue on the Fort Point Channel waterfront, indoor pool, spa with steam room · 8.9 Booking.com', url: 'https://www.booking.com/hotel/us/intercontinental-boston.html' }
    ] },
    'boulder': { h: [
      { name: 'St Julien Hotel & Spa', note: 'Independent boutique — Ninth and Pearl Street, heated outdoor pool and terrace, spa, panoramic Flatirons mountain views · 9.0 Booking.com' },
      { name: 'Marriott Boulder', note: 'Marriott brand — Village Shopping Center at 28th and Canyon, outdoor pool, 10-min walk to Pearl Street · 7.8 Booking.com', url: 'https://www.booking.com/hotel/us/boulder-marriott.html' },
      { name: 'Hotel Boulderado', note: '1909 Pearl Street Mall landmark, atrium lobby, Q\'s restaurant · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/boulderado.html' },
      { name: 'Basecamp Boulder', note: 'Independent mountain-contemporary — downtown Pearl Street, fire pits, bike storage · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/hotel-arapahoe-ave-boulder.html' }
    ] },
    'bruges': { h: [
      { name: 'Hotel Heritage', note: 'Leading Hotels of the World — 15th-century mansion on Niklaas Desparsstraat, indoor pool, spa, refined brasserie · 9.4 Booking.com', url: 'https://www.booking.com/hotel/be/heritage.html' },
      { name: 'Hotel de Orangerie', note: 'Small Luxury Hotels — converted 15th-century nunnery on the Dijver canal, canal-view rooms, Les Jardins de Bruges restaurant · 9.2 Booking.com', url: 'https://www.booking.com/hotel/be/de-orangerie.html' },
      { name: 'Jan Brito Hotel', note: 'Independent — 16th-century manor in the historic center, garden, marble bathrooms · 9.3 Booking.com', url: 'https://www.booking.com/hotel/be/jan-brito.html' },
      { name: 'The Pand Hotel', note: 'Independent boutique — 18th-century townhouse on Pandreitje canal, antique décor · 9.4 Booking.com', url: 'https://www.booking.com/hotel/be/the-pand.html' }
    ] },
    'brussels': { h: [
      { name: 'Hotel Amigo', note: 'Rocco Forte brand — Renaissance-style building steps from Grand Place, art-curated interiors, Italian-influenced brasserie · 9.0 Booking.com', url: 'https://www.booking.com/hotel/be/amigo.html' },
      { name: 'Brussels Marriott Hotel Grand Place', note: 'Marriott brand — Rue Auguste Orts, rooftop terrace, steps from Grand Place and Sainte-Catherine quarter · 8.6 Booking.com', url: 'https://www.booking.com/hotel/be/brussels-marriott.html' },
      { name: 'Sofitel Brussels Le Louise', note: 'Sofitel brand — Avenue Louise luxury triangle, rooftop bar, full spa · 8.8 Booking.com', url: 'https://www.booking.com/hotel/be/sofitel-brussels-le-louise.html' },
      { name: 'Pillows Grand Boutique Hotel Place Rouppe Brussels', note: 'Pillows Hotels — former grand café, Art Deco heritage, Neni Brussels restaurant · 8.8 Booking.com', url: 'https://www.booking.com/hotel/be/pillows-grand-boutique-hotel-place-rouppe.html' }
    ] },
    'budapest': { h: [
      { name: 'Four Seasons Hotel Gresham Palace Budapest', note: 'Four Seasons brand — 1906 Art Nouveau palace at Chain Bridge, Danube-view rooms, spa, Kollázs Brasserie & Bar · 9.4 Booking.com', url: 'https://www.booking.com/hotel/hu/four-seasons-gresham-palace-budapest.html' },
      { name: 'Corinthia Budapest', note: 'Independent luxury — 1896 grand Victorian building in central Pest, Royal Spa, Brasserie & Atrium, indoor pool · 9.2 Booking.com', url: 'https://www.booking.com/hotel/hu/corinthiaroyal.html' },
      { name: 'Anantara New York Palace Budapest Hotel', note: 'Anantara brand — 1894 neo-baroque palace on Andrássy út, the most ornamented facade in Budapest, rooftop pool, spa · 9.2 Booking.com', url: 'https://www.booking.com/hotel/hu/new-york-palace-dedica-collection.html' },
      { name: 'Párisi Udvar Hotel Budapest', note: 'Hyatt Unbound Collection — converted 1909 Párisi Arcade in Belváros, indoor pool, eclectic historic interiors, Kollázs cafe in the atrium · 9.3 Booking.com', url: 'https://www.booking.com/hotel/hu/parisi-udvar-budapest-in-the-unbound-collection-by-hyatt.html' }
    ] },
    'buenos-aires': { h: [
      { name: 'Park Hyatt Buenos Aires', note: 'Hyatt brand — 1934 Palacio Duhau mansion merged with contemporary tower, Recoleta, Duhau Restaurant & Vinoteca, 3 pools · 9.4 Booking.com', url: 'https://www.booking.com/hotel/ar/park-hyatt-buenos-aires.html' },
      { name: 'Alvear Palace Hotel', note: 'Leading Hotels of the World — 1932 French Renaissance landmark in Recoleta, Alvear Art Restaurant, butler service · 9.5 Booking.com', url: 'https://www.booking.com/hotel/ar/alvear-palace.html' },
      { name: 'Four Seasons Hotel Buenos Aires', note: 'Four Seasons brand — Recoleta garden mansion tower, Le Mistral restaurant, outdoor pool, spa · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ar/four-seasons-buenos-aires.html' },
      { name: 'Faena Hotel Buenos Aires', note: 'Faena brand — Philippe Starck–designed waterfront tower in Puerto Madero, Rojo Tango dinner-show, rooftop pool · 9.2 Booking.com', url: 'https://www.booking.com/hotel/ar/faena-hotel-buenos-aires.html' }
    ] },
    'busan': { h: [
      { name: 'Park Hyatt Busan', note: 'Hyatt brand — Haeundae-gu, 38th-floor infinity pool with Gwangalli Bridge panorama, spa, ocean-view dining · 9.0 Booking.com', url: 'https://www.booking.com/hotel/kr/park-hyatt-busan.html' },
      { name: 'Westin Josun Busan', note: 'Marriott brand — Haeundae Beach, direct beachfront access, outdoor pool, full-service spa, panoramic sea views · 8.9 Booking.com', url: 'https://www.booking.com/hotel/kr/westin-josun-busan.html' },
      { name: 'Centara Grand Hotel Busan', note: 'Centara brand — Haeundae-gu tower, 20-minute drive from Seomyeon, ocean views, pool and spa, near Centum City · 8.6 Booking.com', url: 'https://www.booking.com/hotel/kr/centara-grand-hotel-busan.html' },
      { name: 'Novotel Ambassador Busan', note: 'Accor brand — Haeundae-gu, outdoor pool, business center, 10-min walk to Haeundae Beach, free airport shuttle · 8.2 Booking.com', url: 'https://www.booking.com/hotel/kr/novotel-ambassador-busan.html' }
    ] },
    'cairo': { h: [
      { name: 'Four Seasons Hotel Cairo at Nile Plaza', note: 'Four Seasons brand — Garden City Nile frontage, indoor pool, spa, panoramic city views across the river · 9.2 Booking.com', url: 'https://www.booking.com/hotel/eg/four-seasons-cairo-at-nile-plaza.html' },
      { name: 'Kempinski Nile Hotel Cairo', note: 'Kempinski brand — Garden City Nile address, rooftop pool, Osmanly Ottoman restaurant, full-service spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/eg/kempinski-nile-cairo.html' },
      { name: 'Marriott Mena House Cairo', note: 'Marriott brand — Giza, legendary 1869 lodge with direct Great Pyramid view, outdoor pool, 9-hole golf course, extensive gardens · 9.0 Booking.com', url: 'https://www.booking.com/hotel/eg/mena-house-oberoi.html' },
      { name: 'Cairo Marriott Hotel & Omar Khayyam Casino', note: 'Marriott brand — 1869 Gezira Palace on Zamalek island, outdoor pool, casino, garden setting, central Nile island location · 8.5 Booking.com', url: 'https://www.booking.com/hotel/eg/cairo-marriott-omar-khayyam-casino.html' }
    ] },
    'cambridge': { h: [
      { name: 'The Varsity Hotel & Spa', note: 'Independent boutique — Thompsons Lane, rooftop Glassworks restaurant, River Cam views, spa with rooftop pool · 9.1 Booking.com', url: 'https://www.booking.com/hotel/gb/the-varsity-spa.html' },
      { name: 'Graduate Cambridge', note: 'Graduate Hotels brand — Granta Place riverside, punting-at-the-door location on the Cam, boutique heritage interiors · 8.9 Booking.com', url: 'https://www.booking.com/hotel/gb/cambridge-cambridge.html' },
      { name: 'Gonville Hotel', note: 'Independent — Parker\'s Piece, Cotto restaurant and G2 Bar, 4-star · 8.9 Booking.com', url: 'https://www.booking.com/hotel/gb/gonville.html' },
      { name: 'Hotel du Vin Cambridge', note: 'Hotel du Vin brand — Trumpington Street Victorian building, classic bistro and wine cellar · 8.8 Booking.com', url: 'https://www.booking.com/hotel/gb/hotel-du-vin-and-bistro-cambridge.html' }
    ] },
    'cancun': { h: [
      { name: 'Nizuc Resort & Spa', note: 'Independent luxury — southernmost tip of the Hotel Zone, 5 pools, overwater hammam spa, private beach, adults-only · 9.2 Booking.com', url: 'https://www.booking.com/hotel/mx/nizuc-resort-amp-spa.html' },
      { name: 'Hyatt Zilara Cancun', note: 'Hyatt brand — adults-only all-inclusive, 3 oceanfront pools, 8 dining options, beachfront Hotel Zone · 9.0 Booking.com', url: 'https://www.booking.com/hotel/mx/the-royal-in-cancun.html' },
      { name: 'Le Blanc Spa Resort Cancun', note: 'OHL Hotels — adults-only all-inclusive beachfront, butler service, seven à la carte restaurants · 9.3 Booking.com', url: 'https://www.booking.com/hotel/mx/le-blanc-spa-resort-cancun.html' },
      { name: 'Secrets The Vine Cancun', note: 'AMResorts Secrets brand — adults-only all-inclusive Hotel Zone beachfront, unlimited gourmet dining · 8.9 Booking.com', url: 'https://www.booking.com/hotel/mx/secrets-the-vine-cancun.html' }
    ] },
    'cannes': { h: [
      { name: 'Carlton Cannes, a Regent Hotel', note: 'IHG Regent brand — iconic 1911 La Croisette palace, private beach concession, Belle Époque sea-view suites · 9.1 Booking.com', url: 'https://www.booking.com/hotel/fr/carlton-cannes-a-regent-hotel.html' },
      { name: 'Majestic Barrière Cannes', note: 'Barrière group — La Croisette landmark, two pools, private beach club, Fouquet\'s Cannes restaurant, full-service spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/fr/majestic-barriere.html' },
      { name: 'Five Seas by Inwood Hotels', note: 'Independent boutique — 5-star, 328 feet from La Croisette and Palais des Festivals, rooftop pool, full-service spa · 9.1 Booking.com', url: 'https://www.booking.com/hotel/fr/five.html' },
      { name: 'Mondrian Cannes', note: 'Mondrian brand — La Croisette, 75 rooms and suites with sea or city views, 8.9 Booking.com', url: 'https://www.booking.com/hotel/fr/grand-cannes.html' }
    ] },
    'cape-cod': { h: [
      { name: 'The Wequassett Resort and Golf Club', note: 'Independent luxury — Pleasant Bay waterfront in Harwich, 18-hole championship golf, 4 pools, spa with Cape Cod salt-air treatments · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/wequassett-resort-and-golf-club.html' },
      { name: 'Ocean Edge Resort & Golf Club', note: 'Independent resort — Brewster beachfront, 6 pools, oceanfront private beach, 18-hole golf, tennis and spa complex · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/the-mansion-at-ocean-edge-resort-amp-golf-club.html' },
      { name: 'Chatham Inn Relais & Châteaux', note: 'Independent Relais & Châteaux — Cape Cod\'s only R&C property, 18 rooms in 1839 historic inn, Cuvée restaurant rated top Cape Cod dining, Forbes Five-Star 2024 · Forbes Five-Star' },
      { name: 'Land\'s End Inn', note: 'Independent adults-only B&B — Victorian-era hilltop inn in Provincetown West End, panoramic bay views from Gull Hill, wine and cheese hour daily · 9.5 Kayak' }
    ] },
    'cape-town': { h: [
      { name: 'One&Only Cape Town', url: 'https://www.booking.com/hotel/za/one-and-only-cape-town.html', note: 'One&Only Resorts — V&A Waterfront, two-island resort layout, overwater spa, NOBU restaurant, two pools · 9.4 Booking.com' },
      { name: 'The Silo Hotel', url: 'https://www.booking.com/hotel/za/the-silo.html', note: 'Royal Portfolio — V&A Waterfront Silo District, converted grain silo, 28 rooms, panoramic rooftop bar, curated art collection · 9.0 Booking.com' },
      { name: 'Belmond Mount Nelson Hotel', url: 'https://www.booking.com/hotel/za/mount-nelson.html', note: 'Belmond — Gardens district, iconic pink hotel, 9 acres of gardens, spa, six restaurants and bars, direct Garden Route access · 9.2 Booking.com' },
      { name: 'The Twelve Apostles Hotel & Spa', url: 'https://www.booking.com/hotel/za/the-twelve-apostles.html', note: 'Red Carnation Hotels — Camps Bay, nestled between Twelve Apostles mountain and Atlantic, spa, movie theatre, two restaurants · 9.1 Booking.com' }
    ] },
    'capri': { h: [
      { name: 'J.K. Place Capri', note: 'Independent boutique — Marina Grande, 22 rooms, infinity sea-view pool, Forbes Five-Star-rated sun terraces · 9.6 Booking.com', url: 'https://www.booking.com/hotel/it/j-k-place-capri.html' },
      { name: 'Hotel Punta Tragara', note: 'Manfredi Collection — southern cliff above the Faraglioni, two outdoor pools, sea-view suites, Ristorante Punta Tragara · 9.0 Booking.com', url: 'https://www.booking.com/hotel/it/punta-tragara.html' },
      { name: 'Capri Palace Jumeirah', note: 'Jumeirah brand — Anacapri hilltop, two Michelin-star L\'Olivo, Olympic pool · 9.3 Booking.com', url: 'https://www.booking.com/hotel/it/capri-palace.html' },
      { name: 'Villa Brunella', note: 'Independent — Via Tragara south slope, terrace pool, restaurant with Faraglioni views · 9.3 Booking.com', url: 'https://www.booking.com/hotel/it/villa-brunella.html' }
    ] },
    'carmel-by-the-sea': { h: [
      { name: 'L\'Auberge Carmel, Relais & Châteaux', note: 'Auberge Resorts/Relais & Châteaux — downtown Carmel, 20 rooms, Aubergine restaurant, wine cellar, garden courtyard · 8.5 Booking.com', url: 'https://www.booking.com/hotel/us/auberge-carmel-relais-chateaux.html' },
      { name: 'Carmel Valley Ranch', note: 'Unbound Collection by Hyatt — Carmel Valley (9 mi inland), 181 suites, Pete Dye golf course, vineyard, full-service spa · 8.2 Booking.com' },
      { name: 'Quail Lodge & Golf Club', note: 'Independent — Carmel Valley, 18-hole golf, Edgar\'s Restaurant, pool and hot tub · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/quail-lodge-golf-club.html' },
      { name: 'Tradewinds Carmel', note: 'Independent — Asian garden retreat in the village, koi pond, two outdoor hot tubs · 9.6 Booking.com', url: 'https://www.booking.com/hotel/us/tradewinds.html' }
    ] },
    'cascais': { h: [
      { name: 'Palácio Estoril Hotel, Golf & Wellness', note: 'Leading Hotels of the World — Estoril seafront, 1930s palace with WWII spy-era heritage, golf course, casino adjacent · 8.9 Booking.com', url: 'https://www.booking.com/hotel/pt/palacio-estoril-golf.html' },
      { name: 'Grande Real Villa Itália Hotel & Spa', note: 'Real Hotels Group/Leading Hotels of the World — western Cascais clifftop, former Italian royal residence, sea-view gardens, spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/pt/grande-real-villa-italia.html' },
      { name: 'Farol Hotel Cascais', note: 'Independent — 19th-century clifftop mansion, infinity pool facing the Atlantic, Aroma restaurant · 9.0 Booking.com', url: 'https://www.booking.com/hotel/pt/farol-hotel.html' },
      { name: 'Pestana Cidadela Cascais Hotel', note: 'Pestana brand — inside a 16th-century citadel, pool with ocean views, marina location · 8.8 Booking.com', url: 'https://www.booking.com/hotel/pt/pestana-cidadela-cascais.html' }
    ] },
    'cayman-islands': { h: [
      { name: 'Kimpton Seafire Resort + Spa', note: 'IHG/Kimpton — Seven Mile Beach, full-service spa, rooftop bar, three pools, beachfront dining · 9.4 Booking.com', url: 'https://www.booking.com/hotel/ky/kimpton-seafire-resort-and-spa.html' },
      { name: 'Palm Heights', note: 'Independent boutique — Seven Mile Beach, design-forward rooms, spa, tropical gardens, curated wellness programming · 9.6 Booking.com', url: 'https://www.booking.com/hotel/ky/beach-suites.html' },
      { name: 'The Ritz-Carlton Grand Cayman', note: 'Ritz-Carlton — Seven Mile Beach, La Mer by Jean-Georges, four pools, Blue Tip golf · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ky/the-ritz-carlton.html' },
      { name: 'Grand Cayman Marriott Beach Resort', note: 'Marriott brand — Seven Mile Beach, two pools, Panorama Bar & Grille, water sports · 8.9 Booking.com', url: 'https://www.booking.com/hotel/ky/grand-cayman-marriott-beach-resort.html' }
    ] },
    'charlotte': { h: [
      { name: 'The Ritz-Carlton, Charlotte', note: 'Ritz-Carlton — Uptown Charlotte, two-level spa, rooftop garden, signature dining, skyline views · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/ritz-carlton-charlotte.html' },
      { name: 'JW Marriott Charlotte', note: 'JW Marriott — Uptown near Convention Center, rooftop lounge, spa, indoor pool, panoramic city views · 9.0 Booking.com' },
      { name: 'Omni Charlotte Hotel', note: 'Omni brand — Tryon Street in Uptown, indoor lap pool, Aria Italian restaurant · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/omni-charlotte.html' },
      { name: 'The Dunhill Hotel', note: 'Independent — 1929 Tryon Street landmark, boutique Asbury restaurant, old-world décor · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/dunhill.html' }
    ] },
    'chiang-mai': { h: [
      { name: 'Four Seasons Resort Chiang Mai', note: 'Four Seasons — Mae Rim Valley (15 km northwest of Old City), rice-terrace views, two infinity pools, spa, cooking classes · 9.7 Booking.com' , url: 'https://www.booking.com/hotel/th/four-seasons-resort-chiang-mai.html' },
      { name: 'Shangri-La Chiang Mai', note: 'Shangri-La — Ping River/Night Bazaar district, river-view pool, full-service spa, multiple restaurants · 8.9 Booking.com' , url: 'https://www.booking.com/hotel/th/shangri-la-chiang-mai.html' },
      { name: 'Anantara Chiang Mai Resort', note: 'Anantara brand — banks of the Mae Ping River near Night Bazaar, riverside pool, full-service spa, Sala Mae Rim restaurant · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/th/anantara-chiang-mai.html' },
      { name: 'Dhara Dhevi Chiang Mai', note: 'Independent — 60-acre Lanna-inspired estate, three pools, Le Grand Lanna restaurant in a century-old teak pavilion, spa village · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/th/dhara-dhevi-chiang-mai.html' }
    ] },
    'chicago': { h: [
      { name: 'The Langham, Chicago', note: 'Langham Hotels — 330 North Wabash Avenue in the IBM Building, Chuan Body & Soul Spa, indoor pool, kids club · 9.4 Booking.com', url: 'https://www.booking.com/hotel/us/the-langham-chicago.html' },
      { name: 'Waldorf Astoria Chicago', note: 'Waldorf Astoria/Hilton — Gold Coast (11 E Walton St), European-style spa, sauna, Art Deco interiors · 9.4 Booking.com', url: 'https://www.booking.com/hotel/us/chicago-11-walton.html' },
      { name: 'Four Seasons Hotel Chicago', note: 'Four Seasons brand — 120 East Delaware Place off Michigan Avenue, 50-foot indoor pool, Adorn Bar & Restaurant, full-service spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-chicago.html' },
      { name: 'Loews Chicago Hotel', note: 'Loews brand — 455 North Park Drive in Streeterville, indoor pool, close to Navy Pier and Magnificent Mile · 8.9 Booking.com', url: 'https://www.booking.com/hotel/us/loews-chicago.html' }
    ] },
    'chongqing': { h: [
      { name: 'Regent Chongqing', note: 'IHG/Regent — Jiefangbei CBD, Yangtze River views, spa, signature restaurants, complimentary minibar · 9.6 Booking.com' , url: 'https://www.booking.com/hotel/cn/regent-chongqing.html' },
      { name: 'JW Marriott Hotel Chongqing', note: 'JW Marriott — Jiefangbei CBD, indoor pool, full-service spa, Yangtze River views, multiple dining venues · 8.6 Booking.com' , url: 'https://www.booking.com/hotel/cn/jw-marriott-hotel-chongqing.html' },
      { name: 'InterContinental Chongqing Raffles City', note: 'IHG brand — Raffles City supertall, River Walk panoramic sky corridor, indoor pool, multiple outlets · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/cn/intercontinental-chongqing-raffles-city.html' },
      { name: 'W Chongqing', note: 'Marriott W brand — Jiefangbei nightlife district, WET rooftop pool deck, AWAY Spa, panoramic city-and-river views · 8.8 Booking.com' , url: 'https://www.booking.com/hotel/cn/w-chongqing.html' }
    ] },
    'cinque-terre': { h: [
      { name: 'La Torretta Lodge', note: 'Independent boutique — Manarola (medieval tower conversion), 12 rooms, rooftop hot tub, sea-view terrace · 9.0 Booking.com' },
      { name: 'Locanda Il Maestrale', note: 'Independent boutique — Monterosso al Mare old town, 18th-century palazzo, 6 rooms, frescoed ceilings, sea-view breakfast terrace · 9.4 Booking.com' },
      { name: 'Hotel Pasquale', note: 'Independent — Monterosso al Mare, family-run since 1956, sea-view terraces, Ligurian cuisine · 9.2 Booking.com' },
      { name: 'Hotel Villa Steno', note: 'Independent — Monterosso hillside, garden terraces with Gulf of Genoa views · 9.0 Booking.com', url: 'https://www.booking.com/hotel/it/villa-steno.html' }
    ] },
    'coeur-dalene': { h: [
      { name: 'The Coeur d\'Alene Resort', note: 'Independent — lakefront resort on Lake Coeur d\'Alene, floating green golf course, Beverly\'s 7th-floor restaurant with panoramic lake views, full-service spa · 8.9 Booking.com' },
      { name: 'Best Western Plus Coeur d\'Alene Inn', note: 'Best Western Plus — indoor pool and hot tub, on-site dining, minutes from downtown and the lake · 8.4 Booking.com', url: 'https://www.booking.com/hotel/us/coeur-d-alene-inn.html' },
      { name: 'Hampton Inn & Suites Coeur d\'Alene', note: 'Hilton Hampton brand — near McEuen Park, indoor pool, free hot breakfast · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/riverstone-drive-coeur-d-alene.html' },
      { name: 'Holiday Inn Express Coeur d\'Alene', note: 'IHG brand — central location, indoor pool, free breakfast bar, mountain-and-lake views · 8.5 Booking.com', url: 'https://www.booking.com/hotel/us/holiday-inn-express-suites-coeur-d-alene-i-90-exit-11.html' }
    ] },
    'colmar': { h: [
      { name: 'Hostellerie Le Maréchal', note: 'Independent — Petite Venise canalside address on the Lauch River, Le Vier Poisson gastronomic restaurant, half-timbered canal-view rooms in the Little Venice quarter · 9.2 Booking.com' },
      { name: 'La Maison des Têtes', note: 'Independent — 1609 Renaissance mansion in Colmar\'s Old Town, award-winning French-Alsatian dining, historic stone facade with 111 sculpted heads · 8.9 Booking.com' },
      { name: 'Le Colombier Hôtel', note: 'Independent — 14th-century half-timbered house in Petite Venise, spa with hot tub and sauna · 9.2 Booking.com', url: 'https://www.booking.com/hotel/fr/le-colombier.html' },
      { name: 'Grand Hôtel Bristol Colmar', note: 'Independent — 19th-century grande dame on Place de la Gare, Rendez-Vous restaurant · 8.5 Booking.com', url: 'https://www.booking.com/hotel/fr/grand-bristol.html' }
    ] },
    'cologne': { h: [
      { name: 'Hyatt Regency Cologne', note: 'Hyatt brand — Rhine riverbank, 306 rooms and suites, Regency Executive Suite with Rhine and Cologne Cathedral panorama, Glashaus Restaurant & Bar · 8.5 Booking.com', url: 'https://www.booking.com/hotel/de/hyatt-regency-koln.html' },
      { name: 'Cologne Marriott Hotel', note: 'Marriott brand — central Cologne, 3-min walk to Cologne Cathedral and Hauptbahnhof, contemporary rooms, modern fitness center · 8.3 Booking.com', url: 'https://www.booking.com/hotel/de/cologne-marriott.html' },
      { name: 'DOM Hotel Cologne', note: 'Independent — directly opposite the Cathedral, rooftop terrace with Dom views, Restaurant Pinocchio · 9.0 Booking.com', url: 'https://www.booking.com/hotel/de/dom-koeln.html' },
      { name: 'Excelsior Hotel Ernst Cologne', note: 'Independent — 1863 grande dame facing the Cathedral, Hanse Stube restaurant, spa with indoor pool · 9.2 Booking.com', url: 'https://www.booking.com/hotel/de/excelsior-ernst.html' }
    ] },
    'colombo': { h: [
      { name: 'Shangri-La Colombo', note: 'Shangri-La brand — between Galle Face Green and Beira Lake, Indian Ocean views, Chi Spa, multiple dining venues including Graze Kitchen · 8.5 Booking.com', url: 'https://www.booking.com/hotel/lk/shangri-la-colombo.html' },
      { name: 'Cinnamon Grand Colombo', note: 'Cinnamon Hotels & Resorts — 501-room city landmark near World Trade Center and Independence Square, multiple dining venues, outdoor pool, spa · 8.6 Booking.com', url: 'https://www.booking.com/hotel/lk/cinnamon-grand-colombo.html' },
      { name: 'Galle Face Hotel', note: 'Independent — 1864 colonial landmark on the Galle Face seafront, ocean views, historic bar · 8.5 Booking.com', url: 'https://www.booking.com/hotel/lk/galle-face.html' },
      { name: 'Taj Samudra Colombo', note: 'Taj Hotels brand — Galle Face beachfront, four restaurants, outdoor pool, full-service spa · 8.6 Booking.com', url: 'https://www.booking.com/hotel/lk/taj-samudra-colombo.html' }
    ] },
    'columbia': { h: [
      { name: 'Hotel Trundle', note: 'Independent boutique — Main Street District, art deco-inspired interiors celebrating Columbia\'s arts scene, rooftop bar with city views · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/trundle.html' },
      { name: 'Hilton Columbia Center', note: 'Hilton brand — downtown Columbia, Whiskey Bar rooftop with skyline views, close to the Vista arts and dining district · 8.3 Booking.com', url: 'https://www.booking.com/hotel/us/hilton-columbia-center.html' },
      { name: 'Hyatt Place Columbia/Downtown/The Vista', note: 'Hyatt brand — Vista entertainment district, indoor heated saltwater pool, complimentary breakfast, walking distance to South Carolina State Museum and the arts scene · 8.1 Booking.com', url: 'https://www.booking.com/hotel/us/hyatt-place-columbia-47-downtown-47-the-vista.html' },
      { name: 'SpringHill Suites Columbia Downtown The Vista', note: 'Marriott brand — all-suite hotel in the Vista, indoor swimming pool, fitness center, bar, adjacent to South Carolina State Museum and Columbia Museum of Art · 8.1 Booking.com', url: 'https://www.booking.com/hotel/us/springhill-suites-columbia-downtown-the-vista.html' }
    ] },
    'copenhagen': { h: [
      { name: 'Hotel d\'Angleterre', note: 'Leading Hotels of the World — 1755 landmark on Kongens Nytorv, Michelin-starred Restaurant Marchal, spa with indoor pool, direct access to Strøget shopping · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/dk/dangleterre.html' },
      { name: 'Nimb Hotel', note: 'Independent boutique — 17 rooms inside Tivoli Gardens, Nimb Terrasse brasserie, members-only Nimb Bar, private garden access year-round · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/dk/nimb.html' },
      { name: 'Nobis Hotel Copenhagen', note: 'Nobis Hospitality — converted 1896 Royal Danish Music Conservatory, Brasserie Nobis, rooftop terrace, design interiors · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/dk/nobis-copenhagen.html' },
      { name: 'Villa Copenhagen', note: 'Design Hotels — converted 1909 Post & Telegraph headquarters opposite Tivoli, outdoor heated pool, BRASSERIE CENTRAL, spa · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/dk/villa-copenhagen.html' }
    ] },
    'corfu': { h: [
      { name: 'Kontokali Bay Resort & Spa', note: 'Independent — beachfront north of Corfu Town, 11-treatment-room spa, water sports center, multiple pools and beach restaurants · 9.4 Booking.com' },
      { name: 'Domes Miramare, a Luxury Collection Resort, Corfu', note: 'Marriott Luxury Collection — adults-only, Moraitika beachfront on the Ionian, overwater pool-bungalow suites, spa and infinity pool · 9.1 Booking.com', url: 'https://www.booking.com/hotel/gr/domes-miramare-corfu.html' },
      { name: 'MarBella Corfu Hotel', note: 'Independent — Agios Ioannis Peristeron beach, multiple pools, thalassotherapy spa · 8.7 Booking.com', url: 'https://www.booking.com/hotel/gr/marbella-corfu.html' },
      { name: 'Grecotel Corfu Imperial', note: 'Grecotel brand — private peninsula in Kommeno Bay, three beaches, thalasso spa · 8.9 Booking.com', url: 'https://www.booking.com/hotel/gr/grecotel-corfu-imperial.html' }
    ] },
    'crete': { h: [
      { name: 'Galaxy Hotel Iraklio', note: 'Independent 5-star — Heraklion\'s central elegant district, two on-site restaurants, freshwater outdoor pool, wellness and fitness center · 8.6 Booking.com', url: 'https://www.booking.com/hotel/gr/galaxy-heraklion.html' },
      { name: 'Lato Boutique Hotel', note: 'Independent boutique — Old Town Heraklion near the Venetian harbour, Brilliant Cuisine rooftop restaurant with Koules Fortress and sea panoramas · 8.4 Booking.com', url: 'https://www.booking.com/hotel/gr/lato-boutique-hotel.html' },
      { name: 'Capsis Astoria City Center Hotel', note: 'Independent 4-star — central Heraklion near Eleftherias Square, contemporary rooms, rooftop pool, walking distance to the Archaeological Museum · 8.1 Booking.com', url: 'https://www.booking.com/hotel/gr/capsis-astoria.html' },
      { name: 'Olive Green Hotel', note: 'Independent eco-boutique — sustainable 4-star near the city port, bike-friendly, organic breakfast, 8-min walk to the Heraklion waterfront · 8.7 Booking.com', url: 'https://www.booking.com/hotel/gr/olive-green-hotel.html' }
    ] },
    'curacao': { h: [
      { name: 'Baoase Luxury Resort', note: 'Independent boutique — adults-only, private beach on Piscadera Bay, Baoase Culinary Beach restaurant, full-service spa · 9.4 Booking.com' },
      { name: 'Mangrove Beach Corendon Curacao Resort, Curio Collection by Hilton', note: 'Hilton Curio — beachfront, aqua park, spa, multiple pools and dining, 10-min from Willemstad\'s historic waterfront · 8.7 Booking.com', url: 'https://www.booking.com/hotel/cw/corendon-mangrove-beach-resort.html' },
      { name: 'Avila Beach Hotel', note: 'Independent — historic 1780 mansion on Penstraat beach, Blues Music Bar, diving centre · 8.8 Booking.com', url: 'https://www.booking.com/hotel/cw/avila-beach-hotel.html' },
      { name: 'Renaissance Wind Creek Curaçao Resort', note: 'Renaissance brand — Punda waterfront, casino, full-service spa, harbour location · 8.7 Booking.com', url: 'https://www.booking.com/hotel/cw/renaissance-curacao-resort-casino.html' }
    ] },
    'curitiba': { h: [
      { name: 'QOYA Hotel Curitiba, Curio Collection by Hilton', note: 'Hilton Curio — upscale Batel district, heated indoor pool, saunas, 7-min walk to Arena da Baixada, contemporary Brazilian design · 8.9 Booking.com', url: 'https://www.booking.com/hotel/br/qoya-curitiba-curitiba.html' },
      { name: 'Nomaa Hotel', note: 'Independent boutique — Batel, 5-star, Nomade Restaurant with seasonal Brazilian tasting menu, intimate rooftop deck · 9.2 Booking.com', url: 'https://www.booking.com/hotel/br/nomaa.html' },
      { name: 'Grand Mercure Curitiba', note: 'Accor Grand Mercure — Batel district, outdoor pool, Armazém do Chef restaurant · 8.5 Booking.com', url: 'https://www.booking.com/hotel/br/grand-mercure-curitiba.html' },
      { name: 'Hotel Slaviero Conceptual Palace', note: 'Slaviero Hotels — near Passeio Público park, art-deco architecture, spa with sauna · 8.8 Booking.com', url: 'https://www.booking.com/hotel/br/slaviero-palace.html' }
    ] },
    'cusco': { h: [
      { name: 'Belmond Hotel Monasterio', note: 'Belmond brand — converted 16th-century monastery in San Blas, oxygen-enriched rooms for altitude, courtyard chapel, 122 rooms · 9.0 Booking.com', url: 'https://www.booking.com/hotel/pe/monasterio-cusco.html' },
      { name: 'Inkaterra La Casona', note: 'Preferred Hotels & Resorts — 16th-century colonial manor on Plaza de las Nazarenas, 11 suites with original Inca stonework, butler service · 9.2 Booking.com' },
      { name: 'Palacio del Inka, a Luxury Collection Hotel', note: 'Marriott Luxury Collection — Inca palace foundations on Plazoleta Santo Domingo, spa, Inti Raymi restaurant · 9.1 Booking.com', url: 'https://www.booking.com/hotel/pe/palacio-del-inka.html' },
      { name: 'Hotel Monasterio Cuzco', note: 'Belmond managed — 16th-century San Antonio Abad seminary, baroque chapel, altitude oxygen service · 9.2 Booking.com', url: 'https://www.booking.com/hotel/pe/hotel-monasterio.html' }
    ] },
    'dallas': { h: [
      { name: 'Rosewood Mansion on Turtle Creek', note: 'Rosewood brand — 1925 Tudor mansion in Uptown, outdoor heated pool and terrace, acclaimed Restaurant at Rosewood Mansion, full-service spa · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/us/rosewood-mansion-on-turtle-creek.html' },
      { name: 'The Ritz-Carlton, Dallas', note: "Ritz-Carlton brand — Uptown at McKinney and Maple, indoor pool, Ellie's Restaurant and Lounge, 24-hour butler · 8.8 Booking.com" , url: 'https://www.booking.com/hotel/us/the-ritz-carlton-dallas.html' },
    
      { name: 'The Joule Dallas', note: 'Independent boutique — Arts District, rooftop pool cantilevered over Main Street, Charlie Palmer restaurant, spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/the-joule.html' },
      { name: 'Hotel ZaZa Dallas', note: 'Independent boutique — Uptown near McKinney Avenue, resort pool, Dragonfly restaurant, ZaSpa, themed suites · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/hotel-zaza-dallas.html' }
    ] },
    'denver': { h: [
      { name: 'The Brown Palace Hotel and Spa, Autograph Collection', note: 'Marriott Autograph — 1892 triangular-atrium landmark in downtown Denver, Ship Tavern, three-level spa, indoor pool · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/the-brown-palace-and-spa-autograph-collection.html' },
      { name: 'Four Seasons Hotel Denver', note: 'Four Seasons brand — LoDo district, rooftop heated outdoor pool with mountain views, EDGE Restaurant & Bar, spa · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-denver.html' },
      { name: 'The Oxford Hotel', note: "Independent boutique — LoDo's oldest hotel (1891), private health club and spa, McCormick's Fish House, historic Cruise Room cocktail bar · 8.9 Booking.com", url: 'https://www.booking.com/hotel/us/the-oxford-downtown-denver.html' },
      { name: 'The Crawford Hotel', note: 'Independent boutique — inside Denver Union Station, 122 rooms, Tesla car service, spa access, Union Station dining and bars steps away · 8.6 Booking.com', url: 'https://www.booking.com/hotel/us/the-crawford-at-union-station-denver.html' }
    ] },
    'doha': { h: [
      { name: 'Four Seasons Hotel Doha', note: 'Four Seasons brand — private beach on the West Bay Corniche, 3 outdoor pools, Nobu Doha restaurant, spa and wellness centre · 9.3 Booking.com', url: 'https://www.booking.com/hotel/qa/four-seasons-doha.html' },
      { name: 'Mandarin Oriental, Doha', note: 'Mandarin Oriental brand — Pearl-Qatar island, marina and skyline views, The Spa at Mandarin Oriental, five dining venues · 9.1 Booking.com', url: 'https://www.booking.com/hotel/qa/mandarin-oriental-doha.html' },
      { name: 'Banana Island Resort Doha by Anantara', note: 'Anantara brand — private island 20 min by ferry, overwater villas, six pools, Anantara Spa · 9.2 Booking.com', url: 'https://www.booking.com/hotel/qa/banana-island-resort.html' },
      { name: 'The St. Regis Doha', note: 'Marriott St. Regis brand — West Bay, Iridium Spa, butler service, multiple fine-dining venues · 9.0 Booking.com', url: 'https://www.booking.com/hotel/qa/the-st-regis-doha.html' }
    ] },
    'dubai': { h: [
      { name: 'Atlantis The Palm', note: 'Independent — Palm Jumeirah iconic resort, 1.5 km private beach, Aquaventure waterpark, 17 restaurants including Nobu, full-service spa · 8.8 Booking.com', url: 'https://www.booking.com/hotel/ae/atlantis-the-palm.html' },
      { name: 'Burj Al Arab Jumeirah', note: 'Jumeirah brand — sail-shaped island icon, all-suite, private beach, Al Muntaha sky-high restaurant, 24-hour butler · 9.5 Booking.com' },
      { name: 'One&Only The Palm', note: 'One&Only — adults-only on Palm Jumeirah, private beach, three pools, Guerlain Spa · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ae/one-and-only-the-palm.html' },
      { name: 'Jumeirah Beach Hotel', note: 'Jumeirah brand — 26-story wave-shaped tower, 20 restaurants and bars, Wild Wadi Waterpark access · 8.8 Booking.com', url: 'https://www.booking.com/hotel/ae/jumeirah-beach-hotel.html' }
    ] },
    'dublin': { h: [
      { name: 'The Merrion Hotel', note: 'Leading Hotels of the World — four Georgian townhouses on Merrion Street Upper, National Gallery adjacent, indoor pool and spa, Cellar Restaurant · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/ie/merrion-dublin.html' },
      { name: 'The Shelbourne, Autograph Collection', note: "Marriott Autograph — 1824 landmark on St Stephen's Green, Lord Mayor's Lounge afternoon tea, Saddle Room restaurant, spa · 8.9 Booking.com" , url: 'https://www.booking.com/hotel/ie/the-shelbourne.html' },
      { name: 'InterContinental Dublin', note: 'IHG brand — Ballsbridge, indoor pool, Spa InterContinental, Number 23 restaurant, leafy residential quarter 2km from city centre · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/ie/intercontinental-dublin.html' },
      { name: 'The Westbury Dublin', note: 'Doyle Collection — Grafton Street shopping district, Balfes restaurant and Wilde bar, central city heart location · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/ie/westbury.html' }
    ] },
    'dubrovnik': { h: [
      { name: 'Villa Dubrovnik', note: 'Small Luxury Hotels — clifftop boutique south of the Old Town walls, private boat shuttle, infinity pool over the Adriatic, open-fire Restaurant · 9.5 Booking.com', url: 'https://www.booking.com/hotel/hr/villa-dubrovnik-dubrovnik.html' },
      { name: 'Hotel Excelsior Dubrovnik', note: 'Independent luxury — seafront promenade steps from Pile Gate, panoramic Lokrum and Old Town views, pools, Sensori Wellness Spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/hr/hotelexcelsiordubrovnik.html' },
      { name: 'Hotel Stari Grad', note: 'Independent — inside Dubrovnik\'s walled city, 8-room boutique, rooftop terrace with Old Town views · 9.4 Booking.com', url: 'https://www.booking.com/hotel/hr/stari-grad.html' },
      { name: 'Bellevue Hotel Dubrovnik', note: 'Independent — clifftop above a private cove, sea-view rooms, outdoor pool, Vapor restaurant · 9.1 Booking.com', url: 'https://www.booking.com/hotel/hr/bellevue-dubrovnik.html' }
    ] },
    'edinburgh': { h: [
      { name: 'The Balmoral', note: 'Rocco Forte brand — 1902 Waverley Station clock-tower landmark, Number One Michelin-starred restaurant, indoor pool and spa, Castle-view suites · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/gb/the-balmoral.html' },
      { name: 'InterContinental Edinburgh The George', note: 'IHG first-tier — Georgian townhouses on George Street, Tempus Restaurant and Bar, spa · 8.8 Booking.com' , url: 'https://www.booking.com/hotel/gb/intercontinental-edinburgh-the-george.html' },
      { name: 'The Scotsman Hotel', note: 'Independent — converted 1905 Scotsman newspaper HQ on North Bridge, Vermilion restaurant, rooftop Scottish hot tub suite · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/gb/the-scotsman.html' },
      { name: 'G&V Royal Mile Hotel Edinburgh', note: 'G&V Hotels — Royal Mile Gothic building, Cucina restaurant, rooftop suites with castle views, boutique design interiors · 8.9 Booking.com' , url: 'https://www.booking.com/hotel/gb/gv-royal-mile-hotel-edinburgh.html' }
    ] },
    'florence': { h: [
      { name: 'Hotel Savoy Florence', note: "Rocco Forte brand — Piazza della Repubblica address, L'Incontro restaurant, rooftop terrace overlooking the Duomo and Campanile, spa · 9.1 Booking.com", url: 'https://www.booking.com/hotel/it/savoy-firenze.html' },
      { name: 'The St. Regis Florence', note: 'Marriott Luxury Collection — 19th-century Palazzo Cerretani on Piazza Ognissanti, Arno views, Ineo Restaurant, butler service · 9.3 Booking.com', url: 'https://www.booking.com/hotel/it/grandhotelflorence.html' },
      { name: 'Four Seasons Hotel Firenze', note: 'Four Seasons — 15th-century Palazzo della Gherardesca, 11-acre private garden with pool, Il Palagio restaurant · 9.4 Booking.com', url: 'https://www.booking.com/hotel/it/four-seasons-firenze.html' },
      { name: 'Portrait Firenze', note: 'Lungarno Collection — 14 riverfront suites on the Arno above the Ponte Vecchio · 9.5 Booking.com', url: 'https://www.booking.com/hotel/it/portrait-firenze.html' }
    ] },
    'florianopolis': { h: [
      { name: "Costão do Santinho Resort Golf & Spa", note: "Independent resort — northern Santinho beach, 4.5 km private beachfront, 14 pools, spa, golf, one of Brazil's largest beach resorts · 8.9 Booking.com" },
      { name: 'Majestic Palace Hotel', note: 'Independent — Beira Mar Norte waterfront, rooftop pool with bay panorama, on-site restaurant, central Florianópolis · 8.5 Booking.com', url: 'https://www.booking.com/hotel/br/majestic-palace.html' },
      { name: 'Blue Tree Premium Florianópolis', note: 'Blue Tree Hotels — Beira Mar Norte, indoor pool and fitness, Saveur restaurant · 8.7 Booking.com', url: 'https://www.booking.com/hotel/br/blue-tree-premium-florianopolis.html' },
      { name: 'Costão do Santinho Resort Golf & Spa', note: 'Independent — Santinho Beach north coast, 18-hole golf, six pools, Costão Spa · 8.8 Booking.com', url: 'https://www.booking.com/hotel/br/costao-do-santinho-resort-golf-e-spa.html' }
    ] },
    'florida-keys': { h: [
      { name: 'Casa Marina Key West, Curio Collection by Hilton', note: "Hilton Curio brand — 1920 Flagler oceanfront resort, Key West's largest, private beach, two pools, Atlantic-view rooms · 8.5 Booking.com", url: 'https://www.booking.com/hotel/us/casa-marina-resort-the-waldorf-astoria-collection.html' },
      { name: 'Opal Key Resort & Marina', note: 'Independent luxury — Key West harbour and marina setting, free-form pool, sunset deck, private dock, tropical grounds · 8.6 Booking.com' },
      { name: 'The Reach Key West, Curio Collection by Hilton', note: 'Hilton Curio brand — Simonton Beach, private beach on the Atlantic, full-service resort, three pools, at the quiet end of Duval Street · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/the-reach-resort-the-waldorf-astoria-colelction.html' },
      { name: 'Southernmost Beach Resort', note: 'Independent boutique — Atlantic beachfront on South Beach, private beach access, two pools, five-minute walk to Duval Street · 8.3 Booking.com' }
    ] },
    'fortaleza': { h: [
      { name: 'Gran Marquise Hotel', note: 'Independent luxury — Meireles Av. Beira Mar beachfront, rooftop pool with Atlantic views, top-rated address in Fortaleza · 9.2 Booking.com', url: 'https://www.booking.com/hotel/br/gran-marquise.html' },
      { name: 'Luzeiros Hotel Fortaleza', note: 'Independent — Meireles beachfront, sea-view pool, steps from Iracema Beach nightlife and restaurants · 8.4 Booking.com', url: 'https://www.booking.com/hotel/br/luzeiros.html' },
      { name: 'Othon Palace Fortaleza', note: 'Othon Hotels — Meireles beachfront, rooftop pool with sea view, Athenas restaurant · 8.6 Booking.com', url: 'https://www.booking.com/hotel/br/othon-palace-fortaleza.html' },
      { name: 'Marina Park Hotel', note: 'Independent — Aldeota waterfront with Fortaleza Bay views, outdoor pool, rooftop bar · 8.6 Booking.com', url: 'https://www.booking.com/hotel/br/marina-park.html' }
    ] },
    'foz-do-iguacu': { h: [
      { name: 'Mabu Thermas Grand Resort', note: 'Independent resort — Foz do Iguaçu city, thermal pool complex, spa, 5 pools, 3km from downtown · 8.8 Booking.com' },
      { name: 'Bourbon Cataratas Convention & Spa Resort', note: 'Independent full-service resort — 7km from the falls, 3 pools, sports facilities, convention centre · 8.5 Booking.com' },
      { name: 'Hotel Das Cataratas, A Belmond Hotel', note: 'Belmond brand — the only hotel inside Iguaçu National Park, 1,700m from the falls, outdoor pool · 9.2 Booking.com', url: 'https://www.booking.com/hotel/br/das-cataratas-a-belmond-hotel.html' },
      { name: 'Rafain Palace Hotel & Convention', note: 'Independent — Porto Canoas zone, outdoor pool and water park, near falls access · 8.5 Booking.com', url: 'https://www.booking.com/hotel/br/rafain-palace.html' }
    ] },
    'frankfurt': { h: [
      { name: 'Steigenberger Frankfurter Hof', note: 'Steigenberger brand — 1876 Kaiserplatz landmark, Michelin-recognized The Faces restaurant, historic grand-hotel address · 8.7 Booking.com', url: 'https://www.booking.com/hotel/de/steigenberger-frankfurter-hof.html' },
      { name: 'Villa Kennedy', note: 'Rocco Forte brand — 1901 Sachsenhausen patrician villa, garden pool, Vigna restaurant, spa, 15-minute walk to Römer · 9.0 Booking.com' },
      { name: 'Jumeirah Frankfurt', note: 'Jumeirah brand — Westend tower with panoramic city views, spa, pool, rooftop terrace, 10-minute walk to Alte Oper · 8.9 Booking.com' },
      { name: 'Hotel Hessischer Hof', note: 'Independent grand hotel — 1952 address near Alte Oper and Messe, decorated with Hessian art collection, restaurant Sèvres · 8.6 Booking.com' }
    ] },
    'galapagos-islands': { h: [
      { name: 'Finch Bay Ecolodge', note: 'Relais & Châteaux eco-resort at Finch Bay — naturalist-guided excursions, pool, pier with direct water-taxi access to Las Grietas, most prestigious address on Santa Cruz · 9.2 Booking.com', url: 'https://www.booking.com/hotel/ec/finch-bay.html' },
      { name: 'Hotel Ikala Galapagos', note: 'Boutique hotel with pool and garden on Av. Charles Darwin — central Puerto Ayora location, 5-min walk to Charles Darwin Research Station · 8.8 Booking.com', url: 'https://www.booking.com/hotel/ec/ikala-galapagos.html' },
      { name: 'Galapagos Safari Camp', note: 'Luxury tented camp in the Santa Cruz highlands — highland setting near El Chato tortoise reserve and Los Gemelos craters, butler service, 4x4 transfers · 9.0 Booking.com', url: 'https://www.booking.com/hotel/ec/galapagos-safari-camp-cumbaya.html' },
      { name: 'Sol y Mar B&B', note: 'Waterfront guesthouse with harbor views on Av. Darwin — steps from the main dock and water-taxi pier, closest budget option to the boat terminal · 8.4 Booking.com', url: 'https://www.booking.com/hotel/ec/solymar.html' }
    ] },
    'geneva': { h: [
      { name: 'Beau-Rivage Geneva', note: 'Independent grand hotel — 1865 Quai du Mont-Blanc lakefront, indoor pool, Michelin-starred Chat Botté restaurant, panoramic lake views · 9.1 Booking.com', url: 'https://www.booking.com/hotel/ch/beaurivagegeneva.html' },
      { name: 'Four Seasons Hotel des Bergues Geneva', note: 'Four Seasons brand — 1834 lakeside founding address on the Rhône, private lake pier, spa, Mont Blanc views from upper floors · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ch/four-seasons-geneva.html' },
      { name: 'Hotel President Wilson', note: 'Marriott Autograph Collection — 1962 Quai Wilson lakefront, largest standard suite in Europe, outdoor pool, panoramic lake and Alps views · 9.0 Booking.com', url: 'https://www.booking.com/hotel/ch/president-wilson.html' },
      { name: 'Mandarin Oriental Geneva', note: 'Mandarin Oriental brand — Quai Turrettini on the Rhône, spa, two restaurants, five-minute walk to the Old Town and Cathédrale Saint-Pierre · 9.1 Booking.com', url: 'https://www.booking.com/hotel/ch/mandarin-oriental-geneva.html' }
    ] },
    'glacier-national-park': { h: [
      { name: 'Great Northern Resort', note: 'Independent — West Glacier, at the park entrance on US-2, log cabins and lodge rooms modeled after the Glacier Park Chalets, complimentary breakfast, 1 mile from the west gate', url: 'https://www.booking.com/hotel/us/great-northern-resort-lodge.html' },
      { name: 'Firebrand Hotel', note: 'Independent boutique — downtown Whitefish, 26 miles north of the park entrance, rooftop hot tub and terrace, walkable to restaurants and Amtrak station · 8.3 Booking.com', url: 'https://www.booking.com/hotel/us/firebrand.html' },
      { name: 'Grouse Mountain Lodge', note: 'Glacier Park Collection — Whitefish, 26 miles north of the park entrance, mountain lodge on the golf course, indoor pool, hot tub and sauna · 8.4 Booking.com', url: 'https://www.booking.com/hotel/us/grouse-mountain-lodge.html' },
      { name: 'The Lodge at Whitefish Lake', note: 'Renaissance Hotels (Marriott family) — Whitefish, 26 miles north of the park, marina resort, outdoor pool, lakefront spa, year-round mountain access · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/lodge-at-whitefish-lake.html' }
    ] },
    'glasgow': { h: [
      { name: 'Kimpton Blythswood Square Hotel', note: 'IHG Kimpton brand — 1820 Georgian townhouse on Blythswood Square, indoor pool, Tempus spa, afternoon tea · 9.0 Booking.com', url: 'https://www.booking.com/hotel/gb/blythswood-square.html' },
      { name: 'Hotel Indigo Glasgow', note: 'IHG brand — converted 1901 central fire station on Waterloo Street, design-led interiors, steps from Central Station · 8.7 Booking.com', url: 'https://www.booking.com/hotel/gb/indigo-glasgow.html' },
      { name: 'Radisson Blu Hotel Glasgow', note: 'Radisson brand — Argyle Street in the city centre, indoor pool, Metro Bar & Grill, walking distance to Central Station · 8.4 Booking.com', url: 'https://www.booking.com/hotel/gb/radissonsashotelglasgow.html' },
      { name: 'Malmaison Glasgow', note: 'Malmaison brand — Merchant City in a converted church building, brasserie and bar, design rooms with character · 8.6 Booking.com', url: 'https://www.booking.com/hotel/gb/malmaison-glasgow.html' }
    ] },
    'gothenburg': { h: [
      { name: 'Clarion Hotel Post', note: 'Nordic Choice Hotels — 1925 former Central Post Office on Drottningtorget, panoramic rooftop pool and bar, spa, largest hotel in Gothenburg · 8.7 Booking.com', url: 'https://www.booking.com/hotel/se/clarion-post.html' },
      { name: 'Elite Plaza Hotel Gothenburg', note: 'Elite Hotels brand — 1889 grand Victorian building in Inom Vallgraven, Råkulten restaurant, classic Scandinavian interiors · 8.8 Booking.com', url: 'https://www.booking.com/hotel/se/elite-plaza.html' },
      { name: 'Avalon Hotel', note: 'Independent — Kungsportsavenyn design hotel, rooftop pool and sundeck, Matbaren restaurant · 9.0 Booking.com', url: 'https://www.booking.com/hotel/se/avalonhotel.html' },
      { name: 'Radisson Blu Scandinavia Hotel Gothenburg', note: 'Radisson Blu — Södra Hamngatan waterfront, panoramic Sky Bar, indoor pool · 8.7 Booking.com', url: 'https://www.booking.com/hotel/se/radisson-sas-scandinavia-gothenburg.html' }
    ] },
    'hamburg': { h: [
      { name: 'The Fontenay Hamburg', note: "Independent luxury — 2018 Alster lake-view tower, rooftop pool, Lakeside spa, Mabühle restaurant, Hamburg's premier new-build address · 9.4 Booking.com", url: 'https://www.booking.com/hotel/de/the-fontenay.html' },
      { name: 'Hotel Atlantic Kempinski Hamburg', note: 'Kempinski brand — 1909 Außenalster lakefront landmark, historic grand hotel, waterfront dining, near Hauptbahnhof · 8.7 Booking.com', url: 'https://www.booking.com/hotel/de/hotel-atlantic-hamburg-autograph-collection.html' },
      { name: 'Vier Jahreszeiten Hamburg', note: 'Independent — Alster lakefront landmark since 1897, Jahreszeiten Grill, spa with indoor pool · 9.0 Booking.com', url: 'https://www.booking.com/hotel/de/hotel-vier-jahreszeiten.html' },
      { name: 'Sofitel Hamburg Alter Wall', note: 'Sofitel brand — historic Alter Wall, spa with pool, Le Bar and Divan restaurant · 8.8 Booking.com', url: 'https://www.booking.com/hotel/de/sofitel-hamburg-alter-wall.html' }
    ] },
    'hanoi': { h: [
      { name: 'Sofitel Legend Metropole Hanoi', note: 'Accor Sofitel Legend brand — 1901 French colonial icon in the French Quarter, Le Spa du Métropole, Michelin-recognized Le Beaulieu restaurant · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/vn/sofitel-legend-metropole-hanoi.html' },
      { name: 'JW Marriott Hotel Hanoi', note: 'Marriott brand — award-winning curved tower by Carlos Zapata Studio, outdoor pool, full-service spa, largest luxury hotel in Hanoi · 8.8 Booking.com' , url: 'https://www.booking.com/hotel/vn/jw-marriott-hotel-hanoi.html' },
    
      { name: 'Lotte Hotel Hanoi', note: 'Lotte brand — Ba Dinh District, Top of Hanoi observation deck on 65th floor, indoor pool, La Seine French restaurant · 8.8 Booking.com', url: 'https://www.booking.com/hotel/vn/lotte-hotel-hanoi.html' },
      { name: 'Pan Pacific Hanoi', note: 'Pan Pacific brand — West Lake area, indoor pool, Pacific Restaurant, Bamboo Lounge, city skyline views · 8.7 Booking.com', url: 'https://www.booking.com/hotel/vn/pan-pacific-hanoi.html' }
    ] },
    'helsinki': { h: [
      { name: 'Hotel St. George Helsinki', note: 'Design Hotels member — 1894 neo-Renaissance building in the city center, curated art collection, spa with pool, Aino restaurant · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/fi/hotel-st-george-helsinki.html' },
      { name: 'Marski by Scandic', note: 'Scandic brand — prime Mannerheimintie address opposite Esplanade Park, 365 rooms, extensively renovated 2019, rooftop sauna · 8.5 Booking.com' , url: 'https://www.booking.com/hotel/fi/marski-by-scandic.html' },
      { name: 'Klaus K Hotel', note: 'Design Hotels — 1908 Art Nouveau building on Bulevardi, Finnish mythology-themed interiors, wine bar, central Market Square location · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/fi/klausku.html' },
      { name: 'Kämp Hotel Helsinki', note: 'Leading Hotels of the World — 1887 Senate Square landmark, Kämp Brasserie, spa with indoor pool, central Esplanade Park address · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/fi/hotel-kamp.html' }
    ] },
    'hilton-head-island': { h: [
      { name: 'Sonesta Resort Hilton Head Island', note: 'Sonesta brand — North Forest Beach Drive oceanfront, two pools, beach access, on-site dining, family-friendly full-service resort · 8.6 Booking.com', url: 'https://www.booking.com/hotel/us/sonesta-resort-hilton-head-island.html' },
      { name: 'The Inn at Harbour Town', note: 'Independent boutique — inside Sea Pines plantation, overlooking Heritage Golf Links, butler service, Sea Pines resort amenity access · 9.1 Booking.com' },
      { name: 'The Sea Pines Resort', note: 'Independent — 5,200-acre plantation, four golf courses, beach club, Harbour Town lighthouse · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/sea-pines-resort.html' },
      { name: 'Westin Hilton Head Island Resort & Spa', note: 'Marriott Westin — Palmetto Dunes Oceanfront, three pools, Heavenly Spa, direct beach access · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/the-westin-hilton-head-island-resort-spa.html' }
    ] },
    'hiroshima': { h: [
      { name: 'Grand Prince Hotel Hiroshima', note: 'Prince Hotels brand — waterfront hotel on the Motoyasu River, panoramic city views, spa, pool, closest major hotel to Peace Memorial Park · 8.9 Booking.com', url: 'https://www.booking.com/hotel/jp/grand-prince-hiroshima.html' },
      { name: 'Sheraton Grand Hiroshima Hotel', note: 'Marriott brand — directly connected to JR Hiroshima Station, Shinkansen-accessible, Club Lounge, contemporary rooms above the transit hub · 8.7 Booking.com', url: 'https://www.booking.com/hotel/jp/sheraton-hiroshima.html' },
      { name: 'Hilton Hiroshima', note: 'Hilton brand — modern 5-star in city centre, indoor pool, spa, fitness center, 1.6km from Peace Memorial Park · 9.2 Booking.com', url: 'https://www.booking.com/hotel/jp/hilton-hiroshima.html' },
      { name: 'ANA Crowne Plaza Hiroshima', note: 'IHG brand — 5-minute walk from Peace Memorial Park, city-centre location, fitness center, panoramic views · 8.3 Booking.com', url: 'https://www.booking.com/hotel/jp/ana-crowne-plaza-hiroshima.html' }
    ] },
    'hoi-an': { h: [
      { name: 'Anantara Hội An Resort', note: 'Anantara brand — Thu Bon River frontage in the Ancient Town, colonial-style architecture, riverside pool, spa · 9.2 Booking.com', url: 'https://www.booking.com/hotel/vn/anantara-hoi-an-resort.html' },
      { name: 'Victoria Hội An Beach Resort & Spa', note: 'Victoria Hotels brand — beachfront between Old Town and Cua Dai Beach, pool, spa, traditional Vietnamese architecture · 8.8 Booking.com', url: 'https://www.booking.com/hotel/vn/victoria-hoi-an-beach-resort-and-spa.html' },
      { name: 'Four Seasons Resort The Nam Hai, Hội An', note: 'Four Seasons — Ha My Beach, three tiered infinity pools, 40 pool villas, Sea Shell restaurant · 9.4 Booking.com', url: 'https://www.booking.com/hotel/vn/the-nam-hai.html' },
      { name: 'La Siesta Hoi An Resort & Spa', note: 'Independent — Cam Nam Island, river-view pool, La Plage Spa, shuttle to beach · 9.3 Booking.com', url: 'https://www.booking.com/hotel/vn/la-siesta-hoi-an-resort-spa.html' }
    ] },
    'hong-kong': { h: [
      { name: 'The Ritz-Carlton Hong Kong', note: "Ritz-Carlton brand — world's highest hotel (floors 102–118, ICC Tower), Tin Lung Heen for dim sum, rooftop infinity pool · 9.3 Booking.com", url: 'https://www.booking.com/hotel/hk/the-ritz-carlton-hong-kong.html' },
      { name: 'Four Seasons Hotel Hong Kong', note: 'Four Seasons brand — Central harbourfront, panoramic Victoria Harbour views, two outdoor infinity pools, Michelin-starred Lung King Heen · 9.2 Booking.com', url: 'https://www.booking.com/hotel/hk/four-seasons-hong-kong.html' },
      { name: 'The Peninsula Hong Kong', note: 'Peninsula Hotels — Tsim Sha Tsui flagship since 1928, rooftop helicopter transfers, ESPA spa · 9.3 Booking.com', url: 'https://www.booking.com/hotel/hk/the-peninsula.html' },
      { name: 'Mandarin Oriental Hong Kong', note: 'Mandarin Oriental — Central waterfront, Man Wah Cantonese restaurant, iconic harbour views · 9.2 Booking.com', url: 'https://www.booking.com/hotel/hk/mandarin-oriental.html' }
    ] },
    'istanbul': { h: [
      { name: 'Four Seasons Hotel Istanbul at Sultanahmet', note: 'Four Seasons brand — converted 19th-century Ottoman prison, steps from Hagia Sophia, inner courtyard garden, butler service · 9.3 Booking.com', url: 'https://www.booking.com/hotel/tr/four-seasons-istanbul-at-sultanahmet.html' },
      { name: 'Raffles Istanbul Zorlu', note: 'Raffles brand — European side at Zorlu Center, indoor and outdoor pools, Arola Restaurant, long private driveway approach · 9.1 Booking.com', url: 'https://www.booking.com/hotel/tr/raffles-istanbul.html' },
      { name: 'Çırağan Palace Kempinski Istanbul', note: 'Kempinski brand — 19th-century Ottoman palace on the Bosphorus, outdoor pool on the water, Tuğra restaurant · 9.4 Booking.com', url: 'https://www.booking.com/hotel/tr/ciragan-palace.html' },
      { name: 'The Ritz-Carlton Istanbul', note: 'Ritz-Carlton brand — Beşiktaş on the Bosphorus, Laveda restaurant, spa with indoor pool · 9.1 Booking.com', url: 'https://www.booking.com/hotel/tr/the-ritz-carlton-istanbul.html' }
    ] },
    'joao-pessoa': { h: [
      { name: 'Summerville Beach Resort', note: 'Independent resort — Tambaú beachfront, outdoor pools, spa, direct beach access steps from the Tambaú promenade · 8.7 Booking.com' },
      { name: 'Hotel Tambaú', note: 'Independent — iconic 1972 circular building on Tambaú Beach, João Pessoa landmark, pool terrace with ocean views, seafood restaurant · 8.2 Booking.com' },
      { name: 'Tropical Tambaú Hotel', note: 'Tropical Hotels — Tambaú Beach, outdoor pool, Mangai restaurant with regional Northeastern cuisine · 8.3 Booking.com' },
      { name: 'Manaíra Apart Hotel', note: 'Independent — Manaíra beachfront, kitchenette suites, outdoor pool, close to the shopping centre · 8.5 Booking.com' }
    ] },
    'kauai': { h: [
      { name: 'St. Regis Princeville Resort', note: 'Marriott Luxury Collection — Princeville cliffside above Hanalei Bay, Halele\'a Spa, infinity pool, butler service, North Shore panorama · 9.0 Booking.com' },
      { name: '1 Hotel Hanalei Bay', note: 'SH Hotels brand — Princeville cliffside, adults-preferred wing, two pools, farm-to-table restaurant, panoramic Hanalei Bay views · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/1hotel-hanalei-bay.html' },
      { name: 'Grand Hyatt Kauai Resort and Spa', note: 'Hyatt brand — Poipu Beach, five saltwater pools, Anara Spa, Tidepools restaurant · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/grand-hyatt-kauai.html' },
      { name: 'Koloa Landing Resort at Poipu, Autograph Collection', note: 'Marriott Autograph Collection — Poipu, largest resort on Kauai, four pools, Holoholo Grille · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/koloa-landing-resort.html' }
    ] },
    'keywest': { h: [
      { name: 'Ocean Key Resort & Spa', note: 'Curio Collection by Hilton — Sunset Key views at Zero Duval, rooftop pool, private dock access, steps from Mallory Square sunset · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/ocean-key-resort-spa-key-west-florida.html' },
      { name: 'The Marker Key West Harbor Resort', note: 'Autograph Collection by Marriott — Old Town historic district, three pools including adults-only, marina access, tropical gardens · 9.0 Booking.com' },
      { name: 'The Gardens Hotel', note: 'Independent — 1875 Old Town estate, lush tropical gardens, pool, afternoon wine included · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/gardens-hotel.html' },
      { name: 'Pier House Resort & Spa', note: 'Independent — Duval Street waterfront, sunset cruise access, spa, Chart Room bar · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/pier-house-resort-spa.html' }
    ] },
    'kotor': { h: [
      { name: 'Regent Porto Montenegro', note: 'Regent Hotels — superyacht marina in Tivat (20 min from Kotor), beachclub, full-service spa, private beach, Boka Bay setting · 8.9 Booking.com', url: 'https://www.booking.com/hotel/me/regent-porto-montenegro.html' },
      { name: 'Palazzo Radomiri', note: 'Independent boutique — 18th-century Baroque palace in Dobrota village, 5km from Old Town, Boka Bay waterfront, private jetty · 9.2 Booking.com' },
      { name: 'Cattaro Boutique Hotel', note: 'Independent — inside the Old Town walled city, 16th-century Grgurina Palace, rooftop terrace · 9.1 Booking.com', url: 'https://www.booking.com/hotel/me/cattaro.html' },
      { name: 'Hotel Vardar', note: 'Independent — Old Town main square, balcony rooms overlooking St. Tryphon Square · 8.9 Booking.com', url: 'https://www.booking.com/hotel/me/vardar.html' }
    ] },
    'krakow': { h: [
      { name: 'Hotel Copernicus', note: 'Relais & Châteaux — 15th-century Renaissance house in Old Town, rooftop pool with Royal Castle and Wawel panorama, Copernicus restaurant · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/pl/copernicus.html' },
      { name: 'Sheraton Grand Kraków', note: 'Marriott family — Wisła Riverfront with Wawel Castle views, Dolce Vita Spa, indoor pool, walking distance to Old Town · 8.6 Booking.com' , url: 'https://www.booking.com/hotel/pl/sheraton-grand-krakow.html' },
      { name: 'Stary Hotel Kraków', note: 'Relais & Châteaux — 13th-century townhouse in the Old Town, indoor pool, rooftop terrace overlooking Wawel Castle · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/pl/stary.html' },
      { name: 'Qubus Hotel Kraków', note: 'Qubus Hotels — Wisła Riverfront opposite Wawel Castle, riverside views, outdoor terrace, modern amenities · 8.7 Booking.com' , url: 'https://www.booking.com/hotel/pl/qubus-krakow.html' }
    ] },
    'kyoto': { h: [
      { name: 'The Ritz-Carlton, Kyoto', note: 'Ritz-Carlton brand — Nakagyo District on the Kamogawa River, indoor infinity pool with garden views, full-service spa, Michelin-recognized MIZUKI restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/jp/the-ritz-carlton-kyoto.html' },
      { name: 'Aman Kyoto', note: 'Aman brand — private forested hillside north of Kinkaku-ji, 26 pavilion-style rooms, onsen bath circuit, garden-set outdoor pool · 9.7 Booking.com' },
      { name: 'Hyatt Regency Kyoto', note: 'Hyatt brand — Higashiyama district, Touzan Bar, all-day dining, traditional garden · 9.1 Booking.com', url: 'https://www.booking.com/hotel/jp/hyatt-regency-kyoto.html' },
      { name: 'Tawaraya Ryokan', note: 'Independent — the city\'s most historic ryokan (1717), kaiseki dinner served in room, private garden · 9.6 Booking.com' }
    ] },
    'la-jolla': { h: [
      { name: 'Lodge at Torrey Pines', note: 'Independent AAA Five Diamond — clifftop Arts & Crafts lodge above Torrey Pines State Reserve, two pools, A.R. Valentien restaurant, direct Torrey Pines golf access · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/us/the-lodge-at-torrey-pines.html' },
      { name: 'Estancia La Jolla Hotel & Spa', note: 'Marriott Tribute Portfolio — hacienda-style resort near UCSD, outdoor pool, full-service spa, lush California garden, 10 min from La Jolla Cove · 8.8 Booking.com' , url: 'https://www.booking.com/hotel/us/estancia-la-jolla-hotel-and-spa.html' },
      { name: 'Scripps Inn', note: 'Independent — directly on La Jolla Cove, beachfront, ocean views, near the sea caves · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/scripps-inn.html' },
      { name: 'Hilton La Jolla Torrey Pines', note: 'Hilton brand — Torrey Pines Golf Course, outdoor pool, Blue Agave bar · 8.6 Booking.com', url: 'https://www.booking.com/hotel/us/hilton-la-jolla-torrey-pines.html' }
    ] },
    'lagos': { h: [
      { name: 'Bela Vista Hotel & Spa', note: 'Leading Hotels of the World — 1918 Art Nouveau manor in Praia da Rocha (Portimão, 20 km east), clifftop Atlantic views, outdoor pool, Michelin-recognized Boa Mesa restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/pt/bela-vista.html' },
      { name: 'Dona Filipa Hotel', note: 'Marriott Autograph Collection — Vale do Lobo resort estate (55 km east of Lagos), San Lorenzo golf access, 3 pools, spa, direct beach · 8.5 Booking.com', url: 'https://www.booking.com/hotel/pt/dona-filipa.html' },
      { name: 'Iberostar Selection Lagos Algarve', note: 'Iberostar brand — 5-star beachfront resort on Meia Praia, 5 km from the old town, outdoor pool with ocean views, spa, direct beach access · 8.8 Booking.com', url: 'https://www.booking.com/hotel/pt/iberostar-lagos-algarve.html' },
      { name: 'Vila Vita Parc', note: 'Leading Hotels of the World — clifftop resort in Armação de Pêra (50 km east), 12 restaurants, multiple pools, spa, Michelin-starred Ocean restaurant · 9.4 Booking.com', url: 'https://www.booking.com/hotel/pt/vila-vita-parc-resort-spa.html' }
    ] },
    'lake-como': { h: [
      { name: "Villa d'Este", note: 'Leading Hotels of the World — 16th-century Renaissance villa in Cernobbio, floating 40 m lake pool, private beach, spa, celebrated Como Grill dining · 9.5 Booking.com' },
      { name: 'Mandarin Oriental, Lake Como', note: 'Mandarin Oriental brand — 19th-century lakeside estate in Blevio, 38 rooms with private terraces, lake-view infinity pool, The Spa at Mandarin Oriental · 9.3 Booking.com', url: 'https://www.booking.com/hotel/it/mandarin-oriental-lago-di-como.html' },
      { name: 'Grand Hotel Tremezzo', note: 'Independent — 1910 Liberty-style palace in Tremezzo, floating pool on the lake, T Spa · 9.4 Booking.com', url: 'https://www.booking.com/hotel/it/grand-tremezzo.html' },
      { name: 'Villa d\'Este Cernobbio', note: 'Independent — 1568 cardinal\'s villa, 25-acre park, floating pool on the lake · 9.3 Booking.com', url: 'https://www.booking.com/hotel/it/villa-d-este-cernobbio.html' }
    ] },
    'lake-tahoe': { h: [
      { name: 'The Ritz-Carlton, Lake Tahoe', note: 'Ritz-Carlton brand — Northstar California ski-in/ski-out resort, heated outdoor pool, full-service spa, mountain-view dining, year-round alpine access · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/the-ritz-carlton-highlands-lake-tahoe.html' },
      { name: 'Edgewood Tahoe Resort', note: 'Forbes Five Star independent — South Lake Tahoe lakefront, championship golf, heated outdoor pool, spa, private beach, panoramic lake views · 9.6 Booking.com', url: 'https://www.booking.com/hotel/us/the-lodge-at-edgewood-tahoe.html' },
      { name: 'Hyatt Regency Lake Tahoe Resort, Spa and Casino', note: 'Hyatt brand — Incline Village private beach, Sierra Spa, casino, Lone Eagle Grille · 8.9 Booking.com', url: 'https://www.booking.com/hotel/us/hyatt-regency-lake-tahoe.html' },
      { name: 'Sunnyside Resort and Lodge', note: 'Independent — West Shore waterfront, boathouse marina, Sunnyside Restaurant deck · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/sunnyside-resort-and-lodge.html' }
    ] },
    'las-vegas': { h: [
      { name: 'Wynn Las Vegas', note: 'Forbes Five Star independent — single-tower luxury resort, 3 pools, Wynn Spa, Michelin-starred Restaurant Guy Savoy and SW Steakhouse · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/wynn-las-vegas-boulevard.html' },
      { name: 'The Venetian Resort Las Vegas', note: 'Independent mega-resort — all-suite tower, Canyon Ranch Spa Club with indoor pool, 5 outdoor pools, 36 restaurants, Lagoon Pool complex · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/the-venetian-resort-casino.html' },
      { name: 'Bellagio Las Vegas', note: 'MGM Resorts — Strip icon, Bellagio Fountains, Spago and Le Cirque dining, spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/bellagio.html' },
      { name: 'The Cosmopolitan of Las Vegas', note: 'Independent — Strip, Marquee Nightclub, all rooms with terraces, Rose. Rabbit. Lie. dining · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/the-cosmopolitan-las-vegas.html' }
    ] },
    'lecce': { h: [
      { name: 'Risorgimento Resort', note: 'Leading Hotels of the World — Lecce historic centre palazzo conversion, rooftop terrace and pool, Michelin-recognized restaurant · 9.0 Booking.com' },
      { name: 'Il Convento di Santa Teresa', note: 'Independent boutique — converted 17th-century convent steps from Piazza Sant\'Oronzo, original stone arches, courtyard garden, 10 rooms · 9.4 Booking.com' },
      { name: 'Patria Palace Hotel Lecce', note: 'Independent — 18th-century palazzo facing the Basilica di Santa Croce, rooftop pool · 8.9 Booking.com', url: 'https://www.booking.com/hotel/it/patria-palace.html' },
      { name: 'Togo Suites Lecce', note: 'Independent boutique — historic centro, 14 rooms in a restored 17th-century palazzo, stone vaults · 9.3 Booking.com', url: 'https://www.booking.com/hotel/it/togo-suites.html' }
    ] },
    'lille': { h: [
      { name: 'Hermitage Gantois', note: 'MGallery by Sofitel — 15th-century Vieux-Lille hospice conversion, indoor pool and spa, Chapel Café, 90 rooms spanning historic and contemporary wings · 8.8 Booking.com', url: 'https://www.booking.com/hotel/fr/hermitagegantois.html' },
      { name: 'Barrière Lille', note: 'Barrière group — L\'Alliance hotel connected to Grand Casino Barrière, spa with pool and hammam, rooftop terrace, central Lille location · 8.7 Booking.com', url: 'https://www.booking.com/hotel/fr/barriere-lille.html' },
      { name: 'Crowne Plaza Lille', note: 'IHG Crowne Plaza — Euralille district, indoor pool, spa, close to Lille-Europe Eurostar · 8.6 Booking.com', url: 'https://www.booking.com/hotel/fr/crowne-plaza-lille.html' },
      { name: 'Barrière Lille', note: 'Barrière Hotels — Euralille, casino, spa, contemporary rooms, steps from the Grand Palais · 8.7 Booking.com', url: 'https://www.booking.com/hotel/fr/barrierede-lille.html' }
    ] },
    'lima': { h: [
      { name: 'Belmond Miraflores Park', note: 'Belmond brand — Miraflores clifftop overlooking the Pacific, rooftop heated pool with ocean views, full-service spa, 81 rooms · 9.0 Booking.com', url: 'https://www.booking.com/hotel/pe/miraflores-park.html' },
      { name: 'Hotel B', note: 'Small Luxury Hotels of the World — 1914 Republican mansion in Barranco arts district, 17 rooms, curated contemporary art collection, rooftop terrace · 9.5 Booking.com', url: 'https://www.booking.com/hotel/pe/arts-boutique-b.html' },
      { name: 'JW Marriott Hotel Lima', note: 'Marriott JW brand — Miraflores oceanfront tower, Pacific-view rooms, outdoor pool, Fishmar seafood restaurant, steps from Larcomar · 9.0 Booking.com', url: 'https://www.booking.com/hotel/pe/jw-marriott-lima.html' },
      { name: 'Country Club Lima Hotel', note: 'Leading Hotels of the World — 1927 San Isidro mansion, 83 rooms, 300+ art pieces from Pedro de Osma Museum, El Perroquet restaurant · 8.8 Booking.com', url: 'https://www.booking.com/hotel/pe/country-club-lima.html' }
    ] },
    'london': { h: [
      { name: 'The Savoy', note: 'Fairmont brand — 1889 Thames Embankment landmark, Art Deco interior, Kaspar\'s Seafood Bar, indoor pool · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/gb/the-savoy-london.html' },
      { name: 'Claridge\'s', note: 'Independent luxury — Mayfair Art Deco landmark, legendary afternoon tea, indoor pool, Nobu at Claridge\'s · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/gb/claridges.html' },
      { name: 'The Berkeley', note: 'Independent — Wilton Place Knightsbridge, rooftop heated pool, Collins Room, The Blue Bar, 5-min to Harvey Nichols and Harrods · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/gb/the-berkeley.html' },
      { name: 'Mandarin Oriental Hyde Park, London', note: 'Mandarin Oriental brand — 66 Knightsbridge, Dinner by Heston Blumenthal, The Spa at Mandarin Oriental, Hyde Park views · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/gb/mandarin-oriental-hyde-park.html' }
    ] },
    'los-angeles': { h: [
      { name: 'Pendry West Hollywood', note: 'Montage Hotels — Sunset Strip address, rooftop infinity pool, Chloe restaurant, valet parking · 9.2 Booking.com' },
      { name: 'Hotel Bel-Air', note: 'Dorchester Collection — 12-acre Bel-Air canyon estate, Swan Lake gardens, spa, celebrity retreat · 9.5 Booking.com' },
      { name: 'The Beverly Hills Hotel', note: 'Dorchester Collection — 1912 Pink Palace on Sunset Boulevard, Polo Lounge, bungalows, pool · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/the-beverly-hills-hotel.html' },
      { name: 'Sunset Tower Hotel', note: 'Independent — 1931 Art Deco landmark on the Sunset Strip, pool and terrace, Tower Bar restaurant · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/sunset-tower-hotel.html' }
    ] },
    'los-cabos': { h: [
      { name: 'Las Ventanas al Paraíso, A Rosewood Resort', note: 'Rosewood brand — beachfront estate, telescope observatory, three pools, Tequila & Ceviche Bar · 9.5 Booking.com' },
      { name: 'One&Only Palmilla', note: 'One&Only brand — 27-acre oceanfront estate, Nobu on-site, infinity pools, private diving · 9.4 Booking.com', url: 'https://www.booking.com/hotel/mx/one-only-palmilla.html' },
      { name: 'Esperanza, Auberge Resorts Collection', note: 'Auberge Resorts — Punta Ballena, two ocean-view pools, Espacio spa, Cocina del Mar restaurant · 9.4 Booking.com', url: 'https://www.booking.com/hotel/mx/esperanza.html' },
      { name: 'Grand Velas Los Cabos', note: 'Velas Resorts — beachfront all-inclusive, six restaurants, Se Spa, infinity pool · 9.3 Booking.com', url: 'https://www.booking.com/hotel/mx/grand-velas-los-cabos.html' }
    ] },
    'luang-prabang': { h: [
      { name: 'Sofitel Luang Prabang', note: 'Sofitel brand — restored French governor\'s residence, two pools, jungle garden, spa · 9.4 Booking.com' },
      { name: 'Amantaka', note: 'Aman brand — converted colonial compound, pool-equipped suites, complimentary tuk-tuk service into town · 9.6 Booking.com' },
      { name: 'Rosewood Luang Prabang', note: 'Rosewood brand — jungle tented resort, 23 elegant tents and villas, waterfall views · 9.5 Booking.com', url: 'https://www.booking.com/hotel/la/rosewood-luang-prabang.html' },
      { name: 'Le Sen Boutique Hotel', note: 'Independent — Peninsula overlooking Nam Khan River, pool, spa, traditional Lao architecture · 9.3 Booking.com', url: 'https://www.booking.com/hotel/la/le-sen-boutique-hotel.html' }
    ] },
    'lucerne': { h: [
      { name: 'Palace Luzern', note: 'Independent luxury — 1906 Belle Époque lakefront palace, indoor and outdoor pools, spa, Pilatus and Rigi views · 9.4 Booking.com', url: 'https://www.booking.com/hotel/ch/mandarin-oriental-palace-luzern.html' },
      { name: 'Bürgenstock Resort Lake Lucerne', note: 'Independent luxury — clifftop above Lake Lucerne, panoramic Alpine spa, Alpine cliff walk, helicopter transfers · 9.2 Booking.com' },
      { name: 'Art Deco Hotel Montana Luzern', note: 'Independent — hillside above old town, 1910 estate, lake panorama, funicular access · 9.2 Booking.com', url: 'https://www.booking.com/hotel/ch/art-deco-montana.html' },
      { name: 'Hotel des Balances', note: 'Independent — 13th-century guildhall on the Reuss in the Old Town, river-view rooms · 9.1 Booking.com', url: 'https://www.booking.com/hotel/ch/desbalances.html' }
    ] },
    'luxembourg': { h: [
      { name: 'Grand Hotel Cravat', note: 'Independent — listed building on Boulevard Roosevelt, Michelin-listed Frantz Mosa restaurant, Old Town views · 8.9 Booking.com', url: 'https://www.booking.com/hotel/lu/grandhotelcravat.html' },
      { name: 'Sofitel Luxembourg Europe', note: 'Sofitel brand — Kirchberg European Quarter, spa, contemporary design, close to EU institutions · 8.8 Booking.com', url: 'https://www.booking.com/hotel/lu/sofitel.html' },
      { name: 'Meliá Luxembourg', note: 'Meliá Hotels — Kirchberg district, rooftop bar with city views, spa, near Philharmonie · 8.6 Booking.com', url: 'https://www.booking.com/hotel/lu/melia-luxembourg.html' },
      { name: 'Le Place d\'Armes', note: 'Independent — Place d\'Armes historic core, 28 rooms in 1880s townhouses, Plëss restaurant · 9.0 Booking.com', url: 'https://www.booking.com/hotel/lu/le-place-d-armes.html' }
    ] },
    'lyon': { h: [
      { name: 'Villa Florentine', note: 'Small Luxury Hotels — Renaissance mansion on Fourvière Hill, panoramic city and Rhône views, Michelin-starred dining · 9.4 Booking.com', url: 'https://www.booking.com/hotel/fr/villaflorentine.html' },
      { name: 'Sofitel Lyon Bellecour', note: 'Sofitel brand — Presqu\'île heart, spa with pool, Les Trois Dômes gastronomic restaurant with panorama · 8.9 Booking.com', url: 'https://www.booking.com/hotel/fr/sofitel-lyon.html' },
      { name: 'Cour des Loges', note: 'Independent — Renaissance mansion in the Vieux-Lyon UNESCO quarter, heated pool, Les Loges restaurant · 9.2 Booking.com', url: 'https://www.booking.com/hotel/fr/cour-des-loges.html' },
      { name: 'InterContinental Lyon - Hotel Dieu', note: 'IHG brand — converted 12th-century Grand Hôtel-Dieu on the Rhône, spa with pool · 9.1 Booking.com', url: 'https://www.booking.com/hotel/fr/intercontinental-lyon-hotel-dieu.html' }
    ] },
    'maceio': { h: [
      { name: 'Jatiúca Resort', note: 'Independent — beachfront on Jatiúca Beach, outdoor pool complex, buffet dining, family-friendly · 8.7 Booking.com', url: 'https://www.booking.com/hotel/br/jatiuca-resort.html' },
      { name: 'Ritz Suítes Hotel', note: 'Independent — Pajuçara beach access, rooftop pool, central Maceió location · 8.6 Booking.com', url: 'https://www.booking.com/hotel/br/ritz-suites-home-service.html' },
      { name: 'Kenoa – Exclusive Beach Spa & Resort', note: 'Small Luxury Hotels — Barra de São Miguel beach, 6-room adults-only eco-resort, private beach · 9.7 Booking.com', url: 'https://www.booking.com/hotel/br/kenoa-exclusive-beach-spa-resort.html' },
      { name: 'Hotel Ritz Maceió', note: 'Independent — Pajuçara beachfront, outdoor pool with sea view, rooftop bar, near natural pools · 8.6 Booking.com', url: 'https://www.booking.com/hotel/br/ritz-maceio.html' }
    ] },
    'machupicchu': { h: [
      { name: 'Inkaterra Machu Picchu Pueblo Hotel', note: 'Independent luxury — 83 casitas in cloud forest, 372 orchid species on-site, tea house, nature walks · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/pe/inkaterra-machu-picchu-pueblo.html' },
      { name: 'Sumaq Machu Picchu Hotel', note: 'Independent — 62 rooms with mountain views inside the UNESCO sanctuary, gourmet Qunuq restaurant · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/pe/sumaq-machu-picchu.html' },
      { name: 'Belmond Sanctuary Lodge', note: 'Belmond brand — only hotel at the ruins gate, exclusive early private access before site opens, 31 rooms, Mapi restaurant · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/pe/belmond-sanctuary-lodge.html' },
      { name: 'El Mapi by Inkaterra', note: 'Inkaterra brand — Aguas Calientes town centre, outdoor pool, contemporary eco-lodge style, steps from shuttle buses · 8.9 Booking.com' , url: 'https://www.booking.com/hotel/pe/el-mapi-by-inkaterra.html' }
    ] },
    'madeira': { h: [
      { name: 'Reid\'s Palace, A Belmond Hotel', note: 'Belmond brand — 1891 clifftop landmark, seawater pools, afternoon tea tradition, lush subtropical gardens · 9.2 Booking.com', url: 'https://www.booking.com/hotel/pt/reids-palace.html' },
      { name: 'Choupana Hills Boutique Hotel', note: 'Small Luxury Hotels — adults-only, thatched eco-bungalows above Funchal in eucalyptus forest, pool · 9.1 Booking.com', url: 'https://www.booking.com/hotel/pt/choupana-hills-resort-spa.html' },
      { name: 'Belmond Reid\'s Palace Madeira', note: 'Belmond brand — clifftop pioneer since 1891, three pools, William restaurant, tennis courts · 9.4 Booking.com', url: 'https://www.booking.com/hotel/pt/reids-palace.html' },
      { name: 'Bettencourt Boutique Hotel', note: 'Independent — 19th-century Funchal mansion, outdoor pool, garden with Monte Palace views, 12 rooms · 9.5 Booking.com', url: 'https://www.booking.com/hotel/pt/bettencourt-boutique-hotel.html' }
    ] },
    'madrid': { h: [
      { name: 'The Westin Palace Madrid', note: 'Marriott family — 1912 Belle Époque landmark on Plaza de las Cortes, stained-glass domed rotunda, spa · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/es/westin-palace-madrid.html' },
      { name: 'Hotel Bless Madrid', note: 'Bless Collection — Salamanca neighborhood, rooftop pool and bar, vibrant social-scene terrace · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/es/bless-madrid.html' },
      { name: 'Villa Magna Hotel', note: 'Rosewood brand — Paseo de la Castellana, full-service spa, rooftop pool, Amós Madrid restaurant, Salamanca quarter · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/es/villa-magna.html' },
      { name: 'Mandarin Oriental Ritz, Madrid', note: 'Mandarin Oriental brand — Paseo del Prado, meticulously restored 1910 palace, The Spa at Mandarin Oriental, Champagne Bar terrace · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/es/mandarin-oriental-ritz-madrid.html' }
    ] },
    'malaga': { h: [
      { name: 'Parador de Málaga Gibralfaro', note: 'Paradores — inside Gibralfaro Castle walls, panoramic views of city and bay, pool · 9.2 Booking.com' },
      { name: 'AC Hotel Málaga Palacio by Marriott', note: 'Marriott family — rooftop pool with Alcazaba and port panorama, heart of historic center · 8.7 Booking.com', url: 'https://www.booking.com/hotel/es/acmalagapalacio.html' },
      { name: 'Gran Hotel Miramar GL', note: 'Mandarin Oriental managed — Paseo de Reding 1930s palace, Miramar Beach Club, heated pools · 9.0 Booking.com', url: 'https://www.booking.com/hotel/es/gran-hotel-miramar-malaga.html' },
      { name: 'Vincci Posada del Patio', note: 'Vincci Hotels — historic centre, Arabo-Nasrid 16th-century building, rooftop pool with city views · 9.0 Booking.com', url: 'https://www.booking.com/hotel/es/vincci-posada-del-patio.html' }
    ] },
    'maldives': { h: [
      { name: 'Gili Lankanfushi', note: 'Independent luxury — adults-only overwater villas, direct lagoon access, no news no shoes philosophy, butler service · 9.6 Booking.com', url: 'https://www.booking.com/hotel/mv/gili-lankanfushi-maldives.html' },
      { name: 'Four Seasons Resort Maldives at Landaa Giraavaru', note: 'Four Seasons brand — UNESCO Biosphere Reserve, overwater villas, dive school, spa island · 9.5 Booking.com', url: 'https://www.booking.com/hotel/mv/four-seasons-resort-maldives-at-landaa-giraavaru.html' },
      { name: 'Soneva Fushi', note: 'Soneva brand — Baa Atoll UNESCO Biosphere Reserve, no-shoes luxury private island, Six Senses Spa · 9.6 Booking.com', url: 'https://www.booking.com/hotel/mv/soneva-fushi.html' },
      { name: 'Velaa Private Island', note: 'Independent — Noonu Atoll, 45 residences with private pools, Aragu restaurant · 9.6 Booking.com', url: 'https://www.booking.com/hotel/mv/velaa-private-island.html' }
    ] },
    'malibu': { h: [
      { name: 'Nobu Hotel Malibu', note: 'Nobu Hospitality — Pacific Coast Highway beachfront, Nobu Restaurant on-site, rooftop pool · 9.0 Booking.com' },
      { name: 'Malibu Beach Inn', note: 'Independent boutique — Carbon Beach ("Billionaire\'s Beach"), 47 rooms each with ocean-view private balcony · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/malibu-beach-inn.html' },
      { name: 'Calamigos Guest Ranch and Beach Club', note: 'Independent — Malibu Canyon 5 acres, pool, horseback riding, farm-to-table dining · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/calamigos-guest-ranch.html' },
      { name: 'Malibu Country Inn', note: 'Independent — Point Dume area, ocean view from pool deck, fire pits, romantic 16-room inn · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/malibu-country-inn.html' }
    ] },
    'manuel-antonio': { h: [
      { name: 'Arenas del Mar Beachfront & Rainforest Resort', note: 'Independent — adults-focused, twin-beach location within national park buffer, infinity pool with forest canopy views · 9.4 Booking.com', url: 'https://www.booking.com/hotel/cr/arenas-del-mar-beachfront-amp-rainforest-resort.html' },
      { name: 'Tulemar Bungalows & Villas', note: 'Independent boutique — tree-canopy bungalows, private beach within park buffer, jungle-to-sea setting · 9.2 Booking.com' },
      { name: 'La Mansion Inn', note: 'Independent — hilltop boutique, 20 suites with jungle canopy views, two pools · 9.2 Booking.com', url: 'https://www.booking.com/hotel/cr/la-mansion-inn.html' },
      { name: 'Si Como No Resort & Spa', note: 'Independent — private wildlife refuge, two pools, TreeTops Spa, Claro Que Si restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/cr/si-como-no-resort.html' }
    ] },
    'marco-island': { h: [
      { name: 'Hilton Marco Island Beach Resort & Spa', note: 'Hilton family — directly on Marco Island\'s main beach, pools, spa, sunset views over Gulf of Mexico · 8.4 Booking.com', url: 'https://www.booking.com/hotel/us/hilton-marco-island-beach-resort.html' },
      { name: 'Marco Beach Ocean Resort', note: 'Independent boutique — 58 suites on the Esplanade, rooftop pool, Gulf-view balconies · 9.0 Booking.com' },
      { name: 'JW Marriott Marco Island Beach Resort', note: 'Marriott JW brand — beachfront on South Beach, four pools, Spas of Celebration, eleven restaurants · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/jwmarriotmarco.html' },
      { name: 'Hilton Marco Island Beach Resort & Spa', note: 'Hilton brand — Collier Boulevard beachfront, three pools, spa, multiple dining options · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/hilton-marco-island-beach-resort-and-spa.html' }
    ] },
    'marktoberdorf': { h: [
      { name: 'Wellnesshotel Hanusel Hof', note: 'Independent — wellness-focused Allgäu retreat, thermal pool and spa, hiking access into the Ammergauer Alps · 8.7 Booking.com' , url: 'https://www.booking.com/hotel/de/wellnesshotel-hanusel-hof.html' },
      { name: 'Hotel Hirsch Kaufbeuren', note: 'Independent — Kaufbeuren town centre (10 km north of Marktoberdorf), comfortable regional hotel with restaurant, easy rail connections · 8.5 Booking.com' , url: 'https://www.booking.com/hotel/de/hotel-hirsch-kaufbeuren.html' },
      { name: 'Gasthof Sonnenalp Marktoberdorf', note: 'Independent — Marktoberdorf town centre, traditional Bavarian inn, regional cuisine, walking distance to historic centre · 8.3 Booking.com' , url: 'https://www.booking.com/hotel/de/gasthof-sonnenalp.html' },
      { name: 'Landhotel Zur Post Marktoberdorf', note: 'Independent — Marktoberdorf centre, classic Allgäu country hotel, good base for Neuschwanstein and Füssen day trips · 8.1 Booking.com' , url: 'https://www.booking.com/hotel/de/landhotel-zur-post.html' }
    ] },
    'marrakech': { h: [
      { name: 'La Mamounia', note: 'Independent luxury — 1923 legend on 17 acres of palace gardens, three pools, six restaurants, hammam · 9.4 Booking.com' },
      { name: 'Royal Mansour Marrakech', note: 'Independent ultra-luxury — private riads with plunge pools, 2,500 sq m spa, three restaurants · 9.7 Booking.com', url: 'https://www.booking.com/hotel/ma/royal-mansour-marrakech.html' },
      { name: 'Amanjena', note: 'Aman brand — Route de Ouarzazate rose-pink pavilions, two pools, hammam, golf access · 9.5 Booking.com', url: 'https://www.booking.com/hotel/ma/amanjena.html' },
      { name: 'Kasbah Tamadot', note: 'Virgin Limited Edition — Atlas Mountain retreat, Berber tents, pool with mountain panorama · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ma/kasbah-tamadot.html' }
    ] },
    'marseille': { h: [
      { name: 'InterContinental Marseille - Hotel Dieu', note: 'IHG brand — converted 18th-century hospital above the Vieux-Port, rooftop pool, panoramic Old Town views · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/fr/intercontinental-marseille-hotel-dieu.html' },
      { name: 'Sofitel Marseille Vieux-Port', note: 'Sofitel brand — Old Port frontage, terrace views, spa, Les Trois Forts gastronomic restaurant · 8.8 Booking.com' , url: 'https://www.booking.com/hotel/fr/sofitel-marseille-vieux-port.html' },
      { name: 'Hôtel C2 Marseille', note: 'Independent boutique — 19th-century merchant mansion near the Old Port, heated outdoor pool, 20 rooms, Sushi Shop & Le Reflet restaurant · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/fr/hotel-c2-marseille.html' },
      { name: 'Grand Hôtel Beauvau Vieux-Port, Autograph Collection', note: 'Marriott Autograph — 1816 Vieux-Port landmark, panoramic harbour views, Brasserie Beauvau, historic Provençal character · 8.9 Booking.com' , url: 'https://www.booking.com/hotel/fr/grand-hotel-beauvau-vieux-port.html' }
    ] },
    'maui': { h: [
      { name: 'Hotel Wailea, Relais & Châteaux', note: 'Relais & Châteaux — adults-only on Wailea\'s Ulua Ridge, pool and whirlpool, spectacular West Maui sunset views · 9.5 Booking.com', url: 'https://www.booking.com/hotel/us/hotel-wailea-relais-chateaux.html' },
      { name: 'Andaz Maui at Wailea Resort', note: 'Hyatt brand — five pools on Mokapu Beach, cliff-edge adults pool, seven dining venues · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/andaz-maui-at-wailea.html' },
      { name: 'Grand Wailea, A Waldorf Astoria Resort', note: 'Waldorf Astoria — nine themed pools on 40 oceanfront acres of Wailea Beach, Spa Grande, multiple dining outlets · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/grand-wailea-resort-spa.html' },
      { name: 'Fairmont Kea Lani, Maui', note: 'Fairmont — all-suite and private villa resort, plunge pools, Kea Lani Restaurant, white-sand Polo Beach · 8.9 Booking.com', url: 'https://www.booking.com/hotel/us/the-fairmont-kea-lani.html' }
    ] },
    'miami': { h: [
      { name: 'The Setai Miami Beach', note: 'Independent luxury — three infinity pools, private beach on Collins Avenue, Asian-influenced spa and restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/the-setai-south-beach.html' },
      { name: 'Faena Hotel Miami Beach', note: 'Faena brand — oceanfront on mid-Beach, Damien Hirst woolly mammoth, Tierra Santa Healing House spa · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/faena-miami-beach.html' },
      { name: 'Mandarin Oriental Miami', note: 'Mandarin Oriental — Brickell Key private island, two pools, Espa, Asia de Cuba restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/mandarin-oriental-miami.html' },
      { name: 'Four Seasons Hotel Miami', note: 'Four Seasons — Brickell Avenue, rooftop pool with Biscayne Bay views, Acqua restaurant · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-miami.html' }
    ] },
    'milan': { h: [
      { name: 'Bulgari Hotel Milano', note: 'Bulgari Hotels — private 4,000 sq m garden, golden onyx pool, Bulgari Spa, Brera neighborhood adjacency · 9.5 Booking.com' , url: 'https://www.booking.com/hotel/it/bulgari-hotel-milan.html' },
      { name: 'Four Seasons Hotel Milano', note: 'Four Seasons brand — 15th-century convent, Via Gesù courtyard garden, La Veranda restaurant · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/it/four-seasons-hotel-milano.html' },
      { name: 'Mandarin Oriental, Milan', note: 'Mandarin Oriental brand — five historic palazzi in Brera, Mandarin Bar & Bistrot, The Spa at Mandarin Oriental, design interiors · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/it/mandarin-oriental-milan.html' },
      { name: 'NH Collection Milano Porta Nuova', note: 'NH Collection — Porta Nuova business district, outdoor pool, La Forchetta restaurant, Unicredit Tower adjacent, modern design · 8.9 Booking.com' , url: 'https://www.booking.com/hotel/it/nh-collection-milano-porta-nuova.html' }
    ] },
    'monaco': { h: [
      { name: 'Hotel de Paris Monte-Carlo', note: 'SBM brand — 1864 Place du Casino landmark, outdoor pool, Louis XV three-Michelin-star dining · 9.3 Booking.com', url: 'https://www.booking.com/hotel/mc/ha-tel-de-paris.html' },
      { name: 'Hotel Hermitage Monte-Carlo', note: 'SBM brand — Belle Époque landmark, heated outdoor pool, Vistamar Mediterranean restaurant · 9.2 Booking.com', url: 'https://www.booking.com/hotel/mc/ha-tel-hermitage.html' },
      { name: 'Monte-Carlo Bay Hotel & Resort', note: 'SBM — Larvotto beachfront, lagoon pool on the sea, Le Blue Bay restaurant, The Bay spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/mc/monte-carlo-bay.html' },
      { name: 'Fairmont Monte Carlo', note: 'Fairmont brand — beachfront on Avenue Princesse Grace, outdoor pool, casino adjacent · 8.7 Booking.com', url: 'https://www.booking.com/hotel/mc/fairmont-monte-carlo.html' }
    ] },
    'montevideo': { h: [
      { name: 'Radisson Montevideo Victoria Plaza Hotel', note: 'Radisson brand — Plaza Independencia landmark tower, outdoor pool, panoramic city views · 8.3 Booking.com', url: 'https://www.booking.com/hotel/uy/radisson-montevideo-victoria-plaza.html' },
      { name: 'Cottage Hotel Montevideo', note: 'Independent boutique — Pocitos neighborhood, curated art, quiet residential atmosphere · 9.1 Booking.com', url: 'https://www.booking.com/hotel/uy/cottage-puerto-buceo.html' },
      { name: 'Hyatt Centric Montevideo', note: 'Hyatt brand — La Rambla oceanfront boulevard, indoor pool, beachfront location · 8.9 Booking.com', url: 'https://www.booking.com/hotel/uy/hyatt-centric-montevideo.html' },
      { name: 'Esplendor by Wyndham Montevideo Cervantes', note: 'Wyndham brand — Art Deco landmark, rooftop terrace with city views, indoor pool · 8.1 Booking.com', url: 'https://www.booking.com/hotel/uy/esplendor-cervantes-montevideo.html' }
    ] },
    'montreal': { h: [
      { name: 'Ritz-Carlton, Montréal', note: 'Ritz-Carlton brand — 1912 Sherbrooke Street landmark, spa with indoor pool, Maison Boulud gastronomic dining · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ca/montreal-1228-sherbrooke.html' },
      { name: 'Le Mount Stephen', note: 'Independent luxury — 1883 Golden Square Mile mansion, intimate 90 rooms, Bar George restaurant · 9.4 Booking.com', url: 'https://www.booking.com/hotel/ca/le-mount-stephen.html' },
      { name: 'Four Seasons Hotel Montréal', note: 'Four Seasons — Ogilvy Maison in Golden Square Mile, rooftop pool, Marcus restaurant · 9.4 Booking.com', url: 'https://www.booking.com/hotel/ca/four-seasons-montreal.html' },
      { name: 'Hotel William Gray', note: 'Independent — Old Montreal, rooftop terrace with Old Port views, STINT restaurant · 9.2 Booking.com', url: 'https://www.booking.com/hotel/ca/william-gray.html' }
    ] },
    'munich': { h: [
      { name: 'Hotel Vier Jahreszeiten Kempinski', note: 'Kempinski brand — 1858 Maximilianstrasse landmark, spa with indoor pool, Michelin-starred Schwarzreiter · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/de/hotel-vier-jahreszeiten-munich.html' },
      { name: 'The Charles Hotel Munich', note: 'Rocco Forte brand — Schwabing neighborhood, outdoor pool and garden, Sophia\'s Restaurant · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/de/the-charles-hotel.html' },
      { name: 'Mandarin Oriental, Munich', note: 'Mandarin Oriental brand — Neuturmstraße in the Old Town, indoor pool and spa, Mark\'s Restaurant, close to the Hofbräuhaus · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/de/mandarin-oriental-munich.html' },
      { name: 'Bayerischer Hof Munich', note: 'Independent grand hotel — Promenadeplatz 2 in the city centre, Blue Spa with rooftop pool, six restaurants, 24-hour butler · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/de/bayerischer-hof.html' }
    ] },
    'muscat': { h: [
      { name: 'The Chedi Muscat', note: 'GHM brand — 21 acres on the Sea of Oman, three pools including The Long Pool, award-winning spa · 9.1 Booking.com', url: 'https://www.booking.com/hotel/om/the-chedi-muscat.html' },
      { name: 'Al Bustan Palace, A Ritz-Carlton Hotel', note: 'Ritz-Carlton brand — private crescent-cove beach, outdoor amphitheater, palace-scale architecture · 9.0 Booking.com', url: 'https://www.booking.com/hotel/om/al-bustan-palace-ritz-carlton.html' },
      { name: 'Shangri-La Barr Al Jissah, Muscat', note: 'Shangri-La brand — clifftop resort in Bandar Jissah, two outdoor pools, private beach, marina · 8.5 Booking.com', url: 'https://www.booking.com/hotel/om/shangri-la-s-barr-al-jissah-resort-spa-muscat.html' },
      { name: 'InterContinental Muscat by IHG', note: 'IHG brand — Shati Al Qurum, direct beach access, palm gardens, five restaurants, spa · 8.9 Booking.com', url: 'https://www.booking.com/hotel/om/intercontinental-muscat.html' }
    ] },
    'mykonos': { h: [
      { name: 'Santa Marina, A Luxury Collection Resort', note: 'Marriott Luxury Collection — private beach on Ornos Bay, infinity pools, Caprice beach bar · 9.1 Booking.com', url: 'https://www.booking.com/hotel/gr/santamarinarestvillas.html' },
      { name: 'Kivotos Mykonos', note: 'Independent boutique — Ornos Bay, two seawater pools, private beach, on-site cinema · 9.3 Booking.com', url: 'https://www.booking.com/hotel/gr/kivotos.html' },
      { name: 'Myconian Imperial Hotel', note: 'Myconian Collection — Elia Beach, adults-only, three sea-view pools, Notos restaurant, Elixir Spa · 9.3 Booking.com', url: 'https://www.booking.com/hotel/gr/myconian-imperial-thalasso-resort-and-spa.html' },
      { name: 'Cavo Tagoo Mykonos', note: 'Independent — Tagoo hillside, infinity pool with floating bar, Cave restaurant · 9.2 Booking.com', url: 'https://www.booking.com/hotel/gr/cavo-tagoo.html' }
    ] },
    'napa': { h: [
      { name: 'Meadowood Napa Valley', note: 'Independent luxury — 250 acres, croquet, pools, hiking trails, three-Michelin-star Restaurant at Meadowood · 9.4 Booking.com' },
      { name: 'Auberge du Soleil', note: 'Auberge Resorts — hillside above Rutherford, outdoor pool with vineyard views, Michelin-starred restaurant · 9.3 Booking.com' },
      { name: 'Carneros Resort and Spa', note: 'Independent — 28-acre farm-like resort in Carneros wine region, four pools, full-service spa, FARM restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/carneros-inn.html' },
      { name: 'Meritage Resort and Spa', note: 'Independent — wine caves and spa, four pools, Estate Cave restaurant · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/the-meritage-resort-and-spa.html' }
    ] },
    'naples': { h: [
      { name: 'Grand Hotel Vesuvio', note: 'Independent luxury — Santa Lucia seafront, rooftop pool with Vesuvius views, 1882 heritage hotel · 9.2 Booking.com', url: 'https://www.booking.com/hotel/it/grand-vesuvio-napoli.html' },
      { name: 'Hotel Romeo Napoli', note: 'Independent boutique — port-view suites, Michelin-starred Il Comandante, rooftop pool with bay panorama · 9.3 Booking.com' },
      { name: 'Hotel Romeo Napoli', note: 'Independent — Via Cristoforo Colombo on the waterfront, rooftop Il Comandante restaurant, spa · 9.2 Booking.com', url: 'https://www.booking.com/hotel/it/hotel-romeo.html' },
      { name: 'Grand Hotel Parker\'s Napoli', note: 'Independent — Corso Vittorio Emanuele, panoramic views over the Gulf of Naples, George\'s restaurant · 9.1 Booking.com', url: 'https://www.booking.com/hotel/it/grand-hotel-parker-s.html' }
    ] },
    'naples-florida': { h: [
      { name: 'Naples Grande Beach Resort', note: 'Independent — 3-mile private beach, three pools, nine tennis courts, Gulf sunset views · 9.0 Booking.com' },
      { name: 'Inn on Fifth', note: 'Independent boutique — downtown Fifth Avenue South, rooftop pool and spa, Sunday Jazz brunch · 9.2 Booking.com' },
      { name: 'LaPlaya Beach & Golf Resort', note: 'Noble House Hotels — Vanderbilt Beach, private beach, three pools, Baleen restaurant · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/laplaya-beach-golf-resort.html' },
      { name: 'The Ritz-Carlton Naples', note: 'Ritz-Carlton brand — Naples Beach, Artisan restaurant, beachfront terrace pools · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/ritz-carlton-naples.html' }
    ] },
    'nashville': { h: [
      { name: 'Virgin Hotels Nashville', note: 'Virgin Hotels — Gulch neighborhood, rooftop pool, Commons Club dining and bar, boutique design · 8.9 Booking.com', url: 'https://www.booking.com/hotel/us/virgin-hotels-nashville.html' },
      { name: 'Conrad Nashville', note: 'Hilton family — Midtown luxury tower, outdoor pool, Mimo Restaurant, walkable to Music Row · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/conrad-nashville.html' },
      { name: 'The Joseph, a Luxury Collection Hotel Nashville', note: 'Marriott Luxury Collection — SoBro arts district, Yolan Italian restaurant, curated art · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/the-joseph.html' },
      { name: 'Loews Vanderbilt Hotel Nashville', note: 'Loews Hotels — West End near Vanderbilt University, outdoor pool, Prime 108 restaurant · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/loews-vanderbilt-plaza.html' }
    ] },
    'natal': { h: [
      { name: 'Rifóles Beach Hotel & Resort', note: 'Independent — beachfront on Ponta Negra, three pools, ocean views, close to Natal nightlife · 8.9 Booking.com', url: 'https://www.booking.com/hotel/br/rifoles-praia.html' },
      { name: 'Ocean Palace Beach Resort & Bungalows', note: 'Independent — Ponta Negra Beach frontage, full resort with multiple pools and water park · 8.5 Booking.com' },
      { name: 'Serhs Natal Grand Hotel', note: 'Serhs Hotels — Ponta Negra beachfront, outdoor pool, spa, large waterfront hotel · 8.7 Booking.com', url: 'https://www.booking.com/hotel/br/serhs-natal-grand.html' },
      { name: 'Pestana Natal Beach Resort', note: 'Pestana brand — Via Costeira beachfront, outdoor pool, Atlantic views, all-inclusive option · 8.5 Booking.com', url: 'https://www.booking.com/hotel/br/pestana-natal.html' }
    ] },
    'new-orleans': { h: [
      { name: 'The Ritz-Carlton, New Orleans', note: 'Ritz-Carlton brand — Canal Street landmark in 1907 Beaux-Arts building, spa, Club Lounge · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/nine-twenty-one-canal-street-new-orleans.html' },
      { name: 'Windsor Court Hotel', note: 'Independent luxury — AAA Five Diamond, $8M art collection, afternoon tea, pool and spa · 9.2 Booking.com' },
      { name: 'Hotel Monteleone', note: 'Independent — 1886 Royal Street icon, rotating Carousel Bar, rooftop pool, Hunt Room Grill · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/monteleone.html' },
      { name: 'Pontchartrain Hotel', note: 'Independent — St. Charles Avenue Garden District, rooftop pool with city views, Caribbean Room · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/the-pontchartrain-hotel.html' }
    ] },
    'new-york': { h: [
      { name: 'The Mark Hotel', note: 'Independent luxury — 25 East 77th Street Upper East Side, largest suite in NYC, Jean-Georges Vongerichten restaurant · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/us/the-mark-new-york.html' },
      { name: 'The Carlyle, A Rosewood Hotel', note: 'Rosewood brand — 1930 Upper East Side landmark, Bemelmans Bar murals, Café Carlyle cabaret · 9.5 Booking.com' , url: 'https://www.booking.com/hotel/us/the-carlyle.html' },
      { name: 'The Peninsula New York', note: 'Peninsula brand — Fifth Avenue and 55th Street, rooftop pool and bar, Julie Spa, Clement Restaurant, prime Midtown position · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/us/the-peninsula-new-york.html' },
      { name: 'Four Seasons Hotel New York Downtown', note: 'Four Seasons brand — Tribeca, private plunge pools in suites, CUT by Wolfgang Puck restaurant, spa, Hudson River proximity · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/us/four-seasons-hotel-new-york-downtown.html' }
    ] },
    'nice': { h: [
      { name: 'Hôtel Le Negresco', note: 'Independent luxury — 1913 Promenade des Anglais landmark, Royal Suite, Michelin-starred Chantecler restaurant · 9.0 Booking.com', url: 'https://www.booking.com/hotel/fr/negresco.html' },
      { name: 'Hyatt Regency Nice Palais de la Méditerranée', note: 'Hyatt brand — 1929 Art Deco Promenade des Anglais façade, sea-view rooftop, spa · 8.7 Booking.com' },
      { name: 'Hotel Beau Rivage Nice', note: 'Independent — Promenade des Anglais, private pebble beach, heated pool · 8.8 Booking.com', url: 'https://www.booking.com/hotel/fr/beau-rivage-nice.html' },
      { name: 'NH Collection Nice', note: 'NH Hotels — Place Masséna, rooftop pool with Baie des Anges views, Elixir Rooftop Bar · 9.0 Booking.com', url: 'https://www.booking.com/hotel/fr/nh-collection-nice.html' }
    ] },
    'oahu': { h: [
      { name: 'Royal Hawaiian, a Luxury Collection Resort', note: 'Marriott Luxury Collection — 1927 "Pink Palace of the Pacific," oceanfront on central Waikiki Beach, four pools · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/royal-hawaiian-a-luxury-collection-resort-honolulu.html' },
      { name: 'Four Seasons Resort Oahu at Ko Olina', note: 'Four Seasons brand — West Oahu lagoon beach, adults-focused pools, spa, away from Waikiki crowds · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-resort-oahu-at-ko-olina.html' },
      { name: 'Hyatt Regency Waikiki Beach Resort and Spa', note: 'Hyatt brand — twin towers on the beach at Kūhiō Ave, rooftop pool, open-air atrium mall · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/hyatt-regency-waikiki-beach-resort-and-spa.html' },
      { name: 'Moana Surfrider, A Westin Resort & Spa, Waikiki Beach', note: 'Marriott Westin — 1901 "First Lady of Waikiki," beachfront, iconic banyan courtyard, historic character · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/moana-surfrider-a-westin-resort-spa-waikiki-beach.html' }
    ] },
    'oaxaca': { h: [
      { name: 'Casa Oaxaca Hotel', note: 'Independent boutique — 6 suites around a colonial courtyard, rooftop pool, acclaimed El Restaurante, historic zone · 9.4 Booking.com' },
      { name: 'Hotel Escondido', note: 'Independent boutique — Oaxaca coast, clifftop cabañas, ocean views, farm-to-table restaurant · 9.3 Booking.com' },
      { name: 'Las Bugambilias Bed & Breakfast', note: 'Independent — colonial house in the historic center, Mexican garden courtyard · 9.6 Booking.com', url: 'https://www.booking.com/hotel/mx/las-bugambilias-bed-breakfast.html' },
      { name: 'Hotel Parador San Agustín', note: 'Independent — 18th-century Augustinian monastery, rooftop pool, spa, terrace with city views · 9.1 Booking.com', url: 'https://www.booking.com/hotel/mx/parador-san-agustin.html' }
    ] },
    'olinda': { h: [
      { name: 'Pousada dos Quatro Cantos', note: 'Independent boutique — colonial mansion in historic center, pool, close to Carnaval festivities · 9.2 Booking.com', url: 'https://www.booking.com/hotel/br/pousada-dos-quatro-cantos.html' },
      { name: 'Pousada do Amparo', note: 'Independent — 16th-century colonial house in UNESCO World Heritage town, art-filled rooms, garden · 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/pousada-do-amparo.html' },
      { name: 'Sete Colinas Hotel', note: 'Independent — hilltop colonial property in UNESCO historic core, pool with Recife panorama · 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/sete-colinas.html' },
      { name: 'Pousada Saudade', note: 'Independent — 18th-century house in the historic center, garden, hammocks, traditional breakfast · 9.2 Booking.com' }
    ] },
    'orcas-island': { h: [
      { name: 'Outlook Inn', note: 'Independent boutique — Eastsound village center, wraparound deck with water views, farm-fresh breakfast · 9.2 Booking.com' },
      { name: 'Deer Harbor Inn', note: 'Independent — Deer Harbor overlook, cottage-style rooms, outdoor hot tub, kayak rentals · 9.1 Booking.com' },
      { name: 'Rosario Resort & Spa', note: 'Independent — 1904 Moran estate on Cascade Bay, spa, pool, 40 acres of grounds · 8.4 Booking.com', url: 'https://www.booking.com/hotel/us/rosario-resort-spa.html' },
      { name: 'Orcas Hotel', note: 'Independent — 1904 Victorian at the Orcas ferry landing, wraparound porch, farm-to-table bistro · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/orcas-hotel.html' }
    ] },
    'orlando': { h: [
      { name: 'Loews Portofino Bay Hotel at Universal Orlando', note: 'Loews brand — Italian Riviera theming, three pools, on-site Universal Express Pass access · 9.0 Booking.com' },
      { name: 'Walt Disney World Swan Reserve', note: 'Autograph Collection (Marriott) — on Disney property, multilevel pool, three restaurants, complimentary MagicBand · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/walt-disney-world-swan-reserve.html' },
      { name: 'Four Seasons Resort Orlando at Walt Disney World Resort', note: 'Four Seasons — on Disney property, Explorer Pool with lazy river, Capa steakhouse · 9.4 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-resort-orlando.html' },
      { name: 'JW Marriott Orlando Grande Lakes', note: 'Marriott JW brand — Grande Lakes, lazy river, Greg Norman golf, Whisper Creek Farm-inspired dining · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/jw-marriott-grande-lakes.html' }
    ] },
    'osaka': { h: [
      { name: 'InterContinental Osaka', note: 'IHG brand — Grand Front Osaka, 57th-floor Pierre restaurant panorama, spa and indoor pool · 9.0 Booking.com', url: 'https://www.booking.com/hotel/jp/intercontinental-osaka.html' },
      { name: 'Conrad Osaka', note: 'Hilton family — Nakanoshima Festival City, sky infinity pool on 40th floor, harbor views · 9.2 Booking.com', url: 'https://www.booking.com/hotel/jp/conrad-osaka.html' },
      { name: 'St. Regis Osaka', note: 'Marriott St. Regis — Honmachi, Michelin-starred restaurant, butler service, modern tower · 9.4 Booking.com', url: 'https://www.booking.com/hotel/jp/the-st-regis-osaka.html' },
      { name: 'The Ritz-Carlton Osaka', note: 'Ritz-Carlton brand — Umeda, indoor pool, Splendor spa, La Baie French restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/jp/the-ritz-carlton-osaka.html' }
    ] },
    'oslo': { h: [
      { name: 'The Thief', note: 'Independent boutique — Tjuvholmen Sculpture Park waterfront, spa, contemporary art throughout · 9.3 Booking.com', url: 'https://www.booking.com/hotel/no/the-thief.html' },
      { name: 'Amerikalinjen', note: 'Independent — 1919 Norwegian America Line headquarters, 122 rooms, three restaurants, rooftop bar · 9.2 Booking.com', url: 'https://www.booking.com/hotel/no/amerikalinjen.html' },
      { name: 'Grand Hotel Oslo by Scandic', note: 'Scandic brand — Karl Johans Gate landmark since 1874, Palmen restaurant, indoor pool, central Royal Palace proximity · 8.8 Booking.com', url: 'https://www.booking.com/hotel/no/grand.html' },
      { name: 'Hotel Continental Oslo', note: 'Independent — Stortingsgaten near the National Theatre, Theatercaféen brasserie, acclaimed art collection, 155 rooms · 9.0 Booking.com', url: 'https://www.booking.com/hotel/no/continental.html' }
    ] },
    'oxford': { h: [
      { name: 'Le Manoir aux Quat\'Saisons, A Belmond Hotel', note: 'Belmond brand — Raymond Blanc\'s two-Michelin-star retreat in Great Milton, 32 rooms, kitchen garden · 9.7 Booking.com', url: 'https://www.booking.com/hotel/gb/belmond-le-manoir-aux-quat-39-saisons.html' },
      { name: 'The Randolph Hotel Oxford, a Graduate by Hilton', note: 'Hilton Graduate brand — 1866 Neo-Gothic landmark facing the Ashmolean, Spires spa, afternoon tea tradition · 8.9 Booking.com', url: 'https://www.booking.com/hotel/gb/randolph-hotel.html' },
      { name: 'Malmaison Oxford', note: 'Independent boutique — converted 19th-century prison, distinctive Grade II listed architecture, Brasserie and bar in the castle courtyard · 8.3 Booking.com', url: 'https://www.booking.com/hotel/gb/malmaison-oxford.html' },
      { name: 'Old Bank Hotel', note: 'Independent boutique 5-star — Oxford High Street, views of university spires, Quod restaurant and terrace, 43 rooms · 9.3 Booking.com', url: 'https://www.booking.com/hotel/gb/the-old-bank.html' }
    ] },
    'palawan': { h: [
      { name: 'Amanpulo', note: 'Aman brand — Pamalican private island, 40 casitas, crystal-clear lagoon, seaplane or charter access · 9.7 Booking.com' },
      { name: 'El Nido Resorts Miniloc Island', note: 'Independent — island resort in Bacuit Archipelago, overwater cottages, snorkeling straight off the deck · 9.1 Booking.com' },
      { name: 'El Nido Resorts Pangulasian Island', note: 'El Nido Resorts — solar-powered adults-preferred island resort, white sand beach, three pools · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ph/el-nido-resorts-pangulasian-island.html' },
      { name: 'Two Seasons Coron Island Resort & Spa', note: 'Independent — private Coron Island, overwater villas, PADI dive centre, wreck dives · 9.1 Booking.com' }
    ] },
    'palm-desert': { h: [
      { name: 'The Ritz-Carlton, Rancho Mirage', note: 'Ritz-Carlton brand — Coachella Valley hillside, outdoor pools, spa, panoramic desert valley views · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/the-ritz-carlton-rancho-mirage.html' },
      { name: 'Parker Palm Springs', note: 'Parker brand — 144 acres of vintage desert resort, two pools, Gene Autry\'s former home, Palm Springs style · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/parker-palm-springs.html' },
      { name: 'JW Marriott Desert Springs Resort & Spa', note: 'Marriott JW brand — Palm Desert resort, five outdoor pools, two golf courses, gondola rides through tropical waterways, full-service spa · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/jw-marriott-desert-springs-resort.html' },
      { name: 'La Quinta Resort & Club, Curio Collection by Hilton', note: 'Hilton Curio Collection — 1926 historic resort in La Quinta, 5 championship golf courses, 41 pools, 21 tennis courts, Spanish Colonial Revival architecture · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/la-quinta-resort-club.html' }
    ] },
    'palo-alto': { h: [
      { name: 'Rosewood Sand Hill', note: 'Rosewood brand — 16-acre Menlo Park estate, two outdoor pools, Sense spa, Madera restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/rosewood-sand-hill-94025.html' },
      { name: 'The Clement Palo Alto', note: 'Independent boutique — 711 El Camino Real, all-suite with rooftop pool, close to University Avenue · 9.6 Booking.com', url: 'https://www.booking.com/hotel/us/the-clement.html' },
      { name: 'AC Hotel by Marriott Palo Alto', note: 'Marriott AC brand — 744 San Antonio Road, terrace and bar, fitness centre, 4-star · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/ac-by-marriott-palo-alto.html' },
      { name: 'Graduate by Hilton Palo Alto', note: 'Hilton Graduate brand — 488 University Avenue downtown, restaurant and bar, walk to Stanford campus · 8.6 Booking.com', url: 'https://www.booking.com/hotel/us/graduate-palo-alto.html' }
    ] },
    'paris': { h: [
      { name: 'Le Meurice', note: 'Dorchester Collection — Tuileries-facing Palace hotel, two-Michelin-star Alain Ducasse restaurant, spa · 9.5 Booking.com', url: 'https://www.booking.com/hotel/fr/le-meurice-paris.html' },
      { name: 'Hotel de Crillon, A Rosewood Hotel', note: 'Rosewood brand — Place de la Concorde landmark, Les Ambassadeurs brasserie, indoor pool · 9.5 Booking.com', url: 'https://www.booking.com/hotel/fr/de-crillon-paris.html' },
      { name: 'The Peninsula Paris', note: 'Peninsula brand — Avenue Kléber near the Arc de Triomphe, rooftop pool and terrace, L\'Oiseau Blanc restaurant, spa · 9.4 Booking.com', url: 'https://www.booking.com/hotel/fr/the-peninsula-paris.html' },
      { name: 'Four Seasons Hotel George V Paris', note: 'Four Seasons brand — 31 Avenue George V, three Michelin-starred restaurants, La Spa George V, courtyard garden, close to Champs-Élysées · 9.4 Booking.com', url: 'https://www.booking.com/hotel/fr/four-seasons-george-v-paris.html' }
    ] },
    'pasadena': { h: [
      { name: 'The Langham Huntington, Pasadena', note: 'Langham brand — 23-acre estate on South Oak Knoll, Olympic pool, formal gardens, 1914 landmark hotel · 8.6 Booking.com', url: 'https://www.booking.com/hotel/us/the-langham-huntington-spa-pasadena.html' },
      { name: 'Hotel Dena, Pasadena Los Angeles, a Tribute Portfolio Hotel', note: 'Marriott Tribute Portfolio — 303 Cordova Street near the Convention Center, heated outdoor pool, restaurant and bar · 8.0 Booking.com', url: 'https://www.booking.com/hotel/us/sheraton-pasadena.html' },
      { name: 'Hyatt Place Pasadena', note: 'Hyatt Place brand — 399 East Green Street steps from Paseo Colorado, outdoor pool, fitness centre · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/hyatt-place-pasadena.html' },
      { name: 'Pasadena Hotel & Pool', note: 'Independent — 928 East Colorado Boulevard, rooftop pool with pool bar, restaurant, 4-star · 8.6 Booking.com', url: 'https://www.booking.com/hotel/us/pasadenahotelandpool.html' }
    ] },
    'pensacola': { h: [
      { name: 'Portofino Island Resort', note: 'Independent — Santa Rosa Island, Gulf Spa, multiple pools, direct Gulf of Mexico beachfront · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/portofino-island-resort.html' },
      { name: 'The Hotel Pensacola Beach, a Wyndham Hotel', note: 'Wyndham brand — Pensacola Beach, Gulf-view rooms, pool, casual beach dining · 8.3 Booking.com' },
      { name: 'Margaritaville Beach Hotel', note: 'Margaritaville Hotels — Pensacola Beach waterfront, five pools, Landshark Bar & Grill · 8.9 Booking.com', url: 'https://www.booking.com/hotel/us/margaritaville-beach-hotel-pensacola-beach.html' },
      { name: 'Hilton Pensacola Beach', note: 'Hilton brand — Gulf Breeze Parkway beachfront, outdoor pool, Seafood & Grille restaurant · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/hilton-pensacola-beach.html' }
    ] },
    'petra': { h: [
      { name: 'Petra Guest House Hotel', note: 'Independent boutique — at the siq entrance gate, Cave Bar in a 2,000-year-old Nabataean cave, unbeatable proximity to the Treasury · 8.9 Booking.com', url: 'https://www.booking.com/hotel/jo/guesthouse-petra.html' },
      { name: 'The Old Village Hotel & Resort Petra', note: 'Independent — village setting near the siq entrance, terrace pool with wadi views, traditional stone architecture · 9.0 Booking.com', url: 'https://www.booking.com/hotel/jo/the-old-village-amp-resort.html' },
      { name: 'Mövenpick Resort Petra', note: 'Mövenpick brand — Petra gate, walking distance to Treasury entrance, pool, Rüm Fusion restaurant · 8.8 Booking.com', url: 'https://www.booking.com/hotel/jo/movenpick-petra.html' },
      { name: 'Petra Marriott Hotel', note: 'Marriott brand — beside the Petra visitors\' entrance, Al Iwan restaurant, outdoor pool · 8.5 Booking.com', url: 'https://www.booking.com/hotel/jo/petra-marriott.html' }
    ] },
    'philadelphia': { h: [
      { name: 'The Logan Hotel, Curio Collection by Hilton', note: 'Hilton Curio — Logan Square, rooftop pool and urban garden terrace, Steps restaurant · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/the-logan-philadelphia.html' },
      { name: 'Hotel Monaco Philadelphia, a Kimpton Hotel', note: 'Kimpton — Old City former Federal Customs House, curated social spaces, pet-friendly · 8.9 Booking.com' },
      { name: 'Four Seasons Hotel Philadelphia at Comcast Center', note: 'Four Seasons — 60th-floor penthouse pool with panoramic views, Jean-Georges restaurant, spa · 9.5 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-philadelphia.html' },
      { name: 'Loews Philadelphia Hotel', note: 'Loews Hotels — Art Deco PSFS Building, heated indoor pool, Bank + Bourbon restaurant · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/loews-philadelphia-hotel.html' }
    ] },
    'phoenix': { h: [
      { name: 'The Arizona Biltmore, A Waldorf Astoria Resort', note: 'Waldorf Astoria brand — 1929 Frank Lloyd Wright-influenced design, eight pools, lush landscaping, Esplanade spa · 9.0 Booking.com' },
      { name: 'Royal Palms Resort and Spa, A Tribute Portfolio Resort', note: 'Marriott Tribute — hacienda-style resort, T. Cook\'s restaurant, pool, Camelback Mountain backdrop · 8.9 Booking.com' },
      { name: 'Kimpton Hotel Palomar Phoenix Cityscape by IHG', note: 'Kimpton by IHG — 2 East Jefferson Street, downtown Phoenix Cityscape, rooftop outdoor pool deck, bar, fitness centre · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/kimpton-hotel-palomar-phoenix.html' },
      { name: 'Hyatt Regency Phoenix Downtown', note: 'Hyatt brand — 122 North 2nd Street, downtown Phoenix, revolving Compass Arizona Grill restaurant, outdoor pool, Phoenix Convention Center adjacent · 8.5 Booking.com', url: 'https://www.booking.com/hotel/us/phoenix-north-second-street.html' }
    ] },
    'phuket': { h: [
      { name: 'Amanpuri', note: 'Aman brand — Phuket\'s original luxury resort since 1988, private beach, 30 pavilions and villas, two pools · 9.5 Booking.com' },
      { name: 'Trisara', note: 'Independent luxury — private pool villas on Nai Thon Bay, Pru restaurant (Asia\'s 50 Best), beachfront setting · 9.6 Booking.com', url: 'https://www.booking.com/hotel/th/trisara.html' },
      { name: 'Paresa Resort Phuket', note: 'Independent — Kamala cliff-edge, adults-only, eight pool villas, Aspara spa · 9.4 Booking.com', url: 'https://www.booking.com/hotel/th/paresa-resort-phuket.html' },
      { name: 'Keemala Phuket', note: 'Small Luxury Hotels — Kamala rainforest, pool-villa-only property, Mala restaurant · 9.5 Booking.com', url: 'https://www.booking.com/hotel/th/keemala.html' }
    ] },
    'pisa': { h: [
      { name: 'Hotel Duomo Pisa', note: 'Independent boutique — steps from Piazza dei Miracoli, rooftop terrace with Leaning Tower and Baptistery views · 9.0 Booking.com' },
      { name: 'NH Pisa', note: 'NH Hotels — Piazza della Stazione, 5-min walk from the Campo dei Miracoli, restaurant and bar · 8.3 Booking.com', url: 'https://www.booking.com/hotel/it/nh-pisa.html' },
      { name: 'Grand Hotel Bonanno', note: 'Independent — near Cathedral Square, neoclassical palazzo, free bikes, garden · 8.8 Booking.com', url: 'https://www.booking.com/hotel/it/grand-hotel-bonanno.html' },
      { name: 'Hotel Minerva Pisa', note: 'Independent — Art Nouveau building, panoramic roof terrace, 3-min walk from the Leaning Tower · 9.0 Booking.com', url: 'https://www.booking.com/hotel/it/hotel-minerva-pisa.html' }
    ] },
    'pokhara': { h: [
      { name: 'Pavilions Himalayas', note: 'Independent boutique — eco-luxury farm retreat on Annapurna foothills, Phewa Lake views, organic farm produce · 9.3 Booking.com' },
      { name: 'Temple Tree Resort & Spa', note: 'Independent — Lakeside district, Phewa Lake views, pool, Himalayan spa treatments · 8.8 Booking.com', url: 'https://www.booking.com/hotel/np/temple-tree-resort.html' },
      { name: 'Tiger Mountain Pokhara Lodge', note: 'Tiger Mountain — hillside eco-lodge, panoramic Annapurna and Machhapuchhre views, trekking base · 9.3 Booking.com', url: 'https://www.booking.com/hotel/np/tiger-mountain-pokhara-lodge.html' },
      { name: 'Fish Tail Lodge', note: 'Independent — private island in Phewa Lake reached by rope ferry, gardens, pool with Fishtail Mountain views · 8.9 Booking.com', url: 'https://www.booking.com/hotel/np/fishtail-lodge.html' }
    ] },
    'portland': { h: [
      { name: 'The Benson Hotel, Autograph Collection', note: 'Marriott Autograph Collection — 1912 downtown landmark, Circassian walnut-paneled lobby, The London Grill · 8.9 Booking.com' },
      { name: 'Hotel deLuxe', note: 'Independent boutique — Hollywood-themed vintage design, Driftwood Room bar, Pearl District adjacent · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/729-six-15th-avenue.html' },
      { name: 'The Heathman Hotel', note: 'Independent historic — 1927 arts district landmark adjacent to Arlene Schnitzer Concert Hall, Tea Court lobby, literary guest book collection · 9.2 Expedia' },
      { name: 'The Nines, A Luxury Collection Hotel', note: 'Marriott Luxury Collection — upper floors of the 1909 Meier & Frank Building on National Register, atrium lobby, Urban Farmer restaurant · 4.4 TripAdvisor', url: 'https://www.booking.com/hotel/us/the-nines.html' }
    ] },
    'porto': { h: [
      { name: 'The Yeatman Hotel', note: 'Independent luxury — Taylor\'s Port wine cellars hilltop, infinity pool, two-Michelin-star Yeatman Restaurant, Douro panorama · 9.5 Booking.com' , url: 'https://www.booking.com/hotel/pt/the-yeatman.html' },
      { name: 'Torel Avantgarde', note: 'Independent boutique — adults-only, hilltop gardens with city and Douro panoramas, outdoor pool · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/pt/torel-avantgarde.html' },
      { name: 'Infante Sagres Luxury Historic Hotel', note: 'Leading Hotels of the World — 1951 Art Deco building in central Porto, Portuense restaurant, curated antique interiors · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/pt/infante-de-sagres.html' },
      { name: 'InterContinental Porto - Palácio das Cardosas', note: 'IHG brand — 18th-century convent on Praça da Liberdade, outdoor heated pool, Astoria restaurant, National Parliament adjacent · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/pt/intercontinental-porto-palacio-das-cardosas.html' }
    ] },
    'porto-alegre': { h: [
      { name: 'Sheraton Porto Alegre Hotel', note: 'Marriott family — Praia de Belas district, outdoor pool, business-class service, convention facilities · 8.4 Booking.com' },
      { name: 'Intercity Porto Alegre Iguatemi', note: 'Intercity Hotels — Moinhos de Vento neighborhood, modern boutique, spa · 9.0 Booking.com' },
      { name: 'Lancaster Hotel Porto Alegre', note: 'Independent — near the Gasômetro, classic rooms, business facilities, central location · 8.5 Booking.com' },
      { name: 'Laghetto Stilo Higienópolis', note: 'Laghetto Hotels — Higienópolis district, rooftop pool with city views, fitness centre · 8.9 Booking.com', url: 'https://www.booking.com/hotel/br/laghetto-stilo-higienopolis.html' }
    ] },
    'prague': { h: [
      { name: 'Four Seasons Hotel Prague', note: 'Four Seasons brand — Staré Město with Vltava views, spa with outdoor pool, CottoCrudo restaurant · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/cz/four-seasons-prague.html' },
      { name: 'Hotel Aria', note: 'Independent boutique — music-themed, private Vrtba Garden access, Coda Rooftop with castle and city views · 9.5 Booking.com' , url: 'https://www.booking.com/hotel/cz/aria.html' },
    
      { name: 'Mandarin Oriental Prague', note: 'Mandarin Oriental brand — Malá Strana, Spices Restaurant, spa with indoor pool, 13th-century chapel setting · 9.2 Booking.com', url: 'https://www.booking.com/hotel/cz/mandarin-oriental-prague.html' },
      { name: 'Hotel Paris Prague', note: 'Independent — 1907 Art Nouveau landmark near Old Town, Sarah Bernhardt restaurant, belle époque décor · 9.0 Booking.com', url: 'https://www.booking.com/hotel/cz/hotel-paris-prague.html' }
    ] },
    'puerto-rico': { h: [
      { name: 'El San Juan Hotel, Curio Collection by Hilton', note: 'Hilton Curio — Isla Verde beachfront, historic 1958 mahogany lobby, three pools · 8.9 Booking.com', url: 'https://www.booking.com/hotel/pr/el-san-juan-casino.html' },
      { name: 'Dorado Beach, a Ritz-Carlton Reserve', note: 'Ritz-Carlton Reserve — 1,400-acre beachfront estate, six pools, two golf courses · 9.4 Booking.com', url: 'https://www.booking.com/hotel/pr/dorado-beach-a-ritz-carlton-reserve.html' },
      { name: 'La Concha Renaissance San Juan Resort', note: 'Marriott Renaissance — Condado Beach, 1950s concha-shell architecture, two pools, spa · 8.8 Booking.com', url: 'https://www.booking.com/hotel/pr/la-concha-a-renaissance-resort.html' },
      { name: 'Caribe Hilton', note: 'Hilton brand — San Geronimo Grounds, site of the original Piña Colada, private beach · 8.7 Booking.com', url: 'https://www.booking.com/hotel/pr/caribe-hilton.html' }
    ] },
    'puerto-vallarta': { h: [
      { name: 'Garza Blanca Preserve Resort & Spa', note: 'Independent luxury — hillside jungle preserve with private white-sand beach, infinity pools, adults-only towers · 9.3 Booking.com', url: 'https://www.booking.com/hotel/mx/garza-blanca-preserve-resort-spa.html' },
      { name: 'Casa Velas Hotel Boutique', note: 'Independent boutique — adults-only, marina suite design, beach club, oceanfront pool · 9.2 Booking.com', url: 'https://www.booking.com/hotel/mx/casa-vellas-boutique.html' },
      { name: 'Four Seasons Resort Punta Mita', note: 'Four Seasons — Punta Mita peninsula, two golf courses, Apuane Spa, private beach · 9.5 Booking.com', url: 'https://www.booking.com/hotel/mx/four-seasons-resort-punta-mita.html' },
      { name: 'Grand Velas Riviera Nayarit', note: 'Velas Resorts — Nuevo Vallarta beachfront all-inclusive, nine restaurants, Se Spa, three pools · 9.3 Booking.com', url: 'https://www.booking.com/hotel/mx/grand-velas-riviera-nayarit.html' }
    ] },
    'quebec-city': { h: [
      { name: 'Auberge Saint-Antoine', note: 'Independent luxury — Old Port waterfront, archaeological artifacts displayed throughout, rooftop terrace views · 9.4 Booking.com', url: 'https://www.booking.com/hotel/ca/auberge-saint-antoine.html' },
      { name: 'Hotel-Musée Premières Nations', note: 'Independent — Wendake First Nations reserve, 55 rooms designed around indigenous culture, traditional cuisine · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ca/h-musee-premieres-nations-wendake-quebec.html' },
      { name: 'Fairmont Le Château Frontenac', note: 'Fairmont brand — 1893 castle above the St. Lawrence, terrace pool, Champlain restaurant · 9.0 Booking.com', url: 'https://www.booking.com/hotel/ca/chateau-frontenac.html' },
      { name: 'Le Saint-Pierre Hotel', note: 'Independent boutique — Old Quebec Petit-Champlain district, 18th-century heritage, courtyard garden · 9.2 Booking.com', url: 'https://www.booking.com/hotel/ca/saint-pierre.html' }
    ] },
    'queenstown': { h: [
      { name: 'Eichardt\'s Private Hotel', note: 'Independent boutique — lakefront, 5-suite private hotel, celebrated Eichardt\'s Bar, Queenstown historic building · 9.5 Booking.com', url: 'https://www.booking.com/hotel/nz/eichardt-private.html' },
      { name: 'Rees Hotel & Luxury Apartments', note: 'Independent — lakefront panoramas, spa and pool, fine dining, private jetty · 9.2 Booking.com', url: 'https://www.booking.com/hotel/nz/the-rees-luxury-apartments.html' },
      { name: 'Azur Lodge', note: 'Independent — nine luxury cottages on Queenstown Hill, private lake views, infinity pool · 9.6 Booking.com', url: 'https://www.booking.com/hotel/nz/azur-lodge.html' },
      { name: 'Hilton Queenstown Resort & Spa', note: 'Hilton brand — Peninsula Road lakefront, outdoor hot pool, spa, panoramic Lake Wakatipu views · 9.1 Booking.com', url: 'https://www.booking.com/hotel/nz/hilton-queenstown.html' }
    ] },
    'recife': { h: [
      { name: 'Sheraton Recife Hotel', note: 'Marriott family — Boa Viagem beach district, outdoor pool, multiple restaurants, business facilities · 8.4 Booking.com' },
      { name: 'Hotel Boa Viagem by Nobile', note: 'Nobile Hotels — directly on Boa Viagem beach, rooftop pool, sea views · 8.7 Booking.com' },
      { name: 'Ritz Suítes Hotel Recife', note: 'Independent — Boa Viagem beachfront, outdoor pool, Sky Bar rooftop terrace · 8.8 Booking.com', url: 'https://www.booking.com/hotel/br/ritz-suites-recife.html' },
      { name: 'Hotel Atlante Plaza Recife', note: 'Independent — Boa Viagem beachfront, rooftop pool, full-service spa · 8.6 Booking.com', url: 'https://www.booking.com/hotel/br/atlante-plaza.html' }
    ] },
    'reykjavik': { h: [
      { name: 'Hotel Borg', note: 'Independent luxury — 1930 Art Deco landmark on Austurvöllur Square, Michelin Guide listed restaurant, timeless elegance · 9.1 Booking.com', url: 'https://www.booking.com/hotel/is/borg.html' },
      { name: 'The Reykjavik EDITION', note: 'Marriott Edition brand — harbour panoramas, outdoor heated infinity pool, Tides restaurant · 9.2 Booking.com', url: 'https://www.booking.com/hotel/is/the-reykjavik-edition.html' },
      { name: 'Ion Adventure Hotel', note: 'Design Hotels — geothermal area 45 min east, aurora-viewing rooms, infinity hot tub · 9.1 Booking.com', url: 'https://www.booking.com/hotel/is/ion-adventure-hotel.html' },
      { name: 'Canopy by Hilton Reykjavik City Centre', note: 'Hilton Canopy brand — near Hallgrímskirkja, Geysir Bar, design-forward rooms · 9.1 Booking.com', url: 'https://www.booking.com/hotel/is/canopy-by-hilton-reykjavik.html' }
    ] },
    'rhodes': { h: [
      { name: 'Lindos Blu Luxury Hotel & Suites', note: 'Independent boutique — adults-only clifftop above Lindos Bay, infinity pool, cave-style architecture · 9.4 Booking.com', url: 'https://www.booking.com/hotel/gr/lindos-blu.html' },
      { name: 'Melenos Lindos Hotel', note: 'Independent boutique — above Lindos village, sea-view terraces, pool, ceramics-accented Aegean design · 9.5 Booking.com', url: 'https://www.booking.com/hotel/gr/melenos-lindos.html' },
      { name: 'Ixian Grand & All Suites', note: 'Independent — Ixia beachfront, all-suite, adult-only pool, spa, Steps 1-6 restaurant · 9.1 Booking.com', url: 'https://www.booking.com/hotel/gr/ixian-grand.html' },
      { name: 'Atrium Prestige Thalasso Spa Resort & Villas', note: 'Independent — Lachania village, thalassotherapy centre, three pools, sea views · 8.9 Booking.com', url: 'https://www.booking.com/hotel/gr/atrium-prestige-thalasso-spa-resort-villas.html' }
    ] },
    'rio-de-janeiro': { h: [
      { name: 'Hotel Nacional Rio de Janeiro', note: 'Independent — Oscar Niemeyer-designed 1968 modernist cylinder, São Conrado beachfront, iconic architecture · 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/hotel-nacional-rio-de-janeiro.html' },
      { name: 'Fairmont Rio de Janeiro Copacabana', note: 'Fairmont brand — Copacabana beachfront, sky pool with Sugarloaf views, multiple restaurants · 9.1 Booking.com' },
      { name: 'Belmond Copacabana Palace', note: 'Belmond — Copacabana beachfront since 1923, outdoor pool, Michelin-starred Cipriani · 9.3 Booking.com', url: 'https://www.booking.com/hotel/br/copacabana-palace.html' },
      { name: 'Hotel Fasano Rio de Janeiro', note: 'Fasano brand — Vieira Souto on Ipanema beachfront, rooftop pool, Fasano Al Mare restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/br/fasano-rio.html' }
    ] },
    'rome': { h: [
      { name: 'Hotel Eden, a Dorchester Collection Hotel', note: 'Dorchester Collection — Via Ludovisi, rooftop restaurant Il Giardino with seven-hill panorama, spa · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/it/hotel-eden-rome.html' },
      { name: 'Villa Spalletti Trivelli', note: 'Independent boutique — 12 rooms in private noble villa near Quirinale, garden, pool, antique furnishings · 9.5 Booking.com' , url: 'https://www.booking.com/hotel/it/villa-spalletti-trivelli.html' },
      { name: 'Hotel de Russie', note: 'Rocco Forte brand — Via del Babuino near Piazza del Popolo, Secret Garden terrace, Stravinskij Bar, spa with pool · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/it/de-russie.html' },
      { name: 'J.K. Place Roma', note: 'Independent boutique — 30 rooms on Via Monte d\'Oro near the Pantheon, private palazzo feel, rooftop deck, curated art collection · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/it/jk-place-roma.html' }
    ] },
    'rotterdam': { h: [
      { name: 'Haven Hotel Rotterdam, Curio Collection by Hilton', note: 'Hilton Curio Collection — Leuvehaven 77, waterfront location near ss Rotterdam, 8.6 Booking.com · 1,544 reviews', url: 'https://www.booking.com/hotel/nl/mainport-hotel.html' },
      { name: 'Rotterdam Marriott Hotel', note: 'Marriott brand — Weena 686, central near Rotterdam Centraal, 8.5 Booking.com · 4,464 reviews', url: 'https://www.booking.com/hotel/nl/rotterdam-marriott-hotel.html' },
      { name: 'Morgan & Mees Rotterdam', note: 'Independent boutique — Mathenesserlaan 145, West Coolhaven neighbourhood, 8.9 Booking.com · 1,042 reviews', url: 'https://www.booking.com/hotel/nl/morgan-amp-mees-rotterdam.html' },
      { name: 'Room Mate Bruno, Rotterdam', note: 'Room Mate brand — Wilhelminakade 52, Kop van Zuid waterfront, 8.5 Booking.com · 10,690 reviews', url: 'https://www.booking.com/hotel/nl/room-mate-bruno.html' },
      { name: 'Hilton Rotterdam', note: 'Hilton brand — Weena 10, central near Centraal, in-house Joelia Michelin-starred restaurant, 8.1 Booking.com · 2,403 reviews', url: 'https://www.booking.com/hotel/nl/hiltonrotterdam.html' }
    ] },
    'salvador': { h: [
      { name: 'Pestana Convento do Carmo', note: 'Pestana brand — 16th-century Carmelite convent in Pelourinho UNESCO district, pool and spa · 9.3 Booking.com', url: 'https://www.booking.com/hotel/br/pestana-convento-do-carmo.html' },
      { name: 'Zank by Toque Hotel', note: 'Independent boutique — adults-only, Santo Antônio neighborhood clifftop, pool with bay panorama · 9.2 Booking.com', url: 'https://www.booking.com/hotel/br/zank-boutique.html' },
      { name: 'Fera Palace Hotel', note: 'Independent — historic Praça Castro Alves, colonial architecture, fine dining · 8.8 Booking.com', url: 'https://www.booking.com/hotel/br/fera-palace.html' },
      { name: 'Hotel Bahia do Sol', note: 'Independent — Barra neighborhood, outdoor pool with bay views, near Farol da Barra lighthouse · 8.6 Booking.com', url: 'https://www.booking.com/hotel/br/bahia-do-sol.html' }
    ] },
    'salzburg': { h: [
      { name: 'Schloss Mönchstein', note: 'Independent luxury — 14th-century castle above the Old Town, spa, panoramic garden with city views · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/at/schloss-monchstein.html' },
      { name: 'Hotel Bristol Salzburg', note: 'Small Luxury Hotels — Makartplatz, spa with indoor pool, facing Landestheater, classic elegance · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/at/hotel-bristol-salzburg.html' },
      { name: 'Goldener Hirsch, a Luxury Collection Hotel', note: 'Marriott Luxury Collection — medieval inn on Getreidegasse, Goldener Hirsch restaurant, low-ceilinged historic rooms · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/at/goldener-hirsch.html' },
      { name: 'Hotel Sacher Salzburg', note: 'Independent — Schwarzstrasse on the Salzach River, iconic Sacher Torte heritage, terrace and river views, spa · 8.9 Booking.com' , url: 'https://www.booking.com/hotel/at/sacher-salzburg.html' }
    ] },
    'san-diego': { h: [
      { name: 'The US Grant Hotel', note: 'IHG brand — 1910 downtown landmark, spa, Lobby Bar, Grant Grill, Gaslamp Quarter location · 8.8 Booking.com' , url: 'https://www.booking.com/hotel/us/the-us-grant.html' },
      { name: 'Pendry San Diego', note: 'Montage Hotels — Gaslamp Quarter, rooftop Pool & Cabana Club, Lionfish Modern Coastal Cuisine, spa, central downtown location · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/us/pendry-san-diego.html' },
      { name: 'Manchester Grand Hyatt San Diego', note: 'Hyatt brand — One Market Place downtown, 40-story bay-view towers, Top of the Hyatt rooftop lounge, two pools, five restaurants · 8.6 Booking.com', url: 'https://www.booking.com/hotel/us/manchester-grand-hyatt-san-diego.html' },
      { name: 'Marriott Marquis San Diego Marina', note: 'Marriott brand — 333 West Harbor Drive downtown waterfront, outdoor pool, Roy\'s restaurant, bay and marina views · 8.6 Booking.com', url: 'https://www.booking.com/hotel/us/san-diego-marriott.html' }
    ] },
    'san-francisco': { h: [
      { name: 'Fairmont San Francisco', note: 'Fairmont brand — 1907 Nob Hill landmark, spa, Tonga Room tiki bar, rooftop garden suite · 8.9 Booking.com', url: 'https://www.booking.com/hotel/us/the-fairmont-san-francisco-san-francisco-california.html' },
      { name: 'Hotel Drisco', note: 'Independent boutique — 1903 Edwardian in Pacific Heights, complimentary chauffeur service, quiet luxury · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/drisco.html' },
      { name: 'The Ritz-Carlton, San Francisco', note: 'Ritz-Carlton brand — Nob Hill in a converted Masonic temple, indoor pool, The Dining Room, full-service spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/the-ritz-carlton-san-francisco.html' },
      { name: 'Four Seasons Hotel San Francisco at Embarcadero', note: 'Four Seasons brand — Embarcadero Center, bay-view rooms, waterfront location, indoor pool, The Market restaurant · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-embarcadero.html' }
    ] },
    'san-jose': { h: [
      { name: 'Fairmont San Jose', note: 'Fairmont brand — Almaden Valley, rooftop pool, multiple restaurants, convention center linked · 8.8 Booking.com' },
      { name: 'Hotel De Anza, a Tapestry Collection by Hilton', note: 'Hilton Tapestry — 1931 Art Deco landmark in downtown San Jose, La Pastaia Italian restaurant · 8.6 Booking.com', url: 'https://www.booking.com/hotel/us/de-anza.html' },
      { name: 'The Westin San Jose', note: 'Marriott Westin — North Market Street Silicon Valley, WestinWORKOUT, Enoteca restaurant · 8.6 Booking.com', url: 'https://www.booking.com/hotel/us/the-westin-san-jose.html' },
      { name: 'Hotel Valencia Santana Row', note: 'Independent — boutique on Santana Row shopping, Citrus restaurant, outdoor patio, rooftop lounge · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/hotel-valencia-santana-row.html' }
    ] },
    'san-jose-costa-rica': { h: [
      { name: 'Hotel Grano de Oro', note: 'Independent boutique — converted Victorian mansion, tropical gardens, pool, Café Mundo restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/cr/grano-de-oro.html' },
      { name: 'InterContinental Costa Rica at Multiplaza Mall', note: 'IHG brand — Escazú upscale suburb, pools, multiple restaurants, convenient business location · 8.7 Booking.com', url: 'https://www.booking.com/hotel/cr/real-intercontinental.html' },
      { name: 'Real InterContinental San José', note: 'IHG brand — Escazú shopping district, outdoor pool, four restaurants · 8.7 Booking.com', url: 'https://www.booking.com/hotel/cr/real-intercontinental-costa-rica.html' },
      { name: 'Hyatt Place San José - Pinares', note: 'Hyatt brand — Curridabat, rooftop pool and bar with volcano views, gallery kitchen restaurant · 8.9 Booking.com', url: 'https://www.booking.com/hotel/cr/hyatt-place-san-jose-pinares.html' }
    ] },
    'san-juan-island': { h: [
      { name: 'Friday Harbor House Hotel', note: 'Independent boutique — above Friday Harbor Marina, harbor and Olympic Mountain views, Pacific Northwest design · 9.0 Booking.com' },
      { name: 'Tucker House Inn', note: 'Independent — Friday Harbor, 1898 Victorian B&B with garden hot tub, walk to ferry · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/tucker-house-inn.html' },
      { name: 'Earthbox Inn & Spa', note: 'Independent — Friday Harbor, eco-minded inn, spa and hot tub, two blocks from the ferry · 8.8 Booking.com' },
      { name: 'Trumpeter Inn', note: 'Independent — country-setting B&B, private pond with trumpeter swans, full gourmet breakfast · 9.7 Booking.com' }
    ] },
    'san-sebastian': { h: [
      { name: 'Hotel Maria Cristina, a Luxury Collection Hotel', note: 'Marriott Luxury Collection — 1912 Belle Époque landmark on Urumea riverside, San Sebastián Film Festival HQ · 9.3 Booking.com' },
      { name: 'Akelarre Hotel', note: 'Independent — Pedro Subijana three-Michelin-star restaurant, 22 rooms on Igeldo cliffs, Bay of Biscay panorama · 9.7 Booking.com' },
      { name: 'Hotel Villa Soro', note: 'Independent — 1890s Edwardian mansion in Ondarreta, pool, garden, 10 min to La Concha beach · 9.2 Booking.com', url: 'https://www.booking.com/hotel/es/villa-soro.html' },
      { name: 'Hotel de Londres y de Inglaterra', note: 'Independent — Paseo de la Concha seafront, terrace with bay views, Brasserie restaurant · 8.8 Booking.com', url: 'https://www.booking.com/hotel/es/de-londres-y-de-inglaterra.html' }
    ] },
    'santa-barbara': { h: [
      { name: 'El Encanto, A Belmond Hotel', note: 'Belmond brand — hilltop Spanish-Colonial bungalows, infinity pool, ocean and garden views · 9.2 Booking.com' },
      { name: 'Rosewood Miramar Beach', note: 'Rosewood brand — Montecito oceanfront, 16 acres of gardens, pool, beachfront restaurant · 9.3 Booking.com' },
      { name: 'Four Seasons Resort The Biltmore Santa Barbara', note: 'Four Seasons — Butterfly Beach Montecito, Spanish-Moorish landmark since 1927, Coral Casino club, two pools · 9.4 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-santa-barbara.html' },
      { name: 'Kimpton Canary Hotel', note: 'IHG Kimpton — Anacapa Street downtown, rooftop pool with mountains-and-ocean views, Finch & Fork restaurant · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/canary.html' }
    ] },
    'santa-cruz': { h: [
      { name: 'Chaminade Resort & Spa', note: 'Independent — hilltop eucalyptus-forest retreat above Monterey Bay, tennis courts, spa · 8.9 Booking.com' },
      { name: 'Babbling Brook Inn', note: 'Independent boutique — garden B&B with cascading creek, antiques, walking distance to downtown · 9.3 Booking.com' },
      { name: 'Dream Inn Santa Cruz', note: 'Independent — Cowell Beach waterfront, heated oceanfront pool, Aquarius restaurant · 8.9 Booking.com', url: 'https://www.booking.com/hotel/us/dream-inn.html' },
      { name: 'Hotel Paradox, Autograph Collection', note: 'Marriott Autograph Collection — downtown, outdoor pool, Acme Coffee, five blocks from the Boardwalk · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/hotel-paradox.html' }
    ] },
    'santa-fe': { h: [
      { name: 'Rosewood Inn of the Anasazi', note: 'Rosewood brand — kiva fireplaces, hand-woven rugs, steps from the historic Plaza · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/us/rosewood-inn-of-the-anasazi.html' },
      { name: 'La Fonda on the Plaza', note: 'Independent — 1922 Pueblo Revival landmark "Inn at the end of the Santa Fe Trail," rooftop cantina · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/us/la-fonda-on-the-plaza.html' },
      { name: "Bishop\'s Lodge, Auberge Resorts Collection", note: 'Auberge Resorts — 4 miles north in the foothills, heated outdoor pool with Sangre de Cristo Mountain views, full-service spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/bishop-39-s-lodge.html' },
      { name: 'The Inn and Spa at Loretto', note: 'Marriott Tribute Portfolio — adjacent to the Loretto Chapel downtown, outdoor pool, Luminaria restaurant, desert garden · 8.9 Booking.com' , url: 'https://www.booking.com/hotel/us/inn-of-the-loretto.html' },
    
      { name: 'Four Seasons Resort Rancho Encantado Santa Fe', note: 'Four Seasons brand — Tesuque foothills 15 min from Plaza, casitas with kiva fireplaces, outdoor pool with Sangre de Cristo views · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-resort-rancho-encantado.html' }
    ] },
    'santa-monica': { h: [
      { name: 'Hotel Shutters on the Beach', note: 'Independent luxury — directly on Santa Monica Beach, pool, 1 Pico restaurant, ocean-view rooms · 9.4 Booking.com' },
      { name: 'Casa del Mar', note: 'InterContinental brand — Craftsman-style 1926 beachfront mansion, spa, oceanfront dining · 9.2 Booking.com' },
      { name: 'Fairmont Miramar Hotel & Bungalows', note: 'Fairmont brand — Ocean Avenue clifftop, fig tree gardens, FIG Restaurant, ocean-view pool · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/fairmont-miramar-hotel-bungalows.html' },
      { name: 'Viceroy Santa Monica', note: 'Viceroy Hotels — Ocean Avenue, rooftop pool, Cameo Bar & Lounge, close to the Pier · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/viceroy-santa-monica.html' }
    ] },
    'santiago': { h: [
      { name: 'W Santiago', note: 'Marriott W brand — Las Condes financial district, rooftop WET DECK pool, city skyline views · 8.8 Booking.com' },
      { name: 'Hotel Bidasoa', note: 'Independent boutique — Vitacura residential neighborhood, 19 rooms, curated personal service · 9.2 Booking.com' },
      { name: 'The Singular Santiago, Lastarria Hotel', note: 'Independent — Barrio Lastarria, rooftop pool overlooking Santa Lucía Hill, El Singular restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/cl/the-singular-santiago-lastarria.html' },
      { name: 'Hotel Cumbres Lastarria', note: 'Independent — Lastarria bohemian quarter, rooftop terrace, contemporary Chilean design · 9.2 Booking.com', url: 'https://www.booking.com/hotel/cl/cumbres-lastarria.html' }
    ] },
    'santorini': { h: [
      { name: 'Canaves Oia Suites', note: 'Independent luxury — Oia clifftop, infinity pools, Michelin Guide-listed restaurant, sunset-facing caldera view · 9.6 Booking.com' },
      { name: 'Grace Hotel Santorini, Auberge Resorts Collection', note: 'Auberge Resorts — Imerovigli caldera cliff, adults-only, infinity pool with champagne service · 9.5 Booking.com' },
      { name: 'Katikies Santorini', note: 'Small Luxury Hotels — Oia caldera edge, three infinity pools, Zeus restaurant, adults-only · 9.5 Booking.com', url: 'https://www.booking.com/hotel/gr/katikies.html' },
      { name: 'Mystique, a Luxury Collection Hotel, Santorini', note: 'Marriott Luxury Collection — Oia volcanic cliff, Charisma pool above the caldera · 9.4 Booking.com', url: 'https://www.booking.com/hotel/gr/mystique-a-luxury-collection-hotel.html' }
    ] },
    'sarasota': { h: [
      { name: 'The Westin Sarasota', note: 'Marriott family — downtown bayfront tower, outdoor rooftop pool, marina and Sarasota Bay views · 9.0 Booking.com' },
      { name: 'Hotel Ranola', note: 'Independent boutique — downtown historic district, 10 rooms, chef-driven breakfast, walkable arts scene · 9.4 Booking.com' },
      { name: 'The Ritz-Carlton, Sarasota', note: 'Ritz-Carlton brand — downtown waterfront, The Club by Ritz-Carlton beach access, Ristorante Primo · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/the-ritz-carlton-sarasota.html' },
      { name: 'Hyatt Regency Sarasota', note: 'Hyatt brand — Sarasota Bay, marina, outdoor pool, Currents Waterfront Dining · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/hyatt-regency-sarasota.html' }
    ] },
    'sardinia': { h: [
      { name: 'Hotel Pitrizza, a Luxury Collection Resort', note: 'Marriott Luxury Collection — Costa Smeralda private rocky bay, saltwater pool, adults-only enclave · 9.3 Booking.com' },
      { name: 'Romazzino, A Belmond Hotel', note: 'Belmond brand — Costa Smeralda private beach, parasol-shaded white sand, boat excursions · 9.1 Booking.com' },
      { name: 'Forte Village Resort', note: 'Independent mega-resort — Pula, 12 pools, spa with hammam, 21 restaurants, sports facilities · 9.1 Booking.com', url: 'https://www.booking.com/hotel/it/forte-village-resort.html' },
      { name: 'Cala di Volpe, A Luxury Collection Resort, Costa Smeralda', note: 'Marriott Luxury Collection — Porto Cervo fishing village design, private beach · 9.4 Booking.com', url: 'https://www.booking.com/hotel/it/cala-di-volpe.html' }
    ] },
    'scottsdale': { h: [
      { name: 'The Phoenician, a Luxury Collection Resort', note: 'Marriott Luxury Collection — 250 acres on Camelback Mountain, three pools, spa, nine restaurants · 9.2 Booking.com' },
      { name: 'Andaz Scottsdale Resort & Bungalows', note: 'Hyatt brand — desert rock-formation setting, Weft & Warp restaurant, desert-botanical spa treatments · 9.2 Booking.com' },
      { name: 'Four Seasons Resort Scottsdale at Troon North', note: 'Four Seasons — Pinnacle Peak Desert, two pools, Talavera restaurant, Sonwai Spa · 9.4 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-resort-scottsdale.html' },
      { name: 'Sanctuary Camelback Mountain Resort & Spa', note: 'Independent — Paradise Valley hillside, infinity pool and Mountain Spa, elements restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/sanctuary-camelback-mountain.html' }
    ] },
    'seattle': { h: [
      { name: 'The Edgewater Hotel', note: 'Independent — Elliott Bay waterfront, mountain and water views, Eddie Vedder memorabilia, Six Seven restaurant · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/us/the-edgewater.html' },
      { name: 'Fairmont Olympic Hotel', note: 'Fairmont brand — 1924 Italian Renaissance downtown landmark, indoor pool, The Georgian Room · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/us/fairmont-olympic.html' },
    
      { name: 'Four Seasons Hotel Seattle', note: 'Four Seasons brand — Elliott Bay waterfront, Goldfinch Tavern, outdoor pool with bay views, spa, steps from Pike Place · 9.4 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-seattle.html' },
      { name: 'Hotel 1000', note: 'Independent boutique — downtown First Avenue, BOKA Kitchen + Bar, spa with indoor pool, virtual golf · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/hotel-1000.html' }
    ] },
    'sedona': { h: [
      { name: 'Enchantment Resort', note: 'Independent luxury — canyon-floor 70-acre resort in Boynton Canyon, mii amo destination spa, red-rock surrounds · 9.3 Booking.com' },
      { name: 'L\'Auberge de Sedona', note: 'Independent luxury — Oak Creek canyon setting, cottage suites, farm-to-table Cress restaurant · 9.2 Booking.com' },
      { name: 'Amara Resort and Spa', note: 'Independent — Uptown Sedona on Oak Creek, adults-only pool, HARVEST restaurant, red-rock views · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/amara-resort-spa.html' },
      { name: 'Mii amo, A Destination Spa Resort', note: 'Enchantment Resort spa property — Boynton Canyon, all-inclusive spa retreat, crystal garden, yoga · 9.4 Booking.com', url: 'https://www.booking.com/hotel/us/mii-amo.html' }
    ] },
    'seoul': { h: [
      { name: 'The Shilla Seoul', note: 'Independent luxury — 23 acres of gardens on Namsan Hill, indoor pool, Korean contemporary luxury, flagship spa · 9.2 Booking.com', url: 'https://www.booking.com/hotel/kr/the-shilla.html' },
      { name: 'Park Hyatt Seoul', note: 'Hyatt brand — Gangnam CBD, 24th-floor heated indoor infinity pool, Lounge on the Park panoramic bar · 9.1 Booking.com', url: 'https://www.booking.com/hotel/kr/park-hyatt-seoul.html' },
      { name: 'Four Seasons Hotel Seoul', note: 'Four Seasons brand — Jongno-gu near Gyeongbokgung, indoor and outdoor pools, Boccalino restaurant, full-service spa · 9.3 Booking.com', url: 'https://www.booking.com/hotel/kr/four-seasons-seoul.html' },
      { name: 'Josun Palace, a Luxury Collection Hotel', note: 'Marriott Luxury Collection — Gangnam district, rooftop pool and bar, Dosa restaurant, spa, Korean contemporary design · 9.2 Booking.com', url: 'https://www.booking.com/hotel/kr/josun-palace-a-luxury-collection-seoul-gangnam.html' }
    ] },
    'seville': { h: [
      { name: 'Hotel Alfonso XIII, a Luxury Collection Hotel', note: 'Marriott Luxury Collection — 1928 Mudéjar-style royal guest house, courtyard pool, heart of historic quarter · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/es/hotel-alfonso-xiii-seville.html' },
      { name: 'Casa 1800 Sevilla', note: 'Independent boutique — 33 rooms in a 19th-century mansion near the Cathedral, rooftop terrace with tower views · 9.6 Booking.com' , url: 'https://www.booking.com/hotel/es/casa-1800-sevilla.html' },
      { name: 'Gran Meliá Colón Sevilla', note: 'Meliá Red Level — Canalejas Street in the city centre, rooftop pool, El Burladero restaurant, 1929 Art Deco building · 8.9 Booking.com' , url: 'https://www.booking.com/hotel/es/gran-melia-colon.html' },
      { name: 'Hotel Mercer Sevilla', note: 'Mercer Hotels — San Lorenzo neighbourhood, restored 18th-century mansion, small outdoor pool, terrace, curated art, 12 rooms · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/es/mercer-sevilla.html' }
    ] },
    'seychelles': { h: [
      { name: 'North Island Lodge', note: 'Independent ultra-luxury — private island, 11 villas, barefoot luxury philosophy, exclusive conservation reserve · 9.7 Booking.com' },
      { name: 'Six Senses Zil Pasyon', note: 'Six Senses brand — private island Félicité, overwater spa, hilltop villas, coral reef · 9.6 Booking.com' },
      { name: 'Four Seasons Resort Seychelles', note: 'Four Seasons — Petite Anse on Mahé, 30 private-plunge-pool villas, Kannel restaurant · 9.5 Booking.com', url: 'https://www.booking.com/hotel/sc/four-seasons-seychelles.html' },
      { name: 'Maia Luxury Resort & Spa', note: 'Small Luxury Hotels — private cove on Mahé, 30 all-pool villas, butler service, sunset cliff bar · 9.5 Booking.com', url: 'https://www.booking.com/hotel/sc/maia.html' }
    ] },
    'shanghai': { h: [
      { name: 'The Peninsula Shanghai', note: 'Peninsula brand — 1929 Bund landmark, rooftop Peter Café & Bar, helicopter landing, Bund-view rooms · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/cn/the-peninsula-shanghai.html' },
      { name: 'Waldorf Astoria Shanghai on the Bund', note: 'Hilton family — 1911 Shanghai Club, Bund-facing, indoor pool, Long Bar history · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/cn/waldorf-astoria-shanghai-on-the-bund.html' },
      { name: 'Park Hyatt Shanghai', note: 'Hyatt brand — floors 79–93 of the Shanghai World Financial Center, highest pool in the world, 100 Century Avenue restaurant · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/cn/park-hyatt-shanghai.html' },
      { name: 'Capella Shanghai, Jian Ye Li', note: 'Capella brand — nine restored 1930s shikumen townhouses in Jing\'an, outdoor pool, Cassio restaurant, intimate 35-villa complex · 9.5 Booking.com' , url: 'https://www.booking.com/hotel/cn/capella-shanghai-jian-ye-li.html' }
    ] },
    'sicily': { h: [
      { name: 'San Domenico Palace, Taormina, A Four Seasons Hotel', note: 'Four Seasons brand — 14th-century Dominican monastery, cliffside garden, pool, Etna and Ionian Bay views · 9.3 Booking.com' },
      { name: 'Belmond Grand Hotel Timeo', note: 'Belmond brand — 1873 hilltop above Taormina, pool, Teatro Greco views, La Terrazza restaurant · 9.4 Booking.com' },
      { name: 'Verdura Resort', note: 'Rocco Forte Hotels — Sciacca seafront, three 18-hole golf courses, spa, three pools · 9.2 Booking.com', url: 'https://www.booking.com/hotel/it/verdura-resort.html' },
      { name: 'Palazzo Failla Hotel', note: 'Independent — 18th-century Modica baroque palace, courtyard terrace, local cuisine restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/it/palazzo-failla.html' }
    ] },
    'siena': { h: [
      { name: 'Castello di Casole, A Belmond Hotel', note: 'Belmond brand — 11th-century hilltop estate, wine tower, two pools, 4,200 acres of Tuscan countryside · 9.4 Booking.com' },
      { name: 'Relais La Suvera', note: 'Independent — 12th-century papal villa estate, vineyard, spa, antique-furnished rooms · 9.2 Booking.com' },
      { name: 'Hotel Certosa di Maggiano', note: 'Independent — 14th-century Certosa monastery 1 km from Piazza del Campo, pool in the cloister garden · 9.5 Booking.com', url: 'https://www.booking.com/hotel/it/certosa-di-maggiano.html' },
      { name: 'Grand Hotel Continental Siena', note: 'Starhotels — Via Banchi di Sopra baroque palace in the heart of Siena, frescoed ceilings · 9.1 Booking.com', url: 'https://www.booking.com/hotel/it/grand-hotel-continental.html' }
    ] },
    'singapore': { h: [
      { name: 'Capella Singapore', note: 'Capella Hotels — Sentosa Island estate, three pools, spa, two Michelin-starred restaurants, colonial architecture · 9.5 Booking.com' },
      { name: 'The Fullerton Hotel Singapore', note: 'Independent luxury — 1928 Palladian General Post Office, heritage rooms, 25-metre outdoor pool · 9.2 Booking.com' },
      { name: 'Marina Bay Sands', note: 'Sands Hotels — three-tower complex on Marina Bay, infinity rooftop pool at 57 floors, celebrity chef restaurants · 9.0 Booking.com', url: 'https://www.booking.com/hotel/sg/marina-bay-sands.html' },
      { name: 'Raffles Singapore', note: 'Accor Raffles — 1887 colonial landmark on Beach Road, butler for every suite, Long Bar Singapore Sling · 9.4 Booking.com', url: 'https://www.booking.com/hotel/sg/raffles-the-plaza.html' }
    ] },
    'sint-maarten': { h: [
      { name: 'Belmond La Samanna', note: 'Belmond brand — Baie Longue private beach, three pools, spa, French West Indies elegance · 9.4 Booking.com' },
      { name: 'Princess Heights Luxury Boutique Hotel', note: 'Independent boutique — Oyster Pond hilltop, panoramic Dutch-side ocean views, intimate retreat · 9.3 Booking.com' },
      { name: 'Sonesta Maho Beach Resort & Casino', note: 'Sonesta Hotels — Maho Beach, casino, pool, multiple bars · 8.5 Booking.com', url: 'https://www.booking.com/hotel/sx/sonesta-maho-beach-resort-casino-and-spa.html' },
      { name: 'Divi Little Bay Beach Resort', note: 'Divi Resorts — Little Bay peninsula, three pools, private beach, dive centre, Aquamarine restaurant · 8.7 Booking.com', url: 'https://www.booking.com/hotel/sx/divi-little-bay-beach-resort.html' }
    ] },
    'sintra': { h: [
      { name: 'Tivoli Palácio de Seteais', note: 'Minor Hotels — 18th-century neoclassical palace, manicured gardens, pool, mountain and valley views · 9.3 Booking.com' },
      { name: 'Penha Longa Resort', note: 'Marriott — Sintra hills estate, two golf courses, Michelin-starred LAB restaurant, spa · 9.1 Booking.com' },
      { name: 'Lawrence\'s Hotel', note: 'Independent — Rua Consiglieri Pedroso in Sintra town, oldest hotel on the Iberian Peninsula (1764), garden, restaurant · 9.0 Booking.com', url: 'https://www.booking.com/hotel/pt/lawrence-s.html' },
      { name: 'Tivoli Sintra Hotel', note: 'Tivoli Hotels — Praça da República facing the National Palace, valley and sea views, terrace · 8.8 Booking.com', url: 'https://www.booking.com/hotel/pt/tivoli-sintra.html' }
    ] },
    'sorrento': { h: [
      { name: 'Bellevue Syrene', note: 'Independent boutique — 1774 noble villa perched on Sorrento cliffs, saltwater pool cut into the rock, Bay of Naples views · 9.3 Booking.com', url: 'https://www.booking.com/hotel/it/bellevue-syrene.html' },
      { name: 'Hotel Bristol Sorrento', note: 'Small Luxury Hotels — clifftop with lift to private sea platform, rooftop pool, Vesuvius panorama · 9.2 Booking.com', url: 'https://www.booking.com/hotel/it/bristol-sorrento.html' },
      { name: 'Grand Hotel Excelsior Vittoria', note: 'Independent luxury — clifftop palazzo in Sorrento\'s main square, Bay of Naples panorama, La Serra spa, Mediterranean gardens · 9.5 Booking.com', url: 'https://www.booking.com/hotel/it/grande-albergo-excelsior-vittoria.html' },
      { name: 'Maison La Minervetta', note: 'Independent boutique — cliff-top with panoramic Bay of Naples and Vesuvius views, large terrace hot tub, breakfast with vista · 9.5 Booking.com', url: 'https://www.booking.com/hotel/it/laminervetta.html' }
    ] },
    'split': { h: [
      { name: 'Hotel Vestibul Palace', note: 'Independent boutique — 7 suites inside the Roman Diocletian\'s Palace UNESCO walls, unrivalled historic setting · 9.4 Booking.com', url: 'https://www.booking.com/hotel/hr/vestibul-palace.html' },
      { name: 'Radisson Blu Resort & Spa, Split', note: 'Radisson brand — Stobreč beach and marina, spa, infinity pool · 8.7 Booking.com', url: 'https://www.booking.com/hotel/hr/radisson-blu-resort-split.html' },
      { name: 'Cornaro Hotel', note: 'Independent boutique — Diocletian\'s Palace Old Town edge, rooftop terrace with bar and hot tub · 9.1 Booking.com', url: 'https://www.booking.com/hotel/hr/cornaro.html' },
      { name: 'AC Hotel by Marriott Split', note: 'Marriott brand — near Bačvice Beach, indoor pool and wellness centre, sea views · 9.5 Booking.com', url: 'https://www.booking.com/hotel/hr/ac-by-marriott-split.html' }
    ] },
    'stockholm': { h: [
      { name: 'Nobis Hotel Stockholm', note: 'Independent boutique — Norrmalmstorg Square, 201 rooms, spa, celebrated Gold Bar and restaurant · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/se/nobis.html' },
      { name: 'At Six', note: 'Independent boutique — Brunkebergstorg, prominent art collection, rooftop bar and pool, 343 rooms · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/se/at-six.html' },
      { name: 'Grand Hôtel Stockholm', note: 'Leading Hotels of the World — 1874 Blasieholmen waterfront, direct Royal Palace views, Mathias Dahlgren Matbaren Michelin-starred dining, Spa Mathom · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/se/grand-hotel-stockholm.html' },
      { name: 'Ett Hem', note: 'Independent — Sköldungagatan 2 in Östermalm, 12-room private house, two gardens, communal kitchen-dining, butler and chef service · 9.7 Booking.com' , url: 'https://www.booking.com/hotel/se/ett-hem.html' }
    ] },
    'strasbourg': { h: [
      { name: 'Regent Petite France & Spa', note: 'Independent — 16th-century ice-house in Petite France canal district, spa, river views · 9.3 Booking.com' },
      { name: 'Hôtel Hannong', note: 'Independent boutique — Art Deco interiors, central location, wine bar, Alsatian brasserie · 8.9 Booking.com' },
      { name: 'Hôtel Rohan Strasbourg', note: 'Independent — Place du Corbeau on the Ill River, Cathedral views, boutique 36 rooms · 9.1 Booking.com', url: 'https://www.booking.com/hotel/fr/rohan.html' },
      { name: 'Cour du Corbeau, Strasbourg', note: 'Small Luxury Hotels — 16th-century coaching inn in the historic center, courtyard, spa · 9.2 Booking.com', url: 'https://www.booking.com/hotel/fr/cour-du-corbeau.html' }
    ] },
    'stuttgart': { h: [
      { name: 'Le Méridien Stuttgart', note: 'Marriott family — central location adjacent to Staatstheater, spa and pool, modern design · 8.8 Booking.com' },
      { name: 'Steigenberger Graf Zeppelin Stuttgart', note: 'Steigenberger brand — opposite the main train station, classic grandeur, Zeppelin restaurant · 8.7 Booking.com' },
      { name: 'Kronen Hotel Stuttgart', note: 'Independent — Kronenstraße pedestrian zone, 4-star design rooms, close to Schlossplatz · 8.8 Booking.com', url: 'https://www.booking.com/hotel/de/kronengmbh.html' },
      { name: 'Marquardt Stuttgart', note: 'Independent — Bolzstraße by the Kunstmuseum, design hotel with BASA Restaurant · 9.0 Booking.com', url: 'https://www.booking.com/hotel/de/marquardt.html' }
    ] },
    'sydney': { h: [
      { name: 'Park Hyatt Sydney', note: 'Hyatt brand — Lavender Bay, Opera House and Harbour Bridge views from 155 rooms, rooftop pool · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/au/park-hyatt-sydney.html' },
      { name: 'Capella Sydney', note: 'Capella Hotels — restored 1950s–60s heritage ensemble, spa, David Laris-conceived dining · 9.5 Booking.com' , url: 'https://www.booking.com/hotel/au/capella-sydney.html' },
      { name: 'Four Seasons Hotel Sydney', note: 'Four Seasons brand — George Street in the CBD, outdoor pool with harbour views, MODE kitchen & bar, full-service spa · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/au/four-seasons-sydney.html' },
      { name: 'Shangri-La Sydney', note: 'Shangri-La brand — Millers Point with Bridge and Opera House views, outdoor infinity pool, CHI Spa, The Rocks district · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/au/shangri-la-sydney.html' }
    ] },
    'sao-luis': { h: [
      { name: 'Pousada Portas da Amazônia', note: 'Independent boutique — renovated colonial mansion in Reviver historic district, São Luís UNESCO architecture · 9.0 Booking.com' },
      { name: 'Grand São Luís Hotel', note: 'Independent — city center, rooftop pool, classic architecture, convenient for historic center access · 8.3 Booking.com' },
      { name: 'Grand São Luís Hotel', note: 'Independent — Praia Grande historic center, pool, colonial architecture landmark · 8.5 Booking.com' },
      { name: 'Hotel Brisamar São Luís', note: 'Independent — Calhau Beach, beachfront, outdoor pool, views of São Marcos Bay · 8.4 Booking.com' }
    ] },
    'sao-paulo': { h: [
      { name: 'Rosewood São Paulo', note: 'Rosewood brand — Cidade Matarazzo complex, pool, Evvai Michelin-starred dining, design landmark · 9.2 Booking.com' },
      { name: 'L\'Hôtel Porto Bay São Paulo', note: 'Porto Bay brand — Jardins neighborhood, pool, Il Gattopardo Italian restaurant, boutique luxury · 9.0 Booking.com' },
      { name: 'Fasano São Paulo', note: 'Fasano brand — Jardins, Fasano Grill Michelin-starred restaurant, rooftop pool · 9.2 Booking.com', url: 'https://www.booking.com/hotel/br/fasano-sao-paulo.html' },
      { name: 'Tivoli Mofarrej São Paulo', note: 'Tivoli Hotels — Jardim Paulista, Seen Restaurant & Rooftop bar, spa with pool · 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/tivoli-mofarrej-sao-paulo.html' }
    ] },
    'taipei': { h: [
      { name: 'Mandarin Oriental, Taipei', note: 'Mandarin Oriental brand — Zhongshan District, outdoor pool, Michelin-starred Ya Ge Cantonese restaurant · 9.3 Booking.com' },
      { name: 'W Taipei', note: 'Marriott W brand — Xinyi Anhe area, WET rooftop pool, PURPLE cocktail lounge · 8.9 Booking.com' },
      { name: 'The Regent Taipei', note: 'IHG Regent brand — Zhongshan District, Crystal Jade restaurant, indoor pool · 8.9 Booking.com', url: 'https://www.booking.com/hotel/tw/regent-taipei.html' },
      { name: 'Palais de Chine Hotel', note: 'Independent — near Taipei Main Station, Art Deco design, Le Palais Cantonese restaurant · 9.2 Booking.com', url: 'https://www.booking.com/hotel/tw/palais-de-chine.html' }
    ] },
    'tallinn': { h: [
      { name: 'Hotel Telegraaf, Autograph Collection', note: 'Marriott Autograph Collection — 1919 restored telegram palace in Old Town, spa, historic vaulted interiors · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/ee/telegraaf.html' },
      { name: 'Schlössle Hotel', note: 'Small Luxury Hotels — 15th-century merchant house in medieval Old Town, oak-panelled rooms, intimate · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/ee/schlossle.html' },
    
      { name: 'The Three Sisters Hotel', note: 'Independent boutique — Old Town UNESCO site, three 15th-century merchant houses, Bordoo restaurant, antique furnishings · 9.4 Booking.com', url: 'https://www.booking.com/hotel/ee/the-three-sisters.html' },
      { name: 'Hotel Viru', note: 'Independent — Viru Square, Old Town landmark from 1972, rooftop sauna, Viru bar lounge, KGB Museum on the 23rd floor · 8.5 Booking.com', url: 'https://www.booking.com/hotel/ee/viru.html' }
    ] },
    'tbilisi': { h: [
      { name: 'Stamba Hotel', note: 'Independent — 1930s Soviet-era publishing house, 8-metre loft ceilings, courtyard pool, garden · 9.4 Booking.com' },
      { name: 'Rooms Hotel Tbilisi', note: 'Independent — contemporary design in Vera neighborhood, rooftop bar, Rioni Restaurant · 9.2 Booking.com' },
      { name: 'Biltmore Hotel Tbilisi', note: 'Marriott Autograph Collection — Rustaveli Avenue, outdoor pool, Salve restaurant, spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/ge/biltmore-hotel-tbilisi.html' },
      { name: 'Radisson Blu Iveria Hotel Tbilisi', note: 'Radisson Blu — Rose Revolution Square, outdoor pool, Shavi Lomi restaurant, spa · 8.8 Booking.com', url: 'https://www.booking.com/hotel/ge/radisson-sas-iveria-tbilisi.html' }
    ] },
    'tenerife': { h: [
      { name: 'Royal Garden Villas & Spa', note: 'Independent ultra-luxury — 36 private villas near Adeje, adults-only, each with private pool · 9.6 Booking.com' },
      { name: 'Gran Hotel Bahía del Duque Resort', note: 'Independent luxury — Adeje beach resort, multiple pools, historic Canarian architecture, golf nearby · 9.1 Booking.com' },
      { name: 'Abama Resort Tenerife', note: 'Abama — clifftop west coast, two Michelin-star MB restaurant, golf, private beach · 9.2 Booking.com', url: 'https://www.booking.com/hotel/es/abama-resort.html' },
      { name: 'Iberostar Grand Hotel El Mirador', note: 'Iberostar Grand — adults-only Costa Adeje cliffside, infinity pool, Michelin-guide dining · 9.3 Booking.com', url: 'https://www.booking.com/hotel/es/iberostar-grand-hotel-el-mirador.html' }
    ] },
    'tokyo': { h: [
      { name: 'Aman Tokyo', note: 'Aman brand — Otemachi forest tower, 33rd–35th floor rooms with Imperial Palace views, spa with indoor pool · 9.5 Booking.com' , url: 'https://www.booking.com/hotel/jp/aman-tokyo.html' },
      { name: 'The Okura Tokyo', note: 'Independent luxury — 1962 mid-century Japanese modernism, restored heritage wing, Orchid Bar, spa · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/jp/the-okura-tokyo.html' },
      { name: 'The Peninsula Tokyo', note: 'Peninsula brand — Hibiya and Marunouchi, Peter restaurant on the 24th floor, Hei Fung Terrace dim sum, spa with indoor pool · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/jp/the-peninsula-tokyo.html' },
      { name: 'Park Hyatt Tokyo', note: 'Hyatt brand — Shinjuku floors 41–52 of the Tokyo Park Tower, 14th-floor pool, New York Bar and Grill, full-service spa · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/jp/park-hyatt-tokyo.html' }
    ] },
    'toledo': { h: [
      { name: 'Parador de Toledo', note: 'Paradores — hilltop across the Tagus with the famous El Greco panorama, pool, medieval setting · 9.1 Booking.com' },
      { name: 'Hotel Cigarral El Bosque', note: 'Independent boutique — hilltop olive grove estate with Toledo cityscape panorama, pool, gardens · 9.2 Booking.com' },
      { name: 'Eurostars Palacio Buenavista', note: 'Eurostars Hotels — historic Buenavista Palace in the old city, pool, spa, city panoramas · 9.1 Booking.com', url: 'https://www.booking.com/hotel/es/eurostars-palacio-buenavista.html' },
      { name: 'AC Hotel Ciudad de Toledo by Marriott', note: 'Marriott AC Hotels — rooftop pool, panoramic Toledo views, spa · 8.7 Booking.com', url: 'https://www.booking.com/hotel/es/ac-ciudad-de-toledo.html' }
    ] },
    'toronto': { h: [
      { name: 'The Hazelton Hotel', note: 'Independent luxury — Yorkville, private cinema, ONE Restaurant by Mark McEwan, spa · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/ca/the-hazelton.html' },
      { name: 'Four Seasons Hotel Toronto', note: 'Four Seasons brand — Yorkville, outdoor pool, Café Boulud, spa, gallery-level art collection · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/ca/four-seasons-hotel-toronto.html' },
      { name: 'Shangri-La Hotel Toronto', note: 'Shangri-La brand — University Avenue, indoor pool, CHI Spa, Bosk restaurant, close to the Financial District and Eaton Centre · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/ca/shangri-la-toronto.html' },
      { name: 'Fairmont Royal York', note: 'Fairmont brand — 1929 Front Street landmark opposite Union Station, indoor pool, spa, Library Bar, city-centre heritage · 8.6 Booking.com' , url: 'https://www.booking.com/hotel/ca/fairmont-royal-york.html' }
    ] },
    'tromso': { h: [
      { name: 'Scandic Ishavshotel', note: 'Scandic brand — Arctic Ocean waterfront, panoramic views of the fjord and Tromsø Cathedral · 8.8 Booking.com' },
      { name: 'Clarion Hotel The Edge', note: 'Nordic Choice Hotels — waterfront, restaurants and bar overlooking the harbor and mountains · 8.7 Booking.com' },
      { name: 'Thon Hotel Tromsø', note: 'Thon Hotels — city centre, harbor views, rooftop Tromsø Bar with panorama · 8.7 Booking.com', url: 'https://www.booking.com/hotel/no/thon-hotel-tromso.html' },
      { name: 'Radisson Blu Hotel, Tromsø', note: 'Radisson Blu — Sentrum waterfront with fjord views, Nordic Grill, spa with sauna · 8.6 Booking.com', url: 'https://www.booking.com/hotel/no/radisson-sas-tromso.html' }
    ] },
    'turin': { h: [
      { name: 'Golden Palace Hotel', note: 'Independent — Via dell\'Arcivescovado, jazz bar, spa, walkable to Porta Palazzo market · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/it/golden-palace-torino.html' },
      { name: 'Starhotels Majestic Torino', note: 'Starhotels — Corso Vittorio Emanuele II, classic grandeur, restaurant, central Turin location · 8.9 Booking.com' , url: 'https://www.booking.com/hotel/it/starhotels-majestic.html' },
      { name: 'NH Collection Piazza Carlina', note: 'NH Collection — elegant Piazza Carlina address in the Quadrilatero Romano, 66 rooms, central historic quarter · 8.8 Booking.com' , url: 'https://www.booking.com/hotel/it/nh-collection-torino-piazza-carlina.html' },
      { name: 'Le Méridien Turin Art + Tech', note: 'Marriott Le Méridien — Lingotto complex (converted FIAT factory), rooftop test track views, indoor pool, spa, design-forward interiors · 8.5 Booking.com' , url: 'https://www.booking.com/hotel/it/le-meridien-art-tech.html' }
    ] },
    'turks-and-caicos': { h: [
      { name: 'Amanyara', note: 'Aman brand — Grace Bay, 40 pavilions and villas, coral reef snorkeling, beachfront spa · 9.6 Booking.com' },
      { name: 'Parrot Cay by COMO', note: 'COMO Hotels — private island, COMO Shambhala Retreat spa, white-sand beaches · 9.5 Booking.com' },
      { name: 'Grace Bay Club', note: 'Independent — Grace Bay beachfront on Providenciales, three properties, pool, Infiniti Bar & Grill · 9.6 Booking.com', url: 'https://www.booking.com/hotel/tc/grace-bay-club.html' },
      { name: 'COMO Parrot Cay', note: 'COMO brand — private island 30 min by boat, COMO Shambhala spa, pool villas, dive centre · 9.5 Booking.com', url: 'https://www.booking.com/hotel/tc/como-parrot-cay.html' }
    ] },
    'valletta': { h: [
      { name: 'The Phoenicia Malta', note: 'Small Luxury Hotels — 1947 landmark at city gate, outdoor pool in formal gardens, Malta\'s most storied hotel · 9.1 Booking.com', url: 'https://www.booking.com/hotel/mt/the-phoenicia-malta.html' },
      { name: 'Ursulino Malta', note: 'Independent boutique — within the historic city walls, curated rooms, intimate boutique atmosphere · 9.3 Booking.com', url: 'https://www.booking.com/hotel/mt/ursulino-valletta.html' },
      { name: 'Rosselli AX Privilege', note: 'AX Hotels — 17th-century Baroque palazzo in old Valletta, Michelin-starred Under Grain restaurant, personal butler service · 9.3 Booking.com', url: 'https://www.booking.com/hotel/mt/rosselli-valletta.html' },
      { name: 'Grand Hotel Excelsior', note: 'Preferred Hotels & Resorts — outside Valletta city gate, views of Marsamxett Harbour, outdoor pool, full-service spa · 8.8 Booking.com', url: 'https://www.booking.com/hotel/mt/excelsior-grand-malta.html' }
    ] },
    'vancouver': { h: [
      { name: 'Fairmont Hotel Vancouver', note: 'Fairmont brand — 1939 "Castle in the City," spa, Notch8 Restaurant & Bar, iconic copper roof · 8.9 Booking.com' },
      { name: 'Rosewood Hotel Georgia', note: 'Rosewood brand — 1927 Georgian Revival downtown landmark, outdoor pool, Hawksworth Restaurant · 9.3 Booking.com' },
      { name: 'Wedgewood Hotel & Spa', note: 'Independent — Robson Square, intimate boutique, spa, Bacchus restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ca/wedgewood.html' },
      { name: 'Four Seasons Hotel Vancouver', note: 'Four Seasons — Georgia Street connected to Pacific Centre, outdoor heated pool, Yew seafood + bar · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ca/four-seasons-vancouver.html' }
    ] },
    'venice': { h: [
      { name: 'Belmond Hotel Cipriani', note: 'Belmond brand — Giudecca island, 7-minute private launch, Olympic-size pool, award-winning Oro Restaurant · 9.5 Booking.com', url: 'https://www.booking.com/hotel/it/cipriani-venezia.html' },
      { name: 'Aman Venice', note: 'Aman brand — 16th-century Palazzo Papadopoli on the Grand Canal, two private gardens, private dock · 9.7 Booking.com' },
      { name: 'The Gritti Palace, a Luxury Collection Resort', note: 'Marriott Luxury Collection — 1475 Doge\'s palace on the Grand Canal, Club del Doge restaurant · 9.5 Booking.com', url: 'https://www.booking.com/hotel/it/the-gritti-palace.html' },
      { name: 'Hotel Danieli, a Luxury Collection Hotel', note: 'Marriott Luxury Collection — 1350 Gothic palace near the Doge\'s Palace, rooftop Terrazza Danieli · 9.3 Booking.com', url: 'https://www.booking.com/hotel/it/danielivenezia.html' }
    ] },
    'verona': { h: [
      { name: 'Due Torri Hotel', note: 'Autograph Collection (Marriott) — 14th-century palazzo near Piazza Brà, antique-furnished rooms, Arena Opera views · 9.1 Booking.com' },
      { name: 'Hotel Gabbia d\'Oro', note: 'Independent boutique — 17th-century noble palazzo near Piazza delle Erbe, antique beds, garden courtyard · 9.3 Booking.com' },
      { name: 'NH Collection Verona Grand Hotel Palazzo di Verona', note: 'NH Collection brand — 18th-century Palazzo on Piazza San Zeno, rooftop terrace, central location · 9.0 Booking.com', url: 'https://www.booking.com/hotel/it/nh-verona-due-torri.html' },
      { name: 'Hotel Accademia', note: 'Independent — Via Scala near the Arena, garden courtyard, Il Carroarmato restaurant · 8.7 Booking.com', url: 'https://www.booking.com/hotel/it/accademia-verona.html' }
    ] },
    'victoria': { h: [
      { name: 'The Fairmont Empress', note: 'Fairmont brand — 1908 Inner Harbour landmark, spa, Bengal Lounge, afternoon tea tradition · 9.0 Booking.com' },
      { name: 'Inn at Laurel Point', note: 'Independent boutique — waterfront on the Inner Harbour, adults-preferred, Japanese meditation garden · 9.2 Booking.com' },
      { name: 'Magnolia Hotel & Spa', note: 'Independent — Courtney Street heritage district, rooftop hot tub, Opus Restaurant, full spa · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ca/magnolia.html' },
      { name: 'Hotel Grand Pacific Victoria', note: 'Independent — Inner Harbour, indoor pool, harbour views, Active Club fitness centre · 8.9 Booking.com', url: 'https://www.booking.com/hotel/ca/hotel-grand-pacific.html' }
    ] },
    'vienna': { h: [
      { name: 'Hotel Imperial, a Luxury Collection Hotel, Vienna', note: 'Marriott Luxury Collection — 1863 Crown Prince Rudolf\'s palace on Ringstrasse, Café Imperial tradition · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/at/imperial.html' },
      { name: 'Park Hyatt Vienna', note: 'Hyatt brand — 1913 Austro-Hungarian bank vault converted to spa and indoor pool, Das Loft restaurant · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/at/park-hyatt-vienna.html' },
      { name: 'Hotel Sacher Wien', note: 'Independent — Philharmonikerstraße beside the Opera, iconic Sacher Torte heritage, Rote Bar and Anna Sacher restaurants, spa · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/at/sacher.html' },
      { name: 'Palais Coburg Residenz', note: 'Independent — 1845 Coburg Palace in the First District, suites only (35), wine cellar with 60,000 bottles, pool and spa · 9.5 Booking.com' , url: 'https://www.booking.com/hotel/at/palais-coburg-residenz.html' }
    ] },
    'virgin-islands': { h: [
      { name: 'Sugar Bay Resort & Spa', note: 'IHG brand — Sugar Bay Beach, hillside pools and water slides, full-service spa, St. Thomas East End · 8.6 Booking.com' },
      { name: 'Point Pleasant Resort', note: 'Independent boutique — Estate Smith Bay hilltop, studio apartments and suites with bay views, snorkel beach · 9.0 Booking.com' },
      { name: 'Frenchman\'s Reef, a DoubleTree by Hilton Resort', note: 'Hilton DoubleTree — St. Thomas, panoramic St. Thomas Bay views, three pools, three beaches · 8.6 Booking.com' },
      { name: 'Caneel Bay, A Rosewood Resort', note: 'Rosewood brand — St. John National Park, seven beaches, adults-only pool, tropical garden · 9.4 Booking.com' }
    ] },
    'washington-dc': { h: [
      { name: 'Rosewood Washington D.C.', note: 'Rosewood brand — Georgetown neighborhood, outdoor pool, acclaimed Wyld restaurant, townhouse suites · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/us/rosewood-washington-dc.html' },
      { name: 'Four Seasons Hotel Washington DC', note: 'Four Seasons brand — Georgetown, outdoor pool, M Restaurant, spa, Embassy Row adjacent · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/us/four-seasons-hotel-washington-dc.html' },
      { name: 'The Hay-Adams', note: 'Independent — 16th Street NW with direct White House views, Off the Record bar, Lafayette dining, intimate historic character · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/us/hay-adams.html' },
      { name: 'Waldorf Astoria Washington DC', note: 'Hilton brand — converted Old Post Office Building on Pennsylvania Avenue NW, indoor pool, Peacock Alley, central DC landmark · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/us/waldorf-astoria-washington-dc.html' }
    ] },
    'wellington': { h: [
      { name: 'QT Wellington', note: 'QT Hotels — design hotel on The Terrace, Hippopotamus Restaurant, vibrant social public spaces · 8.9 Booking.com' },
      { name: 'InterContinental Wellington', note: 'IHG brand — Lambton Quay, harbour views, spa, central to Te Papa and waterfront · 8.7 Booking.com' },
      { name: 'Sofitel Wellington', note: 'Sofitel brand — Bolton Street, outdoor terrace pool, So SPA, Grill on the 11th floor · 9.1 Booking.com', url: 'https://www.booking.com/hotel/nz/sofitel-wellington.html' },
      { name: 'Museum Art Hotel Wellington', note: 'Independent — Cable Street on the Te Papa waterfront, curated art, Palmer Restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/nz/museum-art-hotel.html' }
    ] },
    'whistler': { h: [
      { name: 'Four Seasons Resort and Residences Whistler', note: 'Four Seasons brand — ski-in/ski-out base of Blackcomb, outdoor heated pool, spa · 9.3 Booking.com' },
      { name: 'Nita Lake Lodge', note: 'Independent boutique — Nita Lake waterfront, cross-country trail access, spa, quiet Creekside enclave · 9.4 Booking.com' },
      { name: 'Fairmont Chateau Whistler', note: 'Fairmont brand — ski-in/ski-out at Blackcomb, heated outdoor pool, Mallard Lounge, spa · 9.1 Booking.com', url: 'https://www.booking.com/hotel/ca/fairmont-chateau-whistler.html' },
      { name: 'Westin Resort & Spa Whistler', note: 'Marriott Westin — Whistler Village, outdoor heated pool, Aubergine Grille, Heavenly Spa · 9.1 Booking.com', url: 'https://www.booking.com/hotel/ca/westin-resort-and-spa-whistler.html' }
    ] },
    'yellowstone': { h: [
      { name: 'Old Faithful Inn', note: 'Independent — 1904 historic log lodge beside Old Faithful geyser, National Historic Landmark · 9.0 Booking.com' },
      { name: 'Lake Yellowstone Hotel', note: 'Independent — 1891 lakefront colonial structure, panoramic Yellowstone Lake views, inside the park · 8.8 Booking.com' },
      { name: 'Canyon Lodge & Cabins', note: 'Independent — largest lodging complex inside Yellowstone, central location near Grand Canyon of the Yellowstone, cabin and motel room options · 8.2 Booking.com' },
      { name: 'Roosevelt Lodge Cabins', note: 'Independent — rustic frontier cabins in the northeast quadrant near Lamar Valley, Old West cookouts, closest lodge to Tower Fall · 8.5 Expedia' }
    ] },
    'zakynthos': { h: [
      { name: 'Porto Zante Villas & Spa', note: 'Independent ultra-luxury — private white-sand beach, 8 beachfront villas, spa, Laganas Bay turtle sanctuary views · 9.7 Booking.com' },
      { name: 'Lesante Blu Exclusive Beach Resort', note: 'Independent boutique — adults-only on Tsilivi Bay, infinity pool, spa, Ionian Sea views · 9.4 Booking.com' },
      { name: 'Ionian Blue Bungalows & Spa Resort', note: 'Independent — Alykes beachfront, seafront pool, spa, Ionian Grill · 9.0 Booking.com', url: 'https://www.booking.com/hotel/gr/ionian-blue-bungalows-spa-resort.html' },
      { name: 'Lesante Blu Exclusive Beach Resort', note: 'Small Luxury Hotels — Tragaki beachfront adults-only, heated infinity pool, Blu Restaurant · 9.4 Booking.com', url: 'https://www.booking.com/hotel/gr/lesante-cape.html' }
    ] },
    'zhangjiajie': { h: [
      { name: 'Pullman Zhangjiajie', note: 'Accor Pullman brand — modern full-service hotel in Zhangjiajie city, pool, 30 minutes from Wulingyuan park gate · 8.8 Booking.com' },
      { name: 'Wyndham Zhangjiajie', note: 'Wyndham brand — city center near the national park, outdoor pool, international restaurant · 8.3 Booking.com', url: 'https://www.booking.com/hotel/cn/wyndham-zhangjiajie.html' },
      { name: 'InterContinental Zhangjiajie', note: 'IHG brand — city center, outdoor pool, all-day dining, views of Tianmen Mountain · 8.8 Booking.com', url: 'https://www.booking.com/hotel/cn/intercontinental-zhangjiajie.html' },
      { name: 'Avic Hotel Zhangjiajie', note: 'Independent — close to the National Forest Park, mountain views, full-service restaurant · 8.5 Booking.com' }
    ] },
    'zurich': { h: [
      { name: 'The Dolder Grand', note: 'Independent luxury — 1899 hillside monument, two-Michelin-star The Restaurant, 4,000 sq m spa, ice rink · 9.4 Booking.com', url: 'https://www.booking.com/hotel/ch/the-dolder-grand.html' },
      { name: 'Baur au Lac', note: 'Independent luxury — 1844 lakefront hotel, private garden terrace, Pavillon and Rive Gauche restaurants · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ch/baur-au-lac.html' },
      { name: 'Park Hyatt Zurich', note: 'Hyatt brand — Zurich West, outdoor pool, Parkhuus restaurant, spa, contemporary design, steps from Hauptbahnhof · 9.2 Booking.com', url: 'https://www.booking.com/hotel/ch/park-hyatt-zurich.html' },
      { name: 'Mandarin Oriental Savoy, Zurich', note: 'Mandarin Oriental brand — historic Savoy building on Paradeplatz, Fraumünster and Bahnhofstrasse 2 min walk, garden terrace, restaurant · 8.7 Booking.com', url: 'https://www.booking.com/hotel/ch/mandarin-oriental-savoy-zurich.html' }
    ] }
  };

  /* ── Neighborhood cross-link — appended under the Alternative Hotel
     Recommendations grid on the guides Neighborhoods.html covers.
     That page carries district-by-district "where to stay" detail for a small
     set of cities; those are exactly the guides where the hotel block should
     hand the reader on to it. Key = guide filename slug; value = the city name
     as written in the page's own AN_CITIES array — it becomes the #hash the
     page reads on load to open pre-filtered on that city.
     The two lists are kept in lockstep by brain_check
     check_accommodation_neighborhoods_crosslink (hard-fail on either side
     drifting). Owner rule 2026-08-08. */
  var AN_NEIGHBORHOOD_CITIES = {
    'amsterdam':      'Amsterdam',
    'athens':         'Athens',
    'bangkok':        'Bangkok',
    'barcelona':      'Barcelona',
    'beijing':        'Beijing',
    'bergen':         'Bergen',
    'berlin':         'Berlin',
    'bilbao':         'Bilbao',
    'bologna':        'Bologna',
    'bordeaux':       'Bordeaux',
    'boston':         'Boston',
    'brussels':       'Brussels',
    'budapest':       'Budapest',
    'buenos-aires':   'Buenos Aires',
    'cairo':          'Cairo',
    'cape-town':      'Cape Town',
    'chicago':        'Chicago',
    'cologne':        'Cologne',
    'copenhagen':     'Copenhagen',
    'dubai':          'Dubai',
    'dublin':         'Dublin',
    'dubrovnik':      'Dubrovnik',
    'edinburgh':      'Edinburgh',
    'florence':       'Florence',
    'frankfurt':      'Frankfurt',
    'geneva':         'Geneva',
    'glasgow':        'Glasgow',
    'gothenburg':     'Gothenburg',
    'granada':        'Granada',
    'hamburg':        'Hamburg',
    'hanoi':          'Hanoi',
    'helsinki':       'Helsinki',
    'hong-kong':      'Hong Kong',
    'istanbul':       'Istanbul',
    'krakow':         'Kraków',
    'kyoto':          'Kyoto',
    'lille':          'Lille',
    'lima':           'Lima',
    'lisbon':         'Lisbon',
    'ljubljana':      'Ljubljana',
    'london':         'London',
    'los-angeles':    'Los Angeles',
    'luxembourg':     'Luxembourg',
    'lyon':           'Lyon',
    'madrid':         'Madrid',
    'malaga':         'Málaga',
    'marrakech':      'Marrakech',
    'marseille':      'Marseille',
    'melbourne':      'Melbourne',
    'miami':          'Miami',
    'milan':          'Milan',
    'montreal':       'Montreal',
    'munich':         'Munich',
    'naples':         'Naples',
    'new-orleans':    'New Orleans',
    'new-york':       'New York',
    'nice':           'Nice',
    'osaka':          'Osaka',
    'oslo':           'Oslo',
    'paris':          'Paris',
    'porto':          'Porto',
    'prague':         'Prague',
    'reykjavik':      'Reykjavik',
    'rio-de-janeiro': 'Rio de Janeiro',
    'rome':           'Rome',
    'rotterdam':      'Rotterdam',
    'salzburg':       'Salzburg',
    'san-francisco':  'San Francisco',
    'santiago':       'Santiago',
    'sao-paulo':      'São Paulo',
    'seattle':        'Seattle',
    'seoul':          'Seoul',
    'seville':        'Seville',
    'shanghai':       'Shanghai',
    'singapore':      'Singapore',
    'split':          'Split',
    'stockholm':      'Stockholm',
    'strasbourg':     'Strasbourg',
    'stuttgart':      'Stuttgart',
    'sydney':         'Sydney',
    'taipei':         'Taipei',
    'tallinn':        'Tallinn',
    'tbilisi':        'Tbilisi',
    'tokyo':          'Tokyo',
    'toronto':        'Toronto',
    'turin':          'Turin',
    'valletta':       'Valletta',
    'vancouver':      'Vancouver',
    'venice':         'Venice',
    'verona':         'Verona',
    'vienna':         'Vienna',
    'washington-dc':  'Washington DC',
    'zurich':         'Zurich'
  };

  function _injectHotelAlternatives() {
    if (!isRealGuide) return;
    var also = document.getElementById('also-on-this-site');
    if (!also) return;
    var pageName = location.pathname.split('/').pop() || '';
    var slugMatch = pageName.match(/^(.+?)(?:_v\d+)?\.html$/);
    if (!slugMatch) return;
    var slug = slugMatch[1];
    var entry = HOTEL_ALT_DATA[slug];
    if (!entry || !entry.h || !entry.h.length) return;
    var wrap = document.createElement('div');
    wrap.id = 'hotel-alternatives';
    var h = document.createElement('div');
    h.className = 'extras-title';
    h.textContent = '🏨 Alternative Hotel Recommendations';
    var grid = document.createElement('div');
    grid.className = 'neigh-grid';
    entry.h.forEach(function (hotel) {
      var card = document.createElement('div');
      card.className = 'neigh-card';
      var nameEl;
      if (hotel.url) {
        nameEl = document.createElement('a');
        nameEl.href = hotel.url;
        nameEl.target = '_blank';
        nameEl.rel = 'noopener noreferrer';
        nameEl.className = 'neigh-name ext-arrow';
      } else {
        nameEl = document.createElement('div');
        nameEl.className = 'neigh-name';
      }
      nameEl.textContent = hotel.name;
      var note = document.createElement('div');
      note.className = 'neigh-why';
      note.textContent = hotel.note;
      card.appendChild(nameEl);
      card.appendChild(note);
      grid.appendChild(card);
    });
    wrap.appendChild(h);
    wrap.appendChild(grid);
    var anCity = AN_NEIGHBORHOOD_CITIES[slug];
    if (anCity) {
      var anPills = document.createElement('div');
      anPills.className = 'also-on-this-site-pills neigh-more';
      var anLink = document.createElement('a');
      anLink.className = 'also-on-this-site-pill';
      anLink.href = base + 'Trip-Essentials/Neighborhoods.html#' + encodeURIComponent(anCity);
      anLink.textContent = '🏘 Which neighborhood to stay in';
      anPills.appendChild(anLink);
      wrap.appendChild(anPills);
    }
    wrap.addEventListener('click', function (e) { e.stopPropagation(); });
    also.parentNode.insertBefore(wrap, also);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectHotelAlternatives);
  } else {
    _injectHotelAlternatives();
  }

  /* ── Best-Of cross-links — injected before #also-on-this-site on guide pages
     that appear in one or more Best-Of collections. CITY_BEST_OF_MAP is generated
     by Brain/scripts/build/build_best_of_map.py — re-run after adding a new Best-Of
     page or a new guide link inside an existing Best-Of page.
     Data is embedded directly (no XHR). Keys: city folder name, lowercased. */
  var CITY_BEST_OF_MAP = {
    'abu-dhabi': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Observation Decks", "Best-Observation-Decks.html"]],
    'aix-en-provence': [["Wine Regions", "Best-Wine-Regions.html"]],
    'alaska': [["Caves", "Best-Caves.html"], ["Hot Springs", "Best-Hot-Springs.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["National Parks", "Best-National-Parks-by-Country.html"]],
    'alesund': [["Aquariums", "Best-Aquariums.html"], ["Resorts", "Best-Resorts.html"]],
    'amalfi': [["Gardens", "Best-Gardens.html"], ["Resorts", "Best-Resorts.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'amsterdam': [["Art Museums", "Best-Art-Museums.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'annecy': [["Lakes", "Best-Lakes.html"]],
    'aracaju': [["Aquariums", "Best-Aquariums.html"]],
    'arenal': [["Hot Springs", "Best-Hot-Springs.html"], ["National Parks", "Best-National-Parks-by-Country.html"], ["Ultra Luxurious Resorts", "Best-Ultra-Luxurious-Resorts.html"], ["Volcanoes", "Best-Volcanoes.html"]],
    'aruba': [["Beaches", "Best-Beaches.html"], ["Islands", "Best-Islands.html"]],
    'athens': [["Architecture", "Best-Architecture.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Museums", "Best-Museums.html"], ["Resorts", "Best-Resorts.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'atlanta': [["Aquariums", "Best-Aquariums.html"]],
    'austin': [["Animal Encounters", "Best-Animal-Encounters.html"]],
    'azores': [["Islands", "Best-Islands.html"], ["Scuba Diving", "Best-Scuba-Diving.html"]],
    'bahamas': [["Beaches", "Best-Beaches.html"], ["Islands", "Best-Islands.html"], ["Resorts", "Best-Resorts.html"], ["Scuba Diving", "Best-Scuba-Diving.html"]],
    'bali': [["Architecture", "Best-Architecture.html"], ["Beaches", "Best-Beaches.html"], ["Hot Springs", "Best-Hot-Springs.html"], ["Islands", "Best-Islands.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Resorts", "Best-Resorts.html"], ["Ultra Luxurious Resorts", "Best-Ultra-Luxurious-Resorts.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'banff': [["Hot Springs", "Best-Hot-Springs.html"], ["Lakes", "Best-Lakes.html"], ["National Parks", "Best-National-Parks-by-Country.html"], ["Ski Resorts", "Best-Ski-Resorts.html"]],
    'bangkok': [["Aquariums", "Best-Aquariums.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Resorts", "Best-Resorts.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'barbados': [["Beaches", "Best-Beaches.html"], ["Caves", "Best-Caves.html"], ["Islands", "Best-Islands.html"], ["Resorts", "Best-Resorts.html"]],
    'barcelona': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Aquariums", "Best-Aquariums.html"], ["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'beijing': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Castles", "Best-Castles.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Museums", "Best-Museums.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'bend': [["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"]],
    'bergen': [["Kids' Museums", "Best-Kids-Museums.html"]],
    'berlin': [["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Gardens", "Best-Gardens.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'bhutan': [["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Ultra Luxurious Resorts", "Best-Ultra-Luxurious-Resorts.html"]],
    'big-island': [["Beaches", "Best-Beaches.html"], ["Islands", "Best-Islands.html"], ["Resorts", "Best-Resorts.html"], ["Volcanoes", "Best-Volcanoes.html"]],
    'bilbao': [["Architecture", "Best-Architecture.html"]],
    'bologna': [["Unique Museums", "Best-Unique-Museums.html"]],
    'bora-bora': [["Islands", "Best-Islands.html"], ["Resorts", "Best-Resorts.html"]],
    'bordeaux': [["Wine Regions", "Best-Wine-Regions.html"]],
    'boston': [["Aquariums", "Best-Aquariums.html"], ["Art Museums", "Best-Art-Museums.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'boulder': [["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"]],
    'bruges': [["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'brussels': [["Cathedrals", "Best-Cathedrals.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'budapest': [["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Hot Springs", "Best-Hot-Springs.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'buenos-aires': [["Art Museums", "Best-Art-Museums.html"], ["Lakes", "Best-Lakes.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'busan': [["Hot Springs", "Best-Hot-Springs.html"]],
    'cairo': [["Architecture", "Best-Architecture.html"], ["Castles", "Best-Castles.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Museums", "Best-Museums.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'cambridge': [["Architecture", "Best-Architecture.html"]],
    'cancun': [["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"]],
    'cannes': [["Resorts", "Best-Resorts.html"]],
    'cape-cod': [["Beaches", "Best-Beaches.html"]],
    'cape-town': [["Aquariums", "Best-Aquariums.html"], ["Beaches", "Best-Beaches.html"], ["Gardens", "Best-Gardens.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["National Parks", "Best-National-Parks-by-Country.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Resorts", "Best-Resorts.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wine Regions", "Best-Wine-Regions.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'capri': [["Caves", "Best-Caves.html"], ["Islands", "Best-Islands.html"]],
    'carmel-by-the-sea': [["Resorts", "Best-Resorts.html"]],
    'cascais': [["Beaches", "Best-Beaches.html"]],
    'cayman-islands': [["Beaches", "Best-Beaches.html"], ["Islands", "Best-Islands.html"], ["Scuba Diving", "Best-Scuba-Diving.html"]],
    'charlotte': [["Unique Museums", "Best-Unique-Museums.html"]],
    'chiang-mai': [["Resorts", "Best-Resorts.html"]],
    'chicago': [["Aquariums", "Best-Aquariums.html"], ["Art Museums", "Best-Art-Museums.html"], ["Gardens", "Best-Gardens.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"]],
    'chongqing': [["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'cinque-terre': [["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'coeur-dalene': [["Lakes", "Best-Lakes.html"]],
    'colmar': [["Wine Regions", "Best-Wine-Regions.html"]],
    'cologne': [["Architecture", "Best-Architecture.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'colombo': [["Resorts", "Best-Resorts.html"], ["Safari", "Best-Safari.html"]],
    'columbia': [["Architecture", "Best-Architecture.html"]],
    'copenhagen': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Aquariums", "Best-Aquariums.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'corfu': [["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'crete': [["Beaches", "Best-Beaches.html"], ["Islands", "Best-Islands.html"]],
    'curacao': [["Caves", "Best-Caves.html"], ["Islands", "Best-Islands.html"]],
    'curitiba': [["Gardens", "Best-Gardens.html"]],
    'cusco': [["Architecture", "Best-Architecture.html"], ["Lakes", "Best-Lakes.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Resorts", "Best-Resorts.html"]],
    'dallas': [["Kids' Museums", "Best-Kids-Museums.html"]],
    'denver': [["Kids' Museums", "Best-Kids-Museums.html"]],
    'doha': [["Art Museums", "Best-Art-Museums.html"]],
    'dubai': [["Aquariums", "Best-Aquariums.html"], ["Architecture", "Best-Architecture.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Resorts", "Best-Resorts.html"]],
    'dublin': [["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'dubrovnik': [["Castles", "Best-Castles.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'edinburgh': [["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Museums", "Best-Museums.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'florence': [["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'florianopolis': [["Beaches", "Best-Beaches.html"]],
    'florida-keys': [["Scuba Diving", "Best-Scuba-Diving.html"]],
    'fortaleza': [["Beaches", "Best-Beaches.html"]],
    'foz-do-iguaçu': [["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'frankfurt': [["Art Museums", "Best-Art-Museums.html"]],
    'galapagos-islands': [["Animal Encounters", "Best-Animal-Encounters.html"], ["Islands", "Best-Islands.html"], ["National Parks", "Best-National-Parks-by-Country.html"], ["Scuba Diving", "Best-Scuba-Diving.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'geneva': [["Lakes", "Best-Lakes.html"]],
    'glacier-national-park': [["National Parks", "Best-National-Parks-by-Country.html"]],
    'glasgow': [["Castles", "Best-Castles.html"]],
    'gothenburg': [["Amusement Parks", "Best-Amusement-Parks.html"]],
    'granada': [["Architecture", "Best-Architecture.html"], ["Castles", "Best-Castles.html"], ["Gardens", "Best-Gardens.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'hamburg': [["Unique Museums", "Best-Unique-Museums.html"]],
    'hanoi': [["Caves", "Best-Caves.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'helsinki': [["Cathedrals", "Best-Cathedrals.html"]],
    'hilton-head-island': [["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"]],
    'hiroshima': [["Animal Encounters", "Best-Animal-Encounters.html"]],
    'hoi-an': [["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'hong-kong': [["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Observation Decks", "Best-Observation-Decks.html"]],
    'istanbul': [["Architecture", "Best-Architecture.html"], ["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Resorts", "Best-Resorts.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'joão-pessoa': [["Gardens", "Best-Gardens.html"]],
    'kauai': [["Beaches", "Best-Beaches.html"]],
    'keywest': [["Unique Museums", "Best-Unique-Museums.html"]],
    'kotor': [["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'kraków': [["Cathedrals", "Best-Cathedrals.html"]],
    'kyoto': [["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Resorts", "Best-Resorts.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'la-jolla': [["Aquariums", "Best-Aquariums.html"], ["Architecture", "Best-Architecture.html"], ["Beaches", "Best-Beaches.html"]],
    'lagos': [["Caves", "Best-Caves.html"]],
    'lake-como': [["Gardens", "Best-Gardens.html"], ["Lakes", "Best-Lakes.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Resorts", "Best-Resorts.html"]],
    'lake-tahoe': [["Lakes", "Best-Lakes.html"]],
    'las-vegas': [["Observation Decks", "Best-Observation-Decks.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'lecce': [["Architecture", "Best-Architecture.html"]],
    'lille': [["Art Museums", "Best-Art-Museums.html"]],
    'lima': [["Cathedrals", "Best-Cathedrals.html"], ["Museums", "Best-Museums.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'lisbon': [["Aquariums", "Best-Aquariums.html"], ["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Caves", "Best-Caves.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'ljubljana': [["Caves", "Best-Caves.html"], ["Lakes", "Best-Lakes.html"]],
    'london': [["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'los-angeles': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Museums", "Best-Museums.html"], ["Resorts", "Best-Resorts.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'los-cabos': [["Beaches", "Best-Beaches.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"]],
    'luang-prabang': [["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'lucerne': [["Lakes", "Best-Lakes.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Resorts", "Best-Resorts.html"]],
    'luxembourg': [["Castles", "Best-Castles.html"]],
    'lyon': [["Cathedrals", "Best-Cathedrals.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'maceió': [["Beaches", "Best-Beaches.html"]],
    'machupicchu': [["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'madeira': [["Islands", "Best-Islands.html"]],
    'madrid': [["Art Museums", "Best-Art-Museums.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Museums", "Best-Museums.html"]],
    'malaga': [["Castles", "Best-Castles.html"]],
    'maldives': [["Beaches", "Best-Beaches.html"], ["Islands", "Best-Islands.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Resorts", "Best-Resorts.html"], ["Scuba Diving", "Best-Scuba-Diving.html"]],
    'malibu': [["Beaches", "Best-Beaches.html"]],
    'manuel-antonio': [["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"]],
    'marco-island': [["Beaches", "Best-Beaches.html"]],
    'marktoberdorf': [["Castles", "Best-Castles.html"]],
    'marrakech': [["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Resorts", "Best-Resorts.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Ultra Luxurious Resorts", "Best-Ultra-Luxurious-Resorts.html"]],
    'marseille': [["Castles", "Best-Castles.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'maui': [["Beaches", "Best-Beaches.html"], ["Islands", "Best-Islands.html"], ["Resorts", "Best-Resorts.html"], ["Volcanoes", "Best-Volcanoes.html"]],
    'melbourne': [["Gardens", "Best-Gardens.html"], ["Hot Springs", "Best-Hot-Springs.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Resorts", "Best-Resorts.html"]],
    'miami': [["Architecture", "Best-Architecture.html"]],
    'milan': [["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"]],
    'monaco': [["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"]],
    'montevideo': [["Architecture", "Best-Architecture.html"]],
    'montreal': [["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"]],
    'munich': [["Architecture", "Best-Architecture.html"], ["Museums", "Best-Museums.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'muscat': [["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"]],
    'mykonos': [["Islands", "Best-Islands.html"], ["Resorts", "Best-Resorts.html"]],
    'napa': [["Wine Regions", "Best-Wine-Regions.html"]],
    'naples': [["Cathedrals", "Best-Cathedrals.html"], ["Volcanoes", "Best-Volcanoes.html"]],
    'naples-florida': [["Gardens", "Best-Gardens.html"]],
    'nashville': [["Unique Museums", "Best-Unique-Museums.html"]],
    'natal': [["Beaches", "Best-Beaches.html"]],
    'new-orleans': [["Unique Museums", "Best-Unique-Museums.html"]],
    'new-york': [["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'nice': [["Resorts", "Best-Resorts.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'oahu': [["Beaches", "Best-Beaches.html"], ["Islands", "Best-Islands.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"]],
    'oaxaca': [["Hot Springs", "Best-Hot-Springs.html"]],
    'olinda': [["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'orcas-island': [["Animal Encounters", "Best-Animal-Encounters.html"]],
    'orlando': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'osaka': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Aquariums", "Best-Aquariums.html"], ["Castles", "Best-Castles.html"], ["Observation Decks", "Best-Observation-Decks.html"]],
    'oslo': [["Architecture", "Best-Architecture.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'oxford': [["Museums", "Best-Museums.html"]],
    'palawan': [["Caves", "Best-Caves.html"], ["Islands", "Best-Islands.html"], ["Scuba Diving", "Best-Scuba-Diving.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'palm-desert': [["National Parks", "Best-National-Parks-by-Country.html"]],
    'palo-alto': [["Unique Museums", "Best-Unique-Museums.html"]],
    'paris': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'pasadena': [["Gardens", "Best-Gardens.html"]],
    'pensacola': [["Unique Museums", "Best-Unique-Museums.html"]],
    'petra': [["Architecture", "Best-Architecture.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'philadelphia': [["Art Museums", "Best-Art-Museums.html"], ["Gardens", "Best-Gardens.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'phoenix': [["Unique Museums", "Best-Unique-Museums.html"]],
    'phuket': [["Islands", "Best-Islands.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Resorts", "Best-Resorts.html"], ["Scuba Diving", "Best-Scuba-Diving.html"]],
    'pisa': [["Cathedrals", "Best-Cathedrals.html"]],
    'pokhara': [["Lakes", "Best-Lakes.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"]],
    'portland': [["Gardens", "Best-Gardens.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'porto': [["Cathedrals", "Best-Cathedrals.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'porto-alegre': [["Architecture", "Best-Architecture.html"]],
    'prague': [["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'puerto-rico': [["Beaches", "Best-Beaches.html"], ["Castles", "Best-Castles.html"], ["Islands", "Best-Islands.html"]],
    'puerto-vallarta': [["Beaches", "Best-Beaches.html"]],
    'quebec-city': [["Castles", "Best-Castles.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"]],
    'queenstown': [["Lakes", "Best-Lakes.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Resorts", "Best-Resorts.html"], ["Ski Resorts", "Best-Ski-Resorts.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'recife': [["Museums", "Best-Museums.html"]],
    'reykjavik': [["Cathedrals", "Best-Cathedrals.html"], ["Caves", "Best-Caves.html"], ["Hot Springs", "Best-Hot-Springs.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Lakes", "Best-Lakes.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Resorts", "Best-Resorts.html"], ["Scuba Diving", "Best-Scuba-Diving.html"], ["Unique Museums", "Best-Unique-Museums.html"], ["Volcanoes", "Best-Volcanoes.html"]],
    'rhodes': [["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'rio-de-janeiro': [["Beaches", "Best-Beaches.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'rome': [["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'salvador': [["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'salzburg': [["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Caves", "Best-Caves.html"]],
    'san-diego': [["Beaches", "Best-Beaches.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'san-francisco': [["Kids' Museums", "Best-Kids-Museums.html"], ["Museums", "Best-Museums.html"], ["Unique Museums", "Best-Unique-Museums.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'san-jose': [["Unique Museums", "Best-Unique-Museums.html"]],
    'san-jose-costa-rica': [["Volcanoes", "Best-Volcanoes.html"]],
    'san-juan-island': [["Animal Encounters", "Best-Animal-Encounters.html"]],
    'san-sebastian': [["Wine Regions", "Best-Wine-Regions.html"]],
    'santa-barbara': [["Surfing", "Best-Surfing.html"]],
    'santa-cruz': [["Amusement Parks", "Best-Amusement-Parks.html"]],
    'santa-fe': [["Art Museums", "Best-Art-Museums.html"]],
    'santa-monica': [["Beaches", "Best-Beaches.html"]],
    'santiago': [["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Resorts", "Best-Resorts.html"]],
    'santorini': [["Islands", "Best-Islands.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Resorts", "Best-Resorts.html"]],
    'sarasota': [["Beaches", "Best-Beaches.html"]],
    'sardinia': [["Islands", "Best-Islands.html"]],
    'scottsdale': [["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'seattle': [["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Unique Museums", "Best-Unique-Museums.html"], ["Volcanoes", "Best-Volcanoes.html"]],
    'sedona': [["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Resorts", "Best-Resorts.html"]],
    'seoul': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Art Museums", "Best-Art-Museums.html"], ["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"]],
    'seville': [["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"]],
    'seychelles': [["Beaches", "Best-Beaches.html"], ["Islands", "Best-Islands.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"]],
    'shanghai': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Aquariums", "Best-Aquariums.html"], ["Architecture", "Best-Architecture.html"], ["Gardens", "Best-Gardens.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"]],
    'sicily': [["Cathedrals", "Best-Cathedrals.html"], ["Islands", "Best-Islands.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Volcanoes", "Best-Volcanoes.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'siena': [["Cathedrals", "Best-Cathedrals.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'singapore': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Aquariums", "Best-Aquariums.html"], ["Architecture", "Best-Architecture.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Resorts", "Best-Resorts.html"]],
    'sint-maarten': [["Beaches", "Best-Beaches.html"]],
    'sintra': [["Castles", "Best-Castles.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'sorrento': [["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"]],
    'split': [["Cathedrals", "Best-Cathedrals.html"], ["Lakes", "Best-Lakes.html"]],
    'stockholm': [["Castles", "Best-Castles.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'strasbourg': [["Cathedrals", "Best-Cathedrals.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'stuttgart': [["Unique Museums", "Best-Unique-Museums.html"]],
    'sydney': [["Aquariums", "Best-Aquariums.html"], ["Architecture", "Best-Architecture.html"], ["Beaches", "Best-Beaches.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Caves", "Best-Caves.html"], ["Gardens", "Best-Gardens.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Resorts", "Best-Resorts.html"]],
    'são-luís': [["National Parks", "Best-National-Parks-by-Country.html"]],
    'são-paulo': [["Art Museums", "Best-Art-Museums.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Observation Decks", "Best-Observation-Decks.html"]],
    'taipei': [["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Hot Springs", "Best-Hot-Springs.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"]],
    'tallinn': [["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'tbilisi': [["Hot Springs", "Best-Hot-Springs.html"]],
    'tenerife': [["Islands", "Best-Islands.html"], ["National Parks", "Best-National-Parks-by-Country.html"], ["Volcanoes", "Best-Volcanoes.html"]],
    'tokyo': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Hot Springs", "Best-Hot-Springs.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Lakes", "Best-Lakes.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Resorts", "Best-Resorts.html"], ["Unique Museums", "Best-Unique-Museums.html"], ["Volcanoes", "Best-Volcanoes.html"]],
    'toledo': [["Cathedrals", "Best-Cathedrals.html"]],
    'toronto': [["Aquariums", "Best-Aquariums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'tromso': [["Natural Phenomena", "Best-Natural-Phenomena.html"]],
    'turin': [["Cathedrals", "Best-Cathedrals.html"], ["Museums", "Best-Museums.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'turks-and-caicos': [["Resorts", "Best-Resorts.html"]],
    'valletta': [["Islands", "Best-Islands.html"]],
    'vancouver': [["Aquariums", "Best-Aquariums.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Resorts", "Best-Resorts.html"]],
    'venice': [["Architecture", "Best-Architecture.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'verona': [["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'victoria': [["Gardens", "Best-Gardens.html"]],
    'vienna': [["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Museums", "Best-Museums.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'virgin-islands': [["Islands", "Best-Islands.html"], ["Resorts", "Best-Resorts.html"], ["Ultra Luxurious Resorts", "Best-Ultra-Luxurious-Resorts.html"]],
    'washington-dc': [["Art Museums", "Best-Art-Museums.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Museums", "Best-Museums.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'wellington': [["Lakes", "Best-Lakes.html"]],
    'whistler': [["Ski Resorts", "Best-Ski-Resorts.html"]],
    'yellowstone': [["Hot Springs", "Best-Hot-Springs.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Volcanoes", "Best-Volcanoes.html"]],
    'zakynthos': [["Beaches", "Best-Beaches.html"]],
    'zhangjiajie': [["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"]],
    'zurich': [["Lakes", "Best-Lakes.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Resorts", "Best-Resorts.html"], ["Unique Museums", "Best-Unique-Museums.html"]]
  };

  /* ── Pill-grid orphan fixer ──────────────────────────────────────────────────
     CSS :nth-child selectors for grid-column are silently ignored by iOS Safari.
     JS inline gridColumn bypasses that. 6-col grid: span 2 = 1/3 (normal),
     span 3 = 1/2 (paired orphan), span 6 = full-width (truly solo).
     Rule: N==1 → span 6; N%3==0 → nothing; N%3==1 → last min(4,N) pills span 3;
           N%3==2 → last 2 pills span 3. */
  function _fixPillGridOrphans(container) {
    if (!container) return;
    var pills = [].slice.call(container.children);
    var n = pills.length;
    if (!n) return;
    pills.forEach(function (p) { p.style.gridColumn = ''; });
    if (n === 1) { pills[0].style.gridColumn = 'span 6'; return; }
    var rem = n % 3;
    if (rem === 0) return;
    var widen = rem === 1 ? Math.min(4, n) : 2;
    for (var i = n - widen; i < n; i++) { pills[i].style.gridColumn = 'span 3'; }
  }

  function _injectBestOfCrossLinks() {
    if (!isRealGuide) return;
    var also = document.getElementById('also-on-this-site');
    if (!also) return;
    var parts = location.pathname.split('/');
    var gi = parts.indexOf('Guides');
    if (gi < 0) return;
    var citySlug = parts[gi + 1].toLowerCase();
    var entries = CITY_BEST_OF_MAP[citySlug];
    if (!entries || !entries.length) return;
    var wrap = document.createElement('div');
    wrap.id = 'tve-best-of-crosslinks';
    wrap.className = 'extras-section';
    var h = document.createElement('div');
    h.className = 'extras-title';
    h.textContent = '⭐ Best Of';
    var pills = document.createElement('div');
    pills.className = 'also-on-this-site-pills';
    entries.forEach(function (entry) {
      var a = document.createElement('a');
      a.className = 'also-on-this-site-pill';
      a.href = base + 'Trip-Essentials/' + entry[1];
      a.textContent = entry[0];
      pills.appendChild(a);
    });
    wrap.appendChild(h);
    wrap.appendChild(pills);
    wrap.addEventListener('click', function (e) { e.stopPropagation(); });
    also.parentNode.insertBefore(wrap, also.nextSibling);
  }
  function _injectBestOfAndFixOrphans() {
    _injectBestOfCrossLinks();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectBestOfAndFixOrphans);
  } else {
    _injectBestOfAndFixOrphans();
  }

  /* ── "Also a day trip from" — compact row at the foot of Trip Overview ──────
     62 of the fleet's guides are themselves listed as a train day trip by one
     or more OTHER guides (Florence is a day trip from Bologna, Pisa, Rome and
     Siena). That relationship already exists in the Day Trips data but was only
     ever readable in the outbound direction. This injects the inbound view.

     Data: assets/day_trip_from.json — the reverse index emitted by
     Brain/scripts/build/build_day_trips.py (same parse as Day-Trips.html, so
     the two can never disagree). Keyed by destination guide filename; the value
     is the departure guides, pre-sorted by city name. Destinations with no
     shipped guide are omitted at build time, so every link here resolves.

     Zero guide HTML changes — the row is injected, never authored. Anchored
     after the last .overview-day so it lands inside the white Trip Overview
     card regardless of whether .overview-extras has already been moved out
     of it by the grouping pass further down this file. */
  (function () {
    if (!isRealGuide) return;
    var _dtCacheKey = 'tvedtf';

    function _dtfCss() {
      if (document.getElementById('tve-adtf-css')) return;
      var s = document.createElement('style');
      s.id = 'tve-adtf-css';
      s.textContent =
        /* Same three-part geometry as a railed day row (.overview-day.tve-railed):
           58px rail + 14px gap + body, 10px 16px padding, body at the day-title
           size. The row is a <div>, so it never disturbs the <a>-based
           :nth-of-type zebra on the day rows above it. */
        '.tve-adtf{display:flex;align-items:baseline;gap:14px;padding:10px 16px;' +
        'font-size:var(--fs-overview-day-title,15px);line-height:1.5;}' +
        /* …which is also why the row cannot INHERIT that zebra: the CSS tints
           every even <a>, and this is a <div>, so the stripe always stopped at
           the last day row and the ALSO row came out white however the table
           above it had landed. Stamped in JS instead — see _dtfZebra. */
        '.tve-adtf-zebra{background:var(--c-ovd-zebra,#fbf8f2);}' +
        '.tve-adtf-label{flex:0 0 58px;font-size:11px;font-weight:700;letter-spacing:.08em;' +
        'text-transform:uppercase;white-space:nowrap;color:var(--c-brand,#8a6c1a);}' +
        /* Same token as .ovd-stops, not merely a similar grey — the row sits in
           the day table and must move with it in both themes. */
        '.tve-adtf-cities{flex:1 1 auto;min-width:0;color:var(--c-ovd-stops,#6f695d);}' +
        '.tve-adtf-sep{color:inherit;}' +
        /* The departure city is NOT gold (owner rule 2026-08-09). It is the same
           kind of thing as "Berchtesgaden" on the row above — a place name in a
           day line — and those are plain body text, so a gold one here read as a
           different class of content sitting in the same column. It takes the
           row's own colour and reveals itself as a link on hover instead.
           :visited needs no rule: this is a class-specificity author selector,
           so it already outranks the UA visited style in every state. */
        '.tve-adtf a{color:inherit;text-decoration:none;border-bottom:1px solid transparent;}' +
        '.tve-adtf a:hover{color:#b85c2a;border-bottom-color:#b85c2a;text-decoration:none;}' +
        /* Mobile mirrors the day row's stacked form: label on its own line, body full width. */
        '@media (max-width:600px){.tve-adtf{display:grid;grid-template-columns:1fr;' +
        'gap:3px 8px;padding:9px 14px;}.tve-adtf-label{flex:none;}}';
      document.head.appendChild(s);
    }

    function _dtfBuild(data) {
      var from = data[curr];
      if (!from || !from.length) return;
      /* Anchor on the last day card — .overview-extras may already have been
         relocated out of the card by the time this runs. */
      var days = document.querySelectorAll('.overview-section .overview-day');
      if (!days.length) return;
      var last = days[days.length - 1];
      if (!last.parentNode) return;
      if (document.getElementById('tve-also-day-trip-from')) return;

      _dtfCss();
      var row = document.createElement('div');
      row.id = 'tve-also-day-trip-from';
      row.className = 'tve-adtf';

      /* The rail carries the row's kind, exactly as "DAY 4" does above it —
         one short uppercase word, never a sentence. The sentence lives in the
         body column, where it lines up with the stop lists. */
      var label = document.createElement('span');
      label.className = 'tve-adtf-label';
      label.textContent = 'Also';
      row.appendChild(label);

      var cities = document.createElement('span');
      cities.className = 'tve-adtf-cities';
      /* Body IS a Train Day body — same icon, same "Train Day", same dot before
         the city (owner rule 2026-08-09: "the rest of the format follow what we
         use already"). The single added word is "from", which is not decoration:
         this row is the INBOUND view, so "🚆 · Train Day · Vienna" would read as
         a train day TO Vienna and state the opposite of the truth. */
      var lead = document.createElement('span');
      lead.textContent = '🚆 · Train Day from · ';
      cities.appendChild(lead);
      from.forEach(function (g, i) {
        if (i) {
          var sep = document.createElement('span');
          sep.className = 'tve-adtf-sep';
          sep.textContent = ' · ';   /* inline now, so the spacing is in the text, not a flex gap */
          cities.appendChild(sep);
        }
        var a = document.createElement('a');
        a.href = '../' + g.dir + '/' + g.slug;
        a.textContent = g.city;
        cities.appendChild(a);
      });
      row.appendChild(cities);

      last.parentNode.insertBefore(row, last.nextSibling);
      _dtfZebra(row, last);
    }

    /* Continue the white/beige alternation onto the ALSO row.
       guide-style.css tints `.overview-day.tve-railed:nth-of-type(even)`, which
       counts <a> siblings — this row is a <div> and is invisible to it, so the
       stripe simply stopped and two white rows ended up stacked whenever the
       guide had an ODD number of days (Salzburg: DAY 8 beige, DAY 9 white,
       ALSO white). The parity is read off the last day row rather than computed
       from days.length: the CSS counts elements of the same TYPE, so a guide
       that ever puts another <a> inside the section would shift it, and asking
       the row itself can't be wrong.
       Runs in rAF because _dayRowRail — which stamps .tve-railed, the class the
       zebra rule requires — registers its DOMContentLoaded listener AFTER this
       one and has not run yet at insert time. Without the tint the row is
       transparent over the card, so a guide whose rows never railed (an
       unrecognised title shape) correctly gets no stripe either. */
    function _dtfZebra(row, last) {
      var run = function () {
        if (!last.classList.contains('tve-railed')) return;
        if (!last.matches(':nth-of-type(even)')) row.classList.add('tve-adtf-zebra');
      };
      if (window.requestAnimationFrame) requestAnimationFrame(run); else setTimeout(run, 0);
    }

    function _dtfRun() {
      try {
        var hit = sessionStorage.getItem(_dtCacheKey);
        if (hit) { _dtfBuild(JSON.parse(hit)); return; }
      } catch (e) {}
      var xhr = new XMLHttpRequest();
      xhr.open('GET', base + 'assets/day_trip_from.json', true);
      xhr.timeout = 6000;
      xhr.onload = function () {
        if (xhr.status < 200 || xhr.status >= 300) return;
        try {
          var data = JSON.parse(xhr.responseText);
          try { sessionStorage.setItem(_dtCacheKey, xhr.responseText); } catch (e) {}
          _dtfBuild(data);
        } catch (e) {}
      };
      xhr.send();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _dtfRun);
    } else {
      _dtfRun();
    }
  }());

  /* ── End-section nav pills — injects overview-extra-link pills for the five
     bottom sections (Also on This Site, Best Of, Nearby Guides, Alt. Hotels,
     Also in Country) so they are reachable from the scrollable pill strip above
     the guide days. Injected dynamically so pills only appear when the section
     is present and has content. (owner rule 2026-08-06) */
  function _injectEndSectionPills() {
    if (!isRealGuide) return;
    var row = document.querySelector('.overview-extras:not(#ics-pill-row)');
    if (!row) return;
    function addPill(href, text) {
      var a = document.createElement('a');
      a.className = 'overview-extra-link';
      a.href = href;
      a.textContent = text;
      row.appendChild(a);
    }
    /* 1. Also on This Site — always present in real guides */
    if (document.getElementById('also-on-this-site')) {
      addPill('#also-on-this-site', '💥 Also on this site');
    }
    /* 2. Best Of — only when this city appears in CITY_BEST_OF_MAP */
    var _epParts = location.pathname.split('/');
    var _epgi = _epParts.indexOf('Guides');
    if (_epgi >= 0) {
      var _epSlug = _epParts[_epgi + 1].toLowerCase();
      if (CITY_BEST_OF_MAP[_epSlug] && CITY_BEST_OF_MAP[_epSlug].length) {
        addPill('#tve-best-of-crosslinks', '⭐ Best Of');
      }
    }
    /* 3. Nearby Guides — only when the section has pills (build_nearby_guides populated it) */
    var _epng = document.getElementById('nearby-guides');
    if (_epng) {
      var _epngp = _epng.querySelector('.nearby-guides-pills');
      if (_epngp && _epngp.children.length > 0) {
        addPill('#nearby-guides', '🗺️ Nearby Guides');
      }
    }
    /* 4. Alternative Hotel Recommendations — only when HOTEL_ALT_DATA has an entry for this guide */
    var _epPage = location.pathname.split('/').pop() || '';
    var _epMatch = _epPage.match(/^(.+?)(?:_v\d+)?\.html$/);
    if (_epMatch && HOTEL_ALT_DATA[_epMatch[1]]) {
      addPill('#hotel-alternatives', '🏨 Alt. Hotels');
    }
    /* 5. Also in Country — async; pill is appended by the XHR _build() callback below */
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectEndSectionPills);
  } else {
    _injectEndSectionPills();
  }

  /* ── "Also in [Country]" section — injected after #nearby-guides on
     guide pages that share a country with ≥1 other fleet guide. Fetches
     assets/country_guides.json (built by Brain/scripts/build/build_country_guides.py
     after each ship). Countries with only one fleet guide get no section.
     Uses sessionStorage to avoid re-fetching on same-tab navigation. */
  (function () {
    if (!isRealGuide) return;
    var _cacheKey = 'tvecg';
    function _build(data) {
      var bySlug = data['_by_slug'] || {};
      var country = bySlug[curr];
      if (!country) return;
      var peers = data[country];
      if (!peers || peers.length < 2) return;
      var siblings = peers.filter(function (g) { return g.slug !== curr; });
      if (!siblings.length) return;
      /* Insert after #nearby-guides; fall back to after #also-on-this-site */
      var anchor = document.getElementById('nearby-guides') || document.getElementById('also-on-this-site');
      if (!anchor || !anchor.parentNode) return;
      var wrap = document.createElement('div');
      wrap.id = 'also-in-country';
      wrap.className = 'extras-section';
      var h = document.createElement('div');
      h.className = 'extras-title';
      h.textContent = 'Also in ' + country;
      var pills = document.createElement('div');
      pills.className = 'also-in-country-pills';
      siblings.forEach(function (g) {
        var a = document.createElement('a');
        a.className = 'also-in-country-pill';
        a.href = '../' + g.dir + '/' + g.slug;
        /* City name ONLY — no map glyph (owner rule 2026-08-10, Rule 815). */
        a.textContent = g.city;
        pills.appendChild(a);
      });
      wrap.appendChild(h);
      wrap.appendChild(pills);
      /* Collapse — injected after DOMContentLoaded so _sectionCollapse missed it */
      wrap.dataset.collapseInited = '1';
      h.setAttribute('role', 'button');
      h.setAttribute('tabindex', '0');
      h.addEventListener('click', function () { wrap.classList.toggle('collapsed'); });
      h.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wrap.classList.toggle('collapsed'); }
      });
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
      _fixPillGridOrphans(pills);
      /* Append nav pill for Also in Country to the scrollable pill strip */
      var _aicRow = document.querySelector('.overview-extras:not(#ics-pill-row)');
      if (_aicRow) {
        var _aicPill = document.createElement('a');
        _aicPill.className = 'overview-extra-link';
        _aicPill.href = '#also-in-country';
        _aicPill.textContent = '🌍 Also in ' + country;
        _aicPill.addEventListener('click', function () {
          if (wrap.classList.contains('collapsed')) wrap.classList.remove('collapsed');
        });
        _aicRow.appendChild(_aicPill);
      }
      /* Re-anchor the stamp (and no-entries row) after the now-last footer section.
         Uses the same DOM-last logic as repositionUpdatedStamp() — compareDocumentPosition
         flag 4 = DOCUMENT_POSITION_FOLLOWING — so #also-in-country (just inserted)
         is always found as the last section rather than hard-coding Best Of. */
      (function () {
        var _s = document.querySelector('.title-page .title-updated') || document.querySelector('.title-updated');
        if (!_s) return;
        var _sids = ['tve-best-of-crosslinks', 'also-in-country', 'nearby-guides', 'also-on-this-site'];
        var _slast = null;
        _sids.forEach(function (id) {
          var el = document.getElementById(id);
          if (!el) return;
          if (!_slast || (_slast.compareDocumentPosition(el) & 4)) { _slast = el; }
        });
        if (!_slast || !_slast.parentNode) return;
        var _sne = document.querySelector('.title-no-entries');
        if (_sne) {
          var _srow = document.createElement('div');
          _srow.className = 'tve-stamp-row';
          _srow.appendChild(_s);
          _srow.appendChild(_sne);
          _slast.parentNode.insertBefore(_srow, _slast.nextSibling);
        } else {
          _slast.parentNode.insertBefore(_s, _slast.nextSibling);
        }
      }());
    }
    function _run() {
      try {
        var hit = sessionStorage.getItem(_cacheKey);
        if (hit) { _build(JSON.parse(hit)); return; }
      } catch (e) {}
      var xhr = new XMLHttpRequest();
      xhr.open('GET', base + 'assets/country_guides.json', true);
      xhr.timeout = 6000;
      xhr.onload = function () {
        if (xhr.status < 200 || xhr.status >= 300) return;
        try {
          var data = JSON.parse(xhr.responseText);
          try { sessionStorage.setItem(_cacheKey, xhr.responseText); } catch (e) {}
          _build(data);
        } catch (e) {}
      };
      xhr.send();
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _run);
    } else {
      _run();
    }
  })();

  /* ── Quick Facts strip — real guide pages only ────────────────────────────
     The four facts a reader checks before committing to an itinerary:
     🗣️ language · 💰 cost tier · 🔌 plug type · 🌤️ best months. Each one
     already lives on a Trip-Essentials page (Budget-Guide, Plug-Adapter-Guide,
     When-to-Go); assets/quick_facts.json joins them per guide so reading all
     four no longer costs four page visits. Built by
     Brain/scripts/build/build_quick_facts.py, refreshed on every ship.

     Anchored ABOVE .overview-section rather than below .title-page on purpose:
     the weather strip anchors itself to .title-page and lands asynchronously,
     so anchoring both to the banner would race for the same slot. Going in
     above TRIP OVERVIEW instead makes the order deterministic no matter which
     resolves first — banner → weather → quick facts → TRIP OVERVIEW.

     Degrades silently: no JSON, no entry for this guide, or a partial entry
     simply renders fewer pills (or nothing at all). Colors are theme tokens,
     so the strip follows the dark-mode overrides in guide-style.css. */
  (function () {
    if (!isRealGuide) return;
    var _qfKey = 'tveqf';

    function _build(data) {
      if (document.getElementById('tve-quick-facts')) return;
      var facts = data && data.facts && data.facts[curr];
      if (!facts) return;

      var anchor    = document.querySelector('.overview-section');
      var titlePage = document.querySelector('.title-page');
      if (!anchor && !titlePage) return;

      /* [emoji, title-attribute label, value] — order is the reading order the
         feature was specified with; a missing fact drops its pill entirely. */
      var items = [];
      if (facts.lang)   items.push(['🗣️', 'Language', facts.lang]);
      if (facts.cost)   items.push(['💰', 'Cost tier',
                                    facts.cost + (facts.cost_detail ? ' · ' + facts.cost_detail : '')]);
      if (facts.plug)   items.push(['🔌', 'Plug type', facts.plug]);
      if (facts.months) items.push(['🌤️', 'Best months', facts.months]);
      if (!items.length) return;

      var isMobile = window.innerWidth <= 600;
      var strip = document.createElement('div');
      strip.id = 'tve-quick-facts';
      /* Matches the weather strip's own margins so the two stack evenly. */
      strip.style.cssText =
        'display:flex;flex-wrap:wrap;gap:6px;width:100%;box-sizing:border-box;' +
        'margin:' + (isMobile ? '12px 0' : '0 0 16px') + ';';

      items.forEach(function (it) {
        var pill = document.createElement('span');
        pill.title = it[1];
        pill.style.cssText =
          'display:inline-flex;align-items:center;gap:5px;' +
          'padding:5px 10px;border-radius:6px;' +
          'background:var(--c-warm-bg,#f3efe6);' +
          'border:1px solid var(--c-index-border,#e3dccd);' +
          'font-size:12px;font-weight:500;line-height:1.35;' +
          'color:var(--c-text-primary,#3d3a32);white-space:nowrap;';
        var ico = document.createElement('span');
        ico.textContent = it[0];
        ico.style.cssText = 'font-size:12px;line-height:1;';
        pill.appendChild(ico);
        pill.appendChild(document.createTextNode(it[2]));
        strip.appendChild(pill);
      });

      if (anchor) anchor.parentNode.insertBefore(strip, anchor);
      else titlePage.insertAdjacentElement('afterend', strip);
    }

    function _run() {
      try {
        var hit = sessionStorage.getItem(_qfKey);
        if (hit) { _build(JSON.parse(hit)); return; }
      } catch (e) {}
      var xhr = new XMLHttpRequest();
      xhr.open('GET', base + 'assets/quick_facts.json', true);
      xhr.timeout = 6000;
      xhr.onload = function () {
        if (xhr.status < 200 || xhr.status >= 300) return;
        try {
          var data = JSON.parse(xhr.responseText);
          try { sessionStorage.setItem(_qfKey, xhr.responseText); } catch (e) {}
          _build(data);
        } catch (e) {}
      };
      xhr.send();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _run);
    } else {
      _run();
    }
  })();

  /* ── In-guide currency converter — collapsed pill on the action row ────────
     A 💱 Currency pill appended to #ics-pill-row that expands, in place, into a
     two-field converter: US$ ⇄ local. Both fields are live inputs — editing
     either rewrites the other — because a reader inside an itinerary needs the
     conversion in both directions: budgeting outbound ("what is $60 here?") and
     reading a price inbound ("the menu says ¥4,800").

     Adds no data pipeline. The rate is the one Currency-Guide.html already
     carries: update_currency_rates.py refreshes that page monthly and now emits
     assets/currency_rates.json from the same country blocks in the same pass, so
     page and pill cannot quote different numbers. Reading the JSON instead of
     the page keeps the cost at ~9 KB rather than the 1,800-line guide.

     Country resolution reuses assets/country_guides.json — already fetched and
     sessionStorage-cached under tvecg by the "Also in [Country]" section, so on
     a warm tab this feature costs one extra request, not two. Both sides of the
     join are FOLDED (lowercase, accents stripped, underscores → spaces): the
     Currency-Guide anchors are ASCII with underscores while country_guides.json
     holds display strings, four of them all-caps or accented (Curaçao, MALTA,
     PHILIPPINES, SOUTH AFRICA). Without the fold those four render no pill.

     Renders nothing at all when the country is unknown or already on USD
     (Ecuador, Puerto Rico, Turks and Caicos, United States) — a US$→US$ box is
     noise. Like every fetch-backed feature it is invisible over file:// (§ 34). */
  (function () {
    if (!isRealGuide) return;

    function _curFold(s) {
      return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/_/g, ' ').trim().toLowerCase();
    }

    /* Amounts: whole numbers once past 100 — ¥1,578 not ¥1,578.59. */
    function _curAmt(v) {
      var dp = Math.abs(v) >= 100 ? 0 : 2;
      return v.toLocaleString('en-US',
        { minimumFractionDigits: dp, maximumFractionDigits: dp });
    }

    /* Reference rate: mirrors fmt_rate() in update_currency_rates.py exactly so
       the pill's "US$1 ≈ …" line is byte-identical to the page's. */
    function _curRate(r) {
      if (r >= 100) return r.toLocaleString('en-US', { maximumFractionDigits: 0 });
      if (r >= 1) return r.toLocaleString('en-US',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return r.toFixed(3);
    }

    function _curJSON(key, file, cb) {
      try {
        var hit = sessionStorage.getItem(key);
        /* setTimeout, not a bare cb(): a cache hit would otherwise resolve
           SYNCHRONOUSLY inside this feature's own DOMContentLoaded handler, and
           _extrasOutOfCard — registered later on that same event — had not yet
           lifted #ics-pill-row out of .overview-section. The panel was inserted
           beside the row's old position and then left behind inside the white
           Trip Overview card when the row moved, on warm tabs only. Deferring by
           a macrotask puts _build after the whole DOMContentLoaded dispatch, so
           cold and warm loads land identically. */
        if (hit) { var d = JSON.parse(hit); setTimeout(function () { cb(d); }, 0); return; }
      } catch (e) {}
      var xhr = new XMLHttpRequest();
      xhr.open('GET', base + 'assets/' + file, true);
      xhr.timeout = 6000;
      xhr.onload = function () {
        if (xhr.status < 200 || xhr.status >= 300) return;
        try {
          var data = JSON.parse(xhr.responseText);
          try { sessionStorage.setItem(key, xhr.responseText); } catch (e) {}
          cb(data);
        } catch (e) {}
      };
      xhr.send();
    }

    function _build(cg, cur) {
      if (document.getElementById('tve-cur-pill')) return;
      var row = document.getElementById('ics-pill-row');
      if (!row) return;

      var country = cg && cg._by_slug && cg._by_slug[curr];
      var c = country && cur && cur.rates && cur.rates[_curFold(country)];
      if (!c || !c.rate || c.iso === 'USD') return;

      var sym = c.sym || '';

      /* ── Pill ── */
      var pill = document.createElement('a');
      pill.href = 'javascript:void(0)';
      pill.className = 'overview-extra-link';
      pill.id = 'tve-cur-pill';
      pill.textContent = '💱 Currency';
      pill.setAttribute('aria-expanded', 'false');
      pill.setAttribute('aria-controls', 'tve-cur-panel');
      pill.style.setProperty('flex', '1 1 0', 'important');
      pill.style.setProperty('min-width', '0', 'important');
      pill.style.setProperty('align-items', 'center', 'important');
      pill.style.setProperty('justify-content', 'center', 'important');
      pill.style.setProperty('text-align', 'center', 'important');

      /* ── Panel — hidden until the pill is tapped ── */
      var panel = document.createElement('div');
      panel.className = 'tve-cur-panel';
      panel.id = 'tve-cur-panel';
      panel.hidden = true;

      var fields = document.createElement('div');
      fields.className = 'tve-cur-row';

      function _field(label, aria) {
        var wrap = document.createElement('label');
        wrap.className = 'tve-cur-field';
        var tag = document.createElement('span');
        tag.className = 'tve-cur-sym';
        tag.textContent = label;
        var input = document.createElement('input');
        input.className = 'tve-cur-in';
        input.type = 'number';
        input.min = '0';
        input.step = 'any';
        input.setAttribute('inputmode', 'decimal');
        input.setAttribute('aria-label', aria);
        wrap.appendChild(tag);
        wrap.appendChild(input);
        return { wrap: wrap, input: input };
      }

      var usd = _field('US$', 'Amount in US dollars');
      var loc = _field(sym || c.iso, 'Amount in ' + c.name);
      var eq = document.createElement('span');
      eq.className = 'tve-cur-eq';
      eq.textContent = '=';

      fields.appendChild(usd.wrap);
      fields.appendChild(eq);
      fields.appendChild(loc.wrap);
      panel.appendChild(fields);

      /* Two-way binding. The `busy` latch stops the programmatic .value write
         from re-entering through the other field's own input event, which would
         round the number the reader is still typing out from under them. */
      var busy = false;
      function _bind(src, dst, factor) {
        src.addEventListener('input', function () {
          if (busy) return;
          busy = true;
          var n = parseFloat(src.value);
          dst.value = (src.value === '' || isNaN(n)) ? '' : _curAmt(n * factor)
            .replace(/,/g, '');   /* number inputs reject grouping separators */
          busy = false;
        });
      }
      _bind(usd.input, loc.input, c.rate);
      _bind(loc.input, usd.input, 1 / c.rate);

      usd.input.value = '10';
      loc.input.value = _curAmt(10 * c.rate).replace(/,/g, '');

      /* ── Reference line — the rate, its currency, and the way out ── */
      var note = document.createElement('div');
      note.className = 'tve-cur-note';
      note.appendChild(document.createTextNode(
        'US$1 ≈ ' + sym + _curRate(c.rate) + ' · ' + c.name + ' (' + c.iso + ')' +
        (cur._as_of ? ' · rates as of ' + cur._as_of : '') + ' · '
      ));
      var more = document.createElement('a');
      more.className = 'tve-cur-more';
      more.href = base + 'Trip-Essentials/Currency-Guide.html#' + c.id;
      more.textContent = 'Currency Guide ›';
      note.appendChild(more);
      panel.appendChild(note);

      pill.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        /* Insurance against any future pass that relocates the row after build:
           the panel must open directly beneath the pill it belongs to, not
           wherever the row used to be. */
        if (pill.parentNode && pill.parentNode.nextSibling !== panel) {
          pill.parentNode.parentNode.insertBefore(panel, pill.parentNode.nextSibling);
        }
        var open = panel.hidden;
        panel.hidden = !open;
        pill.classList.toggle('tve-cur-on', open);
        pill.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) usd.input.focus();
      });

      /* iOS does not reliably fire :active on touch — same shim the rest of the
         action row uses so the pressed state shows. */
      pill.addEventListener('touchstart', function () {
        pill.classList.add('tve-pressed');
        pill.style.setProperty('color', '#fff', 'important');
        pill.style.setProperty('-webkit-text-fill-color', '#fff', 'important');
      }, { passive: true });
      pill.addEventListener('touchend', function () {
        setTimeout(function () {
          pill.classList.remove('tve-pressed');
          pill.style.removeProperty('color');
          pill.style.removeProperty('-webkit-text-fill-color');
        }, 300);
      }, { passive: true });
      pill.addEventListener('touchcancel', function () {
        pill.classList.remove('tve-pressed');
        pill.style.removeProperty('color');
        pill.style.removeProperty('-webkit-text-fill-color');
      }, { passive: true });

      row.appendChild(pill);
      /* Panel is a SIBLING of the row, not a child — #ics-pill-row is a flex
         row on desktop and a 2-column grid on mobile; a block child would be
         laid out as another pill in both. */
      row.parentNode.insertBefore(panel, row.nextSibling);
    }

    function _run() {
      _curJSON('tvecg', 'country_guides.json', function (cg) {
        _curJSON('tvecur', 'currency_rates.json', function (cur) {
          _build(cg, cur);
        });
      });
    }

    /* Waits for DOMContentLoaded even on a warm sessionStorage hit: #ics-pill-row
       is built by _injectICSExport on that same event, and this listener is
       registered later, so the row is always in the DOM by the time _build runs. */
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _run);
    } else {
      _run();
    }
  })();

  /* ── Weather widget — loaded on the Guides index ONLY ─────────────────────
     weather.js lives in assets/ (permanent home). On the index it adds the
     🌡 Weather control in the title banner (city picker + monthly high/low
     panel) and per-guide hover weather on the cards. Deliberately NOT loaded
     on individual guide pages. Bump the ?v= below whenever weather.js changes
     so the browser refreshes it (it has no version tag on the page itself). */
  if (curr === 'Guides-Index.html' || curr === 'index.html') {
    var _wx = document.createElement('script');
    _wx.src = base + 'assets/weather.js?v=4';
    document.head.appendChild(_wx);
  }

  /* ── Sticky stop-name strip — guide pages only ──────────────────────────────
     A slim fixed strip at the top of the viewport that shows the name of the
     stop currently being read — "📍 1. Panthéon" — so context is never lost on
     long days where the stop header has scrolled off screen. Uses
     IntersectionObserver on every .stop-header element. The strip appears when
     a header exits the top of the viewport and clears when no headers remain
     above it (e.g. scrolled back to the top). Zero guide HTML changes. */
  function _injectStopStrip() {
    if (!isRealGuide) return;
    if (!window.IntersectionObserver) return;

    var strip = document.createElement('div');
    strip.id = 'tve-stop-strip';
    strip.style.cssText =
      'display:none;position:fixed;top:0;left:0;right:0;z-index:101;' +
      'height:28px;align-items:center;' +
      'background:#f0ede5;border-bottom:1px solid #ddd8cc;' +
      'padding:0 16px;font-size:12px;font-weight:500;color:#6b6860;' +
      'letter-spacing:0.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
      'box-sizing:border-box;pointer-events:none;';
    document.body.appendChild(strip);

    function _setupStopStrip() {
      var headers = [].slice.call(document.querySelectorAll('.stop-header'));
      if (!headers.length) return;

      var aboveViewport = new Set();

      function _updateStrip() {
        var current = null;
        for (var i = headers.length - 1; i >= 0; i--) {
          if (aboveViewport.has(headers[i])) { current = headers[i]; break; }
        }
        if (current) {
          var nameEl = current.querySelector('.stop-name');
          var numEl  = current.querySelector('.stop-num');
          var num    = numEl  ? numEl.textContent.trim()  : '';
          var name   = nameEl ? nameEl.textContent.trim() : '';
          strip.textContent = '📍 ' + (num ? num + ' ' : '') + name;
          strip.style.display = 'flex';
        } else {
          strip.style.display = 'none';
        }
      }

      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
            aboveViewport.add(entry.target);
          } else {
            aboveViewport.delete(entry.target);
          }
        });
        _updateStrip();
      }, { threshold: 0 });

      headers.forEach(function(h) { obs.observe(h); });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _setupStopStrip);
    } else {
      _setupStopStrip();
    }
  }
  _injectStopStrip();

  /* ── 7-day weather strip — real guide pages only ──────────────────────────
     Fetches a live forecast from Open-Meteo (free, no API key). Coordinates
     come from climate.json. Response is cached in sessionStorage under
     'wx-{slug}' so only the first page-load per session hits the network.
     Degrades silently when offline or when the city has no coordinate entry.
     Rendered between .title-page and .overview-section. */
  function _injectWeatherStrip() {
    if (!isRealGuide) return;
    if (!navigator.onLine) return;

    var cityEl = document.querySelector('.title-city');
    if (!cityEl) return;
    var rawCity = cityEl.textContent.trim();
    var cityLower = rawCity.toLowerCase();
    /* Normalize for accent-insensitive matching (handles Zürich, Montréal, Tromsø, etc.) */
    function _normCity(s) {
      return s.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '') /* strip combining marks */
        .replace(/ø|Ø/g, 'o')                  /* ø/Ø → o (not NFD-decomposable) */
        .replace(/['’]/g, '');                        /* strip apostrophes */
    }
    var cityNorm = _normCity(rawCity);

    /* WMO weather-code → emoji */
    var WMO = {
      0:'☀️', 1:'🌤️', 2:'🌥️', 3:'☁️',
      45:'🌫️', 48:'🌫️',
      51:'🌦️', 53:'🌦️', 55:'🌧️',
      56:'🌧️', 57:'🌧️',
      61:'🌧️', 63:'🌧️', 65:'🌧️',
      66:'🌧️', 67:'🌧️',
      71:'🌨️', 73:'🌨️', 75:'❄️', 77:'🌨️',
      80:'🌦️', 81:'🌧️', 82:'⛈️',
      85:'🌨️', 86:'❄️',
      95:'⛈️', 96:'⛈️', 99:'⛈️'
    };
    var DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    function _wxUnit() {
      try { return localStorage.getItem('guideTempUnit') === 'F' ? 'F' : 'C'; }
      catch (e) { return 'C'; }
    }
    function _wxConv(c) { return _wxUnit() === 'F' ? Math.round(c * 9 / 5 + 32) : Math.round(c); }

    function _renderStrip(data) {
      var titlePage = document.querySelector('.title-page');
      if (!titlePage || document.getElementById('tve-wx-strip')) return;

      var daily = data.daily;
      if (!daily || !daily.time || !daily.time.length) return;

      var u = _wxUnit();
      var isMobile = window.innerWidth <= 600;

      /* ── Outer strip — clickable link to Google Weather ── */
      var strip = document.createElement('a');
      strip.id = 'tve-wx-strip';
      strip.href = 'https://www.google.com/search?q=weather+' + encodeURIComponent(rawCity);
      strip.target = '_blank';
      strip.rel = 'noopener';
      strip.style.cssText =
        'display:flex;align-items:center;text-decoration:none;width:100%;' +
        'background:#f3efe6;border:1px solid #e3dccd;border-radius:6px;' +
        'padding:' + (isMobile ? '5px 6px' : '6px 10px') + ';margin:' + (isMobile ? '12px 0' : '0 0 16px') + ';font-family:inherit;box-sizing:border-box;' +
        'overflow:hidden;cursor:pointer;transition:background .15s;';
      strip.addEventListener('mouseenter', function () { strip.style.background = '#ece5d6'; });
      strip.addEventListener('mouseleave', function () { strip.style.background = '#f3efe6'; });

      /* 7 days on desktop AND mobile — the strip is now width:100% and each column
         is flex:1 min-width:0, so all 7 always fit; icons/temps shrink smoothly on
         narrow phones. Prior mobile 5-day clamp was for the pre-100%-width strip. */
      var grid = document.createElement('div');
      grid.style.cssText = 'display:flex;flex:1;justify-content:space-between;gap:2px;';

      var n = Math.min(7, daily.time.length);
      for (var i = 0; i < n; i++) {
        var dt = new Date(daily.time[i] + 'T12:00:00');
        var col = document.createElement('div');
        col.style.cssText =
          'display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;gap:3px;';

        var dayDiv = document.createElement('div');
        dayDiv.style.cssText =
          'font-size:' + (isMobile ? '10px' : '12px') + ';font-weight:700;color:#6b6860;letter-spacing:0.03em;line-height:1.2;';
        dayDiv.textContent = DAY[dt.getDay()];

        var iconDiv = document.createElement('div');
        iconDiv.style.cssText = 'font-size:' + (isMobile ? '17px' : '22px') + ';line-height:1.2;';
        iconDiv.textContent = WMO[daily.weathercode[i]] || '🌡️';

        var tempDiv = document.createElement('div');
        tempDiv.style.cssText =
          'font-size:' + (isMobile ? '10px' : '12px') + ';color:#3d3a32;white-space:nowrap;line-height:1.2;';
        tempDiv.textContent =
          _wxConv(daily.temperature_2m_max[i]) + '°/' +
          _wxConv(daily.temperature_2m_min[i]) + '°';

        col.appendChild(dayDiv);
        col.appendChild(iconDiv);
        col.appendChild(tempDiv);
        grid.appendChild(col);
      }
      /* ── NOW block — current temperature + current condition icon ── */
      if (data.current && data.current.temperature_2m != null) {
        var nowBlock = document.createElement('div');
        nowBlock.style.cssText =
          'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
          'padding-right:' + (isMobile ? '6px' : '10px') + ';margin-right:' + (isMobile ? '4px' : '8px') + ';' +
          'border-right:1px solid #e3dccd;flex-shrink:0;gap:1px;';

        if (!isMobile) {
          var nowLabel = document.createElement('div');
          nowLabel.style.cssText = 'font-size:8px;font-weight:700;color:#6b6860;letter-spacing:0.03em;';
          nowLabel.textContent = 'NOW';
          nowBlock.appendChild(nowLabel);
        }

        var nowIcon = document.createElement('div');
        nowIcon.style.cssText = 'font-size:' + (isMobile ? '16px' : '20px') + ';line-height:1.2;';
        nowIcon.textContent = WMO[data.current.weather_code] || '🌡️';
        nowBlock.appendChild(nowIcon);

        var nowTemp = document.createElement('div');
        nowTemp.style.cssText =
          'font-size:' + (isMobile ? '10px' : '13px') + ';font-weight:700;color:#3d3a32;white-space:nowrap;';
        nowTemp.textContent = _wxConv(data.current.temperature_2m) + '°' + u;
        nowBlock.appendChild(nowTemp);

        strip.appendChild(nowBlock);
      }

      strip.appendChild(grid);

      /* °C/°F toggle */
      var toggle = document.createElement('div');
      toggle.style.cssText =
        'display:inline-flex;flex-direction:column;border:1px solid #e3dccd;border-radius:5px;overflow:hidden;' +
        'flex-shrink:0;align-self:stretch;margin-left:8px;';
      ['C','F'].forEach(function (t) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '°' + t;
        btn.style.cssText =
          'border:none;cursor:pointer;flex:1;padding:0 7px;font-size:10px;font-weight:600;' +
          'background:' + (u === t ? '#8a6c1a' : 'transparent') + ';' +
          'color:' + (u === t ? '#fff' : '#9a9690') + ';';
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          try { localStorage.setItem('guideTempUnit', t); } catch (ex) {}
          var old = document.getElementById('tve-wx-strip');
          if (old) old.remove();
          _renderStrip(data);
        });
        toggle.appendChild(btn);
      });
      strip.appendChild(toggle);

      titlePage.insertAdjacentElement('afterend', strip);
    }

    function _fetchForecast(lat, lon) {
      var cacheKey = 'wx-' + cityLower.replace(/\s+/g, '-');
      var hit = sessionStorage.getItem(cacheKey);
      if (hit) {
        try { _renderStrip(JSON.parse(hit)); return; } catch(e) {}
      }
      var url = 'https://api.open-meteo.com/v1/forecast' +
        '?latitude=' + lat + '&longitude=' + lon +
        '&daily=temperature_2m_max,temperature_2m_min,weathercode' +
        '&current=temperature_2m,weather_code' +
        '&timezone=auto&forecast_days=7';
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = 6000;
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var data = JSON.parse(xhr.responseText);
            try { sessionStorage.setItem(cacheKey, xhr.responseText); } catch(e) {}
            _renderStrip(data);
          } catch(e) {}
        }
      };
      xhr.send();
    }

    /* Load climate.json → find lat/lon → fetch forecast.
       Append a daily cache-buster so the browser HTTP cache never serves
       a stale version after climate.json is updated on the server. */
    var cxhr = new XMLHttpRequest();
    var _climateBust = new Date().toISOString().slice(0, 10); /* YYYY-MM-DD */
    cxhr.open('GET', base + 'assets/climate.json?d=' + _climateBust, true);
    cxhr.timeout = 6000;
    cxhr.onload = function () {
      if (cxhr.status < 200 || cxhr.status >= 300) return;
      try {
        var climate = JSON.parse(cxhr.responseText);
        var entry = null;
        for (var k in climate) {
          if (k === '_meta') continue;
          if (_normCity(k) === cityNorm) { entry = climate[k]; break; }
        }
        if (!entry || entry.lat == null || entry.lon == null) return;
        _fetchForecast(entry.lat, entry.lon);
      } catch(e) {}
    };
    cxhr.send();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectWeatherStrip);
  } else {
    _injectWeatherStrip();
  }

  /* ── Scroll-to-top FAB ──────────────────────────────────────────────────
     Fixed circle bottom-right, fades in after 300px of scroll, smooth-scrolls
     to top on click. Appears on ALL pages tall enough to scroll (> 1.5×
     viewport). On guide pages sits above day-jump (bottom offset via
     guide-style.css); on non-guide pages sits at bottom:24px (web-travel-style.css).
     Back-to-index pill is guide-only and injected separately below.

     The "tall enough" test is evaluated ON EVERY SCROLL, never once at
     injection time. Bug 2026-08-07: it used to be a one-shot `return` guard at
     DOMContentLoaded, which measured pages that build their own body from JS
     while they were still empty — When-to-Go (852px at DCL → 26,785px final,
     31 screens), Climate-Finder (1,005 → 14,066) and Budget-Guide (852 → 6,344)
     therefore never got a FAB at all, and neither did Before-You-Go or
     Sports-Calendar once a search rendered results. The button is now always
     created; it is inert until the page is genuinely both tall and scrolled,
     because its base CSS is opacity:0 + pointer-events:none until .visible. */
  function _injectScrollFab() {
    var topBtn = document.createElement('button');
    topBtn.type = 'button';
    topBtn.className = 'tve-scroll-top';
    topBtn.setAttribute('aria-label', 'Scroll to top');
    topBtn.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">' +
        '<path d="M6.5 10V3M3 6l3.5-3 3.5 3" stroke="currentColor" stroke-width="1.6"' +
        ' stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
    document.body.appendChild(topBtn);

    topBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      /* Owner rule 2026-07-28: once the reader taps ↑ to return to the top
         of the page, the #tve-back-to-guide pill has served its purpose and
         is just clutter. Hide it for the rest of this page load. Same rule
         applies to its sibling #tve-back-to-byg (Back to Before You Go). */
      var _pill = document.getElementById('tve-back-to-guide');
      if (_pill) _pill.style.display = 'none';
      var _pillByg = document.getElementById('tve-back-to-byg');
      if (_pillByg) _pillByg.style.display = 'none';
    });

    function _syncFab() {
      var tall = document.documentElement.scrollHeight > window.innerHeight * 1.5;
      topBtn.classList.toggle('visible', tall && window.scrollY > 300);
    }
    window.addEventListener('scroll', _syncFab, { passive: true });
    window.addEventListener('resize', _syncFab, { passive: true });
    _syncFab();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectScrollFab);
  } else {
    _injectScrollFab();
  }

  /* ── Best-Of country jump — floating pill + overlay (MOBILE ONLY) ─────────
     Best-Of pages already ship a country filter: the #regionJump disclosure
     ("Filter by country") in the page's own controls block, populated and
     wired by each page's inline script. It is position:relative, so it is
     off-screen after one swipe — on Best-Ultra-Luxurious-Resorts that leaves
     96 screens and 48 country sections with no way to filter or to tell which
     country you are in. Guides solved the identical problem with the fixed
     .day-jump-btn pill; this is that pattern applied to Best-Of.

     Zero duplicated filter logic: the overlay rows forward to .click() on the
     matching hidden #regionJumpList item, so the page's own handler does the
     filtering exactly as it does from the dropdown. The pill label mirrors
     #regionJumpLabel via MutationObserver, so filtering from either surface
     keeps both in sync.

     Mobile-only (@media min-width:601px hides it) — on desktop the controls
     block stays within easy reach and the scrollbar gives position feedback. */
  function _injectBestOfJump() {
    var jump = document.getElementById('regionJump');
    var list = document.getElementById('regionJumpList');
    var label = document.getElementById('regionJumpLabel');
    if (!jump || !list || !label) return;
    var items = [].slice.call(list.querySelectorAll('.days-jump-item'));
    if (items.length < 3) return;   /* "All countries" + at least 2 real ones */
    var grid = document.querySelector('.showcase-grid');

    var css = document.createElement('style');
    css.textContent =
      '#tve-bo-jump{position:fixed;bottom:calc(20px + env(safe-area-inset-bottom,0px));' +
      'right:16px;z-index:1400;display:inline-flex;align-items:center;gap:6px;' +
      /* 28px / 14px radius — the size EVERY gold floating pill uses
         (#tve-back-to-guide, #tve-back-to-byg, #tve-nav-back, #tve-map-back
         and .day-jump-btn at its mobile breakpoint). The family ran at 34/17
         until 2026-08-09, when the owner cut it a size ("all these pills are
         too big"); before that this pill was authored at 36/18 and the drift
         hid behind mobile.css § 7's 40px tap-target floor, which flattened
         every one of them to 40px. Do not re-split them. */
      'height:28px;padding:0 11px;background:#fff;border:1.5px solid #c8a44a;' +
      'border-radius:14px;font-size:12px;font-weight:700;letter-spacing:.03em;' +
      'color:#8a6c1a;cursor:pointer;font-family:inherit;-webkit-appearance:none;' +
      'box-shadow:0 2px 10px rgba(0,0,0,.14);max-width:64vw;white-space:nowrap;' +
      'overflow:hidden;text-overflow:ellipsis;' +
      'transition:color .15s,border-color .15s,box-shadow .15s}' +
      '#tve-bo-jump:hover{color:#b85c2a;border-color:#b85c2a;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.18)}' +
      /* Lift the scroll-top FAB clear of the pill, same as guide pages do for
         .day-jump-btn (guide-style.css). 20 (the pill's own bottom) + 28 (its
         height) + 12px gap = 60. This read 72 while mobile.css § 7's 40px
         tap-target floor was inflating the pill, then 66 at the family's old
         34px height; the floor no longer applies to the floating family (owner
         rule 2026-08-09, mobile.css § FLOATING CONTROL ROW), so the arithmetic
         uses the pill's real height. Re-tune it whenever that height moves. */
      'body.tve-has-bo-jump .tve-scroll-top{' +
      'bottom:calc(60px + env(safe-area-inset-bottom,0px))}' +
      '#tve-bo-ov{position:fixed;inset:0;z-index:1500;display:none;' +
      'align-items:center;justify-content:center;background:rgba(40,36,30,.42)}' +
      '#tve-bo-ov.open{display:flex}' +
      '#tve-bo-card{width:92vw;max-width:420px;max-height:70vh;display:flex;' +
      'flex-direction:column;background:#fff;border:1.5px solid #c8a44a;' +
      'border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.28);overflow:hidden}' +
      '#tve-bo-head{display:flex;align-items:center;gap:8px;padding:12px 14px;' +
      'border-bottom:1px solid #e4ddd4;background:#fdf8f0}' +
      '#tve-bo-title{flex:1;font-size:13px;font-weight:700;letter-spacing:.06em;' +
      'text-transform:uppercase;color:#8a6c1a}' +
      '#tve-bo-x{background:none;border:none;font-size:17px;line-height:1;' +
      'color:#8a8578;cursor:pointer;padding:2px 4px;font-family:inherit;' +
      '-webkit-appearance:none}' +
      '#tve-bo-x:hover{color:#3d3a32}' +
      '#tve-bo-rows{overflow-y:auto;-webkit-overflow-scrolling:touch}' +
      '.tve-bo-row{display:block;width:100%;text-align:left;background:none;' +
      'border:none;border-bottom:1px solid #eee8e0;padding:12px 16px;' +
      'font-size:14px;color:#3d3a32;font-family:inherit;cursor:pointer;' +
      '-webkit-appearance:none}' +
      '.tve-bo-row:last-child{border-bottom:none}' +
      '.tve-bo-row--on{background:rgba(200,164,74,.10);color:#7a3b1e;font-weight:700}' +
      'body.tve-ham-open #tve-bo-jump{display:none!important}' +
      '@media(min-width:601px){#tve-bo-jump,#tve-bo-ov{display:none!important}}';
    document.head.appendChild(css);

    var pill = document.createElement('button');
    pill.type = 'button';
    pill.id = 'tve-bo-jump';
    pill.setAttribute('aria-label', 'Filter by country');
    pill.setAttribute('aria-expanded', 'false');

    var ov = document.createElement('div');
    ov.id = 'tve-bo-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Filter by country');

    var card = document.createElement('div');
    card.id = 'tve-bo-card';
    card.addEventListener('click', function (e) { e.stopPropagation(); });

    var head = document.createElement('div');
    head.id = 'tve-bo-head';
    var title = document.createElement('div');
    title.id = 'tve-bo-title';
    title.textContent = 'Filter by country';
    var xBtn = document.createElement('button');
    xBtn.type = 'button';
    xBtn.id = 'tve-bo-x';
    xBtn.textContent = '✕';
    xBtn.setAttribute('aria-label', 'Close');
    head.appendChild(title);
    head.appendChild(xBtn);
    card.appendChild(head);

    var rows = document.createElement('div');
    rows.id = 'tve-bo-rows';
    var rowEls = [];
    items.forEach(function (src) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'tve-bo-row';
      row.textContent = src.textContent;
      row.addEventListener('click', function () {
        /* Forward to the page's own handler — no duplicated filter logic. */
        src.click();
        closeOv();
        /* Land on the grid so the filtered result is the first thing seen. */
        var target = grid || document.body;
        var top = target.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top: top < 0 ? 0 : top, behavior: 'smooth' });
      });
      rows.appendChild(row);
      rowEls.push(row);
    });
    card.appendChild(rows);
    ov.appendChild(card);

    /* Pill label mirrors the dropdown's label; the country count is the
       resting state, matching the guide pill's "N days".

       "Is anything filtered?" is read off #regionJumpLabel, never off a data
       attribute or a row's .on class — the per-page filter scripts ship in
       THREE variants (32 Best-Of pages key rows off data-region via innerHTML,
       Best-Museums off data-type, Best-Unique-Hotels builds rows with
       createElement and never marks the reset row .on until the reader
       filters something). All three agree on exactly one thing:
       `label.textContent = active || defaultLabel`. So the label is the only
       reliable cross-fleet signal. Row highlighting still uses .on, which is
       correct wherever the variant sets it and simply shows no highlight at
       rest where it does not. */
    var countLabel = (items.length - 1) + ' countries';
    var defaultLabel = label.textContent.trim();
    function syncLabel() {
      var cur = label.textContent.trim();
      pill.textContent = '🌍 ' + (cur === defaultLabel ? countLabel : cur);
      rowEls.forEach(function (r, i) {
        r.classList.toggle('tve-bo-row--on', items[i].classList.contains('on'));
      });
    }
    var mo = new MutationObserver(syncLabel);
    mo.observe(list, { subtree: true, attributes: true, attributeFilter: ['class'] });
    mo.observe(label, { subtree: true, childList: true, characterData: true });
    syncLabel();

    function openOv() {
      ov.classList.add('open');
      pill.setAttribute('aria-expanded', 'true');
      var on = rows.querySelector('.tve-bo-row--on');
      if (on) on.scrollIntoView({ block: 'center' });
    }
    function closeOv() {
      ov.classList.remove('open');
      pill.setAttribute('aria-expanded', 'false');
    }
    pill.addEventListener('click', function (e) {
      e.stopPropagation();
      ov.classList.contains('open') ? closeOv() : openOv();
    });
    xBtn.addEventListener('click', closeOv);
    ov.addEventListener('click', closeOv);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeOv();
    });

    document.body.appendChild(pill);
    document.body.appendChild(ov);
    document.body.classList.add('tve-has-bo-jump');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectBestOfJump);
  } else {
    _injectBestOfJump();
  }

  /* ── Map pages: "← All Guides" pill (MOBILE ONLY) ─────────────────────────
     World-Map and the seven region maps fill the viewport with Leaflet and
     ship exactly one on-screen control between them (#visited-pill-mobile,
     World-Map only). Leaving the map relied entirely on the branch in
     toggleHamMenu() that turns the hamburger's CLOSE tap into "go to the
     Guides Index" — correct behaviour, but nothing on screen says so, and a
     reader has no reason to expect a close button to navigate. This makes
     that exact destination visible, using the same fixed-pill family as
     #tve-back-to-guide / #tve-back-to-byg.

     Per-guide stops-maps are excluded: they already carry both the "‹ City"
     back-strip and the #tve-nav-back history pill.

     Bottom-LEFT so it clears #visited-pill-mobile, which is centred
     (left:50%, translateX(-50%), ~110px wide) — no overlap at 393px. */
  function _injectMapBackPill() {
    if (!document.getElementById('map')) return;
    if (/-stops-map\.html$/.test(location.pathname)) return;
    /* World-Map.html?embed=1 strips the toolbar and the visited pill for
       embedding; this pill is chrome too, so it goes with them. */
    if (location.search.indexOf('embed=1') !== -1) return;
    /* ONE back control per screen (owner rule 2026-08-09). This pill and
       #tve-back-to-guide both seat at bottom:24px / left:16px, so a reader who
       reached World-Map FROM a guide got two of them stacked exactly on top of
       each other — same z-index, so "← All Guides" simply covered "← Abu Dhabi"
       and the contextual return path was unreachable. It is the same principle
       that already excludes per-guide stops-maps two paragraphs up: where the
       page already carries a back control, this one stands down.

       This pill yields rather than the other, on both counts that matter:
       "← {City}" is contextual (it returns the reader to the exact guide card
       they left from, which nothing else on the page offers) while "← All
       Guides" duplicates a destination the hamburger's CLOSE tap already
       reaches; and owner rule 2026-08-06 requires every page reachable from a
       guide to show the back pill.

       Reading the DOM is safe here, not a race: injectBackToGuidePill() is an
       IIFE defined ~5,300 lines above. On a parsed document its build() has
       already run synchronously before this call; while loading, its
       DOMContentLoaded listener was registered first and fires first. Either
       way the pill is in the DOM by now. #tve-back-to-byg cannot currently
       reach a map page (World-Map is not in pagesLinkedFromByg) but is checked
       too, so the family stays one rule rather than two.
       Locked by brain_check.check_map_back_pill. */
    if (document.getElementById('tve-back-to-guide') ||
        document.getElementById('tve-back-to-byg')) return;

    var css = document.createElement('style');
    css.textContent =
      '#tve-map-back{position:fixed;bottom:calc(24px + env(safe-area-inset-bottom,0px));' +
      'left:16px;z-index:1400;display:inline-flex;align-items:center;height:28px;' +
      'padding:0 11px;background:#fff;border:1.5px solid #c8a44a;border-radius:14px;' +
      'font-size:12px;font-weight:700;letter-spacing:.03em;color:#8a6c1a;' +
      'text-decoration:none;box-shadow:0 2px 10px rgba(0,0,0,.14);' +
      'white-space:nowrap;transition:color .15s,border-color .15s,box-shadow .15s}' +
      '#tve-map-back:hover{color:#b85c2a;border-color:#b85c2a;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.18);text-decoration:none}' +
      'body.tve-ham-open #tve-map-back{display:none!important}' +
      '@media(min-width:601px){#tve-map-back{display:none!important}}';
    document.head.appendChild(css);

    var pill = document.createElement('a');
    pill.id = 'tve-map-back';
    pill.href = base + 'index.html';
    pill.textContent = '← All Guides';
    document.body.appendChild(pill);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectMapBackPill);
  } else {
    _injectMapBackPill();
  }

  /* ── Share-this-stop button — guide pages only ───────────────────────────
     Injects a share-icon button into each .stop-header so readers can share
     a single stop via the Web Share API (mobile) or clipboard copy (desktop).
     Payload: stop name + address text + deep-link URL with #stop-{slug}.
     Stop blocks without an id get one assigned so the anchor works.
     Zero guide HTML changes — entirely injected from toolbar.js. */
  function _injectShareStopButtons() {
    if (!isRealGuide) return;

    var _shareSvg =
      '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">' +
        '<circle cx="10.5" cy="2.5" r="1.5" stroke="currentColor" stroke-width="1.4"/>' +
        '<circle cx="10.5" cy="10.5" r="1.5" stroke="currentColor" stroke-width="1.4"/>' +
        '<circle cx="2.5" cy="6.5" r="1.5" stroke="currentColor" stroke-width="1.4"/>' +
        '<line x1="3.9" y1="5.7" x2="9.1" y2="3.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
        '<line x1="3.9" y1="7.3" x2="9.1" y2="9.7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
      '</svg>';
    var _checkSvg =
      '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
        '<path d="M2 6l3 3 5-5" stroke="#b85c2a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';

    var _ssCss = document.createElement('style');
    _ssCss.id = 'tve-share-stop-css';
    _ssCss.textContent =
      '.tve-share-stop-btn{background:none;border:none;cursor:pointer;' +
      'color:#a8a09a;padding:0;margin-left:12px;line-height:1;vertical-align:middle;' +
      'display:inline-flex;align-items:center;flex-shrink:0;}' +
      '.tve-share-stop-btn:hover,.tve-share-stop-btn:focus-visible{color:#b85c2a;}' +
      '.tve-share-stop-btn:focus-visible{outline:2px solid #b85c2a;' +
      'outline-offset:2px;border-radius:3px;}';
    (document.head || document.documentElement).appendChild(_ssCss);

    function _setup() {
      [].forEach.call(document.querySelectorAll('.stop-block'), function(block) {
        var nameEl = block.querySelector('.stop-name');
        if (!nameEl) return;
        var stopName = nameEl.textContent.trim();

        var addrText = '';
        [].forEach.call(block.querySelectorAll('.stop-row'), function(row) {
          if (addrText) return;
          if (row.textContent.indexOf('📍') >= 0) {
            var a = row.querySelector('a');
            if (a) addrText = a.textContent.trim();
          }
        });

        if (!block.id) {
          var slug = stopName.toLowerCase()
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          block.id = 'stop-' + (slug || String(Math.random()).slice(2, 8));
        }
        var blockId = block.id;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tve-share-stop-btn';
        btn.setAttribute('aria-label', 'Share ' + stopName);
        btn.setAttribute('title', 'Share this stop');
        btn.innerHTML = _shareSvg;

        btn.addEventListener('click', function() {
          var url = window.location.href.replace(/#.*$/, '') + '#' + blockId;
          var shareText = stopName + (addrText ? ' — ' + addrText : '');
          if (navigator.share) {
            navigator.share({ title: stopName, text: shareText, url: url }).catch(function() {});
            return;
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareText + '\n' + url).then(function() {
              btn.innerHTML = _checkSvg;
              setTimeout(function() { btn.innerHTML = _shareSvg; }, 1600);
            }).catch(function() {});
          }
        });

        var header = block.querySelector('.stop-header');
        if (header) header.appendChild(btn);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _setup);
    } else {
      _setup();
    }
  }
  _injectShareStopButtons();

  /* ── Stop wishlist — cross-guide bookmark feature ────────────────────────
     Injects a ★ star button into each .stop-header (appended after the share
     button). Saved stops persist to localStorage['tve_wishlist'] as an array
     of {stopId, guide, stopName, day, href} objects. A floating chip at
     bottom-right (above the scroll-top FAB) expands a panel showing all saved
     stops grouped by guide — cross-trip planning tool.
     Zero guide HTML changes — entirely injected from toolbar.js. */
  function _injectWishlistButtons() {
    if (!isRealGuide) return;

    var KEY         = 'tve_wishlist';
    var STAR_COLOR  = '#c48f3e';

    /* ── Load / save ─────────────────────────────────────────────────────── */
    function _load() {
      try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch(e) { return []; }
    }
    function _save(arr) {
      try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch(e) {}
    }
    function _indexBy(arr, stopId) {
      for (var i = 0; i < arr.length; i++) { if (arr[i].stopId === stopId) return i; }
      return -1;
    }
    function _toTitleCase(str) {
      return str.toLowerCase().replace(/(?:^|\s)\S/g, function(c) { return c.toUpperCase(); });
    }

    /* ── CSS ─────────────────────────────────────────────────────────────── */
    var _wlCss = document.createElement('style');
    _wlCss.id  = 'tve-wishlist-css';
    _wlCss.textContent =
      /* Star button in stop-header */
      '.tve-wl-btn{background:none;border:none;cursor:pointer;color:#a8a09a;padding:0;margin-left:8px;' +
      'line-height:1;display:inline-flex;align-items:center;flex-shrink:0;' +
      'transition:color .15s;font-family:inherit;}' +
      '.tve-wl-btn:hover{color:' + STAR_COLOR + ';}' +
      '.tve-wl-btn.tve-wl-saved{color:' + STAR_COLOR + ';}' +
      '.tve-wl-btn:focus-visible{outline:2px solid ' + STAR_COLOR + ';outline-offset:2px;border-radius:3px;}' +

      /* Floating FAB — sits above the scroll-top FAB (bottom:68px+36px+12px=116px) */
      '#tve-wl-fab{position:fixed;bottom:116px;right:24px;z-index:1398;display:none;align-items:center;' +
      'gap:6px;background:#231f1b;color:#f6f2ec;border:none;border-radius:20px;' +
      'padding:8px 13px 8px 10px;font-size:13px;font-weight:600;cursor:pointer;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.22);font-family:inherit;white-space:nowrap;' +
      'transition:transform .12s,box-shadow .12s;}' +
      '#tve-wl-fab:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,0,0,.28);}' +
      '#tve-wl-fab.tve-wl-fab-on{display:inline-flex;}' +
      '#tve-wl-fab-cnt{background:' + STAR_COLOR + ';color:#7a3b1e;border-radius:10px;' +
      'font-size:11px;font-weight:700;padding:0 6px;min-width:18px;text-align:center;line-height:18px;}' +

      /* Panel — anchored above the FAB */
      '#tve-wl-panel{position:fixed;bottom:168px;right:24px;z-index:1397;width:296px;' +
      'max-width:calc(100vw - 32px);background:#fff;border:1px solid #e4ddd4;border-radius:10px;' +
      'box-shadow:0 8px 32px rgba(0,0,0,.16);overflow:hidden;display:none;}' +
      '#tve-wl-panel.tve-wl-open{display:block;}' +
      '.tve-wl-phdr{display:flex;align-items:center;padding:11px 14px;' +
      'background:#f9f5ef;border-bottom:1px solid #e4ddd4;gap:8px;}' +
      '.tve-wl-ptitle{font-size:13px;font-weight:700;color:#231f1b;flex:1;font-family:inherit;}' +
      '.tve-wl-pclear{font-size:11px;color:#a8a09a;background:none;border:none;cursor:pointer;' +
      'padding:2px 4px;border-radius:3px;font-family:inherit;transition:color .12s;}' +
      '.tve-wl-pclear:hover{color:#b85c2a;}' +
      '.tve-wl-pclose{background:none;border:none;cursor:pointer;color:#a8a09a;' +
      'display:flex;align-items:center;padding:2px;margin-left:2px;border-radius:3px;}' +
      '.tve-wl-pclose:hover{color:#231f1b;}' +
      '.tve-wl-pbody{max-height:300px;overflow-y:auto;}' +
      '.tve-wl-pguide{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;' +
      'color:#a8a09a;padding:7px 14px 5px;background:#f9f5ef;' +
      'border-bottom:1px solid #e4ddd4;border-top:1px solid #e4ddd4;}' +
      '.tve-wl-prow{display:flex;align-items:center;padding:8px 14px;gap:9px;' +
      'border-bottom:1px solid #efe9e0;text-decoration:none;cursor:pointer;}' +
      '.tve-wl-prow:last-child{border-bottom:none;}' +
      '.tve-wl-prow:hover{background:#f9f5ef;}' +
      '.tve-wl-prow-info{flex:1;min-width:0;}' +
      '.tve-wl-prow-name{font-size:13px;font-weight:500;color:#231f1b;' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:inherit;}' +
      '.tve-wl-prow-meta{font-size:11px;color:#9a908a;margin-top:1px;font-family:inherit;}' +
      '.tve-wl-prow-rm{background:none;border:none;cursor:pointer;color:#c0b8b0;' +
      'display:flex;align-items:center;padding:2px;flex-shrink:0;border-radius:3px;transition:color .12s;}' +
      '.tve-wl-prow-rm:hover{color:#b85c2a;}' +
      '.tve-wl-pfooter{display:flex;align-items:center;gap:8px;padding:9px 14px;' +
      'border-top:1px solid #e4ddd4;background:#f9f5ef;}' +
      '.tve-wl-copy{font-size:12px;font-weight:600;color:#b85c2a;background:none;' +
      'border:1px solid #b85c2a;border-radius:5px;padding:4px 11px;cursor:pointer;' +
      'font-family:inherit;transition:background .12s,color .12s;}' +
      '.tve-wl-copy:hover{background:#b85c2a;color:#7a3b1e;}' +
      '.tve-wl-empty{padding:24px 14px;text-align:center;color:#a8a09a;' +
      'font-size:13px;line-height:1.6;font-family:inherit;}' +
      /* Mobile: align with scroll-top FAB (bottom:62px+36px+10px=108px) */
      '@media(max-width:600px){' +
      '#tve-wl-fab{bottom:108px;right:16px;}' +
      '#tve-wl-panel{bottom:160px;right:16px;}' +
      '}';
    (document.head || document.documentElement).appendChild(_wlCss);

    /* ── SVG templates ───────────────────────────────────────────────────── */
    var _starOut =
      '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
        '<path d="M7 1.5l1.55 3.14 3.47.5-2.51 2.45.59 3.46L7 9.27l-3.1 1.63.59-3.46L2 4.99l3.47-.5z"' +
        ' stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>' +
      '</svg>';
    var _starFill =
      '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
        '<path d="M7 1.5l1.55 3.14 3.47.5-2.51 2.45.59 3.46L7 9.27l-3.1 1.63.59-3.46L2 4.99l3.47-.5z"' +
        ' stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="currentColor"/>' +
      '</svg>';
    var _closeSvg =
      '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">' +
        '<line x1="3" y1="3" x2="10" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        '<line x1="10" y1="3" x2="3" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';

    /* ── Build FAB ───────────────────────────────────────────────────────── */
    var fab = document.createElement('button');
    fab.type = 'button';
    fab.id   = 'tve-wl-fab';
    fab.setAttribute('aria-label', 'Open wishlist');

    var fabStar = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    fabStar.setAttribute('width', '13'); fabStar.setAttribute('height', '13');
    fabStar.setAttribute('viewBox', '0 0 14 14'); fabStar.setAttribute('fill', 'none');
    fabStar.setAttribute('aria-hidden', 'true');
    var fabStarPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    fabStarPath.setAttribute('d', 'M7 1.5l1.55 3.14 3.47.5-2.51 2.45.59 3.46L7 9.27l-3.1 1.63.59-3.46L2 4.99l3.47-.5z');
    fabStarPath.setAttribute('fill', STAR_COLOR);
    fabStarPath.setAttribute('stroke', STAR_COLOR);
    fabStarPath.setAttribute('stroke-width', '0.5');
    fabStar.appendChild(fabStarPath);

    var fabLabel = document.createTextNode(' Wishlist ');
    var fabCnt   = document.createElement('span');
    fabCnt.id    = 'tve-wl-fab-cnt';
    fab.appendChild(fabStar);
    fab.appendChild(fabLabel);
    fab.appendChild(fabCnt);
    document.body.appendChild(fab);

    /* ── Build panel ─────────────────────────────────────────────────────── */
    var panel = document.createElement('div');
    panel.id  = 'tve-wl-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Wishlist panel');

    var phdr   = document.createElement('div');  phdr.className = 'tve-wl-phdr';
    var ptitle = document.createElement('span'); ptitle.className = 'tve-wl-ptitle';
    var pclear = document.createElement('button'); pclear.type = 'button'; pclear.className = 'tve-wl-pclear'; pclear.textContent = 'Clear all';
    var pclose = document.createElement('button'); pclose.type = 'button'; pclose.className = 'tve-wl-pclose'; pclose.setAttribute('aria-label', 'Close wishlist'); pclose.innerHTML = _closeSvg;
    phdr.appendChild(ptitle); phdr.appendChild(pclear); phdr.appendChild(pclose);

    var pbody = document.createElement('div'); pbody.className = 'tve-wl-pbody';

    var pfooter = document.createElement('div'); pfooter.className = 'tve-wl-pfooter';
    var pcopy   = document.createElement('button'); pcopy.type = 'button'; pcopy.className = 'tve-wl-copy'; pcopy.textContent = 'Copy list';
    pfooter.appendChild(pcopy);

    panel.appendChild(phdr); panel.appendChild(pbody); panel.appendChild(pfooter);
    document.body.appendChild(panel);

    /* ── Render panel body from localStorage ─────────────────────────────── */
    function _renderPanel() {
      var arr = _load();
      var n   = arr.length;
      ptitle.textContent  = n === 1 ? 'Wishlist · 1 stop' : 'Wishlist · ' + n + ' stops';
      fabCnt.textContent  = n;
      fab.classList.toggle('tve-wl-fab-on', n > 0);

      pbody.innerHTML = '';
      if (n === 0) {
        var emptyDiv = document.createElement('div');
        emptyDiv.className = 'tve-wl-empty';
        emptyDiv.textContent = 'Tap a stop\'s ★ to save it here. Saves appear grouped by guide.';
        pbody.appendChild(emptyDiv);
        return;
      }

      /* Group by guide, preserve insertion order for headers, alpha-sort the groups */
      var byGuide = {};
      var guideOrder = [];
      arr.forEach(function(e) {
        var g = e.guide || 'Unknown';
        if (!byGuide[g]) { byGuide[g] = []; guideOrder.push(g); }
        byGuide[g].push(e);
      });
      guideOrder.sort();

      guideOrder.forEach(function(gName) {
        var ghdr = document.createElement('div');
        ghdr.className = 'tve-wl-pguide';
        ghdr.textContent = gName;
        pbody.appendChild(ghdr);

        byGuide[gName].forEach(function(entry) {
          var row = document.createElement('a');
          row.className = 'tve-wl-prow';
          if (entry.href) { row.href = entry.href; }

          /* Amber star icon */
          var rowStar = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          rowStar.setAttribute('width', '12'); rowStar.setAttribute('height', '12');
          rowStar.setAttribute('viewBox', '0 0 14 14'); rowStar.setAttribute('fill', 'none');
          rowStar.setAttribute('aria-hidden', 'true');
          rowStar.style.flexShrink = '0'; rowStar.style.marginTop = '1px';
          var rsp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          rsp.setAttribute('d', 'M7 1.5l1.55 3.14 3.47.5-2.51 2.45.59 3.46L7 9.27l-3.1 1.63.59-3.46L2 4.99l3.47-.5z');
          rsp.setAttribute('fill', STAR_COLOR); rsp.setAttribute('stroke', STAR_COLOR); rsp.setAttribute('stroke-width', '0.5');
          rowStar.appendChild(rsp);

          var info    = document.createElement('div'); info.className = 'tve-wl-prow-info';
          var nameDiv = document.createElement('div'); nameDiv.className = 'tve-wl-prow-name'; nameDiv.textContent = entry.stopName || '';
          var metaDiv = document.createElement('div'); metaDiv.className = 'tve-wl-prow-meta'; metaDiv.textContent = entry.day || '';
          info.appendChild(nameDiv); info.appendChild(metaDiv);

          var rmBtn = document.createElement('button');
          rmBtn.type = 'button'; rmBtn.className = 'tve-wl-prow-rm';
          rmBtn.setAttribute('aria-label', 'Remove ' + (entry.stopName || '') + ' from wishlist');
          rmBtn.innerHTML = _closeSvg;
          rmBtn.dataset.stopId = entry.stopId;
          rmBtn.addEventListener('click', function(e) {
            e.preventDefault(); e.stopPropagation();
            _removeEntry(rmBtn.dataset.stopId);
          });

          row.appendChild(rowStar); row.appendChild(info); row.appendChild(rmBtn);
          pbody.appendChild(row);
        });
      });
    }

    /* ── Add / remove entries ────────────────────────────────────────────── */
    function _addEntry(stopId, guide, stopName, day, href) {
      var arr = _load();
      if (_indexBy(arr, stopId) >= 0) return;
      arr.push({ stopId: stopId, guide: guide, stopName: stopName, day: day, href: href });
      _save(arr); _renderPanel();
    }

    function _removeEntry(stopId) {
      var arr = _load();
      var idx = _indexBy(arr, stopId);
      if (idx < 0) return;
      arr.splice(idx, 1);
      _save(arr);
      var btn = document.querySelector('.tve-wl-btn[data-stop-id="' + stopId + '"]');
      if (btn) {
        btn.classList.remove('tve-wl-saved');
        btn.innerHTML = _starOut;
        btn.setAttribute('title', 'Save to wishlist');
      }
      _renderPanel();
    }

    /* ── FAB / panel toggle ──────────────────────────────────────────────── */
    var _panelOpen = false;
    function _openPanel()  { _panelOpen = true;  panel.classList.add('tve-wl-open'); }
    function _closePanel() { _panelOpen = false; panel.classList.remove('tve-wl-open'); }

    fab.addEventListener('click', function() {
      if (_panelOpen) { _closePanel(); } else { _openPanel(); }
    });
    pclose.addEventListener('click', _closePanel);
    document.addEventListener('click', function(e) {
      if (_panelOpen && !panel.contains(e.target) && !fab.contains(e.target)) { _closePanel(); }
    });

    pclear.addEventListener('click', function() {
      _save([]);
      [].forEach.call(document.querySelectorAll('.tve-wl-btn.tve-wl-saved'), function(b) {
        b.classList.remove('tve-wl-saved');
        b.innerHTML = _starOut;
        b.setAttribute('title', 'Save to wishlist');
      });
      _renderPanel();
    });

    pcopy.addEventListener('click', function() {
      var arr = _load();
      if (!arr.length) return;
      var byGuide = {}, guideOrder = [];
      arr.forEach(function(e) {
        var g = e.guide || 'Unknown';
        if (!byGuide[g]) { byGuide[g] = []; guideOrder.push(g); }
        byGuide[g].push(e);
      });
      guideOrder.sort();
      var lines = [];
      guideOrder.forEach(function(g) {
        lines.push(g + ':');
        byGuide[g].forEach(function(e) {
          lines.push('  · ' + e.stopName + (e.day ? ' (' + e.day + ')' : '') + (e.href ? ' — ' + e.href : ''));
        });
      });
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(lines.join('\n')).then(function() {
          var orig = pcopy.textContent;
          pcopy.textContent = '✓ Copied';
          setTimeout(function() { pcopy.textContent = orig; }, 1800);
        }).catch(function() {});
      }
    });

    /* ── Inject star buttons into every .stop-header ─────────────────────── */
    function _setup() {
      var arr      = _load();
      var cityEl   = document.querySelector('.title-city');
      var guideName = document.title || (cityEl ? _toTitleCase(cityEl.textContent.trim()) : '');

      [].forEach.call(document.querySelectorAll('.stop-block'), function(sb) {
        var nameEl = sb.querySelector('.stop-name');
        if (!nameEl) return;
        var stopName = nameEl.textContent.trim();

        /* Use ID already assigned by the share-button injector; assign one if missing */
        if (!sb.id) {
          var slug = stopName.toLowerCase()
            .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          sb.id = 'stop-wl-' + (slug || String(Math.random()).slice(2, 8));
        }
        var stopId = sb.id;

        /* Day label — walk up to the parent .day-block's .day-header */
        var dayBlock = sb.parentNode;
        while (dayBlock && !dayBlock.classList.contains('day-block')) { dayBlock = dayBlock.parentNode; }
        var dayHdr = dayBlock && dayBlock.querySelector('.day-header');
        var day    = dayHdr ? dayHdr.textContent.trim() : '';

        var href    = location.href.replace(/#.*$/, '') + '#' + stopId;
        var isSaved = _indexBy(arr, stopId) >= 0;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tve-wl-btn' + (isSaved ? ' tve-wl-saved' : '');
        btn.dataset.stopId = stopId;
        btn.setAttribute('title', isSaved ? 'Remove from wishlist' : 'Save to wishlist');
        btn.setAttribute('aria-label', stopName + (isSaved ? ' — remove from wishlist' : ' — save to wishlist'));
        btn.innerHTML = isSaved ? _starFill : _starOut;

        btn.addEventListener('click', function() {
          var saved = btn.classList.contains('tve-wl-saved');
          if (saved) {
            btn.classList.remove('tve-wl-saved');
            btn.innerHTML = _starOut;
            btn.setAttribute('title', 'Save to wishlist');
            btn.setAttribute('aria-label', stopName + ' — save to wishlist');
            _removeEntry(stopId);
          } else {
            btn.classList.add('tve-wl-saved');
            btn.innerHTML = _starFill;
            btn.setAttribute('title', 'Remove from wishlist');
            btn.setAttribute('aria-label', stopName + ' — remove from wishlist');
            btn.style.transform = 'scale(1.35)';
            setTimeout(function() { btn.style.transform = ''; }, 200);
            _addEntry(stopId, guideName, stopName, day, href);
          }
        });

        var header = sb.querySelector('.stop-header');
        if (header) header.appendChild(btn);
      });

      _renderPanel();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _setup);
    } else {
      _setup();
    }
  }
  _injectWishlistButtons();

  /* ── My Trip Notes — private per-stop annotations ────────────────────────
     A ✎ button in each .stop-header opens a one-line input under the stop
     name; the note saves to localStorage['tve-notes-{cityFolder}'] as a
     { stopId: text } map — guide slug + stop, exactly like the tve-stops-
     {folder} mark-stops store next to it. Emptying the input deletes the note.

     Every note in the guide also collects into a "MY TRIP NOTES" card injected
     above TRIP OVERVIEW. The card is hidden until the reader writes their
     first note, so a guide nobody has annotated looks untouched. Its 🖨 button
     prints the notes list alone (hides every other body-level child while the
     print dialog is open), giving the one-page take-with-you list.

     Per-guide, not cross-guide: the card sits inside one guide and reads that
     guide's store. The cross-guide surface is the wishlist above.
     No account, no server, pure client-side. Zero guide HTML changes. */
  function _injectStopNotes() {
    if (!isRealGuide) return;

    var parts = location.pathname.split('/');
    var gi = parts.indexOf('Guides');
    if (gi < 0 || !parts[gi + 1]) return;
    var storageKey = 'tve-notes-' + parts[gi + 1].toLowerCase();
    var MAXLEN     = 140;

    /* ── Load / save ─────────────────────────────────────────────────────── */
    function _load() {
      try {
        var o = JSON.parse(localStorage.getItem(storageKey) || '{}');
        return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
      } catch (e) { return {}; }
    }
    function _save(map) {
      try { localStorage.setItem(storageKey, JSON.stringify(map)); } catch (e) {}
    }
    var notes = _load();
    function _count() { return Object.keys(notes).length; }

    /* ── SVG ─────────────────────────────────────────────────────────────── */
    var _pencilSvg =
      '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">' +
        '<path d="M8.9 1.6l2.5 2.5-6.6 6.6-3.1.6.6-3.1z" stroke="currentColor"' +
        ' stroke-width="1.3" stroke-linejoin="round"/>' +
        '<line x1="7.7" y1="2.8" x2="10.2" y2="5.3" stroke="currentColor" stroke-width="1.3"/>' +
      '</svg>';
    var _pencilFillSvg =
      '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">' +
        '<path d="M8.9 1.6l2.5 2.5-6.6 6.6-3.1.6.6-3.1z" stroke="currentColor"' +
        ' stroke-width="1.3" stroke-linejoin="round" fill="currentColor"/>' +
      '</svg>';

    /* ── CSS ─────────────────────────────────────────────────────────────── */
    var _nCss = document.createElement('style');
    _nCss.id  = 'tve-notes-css';
    _nCss.textContent =
      /* Pencil button in stop-header — sits last, after share and ★ */
      '.tve-note-btn{background:none;border:none;cursor:pointer;color:#a8a09a;padding:0;' +
      'margin-left:8px;line-height:1;display:inline-flex;align-items:center;flex-shrink:0;' +
      'transition:color .15s;font-family:inherit;}' +
      '.tve-note-btn:hover{color:#b85c2a;}' +
      '.tve-note-btn.tve-note-has{color:#b85c2a;}' +
      '.tve-note-btn:focus-visible{outline:2px solid #b85c2a;outline-offset:2px;border-radius:3px;}' +

      /* Saved note line under the stop header */
      '.tve-note-saved{display:none;align-items:flex-start;gap:7px;margin:8px 0 0;' +
      'padding:7px 11px;background:var(--c-next-bg,#f5f0e6);' +
      'border-left:3px solid #b85c2a;border-radius:0 5px 5px 0;' +
      'font-size:13px;line-height:1.5;color:var(--c-text-primary,#3d3a32);' +
      'font-family:inherit;cursor:pointer;}' +
      '.tve-note-saved.tve-note-on{display:flex;}' +
      '.tve-note-saved:hover{background:var(--c-warm-bg,#fdf8f0);}' +
      '.tve-note-saved-txt{flex:1;min-width:0;overflow-wrap:anywhere;}' +
      '.tve-note-saved-tag{font-size:10px;font-weight:700;letter-spacing:.09em;' +
      'text-transform:uppercase;color:#b85c2a;flex-shrink:0;padding-top:2px;}' +

      /* Inline editor */
      '.tve-note-edit{display:none;align-items:center;gap:7px;margin:8px 0 0;}' +
      '.tve-note-edit.tve-note-on{display:flex;}' +
      '.tve-note-input{flex:1;min-width:0;font-family:inherit;font-size:13px;' +
      'color:var(--c-text-primary,#3d3a32);background:var(--c-card-bg,#fff);' +
      'border:1px solid var(--c-next-border,#bba070);border-radius:5px;padding:6px 9px;' +
      '-webkit-appearance:none;box-sizing:border-box;}' +
      '.tve-note-input:focus{outline:none;border-color:#b85c2a;box-shadow:0 0 0 2px rgba(184,92,42,.15);}' +
      '.tve-note-save{font-size:12px;font-weight:600;color:#b85c2a;background:none;' +
      'border:1px solid #b85c2a;border-radius:5px;padding:5px 12px;cursor:pointer;' +
      'font-family:inherit;flex-shrink:0;transition:background .12s,color .12s;}' +
      '.tve-note-save:hover{background:#b85c2a;color:#7a3b1e;}' +

      /* MY TRIP NOTES card — mirrors .overview-section / .overview-title */
      '#tve-notes-card{display:none;background:var(--c-card-bg,#fff);' +
      'box-shadow:var(--c-card-shadow,0 1px 3px rgba(0,0,0,.08));border-radius:12px;' +
      'padding:16px 16px 10px;margin-bottom:8px;}' +
      '#tve-notes-card.tve-note-on{display:block;}' +
      '.tve-notes-hdr{display:flex;align-items:center;gap:10px;' +
      'color:var(--c-brand,#8a6c1a);font-size:var(--fs-base,16px);font-weight:bold;' +
      'text-transform:uppercase;border-bottom:2px solid var(--c-brand,#8a6c1a);' +
      'padding-bottom:6px;margin-bottom:8px;}' +
      '.tve-notes-hdr-t{flex:1;}' +
      '.tve-notes-act{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;' +
      'color:var(--c-brand,#8a6c1a);background:none;border:none;cursor:pointer;padding:2px 4px;' +
      'border-radius:3px;font-family:inherit;transition:color .12s;flex-shrink:0;}' +
      '.tve-notes-act:hover{color:#b85c2a;}' +
      '.tve-notes-row{display:flex;gap:10px;padding:9px 4px;border-bottom:0.5px solid #c8a44a;' +
      'text-decoration:none;color:inherit;}' +
      '.tve-notes-row:last-child{border-bottom:none;}' +
      '.tve-notes-row:hover{background:var(--c-warm-bg,#fdf8f0);}' +
      '.tve-notes-row-info{flex:1;min-width:0;}' +
      '.tve-notes-row-name{font-size:13px;font-weight:600;color:var(--c-text-primary,#3d3a32);' +
      'font-family:inherit;}' +
      '.tve-notes-row-day{font-size:11px;color:#9a908a;font-weight:400;margin-left:6px;}' +
      '.tve-notes-row-txt{font-size:13px;line-height:1.5;color:var(--c-text-primary,#3d3a32);' +
      'margin-top:2px;overflow-wrap:anywhere;}' +

      /* Print-only notes sheet — body-level, revealed by body.tve-notes-printing */
      '#tve-notes-print{display:none;}' +
      '.tve-np-h1{font-size:18px;font-weight:700;margin:0 0 4px;}' +
      '.tve-np-sub{font-size:12px;color:#555;margin:0 0 16px;}' +
      '.tve-np-item{margin:0 0 14px;padding:0 0 0 10px;border-left:2px solid #000;' +
      'break-inside:avoid;page-break-inside:avoid;}' +
      '.tve-np-name{font-size:13px;font-weight:700;}' +
      '.tve-np-day{font-size:11px;font-weight:400;color:#555;margin-left:6px;}' +
      '.tve-np-txt{font-size:13px;line-height:1.5;margin-top:2px;}' +
      '@media print{' +
      /* Printing the whole guide (the 🖨 Print Guide back-strip button) keeps the
         reader's note text but drops every control — a pencil, an open input and
         two action words are screen affordances, not page content. */
      '.tve-note-btn,.tve-note-edit,.tve-notes-act{display:none!important;}' +
      /* Printing the notes ALONE: everything else at body level steps aside. */
      'body.tve-notes-printing>*:not(#tve-notes-print){display:none!important;}' +
      'body.tve-notes-printing #tve-notes-print{display:block!important;color:#000;}' +
      '}';
    (document.head || document.documentElement).appendChild(_nCss);

    /* ── MY TRIP NOTES card ──────────────────────────────────────────────── */
    var card = document.createElement('div');
    card.id  = 'tve-notes-card';

    var cHdr   = document.createElement('div'); cHdr.className = 'tve-notes-hdr';
    var cTitle = document.createElement('span'); cTitle.className = 'tve-notes-hdr-t';
    var cPrint = document.createElement('button');
    cPrint.type = 'button'; cPrint.className = 'tve-notes-act'; cPrint.textContent = '🖨 Print';
    cPrint.setAttribute('aria-label', 'Print my trip notes');
    var cClear = document.createElement('button');
    cClear.type = 'button'; cClear.className = 'tve-notes-act'; cClear.textContent = 'Clear all';
    cHdr.appendChild(cTitle); cHdr.appendChild(cPrint); cHdr.appendChild(cClear);

    var cBody = document.createElement('div');
    card.appendChild(cHdr); card.appendChild(cBody);

    var printSheet = document.createElement('div');
    printSheet.id = 'tve-notes-print';
    document.body.appendChild(printSheet);

    /* Stop metadata, filled as the pencil buttons are injected: id → {name, day, el} */
    var meta  = {};
    var order = [];

    function _renderCard() {
      var ids = order.filter(function (id) { return notes[id]; });
      var n   = ids.length;
      card.classList.toggle('tve-note-on', n > 0);
      cTitle.textContent = n === 1 ? 'My Trip Notes · 1 note' : 'My Trip Notes · ' + n + ' notes';

      cBody.innerHTML = '';
      ids.forEach(function (id) {
        var m   = meta[id] || {};
        var row = document.createElement('a');
        row.className = 'tve-notes-row';
        row.href = '#' + id;

        var info = document.createElement('div'); info.className = 'tve-notes-row-info';
        var nm   = document.createElement('div'); nm.className = 'tve-notes-row-name';
        nm.textContent = m.name || '';
        if (m.day) {
          var dy = document.createElement('span'); dy.className = 'tve-notes-row-day';
          dy.textContent = m.day; nm.appendChild(dy);
        }
        var tx = document.createElement('div'); tx.className = 'tve-notes-row-txt';
        tx.textContent = notes[id];
        info.appendChild(nm); info.appendChild(tx);
        row.appendChild(info);
        cBody.appendChild(row);
      });
    }

    function _setNote(id, text) {
      text = (text || '').trim().slice(0, MAXLEN);
      if (text) { notes[id] = text; } else { delete notes[id]; }
      _save(notes);
      _renderCard();
    }

    cClear.addEventListener('click', function () {
      notes = {};
      _save(notes);
      [].forEach.call(document.querySelectorAll('.tve-note-saved'), function (el) {
        el.classList.remove('tve-note-on');
      });
      [].forEach.call(document.querySelectorAll('.tve-note-btn'), function (b) {
        b.classList.remove('tve-note-has');
        b.innerHTML = _pencilSvg;
        b.setAttribute('title', 'Add a private note');
      });
      _renderCard();
    });

    cPrint.addEventListener('click', function () {
      var ids = order.filter(function (id) { return notes[id]; });
      if (!ids.length) return;

      printSheet.innerHTML = '';
      var cityEl = document.querySelector('.title-city');
      var h1 = document.createElement('div'); h1.className = 'tve-np-h1';
      h1.textContent = 'My Trip Notes' + (cityEl ? ' — ' + cityEl.textContent.trim() : '');
      var sub = document.createElement('div'); sub.className = 'tve-np-sub';
      sub.textContent = ids.length === 1 ? '1 note' : ids.length + ' notes';
      printSheet.appendChild(h1); printSheet.appendChild(sub);

      ids.forEach(function (id) {
        var m    = meta[id] || {};
        var item = document.createElement('div'); item.className = 'tve-np-item';
        var nm   = document.createElement('div'); nm.className = 'tve-np-name';
        nm.textContent = m.name || '';
        if (m.day) {
          var dy = document.createElement('span'); dy.className = 'tve-np-day';
          dy.textContent = m.day; nm.appendChild(dy);
        }
        var tx = document.createElement('div'); tx.className = 'tve-np-txt';
        tx.textContent = notes[id];
        item.appendChild(nm); item.appendChild(tx);
        printSheet.appendChild(item);
      });

      document.body.classList.add('tve-notes-printing');
      window.addEventListener('afterprint', function onAP() {
        document.body.classList.remove('tve-notes-printing');
        window.removeEventListener('afterprint', onAP);
      });
      window.print();
    });

    /* ── Inject the pencil + editor into every stop ──────────────────────── */
    function _setup() {
      [].forEach.call(document.querySelectorAll('.stop-block'), function (sb) {
        var header = sb.querySelector('.stop-header');
        var nameEl = sb.querySelector('.stop-name');
        if (!header || !nameEl) return;
        var stopName = nameEl.textContent.trim();

        /* Reuse the id the share/wishlist injectors already assigned. */
        if (!sb.id) {
          var slug = stopName.toLowerCase()
            .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          sb.id = 'stop-' + (slug || String(Math.random()).slice(2, 8));
        }
        var id = sb.id;

        var dayBlock = sb.parentNode;
        while (dayBlock && !dayBlock.classList.contains('day-block')) { dayBlock = dayBlock.parentNode; }
        var dayHdr = dayBlock && dayBlock.querySelector('.day-header');
        meta[id] = { name: stopName, day: dayHdr ? dayHdr.textContent.trim() : '' };
        order.push(id);

        /* Saved-note line */
        var saved    = document.createElement('div');
        saved.className = 'tve-note-saved';
        var savedTag = document.createElement('span'); savedTag.className = 'tve-note-saved-tag';
        savedTag.textContent = 'Note';
        var savedTxt = document.createElement('span'); savedTxt.className = 'tve-note-saved-txt';
        saved.appendChild(savedTag); saved.appendChild(savedTxt);
        saved.setAttribute('title', 'Click to edit this note');

        /* Editor */
        var edit  = document.createElement('div'); edit.className = 'tve-note-edit';
        var input = document.createElement('input');
        input.type = 'text'; input.className = 'tve-note-input'; input.maxLength = MAXLEN;
        input.placeholder = 'Private note — book ahead, skip if raining…';
        input.setAttribute('aria-label', 'Private note for ' + stopName);
        var saveBtn = document.createElement('button');
        saveBtn.type = 'button'; saveBtn.className = 'tve-note-save'; saveBtn.textContent = 'Save';
        edit.appendChild(input); edit.appendChild(saveBtn);

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tve-note-btn';

        function _paint() {
          var has = !!notes[id];
          btn.classList.toggle('tve-note-has', has);
          btn.innerHTML = has ? _pencilFillSvg : _pencilSvg;
          btn.setAttribute('title', has ? 'Edit your note' : 'Add a private note');
          btn.setAttribute('aria-label', stopName + (has ? ' — edit your note' : ' — add a private note'));
          savedTxt.textContent = notes[id] || '';
          saved.classList.toggle('tve-note-on', has && !edit.classList.contains('tve-note-on'));
        }

        function _open() {
          input.value = notes[id] || '';
          edit.classList.add('tve-note-on');
          saved.classList.remove('tve-note-on');
          input.focus();
        }
        function _commit() {
          _setNote(id, input.value);
          edit.classList.remove('tve-note-on');
          _paint();
        }

        btn.addEventListener('click', function () {
          if (edit.classList.contains('tve-note-on')) { _commit(); } else { _open(); }
        });
        saved.addEventListener('click', _open);
        saveBtn.addEventListener('click', _commit);
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter')  { e.preventDefault(); _commit(); }
          if (e.key === 'Escape') { edit.classList.remove('tve-note-on'); _paint(); }
        });
        input.addEventListener('blur', function () {
          /* Let a click on Save land first — blur fires before click. */
          setTimeout(function () {
            if (edit.classList.contains('tve-note-on')) _commit();
          }, 150);
        });

        header.appendChild(btn);
        header.insertAdjacentElement('afterend', edit);
        header.insertAdjacentElement('afterend', saved);
        _paint();
      });

      /* Card goes at the top of the guide, above TRIP OVERVIEW. */
      var ov = document.querySelector('.overview-section');
      if (ov && ov.parentNode) { ov.parentNode.insertBefore(card, ov); }
      else {
        var container = document.querySelector('.container');
        if (container) container.insertBefore(card, container.firstChild);
      }
      _renderCard();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _setup);
    } else {
      _setup();
    }
  }
  _injectStopNotes();

  /* ── Back-to-guide anchor re-scroll ─────────────────────────────────────
     When the reader taps the pill on a Trip-Essentials page, they land on
     the source guide at #also-on-this-site. The browser's initial fragment
     scroll fires at parse time — before toolbar.js injects the weather
     strip, hotel banner, hotel alternatives, and Also-in-{Country} section
     — so the anchor element shifts down and the reader lands thousands of
     pixels above the actual card. Owner rule 2026-07-28: land the reader
     AT THE CARD as fast as possible. Fire immediately on DOMContentLoaded,
     then every 250ms for 1.5s to catch late injections. Manual scroll
     restoration prevents the browser's stale initial scroll from winning. */
  if (/\/Guides\//.test(location.pathname)
      && location.pathname.indexOf('guides_index') < 0
      && location.hash === '#also-on-this-site') {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    function _rescrollToAlsoCard() {
      var _el = document.getElementById('also-on-this-site');
      if (_el) _el.scrollIntoView({ block: 'start' });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _rescrollToAlsoCard);
    } else {
      _rescrollToAlsoCard();
    }
    var _rescrollTries = 0;
    var _rescrollInt = setInterval(function () {
      _rescrollToAlsoCard();
      if (++_rescrollTries >= 6) clearInterval(_rescrollInt);
    }, 250);
  }

  // ── Collapsible extras sections ──────────────────────────────────────────
  (function _sectionCollapse() {
    function _setup() {
      document.querySelectorAll('.extras-section, .worth-knowing, #hotel-alternatives').forEach(function (sec) {
        var title = sec.querySelector(':scope > .extras-title');
        if (!title || sec.dataset.collapseInited || sec.id === 'nearby-guides') return;
        sec.dataset.collapseInited = '1';
        title.setAttribute('role', 'button');
        title.setAttribute('tabindex', '0');
        title.addEventListener('click', function () {
          sec.classList.toggle('collapsed');
        });
        title.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            sec.classList.toggle('collapsed');
          }
        });
      });
      /* Collapse all extras sections by default on mobile (≤768px).
         guide-style.css already defines .extras-section.collapsed (lines 1062-1069).

         ONLY sections that got a collapse control above (dataset.collapseInited)
         may be collapsed — a section with no `> .extras-title` has nothing to
         click, so collapsing it hides its content with no way to bring it back.
         #skip-list is exactly that: a title-less italic footnote. It was being
         collapsed here, so on every guide its "Skipping: …" line was invisible on
         mobile while the section still occupied its 36px top margin and the 14px
         collapsed padding — ~50px of blank space between Worth Knowing and
         Alternative Hotel Recommendations, which is what the owner spotted
         2026-08-10. Gate on the control, not on an ID blacklist, so the next
         title-less section can't reintroduce it. */
      if (window.innerWidth <= 768) {
        document.querySelectorAll('.extras-section').forEach(function (sec) {
          if (sec.dataset.collapseInited && sec.id !== 'nearby-guides') sec.classList.add('collapsed');
        });
      }

      document.querySelectorAll('.day-block').forEach(function (day) {
        var hdr = day.querySelector(':scope > .day-header');
        if (!hdr || day.dataset.collapseInited) return;
        day.dataset.collapseInited = '1';
        hdr.setAttribute('role', 'button');
        hdr.setAttribute('tabindex', '0');
        hdr.addEventListener('click', function () {
          day.classList.toggle('collapsed');
        });
        hdr.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            day.classList.toggle('collapsed');
          }
        });
      });
      /* #nearby-guides has ID-specificity CSS that blocks .collapsed — drive via
         inline styles instead (same approach as the global collapse button). */
      var ng = document.getElementById('nearby-guides');
      if (ng && !ng.dataset.collapseInited) {
        var ngTitle = ng.querySelector(':scope > .extras-title');
        if (ngTitle) {
          ng.dataset.collapseInited = '1';
          ngTitle.setAttribute('role', 'button');
          ngTitle.setAttribute('tabindex', '0');
          function _ngToggle() {
            ng.classList.toggle('collapsed');
            var ngPills = ng.querySelector('.nearby-guides-pills');
            if (ngPills) ngPills.style.display = '';
            ngTitle.style.marginBottom = '';
            ng.style.paddingBottom = '';
          }
          ngTitle.addEventListener('click', _ngToggle);
          ngTitle.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _ngToggle(); }
          });
        }
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _setup);
    } else {
      _setup();
    }
  }());

  /* ── Section nav chip → expand target section on click ─────────────────────
     Overview-extras chips link to #section-id anchors.  If the section is
     currently collapsed (.collapsed class), remove the collapse so the
     content is visible when the browser scrolls. */
  (function _chipExpandOnClick() {
    function _expandTarget(href) {
      var id = (href || '').slice(1);
      var sec = document.getElementById(id);
      if (!sec) return;
      if (sec.classList.contains('collapsed')) sec.classList.remove('collapsed');
    }
    function _setup() {
      /* Section nav chips */
      var extras = document.querySelector('.overview-extras:not(#ics-pill-row)');
      if (extras) {
        extras.querySelectorAll('.overview-extra-link[href^="#"]').forEach(function (chip) {
          chip.addEventListener('click', function () { _expandTarget(chip.getAttribute('href')); });
        });
      }
      /* Trip Overview day cards */
      document.querySelectorAll('.overview-day[href^="#"]').forEach(function (card) {
        card.addEventListener('click', function () { _expandTarget(card.getAttribute('href')); });
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _setup);
    } else {
      _setup();
    }
  }());

  /* ── Open-now stop status ─────────────────────────────────────────────────
     Injects the destination-clock label at the bottom of .overview-section
     (inside the white Trip Overview card), and stamps an Open / Closed badge
     into every .stop-header whose hours are known.

     This is a STATEMENT, not a control (owner rule 2026-08-09). It used to be
     a toggle pill labelled "Open right now" that dimmed closed stops and
     auto-collapsed Day 2+. Two things were wrong with that: the label was
     phrased as a fact, so a clickable pill made no sense, and open/closed is
     not the reader's decision to make — "it should tell me if it is open or
     not period. it cant be my decision."

     Hours are read from .tour-box/.ticket-box children starting with 🏛.
     Timezone: data-timezone on toolbar-mount → city lookup map. With no
     timezone we show nothing rather than judge the destination by the
     reader's own clock. */
  (function _injectOpenNowStatus() {
    if (!isRealGuide) return;

    /* ── Destination timezone map (folder slug → IANA) ── */
    var _TZ = _TVE_TZ;

    /* ── Time helpers ── */
    function _parseTimeVal(s) {
      var m = s.trim().match(/^(\d+):(\d+)\s*(am|pm)$/i);
      if (!m) return null;
      var h = parseInt(m[1], 10), mn = parseInt(m[2], 10), ap = m[3].toLowerCase();
      if (ap === 'pm' && h !== 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      return h + mn / 60;
    }
    var _DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    /* One " · " segment → { inDay: covers TODAY, open: h falls inside it }, or
       null when the shape is unrecognised. The two questions are kept apart
       because a bare "3:00pm - 6:00pm" continuation carries no day of its own
       and has to borrow the day of the segment before it — see _hoursOpen. */
    function _segOpen(seg, dow, h) {
      seg = seg.trim();
      if (/open 24\/7/i.test(seg)) return { inDay: true, open: true };
      var daily = seg.match(/^daily\s+(\d+:\d+\s*[ap]m)\s*[-–]\s*(\d+:\d+\s*[ap]m)$/i);
      if (daily) {
        var o = _parseTimeVal(daily[1]), c = _parseTimeVal(daily[2]);
        if (o === null || c === null) return null;
        return { inDay: true, open: h >= o && h < c };
      }
      var rng = seg.match(/^([a-z]+)\s*[-–]\s*([a-z]+)\s+(\d+:\d+\s*[ap]m)\s*[-–]\s*(\d+:\d+\s*[ap]m)$/i);
      if (rng) {
        var sd = _DAYS.indexOf(rng[1].toLowerCase());
        var ed = _DAYS.indexOf(rng[2].toLowerCase());
        var o2 = _parseTimeVal(rng[3]), c2 = _parseTimeVal(rng[4]);
        if (sd < 0 || ed < 0 || o2 === null || c2 === null) return null;
        var inR = (sd <= ed) ? (dow >= sd && dow <= ed) : (dow >= sd || dow <= ed);
        return { inDay: inR, open: inR && h >= o2 && h < c2 };
      }
      /* A single named day — "Friday 9:00am - 12:00pm". Never handled before,
         which is why the Friday half of every Gulf listing read as noise. */
      var one = seg.match(/^([a-z]+)\s+(\d+:\d+\s*[ap]m)\s*[-–]\s*(\d+:\d+\s*[ap]m)$/i);
      if (one) {
        var d1 = _DAYS.indexOf(one[1].toLowerCase());
        var o3 = _parseTimeVal(one[2]), c3 = _parseTimeVal(one[3]);
        if (d1 < 0 || o3 === null || c3 === null) return null;
        return { inDay: dow === d1, open: dow === d1 && h >= o3 && h < c3 };
      }
      /* Bare range — the afternoon half of a split day. Its day is whatever the
         previous segment named; _hoursOpen supplies it. */
      var cont = seg.match(/^(\d+:\d+\s*[ap]m)\s*[-–]\s*(\d+:\d+\s*[ap]m)$/i);
      if (cont) {
        var o4 = _parseTimeVal(cont[1]), c4 = _parseTimeVal(cont[2]);
        if (o4 === null || c4 === null) return null;
        return { cont: true, open: h >= o4 && h < c4 };
      }
      return null;
    }
    function _hoursOpen(txt, dow, h) {
      if (!txt) return null;
      var segs = txt.split('\xb7');
      var parsed = false, lastInDay = null;
      for (var i = 0; i < segs.length; i++) {
        var r = _segOpen(segs[i], dow, h);
        if (r === null) continue;
        /* A continuation only speaks about today if the segment it continues
           did. Treating it as its own segment is what made a 4pm visit to a
           "Daily 9:00am - 12:00pm · 3:00pm - 6:00pm" stop read as Closed. */
        var inDay = r.cont ? lastInDay : r.inDay;
        if (inDay === null) continue;
        parsed = true;
        if (inDay && r.open) return true;
        if (!r.cont) lastInDay = r.inDay;
      }
      return parsed ? false : null;
    }
    function _getHoursText(sb) {
      var txt = '';
      [].forEach.call(sb.querySelectorAll('.tour-box > div, .ticket-box > div'), function(d) {
        if (txt) return;
        var t = d.textContent.trim();
        /* 🏛 is surrogate pair 🏛; slice(0,2) covers both bare and VS16 variants */
        if (t.slice(0, 2) === '🏛') {
          /* Strip emoji + optional VS16 + space */
          txt = t.slice(t.indexOf(' ') + 1).trim();
        }
      });
      return txt;
    }

    /* ── Destination time ── */
    function _destInfo() {
      /* Derive slug from URL path: …/Guides/Geneva/geneva_v1.html → "geneva" */
      var parts = location.pathname.split('/');
      var gi = parts.indexOf('Guides');
      var slug = gi >= 0 && parts[gi + 1] ? parts[gi + 1].toLowerCase() : '';
      var tz = (mount && mount.dataset.timezone) || _TZ[slug] || '';
      var now = new Date();
      var dow, hour, timeStr;
      if (tz) {
        try {
          var hFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });
          var dFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
          timeStr = hFmt.format(now);
          var dayStr = dFmt.format(now);
          var DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
          dow = DOW[dayStr] !== undefined ? DOW[dayStr] : now.getDay();
          /* Extract hour decimal from formatted parts */
          var pFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false });
          var hParts = pFmt.formatToParts ? pFmt.formatToParts(now) : [];
          var hh = now.getHours(), mm = now.getMinutes();
          hParts.forEach(function(p) {
            if (p.type === 'hour') hh = parseInt(p.value, 10);
            if (p.type === 'minute') mm = parseInt(p.value, 10);
          });
          hour = hh + mm / 60;
        } catch (e) {
          tz = '';
        }
      }
      if (!tz) {
        dow = now.getDay();
        hour = now.getHours() + now.getMinutes() / 60;
        timeStr = '';
      }
      /* City display name: capitalise slug or read from .title-city */
      var cityEl = document.querySelector('.title-city');
      var city = cityEl ? cityEl.textContent.trim() : '';
      /* Title-city is uppercase (e.g. "GENEVA") — title-case it */
      city = city.replace(/\b\w/g, function(c) { return c.toUpperCase(); }).replace(/\B\w/g, function(c) { return c.toLowerCase(); });
      return { dow: dow, hour: hour, timeStr: timeStr, city: city, hasTz: !!tz };
    }

    /* ── Main setup ── */
    function _setup() {
      var ovSec = document.querySelector('.overview-section');
      var overviewDays = document.querySelectorAll('.overview-day');
      if (!ovSec || !overviewDays.length) return;
      if (document.getElementById('tve-open-now-row')) return;

      /* Build row */
      var row = document.createElement('div');
      row.id = 'tve-open-now-row';
      row.className = 'open-now-row';

      var timeLabel = document.createElement('span');
      timeLabel.className = 'open-now-local-time';
      timeLabel.id = 'tve-open-now-time';

      row.appendChild(timeLabel);
      ovSec.appendChild(row);

      function _updateLabel() {
        var info = _destInfo();
        timeLabel.textContent = info.hasTz
          ? ('🕐 ' + info.city + ' \xb7 ' + info.timeStr)
          : '';
      }

      /* Every stop whose hours line parses carries an Open / Closed badge in
         its header, always, computed against the destination's local day +
         time and refreshed each minute. No toggle, no dimming, no collapse.

         Two deliberate silences, because a wrong badge is worse than no badge:
           - no data-timezone on the guide -> _destInfo falls back to the
             READER's clock, which says nothing about the destination, so no
             badge ships at all;
           - hours absent or unparseable (_hoursOpen -> null) -> no badge. */
      function _applyStatus() {
        var info = _destInfo();
        [].forEach.call(document.querySelectorAll('.stop-block'), function(sb) {
          var status = info.hasTz
            ? _hoursOpen(_getHoursText(sb), info.dow, info.hour)
            : null;
          var badge = sb.querySelector('.open-now-status');
          if (status === null) {
            if (badge) badge.parentNode.removeChild(badge);
            return;
          }
          if (!badge) {
            var hdr = sb.querySelector('.stop-header');
            if (!hdr) return;
            badge = document.createElement('span');
            badge.className = 'open-now-status';
            var dur = hdr.querySelector('.stop-dur');
            if (dur) hdr.insertBefore(badge, dur); else hdr.appendChild(badge);
          }
          badge.classList.toggle('is-open', status === true);
          badge.classList.toggle('is-closed', status === false);
          badge.textContent = status ? 'Open' : 'Closed';
        });
      }

      _updateLabel();
      _applyStatus();
      setInterval(function() { _updateLabel(); _applyStatus(); }, 60000);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _setup);
    } else { _setup(); }
  }());

  /* ── Lounge arrival chip — injected at the top of Day 1 ─────────────────────
     Reads the city slug from the page path → looks up destination IATA via
     CHIP_DATA → routes to Lounges-US, Lounges-Europe, or Before-You-Go#lounges
     based on which page covers that airport. Chip sits immediately after the
     .day-header (above .hotel-first). CSS: guide-style.css .lounge-arrival-chip */
  (function _loungeChipInject() {
    if (!/\/Guides\//.test(location.pathname)
        || /-read-about\.html$/.test(location.pathname)
        || /-stops-map\.html$/.test(location.pathname)) return;

    /* city-slug → {iata, name}  (derived from index.html FMAP "i" field) */
    var CHIP_DATA = {
      'Abu-Dhabi':         {iata:'AUH', name:'Abu Dhabi International'},
      'Aix-en-Provence':   {iata:'MRS', name:'Marseille Provence'},
      'Alaska':            {iata:'ANC', name:'Ted Stevens Anchorage International'},
      'Alesund':           {iata:'AES', name:'Ålesund Airport, Vigra'},
      'Amalfi':            {iata:'NAP', name:'Naples International'},
      'Amsterdam':         {iata:'AMS', name:'Amsterdam Schiphol'},
      'Annecy':            {iata:'GVA', name:'Geneva International'},
      'Aracaju':           {iata:'AJU', name:'Aracaju Marechal Cunha Machado'},
      'Arenal':            {iata:'SJO', name:'Juan Santamaría International'},
      'Aruba':             {iata:'AUA', name:'Queen Beatrix International'},
      'Athens':            {iata:'ATH', name:'Athens Eleftherios Venizelos'},
      'Atlanta':           {iata:'ATL', name:'Hartsfield-Jackson Atlanta International'},
      'Austin':            {iata:'AUS', name:'Austin–Bergstrom International'},
      'Azores':            {iata:'PDL', name:'João Paulo II Airport'},
      'Bahamas':           {iata:'NAS', name:'Lynden Pindling International'},
      'Bali':              {iata:'DPS', name:'Ngurah Rai International'},
      'Banff':             {iata:'YYC', name:'Calgary International'},
      'Bangkok':           {iata:'BKK', name:'Suvarnabhumi Airport'},
      'Barbados':          {iata:'BGI', name:'Grantley Adams International'},
      'Barcelona':         {iata:'BCN', name:'Barcelona El Prat'},
      'Beijing':           {iata:'PEK', name:'Beijing Capital International'},
      'Bend':              {iata:'RDM', name:'Roberts Field'},
      'Bergen':            {iata:'BGO', name:'Bergen Flesland'},
      'Berlin':            {iata:'BER', name:'Berlin Brandenburg'},
      'Bhutan':            {iata:'PBH', name:'Paro Airport'},
      'Big-Island':        {iata:'KOA', name:'Ellison Onizuka Kona International'},
      'Bilbao':            {iata:'BIO', name:'Bilbao Airport'},
      'Bologna':           {iata:'BLQ', name:'Bologna Guglielmo Marconi'},
      'Bora-Bora':         {iata:'BOB', name:'Bora Bora Airport (Motu Mute)'},
      'Bordeaux':          {iata:'BOD', name:'Bordeaux–Mérignac'},
      'Boston':            {iata:'BOS', name:'Boston Logan International'},
      'Boulder':           {iata:'DEN', name:'Denver International'},
      'Bruges':            {iata:'BRU', name:'Brussels Airport'},
      'Brussels':          {iata:'BRU', name:'Brussels Airport'},
      'Budapest':          {iata:'BUD', name:'Budapest Ferenc Liszt'},
      'Buenos-Aires':      {iata:'EZE', name:'Ministro Pistarini International'},
      'Cairo':             {iata:'CAI', name:'Cairo International'},
      'Cambridge':         {iata:'LHR', name:'London Heathrow'},
      'Cancun':            {iata:'CUN', name:'Cancún International'},
      'Cannes':            {iata:'NCE', name:'Nice Côte d\'Azur'},
      'Cape-Cod':          {iata:'BOS', name:'Boston Logan International'},
      'Cape-Town':         {iata:'CPT', name:'Cape Town International'},
      'Capri':             {iata:'NAP', name:'Naples International'},
      'Carmel-by-the-Sea': {iata:'SFO', name:'San Francisco International'},
      'Cascais':           {iata:'LIS', name:'Lisbon Humberto Delgado'},
      'Cayman-Islands':    {iata:'GCM', name:'Owen Roberts International'},
      'Charlotte':         {iata:'CLT', name:'Charlotte Douglas International'},
      'Chiang-Mai':        {iata:'CNX', name:'Chiang Mai International'},
      'Chicago':           {iata:'ORD', name:'O\'Hare International'},
      'Chongqing':         {iata:'CKG', name:'Chongqing Jiangbei International'},
      'Cinque-Terre':      {iata:'PSA', name:'Pisa Galileo Galilei'},
      'Coeur-dAlene':      {iata:'GEG', name:'Spokane International'},
      'Colmar':            {iata:'BSL', name:'EuroAirport Basel–Mulhouse–Freiburg'},
      'Cologne':           {iata:'CGN', name:'Cologne Bonn Airport'},
      'Colombo':           {iata:'CMB', name:'Bandaranaike International'},
      'Columbia':          {iata:'CAE', name:'Columbia Metropolitan'},
      'Copenhagen':        {iata:'CPH', name:'Copenhagen Kastrup'},
      'Corfu':             {iata:'CFU', name:'Corfu Ioannis Kapodistrias'},
      'Crete':             {iata:'HER', name:'Heraklion Nikos Kazantzakis'},
      'Curacao':           {iata:'CUR', name:'Hato International'},
      'Curitiba':          {iata:'CWB', name:'Curitiba Afonso Pena'},
      'Cusco':             {iata:'CUZ', name:'Alejandro Velasco Astete International'},
      'Dallas':            {iata:'DFW', name:'Dallas/Fort Worth International'},
      'Denver':            {iata:'DEN', name:'Denver International'},
      'Doha':              {iata:'DOH', name:'Hamad International'},
      'Dubai':             {iata:'DXB', name:'Dubai International'},
      'Dublin':            {iata:'DUB', name:'Dublin International'},
      'Dubrovnik':         {iata:'DBV', name:'Dubrovnik Airport'},
      'Edinburgh':         {iata:'EDI', name:'Edinburgh Airport'},
      'Florence':          {iata:'FLR', name:'Florence Peretola'},
      'Florianopolis':     {iata:'FLN', name:'Florianópolis Hercílio Luz'},
      'Florida-Keys':      {iata:'MIA', name:'Miami International'},
      'Fortaleza':         {iata:'FOR', name:'Fortaleza Pinto Martins'},
      'Foz-do-Iguaçu':     {iata:'IGU', name:'Foz do Iguaçu International'},
      'Frankfurt':         {iata:'FRA', name:'Frankfurt am Main'},
      'Galapagos-Islands': {iata:'GPS', name:'Seymour Núñez Airport'},
      'Geneva':            {iata:'GVA', name:'Geneva International'},
      'Glacier-National-Park': {iata:'FCA', name:'Glacier Park International'},
      'Glasgow':           {iata:'GLA', name:'Glasgow International'},
      'Gothenburg':        {iata:'GOT', name:'Gothenburg Landvetter'},
      'Granada':           {iata:'GRX', name:'Federico García Lorca Granada–Jaén'},
      'Hamburg':           {iata:'HAM', name:'Hamburg Airport'},
      'Hanoi':             {iata:'HAN', name:'Noi Bai International'},
      'Helsinki':          {iata:'HEL', name:'Helsinki-Vantaa'},
      'Hilton-Head-Island':{iata:'HHH', name:'Hilton Head Airport'},
      'Hiroshima':         {iata:'HIJ', name:'Hiroshima Airport'},
      'Hoi-An':            {iata:'DAD', name:'Da Nang International'},
      'Hong-Kong':         {iata:'HKG', name:'Hong Kong International'},
      'Istanbul':          {iata:'IST', name:'Istanbul Airport'},
      'João-Pessoa':       {iata:'JPA', name:'João Pessoa Castro Pinto'},
      'Kauai':             {iata:'LIH', name:'Lihue Airport'},
      'KeyWest':           {iata:'EYW', name:'Key West International'},
      'Kotor':             {iata:'TIV', name:'Tivat Airport'},
      'Kraków':            {iata:'KRK', name:'Kraków John Paul II'},
      'Kyoto':             {iata:'HND', name:'Tokyo Haneda'},
      'La-Jolla':          {iata:'SAN', name:'San Diego International'},
      'Lagos':             {iata:'FAO', name:'Faro Airport'},
      'Lake-Como':         {iata:'MXP', name:'Milan Malpensa'},
      'Lake-Tahoe':        {iata:'RNO', name:'Reno-Tahoe International'},
      'Las-Vegas':         {iata:'LAS', name:'Harry Reid International'},
      'Lecce':             {iata:'BDS', name:'Brindisi Airport'},
      'Lille':             {iata:'CDG', name:'Paris – Charles de Gaulle'},
      'Lima':              {iata:'LIM', name:'Jorge Chávez International'},
      'Lisbon':            {iata:'LIS', name:'Lisbon Humberto Delgado'},
      'Ljubljana':         {iata:'LJU', name:'Ljubljana Jože Pučnik'},
      'London':            {iata:'LHR', name:'London Heathrow'},
      'Los-Angeles':       {iata:'LAX', name:'Los Angeles International'},
      'Los-Cabos':         {iata:'SJD', name:'Los Cabos International'},
      'Luang-Prabang':     {iata:'LPQ', name:'Luang Prabang International'},
      'Lucerne':           {iata:'ZRH', name:'Zurich International'},
      'Luxembourg':        {iata:'LUX', name:'Luxembourg Findel'},
      'Lyon':              {iata:'LYS', name:'Lyon Saint-Exupéry'},
      'Maceió':            {iata:'MCZ', name:'Zumbi dos Palmares International'},
      'MachuPicchu':       {iata:'CUZ', name:'Alejandro Velasco Astete International'},
      'Madeira':           {iata:'FNC', name:'Madeira Cristiano Ronaldo'},
      'Madrid':            {iata:'MAD', name:'Adolfo Suárez Madrid–Barajas'},
      'Malaga':            {iata:'AGP', name:'Málaga Costa del Sol'},
      'Maldives':          {iata:'MLE', name:'Velana International'},
      'Malibu':            {iata:'LAX', name:'Los Angeles International'},
      'Manuel-Antonio':    {iata:'SJO', name:'Juan Santamaría International'},
      'Marco-Island':      {iata:'RSW', name:'Southwest Florida International'},
      'Marktoberdorf':     {iata:'MUC', name:'Munich International'},
      'Marrakech':         {iata:'RAK', name:'Marrakech Menara'},
      'Marseille':         {iata:'MRS', name:'Marseille Provence'},
      'Maui':              {iata:'OGG', name:'Kahului Airport'},
      'Melbourne':         {iata:'MEL', name:'Melbourne Airport (Tullamarine)'},
      'Miami':             {iata:'MIA', name:'Miami International'},
      'Milan':             {iata:'MXP', name:'Milan Malpensa'},
      'Monaco':            {iata:'NCE', name:'Nice Côte d\'Azur'},
      'Montevideo':        {iata:'MVD', name:'Carrasco International'},
      'Montreal':          {iata:'YUL', name:'Montréal-Trudeau International'},
      'Munich':            {iata:'MUC', name:'Munich International'},
      'Muscat':            {iata:'MCT', name:'Muscat International'},
      'Mykonos':           {iata:'JMK', name:'Mykonos Island National Airport'},
      'Napa':              {iata:'SFO', name:'San Francisco International'},
      'Naples':            {iata:'NAP', name:'Naples International'},
      'Naples-Florida':    {iata:'RSW', name:'Southwest Florida International'},
      'Nashville':         {iata:'BNA', name:'Nashville International'},
      'Natal':             {iata:'NAT', name:'Aluízio Alves International'},
      'New-Orleans':       {iata:'MSY', name:'Louis Armstrong New Orleans International'},
      'New-York':          {iata:'JFK', name:'John F. Kennedy International'},
      'Nice':              {iata:'NCE', name:'Nice Côte d\'Azur'},
      'Oahu':              {iata:'HNL', name:'Daniel K. Inouye International'},
      'Oaxaca':            {iata:'OAX', name:'Xoxocotlán International'},
      'Olinda':            {iata:'REC', name:'Recife Guararapes–Gilberto Freyre'},
      'Orcas-Island':      {iata:'ORS', name:'Orcas Island Airport'},
      'Orlando':           {iata:'MCO', name:'Orlando International'},
      'Osaka':             {iata:'KIX', name:'Kansai International'},
      'Oslo':              {iata:'OSL', name:'Oslo Gardermoen'},
      'Oxford':            {iata:'LHR', name:'London Heathrow'},
      'Palawan':           {iata:'PPS', name:'Puerto Princesa International'},
      'Palm-Desert':       {iata:'PSP', name:'Palm Springs International'},
      'Palo-Alto':         {iata:'SFO', name:'San Francisco International'},
      'Paris':             {iata:'CDG', name:'Paris – Charles de Gaulle'},
      'Pasadena':          {iata:'LAX', name:'Los Angeles International'},
      'Pensacola':         {iata:'PNS', name:'Pensacola International'},
      'Petra':             {iata:'AMM', name:'Queen Alia International'},
      'Philadelphia':      {iata:'PHL', name:'Philadelphia International'},
      'Phoenix':           {iata:'PHX', name:'Phoenix Sky Harbor'},
      'Phuket':            {iata:'HKT', name:'Phuket International'},
      'Pisa':              {iata:'PSA', name:'Pisa Galileo Galilei'},
      'Pokhara':           {iata:'KTM', name:'Tribhuvan International'},
      'Portland':          {iata:'PDX', name:'Portland International'},
      'Porto':             {iata:'OPO', name:'Porto Francisco Sá Carneiro'},
      'Porto-Alegre':      {iata:'POA', name:'Porto Alegre Salgado Filho'},
      'Prague':            {iata:'PRG', name:'Václav Havel Airport Prague'},
      'Puerto-Rico':       {iata:'SJU', name:'Luis Muñoz Marín International'},
      'Puerto-Vallarta':   {iata:'PVR', name:'Puerto Vallarta Licenciado Gustavo Díaz Ordaz'},
      'Quebec-City':       {iata:'YQB', name:'Québec City Jean Lesage'},
      'Queenstown':        {iata:'ZQN', name:'Queenstown Airport'},
      'Recife':            {iata:'REC', name:'Recife Guararapes–Gilberto Freyre'},
      'Reykjavik':         {iata:'KEF', name:'Keflavík International'},
      'Rhodes':            {iata:'RHO', name:'Rhodes Diagoras'},
      'Rio-de-Janeiro':    {iata:'GIG', name:'Rio de Janeiro Galeão International'},
      'Rome':              {iata:'FCO', name:'Rome Fiumicino (Leonardo da Vinci)'},
      'Salvador':          {iata:'SSA', name:'Luís Eduardo Magalhães International'},
      'Salzburg':          {iata:'SZG', name:'Salzburg Airport'},
      'San-Diego':         {iata:'SAN', name:'San Diego International'},
      'San-Francisco':     {iata:'SFO', name:'San Francisco International'},
      'San-Jose':          {iata:'SJC', name:'San José International'},
      'San-Jose-Costa-Rica':{iata:'SJO', name:'Juan Santamaría International'},
      'San-Juan-Island':   {iata:'FHR', name:'Friday Harbor Seaplane Base'},
      'San-Sebastian':     {iata:'BIO', name:'Bilbao Airport'},
      'Santa-Barbara':     {iata:'LAX', name:'Los Angeles International'},
      'Santa-Cruz':        {iata:'SFO', name:'San Francisco International'},
      'Santa-Fe':          {iata:'ABQ', name:'Albuquerque Sunport'},
      'Santa-Monica':      {iata:'LAX', name:'Los Angeles International'},
      'Santiago':          {iata:'SCL', name:'Santiago Comodoro Arturo Merino Benítez'},
      'Santorini':         {iata:'JTR', name:'Santorini Thira National Airport'},
      'Sarasota':          {iata:'SRQ', name:'Sarasota–Bradenton International'},
      'Sardinia':          {iata:'OLB', name:'Olbia Costa Smeralda'},
      'Scottsdale':        {iata:'PHX', name:'Phoenix Sky Harbor'},
      'Seattle':           {iata:'SEA', name:'Seattle-Tacoma International'},
      'Sedona':            {iata:'PHX', name:'Phoenix Sky Harbor'},
      'Seoul':             {iata:'ICN', name:'Incheon International'},
      'Seville':           {iata:'SVQ', name:'Seville Airport'},
      'Seychelles':        {iata:'SEZ', name:'Seychelles International'},
      'Shanghai':          {iata:'PVG', name:'Shanghai Pudong International'},
      'Sicily':            {iata:'CTA', name:'Catania–Fontanarossa'},
      'Siena':             {iata:'FLR', name:'Florence Peretola'},
      'Singapore':         {iata:'SIN', name:'Singapore Changi'},
      'Sint-Maarten':      {iata:'SXM', name:'Princess Juliana International'},
      'Sintra':            {iata:'LIS', name:'Lisbon Humberto Delgado'},
      'Sorrento':          {iata:'NAP', name:'Naples International'},
      'Split':             {iata:'SPU', name:'Split Airport'},
      'Stockholm':         {iata:'ARN', name:'Stockholm Arlanda'},
      'Strasbourg':        {iata:'SXB', name:'Strasbourg Airport'},
      'Stuttgart':         {iata:'STR', name:'Stuttgart Airport'},
      'Sydney':            {iata:'SYD', name:'Sydney Kingsford Smith'},
      'São-Luís':          {iata:'SLZ', name:'Marechal Cunha Machado International'},
      'São-Paulo':         {iata:'GRU', name:'São Paulo Guarulhos International'},
      'Taipei':            {iata:'TPE', name:'Taiwan Taoyuan International'},
      'Tallinn':           {iata:'TLL', name:'Tallinn Lennart Meri'},
      'Tbilisi':           {iata:'TBS', name:'Tbilisi International'},
      'Tenerife':          {iata:'TFS', name:'Tenerife South Airport'},
      'Tokyo':             {iata:'HND', name:'Tokyo Haneda'},
      'Toledo':            {iata:'MAD', name:'Adolfo Suárez Madrid–Barajas'},
      'Toronto':           {iata:'YYZ', name:'Toronto Pearson International'},
      'Tromso':            {iata:'TOS', name:'Tromsø Airport'},
      'Turin':             {iata:'TRN', name:'Turin Airport'},
      'Turks-and-Caicos':  {iata:'PLS', name:'Providenciales International'},
      'Valletta':          {iata:'MLA', name:'Malta International'},
      'Vancouver':         {iata:'YVR', name:'Vancouver International'},
      'Venice':            {iata:'VCE', name:'Venice Marco Polo'},
      'Verona':            {iata:'VRN', name:'Verona Villafranca'},
      'Victoria':          {iata:'YVR', name:'Vancouver International'},
      'Vienna':            {iata:'VIE', name:'Vienna International'},
      'Virgin-Islands':    {iata:'STT', name:'Cyril E. King Airport'},
      'Washington-DC':     {iata:'DCA', name:'Ronald Reagan Washington National'},
      'Wellington':        {iata:'WLG', name:'Wellington International'},
      'Whistler':          {iata:'YVR', name:'Vancouver International'},
      'Yellowstone':       {iata:'DEN', name:'Denver International'},
      'Zakynthos':         {iata:'ZTH', name:'Zakynthos International'},
      'Zhangjiajie':       {iata:'DYG', name:'Zhangjiajie Hehua Airport'},
      'Zurich':            {iata:'ZRH', name:'Zurich International'}
    };

    /* Sets of IATAs covered by each Lounges page */
    var US_IATAS = ['ATL','BOS','DTW','JFK','LAX','MSP','SAN','SEA','SFO','SLC','IAD','IAH','LGA','MIA','ORD'];
    var EU_IATAS = ['AMS','CDG','ORY','NCE','LYS','LHR','LGW','MAN','EDI','VIE','BRU','DBV','SPU','ZAG','CPH','HEL','FRA','MUC','BER','DUS','HAM','ATH','HER','SKG','DUB','FCO','MXP','VCE','NAP','LUX','OSL','BGO','LIS','OPO','FAO','MAD','BCN','AGP','PMI','VLC','ARN','GOT','GVA','ZRH'];

    function _inject() {
      var parts = location.pathname.split('/');
      var gi = parts.indexOf('Guides');
      if (gi < 0) return;
      var slug = parts[gi + 1] || '';
      var info = CHIP_DATA[slug];
      if (!info) return;

      var day1 = document.getElementById('day1');
      if (!day1) return;
      var dayHdr = day1.querySelector(':scope > .day-header');
      if (!dayHdr) return;

      var mountEl = document.getElementById('toolbar-mount');
      var dep = mountEl ? parseInt(mountEl.dataset.depth || '2', 10) : 2;
      var base = new Array(dep + 1).join('../');
      var href, label;
      if (US_IATAS.indexOf(info.iata) >= 0) {
        href = base + 'Trip-Essentials/Lounges-US.html';
        label = 'US Lounges';
      } else if (EU_IATAS.indexOf(info.iata) >= 0) {
        href = base + 'Trip-Essentials/Lounges-Europe.html';
        label = 'EU Lounges';
      } else {
        href = base + 'Trip-Essentials/Before-You-Go.html#lounges';
        label = 'Before You Go';
      }

      var chip = document.createElement('a');
      chip.className = 'lounge-arrival-chip';
      chip.href = href;
      chip.innerHTML =
        '<span class="lac-iata">✈ ' + info.iata + '</span>' +
        '<span class="lac-div">|</span>' +
        '<span class="lac-name">' + info.name + '</span>' +
        '<span class="lac-link">' + label + '</span>';

      dayHdr.insertAdjacentElement('afterend', chip);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _inject);
    } else {
      _inject();
    }
  }());

  /* ── Move .overview-extras (and #ics-pill-row) out of the white Trip Overview
     card so they render on the beige page background between the card and day blocks.
     Runs last on DOMContentLoaded so all chip injection is already complete. ── */
  (function _extrasOutOfCard() {
    function _move() {
      var ovSec = document.querySelector('.overview-section');
      if (!ovSec) return;
      var parent = ovSec.parentNode;
      var after = ovSec.nextSibling;
      var children = Array.prototype.slice.call(ovSec.children);
      children.forEach(function(child) {
        if (child.classList.contains('overview-extras') || child.id === 'ics-pill-row') {
          parent.insertBefore(child, after);
          after = child.nextSibling;
        }
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _move);
    } else { _move(); }
  }());

  /* ── Section-nav chips: reorder by theme ──────────────────────────────────
     Chips ship in the canonical order defined by Guide Structure.html, which
     interleaves the kinds — food, transport, planning and off-guide links are
     mixed through one 13-17 chip run, so a reader hunting for somewhere to eat
     scans the whole row. This sorts them into four themes:

         Eat & drink · Get around · Plan & do · Elsewhere on the site

     ORDER ONLY. No wrappers, no labels, no CSS: the grid, the beige tiles and
     every chip value stay exactly as they are. The sort is stable, so within a
     theme the chips keep their canonical sequence relative to each other.

     The GUIDE HTML IS NOT TOUCHED. It still carries the canonical order that
     _OVERVIEW_PILL_CANONICAL_ORDER (validate_itinerary.py) hard-fails on, and
     that check reads the file, not the rendered DOM — so it still sees, and
     still governs, the authored order. Never rewrite a guide's pill order to
     match this rendering.

     An anchor missing from RANK sorts to the end rather than being dropped, so
     a pill added later still appears; give it a rank here when it lands.
     "Also in {Country}" arrives only after country_guides.json resolves, so a
     MutationObserver re-sorts. It watches childList on the row itself, and the
     re-sort only moves existing children (appendChild of a node already in the
     row is a move, not an insertion), so it settles rather than looping. */
  (function _extrasThemeOrder() {
    var RANK = {
      /* Eat & drink */
      'cappuccino': 10, 'restaurants': 11, 'downtown': 12, 'local-tastes': 13,
      'food-delivery': 14, 'michelin': 15,
      /* Get around */
      'getting-around': 20, 'stations-near-hotel': 21, 'day-trips-by-train': 22,
      /* Plan & do */
      'weekly-closures': 30, 'tours': 31, 'shows': 32, 'pickleball': 33,
      'heads-up': 34, 'worth-knowing': 35
      /* Elsewhere on the site — everything else, ranked below */
    };
    var ELSEWHERE = 90;
    var row = null, sorting = false;

    function _rank(a) {
      var h = a.getAttribute('href') || '';
      var i = h.indexOf('#');
      if (i === -1) return ELSEWHERE;                 /* links to another page */
      var r = RANK[h.slice(i + 1)];
      return typeof r === 'number' ? r : ELSEWHERE;
    }

    function _sort() {
      if (!row || sorting) return;
      var chips = [].slice.call(row.querySelectorAll(':scope > a.overview-extra-link'));
      if (chips.length < 2) return;
      /* decorate-sort-undecorate keeps it stable across engines */
      var ordered = chips.map(function(a, i) { return { a: a, r: _rank(a), i: i }; })
                         .sort(function(x, y) { return x.r - y.r || x.i - y.i; });
      var same = ordered.every(function(o, i) { return o.i === i; });
      if (same) return;
      sorting = true;
      var frag = document.createDocumentFragment();
      ordered.forEach(function(o) { frag.appendChild(o.a); });
      row.appendChild(frag);
      sorting = false;
    }

    function _init() {
      if (!isRealGuide) return;
      row = document.querySelector('.overview-extras:not(#ics-pill-row)');
      if (!row) return;
      _sort();
      if (typeof MutationObserver === 'function') {
        new MutationObserver(function() { _sort(); }).observe(row, { childList: true });
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _init);
    } else { _init(); }
  }());

  /* ── Trip Overview day rows → left rail + soft stop list + stop count ──────
     The day rows ship as one 15px run — "Day 1 · Stop · Stop · Stop" — with no
     fixed left edge and no fixed right edge, so five rows of different lengths
     read as five underlined sentences rather than one table. This splits each
     row into three columns without touching a single guide's HTML:

         [ DAY 1 ]  Chihuly Garden and Glass · Space Needle · …   [ 4 stops ]

     Purely presentational, and applied at runtime — the guide HTML keeps its
     canonical "Day N · stop · stop" single-string title, so every static check
     that reads .overview-day-title (must start with "Day ", label-appears-once,
     stop-count sync) sees exactly what it saw before.

     Rows whose title does not match the canonical shape are LEFT ALONE rather
     than half-transformed — a guide with an unexpected format degrades to the
     old rendering instead of losing its stop names.

     Train Days keep their full "🚆 Train Day · {Destination}" body and get no
     stop count: per Trip Overview.html §2 a Train Day card carries no inline
     stop list, and the validator's own count-sync skips them for that reason. */
  (function _dayRowRail() {
    var TITLE_RE = /^\s*(Day\s+\d+)\s*[·–—-]\s*([\s\S]+)$/;

    function _stopCount(anchor) {
      /* Count the real .stop-block elements in the day this row links to —
         more truthful than counting separators in the title, which a stop name
         containing a "·" would inflate. Falls back to the title segments. */
      var href = anchor.getAttribute('href') || '';
      if (href.charAt(0) === '#') {
        var block = document.getElementById(href.slice(1));
        if (block) {
          var n = block.querySelectorAll('.stop-block').length;
          if (n) return n;
        }
      }
      return 0;
    }

    function _apply() {
      var rows = document.querySelectorAll('.overview-day');
      if (!rows.length) return;
      [].forEach.call(rows, function(row) {
        var title = row.querySelector('.overview-day-title');
        if (!title || title.querySelector('.ovd-num')) return;   /* already done */
        var m = TITLE_RE.exec(title.textContent);
        if (!m) return;                                          /* unknown shape — leave it */

        var label = m[1].trim();
        var body  = m[2].trim();
        var isTrainDay = body.indexOf('Train Day') !== -1;

        var num = document.createElement('span');
        num.className = 'ovd-num';
        num.textContent = label;

        var stops = document.createElement('span');
        stops.className = 'ovd-stops';
        stops.textContent = body;

        title.textContent = '';
        title.appendChild(num);
        title.appendChild(stops);

        if (!isTrainDay) {
          var n = _stopCount(row);
          if (n) {
            var cnt = document.createElement('span');
            cnt.className = 'ovd-count';
            cnt.textContent = n + (n === 1 ? ' stop' : ' stops');
            title.appendChild(cnt);
          }
        }
        row.classList.add('tve-railed');
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _apply);
    } else { _apply(); }
  }());

  /* ── Photo lightbox — guide pages only ────────────────────────────────────
     Click any .stop-photos img to open a fullscreen overlay with the photo
     at full resolution, the stop name as a caption, and left/right navigation
     through all photos within the same day block. Keyboard: ← → Escape.
     Mobile: swipe left/right to navigate, tap outside photo to close.
     Zero guide HTML changes — all state is in JS. */
  (function _initPhotoLightbox() {
    if (!isRealGuide) return;

    /* ── Inject styles ── */
    var style = document.createElement('style');
    style.textContent =
      '#tve-lb{display:none;position:fixed;inset:0;z-index:10000;' +
        'background:rgba(0,0,0,.92);flex-direction:column;align-items:center;' +
        'justify-content:center;gap:0;box-sizing:border-box;' +
        'touch-action:pan-y pinch-zoom}' +
      '#tve-lb.open{display:flex}' +
      '#tve-lb-img-wrap{position:relative;display:flex;align-items:center;' +
        'justify-content:center;max-width:min(92vw,1200px);max-height:80vh}' +
      '#tve-lb-img{max-width:100%;max-height:80vh;border-radius:6px;' +
        'object-fit:contain;display:block;user-select:none;-webkit-user-drag:none}' +
      '#tve-lb-cap{color:#e8e4dc;font-size:13px;font-weight:500;margin-top:14px;' +
        'text-align:center;max-width:min(92vw,1200px);' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
        'letter-spacing:0.01em}' +
      '#tve-lb-close{position:fixed;top:16px;right:18px;' +
        'color:#ccc;font-size:22px;line-height:1;cursor:pointer;' +
        'background:none;border:none;padding:6px 8px;' +
        'font-family:inherit;opacity:.8}' +
      '#tve-lb-close:hover{opacity:1}' +
      '.tve-lb-arrow{position:fixed;top:50%;transform:translateY(-50%);' +
        'background:none;border:none;color:#ccc;font-size:32px;line-height:1;' +
        'cursor:pointer;padding:12px 14px;opacity:.7;font-family:inherit}' +
      '.tve-lb-arrow:hover{opacity:1}' +
      '#tve-lb-prev{left:12px}' +
      '#tve-lb-next{right:12px}' +
      '@media(max-width:600px){' +
        '.tve-lb-arrow{font-size:24px;padding:8px 10px}' +
        '#tve-lb-prev{left:4px}#tve-lb-next{right:4px}' +
      '}' +
      '.stop-photos img{cursor:zoom-in}';
    document.head.appendChild(style);

    /* ── Build overlay DOM ── */
    var lb      = document.createElement('div');   lb.id = 'tve-lb';
    var imgWrap = document.createElement('div');   imgWrap.id = 'tve-lb-img-wrap';
    var img     = document.createElement('img');   img.id = 'tve-lb-img'; img.alt = '';
    var cap     = document.createElement('div');   cap.id = 'tve-lb-cap';
    var closeBtn = document.createElement('button'); closeBtn.id = 'tve-lb-close';
    closeBtn.textContent = '✕'; closeBtn.setAttribute('aria-label', 'Close');
    var prevBtn = document.createElement('button');
    prevBtn.id = 'tve-lb-prev'; prevBtn.className = 'tve-lb-arrow';
    prevBtn.textContent = '‹'; prevBtn.setAttribute('aria-label', 'Previous photo');
    var nextBtn = document.createElement('button');
    nextBtn.id = 'tve-lb-next'; nextBtn.className = 'tve-lb-arrow';
    nextBtn.textContent = '›'; nextBtn.setAttribute('aria-label', 'Next photo');

    imgWrap.appendChild(img);
    lb.appendChild(closeBtn);
    lb.appendChild(prevBtn);
    lb.appendChild(nextBtn);
    lb.appendChild(imgWrap);
    lb.appendChild(cap);
    document.body.appendChild(lb);

    /* ── State ── */
    var photos = [];   /* [{src, alt, caption}] for current day */
    var idx    = 0;

    function _show(list, i) {
      photos = list; idx = i;
      _render();
      lb.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function _hide() {
      lb.classList.remove('open');
      document.body.style.overflow = '';
      photos = []; idx = 0;
    }

    function _render() {
      var p = photos[idx];
      img.src = p.src; img.alt = p.alt;
      cap.textContent = p.caption;
      prevBtn.style.display = photos.length > 1 ? '' : 'none';
      nextBtn.style.display = photos.length > 1 ? '' : 'none';
    }

    function _prev() { if (!photos.length) return; idx = (idx - 1 + photos.length) % photos.length; _render(); }
    function _next() { if (!photos.length) return; idx = (idx + 1) % photos.length; _render(); }

    /* ── Attach click handlers after DOM ready ── */
    function _setup() {
      var days = [].slice.call(document.querySelectorAll('.day-block'));
      days.forEach(function(day) {
        /* Build photo list for this day */
        var dayPhotos = [];
        var blocks = [].slice.call(day.querySelectorAll('.stop-block'));
        blocks.forEach(function(block) {
          var nameEl = block.querySelector('.stop-name');
          var caption = nameEl ? nameEl.textContent.trim() : '';
          var imgs = [].slice.call(block.querySelectorAll('.stop-photos img'));
          imgs.forEach(function(image) {
            dayPhotos.push({ src: image.src, alt: image.alt || '', caption: caption });
          });
        });
        if (!dayPhotos.length) return;

        /* Wire each img in this day */
        var dayImgs = [].slice.call(day.querySelectorAll('.stop-photos img'));
        dayImgs.forEach(function(image, i) {
          image.addEventListener('click', function(e) {
            e.stopPropagation();
            _show(dayPhotos, i);
          });
        });
      });

      /* Close on backdrop click (outside the image) */
      lb.addEventListener('click', function(e) {
        if (e.target === lb || e.target === imgWrap) _hide();
      });
      closeBtn.addEventListener('click', _hide);
      prevBtn.addEventListener('click', function(e) { e.stopPropagation(); _prev(); });
      nextBtn.addEventListener('click', function(e) { e.stopPropagation(); _next(); });

      /* Keyboard */
      document.addEventListener('keydown', function(e) {
        if (!lb.classList.contains('open')) return;
        if (e.key === 'ArrowLeft')  { _prev(); }
        if (e.key === 'ArrowRight') { _next(); }
        if (e.key === 'Escape')     { _hide(); }
      });

      /* Touch swipe */
      var touchStartX = 0;
      lb.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].clientX;
      }, { passive: true });
      lb.addEventListener('touchend', function(e) {
        var dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) < 40) return;   /* too short — treat as tap */
        if (dx < 0) _next(); else _prev();
      }, { passive: true });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _setup);
    } else {
      _setup();
    }
  }());


  /* ── Copy Day as Text — per-day plain-text itinerary export ─────────────────
     A "Copy day" button in every .day-header that writes the whole day to the
     clipboard as plain text: the day label, the From-Hotel line, then each stop
     in order with its number, name, address, and the transit hop to the next
     stop — finishing with a deep link back to that day.

     Deliberately NOT a full dump. Descriptions, hours, ticket rows and photos
     stay out: the paste target is Notes or a WhatsApp message to whoever you're
     travelling with, where the useful payload is "where we're going, in what
     order, and how we get between them". A guide day pasted in full would be
     several screens of scrolling and would not survive the trip.

     Zero guide HTML changes and no guide-style.css dependency — the markup and
     its CSS are both injected here, so the feature lands on all 235 guides at
     once and cannot drift out of sync with a stylesheet.

     Placement note: .day-header is itself the collapse toggle (guide-style.css
     .day-header{cursor:pointer} + .day-block.collapsed), so every handler here
     stops propagation — otherwise copying a day would also fold it shut. The
     button sits after the label text and before the ::after chevron, which the
     header's `margin-left:auto` keeps pinned right. ── */
  function _injectCopyDayButtons() {
    if (!isRealGuide) return;

    /* Note: the day-blocks are queried inside _setup(), not here. toolbar.js is
       a blocking <script> immediately after <body>, so at call time the body is
       present but the day markup has not been parsed yet — a query up here
       returns an empty list on every guide. */

    var _copySvg =
      '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
        '<rect x="1" y="1" width="7" height="7" rx="1.4" stroke="currentColor" stroke-width="1.3"/>' +
        '<path d="M4 11h6a1 1 0 0 0 1-1V4" stroke="currentColor" stroke-width="1.3" ' +
          'stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
    var _okSvg =
      '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
        '<path d="M2 6l3 3 5-5" stroke="#b85c2a" stroke-width="1.8" ' +
          'stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';

    var _cdCss = document.createElement('style');
    _cdCss.id = 'tve-copy-day-css';
    _cdCss.textContent =
      '.tve-copy-day-btn{background:none;border:none;cursor:pointer;' +
      'color:#a8a09a;padding:0;margin-left:14px;line-height:1;' +
      'display:inline-flex;align-items:center;gap:5px;flex-shrink:0;' +
      'font-family:inherit;font-size:11.5px;font-weight:600;letter-spacing:.01em;}' +
      '.tve-copy-day-btn:hover,.tve-copy-day-btn:focus-visible{color:#b85c2a;}' +
      '.tve-copy-day-btn:focus-visible{outline:2px solid #b85c2a;' +
      'outline-offset:3px;border-radius:4px;}' +
      '.tve-copy-day-btn.copied{color:#b85c2a;}';
    (document.head || document.documentElement).appendChild(_cdCss);

    /* Header label without anything injected into it — the mark-stops badge,
       this button and the § 40 "Map day" link all live in .day-header too. Any
       new control injected there has to be added to this selector list, or its
       own label leaks into the copied text as if it were part of the day name.
       (The old open-now filter note was removed with the filter itself;
       open/closed is now a per-stop badge in .stop-header, which never lands
       in this clone.) */
    function _dayLabel(hdr) {
      var clone = hdr.cloneNode(true);
      [].forEach.call(
        clone.querySelectorAll('.tve-copy-day-btn, .tve-map-day-link'),
        function (el) { el.parentNode.removeChild(el); }
      );
      return clone.textContent.replace(/\s+/g, ' ').trim();
    }

    /* Build the plain text for one .day-block. Walks DIRECT children in document
       order rather than querying stops and transit banners separately — the hop
       only makes sense glued to the stop it leaves from, and that pairing lives
       in the source order, not in either node list on its own. */
    /* City name comes from <title>, not .title-city. The banner element ships
       ALL CAPS in the source ("LISBON"), which is right for a headline and
       shouty in a message to someone — and re-casing it in JS cannot be done
       safely: any generic title-caser turns "Rio de Janeiro" into "Rio De
       Janeiro" and "Washington DC" into "Washington Dc". <title> already
       carries the correctly-cased name on all 235 guides, so read it there and
       do no transformation at all. .title-city is the fallback, used verbatim. */
    function _cityName() {
      var t = (document.title || '').replace(/\s+/g, ' ').trim();
      if (t) return t;
      var el = document.querySelector('.title-city');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    }

    function _dayText(block, hdr) {
      var city  = _cityName();
      var label = _dayLabel(hdr) || 'Day';

      var out = [city ? city + ' — ' + label : label, ''];

      var hotel = block.querySelector('.hotel-first');
      if (hotel) { out.push(hotel.textContent.replace(/\s+/g, ' ').trim(), ''); }

      var n = 0;
      [].forEach.call(block.children, function (el) {
        if (!el.classList) return;

        if (el.classList.contains('stop-block')) {
          n++;
          var nameEl = el.querySelector('.stop-name');
          var name   = nameEl ? nameEl.textContent.replace(/\s+/g, ' ').trim() : '';
          if (!name) { n--; return; }

          var numEl = el.querySelector('.stop-num');
          var num   = numEl ? numEl.textContent.replace(/\s+/g, ' ').trim() : (n + '.');
          if (num && num.slice(-1) !== '.') num += '.';

          out.push(num + ' ' + name);

          var mapEl = el.querySelector(
            'a[href*="google.com/maps"], a[href*="maps.google.com"]'
          );
          if (mapEl) {
            var addr = mapEl.textContent.replace(/\s+/g, ' ').trim();
            if (addr) out.push('   📍 ' + addr);
          }
          return;
        }

        if (el.classList.contains('next') ||
            el.classList.contains('next-tram') ||
            el.classList.contains('next-metro')) {
          /* A hop before any stop has been emitted has nothing to attach to. */
          if (!n) return;
          var hop = el.textContent.replace(/\s+/g, ' ').trim();
          if (hop) out.push('   ' + hop);
          out.push('');
        }
      });

      /* Trailing blank lines collapse to exactly one before the link. */
      while (out.length && out[out.length - 1] === '') out.pop();
      out.push('', location.href.replace(/#.*$/, '') + '#' + block.id);

      return out.join('\n');
    }

    /* Clipboard write with an execCommand fallback — the async Clipboard API is
       absent or rejects outside a secure context, and guides get opened from
       file:// and from the offline PWA cache. Returns a promise of a boolean. */
    function _write(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text)
          .then(function () { return true; })
          .catch(function () { return _writeLegacy(text); });
      }
      return Promise.resolve(_writeLegacy(text));
    }

    function _writeLegacy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;';
      document.body.appendChild(ta);
      var ok = false;
      try {
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        ok = document.execCommand('copy');
      } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }

    function _setup() {
      var dayBlocks = document.querySelectorAll('.day-block[id^="day"]');
      if (!dayBlocks.length) return;

      [].forEach.call(dayBlocks, function (block) {
        var hdr = block.querySelector(':scope > .day-header');
        if (!hdr || hdr.querySelector('.tve-copy-day-btn')) return;
        if (!block.querySelector('.stop-block')) return;

        var label = _dayLabel(hdr) || 'this day';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tve-copy-day-btn';
        btn.setAttribute('aria-label', 'Copy ' + label + ' as text');
        btn.setAttribute('title', 'Copy this day as plain text');
        btn.innerHTML = _copySvg + '<span>Copy day</span>';

        var resetTimer = null;
        function _flash(msg) {
          clearTimeout(resetTimer);
          btn.classList.add('copied');
          btn.innerHTML = _okSvg + '<span>' + msg + '</span>';
          resetTimer = setTimeout(function () {
            btn.classList.remove('copied');
            btn.innerHTML = _copySvg + '<span>Copy day</span>';
          }, 1800);
        }

        function _copy(e) {
          /* .day-header is the collapse toggle — never let this reach it. */
          e.preventDefault();
          e.stopPropagation();
          _write(_dayText(block, hdr)).then(function (ok) {
            _flash(ok ? 'Copied' : 'Press ⌘C');
          });
        }

        btn.addEventListener('click', _copy);
        btn.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { _copy(e); }
        });

        hdr.appendChild(btn);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _setup);
    } else {
      _setup();
    }
  }
  _injectCopyDayButtons();

  /* ── "Map day" — the whole day as one Google Maps route ───────────────────
     A link (.tve-map-day-link) next to Copy day in every .day-header. It opens
     that day's stops as a single multi-waypoint route: first stop = origin,
     last stop = destination, everything between = waypoints. Zero guide HTML —
     every place string is already in the DOM.

     ── Where the place string comes from, and why not "{name}, {city}" ──
     Each stop carries an authored 📍 row whose href is a Maps search URL
     (?api=1&query=Louvre Abu Dhabi Saadiyat Cultural District Abu Dhabi). That
     query is the exact string the guide author already confirmed resolves to
     the right pin, so reusing it lands the route on the same places the
     per-stop links do. The link's visible text is NOT usable on its own — it is
     the address fragment only ("Saadiyat Cultural District · Saadiyat Island")
     and frequently omits the place name. "{stop name}, {city}" is the fallback
     for a stop with no address row: a guess, not a source.

     ── travelmode=walking ──
     A guide day is a walking cluster by construction — optimize_route.py groups
     each day geographically and the .next banners lead with 🚶. Google's own
     default is driving, which sends a compact old-town day the long way round
     one-way systems and pedestrian zones. Switching mode inside Maps is one
     tap; landing on the wrong one costs more than that.

     ── Placement note ── same trap as § 30: .day-header IS the collapse toggle
     (guide-style.css .day-header{cursor:pointer} + .day-block.collapsed), so
     both handlers stop propagation — otherwise opening the route would fold
     the day shut behind it. keydown stops propagation WITHOUT preventDefault:
     the header's own keydown calls preventDefault unconditionally, which would
     swallow the anchor's native Enter activation. ── */
  function _injectMapDayLinks() {
    if (!isRealGuide) return;

    var _pinSvg =
      '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
        '<path d="M6 1.2c1.9 0 3.4 1.5 3.4 3.4 0 2.4-3.4 6.2-3.4 6.2S2.6 7 2.6 4.6C2.6 2.7 4.1 1.2 6 1.2z" ' +
          'stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>' +
        '<circle cx="6" cy="4.6" r="1.25" stroke="currentColor" stroke-width="1.2"/>' +
      '</svg>';

    /* Same self-styled idiom as #tve-copy-day-css (§ 30): classes, but the
       rules ship inside toolbar.js so there is no guide-style.css half to
       drift against. Below 480px the label is dropped and the pin stands
       alone — the day label, Copy day and this control share one flex row, and
       a third word wraps the header on a phone. aria-label carries the meaning
       either way, so nothing is lost when the text is gone. */
    var _mdCss = document.createElement('style');
    _mdCss.id = 'tve-map-day-css';
    _mdCss.textContent =
      '.tve-map-day-link{text-decoration:none;cursor:pointer;' +
      'color:#a8a09a;padding:0;margin-left:14px;line-height:1;' +
      'display:inline-flex;align-items:center;gap:5px;flex-shrink:0;' +
      'font-family:inherit;font-size:11.5px;font-weight:600;letter-spacing:.01em;}' +
      '.tve-map-day-link:hover,.tve-map-day-link:focus-visible{color:#b85c2a;}' +
      '.tve-map-day-link:focus-visible{outline:2px solid #b85c2a;' +
      'outline-offset:3px;border-radius:4px;}' +
      '@media (max-width:480px){.tve-map-day-link span{display:none;}' +
      '.tve-map-day-link{margin-left:12px;}}';
    (document.head || document.documentElement).appendChild(_mdCss);

    /* City name from <title>, not .title-city — the banner ships ALL CAPS and
       no generic re-caser survives "Rio de Janeiro". Same reasoning as § 30. */
    function _cityName() {
      var t = (document.title || '').replace(/\s+/g, ' ').trim();
      if (t) return t;
      var el = document.querySelector('.title-city');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    }

    function _dayLabel(hdr) {
      var clone = hdr.cloneNode(true);
      [].forEach.call(
        clone.querySelectorAll('.tve-copy-day-btn, .tve-map-day-link'),
        function (el) { el.parentNode.removeChild(el); }
      );
      return clone.textContent.replace(/\s+/g, ' ').trim();
    }

    function _placeToken(sb, city) {
      var a = sb.querySelector(
        'a[href*="google.com/maps"], a[href*="maps.google.com"]'
      );
      if (a) {
        /* getAttribute, not .href — the authored hrefs carry literal spaces,
           and reading the property returns them percent-encoded for no gain. */
        var m = /[?&]query=([^&#]*)/.exec(a.getAttribute('href') || '');
        if (m) {
          var q = m[1].replace(/\+/g, ' ');
          /* A stray % in an authored address is not a valid escape sequence
             and throws — the raw string is still a usable Maps query. */
          try { q = decodeURIComponent(q); } catch (e) { /* keep raw */ }
          q = q.replace(/\s+/g, ' ').trim();
          if (q) return q;
        }
      }
      var nameEl = sb.querySelector('.stop-name');
      var name = nameEl ? nameEl.textContent.replace(/\s+/g, ' ').trim() : '';
      if (!name) return '';
      return city ? name + ', ' + city : name;
    }

    function _dayUrl(block, city) {
      var places = [];
      [].forEach.call(block.querySelectorAll('.stop-block'), function (sb) {
        var p = _placeToken(sb, city);
        /* A repeat of the previous token makes Maps draw a zero-length leg. */
        if (p && p !== places[places.length - 1]) places.push(p);
      });
      /* One stop is not a route — the stop's own 📍 link already covers it. */
      if (places.length < 2) return '';

      var origin = places.shift();
      var dest   = places.pop();
      /* Google's dir URL scheme takes at most 9 intermediate waypoints. The
         longest shipped guide day holds 9 stops (7 intermediates), so this
         never trims today; it is here so a longer day degrades to a valid
         route instead of a URL Maps refuses outright. */
      var mid = places.slice(0, 9);

      return 'https://www.google.com/maps/dir/?api=1' +
        '&origin=' + encodeURIComponent(origin) +
        '&destination=' + encodeURIComponent(dest) +
        (mid.length
          ? '&waypoints=' + mid.map(encodeURIComponent).join('%7C')
          : '') +
        '&travelmode=walking';
    }

    function _setup() {
      var dayBlocks = document.querySelectorAll('.day-block[id^="day"]');
      if (!dayBlocks.length) return;

      var city = _cityName();

      [].forEach.call(dayBlocks, function (block) {
        var hdr = block.querySelector(':scope > .day-header');
        if (!hdr || hdr.querySelector('.tve-map-day-link')) return;

        var url = _dayUrl(block, city);
        if (!url) return;

        var label = _dayLabel(hdr) || 'this day';

        var a = document.createElement('a');
        a.className = 'tve-map-day-link';
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.setAttribute('aria-label', 'Open ' + label + ' as a route in Google Maps');
        a.setAttribute('title', 'Open this day as one Google Maps route');
        a.innerHTML = _pinSvg + '<span>Map day</span>';

        a.addEventListener('click', function (e) { e.stopPropagation(); });
        a.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); }
        });

        /* Before Copy day when it is there, so the header reads
           label · Map day · Copy day · › — route first, export second. */
        var copyBtn = hdr.querySelector('.tve-copy-day-btn');
        if (copyBtn) { hdr.insertBefore(a, copyBtn); } else { hdr.appendChild(a); }
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _setup);
    } else {
      _setup();
    }
  }
  _injectMapDayLinks();

  /* ── Stop-type filter chips — Trip Overview ─────────────────────────────────
     A chip row at the foot of the Trip Overview card: All · Museums ·
     Historic · Landmarks · Nature · Views · Streets · Food · Fun, each
     carrying its count for THIS guide. Picking one hides every .stop-block
     that is not of that type and drops any .day-block left with no visible
     stop. "All" puts the guide back exactly as it shipped.

     ── NO ICONS ON THE CHIPS (owner rule 2026-08-09) ──
     The row shipped as "🏛 Museums 8 · ⛪ Historic 5 · …" and the owner cut the
     glyphs outright: "i do not want the icon! remove!" The chips carry the
     word and the count, nothing else. This is the same call already made for
     the day opener (🏨, 2026-08-08) and the train-day arrival banner (,
     2026-08-09) — a control leads with words, not a picture. There is no
     `emoji` field on a category any more, deliberately: an unused one is an
     invitation to put them back.

     ── Why the classifier reads the stop NAME, not an emoji ──
     The original proposal assumed each .stop-header opens with a stop-type
     emoji that could simply be read off. It does not: of 2,932 stop headers
     across the 216 shipped guides, 16 carry any emoji at all (0.5%), and those
     16 are part of the place name, not a category mark. Icon Order and Format
     confirms it by design — the per-stop icon vocabulary is FUNCTIONAL (🕐
     hours, ⏰ duration, 🚫 closed days, 📍 address, 🚶/🚕 motion), and 🏛 is
     banned inside a stop outright. There is no authored stop-type signal
     anywhere in a guide, so one is derived here from the text that IS there.

     The signal, in order:
       1. The stop NAME against a head-noun lexicon (accent-folded, whole-word).
          "Musée Granet" → museums, "Parque Forestal" → nature, "Torre
          Malakoff" → views. A name may hit several categories and KEEPS them
          all — "Monte Palace Tropical Garden" is filed under both Historic and
          Nature. Recall matters more than precision for a filter: the cost of
          an extra stop appearing under Nature is trivial next to the cost of
          the garden going missing when a reader asks for it. Measured over all
          2,932 stops: 94% take one label, 5% two, 0.2% three.
       2. No name hit → the description, but only against MULTI-WORD phrases
          ("botanical garden", "observation deck", "food market") plus a short
          list of unambiguous single words. Bare words like "market" or
          "coffee" in a description filed towns and art centres under Food, so
          they are name-only terms.
       3. Still nothing → 🗿 Landmarks. This is a real bucket with an honest
          label, not a dumping ground: it is 19.6% of stops and it holds the
          Burj Khalifas, Cristo Redentors and Corpus Clocks — things that are
          precisely landmarks and nothing narrower. Nothing is unreachable.
     Name signal covers 65.7% of stops, description a further 14.7%.

     ── Why the route lines go with the stops ──
     A .next banner reads "🚶 6 min · 🚕 4 min → Trevi Fountain". With Trevi
     Fountain filtered out that banner is pointing at nothing, and the walking
     times between the stops that DO remain are not the authored ones anyway.
     So while a filter is on, every .next / .next-tram / .next-metro /
     .hotel-first / .arrive-first is hidden, and the day flow returns intact
     on "All".

     ── The All chip IS the readout, and it counts what is HIDDEN ──
     Its number is not the fixed total. At rest it shows every stop; the moment
     a chip is picked it becomes total MINUS visible — the stops the filter is
     holding back. Pick a chip of 4 on a 28-stop guide and All reads 24.
     Owner, 2026-08-09: "the 28 gets reduced by the number i am seeing", and,
     when the first attempt showed the visible count instead, "28 minus 4 is
     not 4". It is a subtraction, not a substitution — the natural reading of
     All is "how much more there is", so the number next to it is the remainder.

     This replaced a sentence printed under the row — "Showing 1 of 28 stops —
     walking and ride times between stops are hidden while a filter is on. Pick
     All to restore the day flow." The owner cut it the same day: the count
     belongs on the control, not in prose beneath it. Do not reinstate the
     sentence, and do not "correct" the number back to the visible count; if
     this needs to say more it says it in the chip's title/aria-label.

     Deliberately NOT persisted. A reader who filtered yesterday and came back
     to a guide missing two thirds of its stops would read that as a broken
     page, not as their own filter — so every load starts on All.

     Collapse state is borrowed, not overwritten: a day that is collapsed but
     holds matches opens for the duration of the filter and re-collapses on
     "All". Days are never auto-collapsed — the retired open-now filter did
     that and the owner's objection to it stands (Trip Overview, 2026-08-08).

     Zero guide HTML changes, and the CSS is injected here rather than added to
     guide-style.css, so the feature lands on all 216 guides at once and cannot
     drift out of sync with a stylesheet. ── */
  function _injectStopTypeFilter() {
    if (!isRealGuide) return;

    /* Head-noun lexicon, accent-folded and matched whole-word. Multilingual
       because guide stop names are: a Portuguese "igreja" and a German
       "kirche" are the same category as an English "church". */
    var CATS = [
      { key: 'museums', label: 'Museums',
        name: ['museum','museums','museo','musee','museu','muzeum','museet','gallery','galleries',
               'galleri','galerie','galleria','pinacoteca','exhibition','library','biblioteca',
               'archives','kunsthalle','collection','filmmuseum','stadtmuseum'],
        desc: ['museum','art gallery','permanent collection','exhibition space','national gallery'] },
      { key: 'historic', label: 'Historic',
        name: ['palace','palazzo','palais','paleis','palacio','qasr','castle','castel','castello',
               'chateau','schloss','kasteel','castillo','fort','fortress','fortaleza','forte',
               'citadel','citadelle','kremlin','cathedral','catedral','cathedrale','duomo','basilica',
               'basilique','church','iglesia','igreja','chiesa','kirche','kerk','eglise','chapel',
               'capilla','capela','abbey','monastery','mosteiro','convent','convento','cloister',
               'mosque','mezquita','moschee','synagogue','temple','templo','tempel','shrine','pagoda',
               'wat','taisha','jinja','ruins','ruinas','forum','amphitheatre','amphitheater',
               'anfiteatro','acropolis','pyramid','pyramids','tomb','tombs','necropolis','mausoleum',
               'memorial','monument','monumento','archaeological','archeological','manor','mansion',
               'villa','cemetery','crypt','catacombs','catacombe','baths','thermes','aqueduct',
               'city hall','town hall','rathaus','parliament','birthplace','casa','haus','hus',
               'salt mine','lighthouse','farol','faro','windmill','molen'],
        desc: ['cathedral','basilica','archaeological','world heritage','monastery','baroque',
               'gothic','renaissance','medieval','roman ruins','buddhist temple','hindu temple',
               'royal palace','moorish','byzantine'] },
      { key: 'nature', label: 'Nature',
        name: ['park','parc','parque','parken','garden','gardens','jardin','jardins','jardim',
               'giardino','giardini','botanic','botanicus','botanico','botanical','arboretum','hortus',
               'beach','beaches','playa','praia','strand','plage','spiaggia','lake','lago','lac','meer',
               'loch','waterfall','waterfalls','falls','cascade','cascades','glacier','fjord','forest',
               'bosque','woods','woodland','rainforest','jungle','volcano','crater','canyon','gorge',
               'cave','caves','cavern','grotto','dunes','dunas','lagoon','lagoa','wetland',
               'nature reserve','national park','trail','trails','springs','geyser','oasis','marsh',
               'moor','meadow','valley','valle','island','islands','isla','ilha','insel','cliffs',
               'reef','sanctuary','preserve','pond','river','riverside','bay','cove','hills','mountain',
               'mountains','mount','alps','glen','tundra','safari','rice terraces','pointe','cape',
               'peninsula','atoll'],
        desc: ['botanical garden','national park','nature reserve','public park','city park',
               'sandy beach','hiking trail','walking trail','waterfall','glacier','volcano',
               'rainforest','wildlife','nature park','lagoon','hot springs','coral reef',
               'mountain range','crater lake','sand dunes'] },
      { key: 'views', label: 'Views',
        name: ['tower','torre','turm','toren','tarn','observation deck','observatory','viewpoint',
               'view point','lookout','mirador','miradouro','mirante','belvedere','panorama','skywalk',
               'sky walk','skydeck','sky deck','cable car','cableway','funicular','gondola',
               'aerial tram','overlook','campanile','bell tower','belfry','minaret','skypod','summit',
               'peak'],
        desc: ['observation deck','panoramic view','panoramic views','viewing platform',
               'observation tower','sweeping views','city panorama','viewing deck','vantage point',
               'views over the','looks out over'] },
      { key: 'streets', label: 'Streets',
        name: ['square','squares','piazza','piazzale','plaza','platz','plein','place','praca','largo',
               'bridge','bridges','ponte','pont','puente','brucke','brug','street','streets','strasse',
               'straat','boulevard','avenue','promenade','waterfront','harbour','harbor','marina',
               'quay','wharf','pier','boardwalk','baywalk','corso','quarter','district',
               'neighbourhood','neighborhood','old town','altstadt','medina','alley','lane','steps',
               'gate','arch','canal','canals','embankment','esplanade','village','town','rambla',
               'passage','arcade','corniche','malecon','paseo','cours'],
        desc: ['neighbourhood','neighborhood','old town','pedestrian street','main square',
               'shopping street','historic quarter','waterfront promenade','city square',
               'market square','fishing village','seaside town','hilltop town','historic centre',
               'historic center'] },
      { key: 'food', label: 'Food',
        name: ['market','markt','marktplatz','mercado','mercat','mercato','marche','halles','bazaar',
               'bazar','souk','souq','brewery','brauerei','brewpub','winery','wineries','wine cellars',
               'bodega','distillery','vineyard','vineyards','cellars','food hall','cafe','caffe',
               'patisserie','bakery','teahouse','tea house','wine estate','domaine','olhallen',
               'cheese','chocolaterie','taberna','trattoria'],
        desc: ['food market','street food','food hall','covered market','farmers market','night market',
               'fish market','produce market','wine tasting','tasting room','market stalls',
               'food stalls','brewery','winery','distillery'] },
      { key: 'fun', label: 'Fun',
        name: ['zoo','aquarium','oceanarium','theme park','amusement park','water park','waterpark',
               'funfair','stadium','stadion','arena','racetrack','raceway','casino','opera',
               'operahouse','concert hall','theatre','theater','teatro','cinema','planetarium','tivoli',
               'prater','ferris wheel','safari park','wildlife park','ski resort','philharmonie',
               'konzerthaus','music hall','dolphinarium','aquaventure','waterworld','circus',
               'auditorium','kursaal','speedway','racecourse'],
        desc: ['theme park','amusement park','water park','roller coaster','opera house','concert hall',
               'football stadium','zoo','aquarium','live music','puppet theatre','circus'] }
    ];
    var RESIDUAL = { key: 'landmark', label: 'Landmarks' };

    /* Strip diacritics so one lexicon entry covers every spelling a guide uses
       — "jardin" has to reach "Jardín", "Jardim" and "Jardins". */
    function _fold(s) {
      s = String(s).toLowerCase();
      return s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
    }

    /* Germanic and Nordic guide names glue the head noun onto the proper noun —
       Vondelpark, Rijksmuseum, Rembrandtplein, Fernsehturm, Storgata. A
       whole-word lexicon misses every one of them, and the description pass
       then guesses: before this list existed, Vondelpark filed under Museums
       because its description ends "the perfect reset after a museum day".
       These terms therefore match as a word ENDING as well — right-guarded but
       not left-guarded. Only endings that are unambiguous carry: "burg" and
       "dom" are absent because they would swallow Hamburg and half of Italy. */
    var SUFFIX = {
      museums: ['museum','museums','museet','museo','muzeum','galleriet','biblioteket','bibliotek'],
      historic: ['kirche','kirke','kirken','kyrka','kyrkan','kerk','kathedrale','kloster','moschee',
                 'slottet','slott','tempel','palast','palacio','katedralen'],
      nature: ['park','parken','parc','parque','garten','garden','gardens','hagen','skogen','stranden',
               'strand','beach','insel','fjorden','fjord','dalen','vatnet','oya'],
      views: ['tarnet','tornet','turm','tower'],
      /* -markt belongs to Streets, not Food: German and Dutch name their
         SQUARES that way — Gendarmenmarkt, Marktplatz, Alter Markt — while the
         genuine food halls spell it out (Markthalle, Naschmarkt is the rare
         crossover and reads fine under Streets). */
      streets: ['plein','platz','strasse','straat','gata','gatan','gade','torg','torget','broen','bron',
                'brucke','allee','gasse','kaien','kaia','markt','marktplatz','marked','markedet'],
      food: ['markthalle','mercado'],
      fun: ['teatret','teatern','stadion','teatro']
    };

    /* Whole-word alternation, longest term first so "national park" wins over
       "park". The guards are letter/digit classes rather than \b: \b would fire
       inside a folded accented word and match "faro" inside "farol". */
    function _rx(terms, openLeft) {
      var esc = terms.slice().sort(function (a, b) { return b.length - a.length; })
        .map(function (t) { return _fold(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
      return new RegExp((openLeft ? '' : '(?:^|[^0-9a-z])') +
        '(?:' + esc.join('|') + ')(?![0-9a-z])');
    }
    function _rxAll(terms) {
      var r = _rx(terms);
      return new RegExp(r.source, 'g');
    }
    CATS.forEach(function (c) {
      c.nameRx = _rx(c.name);
      c.sfxRx  = SUFFIX[c.key] ? _rx(SUFFIX[c.key], true) : null;
      c.descRx = _rxAll(c.desc);
    });

    function _classify(name, desc) {
      var n = _fold(name), out = [];
      CATS.forEach(function (c) {
        if (c.nameRx.test(n) || (c.sfxRx && c.sfxRx.test(n))) out.push(c.key);
      });
      if (out.length) return out;

      /* Description pass — only the categories tied for the most phrase hits,
         so a single stray word never outvotes a genuine two-hit match. */
      var d = _fold(desc), best = 0, tied = [];
      CATS.forEach(function (c) {
        c.descRx.lastIndex = 0;
        var n2 = (d.match(c.descRx) || []).length;
        if (!n2) return;
        if (n2 > best) { best = n2; tied = [c.key]; }
        else if (n2 === best) { tied.push(c.key); }
      });
      return tied.length ? tied : [RESIDUAL.key];
    }

    function _setup() {
      var ovSec = document.querySelector('.overview-section');
      var blocks = [].slice.call(document.querySelectorAll('.stop-block'));
      if (!ovSec || blocks.length < 4) return;                  /* nothing to filter */
      if (document.getElementById('tve-stf')) return;           /* already injected */

      /* Classify every stop once. The description is the first .stop-row —
         the narrative line every stop carries per Icon Order and Format § 2. */
      var counts = {}, stops = [];
      blocks.forEach(function (sb) {
        var nameEl = sb.querySelector('.stop-name');
        if (!nameEl) return;
        var row = sb.querySelector('.stop-row');
        var cats = _classify(nameEl.textContent.trim(), row ? row.textContent : '');
        cats.forEach(function (k) { counts[k] = (counts[k] || 0) + 1; });
        stops.push({ el: sb, cats: cats });
      });
      if (!stops.length) return;

      var shown = CATS.concat([RESIDUAL]).filter(function (c) { return counts[c.key]; });
      if (shown.length < 2) return;      /* one bucket — a filter would do nothing */

      var dayBlocks = [].slice.call(document.querySelectorAll('.day-block'));
      var connectives = [].slice.call(document.querySelectorAll(
        '.next, .next-tram, .next-metro, .hotel-first, .arrive-first'));

      /* ── CSS. Rest/hover reuse the guide's own chip tokens (--c-pill-*), so
         light and dark both come free; the selected chip takes the terracotta
         gradient that every other active chip on the site uses. ── */
      var css = document.createElement('style');
      css.id = 'tve-stf-css';
      css.textContent =
        '#tve-stf{margin:14px 0 4px;padding-top:12px;' +
        'border-top:1px solid rgba(138,108,26,.18);}' +
        '#tve-stf .tve-stf-lead{display:block;font-size:11px;font-weight:700;' +
        'letter-spacing:.06em;text-transform:uppercase;color:#a8a09a;margin-bottom:8px;}' +
        '#tve-stf .tve-stf-row{display:flex;flex-wrap:wrap;gap:8px;}' +
        '.tve-stf-chip{display:inline-flex;align-items:center;gap:6px;' +
        'font-family:inherit;font-size:13px;font-weight:normal;line-height:1.2;' +
        'color:var(--c-pill-text);background:var(--c-pill-bg);' +
        'border:1px solid var(--c-pill-bd);border-radius:20px;padding:6px 12px;' +
        'cursor:pointer;white-space:nowrap;' +
        'transition:background .15s,border-color .15s,color .15s;}' +
        '.tve-stf-chip .tve-stf-n{font-size:11px;opacity:.65;font-variant-numeric:tabular-nums;}' +
        '@media (hover:hover){.tve-stf-chip:hover{background:var(--c-pill-hover);' +
        'border-color:var(--c-pill-bd-hover);}}' +
        '.tve-stf-chip:focus-visible{outline:2px solid #b85c2a;outline-offset:2px;}' +
        /* #fff, not #b85c2a — the gradient's own midpoint IS #b85c2a, so terracotta
           text on it renders at ~1:1 contrast and the selected chip's label
           disappears (owner spotted "All 24" unreadable on Buenos Aires,
           2026-08-10). Every other element on the site that takes this fill pairs
           it with white: .pkl-chip.on, .pkl-nav a.active, .country-chip.active,
           .dest-card:hover, #btn-my-trips:active. The dark-theme variant below
           already got this right (#f5efe6). */
        '.tve-stf-chip.is-on{background:linear-gradient(135deg,#7a3b1e 0%,#b85c2a 55%,#d4874a 100%);' +
        'border-color:#b85c2a;color:#fff;}' +
        '.tve-stf-chip.is-on .tve-stf-n{opacity:.85;}' +
        '@media (hover:hover){.tve-stf-chip.is-on:hover{' +
        'background:linear-gradient(135deg,#7a3b1e 0%,#b85c2a 55%,#d4874a 100%);' +
        'border-color:#b85c2a;}}' +
        '.overview-day.tve-stf-dim{opacity:.35;pointer-events:none;}' +
        ':root[data-theme="dark"] #tve-stf{border-top-color:rgba(212,184,150,.16);}' +
        ':root[data-theme="dark"] #tve-stf .tve-stf-lead{color:#8a827a;}' +
        ':root[data-theme="dark"] .tve-stf-chip.is-on{' +
        'background:linear-gradient(135deg,#5a2a10 0%,#8a3f18 55%,#a85e28 100%);' +
        'border-color:#a85e28;color:#f5efe6;}' +
        '@media (hover:hover){:root[data-theme="dark"] .tve-stf-chip.is-on:hover{' +
        'background:linear-gradient(135deg,#5a2a10 0%,#8a3f18 55%,#a85e28 100%);' +
        'border-color:#a85e28;}}';
      (document.head || document.documentElement).appendChild(css);

      /* ── Markup ── */
      var wrap = document.createElement('div');
      wrap.id = 'tve-stf';

      var lead = document.createElement('span');
      lead.className = 'tve-stf-lead';
      lead.textContent = 'Show only';
      wrap.appendChild(lead);

      var row = document.createElement('div');
      row.className = 'tve-stf-row';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', 'Filter stops by type');
      wrap.appendChild(row);

      var chips = [], allChip = null, allCount = null;
      function _chip(key, text, count) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'tve-stf-chip';
        b.setAttribute('data-cat', key);
        b.setAttribute('aria-pressed', key === 'all' ? 'true' : 'false');
        if (key === 'all') b.classList.add('is-on');
        b.appendChild(document.createTextNode(text));
        var n = document.createElement('span');
        n.className = 'tve-stf-n';
        n.textContent = count;
        b.appendChild(n);
        if (key === 'all') { allChip = b; allCount = n; }
        b.addEventListener('click', function () { _apply(key); });
        row.appendChild(b);
        chips.push(b);
      }
      _chip('all', 'All', stops.length);
      shown.forEach(function (c) { _chip(c.key, c.label, counts[c.key]); });

      /* The All chip's number is the live "how many am I looking at" readout —
         it drops to the visible count while a filter is on and returns to the
         total on All. That replaced a sentence under the row ("Showing 1 of 28
         stops — …"), which the owner cut on 2026-08-09: the count belongs on
         the control, not in a line of prose beneath it. aria-live moves with
         it so the change is still announced with the status text gone. */
      if (allCount) allCount.setAttribute('aria-live', 'polite');
      if (allChip) {
        allChip.setAttribute('title', 'Showing all ' + stops.length + ' stops');
        allChip.setAttribute('aria-label',
          'Show all stops — all ' + stops.length + ' showing');
      }

      /* ── Filtering ── */
      function _apply(cat) {
        var all = cat === 'all', visible = 0;

        stops.forEach(function (s) {
          var on = all || s.cats.indexOf(cat) !== -1;
          s.el.style.display = on ? '' : 'none';
          if (on) visible++;
        });
        connectives.forEach(function (el) { el.style.display = all ? '' : 'none'; });

        var hiddenDays = {};
        dayBlocks.forEach(function (db) {
          var live = 0;
          [].forEach.call(db.querySelectorAll('.stop-block'), function (sb) {
            if (sb.style.display !== 'none') live++;
          });
          if (!all && !live) {
            db.style.display = 'none';
            if (db.id) hiddenDays[db.id] = true;
          } else {
            db.style.display = '';
          }
          /* Borrow the collapse, never force one: a collapsed day holding
             matches opens for the filter and re-collapses on All. */
          if (!all && live && db.classList.contains('collapsed')) {
            db.classList.remove('collapsed');
            db.setAttribute('data-tve-stf-recollapse', '1');
          } else if (all && db.getAttribute('data-tve-stf-recollapse')) {
            db.classList.add('collapsed');
            db.removeAttribute('data-tve-stf-recollapse');
          }
        });

        /* A Trip Overview row pointing at a filtered-out day would scroll
           nowhere — dim it and take it out of the tab order instead. */
        [].forEach.call(document.querySelectorAll('.overview-day'), function (a) {
          var href = a.getAttribute('href') || '';
          var dim = href.charAt(0) === '#' && hiddenDays[href.slice(1)];
          a.classList.toggle('tve-stf-dim', !!dim);
        });

        chips.forEach(function (b) {
          var on = b.getAttribute('data-cat') === cat;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });

        /* All's number is the TOTAL MINUS what you are looking at — the count
           of stops the filter is holding back, not the count on screen. Owner,
           2026-08-09: "the 28 gets reduced by the number i am seeing", and on
           the first attempt getting it wrong: "28 minus 4 is not 4". Picking a
           chip of 4 out of 28 leaves All reading 24. */
        var hidden = stops.length - visible;
        if (allCount) allCount.textContent = all ? stops.length : hidden;
        if (allChip) {
          allChip.setAttribute('title', all
            ? 'Showing all ' + stops.length + ' stops'
            : hidden + ' of ' + stops.length + ' stops hidden — pick All to restore the day flow');
          allChip.setAttribute('aria-label', all
            ? 'Show all stops — all ' + stops.length + ' showing'
            : 'Show all stops — ' + hidden + ' of ' + stops.length + ' currently hidden');
        }
      }

      /* Sits at the foot of the white Trip Overview card. .overview-extras is
         normally pulled out of the card before this runs; guard for both. */
      var extras = ovSec.querySelector(':scope > .overview-extras');
      if (extras) ovSec.insertBefore(wrap, extras);
      else ovSec.appendChild(wrap);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _setup);
    } else {
      _setup();
    }
  }
  _injectStopTypeFilter();

}());
