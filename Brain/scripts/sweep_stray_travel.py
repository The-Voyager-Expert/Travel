#!/usr/bin/env python3
"""
sweep_stray_travel.py — find travel-related files outside Travel/.

Enforces the HARD RULE locked in `Travel/CLAUDE.md`: All travel work
lives under `Travel/` and `Rules for Claude.html` § 3 Working for Dani. The
behavioral rule prevents Claude from CREATING files outside Travel/; this
script catches accumulation that arrives by other paths — Drive-sync byproducts
(numbered `(N).gdoc` duplicates), browser PDF downloads, manual Drive copies.

Runs at every session start (per CLAUDE.md § Session start). When run
inside a session in the sandbox, scan paths that aren't mounted are silently
skipped — the report still reflects what the script CAN see.

Heuristic: a file is "stray" if its basename matches one of the travel name
patterns AND it's NOT inside Travel/. Patterns:

  - canonical core-rule names from `Brain/CORE RULES/*.html` (read at runtime
    so the list stays in sync) plus their Drive-export underscore variants
  - brain file name prefixes (To_Do_List, _draft_, brain_core,
    cleanliness_checks, audit_log, PLATFORMS,
    travel_tips_v, travel_profile_v)
  - trip-doc / booking names (Trips, 2026 Travel, Booking Snippets,
    Trips_Claude_and_Dani_workspace, trips_proposal, trips_preview)
  - guide names matching `{city}_v\\d+` (paris_v3, lisbon_v2, turin_v10, …)
  - Drive numbered duplicates: `Foo (3).gdoc` or `Foo (3).html` copies

Default scan locations:
  ~/Downloads  ~/Desktop  ~/Documents  + Drive root outside Travel/

Usage:
  python3 Brain/scripts/sweep_stray_travel.py              # report only
  python3 Brain/scripts/sweep_stray_travel.py --apply      # move strays to Travel/archive/
  python3 Brain/scripts/sweep_stray_travel.py --scan PATH  # add scan path (repeatable)
  python3 Brain/scripts/sweep_stray_travel.py --quiet      # suppress 'no strays' line

Exit codes:
  0 — no strays found, OR --apply succeeded
  1 — strays found in report mode (so brain-check sees the warning)
  2 — usage / runtime error
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent          # Travel/Brain/scripts/  (was Travel/Brain/ pre-2026-04-30)
BRAIN_DIR = HERE.parent                         # Travel/Brain/
TRAVEL_ROOT = BRAIN_DIR.parent                  # Travel/
DRIVE_ROOT = TRAVEL_ROOT.parent                 # contains Travel/ + everything else
CORE_RULES_DIR = BRAIN_DIR / "CORE RULES"  # 2026-05-02: renamed from "core rules" — uppercase per Rules for Claude.html convention
ARCHIVE_DIR = TRAVEL_ROOT / "archive"


# ─── Pattern library ─────────────────────────────────────────────────────────

def _core_rule_basenames() -> set[str]:
    """Read canonical core-rule names from Brain/CORE RULES/ at runtime so the
    list stays in sync with renames. Returns names with both space and
    underscore variants (Drive exports replace spaces with underscores)."""
    if not CORE_RULES_DIR.is_dir():
        return set()
    names: set[str] = set()
    for p in CORE_RULES_DIR.glob("*.html"):  # gdoc retired 2026-05-09 → html
        stem = p.stem
        names.add(stem)
        names.add(stem.replace(" ", "_"))
        # Drive exports also replace special chars: '&' → '___', ',' → '_'
        names.add(stem.replace(" & ", "___").replace(" ", "_"))
        names.add(stem.replace(", ", "__").replace(" & ", "___").replace(" ", "_"))
    return names


# Prefix patterns for Brain operational files (match if basename starts with).
BRAIN_FILE_PREFIXES = (
    "To_Do_List",
    # Rules for Claude_updates_needed.md — archived 2026-05-07 (procedure retired;
    # all rule changes now go to 🔧 Rules for Update in To_Do_List.md). Kept in
    # prefix list so stray copies reappearing via Drive sync or backup restores get caught.
    "Rules for Claude_updates_needed", "Rules_for_Claude_updates_needed",
    "_draft_", "brain_core",
    "cleanliness_checks", "audit_log",
    "PLATFORMS",
    "travel_tips_v", "travel_profile_v", "HAND_OFF",
    # Legacy: OPEN_ITEMS retired 2026-05-01 (merged into To Do List). Kept
    # in pattern list so stray copies of the old file still get caught and
    # archived if they reappear via Drive sync or backup restores.
    "OPEN_ITEMS",
)

# Trip-doc / booking names (match if basename starts with).
TRIP_PREFIXES = (
    "Trips", "trip", "2026 Travel", "Booking Snippets",
    "Trips_Claude_and_Dani_workspace",
    "Trips_Claude and Dani workspace",
    "trips_proposal", "trips_preview", "trips temps",
)

# Guide name regex — case-insensitive `{city}_v\d+` for known and likely cities.
# Cities expand as Dani travels; the list errs toward inclusion (false positives
# in the report are easy to dismiss; misses are the real cost).
GUIDE_RE = re.compile(
    r"^(paris|lisbon|turin|milan|rome|berlin|seoul|amsterdam|porto|"
    r"cascais|tokyo|barcelona|madrid|prague|vienna|copenhagen|stockholm|"
    r"oslo|helsinki|reykjavik|sao_paulo|brussels|bruxelles|warsaw|budapest|"
    r"florence|venice|naples|geneva|zurich|munich|hamburg|frankfurt|"
    r"dublin|edinburgh|london|"
    # Nordic / Northern Europe (added 2026-06-02: alesund, tromso shipped 2026-Q2)
    r"alesund|tromso|"
    # Atlantic / Iberian (sintra, marrakech added 2026-06-02)
    r"sintra|marrakech|"
    # Canada (montreal, quebec_city, vancouver added 2026-06-02)
    r"montreal|quebec_city|vancouver|"
    # Southern Europe / Asia Pacific / misc (added 2026-06-02)
    r"singapore|sydney|"
    # Germanic/Alpine misc (marktoberdorf added 2026-06-02)
    r"marktoberdorf|"
    # North America — island/wilderness (alaska, iceland added 2026-06-02)
    r"alaska|iceland|"
    # US cities — Pasadena v1 shipped 2026-05; CA+AZ pickleball gate implies more
    r"pasadena|los_angeles|san_francisco|san_diego|new_york|chicago|"
    r"scottsdale|phoenix|sedona|tucson|palm_springs|santa_barbara|"
    r"san_jose|portland|seattle|denver|austin|nashville|miami|boston|"
    # US desert/valley cities (palm_desert, palo_alto, bend added 2026-06-02)
    r"palm_desert|palo_alto|bend)_v\d+",
    re.IGNORECASE,
)

# Strip Drive numbered-duplicate suffixes like " (1)", "_(12)".
NUMBERED_DUP_RE = re.compile(r"[\s_]\(\d+\)$")


def _normalize_stem(stem: str) -> str:
    """Strip a Drive numbered-duplicate suffix from the stem."""
    return NUMBERED_DUP_RE.sub("", stem)


def is_stray(path: Path, core_rule_names: set[str]) -> bool:
    """Return True if `path`'s basename matches any travel pattern."""
    name = path.name
    stem = path.stem
    stem_clean = _normalize_stem(stem)

    # Direct match against canonical core-rule names (with .gdoc/.pdf/.md.gdoc
    # variants — `.gdoc` adds an extra extension layer).
    candidates = {stem, stem_clean}
    if stem.endswith(".md"):  # for "X.md.gdoc" the .stem strips only .gdoc
        candidates.add(stem[:-3])
    for cand in candidates:
        if cand in core_rule_names:
            return True

    # Brain file prefix match.
    for prefix in BRAIN_FILE_PREFIXES:
        if stem.startswith(prefix) or stem_clean.startswith(prefix):
            return True

    # Trip-doc prefix match.
    for prefix in TRIP_PREFIXES:
        if name.startswith(prefix) or stem.startswith(prefix) or stem_clean.startswith(prefix):
            return True

    # Guide regex match.
    if GUIDE_RE.match(stem_clean):
        return True

    return False


