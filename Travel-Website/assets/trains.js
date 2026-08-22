/* ══════════════════════════════════════════════════════════════════════════
   trains.js — behaviour for the continent train guides.

   Five pages ride this file: /essentials/european-trains/, /asian-trains/,
   /americas-trains/, /african-trains/, /oceania-trains/. Extracted from
   european-trains' two inline <script> blocks on 2026-08-17, when the guide
   was divided by continent (owner rule) — the alternative was the same 150
   lines pasted into four more pages, where a fix to one would silently miss
   the others.

   Nothing here is continent-specific. Every behaviour is driven off classes
   the markup already carries, so a new continent page needs no JS of its own:

     .train-card[data-type]   type filtering + free-text search
     .country-section         a jump-nav pill, an id, and scroll-spy
     .multi-section           same, for the cross-border groupings
     .purpose-section         same — the transport-or-the-trip groups on the
                              three small pages (no jump pill; they have no nav)
     .rail-band               the opening band; static, nothing attaches to it
     .route-item              city names linkified to their guide
     #train-search            the search box, wired to TVESearch when present

   LOAD IT LAST, after search-autocomplete.js — the TVESearch typeahead is
   attached at the bottom of this file and needs window.TVESearch to exist.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  var activeType = 'all';
  var searchEl = document.getElementById('train-search');
  var countEl = document.getElementById('train-count');
  var noRes = document.getElementById('train-noresult');
  var nav = document.getElementById('jump-nav');

  // ---- Assign section ids + build the jump nav ----
  var sections = [];
  var pills = {};
  [].forEach.call(document.querySelectorAll('.multi-section'), function (m, i) {
    if (!m.id) m.id = 'sec-multi' + (i || '');
    sections.push(m);
  });
  /* .purpose-section — the transport-or-the-trip grouping that replaced the
     8-pill type filter on the three small pages (owner rule 2026-08-22:
     "each of them needs to be re thought"). It is registered here for one
     reason: applyFilters() hides a SECTION whose cards are all filtered out,
     and a group left out of `sections` keeps its heading on screen above an
     empty space during a search. No jump pill is built for these — the three
     pages that carry them have no jump nav. */
  [].forEach.call(document.querySelectorAll('.purpose-section'), function (s, i) {
    if (!s.id) {
      var h = s.querySelector('.purpose-header h2');
      var base = (h ? h.textContent : 'group-' + i).trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      s.id = 'sec-' + base;
    }
    sections.push(s);
  });
  [].forEach.call(document.querySelectorAll('.country-section'), function (s) {
    if (!s.id) {
      var nm = s.querySelector('.country-name');
      var base = (s.getAttribute('data-country') || (nm ? nm.textContent : '')).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      s.id = 'sec-' + base;
    }
    sections.push(s);
  });
  if (nav) {
    sections.forEach(function (s) {
      var nm = s.querySelector('.country-name,.multi-header');
      var label = nm ? nm.textContent.trim() : s.id;
      if (s.id === 'sec-multi') label = 'Multi-country';
      if (s.id === 'sec-scenic') label = 'Scenic';
      // A page may override a pill's wording without changing its heading.
      if (s.getAttribute('data-jump-label')) label = s.getAttribute('data-jump-label');
      var a = document.createElement('a');
      a.className = 'jump-btn'; a.href = '#' + s.id; a.textContent = label;
      a.addEventListener('click', function (e) { e.preventDefault(); s.scrollIntoView({ behavior: 'smooth' }); history.replaceState(null, '', '#' + s.id); });
      nav.appendChild(a);
      pills[s.id] = a;
    });
  }

  // ---- Filtering ----
  function applyFilters() {
    var q = searchEl ? searchEl.value.toLowerCase().trim() : '';
    var shown = 0;
    document.querySelectorAll('.train-card').forEach(function (card) {
      var typeMatch = activeType === 'all' || (card.dataset.type || '').includes(activeType);
      var hay = card.textContent.toLowerCase().replace(/\buk\b/g, 'uk united kingdom').replace(/\busa\b/g, 'usa united states').replace(/\buae\b/g, 'uae united arab emirates');
      var textMatch = !q || hay.includes(q);
      if (typeMatch && textMatch) { card.classList.remove('hidden'); shown++; }
      else { card.classList.add('hidden'); }
    });
    sections.forEach(function (section) {
      var visible = section.querySelectorAll('.train-card:not(.hidden)').length;
      section.style.display = visible === 0 ? 'none' : '';
      var p = pills[section.id]; if (p) p.style.display = visible === 0 ? 'none' : '';
    });
    var agg = document.querySelector('.aggregators-section');
    var ctrl = document.querySelector('.controls');
    var foot = document.querySelector('.tb-footnote');
    if (agg) agg.style.display = q ? 'none' : '';
    if (foot) foot.style.display = q ? 'none' : '';
    if (ctrl) ctrl.style.display = q ? 'none' : '';
    if (nav) nav.style.display = q ? 'none' : '';
    if (noRes) noRes.style.display = (shown === 0 && q) ? 'block' : 'none';
    var filtering = !!q || activeType !== 'all';
    if (countEl) countEl.textContent = filtering ? (shown + (shown === 1 ? ' operator' : ' operators')) : '';
  }

  if (searchEl) { searchEl.addEventListener('input', applyFilters); searchEl.addEventListener('search', applyFilters); }

  // ---- City guide links inside route-item text nodes ----
  // Curated, not generated from the guides folder: a slug like `bend`,
  // `columbia`, `napa`, `victoria` or `split` is an ordinary English word or an
  // ambiguous place, and linkifying it inside a route line produces nonsense.
  // Only names that read unambiguously as the city are listed. `san-jose` is
  // deliberately absent — two guides answer to it.
  (function () {
    var GUIDES = {
      // Europe
      "aix-en-provence": "/guides/aix-en-provence.html", "alesund": "/guides/alesund.html", "amalfi": "/guides/amalfi.html",
      "amsterdam": "/guides/amsterdam.html", "annecy": "/guides/annecy.html", "athens": "/guides/athens.html",
      "barcelona": "/guides/barcelona.html", "bergen": "/guides/bergen.html", "berlin": "/guides/berlin.html",
      "bologna": "/guides/bologna.html", "bordeaux": "/guides/bordeaux.html", "brussels": "/guides/brussels.html",
      "budapest": "/guides/budapest.html", "cannes": "/guides/cannes.html", "colmar": "/guides/colmar.html",
      "cologne": "/guides/cologne.html", "copenhagen": "/guides/copenhagen.html", "dubrovnik": "/guides/dubrovnik.html",
      "edinburgh": "/guides/edinburgh.html", "florence": "/guides/florence.html", "frankfurt": "/guides/frankfurt.html",
      "geneva": "/guides/geneva.html", "glasgow": "/guides/glasgow.html", "gothenburg": "/guides/gothenburg.html",
      "hamburg": "/guides/hamburg.html", "helsinki": "/guides/helsinki.html", "istanbul": "/guides/istanbul.html",
      "krakow": "/guides/krakow.html", "lille": "/guides/lille.html", "lisbon": "/guides/lisbon.html",
      "ljubljana": "/guides/ljubljana.html", "london": "/guides/london.html", "lucerne": "/guides/lucerne.html",
      "luxembourg": "/guides/luxembourg.html", "lyon": "/guides/lyon.html", "malaga": "/guides/malaga.html",
      "marseille": "/guides/marseille.html", "milan": "/guides/milan.html", "monaco": "/guides/monaco.html",
      "munich": "/guides/munich.html", "naples": "/guides/naples.html", "nice": "/guides/nice.html",
      "oslo": "/guides/oslo.html", "oxford": "/guides/oxford.html", "paris": "/guides/paris.html",
      "pisa": "/guides/pisa.html", "porto": "/guides/porto.html", "prague": "/guides/prague.html",
      "rome": "/guides/rome.html", "rotterdam": "/guides/rotterdam.html", "salzburg": "/guides/salzburg.html",
      "san-sebastian": "/guides/san-sebastian.html", "seville": "/guides/seville.html", "siena": "/guides/siena.html",
      "split": "/guides/split.html", "stockholm": "/guides/stockholm.html", "strasbourg": "/guides/strasbourg.html",
      "stuttgart": "/guides/stuttgart.html", "tallinn": "/guides/tallinn.html", "tromso": "/guides/tromso.html",
      "turin": "/guides/turin.html", "venice": "/guides/venice.html", "verona": "/guides/verona.html",
      "vienna": "/guides/vienna.html", "zurich": "/guides/zurich.html",
      // Asia
      "abu-dhabi": "/guides/abu-dhabi.html", "bangkok": "/guides/bangkok.html", "beijing": "/guides/beijing.html",
      "busan": "/guides/busan.html", "chiang-mai": "/guides/chiang-mai.html", "chongqing": "/guides/chongqing.html",
      "colombo": "/guides/colombo.html", "doha": "/guides/doha.html", "dubai": "/guides/dubai.html",
      "hanoi": "/guides/hanoi.html", "hiroshima": "/guides/hiroshima.html", "hoi-an": "/guides/hoi-an.html",
      "hong-kong": "/guides/hong-kong.html", "kyoto": "/guides/kyoto.html", "luang-prabang": "/guides/luang-prabang.html",
      "muscat": "/guides/muscat.html", "osaka": "/guides/osaka.html", "seoul": "/guides/seoul.html",
      "shanghai": "/guides/shanghai.html", "singapore": "/guides/singapore.html", "taipei": "/guides/taipei.html",
      "tbilisi": "/guides/tbilisi.html", "tokyo": "/guides/tokyo.html", "zhangjiajie": "/guides/zhangjiajie.html",
      // Americas
      "atlanta": "/guides/atlanta.html", "austin": "/guides/austin.html", "banff": "/guides/banff.html",
      "boston": "/guides/boston.html", "buenos-aires": "/guides/buenos-aires.html", "charlotte": "/guides/charlotte.html",
      "chicago": "/guides/chicago.html", "curitiba": "/guides/curitiba.html", "cusco": "/guides/cusco.html",
      "dallas": "/guides/dallas.html", "denver": "/guides/denver.html", "foz-do-iguacu": "/guides/foz-do-iguacu.html",
      "las-vegas": "/guides/las-vegas.html", "lima": "/guides/lima.html", "los-angeles": "/guides/los-angeles.html",
      "machupicchu": "/guides/machupicchu.html", "miami": "/guides/miami.html", "montevideo": "/guides/montevideo.html",
      "montreal": "/guides/montreal.html", "nashville": "/guides/nashville.html", "new-orleans": "/guides/new-orleans.html",
      "new-york": "/guides/new-york.html", "oaxaca": "/guides/oaxaca.html", "orlando": "/guides/orlando.html",
      "philadelphia": "/guides/philadelphia.html", "phoenix": "/guides/phoenix.html", "portland": "/guides/portland.html",
      "quebec-city": "/guides/quebec-city.html", "rio-de-janeiro": "/guides/rio-de-janeiro.html",
      "san-diego": "/guides/san-diego.html", "san-francisco": "/guides/san-francisco.html", "santa-barbara": "/guides/santa-barbara.html",
      "santa-fe": "/guides/santa-fe.html", "santiago": "/guides/santiago.html", "sao-paulo": "/guides/sao-paulo.html",
      "seattle": "/guides/seattle.html", "toronto": "/guides/toronto.html", "vancouver": "/guides/vancouver.html",
      "washington-dc": "/guides/washington-dc.html", "whistler": "/guides/whistler.html",
      // Africa
      "cairo": "/guides/cairo.html", "cape-town": "/guides/cape-town.html", "marrakech": "/guides/marrakech.html",
      // Oceania
      "melbourne": "/guides/melbourne.html", "queenstown": "/guides/queenstown.html", "sydney": "/guides/sydney.html",
      "wellington": "/guides/wellington.html"
    };
    // display name → URL (slug to title-case)
    var nameMap = {};
    Object.keys(GUIDES).forEach(function (slug) {
      var display = slug.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      nameMap[display] = GUIDES[slug];
    });
    // A few names are written differently in route lines than their slug implies.
    nameMap['Washington DC'] = GUIDES['washington-dc'];
    nameMap['Machu Picchu'] = GUIDES['machupicchu'];
    nameMap['Hong Kong'] = GUIDES['hong-kong'];
    nameMap['Ho Chi Minh City'] = null; // no guide — listed so it is never half-matched on "Chi"
    Object.keys(nameMap).forEach(function (k) { if (!nameMap[k]) delete nameMap[k]; });
    // sort longest-first so multi-word names beat single-word substrings
    var names = Object.keys(nameMap).sort(function (a, b) { return b.length - a.length; });
    var escaped = names.map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    var re = new RegExp('\\b(' + escaped.join('|') + ')\\b', 'g');
    // inject subtle link style once
    var s = document.createElement('style');
    s.textContent = '.route-item a.city-link{color:var(--accent,#8a6c1a);text-decoration:none;}.route-item a.city-link:visited{color:#8a6c1a;}.route-item a.city-link:hover{text-decoration:none;}';
    document.head.appendChild(s);
    document.querySelectorAll('.route-item').forEach(function (el) {
      // walk text nodes only to avoid touching existing markup
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      var nodes = [];
      var n;
      while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(function (tn) {
        if (!re.test(tn.textContent)) return;
        re.lastIndex = 0;
        var span = document.createElement('span');
        span.innerHTML = tn.textContent.replace(re, function (m) {
          return '<a href="' + nameMap[m] + '" class="city-link">' + m + '</a>';
        });
        tn.parentNode.replaceChild(span, tn);
      });
    });
  })();

  // Global — called by the inline filter-button onclick handlers
  window.filterCards = function (type, btn) {
    activeType = type;
    document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    if (btn) { btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); }
    applyFilters();
  };

  /* The legend dot filters RETIRED 2026-08-22 with the legend itself — see
     trains.css. Nothing on any of the five pages carries [data-dfilt] now. */

  // ---- Scroll-spy — highlight the jump pill for the section in view ----
  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var id = en.target.id;
          Object.keys(pills).forEach(function (k) { pills[k].classList.toggle('active', k === id); });
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });
    sections.forEach(function (s) { obs.observe(s); });
  }
})();

/* ---- Typeahead ----
   Country rides in as `sub` so the search matches on country as well as
   operator, per the Thirty-first non-negotiable ("every search on the site
   matches on COUNTRY as well as city"). The routes list is deliberately NOT
   fed in: it holds dozens of city names and drowns short queries in matches. */
(function () {
  if (!window.TVESearch) return;
  var input = document.getElementById('train-search'); if (!input) return;
  var items = [];
  document.querySelectorAll('.train-card').forEach(function (card) {
    var nm = card.querySelector('.train-name');
    if (!nm) return;
    var name = nm.textContent.replace(/^[^A-Za-z0-9]+/, '').trim();
    var op = card.querySelector('.train-operator');
    var ctags = []; card.querySelectorAll('.ctag').forEach(function (t) { ctags.push(t.textContent.trim()); });
    var sub = ctags[0] || '';
    var tokens = [op ? op.textContent.trim() : ''].concat(ctags);
    if (name) items.push({ name: name, sub: sub, text: tokens.join(' ') });
  });
  TVESearch.attach(input, { items: items });
}());
