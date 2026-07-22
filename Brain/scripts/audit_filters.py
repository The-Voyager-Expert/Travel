#!/usr/bin/env python3
"""audit_filters.py — audit and fix all Guides-Index filter datasets.

Covers every filter chip visible on the index:
  • Trip Type       (THEME_DATA var)        → build_theme_tags.py --apply
  • Language        (data-lang attrs)       → build_lang_tags.py --apply
  • Trip Length     (DAYS_DATA var)         → build_days_data.py --apply
  • Continent       (inline CONTINENT map)  → auto-add missing country slugs
  • Flight Time     (FMAP var)              → report missing cards only (manual fix)
  • When & weather  (CLIMATE_INLINE)        → validate_guides_index_inline.py (report)

Usage:
  python3 Brain/scripts/audit_filters.py           # dry run — report all issues
  python3 Brain/scripts/audit_filters.py --apply   # fix what can be auto-fixed
  python3 Brain/scripts/audit_filters.py --apply --push  # fix + commit + push
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

HERE      = Path(__file__).resolve().parent
SCRIPTS   = HERE
ROOT      = HERE.parents[1]          # repo root
WEB_ROOT  = ROOT / "Travel-Website"
INDEX     = WEB_ROOT / "Guides-Index.html"

APPLY = "--apply" in sys.argv
PUSH  = "--push" in sys.argv

# ── Continent assignments for country slugs not yet in the inline CONTINENT map ──
# Only real country slugs here — UI-only slugs like 'also-on-site', 'specialized-trips'
# are intentionally excluded (they have no dest-cards and should not filter).
MISSING_CONTINENT_MAP: dict[str, str] = {
    "bhutan":           "Asia",
    "costa-rica":       "North America",   # Central America folded into North America
    "egypt":            "Africa",
    "french-polynesia": "Oceania",
    "georgia":          "Europe",          # Tbilisi — FMAP rg=Europe
    "jordan":           "Asia",            # Middle East → Asia in this filter
    "laos":             "Asia",
    "maldives":         "Asia",
    "malta":            "Europe",
    "mexico":           "North America",
    "montenegro":       "Europe",
    "nepal":            "Asia",
    "oman":             "Asia",            # Middle East → Asia
    "philippines":      "Asia",
    "poland":           "Europe",
    "qatar":            "Asia",            # Middle East → Asia
    "seychelles":       "Africa",
    "sri-lanka":        "Asia",
    "vietnam":          "Asia",
}

SECTION_SEP = "─" * 60


def run_script(script: str, *args: str) -> tuple[int, str]:
    cmd = [sys.executable, str(SCRIPTS / script), *args]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT))
    return r.returncode, (r.stdout + r.stderr).strip()


def fix_continent_map() -> tuple[bool, list[str]]:
    """Add missing country→continent entries to the inline CONTINENT JS object."""
    html = INDEX.read_text(encoding="utf-8")
    # Parse the existing map
    m = re.search(r"(var CONTINENT = \{)(.*?)(\};)", html, re.DOTALL)
    if not m:
        return False, ["  ✗ could not find var CONTINENT = {...} in Guides-Index.html"]

    existing_block = m.group(2)
    # Extract already-mapped slugs
    already_mapped = set(re.findall(r"'([^']+)'\s*:\s*'[^']+'", existing_block))

    adds = {k: v for k, v in MISSING_CONTINENT_MAP.items() if k not in already_mapped}
    if not adds:
        return False, ["  ✓ CONTINENT map — all known slugs already mapped"]

    notes = [f"  + {slug} → {cont}" for slug, cont in sorted(adds.items())]
    if not APPLY:
        return False, [f"  Would add {len(adds)} slug(s) to CONTINENT map:"] + notes

    # Group new entries by continent to append in a clean block
    by_cont: dict[str, list[str]] = {}
    for slug, cont in sorted(adds.items()):
        by_cont.setdefault(cont, []).append(slug)

    new_lines = []
    for cont in ["Europe", "Asia", "North America", "South America",
                 "Caribbean", "Oceania", "Africa"]:
        slugs = by_cont.get(cont, [])
        if slugs:
            pair_str = ",".join(f"'{s}':'{cont}'" for s in slugs)
            new_lines.append(f"    {pair_str},")

    # Insert before the closing '};'
    new_block = existing_block.rstrip().rstrip(",") + ",\n" + "\n".join(new_lines) + "\n  "
    new_html = html[: m.start(2)] + new_block + html[m.end(2):]
    INDEX.write_text(new_html, encoding="utf-8")
    return True, [f"  ✓ CONTINENT map — added {len(adds)} slug(s):"] + notes


def check_fmap_gaps() -> list[str]:
    """Report dest-cards with no FMAP entry (flight time filter blind spots)."""
    import json
    html = INDEX.read_text(encoding="utf-8")
    fmap_m = re.search(r"var FMAP = (\{.*?\});", html, re.DOTALL)
    if not fmap_m:
        return ["  ✗ could not find FMAP"]
    fmap = json.loads(fmap_m.group(1))

    # Collect card hrefs for ACTUAL destination guides only (skip Best-of / Trip-Essentials)
    card_hrefs: set[str] = set()
    for href in re.findall(r'<a class="dest-card"[^>]+href="([^"]+)"', html):
        if "Trip-Essentials" in href or "Best-" in href:
            continue
        # ./Guides/City/file.html → City/file.html
        clean = re.sub(r'^\.?/?(?:Guides/)?', '', href.lstrip("./"))
        card_hrefs.add(clean)

    missing = sorted(h for h in card_hrefs if h not in fmap)
    if not missing:
        return ["  ✓ FMAP — all dest-cards have a flight-time entry"]
    lines = [f"  ⚠ FMAP — {len(missing)} card(s) missing a flight-time entry (manual fix needed):"]
    for h in missing[:20]:
        lines.append(f"      {h}")
    if len(missing) > 20:
        lines.append(f"      … and {len(missing)-20} more")
    return lines


def check_language_flight_guard() -> list[str]:
    """Verify the Language toggle exits flight mode instead of silently returning.

    The Language button listener must not contain a bare `return` when
    mode-flights is active.  The correct pattern is a _setBrowseView call
    (which exits flight mode) before falling through to toggle().
    """
    html = INDEX.read_text(encoding="utf-8")
    # Locate the guard line inside the facet-panel toggle listener
    bad = re.search(
        r"classList\.contains\(['\"]mode-flights['\"]\).*?lBtn.*?\breturn\b",
        html,
    )
    good = re.search(
        r"classList\.contains\(['\"]mode-flights['\"]\).*?lBtn.*?_setBrowseView",
        html,
    )
    if bad and not good:
        return [
            "  ✗ Language toggle silently returns in flight mode — "
            "replace `return` with `_setBrowseView('country')` call"
        ]
    if good:
        return ["  ✓ Language toggle correctly exits flight mode"]
    return ["  ⚠ Language flight-guard pattern not found — manual review needed"]


def check_inline_data() -> list[str]:
    """Quick check: all dest-cards are covered by CLIMATE_INLINE/COST_DATA/SAFETY_DATA."""
    rc, out = run_script("validate_guides_index_inline.py")
    lines = [f"  {'✓' if rc == 0 else '⚠'} inline data — {out.splitlines()[0] if out else 'no output'}"]
    if rc != 0:
        for l in out.splitlines()[1:5]:
            lines.append(f"      {l}")
    return lines


def section(title: str) -> None:
    print(f"\n{SECTION_SEP}")
    print(f"  {title}")
    print(SECTION_SEP)


def main() -> int:
    mode = "APPLY" if APPLY else "DRY RUN"
    print(f"\n{'═'*60}")
    print(f"  audit_filters.py — {mode}")
    print(f"{'═'*60}")

    changed = False

    # ── 1. Language tags ─────────────────────────────────────────
    section("Language (data-lang)")
    args = ["--apply"] if APPLY else []
    rc, out = run_script("build_lang_tags.py", *args)
    for line in out.splitlines()[:6]:
        print(f"  {line}")
    if APPLY and rc == 0 and "written" in out:
        changed = True

    # ── 2. Trip Length (DAYS_DATA) ────────────────────────────────
    section("Trip Length (DAYS_DATA)")
    rc, out = run_script("build_days_data.py", *args)
    for line in out.splitlines()[:8]:
        print(f"  {line}")
    if APPLY and rc == 0 and ("written" in out or "OK" in out):
        changed = True

    # ── 3. Trip Type (THEME_DATA) ─────────────────────────────────
    section("Trip Type (THEME_DATA)")
    rc, out = run_script("build_theme_tags.py", *args)
    for line in out.splitlines()[:10]:
        print(f"  {line}")
    if APPLY and rc == 0 and "written" in out:
        changed = True

    # ── 4. Continent map ─────────────────────────────────────────
    section("Continent (inline JS map)")
    did_write, notes = fix_continent_map()
    for n in notes:
        print(n)
    if did_write:
        changed = True

    # ── 5. Flight Time (FMAP) ────────────────────────────────────
    section("Flight Time (FMAP) — report only")
    for line in check_fmap_gaps():
        print(line)

    # ── 6. When & weather / inline data ──────────────────────────
    section("When & weather / inline data coverage")
    for line in check_inline_data():
        print(line)

    # ── 7. Language toggle flight-mode guard ──────────────────────
    section("Language toggle — flight-mode behaviour")
    for line in check_language_flight_guard():
        print(line)

    # ── Summary ──────────────────────────────────────────────────
    print(f"\n{'═'*60}")
    if APPLY:
        if changed:
            print("  Changes written.")
        else:
            print("  No changes needed — all filters up to date.")
    else:
        print("  Dry run complete. Run with --apply to write fixes.")
    print(f"{'═'*60}\n")

    if APPLY and PUSH and changed:
        print("Committing and pushing filter audit fixes…")
        subprocess.run(["git", "add",
                        "Travel-Website/Guides-Index.html"],
                       cwd=str(ROOT), check=True)
        msg = (
            "Routine: audit and sync all guide-index filters\n\n"
            "Auto-fixed: language tags (data-lang), trip-length (DAYS_DATA),\n"
            "theme tags (THEME_DATA), continent map (missing country slugs).\n\n"
            "Co-Authored-By: The Expert <noreply@the-voyager-expert.com>"
        )
        r = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=str(ROOT))
        if r.returncode != 0:
            subprocess.run(["git", "commit", "-m", msg], cwd=str(ROOT), check=True)
            subprocess.run(["git", "push"], cwd=str(ROOT), check=True)
            print("  ✓ pushed")
        else:
            print("  nothing staged — already up to date")

    return 0


if __name__ == "__main__":
    sys.exit(main())
