/* Best-Of Features: continent filter · sort · favorites · star ratings · compare
   Applies to all individual Best-Of showcase pages and the Best-Of Index.
   2026-08-03 */
(function () {
  'use strict';

  /* ── Continent mapping ── */
  var CM = {
    Africa:   ['Botswana','Cameroon','Democratic Republic of Congo','DR Congo','Djibouti','Egypt',
                'Ethiopia','Gabon','Ghana','Ivory Coast','Kenya','Lesotho','Libya','Madagascar',
                'Malawi','Malawi / Mozambique / Tanzania','Mauritius','Morocco','Mozambique','Namibia',
                'Nigeria','Rwanda','Rwanda / DR Congo','Senegal','Seychelles','Sierra Leone',
                'South Africa','Tanzania','Togo','Tunisia','Uganda','Uganda / Tanzania / Kenya',
                'Zambia','Zambia / Zimbabwe','Zimbabwe'],
    Americas: ['Anguilla','Antigua','Antigua and Barbuda','Argentina','Argentina / Brazil','Aruba',
                'Bahamas','Barbados','Belize','Bolivia','Brazil','British Virgin Islands','Canada',
                'Caribbean Netherlands','Cayman Islands','Chile','Colombia','Costa Rica','Cuba',
                'Curaçao','Curacao','Dominica','Dominican Republic','Ecuador','El Salvador',
                'Falkland Islands','Guatemala','Haiti','Honduras','Jamaica','Mexico','Nicaragua',
                'Panama','Peru','Peru / Bolivia','Puerto Rico','Saint Barthélemy','Saint Lucia',
                'Sint Maarten','Trinidad and Tobago','Turks and Caicos','United States',
                'United States Virgin Islands','Venezuela','Virgin Islands'],
    Asia:     ['Afghanistan','Azerbaijan','Bahrain','Bangladesh','Bhutan','Cambodia','China',
                'Hong Kong','India','Indonesia','Iran','Iraq','Israel','Japan','Jerusalem','Jordan',
                'Kazakhstan','Kyrgyzstan','Laos','Malaysia','Maldives','Mongolia','Myanmar','Nepal',
                'Oman','Pakistan','Palestine','Philippines','Qatar','Saudi Arabia','Singapore',
                'South Korea','Sri Lanka','Syria','Taiwan','Tajikistan','Thailand','Turkey',
                'Turkmenistan','United Arab Emirates','Uzbekistan','Vietnam','Yemen'],
    Europe:   ['Albania','Austria','Belgium','Bosnia and Herzegovina','Bulgaria','Croatia','Cyprus',
                'Czech Republic','Czechia','Denmark','Estonia','Finland','France','Georgia',
                'Germany','Greece','Hungary','Iceland','Ireland','Italy','Kosovo','Latvia',
                'Lithuania','Luxembourg','Malta','Montenegro','Netherlands','North Macedonia / Albania',
                'Norway','Poland','Portugal','Romania','Russia','Serbia','Slovakia','Slovenia',
                'Spain','Sweden','Switzerland','United Kingdom','Vatican City'],
    Oceania:  ['Australia','Fiji','French Polynesia','Hawaii','Micronesia','New Zealand','Palau',
                'Papua New Guinea','Samoa','Tonga','Vanuatu']
  };
  var COUNTRY_C = {};
  Object.keys(CM).forEach(function (c) { CM[c].forEach(function (k) { COUNTRY_C[k] = c; }); });
  var CONT_ORDER = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];

  function getContinent(label) {
    var l = (label || '').trim();
    if (COUNTRY_C[l]) return COUNTRY_C[l];
    for (var k in COUNTRY_C) {
      if (Object.prototype.hasOwnProperty.call(COUNTRY_C, k) && l.indexOf(k) === 0) return COUNTRY_C[k];
    }
    return null;
  }

  /* ── localStorage helpers ── */
  var FAV_KEY  = 'tve_bo_favs_'  + location.pathname;
  var RATE_KEY = 'tve_bo_rates_' + location.pathname;
  function lsGet(key)    { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) { return []; } }
  function lsGetObj(key) { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch(e) { return {}; } }
  function lsSet(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch(e) {} }
  function isFav(id)     { return lsGet(FAV_KEY).indexOf(id) !== -1; }
  function toggleFav(id) { var a = lsGet(FAV_KEY); var i = a.indexOf(id); if (i !== -1) a.splice(i,1); else a.push(id); lsSet(FAV_KEY, a); return a.indexOf(id) !== -1; }
  function getRating(id) { return lsGetObj(RATE_KEY)[id] || 0; }
  function setRating(id, r) { var m = lsGetObj(RATE_KEY); m[id] = r; lsSet(RATE_KEY, m); }

  /* ── DOM helper ── */
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }

  /* ── Compare state ── */
  var compareIds = [];
  var compareBarEl, compareNamesEl, compareModalEl, compareModalGrid;

  /* ════════════════════════════════════════════════
     SHOWCASE PAGES (individual Best-Of pages)
  ════════════════════════════════════════════════ */
  var grid = document.querySelector('.showcase-grid');
  if (grid) { initShowcase(); return; }

  /* ── Best-Of Index sort ── */
  var indexGrid = document.querySelector('.best-of-grid');
  if (indexGrid) { initIndex(); }
  return;

  /* ─────────────────────────────────────────────
     SHOWCASE INIT
  ───────────────────────────────────────────── */
  function initShowcase() {
    var sections = collectSections();
    injectToolbar(sections);
    sections.forEach(function (sec) {
      sec.cards.forEach(function (card) { augmentCard(card, sec.label, sec.continent); });
    });
    document.body.appendChild(buildCompareBar());
    document.body.appendChild(buildCompareModal());
  }

  /* Collect [{label, labelEl, continent, cards[]}] in DOM order */
  function collectSections() {
    var result = [], cur = null;
    [].slice.call(grid.children).forEach(function (node) {
      if (node.classList.contains('best-of-section-label') &&
          !node.classList.contains('best-of-subsection-label')) {
        cur = { label: node.textContent.trim(), labelEl: node,
                continent: getContinent(node.textContent.trim()), cards: [] };
        result.push(cur);
      } else if (node.classList.contains('showcase-card')) {
        if (!cur) { cur = { label: '', labelEl: null, continent: null, cards: [] }; result.push(cur); }
        cur.cards.push(node);
      }
    });
    return result;
  }

  function cardId(card) {
    var n = card.querySelector('.showcase-name');
    return n ? n.textContent.trim() : '';
  }

  /* ── Filter state ── */
  var activeCont   = null;
  var activeSort   = 'default';
  var showFavsOnly = false;
  var regionJumpEl = document.getElementById('regionJump');

  /* ── Toolbar ── */
  function injectToolbar(sections) {
    var toolbar = el('div', 'bo-feat-toolbar');

    /* Continent chips (only if ≥2 continents on this page) */
    var pageContinents = {};
    sections.forEach(function (s) { if (s.continent) pageContinents[s.continent] = true; });
    var presentConts = CONT_ORDER.filter(function (c) { return pageContinents[c]; });
    if (presentConts.length > 1) {
      var chips = el('div', 'bo-continent-chips');
      var allChip = el('span', 'bo-chip bo-active', 'All');
      allChip.dataset.cont = '';
      chips.appendChild(allChip);
      presentConts.forEach(function (c) {
        var chip = el('span', 'bo-chip', c);
        chip.dataset.cont = c;
        chips.appendChild(chip);
      });
      chips.addEventListener('click', function (e) {
        var t = e.target.closest ? e.target.closest('.bo-chip') : null;
        if (!t) return;
        activeCont = t.dataset.cont || null;
        [].slice.call(chips.children).forEach(function (c) { c.classList.toggle('bo-active', c === t); });
        if (window._regionJumpReset) window._regionJumpReset();
        if (regionJumpEl) regionJumpEl.style.display = '';
        applyFilters(sections);
      });
      toolbar.appendChild(chips);
    }

    /* Controls row: sort dropdown + favs pill */
    var row = el('div', 'bo-controls-row');

    /* Sort dropdown — same days-jump pill pattern as Filter by country */
    var SORT_OPTS = [['default','Sort: Default'],['az','A → Z'],['za','Z → A'],['country','By country']];
    var sortJump = el('div', 'days-jump');
    var sortLblSpan = el('span', '', 'Sort: Default');
    var sortToggle = document.createElement('button');
    sortToggle.type = 'button';
    sortToggle.className = 'days-jump-toggle disc-btn';
    sortToggle.setAttribute('aria-expanded', 'false');
    sortToggle.appendChild(sortLblSpan);
    sortToggle.appendChild(el('span', 'disc-caret chev', '▾'));
    var sortList = el('div', 'days-jump-list');
    sortList.setAttribute('role', 'menu');
    SORT_OPTS.forEach(function (o) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'days-jump-item' + (o[0] === 'default' ? ' on' : '');
      item.textContent = o[1];
      item.addEventListener('click', function () {
        activeSort = o[0];
        sortLblSpan.textContent = o[1];
        [].slice.call(sortList.children).forEach(function (c) { c.classList.toggle('on', c === item); });
        sortToggle.classList.toggle('has-active', o[0] !== 'default');
        sortJump.classList.remove('open');
        sortToggle.setAttribute('aria-expanded', 'false');
        var nonDefault = activeSort !== 'default';
        if (nonDefault && window._regionJumpReset) window._regionJumpReset();
        if (regionJumpEl) regionJumpEl.style.display = nonDefault ? 'none' : '';
        applyFilters(sections);
      });
      sortList.appendChild(item);
    });
    sortToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var nowOpen = !sortJump.classList.contains('open');
      sortJump.classList.toggle('open', nowOpen);
      sortToggle.setAttribute('aria-expanded', String(nowOpen));
    });
    document.addEventListener('click', function (e) {
      if (!sortJump.contains(e.target)) {
        sortJump.classList.remove('open');
        sortToggle.setAttribute('aria-expanded', 'false');
      }
    });
    sortJump.appendChild(sortToggle);
    sortJump.appendChild(sortList);
    row.appendChild(sortJump);

    var favPill = el('span', 'bo-favs-pill', '♡ Saved');
    favPill.addEventListener('click', function () {
      showFavsOnly = !showFavsOnly;
      favPill.classList.toggle('bo-active', showFavsOnly);
      favPill.textContent = showFavsOnly ? '♥ Saved' : '♡ Saved';
      applyFilters(sections);
    });
    row.appendChild(favPill);
    toolbar.appendChild(row);

    /* Insert after existing controls wrapper (regionJump parent) or before grid */
    var anchor = regionJumpEl ? regionJumpEl.parentNode : null;
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(toolbar, anchor.nextSibling);
    } else {
      grid.parentNode.insertBefore(toolbar, grid);
    }
  }

  /* ── Apply filters + sort ── */
  function applyFilters(sections) {
    /* Step 1: determine which sections pass the continent filter */
    var contVisible = sections.filter(function (s) {
      return !activeCont || s.continent === activeCont;
    });

    if (activeSort === 'az' || activeSort === 'za') {
      /* Global sort: collect cards from visible sections, sort by name */
      var all = [];
      contVisible.forEach(function (s) {
        s.cards.forEach(function (c) {
          if (!showFavsOnly || isFav(cardId(c))) all.push(c);
        });
      });
      all.sort(function (a, b) {
        var cmp = cardId(a).localeCompare(cardId(b));
        return activeSort === 'za' ? -cmp : cmp;
      });
      /* Hide everything, then append sorted cards */
      sections.forEach(function (s) {
        if (s.labelEl) s.labelEl.style.display = 'none';
        s.cards.forEach(function (c) { c.style.display = 'none'; });
      });
      all.forEach(function (c) { grid.appendChild(c); c.style.display = ''; });
      updateNoFavs(!all.length);
      return;
    }

    if (activeSort === 'country') {
      /* Sort section groups alphabetically by country label */
      var sorted = contVisible.slice().sort(function (a, b) { return a.label.localeCompare(b.label); });
      sections.forEach(function (s) {
        if (s.labelEl) s.labelEl.style.display = 'none';
        s.cards.forEach(function (c) { c.style.display = 'none'; });
      });
      var anyFav = false;
      sorted.forEach(function (s) {
        var visCards = s.cards.filter(function (c) { return !showFavsOnly || isFav(cardId(c)); });
        if (!visCards.length) return;
        anyFav = true;
        if (s.labelEl) { grid.appendChild(s.labelEl); s.labelEl.style.display = ''; }
        visCards.forEach(function (c) { grid.appendChild(c); c.style.display = ''; });
      });
      updateNoFavs(showFavsOnly && !anyFav);
      return;
    }

    /* Default: restore original DOM order */
    sections.forEach(function (s) {
      if (s.labelEl) grid.appendChild(s.labelEl);
      s.cards.forEach(function (c) { grid.appendChild(c); });
    });
    var anyVisible = false;
    sections.forEach(function (s) {
      var inCont = contVisible.indexOf(s) !== -1;
      var hasCards = inCont && s.cards.some(function (c) { return !showFavsOnly || isFav(cardId(c)); });
      if (hasCards) anyVisible = true;
      if (s.labelEl) s.labelEl.style.display = hasCards ? '' : 'none';
      s.cards.forEach(function (c) {
        c.style.display = (inCont && (!showFavsOnly || isFav(cardId(c)))) ? '' : 'none';
      });
    });
    updateNoFavs(showFavsOnly && !anyVisible);
  }

  /* ── No-favs message ── */
  var noFavsEl;
  function ensureNoFavs() {
    if (noFavsEl) return;
    noFavsEl = el('div', 'bo-no-favs', 'No saved places yet — click ♡ on a card to save it.');
    noFavsEl.style.display = 'none';
    grid.appendChild(noFavsEl);
  }
  function updateNoFavs(show) {
    ensureNoFavs();
    noFavsEl.style.display = show ? '' : 'none';
  }

  /* ── Augment each card with overlay + stars ── */
  function augmentCard(card, sectionLabel, continent) {
    var id = cardId(card);
    if (!id) return;
    card.dataset.boId = id;

    /* Action overlay (top-right of photo area) */
    var overlay = el('div', 'bo-card-overlay');

    var favBtn = el('button', 'bo-fav-btn', isFav(id) ? '♥' : '♡');
    favBtn.title = 'Save to favorites';
    if (isFav(id)) favBtn.classList.add('bo-active');
    favBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var active = toggleFav(id);
      favBtn.textContent = active ? '♥' : '♡';
      favBtn.classList.toggle('bo-active', active);
    });
    overlay.appendChild(favBtn);

    var cmpBtn = el('button', 'bo-cmp-btn', '⊞');
    cmpBtn.title = 'Add to compare';
    cmpBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var idx = compareIds.indexOf(id);
      if (idx !== -1) {
        compareIds.splice(idx, 1);
        cmpBtn.classList.remove('bo-active');
        cmpBtn.title = 'Add to compare';
      } else if (compareIds.length < 3) {
        compareIds.push(id);
        cmpBtn.classList.add('bo-active');
        cmpBtn.title = 'Remove from compare';
      }
      updateCompareBar();
    });
    overlay.appendChild(cmpBtn);
    card.appendChild(overlay);

    /* Star rating (inserted after showcase-name) */
    var nameEl = card.querySelector('.showcase-name');
    if (nameEl) {
      var starsRow = el('div', 'bo-stars');
      var curR = getRating(id);
      for (var n = 1; n <= 5; n++) {
        (function (starEl, num) {
          starEl.textContent = '★';
          if (num <= curR) starEl.classList.add('bo-active');
          starEl.addEventListener('mouseenter', function () {
            [].slice.call(starsRow.children).forEach(function (s, i) { s.classList.toggle('bo-active', i < num); });
          });
          starEl.addEventListener('mouseleave', function () {
            var r = getRating(id);
            [].slice.call(starsRow.children).forEach(function (s, i) { s.classList.toggle('bo-active', i < r); });
          });
          starEl.addEventListener('click', function (e) {
            e.stopPropagation();
            var newR = (getRating(id) === num) ? 0 : num;
            setRating(id, newR);
            [].slice.call(starsRow.children).forEach(function (s, i) { s.classList.toggle('bo-active', i < newR); });
          });
          starsRow.appendChild(starEl);
        })(el('span', 'bo-star'), n);
      }
      nameEl.parentNode.insertBefore(starsRow, nameEl.nextSibling);
    }
  }

  /* ── Compare bar ── */
  function buildCompareBar() {
    var bar = el('div', 'bo-compare-bar');
    bar.appendChild(el('span', 'bo-compare-label', 'Compare:'));
    compareNamesEl = el('div', 'bo-compare-names');
    bar.appendChild(compareNamesEl);
    var goBtn = el('button', 'bo-compare-go', 'Compare');
    goBtn.addEventListener('click', openCompareModal);
    var clrBtn = el('button', 'bo-compare-clr', 'Clear');
    clrBtn.addEventListener('click', function () {
      compareIds = [];
      document.querySelectorAll('.bo-cmp-btn.bo-active').forEach(function (b) {
        b.classList.remove('bo-active'); b.title = 'Add to compare';
      });
      updateCompareBar();
    });
    bar.appendChild(goBtn);
    bar.appendChild(clrBtn);
    compareBarEl = bar;
    return bar;
  }

  function updateCompareBar() {
    if (!compareBarEl) return;
    compareBarEl.classList.toggle('bo-show', compareIds.length > 0);
    if (compareNamesEl) {
      compareNamesEl.innerHTML = '';
      compareIds.forEach(function (id) {
        compareNamesEl.appendChild(el('span', 'bo-compare-name-tag', id));
      });
    }
  }

  /* ── Compare modal ── */
  function buildCompareModal() {
    var modal = el('div', 'bo-modal');
    var bg = el('div', 'bo-modal-bg');
    bg.addEventListener('click', closeCompareModal);
    var box = el('div', 'bo-modal-box');
    var hdr = el('div', 'bo-modal-hdr');
    hdr.appendChild(el('span', 'bo-modal-title', 'Compare'));
    var cls = el('button', 'bo-modal-cls', '×');
    cls.addEventListener('click', closeCompareModal);
    hdr.appendChild(cls);
    compareModalGrid = el('div', 'bo-modal-grid');
    box.appendChild(hdr);
    box.appendChild(compareModalGrid);
    modal.appendChild(bg);
    modal.appendChild(box);
    compareModalEl = modal;
    return modal;
  }

  function openCompareModal() {
    if (!compareModalEl || !compareIds.length) return;
    compareModalGrid.innerHTML = '';
    compareIds.forEach(function (id) {
      var card = null;
      document.querySelectorAll('.showcase-card[data-bo-id]').forEach(function (c) {
        if (c.dataset.boId === id) card = c;
      });
      if (!card) return;
      var col = el('div', 'bo-compare-col');

      var img = card.querySelector('.showcase-photo img');
      if (img) {
        var ci = document.createElement('img');
        ci.src = img.src; ci.alt = img.alt;
        ci.className = 'bo-compare-col-photo';
        col.appendChild(ci);
      }

      col.appendChild(el('div', 'bo-compare-col-name', (card.querySelector('.showcase-name') || {}).textContent || id));
      var tag = (card.querySelector('.showcase-tag') || {}).textContent || '';
      if (tag) col.appendChild(el('div', 'bo-compare-col-tag', tag));

      var r = getRating(id);
      var colStars = el('div', 'bo-compare-col-stars');
      for (var i = 1; i <= 5; i++) {
        var s = el('span', 'bo-compare-col-star', '★');
        if (i <= r) s.classList.add('bo-active');
        colStars.appendChild(s);
      }
      col.appendChild(colStars);

      var desc = (card.querySelector('.showcase-desc') || {}).textContent || '';
      if (desc) col.appendChild(el('div', 'bo-compare-col-desc', desc));

      var linksEl = card.querySelector('.showcase-links');
      if (linksEl) {
        var clLinks = el('div', 'bo-compare-col-links');
        [].slice.call(linksEl.querySelectorAll('a')).forEach(function (a) {
          var lnk = document.createElement('a');
          lnk.href = a.href; lnk.target = '_blank'; lnk.rel = 'noopener';
          lnk.textContent = a.textContent.replace(/\s*›$/, '').trim();
          clLinks.appendChild(lnk);
        });
        col.appendChild(clLinks);
      }

      compareModalGrid.appendChild(col);
    });

    compareModalEl.classList.add('bo-open');
    document.body.style.overflow = 'hidden';
  }

  function closeCompareModal() {
    if (compareModalEl) compareModalEl.classList.remove('bo-open');
    document.body.style.overflow = '';
  }

  /* ════════════════════════════════════════════════
     BEST-OF INDEX PAGE
  ════════════════════════════════════════════════ */
  function initIndex() {
    var cards = [].slice.call(indexGrid.querySelectorAll('.best-of-card'));
    if (cards.length < 2) return;
    var origOrder = cards.slice();

    var sortSel = document.createElement('select');
    sortSel.className = 'bo-sort-select';
    [['default','Sort: Default'],['az','A → Z'],['za','Z → A'],
     ['most','Most entries'],['least','Fewest entries']].forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o[0]; opt.textContent = o[1];
      sortSel.appendChild(opt);
    });

    sortSel.addEventListener('change', function () {
      var val = this.value;
      function getName(c) { var n = c.querySelector('.best-of-name'); return n ? n.textContent.trim() : ''; }
      function getCount(c) { var t = c.querySelector('.best-of-tag'); return t ? (parseInt(t.textContent) || 0) : 0; }
      var list = (val === 'default') ? origOrder.slice() : cards.slice();
      if (val === 'az')    list.sort(function (a,b) { return getName(a).localeCompare(getName(b)); });
      if (val === 'za')    list.sort(function (a,b) { return getName(b).localeCompare(getName(a)); });
      if (val === 'most')  list.sort(function (a,b) { return getCount(b) - getCount(a); });
      if (val === 'least') list.sort(function (a,b) { return getCount(a) - getCount(b); });
      list.forEach(function (c) { indexGrid.appendChild(c); });
    });

    var wrap = document.createElement('div');
    wrap.style.cssText = 'text-align:center;margin:6px 0 12px';
    wrap.appendChild(sortSel);
    var search = document.querySelector('.search-box, .search-wrap');
    if (search && search.parentNode) {
      search.parentNode.insertBefore(wrap, search.nextSibling);
    } else {
      indexGrid.parentNode.insertBefore(wrap, indexGrid);
    }
  }

}());
