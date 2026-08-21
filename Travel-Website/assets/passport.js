/* ══ TVE.passport — the reader's PASSPORT, one setting for the whole site ══

   Owner, 2026-08-20, pointing at the Compare table's "NEEDS VISA / US citizen"
   row: "Nothing can be in relation to US anymore. This is an international
   site. work on visa, entry etc make sure the information is equally for all
   countries in the world."

   Every visa surface answered for one passport. Compare said "US citizen" in
   as many words; /essentials/visa/, /entry/, /visa-times/ and /nomad-visas/
   were written as "what a US passport holder needs"; Before You Go stamped its
   badge from a US-only table. A reader in Sao Paulo was shown Washington's
   answer with no way to say otherwise — the Forty-seventh non-negotiable's
   defect exactly, in a second dimension nobody had looked at.

   THERE IS NO DEFAULT PASSPORT, AND THAT IS NOT THE SAME DECISION AS TVE.home.
   The home-airport module names ROUTINGS_FROM because the site genuinely holds
   measured routings for one airport and estimates for the rest — an asymmetry
   in the data itself. Here there is none: assets/visa-matrix.json holds all 199
   passports at identical quality, so no passport is the "real" one and none may
   stand in for the reader. get() returns null until they say. A surface with no
   passport chosen shows a CONTROL, never a claim, and never a row of dashes —
   placeholders in a comparison table read as missing data about the
   destinations, which is the wrong thing to say about a question nobody asked
   yet.

   Nothing is remembered on the reader's behalf either, beyond the choice they
   made: no device-locale guess, no Accept-Language sniff. A locale is not a
   citizenship — plenty of en-US browsers belong to people carrying something
   else — and guessing here is the same error as guessing a home city, with a
   worse failure mode, because the answer is about whether they are allowed on
   the plane.

   WHAT THE ANSWER IS, AND WHAT IT IS NOT. The matrix is a dated snapshot of the
   Wikipedia "Visa requirements for X citizens" articles, rebuilt by
   Brain/scripts/build/build_visa_matrix.py and stamped with the source's own
   date. Every surface that renders a cell prints that date and links the
   destination's official portal. It is good enough to plan against and is never
   the authority to travel on; say so on the card, always. */
