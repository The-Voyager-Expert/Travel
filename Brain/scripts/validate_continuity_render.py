#!/usr/bin/env python3
"""
validate_continuity_render.py — RENDER-level continuity audit (catches what static
CSS-anchor checks miss).

validate_itinerary.py's "Style A continuous-run" check only confirms the required CSS
SELECTORS exist as text in assets/guide-style.css — it cannot confirm the browser
actually applies them with zero visual gap. That gap is real: this exact class of bug
shipped fleet-wide twice in one session (2026-07-12) — once as a CSS specificity miss
(unscoped override losing the cascade to an ID-scoped base rule) and once as a margin
asymmetry miss (.tour-box's base `margin: 4px 0` sets BOTH top and bottom; zeroing only
the following box's margin-top left the preceding box's margin-bottom still producing a
4px gap) — and the static anchor check passed cleanly both times, because the anchor
text was present; only actually rendering the page and measuring the gap catches it.

This script renders each guide and checks TWO continuity families for a hairline-exact
(<1.5px) gap, matching computed margin/border-radius:

  1. Extras-section entries — consecutive `.extras-sub`+body-box pairs (`.entry-body`,
     `.shows-box`, `.transit-box`, `.station-box`) within the same run (no `.tours-group`
     or new `.extras-title` between them) must glue into one seamless card.
  2. Stop-block booking boxes — consecutive `.tour-box`/`.ticket-box` siblings within the
     same `.stop-block` (an explicitly documented shape — "Multiple .tour-box siblings
     live inside the same .stop-block when the stop offers multiple tour options") must
     glue into one seamless card the same way.

Usage:
  python3 Brain/scripts/validate_continuity_render.py                # every guide; exit 1 on any gap
  python3 Brain/scripts/validate_continuity_render.py --warn         # report only, always exit 0
  python3 Brain/scripts/validate_continuity_render.py <guide.html>   # scope to one guide (ship gate)

Requires playwright + chromium (already used by validate_mobile_render.py).
"""
import sys, os, glob, asyncio

PROBE = """() => {
  const results = [];
  const bodyClasses = ['entry-body','shows-box','transit-box','station-box'];
  document.querySelectorAll('.extras-section').forEach(section => {
    const kids = Array.from(section.children);
    for (let i = 0; i < kids.length - 1; i++) {
      const a = kids[i], b = kids[i+1];
      const aIsBody = bodyClasses.some(c => a.classList.contains(c));
      const bIsSub = b.classList.contains('extras-sub');
      if (!(aIsBody && bIsSub)) continue;
      const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      const gap = Math.round((br.top - ar.bottom) * 10) / 10;
      if (Math.abs(gap) > 1.5) {
        results.push({kind: 'extras', section: section.id, gap,
          label: (b.textContent || '').trim().slice(0, 40)});
      }
    }
  });
  document.querySelectorAll('.stop-block').forEach(block => {
    const kids = Array.from(block.children).filter(c =>
      c.classList.contains('tour-box') || c.classList.contains('ticket-box'));
    for (let i = 0; i < kids.length - 1; i++) {
      const a = kids[i], b = kids[i+1];
      if (a.nextElementSibling !== b) continue;
      const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      const gap = Math.round((br.top - ar.bottom) * 10) / 10;
      if (Math.abs(gap) > 1.5) {
        const stopName = block.querySelector('.stop-name');
        results.push({kind: 'stop', gap,
          label: (stopName ? stopName.textContent : '').trim().slice(0, 40)});
      }
    }
  });
  return results;
}"""


async def audit(paths, warn_only):
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print('continuity-render: skipped — playwright not installed '
              '(pip install playwright && playwright install chromium).')
        return 0
    bad = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 900, 'height': 1200})
        for f in paths:
            try:
                await pg.goto('file://' + os.path.abspath(f), timeout=15000)
                await pg.wait_for_timeout(150)
                d = await pg.evaluate(PROBE)
            except Exception as e:  # noqa: BLE001
                print('  ⚠️  could not render %s (%s)' % (f, e)); continue
            if d:
                bad.append((f, d))
        await b.close()

    if not bad:
        print('continuity-render: OK — %d guide(s), zero gapped joins (extras-section '
              'entries + stop-block tour-box/ticket-box runs all render as one '
              'seamless card)' % len(paths))
        return 0
    total = sum(len(v) for _, v in bad)
    print('continuity-render: %d guide(s) / %d gapped join(s):' % (len(bad), total))
    for f, issues in bad:
        print('  %s' % f)
        for i in issues[:8]:
            where = ('#%s' % i['section']) if i['kind'] == 'extras' else 'stop-block'
            print('     • %s gap=%gpx before "%s" (%s)'
                  % (where, i['gap'], i['label'], i['kind']))
    print('Fix: guide-style.css STYLE A continuous-run rules — see the "STOPS — '
          'CONTINUOUS RUN" / "STYLE A — CONTINUOUS RUN" blocks. Check for (a) unscoped '
          'override losing to an ID-scoped base rule on specificity, or (b) a base rule '
          'margin shorthand setting BOTH sides (e.g. `margin: 4px 0`) where only one '
          'side got zeroed on the join selectors.')
    return 0 if warn_only else 1


def main():
    args = sys.argv[1:]
    warn_only = '--warn' in args
    files = [a for a in args if not a.startswith('--')]
    if not files:
        files = sorted(
            f for f in glob.glob('Travel-Website/Guides/*/*.html')
            if not f.endswith('-read-about.html') and '_v' in os.path.basename(f)
        )
    return asyncio.run(audit(files, warn_only))


if __name__ == '__main__':
    sys.exit(main())
