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
  var CURRENT = 34;
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
    meta('theme-color', '#b85c2a');
    meta('apple-mobile-web-app-capable', 'yes');
    meta('mobile-web-app-capable', 'yes');
    meta('apple-mobile-web-app-status-bar-style', 'default');
    meta('apple-mobile-web-app-title', 'TheVoyagerExp');
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
        'padding:12px 16px 14px', 'display:flex', 'align-items:center',
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

  /* ── Links ─────────────────────────────────────────────────────────────── */
  var ITEMS = [
    null,
    { href: base + 'index.html', text: '🌐 Guides', full: '🌐 Travel Guides' },
    null,
    { href: base + 'Trip-Essentials/Travel-Packing.html', text: '👕 Packing', full: '👕 Packing Checklist' },
    null,
    { href: base + 'Trip-Essentials/Before-You-Go.html', text: '🧳 Before You Go' },
    null,
    { href: base + 'Trip-Essentials/Maps/World-Map.html', text: '🗺️ Maps', full: '🗺️ World Map' },
    null,
    { group: '📊 Stats', children: [
        { href: base + 'Trip-Essentials/Destination-Records.html',        text: '📊 Destination Records' },
        { href: base + 'Trip-Essentials/Stats-Across-US.html',            text: '📊 Stats Across US' },
        { href: base + 'Trip-Essentials/Stats-Across-Canada.html',        text: '📊 Stats Across Canada' },
        { href: base + 'Trip-Essentials/Europe-Stats.html',               text: '📊 Stats Across Europe' },
        { href: base + 'Trip-Essentials/Asia-Stats.html',                 text: '📊 Stats Across Asia' },
        { href: base + 'Trip-Essentials/South-America-Stats.html',        text: '📊 Stats Across South America' },
        { href: base + 'Trip-Essentials/Caribbean-Stats.html',            text: '📊 Stats Across the Caribbean' },
      ]},
    null,
    { group: '✈️ Flights', children: [
        { href: base + 'Trip-Essentials/Delta-Routes-SEA.html',  text: '✈️ Delta Seattle Hub' },
        { href: base + 'Trip-Essentials/Delta-Routes-Full.html', text: '✈️ Delta Full Network' },
        { href: base + 'Trip-Essentials/Lounges-US.html',        text: '💻 US Lounges' },
        { href: base + 'Trip-Essentials/Lounges-Europe.html',    text: '💻 EU Lounges' },
        { href: base + 'Trip-Essentials/Baggage.html',           text: '🛄 Baggage' },
        { href: base + 'Trip-Essentials/Trusted-Traveler.html',  text: '🛂 Global Entry & CLEAR' },
        { href: base + 'Trip-Essentials/Passport.html',          text: '📘 Passport' },
      ] },
    null,
    { group: '🚆 Trains', children: [
        { href: base + 'Trip-Essentials/European-Train-Guide.html', text: '🚆 European Train Guide', full: '🚆 European Train Guide' },
        { href: base + 'Trip-Essentials/Day-Trips.html',            text: '🚆 Day Trips by Train',  full: '🚆 Day Trips by Train'  },
      ] },
    null,
    { href: base + 'Trip-Essentials/Plug-Adapter/Plug-Adapter-Guide.html', text: '🔌 Plug Adapters', full: '🔌 Plug Adapters' },
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
        { href: base + 'Trip-Essentials/Sports-Calendar.html',   text: '🌤️ Sports Calendar' },
      ] },
    null,
    { group: '🛡️ Safety', children: [
        { href: base + 'Trip-Essentials/Safety-Guide.html',      text: '🛡️ Safety Guide' },
        { href: base + 'Trip-Essentials/Vaccines.html',          text: '💉 Vaccines' },
        { href: base + 'Trip-Essentials/Tap-Water.html',         text: '🚰 Tap Water' },
        { href: base + 'Trip-Essentials/Travel-Insurance.html',  text: '🛟 Travel Insurance' },
      ] },
    null,
    { group: '🪪 Visas', children: [
        { href: base + 'Trip-Essentials/Visas.html',                                    text: '🪪 Visas' },
        { href: base + 'Trip-Essentials/Entry-Requirements.html',                       text: '🪪 Entry Requirements' },
        { href: base + 'Trip-Essentials/Digital-Nomad-Visas.html',                        text: '🪪 Digital Nomad Visas' },
        { href: base + 'Trip-Essentials/Visa-Processing-Times.html',                    text: '🪪 Visa Processing Times' },
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
    '.tb{padding:16px 0;position:relative;top:auto;z-index:auto;margin-bottom:18px;' +
      'background:#b85c2a;' +
      'border-bottom:none;box-shadow:none;' +
      'display:flex;align-items:center}' +
    /* Site title — desktop only */
    '.tb-scroll-wrap{display:none!important}' +
    '.tb-site-title,.tb a.tb-site-title,.tb a.tb-site-title:visited,.tb a.tb-site-title:hover{flex-shrink:0;font-size:14px;font-weight:700;color:#fff!important;' +
      'letter-spacing:.08em;text-transform:uppercase;padding:5px 0;white-space:nowrap;width:220px;text-align:center;margin-left:0;background:transparent!important;text-decoration:none!important}' +
    /* Nav container — takes remaining space; width:100% on .tb-links fills it exactly */
    '.tb-inner{flex:1;padding-right:20px}' +
    /* Flex row — fills full width, edge-to-edge. No scrolling, no gap. */
    '.tb-links{display:flex;flex-wrap:nowrap;width:100%;margin:0;' +
      'gap:0;align-items:center;justify-content:space-between}' +
    /* Desktop nav links — white text on gradient bar.
       Colours use !important so a page's own `a{}` / `a:visited{}` rules
       (e.g. guide-style.css link colours) can NEVER bleed into the shared bar. */
    '.tb a,.tb a:visited{font-size:14px;font-weight:700;color:#fff!important;text-decoration:none;padding:4px 2px;' +
      'border:none;border-radius:4px;background:transparent;white-space:nowrap;flex-shrink:0;' +
      'transition:color .15s,background .15s}' +
    '.tb a:hover{color:#fff!important;background:rgba(255,255,255,0.18)}' +
    '.tb a.tb-active{color:#fff!important;background:transparent;border:1.5px solid rgba(255,255,255,0.7);border-radius:14px;padding:4px 12px;font-weight:600}' +
    /* Dropdown group (e.g. 🚆 Trains) — parent button + absolute flyout menu */
    '.tb-dd{position:relative;display:inline-flex;flex-shrink:0}' +
    '.tb-ddbtn{display:inline-flex;align-items:center;gap:3px;font-size:14px;font-weight:700;color:#fff!important;' +
      'padding:4px 2px;border:none;border-radius:4px;background:transparent;white-space:nowrap;' +
      'cursor:pointer;font-family:inherit;transition:color .15s,background .15s}' +
    '.tb-ddbtn:hover{color:#fff!important;background:rgba(255,255,255,0.18)}' +
    '.tb-ddbtn.tb-active{color:#fff!important;background:transparent;border:1.5px solid rgba(255,255,255,0.7);border-radius:14px;padding:4px 12px;font-weight:600}' +
    '.tb-dd.tb-open>.tb-ddbtn:not(.tb-active){color:#fff!important;background:rgba(255,255,255,0.13)}' +
    '.tb-caret{font-size:8px;line-height:1;transition:transform .15s}' +
    '.tb-dd.tb-open .tb-caret{transform:rotate(180deg)}' +
    /* Split dropdown — one-click link + small caret toggle */
    /* Menu is appended to <body> (not inside the overflow-clipped scroll row) and
       positioned with fixed coords on open — otherwise .tb-inner's overflow-x:auto
       forces overflow-y to clip and the flyout gets cut off. */
    '.tb-menu{position:fixed;transform:translateX(-50%);' +
      'background:#fff;border:1px solid #e6e2da;border-radius:8px;box-shadow:0 6px 22px rgba(0,0,0,.13);' +
      'padding:4px;display:none;flex-direction:column;gap:0;min-width:196px;z-index:1000}' +
    '.tb-menu.tb-menu-open{display:flex}' +
    '.tb-menu a,.tb-menu a:visited{display:block;font-size:14px;line-height:1.2;color:#3d3a32!important;text-decoration:none;padding:6px 11px;' +
      'border:none;border-radius:6px;background:transparent;white-space:nowrap}' +
    '.tb-menu a:hover{background:' + acLt + ';color:' + accent + '!important}' +
    '.tb-menu a.tb-active{background:' + acMd + ';color:' + accent + '!important;font-weight:500}' +
    /* Separator */
    '.tb-sep{display:none}' +
    /* Scroll progress bar — hidden on mobile (overlaps toolbar) */
    '.tb-progress{position:fixed;top:0;left:0;height:2px;width:0%;' +
      'background:' + accent + ';z-index:200;pointer-events:none;' +
      'transition:width .08s linear}' +
    '@media(max-width:1260px){.tb-progress{display:none}}' +
    /* Hide ham elements on desktop — mobile @media shows them */
    '.tb-ham{display:none}.tb-ham-label{display:none}.tb-ham-menu{display:none}' +
    /* Hide desktop title on mobile — hamLabel covers it there */
    '.tb-site-title{display:block}' +
    /* Mobile/tablet: hamburger menu replaces the chip row when viewport < 1350px
       (the full tab row needs ~1322px; below that it overflows and clips tabs) */
    '@media(max-width:1260px){' +
      '.tb-site-title{display:none}' +
      '.tb{position:relative;z-index:1002;padding:15px 0 14px;display:flex;align-items:center;justify-content:space-between;min-height:56px;border-bottom:none;background:#b85c2a;box-shadow:none}' +
      '.tb-inner{display:none !important}' +
      '.tb-scroll-wrap{display:none !important}' +
      '.tb::after{display:none}' +
      '.tb-ham{display:flex;align-items:center;gap:3px;cursor:pointer;' +
        'border:none;-webkit-appearance:none;appearance:none;box-shadow:none;outline:none;' +
        '-webkit-tap-highlight-color:transparent;' +
        'padding:10px 14px 10px 8px;font-size:13px;color:#fff;flex-shrink:0;margin-left:auto;line-height:1;min-height:44px}' +
      '.tb-ham:hover,.tb-ham:focus,.tb-ham:active{box-shadow:none !important;outline:none !important}' +
      /* min-height:0 overrides mobile.css's universal 40px tap-target `a{}` rule — this
         is an <a> linking to Guides-Index.html, and without the override the inflated
         block-level box pushes the text off the bar's vertical center. */
      '.tb-ham-label{display:block;min-height:0!important;flex:1;text-align:center;font-size:17px!important;font-weight:700;color:#fff;padding:0;letter-spacing:.06em;text-transform:uppercase}' +
      /* The menu is position:fixed so it stays fully on-screen as the user
         scrolls — items never disappear off the top. The toolbar (.tb) is
         NOT fixed (scrolls away as usual); only the open menu panel is fixed.
         top:0 covers the full viewport; overflow-y:auto scrolls inside the
         panel; body overflow:hidden (set by toggleHamMenu) locks page scroll
         so only the menu scrolls while it is open. */
      '.tb-ham-menu{display:none;position:fixed;top:64px;left:0;right:0;bottom:0;' +
        'background:#ffffff;border-top:1px solid #e6e2da;z-index:1001;padding:4px 0 16px;' +
        'overflow-y:auto;-webkit-overflow-scrolling:touch;' +
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
      '.tb-ham-menu a:active{background:rgba(0,0,0,.04)}' +
      '.tb-ham-menu .tb-ham-sep{height:1px;background:#e6e2da;margin:4px 24px}' +
      '.tb-ham-menu .tb-ham-hdr{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9e9688;padding:6px 24px 2px}' +
    '}' +
    '@media(max-width:600px){#tve-back-guides{padding-left:14px!important;padding-right:14px!important}' +
    '#tve-back-guides button{display:none!important}}'
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
      lab.textContent = item.group;
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
        ca.textContent = ch.text;
        if (ch.href.split('/').pop() === curr) { ca.className = 'tb-active'; groupActive = true; }
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

  var siteTitle = document.createElement('a');
  siteTitle.className = 'tb-site-title';
  siteTitle.textContent = 'The Voyager Expert';
  siteTitle.href = base + 'index.html';
  siteTitle.style.textDecoration = 'none';
  bar.appendChild(siteTitle);

  bar.appendChild(scroller);


  /* ── Prev / Next sticky nav-bar — sits just below toolbar, sticks to top ── */
  var isRealGuide = /\/Guides\//.test(location.pathname) && location.pathname.indexOf('guides_index') < 0;

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
    'width:30px;height:30px;border-radius:6px;border:1.5px solid #c4b896;' +
    'background:#ffffff;color:#6b6860;font-size:18px;line-height:1;' +
    'padding:0;text-decoration:none;flex-shrink:0;';

  /* ── Mobile hamburger menu ──────────────────────────────────────────────── */
  var hamLabel = document.createElement('a');
  hamLabel.className = 'tb-ham-label';
  hamLabel.textContent = 'THE VOYAGER EXPERT';
  hamLabel.href = base + 'index.html';
  hamLabel.style.cssText = 'text-decoration:none;color:#fff;';
  bar.appendChild(hamLabel);

  var hamBtn = document.createElement('div');
  hamBtn.className = 'tb-ham';
  hamBtn.setAttribute('role', 'button');
  hamBtn.setAttribute('aria-label', 'Menu');
  hamBtn.setAttribute('aria-expanded', 'false');
  hamBtn.setAttribute('tabindex', '0');
  hamBtn.style.cssText = 'background:#6e3117;border-radius:8px;border:none;box-shadow:none;outline:none;-webkit-tap-highlight-color:transparent;padding:11px 0;width:82px;justify-content:center;margin:0 14px 0 0;min-height:auto;cursor:pointer;user-select:none;align-items:center;gap:8px;color:#fff;flex-shrink:0;';
  hamBtn.innerHTML = '<svg width="18" height="13" viewBox="0 0 18 13" aria-hidden="true"><rect x="0" y="0" width="18" height="2.5" rx="1.25" fill="white"/><rect x="0" y="5.25" width="18" height="2.5" rx="1.25" fill="white"/><rect x="0" y="10.5" width="18" height="2.5" rx="1.25" fill="white"/></svg><span style="font-size:14px;letter-spacing:.06em;font-weight:700;color:#fff;">MENU</span>';
  bar.appendChild(hamBtn);

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
        a.textContent = ch.full || ch.text;
        if (ch.href.split('/').pop() === curr) a.className = 'tb-active';
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
      ['Luxurious Hotels',          'Best-Most-Luxurious-Hotels.html'],
      ['Mountains & Rock Formations','Best-Mountains-and-Rock-Formations.html'],
      ['Museums',                   'Best-Museums.html'],
      ['National Parks',            'Best-National-Parks-by-Country.html'],
      ['Natural Phenomena',         'Best-Natural-Phenomena.html'],
      ['Observation Decks',         'Best-Observation-Decks.html'],
      ['Resorts',                   'Best-Resorts.html'],
      ['Safari',                    'Best-Safari.html'],
      ['Scuba Diving',              'Best-Scuba-Diving.html'],
      ['Ski Resorts',               'Best-Ski-Resorts.html'],
      ['Surfing',                   'Best-Surfing.html'],
      ['Ultra Luxurious Resorts',   'Best-Ultra-Luxurious-Resorts.html'],
      ['UNESCO Sites',              'Best-UNESCO-Sites.html'],
      ['Unique Hotels',             'Best-Unique-Hotels.html'],
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
      ['Pickleball',            'Pickleball.html'],
      ['Restaurants',           'Restaurants.html'],
      ['SIM Cards',             'SIM-Cards.html'],
      ['Tipping',               'Tipping-Guide.html'],
      ['Tours & Tickets',       'Tours-Tickets.html'],
      ['Travel Apps',           'Travel-Apps.html'],
      ['Travel Guides',         'Travel-Guides.html'],
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

  var hamMenuClosedHTML = '<svg width="18" height="13" viewBox="0 0 18 13" aria-hidden="true"><rect x="0" y="0" width="18" height="2.5" rx="1.25" fill="#fff"/><rect x="0" y="5.25" width="18" height="2.5" rx="1.25" fill="#fff"/><rect x="0" y="10.5" width="18" height="2.5" rx="1.25" fill="#fff"/></svg><span style="font-size:14px;letter-spacing:.06em;font-weight:700;color:#fff;">MENU</span>';
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
      ? '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><line x1="1" y1="1" x2="13" y2="13" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><line x1="13" y1="1" x2="1" y2="13" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg><span style="font-size:12px;letter-spacing:.06em;font-weight:700;color:#fff;">CLOSE</span>'
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
    backStrip.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding:2px 32px;background:#f5f4f0;';
    var pillStyle = 'display:inline-flex;align-items:center;height:28px;padding:0 12px;' +
      'background:#fff;border:1.5px solid #c8a44a;border-radius:14px;' +
      'font-size:12px;font-weight:700;letter-spacing:.03em;color:#8a6c1a;' +
      'text-decoration:none;box-shadow:0 1px 6px rgba(0,0,0,.10);transition:color .12s,border-color .12s;';
    var backBYG = document.createElement('a');
    backBYG.href = base + 'Trip-Essentials/Before-You-Go.html' + cityHash;
    backBYG.textContent = 'Before You Go';
    backBYG.style.cssText = pillStyle;
    backBYG.addEventListener('mouseenter', function () {
      backBYG.style.color = '#b85c2a'; backBYG.style.borderColor = '#b85c2a';
    });
    backBYG.addEventListener('mouseleave', function () {
      backBYG.style.color = '#8a6c1a'; backBYG.style.borderColor = '#c8a44a';
    });
    var backGuides = document.createElement('a');
    backGuides.href = base + 'index.html';
    backGuides.textContent = '‹ All Guides';
    backGuides.style.cssText = pillStyle;
    backGuides.addEventListener('mouseenter', function () {
      backGuides.style.color = '#b85c2a'; backGuides.style.borderColor = '#b85c2a';
    });
    backGuides.addEventListener('mouseleave', function () {
      backGuides.style.color = '#8a6c1a'; backGuides.style.borderColor = '#c8a44a';
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
      'background:#fff;border:1.5px solid #c8a44a;border-radius:14px;' +
      'font-size:12px;font-weight:700;letter-spacing:.03em;color:#8a6c1a;' +
      'cursor:pointer;box-shadow:0 1px 6px rgba(0,0,0,.10);transition:color .12s,border-color .12s;' +
      'margin-right:auto;-webkit-appearance:none;box-sizing:border-box;line-height:1;font-family:inherit;';
    printBtn.addEventListener('mouseenter', function () {
      if (document.getElementById('tve-print-mode')) return;
      printBtn.style.color = '#b85c2a'; printBtn.style.borderColor = '#b85c2a';
    });
    printBtn.addEventListener('mouseleave', function () {
      if (document.getElementById('tve-print-mode')) return;
      printBtn.style.color = '#8a6c1a'; printBtn.style.borderColor = '#c8a44a';
    });
    printBtn.addEventListener('click', function () {
      var existing = document.getElementById('tve-print-mode');
      if (existing) {
        existing.parentNode.removeChild(existing);
        printBtn.textContent = '🖨 Print Guide';
        printBtn.style.color = '#8a6c1a';
        printBtn.style.borderColor = '#c8a44a';
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
          printBtn.style.color = '#8a6c1a';
          printBtn.style.borderColor = '#c8a44a';
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
       the index. Aggregator / navigation pages (CLAUDE.md: index, Before-You-Go,
       Climate-Finder, When-to-Go) have NO standalone content — a guide's chrome
       links to them ("‹ All Guides" → the index), so document.referrer is a guide
       and the pill fired. These are hubs the reader navigated AWAY to, not a page
       the guide recommends — never show the back-to-guide pill (or its desktop
       card) here. Content pages (Currency, Plug-Adapter, …) are unaffected. */
    if ({ '': 1, 'index': 1, 'guides_index': 1, 'Guides-Index': 1,
          'Before-You-Go': 1, 'Climate-Finder': 1, 'When-to-Go': 1 }[thisPage]) return;
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
        'display:inline-flex;align-items:center;height:34px;padding:0 14px;' +
        'background:#fff;border:1.5px solid #c8a44a;border-radius:17px;' +
        'font-size:13px;font-weight:700;letter-spacing:.03em;color:#8a6c1a;' +
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
      'Trusted-Traveler': 1, 'Vaccines': 1, 'Visas': 1, 'Weather': 1
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
        'display:inline-flex;align-items:center;height:34px;padding:0 14px;' +
        'background:#fff;border:1.5px solid #c8a44a;border-radius:17px;' +
        'font-size:13px;font-weight:700;letter-spacing:.03em;color:#8a6c1a;' +
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
        last.parentNode.insertBefore(upd, last.nextSibling);
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
       pills (including ✨ Claude Inspiration). Uses a HEAD request so the guide
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

        /* Place in the ICS pill row between All Stops Map and Save for offline */
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
          'background:#2c2c2c;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;' +
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
        var rest = text.slice(m[0].length);
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
      function getTargets() {
        return Array.from(document.querySelectorAll(
          '.day-block, .extras-section, .claude-inspiration'
        ));
      }
      function render() {
        btn.textContent = expanded ? '▲ Collapse' : '▼ Expand';
        btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        getTargets().forEach(function(d) { d.style.display = expanded ? '' : 'none'; });
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
     filled when pinned). Shares tve_pinned_guide localStorage format. */
  if (isRealGuide) {
    function injectGuideBookmark() {
      var tc = document.querySelector('.title-city');
      if (!tc || document.getElementById('guide-pin-btn')) return;

      var KEY  = 'tve_pinned_guide';
      var name = document.title;
      var pm   = location.pathname.match(/(\/Guides\/.+)$/);
      var href = pm ? '.' + pm[1] : location.pathname;

      var SVG_OUT  = '<svg width="14" height="16" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 1h8a1 1 0 0 1 1 1v10.5l-5-3-5 3V2a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
      var SVG_FILL = '<svg width="14" height="16" viewBox="0 0 12 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 1h8a1 1 0 0 1 1 1v10.5l-5-3-5 3V2a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';

      function getPin()    { try { return JSON.parse(localStorage.getItem(KEY)); } catch(e) { return null; } }
      function pinActive() { var p = getPin(); return !!(p && p.href === href); }

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
      btn.title     = on ? 'Remove current trip pin' : 'Pin as current trip';
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
        if (pinActive()) {
          localStorage.removeItem(KEY);
          btn.innerHTML = SVG_OUT;
          btn.style.opacity = '.65';
          btn.setAttribute('aria-pressed', 'false');
          btn.title = 'Pin as current trip';
        } else {
          localStorage.setItem(KEY, JSON.stringify({ href: href, name: name, flag: '' }));
          btn.innerHTML = SVG_FILL;
          btn.style.opacity = '1';
          btn.setAttribute('aria-pressed', 'true');
          btn.title = 'Remove current trip pin';
        }
      });
    }
    if (document.readyState !== 'loading') injectGuideBookmark();
    else document.addEventListener('DOMContentLoaded', injectGuideBookmark);
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
      'font-size:13px;font-weight:700;color:#fff;cursor:pointer;font-family:inherit;';

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
        'PRODID:-//The Voyager Expert//Guide Calendar//EN',
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
      pillRow.setAttribute('style', 'display:flex;gap:0;margin-bottom:8px;width:100%;');
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

  /* ── Save for offline — pill on guide pages so readers can explicitly cache
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
    btn.textContent = saved ? '✓ Saved offline' : '⏬ Save for offline';
    if (saved) {
      btn.style.setProperty('opacity', '0.55', 'important');
      btn.style.setProperty('pointer-events', 'none', 'important');
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (localStorage.getItem(storageKey)) return;
      btn.textContent = 'Saving…';
      var markSaved = function () {
        localStorage.setItem(storageKey, '1');
        btn.textContent = '✓ Saved offline';
        btn.style.setProperty('opacity', '0.55', 'important');
        btn.style.setProperty('pointer-events', 'none', 'important');
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

  /* ── Alternative hotel recommendations — injected before #also-on-this-site on
     guide pages that have a HOTEL_ALT_DATA entry. Runner-up hotels from the same
     search process used to pick the guide hotel; added during each guide build.  */
  var HOTEL_ALT_DATA = {
    /* entries added per guide during build — see Hotels & Rentals - On Demand.html */
    'granada': { h: [
      { name: 'Vincci Albayzín Hotel', note: '4-star, free cancellation, Albayzín — eco-friendly, regional cuisine' },
      { name: 'Shine Albayzín Hotel', note: 'Free cancellation, near Mirador de San Nicolás' },
      { name: 'Hotel Palacio de Mariana Pineda', note: '17th-century palace facing the Alhambra, spa treatments' }
    ] },
    'lisbon': { h: [
      { name: 'Sheraton Lisboa Hotel & Spa', note: 'Marriott family — pool, spa, central location near Marquês de Pombal · 8.6 Booking.com' },
      { name: 'InterContinental Lisbon by IHG', note: 'First-tier brand — 8.9 Booking.com, scenic views, Avenida da Liberdade area' }
    ] },
    'ljubljana': { h: [
      { name: 'Hotel Cubo', note: 'Independent boutique — design hotel in Old Town pedestrian zone, terrace bar · 9.3 Booking.com' },
      { name: 'InterContinental Ljubljana by IHG', note: 'IHG brand — panoramic spa with indoor pool, rooftop restaurant, city-centre location · 8.8 Booking.com' }
    ] },
    'melbourne': { h: [
      { name: 'The Langham Melbourne', note: 'Langham brand — riverside Southbank on the Yarra, pool, spa · 8.9 Booking.com' },
      { name: 'Crown Towers Melbourne', note: 'Crown brand — Southbank entertainment precinct, pool, suite-focused luxury · 8.8 Booking.com' }
    ] },
    'abu-dhabi': { h: [
      { name: 'Emirates Palace Mandarin Oriental', note: 'Mandarin Oriental brand — iconic West Corniche, 1km private beach, pool and spa · 9.1 Booking.com' },
      { name: 'Four Seasons Hotel Abu Dhabi at Al Maryah Island', note: 'Four Seasons brand — Al Maryah Island, rooftop pool with city views, near The Galleria · 9.2 Booking.com' }
    ] },
    'aix-en-provence': { h: [
      { name: 'Le Pigonnet', note: 'Esprit de France — landscaped garden, outdoor pool, views of Mont Sainte-Victoire · 9.1 Booking.com' },
      { name: 'Villa Saint-Ange', note: 'Independent boutique — 18th-century bastide estate, heated pool, Provençal garden · 9.3 Booking.com' }
    ] },
    'alaska': { h: [
      { name: 'Hotel Captain Cook', note: 'Independent — Anchorage landmark since 1965, three-tower downtown complex with on-site dining · 8.8 Booking.com' },
      { name: 'Marriott Anchorage Downtown', note: 'Marriott brand — indoor pool, largest downtown full-service hotel, West 7th Avenue · 7.9 Booking.com' }
    ] },
    'alesund': { h: [
      { name: 'Hotel 1904', note: "Independent boutique — Ålesund's oldest hotel, original Art Nouveau building, city center · 9.0 Booking.com" },
      { name: 'Thon Hotel Ålesund', note: 'Thon Hotels — central location, harbor-facing rooms · 8.7 Booking.com' }
    ] },
    'amalfi': { h: [
      { name: 'Hotel Santa Caterina', note: 'Independent family estate — 1880s cliffside villa, saltwater pool, sea-view terraces, Michelin-starred dining · 9.6 Booking.com' },
      { name: 'Anantara Convento di Amalfi Grand Hotel', note: 'Anantara brand — converted 13th-century convent above town, infinity pool, dramatic coastal views · 9.1 Booking.com' }
    ] },
    'amsterdam': { h: [
      { name: 'Waldorf Astoria Amsterdam', note: 'Waldorf Astoria brand — six 17th-century canal palaces on Herengracht, Guerlain Spa with pool, Michelin-recognized dining · 9.3 Booking.com' },
      { name: 'InterContinental Amstel Amsterdam', note: 'IHG brand — landmark 1867 riverside building on the Amstel River, indoor pool and health club, river-terrace dining · 8.7 Booking.com' }
    ] },
    'annecy': { h: [
      { name: 'Impérial Palace Annecy', note: 'Independent — lakefront property in central Annecy, La Voile gastronomic restaurant with terrace, spa with pool and hammam · 8.8 Booking.com' },
      { name: 'Le Clos des Sens', note: 'Independent boutique — 19th-century mansion in Annecy-le-Vieux, home to a three-Michelin-star restaurant (Laurent Petit) · 8.9 Booking.com' }
    ] },
    'aracaju': { h: [
      { name: 'Radisson Hotel Aracaju', note: 'Radisson brand — full-service spa, outdoor pool, 4 min walk to Aracaju Oceanarium, #1 on TripAdvisor in Aracaju' },
      { name: 'Hotel da Costa by Nobile', note: 'Nobile Hotels — beachfront on Orla de Atalaia, outdoor pool with sea view, breakfast highly rated · 8.8 Booking.com' }
    ] },
    'arenal': { h: [
      { name: 'Nayara Springs', note: 'Small Luxury Hotels — adults-only, 35 private villas each with volcanic hot-spring plunge pool, Arenal Volcano views, 24-hour butler' },
      { name: 'Tabacón Thermal Resort & Spa', note: 'Small Luxury Hotels — natural volcanic thermal river on-site, waterfalls and pools up to 100°F, 900+ acres of rainforest · 9.1 Booking.com' }
    ] },
    'aruba': { h: [
      { name: 'Bucuti & Tara Beach Resort', note: "Independent boutique — Caribbean's first carbon-neutral hotel, adults-only on Eagle Beach, complimentary breakfast · 9.6 Booking.com" },
      { name: 'Hyatt Regency Aruba Resort Spa & Casino', note: 'Hyatt brand — Palm Beach frontage, 8,000 sq ft pool complex with waterslide, adults-only pool, ZoiA Spa, casino on-site' }
    ] },
    'athens': { h: [
      { name: 'Hotel Grande Bretagne', note: 'Marriott Luxury Collection — 1874 landmark on Syntagma Square, Acropolis-view balconies, rooftop restaurant, indoor pool · 9.2 Booking.com' },
      { name: 'King George, a Luxury Collection Hotel, Athens', note: 'Marriott Luxury Collection — intimate 102-room boutique on Syntagma Square, rooftop Tudor Hall with Acropolis panorama · 9.3 Booking.com' }
    ] },
    'atlanta': { h: [
      { name: 'Atlanta Marriott Marquis', note: 'Marriott family — iconic 52-story atrium, spa, outdoor pool, downtown Peachtree Center · 8.4 Booking.com' },
      { name: 'The Westin Peachtree Plaza, Atlanta', note: 'Marriott family — landmark 73-story cylinder tower, indoor/outdoor rooftop pool, city views · 8.5 Booking.com' }
    ] },
    'austin': { h: [
      { name: 'JW Marriott Austin', note: 'Marriott family — rooftop pool and spa, 2nd Street dining district, downtown luxury · 8.6 Booking.com' },
      { name: 'Hilton Austin', note: 'Hilton family — convention center adjacency, city-view rooms, downtown · 8.1 Booking.com' }
    ] },
    'azores': { h: [
      { name: 'Delta Hotels by Marriott Azores', note: 'Marriott family — ocean or mountain views, outdoor pool, 10-min from downtown Ponta Delgada · 9.2 Booking.com' }
    ] },
    'bahamas': { h: [
      { name: 'Courtyard by Marriott Nassau Downtown/Junkanoo Beach', note: 'Marriott family — Junkanoo Beach access, outdoor pool, downtown Nassau · 7.2 Booking.com' }
    ] },
    'bali': { h: [
      { name: 'Hyatt Regency Bali', note: 'Hyatt family — private beach, 3 pools, tropical gardens, Sanur · 9.0 Booking.com' },
      { name: 'InterContinental Bali Resort by IHG', note: 'IHG first-tier — 6 pools, beachfront Jimbaran Bay, spa · 9.0 Booking.com' }
    ] },
    'banff': { h: [
      { name: 'Fairmont Banff Springs', note: 'Fairmont brand — 1888 sandstone castle at the confluence of the Bow and Spray Rivers, 2 outdoor pools, full spa, fine-dining 1888 Chop House · 9.2 Booking.com' },
      { name: 'The Rimrock Resort Hotel', note: 'Independent luxury — clifftop perch 6 km from downtown on Sulphur Mountain Road, panoramic six-range mountain views, Primrose dining room, full-service spa · 9.1 Booking.com' }
    ] },
    'bangkok': { h: [
      { name: 'Mandarin Oriental Bangkok', note: 'Mandarin Oriental brand — 1876 Chao Phraya River landmark, celebrated Authors\' Wing, riverfront dining, Sala Rim Naam Thai restaurant · 9.4 Booking.com' },
      { name: 'The Peninsula Bangkok', note: 'Peninsula brand — all-suite riverside tower, rooftop infinity pool over the Chao Phraya, complimentary river ferry · 9.4 Booking.com' }
    ] },
    'barbados': { h: [
      { name: 'Sandy Lane Hotel', note: 'Independent luxury — coral-stone manor on Sandy Lane Bay, 3 golf courses including the Tom Fazio Country Club, spa village · 9.6 Booking.com' },
      { name: 'Coral Reef Club', note: 'Independent boutique — adults-focused west coast retreat, private beach, lush tropical gardens, suites and cottages · 9.5 Booking.com' }
    ] },
    'barcelona': { h: [
      { name: 'Hotel Arts Barcelona', note: 'Ritz-Carlton brand — 44-floor beachfront tower at Port Olímpic, indoor and outdoor pools, sea-view rooms · 9.0 Booking.com' },
      { name: 'Mandarin Oriental, Barcelona', note: 'Mandarin Oriental brand — Passeig de Gràcia design hotel, rooftop pool and spa terrace, acclaimed Blanc restaurant · 9.3 Booking.com' }
    ] },
    'beijing': { h: [
      { name: 'Rosewood Beijing', note: 'Rosewood brand — 57-floor Chaoyang CBD tower, rooftop infinity pool, spa, Michelin-recognized Sui Tang Li Chinese dining · 9.0 Booking.com' },
      { name: 'Aman at Summer Palace', note: 'Aman brand — sole hotel at the Summer Palace gates, 51 courtyard-style suites, private moon-gate garden access · 9.5 Booking.com' }
    ] },
    'bend': { h: [
      { name: 'Oxford Hotel Bend', note: 'Curio Collection by Hilton — boutique downtown Bend, rooftop terrace, walking distance to Old Mill District and Drake Park · 9.0 Booking.com' },
      { name: 'Sunriver Resort', note: 'Independent full-service resort — 15 miles south of Bend, 4 golf courses, Sage Springs spa, outdoor pools, Deschutes River frontage · 8.9 Booking.com' }
    ] },
    'bergen': { h: [
      { name: 'Hotel Norge by Scandic', note: 'Scandic brand — grand property on Ole Bulls plass, central Bergen, indoor pool and spa, celebrated Matbørsen restaurant · 8.8 Booking.com' },
      { name: 'Clarion Hotel Admiral', note: 'Nordic Choice Hotels — harbourfront position opposite Bryggen, Wharf-view rooms, rooftop bar with Puddefjorden panorama · 8.5 Booking.com' }
    ] },
    'berlin': { h: [
      { name: 'Regent Berlin', note: 'IHG Regent brand — Gendarmenmarkt address, neoclassical interiors, Fischers Fritz Michelin-starred dining, spa with pool · 9.0 Booking.com' },
      { name: 'Waldorf Astoria Berlin', note: 'Hilton brand — landmark Kurfürstendamm tower, Guerlain Spa, rooftop infinity pool with city panorama · 9.1 Booking.com' }
    ] },
    'bhutan': { h: [
      { name: 'Amankora', note: 'Aman brand — five intimate lodges across Bhutan valleys (Paro, Thimphu, Punakha, Gangtey, Bumthang), private forest and farmland settings · 9.6 Booking.com' },
      { name: 'Six Senses Paro', note: 'Six Senses brand — reimagined farmhouses and watchtowers in the Paro Valley, wellness spa, farm-to-table dining · 9.5 Booking.com' }
    ] },
    'big-island': { h: [
      { name: 'Mauna Kea Beach Hotel, Autograph Collection', note: 'Marriott Autograph Collection — iconic 1965 Kohala Coast resort by Laurance Rockefeller, private beach, 2 championship golf courses · 9.1 Booking.com' },
      { name: 'Mauna Lani, Auberge Resorts Collection', note: 'Auberge brand — Kohala Coast, private snorkel beach, adults-only infinity pool, Naupaka Spa in lava fields · 9.2 Booking.com' }
    ] },
    'bilbao': { h: [
      { name: 'Hotel Carlton Bilbao', note: 'Leading Hotels of the World — 1920s grand hotel near the old town, historic rooms where Hemingway and royalty stayed · 8.8 Booking.com' },
      { name: 'Meliá Bilbao', note: 'Meliá brand — contemporary tower beside the Guggenheim, spa, outdoor pool, city-view rooms · 8.7 Booking.com' }
    ] },
    'bologna': { h: [
      { name: 'I Portici Hotel Bologna', note: 'Preferred Hotels & Resorts — historic palazzo beneath the famous porticoes, Michelin-starred I Portici restaurant, spa · 9.2 Booking.com' },
      { name: 'Hotel Corona d\'Oro', note: 'Independent — 14th-century palazzo steps from Piazza Maggiore, frescoed ceilings, courtyard garden, tasteful historic interiors · 9.0 Booking.com' }
    ] },
    'bora-bora': { h: [
      { name: 'Four Seasons Resort Bora Bora', note: 'Four Seasons brand — overwater bungalows on private Motu Tehotu islet, lagoon snorkel beach, coral-garden reef access · 9.5 Booking.com' },
      { name: 'The St. Regis Bora Bora Resort', note: 'Marriott Luxury Collection — private islet on the Bora Bora lagoon, overwater villas, Deep Ocean Spa, Butler service · 9.4 Booking.com' }
    ] },
    'bordeaux': { h: [
      { name: 'InterContinental Bordeaux – Le Grand Hotel', note: 'IHG brand — 1780 neoclassical palazzo on Place de la Comédie, rooftop pool with Grand Théâtre views, Le Pressoir d\'Argent Gordon Ramsay restaurant · 9.0 Booking.com' },
      { name: 'Burdigala Hotel by HappyCulture', note: 'HappyCulture — design hotel in the Golden Triangle quarter, Vinothèque wine bar, central to Saint-Pierre and Chartrons · 8.9 Booking.com' }
    ] },
    'boston': { h: [
      { name: 'Four Seasons Hotel Boston', note: 'Four Seasons brand — Back Bay, indoor pool overlooking the Public Garden, Bristol Lounge, steps from Newbury Street · 9.2 Booking.com' },
      { name: 'Mandarin Oriental, Boston', note: 'Mandarin Oriental brand — Back Bay on Boylston Street, spa with pool, Asana wellness centre, connected to Copley Place shops · 9.1 Booking.com' }
    ] },
    'boulder': { h: [
      { name: 'St Julien Hotel & Spa', note: 'Independent boutique — Ninth and Pearl Street, heated outdoor pool and terrace, spa, panoramic Flatirons mountain views · 9.0 Booking.com' },
      { name: 'Marriott Boulder', note: 'Marriott brand — Village Shopping Center at 28th and Canyon, outdoor pool, 10-min walk to Pearl Street · 7.8 Booking.com' }
    ] },
    'bruges': { h: [
      { name: 'Hotel Heritage', note: 'Leading Hotels of the World — 15th-century mansion on Niklaas Desparsstraat, indoor pool, spa, refined brasserie · 9.4 Booking.com' },
      { name: 'Hotel de Orangerie', note: 'Small Luxury Hotels — converted 15th-century nunnery on the Dijver canal, canal-view rooms, Les Jardins de Bruges restaurant · 9.2 Booking.com' }
    ] },
    'brussels': { h: [
      { name: 'Hotel Amigo', note: 'Rocco Forte brand — Renaissance-style building steps from Grand Place, art-curated interiors, Italian-influenced brasserie · 9.0 Booking.com' },
      { name: 'Brussels Marriott Hotel Grand Place', note: 'Marriott brand — Rue Auguste Orts, rooftop terrace, steps from Grand Place and Sainte-Catherine quarter · 8.6 Booking.com' }
    ] },
    'budapest': { h: [
      { name: 'Four Seasons Hotel Gresham Palace Budapest', note: 'Four Seasons brand — 1906 Art Nouveau palace at Chain Bridge, Danube-view rooms, spa, Kollázs Brasserie & Bar · 9.4 Booking.com' },
      { name: 'Corinthia Budapest', note: 'Independent luxury — 1896 grand Victorian building in central Pest, Royal Spa, Brasserie & Atrium, indoor pool · 9.2 Booking.com' }
    ] },
    'buenos-aires': { h: [
      { name: 'Park Hyatt Buenos Aires', note: 'Hyatt brand — 1934 Palacio Duhau mansion merged with contemporary tower, Recoleta, Duhau Restaurant & Vinoteca, 3 pools · 9.4 Booking.com' },
      { name: 'Alvear Palace Hotel', note: 'Leading Hotels of the World — 1932 French Renaissance landmark in Recoleta, Alvear Art Restaurant, butler service · 9.5 Booking.com' }
    ] },
    'cairo': { h: [
      { name: 'Four Seasons Hotel Cairo at Nile Plaza', note: 'Four Seasons brand — Garden City Nile frontage, indoor pool, spa, panoramic city views across the river · 9.2 Booking.com' },
      { name: 'Kempinski Nile Hotel Cairo', note: 'Kempinski brand — Garden City Nile address, rooftop pool, Osmanly Ottoman restaurant, full-service spa · 9.0 Booking.com' }
    ] },
    'cambridge': { h: [
      { name: 'The Varsity Hotel & Spa', note: 'Independent boutique — Thompsons Lane, rooftop Glassworks restaurant, River Cam views, spa with rooftop pool · 9.1 Booking.com' },
      { name: 'Graduate Cambridge', note: 'Graduate Hotels brand — Granta Place riverside, punting-at-the-door location on the Cam, boutique heritage interiors · 8.9 Booking.com' }
    ] },
    'cancun': { h: [
      { name: 'Nizuc Resort & Spa', note: 'Independent luxury — southernmost tip of the Hotel Zone, 5 pools, overwater hammam spa, private beach, adults-only · 9.2 Booking.com' },
      { name: 'Hyatt Zilara Cancun', note: 'Hyatt brand — adults-only all-inclusive, 3 oceanfront pools, 8 dining options, beachfront Hotel Zone · 9.0 Booking.com' }
    ] },
    'cannes': { h: [
      { name: 'Carlton Cannes, a Regent Hotel', note: 'IHG Regent brand — iconic 1911 La Croisette palace, private beach concession, Belle Époque sea-view suites · 9.1 Booking.com' },
      { name: 'Majestic Barrière Cannes', note: 'Barrière group — La Croisette landmark, two pools, private beach club, Fouquet\'s Cannes restaurant, full-service spa · 9.0 Booking.com' }
    ] },
    'cape-cod': { h: [
      { name: 'The Wequassett Resort and Golf Club', note: 'Independent luxury — Pleasant Bay waterfront in Harwich, 18-hole championship golf, 4 pools, spa with Cape Cod salt-air treatments · 9.1 Booking.com' },
      { name: 'Ocean Edge Resort & Golf Club', note: 'Independent resort — Brewster beachfront, 6 pools, oceanfront private beach, 18-hole golf, tennis and spa complex · 8.7 Booking.com' }
    ] },
    'cape-town': { h: [
      { name: 'One&Only Cape Town', note: 'One&Only Resorts — V&A Waterfront, two-island resort layout, overwater spa, NOBU restaurant, two pools · 9.4 Booking.com' },
      { name: 'The Silo Hotel', note: 'Royal Portfolio — V&A Waterfront Silo District, converted grain silo, 28 rooms, panoramic rooftop bar, curated art collection · 9.0 Booking.com' }
    ] },
    'capri': { h: [
      { name: 'J.K. Place Capri', note: 'Independent boutique — Marina Grande, 22 rooms, infinity sea-view pool, Forbes Five-Star-rated sun terraces · 9.6 Booking.com' },
      { name: 'Hotel Punta Tragara', note: 'Manfredi Collection — southern cliff above the Faraglioni, two outdoor pools, sea-view suites, Ristorante Punta Tragara · 9.0 Booking.com' }
    ] },
    'carmel-by-the-sea': { h: [
      { name: 'L\'Auberge Carmel, Relais & Châteaux', note: 'Auberge Resorts/Relais & Châteaux — downtown Carmel, 20 rooms, Aubergine restaurant, wine cellar, garden courtyard · 8.5 Booking.com' },
      { name: 'Carmel Valley Ranch', note: 'Unbound Collection by Hyatt — Carmel Valley (9 mi inland), 181 suites, Pete Dye golf course, vineyard, full-service spa · 8.2 Booking.com' }
    ] },
    'cascais': { h: [
      { name: 'Palácio Estoril Hotel, Golf & Wellness', note: 'Leading Hotels of the World — Estoril seafront, 1930s palace with WWII spy-era heritage, golf course, casino adjacent · 8.9 Booking.com' },
      { name: 'Grande Real Villa Itália Hotel & Spa', note: 'Real Hotels Group/Leading Hotels of the World — western Cascais clifftop, former Italian royal residence, sea-view gardens, spa · 9.0 Booking.com' }
    ] },
    'cayman-islands': { h: [
      { name: 'Kimpton Seafire Resort + Spa', note: 'IHG/Kimpton — Seven Mile Beach, full-service spa, rooftop bar, three pools, beachfront dining · 9.4 Booking.com' },
      { name: 'Palm Heights', note: 'Independent boutique — Seven Mile Beach, design-forward rooms, spa, tropical gardens, curated wellness programming · 9.6 Booking.com' }
    ] },
    'charlotte': { h: [
      { name: 'The Ritz-Carlton, Charlotte', note: 'Ritz-Carlton — Uptown Charlotte, two-level spa, rooftop garden, signature dining, skyline views · 9.0 Booking.com' },
      { name: 'JW Marriott Charlotte', note: 'JW Marriott — Uptown near Convention Center, rooftop lounge, spa, indoor pool, panoramic city views · 9.0 Booking.com' }
    ] },
    'chiang-mai': { h: [
      { name: 'Four Seasons Resort Chiang Mai', note: 'Four Seasons — Mae Rim Valley (15 km northwest of Old City), rice-terrace views, two infinity pools, spa, cooking classes · 9.7 Booking.com' },
      { name: 'Shangri-La Chiang Mai', note: 'Shangri-La — Ping River/Night Bazaar district, river-view pool, full-service spa, multiple restaurants · 8.9 Booking.com' }
    ] },
    'chicago': { h: [
      { name: 'The Langham, Chicago', note: 'Langham Hotels — River North in the IBM Building, Chuan Body & Soul Spa, indoor pool, Travelle restaurant · 9.4 Booking.com' },
      { name: 'Waldorf Astoria Chicago', note: 'Waldorf Astoria/Hilton — Gold Coast (11 E Walton St), European-style spa, Brass Tack steakhouse, Art Deco interiors · 8.6 Booking.com' }
    ] },
    'chongqing': { h: [
      { name: 'Regent Chongqing', note: 'IHG/Regent — Jiefangbei CBD, Yangtze River views, spa, signature restaurants, complimentary minibar · 9.6 Booking.com' },
      { name: 'JW Marriott Hotel Chongqing', note: 'JW Marriott — Jiefangbei CBD, indoor pool, full-service spa, Yangtze River views, multiple dining venues · 8.6 Booking.com' }
    ] },
    'cinque-terre': { h: [
      { name: 'La Torretta Lodge', note: 'Independent boutique — Manarola (medieval tower conversion), 12 rooms, rooftop hot tub, sea-view terrace · 9.0 Booking.com' },
      { name: 'Locanda Il Maestrale', note: 'Independent boutique — Monterosso al Mare old town, 18th-century palazzo, 6 rooms, frescoed ceilings, sea-view breakfast terrace · 9.4 Booking.com' }
    ] },
    'coeur-dalene': { h: [
      { name: 'The Coeur d\'Alene Resort', note: 'Independent — lakefront resort on Lake Coeur d\'Alene, floating green golf course, Beverly\'s 7th-floor restaurant with panoramic lake views, full-service spa · 8.9 Booking.com' }
    ] },
    'colmar': { h: [
      { name: 'Hostellerie Le Maréchal', note: 'Independent — Petite Venise canalside address on the Lauch River, Le Vier Poisson gastronomic restaurant, half-timbered canal-view rooms in the Little Venice quarter · 9.2 Booking.com' },
      { name: 'La Maison des Têtes', note: 'Independent — 1609 Renaissance mansion in Colmar\'s Old Town, award-winning French-Alsatian dining, historic stone facade with 111 sculpted heads · 8.9 Booking.com' }
    ] },
    'cologne': { h: [
      { name: 'Hyatt Regency Cologne', note: 'Hyatt brand — Rhine riverbank, 306 rooms and suites, Regency Executive Suite with Rhine and Cologne Cathedral panorama, Glashaus Restaurant & Bar · 8.5 Booking.com' },
      { name: 'Cologne Marriott Hotel', note: 'Marriott brand — central Cologne, 3-min walk to Cologne Cathedral and Hauptbahnhof, contemporary rooms, modern fitness center · 8.3 Booking.com' }
    ] },
    'colombo': { h: [
      { name: 'Shangri-La Colombo', note: 'Shangri-La brand — between Galle Face Green and Beira Lake, Indian Ocean views, Chi Spa, multiple dining venues including Graze Kitchen · 8.5 Booking.com' },
      { name: 'Cinnamon Grand Colombo', note: 'Cinnamon Hotels & Resorts — 501-room city landmark near World Trade Center and Independence Square, multiple dining venues, outdoor pool, spa · 8.6 Booking.com' }
    ] },
    'columbia': { h: [
      { name: 'Hotel Trundle', note: 'Independent boutique — Main Street District, art deco-inspired interiors celebrating Columbia\'s arts scene, rooftop bar with city views · 9.1 Booking.com' },
      { name: 'Hilton Columbia Center', note: 'Hilton brand — downtown Columbia, Whiskey Bar rooftop with skyline views, close to the Vista arts and dining district · 8.3 Booking.com' }
    ] },
    'copenhagen': { h: [
      { name: 'Hotel d\'Angleterre', note: 'Leading Hotels of the World — 1755 landmark on Kongens Nytorv, Michelin-starred Restaurant Marchal, spa with indoor pool, direct access to Strøget shopping · 9.3 Booking.com' },
      { name: 'Nimb Hotel', note: 'Independent boutique — 17 rooms inside Tivoli Gardens, Nimb Terrasse brasserie, members-only Nimb Bar, private garden access year-round · 9.4 Booking.com' }
    ] },
    'corfu': { h: [
      { name: 'Kontokali Bay Resort & Spa', note: 'Independent — beachfront north of Corfu Town, 11-treatment-room spa, water sports center, multiple pools and beach restaurants · 9.4 Booking.com' },
      { name: 'Domes Miramare, a Luxury Collection Resort, Corfu', note: 'Marriott Luxury Collection — adults-only, Moraitika beachfront on the Ionian, overwater pool-bungalow suites, spa and infinity pool · 9.1 Booking.com' }
    ] },
    'crete': { h: [
      { name: 'Galaxy Hotel Iraklio', note: 'Independent 5-star — Heraklion\'s central elegant district, two on-site restaurants, freshwater outdoor pool, wellness and fitness center · 8.6 Booking.com' },
      { name: 'Lato Boutique Hotel', note: 'Independent boutique — Old Town Heraklion near the Venetian harbour, Brilliant Cuisine rooftop restaurant with Koules Fortress and sea panoramas · 8.4 Booking.com' }
    ] },
    'curacao': { h: [
      { name: 'Baoase Luxury Resort', note: 'Independent boutique — adults-only, private beach on Piscadera Bay, Baoase Culinary Beach restaurant, full-service spa · 9.4 Booking.com' },
      { name: 'Mangrove Beach Corendon Curacao Resort, Curio Collection by Hilton', note: 'Hilton Curio — beachfront, aqua park, spa, multiple pools and dining, 10-min from Willemstad\'s historic waterfront · 8.7 Booking.com' }
    ] },
    'curitiba': { h: [
      { name: 'QOYA Hotel Curitiba, Curio Collection by Hilton', note: 'Hilton Curio — upscale Batel district, heated indoor pool, saunas, 7-min walk to Arena da Baixada, contemporary Brazilian design · 8.9 Booking.com' },
      { name: 'Nomaa Hotel', note: 'Independent boutique — Batel, 5-star, Nomade Restaurant with seasonal Brazilian tasting menu, intimate rooftop deck · 9.2 Booking.com' }
    ] },
    'cusco': { h: [
      { name: 'Belmond Hotel Monasterio', note: 'Belmond brand — converted 16th-century monastery in San Blas, oxygen-enriched rooms for altitude, courtyard chapel, 122 rooms · 9.0 Booking.com' },
      { name: 'Inkaterra La Casona', note: 'Preferred Hotels & Resorts — 16th-century colonial manor on Plaza de las Nazarenas, 11 suites with original Inca stonework, butler service · 9.2 Booking.com' }
    ] },
    'dallas': { h: [
      { name: 'Rosewood Mansion on Turtle Creek', note: 'Rosewood brand — 1925 Tudor mansion in Uptown, outdoor heated pool and terrace, acclaimed Restaurant at Rosewood Mansion, full-service spa · 9.0 Booking.com' },
      { name: 'The Ritz-Carlton, Dallas', note: "Ritz-Carlton brand — Uptown at McKinney and Maple, indoor pool, Ellie's Restaurant and Lounge, 24-hour butler · 8.8 Booking.com" }
    ] },
    'denver': { h: [
      { name: 'The Brown Palace Hotel and Spa, Autograph Collection', note: 'Marriott Autograph — 1892 triangular-atrium landmark in downtown Denver, Ship Tavern, three-level spa, indoor pool · 9.0 Booking.com' },
      { name: 'Four Seasons Hotel Denver', note: 'Four Seasons brand — LoDo district, rooftop heated outdoor pool with mountain views, EDGE Restaurant & Bar, spa · 9.1 Booking.com' }
    ] },
    'doha': { h: [
      { name: 'Four Seasons Hotel Doha', note: 'Four Seasons brand — private beach on the West Bay Corniche, 3 outdoor pools, Nobu Doha restaurant, spa and wellness centre · 9.3 Booking.com' },
      { name: 'Mandarin Oriental, Doha', note: 'Mandarin Oriental brand — Pearl-Qatar island, marina and skyline views, The Spa at Mandarin Oriental, five dining venues · 9.1 Booking.com' }
    ] },
    'dubai': { h: [
      { name: 'Atlantis The Palm', note: 'Independent — Palm Jumeirah iconic resort, 1.5 km private beach, Aquaventure waterpark, 17 restaurants including Nobu, full-service spa · 8.8 Booking.com' },
      { name: 'Burj Al Arab Jumeirah', note: 'Jumeirah brand — sail-shaped island icon, all-suite, private beach, Al Muntaha sky-high restaurant, 24-hour butler · 9.5 Booking.com' }
    ] },
    'dublin': { h: [
      { name: 'The Merrion Hotel', note: 'Leading Hotels of the World — four Georgian townhouses on Merrion Street Upper, National Gallery adjacent, indoor pool and spa, Cellar Restaurant · 9.3 Booking.com' },
      { name: 'The Shelbourne, Autograph Collection', note: "Marriott Autograph — 1824 landmark on St Stephen's Green, Lord Mayor's Lounge afternoon tea, Saddle Room restaurant, spa · 8.9 Booking.com" }
    ] },
    'dubrovnik': { h: [
      { name: 'Villa Dubrovnik', note: 'Small Luxury Hotels — clifftop boutique south of the Old Town walls, private boat shuttle, infinity pool over the Adriatic, open-fire Restaurant · 9.5 Booking.com' },
      { name: 'Hotel Excelsior Dubrovnik', note: 'Independent luxury — seafront promenade steps from Pile Gate, panoramic Lokrum and Old Town views, pools, Sensori Wellness Spa · 9.0 Booking.com' }
    ] },
    'edinburgh': { h: [
      { name: 'The Balmoral', note: 'Rocco Forte brand — 1902 Waverley Station clock-tower landmark, Number One Michelin-starred restaurant, indoor pool and spa, Castle-view suites · 9.1 Booking.com' },
      { name: 'InterContinental Edinburgh The George', note: 'IHG first-tier — Georgian townhouses on George Street, Tempus Restaurant and Bar, spa · 8.8 Booking.com' }
    ] },
    'florence': { h: [
      { name: 'Hotel Savoy Florence', note: "Rocco Forte brand — Piazza della Repubblica address, L'Incontro restaurant, rooftop terrace overlooking the Duomo and Campanile, spa · 9.1 Booking.com" },
      { name: 'The St. Regis Florence', note: 'Marriott Luxury Collection — 19th-century Palazzo Cerretani on Piazza Ognissanti, Arno views, Ineo Restaurant, butler service · 9.3 Booking.com' }
    ] },
    'florianopolis': { h: [
      { name: "Costão do Santinho Resort Golf & Spa", note: "Independent resort — northern Santinho beach, 4.5 km private beachfront, 14 pools, spa, golf, one of Brazil's largest beach resorts · 8.9 Booking.com" },
      { name: 'Majestic Palace Hotel', note: 'Independent — Beira Mar Norte waterfront, rooftop pool with bay panorama, on-site restaurant, central Florianópolis · 8.5 Booking.com' }
    ] },
    'florida-keys': { h: [
      { name: 'Casa Marina Key West, Curio Collection by Hilton', note: "Hilton Curio brand — 1920 Flagler oceanfront resort, Key West's largest, private beach, two pools, Atlantic-view rooms · 8.5 Booking.com" },
      { name: 'Opal Key Resort & Marina', note: 'Independent luxury — Key West harbour and marina setting, free-form pool, sunset deck, private dock, tropical grounds · 8.6 Booking.com' }
    ] },
    'fortaleza': { h: [
      { name: 'Gran Marquise Hotel', note: 'Independent luxury — Meireles Av. Beira Mar beachfront, rooftop pool with Atlantic views, top-rated address in Fortaleza · 9.2 Booking.com' },
      { name: 'Luzeiros Hotel Fortaleza', note: 'Independent — Meireles beachfront, sea-view pool, steps from Iracema Beach nightlife and restaurants · 8.4 Booking.com' }
    ] },
    'foz-do-iguacu': { h: [
      { name: 'Mabu Thermas Grand Resort', note: 'Independent resort — Foz do Iguaçu city, thermal pool complex, spa, 5 pools, 3km from downtown · 8.8 Booking.com' },
      { name: 'Bourbon Cataratas Convention & Spa Resort', note: 'Independent full-service resort — 7km from the falls, 3 pools, sports facilities, convention centre · 8.5 Booking.com' }
    ] },
    'frankfurt': { h: [
      { name: 'Steigenberger Frankfurter Hof', note: 'Steigenberger brand — 1876 Kaiserplatz landmark, Michelin-recognized The Faces restaurant, historic grand-hotel address · 8.7 Booking.com' },
      { name: 'Villa Kennedy', note: 'Rocco Forte brand — 1901 Sachsenhausen patrician villa, garden pool, Vigna restaurant, spa, 15-minute walk to Römer · 9.0 Booking.com' }
    ] },
    'geneva': { h: [
      { name: 'Beau-Rivage Geneva', note: 'Independent grand hotel — 1865 Quai du Mont-Blanc lakefront, indoor pool, Michelin-starred Chat Botté restaurant, panoramic lake views · 9.1 Booking.com' },
      { name: 'Four Seasons Hotel des Bergues Geneva', note: 'Four Seasons brand — 1834 lakeside founding address on the Rhône, private lake pier, spa, Mont Blanc views from upper floors · 9.3 Booking.com' }
    ] },
    'glacier-national-park': { h: [
      { name: 'Many Glacier Hotel', note: 'National Historic Landmark 1915 — Swiss chalet on Swiftcurrent Lake, most dramatic NPS setting in the park, mountain-and-lake panorama · 8.9 Booking.com' },
      { name: 'The Lodge at Whitefish Lake', note: 'Renaissance Hotels (Marriott family) — Whitefish, 14 miles east of the park, marina resort, outdoor pool, lakefront spa, year-round mountain access · 9.0 Booking.com' }
    ] },
    'glasgow': { h: [
      { name: 'Kimpton Blythswood Square Hotel', note: 'IHG Kimpton brand — 1820 Georgian townhouse on Blythswood Square, indoor pool, Tempus spa, afternoon tea · 9.0 Booking.com' },
      { name: 'Hotel Indigo Glasgow', note: 'IHG brand — converted 1901 central fire station on Waterloo Street, design-led interiors, steps from Central Station · 8.7 Booking.com' }
    ] },
    'gothenburg': { h: [
      { name: 'Clarion Hotel Post', note: 'Nordic Choice Hotels — 1925 former Central Post Office on Drottningtorget, panoramic rooftop pool and bar, spa, largest hotel in Gothenburg · 8.7 Booking.com' },
      { name: 'Elite Plaza Hotel Gothenburg', note: 'Elite Hotels brand — 1889 grand Victorian building in Inom Vallgraven, Råkulten restaurant, classic Scandinavian interiors · 8.8 Booking.com' }
    ] },
    'hamburg': { h: [
      { name: 'The Fontenay Hamburg', note: "Independent luxury — 2018 Alster lake-view tower, rooftop pool, Lakeside spa, Mabühle restaurant, Hamburg's premier new-build address · 9.4 Booking.com" },
      { name: 'Hotel Atlantic Kempinski Hamburg', note: 'Kempinski brand — 1909 Außenalster lakefront landmark, historic grand hotel, waterfront dining, near Hauptbahnhof · 8.7 Booking.com' }
    ] },
    'hanoi': { h: [
      { name: 'Sofitel Legend Metropole Hanoi', note: 'Accor Sofitel Legend brand — 1901 French colonial icon in the French Quarter, Le Spa du Métropole, Michelin-recognized Le Beaulieu restaurant · 9.3 Booking.com' },
      { name: 'JW Marriott Hotel Hanoi', note: 'Marriott brand — award-winning curved tower by Carlos Zapata Studio, outdoor pool, full-service spa, largest luxury hotel in Hanoi · 8.8 Booking.com' }
    ] },
    'helsinki': { h: [
      { name: 'Hotel St. George Helsinki', note: 'Design Hotels member — 1894 neo-Renaissance building in the city center, curated art collection, spa with pool, Aino restaurant · 9.1 Booking.com' },
      { name: 'Marski by Scandic', note: 'Scandic brand — prime Mannerheimintie address opposite Esplanade Park, 365 rooms, extensively renovated 2019, rooftop sauna · 8.5 Booking.com' }
    ] },
    'hilton-head-island': { h: [
      { name: 'Sonesta Resort Hilton Head Island', note: 'Sonesta brand — North Forest Beach Drive oceanfront, two pools, beach access, on-site dining, family-friendly full-service resort · 8.6 Booking.com' },
      { name: 'The Inn at Harbour Town', note: 'Independent boutique — inside Sea Pines plantation, overlooking Heritage Golf Links, butler service, Sea Pines resort amenity access · 9.1 Booking.com' }
    ] },
    'hiroshima': { h: [
      { name: 'Grand Prince Hotel Hiroshima', note: 'Prince Hotels brand — waterfront hotel on the Motoyasu River, panoramic city views, spa, pool, closest major hotel to Peace Memorial Park · 8.9 Booking.com' },
      { name: 'Sheraton Grand Hiroshima Hotel', note: 'Marriott brand — directly connected to JR Hiroshima Station, Shinkansen-accessible, Club Lounge, contemporary rooms above the transit hub · 8.7 Booking.com' }
    ] },
    'hoi-an': { h: [
      { name: 'Anantara Hội An Resort', note: 'Anantara brand — Thu Bon River frontage in the Ancient Town, colonial-style architecture, riverside pool, spa · 9.2 Booking.com' },
      { name: 'Victoria Hội An Beach Resort & Spa', note: 'Victoria Hotels brand — beachfront between Old Town and Cua Dai Beach, pool, spa, traditional Vietnamese architecture · 8.8 Booking.com' }
    ] },
    'hong-kong': { h: [
      { name: 'The Ritz-Carlton Hong Kong', note: "Ritz-Carlton brand — world's highest hotel (floors 102–118, ICC Tower), Tin Lung Heen for dim sum, rooftop infinity pool · 9.3 Booking.com" },
      { name: 'Four Seasons Hotel Hong Kong', note: 'Four Seasons brand — Central harbourfront, panoramic Victoria Harbour views, two outdoor infinity pools, Michelin-starred Lung King Heen · 9.2 Booking.com' }
    ] },
    'istanbul': { h: [
      { name: 'Four Seasons Hotel Istanbul at Sultanahmet', note: 'Four Seasons brand — converted 19th-century Ottoman prison, steps from Hagia Sophia, inner courtyard garden, butler service · 9.3 Booking.com' },
      { name: 'Raffles Istanbul Zorlu', note: 'Raffles brand — European side at Zorlu Center, indoor and outdoor pools, Arola Restaurant, long private driveway approach · 9.1 Booking.com' }
    ] },
    'joao-pessoa': { h: [
      { name: 'Summerville Beach Resort', note: 'Independent resort — Tambaú beachfront, outdoor pools, spa, direct beach access steps from the Tambaú promenade · 8.7 Booking.com' },
      { name: 'Hotel Tambaú', note: 'Independent — iconic 1972 circular building on Tambaú Beach, João Pessoa landmark, pool terrace with ocean views, seafood restaurant · 8.2 Booking.com' }
    ] },
    'kauai': { h: [
      { name: 'St. Regis Princeville Resort', note: 'Marriott Luxury Collection — Princeville cliffside above Hanalei Bay, Halele\'a Spa, infinity pool, butler service, North Shore panorama · 9.0 Booking.com' },
      { name: '1 Hotel Hanalei Bay', note: 'SH Hotels brand — Princeville cliffside, adults-preferred wing, two pools, farm-to-table restaurant, panoramic Hanalei Bay views · 9.1 Booking.com' }
    ] },
    'keywest': { h: [
      { name: 'Ocean Key Resort & Spa', note: 'Curio Collection by Hilton — Sunset Key views at Zero Duval, rooftop pool, private dock access, steps from Mallory Square sunset · 8.7 Booking.com' },
      { name: 'The Marker Key West Harbor Resort', note: 'Autograph Collection by Marriott — Old Town historic district, three pools including adults-only, marina access, tropical gardens · 9.0 Booking.com' }
    ] },
    'kotor': { h: [
      { name: 'Regent Porto Montenegro', note: 'Regent Hotels — superyacht marina in Tivat (20 min from Kotor), beachclub, full-service spa, private beach, Boka Bay setting · 8.9 Booking.com' },
      { name: 'Palazzo Radomiri', note: 'Independent boutique — 18th-century Baroque palace in Dobrota village, 5km from Old Town, Boka Bay waterfront, private jetty · 9.2 Booking.com' }
    ] },
    'krakow': { h: [
      { name: 'Hotel Copernicus', note: 'Relais & Châteaux — 15th-century Renaissance house in Old Town, rooftop pool with Royal Castle and Wawel panorama, Copernicus restaurant · 9.2 Booking.com' },
      { name: 'Sheraton Grand Kraków', note: 'Marriott family — Wisła Riverfront with Wawel Castle views, Dolce Vita Spa, indoor pool, walking distance to Old Town · 8.6 Booking.com' }
    ] },
    'kyoto': { h: [
      { name: 'The Ritz-Carlton, Kyoto', note: 'Ritz-Carlton brand — Nakagyo District on the Kamogawa River, indoor infinity pool with garden views, full-service spa, Michelin-recognized MIZUKI restaurant · 9.3 Booking.com' },
      { name: 'Aman Kyoto', note: 'Aman brand — private forested hillside north of Kinkaku-ji, 26 pavilion-style rooms, onsen bath circuit, garden-set outdoor pool · 9.7 Booking.com' }
    ] },
    'la-jolla': { h: [
      { name: 'Lodge at Torrey Pines', note: 'Independent AAA Five Diamond — clifftop Arts & Crafts lodge above Torrey Pines State Reserve, two pools, A.R. Valentien restaurant, direct Torrey Pines golf access · 9.2 Booking.com' },
      { name: 'Estancia La Jolla Hotel & Spa', note: 'Marriott Tribute Portfolio — hacienda-style resort near UCSD, outdoor pool, full-service spa, lush California garden, 10 min from La Jolla Cove · 8.8 Booking.com' }
    ] },
    'lagos': { h: [
      { name: 'Bela Vista Hotel & Spa', note: 'Leading Hotels of the World — 1918 Art Nouveau manor in Praia da Rocha (Portimão, 20 km east), clifftop Atlantic views, outdoor pool, Michelin-recognized Boa Mesa restaurant · 9.3 Booking.com' },
      { name: 'Dona Filipa Hotel', note: 'Marriott Autograph Collection — Vale do Lobo resort estate (55 km east of Lagos), San Lorenzo golf access, 3 pools, spa, direct beach · 8.5 Booking.com' }
    ] },
    'lake-como': { h: [
      { name: "Villa d'Este", note: 'Leading Hotels of the World — 16th-century Renaissance villa in Cernobbio, floating 40 m lake pool, private beach, spa, celebrated Como Grill dining · 9.5 Booking.com' },
      { name: 'Mandarin Oriental, Lake Como', note: 'Mandarin Oriental brand — 19th-century lakeside estate in Blevio, 38 rooms with private terraces, lake-view infinity pool, The Spa at Mandarin Oriental · 9.3 Booking.com' }
    ] },
    'lake-tahoe': { h: [
      { name: 'The Ritz-Carlton, Lake Tahoe', note: 'Ritz-Carlton brand — Northstar California ski-in/ski-out resort, heated outdoor pool, full-service spa, mountain-view dining, year-round alpine access · 9.1 Booking.com' },
      { name: 'Edgewood Tahoe Resort', note: 'Forbes Five Star independent — South Lake Tahoe lakefront, championship golf, heated outdoor pool, spa, private beach, panoramic lake views · 9.6 Booking.com' }
    ] },
    'las-vegas': { h: [
      { name: 'Wynn Las Vegas', note: 'Forbes Five Star independent — single-tower luxury resort, 3 pools, Wynn Spa, Michelin-starred Restaurant Guy Savoy and SW Steakhouse · 9.2 Booking.com' },
      { name: 'The Venetian Resort Las Vegas', note: 'Independent mega-resort — all-suite tower, Canyon Ranch Spa Club with indoor pool, 5 outdoor pools, 36 restaurants, Lagoon Pool complex · 8.8 Booking.com' }
    ] },
    'lecce': { h: [
      { name: 'Risorgimento Resort', note: 'Leading Hotels of the World — Lecce historic centre palazzo conversion, rooftop terrace and pool, Michelin-recognized restaurant · 9.0 Booking.com' },
      { name: 'Il Convento di Santa Teresa', note: 'Independent boutique — converted 17th-century convent steps from Piazza Sant\'Oronzo, original stone arches, courtyard garden, 10 rooms · 9.4 Booking.com' }
    ] },
    'lille': { h: [
      { name: 'Hermitage Gantois', note: 'MGallery by Sofitel — 15th-century Vieux-Lille hospice conversion, indoor pool and spa, Chapel Café, 90 rooms spanning historic and contemporary wings · 8.8 Booking.com' },
      { name: 'Barrière Lille', note: 'Barrière group — L\'Alliance hotel connected to Grand Casino Barrière, spa with pool and hammam, rooftop terrace, central Lille location · 8.7 Booking.com' }
    ] },
    'lima': { h: [
      { name: 'Belmond Miraflores Park', note: 'Belmond brand — Miraflores clifftop overlooking the Pacific, rooftop heated pool with ocean views, full-service spa, 81 rooms · 9.0 Booking.com' },
      { name: 'Hotel B', note: 'Small Luxury Hotels of the World — 1914 Republican mansion in Barranco arts district, 17 rooms, curated contemporary art collection, rooftop terrace · 9.5 Booking.com' }
    ] },
    'london': { h: [
      { name: 'The Savoy', note: 'Fairmont brand — 1889 Thames Embankment landmark, Art Deco interior, Kaspar\'s Seafood Bar, indoor pool · 9.1 Booking.com' },
      { name: 'Claridge\'s', note: 'Independent luxury — Mayfair Art Deco landmark, legendary afternoon tea, indoor pool, Nobu at Claridge\'s · 9.4 Booking.com' }
    ] },
    'los-angeles': { h: [
      { name: 'Pendry West Hollywood', note: 'Montage Hotels — Sunset Strip address, rooftop infinity pool, Chloe restaurant, valet parking · 9.2 Booking.com' },
      { name: 'Hotel Bel-Air', note: 'Dorchester Collection — 12-acre Bel-Air canyon estate, Swan Lake gardens, spa, celebrity retreat · 9.5 Booking.com' }
    ] },
    'los-cabos': { h: [
      { name: 'Las Ventanas al Paraíso, A Rosewood Resort', note: 'Rosewood brand — beachfront estate, telescope observatory, three pools, Tequila & Ceviche Bar · 9.5 Booking.com' },
      { name: 'One&Only Palmilla', note: 'One&Only brand — 27-acre oceanfront estate, Nobu on-site, infinity pools, private diving · 9.4 Booking.com' }
    ] },
    'luang-prabang': { h: [
      { name: 'Sofitel Luang Prabang', note: 'Sofitel brand — restored French governor\'s residence, two pools, jungle garden, spa · 9.4 Booking.com' },
      { name: 'Amantaka', note: 'Aman brand — converted colonial compound, pool-equipped suites, complimentary tuk-tuk service into town · 9.6 Booking.com' }
    ] },
    'lucerne': { h: [
      { name: 'Palace Luzern', note: 'Independent luxury — 1906 Belle Époque lakefront palace, indoor and outdoor pools, spa, Pilatus and Rigi views · 9.4 Booking.com' },
      { name: 'Bürgenstock Resort Lake Lucerne', note: 'Independent luxury — clifftop above Lake Lucerne, panoramic Alpine spa, Alpine cliff walk, helicopter transfers · 9.2 Booking.com' }
    ] },
    'luxembourg': { h: [
      { name: 'Grand Hotel Cravat', note: 'Independent — listed building on Boulevard Roosevelt, Michelin-listed Frantz Mosa restaurant, Old Town views · 8.9 Booking.com' },
      { name: 'Sofitel Luxembourg Europe', note: 'Sofitel brand — Kirchberg European Quarter, spa, contemporary design, close to EU institutions · 8.8 Booking.com' }
    ] },
    'lyon': { h: [
      { name: 'Villa Florentine', note: 'Small Luxury Hotels — Renaissance mansion on Fourvière Hill, panoramic city and Rhône views, Michelin-starred dining · 9.4 Booking.com' },
      { name: 'Sofitel Lyon Bellecour', note: 'Sofitel brand — Presqu\'île heart, spa with pool, Les Trois Dômes gastronomic restaurant with panorama · 8.9 Booking.com' }
    ] },
    'maceio': { h: [
      { name: 'Jatiúca Resort', note: 'Independent — beachfront on Jatiúca Beach, outdoor pool complex, buffet dining, family-friendly · 8.7 Booking.com' },
      { name: 'Ritz Suítes Hotel', note: 'Independent — Pajuçara beach access, rooftop pool, central Maceió location · 8.6 Booking.com' }
    ] },
    'machupicchu': { h: [
      { name: 'Inkaterra Machu Picchu Pueblo Hotel', note: 'Independent luxury — 83 casitas in cloud forest, 372 orchid species on-site, tea house, nature walks · 9.2 Booking.com' },
      { name: 'Sumaq Machu Picchu Hotel', note: 'Independent — 62 rooms with mountain views inside the UNESCO sanctuary, gourmet Qunuq restaurant · 9.0 Booking.com' }
    ] },
    'madeira': { h: [
      { name: 'Reid\'s Palace, A Belmond Hotel', note: 'Belmond brand — 1891 clifftop landmark, seawater pools, afternoon tea tradition, lush subtropical gardens · 9.2 Booking.com' },
      { name: 'Choupana Hills Boutique Hotel', note: 'Small Luxury Hotels — adults-only, thatched eco-bungalows above Funchal in eucalyptus forest, pool · 9.1 Booking.com' }
    ] },
    'madrid': { h: [
      { name: 'The Westin Palace Madrid', note: 'Marriott family — 1912 Belle Époque landmark on Plaza de las Cortes, stained-glass domed rotunda, spa · 9.1 Booking.com' },
      { name: 'Hotel Bless Madrid', note: 'Bless Collection — Salamanca neighborhood, rooftop pool and bar, vibrant social-scene terrace · 9.1 Booking.com' }
    ] },
    'malaga': { h: [
      { name: 'Parador de Málaga Gibralfaro', note: 'Paradores — inside Gibralfaro Castle walls, panoramic views of city and bay, pool · 9.2 Booking.com' },
      { name: 'AC Hotel Málaga Palacio by Marriott', note: 'Marriott family — rooftop pool with Alcazaba and port panorama, heart of historic center · 8.7 Booking.com' }
    ] },
    'maldives': { h: [
      { name: 'Gili Lankanfushi', note: 'Independent luxury — adults-only overwater villas, direct lagoon access, no news no shoes philosophy, butler service · 9.6 Booking.com' },
      { name: 'Four Seasons Resort Maldives at Landaa Giraavaru', note: 'Four Seasons brand — UNESCO Biosphere Reserve, overwater villas, dive school, spa island · 9.5 Booking.com' }
    ] },
    'malibu': { h: [
      { name: 'Nobu Hotel Malibu', note: 'Nobu Hospitality — Pacific Coast Highway beachfront, Nobu Restaurant on-site, rooftop pool · 9.0 Booking.com' },
      { name: 'Malibu Beach Inn', note: 'Independent boutique — Carbon Beach ("Billionaire\'s Beach"), 47 rooms each with ocean-view private balcony · 9.0 Booking.com' }
    ] },
    'manuel-antonio': { h: [
      { name: 'Arenas del Mar Beachfront & Rainforest Resort', note: 'Independent — adults-focused, twin-beach location within national park buffer, infinity pool with forest canopy views · 9.4 Booking.com' },
      { name: 'Tulemar Bungalows & Villas', note: 'Independent boutique — tree-canopy bungalows, private beach within park buffer, jungle-to-sea setting · 9.2 Booking.com' }
    ] },
    'marco-island': { h: [
      { name: 'Hilton Marco Island Beach Resort & Spa', note: 'Hilton family — directly on Marco Island\'s main beach, pools, spa, sunset views over Gulf of Mexico · 8.4 Booking.com' },
      { name: 'Marco Beach Ocean Resort', note: 'Independent boutique — 58 suites on the Esplanade, rooftop pool, Gulf-view balconies · 9.0 Booking.com' }
    ] },
    'marktoberdorf': { h: [
      { name: 'Wellnesshotel Hanusel Hof', note: 'Independent — wellness-focused Allgäu retreat, thermal pool and spa, hiking access into the Ammergauer Alps · 8.7 Booking.com' }
    ] },
    'marrakech': { h: [
      { name: 'La Mamounia', note: 'Independent luxury — 1923 legend on 17 acres of palace gardens, three pools, six restaurants, hammam · 9.4 Booking.com' },
      { name: 'Royal Mansour Marrakech', note: 'Independent ultra-luxury — private riads with plunge pools, 2,500 sq m spa, three restaurants · 9.7 Booking.com' }
    ] },
    'marseille': { h: [
      { name: 'InterContinental Marseille - Hotel Dieu', note: 'IHG brand — converted 18th-century hospital above the Vieux-Port, rooftop pool, panoramic Old Town views · 9.2 Booking.com' },
      { name: 'Sofitel Marseille Vieux-Port', note: 'Sofitel brand — Old Port frontage, terrace views, spa, Les Trois Forts gastronomic restaurant · 8.8 Booking.com' }
    ] },
    'maui': { h: [
      { name: 'Hotel Wailea, Relais & Châteaux', note: 'Relais & Châteaux — adults-only on Wailea\'s Ulua Ridge, pool and whirlpool, spectacular West Maui sunset views · 9.5 Booking.com' },
      { name: 'Andaz Maui at Wailea Resort', note: 'Hyatt brand — five pools on Mokapu Beach, cliff-edge adults pool, seven dining venues · 9.1 Booking.com' }
    ] },
    'miami': { h: [
      { name: 'The Setai Miami Beach', note: 'Independent luxury — three infinity pools, private beach on Collins Avenue, Asian-influenced spa and restaurant · 9.3 Booking.com' },
      { name: 'Faena Hotel Miami Beach', note: 'Faena brand — oceanfront on mid-Beach, Damien Hirst woolly mammoth, Tierra Santa Healing House spa · 9.1 Booking.com' }
    ] },
    'milan': { h: [
      { name: 'Bulgari Hotel Milano', note: 'Bulgari Hotels — private 4,000 sq m garden, golden onyx pool, Bulgari Spa, Brera neighborhood adjacency · 9.5 Booking.com' },
      { name: 'Four Seasons Hotel Milano', note: 'Four Seasons brand — 15th-century convent, Via Gesù courtyard garden, La Veranda restaurant · 9.4 Booking.com' }
    ] },
    'monaco': { h: [
      { name: 'Hotel de Paris Monte-Carlo', note: 'SBM brand — 1864 Place du Casino landmark, outdoor pool, Louis XV three-Michelin-star dining · 9.3 Booking.com' },
      { name: 'Hotel Hermitage Monte-Carlo', note: 'SBM brand — Belle Époque landmark, heated outdoor pool, Vistamar Mediterranean restaurant · 9.2 Booking.com' }
    ] },
    'montevideo': { h: [
      { name: 'Radisson Montevideo Victoria Plaza Hotel', note: 'Radisson brand — Plaza Independencia landmark tower, outdoor pool, panoramic city views · 8.3 Booking.com' },
      { name: 'Cottage Hotel Montevideo', note: 'Independent boutique — Pocitos neighborhood, curated art, quiet residential atmosphere · 9.1 Booking.com' }
    ] },
    'montreal': { h: [
      { name: 'Ritz-Carlton, Montréal', note: 'Ritz-Carlton brand — 1912 Sherbrooke Street landmark, spa with indoor pool, Maison Boulud gastronomic dining · 9.3 Booking.com' },
      { name: 'Le Mount Stephen', note: 'Independent luxury — 1883 Golden Square Mile mansion, intimate 90 rooms, Bar George restaurant · 9.4 Booking.com' }
    ] },
    'munich': { h: [
      { name: 'Hotel Vier Jahreszeiten Kempinski', note: 'Kempinski brand — 1858 Maximilianstrasse landmark, spa with indoor pool, Michelin-starred Schwarzreiter · 9.2 Booking.com' },
      { name: 'The Charles Hotel Munich', note: 'Rocco Forte brand — Schwabing neighborhood, outdoor pool and garden, Sophia\'s Restaurant · 9.3 Booking.com' }
    ] },
    'muscat': { h: [
      { name: 'The Chedi Muscat', note: 'GHM brand — 21 acres on the Sea of Oman, three pools including The Long Pool, award-winning spa · 9.1 Booking.com' },
      { name: 'Al Bustan Palace, A Ritz-Carlton Hotel', note: 'Ritz-Carlton brand — private crescent-cove beach, outdoor amphitheater, palace-scale architecture · 9.0 Booking.com' }
    ] },
    'mykonos': { h: [
      { name: 'Santa Marina, A Luxury Collection Resort', note: 'Marriott Luxury Collection — private beach on Ornos Bay, infinity pools, Caprice beach bar · 9.1 Booking.com' },
      { name: 'Kivotos Mykonos', note: 'Independent boutique — Ornos Bay, two seawater pools, private beach, on-site cinema · 9.3 Booking.com' }
    ] },
    'napa': { h: [
      { name: 'Meadowood Napa Valley', note: 'Independent luxury — 250 acres, croquet, pools, hiking trails, three-Michelin-star Restaurant at Meadowood · 9.4 Booking.com' },
      { name: 'Auberge du Soleil', note: 'Auberge Resorts — hillside above Rutherford, outdoor pool with vineyard views, Michelin-starred restaurant · 9.3 Booking.com' }
    ] },
    'naples': { h: [
      { name: 'Grand Hotel Vesuvio', note: 'Independent luxury — Santa Lucia seafront, rooftop pool with Vesuvius views, 1882 heritage hotel · 9.2 Booking.com' },
      { name: 'Hotel Romeo Napoli', note: 'Independent boutique — port-view suites, Michelin-starred Il Comandante, rooftop pool with bay panorama · 9.3 Booking.com' }
    ] },
    'naples-florida': { h: [
      { name: 'Naples Grande Beach Resort', note: 'Independent — 3-mile private beach, three pools, nine tennis courts, Gulf sunset views · 9.0 Booking.com' },
      { name: 'Inn on Fifth', note: 'Independent boutique — downtown Fifth Avenue South, rooftop pool and spa, Sunday Jazz brunch · 9.2 Booking.com' }
    ] },
    'nashville': { h: [
      { name: 'Virgin Hotels Nashville', note: 'Virgin Hotels — Gulch neighborhood, rooftop pool, Commons Club dining and bar, boutique design · 8.9 Booking.com' },
      { name: 'Conrad Nashville', note: 'Hilton family — Midtown luxury tower, outdoor pool, Mimo Restaurant, walkable to Music Row · 9.1 Booking.com' }
    ] },
    'natal': { h: [
      { name: 'Rifóles Beach Hotel & Resort', note: 'Independent — beachfront on Ponta Negra, three pools, ocean views, close to Natal nightlife · 8.9 Booking.com' },
      { name: 'Ocean Palace Beach Resort & Bungalows', note: 'Independent — Ponta Negra Beach frontage, full resort with multiple pools and water park · 8.5 Booking.com' }
    ] },
    'new-orleans': { h: [
      { name: 'The Ritz-Carlton, New Orleans', note: 'Ritz-Carlton brand — Canal Street landmark in 1907 Beaux-Arts building, spa, Club Lounge · 9.1 Booking.com' },
      { name: 'Windsor Court Hotel', note: 'Independent luxury — AAA Five Diamond, $8M art collection, afternoon tea, pool and spa · 9.2 Booking.com' }
    ] },
    'new-york': { h: [
      { name: 'The Mark Hotel', note: 'Independent luxury — 25 East 77th Street Upper East Side, largest suite in NYC, Jean-Georges Vongerichten restaurant · 9.4 Booking.com' },
      { name: 'The Carlyle, A Rosewood Hotel', note: 'Rosewood brand — 1930 Upper East Side landmark, Bemelmans Bar murals, Café Carlyle cabaret · 9.5 Booking.com' }
    ] },
    'nice': { h: [
      { name: 'Hôtel Le Negresco', note: 'Independent luxury — 1913 Promenade des Anglais landmark, Royal Suite, Michelin-starred Chantecler restaurant · 9.0 Booking.com' },
      { name: 'Hyatt Regency Nice Palais de la Méditerranée', note: 'Hyatt brand — 1929 Art Deco Promenade des Anglais façade, sea-view rooftop, spa · 8.7 Booking.com' }
    ] },
    'oahu': { h: [
      { name: 'Royal Hawaiian, a Luxury Collection Resort', note: 'Marriott Luxury Collection — 1927 "Pink Palace of the Pacific," oceanfront on central Waikiki Beach, four pools · 9.1 Booking.com' },
      { name: 'Four Seasons Resort Oahu at Ko Olina', note: 'Four Seasons brand — West Oahu lagoon beach, adults-focused pools, spa, away from Waikiki crowds · 9.3 Booking.com' }
    ] },
    'oaxaca': { h: [
      { name: 'Casa Oaxaca Hotel', note: 'Independent boutique — 6 suites around a colonial courtyard, rooftop pool, acclaimed El Restaurante, historic zone · 9.4 Booking.com' },
      { name: 'Hotel Escondido', note: 'Independent boutique — Oaxaca coast, clifftop cabañas, ocean views, farm-to-table restaurant · 9.3 Booking.com' }
    ] },
    'olinda': { h: [
      { name: 'Pousada dos Quatro Cantos', note: 'Independent boutique — colonial mansion in historic center, pool, close to Carnaval festivities · 9.2 Booking.com' },
      { name: 'Pousada do Amparo', note: 'Independent — 16th-century colonial house in UNESCO World Heritage town, art-filled rooms, garden · 9.0 Booking.com' }
    ] },
    'orcas-island': { h: [
      { name: 'Outlook Inn', note: 'Independent boutique — Eastsound village center, wraparound deck with water views, farm-fresh breakfast · 9.2 Booking.com' },
      { name: 'Deer Harbor Inn', note: 'Independent — Deer Harbor overlook, cottage-style rooms, outdoor hot tub, kayak rentals · 9.1 Booking.com' }
    ] },
    'orlando': { h: [
      { name: 'Loews Portofino Bay Hotel at Universal Orlando', note: 'Loews brand — Italian Riviera theming, three pools, on-site Universal Express Pass access · 9.0 Booking.com' },
      { name: 'Walt Disney World Swan Reserve', note: 'Autograph Collection (Marriott) — on Disney property, multilevel pool, three restaurants, complimentary MagicBand · 9.1 Booking.com' }
    ] },
    'osaka': { h: [
      { name: 'InterContinental Osaka', note: 'IHG brand — Grand Front Osaka, 57th-floor Pierre restaurant panorama, spa and indoor pool · 9.0 Booking.com' },
      { name: 'Conrad Osaka', note: 'Hilton family — Nakanoshima Festival City, sky infinity pool on 40th floor, harbor views · 9.2 Booking.com' }
    ] },
    'oslo': { h: [
      { name: 'The Thief', note: 'Independent boutique — Tjuvholmen Sculpture Park waterfront, spa, contemporary art throughout · 9.3 Booking.com' },
      { name: 'Amerikalinjen', note: 'Independent — 1919 Norwegian America Line headquarters, 122 rooms, three restaurants, rooftop bar · 9.2 Booking.com' }
    ] },
    'oxford': { h: [
      { name: 'Belmond Le Manoir aux Quat\'Saisons', note: 'Belmond brand — Raymond Blanc\'s two-Michelin-star retreat in Great Milton, 32 rooms, kitchen garden · 9.7 Booking.com' },
      { name: 'Macdonald Randolph Hotel', note: 'Macdonald Hotels — 1866 Neo-Gothic facing the Ashmolean, Spires spa, afternoon tea tradition · 8.9 Booking.com' }
    ] },
    'palawan': { h: [
      { name: 'Amanpulo', note: 'Aman brand — Pamalican private island, 40 casitas, crystal-clear lagoon, seaplane or charter access · 9.7 Booking.com' },
      { name: 'El Nido Resorts Miniloc Island', note: 'Independent — island resort in Bacuit Archipelago, overwater cottages, snorkeling straight off the deck · 9.1 Booking.com' }
    ] },
    'palm-desert': { h: [
      { name: 'The Ritz-Carlton, Rancho Mirage', note: 'Ritz-Carlton brand — Coachella Valley hillside, outdoor pools, spa, panoramic desert valley views · 9.2 Booking.com' },
      { name: 'Parker Palm Springs', note: 'Parker brand — 144 acres of vintage desert resort, two pools, Gene Autry\'s former home, Palm Springs style · 9.0 Booking.com' }
    ] },
    'palo-alto': { h: [
      { name: 'Rosewood Sand Hill', note: 'Rosewood brand — 16-acre Menlo Park estate, two outdoor pools, Sense spa, Madera restaurant · 9.3 Booking.com' },
      { name: 'The Clement Palo Alto', note: 'Independent boutique — downtown Palo Alto, 23 suites, butler service, close to University Avenue · 9.4 Booking.com' }
    ] },
    'paris': { h: [
      { name: 'Le Meurice', note: 'Dorchester Collection — Tuileries-facing Palace hotel, two-Michelin-star Alain Ducasse restaurant, spa · 9.5 Booking.com' },
      { name: 'Hotel de Crillon, A Rosewood Hotel', note: 'Rosewood brand — Place de la Concorde landmark, Les Ambassadeurs brasserie, indoor pool · 9.5 Booking.com' }
    ] },
    'pasadena': { h: [
      { name: 'The Langham Huntington Pasadena', note: 'Langham brand — 23-acre estate, Olympic pool, formal gardens, 1914 landmark hotel · 9.1 Booking.com' },
      { name: 'Hotel Dena Pasadena, Curio Collection by Hilton', note: 'Hilton Curio — near Convention Center, rooftop pool, design-forward rooms · 8.6 Booking.com' }
    ] },
    'pensacola': { h: [
      { name: 'Portofino Island Resort', note: 'Independent — Santa Rosa Island, Gulf Spa, multiple pools, direct Gulf of Mexico beachfront · 8.7 Booking.com' },
      { name: 'The Hotel Pensacola Beach, a Wyndham Hotel', note: 'Wyndham brand — Pensacola Beach, Gulf-view rooms, pool, casual beach dining · 8.3 Booking.com' }
    ] },
    'petra': { h: [
      { name: 'Petra Guest House Hotel', note: 'Independent boutique — at the siq entrance gate, Cave Bar in a 2,000-year-old Nabataean cave, unbeatable proximity to the Treasury · 8.9 Booking.com' },
      { name: 'The Old Village Hotel & Resort Petra', note: 'Independent — village setting near the siq entrance, terrace pool with wadi views, traditional stone architecture · 9.0 Booking.com' }
    ] },
    'philadelphia': { h: [
      { name: 'The Logan Hotel, Curio Collection by Hilton', note: 'Hilton Curio — Logan Square, rooftop pool and urban garden terrace, Steps restaurant · 9.0 Booking.com' },
      { name: 'Hotel Monaco Philadelphia, a Kimpton Hotel', note: 'Kimpton — Old City former Federal Customs House, curated social spaces, pet-friendly · 8.9 Booking.com' }
    ] },
    'phoenix': { h: [
      { name: 'The Arizona Biltmore, A Waldorf Astoria Resort', note: 'Waldorf Astoria brand — 1929 Frank Lloyd Wright-influenced design, eight pools, lush landscaping, Esplanade spa · 9.0 Booking.com' },
      { name: 'Royal Palms Resort and Spa, A Tribute Portfolio Resort', note: 'Marriott Tribute — hacienda-style resort, T. Cook\'s restaurant, pool, Camelback Mountain backdrop · 8.9 Booking.com' }
    ] },
    'phuket': { h: [
      { name: 'Amanpuri', note: 'Aman brand — Phuket\'s original luxury resort since 1988, private beach, 30 pavilions and villas, two pools · 9.5 Booking.com' },
      { name: 'Trisara', note: 'Independent luxury — private pool villas on Nai Thon Bay, Pru restaurant (Asia\'s 50 Best), beachfront setting · 9.6 Booking.com' }
    ] },
    'pisa': { h: [
      { name: 'Hotel Duomo Pisa', note: 'Independent boutique — steps from Piazza dei Miracoli, rooftop terrace with Leaning Tower and Baptistery views · 9.0 Booking.com' }
    ] },
    'pokhara': { h: [
      { name: 'Pavilions Himalayas', note: 'Independent boutique — eco-luxury farm retreat on Annapurna foothills, Phewa Lake views, organic farm produce · 9.3 Booking.com' },
      { name: 'Temple Tree Resort & Spa', note: 'Independent — Lakeside district, Phewa Lake views, pool, Himalayan spa treatments · 8.8 Booking.com' }
    ] },
    'portland': { h: [
      { name: 'The Benson Hotel, Autograph Collection', note: 'Marriott Autograph Collection — 1912 downtown landmark, Circassian walnut-paneled lobby, The London Grill · 8.9 Booking.com' },
      { name: 'Hotel deLuxe', note: 'Independent boutique — Hollywood-themed vintage design, Driftwood Room bar, Pearl District adjacent · 8.7 Booking.com' }
    ] },
    'porto': { h: [
      { name: 'The Yeatman Hotel', note: 'Independent luxury — Taylor\'s Port wine cellars hilltop, infinity pool, two-Michelin-star Yeatman Restaurant, Douro panorama · 9.5 Booking.com' },
      { name: 'Torel Avantgarde', note: 'Independent boutique — adults-only, hilltop gardens with city and Douro panoramas, outdoor pool · 9.2 Booking.com' }
    ] },
    'porto-alegre': { h: [
      { name: 'Sheraton Porto Alegre Hotel', note: 'Marriott family — Praia de Belas district, outdoor pool, business-class service, convention facilities · 8.4 Booking.com' },
      { name: 'Intercity Porto Alegre Iguatemi', note: 'Intercity Hotels — Moinhos de Vento neighborhood, modern boutique, spa · 9.0 Booking.com' }
    ] },
    'prague': { h: [
      { name: 'Four Seasons Hotel Prague', note: 'Four Seasons brand — Staré Město with Vltava views, spa with outdoor pool, CottoCrudo restaurant · 9.4 Booking.com' },
      { name: 'Hotel Aria', note: 'Independent boutique — music-themed, private Vrtba Garden access, Coda Rooftop with castle and city views · 9.5 Booking.com' }
    ] },
    'puerto-rico': { h: [
      { name: 'El San Juan Hotel, Curio Collection by Hilton', note: 'Hilton Curio — Isla Verde beachfront, historic 1958 mahogany lobby, three pools · 8.9 Booking.com' },
      { name: 'Dorado Beach, a Ritz-Carlton Reserve', note: 'Ritz-Carlton Reserve — 1,400-acre beachfront estate, six pools, two golf courses · 9.4 Booking.com' }
    ] },
    'puerto-vallarta': { h: [
      { name: 'Garza Blanca Preserve Resort & Spa', note: 'Independent luxury — hillside jungle preserve with private white-sand beach, infinity pools, adults-only towers · 9.3 Booking.com' },
      { name: 'Casa Velas Hotel Boutique', note: 'Independent boutique — adults-only, marina suite design, beach club, oceanfront pool · 9.2 Booking.com' }
    ] },
    'quebec-city': { h: [
      { name: 'Auberge Saint-Antoine', note: 'Independent luxury — Old Port waterfront, archaeological artifacts displayed throughout, rooftop terrace views · 9.4 Booking.com' },
      { name: 'Hotel-Musée Premières Nations', note: 'Independent — Wendake First Nations reserve, 55 rooms designed around indigenous culture, traditional cuisine · 9.3 Booking.com' }
    ] },
    'queenstown': { h: [
      { name: 'Eichardt\'s Private Hotel', note: 'Independent boutique — lakefront, 5-suite private hotel, celebrated Eichardt\'s Bar, Queenstown historic building · 9.5 Booking.com' },
      { name: 'Rees Hotel & Luxury Apartments', note: 'Independent — lakefront panoramas, spa and pool, fine dining, private jetty · 9.2 Booking.com' }
    ] },
    'recife': { h: [
      { name: 'Sheraton Recife Hotel', note: 'Marriott family — Boa Viagem beach district, outdoor pool, multiple restaurants, business facilities · 8.4 Booking.com' },
      { name: 'Hotel Boa Viagem by Nobile', note: 'Nobile Hotels — directly on Boa Viagem beach, rooftop pool, sea views · 8.7 Booking.com' }
    ] },
    'reykjavik': { h: [
      { name: 'Hotel Borg', note: 'Independent luxury — 1930 Art Deco landmark on Austurvöllur Square, Michelin Guide listed restaurant, timeless elegance · 9.1 Booking.com' },
      { name: 'The Reykjavik EDITION', note: 'Marriott Edition brand — harbour panoramas, outdoor heated infinity pool, Tides restaurant · 9.2 Booking.com' }
    ] },
    'rhodes': { h: [
      { name: 'Lindos Blu Luxury Hotel & Suites', note: 'Independent boutique — adults-only clifftop above Lindos Bay, infinity pool, cave-style architecture · 9.4 Booking.com' },
      { name: 'Melenos Lindos Hotel', note: 'Independent boutique — above Lindos village, sea-view terraces, pool, ceramics-accented Aegean design · 9.5 Booking.com' }
    ] },
    'rio-de-janeiro': { h: [
      { name: 'Hotel Nacional Rio de Janeiro', note: 'Independent — Oscar Niemeyer-designed 1968 modernist cylinder, São Conrado beachfront, iconic architecture · 9.0 Booking.com' },
      { name: 'Fairmont Rio de Janeiro Copacabana', note: 'Fairmont brand — Copacabana beachfront, sky pool with Sugarloaf views, multiple restaurants · 9.1 Booking.com' }
    ] },
    'rome': { h: [
      { name: 'Hotel Eden, a Dorchester Collection Hotel', note: 'Dorchester Collection — Via Ludovisi, rooftop restaurant Il Giardino with seven-hill panorama, spa · 9.4 Booking.com' },
      { name: 'Villa Spalletti Trivelli', note: 'Independent boutique — 12 rooms in private noble villa near Quirinale, garden, pool, antique furnishings · 9.5 Booking.com' }
    ] },
    'salvador': { h: [
      { name: 'Pestana Convento do Carmo', note: 'Pestana brand — 16th-century Carmelite convent in Pelourinho UNESCO district, pool and spa · 9.3 Booking.com' },
      { name: 'Zank by Toque Hotel', note: 'Independent boutique — adults-only, Santo Antônio neighborhood clifftop, pool with bay panorama · 9.2 Booking.com' }
    ] },
    'salzburg': { h: [
      { name: 'Schloss Mönchstein', note: 'Independent luxury — 14th-century castle above the Old Town, spa, panoramic garden with city views · 9.2 Booking.com' },
      { name: 'Hotel Bristol Salzburg', note: 'Small Luxury Hotels — Makartplatz, spa with indoor pool, facing Landestheater, classic elegance · 9.3 Booking.com' }
    ] },
    'san-diego': { h: [
      { name: 'The US Grant Hotel', note: 'IHG brand — 1910 downtown landmark, spa, Lobby Bar, Grant Grill, Gaslamp Quarter location · 8.8 Booking.com' },
      { name: 'Estancia La Jolla Hotel & Spa', note: 'Independent boutique — La Jolla village, Spanish-hacienda style, garden spa, pool · 9.1 Booking.com' }
    ] },
    'san-francisco': { h: [
      { name: 'Fairmont San Francisco', note: 'Fairmont brand — 1907 Nob Hill landmark, spa, Tonga Room tiki bar, rooftop garden suite · 8.9 Booking.com' },
      { name: 'Hotel Drisco', note: 'Independent boutique — 1903 Edwardian in Pacific Heights, complimentary chauffeur service, quiet luxury · 9.3 Booking.com' }
    ] },
    'san-jose': { h: [
      { name: 'Fairmont San Jose', note: 'Fairmont brand — Almaden Valley, rooftop pool, multiple restaurants, convention center linked · 8.8 Booking.com' },
      { name: 'Hotel De Anza, a Tapestry Collection by Hilton', note: 'Hilton Tapestry — 1931 Art Deco landmark in downtown San Jose, La Pastaia Italian restaurant · 8.6 Booking.com' }
    ] },
    'san-jose-costa-rica': { h: [
      { name: 'Hotel Grano de Oro', note: 'Independent boutique — converted Victorian mansion, tropical gardens, pool, Café Mundo restaurant · 9.3 Booking.com' },
      { name: 'InterContinental Costa Rica at Multiplaza Mall', note: 'IHG brand — Escazú upscale suburb, pools, multiple restaurants, convenient business location · 8.7 Booking.com' }
    ] },
    'san-juan-island': { h: [
      { name: 'Friday Harbor House Hotel', note: 'Independent boutique — above Friday Harbor Marina, harbor and Olympic Mountain views, Pacific Northwest design · 9.0 Booking.com' }
    ] },
    'san-sebastian': { h: [
      { name: 'Hotel Maria Cristina, a Luxury Collection Hotel', note: 'Marriott Luxury Collection — 1912 Belle Époque landmark on Urumea riverside, San Sebastián Film Festival HQ · 9.3 Booking.com' },
      { name: 'Akelarre Hotel', note: 'Independent — Pedro Subijana three-Michelin-star restaurant, 22 rooms on Igeldo cliffs, Bay of Biscay panorama · 9.7 Booking.com' }
    ] },
    'santa-barbara': { h: [
      { name: 'El Encanto, A Belmond Hotel', note: 'Belmond brand — hilltop Spanish-Colonial bungalows, infinity pool, ocean and garden views · 9.2 Booking.com' },
      { name: 'Rosewood Miramar Beach', note: 'Rosewood brand — Montecito oceanfront, 16 acres of gardens, pool, beachfront restaurant · 9.3 Booking.com' }
    ] },
    'santa-cruz': { h: [
      { name: 'Chaminade Resort & Spa', note: 'Independent — hilltop eucalyptus-forest retreat above Monterey Bay, tennis courts, spa · 8.9 Booking.com' },
      { name: 'Babbling Brook Inn', note: 'Independent boutique — garden B&B with cascading creek, antiques, walking distance to downtown · 9.3 Booking.com' }
    ] },
    'santa-fe': { h: [
      { name: 'Rosewood Inn of the Anasazi', note: 'Rosewood brand — kiva fireplaces, hand-woven rugs, steps from the historic Plaza · 9.3 Booking.com' },
      { name: 'La Fonda on the Plaza', note: 'Independent — 1922 Pueblo Revival landmark "Inn at the end of the Santa Fe Trail," rooftop cantina · 9.0 Booking.com' }
    ] },
    'santa-monica': { h: [
      { name: 'Hotel Shutters on the Beach', note: 'Independent luxury — directly on Santa Monica Beach, pool, 1 Pico restaurant, ocean-view rooms · 9.4 Booking.com' },
      { name: 'Casa del Mar', note: 'InterContinental brand — Craftsman-style 1926 beachfront mansion, spa, oceanfront dining · 9.2 Booking.com' }
    ] },
    'santiago': { h: [
      { name: 'W Santiago', note: 'Marriott W brand — Las Condes financial district, rooftop WET DECK pool, city skyline views · 8.8 Booking.com' },
      { name: 'Hotel Bidasoa', note: 'Independent boutique — Vitacura residential neighborhood, 19 rooms, curated personal service · 9.2 Booking.com' }
    ] },
    'santorini': { h: [
      { name: 'Canaves Oia Suites', note: 'Independent luxury — Oia clifftop, infinity pools, Michelin Guide-listed restaurant, sunset-facing caldera view · 9.6 Booking.com' },
      { name: 'Grace Hotel Santorini, Auberge Resorts Collection', note: 'Auberge Resorts — Imerovigli caldera cliff, adults-only, infinity pool with champagne service · 9.5 Booking.com' }
    ] },
    'sarasota': { h: [
      { name: 'The Westin Sarasota', note: 'Marriott family — downtown bayfront tower, outdoor rooftop pool, marina and Sarasota Bay views · 9.0 Booking.com' },
      { name: 'Hotel Ranola', note: 'Independent boutique — downtown historic district, 10 rooms, chef-driven breakfast, walkable arts scene · 9.4 Booking.com' }
    ] },
    'sardinia': { h: [
      { name: 'Hotel Pitrizza, a Luxury Collection Resort', note: 'Marriott Luxury Collection — Costa Smeralda private rocky bay, saltwater pool, adults-only enclave · 9.3 Booking.com' },
      { name: 'Romazzino, A Belmond Hotel', note: 'Belmond brand — Costa Smeralda private beach, parasol-shaded white sand, boat excursions · 9.1 Booking.com' }
    ] },
    'scottsdale': { h: [
      { name: 'The Phoenician, a Luxury Collection Resort', note: 'Marriott Luxury Collection — 250 acres on Camelback Mountain, three pools, spa, nine restaurants · 9.2 Booking.com' },
      { name: 'Andaz Scottsdale Resort & Bungalows', note: 'Hyatt brand — desert rock-formation setting, Weft & Warp restaurant, desert-botanical spa treatments · 9.2 Booking.com' }
    ] },
    'seattle': { h: [
      { name: 'The Edgewater Hotel', note: 'Independent — Elliott Bay waterfront, mountain and water views, Eddie Vedder memorabilia, Six Seven restaurant · 9.1 Booking.com' },
      { name: 'Fairmont Olympic Hotel', note: 'Fairmont brand — 1924 Italian Renaissance downtown landmark, indoor pool, The Georgian Room · 9.0 Booking.com' }
    ] },
    'sedona': { h: [
      { name: 'Enchantment Resort', note: 'Independent luxury — canyon-floor 70-acre resort in Boynton Canyon, mii amo destination spa, red-rock surrounds · 9.3 Booking.com' },
      { name: 'L\'Auberge de Sedona', note: 'Independent luxury — Oak Creek canyon setting, cottage suites, farm-to-table Cress restaurant · 9.2 Booking.com' }
    ] },
    'seoul': { h: [
      { name: 'The Shilla Seoul', note: 'Independent luxury — 23 acres of gardens on Namsan Hill, indoor pool, Korean contemporary luxury, flagship spa · 9.2 Booking.com' },
      { name: 'Park Hyatt Seoul', note: 'Hyatt brand — Gangnam CBD, 24th-floor heated indoor infinity pool, Lounge on the Park panoramic bar · 9.1 Booking.com' }
    ] },
    'seville': { h: [
      { name: 'Hotel Alfonso XIII, a Luxury Collection Hotel', note: 'Marriott Luxury Collection — 1928 Mudéjar-style royal guest house, courtyard pool, heart of historic quarter · 9.3 Booking.com' },
      { name: 'Casa 1800 Sevilla', note: 'Independent boutique — 33 rooms in a 19th-century mansion near the Cathedral, rooftop terrace with tower views · 9.6 Booking.com' }
    ] },
    'seychelles': { h: [
      { name: 'North Island Lodge', note: 'Independent ultra-luxury — private island, 11 villas, barefoot luxury philosophy, exclusive conservation reserve · 9.7 Booking.com' },
      { name: 'Six Senses Zil Pasyon', note: 'Six Senses brand — private island Félicité, overwater spa, hilltop villas, coral reef · 9.6 Booking.com' }
    ] },
    'shanghai': { h: [
      { name: 'The Peninsula Shanghai', note: 'Peninsula brand — 1929 Bund landmark, rooftop Peter Café & Bar, helicopter landing, Bund-view rooms · 9.4 Booking.com' },
      { name: 'Waldorf Astoria Shanghai on the Bund', note: 'Hilton family — 1911 Shanghai Club, Bund-facing, indoor pool, Long Bar history · 9.3 Booking.com' }
    ] },
    'sicily': { h: [
      { name: 'San Domenico Palace, Taormina, A Four Seasons Hotel', note: 'Four Seasons brand — 14th-century Dominican monastery, cliffside garden, pool, Etna and Ionian Bay views · 9.3 Booking.com' },
      { name: 'Belmond Grand Hotel Timeo', note: 'Belmond brand — 1873 hilltop above Taormina, pool, Teatro Greco views, La Terrazza restaurant · 9.4 Booking.com' }
    ] },
    'siena': { h: [
      { name: 'Castello di Casole, A Belmond Hotel', note: 'Belmond brand — 11th-century hilltop estate, wine tower, two pools, 4,200 acres of Tuscan countryside · 9.4 Booking.com' },
      { name: 'Relais La Suvera', note: 'Independent — 12th-century papal villa estate, vineyard, spa, antique-furnished rooms · 9.2 Booking.com' }
    ] },
    'singapore': { h: [
      { name: 'Capella Singapore', note: 'Capella Hotels — Sentosa Island estate, three pools, spa, two Michelin-starred restaurants, colonial architecture · 9.5 Booking.com' },
      { name: 'The Fullerton Hotel Singapore', note: 'Independent luxury — 1928 Palladian General Post Office, heritage rooms, 25-metre outdoor pool · 9.2 Booking.com' }
    ] },
    'sint-maarten': { h: [
      { name: 'Belmond La Samanna', note: 'Belmond brand — Baie Longue private beach, three pools, spa, French West Indies elegance · 9.4 Booking.com' },
      { name: 'Princess Heights Luxury Boutique Hotel', note: 'Independent boutique — Oyster Pond hilltop, panoramic Dutch-side ocean views, intimate retreat · 9.3 Booking.com' }
    ] },
    'sintra': { h: [
      { name: 'Tivoli Palácio de Seteais', note: 'Minor Hotels — 18th-century neoclassical palace, manicured gardens, pool, mountain and valley views · 9.3 Booking.com' },
      { name: 'Penha Longa Resort', note: 'Marriott — Sintra hills estate, two golf courses, Michelin-starred LAB restaurant, spa · 9.1 Booking.com' }
    ] },
    'sorrento': { h: [
      { name: 'Bellevue Syrene', note: 'Independent boutique — 1774 noble villa perched on Sorrento cliffs, saltwater pool cut into the rock, Bay of Naples views · 9.3 Booking.com' },
      { name: 'Hotel Bristol Sorrento', note: 'Small Luxury Hotels — clifftop with lift to private sea platform, rooftop pool, Vesuvius panorama · 9.2 Booking.com' }
    ] },
    'split': { h: [
      { name: 'Hotel Vestibul Palace', note: 'Independent boutique — 7 suites inside the Roman Diocletian\'s Palace UNESCO walls, unrivalled historic setting · 9.4 Booking.com' },
      { name: 'Radisson Blu Resort & Spa, Split', note: 'Radisson brand — Stobreč beach and marina, spa, infinity pool · 8.7 Booking.com' }
    ] },
    'stockholm': { h: [
      { name: 'Nobis Hotel Stockholm', note: 'Independent boutique — Norrmalmstorg Square, 201 rooms, spa, celebrated Gold Bar and restaurant · 9.2 Booking.com' },
      { name: 'At Six', note: 'Independent boutique — Brunkebergstorg, prominent art collection, rooftop bar and pool, 343 rooms · 9.1 Booking.com' }
    ] },
    'strasbourg': { h: [
      { name: 'Regent Petite France & Spa', note: 'Independent — 16th-century ice-house in Petite France canal district, spa, river views · 9.3 Booking.com' },
      { name: 'Hôtel Hannong', note: 'Independent boutique — Art Deco interiors, central location, wine bar, Alsatian brasserie · 8.9 Booking.com' }
    ] },
    'stuttgart': { h: [
      { name: 'Le Méridien Stuttgart', note: 'Marriott family — central location adjacent to Staatstheater, spa and pool, modern design · 8.8 Booking.com' },
      { name: 'Steigenberger Graf Zeppelin Stuttgart', note: 'Steigenberger brand — opposite the main train station, classic grandeur, Zeppelin restaurant · 8.7 Booking.com' }
    ] },
    'sydney': { h: [
      { name: 'Park Hyatt Sydney', note: 'Hyatt brand — Lavender Bay, Opera House and Harbour Bridge views from 155 rooms, rooftop pool · 9.4 Booking.com' },
      { name: 'Capella Sydney', note: 'Capella Hotels — restored 1950s–60s heritage ensemble, spa, David Laris-conceived dining · 9.5 Booking.com' }
    ] },
    'sao-luis': { h: [
      { name: 'Pousada Portas da Amazônia', note: 'Independent boutique — renovated colonial mansion in Reviver historic district, São Luís UNESCO architecture · 9.0 Booking.com' },
      { name: 'Grand São Luís Hotel', note: 'Independent — city center, rooftop pool, classic architecture, convenient for historic center access · 8.3 Booking.com' }
    ] },
    'sao-paulo': { h: [
      { name: 'Rosewood São Paulo', note: 'Rosewood brand — Cidade Matarazzo complex, pool, Evvai Michelin-starred dining, design landmark · 9.2 Booking.com' },
      { name: 'L\'Hôtel Porto Bay São Paulo', note: 'Porto Bay brand — Jardins neighborhood, pool, Il Gattopardo Italian restaurant, boutique luxury · 9.0 Booking.com' }
    ] },
    'taipei': { h: [
      { name: 'Mandarin Oriental, Taipei', note: 'Mandarin Oriental brand — Zhongshan District, outdoor pool, Michelin-starred Ya Ge Cantonese restaurant · 9.3 Booking.com' },
      { name: 'W Taipei', note: 'Marriott W brand — Xinyi Anhe area, WET rooftop pool, PURPLE cocktail lounge · 8.9 Booking.com' }
    ] },
    'tallinn': { h: [
      { name: 'Hotel Telegraaf, Autograph Collection', note: 'Marriott Autograph Collection — 1919 restored telegram palace in Old Town, spa, historic vaulted interiors · 9.2 Booking.com' },
      { name: 'Schlössle Hotel', note: 'Small Luxury Hotels — 15th-century merchant house in medieval Old Town, oak-panelled rooms, intimate · 9.4 Booking.com' }
    ] },
    'tbilisi': { h: [
      { name: 'Stamba Hotel', note: 'Independent — 1930s Soviet-era publishing house, 8-metre loft ceilings, courtyard pool, garden · 9.4 Booking.com' },
      { name: 'Rooms Hotel Tbilisi', note: 'Independent — contemporary design in Vera neighborhood, rooftop bar, Rioni Restaurant · 9.2 Booking.com' }
    ] },
    'tenerife': { h: [
      { name: 'Royal Garden Villas & Spa', note: 'Independent ultra-luxury — 36 private villas near Adeje, adults-only, each with private pool · 9.6 Booking.com' },
      { name: 'Gran Hotel Bahía del Duque Resort', note: 'Independent luxury — Adeje beach resort, multiple pools, historic Canarian architecture, golf nearby · 9.1 Booking.com' }
    ] },
    'tokyo': { h: [
      { name: 'Aman Tokyo', note: 'Aman brand — Otemachi forest tower, 33rd–35th floor rooms with Imperial Palace views, spa with indoor pool · 9.5 Booking.com' },
      { name: 'The Okura Tokyo', note: 'Independent luxury — 1962 mid-century Japanese modernism, restored heritage wing, Orchid Bar, spa · 9.3 Booking.com' }
    ] },
    'toledo': { h: [
      { name: 'Parador de Toledo', note: 'Paradores — hilltop across the Tagus with the famous El Greco panorama, pool, medieval setting · 9.1 Booking.com' },
      { name: 'Hotel Cigarral El Bosque', note: 'Independent boutique — hilltop olive grove estate with Toledo cityscape panorama, pool, gardens · 9.2 Booking.com' }
    ] },
    'toronto': { h: [
      { name: 'The Hazelton Hotel', note: 'Independent luxury — Yorkville, private cinema, ONE Restaurant by Mark McEwan, spa · 9.3 Booking.com' },
      { name: 'Four Seasons Hotel Toronto', note: 'Four Seasons brand — Yorkville, outdoor pool, Café Boulud, spa, gallery-level art collection · 9.1 Booking.com' }
    ] },
    'tromso': { h: [
      { name: 'Scandic Ishavshotel', note: 'Scandic brand — Arctic Ocean waterfront, panoramic views of the fjord and Tromsø Cathedral · 8.8 Booking.com' },
      { name: 'Clarion Hotel The Edge', note: 'Nordic Choice Hotels — waterfront, restaurants and bar overlooking the harbor and mountains · 8.7 Booking.com' }
    ] },
    'turin': { h: [
      { name: 'Golden Palace Hotel', note: 'Independent — Via dell\'Arcivescovado, jazz bar, spa, walkable to Porta Palazzo market · 9.1 Booking.com' },
      { name: 'Starhotels Majestic Torino', note: 'Starhotels — Corso Vittorio Emanuele II, classic grandeur, restaurant, central Turin location · 8.9 Booking.com' }
    ] },
    'turks-and-caicos': { h: [
      { name: 'Amanyara', note: 'Aman brand — Grace Bay, 40 pavilions and villas, coral reef snorkeling, beachfront spa · 9.6 Booking.com' },
      { name: 'Parrot Cay by COMO', note: 'COMO Hotels — private island, COMO Shambhala Retreat spa, white-sand beaches · 9.5 Booking.com' }
    ] },
    'valletta': { h: [
      { name: 'The Phoenicia Malta', note: 'Small Luxury Hotels — 1947 landmark at city gate, outdoor pool in formal gardens, Malta\'s most storied hotel · 9.1 Booking.com' },
      { name: 'Ursulino Malta', note: 'Independent boutique — within the historic city walls, curated rooms, intimate boutique atmosphere · 9.3 Booking.com' }
    ] },
    'vancouver': { h: [
      { name: 'Fairmont Hotel Vancouver', note: 'Fairmont brand — 1939 "Castle in the City," spa, Notch8 Restaurant & Bar, iconic copper roof · 8.9 Booking.com' },
      { name: 'Rosewood Hotel Georgia', note: 'Rosewood brand — 1927 Georgian Revival downtown landmark, outdoor pool, Hawksworth Restaurant · 9.3 Booking.com' }
    ] },
    'venice': { h: [
      { name: 'Belmond Hotel Cipriani', note: 'Belmond brand — Giudecca island, 7-minute private launch, Olympic-size pool, award-winning Oro Restaurant · 9.5 Booking.com' },
      { name: 'Aman Venice', note: 'Aman brand — 16th-century Palazzo Papadopoli on the Grand Canal, two private gardens, private dock · 9.7 Booking.com' }
    ] },
    'verona': { h: [
      { name: 'Due Torri Hotel', note: 'Autograph Collection (Marriott) — 14th-century palazzo near Piazza Brà, antique-furnished rooms, Arena Opera views · 9.1 Booking.com' },
      { name: 'Hotel Gabbia d\'Oro', note: 'Independent boutique — 17th-century noble palazzo near Piazza delle Erbe, antique beds, garden courtyard · 9.3 Booking.com' }
    ] },
    'victoria': { h: [
      { name: 'The Fairmont Empress', note: 'Fairmont brand — 1908 Inner Harbour landmark, spa, Bengal Lounge, afternoon tea tradition · 9.0 Booking.com' },
      { name: 'Inn at Laurel Point', note: 'Independent boutique — waterfront on the Inner Harbour, adults-preferred, Japanese meditation garden · 9.2 Booking.com' }
    ] },
    'vienna': { h: [
      { name: 'Hotel Imperial, a Luxury Collection Hotel, Vienna', note: 'Marriott Luxury Collection — 1863 Crown Prince Rudolf\'s palace on Ringstrasse, Café Imperial tradition · 9.2 Booking.com' },
      { name: 'Park Hyatt Vienna', note: 'Hyatt brand — 1913 Austro-Hungarian bank vault converted to spa and indoor pool, Das Loft restaurant · 9.4 Booking.com' }
    ] },
    'virgin-islands': { h: [
      { name: 'Sugar Bay Resort & Spa', note: 'IHG brand — Sugar Bay Beach, hillside pools and water slides, full-service spa, St. Thomas East End · 8.6 Booking.com' },
      { name: 'Point Pleasant Resort', note: 'Independent boutique — Estate Smith Bay hilltop, studio apartments and suites with bay views, snorkel beach · 9.0 Booking.com' }
    ] },
    'washington-dc': { h: [
      { name: 'Rosewood Washington D.C.', note: 'Rosewood brand — Georgetown neighborhood, outdoor pool, acclaimed Wyld restaurant, townhouse suites · 9.4 Booking.com' },
      { name: 'Four Seasons Hotel Washington DC', note: 'Four Seasons brand — Georgetown, outdoor pool, M Restaurant, spa, Embassy Row adjacent · 9.2 Booking.com' }
    ] },
    'wellington': { h: [
      { name: 'QT Wellington', note: 'QT Hotels — design hotel on The Terrace, Hippopotamus Restaurant, vibrant social public spaces · 8.9 Booking.com' },
      { name: 'InterContinental Wellington', note: 'IHG brand — Lambton Quay, harbour views, spa, central to Te Papa and waterfront · 8.7 Booking.com' }
    ] },
    'whistler': { h: [
      { name: 'Four Seasons Resort and Residences Whistler', note: 'Four Seasons brand — ski-in/ski-out base of Blackcomb, outdoor heated pool, spa · 9.3 Booking.com' },
      { name: 'Nita Lake Lodge', note: 'Independent boutique — Nita Lake waterfront, cross-country trail access, spa, quiet Creekside enclave · 9.4 Booking.com' }
    ] },
    'yellowstone': { h: [
      { name: 'Old Faithful Inn', note: 'Independent — 1904 historic log lodge beside Old Faithful geyser, National Historic Landmark · 9.0 Booking.com' },
      { name: 'Lake Yellowstone Hotel', note: 'Independent — 1891 lakefront colonial structure, panoramic Yellowstone Lake views, inside the park · 8.8 Booking.com' }
    ] },
    'zakynthos': { h: [
      { name: 'Porto Zante Villas & Spa', note: 'Independent ultra-luxury — private white-sand beach, 8 beachfront villas, spa, Laganas Bay turtle sanctuary views · 9.7 Booking.com' },
      { name: 'Lesante Blu Exclusive Beach Resort', note: 'Independent boutique — adults-only on Tsilivi Bay, infinity pool, spa, Ionian Sea views · 9.4 Booking.com' }
    ] },
    'zhangjiajie': { h: [
      { name: 'Pullman Zhangjiajie', note: 'Accor Pullman brand — modern full-service hotel in Zhangjiajie city, pool, 30 minutes from Wulingyuan park gate · 8.8 Booking.com' }
    ] },
    'zurich': { h: [
      { name: 'The Dolder Grand', note: 'Independent luxury — 1899 hillside monument, two-Michelin-star The Restaurant, 4,000 sq m spa, ice rink · 9.4 Booking.com' },
      { name: 'Baur au Lac', note: 'Independent luxury — 1844 lakefront hotel, private garden terrace, Pavillon and Rive Gauche restaurants · 9.3 Booking.com' }
    ] }
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
      var name = document.createElement('div');
      name.className = 'neigh-name';
      name.textContent = hotel.name;
      var note = document.createElement('div');
      note.className = 'neigh-why';
      note.textContent = hotel.note;
      card.appendChild(name);
      card.appendChild(note);
      grid.appendChild(card);
    });
    wrap.appendChild(h);
    wrap.appendChild(grid);
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
     by Brain/scripts/build_best_of_map.py — re-run after adding a new Best-Of
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
    'arenal': [["Hot Springs", "Best-Hot-Springs.html"], ["National Parks", "Best-National-Parks-by-Country.html"], ["Ultra Luxurious Resorts", "Best-Ultra-Luxurious-Resorts.html"], ["Volcanoes", "Best-Volcanoes.html"]],
    'aruba': [["Beaches", "Best-Beaches.html"], ["Islands", "Best-Islands.html"]],
    'athens': [["Architecture", "Best-Architecture.html"], ["Museums", "Best-Museums.html"], ["Resorts", "Best-Resorts.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'atlanta': [["Aquariums", "Best-Aquariums.html"]],
    'azores': [["Islands", "Best-Islands.html"], ["Scuba Diving", "Best-Scuba-Diving.html"]],
    'bahamas': [["Beaches", "Best-Beaches.html"], ["Islands", "Best-Islands.html"], ["Resorts", "Best-Resorts.html"], ["Scuba Diving", "Best-Scuba-Diving.html"]],
    'bali': [["Architecture", "Best-Architecture.html"], ["Beaches", "Best-Beaches.html"], ["Hot Springs", "Best-Hot-Springs.html"], ["Islands", "Best-Islands.html"], ["Resorts", "Best-Resorts.html"], ["Ultra Luxurious Resorts", "Best-Ultra-Luxurious-Resorts.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'bangkok': [["Aquariums", "Best-Aquariums.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Resorts", "Best-Resorts.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'barbados': [["Beaches", "Best-Beaches.html"], ["Caves", "Best-Caves.html"], ["Islands", "Best-Islands.html"], ["Resorts", "Best-Resorts.html"]],
    'barcelona': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Aquariums", "Best-Aquariums.html"], ["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'beijing': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Castles", "Best-Castles.html"], ["Museums", "Best-Museums.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'bergen': [["Kids' Museums", "Best-Kids-Museums.html"]],
    'berlin': [["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Gardens", "Best-Gardens.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'bhutan': [["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Ultra Luxurious Resorts", "Best-Ultra-Luxurious-Resorts.html"]],
    'big-island': [["Beaches", "Best-Beaches.html"], ["Islands", "Best-Islands.html"], ["Resorts", "Best-Resorts.html"], ["Volcanoes", "Best-Volcanoes.html"]],
    'bologna': [["Unique Museums", "Best-Unique-Museums.html"]],
    'bora-bora': [["Islands", "Best-Islands.html"], ["Resorts", "Best-Resorts.html"]],
    'bordeaux': [["Wine Regions", "Best-Wine-Regions.html"]],
    'boston': [["Aquariums", "Best-Aquariums.html"], ["Art Museums", "Best-Art-Museums.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'bruges': [["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'brussels': [["Cathedrals", "Best-Cathedrals.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'budapest': [["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Hot Springs", "Best-Hot-Springs.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'buenos-aires': [["Art Museums", "Best-Art-Museums.html"], ["Lakes", "Best-Lakes.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'cairo': [["Architecture", "Best-Architecture.html"], ["Castles", "Best-Castles.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Museums", "Best-Museums.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'cancun': [["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"]],
    'cannes': [["Resorts", "Best-Resorts.html"]],
    'capri': [["Caves", "Best-Caves.html"], ["Islands", "Best-Islands.html"]],
    'carmel-by-the-sea': [["Resorts", "Best-Resorts.html"]],
    'cayman-islands': [["Beaches", "Best-Beaches.html"], ["Islands", "Best-Islands.html"], ["Scuba Diving", "Best-Scuba-Diving.html"]],
    'chiang-mai': [["Resorts", "Best-Resorts.html"]],
    'chicago': [["Aquariums", "Best-Aquariums.html"], ["Art Museums", "Best-Art-Museums.html"], ["Gardens", "Best-Gardens.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"]],
    'cinque-terre': [["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'colmar': [["Wine Regions", "Best-Wine-Regions.html"]],
    'colombo': [["Resorts", "Best-Resorts.html"], ["Safari", "Best-Safari.html"]],
    'copenhagen': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Aquariums", "Best-Aquariums.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'curacao': [["Caves", "Best-Caves.html"], ["Islands", "Best-Islands.html"]],
    'cusco': [["Architecture", "Best-Architecture.html"], ["Lakes", "Best-Lakes.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Resorts", "Best-Resorts.html"]],
    'dubai': [["Aquariums", "Best-Aquariums.html"], ["Architecture", "Best-Architecture.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Resorts", "Best-Resorts.html"]],
    'dublin': [["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'dubrovnik': [["Castles", "Best-Castles.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'edinburgh': [["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Museums", "Best-Museums.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'florence': [["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'foz-do-iguaçu': [["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'geneva': [["Lakes", "Best-Lakes.html"]],
    'glacier-national-park': [["National Parks", "Best-National-Parks-by-Country.html"]],
    'gothenburg': [["Amusement Parks", "Best-Amusement-Parks.html"]],
    'hamburg': [["Unique Museums", "Best-Unique-Museums.html"]],
    'hanoi': [["Caves", "Best-Caves.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'helsinki': [["Cathedrals", "Best-Cathedrals.html"]],
    'hong-kong': [["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Observation Decks", "Best-Observation-Decks.html"]],
    'istanbul': [["Architecture", "Best-Architecture.html"], ["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Resorts", "Best-Resorts.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'kauai': [["Beaches", "Best-Beaches.html"]],
    'kotor': [["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'kraków': [["Cathedrals", "Best-Cathedrals.html"]],
    'kyoto': [["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Resorts", "Best-Resorts.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'la-jolla': [["Aquariums", "Best-Aquariums.html"], ["Architecture", "Best-Architecture.html"], ["Beaches", "Best-Beaches.html"]],
    'lake-como': [["Gardens", "Best-Gardens.html"], ["Lakes", "Best-Lakes.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Resorts", "Best-Resorts.html"]],
    'lake-tahoe': [["Lakes", "Best-Lakes.html"]],
    'las-vegas': [["Observation Decks", "Best-Observation-Decks.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'lima': [["Cathedrals", "Best-Cathedrals.html"], ["Museums", "Best-Museums.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'lisbon': [["Aquariums", "Best-Aquariums.html"], ["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Caves", "Best-Caves.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'ljubljana': [["Caves", "Best-Caves.html"], ["Lakes", "Best-Lakes.html"]],
    'london': [["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'los-angeles': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Museums", "Best-Museums.html"], ["Resorts", "Best-Resorts.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'los-cabos': [["Beaches", "Best-Beaches.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"]],
    'luang-prabang': [["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'lucerne': [["Lakes", "Best-Lakes.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Resorts", "Best-Resorts.html"]],
    'lyon': [["Cathedrals", "Best-Cathedrals.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'machupicchu': [["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'madeira': [["Islands", "Best-Islands.html"]],
    'madrid': [["Art Museums", "Best-Art-Museums.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Museums", "Best-Museums.html"]],
    'maldives': [["Beaches", "Best-Beaches.html"], ["Islands", "Best-Islands.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Resorts", "Best-Resorts.html"], ["Scuba Diving", "Best-Scuba-Diving.html"]],
    'malibu': [["Beaches", "Best-Beaches.html"]],
    'manuel-antonio': [["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"]],
    'marrakech': [["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Resorts", "Best-Resorts.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Ultra Luxurious Resorts", "Best-Ultra-Luxurious-Resorts.html"]],
    'marseille': [["Castles", "Best-Castles.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'maui': [["Beaches", "Best-Beaches.html"], ["Islands", "Best-Islands.html"], ["Resorts", "Best-Resorts.html"], ["Volcanoes", "Best-Volcanoes.html"]],
    'melbourne': [["Gardens", "Best-Gardens.html"], ["Hot Springs", "Best-Hot-Springs.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Resorts", "Best-Resorts.html"]],
    'milan': [["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"]],
    'montreal': [["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"]],
    'munich': [["Architecture", "Best-Architecture.html"], ["Museums", "Best-Museums.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'mykonos': [["Islands", "Best-Islands.html"], ["Resorts", "Best-Resorts.html"]],
    'napa': [["Wine Regions", "Best-Wine-Regions.html"]],
    'naples': [["Cathedrals", "Best-Cathedrals.html"], ["Volcanoes", "Best-Volcanoes.html"]],
    'nashville': [["Unique Museums", "Best-Unique-Museums.html"]],
    'new-orleans': [["Unique Museums", "Best-Unique-Museums.html"]],
    'new-york': [["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"]],
    'nice': [["Resorts", "Best-Resorts.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'oahu': [["Beaches", "Best-Beaches.html"], ["Islands", "Best-Islands.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"]],
    'orlando': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'osaka': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Aquariums", "Best-Aquariums.html"], ["Castles", "Best-Castles.html"], ["Observation Decks", "Best-Observation-Decks.html"]],
    'oslo': [["Architecture", "Best-Architecture.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'palawan': [["Caves", "Best-Caves.html"], ["Islands", "Best-Islands.html"], ["Scuba Diving", "Best-Scuba-Diving.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'palo-alto': [["Unique Museums", "Best-Unique-Museums.html"]],
    'paris': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'pasadena': [["Gardens", "Best-Gardens.html"]],
    'pensacola': [["Unique Museums", "Best-Unique-Museums.html"]],
    'petra': [["Architecture", "Best-Architecture.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'philadelphia': [["Art Museums", "Best-Art-Museums.html"], ["Gardens", "Best-Gardens.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'phoenix': [["Unique Museums", "Best-Unique-Museums.html"]],
    'phuket': [["Islands", "Best-Islands.html"], ["Resorts", "Best-Resorts.html"], ["Scuba Diving", "Best-Scuba-Diving.html"]],
    'pisa': [["Cathedrals", "Best-Cathedrals.html"]],
    'portland': [["Gardens", "Best-Gardens.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'porto': [["Cathedrals", "Best-Cathedrals.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'prague': [["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'puerto-rico': [["Beaches", "Best-Beaches.html"], ["Castles", "Best-Castles.html"], ["Islands", "Best-Islands.html"]],
    'puerto-vallarta': [["Beaches", "Best-Beaches.html"]],
    'quebec-city': [["Castles", "Best-Castles.html"]],
    'queenstown': [["Lakes", "Best-Lakes.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Resorts", "Best-Resorts.html"], ["Ski Resorts", "Best-Ski-Resorts.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'reykjavik': [["Cathedrals", "Best-Cathedrals.html"], ["Caves", "Best-Caves.html"], ["Hot Springs", "Best-Hot-Springs.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Lakes", "Best-Lakes.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Resorts", "Best-Resorts.html"], ["Scuba Diving", "Best-Scuba-Diving.html"], ["Unique Museums", "Best-Unique-Museums.html"], ["Volcanoes", "Best-Volcanoes.html"]],
    'rio-de-janeiro': [["Beaches", "Best-Beaches.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'rome': [["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["UNESCO Sites", "Best-UNESCO-Sites.html"], ["Wonders of the World", "Best-Wonders-of-the-World.html"]],
    'salzburg': [["Castles", "Best-Castles.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Caves", "Best-Caves.html"]],
    'san-diego': [["Beaches", "Best-Beaches.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'san-francisco': [["Kids' Museums", "Best-Kids-Museums.html"], ["Museums", "Best-Museums.html"], ["Unique Museums", "Best-Unique-Museums.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'san-jose-costa-rica': [["Volcanoes", "Best-Volcanoes.html"]],
    'san-sebastian': [["Wine Regions", "Best-Wine-Regions.html"]],
    'santiago': [["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Resorts", "Best-Resorts.html"]],
    'santorini': [["Islands", "Best-Islands.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Resorts", "Best-Resorts.html"]],
    'sarasota': [["Beaches", "Best-Beaches.html"]],
    'sardinia': [["Islands", "Best-Islands.html"]],
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
    'split': [["Cathedrals", "Best-Cathedrals.html"], ["Lakes", "Best-Lakes.html"]],
    'stockholm': [["Castles", "Best-Castles.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'strasbourg': [["Cathedrals", "Best-Cathedrals.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'stuttgart': [["Unique Museums", "Best-Unique-Museums.html"]],
    'sydney': [["Aquariums", "Best-Aquariums.html"], ["Architecture", "Best-Architecture.html"], ["Beaches", "Best-Beaches.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Caves", "Best-Caves.html"], ["Gardens", "Best-Gardens.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Resorts", "Best-Resorts.html"]],
    's\xE3o-paulo': [["Art Museums", "Best-Art-Museums.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Observation Decks", "Best-Observation-Decks.html"]],
    'taipei': [["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Hot Springs", "Best-Hot-Springs.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"]],
    'tokyo': [["Amusement Parks", "Best-Amusement-Parks.html"], ["Architecture", "Best-Architecture.html"], ["Art Museums", "Best-Art-Museums.html"], ["Cathedrals", "Best-Cathedrals.html"], ["Gardens", "Best-Gardens.html"], ["Hot Springs", "Best-Hot-Springs.html"], ["Kid-Friendly Destinations", "Best-Kids-Friendly-Places.html"], ["Kids' Museums", "Best-Kids-Museums.html"], ["Lakes", "Best-Lakes.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"], ["Museums", "Best-Museums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Resorts", "Best-Resorts.html"], ["Unique Museums", "Best-Unique-Museums.html"], ["Volcanoes", "Best-Volcanoes.html"]],
    'toledo': [["Cathedrals", "Best-Cathedrals.html"]],
    'toronto': [["Aquariums", "Best-Aquariums.html"], ["Observation Decks", "Best-Observation-Decks.html"], ["Unique Museums", "Best-Unique-Museums.html"]],
    'turin': [["Cathedrals", "Best-Cathedrals.html"], ["Museums", "Best-Museums.html"], ["Wine Regions", "Best-Wine-Regions.html"]],
    'turks-and-caicos': [["Resorts", "Best-Resorts.html"]],
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
    'zhangjiajie': [["Mountains & Rock Formations", "Best-Mountains-and-Rock-Formations.html"]],
    'zurich': [["Lakes", "Best-Lakes.html"], ["Luxurious Hotels", "Best-Most-Luxurious-Hotels.html"], ["Resorts", "Best-Resorts.html"], ["Unique Museums", "Best-Unique-Museums.html"]]
  };

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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectBestOfCrossLinks);
  } else {
    _injectBestOfCrossLinks();
  }

  /* ── "Also in [Country]" section — injected after #nearby-guides on
     guide pages that share a country with ≥1 other fleet guide. Fetches
     assets/country_guides.json (built by Brain/scripts/build_country_guides.py
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
        a.textContent = '🗺️ ' + g.city;
        pills.appendChild(a);
      });
      wrap.appendChild(h);
      wrap.appendChild(pills);
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
      /* Move the "Updated" stamp after the last footer section.
         Prefer Best Of (#tve-best-of-crosslinks) if present — it is always last. */
      var stamp = document.querySelector('.title-updated');
      if (stamp && stamp.parentNode) {
        var _bestOf = document.getElementById('tve-best-of-crosslinks');
        var _anchor = (_bestOf && _bestOf.parentNode) ? _bestOf : wrap;
        _anchor.parentNode.insertBefore(stamp, _anchor.nextSibling);
      }
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
        'background:#e8f3fc;border:1px solid #c2d8ef;border-radius:6px;' +
        'padding:' + (isMobile ? '4px 6px' : '6px 10px') + ';margin-bottom:' + (isMobile ? '0' : '16px') + ';font-family:inherit;box-sizing:border-box;' +
        'overflow:hidden;cursor:pointer;transition:background .15s;';
      strip.addEventListener('mouseenter', function () { strip.style.background = '#dcedf8'; });
      strip.addEventListener('mouseleave', function () { strip.style.background = '#e8f3fc'; });

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
          'display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;gap:1px;';

        var dayDiv = document.createElement('div');
        dayDiv.style.cssText =
          'font-size:9px;font-weight:700;color:#6b6860;letter-spacing:0.03em;line-height:1.2;';
        dayDiv.textContent = i === 0 ? 'Today' : DAY[dt.getDay()];

        var iconDiv = document.createElement('div');
        iconDiv.style.cssText = 'font-size:15px;line-height:1.3;';
        iconDiv.textContent = WMO[daily.weathercode[i]] || '🌡️';

        var tempDiv = document.createElement('div');
        tempDiv.style.cssText =
          'font-size:9px;color:#3d3a32;white-space:nowrap;line-height:1.2;';
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
          'border-right:1px solid #c2d8ef;flex-shrink:0;gap:1px;';

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

        strip.insertBefore(nowBlock, grid);
      }

      strip.appendChild(grid);

      /* °C/°F toggle */
      var toggle = document.createElement('div');
      toggle.style.cssText =
        'display:inline-flex;border:1px solid #c2d8ef;border-radius:5px;overflow:hidden;' +
        'flex-shrink:0;margin-left:8px;';
      ['C','F'].forEach(function (t) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '°' + t;
        btn.style.cssText =
          'border:none;cursor:pointer;padding:3px 7px;font-size:10px;font-weight:600;' +
          'background:' + (u === t ? '#5b8db8' : 'transparent') + ';' +
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
      /* On mobile: close the gap above and below the strip */
      if (window.innerWidth <= 600) {
        titlePage.style.marginBottom = '0';
        var afterStrip = strip.nextElementSibling;
        if (afterStrip) afterStrip.style.marginTop = '0';
      }
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
     Back-to-index pill is guide-only and injected separately below. */
  function _injectScrollFab() {
    if (document.documentElement.scrollHeight <= window.innerHeight * 1.5) return;

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

    window.addEventListener('scroll', function () {
      if (window.scrollY > 300) {
        topBtn.classList.add('visible');
      } else {
        topBtn.classList.remove('visible');
      }
    }, { passive: true });

  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectScrollFab);
  } else {
    _injectScrollFab();
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
      'color:#a8a09a;padding:0 0 0 6px;line-height:1;vertical-align:middle;' +
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
      document.querySelectorAll('.extras-section, .claude-inspiration, #hotel-alternatives').forEach(function (sec) {
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
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _setup);
    } else {
      _setup();
    }
  }());

}());
