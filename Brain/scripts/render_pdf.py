#!/usr/bin/env python3
"""
render_pdf.py — render a dev guide to PDF for phone reading.

The canonical "read on my phone" format for Dani. PDFs render identically in
every viewer (Drive preview, Files, Books, Mail, Messages), survive every
sharing path without rewriting, and work offline.

Why this exists: HTML-on-mobile is a minefield. Drive's in-app HTML viewer
paginates like a PDF. Apple Notes strips CSS. Messages previews strip layout.
iOS Safari renders HTML correctly, but only after a multi-step dance (open in
Drive → ⋯ → Open in Browser, or Save to Files → Files → tap → Safari). That
dance was the friction that killed the previous workflow.

PDFs bypass the whole dance. Tap a .pdf anywhere on iOS and it just renders,
every time.

How it works:
- Launches headless Chromium via Playwright.
- Navigates to the DEV artifact (the one with relative paths intact) via a
  file:// URL, so `../../Brain/Reference/Guide Style.css` and `assets/*.jpg` resolve.
- Sets the viewport to 500px wide — this fires the `@media (max-width: 600px)`
  block in guide_v3.css, so the PDF inherits the mobile-readable font sizes
  (17px body / 19px stop names / 20px section titles) rather than the desktop
  baseline (15px body).
- Waits for network idle so every <img> finishes loading before print.
- Emits PDF at 5.5" × 11" — narrow enough to read on an iPhone at fit-to-width
  with no pinch-zoom, tall enough to fit most day-blocks on one page.
- Writes `{city}_v{n}.pdf` next to the source HTML.

Input:
  path to a dev guide (Travel/Travel-Website/Guides/{City}/{city}_v{n}.html)

Output:
  sibling file named {city}_v{n}.pdf, in the same folder.

Usage:
  python3 render_pdf.py <guide.html>
  python3 render_pdf.py <guide.html> --verbose

Exit codes:
  0 — PDF written successfully
  1 — rendering failed (browser error, missing file, etc.)
  2 — usage error
  3 — validate_itinerary.py reported failures; PDF intentionally NOT written

Ship-gate wiring: this script refuses to emit a PDF if validate_itinerary.py
reports any hard failures. The validator runs FIRST (before Chromium launches)
so broken guides cost nothing and can never produce a PDF artifact. There is
no override flag — fix the validator complaint, then re-run. This closes the
"skip validate and ship anyway" hole. Warnings are non-blocking; only hard
failures (validator `check()` calls returning False) gate the PDF.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow sibling-module import when render_pdf is invoked from anywhere.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import validate_itinerary  # noqa: E402  (sibling tool in Brain/)

# Page dimensions — iPhone-friendly portrait.
PAGE_WIDTH_IN = "5.5in"
PAGE_HEIGHT_IN = "11in"

# Viewport — 500px fires the @media (max-width: 600px) block in guide_v3.css,
# so fonts render at mobile-readable sizes in the PDF.
VIEWPORT_WIDTH = 500
VIEWPORT_HEIGHT = 1100

# Margins — CSS handles the visual padding inside cards; the PDF page margin
# should be minimal so nothing clips.
MARGIN = "0.25in"


def _die(msg: str, code: int = 2) -> None:
    print(f"render_pdf: {msg}", file=sys.stderr)
    sys.exit(code)


def render(src: Path, verbose: bool = False) -> int:
    if not src.exists():
        _die(f"input file not found: {src}", code=1)
    if src.suffix.lower() != ".html":
        _die(f"expected a .html file, got: {src.name}")
    if src.stem.endswith("_share"):
        _die(
            f"'{src.name}' looks like a share artifact — render from the dev "
            "artifact instead (the one without the _share suffix). The dev "
            "file's relative paths resolve; the share file has already been "
            "inlined and base64-encoded."
        )

    # ─── Ship-gate: validate_itinerary.py must pass before Chromium launches.
    # Reset the validator's global results list in case this process re-runs
    # the validator (e.g. test harness). Then call validate() directly and
    # refuse to render if any hard failures are reported. No override flag.
    print(f"━━━ ship-gate: validate_itinerary.py ━━━")
    html_text = src.read_text(encoding="utf-8")
    validate_itinerary.results.clear()
    validator_ok = validate_itinerary.validate(html_text, str(src))
    if not validator_ok:
        _die(
            "validate_itinerary.py reported failures — PDF NOT written. "
            "Fix the failing checks above and re-run.",
            code=3,
        )

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        _die(
            "playwright not installed. Install with:\n"
            "  pip install playwright --break-system-packages\n"
            "  playwright install chromium",
            code=1,
        )

    out = src.parent / f"{src.stem}.pdf"
    file_url = src.resolve().as_uri()

    if verbose:
        print(f"render_pdf: loading {file_url}")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            context = browser.new_context(
                viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
                device_scale_factor=2,  # retina-quality photos in the PDF
            )
            page = context.new_page()
            # Navigate and wait for everything (images, fonts) to settle.
            page.goto(file_url, wait_until="networkidle", timeout=60_000)
            # Belt-and-suspenders: explicitly wait for every <img> to finish
            # decoding. networkidle covers network-load but image decode can
            # trail it on a cold cache.
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
            page.emulate_media(media="screen")  # use @media screen rules, not @media print
            page.pdf(
                path=str(out),
                width=PAGE_WIDTH_IN,
                height=PAGE_HEIGHT_IN,
                margin={"top": MARGIN, "right": MARGIN, "bottom": MARGIN, "left": MARGIN},
                print_background=True,  # render colored backgrounds (title page, banners)
                prefer_css_page_size=False,
            )
            browser.close()
    except Exception as e:  # noqa: BLE001
        _die(f"rendering failed: {e!r}", code=1)

    size_mb = out.stat().st_size / (1024 * 1024)
    print(f"━━━ render_pdf ━━━")
    print(f"  source:  {src}")
    print(f"  output:  {out}")
    print(f"  size:    {size_mb:.2f} MB")
    print(f"  page:    {PAGE_WIDTH_IN} × {PAGE_HEIGHT_IN} (viewport {VIEWPORT_WIDTH}px — fires mobile CSS)")
    return 0


def main(argv: list[str]) -> int:
    verbose = "--verbose" in argv or "-v" in argv
    positional = [a for a in argv if not a.startswith("-")]
    if len(positional) != 1:
        _die("usage: render_pdf.py <guide.html>")
    return render(Path(positional[0]).resolve(), verbose=verbose)


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except KeyboardInterrupt:
        print("\nrender_pdf: interrupted", file=sys.stderr)
        sys.exit(1)
