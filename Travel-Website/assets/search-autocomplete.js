/* ══════════════════════════════════════════════════════════════════════════
 * TVESearch — shared search autocomplete (The Voyager Expert)
 *
 * ONE implementation of the "type a city → that city; type a country → the
 * country + all its cities" typeahead, extracted from the Before-You-Go search
 * so every page reuses it instead of re-inventing a search per page.
 *
 *   TVESearch.attach(inputEl, {
 *     items:   [ { name, sub, href, ... }, ... ],   // name = bold, sub = grey
 *     onPick:  function (item) { ... },              // optional; default: nav to item.href
 *     minChars: 1,                                   // optional (default 1)
 *     limit:   60,                                   // optional (default 60)
 *     match:   function (item, q) { ... }            // optional custom matcher
 *   });
 *
 * Matching (default): case-insensitive substring on `name` OR `sub`, so typing
 * a country name surfaces all of its cities. Results are prefix-first sorted.
 * Look + behavior (floating card, City · Country rows, ↑/↓/Enter/Esc, gold ✕,
 * click-outside to close) come from the shared `.sa-suggest` CSS in
 * web-travel-style.css — do not restyle per page.
 * ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function attach(input, opts) {
    if (!input || input._tveAttached) return null;
    input._tveAttached = true;
    opts = opts || {};
    var items = (opts.items || []).slice();
    var minChars = opts.minChars || 1;
    var limit = opts.limit || 60;
    var onPick = opts.onPick || function (it) { if (it && it.href) window.location.href = it.href; };
    var match = opts.match || function (it, q) {
      return it._n.indexOf(q) >= 0 || (it._s && it._s.indexOf(q) >= 0);
    };

    items.forEach(function (it) {
      it._n = String(it.name || '').toLowerCase();
      it._s = String(it.sub || '').toLowerCase();
    });

    // Dropdown floats inside the input's wrapper (needs positioning context).
    var wrap = input.parentNode;
    if (wrap && getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    var dd = document.createElement('div');
    dd.className = 'sa-suggest';
    dd.hidden = true;
    (wrap || document.body).appendChild(dd);

    var active = -1, cur = [];

    function hide() { dd.hidden = true; dd.innerHTML = ''; active = -1; }

    function render() {
      var q = (input.value || '').trim().toLowerCase();
      if (q.length < minChars) { hide(); return; }
      cur = items.filter(function (it) { return match(it, q); })
        .sort(function (a, b) {
          function sc(d) { return d._n.indexOf(q) === 0 ? 0 : d._n.indexOf(q) >= 0 ? 1 : 2; }
          return sc(a) - sc(b) || a.name.localeCompare(b.name);
        })
        .slice(0, limit);
      if (!cur.length) {
        dd.innerHTML = '<div class="sa-empty">No matches for “' + esc(input.value.trim()) + '”.</div>';
        dd.hidden = false; active = -1; return;
      }
      dd.innerHTML = cur.map(function (it, i) {
        return '<button type="button" class="sa-row" data-i="' + i + '">' +
          esc(it.name) + (it.sub ? '<span class="sa-sub"> · ' + esc(it.sub) + '</span>' : '') +
          '</button>';
      }).join('');
      dd.hidden = false; active = -1;
    }

    function paint() {
      var rows = dd.querySelectorAll('.sa-row');
      for (var i = 0; i < rows.length; i++) rows[i].classList.toggle('active', i === active);
      if (active >= 0 && rows[active]) rows[active].scrollIntoView({ block: 'nearest' });
    }

    function pick(i) {
      var it = cur[i];
      if (!it) return;
      input.value = it.name;
      hide();
      onPick(it);
    }

    input.addEventListener('input', render);
    input.addEventListener('focus', function () { if (input.value.trim()) render(); });
    dd.addEventListener('mousedown', function (e) {
      var b = e.target.closest ? e.target.closest('.sa-row') : null;
      if (!b) return;
      e.preventDefault();
      pick(parseInt(b.getAttribute('data-i'), 10));
    });
    input.addEventListener('keydown', function (e) {
      var rows = dd.hidden ? [] : dd.querySelectorAll('.sa-row');
      if (e.key === 'ArrowDown') { e.preventDefault(); if (rows.length) { active = Math.min(active + 1, rows.length - 1); paint(); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (rows.length) { active = Math.max(active - 1, 0); paint(); } }
      else if (e.key === 'Enter') { if (rows.length) { e.preventDefault(); pick(active >= 0 ? active : 0); } }
      else if (e.key === 'Escape') { hide(); }
    });
    document.addEventListener('click', function (e) {
      if (e.target !== input && !dd.contains(e.target)) hide();
    });

    return { render: render, hide: hide, setItems: function (list) {
      items = (list || []).slice();
      items.forEach(function (it) { it._n = String(it.name || '').toLowerCase(); it._s = String(it.sub || '').toLowerCase(); });
    } };
  }

  window.TVESearch = { attach: attach };
})();