# ─── Scanning ────────────────────────────────────────────────────────────────

def _under_travel(p: Path) -> bool:
    """True if `p` resolves under Travel/."""
    try:
        p.resolve().relative_to(TRAVEL_ROOT.resolve())
        return True
    except ValueError:
        return False


def _default_scan_paths() -> list[Path]:
    home = Path.home()
    return [
        home / "Downloads",
        home / "Desktop",
        home / "Documents",
        DRIVE_ROOT,  # the Drive root — Travel/ is a subfolder, scan excludes it
    ]


def scan(paths: list[Path], core_rule_names: set[str]) -> tuple[list[Path], list[Path]]:
    """Walk paths recursively. Return (strays_found, paths_actually_scanned).

    Dedupes by resolved file path so overlapping scan paths (a parent and a
    descendant both passed in) don't double-count.
    """
    seen: set[Path] = set()
    found: list[Path] = []
    scanned: list[Path] = []
    for root in paths:
        try:
            if not root.exists():
                continue
        except OSError:
            continue
        scanned.append(root)
        try:
            for p in root.rglob("*"):
                try:
                    if not p.is_file():
                        continue
                except OSError:
                    continue
                if _under_travel(p):
                    continue
                try:
                    rp = p.resolve()
                except OSError:
                    continue
                if rp in seen:
                    continue
                if is_stray(p, core_rule_names):
                    seen.add(rp)
                    found.append(p)
        except (OSError, PermissionError):
            # Skip paths the script can't traverse (e.g. perm-denied subdirs).
            continue
    return found, scanned