(function () {
  window.TVE = window.TVE || {};
  if (window.TVE.passport) return;

  var KEY = 'tve_passport';
  var subs = [];

  /* A pick lives here for the current page load and NOWHERE ELSE — no
     localStorage, no sessionStorage, no cookie. Reset to null on every fresh
     load, which is the whole point: nothing a reader picks on one visit is
     still there on the next. Exactly TVE.home's rule ("No filter saves
     anything, ever", commit 416458ab), and for the identical reason — a
     passport saved from a pick made days ago comes back as a preselected
     country by another name, which is the Melbourne bug on Time Zones
     (Thirty-first non-negotiable). Owner, 2026-08-21: "should not start with
     any country."

     The sessionStorage keys this module still uses ('tvepp', 'tvevm') cache
     the FETCHED DATA — the passport list and the visa matrix — and are not a
     pick. Caching a 97 KB asset is not remembering a choice. */
  var picked = null;

  /* An earlier version of this file DID persist the pick to localStorage;
     this purges whatever it left behind rather than ever reading it back. A
     stray value from before this change must not quietly resurrect itself as
     a passport the current visit never chose. */
  try { localStorage.removeItem(KEY); } catch (e) {}

  /* NULL until the reader picks THIS PAGE LOAD. Every caller checks; none
     substitutes a passport of its own, which is what a default here was. */
  function read() { return picked; }
  function get() { return picked; }
  function isSet() { return !!picked; }

  function set(p) {
    if (!p || !p.code) return null;
    var next = { code: String(p.code).toUpperCase(),
                 name: p.name || p.code, flag: p.flag || '' };
    picked = next;
    subs.forEach(function (fn) { try { fn(next); } catch (e) {} });
    return next;
  }

  function clear() {
    picked = null;
    subs.forEach(function (fn) { try { fn(null); } catch (e) {} });
    return null;
  }

  /* Accent-folded so "Cote" finds "Côte" and "Curacao" finds "Curaçao" — the
     reader is typing on a plain keyboard. Same helper, same reasoning as
     TVE.home.fold; duplicated rather than imported because this module must
     load and answer even if toolbar.js is still in flight. */
  function fold(s) {
    s = String(s || '');
    return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
                       : s.toLowerCase();
  }

  /* ── The two lists, fetched once ─────────────────────────────────────────
     passports.json is 12 KB and visa-matrix.json 97 KB. Neither is fetched on
     page load: the list arrives on the first keystroke of a picker, the matrix
     only when a passport has actually been chosen and there is a cell to
     render. sessionStorage is shared across pages, so a reader who has used one
     visa surface has already paid for the rest. */
  function loader(url, sessionKey) {
    var data = null, pending = null;
    return function (cb) {
      if (data) { setTimeout(function () { cb(data); }, 0); return; }
      if (pending) { pending.push(cb); return; }
      pending = [cb];
      function done(d) {
        data = d;
        var waiting = pending; pending = null;
        waiting.forEach(function (fn) { try { fn(d); } catch (e) {} });
      }
      try {
        var hit = sessionStorage.getItem(sessionKey);
        if (hit) { done(JSON.parse(hit)); return; }
      } catch (e) {}
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = 12000;
      xhr.onload = function () {
        if (xhr.status < 200 || xhr.status >= 300) { done(null); return; }
        try {
          try { sessionStorage.setItem(sessionKey, xhr.responseText); } catch (e) {}
          done(JSON.parse(xhr.responseText));
        } catch (e) { done(null); }
      };
      xhr.onerror = xhr.ontimeout = function () { done(null); };
      xhr.send();
    };
  }

  var _loadList   = loader('/assets/passports.json', 'tvepp');
  var _loadMatrix = loader('/assets/visa-matrix.json', 'tvevm');

  /* Both loaders record what they resolved, so a surface that has already
     awaited ready() can answer cell() synchronously inside a render loop. A
     comparison table builds its whole string in one pass; making it await a
     fetch per column would rebuild the page mid-scroll. */
  var _list = null, _mx = null;
  function loadList(cb)   { _loadList(function (l)   { _list = l || _list; cb(l); }); }
  function loadMatrix(cb) { _loadMatrix(function (m) { _mx   = m || _mx;   cb(m); }); }

  /* Fetch whatever this reader's state needs, then call back with whether an
     answer is now possible. With no passport set it resolves false WITHOUT
     fetching the 97 KB matrix — the commonest case costs nothing. */
  function ready(cb) {
    loadList(function (l) {
      indexNames(l);
      if (!read()) { cb(false); return; }
      loadMatrix(function (m) { cb(!!(m && m.p && m.p[read().code])); });
    });
  }

  /* The synchronous answer, valid only after ready() has called back true.
     Returns null for every reason a caller must not paper over: no passport,
     no matrix, a destination the axis does not carry. */
  function cell(destName) {
    var me = read();
    if (!me || !_mx || !_mx.p || !_mx.p[me.code]) return null;
    var d = iso(destName);
    if (!d) return null;
    var i = _mx.d.indexOf(d);
    if (i < 0) return null;
    var out = describe(_mx.p[me.code].split(',')[i]);
    if (out) {
      out.iso = d;
      out.territory = (_mx.territory || {})[d] || null;
      out.as_of = _mx.as_of;
      out.source = _mx.source;
    }
    return out;
  }

  function asOf() { return (_mx && _mx.as_of) || ''; }

  /* ── Destination name -> ISO-2 ───────────────────────────────────────────
     Pages know a country by the name they print. The matrix is keyed by ISO-2,
     so the join happens here, once, rather than in each page — a second copy of
     this table is how "Czechia" silently stops resolving on one surface and
     goes on working on the others. Folded name match first, then the aliases
     below for the spellings the site prefers over the source's. */
  var ALIAS = {
    'czech republic': 'CZ', 'czechia': 'CZ',
    'the bahamas': 'BS', 'bahamas': 'BS',
    'turkiye': 'TR', 'turkey': 'TR',
    'usa': 'US', 'united states of america': 'US', 'us': 'US',
    'uk': 'GB', 'great britain': 'GB', 'britain': 'GB',
    'uae': 'AE', 'emirates': 'AE',
    'south korea': 'KR', 'korea': 'KR', 'republic of korea': 'KR',
    'ivory coast': 'CI', "cote d'ivoire": 'CI',
    'cape verde': 'CV', 'cabo verde': 'CV',
    'swaziland': 'SZ', 'eswatini': 'SZ',
    'timor-leste': 'TL', 'east timor': 'TL',
    'vatican city': 'VA', 'vatican': 'VA', 'holy see': 'VA',
    'myanmar': 'MM', 'burma': 'MM',
    'macedonia': 'MK', 'north macedonia': 'MK',
    'dr congo': 'CD', 'democratic republic of the congo': 'CD',
    'republic of the congo': 'CG', 'congo': 'CG',
    'us virgin islands': 'VI', 'virgin islands': 'VI',
    'united states virgin islands': 'VI',
    'french polynesia': 'PF', 'tahiti': 'PF',
    'turks and caicos': 'TC', 'turks and caicos islands': 'TC',
    'cayman islands': 'KY', 'sint maarten': 'SX', 'st maarten': 'SX',
    'curacao': 'CW', 'aruba': 'AW', 'puerto rico': 'PR',
    'hong kong': 'HK', 'macao': 'MO', 'macau': 'MO',
    'laos': 'LA', 'brunei': 'BN', 'russia': 'RU', 'syria': 'SY',
    'bolivia': 'BO', 'venezuela': 'VE', 'tanzania': 'TZ',
    'moldova': 'MD', 'micronesia': 'FM', 'palestine': 'PS', 'iran': 'IR'
  };

  var byName = null;
  function indexNames(list) {
    if (byName || !list) return;
    byName = {};
    (list.d || []).concat(list.p || []).forEach(function (r) {
      byName[fold(r[1])] = r[0];
    });
  }

  /* Synchronous once the list has been fetched; null before that, and callers
     treat null as "not answerable yet" rather than as "no such country". */
  function iso(name) {
    if (!name) return null;
    var f = fold(name).trim();
    if (ALIAS[f]) return ALIAS[f];
    return (byName && byName[f]) || null;
  }

  /* ── The requirement, and what it means in words ─────────────────────────
     One vocabulary for the whole site. A page never invents its own wording for
     a token: a reader who learns "Authorization" on Compare has to meet the
     same word on the Visas page, or they will read it as a different rule. */
  var WORD = {
    H: ['No',            'Domestic travel',                          'good'],
    F: ['No',            'Visa-free',                                'good'],
    A: ['On arrival',    'Visa issued on arrival',                   'warn'],
    T: ['Authorization', 'Travel authorization before you board',    'warn'],
    E: ['eVisa',         'Apply online before you travel',           'warn'],
    V: ['Yes',           'Visa required in advance',                 'bad'],
    N: ['No entry',      'Entry not currently permitted',            'bad']
  };

  function describe(token) {
    if (!token) return null;
    if (/^\d+$/.test(token)) {
      return { answer: 'No', label: 'Visa-free · ' + token + ' days',
               tone: 'good', token: token };
    }
    var w = WORD[token];
    if (!w) return null;
    return { answer: w[0], label: w[1], tone: w[2], token: token };
  }

  /* The reader's requirement for one destination, as a described object.
     Calls back with null when there is no passport set, no matrix, or the
     destination is not on the axis — three different reasons a surface must
     not paper over with a dash that looks like data. */
  function requirement(destName, cb) {
    var me = read();
    if (!me) { cb(null, { why: 'no-passport' }); return; }
    loadList(function (list) {
      indexNames(list);
      var d = iso(destName);
      if (!d) { cb(null, { why: 'unknown-destination' }); return; }
      loadMatrix(function (m) {
        if (!m || !m.p || !m.p[me.code]) { cb(null, { why: 'no-data' }); return; }
        var i = m.d.indexOf(d);
        if (i < 0) { cb(null, { why: 'unknown-destination' }); return; }
        var out = describe(m.p[me.code].split(',')[i]);
        cb(out, { iso: d, as_of: m.as_of, source: m.source,
                  territory: (m.territory || {})[d] || null, passport: me });
      });
    });
  }

  /* Ranked so the obvious answer is first — an exact code, then a name that
     starts with the query, then one that contains it. "in" must find India
     before Ukraine, and does only because prefix beats contains. */
  function lookup(q, rows, limit) {
    q = fold(q).trim();
    if (!q || !rows) return [];
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], code = fold(r[0]), name = fold(r[1]), rank = -1;
      if (code === q) rank = 0;
      else if (name.indexOf(q) === 0) rank = 1;
      else if (name.indexOf(q) > 0) rank = 2;
      if (rank >= 0) out.push([rank, r]);
    }
    out.sort(function (a, b) {
      return a[0] - b[0] || (a[1][1] < b[1][1] ? -1 : 1);
    });
    return out.slice(0, limit || 8).map(function (x) { return x[1]; });
  }

  /* ── The picker, mounted the same way on every surface ───────────────────
     One implementation, so the control a reader learns on Compare is the
     control they meet on the Visas page. The button IS the label: it names the
     passport in force, which is the Forty-seventh non-negotiable's rule that a
     default is never silent — here extended to "an absence is never silent
     either", since the unset state has to read as a question. */
  function mount(host, opts) {
    if (!host) return null;
    opts = opts || {};
    host.innerHTML = '';
    host.className = (host.className ? host.className + ' ' : '') + 'pp-mount';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pp-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');

    var pop = document.createElement('div');
    pop.className = 'pp-pop';
    pop.hidden = true;

    var field = document.createElement('input');
    field.type = 'search';
    field.className = 'pp-search';
    field.placeholder = 'Country or code';
    field.setAttribute('aria-label', 'Search for your passport');

    var list = document.createElement('ul');
    list.className = 'pp-list';
    list.setAttribute('role', 'listbox');

    pop.appendChild(field);
    pop.appendChild(list);
    host.appendChild(btn);
    host.appendChild(pop);

    function paintBtn() {
      var me = read();
      btn.innerHTML = '';
      var t = document.createElement('span');
      t.className = 'pp-btn-text';
      t.textContent = me ? (me.flag ? me.flag + ' ' : '') + me.name + ' passport'
                         : (opts.prompt || 'Choose your passport');
      btn.appendChild(t);
      var c = document.createElement('span');
      c.className = 'pp-chev';
      c.textContent = '▾';
      btn.appendChild(c);
      btn.classList.toggle('pp-unset', !me);
    }

    function rows(cb) { loadList(function (l) { indexNames(l); cb((l && l.p) || []); }); }

    function paintList(q) {
      rows(function (all) {
        var picked = read();
        var show = q ? lookup(q, all, 10) : all.slice(0, 10);
        list.innerHTML = '';
        show.forEach(function (r) {
          var li = document.createElement('li');
          li.className = 'pp-opt';
          li.setAttribute('role', 'option');
          li.tabIndex = 0;
          li.textContent = (r[2] ? r[2] + '  ' : '') + r[1];
          if (picked && picked.code === r[0]) li.classList.add('pp-on');
          function choose() {
            set({ code: r[0], name: r[1], flag: r[2] });
            close();
            paintBtn();
            if (opts.onPick) opts.onPick(read());
          }
          li.addEventListener('click', choose);
          li.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); }
          });
          list.appendChild(li);
        });
        if (!show.length) {
          var li = document.createElement('li');
          li.className = 'pp-empty';
          li.textContent = 'No passport matches that.';
          list.appendChild(li);
        }
      });
    }

    function open() {
      pop.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      field.value = '';
      paintList('');
      /* Focus after paint: on iOS focusing a hidden field is a no-op, and the
         keyboard then never appears for the one control the panel exists for. */
      setTimeout(function () { field.focus(); }, 0);
    }
    function close() {
      pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }

    btn.addEventListener('click', function () { pop.hidden ? open() : close(); });
    field.addEventListener('input', function () { paintList(field.value); });
    field.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { close(); btn.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (!host.contains(e.target)) close();
    });

    paintBtn();
    subs.push(paintBtn);
    return { repaint: paintBtn, open: open, close: close };
  }

  window.TVE.passport = {
    KEY: KEY,
    get: get, set: set, clear: clear, isSet: isSet,
    fold: fold, iso: iso, lookup: lookup,
    list: loadList, matrix: loadMatrix, ready: ready, cell: cell, asOf: asOf,
    describe: describe, requirement: requirement, mount: mount,
    onChange: function (fn) { if (typeof fn === 'function') subs.push(fn); }
  };
}());
