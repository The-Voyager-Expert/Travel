/* airlines.js — the render behind the seven continent airline pages.
   Each page ships its own AIRLINES array and this draws it: alliance chips, the
   search, country groups, and one card per carrier carrying its own site, its
   reviews and its safety rating. Split out of essentials/airlines/index.html
   when that page became one page per continent (owner 2026-08-17), so the seven
   pages share one copy of the behaviour instead of seven. */
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function tagsHTML(a) {
  var out = '';
  var al = ALLIANCES[a.al] || ALLIANCES['Independent'];
  out += '<span class="card-tag ' + al.cls + '">' + al.label + '</span>';
  (a.t || []).forEach(function(k) {
    var ty = TYPES[k];
    if (ty) out += '<span class="card-tag ' + ty.cls + '">' + ty.label + '</span>';
  });
  return out;
}

/* Reviews and safety rating for THIS carrier, from its own airlineratings.com
   page. A carrier with no rv has no page there, so it gets neither link rather
   than a guessed URL that 404s. Both open in a new tab like every other
   external link on the page. */
function reviewLinks(a) {
  if (!a.rv) return '';
  var base = 'https://www.airlineratings.com/airlines/' + a.rv;
  return '<a href="' + base + '/reviews" target="_blank" rel="noopener" class="book-link">Reviews</a>' +
         '<a href="' + base + '/safety" target="_blank" rel="noopener" class="book-link">Safety rating</a>';
}

function cardHTML(a) {
  var host = a.w.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return '' +
  '<div class="al-card">' +
    '<div class="card-top">' +
      '<div class="card-flag">' + a.f + '</div>' +
      '<div class="card-meta">' +
        '<div class="card-name"><a href="' + a.w + '" target="_blank" rel="noopener">' + esc(a.n) + '</a></div>' +
        '<div class="card-tags">' + tagsHTML(a) + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="card-body">' +
      '<div class="card-desc">' + esc(a.d) + '</div>' +
      '<div class="info-rows">' +
        '<div class="info-row"><div class="info-content">' +
          '<span class="info-label">Headquarters</span>' + esc(a.hq) + '</div></div>' +
        '<div class="info-row"><div class="info-content">' +
          '<span class="info-label">Main hubs</span>' + esc(a.hub) + '</div></div>' +
        '<div class="info-row"><div class="info-content">' +
          '<span class="info-label">Fleet</span>' + esc(a.fl) + '</div></div>' +
        '<div class="info-row"><div class="info-content">' +
          '<span class="info-label">Known for</span>' + esc(a.k) + '</div></div>' +
      '</div>' +
      '<div class="booking-section">' +
        '<span class="booking-label">Links</span>' +
        '<div class="booking-links">' +
          '<a href="' + a.w + '" target="_blank" rel="noopener" class="book-link">' + esc(host) + '</a>' +
          reviewLinks(a) +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

var alAlliance = 'All';

function matches(a) {
  if (alAlliance !== 'All' && a.al !== alAlliance) return false;
  var q = (document.getElementById('al-search').value || '').trim().toLowerCase();
  if (!q) return true;
  return [a.n, a.c, a.hq, a.hub, a.al, a.d, a.k].join(' ').toLowerCase().indexOf(q) !== -1;
}

function render() {
  var res = document.getElementById('al-results');
  var cnt = document.getElementById('al-count');
  var list = AIRLINES.filter(matches);
  var q = (document.getElementById('al-search').value || '').trim();
  var noResults = list.length === 0;

  // No-results state: only the title, the search box and the message remain.
  // (This also used to hide #also-on-this-site; the strip was retired site-wide
  //  on 2026-08-17 and there is nothing left below the results to hide.)
  document.getElementById('al-alliance-filters').style.display = noResults ? 'none' : '';

  if (noResults) {
    cnt.textContent = '';
    res.innerHTML = '<div class="empty-state">No airline matches “' + esc(q) + '”.</div>';
    return;
  }

  cnt.innerHTML = '<strong>' + list.length + '</strong> airline' + (list.length === 1 ? '' : 's')
                + ' · <strong>' + new Set(list.map(function(a) { return a.c; })).size + '</strong> countries';

  /* One continent per page, so countries are the only grouping left. */
  var html = '';
  var countries = Array.from(new Set(list.map(function(a) { return a.c; })))
                       .sort(function(x, y) { return x.localeCompare(y); });
  countries.forEach(function(country) {
    var cards = list.filter(function(a) { return a.c === country; })
                    .sort(function(x, y) { return x.n.localeCompare(y.n); });
    html += '<div class="al-country"><div class="al-country-head">' + cards[0].f + ' ' + esc(country) + '</div>'
          + '<div class="al-grid">' + cards.map(cardHTML).join('') + '</div></div>';
  });
  res.innerHTML = html;
}

function buildChips(mountId, values, current, setter) {
  var mount = document.getElementById(mountId);
  mount.innerHTML = '';
  values.forEach(function(v) {
    var b = document.createElement('button');
    b.className = 'filter-btn' + (v.key === current() ? ' active' : '');
    var n = v.key === 'All' ? AIRLINES.length : AIRLINES.filter(v.test).length;
    b.innerHTML = esc(v.label) + ' <span class="al-chip-n">' + n + '</span>';
    b.onclick = function() {
      setter(v.key);
      document.getElementById('al-search').value = '';
      buildAllChips();
      render();
    };
    mount.appendChild(b);
  });
}

function buildAllChips() {
  buildChips('al-alliance-filters',
    [{ key:'All', label:'All alliances', test:function() { return true; } }].concat(
      Object.keys(ALLIANCES).map(function(k) {
        return { key:k, label:ALLIANCES[k].label, test:function(a) { return a.al === k; } };
      })),
    function() { return alAlliance; },
    function(v) { alAlliance = v; });
}

var alInput = document.getElementById('al-search');

function runQuery(q) {
  alInput.value = q;
  alAlliance = 'All';
  buildAllChips();
  render();
}

alInput.addEventListener('input', function() { runQuery(alInput.value); });

/* Shared typeahead — every search box on the site uses TVESearch (Toolbar.html
   § TVESearch). Items are the airlines themselves plus the countries they fly
   from, so a reader typing "Qatar" is offered both the airline and the country. */
if (window.TVESearch) {
  var seen = {};
  var items = AIRLINES.map(function(a) { return { name: a.n, sub: a.c }; });
  AIRLINES.forEach(function(a) {
    if (!seen[a.c]) { seen[a.c] = 1; items.push({ name: a.c, sub: a.r }); }
  });
  TVESearch.attach(alInput, { items: items, onPick: function(it) { runQuery(it.name); } });
}

buildAllChips();
render();
