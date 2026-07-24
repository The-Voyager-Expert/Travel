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
  ship           →  check-vlog(advisory) + brain-check + validate + verify + verify-booking
                                              (pre-ship pipeline: runs check-vlog first as a
                                              non-blocking advisory step so the crib sees all
                                              missing verification_log.json entries before the
                                              gate chain starts — eliminates the blind FAIL @
                                              verify-booking retry loop (added 2026-07-23).
                                              Then: static HTML checks, live URL/content checks,
                                              booking-link log coverage + subject-drift catch.
                                              Fails fast on the first non-zero script from the
                                              gate chain. On a clean pass also auto-ticks every
                                              remaining [ ] in the guide's
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
  update-index   →  15-step ship tail       (verifies all 15 post-build steps for a city:
                                              Guides-Index.html card, prev/next wiring,
                                              banner counts, toolbar-mount data-prev/next,
                                              map pin, US/regional stats, Time-Zones,
                                              Delta-Routes, transit card, Visas, Tipping,
                                              Read About page, Stops Map, and more.
                                              Run after completing each step manually —
                                              the command confirms all 15 are done before
                                              the guide is shipped. Added 2026-06-11.)
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
  python3 guide_tools.py update-index    <City>         # 15-step ship tail: index card, prev/next, counts, toolbar, map pin, stats, Time-Zones, Delta-Routes, transit, Visas, Tipping, Read About, Stops Map
  python3 guide_tools.py sync-css                       # copy Brain/Reference/Guide Style.css → assets/guide-style.css
  python3 guide_tools.py audit                         # open audit workflow
  python3 guide_tools.py fix             <City>          # validate-only shortcut: runs validate_itinerary.py without the full ship chain (~20s vs 3-8 min). Use during FAIL loops to confirm a fix before committing to a full ship pass.
  python3 guide_tools.py check-vlog     <City>          # pre-ship diagnostic: shows which bot-blocked URLs (Viator/GYG/Michelin) are missing verification_log.json entries. Run BEFORE ship to avoid blind FAIL @ verify-booking retry loops. Always exits 0.
  python3 guide_tools.py staleness      [--backfill]    # list guides built under an older format version (drift report)
  python3 guide_tools.py revalidate     <City>          # re-run validate on a shipped guide; on 0 fails stamp last_validated (never touches fingerprint)
  python3 guide_tools.py test                           # run Brain/tests/ fixture suite (Rule 56)
  python3 guide_tools.py surface-check   <City>         # pre-research dry-run: report which ship-gate surfaces still need manual data (added 2026-07-18)

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
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent       # Brain/scripts/  (was Brain/ pre-2026-04-30)
BRAIN_DIR = HERE.parent                       # Brain/
TRAVEL_ROOT = BRAIN_DIR.parent                # Travel/
WEB_ROOT = TRAVEL_ROOT / "Travel-Website"     # Travel/Travel-Website/ — the published site root (2026-06-13 reorg). Guides/, Trip-Essentials/, assets/, index.html live here.
ASSETS_DIR = WEB_ROOT / "assets"              # shared js/css: toolbar.js, footnote.js, weather.js, guide-style.css, mobile.css, climate.json
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
    "continuity-render": "validate_continuity_render.py", # added 2026-07-12: renders each guide and measures actual gaps in Extras-section/stop-block continuous-card joins — the static Style A anchor check only confirms CSS text is present, not that the browser applies it with zero gap
    "validate-safety": "validate_safety_guide.py", # added 2026-06-19: Safety Guide coverage — every guides_index city has exactly one row
    "validate-day-trips": "validate_day_trips_sync.py", # added 2026-07-23: Day-Trips.html DATA stays in sync with guide day-trips sections
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


def _run_validate_capturing(guide_path_str: str) -> tuple[int, int, int]:
    """Run validate_itinerary.py as a subprocess, capture output, parse check counts.

    Returns (returncode, passed_count, failed_count). Uses subprocess so stdout can
    be captured and parsed for the summary line that _run/runpy discards. Output is
    echoed to the terminal after the subprocess exits so the crib sees the full
    validator output. Added 2026-07-20: fixes the "0 checks" ship log bug where
    validate_itinerary.py's real pass/fail counts were never recorded.
    """
    target = HERE / "validate_itinerary.py"
    if not target.exists():
        print(f"❌ Missing companion script: {target}", file=sys.stderr)
        return 2, 0, 0
    result = subprocess.run(
        [sys.executable, str(target), guide_path_str],
        cwd=TRAVEL_ROOT,
        capture_output=True,
        text=True,
    )
    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    # Parse the summary line: "N passed   M failed   W warnings"
    # The validator prints this as "  ✅ N passed   ❌ M failed   ⚠️ W warnings"
    passed, failed = 0, 0
    m = re.search(r'(\d+)\s+passed.*?(\d+)\s+failed', result.stdout or "")
    if m:
        passed, failed = int(m.group(1)), int(m.group(2))
    return result.returncode, passed, failed


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


def _ensure_pre_push_hook() -> None:
    """Activate the pre-push guard so no crib can publish an UNvalidated guide.

    The hook lives at Brain/scripts/git-hooks/pre-push (tracked in the repo) and
    runs pre_push_guard.py, which blocks a push only when a tracked guide HTML
    lacks <!-- validation: passed -->. Site fixes (CSS / toolbar / assets) push
    freely. .git/hooks is NOT version-controlled, so each crib/clone must point
    core.hooksPath at the tracked dir — we set it here every session (idempotent).
    Added 2026-06-21.
    """
    import os
    import stat
    import subprocess

    want = "Brain/scripts/git-hooks"
    try:
        root = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("  ⏭  pre-push guard — not a git repo, skipping.")
        return

    cur = subprocess.run(
        ["git", "config", "core.hooksPath"],
        capture_output=True, text=True,
    ).stdout.strip()
    if cur != want:
        subprocess.run(["git", "config", "core.hooksPath", want])
        print(f"  🔧 pre-push guard ACTIVATED — core.hooksPath → {want}")
    else:
        print(f"  ✅ pre-push guard active (core.hooksPath = {want})")

    hook = Path(root) / want / "pre-push"
    if hook.exists() and not os.access(hook, os.X_OK):
        hook.chmod(hook.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        print("  🔧 pre-push hook made executable")
    elif not hook.exists():
        print(f"  ⚠  pre-push hook missing at {want}/pre-push — guard inactive.")


def _run_start() -> int:
    """
    Session startup in one command — replaces the manual multi-step ritual.

    Steps:
      0. ensure the pre-push guard is active (no crib publishes an unvalidated guide)
      1. brain-check  (must exit 0 before anything else)
      2. sweep-stray  (surface strays; does NOT auto-apply — still needs --apply to move)
      3. Print open To Do items (🔧 Rules for Update + ❓ Questions for Dani sections)
    """
    import subprocess

    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  🧠  Session startup — guide_tools.py start")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

    # Step 0: pre-push guard (publish safety — runs before anything else)
    print("▶ Step 0 — pre-push guard")
    _ensure_pre_push_hook()
    print()

    # Step 0b: status-tracker resync — BOTH Brain-side been/want trackers
    # (Travel-Tracker.html via sync_tracker.py, and Status Dots — guides_index.md
    # via build_status_dots.py) are one-way generated mirrors of Guides-Index.html's
    # data-status (the single source of truth). Regenerating both here means a
    # newly-shipped guide (always data-status="want") always lands in both as want,
    # and neither can hand-drift. (sync_tracker fires at the end of update-index too;
    # build_status_dots added alongside it 2026-07-10 after the checklist had drifted
    # 28 statuses out of sync.) They silently drift whenever Guides-Index.html
    # is edited outside that pipeline (a direct structural fix, a status correction,
    # a CSS tweak touching the file). MUST run before any step below that can
    # `return` early on failure (brain-check, coverage, flight-index all do) — a
    # sync step placed after them would simply never fire whenever one of them is
    # red, which is exactly the scenario that let the tracker go stale repeatedly.
    # Cheap, idempotent rewrite of a Drive-only file (not git-tracked); never blocks.
    # (added 2026-06-30, moved ahead of brain-check same day after it was found
    # silently skipped whenever brain-check failed)
    print("▶ Step 0b — status-tracker resync")
    for _script, _fn in (("sync_tracker.py", "sync"), ("build_status_dots.py", "build")):
        try:
            import importlib.util as _ilu
            _spec = _ilu.spec_from_file_location(_script[:-3], BRAIN_DIR / "scripts" / _script)
            _mod = _ilu.module_from_spec(_spec)
            _spec.loader.exec_module(_mod)
            getattr(_mod, _fn)()
        except Exception as _e:
            print(f"  ⚠  {_script} failed: {_e}", file=sys.stderr)
    print()

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

    # Step 3b: mobile-RENDER audit (best-effort) — loads each shareable page at 393px and
    # flags off-standard filter pills + horizontal overflow that the STATIC mobile-check
    # (viewport + mobile.css present) cannot see. This is the gap the build crib kept
    # slipping through: brain_check + mobile-check pass, but pills render skinny on mobile.
    # Warn-only, skips gracefully if playwright is absent — never blocks. (added 2026-06-20)
    print("\n▶ Step 3b — mobile-render audit (pills + overflow @ 393px)")
    _run("validate_mobile_render.py", ["--warn"])

    # Step 3b-2: continuity-RENDER audit (best-effort) — renders every guide and measures
    # actual gaps in Extras-section entry runs and stop-block tour-box/ticket-box runs.
    # The static "Style A continuous-run" check in validate_itinerary.py only confirms the
    # required CSS selector TEXT is present in guide-style.css — it shipped clean twice in
    # one session (2026-07-12) while the fix was actually broken (once a CSS specificity
    # miss, once a margin-shorthand-sets-both-sides miss), because neither bug removed any
    # anchor text. Only rendering and measuring catches this class of regression.
    # Warn-only, skips gracefully if playwright is absent — never blocks. (added 2026-07-12)
    print("\n▶ Step 3b-2 — continuity-render audit (Extras/stop card gaps)")
    _run("validate_continuity_render.py", ["--warn"])

    # Step 3c: whole-fleet guide-coverage sweep — re-checks EVERY shipped guide
    # against EVERY cross-guide surface (index card + inline + FMAP, map pin, travel
    # stats, safety, both Weather tabs, search, status-dots, currency), confirming
    # each is present with a link that resolves. The per-guide ship gates only check
    # the one guide being shipped; this catches drift in the rest of the fleet — a
    # card/pin deleted in a later edit, a version-bumped file that orphaned a link, a
    # guide hand-pushed around the gate. Warn-only at session start — fleet gaps must
    # not block work on an unrelated guide; the CI deploy gate (check_coverage.py) is
    # the hard enforcement layer. (added 2026-06-22, made strict 2026-06-28, relaxed
    # to warn-only 2026-07-12: scoped ship gates already catch per-guide gaps; blocking
    # the whole session when any fleet guide has a gap prevents all other guide work)
    print("\n▶ Step 3c — guide-coverage sweep (every guide in every surface)")
    rc3c = _run("validate_guide_coverage.py", [])
    if rc3c != 0:
        print(
            "\n⚠️   Coverage gaps found (warn-only at session start — CI blocks deploy).\n"
            "     Run: python3 Brain/scripts/validate_guide_coverage.py\n",
        )

    # Step 3d: flight-index integrity — validate_guide_coverage uses a loose
    # folder-name substring match for FMAP, so it passes guides whose FMAP keys
    # contain the folder name even when the filename is stale (e.g. Cairo/Cairo.html
    # vs the live cairo_v2.html). validate_flight_index.py uses exact-path matching
    # and also checks routing schema, colour consistency, and hub agreement with
    # Delta Routes SEA. Warn-only at session start — same rationale as Step 3c.
    # (added 2026-06-28, relaxed to warn-only 2026-07-12)
    print("\n▶ Step 3d — flight-index integrity (FMAP paths, routing, colours)")
    rc3d = _run("validate_flight_index.py", [])
    if rc3d != 0:
        print(
            "\n⚠️   Flight-index failures (warn-only at session start).\n"
            "     Run: python3 Brain/scripts/validate_flight_index.py\n",
        )

    # Step 3e: read-about version drift — confirms every read-about page's .story-back /
    # .story-footer-back hrefs match the CURRENT highest-version guide on disk. A version
    # bump (e.g. _v1 → _v2) orphans back-links without any visible error. Warn-only at
    # session start so a pre-existing fleet drift doesn't block guide work. Hard gate
    # inside _check_guide_story_page fires when shipping. (added 2026-07-15)
    print("\n▶ Step 3e — read-about version drift (back-link hrefs vs current guide filename)")
    rc3e = _run("validate_read_about_versions.py", [])
    if rc3e != 0:
        print(
            "\n⚠️   Read-about version drift found (warn-only at session start).\n"
            "     Run: python3 Brain/scripts/validate_read_about_versions.py\n",
        )

    # Step 3f: regional stats chip + bar coverage — checks that every shipped
    # non-US, non-Canada guide's country has a filter chip AND a bar-row in every
    # section of its regional stats page (Asia-Stats, Europe-Stats, Caribbean-Stats,
    # South-America-Stats). The ship gate (_check_guide_in_regional_stats) only checks
    # bar-rows for the guide being shipped; this backstop catches chip-only gaps and
    # fleet-wide drift from later edits. Warn-only at session start. (added 2026-07-18)
    print("\n▶ Step 3f — regional stats chip + bar coverage (Asia/Europe/Caribbean/SA)")
    rc3f = _run("validate_regional_stats_chips.py", ["--warn"])
    if rc3f != 0:
        print(
            "\n⚠️   Regional stats chip/bar gaps found (warn-only at session start).\n"
            "     Run: python3 Brain/scripts/validate_regional_stats_chips.py\n",
        )

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

    # Claim a build lease on this guide folder — while it's held, no other crib's
    # auto-fixer / audit will touch this guide (crib_safety.owned_by_other). The
    # lease is released at ship. Best-effort: a lease failure never blocks a build.
    try:
        sys.path.insert(0, str(HERE))
        import crib_safety as _cs
        _holder = _cs.claim(WEB_ROOT / "Guides" / city)
        _me = _cs.crib_id()
        if _holder == _me:
            print(f"🔒 Claimed build lease on {city} ({_me}).")
        else:
            print(f"⚠  {city} is already leased by another crib ({_holder}). "
                  f"It may be an in-progress build — coordinate before continuing.")
    except Exception as _e:  # noqa: BLE001
        print(f"  (lease skipped: {_e})")

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

## Phase 2 → 3 Gate — Scaffold
- [ ] preflight exit 0: python3 guide_tools.py preflight {city}
- [ ] stub generated: python3 guide_tools.py stub {city} --days N --country Country

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
- [ ] Brain/Reference/Read-About-Pages.html

## Phase 6 — Ship gate
- [ ] Brain/Reference/Ship Checklist.html
- [ ] validate_itinerary.py passes
- [ ] every extra populated or carries negative-finding line
- [ ] Read About page built, linked both ways
"""
    tracker_path.write_text(content, encoding="utf-8")
    print(f"✅  Build-state tracker created: {tracker_path}")
    print()
    print("   Next steps:")
    print("   1. Read Phase 1 files and check them off as [x]")
    print("   2. Read Phase 2 files and check them off as [x]")
    print("   3. Run preflight (must exit 0 before any HTML)")
    print("   4. Run stub to generate the scaffold:")
    print(f"        python3 guide_tools.py stub {city} --days N --country Country")
    print("   5. Look up the hotel in Travel-Website/Trip-Essentials/Trips.html")
    print("   6. Fill in [FILL: ...] tokens — check Brain/Reference/Brain.md (Part 4 — Cities Skip List) first")
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
    print(f"    Next: generate the scaffold before writing any content:")
    print(f"")
    print(f"      python3 guide_tools.py stub {city} --days N --country Country")
    print(f"")
    print(f"    The scaffold is a structurally-correct HTML skeleton with [FILL: ...] tokens.")
    print(f"    Replace the tokens with researched content — never construct HTML from scratch.")
    print(f"    Reminder: format = CORE RULES, content = live research. Never open a")
    print(f"    sibling guide as a template — it imports that guide's drift.\n")
    return 0


def _check_guide_indexed(guide_path: Path) -> int:
    """
    Ship gate: verify this specific guide's city folder is in Guides-Index.html.

    Each crib checks only its own guide — not all guides. Fires at ship time only.
    The city folder is the parent directory of the guide HTML file
    (e.g. Guides/Edinburgh/ for Guides/Edinburgh/edinburgh_v1.html).

    Added 2026-06-02: replaced check_guides_index_coverage in brain_check.py,
    which ran at session start and incorrectly flagged other cribs' in-progress
    builds. This check is scoped to one guide, runs only at ship time, and each
    crib only validates its own guide's entry.
    """
    index_file = WEB_ROOT / "Guides-Index.html"

    if not index_file.exists():
        print(
            "\n🚫  SHIP BLOCKED — Guides-Index.html missing.\n"
            "    The master index does not exist.\n",
            file=sys.stderr,
        )
        return 1

    from urllib.parse import quote
    city_folder = guide_path.parent.name  # e.g. "Edinburgh"
    city_folder_enc = quote(city_folder, safe="")  # "Manuel%20Antonio"
    index_html = index_file.read_text(encoding="utf-8")

    if (
        f"./Guides/{city_folder}/" not in index_html
        and f'href="./Guides/{city_folder}/' not in index_html
        and f"./Guides/{city_folder_enc}/" not in index_html
        and f'href="./Guides/{city_folder_enc}/' not in index_html
    ):
        print(
            f"\n🚫  SHIP BLOCKED — Guides-Index.html has no entry for Guides/{city_folder}/.\n"
            f"    Complete the 4-step index update before shipping:\n"
            f"    Brain/Reference/Navigation.html § 5\n",
            file=sys.stderr,
        )
        return 1

    print(f"  ✅  Guides-Index.html — {city_folder} entry found.")
    return 0


def _check_guide_inline(guide_path: Path) -> int:
    """Ship gate: the shipping city's index card must have an entry in all three
    inline JS data blocks in Guides-Index.html that power the on-card filters:

      • CLIMATE_INLINE  — monthly hi/lo temps (weather filter)
      • COST_DATA       — cost tier + currency (compare/filter cards)
      • SAFETY_DATA     — safety level (compare/filter cards)

    _check_guide_indexed above only proves the <a class="dest-card"> exists. It
    does NOT prove the card has matching inline data, so a card could ship with
    blank weather/cost/safety filters and the existing gates stay green. This is
    the scoped, ship-time counterpart of validate_guides_index_inline.py (which
    audits the whole index by hand). Scoped to the SHIPPING city only so a
    pre-existing gap on an unrelated legacy card can't block this ship.

    The JS resolves a card's key as the folder name from its href (climateKey),
    falling back to the display name — this mirrors that logic.

    Added 2026-06-21.
    """
    import json as _json
    import re as _re
    from urllib.parse import unquote

    city_folder = guide_path.parent.name  # e.g. "Naples"
    index_file = WEB_ROOT / "Guides-Index.html"
    if not index_file.exists():
        print(
            "\n🚫  SHIP BLOCKED — Guides/Guides-Index.html missing (inline-data check).\n",
            file=sys.stderr,
        )
        return 1

    html = index_file.read_text(encoding="utf-8", errors="replace")

    def _extract(var_name: str) -> dict:
        start_pat = _re.compile(rf'var {_re.escape(var_name)}\s*=\s*\{{')
        sm = start_pat.search(html)
        if not sm:
            return {}
        depth, i, n = 1, sm.end(), len(html)
        in_str, str_char = False, None
        while i < n and depth > 0:
            c = html[i]
            if in_str:
                if c == '\\':
                    i += 1
                elif c == str_char:
                    in_str = False
            else:
                if c in ('"', "'"):
                    in_str, str_char = True, c
                elif c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
            i += 1
        if depth != 0:
            return {}
        try:
            return _json.loads(html[sm.end() - 1:i])
        except _json.JSONDecodeError:
            return {}

    blocks = {
        "CLIMATE_INLINE": _extract("CLIMATE_INLINE"),
        "COST_DATA":      _extract("COST_DATA"),
        "SAFETY_DATA":    _extract("SAFETY_DATA"),
    }
    unparseable = [name for name, data in blocks.items() if not data]
    if unparseable:
        print(
            f"\n🚫  SHIP BLOCKED — could not parse inline block(s) in Guides-Index.html: "
            f"{', '.join(unparseable)}.\n"
            f"    Check the var {unparseable[0]} = {{...}}; declaration is valid JSON.\n",
            file=sys.stderr,
        )
        return 1

    # Resolve this card's display name (the JS fallback key) from its href folder.
    name = None
    for _m in _re.finditer(
        r'<a class="dest-card"[^>]*href="([^"]+)"[^>]*>.*?<span class="dest-name">([^<]+)</span>',
        html, _re.DOTALL,
    ):
        if 'data-special' in _m.group(0):
            continue
        href, dest_name = _m.group(1), _m.group(2)
        if unquote(href).lstrip("./").replace("Guides/", "", 1).split("/")[0] == city_folder:
            name = dest_name
            break

    missing = [
        name_ for name_, data in blocks.items()
        if city_folder not in data and (name is None or name not in data)
    ]
    if not missing:
        print(f"  ✅  Inline data — {city_folder} present in CLIMATE_INLINE, COST_DATA, SAFETY_DATA.")
        return 0

    # Build ready-to-paste fix strings for each missing block.
    fix_lines = []
    for block in missing:
        if block == "CLIMATE_INLINE":
            try:
                cdata = _json.loads((WEB_ROOT / "assets" / "climate.json").read_text(encoding="utf-8"))
                entry = cdata.get(name) or cdata.get(city_folder)
                if entry and "hi" in entry and "lo" in entry:
                    hi = entry["hi"]
                    lo  = entry["lo"]
                    fix_lines.append(
                        f'  CLIMATE_INLINE → paste inside var CLIMATE_INLINE = {{...}} in Guides-Index.html:\n'
                        f'    "{city_folder}": {{"hi": {hi}, "lo": {lo}}}'
                    )
                else:
                    fix_lines.append(
                        f'  CLIMATE_INLINE — city not yet in assets/climate.json; run:\n'
                        f'    python3 Brain/scripts/build_climate.py   then retry ship'
                    )
            except Exception:
                fix_lines.append(
                    f'  CLIMATE_INLINE — monthly hi/lo 12-value arrays; copy from assets/climate.json'
                )
        elif block == "SAFETY_DATA":
            try:
                sdata = _json.loads((Path(__file__).parent / "safety_levels.json").read_text(encoding="utf-8"))
                entry = sdata.get(city_folder)
                if entry:
                    note = entry.get("display", city_folder.replace("-", " "))
                    fix_lines.append(
                        f'  SAFETY_DATA → paste inside var SAFETY_DATA = {{...}} in Guides-Index.html:\n'
                        f'    "{city_folder}": {{"level": "{entry["level"]}", "note": "{note}"}}'
                    )
                else:
                    fix_lines.append(
                        f'  SAFETY_DATA — city not in Brain/scripts/safety_levels.json; add it there first,\n'
                        f'    then re-run ship (build_safety_guide.py runs automatically).\n'
                        f'    Format: "{city_folder}": {{"level": "L1|L2|L3|L4", "note": "Display Name"}}'
                    )
            except Exception:
                fix_lines.append(
                    f'  SAFETY_DATA — {{"level": "L1|L2|L3|L4", "note": "Display Name"}}'
                )
        elif block == "COST_DATA":
            fix_lines.append(
                f'  COST_DATA → paste inside var COST_DATA = {{...}} in Guides-Index.html:\n'
                f'    "{city_folder}": {{"tier": "budget|mid|upscale|luxury", "currency": "USD (dollar)"}}'
            )

    print(
        f"\n🚫  SHIP BLOCKED — {city_folder} card is missing inline data: {', '.join(missing)}.\n"
        f"    The card exists but its on-card filters would be blank.\n\n"
        + "\n\n".join(fix_lines) + "\n\n"
        f"    Then: python3 Brain/scripts/validate_guides_index_inline.py   # must exit 0\n",
        file=sys.stderr,
    )
    return 1


def _refresh_theme_tags(guide_path: Path) -> int:
    """Advisory (never blocks): keep the guides-index 🎯 Trip-type theme filter in
    sync, and remind if the shipping city has no theme tag.

    Theme tags (THEME_DATA in Guides-Index.html) power the Trip-type filter — they
    let visitors narrow ~155 guides by vibe (beach / wine / ski …). The curated
    source of truth is Brain/scripts/build_theme_tags.py. This step:
      1. Re-applies the generator so any newly-added curated tags land in the page.
      2. Checks whether THIS city ended up tagged; if not, prints a reminder.

    Every shipped guide must have at least one theme tag so it shows up in the
    Trip-type filter — returns 1 (blocks ship) if the city ends up untagged after
    the refresh.  Full record: memory project_theme_filter. Added 2026-06-21.
    Promoted to hard gate 2026-06-22 (user requirement: all three index filters
    must be populated before a guide ships).
    """
    import json as _json
    import re as _re
    from urllib.parse import unquote

    try:
        print("\n▶ Refreshing Trip-type theme tags…")
        _run("build_theme_tags.py", ["--apply"])
    except Exception as _e:  # noqa: BLE001 — never let theme tags break a ship
        print(f"  ⚠️  theme-tag refresh skipped ({_e}). "
              f"Run: python3 Brain/scripts/build_theme_tags.py --apply", file=sys.stderr)
        return 0

    index_file = WEB_ROOT / "Guides-Index.html"
    try:
        html = index_file.read_text(encoding="utf-8", errors="replace")
        m = _re.search(r'var THEME_DATA\s*=\s*(\{.*?\})\s*;', html, _re.DOTALL)
        theme = _json.loads(m.group(1)) if m else {}
        city_folder = guide_path.parent.name
        name = None
        for _m in _re.finditer(
            r'<a class="dest-card"[^>]*href="([^"]+)"[^>]*>.*?<span class="dest-name">([^<]+)</span>',
            html, _re.DOTALL,
        ):
            if 'data-special' in _m.group(0):
                continue
            href, dest_name = _m.group(1), _m.group(2)
            if unquote(href).lstrip("./").replace("Guides/", "", 1).split("/")[0] == city_folder:
                name = dest_name
                break
        key = name or city_folder
        if key in theme and theme[key]:
            print(f"  ✅  Theme tags — {key}: {', '.join(theme[key])}.")
            return 0
        print(
            f"\n🚫  SHIP BLOCKED — {key} has no Trip-type theme tag.\n"
            f"    Every guide must carry at least one tag so it appears in the 🎯 Trip type filter.\n"
            f"    Add {key} to one or more lists in Brain/scripts/build_theme_tags.py:\n"
            f"      nature · beach · islands · snow · foodie · history · art\n"
            f"      nightlife · wine · amusement · kids\n"
            f"    Then re-run: python3 Brain/scripts/build_theme_tags.py --apply\n",
            file=sys.stderr,
        )
        return 1
    except Exception as _e:  # noqa: BLE001 — skip on error but don't block
        print(f"  ⚠️  theme-tag membership check skipped ({_e}).", file=sys.stderr)
        return 0


def _refresh_lang_tags(guide_path: Path) -> int:
    """Advisory (never blocks): keep the guides-index 🗣 Language feature in sync.

    Every dest-card carries a data-lang attribute (space-separated ISO language
    codes) that powers the Language panel — the By Language chip filter and the
    By Guide destination picker (pick a place → see its spoken languages). The
    curated source of truth is Brain/scripts/build_lang_tags.py (COUNTRY_LANGS +
    CITY_OVERRIDES). This step re-applies the generator so a newly shipped guide's
    card gets a data-lang, then checks THIS city ended up tagged.  Returns 1 (blocks
    ship) if the card still has no data-lang after the refresh.  Full record: memory
    project_language_feature. Added 2026-06-22. Promoted to hard gate 2026-06-22.
    """
    import re as _re
    from urllib.parse import unquote

    try:
        print("\n▶ Refreshing 🗣 Language tags (data-lang)…")
        _run("build_lang_tags.py", ["--apply"])
    except Exception as _e:  # noqa: BLE001 — never let lang tags break a ship
        print(f"  ⚠️  lang-tag refresh skipped ({_e}). "
              f"Run: python3 Brain/scripts/build_lang_tags.py --apply", file=sys.stderr)
        return 0

    index_file = WEB_ROOT / "Guides-Index.html"
    try:
        html = index_file.read_text(encoding="utf-8", errors="replace")
        city_folder = guide_path.parent.name
        langs = None
        for tag in _re.findall(r'<a class="dest-card"[^>]*>', html):
            href_m = _re.search(r'href="([^"]+)"', tag)
            if href_m and unquote(href_m.group(1)).lstrip("./").replace("Guides/", "", 1).split("/")[0] == city_folder:
                dl_m = _re.search(r'data-lang="([^"]*)"', tag)
                langs = (dl_m.group(1).strip() if dl_m else "")
                break
        if langs:
            print(f"  ✅  Language tags — {city_folder}: {langs}.")
            return 0
        print(
            f"\n🚫  SHIP BLOCKED — {city_folder} card has no data-lang.\n"
            f"    Every guide card must carry data-lang so it appears in the 🗣 Language filter.\n"
            f"    Add the country to COUNTRY_LANGS (or add a CITY_OVERRIDES entry) in\n"
            f"    Brain/scripts/build_lang_tags.py, then re-run:\n"
            f"      python3 Brain/scripts/build_lang_tags.py --apply\n",
            file=sys.stderr,
        )
        return 1
    except Exception as _e:  # noqa: BLE001 — skip on error but don't block
        print(f"  ⚠️  lang-tag membership check skipped ({_e}).", file=sys.stderr)
        return 0


def _refresh_days_data(guide_path: Path) -> int:
    """Ship gate: ensure DAYS_DATA in Guides-Index.html has an entry for this guide.

    DAYS_DATA powers the "Trip Length" filter (days-jump chips 1–10 days).  Without
    an entry the guide is invisible to that filter.  build_days_data.py auto-detects
    the day count by counting id="dayN" anchors in the guide HTML, so this check is
    fully automatic — no curation needed.

    Returns 0 if the city ends up in DAYS_DATA after the refresh; 1 (blocks ship) if
    it is still absent, meaning the guide's HTML lacks id="dayN" markers (non-standard
    structure).  Added 2026-06-22.
    """
    import json as _json
    import re as _re
    from urllib.parse import unquote

    city_folder = guide_path.parent.name
    print("\n▶ Refreshing Trip-length DAYS_DATA…")
    try:
        _run("build_days_data.py", ["--apply"])
    except Exception as _e:  # noqa: BLE001
        print(f"  ⚠️  DAYS_DATA refresh skipped ({_e}). "
              f"Run: python3 Brain/scripts/build_days_data.py --apply", file=sys.stderr)
        return 0  # skip but don't block if script itself fails

    index_file = WEB_ROOT / "Guides-Index.html"
    try:
        html = index_file.read_text(encoding="utf-8", errors="replace")
        m = _re.search(r'var DAYS_DATA\s*=\s*(\{.*?\})\s*;', html, _re.DOTALL)
        days_map = _json.loads(m.group(1)) if m else {}
        # Resolve folder → display name
        name = None
        for href, dest_name in _re.findall(
            r'<a class="dest-card"[^>]*href="([^"]+)"[^>]*>.*?<span class="dest-name">([^<]+)</span>',
            html, _re.DOTALL,
        ):
            if unquote(href).lstrip("./").replace("Guides/", "", 1).split("/")[0] == city_folder:
                name = dest_name.strip()
                break
        key = name or city_folder
        if key in days_map:
            print(f"  ✅  DAYS_DATA — {key}: {days_map[key]} day(s).")
            return 0
        print(
            f"\n🚫  SHIP BLOCKED — {key} is not in DAYS_DATA.\n"
            f"    build_days_data.py couldn't detect any id=\"dayN\" anchors in the guide HTML.\n"
            f"    Every day block must carry id=\"day1\", id=\"day2\", … on its div:\n"
            f"      <div class=\"day-block\" id=\"day1\">\n"
            f"    Fix the guide HTML, then re-run: python3 Brain/scripts/build_days_data.py --apply\n",
            file=sys.stderr,
        )
        return 1
    except Exception as _e:  # noqa: BLE001
        print(f"  ⚠️  DAYS_DATA check skipped ({_e}).", file=sys.stderr)
        return 0


def _check_guide_pinned(guide_path: Path) -> int:
    """
    Ship gate: verify this guide's city has a pin in the unified world map.

    One map now holds every pin: Trip-Essentials/Maps/World-Map.html (the 7
    region maps were consolidated into a single fly-to-region world map). The
    city name (or its href path) just needs to be present in the PINS array.

    Added 2026-06-02: enforces Navigation.html § 5 step 5 (map pin rule).
    Updated 2026-06-02: expanded from 2 maps to all 6 continent maps.
    Updated 2026-06-13: added Caribbean Map (7th) — Travel-Website reorg pin target.
    Updated 2026-06-20: 7 region maps → one unified World-Map.html.
    """
    city_folder = guide_path.parent.name  # e.g. "Amsterdam"
    essentials = WEB_ROOT / "Trip-Essentials"
    maps_dir  = essentials / "Maps"
    map_files = [
        maps_dir / "World-Map.html",
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
        f"    Add a pin to the unified world map before shipping:\n"
        f"    • Trip-Essentials/Maps/World-Map.html — add to the PINS array,\n"
        f"      under the matching region comment block.\n"
        f"    Entry format in the PINS array:\n"
        f"    ['{city_folder}', lon, lat, '../../Guides/{city_folder.replace(' ', '%20')}/file.html']\n"
        f"    (folder may have spaces; the link must percent-encode them — %20, never a raw space)\n"
        f"    Full rule: Brain/Reference/Navigation.html § 5 step 5\n",
        file=sys.stderr,
    )
    return 1


def _check_guide_in_status_dots(guide_path: Path) -> int:
    """Ship gate: verify the city is listed in Status Dots — guides_index.md.

    Status Dots — guides_index.md is AUTO-GENERATED by build_status_dots.py from
    the data-status attributes on dest-cards in Guides-Index.html (source of truth).
    It is NOT hand-edited. Running update-index before ship triggers the rebuild and
    populates this file from the card. The All/Been/Want toggle and gold dot CSS were
    removed 2026-07-19; data-status attributes are kept as an inert reserved attribute
    for the Step 4 world tracker. This gate just confirms the city is in the generated
    file before the push — if absent, run update-index first.

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
        f"    The file is auto-generated by build_status_dots.py from data-status\n"
        f"    attributes in Guides-Index.html. Run update-index first to trigger\n"
        f"    the rebuild:\n"
        f"      python3 Brain/scripts/guide_tools.py update-index {city_folder}\n"
        f"    If the card is not yet in Guides-Index.html, add it with data-status=\"want\"\n"
        f"    then re-run update-index before ship.\n"
        f"    Format (for reference only — do not hand-edit):\n"
        f"      - [ ] {city_folder}   (want to go — default)\n"
        f"      - [x] {city_folder}   (already been)\n",
        file=sys.stderr,
    )
    return 1


