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
      if (el) { el.parentNode.removeChild(el); document.body.style.opacity = '1'; }
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
    link.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap';
    head.appendChild(link);
  } catch (e) {}
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
    meta('apple-mobile-web-app-title', 'Travel');
    if ('serviceWorker' in navigator &&
        (location.protocol === 'https:' || location.hostname === 'localhost')) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register(b + 'sw.js', { scope: b || './' })['catch'](function () {});
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
  var curr     = location.pathname.split('/').pop() || '';
  var prevHref = mount ? (mount.dataset.prev || '') : '';
  var nextHref = mount ? (mount.dataset.next || '') : '';

  /* ── Links ─────────────────────────────────────────────────────────────── */
  var ITEMS = [
    { href: base + 'Guides-Index.html', text: '🌐 Guides', full: '🌐 Travel Guides' },
    null,
    { href: base + 'Trip-Essentials/Travel-Packing.html', text: '👕 Packing', full: '👕 Packing Checklist' },
    null,
    { href: base + 'Trip-Essentials/Before-You-Go.html', text: '🧳 Before You Go' },
    null,
    { href: base + 'Trip-Essentials/Maps/World-Map.html', text: '🗺️ Maps', full: '🗺️ World Map' },
    null,
    { group: '📊 Stats', children: [
        { href: base + 'Trip-Essentials/Travel-Stats.html',               text: '📊 Travel Stats' },
        { href: base + 'Trip-Essentials/Stats-Across-US.html',            text: '📊 Stats Across US' },
        { href: base + 'Trip-Essentials/Stats-Across-Canada.html',        text: '📊 Stats Across Canada' },
        { href: base + 'Trip-Essentials/Europe-Stats.html',               text: '📊 Stats Across Europe' },
        { href: base + 'Trip-Essentials/Asia-Stats.html',                 text: '📊 Stats Across Asia' },
        { href: base + 'Trip-Essentials/South-America-Stats.html',        text: '📊 Stats Across South America' },
        { href: base + 'Trip-Essentials/Caribbean-Stats.html',            text: '📊 Stats Across the Caribbean' },
        { href: base + 'Trip-Essentials/Guide-Days-Coverage.html',        text: '📊 Guide Days Coverage' },
        { href: base + 'Trip-Essentials/Destination-Records.html',        text: '📊 Destination Records' },
      ]},
    null,
    { group: '💻 Lounges', children: [
        { href: base + 'Trip-Essentials/Lounges-US.html',     text: '💻 US Lounges' },
        { href: base + 'Trip-Essentials/Lounges-Europe.html', text: '💻 EU Lounges' },
      ] },
    null,
    { href: base + 'Trip-Essentials/European-Train-Guide.html', text: '🚆 Trains', full: '🚆 European Train Guide' },
    null,
    { group: '✈️ Flights', children: [
        { href: base + 'Trip-Essentials/Delta-Routes-SEA.html',  text: '✈️ Delta Seattle Hub' },
        { href: base + 'Trip-Essentials/Delta-Routes-Full.html', text: '✈️ Delta Full Network' },
        { href: base + 'Trip-Essentials/Baggage.html',           text: '🛄 Baggage' },
        { href: base + 'Trip-Essentials/Trusted-Traveler.html',  text: '🛂 Global Entry & CLEAR' },
        { href: base + 'Trip-Essentials/Passport.html',          text: '📘 Passport' },
      ] },
    null,
    { href: base + 'Trip-Essentials/Plug-Adapter/Plug-Adapter-Guide.html', text: '🔌 Plug Adapters', full: '🔌 Plug Adapters' },
    null,
    { href: base + 'Trip-Essentials/Currency-Guide.html', text: '💰 Currency', full: '💰 Currency' },
    null,
    { href: base + 'Trip-Essentials/Time-Zones.html',                           text: '🕐 Time Zones' },
    null,
    { group: '🌤️ Weather', children: [
        { href: base + 'Trip-Essentials/Climate-Finder.html', text: '🌤️ Browse by Climate' },
        { href: base + 'Trip-Essentials/Weather.html',          text: '🌤️ Browse by City' },
        { href: base + 'Trip-Essentials/When-to-Go.html',       text: '🌤️ When to Go' },
      ] },
    null,
    { href: base + 'Trip-Essentials/Festival-Finder.html', text: '🎉 Festivals' },
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
    '.tb{padding:10px 0;position:relative;top:auto;z-index:auto;margin-bottom:18px;' +
      'background:linear-gradient(135deg,#7a3b1e 0%,#b85c2a 55%,#d4874a 100%);' +
      'border-bottom:none;box-shadow:none;' +
      'display:flex;align-items:center}' +
    /* Site title — desktop only */
    '.tb-scroll-wrap{display:none!important}' +
    '.tb-site-title,.tb a.tb-site-title,.tb a.tb-site-title:visited,.tb a.tb-site-title:hover{flex-shrink:0;font-size:13px;font-weight:700;color:#fff!important;' +
      'letter-spacing:.08em;text-transform:uppercase;padding:5px 14px;white-space:nowrap;margin-left:32px;background:transparent!important;text-decoration:none!important}' +
    /* Scroll container — takes remaining space */
    '.tb-inner{overflow-x:auto;scrollbar-width:none;flex:1}' +
    '.tb-inner::-webkit-scrollbar{display:none}' +
    /* Flex row — centered, width:max-content so it never left-packs */
    '.tb-links{display:flex;flex-wrap:nowrap;' +
      'gap:1px;align-items:center;justify-content:center}' +
    /* Desktop nav links — white text on gradient bar.
       Colours use !important so a page's own `a{}` / `a:visited{}` rules
       (e.g. guide-style.css link colours) can NEVER bleed into the shared bar. */
    '.tb a,.tb a:visited{font-size:13px;color:rgba(255,255,255,0.9)!important;text-decoration:none;padding:4px 8px;' +
      'border:none;border-radius:4px;background:transparent;white-space:nowrap;flex-shrink:0;' +
      'transition:color .15s,background .15s}' +
    '.tb a:hover{color:#fff!important;background:rgba(255,255,255,0.18)}' +
    '.tb a.tb-active{color:#7a3b1e!important;background:rgba(255,255,255,0.92);font-weight:600}' +
    /* Dropdown group (e.g. 🚆 Trains) — parent button + absolute flyout menu */
    '.tb-dd{position:relative;display:inline-flex;flex-shrink:0}' +
    '.tb-ddbtn{display:inline-flex;align-items:center;gap:3px;font-size:13px;color:rgba(255,255,255,0.9)!important;' +
      'padding:4px 8px;border:none;border-radius:4px;background:transparent;white-space:nowrap;' +
      'cursor:pointer;font-family:inherit;transition:color .15s,background .15s}' +
    '.tb-ddbtn:hover{color:#fff!important;background:rgba(255,255,255,0.18)}' +
    '.tb-ddbtn.tb-active{color:#7a3b1e!important;background:rgba(255,255,255,0.92);font-weight:600}' +
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
    '.tb-menu a,.tb-menu a:visited{display:block;font-size:13px;line-height:1.2;color:#3d3a32!important;text-decoration:none;padding:6px 11px;' +
      'border:none;border-radius:6px;background:transparent;white-space:nowrap}' +
    '.tb-menu a:hover{background:' + acLt + ';color:' + accent + '!important}' +
    '.tb-menu a.tb-active{background:' + acMd + ';color:' + accent + '!important;font-weight:500}' +
    /* Separator */
    '.tb-sep{width:1px;height:18px;background:rgba(255,255,255,0.3);margin:0;flex-shrink:0}' +
    /* Scroll progress bar — hidden on mobile (overlaps toolbar) */
    '.tb-progress{position:fixed;top:0;left:0;height:2px;width:0%;' +
      'background:' + accent + ';z-index:200;pointer-events:none;' +
      'transition:width .08s linear}' +
    '@media(max-width:600px){.tb-progress{display:none}}' +
    /* Hide ham elements on desktop — mobile @media shows them */
    '.tb-ham{display:none}.tb-ham-label{display:none}.tb-ham-menu{display:none}' +
    /* Hide desktop title on mobile — hamLabel covers it there */
    '.tb-site-title{display:block}' +
    /* Mobile: hamburger menu replaces the chip row */
    '@media(max-width:600px){' +
      '.tb-site-title{display:none}' +
      '.tb{padding:15px 0 14px;display:flex;align-items:center;justify-content:space-between;min-height:56px;border-bottom:none;background:linear-gradient(135deg,#7a3b1e 0%,#b85c2a 55%,#d4874a 100%);box-shadow:none}' +
      '.tb-inner{display:none !important}' +
      '.tb-scroll-wrap{display:none !important}' +
      '.tb::after{display:none}' +
      '.tb-ham{display:flex;align-items:center;gap:3px;cursor:pointer;background:none;' +
        'border:none;-webkit-appearance:none;appearance:none;box-shadow:none;outline:none;' +
        '-webkit-tap-highlight-color:transparent;' +
        'padding:10px 14px 10px 8px;font-size:13px;color:#fff;flex-shrink:0;margin-left:auto;line-height:1;min-height:44px}' +
      '.tb-ham:hover,.tb-ham:focus,.tb-ham:active{background:none !important;box-shadow:none !important;outline:none !important}' +
      /* min-height:0 overrides mobile.css's universal 40px tap-target `a{}` rule — this
         became an <a> (was a <span>) when it was wired to link to Trips.html, and the
         inflated block-level box pushed the text off the bar's vertical center. */
      '.tb-ham-label{display:block;min-height:0!important;font-size:15px;font-weight:700;color:#fff;padding-left:14px;letter-spacing:.06em;text-transform:uppercase}' +
      '.tb-ham-menu{display:none;position:absolute;top:100%;left:0;right:0;' +
        'background:#ffffff;border-top:1px solid #e6e2da;border-bottom:2px solid #c8c4bc;' +
        'box-shadow:0 8px 24px rgba(0,0,0,.18);z-index:999;padding:4px 0 8px;' +
        'max-height:calc(100dvh - 52px);overflow-y:auto;-webkit-overflow-scrolling:touch}' +
      '.tb-ham-menu.tb-ham-open{display:block}' +
      '.tb-ham-menu a,.tb-ham-menu a:visited{display:block;font-size:14px;color:#3d3a32!important;text-decoration:none;' +
        'padding:10px 18px;border-bottom:none;-webkit-tap-highlight-color:transparent}' +
      '.tb-ham-menu a.tb-active{color:' + accent + '!important;font-weight:600}' +
      '.tb-ham-menu a:active{background:rgba(0,0,0,.04)}' +
      '.tb-ham-menu .tb-ham-sep{height:1px;background:#e6e2da;margin:4px 18px}' +
      '.tb-ham-menu .tb-ham-hdr{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9e9688;padding:6px 18px 2px}' +
    '}'
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
  siteTitle.href = base + 'Trip-Essentials/Trips.html';
  siteTitle.style.textDecoration = 'none';
  bar.appendChild(siteTitle);

  bar.appendChild(scroller);


  /* ── Prev / Next sticky nav-bar — sits just below toolbar, sticks to top ── */
  var isRealGuide = /\/Guides\//.test(location.pathname) && location.pathname.indexOf('guides_index') < 0;

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
  hamLabel.href = base + 'Trip-Essentials/Trips.html';
  hamLabel.style.cssText = 'text-decoration:none;color:#fff;';
  bar.appendChild(hamLabel);

  var hamBtn = document.createElement('div');
  hamBtn.className = 'tb-ham';
  hamBtn.setAttribute('role', 'button');
  hamBtn.setAttribute('aria-label', 'Menu');
  hamBtn.setAttribute('aria-expanded', 'false');
  hamBtn.setAttribute('tabindex', '0');
  hamBtn.style.cssText = 'background:none;border:none;box-shadow:none;outline:none;-webkit-tap-highlight-color:transparent;padding:4px 14px 4px 8px;margin:0;min-height:auto;cursor:pointer;user-select:none;';
  hamBtn.innerHTML = '☰ <span style="font-size:14px;letter-spacing:.04em;font-weight:600">MENU</span>';
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
      item.children.forEach(function (ch) {
        var a = document.createElement('a');
        a.href = ch.href;
        a.textContent = ch.full || ch.text;
        if (ch.href.split('/').pop() === curr) a.className = 'tb-active';
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
      if (item.href.split('/').pop() === curr) a2.className = 'tb-active';
      hamMenu.appendChild(a2);
      firstItem = false;
    }
  });
  bar.appendChild(hamMenu);

  function toggleHamMenu(e) {
    e.stopPropagation();
    hamMenu.classList.toggle('tb-ham-open');
    var open = hamMenu.classList.contains('tb-ham-open');
    hamBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    hamBtn.innerHTML = (open ? '✕' : '☰') + ' <span style="font-size:13px;letter-spacing:.04em;font-weight:600">' + (open ? 'CLOSE' : 'MENU') + '</span>';
  }
  hamBtn.addEventListener('click', toggleHamMenu);
  hamBtn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHamMenu(e); }
  });
  document.addEventListener('click', function () {
    hamMenu.classList.remove('tb-ham-open');
    hamBtn.innerHTML = '☰ <span style="font-size:14px;letter-spacing:.04em;font-weight:600">MENU</span>';
  });
  hamMenu.addEventListener('click', function (e) { e.stopPropagation(); });

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

  /* ── Arrows inside .overview-title: [‹] · title · [›] — real guides only ─── */
  /* Deferred to DOMContentLoaded: script runs at the top of <body>, before
     .overview-title exists in the DOM. querySelector would return null if run
     synchronously here.                                                       */
  if (isRealGuide && (prevHref || nextHref)) {
    function injectOverviewArrows() {
      var overviewTitle = document.querySelector('.overview-title');
      if (!overviewTitle) return;

      /* Wrap existing title text in a centred span */
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
    /* On mobile, move the "Updated {Month}" stamp out of the top hotel banner to
       the bottom-right of the "Also on this site" card. Desktop keeps it up top. */
    function repositionUpdatedStamp() {
      if (!(window.matchMedia && window.matchMedia('(max-width: 600px)').matches)) return;
      var upd = document.querySelector('.title-page .title-updated') || document.querySelector('.title-updated');
      var also = document.getElementById('also-on-this-site');
      if (upd && also) also.appendChild(upd);
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
      header.parentNode.insertBefore(row, header.nextSibling);
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

  /* ── Last-updated stamp — guide pages only ────────────────────────────────
     Renders "Updated Month Year" as a small muted line at the TOP of the
     guide, tucked under the title block (right-aligned, last row of
     .title-page). Source: the EXPLICIT data-updated="YYYY-MM" attribute on
     the toolbar-mount div — NOT document.lastModified. This is deliberate:
     lastModified bumps on every file touch (bug fix, validation re-stamp,
     GitHub Pages deploy → all guides read the deploy month), which is the
     opposite of "content currency". data-updated only moves when a crib
     bumps it on a genuine content refresh, so cosmetic/bug-fix edits and
     format changes leave it untouched. No attribute → no stamp (silent).
     Spec: Brain/Reference/Toolbar.html § 10. */
  var _updated = mount ? (mount.dataset.updated || '') : '';
  if (_updated) {
    var _MONTHS = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];
    function _injectUpdated() {
      var m = /^(\d{4})-(\d{2})$/.exec(_updated);
      if (!m) return;
      var yr = parseInt(m[1], 10), mo = parseInt(m[2], 10);
      if (yr <= 2000 || mo < 1 || mo > 12) return;
      var el = document.createElement('div');
      el.className = 'title-updated';
      el.textContent = 'Updated ' + _MONTHS[mo - 1] + ' ' + yr;
      var tp = document.querySelector('.title-page');
      if (!tp) return;
      tp.appendChild(el);

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
      [].forEach.call(block.querySelectorAll('.stop-name'), function (s) {
        var t = s.textContent.trim(); if (t) stops.push(t);
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
      'background:#fff;border-radius:12px;padding:26px 26px 20px;' +
      'max-width:320px;width:90vw;box-shadow:0 12px 40px rgba(0,0,0,.22);' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

    var bTitle = document.createElement('div');
    bTitle.textContent = '📅 Export to Calendar';
    bTitle.style.cssText = 'font-size:15px;font-weight:700;color:#1b2531;margin-bottom:5px;';

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
      'font-size:15px;font-family:inherit;box-sizing:border-box;margin-bottom:18px;' +
      'color:#1b2531;background:#fff;';

    var bRow = document.createElement('div');
    bRow.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button'; cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText =
      'padding:8px 14px;border:1.5px solid #ccc;border-radius:6px;' +
      'background:#fff;font-size:13px;color:#5b636f;cursor:pointer;font-family:inherit;font-weight:500;';

    var dlBtn = document.createElement('button');
    dlBtn.type = 'button'; dlBtn.textContent = '↓ Download .ics';
    dlBtn.style.cssText =
      'padding:8px 16px;border:none;border-radius:6px;' +
      'background:linear-gradient(135deg,#7a3b1e 0%,#b85c2a 55%,#d4874a 100%);' +
      'font-size:13px;font-weight:700;color:#fff;cursor:pointer;font-family:inherit;';

    function _closeICS() { overlay.style.display = 'none'; }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) _closeICS(); });
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
        var desc = day.stops.length ? _esc(day.stops.join('\n')) : '';
        out.push('BEGIN:VEVENT');
        out.push('UID:' + _ts + '-day' + day.num + '@voyager-expert');
        out.push('DTSTART;VALUE=DATE:' + _fmtDate(d0));
        out.push('DTEND;VALUE=DATE:' + _fmtDate(d1));
        out.push('SUMMARY:' + summary);
        if (desc) out.push('DESCRIPTION:' + desc);
        out.push('END:VEVENT');
      });
      out.push('END:VCALENDAR');

      var blob = new Blob([out.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = city.toLowerCase().replace(/\s+/g, '-') + '-trip.ics';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 1500);
      _closeICS();
    });

    bRow.appendChild(cancelBtn); bRow.appendChild(dlBtn);
    box.appendChild(bTitle); box.appendChild(bSub);
    box.appendChild(dateInput); box.appendChild(bRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    /* ── Trigger button ──────────────────────────────────────────────────── */
    var trigBtn = document.createElement('button');
    trigBtn.type = 'button';
    trigBtn.textContent = '📅 Export to Calendar';
    trigBtn.style.cssText =
      'display:block;margin:10px 0 0;padding:7px 14px;' +
      'background:#ffffff;border:1.5px solid #c8a44a;border-radius:6px;' +
      'font-size:12.5px;font-weight:600;color:#7a5c00;' +
      'cursor:pointer;font-family:inherit;white-space:nowrap;' +
      'transition:background .15s,border-color .15s;';
    trigBtn.addEventListener('mouseenter', function () { trigBtn.style.background = 'rgba(200,164,74,.08)'; });
    trigBtn.addEventListener('mouseleave', function () { trigBtn.style.background = '#ffffff'; });
    trigBtn.addEventListener('click', function () { overlay.style.display = 'flex'; });

    /* Insert between last .overview-day pill and .overview-extras row */
    var lastDay = overviewDays[overviewDays.length - 1];
    var extras = lastDay.parentNode.querySelector('.overview-extras');
    if (extras) lastDay.parentNode.insertBefore(trigBtn, extras);
    else lastDay.parentNode.appendChild(trigBtn);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _injectICSExport);
  } else {
    _injectICSExport();
  }

  /* ── Weather widget — loaded on the Guides index ONLY ─────────────────────
     weather.js lives in assets/ (permanent home). On the index it adds the
     🌡 Weather control in the title banner (city picker + monthly high/low
     panel) and per-guide hover weather on the cards. Deliberately NOT loaded
     on individual guide pages. Bump the ?v= below whenever weather.js changes
     so the browser refreshes it (it has no version tag on the page itself). */
  if (curr === 'Guides-Index.html') {
    var _wx = document.createElement('script');
    _wx.src = base + 'assets/weather.js?v=4';
    document.head.appendChild(_wx);
  }
}());
