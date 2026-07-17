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

  // US state abbreviation → full name, for auto-expanding match text.
  // Items whose name ends in " XX" or ", XX", or whose sub is exactly a 2-letter state
  // code, or whose name matches a known US city get the full state name appended to their
  // hidden _t match field automatically, so typing "california" or "cali" surfaces
  // "Santa Barbara CA", "Los Angeles CA", "Atlanta", "Seattle" etc. on every page.
  var _US = {
    'AL':'Alabama','AK':'Alaska','AZ':'Arizona','AR':'Arkansas','CA':'California',
    'CO':'Colorado','CT':'Connecticut','DE':'Delaware','FL':'Florida','GA':'Georgia',
    'HI':'Hawaii','ID':'Idaho','IL':'Illinois','IN':'Indiana','IA':'Iowa',
    'KS':'Kansas','KY':'Kentucky','LA':'Louisiana','ME':'Maine','MD':'Maryland',
    'MA':'Massachusetts','MI':'Michigan','MN':'Minnesota','MS':'Mississippi',
    'MO':'Missouri','MT':'Montana','NE':'Nebraska','NV':'Nevada','NH':'New Hampshire',
    'NJ':'New Jersey','NM':'New Mexico','NY':'New York','NC':'North Carolina',
    'ND':'North Dakota','OH':'Ohio','OK':'Oklahoma','OR':'Oregon','PA':'Pennsylvania',
    'RI':'Rhode Island','SC':'South Carolina','SD':'South Dakota','TN':'Tennessee',
    'TX':'Texas','UT':'Utah','VT':'Vermont','VA':'Virginia','WA':'Washington',
    'WV':'West Virginia','WI':'Wisconsin','WY':'Wyoming','DC':'District of Columbia'
  };

  // US city name (lowercase) → full state name, for bare city names with no "XX" suffix.
  // Used by Lounges-US, Before-You-Go, and any page where items have no state abbreviation.
  var _US_CITIES = {
    'alaska':'Alaska','albuquerque':'New Mexico','atlanta':'Georgia',
    'austin':'Texas','baltimore':'Maryland','bend':'Oregon',
    'big island':'Hawaii','billings':'Montana','birmingham':'Alabama',
    'boise':'Idaho','boston':'Massachusetts','boulder':'Colorado',
    'cape cod':'Massachusetts','carmel-by-the-sea':'California',
    'charlotte':'North Carolina','charleston':'South Carolina',
    'chicago':'Illinois','cheyenne':'Wyoming','columbia':'South Carolina',
    'columbus':'Ohio','dallas':'Texas','denver':'Colorado',
    'des moines':'Iowa','detroit':'Michigan','fargo':'North Dakota',
    'florida keys':'Florida','fort lauderdale':'Florida',
    'glacier national park':'Montana','hartford':'Connecticut',
    'honolulu':'Hawaii','houston':'Texas','indianapolis':'Indiana',
    'jackson':'Mississippi','jacksonville':'Florida',
    'kansas city':'Missouri','kauai':'Hawaii','key west':'Florida',
    'la jolla':'California','lake tahoe':'California',
    'las vegas':'Nevada','lecce':'Italy','little rock':'Arkansas',
    'los angeles':'California','louisville':'Kentucky',
    'malibu':'California','maui':'Hawaii','miami':'Florida',
    'milwaukee':'Wisconsin','minneapolis':'Minnesota',
    'minneapolis–st. paul':'Minnesota','minneapolis-st. paul':'Minnesota',
    'napa':'California','naples florida':'Florida','nashville':'Tennessee',
    'new orleans':'Louisiana','new york':'New York',
    'newark':'New Jersey','oahu':'Hawaii','oklahoma city':'Oklahoma',
    'omaha':'Nebraska','orcas island':'Washington','orlando':'Florida',
    'palm desert':'California','palo alto':'California','pasadena':'California',
    'pensacola':'Florida','philadelphia':'Pennsylvania','phoenix':'Arizona',
    'portland':'Oregon','providence':'Rhode Island',
    'richmond':'Virginia','sacramento':'California',
    'salt lake city':'Utah','san antonio':'Texas','san diego':'California',
    'san francisco':'California','san jose':'California',
    'san juan island':'Washington','santa barbara':'California',
    'santa cruz':'California','santa monica':'California',
    'sarasota':'Florida','scottsdale':'Arizona','seattle':'Washington',
    'sedona':'Arizona','sioux falls':'South Dakota',
    'tampa':'Florida','washington dc':'District of Columbia',
    'washington d.c.':'District of Columbia','wilmington':'Delaware',
    'yellowstone':'Wyoming'
  };

  function stateText(name, sub) {
    // Handle both " CA" (space-before) and ", CA" (comma-space) formats.
    var m = name && name.match(/[, ]+([A-Z]{2})\s*$/);
    var fromName = (m && _US[m[1]]) ? _US[m[1]] : '';
    var fromSub  = (sub && sub.length === 2) ? (_US[sub.toUpperCase()] || '') : '';
    // Fallback: bare city name lookup (e.g. "Atlanta", "Seattle" with no state suffix).
    var nameLower = String(name || '').toLowerCase().replace(/[, ]+[a-z]{2}\s*$/, '').trim();
    var fromCity  = _US_CITIES[nameLower] || '';
    return fromName || fromSub || fromCity;
  }

  // Word-start match: q matches if it appears at position 0 or immediately after
  // a whitespace/punctuation boundary in str. Prevents "re" from hitting "ireland",
  // "greece", "singapore" (all have 're' mid-word) while still finding "real",
  // "renminbi", "republic" (all start with 're').
  function wsMatch(str, q) {
    var i = str.indexOf(q);
    while (i >= 0) {
      if (i === 0) return true;
      var prev = str[i - 1];
      if (prev === ' ' || prev === '-' || prev === '(' || prev === ',' || prev === '.' || prev === '/') return true;
      i = str.indexOf(q, i + 1);
    }
    return false;
  }

  function buildFields(it) {
    it._n = String(it.name || '').toLowerCase();
    it._s = String(it.sub  || '').toLowerCase();
    var extra = stateText(it.name, it.sub);
    it._t = (String(it.text || '') + (extra ? ' ' + extra : '')).toLowerCase();
  }

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
    // Default pick behavior: guides navigate (item.href); filter pages (no href)
    // set the input value + fire a native 'input' event so the page's own filter
    // runs — one line to wire a "type → dropdown → pick → filter" search.
    var onPick = opts.onPick || function (it) {
      if (it && it.href) { window.location.href = it.href; return; }
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    // Word-start match on name OR sub OR _t (explicit text field + auto-expanded state name).
    var match = opts.match || function (it, q) {
      return wsMatch(it._n, q) || (it._s && wsMatch(it._s, q)) || (it._t && wsMatch(it._t, q));
    };

    items.forEach(buildFields);

    // Dropdown floats inside the input's wrapper (needs positioning context).
    var wrap = input.parentNode;
    if (wrap && getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    var dd = document.createElement('div');
    dd.className = 'sa-suggest';
    dd.hidden = true;
    (wrap || document.body).appendChild(dd);

    var active = -1, cur = [], justPicked = false;

    function hide() { dd.hidden = true; dd.innerHTML = ''; active = -1; }

    function render() {
      // A pick fires a native 'input' (to run the page filter); don't re-open on it.
      if (justPicked) { justPicked = false; hide(); return; }
      var q = (input.value || '').trim().toLowerCase();
      if (q.length < minChars) { hide(); return; }
      cur = items.filter(function (it) { return match(it, q); })
        .sort(function (a, b) {
          function sc(d) {
            if (d._n.indexOf(q) === 0) return 0;   // name starts with q
            if (wsMatch(d._n, q)) return 1;          // inner word of name starts with q
            return 2;                                  // match only in sub or text
          }
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
      justPicked = true;
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
      items.forEach(buildFields);
    } };
  }

  // Expose the US city→state map so pages can use it for sub-label display.
  window.TVESearch = { attach: attach, CITIES: _US_CITIES };
})();