def _check_guide_fmap(guide_path: Path) -> int:
    """Ship gate: verify the guide has an entry in the FMAP block of Guides-Index.html.

    The FMAP (flight-time map data) in Guides-Index.html must have an entry for
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
    index_file = WEB_ROOT / "Guides-Index.html"

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

    # Check: any FMAP key contains the city folder name (raw or URL-encoded)
    from urllib.parse import quote as _quote
    folder_lower = city_folder.lower()
    folder_enc_lower = _quote(city_folder, safe="").lower()
    matched_key = next(
        (k for k in fmap if folder_lower in k.lower() or folder_enc_lower in k.lower()),
        None,
    )
    if matched_key:
        print(f"  ✅  FMAP entry — {city_folder} found ({matched_key}).")
        return 0

    print(
        f"\n🚫  SHIP BLOCKED — no FMAP entry found for {city_folder} in Guides-Index.html.\n"
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
    climate_city = city_folder
    climate_json = ASSETS_DIR / "climate.json"
    weather_js = ASSETS_DIR / "weather.js"
    # Climate keys are display names (often with a space, e.g. "Santa Monica")
    # while the guide folder may be hyphenated (e.g. "Santa-Monica") per the
    # 2026-07-05 hyphen migration — accept either form, same as the Currency
    # Guide check below.
    import unicodedata as _ud

    def _ascii(s: str) -> str:
        return _ud.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii").lower()

    cf_lower = climate_city.lower()
    cf_lower_display = cf_lower.replace("-", " ")
    cf_ascii = _ascii(climate_city)
    cf_ascii_display = cf_ascii.replace("-", " ")
    missing = []

    # climate.json — keys are guide folder names or display names
    if not climate_json.exists():
        missing.append("assets/climate.json (file missing)")
    else:
        try:
            data = _json.loads(climate_json.read_text(encoding="utf-8", errors="replace"))
            keys = {k.lower() for k in data if k != "_meta"}
            ascii_keys = {_ascii(k) for k in data if k != "_meta"}
            if (cf_lower not in keys and cf_lower_display not in keys
                    and cf_ascii not in ascii_keys and cf_ascii_display not in ascii_keys):
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
                baked_keys = {k.lower() for k in baked}
                baked_ascii_keys = {_ascii(k) for k in baked}
                baked_ok = (cf_lower in baked_keys or cf_lower_display in baked_keys
                            or cf_ascii in baked_ascii_keys or cf_ascii_display in baked_ascii_keys)
            except _json.JSONDecodeError:
                baked_ok = False
        if not baked_ok:
            # fallback: a bare key search, in case the markers moved
            baked_ok = (
                _re.search(r'"' + _re.escape(climate_city) + r'"\s*:', wjs, _re.IGNORECASE) is not None
                or _re.search(r'"' + _re.escape(climate_city.replace("-", " ")) + r'"\s*:', wjs, _re.IGNORECASE) is not None
                or _re.search(r'"' + _re.escape(_ascii(climate_city)) + r'"\s*:', wjs, _re.IGNORECASE) is not None
            )
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
        gl_ascii = {_ascii(k): v for k, v in gl.items()}
        href = (gl_lower.get(cf_lower) or gl_lower.get(cf_lower_display)
                or gl_ascii.get(cf_ascii) or gl_ascii.get(cf_ascii_display))
        if not href:
            missing.append("Climate Finder GUIDE_LINKS (By Climate guide link)")
        else:
            from urllib.parse import unquote as _unquote
            target = (climate_finder.parent / _unquote(href)).resolve()
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


def _check_guide_also_on_this_site(guide_path: Path) -> int:
    """Ship gate: the guide's also-on-this-site block must exist and contain all
    seven universal links that every guide is required to carry.

    The `<!-- also-on-this-site --> … <!-- /also-on-this-site -->` block is the "Also
    on this site" chip rail shown at the bottom of every guide.  Seven pages are
    universal — every guide, every region, no exceptions:

        Weather.html              🌤️  Weather
        Time-Zones.html           🕐  Time Zones
        Plug-Adapter-Guide.html   🔌  Plug Adapter
        Currency-Guide.html       💰  Currency
        Safety-Guide.html         🛡️  Safety Guide
        Visas.html                🪪  Visas
        Maps/World-Map.html       🗺️  Map (region anchor e.g. #eu)

    Stats is region-specific (Asia-Stats, Caribbean-Stats, etc.) and is NOT
    enforced here — region detection requires the currency map.  The fleet sweep
    (validate_guide_coverage.py + check_coverage.py) enforces this at the
    whole-fleet level.  European Train Guide is EU-only and also not enforced here.

    Canonical order enforced separately by validate_itinerary.py TR-4.

    Added 2026-06-22. Updated 2026-06-27 — expanded to all 6 universal pills.
    Updated 2026-07-23 — added Maps/World-Map.html as 7th universal pill.
    """
    import re as _re

    text = guide_path.read_text(encoding="utf-8", errors="replace")
    city = guide_path.parent.name

    # 1. Block must exist
    if "<!-- also-on-this-site -->" not in text:
        print(
            f"\n🚫  SHIP BLOCKED — {city} is missing the also-on-this-site block.\n"
            f"    Add a <!-- also-on-this-site --> … <!-- /also-on-this-site --> section\n"
            f"    with 'Also on this site' chips before </body>.\n"
            f"    Required universal links: Weather · Time Zones · Plug Adapter · Currency · Safety Guide · Visas · Map.\n",
            file=sys.stderr,
        )
        return 1

    # 2. All seven universal links must be present (case-insensitive substring match)
    REQUIRED = [
        ("Weather.html",            "🌤️  Weather"),
        ("Time-Zones.html",         "🕐  Time Zones"),
        ("Plug-Adapter-Guide.html", "🔌  Plug Adapter"),
        ("Currency-Guide.html",     "💰  Currency"),
        ("Safety-Guide.html",       "🛡️  Safety Guide"),
        ("Visas.html",              "🪪  Visas"),
        ("Maps/World-Map.html",     "🗺️  Map (e.g. World-Map.html#eu)"),
    ]
    text_lower = text.lower()
    missing = [label for filename, label in REQUIRED if filename.lower() not in text_lower]

    if missing:
        print(
            f"\n🚫  SHIP BLOCKED — {city} also-on-this-site block is missing required links:\n"
            + "".join(f"      • {m}\n" for m in missing)
            + f"    Add the missing chips to the <!-- also-on-this-site --> section.\n"
            f"    Canonical order: Weather · Time Zones · Plug Adapter · Currency · Safety Guide · Visas · Stats · European Train Guide (EU only) · Map.\n",
            file=sys.stderr,
        )
        return 1

    print(f"  ✅  also-on-this-site — {city} has all required universal links.")
    return 0


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

    city_folder_display = city_folder.replace("-", " ")
    if city_folder in page_cities or city_folder_display in page_cities:
        print(f"  ✅  Currency Guide — {city_folder}'s country is covered.")
        return 0

    # Also check the guide's dest-name from guides_index (handles guides with country
    # suffix in folder name, e.g. San-Jose-Costa-Rica → dest-name "San José")
    import re as _re
    index_path = HERE.parent.parent / "Travel-Website" / "Guides-Index.html"
    if index_path.exists():
        idx_html = index_path.read_text(encoding="utf-8")
        # Find dest-name for guide cards whose href points to this city folder
        pattern = rf'href="[^"]*/{_re.escape(city_folder)}/[^"]*"[^>]*>.*?dest-name">([^<]+)<'
        m = _re.search(pattern, idx_html, _re.DOTALL)
        if m:
            dest_name = m.group(1).strip()
            if dest_name in page_cities:
                print(f"  ✅  Currency Guide — {city_folder} (dest-name '{dest_name}') country is covered.")
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


def _check_guide_in_safety(guide_path: Path) -> int:
    """Ship gate: the guide's city folder must have an entry in safety_levels.json.

    The Safety Guide is auto-generated from safety_levels.json by build_safety_guide.py.
    A city absent from the json is silently dropped from the Safety Guide — this gate
    catches that at ship time so it can't slip through unnoticed.

    Fix a miss: add the city folder name as a key to Brain/scripts/safety_levels.json
    with level (L1–L4), file, data_city, display, country, and verified fields, then
    rerun `python3 Brain/scripts/build_safety_guide.py`.

    Added 2026-07-06.
    """
    import json as _json

    city_folder = guide_path.parent.name
    json_path = HERE / "safety_levels.json"
    if not json_path.exists():
        print("  ⚠️  Safety check skipped (safety_levels.json missing).")
        return 0

    try:
        safety_data = _json.loads(json_path.read_text(encoding="utf-8"))
    except Exception as _e:  # noqa: BLE001
        print(f"  ⚠️  Safety check skipped (safety_levels.json load failed: {_e}).")
        return 0

    if city_folder in safety_data:
        level = safety_data[city_folder].get("level", "?")
        print(f"  ✅  Safety Guide — {city_folder} present ({level}).")
        return 0

    print(
        f"\n🚫  SHIP BLOCKED — {city_folder} is not in Brain/scripts/safety_levels.json.\n"
        f"    Every guide needs a State Dept travel advisory level in the Safety Guide.\n"
        f"    Add an entry with the city's folder name as key:\n"
        f'      "{city_folder}": {{\n'
        f'        "level": "L1",   # L1–L4 from travel.state.gov\n'
        f'        "file": "{city_folder.lower()}_v1.html",\n'
        f'        "data_city": "{city_folder.lower().replace("-", " ")}",\n'
        f'        "display": "{city_folder.replace("-", " ")}",\n'
        f'        "country": "🇺🇸 USA",\n'
        f'        "verified": "2026-07"\n'
        f"      }}\n"
        f"    Then rebuild: python3 Brain/scripts/build_safety_guide.py\n",
        file=sys.stderr,
    )
    return 1


def _check_guide_in_byg_water(guide_path: Path) -> int:
    """Ship gate: the guide's country must be covered by WATER_DATA in Before-You-Go.html.

    WATER_DATA is keyed by country name (matching CITY_COUNTRIES values). A city in
    an already-mapped country passes automatically. Only a brand-new country needs a
    new entry added to WATER_DATA.

    Fix a miss: open Travel-Website/Trip-Essentials/Before-You-Go.html and add the
    country name to the correct array in WATER_DATA ('safe', 'varies', or 'unsafe')
    based on Tap-Water.html regional status. Also verify the country appears in
    CITY_COUNTRIES for this city.

    Added 2026-07-24.
    """
    import re as _re

    byg_path = WEB_ROOT / "Trip-Essentials" / "Before-You-Go.html"
    if not byg_path.exists():
        print("  ⚠️  BYG water check skipped (Before-You-Go.html missing).")
        return 0

    byg_html = byg_path.read_text(encoding="utf-8")

    # Extract CITY_COUNTRIES to get this city's country
    city_folder = guide_path.parent.name
    city_display = city_folder.replace("-", " ")
    cc_match = _re.search(r"var CITY_COUNTRIES\s*=\s*(\{[^;]+\});", byg_html)
    if not cc_match:
        print("  ⚠️  BYG water check skipped (CITY_COUNTRIES not found).")
        return 0

    import json as _json
    try:
        city_countries = _json.loads(cc_match.group(1))
    except Exception:
        print("  ⚠️  BYG water check skipped (CITY_COUNTRIES parse failed).")
        return 0

    country = city_countries.get(city_display) or city_countries.get(city_folder)
    if not country:
        print(
            f"\n🚫  SHIP BLOCKED — {city_display!r} is not in CITY_COUNTRIES in Before-You-Go.html.\n"
            f"    Every guide needs a country mapping so Before You Go can look up data.\n"
            f"    Add to the CITY_COUNTRIES dict (line ~203 in Before-You-Go.html):\n"
            f'      "{city_display}": "Country Name"\n',
            file=sys.stderr,
        )
        return 1

    # Extract WATER_DATA arrays
    water_match = _re.search(
        r"var WATER_DATA\s*=\s*\{[^}]*'safe'\s*:\s*(\[[^\]]+\])[^}]*'varies'\s*:\s*(\[[^\]]+\])[^}]*'unsafe'\s*:\s*(\[[^\]]+\])",
        byg_html, _re.DOTALL
    )
    if not water_match:
        print("  ⚠️  BYG water check skipped (WATER_DATA not found).")
        return 0

    def _parse_arr(s: str) -> list:
        return [x.strip().strip("'\"") for x in _re.findall(r"'[^']*'|\"[^\"]*\"", s)]

    safe_list    = _parse_arr(water_match.group(1))
    varies_list  = _parse_arr(water_match.group(2))
    unsafe_list  = _parse_arr(water_match.group(3))
    all_countries = safe_list + varies_list + unsafe_list

    if country in all_countries:
        status = "safe" if country in safe_list else "varies" if country in varies_list else "unsafe"
        print(f"  ✅  BYG tap water — {country} covered ({status}).")
        return 0

    print(
        f"\n🚫  SHIP BLOCKED — {country!r} is not in WATER_DATA in Before-You-Go.html.\n"
        f"    Before You Go shows tap water status per country — new countries need an entry.\n"
        f"    Open Travel-Website/Trip-Essentials/Before-You-Go.html and add {country!r}\n"
        f"    to one of the arrays in WATER_DATA (around the SAFETY_FULL block):\n"
        f"      'safe'   — tap water is safe to drink in major cities\n"
        f"      'varies' — depends on city/area; check Tap-Water.html for the region\n"
        f"      'unsafe' — avoid tap water; use bottled\n"
        f"    Reference: Travel-Website/Trip-Essentials/Tap-Water.html (grouped by region)\n",
        file=sys.stderr,
    )
    return 1


def _check_guide_in_us_stats(guide_path: Path) -> int:
    """Ship gate (US guides only): the city must appear in every stat category in
    Stats-Across-US.html — either as a ranked table row (class="city-link") or
    listed in that category's cat-guides-note ("not shown" footnote).

    First checks whether this guide is a US guide at all via the Currency-Guide
    city→country mapping (country-block id="United_States"). Non-US guides pass
    automatically.

    Fix a gap: open Stats-Across-US.html, find every category the city is absent
    from, and either add it as a ranked row or add its name to the cat-guides-note
    for categories where only state-level data exists.

    Added 2026-06-22.
    """
    import re as _re

    city = guide_path.parent.name

    # ── 1. Is this a US guide? ───────────────────────────────────────────────
    cur_path = WEB_ROOT / "Trip-Essentials" / "Currency-Guide.html"
    if not cur_path.exists():
        print(f"  ⚠️  US-stats check skipped ({city}: Currency-Guide.html missing).")
        return 0

    cur_html = cur_path.read_text(encoding="utf-8", errors="replace")
    blocks = _re.findall(
        r'<div class="country-block"[^>]*id="([^"]+)"[^>]*>.*?<span class="cur-cities">Guides: (.*?)</span>',
        cur_html, _re.DOTALL,
    )
    us_cities: set[str] = set()
    for cid, cities_html in blocks:
        if cid != "United_States":
            continue
        cities_linked = _re.findall(r'>([^<]+)</a>', cities_html)
        cities_plain = [c.strip() for c in _re.sub(r'<[^>]+>', '', cities_html).split('·') if c.strip()]
        us_cities = set(cities_linked) | set(cities_plain)
        break

    if city not in us_cities:
        print(f"  ✅  US-stats check — {city} is not a US guide; skipping.")
        return 0

    # ── 2. Parse Stats-Across-US.html ───────────────────────────────────────
    stats_path = WEB_ROOT / "Trip-Essentials" / "Stats-Across-US.html"
    if not stats_path.exists():
        print(f"  ⚠️  US-stats check skipped ({city}: Stats-Across-US.html missing).")
        return 0

    stats_html = stats_path.read_text(encoding="utf-8", errors="replace")
    sections = _re.split(r'(?=<div class="stat-category")', stats_html)

    missing_cats: list[str] = []
    for sec in sections:
        if 'class="stat-category"' not in sec:
            continue
        title_m = _re.search(r'<h2[^>]*>(.*?)</h2>', sec, _re.DOTALL)
        title = _re.sub(r'<[^>]+>', '', title_m.group(1)).strip() if title_m else "Unknown"

        in_table = bool(_re.search(
            rf'class="city-link"[^>]*>[^<]*{_re.escape(city)}[^<]*<', sec
        ))
        note_m = _re.search(r'class="cat-guides-note"[^>]*>(.*?)</div>', sec, _re.DOTALL)
        in_note = note_m is not None and city in note_m.group(1)

        if not in_table and not in_note:
            missing_cats.append(title)

    if not missing_cats:
        print(f"  ✅  US-stats — {city} is present in every Stats-Across-US category.")
        return 0

    print(
        f"\n🚫  SHIP BLOCKED — {city} is missing from {len(missing_cats)} Stats-Across-US "
        f"categor{'y' if len(missing_cats)==1 else 'ies'}:\n"
        + "".join(f"      • {c}\n" for c in missing_cats)
        + f"\n    For each missing category, either:\n"
        f"      (a) add {city} as a ranked <tr class=\"city-link\"> row in that category, OR\n"
        f"      (b) add {city} to the category's <div class=\"cat-guides-note\"> footnote\n"
        f"          (use this for state-level categories where city data doesn't apply).\n"
        f"\n    Validator: python3 Brain/scripts/validate_us_stats.py\n",
        file=sys.stderr,
    )
    return 1


def _check_guide_in_delta_routes(guide_path: Path) -> int:
    """Ship gate: the guide city must have a card with data-guide="FolderName" in
    Delta-Routes-SEA.html.

    Seattle is exempt (it is the origin city).  For cities where the card uses a
    different place name (e.g. Oahu → Honolulu/HNL), add data-guide="Oahu" to that
    card manually — the gate checks the attribute, not the display name.

    When adding a new guide, research the Delta routing from SEA (every leg) on
    Google Flights / delta.com and add a card to the correct section of
    Travel-Website/Trip-Essentials/Delta-Routes-SEA.html with data-guide="FolderName".

    Added 2026-06-22.
    """
    import re as _re

    city = guide_path.parent.name

    if city == "Seattle":
        print(f"  ✅  Delta-Routes check — Seattle is the origin city; exempt.")
        return 0

    delta_path = WEB_ROOT / "Trip-Essentials" / "Delta-Routes-SEA.html"
    if not delta_path.exists():
        print(f"  ⚠️  Delta-Routes check skipped ({city}: Delta-Routes-SEA.html missing).")
        return 0

    delta_html = delta_path.read_text(encoding="utf-8", errors="replace")
    if f'data-guide="{city}"' in delta_html:
        print(f"  ✅  Delta-Routes — {city} has a card in Delta-Routes-SEA.html.")
        return 0

    print(
        f"\n🚫  SHIP BLOCKED — {city} has no card in Delta-Routes-SEA.html.\n"
        f"    Research the Delta routing from SEA → {city} (every leg) on\n"
        f"    Google Flights or delta.com, then add a card to the correct\n"
        f"    section of Travel-Website/Trip-Essentials/Delta-Routes-SEA.html:\n"
        f"    <div class=\"dest-card\" data-guide=\"{city}\">\n"
        f"      <div class=\"dest-city\">{city}</div>\n"
        f"      <div class=\"dest-code\">XYZ · Country</div>\n"
        f"      <div class=\"dest-meta\">SEA → HUB → XYZ (Xh Xm total)</div>\n"
        f"    </div>\n",
        file=sys.stderr,
    )
    return 1


def _mark_no_transit_card(city: str) -> int:
    """Write <!-- transit-card: none --> into the guide's HTML and log it to
    the guide's ship_log.md.

    Called by the crib after researching and confirming the city has no transit
    card system.  The gate (_check_guide_in_transit_cards) reads this comment
    from the guide HTML — no separate page edit required.

    Usage: python3 Brain/scripts/guide_tools.py no-transit-card <CityFolder>

    Added 2026-06-22.
    """
    import datetime as _dt

    guide_folder = WEB_ROOT / "Guides" / city
    if not guide_folder.exists():
        print(f"❌  Guide folder not found: {guide_folder}", file=sys.stderr)
        return 1

    html_files = list(guide_folder.glob("*.html"))
    if not html_files:
        print(f"❌  No HTML file found in {guide_folder}", file=sys.stderr)
        return 1
    guide_html_path = html_files[0]
    html = guide_html_path.read_text(encoding="utf-8", errors="replace")

    if "<!-- transit-card:" in html:
        print(f"✅  {city} already has a transit-card comment in {guide_html_path.name} — no change.")
        return 0

    # Insert after the validation stamp line (first line)
    lines = html.split("\n")
    insert_at = 1
    for i, line in enumerate(lines[:5]):
        if "<!-- validation:" in line:
            insert_at = i + 1
            break
    lines.insert(insert_at, f"<!-- transit-card: none -->")
    guide_html_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"✅  Added <!-- transit-card: none --> to {guide_html_path.name}.")

    # Log to ship_log.md
    log_path = guide_folder / "ship_log.md"
    stamp = _dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    note = f"\n{stamp} — {city} — transit card: none (no transit card system; researched during build)\n"
    with open(log_path, "a", encoding="utf-8") as _f:
        _f.write(note)
    print(f"   Logged in {log_path.name}")
    return 0


def _check_guide_in_transit_cards(guide_path: Path) -> int:
    """Ship gate: the guide HTML must contain a <!-- transit-card: ... --> comment
    recording the result of transit card research done during the build.

    Two valid forms:
      <!-- transit-card: none -->              (city has no transit card system)
      <!-- transit-card: Oyster Card | TfL --> (city has a card; name and network)

    The crib researches this during the guide build and writes the comment silently.
    Results are also logged to the guide's ship_log.md.

    Added 2026-06-22.
    """
    import re as _re

    city = guide_path.parent.name
    html = guide_path.read_text(encoding="utf-8", errors="replace")

    m = _re.search(r'<!--\s*transit-card:\s*(.+?)\s*-->', html)
    if m:
        value = m.group(1).strip()
        if value.lower() == "none":
            print(f"  ✅  Transit-Cards — {city}: no transit card system (confirmed during build).")
        else:
            print(f"  ✅  Transit-Cards — {city}: {value}.")
        return 0

    print(
        f"\n🚫  SHIP BLOCKED — {city} guide has no <!-- transit-card: ... --> comment.\n"
        f"\n"
        f"    CRIB ACTION REQUIRED:\n"
        f"    Search \"{city} transit card\" or \"{city} public transport card\".\n"
        f"\n"
        f"    A) City HAS a transit card → add near the top of the guide HTML\n"
        f"       (after the validation stamp) and add to City-Transit-Cards.html:\n"
        f"       <!-- transit-card: Card Name | Network | tap-to-pay: yes/no -->\n"
        f"\n"
        f"    B) City has NO transit card → run:\n"
        f"       python3 Brain/scripts/guide_tools.py no-transit-card {city}\n"
        f"       (writes the comment + logs to ship_log.md automatically)\n",
        file=sys.stderr,
    )
    return 1


def _check_guide_in_visas(guide_path: Path) -> int:
    """Ship gate: the guide's country must have a row in Visas.html.

    US guides pass automatically (domestic — no visa page needed).
    Caribbean islands are grouped under the single "Caribbean" row.
    Czech Republic is listed as "Czechia" in Visas — aliased here.

    If the country row is present but the city guide link is missing, the gate
    still passes (the link is cosmetic; country coverage is what matters).

    Added 2026-06-22.
    """
    import re as _re

    city = guide_path.parent.name
    essentials = WEB_ROOT / "Trip-Essentials"

    # ── 1. Determine country via Currency-Guide ──────────────────────────────
    cur_path = essentials / "Currency-Guide.html"
    if not cur_path.exists():
        print(f"  ⚠️  Visas check skipped ({city}: Currency-Guide.html missing).")
        return 0

    cur_html = cur_path.read_text(encoding="utf-8", errors="replace")
    blocks = _re.findall(
        r'<div class="country-block"[^>]*id="([^"]+)"[^>]*>.*?<span class="cur-cities">Guides: (.*?)</span>',
        cur_html, _re.DOTALL,
    )
    city_display = city.replace("-", " ")  # "Hong-Kong" → "Hong Kong"
    country_id: str | None = None
    for cid, cities_html in blocks:
        cities_linked = _re.findall(r'>([^<]+)</a>', cities_html)
        cities_plain = [c.strip() for c in _re.sub(r'<[^>]+>', '', cities_html).split('·') if c.strip()]
        if city in set(cities_linked) | set(cities_plain) or \
                city_display in set(cities_linked) | set(cities_plain):
            country_id = cid
            break

    if country_id is None:
        print(f"  ⚠️  Visas check skipped ({city}: not found in Currency-Guide — add it first).")
        return 0

    if country_id == "United_States":
        print(f"  ✅  Visas check — {city} is a US guide; no visa page entry needed.")
        return 0

    country_display = country_id.replace("_", " ")

    # ── 2. Country-name aliases (Currency-Guide id → Visas.html display name) ─
    CARIBBEAN = {
        "Aruba", "Bahamas", "Barbados", "Cayman Islands", "Curacao",
        "Sint Maarten", "Turks and Caicos", "Virgin Islands", "Puerto Rico",
    }
    VISA_ALIASES: dict[str, str] = {
        "Czech Republic": "Czechia",
        "United Arab Emirates": "United Arab Emirates",
    }
    if country_display in CARIBBEAN:
        visa_country = "Caribbean"
    else:
        visa_country = VISA_ALIASES.get(country_display, country_display)

    # ── 3. Check Visas.html ──────────────────────────────────────────────────
    visas_path = essentials / "Visas.html"
    if not visas_path.exists():
        print(f"  ⚠️  Visas check skipped ({city}: Visas.html missing).")
        return 0

    visas_html = visas_path.read_text(encoding="utf-8", errors="replace")
    # Strip flag emoji + whitespace to get plain country name from .cty spans
    cty_names = [
        _re.sub(r'^[\U0001F1E0-\U0001F1FF\U0001F3F4\U0001F3DD\U0001F3DF\U0001F3F3\U0001FA00-\U0001FFFF\U00002600-\U000027BF️️⃣🏝\s]+', '', n).strip()
        for n in _re.findall(r'class="cty">([^<]+)', visas_html)
    ]

    if visa_country in cty_names:
        print(f"  ✅  Visas — {country_display} row present in Visas.html.")
        return 0

    print(
        f"\n🚫  SHIP BLOCKED — {country_display} has no row in Visas.html.\n"
        f"\n"
        f"    Add a country row to the correct section of\n"
        f"    Travel-Website/Trip-Essentials/Visas.html:\n"
        f"    <div class=\"row\"><span class=\"cty\">🏳 {visa_country}</span>"
        f"<span class=\"cty-guides\" ...><a href=\"../Guides/{city.replace(' ', '%20')}/...\">...</a></span></div>\n"
        f"    (folder may have spaces; the link must percent-encode them — %20, never a raw space)\n"
        f"\n"
        f"    Then commit and re-run ship.\n",
        file=sys.stderr,
    )
    return 1


def _check_guide_in_tipping(guide_path: Path) -> int:
    """Ship gate: the guide's country must have an entry in Tipping-Guide.html.

    US guides pass automatically (United States is already in the page).
    Caribbean islands each have their own row (Aruba, Bahamas, etc.) — no grouping.
    Aliases handle Currency-Guide id → Tipping-Guide display name mismatches:
      United Arab Emirates → UAE
      Curacao → Curaçao (accent)
      Virgin Islands → US Virgin Islands
      Puerto Rico → Puerto Rico (US)
      Czech Republic → Czech Republic  (same, no alias needed)

    Added 2026-06-22.
    """
    import re as _re

    city = guide_path.parent.name
    essentials = WEB_ROOT / "Trip-Essentials"

    # ── 1. Determine country via Currency-Guide ──────────────────────────────
    cur_path = essentials / "Currency-Guide.html"
    if not cur_path.exists():
        print(f"  ⚠️  Tipping check skipped ({city}: Currency-Guide.html missing).")
        return 0

    cur_html = cur_path.read_text(encoding="utf-8", errors="replace")
    blocks = _re.findall(
        r'<div class="country-block"[^>]*id="([^"]+)"[^>]*>.*?<span class="cur-cities">Guides: (.*?)</span>',
        cur_html, _re.DOTALL,
    )
    country_id: str | None = None
    for cid, cities_html in blocks:
        cities_linked = _re.findall(r'>([^<]+)</a>', cities_html)
        cities_plain = [c.strip() for c in _re.sub(r'<[^>]+>', '', cities_html).split('·') if c.strip()]
        if city in set(cities_linked) | set(cities_plain):
            country_id = cid
            break

    if country_id is None:
        print(f"  ⚠️  Tipping check skipped ({city}: not found in Currency-Guide — add it first).")
        return 0

    country_display = country_id.replace("_", " ")

    # ── 2. Country-name aliases ──────────────────────────────────────────────
    TIPPING_ALIASES: dict[str, str] = {
        "United Arab Emirates": "UAE",
        "Curacao":              "Curaçao",
        "Virgin Islands":       "US Virgin Islands",
        "Puerto Rico":          "Puerto Rico (US)",
    }
    tip_country = TIPPING_ALIASES.get(country_display, country_display)

    # ── 3. Check Tipping-Guide.html ──────────────────────────────────────────
    tip_path = essentials / "Tipping-Guide.html"
    if not tip_path.exists():
        print(f"  ⚠️  Tipping check skipped ({city}: Tipping-Guide.html missing).")
        return 0

    tip_html = tip_path.read_text(encoding="utf-8", errors="replace")
    tip_countries = _re.findall(r"name:\s*'([^']+)'", tip_html)

    if tip_country in tip_countries:
        print(f"  ✅  Tipping — {country_display} entry present in Tipping-Guide.html.")
        return 0

    print(
        f"\n🚫  SHIP BLOCKED — {country_display} has no entry in Tipping-Guide.html.\n"
        f"\n"
        f"    Add a country object to the COUNTRIES array in\n"
        f"    Travel-Website/Trip-Essentials/Tipping-Guide.html:\n"
        f"    {{\n"
        f"      name: '{tip_country}', flag: '🏳',\n"
        f"      rows: [\n"
        f"        {{label: 'Restaurants', value: 'X%'}},\n"
        f"        {{label: 'Taxis', value: 'X%'}},\n"
        f"        {{label: 'Hotels', value: '$X–Y per night'}},\n"
        f"        {{label: 'Tour guides', value: '$X–Y per person'}},\n"
        f"      ],\n"
        f"      note: 'Context note here.',\n"
        f"    }}\n"
        f"\n"
        f"    Then commit and re-run ship.\n",
        file=sys.stderr,
    )
    return 1



def _check_guide_in_time_zones(guide_path: Path) -> int:
    """Ship gate: the guide city must have an entry in Time-Zones.html.

    Matches by either the `name` field (display name) or the optional `guide`
    field (folder name override used for mismatch cases like Iceland/Reykjavik).
    Matching is case-insensitive and accent/space/hyphen-normalized.

    Added 2026-06-22.
    """
    import re as _re
    import unicodedata as _ud

    def _norm(s: str) -> str:
        s = _ud.normalize("NFD", s)
        s = "".join(c for c in s if _ud.category(c) != "Mn")
        return s.lower().replace(" ", "").replace("-", "")

    city = guide_path.parent.name
    city_norm = _norm(city)

    tz_path = WEB_ROOT / "Trip-Essentials" / "Time-Zones.html"
    if not tz_path.exists():
        print(f"  ⚠️  Time-Zones check skipped ({city}: Time-Zones.html missing).")
        return 0

    tz_html = tz_path.read_text(encoding="utf-8", errors="replace")
    matched_obj: str | None = None
    for obj in _re.findall(r"\{[^}]+\}", tz_html):
        guide_m = _re.search(r"guide:'([^']+)'", obj)
        name_m  = _re.search(r"name:'([^']+)'", obj)
        if guide_m and _norm(guide_m.group(1)) == city_norm:
            matched_obj = obj
            break
        if name_m and _norm(name_m.group(1)) == city_norm:
            matched_obj = obj
            break

    if matched_obj is None:
        print(
            f"\n🚫  SHIP BLOCKED — {city} is not in Time-Zones.html.\n"
            f"    Add an entry to the CITIES array in:\n"
            f"    Travel-Website/Trip-Essentials/Time-Zones.html\n"
            f"    Format: {{name:'{city}', country:'...', tz:'...', region:'...', flag:'...'}}\n",
            file=sys.stderr,
        )
        return 1

    # Also check that the entry has a url: field linking to the guide
    if "url:'" not in matched_obj:
        # Determine the guide filename for the error message
        html_files = list(guide_path.parent.glob("*.html"))
        fname = html_files[0].name if html_files else "<guide>.html"
        folder = guide_path.parent.name
        print(
            f"\n🚫  SHIP BLOCKED — {city} is in Time-Zones.html but has no guide link.\n"
            f"    Add url:'../Guides/{folder.replace(' ', '%20')}/{fname}' to the city's CITIES entry.\n"
            f"    (folder may have spaces; the link must percent-encode them — %20, never a raw space)\n",
            file=sys.stderr,
        )
        return 1

    print(f"  ✅  Time-Zones — {city} is present with guide link.")
    return 0


def _check_guide_in_regional_stats(guide_path: Path) -> int:
    """Ship gate (non-US guides only): the guide's country must appear in every
    bar-section of its regional stats page (Europe-Stats, Asia-Stats,
    Caribbean-Stats, South-America-Stats, Stats-Across-Canada).

    Country→page mapping is built from what is ACTUALLY in each stats page
    (bar-country spans), so it stays accurate as pages grow.

    Canada page uses city-level entries (Canadian city names, not "Canada"),
    so we look for the city folder name there rather than the country name.

    US guides pass automatically (covered by _check_guide_in_us_stats).

    Added 2026-06-22.
    """
    import re as _re

    city = guide_path.parent.name
    essentials = WEB_ROOT / "Trip-Essentials"

    # ── 1. Determine country via Currency-Guide ──────────────────────────────
    cur_path = essentials / "Currency-Guide.html"
    if not cur_path.exists():
        print(f"  ⚠️  Regional-stats check skipped ({city}: Currency-Guide.html missing).")
        return 0

    cur_html = cur_path.read_text(encoding="utf-8", errors="replace")
    blocks = _re.findall(
        r'<div class="country-block"[^>]*id="([^"]+)"[^>]*>.*?<span class="cur-cities">Guides: (.*?)</span>',
        cur_html, _re.DOTALL,
    )
    country_id: str | None = None
    for cid, cities_html in blocks:
        cities_linked = _re.findall(r'>([^<]+)</a>', cities_html)
        cities_plain = [c.strip() for c in _re.sub(r'<[^>]+>', '', cities_html).split('·') if c.strip()]
        if city in set(cities_linked) | set(cities_plain):
            country_id = cid
            break

    if country_id is None:
        print(f"  ⚠️  Regional-stats check skipped ({city}: not found in Currency-Guide — add it first).")
        return 0

    if country_id == "United_States":
        print(f"  ✅  Regional-stats check — {city} is a US guide; covered by US-stats gate.")
        return 0

    # country_id is "United_States"-style underscore-encoded country name
    country_display = country_id.replace("_", " ")

    # ── 2. Map country → stats file ──────────────────────────────────────────
    # Some stats pages use abbreviations that differ from Currency-Guide country IDs.
    # Alias map: Currency-Guide country_display → name used in the stats page.
    COUNTRY_ALIASES: dict[str, str] = {
        "United Arab Emirates": "UAE",
        "Cayman Islands":       "Cayman Is.",
        "Sint Maarten":         "Sint Maarten",  # same, kept for clarity
    }

    # Built dynamically: scan each stats page for bar-country spans, build
    # country→filename mapping.  A country is assigned to the FIRST page that
    # lists it.
    STATS_PAGES = [
        "Europe-Stats.html",
        "Asia-Stats.html",
        "Caribbean-Stats.html",
        "South-America-Stats.html",
        "Stats-Across-Canada.html",
    ]

    country_to_page: dict[str, str] = {}
    page_html_cache: dict[str, str] = {}
    for page in STATS_PAGES:
        p = essentials / page
        if not p.exists():
            continue
        html = p.read_text(encoding="utf-8", errors="replace")
        page_html_cache[page] = html
        for raw in _re.findall(r'bar-country">[^<]+', html):
            name = _re.sub(r'^bar-country">', '', raw).strip()
            # strip flag emoji and leading/trailing spaces
            name_clean = _re.sub(r'^[\U00010000-\U0010ffff\U0001F300-\U0001FAFF☀-⛿✀-➿\s]+', '', name).strip()
            if name_clean and name_clean not in country_to_page:
                country_to_page[name_clean] = page

    # Resolve alias: some stats pages abbreviate country names
    stats_display = COUNTRY_ALIASES.get(country_display, country_display)

    # Special handling: Canada page stores cities, not the country name
    if country_id == "Canada":
        target_page = "Stats-Across-Canada.html"
        target_display = city  # look for the city name in Canada page
    else:
        # Try aliased name first, then full name, then case-insensitive
        target_page = country_to_page.get(stats_display) or country_to_page.get(country_display)
        if target_page is None:
            for k, v in country_to_page.items():
                if k.lower() == stats_display.lower() or k.lower() == country_display.lower():
                    target_page = v
                    break
        target_display = stats_display

    if target_page is None:
        print(
            f"\n🚫  SHIP BLOCKED — {city}: country '{country_display}' is not in any regional"
            f" stats page.\n"
            f"    Add it to the appropriate stats page before shipping.\n",
            file=sys.stderr,
        )
        return 1

    # ── 3. Check country present in every bar-section of that page ──────────
    stats_html = page_html_cache.get(target_page)
    if stats_html is None:
        p = essentials / target_page
        if not p.exists():
            print(f"  ⚠️  Regional-stats check skipped ({city}: {target_page} not found).")
            return 0
        stats_html = p.read_text(encoding="utf-8", errors="replace")

    # ── 3a. Chip check — country filter chip must exist (added 2026-07-18) ──
    # A missing chip means the country-filter button doesn't appear in the UI,
    # so visitors can't filter to that country even if bar-rows are present.
    # data-q value is lowercase hyphen-separated: "turkey", "south-korea", etc.
    chip_q = target_display.lower().replace(" ", "-")
    if f'data-q="{chip_q}"' not in stats_html:
        # Try underscore too
        chip_q_us = target_display.lower().replace(" ", "_")
        if f'data-q="{chip_q_us}"' not in stats_html:
            print(
                f"\n🚫  SHIP BLOCKED — {city}: country chip for '{target_display}' is missing"
                f" from {target_page}.\n"
                f"    Add: <button class=\"country-chip\" data-q=\"{chip_q}\">🏳 {target_display}</button>\n"
                f"    to the country-chips div in Travel-Website/Trip-Essentials/{target_page}\n",
                file=sys.stderr,
            )
            return 1

    # Split on bar-section divs; only consider sections that have bar-row entries.
    # Pages like Europe-Stats contain multiple regional sub-groups (Europe, Oceania,
    # Africa) each with their own bar-sections — a European country should only be
    # required in European sections, not Oceania/Africa sections.
    # Strategy: find which sections contain the country → derive "peer countries"
    # (countries appearing alongside ours in any present section) → only check
    # sections where peer countries appear.

    sections_raw = _re.split(r'(?=<div class="bar-section")', stats_html)
    # Build list of (title, countries_in_section) for sections that have bar-rows
    bar_sections: list[tuple[str, set[str], str]] = []  # (title, countries, raw)
    for sec in sections_raw:
        if 'class="bar-section"' not in sec:
            continue
        title_m = _re.search(r'cat-sec-name">([^<]+)', sec)
        title = title_m.group(1).strip() if title_m else "Unknown"
        countries_in = set()
        for raw in _re.findall(r'bar-country">([^<]+)', sec):
            name_clean = _re.sub(r'^[\U00010000-\U0010ffff\U0001F300-\U0001FAFF\s]+', '', raw).strip()
            if name_clean:
                countries_in.add(name_clean)
        if countries_in:  # skip non-bar-row sections (sun-table etc.)
            bar_sections.append((title, countries_in, sec))

    if not bar_sections:
        print(f"  ⚠️  Regional-stats check skipped ({city}: no bar sections found in {target_page}).")
        return 0

    def _country_in_set(name: str, country_set: set[str]) -> bool:
        """True if name matches any entry in country_set (exact or substring, case-insensitive).
        Substring matching handles Canada entries like 'Vancouver, BC' vs 'Vancouver'."""
        name_l = name.lower()
        return any(name_l == x.lower() or name_l in x.lower() or x.lower() in name_l
                   for x in country_set)

    # Find sections where the target country appears
    present_secs = [(t, c) for t, c, _ in bar_sections if _country_in_set(target_display, c)]

    if not present_secs:
        # Country appears in no section at all — missing everywhere
        missing_secs = [t for t, _, _ in bar_sections]
    else:
        # Peer countries = union of all countries found in sections where ours appears
        peer_countries: set[str] = set()
        for _, c in present_secs:
            peer_countries |= c

        # Relevant sections = sections that share a meaningful overlap with the
        # sections where our country appears. "At least one peer" is too loose —
        # a multi-region page (e.g. Europe-Stats with Africa sub-sections) can
        # have a cross-region country (e.g. Egypt) appear in both the main
        # European bars AND an Africa-only sub-section, making the sub-section
        # falsely "relevant" for a European target country.
        # Require the intersection to be at least min(3, 20% of peer_countries)
        # so that a 2-country Africa sub-section with only Egypt+Morocco does
        # not pull a European country in.
        peer_threshold = min(3, max(1, len(peer_countries) // 5))

        def _meaningful_overlap(section_countries: set) -> bool:
            return len(peer_countries & section_countries) >= peer_threshold

        relevant_secs = [(t, c, raw) for t, c, raw in bar_sections
                         if _meaningful_overlap(c)]

        # Missing = relevant sections where our country is absent
        missing_secs = [t for t, c, _ in relevant_secs
                        if not _country_in_set(target_display, c)]

    if not missing_secs:
        print(
            f"  ✅  Regional-stats — {city} ({country_display}) present in every"
            f" {target_page} section."
        )
        return 0

    print(
        f"\n🚫  SHIP BLOCKED — {city} ({country_display}) is missing from"
        f" {len(missing_secs)} {target_page} section(s):\n"
        + "".join(f"      • {s}\n" for s in missing_secs)
        + f"\n    Add '{target_display}' as a bar-row in each missing section.\n"
        f"    Page: Travel-Website/Trip-Essentials/{target_page}\n",
        file=sys.stderr,
    )
    return 1


def _guide_slug(guide_path: Path) -> str:
    """`Guides/Lisbon/lisbon_v4.html` -> `lisbon`. Guide files are always {slug}_vN.html."""
    import re as _re
    return _re.sub(r"_v\d+\.html$", "", guide_path.name)


def _check_guide_story_page(guide_path: Path) -> int:
    """Ship gate: every guide ships with its companion Read About page.

    Three invariants (spec: Brain/Reference/Read-About-Pages.html):
      1. `{slug}-read-about.html` exists beside the guide.
      2. The guide injects the READ ABOUT {CITY} link pointing at that file.
      3. The Read About page's back link names the guide's *current* filename —
         a version bump that leaves the back link on `_v3` orphans the reader.

    Added 2026-07-10.
    """
    city = guide_path.parent.name
    slug = _guide_slug(guide_path)
    story_path = guide_path.parent / f"{slug}-read-about.html"

    if not story_path.exists():
        print(
            f"\n🚫  SHIP BLOCKED — {city} has no Read About page.\n"
            f"    Every guide ships with a companion editorial page.\n"
            f"    Create: Travel-Website/Guides/{city}/{slug}-read-about.html\n"
            f"    Spec:   Brain/Reference/Read-About-Pages.html\n"
            f"    Model:  Travel-Website/Guides/Lisbon/lisbon-read-about.html\n",
            file=sys.stderr,
        )
        return 1

    guide_html = guide_path.read_text(encoding="utf-8", errors="replace")
    if f"{slug}-read-about.html" not in guide_html or "READ ABOUT" not in guide_html.upper():
        print(
            f"\n🚫  SHIP BLOCKED — {city} Read About page exists but the guide does not link to it.\n"
            f"    Inject the READ ABOUT {city.upper()} link into the Trip Overview title bar.\n"
            f"    Spec: Brain/Reference/Read-About-Pages.html § 2\n",
            file=sys.stderr,
        )
        return 1

    story_html = story_path.read_text(encoding="utf-8", errors="replace")
    if guide_path.name not in story_html:
        print(
            f"\n🚫  SHIP BLOCKED — {slug}-read-about.html does not link back to {guide_path.name}.\n"
            f"    The .story-back and .story-footer-back links must name the current guide file.\n"
            f"    (A version bump orphans a back link left on the old _vN filename.)\n",
            file=sys.stderr,
        )
        return 1

    print(f"  ✅  Read About page — {slug}-read-about.html present, linked both ways.")
    return 0


def _check_guide_stops_map(guide_path: Path) -> int:
    """Ship gate: every guide ships with its companion Stops Map page.

    Checks that {slug}-stops-map.html exists beside the guide.
    Generate with: python3 Brain/scripts/build_guide_map.py <City>

    Added 2026-07-15 (audit item 9 — stops-map is a real fleet-wide feature,
    219/219 guides already have one; gate mirrors _check_guide_story_page).
    """
    city = guide_path.parent.name
    slug = _guide_slug(guide_path)
    map_path = guide_path.parent / f"{slug}-stops-map.html"

    if not map_path.exists():
        print(
            f"\n🚫  SHIP BLOCKED — {city} has no Stops Map page.\n"
            f"    Generate it: python3 Brain/scripts/build_guide_map.py {city}\n"
            f"    Expected at: Travel-Website/Guides/{city}/{slug}-stops-map.html\n",
            file=sys.stderr,
        )
        return 1

    print(f"  ✅  Stops Map — {slug}-stops-map.html present.")
    return 0


def _check_guide_in_day_trips(guide_path: Path) -> int:
    """Ship gate: if the guide's day-trips-by-train section has real entries, the
    guide's folder must have a matching entry in Day-Trips.html DATA.

    Negative findings ("No day trips from [City].") do NOT require a DATA entry.
    Guides with no day-trips-by-train section at all are skipped.

    Added 2026-07-23.
    """
    import re as _re, json as _json

    city = guide_path.parent.name
    html = guide_path.read_text(encoding="utf-8", errors="replace")

    # Locate the day-trips-by-train section
    _dt_pat = _re.compile(
        r'id="day-trips-by-train"(.*?)'
        r'(?=<div\s[^>]*class="extras-section"|<div\s+id="also-on-this-site"|<!--\s*also-on-this-site)',
        _re.DOTALL,
    )
    m = _dt_pat.search(html)
    if not m:
        print(f"  ⚠️   Day-Trips sync — no day-trips-by-train section found in {city} guide. "
              f"Section is required on all guides.")
        return 0  # advisory only — validate_itinerary catches missing sections

    section = m.group(1)

    # Guide explicitly has no day trips — no DATA entry required
    if "No day trips from" in section or 'class="extras-empty"' in section:
        print(f"  ✅  Day-Trips sync — {city} has no day trips (negative finding, no DATA entry needed).")
        return 0

    # Guide has real entries — folder must appear in Day-Trips.html DATA
    if 'class="extras-sub"' not in section:
        print(f"  ⚠️   Day-Trips sync — {city} day-trips section appears empty (neither entries nor negative finding).")
        return 0  # let validate_itinerary flag this as a content gap

    dt_path = WEB_ROOT / "Trip-Essentials" / "Day-Trips.html"
    if not dt_path.exists():
        print(f"\n🚫  SHIP BLOCKED — Day-Trips.html not found at {dt_path}\n", file=sys.stderr)
        return 1

    dt_html = dt_path.read_text(encoding="utf-8", errors="replace")
    jm = _re.search(r"const DATA = (\[.*?\]);", dt_html, _re.DOTALL)
    if not jm:
        print("\n🚫  SHIP BLOCKED — could not parse DATA array in Day-Trips.html\n", file=sys.stderr)
        return 1

    try:
        dt_folders = {e["folder"] for e in _json.loads(jm.group(1))}
    except (_json.JSONDecodeError, KeyError) as e:
        print(f"\n🚫  SHIP BLOCKED — Day-Trips.html DATA parse error: {e}\n", file=sys.stderr)
        return 1

    if city not in dt_folders:
        print(
            f"\n🚫  SHIP BLOCKED — {city} has day-trips entries but is missing from "
            f"Day-Trips.html DATA.\n"
            f"    Add a DATA entry for {city} to Travel-Website/Trip-Essentials/Day-Trips.html.\n",
            file=sys.stderr,
        )
        return 1

    print(f"  ✅  Day-Trips sync — {city} found in Day-Trips.html DATA.")
    return 0


def _check_guide_has_shipped_attr(guide_path: Path) -> int:
    """Ship gate: the dest-card for the shipping guide must carry data-shipped="YYYY-MM-DD".

    The attribute is auto-set by _build_card_html() in guide_surfaces.py when a new
    card is first inserted (uses today's date). This gate verifies the attribute is
    actually present — catching any card that was hand-written before the auto-set
    was wired (2026-07-19) or otherwise added without the attribute.

    The 'new' badge JS in Guides-Index.html reads this attribute to decide whether
    to show the amber 'new' badge for 14 days post-ship. A card without the attribute
    never shows the badge.

    Added 2026-07-19.
    """
    import re as _re
    city_folder = guide_path.parent.name
    index_file = WEB_ROOT / "Guides-Index.html"
    if not index_file.exists():
        print(
            "\n🚫  SHIP BLOCKED — Guides-Index.html missing (data-shipped check).\n",
            file=sys.stderr,
        )
        return 1

    html = index_file.read_text(encoding="utf-8", errors="replace")

    # Find the dest-card for this city folder
    card_pat = _re.compile(
        r'<a\b[^>]*class\s*=\s*"[^"]*dest-card[^"]*"[^>]*href\s*=\s*"[^"]*/Guides/'
        + _re.escape(city_folder) + r'/[^"]*"[^>]*>',
        _re.IGNORECASE,
    )
    m = card_pat.search(html)
    if not m:
        # Card missing entirely — _check_guide_indexed already caught this
        print(
            f"\n🚫  SHIP BLOCKED — no dest-card found for {city_folder} "
            f"(run update-index first).\n",
            file=sys.stderr,
        )
        return 1

    card_tag = m.group(0)
    date_m = _re.search(r'data-shipped\s*=\s*"(\d{4}-\d{2}-\d{2})"', card_tag)
    if not date_m:
        print(
            f"\n🚫  SHIP BLOCKED — {city_folder} dest-card is missing data-shipped.\n"
            f"    The 'new' badge will never show for this guide.\n"
            f"    Add data-shipped=\"{_dt.date.today().isoformat()}\" to the card's <a> tag\n"
            f"    (new cards via guide_surfaces.py get this automatically).\n",
            file=sys.stderr,
        )
        return 1

    print(f"  ✅  data-shipped — {city_folder} card has data-shipped=\"{date_m.group(1)}\".")
    return 0


def _write_ship_log(
    guide_path: Path,
    result: str,
    check_count: int = 0,
    step: str = "",
    passed: int = 0,
    failed: int = 0,
) -> None:
    """Append a timestamped PASS/FAIL line to the guide's own ship_log.md (Rule 125).

    The log lives at {guide_folder}/ship_log.md — one file per guide, never recreated.
    If the file doesn't exist yet (first ship of a new guide) it is created with a
    one-time header. Every subsequent ship APPENDS — never overwrites.

    Format: YYYY-MM-DD HH:MM — {guide.html} — PASS|FAIL — {N} checks
            YYYY-MM-DD HH:MM — {guide.html} — FAIL @ {step} — N/total passed, M failed
            YYYY-MM-DD HH:MM — {guide.html} — PASS — N/total passed, 0 failed

    When passed/failed are provided (non-zero total), the richer "N/total passed, M failed"
    format is used instead of the legacy "{check_count} checks". Added 2026-07-20.
    """
    log_path = guide_path.parent / "ship_log.md"
    now = _dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    result_str = f"FAIL @ {step}" if (result == "FAIL" and step) else result
    total = passed + failed
    if total > 0:
        count_str = f"{passed}/{total} passed, {failed} failed"
    else:
        count_str = f"{check_count} checks"
    entry = f"{now} — {guide_path.name} — {result_str} — {count_str}\n"
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


def _renumber_guide_cards() -> None:
    """Rewrite every guide dest-card's data-guide-num to its sequential position (1-N).

    Reads Guides-Index.html, finds all <a class="dest-card"> tags that are actual
    guide cards (identified by having a data-status attribute — Best-of category
    cards carry data-special="1" and are skipped), and replaces each data-guide-num
    value with the card's 1-indexed position in document order. Fixes duplicates,
    typos (e.g. 265 instead of 66), and missing values. Best-effort: prints a
    summary line and silently returns on any parse/write error.
    """
    import re as _re

    guides_index = WEB_ROOT / "Guides-Index.html"
    if not guides_index.exists():
        return

    html = guides_index.read_text(encoding="utf-8")

    # Find all dest-card opening tags (the <a ...> only, not the content inside)
    card_tag_re = _re.compile(
        r'(<a\b[^>]*class\s*=\s*"[^"]*dest-card[^"]*"[^>]*>)',
        _re.IGNORECASE | _re.DOTALL,
    )

    # Build the replacement string piece by piece
    result = []
    prev_end = 0
    changed = 0
    guide_seq = 0  # sequential counter for guide cards only

    for m in card_tag_re.finditer(html):
        tag = m.group(1)

        # Skip Best-of / non-guide cards (they carry data-special="1" and lack data-status)
        is_guide_card = 'data-status' in tag
        if not is_guide_card:
            result.append(html[prev_end:m.end()])
            prev_end = m.end()
            continue

        guide_seq += 1
        new_tag = _re.sub(r'data-guide-num\s*=\s*"[0-9]+"', f'data-guide-num="{guide_seq}"', tag)
        if new_tag == tag:
            if 'data-guide-num' not in tag:
                new_tag = tag.replace('<a ', f'<a data-guide-num="{guide_seq}" ', 1)
                changed += 1
        else:
            changed += 1

        result.append(html[prev_end:m.start()])
        result.append(new_tag)
        prev_end = m.end()

    result.append(html[prev_end:])

    if changed == 0:
        print(f"  ✅  data-guide-num already correct across all {guide_seq} guide cards.")
        return

    new_html = "".join(result)
    try:
        import crib_safety as _cs
        _cs.atomic_write(guides_index, new_html)
        print(f"  ✅  Renumbered {changed}/{guide_seq} guide dest-cards with correct sequential data-guide-num.")
    except Exception as _e:
        guides_index.write_text(new_html, encoding="utf-8")
        print(f"  ✅  Renumbered {changed}/{guide_seq} guide dest-cards (direct write — crib_safety unavailable: {_e}).")


def _run_update_index(city: str) -> int:
    """15-step ship-tail checklist for a newly built guide.

    Verifies each of the post-build steps defined in
    Brain/Reference/Navigation.html § 5 and Ship Checklist.html:

      1. Guides-Index.html card
      2. Predecessor/successor data-guide-prev/next wiring in Guides-Index.html
      3. Banner counts (guides + countries) in Guides-Index.html
      4. Guide HTML toolbar-mount data-prev / data-next
      5. Map pin in the matching continent map
      6–15. Cross-surface coverage (also-on-site, US stats, regional stats,
             time zones, Delta routes, transit cards, Visas, Tipping, Read About,
             Stops Map)

    Exits 0 if all steps pass; non-zero listing the failures.
    Added 2026-06-11 — Proposal C.
    """
    import re as _re

    fails: list[str] = []
    guide_path = _find_guide_html(city)

    print(f"\n── UPDATE-INDEX checklist for: {city} ──\n")

    # ── Step 1: Guides-Index.html card ─────────────────────────────────────────
    print("Step 1 — Guides-Index.html card")
    if guide_path is None:
        print(
            f"  ⚠  No guide HTML found in Guides/{city}/ — cannot verify steps 1–4.\n"
            f"     Create the guide file first.\n",
            file=sys.stderr,
        )
        return 1
    rc1 = _check_guide_indexed(guide_path)
    if rc1 != 0:
        fails.append("Step 1: Guides-Index.html card missing")
    else:
        print()

    # ── Step 2: prev/next wiring in Guides-Index.html ─────────────────────────
    print("Step 2 — prev/next wiring in Guides-Index.html")
    guides_index = WEB_ROOT / "Guides-Index.html"
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
                # data-guide-prev/next became "./Guides/City/file.html" after the
                # 2026-07 index move (were "./City/file.html"); drop a leading
                # "Guides/" so the folder is the city, not the literal "Guides".
                _pp = prev_href.strip("./").split("/")
                prev_folder = _pp[1] if len(_pp) > 1 and _pp[0] == "Guides" else _pp[0]
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
                _np = next_href.strip("./").split("/")
                next_folder = _np[1] if len(_np) > 1 and _np[0] == "Guides" else _np[0]
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
        print("  🚫  Guides-Index.html not found.", file=sys.stderr)
        fails.append("Step 2: Guides-Index.html missing")
    print()

    # ── Step 3: banner counts ──────────────────────────────────────────────────
    print("Step 3 — banner counts in Guides-Index.html")
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
                    f"Update the banner text in Guides-Index.html."
                )
                print(f"  🚫  {msg}", file=sys.stderr)
                fails.append(f"Step 3: {msg}")
        else:
            print("  ⚠  Could not parse banner count from Guides-Index.html — verify manually.")
    else:
        print("  ⏭  Guides-Index.html not found — skipping.")
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

    # ── Step 6: also-on-this-site universal links ─────────────────────────────────
    print("Step 6 — also-on-this-site universal links")
    rc6 = _check_guide_also_on_this_site(guide_path)
    if rc6 != 0:
        fails.append("Step 6: also-on-this-site block missing or incomplete")
    print()

    # ── Step 7: US guides — Stats-Across-US coverage ───────────────────────────
    print("Step 7 — Stats-Across-US coverage (US guides only)")
    rc7 = _check_guide_in_us_stats(guide_path)
    if rc7 != 0:
        fails.append("Step 7: city missing from one or more Stats-Across-US categories")
    print()

    # ── Step 8: Non-US guides — regional stats page coverage ────────────────
    print("Step 8 — Regional stats page coverage (non-US guides only)")
    rc8 = _check_guide_in_regional_stats(guide_path)
    if rc8 != 0:
        fails.append("Step 8: country missing from one or more regional stats sections")
    print()

    # ── Step 9: Time-Zones.html coverage ─────────────────────────────────────
    print("Step 9 — Time-Zones.html coverage")
    rc9 = _check_guide_in_time_zones(guide_path)
    if rc9 != 0:
        fails.append("Step 9: city missing from Time-Zones.html")
    print()

    # ── Step 10: Delta-Routes-SEA.html card ───────────────────────────────────
    print("Step 10 — Delta-Routes-SEA.html card")
    rc10 = _check_guide_in_delta_routes(guide_path)
    if rc10 != 0:
        fails.append("Step 10: no Delta routing card in Delta-Routes-SEA.html")
    print()

    # ── Step 11: City-Transit-Cards.html card or explicit exempt ──────────────
    print("Step 11 — City-Transit-Cards.html coverage")
    rc11 = _check_guide_in_transit_cards(guide_path)
    if rc11 != 0:
        fails.append("Step 11: city missing from City-Transit-Cards.html and not in NO_TRANSIT_CARD list")
    print()

    # ── Step 12: Visas.html country row ───────────────────────────────────────
    print("Step 12 — Visas.html country coverage")
    rc12 = _check_guide_in_visas(guide_path)
    if rc12 != 0:
        fails.append("Step 12: country missing from Visas.html")
    print()

    # ── Step 13: Tipping-Guide.html country entry ──────────────────────────────
    print("Step 13 — Tipping-Guide.html country coverage")
    rc13 = _check_guide_in_tipping(guide_path)
    if rc13 != 0:
        fails.append("Step 13: country missing from Tipping-Guide.html")
    print()

    # ── Step 14: Read About page ────────────────────────────────────────
    print("Step 14 — Read About page")
    rc14 = _check_guide_story_page(guide_path)
    if rc14 != 0:
        fails.append("Step 14: {slug}-read-about.html missing, or not linked both ways")
    print()

    # ── Step 15: Stops Map companion ───────────────────────────────────────────
    print("Step 15 — Stops Map companion page")
    rc15 = _check_guide_stops_map(guide_path)
    if rc15 != 0:
        fails.append("Step 15: {slug}-stops-map.html missing — run build_guide_map.py <City>")
    print()

    # ── Step 16: Day-Trips.html sync ──────────────────────────────────────────
    print("Step 16 — Day-Trips.html DATA sync")
    rc16 = _check_guide_in_day_trips(guide_path)
    if rc16 != 0:
        fails.append("Step 16: guide has day-trips entries but is missing from Day-Trips.html DATA")
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
    print(f"✅  UPDATE-INDEX — all 16 steps complete for {city}.")
    print(f"    Guide is ready to ship.\n")

    # ── Sync the two Brain-side status trackers from the index ──────────────────
    # Both are GENERATED from Guides-Index.html's data-status — the single source
    # of truth — so a newly-shipped guide (always data-status="want") lands in both
    # as want automatically and neither can drift. Best-effort: never blocks ship.
    print("Syncing status trackers (Travel-Tracker.html + Status Dots)…")
    for _script, _fn in (("sync_tracker.py", "sync"), ("build_status_dots.py", "build")):
        try:
            import importlib.util as _ilu
            _spec = _ilu.spec_from_file_location(_script[:-3], BRAIN_DIR / "scripts" / _script)
            _mod  = _ilu.module_from_spec(_spec)
            _spec.loader.exec_module(_mod)
            getattr(_mod, _fn)()
        except Exception as _e:
            print(f"  ⚠  {_script} failed: {_e}", file=sys.stderr)

    # ── Renumber all dest-cards with correct sequential data-guide-num ───────────
    # Runs after every ship — corrects duplicates, typos, and any wrong values
    # that slipped through without a gate (the ship gate only checks presence,
    # not correctness). Best-effort: never blocks ship.
    print("Renumbering dest-card data-guide-num values…")
    try:
        _renumber_guide_cards()
    except Exception as _e:
        print(f"  ⚠  _renumber_guide_cards failed: {_e}", file=sys.stderr)

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
    # Atomic write (crib_safety): a concurrent reader — pre_push_guard, the
    # staleness dashboard export, a parallel crib — never observes a half-written
    # ledger. Same pattern the publisher/builders use for shared-surface files.
    import crib_safety as _cs
    _cs.atomic_write(LEDGER_F, json.dumps(data, indent=2, sort_keys=True) + "\n")


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
    today = _dt.date.today().isoformat()
    ledger[city] = {
        "fingerprint": fv.get("fingerprint", ""),
        "format_date": fv.get("date", ""),
        "guide": guide_path.name,
        "shipped": today,
        # A full ship implies a clean validate ran in the gate chain, so the
        # guide is validated-as-of-today too. `revalidate` refreshes this field
        # alone (without touching fingerprint) on a bare re-validation.
        "last_validated": today,
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


def _run_surface_check(city: str) -> int:
    """Pre-research dry-run: report which ship-gate surfaces still need manual data.

    Checks every surface that requires manual research or configuration during
    the build — things a crib cannot auto-generate and that would cause a hard
    FAIL at ship time if missing. Run at the end of Phase 2 (after stop research
    begins) so data can be gathered naturally during the build instead of
    encountering blocked-ship errors after the guide is written.

    Does NOT modify any file. Advisory only.
    Exit 0 = all surfaces satisfied. Exit 1 = action needed.

    Added 2026-07-18 (Recommendation 4 — surface ship-gate data requirements early).
    Usage: python3 guide_tools.py surface-check <City>
    """
    import unicodedata as _ud

    print(f"\n━━━  surface-check — {city}  ━━━")
    print("Pre-research gate: which surfaces need manual data before this city can ship?\n")

    guide_folder = WEB_ROOT / "Guides" / city
    guide_html_files = sorted(guide_folder.glob("*.html")) if guide_folder.exists() else []
    guide_html = guide_html_files[-1] if guide_html_files else None  # latest version

    ok: list[str] = []
    needs_action: list[str] = []

    def _norm(s: str) -> str:
        s = _ud.normalize("NFD", s)
        s = "".join(c for c in s if _ud.category(c) != "Mn")
        return s.lower().replace(" ", "").replace("-", "").replace("_", "")

    city_norm = _norm(city)

    # ── 1. Safety level ───────────────────────────────────────────────────────
    safety_json = HERE / "safety_levels.json"
    if safety_json.exists():
        try:
            safety_data = json.loads(safety_json.read_text(encoding="utf-8"))
            if city in safety_data:
                level = safety_data[city].get("level", "?")
                ok.append(f"Safety level: {level} (safety_levels.json)")
            else:
                needs_action.append(
                    f"SAFETY LEVEL — add '{city}' to Brain/scripts/safety_levels.json "
                    f"(fields: level L1–L4, file, data_city, display, country, verified)"
                )
        except Exception as _e:  # noqa: BLE001
            needs_action.append(f"SAFETY LEVEL — could not read safety_levels.json ({_e})")
    else:
        needs_action.append("SAFETY LEVEL — Brain/scripts/safety_levels.json not found")

    # ── 2. Map pin ─────────────────────────────────────────────────────────────
    world_map = WEB_ROOT / "Trip-Essentials" / "Maps" / "World-Map.html"
    if world_map.exists():
        wm_text = world_map.read_text(encoding="utf-8", errors="replace")
        if f"'{city}'" in wm_text or f'"{city}"' in wm_text:
            ok.append("Map pin (World-Map.html)")
        else:
            needs_action.append(
                f"MAP PIN — add ['{city}', lon, lat, '../../Guides/{city}/file.html'] "
                f"to Travel-Website/Trip-Essentials/Maps/World-Map.html"
            )
    else:
        needs_action.append("MAP PIN — World-Map.html not found")

    # ── 3. Time Zones entry ───────────────────────────────────────────────────
    tz_path = WEB_ROOT / "Trip-Essentials" / "Time-Zones.html"
    if tz_path.exists():
        tz_text = tz_path.read_text(encoding="utf-8", errors="replace")
        tz_names = re.findall(r"(?:name|guide):'([^']+)'", tz_text)
        if any(_norm(n) == city_norm for n in tz_names):
            ok.append("Time Zones entry (Time-Zones.html)")
        else:
            needs_action.append(
                f"TIME ZONES — add CITIES entry for {city} to "
                f"Travel-Website/Trip-Essentials/Time-Zones.html "
                f"(name, tz, utc, url; add guide:'{city}' if folder ≠ display name)"
            )
    else:
        needs_action.append("TIME ZONES — Time-Zones.html not found")

    # ── 4. Delta Routes SEA routing card ─────────────────────────────────────
    delta_path = WEB_ROOT / "Trip-Essentials" / "Delta-Routes-SEA.html"
    if city == "Seattle":
        ok.append("Delta Routes — Seattle is the home city (exempt)")
    elif delta_path.exists():
        if f'data-guide="{city}"' in delta_path.read_text(encoding="utf-8", errors="replace"):
            ok.append("Delta Routes SEA routing card")
        else:
            needs_action.append(
                f"DELTA ROUTES — research SEA→{city} routing on Google Flights / delta.com "
                f"and add a card with data-guide=\"{city}\" to Delta-Routes-SEA.html"
            )
    else:
        needs_action.append("DELTA ROUTES — Delta-Routes-SEA.html not found")

    # ── 5. Climate data ───────────────────────────────────────────────────────
    climate_json = ASSETS_DIR / "climate.json"
    if climate_json.exists():
        try:
            climate_data = json.loads(climate_json.read_text(encoding="utf-8"))
            if any(_norm(k) == city_norm for k in climate_data if k != "_meta"):
                ok.append("Climate data (climate.json + weather.js)")
            else:
                needs_action.append(
                    "CLIMATE DATA — run: python3 Brain/scripts/build_climate.py "
                    "(after map pin is added; pre-seed /tmp/climate_raw.json to limit to new cities)"
                )
        except Exception as _e:  # noqa: BLE001
            needs_action.append(f"CLIMATE DATA — could not read climate.json ({_e})")
    else:
        needs_action.append("CLIMATE DATA — assets/climate.json not found")

    # ── 6. Transit card comment ───────────────────────────────────────────────
    if guide_html:
        html_text = guide_html.read_text(encoding="utf-8", errors="replace")
        m_tc = re.search(r'<!--\s*transit-card:\s*(.+?)\s*-->', html_text)
        if m_tc:
            ok.append(f"Transit card comment: {m_tc.group(1).strip()}")
        else:
            needs_action.append(
                f"TRANSIT CARD — research '{city} transit card'; add comment to guide HTML. "
                f"If no card exists: python3 guide_tools.py no-transit-card {city}"
            )
    else:
        needs_action.append(
            f"TRANSIT CARD — research '{city} transit card' during build. "
            f"No card: python3 guide_tools.py no-transit-card {city}"
        )

    # ── 7. Guides-Index card + inline data ────────────────────────────────────
    index_file = WEB_ROOT / "Guides-Index.html"
    if index_file.exists():
        idx_text = index_file.read_text(encoding="utf-8", errors="replace")
        card_present = (
            f'href="./Guides/{city}/' in idx_text
            or f"href='./Guides/{city}/" in idx_text
        )
        if card_present:
            ok.append("Guides-Index.html card")
            missing_inline: list[str] = []
            for var in ("CLIMATE_INLINE", "COST_DATA", "SAFETY_DATA"):
                m_var = re.search(
                    rf"var {var}\s*=\s*(\{{.*?\}})\s*;", idx_text, re.DOTALL
                )
                if m_var:
                    try:
                        var_data = json.loads(m_var.group(1))
                    except Exception:  # noqa: BLE001
                        var_data = {}
                    if not any(_norm(k) == city_norm for k in var_data):
                        missing_inline.append(var)
                else:
                    missing_inline.append(f"{var} (block not found)")
            if missing_inline:
                needs_action.append(
                    f"INDEX INLINE DATA — card exists but missing: {', '.join(missing_inline)}"
                )
            else:
                ok.append("Index inline data (CLIMATE_INLINE, COST_DATA, SAFETY_DATA)")
        else:
            needs_action.append(
                f"GUIDES-INDEX CARD — dest-card for {city} not yet in Guides-Index.html "
                f"(added automatically by guide_tools.py update-index on ship)"
            )
    else:
        needs_action.append("GUIDES-INDEX — Guides-Index.html not found")

    # ── 8. Read About page ────────────────────────────────────────────────────
    if guide_html:
        slug = re.sub(r"_v\d+\.html$", "", guide_html.name)
        read_about = guide_folder / f"{slug}-read-about.html"
        if read_about.exists():
            ok.append(f"Read About page ({read_about.name})")
        else:
            needs_action.append(
                f"READ ABOUT PAGE — build {slug}-read-about.html in Phase 5 "
                f"(mandatory; guide cannot ship without it)"
            )
    else:
        needs_action.append(
            "READ ABOUT PAGE — build {slug}-read-about.html in Phase 5 "
            "(mandatory; guide cannot ship without it)"
        )

    # ── Print results ──────────────────────────────────────────────────────────
    if ok:
        print("✅  Already satisfied:")
        for item in ok:
            print(f"    • {item}")
        print()

    if needs_action:
        print("📋  Action needed before ship:")
        for item in needs_action:
            print(f"    • {item}")
        print(f"\n{len(needs_action)} item(s) need attention before {city} can ship.")
        return 1

    print("✅  All surface checks satisfied — ready to ship once the guide passes validation.")
    return 0


def _run_revalidate(city: str) -> int:
    """Re-run `validate` on an already-shipped guide and, on 0 failures, stamp
    `last_validated = today` into its staleness-ledger entry.

    Deliberately does NOT touch `fingerprint` / `format_date`. validate_itinerary.py
    enforces only a SUBSET of the CORE-RULES format, so a clean validate does not
    prove full current-format conformance — only a real `ship` legitimately sets the
    fingerprint to current. This records *when the guide last passed validation*,
    which is what fixes the "I fixed + revalidated a guide but it still shows stale"
    trap, without ever claiming format currency it can't prove.

    Note: the ledger write happens HERE, not inside validate_itinerary.py, which
    stays strictly read-only (pre_push_guard runs it on every push and must not
    incur side effects).
    """
    # Resolve the city folder (accept spaced or hyphenated input).
    folder = GUIDES_DIR / city
    if not folder.is_dir():
        alt = GUIDES_DIR / city.replace(" ", "-")
        if alt.is_dir():
            folder = alt
    if not folder.is_dir():
        print(f"❌ No guide folder for {city!r} under {GUIDES_DIR}", file=sys.stderr)
        return 2

    ledger = _load_ledger()
    entry = ledger.get(folder.name)

    # Validate the guide file the ledger already records; else newest on disk.
    guide = None
    if entry and entry.get("guide"):
        cand = folder / entry["guide"]
        if cand.exists():
            guide = cand
    if guide is None:
        guide = _latest_guide_html(folder)
    if guide is None:
        print(f"❌ No guide HTML found in {folder}", file=sys.stderr)
        return 2

    # Read-only static validation (no ledger side effects in the validator itself).
    rc = _run(SUBCOMMANDS["validate"], [str(guide)])
    if rc != 0:
        print(f"  🗂  revalidate: {folder.name} FAILED validation (rc={rc}) — "
              f"last_validated NOT updated.", file=sys.stderr)
        return rc

    if entry is None:
        print(f"  ⚠  revalidate: {folder.name} passed validation but is not enrolled "
              f"in the staleness ledger — run `ship` or `staleness --backfill` first; "
              f"last_validated not recorded (won't invent a fingerprint).")
        return 0

    today = _dt.date.today().isoformat()
    entry["last_validated"] = today
    ledger[folder.name] = entry
    _save_ledger(ledger)  # atomic (crib_safety)
    print(f"  🗂  revalidate: {folder.name} passed — last_validated = {today} "
          f"(fingerprint unchanged @ {str(entry.get('fingerprint','?'))[:8]}; "
          f"a bare validate can't prove current-format, only ship can).")
    return 0


def _run_fix(city: str) -> int:
    """Validate-only shortcut that compresses the FAIL loop during a guide fix.

    Runs validate_itinerary.py on the city's guide without the full ship chain
    (no verify, no verify-booking, no index/pin/climate/safety/stats).  On
    success the signed stamp is written and a PASS entry is logged to ship_log.
    On failure the FAIL counts are logged so the history shows progress.

    Use case: you fixed a validation error and want to confirm it before
    committing to the full `ship` pipeline.  Exit 0 = validator clean.
    """
    # Resolve city folder.
    folder = GUIDES_DIR / city
    if not folder.is_dir():
        alt = GUIDES_DIR / city.replace(" ", "-")
        if alt.is_dir():
            folder = alt
    if not folder.is_dir():
        print(f"❌ No guide folder for {city!r} under {GUIDES_DIR}", file=sys.stderr)
        return 2

    guide = _latest_guide_html(folder)
    if guide is None:
        print(f"❌ No guide HTML found in {folder}", file=sys.stderr)
        return 2

    print(f"  🔧 fix: running validate on {guide.name} …")
    rc, passed, failed = _run_validate_capturing(str(guide))

    if rc == 0:
        _write_ship_log(guide, "PASS", passed=passed, failed=failed)
        print(f"  ✅ fix: {folder.name} validator clean ({passed} checks) — "
              f"run `ship` to complete the pipeline.")
    else:
        _write_ship_log(guide, "FAIL", passed=passed, failed=failed)
        print(f"  ❌ fix: {folder.name} validator FAILED "
              f"({failed} failures, {passed} passed).")
    return rc


def _run_stub(city: str, days: int = 3, country: str = "") -> int:
    """Generate a pre-scaffolded guide HTML skeleton for a new city.

    Creates Travel-Website/Guides/{city}/{slug}_v1.html with the complete
    section order, all required CSS classes, correct JS placement, and
    [FILL: ...] placeholder tokens. The crib replaces placeholders with
    researched content — it never constructs HTML structure from scratch.

    Structural elements generated:
      - transit-card comment (line 1, before DOCTYPE)
      - container div + toolbar-mount + toolbar.js (top of body, before title)
      - Title page (hotel banner) with correct class names
      - Trip Overview: "TRIP OVERVIEW" title, Read About script, all extras pills
      - N day blocks × 4 placeholder stops (ticket-box / tour-box alternated)
      - All extra sections in spec order; Pickleball US-only
      - Heads Up + Skip List as commented-out conditional blocks
      - Claude Inspiration placeholder with correct class
      - also-on-this-site pills: Stats auto-detected from --country;
        EU Train Guide pill EU-only
      - nearby-guides comment (injected at ship, never written manually)

    Usage: guide_tools.py stub <City> [--days N] [--country Country]
    N defaults to 3.

    Rewritten 2026-07-21: previous version had wrong structure (toolbar at
    bottom, missing container div, wrong stop-block HTML, no transit-card
    comment, missing Stats pill, wrong overview-title, no Read About script,
    fake negative-finding lines that blocked the validator).
    """
    import unicodedata as _ud2
    import re as _re2

    def _slugify(s: str) -> str:
        s = _ud2.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
        return s.lower().replace(" ", "-").replace("'", "")

    slug = _slugify(city)
    guide_dir = WEB_ROOT / "Guides" / city
    out_file = guide_dir / f"{slug}_v1.html"

    if out_file.exists():
        print(f"❌  Stub already exists: {out_file}", file=sys.stderr)
        print("    Delete the existing file first if you want a fresh scaffold.",
              file=sys.stderr)
        return 1

    # Warn (non-blocking) if build_state.md missing or Phase 0-2 reads not done
    tracker_path = guide_dir / "_build" / "build_state.md"
    if not tracker_path.exists():
        print(
            f"⚠️  No build_state.md for {city!r} — run init first:\n"
            f"   python3 guide_tools.py init {city}\n"
            f"   Generating scaffold anyway so you can inspect the structure.\n"
        )
    else:
        _tc = tracker_path.read_text(encoding="utf-8")
        _early = {"## Phase 0", "## Phase 1", "## Phase 2"}
        _late  = {"## Phase 3", "## Phase 4", "## Phase 5", "## Phase 6"}
        _in_e = False
        _unc: list[str] = []
        for _ln in _tc.splitlines():
            _ls = _ln.strip()
            if any(_ls.startswith(p) for p in _early): _in_e = True
            elif any(_ls.startswith(p) for p in _late): _in_e = False
            if _in_e and _ls.startswith("- [ ]"): _unc.append(_ls[5:].strip())
        if _unc:
            print(
                f"⚠️  {len(_unc)} Phase 0-2 read(s) not yet checked off in build_state.md.\n"
                f"   Run preflight before writing real content:\n"
                f"   python3 guide_tools.py preflight {city}\n"
            )

    # Version detection — scan up to 50 shipped guides; fall back to known-good values
    css_version = 29
    tb_version = 100
    try:
        for _p in list((WEB_ROOT / "Guides").rglob("*_v*.html"))[:50]:
            _txt = _p.read_text(errors="ignore")
            _m = _re2.search(r'guide-style\.css\?v=(\d+)', _txt)
            if _m: css_version = max(css_version, int(_m.group(1)))
            _m = _re2.search(r'toolbar\.js\?v=(\d+)', _txt)
            if _m: tb_version = max(tb_version, int(_m.group(1)))
    except Exception:
        pass

    # Region detection from --country for Stats pill and EU Train pill
    _cl = country.lower()
    EU_SET = {
        "austria", "belgium", "croatia", "czechia", "czech republic", "denmark",
        "estonia", "finland", "france", "germany", "greece", "hungary", "iceland",
        "ireland", "italy", "latvia", "lithuania", "luxembourg", "malta", "netherlands",
        "norway", "poland", "portugal", "romania", "slovakia", "slovenia", "spain",
        "sweden", "switzerland", "albania", "andorra", "bosnia", "bulgaria", "cyprus",
        "georgia", "kosovo", "liechtenstein", "moldova", "monaco", "montenegro",
        "north macedonia", "san marino", "serbia", "turkey", "united kingdom",
        "vatican", "scotland", "wales", "england",
    }
    is_eu  = any(c in _cl for c in EU_SET)
    is_us  = any(c in _cl for c in ("united states", "usa"))
    is_can = "canada" in _cl
    is_car = any(c in _cl for c in (
        "bahamas", "cuba", "jamaica", "barbados", "aruba", "antigua", "grenada",
        "saint lucia", "saint kitts", "trinidad", "cayman", "virgin islands",
        "turks and caicos", "dominican republic", "haiti", "puerto rico",
        "curaçao", "curacao", "saint martin", "sint maarten",
        "saint barthelemy", "montserrat", "anguilla", "guadeloupe",
        "martinique", "dominica", "saint vincent", "bonaire",
    ))
    is_sa  = any(c in _cl for c in (
        "brazil", "argentina", "chile", "colombia", "peru", "ecuador",
        "bolivia", "uruguay", "paraguay", "venezuela", "guyana",
        "suriname", "french guiana",
    ))
    is_asia = any(c in _cl for c in (
        "japan", "china", "south korea", "korea", "thailand", "vietnam",
        "cambodia", "indonesia", "philippines", "malaysia", "singapore",
        "india", "sri lanka", "nepal", "bhutan", "bangladesh", "myanmar",
        "laos", "taiwan", "hong kong", "macau", "mongolia", "kazakhstan",
        "uzbekistan", "kyrgyzstan", "tajikistan", "turkmenistan", "azerbaijan",
        "armenia", "afghanistan", "pakistan", "uae", "united arab emirates",
        "saudi arabia", "qatar", "kuwait", "bahrain", "oman", "jordan",
        "lebanon", "israel", "palestine", "iraq", "iran", "maldives",
    ))

    if is_eu:
        stats_href  = "../../Trip-Essentials/Europe-Stats.html"
        stats_label = "\U0001f4ca Stats Across Europe"
    elif is_us:
        stats_href  = "../../Trip-Essentials/Stats-Across-US.html"
        stats_label = "\U0001f4ca Stats Across US"
    elif is_can:
        stats_href  = "../../Trip-Essentials/Stats-Across-Canada.html"
        stats_label = "\U0001f4ca Stats Across Canada"
    elif is_car:
        stats_href  = "../../Trip-Essentials/Caribbean-Stats.html"
        stats_label = "\U0001f4ca Stats Across the Caribbean"
    elif is_sa:
        stats_href  = "../../Trip-Essentials/South-America-Stats.html"
        stats_label = "\U0001f4ca Stats Across South America"
    elif is_asia:
        stats_href  = "../../Trip-Essentials/Asia-Stats.html"
        stats_label = "\U0001f4ca Stats Across Asia"
    else:
        stats_href  = "../../Trip-Essentials/[FILL-Stats-Page].html"
        stats_label = "\U0001f4ca Stats Across [FILL-REGION]"

    # ── World Map region anchor (reuses region flags from stats block above) ──
    _is_africa  = any(c in _cl for c in (
        "egypt", "morocco", "south africa", "kenya", "tanzania", "ethiopia",
        "ghana", "nigeria", "senegal", "rwanda", "uganda", "namibia",
        "botswana", "zimbabwe", "mozambique", "madagascar", "mauritius",
        "seychelles", "cape verde", "tunisia", "algeria", "libya",
        "cameroon", "ivory coast", "côte d'ivoire", "mali", "zambia",
    ))
    _is_oceania = any(c in _cl for c in (
        "australia", "new zealand", "fiji", "papua new guinea", "samoa",
        "tonga", "vanuatu", "solomon islands", "kiribati",
    ))
    if is_eu:
        map_region = "eu";  map_label = "\U0001f5fa️ Europe Map"
    elif is_us or is_can:
        map_region = "na";  map_label = "\U0001f5fa️ N. America Map"
    elif is_car:
        map_region = "cb";  map_label = "\U0001f5fa️ Caribbean Map"
    elif is_asia:
        map_region = "as";  map_label = "\U0001f5fa️ Asia Map"
    elif _is_africa:
        map_region = "af";  map_label = "\U0001f5fa️ Africa Map"
    elif is_sa:
        map_region = "sa";  map_label = "\U0001f5fa️ S. America Map"
    elif _is_oceania:
        map_region = "oc";  map_label = "\U0001f5fa️ Oceania Map"
    else:
        map_region = "world"; map_label = "\U0001f5fa️ World Map"

    city_upper    = city.upper()
    data_updated  = _dt.date.today().strftime("%Y-%m")
    city_display  = city.replace("-", " ")
    # Country anchor used for Plug-Adapter and Currency pills.
    # Falls back to a FILL token when --country was not supplied.
    country_anchor = country if country else "[FILL-COUNTRY]"

    # ── Read About script (inline JS injected into overview-title) ───────────
    read_about_href  = f"../../Read-About/{slug}/"
    read_about_label = f"Read About {city_display}"
    read_about_script = (
        "<script>\n"
        "document.addEventListener('DOMContentLoaded',function(){\n"
        "  var ot=document.querySelector('.overview-title');\n"
        "  if(!ot)return;\n"
        "  var a=document.createElement('a');\n"
        f"  a.href='{read_about_href}';\n"
        "  a.className='overview-extra-link';\n"
        "  a.style.cssText='font-weight:bold;text-transform:uppercase;font-size:inherit;"
        "margin-left:auto;margin-right:16px;text-decoration:none;';\n"
        f"  a.textContent='{read_about_label}';\n"
        "  var nextBtn=null;\n"
        "  for(var i=0;i<ot.children.length;i++){"
        "if(ot.children[i].textContent==='›'){nextBtn=ot.children[i];break;}}\n"
        "  if(nextBtn)ot.insertBefore(a,nextBtn);else ot.appendChild(a);\n"
        "});\n"
        "</script>\n"
    )

    # ── Overview day cards (3 stops shown; stop-num resets per day) ───────────
    overview_days = ""
    for d in range(1, days + 1):
        stops_inline = " \xb7 ".join(f"[FILL Stop {s}]" for s in range(1, 4))
        overview_days += (
            f'  <a class="overview-day" href="#day{d}">\n'
            f'    <div class="overview-day-title">Day {d} – {stops_inline}</div>\n'
            f'  </a>\n'
        )

    # ── Overview extras pills (Pickleball US-only; Heads Up conditional) ──────
    overview_extras = (
        '  <div class="overview-extras">\n'
        '    <span style="color:#d4b896">|</span>'
        '<a class="overview-extra-link" href="#weekly-closures">'
        '\U0001f5d3️ Weekly Closures</a>\n'
        '    <a class="overview-extra-link" href="#tours">\U0001f4c5 Tours</a>\n'
        '    <a class="overview-extra-link" href="#cappuccino">☕ Cappuccino</a>\n'
        '    <a class="overview-extra-link" href="#restaurants">'
        '\U0001fad5 Restaurants Near Hotel</a>\n'
        '    <a class="overview-extra-link" href="#downtown">'
        '\U0001f37d️ Downtown Restaurants</a>\n'
        '    <a class="overview-extra-link" href="#local-tastes">\U0001f36e Local Tastes</a>\n'
        '    <a class="overview-extra-link" href="#food-delivery">\U0001f697 Food Delivery</a>\n'
        '    <a class="overview-extra-link" href="#shows">\U0001f3ad Shows</a>\n'
        '    <a class="overview-extra-link" href="#getting-around">\U0001f68c Getting Around</a>\n'
        '    <a class="overview-extra-link" href="#stations-near-hotel">'
        '\U0001f686 Train Stations</a>\n'
        '    <a class="overview-extra-link" href="#day-trips-by-train">'
        '⛲️ Day Trips</a>\n'
    )
    if is_us:
        overview_extras += (
            '    <a class="overview-extra-link" href="#pickleball">'
            '\U0001f3d3 Pickleball</a>\n'
        )
    overview_extras += (
        '    <a class="overview-extra-link" href="#michelin">⭐ Michelin</a>\n'
        '    <!-- FILL: add ❗️ Heads Up pill only if the section ships -->\n'
        '    <!-- <a class="overview-extra-link" href="#heads-up">'
        '❗️ Heads Up</a> -->\n'
        '    <a class="overview-extra-link" href="#claude-inspiration">'
        '✨ Claude Inspiration</a>\n'
        '  </div>\n'
    )

    # ── Day blocks — 4 stops each, ticket-box on 1&3, tour-box on 2&4 ────────
    day_blocks = ""
    for d in range(1, days + 1):
        stops_html = ""
        for s in range(1, 5):
            use_ticket = (s % 2 == 1)
            box_cls    = "ticket-box" if use_ticket else "tour-box"
            price_row  = (
                '      <div class="stop-row">\U0001f4b5 $[FILL price]</div>\n'
                if use_ticket else
                '      <div class="stop-row">\U0001f193 Free</div>\n'
            )
            stops_html += (
                f'\n  <!-- inclusion-bar: [FILL: Day {d} Stop {s} name] — '
                f'[FILL: why this stop] -->\n'
                f'  <div class="stop-block" id="[FILL-stop-{d}-{s}-slug]">\n'
                f'    <div class="stop-header">'
                f'<span class="stop-num">{s}.</span>'
                f'<span class="stop-name self">[FILL: Day {d} Stop {s}]</span></div>\n'
                f'    <div class="stop-row">↳ [FILL: one-sentence description]</div>\n'
                f'    <div class="stop-row">\U0001f4d6 '
                f'<a href="[FILL-WIKIPEDIA-URL]" target="_blank" rel="noopener">'
                f'Wikipedia</a></div>\n'
                f'    <div class="{box_cls}">\n'
                f'      <div class="stop-row">\U0001f3db️ '
                f'[FILL: hours, e.g. 9:00am – 5:00pm]</div>\n'
                f'      <div class="stop-row">⏰ ~[FILL: N hr]</div>\n'
                + price_row
                + f'      <div class="stop-row">\U0001f4cd '
                f'<a href="[FILL-MAPS-URL]" target="_blank" rel="noopener">'
                f'[FILL: Street] \xb7 [FILL: Neighborhood]</a></div>\n'
                f'    </div>\n'
                f'    <div class="stop-photos"></div>\n'
                f'  </div>\n'
            )
            if s < 4:
                stops_html += (
                    f'  <div class="next">\U0001f6b6 [FILL: N min] \xb7 '
                    f'\U0001f695 [FILL: M min] → [FILL: Day {d} Stop {s + 1}]</div>\n'
                )

        day_blocks += (
            f'\n<div class="day-block" id="day{d}">\n'
            f'  <div class="day-header">Day {d}</div>\n'
            f'  <!-- stops-map-pill -->\n'
            f'  <!-- /stops-map-pill -->\n'
            f'  <div class="hotel-first">\U0001f3e8 From Hotel: \U0001f6b6 '
            f'[FILL: N min] \xb7 \U0001f695 [FILL: M min] → '
            f'[FILL: Day {d} Stop 1]</div>\n'
            f'{stops_html}'
            f'  <div class="next">\U0001f6b6 [FILL: N min] \xb7 '
            f'\U0001f695 [FILL: M min] → hotel</div>\n'
            f'</div>\n'
        )

    # ── Pickleball section (US only) ──────────────────────────────────────────
    pickleball_section = ""
    if is_us:
        pickleball_section = (
            '\n'
            '<div class="extras-section" id="pickleball">\n'
            '  <div class="extras-title">\U0001f3d3 Pickleball</div>\n'
            f'  <!-- FILL: pickleball courts in {city_display} -->\n'
            '</div>\n'
        )

    # ── EU Train Guide pill (EU only) ─────────────────────────────────────────
    eu_train_pill = ""
    if is_eu:
        eu_train_pill = (
            '    <a class="also-on-this-site-pill" '
            'href="../../Trip-Essentials/European-Train-Guide.html">'
            '\U0001f686 European Train Guide</a>\n'
        )

    # ── Assemble HTML ─────────────────────────────────────────────────────────
    html = (
        '<!-- transit-card: [FILL-TRANSIT-CARD-URL] -->\n'
        '<!DOCTYPE html>\n'
        '<html lang="en">\n'
        '<head>\n'
        '  <meta charset="UTF-8">\n'
        '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        f'  <title>{city_display}</title>\n'
        f'  <link rel="stylesheet" href="../../assets/guide-style.css?v={css_version}">\n'
        '</head>\n'
        '<body>\n'
        '\n'
        '<div class="container">\n'
        '<div id="toolbar-mount"\n'
        '     data-depth="2"\n'
        '     data-maxwidth="940"\n'
        f'     data-updated="{data_updated}"\n'
        '     data-prev=""\n'
        '     data-next=""></div>\n'
        f'<script src="../../assets/toolbar.js?v={tb_version}"></script>\n'
        '\n'
        '<!-- HOTEL BANNER -->\n'
        '<div class="title-page">\n'
        f'  <div class="title-city">{city_upper}</div>\n'
        '  <div class="title-hotel">[FILL: Hotel Name]</div>\n'
        '  <div class="title-address">'
        '<a href="[FILL-MAPS-URL]" target="_blank" rel="noopener">'
        '[FILL: Street Address] \xb7 [FILL: Neighborhood]</a></div>\n'
        f'  <div class="title-country">[FILL: Country]</div>\n'
        '</div>\n'
        '\n'
        '<!-- TRIP OVERVIEW -->\n'
        '<div class="overview-section">\n'
        '  <div class="overview-title">TRIP OVERVIEW</div>\n'
        + read_about_script
        + overview_days
        + overview_extras
        + '</div>\n'
        + day_blocks
        + '\n<!-- EXTRAS SECTIONS — order enforced by validator -->\n'
        '\n'
        '<div class="extras-section" id="weekly-closures">\n'
        '  <div class="extras-title">\U0001f5d3️ Weekly Closures</div>\n'
        f'  <!-- FILL: weekly closures in {city_display} (e.g. museums closed Monday) -->\n'
        '</div>\n'
        '\n'
        '<div class="extras-section" id="tours">\n'
        '  <div class="extras-title">\U0001f4c5 Tours</div>\n'
        '  <div class="tours-group">Viator</div>\n'
        f'  <!-- FILL: Viator tours in {city_display} — up to 5 qualifying -->\n'
        '  <div class="tours-group">GetYourGuide</div>\n'
        f'  <!-- FILL: GetYourGuide tours in {city_display} — up to 5 qualifying -->\n'
        '  <div class="tours-group">TripAdvisor</div>\n'
        f'  <!-- FILL: TripAdvisor tours in {city_display} — up to 5 qualifying -->\n'
        '</div>\n'
        '\n'
        '<div class="extras-section" id="cappuccino">\n'
        '  <div class="extras-title">☕ Cappuccino</div>\n'
        f'  <!-- FILL: cappuccino caf\xe9s within 25 min walk of hotel in {city_display} -->\n'
        '</div>\n'
        '\n'
        '<div class="extras-section" id="restaurants">\n'
        '  <div class="extras-title">\U0001fad5 Restaurants Near Hotel</div>\n'
        f'  <!-- FILL: restaurants within 25 min walk of hotel in {city_display} -->\n'
        '</div>\n'
        '\n'
        '<div class="extras-section" id="downtown">\n'
        '  <div class="extras-title">\U0001f37d️ Downtown Restaurants</div>\n'
        f'  <!-- FILL: downtown restaurants in {city_display} -->\n'
        '</div>\n'
        '\n'
        '<div class="extras-section" id="local-tastes">\n'
        '  <div class="extras-title">\U0001f36e Local Tastes</div>\n'
        f'  <!-- FILL: local food specialties in {city_display} -->\n'
        '</div>\n'
        '\n'
        '<div class="extras-section" id="food-delivery">\n'
        '  <div class="extras-title">\U0001f697 Food Delivery</div>\n'
        f'  <!-- FILL: food delivery services available in {city_display} -->\n'
        '</div>\n'
        '\n'
        '<div class="extras-section" id="shows">\n'
        '  <div class="extras-title">\U0001f3ad Shows, Performances &amp; Concerts</div>\n'
        f'  <!-- FILL: shows, performances, concerts in {city_display} -->\n'
        '</div>\n'
        '\n'
        '<div class="extras-section" id="getting-around">\n'
        '  <div class="extras-title">\U0001f68c Getting Around</div>\n'
        f'  <!-- FILL: transit options in {city_display} -->\n'
        '</div>\n'
        '\n'
        '<div class="extras-section" id="stations-near-hotel">\n'
        '  <div class="extras-title">\U0001f686 Train Stations Near Hotel</div>\n'
        f'  <!-- FILL: train stations near hotel in {city_display} -->\n'
        '</div>\n'
        '\n'
        '<div class="extras-section" id="day-trips-by-train">\n'
        '  <div class="extras-title">⛲️ Day Trips by Train</div>\n'
        f'  <!-- FILL: day trips from {city_display} -->\n'
        '</div>\n'
        + pickleball_section
        + '\n'
        '<div class="extras-section" id="michelin">\n'
        '  <div class="extras-title">⭐ Michelin Restaurants</div>\n'
        f'  <!-- michelin-count: [FILL: N] -->\n'
        f'  <!-- FILL: Michelin-starred restaurants in {city_display} -->\n'
        '</div>\n'
        '\n'
        '<!-- Heads Up section: uncomment if it ships for this guide\n'
        '<div class="extras-section" id="heads-up">\n'
        '  <div class="extras-title">❗️ Heads Up</div>\n'
        f'  [FILL: things that surprised travellers in {city_display}]\n'
        '</div>\n'
        '-->\n'
        '\n'
        '<!-- Skip List section: uncomment if it ships for this guide\n'
        '<div class="extras-section" id="skip-list">\n'
        '  <div class="extras-title">\U0001f6ab Skip List</div>\n'
        f'  [FILL: overhyped spots to avoid in {city_display}]\n'
        '</div>\n'
        '-->\n'
        '\n'
        '<div class="claude-inspiration" id="claude-inspiration">\n'
        '  <div class="extras-title">✨ Claude Inspiration</div>\n'
        f'  <!-- FILL: curated tips and hidden gems for {city_display} -->\n'
        '</div>\n'
        '\n'
        # City anchor: title-case city name with spaces — matches climate.json /
        # Safety-Guide data-city keys. For island or region guides where the guide
        # name differs from the data city (e.g. Crete → Heraklion, Bali → Ubud),
        # update the three city-anchor pills below to the specific city name.
        f'<!-- also-on-this-site -->\n'
        f'<div class="extras-section" id="also-on-this-site">\n'
        f'  <div class="extras-title"></div>\n'
        f'  <div class="also-on-this-site-pills">\n'
        f'    <a class="also-on-this-site-pill" '
        f'href="../../Trip-Essentials/Weather.html#{city_display}">'
        '\U0001f324️ Weather</a>\n'
        f'    <a class="also-on-this-site-pill" '
        f'href="../../Trip-Essentials/Time-Zones.html#{city_display}">'
        '\U0001f550 Time Zones</a>\n'
        f'    <a class="also-on-this-site-pill" '
        'href="../../Trip-Essentials/Sunrise-Sunset.html">'
        '\U0001f305 Sunrise &amp; Sunset</a>\n'
        f'    <a class="also-on-this-site-pill" '
        f'href="../../Trip-Essentials/Plug-Adapter/Plug-Adapter-Guide.html#{country_anchor}">'
        '\U0001f50c Plug Adapter</a>\n'
        f'    <a class="also-on-this-site-pill" '
        f'href="../../Trip-Essentials/Currency-Guide.html#{country_anchor}">'
        '\U0001f4b0 Currency</a>\n'
        f'    <a class="also-on-this-site-pill" '
        f'href="../../Trip-Essentials/Safety-Guide.html#{city_display}">'
        '\U0001f6e1️ Safety Guide</a>\n'
        f'    <a class="also-on-this-site-pill" '
        'href="../../Trip-Essentials/Visas.html">\U0001faaa Visas</a>\n'
        f'    <a class="also-on-this-site-pill" href="{stats_href}">{stats_label}</a>\n'
        + eu_train_pill
        + f'    <a class="also-on-this-site-pill" '
          f'href="../../Trip-Essentials/Maps/World-Map.html#{map_region}">'
          f'{map_label}</a>\n'
        + '  </div>\n'
        '</div>\n'
        '<!-- /also-on-this-site -->\n'
        '\n'
        '<!-- nearby-guides: injected at ship -->\n'
        '\n'
        '</div><!-- /container -->\n'
        '</body>\n'
        '</html>\n'
    )

    guide_dir.mkdir(parents=True, exist_ok=True)
    out_file.write_text(html, encoding="utf-8")
    print(f"  ✅  Stub created: {out_file}")
    print(f"      {days} day(s) \xb7 4 stops each (ticket-box on 1&3, tour-box on 2&4)")
    print(f"      CSS v{css_version} \xb7 toolbar v{tb_version} \xb7 data-updated {data_updated}")
    print(f"      also-on-site anchors: city='{city_display}' \xb7 country='{country_anchor}' \xb7 map='{map_region}'")
    if not country:
        print(f"      ⚠️  --country not supplied — Plug-Adapter and Currency pills need manual anchor")
    if not country:
        print("      ⚠️  No --country given — Stats pill is a placeholder.")
        print("          Re-run with --country to auto-detect Stats + EU Train pill.")
    else:
        print(f"      Country: {country!r}")
        print(f"      Stats: {stats_label}")
        if is_eu:
            print("      EU Train Guide pill included")
        if is_us:
            print("      Pickleball section included")
    print("      Fill all [FILL: ...] tokens and run preflight before writing content.")
    return 0


def _run_check_vlog(city: str) -> int:
    """Pre-ship diagnostic: show which booking URLs need verification_log.json entries.

    Runs verify_booking_links.py in --static --verbose mode so the crib sees
    exactly which bot-blocked URLs (Viator / GetYourGuide / Michelin) are
    missing log entries — before the first ship attempt. Eliminates the blind
    'FAIL @ verify-booking → retry → same FAIL' loop that costs 5-8 ship
    attempts per guide.

    Added 2026-07-21: root cause was the 2026-07-14 verification_log strip
    incident (208/219 guides affected). Cribs had no way to discover which
    URLs needed log entries without triggering a full ship attempt first.

    Always exits 0 — this is informational only, not a gate.
    Run this before `ship` whenever a guide hasn't shipped recently or the
    verification_log.json might be stale.
    """
    folder = GUIDES_DIR / city
    if not folder.is_dir():
        alt = GUIDES_DIR / city.replace(" ", "-")
        if alt.is_dir():
            folder = alt
    if not folder.is_dir():
        print(f"❌  No guide folder for {city!r} under {GUIDES_DIR}", file=sys.stderr)
        return 2

    guide = _latest_guide_html(folder)
    if guide is None:
        print(f"❌  No guide HTML found in {folder}", file=sys.stderr)
        return 2

    vlog = folder / "_build" / "verification_log.json"

    print(f"\n📋  check-vlog: {city} — {guide.name}")

    if vlog.exists():
        try:
            data = json.loads(vlog.read_text(encoding="utf-8"))
            entries = data.get("entries", {})
            print(f"    verification_log.json: {len(entries)} existing entries")
        except Exception:
            print(f"    ⚠️   verification_log.json exists but could not be parsed")
    else:
        print(f"    ⚠️   No verification_log.json found — every bot-blocked URL will "
              f"FAIL @ verify-booking until entries are added.")

    print(f"\n  ── Log coverage check (static — no network calls) ───────────────────")
    print(f"  These are the URLs that must have log entries to pass verify-booking.\n")
    _run(SUBCOMMANDS["verify-booking"], [str(guide), "--static", "--verbose"])

    print(f"\n  ── What to do next ──────────────────────────────────────────────────")
    print(f"  For every ❌ above: run a site: search (see Platforms.md), confirm")
    print(f"  the URL points at the right subject, then add an entry to:")
    print(f"  {vlog}")
    print(f"\n  When all entries are added: `guide_tools.py ship {guide.name}`")
    print(f"  This diagnostic always exits 0.\n")
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
        # ── Validation stamp gate (added 2026-05-07; signed 2026-06-27) ───────
        # The real guarantee comes from the `validate` step in the chain below —
        # it RE-RUNS the full validator on this guide and, only on a clean pass,
        # writes a CONTENT-BOUND SIGNED stamp (see validation_stamp.py). So the
        # stamp can never be hand-typed or bulk-faked: ship re-validates from
        # scratch every time. This pre-check is just an early, friendly nudge —
        # the authoritative signature check runs AFTER the chain, right before
        # the push (see "Signed-stamp gate" below).
        _guide_path = Path(tail[0]).resolve()
        try:
            _guide_html = _guide_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            print(f"❌ File not found: {tail[0]}", file=sys.stderr)
            return 2
        # ──────────────────────────────────────────────────────────────────────

        _patch_verification_log(Path(tail[0]).resolve())

        # ── Advisory check-vlog (added 2026-07-23) ────────────────────────────
        # Shows which bot-blocked URLs (Viator/GYG/Michelin) need
        # verification_log.json entries BEFORE the verify-booking gate runs.
        # Eliminates the blind 'FAIL @ verify-booking → retry → same FAIL' loop
        # (Frankfurt 2026-07-22: 6 FAILs despite check-vlog being available as a
        # standalone command — cribs forget to run it manually). Advisory only:
        # always exits 0 and never blocks the ship.
        _vlog_city = Path(tail[0]).resolve().parent.name
        print(f"\n📋  Pre-ship check-vlog for {_vlog_city} (advisory — will not block ship):")
        _run_check_vlog(_vlog_city)
        print()
        # ──────────────────────────────────────────────────────────────────────

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
                "    Fix brain integrity issues (e.g. missing Guides-Index.html entry),\n"
                "    then re-run ship.\n",
                file=sys.stderr,
            )
            _write_ship_log(Path(tail[0]).resolve(), "FAIL", step="brain-check")
            return rc_brain
        # ──────────────────────────────────────────────────────────────────────

        _val_passed, _val_failed = 0, 0
        for sub in ("validate", "verify", "verify-booking"):
            if sub == "validate":
                rc, _val_passed, _val_failed = _run_validate_capturing(tail[0])
            else:
                rc = _run(SUBCOMMANDS[sub], tail)
            if rc != 0:
                _write_ship_log(
                    Path(tail[0]).resolve(),
                    "FAIL",
                    step=sub,
                    passed=_val_passed if sub == "validate" else 0,
                    failed=_val_failed if sub == "validate" else 0,
                )
                return rc

        # ── Guides-Index.html gate (added 2026-06-02) ─────────────────────────
        # Each crib checks only its own guide. Verifies that Guides-Index.html
        # has an entry for the city folder containing the guide being shipped.
        # Fires at ship time — never at session start. Replaced the old
        # check_guides_index_coverage in brain_check.py which ran at session
        # start and incorrectly flagged other cribs' in-progress builds.
        rc_idx = _check_guide_indexed(Path(tail[0]).resolve())
        if rc_idx != 0:
            return rc_idx
        # ──────────────────────────────────────────────────────────────────────

        # ── data-shipped gate (added 2026-07-19) ──────────────────────────────
        # Verifies the dest-card carries data-shipped="YYYY-MM-DD" so the 'new'
        # badge JS can show the amber 14-day badge. Cards built via
        # guide_surfaces.py get this automatically; hand-written cards may not.
        rc_shipped = _check_guide_has_shipped_attr(Path(tail[0]).resolve())
        if rc_shipped != 0:
            _write_ship_log(Path(tail[0]).resolve(), "FAIL", step="data-shipped")
            return rc_shipped
        # ──────────────────────────────────────────────────────────────────────

        # ── Index-card inline-data gate (added 2026-06-21) ────────────────────
        # _check_guide_indexed above only proves the card EXISTS. This proves the
        # card also has matching entries in the three inline JS blocks
        # (CLIMATE_INLINE / COST_DATA / SAFETY_DATA) that power its on-card
        # weather/cost/safety filters — closing the hole that let cards ship with
        # blank filters. Scoped, ship-time counterpart of
        # validate_guides_index_inline.py (which audits the whole index).
        rc_inline = _check_guide_inline(Path(tail[0]).resolve())
        if rc_inline != 0:
            _write_ship_log(Path(tail[0]).resolve(), "FAIL", step="index-inline")
            return rc_inline
        # ──────────────────────────────────────────────────────────────────────

        # ── map pin gate (added 2026-06-02) ───────────────────────────────────
        # Verifies the city has a pin in Europe Map.html or US Map.html.
        # Full rule: Brain/Reference/Navigation.html § 5 step 5.
        rc_pin = _check_guide_pinned(Path(tail[0]).resolve())
        if rc_pin != 0:
            _write_ship_log(Path(tail[0]).resolve(), "FAIL", step="map-pin")
            return rc_pin
        # ──────────────────────────────────────────────────────────────────────

        # ── Status Dots gate (added 2026-06-15) ───────────────────────────────
        # Verifies the city appears in Status Dots — guides_index.md (any section).
        # Catches guides shipped without ever being added to the dot tracker.
        # brain_check.check_status_dots_stalled_builds catches the complementary
        # case (in stalled list but has shipped HTML).
        rc_dots = _check_guide_in_status_dots(Path(tail[0]).resolve())
        if rc_dots != 0:
            _write_ship_log(Path(tail[0]).resolve(), "FAIL", step="status-dots")
            return rc_dots
        # ──────────────────────────────────────────────────────────────────────

        # ── FMAP gate (added 2026-06-15) ──────────────────────────────────────
        # Verifies the guide has a flight-time map entry in Guides-Index.html's
        # FMAP block. A missing entry means the city is invisible in the
        # flight-time view. validate_flight_index.py enforces bi-directional
        # coverage; this gate fires earlier, at ship time, for the shipped guide.
        rc_fmap = _check_guide_fmap(Path(tail[0]).resolve())
        if rc_fmap != 0:
            _write_ship_log(Path(tail[0]).resolve(), "FAIL", step="fmap")
            return rc_fmap
        # ──────────────────────────────────────────────────────────────────────

        # ── Climate / Weather data gate (added 2026-06-15) ────────────────────
        # Both Weather toolbar tabs — By Climate (Climate Finder) and By City
        # (Weather.html) — read window.TravelClimate, baked into assets/weather.js
        # from assets/climate.json. A guide that ships without climate normals is
        # invisible in both tabs. Enforce presence in both data sources at ship time.
        rc_clim = _check_guide_in_climate(Path(tail[0]).resolve())
        if rc_clim != 0:
            _write_ship_log(Path(tail[0]).resolve(), "FAIL", step="climate")
            return rc_clim
        # ──────────────────────────────────────────────────────────────────────

        # ── Safety Guide — scoped hard gate + rebuild ────────────────────────
        # Hard-fail if this city is absent from safety_levels.json — the rebuild
        # silently drops it and the Safety Guide would ship without the entry.
        # Whole-index validate_safety_guide.py is NOT run — other guides' gaps
        # are not this crib's problem.
        rc_safe = _check_guide_in_safety(Path(tail[0]).resolve())
        if rc_safe != 0:
            _write_ship_log(Path(tail[0]).resolve(), "FAIL", step="safety")
            return rc_safe
        print("\n▶ Rebuilding Safety Guide…")
        _run("build_safety_guide.py", [])
        # ──────────────────────────────────────────────────────────────────────

        # ── Before You Go — tap water gate (added 2026-07-24) ────────────────
        # Before You Go shows tap water status per country. A new country not in
        # WATER_DATA would render a blank row. Hard-fail so cribs catch it at ship
        # time, not after the guide is live.
        rc_byg = _check_guide_in_byg_water(Path(tail[0]).resolve())
        if rc_byg != 0:
            _write_ship_log(Path(tail[0]).resolve(), "FAIL", step="byg-water")
            return rc_byg
        # ──────────────────────────────────────────────────────────────────────

        # ── Currency Guide gate (added 2026-06-15) ────────────────────────────
        # Currency Guide is per-country. A guide that introduces a NEW country must
        # have it added. Scoped to the shipping guide (not whole-index coverage) so
        # an unrelated pre-existing mismatch can't block this ship.
        rc_curr = _check_guide_in_currency(Path(tail[0]).resolve())
        if rc_curr != 0:
            _write_ship_log(Path(tail[0]).resolve(), "FAIL", step="currency")
            return rc_curr
        # ──────────────────────────────────────────────────────────────────────

        # ── Travel Stats — rebuild only, advisory validate ────────────────────
        # Rebuild so this guide's stats are included. Whole-index validation is
        # advisory only — broken links from OTHER guides' stale/in-progress cards
        # must not block this ship.
        print("\n▶ Rebuilding Travel Stats…")
        _run("build_travel_stats.py", [])
        if _run("validate_travel_stats.py", []) != 0:
            print("  ⚠️  validate_travel_stats reports whole-index drift (advisory — ship not blocked).",
                  file=sys.stderr)
        # ──────────────────────────────────────────────────────────────────────

        # ── Alphabetical ordering — hard gate ─────────────────────────────────
        # Guides-Index.html must list countries (and guides within each country)
        # alphabetically — CLAUDE.md documents this as a "hard ship-gate, no
        # exceptions." Was silently advisory-only in code until 2026-07-12,
        # which let a Laos/Montenegro/Nepal block ship wedged between Canada and
        # Caribbean Islands/Chile without ever failing a ship. Any ordering
        # violation anywhere in the file — not just around the shipping guide —
        # now blocks.
        rc_alpha = _run("validate_guides_index_alphabetical.py", [])
        if rc_alpha != 0:
            print(
                "\n🚫  SHIP BLOCKED — Guides-Index.html countries/guides are not in "
                "alphabetical order.\n"
                "    Fix the ordering in Travel-Website/Guides/Guides-Index.html, then re-run ship.\n",
                file=sys.stderr,
            )
            _write_ship_log(Path(tail[0]).resolve(), "FAIL", step="alphabetical-order")
            return rc_alpha
        # ──────────────────────────────────────────────────────────────────────

        # ── Country assignment — advisory only ───────────────────────────────
        # Check that the shipping city is under the correct country block.
        # Advisory: another crib's mis-placed card must not block this ship.
        if _run("validate_guide_country_assignment.py", []) != 0:
            print("  ⚠️  validate_guide_country_assignment reports assignment drift (advisory — ship not blocked).",
                  file=sys.stderr)
        # ──────────────────────────────────────────────────────────────────────

        # ── mobile baseline gate (added 2026-06-12) ───────────────────────────
        # Shipping a guide edits Guides-Index.html + the continent maps (new card
        # + pin). Confirm every shareable page still carries the viewport tag and
        # the assets/mobile.css baseline — --strict exits 1 on any miss. Guides
        # themselves are covered by guide-style.css and are out of this check's scope.
        rc_mob = _run(SUBCOMMANDS["mobile-check"], ["--strict"])
        if rc_mob != 0:
            print(
                "\n🚫  SHIP BLOCKED — a shareable page is missing the mobile baseline.\n"
                "    Fix:  python3 Brain/scripts/mobile_check.py --apply\n"
                "    Then re-run ship.\n",
                file=sys.stderr,
            )
            _write_ship_log(Path(tail[0]).resolve(), "FAIL", step="mobile-baseline")
            return rc_mob
        # ──────────────────────────────────────────────────────────────────────

        # ── mobile RENDER gate, guide-scoped (added 2026-07-12) ───────────────
        # The check above is STATIC (viewport tag + mobile.css present) and was
        # documented as "guides are covered by guide-style.css and out of this
        # check's scope" — i.e. guide-style.css was trusted correct by
        # construction, never rendered and measured. It wasn't: the "Also on
        # this site" mobile grid broke (a title heading eating a grid column
        # without a span, plus toolbar.js's Updated-stamp injection breaking a
        # :last-child selector) and shipped through mobile-check + brain_check +
        # validate_itinerary + pre_push_guard without any of them firing, since
        # none of them render the page — a bug with the right height/font/radius
        # numbers but the wrong width and wrap is invisible to a static check.
        # Scope this to just the shipping guide (rendering the whole fleet every
        # ship is too slow) — hard block, not --warn.
        rc_render = _run("validate_mobile_render.py", tail)
        if rc_render != 0:
            print(
                "\n🚫  SHIP BLOCKED — guide fails the mobile render check "
                "(off-standard pill sizing/wrap or horizontal overflow at 393px).\n"
                "    Run:  python3 Brain/scripts/validate_mobile_render.py %s\n"
                "    Then re-run ship.\n" % tail[0],
                file=sys.stderr,
            )
            _write_ship_log(Path(tail[0]).resolve(), "FAIL", step="mobile-render")
            return rc_render
        # ──────────────────────────────────────────────────────────────────────

        # ── continuity RENDER gate, FLEET-SCOPED (added 2026-07-12, widened same day) ─
        # Same gap-class as the mobile render gate above, different bug: the static
        # "Style A continuous-run" check in validate_itinerary.py only confirms the
        # required CSS selector text is present in guide-style.css, not that the
        # browser actually applies it with zero gap. It shipped clean twice in one
        # session while the underlying fix was broken (a CSS specificity miss, then
        # a margin-shorthand-sets-both-sides miss) — neither bug removed any anchor
        # text, so the static check never caught it; only rendering and measuring
        # the actual join gap does.
        # Deliberately NOT scoped to the shipping guide (unlike the mobile-render gate
        # above): the continuity rules live in the ONE shared guide-style.css, so a
        # regression there breaks EVERY guide's continuity, not just the one shipping.
        # This happened for real within an hour of the gate first landing — a second
        # crib's commit deleted the #shows continuity lines while shipping an unrelated
        # guide that has no Shows section, so a guide-scoped gate would have passed it
        # clean while every OTHER guide's Shows section silently regressed. Fleet scan
        # takes ~1-2 min; that cost is the point — it is the only way to actually catch
        # a shared-file regression before it reaches origin.
        rc_cont = _run("validate_continuity_render.py", [])
        if rc_cont != 0:
            print(
                "\n🚫  SHIP BLOCKED — a gapped Extras-section or stop-block card join "
                "was found somewhere in the fleet (should render as one seamless card, "
                "not stacked with a gap). This gate runs fleet-wide, not just against "
                "the guide you're shipping, because the continuity rules live in the "
                "one shared guide-style.css — a regression there breaks every guide.\n"
                "    Run:  python3 Brain/scripts/validate_continuity_render.py\n"
                "    Then re-run ship.\n",
                file=sys.stderr,
            )
            _write_ship_log(Path(tail[0]).resolve(), "FAIL", step="continuity-render")
            return rc_cont
        # ──────────────────────────────────────────────────────────────────────

        # ── oversized-photo auto-heal (added 2026-06-20) ──────────────────────
        # Guides serve photos straight from _build/assets/; Wikimedia originals are
        # often full-resolution (multi-MB) despite "800px-" filenames — heavy mobile
        # load and, in bulk, a threat to the ~1GB GitHub Pages site limit. Downscale
        # this guide's photos to <=1MB / <=1600px before the ship is marked clean.
        # Best-effort: never blocks an otherwise-clean ship. Standalone check:
        #   python3 Brain/scripts/validate_image_sizes.py <guide_dir>
        try:
            _gp = Path(tail[0]).resolve()
            _gdir = str(_gp if _gp.is_dir() else _gp.parent)
            print("\n▶ Right-sizing guide photos (<=1MB / <=1600px)…")
            _run("validate_image_sizes.py", ["--fix", _gdir])
        except Exception as _e:  # noqa: BLE001 — never let photo-sizing break a ship
            print(f"  ⚠️  image-size auto-heal skipped ({_e}). "
                  f"Run: python3 Brain/scripts/validate_image_sizes.py {tail[0]}", file=sys.stderr)
        # ──────────────────────────────────────────────────────────────────────

        # ── Index filters — hard gates (added 2026-06-22) ─────────────────────
        # All three Guides-Index filters (Trip Length / Trip Type / Language) must
        # be populated before a guide ships.  Each refresh function auto-applies its
        # builder and returns 1 if the city is still missing after the apply.
        _filter_fails: list[str] = []
        guide_p = Path(tail[0]).resolve()

        # 📅 Trip Length (DAYS_DATA) — auto-detected from id="dayN" in guide HTML
        if _refresh_days_data(guide_p) != 0:
            _filter_fails.append("DAYS_DATA (trip length filter) — add id=\"dayN\" to day blocks")

        # 🎯 Trip Type (THEME_DATA) — curated in build_theme_tags.py
        if _refresh_theme_tags(guide_p) != 0:
            _filter_fails.append("THEME_DATA (trip-type filter) — add to build_theme_tags.py → --apply")

        # 🗣 Language (data-lang) — curated in build_lang_tags.py
        if _refresh_lang_tags(guide_p) != 0:
            _filter_fails.append("data-lang (language filter) — add to build_lang_tags.py → --apply")

        if _filter_fails:
            print("\n🚫  SHIP BLOCKED — index filter(s) incomplete:")
            for _f in _filter_fails:
                print(f"   • {_f}")
            _write_ship_log(guide_p, "FAIL", step="index-filters")
            return 1
        # ──────────────────────────────────────────────────────────────────────

        # ── Coverage gates: US stats, regional stats, Time-Zones, Delta ───────
        # Added 2026-06-22. Each gate is also enforced in update-index (Steps
        # 7–10); duplicating here ensures ship alone catches gaps even if
        # update-index was skipped.
        _cov_fails: list[str] = []
        if _check_guide_in_us_stats(guide_p) != 0:
            _cov_fails.append("Stats-Across-US.html — city missing from one or more categories")
        if _check_guide_in_regional_stats(guide_p) != 0:
            _cov_fails.append("Regional stats page — country missing from one or more sections")
        if _check_guide_in_time_zones(guide_p) != 0:
            _cov_fails.append("Time-Zones.html — city entry or guide link missing")
        if _check_guide_in_delta_routes(guide_p) != 0:
            _cov_fails.append("Delta-Routes-SEA.html — no routing card with data-guide attribute")
        if _check_guide_in_transit_cards(guide_p) != 0:
            _cov_fails.append("City-Transit-Cards.html — city not in page and not in NO_TRANSIT_CARD list")
        if _check_guide_in_visas(guide_p) != 0:
            _cov_fails.append("Visas.html — country row missing")
        if _check_guide_in_tipping(guide_p) != 0:
            _cov_fails.append("Tipping-Guide.html — country entry missing")
        if _check_guide_story_page(guide_p) != 0:
            _cov_fails.append("Read About page — {slug}-read-about.html missing or not linked")
        if _check_guide_stops_map(guide_p) != 0:
            _cov_fails.append("Stops Map — {slug}-stops-map.html missing; run build_guide_map.py <City>")
        if _check_guide_in_day_trips(guide_p) != 0:
            _cov_fails.append("Day-Trips.html — guide has day-trips entries but is missing from DATA array")
        if _cov_fails:
            print("\n🚫  SHIP BLOCKED — coverage gap(s):")
            for _f in _cov_fails:
                print(f"   • {_f}")
            _write_ship_log(guide_p, "FAIL", step="coverage-gates")
            return 1
        # ──────────────────────────────────────────────────────────────────────

        _write_ship_log(Path(tail[0]).resolve(), "PASS", passed=_val_passed, failed=_val_failed)
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

        # ── Nearby guides injection (added 2026-07-14) ────────────────────────
        # Inject (or refresh) the "Nearby guides" block at the bottom of the
        # shipping guide — 3 geographically closest shipped guides by haversine
        # over World-Map PINS. Best-effort — never blocks a ship.
        try:
            print("\n▶ Injecting nearby guides block…")
            _run("build_nearby_guides.py", tail)
        except Exception as _e:  # noqa: BLE001
            print(f"  ⚠️  nearby-guides injection skipped ({_e}). "
                  f"Run: python3 Brain/scripts/build_nearby_guides.py {tail[0]}", file=sys.stderr)
        # ──────────────────────────────────────────────────────────────────────

        # ── Stops Map companion generation (added 2026-07-15) ────────────────
        # Generate (or refresh) the {slug}-stops-map.html beside the guide.
        # Best-effort — build_guide_map.py geocodes via Nominatim (slow), so
        # failures here never block a ship; the _check_guide_stops_map gate
        # above already hard-blocked if the file was absent at gate time.
        try:
            print("\n▶ Generating stops map…")
            _run("build_guide_map.py", tail)
        except Exception as _e:  # noqa: BLE001
            print(f"  ⚠️  stops-map generation skipped ({_e}). "
                  f"Run: python3 Brain/scripts/build_guide_map.py {tail[0]}", file=sys.stderr)
        # ──────────────────────────────────────────────────────────────────────

        # ── Delta-Routes-SEA.html GUIDES map refresh (added 2026-06-26) ──────
        # Keep the JS GUIDES map in sync so the new guide's city card shows
        # the "📖 Guide" link immediately. Best-effort — never blocks a ship.
        try:
            print("\n▶ Refreshing Delta-Routes-SEA.html guide links…")
            _run("build_delta_routes_guides.py", [])
        except Exception as _e:  # noqa: BLE001
            print(f"  ⚠️  Delta-Routes guides refresh skipped ({_e}). "
                  f"Run: python3 Brain/scripts/build_delta_routes_guides.py", file=sys.stderr)
        # ──────────────────────────────────────────────────────────────────────

        # ── build_home_stats RETIRED 2026-07-10 ─────────────────────────────
        # index.html is now a redirect stub → Guides-Index.html; the old stat
        # tiles no longer exist. build_home_stats.py is no longer called.
        # ──────────────────────────────────────────────────────────────────────

        # ── whole-index coverage audits (wired 2026-06-21) ────────────────────
        # The scoped ship gates above confirm THIS guide is present in each data
        # surface. These three validators are the WHOLE-INDEX counterparts —
        # they catch drift the scoped checks can't: ghost entries (a removed guide
        # still indexed), a stale generated-date (>7 days), or country/city set
        # mismatch across the entire index. Run them every ship so the audits
        # actually fire instead of waiting for a human to remember. ADVISORY ONLY
        # — a pre-existing whole-index mismatch must not block an otherwise-clean
        # ship of an unrelated guide; each prints a loud fix line on non-zero.
        for _vscript, _builder in (
            ("validate_search_index.py",        "build_search_index.py"),
            ("validate_climate_coverage.py",    "build_climate.py"),
            ("validate_currency.py",            "build_currency.py"),
            ("validate_delta_routes_guides.py",   "build_delta_routes_guides.py"),
            ("validate_time_zones_cities.py",    "Time-Zones.html (manual — add CITIES entry)"),
        ):
            try:
                if _run(_vscript, []) != 0:
                    print(f"  ⚠️  {_vscript} reports whole-index drift (advisory — ship not blocked). "
                          f"Fix: python3 Brain/scripts/{_builder}", file=sys.stderr)
            except Exception as _e:  # noqa: BLE001 — audits never break a ship
                print(f"  ⚠️  {_vscript} skipped ({_e}).", file=sys.stderr)
        # ──────────────────────────────────────────────────────────────────────

        # (Travel Stats rebuild + validation now run as a HARD gate above, before
        #  the ship is marked PASS — see the Travel Stats gate.)

        # ── Signed-stamp gate (added 2026-06-27) ────────────────────────────────
        # All validations passed and `validate` re-stamped the guide with a fresh
        # content-bound signature. Confirm that signature is valid against the file
        # on disk RIGHT NOW, before pushing — this is the un-fakeable guarantee that
        # what goes live actually passed the real validator on this exact content.
        try:
            sys.path.insert(0, str(HERE))
            import validation_stamp as _vs
            _ok_sig, _why = _vs.verify(Path(tail[0]).resolve().read_text(encoding="utf-8"))
            if not _ok_sig:
                print(
                    "\n🚫  SHIP BLOCKED — validation signature invalid after the pipeline.\n"
                    f"    Reason: {_why}\n"
                    "    The guide must carry a stamp signed by a real validator pass.\n"
                    "    Re-run:  python3 guide_tools.py validate <file.html>\n",
                    file=sys.stderr,
                )
                _write_ship_log(Path(tail[0]).resolve(), "FAIL", step="signed-stamp")
                return 1
        except Exception as _e:  # noqa: BLE001 — never let the check itself brick a ship
            print(f"  ⚠️  signed-stamp verification skipped ({_e}).", file=sys.stderr)
        # ──────────────────────────────────────────────────────────────────────

        # ── serialized publish (2026-07-05) ─────────────────────────────────────
        # The guide passed every gate in ISOLATION (its own folder). Now hand it
        # to the single serialized publisher: enqueue a job, then drain the queue
        # under the push lock. The publisher does ALL shared-surface work —
        # reverting root surfaces to HEAD (dropping any other crib's uncommitted
        # leaks), merging, re-applying only the queued cities idempotently, running
        # the derived builders, and pushing. No crib ever writes a shared file, so
        # concurrent cribs can never race, leak, or undo each other. If the
        # publisher can't run, fall back to the scoped push (guide still ships).
        try:
            _gpath = Path(tail[0]).resolve()
            _city = _gpath.parent.name  # Guides/CityName/guide.html → CityName
            print(f"\n▶ Enqueueing publish job for {_city}…")
            subprocess.run(
                ["python3", "Brain/scripts/publish_queue.py", "--enqueue", str(_gpath)],
                cwd=TRAVEL_ROOT, capture_output=False,
            )
            print(f"▶ Draining publish queue (serialized)…")
            rc_pub = subprocess.run(
                ["python3", "Brain/scripts/publish_queue.py", "--drain"],
                cwd=TRAVEL_ROOT, capture_output=False,
            )
            if rc_pub.returncode != 0:
                print("⚠️  Publish did not complete this pass (lock held or merge not clean). "
                      "The job stays queued and the next ship/drain will publish it.",
                      file=sys.stderr)
            # Release our build lease now that the guide is published (best-effort).
            try:
                sys.path.insert(0, str(HERE))
                import crib_safety as _cs
                _cs.release(_gpath.parent)
            except Exception:
                pass
        except Exception as _e:
            # Fallback: scoped push so the guide still reaches origin.
            print(f"⚠️  Publisher unavailable ({_e}); falling back to scoped push.", file=sys.stderr)
            try:
                _guide_dir = _gpath.parent.resolve().relative_to(TRAVEL_ROOT.resolve()).as_posix()
                subprocess.run(
                    ["python3", "Brain/scripts/push_queue.py", "--push",
                     f"Ship guide: {_city}", "--guide-dir", _guide_dir],
                    cwd=TRAVEL_ROOT, capture_output=False,
                )
            except Exception as _e2:
                print(f"⚠️  Fallback push also failed ({_e2}). Manual: git push origin main",
                      file=sys.stderr)
        # ──────────────────────────────────────────────────────────────────────

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

    if cmd == "audit":
        return _open_audit()

    if cmd == "staleness":
        return _run_staleness(backfill=("--backfill" in tail))

    if cmd == "fix":
        if not tail:
            print("Usage: guide_tools.py fix <City>", file=sys.stderr)
            return 2
        return _run_fix(" ".join(tail))

    if cmd == "check-vlog":
        if not tail:
            print("Usage: guide_tools.py check-vlog <City>", file=sys.stderr)
            return 2
        return _run_check_vlog(" ".join(tail))

    if cmd == "revalidate":
        if not tail:
            print("Usage: guide_tools.py revalidate <City>", file=sys.stderr)
            return 2
        return _run_revalidate(" ".join(tail))

    if cmd == "test":
        return _run_tests()

    if cmd == "no-transit-card":
        if not tail:
            print("Usage: guide_tools.py no-transit-card <CityFolder>", file=sys.stderr)
            return 2
        return _mark_no_transit_card(" ".join(tail))

    if cmd == "surface-check":
        if not tail:
            print("Usage: guide_tools.py surface-check <City>", file=sys.stderr)
            return 2
        return _run_surface_check(" ".join(tail))

    if cmd == "stub":
        if not tail:
            print("Usage: guide_tools.py stub <City> [--days N] [--country Country]",
                  file=sys.stderr)
            return 2
        _stub_days = 3
        _stub_country = ""
        _skip_next = False
        _stub_city_parts = []
        for _i, _a in enumerate(tail):
            if _skip_next:
                _skip_next = False
                continue
            if _a == "--days":
                if _i + 1 < len(tail):
                    try:
                        _stub_days = int(tail[_i + 1])
                    except ValueError:
                        print("Usage: guide_tools.py stub <City> [--days N] [--country Country]",
                              file=sys.stderr)
                        return 2
                    _skip_next = True
            elif _a == "--country":
                if _i + 1 < len(tail):
                    _stub_country = tail[_i + 1]
                    _skip_next = True
            elif not _a.startswith("--"):
                _stub_city_parts.append(_a)
        return _run_stub(" ".join(_stub_city_parts), days=_stub_days, country=_stub_country)

    if cmd == "world-map-audit":
        import importlib.util, pathlib
        _wma_path = pathlib.Path(__file__).parent / "world_map_audit.py"
        _spec = importlib.util.spec_from_file_location("world_map_audit", _wma_path)
        _mod  = importlib.util.module_from_spec(_spec)
        _spec.loader.exec_module(_mod)
        _data = _mod.run_audit(pathlib.Path(".").resolve())
        if "--json" in tail:
            import json as _json
            print(_json.dumps(_data, indent=2))
        else:
            _mod.print_human(_data)
        return 0 if _data["overall"] == "PASS" else 1

    if cmd in SUBCOMMANDS:
        return _run(SUBCOMMANDS[cmd], tail)

    print(f"❌ Unknown subcommand: {cmd!r}\n\n{USAGE}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
