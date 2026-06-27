/**
 * add_day.js — "Add a day" selector for city guides (prompt-builder, no backend).
 *
 * ⚠️ HOME: Travel-Website/assets/add_day.js — site-wide shared asset.
 * Load it from any guide page at that page's relative depth, before </body>:
 *   <script src="../../assets/add_day.js?v=1"></script>
 *
 * WHAT IT DOES
 * A static guide page cannot call Claude on its own (the site is published as a
 * static GitHub Pages PWA — there is no server listening). So instead of trying
 * to run the model from the browser, this control turns one click into a
 * ready-to-run instruction:
 *
 *   1. It reads the city name and counts the existing `.day-block` sections.
 *   2. You pick the new day number (defaults to the next one) and, optionally,
 *      a theme/focus and a stop count.
 *   3. It writes a precise prompt that tells Claude exactly how to build the new
 *      day so it matches this guide's existing HTML (stop-block markup,
 *      inclusion-bar comments, ticket-box / tour-box, overview link, etc.).
 *   4. One button copies that prompt to the clipboard; another opens a prefilled
 *      GitHub issue. Paste it into Claude (or hand the issue to Claude Code) and
 *      the day gets built — without you having to write the request by hand.
 *
 * It injects its own scoped styles and self-mounts on DOMContentLoaded. It makes
 * no edits to the page content; it only reads the DOM to compose the prompt.
 *
 * Optional config via the existing #toolbar-mount element:
 *   data-repo="the-voyager-expert/travel"   GitHub repo for the "open issue" link
 */
