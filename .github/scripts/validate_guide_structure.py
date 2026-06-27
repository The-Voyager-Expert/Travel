#!/usr/bin/env python3
"""
validate_guide_structure.py — CI structural gate for shipped guide HTML.

Runs on every guide HTML that carries the <!-- validation: passed --> stamp.
Catches guides that were hand-stamped or stamped without running the full
local validate_itinerary.py. Blocks the deploy if any critical structural
failure is found.

Checks are intentionally a focused subset of validate_itinerary.py — the
ones that definitively signal wrong format or an unvalidated guide.

Added 2026-06-26.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT  = Path(__file__).resolve().parents[2]
GUIDES_DIR = REPO_ROOT / "Travel-Website" / "Guides"

# Machine-written stamps look like: <!-- validation: passed 2026-06-27 11:44 -->
# Hand-typed stamps omit the HH:MM time — this regex rejects them.
STAMP_RE   = re.compile(r"<!-- validation: passed \d{4}-\d{2}-\d{2} \d{2}:\d{2} -->")

FAIL = "❌"
OK   = "✅"


def _read(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def shipped_guides() -> list[tuple[str, Path]]:
    out = []
    if not GUIDES_DIR.exists():
        return out
    for folder in sorted(p for p in GUIDES_DIR.iterdir() if p.is_dir()):
        for html in folder.glob("*.html"):
            content = _read(html)
            if "<!-- validation: passed" in content:
                out.append((folder.name, html))
                break
    return out


def check_guide(name: str, path: Path) -> list[str]:
    html = _read(path)
    failures: list[str] = []

    # 0. Stamp must be machine-written: "<!-- validation: passed YYYY-MM-DD HH:MM -->"
    #    Hand-typed stamps (missing HH:MM) are rejected — they bypass validate_itinerary.py
    if not STAMP_RE.search(html):
        failures.append(
            'validation stamp is missing or hand-typed — must be '
            '"<!-- validation: passed YYYY-MM-DD HH:MM -->" (written by guide_tools.py ship only)'
        )
        # If stamp itself is fake, remaining checks are not meaningful — bail early
        return failures

    # 1. .stop-num must be "N." format, not "Stop N"
    if re.search(r'class="stop-num"[^>]*>\s*Stop\s+\d', html, re.IGNORECASE):
        failures.append('.stop-num uses "Stop N" format — must be "N." (digit + period)')

    # 3. No money figures in guide body
    # Strip script/style blocks before checking for money — avoids false positives
    # on CSS values and JS strings that happen to contain currency symbols.
    body_only = re.sub(r'<(script|style)\b[^>]*>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
    money = re.findall(r'(?<![a-zA-Z])[$€£¥₹]\s*\d', body_only)
    if money:
        failures.append(f"money figures found ({', '.join(set(money[:3]))}…) — zero prices in shipped guides")

    # 4. also-on-this-site block must exist
    if "<!-- also-on-this-site -->" not in html.lower():
        failures.append("missing <!-- also-on-this-site --> block")

    # 5. At least one day closer (→ hotel)
    if "→ hotel" not in html:
        failures.append("no '→ hotel' day-closer found — every day-block requires one")

    # 6. .extras-section divs must exist (guide has extras)
    if 'class="extras-section"' not in html:
        failures.append("no .extras-section divs found — guide is missing all extras sections")

    # 7. No <h2>/<h3> in guide body (wrong structure)
    if re.search(r"<h[23][\s>]", html, re.IGNORECASE):
        failures.append("bare <h2>/<h3> tags found — use .extras-title / .stop-name")

    # 8. data-updated attribute must be present on toolbar mount
    if not re.search(r'data-updated="\d{4}-\d{2}"', html):
        failures.append('toolbar mount missing data-updated="YYYY-MM" attribute')

    # 9. No Before-You-Go.html links (drift page — does not belong in guides)
    if "Before-You-Go.html" in html:
        failures.append("Before-You-Go.html link found — this page is drift, remove it")

    # 10. Stylesheet must be guide-style.css
    if "guide-style.css" not in html:
        failures.append("guide-style.css not linked — guide uses stale/wrong stylesheet")

    return failures


def main() -> int:
    guides = shipped_guides()
    if not guides:
        print("validate_guide_structure: no shipped guides found — nothing to check.")
        return 0

    total_failures = 0
    guide_failures: dict[str, list[str]] = {}

    for name, path in guides:
        fails = check_guide(name, path)
        if fails:
            guide_failures[name] = fails
            total_failures += len(fails)

    if not guide_failures:
        print(f"validate_guide_structure: OK — all {len(guides)} guides passed structural checks.")
        return 0

    print(f"::error::Deploy blocked — {len(guide_failures)} guide(s) failed structural checks:")
    for name, fails in guide_failures.items():
        print(f"\n  {name}:")
        for f in fails:
            print(f"    {FAIL} {f}")
    print(f"\n{total_failures} failure(s) across {len(guide_failures)} guide(s).")
    print("Run Brain/scripts/validate_itinerary.py locally and fix all failures before pushing.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
