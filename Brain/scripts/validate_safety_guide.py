#!/usr/bin/env python3
"""
validate_safety_guide.py — integrity check for Trip-Essentials/Safety Guide.html

Verifies (no network, local files only):
  1. Every guide city in guides_index.html has exactly one row in the Safety Guide.
  2. No city appears in more than one advisory level section (no duplicates).
  3. Every city-row href resolves to a guide file that exists on disk.
  4. No extra rows in the Safety Guide for cities not in guides_index
     (stale entries after a guide is removed or renamed).

The Safety Guide is hardcoded — it needs a manual update whenever a guide city
is added, removed, or renamed, and whenever State Dept advisory levels change.

Exit 0 = all good. Exit 1 = issues found (details printed).
Run after any guide is added/removed/renamed, or after advisory level changes.
"""
import os, re, sys, urllib.parse

HERE   = os.path.dirname(os.path.abspath(__file__))
TRAVEL = os.path.abspath(os.path.join(HERE, "..", ".."))
WEB    = os.path.join(TRAVEL, "Travel-Website")
INDEX  = os.path.join(WEB, "Guides", "guides_index.html")
PAGE   = os.path.join(WEB, "Trip-Essentials", "Safety Guide.html")
GUIDES = os.path.join(WEB, "Guides")


def _parse_index_hrefs(html):
    """Return set of  City/file.html  keys from guides_index dest-cards."""
    keys = set()
    for m in re.finditer(r'class="dest-card[^"]*"[^>]*href="\./([^"]+)"', html):
        keys.add(urllib.parse.unquote(m.group(1)))
    return keys


def _parse_safety_hrefs(html):
    """Return list of  City/file.html  keys from Safety Guide city-rows (preserves dupes)."""
    keys = []
    for m in re.finditer(r'class="city-row"\s+href="\.\./Guides/([^"]+)"', html):
        keys.append(urllib.parse.unquote(m.group(1)))
    return keys


def main():
    fails = []

    for path, label in [(INDEX, "guides_index.html"), (PAGE, "Safety Guide.html")]:
        if not os.path.exists(path):
            print(f"ERROR: {label} not found at {path}", file=sys.stderr)
            sys.exit(2)

    idx_html = open(INDEX, encoding="utf-8").read()
    sg_html  = open(PAGE,  encoding="utf-8").read()

    idx_keys = _parse_index_hrefs(idx_html)
    sg_keys  = _parse_safety_hrefs(sg_html)   # list — keeps duplicates
    sg_set   = set(sg_keys)

    # ── 1. Missing from Safety Guide ─────────────────────────────────────────
    missing = sorted(idx_keys - sg_set)
    if missing:
        fails.append(
            f"{len(missing)} guide(s) in guides_index but missing from Safety Guide "
            f"(add a city-row to the appropriate level section):\n    "
            + "\n    ".join(missing)
        )

    # ── 2. Extra in Safety Guide (not in guides_index) ────────────────────────
    extra = sorted(sg_set - idx_keys)
    if extra:
        fails.append(
            f"{len(extra)} Safety Guide row(s) not in guides_index "
            f"(guide renamed/removed — remove or update the city-row):\n    "
            + "\n    ".join(extra)
        )

    # ── 3. Duplicate rows (city in more than one level section) ──────────────
    from collections import Counter
    counts = Counter(sg_keys)
    dupes = {k: v for k, v in counts.items() if v > 1}
    if dupes:
        fails.append(
            f"{len(dupes)} city(s) appear in multiple level sections:\n    "
            + "\n    ".join(f"{k}  ({v}×)" for k, v in sorted(dupes.items()))
        )

    # ── 4. Broken links (href → file missing on disk) ─────────────────────────
    trip_ess = os.path.join(WEB, "Trip-Essentials")
    broken = []
    for key in sg_set:
        target = os.path.normpath(os.path.join(trip_ess, "..", "Guides", key))
        if not os.path.exists(target):
            broken.append(key)
    if broken:
        fails.append(
            f"{len(broken)} city-row href(s) point to non-existent files:\n    "
            + "\n    ".join(sorted(broken))
        )

    # ── Report ────────────────────────────────────────────────────────────────
    if fails:
        print(f"validate_safety_guide: {len(fails)} issue(s):\n")
        for f in fails:
            print(f"  ✗ {f}")
        print(f"\nFix: edit  Trip-Essentials/Safety Guide.html  manually.")
        sys.exit(1)
    else:
        # Count per level for the summary line
        l1 = len(re.findall(r'id="grid-l1".*?</div>', sg_html, re.S)[0].split('city-row')) - 1 \
             if re.search(r'id="grid-l1"', sg_html) else 0
        l2 = len(sg_keys) - l1  # rough; exact count below
        # Exact per-level counts via section slicing
        def _level_count(level):
            m = re.search(rf'id="grid-l{level}"(.*?)(?=id="grid-l|\Z)', sg_html, re.S)
            return len(re.findall(r'class="city-row"', m.group(1))) if m else 0
        counts_str = " · ".join(
            f"L{l} ×{_level_count(l)}" for l in (1, 2, 3) if _level_count(l)
        )
        print(
            f"validate_safety_guide: OK — {len(sg_keys)} cities ({counts_str}), "
            f"all links resolve"
        )


if __name__ == "__main__":
    main()
