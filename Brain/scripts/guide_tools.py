#!/usr/bin/env python3
"""
guide_tools.py — single entry point for the Dani-travel toolchain.

Dispatches to the underlying scripts that each do one thing well:

  validate       →  validate_itinerary.py    (static HTML checks, no network)
  verify         →  verify_urls.py           (fetches every href/src, content-quality gate:
                                              200-status + non-empty prose. Does NOT verify
                                              the page is about the stop's subject — that
                                              gap is closed by verify-booking below.)
  verify-booking →  verify_booking_links.py  (booking-link log coverage + live h1 match for
                                              TripAdvisor/Wikipedia URLs — catches the "URL
                                              returns 200 but points at the wrong subject"
                                              class of bug that verify-urls cannot detect.
                                              Wired into the ship chain 2026-04-24 after
                                              Dani confirmed the gap — prior to this it
                                              existed as an orphan script with no single-
                                              entry-point callability. Enforcement anchors:
                                              cleanliness_checks.md rules 157/158/159.)
  photo          →  commons_photo.py         (Wikimedia Commons filename → canonical thumb URL)
  brain-check    →  brain_check.py           (Brain integrity: required §§, files, pointers)
  sweep-stray    →  sweep_stray_travel.py    (enforces CLAUDE.md § HARD RULE: scan ~/Downloads,
                                              ~/Desktop, ~/Documents, and the Drive root outside
                                              Travel/ for travel-named files that escaped the
                                              behavioral push-back rule — Drive sync byproducts,
                                              browser downloads, manual copies. Added 2026-04-30
                                              after Dani found 75 stray files outside Travel/.
                                              Runs at every session start per CLAUDE.md
                                              § Session start step 2. Pass --apply to relocate
                                              found strays to Travel/archive/)
  pdf            →  render_pdf.py            (render the dev guide to PDF via headless Chromium
                                              at 500px viewport — inherits the mobile CSS — at
                                              5.5"×11" portrait; output written next to source
                                              as {name}.pdf. This is the canonical phone-reading
                                              artifact — see Rules for Claude.html § 8.
                                              ON-DEMAND ONLY per Dani 2026-04-24 — NOT wired
                                              into the ship chain; callable as a standalone
                                              subcommand only when Dani asks for a PDF)
  validate-pdf   →  validate_pdf.py          (post-render gate — re-renders the dev guide in
                                              headless Chromium at the same 500px/@media-screen
                                              setup `render_pdf.py` uses, then verifies every
                                              .stop-photos img renders in the 370-400px band
                                              and every .stop-block/.stop-photos has computed
                                              break-inside: avoid. Catches the flex-basis-kills-
                                              height class of bug that static HTML checks miss.
                                              ON-DEMAND ONLY — runs only after `pdf` is invoked
                                              on demand; not part of the automatic ship chain)
  ship           →  validate + verify + verify-booking
                                              (pre-ship pipeline: static HTML checks, then live
                                              URL/content checks, then booking-link log coverage
                                              + subject-drift catch. Fails fast on the first
                                              non-zero script. On a clean pass it also auto-ticks
                                              every remaining [ ] in the guide's
                                              _build/build_state.md (added 2026-06-12) so the
                                              tracker can't drift from reality — previously the
                                              final Ship Checklist box was a manual edit that got
                                              skipped even on shipped guides. Retired 2026-04-24 — the former
                                              `validate + verify + pdf + validate-pdf` chain
                                              was cut to `validate + verify` per Dani's direction
                                              that PDF rendering should be on-demand only.
                                              Extended 2026-04-24 — `verify-booking` added to
                                              close the subject-drift gap; prior chain let
                                              guides ship with URLs that returned 200 but
                                              pointed at the wrong subject — see `ship` function
                                              body for both retirement/extension markers)
  start          →  session startup         (runs brain-check + sweep-stray, then prints
                                              open To Do items. One command replaces the
                                              manual 7-step session ritual. Added 2026-05-09.)
  update-index   →  5-step ship tail        (verifies all 5 post-build steps for a city:
                                              guides_index.html card, prev/next wiring,
                                              banner counts, toolbar-mount data-prev/next,
                                              and map pin. Run after completing each step
                                              manually — the command confirms all 5 are done
                                              before the guide is shipped. Added 2026-06-11.)
  sync-css       →  CSS sync               (copies Brain/Reference/Guide Style.css to
                                              assets/guide_v3.css — the canonical step after
                                              any CSS edit. Machine-enforced alternative to
                                              the manual DriftyCat copy step. Added 2026-06-11.)
  preflight      →  pre-HTML gate           (reads Guides/{City}/_build/build_state.md and
                                              verifies every Phase 0, 1, and 2 checkbox is
                                              [x]. Exits non-zero with a list of unchecked
                                              files if any are missing. Must pass before
                                              writing the first line of guide HTML. Phase 0
                                              = Rules for Claude.html; Phases 1+2 = all
                                              technical + structural prereads.
                                              Added 2026-06-10.)
  audit          →  open the deep-review     (prints the four audit questions and the file
                                              inventory, stamps a new dated entry into
                                              Brain/Reference/audit_log.md; Claude does the actual
                                              review in conversation per §Brain Audit)

Rationale: one entry point, but the underlying
modules stay separate so each can be reasoned about, tested, and debugged
independently. This file is a router.

Usage:
  python3 guide_tools.py validate       <file.html>
  python3 guide_tools.py verify         <file.html>
  python3 guide_tools.py verify-booking <file.html>    # log coverage + h1 match
  python3 guide_tools.py photo          "File:{Commons_File_Name}.jpg"
  python3 guide_tools.py brain-check    [--verbose]
  python3 guide_tools.py sweep-stray    [--apply] [--scan PATH] [--quiet]
  python3 guide_tools.py pdf            <file.html>    # render {name}.pdf for phone
  python3 guide_tools.py validate-pdf   <file.html>    # post-render gate (no output file)
  python3 guide_tools.py ship           <file.html>    # full pre-ship pipeline
  python3 guide_tools.py start                          # session startup: brain-check + sweep-stray + to-do summary
  python3 guide_tools.py init            <City>         # create build-state tracker for a new guide build
  python3 guide_tools.py preflight       <City>         # pre-HTML gate: verify Phase 0-2 reads done
  python3 guide_tools.py update-index    <City>         # 5-step ship tail: index card, prev/next, counts, toolbar, map pin
  python3 guide_tools.py sync-css                       # copy Brain/Reference/Guide Style.css → assets/guide_v3.css
  python3 guide_tools.py audit                         # open audit workflow
  python3 guide_tools.py staleness      [--backfill]    # list guides built under an older format version (drift report)
  python3 guide_tools.py test                           # run Brain/tests/ fixture suite (Rule 56)

Exit code matches the underlying script; `ship` fails fast on the first
non-zero script from the gate chain (validate/verify/verify-booking). PDF
production is on-demand only per Dani 2026-04-24 — `pdf` and `validate-pdf`
are no longer part of the automatic `ship` chain; they run only as standalone
subcommands when Dani asks for a PDF.
"""

import datetime as _dt
import json
import re
import runpy
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent       # Brain/scripts/  (was Brain/ pre-2026-04-30)
BRAIN_DIR = HERE.parent                       # Brain/
TRAVEL_ROOT = BRAIN_DIR.parent                # Travel/
WEB_ROOT = TRAVEL_ROOT / "Travel-Website"     # Travel/Travel-Website/ — the published site root (2026-06-13 reorg). Guides/, Trip-Essentials/, assets/, index.html live here.
ASSETS_DIR = WEB_ROOT / "assets"              # shared js/css: toolbar.js, footnote.js, weather.js, guide_v3.css, mobile.css, climate.json
MDS_DIR = BRAIN_DIR / "Reference"                # was Brain/mds/ — merged 2026-06-15
AUDIT_LOG = MDS_DIR / "audit_log.md"
SHIP_LOG  = BRAIN_DIR / "Reference" / "ship_log.md"   # Rule 125: RETIRED — ship logs are now per-guide (guide_folder/ship_log.md). This constant is kept only so old code references don't hard-crash; _write_ship_log ignores it.
TESTS_DIR = BRAIN_DIR / "tests"           # Rule 56: fixture directory          # 2026-05-03: corrected from Brain/Reference/audit_log.md — path mismatched the on-disk file (which lives at Brain/Reference/audit_log.md per brain_check.py REQUIRED_FILES). `guide_tools.py audit` was writing to the wrong location.

SUBCOMMANDS = {
    "validate":       "validate_itinerary.py",
    "verify":         "verify_urls.py",
    "verify-booking": "verify_booking_links.py",
    "photo":          "commons_photo.py",
    "brain-check":    "brain_check.py",
    "sweep-stray":    "sweep_stray_travel.py",   # added 2026-04-30: enforces HARD RULE (all travel work under Travel/)
    "mobile-check":   "mobile_check.py",          # added 2026-06-12: viewport + mobile.css baseline across shareable pages
    "validate-safety": "validate_safety_guide.py", # added 2026-06-19: Safety Guide coverage — every guides_index city has exactly one row
    "pdf":            "render_pdf.py",
    "validate-pdf":   "validate_pdf.py",
    # test — handled by _run_tests() (Rule 56); not a script delegation
    # bundle_guide.py — retired 2026-04-22; share HTML dropped in favour of PDF
    # as the sole shippable artifact. Archived at Travel/archive/bundle_guide_retired_2026-04-22.py.
}

