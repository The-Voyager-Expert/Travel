#!/usr/bin/env python3
"""
validate_search_index.py — integrity check for assets/search_index.json

Verifies (no network, local files only):
  1. search_index.json exists and is valid JSON with the expected schema.
  2. Every guide HTML file on disk is present in the index (no orphan guides).
  3. Every entry in the index points to a guide file that actually exists on disk
     (no ghost entries from renamed/deleted guides).
  4. The "generated" date is not stale (warns if > 7 days old — guides may have
     been edited without a ship + index rebuild).

Exit 0 = all good. Exit 1 = issues found (details printed).
Run after any guide ship or manual guide edit, or as a spot check.
"""
import json, os, re, sys, datetime

HERE   = os.path.dirname(os.path.abspath(__file__))
TRAVEL = os.path.abspath(os.path.join(HERE, "..", ".."))
WEB    = os.path.join(TRAVEL, "Travel-Website")
GUIDES = os.path.join(WEB, "Guides")
INDEX  = os.path.join(WEB, "assets", "search_index.json")

STALE_DAYS = 7   # warn if index older than this


def guide_files_on_disk():
    """Return set of relative paths  City/file.html  for every guide (not guides_index)."""
    found = set()
    for entry in os.scandir(GUIDES):
        if not entry.is_dir():
            continue
        for f in os.scandir(entry.path):
            if f.name.endswith(".html") and f.name != "guides_index.html":
                found.add(f"{entry.name}/{f.name}")
    return found


def main():
    fails = []

    # ── 1. File exists and parses ─────────────────────────────────────────────
    if not os.path.exists(INDEX):
        print(f"ERROR: search_index.json not found at {INDEX}", file=sys.stderr)
        sys.exit(2)
    try:
        si = json.load(open(INDEX, encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"ERROR: search_index.json is not valid JSON: {e}", file=sys.stderr)
        sys.exit(2)

    if "guides" not in si or not isinstance(si["guides"], list):
        print("ERROR: search_index.json missing 'guides' list", file=sys.stderr)
        sys.exit(2)

    # ── 2. Coverage: disk vs index ────────────────────────────────────────────
    disk_paths   = guide_files_on_disk()
    index_paths  = {g["u"] for g in si["guides"] if "u" in g}

    missing = sorted(disk_paths - index_paths)   # on disk, not in index
    ghost   = sorted(index_paths - disk_paths)   # in index, not on disk

    if missing:
        fails.append(
            f"{len(missing)} guide(s) on disk but missing from search index "
            f"(run build_search_index.py):\n    " + "\n    ".join(missing)
        )
    if ghost:
        fails.append(
            f"{len(ghost)} index entry(s) point to non-existent files "
            f"(stale after rename/delete — run build_search_index.py):\n    "
            + "\n    ".join(ghost)
        )

    # ── 3. All index paths resolve on disk ───────────────────────────────────
    # (covered by ghost check above — skip redundant loop)

    # ── 4. Freshness ─────────────────────────────────────────────────────────
    gen_str = si.get("generated", "")
    try:
        gen_date = datetime.date.fromisoformat(gen_str)
        age = (datetime.date.today() - gen_date).days
        if age > STALE_DAYS:
            fails.append(
                f"search_index.json is {age} days old (generated {gen_str}). "
                f"Run build_search_index.py to refresh."
            )
    except ValueError:
        fails.append(f"'generated' field is not a valid date: {gen_str!r}")

    # ── Report ────────────────────────────────────────────────────────────────
    if fails:
        print(f"validate_search_index: {len(fails)} issue(s):\n")
        for f in fails:
            print(f"  ✗ {f}")
        sys.exit(1)
    else:
        print(
            f"validate_search_index: OK — {len(index_paths)} guides indexed, "
            f"generated {gen_str} ({age} day(s) ago)"
        )


if __name__ == "__main__":
    main()
