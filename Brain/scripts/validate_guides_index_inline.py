#!/usr/bin/env python3
"""validate_guides_index_inline.py

FINAL GATE check: every dest-card in guides_index.html must have an entry in
all three inline JS data blocks used by the index page:

  • CLIMATE_INLINE  — monthly hi/lo temps displayed on the index weather filter
  • COST_DATA       — cost tier + currency shown on compare/filter cards
  • SAFETY_DATA     — safety level shown on compare/filter cards

The JS resolves a card's key as: folder name from href (via climateKey()), with
fallback to the display name (c.name).  This validator applies the same logic.

Exit 0 = all blocks cover all cards.
Exit 1 = one or more cards are missing from at least one block.

Added: 2026-06-15
"""

import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote

# ── paths ────────────────────────────────────────────────────────────────────
_HERE     = Path(__file__).parent
_WEB_ROOT = _HERE.parent.parent / "Travel-Website" / "Guides"
_IDX      = _WEB_ROOT / "guides_index.html"

def main() -> int:
    if not _IDX.exists():
        print(f"ERROR: guides_index.html not found at {_IDX}", file=sys.stderr)
        return 1

    html = _IDX.read_text(encoding="utf-8", errors="replace")

    # ── parse inline JS blocks ───────────────────────────────────────────────
    def _extract(var_name: str) -> dict:
        m = re.search(rf'var {re.escape(var_name)}\s*=\s*(\{{.*?\}})\s*;', html, re.DOTALL)
        if not m:
            return {}
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            return {}

    climate = _extract("CLIMATE_INLINE")
    cost    = _extract("COST_DATA")
    safety  = _extract("SAFETY_DATA")

    missing_blocks: list[str] = []
    if not climate: missing_blocks.append("CLIMATE_INLINE")
    if not cost:    missing_blocks.append("COST_DATA")
    if not safety:  missing_blocks.append("SAFETY_DATA")
    if missing_blocks:
        print(f"ERROR: could not parse block(s): {', '.join(missing_blocks)}", file=sys.stderr)
        return 1

    # ── parse dest-cards ─────────────────────────────────────────────────────
    # Match <a class="dest-card" ... href="..." ...><span class="dest-name">Name</span>
    cards = re.findall(
        r'<a class="dest-card"[^>]*href="([^"]+)"[^>]*>.*?<span class="dest-name">([^<]+)</span>',
        html, re.DOTALL
    )
    if not cards:
        print("ERROR: no dest-card entries found in guides_index.html", file=sys.stderr)
        return 1

    def _climate_key(href: str) -> str:
        """Mirror the JS climateKey() logic: folder name from href."""
        return unquote(href).lstrip("./").split("/")[0]

    # ── check each card ──────────────────────────────────────────────────────
    errors: list[str] = []
    for href, name in cards:
        key = _climate_key(href)
        # JS uses climateKey first, display name as fallback
        if key not in climate and name not in climate:
            errors.append(f"  CLIMATE_INLINE missing {name!r} (folder key={key!r})")
        if key not in cost and name not in cost:
            errors.append(f"  COST_DATA      missing {name!r} (folder key={key!r})")
        if key not in safety and name not in safety:
            errors.append(f"  SAFETY_DATA    missing {name!r} (folder key={key!r})")

    # ── report ───────────────────────────────────────────────────────────────
    if errors:
        print(f"FAIL: {len(errors)} missing inline data entr{'y' if len(errors)==1 else 'ies'} in guides_index.html:")
        for e in errors:
            print(e)
        print()
        print("Fix: add the missing entry/entries to the relevant var block in guides_index.html.")
        print("  CLIMATE_INLINE — monthly hi/lo 12-value arrays (copy from assets/climate.json)")
        print("  COST_DATA      — {\"tier\": \"...\", \"currency\": \"...\"}")
        print("  SAFETY_DATA    — {\"level\": \"...\", \"note\": \"...\"}")
        return 1

    print(f"OK: CLIMATE_INLINE, COST_DATA, SAFETY_DATA all cover {len(cards)} cards.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