USAGE = __doc__.strip()

AUDIT_QUESTIONS = """\
The four audit questions — baked in, never needs re-prompting (per §Brain Audit):

  1. Conduct a thorough review of all the documents under the Travel folder
     to identify what is wrong and what needs fixing.
  2. Are there any other rules or pointers that you need to fix or build?
     Anything else you can think of to improve this system?
  3. What is wrong, outdated, or broken? (file paths that no longer match,
     pointers to retired sources, validators that silently skip, rules that
     contradict each other, rules whose reason is a resolved one-off incident)
  4. Can any document be polished further without losing important content?
     (polish = clearer phrasing, tightening within a paragraph — NOT removing
     or consolidating rules; removals require explicit permission per
     §Permissioning)
"""


def _patch_verification_log(guide_path: Path) -> None:
    """
    Auto-sync _meta.guide and _meta.updated in verification_log.json before the
    ship gate runs. This prevents the log from going stale on version bumps
    (e.g. pasadena_v1 → pasadena_v2) without any manual step.

    Log lives at _build/verification_log.json (moved 2026-05-09; root is back-compat fallback).
    Silent no-op if the log doesn't exist yet (guides with no bot-blocked booking
    URLs don't need one).
    """
    # verification_log.json lives inside _build/ (moved 2026-05-09 when assets/ moved there too).
    # Fallback to guide root for any pre-migration guide that still has it there.
    log_path = guide_path.parent / "_build" / "verification_log.json"
    if not log_path.exists():
        log_path = guide_path.parent / "verification_log.json"
    if not log_path.exists():
        return
    try:
        data = json.loads(log_path.read_text(encoding="utf-8"))
        meta = data.setdefault("_meta", {})
        old_guide = meta.get("guide", "")
        new_guide = guide_path.name
        today = _dt.date.today().isoformat()
        if old_guide != new_guide or meta.get("updated") != today:
            meta["guide"] = new_guide
            meta["updated"] = today
            log_path.write_text(
                json.dumps(data, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            if old_guide and old_guide != new_guide:
                print(f"  ℹ️  verification_log.json: _meta.guide patched "
                      f"{old_guide!r} → {new_guide!r}")
    except Exception as e:
        print(f"⚠️  Could not patch verification_log.json _meta: {e}", file=sys.stderr)


def _run(script: str, argv_tail: list[str]) -> int:
    """Run a sibling script with argv[0]=script and argv[1:]=tail."""
    target = HERE / script
    if not target.exists():
        print(f"❌ Missing companion script: {target}", file=sys.stderr)
        return 2
    # Wire argv so the target script sees itself as invoked directly.
    saved = sys.argv
    sys.argv = [str(target), *argv_tail]
    try:
        runpy.run_path(str(target), run_name="__main__")
        return 0
    except SystemExit as e:  # scripts use sys.exit() for non-zero codes
        code = e.code
        return int(code) if isinstance(code, int) else (0 if code is None else 1)
    finally:
        sys.argv = saved


def _audit_file_inventory() -> list[str]:
    """List every file under Travel/ grouped by folder — the audit's review surface."""
    lines: list[str] = []
    # Walk all immediate subdirectories (skip __pycache__ and hidden dirs).
    subdirs = sorted(
        p for p in TRAVEL_ROOT.iterdir()
        if p.is_dir() and not p.name.startswith(".")
        and "__pycache__" not in p.parts
    )
    for sub in subdirs:
        lines.append(f"\n### {sub.name}/")
        for p in sorted(sub.rglob("*")):
            if p.is_file() and "__pycache__" not in p.parts and not p.name.startswith("."):
                rel = p.relative_to(TRAVEL_ROOT)
                lines.append(f"  - {rel}")
    # Root-level files (CLAUDE.md, .html rule files, etc.).
    lines.append("\n### Travel/ (root)")
    for p in sorted(TRAVEL_ROOT.iterdir()):
        if p.is_file() and not p.name.startswith("."):
            lines.append(f"  - {p.name}")
    return lines


def _open_audit() -> int:
    """Open the audit workflow: print questions + inventory, stamp audit_log.md."""
    today = _dt.date.today().isoformat()
    print("━━━ audit ━━━")
    print(AUDIT_QUESTIONS)
    print("\nReview surface — every file under Travel/:")
    for line in _audit_file_inventory():
        print(line)
    print(f"\nToday: {today}")
    print(f"Audit log: {AUDIT_LOG.relative_to(TRAVEL_ROOT)}")

    # Stamp a placeholder entry so Claude can fill in findings during conversation.
    # Don't overwrite an existing entry for today; append a fresh sub-heading instead.
    stamp = f"\n## {today}\n**Trigger.** keyword\n_(audit in progress — Claude fills in findings, fixes-in-session, and parked items per §Brain Audit)_\n"
    try:
        existing = AUDIT_LOG.read_text(encoding="utf-8") if AUDIT_LOG.exists() else ""
        if f"## {today}" not in existing:
            # Prepend after the preamble: find the first "---" divider and insert below.
            if "---\n" in existing:
                head, _, rest = existing.partition("---\n")
                AUDIT_LOG.write_text(f"{head}---\n{stamp}\n{rest}", encoding="utf-8")
            else:
                AUDIT_LOG.write_text(existing + stamp, encoding="utf-8")
            print(f"\nStamped new entry: ## {today}")
        else:
            print(f"\nEntry ## {today} already present — Claude will append findings under it.")
    except OSError as e:
        print(f"\n⚠ could not stamp audit log: {e}", file=sys.stderr)
        return 2
    return 0



def _in_progress_builds():
    """Guide folders that look unfinished — a build tracker with Phase 6 still
    unchecked (not shipped) and/or no guide HTML yet. Returns [(city, detail)].

    These are NEVER archived or cleaned up: a stalled crib's work is resumable —
    another crib finishes it from build_state.md. Surfaced at session start as a
    flag only, so Dani can check later. Full rule: Rules for Claude.html § 4.
    """
    out = []
    gd = WEB_ROOT / "Guides"
    if not gd.is_dir():
        return out
    for d in sorted(gd.iterdir()):
        if not d.is_dir():
            continue
        bs = d / "_build" / "build_state.md"
        if not bs.is_file():
            continue
        try:
            txt = bs.read_text(encoding="utf-8")
        except Exception:
            continue
        idx = txt.find("## Phase 6")
        phase6 = txt[idx:] if idx != -1 else ""
        has_html = bool(list(d.glob("*.html")))
        phase6_open = "[ ]" in phase6
        if not has_html:
            out.append((d.name, "no guide HTML yet"))
        elif phase6_open:
            out.append((d.name, "Phase 6 unchecked (not yet shipped)"))
    return out


def _run_start() -> int:
    """
    Session startup in one command — replaces the manual multi-step ritual.

    Steps:
      1. brain-check  (must exit 0 before anything else)
      2. sweep-stray  (surface strays; does NOT auto-apply — still needs --apply to move)
      3. Print open To Do items (🔧 Rules for Update + ❓ Questions for Dani sections)
    """
    import subprocess

    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  🧠  Session startup — guide_tools.py start")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    # Step 1: brain-check
    print("▶ Step 1/4 — brain-check")
    rc1 = _run(SUBCOMMANDS["brain-check"], [])
    if rc1 != 0:
        print("\n🚫  brain-check failed — fix before any task work.\n", file=sys.stderr)
        return rc1

    # Step 2: sweep-stray (dry run — no --apply)
    print("\n▶ Step 2/4 — sweep-stray (dry run)")
    rc2 = _run(SUBCOMMANDS["sweep-stray"], [])
    # sweep-stray exit 1 means strays found — surface them but don't block session
    if rc2 not in (0, 1):
        print("\n⚠  sweep-stray returned unexpected exit code — check output above.", file=sys.stderr)

    # Step 3: mobile-check (audit only — surface shareable pages missing viewport
    # or the mobile.css baseline; never auto-applies at session start. Mirrors the
    # sweep-stray pattern: report, don't block. Run --apply to fix. (added 2026-06-12)
    print("\n▶ Step 3/4 — mobile-check (audit)")
    _run(SUBCOMMANDS["mobile-check"], [])

    # Step 4: open To Do items
    print("\n▶ Step 4/4 — open To Do items")
    todo_path = TRAVEL_ROOT / "To Do List" / "To_Do_List.md"
    if not todo_path.exists():
        print("  ⚠  To_Do_List.md not found — skipping.")
    else:
        text = todo_path.read_text(encoding="utf-8")
        sections = {
            "🔧 Rules for Update": [],
            "❓ Open Questions": [],
            "✈️ My Tasks": [],
        }
        current = None
        SKIP = {
            "*(empty — all rules applied)*",
            "*(empty — no open questions)*",
            "*(empty)*",
        }
        for line in text.splitlines():
            for heading in sections:
                if heading in line and line.startswith("#"):
                    current = heading
                    break
            else:
                stripped = line.strip()
                if (current and stripped
                        and not line.startswith("#")
                        and not line.startswith(">")
                        and not (stripped.startswith("*") and stripped.endswith("*"))  # skip italic instructions
                        and stripped not in SKIP
                        and not stripped.startswith("---")):
                    sections[current].append(line)

        for heading, lines in sections.items():
            real = [l for l in lines if l.strip() and l.strip() not in SKIP]
            if real:
                print(f"\n  {heading}:")
                for l in real[:8]:  # cap at 8 lines per section
                    print(f"    {l}")
            else:
                print(f"\n  {heading}: (empty)")

    # Step 5: in-progress builds — FLAG ONLY, never archived or cleaned up
    print("\n▶ Step 5/5 — In-progress builds (flag only — never archive)")
    _ip = _in_progress_builds()
    if _ip:
        print("  🚧 These guides look unfinished — a crib may have stalled mid-build.")
        print("     They are NEVER archived, removed, or 'cleaned up'. Resume one from")
        print("     its _build/build_state.md, or just leave it — check later.")
        for _name, _detail in _ip[:30]:
            print(f"     • {_name} — {_detail}")
        if len(_ip) > 30:
            print(f"     …and {len(_ip) - 30} more")
    else:
        print("  none — every tracked build is shipped.")

    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  ✅  Session startup complete.")
    print()
    print("  📖  Session reads (complete ritual steps 3–6):")
    print("       Read  Brain/CORE RULES/Rules for Claude.html")
    print("       Check Brain/Reference/Platforms.md     (note any ❌ or ⏳)")
    print("       Read  Brain/Reference/Connectors.html")
    print("       Check Brain/Reference/audit_log.md           (note if last entry > 7 days ago)")
    print()
    print("  🏗   Before ANY guide build — Phase 1 reads (in this order, before researching):")
    print("       1. Brain/CORE RULES/Links.html")
    print("       2. Brain/CORE RULES/Photos Rules.html")
    print("       3. Brain/Reference/Connectors.html   ← connectors + research workflow")
    print("       4. Brain/Reference/Platforms.md      ← which platforms need site: search")
    print()
    print("       Then run: python3 Brain/scripts/guide_tools.py init {City}")
    print("       This creates the build-state tracker. Do it before researching anything.")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
    return 0


def _run_init(city: str) -> int:
    """
    Create a pre-filled build-state tracker for a new guide build.

    Creates Guides/{City}/_build/build_state.md with all Phase 0–6 checkboxes
    unchecked. Claude checks them off as it reads each file and completes each
    phase. The validator reads this file at ship time and fails if any required
    entry is unchecked.

    Added 2026-06-01: removes the friction of manually writing the tracker,
    which caused Claude to skip creating it and bypass the phase-read enforcement.
    """
    today = _dt.date.today().isoformat()
    build_dir = WEB_ROOT / "Guides" / city / "_build"
    build_dir.mkdir(parents=True, exist_ok=True)
    tracker_path = build_dir / "build_state.md"

    if tracker_path.exists():
        print(f"⚠  build_state.md already exists at {tracker_path}")
        print("   Delete or rename it before running init for a fresh build.")
        return 1

    content = f"""# Build state — {city}
Started: {today}
Last updated: {today}

## Phase 0 — Session start
- [ ] Rules for Claude.html
- [ ] Format + content sourced ONLY from CORE RULES and live research — NO sibling guide in Guides/ opened as a template, shape reference, or content source (reading another guide imports its drift; one stale guide becomes many)

## Phase 1 — Technical prerequisites
- [ ] Links.html
- [ ] Photos Rules.html
- [ ] Connectors.html
- [ ] Platforms.md

## Phase 2 — Guide structure
- [ ] Guide Structure.html
- [ ] Stops Structure.html
- [ ] Hotel Banner.html
- [ ] Trip Overview.html
- [ ] Toolbar.html
- [ ] Navigation.html

## Phase 3 — Day shape
- [ ] Day Structure.html

## Phase 4 — Per-stop build
- [ ] Tickets.html
- [ ] Motion Rule.html
- [ ] Icon Order and Format.html

## Phase 5 — Per-section build
- [ ] Weekly Closures - Extra Section.html
- [ ] Tours - Extra Section.html
- [ ] Cappuccino - Extra Section.html
- [ ] Restaurants Near Hotel - Extra Section.html
- [ ] Downtown Restaurants - Extra Section.html
- [ ] Local Tastes - Extra Section.html
- [ ] Food Delivery - Extra Section.html
- [ ] Shows, Performances & Concerts - Extra Section.html
- [ ] Getting Around - Extra Section.html
- [ ] Train Stations Near Hotel - Extra Section.html
- [ ] Day Trips by Train - Extra Section.html
- [ ] Michelin Restaurants - Extra Section.html
- [ ] Heads Up - Extra Section.html
- [ ] Claude Inspiration - Extra Section.html

## Phase 6 — Ship gate
- [ ] Brain/Reference/Ship Checklist.html
- [ ] validate_itinerary.py passes
- [ ] every extra populated or carries negative-finding line
"""
    tracker_path.write_text(content, encoding="utf-8")
    print(f"✅  Build-state tracker created: {tracker_path}")
    print()
    print("   Next steps:")
    print("   1. Read Phase 1 files and check them off as [x]")
    print("   2. Read Phase 2 files and check them off as [x]")
    print("   3. Look up the hotel in Travel-Website/Trip-Essentials/Trips.html")
    print("   4. Start researching stops — check Brain/Reference/Brain.md (Part 4 — Cities Skip List) first")
    return 0


def _run_preflight(city: str) -> int:
    """
    Pre-HTML gate: verify Phase 0, 1, and 2 reads are done before writing any guide HTML.

    Reads Guides/{City}/_build/build_state.md and checks that every checkbox in
    Phase 0, Phase 1, and Phase 2 is [x]. Exits non-zero with a list of unchecked
    files if any are still [ ].

    This is the hard gate that enforces the CLAUDE.md HARD GATE rule:
    "No HTML before Phase 0-2 reads are complete."

    Run this before writing the first line of guide HTML. HTML must not exist
    before this exits 0.

    Added 2026-06-10.
    """
    build_dir = WEB_ROOT / "Guides" / city / "_build"
    tracker_path = build_dir / "build_state.md"

    if not tracker_path.exists():
        print(
            f"\n🚫  PREFLIGHT FAILED — build_state.md not found for {city!r}.\n"
            f"    Run first: python3 guide_tools.py init {city}\n"
            f"    Then read Phase 0–2 files, check them off as [x], and re-run preflight.\n",
            file=sys.stderr,
        )
        return 1

    content = tracker_path.read_text(encoding="utf-8")
    lines = content.splitlines()

    # Collect unchecked items inside Phase 0, 1, 2 blocks only.
    # Stop collecting when Phase 3 or later begins.
    PHASE_EARLY = {"## Phase 0", "## Phase 1", "## Phase 2"}
    PHASE_LATE  = {"## Phase 3", "## Phase 4", "## Phase 5", "## Phase 6"}
    in_early = False
    unchecked: list[str] = []

    for line in lines:
        stripped = line.strip()
        if any(stripped.startswith(p) for p in PHASE_EARLY):
            in_early = True
        elif any(stripped.startswith(p) for p in PHASE_LATE):
            in_early = False
        if in_early and stripped.startswith("- [ ]"):
            unchecked.append(stripped[5:].strip())

    if unchecked:
        print(
            f"\n🚫  PREFLIGHT FAILED — {len(unchecked)} Phase 0–2 read(s) not yet done:\n",
            file=sys.stderr,
        )
        for item in unchecked:
            print(f"    ☐  {item}", file=sys.stderr)
        print(
            f"\n    In build_state.md: change each [ ] to [x] after reading the file.\n"
            f"    Then re-run: python3 guide_tools.py preflight {city}\n",
            file=sys.stderr,
        )
        return 1

    print(f"\n✅  PREFLIGHT PASSED — all Phase 0–2 reads complete for {city}.")
    print(f"    You may now write guide HTML.")
    print(f"    Reminder: format = CORE RULES, content = live research. Never open a")
    print(f"    sibling guide as a template — it imports that guide's drift.\n")
    return 0


def _check_guide_indexed(guide_path: Path) -> int:
    """
    Ship gate: verify this specific guide's city folder is in guides_index.html.

    Each crib checks only its own guide — not all guides. Fires at ship time only.
    The city folder is the parent directory of the guide HTML file
    (e.g. Guides/Edinburgh/ for Guides/Edinburgh/edinburgh_v1.html).

    Added 2026-06-02: replaced check_guides_index_coverage in brain_check.py,
    which ran at session start and incorrectly flagged other cribs' in-progress
    builds. This check is scoped to one guide, runs only at ship time, and each
    crib only validates its own guide's entry.
    """
    guides_dir = WEB_ROOT / "Guides"
    index_file = guides_dir / "guides_index.html"

    if not index_file.exists():
        print(
            "\n🚫  SHIP BLOCKED — Guides/guides_index.html missing.\n"
            "    The master index does not exist.\n",
            file=sys.stderr,
        )
        return 1

    city_folder = guide_path.parent.name  # e.g. "Edinburgh"
    index_html = index_file.read_text(encoding="utf-8")

    if f"./{city_folder}/" not in index_html and f'href="./{city_folder}/' not in index_html:
        print(
            f"\n🚫  SHIP BLOCKED — guides_index.html has no entry for Guides/{city_folder}/.\n"
            f"    Complete the 4-step index update before shipping:\n"
            f"    Brain/Reference/Navigation.html § 5\n",
            file=sys.stderr,
        )
        return 1

    print(f"  ✅  guides_index.html — {city_folder} entry found.")
    return 0


def _check_guide_pinned(guide_path: Path) -> int:
    """
    Ship gate: verify this guide's city has a pin in at least one map file.

    All seven region maps are checked:
      Europe Map, US Map, Asia Map, Africa Map, Oceania Map, South America Map,
      Caribbean Map.
    The city name just needs to be present in one of them.

    Added 2026-06-02: enforces Navigation.html § 5 step 5 (map pin rule).
    Updated 2026-06-02: expanded from 2 maps to all 6 continent maps.
    Updated 2026-06-13: added Caribbean Map (7th) — Travel-Website reorg pin target.
    """
    city_folder = guide_path.parent.name  # e.g. "Amsterdam"
    essentials = WEB_ROOT / "Trip-Essentials"
    maps_dir  = essentials / "Maps"
    map_files = [
        maps_dir / "Europe-Map.html",
        maps_dir / "US-Map.html",
        maps_dir / "Asia-Map.html",
        maps_dir / "Africa-Map.html",
        maps_dir / "Oceania-Map.html",
        maps_dir / "South-America-Map.html",
        maps_dir / "Caribbean-Map.html",
    ]

    # Match by EITHER the city-name label OR the guide's href path in the PINS
    # array. The href path (Guides/{folder}/{file}) is locale-proof, so pins whose
    # display label differs from the folder name ('The Bahamas', 'Curaçao') resolve.
    href_key = f"Guides/{city_folder}/{guide_path.name}"
    found_in = None
    for map_file in map_files:
        if not map_file.exists():
            continue
        content = map_file.read_text(encoding="utf-8")
        # PINS entries look like: ['CityName', lon, lat, ...] or ["CityName", ...]
        if (f"['{city_folder}'" in content or f'["{city_folder}"' in content
                or href_key in content):
            found_in = map_file.name
            break

    if found_in:
        print(f"  ✅  Map pin — {city_folder} found in {found_in}.")
        return 0

    print(
        f"\n🚫  SHIP BLOCKED — no map pin found for {city_folder}.\n"
        f"    Add a pin to the appropriate continent map before shipping:\n"
        f"    • European guides   → Trip-Essentials/Maps/Europe Map.html\n"
        f"    • US/Canada guides  → Trip-Essentials/Maps/US Map.html\n"
        f"    • Asian guides      → Trip-Essentials/Maps/Asia Map.html\n"
        f"    • African guides    → Trip-Essentials/Maps/Africa Map.html\n"
        f"    • Oceania guides    → Trip-Essentials/Maps/Oceania Map.html\n"
        f"    • S. America guides → Trip-Essentials/Maps/South America Map.html\n"
        f"    • Caribbean guides  → Trip-Essentials/Maps/Caribbean Map.html\n"
        f"    Entry format in the PINS array:\n"
        f"    ['{city_folder}', lon, lat, '../../Guides/{city_folder}/file.html']\n"
        f"    Full rule: Brain/Reference/Navigation.html § 5 step 5\n",
        file=sys.stderr,
    )
    return 1


def _check_guide_in_status_dots(guide_path: Path) -> int:
    """Ship gate: verify the city is listed in Status Dots — guides_index.md.

    Checks that the city folder name appears anywhere in the Status Dots file
    (main country list OR stalled section). A completely absent city means the
    guide shipped without ever being added to the status tracking document —
    the status dot on the index card cannot reflect reality.

    Hard-fails if the city is not mentioned at all. If the city only appears in
    the stalled section, brain_check.check_status_dots_stalled_builds() will
    catch that at the next session start — so this gate just enforces presence.

    Added 2026-06-15.
    """
    city_folder = guide_path.parent.name  # e.g. "Naples"
    status_dots = MDS_DIR / "Status Dots — guides_index.md"

    if not status_dots.exists():
        print(
            "\n🚫  SHIP BLOCKED — Brain/Reference/Status Dots — guides_index.md missing.\n",
            file=sys.stderr,
        )
        return 1

    content = status_dots.read_text(encoding="utf-8", errors="replace")

    # A match means the city name appears on a bullet line anywhere in the file
    # (e.g. "- [ ] Naples", "- [x] Naples", "- Naples (Italy) — ...")
    import re as _re
    pattern = _re.compile(
        r'^\s*-\s+(?:\[.\]\s+)?' + _re.escape(city_folder) + r'\b',
        _re.MULTILINE | _re.IGNORECASE,
    )
    if pattern.search(content):
        print(f"  ✅  Status Dots — {city_folder} found in guides_index.md.")
        return 0

    print(
        f"\n🚫  SHIP BLOCKED — {city_folder} has no entry in Status Dots — guides_index.md.\n"
        f"    Add it to the appropriate country section before shipping:\n"
        f"    Brain/Reference/Status Dots — guides_index.md\n"
        f"    Format:  - [ ] {city_folder}   (blue dot = want-to-go default)\n"
        f"             - [x] {city_folder}   (green dot = already been)\n",
        file=sys.stderr,
    )
    return 1


def _check_guide_fmap(guide_path: Path) -> int:
    """Ship gate: verify the guide has an entry in the FMAP block of guides_index.html.

    The FMAP (flight-time map data) in guides_index.html must have an entry for
    every mosaic dest-card. validate_flight_index.py enforces this on both sides
    (card without FMAP = fail; FMAP without card = orphan). This ship gate catches
    the forward direction: the guide being shipped has no FMAP entry, meaning the
    flight-time view will silently omit it.

    Matches on the city folder name anywhere in the FMAP block (loose match, so
    folder-name changes or file version bumps still pass if the key contains the
    city name).

    Added 2026-06-15.
    """
    import json as _json
    import re as _re

    city_folder = guide_path.parent.name  # e.g. "Amsterdam"
    guides_dir = WEB_ROOT / "Guides"
    index_file = guides_dir / "guides_index.html"

    if not index_file.exists():
        # Already caught by _check_guide_indexed — skip here
        return 0

    html = index_file.read_text(encoding="utf-8", errors="replace")

    # Extract FMAP block
    fmap_m = _re.search(r"var FMAP = (\{.*?\});", html, _re.DOTALL)
    if not fmap_m:
        # FMAP block absent — validate_flight_index.py will catch this; don't
        # double-fail at ship time with a less informative message.
        print(f"  ⚠️  FMAP block not found — skipping FMAP check for {city_folder}.")
        return 0

    try:
        fmap = _json.loads(fmap_m.group(1))
    except _json.JSONDecodeError:
        print(f"  ⚠️  FMAP block is not valid JSON — skipping FMAP check for {city_folder}.")
        return 0

    # Check: any FMAP key contains the city folder name
    folder_lower = city_folder.lower()
    matched_key = next(
        (k for k in fmap if folder_lower in k.lower()),
        None,
    )
    if matched_key:
        print(f"  ✅  FMAP entry — {city_folder} found ({matched_key}).")
        return 0

    print(
        f"\n🚫  SHIP BLOCKED — no FMAP entry found for {city_folder} in guides_index.html.\n"
        f"    Add a FMAP entry to the var FMAP block so the flight-time view includes this guide.\n"
        f"    Schema: \"{city_folder}/file.html\": {{\"t\": \"Xh Ym\", \"m\": N, \"r\": \"nonstop\", "
        f"\"d\": \"N h Nm\", \"i\": \"AAA\", \"h\": null, \"rg\": \"RegionName\", \"o\": \"{city_folder}/file.html\"}}\n"
        f"    Full rule: Brain/Reference/Validator Index.html — FMAP section.\n",
        file=sys.stderr,
    )
    return 1


def _check_guide_in_climate(guide_path: Path) -> int:
    """Ship gate: verify the city has climate normals in BOTH data sources that
    power the two Weather toolbar tabs — assets/climate.json (the source) AND the
    baked CLIMATE block in assets/weather.js (what By Climate = Climate Finder and
    By City = Weather.html actually read via window.TravelClimate).

    A guide that ships without climate normals is silently absent from BOTH Weather
    tabs (its city never appears in the picker or the by-climate search). This gate
    blocks that.

    Fix: ensure the map pin exists first (build_climate.py reads the map pins to
    know which cities to fetch), then run build_climate.py to fetch + bake the new
    city into climate.json and weather.js.

    Added 2026-06-15.
    """
    import json as _json
    import re as _re

    city_folder = guide_path.parent.name  # e.g. "Naples"
    climate_json = ASSETS_DIR / "climate.json"
    weather_js = ASSETS_DIR / "weather.js"
    cf_lower = city_folder.lower()
    missing = []

    # climate.json — keys are guide folder names
    if not climate_json.exists():
        missing.append("assets/climate.json (file missing)")
    else:
        try:
            data = _json.loads(climate_json.read_text(encoding="utf-8", errors="replace"))
            keys = {k.lower() for k in data if k != "_meta"}
            if cf_lower not in keys:
                missing.append("assets/climate.json")
        except _json.JSONDecodeError:
            missing.append("assets/climate.json (unparseable)")

    # weather.js — the baked CLIMATE block the Weather tabs actually read
    if not weather_js.exists():
        missing.append("assets/weather.js (file missing)")
    else:
        wjs = weather_js.read_text(encoding="utf-8", errors="replace")
        m = _re.search(
            r"CLIMATE_DATA_START\s*\*/\s*var CLIMATE = (\{.*?\});\s*/\*\s*CLIMATE_DATA_END",
            wjs, _re.DOTALL,
        )
        baked_ok = False
        if m:
            try:
                baked = _json.loads(m.group(1))
                baked_ok = cf_lower in {k.lower() for k in baked}
            except _json.JSONDecodeError:
                baked_ok = False
        if not baked_ok:
            # fallback: a bare key search, in case the markers moved
            baked_ok = _re.search(r'"' + _re.escape(city_folder) + r'"\s*:', wjs, _re.IGNORECASE) is not None
        if not baked_ok:
            missing.append("assets/weather.js (baked CLIMATE block)")

    # Climate Finder GUIDE_LINKS — the By Climate tab links each result card to its
    # guide via a hardcoded GUIDE_LINKS map. weather.js coverage only makes the city
    # *appear*; without a GUIDE_LINKS entry the By Climate card is a dead, non-clickable
    # tile with no link to the guide. By City (Weather.html) is pure weather lookup and
    # needs no per-page link, so this is the one asymmetric gap between the two tabs.
    # (Added 2026-06-15 — caught Azores + Dubrovnik shipping without By-Climate links.)
    climate_finder = WEB_ROOT / "Trip-Essentials" / "Climate-Finder.html"
    if not climate_finder.exists():
        missing.append("Trip-Essentials/Climate-Finder.html (file missing)")
    else:
        cf_text = climate_finder.read_text(encoding="utf-8", errors="replace")
        gm = _re.search(r"var GUIDE_LINKS\s*=\s*\{(.*?)\};", cf_text, _re.DOTALL)
        gl = dict(_re.findall(r'"([^"]+)"\s*:\s*"([^"]+)"', gm.group(1))) if gm else {}
        gl_lower = {k.lower(): v for k, v in gl.items()}
        href = gl_lower.get(cf_lower)
        if not href:
            missing.append("Climate Finder GUIDE_LINKS (By Climate guide link)")
        else:
            target = (climate_finder.parent / href).resolve()
            if not target.exists():
                missing.append(f"Climate Finder GUIDE_LINKS target unresolved ({href})")

    if not missing:
        print(f"  ✅  Climate data — {city_folder} present in both Weather tabs (climate.json + weather.js + By-Climate guide link).")
        return 0

    print(
        f"\n🚫  SHIP BLOCKED — {city_folder} is incomplete in the Weather tabs: {', '.join(missing)}.\n"
        f"    Both Weather toolbar tabs (🌤️ Weather → By Climate + By City) read climate data;\n"
        f"    By Climate additionally links each card to its guide via GUIDE_LINKS. Fix:\n"
        f"      1. Confirm the city's map pin is added (build_climate.py reads the map pins).\n"
        f"      2. python3 Brain/scripts/build_climate.py        # fetch + bake the new city\n"
        f"      3. Add the city to GUIDE_LINKS in Trip-Essentials/Climate Finder.html (By Climate link).\n"
        f"      4. python3 Brain/scripts/validate_climate_coverage.py   # must exit 0\n",
        file=sys.stderr,
    )
    return 1


def _check_guide_in_currency(guide_path: Path) -> int:
    """Ship gate: the guide's city must map to a country on the Currency Guide.

    The Currency Guide is per-country, generated from build_currency.py's COUNTRIES
    list (each row's [7] is that country's city list). A guide that introduces a
    NEW country leaves the Currency Guide incomplete. This is scoped to the SHIPPING
    guide only (not whole-index coverage) so a pre-existing naming mismatch elsewhere
    can't block an unrelated ship; the full set is still audited by validate_currency.

    Fix a miss: add the country (with this city) to build_currency.py COUNTRIES, then
    run build_currency.py to regenerate the page.

    Added 2026-06-15.
    """
    import importlib.util as _ilu

    city_folder = guide_path.parent.name
    bc_path = HERE / "build_currency.py"
    if not bc_path.exists():
        print("  ⚠️  Currency check skipped (build_currency.py missing).")
        return 0
    try:
        spec = _ilu.spec_from_file_location("bc_gate", str(bc_path))
        bc = _ilu.module_from_spec(spec)
        spec.loader.exec_module(bc)
        page_cities = set()
        for row in bc.COUNTRIES:
            for c in row[7]:
                page_cities.add(c)
    except Exception as _e:  # noqa: BLE001
        print(f"  ⚠️  Currency check skipped (build_currency load failed: {_e}).")
        return 0

    if city_folder in page_cities:
        print(f"  ✅  Currency Guide — {city_folder}'s country is covered.")
        return 0

    print(
        f"\n🚫  SHIP BLOCKED — {city_folder} is not listed under any country in the Currency Guide.\n"
        f"    The Currency Guide has a per-country list of guide cities; if this guide adds a\n"
        f"    NEW country, add it (with this city) to the COUNTRIES list in\n"
        f"    Brain/scripts/build_currency.py, then regenerate:\n"
        f"      python3 Brain/scripts/build_currency.py\n",
        file=sys.stderr,
    )
    return 1


def _write_ship_log(guide_path: Path, result: str, check_count: int = 0) -> None:
    """Append a timestamped PASS/FAIL line to the guide's own ship_log.md (Rule 125).

    The log lives at {guide_folder}/ship_log.md — one file per guide, never recreated.
    If the file doesn't exist yet (first ship of a new guide) it is created with a
    one-time header. Every subsequent ship APPENDS — never overwrites.

    Format: YYYY-MM-DD HH:MM — {guide.html} — PASS|FAIL — {N} checks
    """
    log_path = guide_path.parent / "ship_log.md"
    now = _dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    entry = f"{now} — {guide_path.name} — {result} — {check_count} checks\n"
    if not log_path.exists():
        log_path.write_text(
            "# Ship Log\n\n"
            "> Auto-maintained by guide_tools.py ship (Rule 125).\n"
            "> Format: YYYY-MM-DD HH:MM — guide.html — PASS|FAIL — N checks\n\n"
        )
    with log_path.open("a") as f:
        f.write(entry)


def _flip_build_state_boxes(guide_path: Path) -> None:
    """Tick every remaining [ ] in the guide's build_state.md after a clean ship.

    Added 2026-06-12. Before this, flipping the late build_state checkboxes
    (Phase 3-6, including the Ship Checklist line) was a purely manual Edit step
    that nothing enforced or produced — so it was routinely skipped even when the
    guide had actually shipped (validator 0 failures, on the index, ship gate
    exit 0). Result: build_state.md chronically under-reported completion — e.g.
    Los Angeles and Vancouver both logged "ship gate exit 0" yet left the Ship
    Checklist box [ ]. _in_progress_builds() reads these boxes, so stale [ ]
    boxes made shipped guides look in-progress at session start.

    A passing ship means the whole build is complete, so any remaining [ ] is
    stale by definition. This flips them all to [x] in one pass, self-healing
    earlier boxes too, and stamps the Last updated line. Idempotent: a fully
    ticked file is left unchanged (0 flipped).

    Only runs after every gate has passed (called immediately before the ship
    command returns 0) — it never flips boxes for a guide that failed to ship.
    """
    bs_path = guide_path.parent / "_build" / "build_state.md"
    if not bs_path.exists():
        # Guide built before the build-state tracker existed — nothing to flip.
        return
    try:
        text = bs_path.read_text(encoding="utf-8")
    except OSError:
        return
    # Match a checklist line's unchecked box, preserving leading indentation and
    # the "- " bullet: "- [ ]" / "  - [ ]" → "- [x]" / "  - [x]".
    flipped = len(re.findall(r"(?m)^(\s*-\s*)\[ \]", text))
    if flipped == 0:
        return
    text = re.sub(r"(?m)^(\s*-\s*)\[ \]", r"\1[x]", text)
    today = _dt.date.today().isoformat()
    if re.search(r"(?mi)^Last updated:", text):
        text = re.sub(
            r"(?mi)^Last updated:.*$",
            f"Last updated: {today} (ship gate auto-flipped {flipped} build_state box"
            f"{'es' if flipped != 1 else ''} on clean ship)",
            text,
            count=1,
        )
    try:
        bs_path.write_text(text, encoding="utf-8")
    except OSError:
        return
    print(
        f"  📋 build_state.md — ticked {flipped} remaining box"
        f"{'es' if flipped != 1 else ''} (clean ship)."
    )


def _run_tests() -> int:
    """Run validator fixtures under Brain/tests/ (Rule 56).

    Each .html file in Brain/tests/ is named for the check it triggers:
      {check_label}__FAIL.html  — should produce ≥1 FAIL from validate_itinerary.py
      {check_label}__PASS.html  — should produce 0 FAILs from validate_itinerary.py

    Exit 0 if all fixtures produce the expected outcome; 1 if any diverge.
    Stub: Brain/tests/ directory and per-check fixtures are added over time.
    Full rule: Cleanliness Checks.md Rules 56 + 119-122.
    """
    if not TESTS_DIR.exists():
        print("Brain/tests/ directory does not exist — creating it.")
        TESTS_DIR.mkdir()
        (TESTS_DIR / ".keep").write_text(
            "# Brain/tests/ — validator fixtures (Rule 56)\n"
            "#\n"
            "# Naming: {check_label}__FAIL.html  (must produce ≥1 FAIL)\n"
            "#          {check_label}__PASS.html  (must produce 0 FAILs)\n"
            "#\n"
            "# Run: python3 guide_tools.py test\n"
        )
        print("Created Brain/tests/.keep with instructions.")
        print("Add fixture HTML files to Brain/tests/ to enable testing.")
        return 0

    fixtures = sorted(TESTS_DIR.glob("*.html"))
    if not fixtures:
        print("Brain/tests/ exists but contains no .html fixtures yet.")
        print("Add {check_label}__FAIL.html / __PASS.html files to enable testing.")
        return 0

    validate_script = HERE / "validate_itinerary.py"
    passed = 0
    failed = 0
    for fixture in fixtures:
        expected_fail = fixture.stem.endswith("__FAIL")
        expected_pass = fixture.stem.endswith("__PASS")
        if not (expected_fail or expected_pass):
            print(f"  ⚠  Skipping {fixture.name} — name must end in __FAIL or __PASS")
            continue
        rc = _run({"validate": str(validate_script)}["validate"], [str(fixture)])
        if expected_fail and rc != 0:
            print(f"  ✓  {fixture.name} → FAIL as expected")
            passed += 1
        elif expected_pass and rc == 0:
            print(f"  ✓  {fixture.name} → PASS as expected")
            passed += 1
        else:
            outcome = "FAIL" if rc != 0 else "PASS"
            expected = "FAIL" if expected_fail else "PASS"
            print(f"  ✗  {fixture.name} → got {outcome}, expected {expected}")
            failed += 1

    print(f"\nFixture results: {passed} ok · {failed} unexpected")
    return 0 if failed == 0 else 1


def _find_guide_html(city: str) -> "Path | None":
    """Return the primary guide HTML file for a city, or None if not found.

    Looks inside Guides/{City}/ for any .html file that is NOT inside a _build
    subdirectory.  City folder names are case-sensitive (Edinburgh, not edinburgh).
    """
    city_dir = WEB_ROOT / "Guides" / city
    if not city_dir.is_dir():
        return None
    candidates = [
        p for p in city_dir.glob("*.html")
        if "_build" not in p.parts
    ]
    if not candidates:
        return None
    # Prefer the alphabetically last file so higher version numbers win (v3 > v1).
    return sorted(candidates)[-1]


def _run_update_index(city: str) -> int:
    """5-step ship-tail checklist for a newly built guide.

    Verifies each of the five post-build steps defined in
    Brain/Reference/Navigation.html § 5:

      1. guides_index.html card
      2. Predecessor/successor data-guide-prev/next wiring in guides_index.html
      3. Banner counts (guides + countries) in guides_index.html
      4. Guide HTML toolbar-mount data-prev / data-next
      5. Map pin in the matching continent map

    Exits 0 if all five steps pass; non-zero listing the failures.
    Added 2026-06-11 — Proposal C.
    """
    import re as _re

    fails: list[str] = []
    guide_path = _find_guide_html(city)

    print(f"\n── UPDATE-INDEX checklist for: {city} ──\n")

    # ── Step 1: guides_index.html card ─────────────────────────────────────────
    print("Step 1 — guides_index.html card")
    if guide_path is None:
        print(
            f"  ⚠  No guide HTML found in Guides/{city}/ — cannot verify steps 1–4.\n"
            f"     Create the guide file first.\n",
            file=sys.stderr,
        )
        return 1
    rc1 = _check_guide_indexed(guide_path)
    if rc1 != 0:
        fails.append("Step 1: guides_index.html card missing")
    else:
        print()

    # ── Step 2: prev/next wiring in guides_index.html ─────────────────────────
    print("Step 2 — prev/next wiring in guides_index.html")
    guides_index = WEB_ROOT / "Guides" / "guides_index.html"
    step2_ok = False
    if guides_index.exists():
        idx_html = guides_index.read_text(encoding="utf-8")
        # Find this city's card — href contains the city folder name
        city_card_re = _re.compile(
            r'<a\b[^>]*class\s*=\s*"[^"]*dest-card[^"]*"[^>]*href\s*=\s*"[^"]*/'
            + _re.escape(city) + r'/[^"]*"[^>]*>',
            _re.IGNORECASE,
        )
        card_m = city_card_re.search(idx_html)
        if card_m:
            card_tag = card_m.group(0)
            prev_m = _re.search(r'data-guide-prev\s*=\s*"([^"]*)"', card_tag)
            next_m = _re.search(r'data-guide-next\s*=\s*"([^"]*)"', card_tag)
            prev_href = prev_m.group(1) if prev_m else None
            next_href = next_m.group(1) if next_m else None

            wiring_issues: list[str] = []

            # Check that the predecessor card's data-guide-next points back to this city
            if prev_href:
                prev_folder = prev_href.strip("./").split("/")[0]
                back_re = _re.compile(
                    r'<a\b[^>]*href\s*=\s*"[^"]*/' + _re.escape(prev_folder) + r'/[^"]*"[^>]*>',
                    _re.IGNORECASE,
                )
                back_m = back_re.search(idx_html)
                if back_m:
                    back_next_m = _re.search(r'data-guide-next\s*=\s*"([^"]*)"', back_m.group(0))
                    if back_next_m and city.lower() not in back_next_m.group(1).lower():
                        wiring_issues.append(
                            f"predecessor {prev_folder} data-guide-next does not point to {city}"
                        )
                else:
                    wiring_issues.append(f"predecessor card for {prev_folder} not found in index")

            # Check that the successor card's data-guide-prev points back to this city
            if next_href:
                next_folder = next_href.strip("./").split("/")[0]
                fwd_re = _re.compile(
                    r'<a\b[^>]*href\s*=\s*"[^"]*/' + _re.escape(next_folder) + r'/[^"]*"[^>]*>',
                    _re.IGNORECASE,
                )
                fwd_m = fwd_re.search(idx_html)
                if fwd_m:
                    fwd_prev_m = _re.search(r'data-guide-prev\s*=\s*"([^"]*)"', fwd_m.group(0))
                    if fwd_prev_m and city.lower() not in fwd_prev_m.group(1).lower():
                        wiring_issues.append(
                            f"successor {next_folder} data-guide-prev does not point to {city}"
                        )
                else:
                    wiring_issues.append(f"successor card for {next_folder} not found in index")

            if not wiring_issues:
                step2_ok = True
                print(f"  ✅  data-guide-prev/next wiring consistent.")
            else:
                for issue in wiring_issues:
                    print(f"  🚫  {issue}", file=sys.stderr)
                fails.append("Step 2: prev/next chain wiring broken — " + "; ".join(wiring_issues))
        else:
            # Card not found — step 1 will already have caught this
            print(f"  ⏭  No card found for {city} in index — see Step 1.")
            step2_ok = True  # don't double-count
    else:
        print("  🚫  guides_index.html not found.", file=sys.stderr)
        fails.append("Step 2: guides_index.html missing")
    print()

    # ── Step 3: banner counts ──────────────────────────────────────────────────
    print("Step 3 — banner counts in guides_index.html")
    if guides_index.exists():
        idx_html_s3 = guides_index.read_text(encoding="utf-8")

        # Count dest-card elements
        card_count = len(_re.findall(r'<a\b[^>]*class\s*=\s*"[^"]*dest-card[^"]*"', idx_html_s3, _re.IGNORECASE))

        # Extract banner count
        banner_m = _re.search(r'(\d+)\s+guides?\s*[·•]\s*(\d+)\s+countr', idx_html_s3, _re.IGNORECASE)
        if banner_m:
            banner_count = int(banner_m.group(1))
            if banner_count == card_count:
                print(f"  ✅  Banner shows {banner_count} guides — matches {card_count} dest-card elements.")
            else:
                msg = (
                    f"Banner says {banner_count} guides but {card_count} dest-card elements found. "
                    f"Update the banner text in guides_index.html."
                )
                print(f"  🚫  {msg}", file=sys.stderr)
                fails.append(f"Step 3: {msg}")
        else:
            print("  ⚠  Could not parse banner count from guides_index.html — verify manually.")
    else:
        print("  ⏭  guides_index.html not found — skipping.")
    print()

    # ── Step 4: toolbar-mount data-prev / data-next ────────────────────────────
    print("Step 4 — toolbar-mount data-prev / data-next in guide HTML")
    if guide_path and guide_path.exists():
        guide_html = guide_path.read_text(encoding="utf-8")
        mount_m = _re.search(
            r'<div\b[^>]*id\s*=\s*"toolbar-mount"[^>]*>',
            guide_html, _re.IGNORECASE,
        )
        if mount_m:
            mount_tag = mount_m.group(0)
            has_prev = 'data-prev' in mount_tag
            has_next = 'data-next' in mount_tag
            if has_prev or has_next:
                prev_val = _re.search(r'data-prev\s*=\s*"([^"]*)"', mount_tag)
                next_val = _re.search(r'data-next\s*=\s*"([^"]*)"', mount_tag)
                pv = prev_val.group(1) if prev_val else "(none)"
                nv = next_val.group(1) if next_val else "(none)"
                print(f"  ✅  toolbar-mount found — data-prev={pv!r}  data-next={nv!r}")
            else:
                print(f"  ✅  toolbar-mount found — no data-prev/data-next (first or last guide in chain).")
        else:
            msg = f"No toolbar-mount div found in {guide_path.name} — add <div id=\"toolbar-mount\" ...>"
            print(f"  🚫  {msg}", file=sys.stderr)
            fails.append(f"Step 4: {msg}")
    else:
        print(f"  ⏭  Guide HTML not found — cannot check toolbar-mount.")
    print()

    # ── Step 5: map pin ────────────────────────────────────────────────────────
    print("Step 5 — map pin")
    rc5 = _check_guide_pinned(guide_path)
    if rc5 != 0:
        fails.append("Step 5: map pin missing")
    print()

    # ── Summary ────────────────────────────────────────────────────────────────
    if fails:
        print("─" * 60)
        print(f"🚫  UPDATE-INDEX incomplete — {len(fails)} step(s) need attention:\n")
        for f in fails:
            print(f"   • {f}")
        print()
        return 1

    print("─" * 60)
    print(f"✅  UPDATE-INDEX — all 5 steps complete for {city}.")
    print(f"    Guide is ready to ship.\n")
    return 0


def _run_sync_css() -> int:
    """Copy Brain/Reference/Guide Style.css → Travel-Website/assets/guide_v3.css.

    This is the canonical step for propagating CSS changes from the source-of-truth
    file to the deployed stylesheet.  Run it after any edit to Guide Style.css.
    Documented in Brain/Reference/Change Cascade.html (CSS rule changed → sync-css).
    Added 2026-06-11 — Proposal D.
    """
    src  = BRAIN_DIR / "Reference" / "Guide Style.css"
    dest = ASSETS_DIR / "guide_v3.css"   # assets/ home since 2026-06-13 reorg (was Guides/)

    if not src.exists():
        print(
            f"🚫  SYNC-CSS FAILED — source not found:\n"
            f"    {src}\n",
            file=sys.stderr,
        )
        return 1

    import shutil as _shutil
    _shutil.copy2(src, dest)

    src_size  = src.stat().st_size
    dest_size = dest.stat().st_size
    print(f"\n✅  SYNC-CSS — copied Guide Style.css → assets/guide_v3.css ({dest_size} bytes)")
    if src_size != dest_size:
        print(
            f"  ⚠  Size mismatch after copy: src={src_size}  dest={dest_size} — check disk.",
            file=sys.stderr,
        )
        return 1
    print(f"    Source:  {src}")
    print(f"    Dest:    {dest}\n")
    return 0


# ──────────────────────────────────────────────────────────────────────────────
# Guide staleness ledger (added 2026-06-12)
# Each guide is stamped — at ship time — with the format fingerprint it was built
# under (Brain/Reference/format_version.json, produced by
# update_core_rules_checksums.py). `staleness` compares each guide's recorded
# fingerprint to the current one and flags drift, so out-of-date guides are
# VISIBLE and rebuilds are deliberate — never guesswork, never by copying a
# sibling guide. Pure report: it never opens or mutates a guide (no validation
# stamp written), so it is safe to run any time and on a schedule.
# ──────────────────────────────────────────────────────────────────────────────
REFERENCE_DIR    = BRAIN_DIR / "Reference"
FORMAT_VERSION_F = REFERENCE_DIR / "format_version.json"
LEDGER_F         = REFERENCE_DIR / "guide_staleness.json"
GUIDES_DIR       = WEB_ROOT / "Guides"
_NON_GUIDE_DIRS  = {"_build", "assets"}


def _current_format_version() -> dict:
    try:
        return json.loads(FORMAT_VERSION_F.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _load_ledger() -> dict:
    try:
        return json.loads(LEDGER_F.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_ledger(data: dict) -> None:
    LEDGER_F.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n",
                        encoding="utf-8")


def _iter_guide_dirs():
    if not GUIDES_DIR.is_dir():
        return
    for d in sorted(GUIDES_DIR.iterdir()):
        if not d.is_dir() or d.name in _NON_GUIDE_DIRS:
            continue
        if list(d.glob("*.html")):           # only folders that hold a guide
            yield d


def _latest_guide_html(city_dir: Path):
    """Newest top-level guide HTML in a city folder (highest version wins)."""
    htmls = list(city_dir.glob("*.html"))
    return sorted(htmls)[-1] if htmls else None


def _update_staleness_ledger(guide_path: Path) -> None:
    """Stamp the shipped guide with the current format fingerprint. Called on a
    successful ship so the guide enrolls / re-enrolls as current."""
    fv = _current_format_version()
    if not fv:
        return
    try:
        city = guide_path.resolve().relative_to(GUIDES_DIR.resolve()).parts[0]
    except Exception:
        city = guide_path.parent.name
    ledger = _load_ledger()
    ledger[city] = {
        "fingerprint": fv.get("fingerprint", ""),
        "format_date": fv.get("date", ""),
        "guide": guide_path.name,
        "shipped": _dt.date.today().isoformat(),
    }
    _save_ledger(ledger)
    print(f"  🗂  staleness ledger: {city} stamped @ format {fv.get('date','?')} "
          f"({fv.get('fingerprint','?')[:8]})")


def _run_staleness(backfill: bool = False) -> int:
    fv = _current_format_version()
    if not fv:
        print("⚠  No format_version.json — run update_core_rules_checksums.py first.",
              file=sys.stderr)
        return 2
    cur_fp, cur_date = fv.get("fingerprint", ""), fv.get("date", "?")
    ledger = _load_ledger()

    if backfill:
        added = 0
        for d in _iter_guide_dirs():
            if d.name not in ledger:
                ledger[d.name] = {
                    "fingerprint": "pre-ledger",
                    "format_date": "unknown (pre-ledger)",
                    "guide": (_latest_guide_html(d) or Path("?")).name,
                    "shipped": "unknown",
                }
                added += 1
        _save_ledger(ledger)
        print(f"  🗂  backfill: enrolled {added} pre-ledger guide(s) "
              f"(flagged stale until rebuilt or shipped).")

    rows, stale, current, untracked = [], 0, 0, 0
    for d in _iter_guide_dirs():
        entry = ledger.get(d.name)
        if not entry:
            status, built = "UNTRACKED", "—"
            untracked += 1
        elif entry.get("fingerprint") == cur_fp:
            status, built = "current", entry.get("format_date", "?")
            current += 1
        else:
            status, built = "STALE", entry.get("format_date", "?")
            stale += 1
        rows.append((d.name, status, built))

    print(f"\n🗂  Guide staleness — current format version: {cur_date} ({cur_fp[:8]})\n")
    name_w = max([len(r[0]) for r in rows] + [4])
    print(f"  {'City'.ljust(name_w)}  {'Status'.ljust(9)}  Built under")
    print("  " + "-" * (name_w + 9 + 24))
    for name, status, built in rows:
        print(f"  {name.ljust(name_w)}  {status.ljust(9)}  {built}")
    print(f"\n  {current} current · {stale} stale · {untracked} untracked  "
          f"(total {len(rows)} guides)")
    if stale or untracked:
        print("  → Stale/untracked guides predate the current format. Rebuild them\n"
              "    deliberately from CORE RULES — never by copying another guide.\n"
              "    A guide re-enrolls as current the next time it ships.")
    print()
    return 0


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] in {"-h", "--help", "help"}:
        print(USAGE)
        return 0

    cmd, tail = sys.argv[1], sys.argv[2:]

    if cmd == "ship":
        if not tail:
            print("Usage: guide_tools.py ship <file.html>", file=sys.stderr)
            return 2
        # Three-gate pipeline: static HTML checks → live URL/content verification →
        # booking-link log coverage + subject-drift catch. Fail-fast: any non-zero
        # returns immediately.
        #
        # Retired 2026-04-24 — the `pdf` + `validate-pdf` steps previously ran
        # after `verify` so a PDF landed on disk every `ship`. Dani's direction:
        # *"the Doc should be done on demand only. only when I ask and not
        # automatic."* PDF rendering is now on-demand only — `render_pdf.py` and
        # `validate_pdf.py` remain callable as standalone subcommands (see
        # SUBCOMMANDS dict) but are no longer part of the automatic chain.
        # Enforced by `Cleanliness Checks.md` Rule 172.
        #
        # Extended 2026-04-24 — `verify-booking` added as the third gate, closing
        # the enforcement gap Dani surfaced during a 2026-04-24 audit (logged at
        # the time in OPEN_ITEMS.md, retired 2026-05-01 and merged into
        # Travel/To Do List/To_Do_List.md). Prior chain ran `validate + verify` only, which let guides ship
        # with booking URLs that returned 200-status (and so passed verify_urls)
        # but resolved to the wrong subject (TripAdvisor d-ID reassignment,
        # Wikipedia slug drift) OR lacked a human verification-log entry on
        # bot-blocked platforms (Viator / GetYourGuide / Michelin). Dani 2026-04-24
        # confirmed hard-fail semantics: *"i agree hard fail"* — any FAIL from
        # verify_booking_links.py blocks the ship the same as validate/verify FAIL.
        # Enforced by `Cleanliness Checks.md` Rule 173 (ship chain shape) +
        # Rules 157/158/159 (the individual log-coverage + h1-match gates).
        # See Rules for Claude.html § 8 for the full context.
        # Auto-patch verification_log.json _meta before the gates run so
        # _meta.guide always matches the guide being shipped and _meta.updated
        # is always today. No manual step needed on version bumps.
        # ── Validation stamp gate (added 2026-05-07) ──────────────────────────
        # validate_itinerary.py writes <!-- validation: passed YYYY-MM-DD HH:MM -->
        # into the guide when it exits clean. If that stamp is absent or still
        # "pending", this guide has never passed validation — hard-fail before
        # running the rest of the pipeline.
        _guide_path = Path(tail[0]).resolve()
        try:
            _guide_html = _guide_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            print(f"❌ File not found: {tail[0]}", file=sys.stderr)
            return 2
        if "<!-- validation: pending -->" in _guide_html:
            print(
                "\n🚫  SHIP BLOCKED — guide has never been validated.\n"
                "    Run:  python3 guide_tools.py validate <file.html>\n"
                "    Then: python3 guide_tools.py ship <file.html>\n",
                file=sys.stderr,
            )
            return 1
        if "<!-- validation: passed" not in _guide_html:
            print(
                "\n🚫  SHIP BLOCKED — no validation stamp found in this guide.\n"
                "    Add <!-- validation: pending --> near the top of the HTML,\n"
                "    run validate, then ship.\n",
                file=sys.stderr,
            )
            return 1
        # ──────────────────────────────────────────────────────────────────────

        _patch_verification_log(Path(tail[0]).resolve())

        # ── brain-check gate (added 2026-05-30) ──────────────────────────────
        # Verifies Brain integrity (required files, checksums, pointers) before
        # running the full validate/verify pipeline. Note: guides_index coverage
        # is NOT checked here — that check was moved to _check_guide_indexed()
        # below (runs after verify-booking) so each crib only checks its own
        # guide at ship time. Updated 2026-06-02.
        rc_brain = _run(SUBCOMMANDS["brain-check"], [])
        if rc_brain != 0:
            print(
                "\n🚫  SHIP BLOCKED — brain-check failed.\n"
                "    Fix brain integrity issues (e.g. missing guides_index.html entry),\n"
                "    then re-run ship.\n",
                file=sys.stderr,
            )
            _write_ship_log(Path(tail[0]).resolve(), "FAIL")
            return rc_brain
        # ──────────────────────────────────────────────────────────────────────

        for sub in ("validate", "verify", "verify-booking"):
            rc = _run(SUBCOMMANDS[sub], tail)
            if rc != 0:
                return rc

        # ── guides_index.html gate (added 2026-06-02) ─────────────────────────
        # Each crib checks only its own guide. Verifies that guides_index.html
        # has an entry for the city folder containing the guide being shipped.
        # Fires at ship time — never at session start. Replaced the old
        # check_guides_index_coverage in brain_check.py which ran at session
        # start and incorrectly flagged other cribs' in-progress builds.
        rc_idx = _check_guide_indexed(Path(tail[0]).resolve())
        if rc_idx != 0:
            return rc_idx
        # ──────────────────────────────────────────────────────────────────────

        # ── map pin gate (added 2026-06-02) ───────────────────────────────────
        # Verifies the city has a pin in Europe Map.html or US Map.html.
        # Full rule: Brain/Reference/Navigation.html § 5 step 5.
        rc_pin = _check_guide_pinned(Path(tail[0]).resolve())
        if rc_pin != 0:
            _write_ship_log(Path(tail[0]).resolve(), "FAIL")
            return rc_pin
        # ──────────────────────────────────────────────────────────────────────

        # ── Status Dots gate (added 2026-06-15) ───────────────────────────────
        # Verifies the city appears in Status Dots — guides_index.md (any section).
        # Catches guides shipped without ever being added to the dot tracker.
        # brain_check.check_status_dots_stalled_builds catches the complementary
        # case (in stalled list but has shipped HTML).
        rc_dots = _check_guide_in_status_dots(Path(tail[0]).resolve())
        if rc_dots != 0:
            _write_ship_log(Path(tail[0]).resolve(), "FAIL")
            return rc_dots
        # ──────────────────────────────────────────────────────────────────────

        # ── FMAP gate (added 2026-06-15) ──────────────────────────────────────
        # Verifies the guide has a flight-time map entry in guides_index.html's
        # FMAP block. A missing entry means the city is invisible in the
        # flight-time view. validate_flight_index.py enforces bi-directional
        # coverage; this gate fires earlier, at ship time, for the shipped guide.
        rc_fmap = _check_guide_fmap(Path(tail[0]).resolve())
        if rc_fmap != 0:
            _write_ship_log(Path(tail[0]).resolve(), "FAIL")
            return rc_fmap
        # ──────────────────────────────────────────────────────────────────────

        # ── Climate / Weather data gate (added 2026-06-15) ────────────────────
        # Both Weather toolbar tabs — By Climate (Climate Finder) and By City
        # (Weather.html) — read window.TravelClimate, baked into assets/weather.js
        # from assets/climate.json. A guide that ships without climate normals is
        # invisible in both tabs. Enforce presence in both data sources at ship time.
        rc_clim = _check_guide_in_climate(Path(tail[0]).resolve())
        if rc_clim != 0:
            _write_ship_log(Path(tail[0]).resolve(), "FAIL")
            return rc_clim
        # ──────────────────────────────────────────────────────────────────────

        # ── Safety Guide gate (added 2026-06-15) ──────────────────────────────
        # Safety Guide.html is hardcoded (not generated) — a new guide must get a
        # row added manually. validate_safety_guide hard-fails if any guides_index
        # city lacks exactly one Safety row, so a guide shipped without one blocks.
        print("\n▶ Checking Safety Guide coverage…")
        rc_safe = _run("validate_safety_guide.py", [])
        if rc_safe != 0:
            print(
                "\n🚫  SHIP BLOCKED — a guide is missing its Safety Guide row.\n"
                "    Safety Guide.html is hardcoded — add the city's row (State Dept level +\n"
                "    official sources) in Travel-Website/Trip-Essentials/Safety Guide.html, then re-run.\n",
                file=sys.stderr,
            )
            _write_ship_log(Path(tail[0]).resolve(), "FAIL")
            return rc_safe
        # ──────────────────────────────────────────────────────────────────────

        # ── Currency Guide gate (added 2026-06-15) ────────────────────────────
        # Currency Guide is per-country. A guide that introduces a NEW country must
        # have it added. Scoped to the shipping guide (not whole-index coverage) so
        # an unrelated pre-existing mismatch can't block this ship.
        rc_curr = _check_guide_in_currency(Path(tail[0]).resolve())
        if rc_curr != 0:
            _write_ship_log(Path(tail[0]).resolve(), "FAIL")
            return rc_curr
        # ──────────────────────────────────────────────────────────────────────

        # ── Travel Stats gate (added 2026-06-15) ──────────────────────────────
        # Travel Stats.html is generated from guides_index. Rebuild it now so the
        # new card is included, then HARD-validate — a stale/mismatched Stats page
        # blocks the ship. (Replaces the former best-effort post-ship rebuild.)
        print("\n▶ Rebuilding + validating Travel Stats…")
        _run("build_travel_stats.py", [])
        rc_stats = _run("validate_travel_stats.py", [])
        if rc_stats != 0:
            print(
                "\n🚫  SHIP BLOCKED — Travel Stats page is out of sync with the guide index.\n"
                "    Fix: python3 Brain/scripts/build_travel_stats.py  (then re-run ship).\n",
                file=sys.stderr,
            )
            _write_ship_log(Path(tail[0]).resolve(), "FAIL")
            return rc_stats
        # ──────────────────────────────────────────────────────────────────────

        # ── mobile baseline gate (added 2026-06-12) ───────────────────────────
        # Shipping a guide edits guides_index.html + the continent maps (new card
        # + pin). Confirm every shareable page still carries the viewport tag and
        # the assets/mobile.css baseline — --strict exits 1 on any miss. Guides
        # themselves are covered by guide_v3.css and are out of this check's scope.
        rc_mob = _run(SUBCOMMANDS["mobile-check"], ["--strict"])
        if rc_mob != 0:
            print(
                "\n🚫  SHIP BLOCKED — a shareable page is missing the mobile baseline.\n"
                "    Fix:  python3 Brain/scripts/mobile_check.py --apply\n"
                "    Then re-run ship.\n",
                file=sys.stderr,
            )
            _write_ship_log(Path(tail[0]).resolve(), "FAIL")
            return rc_mob
        # ──────────────────────────────────────────────────────────────────────

        _write_ship_log(Path(tail[0]).resolve(), "PASS")
        _update_staleness_ledger(Path(tail[0]).resolve())  # enroll @ current format version
        _flip_build_state_boxes(Path(tail[0]).resolve())   # tick any stale [ ] now the ship is clean

        # ── search index refresh (added 2026-06-14) ──────────────────────────
        # Rebuild Travel-Website/assets/search_index.json so the new/updated
        # guide is immediately searchable in the guides_index content search.
        # Best-effort: a failure here never blocks an otherwise-clean ship.
        try:
            print("\n▶ Refreshing guide content search index…")
            _run("build_search_index.py", [])
        except Exception as _e:  # noqa: BLE001 — never let the index break a ship
            print(f"  ⚠️  search index refresh skipped ({_e}). "
                  f"Run: python3 Brain/scripts/build_search_index.py", file=sys.stderr)
        # ──────────────────────────────────────────────────────────────────────

        # (Travel Stats rebuild + validation now run as a HARD gate above, before
        #  the ship is marked PASS — see the Travel Stats gate.)
        return 0

    if cmd == "start":
        return _run_start()

    if cmd == "init":
        if not tail:
            print("Usage: guide_tools.py init <City>", file=sys.stderr)
            return 2
        return _run_init(" ".join(tail))

    if cmd == "preflight":
        if not tail:
            print("Usage: guide_tools.py preflight <City>", file=sys.stderr)
            return 2
        return _run_preflight(" ".join(tail))

    if cmd == "update-index":
        if not tail:
            print("Usage: guide_tools.py update-index <City>", file=sys.stderr)
            return 2
        return _run_update_index(" ".join(tail))

    if cmd == "sync-css":
        return _run_sync_css()

    if cmd == "audit":
        return _open_audit()

    if cmd == "staleness":
        return _run_staleness(backfill=("--backfill" in tail))

    if cmd == "test":
        return _run_tests()

    if cmd in SUBCOMMANDS:
        return _run(SUBCOMMANDS[cmd], tail)

    print(f"❌ Unknown subcommand: {cmd!r}\n\n{USAGE}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
