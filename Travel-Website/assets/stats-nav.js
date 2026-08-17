/* stats-nav.js — marks the section you are reading in the stats jump strips.
 *
 * WHY THIS FILE EXISTS: `.stats-nav a.active` (the 7 regional stats pages) and
 * `.jump-pill.active` (Destination Records) have been styled since those pages
 * shipped — a tinted ground with a terracotta rim on desktop, and web-travel-style.css
 * lists `.stats-nav a.active` alongside `.nav-link.active` / `.pill.active` /
 * `.jump-btn.active` in its never-underline group, so a current-section state on a
 * nav pill is a site-wide convention. Nothing ever added the class. Every rule was
 * dead: the strip is sticky at the top of a page that scrolls through 19 ranked
 * sections and told the reader nothing about where they were.
 *
 * A colour audit finds the rules and reads them as live. A behaviour audit greps for
 * `classList.add('active')`, finds ten hits on these very pages — the country-chooser
 * box and the `.country-chip` row — and reads the state as implemented. Both pass.
 * That is why this is one shared file with the reason written down rather than a line
 * pasted into eight pages.
 *
 * Scope: only pages that carry one of those two strips; it exits immediately anywhere
 * else. Stats-Across-US is deliberately NOT covered — its `.section-nav` has only
 * :hover and :visited states, no .active rule to honour, and its own script already
 * owns those anchors (it expands a collapsed category before scrolling).
 */
(function () {
  'use strict';

  function init() {
    var links = [].slice.call(document.querySelectorAll(
      '.stats-nav a[href^="#"], .jump-nav a.jump-pill[href^="#"]'));
    if (!links.length) return;

    var pairs = [];
    for (var i = 0; i < links.length; i++) {
      var id = links[i].getAttribute('href').slice(1);
      var sec = id && document.getElementById(id);
      if (sec) pairs.push({ a: links[i], sec: sec });
    }
    if (!pairs.length) return;

    /* Sort by document position, never by the order the links happen to sit in.
       The strips are hand-maintained and a reordered pill would otherwise make
       "the last section whose top has passed" pick the wrong one. */
    pairs.sort(function (x, y) {
      var rel = x.sec.compareDocumentPosition(y.sec);
      if (rel & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (rel & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    var current = null;
    function mark(p) {
      if (p === current) return;
      if (current) current.a.classList.remove('active');
      if (p) p.a.classList.add('active');
      current = p;
    }

    /* The strip is sticky at the top on desktop (36px tall) and the sections already
       carry scroll-margin-top: 70px, so a section becomes current once its top has
       passed just under the strip. */
    var OFFSET = 88;

    function update() {
      var best = null;
      for (var j = 0; j < pairs.length; j++) {
        if (pairs[j].sec.getBoundingClientRect().top <= OFFSET) best = pairs[j];
      }
      /* best stays null above the first section, and that is deliberate: marking the
         first pill at the top of the page would claim a position the reader is not at
         yet — the same "nothing is selected until the reader picks" rule the search
         pages follow. */
      mark(best);
    }

    var queued = false;
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; update(); });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