# ─── Content summary (read-before-move enforcement) ─────────────────────────
#
# Per audit_log.md 2026-05-03: dry-run output must show a one-line content
# summary of every stray BEFORE --apply is run. Prevents the failure mode where
# strays get moved without inspection — surfaced this morning when 4 stray
# To_Do_List*.md.gdoc snapshots were moved blind. Makes "read before move"
# structurally unskippable: the operator sees what's actually inside before
# authorizing the move.

H1_MD_RE = re.compile(r"^\s*#\s+(.+)$", re.MULTILINE)
H1_HTML_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.IGNORECASE | re.DOTALL)


def _human_size(n: int) -> str:
    if n < 1024:
        return f"{n}B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f}KB"
    return f"{n / (1024 * 1024):.1f}MB"


def _content_summary(path: Path) -> str:
    """One-line content summary of a stray. Format varies by extension:
       .gdoc → size + doc_id (the actual content lives in Drive)
       .md / .txt → size + first H1 (or first non-blank line, truncated)
       .html → size + first <h1> (or '<no h1>')
       .pdf / .png / .jpg / etc. → size only
       unreadable → size + 'binary/unreadable'
    """
    try:
        size = _human_size(path.stat().st_size)
    except OSError:
        size = "?"
    suffix = path.suffix.lower()
    name = path.name.lower()
    if name.endswith(".md.gdoc") or suffix == ".gdoc":
        # Drive shortcut — content lives in Google's cloud, on-disk is JSON stub.
        try:
            stub = json.loads(path.read_text(encoding="utf-8", errors="replace"))
            doc_id = stub.get("doc_id", "")
            if doc_id:
                return f"{size}  doc_id={doc_id}"
            return f"{size}  <gdoc — no doc_id in stub>"
        except (OSError, json.JSONDecodeError):
            return f"{size}  <gdoc — stub unreadable>"
    if suffix in (".md", ".txt"):
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return f"{size}  <unreadable>"
        m = H1_MD_RE.search(text)
        if m:
            return f"{size}  H1: {m.group(1).strip()[:80]}"
        # Fall back to first non-blank line.
        for line in text.splitlines():
            stripped = line.strip()
            if stripped:
                return f"{size}  first: {stripped[:80]}"
        return f"{size}  <empty>"
    if suffix in (".html", ".htm"):
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return f"{size}  <unreadable>"
        m = H1_HTML_RE.search(text)
        if m:
            inner = re.sub(r"<[^>]+>", "", m.group(1)).strip()
            return f"{size}  <h1>: {inner[:80]}"
        return f"{size}  <html — no h1>"
    return f"{size}  <{suffix or 'binary'}>"


