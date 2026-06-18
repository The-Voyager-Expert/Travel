#!/usr/bin/env python3
"""
update_core_rules_checksums.py
──────────────────────────────
Run this ONLY after a CORE RULES file has been edited with explicit
permission from Dani. Updates core_rules_checksums.json to match the
current state of every HTML file in Brain/CORE RULES/.

Usage (from Brain/scripts/):
    python3 update_core_rules_checksums.py

The validator (validate_itinerary.py) will fail if any CORE RULES file
has been modified without the checksums being updated — that's the point.
This script is the authorised way to accept a change.
"""

import hashlib
import json
import sys
from datetime import date
from pathlib import Path

SCRIPTS_DIR   = Path(__file__).parent
CORE_RULES    = SCRIPTS_DIR.parent / "CORE RULES"
CHECKSUMS_OUT = SCRIPTS_DIR / "core_rules_checksums.json"
# Format version lives in its own file (NOT in core_rules_checksums.json, which
# the validator reads as a flat {file: hash} map). It fingerprints only the
# FORMAT-defining CORE RULES files — behavioral docs are excluded, so a wording
# tweak to Rules for Claude.html does not mark every guide stale. Used by the
# guide staleness ledger (guide_tools.py staleness).
FORMAT_VERSION_OUT = SCRIPTS_DIR.parent / "Reference" / "format_version.json"
FORMAT_EXCLUDE = {"Rules for Claude.html"}  # behavioral, not guide-format


def _write_format_version(new_checksums: dict) -> None:
    """Compute a fingerprint over the format-defining CORE RULES files and
    record it with a date. The date only advances when the fingerprint changes,
    so it reads as 'the date the guide format last changed'."""
    items = sorted((rel, sha) for rel, sha in new_checksums.items()
                   if rel not in FORMAT_EXCLUDE)
    fingerprint = hashlib.sha256(
        json.dumps(items, sort_keys=True).encode("utf-8")
    ).hexdigest()[:16]

    prev = {}
    if FORMAT_VERSION_OUT.is_file():
        try:
            prev = json.loads(FORMAT_VERSION_OUT.read_text(encoding="utf-8"))
        except Exception:
            prev = {}

    if prev.get("fingerprint") == fingerprint and prev.get("date"):
        version_date = prev["date"]          # unchanged — keep original date
        bumped = False
    else:
        version_date = date.today().isoformat()
        bumped = True

    FORMAT_VERSION_OUT.write_text(json.dumps({
        "fingerprint": fingerprint,
        "date": version_date,
        "format_files": len(items),
        "note": "Guide format version. Bumps when any CORE RULES file except "
                "Rules for Claude.html changes. Guides built under an older "
                "fingerprint are flagged stale by guide_tools.py staleness.",
    }, indent=2))

    flag = "BUMPED → " if bumped else "unchanged "
    print(f"format_version.json {flag}{version_date}  (fp {fingerprint}, "
          f"{len(items)} format files)")

def main():
    if not CORE_RULES.is_dir():
        print(f"ERROR: CORE RULES directory not found at: {CORE_RULES}", file=sys.stderr)
        sys.exit(1)

    files = sorted(CORE_RULES.rglob("*.html"))
    if not files:
        print("ERROR: No HTML files found in CORE RULES.", file=sys.stderr)
        sys.exit(1)

    # Load existing checksums to report what changed.
    old = {}
    if CHECKSUMS_OUT.is_file():
        try:
            old = json.loads(CHECKSUMS_OUT.read_text(encoding="utf-8"))
        except Exception:
            pass

    new = {}
    changed = []
    added   = []
    for f in files:
        rel  = str(f.relative_to(CORE_RULES))
        sha  = hashlib.sha256(f.read_bytes()).hexdigest()
        new[rel] = sha
        if rel not in old:
            added.append(rel)
        elif old[rel] != sha:
            changed.append(rel)

    removed = [r for r in old if r not in new]

    CHECKSUMS_OUT.write_text(json.dumps(new, indent=2, sort_keys=True))

    print(f"core_rules_checksums.json updated — {len(new)} file(s) hashed.")
    if changed:
        print(f"  CHANGED  ({len(changed)}): " + ", ".join(changed))
    if added:
        print(f"  ADDED    ({len(added)}):   " + ", ".join(added))
    if removed:
        print(f"  REMOVED  ({len(removed)}): " + ", ".join(removed))
    if not (changed or added or removed):
        print("  No changes detected — checksums already matched.")

    _write_format_version(new)

if __name__ == "__main__":
    main()
