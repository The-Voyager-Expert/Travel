#!/usr/bin/env python3
"""reset_stamps_to_pending.py — strip all validation stamps and replace with pending.

WHY
---
After rotating the signing key (2026-06-27), all existing stamps were signed
with the old public DEFAULT_KEY. They fail verification against the new secret
key — so any re-push of these guides would already be blocked by pre_push_guard.

But the guides are already live in the repo. This script resets ALL guide HTML
files by replacing existing stamps (signed or unsigned) with
  <!-- validation: pending -->
so that:
  • The guides render fine for users (it's an invisible HTML comment).
  • pre_push_guard blocks any push of a guide carrying "pending" — the guide
    must pass validate_itinerary.py and receive a new signed stamp first.
  • Cribs treating "pending" as a queue: run through each guide, validate,
    receive a new stamp, then ship. The commit/push clears "pending" for that
    guide and the site gets a clean re-validated copy.

USAGE
-----
  python3 Brain/scripts/reset_stamps_to_pending.py          # dry run — report only
  python3 Brain/scripts/reset_stamps_to_pending.py --apply  # rewrite files in place
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

GUIDES_DIR = Path(__file__).resolve().parent.parent.parent / "Travel-Website" / "Guides"

_STAMP_RE = re.compile(r"<!--\s*validation:\s*passed.*?-->", re.IGNORECASE | re.DOTALL)
_PENDING_RE = re.compile(r"<!--\s*validation:\s*pending\s*-->", re.IGNORECASE)
PENDING = "<!-- validation: pending -->"


def find_guides() -> list[Path]:
    return [
        p for p in GUIDES_DIR.rglob("*.html")
        if p.name != "Guides-Index.html"
    ]


def reset_guide(path: Path, apply: bool) -> str:
    """Return 'signed', 'unsigned', 'already_pending', or 'no_stamp'."""
    html = path.read_text(encoding="utf-8", errors="replace")

    if _PENDING_RE.search(html):
        return "already_pending"

    has_stamp = bool(_STAMP_RE.search(html))
    if not has_stamp:
        return "no_stamp"

    # Detect if it's a v2 signed stamp
    is_signed = bool(re.search(r"sig=[0-9a-f]{8,}", html, re.IGNORECASE))
    label = "signed" if is_signed else "unsigned"

    if apply:
        # Remove ALL old stamps first (some guides had duplicates), then insert one pending marker.
        cleaned = _STAMP_RE.sub("", html)
        if PENDING not in cleaned:
            cleaned = PENDING + "\n" + cleaned
        path.write_text(cleaned, encoding="utf-8")

    return label


def main() -> None:
    apply = "--apply" in sys.argv[1:]
    guides = find_guides()

    counts = {"signed": 0, "unsigned": 0, "already_pending": 0, "no_stamp": 0}
    rows: list[tuple[str, str]] = []

    for g in sorted(guides):
        status = reset_guide(g, apply)
        counts[status] += 1
        rel = g.relative_to(GUIDES_DIR.parent.parent)
        rows.append((str(rel), status))

    mode = "APPLIED" if apply else "DRY RUN"
    print(f"\n{'='*60}")
    print(f"  reset_stamps_to_pending — {mode} — {len(guides)} guides")
    print(f"{'='*60}")
    print(f"  Signed stamps reset     : {counts['signed']}")
    print(f"  Unsigned stamps reset   : {counts['unsigned']}")
    print(f"  Already pending         : {counts['already_pending']}")
    print(f"  No stamp at all         : {counts['no_stamp']}")
    print()

    for rel, status in rows:
        if status == "already_pending":
            icon = "⏳"
        elif status == "no_stamp":
            icon = "⬜"
        elif apply:
            icon = "✅"
        else:
            icon = "🔄"
        print(f"  {icon} [{status:16s}] {rel}")

    if not apply:
        print(f"\n{'='*60}")
        print("  DRY RUN — no files changed. Re-run with --apply to reset.")
        print(f"{'='*60}\n")
    else:
        total_reset = counts["signed"] + counts["unsigned"]
        print(f"\n{'='*60}")
        print(f"  ✅ {total_reset} guides reset to pending.")
        print(f"  Commit + push this batch, then cribs validate each guide")
        print(f"  to get a new signed stamp before it can ship again.")
        print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
