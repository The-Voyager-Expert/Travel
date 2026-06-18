#!/usr/bin/env python3
"""
audit_transit_dupes.py — From-hotel transit-time duplicate SURFACER (advisory).

WHY THIS IS A WARN, NEVER A HARD FAIL
-------------------------------------
Several guides repeat the same `🚶 N min · 🚕 M min` from-hotel time across
multiple entries. Some repeats are a crib pasting a placeholder instead of
looking each up (the bug). But many repeats are LEGITIMATE and a hard-fail
would false-flag them:
  • shared tour meeting point — Dublin's Cliffs of Moher / Giant's Causeway
    day-trips all depart the same O'Connell Street coach stop → same time, real.
  • one building complex — Bend's five Sunriver entries are bldg 2/4/7/17/19 of
    57100 Beaver Dr → same time, real.
  • same spot written two ways — Singapore "Chinatown Point · 133 New Bridge Rd"
    vs "Chinatown MRT · Exit A" → same place, same time, real.
  • adjacent addresses — Lisbon "R. Viriato 1b" / "R. Viriato 9b" → same time, real.

The validator sees TEXT, not geography — it cannot recompute mapping-service
times, so it cannot decide bug-vs-real. What it CAN do is surface the candidates:
group entries by identical (🚶,🚕) pair and list every group where one time is
stamped on several DISTINCT pin strings. A human (or a map lookup) confirms.

So this is a review-queue surfacer, run on demand / in the audit pass. It does
NOT run in the per-guide ship gate and never blocks a ship.

Usage:
    python3 Brain/scripts/audit_transit_dupes.py            # strong tier (>=4 pins)
    python3 Brain/scripts/audit_transit_dupes.py --min 3    # widen the net
    python3 Brain/scripts/audit_transit_dupes.py --city Paris
    python3 Brain/scripts/audit_transit_dupes.py --json out.json
"""
import argparse
import collections
import glob
import html
import json
import os
import re
import sys
from pathlib import Path

WEB_ROOT = Path(__file__).resolve().parent.parent.parent / "Travel-Website"
GUIDES = WEB_ROOT / "Guides"

# from-hotel time: 🚶 N min · 🚕 M min, NOT a motion-banner row (those end in → dest)
WALK_RE = re.compile(r'🚶\s*([0-9]+)\s*min\s*·\s*🚕\s*([0-9]+)\s*min(?!\s*→)')
PIN_RE = re.compile(r'📍\s*(?:<a[^>]*>)?\s*([^<\n]+?)\s*(?:</a>)?\s*</div>', re.I)


def norm_pin(s: str) -> str:
    return re.sub(r'\s+', ' ', html.unescape(s)).strip()


def analyze(path: Path):
    """Return {(walk,ride): [pin,...]} for from-hotel rows that carry a 📍 pin."""
    txt = path.read_text(encoding='utf-8')
    blocks = re.split(r'<div class="entry-body">', txt)
    by_time = collections.defaultdict(list)
    for b in blocks[1:]:
        body = b[:1200]
        wm = WALK_RE.search(body)
        if not wm:
            continue
        pm = None
        for m in PIN_RE.finditer(body[:wm.start()]):
            pm = m
        if not pm:
            pm = PIN_RE.search(body)
        pin = norm_pin(pm.group(1)) if pm else "(no pin)"
        by_time[(int(wm.group(1)), int(wm.group(2)))].append(pin)
    return by_time


def suspects_for(by_time, min_pins):
    """A group is a suspect when one time maps to >= min_pins DISTINCT pins."""
    out = {}
    for (w, r), pins in by_time.items():
        distinct = sorted(set(pins))
        if len(distinct) >= min_pins:
            out[(w, r)] = distinct
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--min', type=int, default=4,
                    help='min distinct pins sharing one time to flag (default 4 = strong tier)')
    ap.add_argument('--city', help='restrict to one guide folder')
    ap.add_argument('--json', help='also write detail JSON to this path')
    args = ap.parse_args()

    dirs = sorted(d for d in os.listdir(GUIDES) if (GUIDES / d).is_dir())
    if args.city:
        dirs = [d for d in dirs if d.lower() == args.city.lower()]

    flagged = []  # (worst, total_pins, city, suspects)
    for d in dirs:
        htmls = glob.glob(str(GUIDES / d / "*.html"))
        if not htmls:
            continue
        by_time = analyze(Path(htmls[0]))
        s = suspects_for(by_time, args.min)
        if s:
            worst = max(len(v) for v in s.values())
            total = sum(len(v) for v in s.values())
            flagged.append((worst, total, d, s))

    flagged.sort(reverse=True)

    print("━━━ transit-time duplicate surfacer (advisory — never a ship gate) ━━━")
    print(f"flagging groups where one 🚶/🚕 from-hotel time hits >= {args.min} distinct pins\n")
    if not flagged:
        print("✓ no guides above the threshold")
        return 0
    print(f"{len(flagged)} guide(s) to eyeball — confirm each is a real shared point, not a paste:\n")
    for worst, total, d, s in flagged:
        print(f"● {d}  (worst: one time on {worst} pins)")
        for (w, r), pins in sorted(s.items(), key=lambda kv: -len(kv[1])):
            print(f"    🚶 {w} · 🚕 {r} min  ×{len(pins)} distinct pins:")
            for p in pins:
                print(f"        – {p[:72]}")
        print()

    if args.json:
        out = {d: {f"{w}w_{r}r": pins for (w, r), pins in s.items()}
               for _, _, d, s in flagged}
        Path(args.json).write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding='utf-8')
        print(f"detail JSON → {args.json}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