# ─── Move logic ──────────────────────────────────────────────────────────────

def _safe_dest(src: Path) -> Path:
    """Compute a non-colliding destination under Travel/archive/."""
    base = ARCHIVE_DIR / src.name
    if not base.exists():
        return base
    # Disambiguate using the source's parent directory name.
    tag = "_stray_" + src.parent.name.replace(" ", "_").replace("/", "_")
    cand = ARCHIVE_DIR / f"{src.stem}{tag}{src.suffix}"
    if not cand.exists():
        return cand
    # Last-resort numeric counter.
    i = 1
    while True:
        cand = ARCHIVE_DIR / f"{src.stem}{tag}_{i}{src.suffix}"
        if not cand.exists():
            return cand
        i += 1


def move_strays(strays: list[Path], apply: bool) -> int:
    """Print the move plan; if apply=True, actually mv each one. Return error count.

    Dry-run (apply=False) prints a one-line content summary for each stray
    (size + doc_id for .gdoc, size + first H1 for .md/.html, size only for
    binaries) so the operator can SEE what's about to move before authorizing.
    Per audit_log.md 2026-05-03 — closes the read-before-move gap.
    """
    errors = 0
    for src in strays:
        dest = _safe_dest(src)
        verb = "MOVE  →" if apply else "would →"
        rel_src = str(src)
        # Trim home prefix for readability.
        try:
            rel_src = "~/" + str(src.relative_to(Path.home()))
        except ValueError:
            pass
        print(f"  {verb} {dest.relative_to(TRAVEL_ROOT)}")
        print(f"    from: {rel_src}")
        if not apply:
            # Dry-run: show what's inside before the operator green-lights --apply.
            print(f"    peek: {_content_summary(src)}")
        if apply:
            try:
                shutil.move(str(src), str(dest))
            except Exception as e:  # noqa: BLE001
                print(f"    ERROR: {e}")
                errors += 1
    return errors


# ─── Main ────────────────────────────────────────────────────────────────────

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="sweep_stray_travel",
        description="Find (and optionally move) travel-related files outside Travel/.",
    )
    parser.add_argument("--apply", action="store_true",
                        help="Move each stray to Travel/archive/ (default: report only).")
    parser.add_argument("--scan", action="append", default=[], metavar="PATH",
                        help="Additional path to scan (repeatable).")
    parser.add_argument("--quiet", action="store_true",
                        help="Suppress the 'no strays' confirmation message.")
    args = parser.parse_args(argv)

    core_rule_names = _core_rule_basenames()
    scan_paths = _default_scan_paths() + [Path(p).expanduser() for p in args.scan]

    found, scanned = scan(scan_paths, core_rule_names)

    print("━━━ sweep_stray_travel ━━━")
    print(f"  scanned: {len(scanned)}/{len(scan_paths)} paths reachable")

    if not found:
        print(f"  result:  0 stray travel files outside Travel/")
        print(f"  ✓ HARD RULE (CLAUDE.md) holding")
        return 0

    print(f"  result:  {len(found)} stray travel file{'s' if len(found) != 1 else ''} outside Travel/")
    print()
    errors = move_strays(found, apply=args.apply)
    print()

    if args.apply:
        moved = len(found) - errors
        print(f"  ✓ {moved}/{len(found)} stray file{'s' if len(found) != 1 else ''} moved to Travel/archive/")
        if errors:
            print(f"  ✗ {errors} move error{'s' if errors != 1 else ''} — see ERROR lines above")
            return 2
        return 0

    print(f"  ⚠ rerun with --apply to move them under Travel/archive/")
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except KeyboardInterrupt:
        print("\nsweep_stray_travel: interrupted", file=sys.stderr)
        sys.exit(2)
    except Exception as e:  # noqa: BLE001
        print(f"sweep_stray_travel: unexpected error — {e!r}", file=sys.stderr)
        sys.exit(2)
