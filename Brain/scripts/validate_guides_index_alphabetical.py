#!/usr/bin/env python3
"""validate_guides_index_alphabetical.py

Validator: guides in Guides-Index.html must be listed alphabetically by:
  1. Country (alphabetically)
  2. Within each country, guide names (alphabetically)

Exit 0 = all guides are correctly ordered.
Exit 1 = ordering violations found.

Added: 2026-06-26
"""

import re
import sys
import unicodedata
from pathlib import Path

# ── paths ────────────────────────────────────────────────────────────────────
_HERE     = Path(__file__).parent
_WEB_ROOT = _HERE.parent.parent / "Travel-Website" / "Guides"
_IDX      = _WEB_ROOT / "Guides-Index.html"

def _sort_key(s: str) -> str:
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()


def main() -> int:
    if not _IDX.exists():
        print(f"ERROR: Guides-Index.html not found at {_IDX}", file=sys.stderr)
        return 1

    html = _IDX.read_text(encoding="utf-8", errors="replace")

    # ── parse country blocks and guides ──────────────────────────────────────
    countries_in_order = []
    guides_per_country = {}

    for m in re.finditer(
        r'<div class="country" data-country="([^"]+)">(.*?)(?=<div class="country"|$)',
        html, re.DOTALL
    ):
        country_code = m.group(1)
        block_content = m.group(2)
        countries_in_order.append(country_code)
        guide_names = re.findall(
            r'<span class="dest-name">([^<]+)</span>',
            block_content
        )
        guides_per_country[country_code] = guide_names

    if not countries_in_order:
        print("ERROR: no country blocks found in Guides-Index.html", file=sys.stderr)
        return 1

    # ── check country alphabetical order ─────────────────────────────────────
    errors = []

    # Exclude non-country structural blocks (sidebar, special collections)
    NON_COUNTRY_BLOCKS = {"specialized-trips", "caribbean-islands"}
    sortable_countries = [c for c in countries_in_order if c not in NON_COUNTRY_BLOCKS]

    sorted_countries = sorted(sortable_countries, key=_sort_key)
    if sortable_countries != sorted_countries:
        print("FAIL: Countries are not in alphabetical order.")
        print("\nExpected order:")
        for i, country in enumerate(sorted_countries, 1):
            print(f"  {i:2d}. {country}")
        print("\nActual order:")
        for i, country in enumerate(sortable_countries, 1):
            marker = " " if country == sorted_countries[i-1] else "❌"
            print(f"  {i:2d}. {country} {marker}")
        errors.append("Country ordering")

    # ── check guide alphabetical order within each country ──────────────────
    for country in countries_in_order:
        guides = guides_per_country[country]
        sorted_guides = sorted(guides, key=_sort_key)

        if guides != sorted_guides:
            print(f"\nFAIL: Guides in {country} are not in alphabetical order.")
            print("\nExpected order:")
            for i, guide in enumerate(sorted_guides, 1):
                print(f"  {i:2d}. {guide}")
            print("\nActual order:")
            for i, guide in enumerate(guides, 1):
                marker = " " if guide == sorted_guides[i-1] else "❌"
                print(f"  {i:2d}. {guide} {marker}")
            errors.append(f"Guide ordering in {country}")

    # ── report ───────────────────────────────────────────────────────────────
    if errors:
        print("\n" + "="*70)
        print(f"FAIL: {len(errors)} ordering violation(s) found:")
        for error in errors:
            print(f"  • {error}")
        print("\nFix: Ensure countries and guides are listed alphabetically in")
        print("Guides-Index.html. Move any mis-ordered entries to the correct position.")
        return 1

    print(f"OK: Countries and guides are in correct alphabetical order.")
    print(f"    {len(countries_in_order)} countries")
    total_guides = sum(len(g) for g in guides_per_country.values())
    print(f"    {total_guides} guides total")
    return 0


if __name__ == "__main__":
    sys.exit(main())
