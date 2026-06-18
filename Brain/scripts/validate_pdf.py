#!/usr/bin/env python3
"""
validate_pdf.py — post-render gate for the phone-PDF pipeline.

Static HTML gates (`validate_itinerary.py`) cannot catch rendering bugs that
only surface under Chromium's flex/media-query layout. This script renders
the dev guide in headless Chromium at the same 500px viewport + @media
screen that `render_pdf.py` uses, then measures the computed layout and
fails the ship if anything would produce a broken PDF.

Why this exists — static HTML gates cannot catch rendering bugs that only
  surface under Chromium's flex layout. Example: `flex: 1 1 0%` inherited
  from the desktop rule silently suppresses an explicit `height` in the mobile
  column-flex container, so tall portrait images render at their natural aspect
  ratio (800-900px+) instead of the declared height — dominating the PDF page.
  The static gate passes because the CSS and HTML are both syntactically valid.
  Only a render-and-measure pass catches this class of bug.

Also guards against the page-break rule being moved back into `@media
print`: `render_pdf.py` calls `emulate_media(media="screen")`, so any
page-break-inside or break-inside rule scoped to `@media print` never
fires and stops orphan their photos onto the next page.

Checks:
  1. Every `.stop-photos img` renders at a height within [MIN_H, MAX_H].
     Outside that band → FAIL.
  2. Every `.stop-block` and `.stop-photos` has computed
     `break-inside: avoid`. Anything else → FAIL.
  3. The @media (max-width: 600px) block fires at the 500px viewport —
     belt-and-suspenders check so a future viewport tweak doesn't silently
     drop us onto desktop rules.

Exit codes:
  0 — all checks green. Safe to ship the PDF.
  1 — one or more checks FAILED. Don't ship.
  2 — usage error / rendering infra broken.

Usage:
  python3 validate_pdf.py <guide.html>
  python3 validate_pdf.py <guide.html> --verbose
"""
from __future__ import annotations

import sys
from pathlib import Path

# Photo height band — 290px is the prescribed mobile value (guide_v3.css
# §STOP PHOTOS). We allow a small tolerance for sub-pixel rounding.
MIN_PHOTO_H = 280
MAX_PHOTO_H = 305

# Same viewport as render_pdf.py — must stay in sync or the gate and the
# producer can disagree about what the PDF will look like.
VIEWPORT_WIDTH = 500
VIEWPORT_HEIGHT = 1100


def _die(msg: str, code: int = 2) -> None:
    print(f"validate_pdf: {msg}", file=sys.stderr)
    sys.exit(code)


def validate(src: Path, verbose: bool = False) -> int:
    if not src.exists():
        _die(f"input file not found: {src}", code=1)
    if src.suffix.lower() != ".html":
        _die(f"expected a .html file, got: {src.name}")
    if src.stem.endswith("_share"):
        _die(
            f"'{src.name}' is a share artifact — validate the dev artifact "
            "instead (the one without the _share suffix)."
        )

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        _die(
            "playwright not installed. Install with:\n"
            "  pip install playwright --break-system-packages\n"
            "  python3 -m playwright install chromium",
            code=2,
        )

    failures: list[str] = []
    passes: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
            device_scale_factor=2,
        )
        page = context.new_page()
        page.goto(src.resolve().as_uri(), wait_until="networkidle", timeout=60_000)
        page.evaluate(
            """
            async () => {
              const imgs = Array.from(document.images);
              await Promise.all(imgs.map(img =>
                img.complete ? Promise.resolve() :
                new Promise(r => { img.onload = r; img.onerror = r; })
              ));
            }
            """
        )
        page.emulate_media(media="screen")

        data = page.evaluate(
            """
            () => {
              const mq = window.matchMedia('(max-width: 600px)').matches;
              const photos = Array.from(document.querySelectorAll('.stop-photos img')).map(img => {
                const stop = img.closest('.stop-block');
                const name = stop?.querySelector('.stop-name')?.textContent?.trim() ?? '(no stop-name)';
                return {
                  stop: name,
                  src: img.getAttribute('src'),
                  h: Math.round(img.getBoundingClientRect().height),
                };
              });
              const stopBlockBI  = getComputedStyle(document.querySelector('.stop-block')).breakInside;
              const stopPhotosBI = getComputedStyle(document.querySelector('.stop-photos')).breakInside;
              return { mq, photos, stopBlockBI, stopPhotosBI };
            }
            """
        )
        browser.close()

    # ── Check 1: media query fires ──────────────────────────────────────────
    if data["mq"]:
        passes.append(f"@media (max-width: 600px) fires at {VIEWPORT_WIDTH}px viewport")
    else:
        failures.append(
            f"@media (max-width: 600px) does NOT fire at {VIEWPORT_WIDTH}px viewport — "
            "the mobile CSS is not being applied. Check viewport vs. breakpoint."
        )

    # ── Check 2: photo heights in band ──────────────────────────────────────
    out_of_band = [p for p in data["photos"] if p["h"] < MIN_PHOTO_H or p["h"] > MAX_PHOTO_H]
    if out_of_band:
        failures.append(
            f"{len(out_of_band)}/{len(data['photos'])} photos render outside "
            f"[{MIN_PHOTO_H}, {MAX_PHOTO_H}]px band:"
        )
        for p in out_of_band[:10]:
            failures.append(f"    {p['h']}px  {p['src']}  ({p['stop']})")
        if len(out_of_band) > 10:
            failures.append(f"    … and {len(out_of_band) - 10} more")
    else:
        passes.append(
            f"all {len(data['photos'])} photos render within "
            f"[{MIN_PHOTO_H}, {MAX_PHOTO_H}]px"
        )

    # ── Check 3: break-inside: avoid on stop-block + stop-photos ────────────
    if data["stopBlockBI"] == "avoid":
        passes.append(".stop-block → break-inside: avoid (computed)")
    else:
        failures.append(
            f".stop-block → break-inside: {data['stopBlockBI']!r} (expected 'avoid'). "
            "Stops will split across PDF pages and orphan their photos."
        )
    if data["stopPhotosBI"] == "avoid":
        passes.append(".stop-photos → break-inside: avoid (computed)")
    else:
        failures.append(
            f".stop-photos → break-inside: {data['stopPhotosBI']!r} (expected 'avoid'). "
            "Photo rows can split across PDF pages."
        )

    # ── Render ──────────────────────────────────────────────────────────────
    print("━━━ validate_pdf ━━━")
    if verbose:
        for line in passes:
            print(f"  ✓ {line}")
    for line in failures:
        print(f"  ✗ {line}")
    print(f"━━━ result: {len(passes)} ok · {len(failures)} fail ━━━")
    if failures:
        print(
            "\nPost-render gate FAILED. Don't ship the PDF until fixed.\n"
            "Common fixes: see guide_v3.css §STOP PHOTOS + §PAGE-BREAK CONTROL."
        )
        return 1
    print("\nPDF render will be clean.")
    return 0


def main(argv: list[str]) -> int:
    verbose = "--verbose" in argv or "-v" in argv
    positional = [a for a in argv if not a.startswith("-")]
    if len(positional) != 1:
        _die("usage: validate_pdf.py <guide.html>")
    return validate(Path(positional[0]).resolve(), verbose=verbose)


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except KeyboardInterrupt:
        print("\nvalidate_pdf: interrupted", file=sys.stderr)
        sys.exit(1)