(function () {
  'use strict';

  var REPO_DEFAULT = 'the-voyager-expert/travel';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  }

  function injectStyles() {
    if (document.getElementById('_addday_css')) return;
    var css = [
      '.addday-bar{margin:14px 0 4px;text-align:center}',
      '.addday-btn{display:inline-block;cursor:pointer;border:1px solid #d4b896;',
      'background:#fff7ec;color:#b85c2a;font:inherit;font-weight:600;font-size:.95em;',
      'padding:8px 16px;border-radius:999px;transition:background .15s,box-shadow .15s}',
      '.addday-btn:hover{background:#fde6cf;box-shadow:0 1px 4px rgba(184,92,42,.18)}',
      '.addday-panel{max-width:560px;margin:10px auto 0;border:1px solid #e6d6bd;',
      'background:#fffdf9;border-radius:12px;padding:16px 18px;text-align:left;',
      'box-shadow:0 2px 10px rgba(0,0,0,.06)}',
      '.addday-panel[hidden]{display:none}',
      '.addday-row{margin:10px 0}',
      '.addday-row label{display:block;font-weight:600;color:#7a5a36;font-size:.85em;margin-bottom:4px}',
      '.addday-row input,.addday-row select{width:100%;box-sizing:border-box;padding:8px 10px;',
      'border:1px solid #d9c7ab;border-radius:8px;font:inherit;background:#fff}',
      '.addday-grid{display:flex;gap:12px}.addday-grid>div{flex:1}',
      '.addday-actions{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}',
      '.addday-actions button{flex:1;min-width:140px;cursor:pointer;border-radius:8px;',
      'padding:9px 12px;font:inherit;font-weight:600;border:1px solid #d4b896}',
      '.addday-do{background:#b85c2a;color:#fff;border-color:#b85c2a}',
      '.addday-do:hover{background:#a04e22}',
      '.addday-issue{background:#fff7ec;color:#b85c2a}',
      '.addday-issue:hover{background:#fde6cf}',
      '.addday-note{font-size:.8em;color:#8a795c;margin-top:10px;line-height:1.45}',
      '.addday-toast{font-size:.85em;color:#2e7d32;font-weight:600;margin-top:8px;min-height:1.2em}'
    ].join('');
    var s = document.createElement('style');
    s.id = '_addday_css';
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  // Best-effort city name from the page.
  function detectCity() {
    var el = document.querySelector('.title-city');
    if (el && el.textContent.trim()) {
      var t = el.textContent.trim();
      // Title-case the all-caps display name.
      return t.replace(/\S+/g, function (w) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      });
    }
    if (document.title && document.title.trim()) return document.title.trim();
    return 'this city';
  }

  // Count existing day blocks (#day1, #day2, …) and return the highest number.
  function countDays() {
    var blocks = document.querySelectorAll('.day-block[id^="day"]');
    var max = 0;
    blocks.forEach(function (b) {
      var m = /^day(\d+)$/.exec(b.id);
      if (m) { max = Math.max(max, parseInt(m[1], 10)); }
    });
    return max;
  }

  function fileName() {
    var parts = location.pathname.split('/').filter(Boolean);
    return parts.length ? decodeURIComponent(parts[parts.length - 1]) : '';
  }

  function buildPrompt(opts) {
    var city = opts.city, n = opts.day, theme = opts.theme, stops = opts.stops;
    var file = fileName();
    var themeLine = theme
      ? 'Theme / focus for the new day: ' + theme + '.'
      : 'Choose a coherent theme for the new day from attractions not already covered on Days 1–' + (n - 1) + '.';
    return [
      'Add Day ' + n + ' to the ' + city + ' guide (' + file + ').',
      '',
      themeLine,
      'Include about ' + stops + ' stops.',
      '',
      'Match the existing guide format exactly:',
      '• Append a new <div class="day-block" id="day' + n + '"> after the current last day block,',
      '  starting with <div class="day-header">Day ' + n + '</div> and a "hotel-first" row.',
      '• Each stop is a <div class="stop-block"> with: stop-header (stop-num + stop-name),',
      '  a "↳" description stop-row, a "📖 Wikipedia" stop-row, a ticket-box (with',
      '  🏟️ hours, ⏰ duration, 📍 Google Maps link) or a tour-box for free sights,',
      '  and a stop-photos image.',
      '• Put a "next" travel row ("🚶 · 🚕 → …") between consecutive stops, and end the day',
      '  with a "→ hotel" row.',
      '• Add an inclusion-bar HTML comment before each stop citing sources.',
      '• Add a matching overview link in the TRIP OVERVIEW section:',
      '  <a class="overview-day" href="#day' + n + '"> with a Day ' + n + ' – … title.',
      '',
      'Verify opening hours, ticket links, and tour ratings against real sources,',
      'fetch real images into _build/assets/, then run the guide’s normal ship/',
      'validation process so the change passes Brain/scripts/validate_guide_coverage.py.'
    ].join('\n');
  }

  function render(mount) {
    var city = detectCity();
    var existing = countDays();
    var nextDay = existing + 1;

    var bar = document.createElement('div');
    bar.className = 'addday-bar';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'addday-btn';
    btn.textContent = '➕ Add a day';
    bar.appendChild(btn);

    var panel = document.createElement('div');
    panel.className = 'addday-panel';
    panel.hidden = true;
    panel.innerHTML =
      '<div class="addday-grid">' +
        '<div class="addday-row"><label>Day number</label>' +
          '<input type="number" class="addday-num" min="1" value="' + nextDay + '"></div>' +
        '<div class="addday-row"><label>Stops</label>' +
          '<select class="addday-stops">' +
            '<option>3</option><option selected>4</option><option>5</option><option>6</option>' +
          '</select></div>' +
      '</div>' +
      '<div class="addday-row"><label>Theme / focus (optional)</label>' +
        '<input type="text" class="addday-theme" placeholder="e.g. museums &amp; the river, or leave blank for Claude to choose"></div>' +
      '<div class="addday-actions">' +
        '<button type="button" class="addday-do">📋 Copy instruction for Claude</button>' +
        '<button type="button" class="addday-issue">🐙 Open as GitHub issue</button>' +
      '</div>' +
      '<div class="addday-toast" aria-live="polite"></div>' +
      '<div class="addday-note">' + city + ' currently has ' + existing + ' day' +
        (existing === 1 ? '' : 's') + '. This builds a ready-to-run instruction — ' +
        'paste it into Claude (or hand the GitHub issue to Claude Code) and the new ' +
        'day gets written into this guide in the existing format.</div>';

    bar.appendChild(panel);

    var repo = (mount && mount.dataset && mount.dataset.repo) || REPO_DEFAULT;

    function opts() {
      var n = parseInt(panel.querySelector('.addday-num').value, 10);
      if (!n || n < 1) n = nextDay;
      return {
        city: city,
        day: n,
        stops: panel.querySelector('.addday-stops').value,
        theme: panel.querySelector('.addday-theme').value.trim()
      };
    }
    function toast(msg) {
      var t = panel.querySelector('.addday-toast');
      t.textContent = msg;
      if (toast._t) clearTimeout(toast._t);
      toast._t = setTimeout(function () { t.textContent = ''; }, 4000);
    }

    btn.addEventListener('click', function () {
      panel.hidden = !panel.hidden;
    });

    panel.querySelector('.addday-do').addEventListener('click', function () {
      var text = buildPrompt(opts());
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { toast('✓ Instruction copied — paste it into Claude.'); },
          function () { fallbackCopy(text, toast); }
        );
      } else {
        fallbackCopy(text, toast);
      }
    });

    panel.querySelector('.addday-issue').addEventListener('click', function () {
      var o = opts();
      var url = 'https://github.com/' + repo + '/issues/new' +
        '?title=' + encodeURIComponent('Add Day ' + o.day + ' to ' + o.city + ' guide') +
        '&labels=add-day' +
        '&body=' + encodeURIComponent(buildPrompt(o));
      window.open(url, '_blank', 'noopener');
    });

    // Mount under the trip overview if present, else at top of the container.
    var overview = document.querySelector('.overview-section');
    if (overview && overview.parentNode) {
      overview.parentNode.insertBefore(bar, overview.nextSibling);
    } else {
      var c = document.querySelector('.container') || document.body;
      c.insertBefore(bar, c.firstChild);
    }
  }

  function fallbackCopy(text, toast) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('✓ Instruction copied — paste it into Claude.');
    } catch (e) {
      toast('Copy failed — select the text manually.');
    }
  }

  ready(function () {
    try {
      // Only render on itinerary pages, and never twice.
      if (window._addDayMounted) return;
      if (!document.querySelector('.day-block[id^="day"]')) return;
      window._addDayMounted = true;
      injectStyles();
      render(document.getElementById('toolbar-mount'));
    } catch (e) { /* never break the page */ }
  });
})();
