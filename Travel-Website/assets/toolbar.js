/**
 * toolbar.js — shared travel navigation bar
 *
 * ⚠️ HOME: Travel Website/assets/toolbar.js — site-wide shared asset.
 * The shared scripts/styles (toolbar.js, weather.js,
 * guide-style.css, mobile.css, climate.json) all live in assets/. Every page
 * loads them from assets/ at its own relative depth below the site root:
 *   · depth-1 pages (Guides-Index.html,
 *     essentials/<page>/index.html):              src="../../assets/toolbar.js"
 *   · depth-2 pages (guides/City/*.html,
 *     maps/<region>/index.html):                  src="../../assets/toolbar.js"
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

/* ── What counts as a phone — ONE definition, shared by CSS and JS ──────────
   Owner rule 2026-08-10: "somehow mobile got mixed with the desktop … needs to
   hold". A DESKTOP BROWSER NARROWED BY THE USER IS NOT A PHONE. Width alone
   cannot tell the two apart — the viewport reports 500px either way — so every
   mobile gate on this site pairs the width with the pointer type:

       CSS   @media (max-width: 600px) and (pointer: coarse)
       JS    TVE.isPhone()            ← the exact same query, below

   `pointer: coarse` is the PRIMARY input device: a finger on a phone or tablet,
   never a mouse or trackpad. A touchscreen laptop still reports `fine`, because
   its primary pointer is the trackpad. Resizing a desktop window changes the
   width and nothing else, so the desktop layout now holds all the way down.

   Desktop-only rules take the mirror form `(min-width: 601px), (pointer: fine)`
   — an OR, so they keep applying in a narrow desktop window.

   The nav's hamburger swap uses the same pairing at its own 1260px width.
   Enforced by brain_check.check_mobile_breakpoints_gated_on_pointer: a bare
   width-only 600/601/1260 query is a HARD FAIL. Spec: Toolbar.html § 42. */
window.TVE = window.TVE || {};
window.TVE.PHONE_MQ = '(max-width: 600px) and (pointer: coarse)';
window.TVE.isPhone = function () {
  return !!(window.matchMedia && window.matchMedia(window.TVE.PHONE_MQ).matches);
};

/* ══ TVE.home — the reader's HOME AIRPORT, one setting for the whole site ══
   Owner, 2026-08-15, looking at the landing-page finder: "this is all wired
   from my seattle and can't be."

   It was, and unavoidably so: FMAP is 237 hand-built Delta routings that all
   start at SEA — real legs, real hubs, real minutes — so every surface that
   asks "how far is this?" was answering for one person. A reader in Rome got
   Seattle's flight times with no way to say otherwise.

   The fix is NOT to throw the routings away. They are the best data the site
   has and they stay exact for the reader they describe. Instead:

     home is SEA  ->  FMAP verbatim. Nothing changes, nothing degrades.
     home is not  ->  a great-circle ESTIMATE from the reader's own airport,
                      always rendered with a leading "~" and never presented
                      as a routing. No hub is invented, no leg is claimed.

   WHAT IS ESTIMATED IS FLYING TIME, and that choice is the load-bearing one.
   Fitted against the 69 nonstop routings FMAP already holds — the ones where
   the great-circle IS the route — the constants are measured, not guessed:

       air minutes = 44 + km / 14        (14 km/min ≈ 840 km/h)

   Median error 3 minutes, mean 12, over everything from 130 km to 11,000 km.

   The first attempt modelled the whole JOURNEY, layovers included, by adding a
   connection allowance past 5,000 km. It fitted the 236 totals to a median of
   52 minutes and was still wrong in the way that matters: SEA–AMS is nonstop,
   and the model billed it 12h27 against a real 9h45. Whether a nonstop exists
   between two arbitrary airports is the largest single term in a journey time
   and is precisely what this cannot know. So it does not pretend to. It
   answers the question it can answer to within minutes and says which question
   that was: every surface labels an estimate as flying time. A reader who sees
   "~10h flying" and then connects has been told the truth; one shown a
   fabricated "AMS · 1 stop" has not.

   Storage is one key, and it deliberately mirrors tve_book_origin so the
   in-guide Hotels & Flights panel and this share one answer — a reader who
   types their home airport into a Flights search should never be asked for it
   again by the finder, and the reverse. Spec: Toolbar.html § 46. */
window.TVE.home = (function () {
  var KEY = 'tve_home_city';
  /* Seattle stays the fallback because it is the one home the site has exact
     data for: with no choice stored, FMAP's own numbers are correct rather
     than merely plausible. Every surface labels it, and every label is a
     control — the default is never silent. */
  var FALLBACK = { code: 'SEA', city: 'Seattle', country: 'US',
                   lat: 47.45, lon: -122.31, isDefault: true };
  var subs = [];

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var h = JSON.parse(raw);
      /* A stored home without coordinates cannot answer a distance question,
         and half-answering is worse than falling back to the exact data. */
      if (!h || !h.code || typeof h.lat !== 'number' || typeof h.lon !== 'number') return null;
      return h;
    } catch (e) { return null; }
  }

  function get() { return read() || FALLBACK; }

  function set(h) {
    if (!h || !h.code) return get();
    var next = { code: String(h.code).toUpperCase(), city: h.city || h.code,
                 country: h.country || '', lat: +h.lat, lon: +h.lon };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      /* One answer, two surfaces — see the header note on tve_book_origin. */
      localStorage.setItem('tve_book_origin', next.code);
    } catch (e) {}
    subs.forEach(function (fn) { try { fn(next); } catch (e) {} });
    return next;
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    subs.forEach(function (fn) { try { fn(FALLBACK); } catch (e) {} });
    return FALLBACK;
  }

  function km(aLat, aLon, bLat, bLon) {
    var R = 6371, rad = Math.PI / 180;
    var p1 = aLat * rad, p2 = bLat * rad;
    var dp = (bLat - aLat) * rad, dl = (bLon - aLon) * rad;
    var x = Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }

  /* FLYING minutes from the reader's home to a destination airport position —
     air time, no layovers, per the note above. Returns null when the
     destination has no position: the caller drops the guide rather than
     guessing, the same rule the finder already applies to a guide with no FMAP
     entry and to one with no climate row. */
  function estimate(destLat, destLon) {
    if (typeof destLat !== 'number' || typeof destLon !== 'number') return null;
    var h = get();
    return Math.round(44 + km(h.lat, h.lon, destLat, destLon) / 14);
  }

  /* "9h 45m" / "45m" — the same shape FMAP.t already uses, so an estimated
     card and an exact one read identically apart from the "~". */
  function fmt(mins) {
    if (mins === null || mins === undefined) return '';
    var h = Math.floor(mins / 60), m = Math.round(mins % 60);
    return (h ? h + 'h' + (m ? ' ' + m + 'm' : '') : m + 'm');
  }

  /* ── Airport lookup, shared with the in-guide Flights picker ──────────────
     Accent-folded so "Malaga" finds "Málaga" and "Dusseldorf" finds
     "Düsseldorf" — the reader is typing on a plain keyboard. */
  function fold(s) {
    return String(s || '').normalize ? String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
                                     : String(s || '').toLowerCase();
  }

  /* Ranked so the obvious answer is first: an exact code beats a city that
     starts with the query, which beats a city containing it, which beats the
     airport's formal name. Then the site's own major list, then OurAirports'
     size tier, then city. Every tier-break below the first exists because the
     one above it left a real case wrong — "paris" put Le Bourget first,
     "seattle" put Boeing Field first. This is the one implementation; the
     Flights panel calls it rather than keeping a second copy. */
  function lookup(q, rows, majorSet, limit) {
    q = fold(q).trim();
    if (!q || !rows || !rows.length) return [];
    majorSet = majorSet || {};
    var out = [];
    for (var i = 0; i < rows.length && out.length < 400; i++) {
      var r = rows[i], code = fold(r[0]), city = fold(r[1]), name = fold(r[3]);
      var rank = -1;
      if (code === q) rank = 0;
      else if (city.indexOf(q) === 0) rank = 1;
      else if (code.indexOf(q) === 0) rank = 2;
      else if (city.indexOf(q) > 0) rank = 3;
      else if (name.indexOf(q) >= 0) rank = 4;
      if (rank >= 0) out.push([rank, r]);
    }
    out.sort(function (a, b) {
      return a[0] - b[0] ||
             ((majorSet[b[1][0]] ? 1 : 0) - (majorSet[a[1][0]] ? 1 : 0)) ||
             (a[1][4] || '1').localeCompare(b[1][4] || '1') ||
             (a[1][1] < b[1][1] ? -1 : 1);
    });
    return out.slice(0, limit || 8).map(function (x) { return x[1]; });
  }

  /* airport_names.json is 204 KB and is fetched on the FIRST KEYSTROKE of a
     home-city or Flights field, never on page load — most readers never open
     either. sessionStorage key 'tveapn' is shared with the Flights panel, so a
     reader who has used one has already paid for the other. */
  var rows = null, pending = null;
  function names(cb) {
    if (rows) { setTimeout(function () { cb(rows); }, 0); return; }
    if (pending) { pending.push(cb); return; }
    pending = [cb];
    function done(list) {
      rows = list || [];
      var waiting = pending; pending = null;
      waiting.forEach(function (fn) { try { fn(rows); } catch (e) {} });
    }
    try {
      var hit = sessionStorage.getItem('tveapn');
      if (hit) { done((JSON.parse(hit) || {}).a); return; }
    } catch (e) {}
    var mount = document.getElementById('toolbar-mount');
    var dep = mount ? parseInt(mount.getAttribute('data-depth') || '1', 10) : 0;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', new Array(dep + 1).join('../') + 'assets/airport_names.json', true);
    xhr.timeout = 8000;
    xhr.onload = function () {
      if (xhr.status < 200 || xhr.status >= 300) { done([]); return; }
      try {
        try { sessionStorage.setItem('tveapn', xhr.responseText); } catch (e) {}
        done((JSON.parse(xhr.responseText) || {}).a);
      } catch (e) { done([]); }
    };
    xhr.onerror = xhr.ontimeout = function () { done([]); };
    xhr.send();
  }

  /* A picker row -> a home. The row carries its own position (build_airports.py
     appends lat/lon), so the choice is resolved once and stored complete: no
     later surface ever has to fetch 204 KB to learn where the reader lives. */
  function fromRow(r) {
    return r && r.length >= 7
      ? { code: r[0], city: r[1], country: r[2], lat: r[5], lon: r[6] }
      : null;
  }

  return {
    KEY: KEY, FALLBACK: FALLBACK,
    get: get, set: set, clear: clear,
    isDefault: function () { return !read(); },
    km: km, estimate: estimate, fmt: fmt,
    fold: fold, lookup: lookup, names: names, fromRow: fromRow,
    onChange: function (fn) { if (typeof fn === 'function') subs.push(fn); }
  };
}());

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

/* ── CSS version guard — if guide-style.css is cached at v < CURRENT, load the
   latest styles under a fresh ?v=. Transparent to HTML (no guide re-stamp
   needed); runs before any other toolbar logic.

   CACHE-BUST ARCHITECTURE (2026-07-26):
   • guide-style.css → this CURRENT guard refreshes ?v= at runtime
   • toolbar.js itself → sw.js MIN_VERSIONS rewrites ?v= in the service worker
   • NEVER bump ?v= in any HTML file — it breaks HMAC stamps on guides
   • To deploy a toolbar.js or guide-style.css change:
     1. Bump CURRENT here (for CSS) or MIN_VERSIONS in sw.js (for toolbar.js)
     2. Bump CACHE version in sw.js
     3. Done — one or two files, zero guide re-stamps

   🔒 ADD A SECOND LINK — NEVER ASSIGN link.href (owner-approved 2026-08-11).
   Assigning `href` on a stylesheet that has ALREADY LOADED makes Chrome drop
   its sheet the same tick and refetch, so from the swap until the replacement
   arrives the document has NO guide CSS AT ALL. Every guide ships a ?v= below
   CURRENT, so this fired on every page load of the site, and the window is
   long: measured on Prague, the first sheet finished at 267ms, the swap fired,
   DOMContentLoaded landed at 361ms — INSIDE the gap — and the replacement only
   arrived at 619ms.

   That is not just a flash of unstyled content. Everything toolbar.js measures
   at DOMContentLoaded measures an UNSTYLED document: _phFit() read a
   .ticket-box gutter of 0 and stepped every 🕐 hours band on every guide one
   full 14px gutter right of the 🎟 / 📍 rows around it, for as long as the
   feature had shipped (owner report 2026-08-11, "this is not aligned … look at
   the time"). Any future pass that reads geometry early would inherit the same
   trap silently.

   Appending a SECOND link instead keeps the stale sheet applied and the page
   fully styled while the fresh one is in flight, then drops the loser: the old
   link on success, the new link on a failed fetch — so a 404 leaves the page
   with the stale styles rather than none. The new link is inserted AFTER the
   old one so that, for the ~300ms both are live, the fresh sheet wins the
   cascade at equal specificity. Cost of the overlap is one stale rule surviving
   a few hundred ms; cost of the old approach was no rules at all. */
(function () {
  var CURRENT = 102;
  var link = document.querySelector('link[href*="guide-style.css"]');
  if (!link || !link.parentNode) return;
  var m = link.href.match(/[?&]v=(\d+)/);
  if (m && parseInt(m[1], 10) >= CURRENT) return;

  var next = document.createElement('link');
  next.rel = 'stylesheet';
  next.href = link.href.replace(/[?&]v=\d+/, '') + '?v=' + CURRENT;
  /* Same sheet under a new URL — carry whatever the page set, or the
     replacement is a subtly different stylesheet from the one it replaces. */
  if (link.media) next.media = link.media;
  if (link.crossOrigin) next.crossOrigin = link.crossOrigin;

  function drop(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }
  next.addEventListener('load', function () { drop(link); });
  next.addEventListener('error', function () { drop(next); });

  link.parentNode.insertBefore(next, link.nextSibling);
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
  /* ── Dropdown row icons (OWNER-DIRECTED 2026-08-10) ──────────────────────
     A dropdown child may carry `icon: '<key>'` instead of a leading emoji.
     The key resolves here to the SAME SVG path the page itself draws in its
     .page-intro-icon, so the menu row and the page it opens wear one icon.
     fill="var(--rust,#b85c2a)" — the SAME terracotta the page draws it in, so a
     row and the page it opens are visibly one thing. (Do not switch this to
     currentColor: the glyph then takes the row's near-black label colour and
     the icons go grey — owner caught exactly that on 2026-08-10.)
     Two flat Apple-emoji rows (🪪 Visas ×4) were indistinguishable at a
     glance; these are not. Adding an `icon:` key also exempts the child from
     check_toolbar_group_icon_consistency's shared-emoji rule — the SVG IS the
     icon, so there is no leading emoji left to match against. */
  var NAV_VIEWBOX = {"chart": "2.48 2.48 19.05 19.05", "clock": "0.10 0.10 23.81 23.81", "disney-parks": "-0.20 -0.45 24.40 24.40", "entry-req": "0.10 0.10 23.81 23.81", "calendar": "0.10 -0.90 23.81 23.81", "first-timer": "-1.10 -1.60 26.19 26.19", "globe": "0.10 0.10 23.81 23.81", "insurance": "-1.21 -1.11 26.43 26.43", "laptop": "-2.29 -2.29 28.57 28.57", "list": "0.14 -0.82 23.71 23.71", "luggage": "0.10 -0.40 23.81 23.81", "map": "1.29 1.29 21.43 21.43", "money": "0.10 0.10 23.81 23.81", "neighborhoods": "1.02 1.72 20.95 20.95", "passport": "0.10 0.10 23.81 23.81", "plane": "-0.32 0.03 24.64 24.64", "rental-cars": "1.29 2.29 21.43 21.43", "restaurants": "0.10 0.10 23.81 23.81", "safety-guide": "-1.21 -1.11 26.43 26.43", "scams": "0.10 0.10 23.81 23.81", "sun": "-1.10 -1.10 26.19 26.19", "sunset": "-1.04 -1.54 26.07 26.07", "tap-water": "0.51 0.26 22.98 22.98", "tours-tickets": "0.10 0.10 23.81 23.81", "travel-apps": "-1.10 -1.10 26.19 26.19", "trophy": "1.29 0.79 21.43 21.43", "vaccines": "-0.20 -1.10 23.81 23.81", "visas": "0.10 0.10 23.81 23.81", "train": "0.10 -0.90 23.81 23.81", "hotel": "1.79 1.29 21.43 21.43", "trusted": "1.19 1.89 22.62 22.62", "plug": "0.69 1.19 22.62 22.62", "packing": "-0.29 2.11 21.07 21.07"};
  var NAV_ICONS = {
    'safety-guide': '<path d="M12 1 3 5v6.1c0 5.6 3.8 10.8 9 12.1 5.2-1.3 9-6.5 9-12.1V5l-9-4zm0 2.2 7 3.1v4.8c0 4.5-3 8.8-7 10-4-1.2-7-5.5-7-10V6.3l7-3.1z"/><path d="M11 6.8h2v6.4h-2zM11 15h2v2h-2z"/>',
    'vaccines':     '<path d="M16.3 1.3 15 2.6l1.6 1.6-2 2-2.6-2.6-1.3 1.3 1 1-6.6 6.6a3 3 0 0 0-.8 1.5l-.7 3.1-1.9 1.9 1.3 1.3 1.9-1.9 3.1-.7a3 3 0 0 0 1.5-.8l6.6-6.6 1 1 1.3-1.3-2.6-2.6 2-2L20.4 6l1.3-1.3-5.4-3.4zm-1.7 8.3-2.2 2.2-1.4-1.4-1.2 1.2 1.4 1.4-1.3 1.3-1.4-1.4-1.2 1.2 1.4 1.4-.6.6a1.2 1.2 0 0 1-.6.3l-2.2.5.5-2.2a1.2 1.2 0 0 1 .3-.6l6.3-6.3 2.2 2.2z"/>',
    'tap-water':    '<path d="M12 2.1 11.3 3C10.6 3.8 5 10.5 5 14.4a7 7 0 0 0 14 0c0-3.9-5.6-10.6-6.3-11.4l-.7-.9zm0 3.2c2.1 2.6 5 6.7 5 9.1a5 5 0 0 1-10 0c0-2.4 2.9-6.5 5-9.1z"/><path d="M13.4 11.6a3.2 3.2 0 0 1-2.9 4.9 2.4 2.4 0 0 0 4.1-2.4 6 6 0 0 0-1.2-2.5z"/>',
    'insurance':    '<path d="M12 1 3 5v6.1c0 5.6 3.8 10.8 9 12.1 5.2-1.3 9-6.5 9-12.1V5l-9-4zm0 2.2 7 3.1v4.8c0 4.5-3 8.8-7 10-4-1.2-7-5.5-7-10V6.3l7-3.1z"/><path d="m10.9 14.2-2.1-2.1-1.4 1.4 3.5 3.6 6-6.1-1.4-1.4-4.6 4.6z"/>',
    'first-timer':  '<path d="M12 2 1 21h22L12 2zm0 4.6L19.5 19h-15L12 6.6zM11 10v5h2v-5h-2zm0 6.5v2h2v-2h-2z"/>',
    'scams':        '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2c1.9 0 3.6.6 5 1.7L5.7 17A8 8 0 0 1 12 4zm0 16c-1.9 0-3.6-.6-5-1.7L18.3 7A8 8 0 0 1 12 20z"/>',
    'visas':        '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>',
    'entry-req':    '<path d="M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 2c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H5v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1z"/>',
    'laptop':       '<path d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>',
    'disney-parks': '<path d="M12 1.5 9.5 6H7.2v3.4L4 12.3V22h6v-4.2a2 2 0 1 1 4 0V22h6v-9.7l-3.2-2.9V6h-2.3L12 1.5zm0 3.1L13.3 7h-2.6L12 4.6zM9.2 8h5.6v2.2l3.2 2.9V20h-2v-2.2a4 4 0 0 0-8 0V20H6v-6.9l3.2-2.9V8z"/>',
    'trusted': '<path d="M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 1.8c-3.9 0-7 1.9-7 4.3V21h8.6a6.4 6.4 0 0 1 2.2-6.6 12.6 12.6 0 0 0-3.8-.6z"/><path d="M17.2 12.8a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6zm-.7 7-2.1-2.1 1-1 1.1 1.1 2.6-2.6 1 1-3.6 3.6z"/>',
    'plug': '<path d="M16 7V3h-2v4h-4V3H8v4H6v5a6 6 0 0 0 5 5.92V22h2v-4.08A6 6 0 0 0 18 12V7h-2zm0 5a4 4 0 0 1-8 0V9h8v3z"/>',
    'packing': '<path d="M10 4h9v2h-9zM10 11h9v2h-9zM10 18h9v2h-9z"/><path d="m4.3 6.4-1.7-1.7-1.1 1.1L4.3 8.6 8 4.9 6.9 3.8zm0 7-1.7-1.7-1.1 1.1 2.8 2.8L8 11.9l-1.1-1.1zm0 7-1.7-1.7-1.1 1.1 2.8 2.8L8 18.9l-1.1-1.1z"/>',
    'category': '<path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/>',
    'ferris': '<path d="M12 1a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 3.6a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8zM9.4 20h5.2l2.4 3.4H7L9.4 20z"/>',
    'paw': '<path d="M6 8.5a2.3 2.6 0 1 0 0 5.2 2.3 2.6 0 0 0 0-5.2zm12 0a2.3 2.6 0 1 0 0 5.2 2.3 2.6 0 0 0 0-5.2zM9.6 3.2a2.2 2.8 0 1 0 0 5.6 2.2 2.8 0 0 0 0-5.6zm4.8 0a2.2 2.8 0 1 0 0 5.6 2.2 2.8 0 0 0 0-5.6zM12 12.4c-2.9 0-5.3 2.4-5.3 4.8 0 2 1.5 3.4 3.4 3.4.8 0 1.4-.3 1.9-.3s1.1.3 1.9.3c1.9 0 3.4-1.4 3.4-3.4 0-2.4-2.4-4.8-5.3-4.8z"/>',
    'fish': '<path d="M22 12c-2-3.4-5.8-5.6-9.6-5.6-3.2 0-6 1.5-7.8 3.6L1.9 7.6v8.8L4.6 14c1.8 2.1 4.6 3.6 7.8 3.6 3.8 0 7.6-2.2 9.6-5.6zm-6.7-1.4a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6z"/>',
    'building': '<path d="M3 21V6l7-3v4l7-3v17H3zm2-2h4v-3H5v3zm0-5h4v-3H5v3zm0-5h4V6.4L5 8v1zm6 10h6v-3h-6v3zm0-5h6v-3h-6v3zm0-5h6V6.9l-6 2.6V9z"/>',
    'artframe': '<path d="M3 4h18v16H3V4zm2 2v12h14V6H5zm2.5 9 3-4 2.2 2.9L15 10l3 5H7.5z"/>',
    'beach': '<path d="M12 2.5C7.6 2.5 4 5.6 3.2 9.7L12 7.5l8.8 2.2C20 5.6 16.4 2.5 12 2.5zM11 9.6 9.4 20H7.3l1.6-10.1 2.1-.3zm2 0 2.1.3L16.7 20h-2.1L13 9.6zM2 21.4c1-.6 2-.9 3-.9s2 .3 3 .9c1-.6 2-.9 3-.9s2 .3 3 .9c1-.6 2-.9 3-.9s2 .3 3 .9V23c-1-.6-2-.9-3-.9s-2 .3-3 .9c-1-.6-2-.9-3-.9s-2 .3-3 .9c-1-.6-2-.9-3-.9s-2 .3-3 .9v-1.6z"/>',
    'castle': '<path d="M3 21V7h2.5V4H8v3h3V4h2.5v3H16V4h2.5v3H21v14H3zm2-2h5v-4a2 2 0 1 1 4 0v4h5V9H5v10z"/>',
    'church': '<path d="M11 2h2v2.5h2.5v2H13V9l7 4.5V21h-6v-4a2 2 0 1 0-4 0v4H4v-7.5L11 9V6.5H8.5v-2H11V2z"/>',
    'cave': '<path d="M2 21V13C2 7.5 6.5 3 12 3s10 4.5 10 10v8h-5.5c0-2.5-2-4.5-4.5-4.5S7.5 18.5 7.5 21H2zm3.5-13 1.7 3.6L8.9 8H5.5zm5.6 0 1.7 3.2L14.5 8h-3.4zm5.4.5 1.5 2.8L19.5 8.5h-3z"/>',
    'flower': '<path d="M12 2.8a3 3 0 0 1 2.9 3.8A3 3 0 0 1 19 9.2a3 3 0 0 1-1.9 3.4A3 3 0 0 1 15 17a3 3 0 0 1-3 1.2A3 3 0 0 1 9 17a3 3 0 0 1-2.1-4.4A3 3 0 0 1 5 9.2a3 3 0 0 1 4.1-2.6A3 3 0 0 1 12 2.8zm0 4.7a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2zM11 18.5h2V22h-2z"/>',
    'compass': '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm4.6 3.4-2.4 5.8-5.8 2.4 2.4-5.8 5.8-2.4zM12 10.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z"/>',
    'hotspring': '<path d="M4 16h16a8 8 0 0 1-16 0zm2.5 2.6h11a6 6 0 0 1-11 0zM8 3c1.4 1.2 1.4 2.4 0 3.6-1.4 1.2-1.4 2.4 0 3.6l-1.4 1C4.6 9.4 4.6 7.4 6 6.1 7 5.2 7 4.8 6.6 4L8 3zm4.5 0c1.4 1.2 1.4 2.4 0 3.6-1.4 1.2-1.4 2.4 0 3.6l-1.4 1c-2-1.8-2-3.8-.6-5.1 1-.9 1-1.3.6-2.1L12.5 3zm4.5 0c1.4 1.2 1.4 2.4 0 3.6-1.4 1.2-1.4 2.4 0 3.6l-1.4 1c-2-1.8-2-3.8-.6-5.1 1-.9 1-1.3.6-2.1L17 3z"/>',
    'island': '<path d="M12 3c-1 0-2.6.5-3.6 1.9l1.3.7c.5-.7 1.3-1 1.8-1v9.9c-.8.2-1.5.5-2 .9H2v2h20v-2h-7.5c-.5-.4-1.2-.7-2-.9V4.6c.5 0 1.3.3 1.8 1l1.3-.7C14.6 3.5 13 3 12 3zM8.6 6.2 5 8.4l3.8.6-3 2.4 3.9-1.1-1.5 3.2 2.5-2.9V6.8l-2.1-.6zm6.8 0-2.1.6v3.8l2.5 2.9-1.5-3.2 3.9 1.1-3-2.4 3.8-.6-3.6-2.2zM2 19h20v2H2v-2z"/>',
    'balloon': '<path d="M12 2a7 7 0 0 0-7 7c0 3.9 3.5 7.6 6 8.7l-.6 1.3h3.2l-.6-1.3c2.5-1.1 6-4.8 6-8.7a7 7 0 0 0-7-7zm-1.2 18h2.4l1 3h-4.4l1-3z"/>',
    'blocks': '<path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm14.5 0L22 21h-9l4.5-8z"/>',
    'waves': '<path d="M2 8.5c1.6 0 1.6 1.5 3.2 1.5S6.8 8.5 8.4 8.5 10 10 11.6 10s1.6-1.5 3.2-1.5 1.6 1.5 3.2 1.5 1.6-1.5 3.2-1.5v2c-1.6 0-1.6 1.5-3.2 1.5s-1.6-1.5-3.2-1.5-1.6 1.5-3.2 1.5S9.9 10.5 8.4 10.5 6.8 12 5.2 12 3.6 10.5 2 10.5v-2zm0 6c1.6 0 1.6 1.5 3.2 1.5s1.6-1.5 3.2-1.5 1.6 1.5 3.2 1.5 1.6-1.5 3.2-1.5 1.6 1.5 3.2 1.5 1.6-1.5 3.2-1.5v2c-1.6 0-1.6 1.5-3.2 1.5s-1.6-1.5-3.2-1.5-1.6 1.5-3.2 1.5-1.7-1.5-3.2-1.5S6.8 18 5.2 18 3.6 16.5 2 16.5v-2z"/>',
    'mountain': '<path d="M2 21 9 7l4.2 8.4 2.3-3.6L22 21H2zm8.6-6.6L9 11.2 5.8 18h4.2l1.4-2.4-.8-1.2zM15.5 15l-1.6 2.5.9 1.5h4.6l-3.9-4z"/>',
    'tree': '<path d="M12 2 6 11h3l-4 7h5.9v5h2.2v-5H19l-4-7h3L12 2z"/>',
    'aurora': '<path d="M3 20c0-6.6 4-12 9-12s9 5.4 9 12h-2c0-5.5-3.1-10-7-10s-7 4.5-7 10H3zm4.5 0c0-4.3 2-8 4.5-8s4.5 3.7 4.5 8h-2c0-3.2-1.3-6-2.5-6s-2.5 2.8-2.5 6h-2zM12 2l.8 2.2L15 5l-2.2.8L12 8l-.8-2.2L9 5l2.2-.8L12 2zM4.5 4l.5 1.3 1.3.5-1.3.5L4.5 7.6 4 6.3l-1.3-.5L4 5.3 4.5 4zm15 0 .5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5.5-1.3z"/>',
    'tower': '<path d="M10 2h4v3h2l1 6h-2.2l1.2 10H8l1.2-10H7l1-6h2V2zm1.2 9-1 8h3.6l-1-8h-1.6z"/>',
    'safari': '<path d="M12 2C8.7 2 6 4.5 6 7.6c0 1.7.8 3.2 2.1 4.2L7 22h2.1l.9-8.6c.6.2 1.3.3 2 .3s1.4-.1 2-.3l.9 8.6H17l-1.1-10.2c1.3-1 2.1-2.5 2.1-4.2C18 4.5 15.3 2 12 2zm0 2c2.2 0 4 1.6 4 3.6s-1.8 3.6-4 3.6-4-1.6-4-3.6S9.8 4 12 4z"/>',
    'scuba': '<path d="M4 6h16a2 2 0 0 1 2 2v3.5a4.5 4.5 0 0 1-4.5 4.5c-1.9 0-3.5-1.2-4.2-2.8h-2.6A4.5 4.5 0 0 1 6.5 16 4.5 4.5 0 0 1 2 11.5V8a2 2 0 0 1 2-2zm2.5 8A2.5 2.5 0 1 0 6.5 9a2.5 2.5 0 0 0 0 5zm11 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM9 19h6v2H9z"/>',
    'ski': '<path d="M5.5 2.5a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM3 20.4l1-1.5 4.5 3 8.9-6.2-3-3.9-3.3 2.3-3.5-4.7 3.2-2.2 4.4 5.9L21 9.4l1.1 1.6-13.4 9.4L3 20.4zM2 22h20v2H2z"/>',
    'surf': '<path d="M14.5 1.5c4 2.6 6.5 7.7 6.5 12.3 0 1.6-.3 3.1-.9 4.4-1.4.5-2.9.8-4.4.8-4.6 0-9.7-2.5-12.3-6.5 3.4-.6 6.6-2.2 9-4.6 2.4-2.4 4-5.6 4.6-9zM2 20c1.6 0 1.6 1.5 3.2 1.5S6.8 20 8.4 20s1.6 1.5 3.2 1.5S13.2 20 14.8 20s1.6 1.5 3.2 1.5S19.6 20 21.2 20v2c-1.6 0-1.6 1.5-3.2 1.5S16.4 22 14.8 22s-1.6 1.5-3.2 1.5S9.9 22 8.4 22s-1.6 1.5-3.2 1.5S3.6 22 2 22v-2z"/>',
    'unesco': '<path d="M4 21v-2h16v2H4zm1-3V9.5h2V18H5zm4 0V9.5h2V18H9zm4 0V9.5h2V18h-2zm4 0V9.5h2V18h-2zM12 2l9 5v1.5H3V7l9-5z"/>',
    'museumstar': '<path d="M4 20.5v-2h16v2H4zm1-3V9h2v8.5H5zm4 0V9h2v8.5H9zm4 0V9h2v8.5h-2zm4 0V9h2v8.5h-2zM12 1.5l9 5V8H3V6.5l9-5zm0 2.8L8.2 6.4h7.6L12 4.3z"/>',
    'volcano': '<path d="M9 2h6v4.5l7 15.5H2L9 6.5V2zm2 2v3l-1.3 2.9c.7.6 1.6 1 2.5.9.9-.1 1.6-.6 2.1-1.3L13 7V4h-2zM8.6 11.9 5.1 20h13.8l-3.1-6.9c-.8.7-1.8 1.2-3 1.3-1.6.2-3.1-.4-4.2-1.4z"/>',
    'wine': '<path d="M7 2h10v5.5a5 5 0 0 1-4 4.9V19h3v2H8v-2h3v-6.6a5 5 0 0 1-4-4.9V2zm2 2v3.5a3 3 0 1 0 6 0V4H9z"/>',
    'pyramid': '<path d="M12 2 2 21h20L12 2zm0 4.6 5.6 10.6h-2.2L12 11.4l-3.4 5.8H6.4L12 6.6zm0 8.8 1.6 2.8h-3.2l1.6-2.8z"/>',
    'budget': '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h14a2 2 0 0 0 2-2v-1.5h-7a3.5 3.5 0 0 1 0-7h7zM5 6h14v1.5H5A1.5 1.5 0 0 1 5 6zm9 8.5a1.5 1.5 0 0 1 1.5-1.5H22v3h-6.5a1.5 1.5 0 0 1-1.5-1.5z"/>',
    'card': '<path d="M3 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v2h18V7H3zm0 5v5h18v-5H3zm2 2h5v2H5v-2z"/>',
    'transit': '<path d="M6 2h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3l1.5 2v.5h-15V22L6 20a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zm-1 4v6h14V6H5zm2.5 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>',
    'ship': '<path d="M12 2 8 5v2.6l-4.5 1.5L6 18h12l2.5-8.9L16 7.6V5l-4-3zm-2 5.9V6l2-1.5L14 6v1.9l-2-.7-2 .7zM2 20c1.6 0 1.6 1.5 3.2 1.5S6.8 20 8.4 20s1.6 1.5 3.2 1.5S13.2 20 14.8 20s1.6 1.5 3.2 1.5S19.6 20 21.2 20v2c-1.6 0-1.6 1.5-3.2 1.5S16.4 22 14.8 22s-1.6 1.5-3.2 1.5S9.9 22 8.4 22s-1.6 1.5-3.2 1.5S3.6 22 2 22v-2z"/>',
    'books': '<path d="M3 4h5a3 3 0 0 1 3 1.4A3 3 0 0 1 14 4h5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-5a2 2 0 0 0-2 1.5A2 2 0 0 0 10 19H5a2 2 0 0 1-2-2V6a2 2 0 0 1 0-2zm2 2v11h5V7.6A1.6 1.6 0 0 0 8.4 6H5zm14 0h-3.4A1.6 1.6 0 0 0 14 7.6V17h5V6z"/>',
    'paddle': '<path d="M9.2 2.2a7 7 0 0 1 5 11.9l-1.4 1.4-5.9-5.9 1.4-1.4A7 7 0 0 1 9.2 2.2zM6.4 10.9l6.7 6.7-2 2a2.2 2.2 0 0 1-3.1 0l-3.6-3.6a2.2 2.2 0 0 1 0-3.1l2-2zM18.5 16a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z"/>',
    'sim': '<path d="M7 2h7l6 6v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2 10a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H9zm1.5 2h3v3h-3v-3z"/>',
    'pennant': '<path d="M5 2h2v20H5V2zm3 1.2 11 3.9-11 3.9V3.2z"/>',
    'tipping': '<path d="M12 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zm.6 8.6v.9h-1.2v-.9c-1-.2-1.7-.8-1.8-1.8h1.3c.1.5.5.8 1.1.8.6 0 1-.3 1-.7 0-.4-.3-.6-1.2-.9-1.3-.3-2-.8-2-1.8 0-.9.6-1.5 1.6-1.7v-.9h1.2V4c1 .2 1.6.8 1.7 1.7h-1.3c-.1-.4-.4-.7-.9-.7-.6 0-.9.3-.9.6 0 .4.3.6 1.2.8 1.3.3 2 .8 2 1.9 0 .9-.6 1.6-1.8 1.8zM4 15h4.6l2.2 1.6h2.9c.9 0 1.6.7 1.6 1.6H11v1.4h4.6l4.4-2.3 1 1.7-5 3.5H4v-7.5z"/>',
    'book': '<path d="M12 6.3A9.6 9.6 0 0 0 6 4.3c-1.5 0-3 .3-4.2.8v13.4c1.2-.5 2.7-.8 4.2-.8 2.3 0 4.4.7 6 2 1.6-1.3 3.7-2 6-2 1.5 0 3 .3 4.2.8V5.1c-1.2-.5-2.7-.8-4.2-.8-2.3 0-4.4.7-6 2zm-1.5 12.2A8.9 8.9 0 0 0 6 16.9c-1 0-1.9.1-2.7.3V6.6c.8-.2 1.7-.3 2.7-.3 1.7 0 3.3.4 4.5 1.2v11zm3 0v-11c1.2-.8 2.8-1.2 4.5-1.2 1 0 1.9.1 2.7.3v10.6c-.8-.2-1.7-.3-2.7-.3-1.7 0-3.3.5-4.5 1.6z"/>',
    'pin': '<path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>',
    'compare': '<path d="M4 3h7v18H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm9 0h7a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-7V3zM5 7h5V5H5v2zm10 0h4V5h-4v2z"/>',
    'triptype': '<path d="M10.4 2.6H4a1.4 1.4 0 0 0-1.4 1.4v6.4c0 .4.1.7.4 1l9.6 9.6c.5.5 1.4.5 2 0l6.4-6.4c.5-.6.5-1.5 0-2L11.4 3a1.4 1.4 0 0 0-1-.4zM6.5 8.4a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8z"/>',
    'language': '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM6.6 7.5h2.6a15 15 0 0 1 1.1-2.9 8 8 0 0 0-3.7 2.9zM12 4.2c.6.9 1.1 1.9 1.4 3.3h-2.8c.3-1.4.8-2.4 1.4-3.3zm-7.7 8.3a8 8 0 0 1 .2-3h3a17 17 0 0 0 0 3h-3.2zm5.2 0a15 15 0 0 1 0-3h5a15 15 0 0 1 0 3h-5zm-3.5 2h2.7c.3 1.1.6 2.1 1 2.9a8 8 0 0 1-3.7-2.9zm5.9 3.3c-.6-.9-1.1-1.9-1.4-3.3h2.8c-.3 1.4-.8 2.4-1.4 3.3zm2.6-.4c.4-.8.8-1.8 1-2.9h2.7a8 8 0 0 1-3.7 2.9zm1.3-4.9a17 17 0 0 0 0-3h3a8 8 0 0 1 0 3h-3zm2.2-5h-2.6a15 15 0 0 0-1.1-2.9 8 8 0 0 1 3.7 2.9z"/>',
    'palm': '<path d="M12 4.2c2 0 3.7 1 4.6 2.4-1-.6-2.2-.9-3.4-.9v.6c2.9 0 5.4 1.6 6.6 3.9-1.3-1-2.9-1.6-4.7-1.6-.6 0-1.2.1-1.8.2l.3.6c3 .5 5.4 2.7 6.2 5.5-1.5-1.7-3.6-2.9-6-3.2l-.8 12.1h-2l.8-12.1c-2.4.3-4.5 1.5-6 3.2.8-2.8 3.2-5 6.2-5.5l.3-.6c-.6-.1-1.2-.2-1.8-.2-1.8 0-3.4.6-4.7 1.6C7 8.4 9.5 6.8 12.4 6.8v-.6c-1.2 0-2.4.3-3.4.9C9.9 5.2 11.6 4.2 12 4.2z"/>',
    'bulb': '<path d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2zm-2 17.5h4V21a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1.5z"/>',
    'shuffle': '<path d="M17 3v3h-2.1l-2.4 3.2 1.3 1.7L16 8h1v3l4-4-4-4zM3 6v2h4.2l1.6 2.1 1.3-1.7L8 6H3zm14 9v-3l-2.2 2.9L13.5 13l-1.3 1.7L14.9 18H17v3l4-4-4-4zM3 16v2h5l6.5-8.6-1.3-1.7L7 16H3z"/>',
    'download': '<path d="M12 3v9.6l3.3-3.3 1.4 1.4L12 16.4 7.3 10.7l1.4-1.4L12 12.6V3h0zM4 18h16v3H4v-3z"/>',
    'check': '<path d="M9.2 16.6 4.6 12l-1.5 1.4 6.1 6.2L21 8l-1.4-1.4-10.4 10z"/>',
    'search': '<path d="M10.5 3a7.5 7.5 0 1 0 4.4 13.6l4.8 4.8 1.4-1.4-4.8-4.8A7.5 7.5 0 0 0 10.5 3zm0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z"/>',
    'exchange': '<path d="M7 5.5 3 9.5l4 4V11h8V8H7V5.5zM17 10.5l4 4-4 4V16H9v-3h8v-2.5z"/>',
    'star': '<path d="M12 2.4l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.3l-5.9 3.1 1.2-6.5L2.5 9.3l6.6-.9 2.9-6z"/>',
    'printer': '<path d="M7 3h10v4H7V3zm-3 6h16a2 2 0 0 1 2 2v6h-4v4H6v-4H2v-6a2 2 0 0 1 2-2zm4 8v3h8v-3H8zm10-5.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>',
    'close': '<path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7l1.4-1.4L10.6 10.6l6.3-6.3 1.4 1.4z"/>',
    'calendar': '<path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>',
    'neighborhoods': '<path d="M4 21V9.2l6-4.2 6 4.2V21h-4v-5h-4v5H4zm14 0V10.6l2 1.4V21h-2zM11.5 3.4 20 9.35V11l-8.5-5.95L3 11V9.35l8.5-5.95z"/>',
    'rental-cars': '<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>',
    'restaurants': '<path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>',
    'tours-tickets': '<path d="M22 10V6c0-1.1-.9-2-2-2H4c-1.1 0-1.99.9-1.99 2v4c1.1 0 1.99.9 1.99 2s-.89 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2zm-9 7.5h-2v-2h2v2zm0-4.5h-2v-2h2v2zm0-4.5h-2v-2h2v2z"/>',
    'travel-apps': '<path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>',
    'globe': '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.9a15.7 15.7 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.4 2.5 1.8 4h-3.6c.4-1.5 1-2.8 1.8-4zM4.3 14A8 8 0 0 1 4 12c0-.7.1-1.4.3-2h3.4a16.5 16.5 0 0 0 0 4H4.3zm.8 2h2.9c.3 1.3.8 2.5 1.4 3.6A8 8 0 0 1 5.1 16zm2.9-8H5.1a8 8 0 0 1 4.3-3.6A15.7 15.7 0 0 0 8 8zM12 20c-.8-1.2-1.4-2.5-1.8-4h3.6c-.4 1.5-1 2.8-1.8 4zm2.2-6H9.8a14.7 14.7 0 0 1 0-4h4.4a14.7 14.7 0 0 1 0 4zm.3 5.6c.6-1.1 1.1-2.3 1.4-3.6h2.9a8 8 0 0 1-4.3 3.6zm1.8-5.6a16.5 16.5 0 0 0 0-4h3.4c.2.6.3 1.3.3 2s-.1 1.4-.3 2h-3.4z"/>',
    'map': '<path d="M20.5 3h-.2L15 5.1 9 3 3.4 4.9a.5.5 0 0 0-.4.5v15.1a.5.5 0 0 0 .5.5h.2L9 18.9l6 2.1 5.6-1.9a.5.5 0 0 0 .4-.5V3.5a.5.5 0 0 0-.5-.5zM10 5.5l4 1.4v11.6l-4-1.4V5.5zM5 6.5l3-1v11.6l-3 1.1V6.5zm14 11-3 1V6.9l3-1.1v11.7z"/>',
    /* stroke-based, straight off sunrise-sunset/ */
    'sunset': { stroke: true, m: '<circle cx="12" cy="10" r="4"/><path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 4.93-1.41 1.41"/><path d="M2 10h2"/><path d="M20 10h2"/><path d="M5 17h14"/><path d="M3 21h18"/>' },
    'luggage': '<path d="M20 6h-3V4c0-1.1-.9-2-2-2h-6c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5 0H9V4h6v2z"/>',
    'trophy': '<path d="M19 5h-2V3H7v2H5a2 2 0 0 0-2 2v1a4 4 0 0 0 4 4h.3A5 5 0 0 0 11 15.9V18H8v2h8v-2h-3v-2.1A5 5 0 0 0 16.7 12H17a4 4 0 0 0 4-4V7a2 2 0 0 0-2-2zM7 10a2 2 0 0 1-2-2V7h2v3zm12-2a2 2 0 0 1-2 2V7h2v1z"/>',
    'chart': '<path d="M4 20h3.5V10H4v10zm6.2 0h3.6V4h-3.6v16zM16.5 20H20v-7h-3.5v7z"/>',
    'money': '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.6-8.7c-1.7-.5-2.2-.9-2.2-1.5 0-.7.7-1.2 1.8-1.2 1.2 0 1.7.6 1.7 1.4h1.6c0-1.2-.8-2.3-2.2-2.6V6h-2.2v1.4c-1.3.3-2.3 1.2-2.3 2.5 0 1.5 1.3 2.3 3.2 2.8 1.7.4 2 1 2 1.6 0 .5-.3 1.2-1.8 1.2-1.4 0-1.9-.6-2-1.4H8.6c.1 1.5 1.2 2.4 2.5 2.7V18h2.2v-1.4c1.4-.3 2.4-1.1 2.4-2.5 0-1.8-1.6-2.5-3.1-2.8z"/>',
    'sun': '<path d="M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM11 1h2v3h-2zm0 19h2v3h-2zM1 11h3v2H1zm19 0h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4zM17.7 6.3l-1.4-1.4 2.1-2.1 1.4 1.4zM5.6 19.8l-1.4-1.4 2.1-2.1 1.4 1.4z"/>',
    'list': '<path d="M19 3h-4.2a3 3 0 0 0-5.6 0H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm7 16H5V5h2v2h10V5h2v14zM7 10h10v2H7zm0 4h7v2H7z"/>',
    'plane': '<path d="M12 2a1.4 1.4 0 0 1 1.4 1.4v6.1l8.1 4.8v2.2l-8.1-2.6v5.2l2.6 1.9v1.7L12 21.4l-4 1.3v-1.7l2.6-1.9v-5.2L2.5 16.5v-2.2l8.1-4.8V3.4A1.4 1.4 0 0 1 12 2z"/>',
    'clock':        '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>',
    /* the train already drawn on essentials/train-passes/ — same rule
       as every other key here: the menu wears the page's own icon */
    'passport':     '<path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6zm0 4h12v2H6zm4-4h8v2h-8z"/>',
    'train':        '<path d="M4 15.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V5c0-3.5-3.58-4-8-4S4 1.5 4 5v10.5zm8 1.5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7H6V5h12v5z"/>'
  };


  /* Build the inline SVG for a NAV_ICONS entry. A plain string is filled
     markup; { stroke:true, m } is a stroked icon and needs the opposite
     wrapper (fill:none + a stroke colour) or it renders as a solid blob. */

  /* ── COLOURED ICON SPRITE ────────────────────────────────────────────────
     Owner rule 2026-08-12: every terracotta icon becomes a coloured one — the
     mark inside a pill changes, the pill itself does not.

     A coloured icon cannot be a CSS mask: a mask is a stencil filled with ONE
     background-color, which is exactly why the whole set has been one colour.
     So the drawing has to be real SVG in the DOM. Doing that naively would put
     a full copy of the artwork at every occurrence — 8,810 pins and 3,496 book
     rows across the fleet — so instead every drawing is declared ONCE as a
     <symbol> and each occurrence is a single <use>. Per-instance markup stays
     about 40 bytes.

     Fills are palette vars, injected below, so a coloured mark still re-tints
     for dark mode. Hardcoding the colours would have frozen the whole set
     light.

     A key with no entry here keeps the old mask path untouched, so this can be
     completed icon by icon without a flag day. */
  var GM_SPRITE = {
    'ticket-solid': ['1 5.5 22 13', '<path fill-rule="evenodd" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5" d="M4 6.5H20A2 2 0 0 1 22 8.5V10A2 2 0 0 0 22 14V15.5A2 2 0 0 1 20 17.5H4A2 2 0 0 1 2 15.5V14A2 2 0 0 0 2 10V8.5A2 2 0 0 1 4 6.5ZM16.3 8.5h1.3v1.7h-1.3ZM16.3 11.15h1.3v1.7h-1.3ZM16.3 13.8h1.3v1.7h-1.3Z"/><path d="M4 6.5H20A2 2 0 0 1 22 8.5V10A2 2 0 0 0 22 14V15.5A2 2 0 0 1 20 17.5H4A2 2 0 0 1 2 15.5V14A2 2 0 0 0 2 10V8.5A2 2 0 0 1 4 6.5ZM16.3 8.5h1.3v1.7h-1.3ZM16.3 11.15h1.3v1.7h-1.3ZM16.3 13.8h1.3v1.7h-1.3Z" fill="url(#gm-gloss)"/>'],
    'ticket-torn': ['1 5.5 22 13', '<path fill-rule="evenodd" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5" d="M4 6.5H10.8l0.9 2.2-1.8 2.2 1.8 2.2-1.8 2.2 0.9 2.2H4A2 2 0 0 1 2 15.5V14A2 2 0 0 0 2 10V8.5A2 2 0 0 1 4 6.5Z"/><path fill-rule="evenodd" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5" d="M13.2 6.5H20A2 2 0 0 1 22 8.5V10A2 2 0 0 0 22 14V15.5A2 2 0 0 1 20 17.5H13.2l0.9-2.2-1.8-2.2 1.8-2.2-1.8-2.2 0.9-2.2ZM16.3 8.5h1.3v1.7h-1.3ZM16.3 11.15h1.3v1.7h-1.3ZM16.3 13.8h1.3v1.7h-1.3Z"/><path fill-rule="evenodd" fill="url(#gm-gloss)" d="M13.2 6.5H20A2 2 0 0 1 22 8.5V10A2 2 0 0 0 22 14V15.5A2 2 0 0 1 20 17.5H13.2l0.9-2.2-1.8-2.2 1.8-2.2-1.8-2.2 0.9-2.2ZM16.3 8.5h1.3v1.7h-1.3ZM16.3 11.15h1.3v1.7h-1.3ZM16.3 13.8h1.3v1.7h-1.3Z"/>'],

    'train-station': ['0.10 -0.90 23.81 23.81', '<rect x="6" y="5" width="12" height="5" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><rect x="6" y="5" width="12" height="5" fill="url(#gm-gloss)"/> <circle cx="12" cy="15" r="2" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <path d="M4 15.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V5c0-3.5-3.58-4-8-4S4 1.5 4 5v10.5zm8 1.5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7H6V5h12v5z" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/>'],

    'restaurants-hotel': ['0 0 24 24', '<circle cx="12" cy="12.4" r="6.0" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><circle cx="12" cy="12.4" r="6.0" fill="url(#gm-gloss)"/><circle cx="12" cy="12.4" r="4.2" fill="none" stroke="var(--c-stone)" stroke-width="0.9" opacity="0.65"/><g transform="translate(-0.55 0)"><path fill-rule="evenodd" d="M1.02 5.40H4.98A0.46 0.46 0 0 1 5.43 5.86V10.11A2.43 1.82 0 0 1 0.57 10.11V5.86A0.46 0.46 0 0 1 1.02 5.40ZM1.24 5.02h0.72v3.39a0.36 0.36 0 0 1 -0.72 0zM2.64 5.02h0.72v3.39a0.36 0.36 0 0 1 -0.72 0zM4.04 5.02h0.72v3.39a0.36 0.36 0 0 1 -0.72 0z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><rect x="2.41" y="11.86" width="1.19" height="9.54" rx="0.59" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/></g><g transform="translate(0.55 0)"><path d="M19.40 3.4C19.80 2.6 21.00 2.4 21.80 4.2C22.80 6.2 23.20 8.4 23.20 10.6C23.20 11.9 22.30 12.7 21.00 12.7H19.40Z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><rect x="19.25" y="12.4" width="1.85" height="9" rx="0.92" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/></g>'],

    'delivery-car': ['0 0 24 24', '<path d="M5.8 10.4 7.5 6.6c.3-.8 1-1.3 1.9-1.3h5.2c.9 0 1.6.5 1.9 1.3l1.7 3.8z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><path d="M11.6 5.3h0.9v5.1h-0.9z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><rect x="2.4" y="9.9" width="19.2" height="6.5" rx="2.4" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><rect x="6.6" y="6.4" width="4" height="2.4" rx="0.6" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/><circle cx="8.6" cy="7.6" r="0.75" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><rect x="2.7" y="11.4" width="3.1" height="1.9" rx="0.95" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><rect x="18.2" y="11.4" width="3.1" height="1.9" rx="0.95" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><circle cx="6.8" cy="17.3" r="2.6" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/><circle cx="6.8" cy="17.3" r="1.1" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><circle cx="17.2" cy="17.3" r="2.6" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/><circle cx="17.2" cy="17.3" r="1.1" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/>'],

    'cal-export': ['0 0 24 24', '<rect x="2.6" y="4" width="18.8" height="17.2" rx="2.4" fill="url(#gm-paper)" stroke="var(--c-rim-warm)" stroke-width="1" stroke-linejoin="round" /> <path d="M2.6 6.4A2.4 2.4 0 0 1 5 4h14a2.4 2.4 0 0 1 2.4 2.4v2.4H2.6z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> <rect x="6.3" y="1.9" width="2.2" height="4" rx="1.1" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/> <rect x="15.5" y="1.9" width="2.2" height="4" rx="1.1" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/> <text x="12" y="18.6" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10.6" font-weight="700" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5" text-anchor="middle">17</text>'],

    'country-map': ['0 0 24 24', '<defs><clipPath id="cpm1"><path d="M1.6 8.4 8 5.6v13.2l-6.4 2.8z"/></clipPath><clipPath id="cpm2"><path d="M8 5.6 15.4 8.4v13.2L8 18.8z"/></clipPath><clipPath id="cpm3"><path d="M15.4 8.4 22.4 5.6v13.2l-7 2.8z"/></clipPath></defs><path d="M1.6 8.4 8 5.6v13.2l-6.4 2.8z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><path d="M1.6 8.4 8 5.6v13.2l-6.4 2.8z" fill="url(#gm-gloss)"/><path d="M8 5.6 15.4 8.4v13.2L8 18.8z" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><path d="M15.4 8.4 22.4 5.6v13.2l-7 2.8z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><g clip-path="url(#cpm1)"><path d="M1 13.6c2.4-1 4.6-1.4 7.6-1.2v3.4c-3-.2-5.2.2-7.6 1.2z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/></g><g clip-path="url(#cpm2)"><path d="M7.6 13.4c2.6.5 4.8 1.4 6.6 2.6l-.4 3.8c-1.8-1.4-4-2.4-6.6-3z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><path d="M9.2 7.6c1.8.4 3.4 1 4.8 1.8l-.3 2.8c-1.4-.9-3-1.5-4.8-1.9z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/></g><g clip-path="url(#cpm3)"><path d="M15 16c2.4-1.2 4.6-1.8 7.6-1.8v3.6c-3 0-5.2.6-7.6 1.8z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/></g><g fill="none" stroke="var(--c-cocoa)" stroke-width="0.8" stroke-linecap="round" opacity="0.5" stroke-dasharray="0.1 2.4"><path d="M3.4 17.4c3.2-3.4 6.4-4.4 9.6-3 3.2 1.4 6 .6 8.4-2.4"/></g><path d="M12.6 1.6a4.2 4.2 0 0 0-4.2 4.2c0 3.1 4.2 7.6 4.2 7.6s4.2-4.5 4.2-7.6a4.2 4.2 0 0 0-4.2-4.2z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><circle cx="12.6" cy="5.8" r="1.7" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/>'],

    'open-book': ['0 0 24 24', '<path d="M1.6 5.6c3-1.4 6.2-1.4 9.4.4v13.4c-3.2-1.8-6.4-1.9-9.4-.4z" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/><path d="M22.4 5.6c-3-1.4-6.2-1.4-9.4.4v13.4c3.2-1.8 6.4-1.9 9.4-.4z" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><path d="M11 6c.6.3 1 .8 1 1.4V21c0-.6-.4-1.1-1-1.4zM13 6c-.6.3-1 .8-1 1.4V21c0-.6.4-1.1 1-1.4z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><g fill="none" stroke="var(--c-stone)" stroke-width="0.85" stroke-linecap="round" opacity="0.8"><path d="M3.8 8.4h5M3.8 11h5M3.8 13.6h3.6M15.2 8.4h5M15.2 11h5M15.2 13.6h3.6"/></g>'],

    'flight-nav': ['-0.32 0.03 24.64 24.64', '<path d="M12 2a1.4 1.4 0 0 1 1.4 1.4v6.1l8.1 4.8v2.2l-8.1-2.6v5.2l2.6 1.9v1.7L12 21.4l-4 1.3v-1.7l2.6-1.9v-5.2L2.5 16.5v-2.2l8.1-4.8V3.4A1.4 1.4 0 0 1 12 2z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/><path d="M12 2a1.4 1.4 0 0 1 1.4 1.4v6.1l8.1 4.8v2.2l-8.1-2.6v5.2l2.6 1.9v1.7L12 21.4l-4 1.3v-1.7l2.6-1.9v-5.2L2.5 16.5v-2.2l8.1-4.8V3.4A1.4 1.4 0 0 1 12 2z" fill="url(#gm-gloss)"/> <path d="M12 2a1.4 1.4 0 0 1 1.4 1.4v6.1l8.1 4.8v2.2l-8.1-2.6z" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/> <path d="M13.4 18.4l2.6 1.9v1.7L12 21.4z" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/> <circle cx="12" cy="5.4" r="0.95" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],

    'credit-card': ['0 0 24 24', '<rect x="1.6" y="4.6" width="20.8" height="14.8" rx="2.4" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><rect x="1.6" y="4.6" width="20.8" height="14.8" rx="2.4" fill="url(#gm-gloss)"/> <rect x="1.6" y="7.8" width="20.8" height="3.4" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/> <rect x="4" y="13.4" width="5.4" height="3.6" rx="0.7" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <g stroke="var(--c-amber)" stroke-width="0.7" opacity="0.8"> <path d="M6.7 13.4v3.6M4 15.2h5.4"/> </g> <g fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6" opacity="0.75"> <rect x="12.4" y="14.6" width="4.4" height="1.3" rx="0.65"/><rect x="18" y="14.6" width="2.4" height="1.3" rx="0.65"/> </g>'],
    'money-bag': ['0 0 24 24', '<path d="M9.4 2.2h5.2l-1.4 2.6h-2.4z" fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5"/><path d="M9.4 2.2h5.2l-1.4 2.6h-2.4z" fill="url(#gm-gloss)"/> <path d="M12 4.8c4.6 0 8.2 5.4 8.2 10.4 0 4-3 6.6-8.2 6.6S3.8 19.2 3.8 15.2C3.8 10.2 7.4 4.8 12 4.8z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <path d="M12 4.8c-1.7 0-3.2.8-4.4 2 2.7 1.1 6.1 1.1 8.8 0-1.2-1.2-2.7-2-4.4-2z" fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5"/> <text x="12" y="18" font-family="ui-sans-serif, system-ui, sans-serif" font-size="9" font-weight="700" text-anchor="middle" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.4">$</text>'],

    'wx-clear': ['0 0 24 24', '<circle cx="12" cy="12" r="5.4" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><circle cx="12" cy="12" r="5.4" fill="url(#gm-gloss)"/> <circle cx="12" cy="12" r="3.6" fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5" opacity="0.45"/> <g stroke="var(--c-sun)" stroke-width="2.1" stroke-linecap="round"> <path d="M12 2.4v2.6"/><path d="M12 19v2.6"/><path d="M2.4 12h2.6"/><path d="M19 12h2.6"/> <path d="M5.2 5.2 7 7"/><path d="M17 17l1.8 1.8"/><path d="M18.8 5.2 17 7"/><path d="M7 17l-1.8 1.8"/> </g>'],
    'wx-partly': ['0 0 24 24', '<circle cx="8.8" cy="8.4" r="4.2" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><circle cx="8.8" cy="8.4" r="4.2" fill="url(#gm-gloss)"/> <g stroke="var(--c-sun)" stroke-width="1.8" stroke-linecap="round"> <path d="M8.8 1.6v1.8"/><path d="M1.8 8.4h1.8"/><path d="M3.8 3.4 5.1 4.7"/><path d="M13.8 3.4 12.5 4.7"/><path d="M3.8 13.4l1.3-1.3"/> </g> <path d="M8.6 20.8a3.9 3.9 0 0 1 .5-7.8 5.2 5.2 0 0 1 9.7 1.3 3.2 3.2 0 0 1-.5 6.5z" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="1" stroke-linejoin="round" /> <path d="M9.1 13a5.2 5.2 0 0 1 6 1.5 3.6 3.6 0 0 0-5.1 1.9A3.9 3.9 0 0 0 9.1 13z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5" opacity="0.45"/>'],
    'wx-overcast': ['0 0 24 24', '<path d="M6.6 13.6a3.4 3.4 0 0 1 .4-6.8 4.6 4.6 0 0 1 8.6 1.2 2.8 2.8 0 0 1-.4 5.6z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5" opacity="0.55"/> <path d="M8.4 20.4a4.1 4.1 0 0 1 .5-8.2 5.5 5.5 0 0 1 10.2 1.4 3.4 3.4 0 0 1-.5 6.8z" fill="url(#gm-paper)" stroke="var(--c-rim-warm)" stroke-width="1" stroke-linejoin="round" /><path d="M8.4 20.4a4.1 4.1 0 0 1 .5-8.2 5.5 5.5 0 0 1 10.2 1.4 3.4 3.4 0 0 1-.5 6.8z" fill="url(#gm-gloss)"/>'],
    'wx-snow': ['0 0 24 24', '<path d="M7 13.8a4 4 0 0 1 .5-8 5.4 5.4 0 0 1 10 1.4 3.3 3.3 0 0 1-.5 6.6z" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="1" stroke-linejoin="round" /><path d="M7 13.8a4 4 0 0 1 .5-8 5.4 5.4 0 0 1 10 1.4 3.3 3.3 0 0 1-.5 6.6z" fill="url(#gm-gloss)"/> <g stroke="var(--c-sky)" stroke-width="1.5" stroke-linecap="round"> <path d="M8.4 16.6v4.4M6.5 17.7l3.8 2.2M10.3 17.7l-3.8 2.2"/> <path d="M15.6 16.6v4.4M13.7 17.7l3.8 2.2M17.5 17.7l-3.8 2.2"/> </g>'],
    'bills': ['0 0 24 24', '<rect x="1.4" y="8.2" width="16.6" height="9.6" rx="1.5" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5" transform="rotate(-9 9.7 13)"/><rect x="1.4" y="8.2" width="16.6" height="9.6" rx="1.5" transform="rotate(-9 9.7 13)" fill="url(#gm-gloss)"/> <rect x="5.2" y="7.4" width="16.6" height="9.6" rx="1.5" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5" transform="rotate(7 13.5 12.2)"/> <circle cx="13.5" cy="12.4" r="2.5" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <path d="M13.5 10.2v4.4M12.3 11.3h2.4M12.3 13.3h2.4" stroke="var(--c-green)" stroke-width="0.9" stroke-linecap="round"/>'],

    'dish-cloche': ['0 0 24 24', '<path d="M3.2 14.4a8.8 8.8 0 0 1 17.6 0z" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/><path d="M3.2 14.4a8.8 8.8 0 0 1 17.6 0z" fill="url(#gm-gloss)"/> <path d="M6.2 14.4a5.8 5.8 0 0 1 9.4-4.5A8.8 8.8 0 0 0 6.2 14.4z" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/> <circle cx="12" cy="4.4" r="1.6" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <rect x="11.4" y="5.6" width="1.2" height="1.4" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/> <rect x="1.8" y="14.8" width="20.4" height="2.6" rx="1.3" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <rect x="4.6" y="18.6" width="14.8" height="2" rx="1" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5" opacity="0.5"/>'],
    'kids': ['0 0 24 24', '<circle cx="7.5" cy="5.4" r="2.5" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/> <circle cx="16.5" cy="5.4" r="2.5" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/> <g fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"> <circle cx="5.6" cy="15.2" r="2.4"/><circle cx="18.4" cy="15.2" r="2.4"/> <circle cx="8.6" cy="20.2" r="2.5"/><circle cx="15.4" cy="20.2" r="2.5"/> <rect x="6.7" y="12.6" width="10.6" height="8.6" rx="4.2"/> <circle cx="12" cy="8.4" r="5.3"/> </g> <ellipse cx="12" cy="17.4" rx="2.9" ry="2.5" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><ellipse cx="12" cy="17.4" rx="2.9" ry="2.5" fill="url(#gm-gloss)"/> <ellipse cx="12" cy="10.5" rx="2.6" ry="1.9" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <g fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"> <circle cx="9.9" cy="7.6" r="0.85"/><circle cx="14.1" cy="7.6" r="0.85"/> <ellipse cx="12" cy="9.8" rx="0.95" ry="0.7"/> </g>'],
    'tropical-bay': ['0 0 24 24', '<defs><clipPath id="cps"><rect x="3.4" y="5.2" width="17.2" height="13.6" rx="0.8"/></clipPath></defs><rect x="1.6" y="3.4" width="20.8" height="17.2" rx="1.6" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/><rect x="1.6" y="3.4" width="20.8" height="17.2" rx="1.6" fill="url(#gm-gloss)"/><rect x="3.4" y="5.2" width="17.2" height="13.6" rx="0.8" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><g clip-path="url(#cps)"><circle cx="18.2" cy="7.4" r="2.4" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M3.4 13.4h17.2v5.4H3.4z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><path d="M3.4 12.4c2.6-1.8 5-2.4 8-2.4s5.4.6 9.2 2.4v1.4H3.4z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><path d="M6 12.4c-.3-2.4-.2-4 .3-5l1.5.4c-.4.9-.5 2.4-.2 4.6z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M6.6 7.6c1.8-1 3.2-.8 4.2.6-1.2-.4-2.4-.3-3.4.3zM6.6 7.6c-1.8-1-3.2-.8-4.2.6 1.2-.4 2.4-.3 3.4.3z" fill="url(#gm-leaf)" stroke="var(--c-leaf-rim)" stroke-width="0.5"/><g fill="none" stroke="var(--c-paper)" stroke-width="0.7" stroke-linecap="round" opacity="0.85"><path d="M13.6 15.6c.9 0 .9.7 1.8.7s.9-.7 1.8-.7M13.6 17.4c.9 0 .9.7 1.8.7s.9-.7 1.8-.7"/></g></g>'],

    'moorish': ['0 0 24 24', '<rect x="1.6" y="6.2" width="7.2" height="15.2" rx="0.4" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><rect x="1.6" y="6.2" width="7.2" height="15.2" rx="0.4" fill="url(#gm-gloss)"/><rect x="15.2" y="6.2" width="7.2" height="15.2" rx="0.4" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><rect x="1.6" y="4" width="1.8" height="2.4" rx="0.2" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><rect x="4.2" y="4" width="1.8" height="2.4" rx="0.2" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><rect x="6.8" y="4" width="1.8" height="2.4" rx="0.2" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><rect x="15.2" y="4" width="1.8" height="2.4" rx="0.2" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><rect x="17.8" y="4" width="1.8" height="2.4" rx="0.2" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><rect x="20.4" y="4" width="1.8" height="2.4" rx="0.2" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><path d="M4.2 9.4V7.6a1 1 0 0 1 2 0v1.8z" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.4"/><path d="M17.8 9.4V7.6a1 1 0 0 1 2 0v1.8z" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.4"/><path d="M1.6 9.4h7.2M1.6 13.8h7.2M15.2 9.4h7.2M15.2 13.8h7.2" fill="none" stroke="var(--c-teal-rim)" stroke-width="1"/><rect x="8.8" y="10" width="6.4" height="11.4" rx="0.3" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/><path d="M10.2 21.4V16.8a1.8 1.8 0 0 1 3.6 0v4.6z" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/><path d="M10.2 21.4V16.8a1.8 1.8 0 0 1 3.6 0v4.6z" fill="url(#gm-sheen)"/><path d="M10.8 21.4V17.2a1.2 1.2 0 0 1 2.4 0v4.2z" fill="url(#gm-cocoa)" stroke="none"/><rect x="1" y="21.4" width="22" height="1.6" rx="0.8" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/>'],

    'pine-forest-chip': ['0 0 24 24', '<ellipse cx="12" cy="20.4" rx="10.6" ry="1.8" fill="url(#gm-leaf)" stroke="var(--c-leaf-rim)" stroke-width="0.5"/><path d="M4.6 9.4 6.21 13.56H2.99Z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><path d="M4.6 11.64 7.20 17.40H2.00Z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><rect x="4.16" y="17.10" width="0.88" height="3.20" rx="0.4" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M19.5 8.8 21.24 13.38H17.76Z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><path d="M19.5 11.26 22.30 17.60H16.70Z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><rect x="19.02" y="17.30" width="0.95" height="3.00" rx="0.4" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M15.4 6.2 17.51 12.44H13.29Z" fill="url(#gm-pine)" stroke="var(--c-pine-rim)" stroke-width="0.5"/><path d="M15.4 9.56 18.80 18.20H12.00Z" fill="url(#gm-pine)" stroke="var(--c-pine-rim)" stroke-width="0.5"/><rect x="14.82" y="17.90" width="1.16" height="2.40" rx="0.4" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M9.2 3.8 11.68 11.60H6.72Z" fill="url(#gm-pine)" stroke="var(--c-pine-rim)" stroke-width="0.5"/><path d="M9.2 8.00 13.20 18.80H5.20Z" fill="url(#gm-pine)" stroke="var(--c-pine-rim)" stroke-width="0.5"/><rect x="8.52" y="18.50" width="1.36" height="1.80" rx="0.4" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><ellipse cx="12" cy="20.4" rx="10.6" ry="1.8" fill="url(#gm-gloss)"/>'],

    'stage': ['0 0 24 24', '<g transform="rotate(13 6 17)"> <path d="M1.8 4.6h8.4L6 9.6z" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/> <rect x="5.5" y="9.2" width="1" height="6.4" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <rect x="3.4" y="15.4" width="5.2" height="1.6" rx="0.7" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <circle cx="8.4" cy="5.9" r="1" fill="url(#gm-leaf)" stroke="var(--c-leaf-rim)" stroke-width="0.5"/> </g> <g transform="rotate(-13 18 17)"> <path d="M13.8 4.6h8.4L18 9.6z" fill="url(#gm-rose)" stroke="var(--c-rose-rim)" stroke-width="0.5"/> <rect x="17.5" y="9.2" width="1" height="6.4" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <rect x="15.4" y="15.4" width="5.2" height="1.6" rx="0.7" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <circle cx="15.6" cy="5.9" r="1" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> </g> <path d="M12 1.4l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M12 1.4l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" fill="url(#gm-gloss)"/>'],

    'language-roundel': ['0 0 24 24', '<circle cx="12" cy="12" r="11" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <circle cx="10.2" cy="9.2" r="2.7" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/> <path d="M10.2 12.6c2.9 0 5.3 2 5.3 4.5v3.2H4.9v-3.2c0-2.5 2.4-4.5 5.3-4.5z" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/> <path d="M15 3.6h5a1.4 1.4 0 0 1 1.4 1.4v3.4A1.4 1.4 0 0 1 20 9.8h-2.6L15 11.6V9.8a1.4 1.4 0 0 1-1.4-1.4V5a1.4 1.4 0 0 1 1.4-1.4z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    'person-question': ['0 0 24 24', '<circle cx="9.4" cy="7.2" r="3.6" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/> <path d="M9.4 12c3.6 0 6.6 2.4 6.6 5.4v4.2H2.8v-4.2c0-3 3-5.4 6.6-5.4z" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/> <circle cx="18.4" cy="7" r="4.8" fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5"/> <text x="18.4" y="9.8" font-family="ui-sans-serif, system-ui, sans-serif" font-size="7.4" font-weight="700" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5" text-anchor="middle">?</text>'],

    'day-dots': ['0 0 24 24', '<g fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"><circle cx="3.4" cy="12" r="2.5"/><circle cx="9.1" cy="12" r="2.5"/><circle cx="14.8" cy="12" r="2.5"/></g><g fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5" opacity="0.4"><circle cx="20.5" cy="12" r="2.5"/></g><rect x="1" y="18.2" width="22" height="1.6" rx="0.8" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5" opacity="0.35"/>'],

    'blue-marble': ['0 0 24 24', '<circle cx="12" cy="12" r="10.2" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/><circle cx="12" cy="12" r="10.2" fill="url(#gm-gloss)"/> <path d="M4.8 5.6c2.4-.9 4.6-.4 5.8 1.1 1.1 1.5.2 3.2-1.7 4-2 .8-4.2 0-5.2-1.4-.9-1.3-.5-3 1.1-3.7z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/> <path d="M13.4 12.4c2.4-.7 4.4.2 5 1.9.6 1.8-.6 3.6-2.6 4.2-2 .6-3.9-.3-4.4-2-.5-1.7.3-3.5 2-4.1z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/> <path d="M17.4 4.4c1.4-.2 2.5.4 2.7 1.4.2 1-.6 1.9-1.9 2.1-1.3.2-2.4-.4-2.6-1.4-.2-1 .5-1.9 1.8-2.1z" fill="url(#gm-leaf)" stroke="var(--c-leaf-rim)" stroke-width="0.5"/> <g stroke="var(--c-paper)" stroke-width="0.9" fill="none" opacity="0.7"> <ellipse cx="12" cy="12" rx="4.5" ry="10.2"/><path d="M1.8 12h20.4"/><path d="M3.8 6.4h16.4M3.8 17.6h16.4"/> </g>'],
        'desert-island': ['0 0 24 24', '<ellipse cx="12" cy="20" rx="10.4" ry="2.6" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><ellipse cx="12" cy="20" rx="10.4" ry="2.6" fill="url(#gm-gloss)"/><path d="M4.6 19c0-2.6 3.3-4.6 7.4-4.6s7.4 2 7.4 4.6z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><rect x="11.2" y="6.6" width="1.7" height="9" rx="0.8" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M12 3.2c2.8 0 5 1.6 5.6 3.8-1.8-1.2-3.6-1.4-5.6-.6zM12 3.2c-2.8 0-5 1.6-5.6 3.8 1.8-1.2 3.6-1.4 5.6-.6zM12 3.2c1.6 1.6 2.2 3.4 2 5.6-1-1.8-2.2-2.8-4-3.2z" fill="url(#gm-leaf)" stroke="var(--c-leaf-rim)" stroke-width="0.5"/><path d="M12 3.2c2.8 0 5 1.6 5.6 3.8-1.8-1.2-3.6-1.4-5.6-.6zM12 3.2c-2.8 0-5 1.6-5.6 3.8 1.8-1.2 3.6-1.4 5.6-.6zM12 3.2c1.6 1.6 2.2 3.4 2 5.6-1-1.8-2.2-2.8-4-3.2z" fill="url(#gm-sheen)"/><circle cx="12" cy="3.2" r="1.2" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/>'],
    'wall-calendar': ['0 0 24 24', '<g fill="none" stroke="var(--c-stone)" stroke-width="1.4" stroke-linecap="round"><path d="M6.4 1.6v3.2M11.2 1.6v3.2M16 1.6v3.2M20.4 1.6v3.2"/></g><path d="M2.4 4.4h19.2a1.8 1.8 0 0 1 1.8 1.8v13.6a1.8 1.8 0 0 1-1.8 1.8H2.4a1.8 1.8 0 0 1-1.8-1.8V6.2a1.8 1.8 0 0 1 1.8-1.8z" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/><path d="M2.4 4.4h19.2a1.8 1.8 0 0 1 1.8 1.8v2.4H.6V6.2a1.8 1.8 0 0 1 1.8-1.8z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><g fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.4"><rect x="2.8" y="10.6" width="3.2" height="2.5" rx="0.5"/><rect x="7.0" y="10.6" width="3.2" height="2.5" rx="0.5"/><rect x="11.2" y="10.6" width="3.2" height="2.5" rx="0.5"/><rect x="15.400000000000002" y="10.6" width="3.2" height="2.5" rx="0.5"/><rect x="19.6" y="10.6" width="3.2" height="2.5" rx="0.5"/><rect x="2.8" y="14.1" width="3.2" height="2.5" rx="0.5"/><rect x="7.0" y="14.1" width="3.2" height="2.5" rx="0.5"/><rect x="11.2" y="14.1" width="3.2" height="2.5" rx="0.5"/><rect x="15.400000000000002" y="14.1" width="3.2" height="2.5" rx="0.5"/><rect x="19.6" y="14.1" width="3.2" height="2.5" rx="0.5"/><rect x="2.8" y="17.6" width="3.2" height="2.5" rx="0.5"/><rect x="7.0" y="17.6" width="3.2" height="2.5" rx="0.5"/><rect x="11.2" y="17.6" width="3.2" height="2.5" rx="0.5"/><rect x="15.400000000000002" y="17.6" width="3.2" height="2.5" rx="0.5"/><rect x="19.6" y="17.6" width="3.2" height="2.5" rx="0.5"/></g><rect x="11.2" y="14.1" width="3.2" height="2.5" rx="0.5" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><g fill="none" stroke="var(--c-stone)" stroke-width="1.2" stroke-linecap="round"><path d="M6.4 1.4v3.6M11.2 1.4v3.6M16 1.4v3.6M20.4 1.4v3.6"/></g>'],
    'guidebook-globe': ['0 0 24 24', '<path d="M4.4 2.6h13.2a2 2 0 0 1 2 2v14.8a2 2 0 0 1-2 2H4.4a1.6 1.6 0 0 1 0-3.2h1V2.6z" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/><rect x="5.4" y="2.6" width="12.2" height="15.2" rx="0" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><circle cx="11.4" cy="10.2" r="4.4" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><path d="M8 8.4c1.2-.5 2-.1 3 0 .9.1 1.4-.7 2.4-.5 1 .2 1.2 1.2 2.2 1.4-.4 1.2-1.4 1.4-2.2 2-.7.5-.5 1.6-1.5 1.8-1 .2-1.3-.7-2.2-.6-.9.1-1.1 1.1-2 .9-.5-1-.6-2.2-.4-3.2z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><g fill="none" stroke="var(--c-navy)" stroke-width="1.05" opacity="0.6"><path d="M7 10.2h8.8M11.4 5.8v8.8"/></g>'],

    'boutique': ['0 0 24 24', '<rect x="0.7" y="6.8" width="5.6" height="1.8" rx="0.5" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/><rect x="1.2" y="8.4" width="4.6" height="11.0" rx="0.7" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><g fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"><rect x="2.1" y="9.6" width="1.5" height="1.5" rx="0.3"/><rect x="4.2" y="9.6" width="1.5" height="1.5" rx="0.3"/><rect x="2.1" y="12.4" width="1.5" height="1.5" rx="0.3"/><rect x="4.2" y="12.4" width="1.5" height="1.5" rx="0.3"/><rect x="2.1" y="15.2" width="1.5" height="1.5" rx="0.3"/><rect x="4.2" y="15.2" width="1.5" height="1.5" rx="0.3"/></g><rect x="6.9" y="4.0" width="5.6" height="1.8" rx="0.5" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/><rect x="7.4" y="5.6" width="4.6" height="13.8" rx="0.7" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><g fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"><rect x="8.3" y="6.8" width="1.5" height="1.5" rx="0.3"/><rect x="10.4" y="6.8" width="1.5" height="1.5" rx="0.3"/><rect x="8.3" y="9.6" width="1.5" height="1.5" rx="0.3"/><rect x="10.4" y="9.6" width="1.5" height="1.5" rx="0.3"/><rect x="8.3" y="12.4" width="1.5" height="1.5" rx="0.3"/><rect x="10.4" y="12.4" width="1.5" height="1.5" rx="0.3"/><rect x="8.3" y="15.2" width="1.5" height="1.5" rx="0.3"/><rect x="10.4" y="15.2" width="1.5" height="1.5" rx="0.3"/></g><rect x="13.1" y="8.6" width="5.6" height="1.8" rx="0.5" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/><rect x="13.6" y="10.2" width="4.6" height="9.2" rx="0.7" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><g fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"><rect x="14.5" y="11.4" width="1.5" height="1.5" rx="0.3"/><rect x="16.6" y="11.4" width="1.5" height="1.5" rx="0.3"/><rect x="14.5" y="14.2" width="1.5" height="1.5" rx="0.3"/><rect x="16.6" y="14.2" width="1.5" height="1.5" rx="0.3"/></g><rect x="19.3" y="5.8" width="4.4" height="1.8" rx="0.5" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><rect x="19.8" y="7.4" width="3.4" height="12.0" rx="0.7" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><g fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"><rect x="20.5" y="8.6" width="1.5" height="1.5" rx="0.3"/><rect x="20.5" y="11.4" width="1.5" height="1.5" rx="0.3"/><rect x="20.5" y="14.2" width="1.5" height="1.5" rx="0.3"/></g><rect x="0.6" y="19.4" width="22.8" height="3.4" rx="0.8" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><rect x="0.6" y="19.4" width="22.8" height="3.4" rx="0.8" fill="url(#gm-gloss)"/><g fill="none" stroke="var(--c-paper)" stroke-width="0.9" stroke-linecap="round" stroke-dasharray="2.2 2" opacity="0.85"><path d="M1.6 21.1h20.8"/></g>'],

    'night-sky': ['0 0 24 24', '<rect x="2.4" y="3.6" width="19.2" height="16.8" rx="2.2" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><rect x="2.4" y="3.6" width="19.2" height="16.8" rx="2.2" fill="url(#gm-gloss)"/><path d="M15.6 6.2a4.6 4.6 0 1 0 4.2 6.5 5.2 5.2 0 0 1-4.2-6.5z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><g fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.4"><circle cx="6.2" cy="7.4" r="0.85"/><circle cx="9.4" cy="10.6" r="0.6"/><circle cx="5.4" cy="12.4" r="0.6"/></g><path d="M2.4 17.4c2.6-2.2 5-2.2 7.4 0 2.4-2.4 4.8-2.4 7.2 0 1.6-1.2 3.2-1.4 4.6-.6v1.4a2.2 2.2 0 0 1-2.2 2.2H4.6a2.2 2.2 0 0 1-2.2-2.2z" fill="url(#gm-grape)" stroke="var(--c-grape-rim)" stroke-width="0.5"/>'],
    'leaf-autumn': ['0 0 24 24', '<path d="M12 21.4V12" fill="none" stroke="var(--c-cocoa)" stroke-width="1.5" stroke-linecap="round"/><path d="M12 12.6c-3.4-1-5.4-3.4-5.4-6.6 0-1 .2-2 .6-2.9 3.2.3 5.6 2.2 6.6 5.2z" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/><path d="M12 12.6c-3.4-1-5.4-3.4-5.4-6.6 0-1 .2-2 .6-2.9 3.2.3 5.6 2.2 6.6 5.2z" fill="url(#gm-gloss)"/><path d="M12 12.6c3.4-1 5.4-3.4 5.4-6.6 0-1-.2-2-.6-2.9-3.2.3-5.6 2.2-6.6 5.2z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M12 15.4c-2.6-.6-4.2-2.2-4.6-4.4 2.4-.2 4.2 1 5 3z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/>'],
    'snowflake': ['0 0 24 24', '<g fill="none" stroke="var(--c-sky)" stroke-width="2" stroke-linecap="round"><path d="M12 2.6v18.8M4.1 7.1l15.8 9.8M19.9 7.1L4.1 16.9"/></g><g fill="none" stroke="var(--c-blue)" stroke-width="1.6" stroke-linecap="round"><path d="M12 6.2 9.4 4M12 6.2 14.6 4M12 17.8l-2.6 2.2M12 17.8l2.6 2.2M7.2 9.4 4 9.2M7.2 9.4 5.6 12M16.8 14.6l3.2.2M16.8 14.6l1.6-2.6M7.2 14.6 4 14.8M7.2 14.6 5.6 12M16.8 9.4 20 9.2M16.8 9.4l1.6 2.6"/></g><circle cx="12" cy="12" r="1.6" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/><circle cx="12" cy="12" r="1.6" fill="url(#gm-gloss)"/>'],

    'artframe': ['0 0 24 24', '<rect x="2.2" y="3.4" width="19.6" height="17.2" rx="1" fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5"/><rect x="2.2" y="3.4" width="19.6" height="17.2" rx="1" fill="url(#gm-gloss)"/> <rect x="4.4" y="5.6" width="15.2" height="12.8" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/> <circle cx="8.4" cy="9.2" r="1.7" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <path d="M4.4 18.4 9.6 11.6l3.2 4 2.6-3 4.2 5.8z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/> <rect x="4.4" y="5.6" width="15.2" height="12.8" fill="none" stroke="var(--c-cocoa)" stroke-width="0.8" opacity="0.35"/>'],
    'aurora': ['0 0 24 24', '<rect x="1.4" y="1.6" width="21.2" height="20.8" rx="2" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><rect x="1.4" y="1.6" width="21.2" height="20.8" rx="2" fill="url(#gm-gloss)"/> <path d="M3 21c0-6.6 4-12 9-12s9 5.4 9 12h-2.2c0-5.4-3-10-6.8-10S5.2 15.6 5.2 21z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5" opacity="0.85"/> <path d="M5.6 21c0-4.8 2.9-8.8 6.4-8.8s6.4 4 6.4 8.8h-2c0-3.7-2-6.8-4.4-6.8s-4.4 3.1-4.4 6.8z" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5" opacity="0.85"/> <path d="M8.2 21c0-3 1.7-5.4 3.8-5.4s3.8 2.4 3.8 5.4h-1.9c0-2-.9-3.6-1.9-3.6s-1.9 1.6-1.9 3.6z" fill="url(#gm-plum)" stroke="var(--c-plum-rim)" stroke-width="0.5" opacity="0.85"/> <g fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"><circle cx="4.6" cy="4.6" r="0.7"/><circle cx="19.4" cy="5.4" r="0.7"/><circle cx="15" cy="3.4" r="0.55"/></g>'],
    'balloon': ['0 0 24 24', '<path d="M12 1.6a7.4 7.4 0 0 0-7.4 7.4c0 4.1 3.7 8 6.2 9.2h2.4c2.5-1.2 6.2-5.1 6.2-9.2A7.4 7.4 0 0 0 12 1.6z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><path d="M12 1.6a7.4 7.4 0 0 0-7.4 7.4c0 4.1 3.7 8 6.2 9.2h2.4c2.5-1.2 6.2-5.1 6.2-9.2A7.4 7.4 0 0 0 12 1.6z" fill="url(#gm-gloss)"/> <path d="M12 1.6c-1.9 0-3.5 3.3-3.5 7.4 0 3.6 1.4 7 2.7 8.9h1.6c1.3-1.9 2.7-5.3 2.7-8.9 0-4.1-1.6-7.4-3.5-7.4z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <path d="M12 1.6c-.8 0-1.5 3.3-1.5 7.4 0 3.6.6 7 1.2 8.9h.6c.6-1.9 1.2-5.3 1.2-8.9 0-4.1-.7-7.4-1.5-7.4z" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/> <path d="M9.6 18.6h4.8l-.8 3.4a1 1 0 0 1-1 .8h-1.2a1 1 0 0 1-1-.8z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/>'],
    'bang': ['0 0 24 24', '<path d="M9.3 2.2h5.4l-1 13.2h-3.4z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> <rect x="9.3" y="17.4" width="5.4" height="5.2" rx="1.6" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> <path d="M10.2 3.4h1.5l-.75 11h-.5z" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6" opacity="0.4"/> <rect x="10.1" y="18.3" width="1.5" height="1.6" rx="0.7" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6" opacity="0.4"/>'],
    'beach': ['0 0 24 24', '<path d="M12 2.4C7.5 2.4 3.8 5.6 3 9.8L12 7.5l9 2.3C20.2 5.6 16.5 2.4 12 2.4z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><path d="M12 2.4C7.5 2.4 3.8 5.6 3 9.8L12 7.5l9 2.3C20.2 5.6 16.5 2.4 12 2.4z" fill="url(#gm-gloss)"/> <path d="M12 2.4C9.8 2.4 8 5.6 7.6 9.8L12 7.5l4.4 2.3C16 5.6 14.2 2.4 12 2.4z" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <rect x="11.3" y="7.5" width="1.4" height="10" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/> <path d="M1.6 17.6h20.8v2.2H1.6z" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/> <path d="M1.6 20.2c1.7 0 1.7 1.4 3.4 1.4s1.7-1.4 3.4-1.4 1.7 1.4 3.4 1.4 1.7-1.4 3.4-1.4 1.7 1.4 3.4 1.4 1.7-1.4 3.4-1.4" fill="none" stroke="var(--c-blue)" stroke-width="1.6" stroke-linecap="round"/>'],
    'book': ['0 0 24 24', '<path d="M1.4 4.6c2.9-1.2 7.6-1.1 10.6 1 3-2.1 7.7-2.2 10.6-1v15c-2.9-1.2-7.6-1.1-10.6 1-3-2.1-7.7-2.2-10.6-1z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <path d="M2.9 6.4c2.4-.9 6.1-.8 8.4.9v11.6c-2.3-1.7-6-1.8-8.4-.9z" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6" stroke-linejoin="round" /> <path d="M21.1 6.4c-2.4-.9-6.1-.8-8.4.9v11.6c2.3-1.7 6-1.8 8.4-.9z" fill="url(#gm-cream)" stroke="var(--c-rim-cool)" stroke-width="0.6" stroke-linejoin="round" /> <g fill="none" stroke="var(--c-stone)" stroke-width="1" stroke-linecap="round"> <path d="M4.6 9h5M4.6 11.4h5M4.6 13.8h3.4M14.4 9.6h5M14.4 12h5M14.4 14.4h3.4"/> </g> <path d="M16.4 3.8h1.9v6.4l-.95-1.2-.95 1.2z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/>'],
    /* Site-Icons #651 (bookmark) — owner pick 2026-08-14, replacing the heavy
       chain #1303. The glyph is still 💥 and the key is still 'burst'; the key
       names the authored glyph, never the drawing. */
    'burst': ['0 0 24 24', '<path d="M5.4 2.4h13.2a1.8 1.8 0 0 1 1.8 1.8v18l-8.4-5.4-8.4 5.4v-18a1.8 1.8 0 0 1 1.8-1.8z" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/><path d="M12 6.4l1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    'calendar': ['0 0 24 24', '<rect x="2.6" y="4" width="18.8" height="17.2" rx="2.4" fill="url(#gm-paper)" stroke="var(--c-rim-warm)" stroke-width="1" stroke-linejoin="round" /> <path d="M2.6 6.4A2.4 2.4 0 0 1 5 4h14a2.4 2.4 0 0 1 2.4 2.4v2.4H2.6z" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/> <rect x="6.3" y="1.9" width="2.2" height="4" rx="1.1" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/> <rect x="15.5" y="1.9" width="2.2" height="4" rx="1.1" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/> <g fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5" opacity="0.45"> <rect x="5.4" y="11" width="3.1" height="2.7" rx="0.7"/><rect x="10.45" y="11" width="3.1" height="2.7" rx="0.7"/> <rect x="15.5" y="11" width="3.1" height="2.7" rx="0.7"/><rect x="5.4" y="15.4" width="3.1" height="2.7" rx="0.7"/> <rect x="15.5" y="15.4" width="3.1" height="2.7" rx="0.7"/> </g> <rect x="10.45" y="15.4" width="3.1" height="2.7" rx="0.7" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    'card': ['0 0 24 24', '<rect x="1.6" y="4.6" width="20.8" height="14.8" rx="2.4" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><rect x="1.6" y="4.6" width="20.8" height="14.8" rx="2.4" fill="url(#gm-gloss)"/> <rect x="1.6" y="7.8" width="20.8" height="3.4" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/> <rect x="4" y="13.4" width="5.4" height="3.6" rx="0.7" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <g stroke="var(--c-amber)" stroke-width="0.7" opacity="0.8"> <path d="M6.7 13.4v3.6M4 15.2h5.4"/> </g> <g fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6" opacity="0.75"> <rect x="12.4" y="14.6" width="4.4" height="1.3" rx="0.65"/><rect x="18" y="14.6" width="2.4" height="1.3" rx="0.65"/> </g>'],
    'chart': ['0 0 24 24', '<rect x="3.2" y="12.6" width="4.6" height="8" rx="1.1" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <rect x="9.7" y="8.4" width="4.6" height="12.2" rx="1.1" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <rect x="16.2" y="4.4" width="4.6" height="16.2" rx="1.1" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/> <path d="M2 22h20" stroke="var(--c-stone)" stroke-width="1.5" stroke-linecap="round"/>'],
    'cathedral': ['0 0 24 24', '<g fill="none" stroke="var(--c-sky)" stroke-width="1.3" stroke-linecap="round"><path d="M12 3.6v3.4"/><path d="M12.9 7.6c2.4 1 3.9 3 4.3 5.6"/><path d="M11.1 7.6c-2.4 1-3.9 3-4.3 5.6"/></g><circle cx="12" cy="2.9" r="1" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><path d="M7.6 9.8h8.8c0 2.1-2 3.4-4.4 3.4s-4.4-1.3-4.4-3.4z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><rect x="10.9" y="12.8" width="2.2" height="4.6" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><path d="M2.8 16.8h18.4c0 2.6-4.1 4.2-9.2 4.2S2.8 19.4 2.8 16.8z" fill="url(#gm-slate)" stroke="var(--c-slate-rim)" stroke-width="0.5"/><ellipse cx="12" cy="16.8" rx="9.2" ry="2.2" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><ellipse cx="12" cy="16.8" rx="9.2" ry="2.2" fill="url(#gm-gloss)"/><path d="M5.6 16.4c1.4-.7 2.6.5 4 0s2.6.5 4 0 2.6.5 4 0" fill="none" stroke="url(#gm-paper)" stroke-width="0.9" stroke-linecap="round" opacity="0.7"/>'],
    'church': ['0 0 24 24', '<rect x="11.2" y="1.4" width="1.6" height="5" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><rect x="11.2" y="1.4" width="1.6" height="5" fill="url(#gm-gloss)"/><rect x="9.6" y="2.8" width="4.8" height="1.6" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <path d="M12 7 20 13.4V21.6H4V13.4z" fill="url(#gm-cream)" stroke="var(--c-rim-cool)" stroke-width="1" stroke-linejoin="round" /> <path d="M12 7 20 13.4h-2.6L12 9.6 6.6 13.4H4z" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/> <path d="M10 21.6v-4.2a2 2 0 0 1 4 0v4.2z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/> <circle cx="12" cy="14.4" r="1.7" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/> <rect x="3.2" y="21.4" width="17.6" height="1.6" rx="0.8" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/>'],
    'clock-stop': ['0 0 24 24', '<circle cx="12" cy="12" r="10" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/> <circle cx="12" cy="12" r="8.1" fill="url(#gm-cream)" stroke="var(--c-rim-cool)" stroke-width="1" stroke-linejoin="round" /> <g fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"> <rect x="11.4" y="4.6" width="1.2" height="2" rx="0.6"/><rect x="11.4" y="17.4" width="1.2" height="2" rx="0.6"/> <rect x="4.6" y="11.4" width="2" height="1.2" rx="0.6"/><rect x="17.4" y="11.4" width="2" height="1.2" rx="0.6"/> </g> <g stroke="var(--c-navy)" stroke-width="1.9" stroke-linecap="round" fill="none"> <path d="M12 7.6V12"/><path d="M12 12l3.6 2.1"/> </g> <circle cx="12" cy="12" r="1.2" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    'clock': ['0 0 24 24', '<circle cx="12" cy="12" r="10" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/> <circle cx="12" cy="12" r="8.1" fill="url(#gm-cream)" stroke="var(--c-rim-cool)" stroke-width="1" stroke-linejoin="round" /> <g fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"> <rect x="11.4" y="4.6" width="1.2" height="2" rx="0.6"/><rect x="11.4" y="17.4" width="1.2" height="2" rx="0.6"/> <rect x="4.6" y="11.4" width="2" height="1.2" rx="0.6"/><rect x="17.4" y="11.4" width="2" height="1.2" rx="0.6"/> </g> <g stroke="var(--c-navy)" stroke-width="1.9" stroke-linecap="round" fill="none"> <path d="M12 7.6V12"/><path d="M12 12l3.6 2.1"/> </g> <circle cx="12" cy="12" r="1.2" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    /* Guide-Icons.html specimen #63, "Clock · wall clock" — owner pick 2026-08-13
       for Time Zones. Separate key from 'clock' (specimen #62, the shipped
       shape), which stays on Connection Times and Visa Processing Times. */
    'wall-clock': ['0 0 24 24', '<circle cx="12" cy="12" r="10.4" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><circle cx="12" cy="12" r="8.6" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/><g fill="none" stroke="var(--c-stone)" stroke-width="0.8" stroke-linecap="round"><path d="M12.00 4.95L12.00 3.74"/><path d="M15.53 5.89L16.13 4.85"/><path d="M18.11 8.47L19.15 7.87"/><path d="M19.05 12.00L20.26 12.00"/><path d="M18.11 15.53L19.15 16.13"/><path d="M15.53 18.11L16.13 19.15"/><path d="M12.00 19.05L12.00 20.26"/><path d="M8.47 18.11L7.87 19.15"/><path d="M5.89 15.53L4.85 16.13"/><path d="M4.95 12.00L3.74 12.00"/><path d="M5.89 8.47L4.85 7.87"/><path d="M8.47 5.89L7.87 4.85"/></g><g fill="none" stroke="var(--c-tire)" stroke-linecap="round"><path d="M12 12L9.57 10.30" stroke-width="1.90"/><path d="M12 12L15.83 9.79" stroke-width="1.50"/></g><circle cx="12" cy="12" r="1" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/>'],
    /* Guide-Icons.html specimen #572, "Preview · wand" — owner pick 2026-08-13
       for Unique Hotels, replacing the 'bulb'. 'bulb' is untouched and stays
       wherever else it is drawn. */
    'wand': ['0 0 24 24', '<path d="M14.4 2.2 15.9 6.1 19.8 7.6 15.9 9.1 14.4 13 12.9 9.1 9 7.6 12.9 6.1z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M12.2 11.4 3.4 20.2a1.9 1.9 0 0 0 2.7 2.7l8.8-8.8z" fill="url(#gm-plum)" stroke="var(--c-plum-rim)" stroke-width="0.5"/><circle cx="20.4" cy="13.4" r="1.5" fill="url(#gm-rose)" stroke="var(--c-rose-rim)" stroke-width="0.5"/><circle cx="6.6" cy="5.4" r="1.2" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/>'],
    /* Guide-Icons.html specimen #324, "Sun · sun and palms" — owner pick
       2026-08-13 for Browse by City, replacing the generic 'search' magnifier.
       'search' itself stays: the Hotels & Flights pill still draws it. */
    'sun-palms': ['0 0 24 24', '<circle cx="12.6" cy="10.2" r="5.4" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><circle cx="12.6" cy="10.2" r="5.4" fill="url(#gm-gloss)"/><rect x="1" y="19.4" width="22" height="2.4" rx="1.2" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><path d="M5.4 19.4c-.4-3.6-.2-6.4.6-8.4l1.9.5c-.7 1.8-.9 4.4-.5 7.9z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M6.4 10.4c2.4-1.6 4.4-1.4 6 .6-1.8-.6-3.5-.4-5 .6zM6.4 10.4c-2.4-1.6-4.4-1.4-6 .6 1.8-.6 3.5-.4 5 .6zM6.4 10.4c.6-2.6 2-4 4.2-4.2-1.5 1-2.6 2.4-3.2 4.2z" fill="url(#gm-leaf)" stroke="var(--c-leaf-rim)" stroke-width="0.5"/><path d="M18.4 19.4c.3-3 .1-5.4-.5-7l1.8-.5c.7 1.7.9 4.2.6 7.5z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M19 12.2c2-1.3 3.7-1.1 5 .5-1.5-.5-2.9-.3-4.2.5zM19 12.2c-2-1.3-3.7-1.1-5 .5 1.5-.5 2.9-.3 4.2.5z" fill="url(#gm-leaf)" stroke="var(--c-leaf-rim)" stroke-width="0.5"/>'],
    /* Guide-Icons.html specimen #71, "Clock · clock and hourglass" — owner pick
       2026-08-13 for Visa Processing Times. Fourth distinct clock; 'clock' (#62)
       is now only the hours band and duration chip, which draw it directly. */
    'clock-hourglass': ['0 0 24 24', '<circle cx="8.6" cy="10.4" r="7.4" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><circle cx="8.6" cy="10.4" r="5.8" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/><g fill="none" stroke="var(--c-stone)" stroke-width="1.05" stroke-linecap="round"><path d="M8.60 5.64L8.60 4.83"/><path d="M10.98 6.28L11.38 5.58"/><path d="M12.72 8.02L13.42 7.62"/><path d="M13.36 10.40L14.17 10.40"/><path d="M12.72 12.78L13.42 13.18"/><path d="M10.98 14.52L11.38 15.22"/><path d="M8.60 15.16L8.60 15.97"/><path d="M6.22 14.52L5.82 15.22"/><path d="M4.48 12.78L3.78 13.18"/><path d="M3.84 10.40L3.03 10.40"/><path d="M4.48 8.02L3.78 7.62"/><path d="M6.22 6.28L5.82 5.58"/></g><g fill="none" stroke="var(--c-tire)" stroke-linecap="round"><path d="M8.6 10.4L6.47 9.83" stroke-width="1.61"/><path d="M8.6 10.4L8.60 13.68" stroke-width="1.27"/></g><circle cx="8.6" cy="10.4" r="0.7" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><rect x="14.4" y="16.4" width="7.6" height="1.6" rx="0.8" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><rect x="14.4" y="3.6" width="7.6" height="1.6" rx="0.8" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M15.2 5.2h6c0 1.9-1 3.2-3 4.5 2 1.3 3 2.6 3 4.5h-6c0-1.9 1-3.2 3-4.5-2-1.3-3-2.6-3-4.5z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5" opacity="0.85"/><path d="M16 6.2h4.4L18.2 9.7z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M16.4 15.2c0-1.2.8-2 1.8-2s1.8.8 1.8 2z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    /* Guide-Icons.html specimen #67, "Clock · wristwatch" — owner pick 2026-08-13
       for Connection Times. Third distinct clock: 'clock' (#62) stays on Visa
       Processing Times, 'wall-clock' (#63) is Time Zones. */
    'wristwatch': ['0 0 24 24', '<rect x="8.4" y="1.2" width="7.2" height="5" rx="1.2" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><rect x="8.4" y="17.8" width="7.2" height="5" rx="1.2" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><circle cx="12" cy="12" r="6.6" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><circle cx="12" cy="12" r="5" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/><g fill="none" stroke="var(--c-stone)" stroke-width="1.05" stroke-linecap="round"><path d="M12.00 7.90L12.00 7.20"/><path d="M14.05 8.45L14.40 7.84"/><path d="M15.55 9.95L16.16 9.60"/><path d="M16.10 12.00L16.80 12.00"/><path d="M15.55 14.05L16.16 14.40"/><path d="M14.05 15.55L14.40 16.16"/><path d="M12.00 16.10L12.00 16.80"/><path d="M9.95 15.55L9.60 16.16"/><path d="M8.45 14.05L7.84 14.40"/><path d="M7.90 12.00L7.20 12.00"/><path d="M8.45 9.95L7.84 9.60"/><path d="M9.95 8.45L9.60 7.84"/></g><g fill="none" stroke="var(--c-tire)" stroke-linecap="round"><path d="M12 12L10.38 10.86" stroke-width="1.52"/><path d="M12 12L14.56 10.52" stroke-width="1.20"/></g><circle cx="12" cy="12" r="0.7" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/>'],
    'closed': ['0.10 0.10 23.81 23.81', '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2c1.9 0 3.6.6 5 1.7L5.7 17A8 8 0 0 1 12 4zm0 16c-1.9 0-3.6-.6-5-1.7L18.3 7A8 8 0 0 1 12 20z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/>'],
    'coffee': ['0 0 24 24', '<ellipse cx="11.4" cy="19.9" rx="10.2" ry="2.2" fill="var(--c-tire)" opacity="0.13"/><ellipse cx="11.4" cy="19.4" rx="10.2" ry="2.6" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><ellipse cx="11.4" cy="19.4" rx="10.2" ry="2.6" fill="url(#gm-gloss)"/><ellipse cx="11.4" cy="18.9" rx="7.4" ry="1.6" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><ellipse cx="11.4" cy="18.9" rx="7.4" ry="1.6" fill="var(--c-tire)" opacity="0.10"/><path d="M19.6 9.4a3.4 3.4 0 0 1 0 6.8h-1.6v-2.2h1.6a1.2 1.2 0 0 0 0-2.4h-1.6V9.4z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M3.4 8.2h15.4v3.4c0 3.9-3.4 6.8-7.7 6.8s-7.7-2.9-7.7-6.8z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M4.9 9.1c-.35 2.6-.2 4.6.7 6.3-1.4-1.3-2.1-3-2.2-5.2z" fill="var(--c-paper)" opacity="0.34"/><ellipse cx="11.1" cy="8.2" rx="7.7" ry="2.6" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><ellipse cx="11.1" cy="8.2" rx="6.3" ry="2.0" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/><g fill="none" stroke="var(--c-cream)" stroke-width="0.8" stroke-linecap="round"><path d="M8.2 8.2c0-1 1.3-1.8 2.9-1.8s2.9.8 2.9 1.8-1.3 1.8-2.9 1.8-2.9-.8-2.9-1.8z"/><path d="M11.1 6.4v3.6"/></g><ellipse cx="11.1" cy="19.4" rx="4.4" ry="1.0" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5" opacity="0.5"/>'],
    'dessert': ['0 0 24 24', '<ellipse cx="12" cy="15.4" rx="10.4" ry="5.8" fill="url(#gm-slate)" stroke="var(--c-slate-rim)" stroke-width="0.5"/><ellipse cx="12" cy="15.0" rx="7.9" ry="4.2" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/><ellipse cx="12" cy="14.2" rx="6.6" ry="3.4" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><g fill="none" stroke="var(--c-amber)" stroke-width="0.75" stroke-linecap="round" opacity="0.85"><path d="M6.4 14c2.2-1.9 9-1.9 11.2 0"/><path d="M6.6 15.4c2.4 1.7 8.4 1.7 10.8 0"/><path d="M8 12.4c1.6 1.4 6.4 1.4 8 0"/></g><ellipse cx="12" cy="12.9" rx="2.9" ry="1.6" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><circle cx="13.6" cy="11.8" r="0.75" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><ellipse cx="12" cy="15.4" rx="10.4" ry="5.8" fill="url(#gm-gloss)"/>'],
    'disney-parks': ['0 0 24 24', '<path d="M6.6 4.6h0.5v3h-0.5z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><path d="M6.6 4.6h0.5v3h-0.5z" fill="url(#gm-gloss)"/> <path d="M7.1 4.7 9.3 5.5 7.1 6.3z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> <path d="M16.9 4.6h0.5v3h-0.5z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <path d="M17.4 4.7 19.6 5.5 17.4 6.3z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> <path d="M4.4 9.8 7 4.6l2.6 5.2z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <path d="M14.4 9.8 17 4.6l2.6 5.2z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <path d="M8.4 7.6 12 1.4l3.6 6.2z" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/> <rect x="4.7" y="9.8" width="4.6" height="12" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <rect x="14.7" y="9.8" width="4.6" height="12" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <rect x="8.6" y="7.6" width="6.8" height="14.2" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="1" stroke-linejoin="round" /> <g fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"> <rect x="6.1" y="12.2" width="1.8" height="2.6" rx="0.9"/><rect x="16.1" y="12.2" width="1.8" height="2.6" rx="0.9"/> <rect x="11.2" y="10" width="1.7" height="2.5" rx="0.85"/> </g> <path d="M9.9 21.8v-4.2a2.1 2.1 0 0 1 4.2 0v4.2z" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/>'],
    'download': ['0 0 24 24', '<rect x="4.4" y="1.8" width="15.2" height="20.4" rx="2.6" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><rect x="6" y="4.6" width="12" height="13.2" rx="1.1" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><path d="M10.6 6.4h2.8v3.6h2L12 15.4 8.6 10h2z" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/><circle cx="12" cy="20.1" r="1.05" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><rect x="4.4" y="1.8" width="15.2" height="20.4" rx="2.6" fill="url(#gm-gloss)"/>'],
    'entry-req': ['0 0 24 24', '<rect x="2" y="3.6" width="20" height="16.8" rx="2" fill="url(#gm-cream)" stroke="var(--c-rim-cool)" stroke-width="1" stroke-linejoin="round" /><rect x="2" y="3.6" width="20" height="16.8" rx="2" fill="url(#gm-gloss)"/> <rect x="2" y="3.6" width="20" height="3.4" rx="2" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><rect x="2" y="5.6" width="20" height="1.4" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/> <g fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5" opacity="0.6"><rect x="4.6" y="9.6" width="9" height="1.4" rx="0.7"/><rect x="4.6" y="12.4" width="7" height="1.4" rx="0.7"/><rect x="4.6" y="15.2" width="5" height="1.4" rx="0.7"/></g> <g transform="rotate(-16 16.4 14.4)"><circle cx="16.4" cy="14.4" r="4.4" fill="none" stroke="var(--c-red)" stroke-width="1.5"/><path d="M13.6 14.4h5.6" stroke="var(--c-red)" stroke-width="1.5" stroke-linecap="round"/></g>'],
    'exchange': ['0 0 24 24', '<circle cx="6.1" cy="13.6" r="5.1" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><circle cx="6.1" cy="13.6" r="5.1" fill="url(#gm-gloss)"/><circle cx="6.1" cy="13.6" r="3.95" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><text x="6.1" y="15.6" font-family="ui-sans-serif, system-ui, sans-serif" font-size="5.4" font-weight="700" text-anchor="middle" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.4">$</text><ellipse cx="3.86" cy="10.95" rx="1.33" ry="0.76" transform="rotate(-38 3.86 10.95)" fill="url(#gm-paper)" opacity="0.55"/><circle cx="17.9" cy="13.6" r="5.1" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><circle cx="17.9" cy="13.6" r="3.95" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><text x="17.9" y="15.6" font-family="ui-sans-serif, system-ui, sans-serif" font-size="5.4" font-weight="700" text-anchor="middle" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.4">&#8364;</text><ellipse cx="15.66" cy="10.95" rx="1.33" ry="0.76" transform="rotate(-38 15.66 10.95)" fill="url(#gm-paper)" opacity="0.55"/><path d="M4.1 8.4C6.2 3.6 17.8 3.6 19.9 8.4" fill="none" stroke="var(--c-sun)" stroke-width="1.0" stroke-linecap="round"/><path d="M21 9.5 18.9 9.9 19.9 7.9z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M19.9 18.6C17.8 23.4 6.2 23.4 4.1 18.6" fill="none" stroke="var(--c-sun)" stroke-width="1.0" stroke-linecap="round"/><path d="M3 17.5 5.1 17.1 4.1 19.1z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    'ferris': ['0 0 24 24', '<circle cx="12" cy="10.6" r="8.2" fill="none" stroke="var(--c-teal)" stroke-width="1.7"/> <g stroke="var(--c-teal)" stroke-width="1.2"><path d="M12 2.4v16.4M3.8 10.6h16.4M6.2 4.8l11.6 11.6M17.8 4.8 6.2 16.4"/></g> <circle cx="12" cy="10.6" r="2" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/><circle cx="12" cy="10.6" r="2" fill="url(#gm-gloss)"/> <g fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"><circle cx="12" cy="2.4" r="1.7"/><circle cx="20.2" cy="10.6" r="1.7"/><circle cx="3.8" cy="10.6" r="1.7"/><circle cx="17.8" cy="4.8" r="1.7"/><circle cx="6.2" cy="4.8" r="1.7"/><circle cx="17.8" cy="16.4" r="1.7"/><circle cx="6.2" cy="16.4" r="1.7"/></g> <path d="M8.4 21.6 12 12l3.6 9.6z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M8.4 21.6 12 12l3.6 9.6z" fill="url(#gm-sheen)"/><rect x="4.6" y="21.2" width="14.8" height="1.6" rx="0.8" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/>'],
    'first-timer': ['0 0 24 24', '<circle cx="9.4" cy="7.2" r="3.6" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/> <path d="M9.4 12c3.6 0 6.6 2.4 6.6 5.4v4.2H2.8v-4.2c0-3 3-5.4 6.6-5.4z" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/> <circle cx="18.4" cy="7" r="4.8" fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5"/> <text x="18.4" y="9.8" font-family="ui-sans-serif, system-ui, sans-serif" font-size="7.4" font-weight="700" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5" text-anchor="middle">?</text>'],
    'fish': ['0 0 24 24', '<path d="M21.8 12c-2-3.5-5.9-5.8-9.8-5.8-3.3 0-6.1 1.6-8 3.7L1.6 7.4v9.2l2.4-2.5c1.9 2.1 4.7 3.7 8 3.7 3.9 0 7.8-2.3 9.8-5.8z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/><path d="M21.8 12c-2-3.5-5.9-5.8-9.8-5.8-3.3 0-6.1 1.6-8 3.7L1.6 7.4v9.2l2.4-2.5c1.9 2.1 4.7 3.7 8 3.7 3.9 0 7.8-2.3 9.8-5.8z" fill="url(#gm-gloss)"/> <path d="M12 6.2c-3.3 0-6.1 1.6-8 3.7L1.6 7.4v9.2l2.4-2.5c1.9 2.1 4.7 3.7 8 3.7z" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/> <circle cx="17.2" cy="10.8" r="1.5" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/><circle cx="17.5" cy="10.9" r="0.75" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/> <path d="M10.6 12.6c1.6 1 3.4 1.4 5.2 1.2" stroke="var(--c-sky)" stroke-width="1.1" fill="none" stroke-linecap="round" opacity="0.8"/>'],
    'fountain': ['0 0 24 24', '<circle cx="12" cy="3.2" r="1.9" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><circle cx="12" cy="3.2" r="1.9" fill="url(#gm-gloss)"/> <path d="M10.6 5.2C8.2 6.3 6.7 8 6.2 10.4h2.1c.4-1.6 1.4-2.8 3-3.5z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/> <path d="M13.4 5.2c2.4 1.1 3.9 2.8 4.4 5.2h-2.1c-.4-1.6-1.4-2.8-3-3.5z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/> <path d="M10.9 7.4h2.2v6.4h-2.2z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <path d="M3.2 13.6h17.6v1.8a5.6 5.6 0 0 1-5.6 5.6H8.8a5.6 5.6 0 0 1-5.6-5.6z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <path d="M4.8 15.4h14.4a5.5 5.5 0 0 1-2.1 3.4H6.9a5.5 5.5 0 0 1-2.1-3.4z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <circle cx="9.4" cy="17.4" r="1.1" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <circle cx="13.6" cy="17.9" r="0.9" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    'globe': ['0 0 24 24', '<circle cx="10.4" cy="10.4" r="7.4" fill="url(#gm-paper)" stroke="var(--c-navy-rim)" stroke-width="1.5"/><circle cx="9" cy="9" r="2.7" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M8.2 14.6a2.3 2.3 0 0 1 .2-4.5 3 3 0 0 1 5.6.7 2 2 0 0 1-.5 3.8z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><path d="M15.9 15.9l5.4 5.4" stroke="var(--c-navy-rim)" stroke-width="2.6" stroke-linecap="round" fill="none"/>'],
    'hotel': ['0 0 24 24', '<rect x="4.2" y="2.6" width="15.6" height="19" rx="1" fill="url(#gm-cream)" stroke="var(--c-rim-cool)" stroke-width="1" stroke-linejoin="round" /><rect x="4.2" y="2.6" width="15.6" height="19" rx="1" fill="url(#gm-gloss)"/> <rect x="3.6" y="2.6" width="16.8" height="2.8" rx="0.6" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/> <g fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"> <rect x="6.2" y="7" width="2.7" height="2.6" rx="0.4"/><rect x="10.65" y="7" width="2.7" height="2.6" rx="0.4"/> <rect x="15.1" y="7" width="2.7" height="2.6" rx="0.4"/> <rect x="6.2" y="11.2" width="2.7" height="2.6" rx="0.4"/><rect x="15.1" y="11.2" width="2.7" height="2.6" rx="0.4"/> <rect x="6.2" y="15.4" width="2.7" height="2.6" rx="0.4"/><rect x="15.1" y="15.4" width="2.7" height="2.6" rx="0.4"/> </g> <rect x="10.65" y="11.2" width="2.7" height="2.6" rx="0.4" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <rect x="7.2" y="17.8" width="9.6" height="1.4" rx="0.7" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/> <rect x="10.1" y="19.2" width="3.8" height="2.4" rx="0.4" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/>'],
    'hot-pool': ['0 0 24 24', '<ellipse cx="12" cy="17" rx="10.4" ry="5.4" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><ellipse cx="12" cy="17" rx="10.4" ry="5.4" fill="url(#gm-gloss)"/><ellipse cx="12" cy="17.2" rx="7.8" ry="3.6" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/><ellipse cx="11.5" cy="16.5" rx="4.6" ry="1.8" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><g fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"><circle cx="4.6" cy="13.6" r="1.6"/><circle cx="19.4" cy="13.4" r="1.8"/></g><g fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"><circle cx="8" cy="12.6" r="1.2"/><circle cx="16" cy="12.5" r="1.3"/></g><g fill="none" stroke="var(--c-sky)" stroke-width="1.5" stroke-linecap="round"><path d="M8.4 2.2c1.3 1.3 1.3 2.6 0 3.9s-1.3 2.6 0 3.9"/><path d="M12 1.4c1.3 1.3 1.3 2.6 0 3.9s-1.3 2.6 0 3.9"/><path d="M15.6 2.2c1.3 1.3 1.3 2.6 0 3.9s-1.3 2.6 0 3.9"/></g>'],
    'hotspring': ['0 0 24 24', '<g stroke="var(--c-sky)" stroke-width="1.5" fill="none" stroke-linecap="round"> <path d="M8 3.2c1.4 1.4 1.4 2.8 0 4.2s-1.4 2.8 0 4.2"/><path d="M12 2.4c1.4 1.4 1.4 2.8 0 4.2s-1.4 2.8 0 4.2"/><path d="M16 3.2c1.4 1.4 1.4 2.8 0 4.2s-1.4 2.8 0 4.2"/></g> <path d="M2.4 14.6h19.2a9.6 9.6 0 0 1-19.2 0z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><path d="M2.4 14.6h19.2a9.6 9.6 0 0 1-19.2 0z" fill="url(#gm-gloss)"/> <path d="M4.4 14.6h15.2a7.6 7.6 0 0 1-15.2 0z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <path d="M6.2 17.6c1.4 0 1.4 1.2 2.9 1.2s1.4-1.2 2.9-1.2 1.4 1.2 2.9 1.2 1.4-1.2 2.9-1.2" fill="none" stroke="var(--c-sky)" stroke-width="1.2" stroke-linecap="round"/>'],
    'hourglass': ['0 0 24 24', '<path d="M7.1 4.6C6.3 9.6 9.4 11.0 12 12.6C14.6 11.0 17.7 9.6 16.9 4.6Z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="1.2" stroke-linejoin="round" opacity="0.20"/><path d="M7.1 21.0C6.3 16.0 9.4 14.6 12 12.6C14.6 14.6 17.7 16.0 16.9 21.0Z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="1.2" stroke-linejoin="round" opacity="0.20"/><path d="M8.77 7.32Q12 9.22 15.23 7.32C14.6 11.0 12 12.5 12 12.6C12 12.5 9.4 11.0 8.77 7.32Z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M8.77 7.32Q12 9.22 15.23 7.32C14.6 11.0 12 12.5 12 12.6C12 12.5 9.4 11.0 8.77 7.32Z" fill="url(#gm-gloss)"/><path d="M12 12.6v6.6" fill="none" stroke="var(--c-amber-rim)" stroke-width="1.7" stroke-linecap="round"/><path d="M9.12 20.60Q12 17.63 14.88 20.60Z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M7.1 4.6C6.3 9.6 9.4 11.0 12 12.6C14.6 11.0 17.7 9.6 16.9 4.6Z" fill="none" stroke="var(--c-sky-rim)" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.1 21.0C6.3 16.0 9.4 14.6 12 12.6C14.6 14.6 17.7 16.0 16.9 21.0Z" fill="none" stroke="var(--c-sky-rim)" stroke-width="1.6" stroke-linejoin="round"/><rect x="5.6" y="2.6" width="12.8" height="2" rx="1" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="1.2"/><rect x="5.6" y="20.8" width="12.8" height="2" rx="1" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="1.2"/>'],
    'insurance': ['0 0 24 24', '<path d="M12 2.6c5.3 0 9.6 4.3 9.6 9.6H2.4c0-5.3 4.3-9.6 9.6-9.6z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <path d="M12 2.6c1.9 0 3.4 4.3 3.4 9.6H8.6c0-5.3 1.5-9.6 3.4-9.6z" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/> <path d="M11.2 12.2h1.6v6.6a2.6 2.6 0 0 1-5.2 0v-.6h1.6v.6a1 1 0 0 0 2 0z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <circle cx="12" cy="1.8" r="1.1" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    'language': ['0 0 24 24', '<circle cx="8.4" cy="10.6" r="3.5" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><path d="M8.4 15.4c3.5 0 6.4 2.3 6.4 5.2v1.4H2v-1.4c0-2.9 2.9-5.2 6.4-5.2z" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/><g transform="translate(11.5 0.3) scale(0.53)"><path d="M12 3.4c5.5 0 9.8 3 9.8 6.9 0 3.9-4.3 6.9-9.8 6.9-1 0-2-.1-2.9-.3l-5.6 3.7 1.7-4.8C3 15 2.2 12.9 2.2 10.3c0-3.9 4.3-6.9 9.8-6.9z" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="1.1" stroke-linejoin="round"/><path d="M12 3.4c5.5 0 9.8 3 9.8 6.9 0 3.9-4.3 6.9-9.8 6.9-1 0-2-.1-2.9-.3l-5.6 3.7 1.7-4.8C3 15 2.2 12.9 2.2 10.3c0-3.9 4.3-6.9 9.8-6.9z" fill="url(#gm-gloss)" stroke-linejoin="round"/><g fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.9"><circle cx="7.4" cy="10.2" r="1.9"/><circle cx="12" cy="10.2" r="1.9"/><circle cx="16.6" cy="10.2" r="1.9"/></g></g>'],
    'folded-map': ['0 0 24 24', '<path d="M1.6 5 8.4 2.6v16.8L1.6 21.8z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/><path d="M8.4 2.6 15.6 5v16.8l-7.2-2.4z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><path d="M15.6 5 22.4 2.6v16.8l-6.8 2.4z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/>'],
    'map': ['0 0 24 24', '<path d="M2 5.2 8.6 3v16L2 21.2z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><path d="M2 5.2 8.6 3v16L2 21.2z" fill="url(#gm-gloss)"/> <path d="M8.6 3 15.4 5.2v16L8.6 19z" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="1" stroke-linejoin="round" /> <path d="M15.4 5.2 22 3v16l-6.6 2.2z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/> <path d="M4.6 17.4c2-3 3.6-2 5.2-4.6 1.6-2.6 4-2 6-4.8" fill="none" stroke="var(--c-rust)" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="2.4 1.9"/> <path d="M17.4 5.6a2.3 2.3 0 0 0-2.3 2.3c0 1.7 2.3 4.3 2.3 4.3s2.3-2.6 2.3-4.3a2.3 2.3 0 0 0-2.3-2.3z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> <circle cx="17.4" cy="7.9" r="0.9" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/>'],
    'money': ['0 0 24 24', '<rect x="1.4" y="5.6" width="17" height="10" rx="1.7" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><rect x="1.4" y="5.6" width="17" height="10" rx="1.7" fill="url(#gm-gloss)"/> <rect x="3.2" y="7.4" width="13.4" height="6.4" rx="0.9" fill="none" stroke="var(--c-cream)" stroke-width="0.9" opacity="0.75"/> <circle cx="9.9" cy="10.6" r="2.4" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <circle cx="17.4" cy="16.6" r="5.4" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <circle cx="17.4" cy="16.6" r="3.8" fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5"/> <g stroke="var(--c-cream)" stroke-width="1.1" stroke-linecap="round"> <path d="M17.4 13.8v5.6M16 15.3h2.8M16 17.9h2.8"/> </g>'],
    /* Site-Icons #1350 (twin peaks) — owner pick 2026-08-14. */
    'mountain': ['0 0 24 24', '<path d="M0.8 20.8 8.4 8.2 14.6 20.8z" fill="url(#gm-pine)" stroke="var(--c-pine-rim)" stroke-width="0.5"/><path d="M9.4 20.8 16.6 6 23.2 20.8z" fill="url(#gm-slate)" stroke="var(--c-slate-rim)" stroke-width="0.5"/><path d="M16.6 6 19.6 12.7c-1.1.6-2 .2-2.9-.3-.9-.5-1.8-.4-2.7.2L13.6 12.7z" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/><path d="M16.6 6 19.6 12.7c-1.1.6-2 .2-2.9-.3-.9-.5-1.8-.4-2.7.2L13.6 12.7z" fill="url(#gm-gloss)"/><rect x="0.6" y="20.6" width="22.8" height="1.6" rx="0.8" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/>'],
    'bunting': ['0 0 24 24', '<path d="M1.4 6.4Q12 12.6 22.6 6.4" fill="none" stroke="var(--c-cocoa)" stroke-width="1.2" stroke-linecap="round"/> <path d="M2.4 7h3.6L4.2 12.2z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><path d="M2.4 7h3.6L4.2 12.2z" fill="url(#gm-gloss)"/> <path d="M6.4 8.4h3.6L8.2 13.6z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <path d="M10.4 9.2h3.6L12.2 14.4z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <path d="M14.4 8.7h3.6L16.2 13.9z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/> <path d="M18.2 7.4h3.6L20 12.6z" fill="url(#gm-plum)" stroke="var(--c-plum-rim)" stroke-width="0.5"/> <circle cx="5" cy="17.6" r="1.2" fill="url(#gm-rose)" stroke="var(--c-rose-rim)" stroke-width="0.5"/> <circle cx="12" cy="19.4" r="1.4" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <circle cx="18.8" cy="17.2" r="1.2" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/>'],
    'projector': ['0 0 24 24', '<rect x="2.4" y="8.4" width="13.6" height="8.4" rx="1.6" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><rect x="2.4" y="8.4" width="13.6" height="8.4" rx="1.6" fill="url(#gm-gloss)"/><circle cx="8.2" cy="6.4" r="3.2" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><circle cx="16.2" cy="6.4" r="2.4" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><circle cx="8.2" cy="6.4" r="1" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/><circle cx="16.2" cy="6.4" r="0.8" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/><path d="M16 10.6 22.4 8v9.2L16 14.6z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5" opacity="0.75"/><rect x="4.4" y="10.6" width="3.4" height="1.6" rx="0.5" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><rect x="3.4" y="17" width="11.6" height="1.9" rx="0.9" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/>'],
    'museum-amber': ['0 0 24 24', '<path d="M4 21v-2h16v2H4zm1-3V9.5h2V18H5zm4 0V9.5h2V18H9zm4 0V9.5h2V18h-2zm4 0V9.5h2V18h-2zM12 2l9 5v1.5H3V7l9-5z" fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5"/><path d="M4 21v-2h16v2H4zm1-3V9.5h2V18H5zm4 0V9.5h2V18H9zm4 0V9.5h2V18h-2zm4 0V9.5h2V18h-2zM12 2l9 5v1.5H3V7l9-5z" fill="url(#gm-gloss)"/>'],
    'museumstar': ['0 0 24 24', '<rect x="2.4" y="8.6" width="19.2" height="12.8" rx="1.2" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><rect x="2.4" y="8.6" width="19.2" height="12.8" rx="1.2" fill="url(#gm-gloss)"/><path d="M1.4 8.6 12 3.4l10.6 5.2z" fill="url(#gm-slate)" stroke="var(--c-slate-rim)" stroke-width="0.5"/><rect x="4.4" y="11" width="4" height="4.4" rx="0.5" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><rect x="16" y="11" width="4" height="4.4" rx="0.5" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><rect x="9.6" y="12.6" width="4.8" height="8.8" rx="0.6" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><rect x="3.4" y="17.4" width="5.4" height="1.6" rx="0.7" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><rect x="15.4" y="17.4" width="5.4" height="1.6" rx="0.7" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><rect x="1" y="21" width="22" height="1.6" rx="0.8" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/>'],
    'paddle': ['0 0 24 24', '<g transform="rotate(-15 9 11)"> <rect x="3.2" y="1.4" width="11.6" height="13.8" rx="2.8" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><rect x="3.2" y="1.4" width="11.6" height="13.8" rx="2.8" fill="url(#gm-gloss)"/> <rect x="4.8" y="2.9" width="8.4" height="10.8" rx="2" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6" opacity="0.5"/> <rect x="7.6" y="15" width="2.8" height="2.6" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/> <rect x="6.9" y="17.2" width="4.2" height="5.6" rx="1.7" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/> <g stroke="var(--c-cocoa)" stroke-width="0.7" opacity="0.45"> <path d="M7 18.7h4M7 20.1h4M7 21.5h4"/> </g> </g> <circle cx="19.1" cy="18.3" r="4.1" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <g fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5"> <circle cx="17.6" cy="16.9" r="0.8"/><circle cx="20.4" cy="17.2" r="0.8"/> <circle cx="18.1" cy="19.8" r="0.8"/><circle cx="20.7" cy="19.9" r="0.8"/> </g>'],
    'pickleball-clear': ['0 0 24 24', '<g transform="rotate(-22 11 10)"><ellipse cx="11" cy="8.6" rx="6.6" ry="7.4" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/><ellipse cx="11" cy="8.6" rx="6.6" ry="7.4" fill="url(#gm-gloss)"/><ellipse cx="11" cy="8.6" rx="4.8" ry="5.6" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><rect x="9.8" y="15.4" width="2.4" height="2.4" rx="0.3" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><rect x="9.1" y="17.4" width="3.8" height="5.6" rx="1.6" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/></g><circle cx="19" cy="17.6" r="3.6" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><g fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.4"><circle cx="17.6" cy="16.2" r="0.7"/><circle cx="20.4" cy="16.4" r="0.7"/><circle cx="17.8" cy="19" r="0.7"/><circle cx="20.6" cy="19.2" r="0.7"/><circle cx="19.1" cy="17.7" r="0.7"/></g>'],
    'giraffe': ['0 0 24 24', '<rect x="4.6" y="11.8" width="9.6" height="5.8" rx="2.4" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><rect x="4.6" y="11.8" width="9.6" height="5.8" rx="2.4" fill="url(#gm-gloss)"/> <g fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"><rect x="5.6" y="17.2" width="1.9" height="4.8" rx="0.9"/><rect x="8.6" y="17.2" width="1.9" height="4.8" rx="0.9"/><rect x="11.4" y="17.2" width="1.9" height="4.8" rx="0.9"/></g> <path d="M12.4 13.2 14.4 4.8h3L15.4 13.2z" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/> <path d="M14.4 2.6h4.4a1.9 1.9 0 0 1 0 3.8h-3.8z" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/> <g stroke="var(--c-cocoa)" stroke-width="1" stroke-linecap="round"><path d="M15.4 2.6V1.2M17.4 2.6V1.2"/></g> <g fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"><circle cx="15.4" cy="1" r="0.8"/><circle cx="17.4" cy="1" r="0.8"/><circle cx="16.4" cy="4.4" r="0.7"/> <circle cx="7.2" cy="13.6" r="1.1"/><circle cx="10.6" cy="14.4" r="1.1"/><circle cx="12.6" cy="12.8" r="0.9"/><circle cx="8.4" cy="16" r="0.9"/> <circle cx="14.6" cy="7.6" r="0.85"/><circle cx="13.8" cy="10.6" r="0.85"/></g>'],
    'paw': ['0 0 24 24', '<g fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"><ellipse cx="6.2" cy="10.4" rx="2.4" ry="3"/><ellipse cx="17.8" cy="10.4" rx="2.4" ry="3"/><ellipse cx="9.6" cy="5.8" rx="2.3" ry="2.9"/><ellipse cx="14.4" cy="5.8" rx="2.3" ry="2.9"/></g> <path d="M12 11.4c3.4 0 6.2 2.6 6.2 5.6 0 2.4-2 4-4.4 4-.8 0-1.4-.3-1.8-.3s-1 .3-1.8.3c-2.4 0-4.4-1.6-4.4-4 0-3 2.8-5.6 6.2-5.6z" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><path d="M12 11.4c3.4 0 6.2 2.6 6.2 5.6 0 2.4-2 4-4.4 4-.8 0-1.4-.3-1.8-.3s-1 .3-1.8.3c-2.4 0-4.4-1.6-4.4-4 0-3 2.8-5.6 6.2-5.6z" fill="url(#gm-gloss)"/>'],
    'pennant': ['0 0 24 24', '<rect x="4.2" y="2" width="2.1" height="20" rx="1" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><rect x="4.2" y="2" width="2.1" height="20" rx="1" fill="url(#gm-gloss)"/> <path d="M7 3.2 20.8 8.1 7 13z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> <path d="M7 6.6 15.4 9.6 7 12.6z" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6" opacity="0.55"/>'],
    'people': ['0 0 24 24', '<circle cx="17.2" cy="8.4" r="2.7" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/> <path d="M17.2 12.4c2.6 0 4.6 1.9 4.6 4.3V19h-8.2v-2.3c0-2.4 1-4.3 3.6-4.3z" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/> <circle cx="8.8" cy="7.6" r="3.4" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/> <path d="M8.8 12.4c3.6 0 6.5 2.1 6.5 4.8V19H2.3v-1.8c0-2.7 2.9-4.8 6.5-4.8z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <path d="M8.8 12.4c1 0 1.9.2 2.8.5l-1.4 2.9-1.4-2.9z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/>'],
    'pin': ['0 0 24 24', '<ellipse cx="12" cy="21.4" rx="4" ry="1.3" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5" opacity="0.45"/> <path d="M12 1.6a7.4 7.4 0 0 0-7.4 7.4c0 5.5 7.4 13.4 7.4 13.4s7.4-8 7.4-13.4A7.4 7.4 0 0 0 12 1.6z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><path d="M12 1.6a7.4 7.4 0 0 0-7.4 7.4c0 5.5 7.4 13.4 7.4 13.4s7.4-8 7.4-13.4A7.4 7.4 0 0 0 12 1.6z" fill="url(#gm-gloss)"/> <path d="M12 1.6a7.4 7.4 0 0 0-7.4 7.4c0 5.5 7.4 13.4 7.4 13.4z" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5" opacity="0.55"/> <circle cx="12" cy="9" r="2.9" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/> <circle cx="12" cy="9" r="1.3" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/>'],
    'blocks': ['0 0 24 24', '<rect x="2.4" y="11" width="8.4" height="10.6" rx="1" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/><rect x="2.4" y="11" width="8.4" height="10.6" rx="1" fill="url(#gm-gloss)"/><rect x="13.2" y="6.4" width="8.4" height="15.2" rx="1" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/><rect x="7" y="2.4" width="8.4" height="6.4" rx="1" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    'books': ['0 0 24 24', '<rect x="2.6" y="4" width="4.4" height="16.4" rx="0.8" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><rect x="7.6" y="6" width="4.2" height="14.4" rx="0.8" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/><rect x="12.4" y="3.2" width="4.4" height="17.2" rx="0.8" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><rect x="17.4" y="7" width="4" height="13.4" rx="0.8" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/><rect x="1.6" y="20.4" width="20.8" height="1.8" rx="0.9" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/>'],
    'budget': ['0 0 24 24', '<path d="M2.6 12.4c0-3.6 3.6-6.4 8.4-6.4 1.6 0 3.1.3 4.4.9l2.6-2.1v3.8c1 .9 1.8 2 2.2 3.2h1.8v4h-2.3c-.5.9-1.2 1.7-2.1 2.4v2.4h-3.4v-1.2c-.9.2-1.9.3-2.9.3s-2-.1-2.9-.3v1.2H4.6v-2.6C3.4 16.8 2.6 14.7 2.6 12.4z" fill="url(#gm-rose)" stroke="var(--c-rose-rim)" stroke-width="0.5"/><path d="M2.6 12.4c0-3.6 3.6-6.4 8.4-6.4 1.6 0 3.1.3 4.4.9l2.6-2.1v3.8c1 .9 1.8 2 2.2 3.2h1.8v4h-2.3c-.5.9-1.2 1.7-2.1 2.4v2.4h-3.4v-1.2c-.9.2-1.9.3-2.9.3s-2-.1-2.9-.3v1.2H4.6v-2.6C3.4 16.8 2.6 14.7 2.6 12.4z" fill="url(#gm-gloss)"/><path d="M15.4 6.9 18 4.8V8c-.8-.5-1.7-.9-2.6-1.1z" fill="url(#gm-rose)" stroke="var(--c-rose-rim)" stroke-width="0.5"/><circle cx="6.6" cy="11.6" r="0.6" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/><rect x="9.4" y="4.2" width="5.2" height="1.6" rx="0.8" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M2.6 12.4c-.9-.4-1.4-1.2-1.4-2.2 1 0 1.8.4 2.3 1.1z" fill="url(#gm-rose)" stroke="var(--c-rose-rim)" stroke-width="0.5"/>'],
    'mosque': ['0 0 24 24', '<rect x="2.4" y="8.6" width="2.6" height="13" rx="0.6" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><rect x="2.4" y="8.6" width="2.6" height="13" rx="0.6" fill="url(#gm-gloss)"/> <path d="M3.7 5.6 5.4 8.6H2z" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/> <rect x="19" y="8.6" width="2.6" height="13" rx="0.6" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <path d="M20.3 5.6 22 8.6h-3.4z" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/> <rect x="6.4" y="12.6" width="11.2" height="9" fill="url(#gm-cream)" stroke="var(--c-rim-cool)" stroke-width="1" stroke-linejoin="round" /> <path d="M12 4.4c3.1 0 5.6 3 5.6 6.6 0 0.8-.1 1.5-.3 2.2H6.7a7.6 7.6 0 0 1-.3-2.2C6.4 7.4 8.9 4.4 12 4.4z" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/> <rect x="11.4" y="2" width="1.2" height="2.6" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <path d="M10 21.6v-4.2a2 2 0 0 1 4 0v4.2z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/> <rect x="1.4" y="21.4" width="21.2" height="1.6" rx="0.8" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/>'],
    'colosseum': ['0 0 24 24', '<path d="M2.6 8.6h18.8v11.6H2.6z" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="1" stroke-linejoin="round" /><path d="M2.6 8.6h18.8v11.6H2.6z" fill="url(#gm-gloss)"/> <path d="M2.6 8.6a9.4 3.4 0 0 1 18.8 0z" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/> <g fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"> <path d="M4.6 12.4a1.5 1.5 0 0 1 3 0v2.4h-3zM9 11.9a1.5 1.5 0 0 1 3 0v2.9H9zM13.4 11.9a1.5 1.5 0 0 1 3 0v2.9h-3zM17.8 12.4a1.5 1.5 0 0 1 3 0v2.4h-3z"/> <path d="M4.6 17a1.3 1.3 0 0 1 2.6 0v2.2H4.6zM9.2 16.7a1.3 1.3 0 0 1 2.6 0v2.5H9.2zM13.6 16.7a1.3 1.3 0 0 1 2.6 0v2.5h-2.6zM18.2 17a1.3 1.3 0 0 1 2.6 0v2.2h-2.6z"/> </g> <path d="M17.4 6.4 21.4 8.6v11.6h-4z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5" opacity="0.35"/> <rect x="1.6" y="20" width="20.8" height="1.8" rx="0.9" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/>'],
    'building': ['0 0 24 24', '<rect x="3.4" y="3" width="17.2" height="18.4" rx="1.4" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6" stroke="var(--c-rim-warm)" stroke-width="1" stroke-linejoin="round"/><rect x="3.4" y="3" width="17.2" height="18.4" rx="1.4" fill="url(#gm-gloss)"/><rect x="3" y="3" width="18" height="2.8" rx="0.8" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/><g fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"><rect x="6" y="7.6" width="2.8" height="2.8" rx="0.5"/><rect x="10.6" y="7.6" width="2.8" height="2.8" rx="0.5"/><rect x="15.2" y="7.6" width="2.8" height="2.8" rx="0.5"/><rect x="6" y="12.4" width="2.8" height="2.8" rx="0.5"/><rect x="15.2" y="12.4" width="2.8" height="2.8" rx="0.5"/></g><rect x="10.6" y="12.4" width="2.8" height="2.8" rx="0.5" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><rect x="9.6" y="17" width="4.8" height="4.4" rx="0.5" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/>'],
    'bulb': ['0 0 24 24', '<g stroke="var(--c-amber)" stroke-width="1.7" stroke-linecap="round"><path d="M12 1.2v1.8M4 5.6 5.4 6.8M20 5.6 18.6 6.8"/></g><path d="M12 3.6a6.6 6.6 0 0 0-3.8 12c.5.4.8 1 .8 1.6v.6h6v-.6c0-.6.3-1.2.8-1.6A6.6 6.6 0 0 0 12 3.6z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M9 18.6h6v1.2a1.4 1.4 0 0 1-1.4 1.4h-3.2A1.4 1.4 0 0 1 9 19.8z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/>'],
    'castle': ['0 0 24 24', '<path d="M4.4 9.8 7 4.6l2.6 5.2z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/><path d="M4.4 9.8 7 4.6l2.6 5.2z" fill="url(#gm-gloss)"/><path d="M14.4 9.8 17 4.6l2.6 5.2z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/><path d="M8.4 7.6 12 1.4l3.6 6.2z" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><rect x="4.7" y="9.8" width="4.6" height="12" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6" stroke="var(--c-rim-warm)" stroke-width="0.9"/><rect x="14.7" y="9.8" width="4.6" height="12" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6" stroke="var(--c-rim-warm)" stroke-width="0.9"/><rect x="8.6" y="7.6" width="6.8" height="14.2" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6" stroke="var(--c-rim-warm)" stroke-width="0.9"/><path d="M9.9 21.8v-4.2a2.1 2.1 0 0 1 4.2 0v4.2z" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/>'],
    'category': ['0 0 24 24', '<rect x="2.4" y="2.4" width="8.6" height="8.6" rx="1.6" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/><rect x="13" y="2.4" width="8.6" height="8.6" rx="1.6" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><rect x="2.4" y="13" width="8.6" height="8.6" rx="1.6" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/><rect x="13" y="13" width="8.6" height="8.6" rx="1.6" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/>'],
    /* Guide-Icons.html specimen #50, "Cal · the date" — owner pick 2026-08-13 for
       Day Trips by Train. A SEPARATE key from 'calendar' on purpose: that one is
       the grid calendar and is also the Export-to-Calendar button's mark, so
       restyling it in place would have silently changed a second surface. */
    'calendar-date': ['0 0 24 24', '<rect x="2.6" y="4" width="18.8" height="17.2" rx="2.4" fill="url(#gm-paper)" stroke="var(--c-rim-warm)" stroke-width="1" stroke-linejoin="round" /> <path d="M2.6 6.4A2.4 2.4 0 0 1 5 4h14a2.4 2.4 0 0 1 2.4 2.4v2.4H2.6z" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/> <rect x="6.3" y="1.9" width="2.2" height="4" rx="1.1" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/> <rect x="15.5" y="1.9" width="2.2" height="4" rx="1.1" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/> <g fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5" opacity="0.45"> <rect x="5.4" y="11" width="3.1" height="2.7" rx="0.7"/><rect x="10.45" y="11" width="3.1" height="2.7" rx="0.7"/> <rect x="15.5" y="11" width="3.1" height="2.7" rx="0.7"/><rect x="5.4" y="15.4" width="3.1" height="2.7" rx="0.7"/> <rect x="15.5" y="15.4" width="3.1" height="2.7" rx="0.7"/> </g> <rect x="10.45" y="15.4" width="3.1" height="2.7" rx="0.7" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    'cave': ['0 0 24 24', '<path d="M1.8 22c.2-8.4 3.4-14.6 9.4-15.4 6.6-.9 11 5.6 11 15.4z" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><path d="M1.8 22c.2-8.4 3.4-14.6 9.4-15.4 6.6-.9 11 5.6 11 15.4z" fill="url(#gm-gloss)"/><path d="M7.3 22v-4.4l1.2 2.1.9-3.1 1.1 2.6 1-3.4 1.1 2.9 1-2.4 1.2 2.7.9-1.9V22z" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/>'],
    'check': ['0 0 24 24', '<circle cx="12" cy="12" r="10.6" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><path d="M6.8 12.4 10.4 16l6.8-8" fill="none" stroke="var(--c-paper)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'],
    'close': ['0 0 24 24', '<circle cx="12" cy="12" r="10.6" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><path d="M8.2 8.2 15.8 15.8M15.8 8.2 8.2 15.8" stroke="var(--c-paper)" stroke-width="2.6" stroke-linecap="round"/>'],
    'compare': ['0 0 24 24', '<rect x="3.2" y="12.6" width="4.6" height="8" rx="1.1" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <rect x="9.7" y="8.4" width="4.6" height="12.2" rx="1.1" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <rect x="16.2" y="4.4" width="4.6" height="16.2" rx="1.1" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/> <path d="M2 22h20" stroke="var(--c-stone)" stroke-width="1.5" stroke-linecap="round"/>'],
    'compass-classic': ['0 0 24 24', '<circle cx="12" cy="12" r="10.4" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><circle cx="12" cy="12" r="10.4" fill="url(#gm-gloss)"/><circle cx="12" cy="12" r="8.4" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/><circle cx="12" cy="12" r="7.2" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><path d="M12 4.6 13.5 12 12 13.4 10.5 12z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><path d="M12 19.4 10.5 12 12 10.6 13.5 12z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><circle cx="12" cy="12" r="1.1" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><g fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.3"><circle cx="12" cy="5.6" r="0.55"/><circle cx="18.4" cy="12" r="0.55"/><circle cx="12" cy="18.4" r="0.55"/><circle cx="5.6" cy="12" r="0.55"/></g>'],
    'compass': ['0 0 24 24', '<circle cx="12" cy="12" r="10.6" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><circle cx="12" cy="12" r="10.6" fill="url(#gm-gloss)"/> <circle cx="12" cy="12" r="8.2" fill="url(#gm-cream)" stroke="var(--c-rim-cool)" stroke-width="1" stroke-linejoin="round" /> <path d="M12 3.4 15.6 12 12 12.6z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> <path d="M12 3.4 8.4 12 12 12.6z" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/> <path d="M12 20.6 8.4 12 12 11.4z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <path d="M12 20.6 15.6 12 12 11.4z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5" opacity="0.75"/> <circle cx="12" cy="12" r="1.5" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/>'],
    'flower': ['0 0 24 24', '<g fill="url(#gm-rose)" stroke="var(--c-rose-rim)" stroke-width="0.5"><ellipse cx="12" cy="5.6" rx="3" ry="4"/><ellipse cx="12" cy="14.4" rx="3" ry="4"/><ellipse cx="7.6" cy="10" rx="4" ry="3"/><ellipse cx="16.4" cy="10" rx="4" ry="3"/></g><circle cx="12" cy="10" r="2.6" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><circle cx="12" cy="10" r="2.6" fill="url(#gm-gloss)"/><path d="M12 14v8" stroke="var(--c-leaf)" stroke-width="1.8" stroke-linecap="round"/><path d="M12 18c2.4 0 3.6-1.4 3.6-3.2-2.2 0-3.6 1.2-3.6 3.2z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/>'],
    'island': ['0 0 24 24', '<ellipse cx="12" cy="20" rx="10.4" ry="2.6" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><ellipse cx="12" cy="20" rx="10.4" ry="2.6" fill="url(#gm-gloss)"/><path d="M4.6 19c0-2.6 3.3-4.6 7.4-4.6s7.4 2 7.4 4.6z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><rect x="11.2" y="6.6" width="1.7" height="9" rx="0.8" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M12 3.2c2.8 0 5 1.6 5.6 3.8-1.8-1.2-3.6-1.4-5.6-.6zM12 3.2c-2.8 0-5 1.6-5.6 3.8 1.8-1.2 3.6-1.4 5.6-.6zM12 3.2c1.6 1.6 2.2 3.4 2 5.6-1-1.8-2.2-2.8-4-3.2z" fill="url(#gm-leaf)" stroke="var(--c-leaf-rim)" stroke-width="0.5"/><path d="M12 3.2c2.8 0 5 1.6 5.6 3.8-1.8-1.2-3.6-1.4-5.6-.6zM12 3.2c-2.8 0-5 1.6-5.6 3.8 1.8-1.2 3.6-1.4 5.6-.6zM12 3.2c1.6 1.6 2.2 3.4 2 5.6-1-1.8-2.2-2.8-4-3.2z" fill="url(#gm-sheen)"/><circle cx="12" cy="3.2" r="1.2" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/>'],
    'laptop': ['0 0 24 24', '<rect x="3" y="4" width="18" height="12" rx="1.8" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><rect x="4.6" y="5.6" width="14.8" height="8.8" rx="1" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><rect x="1" y="17" width="22" height="2.6" rx="1.3" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/><rect x="9.6" y="17.6" width="4.8" height="1.4" rx="0.7" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/>'],
    'neighborhoods': ['0 0 24 24', '<rect x="1.6" y="9.4" width="6.6" height="12.2" rx="0.8" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><rect x="8.8" y="4.6" width="6.4" height="17" rx="0.8" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/><rect x="15.8" y="11.8" width="6.6" height="9.8" rx="0.8" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/><g fill="url(#gm-cream)" opacity="0.85" stroke="var(--c-rim-cool)" stroke-width="1" stroke-linejoin="round"><rect x="3" y="11.4" width="1.7" height="1.9"/><rect x="5.5" y="11.4" width="1.7" height="1.9"/><rect x="3" y="14.8" width="1.7" height="1.9"/><rect x="5.5" y="14.8" width="1.7" height="1.9"/><rect x="10.1" y="6.8" width="1.8" height="2"/><rect x="12.5" y="6.8" width="1.8" height="2"/><rect x="10.1" y="10.4" width="1.8" height="2"/><rect x="12.5" y="10.4" width="1.8" height="2"/><rect x="10.1" y="14" width="1.8" height="2"/><rect x="17.2" y="13.8" width="1.7" height="1.9"/><rect x="19.6" y="13.8" width="1.7" height="1.9"/><rect x="17.2" y="17" width="1.7" height="1.9"/></g><rect x="12.5" y="14" width="1.8" height="2" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><rect x="19.6" y="17" width="1.7" height="1.9" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><rect x="1" y="21.4" width="22" height="1.6" rx="0.8" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/>'],
    'orbited-globe': ['0 0 24 24', '<path d="M3.4 15.6a9.4 9.4 0 0 0 15.8 2.8" fill="none" stroke="var(--c-stone)" stroke-width="1.7" stroke-linecap="round"/><path d="M2 12.6 6.2 15 2.2 17.6z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><path d="M2 12.6 6.2 15 2.2 17.6z" fill="url(#gm-gloss)"/><path d="M20.6 8.6A9.4 9.4 0 0 0 4.8 5.8" fill="none" stroke="var(--c-stone)" stroke-width="1.7" stroke-linecap="round"/><path d="M22 11.4 17.8 9l4-2.6z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><circle cx="12" cy="12" r="7.4" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><path d="M6.2 8.6c1.5-.5 2.4.4 3.6.2 1.1-.2 1.4-1.5 2.7-1.4 1.3.1 1.5 1.4 2.6 1.6 1 .2 1.8-.5 2.7-.1-.6 1.4-1.9 1.5-2.8 2.3-.9.8-.5 2-1.7 2.3-1.2.3-1.6-.8-2.6-.6-1 .2-1.2 1.4-2.4 1.2-1.2-.2-1.3-1.6-2.2-2.4-.8-.8-1.3-2-.9-3.1z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><path d="M9.6 16.6c1.2-.4 2.2.2 3 1 .8.8 1.5 1.7 1 2.6-1.6.2-3-.5-4-1.5-.6-.6-.6-1.7 0-2.1z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/>'],
    'packing': ['0 0 24 24', '<rect x="4.2" y="2.8" width="15.6" height="18.4" rx="2" fill="url(#gm-paper)" stroke="var(--c-navy-rim)" stroke-width="1.1"/><rect x="4.2" y="2.8" width="15.6" height="18.4" rx="2" fill="url(#gm-gloss)"/><rect x="8.6" y="1.2" width="6.8" height="3.4" rx="1.2" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><g stroke="var(--c-green-rim)" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M6.8 9.2l1.5 1.5 2.6-2.9"/><path d="M6.8 14l1.5 1.5 2.6-2.9"/><path d="M6.8 18.6l1.5 1.5 2.6-2.9"/></g><g fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.4"><rect x="12.6" y="8.6" width="4.8" height="1.5" rx="0.75"/><rect x="12.6" y="13.4" width="4.8" height="1.5" rx="0.75"/><rect x="12.6" y="18" width="4.8" height="1.5" rx="0.75"/></g>'],
    'palm': ['0 0 24 24', '<path d="M11.4 9.6h1.8l.8 12.4h-3.4z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M11.4 9.6h1.8l.8 12.4h-3.4z" fill="url(#gm-gloss)"/><path d="M12.4 9.4c-2.8-2.6-5.8-2.8-8-.8 2.6-.7 5 0 6.9 1.7zM11.6 9.4c2.8-2.6 5.8-2.8 8-.8-2.6-.7-5 0-6.9 1.7zM12 8.6c-.9-3.2-2.8-5-5.2-5 2 1.3 3.3 3 3.9 5.4z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><path d="M12 8.6c.9-3.2 2.8-5 5.2-5-2 1.3-3.3 3-3.9 5.4z" fill="url(#gm-leaf)" stroke="var(--c-leaf-rim)" stroke-width="0.5"/><circle cx="12" cy="8.8" r="1.5" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    'printer': ['0 0 24 24', '<rect x="6.4" y="2.4" width="11.2" height="5" rx="0.6" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><rect x="2.4" y="7.4" width="19.2" height="9.2" rx="2" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><rect x="4.4" y="9.6" width="3.4" height="1.8" rx="0.9" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><circle cx="18.6" cy="10.4" r="1.2" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><rect x="6.4" y="14.4" width="11.2" height="7.2" rx="0.6" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/><g stroke="var(--c-stone)" stroke-width="1" stroke-linecap="round" opacity="0.6"><path d="M8.4 16.8h7.2M8.4 19h4.6"/></g>'],
    'pyramid': ['0 0 24 24', '<circle cx="18.4" cy="5.6" r="2.8" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><circle cx="18.4" cy="5.6" r="2.8" fill="url(#gm-gloss)"/><path d="M8.4 6.6 17.6 19.6H-0.8z" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><path d="M8.4 6.6V19.6H-0.8z" fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5" opacity="0.35"/><path d="M17.2 11.4 23.6 19.6h-12.8z" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><path d="M17.2 11.4v8.2h-6.4z" fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5" opacity="0.35"/><rect x="0.6" y="19.4" width="22.8" height="2" rx="1" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6" stroke="var(--c-rim-warm)" stroke-width="0.8"/>'],
    'rental-cars': ['0 0 24 24', '<path d="M5.8 10.4 7.5 6.6c.3-.8 1-1.3 1.9-1.3h5.2c.9 0 1.6.5 1.9 1.3l1.7 3.8z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><path d="M5.8 10.4 7.5 6.6c.3-.8 1-1.3 1.9-1.3h5.2c.9 0 1.6.5 1.9 1.3l1.7 3.8z" fill="url(#gm-gloss)"/> <rect x="2.4" y="9.9" width="19.2" height="6.5" rx="2.4" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <rect x="2.7" y="11.4" width="3.1" height="1.9" rx="0.95" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <rect x="18.2" y="11.4" width="3.1" height="1.9" rx="0.95" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> <circle cx="6.8" cy="17.3" r="2.6" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/><circle cx="6.8" cy="17.3" r="1.1" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <circle cx="17.2" cy="17.3" r="2.6" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/><circle cx="17.2" cy="17.3" r="1.1" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/>'],
    'scams': ['0 0 24 24', '<path d="M8.4 1.6h7.2l5.6 5.6v7.2l-5.6 5.6H8.4L2.8 14.4V7.2z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> <g fill="url(#gm-paper)" stroke="var(--c-rim-warm)" stroke-width="1" stroke-linejoin="round"> <rect x="8" y="6.4" width="1.8" height="5.6" rx="0.9"/> <rect x="10.2" y="5.4" width="1.8" height="6.6" rx="0.9"/> <rect x="12.4" y="5.6" width="1.8" height="6.4" rx="0.9"/> <rect x="14.6" y="6.8" width="1.8" height="5.2" rx="0.9"/> <path d="M8 10.4h8.4v2.6a4.2 4.2 0 0 1-8.4 0z"/> <path d="M8.2 11.6 6.2 9.6 5 10.8l3.2 3.2z"/> </g>'],
    'search': ['0 0 13 13', '<circle cx="5.5" cy="5.5" r="4.5" fill="none" stroke="#cc4433" stroke-width="1.5"/><line x1="9.35" y1="9.35" x2="12" y2="12" stroke="#cc4433" stroke-width="1.5" stroke-linecap="round"/>'],
    'sim': ['0 0 24 24', '<path d="M6.4 2h8l5.2 5.2V20a2 2 0 0 1-2 2H6.4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><path d="M6.4 2h8l5.2 5.2V20a2 2 0 0 1-2 2H6.4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="url(#gm-gloss)"/><rect x="7.6" y="11" width="8.8" height="7.4" rx="1.2" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><g stroke="var(--c-amber)" stroke-width="0.9"><path d="M12 11v7.4M7.6 14.7h8.8"/></g>'],
    'surf': ['0 0 24 24', '<path d="M15.4 1.8c4 2.6 6 7.6 4.4 12.6-1.6 4.8-6 7.8-10.6 7.6 0-5 1-9.6 2.8-13 1.2-2.4 2.4-4.4 3.4-7.2z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M15.4 1.8c4 2.6 6 7.6 4.4 12.6-1.6 4.8-6 7.8-10.6 7.6 0-5 1-9.6 2.8-13 1.2-2.4 2.4-4.4 3.4-7.2z" fill="url(#gm-gloss)"/><path d="M15.4 1.8c-1 2.8-2.2 4.8-3.4 7.2-1.8 3.4-2.8 8-2.8 13-1.6 0-3-.4-4.2-1.2 1.6-8.8 5-15 10.4-19z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><path d="M1.6 19.6c1.7 0 1.7 1.5 3.4 1.5s1.7-1.5 3.4-1.5 1.7 1.5 3.4 1.5 1.7-1.5 3.4-1.5 1.7 1.5 3.4 1.5" fill="none" stroke="var(--c-blue)" stroke-width="1.6" stroke-linecap="round"/>'],
    'tours-tickets': ['0 5.5 24 13', '<path d="M3 7h18a1.6 1.6 0 0 1 1.6 1.6V10a2 2 0 0 0 0 4v1.4A1.6 1.6 0 0 1 21 17H3a1.6 1.6 0 0 1-1.6-1.6V14a2 2 0 0 0 0-4V8.6A1.6 1.6 0 0 1 3 7z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M3 7h18a1.6 1.6 0 0 1 1.6 1.6V10a2 2 0 0 0 0 4v1.4A1.6 1.6 0 0 1 21 17H3a1.6 1.6 0 0 1-1.6-1.6V14a2 2 0 0 0 0-4V8.6A1.6 1.6 0 0 1 3 7z" fill="url(#gm-gloss)"/> <path d="M15.6 7H21a1.6 1.6 0 0 1 1.6 1.6V10a2 2 0 0 0 0 4v1.4A1.6 1.6 0 0 1 21 17h-5.4z" fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5"/> <path d="M15.6 7.8v8.4" stroke="var(--c-cream)" stroke-width="1.1" stroke-dasharray="1.5 1.5"/> <rect x="3.6" y="9.9" width="8.4" height="1.5" rx="0.75" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5" opacity="0.5"/> <rect x="3.6" y="12.6" width="5.4" height="1.5" rx="0.75" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5" opacity="0.35"/>'],
    'tower': ['0 0 24 24', '<path d="M12 0.8 18.6 7.2H5.4z" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/><rect x="4.8" y="7" width="14.4" height="1.7" rx="0.4" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/><rect x="5.6" y="8.6" width="12.8" height="12.9" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6" stroke-linejoin="round"/><rect x="5.6" y="8.6" width="12.8" height="12.9" fill="url(#gm-gloss)" stroke-linejoin="round"/><circle cx="12" cy="12.9" r="4" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/><circle cx="12" cy="12.9" r="4" fill="none" stroke="var(--c-cocoa)" stroke-width="2"/><path d="M12 10.2v2.7l2.2 1.4" stroke="var(--c-cocoa)" stroke-width="1.3" stroke-linecap="round" fill="none"/><g fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"><rect x="7.4" y="17.6" width="2.5" height="3.3" rx="1.25"/><rect x="14.1" y="17.6" width="2.5" height="3.3" rx="1.25"/></g><rect x="4" y="21.3" width="16" height="1.8" rx="0.9" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/>'],
    'transit': ['0 0 24 24', '<path d="M6.2 3.4h11.6a2.6 2.6 0 0 1 2.6 2.6v10a2.6 2.6 0 0 1-2.6 2.6H6.2A2.6 2.6 0 0 1 3.6 16V6a2.6 2.6 0 0 1 2.6-2.6z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><path d="M6.2 3.4h11.6a2.6 2.6 0 0 1 2.6 2.6v10a2.6 2.6 0 0 1-2.6 2.6H6.2A2.6 2.6 0 0 1 3.6 16V6a2.6 2.6 0 0 1 2.6-2.6z" fill="url(#gm-gloss)"/><rect x="5.4" y="5.8" width="13.2" height="5.4" rx="0.9" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><rect x="11.4" y="5.8" width="1.2" height="5.4" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><rect x="3.6" y="12.6" width="16.8" height="1.6" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><rect x="5.2" y="15.4" width="3" height="1.8" rx="0.9" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><rect x="15.8" y="15.4" width="3" height="1.8" rx="0.9" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M5.6 19.6h12.8" stroke="var(--c-tire)" stroke-width="1.6" stroke-linecap="round"/>'],
    'travel-apps': ['0 0 24 24', '<rect x="4.6" y="1.2" width="14.8" height="21.6" rx="2.6" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><rect x="6" y="4.6" width="12" height="14.6" rx="0.8" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/><g><rect x="7.2" y="5.8" width="3.2" height="3.2" rx="0.9" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/><rect x="11.4" y="5.8" width="3.2" height="3.2" rx="0.9" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><rect x="15.6" y="5.8" width="1.2" height="3.2" rx="0.6" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><rect x="7.2" y="10" width="3.2" height="3.2" rx="0.9" fill="url(#gm-rose)" stroke="var(--c-rose-rim)" stroke-width="0.5"/><rect x="11.4" y="10" width="3.2" height="3.2" rx="0.9" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/><rect x="15.6" y="10" width="1.2" height="3.2" rx="0.6" fill="url(#gm-plum)" stroke="var(--c-plum-rim)" stroke-width="0.5"/><rect x="7.2" y="14.2" width="3.2" height="3.2" rx="0.9" fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5"/><rect x="11.4" y="14.2" width="3.2" height="3.2" rx="0.9" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/></g><circle cx="12" cy="21" r="1.1" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/>'],
    'pine-forest': ['0 0 24 24', '<ellipse cx="12" cy="20.8" rx="10.4" ry="1.7" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><path d="M7 4.4 11.4 11H2.6zM7 8 12 15.4H2z" fill="url(#gm-leaf)" stroke="var(--c-leaf-rim)" stroke-width="0.5"/><rect x="6.2" y="14.8" width="1.6" height="4.6" rx="0.5" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M16.8 7 20.4 12.4h-7.2zM16.8 10.2 21 16.4h-8.4z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><rect x="16.1" y="15.8" width="1.5" height="3.8" rx="0.5" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/>'],
    'tree': ['0 0 24 24', '<path d="M12 1.6 19 11h-4.2l4.6 7H4.6l4.6-7H5z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><path d="M12 1.6 19 11h-4.2l4.6 7H4.6l4.6-7H5z" fill="url(#gm-gloss)"/><path d="M12 1.6 19 11h-4.2l4.6 7H12z" fill="url(#gm-leaf)" stroke="var(--c-leaf-rim)" stroke-width="0.5"/><rect x="10.6" y="17.4" width="2.8" height="5" rx="0.6" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/>'],
    'triptype': ['0 0 24 24', '<path d="M10.4 2.6H4a1.4 1.4 0 0 0-1.4 1.4v6.4c0 .4.1.7.4 1l9.6 9.6c.5.5 1.4.5 2 0l6.4-6.4c.5-.6.5-1.5 0-2L11.4 3a1.4 1.4 0 0 0-1-.4z" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/><circle cx="6.6" cy="6.6" r="1.9" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/>'],
    'live-plug': ['0 0 24 24', '<rect x="7.6" y="1.8" width="2.2" height="5.4" rx="1.1" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><rect x="7.6" y="1.8" width="2.2" height="5.4" rx="1.1" fill="url(#gm-gloss)"/> <rect x="14.2" y="1.8" width="2.2" height="5.4" rx="1.1" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/> <path d="M5.8 7h12.4v3.2a6.2 6.2 0 0 1-12.4 0z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <rect x="10.9" y="16" width="2.2" height="5.8" rx="1.1" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/> <path d="M12.9 8.2 10.4 12.4h1.9l-1 3.2 3.4-4.4h-2z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    'list': ['1.5 1 21 21', '<rect x="4.2" y="2.6" width="15.6" height="18.4" rx="1.8" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/><rect x="4.2" y="2.6" width="15.6" height="18.4" rx="1.8" fill="url(#gm-gloss)"/><rect x="8.6" y="1" width="6.8" height="3.2" rx="1.1" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/><g stroke="var(--c-stone)" stroke-width="1.3" stroke-linecap="round"><path d="M10.6 8.6h6.4M10.6 12.6h6.4M10.6 16.6h4.4"/></g><g fill="none" stroke="var(--c-green)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.4 8.4 7.6 9.6 9.6 7.4"/><path d="M6.4 12.4 7.6 13.6 9.6 11.4"/></g>'],
    'luggage': ['1 1 22 22', '<path d="M9 6V4.6h6V6h2V4.2A2.2 2.2 0 0 0 14.8 2H9.2A2.2 2.2 0 0 0 7 4.2V6z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M9 6V4.6h6V6h2V4.2A2.2 2.2 0 0 0 14.8 2H9.2A2.2 2.2 0 0 0 7 4.2V6z" fill="url(#gm-gloss)"/><rect x="2.6" y="6" width="18.8" height="14" rx="2.2" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/><rect x="2.6" y="10.4" width="18.8" height="2.6" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><rect x="9.4" y="14.6" width="1.8" height="2.6" rx="0.5" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><rect x="12.8" y="14.6" width="1.8" height="2.6" rx="0.5" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    'luggage-colour': ['0 0 24 24', '<path d="M8 6V4.8h5.6V6h1.8V4.6a2 2 0 0 0-2-2H8.2a2 2 0 0 0-2 2V6z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M8 6V4.8h5.6V6h1.8V4.6a2 2 0 0 0-2-2H8.2a2 2 0 0 0-2 2V6z" fill="url(#gm-gloss)"/> <rect x="1.8" y="6" width="16" height="13.2" rx="2.1" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/> <rect x="1.8" y="9.4" width="16" height="2.4" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <rect x="3.8" y="19.2" width="1.9" height="2.4" rx="0.85" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/> <rect x="13.9" y="19.2" width="1.9" height="2.4" rx="0.85" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/> <path d="M16.4 12.6 21.8 11v8.4l-5.4-1.6z" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <g stroke="var(--c-cocoa)" stroke-width="0.8"> <path d="M17.8 13.4v4.2M19 13v4.8M20.2 12.7v5.2M21 12.4v5.6"/> </g>'],
    'luggage-hardcase': ['0 0 24 24', '<rect x="6.6" y="3.4" width="10.8" height="1.9" rx="0.9" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><rect x="6.6" y="3.4" width="10.8" height="1.9" rx="0.9" fill="url(#gm-gloss)"/><rect x="10.2" y="2.2" width="3.6" height="1.6" rx="0.6" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><path d="M4.2 5.4h15.6a2.4 2.4 0 0 1 2.4 2.4v10.6a2.4 2.4 0 0 1-2.4 2.4H4.2a2.4 2.4 0 0 1-2.4-2.4V7.8a2.4 2.4 0 0 1 2.4-2.4z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><path d="M6.4 9 9.8 8.2l.7 3-3.4.8z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M13.4 12.6l3.4-.8.7 3-3.4.8z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><circle cx="12.4" cy="9.6" r="1.6" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><rect x="9.4" y="15" width="3.4" height="2.4" rx="0.5" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/><g fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.4"><circle cx="3.6" cy="7" r="0.7"/><circle cx="20.4" cy="7" r="0.7"/><circle cx="3.6" cy="18.8" r="0.7"/><circle cx="20.4" cy="18.8" r="0.7"/></g>'],
    'passport': ['0 0 24 24', '<rect x="4.2" y="2.4" width="15.4" height="19.2" rx="2" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><rect x="4.2" y="2.4" width="15.4" height="19.2" rx="2" fill="url(#gm-gloss)"/> <rect x="5.6" y="2.4" width="1.6" height="19.2" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <rect x="17.8" y="4.4" width="2.4" height="15.2" rx="1" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <circle cx="12.4" cy="9.6" r="3.4" fill="none" stroke="var(--c-sun)" stroke-width="1.3"/> <path d="M12.4 6.2v6.8M9 9.6h6.8" stroke="var(--c-sun)" stroke-width="0.9"/> <rect x="8.6" y="15.6" width="7.6" height="1.7" rx="0.85" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    'star-cup': ['0 0 24 24', '<path d="M5.8 2.4h12.4v6c0 3.4-2.8 6.2-6.2 6.2S5.8 11.8 5.8 8.4z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><path d="M5.8 3.4H3.4a1 1 0 0 0-1 1v1.8a4.2 4.2 0 0 0 3.4 4.1V8.2A2.2 2.2 0 0 1 4.4 6.1V5.4h1.4z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><path d="M18.2 3.4h2.4a1 1 0 0 1 1 1v1.8a4.2 4.2 0 0 1-3.4 4.1V8.2a2.2 2.2 0 0 0 1.4-2.1V5.4h-1.4z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><rect x="10.8" y="14.4" width="2.4" height="2.6" rx="0.4" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><path d="M8.6 17h6.8a2 2 0 0 1 2 2v.4H6.6V19a2 2 0 0 1 2-2z" fill="url(#gm-slate)" stroke="var(--c-slate-rim)" stroke-width="0.5"/><rect x="4.6" y="19.8" width="14.8" height="2.2" rx="0.6" fill="url(#gm-slate)" stroke="var(--c-slate-rim)" stroke-width="0.5"/><path d="M12 4.8 13.1 7.6 16.1 7.8 13.8 9.8 14.5 12.7 12 11.1 9.5 12.7 10.2 9.8 7.9 7.8 10.9 7.6z" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/>'],
    'coin-circle': ['0.10 0.10 23.81 23.81', '<circle cx="12" cy="12" r="9" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><circle cx="12" cy="12" r="9" fill="url(#gm-gloss)"/> <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.6-8.7c-1.7-.5-2.2-.9-2.2-1.5 0-.7.7-1.2 1.8-1.2 1.2 0 1.7.6 1.7 1.4h1.6c0-1.2-.8-2.3-2.2-2.6V6h-2.2v1.4c-1.3.3-2.3 1.2-2.3 2.5 0 1.5 1.3 2.3 3.2 2.8 1.7.4 2 1 2 1.6 0 .5-.3 1.2-1.8 1.2-1.4 0-1.9-.6-2-1.4H8.6c.1 1.5 1.2 2.4 2.5 2.7V18h2.2v-1.4c1.4-.3 2.4-1.1 2.4-2.5 0-1.8-1.6-2.5-3.1-2.8z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    'sun-cloud-colour': ['0 0 24 24', '<circle cx="9.6" cy="9" r="4.6" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><circle cx="9.6" cy="9" r="4.6" fill="url(#gm-gloss)"/> <g stroke="var(--c-amber)" stroke-width="1.8" stroke-linecap="round"> <path d="M9.6 1.6v1.8"/><path d="M1.6 9h1.8"/><path d="M3.9 3.3 5.2 4.6"/> <path d="M15.3 3.3 14 4.6"/><path d="M3.9 14.7 5.2 13.4"/> </g> <path d="M9 21.4a3.9 3.9 0 0 1 .4-7.8 5.2 5.2 0 0 1 9.7 1.3 3.2 3.2 0 0 1-.5 6.5z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/> <path d="M9.4 13.6a5.2 5.2 0 0 1 6 1.4 3.6 3.6 0 0 0-5.1 1.9 3.9 3.9 0 0 0-1.3-3.3z" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6" opacity="0.65"/>'],
    'partly-cloudy': ['0 0 24 24', '<circle cx="9.6" cy="9" r="4.6" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><circle cx="9.6" cy="9" r="4.6" fill="url(#gm-gloss)"/> <g stroke="var(--c-amber)" stroke-width="1.8" stroke-linecap="round"> <path d="M9.6 1.6v1.8"/><path d="M1.6 9h1.8"/><path d="M3.9 3.3 5.2 4.6"/> <path d="M15.3 3.3 14 4.6"/><path d="M3.9 14.7 5.2 13.4"/> </g> <path d="M9 21.4a3.9 3.9 0 0 1 .4-7.8 5.2 5.2 0 0 1 9.7 1.3 3.2 3.2 0 0 1-.5 6.5z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/> <path d="M9.4 13.6a5.2 5.2 0 0 1 6 1.4 3.6 3.6 0 0 0-5.1 1.9 3.9 3.9 0 0 0-1.3-3.3z" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6" opacity="0.65"/>'],
    'high-speed-train': ['0 0 24 24', '<path d="M12 1.6c3.9 0 6.4 2.6 6.4 6.4v9.6a2.6 2.6 0 0 1-2.6 2.6H8.2a2.6 2.6 0 0 1-2.6-2.6V8c0-3.8 2.5-6.4 6.4-6.4z" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="1" stroke-linejoin="round" /><path d="M12 1.6c3.9 0 6.4 2.6 6.4 6.4v9.6a2.6 2.6 0 0 1-2.6 2.6H8.2a2.6 2.6 0 0 1-2.6-2.6V8c0-3.8 2.5-6.4 6.4-6.4z" fill="url(#gm-gloss)"/> <path d="M12 1.6c3.9 0 6.4 2.6 6.4 6.4v1.2H5.6V8c0-3.8 2.5-6.4 6.4-6.4z" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/> <path d="M8.3 6.4C9 4.9 10.4 4.1 12 4.1s3 .8 3.7 2.3z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/> <rect x="5.6" y="10.6" width="12.8" height="4.4" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <rect x="7" y="16.4" width="2.9" height="1.8" rx="0.9" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <rect x="14.1" y="16.4" width="2.9" height="1.8" rx="0.9" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <path d="M8.6 20.4 6.6 22.8M15.4 20.4l2 2.4" stroke="var(--c-stone)" stroke-width="1.6" stroke-linecap="round"/>'],
    'rosette-award': ['0 0 24 24', '<path d="M12 1.8 13.8 5.4 17.8 4.6 17 8.6 20.6 10.4 17 12.2 17.8 16.2 13.8 15.4 12 19 10.2 15.4 6.2 16.2 7 12.2 3.4 10.4 7 8.6 6.2 4.6 10.2 5.4z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><circle cx="12" cy="10.4" r="4.2" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><circle cx="12" cy="10.4" r="2.4" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/><path d="M8.4 16.6h2.8l-.6 5.8-1.8-1.6-1.8 1.6z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><path d="M12.8 16.6h2.8l1.4 5.8-1.8-1.6-1.8 1.6z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/>'],
    'phone-payment': ['0 0 24 24', '<rect x="6.4" y="1.6" width="11.2" height="20.8" rx="2.4" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><rect x="6.4" y="1.6" width="11.2" height="20.8" rx="2.4" fill="url(#gm-gloss)"/><rect x="7.8" y="4.4" width="8.4" height="13.6" rx="1" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><circle cx="12" cy="10.4" r="3" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><text x="12" y="12.3" font-family="ui-sans-serif, system-ui, sans-serif" font-size="4.6" font-weight="700" text-anchor="middle" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.35">$</text><rect x="10.4" y="2.8" width="3.2" height="0.9" rx="0.45" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><circle cx="12" cy="20.2" r="1" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/>'],
    'app-car': ['0 0 24 24', '<path d="M5.8 10.4 7.5 6.6c.3-.8 1-1.3 1.9-1.3h5.2c.9 0 1.6.5 1.9 1.3l1.7 3.8z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/> <path d="M11.6 5.3h0.9v5.1h-0.9z" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/> <rect x="2.4" y="9.9" width="19.2" height="6.5" rx="2.4" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/> <rect x="6.6" y="6.4" width="4" height="2.4" rx="0.6" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/> <circle cx="8.6" cy="7.6" r="0.75" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/> <rect x="2.7" y="11.4" width="3.1" height="1.9" rx="0.95" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <rect x="18.2" y="11.4" width="3.1" height="1.9" rx="0.95" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> <circle cx="6.8" cy="17.3" r="2.6" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/><circle cx="6.8" cy="17.3" r="1.1" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <circle cx="17.2" cy="17.3" r="2.6" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/><circle cx="17.2" cy="17.3" r="1.1" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/>'],
    'faq-book': ['0 0 24 24', '<path d="M2.2 4.4c2.8-1.2 7.2-1.1 9.8 1 2.6-2.1 7-2.2 9.8-1v14.6c-2.8-1.2-7.2-1.1-9.8 1-2.6-2.1-7-2.2-9.8-1z" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/><path d="M11.4 5.6h1.2v13.4h-1.2z" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6" opacity="0.6"/><text x="12" y="15" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" font-weight="700" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6" text-anchor="middle">?</text>'],
    'boarding-pass': ['0 0 24 24', '<path d="M2 6.4h20v4a2 2 0 0 0 0 4v3.2H2v-3.2a2 2 0 0 0 0-4z" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><path d="M2 6.4h20v4a2 2 0 0 0 0 4v3.2H2v-3.2a2 2 0 0 0 0-4z" fill="url(#gm-gloss)"/><path d="M14.6 6.4h7.4v4a2 2 0 0 0 0 4v3.2h-7.4z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><rect x="4" y="9.6" width="7.4" height="1.4" rx="0.7" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><rect x="4" y="12.6" width="5" height="1.4" rx="0.7" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><path d="M16 14.6 20 11.4l-1.4-1.2-1.6 1L15 10l-.8.7 1 1.6-1 .8-1.4-.7-.6.5z" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/>'],
    'bar-chart': ['0 0 24 24', '<rect x="2.6" y="10.4" width="5.2" height="4.6" rx="0.6" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/><rect x="2.6" y="15" width="5.2" height="6" rx="0.6" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><rect x="9.4" y="5.6" width="5.2" height="6.6" rx="0.6" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/><rect x="9.4" y="12.2" width="5.2" height="8.8" rx="0.6" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><rect x="16.2" y="13.2" width="5.2" height="3.2" rx="0.6" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><rect x="16.2" y="16.4" width="5.2" height="4.6" rx="0.6" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/>'],
    'horizon-sun': ['0 0 24 24', '<path d="M12 6.4a6.6 6.6 0 0 1 6.6 6.6H5.4A6.6 6.6 0 0 1 12 6.4z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M12 6.4a6.6 6.6 0 0 1 6.6 6.6H5.4A6.6 6.6 0 0 1 12 6.4z" fill="url(#gm-gloss)"/><g fill="none" stroke="var(--c-amber)" stroke-width="1.8" stroke-linecap="round"><path d="M12 1.6v2.2M4.4 4.2 6 5.8M19.6 4.2 18 5.8M1.4 10.4h2.2M20.4 10.4h2.2"/></g><rect x="1.4" y="13" width="21.2" height="2.4" rx="1.2" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/><rect x="4.2" y="16.6" width="15.6" height="2.2" rx="1.1" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/><rect x="7" y="20" width="10" height="2" rx="1" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/>'],
    'sun-clear': ['0 0 24 24', '<circle cx="12" cy="12" r="5.4" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><circle cx="12" cy="12" r="5.4" fill="url(#gm-gloss)"/> <circle cx="12" cy="12" r="3.6" fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5" opacity="0.45"/> <g stroke="var(--c-sun)" stroke-width="2.1" stroke-linecap="round"> <path d="M12 2.4v2.6"/><path d="M12 19v2.6"/><path d="M2.4 12h2.6"/><path d="M19 12h2.6"/> <path d="M5.2 5.2 7 7"/><path d="M17 17l1.8 1.8"/><path d="M18.8 5.2 17 7"/><path d="M7 17l-1.8 1.8"/> </g>'],
    'id-card-check': ['0 0 24 24', '<rect x="1.8" y="4.8" width="20.4" height="14.4" rx="2.2" fill="url(#gm-cream)" stroke="var(--c-rim-cool)" stroke-width="1" stroke-linejoin="round" /><rect x="1.8" y="4.8" width="20.4" height="14.4" rx="2.2" fill="url(#gm-gloss)"/> <rect x="1.8" y="4.8" width="20.4" height="3.4" rx="2.2" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/> <rect x="1.8" y="6.8" width="20.4" height="1.4" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/> <circle cx="7.4" cy="12.4" r="2.2" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <path d="M4 17.2a3.4 3.4 0 0 1 6.8 0z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <g fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5" opacity="0.55"> <rect x="12.4" y="10.6" width="7.4" height="1.4" rx="0.7"/><rect x="12.4" y="13.2" width="5.4" height="1.4" rx="0.7"/> </g> <circle cx="18.6" cy="17" r="4.2" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/> <path d="M16.7 17 18.1 18.4 20.5 15.9" fill="none" stroke="var(--c-paper)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'],
    'trophy': ['1.5 1.5 21 21', '<path d="M6.6 3h10.8v6.2a5.4 5.4 0 0 1-10.8 0z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M12 3h5.4v6.2a5.4 5.4 0 0 1-5.4 5.4z" fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5"/><path d="M6.6 4.6H4.4a2.8 2.8 0 0 0 2.6 4.6M17.4 4.6h2.2a2.8 2.8 0 0 1-2.6 4.6" fill="none" stroke="var(--c-amber)" stroke-width="1.7" stroke-linecap="round"/><rect x="10.9" y="14.4" width="2.2" height="3.6" fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5"/><rect x="7.8" y="18" width="8.4" height="2.4" rx="1.2" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/>'],
    'plane': ['0 0 24 24', '<path d="M2.4 20.6h19.2" stroke="var(--c-stone)" stroke-width="1.8" stroke-linecap="round"/><g transform="rotate(-24 12 11)"><path d="M2.6 12.4c-.5-.2-.6-.8-.2-1.1l1.9-1.5 3.4 1L12 8.4 6.8 4.2l1.9-.7 7.4 2.9 3.6-1.3c1.2-.4 2.5.1 2.9 1.2.4 1.1-.3 2.3-1.5 2.7L6.6 13.6z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/><path d="M2.6 12.4c-.5-.2-.6-.8-.2-1.1l1.9-1.5 3.4 1L12 8.4 6.8 4.2l1.9-.7 7.4 2.9 3.6-1.3c1.2-.4 2.5.1 2.9 1.2.4 1.1-.3 2.3-1.5 2.7L6.6 13.6z" fill="url(#gm-gloss)"/></g><path d="M3.6 17.6c1.6-.4 3-.5 4.4-.3" stroke="var(--c-sky)" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.8"/>'],
    'plug': ['0 0 24 24', '<rect x="7.6" y="1.8" width="2.2" height="5.4" rx="1.1" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><rect x="7.6" y="1.8" width="2.2" height="5.4" rx="1.1" fill="url(#gm-gloss)"/> <rect x="14.2" y="1.8" width="2.2" height="5.4" rx="1.1" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/> <path d="M5.8 7h12.4v3.2a6.2 6.2 0 0 1-12.4 0z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <rect x="10.9" y="16" width="2.2" height="5.8" rx="1.1" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/> <path d="M12.9 8.2 10.4 12.4h1.9l-1 3.2 3.4-4.4h-2z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    'restaurants': ['0 0 24 24', '<path fill-rule="evenodd" d="M5.80 2.40H11.00A0.60 0.60 0 0 1 11.60 3.00V8.60A3.20 2.40 0 0 1 5.20 8.60V3.00A0.60 0.60 0 0 1 5.80 2.40ZM6.09 1.90h0.95v4.46a0.47 0.47 0 0 1 -0.95 0zM7.93 1.90h0.95v4.46a0.47 0.47 0 0 1 -0.95 0zM9.76 1.90h0.95v4.46a0.47 0.47 0 0 1 -0.95 0z" fill="url(#gm-slate)" stroke="var(--c-slate-rim)" stroke-width="0.5"/><path fill-rule="evenodd" d="M5.80 2.40H11.00A0.60 0.60 0 0 1 11.60 3.00V8.60A3.20 2.40 0 0 1 5.20 8.60V3.00A0.60 0.60 0 0 1 5.80 2.40ZM6.09 1.90h0.95v4.46a0.47 0.47 0 0 1 -0.95 0zM7.93 1.90h0.95v4.46a0.47 0.47 0 0 1 -0.95 0zM9.76 1.90h0.95v4.46a0.47 0.47 0 0 1 -0.95 0z" fill="url(#gm-gloss)"/><rect x="7.62" y="10.90" width="1.56" height="10.50" rx="0.78" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><path d="M15.60 3.4C16.00 2.6 17.20 2.4 18.00 4.2C19.00 6.2 19.40 8.4 19.40 10.6C19.40 11.9 18.50 12.7 17.20 12.7H15.60Z" fill="url(#gm-slate)" stroke="var(--c-slate-rim)" stroke-width="0.5"/><rect x="15.45" y="12.4" width="1.85" height="9" rx="0.92" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><path d="M16.05 4.2c1 1.9 1.5 4 1.5 6.2h-1.5z" fill="url(#gm-paper)" opacity="0.42"/><rect x="8.05" y="11.4" width="0.55" height="9.4" rx="0.27" fill="url(#gm-paper)" opacity="0.35"/><rect x="15.85" y="13" width="0.55" height="7.6" rx="0.27" fill="url(#gm-paper)" opacity="0.3"/>'],
    'food-delivery': ['0 0 24 24', '<path d="M5.4 10.4 7.2 6.2c.32-.8 1.05-1.3 1.95-1.3h5.7c.9 0 1.63.5 1.95 1.3l1.8 4.2z" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/><path d="M5.4 10.4 7.2 6.2c.32-.8 1.05-1.3 1.95-1.3h5.7c.9 0 1.63.5 1.95 1.3l1.8 4.2z" fill="url(#gm-gloss)"/> <path d="M7.2 9.6 8.4 6.7h3v2.9zM12.4 6.7h3.2l1.2 2.9h-4.4z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/> <rect x="2.4" y="9.9" width="19.2" height="6.5" rx="2.4" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/> <rect x="2.7" y="11.4" width="3.1" height="1.9" rx="0.95" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <rect x="18.2" y="11.4" width="3.1" height="1.9" rx="0.95" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> <circle cx="6.8" cy="17.3" r="2.6" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/><circle cx="6.8" cy="17.3" r="1.1" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <circle cx="17.2" cy="17.3" r="2.6" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/><circle cx="17.2" cy="17.3" r="1.1" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/>'],
    'nearby-guides': ['0 0 24 24', '<path d="M1.4 5.2 8.4 2.8v16.4l-7 2.4z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><path d="M1.4 5.2 8.4 2.8v16.4l-7 2.4z" fill="url(#gm-gloss)"/><path d="M8.4 2.8 15.6 5.2v16.4l-7.2-2.4z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><path d="M15.6 5.2 22.6 2.8v16.4l-7 2.4z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><path d="M3.2 7.4c1.6-.9 3-.6 4.2.6 1.1 1.1.9 2.6-.4 3.4-1.4.9-2.6.5-3.4-.6-.8-1.1-1-2.6-.4-3.4z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><path d="M10 8.6c1.8-1.2 3.6-.8 4.8.6 1.2 1.4.8 3.2-.6 4.4-1.4 1.2-3 1.2-4-.2-1-1.4-1.4-3.6-.2-4.8z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><path d="M17.6 6.6c1.6-.7 3.2-.2 3.8 1.1.6 1.3-.2 2.6-1.6 3.1-1.4.5-2.6 0-3-1.2-.4-1.2 0-2.5.8-3z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><path d="M4.6 9.6c2.4 2.4 3.6-.4 6 1.2s3.4 2.6 6.6.4" fill="none" stroke="var(--c-rust)" stroke-width="0.9" stroke-linecap="round" stroke-dasharray="0.1 1.9"/><g fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.4"><path d="M4.8 8.2a1.1 1.1 0 0 0-1.1 1.1c0 .8 1.1 2 1.1 2s1.1-1.2 1.1-2A1.1 1.1 0 0 0 4.8 8.2z"/><path d="M11.6 9.6a1.1 1.1 0 0 0-1.1 1.1c0 .8 1.1 2 1.1 2s1.1-1.2 1.1-2A1.1 1.1 0 0 0 11.6 9.6z"/><path d="M18.2 7.2a1.1 1.1 0 0 0-1.1 1.1c0 .8 1.1 2 1.1 2s1.1-1.2 1.1-2A1.1 1.1 0 0 0 18.2 7.2z"/></g>'],
    'ride': ['0 0 24 24', '<path d="M1.8 15.2c0-1.2.7-2 1.9-2.3l3-2.9c1-1 2.3-1.5 3.7-1.5h4.4c1.6 0 3 .6 4.1 1.7l2.3 2.3c1.7.3 2.9 1.2 3 2.5v1.6c0 .8-.6 1.4-1.4 1.4H3.2c-.8 0-1.4-.6-1.4-1.4z" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/><path d="M1.8 15.2c0-1.2.7-2 1.9-2.3l3-2.9c1-1 2.3-1.5 3.7-1.5h4.4c1.6 0 3 .6 4.1 1.7l2.3 2.3c1.7.3 2.9 1.2 3 2.5v1.6c0 .8-.6 1.4-1.4 1.4H3.2c-.8 0-1.4-.6-1.4-1.4z" fill="url(#gm-gloss)"/><path d="M7.4 12.4 9.6 10c.5-.5 1.1-.7 1.8-.7h1.4v3.1zM14 9.3h.8c1 0 1.9.4 2.6 1.1l2 2h-5.4z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><g fill="none" stroke="var(--c-paper)" stroke-width="0.7" stroke-linecap="round" opacity="0.85"><path d="M9 11.9 11 10M15.4 11.9l2-1.9"/></g><circle cx="6.6" cy="17.4" r="3" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/><circle cx="6.6" cy="17.4" r="1.4" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><circle cx="17.4" cy="17.4" r="3" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/><circle cx="17.4" cy="17.4" r="1.4" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><rect x="20.8" y="14.2" width="1.9" height="1.4" rx="0.6" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><rect x="1.6" y="14.2" width="1.6" height="1.4" rx="0.6" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/>'],
    'lion': ['0 0 24 24', '<path d="M12 1.8c2.4 0 3.4 1.5 5.2 1.9 1.9.4 3.4.2 4.2 1.8.8 1.6-.3 2.9 0 4.6.3 1.7 1.2 2.9.2 4.3-1 1.4-2.5 1.2-3.8 2.3-1.3 1.1-1.7 2.7-3.6 3.1-1.9.4-2.9-.7-4.6-.7s-2.7 1.1-4.6.7c-1.9-.4-2.3-2-3.6-3.1-1.3-1.1-2.8-.9-3.8-2.3-1-1.4-.1-2.6.2-4.3.3-1.7-.8-3 0-4.6.8-1.6 2.3-1.4 4.2-1.8C8.6 3.3 9.6 1.8 12 1.8z" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/><path d="M12 1.8c2.4 0 3.4 1.5 5.2 1.9 1.9.4 3.4.2 4.2 1.8.8 1.6-.3 2.9 0 4.6.3 1.7 1.2 2.9.2 4.3-1 1.4-2.5 1.2-3.8 2.3-1.3 1.1-1.7 2.7-3.6 3.1-1.9.4-2.9-.7-4.6-.7s-2.7 1.1-4.6.7c-1.9-.4-2.3-2-3.6-3.1-1.3-1.1-2.8-.9-3.8-2.3-1-1.4-.1-2.6.2-4.3.3-1.7-.8-3 0-4.6.8-1.6 2.3-1.4 4.2-1.8C8.6 3.3 9.6 1.8 12 1.8z" fill="url(#gm-gloss)"/><circle cx="8.2" cy="7.2" r="2" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><circle cx="15.8" cy="7.2" r="2" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><circle cx="12" cy="12.4" r="5.8" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><g fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.4"><circle cx="9.9" cy="11.2" r="0.95"/><circle cx="14.1" cy="11.2" r="0.95"/></g><ellipse cx="12" cy="14.9" rx="2.9" ry="2.1" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><path d="M12 13.6 13.5 15h-3z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><g fill="none" stroke="var(--c-cocoa)" stroke-width="0.7" stroke-linecap="round"><path d="M12 15v1.3M12 16.3c-.7.7-1.8.5-2.3-.2M12 16.3c.7.7 1.8.5 2.3-.2M4.8 13.2h2.6M4.8 14.6h2.6M16.6 13.2h2.6M16.6 14.6h2.6"/></g>'],
    'safari': ['0 0 24 24', '<rect x="4.6" y="11.8" width="9.6" height="5.8" rx="2.4" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><rect x="4.6" y="11.8" width="9.6" height="5.8" rx="2.4" fill="url(#gm-gloss)"/> <g fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"><rect x="5.6" y="17.2" width="1.9" height="4.8" rx="0.9"/><rect x="8.6" y="17.2" width="1.9" height="4.8" rx="0.9"/><rect x="11.4" y="17.2" width="1.9" height="4.8" rx="0.9"/></g> <path d="M12.4 13.2 14.4 4.8h3L15.4 13.2z" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/> <path d="M14.4 2.6h4.4a1.9 1.9 0 0 1 0 3.8h-3.8z" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/> <g stroke="var(--c-cocoa)" stroke-width="1" stroke-linecap="round"><path d="M15.4 2.6V1.2M17.4 2.6V1.2"/></g> <g fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"><circle cx="15.4" cy="1" r="0.8"/><circle cx="17.4" cy="1" r="0.8"/><circle cx="16.4" cy="4.4" r="0.7"/> <circle cx="7.2" cy="13.6" r="1.1"/><circle cx="10.6" cy="14.4" r="1.1"/><circle cx="12.6" cy="12.8" r="0.9"/><circle cx="8.4" cy="16" r="0.9"/> <circle cx="14.6" cy="7.6" r="0.85"/><circle cx="13.8" cy="10.6" r="0.85"/></g>'],
    'safety-guide': ['0 0 24 24', '<path d="M12 1.2 2.8 5.2v6.3c0 5.8 3.9 11.2 9.2 12.5 5.3-1.3 9.2-6.7 9.2-12.5V5.2z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/> <path d="M12 1.2 2.8 5.2v6.3c0 5.8 3.9 11.2 9.2 12.5z" fill="url(#gm-leaf)" stroke="var(--c-leaf-rim)" stroke-width="0.5"/> <path d="M7.6 12.2 10.8 15.4 16.6 8.6" fill="none" stroke="var(--c-paper)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'],
    'scuba': ['0 0 24 24', '<path d="M3.6 6.4h16.8a2 2 0 0 1 2 2v3.4a4.4 4.4 0 0 1-4.4 4.4c-1.9 0-3.4-1.2-4.1-2.9L12 10.8l-1.9 2.5c-.7 1.7-2.2 2.9-4.1 2.9A4.4 4.4 0 0 1 1.6 11.8V8.4a2 2 0 0 1 2-2z" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><path d="M3.6 6.4h16.8a2 2 0 0 1 2 2v3.4a4.4 4.4 0 0 1-4.4 4.4c-1.9 0-3.4-1.2-4.1-2.9L12 10.8l-1.9 2.5c-.7 1.7-2.2 2.9-4.1 2.9A4.4 4.4 0 0 1 1.6 11.8V8.4a2 2 0 0 1 2-2z" fill="url(#gm-gloss)"/> <path d="M4.4 8.4h5.4v3a2.7 2.7 0 0 1-5.4 0zM14.2 8.4h5.4v3a2.7 2.7 0 0 1-5.4 0z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/> <path d="M20.6 6.4c1.6.6 2.4 2 2.4 4v9a2.6 2.6 0 0 1-5.2 0" fill="none" stroke="var(--c-rust)" stroke-width="1.8" stroke-linecap="round"/>'],
    'ship': ['0 0 24 24', '<rect x="10.2" y="1.6" width="2.4" height="3.2" rx="0.6" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/><rect x="10.2" y="1.6" width="2.4" height="3.2" rx="0.6" fill="url(#gm-gloss)"/> <rect x="8.4" y="4.4" width="7.6" height="4.2" rx="1" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6"/> <rect x="4.2" y="8.4" width="15.6" height="4.2" rx="1" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <g fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"> <rect x="9.6" y="5.6" width="1.8" height="1.8" rx="0.4"/><rect x="12.6" y="5.6" width="1.8" height="1.8" rx="0.4"/> <rect x="5.8" y="9.6" width="1.9" height="1.9" rx="0.4"/><rect x="9" y="9.6" width="1.9" height="1.9" rx="0.4"/> <rect x="12.2" y="9.6" width="1.9" height="1.9" rx="0.4"/><rect x="15.4" y="9.6" width="1.9" height="1.9" rx="0.4"/> </g> <path d="M2.6 12.8h18.8l-2.8 5H5.4z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> <path d="M2 19.4c1.7 0 1.7 1.5 3.4 1.5s1.7-1.5 3.4-1.5 1.7 1.5 3.4 1.5 1.7-1.5 3.4-1.5 1.7 1.5 3.4 1.5" fill="none" stroke="var(--c-blue)" stroke-width="1.7" stroke-linecap="round"/>'],
    'shuffle': ['0 0 24 24', '<path d="M2.4 5.8h4.2l9 9.4h1.4v3.2h-2.8L5 8.9H2.4z" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/><path d="M2.4 15.2h4.2l9-9.4h1.4V2.6h-2.8L5 12.1H2.4z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5" opacity="0"/><path d="M2.4 15.2h4.2l9-9.4h1.4v3.2h-2.8L5 18.2H2.4z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5" opacity="0"/><path d="M2.4 18.2h4.2l9-9.4h1.4V5.6h-2.8L5 15.2H2.4z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5" opacity="0"/><path d="M2.4 15.2h2.6l9-9.4h2.8v3.2h-1.4l-9 9.4H2.4z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/><path d="M17 3.9 21.8 7.2 17 10.5z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/><path d="M17 13.5 21.8 16.8 17 20.1z" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/>'],
    'ski': ['0 0 24 24', '<path d="M3.4 20.4c-.9-1 -.6-2.4.7-3.1l12.4-7.2c1.4-.8 2.8-.4 3.5.8.8 1.2.4 2.6-1 3.4L6.6 21.4c-1.3.8-2.4.6-3.2-1z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><path d="M3.4 20.4c-.9-1 -.6-2.4.7-3.1l12.4-7.2c1.4-.8 2.8-.4 3.5.8.8 1.2.4 2.6-1 3.4L6.6 21.4c-1.3.8-2.4.6-3.2-1z" fill="url(#gm-gloss)"/><circle cx="13.8" cy="4" r="2.3" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/><path d="M11.6 3.4a2.3 2.3 0 0 1 4.5 0z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><g fill="none" stroke="var(--c-red)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M13.4 6.4 11 10.6M11 10.6l4 2.4M11 10.6 7.6 13M12.4 8l4-1M12.4 8 8.6 7.4"/></g>'],
    'star6-yellow': ['0 0 24 24', '<path d="M12 0.5 15.1 6.63 21.96 6.25 18.2 12 21.96 17.75 15.1 17.37 12 23.5 8.9 17.37 2.04 17.75 5.8 12 2.04 6.25 8.9 6.63z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5" stroke-linejoin="round"/><path d="M12 0.5 15.1 6.63 21.96 6.25 18.2 12 21.96 17.75 15.1 17.37 12 23.5 8.9 17.37 2.04 17.75 5.8 12 2.04 6.25 8.9 6.63z" fill="url(#gm-amber)" opacity="0.35"/>'],
    'gem-yellow': ['0 0 24 24', '<path d="M1.8 8.6h20.4L12 21.8z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M7.2 2.4h9.6l5.4 6.2H1.8z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M7.2 2.4h9.6l-2.4 6.2H9.6z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M1.8 8.6 7.2 2.4l2.4 6.2z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M22.2 8.6 16.8 2.4l-2.4 6.2z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M9.6 8.6 12 21.8 4.8 8.6z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5" opacity="0.4"/><path d="M14.4 8.6 12 21.8 19.2 8.6z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5" opacity="0.4"/><path d="M8.4 3.6h2.4l-.9 3.4z" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6" opacity="0.65"/>'],
    'sparkle': ['0 0 24 24', '<path d="M12 3.6a6.6 6.6 0 0 0-3.8 12c.5.4.8 1 .8 1.6v.6h6v-.6c0-.6.3-1.2.8-1.6A6.6 6.6 0 0 0 12 3.6z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M12 3.6a6.6 6.6 0 0 0-3.8 12c.5.4.8 1 .8 1.6v.6h6v-.6c0-.6.3-1.2.8-1.6A6.6 6.6 0 0 0 12 3.6z" fill="url(#gm-gloss)"/><path d="M9 18.6h6v1.2a1.4 1.4 0 0 1-1.4 1.4h-3.2A1.4 1.4 0 0 1 9 19.8z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M9.6 16.4h4.8" stroke="var(--c-cocoa)" stroke-width="1" opacity="0.5"/><path d="M9.8 14.6c0-1.8-1.2-2.4-1.2-3.9a3.4 3.4 0 0 1 6.8 0c0 1.5-1.2 2.1-1.2 3.9z" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6" opacity="0.55"/>'],
    'star': ['0 0 24 24', '<path d="M12.00 0.50L14.76 8.20L22.94 8.45L16.47 13.45L18.76 21.30L12.00 16.70L5.24 21.30L7.53 13.45L1.06 8.45L9.24 8.20Z" fill="url(#sph-yellow)" stroke="#a2740a" stroke-width="0.5" stroke-linejoin="round"/><path d="M12.00 0.50L14.76 8.20L22.94 8.45L16.47 13.45L18.76 21.30L12.00 16.70L5.24 21.30L7.53 13.45L1.06 8.45L9.24 8.20Z" fill="url(#sph-yellow-b)"/>'],
    'sun': ['0 0 24 24', '<circle cx="9.6" cy="9" r="4.6" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><circle cx="9.6" cy="9" r="4.6" fill="url(#gm-gloss)"/> <g stroke="var(--c-amber)" stroke-width="1.8" stroke-linecap="round"> <path d="M9.6 1.6v1.8"/><path d="M1.6 9h1.8"/><path d="M3.9 3.3 5.2 4.6"/> <path d="M15.3 3.3 14 4.6"/><path d="M3.9 14.7 5.2 13.4"/> </g> <path d="M9 21.4a3.9 3.9 0 0 1 .4-7.8 5.2 5.2 0 0 1 9.7 1.3 3.2 3.2 0 0 1-.5 6.5z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/> <path d="M9.4 13.6a5.2 5.2 0 0 1 6 1.4 3.6 3.6 0 0 0-5.1 1.9 3.9 3.9 0 0 0-1.3-3.3z" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6" opacity="0.65"/>'],
    'sunset': ['0 0 24 24', '<circle cx="12" cy="11.4" r="5" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><circle cx="12" cy="11.4" r="5" fill="url(#gm-gloss)"/> <g stroke="var(--c-amber)" stroke-width="1.9" stroke-linecap="round"> <path d="M12 2.4v2.2"/><path d="M4.4 4.6 5.9 6.1"/><path d="M19.6 4.6 18.1 6.1"/> <path d="M2.2 11.4h2.2"/><path d="M19.6 11.4h2.2"/> </g> <rect x="2" y="15.4" width="20" height="2.3" rx="1.15" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/> <rect x="4.4" y="19.2" width="15.2" height="2.3" rx="1.15" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/>'],
    'tap-water': ['0 0 24 24', '<path d="M12 2.2C12 2.2 5 10.4 5 14.4a7 7 0 0 0 14 0c0-4-7-12.2-7-12.2z" fill="url(#gm-teal)" stroke="var(--c-teal-rim)" stroke-width="0.5"/><path d="M12 2.2C12 2.2 5 10.4 5 14.4a7 7 0 0 0 14 0c0-4-7-12.2-7-12.2z" fill="url(#gm-gloss)"/> <path d="M12 5.4c0 0-4.4 5.6-4.4 9a4.4 4.4 0 0 0 2 3.7C8.4 16.6 8 15.4 8 14.2c0-2.8 4-8.8 4-8.8z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5" opacity="0.75"/> <ellipse cx="9.4" cy="15.4" rx="1.5" ry="2.1" fill="url(#gm-paper)" stroke="var(--c-rim-cool)" stroke-width="0.6" opacity="0.5" transform="rotate(-20 9.4 15.4)"/>'],
    'theatre': ['0 0 24 24', '<path d="M2.6 4.4h10.2v6.8a5.1 5.1 0 0 1-10.2 0z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><path d="M2.6 4.4h10.2v6.8a5.1 5.1 0 0 1-10.2 0z" fill="url(#gm-gloss)"/> <g fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"><circle cx="5" cy="8" r="1"/><circle cx="10.4" cy="8" r="1"/></g> <path d="M5.6 12.4h4.6a2.5 2.5 0 0 1-4.6 0z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/> <path d="M11.2 8.6h10.2v6.8a5.1 5.1 0 0 1-10.2 0z" fill="url(#gm-plum)" stroke="var(--c-plum-rim)" stroke-width="0.5"/> <g fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"><circle cx="13.6" cy="12.2" r="1"/><circle cx="19" cy="12.2" r="1"/></g> <path d="M14.2 18.4a2.3 2.3 0 0 1 4.6 0z" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/>'],
    'ticket': ['0 0 24 24', '<path d="M2 6.4h20v4a2 2 0 0 0 0 4v3.2H2v-3.2a2 2 0 0 0 0-4z" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><path d="M2 6.4h20v4a2 2 0 0 0 0 4v3.2H2v-3.2a2 2 0 0 0 0-4z" fill="url(#gm-gloss)"/><path d="M14.6 6.4h7.4v4a2 2 0 0 0 0 4v3.2h-7.4z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><rect x="4" y="9.6" width="7.4" height="1.4" rx="0.7" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><rect x="4" y="12.6" width="5" height="1.4" rx="0.7" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><path d="M16 14.6 20 11.4l-1.4-1.2-1.6 1L15 10l-.8.7 1 1.6-1 .8-1.4-.7-.6.5z" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/>'],
    'tipping': ['0 0 24 24', '<circle cx="12" cy="7" r="5.6" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><circle cx="12" cy="7" r="5.6" fill="url(#gm-gloss)"/> <circle cx="12" cy="7" r="4" fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5"/> <text x="12" y="10.1" font-family="ui-serif, Georgia, serif" font-size="7.8" font-weight="700" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6" text-anchor="middle">$</text> <path d="M4 15h4.6l2.2 1.6h2.9c.9 0 1.6.7 1.6 1.6H11v1.4h4.6l4.4-2.3 1 1.7-5 3.5H4z" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/> <rect x="1.4" y="14.6" width="3" height="8" rx="1.1" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/>'],
    'train': ['0 0 24 24', '<path d="M4 15.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V5c0-3.5-3.58-4-8-4S4 1.5 4 5v10.5z" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><path d="M4 15.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V5c0-3.5-3.58-4-8-4S4 1.5 4 5v10.5z" fill="url(#gm-gloss)"/><path d="M6 5h12v5H6z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><circle cx="12" cy="15" r="2" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    'trusted': ['0 0 24 24', '<circle cx="10" cy="8" r="4" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/><circle cx="10" cy="8" r="4" fill="url(#gm-gloss)"/> <path d="M10 13.8c-3.9 0-7 1.9-7 4.3V21h8.6a6.4 6.4 0 0 1 2.2-6.6 12.6 12.6 0 0 0-3.8-.6z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <circle cx="17.2" cy="17.6" r="4.9" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/> <path d="M14.9 17.6 16.6 19.3 19.6 16.3" fill="none" stroke="var(--c-paper)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'],
    'pagoda': ['0 0 24 24', '<rect x="11.4" y="0.8" width="1.2" height="2.4" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/><rect x="11.4" y="0.8" width="1.2" height="2.4" fill="url(#gm-gloss)"/> <path d="M12 3 20.2 7.4H3.8z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> <rect x="9.4" y="7.4" width="5.2" height="2.4" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <path d="M12 9.4 21.6 14H2.4z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> <rect x="8.4" y="14" width="7.2" height="2.6" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <path d="M12 16.2 23 21.4H1z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> <rect x="7.4" y="21.4" width="9.2" height="1.6" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <rect x="10.6" y="17.4" width="2.8" height="4" rx="0.4" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/>'],
    'unesco': ['0 0 24 24', '<path d="M12 2.4 22 8.2H2z" fill="url(#gm-clay)" stroke="var(--c-clay-rim)" stroke-width="0.5"/><path d="M12 2.4 22 8.2H2z" fill="url(#gm-gloss)"/> <rect x="1.6" y="8.2" width="20.8" height="1.8" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/> <g fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="1" stroke-linejoin="round"><rect x="4" y="10.4" width="2.4" height="8"/><rect x="8.4" y="10.4" width="2.4" height="8"/><rect x="12.8" y="10.4" width="2.4" height="8"/><rect x="17.2" y="10.4" width="2.4" height="8"/></g> <rect x="2.2" y="18.4" width="19.6" height="2.2" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <rect x="1.4" y="20.8" width="21.2" height="1.8" rx="0.9" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/>'],
    'syringe-colour': ['0 0 24 24', '<defs><clipPath id="cp474"><path d="M16.3 1.3 15 2.6l1.6 1.6-2 2-2.6-2.6-1.3 1.3 1 1-6.6 6.6a3 3 0 0 0-.8 1.5l-.7 3.1-1.9 1.9 1.3 1.3 1.9-1.9 3.1-.7a3 3 0 0 0 1.5-.8l6.6-6.6 1 1 1.3-1.3-2.6-2.6 2-2L20.4 6l1.3-1.3-5.4-3.4zm-1.7 8.3-2.2 2.2-1.4-1.4-1.2 1.2 1.4 1.4-1.3 1.3-1.4-1.4-1.2 1.2 1.4 1.4-.6.6a1.2 1.2 0 0 1-.6.3l-2.2.5.5-2.2a1.2 1.2 0 0 1 .3-.6l6.3-6.3 2.2 2.2z"/></clipPath></defs><path d="M16.3 1.3 15 2.6l1.6 1.6-2 2-2.6-2.6-1.3 1.3 1 1-6.6 6.6a3 3 0 0 0-.8 1.5l-.7 3.1-1.9 1.9 1.3 1.3 1.9-1.9 3.1-.7a3 3 0 0 0 1.5-.8l6.6-6.6 1 1 1.3-1.3-2.6-2.6 2-2L20.4 6l1.3-1.3-5.4-3.4zm-1.7 8.3-2.2 2.2-1.4-1.4-1.2 1.2 1.4 1.4-1.3 1.3-1.4-1.4-1.2 1.2 1.4 1.4-.6.6a1.2 1.2 0 0 1-.6.3l-2.2.5.5-2.2a1.2 1.2 0 0 1 .3-.6l6.3-6.3 2.2 2.2z" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/><g clip-path="url(#cp474)"><path d="M0.9 7 14.1 22 -3 26 -3 7z" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><path d="M0.9 7 14.1 22 18.6 17.5 5.4 2.5z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/><path d="M10.9 -1.7 24.1 13.3 27 13 27 -3z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/></g><path d="M16.3 1.3 15 2.6l1.6 1.6-2 2-2.6-2.6-1.3 1.3 1 1-6.6 6.6a3 3 0 0 0-.8 1.5l-.7 3.1-1.9 1.9 1.3 1.3 1.9-1.9 3.1-.7a3 3 0 0 0 1.5-.8l6.6-6.6 1 1 1.3-1.3-2.6-2.6 2-2L20.4 6l1.3-1.3-5.4-3.4zm-1.7 8.3-2.2 2.2-1.4-1.4-1.2 1.2 1.4 1.4-1.3 1.3-1.4-1.4-1.2 1.2 1.4 1.4-.6.6a1.2 1.2 0 0 1-.6.3l-2.2.5.5-2.2a1.2 1.2 0 0 1 .3-.6l6.3-6.3 2.2 2.2z" fill="none" stroke="var(--c-stone-rim)" stroke-width="1"/>'],
    'vaccines': ['0 0 24 24', '<rect x="1.6" y="10.2" width="2.2" height="3.6" rx="0.6" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/><rect x="1.6" y="10.2" width="2.2" height="3.6" rx="0.6" fill="url(#gm-gloss)"/> <rect x="3.8" y="11.2" width="2.6" height="1.6" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <rect x="6.4" y="8.6" width="9.6" height="6.8" rx="1.2" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/> <rect x="6.4" y="8.6" width="4.2" height="6.8" rx="1.2" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <g stroke="var(--c-paper)" stroke-width="0.75" opacity="0.9" stroke-linecap="round"><path d="M11.6 9.4v1.5M13 9.4v1.5M14.4 9.4v1.5"/></g> <rect x="16" y="10.4" width="1.8" height="3.2" rx="0.4" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <rect x="17.8" y="11.6" width="4.6" height="0.9" rx="0.45" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/> <circle cx="22" cy="8.8" r="1.5" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/>'],
    'van': ['0 0 24 24', '<path d="M6 2.4h12a2.8 2.8 0 0 1 2.8 2.8v12a2.8 2.8 0 0 1-2.8 2.8H6A2.8 2.8 0 0 1 3.2 17.2v-12A2.8 2.8 0 0 1 6 2.4z" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/><path d="M6 2.4h12a2.8 2.8 0 0 1 2.8 2.8v12a2.8 2.8 0 0 1-2.8 2.8H6A2.8 2.8 0 0 1 3.2 17.2v-12A2.8 2.8 0 0 1 6 2.4z" fill="url(#gm-gloss)"/> <rect x="4.9" y="5.6" width="14.2" height="6.2" rx="1" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5"/> <rect x="11.4" y="5.6" width="1.2" height="6.2" fill="url(#gm-rust)" stroke="var(--c-rust-rim)" stroke-width="0.5"/> <rect x="3.2" y="13.4" width="17.6" height="1.8" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <circle cx="7.5" cy="17.4" r="1.7" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/><circle cx="16.5" cy="17.4" r="1.7" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <path d="M6.4 20h11.2l1.4 2v.6H5V22z" fill="url(#gm-tire)" stroke="var(--c-tire-rim)" stroke-width="0.5"/>'],
    'visas': ['0 0 24 24', '<rect x="4.2" y="2.4" width="15.4" height="19.2" rx="2" fill="url(#gm-navy)" stroke="var(--c-navy-rim)" stroke-width="0.5"/><rect x="4.2" y="2.4" width="15.4" height="19.2" rx="2" fill="url(#gm-gloss)"/> <rect x="5.6" y="2.4" width="1.6" height="19.2" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/> <rect x="17.8" y="4.4" width="2.4" height="15.2" rx="1" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <circle cx="12.4" cy="9.6" r="3.4" fill="none" stroke="var(--c-sun)" stroke-width="1.3"/> <path d="M12.4 6.2v6.8M9 9.6h6.8" stroke="var(--c-sun)" stroke-width="0.9"/> <rect x="8.6" y="15.6" width="7.6" height="1.7" rx="0.85" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/>'],
    'volcano-erupting': ['0 0 24 24', '<path d="M9 5.2h6l7.4 15.6H1.6z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M9 5.2h6l7.4 15.6H1.6z" fill="url(#gm-gloss)"/><path d="M9 5.2h2.6l-.5 15.6H1.6z" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5" opacity="0.4"/><path d="M10.2 5.6c-.4 2.6-1.2 4.4-1.6 7-.2 1.5-.2 2.9 0 4.3l1.5-1.5.9 2.2 1.2-2.6 1.3 2.1.7-2.3 1.4 1.3c.3-1.9.1-3.6-.3-5.2-.5-2-1.3-3.5-1.6-5.3z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><path d="M11.3 6.4c-.2 2-.7 3.4-1 5.2-.2 1.1-.2 2.1 0 3.1l.8-1 .5 1.6.8-1.9.7 1.5.4-1.6.8.9c.2-1.4 0-2.6-.3-3.8-.4-1.4-.9-2.4-1.1-3.9z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5" opacity="0.9"/><path d="M11.3 6.4c-.2 2-.7 3.4-1 5.2-.2 1.1-.2 2.1 0 3.1l.8-1 .5 1.6.8-1.9.7 1.5.4-1.6.8.9c.2-1.4 0-2.6-.3-3.8-.4-1.4-.9-2.4-1.1-3.9z" fill="url(#gm-sheen)"/><ellipse cx="12" cy="5.2" rx="3" ry="1.15" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><g fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"><circle cx="8.6" cy="2.8" r="0.8"/><circle cx="15.2" cy="2.2" r="0.65"/><circle cx="11.4" cy="1.2" r="0.55"/><circle cx="17.4" cy="4.4" r="0.5"/></g><rect x="1" y="20.4" width="22" height="1.6" rx="0.8" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/>'],
    'volcano': ['0 0 24 24', '<path d="M9 5.2h6l7.4 15.6H1.6z" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M9 5.2h6l7.4 15.6H1.6z" fill="url(#gm-gloss)"/><path d="M9 5.2h2.6l-.5 15.6H1.6z" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5" opacity="0.4"/><path d="M10.2 5.6c-.4 2.6-1.2 4.4-1.6 7-.2 1.5-.2 2.9 0 4.3l1.5-1.5.9 2.2 1.2-2.6 1.3 2.1.7-2.3 1.4 1.3c.3-1.9.1-3.6-.3-5.2-.5-2-1.3-3.5-1.6-5.3z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><path d="M11.3 6.4c-.2 2-.7 3.4-1 5.2-.2 1.1-.2 2.1 0 3.1l.8-1 .5 1.6.8-1.9.7 1.5.4-1.6.8.9c.2-1.4 0-2.6-.3-3.8-.4-1.4-.9-2.4-1.1-3.9z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5" opacity="0.9"/><path d="M11.3 6.4c-.2 2-.7 3.4-1 5.2-.2 1.1-.2 2.1 0 3.1l.8-1 .5 1.6.8-1.9.7 1.5.4-1.6.8.9c.2-1.4 0-2.6-.3-3.8-.4-1.4-.9-2.4-1.1-3.9z" fill="url(#gm-sheen)"/><ellipse cx="12" cy="5.2" rx="3" ry="1.15" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/><g fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"><circle cx="8.6" cy="2.8" r="0.8"/><circle cx="15.2" cy="2.2" r="0.65"/><circle cx="11.4" cy="1.2" r="0.55"/><circle cx="17.4" cy="4.4" r="0.5"/></g><rect x="1" y="20.4" width="22" height="1.6" rx="0.8" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/>'],
    'walk': ['0 0 24 24', '<circle cx="13.2" cy="3.7" r="2.3" fill="url(#gm-tan)" stroke="var(--c-tan-rim)" stroke-width="0.5"/> <g fill="none" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"> <path d="M13.2 7.6 11.6 12.8" stroke="var(--c-red)"/><path d="M12.4 9.2 15.8 11.4" stroke="var(--c-red)"/><path d="M12.6 8.9 9.4 11.2" stroke="var(--c-red)"/> <path d="M11.6 12.8 13.9 16.2 13.4 20.9" stroke="var(--c-navy)"/><path d="M11.6 12.8 9.4 16.4 7.9 20.4" stroke="var(--c-navy)"/></g>'],
    'warn': ['0 0 24 24', '<path d="M12 2.2c-.66 0-1.27.35-1.6.92L.7 20.3A1.85 1.85 0 0 0 2.3 23h19.4a1.85 1.85 0 0 0 1.6-2.7L13.6 3.12A1.85 1.85 0 0 0 12 2.2z" fill="url(#gm-amber)" stroke="var(--c-amber-rim)" stroke-width="0.5"/> <path d="M12 5.9 3.4 20.9h17.2z" fill="url(#gm-sun)" stroke="var(--c-sun-rim)" stroke-width="0.5"/> <rect x="10.9" y="9.6" width="2.2" height="6.1" rx="1.1" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/> <rect x="10.9" y="17" width="2.2" height="2.2" rx="1.1" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/>'],
    'lake-jetty': ['0 0 24 24', '<rect x="4.05" y="12.2" width="1.1" height="2.2" rx="0.4" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><rect x="4.05" y="12.2" width="1.1" height="2.2" rx="0.4" fill="url(#gm-gloss)"/><path d="M4.6 6 7.8 12.6H1.4z" fill="url(#gm-leaf)" stroke="var(--c-leaf-rim)" stroke-width="0.5"/><path d="M4.6 6 6.712 9.712H2.488z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><rect x="18.85" y="12.2" width="1.1" height="2.2" rx="0.4" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><path d="M19.4 6.4 22.4 12.6H16.4z" fill="url(#gm-leaf)" stroke="var(--c-leaf-rim)" stroke-width="0.5"/><path d="M19.4 6.4 21.38 9.88H17.42z" fill="url(#gm-green)" stroke="var(--c-green-rim)" stroke-width="0.5"/><path d="M1.8 16.6c1.6-2 4.4-3 8.4-3h5c3.4 0 6 .9 7.4 2.6.6.7.4 1.8-.6 2.4-2.2 1.4-5.2 2.1-9 2.1s-6.9-.7-9.4-2.1c-1.1-.6-1.3-1.6-.4-2z" fill="url(#gm-blue)" stroke="var(--c-blue-rim)" stroke-width="0.5"/><g fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.4"><rect x="9.6" y="12.6" width="4.8" height="1.7" rx="0.3"/><rect x="10" y="14.3" width="0.9" height="3.4" rx="0.3"/><rect x="13.1" y="14.3" width="0.9" height="3.4" rx="0.3"/></g><g fill="none" stroke="var(--c-paper)" stroke-width="0.85" stroke-linecap="round" opacity="0.85"><path d="M4.6 17.6c1.2 0 1.2.8 2.4.8s1.2-.8 2.4-.8M15 17.8c1.2 0 1.2.8 2.4.8s1.2-.8 2.4-.8"/></g>'],
    'waves': ['0 0 24 24', '<g stroke-linecap="round" fill="none"> <path d="M1.8 7.4c1.7 0 1.7 1.6 3.4 1.6s1.7-1.6 3.4-1.6 1.7 1.6 3.4 1.6 1.7-1.6 3.4-1.6 1.7 1.6 3.4 1.6 1.7-1.6 3.4-1.6" stroke="var(--c-sky)" stroke-width="2"/> <path d="M1.8 12c1.7 0 1.7 1.6 3.4 1.6S6.9 12 8.6 12s1.7 1.6 3.4 1.6S13.7 12 15.4 12s1.7 1.6 3.4 1.6S20.5 12 22.2 12" stroke="var(--c-blue)" stroke-width="2"/> <path d="M1.8 16.6c1.7 0 1.7 1.6 3.4 1.6s1.7-1.6 3.4-1.6 1.7 1.6 3.4 1.6 1.7-1.6 3.4-1.6 1.7 1.6 3.4 1.6 1.7-1.6 3.4-1.6" stroke="var(--c-navy)" stroke-width="2"/></g>'],
    'wine': ['0 0 24 24', '<rect x="4.4" y="1.4" width="2.8" height="3.6" rx="0.5" fill="url(#gm-cocoa)" stroke="var(--c-cocoa-rim)" stroke-width="0.5"/><rect x="4.4" y="1.4" width="2.8" height="3.6" rx="0.5" fill="url(#gm-gloss)"/> <path d="M4.2 5h3.2c1.5 1.1 2.3 2.6 2.3 4.4v11a1.6 1.6 0 0 1-1.6 1.6H3.5a1.6 1.6 0 0 1-1.6-1.6v-11c0-1.8.8-3.3 2.3-4.4z" fill="url(#gm-leaf)" stroke="var(--c-leaf-rim)" stroke-width="0.5"/> <rect x="2.2" y="12" width="7.2" height="4.6" rx="0.7" fill="url(#gm-cream)" stroke="var(--c-rim-warm)" stroke-width="0.6"/> <path d="M13.2 6.4h8.4v3.8a4.2 4.2 0 0 1-8.4 0z" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5" opacity="0.5"/> <path d="M13.9 8.6h7v1.6a3.5 3.5 0 0 1-7 0z" fill="url(#gm-red)" stroke="var(--c-red-rim)" stroke-width="0.5"/> <rect x="16.65" y="13.6" width="1.5" height="6" fill="url(#gm-sky)" stroke="var(--c-sky-rim)" stroke-width="0.5" opacity="0.6"/> <rect x="13.8" y="19.6" width="7.2" height="1.8" rx="0.9" fill="url(#gm-stone)" stroke="var(--c-stone-rim)" stroke-width="0.5"/>'],
  };

  var GM_PALETTE =
    ':root{--c-tire:#3a332e;--c-stone:#a89c8e;--c-paper:#fff;--c-cream:#f6ecdb;' +
    '--c-tan:#fca240;--c-cocoa:#8a3d0c;--c-rust:#e25100;--c-clay:#ff661d;' +
    '--c-red:#ff200c;--c-rose:#ff3d7a;--c-plum:#ad29e5;--c-sun:#ffc110;' +
    '--c-amber:#ff7c08;--c-green:#4ad017;--c-leaf:#2f9106;--c-teal:#01d5bc;' +
    '--c-blue:#0982ec;--c-navy:#0d4a86;--c-sky:#3dbaff;--c-grape:#6b2fa0;--c-wine:#8c1a10;--c-pine:#14663c;--c-slate:#566b7a;' +
    '--c-paper-shade:#dad4cb;--c-cream-shade:#e0d7c7;--c-rim-warm:#c25a20;--c-rim-cool:#93a4b2;--c-tire-shade:#171412;--c-tire-rim:#26221e;--c-stone-shade:#80776c;--c-stone-rim:#6f675e;--c-tan-shade:#c57e32;--c-tan-rim:#a66b2a;--c-cocoa-shade:#572608;--c-cocoa-rim:#5b2808;--c-rust-shade:#a73c00;--c-rust-rim:#953500;--c-clay-shade:#c24e16;--c-clay-rim:#a84313;--c-red-shade:#bf1809;--c-red-rim:#a81508;--c-rose-shade:#bf2e5b;--c-rose-rim:#a82851;--c-plum-shade:#7d1ea5;--c-plum-rim:#721b97;--c-sun-shade:#c7970c;--c-sun-rim:#a87f0b;--c-amber-shade:#c45f06;--c-amber-rim:#a85205;--c-green-shade:#3aa212;--c-green-rim:#31890f;--c-leaf-shade:#236b04;--c-leaf-rim:#1f6004;--c-teal-shade:#01a693;--c-teal-rim:#018d7c;--c-blue-shade:#0760af;--c-blue-rim:#06569c;--c-navy-shade:#072a4c;--c-navy-rim:#093158;--c-sky-shade:#2f8fc4;--c-sky-rim:#287ba8;--c-grape-shade:#401c60;--c-grape-rim:#471f6a;--c-wine-shade:#4e0f09;--c-wine-rim:#5c110a;--c-pine-shade:#0d4227;--c-pine-rim:#0d4327;--c-slate-shade:#3c4b55;--c-slate-rim:#394751}' +
    '@media(prefers-color-scheme:dark){:root{--c-tire:#5c5049;--c-stone:#9a8e80;' +
    '--c-paper:#f2ece2;--c-cream:#e4d6bf;--c-tan:#ffb866;--c-cocoa:#c06a22;' +
    '--c-rust:#ff8420;--c-clay:#ff834b;--c-red:#ff6a55;--c-rose:#ff6685;' +
    '--c-plum:#e249e8;--c-sun:#ffcf4d;--c-amber:#ff9a34;--c-green:#74ef3f;' +
    '--c-leaf:#5fbf2a;--c-teal:#21e8d0;--c-blue:#3caefe;--c-navy:#2f7fc4;' +
    '--c-sky:#66caff;--c-grape:#9d5fd6;--c-wine:#c9584a;--c-pine:#3fa876;--c-slate:#8ea3b2;--c-paper-shade:#dad4cb;--c-cream-shade:#cfc3ae;' +
    '--c-rim-warm:#e0873f;--c-rim-cool:#a9bac8;--c-tire-shade:#38312d;--c-tire-rim:#8d8480;--c-stone-shade:#736a60;--c-stone-rim:#b8b0a6;--c-tan-shade:#c79050;--c-tan-rim:#ffcd94;--c-cocoa-shade:#8e4e19;--c-cocoa-rim:#d39764;--c-rust-shade:#c46619;--c-rust-rim:#ffa963;--c-clay-shade:#c4653a;--c-clay-rim:#ffa881;--c-red-shade:#c25141;--c-red-rim:#ff9788;--c-rose-shade:#c24e65;--c-rose-rim:#ff94aa;--c-plum-shade:#a937ae;--c-plum-rim:#eb80ef;--c-sun-shade:#c7a13c;--c-sun-rim:#ffdd82;--c-amber-shade:#c47728;--c-amber-rim:#ffb871;--c-green-shade:#5aba31;--c-green-rim:#9ef479;--c-leaf-shade:#499320;--c-leaf-rim:#8fd26a;--c-teal-shade:#1ab5a2;--c-teal-rim:#64efde;--c-blue-shade:#2e86c4;--c-blue-rim:#76c6fe;--c-navy-shade:#225d8f;--c-navy-rim:#6da5d6;--c-sky-shade:#509ec7;--c-sky-rim:#94daff;--c-grape-shade:#73459c;--c-grape-rim:#ba8fe2;--c-wine-shade:#934036;--c-wine-rim:#d98a80;--c-pine-shade:#30805a;--c-pine-rim:#79c29f;--c-slate-shade:#6c7c87;--c-slate-rim:#b0bfc9}}' +
    '.gm-ic{display:inline-block;vertical-align:-0.15em;flex-shrink:0}' +
    '.gm-mk.gm-mk-c{background:none;-webkit-mask:none;mask:none;line-height:0;'
    /* the svg inside is 1.2em; without matching the BOX to it the mark
       overflows its own 1em width and sits on top of the text. */
    + 'width:1.2em;height:1.2em;margin-right:0.2em;vertical-align:-0.22em}' +
    '.gm-mk.gm-mk-c svg{width:1.2em;height:1.2em;display:block}';

  /* One sprite and one style tag per page, inserted before anything asks for a
     symbol. Idempotent: a second call is a no-op. */
  function _gmSprite() {
    if (document.getElementById('gm-sprite')) return;
    var st = document.createElement('style');
    st.id = 'gm-palette'; st.textContent = GM_PALETTE;
    document.head.appendChild(st);
    var out = [];
    for (var k in GM_SPRITE) {
      out.push('<symbol id="gm-i-' + k + '" viewBox="' + GM_SPRITE[k][0] + '">' + GM_SPRITE[k][1] + '</symbol>');
    }
    var wrap = document.createElement('div');
    wrap.id = 'gm-sprite';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    var GM_DEFS = '<defs>' + '<linearGradient id="gm-gloss" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.46"/><stop offset="0.42" stop-color="#fff" stop-opacity="0.14"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><radialGradient id="sph-black" cx="40%" cy="34%" r="82%"><stop offset="0%" stop-color="#7a7a7a"/><stop offset="46%" stop-color="#2c2c2c"/><stop offset="100%" stop-color="#040404"/></radialGradient><radialGradient id="sph-black-b" cx="50%" cy="90%" r="42%"><stop offset="0%" stop-color="#7a7a7a" stop-opacity="0.34"/><stop offset="100%" stop-color="#7a7a7a" stop-opacity="0"/></radialGradient><radialGradient id="sph-blue" cx="40%" cy="34%" r="82%"><stop offset="0%" stop-color="#95cbf2"/><stop offset="46%" stop-color="#2c80c9"/><stop offset="100%" stop-color="#123f68"/></radialGradient><radialGradient id="sph-blue-b" cx="50%" cy="90%" r="42%"><stop offset="0%" stop-color="#95cbf2" stop-opacity="0.34"/><stop offset="100%" stop-color="#95cbf2" stop-opacity="0"/></radialGradient><radialGradient id="sph-brown" cx="40%" cy="34%" r="82%"><stop offset="0%" stop-color="#d5a677"/><stop offset="46%" stop-color="#95603a"/><stop offset="100%" stop-color="#4a2d1d"/></radialGradient><radialGradient id="sph-brown-b" cx="50%" cy="90%" r="42%"><stop offset="0%" stop-color="#d5a677" stop-opacity="0.34"/><stop offset="100%" stop-color="#d5a677" stop-opacity="0"/></radialGradient><radialGradient id="sph-green" cx="40%" cy="34%" r="82%"><stop offset="0%" stop-color="#a6e473"/><stop offset="46%" stop-color="#57b334"/><stop offset="100%" stop-color="#2a6a17"/></radialGradient><radialGradient id="sph-green-b" cx="50%" cy="90%" r="42%"><stop offset="0%" stop-color="#a6e473" stop-opacity="0.34"/><stop offset="100%" stop-color="#a6e473" stop-opacity="0"/></radialGradient><radialGradient id="sph-grey" cx="40%" cy="34%" r="82%"><stop offset="0%" stop-color="#dedbd6"/><stop offset="46%" stop-color="#98928a"/><stop offset="100%" stop-color="#4a4641"/></radialGradient><radialGradient id="sph-grey-b" cx="50%" cy="90%" r="42%"><stop offset="0%" stop-color="#dedbd6" stop-opacity="0.34"/><stop offset="100%" stop-color="#dedbd6" stop-opacity="0"/></radialGradient><radialGradient id="sph-orange" cx="40%" cy="34%" r="82%"><stop offset="0%" stop-color="#ffb75f"/><stop offset="46%" stop-color="#ef7d18"/><stop offset="100%" stop-color="#8f4408"/></radialGradient><radialGradient id="sph-orange-b" cx="50%" cy="90%" r="42%"><stop offset="0%" stop-color="#ffb75f" stop-opacity="0.34"/><stop offset="100%" stop-color="#ffb75f" stop-opacity="0"/></radialGradient><radialGradient id="sph-pink" cx="40%" cy="34%" r="82%"><stop offset="0%" stop-color="#ffadc7"/><stop offset="46%" stop-color="#e76890"/><stop offset="100%" stop-color="#88304e"/></radialGradient><radialGradient id="sph-pink-b" cx="50%" cy="90%" r="42%"><stop offset="0%" stop-color="#ffadc7" stop-opacity="0.34"/><stop offset="100%" stop-color="#ffadc7" stop-opacity="0"/></radialGradient><radialGradient id="sph-plum" cx="40%" cy="34%" r="82%"><stop offset="0%" stop-color="#d8abe4"/><stop offset="46%" stop-color="#9a58b6"/><stop offset="100%" stop-color="#523067"/></radialGradient><radialGradient id="sph-plum-b" cx="50%" cy="90%" r="42%"><stop offset="0%" stop-color="#d8abe4" stop-opacity="0.34"/><stop offset="100%" stop-color="#d8abe4" stop-opacity="0"/></radialGradient><radialGradient id="sph-teal" cx="40%" cy="34%" r="82%"><stop offset="0%" stop-color="#84e4d8"/><stop offset="46%" stop-color="#26a596"/><stop offset="100%" stop-color="#0f5f58"/></radialGradient><radialGradient id="sph-teal-b" cx="50%" cy="90%" r="42%"><stop offset="0%" stop-color="#84e4d8" stop-opacity="0.34"/><stop offset="100%" stop-color="#84e4d8" stop-opacity="0"/></radialGradient><radialGradient id="sph-white" cx="40%" cy="34%" r="82%"><stop offset="0%" stop-color="#ffffff"/><stop offset="46%" stop-color="#efebe5"/><stop offset="100%" stop-color="#aea79e"/></radialGradient><radialGradient id="sph-white-b" cx="50%" cy="90%" r="42%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.34"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient>' + '<radialGradient id="sph-yellow" cx="40%" cy="34%" r="82%"><stop offset="0%" stop-color="#ffe886"/><stop offset="46%" stop-color="#f3c02e"/><stop offset="100%" stop-color="#a2740a"/></radialGradient><radialGradient id="sph-yellow-b" cx="50%" cy="90%" r="42%"><stop offset="0%" stop-color="#ffe886" stop-opacity="0.34"/><stop offset="100%" stop-color="#ffe886" stop-opacity="0"/></radialGradient><radialGradient id="sph-red" cx="40%" cy="34%" r="82%"><stop offset="0%" stop-color="#ff8878"/><stop offset="46%" stop-color="#e03a2b"/><stop offset="100%" stop-color="#8a1a11"/></radialGradient><radialGradient id="sph-red-b" cx="50%" cy="90%" r="42%"><stop offset="0%" stop-color="#ff8878" stop-opacity="0.34"/><stop offset="100%" stop-color="#ff8878" stop-opacity="0"/></radialGradient>' + '<linearGradient id="gm-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.30"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' + '<linearGradient id="gm-amber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-amber)"/><stop offset="1" stop-color="var(--c-amber-shade)"/></linearGradient>' + '<linearGradient id="gm-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-blue)"/><stop offset="1" stop-color="var(--c-blue-shade)"/></linearGradient>' + '<linearGradient id="gm-clay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-clay)"/><stop offset="1" stop-color="var(--c-clay-shade)"/></linearGradient>' + '<linearGradient id="gm-cocoa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-cocoa)"/><stop offset="1" stop-color="var(--c-cocoa-shade)"/></linearGradient>' + '<linearGradient id="gm-grape" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-grape)"/><stop offset="1" stop-color="var(--c-grape-shade)"/></linearGradient><linearGradient id="gm-wine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-wine)"/><stop offset="1" stop-color="var(--c-wine-shade)"/></linearGradient><linearGradient id="gm-pine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-pine)"/><stop offset="1" stop-color="var(--c-pine-shade)"/></linearGradient><linearGradient id="gm-slate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-slate)"/><stop offset="1" stop-color="var(--c-slate-shade)"/></linearGradient>' + '<linearGradient id="gm-green" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-green)"/><stop offset="1" stop-color="var(--c-green-shade)"/></linearGradient>' + '<linearGradient id="gm-leaf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-leaf)"/><stop offset="1" stop-color="var(--c-leaf-shade)"/></linearGradient>' + '<linearGradient id="gm-navy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-navy)"/><stop offset="1" stop-color="var(--c-navy-shade)"/></linearGradient>' + '<linearGradient id="gm-plum" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-plum)"/><stop offset="1" stop-color="var(--c-plum-shade)"/></linearGradient>' + '<linearGradient id="gm-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-red)"/><stop offset="1" stop-color="var(--c-red-shade)"/></linearGradient>' + '<linearGradient id="gm-rose" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-rose)"/><stop offset="1" stop-color="var(--c-rose-shade)"/></linearGradient>' + '<linearGradient id="gm-rust" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-rust)"/><stop offset="1" stop-color="var(--c-rust-shade)"/></linearGradient>' + '<linearGradient id="gm-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-sky)"/><stop offset="1" stop-color="var(--c-sky-shade)"/></linearGradient>' + '<linearGradient id="gm-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-stone)"/><stop offset="1" stop-color="var(--c-stone-shade)"/></linearGradient>' + '<linearGradient id="gm-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-sun)"/><stop offset="1" stop-color="var(--c-sun-shade)"/></linearGradient>' + '<linearGradient id="gm-tan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-tan)"/><stop offset="1" stop-color="var(--c-tan-shade)"/></linearGradient>' + '<linearGradient id="gm-teal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-teal)"/><stop offset="1" stop-color="var(--c-teal-shade)"/></linearGradient>' + '<linearGradient id="gm-tire" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c-tire)"/><stop offset="1" stop-color="var(--c-tire-shade)"/></linearGradient>' + '<linearGradient id="gm-paper" x1="0" y1="0" x2="0" y2="1">' + '<stop offset="0" stop-color="var(--c-paper)"/><stop offset="1" stop-color="var(--c-paper-shade)"/></linearGradient>' + '<linearGradient id="gm-cream" x1="0" y1="0" x2="0" y2="1">' + '<stop offset="0" stop-color="var(--c-cream)"/><stop offset="1" stop-color="var(--c-cream-shade)"/></linearGradient>' + '</defs>';
    wrap.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + GM_DEFS + out.join('') + '</svg>';
    document.body.insertBefore(wrap, document.body.firstChild);

    /* ── OPTICAL SIZE ───────────────────────────────────────────────────────
       Owner, 2026-08-12: "they look smaller than emojis". Measured and true —
       the symbols filled 0.70 to 1.02 of their own viewBox (median 0.85) while
       Apple emoji fill 0.944 to 1.000 of the em box. Two icons at the same css
       size therefore rendered at visibly different sizes, and all of them
       smaller than the glyphs they replaced.

       Fixed here rather than by hand-editing 102 viewBoxes: each symbol is
       measured after insertion and its viewBox rewritten to a square centred
       on its own ink, sized so the dominant axis fills TARGET. Scale stays
       uniform, so nothing is stretched and a wide ticket stays wide. Doing it
       at runtime means an icon added later is corrected automatically and
       cannot drift back.

       The wrapper is width:0/overflow:hidden rather than display:none on
       purpose — a display:none subtree has no layout, so getBBox would return
       zeros and this would silently do nothing. */
    var TARGET = 0.96;
    var syms = wrap.querySelectorAll('symbol');
    for (var i = 0; i < syms.length; i++) {
      var sy = syms[i], vb = sy.viewBox.baseVal;
      if (!vb || !vb.width) continue;
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, any = false;
      var kids = sy.querySelectorAll('path,rect,circle,ellipse,line,polygon,polyline,text');
      for (var j = 0; j < kids.length; j++) {
        var b; try { b = kids[j].getBBox(); } catch (e) { continue; }
        if (!b || (!b.width && !b.height)) continue;
        any = true;
        /* getBBox is the GEOMETRY box and excludes stroke, but a stroke paints
           strokeWidth/2 OUTSIDE it on every side. Without this the viewBox is
           sized to the centreline and the outer half of every outline icon is
           cropped — `search` lost its rim and the tip of its handle. Computed
           style, not the attribute, so a width inherited from a parent <g>
           counts. */
        var pad = 0;
        try {
          var cs2 = getComputedStyle(kids[j]);
          if (cs2.stroke && cs2.stroke !== 'none') {
            var sw = parseFloat(cs2.strokeWidth);
            if (sw > 0) pad = sw / 2;
          }
        } catch (e) {}
        if (b.x - pad < x0) x0 = b.x - pad;
        if (b.y - pad < y0) y0 = b.y - pad;
        if (b.x + b.width  + pad > x1) x1 = b.x + b.width  + pad;
        if (b.y + b.height + pad > y1) y1 = b.y + b.height + pad;
      }
      if (!any) continue;
      var side = Math.max(x1 - x0, y1 - y0) / TARGET;
      if (!(side > 0)) continue;
      var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      sy.setAttribute('viewBox',
        (cx - side / 2).toFixed(3) + ' ' + (cy - side / 2).toFixed(3) + ' ' +
        side.toFixed(3) + ' ' + side.toFixed(3));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _gmSprite);
  else _gmSprite();

  /* ── THE ONE GATE FOR "does this icon key draw?" ────────────────────────────
     Two registries hold icon art: NAV_ICONS (the original flat mask markup)
     and GM_SPRITE (the coloured symbols). iconSVG() already prefers the
     sprite and never reads `entry` when it hits — but every CALL SITE used to
     gate on `NAV_ICONS[key]` alone, so a key that lives ONLY in the sprite
     resolved falsy, no icon was appended, and the group label kept the raw
     Apple emoji the icon was supposed to replace.

     That is not hypothetical and it is why this function exists: c79854ea
     (2026-08-13) added `groupIcon:'hotel'`, `icon:'hotel'` and `icon:'sparkle'`
     — all three sprite-only — and 🏨 Where to Stay shipped to the live top
     strip rendering the emoji, with the two dropdown rows drawing nothing.
     Owner: "this has been fixed and came back several times." It comes back
     because adding art to the sprite is the normal way to add an icon, and the
     failure is SILENT — no error, no blank box, just the emoji showing through.

     So: resolve through here, never through a bare NAV_ICONS[...] truthiness
     test. A sprite-only key returns a truthy placeholder whose value is never
     rendered (iconSVG returns the <use> before it looks at `entry`).
     Enforced by brain_check.check_toolbar_icon_keys_resolve. */
  var SPRITE_ONLY = '<!--sprite-->';
  function navIcon(key) {
    if (!key) return null;
    return NAV_ICONS[key] || (GM_SPRITE[key] ? SPRITE_ONLY : null);
  }

  function iconSVG(entry, size, key) {
    /* Coloured symbol wins when one exists. The <use> inherits nothing from the
       old fill="var(--rust)" because every shape inside the symbol carries its
       own fill — which is the whole point. */
    if (key && GM_SPRITE[key]) {
      /* viewBox is a plain square, NOT the symbol's own box: the symbol carries
         its normalised viewBox and maps itself into whatever viewport <use>
         gets. A non-square outer box here would letterbox the icon. */
      var _s = Math.round(size * 1.2);
      return '<svg class="gm-ic" width="' + _s + '" height="' + _s +
             '" viewBox="0 0 24 24" aria-hidden="true"><use href="#gm-i-' + key + '"/></svg>';
    }
    var stroked = entry && typeof entry === 'object' && entry.stroke;
    var markup  = stroked ? entry.m : entry;
    var attrs   = stroked
      ? 'fill="none" stroke="var(--rust,#b85c2a)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"'
      : 'fill="var(--rust,#b85c2a)"';
    return '<svg viewBox="' + (NAV_VIEWBOX[key] || '0 0 24 24') + '" width="' + size + '" height="' + size + '" ' + attrs +
           ' aria-hidden="true">' + markup + '</svg>';
  }

  /* Write `text` into `el` as a label span, plus the row's SVG icon when the
     entry carries one and a NEW badge when in-window. */
  function setEntryLabel(el, text, entry, badgeClass) {
    var ico   = entry && navIcon(entry.icon);
    var isNew = isNewEntry(entry);
    if (!ico && !isNew) { el.textContent = text; return; }
    if (ico) {
      el.classList.add('tb-has-ico');
      var is = document.createElement('span');
      is.className = 'tb-ico';
      is.innerHTML = iconSVG(ico, 15, entry.icon);
      el.appendChild(is);
    }
    var lb = document.createElement('span');
    lb.className = 'tb-entry-label';
    lb.textContent = text;
    el.appendChild(lb);
    if (isNew) {
      el.classList.add('tb-has-new');
      var nb = document.createElement('span');
      nb.className = badgeClass;
      nb.textContent = 'new';
      el.appendChild(nb);
    }
  }

  /* ── Links ─────────────────────────────────────────────────────────────── */
    /* 2026-08-14 — OWNER-DIRECTED: Guides · Before You Go · Best Of · Maps · Contact.
     Everything else reaches through the home page, which carries a section for
     every area of the site. Best Of keeps its dropdown (34 categories); the rest
     are plain links.

     Guide path tests in this file are case-INSENSITIVE — see isRealGuide. The
     Guides/ -> guides/ rename left a regex literal and several indexOf('Guides')
     lookups behind, so isRealGuide was false on every guide page and silently
     removed the weather strip, the info pills, the Trip Overview carousel and the
     SHOW ONLY chips. Never re-pin these to one capitalisation. */
  var ITEMS = [
    /* "Where to Go", not "Guides" (owner 2026-08-14). The four planning tabs now
       read as one set — Where to Go · When to Go · Where to Stay · Before You Go
       — naming the question the reader has rather than the kind of document they
       will get. The href is unchanged; only the label moved. */
    { href: base + 'guides/index.html', text: 'Where to Go', icon: 'orbited-globe' },
    /* OWNER-DIRECTED 2026-08-14, order: Guides · When to Go · Where to Stay ·
       Before You Go · Maps · Contact. It follows the order a trip is actually
       decided in — when to travel, then where to sleep, then what to sort out
       before leaving — rather than the order the tabs happened to be added. */
    { href: base + 'when-to-go/', text: 'When to Go', icon: 'sun-clear' },
    /* OWNER-DIRECTED 2026-08-14: Where to Stay, a dropdown of the six lodging
       pages previously reachable only from the landing page's Where to Stay
       column. SIXTH top-strip entry and the first dropdown since the bar was cut
       back to five plain links — both deliberate, both the owner's call.
       TOOLBAR_ITEMS_LOCK moved in the same pass. */
    /* A dropdown entry is a different shape from a tab: the label comes from
       `group` (with `groupShort` for the strip) and the icon from `groupIcon`.
       `text`/`icon` are the TAB fields and are ignored here — an entry that
       carries them instead throws in the hamburger loop, which reads
       item.group.replace(...), and the whole toolbar renders as the no-JS
       fallback on every page. */
    { href: base + 'before-you-go/', text: 'Before You Go', icon: 'luggage' },
    { group: 'Best Of', groupIcon: 'trophy', children: [
      { href: base + 'best-of/amusement-parks/', text: 'Amusement Parks' },
      { href: base + 'best-of/animal-encounters/', text: 'Animal Encounters' },
      { href: base + 'best-of/aquariums/', text: 'Aquariums' },
      { href: base + 'best-of/architecture/', text: 'Architecture' },
      { href: base + 'best-of/art-museums/', text: 'Art Museums' },
      { href: base + 'best-of/beaches/', text: 'Beaches' },
      { href: base + 'best-of/castles/', text: 'Castles' },
      { href: base + 'best-of/cathedrals/', text: 'Cathedrals' },
      { href: base + 'best-of/caves/', text: 'Caves' },
      { href: base + 'best-of/gardens/', text: 'Gardens' },
      { href: base + 'best-of/hard-to-reach-places/', text: 'Hard to Reach Places' },
      { href: base + 'best-of/hot-springs/', text: 'Hot Springs' },
      { href: base + 'best-of/islands/', text: 'Islands' },
      { href: base + 'best-of/kids-friendly-places/', text: 'Kids Friendly Places' },
      { href: base + 'best-of/kids-museums/', text: 'Kids Museums' },
      { href: base + 'best-of/lakes/', text: 'Lakes' },
      { href: base + 'best-of/most-luxurious-hotels/', text: 'Luxurious Hotels' },
      { href: base + 'best-of/mountains-and-rock-formations/', text: 'Mountains & Rock Formations' },
      { href: base + 'best-of/museums/', text: 'Museums' },
      { href: base + 'best-of/national-parks-by-country/', text: 'National Parks' },
      { href: base + 'best-of/natural-phenomena/', text: 'Natural Phenomena' },
      { href: base + 'best-of/observation-decks/', text: 'Observation Decks' },
      { href: base + 'best-of/resorts/', text: 'Resorts' },
      { href: base + 'best-of/safari/', text: 'Safari' },
      { href: base + 'best-of/scuba-diving/', text: 'Scuba Diving' },
      { href: base + 'best-of/ski-resorts/', text: 'Ski Resorts' },
      { href: base + 'best-of/surfing/', text: 'Surfing' },
      { href: base + 'best-of/ultra-luxurious-resorts/', text: 'Ultra Luxurious Resorts' },
      { href: base + 'best-of/unesco-sites/', text: 'UNESCO Sites' },
      { href: base + 'best-of/unique-hotels/', text: 'Unique Hotels' },
      { href: base + 'best-of/unique-museums/', text: 'Unique Museums' },
      { href: base + 'best-of/volcanoes/', text: 'Volcanoes' },
      { href: base + 'best-of/wine-regions/', text: 'Wine Regions' },
      { href: base + 'best-of/wonders-of-the-world/', text: 'Wonders of the World' }
    ] },
    { href: base + 'maps/world/', text: 'Maps', icon: 'folded-map' },
    { href: 'mailto:contact@guidemydays.com?subject=Guide%20My%20Days', text: 'Contact', icon: 'faq-book' }  /* owner 2026-08-14: opens the reader's own mail app rather than scrolling
     to the form. NOT base + ... — a mailto must not be depth-prefixed. */
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
    /* NAV SWAP IS WIDTH-ONLY — and deliberately so, unlike every other
       breakpoint on this site (owner rule 2026-08-10, § 42). The page LAYOUT
       holds on a narrowed desktop window because a card or a paragraph can
       simply be narrower. The tab row cannot: 14 tabs need ~1300px, which is
       exactly why this breakpoint is pinned at 1260 for the 1280px MacBook Air.
       Three ways of keeping the tabs below that were measured and all were worse
       than the hamburger — (1) letting .tb wrap drops the theme toggle to a
       centred second line under the tabs; (2) scrolling the row horizontally
       works until the active-tab scrollLeft centering runs and the bar shows a
       two-letter fragment of one tab; (3) wrapping .tb-links resolves the row to
       min-content, one tab per line, a 476px-tall wall of tabs at every width
       below 1260. So the hamburger stays here on a narrow desktop window. It is
       responsive nav, not the mobile site: the page around it is still desktop. */
    '@media (max-width: 1260px) and (pointer: coarse){' +
      /* Opaque, not transparent (owner rule 2026-08-15). This rule dates from
         when the mobile bar sat in normal flow, where transparent simply
         inherited the page ground and cost nothing. The bar is position:fixed
         now, so a transparent ground let the page scroll THROUGH the wordmark
         and the two icons — verified at 393px, the guide's prose ran straight
         across the logo. Same token the .tb rule above uses, and it carries a
         dark-mode value, so the bar follows the theme. */
      '.tb{background:var(--c-page-bg,#f5f4f0)!important}' +
      '.tb a,.tb a:visited,.tb-ddbtn,.tb-ham{color:#b85c2a!important}' +
      '.tb-theme-toggle{border-color:#b85c2a!important;background:transparent!important;color:#b85c2a!important}' +
      '.tb-theme-toggle:hover{border-color:#b85c2a!important;background:transparent!important}' +
      /* padding-top 3px -> 14px (owner rule 2026-08-15: "move the title guide my
         days lower in mobile"). The wordmark is absolutely positioned with no
         `top`, so its vertical seat IS this padding — it sat hard against the
         top of the bar, above the optical centre of the hamburger and the theme
         toggle that flank it. 14px drops it onto their line. The image renders
         ~37px tall at its 150-168px cap, so 14 + 37 = 51px still clears the
         bar's 56px min-height and the bar does not grow. */
      '.tb a.tb-brand-logo{position:absolute;left:0;right:0;width:auto;padding:14px 0 0;flex:none;pointer-events:none;text-align:center}' +
      '.tb a.tb-brand-logo img{max-width:168px;margin:0 auto;display:inline-block;pointer-events:auto}' +
    '}' +
    '@media (max-width: 600px) and (pointer: coarse) {.tb a.tb-brand-logo img{max-width:150px}}' +
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
    /* The gutter MUST equal the .tb-links tab gap — Cleanliness rule: every space
   in the bar is identical (edge to first tab, tab to tab, last tab to the
   theme toggle). Changed with the gap on 2026-08-11; if you retune one,
   retune both or check_toolbar_font_size_unified hard-fails. */
    /* --tb-gap is THE ONE number for horizontal space in the bar, and
       --tb-ring-off is DERIVED FROM IT so the selected ring can never be wider
       than the space it has. Owner 2026-08-13, on the Guides ring intersecting
       the open Before-You-Go ring: "are these supposed to overlap?" — no.
       A ring stands (offset + 1.5px width) out from its tab, so two adjacent
       rings need TWICE that between them. At a fixed 5px offset they needed
       13px and the gap is 5-11px, so any active tab next to an open dropdown
       drew two intersecting rings. offset = gap/2 - 1.75px makes the pair
       always land 0.5px short of touching, at every width: gap 5 -> 0.75px
       offset, 7.35 -> 1.9px, 11 -> 3.75px. The ring simply uses the room that
       exists instead of a number picked at one width.
       Both live on .tb-inner: it uses --tb-gap for its own gutter, .tb-links
       inherits it for the column gap, and the tabs inherit --tb-ring-off. Keep
       them here together — the gutter and the tab gap must stay equal
       (check_toolbar_font_size_unified), and now the ring follows for free. */
    '.tb-inner{flex:0 1 auto;min-width:0;' +
      /* 2026-08-14: the 5-11px gap was tuned when fourteen tabs had to fit a bar
   with no spare width. There are five now, so the tabs get real air. */
      '--tb-gap:clamp(8px,1.5vw,24px);--tb-ring-off:calc(var(--tb-gap)/2 - 1.75px);' +
      'padding-left:var(--tb-gap);padding-right:var(--tb-gap)}' +
    /* NARROW DESKTOP ONLY — added 2026-08-10 with the desktop-holds change, and
       deliberately NOT on the base .tb-inner rule, which Cleanliness Rule 582
       keeps free of overflow ("the old sliding toolbar"). Rule 582 is about the
       row sliding at NORMAL desktop width; at ≥1260px it still fits exactly as
       before and nothing here applies. Below that the state is new: the row is
       built for 1260px and the hamburger used to take over, so nothing had ever
       asked what happens at 700px on a mouse — measured answer, it pushed the
       whole PAGE sideways by ~870px (content fit fine, the bar did not). Here it
       scrolls inside itself instead. Safe for the flyouts: .tb-menu is appended
       to <body> and position:fixed precisely so an overflow clip on this row
       cannot cut it off (see the .tb-menu note below). Scrollbar hidden — a
       visible bar under the tabs reads as a rule line. */
    '@media (max-width: 1259px) and (pointer: fine){' +
      /* THE VERTICAL PADDING IS WHAT KEEPS THE TERRACOTTA RING WHOLE — owner
         2026-08-13: "terracota ring should never disappear."
         `overflow-x:auto` FORCES overflow-y to compute as a non-visible value;
         that is CSS, not a choice. An outline is painted OUTSIDE the border
         box, so the moment this rule applied, the selected tab's ring got its
         top and bottom sliced off and rendered as two side arcs — "( Guides )".
         It only bit after the ring became an outline (it used to be a border,
         which lives inside the box and cannot clip). Reproduced and fixed by
         measurement: ring spans 6.5px beyond the tab (offset 5 + width 1.5)
         against 2.8px of slack in the row, so the scroll box needs ~4px; 7px
         is given. VERTICAL ONLY — it costs no horizontal width, so the
         one-row fit above is untouched. Never remove this padding while the
         ring is an outline, and never re-add overflow here without it. */
      '.tb-inner{max-width:100%;overflow-x:auto;overflow-y:hidden;' +
        'padding-top:7px;padding-bottom:7px;' +
        'scrollbar-width:none;-ms-overflow-style:none}' +
      '.tb-inner::-webkit-scrollbar{display:none}' +
    '}' +
    /* Flex row — fills full width, edge-to-edge. No scrolling, no gap. */
    /* OWNER 2026-08-10: tabs pushed LEFT with one EQUAL gap between every pair.
       Was justify-content:space-between + gap:0, which spread the row edge to
       edge and made each gap a different width (they absorbed the leftover
       space in proportion to nothing). With the site title gone the row no
       longer needs to fill the bar, so: flex-start + a fixed gap, and
       width:auto so the row is exactly as wide as its tabs. */
    /* GAP — owner 2026-08-11, "these need to spread out more". Raised from
       clamp(4px,0.42vw,6px), which was itself shaved on 2026-08-09 to stop
       Recommended wrapping. The shave was aimed at the wrong constraint: the
       row is shrink-to-fit (.tb-inner is flex:0 1 auto) inside a .tb that is
       justify-content:center, so the leftover space is not the row's to run
       out of — at 1439px the tabs measured 1317.5px inside a 1439px bar, 121px
       of it unused. The gap grows into that instead of the tabs shrinking.
       CEILING IS SET BY THE **OPEN** STATE, NOT THE CLOSED ONE. A tab whose
       dropdown is open gains the active ring — padding 4px 12px against the
       base 2px 2px, plus a 1.5px border — which measures +23px on the row. The
       first cut of this rule budgeted 14px of gap from the closed width, fit
       with 31px to spare, and then wrapped Recommended onto a second line the
       moment its own flyout opened (owner: "when i select this recommended
       moves below"). That is the same wrap the 2026-08-09 shave was chasing.
       Measured at 1439px: tabs 1242px closed, 1265px open, against 1419px of
       usable bar. 1265 + 13 x 11 = 1408, which clears it with the flyout open.
       Re-measure WITH A DROPDOWN OPEN before touching the 11px cap. */
    '.tb-links{display:flex;flex-wrap:nowrap;width:auto;margin:0;' +
      'column-gap:var(--tb-gap);align-items:center;justify-content:flex-start;min-width:0}' +
    /* Between the hamburger (<=1260px) and ~1500px the desktop tab row does not
       fit: it measures 1414px, plus the theme toggle that is now its last tab.
       Let it wrap. The toggle is inside .tb-links, so it wraps WITH the tabs
       rather than dropping to a line of its own — owner rule 2026-08-10, "pin
       in the page as if it was the last tab and when we reduce it will behave
       like the rest". Two lines of tabs beats a row that pushes the whole page
       sideways, and beats a horizontal scroller (the active-tab scrollLeft
       centering then shows a fragment of one tab and nothing else). Nothing
       here applies at >=1500px, where the row still sits on one line as shipped,
       and .tb-inner keeps no overflow, so Cleanliness Rule 582 is untouched. */
    /* BREAKPOINT MOVED 1499 -> 1365 (owner 2026-08-13: "the toolbar need to
       resize and fit in the screen of a regular notebook"). It fits now because
       the row is 23px narrower and, crucially, NO LONGER CHANGES WIDTH WITH
       STATE — see the two selected-state rules below. Measured one row, closed
       AND with a dropdown open, at 1366 / 1440 / 1512 / 1600.
       Below 1366 it still wraps, and the gap RELAXES BACK to the roomy clamp:
       once the row has wrapped there is spare width by definition, so holding
       it tight would look cramped for nothing. 1280 cannot be reached at any
       gap — the 14 tabs measure 1260.9px with the gaps at ZERO, so the fix
       there is narrower tabs, not less space between them. */
    '@media (max-width: 1365px) and (pointer: fine){' +
      /* row-gap 6 -> 15: same ring, other axis. The selected tab's outline
         reaches 6.5px above and below it, so two stacked rows only 6px apart
         put one row's ring straight through the row beneath it. 15px clears
         both rings with room to spare. Vertical only — no width cost. */
      '.tb-links{flex-wrap:wrap;row-gap:15px;justify-content:center;column-gap:var(--tb-gap)}' +
      /* Re-point --tb-gap rather than restating the value in three places: the
         gutter, the column gap AND the ring offset all follow it, so the ring
         widens back out with the roomier wrapped spacing automatically. */
      '.tb-inner{--tb-gap:clamp(8px,1.2vw,20px);padding-left:var(--tb-gap);padding-right:var(--tb-gap)}' +
    '}' +
    /* Desktop nav links — white text on gradient bar.
       Colours use !important so a page's own `a{}` / `a:visited{}` rules
       (e.g. guide-style.css link colours) can NEVER bleed into the shared bar. */
    '.tb a,.tb a:visited{font-size:14px;font-weight:600;color:#7a3b1e!important;text-decoration:none;padding:8px 18px;border:1px solid transparent;border-radius:999px;' +
      'border:none;border-radius:4px;background:transparent;white-space:nowrap;flex-shrink:0;' +
      'transition:color .15s,background .15s}' +
    '.tb a:hover{color:#7a3b1e!important;background:transparent}' +
    /* SELECTED RING IS AN OUTLINE, NOT A BORDER — and that is a LAYOUT rule,
       not a style one. A border plus padding:4px 12px against the base
       padding:2px 2px makes the selected tab ~23px WIDER than the same tab
       unselected, so the row's total width depended on WHICH PAGE YOU WERE ON
       and, worse, changed the instant you opened a dropdown (see the matching
       rule below). That is what pushed Recommended onto a second line, and it
       is why re-tuning the gap kept "fixing" it and kept coming back — the gap
       was never the variable. An outline is painted outside the box and takes
       no space at all, so the row is now exactly one width in every state.
       .tb-ddbtn.tb-active below already worked this way; these two now match
       it. Never put this back to border+padding. */
    '.tb a.tb-active{box-sizing:border-box;display:inline-flex;align-items:center;padding:8px 18px;color:#7a3b1e!important;background:#fdf4ed;border:1px solid rgba(184,92,42,0.55);border-radius:999px;font-weight:600;line-height:1.2}' +
    /* Dropdown group (e.g. 🚆 Trains) — parent button + absolute flyout menu */
    '.tb-dd{position:relative;display:inline-flex;flex-shrink:0}' +
    '.tb-ddbtn{display:inline-flex;align-items:center;gap:5px;font-size:14px;font-weight:600;color:#7a3b1e!important;' +
      'padding:8px 18px;border:1px solid transparent;border-radius:999px;background:transparent;white-space:nowrap;' +
      'cursor:pointer;font-family:inherit;transition:color .15s,background .15s}' +
    '.tb-ddbtn:hover{color:#7a3b1e!important;background:transparent}' +
    '.tb-ddbtn.tb-active{box-sizing:border-box;display:inline-flex;align-items:center;color:#7a3b1e!important;background:#fdf4ed;border:1px solid rgba(184,92,42,0.55);border-radius:999px;font-weight:600;line-height:1.2}' +
    /* An OPEN dropdown gets the same terracotta ring as the active tab, so the
   menu is visibly attached to the tab it came from. It only changed text
   colour before, which was invisible against the other tabs. */
    /* OUTLINE, for the same reason as .tb a.tb-active above — this one is the
       direct cause of the owner's "when i select this recommended moves below".
       Opening a dropdown grew its button by ~23px, which was enough to reflow
       the whole row on the click. Measured: closed 1283.9px / open 1306.9px
       before, 1260.9px / 1260.9px after. */
    '.tb-dd.tb-open>.tb-ddbtn:not(.tb-active){box-sizing:border-box;display:inline-flex;align-items:center;color:#7a3b1e!important;background:transparent;'+
      'outline:1.5px solid rgba(184,92,42,0.85);outline-offset:5px;border-radius:14px}' +
    '.tb-caret{font-size:8px;line-height:1;transition:transform .15s}' +
    '.tb-dd.tb-open .tb-caret{transform:rotate(180deg)}' +
    /* Split dropdown — one-click link + small caret toggle */
    /* Menu is appended to <body> (not inside the overflow-clipped scroll row) and
       positioned with fixed coords on open — otherwise .tb-inner's overflow-x:auto
       forces overflow-y to clip and the flyout gets cut off. */
    '.tb-menu{position:fixed;transform:translateX(-50%);' +
      'background:#fff;border:1px solid #e6e2da;border-radius:8px;box-shadow:0 6px 22px rgba(0,0,0,.13);' +
      'padding:4px 4px 12px;display:none;flex-direction:column;gap:0;min-width:196px;z-index:1000;' +
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
    /* Row carrying an SVG icon (NAV_ICONS) — icon, then label, then any NEW
       badge. The label takes the free space so the badge stays hard right,
       exactly as it does on an icon-less row. */
    '.tb-menu a.tb-has-ico{display:flex;align-items:center;gap:9px}' +
    '.tb-menu a.tb-has-ico .tb-entry-label{flex:1 1 auto;min-width:0}' +
    /* A row with BOTH an icon and a NEW badge must keep the icon→label gap at
       9px like every other row — .tb-has-new's own gap:12px would otherwise
       win on source order and step those two labels to the right. The label's
       flex:1 is what pushes the badge to the right edge, not space-between. */
    '.tb-menu a.tb-has-ico.tb-has-new{gap:9px;justify-content:flex-start}' +
    '.tb a.tb-has-ico{display:inline-flex;align-items:center;gap:5px}' +
    /* 2026-08-14 OWNER: no icons on the bar. The emoji/SVG mark beside each tab
   was the last thing making the nav look dated, and with five plain words
   the label carries it alone. Hidden rather than removed from the data, so
   groupIcon stays intact for the dropdown headers and the hamburger. */
    '.tb .tb-ico,.tb-ddbtn .tb-ico{display:none!important}' +
    '.tb-ico{flex-shrink:0;display:inline-flex;align-items:center;line-height:0}' +
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
    '@media (max-width: 1260px) and (pointer: coarse){.tb-progress{display:none}}' +
    /* Hide ham elements on desktop — mobile @media shows them */
    '.tb-ham{display:none}.tb-ham-label{display:none}.tb-ham-menu{display:none}' +
    /* Mobile/tablet: hamburger menu replaces the chip row below this width.
       LOCKED AT 1260px — do not raise it. A MacBook Air 13" is a 1280px CSS
       viewport, so anything above 1260 hides the desktop nav on that machine
       (check_toolbar_font_size_unified hard-fails; Rule 582). Raising it to
       1400px for the 14th tab was tried on 2026-08-10 and the check caught it.
       The row must be made to FIT 1260px instead — hence the tab gap cut from
       18px to 10px in the same pass. */
    '@media (max-width: 1260px) and (pointer: coarse){' +
      /* STICKY ON MOBILE (owner rule 2026-08-15): "in mobile make the menu and
         title available in all pages ... with dark mode toggle." The bar holds
         all three — theme toggle far left, wordmark centred, hamburger right —
         and it used to be position:relative, so it scrolled off the top and a
         reader four screens into a guide had no menu, no title and no way to
         switch theme without scrolling all the way back up. Sticky keeps the
         whole set on screen on EVERY page, since toolbar.js mounts the bar on
         every page of the site.
         The background MUST be opaque here — on the relative bar transparent
         was free, but a sticky bar with no ground lets the page's own content
         scroll through the wordmark and the icons. --c-page-bg is the site
         ground token and is redefined in both theme blocks above, so the bar
         follows dark mode instead of pinning a light strip over a dark page.
         The hamburger panel is position:fixed at top:64px and clears this. */
      /* Owner rule 2026-08-15: mobile toolbar scrolls with the page (not fixed/sticky). */
      '.tb{position:relative;z-index:1002;padding:15px 0 14px;display:flex;align-items:center;justify-content:space-between;min-height:56px;border-bottom:none;background:var(--c-page-bg,#f5f4f0);box-shadow:none}' +
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
      '.tb-ham-menu a.tb-has-ico{display:flex;align-items:center;gap:10px}' +
      '.tb-ham-menu a.tb-has-ico .tb-entry-label{flex:1 1 auto;min-width:0}' +
      '.tb-ham-menu a.tb-has-ico.tb-has-new .tb-entry-label{flex:0 0 auto}' +
      '.tb-ham-menu a:active{background:rgba(0,0,0,.04)}' +
      '.tb-ham-menu .tb-ham-sep{height:1px;background:#e6e2da;margin:4px 24px}' +
      '.tb-ham-menu .tb-ham-hdr{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9e9688;padding:6px 24px 2px}' +
    '}' +
    /* ── Theme toggle button ─────────────────────────────────────────────── */
    '@media (pointer: fine){.tb-theme-toggle{position:absolute;top:10px;right:16px;margin-right:0}}' +
    '.tb-theme-toggle{flex-shrink:0;margin-left:0;margin-right:10px;width:40px;height:40px;border-radius:50%;' +
      'border:1.5px solid rgba(122,59,30,.55);background:transparent;color:#7a3b1e;' +
      'cursor:pointer;display:flex;align-items:center;justify-content:center;' +
      'transition:background .15s,border-color .15s;outline:none;padding:0;' +
      '-webkit-appearance:none;font-family:inherit;line-height:0}' +
    '.tb-theme-toggle:hover{background:transparent;border-color:rgba(122,59,30,.85)}' +
    '.tb-theme-toggle:active{transform:scale(.93)}' +
    '@media (max-width: 1260px) and (pointer: coarse){.tb-theme-toggle{order:1;margin-left:0;margin-right:14px}}' +
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
    /* .title-hotel-request uses var(--c-brand) which resolves automatically in dark mode. */
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
    'html[data-theme="light"] .nearby-guide-pill{background:#ffffff;color:#8a6c1a;border-color:#c8a44a}' +
    /* ── Dark-mode nav-link override — #7a3b1e (dark rust) is low-contrast on dark bg; shift to brand gold ── */
    '@media (prefers-color-scheme:dark){' +
      '.tb a,.tb a:visited,.tb a:hover,.tb a.tb-active{color:#c8a060!important}' +
      '.tb-ddbtn,.tb-ddbtn:hover,.tb-ddbtn.tb-active{color:#c8a060!important}' +
      '.tb-dd.tb-open>.tb-ddbtn:not(.tb-active){color:#c8a060!important}' +
    '}' +
    'html[data-theme="dark"] .tb a,' +
    'html[data-theme="dark"] .tb a:visited,' +
    'html[data-theme="dark"] .tb a:hover,' +
    'html[data-theme="dark"] .tb a.tb-active{color:#c8a060!important}' +
    'html[data-theme="dark"] .tb-ddbtn,' +
    'html[data-theme="dark"] .tb-ddbtn:hover,' +
    'html[data-theme="dark"] .tb-ddbtn.tb-active{color:#c8a060!important}' +
    'html[data-theme="dark"] .tb-dd.tb-open>.tb-ddbtn:not(.tb-active){color:#c8a060!important}'
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
      var labelText = item.groupShort || item.group;
      /* groupIcon (OWNER-DIRECTED 2026-08-11): the tab draws an SVG from
         NAV_ICONS instead of its leading emoji. Deliberately a SEPARATE field
         from `group` — the canonical group string keeps its emoji, so the
         dropdown header, the hamburger and TOOLBAR_ITEMS_LOCK are all
         untouched and only the visible top-strip button changes. The emoji is
         stripped from the rendered label here, not from the data. */
      var gico = navIcon(item.groupIcon);
      if (gico) {
        labelText = labelText.replace(/^[^\x00-\x7E\s]+️?\s*/, '').trim() || labelText;
        var gs = document.createElement('span');
        gs.className = 'tb-ico';
        gs.innerHTML = iconSVG(gico, 13, item.groupIcon);
        btn.appendChild(gs);
      }
      lab.textContent = labelText;
      var car = document.createElement('span');
      car.className = 'tb-caret';
      car.textContent = '▾';
      btn.appendChild(lab);
      btn.appendChild(car);

      var menu = document.createElement('div');
      menu.className = 'tb-menu';
      var groupActive = false;
      item.children.forEach(function (ch) {
        /* A null child is a SEPARATOR. `null` has meant a divider at the top
           level of ITEMS since the bar was built, but neither child loop handled
           it — both went straight to ch.href, so a single null threw here and
           aborted the whole render, leaving #toolbar-mount empty and every page
           showing the CSS no-JS fallback. */
        if (ch === null) {
          var hr = document.createElement('div');
          hr.className = 'tb-menu-sep';
          menu.appendChild(hr);
          return;
        }
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
        var menuTop = Math.round(r.bottom + 6);
        menu.style.left      = Math.round(cx) + 'px';
        menu.style.top       = menuTop + 'px';
        menu.style.maxHeight = Math.max(120, window.innerHeight - menuTop - 16) + 'px';
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
    /* A flat top-strip tab (no dropdown) carries its mark the same way a group
       does — icon: resolves through NAV_ICONS and the emoji is stripped from
       the rendered label, never from the data. */
    var fico = navIcon(item.icon);
    if (fico) {
      a.classList.add('tb-has-ico');
      var fs = document.createElement('span');
      fs.className = 'tb-ico';
      fs.innerHTML = iconSVG(fico, 13, item.icon);
      a.appendChild(fs);
      var fl = document.createElement('span');
      fl.textContent = (item.text || '').replace(/^[^\x00-\x7E\s]+️?\s*/, '').trim() || item.text;
      a.appendChild(fl);
    } else {
      a.textContent = item.text;
    }
    var cls = [];
    if (item.guides) cls.push('tb-guides');
    if (item.href.split('/').pop() === curr) cls.push('tb-active');
    /* add, never assign — a.className would wipe tb-has-ico set above and
       the icon would lose its flex+gap on exactly the ACTIVE tab */
    cls.forEach(function (c) { a.classList.add(c); });
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
  /* 2026-08-14: case-INSENSITIVE. The folder was renamed Guides/ -> guides/ so
     guidemydays.com/guides resolves, and the blanket path rewrite could not see
     these — a regex literal and three indexOf('Guides') lookups. isRealGuide
     therefore evaluated false on EVERY guide page, which silently removed the
     weather strip, the language/cost/plug/season pills, the Trip Overview
     carousel header and the SHOW ONLY chips. Matching either case means a
     future rename cannot reintroduce this. */
  var isRealGuide = /\/guides\//i.test(location.pathname) && location.pathname.indexOf('guides_index') < 0;
  var isReadAbout = /\-read-about\.html$/.test(location.pathname);
  var isStopsMap = /\-stops-map\.html$/.test(location.pathname);
  var _raCityName = '';
  if (isReadAbout) {
    var _raParts = location.pathname.split('/');
    var _raGi = _raParts.findIndex(function (x) { return x.toLowerCase() === 'guides'; });
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
      var _gi = _pathParts.findIndex(function (x) { return x.toLowerCase() === 'guides'; });
      if (_gi >= 0 && _pathParts[_gi + 1]) {
        cityHash = '#' + encodeURIComponent(_pathParts[_gi + 1].replace(/-/g, ' '));
      }
    }
    if (cityHash) {
      var _navBYG = inner.querySelector('a[href*="Before-You-Go.html"]');
      if (_navBYG) _navBYG.href += cityHash;
    }

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
  /* The brand title goes to the site's FRONT DOOR, which since 2026-08-14 is the
     landing page at the root — not the guides listing. Every other jump in this
     file that meant "the guides listing" moved to guides/index.html; this one
     deliberately did not. Toolbar.html § 4. */
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

    /* WHERE THE TOGGLE LIVES — owner rule 2026-08-10: "pin in the page as if it
       was the last tab and when we reduce it will behave like the rest."

       Desktop nav showing: the toggle is the LAST CHILD OF .tb-links, i.e. a tab.
       It was previously a sibling of .tb-inner, which put it in .tb's wrap
       context on its own. The tab row's natural width is 1414px (measured), so
       on any window under ~1500px the row filled line 1 and the toggle dropped
       to a centred second line beneath it — the jump the owner saw, and it was
       reachable on every ordinary laptop, not just a narrowed window. As a tab
       it wraps, scrolls and reflows with the others and can never separate.

       Hamburger showing (<=1260px): moved back to a direct child of .tb, because
       .tb-inner is display:none there and the toggle would vanish with it. That
       is also the shipped mobile design — hamburger left, wordmark centre,
       sun far right (.tb-theme-toggle{order:1} in the 1260 block).

       Re-parented live on a matchMedia change so dragging a window across the
       breakpoint lands it in the right place without a reload. */
    /* Must mirror the CSS nav-swap query EXACTLY, pointer condition included.
       Without `and (pointer: coarse)` this re-parented the toggle out of the
       tab row on a narrow DESKTOP window, where the hamburger no longer
       appears — the toggle ended up back beside a wordmark with no menu. */
    var _navMq = window.matchMedia('(max-width: 1260px) and (pointer: coarse)');
    function placeThemeToggle() {
      var host = bar;   /* always the bar — pinned top-right on desktop by CSS */
      if (themeBtn.parentNode !== host) host.appendChild(themeBtn);
    }
    bar.appendChild(themeBtn);
    placeThemeToggle();          /* .tb-links is already in the DOM by now */
    if (_navMq.addEventListener) _navMq.addEventListener('change', placeThemeToggle);
    else if (_navMq.addListener) _navMq.addListener(placeThemeToggle);
    window.TVE = window.TVE || {};
  /* Shared with index.html's filter chips (and, next, the guides) so one mark
     never has two drawings. */
  window.TVE.icon = function (key, size) {
    var e = navIcon(key); return e ? iconSVG(e, size || 15, key) : '';
  };
    window.TVE.placeThemeToggle = placeThemeToggle;
  })();

  var hamMenu = document.createElement('div');
  hamMenu.className = 'tb-ham-menu';
  /* No inline `bar.style.position = 'relative'` here. It used to be set so the
     absolutely-positioned mobile wordmark had something to anchor to, but an
     inline style outranks every stylesheet rule — and on 2026-08-15 the mobile
     bar became position:sticky, which that one line would have silently
     cancelled on every page. The base .tb rule is already position:relative for
     desktop, and a sticky box is itself a containing block for abspos children,
     so the anchor holds in both states. Never re-add it. */

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
        if (ch === null) {          /* separator — see the desktop loop above */
          var mhr = document.createElement('div');
          mhr.className = 'tb-ham-sep';
          hamMenu.appendChild(mhr);
          return;
        }
        var a = document.createElement('a');
        a.href = ch.href;
        setEntryLabel(a, ch.full || ch.text, ch, 'tb-ham-new');
        if (ch.href.split('/').pop() === curr) a.classList.add('tb-active');
        hamMenu.appendChild(a);
      });
      firstItem = false;
    } else {
      if (!firstItem) {
        var sep2 = document.createElement('div');
        sep2.className = 'tb-ham-sep';
        hamMenu.appendChild(sep2);
      }
      var a2 = document.createElement('a');
      a2.href = item.href;
      a2.textContent = item.full || item.text;
      if (item.href.split('/').pop() === curr) a2.classList.add('tb-active');
      hamMenu.appendChild(a2);
      firstItem = false;
    }
  });

  /* ── Best Of + Also-on-this-site sections — REMOVED (owner rule 2026-08-15)
     The hamburger used to append two hand-maintained lists after the ITEMS
     loop: a 34-row "Best Of" block and an 11-row "Also on this site" block,
     plus a "My Trips"/"Travel Stats" pair injected under Guides and seven
     region rows under Maps. All of it is gone. Owner: "the menu should have
     only the stuff on the toolbar as of now remove the rest."
     THE MENU IS NOW EXACTLY ITEMS — nothing hand-added, nothing to keep in
     sync, and a new page appears in the menu the moment the owner puts it in
     the toolbar. That is the whole point: the two lists were separate copies
     of the navigation and drifted from it.
     Every page they used to reach is still reachable from the landing page,
     the hub the five-link bar delegates to. Do not re-add either list, and
     never rebuild a bestOfPages/alsoPages array here.
     check_mobile_menu_sections and check_mobile_trips_injection were retired
     in the same pass; check_best_of_toolbar_coverage now reads ITEMS and the
     landing page instead of a bestOfPages array. */

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
        window.location.href = base + 'guides/index.html';
      }
      return;
    }
    hamMenu.classList.toggle('tb-ham-open');
    var open = hamMenu.classList.contains('tb-ham-open');
    document.body.classList.toggle('tve-ham-open', open);
    if (open) { _lockBodyScroll(); } else { _unlockBodyScroll(); }
    hamBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    hamBtn.innerHTML = open
      /* currentColor, not #fff. The white ✕ dates from the terracotta bar; the
         mobile bar is beige now (see the background rule in the 1260/coarse
         block), so white rendered a nearly invisible close button on the one
         screen where the reader most needs it. currentColor inherits the
         .tb-ham colour — #b85c2a here, and whatever the theme sets elsewhere —
         so it can never fall out of step with the bar again. */
      ? '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><line x1="1" y1="1" x2="13" y2="13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><line x1="13" y1="1" x2="1" y2="13" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>'
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
  _bImg.src = base + 'images/logos/guidemydays-wordmark-serif-script-swoosh.png';
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

  /* ── Give back the space the fixed mobile bar takes ──────────────────────
     The bar is position:fixed at this breakpoint (see the note on the .tb rule
     in the 1260/coarse block), so it is out of flow and the top of every page
     would sit underneath it. Pad the body by the bar's MEASURED height rather
     than a literal: the height moves with the wordmark cap, the safe-area
     inset and the min-height, and a hardcoded number goes stale the first time
     any of those is retuned. Padding, not margin — margin on body would
     collapse with the first child's own margin and give back less than it
     took. Only ever applied at the fixed breakpoint; on desktop the bar is in
     normal flow and the padding is cleared. */
  function _padForFixedBar() {
    /* Owner rule 2026-08-15: bar is no longer fixed on mobile — no padding needed. */
    document.body.style.paddingTop = '';
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _padForFixedBar);
  } else {
    _padForFixedBar();
  }
  window.addEventListener('load', _padForFixedBar);
  window.addEventListener('resize', _padForFixedBar);

  /* ── Guide-page back-strip — REMOVED (owner rule 2026-08-15) ──────────────
     The mobile-only #tve-back-guides strip ('🖨 Print Guide' · 'Before You Go' ·
     '‹ All Guides', and the '‹ {City}' variant on stops-map) is gone with the
     rest of the hand-built mobile navigation. Owner: "remove all navigation
     made by us use the native one for mobile." The reader's own back gesture
     covers every destination the strip offered, and the browser's Share/Print
     covers the print button — mobile now navigates the way the phone does,
     with the toolbar for forward moves and the OS for backward ones.
     Do not re-add it, and do not rebuild any of it as a floating pill. */

  /* ── Floating back pills — REMOVED (owner rule 2026-08-15) ────────────────
     #tve-back-to-guide ("← {City}"), #tve-back-to-byg ("← Back to Before You
     Go") and #tve-nav-back ("Back") are gone, together with the
     stashNavSource() sessionStorage slot that fed the first two. All three
     were mobile-only re-implementations of the back button the phone already
     has. Owner: "remove all navigation made by us use the native one for
     mobile." The reader goes back with the OS gesture or the browser chrome;
     the toolbar handles every forward move. Never rebuild any of them, and
     never re-add a Forward pill (already cut once, 2026-08-09). */

  /* ── Trip Overview prev/next arrows — REMOVED (owner rule 2026-08-15) ─────
     The [‹] title [›] pair that cycled the reader from one guide to the next
     is gone on BOTH desktop and mobile. Owner: "trip overview remove the
     arrows to circle as guides from both desktop and mobile." The carousel
     data (data-prev-guide / data-next-guide) stays on the mount and the
     wiring script keeps it current — nothing else reads it today, but the
     chain is what other tools walk. Do not re-inject the arrows.
     Best-Of pages keep THEIR own prev/next row (injectBestOfArrows below);
     the owner named the guide Trip Overview only. */
  /* The block below is deferred to DOMContentLoaded: this script runs at the
     top of <body>, before .overview-title exists in the DOM. */
  if (isRealGuide) {

    /* On mobile, lift the READ ABOUT link out of the title (guides inject it
       either inside .overview-title or as a sibling — normalise both) to the
       bottom of the overview, where guide-style.css styles it as a full-width
       button. Deferred to window.load: the guide's own read-about injection
       runs AFTER these arrows, so we relocate once everything has settled.
       Desktop keeps it in the title bar. */
    function repositionReadAbout() {
      if (!window.TVE.isPhone()) return;
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

    /* ── "Cappuccino" reads "Cafe" (owner rule 2026-08-15) ──────────────────
       "cappuccino pill mobile and desktop needs to rename to Cafe." Renamed at
       RENDER TIME, exactly like shortenTrainPill above and for the same reason:
       the label lives in 245 guide files, and the section id (#cappuccino), the
       section's own heading and every validator that reads them are unchanged.
       This touches the pill in the Trip Overview extras row only, on every
       viewport — there is no mobile/desktop split in the extras row. */
    function renameCappuccinoPill() {
      [].slice.call(document.querySelectorAll('.overview-extra-link[href="#cappuccino"]')).forEach(function (a) {
        /* Rewrite the TEXT NODES only. The leading glyph is swapped for a drawn
           mark by _injectRowMarks, which leaves a hidden .gm-mk-src span behind
           whose textContent must stay byte-identical (Twenty-fourth
           non-negotiable) — setting a.textContent would destroy both. */
        var w = document.createTreeWalker(a, NodeFilter.SHOW_TEXT, null), n;
        while ((n = w.nextNode())) {
          if (/Cappuccino/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/Cappuccino/g, 'Cafe');
        }
      });
    }
    if (document.readyState !== 'loading') renameCappuccinoPill();
    else document.addEventListener('DOMContentLoaded', renameCappuccinoPill);

    /* ── Extras row follows the page (owner rule 2026-08-15) ─────────────────
       "the pills order is wrong and needs to be in the order the sections show
       up." The row is authored by hand in each guide and grown at runtime by
       _injectEndSectionPills and the Also-in-Country XHR, so its order was a
       mix of authoring habit and whichever async call resolved first — a reader
       scanning it could not use it to predict what came next in the guide.

       Sort key is the section's own position in the document, so the row can
       never disagree with the page: move a section, add one, inject one late,
       and the row re-sorts itself. Anything that is NOT an in-page jump — the
       stops-map link, which points at another file — keeps its place at the
       END, which is where the stops-map pill is deliberately appended.

       Re-run on a SHORT FIXED SCHEDULE, never on a MutationObserver. The late
       injections arrive after DOMContentLoaded, so one pass is not enough — but
       an observer on this row deadlocks the page. Measured, not guessed: with
       the observer wired up, guide pages never reached DOMContentLoaded at all
       (Playwright timed out at 25s, and the Chrome extension could not inject a
       screenshot script). The row is also watched by the drawn-mark pass, so
       reordering it makes that observer re-process the row, which mutates it,
       which re-fires ours — a mutual loop no disconnect() on our side can
       break. Fixed passes are bounded by construction and idempotent (the
       `same` check below returns without touching the DOM once the order is
       right), so the extra passes cost nothing. */
    function orderExtrasRow() {
      var row = document.querySelector('.overview-extras:not(#ics-pill-row)');
      if (!row) return;
      var kids = [].slice.call(row.children);
      if (kids.length < 2) return;
      function target(el) {
        var href = el.getAttribute && el.getAttribute('href');
        if (!href || href.charAt(0) !== '#' || href.length < 2) return null;
        try { return document.querySelector(href); } catch (e) { return null; }
      }
      /* compareDocumentPosition is the only correct answer here: sections are
         not guaranteed to be siblings (Worth Knowing and the injected banners
         nest one level deeper), so a previousElementSibling count would order
         a nested section against the wrong scale. Flag 4 = DOCUMENT_POSITION_
         FOLLOWING, i.e. b comes after a in the document. getBoundingClientRect
         is not an option — a collapsed or off-screen section measures 0. */
      /* Three buckets, and only the middle one is sorted:
           0 — not a link at all. Every guide opens its row with a decorative
               `<span>|</span>` separator; it is authored first in 199 of them
               and belongs at the head, so non-anchors keep their place ahead of
               the pills rather than being swept to the end as "no target".
           1 — an in-page jump whose section resolves. THIS is the row the owner
               wants in page order.
           2 — a link that leaves the page (the stops-map pill) or whose target
               is missing. Stays at the end, which is where the stops-map pill
               is deliberately appended. */
      function bucket(el, t) {
        if (!el.getAttribute || el.tagName !== 'A') return 0;
        return t ? 1 : 2;
      }
      var keyed = kids.map(function (el, i) {
        var t = target(el);
        return { el: el, t: t, b: bucket(el, t), i: i };
      });
      var sorted = keyed.slice().sort(function (a, b) {
        if (a.b !== b.b) return a.b - b.b;
        if (a.b !== 1) return a.i - b.i;               /* buckets 0 and 2: as authored */
        if (a.t === b.t) return a.i - b.i;
        return (a.t.compareDocumentPosition(b.t) & 4) ? -1 : 1;
      });
      var same = sorted.every(function (x, i) { return x.i === i; });
      if (same) return;
      sorted.forEach(function (x) { row.appendChild(x.el); });
    }
    /* The tail covers the slowest injector on the row — the Also-in-Country
       pill, which waits on an XHR. 4s is well past it on a cold load and the
       passes are free once the order has settled. */
    function _extrasInit() {
      orderExtrasRow();
      [300, 900, 2000, 4000].forEach(function (ms) { setTimeout(orderExtrasRow, ms); });
    }
    if (document.readyState !== 'loading') _extrasInit();
    else document.addEventListener('DOMContentLoaded', _extrasInit);
    window.addEventListener('load', orderExtrasRow);

    /* ── Per-guide stops map pill — injected when {slug}-stops-map.html exists.
       Appended at the END of the .gel overview-extras row, after all static
       pills (including ✨ Worth Knowing). Uses a HEAD request so the guide
       HTML never needs editing; the pill appears automatically once the map file
       has been generated. No-op if the file is absent (404). */
    function injectStopsMapPill() {
      var gelRow = document.querySelector('.overview-extras');
      if (!gelRow) return;
      if (gelRow.querySelector('a[href$="-stops-map.html"]')) return; // already present in HTML
      // Derive slug from the current page filename (e.g. lisbon.html → lisbon)
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
          pill.innerHTML = iconSVG(GM_SPRITE['country-map'] && 'country-map', 15, 'country-map') + ' All Stops Map';
          gelRow.appendChild(pill);
        }
      };
      xhr.send();
    }
    if (document.readyState !== 'loading') injectStopsMapPill();
    else document.addEventListener('DOMContentLoaded', injectStopsMapPill);

    /* ── "Preview Optimized" button — REMOVED (owner rule 2026-08-15) ───────
       #tve-preview-btn re-ran the route optimizer in the reader's browser and
       redrew the day list as a preview, with a floating "Preview only — run
       optimize_route.py to commit" notice. It was build tooling that shipped
       on the public page: the reader has no route to commit and no reason to
       reshuffle a guide the crib already optimized. Owner: "below remove
       preview otipmitze." Route optimization stays exactly where it belongs —
       Brain/scripts/optimize_route.py, run at build and rebuild time (Twenty-
       first non-negotiable). Do not re-inject the button. */

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
        var rest = text.slice(m[0].length).replace(/^\s*–\s*/, ' · ');
        /* Strip any legacy 🚆 that may still be in guides during migration
           (validator now hard-fails on 🚆 in overview-day-title; this keeps
           the render correct while guides are being updated). */
        rest = rest.replace(/🚆\s*(?:·\s*)?(?=Train\s+Day)/g, '');
        var num = document.createElement('span');
        num.className = 'overview-day-num';
        num.textContent = m[0];
        el.textContent = '';
        el.appendChild(num);
        if (rest.indexOf('Train Day') !== -1) {
          /* Inject the drawn train icon immediately before the "Train Day" text. */
          var _tdParts = rest.split('Train Day');
          el.appendChild(document.createTextNode(_tdParts[0]));
          var mk = document.createElement('span');
          mk.innerHTML = iconSVG(NAV_ICONS['train'], 15, 'train');
          el.appendChild(mk);
          el.appendChild(document.createTextNode(' Train Day' + _tdParts[1]));
        } else {
          el.appendChild(document.createTextNode(rest));
        }
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
        /* SHOW ONLY chips collapse with the days — they live before Day 1 */
        var stf = document.getElementById('tve-stf');
        if (stf) stf.style.display = expanded ? '' : 'none';
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
      var pm   = location.pathname.match(/(\/guides\/.+)$/i);
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
        'color:#b85c2a;transition:opacity .12s;opacity:' + (on ? '1' : '.65') + ';';

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
      var gi       = urlParts.findIndex(function (x) { return x.toLowerCase() === 'guides'; });
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

  /* ── Best Of pages: prev/next arrows below the terracotta line ───────────── */
  var isBestOf = /\/best-of\/best-/.test(location.pathname) && (prevHref || nextHref);
  if (isBestOf) {
    function injectBestOfArrows() {
      var header = document.querySelector('.page-header');
      if (!header) return;

      /* Arrow row injected AFTER .page-header — visually below the terracotta line.
         The "Updated {date}" stamp used to be moved into the header here; it now
         lives at the bottom-left of every page (owner rule 2026-08-10). */
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

  if (!window.TVE.isPhone()) {
    var btnUp   = makeScrollBtn('up');
    var btnDown = makeScrollBtn('down');
    scrollWrap.appendChild(btnUp);
    scrollWrap.appendChild(btnDown);
    document.body.appendChild(scrollWrap);
  }

  /* Hide entirely on non-scrollable pages (e.g. maps); dim individual buttons at limits */
  function updateScrollBtns() {
    if (window.TVE.isPhone() || !scrollWrap.parentNode) { return; }
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
     Bottom-left on EVERY page and EVERY viewport (owner rule 2026-08-10) — there
       is no desktop under-the-banner variant, and the class that marked one is
       retired. Spec: Brain/Reference/Toolbar-Nav/Toolbar.html Sec 10.
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
        /* Non-guide pages, ALL viewports: inject at end of body so the stamp
           always lands at the true visual bottom, left-aligned (stats pages
           close .wrap early). Matches the guide treatment, where the stamp
           sits after the last section. padding-left is set via inline style;
           mobile override injected as a <style> tag. */
        /* margin-top clears the "Also on this site" strip: that strip has no
           bottom padding, so a zero-margin stamp butts straight onto its last
           pill row and reads as a caption of the last pill rather than page
           metadata. */
        el.style.cssText = 'display:block;font-size:11px;color:#9a948a;margin:18px 0 20px;padding-left:32px;text-align:left;';
        document.body.appendChild(el);
        /* Mobile: shrink padding-left to match .wrap mobile gutter (14px). */
        if (!document.getElementById('tve-stamp-mobile-style')) {
          var mst = document.createElement('style');
          mst.id = 'tve-stamp-mobile-style';
          mst.textContent = '@media (max-width: 600px) and (pointer: coarse) {body>.title-updated{padding-left:14px!important}}';
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
            _nmst.textContent = '@media (max-width: 600px) and (pointer: coarse) {body>.title-no-entries{padding-left:14px!important}}';
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
    bTitleText.innerHTML = iconSVG(GM_SPRITE['cal-export'] && 'cal-export', 15, 'cal-export') + ' Export to Calendar';
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
        out.push('UID:' + _ts + '-day' + day.num + '@guidemydays.com');
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
    trigBtn.innerHTML = iconSVG(GM_SPRITE['cal-export'] && 'cal-export', 15, 'cal-export') + ' Export to Calendar';
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
      extras.insertAdjacentElement('afterend', pillRow);
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
       3. Set display:flex on .stop-header
       4. Append <span class="stop-dur"> with the value — the open/closed status
          is inserted BEFORE it later, so the chip reads title → status → chip
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
      /* The name sizes to its content so the chip can sit against it, which is
         the whole point of the 2026-08-10 layout. This used to set flex:1 —
         name eats every spare pixel, chip lands on the right edge — and was
         already being overwritten with these exact values a moment later by
         _injectMarkStops, which needs the same thing for the ✓ control. The two
         now agree instead of one silently undoing the other. */
      var nameEl = header.querySelector('.stop-name');
      if (nameEl) { nameEl.style.flex = '0 1 auto'; nameEl.style.minWidth = '0'; }
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
     failing that the guides/{City}/ folder slug, and reports the weekday index
     and formatted time for THAT city — never the reader's own clock. A guide is
     read weeks before the trip and often from another continent, so "today" has
     to mean today at the destination or it means nothing. `local` is false when
     no timezone could be resolved; callers suppress the today marker then rather
     than showing the reader's own weekday. Shared by the stop-hours injection
     and the Open Now filter. */
  function _tveDestNow() {
    var parts = location.pathname.split('/');
    var gi    = parts.findIndex(function (x) { return x.toLowerCase() === 'guides'; });
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
           row reads as a marked row rather than a strip. The ink is #7a3b1e and
           the chevron follows with a transparent chip. The terracotta left rail
           this comment used to describe was REMOVED on 2026-08-11 (owner: "the
           hours time no terracota bar on the left") — the band's only edge mark
           is now the right hairline. Do not reinstate a border-left here. Do not
           restore a background either without re-checking it against
           BOTH #f5f0e6 and #fdf8f0 — the two layers it sits between. */
        /* RIGHT EDGE — with no fill and (since 2026-08-11) no left rail, this
           hairline is the ONLY mark of where the band ends, which is what shows
           it stopping at the background (#faf7f2): on desktop the slab otherwise
           reads as trailing off into the middle of the page instead of stopping
           at the card edge. The hairline closes it, so it carries more weight now
           than when it shipped and must not be dropped as "matching" the left
           side. Same tint as .tve-ph-hr so the band, its divider and its panel
           agree. */
        '.tve-ph{' +
        'border-right:1px solid rgba(187,160,112,.45);background:transparent;color:#b85c2a;' +
        'font-weight:500;padding:0 14px;border-radius:0;' +
        'margin:6px -14px 0;line-height:1.55;font-size:inherit;}' +
        /* CLOCK ALIGNMENT — the label is inline, so the 15px <svg> iconSVG()
           emits defaults to vertical-align:baseline: its BOX bottom sits on the
           baseline, which puts the glyph's centre ~0.5em up while the text's
           optical centre is ~0.35em up. The clock therefore rode high against
           its own label. -0.16em drops it onto the text centre. The expandable
           variant never had this — .tve-ph-toggle is flex with
           align-items:center, which centres the icon for free. */
        '.tve-ph > svg{vertical-align:-0.16em;}' +
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
        '.tve-ph-24{background:transparent!important;' +
        'border-right-color:rgba(187,160,112,.45)!important;color:#b85c2a!important;}' +
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
        '@media (min-width: 601px), (pointer: fine) {' +
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
        '.tve-ph-chv{font-size:15px;font-weight:700;color:#b85c2a;line-height:1;' +
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
      lbl.innerHTML = iconSVG(NAV_ICONS['clock'], 15, 'clock') + ' ' + txt;
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
       the right value instead of a 2px overhang.

       🔒 NEVER MEASURE A CARD THAT REPORTS NO GUTTER (fixed 2026-08-11).
       A .tour-box / .ticket-box is `padding: 10px 14px` in guide-style.css and
       `10px 12px` at the mobile breakpoint. It is NEVER 0 — a 0 reading means
       the stylesheet is not applied at the moment we measured, and the whole
       computation is then garbage: margin-left lands on -0, the negative bleed
       never happens, `.tve-ph{padding:0 14px}` from the injected sheet survives,
       and every hours band on the page sits ONE FULL 14px GUTTER right of the
       🎟 / 📍 / ⚠️ rows above and below it (owner report 2026-08-11, on a Prague
       stop card: "this is not aligned … look at the time" — all 19 bands on that
       page were stepped in).

       That window is real and it is OURS: the CSS version guard at the top of
       this file rewrites the guide-style.css link's `?v=` when a guide ships an
       older number (every guide does — they stamp v=29-ish against CURRENT).
       Assigning `link.href` makes Chrome DROP the loaded sheet immediately and
       refetch, so between the swap and the new sheet's arrival the document has
       NO guide CSS at all. Measured on Prague: first sheet done at 267ms, swap
       fires, DOMContentLoaded at 361ms — _phFit ran HERE, on an unstyled
       document — and the replacement sheet only landed at 619ms.

       So: bail on a 0 gutter rather than writing wrong values (the injected
       CSS defaults of 14/-14 are already correct for desktop, so the band stays
       aligned meanwhile), and re-run on `load`, which by definition waits for
       every stylesheet. Do not "simplify" either half away.

       The left pad is the gutter MINUS the element's own left border, read off
       the element rather than hardcoded: .tve-ph-panel still carries a 2.5px
       rail, while .tve-ph and .tve-ph-toggle lost theirs on 2026-08-11 (owner:
       "the hours time no terracota bar on the left"). The constant 2.5 stayed
       behind and hung both of those 2.5px LEFT of the icon column. */
    var _phBands = [];
    function _phFit() {
      _phBands.forEach(function (outer) {
        if (!outer.parentNode) return;
        var cs = getComputedStyle(outer.parentNode);
        var pl = parseFloat(cs.paddingLeft) || 0, pr = parseFloat(cs.paddingRight) || 0;
        if (!pl) return;   /* styles not applied yet — see the block above */
        outer.style.setProperty('margin-left', -pl + 'px', 'important');
        outer.style.setProperty('margin-right', -pr + 'px', 'important');
        var pad = function (n) {
          if (!n) return;
          var bl = parseFloat(getComputedStyle(n).borderLeftWidth) || 0;
          n.style.setProperty('padding-left', Math.max(0, pl - bl) + 'px', 'important');
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
        el.innerHTML = iconSVG(NAV_ICONS['clock'], 15, 'clock') + ' ' + (v === '24h' ? 'Open 24h · every day' : 'Daily · ' + v);
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
    /* Second pass once every stylesheet has actually landed. At DOMContentLoaded
       the guide sheet may still be in flight behind the version guard's href
       swap (see the _phFit header) — `load` is the only event that guarantees it
       is applied, and the first pass has bailed rather than written garbage. */
    if (document.readyState !== 'complete') window.addEventListener('load', _phFit);
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

  /* ── The stop-header control rail ────────────────────────────────────────
     ONE flex item holding all four per-stop controls — ✓ visited, share, ★
     wishlist, ✎ note — instead of four loose ones (owner rule 2026-08-15:
     "they will be all 4 together instead of bookmark being in a line alone").
     Grouping is what actually keeps them together: .stop-header is
     flex-wrap:wrap on mobile, and loose flex items wrap ONE AT A TIME, so a
     long stop name split the row 3 + 1 even after the ✓ moved over to join the
     others. As a single item the rail wraps whole or not at all.
     Created on demand by whichever injector runs first and reused by the rest,
     so the four stay in a fixed order (✓ share ★ ✎) however they are scheduled.
     No auto margin here — the spacer stays on the left group's last item
     (.open-now-status → .stop-dur → .stop-name in guide-style.css); two auto
     margins would split the free space and strand the left group mid-row. */
  function stopActionRail(header) {
    if (!header) return null;
    var rail = header.querySelector(':scope > .stop-actions');
    if (!rail) {
      rail = document.createElement('span');
      rail.className = 'stop-actions';
      header.appendChild(rail);
    }
    return rail;
  }

  /* ── Day Jump pill — REMOVED (owner rule 2026-08-15) ──────────────────────
     The floating "📅 N days" pill (.day-jump-btn) and its jump-to-day overlay
     (.day-jump-overlay) are gone on every viewport. Owner: "remove the 5 days
     6 days pills from mobile as well we dont need anymore." The Trip Overview
     at the head of every guide already lists each day as a jump link, so the
     pill duplicated navigation that is one scroll away — and it was the last
     floating control sitting over the foot of a guide page.
     Do not re-inject it. Its CSS in guide-style.css is kept for now only
     where shared with .tve-scroll-top positioning notes. */

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
    btn.innerHTML = saved
      ? iconSVG(NAV_ICONS['check'], 15, 'check') + ' Saved for Offline'
      : iconSVG(NAV_ICONS['download'], 15, 'download') + ' Save for Offline';
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
        btn.innerHTML = iconSVG(NAV_ICONS['download'], 15, 'download') + ' Save for Offline';
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
    var gi = parts.findIndex(function (x) { return x.toLowerCase() === 'guides'; });
    if (gi < 0 || !parts[gi + 1]) return;
    var cityFolder = parts[gi + 1].toLowerCase();
    var storageKey = 'tve-visited-' + cityFolder;
    var visited = !!localStorage.getItem(storageKey);

    var btn = document.createElement('a');
    btn.href = 'javascript:void(0)';
    btn.className = 'overview-extra-link' + (visited ? ' tve-been' : '');
    btn.id = 'tve-visited-btn';
    btn.innerHTML = visited
      ? iconSVG(NAV_ICONS['check'], 15, 'check') + ' I’ve Been'
      : iconSVG(NAV_ICONS['pin'], 15, 'pin') + ' I’ve Been';

    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var nowVisited = !!localStorage.getItem(storageKey);
      if (nowVisited) {
        localStorage.removeItem(storageKey);
        btn.innerHTML = iconSVG(NAV_ICONS['pin'], 15, 'pin') + ' I’ve Been';
        btn.classList.remove('tve-been');
      } else {
        localStorage.setItem(storageKey, '1');
        btn.innerHTML = iconSVG(NAV_ICONS['check'], 15, 'check') + ' I’ve Been';
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
    var gi = parts.findIndex(function (x) { return x.toLowerCase() === 'guides'; });
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

      /* The control belongs with the OTHER CONTROLS on the right rail — share,
         star and notes — not against the title (owner rule 2026-08-15: "when
         the stop name is too long the bookmark is pushed below. so the move the
         bookmark to close to share, start and write note they will be all 4
         together instead of bookmark being in a line alone").
         It used to sit directly after .stop-name and carry margin-right:auto as
         the row's spacer, which is exactly what broke: on mobile .stop-header
         is flex-wrap:wrap, so a long name filled the first line, the auto
         margin ate the remaining space, and the ✓ landed on a line of its own
         with share/star/notes stranded on a third.
         The spacer job hands down to .stop-name in guide-style.css now — the
         name is the one element every header has, so the chain can never fall
         through. The name still sizes to its own content (flex:0 1 auto beats
         the flex:1 _injectStopDuration sets) and its auto margin does the
         pushing. */
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

      /* APPEND, not insertBefore(nameEl.nextSibling) — this injector runs
         before the share, star and notes injectors, so appending here puts
         the four controls in the rail in a fixed order: ✓ share ★ ✎. */
      stopActionRail(header).appendChild(btn);
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
      { name: 'Zlata Ladjica Boutique Hotel', note: 'Independent boutique — Jurčičev trg on the river in the Old Town, spa, restaurant and bar, 24h reception · 9.7 Booking.com' , url: 'https://www.booking.com/hotel/si/zlata-ladjica-boutique-ljubljana.html' },
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
      { name: 'Hôtel La Cour du 6', note: 'Independent — 6 bis Rue Royale in the Annecy city centre, 24h reception, air conditioning, on-site restaurant and coffee house · 9.0 Booking.com', url: 'https://www.booking.com/hotel/fr/la-cour-du-6.html' },
      { name: 'Rivage Hôtel & Spa Annecy', note: 'Independent — Avenue du Petit Port by the lake, year-round indoor pool, spa with steam room, sauna · 8.9 Booking.com', url: 'https://www.booking.com/hotel/fr/rivage-amp-spa-annecy.html' },
      { name: 'Les Trésoms Lake and Spa Resort', note: 'Independent — hillside on Boulevard de la Corniche with lake views, seasonal outdoor pool, spa, tennis court · 8.1 Booking.com', url: 'https://www.booking.com/hotel/fr/lestresomsannecy.html' }
    ] },
    'aracaju': { h: [
      { name: 'Del Mar Hotel', note: 'Independent — beachfront on Av. Santos Dumont in Atalaia, year-round outdoor pool, 24h reception, fitness centre · 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/mercure-aracaju-del-mar.html' },
      { name: 'Hotel da Costa by Nobile', note: 'Nobile Hotels — beachfront on Orla de Atalaia, outdoor pool with sea view, breakfast highly rated · 8.8 Booking.com', url: 'https://www.booking.com/hotel/br/da-costa.html' },
      { name: 'Celi Hotel Aracaju', note: 'Independent — Orla de Atalaia beachfront, Atlantic Ocean views, Maramar Restaurant, rooftop pool · 8.9 Booking.com', url: 'https://www.booking.com/hotel/br/celi-aracaju.html' },
      { name: 'Quality Hotel Aracaju', note: 'Choice Hotels brand — semi-Olympic pool and spa, near Sergipe River and Beira-Mar Avenue · 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/quality-aracaju.html' }
    ] },
    'arenal': { h: [
      { name: 'Nayara Springs', note: 'Small Luxury Hotels — adults-only, 35 private villas each with volcanic hot-spring plunge pool, Arenal Volcano views, 24-hour butler', url: 'https://www.booking.com/hotel/cr/nayara-springs.html' },
      { name: 'Tabacón Thermal Resort & Spa', note: 'Small Luxury Hotels — natural volcanic thermal river on-site, waterfalls and pools up to 100°F, 900+ acres of rainforest · 9.1 Booking.com', url: 'https://www.booking.com/hotel/cr/tabacon-grand-spa-thermal-resort.html' },
      { name: 'Lost Iguana Resort & Spa', note: 'Adults-only boutique — cloud-forest hillside, infinity pool with Arenal Volcano views · 9.0 Booking.com', url: 'https://www.booking.com/hotel/cr/lost-iguana-resort-spa.html' },
      { name: 'Arenal Kioro Suites & Spa', note: 'Independent — direct Arenal Volcano views, natural hot-springs pool complex, full-service spa · 8.9 Booking.com', url: 'https://www.booking.com/hotel/cr/arenal-kioro-suites-spa.html' }
    ] },
    'aruba': { h: [
      { name: 'Bucuti & Tara Beach Resort', note: '', url: 'https://www.bucuti.com/' },
      { name: 'Hyatt Regency Aruba Resort Spa & Casino', note: 'Hyatt brand — Palm Beach frontage, 8,000 sq ft pool complex with waterslide, adults-only pool, ZoiA Spa, casino on-site', url: 'https://www.booking.com/hotel/aw/hyatt-regency-aruba-resort-casino.html' },
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
      { name: 'Octant Ponta Delgada', note: 'Independent — Av. João Bosco Mota Amaral by the marina, 5-star, 24h reception, rooftop pool, spa with steam room · 9.3 Booking.com', url: 'https://www.booking.com/hotel/pt/octant-ponta-delgada.html' },
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
      { name: 'Kastara Resort', note: 'Independent — Jalan Bangkiang Sidem in Keliki north of Ubud, 5-star, 24h reception, infinity pool over the rice terraces · 9.5 Booking.com', url: 'https://www.booking.com/hotel/id/kastara-resort.html' },
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
      { name: 'The Legend Garden Condos', note: 'Independent — Mullins Bay in Saint Peter, garden condos with year-round outdoor pool, 3 km north of Holetown · 9.6 Booking.com', url: 'https://www.booking.com/hotel/bb/the-legend-garden-condos.html' },
      { name: 'The House, An Autograph Collection All-Inclusive Resort', note: 'Marriott Autograph — adults-only on Paynes Bay, 24h reception, beachfront pool, spa and jacuzzi · 8.6 Booking.com', url: 'https://www.booking.com/hotel/bb/the-house-by-elegant-hotels.html' },
      { name: 'Treasure Beach Art Hotel, An Autograph Collection All-Inclusive Resort', note: 'Marriott Autograph — adults-only on Paynes Bay, 24h reception, beachfront, rotating Barbadian art collection · 7.7 Booking.com', url: 'https://www.booking.com/hotel/bb/treasure-beach-amp-spa.html' },
      { name: 'Tamarind, Barbados, An Autograph Collection All-Inclusive Resort', note: 'Marriott Autograph — Paynes Bay Beach, 24h reception, two beachfront pools, kids club, water sports · 7.4 Booking.com', url: 'https://www.booking.com/hotel/bb/tamarind-by-elegant-hotels.html' },
      { name: 'Coral Reef Club', note: 'Independent boutique — adults-focused west coast retreat, private beach, lush tropical gardens, suites and cottages', url: 'https://www.booking.com/hotel/bb/coral-reef-club.html' }
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
      { name: 'Waypoint Hotel', note: 'Independent — Deschutes River corridor, downtown Bend, craft cocktail bar, bicycle lending, 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/red-lion-bend.html' },
      { name: 'Campfire Hotel', note: 'Independent boutique — east Bend, outdoor pool and fire pits, in-room craft beer taps, walkable east-side dining · 8.4 Booking.com', url: 'https://www.booking.com/hotel/us/bend-campfire-hotel.html' },
      { name: 'Riverhouse on the Deschutes', note: 'Independent — on the Deschutes River, indoor pool and hot tub, private beach access · 8.6 Booking.com', url: 'https://www.booking.com/hotel/us/riverhouse-on-the-deschutes.html' }
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
      { name: 'Hilton Garden Inn Boulder', note: 'Hilton brand — 2701 Canyon Boulevard, rooftop heated pool, Boulder Creek Path at the door, 10-min walk to Pearl Street · 8.0 Booking.com', url: 'https://www.booking.com/hotel/us/hilton-garden-inn-boulder-co.html' },
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
      { name: 'Old Harbor Inn', note: 'Independent adults-only inn — 22 Old Harbor Road in Chatham village, garden terrace, fitness room and tennis, breakfast in the room · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/old-harbor-inn.html' },
      { name: "Captain's House Inn", note: 'Independent adults-only inn — 369 Old Harbor Road in Chatham, 4-star, on-site restaurant and massage, gardens and shared lounge · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/captain-39-s-house-inn.html' }
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
      { name: 'La Playa Hotel', note: 'Independent — Camino Real at Eighth Avenue in Carmel village, 1905 mansion, ocean-view terraces, outdoor pool and garden courtyard · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/la-playa-carmel.html' },
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
      { name: 'JW Marriott Charlotte', note: 'JW Marriott — 600 South College Street in Uptown near the Convention Center, rooftop lounge, spa, outdoor pool, panoramic city views · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/jw-marriott-charlotte.html' },
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
      { name: 'Hotel Il colle di Monterosso', note: 'Independent — Colle di Gritta above Monterosso, garden terraces, free parking and a free shuttle down to the village · 9.3 Booking.com', url: 'https://www.booking.com/hotel/it/il-colle-di-monterosso.html' },
      { name: 'Hotel Margherita', note: 'Independent — Via Roma in the Monterosso old town, AC, elevator, a few minutes from the station and the beach · 9.2 Booking.com', url: 'https://www.booking.com/hotel/it/margherita-monterosso.html' },
      { name: 'Hotel La Spiaggia', note: 'Independent — Via Fegina, beachfront on the Monterosso seafront, AC, sea-facing rooms · 9.1 Booking.com', url: 'https://www.booking.com/hotel/it/la-spiaggia.html' },
      { name: 'Hotel Villa Adriana', note: 'Independent — Via IV Novembre, seasonal outdoor pool, garden and free parking, a level walk to Fegina beach · 9.0 Booking.com', url: 'https://www.booking.com/hotel/it/villa-adriana-monterosso-al-mare.html' }
    ] },
    'coeur-dalene': { h: [
      { name: 'SpringHill Suites Coeur d\'Alene', note: 'Marriott SpringHill brand — 2250 West Seltice Way beside the Riverstone district, indoor pool, all-suite rooms, 24h reception · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/springhill-suites-coeur-d-alene.html' },
      { name: 'Best Western Plus Coeur d\'Alene Inn', note: 'Best Western Plus — indoor pool and hot tub, on-site dining, minutes from downtown and the lake · 8.4 Booking.com', url: 'https://www.booking.com/hotel/us/coeur-d-alene-inn.html' },
      { name: 'Hampton Inn & Suites Coeur d\'Alene', note: 'Hilton Hampton brand — 1500 Riverstone Drive, indoor pool, free hot breakfast, 24h reception · 9.4 Booking.com', url: 'https://www.booking.com/hotel/us/riverstone-drive-coeur-d-alene.html' },
      { name: 'Holiday Inn Express Coeur d\'Alene', note: 'IHG brand — central location, indoor pool, free breakfast bar, mountain-and-lake views · 8.5 Booking.com', url: 'https://www.booking.com/hotel/us/holiday-inn-express-suites-coeur-d-alene-i-90-exit-11.html' }
    ] },
    'colmar': { h: [
      { name: 'Au Grenier à Sel Colmar', note: 'Independent — 54 Grand Rue in the Old Town, 4-star suites in a converted salt loft a few doors from the Koïfhus · 9.3 Booking.com', url: 'https://www.booking.com/hotel/fr/au-grenier-a-sel-colmar.html' },
      { name: "L'Esquisse Hotel & Spa Colmar · MGallery Collection", note: 'MGallery (Accor, off the § 3 ladder) — 2 Avenue de la Marne, 5-star with indoor pool, spa and 24h reception; the guide\'s previous title-card hotel · 9.2 Booking.com', url: 'https://www.booking.com/hotel/fr/colmar-champ-de-mars.html' },
      { name: 'Relais & Châteaux La Maison des Têtes', note: 'Independent — 19 Rue des Têtes, the 1609 Renaissance mansion with the 111 sculpted heads, 5-star, Michelin dining · 9.1 Booking.com', url: 'https://www.booking.com/hotel/fr/la-maison-des-tetes.html' },
      { name: 'James Boutique Hôtel Colmar centre', note: 'Independent — 15 rue Saint-Eloi, 4-star, AC, private parking, a short walk east of the Old Town · 9.0 Booking.com', url: 'https://www.booking.com/hotel/fr/james-boutique-hotel.html' }
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
      { name: 'Albergo Botti', note: 'Independent — Irinis Dendrinou in the Old Town, a restored Venetian townhouse, AC, soundproofed rooms · 9.6 Booking.com', url: 'https://www.booking.com/hotel/gr/albergo-botti.html' },
      { name: 'The Calliston', note: 'Independent — Arseniou by the sea wall at the north edge of the Old Town, AC, airport transfers · 9.5 Booking.com', url: 'https://www.booking.com/hotel/gr/the-calliston.html' },
      { name: 'New York Luxury Suites', note: 'Independent — Donzelot on the old harbour front, suites with AC and a terrace over the Old Town roofs · 9.5 Booking.com', url: 'https://www.booking.com/hotel/gr/new-york-luxury-suites-kerkura5.html' },
      { name: 'Bella Venezia', note: 'Independent — N. Zampeli a block off the Spianada, 4-star in a 19th-century neoclassical mansion, garden breakfast terrace, 24h reception · 9.3 Booking.com', url: 'https://www.booking.com/hotel/gr/bella-venezia.html' }
    ] },
    'crete': { h: [
      { name: 'Galaxy Hotel Iraklio', note: 'Independent 5-star — Heraklion\'s central elegant district, two on-site restaurants, freshwater outdoor pool, wellness and fitness center · 8.6 Booking.com', url: 'https://www.booking.com/hotel/gr/galaxy-heraklion.html' },
      { name: 'Lato Boutique Hotel', note: 'Independent boutique — Old Town Heraklion near the Venetian harbour, Brilliant Cuisine rooftop restaurant with Koules Fortress and sea panoramas · 8.4 Booking.com', url: 'https://www.booking.com/hotel/gr/lato-boutique-hotel.html' },
      { name: 'Capsis Astoria City Center Hotel', note: 'Independent 4-star — central Heraklion near Eleftherias Square, contemporary rooms, rooftop pool, walking distance to the Archaeological Museum · 8.1 Booking.com', url: 'https://www.booking.com/hotel/gr/capsis-astoria.html' },
      { name: 'Olive Green Hotel', note: 'Independent eco-boutique — sustainable 4-star near the city port, bike-friendly, organic breakfast, 8-min walk to the Heraklion waterfront · 8.7 Booking.com', url: 'https://www.booking.com/hotel/gr/olive-green-hotel.html' }
    ] },
    'curacao': { h: [
      { name: 'Baoase Luxury Resort', note: 'Independent boutique — adults-only, private beach on Piscadera Bay, Baoase Culinary Beach restaurant, full-service spa', url: 'https://baoase.com/' },
      { name: 'Mangrove Beach Corendon Curacao Resort, Curio Collection by Hilton', note: 'Hilton Curio — beachfront, aqua park, spa, multiple pools and dining, 10-min from Willemstad\'s historic waterfront · 8.7 Booking.com', url: 'https://www.booking.com/hotel/cw/corendon-mangrove-beach-resort.html' },
      { name: 'Avila Beach Hotel', note: 'Independent — historic 1780 mansion on Penstraat beach, Blues Music Bar, diving centre · 8.8 Booking.com', url: 'https://www.booking.com/hotel/cw/avila-beach-hotel.html' },
      { name: 'Renaissance Wind Creek Curaçao Resort', note: 'Renaissance brand — Punda waterfront, casino, full-service spa, harbour location · 8.7 Booking.com', url: 'https://www.booking.com/hotel/cw/renaissance-curacao-resort-casino.html' }
    ] },
    'curitiba': { h: [
      { name: 'Nomaa Hotel', note: 'Independent boutique — Batel, 5-star, Nomade Restaurant with seasonal Brazilian tasting menu, intimate rooftop deck · 9.5 Booking.com', url: 'https://www.booking.com/hotel/br/nomaa.html' },
      { name: 'Full Jazz by Slaviero Hotéis', note: 'Slaviero Hotéis — Batel, 5-star, 24h reception, fitness centre, walking distance to the Batel restaurant strip · 9.1 Booking.com', url: 'https://www.booking.com/hotel/br/slaviero-full-jazz.html' },
      { name: 'Hotel Deville Curitiba', note: 'Deville Hotéis — Rua Comendador Araújo in the city centre, 4-star, 24h reception, fitness centre · 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/deville-curitiba.html' },
      { name: 'Grand Mercure Curitiba', note: 'Accor Grand Mercure — Batel district, outdoor pool, Armazém do Chef restaurant · 8.5 Booking.com', url: 'https://www.booking.com/hotel/br/grand-mercure-curitiba.html' },
      { name: 'Hotel Slaviero Conceptual Palace', note: 'Slaviero Hotels — near Passeio Público park, art-deco architecture, spa with sauna · 8.8 Booking.com', url: 'https://www.booking.com/hotel/br/slaviero-palace.html' }
    ] },
    'cusco': { h: [
      { name: 'Monasterio, A Belmond Hotel, Cusco', note: 'Belmond brand — 16th-century San Antonio Abad seminary on Plazoleta Nazarenas, baroque chapel, altitude oxygen service · 9.8 Booking.com', url: 'https://www.booking.com/hotel/pe/monasterio-cusco.html' },
      { name: 'Casa Cartagena Boutique Hotel & Spa', note: 'Independent boutique — Calle Pumacurco in the Centro Histórico, spa with sauna and steam bath, 24h reception · 9.6 Booking.com', url: 'https://www.booking.com/hotel/pe/casa-cartagena-boutique-spa.html' },
      { name: 'Aranwa Cusco Boutique Hotel', note: 'Aranwa Hotels — Calle San Juan de Dios, colonial mansion, 24h reception, air conditioning · 9.4 Booking.com', url: 'https://www.booking.com/hotel/pe/aranwa-cusco-boutique.html' },
      { name: 'JW Marriott El Convento Cusco', note: 'Marriott JW brand — 16th-century convent on Calle Ruinas, indoor pool, spa, altitude oxygen enrichment · 9.3 Booking.com', url: 'https://www.booking.com/hotel/pe/jw-marriott-cusco.html' },
      { name: 'Inkaterra La Casona Relais & Chateaux', note: 'Relais & Châteaux — 16th-century colonial manor on Plaza de las Nazarenas, 11 suites with original Inca stonework · 9.1 Booking.com', url: 'https://www.booking.com/hotel/pe/inkaterra-la-casona.html' }
    ] },
    'dallas': { h: [
      { name: 'Rosewood Mansion on Turtle Creek', note: 'Rosewood brand — 1925 Tudor mansion in Uptown, outdoor heated pool and terrace, acclaimed Restaurant at Rosewood Mansion, full-service spa · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/us/rosewood-mansion-on-turtle-creek.html' },
      { name: 'The Ritz-Carlton, Dallas', note: "Ritz-Carlton brand — Uptown at McKinney and Maple, indoor pool, Ellie's Restaurant and Lounge, 24-hour butler · 8.8 Booking.com" , url: 'https://www.booking.com/hotel/us/the-ritz-carlton-dallas.html' },
    
      { name: 'The Joule Dallas', note: 'Independent boutique — Arts District, rooftop pool cantilevered over Main Street, Charlie Palmer restaurant, spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/the-joule.html' },
      { name: 'Hotel ZaZa Dallas', note: 'Independent boutique — Uptown near McKinney Avenue, resort pool, Dragonfly restaurant, ZaSpa, themed suites · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/hotel-zaza-dallas.html' }
    ] },
    'denver': { h: [
      { name: 'Four Seasons Hotel Denver', note: 'Four Seasons brand — 14th Street downtown, rooftop heated outdoor pool with mountain views, EDGE Restaurant & Bar, spa · 9.4 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-denver.html' },
      { name: 'The Crawford Hotel', note: 'Independent boutique — inside Denver Union Station on Wynkoop Street, spa access, Union Station dining and bars steps away · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/the-crawford-at-union-station-denver.html' },
      { name: 'The Oxford Hotel', note: "Independent boutique — LoDo's oldest hotel (1891) on 17th Street, private health club and spa, historic Cruise Room cocktail bar · 9.0 Booking.com", url: 'https://www.booking.com/hotel/us/the-oxford-downtown-denver.html' },
      { name: 'The Brown Palace Hotel and Spa, Autograph Collection', note: 'Marriott Autograph — 1892 triangular-atrium landmark on 17th Street, Ship Tavern, three-level spa · 7.6 Booking.com', url: 'https://www.booking.com/hotel/us/the-brown-palace-and-spa-autograph-collection.html' }
    ] },
    'doha': { h: [
      { name: 'Four Seasons Hotel Doha', note: 'Four Seasons brand — private beach on the West Bay Corniche, 3 outdoor pools, Nobu Doha restaurant, spa and wellness centre · 9.3 Booking.com', url: 'https://www.booking.com/hotel/qa/four-seasons-doha.html' },
      { name: 'Mandarin Oriental, Doha', note: 'Mandarin Oriental brand — Pearl-Qatar island, marina and skyline views, The Spa at Mandarin Oriental, five dining venues · 9.1 Booking.com', url: 'https://www.booking.com/hotel/qa/mandarin-oriental-doha.html' },
      { name: 'Banana Island Resort Doha by Anantara', note: 'Anantara brand — private island 20 min by ferry, overwater villas, six pools, Anantara Spa · 9.2 Booking.com', url: 'https://www.booking.com/hotel/qa/banana-island-resort.html' },
      { name: 'The St. Regis Doha', note: 'Marriott St. Regis brand — West Bay, Iridium Spa, butler service, multiple fine-dining venues · 9.0 Booking.com', url: 'https://www.booking.com/hotel/qa/the-st-regis-doha.html' }
    ] },
    'dubai': { h: [
      { name: 'Atlantis The Palm', note: 'Independent — Palm Jumeirah iconic resort, 1.5 km private beach, Aquaventure waterpark, 17 restaurants including Nobu, full-service spa · 8.8 Booking.com', url: 'https://www.booking.com/hotel/ae/atlantis-the-palm.html' },
      { name: 'DAMAC Maison Mall Street', note: 'DAMAC Maison — serviced apartments on Mohammed Bin Rashid Boulevard in Downtown Dubai, rooftop pool, spa and sauna, 24h reception · 9.0 Booking.com', url: 'https://www.booking.com/hotel/ae/damac-maison-the-summit.html' },
      { name: 'One&Only The Palm', note: 'One&Only — adults-only on Palm Jumeirah, private beach, three pools, Guerlain Spa · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ae/one-and-only-the-palm.html' },
      { name: 'Jumeirah Beach Hotel', note: 'Jumeirah brand — 26-story wave-shaped tower, 20 restaurants and bars, Wild Wadi Waterpark access · 8.8 Booking.com', url: 'https://www.booking.com/hotel/ae/jumeirah-beach-hotel.html' }
    ] },
    'dublin': { h: [
      { name: 'The Merrion Hotel', note: 'Leading Hotels of the World — four Georgian townhouses on Merrion Street Upper, National Gallery adjacent, indoor pool and spa, Cellar Restaurant · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/ie/merrion-dublin.html' },
      { name: 'Conrad Dublin', note: 'Hilton Conrad brand — Earlsfort Terrace beside the National Concert Hall, 24h reception, fitness centre, a block off St Stephen\'s Green · 8.5 Booking.com' , url: 'https://www.booking.com/hotel/ie/conrad-dublin.html' },
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
      { name: 'The Balmoral Hotel', note: 'Rocco Forte brand — 1902 Waverley clock-tower landmark on Princes Street, Number One Michelin-starred restaurant, indoor pool and spa · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/gb/the-balmoral-edinburgh.html' },
      { name: 'InterContinental Edinburgh The George', note: 'IHG first-tier — Georgian townhouses at 19-21 George Street, Tempus Restaurant and Bar, 24h reception · 8.1 Booking.com' , url: 'https://www.booking.com/hotel/gb/georgehotel-edinburgh.html' },
      { name: 'The Scotsman Hotel', note: 'Independent — converted 1905 Scotsman newspaper HQ on North Bridge, Vermilion restaurant, rooftop Scottish hot tub suite · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/gb/the-scotsman.html' },
      { name: 'G&V Royal Mile Hotel Edinburgh', note: 'G&V Hotels — Royal Mile Gothic building, Cucina restaurant, rooftop suites with castle views, boutique design interiors · 8.9 Booking.com' , url: 'https://www.booking.com/hotel/gb/gv-royal-mile-hotel-edinburgh.html' }
    ] },
    'florence': { h: [
      { name: 'Hotel La Gemma', note: 'Independent — Via dei Cavalieri a block off Piazza del Duomo, rooftop Luca Ristorante, spa with hammam · 9.5 Booking.com', url: 'https://www.booking.com/hotel/it/la-gemma-firenze.html' },
      { name: 'Portrait Firenze', note: 'Lungarno Collection — 14 riverfront suites on the Arno above the Ponte Vecchio · 9.5 Booking.com', url: 'https://www.booking.com/hotel/it/portrait-firenze.html' },
      { name: 'Hotel Savoy Florence', note: "Rocco Forte brand — Piazza della Repubblica address, L'Incontro restaurant, rooftop terrace overlooking the Duomo and Campanile, spa · 9.4 Booking.com", url: 'https://www.booking.com/hotel/it/savoy-firenze.html' },
      { name: 'Four Seasons Hotel Firenze', note: 'Four Seasons — 15th-century Palazzo della Gherardesca, 11-acre private garden with pool, Il Palagio restaurant · 9.4 Booking.com', url: 'https://www.booking.com/hotel/it/four-seasons-firenze.html' }
    ] },
    'florianopolis': { h: [
      { name: 'LK Design Hotel Florianópolis', note: 'Independent — Rua Bocaiúva above Beira-Mar Norte, rooftop infinity pool over the bay, spa, beachfront · 9.5 Booking.com', url: 'https://www.booking.com/hotel/br/lk-design-florianopolis.html' },
      { name: 'Blue Tree Premium Florianópolis', note: 'Blue Tree Hotels — Rua Bocaiúva off Beira-Mar Norte, rooftop pool, sauna and fitness · 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/blue-tree-towers-florianopolis.html' },
      { name: 'Costão do Santinho Resort Golf & Spa', note: 'Independent — Santinho Beach north coast, 18-hole golf, six pools, Costão Spa · 8.8 Booking.com', url: 'https://www.booking.com/hotel/br/costao-do-santinho-resort-golf-e-spa.html' },
      { name: 'Majestic Palace Hotel', note: 'Independent — Beira Mar Norte waterfront, rooftop pool with bay panorama, on-site restaurant, central Florianópolis · 8.5 Booking.com', url: 'https://www.booking.com/hotel/br/majestic-palace.html' }
    ] },
    'florida-keys': { h: [
      { name: 'Simonton Court Historic Inn & Cottages', note: 'Independent — 1880s cigar-workers\u2019 cottages and a conch house off Simonton Street, four pools, adults only \u00b7 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/simonton-court.html' },
      { name: 'Truman Hotel', note: 'Independent \u2014 Truman Avenue eight blocks off Duval, heated pool and sun deck, 24-hour front desk, on-site parking \u00b7 8.9 Booking.com', url: 'https://www.booking.com/hotel/us/truman.html' },
      { name: 'Casa Marina Key West, Curio Collection by Hilton', note: "Hilton Curio brand \u2014 1920 Flagler oceanfront resort, Key West's largest, private beach, two pools, Atlantic-view rooms \u00b7 7.8 Booking.com", url: 'https://www.booking.com/hotel/us/casa-marina-resort-the-waldorf-astoria-collection.html' },
      { name: 'The Reach Key West, Curio Collection by Hilton', note: 'Hilton Curio brand \u2014 Simonton Beach, private beach on the Atlantic, full-service resort, three pools, at the quiet end of Duval Street \u00b7 7.4 Booking.com', url: 'https://www.booking.com/hotel/us/the-reach-resort-the-waldorf-astoria-colelction.html' }
    ] },
    'fortaleza': { h: [
      { name: 'Gran Marquise Hotel', note: 'Independent luxury — Meireles Av. Beira Mar beachfront, rooftop pool with Atlantic views, top-rated address in Fortaleza · 9.2 Booking.com', url: 'https://www.booking.com/hotel/br/gran-marquise.html' },
      { name: 'Luzeiros Hotel Fortaleza', note: 'Independent — Meireles beachfront, sea-view pool, steps from Iracema Beach nightlife and restaurants · 8.4 Booking.com', url: 'https://www.booking.com/hotel/br/luzeiros.html' },
      { name: 'Othon Palace Fortaleza', note: 'Othon Hotels — Meireles beachfront, rooftop pool with sea view, Athenas restaurant · 8.6 Booking.com', url: 'https://www.booking.com/hotel/br/othon-palace-fortaleza.html' },
      { name: 'Marina Park Hotel', note: 'Independent — Aldeota waterfront with Fortaleza Bay views, outdoor pool, rooftop bar · 8.6 Booking.com', url: 'https://www.booking.com/hotel/br/marina-park.html' }
    ] },
    'foz-do-iguacu': { h: [
      { name: 'JL Hotel by Bourbon', note: 'Bourbon Hotéis \u2014 Avenida Costa e Silva north of the centre, outdoor pool, fitness, soundproofed rooms \u00b7 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/bourbon-foz-do-iguacu-business.html' },
      { name: 'San Rafael Comfort Class Hotel', note: 'Independent \u2014 Rua Almirante Barroso in the city centre, garden and outdoor pool, free parking, kids\u2019 club \u00b7 8.8 Booking.com', url: 'https://www.booking.com/hotel/br/san-rafael-ltda.html' },
      { name: 'Viale Tower Hotel', note: 'Independent \u2014 Avenida Jorge Schimmelpfeng in the centre, heated rooftop infinity pool over the city \u00b7 8.7 Booking.com', url: 'https://www.booking.com/hotel/br/viale-tower.html' },
      { name: 'Dom Pedro I Palace Hotel', note: 'Independent \u2014 Av. das Cataratas Km 3 on the road out to the falls, indoor and rooftop pools, tennis, gardens \u00b7 8.5 Booking.com', url: 'https://www.booking.com/hotel/br/dom-pedro-palace.html' }
    ] },
    'frankfurt': { h: [
      { name: 'Steigenberger Frankfurter Hof', note: 'Steigenberger brand — 1876 Kaiserplatz landmark, Michelin-recognized The Faces restaurant, historic grand-hotel address · 8.7 Booking.com', url: 'https://www.booking.com/hotel/de/steigenberger-frankfurter-hof.html' },
      { name: 'Villa Kennedy', note: 'Rocco Forte brand — 1901 Sachsenhausen patrician villa, garden pool, Vigna restaurant, spa, 15-minute walk to Römer', url: 'https://www.expedia.com/Frankfurt-Hotels-Rocco-Forte-Villa-Kennedy.h1329504.Hotel-Information' },
      { name: 'Jumeirah Frankfurt', note: 'Jumeirah brand — Westend tower with panoramic city views, spa, pool, rooftop terrace, 10-minute walk to Alte Oper', url: 'https://www.expedia.com/Frankfurt-Hotels-Jumeirah-Frankfurt.h4312943.Hotel-Information' },
      { name: 'Hotel Hessischer Hof', note: 'Independent grand hotel — 1952 address near Alte Oper and Messe, decorated with Hessian art collection, restaurant Sèvres', url: 'https://www.expedia.com/Frankfurt-Hotels-Grandhotel-Hessischer-Hof.h16612.Hotel-Information' }
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
      { name: 'Hotel President Wilson, a Luxury Collection Hotel', note: 'Marriott Luxury Collection — 1962 Quai Wilson lakefront, largest standard suite in Europe, outdoor pool, panoramic lake and Alps views · 8.7 Booking.com', url: 'https://www.booking.com/hotel/ch/president-wilson.html' },
      { name: 'Mandarin Oriental Geneva', note: 'Mandarin Oriental brand — Quai Turrettini on the Rhône, spa, two restaurants, five-minute walk to the Old Town and Cathédrale Saint-Pierre · 9.1 Booking.com', url: 'https://www.booking.com/hotel/ch/mandarin-oriental-geneva.html' }
    ] },
    'glacier-national-park': { h: [
      { name: 'Great Northern Resort', note: 'Independent — West Glacier, at the park entrance on US-2, log cabins and lodge rooms modeled after the Glacier Park Chalets, complimentary breakfast, 1 mile from the west gate', url: 'https://www.booking.com/hotel/us/great-northern-resort-lodge.html' },
      { name: 'Firebrand Hotel', note: 'Independent boutique — downtown Whitefish, 26 miles north of the park entrance, rooftop hot tub and terrace, walkable to restaurants and Amtrak station · 8.3 Booking.com', url: 'https://www.booking.com/hotel/us/firebrand.html' },
      { name: 'Grouse Mountain Lodge', note: 'Glacier Park Collection — Whitefish, 26 miles north of the park entrance, mountain lodge on the golf course, indoor pool, hot tub and sauna · 8.4 Booking.com', url: 'https://www.booking.com/hotel/us/grouse-mountain-lodge.html' },
      { name: 'The Lodge at Whitefish Lake', note: 'Independent, Averill Hospitality — Whitefish, 26 miles north of the park, marina resort, outdoor pool, lakefront spa, year-round mountain access · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/lodge-at-whitefish-lake.html' }
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
      { name: 'Hotel Atlantic Hamburg, Autograph Collection', note: 'Marriott Autograph Collection — 1909 Außenalster lakefront landmark, historic grand hotel, waterfront dining, near Hauptbahnhof · 9.2 Booking.com', url: 'https://www.booking.com/hotel/de/hotel-atlantic-hamburg-autograph-collection.html' },
      { name: 'Vier Jahreszeiten Hamburg', note: 'Independent — Alster lakefront landmark since 1897, Jahreszeiten Grill, spa with indoor pool · 9.0 Booking.com', url: 'https://www.booking.com/hotel/de/hotel-vier-jahreszeiten.html' },
      { name: 'Fraser Suites Hamburg', note: 'Independent — serviced-apartment suites on Rödingsmarkt in the Altstadt, sauna and steam room, kitchens in every unit · 9.1 Booking.com', url: 'https://www.booking.com/hotel/de/fraser-suites-hamburg.html' }
    ] },
    'hanoi': { h: [
      { name: 'The Oriental Jade Hotel', note: 'Independent — 92-94 Hang Trong in Hoan Kiem, rooftop infinity pool over the Old Quarter, spa and steam room, 24h reception · 9.6 Booking.com' , url: 'https://www.booking.com/hotel/vn/the-oriental-jade-amp-spa.html' },
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
      { name: 'The Inn at Harbour Town', note: 'Independent boutique — inside Sea Pines plantation, overlooking Heritage Golf Links, butler service, Sea Pines resort amenity access', url: 'https://www.expedia.com/Hilton-Head-Hotels-The-Inn-Club-At-Harbour-Town.h29064820.Hotel-Information' },
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
      { name: 'Mondrian Hong Kong', note: 'Independent — 8A Hart Avenue in Tsim Sha Tsui, 5-star, 24h reception, fitness centre, walking distance to the harbourfront promenade · 9.1 Booking.com', url: 'https://www.booking.com/hotel/hk/mondrian-hong-kong.html' },
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
      { name: 'Holanda Gold Hotel Praia de Tambaú', note: 'Independent — Av. Alm. Tamandaré on the Tambaú beachfront, 4-star, rooftop pool with sea view, 24h reception · 9.6 Booking.com', url: 'https://www.booking.com/hotel/br/holanda-gold.html' },
      { name: 'HCM · Hotel Corais de Manaíra', note: 'Independent — Av. João Maurício on the Manaíra beachfront, 5-star, indoor and rooftop infinity pools, 24h reception · 9.2 Booking.com', url: 'https://www.booking.com/hotel/br/corais-de-manaira.html' },
      { name: 'Place2You Hotel by Welkom', note: 'Welkom Hotéis — Av. Gen. Edson Ramalho in Manaíra, outdoor pool, 24h reception · 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/place2you-by-welkom.html' },
      { name: 'Kastel Jampa Hotel', note: 'Independent — Av. João Maurício beachfront, adults only, 4-star, year-round outdoor pool, 24h reception · 8.9 Booking.com', url: 'https://www.booking.com/hotel/br/kastel-jampa-joao-pessoa.html' }
    ] },
    'kauai': { h: [
      { name: '1 Hotel Hanalei Bay', note: 'SH Hotels — Ka Haku Road on the Princeville cliffs above Hanalei Bay, 5-star, year-round pool, spa, 24h reception · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/1hotel-hanalei-bay.html' },
      { name: "Koloa Landing Resort at Po'ipu · Autograph Collection", note: 'Marriott Autograph Collection — Poipu Road, 4-star, five pools including a waterslide, spa, 24h reception · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/wyndham-koloa-landing-at-poipu-beach.html' },
      { name: 'Sheraton Kauai Resort', note: 'Marriott Sheraton brand — Hoonani Road on Poipu Beach, beachfront, year-round pool, spa, 24h reception · 8.3 Booking.com', url: 'https://www.booking.com/hotel/us/sheraton-kauai-resort.html' },
      { name: "Marriott's Kaua'i Beach Club", note: 'Marriott brand — Rice Street on Kalapaki Beach in Lihue, 4-star, beachfront, spa, 24h reception · 7.8 Booking.com', url: 'https://www.booking.com/hotel/us/marriott-s-kaua-i-beach-club.html' }
    ] },
    'keywest': { h: [
      { name: 'Ocean Key Resort & Spa', note: 'Curio Collection by Hilton — Sunset Key views at Zero Duval, rooftop pool, private dock access, steps from Mallory Square sunset · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/ocean-key-resort-spa-key-west-florida.html' },
      { name: 'The Marker Key West Harbor Resort', note: 'Autograph Collection by Marriott — Old Town historic district, three pools including adults-only, marina access, tropical gardens · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/po-the-marker-key-west-harbor-resort.html' },
      { name: 'The Gardens Hotel', note: 'Independent — 1875 Old Town estate, lush tropical gardens, pool, afternoon wine included · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/gardens-hotel.html' },
      { name: 'Pier House Resort & Spa', note: 'Independent — Duval Street waterfront, sunset cruise access, spa, Chart Room bar · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/pier-house-resort-spa.html' }
    ] },
    'kotor': { h: [
      { name: 'Hotel Alkima', note: 'Independent — Dobrota waterfront on the bay, 4-star, outdoor pool, spa, 24h reception · 9.4 Booking.com', url: 'https://www.booking.com/hotel/me/alkima.html' },
      { name: 'Kerber-Graz 1860', note: 'Independent — Stari grad 381 inside the walled Old Town, 4-star, sauna and spa, 24h reception · 9.3 Booking.com', url: 'https://www.booking.com/hotel/me/kerber-graz-1860.html' },
      { name: 'Historic Boutique Hotel Cattaro', note: 'Independent — 16th-century Grgurina Palace on the Old Town square, 4-star, 24h reception · 9.0 Booking.com', url: 'https://www.booking.com/hotel/me/hotel-cattaro.html' },
      { name: 'HUMA Kotor Bay Hotel and Villas', note: 'Independent — Dobrota waterfront on the bay, 5-star, infinity pool, beach, spa, 24h reception · 8.9 Booking.com', url: 'https://www.booking.com/hotel/me/allure-palazzi-kotor-bay.html' }
    ] },
    'krakow': { h: [
      { name: 'Hotel Copernicus', note: 'Relais & Châteaux — 15th-century Renaissance house in Old Town, rooftop pool with Royal Castle and Wawel panorama, Copernicus restaurant · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/pl/copernicus.html' },
      { name: 'Sheraton Grand Kraków', note: 'Marriott family — Wisła Riverfront with Wawel Castle views, Dolce Vita Spa, indoor pool, walking distance to Old Town · 8.6 Booking.com' , url: 'https://www.booking.com/hotel/pl/sheraton-grand-krakow.html' },
      { name: 'Stary Hotel Kraków', note: 'Relais & Châteaux — 13th-century townhouse in the Old Town, indoor pool, rooftop terrace overlooking Wawel Castle · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/pl/stary.html' },
      { name: 'Qubus Hotel Kraków', note: 'Qubus Hotels — Wisła Riverfront opposite Wawel Castle, riverside views, outdoor terrace, modern amenities · 8.7 Booking.com' , url: 'https://www.booking.com/hotel/pl/qubus-krakow.html' }
    ] },
    'kyoto': { h: [
      { name: 'THE THOUSAND KYOTO', note: 'Independent — Shimogyo Ward beside Kyoto Station, 5-star, spa and wellness centre, 24h reception · 9.4 Booking.com', url: 'https://www.booking.com/hotel/jp/the-thousand-kyoto.html' },
      { name: 'The Royal Park Hotel Iconic Kyoto', note: 'Royal Park Hotels — Nakagyo Ward on Kawaramachi, 5-star, public bath, 24h reception · 9.2 Booking.com', url: 'https://www.booking.com/hotel/jp/za-roirupakuhoteru-aikonitukujing-du.html' },
      { name: 'Hotel The Celestine Kyoto Gion', note: 'Celestine Hotels — Higashiyama Ward in Gion, 5-star, machiya-style courtyard, 24h reception · 9.2 Booking.com', url: 'https://www.booking.com/hotel/jp/the-celestine-kyoto-gion.html' },
      { name: 'Hyatt Regency Kyoto', note: 'Hyatt brand — Higashiyama Ward by Sanjusangendo, 5-star, spa and wellness centre, 24h reception · 8.8 Booking.com', url: 'https://www.booking.com/hotel/jp/hyatt-regency-kyoto.html' }
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
      { name: 'Palazzo San Gottardo Lake Como, a Radisson Collection Hotel', note: 'Radisson Collection — Via Cairoli in Como city centre, 5-star, indoor pool, spa and wellness centre, 24h reception · 9.2 Booking.com', url: 'https://www.booking.com/hotel/it/palazzo-san-gottardo-lake-como-a-radisson-collection.html' },
      { name: 'Mandarin Oriental, Lago di Como', note: 'Mandarin Oriental brand — 19th-century lakeside estate in Blevio, indoor and outdoor pools, The Spa at Mandarin Oriental, 24h reception · 9.5 Booking.com', url: 'https://www.booking.com/hotel/it/mandarin-oriental-lago-di-como.html' },
      { name: 'Il Sereno Lago di Como', note: 'Independent — Patricia Urquiola-designed lakefront in Torno, infinity pool over the water, private beach area, 24h reception · 9.7 Booking.com', url: 'https://www.booking.com/hotel/it/il-sereno-lago-di-como.html' },
      { name: 'Palazzo Venezia', note: 'Independent — Piazza Cavour on the Como waterfront, 5-star, restaurant and bar, 24h reception · 9.2 Booking.com', url: 'https://www.booking.com/hotel/it/vista-lago-di-como.html' }
    ] },
    'lake-tahoe': { h: [
      { name: 'Edgewood Tahoe Resort', note: 'Forbes Five Star independent — Lake Parkway on the Stateline lakefront, championship golf, heated year-round outdoor pool, spa, private beach, 24h reception · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/the-lodge-at-edgewood-tahoe.html' },
      { name: 'Hyatt Regency Lake Tahoe Resort, Spa and Casino', note: 'Hyatt brand — Incline Village private beach, Stillwater Spa, casino, Lone Eagle Grille, 24h reception · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/hyatt-regency-lake-tahoe-resort-spa-and-casino.html' },
      { name: 'The Landing Resort and Spa', note: 'Independent — Lakeshore Boulevard beachfront in South Lake Tahoe, 5-star, heated year-round pool, spa, 24h reception · 8.4 Booking.com', url: 'https://www.booking.com/hotel/us/the-landing-resort-and-spa.html' },
      { name: 'The Ritz-Carlton, Lake Tahoe', note: 'Ritz-Carlton brand — Northstar California ski-in/ski-out above Truckee, heated outdoor pool, full-service spa, 24h reception · 8.0 Booking.com', url: 'https://www.booking.com/hotel/us/the-ritz-carlton-highlands-lake-tahoe.html' }
    ] },
    'las-vegas': { h: [
      { name: 'Wynn Las Vegas', note: 'Forbes Five Star independent — single-tower luxury resort, 3 pools, Wynn Spa, Michelin-starred Restaurant Guy Savoy and SW Steakhouse · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/wynn-las-vegas-boulevard.html' },
      { name: 'The Venetian Resort Las Vegas', note: 'Independent mega-resort — all-suite tower, Canyon Ranch Spa Club with indoor pool, 5 outdoor pools, 36 restaurants, Lagoon Pool complex · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/the-venetian-resort-casino.html' },
      { name: 'Bellagio Las Vegas', note: 'MGM Resorts — Strip icon, Bellagio Fountains, Spago and Le Cirque dining, spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/bellagio.html' },
      { name: 'The Cosmopolitan of Las Vegas', note: 'Independent — Strip, Marquee Nightclub, all rooms with terraces, Rose. Rabbit. Lie. dining · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/the-cosmopolitan-las-vegas.html' }
    ] },
    'lecce': { h: [
      { name: 'Palazzo Rollo', note: 'Independent — 17th-century palazzo on Via Vittorio Emanuele II in the Old Town, roof garden over the centro storico, 24h security · 9.5 Booking.com', url: 'https://www.booking.com/hotel/it/palazzo-rollo.html' },
      { name: 'Dimora Storica Muratore', note: 'Independent historic residence — Via Luigi Scarambone in the Old Town, rooftop infinity pool, steam room, garden terrace · 9.6 Booking.com', url: 'https://www.booking.com/hotel/it/dimora-storica-muratore.html' },
      { name: 'Patria Palace Hotel Lecce', note: 'Independent — 18th-century palazzo facing the Basilica di Santa Croce, rooftop pool · 8.9 Booking.com', url: 'https://www.booking.com/hotel/it/patria-palace.html' },
      { name: 'Togo Suites Lecce', note: 'Independent boutique — historic centro, 14 rooms in a restored 17th-century palazzo, stone vaults · 9.3 Booking.com', url: 'https://www.booking.com/hotel/it/togo-suites.html' }
    ] },
    'lille': { h: [
      { name: 'galerie jacqueline storme', note: 'Independent — 37 Avenue du Peuple Belge in Vieux-Lille, soundproof rooms, in-house art gallery, EV charging and garage parking · 9.4 Booking.com', url: 'https://www.booking.com/hotel/fr/galerie-jacqueline-storme.html' },
      { name: 'Au Cœur De Lille', note: 'Independent — 1 Rue Boileux a few minutes off the Grand Place, family rooms, private on-site parking · 9.3 Booking.com', url: 'https://www.booking.com/hotel/fr/au-coeur-de-lille.html' },
      { name: 'Barrière Lille', note: 'Barrière group — L\'Alliance hotel connected to Grand Casino Barrière, spa with pool and hammam, rooftop terrace, central Lille location · 8.7 Booking.com', url: 'https://www.booking.com/hotel/fr/barriere-lille.html' },
      { name: 'Crowne Plaza Lille', note: 'IHG Crowne Plaza — Euralille district, indoor pool, spa, close to Lille-Europe Eurostar · 8.6 Booking.com', url: 'https://www.booking.com/hotel/fr/crowne-plaza-lille.html' }
    ] },
    'lima': { h: [
      { name: 'Belmond Miraflores Park', note: 'Belmond brand — Miraflores clifftop overlooking the Pacific, rooftop heated pool with ocean views, full-service spa, 81 rooms · 9.0 Booking.com', url: 'https://www.booking.com/hotel/pe/miraflores-park.html' },
      { name: 'Hotel B', note: 'Small Luxury Hotels of the World — 1914 Republican mansion in Barranco arts district, 17 rooms, curated contemporary art collection, rooftop terrace · 9.5 Booking.com', url: 'https://www.booking.com/hotel/pe/arts-boutique-b.html' },
      { name: 'JW Marriott Hotel Lima', note: 'Marriott JW brand — Miraflores oceanfront tower, Pacific-view rooms, outdoor pool, Fishmar seafood restaurant, steps from Larcomar · 9.0 Booking.com', url: 'https://www.booking.com/hotel/pe/jw-marriott-lima.html' },
      { name: 'SOUMA Hotel · Vignette Collection by IHG', note: 'IHG Vignette Collection — Malecón 28 de Julio in Miraflores, 5-star, rooftop heated pool, spa, 24h reception · 9.1 Booking.com', url: 'https://www.booking.com/hotel/pe/vignette-collection-souma-hotel.html' },
      { name: 'Country Club Lima Hotel', note: 'Leading Hotels of the World — 1927 San Isidro mansion, 83 rooms, 300+ art pieces from Pedro de Osma Museum, El Perroquet restaurant · 8.8 Booking.com', url: 'https://www.booking.com/hotel/pe/country-club-lima.html' }
    ] },
    'london': { h: [
      { name: 'The Savoy', note: 'Fairmont brand — 1889 Thames Embankment landmark, Art Deco interior, Kaspar\'s Seafood Bar, indoor pool · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/gb/the-savoy-london.html' },
      { name: 'Claridge\'s', note: 'Independent luxury — Mayfair Art Deco landmark, legendary afternoon tea, indoor pool, Nobu at Claridge\'s · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/gb/claridges.html' },
      { name: 'The Berkeley', note: 'Independent — Wilton Place Knightsbridge, rooftop heated pool, Collins Room, The Blue Bar, 5-min to Harvey Nichols and Harrods · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/gb/the-berkeley.html' },
      { name: 'Mandarin Oriental Hyde Park, London', note: 'Mandarin Oriental brand — 66 Knightsbridge, Dinner by Heston Blumenthal, The Spa at Mandarin Oriental, Hyde Park views · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/gb/mandarin-oriental-hyde-park.html' }
    ] },
    'los-angeles': { h: [
      { name: 'Shutters On The Beach', note: 'Independent — beachfront at 1 Pico Boulevard in Santa Monica, 5-star, spa, outdoor pool and direct sand access · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/shutters-on-the-beach.html' },
      { name: 'Omni Los Angeles Hotel', note: 'Omni Hotels — 251 South Olive Street on Bunker Hill, rooftop pool, spa and 24h reception, walking distance to The Broad · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/omni-los-angeles.html' },
      { name: 'The Beverly Hills Hotel', note: 'Dorchester Collection — 1912 Pink Palace on Sunset Boulevard, Polo Lounge, bungalows, pool · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/the-beverly-hills-hotel.html' },
      { name: 'Sunset Tower Hotel', note: 'Independent — 1931 Art Deco landmark on the Sunset Strip, pool and terrace, Tower Bar restaurant · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/sunset-tower-hotel.html' }
    ] },
    'los-cabos': { h: [
      { name: 'Las Ventanas al Paraíso, A Rosewood Resort', note: 'Rosewood brand — beachfront estate, telescope observatory, three pools, Tequila & Ceviche Bar', url: 'https://www.rosewoodhotels.com/en/las-ventanas-los-cabos' },
      { name: 'One&Only Palmilla', note: 'One&Only brand — 27-acre oceanfront estate, Nobu on-site, infinity pools, private diving · 9.4 Booking.com', url: 'https://www.booking.com/hotel/mx/one-only-palmilla.html' },
      { name: 'Esperanza, Auberge Resorts Collection', note: 'Auberge Resorts — Punta Ballena, two ocean-view pools, Espacio spa, Cocina del Mar restaurant · 9.4 Booking.com', url: 'https://www.booking.com/hotel/mx/esperanza.html' },
      { name: 'Grand Velas Los Cabos', note: 'Velas Resorts — beachfront all-inclusive, six restaurants, Se Spa, infinity pool · 9.3 Booking.com', url: 'https://www.booking.com/hotel/mx/grand-velas-los-cabos.html' }
    ] },
    'luang-prabang': { h: [
      { name: 'Le Sen Boutique Hotel', note: 'Independent — Manomai Road in Ban Mano, outdoor pool, spa and gym, 24h reception, airport shuttle · 9.7 Booking.com', url: 'https://www.booking.com/hotel/la/le-sen-boutique.html' },
      { name: 'La Résidence Phou Vao', note: 'Belmond — hilltop above the town with Phousi views, infinity pool, spa, 24h reception · 9.6 Booking.com', url: 'https://www.booking.com/hotel/la/la-residence-phou-vao.html' },
      { name: 'Rosewood Luang Prabang', note: 'Rosewood brand — jungle tented resort, 23 elegant tents and villas, waterfall views · 9.5 Booking.com', url: 'https://www.booking.com/hotel/la/rosewood-luang-prabang.html' },
      { name: 'Sanctuary Hotel Luang Prabang', note: 'Independent — Kitsalat Road in Ban Aham, outdoor pool, spa and sauna, 24h reception · 9.2 Booking.com', url: 'https://www.booking.com/hotel/la/sanctuary-luang-prabang.html' },
      { name: 'Villa Maly Boutique Hotel', note: 'Independent — Oupalath Khamboua Road in Ban That Luang, outdoor pool, spa, 24h reception · 9.1 Booking.com', url: 'https://www.booking.com/hotel/la/villa-maly.html' }
    ] },
    'lucerne': { h: [
      { name: 'Palace Luzern', note: 'Independent luxury — 1906 Belle Époque lakefront palace, indoor and outdoor pools, spa, Pilatus and Rigi views · 9.4 Booking.com', url: 'https://www.booking.com/hotel/ch/mandarin-oriental-palace-luzern.html' },
      { name: 'Hotel Schweizerhof Luzern', note: 'Independent — Schweizerhofquai 3a on the lakefront in the Old Town, spa and sauna, gym, 24h reception · 9.4 Booking.com', url: 'https://www.booking.com/hotel/ch/schweizerhof-luzern.html' },
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
      { name: 'Parador de Málaga Gibralfaro', note: 'Paradores — inside Gibralfaro Castle walls, panoramic views of city and bay, seasonal pool, 24h reception · 8.7 Booking.com', url: 'https://www.booking.com/hotel/es/parador-de-malaga-gibralfaro.html' },
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
      { name: 'The Surfrider Malibu', note: 'Independent boutique — 23033 Pacific Coast Highway opposite Malibu Pier, rooftop deck and restaurant, ocean-view rooms, AC · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/the-surfrider-malibu.html' },
      { name: 'Malibu Beach Inn', note: 'Independent boutique — Carbon Beach ("Billionaire\'s Beach"), 47 rooms each with ocean-view private balcony · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/malibu-beach-inn.html' },
      { name: 'Calamigos Guest Ranch and Beach Club', note: 'Independent — Malibu Canyon 5 acres, pool, horseback riding, farm-to-table dining · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/calamigos-guest-ranch.html' },
      { name: 'Malibu Country Inn', note: 'Independent — Point Dume area, ocean view from pool deck, fire pits, romantic 16-room inn · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/malibu-country-inn.html' }
    ] },
    'manuel-antonio': { h: [
      { name: 'Arenas del Mar Beachfront & Rainforest Resort', note: 'Independent — adults-focused, twin-beach location within national park buffer, infinity pool with forest canopy views · 9.4 Booking.com', url: 'https://www.booking.com/hotel/cr/arenas-del-mar-beachfront-amp-rainforest-resort.html' },
      { name: 'Tulemar Resort', note: 'Independent boutique — tree-canopy bungalows, private beach within park buffer, jungle-to-sea setting · 9.4 Booking.com', url: 'https://www.booking.com/hotel/cr/buena-vista-luxury-villas-and-tulemar-bungalows.html' },
      { name: 'La Mansion Inn', note: 'Independent — hilltop boutique, 20 suites with jungle canopy views, two pools · 9.2 Booking.com', url: 'https://www.booking.com/hotel/cr/la-mansion-inn.html' },
      { name: 'Si Como No Resort & Spa', note: 'Independent — private wildlife refuge, two pools, TreeTops Spa, Claro Que Si restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/cr/si-como-no-resort.html' }
    ] },
    'marco-island': { h: [
      { name: 'Hilton Marco Island Beach Resort & Spa', note: 'Hilton family — directly on Marco Island\'s main beach, pools, spa, sunset views over Gulf of Mexico · 8.4 Booking.com', url: 'https://www.booking.com/hotel/us/hilton-marco-island-beach-resort.html' },
      { name: 'Marco Beach Ocean Resort', note: 'Independent boutique — 58 suites on the Esplanade, rooftop pool, Gulf-view balconies', url: 'https://www.expedia.com/Naples-Hotels-Marco-Beach-Ocean-Resort.h798448.Hotel-Information' },
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
      { name: 'Mandarin Oriental, Marrakech', note: 'Independent luxury — 20 acres of olive groves and rose gardens off the Route du Golf Royal, private-pool villas, indoor and outdoor pools, spa · 9.1 Booking.com', url: 'https://www.booking.com/hotel/ma/mandarin-oriental-marrakech.html' },
      { name: 'Royal Mansour Marrakech', note: 'Independent ultra-luxury — private riads with plunge pools, 2,500 sq m spa, three restaurants · 9.7 Booking.com', url: 'https://www.booking.com/hotel/ma/royal-mansour-marrakech.html' },
      { name: 'Amanjena', note: 'Aman brand — Route de Ouarzazate rose-pink pavilions, two pools, hammam, golf access · 9.5 Booking.com', url: 'https://www.booking.com/hotel/ma/amanjena.html' },
      { name: 'Kasbah Tamadot', note: 'Virgin Limited Edition — Atlas Mountain retreat, Berber tents, pool with mountain panorama · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ma/kasbah-tamadot.html' }
    ] },
    'marseille': { h: [
      { name: 'Les Bords de Mer · Fontenille Collection', note: 'Independent — 52 Corniche Kennedy above the water, rooftop heated pool, spa and hammam, sea-facing rooms · 9.1 Booking.com', url: 'https://www.booking.com/hotel/fr/les-bords-de-mer.html' },
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
      { name: 'Portrait Milano', note: 'Lungarno Collection — Corso Venezia 11 in the Quadrilatero, 5-star, indoor pool, spa, 24h reception · 9.5 Booking.com', url: 'https://www.booking.com/hotel/it/portrait-milano-lungarno-collection.html' },
      { name: 'Mandarin Oriental, Milan', note: 'Mandarin Oriental brand — five palazzi on Via Andegari off Via Montenapoleone, 5-star, indoor pool, The Spa, 24h reception · 9.5 Booking.com', url: 'https://www.booking.com/hotel/it/mandarin-oriental-milan.html' },
      { name: 'Four Seasons Hotel Milano', note: 'Four Seasons brand — 15th-century convent on Via Gesù, 5-star, indoor pool, spa, 24h reception · 9.1 Booking.com', url: 'https://www.booking.com/hotel/it/four-seasons-milano.html' },
      { name: 'Hotel Principe di Savoia · Dorchester Collection', note: 'Dorchester Collection — Piazza della Repubblica 17, 5-star, indoor pool, spa, 24h reception · 9.0 Booking.com', url: 'https://www.booking.com/hotel/it/principe-di-savoia.html' }
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
      { name: 'Alma Histórica Boutique Hotel', note: 'Independent boutique — restored 1920s townhouse on Plaza Zabala in Ciudad Vieja, 24h reception, rooftop terrace, room-per-writer theming · 9.4 Booking.com', url: 'https://www.booking.com/hotel/uy/alma-historica-boutique.html' },
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
      { name: 'Bardessono Hotel and Spa', note: 'Independent — LEED Platinum cedar-and-stone lodge on Yount Street in Yountville, rooftop pool, in-room spa treatments · 9.8 Booking.com', url: 'https://www.booking.com/hotel/us/bardessono.html' },
      { name: 'Archer Hotel Napa', note: 'Independent boutique — First Street in downtown Napa, rooftop pool and bar over the valley, 24h reception · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/archer-napa.html' },
      { name: 'Carneros Resort and Spa', note: 'Independent — 28-acre farm-like resort in Carneros wine region, four pools, full-service spa, FARM restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/carneros-inn.html' },
      { name: 'Meritage Resort and Spa', note: 'Independent — wine caves and spa, four pools, Estate Cave restaurant · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/the-meritage-resort-and-spa.html' }
    ] },
    'naples': { h: [
      { name: 'Grand Hotel Vesuvio', note: 'Independent luxury — Santa Lucia seafront, rooftop pool with Vesuvius views, 1882 heritage hotel · 9.2 Booking.com', url: 'https://www.booking.com/hotel/it/grand-vesuvio-napoli.html' },
      { name: 'Relais Della Porta', note: 'Independent — Via Toledo above the Quartieri Spagnoli, soundproofed rooms, breakfast served in the room · 9.1 Booking.com', url: 'https://www.booking.com/hotel/it/relais-della-porta.html' },
      { name: 'Hotel Romeo Napoli', note: 'Independent — Via Cristoforo Colombo on the waterfront, rooftop Il Comandante restaurant, spa · 9.2 Booking.com', url: 'https://www.booking.com/hotel/it/hotel-romeo.html' },
      { name: 'Grand Hotel Parker\'s Napoli', note: 'Independent — Corso Vittorio Emanuele, panoramic views over the Gulf of Naples, George\'s restaurant · 9.1 Booking.com', url: 'https://www.booking.com/hotel/it/grand-hotel-parker-s.html' }
    ] },
    'naples-florida': { h: [
      { name: 'Bellasera Resort', note: 'Independent — Tuscan-style suites on Ninth Street South, walkable to Fifth Avenue, courtyard pool and free beach shuttle · 9.4 Booking.com', url: 'https://www.booking.com/hotel/us/bellasera.html' },
      { name: 'Inn at Pelican Bay', note: 'Independent — Vanderbilt Beach Road in Pelican Bay, 24h reception, heated pool, tennis, spa · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/inn-at-pelican-bay.html' },
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
      { name: 'Coral Plaza Apart Hotel', note: 'Independent — Rua Francisco Gurgel on the Ponta Negra beachfront, 24h reception, pool with a shallow kids section, apartment-style rooms · 9.3 Booking.com', url: 'https://www.booking.com/hotel/br/coral-plaza-apart.html' },
      { name: 'Serhs Natal Grand Hotel', note: 'Serhs Hotels — Ponta Negra beachfront, outdoor pool, spa, large waterfront hotel · 8.7 Booking.com', url: 'https://www.booking.com/hotel/br/serhs-natal-grand.html' },
      { name: 'Pestana Natal Beach Resort', note: 'Pestana brand — Via Costeira beachfront, outdoor pool, Atlantic views, all-inclusive option · 8.5 Booking.com', url: 'https://www.booking.com/hotel/br/pestana-natal.html' }
    ] },
    'new-orleans': { h: [
      { name: 'The Ritz-Carlton, New Orleans', note: 'Ritz-Carlton brand — Canal Street landmark in 1907 Beaux-Arts building, spa, Club Lounge · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/nine-twenty-one-canal-street-new-orleans.html' },
      { name: 'Hotel Monteleone', note: 'Independent — 1886 Royal Street icon, rotating Carousel Bar, rooftop pool, Hunt Room Grill · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/monteleone.html' },
      { name: 'French Market Inn', note: 'Independent — 509 Decatur Street in the French Quarter, courtyard saltwater pool, 24h reception · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/french-market-inn.html' },
      { name: "Place D'Armes Hotel", note: 'Independent — 625 St Ann Street beside Jackson Square, courtyard saltwater pool, 24h reception · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/place-d-armes.html' }
    ] },
    'new-york': { h: [
      { name: 'The Mark Hotel', note: 'Independent luxury — 25 East 77th Street Upper East Side, largest suite in NYC, Jean-Georges Vongerichten restaurant · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/us/the-mark-new-york.html' },
      { name: 'The Carlyle, A Rosewood Hotel', note: 'Rosewood brand — 1930 Upper East Side landmark, Bemelmans Bar murals, Café Carlyle cabaret · 9.5 Booking.com' , url: 'https://www.booking.com/hotel/us/the-carlyle.html' },
      { name: 'The Peninsula New York', note: 'Peninsula brand — Fifth Avenue and 55th Street, rooftop pool and bar, Julie Spa, Clement Restaurant, prime Midtown position · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/us/the-peninsula-new-york.html' },
      { name: 'Four Seasons Hotel New York Downtown', note: 'Four Seasons brand — Tribeca, private plunge pools in suites, CUT by Wolfgang Puck restaurant, spa, Hudson River proximity · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/us/four-seasons-hotel-new-york-downtown.html' }
    ] },
    'nice': { h: [
      { name: 'Hôtel Le Negresco', note: 'Independent luxury — 1913 Promenade des Anglais landmark, Royal Suite, Michelin-starred Chantecler restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/fr/negresco.html' },
      { name: 'Maison Albar - Le Victoria', note: 'Independent 5-star — Avenue de Suède off Place Masséna, rooftop infinity pool, spa, 24h reception · 9.1 Booking.com', url: 'https://www.booking.com/hotel/fr/maison-albar-le-victoria.html' },
      { name: 'NH Collection Nice', note: 'NH Collection — Place Masséna, rooftop pool with Baie des Anges views, Elixir Rooftop Bar · 9.0 Booking.com', url: 'https://www.booking.com/hotel/fr/nh-collection-nice.html' },
      { name: 'Hotel Palais de la Mediterranee, in the Unbound Collection by Hyatt', note: 'Hyatt Unbound Collection — 1929 Art Deco façade at 13 Promenade des Anglais, beachfront, indoor and outdoor pools · 8.5 Booking.com', url: 'https://www.booking.com/hotel/fr/palais-de-la-mediterrannee.html' }
    ] },
    'oahu': { h: [
      { name: 'Royal Hawaiian, a Luxury Collection Resort', note: 'Marriott Luxury Collection — 1927 "Pink Palace of the Pacific," oceanfront on central Waikiki Beach, four pools · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/royal-hawaiian-a-luxury-collection-resort-honolulu.html' },
      { name: 'Four Seasons Resort Oahu at Ko Olina', note: 'Four Seasons brand — West Oahu lagoon beach, adults-focused pools, spa, away from Waikiki crowds · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-resort-oahu-at-ko-olina.html' },
      { name: 'Hyatt Regency Waikiki Beach Resort and Spa', note: 'Hyatt brand — twin towers on the beach at Kūhiō Ave, rooftop pool, open-air atrium mall · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/hyatt-regency-waikiki-beach-resort-and-spa.html' },
      { name: 'Moana Surfrider, A Westin Resort & Spa, Waikiki Beach', note: 'Marriott Westin — 1901 "First Lady of Waikiki," beachfront, iconic banyan courtyard, historic character · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/moana-surfrider-a-westin-resort-spa-waikiki-beach.html' }
    ] },
    'oaxaca': { h: [
      { name: 'Casa Oaxaca Hotel', note: 'Independent boutique — 6 suites around a colonial courtyard, rooftop pool, acclaimed El Restaurante, historic zone · 9.4 Booking.com', url: 'https://www.booking.com/hotel/mx/casa-oaxaca-oaxaca-de-juarez1.html' },
      { name: 'Hotel Escondido', note: 'Independent boutique — Oaxaca coast, clifftop cabañas, ocean views, farm-to-table restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/mx/escondido-oaxaca.html' },
      { name: 'Las Bugambilias Bed & Breakfast', note: 'Independent — colonial house in the historic center, Mexican garden courtyard · 9.6 Booking.com', url: 'https://www.booking.com/hotel/mx/las-bugambilias-bed-breakfast.html' },
      { name: 'Hotel Parador San Agustín', note: 'Independent — 18th-century Augustinian monastery, rooftop pool, spa, terrace with city views · 9.1 Booking.com', url: 'https://www.booking.com/hotel/mx/parador-san-agustin.html' }
    ] },
    'olinda': { h: [
      { name: 'Pousada dos Quatro Cantos', note: 'Independent boutique — colonial mansion in historic center, pool, close to Carnaval festivities · 9.2 Booking.com', url: 'https://www.booking.com/hotel/br/pousada-dos-quatro-cantos.html' },
      { name: 'Pousada do Amparo', note: 'Independent — 16th-century colonial house in UNESCO World Heritage town, art-filled rooms, garden · 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/pousada-do-amparo.html' },
      { name: 'Sete Colinas Hotel', note: 'Independent — hilltop colonial property in UNESCO historic core, pool with Recife panorama · 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/sete-colinas.html' },
      { name: 'Pousada Convento da Conceição', note: 'Independent — 17th-century convent in Olinda UNESCO core, WiFi, A/C, traditional breakfast, garden · 9.1 Booking.com', url: 'https://www.booking.com/hotel/br/convento-da-conceicao.html' }
    ] },
    'orcas-island': { h: [
      { name: 'Outlook Inn', note: 'Independent boutique — Eastsound village center, wraparound deck with water views, farm-fresh breakfast · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/outlook-inn-eastsound.html' },
      { name: 'Deer Harbor Inn', note: 'Independent — Deer Harbor overlook, cottage-style rooms, outdoor hot tub, kayak rentals · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/deer-harbor-inn.html' },
      { name: 'Rosario Resort & Spa', note: 'Independent — 1904 Moran estate on Cascade Bay, spa, pool, 40 acres of grounds · 8.4 Booking.com', url: 'https://www.booking.com/hotel/us/rosario-resort-spa.html' },
      { name: 'Orcas Hotel', note: 'Independent — 1904 Victorian at the Orcas ferry landing, wraparound porch, farm-to-table bistro · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/orcas-hotel.html' }
    ] },
    'orlando': { h: [
      { name: 'Loews Portofino Bay Hotel at Universal Orlando', note: 'Loews brand — Italian Riviera theming, three pools, on-site Universal Express Pass access · 8.9 Booking.com', url: 'https://www.booking.com/hotel/us/loews-portofino-bay-at-universal-orlando.html' },
      { name: 'Walt Disney World Swan Reserve', note: 'Autograph Collection (Marriott) — on Disney property, multilevel pool, three restaurants, complimentary MagicBand · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/walt-disney-world-swan-reserve.html' },
      { name: 'Four Seasons Resort Orlando at Walt Disney World Resort', note: 'Four Seasons — on Disney property, Explorer Pool with lazy river, Capa steakhouse · 9.4 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-resort-orlando.html' },
      { name: 'JW Marriott Orlando Grande Lakes', note: 'Marriott JW brand — Grande Lakes, lazy river, Greg Norman golf, Whisper Creek Farm-inspired dining · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/jw-marriott-grande-lakes.html' }
    ] },
    'osaka': { h: [
      { name: 'InterContinental Osaka', note: 'IHG brand — Grand Front Osaka, 57th-floor Pierre restaurant panorama, spa and indoor pool · 9.0 Booking.com', url: 'https://www.booking.com/hotel/jp/intercontinental-osaka.html' },
      { name: 'Conrad Osaka', note: 'Hilton family — Nakanoshima Festival City, sky infinity pool on 40th floor, harbor views · 9.2 Booking.com', url: 'https://www.booking.com/hotel/jp/conrad-osaka.html' },
      { name: 'Courtyard by Marriott Osaka Honmachi', note: 'Marriott family — 2-3-7 Minami-Honmachi in the Chuo business district, Japanese public bath on site, soundproofed rooms · 8.8 Booking.com', url: 'https://www.booking.com/hotel/jp/courtyard-by-marriott-osaka-honmachi.html' },
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
      { name: 'Old Bank Hotel', note: 'Independent boutique 5-star — Oxford High Street, views of university spires, Quod restaurant and terrace, 43 rooms · 9.3 Booking.com', url: 'https://www.booking.com/hotel/gb/the-old-bank.html' },
      { name: 'Old Parsonage Hotel', note: 'Independent 5-star — 1660 stone house at 1 Banbury Road, walled roof terrace, 24h reception · 9.0 Booking.com', url: 'https://www.booking.com/hotel/gb/old-parsonage.html' },
      { name: 'Courtyard by Marriott Oxford City Centre', note: 'Marriott brand — 15 Paradise Street by the Castle quarter, AC, 24h reception · 8.3 Booking.com', url: 'https://www.booking.com/hotel/gb/courtyard-by-marriott-oxford-city-centre.html' }
    ] },
    'palawan': { h: [
      { name: 'The Funny Lion - Puerto Princesa', note: 'Independent — F. Ponce de Leon Road, outdoor pool, 24h reception, airport shuttle · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ph/the-funny-lion-puerto-princesa.html' },
      { name: 'El Nido Resorts Pangulasian Island', note: 'El Nido Resorts — solar-powered adults-preferred island resort, white sand beach, three pools · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ph/el-nido-resorts-pangulasian-island.html' },
      { name: "Mongki's Pension House", note: 'Independent — Wescom Road in San Pedro, 24h reception, AC, airport transfers · 9.2 Booking.com', url: 'https://www.booking.com/hotel/ph/mongkis-pensionhouse.html' },
      { name: 'Carpe Diem Villas & Resort', note: 'Independent — F. Ponce de Leon Road, outdoor pool, spa, dive desk · 9.0 Booking.com', url: 'https://www.booking.com/hotel/ph/carpe-diem-villas-amp-resort-puerto-princesa.html' }
    ] },
    'palm-desert': { h: [
      { name: 'The Ritz-Carlton, Rancho Mirage', note: 'Ritz-Carlton brand — Coachella Valley hillside, outdoor pools, spa, panoramic desert valley views · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/the-ritz-carlton-rancho-mirage.html' },
      { name: 'HOTEL PASEO, Autograph Collection', note: 'Marriott Autograph — on El Paseo in Palm Desert itself, rooftop pool, spa, 24h reception · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/paseo-autograph-collection.html' },
      { name: 'Parker Palm Springs', note: 'Parker brand — 144 acres of vintage desert resort, two pools, Gene Autry\'s former home, Palm Springs style · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/parker-palm-springs.html' },
      { name: 'JW Marriott Desert Springs Resort & Spa', note: 'Marriott JW brand — Palm Desert resort, five outdoor pools, two golf courses, gondola rides through tropical waterways, full-service spa · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/jw-marriott-desert-springs-resort.html' }
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
      { name: 'Fairfield by Marriott Inn & Suites Pensacola Beach', note: 'Marriott family — Pensacola Beach beachfront, two pools, lazy river, breakfast included · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/fairfield-by-marriott-inn-suites-pensacola-beach.html' },
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
      { name: 'The Logan Philadelphia, Curio Collection by Hilton', note: 'Hilton Curio — One Logan Square on the Parkway, indoor pool, spa, Urban Farmer steakhouse · 8.2 Booking.com', url: 'https://www.booking.com/hotel/us/the-logan-philadelphia.html' },
      { name: 'Four Seasons Hotel Philadelphia at Comcast Center', note: 'Independent luxury — 60th-floor pool with panoramic views, Jean-Georges restaurant, spa · 9.6 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-philadelphia-at-comcast-center.html' },
      { name: 'Morris House Hotel', note: 'Independent — 1787 Georgian townhouse in Society Hill, walled garden, 24h reception · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/morris-house.html' },
      { name: 'ROOST Midtown', note: 'Independent apart-hotel — 111 South 15th Street off Rittenhouse Row, full kitchens, 24h reception · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/idtown.html' }
    ] },
    'phoenix': { h: [
      { name: 'The Arizona Biltmore, A Waldorf Astoria Resort', note: 'Waldorf Astoria brand — 1929 Frank Lloyd Wright-influenced design, eight pools, lush landscaping, Esplanade spa', url: 'https://www.expedia.com/Phoenix-Hotels-Arizona-Biltmore.h9796.Hotel-Information' },
      { name: 'Royal Palms Resort and Spa, A Tribute Portfolio Resort', note: 'Marriott Tribute — hacienda-style resort, T. Cook\'s restaurant, pool, Camelback Mountain backdrop', url: 'https://www.expedia.com/Phoenix-Hotels-Royal-Palms-Resort-And-Spa.h791197.Hotel-Information' },
      { name: 'Kimpton Hotel Palomar Phoenix Cityscape by IHG', note: 'Kimpton by IHG — 2 East Jefferson Street, downtown Phoenix Cityscape, rooftop outdoor pool deck, bar, fitness centre · 8.7 Booking.com', url: 'https://www.booking.com/hotel/us/kimpton-hotel-palomar-phoenix.html' },
      { name: 'Hyatt Regency Phoenix Downtown', note: 'Hyatt brand — 122 North 2nd Street, downtown Phoenix, revolving Compass Arizona Grill restaurant, outdoor pool, Phoenix Convention Center adjacent · 8.5 Booking.com', url: 'https://www.booking.com/hotel/us/phoenix-north-second-street.html' }
    ] },
    'phuket': { h: [
      { name: 'Arco Phuket Town', note: 'Independent — Thaling Chan Road in Phuket Town, saltwater pool, rooftop restaurant, 10-min walk to the Old Town shophouses · 9.5 Booking.com', url: 'https://www.booking.com/hotel/th/arco-phuket-town.html' },
      { name: 'Trisara', note: 'Independent luxury — private pool villas on Nai Thon Bay, Pru restaurant (Asia\'s 50 Best), beachfront setting · 9.6 Booking.com', url: 'https://www.booking.com/hotel/th/trisara.html' },
      { name: 'Paresa Resort Phuket', note: 'Independent — Kamala cliff-edge, adults-only, eight pool villas, Aspara spa · 9.4 Booking.com', url: 'https://www.booking.com/hotel/th/paresa-resort-phuket.html' },
      { name: 'Keemala Phuket', note: 'Small Luxury Hotels — Kamala rainforest, pool-villa-only property, Mala restaurant · 9.5 Booking.com', url: 'https://www.booking.com/hotel/th/keemala.html' }
    ] },
    'pisa': { h: [
      { name: 'Grand Hotel Duomo', note: 'Independent — steps from Piazza dei Miracoli, rooftop terrace with Leaning Tower and Baptistery views, bar · 8.1 Booking.com', url: 'https://www.booking.com/hotel/it/grandhotelduomopisa.html' },
      { name: 'NH Pisa', note: 'NH Hotels — Piazza della Stazione, 5-min walk from the Campo dei Miracoli, restaurant and bar · 8.3 Booking.com', url: 'https://www.booking.com/hotel/it/nh-pisa.html' },
      { name: 'Grand Hotel Bonanno', note: 'Independent — near Cathedral Square, neoclassical palazzo, free bikes, garden · 8.8 Booking.com', url: 'https://www.booking.com/hotel/it/grand-hotel-bonanno.html' },
      { name: 'Hotel Minerva Pisa', note: 'Independent — Art Nouveau building, panoramic roof terrace, 3-min walk from the Leaning Tower · 9.0 Booking.com', url: 'https://www.booking.com/hotel/it/hotel-minerva-pisa.html' }
    ] },
    'pokhara': { h: [
      { name: 'Temple Himalaya Hotel & Spa', note: 'Independent — Street No. 13 in Lakeside, outdoor pool, sauna, 24h reception, free airport shuttle · 9.2 Booking.com', url: 'https://www.booking.com/hotel/np/temple-himalaya-amp-spa.html' },
      { name: 'Temple Tree Resort & Spa', note: 'Independent — Lakeside district, Phewa Lake views, pool, Himalayan spa treatments · 8.8 Booking.com', url: 'https://www.booking.com/hotel/np/temple-tree-resort.html' },
      { name: 'Tiger Mountain Pokhara Lodge', note: 'Tiger Mountain — hillside eco-lodge, panoramic Annapurna and Machhapuchhre views, trekking base · 9.3 Booking.com', url: 'https://www.booking.com/hotel/np/tiger-mountain-pokhara-lodge.html' },
      { name: 'Fish Tail Lodge', note: 'Independent — peninsula in Phewa Lake reached by rope ferry, gardens, pool with Fishtail Mountain views · 8.3 Booking.com', url: 'https://www.booking.com/hotel/np/fish-tail-lodge.html' }
    ] },
    'portland': { h: [
      { name: 'Inn at Northrup Station', note: 'Independent — 2025 NW Northrup in the Nob Hill streetcar district, suites with kitchens, rooftop garden, 24h reception · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/the-inn-at-northrup-station.html' },
      { name: 'Cambria Hotel Portland - Pearl District', note: 'Independent-operated Cambria — 165 NW Park Avenue on the Park Blocks, rooftop bar, 24h reception · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/cambria-portland-pearl-district.html' },
      { name: 'Silver Cloud Hotel - Portland', note: 'Independent — 2426 NW Vaughn Street in the Northwest District, free parking, 24h reception, 921 reviews · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/silver-cloud-inn-portland.html' },
      { name: 'The Nines, A Luxury Collection Hotel', note: 'Marriott Luxury Collection — upper floors of the 1909 Meier & Frank Building on National Register, atrium lobby, Urban Farmer restaurant · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/the-nines.html' }
    ] },
    'porto': { h: [
      { name: 'The Yeatman Hotel', note: 'Independent luxury — Taylor\'s Port wine cellars hilltop, infinity pool, two-Michelin-star Yeatman Restaurant, Douro panorama · 9.5 Booking.com' , url: 'https://www.booking.com/hotel/pt/the-yeatman.html' },
      { name: 'Timbre Virtudes', note: 'Independent 5-star — Rua São Pedro de Miragaia above the Virtudes gardens, Douro-facing terrace, 24h reception · 9.3 Booking.com', url: 'https://www.booking.com/hotel/pt/das-virtudes.html' },
      { name: 'Torel Avantgarde', note: 'Independent boutique — adults-only, hilltop gardens with city and Douro panoramas, outdoor pool · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/pt/torel-avantgarde.html' },
      { name: 'Infante Sagres Luxury Historic Hotel', note: 'Leading Hotels of the World — 1951 Art Deco building in central Porto, Portuense restaurant, curated antique interiors · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/pt/infante-de-sagres.html' }
    ] },
    'porto-alegre': { h: [
      { name: 'Flat Avenida Independência', note: 'Independent — Avenida Independência 813 on the Centro edge, rooftop heated pool, sauna, 24h reception · 9.1 Booking.com', url: 'https://www.booking.com/hotel/br/flat-da-fatima.html' },
      { name: 'Intercity Porto Alegre Aeroporto', note: 'Intercity Hotels — Navegantes beside Salgado Filho airport, outdoor pool, 24h reception; the pick for an early flight out · 9.1 Booking.com', url: 'https://www.booking.com/hotel/br/intercity-express-porto-alegre.html' },
      { name: 'Hotel Laghetto Stilo Higienópolis', note: 'Laghetto Hotels — Avenida Inácio Vasconcelos in Higienópolis, rooftop pool, sauna, 24h reception · 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/laghetto-stilo-higienopolis.html' },
      { name: 'ArtHotel Transamerica Collection', note: 'Transamerica Collection — Rua Coronel Lucas de Oliveira in Bela Vista, outdoor pool, art collection through the public rooms, 24h reception · 8.6 Booking.com', url: 'https://www.booking.com/hotel/br/rua-coronel-lucas-de-oliveira-porto-alegre.html' }
    ] },
    'prague': { h: [
      { name: 'Four Seasons Hotel Prague', note: 'Four Seasons brand — Staré Město with Vltava views, spa with outdoor pool, CottoCrudo restaurant · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/cz/four-seasons-prague.html' },
      { name: 'Hotel Aria', note: 'Independent boutique — music-themed, private Vrtba Garden access, Coda Rooftop with castle and city views · 9.5 Booking.com' , url: 'https://www.booking.com/hotel/cz/aria.html' },
    
      { name: 'Mandarin Oriental Prague', note: 'Mandarin Oriental brand — Malá Strana, Spices Restaurant, spa with indoor pool, 13th-century chapel setting · 9.2 Booking.com', url: 'https://www.booking.com/hotel/cz/mandarin-oriental-prague.html' },
      { name: 'Hotel Paris Prague', note: 'Independent — 1907 Art Nouveau landmark near Old Town, Sarah Bernhardt restaurant, belle époque décor · 9.0 Booking.com', url: 'https://www.booking.com/hotel/cz/hotel-paris-prague.html' }
    ] },
    'puerto-rico': { h: [
      { name: 'Dorado Beach, a Ritz-Carlton Reserve', note: 'Ritz-Carlton Reserve — 1,400-acre beachfront estate, six pools, two golf courses · 9.4 Booking.com', url: 'https://www.booking.com/hotel/pr/dorado-beach-a-ritz-carlton-reserve.html' },
      { name: 'La Concha Resort, Puerto Rico, Autograph Collection', note: 'Marriott Autograph Collection — Condado Beach, 1950s concha-shell architecture, two pools, spa · 8.9 Booking.com', url: 'https://www.booking.com/hotel/pr/la-concha-renaissance-san-juan-resort.html' },
      { name: 'Fairmont El San Juan Hotel', note: 'Fairmont brand — Isla Verde beachfront, historic 1958 mahogany lobby, three pools; rebranded from the Curio Collection · 7.6 Booking.com', url: 'https://www.booking.com/hotel/pr/el-san-juan-casino.html' },
      { name: 'Caribe Hilton', note: 'Hilton brand — San Geronimo Grounds, site of the original Piña Colada, private beach · 8.0 Booking.com', url: 'https://www.booking.com/hotel/pr/caribe-hilton.html' }
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
      { name: 'Hotel Atlante Plaza', note: 'Independent 5-star — Avenida Boa Viagem beachfront, rooftop pool, full-service spa, 24h reception · 9.2 Booking.com', url: 'https://www.booking.com/hotel/br/atlanta-plaza.html' },
      { name: 'Bugan Recife Boa Viagem Hotel - by Atlantica', note: 'Atlantica Hotels — Avenida Engenheiro Domingos Ferreira in Boa Viagem, rooftop pool, sauna, 24h reception · 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/bugan-recife-hotel-by-atlantica.html' },
      { name: 'Mar Hotel Conventions', note: 'Independent — Rua Barão de Souza Leão in Boa Viagem, outdoor pool, kids club, 24h reception · 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/marhotel-recife.html' },
      { name: 'Ritz Suítes Hotel Recife', note: 'Independent — Boa Viagem beachfront, outdoor pool, Sky Bar rooftop terrace · 8.8 Booking.com', url: 'https://www.booking.com/hotel/br/ritz-suites-recife.html' }
    ] },
    'reykjavik': { h: [
      { name: 'Hotel Borg', note: 'Independent luxury — 1930 Art Deco landmark on Austurvöllur Square, Michelin Guide listed restaurant, timeless elegance · 9.1 Booking.com', url: 'https://www.booking.com/hotel/is/borg.html' },
      { name: 'The Reykjavik EDITION', note: 'Marriott Edition brand — harbour panoramas, outdoor heated infinity pool, Tides restaurant · 9.2 Booking.com', url: 'https://www.booking.com/hotel/is/the-reykjavik-edition.html' },
      { name: 'Ion Adventure Hotel', note: 'Design Hotels — geothermal area 45 min east, aurora-viewing rooms, infinity hot tub · 9.1 Booking.com', url: 'https://www.booking.com/hotel/is/ion-adventure-hotel.html' },
      { name: 'Canopy by Hilton Reykjavik City Centre', note: 'Hilton Canopy brand — near Hallgrímskirkja, Geysir Bar, design-forward rooms · 9.1 Booking.com', url: 'https://www.booking.com/hotel/is/canopy-by-hilton-reykjavik.html' }
    ] },
    'rhodes': { h: [
      { name: 'Naillac Boutique Hotel', note: 'Independent boutique — adults-only in Rhodes Town a short walk north of the walls, infinity pool, 24h reception, AC · 9.5 Booking.com', url: 'https://www.booking.com/hotel/gr/naillac-boutique-rodos.html' },
      { name: 'Lindos Blu Luxury Hotel - Adults only', note: 'Independent boutique — adults-only clifftop above Lindos Bay, infinity pool, cave-style architecture · 9.7 Booking.com', url: 'https://www.booking.com/hotel/gr/lindos-blu.html' },
      { name: 'Melenos Art Boutique Hotel', note: 'Independent boutique — above Lindos village, sea-view terraces, ceramics-accented Aegean design · 9.7 Booking.com', url: 'https://www.booking.com/hotel/gr/melenos-lindos-exclusive-suites.html' },
      { name: 'Atrium Prestige Thalasso Spa Resort & Villas', note: 'Independent — Lachania village, thalassotherapy centre, three pools, sea views · 9.7 Booking.com', url: 'https://www.booking.com/hotel/gr/atrium-prestige-thalasso-spa-resort-villas.html' }
    ] },
    'rio-de-janeiro': { h: [
      { name: 'JW Marriott Rio de Janeiro', note: 'Marriott family — Avenida Atlântica 2600 on Copacabana beach, rooftop pool, 24h reception, AC · 8.0 Booking.com', url: 'https://www.booking.com/hotel/br/jw-marriott-rio-de-janeiro.html' },
      { name: 'Novotel Rio de Janeiro Leme', note: 'Novotel — Rua Gustavo Sampaio in Leme one block off the beach, rooftop pool, 24h reception, AC · 8.0 Booking.com', url: 'https://www.booking.com/hotel/br/novotel-rio-de-janeiro-leme.html' },
      { name: 'Copacabana Palace - A Belmond Hotel', note: 'Belmond — Copacabana beachfront since 1923, outdoor pool, Michelin-starred Cipriani · 9.5 Booking.com', url: 'https://www.booking.com/hotel/br/copacabana-palace.html' },
      { name: 'Hotel Fasano Rio de Janeiro', note: 'Fasano brand — Vieira Souto on Ipanema beachfront, rooftop pool, Fasano Al Mare restaurant · 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/fasano-rio-de-janeiro.html' }
    ] },
    'rome': { h: [
      { name: 'Villa Spalletti Trivelli - Small Luxury Hotels of the World', note: 'Independent boutique — 12 rooms in a private noble villa by the Quirinale, garden, spa, 24h reception · 9.6 Booking.com' , url: 'https://www.booking.com/hotel/it/villa-spalletti-trivelli.html' },
      { name: 'J.K. Place Roma', note: 'Independent boutique — 30 rooms on Via Monte d\'Oro near the Pantheon, private palazzo feel, rooftop deck, 24h reception · 9.6 Booking.com' , url: 'https://www.booking.com/hotel/it/j-k-place-roma.html' },
      { name: 'Singer Palace Hotel Roma', note: 'Independent boutique — Via Alessandro Specchi by the Pantheon, rooftop bar over the centro storico, 24h reception, AC · 9.5 Booking.com' , url: 'https://www.booking.com/hotel/it/singer-palace.html' },
      { name: 'Rocco Forte Hotel De Russie', note: 'Rocco Forte brand — Via del Babuino by Piazza del Popolo, Secret Garden terrace, spa with pool, 24h reception · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/it/de-russie.html' }
    ] },
    'rotterdam': { h: [
      { name: 'Haven Hotel Rotterdam, Curio Collection by Hilton', note: 'Hilton Curio Collection — Leuvehaven 77, waterfront location near ss Rotterdam, 8.6 Booking.com · 1,544 reviews', url: 'https://www.booking.com/hotel/nl/mainport-hotel.html' },
      { name: 'Morgan & Mees Rotterdam', note: 'Independent boutique — Mathenesserlaan 145, West Coolhaven neighbourhood, 8.9 Booking.com · 1,042 reviews', url: 'https://www.booking.com/hotel/nl/morgan-amp-mees-rotterdam.html' },
      { name: 'Room Mate Bruno, Rotterdam', note: 'Room Mate brand — Wilhelminakade 52, Kop van Zuid waterfront, 8.5 Booking.com · 10,690 reviews', url: 'https://www.booking.com/hotel/nl/room-mate-bruno.html' },
      { name: 'Hilton Rotterdam', note: 'Hilton brand — Weena 10, central near Centraal, in-house Joelia Michelin-starred restaurant, 8.1 Booking.com · 2,403 reviews', url: 'https://www.booking.com/hotel/nl/hiltonrotterdam.html' }
    ] },
    'salvador': { h: [
      { name: 'Hotel Casa do Amarelindo', note: 'Independent boutique — Rua das Portas do Carmo in the Pelourinho, rooftop pool over the bay, 24h reception, AC · 9.4 Booking.com', url: 'https://www.booking.com/hotel/br/casa-do-amarelindo.html' },
      { name: 'Aram Yamí Boutique Hotel', note: 'Independent boutique — Direita de Santo Antônio above the historic centre, pool with bay panorama, 24h reception, AC · 9.2 Booking.com', url: 'https://www.booking.com/hotel/br/aram-yami.html' },
      { name: 'Hotel Fasano Salvador', note: 'Fasano brand — Praça Castro Alves in the historic centre, rooftop pool, spa, 24h reception, AC · 9.1 Booking.com', url: 'https://www.booking.com/hotel/br/fasano-salvador.html' },
      { name: 'Novotel Salvador Rio Vermelho', note: 'Novotel — Rua Monte Conselho in Rio Vermelho, the only ladder-brand hotel in the city, outdoor pool, 24h reception, AC · 8.1 Booking.com', url: 'https://www.booking.com/hotel/br/novotel-salvador-rio-vermelho.html' }
    ] },
    'salzburg': { h: [
      { name: 'Schloss Mönchstein', note: 'Independent luxury — 14th-century castle above the Old Town, spa, panoramic garden with city views · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/at/schloss-monchstein.html' },
      { name: 'Hotel Bristol Salzburg', note: 'Small Luxury Hotels — Makartplatz, spa with indoor pool, facing Landestheater, classic elegance · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/at/hotel-bristol-salzburg.html' },
      { name: 'Goldener Hirsch, a Luxury Collection Hotel', note: 'Marriott Luxury Collection — medieval inn on Getreidegasse, Goldener Hirsch restaurant, low-ceilinged historic rooms · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/at/goldener-hirsch.html' },
      { name: 'Hotel Sacher Salzburg', note: 'Independent — Schwarzstrasse on the Salzach River, iconic Sacher Torte heritage, terrace and river views, spa · 8.9 Booking.com' , url: 'https://www.booking.com/hotel/at/sacher-salzburg.html' }
    ] },
    'san-diego': { h: [
      { name: 'The US Grant - a Luxury Collection Hotel', note: 'Marriott Luxury Collection — 326 Broadway, 1910 downtown landmark, Grant Grill, 24h reception, AC · 8.0 Booking.com' , url: 'https://www.booking.com/hotel/us/the-us-grant.html' },
      { name: 'Pendry San Diego', note: 'Montage Hotels — 550 J Street in the Gaslamp Quarter, rooftop pool and cabana club, spa, 24h reception · 8.3 Booking.com' , url: 'https://www.booking.com/hotel/us/pendry-san-diego.html' },
      { name: 'Manchester Grand Hyatt San Diego', note: 'Hyatt brand — One Market Place downtown, 40-story bay-view towers, rooftop lounge, two pools, 24h reception · 8.6 Booking.com', url: 'https://www.booking.com/hotel/us/manchester-grand-hyatt-san-diego.html' },
      { name: 'Marriott Marquis San Diego Marina', note: 'Marriott brand — 333 West Harbor Drive on the downtown waterfront, outdoor pool, marina views, 24h reception · 8.6 Booking.com', url: 'https://www.booking.com/hotel/us/san-diego-marriott.html' }
    ] },
    'san-francisco': { h: [
      { name: 'Fairmont San Francisco', note: 'Fairmont brand — 1907 Nob Hill landmark, spa, Tonga Room tiki bar, rooftop garden suite · 8.9 Booking.com', url: 'https://www.booking.com/hotel/us/the-fairmont-san-francisco-san-francisco-california.html' },
      { name: 'Hotel Drisco', note: 'Independent boutique — 1903 Edwardian in Pacific Heights, complimentary chauffeur service, quiet luxury · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/drisco.html' },
      { name: 'The Ritz-Carlton, San Francisco', note: 'Ritz-Carlton brand — Nob Hill in a converted Masonic temple, indoor pool, The Dining Room, full-service spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/the-ritz-carlton-san-francisco.html' },
      { name: 'Four Seasons Hotel San Francisco at Embarcadero', note: 'Four Seasons brand — Embarcadero Center, bay-view rooms, waterfront location, indoor pool, The Market restaurant · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-embarcadero.html' }
    ] },
    'san-jose': { h: [
      { name: 'Fairmont San Jose', note: 'Fairmont brand — Almaden Valley, rooftop pool, multiple restaurants, convention center linked', url: 'https://www.expedia.com/San-Jose-Hotels-The-Fairmont-San-Jose.h15920.Hotel-Information' },
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
      { name: 'Friday Harbor House Hotel', note: 'Independent boutique — above Friday Harbor Marina, harbor and Olympic Mountain views, Pacific Northwest design · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/friday-harbor-house.html' },
      { name: 'Tucker House Inn', note: 'Independent — Friday Harbor, 1898 Victorian B&B with garden hot tub, walk to ferry · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/tucker-house-inn.html' },
      { name: 'Earthbox Inn & Spa', note: 'Independent — Friday Harbor, eco-minded inn, spa and hot tub, two blocks from the ferry · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/earthbox-inn-amp-spa.html' },
      { name: 'Trumpeter Inn', note: 'Independent — country-setting B&B, private pond with trumpeter swans, full gourmet breakfast · 9.7 Booking.com', url: 'https://www.booking.com/hotel/us/trumpeter-inn.html' }
    ] },
    'san-sebastian': { h: [
      { name: 'Hotel Maria Cristina, a Luxury Collection Hotel', note: 'Marriott Luxury Collection — 1912 Belle Époque landmark on Urumea riverside, San Sebastián Film Festival HQ · 9.3 Booking.com', url: 'https://www.booking.com/hotel/es/maria-cristina-san-sebastian.html' },
      { name: 'Akelarre Hotel', note: 'Independent — Pedro Subijana three-Michelin-star restaurant, 22 rooms on Igeldo cliffs, Bay of Biscay panorama · 9.7 Booking.com', url: 'https://www.booking.com/hotel/es/akelarre-igueldo.html' },
      { name: 'Hotel Villa Soro', note: 'Independent — 1890s Edwardian mansion in Ondarreta, pool, garden, 10 min to La Concha beach · 9.2 Booking.com', url: 'https://www.booking.com/hotel/es/villa-soro.html' },
      { name: 'Hotel de Londres y de Inglaterra', note: 'Independent — Paseo de la Concha seafront, terrace with bay views, Brasserie restaurant · 8.8 Booking.com', url: 'https://www.booking.com/hotel/es/de-londres-y-de-inglaterra.html' }
    ] },
    'santa-barbara': { h: [
      { name: 'El Encanto, A Belmond Hotel', note: 'Belmond brand — hilltop Spanish-Colonial bungalows, infinity pool, ocean and garden views · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/el-encanto.html' },
      { name: 'Rosewood Miramar Beach', note: 'Rosewood brand — Montecito oceanfront, 16 acres of gardens, pool, beachfront restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/rosewood-miramar-beach-montecito.html' },
      { name: 'Four Seasons Resort The Biltmore Santa Barbara', note: 'Four Seasons — Butterfly Beach Montecito, Spanish-Moorish landmark since 1927, Coral Casino club, two pools · 9.4 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-santa-barbara.html' },
      { name: 'Kimpton Canary Hotel', note: 'IHG Kimpton — Anacapa Street downtown, rooftop pool with mountains-and-ocean views, Finch & Fork restaurant · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/canary.html' }
    ] },
    'santa-cruz': { h: [
      { name: 'Chaminade Resort & Spa', note: 'Independent — hilltop eucalyptus-forest retreat above Monterey Bay, tennis courts, spa · 8.9 Booking.com', url: 'https://www.booking.com/hotel/us/chaminade-resort-amp-spa.html' },
      { name: 'Babbling Brook Inn', note: 'Independent boutique — garden B&B with cascading creek, antiques, walking distance to downtown', url: 'https://www.babblingbrookinn.com' },
      { name: 'Dream Inn Santa Cruz', note: 'Independent — Cowell Beach waterfront, heated oceanfront pool, Aquarius restaurant · 8.9 Booking.com', url: 'https://www.booking.com/hotel/us/dream-inn.html' },
      { name: 'West Cliff Inn, A Four Sisters Inn', note: 'Independent boutique — 1877 Victorian bluff B&B across from Cowell Beach, breakfast + afternoon wine hour · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/west-cliff-inn.html' }
    ] },
    'santa-fe': { h: [
      { name: 'Rosewood Inn of the Anasazi', note: 'Rosewood brand — kiva fireplaces, hand-woven rugs, steps from the historic Plaza · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/rosewood-inn-of-the-anasazi.html' },
      { name: 'La Fonda on the Plaza', note: 'Independent — 1922 Pueblo Revival landmark "Inn at the end of the Santa Fe Trail," rooftop cantina · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/la-fonda-on-the-plaza.html' },
      { name: "Bishop\'s Lodge, Auberge Resorts Collection", note: 'Auberge Resorts — 4 miles north in the foothills, heated outdoor pool with Sangre de Cristo Mountain views, full-service spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/bishop-39-s-lodge.html' },
      { name: 'The Inn and Spa at Loretto', note: 'Marriott Tribute Portfolio — adjacent to the Loretto Chapel downtown, outdoor pool, Luminaria restaurant, desert garden · 8.9 Booking.com', url: 'https://www.booking.com/hotel/us/inn-of-the-loretto.html' },
      { name: 'Four Seasons Resort Rancho Encantado Santa Fe', note: 'Four Seasons brand — Tesuque foothills 15 min from Plaza, casitas with kiva fireplaces, outdoor pool with Sangre de Cristo views · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/four-seasons-resort-rancho-encantado.html' },
      { name: 'Inn on the Alameda', note: 'Independent boutique — 50-room adobe inn beside Canyon Road gallery district · 8.9 Booking.com', url: 'https://www.booking.com/hotel/us/inn-on-the-alameda.html' }
    ] },
    'santa-monica': { h: [
      { name: 'Hotel Shutters on the Beach', note: 'Independent luxury — directly on Santa Monica Beach, pool, 1 Pico restaurant, ocean-view rooms · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/shutters-on-the-beach.html' },
      { name: 'Casa del Mar', note: 'InterContinental brand — Craftsman-style 1926 beachfront mansion, spa, oceanfront dining · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/casa-del-mar.html' },
      { name: 'Fairmont Miramar Hotel & Bungalows', note: 'Fairmont brand — Ocean Avenue clifftop, fig tree gardens, FIG Restaurant, ocean-view pool · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/fairmont-miramar-hotel-bungalows.html' },
      { name: 'Viceroy Santa Monica', note: 'Viceroy Hotels — Ocean Avenue, rooftop pool, Cameo Bar & Lounge, close to the Pier · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/viceroy-santa-monica.html' }
    ] },
    'santiago': { h: [
      { name: 'Mandarin Oriental, Santiago', note: 'Mandarin Oriental — Las Condes, lagoon pool and Andes views, Matsuri Nikkei restaurant · 9.1 Booking.com', url: 'https://www.booking.com/hotel/cl/hotel-santiago.html' },
      { name: 'Hotel Eco Boutique Bidasoa', note: 'Independent boutique — Vitacura residential neighborhood, lagoon pool and gardens, curated personal service · 9.5 Booking.com', url: 'https://www.booking.com/hotel/cl/bidasoa.html' },
      { name: 'The Singular Santiago, Lastarria Hotel', note: 'Independent — Barrio Lastarria, rooftop pool overlooking Santa Lucía Hill, El Singular restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/cl/the-singular-santiago-lastarria.html' },
      { name: 'Hotel Cumbres Lastarria', note: 'Independent — Lastarria bohemian quarter, rooftop terrace, contemporary Chilean design · 9.2 Booking.com', url: 'https://www.booking.com/hotel/cl/cumbres-lastarria.html' }
    ] },
    'santorini': { h: [
      { name: 'Canaves Oia Suites', note: 'Independent luxury — Oia clifftop, infinity pools, Michelin Guide-listed restaurant, sunset-facing caldera view · 9.6 Booking.com', url: 'https://www.booking.com/hotel/gr/canaves-oia-suites.html' },
      { name: 'Grace Hotel Santorini, Auberge Resorts Collection', note: 'Auberge Resorts — Imerovigli caldera cliff, adults-only, infinity pool with champagne service · 9.5 Booking.com', url: 'https://www.booking.com/hotel/gr/grace-hotel-santorini.html' },
      { name: 'Katikies Santorini', note: 'Small Luxury Hotels — Oia caldera edge, three infinity pools, Zeus restaurant, adults-only · 9.5 Booking.com', url: 'https://www.booking.com/hotel/gr/katikies.html' },
      { name: 'Olympic Villas', note: 'Independent boutique — Oia caldera-view villas with private pools, quiet location steps from main street · 9.3 Booking.com', url: 'https://www.booking.com/hotel/gr/olympic-villas-oia-santorini.html' }
    ] },
    'sarasota': { h: [
      { name: 'The Westin Sarasota', note: 'Marriott family — downtown bayfront tower, outdoor rooftop pool, marina and Sarasota Bay views', url: 'https://www.expedia.com/Sarasota-Hotels-The-Westin-Sarasota.h16818933.Hotel-Information' },
      { name: 'Hotel Ranola', note: 'Independent boutique — downtown historic district, 10 rooms, chef-driven breakfast, walkable arts scene', url: 'https://www.expedia.com/Sarasota-Hotels-Hotel-Ranola.h12348410.Hotel-Information' },
      { name: 'The Ritz-Carlton, Sarasota', note: 'Ritz-Carlton brand — downtown waterfront, The Club by Ritz-Carlton beach access, Ristorante Primo · 9.1 Booking.com', url: 'https://www.booking.com/hotel/us/the-ritz-carlton-sarasota.html' },
      { name: 'Hyatt Regency Sarasota', note: 'Hyatt brand — Sarasota Bay, marina, outdoor pool, Currents Waterfront Dining · 8.8 Booking.com', url: 'https://www.booking.com/hotel/us/hyatt-regency-sarasota.html' }
    ] },
    'sardinia': { h: [
      { name: 'Hotel Pitrizza, a Luxury Collection Resort', note: 'Marriott Luxury Collection — Costa Smeralda private rocky bay, saltwater pool, adults-only enclave · 9.3 Booking.com', url: 'https://www.booking.com/hotel/it/hotel-pitrizza-luxury-collection-resort-costa-smeralda.html' },
      { name: 'Romazzino, A Belmond Hotel', note: 'Belmond brand — Costa Smeralda private beach, parasol-shaded white sand, boat excursions · 9.1 Booking.com', url: 'https://www.booking.com/hotel/it/romazzino.html' },
      { name: 'Forte Village Resort', note: 'Independent mega-resort — Pula, 12 pools, spa with hammam, 21 restaurants, sports facilities · 9.1 Booking.com', url: 'https://www.booking.com/hotel/it/forte-village-resort.html' },
      { name: 'Cervo Hotel · Costa Smeralda Resort', note: 'Independent — Porto Cervo hillside village, Cervo Tennis Club, 3 pools, panoramic sea views · 9.2 Booking.com', url: 'https://www.booking.com/hotel/it/cervo.html' }
    ] },
    'scottsdale': { h: [
      { name: 'Hotel Valley Ho', note: 'Independent — retro-modern midcentury landmark in Old Town Scottsdale, pool, Café ZuZu, walk to Waterfront · 8.9 Booking.com', url: 'https://www.booking.com/hotel/us/hotel-valley-ho-scottsdale-arizona.html' },
      { name: 'Andaz Scottsdale Resort & Bungalows', note: 'Hyatt brand — desert rock-formation setting, Weft & Warp restaurant, desert-botanical spa treatments · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/andaz-scottsdale-resort-bungalows.html' },
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
      { name: 'Enchantment Resort', note: 'Independent luxury — canyon-floor 70-acre resort in Boynton Canyon, mii amo destination spa, red-rock surrounds · 9.3 Booking.com', url: 'https://www.booking.com/hotel/us/enchantment-resort.html' },
      { name: 'L\'Auberge de Sedona', note: 'Independent luxury — Oak Creek canyon setting, cottage suites, farm-to-table Cress restaurant · 9.2 Booking.com', url: 'https://www.booking.com/hotel/us/l-auberge-de-sedona.html' },
      { name: 'Amara Resort and Spa', note: 'Independent — Uptown Sedona on Oak Creek, adults-only pool, HARVEST restaurant, red-rock views · 9.0 Booking.com', url: 'https://www.booking.com/hotel/us/amara-resort-spa.html' },
      { name: 'Mii amo, A Destination Spa Resort', note: 'Enchantment Resort spa property — Boynton Canyon, all-inclusive spa retreat, crystal garden, yoga · 9.4 Booking.com', url: 'https://www.booking.com/hotel/us/mii-amo.html' }
    ] },
    'seoul': { h: [
      { name: 'The Shilla Seoul', note: 'Independent luxury — 23 acres of gardens on Namsan Hill, indoor pool, Korean contemporary luxury, flagship spa · 9.2 Booking.com', url: 'https://www.booking.com/hotel/kr/the-shilla.html' },
      { name: 'Park Hyatt Seoul', note: 'Hyatt brand — Gangnam CBD, 24th-floor heated indoor infinity pool, Lounge on the Park panoramic bar · 9.1 Booking.com', url: 'https://www.booking.com/hotel/kr/park-hyatt-seoul.html' },
      { name: 'Four Seasons Hotel Seoul', note: 'Four Seasons brand — Jongno-gu near Gyeongbokgung, indoor and outdoor pools, Boccalino restaurant, full-service spa · 9.3 Booking.com', url: 'https://www.booking.com/hotel/kr/four-seasons-seoul.html' },
      { name: 'JW Marriott Hotel Seoul', note: 'Marriott JW brand — Gangnam business district, rooftop outdoor pool, J Dining restaurant, spa, city views · 9.0 Booking.com', url: 'https://www.booking.com/hotel/kr/jw-marriott-hotel-seoul.html' }
    ] },
    'seville': { h: [
      { name: 'Casa 1800 Sevilla', note: 'Independent boutique — 33 rooms in a 19th-century mansion near the Cathedral, rooftop terrace with tower views · 9.6 Booking.com' , url: 'https://www.booking.com/hotel/es/casa-1800-sevilla.html' },
      { name: 'Gran Meliá Colón Sevilla', note: 'Meliá Red Level — Canalejas Street in the city centre, rooftop pool, El Burladero restaurant, 1929 Art Deco building · 8.9 Booking.com' , url: 'https://www.booking.com/hotel/es/gran-melia-colon.html' },
      { name: 'Hotel Mercer Sevilla', note: 'Mercer Hotels — San Lorenzo neighbourhood, restored 18th-century mansion, small outdoor pool, terrace, curated art, 12 rooms · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/es/mercer-sevilla.html' },
      { name: 'Hotel Tayko Sevilla', note: 'Independent — converted 16th-century building in Triana barrio, rooftop pool and bar with Guadalquivir views · 8.8 Booking.com', url: 'https://www.booking.com/hotel/es/tayko-sevilla.html' }
    ] },
    'seychelles': { h: [
      { name: 'North Island Lodge', note: 'Independent ultra-luxury — private island, 11 villas, barefoot luxury philosophy, exclusive conservation reserve · 9.7 Booking.com', url: 'https://www.booking.com/hotel/sc/north-island.html' },
      { name: 'Six Senses Zil Pasyon', note: 'Six Senses brand — private island Félicité, overwater spa, hilltop villas, coral reef · 9.6 Booking.com', url: 'https://www.booking.com/hotel/sc/six-senses-zil-pasyon.html' },
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
      { name: 'San Domenico Palace, Taormina, A Four Seasons Hotel', note: 'Four Seasons brand — 14th-century Dominican monastery, cliffside garden, pool, Etna and Ionian Bay views · 9.3 Booking.com', url: 'https://www.booking.com/hotel/it/san-domenico-palace-taormina.html' },
      { name: 'Belmond Grand Hotel Timeo', note: 'Belmond brand — 1873 hilltop above Taormina, pool, Teatro Greco views, La Terrazza restaurant · 9.4 Booking.com', url: 'https://www.booking.com/hotel/it/grand-hotel-timeo.html' },
      { name: 'Verdura Resort', note: 'Rocco Forte Hotels — Sciacca seafront, three 18-hole golf courses, spa, three pools · 9.2 Booking.com', url: 'https://www.booking.com/hotel/it/verdura-resort.html' },
      { name: 'Palazzo Failla Hotel', note: 'Independent — 18th-century Modica baroque palace, courtyard terrace, local cuisine restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/it/palazzo-failla.html' }
    ] },
    'siena': { h: [
      { name: 'Castello di Casole, A Belmond Hotel', note: 'Belmond brand — 11th-century hilltop estate, wine tower, two pools, 4,200 acres of Tuscan countryside · 9.4 Booking.com', url: 'https://www.booking.com/hotel/it/castello-di-casole.html' },
      { name: 'Relais La Suvera', note: 'Independent — 12th-century papal villa estate, vineyard, spa, antique-furnished rooms · 9.2 Booking.com', url: 'https://www.booking.com/hotel/it/relais-la-suvera.html' },
      { name: 'Hotel Certosa di Maggiano', note: 'Independent — 14th-century Certosa monastery 1 km from Piazza del Campo, pool in the cloister garden · 9.5 Booking.com', url: 'https://www.booking.com/hotel/it/certosa-di-maggiano.html' },
      { name: 'Grand Hotel Continental Siena', note: 'Starhotels — Via Banchi di Sopra baroque palace in the heart of Siena, frescoed ceilings · 9.1 Booking.com', url: 'https://www.booking.com/hotel/it/grand-hotel-continental.html' }
    ] },
    'singapore': { h: [
      { name: 'Capella Singapore', note: 'Capella Hotels — Sentosa Island estate, three pools, spa, two Michelin-starred restaurants, colonial architecture', url: 'https://capellahotels.com/en/capella-singapore' },
      { name: 'The Fullerton Hotel Singapore', note: 'Independent luxury — 1928 Palladian General Post Office, heritage rooms, 25-metre outdoor pool', url: 'https://www.fullertonhotels.com/fullerton-hotel-singapore' },
      { name: 'Marina Bay Sands', note: 'Sands Hotels — three-tower complex on Marina Bay, infinity rooftop pool at 57 floors, celebrity chef restaurants · 9.0 Booking.com', url: 'https://www.booking.com/hotel/sg/marina-bay-sands.html' },
      { name: 'Raffles Singapore', note: 'Accor Raffles — 1887 colonial landmark on Beach Road, butler for every suite, Long Bar Singapore Sling · 9.4 Booking.com', url: 'https://www.booking.com/hotel/sg/raffles-the-plaza.html' }
    ] },
    'sint-maarten': { h: [
      { name: 'Belmond La Samanna', note: 'Belmond brand — Baie Longue private beach, three pools, spa, French West Indies elegance · 9.4 Booking.com', url: 'https://www.booking.com/hotel/mf/la-samanna-french-west-indies.html' },
      { name: 'Sonesta Maho Beach Resort & Casino', note: 'Sonesta Hotels — Maho Beach, casino, pool, multiple bars · 8.5 Booking.com', url: 'https://www.booking.com/hotel/sx/sonesta-maho-beach-resort-casino-and-spa.html' },
      { name: 'Divi Little Bay Beach Resort', note: 'Divi Resorts — Little Bay peninsula, three pools, private beach, dive centre, Aquamarine restaurant · 8.7 Booking.com', url: 'https://www.booking.com/hotel/sx/divi-little-bay-beach-resort.html' },
      { name: 'JW Marriott St. Maarten Beach Resort & Spa', note: 'Marriott JW brand — Oyster Pond on Dawn Beach, pools, spa, private beach, views to St. Barths · 7.8 Booking.com', url: 'https://www.booking.com/hotel/sx/jw-marriott-st-maarten-beach-resort-spa.html' }
    ] },
    'sintra': { h: [
      { name: 'Valverde Sintra Palácio de Seteais', note: 'Leading Hotels of the World — 18th-century neoclassical palace on Rua Barbosa do Bocage, gardens, outdoor pool, valley views · 9.1 Booking.com', url: 'https://www.booking.com/hotel/pt/valverdesintrapalaciodeseteais.html' },
      { name: 'Penha Longa Resort', note: 'Marriott — Sintra hills estate on Estrada da Lagoa Azul, two golf courses, Michelin-starred LAB restaurant, spa · 9.4 Booking.com', url: 'https://www.booking.com/hotel/pt/caesarparkhotel.html' },
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
      { name: 'Radisson Blu Resort & Spa, Split', note: 'Radisson brand — Stobreč beach and marina, spa, infinity pool · 8.4 Booking.com', url: 'https://www.booking.com/hotel/hr/radisson-blu-resort-split.html' },
      { name: 'Cornaro Hotel', note: 'Independent boutique — Diocletian\'s Palace Old Town edge, rooftop terrace with bar and hot tub · 9.1 Booking.com', url: 'https://www.booking.com/hotel/hr/cornaro.html' },
      { name: 'Le Méridien Lav Split', note: 'Marriott brand — Podstrana beachfront 9 km south, indoor and outdoor pools, spa, tennis and kids\' club · 8.6 Booking.com', url: 'https://www.booking.com/hotel/hr/le-meridien-lav-split.html' }
    ] },
    'stockholm': { h: [
      { name: 'Nobis Hotel Stockholm', note: 'Independent boutique — Norrmalmstorg Square, 201 rooms, spa, celebrated Gold Bar and restaurant · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/se/nobis.html' },
      { name: 'At Six', note: 'Independent boutique — Brunkebergstorg, prominent art collection, rooftop bar and pool, 343 rooms · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/se/at-six.html' },
      { name: 'Grand Hôtel Stockholm', note: 'Leading Hotels of the World — 1874 Blasieholmen waterfront, direct Royal Palace views, Mathias Dahlgren Matbaren Michelin-starred dining, Spa Mathom · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/se/grand-hotel-stockholm.html' },
      { name: 'Ett Hem', note: 'Independent — Sköldungagatan 2 in Östermalm, 12-room private house, two gardens, communal kitchen-dining, butler and chef service · 9.7 Booking.com' , url: 'https://www.booking.com/hotel/se/ett-hem.html' }
    ] },
    'strasbourg': { h: [
      { name: 'HANNONG Hotel & Wine Bar', note: 'Independent boutique — rue du 22 Novembre on the Grande Île, Art Deco interiors, wine bar, 24h reception, AC · 8.8 Booking.com', url: 'https://www.booking.com/hotel/fr/tihannong.html' },
      { name: 'Hotel Beaucour', note: 'Independent — 5 rue des Bouchers off the cathedral quarter, timbered courtyard, jacuzzi rooms, 24h reception, AC · 8.8 Booking.com', url: 'https://www.booking.com/hotel/fr/beaucour.html' },
      { name: 'Hôtel Rohan Strasbourg', note: 'Independent — Place du Corbeau on the Ill River, Cathedral views, boutique 36 rooms · 9.1 Booking.com', url: 'https://www.booking.com/hotel/fr/rohan.html' },
      { name: 'Cour du Corbeau, Strasbourg', note: 'Small Luxury Hotels — 16th-century coaching inn in the historic center, courtyard, spa · 9.2 Booking.com', url: 'https://www.booking.com/hotel/fr/cour-du-corbeau.html' }
    ] },
    'stuttgart': { h: [
      { name: 'EmiLu Design Hotel', note: 'Independent design hotel — Nadlerstraße 4 in Stuttgart-Mitte off Königstraße, sauna, 24h reception, AC · 9.0 Booking.com', url: 'https://www.booking.com/hotel/de/emilu-gmbh-stuttgart.html' },
      { name: 'Steigenberger Graf Zeppelin', note: 'Steigenberger brand — Arnulf-Klett-Platz opposite the Hauptbahnhof, spa, 24h reception, AC · 8.1 Booking.com', url: 'https://www.booking.com/hotel/de/steigenberger-graf-zeppelin.html' },
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
      { name: 'Brisamar Hotel & SPA São Luís', note: 'Independent — Avenida São Marcos on Ponta da Areia beach, outdoor pool, spa, 24h reception, AC · 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/brisamar.html' },
      { name: 'Blue Tree Premium São Luís', note: 'Blue Tree — Avenida Avicênia on the Calhau beachfront, outdoor pool, tennis court, 24h reception, AC · 8.7 Booking.com', url: 'https://www.booking.com/hotel/br/pestana-sao-luis.html' },
      { name: 'Stop Way Hotel São Luís', note: 'Independent — Avenida Mário Meirelles in the Renascença district, 24h reception, AC · 8.6 Booking.com', url: 'https://www.booking.com/hotel/br/stop-way.html' },
      { name: 'Casa Lavinia', note: 'Independent boutique — Rua 28 de Julho inside the Praia Grande historic centre, garden, AC · 8.5 Booking.com', url: 'https://www.booking.com/hotel/br/casa-lavinia.html' }
    ] },
    'sao-paulo': { h: [
      { name: 'Rosewood São Paulo', note: 'Rosewood brand — Cidade Matarazzo on Rua Itapeva in Bela Vista, rooftop infinity pool, Evvai Michelin-starred dining, 24h reception · 9.4 Booking.com', url: 'https://www.booking.com/hotel/br/rosewood-sao-paulo.html' },
      { name: 'L\'Hôtel PortoBay São Paulo', note: 'PortoBay brand — Alameda Campinas in Bela Vista off Avenida Paulista, rooftop pool, 24h reception, AC · 9.2 Booking.com', url: 'https://www.booking.com/hotel/br/porto-bay-lhotel.html' },
      { name: 'Fasano São Paulo', note: 'Fasano brand — Jardins, Fasano Grill Michelin-starred restaurant, rooftop pool · 9.2 Booking.com', url: 'https://www.booking.com/hotel/br/fasano-sao-paulo.html' },
      { name: 'Tivoli Mofarrej São Paulo', note: 'Tivoli Hotels — Jardim Paulista, Seen Restaurant & Rooftop bar, spa with pool · 9.0 Booking.com', url: 'https://www.booking.com/hotel/br/tivoli-mofarrej-sao-paulo.html' }
    ] },
    'taipei': { h: [
      { name: 'Mandarin Oriental, Taipei', note: 'Mandarin Oriental brand — Dunhua North Road, outdoor pool, Michelin-starred Ya Ge Cantonese restaurant, 24h reception · 9.1 Booking.com', url: 'https://www.booking.com/hotel/tw/mandarin-oriental-taipei.html' },
      { name: 'W Taipei', note: 'Marriott W brand — Zhongxiao East Road in Xinyi by Taipei 101, WET rooftop pool, 24h reception · 8.9 Booking.com', url: 'https://www.booking.com/hotel/tw/w-taipei.html' },
      { name: 'The Regent Taipei', note: 'IHG Regent brand — Zhongshan District, Crystal Jade restaurant, indoor pool · 8.9 Booking.com', url: 'https://www.booking.com/hotel/tw/regent-taipei.html' },
      { name: 'Palais de Chine Hotel', note: 'Independent — near Taipei Main Station, Art Deco design, Le Palais Cantonese restaurant · 9.2 Booking.com', url: 'https://www.booking.com/hotel/tw/palais-de-chine.html' }
    ] },
    'tallinn': { h: [
      { name: 'Nunne Boutique Hotel', note: 'Independent boutique — Nunne 14 against the Old Town wall, sauna and spa, 24h reception, AC · 9.4 Booking.com', url: 'https://www.booking.com/hotel/ee/nunne-boutique.html' },
      { name: 'Schlössle Hotel', note: 'Small Luxury Hotels — 15th-century merchant house in medieval Old Town, oak-panelled rooms, intimate · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/ee/schlossle.html' },
      { name: 'The Three Sisters Hotel', note: 'Independent boutique — Old Town UNESCO site, three 15th-century merchant houses, Bordoo restaurant, antique furnishings · 9.4 Booking.com', url: 'https://www.booking.com/hotel/ee/the-three-sisters.html' },
      { name: 'Hotel Viru', note: 'Independent — Viru Square, Old Town landmark from 1972, rooftop sauna, Viru bar lounge, KGB Museum on the 23rd floor · 8.5 Booking.com', url: 'https://www.booking.com/hotel/ee/viru.html' }
    ] },
    'tbilisi': { h: [
      { name: 'Qarvasla Hotel', note: 'Independent — 36 Kote Afkhazi Street in Sololaki, restored caravanserai walls, 24h reception, AC · 9.4 Booking.com', url: 'https://www.booking.com/hotel/ge/qarvasla-tbilisi.html' },
      { name: 'Stamba Hotel', note: 'Independent — 1930s Soviet-era publishing house on Merab Kostava Street, 8-metre loft ceilings, garden, 24h reception · 9.2 Booking.com', url: 'https://www.booking.com/hotel/ge/stamba-tbilisi.html' },
      { name: 'Biltmore Hotel Tbilisi', note: 'Marriott Autograph Collection — Rustaveli Avenue, outdoor pool, Salve restaurant, spa · 9.0 Booking.com', url: 'https://www.booking.com/hotel/ge/biltmore-hotel-tbilisi.html' },
      { name: 'Radisson Blu Iveria Hotel Tbilisi', note: 'Radisson Blu — Rose Revolution Square, outdoor pool, Shavi Lomi restaurant, spa · 8.8 Booking.com', url: 'https://www.booking.com/hotel/ge/radisson-sas-iveria-tbilisi.html' }
    ] },
    'tenerife': { h: [
      { name: 'Hotel Botanico y Oriental Spa Garden', note: 'Independent luxury — Avenida Richard J. Yeoward in Puerto de la Cruz, Oriental Spa Garden, indoor and outdoor pools, 24h reception · 9.3 Booking.com', url: 'https://www.booking.com/hotel/es/botanico-y-oriental-spa-garden.html' },
      { name: 'Iberostar Grand Hotel El Mirador', note: 'Iberostar Grand — adults-only Costa Adeje cliffside, infinity pool, Michelin-guide dining · 9.3 Booking.com', url: 'https://www.booking.com/hotel/es/iberostar-grand-hotel-el-mirador.html' },
      { name: 'Hotel Tigaiga', note: 'Independent — Parque Taoro above Puerto de la Cruz, subtropical garden, outdoor pool with valley view, 24h reception · 9.2 Booking.com', url: 'https://www.booking.com/hotel/es/tigaiga.html' },
      { name: 'Abama Resort Tenerife', note: 'Abama — clifftop west coast, two Michelin-star MB restaurant, golf, private beach · 9.2 Booking.com', url: 'https://www.booking.com/hotel/es/abama-resort.html' }
    ] },
    'tokyo': { h: [
      { name: 'Aman Tokyo', note: 'Aman brand — Otemachi forest tower, 33rd–35th floor rooms with Imperial Palace views, spa with indoor pool · 9.5 Booking.com' , url: 'https://www.booking.com/hotel/jp/aman-tokyo.html' },
      { name: 'The Okura Tokyo', note: 'Independent luxury — 1962 mid-century Japanese modernism, restored heritage wing, Orchid Bar, spa · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/jp/the-okura-tokyo.html' },
      { name: 'The Peninsula Tokyo', note: 'Peninsula brand — Hibiya and Marunouchi, Peter restaurant on the 24th floor, Hei Fung Terrace dim sum, spa with indoor pool · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/jp/the-peninsula-tokyo.html' },
      { name: 'Park Hyatt Tokyo', note: 'Hyatt brand — Shinjuku floors 41–52 of the Tokyo Park Tower, 14th-floor pool, New York Bar and Grill, full-service spa · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/jp/park-hyatt-tokyo.html' }
    ] },
    'toledo': { h: [
      { name: 'Áurea Toledo by Eurostars', note: 'Independent — Bajada Pozo Amargo below the cathedral, spa, 24h reception, AC · 9.3 Booking.com', url: 'https://www.booking.com/hotel/es/aurea-toledo.html' },
      { name: 'Eurostars Palacio Buenavista', note: 'Eurostars Hotels — Buenavista Palace 3 km west of the walls, outdoor pool, spa, city panoramas · 9.0 Booking.com', url: 'https://www.booking.com/hotel/es/eurostars-buenavista.html' },
      { name: 'Posada Sillería', note: 'Independent boutique — Calle Sillería inside the walls, 24h reception, restaurant · 9.0 Booking.com', url: 'https://www.booking.com/hotel/es/posada-de-la-silleria.html' },
      { name: 'AC Hotel Ciudad de Toledo by Marriott', note: 'Marriott AC Hotels — Carretera de Circunvalación on the south rim with the El Greco panorama, restaurant, free parking · 8.2 Booking.com', url: 'https://www.booking.com/hotel/es/acciudaddetoledo.html' }
    ] },
    'toronto': { h: [
      { name: 'The Hazelton Hotel', note: 'Independent luxury — Yorkville, private cinema, ONE Restaurant by Mark McEwan, spa · 9.3 Booking.com' , url: 'https://www.booking.com/hotel/ca/the-hazelton.html' },
      { name: 'Four Seasons Hotel Toronto', note: 'Four Seasons brand — Yorkville, outdoor pool, Café Boulud, spa, gallery-level art collection · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/ca/four-seasons-hotel-toronto.html' },
      { name: 'Shangri-La Hotel Toronto', note: 'Shangri-La brand — University Avenue, indoor pool, CHI Spa, Bosk restaurant, close to the Financial District and Eaton Centre · 9.1 Booking.com' , url: 'https://www.booking.com/hotel/ca/shangri-la-toronto.html' },
      { name: 'Fairmont Royal York', note: 'Fairmont brand — 1929 Front Street landmark opposite Union Station, indoor pool, spa, Library Bar, city-centre heritage · 8.6 Booking.com' , url: 'https://www.booking.com/hotel/ca/fairmont-royal-york.html' }
    ] },
    'tromso': { h: [
      { name: 'Scandic Ishavshotel', note: 'Scandic brand — Arctic Ocean waterfront, panoramic views of the fjord and Tromsø Cathedral', url: 'https://www.expedia.com/Tromso-Hotels-Scandic-Ishavshotel.h54318.Hotel-Information' },
      { name: 'Clarion Hotel The Edge', note: 'Nordic Choice Hotels — waterfront, restaurants and bar overlooking the harbor and mountains', url: 'https://www.strawberry.no/hotell/norge/tromso/clarion-hotel-the-edge/' },
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
      { name: 'Grace Bay Club', note: 'Independent — Grace Bay beachfront on Providenciales, three properties, pool, Infiniti Bar & Grill · 9.6 Booking.com', url: 'https://www.booking.com/hotel/tc/grace-bay-club.html' },
      { name: 'COMO Parrot Cay', note: 'COMO brand — private island 30 min by boat, COMO Shambhala spa, pool villas, dive centre · 9.5 Booking.com', url: 'https://www.booking.com/hotel/tc/como-parrot-cay.html' },
      { name: 'The Shore Club · Turks & Caicos', note: 'Independent luxury — Grace Bay beachfront, 22-acre estate, three pools, private beach club, three restaurants · 9.2 Booking.com', url: 'https://www.booking.com/hotel/tc/the-shore-club-turks-amp-caicos.html' },
      { name: 'The Ritz-Carlton · Turks & Caicos', note: 'Marriott Ritz-Carlton — Grace Bay Road on Providenciales, 88 butler-service suites, private beach, Sugar Mill spa · 8.6 Booking.com', url: 'https://www.booking.com/hotel/tc/the-ritz-carlton-turks-caicos.html' }
    ] },
    'valletta': { h: [
      { name: 'The Phoenicia Malta', note: 'Small Luxury Hotels — 1947 landmark at city gate, outdoor pool in formal gardens, Malta\'s most storied hotel · 9.1 Booking.com', url: 'https://www.booking.com/hotel/mt/the-phoenicia-malta.html' },
      { name: 'Ursulino Malta', note: 'Independent boutique — within the historic city walls, curated rooms, intimate boutique atmosphere · 9.3 Booking.com', url: 'https://www.booking.com/hotel/mt/ursulino-valletta.html' },
      { name: 'Rosselli AX Privilege', note: 'AX Hotels — 17th-century Baroque palazzo in old Valletta, Michelin-starred Under Grain restaurant, personal butler service · 9.3 Booking.com', url: 'https://www.booking.com/hotel/mt/rosselli-valletta.html' },
      { name: 'Grand Hotel Excelsior', note: 'Preferred Hotels & Resorts — outside Valletta city gate, views of Marsamxett Harbour, outdoor pool, full-service spa · 8.8 Booking.com', url: 'https://www.booking.com/hotel/mt/excelsior-grand-malta.html' }
    ] },
    'vancouver': { h: [
      { name: 'Fairmont Hotel Vancouver', note: 'Fairmont brand — 1939 "Castle in the City," spa, Notch8 Restaurant & Bar, iconic copper roof · 8.9 Booking.com', url: 'https://www.booking.com/hotel/ca/fairmont-vancouver.html' },
      { name: 'Rosewood Hotel Georgia', note: 'Rosewood brand — 1927 Georgian Revival downtown landmark, outdoor pool, Hawksworth Restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ca/rosewood-hotel-georgia.html' },
      { name: 'Wedgewood Hotel & Spa', note: 'Independent — Robson Square, intimate boutique, spa, Bacchus restaurant · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ca/wedgewood.html' },
      { name: 'Four Seasons Hotel Vancouver', note: 'Four Seasons — Georgia Street connected to Pacific Centre, outdoor heated pool, Yew seafood + bar · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ca/four-seasons-vancouver.html' },
      { name: 'JW Marriott Parq Vancouver', note: 'Marriott JW brand — 39 Smithe Street in downtown Yaletown, rooftop pool, Pacific Rim views, connected to Parq casino · 8.8 Booking.com', url: 'https://www.booking.com/hotel/ca/jw-marriott-parq-vancouver.html' }
    ] },
    'venice': { h: [
      { name: 'Belmond Hotel Cipriani', note: 'Belmond brand — Giudecca island, 7-minute private launch, Olympic-size pool, award-winning Oro Restaurant · 9.5 Booking.com', url: 'https://www.booking.com/hotel/it/cipriani-venezia.html' },
      { name: 'Aman Venice', note: 'Aman brand — 16th-century Palazzo Papadopoli on the Grand Canal, two private gardens, private dock', url: 'https://www.aman.com/hotels/aman-venice' },
      { name: 'The Gritti Palace, a Luxury Collection Resort', note: 'Marriott Luxury Collection — 1475 Doge\'s palace on the Grand Canal, Club del Doge restaurant · 9.5 Booking.com', url: 'https://www.booking.com/hotel/it/the-gritti-palace.html' },
      { name: 'Hotel Danieli, a Luxury Collection Hotel', note: 'Marriott Luxury Collection — 1350 Gothic palace near the Doge\'s Palace, rooftop Terrazza Danieli · 9.3 Booking.com', url: 'https://www.booking.com/hotel/it/danielivenezia.html' }
    ] },
    'verona': { h: [
      { name: 'Due Torri Hotel', note: 'Autograph Collection (Marriott) — 14th-century palazzo near Piazza Brà, antique-furnished rooms, Arena Opera views · 9.1 Booking.com', url: 'https://www.booking.com/hotel/it/due-torri-hotel.html' },
      { name: 'Hotel Gabbia d\'Oro', note: 'Independent boutique — 17th-century noble palazzo near Piazza delle Erbe, antique beds, garden courtyard · 9.0 Booking.com', url: 'https://www.booking.com/hotel/it/gabbia-d-oro.html' },
      { name: 'NH Collection Verona Grand Hotel Palazzo di Verona', note: 'NH Collection brand — 18th-century Palazzo on Piazza San Zeno, rooftop terrace, central location · 9.0 Booking.com', url: 'https://www.booking.com/hotel/it/nh-verona-due-torri.html' },
      { name: 'Hotel Accademia', note: 'Independent — Via Scala near the Arena, garden courtyard, Il Carroarmato restaurant · 8.7 Booking.com', url: 'https://www.booking.com/hotel/it/accademia-verona.html' }
    ] },
    'victoria': { h: [
      { name: 'The Fairmont Empress', note: 'Fairmont brand — 1908 Inner Harbour landmark, spa, Bengal Lounge, afternoon tea tradition · 9.0 Booking.com', url: 'https://www.booking.com/hotel/ca/fairmont-empress.html' },
      { name: 'Inn at Laurel Point', note: 'Independent boutique — waterfront on the Inner Harbour, adults-preferred, Japanese meditation garden · 9.2 Booking.com', url: 'https://www.booking.com/hotel/ca/inn-at-laurel-point.html' },
      { name: 'Magnolia Hotel & Spa', note: 'Independent — Courtney Street heritage district, rooftop hot tub, Opus Restaurant, full spa · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ca/magnolia.html' },
      { name: 'Hotel Grand Pacific Victoria', note: 'Independent — Inner Harbour, indoor pool, harbour views, Active Club fitness centre · 8.9 Booking.com', url: 'https://www.booking.com/hotel/ca/hotel-grand-pacific.html' },
      { name: 'DoubleTree by Hilton Hotel & Suites Victoria', note: 'Hilton DoubleTree — 777 Douglas Street downtown, rooftop terrace, outdoor heated pool, steps from Empress and Inner Harbour · 8.3 Booking.com', url: 'https://www.booking.com/hotel/ca/doubletree-by-hilton-victoria.html' }
    ] },
    'vienna': { h: [
      { name: 'Hotel Imperial, a Luxury Collection Hotel, Vienna', note: 'Marriott Luxury Collection — 1863 Crown Prince Rudolf\'s palace on Ringstrasse, Café Imperial tradition · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/at/imperial.html' },
      { name: 'Park Hyatt Vienna', note: 'Hyatt brand — 1913 Austro-Hungarian bank vault converted to spa and indoor pool, Das Loft restaurant · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/at/park-hyatt-vienna.html' },
      { name: 'Hotel Sacher Wien', note: 'Independent — Philharmonikerstraße beside the Opera, iconic Sacher Torte heritage, Rote Bar and Anna Sacher restaurants, spa · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/at/sacher.html' },
      { name: 'Palais Coburg Residenz', note: 'Independent — 1845 Coburg Palace in the First District, suites only (35), wine cellar with 60,000 bottles, pool and spa · 9.5 Booking.com' , url: 'https://www.booking.com/hotel/at/palais-coburg-residenz.html' }
    ] },
    'virgin-islands': { h: [
      { name: 'Sugar Bay Resort & Spa', note: 'IHG brand — Sugar Bay Beach, hillside pools and water slides, full-service spa, St. Thomas East End', url: 'https://www.sugarbayresortandspa.com/' },
      { name: 'Point Pleasant Resort', note: 'Independent boutique — Estate Smith Bay hilltop, studio apartments and suites with bay views, snorkel beach', url: 'https://www.pointpleasantresort.com/' },
      { name: 'Buoy Haus Beach Resort St Thomas, Autograph Collection', note: 'Marriott Autograph Collection — Frenchman\'s Bay beachfront, St. Thomas, infinity pool, snorkel beach, 24h reception · 9.1 Booking.com', url: 'https://www.booking.com/hotel/vi/morningstar-buoy-haus-beach-resort-at-frenchmans-reef-autograph-collection.html' },
      { name: 'Caneel Bay, A Rosewood Resort', note: 'Rosewood brand — St. John National Park, seven beaches, adults-only pool, tropical garden', url: 'https://caneelbay.com/' }
    ] },
    'washington-dc': { h: [
      { name: 'Rosewood Washington D.C.', note: 'Rosewood brand — Georgetown neighborhood, outdoor pool, acclaimed Wyld restaurant, townhouse suites · 9.4 Booking.com' , url: 'https://www.booking.com/hotel/us/rosewood-washington-dc.html' },
      { name: 'Four Seasons Hotel Washington DC', note: 'Four Seasons brand — Georgetown, outdoor pool, M Restaurant, spa, Embassy Row adjacent · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/us/four-seasons-hotel-washington-dc.html' },
      { name: 'The Hay-Adams', note: 'Independent — 16th Street NW with direct White House views, Off the Record bar, Lafayette dining, intimate historic character · 9.2 Booking.com' , url: 'https://www.booking.com/hotel/us/hay-adams.html' },
      { name: 'Waldorf Astoria Washington DC', note: 'Hilton brand — converted Old Post Office Building on Pennsylvania Avenue NW, indoor pool, Peacock Alley, central DC landmark · 9.0 Booking.com' , url: 'https://www.booking.com/hotel/us/waldorf-astoria-washington-dc.html' }
    ] },
    'wellington': { h: [
      { name: 'Sofitel Wellington', note: 'Sofitel brand — 11 Bolton Street at the Parliament end of the CBD, valet parking and concierge, walk to the Botanic Garden · 8.8 Booking.com', url: 'https://www.booking.com/hotel/nz/sofitel-wellington.html' },
      { name: 'DoubleTree by Hilton Wellington', note: 'Hilton family — 28 Grey Street on the corner of Lambton Quay, in the middle of the shopping strip and two blocks off the waterfront · 8.8 Booking.com', url: 'https://www.booking.com/hotel/nz/doubletree-by-hilton-wellington.html' },
      { name: 'Novotel Wellington', note: 'Novotel brand — 133-137 The Terrace, one block above Lambton Quay and the cable car base · 8.1 Booking.com', url: 'https://www.booking.com/hotel/nz/capital-wellington.html' },
      { name: 'Bolton Hotel', note: 'Independent — corner of Bolton and Mowbray Streets beside the Botanic Garden, year-round indoor pool, sauna and hot tub · 8.8 Booking.com', url: 'https://www.booking.com/hotel/nz/bolton.html' }
    ] },
    'whistler': { h: [
      { name: 'Four Seasons Resort and Residences Whistler', note: 'Four Seasons brand — ski-in/ski-out base of Blackcomb, outdoor heated pool, spa · 9.3 Booking.com', url: 'https://www.booking.com/hotel/ca/four-seasons-whistler.html' },
      { name: 'Nita Lake Lodge', note: 'Independent boutique — Nita Lake waterfront, cross-country trail access, spa, quiet Creekside enclave · 9.4 Booking.com', url: 'https://www.booking.com/hotel/ca/nita-lake-lodge.html' },
      { name: 'Fairmont Chateau Whistler', note: 'Fairmont brand — ski-in/ski-out at Blackcomb, heated outdoor pool, Mallard Lounge, spa · 9.1 Booking.com', url: 'https://www.booking.com/hotel/ca/fairmont-chateau-whistler.html' },
      { name: 'Westin Resort & Spa Whistler', note: 'Marriott Westin — Whistler Village, outdoor heated pool, Aubergine Grille, Heavenly Spa · 9.1 Booking.com', url: 'https://www.booking.com/hotel/ca/westin-resort-and-spa-whistler.html' }
    ] },
    'yellowstone': { h: [
      { name: 'Old Faithful Inn', note: 'Independent — 1904 historic log lodge beside Old Faithful geyser, National Historic Landmark', url: 'https://www.yellowstonenationalparklodges.com/lodging/summer-lodges/old-faithful-inn/' },
      { name: 'Lake Yellowstone Hotel', note: 'Independent — 1891 lakefront colonial structure, panoramic Yellowstone Lake views, inside the park', url: 'https://www.yellowstonenationalparklodges.com/lodging/summer-lodges/lake-yellowstone-hotel/' },
      { name: 'Canyon Lodge & Cabins', note: 'Independent — largest lodging complex inside Yellowstone, central location near Grand Canyon of the Yellowstone, cabin and motel room options', url: 'https://www.yellowstonenationalparklodges.com/lodging/summer-lodges/canyon-lodge-and-cabins/' },
      { name: 'Roosevelt Lodge Cabins', note: 'Independent — rustic frontier cabins in the northeast quadrant near Lamar Valley, Old West cookouts, closest lodge to Tower Fall · 8.5 Expedia', url: 'https://www.yellowstonenationalparklodges.com/lodging/summer-lodges/roosevelt-lodge-cabins/' }
    ] },
    'zakynthos': { h: [
      { name: 'Lesante Blu Exclusive Beach Resort', note: 'Leading Hotels of the World — Tragaki beachfront adults-only, heated infinity pool, spa, Ionian Sea views · 9.3 Booking.com', url: 'https://www.booking.com/hotel/gr/lesante-blu-exclusive-beach-resort.html' },
      { name: 'Contessina Hotel', note: 'Independent — Tsilivi beachfront, three pools, spa, three restaurants, swim-up suites · 9.4 Booking.com', url: 'https://www.booking.com/hotel/gr/contessina.html' },
      { name: 'Ionian Blue Bungalows & Spa Resort', note: 'Independent — Alykes beachfront, seafront pool, spa, Ionian Grill · 9.0 Booking.com', url: 'https://www.booking.com/hotel/gr/ionian-blue-bungalows-spa-resort.html' },
      { name: 'Domes Aulus Zante · Autograph Collection', note: 'Marriott Autograph Collection — all-inclusive on Laganas Bay in Kalamaki, private beach, thalassotherapy spa, Ionian Sea views · 8.5 Booking.com', url: 'https://www.booking.com/hotel/gr/domesauluszante.html' }
    ] },
    'zhangjiajie': { h: [
      { name: 'Pullman Zhangjiajie', note: 'Accor Pullman brand — modern full-service hotel in Zhangjiajie city, pool, 30 minutes from Wulingyuan park gate', url: 'https://www.expedia.com/Zhangjiajie-Hotels-Pullman-Zhangjiajie.h3633242.Hotel-Information' },
      { name: 'Wyndham Zhangjiajie', note: 'Wyndham brand — city center near the national park, outdoor pool, international restaurant · 8.3 Booking.com', url: 'https://www.booking.com/hotel/cn/wyndham-zhangjiajie.html' },
      { name: 'InterContinental Zhangjiajie', note: 'IHG brand — city center, outdoor pool, all-day dining, views of Tianmen Mountain · 8.8 Booking.com', url: 'https://www.booking.com/hotel/cn/intercontinental-zhangjiajie.html' },
      { name: 'Hilton Garden Inn Zhangjiajie Tianmen Mountain', note: 'Hilton brand — Yongding District at the foot of Tianmen Mountain, free airport shuttle, outdoor pool, 24h reception · 9.3 Booking.com', url: 'https://www.booking.com/hotel/cn/hilton-garden-inn-zhangjiajie-tianmen-mountain.html' }
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
      anLink.href = base + 'essentials/neighborhoods/#' + encodeURIComponent(anCity);
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

  /* ── Getting Around + Food Delivery — 2-column card grid ──────────────────
     Moves .extras-sub + .transit-box pairs into .neigh-card wrappers inside
     a .ga-grid. Elements are moved not cloned so _injectRowMarks still finds
     and marks .extras-sub wherever it lives. Fires for both sections. */
  function _injectGAGrid(sectionId) {
    var section = document.getElementById(sectionId);
    if (!section) return;
    var pairs = [], i, el, next;
    for (i = 0; i < section.children.length; i++) {
      el = section.children[i];
      if (!el.classList.contains('extras-sub')) continue;
      next = el.nextElementSibling;
      if (!next || !next.classList.contains('transit-box')) return;
      if (next.children.length !== 1 || next.querySelector('.stop-row')) return;
      pairs.push([el, next]);
    }
    if (pairs.length < 2) return;
    var grid = document.createElement('div');
    grid.className = 'ga-grid';
    pairs.forEach(function (pair) {
      var card = document.createElement('div');
      card.className = 'neigh-card';
      card.appendChild(pair[0]);
      card.appendChild(pair[1]);
      grid.appendChild(card);
    });
    section.appendChild(grid);
  }
  /* ── Weekly Closures — auto-fill card grid ─────────────────────────────────
     Wraps each .stop-row in a .neigh-card inside a .ga-grid.ga-auto (auto-fill
     columns that adapt from 2 to 4 entries). Only fires for 2+ stop-rows. */
  function _injectWCGrid() {
    var section = document.getElementById('weekly-closures');
    if (!section) return;
    var rows = [], i, el;
    for (i = 0; i < section.children.length; i++) {
      el = section.children[i];
      if (el.classList.contains('stop-row')) rows.push(el);
    }
    if (rows.length < 2) return;
    var grid = document.createElement('div');
    grid.className = 'ga-grid ga-auto';
    rows.forEach(function (row) {
      var card = document.createElement('div');
      card.className = 'neigh-card';
      card.appendChild(row);
      grid.appendChild(card);
    });
    section.appendChild(grid);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      _injectGAGrid('getting-around');
      _injectGAGrid('food-delivery');
      _injectWCGrid();
    });
  } else {
    _injectGAGrid('getting-around');
    _injectGAGrid('food-delivery');
    _injectWCGrid();
  }

  /* ── Best-Of cross-links — injected before #also-on-this-site on guide pages
     that appear in one or more Best-Of collections. CITY_BEST_OF_MAP is generated
     by Brain/scripts/build/build_best_of_map.py — re-run after adding a new Best-Of
     page or a new guide link inside an existing Best-Of page.
     Data is embedded directly (no XHR). Keys: city folder name, lowercased. */
  var CITY_BEST_OF_MAP = {
    'abu-dhabi': [["Amusement Parks", "amusement-parks/"], ["Architecture", "architecture/"], ["Art Museums", "art-museums/"], ["Cathedrals", "cathedrals/"], ["Observation Decks", "observation-decks/"]],
    'aix-en-provence': [["Wine Regions", "wine-regions/"]],
    'alaska': [["Caves", "caves/"], ["Hot Springs", "hot-springs/"], ["Mountains & Rock Formations", "mountains-and-rock-formations/"], ["National Parks", "national-parks-by-country/"]],
    'alesund': [["Aquariums", "aquariums/"], ["Resorts", "resorts/"]],
    'amalfi': [["Gardens", "gardens/"], ["Resorts", "resorts/"], ["UNESCO Sites", "unesco-sites/"]],
    'amsterdam': [["Art Museums", "art-museums/"], ["Cathedrals", "cathedrals/"], ["Gardens", "gardens/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Kids' Museums", "kids-museums/"], ["Unique Museums", "unique-museums/"]],
    'annecy': [["Lakes", "lakes/"]],
    'aracaju': [["Aquariums", "aquariums/"]],
    'arenal': [["Hot Springs", "hot-springs/"], ["National Parks", "national-parks-by-country/"], ["Resorts", "resorts/"], ["Ultra Luxurious Resorts", "ultra-luxurious-resorts/"], ["Volcanoes", "volcanoes/"]],
    'aruba': [["Beaches", "beaches/"], ["Islands", "islands/"]],
    'athens': [["Architecture", "architecture/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Museums", "museums/"], ["Resorts", "resorts/"], ["UNESCO Sites", "unesco-sites/"], ["Wine Regions", "wine-regions/"]],
    'atlanta': [["Aquariums", "aquariums/"]],
    'austin': [["Animal Encounters", "animal-encounters/"]],
    'azores': [["Islands", "islands/"], ["Scuba Diving", "scuba-diving/"]],
    'bahamas': [["Beaches", "beaches/"], ["Islands", "islands/"], ["Resorts", "resorts/"], ["Scuba Diving", "scuba-diving/"]],
    'bali': [["Architecture", "architecture/"], ["Beaches", "beaches/"], ["Hot Springs", "hot-springs/"], ["Islands", "islands/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Resorts", "resorts/"], ["Ultra Luxurious Resorts", "ultra-luxurious-resorts/"], ["Wonders of the World", "wonders-of-the-world/"]],
    'banff': [["Hot Springs", "hot-springs/"], ["Lakes", "lakes/"], ["National Parks", "national-parks-by-country/"], ["Ski Resorts", "ski-resorts/"]],
    'bangkok': [["Aquariums", "aquariums/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Observation Decks", "observation-decks/"], ["Resorts", "resorts/"], ["UNESCO Sites", "unesco-sites/"]],
    'barbados': [["Beaches", "beaches/"], ["Caves", "caves/"], ["Islands", "islands/"], ["Resorts", "resorts/"]],
    'barcelona': [["Amusement Parks", "amusement-parks/"], ["Aquariums", "aquariums/"], ["Architecture", "architecture/"], ["Art Museums", "art-museums/"], ["Cathedrals", "cathedrals/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Kids' Museums", "kids-museums/"], ["UNESCO Sites", "unesco-sites/"], ["Unique Museums", "unique-museums/"]],
    'beijing': [["Amusement Parks", "amusement-parks/"], ["Architecture", "architecture/"], ["Art Museums", "art-museums/"], ["Castles", "castles/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Museums", "museums/"], ["UNESCO Sites", "unesco-sites/"], ["Wonders of the World", "wonders-of-the-world/"]],
    'bend': [["Mountains & Rock Formations", "mountains-and-rock-formations/"]],
    'bergen': [["Kids' Museums", "kids-museums/"]],
    'berlin': [["Architecture", "architecture/"], ["Art Museums", "art-museums/"], ["Gardens", "gardens/"], ["Kids' Museums", "kids-museums/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Museums", "museums/"], ["Observation Decks", "observation-decks/"], ["Unique Museums", "unique-museums/"]],
    'bhutan': [["Luxurious Hotels", "most-luxurious-hotels/"], ["Ultra Luxurious Resorts", "ultra-luxurious-resorts/"]],
    'big-island': [["Beaches", "beaches/"], ["Islands", "islands/"], ["Resorts", "resorts/"], ["Volcanoes", "volcanoes/"]],
    'bilbao': [["Architecture", "architecture/"]],
    'bologna': [["Unique Museums", "unique-museums/"]],
    'bora-bora': [["Islands", "islands/"], ["Resorts", "resorts/"]],
    'bordeaux': [["Wine Regions", "wine-regions/"]],
    'boston': [["Aquariums", "aquariums/"], ["Art Museums", "art-museums/"], ["Kids' Museums", "kids-museums/"], ["Unique Museums", "unique-museums/"]],
    'boulder': [["Mountains & Rock Formations", "mountains-and-rock-formations/"]],
    'bruges': [["UNESCO Sites", "unesco-sites/"], ["Unique Museums", "unique-museums/"]],
    'brussels': [["Cathedrals", "cathedrals/"], ["Unique Museums", "unique-museums/"]],
    'budapest': [["Castles", "castles/"], ["Cathedrals", "cathedrals/"], ["Hot Springs", "hot-springs/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["UNESCO Sites", "unesco-sites/"], ["Wine Regions", "wine-regions/"]],
    'buenos-aires': [["Art Museums", "art-museums/"], ["Lakes", "lakes/"], ["Mountains & Rock Formations", "mountains-and-rock-formations/"], ["Wine Regions", "wine-regions/"]],
    'busan': [["Hot Springs", "hot-springs/"]],
    'cairo': [["Architecture", "architecture/"], ["Castles", "castles/"], ["Mountains & Rock Formations", "mountains-and-rock-formations/"], ["Museums", "museums/"], ["UNESCO Sites", "unesco-sites/"], ["Wonders of the World", "wonders-of-the-world/"]],
    'cambridge': [["Architecture", "architecture/"]],
    'cancun': [["Kid-Friendly Destinations", "kids-friendly-places/"]],
    'cannes': [["Resorts", "resorts/"]],
    'cape-cod': [["Beaches", "beaches/"]],
    'cape-town': [["Aquariums", "aquariums/"], ["Beaches", "beaches/"], ["Gardens", "gardens/"], ["Mountains & Rock Formations", "mountains-and-rock-formations/"], ["National Parks", "national-parks-by-country/"], ["Observation Decks", "observation-decks/"], ["Resorts", "resorts/"], ["UNESCO Sites", "unesco-sites/"], ["Wine Regions", "wine-regions/"], ["Wonders of the World", "wonders-of-the-world/"]],
    'capri': [["Caves", "caves/"], ["Islands", "islands/"]],
    'carmel-by-the-sea': [["Resorts", "resorts/"]],
    'cascais': [["Beaches", "beaches/"]],
    'cayman-islands': [["Beaches", "beaches/"], ["Islands", "islands/"], ["Scuba Diving", "scuba-diving/"]],
    'charlotte': [["Unique Museums", "unique-museums/"]],
    'chiang-mai': [["Resorts", "resorts/"]],
    'chicago': [["Aquariums", "aquariums/"], ["Art Museums", "art-museums/"], ["Gardens", "gardens/"], ["Museums", "museums/"], ["Observation Decks", "observation-decks/"]],
    'chongqing': [["UNESCO Sites", "unesco-sites/"]],
    'cinque-terre': [["UNESCO Sites", "unesco-sites/"]],
    'coeur-dalene': [["Lakes", "lakes/"]],
    'colmar': [["Wine Regions", "wine-regions/"]],
    'cologne': [["Architecture", "architecture/"], ["Cathedrals", "cathedrals/"], ["Unique Museums", "unique-museums/"]],
    'colombo': [["Resorts", "resorts/"], ["Safari", "safari/"]],
    'columbia': [["Architecture", "architecture/"]],
    'copenhagen': [["Amusement Parks", "amusement-parks/"], ["Aquariums", "aquariums/"], ["Cathedrals", "cathedrals/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Kids' Museums", "kids-museums/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Unique Museums", "unique-museums/"]],
    'corfu': [["UNESCO Sites", "unesco-sites/"]],
    'crete': [["Beaches", "beaches/"], ["Islands", "islands/"]],
    'curacao': [["Caves", "caves/"], ["Islands", "islands/"]],
    'curitiba': [["Gardens", "gardens/"]],
    'cusco': [["Architecture", "architecture/"], ["Lakes", "lakes/"], ["Mountains & Rock Formations", "mountains-and-rock-formations/"], ["Resorts", "resorts/"]],
    'dallas': [["Kids' Museums", "kids-museums/"]],
    'denver': [["Kids' Museums", "kids-museums/"]],
    'doha': [["Art Museums", "art-museums/"]],
    'dubai': [["Aquariums", "aquariums/"], ["Architecture", "architecture/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Observation Decks", "observation-decks/"], ["Resorts", "resorts/"]],
    'dublin': [["Castles", "castles/"], ["Cathedrals", "cathedrals/"], ["Unique Museums", "unique-museums/"]],
    'dubrovnik': [["Castles", "castles/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["UNESCO Sites", "unesco-sites/"]],
    'edinburgh': [["Castles", "castles/"], ["Cathedrals", "cathedrals/"], ["Gardens", "gardens/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Museums", "museums/"], ["UNESCO Sites", "unesco-sites/"], ["Unique Museums", "unique-museums/"]],
    'florence': [["Architecture", "architecture/"], ["Art Museums", "art-museums/"], ["Cathedrals", "cathedrals/"], ["Gardens", "gardens/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["UNESCO Sites", "unesco-sites/"], ["Wine Regions", "wine-regions/"]],
    'florianopolis': [["Beaches", "beaches/"]],
    'florida-keys': [["Scuba Diving", "scuba-diving/"]],
    'fortaleza': [["Beaches", "beaches/"]],
    'foz-do-iguaçu': [["UNESCO Sites", "unesco-sites/"], ["Wonders of the World", "wonders-of-the-world/"]],
    'frankfurt': [["Art Museums", "art-museums/"]],
    'galapagos-islands': [["Animal Encounters", "animal-encounters/"], ["Islands", "islands/"], ["National Parks", "national-parks-by-country/"], ["Scuba Diving", "scuba-diving/"], ["UNESCO Sites", "unesco-sites/"]],
    'geneva': [["Lakes", "lakes/"]],
    'glacier-national-park': [["National Parks", "national-parks-by-country/"]],
    'glasgow': [["Castles", "castles/"]],
    'gothenburg': [["Amusement Parks", "amusement-parks/"]],
    'granada': [["Architecture", "architecture/"], ["Castles", "castles/"], ["Gardens", "gardens/"], ["UNESCO Sites", "unesco-sites/"]],
    'hamburg': [["Unique Museums", "unique-museums/"]],
    'hanoi': [["Caves", "caves/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["UNESCO Sites", "unesco-sites/"], ["Wonders of the World", "wonders-of-the-world/"]],
    'helsinki': [["Cathedrals", "cathedrals/"]],
    'hilton-head-island': [["Kid-Friendly Destinations", "kids-friendly-places/"]],
    'hiroshima': [["Animal Encounters", "animal-encounters/"]],
    'hoi-an': [["UNESCO Sites", "unesco-sites/"]],
    'hong-kong': [["Luxurious Hotels", "most-luxurious-hotels/"], ["Observation Decks", "observation-decks/"]],
    'istanbul': [["Architecture", "architecture/"], ["Castles", "castles/"], ["Cathedrals", "cathedrals/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Museums", "museums/"], ["Observation Decks", "observation-decks/"], ["Resorts", "resorts/"], ["UNESCO Sites", "unesco-sites/"]],
    'joão-pessoa': [["Gardens", "gardens/"]],
    'kauai': [["Beaches", "beaches/"]],
    'keywest': [["Unique Museums", "unique-museums/"]],
    'kotor': [["UNESCO Sites", "unesco-sites/"]],
    'kraków': [["Cathedrals", "cathedrals/"]],
    'kyoto': [["Cathedrals", "cathedrals/"], ["Gardens", "gardens/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Resorts", "resorts/"], ["UNESCO Sites", "unesco-sites/"], ["Unique Museums", "unique-museums/"]],
    'la-jolla': [["Aquariums", "aquariums/"], ["Architecture", "architecture/"], ["Beaches", "beaches/"]],
    'lagos': [["Caves", "caves/"]],
    'lake-como': [["Gardens", "gardens/"], ["Lakes", "lakes/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Resorts", "resorts/"]],
    'lake-tahoe': [["Lakes", "lakes/"]],
    'las-vegas': [["Observation Decks", "observation-decks/"], ["Unique Museums", "unique-museums/"]],
    'lecce': [["Architecture", "architecture/"]],
    'lille': [["Art Museums", "art-museums/"]],
    'lima': [["Cathedrals", "cathedrals/"], ["Museums", "museums/"], ["UNESCO Sites", "unesco-sites/"]],
    'lisbon': [["Aquariums", "aquariums/"], ["Castles", "castles/"], ["Cathedrals", "cathedrals/"], ["Caves", "caves/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Observation Decks", "observation-decks/"], ["Wine Regions", "wine-regions/"]],
    'ljubljana': [["Caves", "caves/"], ["Lakes", "lakes/"]],
    'london': [["Architecture", "architecture/"], ["Art Museums", "art-museums/"], ["Castles", "castles/"], ["Cathedrals", "cathedrals/"], ["Gardens", "gardens/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Kids' Museums", "kids-museums/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Museums", "museums/"], ["Observation Decks", "observation-decks/"], ["Unique Museums", "unique-museums/"]],
    'los-angeles': [["Amusement Parks", "amusement-parks/"], ["Architecture", "architecture/"], ["Art Museums", "art-museums/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Museums", "museums/"], ["Resorts", "resorts/"], ["Unique Museums", "unique-museums/"]],
    'los-cabos': [["Beaches", "beaches/"], ["Luxurious Hotels", "most-luxurious-hotels/"]],
    'luang-prabang': [["UNESCO Sites", "unesco-sites/"]],
    'lucerne': [["Lakes", "lakes/"], ["Mountains & Rock Formations", "mountains-and-rock-formations/"], ["Resorts", "resorts/"]],
    'luxembourg': [["Castles", "castles/"]],
    'lyon': [["Cathedrals", "cathedrals/"], ["Wine Regions", "wine-regions/"]],
    'maceió': [["Beaches", "beaches/"]],
    'machupicchu': [["Luxurious Hotels", "most-luxurious-hotels/"], ["UNESCO Sites", "unesco-sites/"], ["Wonders of the World", "wonders-of-the-world/"]],
    'madeira': [["Islands", "islands/"]],
    'madrid': [["Art Museums", "art-museums/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Museums", "museums/"]],
    'malaga': [["Castles", "castles/"]],
    'maldives': [["Beaches", "beaches/"], ["Islands", "islands/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Resorts", "resorts/"], ["Scuba Diving", "scuba-diving/"]],
    'malibu': [["Beaches", "beaches/"]],
    'manuel-antonio': [["Kid-Friendly Destinations", "kids-friendly-places/"]],
    'marco-island': [["Beaches", "beaches/"]],
    'marktoberdorf': [["Castles", "castles/"]],
    'marrakech': [["Cathedrals", "cathedrals/"], ["Gardens", "gardens/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Resorts", "resorts/"], ["UNESCO Sites", "unesco-sites/"], ["Ultra Luxurious Resorts", "ultra-luxurious-resorts/"]],
    'marseille': [["Castles", "castles/"], ["Wine Regions", "wine-regions/"]],
    'maui': [["Beaches", "beaches/"], ["Islands", "islands/"], ["Resorts", "resorts/"], ["Volcanoes", "volcanoes/"]],
    'melbourne': [["Gardens", "gardens/"], ["Hot Springs", "hot-springs/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Kids' Museums", "kids-museums/"], ["Observation Decks", "observation-decks/"], ["Resorts", "resorts/"]],
    'miami': [["Architecture", "architecture/"]],
    'milan': [["Architecture", "architecture/"], ["Art Museums", "art-museums/"], ["Castles", "castles/"], ["Cathedrals", "cathedrals/"], ["Kids' Museums", "kids-museums/"], ["Luxurious Hotels", "most-luxurious-hotels/"]],
    'monaco': [["Luxurious Hotels", "most-luxurious-hotels/"]],
    'montevideo': [["Architecture", "architecture/"]],
    'montreal': [["Cathedrals", "cathedrals/"], ["Gardens", "gardens/"], ["Kid-Friendly Destinations", "kids-friendly-places/"]],
    'munich': [["Architecture", "architecture/"], ["Museums", "museums/"], ["Unique Museums", "unique-museums/"]],
    'muscat': [["Luxurious Hotels", "most-luxurious-hotels/"]],
    'mykonos': [["Islands", "islands/"], ["Resorts", "resorts/"]],
    'napa': [["Wine Regions", "wine-regions/"]],
    'naples': [["Cathedrals", "cathedrals/"], ["Volcanoes", "volcanoes/"]],
    'naples-florida': [["Gardens", "gardens/"]],
    'nashville': [["Unique Museums", "unique-museums/"]],
    'natal': [["Beaches", "beaches/"]],
    'new-orleans': [["Unique Museums", "unique-museums/"]],
    'new-york': [["Architecture", "architecture/"], ["Art Museums", "art-museums/"], ["Cathedrals", "cathedrals/"], ["Gardens", "gardens/"], ["Kids' Museums", "kids-museums/"], ["Museums", "museums/"], ["Observation Decks", "observation-decks/"], ["UNESCO Sites", "unesco-sites/"]],
    'nice': [["Resorts", "resorts/"], ["Wine Regions", "wine-regions/"]],
    'oahu': [["Beaches", "beaches/"], ["Islands", "islands/"], ["Kid-Friendly Destinations", "kids-friendly-places/"]],
    'oaxaca': [["Hot Springs", "hot-springs/"]],
    'olinda': [["UNESCO Sites", "unesco-sites/"]],
    'orcas-island': [["Animal Encounters", "animal-encounters/"]],
    'orlando': [["Amusement Parks", "amusement-parks/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Unique Museums", "unique-museums/"]],
    'osaka': [["Amusement Parks", "amusement-parks/"], ["Aquariums", "aquariums/"], ["Castles", "castles/"], ["Observation Decks", "observation-decks/"]],
    'oslo': [["Architecture", "architecture/"], ["Unique Museums", "unique-museums/"]],
    'oxford': [["Museums", "museums/"]],
    'palawan': [["Caves", "caves/"], ["Islands", "islands/"], ["Scuba Diving", "scuba-diving/"], ["Wonders of the World", "wonders-of-the-world/"]],
    'palm-desert': [["National Parks", "national-parks-by-country/"]],
    'palo-alto': [["Unique Museums", "unique-museums/"]],
    'paris': [["Amusement Parks", "amusement-parks/"], ["Architecture", "architecture/"], ["Art Museums", "art-museums/"], ["Castles", "castles/"], ["Cathedrals", "cathedrals/"], ["Gardens", "gardens/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Kids' Museums", "kids-museums/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Museums", "museums/"], ["Observation Decks", "observation-decks/"], ["UNESCO Sites", "unesco-sites/"], ["Unique Museums", "unique-museums/"]],
    'pasadena': [["Gardens", "gardens/"]],
    'pensacola': [["Unique Museums", "unique-museums/"]],
    'petra': [["Architecture", "architecture/"], ["Mountains & Rock Formations", "mountains-and-rock-formations/"], ["UNESCO Sites", "unesco-sites/"], ["Wonders of the World", "wonders-of-the-world/"]],
    'philadelphia': [["Art Museums", "art-museums/"], ["Gardens", "gardens/"], ["Kids' Museums", "kids-museums/"], ["Unique Museums", "unique-museums/"]],
    'phoenix': [["Unique Museums", "unique-museums/"]],
    'phuket': [["Islands", "islands/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Resorts", "resorts/"], ["Scuba Diving", "scuba-diving/"]],
    'pisa': [["Cathedrals", "cathedrals/"]],
    'pokhara': [["Lakes", "lakes/"], ["Mountains & Rock Formations", "mountains-and-rock-formations/"]],
    'portland': [["Gardens", "gardens/"], ["Wine Regions", "wine-regions/"]],
    'porto': [["Cathedrals", "cathedrals/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Wine Regions", "wine-regions/"]],
    'porto-alegre': [["Architecture", "architecture/"]],
    'prague': [["Castles", "castles/"], ["Cathedrals", "cathedrals/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["UNESCO Sites", "unesco-sites/"], ["Unique Museums", "unique-museums/"]],
    'puerto-rico': [["Beaches", "beaches/"], ["Castles", "castles/"], ["Islands", "islands/"]],
    'puerto-vallarta': [["Beaches", "beaches/"]],
    'quebec-city': [["Castles", "castles/"], ["Luxurious Hotels", "most-luxurious-hotels/"]],
    'queenstown': [["Lakes", "lakes/"], ["Mountains & Rock Formations", "mountains-and-rock-formations/"], ["Resorts", "resorts/"], ["Ski Resorts", "ski-resorts/"], ["UNESCO Sites", "unesco-sites/"], ["Wine Regions", "wine-regions/"]],
    'recife': [["Museums", "museums/"]],
    'reykjavik': [["Cathedrals", "cathedrals/"], ["Caves", "caves/"], ["Hot Springs", "hot-springs/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Lakes", "lakes/"], ["Mountains & Rock Formations", "mountains-and-rock-formations/"], ["Observation Decks", "observation-decks/"], ["Resorts", "resorts/"], ["Scuba Diving", "scuba-diving/"], ["Unique Museums", "unique-museums/"], ["Volcanoes", "volcanoes/"]],
    'rhodes': [["Wonders of the World", "wonders-of-the-world/"]],
    'rio-de-janeiro': [["Beaches", "beaches/"], ["Cathedrals", "cathedrals/"], ["Gardens", "gardens/"], ["Observation Decks", "observation-decks/"], ["Wonders of the World", "wonders-of-the-world/"]],
    'rome': [["Architecture", "architecture/"], ["Art Museums", "art-museums/"], ["Castles", "castles/"], ["Cathedrals", "cathedrals/"], ["Gardens", "gardens/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Kids' Museums", "kids-museums/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["UNESCO Sites", "unesco-sites/"], ["Wonders of the World", "wonders-of-the-world/"]],
    'rotterdam': [["Architecture", "architecture/"]],
    'salvador': [["UNESCO Sites", "unesco-sites/"]],
    'salzburg': [["Castles", "castles/"], ["Cathedrals", "cathedrals/"], ["Caves", "caves/"]],
    'san-diego': [["Beaches", "beaches/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Unique Museums", "unique-museums/"]],
    'san-francisco': [["Kids' Museums", "kids-museums/"], ["Museums", "museums/"], ["Unique Museums", "unique-museums/"], ["Wine Regions", "wine-regions/"]],
    'san-jose': [["Unique Museums", "unique-museums/"]],
    'san-jose-costa-rica': [["Volcanoes", "volcanoes/"]],
    'san-juan-island': [["Animal Encounters", "animal-encounters/"]],
    'san-sebastian': [["Wine Regions", "wine-regions/"]],
    'santa-barbara': [["Surfing", "surfing/"]],
    'santa-cruz': [["Amusement Parks", "amusement-parks/"]],
    'santa-fe': [["Art Museums", "art-museums/"]],
    'santa-monica': [["Beaches", "beaches/"]],
    'santiago': [["Mountains & Rock Formations", "mountains-and-rock-formations/"], ["Resorts", "resorts/"], ["Wine Regions", "wine-regions/"]],
    'santorini': [["Islands", "islands/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Resorts", "resorts/"]],
    'sarasota': [["Beaches", "beaches/"]],
    'sardinia': [["Islands", "islands/"]],
    'scottsdale': [["UNESCO Sites", "unesco-sites/"]],
    'seattle': [["Mountains & Rock Formations", "mountains-and-rock-formations/"], ["Observation Decks", "observation-decks/"], ["Unique Museums", "unique-museums/"], ["Volcanoes", "volcanoes/"]],
    'sedona': [["Mountains & Rock Formations", "mountains-and-rock-formations/"], ["Resorts", "resorts/"]],
    'seoul': [["Amusement Parks", "amusement-parks/"], ["Art Museums", "art-museums/"], ["Castles", "castles/"], ["Cathedrals", "cathedrals/"], ["Museums", "museums/"], ["Observation Decks", "observation-decks/"]],
    'seville': [["Cathedrals", "cathedrals/"], ["Gardens", "gardens/"]],
    'seychelles': [["Beaches", "beaches/"], ["Islands", "islands/"], ["Luxurious Hotels", "most-luxurious-hotels/"]],
    'shanghai': [["Amusement Parks", "amusement-parks/"], ["Aquariums", "aquariums/"], ["Architecture", "architecture/"], ["Gardens", "gardens/"], ["Museums", "museums/"], ["Observation Decks", "observation-decks/"]],
    'sicily': [["Cathedrals", "cathedrals/"], ["Islands", "islands/"], ["Mountains & Rock Formations", "mountains-and-rock-formations/"], ["Volcanoes", "volcanoes/"], ["Wine Regions", "wine-regions/"]],
    'siena': [["Cathedrals", "cathedrals/"], ["Wine Regions", "wine-regions/"]],
    'singapore': [["Amusement Parks", "amusement-parks/"], ["Aquariums", "aquariums/"], ["Architecture", "architecture/"], ["Cathedrals", "cathedrals/"], ["Gardens", "gardens/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Kids' Museums", "kids-museums/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Observation Decks", "observation-decks/"], ["Resorts", "resorts/"]],
    'sint-maarten': [["Beaches", "beaches/"]],
    'sintra': [["Castles", "castles/"], ["UNESCO Sites", "unesco-sites/"]],
    'sorrento': [["Luxurious Hotels", "most-luxurious-hotels/"]],
    'split': [["Cathedrals", "cathedrals/"], ["Lakes", "lakes/"]],
    'stockholm': [["Castles", "castles/"], ["Kids' Museums", "kids-museums/"], ["Unique Museums", "unique-museums/"]],
    'strasbourg': [["Cathedrals", "cathedrals/"], ["Wine Regions", "wine-regions/"]],
    'stuttgart': [["Unique Museums", "unique-museums/"]],
    'sydney': [["Aquariums", "aquariums/"], ["Architecture", "architecture/"], ["Beaches", "beaches/"], ["Cathedrals", "cathedrals/"], ["Caves", "caves/"], ["Gardens", "gardens/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Museums", "museums/"], ["Observation Decks", "observation-decks/"], ["Resorts", "resorts/"]],
    'são-luís': [["National Parks", "national-parks-by-country/"]],
    'são-paulo': [["Art Museums", "art-museums/"], ["Cathedrals", "cathedrals/"], ["Observation Decks", "observation-decks/"]],
    'taipei': [["Architecture", "architecture/"], ["Art Museums", "art-museums/"], ["Hot Springs", "hot-springs/"], ["Museums", "museums/"], ["Observation Decks", "observation-decks/"]],
    'tallinn': [["UNESCO Sites", "unesco-sites/"]],
    'tbilisi': [["Hot Springs", "hot-springs/"], ["Wine Regions", "wine-regions/"]],
    'tenerife': [["Islands", "islands/"], ["National Parks", "national-parks-by-country/"], ["Volcanoes", "volcanoes/"]],
    'tokyo': [["Amusement Parks", "amusement-parks/"], ["Architecture", "architecture/"], ["Art Museums", "art-museums/"], ["Cathedrals", "cathedrals/"], ["Gardens", "gardens/"], ["Hot Springs", "hot-springs/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Kids' Museums", "kids-museums/"], ["Lakes", "lakes/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Mountains & Rock Formations", "mountains-and-rock-formations/"], ["Museums", "museums/"], ["Observation Decks", "observation-decks/"], ["Resorts", "resorts/"], ["Unique Hotels", "unique-hotels/"], ["Unique Museums", "unique-museums/"], ["Volcanoes", "volcanoes/"]],
    'toledo': [["Cathedrals", "cathedrals/"]],
    'toronto': [["Aquariums", "aquariums/"], ["Observation Decks", "observation-decks/"], ["Unique Museums", "unique-museums/"]],
    'tromso': [["Natural Phenomena", "natural-phenomena/"]],
    'turin': [["Cathedrals", "cathedrals/"], ["Museums", "museums/"], ["Wine Regions", "wine-regions/"]],
    'turks-and-caicos': [["Resorts", "resorts/"]],
    'valletta': [["Islands", "islands/"]],
    'vancouver': [["Aquariums", "aquariums/"], ["Kid-Friendly Destinations", "kids-friendly-places/"], ["Resorts", "resorts/"]],
    'venice': [["Architecture", "architecture/"], ["Cathedrals", "cathedrals/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["UNESCO Sites", "unesco-sites/"], ["Wine Regions", "wine-regions/"]],
    'verona': [["UNESCO Sites", "unesco-sites/"], ["Wine Regions", "wine-regions/"]],
    'victoria': [["Gardens", "gardens/"]],
    'vienna': [["Architecture", "architecture/"], ["Art Museums", "art-museums/"], ["Castles", "castles/"], ["Cathedrals", "cathedrals/"], ["Gardens", "gardens/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Museums", "museums/"], ["Wine Regions", "wine-regions/"]],
    'virgin-islands': [["Islands", "islands/"], ["Resorts", "resorts/"], ["Ultra Luxurious Resorts", "ultra-luxurious-resorts/"]],
    'washington-dc': [["Art Museums", "art-museums/"], ["Cathedrals", "cathedrals/"], ["Museums", "museums/"], ["Unique Museums", "unique-museums/"]],
    'wellington': [["Lakes", "lakes/"]],
    'whistler': [["Ski Resorts", "ski-resorts/"]],
    'yellowstone': [["Hot Springs", "hot-springs/"], ["Mountains & Rock Formations", "mountains-and-rock-formations/"], ["UNESCO Sites", "unesco-sites/"], ["Volcanoes", "volcanoes/"]],
    'zakynthos': [["Beaches", "beaches/"]],
    'zhangjiajie': [["Mountains & Rock Formations", "mountains-and-rock-formations/"]],
    'zurich': [["Lakes", "lakes/"], ["Luxurious Hotels", "most-luxurious-hotels/"], ["Resorts", "resorts/"], ["Unique Museums", "unique-museums/"]]
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
    var gi = parts.findIndex(function (x) { return x.toLowerCase() === 'guides'; });
    if (gi < 0) return;
    var citySlug = parts[gi + 1].toLowerCase();
    var entries = CITY_BEST_OF_MAP[citySlug];
    if (!entries || !entries.length) return;
    var wrap = document.createElement('div');
    wrap.id = 'tve-best-of-crosslinks';
    wrap.className = 'extras-section';
    var h = document.createElement('div');
    h.className = 'extras-title';
    h.innerHTML = iconSVG(NAV_ICONS['trophy'], 15, 'trophy') + ' Best Of';
    var pills = document.createElement('div');
    pills.className = 'also-on-this-site-pills';
    entries.forEach(function (entry) {
      var a = document.createElement('a');
      a.className = 'also-on-this-site-pill';
      a.href = base + 'best-of/' + entry[1];
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
        '@media (max-width: 600px) and (pointer: coarse) {.tve-adtf{display:grid;grid-template-columns:1fr;' +
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
      lead.innerHTML = iconSVG(NAV_ICONS['train'], 15, 'train') + ' · Train Day from · ';
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
    function addPill(href, text, icoKey) {
      var a = document.createElement('a');
      a.className = 'overview-extra-link';
      a.href = href;
      if (navIcon(icoKey)) {
        a.style.cssText = 'display:inline-flex;align-items:center;gap:6px';
        var s = document.createElement('span');
        s.style.cssText = 'display:inline-flex;flex-shrink:0';
        s.innerHTML = iconSVG(navIcon(icoKey), 14, icoKey);
        a.appendChild(s);
        a.appendChild(document.createTextNode(text));
      } else {
        a.textContent = text;
      }
      row.appendChild(a);
    }
    /* 1. Also on This Site — NO PILL (owner rule 2026-08-15). The extras row
       used to carry an "Also on this site" jump pill; the section itself now
       stands alone at the bottom of the guide, where the reader meets it after
       the itinerary. Owner: "also in this site remove pill from extra sections
       and will only show in the bottom." The #also-on-this-site section is
       untouched and still required by the validators — only its shortcut in the
       Trip Overview extras row is gone. Do not re-add the pill. */
    /* 3. Nearby Guides — NO PILL (owner rule 2026-08-15), same call as "Also on
       this site" above: "nearby guide remove to be a pills on extra section
       also and will only show below in the own section too." The #nearby-guides
       section still ships, still built by build_nearby_guides.py, and still
       carries its own heading at the foot of the guide — only its shortcut in
       the Trip Overview extras row is gone. Do not re-add the pill. */
    /* 4. Alternative Hotel Recommendations — NO PILL (owner rule 2026-08-15).
       Section still ships at the bottom of the guide; only the shortcut here is removed. */
    /* 5. Also in Country — NO PILL (owner rule 2026-08-15).
       Section still ships at the bottom of the guide; only the shortcut here is removed. */
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectEndSectionPills);
  } else {
    _injectEndSectionPills();
  }

  /* ── Nearby Guides header icon ──────────────────────────────────────────
     That title is not DOM text: guide-style.css writes it with
     `#nearby-guides .extras-title:empty::before { content: "Nearby Guides" }`,
     and a ::before string cannot carry a drawn mark. Every other bottom
     section leads with one — "Also on this site" through the 💥 its fallback
     pastes, "Also in Country" through iconSVG below — so this was the single
     header on the page with nothing beside the words (owner 2026-08-14:
     "missing icon"). Writing real text plus the sprite fixes it in one move:
     the element stops being :empty, so the CSS fallback stops applying.
     Same key the Nearby Guides pill draws, so header and pill match. */
  function _injectNearbyGuidesTitle() {
    var ng = document.getElementById('nearby-guides');
    if (!ng) return;
    var t = ng.querySelector(':scope > .extras-title');
    if (!t || t.querySelector('svg')) return;
    var label = (t.textContent || '').trim() || 'Nearby Guides';
    t.innerHTML = iconSVG(navIcon('nearby-guides'), 15, 'nearby-guides') + ' ' + label;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectNearbyGuidesTitle);
  } else {
    _injectNearbyGuidesTitle();
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
      h.innerHTML = iconSVG(NAV_ICONS['map'], 15, 'map') + ' Also in ' + country;
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
      /* Also in Country nav pill removed (owner rule 2026-08-15) — section at bottom stays. */
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

  /* ── "Request a different hotel" — guide title cards ──────────────────────
     Owner rule 2026-08-15: "below the hotel in each guide write request a
     diffrent hotel and when clicks opens the person email app with the
     contact." A mailto: link under the hotel banner on every guide. It carries
     the city and the hotel currently on the card in the subject and body, so
     the reply arrives with the context already in it and the reader types only
     what they actually want.

     contact@guidemydays.com is the same address the Contact tab in ITEMS uses —
     one inbox for the site, and a mailto is never depth-prefixed with `base`.

     Injected from here rather than authored into 245 guide files: the title
     card's shape is identical on every guide, so one injection covers the fleet
     and a future wording change is one edit. Deferred to DOMContentLoaded —
     this script runs at the top of <body>, before .title-page is parsed.
     Styles (including the mobile order and the dark-mode colour) live in
     guide-style.css next to the rest of the title-card rules. */
  (function () {
    if (!isRealGuide) return;
    function buildHotelRequest() {
      var titlePage = document.querySelector('.title-page');
      if (!titlePage) return;
      var hotel = titlePage.querySelector('.title-hotel');
      if (!hotel) return;                                  /* no hotel, no ask */
      if (titlePage.querySelector('.title-hotel-request')) return;
      var cityEl = titlePage.querySelector('.title-city');
      var city = cityEl ? (cityEl.textContent || '').trim() : '';
      var hotelName = (hotel.textContent || '').trim();
      var link = document.createElement('a');
      link.className = 'title-hotel-request';
      link.href = 'mailto:contact@guidemydays.com' +
        '?subject=' + encodeURIComponent('Request a different hotel' + (city ? ' — ' + city : '')) +
        '&body=' + encodeURIComponent(
          (city ? 'Guide: ' + city + '\n' : '') +
          (hotelName ? 'Hotel on the guide: ' + hotelName + '\n' : '') +
          '\nWhat I am looking for instead:\n');
      link.textContent = 'Request a different hotel';
      var addr = titlePage.querySelector('.title-address');
      (addr || hotel).insertAdjacentElement('afterend', link);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', buildHotelRequest);
    } else {
      buildHotelRequest();
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

      /* [mark name, title-attribute label, value] — order is the reading order
         the feature was specified with; a missing fact drops its pill entirely.
         These were 🗣️ 💰 🔌 🌤️ as literal emoji until 2026-08-11. The strip is
         BUILT here rather than authored in the guide, so the render-time mark
         pass could not reach it — it has no markup to walk and the pills are
         unclassed spans. Naming the mark at the source is the fix, and it drops
         the emoji entirely rather than hiding it, because nothing reads this
         strip's textContent. Shapes come from the same guide-style.css set as
         every other mark, and from the toolbar icons of the very pages these
         facts are sourced from (Budget-Guide, Plug-Adapter-Guide, When-to-Go). */
      var items = [];
      if (facts.lang)   items.push(['language', 'Language', facts.lang]);
      if (facts.cost)   items.push(['money', 'Cost tier',
                                    facts.cost + (facts.cost_detail ? ' · ' + facts.cost_detail : '')]);
      if (facts.plug)   items.push(['plug', 'Plug type', facts.plug]);
      if (facts.months) items.push(['sun', 'Best months', facts.months]);
      if (!items.length) return;

      var isMobile = window.TVE.isPhone();
      var strip = document.createElement('div');
      strip.id = 'tve-quick-facts';
      /* Matches the weather strip's own margins so the two stack evenly. */
      strip.style.cssText =
        'display:flex;flex-wrap:wrap;gap:6px;width:100%;box-sizing:border-box;' +
        'margin:' + (isMobile ? '12px 0' : '0 0 16px') + ';';

      /* EVERY CHIP IS A STATIC LABEL — no links (owner rule 2026-08-15).
         Cost, plug and best-months used to link out to Budget-Guide,
         Plug-Adapter-Guide and When-to-Go. Owner: "The results below the
         wetaher banner in all guide mobile and desktop remove al links. This
         should not send the person to a huge list so language, plug, etc is not
         a link anymore. turns into static label." The chip already carries the
         answer for THIS city; the destination was a site-wide table the reader
         then had to search for their own city again. Desktop and mobile alike —
         do not re-add hrefs here, and do not reintroduce a QF_HREF map. */
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
        /* Coloured symbol wins when one exists — this strip builds its own mark
         and so never passes through the row sweep, exactly like the hours-band
         clock and the lounge chip. Without this branch the pill keeps the flat
         single-colour CSS mask while the rest of the page is drawn. */
      if (GM_SPRITE[it[0]]) {
        ico.className = 'gm-mk gm-mk-c';
        ico.innerHTML = '<svg viewBox="0 0 24 24"><use href="#gm-i-' + it[0] + '"/></svg>';
      } else {
        ico.className = 'gm-mk gm-mk-' + it[0];
      }
        ico.setAttribute('aria-hidden', 'true');
        /* .gm-mk sizes itself at 1em; the pill's own font-size is 12px, so the
           mark lands at 12px without a second source of truth for the size. */
        ico.style.cssText = 'line-height:1;flex-shrink:0;';
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
      pill.innerHTML = iconSVG(NAV_ICONS['exchange'], 15, 'exchange') + ' Currency';
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
      more.href = base + 'essentials/currency-guide/#' + c.id;
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

  /* ── Hotels & Flights search — collapsed pill on the action row ───────────
     A 🔎 Hotels & Flights pill appended to #ics-pill-row that expands, in
     place, into a two-tab deep-link panel: 🏨 Hotels and ✈️ Flights. Submitting
     opens a pre-filled Google Hotels / Google Flights tab. Nothing is fetched
     for results, nothing is priced here, and no booking state is stored — the
     whole feature is a well-addressed link out. That ceiling was named to the
     owner before it was built (Reports.html mockup, 2026-08-10) and accepted.

     Owner decisions this implements (2026-08-10, from the mockup's § 5):
       · one provider, Google — a second button per tab doubles the row height
         and starts to read as advertising;
       · NO "Upcoming Trips" strip — it was the only piece that added a fetch of
         Trips.html and a coupling to that page's month-block markup;
       · destination and origin each accept EITHER a place name OR an IATA code,
         the reader's choice. Three uppercase letters is read as a code; anything
         else is handed to Google as a place name and Google resolves it.
       · a code that does not exist must not complete. See _bkValidCode.

     Where the destination airport comes from: assets/airports.json, built by
     Brain/scripts/build/build_airports.py out of the FMAP block on index.html —
     the same 237 hand-picked codes behind the "By flight time from Seattle"
     view. NO NEW PER-GUIDE DATA WAS AUTHORED. Those codes carry judgement a
     generic city→airport lookup does not: Aix-en-Provence → MRS, Amalfi → NAP.
     They are Delta routings from Seattle, so a few resolve to the hub you would
     actually fly into rather than the nearest strip (Kyoto → HND, not KIX) —
     which is exactly why the field stays editable.

     Unlike the currency pill this renders on EVERY real guide: with no airport
     match the Flights tab simply starts empty rather than the pill disappearing,
     because the Hotels tab only ever needed the city name, which is on the page.
     Fetch-backed, so invisible over file:// like every other such feature (§ 34). */
  (function () {
    if (!isRealGuide) return;

    /* City name from <title>, not .title-city — the banner ships ALL CAPS
       ("KYOTO") and no generic re-caser is safe ("Rio De Janeiro"). Same
       reasoning, same source, as _cityName() in the share-day block. */
    function _bkCity() {
      var t = (document.title || '').replace(/\s+/g, ' ').trim();
      if (t) return t;
      var el = document.querySelector('.title-city');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    }

    function _bkCountry() {
      var el = document.querySelector('.title-country');
      return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    }

    /* A place string for Google: "Kyoto, Japan" beats "Kyoto" — it disambiguates
       the ~40 duplicate city names in the fleet without the reader typing. */
    function _bkPlace() {
      var c = _bkCity(), k = _bkCountry();
      return c && k ? c + ', ' + k : (c || k);
    }

    function _bkISO(d) {
      return d.getFullYear() + '-' +
        ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }

    /* Nights default to the guide's own length — a 6-day itinerary prefills 6
       nights. Clamped: a 1-day guide still needs a 1-night stay to price. */
    function _bkNights() {
      var n = document.querySelectorAll('.day-block').length;
      return Math.max(1, Math.min(n || 3, 30));
    }

    /* Three uppercase letters = the reader meant an airport code, so hold it to
       one. Anything else is a place name and always passes: the point is to
       catch a mistyped code, never to second-guess a city. */
    function _bkIsCodeShaped(v) {
      return /^[A-Za-z]{3}$/.test(String(v || '').trim());
    }

    function _bkValidCode(v, codes) {
      return codes.indexOf(String(v).trim().toUpperCase()) !== -1;
    }

    /* Google Flights needs "SEA airport", not bare "SEA", to parse a code on the
       destination side — see the long note at the query builder. Place names are
       passed through untouched. */
    function _bkForGoogle(v) {
      v = String(v || '').trim();
      return _bkIsCodeShaped(v) ? v.toUpperCase() + ' airport' : v;
    }

    function _bkJSON(key, file, cb) {
      try {
        var hit = sessionStorage.getItem(key);
        /* Deferred by a macrotask for the reason § 36 documents at length: a
           warm sessionStorage hit would otherwise resolve synchronously inside
           this feature's own DOMContentLoaded handler, before _extrasOutOfCard
           has lifted #ics-pill-row out of .overview-section — and the panel
           would be inserted beside the row's old position, then stranded inside
           the Trip Overview card when the row moved. Cold loads looked fine. */
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

    function _bkBuild(ap) {
      if (document.getElementById('tve-book-pill')) return;
      var row = document.getElementById('ics-pill-row');
      if (!row) return;

      var codes = (ap && ap.codes) || [];
      var destAir = (ap && ap._by_slug && ap._by_slug[curr]) || '';
      var place = _bkPlace();
      if (!place && !destAir) return;   /* nothing to search for */

      var today = new Date();
      var inD = new Date(today.getTime() + 30 * 864e5);
      var outD = new Date(inD.getTime() + _bkNights() * 864e5);

      /* ── Pill ── */
      var pill = document.createElement('a');
      pill.href = 'javascript:void(0)';
      pill.className = 'overview-extra-link';
      pill.id = 'tve-book-pill';
      pill.innerHTML = iconSVG(NAV_ICONS['search'], 15, 'search') + ' Hotels & Flights';
      pill.setAttribute('aria-expanded', 'false');
      pill.setAttribute('aria-controls', 'tve-book-panel');
      pill.style.setProperty('flex', '1 1 0', 'important');
      pill.style.setProperty('min-width', '0', 'important');
      pill.style.setProperty('align-items', 'center', 'important');
      pill.style.setProperty('justify-content', 'center', 'important');
      pill.style.setProperty('text-align', 'center', 'important');

      /* ── Panel ── */
      var panel = document.createElement('div');
      panel.className = 'tve-book-panel';
      panel.id = 'tve-book-panel';
      panel.hidden = true;

      var tabs = document.createElement('div');
      tabs.className = 'tve-book-tabs';
      tabs.setAttribute('role', 'tablist');

      function _tab(label, key, icoKey) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'tve-book-tab';
        if (navIcon(icoKey)) {
          b.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:5px';
          var _ts = document.createElement('span');
          _ts.style.cssText = 'display:inline-flex;flex-shrink:0';
          _ts.innerHTML = iconSVG(navIcon(icoKey), 13, icoKey);
          b.appendChild(_ts);
          b.appendChild(document.createTextNode(label));
        } else {
          b.textContent = label;
        }
        b.setAttribute('role', 'tab');
        b.dataset.tab = key;
        tabs.appendChild(b);
        return b;
      }
      var tabH = _tab('Hotels', 'h', 'hotel');
      var tabF = _tab('Flights', 'f', 'plane');
      panel.appendChild(tabs);

      function _grid() {
        var g = document.createElement('div');
        g.className = 'tve-book-grid';
        return g;
      }

      function _field(grid, label, value, type, aria) {
        var wrap = document.createElement('label');
        wrap.className = 'tve-book-field';
        var tag = document.createElement('span');
        tag.className = 'tve-book-lab';
        tag.textContent = label;
        var input = document.createElement('input');
        input.className = 'tve-book-in';
        input.type = type || 'text';
        input.value = value || '';
        input.setAttribute('aria-label', aria || label);
        if (type === 'number') { input.min = '1'; input.max = '8'; }
        wrap.appendChild(tag);
        wrap.appendChild(input);
        grid.appendChild(wrap);
        return input;
      }

      var gH = _grid();
      var hDest = _field(gH, 'Destination', place, 'text', 'Hotel destination — city or airport code');
      var hIn = _field(gH, 'Check-in', _bkISO(inD), 'date', 'Check-in date');
      var hOut = _field(gH, 'Check-out', _bkISO(outD), 'date', 'Check-out date');
      var hPax = _field(gH, 'Guests', '2', 'number', 'Number of guests');
      panel.appendChild(gH);

      var gF = _grid();
      var fFrom = _field(gF, 'From', '', 'text', 'Origin airport — type a city or a code');
      var fTo = _field(gF, 'To', destAir || '', 'text', 'Destination airport — type a city or a code');
      var fDep = _field(gF, 'Depart', _bkISO(inD), 'date', 'Departure date');
      var fRet = _field(gF, 'Return', _bkISO(outD), 'date', 'Return date');
      gF.hidden = true;
      panel.appendChild(gF);

      /* The reader's home airport is typed once, not once per guide. */
      var savedOrigin = '';
      try { savedOrigin = localStorage.getItem('tve_book_origin') || ''; } catch (e) {}

      /* ── Airport picker ───────────────────────────────────────────────────
         Owner, 2026-08-10, after typing "bahia" into From and watching it sail
         through: a free-typed place name was never validated at all, so the
         "a code that does not exist wont complete" rule only ever covered
         code-shaped input. The hole is closed by RESOLUTION rather than by
         restriction — the owner's first instinct was to accept codes only, and
         that would have shut out every reader who knows "Seattle" but not SEA,
         which is most of them.

         So both Flights fields now resolve to a real airport before the search
         can run: type anything, pick from the list, and the field holds a code.
         Nothing else is accepted. The Hotels destination is deliberately NOT a
         picker — a hotel search wants a place, and "Kyoto, Japan" is exactly
         right there; forcing it through an airport list would be worse.

         airport_names.json is fetched on FIRST KEYSTROKE in one of these two
         fields, never on page load: it is 152 KB against airports.json's 25 KB,
         and the overwhelming majority of readers never open the Flights tab. */
      var namesRows = null, namesPending = false;
      /* The 198 airports the site itself uses — see major_codes() in
         build_airports.py. Boosted in the picker because neither OurAirports'
         size tier nor alphabetical order knows that CDG matters more than Le
         Bourget, or Heathrow more than Gatwick. */
      var majorSet = {};
      ((ap && ap.major) || []).forEach(function (c) { majorSet[c] = 1; });

      function _bkLoadNames(then) {
        if (namesRows) { then(); return; }
        if (namesPending) return;
        namesPending = true;
        _bkJSON('tveapn', 'airport_names.json', function (d) {
          namesRows = (d && d.a) || [];
          namesPending = false;
          then();
        });
      }

      /* Ranking, accent-folding and the 8-row cut all live in TVE.home.lookup
         (top of this file) — the home-city picker on the landing page needs the
         identical behaviour, and two copies of a ranking table drift. Typing
         "sea" must surface SEA, not Seahawk Regional; typing "bahia" must
         surface the Bahía airports rather than nothing at all. */
      function _bkMatches(q) {
        return window.TVE.home.lookup(q, namesRows, majorSet);
      }

      /* Attach a dropdown to one field. Returns a handle carrying the resolved
         code, which is the ONLY thing the query builder is allowed to use. */
      function _bkPicker(input, initialCode) {
        var wrap = input.parentNode;             /* .tve-book-field */
        wrap.classList.add('tve-book-pick');
        var list = document.createElement('ul');
        list.className = 'tve-book-list';
        list.hidden = true;
        list.setAttribute('role', 'listbox');
        wrap.appendChild(list);

        var h = { code: initialCode || '', input: input };
        var rows = [], active = -1;

        function _label(r) { return r[1] + ' (' + r[0] + ') · ' + r[2]; }

        function _close() { list.hidden = true; active = -1; }

        function _choose(r) {
          h.code = r[0];
          input.value = _label(r);
          _close();
          _render();
        }

        function _paint() {
          list.textContent = '';
          rows.forEach(function (r, i) {
            var li = document.createElement('li');
            li.className = 'tve-book-opt' + (i === active ? ' tve-book-opt-on' : '');
            li.setAttribute('role', 'option');
            li.textContent = _label(r);
            /* mousedown, not click: blur fires first on click and would close
               the list before the selection ever lands. */
            li.addEventListener('mousedown', function (e) { e.preventDefault(); _choose(r); });
            list.appendChild(li);
          });
          list.hidden = rows.length === 0;
        }

        function _search() {
          h.code = '';                 /* typing invalidates any prior pick */
          var q = input.value.trim();
          if (!q) { rows = []; _paint(); _render(); return; }
          _bkLoadNames(function () {
            rows = _bkMatches(q);
            active = rows.length ? 0 : -1;
            _paint();
            _render();
          });
          _render();
        }

        input.addEventListener('input', _search);
        input.addEventListener('focus', function () { if (rows.length) list.hidden = false; });
        input.addEventListener('blur', function () { setTimeout(_close, 120); });
        input.addEventListener('keydown', function (e) {
          if (list.hidden || !rows.length) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % rows.length; _paint(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + rows.length) % rows.length; _paint(); }
          else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); _choose(rows[active]); }
          else if (e.key === 'Escape') { _close(); }
        });

        h.reset = function (code) {
          h.code = code || '';
          input.value = code || '';
          _close();
        };
        return h;
      }

      /* A saved origin is a CODE, so it is restored as an already-resolved pick
         rather than as text the reader would have to re-choose every guide. */
      if (savedOrigin && _bkValidCode(savedOrigin, codes)) fFrom.value = savedOrigin;
      var pFrom = _bkPicker(fFrom, _bkValidCode(savedOrigin, codes) ? savedOrigin : '');
      var pTo = _bkPicker(fTo, destAir || '');

      var go = document.createElement('a');
      go.className = 'tve-book-go';
      go.target = '_blank';
      go.rel = 'noopener';
      panel.appendChild(go);

      var note = document.createElement('div');
      note.className = 'tve-book-note';
      panel.appendChild(note);

      var mode = 'h';

      /* Every field that can carry a code is checked, and the FIRST bad one is
         named. Returning the offending input (not just a boolean) is what lets
         the message say "LHX is not an airport code" instead of "check your
         input" — the reader has to know WHICH box is wrong to fix it. */
      function _firstBadCode() {
        if (mode === 'h') {
          var v = hDest.value.trim();
          return (v && _bkIsCodeShaped(v) && !_bkValidCode(v, codes)) ? hDest : null;
        }
        /* Flights: a field is good only when the picker RESOLVED it, or when the
           reader typed a bare code that is genuinely on the list. Free text no
           longer passes — that was the "bahia" hole. */
        var pairs = [[fFrom, pFrom], [fTo, pTo]];
        for (var i = 0; i < pairs.length; i++) {
          var el = pairs[i][0], pk = pairs[i][1], val = el.value.trim();
          if (!val) continue;
          if (pk.code) continue;
          if (_bkIsCodeShaped(val) && _bkValidCode(val, codes)) { pk.code = val.toUpperCase(); continue; }
          return el;
        }
        return null;
      }

      function _render() {
        var bad = _firstBadCode();
        [hDest, fFrom, fTo].forEach(function (el) { el.classList.remove('tve-book-bad'); });

        if (bad) {
          bad.classList.add('tve-book-bad');
          go.classList.add('tve-book-off');
          go.removeAttribute('href');
          go.textContent = mode === 'h' ? 'Search Hotels ›' : 'Search Flights ›';
          var badVal = bad.value.trim();
          note.textContent = _bkIsCodeShaped(badVal)
            ? '"' + badVal.toUpperCase() + '" is not an airport code. Try a city name instead.'
            : 'Pick an airport from the list for "' + badVal + '".';
          return;
        }

        go.classList.remove('tve-book-off');
        note.textContent = '';

        if (mode === 'h') {
          var dest = hDest.value.trim() || place;
          go.href = 'https://www.google.com/travel/search?q=' + encodeURIComponent(dest) +
            '&checkin=' + hIn.value + '&checkout=' + hOut.value +
            '&adults=' + (parseInt(hPax.value, 10) || 2);
          go.textContent = 'Search Hotels ›';
          /* No standing caption. The note line carries ONLY the two blocking
             messages now (bad code / missing origin) — owner, 2026-08-10. Any
             text under the button now means something needs fixing, rather than
             sharing a voice with boilerplate the reader has learned to skip.
             .tve-book-note:empty collapses the panel gap so removing the
             sentence leaves no dead band. */
        } else {
          /* The visible value is a human label ("Seattle (SEA) · US"); the code
             is what Google gets. Never send the label — it reintroduces exactly
             the ambiguity the picker exists to remove. */
          var to = pTo.code || destAir;
          var from = pFrom.code;
          try { if (from) localStorage.setItem('tve_book_origin', from); } catch (e) {}
          if (!fFrom.value.trim()) {
            go.classList.add('tve-book-off');
            go.removeAttribute('href');
            go.textContent = 'Search Flights ›';
            note.textContent = 'Add where you are flying from — a city or an airport code.';
            return;
          }
          /* ⚠️ TWO THINGS HERE ARE LOAD-BEARING. Both were measured against the
             live Google Flights on 2026-08-10, and both look like fussy string
             formatting until you try the combination that breaks.

             1. WORD ORDER — "from X to Y", never "to Y from X".
                  "Flights from SEA to HND on … through …" → Seattle to Tokyo ✅
                  "Flights to HND from SEA on … through …" → generic landing
                                                page, destination dropped ❌
                Place names survive either order, so the reversed form tests
                clean right up until someone types a code.

             2. THE WORD "airport" AFTER A CODE. A bare 3-letter code parses as
                an origin but not always as a destination:
                  "from SEA to Kyoto"          → generic landing page ❌
                  "from SEA airport to Kyoto"  → Seattle to Kyoto      ✅
                Suffixing every code-shaped token is uniform and verified across
                all four combinations (code→code, city→city, code→city,
                city→code), which a narrower "only when mixed" rule was not.

             Both halves of the owner's "a city OR a code, reader's choice" rule
             depend on these two lines staying exactly as they are. */
          go.href = 'https://www.google.com/travel/flights?q=' + encodeURIComponent(
            'Flights from ' + _bkForGoogle(from) + ' to ' + _bkForGoogle(to) +
            ' on ' + fDep.value + ' through ' + fRet.value);
          go.textContent = 'Search Flights ›';
        }
      }

      function _select(which) {
        mode = which;
        tabH.setAttribute('aria-selected', which === 'h' ? 'true' : 'false');
        tabF.setAttribute('aria-selected', which === 'f' ? 'true' : 'false');
        gH.hidden = which !== 'h';
        gF.hidden = which !== 'f';
        _render();
      }
      tabH.addEventListener('click', function () { _select('h'); });
      tabF.addEventListener('click', function () { _select('f'); });

      [hDest, hIn, hOut, hPax, fFrom, fTo, fDep, fRet].forEach(function (el) {
        el.addEventListener('input', _render);
        el.addEventListener('change', _render);
      });

      /* A disabled-looking <a> with no href is still clickable in some AT; kill
         the activation outright rather than relying on the missing href. */
      go.addEventListener('click', function (e) {
        if (go.classList.contains('tve-book-off')) { e.preventDefault(); }
      });

      pill.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        /* Re-anchor at click time — same insurance § 36 added after the panel
           was found stranded when the row moved on warm loads. */
        if (pill.parentNode && pill.parentNode.nextSibling !== panel) {
          pill.parentNode.parentNode.insertBefore(panel, pill.parentNode.nextSibling);
        }
        var open = panel.hidden;
        panel.hidden = !open;
        pill.classList.toggle('tve-book-on', open);
        pill.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) (mode === 'h' ? hDest : fFrom).focus();
      });

      /* iOS does not reliably fire :active on <a>; same shim the rest of the row uses. */
      pill.addEventListener('touchstart', function () {
        pill.classList.add('tve-pressed');
        pill.style.setProperty('color', '#fff', 'important');
        pill.style.setProperty('-webkit-text-fill-color', '#fff', 'important');
      }, { passive: true });
      function _bkUnpress() {
        pill.classList.remove('tve-pressed');
        pill.style.removeProperty('color');
        pill.style.removeProperty('-webkit-text-fill-color');
      }
      pill.addEventListener('touchend', function () { setTimeout(_bkUnpress, 300); }, { passive: true });
      pill.addEventListener('touchcancel', _bkUnpress, { passive: true });

      _select('h');

      /* ⚠️ Pill ORDER must not depend on which fetch returns first. This pill
         and 💱 Currency are both appended from async callbacks, so a plain
         appendChild in each makes the row order a race — Currency sixth on one
         load, seventh on the next, visibly reshuffling between page loads on
         the same guide. Anchoring to Currency instead of appending pins the
         order whichever way the race falls: if Currency is already there we go
         before it, and if it arrives later it appends after us. */
      var curPill = document.getElementById('tve-cur-pill');
      if (curPill && curPill.parentNode === row) {
        row.insertBefore(pill, curPill);
      } else {
        row.appendChild(pill);
      }
      /* SIBLING of the row, never a child: #ics-pill-row is a flex row on
         desktop and a 2-column grid on mobile, so a block child would be laid
         out as another pill in both. */
      row.parentNode.insertBefore(panel, row.nextSibling);
    }

    function _bkRun() { _bkJSON('tveap', 'airports.json', _bkBuild); }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _bkRun);
    } else {
      _bkRun();
    }
  })();

  /* ── Weather widget — loaded on the Guides index ONLY ─────────────────────
     weather.js lives in assets/ (permanent home). On the index it adds the
     🌡 Weather control in the title banner (city picker + monthly high/low
     panel) and per-guide hover weather on the cards. Deliberately NOT loaded
     on individual guide pages. Bump the ?v= below whenever weather.js changes
     so the browser refreshes it (it has no version tag on the page itself). */
  /* 2026-08-14: the guides listing moved to /guides/index.html and the site
     root became a landing page. `curr` is only the BASENAME, so both pages
     answer to 'index.html' — this has to test the path or weather.js loads
     on the landing page, which has no cards for it to attach to. */
  var _isGuidesIndex = curr === 'Guides-Index.html' ||
                       /\/guides\/(index\.html)?$/i.test(location.pathname);
  if (_isGuidesIndex) {
    var _wx = document.createElement('script');
    _wx.src = base + 'assets/weather.js?v=4';
    document.head.appendChild(_wx);
  }

  /* ── Sticky stop-name strip — REMOVED (owner rule 2026-08-15) ─────────────
     #tve-stop-strip was a fixed 28px bar pinned to the top of the viewport
     that named the stop currently being read ("📍 1. Panthéon") once its
     header scrolled past. Owner: "when we scroll a pin shows on top of the
     guide with the name of the stop remove this pin ... we have that now when
     we click on the picture." It also fought the toolbar, which became
     position:sticky on mobile in this same pass — two bars stacking at the top
     of every guide. Do not re-inject it. */

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
      var isMobile = window.TVE.isPhone();

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
         (this one and .day-jump-btn at its mobile breakpoint; the four back
         pills that shared it were removed 2026-08-15). The family ran at 34/17
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
      '@media (min-width: 601px), (pointer: fine) {#tve-bo-jump,#tve-bo-ov{display:none!important}}';
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

  /* ── Map "← All Guides" pill — REMOVED (owner rule 2026-08-15) ───────────
     #tve-map-back was the last of the mobile-only floating back controls.
     Owner: "remove all navigation made by us use the native one for mobile."
     A reader who opened a map from the toolbar leaves it with the phone's own
     back gesture; the hamburger reaches every destination going forward. */

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
      /* Terracotta, not grey (owner 2026-08-10). #a8a09a was quiet enough that
         readers were missing that the three stop actions exist at all; the
         brand terracotta reads as "there is something here" without shouting.
         Dark mode lifts to #d4874a: #b85c2a sits at 2.6:1 on the #2a2825 card,
         the same lift the pullquote border and .free-flag already take.

         ONE LANGUAGE ACROSS ALL THREE ICONS: outline = off, SOLID = on, and
         hover fills solid to show you what clicking would give you (owner:
         "when selecting should hover full terracotta like the bookmark so we
         know we selected"). Hover used to just darken the stroke to #7a3b1e,
         which is a 1px colour shift on a 14px outline — invisible in practice.
         Filling the glyph changes its whole silhouette, so it reads instantly
         and it reads without colour vision. */
      '.tve-share-stop-btn{background:none;border:none;cursor:pointer;' +
      'color:#b85c2a;padding:0;margin-left:12px;line-height:1;vertical-align:middle;' +
      'display:inline-flex;align-items:center;flex-shrink:0;transition:color .15s;}' +
      '.tve-share-stop-btn svg{transition:fill .15s;}' +
      '.tve-share-stop-btn:hover svg,.tve-share-stop-btn:focus-visible svg{fill:currentColor;}' +
      '@media (prefers-color-scheme:dark){.tve-share-stop-btn{color:#d4874a;}}' +
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
        if (header) stopActionRail(header).appendChild(btn);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _setup);
    } else {
      _setup();
    }
  }
  _injectShareStopButtons();

  /* ── Row marks — 📍 / 🚶 / 🚕 drawn instead of Apple emoji (owner 2026-08-11) ─
     Owner, on the motion row: "do this rows … has the walk and car time from
     stops to stops", and on the address row: "pin needs to get done too".

     The emoji is WRAPPED, never replaced. Each glyph gets a hidden
     .gm-mk-src span next to a .gm-mk mark, so the row's textContent comes out
     byte-identical. That is deliberate and load-bearing — three consumers read
     these rows as text and would break on a substitution:
       · _injectAddrCopy  — `textContent.trimStart().startsWith('📍')`
       · _injectShareStopButtons — `textContent.indexOf('📍') >= 0`
       · the ICS + clipboard exports, which rebuild '📍 ' + addr
     Registering last is belt-and-braces on top of that, not the mechanism.

     Guide HTML is untouched. The glyphs stay authored in all 245 guides where
     Motion Rule.html and Icon Order and Format.html govern them and the
     validators read them off disk — this is render-time only, exactly like the
     ⏰ duration chip and the 🏛 hours band. Marks are drawn in guide-style.css.

     Scope is deliberately narrow: motion rows, and box rows that LEAD with 📍.
     A .stop-row of prose can legitimately contain any of these glyphs and is
     left alone. 🚤 🚢 🚊 🚝 🚆 🚡 (about 50 rows, car-free and rail cities) have
     no mask yet and still render as emoji — they are not in MARKS. */
  function _injectRowMarks() {
    /* The isRealGuide gate used to sit HERE, on the first line, so this whole
       function was a no-op on every non-guide page. That is why the budget
       chips on index.html still showed Apple emoji although 💰 and ✨ have had
       marks for months (owner 2026-08-12) — the missing selector was the
       obvious cause and not the real one. The gate now sits below, after the
       shared machinery, so a non-guide surface can opt in explicitly by name.
       It is NOT removed: every sweep below it targets guide structure
       (.tour-box, .stop-row, .extras-*), and Trip-Essentials pages carry some
       of those class names without loading guide-style.css — running them
       there would replace visible emoji with 1em spans that have no
       mask-image, i.e. blank. Add a surface here one selector at a time, and
       only once its stylesheet carries the .gm-mk rules. */
    var MARKS = {
      /* Holiday-Chooser + climate filter chips on index.html — the last
         emoji a reader actually saw. All of these resolve to GM_SPRITE keys,
         so markRow draws <use href="#gm-i-KEY"> and NO css mask is needed;
         that is what blocked the previous pass, which only had the mask path
         in mind and would have blanked the row. */
      '🏖': 'beach',  /* Beach chip */
      '🌲': 'pine-forest-chip',  /* Nature chip */
      '🎨': 'artframe',  /* Art & museums chip */
      '🌃': 'night-sky',  /* Nightlife chip */
      '🏝': 'island',  /* Islands chip */
      '🎿': 'ski',  /* Snow / ski chip */
      '🍷': 'wine',  /* Wine chip */
      '🛝': 'kids',  /* Kids friendly chip */
      '🎢': 'ferris',  /* Amusement chip */
      '🌴': 'palm',  /* Hot & humid chip */
      '☀': 'sun-clear',  /* Warm & sunny chip */
      '🌤': 'partly-cloudy',  /* Mild chip */
      '🍂': 'leaf-autumn',  /* Cool chip */
      '❄': 'snowflake',  /* Cold chip */

      /* Mid-range budget chip on index.html — the only 💳 anywhere under
         Travel-Website/. Mask lives in guides-index-style.css, and a copy sits
         in guide-style.css so a guide that authors one later draws a card
         instead of a blank span. */
      '💳': 'card',
      '📍': 'pin',
      '🚶': 'walk',
      '🚕': 'ride',
      '🚗': 'delivery-car',       /* a few guides author the car — same mark */
      '🚐': 'van',        /* tour hotel-pickup row, 548 fleet-wide */
      '🏨': 'hotel',      /* the other half of that row */
      /* extras-sub rows. The survey is closed: across the fleet these rows
         lead with exactly six glyphs — 📅 2342 · 🚕 375 · 🚊 148 · 🚄 56 ·
         🚢 29 · 🚎 17 — so covering them leaves no mixed state in that band. */
      '📅': 'cal-export',
      '🚊': 'van',        /* tram — the van shape is a boxy vehicle front and */
      '🚎': 'van',        /* trolleybus — reads for all three at 15px */
      '🚄': 'train',
      '🚢': 'ship',
      '🚤': 'ship',       /* island transfers — Maldives et al */
      /* Tour/Day-Trip stat row: "⏳ 5 hr 30 min · 👥 Small group". */
      '⏳': 'hourglass',
      '👥': 'people',
      /* Closed-day row, position 3 — 1,436 fleet-wide and the loudest emoji
         left on a stop: the Apple sign is saturated red-and-white and sat
         directly under the terracotta clock of the hours band, so one two-row
         block rendered in two unrelated colour systems. Draws the circle-slash
         the toolbar already uses for the Scams & Traps nav entry — the owner
         picked it by pointing at that row (2026-08-11: "replace by the icon
         drawing we are using now this is the one it should be there"), so the
         site has ONE prohibition mark, not two drawings of the same idea. */
      '🚫': 'closed',
      /* Booking row — "🎫 book at: {operator}", 619 fleet-wide. U+1F3AB, NOT
         the U+1F39F 🎟 that .ticket-flag retired in 2026-08, which is exactly
         why it survived that pass and kept showing an emoji next to drawn
         siblings. Same whole-ticket silhouette as .ticket-flag. */
      '🎫': 'ticket',
      '💵': 'money',      /* "💵 Cash Only" — same shape the 💰 rows draw */
      /* 3,496 rows — one on EVERY stop, the most-repeated emoji left on the
         site. Lives on the Wikipedia link under the stop description, so it
         appeared once per stop in full Apple colour against a terracotta
         column. Reached through the .stop-row > a selector below. */
      '📖': 'book',
      /* Hours. On a STOP the authored 🏛 row is hidden and _upgradeStopHours
         redraws it as the .tve-ph band, which leads with the clock — so the
         restaurant, cafe and bar entries, which get no band, were the one
         place hours still showed the classical-building emoji, directly above
         a drawn pin. Mapping it to the SAME clock is what makes those rows
         match a stop (owner: "we are not using emojis on these anymore we need
         to match he stops look"). */
      '🏛': 'clock-stop',
      /* Caveat row, position 6 — 691 fleet-wide. It sat between the drawn free
         flag above it and the drawn pin below, the last emoji in the box. No
         warning triangle existed in NAV_ICONS (scams is a circle-slash), so
         this one is authored: a solid triangle with the bar and dot cut out by
         fill-rule evenodd, weighted to match the pin and the ticket flag. */
      '⚠': 'warn',
      /* 🗺 U+1F5FA — the All Stops Map action pill. Every other pill in that
         row (Export to Calendar, Preview Optimized, Save for Offline, I've
         Been, Hotels & Flights, Currency) is drawn by toolbar.js, but this one
         could not be: its label is authored in each guide's HTML, not in the
         ITEMS table, so the 2026-08-11 pill-row pass had to skip it and it was
         left as the one emoji in a row of drawn icons. Reaching it from here
         is exactly what a render-time pass over authored markup is for. Same
         `map` shape and viewBox the toolbar uses. Also covers the Nearby
         Guides pill, which leads with the same glyph. */
      '🗺': 'country-map',
      /* Section pills + their matching .extras-title headings (owner: "can you
         change pills after and match the sections?"). Both surfaces move on the
         same table, so a pill and the section it jumps to can never drift apart.
         Six reuse shapes already in the set; six are authored because the
         toolbar had no equivalent. the station glyph is deliberately absent — it is banned
         site-wide (CLAUDE.md twentieth non-negotiable) and the Train Stations
         pill correctly authors 🚆. */
      '🚌': 'van',          /* Getting Around */
      '🚆': 'train-station',        /* Train Stations */
      '🗓': 'wall-calendar',     /* Weekly Closures */
      '⭐': 'star',          /* Michelin · Best Of */
      '🫕': 'restaurants-hotel',  /* Restaurants Near Hotel */
      '🍽': 'restaurants',  /* Downtown Restaurants — same shape, same thing */
      '☕': 'coffee',        /* Cappuccino */
      '🍮': 'dessert',      /* Local Tastes */
      '🎭': 'theatre',      /* Shows */
      '❗': 'bang',          /* Heads Up */
      '✨': 'sparkle',      /* Worth Knowing */
      '💥': 'burst',        /* Also on this site */
      /* "Also on this site" pills + the title-card facts. Every one of these
         links to a Trip-Essentials page that ALREADY has a toolbar icon, so
         they reuse it verbatim — the pill and the nav entry for the same page
         now draw the same shape. 🏘 takes the neighbourhoods house (owner
         2026-08-11: "no idea what this icon is i cant see it" — the Apple
         glyph is three tiny houses, illegible at 15px). */
      '🌅': 'sunset',
      '🔌': 'plug',
      '💰': 'money',
      '🛡': 'safety-guide',
      '🪪': 'visas',
      '📊': 'chart',
      '🗣': 'language',
      '🕐': 'clock-stop',        /* Time Zones pill · the local-time chip */
      '🏘': 'boutique',        /* Which neighborhood to stay in */
      /* The last three emoji left on a section chip — the row the owner was
         looking at when they said "all pills should look right" (2026-08-11).
         🌍 reuses NAV_ICONS.globe so the World Map pill and the World Map nav
         entry draw the same shape; ⛲ and 🏓 are authored because no nav icon
         fits and reusing `map` would have put one silhouette on two chips in
         the same row. */
      '🌍': 'globe',        /* World Map */
      '⛲': 'cathedral',     /* Day Trips — 128 sections */
      '🏓': 'paddle'        /* Pickleball — 54 sections */
    };
    /* Built FROM MARKS rather than hand-written. The previous hand-kept
       pattern had to be edited in lockstep with the table and the two leads
       differ (📍 is \uD83D, 🏨 is \uD83C, ⏳ is BMP), which is exactly the kind
       of edit that silently half-lands. Add a row to MARKS and the matcher
       follows. Trailing ️ is swallowed into the match so the variation
       selector rides inside the hidden span instead of being left behind to
       render as a stray box. */
    var RE = new RegExp('(' + Object.keys(MARKS).map(function (k) {
      return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|') + ')️?', 'g');

    /* CSS-INJECTED TITLES. Fifteen section titles are not DOM text at all —
       guide-style.css writes them with `#tours .extras-title:empty::before {
       content: "📅 Tours" }`. Pseudo-element content is not in the DOM, so the
       walker below cannot see those glyphs and those headers were the ones
       still showing emoji after every other surface was drawn.

       Reading the computed content and writing it back as real text fixes it in
       one move: the element stops being :empty, so the ::before rule stops
       applying, and the normal mark path then treats it like any other title.
       The collapse chevron is ::after and is unaffected. */
    function materialiseTitle(t) {
      if (t.childNodes.length) return;                 /* already real text */
      var c = getComputedStyle(t, '::before').content;
      if (!c || c === 'none' || c === 'normal') return;
      c = c.replace(/^"|"$/g, '').replace(/\\([0-9a-f]{1,6}) ?/gi, function (_, h) {
        return String.fromCodePoint(parseInt(h, 16));
      });
      if (c.trim()) t.textContent = c;
    }

    /* `bare` hides the glyph WITHOUT drawing a mark in its place. Used for an
       .extras-sub whose section header already carries the same mark: Train
       Stations repeated the train on every station and Getting Around the car
       on every ride app, so the column read as one icon stamped down the page
       (owner 2026-08-11: "lets not repeat the icon below only in the header" ·
       "same for the train station leave the icon only on the tile"). The glyph
       still stays in the DOM inside .gm-mk-src — textContent is unchanged here
       for exactly the same reasons as everywhere else. */
    function markRow(row, bare, only) {
      if (row.getAttribute('data-gm-marked')) return;
      /* The band's own source rows are display:none and _upgradeStopHours
         parses them — leave them exactly as authored. Marking them would gain
         nothing visible and would put wrapper spans inside markup another
         injector reads. */
      if (row.classList.contains('tve-ph-src')) return;
      row.setAttribute('data-gm-marked', '1');
      var walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT, null);
      var texts = [], n;
      while ((n = walker.nextNode())) {
        RE.lastIndex = 0;
        if (RE.test(n.nodeValue)) texts.push(n);
      }
      texts.forEach(function (tn) {
        var s = tn.nodeValue, frag = document.createDocumentFragment();
        var last = 0, m;
        RE.lastIndex = 0;
        while ((m = RE.exec(s))) {
          /* `only` restricts a pass to one glyph, so an inline sweep can pick
             up a rating star mid-sentence without also redrawing whatever else
             the line happens to mention. */
          if (only && m[1] !== only) continue;
          if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
          if (!bare) {
            var mk = document.createElement('span');
            var mkey = MARKS[m[1]];
            /* Coloured symbol if there is one, else the original mask class.
               The wrapper span is kept either way so sizing, alignment and the
               .gm-mk selectors other injectors rely on are unchanged. */
            if (GM_SPRITE[mkey]) {
              mk.className = 'gm-mk gm-mk-c';
              mk.innerHTML = '<svg viewBox="0 0 24 24"><use href="#gm-i-' + mkey + '"/></svg>';
            } else {
              mk.className = 'gm-mk gm-mk-' + mkey;
            }
            mk.setAttribute('aria-hidden', 'true');
            frag.appendChild(mk);
          }
          var src = document.createElement('span');
          src.className = 'gm-mk-src';
          src.textContent = m[0];          /* keeps textContent identical */
          frag.appendChild(src);
          last = m.index + m[0].length;
        }
        if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
        tn.parentNode.replaceChild(frag, tn);
      });
    }

    /* ── NON-GUIDE SURFACES ─────────────────────────────────────────────────
       Runs on every page, above the guide gate. The Travel-budget filter chips
       on index.html author "💰 Budget (under $100)", "💳 Mid-range", "✨
       Premium" and were the last authored emoji on the Guides Index. Their
       stylesheet (guides-index-style.css) carries its own copy of the .gm-mk
       rules — without that this pass would blank them, so the two ship
       together.

       SCOPED TO #tt-budget-chips, NOT to .ttchip. There is a second chip row
       above it — the climate filter: 🌴 Hot & humid · ☀️ Warm & sunny · 🌤 Mild
       · 🍂 Cool · ❄️ Cold. Only 🌤 is in MARKS, and gm-mk-sun has no mask in
       guides-index-style.css, so a bare `.ttchip` sweep BLANKED that chip and
       left one drawn icon among four Apple emoji — measurably worse than the
       all-emoji row it replaced. Drawing that row means four new marks (palm,
       sun, leaf, snowflake) plus their masks; until those exist it stays
       emoji, whole and consistent. Widen this selector only together with the
       masks the widened set needs.

       Explicit wrapper, never `forEach.call(list, markRow)` — see the note on
       the motion sweep below for what that costs. */
    [].forEach.call(document.querySelectorAll('#tt-budget-chips .ttchip,#tt-climate-chips .ttchip,.hcchip'),
      function (row) { markRow(row); });

    if (!isRealGuide) return;

    /* Motion rows — every glyph in them is a mark by definition.
       NOTE the explicit wrapper. Passing `markRow` straight to forEach hands it
       (element, index, array) — which was harmless until markRow grew `bare`
       and `only` parameters, at which point every row after the first received
       bare=index and only=the NodeList. A truthy `only` makes every match hit
       `continue`, so the row was rebuilt as byte-identical plain text: no mark,
       no hidden span, and the emoji left visible. It looked like a mobile bug
       and was neither mobile nor a CSS problem. Never pass markRow by
       reference to an iterator. */
    [].forEach.call(
      document.querySelectorAll('.next,.next-tram,.next-metro,.hotel-first,.arrive-first'),
      function (row) { markRow(row); });
    /* Box rows — only where the glyph LEADS the row, matching _injectAddrCopy's
       own test, so a description that happens to mention a pin or a taxi is
       untouched. Covers the 📍 address row and the 🚶/🚕 rows that Tours, Day
       Trips, Shows and Train Stations entries carry.

       The four box families are the ones guide-style.css already groups as one
       (`.tour-box > div, .ticket-box > div, .entry-body > div, .station-box >
       div, .shows-box > div` share the row-spacing rule). Scoping to them is
       what keeps prose out: a .stop-row of description text is not a direct
       child of any of them.

       .extras-sub IS a row and is included — it is the per-entry heading that
       carries "🚕 Uber", "📅 1. {tour name}", "🚊 {tram line}". Its glyph is a
       row mark in every sense: it labels one entry, not a section.

       .extras-title and .overview-extra-link are BOTH included — the section
       heading and the pill that jumps to it (owner 2026-08-11, "can you change
       pills after and match the sections?"). They were held back at first
       precisely because they move together: the title set is mixed
       food/transport/misc, so drawing only the vehicles would have left a drawn
       bus beside an emoji fork. They ship together now, off ONE table, which is
       what keeps a pill and its section from ever drifting apart.

       NOT included: the floating "currently reading" strip, which builds its
       own '📍 ' text in _injectStopStrip rather than carrying authored markup. */
    [].forEach.call(
      document.querySelectorAll('.tour-box > div,.ticket-box > div,' +
                                '.entry-body > div,.station-box > div,.shows-box > div,' +
                                /* Train and ferry booking rows live in a .transit-box or a
                                   .train day block, neither of which was ever in this list — so
                                   610 of the 619 booking rows kept their emoji even after the
                                   glyph was given a mark. The box families are not
                                   interchangeable, and a MARKS row does nothing for a row this
                                   sweep never visits. */
                                '.transit-box > div,.train > div,' +
                                /* The Read more link, one per stop. Scoped to the anchor
                                   rather than .stop-row so a description that happens to open
                                   with a glyph is not swept — prose is not a row. */
                                '.stop-row > a,' +
                                '.extras-sub,.overview-extra-link,.extras-title,' +
                                /* .open-now-local-time is NOT here: it is built by toolbar.js
                                   and _updateLabel reassigns its textContent on a timer, which
                                   wipes any mark this pass inserts. It carries its own mark,
                                   built once beside the text span the timer updates. */
                                '.also-on-this-site-pill'),
      function (row) {
        /* CSS-injected titles carry their glyph in a ::before, invisible to the
           walker — turn them into real text before testing. No-op elsewhere. */
        if (row.classList.contains('extras-title')) materialiseTitle(row);
        var t = row.textContent.trimStart(), m;
        RE.lastIndex = 0;
        m = RE.exec(t);
        if (!m || m.index !== 0) return;
        /* An .extras-sub repeating its own section header's mark is noise: the
           column reads as one icon stamped down the page. Hide the glyph and
           draw nothing (owner 2026-08-11). Different mark = genuinely different
           information, so it stays. */
        var bare = false;
        /* NOTE — the "also on this site" pills are NOT de-duplicated here.
           _injectAlsoOnSiteIcons runs AFTER this pass, so at this point the pill
           carries no <svg> yet and there is nothing to test for; that injector
           removes the mark itself before inserting the nav icon. Do not add a
           "does the row already have an icon" test here — it reads correctly and
           does nothing. */
        if (row.classList.contains('extras-sub')) {
          var sec = row.closest('.extras-section,.worth-knowing');
          var title = sec && sec.querySelector('.extras-title');
          if (title) {
            materialiseTitle(title);
            var ht = title.textContent.trimStart(), hm;
            RE.lastIndex = 0;
            hm = RE.exec(ht);
            /* ANY mark on the header is enough — not just an identical one.
               Train Stations pairs a 🚆 header with 🚊 entries and Getting
               Around a 🚌 header with 🚕 entries, so a same-glyph test left both
               repeating down the column, which is the thing being removed. */
            if (hm && hm.index === 0) bare = true;
          }
        }
        markRow(row, bare);
      });
    /* RATING STARS MID-LINE. A row that LEADS with a glyph already has its
       star drawn, because markRow converts every mark in the row — that is why
       Tours entries came out right. Restaurant and Michelin entries lead with
       the venue name instead ("ALMA Buenos Aires · 4.4⭐ · 640+ reviews"), so
       the whole row was skipped and kept the gold Apple star mid-sentence
       (owner 2026-08-11: "the starts in the middle is a emoji"). This sweep
       picks those up, restricted to ⭐ so a description that mentions anything
       else is untouched.

       The box families are in this sweep for a second reason of their own: a
       .ticket-box booking row LEADS with a .ticket-flag span, not a glyph, so
       the leading-glyph pass above returns early on it and never reaches the
       rating star at the end of the line — "… Skip-the-Line Access · 4.7⭐ ·
       165+ reviews" kept a gold Apple star directly under a drawn ticket and a
       drawn clock (owner 2026-08-11, on that exact row). */
    [].forEach.call(
      document.querySelectorAll('.extras-sub,.entry-body > div,.shows-box > div,' +
                                '.ticket-box > div,.tour-box > div,.station-box > div'),
      function (row) { if (row.textContent.indexOf('⭐') >= 0) markRow(row, false, '⭐'); });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectRowMarks);
  } else {
    _injectRowMarks();
  }

  /* ── The booking and free ticket marks, drawn ────────────────────────────────
     .ticket-flag / .free-flag paint through a CSS mask, which is monochrome and so
     cannot carry the gradient-plus-rim treatment every neighbouring icon has. The
     mask cannot reach --c-* custom properties from inside a data URI, so the only
     way to treat them is an inline <use>, exactly as the coloured marks do.
     The class is left in place: guide markup is untouched and the mask stays as the
     fallback if this never runs. gm-drawn tells the stylesheet to drop the mask. */
  function _injectTicketFlags() {
    var pairs = [['.ticket-flag', 'ticket-solid'], ['.free-flag', 'ticket-torn']];
    for (var p = 0; p < pairs.length; p++) {
      var list = document.querySelectorAll(pairs[p][0]);
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        if (el.getAttribute('data-gm-tf')) continue;
        if (!GM_SPRITE[pairs[p][1]]) continue;
        el.setAttribute('data-gm-tf', '1');
        el.classList.add('gm-drawn');
        var sp = document.createElement('span');
        sp.className = 'gm-tf-ico';
        sp.setAttribute('aria-hidden', 'true');
        sp.innerHTML = '<svg viewBox="0 0 24 24"><use href="#gm-i-' + pairs[p][1] + '"/></svg>';
        el.insertBefore(sp, el.firstChild);
      }
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectTicketFlags);
  } else { _injectTicketFlags(); }

  /* ── "Also on this site" footer pills — icons restored as drawings ────────
     Owner 2026-08-11: "we have these toolbars everywhere that the previous crib
     by mistake removed" · "bottom for a lot of pages" · "this is the pill i was
     looking for". Commit 043c9fe6 ("decorative emoji removed site-wide") took
     the glyph off every one of these pills across 286 pages, leaving bare text.

     They are NOT restored as emoji. Each pill links to a Trip-Essentials page
     that already has a toolbar icon, so the icon is looked up from ITEMS by the
     target's filename — one source of truth, and it stays correct on its own
     when a nav icon changes. A pill whose target has no ITEMS entry simply
     stays text.

     iconSVG rather than a .gm-mk mask on purpose: the mask classes live in
     guide-style.css, which Trip-Essentials pages do not load. An inline SVG
     needs no stylesheet and works on every page this strip appears on. */
  /* ── Guides-Index pill icons — drawn, from the authored glyph ─────────────
     Owner 2026-08-11: "the website index pills lost its icons too" · "under
     trip escape lost too" · "we have most of them". Commit a4701fa3 (a SECOND
     emoji sweep, separate from 043c9fe6 which did the Trip-Essentials pages)
     stripped 76 lines of index.html — every pill, every Trip Escape option,
     and even the text of the "LOCKED ICONS: Stats = 📊, Compare = 📶" comment
     that was there to stop exactly this.

     The markup is restored, so the glyph is once again the authored source of
     truth and that comment means something again. It is never rendered: this
     pass swaps each one for the matching drawn icon, so the index chips draw
     from the same set as the toolbar, the guides and the footer pills.

     iconSVG rather than a .gm-mk mask, for the same reason as the footer
     pills: the mask classes live in guide-style.css, which the index does not
     load. ✓ and ✕ are deliberately absent — they are text glyphs with their
     own locked treatment, not emoji. */
  var INDEX_GLYPH_ICON = {
    '✈': 'plane', '🛫': 'plane', '📊': 'chart', '📶': 'compare',
    '🌆': 'triptype', '📅': 'calendar', '🗓': 'calendar', '🗣': 'language',
    '📍': 'pin', '🌐': 'globe', '🌍': 'globe', '🌎': 'globe', '🌏': 'globe',
    '🗺': 'country-map', '🏆': 'trophy', '📋': 'list', '💰': 'money', '💳': 'card',
    '🏠': 'neighborhoods', '🛡': 'safety-guide', '✨': 'star',
    '🚗': 'rental-cars', '🚕': 'rental-cars', '🚆': 'train', '🚄': 'train',
    '🚌': 'transit', '🚢': 'ship', '⛴': 'ship',
    '🏝': 'island', '🏖': 'beach', '🎿': 'ski', '🎨': 'artframe',
    '🎢': 'ferris', '🛝': 'kids', '🍽': 'restaurants', '🍷': 'wine',
    '🌴': 'palm', '🌲': 'pine-forest-chip', '🍂': 'tree', '🏛': 'unesco',
    '🌃': 'stage', '☀': 'sun', '🌤': 'sun', '❄': 'aurora', '🌡': 'sun'
  };
  function _injectIndexPillIcons() {
    var isIndex = /\/(index\.html)?$/.test(location.pathname) ||
                  document.querySelector('.pill-row, #btn-my-trips');
    if (!isIndex) return;
    var keys = Object.keys(INDEX_GLYPH_ICON);
    var RE = new RegExp('(' + keys.map(function (k) {
      return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|') + ')️?', 'g');

    var scope = document.querySelectorAll(
      '.pill-row a,.pill-row button,.disc-btn,.seg-btn,.lang-menu-item,' +
      '#btn-my-trips,#lsp-topbar,#view-compare,#continentJumpLabel,' +
      '.disc-panel button,.disc-panel a,.esc-opt,.esc-opt-label,' +
      '#theme-panel .tchip,#tt-climate-chips .ttchip');
    [].forEach.call(scope, function (el) {
      if (el.getAttribute('data-gm-ico')) return;
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      var texts = [], n;
      while ((n = walker.nextNode())) {
        RE.lastIndex = 0;
        if (RE.test(n.nodeValue)) texts.push(n);
      }
      if (!texts.length) return;
      el.setAttribute('data-gm-ico', '1');
      texts.forEach(function (tn) {
        var s = tn.nodeValue, frag = document.createDocumentFragment(), last = 0, m;
        RE.lastIndex = 0;
        while ((m = RE.exec(s))) {
          if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
          var key = INDEX_GLYPH_ICON[m[1]];
          if (navIcon(key)) {
            var sp = document.createElement('span');
            sp.innerHTML = iconSVG(navIcon(key), 13, key);
            sp.setAttribute('aria-hidden', 'true');
            sp.style.cssText = 'display:inline-block;vertical-align:-0.14em;line-height:0;';
            frag.appendChild(sp);
          }
          last = m.index + m[0].length;
        }
        if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
        tn.parentNode.replaceChild(frag, tn);
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectIndexPillIcons);
  } else {
    _injectIndexPillIcons();
  }

  function _injectAlsoOnSiteIcons() {
    /* .sibling-pill is the same idea under another class — the cross-links a
       Trip-Essentials page carries to its siblings ("Weather by city", "When to
       go", "Festival finder", "Sports calendar") across 17 pages. Neither emoji
       sweep touched those files, so unlike the footer pills these were never
       stripped; they simply never had an icon, and sat bare next to rows that
       now draw one (owner 2026-08-11: "these lost icons too"). Same href
       resolution, so no second mapping to keep in sync. External targets
       (weather.com, windy.com …) resolve to nothing and stay text. */
    var pills = document.querySelectorAll('.also-on-this-site-pill,.sibling-pill');
    if (!pills.length) return;

    /* ITEMS is the first source, but most of its entries carry no `icon` field
       at all — only the ones that needed one for the nav. These are the
       remaining pill targets, mapped to shapes that already exist in
       NAV_ICONS. Survey of every distinct target across the 286 pages that
       carry this strip; anything not listed simply stays text. */
    var PAGE_ICON = {
      'Airport-Connection-Times.html': 'plane', 'Lounges-US.html': 'plane',
      'Lounges-Europe.html': 'plane', 'Delta-Routes-Full.html': 'plane',
      'United-Routes-Full.html': 'plane', 'American-Routes-Full.html': 'plane',
      'Asia-Stats.html': 'chart', 'Caribbean-Stats.html': 'chart',
      'Europe-Stats.html': 'chart', 'South-America-Stats.html': 'chart',
      'Stats-Across-Canada.html': 'chart', 'Stats-Across-US.html': 'chart',
      'Travel-Stats.html': 'chart',
      'Baggage.html': 'luggage', 'Luggage-Storage.html': 'luggage',
      'Best-Most-Luxurious-Hotels.html': 'neighborhoods',
      'Best-Ultra-Luxurious-Resorts.html': 'neighborhoods',
      'Best-Unique-Hotels.html': 'neighborhoods', 'Best-Resorts.html': 'neighborhoods',
      'Hotels-Stays.html': 'neighborhoods', 'Neighborhoods.html': 'neighborhoods',
      'European-Train-Guide.html': 'train', 'Scenic-Train-Journeys.html': 'train',
      'Train-Passes.html': 'train',
      'Visas.html': 'visas', 'Visa-Processing-Times.html': 'visas',
      'Weather.html': 'sun', 'when-to-go/': 'sun',
      'when-to-go/': 'calendar', 'Sports-Calendar.html': 'calendar',
      'sunrise-sunset/': 'sunset', 'Time-Zones.html': 'clock',
      'Best-Amusement-Parks.html': 'ferris', 'Best-Kids-Friendly-Places.html': 'ferris',
      'Best-Islands.html': 'island', 'Budget-Guide.html': 'budget',
      'Cards-ATM.html': 'card', 'City-Transit-Cards.html': 'transit',
      'Cruise-Ships.html': 'ship', 'Currency-Guide.html': 'money',
      'Day-Trips.html': 'compass', 'Destination-Records.html': 'trophy',
      'Digital-Nomad-Visas.html': 'laptop', 'Entry-Requirements.html': 'entry-req',
      'Festival-Finder.html': 'pennant', 'First-Timer-Mistakes.html': 'first-timer',
      'Passport.html': 'passport', 'Plug-Adapter-Guide.html': 'plug',
      'Rental-Cars.html': 'rental-cars', 'Restaurants.html': 'restaurants',
      'SIM-Cards.html': 'sim', 'Safety-Guide.html': 'safety-guide',
      'Scams-By-City.html': 'scams', 'Tap-Water.html': 'tap-water',
      'Tipping-Guide.html': 'tipping', 'Tours-Tickets.html': 'tours-tickets',
      'Travel-Apps.html': 'travel-apps', 'Travel-Insurance.html': 'insurance',
      'Travel-Packing.html': 'packing', 'Trusted-Traveler.html': 'trusted',
      'Vaccines.html': 'vaccines', 'World-Map.html': 'globe',
      'Africa-Stats.html': 'chart',
      'Oceania-Stats.html': 'chart',
      'Before-You-Go.html': 'luggage'
    };
    /* ITEMS wins where it has an opinion, so a nav icon change follows here. */
    (function walk(list) {
      [].forEach.call(list || [], function (it) {
        if (!it) return;
        if (it.children) walk(it.children);
        if (it.href && it.icon) {
          PAGE_ICON[it.href.split('/').pop().split('#')[0]] = it.icon;
        }
      });
    })(ITEMS);

    [].forEach.call(pills, function (a) {
      if (a.querySelector('svg')) return;                 /* already drawn */
      var file = (a.getAttribute('href') || '').split('/').pop().split('#')[0];
      var key  = PAGE_ICON[file];
      if (!navIcon(key)) return;
      /* THE PILL MAY ALREADY CARRY A DRAWN MARK — take it out before inserting.
         The guard above only catches an <svg>, and a .gm-mk is a CSS mask on a
         SPAN, so a pill whose authored glyph is in the MARKS table came through
         it and ended up with both: the sun twice on Weather, the shield twice
         on Safety Guide, the house twice on Which neighborhood (owner
         2026-08-11: "we have double icons on these"). It could not happen
         before 2026-08-11, when nothing drew marks on these pills.

         The nav icon wins, and deliberately: a pill resolves its icon from the
         TARGET PAGE via ITEMS, so the pill and the nav entry for the same page
         always draw one shape and a nav icon change follows here automatically
         (Icon Order and Format.html § 0). The drawn mark comes off the authored
         glyph instead, which is per-guide and can drift from the nav.

         Only the LEADING mark is removed, and only once we know an icon is
         going in — a pill whose target has no PAGE_ICON entry returns above and
         keeps its drawn mark, which is the right fallback. The hidden
         .gm-mk-src span stays, so textContent is still byte-identical. */
      var firstEl = a.firstElementChild;
      if (firstEl && firstEl.classList && firstEl.classList.contains('gm-mk')) {
        firstEl.parentNode.removeChild(firstEl);
      }
      var span = document.createElement('span');
      span.innerHTML = iconSVG(navIcon(key), 13, key);
      span.setAttribute('aria-hidden', 'true');
      span.style.cssText = 'display:inline-block;vertical-align:-0.14em;margin-right:6px;line-height:0;';
      a.insertBefore(span, a.firstChild);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectAlsoOnSiteIcons);
  } else {
    _injectAlsoOnSiteIcons();
  }

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
      /* Star button in stop-header — terracotta at rest (owner 2026-08-10, same
         pass as the share and note icons; see the note on .tve-share-stop-btn).
         The saved state can no longer lean on colour ALONE now that the resting
         state is coloured too: gold-vs-terracotta at 14px is a hue difference
         most readers would not register. So saved FILLS the star as well —
         outline means off, solid means on, which needs no colour vision at
         all. Same reason the note pencil fills below.

         The star is the ONE true toggle of the three, so hover previews the
         state you would land in rather than just lighting up: unsaved + hover
         fills solid (this is what saving looks like), saved + hover EMPTIES
         back to an outline (this is what removing looks like). Without the
         inverse, a saved star and a hovered star were the same solid shape and
         there was no way to tell "already on my list" from "about to be". The
         share icon has no persistent state and the pencil opens an editor
         rather than toggling, so both simply fill on hover. */
      '.tve-wl-btn{background:none;border:none;cursor:pointer;color:#b85c2a;padding:0;margin-left:8px;' +
      'line-height:1;display:inline-flex;align-items:center;flex-shrink:0;' +
      'transition:color .15s;font-family:inherit;}' +
      '.tve-wl-btn svg{transition:fill .15s;}' +
      '.tve-wl-btn:hover svg,.tve-wl-btn:focus-visible svg{fill:currentColor;}' +
      '.tve-wl-btn.tve-wl-saved{color:' + STAR_COLOR + ';}' +
      /* The saved star is a DIFFERENT svg (_starFill), whose <path> carries its
         own fill="currentColor" presentation attribute. Inheriting a fill from
         the <svg> element — which is what every other rule here does — cannot
         reach it, so the un-fill has to name the path. A CSS rule outranks a
         presentation attribute, so no !important is needed. */
      '.tve-wl-btn.tve-wl-saved:hover svg path{fill:none;}' +
      '@media (prefers-color-scheme:dark){.tve-wl-btn{color:#d4874a;}}' +
      '.tve-wl-btn:focus-visible{outline:2px solid ' + STAR_COLOR + ';outline-offset:2px;border-radius:3px;}' +

      /* Floating FAB — sits directly above the day-jump pill (bottom:24px+36px+8px=68px).
         It used to clear the scroll-top FAB at 116px; that FAB is mobile-only from
         2026-08-10 (owner: no nav arrows on desktop), so 116px left this button
         hanging in mid-air with a 56px hole under it. Mobile keeps its own stack
         below — the FAB is still there at ≤600px. */
      '#tve-wl-fab{position:fixed;bottom:68px;right:24px;z-index:1398;display:none;align-items:center;' +
      'gap:6px;background:#231f1b;color:#f6f2ec;border:none;border-radius:20px;' +
      'padding:8px 13px 8px 10px;font-size:13px;font-weight:600;cursor:pointer;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.22);font-family:inherit;white-space:nowrap;' +
      'transition:transform .12s,box-shadow .12s;}' +
      '#tve-wl-fab:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,0,0,.28);}' +
      '#tve-wl-fab.tve-wl-fab-on{display:inline-flex;}' +
      '#tve-wl-fab-cnt{background:' + STAR_COLOR + ';color:#7a3b1e;border-radius:10px;' +
      'font-size:11px;font-weight:700;padding:0 6px;min-width:18px;text-align:center;line-height:18px;}' +

      /* Panel — anchored above the FAB (68px + 36px FAB + 16px gap) */
      '#tve-wl-panel{position:fixed;bottom:120px;right:24px;z-index:1397;width:296px;' +
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
      '@media (max-width: 600px) and (pointer: coarse) {' +
      '#tve-wl-fab{bottom:108px;right:16px;}' +
      '#tve-wl-panel{bottom:160px;right:16px;}' +
      '}' +
      /* OWNER RULE 2026-08-10: no floating pill shows on desktop — this one goes
         with the ↑ FAB and the day-jump pill (both hidden ≥601px in
         guide-style.css). The star buttons in the stop headers are unaffected,
         so saving still works at any width; only the floating review panel is
         mobile-only. */
      '@media (min-width: 601px), (pointer: fine) {#tve-wl-fab,#tve-wl-panel{display:none!important;}}';
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
        if (header) stopActionRail(header).appendChild(btn);
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
    var gi = parts.findIndex(function (x) { return x.toLowerCase() === 'guides'; });
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
      /* Pencil button in stop-header — sits last, after share and ★.
         Terracotta at rest (owner 2026-08-10, same pass as share and ★).
         .tve-note-has USED to be #b85c2a, which is now the resting colour —
         the has-a-note state would have become completely invisible. It keeps
         the colour and gains the fill instead, matching the saved star:
         outline off, solid on. Hover fills too — the pencil is not a toggle,
         it opens an editor, so there is no opposite state to preview and it
         simply lights up. A stop that already HAS a note is solid at rest, so
         hover there darkens instead of filling, which is the only way to give
         feedback on a glyph that is already full. */
      '.tve-note-btn{background:none;border:none;cursor:pointer;color:#b85c2a;padding:0;' +
      'margin-left:8px;line-height:1;display:inline-flex;align-items:center;flex-shrink:0;' +
      'transition:color .15s;font-family:inherit;}' +
      '.tve-note-btn svg{transition:fill .15s;}' +
      '.tve-note-btn:hover svg,.tve-note-btn:focus-visible svg{fill:currentColor;}' +
      '.tve-note-btn.tve-note-has{color:#b85c2a;}' +
      '.tve-note-btn.tve-note-has svg{fill:currentColor;}' +
      '.tve-note-btn.tve-note-has:hover{color:#7a3b1e;}' +
      '@media (prefers-color-scheme:dark){' +
        '.tve-note-btn,.tve-note-btn.tve-note-has{color:#d4874a;}' +
        '.tve-note-btn.tve-note-has:hover{color:#e8a468;}}' +
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
    cPrint.type = 'button'; cPrint.className = 'tve-notes-act'; cPrint.innerHTML = iconSVG(NAV_ICONS['printer'], 13, 'printer') + ' Print';
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

        stopActionRail(header).appendChild(btn);
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
  if (/\/guides\//i.test(location.pathname)
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
      /* Derive slug from URL path: …/guides/Geneva/geneva.html → "geneva" */
      var parts = location.pathname.split('/');
      var gi = parts.findIndex(function (x) { return x.toLowerCase() === 'guides'; });
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
      if (document.getElementById('tve-open-now-time')) return;

      var timeLabel = document.createElement('span');
      timeLabel.className = 'open-now-local-time';
      timeLabel.id = 'tve-open-now-time';

      /* Moved to Quick Facts pill strip (owner rule 2026-08-15) — sits beside the
         language/cost/plug/season pills above Trip Overview on both mobile and
         desktop. QF loads via XHR so it may not exist yet; observe until it does. */
      function _attachToQF() {
        var qf = document.getElementById('tve-quick-facts');
        if (qf) { qf.appendChild(timeLabel); return true; }
        return false;
      }
      if (!_attachToQF()) {
        var _qfObs = new MutationObserver(function () { if (_attachToQF()) _qfObs.disconnect(); });
        _qfObs.observe(ovSec.parentNode || document.body, { childList: true });
      }

      function _updateLabel() {
        var info = _destInfo();
        /* Rebuilt every tick rather than marked once, because this label is the
           one place _injectRowMarks cannot help: it reassigns its own content on
           a timer and would wipe any mark inserted from outside — which is why
           this clock stayed an emoji while every other clock on the page was
           drawn. The mark goes INSIDE the pill, not beside it: .open-now-row is
           justify-content:space-between, so a sibling mark lands against the far
           left edge of the card with the pill still out on the right.

           The glyph itself rides in a hidden .gm-mk-src span, so the label's
           textContent is byte-identical to what it has always been. Everything is
           REMOVED in the no-timezone case rather than blanked, because
           .open-now-local-time:empty is what hides the pill shell — a mark left
           behind would show an empty beige rectangle on every guide with no tz. */
        while (timeLabel.firstChild) timeLabel.removeChild(timeLabel.firstChild);
        if (!info.hasTz) return;
        var _mk = document.createElement('span');
        /* Same coloured-symbol swap as markRow. This site builds its own mark
           because the hours band re-renders on a timer, so it never passes
           through the row sweep. */
        if (GM_SPRITE['clock']) {
          _mk.className = 'gm-mk gm-mk-c';
          _mk.innerHTML = '<svg viewBox="0 0 24 24"><use href="#gm-i-clock-stop"/></svg>';
        } else {
          _mk.className = 'gm-mk gm-mk-clock';
        }
        _mk.setAttribute('aria-hidden', 'true');
        _mk.style.marginRight = '5px';
        var _src = document.createElement('span');
        _src.className = 'gm-mk-src';
        _src.textContent = '🕐 ';
        timeLabel.appendChild(_mk);
        timeLabel.appendChild(_src);
        timeLabel.appendChild(document.createTextNode(info.city + ' \xb7 ' + info.timeStr));
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
            /* AFTER the duration chip, not before it (owner 2026-08-10). The
               status is bare text by design; sandwiched between the round ✓
               control and the round chip it read as compressed, so the two
               pill shapes now sit together and the text closes the group.
               With no chip, it goes ahead of the share button so it still
               lands with the title rather than out on the control rail. */
            var dur = hdr.querySelector('.stop-dur');
            var share = hdr.querySelector('.tve-share-stop-btn');
            if (dur) hdr.insertBefore(badge, dur.nextSibling);
            else if (share) hdr.insertBefore(badge, share);
            else hdr.appendChild(badge);
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
    if (!/\/guides\//i.test(location.pathname)
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

    /* US airport → lowercase IATA anchor in Lounges-US.html */
    var US_IATAS = ['ATL','BOS','DTW','JFK','LAX','MSP','SAN','SEA','SFO','SLC','IAD','IAH','LGA','MIA','ORD'];
    /* EU airport → country anchor in Lounges-Europe.html */
    var EU_ANCHOR = {
      'AMS':'nl',
      'CDG':'fr','ORY':'fr','NCE':'fr','LYS':'fr',
      'LHR':'uk','LGW':'uk','MAN':'uk','EDI':'uk',
      'VIE':'at','BRU':'be',
      'DBV':'hr','SPU':'hr','ZAG':'hr',
      'CPH':'dk','HEL':'fi',
      'FRA':'de','MUC':'de','BER':'de','DUS':'de','HAM':'de',
      'ATH':'gr','HER':'gr','SKG':'gr',
      'DUB':'ie',
      'FCO':'it','MXP':'it','VCE':'it','NAP':'it',
      'LUX':'lu',
      'OSL':'no','BGO':'no',
      'LIS':'pt','OPO':'pt','FAO':'pt',
      'MAD':'es','BCN':'es','AGP':'es','PMI':'es','VLC':'es',
      'ARN':'se','GOT':'se',
      'GVA':'ch','ZRH':'ch'
    };

    function _inject() {
      var parts = location.pathname.split('/');
      var gi = parts.findIndex(function (x) { return x.toLowerCase() === 'guides'; });
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
      var href = null;
      if (US_IATAS.indexOf(info.iata) >= 0) {
        href = base + 'essentials/lounges-us/#' + info.iata.toLowerCase();
      } else if (EU_ANCHOR[info.iata]) {
        href = base + 'essentials/lounges-europe/#' + EU_ANCHOR[info.iata];
      }

      var chip = document.createElement(href ? 'a' : 'div');
      chip.className = 'lounge-arrival-chip';
      if (href) chip.href = href;
      chip.innerHTML =
        /* Drawn plane, glyph kept hidden — same contract as every other mark.
           This chip is built here rather than authored in a guide, so no MARKS
           row can reach it; it inserts its own. */
        '<span class="lac-iata"><span class="gm-mk gm-mk-c" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24"><use href="#gm-i-plane"/></svg></span><span' +
        ' style="margin-right:4px"></span><span class="gm-mk-src">✈ </span>' +
        info.iata + '</span>' +
        '<span class="lac-div">|</span>' +
        '<span class="lac-name">' + info.name + '</span>';

      dayHdr.insertAdjacentElement('afterend', chip);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _inject);
    } else {
      _inject();
    }
  }());

  /* ── Move #ics-pill-row and .overview-extras out of the white Trip Overview card.
     #ics-pill-row goes ABOVE the card (before .overview-section).
     .overview-extras goes BELOW the card (after .overview-section).
     Runs last on DOMContentLoaded so all chip injection is already complete. ── */
  (function _extrasOutOfCard() {
    function _move() {
      var ovSec = document.querySelector('.overview-section');
      if (!ovSec) return;
      var parent = ovSec.parentNode;
      var after = ovSec.nextSibling;
      var children = Array.prototype.slice.call(ovSec.children);
      children.forEach(function(child) {
        if (child.id === 'ics-pill-row') {
          parent.insertBefore(child, ovSec);   /* ABOVE Trip Overview */
        } else if (child.classList.contains('overview-extras')) {
          parent.insertBefore(child, after);   /* BELOW Trip Overview */
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
      '@media (max-width: 600px) and (pointer: coarse) {' +
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
        '#tve-stf{margin:4px 0 14px;padding-bottom:12px;' +
        'border-bottom:1px solid rgba(138,108,26,.18);}' +
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
        ':root[data-theme="dark"] #tve-stf{border-bottom-color:rgba(212,184,150,.16);}' +
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

      /* Right after the collapse/expand toggle button — chips are the first
         item inside the expanded area, on top of Day 1. injectOverviewToggle()
         runs before _setup() (it is higher in the same IIFE). Fallback
         handles the unlikely case the button is absent. */
      var toggleBtn = document.getElementById('overview-toggle-btn');
      if (toggleBtn) {
        toggleBtn.insertAdjacentElement('afterend', wrap);
      } else {
        var firstDay = document.querySelector('.day-block');
        if (firstDay) firstDay.parentNode.insertBefore(wrap, firstDay);
        else ovSec.parentNode.insertBefore(wrap, ovSec.nextSibling);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _setup);
    } else {
      _setup();
    }
  }
  _injectStopTypeFilter();

}());