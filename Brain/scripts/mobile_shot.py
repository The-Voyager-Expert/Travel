#!/usr/bin/env python3
"""mobile_shot.py — true mobile-viewport screenshot + horizontal-overflow report.

Renders a local page (or URL) at a real phone viewport using Playwright's
device emulation — NOT headless --window-size, which silently clamps to ~500px
and crops the image, making fine pages look broken.

  python3 Brain/scripts/mobile_shot.py <path-or-url> [out.png] [width]

Defaults: width 390 (iPhone 14-class), out=/tmp/mobile_shot.png.
Prints a JSON line: viewport width, document scroll width, and every element
whose box extends past the viewport (the real cause of sideways scroll).
Exit 1 if overflow is detected, so it can gate a ship step.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.exit("playwright not installed:\n"
             "  pip install playwright --break-system-packages\n"
             "  python3 -m playwright install chromium")

OVERFLOW_JS = """() => {
  const vw = document.documentElement.clientWidth;
  const off = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.right > vw + 1 || r.left < -1) {
      off.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().trim().slice(0, 60),
        w: Math.round(r.width),
        right: Math.round(r.right),
      });
    }
  });
  return { vw, docScrollW: document.documentElement.scrollWidth, offenders: off.slice(0, 30) };
}"""


def main() -> int:
    if len(sys.argv) < 2:
        return print(__doc__) or 2
    target = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "/tmp/mobile_shot.png"
    width = int(sys.argv[3]) if len(sys.argv) > 3 else 390

    if "://" not in target:
        target = Path(target).resolve().as_uri()

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": width, "height": 844},
            device_scale_factor=3,
            is_mobile=True,
            has_touch=True,
            user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
                        "Mobile/15E148 Safari/604.1"),
        )
        page = ctx.new_page()
        page.goto(target, wait_until="networkidle")
        page.wait_for_timeout(400)
        report = page.evaluate(OVERFLOW_JS)
        page.screenshot(path=out, full_page=False)
        browser.close()

    print(json.dumps(report))
    if report["offenders"]:
        print(f"⚠️  {len(report['offenders'])} element(s) overflow {report['vw']}px "
              f"(docScrollW={report['docScrollW']}) — see {out}", file=sys.stderr)
        return 1
    print(f"✓ no horizontal overflow at {report['vw']}px → {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
