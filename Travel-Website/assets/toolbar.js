/**
 * toolbar.js — shared travel navigation bar
 *
 * ⚠️ HOME: Travel Website/assets/toolbar.js — site-wide shared asset.
 * The shared scripts/styles (toolbar.js, footnote.js, weather.js,
 * guide_v3.css, mobile.css, climate.json) all live in assets/. Every page
 * loads them from assets/ at its own relative depth below the site root:
 *   · index.html (depth 0):                       src="assets/toolbar.js"
 *   · depth-1 pages (Guides/Guides-Index.html,
 *     Trip-Essentials/*.html):                    src="../assets/toolbar.js"
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
  var noFootnote = mount ? !!mount.dataset.noFootnote : false;  // read BEFORE mount is removed
  var curr     = location.pathname.split('/').pop() || '';
  var prevHref = mount ? (mount.dataset.prev || '') : '';
  var nextHref = mount ? (mount.dataset.next || '') : '';

  /* ── Links ─────────────────────────────────────────────────────────────── */
  var ITEMS = [
    { group: '📆 Trips', children: [
        { href: base + 'Trip-Essentials/Trips.html',          text: '📆 Trips' },
        { href: base + 'Trip-Essentials/Travel-Packing.html', text: '👕 Packing' },
      ] },
    null,
    { group: '🌐 Guides', children: [
        { href: base + 'Guides/Guides-Index.html',                text: '🌐 Guides' },
        { href: base + 'Trip-Essentials/Maps/Europe-Map.html', text: '🗺️ Maps' },
        { href: base + 'Trip-Essentials/Travel-Stats.html',   text: '📊 Travel Stats' },
      ] },
    null,
    { group: '💻 Lounges', children: [
        { href: base + 'Trip-Essentials/Lounges-US.html',     text: '💻 US Lounges' },
        { href: base + 'Trip-Essentials/Lounges-Europe.html', text: '💻 EU Lounges' },
      ] },
    null,
    { href: base + 'Trip-Essentials/European-Train-Guide.html',               text: '🚆 Trains' },
    null,
    { group: '✈️ Flights', children: [
        { href: base + 'Trip-Essentials/Delta-Routes-SEA.html',  text: '✈️ Delta Seattle Hub' },
        { href: base + 'Trip-Essentials/Delta-Routes-Full.html', text: '✈️ Delta Full Network' },
      ] },
    null,
    { href: base + 'Trip-Essentials/Plug-Adapter/Plug-Adapter-Guide.html',  text: '🔌 Plugs' },
    null,
    { href: base + 'Trip-Essentials/Currency-Guide.html',                       text: '💰 Currency' },
    null,
    { href: base + 'Trip-Essentials/Time-Zones.html',                           text: '🕐 Time Zones' },
    null,
    { group: '🌤️ Weather', children: [
        { href: base + 'Trip-Essentials/Climate-Finder.html', text: '🌤️ Browse by Climate' },
        { href: base + 'Trip-Essentials/Weather.html',          text: '🌤️ Browse by City' },
      ] },
    null,
    { href: base + 'Trip-Essentials/Safety-Guide.html',                         text: '🛡️ Safety' },
    null,
    { href: base + 'Trip-Essentials/Visas.html',                                  text: '🪪 Visas' },
    null,
    { href: base + 'Trip-Essentials/Resources.html',                              text: '⚙️ Resources' },
  ];

  /* ── Styles ─────────────────────────────────────────────────────────────── */
  var pageBg  = window.getComputedStyle(document.body).backgroundColor;
  // isGuide: only fires when data-toolbar-theme="guide" is explicitly set (guides_index).
  // Guide pages now share the #f5f4f0 warm background with essentials — colour detection
  // retired 2026-05-31 when the guide palette was reskinned to match essentials.
  var isGuide = (mount && mount.dataset.toolbarTheme === 'guide');
  var accent  = isGuide ? '#6b6860'               : '#8a6c1a';
  var acLt    = isGuide ? 'rgba(107,104,96,.06)'  : 'rgba(138,108,26,.06)';
  var acMd    = isGuide ? 'rgba(107,104,96,.10)'  : 'rgba(138,108,26,.10)';

  var styleEl = document.createElement('style');
  styleEl.textContent =
    /* Toolbar outer — static, sits at top of page */
    '.tb{padding:10px 0;position:relative;top:auto;z-index:auto;margin-bottom:0;' +
      'background:rgba(245,244,240,.96);' +
      'border-bottom:none;box-shadow:none}' +
    /* Scroll container */
    '.tb-inner{overflow-x:auto;scrollbar-width:none}' +
    '.tb-inner::-webkit-scrollbar{display:none}' +
    /* Flex row — centered, width:max-content so it never left-packs */
    '.tb-links{display:flex;flex-wrap:nowrap;' +
      'gap:1px;align-items:center;padding:0 24px;' +
      'width:-webkit-max-content;width:max-content;margin:0 auto}' +
    /* Desktop nav links — no rectangle border, just subtle background */
    '.tb a{font-size:11.5px;color:#3d3a32;text-decoration:none;padding:4px 8px;' +
      'border:none;border-radius:4px;background:transparent;white-space:nowrap;flex-shrink:0;' +
      'transition:color .15s,background .15s}' +
    '.tb a:hover{color:' + accent + ';background:' + acLt + '}' +
    '.tb a.tb-active{color:' + accent + ';background:' + acMd + ';font-weight:500}' +
    /* Dropdown group (e.g. 🚆 Trains) — parent button + absolute flyout menu */
    '.tb-dd{position:relative;display:inline-flex;flex-shrink:0}' +
    '.tb-ddbtn{display:inline-flex;align-items:center;gap:3px;font-size:11.5px;color:#3d3a32;' +
      'padding:4px 8px;border:none;border-radius:4px;background:transparent;white-space:nowrap;' +
      'cursor:pointer;font-family:inherit;transition:color .15s,background .15s}' +
    '.tb-ddbtn:hover{color:' + accent + ';background:' + acLt + '}' +
    '.tb-dd.tb-open>.tb-ddbtn,.tb-ddbtn.tb-active{color:' + accent + ';background:' + acMd + ';font-weight:500}' +
    '.tb-caret{font-size:8px;line-height:1;transition:transform .15s}' +
    '.tb-dd.tb-open .tb-caret{transform:rotate(180deg)}' +
    /* Split dropdown — one-click link + small caret toggle */
    /* Menu is appended to <body> (not inside the overflow-clipped scroll row) and
       positioned with fixed coords on open — otherwise .tb-inner's overflow-x:auto
       forces overflow-y to clip and the flyout gets cut off. */
    '.tb-menu{position:fixed;transform:translateX(-50%);' +
      'background:#fff;border:1px solid #e6e2da;border-radius:8px;box-shadow:0 6px 22px rgba(0,0,0,.13);' +
      'padding:5px;display:none;flex-direction:column;gap:2px;min-width:196px;z-index:1000}' +
    '.tb-menu.tb-menu-open{display:flex}' +
    '.tb-menu a{display:block;font-size:12px;color:#3d3a32;text-decoration:none;padding:7px 11px;' +
      'border:none;border-radius:6px;background:transparent;white-space:nowrap}' +
    '.tb-menu a:hover{background:' + acLt + ';color:' + accent + '}' +
    '.tb-menu a.tb-active{background:' + acMd + ';color:' + accent + ';font-weight:500}' +
    /* Separator */
    '.tb-sep{width:1px;height:18px;background:#d8d5ce;margin:0;flex-shrink:0}' +
    /* Scroll progress bar — hidden on mobile (overlaps toolbar) */
    '.tb-progress{position:fixed;top:0;left:0;height:2px;width:0%;' +
      'background:' + accent + ';z-index:200;pointer-events:none;' +
      'transition:width .08s linear}' +
    '@media(max-width:600px){.tb-progress{display:none}}' +
    /* Hide ham elements on desktop — mobile @media shows them */
    '.tb-ham{display:none}.tb-ham-label{display:none}.tb-ham-menu{display:none}' +
    /* Mobile: hamburger menu replaces the chip row */
    '@media(max-width:600px){' +
      '.tb{padding:6px 0 4px;display:flex;align-items:center;justify-content:space-between;min-height:auto;border-bottom:none;background:transparent;box-shadow:none}' +
      '.tb-inner{display:none !important}' +
      '.tb-scroll-wrap{display:none !important}' +
      '.tb::after{display:none}' +
      '.tb-ham{display:flex;align-items:center;gap:3px;cursor:pointer;background:none;' +
        'border:none;-webkit-appearance:none;appearance:none;box-shadow:none;outline:none;' +
        '-webkit-tap-highlight-color:transparent;' +
        'padding:4px 14px 4px 8px;font-size:13px;color:#3d3a32;flex-shrink:0;margin-left:auto;line-height:1;min-height:auto}' +
      '.tb-ham:hover,.tb-ham:focus,.tb-ham:active{background:none !important;box-shadow:none !important;outline:none !important}' +
      '.tb-ham-label{display:block;font-size:13px;font-weight:600;color:#3d3a32;padding-left:14px;letter-spacing:.02em}' +
      '.tb-ham-menu{display:none;position:absolute;top:100%;left:0;right:0;' +
        'background:#ffffff;border-top:1px solid #e6e2da;border-bottom:2px solid #c8c4bc;' +
        'box-shadow:0 8px 24px rgba(0,0,0,.18);z-index:999;padding:4px 0 8px;' +
        'max-height:calc(100dvh - 52px);overflow-y:auto;-webkit-overflow-scrolling:touch}' +
      '.tb-ham-menu.tb-ham-open{display:block}' +
      '.tb-ham-menu a{display:block;font-size:14px;color:#3d3a32;text-decoration:none;' +
        'padding:10px 18px;border-bottom:none;-webkit-tap-highlight-color:transparent}' +
      '.tb-ham-menu a.tb-active{color:' + accent + ';font-weight:600}' +
      '.tb-ham-menu a:active{background:rgba(0,0,0,.04)}' +
      '.tb-ham-menu .tb-ham-sep{height:1px;background:#e6e2da;margin:4px 18px}' +
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
      function openMenu()  { menu.classList.add('tb-menu-open'); dd.classList.add('tb-open'); btn.setAttribute('aria-expanded', 'true'); positionMenu(); }
      function closeMenu() { menu.classList.remove('tb-menu-open'); dd.classList.remove('tb-open'); btn.setAttribute('aria-expanded', 'false'); }

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
      if (b) b.setAttribute('aria-expanded', 'false');
    }
  });

  scroller.appendChild(inner);

  var bar = document.createElement('div');
  bar.className = 'tb';
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
    'background:#fdf8f0;color:#6b6860;font-size:18px;line-height:1;' +
    'padding:0;text-decoration:none;flex-shrink:0;';

  /* ── Mobile hamburger menu ──────────────────────────────────────────────── */
  var hamLabel = document.createElement('span');
  hamLabel.className = 'tb-ham-label';
  hamLabel.textContent = 'THE VOYAGER EXPERT';
  bar.appendChild(hamLabel);

  var hamBtn = document.createElement('div');
  hamBtn.className = 'tb-ham';
  hamBtn.setAttribute('role', 'button');
  hamBtn.setAttribute('aria-label', 'Menu');
  hamBtn.setAttribute('tabindex', '0');
  hamBtn.style.cssText = 'background:none;border:none;box-shadow:none;outline:none;-webkit-tap-highlight-color:transparent;padding:4px 14px 4px 8px;margin:0;min-height:auto;cursor:pointer;user-select:none;';
  hamBtn.innerHTML = '☰ <span style="font-size:13px;letter-spacing:.04em;font-weight:600">MENU</span>';
  bar.appendChild(hamBtn);

  var hamMenu = document.createElement('div');
  hamMenu.className = 'tb-ham-menu';
  bar.style.position = 'relative';

  /* Build flat link list from ITEMS */
  var prevWasGroup = false;
  ITEMS.forEach(function (item) {
    if (item === null) return; /* skip separators */
    if (item.children) {
      if (prevWasGroup) {
        var sep = document.createElement('div');
        sep.className = 'tb-ham-sep';
        hamMenu.appendChild(sep);
      }
      item.children.forEach(function (ch) {
        var a = document.createElement('a');
        a.href = ch.href;
        a.textContent = ch.text;
        if (ch.href.split('/').pop() === curr) a.className = 'tb-active';
        hamMenu.appendChild(a);
      });
      prevWasGroup = true;
    } else {
      if (prevWasGroup) {
        var sep2 = document.createElement('div');
        sep2.className = 'tb-ham-sep';
        hamMenu.appendChild(sep2);
      }
      var a2 = document.createElement('a');
      a2.href = item.href;
      a2.textContent = item.text;
      if (item.href.split('/').pop() === curr) a2.className = 'tb-active';
      hamMenu.appendChild(a2);
      prevWasGroup = false;
    }
  });
  bar.appendChild(hamMenu);

  hamBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    hamMenu.classList.toggle('tb-ham-open');
    var open = hamMenu.classList.contains('tb-ham-open');
    hamBtn.innerHTML = (open ? '✕' : '☰') + ' <span style="font-size:13px;letter-spacing:.04em;font-weight:600">' + (open ? 'CLOSE' : 'MENU') + '</span>';
  });
  document.addEventListener('click', function () {
    hamMenu.classList.remove('tb-ham-open');
    hamBtn.innerHTML = '☰ <span style="font-size:13px;letter-spacing:.04em;font-weight:600">MENU</span>';
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

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectOverviewArrows);
    } else {
      injectOverviewArrows();
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
    'background:#fdf8f0;cursor:pointer;padding:0;' +
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
      btn.style.background = '#fdf8f0';
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

  /* ── Footnote toolbar — RETIRED 2026-06-06 (owner) ─────────────────────────
     The footer sharing link (footnote.js) is retired for now and must not be
     used in the guides. toolbar.js no longer auto-loads footnote.js on any
     page. The loader below is kept (guarded off) so the feature can be
     re-enabled later by flipping FOOTNOTE_RETIRED to false.
     Validator: TB-9/TB-11 now enforce the retirement (no footnote.js load,
     no inline footer). Rule: Brain/Reference/Toolbar.html § 6. */
  var FOOTNOTE_RETIRED = true;   // retired 2026-06-06 — do not load footnote.js
  if (!FOOTNOTE_RETIRED && !noFootnote) {
    var _fn = document.createElement('script');
    /* footnote.js lives next to toolbar.js inside assets/ — permanent home.
       base resolves to the site root, so prefix with assets/. */
    _fn.src = base + 'assets/footnote.js';
    document.head.appendChild(_fn);
  }

  /* ── Last updated stamp — guide pages only ────────────────────────────────
     Injects "Updated Month Year" in small muted text at the bottom of every
     individual city guide. Detected by /Guides/ in the pathname (depth-2
     city guide pages) — excludes guides_index, Trip-Essentials, Maps, etc.
     Source: document.lastModified (HTTP Last-Modified header; file mtime
     on local). Guard: year > 2000 prevents garbage dates on broken headers. */
  var _path = decodeURIComponent(location.pathname);
  var _isGuide = /\/Guides\/[^/]+\/[^/]+\.html/.test(_path) ||
                 (_path.indexOf('file:') < 0 && _path.indexOf('/Guides/') > -1 &&
                  curr !== 'Guides-Index.html');
  if (_isGuide) {
    var _MONTHS = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];
    function _injectUpdated() {
      var lm = new Date(document.lastModified);
      if (!lm || lm.getFullYear() <= 2000) return;
      var el = document.createElement('div');
      el.style.cssText = 'text-align:center;padding:32px 16px 28px;font-size:11px;' +
                         'color:#b0aaa0;letter-spacing:0.06em;';
      el.textContent = 'Updated ' + _MONTHS[lm.getMonth()] + ' ' + lm.getFullYear();
      document.body.appendChild(el);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _injectUpdated);
    } else {
      _injectUpdated();
    }
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
