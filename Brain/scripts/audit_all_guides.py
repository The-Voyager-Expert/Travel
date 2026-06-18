#!/usr/bin/env python3
"""
audit_all_guides.py — Cross-guide validator audit.

Runs validate_itinerary.py AND verify_booking_links.py on every guide HTML
found in Travel/Travel-Website/Guides/, then presents two views:
  1. Per-guide pass/fail summary
  2. Failures grouped by type — most widespread first

verify_booking_links.py is NOT a ship-gate deferral — it runs on every build.
Deferring it creates a gap where Wikipedia/TripAdvisor h1 drift goes undetected
until ship. Both static (log coverage) and live (h1-match) checks run here.

Usage:
    python3 Brain/scripts/audit_all_guides.py
    python3 Brain/scripts/audit_all_guides.py --fails-only
    python3 Brain/scripts/audit_all_guides.py --static   # skip live h1-fetch (log coverage only)
"""

import subprocess
import sys
import re
from pathlib import Path
from datetime import datetime
from collections import defaultdict

TRAVEL_ROOT     = Path(__file__).resolve().parent.parent.parent   # …/Travel/
WEB_ROOT        = TRAVEL_ROOT / "Travel-Website"                   # published site root (2026-06-13 reorg)
VALIDATOR       = Path(__file__).resolve().parent / "validate_itinerary.py"
VERIFY_LINKS    = Path(__file__).resolve().parent / "verify_booking_links.py"
GUIDES_DIR      = WEB_ROOT / "Guides"

PASS = "✅"
FAIL = "❌"
WARN = "⚠️ "

# ── helpers ───────────────────────────────────────────────────────────────────

def short_name(path: Path) -> str:
    """'Guides/Paris/paris_v4.html' → 'Paris'"""
    return path.parent.name


def run_validator(guide: Path) -> list[str]:
    result = subprocess.run(
        [sys.executable, str(VALIDATOR), str(guide)],
        capture_output=True, text=True
    )
    return (result.stdout + result.stderr).splitlines()


def run_verify_links(guide: Path, static: bool = False) -> list[str]:
    """Run verify_booking_links.py on a guide; return its output lines."""
    cmd = [sys.executable, str(VERIFY_LINKS), str(guide)]
    if static:
        cmd.append("--static")
    result = subprocess.run(cmd, capture_output=True, text=True)
    return (result.stdout + result.stderr).splitlines()


def parse_results(lines: list[str]) -> tuple[list[str], list[str]]:
    """Return (failures, warnings) — each as a label string."""
    failures, warnings = [], []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(FAIL):
            label = stripped[len(FAIL):].strip()
            # Drop the trailing source reference in parentheses if present
            label = re.sub(r'\s*\(.*?\.html.*?\)\s*$', '', label).strip()
            failures.append(label)
        elif stripped.startswith(WARN.strip()):
            label = stripped[len(WARN.strip()):].strip()
            warnings.append(label)
    return failures, warnings


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    fails_only = "--fails-only" in sys.argv
    static     = "--static"     in sys.argv

    guides = sorted(
        [p for p in GUIDES_DIR.rglob("*.html")
         if "_build" not in p.parts and "archive" not in p.parts
         and not p.name.startswith("_") and not p.name.startswith("guide_") and "index" not in p.name]
    )

    if not guides:
        print("No guides found. Run from Travel/ root or check GUIDES_DIR.")
        sys.exit(1)

    link_mode = "static (log coverage only)" if static else "live (h1-match + log coverage)"

    # ── collect results ───────────────────────────────────────────────────────
    guide_failures: dict[str, list[str]] = {}   # short name → [failure labels]
    guide_warnings: dict[str, list[str]] = {}
    failure_guides: dict[str, list[str]] = defaultdict(list)  # label → [guide names]

    print(f"\nRunning validator + verify_booking_links [{link_mode}] on {len(guides)} guide(s)…\n")
    for guide in guides:
        name = short_name(guide)
        lines = run_validator(guide)
        link_lines = run_verify_links(guide, static=static)
        failures, warnings = parse_results(lines + link_lines)
        guide_failures[name] = failures
        guide_warnings[name] = warnings
        for f in failures:
            failure_guides[f].append(name)
        status = PASS if not failures else FAIL
        print(f"  {status}  {name:<30}  {len(failures)} failure(s)  {len(warnings)} warning(s)")

    total      = len(guides)
    clean      = sum(1 for f in guide_failures.values() if not f)
    broken     = total - clean
    fail_types = len(failure_guides)

    # ── header ────────────────────────────────────────────────────────────────
    width = 68
    print()
    print("═" * width)
    print(f"  CROSS-GUIDE AUDIT  —  {total} guides  —  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  {PASS} {clean} clean   {FAIL} {broken} with failures   {fail_types} distinct failure type(s)")
    print("═" * width)

    if not failure_guides:
        print("\n  All guides pass. Nothing to fix.\n")
        return

    # ── failures grouped by type ───────────────────────────────────────────────
    print(f"\n{'FAILURES BY TYPE':}  (most widespread first)\n")

    sorted_failures = sorted(failure_guides.items(), key=lambda x: -len(x[1]))

    for label, affected in sorted_failures:
        count = len(affected)
        bar   = f"[{count}/{total}]"
        guide_list = ", ".join(affected)
        # Wrap label at 60 chars
        if len(label) > 60:
            label_display = label[:57] + "…"
        else:
            label_display = label
        print(f"  {FAIL} {bar:7}  {label_display}")
        print(f"{'':>13}→ {guide_list}")
        print()

    # ── quick copy-paste fix list ─────────────────────────────────────────────
    if not fails_only:
        print("─" * width)
        print("  PER-GUIDE DETAIL\n")
        for name, failures in sorted(guide_failures.items()):
            if not failures:
                continue
            print(f"  {FAIL} {name}")
            for f in failures:
                short = f[:70] + "…" if len(f) > 70 else f
                print(f"      • {short}")
            print()

    print("═" * width)
    print(f"  Run: python3 Brain/scripts/audit_all_guides.py --fails-only   compact view")
    print(f"       python3 Brain/scripts/audit_all_guides.py --static        skip live h1-fetch")
    print("═" * width + "\n")


if __name__ == "__main__":
    main()
