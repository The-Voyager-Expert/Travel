/**
 * toolbar.js — shared travel navigation bar
 *
 * ⚠️ HOME: Travel-Website/assets/toolbar.js — site-wide shared asset.
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
 *   data-maxwidth = legacy hint, no longer caps the bar (see § 7 Centering)
 *
 * ── Navigation model (rebuilt 2026-06-20) ──────────────────────────────────
 * Two primary links (Guides, Maps) + five category dropdowns (Trips, Getting
 * There, Money, Weather, Essentials). One consistent type scale everywhere —
 * bar, desktop flyouts, and the mobile accordion all use the same font stack
 * and a single size per surface, so nothing "changes size" between contexts.
 * Desktop: click a category → flyout (one open at a time). Mobile: hamburger →
 * full-width accordion (tap a category to expand; one section open at a time).
 *
 * To update the toolbar for every page: edit ONLY this file.
 */

/* ── Pre-hide body immediately — prevents the page-background flash that occurs
   while the browser waits for this script to finish downloading. */
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

  /* Hide page immediately so toolbar insertion doesn't cause a visible shift. */
  document.body.style.opacity = '0';

  var mount      = document.getElementById('toolbar-mount');
  var depth      = mount ? parseInt(mount.dataset.depth    || '1',   10) : 1;
  var maxWidth   = mount ? parseInt(mount.dataset.maxwidth || '760', 10) : 760; // legacy, unused
  var base       = new Array(depth + 1).join('../');   // e.g. depth=2 → '../../'
  var noFootnote = mount ? !!mount.dataset.noFootnote : false;
  var curr     = location.pathname.split('/').pop() || '';
  var prevHref = mount ? (mount.dataset.prev || '') : '';
  var nextHref = mount ? (mount.dataset.next || '') : '';

  /* One font stack for the WHOLE toolbar — pinned so the type never inherits a
     page's font (maps use -apple-system, guides use Roboto). This is what keeps
     every label the same shape and size across the bar, flyouts, and mobile. */
  var TBFONT = "'Roboto','Helvetica Neue',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";

  /* ── Links ──────────────────────────────────────────────────────────────────
     Two primary links + five category groups. Every page the site owns is
     reachable here (brain_check enumerates these hrefs against Brain.md Part 1). */
  var ITEMS = [
    { href: base + 'Guides/Guides-Index.html',            text: '🌐 Guides' },
    { href: base + 'Trip-Essentials/Maps/World-Map.html', text: '🗺️ Maps' },
    { group: '📆 Trips', children: [
        { href: base + 'Trip-Essentials/Trips.html',          text: '📆 Trips' },
        { href: base + 'Trip-Essentials/Travel-Packing.html', text: '👕 Packing' },
    ] },
    { group: '✈️ Getting There', children: [
        { href: base + 'Trip-Essentials/Delta-Routes-SEA.html',     text: '✈️ Delta — Seattle Hub' },
        { href: base + 'Trip-Essentials/Delta-Routes-Full.html',    text: '🌐 Delta — Full Network' },
        { href: base + 'Trip-Essentials/European-Train-Guide.html', text: '🚆 European Trains' },
        { href: base + 'Trip-Essentials/Lounges-US.html',           text: '💻 US Lounges' },
        { href: base + 'Trip-Essentials/Lounges-Europe.html',       text: '💻 EU Lounges' },
    ] },
    { group: '💰 Money', children: [
        { href: base + 'Trip-Essentials/Currency-Guide.html', text: '💰 Currency' },
        { href: base + 'Trip-Essentials/Tipping-Guide.html',  text: '🧾 Tipping' },
    ] },
    { group: '🌤️ Weather', children: [
        { href: base + 'Trip-Essentials/Climate-Finder.html', text: '🌤️ By Climate' },
        { href: base + 'Trip-Essentials/Weather.html',        text: '🌡️ By City' },
    ] },
    { group: '🧭 Essentials', children: [
        { href: base + 'Trip-Essentials/Safety-Guide.html',                   text: '🛡️ Safety' },
        { href: base + 'Trip-Essentials/Visas.html',                          text: '🪪 Visas' },
        { href: base + 'Trip-Essentials/Time-Zones.html',                     text: '🕐 Time Zones' },
        { href: base + 'Trip-Essentials/Travel-Stats.html',                   text: '📊 Travel Stats' },
        { href: base + 'Trip-Essentials/Plug-Adapter/Plug-Adapter-Guide.html', text: '🔌 Plug Adapters' },
        { href: base + 'Trip-Essentials/SIM-Cards.html',                      text: '📲 SIM Cards' },
        { href: base + 'Trip-Essentials/Before-You-Go.html',                  text: '📋 Before You Go' },
        { href: base + 'Trip-Essentials/Resources.html',                      text: '🔗 Web Resources' },
    ] },
  ];

  /* ── Theme ──────────────────────────────────────────────────────────────── */
  var isGuide = (mount && mount.dataset.toolbarTheme === 'guide');
  var accent  = isGuide ? '#6b6860'               : '#8a6c1a';
  var acLt    = isGuide ? 'rgba(107,104,96,.08)'  : 'rgba(138,108,26,.09)';
  var acMd    = isGuide ? 'rgba(107,104,96,.14)'  : 'rgba(138,108,26,.15)';
  var GRAD    = 'linear-gradient(135deg,#7a3b1e 0%,#b85c2a 55%,#d4874a 100%)';

  /* ── Styles ─────────────────────────────────────────────────────────────── */
  var css =
    /* Bar shell — three flex zones: title | nav (centered) | spacer/ham */
    '.tb{font-family:' + TBFONT + ';position:relative;display:flex;align-items:center;gap:10px;' +
      'padding:0 22px;min-height:48px;margin-bottom:18px;background:' + GRAD + ';' +
      'box-shadow:0 1px 2px rgba(60,30,10,.10)}' +
    '.tb *{font-family:' + TBFONT + ';box-sizing:border-box}' +
    '.tb-side{flex:1 1 0;min-width:0;display:flex;align-items:center}' +
    '.tb-left{justify-content:flex-start}' +
    '.tb-right{justify-content:flex-end}' +
    '.tb-site-title{flex-shrink:0;font-size:13px;font-weight:700;color:#fff;letter-spacing:.11em;' +
      'text-transform:uppercase;white-space:nowrap;text-decoration:none}' +
    /* Nav scroller (center zone) — natural width, scrolls only if a narrow desktop forces it */
    '.tb-inner{flex:0 1 auto;min-width:0;overflow-x:auto;scrollbar-width:none}' +
    '.tb-inner::-webkit-scrollbar{display:none}' +
    '.tb-links{display:flex;flex-wrap:nowrap;gap:3px;align-items:center;width:max-content;margin:0 auto}' +
    /* A nav item — links and dropdown buttons render IDENTICALLY (same size/weight) */
    '.tb-item{display:inline-flex;align-items:center;gap:5px;font-size:14px;font-weight:500;line-height:1;' +
      'color:rgba(255,255,255,.92);text-decoration:none;padding:9px 14px;border:0;border-radius:8px;' +
      'background:transparent;white-space:nowrap;cursor:pointer;flex-shrink:0;letter-spacing:.005em;' +
      'transition:background .15s,color .15s}' +
    '.tb-item:hover{color:#fff;background:rgba(255,255,255,.16)}' +
    '.tb-item.tb-active{color:#fff;background:rgba(255,255,255,.22);font-weight:600}' +
    '.tb-caret{font-size:9px;opacity:.85;transition:transform .18s;margin-left:1px}' +
    '.tb-dd{position:relative;display:inline-flex;flex-shrink:0}' +
    '.tb-dd.tb-open>.tb-item{color:#fff;background:rgba(255,255,255,.22)}' +
    '.tb-dd.tb-open .tb-caret{transform:rotate(180deg)}' +
    /* Desktop flyout — appended to <body> so the scroll row's overflow can't clip it */
    '.tb-menu{position:fixed;background:#fff;border:1px solid #e7e2d8;border-radius:11px;' +
      'box-shadow:0 12px 32px rgba(70,45,20,.18);padding:6px;display:none;flex-direction:column;' +
      'min-width:212px;z-index:1000}' +
    '.tb-menu.tb-menu-open{display:flex}' +
    '.tb-menu a{display:flex;align-items:center;gap:9px;font-size:13.5px;font-weight:500;line-height:1.1;' +
      'color:#3a3730;text-decoration:none;padding:10px 13px;border-radius:8px;white-space:nowrap;' +
      'transition:background .12s,color .12s}' +
    '.tb-menu a:hover{background:' + acLt + ';color:' + accent + '}' +
    '.tb-menu a.tb-active{background:' + acMd + ';color:' + accent + ';font-weight:600}' +
    /* Scroll progress bar — hidden on mobile (overlaps toolbar) */
    '.tb-progress{position:fixed;top:0;left:0;height:2px;width:0%;background:' + accent + ';' +
      'z-index:200;pointer-events:none;transition:width .08s linear}' +
    '@media(max-width:600px){.tb-progress{display:none}}' +
    /* Hamburger + mobile menu — hidden on desktop */
    '.tb-ham{display:none}.tb-mobile{display:none}' +
    '.tb-scroll-wrap{display:flex}' +
    /* ── MOBILE ──────────────────────────────────────────────────────────── */
    '@media(max-width:600px){' +
      '.tb{padding:0 12px;min-height:50px;justify-content:space-between}' +
      '.tb-inner{display:none!important}' +
      '.tb-left{flex:1 1 auto}.tb-right{flex:0 0 auto}' +
      '.tb-site-title{font-size:12.5px;letter-spacing:.07em}' +
      '.tb-ham{display:inline-flex;align-items:center;gap:7px;cursor:pointer;' +
        'background:rgba(255,255,255,.15);border:0;border-radius:9px;padding:8px 14px;color:#fff;' +
        'font-size:13px;font-weight:700;letter-spacing:.05em;-webkit-tap-highlight-color:transparent;' +
        'transition:background .15s}' +
      '.tb-ham:active{background:rgba(255,255,255,.26)}' +
      '.tb-ham-ic{font-size:14px;line-height:1;width:14px;text-align:center}' +
      '.tb-mobile{display:block;position:absolute;top:100%;left:0;right:0;background:#fff;' +
        'border-bottom:2px solid #d8d0c4;box-shadow:0 14px 34px rgba(0,0,0,.22);z-index:999;' +
        'max-height:calc(100dvh - 50px);overflow-y:auto;-webkit-overflow-scrolling:touch;' +
        'transform:translateY(-10px);opacity:0;visibility:hidden;pointer-events:none;' +
        'transition:opacity .2s ease,transform .2s ease,visibility .2s}' +
      '.tb-mobile.tb-m-open{transform:translateY(0);opacity:1;visibility:visible;pointer-events:auto}' +
      '.tb-m-link,.tb-m-head{display:flex;align-items:center;width:100%;font-size:15px;font-weight:600;' +
        'color:#2a2824;text-decoration:none;padding:15px 18px;background:none;border:0;' +
        'border-bottom:1px solid #efeae1;text-align:left;font-family:' + TBFONT + ';cursor:pointer;' +
        '-webkit-tap-highlight-color:transparent}' +
      '.tb-m-head{justify-content:space-between;gap:10px}' +
      '.tb-m-head .tb-caret{font-size:11px;opacity:1;color:#a89a84}' +
      '.tb-m-group.tb-m-exp>.tb-m-head{color:' + accent + ';background:#faf6ee}' +
      '.tb-m-group.tb-m-exp>.tb-m-head .tb-caret{transform:rotate(180deg)}' +
      '.tb-m-sub{display:none;background:#faf8f3}' +
      '.tb-m-group.tb-m-exp>.tb-m-sub{display:block}' +
      '.tb-m-sub a{display:flex;align-items:center;font-size:14px;font-weight:500;color:#4a463e;' +
        'text-decoration:none;padding:13px 18px 13px 34px;border-bottom:1px solid #efeae1}' +
      '.tb-m-sub a:last-child{border-bottom:0}' +
      '.tb-m-link:active,.tb-m-sub a:active{background:rgba(0,0,0,.045)}' +
      '.tb-m-link.tb-active,.tb-m-sub a.tb-active{color:' + accent + '}' +
      '.tb-m-link.tb-active{background:#faf6ee}' +
    '}';

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── Scroll progress bar ────────────────────────────────────────────────── */
  var progress = document.createElement('div');
  progress.className = 'tb-progress';
  document.body.appendChild(progress);
  window.addEventListener('scroll', function () {
    var total = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (total > 0 ? (window.scrollY / total * 100) : 0) + '%';
  }, { passive: true });

  function isActiveHref(href) { return href.split('/').pop() === curr && curr !== ''; }

  /* ── Bar shell ──────────────────────────────────────────────────────────── */
  var bar = document.createElement('div');
  bar.className = 'tb';

  var left = document.createElement('div');
  left.className = 'tb-side tb-left';
  var siteTitle = document.createElement('a');
  siteTitle.className = 'tb-site-title';
  siteTitle.textContent = 'The Voyager Expert';
  siteTitle.href = base + 'Guides/Guides-Index.html';
  left.appendChild(siteTitle);
  bar.appendChild(left);

  /* ── Desktop nav (center) ───────────────────────────────────────────────── */
  var scroller = document.createElement('div');
  scroller.className = 'tb-inner';
  var inner = document.createElement('div');
  inner.className = 'tb-links';
  scroller.appendChild(inner);
  bar.appendChild(scroller);

  var openDd = null;  // currently-open desktop dropdown (one at a time)

  function buildDesktopGroup(item) {
    var dd = document.createElement('span');
    dd.className = 'tb-dd';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tb-item';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    var lab = document.createElement('span'); lab.textContent = item.group;
    var car = document.createElement('span'); car.className = 'tb-caret'; car.textContent = '▾';
    btn.appendChild(lab); btn.appendChild(car);

    var menu = document.createElement('div');
    menu.className = 'tb-menu';
    var groupActive = false;
    item.children.forEach(function (ch) {
      var ca = document.createElement('a');
      ca.href = ch.href; ca.textContent = ch.text;
      if (isActiveHref(ch.href)) { ca.classList.add('tb-active'); groupActive = true; }
      menu.appendChild(ca);
    });
    if (groupActive) btn.classList.add('tb-active');
    document.body.appendChild(menu);

    function position() {
      var r = btn.getBoundingClientRect();
      var mw = menu.offsetWidth || 212, half = mw / 2;
      var cx = r.left + r.width / 2;
      var lo = half + 8, hi = window.innerWidth - half - 8;
      if (hi < lo) hi = lo;
      cx = Math.max(lo, Math.min(cx, hi));
      menu.style.left = Math.round(cx) + 'px';
      menu.style.top  = Math.round(r.bottom + 7) + 'px';
      menu.style.transform = 'translateX(-50%)';
    }
    function open() {
      if (openDd && openDd.close) openDd.close();
      menu.classList.add('tb-menu-open'); dd.classList.add('tb-open');
      btn.setAttribute('aria-expanded', 'true'); position();
      openDd = { close: close };
    }
    function close() {
      menu.classList.remove('tb-menu-open'); dd.classList.remove('tb-open');
      btn.setAttribute('aria-expanded', 'false');
      if (openDd && openDd.close === close) openDd = null;
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (menu.classList.contains('tb-menu-open')) close(); else open();
    });
    menu.addEventListener('click', function (e) { e.stopPropagation(); });
    window.addEventListener('scroll', function () { if (menu.classList.contains('tb-menu-open')) close(); }, { passive: true });
    window.addEventListener('resize', function () { if (menu.classList.contains('tb-menu-open')) close(); });

    dd.appendChild(btn);
    return dd;
  }

  ITEMS.forEach(function (item) {
    if (item.children) {
      inner.appendChild(buildDesktopGroup(item));
    } else {
      var a = document.createElement('a');
      a.className = 'tb-item';
      a.href = item.href; a.textContent = item.text;
      if (isActiveHref(item.href)) a.classList.add('tb-active');
      inner.appendChild(a);
    }
  });

  /* Close any open desktop dropdown on outside click. */
  document.addEventListener('click', function () { if (openDd && openDd.close) openDd.close(); });

  /* ── Mobile: hamburger + accordion ──────────────────────────────────────── */
  var right = document.createElement('div');
  right.className = 'tb-side tb-right';

  var ham = document.createElement('button');
  ham.type = 'button';
  ham.className = 'tb-ham';
  ham.setAttribute('aria-label', 'Menu');
  ham.setAttribute('aria-expanded', 'false');
  ham.innerHTML = '<span class="tb-ham-ic">☰</span><span class="tb-ham-txt">MENU</span>';
  right.appendChild(ham);
  bar.appendChild(right);

  var mobile = document.createElement('div');
  mobile.className = 'tb-mobile';
  var openGroup = null;  // currently-expanded accordion group (one at a time)

  ITEMS.forEach(function (item) {
    if (item.children) {
      var grp = document.createElement('div');
      grp.className = 'tb-m-group';
      var head = document.createElement('button');
      head.type = 'button'; head.className = 'tb-m-head';
      var hl = document.createElement('span'); hl.textContent = item.group;
      var hc = document.createElement('span'); hc.className = 'tb-caret'; hc.textContent = '▾';
      head.appendChild(hl); head.appendChild(hc);
      var sub = document.createElement('div'); sub.className = 'tb-m-sub';
      var hasActive = false;
      item.children.forEach(function (ch) {
        var a = document.createElement('a');
        a.href = ch.href; a.textContent = ch.text;
        if (isActiveHref(ch.href)) { a.classList.add('tb-active'); hasActive = true; }
        sub.appendChild(a);
      });
      grp.appendChild(head); grp.appendChild(sub);
      if (hasActive) { grp.classList.add('tb-m-exp'); openGroup = grp; }  // open the active section
      head.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = grp.classList.contains('tb-m-exp');
        if (openGroup && openGroup !== grp) openGroup.classList.remove('tb-m-exp');
        if (isOpen) { grp.classList.remove('tb-m-exp'); openGroup = null; }
        else { grp.classList.add('tb-m-exp'); openGroup = grp; }
      });
      mobile.appendChild(grp);
    } else {
      var a = document.createElement('a');
      a.className = 'tb-m-link';
      a.href = item.href; a.textContent = item.text;
      if (isActiveHref(item.href)) a.classList.add('tb-active');
      mobile.appendChild(a);
    }
  });
  bar.appendChild(mobile);

  function setHam(open) {
    ham.setAttribute('aria-expanded', open ? 'true' : 'false');
    ham.querySelector('.tb-ham-ic').textContent = open ? '✕' : '☰';
    ham.querySelector('.tb-ham-txt').textContent = open ? 'CLOSE' : 'MENU';
  }
  ham.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = mobile.classList.toggle('tb-m-open');
    setHam(open);
  });
  mobile.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', function () {
    if (mobile.classList.contains('tb-m-open')) { mobile.classList.remove('tb-m-open'); setHam(false); }
  });

  /* ── Insert toolbar ─────────────────────────────────────────────────────── */
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
  var isRealGuide = /\/Guides\//.test(location.pathname) && location.pathname.indexOf('guides_index') < 0;
  var btnStyle = 'display:inline-flex;align-items:center;justify-content:center;' +
    'width:30px;height:30px;border-radius:6px;border:1.5px solid #c4b896;' +
    'background:#fdf8f0;color:#6b6860;font-size:18px;line-height:1;' +
    'padding:0;text-decoration:none;flex-shrink:0;';
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
        btnPrev.href = prevHref; btnPrev.textContent = '‹';
        btnPrev.setAttribute('aria-label', 'Previous'); btnPrev.style.cssText = btnStyle;
        overviewTitle.appendChild(btnPrev);
      } else {
        var sL = document.createElement('span'); sL.style.cssText = 'width:36px;flex-shrink:0;'; overviewTitle.appendChild(sL);
      }
      overviewTitle.appendChild(titleSpan);
      if (nextHref) {
        var btnNext = document.createElement('a');
        btnNext.href = nextHref; btnNext.textContent = '›';
        btnNext.setAttribute('aria-label', 'Next'); btnNext.style.cssText = btnStyle;
        overviewTitle.appendChild(btnNext);
      } else {
        var sR = document.createElement('span'); sR.style.cssText = 'width:36px;flex-shrink:0;'; overviewTitle.appendChild(sR);
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectOverviewArrows);
    } else { injectOverviewArrows(); }
  }

  /* ── Scroll up / down fixed buttons (right side, desktop only) ───────────── */
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
    btn.type = 'button'; btn.style.cssText = scrollBtnBase;
    btn.setAttribute('aria-label', dir === 'up' ? 'Scroll to top' : 'Scroll to bottom');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '14'); svg.setAttribute('height', '9');
    svg.setAttribute('viewBox', '0 0 14 9'); svg.setAttribute('fill', 'none');
    var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', dir === 'up' ? '1,8 7,2 13,8' : '1,1 7,7 13,1');
    poly.setAttribute('stroke', '#6b6860'); poly.setAttribute('stroke-width', '1.8');
    poly.setAttribute('stroke-linecap', 'round'); poly.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(poly); btn.appendChild(svg);
    btn.addEventListener('click', function () {
      window.scrollTo({ top: dir === 'up' ? 0 : document.documentElement.scrollHeight, behavior: 'smooth' });
    });
    btn.addEventListener('mouseenter', function () {
      btn.style.background = acLt; btn.style.borderColor = accent; poly.setAttribute('stroke', accent);
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.background = '#fdf8f0'; btn.style.borderColor = '#c4b896'; poly.setAttribute('stroke', '#6b6860');
    });
    return btn;
  }
  var btnUp, btnDown;
  if (window.innerWidth > 600) {
    btnUp = makeScrollBtn('up'); btnDown = makeScrollBtn('down');
    scrollWrap.appendChild(btnUp); scrollWrap.appendChild(btnDown);
    document.body.appendChild(scrollWrap);
  }
  function updateScrollBtns() {
    if (window.innerWidth <= 600 || !scrollWrap.parentNode) { return; }
    var scrollY   = window.scrollY;
    var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    var canScroll = maxScroll > 1;
    scrollWrap.style.display = canScroll ? 'flex' : 'none';
    if (canScroll) {
      var atTop = scrollY <= 0, atBottom = scrollY >= maxScroll - 1;
      btnUp.style.opacity = atTop ? '0.3' : '1';
      btnUp.style.pointerEvents = atTop ? 'none' : '';
      btnDown.style.opacity = atBottom ? '0.3' : '1';
      btnDown.style.pointerEvents = atBottom ? 'none' : '';
    }
  }
  window.addEventListener('scroll', updateScrollBtns, { passive: true });
  window.addEventListener('resize', updateScrollBtns, { passive: true });
  requestAnimationFrame(function () { requestAnimationFrame(updateScrollBtns); });

  /* ── Reveal page ────────────────────────────────────────────────────────── */
  requestAnimationFrame(function () {
    var hide = document.getElementById('_tbhide');
    if (hide) hide.parentNode.removeChild(hide);
    document.body.style.transition = 'opacity .12s';
    document.body.style.opacity    = '1';
  });

  /* ── Center the active item in the scroller (narrow desktops only) ───────── */
  var activeLink = inner.querySelector('.tb-active');
  if (activeLink) {
    setTimeout(function () {
      var offset = activeLink.offsetLeft - (scroller.offsetWidth - activeLink.offsetWidth) / 2;
      scroller.scrollLeft = Math.max(0, offset);
    }, 50);
  }

  /* ── Footnote toolbar — RETIRED 2026-06-06 (owner) ──────────────────────── */
  var FOOTNOTE_RETIRED = true;
  if (!FOOTNOTE_RETIRED && !noFootnote) {
    var _fn = document.createElement('script');
    _fn.src = base + 'assets/footnote.js';
    document.head.appendChild(_fn);
  }

  /* ── Last updated stamp — individual city guide pages only ──────────────── */
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
    } else { _injectUpdated(); }
  }

  /* ── Weather widget — loaded on the Guides index ONLY ───────────────────── */
  if (curr === 'Guides-Index.html') {
    var _wx = document.createElement('script');
    _wx.src = base + 'assets/weather.js?v=4';
    document.head.appendChild(_wx);
  }
}());
