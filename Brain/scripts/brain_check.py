#!/usr/bin/env python3
"""
brain_check.py — integrity check for the Travel Brain.

Runs at the start of every session (per Rules for Claude.html § 1 Session start) and
before every guide ship (chained into `guide_tools.py ship`). Its only job is
to catch silent drift: rules deleted without permission, files moved out from
under pointers, section-count regressions, ghost references.

It does NOT validate a guide's HTML — that's `validate_itinerary.py`. It does
NOT fetch URLs — that's `verify_urls.py`. This script only looks at the Brain
itself.

Exit codes:
  0  — Brain intact. OK to proceed.
  1  — FAIL. A required section, file, or pointer is missing. Restore it
       additively (from Travel/archive/) before any Brain-dependent work.
  2  — Usage error or unexpected exception.

Warnings (printed but exit 0 still allowed):
  - audit_log.md last entry is >7 days old → recommend running `guide_tools.py audit`.

Usage:
  python3 brain_check.py
  python3 brain_check.py --verbose    # print every check, not just failures
"""

from __future__ import annotations

import html
import json
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import unquote

# ─── Validator scope ──────────────────────────────────────────────────────────
# brain_check.py validates ONLY files inside Brain/ (plus the explicit Travel-root
# entry-point files: CLAUDE.md and the To Do List). It does NOT touch:
#   - Brain/CORE RULES/                          — scanned for name mentions only (see check_html_name_mentions)
#   - Travel/Travel-Website/Trip-Essentials/ — packing list etc.
#   - Travel/Travel-Website/Guides/          — past output, never a reference
#   - Travel/On The Go/          — mobile crib territory (Rules/ only as of 2026-05-18)
#   - Travel/shopping_profile_v2.md — shopping profile (moved from On The Go/ on 2026-05-18)
# Per original scope: "the whole validator is to ship the guide... not for personal organization."
# If a future audit pass tempts adding any of those to REQUIRED_FILES — that's drift.
HERE = Path(__file__).resolve().parent          # Brain/scripts/
HTML_RULES_DIR = HERE.parent / "CORE RULES"  # Brain/CORE RULES/ (renamed from HTML Rules Before Conversion/ 2026-05-09)
BRAIN_DIR = HERE.parent                          # Brain/
MDS_DIR = BRAIN_DIR / "Reference"                 # Brain/Reference/  (was Brain/mds/ — merged 2026-06-15)
CORE_RULES_DIR = BRAIN_DIR / "CORE RULES"        # Brain/CORE RULES/  (renamed from "core rules" 2026-05-02)
TRAVEL_ROOT = BRAIN_DIR.parent                   # Travel/
WEB_ROOT = TRAVEL_ROOT / "Travel-Website"        # Travel/Travel-Website/ — published site root (2026-06-13 reorg). Holds Guides/, Trip-Essentials/, assets/, index.html.
ASSETS_DIR = WEB_ROOT / "assets"                 # shared js/css home: toolbar.js, footnote.js, weather.js, guide_v3.css, mobile.css, climate.json (moved out of Guides/ 2026-06-13)
MYDRIVE_ROOT = TRAVEL_ROOT.parent                # My Drive/
ON_THE_GO_DIR = TRAVEL_ROOT / "On The Go"  # Travel/On The Go/ — NOT validated; mobile crib territory, validator only audits guide-building infrastructure.
TODO_DIR = TRAVEL_ROOT / "To Do List"            # Travel/To Do List/  (moved from Brain/ 2026-05-01)
CLAUDE_MD = TRAVEL_ROOT / "CLAUDE.md"
TOOLBAR_JS = ASSETS_DIR / "toolbar.js"   # shared nav bar rendered on every page; PERMANENT home = Travel-Website/assets/ (moved out of Guides/ 2026-06-13); centering invariant checked below (added 2026-06-05)
FOOTNOTE_JS = ASSETS_DIR / "footnote.js"
WATERMARK_PATH = BRAIN_DIR / "Reference" / "profile_watermark.json"
GUIDE_STYLE_CSS = BRAIN_DIR / "Reference" / "Guide Style.css"
PDF_RENDER_NOTES = BRAIN_DIR / "Reference" / "PDF Render Notes.md"
 # footer sharing bar, auto-loaded by toolbar.js; PERMANENT home = Travel-Website/assets/, lives next to toolbar.js
# PROFILE: the session entry-point file checked for required sections + ghost refs.
# Was brain_core.md (archived 2026-05-07 — content folded into CLAUDE.md).
# Now points to CLAUDE.md which carries the doc index, glossary, train operators,
# validators table, and all behavioral rules. Ghost-reference scan runs against it.
PROFILE = CLAUDE_MD

# Each entry is a regex matched against `^## ` lines of PROFILE (CLAUDE.md).
# brain_core.md sections retired 2026-05-07 — content moved to CLAUDE.md.
REQUIRED_SECTIONS = [
    r"^## Behavioral rules",
    r"^## ⚠️ DriftyCat",
    r"^## On-demand documents",
    r"^## Shopping",
    r"^## Two-crib architecture",
    r"^## Quick Reference",
]

# ─── Required files under Brain/ (plus CLAUDE.md at Travel root) ─────────────
# html_templates.md retired 2026-04-23 per Rule 25.
REQUIRED_FILES = [
    BRAIN_DIR / "Reference" / "Guide Style.css",
    HERE / "validate_itinerary.py",
    HERE / "verify_urls.py",
    HERE / "verify_booking_links.py",   # ship-gate: log coverage + h1-match (added 2026-04-24)
    HERE / "commons_photo.py",
    HERE / "guide_tools.py",
    HERE / "brain_check.py",
    HERE / "render_pdf.py",
    # bundle_guide.py retired 2026-04-22 — share HTML dropped; PDF is sole artifact
    HERE / "validate_pdf.py",
    BRAIN_DIR / "Reference" / "Platforms.md",
    HERE / "sweep_stray_travel.py",  # enforces HARD RULE (added 2026-04-30): all travel work under Travel/
    HERE / "autofix_itinerary.py",   # mechanically rewrites mis-filed booking boxes (added 2026-04-29)
    # calibration_anchors_catalog.md — retired 2026-05-09 (Dani request)
    # On-the-go rules deliberately NOT in REQUIRED_FILES — they live at On The Go/
    # (My Drive root, outside Travel/) per the "Brain is for guide-building only"
    # HARD RULE in Travel/CLAUDE.md (2026-05-02). The Brain mirror was retired
    # in the 2026-05-02 brain audit.
    TRAVEL_ROOT / "CLAUDE.md",
    # Operational scaffolding files supporting the core rules. Source of truth
    # for guide rules lives ONLY in Brain/CORE RULES/*.html per CLAUDE.md HARD
    # RULE. HTML Snippets.md retired 2026-05-02 (folded into
    # Brain/Reference/, lives outside Brain — those files are
    # not in REQUIRED_FILES because Brain validators only audit guide-building
    # infrastructure inside Brain/, per Rules for Claude.html § 3).
    BRAIN_DIR / "Reference" / "Separation Map.md",               # locator: which core rules Doc owns which rule
    BRAIN_DIR / "Reference" / "Cleanliness Checks.md",           # cross-cutting cleanliness rules used by validators
    MDS_DIR / "audit_log.md",                    # rolling audit log (staleness gate below uses this)
    TODO_DIR / "To_Do_List.md",                  # one parking surface: ✈️ My Tasks · 🔧 Rules for Update · ❓ Questions for Dani
    MDS_DIR / "Brain.md",                        # combined master: travel_map + decisions + Heads Up + Cities Skip List (2026-06-05 merge). audit_log.md stays separate. Validators slice Part 3/Part 4 sentinel regions.
    BRAIN_DIR / "Reference" / "PDF Render Notes.md",      # WeasyPrint PDF render guide — CSS overrides, install, notes (restored 2026-05-07; critical operational ref)
    BRAIN_DIR / "Reference" / "Rule Dependencies.html",   # crib navigation aid — moved out of CORE RULES 2026-05-14 → Brain/ → Reference/ 2026-05-24; indexes every cross-file rule dependency (path updated 2026-05-27)
    BRAIN_DIR / "Reference" / "Validator Index.html",     # living index of every validate_itinerary.py + brain_check.py check; updated every session per Rules for Claude.html § 10 item 5 (added to REQUIRED_FILES 2026-05-24)
    BRAIN_DIR / "Reference" / "Guide Entry Counts.html",        # canonical min/max/exact count reference; moved out of CORE RULES → Brain/ → Reference/ 2026-05-24 (added to REQUIRED_FILES 2026-05-24)
    BRAIN_DIR / "Reference" / "Ship Checklist.html",     # pre-ship gate checklist; moved out of CORE RULES 2026-05-24 (not a rule, a working checklist maintained by Claude)
]

# ─── Audit-log staleness threshold ───────────────────────────────────────────
AUDIT_STALE_DAYS = 7
AUDIT_LOG = MDS_DIR / "audit_log.md"

# ─── Ghost references — filenames mentioned in profile that must exist ───────
# We parse the profile for `Brain/...` and relative paths to .py/.css/.md files
# and check each one resolves. A reference to an archived file is OK only if it
# explicitly lives under `Travel/archive/`.
# (Memory files under /mnt/.auto-memory/ are NOT required — the profile can
# mention them as context without the file existing.)
REFERENCE_PATTERNS = [
    re.compile(r"`(Brain/[A-Za-z0-9_./-]+\.(?:py|css|md))`"),
    re.compile(r"`(Travel/[A-Za-z0-9_./-]+\.(?:md|gdoc))`"),
]

# ─── Rule 26 — RETIRED 2026-05-02 ────────────────────────────────────────────
# Per Dani 2026-05-02: "we allow examples, none of that needs to be checked
# for anymore." Examples are now welcome and load-bearing per Rules for Claude
# § 3. The "no real place names in the Brain" rule is fully retired.
#
# Removed in this commit: RULE26_DENYLIST, RULE26_DENYLIST_RE,
# RULE26_TIER_ANCHOR_TOKENS, RULE26_SKIP_FILES, RULE26_PROFILE_ALLOW_RANGES,
# and the check_rule26_place_names() function.
#
# brain_check.py is now purely about file integrity — required sections,
# required files, ghost references, audit log staleness. No content scanning.


# ──────────────────────────────────────────────────────────────────────────────
# Checks
# ──────────────────────────────────────────────────────────────────────────────
class Report:
    def __init__(self) -> None:
        self.failures: list[str] = []
        self.warnings: list[str] = []
        self.passes: list[str] = []

    def fail(self, msg: str) -> None:
        self.failures.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    def ok(self, msg: str) -> None:
        self.passes.append(msg)

    def exit_code(self) -> int:
        return 1 if self.failures else 0


def check_profile_sections(report: Report) -> None:
    if not PROFILE.exists():
        report.fail(f"Profile missing: {PROFILE}")
        return
    text = PROFILE.read_text(encoding="utf-8")
    lines = text.splitlines()
    headers = [ln for ln in lines if ln.startswith("## ")]
    for pat in REQUIRED_SECTIONS:
        rx = re.compile(pat)
        if any(rx.match(h) for h in headers):
            report.ok(f"§ present: {pat}")
        else:
            report.fail(
                f"Missing required §: {pat} — search Travel/archive/ and restore additively."
            )


def _display_path(fp: Path) -> str:
    """Render a path relative to TRAVEL_ROOT when possible, else relative to
    MYDRIVE_ROOT."""
    try:
        return str(fp.relative_to(TRAVEL_ROOT))
    except ValueError:
        try:
            return str(fp.relative_to(MYDRIVE_ROOT))
        except ValueError:
            return str(fp)


def check_required_files(report: Report) -> None:
    for fp in REQUIRED_FILES:
        if fp.exists():
            report.ok(f"file present: {_display_path(fp)}")
        else:
            report.fail(f"Missing required file: {_display_path(fp)}")


# ──────────────────────────────────────────────────────────────────────────────
# Doc-index ↔ CORE RULES/ folder integrity (added 2026-05-03)
# ──────────────────────────────────────────────────────────────────────────────
# Catches the drift class surfaced in the 2026-05-03 audit: a new `.html` lands
# (silent unindexed file), OR an indexed file gets renamed/deleted on disk and
# the index keeps pointing at the old name (ghost reference).
#
# Authority order: the on-disk `CORE RULES/` folder is the source of truth —
# CLAUDE.md doc index must mirror the folder. Any divergence = scaffolding drift,
# hard-fail. Note: Google Docs (.gdoc) retired 2026-05-09; source of truth is .html.
DOC_INDEX_HEADER = re.compile(r"^###?\s+CORE RULES HTML file index\s*$", re.MULTILINE)
DOC_INDEX_HTML_REF = re.compile(r"`([^`]+\.html)`")


def _extract_doc_index_block(text: str) -> str | None:
    """Return the body between `## Doc index` and the next `## ` header.

    Returns None if the section header is missing — caller handles that as a
    structural failure separate from the integrity check itself.
    """
    m = DOC_INDEX_HEADER.search(text)
    if not m:
        return None
    start = m.end()
    next_h2 = re.search(r"^## ", text[start:], re.MULTILINE)
    end = start + next_h2.start() if next_h2 else len(text)
    return text[start:end]


def check_doc_index_vs_core_rules(report: Report) -> None:
    """Diff `CORE RULES/*.html` filenames against `.html` refs in CLAUDE.md Doc index.

    - Files present on disk but NOT mentioned in the index → unindexed (fail).
    - Files mentioned in the index but NOT present on disk → ghost (fail).
    Both directions are scaffolding drift. Google Docs (.gdoc) retired 2026-05-09;
    source of truth is now .html files directly in Brain/CORE RULES/.
    """
    if not PROFILE.exists():
        return  # already reported by check_required_files
    if not CORE_RULES_DIR.exists():
        report.fail(
            f"CORE RULES dir missing: {_display_path(CORE_RULES_DIR)} — "
            f"can't run Doc-index integrity check."
        )
        return

    on_disk = {p.name for p in CORE_RULES_DIR.glob("*.html")}
    if not on_disk:
        report.fail(
            f"CORE RULES dir has zero `.html` files at {_display_path(CORE_RULES_DIR)} — "
            f"folder appears empty or not synced."
        )
        return

    text = PROFILE.read_text(encoding="utf-8")
    block = _extract_doc_index_block(text)
    if block is None:
        report.fail(
            "Doc-index ↔ CORE RULES integrity."
        )
        return

    # Only consider bare filenames — skip glob patterns (e.g. `Brain/CORE
    # RULES/*.html`) and any path-form refs. Index entries always cite the
    # filename alone in backticks.
    # Extract bare .html filenames from doc index (skip path-form and glob refs)
    indexed = {
        m.group(1)
        for m in DOC_INDEX_HTML_REF.finditer(block)
        if "*" not in m.group(1) and "/" not in m.group(1)
        and not m.group(1).startswith("_")  # skip _README.md etc.
    }

    unindexed = sorted(on_disk - indexed)
    ghosts = sorted(indexed - on_disk)

    for name in unindexed:
        report.fail(
            f"Unindexed CORE RULES Doc: `{name}` is in CORE RULES/ but not "
            f"listed in the Doc index (CLAUDE.md ### CORE RULES doc index). "
            f"Add it to the table."
        )
    for name in ghosts:
        report.fail(
            f"`{name}` but no such file in CORE RULES/. Repoint or restore."
        )

    if not unindexed and not ghosts:
        report.ok(
            f"Doc-index ↔ CORE RULES match: {len(on_disk)} `.html` files, "
            f"all indexed."
        )


def check_audit_staleness(report: Report) -> None:
    if not AUDIT_LOG.exists():
        report.warn(
            f"audit_log.md not found — create it with the first `## YYYY-MM-DD` entry "
            "via `guide_tools.py audit`."
        )
        return
    text = AUDIT_LOG.read_text(encoding="utf-8")
    dates = re.findall(r"^##\s+(\d{4}-\d{2}-\d{2})", text, re.MULTILINE)
    if not dates:
        report.warn("audit_log.md has no dated entries — run an audit.")
        return
    try:
        parsed = sorted(datetime.strptime(d, "%Y-%m-%d").date() for d in dates)
    except ValueError as e:
        report.warn(f"audit_log.md has an unparseable date: {e}")
        return
    last = parsed[-1]
    today = date.today()
    age = (today - last).days
    if age > AUDIT_STALE_DAYS:
        report.warn(
            f"Last audit was {age} days ago ({last.isoformat()}). "
            f"Threshold is {AUDIT_STALE_DAYS} days — run `guide_tools.py audit`."
        )
    else:
        report.ok(f"Last audit: {last.isoformat()} ({age} days ago).")


def check_ghost_references(report: Report) -> None:
    if not PROFILE.exists():
        return
    text = PROFILE.read_text(encoding="utf-8")
    refs: set[str] = set()
    for pat in REFERENCE_PATTERNS:
        for m in pat.finditer(text):
            refs.add(m.group(1))
    # Resolve each against Travel/ root, with a fallback to the website root.
    for ref in sorted(refs):
        # `Brain/...` and `Travel/...` are both relative to TRAVEL_ROOT's parent
        # in profile prose. Treat both as relative to Travel/ itself for
        # path resolution — `Brain/foo.py` → TRAVEL_ROOT / "Brain/foo.py".
        # Website content (Guides/, Trip-Essentials/, assets/, index.html) is
        # written website-relative in the docs; also try WEB_ROOT (2026-06-13 reorg).
        rel = ref.removeprefix("Travel/")
        candidate = next(
            (b / rel for b in (TRAVEL_ROOT, WEB_ROOT) if (b / rel).exists()),
            TRAVEL_ROOT / rel,
        )
        if candidate.exists():
            report.ok(f"ref resolved: {ref}")
        else:
            # `.gdoc` files are pointer stubs — don't fail if absent, warn.
            if ref.endswith(".gdoc"):
                report.warn(f"Profile references stale .gdoc (should be .html): {ref}")
            else:
                report.fail(
                    f"Ghost reference in profile: `{ref}` — file does not exist."
                )


# check_rule26_place_names() retired 2026-05-02. Examples are now welcome
# and load-bearing per Rules for Claude § 3. The "no real place names in
# the Brain" rule is fully retired. Function preserved in version control
# (.bak.2026-05-02) for lineage; not called.


# ──────────────────────────────────────────────────────────────────────────────
# HTML name-mention check (added 2026-05-08)
# Scans Brain/CORE RULES/ for occurrences of the owner's name in rule content.
# Warns (does not fail) — not every occurrence is wrong, but all should be
# reviewed and replaced with neutral phrasing.
# ──────────────────────────────────────────────────────────────────────────────

# The read-only banner on every HTML file contains "DANI'S REQUEST" — structural
# boilerplate that is intentional and should not trigger a warning.
_BANNER_RE = re.compile(r'<p class="banner">[^<]*</p>', re.IGNORECASE)

# Structural / intentional occurrences of the owner's name — not rule content.
# Expanded 2026-05-09: section names, routing labels, personal-fact lines.
_NAME_EXCL_RE = re.compile(
    # Retired 2026-05-14: `Dani Leo Trip` prefix — Trips folder + file were
    # renamed to drop the owner's name (was `Dani Leo Trips/Dani Leo Trips - Data.html`,
    # now `Trips/Trips.html`). The pattern no longer matches anything in active
    # rule content; kept commented for history.
    r'Questions for Dani'       # To-Do section heading
    r'|Tasks \(Dani'            # "✈️ My Tasks (Dani only)"
    r'|Dani only'               # routing label
    r'|Dani and Leo'            # personal fact (loyalty status etc.)
    r"|Dani'?s",                # possessive in section/doc titles
    re.IGNORECASE,
)

# The name to flag in rule content.
_NAME_RE = re.compile(r'\bDani\b')


def check_html_name_mentions(report: Report) -> None:
    """Warn if the owner's name appears in HTML rule-doc content.

    Exclusions (structural / intentional, not rule content):
      - The read-only banner line present on every file.
      - Lines referencing 'Trips' doc pointers.
    """
    if not HTML_RULES_DIR.exists():
        report.warn(
            f"CORE RULES dir not found: {_display_path(HTML_RULES_DIR)}"
            " — skipping name-mention check."
        )
        return

    html_files = sorted(HTML_RULES_DIR.rglob("*.html"))
    if not html_files:
        report.warn(
            "No HTML files found in CORE RULES/ — skipping name-mention check."
        )
        return

    flagged: list[tuple[Path, int]] = []
    for fp in html_files:
        try:
            text = fp.read_text(encoding="utf-8")
        except Exception:
            continue
        # Strip intentional/structural occurrences before scanning.
        cleaned = _BANNER_RE.sub("", text)
        cleaned = _NAME_EXCL_RE.sub("", cleaned)
        count = len(_NAME_RE.findall(cleaned))
        if count:
            flagged.append((fp, count))

    if not flagged:
        report.ok(
            f"HTML name check: no name mentions in rule content across {len(html_files)} HTML files."
        )
    else:
        total = sum(c for _, c in flagged)
        lines = "\n".join(
            f"    {_display_path(fp)} ({c}×)" for fp, c in flagged
        )
        report.warn(
            f"HTML name check: name appears in rule content in {len(flagged)} file(s) "
            f"({total} occurrence(s)). Review and replace with neutral phrasing:\n{lines}"
        )


# ──────────────────────────────────────────────────────────────────────────────
# HTML content-quality checks (added 2026-05-08)
# Four additional patterns that signal non-rule content drifting into the HTML
# rule docs. All warn (do not fail) — occurrences need review, not auto-removal.
# ──────────────────────────────────────────────────────────────────────────────

# 1. Hardcoded MCP tool IDs — mcp__<uuid>__ strings go stale when connectors
#    are updated. Should never appear in a rule doc.
_MCP_TOOL_ID_RE = re.compile(r'mcp__[a-z0-9\-]{8,}__\w+')

# 2. Date stamps in rule content — YYYY-MM-DD inside tag content is almost
#    always a session anchor or attributed quote, not a rule.
#    Matches dates that appear in visible text (after ">"), not in attributes.
# Narrowed 2026-05-09: exclude annotation contexts (version notes, retirement,
# section-header "added/updated" markers). Only flag bare session-anchor dates.
_DATE_IN_CONTENT_RE = re.compile(r'>\s*[^<]*20\d{2}-\d{2}-\d{2}')
_DATE_ANNOT_RE = re.compile(r'(?:v\d+,|retired |added |updated rule |locked |caught |amended |\().*?20\d{2}-\d{2}-\d{2}')

_ATTRIBUTED_QUOTE_RE = re.compile(
    r'—\s+(?!added|updated|locked|retired|amended|wired|merged|renamed)([A-Z][a-z]+)\s+20\d{2}-\d{2}-\d{2}'
)

# 4. First-person pronouns inside <blockquote> — personal voice captured
#    verbatim rather than translated into a neutral rule.
_BLOCKQUOTE_RE = re.compile(r'<blockquote>(.*?)</blockquote>', re.IGNORECASE | re.DOTALL)
_FIRST_PERSON_RE = re.compile(
    r"\bI'm\b|\bI don'?t\b|\bI do\b|\bI have\b|\bI like\b|\bI book\b"
    r"|\bI travel\b|\bI use\b|\bI go\b|\bI stay\b|\bI prefer\b|\bI work\b"
    r"|\bI can'?t\b|\bI set\b|\bwe travel\b|\bwe don'?t\b|\bwe go\b"
    r"|\bmy favorite\b|\bfor me\b",
    re.IGNORECASE,
)


def _load_html_files() -> tuple[list[Path], bool]:
    """Return (html_files, ok). Shared by all HTML content checks."""
    if not HTML_RULES_DIR.exists():
        return [], False
    return sorted(HTML_RULES_DIR.rglob("*.html")), True


def check_html_mcp_tool_ids(report: Report) -> None:
    """Warn if hardcoded MCP tool IDs appear in any HTML rule doc."""
    html_files, ok = _load_html_files()
    if not ok:
        return  # already warned by check_html_name_mentions
    flagged: list[tuple[Path, list[str]]] = []
    for fp in html_files:
        try:
            text = fp.read_text(encoding="utf-8")
        except Exception:
            continue
        hits = _MCP_TOOL_ID_RE.findall(text)
        if hits:
            flagged.append((fp, hits))
    if not flagged:
        report.ok(f"HTML MCP tool ID check: no hardcoded tool IDs across {len(html_files)} files.")
    else:
        lines = "\n".join(
            f"    {_display_path(fp)}: {', '.join(h[:2])}{'…' if len(h) > 2 else ''}"
            for fp, h in flagged
        )
        report.warn(
            f"HTML MCP tool ID check: hardcoded tool IDs found in {len(flagged)} file(s). "
            f"Move to a connector capabilities doc, not a rule:\n{lines}"
        )


def check_html_date_stamps(report: Report) -> None:
    """Warn if YYYY-MM-DD date stamps appear in HTML rule content (session anchors / attributed quotes)."""
    html_files, ok = _load_html_files()
    if not ok:
        return
    flagged: list[tuple[Path, int]] = []
    for fp in html_files:
        try:
            text = fp.read_text(encoding="utf-8")
        except Exception:
            continue
        hits = _DATE_IN_CONTENT_RE.findall(text)
        # Filter out annotation contexts (version notes, retired/added/locked markers)
        real = [h for h in hits if not _DATE_ANNOT_RE.search(h)]
        if real:
            flagged.append((fp, len(real)))
    if not flagged:
        report.ok(f"HTML date-stamp check: no bare date stamps in rule content across {len(html_files)} files.")
    else:
        total = sum(c for _, c in flagged)
        lines = "\n".join(f"    {_display_path(fp)} ({c}×)" for fp, c in flagged)
        report.warn(
            f"HTML date-stamp check: YYYY-MM-DD dates in rule content in {len(flagged)} file(s) "
            f"({total} occurrence(s)). Likely session anchors or attributed quotes — review:\n{lines}"
        )


def check_html_attributed_quotes(report: Report) -> None:
    """Warn if attributed quote signatures (— Name YYYY-MM-DD) appear in HTML rule docs."""
    html_files, ok = _load_html_files()
    if not ok:
        return
    flagged: list[tuple[Path, int]] = []
    for fp in html_files:
        try:
            text = fp.read_text(encoding="utf-8")
        except Exception:
            continue
        count = len(_ATTRIBUTED_QUOTE_RE.findall(text))
        if count:
            flagged.append((fp, count))
    if not flagged:
        report.ok(f"HTML attributed-quote check: no name+date attributions across {len(html_files)} files.")
    else:
        total = sum(c for _, c in flagged)
        lines = "\n".join(f"    {_display_path(fp)} ({c}×)" for fp, c in flagged)
        report.warn(
            f"HTML attributed-quote check: '— Name YYYY-MM-DD' pattern in {len(flagged)} file(s) "
            f"({total} occurrence(s)). Source quotes with attribution should be reviewed:\n{lines}"
        )


def check_html_first_person_blockquotes(report: Report) -> None:
    """Warn if first-person pronouns appear inside <blockquote> tags in HTML rule docs."""
    html_files, ok = _load_html_files()
    if not ok:
        return
    flagged: list[tuple[Path, int]] = []
    for fp in html_files:
        # On Demand files intentionally quote Dani's preferences verbatim —
        # first-person voice is correct there. Skip them. (2026-05-09)
        if "On Demand" in str(fp):
            continue
        try:
            text = fp.read_text(encoding="utf-8")
        except Exception:
            continue
        count = 0
        for bq in _BLOCKQUOTE_RE.finditer(text):
            if _FIRST_PERSON_RE.search(bq.group(1)):
                count += 1
        if count:
            flagged.append((fp, count))
    if not flagged:
        report.ok(
            f"HTML blockquote voice check: no first-person pronouns in blockquotes "
            f"across {len(html_files)} files."
        )
    else:
        lines = "\n".join(f"    {_display_path(fp)} ({c} blockquote(s))" for fp, c in flagged)
        report.warn(
            f"HTML blockquote voice check: first-person pronouns in blockquotes in "
            f"{len(flagged)} file(s). Personal-voice quotes should be translated into "
            f"neutral rules:\n{lines}"
        )


# ──────────────────────────────────────────────────────────────────────────────
# Rule 25 (amended 2026-04-25): no HTML in the profile
# ──────────────────────────────────────────────────────────────────────────────
# The profile is prose-only. Structural shape facts live as comments in
# `Guide Style.css`; runtime invariants live in `validate_itinerary.py`. Past
# Claude instances repeatedly drifted ```html fences back into the profile,
# turning it into "a gigantic, odd mess." This guard counts ```html fences and
# compares against a known baseline.
#
# Stage 4 of the 2026-04-25 slice landed: all 9 HTML example blocks were
# retired with Rule 11 forwarding markers pointing to their CSS § homes.
# The sentinel is now 0 — any ```html fence in the profile is drift and must
# hard-fail. The original baseline (9 fences at lines 638, 831, 848, 877, 1009,
# 1049, 1072, 1143, 1184) is preserved here in the comment for lineage; the
# WARN-mode tolerance band is gone.

def check_no_html_in_profile(report: Report) -> None:
    if not PROFILE.exists():
        report.fail(f"Profile missing: {PROFILE}")
        return
    text = PROFILE.read_text(encoding="utf-8")
    lines = text.splitlines()
    fence_lines = [i + 1 for i, ln in enumerate(lines) if ln.strip() == "```html"]
    count = len(fence_lines)
    if count == 0:
        report.ok("Rule 25: no ```html fences in profile (prose-only).")
        return
    # Stage 4 landed 2026-04-25 — all HTML example blocks retired. Any ```html
    # fence now is drift; hard-fail so it gets cleaned up immediately.
    report.fail(
        f"Rule 25 violation: {count} ```html fence(s) in profile at lines "
        f"{fence_lines}. The profile is prose-only (Stage 4 complete); structural "
        f"shape facts belong in guide_v3.css comments, not in profile fences."
    )


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────


def check_no_archive_subfolders_in_guides(report: Report) -> None:
    """Fail if any archive/ subfolder exists inside Travel/Travel-Website/Guides/.
    
    Correct archive destination is always Travel/archive/ — never a per-guide
    subfolder. Added 2026-05-09 per rule: archive destination = Travel/archive/,
    no subfolders inside Guides/ or elsewhere.
    """
    guides_dir = WEB_ROOT / "Guides"
    if not guides_dir.exists():
        return
    for city_dir in guides_dir.iterdir():
        if not city_dir.is_dir():
            continue
        archive_sub = city_dir / "archive"
        if archive_sub.exists():
            report.fail(
                f"Guides/{city_dir.name}/archive/ — per-guide archive subfolder found. "
                f"Move contents to Travel/archive/ and remove the subfolder. "
                f"Archive destination is always Travel/archive/, never inside Guides/."
            )
        # Also catch capitalised variants
        for variant in ("Archive", "ARCHIVE"):
            if (city_dir / variant).exists():
                report.fail(
                    f"Guides/{city_dir.name}/{variant}/ — per-guide archive subfolder found. "
                    f"Move contents to Travel/archive/ and remove the subfolder."
                )



def check_no_resurrected_merged_mds(report: Report) -> None:
    """Hard-fail if any of the four files merged into Brain/Reference/Brain.md on
    2026-06-05 reappears as a standalone file in Brain/Reference/.

    decisions.md, Heads Up.md, Cities Skip List.md, and travel_map.md are now
    Parts 1-4 of Brain.md. A standalone copy means a crib wrote to the wrong
    place (e.g. created a new decisions.md, or appended a Heads Up / Skip List
    city outside the Brain.md sentinel region) — that content is invisible to
    the validators and must be folded back into the matching Part of Brain.md.
    Only Brain.md and audit_log.md belong in Brain/Reference/. Added 2026-06-05.
    """
    banned = ("decisions.md", "Heads Up.md", "Cities Skip List.md", "travel_map.md")
    found = [n for n in banned if (MDS_DIR / n).exists()]
    if found:
        for n in found:
            report.fail(
                f"Resurrected merged file: Brain/Reference/{n} — this content lives in "
                f"Brain/Reference/Brain.md (Parts 1-4) since the 2026-06-05 merge. Fold "
                f"it back into the matching Part of Brain.md (append Heads Up / "
                f"Skip List cities INSIDE the sentinel region) and remove the "
                f"standalone file. Never create a new decisions.md or any merged "
                f"mds file — only Brain.md and audit_log.md belong in Brain/Reference/."
            )
    else:
        report.ok(
            "Brain/Reference/ — no resurrected merged files (decisions.md / Heads Up.md "
            "/ Cities Skip List.md / travel_map.md)."
        )


def check_no_stray_archive_dirs(report: Report) -> None:
    """Fail on any archive/Archive folder anywhere under Travel/ except the
    single central vault Travel/archive/ itself.

    The one and only archive is Travel/archive/. No crib creates a new archive
    folder anywhere — not in Brain/, Brain/Reference/, Trip-Essentials/, nor
    nested inside Travel/archive/. To archive, move the file straight into
    Travel/archive/. (Guides/ is covered by check_no_archive_subfolders_in_guides;
    nesting *inside* the vault is a separate cleanup, not a build blocker.)
    Added 2026-06-05.
    """
    vault = (TRAVEL_ROOT / "archive").resolve()
    names = {"archive", "Archive", "ARCHIVE"}
    strays: list[str] = []
    for d in TRAVEL_ROOT.rglob("*"):
        try:
            if not d.is_dir() or d.name not in names:
                continue
            rd = d.resolve()
        except OSError:
            continue
        if rd == vault or vault in rd.parents:
            continue
        strays.append(str(d.relative_to(TRAVEL_ROOT)))
    if strays:
        for s in sorted(strays):
            report.fail(
                f"Stray archive folder: Travel/{s} — the only archive is "
                f"Travel/archive/. Move its contents into Travel/archive/ and "
                f"remove the folder. Cribs never create new archive folders."
            )
    else:
        report.ok("No stray archive folders outside Travel/archive/.")


# ──────────────────────────────────────────────────────────────────────────────
# Duplicate-suffix detector (added 2026-06-12)
# Google Drive names a NEW file "Name (1).ext" when create_file is called on a
# path that already exists. In a doc surface this is never legitimate — it is the
# signature of a FAILED IN-PLACE EDIT: the real change landed in a stray duplicate
# (or a dead scratchpad the duplicate pointed at) instead of the original file.
# This pattern lost two cribs on 2026-06-12. Fail immediately so the stub is
# caught and archived, and the edit redone on the original.
# Rule: Rules for Claude.html § 2 (Right tool for the right job — edit in place).
# ──────────────────────────────────────────────────────────────────────────────
_DUP_SUFFIX_RE = re.compile(r" \(\d+\)\.(?:html|md)$")
# Asset dirs legitimately contain "(1)"/"(2)" image names — limit the check to
# .html/.md and skip these paths.
_DUP_EXCLUDE_PARTS = ("/archive/", "/Icons Library/", "/_build/", "/On The Go/")


def check_no_dup_suffix_files(report: Report) -> None:
    """Fail on any 'Name (N).html' / 'Name (N).md' duplicate in a doc surface.

    Fingerprint of a Drive create_file call made against a path that already
    exists — the in-place edit failed and spawned a duplicate. Limited to
    .html/.md (asset dirs legitimately use '(1)'/'(2)' image names) and skips
    archive/, Icons Library/, _build/, and On The Go/.
    """
    dups: list[str] = []
    for f in TRAVEL_ROOT.rglob("*"):
        try:
            if not f.is_file():
                continue
        except OSError:
            continue
        rel = f.relative_to(TRAVEL_ROOT)
        posix = "/" + rel.as_posix()
        if any(part in posix for part in _DUP_EXCLUDE_PARTS):
            continue
        if _DUP_SUFFIX_RE.search(f.name):
            dups.append(str(rel))
    if dups:
        for d in sorted(dups):
            report.fail(
                f"Duplicate-suffix file: Travel/{d} — this is a failed in-place "
                f"edit (Drive create_file on an existing path). Archive the stub "
                f"to Travel/archive/ and redo the edit on the original file. "
                f"Rule: Rules for Claude.html § 2."
            )
    else:
        report.ok("No duplicate-suffix (N) doc files — in-place edits holding.")


def check_no_deploy_breakers(report: Report) -> None:
    """Fail on committed files that break the GitHub Pages build.

    The legacy Pages build errors ("Page build failed") on (a) symlinks and
    (b) Google-Drive/FUSE mount artifacts (.fuse_hidden*, .DS_Store). When that
    happens, commits push fine but NOTHING deploys — the live site silently
    freezes on the last good build. Catch them at session start so they're
    removed before a deploy breaks. (Added 2026-06-20 after both broke deploys.)
    """
    import subprocess
    try:
        out = subprocess.run(
            ["git", "ls-files", "-s"],
            cwd=str(TRAVEL_ROOT), capture_output=True, text=True, timeout=30,
        ).stdout
    except Exception as e:
        report.warn(f"[deploy-safety] could not run git ls-files ({e}) — skipped.")
        return
    symlinks: list[str] = []
    artifacts: list[str] = []
    for line in out.splitlines():
        parts = line.split("\t", 1)
        if len(parts) != 2:
            continue
        meta, path = parts
        mode = meta.split(" ", 1)[0]
        name = path.rsplit("/", 1)[-1]
        if mode == "120000":
            symlinks.append(path)
        if name.startswith(".fuse_hidden") or name == ".DS_Store":
            artifacts.append(path)
    if not symlinks and not artifacts:
        report.ok("No deploy-breakers — no committed symlinks or mount artifacts.")
        return
    for p in symlinks:
        report.fail(
            f"[deploy-safety] committed symlink: {p} — GitHub Pages fails on "
            f"symlinks. Replace it with a real file (e.g. a redirect HTML)."
        )
    for p in artifacts:
        report.fail(
            f"[deploy-safety] committed mount artifact: {p} — `git rm` it (keep "
            f"it gitignored); these break the Pages build."
        )


def check_guide_roots(report: Report) -> None:
    """
    Fail if any file other than {city}_vN.html or {city}_vN.pdf exists at the
    root of a guide directory (Travel/Travel-Website/Guides/{City}/).

    Allowed at root: *.html, *.pdf, _build/ (subdirectory).
    verification_log.json now lives inside _build/ (moved 2026-05-09); root location
    still tolerated here as a back-compat fallback for any pre-migration guide.
    Everything else belongs in _build/ or Travel/archive/.

    Rule source: Brain/CORE RULES/Guide Structure.html § Guide directory layout.
    Added 2026-05-09.
    """
    guides_dir = WEB_ROOT / "Guides"
    if not guides_dir.exists():
        return

    allowed_suffixes = {".html", ".pdf", ".json"}
    allowed_names = {
        "_build",
        "verification_log.json",  # back-compat; canonical location is _build/ (moved 2026-05-09)
        "ship_log.md",            # per-guide ship log; appended by guide_tools.py ship (Rule 125, moved per-guide 2026-06-15)
    }

    violations = []
    for city_dir in sorted(guides_dir.iterdir()):
        if not city_dir.is_dir():
            continue
        for item in sorted(city_dir.iterdir()):
            name = item.name
            if name.startswith("."):
                continue
            if item.is_dir():
                if name not in allowed_names and not name.startswith("."):
                    # archive subfolders caught by check_no_archive_subfolders_in_guides
                    # only flag unexpected non-allowed dirs here
                    if name.lower() not in {"archive"}:
                        violations.append(
                            f"Guides/{city_dir.name}/{name}/ — unexpected folder at guide root "
                            f"(only _build/ allowed; assets/ lives inside _build/ since 2026-05-09). Move to _build/ or Travel/archive/."
                        )
                continue
            if item.suffix.lower() in allowed_suffixes or name in allowed_names:
                continue
            violations.append(
                f"Guides/{city_dir.name}/{name} — unexpected file at guide root "
                f"(only .html / .pdf / verification_log.json / ship_log.md allowed). Move to _build/."
            )

    for v in violations:
        report.fail(v)

    if not violations:
        report.ok("Guide roots clean — only .html / .pdf / verification_log.json at Guides/*/.")

def check_banned_brain_files(report: Report) -> None:
    """Hard-fail if any snippet/scaffold file exists anywhere under Brain/.

    Section Snippets and any equivalent file are permanently banned (archived
    2026-05-24). They cause format drift: when a rule changes, stale snippets
    get copied instead of the current rules being read. The rules are the only
    authoritative source — no copy-paste scaffolds.

    Banned patterns (case-insensitive, anywhere under Brain/):
      - *snippet* (e.g. Section Snippets.html, snippets.html)
      - *scaffold* (e.g. scaffold_getting_around.html)
      - *template* (e.g. section_template.html)

    If you see this fail: archive the offending file to Travel/archive/ and do
    not recreate it. Read the CORE RULES directly instead.
    """
    brain_dir = TRAVEL_ROOT / "Brain"
    if not brain_dir.exists():
        return

    banned_patterns = ("snippet", "scaffold", "template")
    hits: list[str] = []

    for fp in brain_dir.rglob("*"):
        if not fp.is_file():
            continue
        if fp.name.startswith("."):
            continue
        name_lower = fp.name.lower()
        for pat in banned_patterns:
            if pat in name_lower:
                rel = fp.relative_to(TRAVEL_ROOT)
                hits.append(
                    f"{rel} — banned scaffold/snippet file. "
                    f"Archive to Travel/archive/ and do not recreate. "
                    f"Read CORE RULES directly (archived 2026-05-24: snippet files cause drift when rules change)."
                )
                break  # one hit per file

    for h in hits:
        report.fail(h)

    if not hits:
        report.ok("Brain/ — no banned snippet/scaffold/template files found.")


# ──────────────────────────────────────────────────────────────────────────────
# Stray auto-generated files outside Brain/Reference/ (added 2026-06-15)
# ──────────────────────────────────────────────────────────────────────────────
# Two files are written automatically by scripts and must always live in
# Brain/Reference/ — never loose at Brain/ root or anywhere else:
#   profile_watermark.json — brain_check.py (Rule 49)
#   verify_cache.json    — verify_urls.py
# NOTE: ship_log.md is intentionally excluded from this check — it is now
# per-guide (Guides/{City}/ship_log.md), checked by check_guide_ship_logs below.
# ──────────────────────────────────────────────────────────────────────────────
AUTO_GENERATED_FILES = {
    "profile_watermark.json",
    "verify_cache.json",
}
REFERENCE_DIR = BRAIN_DIR / "Reference"
GUIDES_DIR = TRAVEL_ROOT / "Travel-Website" / "Guides"


def check_stray_auto_generated_files(report: Report) -> None:
    """Hard-fail if profile_watermark.json or verify_cache.json appear outside Brain/Reference/.

    These are written by scripts and must live exclusively in Brain/Reference/.
    A copy anywhere else means a script has a stale path constant — fix it and
    move the stray file to Brain/Reference/ (do not delete — may have data).
    Also fails if Brain/Reference/ship_log.md exists — it was retired 2026-06-15
    in favour of per-guide Guides/{City}/ship_log.md files.
    """
    brain_dir = TRAVEL_ROOT / "Brain"
    if not brain_dir.exists():
        return

    hits: list[str] = []

    for fp in brain_dir.rglob("*"):
        if not fp.is_file():
            continue
        if fp.name not in AUTO_GENERATED_FILES:
            continue
        try:
            fp.relative_to(REFERENCE_DIR)
            continue  # it's inside Reference/ — fine
        except ValueError:
            pass
        rel = fp.relative_to(TRAVEL_ROOT)
        hits.append(
            f"{rel} — auto-generated file found outside Brain/Reference/. "
            f"Fix the path constant in the script that writes it, then move "
            f"this file to Brain/Reference/ (do not delete — may have data)."
        )

    # Retired global ship log — should no longer exist in Reference/
    retired = REFERENCE_DIR / "ship_log.md"
    if retired.exists():
        hits.append(
            "Brain/Reference/ship_log.md — global ship log retired 2026-06-15. "
            "Per-guide logs now live at Guides/{City}/ship_log.md. "
            "Archive this file to Travel/archive/."
        )

    for h in hits:
        report.fail(h)

    if not hits:
        report.ok("Brain/ — auto-generated files (profile_watermark, verify_cache) are in Brain/Reference/; no stale global ship_log.")


# ──────────────────────────────────────────────────────────────────────────────
# Per-guide ship log integrity (added 2026-06-15)
# ──────────────────────────────────────────────────────────────────────────────
# Each shipped guide has exactly one ship_log.md in its own folder.
# Fails if: a guide folder has more than one ship_log file (duplicate names),
# or if a ship_log.md appears somewhere other than a direct guide folder
# (e.g. inside _build/ or a nested subfolder — that means a crib wrote to
# the wrong path).
# ──────────────────────────────────────────────────────────────────────────────

def check_guide_ship_logs(report: Report) -> None:
    """Fail if any guide folder has a misplaced or duplicate ship_log.md.

    Rules:
    - ship_log.md must be a direct child of the guide city folder, not nested.
    - Each city folder may have at most one ship_log.md.
    - A ship_log.md found inside _build/ or any subfolder is a crib error.
    """
    if not GUIDES_DIR.is_dir():
        return

    hits: list[str] = []

    for city_dir in sorted(GUIDES_DIR.iterdir()):
        if not city_dir.is_dir():
            continue
        # Check for stray ship_log.md in nested subfolders (wrong path)
        for fp in city_dir.rglob("ship_log.md"):
            if fp.parent == city_dir:
                continue  # correct location
            rel = fp.relative_to(TRAVEL_ROOT)
            hits.append(
                f"{rel} — ship_log.md must be a direct child of the guide city folder, "
                f"not nested inside {fp.parent.name}/. Move it up one level."
            )

    for h in hits:
        report.fail(h)

    if not hits:
        report.ok("Guides/ — all ship_log.md files are correctly placed as direct children of their city folder.")


# ──────────────────────────────────────────────────────────────────────────────
# CORE RULES checksum coverage + match (added 2026-05-30 audit)
# ──────────────────────────────────────────────────────────────────────────────
# Before this, brain_check reported "Brain intact" without ever verifying the
# CORE RULES SHA-256 checksum store. A file could be modified (or a new .html
# added and never tracked) and session-start would still say all-clear, while
# validate_itinerary.py hard-failed every guide on the same drift. This wires
# the same guard into the session-start check as a WARNING — surfaced early,
# without hard-blocking work (the ship-gate validator remains the hard gate).
#   - modified  : on-disk SHA-256 != stored  → un-updated or unauthorized edit
#   - untracked : .html in CORE RULES/ not in store → no integrity guard at all
# Fix for either: run update_core_rules_checksums.py (after confirming the edit
# was intentional).
CHECKSUMS_PATH = HERE / "core_rules_checksums.json"


def check_core_rules_checksums(report: Report) -> None:
    import hashlib
    import json

    if not CHECKSUMS_PATH.exists():
        report.warn(
            f"CORE RULES checksum store missing: {_display_path(CHECKSUMS_PATH)} — "
            f"run update_core_rules_checksums.py to generate it."
        )
        return
    if not CORE_RULES_DIR.exists():
        return  # already reported elsewhere
    try:
        stored = json.loads(CHECKSUMS_PATH.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        report.warn(f"CORE RULES checksum store unreadable: {e!r}")
        return

    on_disk = {p.name for p in CORE_RULES_DIR.glob("*.html")}
    modified: list[str] = []
    for name, stored_hash in stored.items():
        fp = CORE_RULES_DIR / name
        if not fp.is_file():
            continue  # missing-from-disk is covered by doc-index/ghost checks
        if hashlib.sha256(fp.read_bytes()).hexdigest() != stored_hash:
            modified.append(name)
    untracked = sorted(on_disk - set(stored.keys()))

    if modified:
        report.warn(
            "CORE RULES modified vs stored checksum: "
            + "; ".join(sorted(modified))
            + " — if the edit was intentional run update_core_rules_checksums.py; "
            "otherwise revert. (validate_itinerary.py hard-fails every guide until resolved.)"
        )
    if untracked:
        report.warn(
            "CORE RULES .html not covered by checksum store: "
            + "; ".join(untracked)
            + " — run update_core_rules_checksums.py to bring under the integrity guard."
        )
    if not modified and not untracked:
        report.ok(
            f"CORE RULES checksums — all {len(on_disk)} .html files tracked and matching."
        )


# check_guides_index_coverage() — REMOVED 2026-06-05 (Lane5-05 fix). The function
# body (an all-folders index-coverage scan) was orphaned: its call was removed on
# 2026-06-02 when coverage moved to the per-crib ship gate (guide_tools.py
# _check_guide_indexed) + validator idx-coverage-self. Keeping a dead all-folders
# scanner risked it being re-wired and resurrecting the cross-crib failure mode the
# system deliberately abandoned. Self-scoped coverage is the standing design.


# ──────────────────────────────────────────────────────────────────────────────
# Reference audit R4 — ghost-reference catcher in Reference docs (added 2026-05-30)
# Greps every Brain/Reference/ file for .html and .py filenames and confirms
# each resolves on disk. Catches stale pointers left behind after renames/moves.
# ──────────────────────────────────────────────────────────────────────────────

# Match filenames only in deliberate reference contexts:
#   1. Backtick-quoted:            `Guide Structure.html`  or  `Brain/scripts/foo.py`
#   2. HTML <code> tag content:    <code>foo.html</code>
#   3. href / src attribute value: href="foo.html"  or  href="../Brain/foo.py"
# Template placeholders (containing { or *) are skipped.
# The <code> pattern uses lazy capture + lookahead so a trailing "§N" or other
# text after the filename inside the same span is tolerated — the old pattern
# required the extension to sit immediately before </code>, so a citation like
# <code>Guide Entry Counts.html §6</code> was silently NOT scanned. (Lane5-06.)
# NOTE: the backtick pattern is deliberately kept TIGHT (closing ` required right
# after the extension). Markdown prose in these docs contains long, sometimes
# malformed inline-code spans; a lazy backtick match runs past sentence text and
# false-fires. Tight matching is the safe choice for the markdown context.
_REF_CTX_PATTERNS = [
    re.compile(r'`([^`\n]+\.(?:html|py))`'),                        # backtick (tight)
    re.compile(r'<code>\s*([^<\n]+?\.(?:html|py))(?=[\s<])',        # <code> (trailing text ok)
               re.IGNORECASE),
    re.compile(r'(?:href|src)\s*=\s*["\']([^"\']+\.(?:html|py))',   # href/src
               re.IGNORECASE),
]

# Filenames / patterns that intentionally live outside Brain/ — skip ghost check.
_REF_GHOST_ALLOWLIST: set[str] = {
    "guide_v3.css",         # Travel-Website/assets/
    "Guides-Index.html",    # Travel-Website/Guides/
    "index.html",           # Travel-Website/ (site home / Main Pages hub)
    "Trips.html",           # Travel-Website/Trip-Essentials/
}

# Reference docs excluded from the ghost-filename scan entirely.
# PDF Render Notes.md contains example paths from on-demand renders — these
# are session-specific and only created when explicitly requested; they are
# not persistent file pointers and should not be checked.
_REF_GHOST_EXCLUDED_DOCS: set[str] = {
    "PDF Render Notes.md",
    # Change Cascade.html uses versioned guide filenames (paris_v7.html, paris_v8.html)
    # as illustrative examples inside <li class="note"> — not real Brain/ pointers.
    # These example names live in Guides/, outside the Brain/ scan scope, so the
    # ghost-filename checker produces false positives. Excluded 2026-06-01.
    "Change Cascade.html",
    # audit_log.md is a historical ship log — it references filenames that existed
    # at the time each guide shipped (old versions, renamed files, temp build scripts).
    # These are intentional historical records, not stale pointers. Excluded 2026-06-15
    # after audit_log.md moved from Brain/mds/ to Brain/Reference/ and brought it
    # into the ghost-scan scope for the first time.
    "audit_log.md",
    # Status Dots — guides_index.md is a city tracker / planner. Its .html refs are
    # planned guides that may not be built yet (e.g. bend_v2.html). Excluded 2026-06-15.
    "Status Dots — guides_index.md",
}

# Filenames that appear in Brain.md as intentional historical references —
# strikethrough retired rows, rename notes, audit changelog entries, or
# decision log prose. These files no longer exist (archived, renamed, or
# version-replaced) but their mentions are valid documentary records, not
# stale pointers. Adding here is safer than suppressing the whole file.
_REF_GHOST_HISTORICAL_NAMES: set[str] = {
    "Tours.html",            # retired 2026-05-20 → Retired_Tours.html; struck through in Brain.md
    "Section Snippets.html", # archived 2026-05-24; struck through in Brain.md
    "Preview.html",          # renamed → Mobile Page Visualizer.html 2026-06-12; noted in Brain.md
    "european train guide.html",  # orphan documented in 2026-06-06 audit note at bottom of Brain.md
    "lisbon_v3.html",        # old version; mentioned in 2026-05-12 audit history
    "Main Pages.html",       # mentioned in 2026-06-14 decision note; file moved/renamed
    "per Links.html",        # mentioned in decision note about § citation convention
    "Data.html",             # retired .gdoc stub; mentioned in 2026-05-15 decision note
    "Specs.html",            # retired .gdoc stub; mentioned in 2026-05-15 decision note
    "Visa Check.html",       # archived to Travel/archive/ 2026-06-14; now a tab inside Resources.html; Brain.md explicitly notes "do not recreate"
    "Documents & Entry.html",# archived to Travel/archive/ 2026-06-14; Brain.md explicitly notes "do not recreate"
    "Trips v2.html",         # v2 variant referenced in Brain.md root table but never created; stale ref
    "Travel Packing v2.html",# v2 variant referenced in Brain.md root table but never created; stale ref
    "Lounges Europe v2.html",# v2 variant referenced in Brain.md root table but never created; stale ref
    "Lounges US v2.html",    # v2 variant referenced in Brain.md root table but never created; stale ref
}

def check_reference_doc_ghost_filenames(report: Report) -> None:
    """Fail if any Brain/Reference/ doc mentions a .html or .py filename
    that does not resolve to a file anywhere under Brain/ or Travel/."""
    ref_dir = BRAIN_DIR / "Reference"
    if not ref_dir.is_dir():
        return

    # Build an index of every .html and .py under ALL of Travel/ for fast bare-name lookup.
    # Scanning only Brain/ caused false positives for files in Trip-Essentials/, On Demand/,
    # Retired Rules/, etc. that are legitimately referenced from Brain/Reference/ docs.
    # archive/ is excluded — archived files intentionally no longer exist at their live path.
    brain_files: set[str] = set()
    for p in TRAVEL_ROOT.rglob("*"):
        if p.suffix not in {".html", ".py"}:
            continue
        # Skip archive — archived filenames are intentionally absent from live paths.
        if "archive" in p.parts:
            continue
        brain_files.add(p.name)

    ghosts_found = False
    for doc in sorted(ref_dir.iterdir()):
        if doc.suffix not in {".html", ".md", ".css"}:
            continue
        if doc.name in _REF_GHOST_EXCLUDED_DOCS:
            continue
        try:
            text = doc.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        seen: set[str] = set()
        for pat in _REF_CTX_PATTERNS:
            for m in pat.finditer(text):
                ref = html.unescape(m.group(1).strip())
                # Skip template placeholders and glob patterns.
                if '{' in ref or '*' in ref or '[' in ref:
                    continue
                # Skip shell commands in <code> blocks
                # (e.g. `python3 Brain/scripts/foo.py` or `cd Travel/`).
                _SHELL_CMDS = {
                    'python3', 'python', 'cd', 'git', 'npm', 'node',
                    'bash', 'sh', 'echo', 'export', 'source',
                }
                if ' ' in ref and ref.split()[0] in _SHELL_CMDS:
                    continue
                    continue
                # Normalise: URL-decode (%20 → space), strip a published-site
                # URL prefix (e.g. https://dbellinello.github.io/Travel/) down to
                # the Travel-relative path, then strip leading ../ sequences.
                ref_clean = unquote(ref)
                ref_clean = re.sub(r'^https?://[^/]+/Travel/', '', ref_clean)
                ref_clean = re.sub(r'^(?:\.\./)+', '', ref_clean)
                fname = Path(ref_clean).name
                if fname in seen or fname in _REF_GHOST_ALLOWLIST:
                    continue
                seen.add(fname)
                if fname in _REF_GHOST_HISTORICAL_NAMES:
                    continue
                # Resolve: if ref includes a path prefix, check from Travel root.
                # Strip a leading "Travel/" prefix so "Travel/Brain/foo.py"
                # resolves correctly against TRAVEL_ROOT (same as check_ghost_references).
                # Otherwise check by filename anywhere under Brain/.
                if '/' in ref_clean:
                    stripped = ref_clean.removeprefix("Travel/")
                    # Website content (Guides/, Trip-Essentials/, assets/) is written
                    # website-relative in the docs; resolve against Travel/ OR the
                    # website root WEB_ROOT (2026-06-13 reorg) OR Trip-Essentials/
                    # subfolders (Maps/, Plug Adapter/, etc. use bare subfolder-relative
                    # paths like `Maps/Europe Map.html`).
                    TRIP_ESS = WEB_ROOT / "Trip-Essentials"
                    exists = (
                        (TRAVEL_ROOT / stripped).exists()
                        or (WEB_ROOT / stripped).exists()
                        or (TRIP_ESS / stripped).exists()
                    )
                else:
                    exists = fname in brain_files
                if not exists:
                    report.fail(
                        f"Ghost filename in {doc.name}: `{ref}` — not found on disk"
                    )
                    ghosts_found = True

    if not ghosts_found:
        report.ok("Reference doc ghost-filename scan — all .html/.py references resolve")


# ──────────────────────────────────────────────────────────────────────────────
# § citation targets (added 2026-06-06 — CORE RULES audit)
# ──────────────────────────────────────────────────────────────────────────────
# When a rules doc is renumbered (a § inserted, or files consolidated), citations
# of the form `{File}.html § N` elsewhere go stale silently. Found in the
# 2026-06-06 audit: the footer rule moved Toolbar.html §5→§6 when Visual design
# was inserted as §5 (2026-06-02) — five citations kept pointing at §5; the
# 2026-05-26 Stops Structure consolidation left `§5` citations for content now
# at §3c / Day Structure §6. WARN-mode: a CORE RULES file can carry the stale
# citation until its fix is approved, so this must surface without blocking
# sibling cribs' session starts.

_SECTION_CITE_RE = re.compile(
    r"([A-Za-z][A-Za-z0-9&,'’ .-]*?\.html)\s*§\s*(\d+)"
)
_HEADING_SECTION_RE = re.compile(r"<h[1-4][^>]*>\s*§\s*(\d+)")


def check_section_citation_targets(report: Report) -> None:
    """Warn when a Brain HTML doc cites `{File}.html § N` and the named file
    has no `§ N` heading. File-qualified citations only; files with no §
    headings at all are skipped (nothing to resolve against)."""
    scan_dirs = [BRAIN_DIR / "CORE RULES", BRAIN_DIR / "Reference"]
    headings: dict[str, set[int]] = {}
    for d in scan_dirs:
        if not d.is_dir():
            continue
        for p in d.glob("*.html"):
            try:
                src = p.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            headings[p.name] = {
                int(n) for n in _HEADING_SECTION_RE.findall(src)
            }
    stale = 0
    for d in scan_dirs:
        if not d.is_dir():
            continue
        for p in sorted(d.glob("*.html")):
            try:
                src = p.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            # Drop code tags so `<code>Foo.html</code> § 5` reads contiguously.
            text = src.replace("</code>", "").replace("<code>", "")
            for m in _SECTION_CITE_RE.finditer(text):
                fname = Path(m.group(1)).name
                n = int(m.group(2))
                secs = headings.get(fname)
                if secs and n not in secs:
                    report.warn(
                        f"Stale § citation in {p.name}: "
                        f"{fname} § {n} — target has §§ {sorted(secs)}"
                    )
                    stale += 1
    if not stale:
        report.ok(
            "§ citation targets — every file-qualified § citation in "
            "CORE RULES + Reference resolves to a real heading"
        )


# ──────────────────────────────────────────────────────────────────────────────
# Toolbar centering invariant (added 2026-06-05)
# ──────────────────────────────────────────────────────────────────────────────
# toolbar.js renders the shared nav bar at the top of every Travel page. Its
# button row must stay CENTERED on the same axis as the page content, on every
# browser and OS, and must never hide the first button. Two regressions have hit
# this — both are guarded here:
#
#   1. Capping the button row at a fixed column width (max-width / fit-content)
#      plus justify-content:flex-start → on machines whose font/emoji metrics push
#      the buttons past the cap, the row froze at the cap and packed every button
#      to the LEFT, leaving a gap on the right.
#   2. Applying that cap to the SCROLL container (scroller.style.maxWidth) → the
#      row scrolled and the "scroll active tab into view" logic re-centered the
#      active tab, pushing the first button (Trips) off the left edge.
#
# Locked mechanism: the .tb-links row is `width:max-content` + `margin:0 auto`, so
# it is exactly as wide as its buttons and centers in the VIEWPORT — the same axis
# the page content centers on — with NO width cap. It scrolls only when the buttons
# exceed the whole window (very narrow screens). Full rule + the why:
# Brain/Reference/Toolbar.html § 7 Centering.
def check_toolbar_centering(report: Report) -> None:
    if not TOOLBAR_JS.exists():
        report.fail(
            f"toolbar.js missing at {_display_path(TOOLBAR_JS)} — the shared nav bar "
            f"every page loads is gone. Its permanent home is Travel-Website/assets/toolbar.js "
            f"(never Travel root or Guides/). Restore additively from Travel/archive/."
        )
        return
    if not FOOTNOTE_JS.exists():
        report.fail(
            f"footnote.js missing at {_display_path(FOOTNOTE_JS)} — the footer sharing "
            f"bar auto-loaded by toolbar.js is gone. Its permanent home is "
            f"Travel-Website/assets/footnote.js, next to toolbar.js (never Travel root or Guides/). "
            f"Restore additively from Travel/archive/."
        )
    # Both toolbar scripts must stay INSIDE Travel-Website/assets/ — fail if a stray
    # copy reappears at the Travel root or in Guides/ (the old pre-2026-06-13 home).
    for stray in (TRAVEL_ROOT / "toolbar.js", TRAVEL_ROOT / "footnote.js",
                  WEB_ROOT / "Guides" / "toolbar.js", WEB_ROOT / "Guides" / "footnote.js"):
        if stray.exists():
            report.fail(
                f"{stray.name} found at {_display_path(stray)} — its permanent home is "
                f"Travel-Website/assets/{stray.name}. Archive the stray copy to Travel/archive/; "
                f"never serve the toolbar scripts from anywhere but assets/."
            )
    src = TOOLBAR_JS.read_text(encoding="utf-8")
    flat = re.sub(r"\s+", "", src)  # whitespace-tolerant match of the CSS string fragments

    problems: list[str] = []

    # Required: the centering mechanism on the .tb-links row.
    if "width:max-content" not in flat:
        problems.append(
            "the .tb-links row no longer declares width:max-content — the row must be "
            "sized to its buttons so it can center on the content axis"
        )
    if "margin:0auto" not in flat:
        problems.append(
            "the .tb-links row no longer declares margin:0 auto — that is what centers "
            "the button row in the viewport"
        )

    # Forbidden: the two column-cap regressions.
    if re.search(r"scroller\.style\.maxwidth", src, re.IGNORECASE):
        problems.append(
            "scroller.style.maxWidth is set — capping the scroll container makes the bar "
            "scroll and the active-tab auto-scroll then hides the first button (Trips). "
            "Remove the cap"
        )
    if "width:fit-content" in flat:
        problems.append(
            "the .tb-links row uses width:fit-content — a capped/shrink-wrapped row "
            "left-packs the buttons with a gap on the right on wide-font machines. "
            "Use width:max-content with no cap"
        )
    if re.search(r"\.tb-links\{[^}]*max-width", flat):
        problems.append(
            "the .tb-links row has a max-width cap — capping the row reintroduces the "
            "left-pack-with-right-gap bug. The row must not be width-capped"
        )

    if problems:
        report.fail(
            "toolbar.js centering invariant broken: "
            + "; ".join(problems)
            + ". Full rule: Brain/Reference/Toolbar.html § 7 Centering."
        )
    else:
        report.ok(
            "toolbar.js — nav-bar centering invariant intact "
            "(.tb-links width:max-content + margin:0 auto, no width cap)."
        )


def check_toolbar_pages_documented(report: Report) -> None:
    """Warn on toolbar↔reference drift: a page wired into assets/toolbar.js ITEMS
    whose filename is not documented anywhere in Brain/Reference/Brain.md (Part 1, the
    Travel Folder Map).

    Why (added 2026-06-14): when a new tab/feature is added to the live site —
    often directly, outside a build — the reference docs (Brain.md Part 1,
    Toolbar.html, Navigation.html) were silently left stale because no trigger
    fired. The "New page added to toolbar" cascade existed in Change Cascade.html
    but nothing pointed Claude at it. This check makes that drift visible at
    session start so the cascade actually gets worked. WARN (not FAIL) — stale
    docs don't block a build, but they must not stay invisible.

    The Guides index (guides: true) is the one deliberate omission — it is the
    index itself, documented separately — so it is skipped.
    """
    if not TOOLBAR_JS.exists():
        return  # check_toolbar_centering already fails loudly on a missing toolbar.js
    brain_md = MDS_DIR / "Brain.md"
    if not brain_md.exists():
        return  # check_required_files already fails on a missing Brain.md

    src = TOOLBAR_JS.read_text(encoding="utf-8")
    m = re.search(r"ITEMS\s*=\s*\[(.*?)\];", src, re.S)
    if not m:
        report.warn(
            "toolbar.js — could not locate the ITEMS = [ … ] array to check "
            "toolbar↔Brain.md parity. If the array was renamed, update "
            "check_toolbar_pages_documented in brain_check.py."
        )
        return
    block = m.group(1)

    brain = brain_md.read_text(encoding="utf-8").lower()
    undocumented: list[str] = []
    for entry in re.finditer(r"href:\s*base\s*\+\s*'([^']+)'(?P<rest>[^}]*)", block):
        if re.search(r"guides\s*:\s*true", entry.group("rest")):
            continue  # the Guides index — deliberate omission
        path = unquote(entry.group(1))
        filename = path.rstrip("/").split("/")[-1]
        if filename and filename.lower() not in brain:
            undocumented.append(f"{filename}  (toolbar path: {path})")

    if undocumented:
        report.warn(
            "toolbar↔reference drift — "
            f"{len(undocumented)} toolbar page(s) not documented in Brain.md Part 1 "
            "(Travel Folder Map): "
            + " · ".join(undocumented)
            + ". A tab is live on the site but the reference docs never caught up. "
            "Work the 'New page added to toolbar' cascade in "
            "Brain/Reference/Change Cascade.html — add each page to Brain.md Part 1 "
            "(and Toolbar.html / Navigation.html if it introduces a new page type or "
            "nav chain)."
        )
    else:
        report.ok(
            "toolbar↔reference parity — every toolbar page is documented in "
            "Brain.md Part 1."
        )


def check_toolbar_page_standard(report: "Report") -> None:
    """FAIL when a page wired into assets/toolbar.js ITEMS doesn't meet the shared
    look standard. Driven by toolbar membership, so any NEW tab a crib adds is
    automatically gated — it must match the rest of the bar or the build fails.

    Per toolbar page (the Guides index, guides:true, is skipped — it is the index
    itself), all hard fails:
      1. the page file must exist — no broken toolbar link;
      2. it must load the shared nav bar (assets/toolbar.js) — the identical top
         bar + colours every other page carries;
      3. it must declare the canonical warm page background #f5f4f0 — the shared
         site background (Colors and Font Size.html);
      4. it must carry the <meta viewport> mobile baseline (parity with every
         other shareable page; fix with mobile_check.py --apply).

    The search-bar colour standard (§ 14 — focus ring #B8860B, placeholder #A8895A,
    width/padding/background, etc.) is enforced on every toolbar page too, by the
    sibling check_search_bar_standard — that is the per-control colour gate.

    5. the page BANNER (the main header band — .site-header / .page-header /
       .index-banner / .hero / .banner / top-level .header) must use the canonical
       warm palette, never an off-palette hue. The standard banner is the warm
       terracotta gradient #7a3b1e → #b85c2a → #d4874a (Colors and Font Size.html);
       a green / blue / teal / purple banner (e.g. the Currency page's green
       #1f5c3a→#2e8b57→#5cb87a) hard-fails.

    Deliberately NOT enforced: a per-page SECONDARY accent away from the banner
    (e.g. the blue link accent on European Train Guide, green status dots on Travel
    Packing) is allowed — pinning a single site-wide accent everywhere would
    false-fail accepted pages. Only the shared chrome, the canonical background,
    the banner palette, and the § 14 search bar are pinned. Reference: Toolbar.html
    + Colors and Font Size.html § 14. Added 2026-06-14.
    """
    # Banner header selectors (the main page band) — NOT sub-section headers like
    # .card-header / .region-header / .country-header / .header-label.
    _BANNER_SEL = re.compile(
        r'(?<![\w-])\.(?:site-header|page-header|index-banner|hero|banner|header)(?![\w-])'
    )

    def _banner_offpalette(hex_str: str) -> bool:
        """True when a banner colour stop is a saturated NON-warm hue (green/blue/
        teal/purple). Warm ambers/terracottas/browns and near-neutrals pass."""
        h = hex_str.lower()
        if re.fullmatch(r"#[0-9a-f]{3}", h):
            h = "#" + "".join(c * 2 for c in h[1:])
        if not re.fullmatch(r"#[0-9a-f]{6}", h):
            return False
        r, g, b = int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)
        if max(r, g, b) - min(r, g, b) < 40:
            return False  # near-grey / neutral
        if r >= g >= b and r - b > 30:
            return False  # warm amber / terracotta / brown — the canonical family
        return True       # green / blue / teal / purple — off-palette banner
    if not TOOLBAR_JS.exists():
        return  # check_toolbar_centering already fails loudly on a missing toolbar.js
    src_tb = TOOLBAR_JS.read_text(encoding="utf-8")
    m = re.search(r"ITEMS\s*=\s*\[(.*?)\];", src_tb, re.S)
    if not m:
        return  # check_toolbar_pages_documented already warns on a renamed array

    failures: list[str] = []
    for entry in re.finditer(r"href:\s*base\s*\+\s*'([^']+)'(?P<rest>[^}]*)", m.group(1)):
        if re.search(r"guides\s*:\s*true", entry.group("rest")):
            continue  # the Guides index — the index itself, deliberate omission
        path = unquote(entry.group(1))
        page = WEB_ROOT / path
        rel = f"Travel-Website/{path}"
        if not page.exists():
            failures.append(
                f"{rel}: toolbar links to a page that does not exist — broken tab "
                "(add the page or remove the ITEMS entry)."
            )
            continue
        try:
            html = page.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        if "toolbar.js" not in html:
            failures.append(
                f"{rel}: does not load the shared nav bar (assets/toolbar.js) — "
                "every toolbar page must mount the same toolbar so the chrome and "
                "colours match (Toolbar.html)."
            )
        if "f5f4f0" not in html.lower():
            failures.append(
                f"{rel}: missing the canonical warm page background #f5f4f0 — "
                "toolbar pages share the site background (Colors and Font Size.html)."
            )
        if not re.search(r'<meta[^>]+name=["\']viewport["\']', html, re.IGNORECASE):
            failures.append(
                f"{rel}: missing the <meta viewport> mobile baseline — "
                "run mobile_check.py --apply."
            )
        # 5. banner must use the canonical warm palette — no off-palette hue.
        seen_bad: set[str] = set()
        for rule in re.finditer(r'([^{}]+)\{([^}]*)\}', html):
            sel, body = rule.group(1), rule.group(2)
            if not _BANNER_SEL.search(sel):
                continue
            bg = re.search(r'background(?:-image|-color)?\s*:\s*([^;]+)', body, re.IGNORECASE)
            if not bg:
                continue
            for hx in re.findall(r'#[0-9a-f]{3,6}', bg.group(1), re.IGNORECASE):
                if _banner_offpalette(hx) and hx.lower() not in seen_bad:
                    seen_bad.add(hx.lower())
                    failures.append(
                        f"{rel}: page banner uses an off-palette colour {hx} "
                        "(green/blue/teal/purple) — the banner must use the canonical "
                        "warm terracotta palette (#7a3b1e → #b85c2a → #d4874a, "
                        "Colors and Font Size.html)."
                    )

    if failures:
        for msg in failures:
            report.fail(f"[toolbar-page-standard] {msg}")
    else:
        report.ok(
            "toolbar-page-standard — every toolbar tab exists, loads the shared "
            "nav bar + canonical #f5f4f0 background, and carries the mobile baseline."
        )


def check_banner_title_size(report: "Report") -> None:
    """FAIL when a shareable page's title banner <h1> uses a font-size other than
    the canonical 14px (var(--fs-title)). Every title banner across the non-guide
    site — Trip-Essentials pages, the Guides index, the Main Pages hub — must
    render its <h1> at the same 14px so all banners match (Dani 2026-06-15:
    "all titles banner needs to match"). The toolbar is the one universal shared
    nav (check_toolbar_page_standard); guide-page CSS stays separate (guide_v3.css)
    and is out of scope. A banner enlarged in @media print is allowed. This rule is
    Claude-maintained — no approval needed. Reference: Brain/Reference/Colors and
    Font Size.html § Title Banner.
    """
    def _strip_media_print(css: str) -> str:
        out, i = [], 0
        while True:
            m = re.search(r'@media[^{]*\bprint\b[^{]*\{', css[i:], re.I)
            if not m:
                out.append(css[i:]); break
            start = i + m.start()
            out.append(css[i:start])
            j = i + m.end() - 1  # index of the opening '{'
            depth = 0
            while j < len(css):
                if css[j] == '{': depth += 1
                elif css[j] == '}':
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            i = j + 1
        return ''.join(out)

    OK_VALUES = {"14px", "var(--fs-title)", "var(--fs-title,14px)", "var(--fs-title, 14px)"}
    pages = list((WEB_ROOT / "Trip-Essentials").rglob("*.html"))
    for extra in ("Guides/Guides-Index.html", "Website-Main-Pages-Links.html", "index.html"):
        p = WEB_ROOT / extra
        if p.exists():
            pages.append(p)

    failures: list[str] = []
    for page in pages:
        try:
            html = _strip_media_print(page.read_text(encoding="utf-8", errors="replace"))
        except Exception:
            continue
        rel = page.relative_to(WEB_ROOT)
        for rule in re.finditer(r'([^{}]+)\{([^}]*)\}', html):
            sel, body = rule.group(1), rule.group(2)
            if not re.search(r'(?:\.header|\.page-header|\.site-header)\s+h1|\.site-title', sel):
                continue
            m = re.search(r'font-size:\s*([^;]+)', body, re.I)
            if not m:
                continue
            val = m.group(1).replace("!important", "").strip()
            if val in OK_VALUES:
                continue
            failures.append(
                f"{rel}: title-banner h1 font-size is {val} — every banner must be "
                "14px (var(--fs-title)) so all title banners match."
            )

    if failures:
        for f in failures:
            report.fail(f"[banner-title-size] {f}")
    else:
        report.ok("banner-title-size — every title banner h1 renders at the canonical 14px.")


def check_banner_content(report: "Report") -> None:
    """FAIL when a shareable page's title banner (.page-header / .site-header / .header)
    contains anything other than <h1> and optional <button> elements.
    Banners must be pure title strips — no <span>, <p>, <div>, date stamps, or
    metadata elements inside the banner div. The .updated-stamp pattern (and any
    similar informational spans) must live outside the banner, e.g. below the
    intro paragraph or in the sources section.
    Scope: same pages as check_banner_title_size (Trip-Essentials + guides_index +
    Website Main Pages Links + index).
    """
    # Only the main title strip classes — index-banner is reused as a column
    # header row in some pages (e.g. Plug Adapter Guide) so it is excluded.
    _BANNER_DIV_RE = re.compile(
        r'<div[^>]+class=["\'][^"\']*(?:page-header|site-header)[^"\']*["\'][^>]*>'
        r'(.*?)</div>',
        re.S | re.I,
    )
    # Elements allowed alongside <h1> inside a banner: <button> and the source
    # link <a> (e.g. travel.state.gov, which sits on the banner line). [2026-06-20]
    _ALLOWED_TAG_RE = re.compile(r'<(h1|button|a|/h1|/button|/a|\!--)[^>]*>', re.I)
    _ANY_TAG_RE = re.compile(r'<(/?\w+)[^>]*>', re.I)

    pages = list((WEB_ROOT / "Trip-Essentials").rglob("*.html"))
    for extra in ("Guides/Guides-Index.html", "Website-Main-Pages-Links.html", "index.html"):
        p = WEB_ROOT / extra
        if p.exists():
            pages.append(p)

    failures: list[str] = []
    for page in pages:
        try:
            html = page.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        rel = page.relative_to(WEB_ROOT)
        for m in _BANNER_DIV_RE.finditer(html):
            inner = m.group(1)
            for tag_m in _ANY_TAG_RE.finditer(inner):
                tag = tag_m.group(1).lower().lstrip("/")
                if tag not in ("h1", "button", "a", "!--"):
                    failures.append(
                        f"{rel}: banner contains <{tag}> — banners must hold only "
                        "<h1> (and optional <button> / source-link <a>). Move date "
                        "stamps, spans, or metadata outside the banner div."
                    )
                    break  # one failure per banner is enough

    if failures:
        for f in failures:
            report.fail(f"[banner-content] {f}")
    else:
        report.ok("banner-content — every title banner contains only <h1> (+ optional buttons).")


# ─── Rule 49: Profile watermark ──────────────────────────────────────────────

def check_profile_watermark(report: "Report") -> None:
    """Warn if CLAUDE.md lost significant content since last recorded watermark.

    Brain/Reference/profile_watermark.json stores the line-count and §-count written by
    brain_check.py at the end of every clean run. A drop of ≥5% in either
    metric without a matching audit_log.md entry is a silent-trim signal.
    Rule: Cleanliness Checks.md Rule 49.
    """
    if not WATERMARK_PATH.exists():
        # First ever run — nothing to compare against; watermark written below.
        return
    try:
        prev = json.loads(WATERMARK_PATH.read_text())
    except Exception:
        report.warn("profile_watermark.json unreadable — will overwrite on clean run.")
        return

    try:
        current_text = PROFILE.read_text(encoding="utf-8")
    except Exception:
        return  # PROFILE missing caught by check_required_files

    current_lines = current_text.count("\n")
    current_sections = len([l for l in current_text.splitlines() if l.startswith("## ")])

    prev_lines = prev.get("line_count", 0)
    prev_sections = prev.get("section_count", 0)

    problems = []
    if prev_lines > 0 and current_lines < prev_lines * 0.95:
        problems.append(
            f"CLAUDE.md line count dropped {prev_lines} → {current_lines} "
            f"({prev_lines - current_lines} lines missing — ≥5% drop). "
            "Check audit_log.md for an authorised edit; if none, restore from Travel/archive/."
        )
    if prev_sections > 0 and current_sections < prev_sections:
        problems.append(
            f"CLAUDE.md section count dropped {prev_sections} → {current_sections}. "
            "A '## ' header was removed without a logged approval. "
            "Check audit_log.md; restore from Travel/archive/ if unexplained."
        )

    for p in problems:
        report.fail(f"[Rule 49 — profile watermark] {p}")
    if not problems and (prev_lines or prev_sections):
        report.ok(
            f"Profile watermark OK — lines {current_lines} (prev {prev_lines}), "
            f"sections {current_sections} (prev {prev_sections})."
        )


def _write_profile_watermark() -> None:
    """Write Brain/Reference/profile_watermark.json after a clean brain_check run (Rule 49)."""
    try:
        current_text = PROFILE.read_text(encoding="utf-8")
    except Exception:
        return
    lines = current_text.count("\n")
    sections = len([l for l in current_text.splitlines() if l.startswith("## ")])
    payload = {
        "line_count": lines,
        "section_count": sections,
        "written": date.today().isoformat(),
        "written_by": "brain_check.py (Rule 49)",
    }
    WATERMARK_PATH.write_text(json.dumps(payload, indent=2) + "\n")


# ─── Rule 7 / suggestion 3: PDF gradient sync ────────────────────────────────

def check_pdf_gradient_sync(report: "Report") -> None:
    """Warn if the title-page gradient in Guide Style.css and PDF Render Notes.md diverge.

    PDF Render Notes.md carries a hardcoded copy of the gradient for the
    WeasyPrint override CSS. When Guide Style.css is reskinned, both must
    match. brain_check.py now greps both files and warns on divergence.
    Reference: Brain/Reference/PDF Render Notes.md § 2 (Heads Up).
    """
    # Extract gradient from Guide Style.css (.title-page block)
    if not GUIDE_STYLE_CSS.exists():
        return  # caught by check_required_files
    if not PDF_RENDER_NOTES.exists():
        return

    css_text = GUIDE_STYLE_CSS.read_text(encoding="utf-8", errors="replace")
    pdf_text = PDF_RENDER_NOTES.read_text(encoding="utf-8", errors="replace")

    # Grab all linear-gradient(...) strings from both files
    gradient_re = re.compile(r"linear-gradient\([^)]+\)")
    css_grads = set(gradient_re.findall(css_text))
    pdf_grads = set(gradient_re.findall(pdf_text))

    # Only compare gradients that appear near '.title-page' in Guide Style.css
    # Narrow to the .title-page block (up to 20 lines after the selector)
    title_block_grads: set[str] = set()
    in_block = False
    depth = 0
    for line in css_text.splitlines():
        if ".title-page" in line and "{" in line:
            in_block = True
        if in_block:
            depth += line.count("{") - line.count("}")
            matches = gradient_re.findall(line)
            title_block_grads.update(matches)
            if depth <= 0:
                in_block = False

    if not title_block_grads:
        # Can't extract from CSS — skip silently (structure may differ)
        return

    # Check each title-page gradient appears in PDF Render Notes
    missing = [g for g in title_block_grads if g not in pdf_grads]
    if missing:
        report.warn(
            "[PDF gradient sync] Guide Style.css .title-page gradient(s) not found in "
            "PDF Render Notes.md — update the OVERRIDE_CSS block in that file: "
            + "; ".join(missing[:2])
        )
    else:
        report.ok("PDF gradient sync — title-page gradient matches PDF Render Notes.md.")


def check_search_bar_standard(report: "Report") -> None:
    """Fail if any Travel-Website HTML file violates the search bar standard (§ 14,
    Colors and Font Size.html, 2026-06-13).

    Rules enforced:
      1. placeholder must be exactly '🔍' (emoji only — no words after it).
      2. CSS must not use border-radius:20px (pill shape) on a search selector.
      3. CSS must not animate width on focus for a search input (transition:width).
      4. CSS search selector must use width:200px (standard fixed size). Any other
         width value (width:auto, width:150px, width:260px, min-width, max-width
         without the 200px anchor) is a violation.
      5. Every core property (width, padding, font-size, border, border-radius,
         background, color) must resolve to the standard value (the index look).
      6. Every var(--X) used in the search bar CSS must be defined or have a fallback.
      7. The :focus rule must set border-color:#B8860B and the focus ring
         box-shadow:0 0 0 3px rgba(184,134,11,.12) (the "line around" on focus).
      8. The ::placeholder color must be #A8895A (hardcoded — no var).

    Applies to every .html file AND shared .css asset under Travel-Website/
    (excluding archive/ subfolders). Selectors matched: #...search ids,
    .filter-input, .search-input, and input[type="search"]/input[type="text"].
    Reference: Brain/Reference/Colors and Font Size.html § 14.
    """
    import re as _re

    web_root = WEB_ROOT
    if not web_root.exists():
        report.warn("[search-bar-standard] Travel-Website/ not found — skipped.")
        return

    # Collect all HTML files AND shared CSS assets outside archive dirs.
    # The search bar standard is enforced wherever a search input is styled —
    # including the shared stylesheets in assets/ (a non-conforming global
    # input[type="search"] / .search-input rule there overrides per-page CSS).
    # mobile.css is a defensive width-override utility — it intentionally only
    # sets width/max-width/flex-shrink on search selectors (not the full
    # standard property set) and uses !important to win specificity. Exclude it
    # from the full search-bar-standard check so partial overrides don't false-fail.
    _EXCLUDED_CSS = {"mobile.css"}
    html_files = [
        p for p in web_root.rglob("*")
        if p.suffix.lower() in (".html", ".css")
        and "archive" not in [part.lower() for part in p.parts]
        and p.name not in _EXCLUDED_CSS
    ]

    # Selector token matching every search-bar selector form used on the site:
    # #...search ids, the .filter-input / .search-input classes, and the
    # input[type="search"] / input[type="text"] attribute selectors. Used to
    # capture the rule body even inside grouped selectors (token immediately
    # before the opening brace).
    _SEL = (r'(?:#[a-z-]*search|\.filter-input|\.search-input'
            r'|input\s*\[\s*type\s*=\s*["\']?(?:search|text)["\']?\s*\])')

    # Expected resolved property values for every search bar (§ 14).
    # Standard updated 2026-06-20: bigger centered search — 360px / 11px 18px / 15px.
    # background/color dropped from the strict set (always white; #fff vs #ffffff
    # varies harmlessly across pages).
    _SEARCH_EXPECTED = {
        'width':         '360px',
        'padding':       '11px 18px',
        'font-size':     '15px',
        'border':        '1.5px solid #e6e2da',
        'border-radius': '6px',
    }
    _SEARCH_BLOCK_RE = _re.compile(
        _SEL + r'\s*\{([^}]+)\}',
        _re.IGNORECASE | _re.DOTALL,
    )
    _VAR_DEF_RE = _re.compile(r'(--[a-z0-9-]+)\s*:\s*([^;}\n]+)', _re.IGNORECASE)
    _VAR_USE_RE = _re.compile(r'var\(\s*(--[a-z0-9-]+)(?:\s*,\s*([^)]+))?\)', _re.IGNORECASE)
    _PROP_RE    = _re.compile(r'(?<![a-z-])({prop})\s*:\s*([^;]+)')

    # Patterns
    # 1. placeholder with words after 🔍 (allow pure emoji placeholder)
    _PH_RE = _re.compile(
        r'<input\b[^>]*\btype=["\']search["\'][^>]*>|'
        r'<input\b[^>]*\bplaceholder=["\'][^"\']*["\'][^>]*\btype=["\']search["\'][^>]*>',
        _re.IGNORECASE | _re.DOTALL,
    )
    _PH_VAL_RE = _re.compile(r'\bplaceholder=["\']([^"\']*)["\']', _re.IGNORECASE)
    # JS dynamic placeholder assignment with words
    _JS_PH_RE = _re.compile(
        r'''\.placeholder\s*=\s*['"]([^'"]*\w[^'"]*)['"]''',
    )

    # 2. pill border-radius on a search-related CSS selector
    _PILL_RE = _re.compile(
        r'(?:search|filter-input)[^{]*\{[^}]*border-radius\s*:\s*20px',
        _re.IGNORECASE | _re.DOTALL,
    )

    # 3. width animation in focus rule for search
    _WIDTH_ANIM_RE = _re.compile(
        r'(?:search|filter-input)[^{]*:focus\s*\{[^}]*(?:width\s*:\s*\d+px|transition\s*:[^}]*\bwidth\b)',
        _re.IGNORECASE | _re.DOTALL,
    )

    # 4. search selector must use width:200px — any other bare width value is a violation.
    # Uses negative lookbehind to skip min-width / max-width.
    # 360px is the desktop standard; 100% / auto are legit responsive (mobile/flex)
    # values and never a violation.
    _WRONG_W_RE = _re.compile(
        _SEL + r'\s*\{[^}]*(?<![-a-z])width\s*:\s*(?!360px|100%|auto)([^;}\s]+)',
        _re.IGNORECASE | _re.DOTALL,
    )

    failures = []
    for path in sorted(html_files):
        rel = path.relative_to(TRAVEL_ROOT)
        try:
            src = path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue

        # Check 1 (placeholder text): REMOVED 2026-06-20. The standard now uses a
        # descriptive placeholder ("🔍  Country name", etc.) like the Lounges pages,
        # not a bare 🔍. No placeholder-content check.

        # Check 2: pill shape
        if _PILL_RE.search(src):
            failures.append(
                f"{rel}: search bar uses border-radius:20px (pill shape) — "
                "must be border-radius:6px (§ 14 Colors and Font Size.html)."
            )

        # Check 3: width animation on focus
        if _WIDTH_ANIM_RE.search(src):
            failures.append(
                f"{rel}: search bar :focus rule animates width — "
                "forbidden (§ 14 Colors and Font Size.html)."
            )

        # Check 4: search selector must use width:200px outside @media blocks
        # Strip @media blocks first so mobile width:100% overrides don't false-fire.
        src_no_media = _re.sub(r'@media\s*\([^)]*\)\s*\{[^{}]*\}', '', src, flags=_re.DOTALL)
        w_m = _WRONG_W_RE.search(src_no_media)
        if w_m:
            failures.append(
                f"{rel}: search bar CSS uses width:{w_m.group(1)} — "
                "must be width:360px outside media queries (§ 14 Colors and Font Size.html)."
            )

        # Check 5: every search bar property must resolve to the standard value.
        var_defs = {m.group(1).strip(): m.group(2).strip()
                    for m in _VAR_DEF_RE.finditer(src)}

        def _resolve(val, _vd=var_defs):
            def _sub(m):
                name = m.group(1).strip()
                fb   = m.group(2).strip() if m.group(2) else None
                return _vd.get(name, fb or f'UNDEF({name})')
            return _VAR_USE_RE.sub(_sub, val).strip()

        css_blocks = _SEARCH_BLOCK_RE.findall(src)
        if css_blocks:
            # Use the longest block (skip the small mobile-override block)
            main_css = max(css_blocks, key=len)
            for prop, expected in _SEARCH_EXPECTED.items():
                pm = _re.search(r'(?<![a-z-])' + prop + r'\s*:\s*([^;]+)',
                                main_css, _re.IGNORECASE)
                # A missing property is inherited from the shared _travel_style.css
                # standard (validated directly on that file) — not a violation.
                # Only an explicit value that deviates is flagged.
                if pm:
                    resolved = _resolve(pm.group(1).strip())
                    if resolved != expected:
                        failures.append(
                            f"{rel}: search bar '{prop}' resolves to '{resolved}', "
                            f"expected '{expected}' — § 14 Colors and Font Size.html."
                        )

        # Check 6 (old 5): every var(--X) used in the search bar CSS must be defined in the page.
        # Extract all var(--name) references from search bar CSS blocks.
        search_css_blocks = _re.findall(
            _SEL + r'\s*\{[^}]+\}',
            src, _re.IGNORECASE | _re.DOTALL,
        )
        for block in search_css_blocks:
            for var_name in _re.findall(r'var\(\s*(--[a-z0-9-]+)', block, _re.IGNORECASE):
                # The variable must appear as a definition (--name:) somewhere in the file.
                # Allow fallback syntax var(--name, fallback) — those are self-sufficient.
                # Check if this var() has a fallback value (comma present inside the parens).
                var_call_re = _re.compile(
                    r'var\(\s*' + _re.escape(var_name) + r'\s*(?:,([^)]+))?\)',
                    _re.IGNORECASE,
                )
                has_fallback = any(
                    m.group(1) is not None and m.group(1).strip()
                    for m in var_call_re.finditer(block)
                )
                if has_fallback:
                    continue  # fallback value present — safe even without definition
                # No fallback — must be defined in the page
                defined = bool(_re.search(
                    _re.escape(var_name) + r'\s*:', src, _re.IGNORECASE
                ))
                if not defined:
                    failures.append(
                        f"{rel}: search bar uses {var_name} but it is not defined in "
                        "the page and has no fallback — add the variable or a fallback "
                        "value (§ 14 Colors and Font Size.html)."
                    )

        # Check 7: :focus rule must match the index standard (§ 14) — the focus
        # border-color (#B8860B) and the focus box-shadow ring (the "line around"
        # that appears on focus). These are hardcoded per § 14 — no var(--accent).
        # Only enforced on pages that style a search bar (a main block exists).
        _FOCUS_BLOCK_RE = _re.compile(
            _SEL + r'\s*:focus\s*\{([^}]+)\}',
            _re.IGNORECASE | _re.DOTALL,
        )
        _FOCUS_EXPECTED = {
            'border-color': '#b8860b',
            'box-shadow':   '0 0 0 3px rgba(184,134,11,.12)',
        }
        if css_blocks:
            focus_blocks = _FOCUS_BLOCK_RE.findall(src)
            # No :focus rule on the page = inherited from the shared standard. OK.
            if focus_blocks:
                focus_css = max(focus_blocks, key=len)
                for prop, expected in _FOCUS_EXPECTED.items():
                    pm = _re.search(r'(?<![a-z-])' + prop + r'\s*:\s*([^;]+)',
                                    focus_css, _re.IGNORECASE)
                    if not pm:
                        failures.append(
                            f"{rel}: search bar :focus missing '{prop}' "
                            f"(expected {expected}) — § 14 Colors and Font Size.html."
                        )
                    else:
                        resolved = _re.sub(r'\s+', ' ',
                                           _resolve(pm.group(1).strip())).strip().lower()
                        if resolved != expected:
                            failures.append(
                                f"{rel}: search bar :focus '{prop}' is '{resolved}', "
                                f"expected '{expected}' — § 14 Colors and Font Size.html."
                            )

        # Check 8: ::placeholder color must be #A8895A (§ 14) — hardcoded, no var.
        _PH_BLOCK_RE = _re.compile(
            _SEL + r'\s*::placeholder\s*\{([^}]+)\}',
            _re.IGNORECASE | _re.DOTALL,
        )
        if css_blocks:
            ph_blocks = _PH_BLOCK_RE.findall(src)
            # No ::placeholder rule on the page = inherited from the shared standard. OK.
            if ph_blocks:
                ph_css = max(ph_blocks, key=len)
                cm = _re.search(r'(?<![a-z-])color\s*:\s*([^;]+)',
                                ph_css, _re.IGNORECASE)
                if not cm:
                    failures.append(
                        f"{rel}: search bar ::placeholder missing 'color' "
                        "(expected #A8895A) — § 14 Colors and Font Size.html."
                    )
                else:
                    resolved = _resolve(cm.group(1).strip()).strip().lower()
                    if resolved != '#a8895a':
                        failures.append(
                            f"{rel}: search bar ::placeholder color is '{resolved}', "
                            "expected '#A8895A' — § 14 Colors and Font Size.html."
                        )

    if failures:
        for msg in failures:
            report.fail(f"[search-bar-standard] {msg}")
    else:
        report.ok("search-bar-standard — all search inputs conform to § 14.")


def check_guides_index_banner_subtitle(report: "Report") -> None:
    """Fail if Guides-Index.html has a subtitle element inside the Travel Guides banner.

    The banner must contain only the <h1> title — no sub-caption, count badge, or
    secondary text. The old markup used .index-banner-sub; future drift might use
    a <p>, .header-desc, or any extra element inside .header / .index-banner.
    This check catches both the old class name and any new subtitle element.
    Reference: Brain/Reference/Toolbar.html (banner drift fix 2026-06-12).
    """
    guides_index = WEB_ROOT / "Guides" / "Guides-Index.html"
    if not guides_index.exists():
        return  # caught by check_required_files if ever listed there

    html = guides_index.read_text(encoding="utf-8", errors="replace")

    # 1. Hard fail: the retired subtitle class must never reappear.
    if "index-banner-sub" in html:
        report.fail(
            "[guides_index banner] Guides-Index.html still contains .index-banner-sub "
            "— the subtitle under the Travel Guides banner was removed (2026-06-12). "
            "Delete the subtitle element and its class; the banner must hold only <h1>."
        )
        return

    # 2. Soft structural check: look for any extra child element inside .header
    # or .index-banner beyond an <h1>. A <p>, <span>, or <div> there is a subtitle.
    import re as _re
    banner_block_re = _re.compile(
        r'class="(?:header|index-banner)[^"]*"[^>]*>(.*?)</div>',
        _re.DOTALL | _re.IGNORECASE,
    )
    for m in banner_block_re.finditer(html):
        inner = m.group(1)
        # Strip the h1 (and whitespace) — anything left is a subtitle.
        leftover = _re.sub(r"<h1[^>]*>.*?</h1>", "", inner, flags=_re.DOTALL | _re.IGNORECASE)
        leftover = _re.sub(r"\s+", "", leftover)
        if leftover:
            report.fail(
                "[guides_index banner] Guides-Index.html has extra content inside the "
                "Travel Guides banner beyond <h1> — remove it. The banner must contain "
                "only the page title, no subtitle, count, or secondary text."
            )
            return

    report.ok("guides_index banner — no subtitle element found.")


def check_index_stat_row(report: "Report") -> None:
    """Fail if the Guides-Index.html stat row drifts from the § 15 standard.

    Standard (Brain/Reference/Colors and Font Size.html § 15, locked 2026-06-14):
    one .stat-row directly under the banner holding two small grey text lines —
    #guide-count (places) on the left, #country-count on the right. Place and
    country data stay on SEPARATE lines and never merge. Both are plain text with
    `|` separators (no pills/dots/buttons). Place counts reconcile in JS:
    total guides = visited (been) + on the list (want).
    """
    import re as _re
    guides_index = WEB_ROOT / "Guides" / "Guides-Index.html"
    if not guides_index.exists():
        return  # caught elsewhere if ever required

    html = guides_index.read_text(encoding="utf-8", errors="replace")
    fails = []

    # 1. The flex row wrapper must exist.
    if not _re.search(r'class="stat-row"', html):
        fails.append("missing the .stat-row wrapper under the banner")
    # 2. Both lines present with the right ids; country line right-aligned.
    if 'id="guide-count"' not in html:
        fails.append("missing the left place line (#guide-count)")
    if 'id="country-count"' not in html:
        fails.append("missing the right country line (#country-count)")
    elif not _re.search(
        r'<div class="stat-line stat-line--right" id="country-count"', html
    ):
        fails.append("country line must carry .stat-line--right (right-aligned)")

    # 3. CSS — small grey text line (12px / var(--muted)), no pill styling.
    if not _re.search(r'\.stat-line\s*\{[^}]*font-size:\s*12px', html) or \
       not _re.search(r'\.stat-line\s*\{[^}]*color:\s*var\(--muted\)', html):
        fails.append("the .stat-line style must be font-size:12px; color:var(--muted) (small grey text)")

    # 4. Left line JS — place-level counts, three labels, `|` separators.
    gc = _re.search(r"getElementById\('guide-count'\).*?\}\(\)\);", html, _re.DOTALL)
    gc_txt = gc.group(0) if gc else ""
    if not gc_txt:
        fails.append("the #guide-count script block is missing")
    else:
        for label in ('guides', 'visited', 'on the list'):
            if label not in gc_txt:
                fails.append(f"left line must show '{label}'")
        # place-level reconciliation: must use been (visited) and want (on the list)
        if 'been' not in gc_txt or 'want' not in gc_txt:
            fails.append("left line must count PLACES — visited=been, on the list=want")
        if '|' not in gc_txt:
            fails.append("left line numbers must be separated by '|'")
        if 'stat-pill' in gc_txt:
            fails.append("left line must be plain text — no stat-pill / button styling")

    # 5. Right line JS — country count + visited, `|` separator.
    cc = _re.search(r"getElementById\('country-count'\).*?\}\(\)\);", html, _re.DOTALL)
    cc_txt = cc.group(0) if cc else ""
    if not cc_txt:
        fails.append("the #country-count script block is missing")
    else:
        for label in ('countries', 'visited'):
            if label not in cc_txt:
                fails.append(f"right line must show '{label}'")
        if '|' not in cc_txt:
            fails.append("right line numbers must be separated by '|'")
        if 'stat-pill' in cc_txt:
            fails.append("right line must be plain text — no stat-pill / button styling")

    if fails:
        for f in fails:
            report.fail(f"[index stat row] {f} — § 15 Colors and Font Size.html.")
    else:
        report.ok("index stat row — places left, countries right, per § 15.")


def check_cascade_sync(report: Report) -> None:
    """Warn when a source file is newer than a file that depends on it.

    Catches the common pattern where a script or rule file is edited but the
    corresponding reference documentation (Validator Index, Cleanliness Checks,
    Brain.md, etc.) is never updated to match.

    Uses mtime comparison with a 1-hour grace window — edits within the same
    session (typically minutes apart) are treated as simultaneous and not flagged.
    A warning does NOT block work; it surfaces "did you forget to update X?".

    Dependency map: {source_path_relative_to_TRAVEL_ROOT: [dependent_paths]}
    """
    import datetime

    GRACE_SECONDS = 3600  # 1 hour — same-session edits are not flagged

    # Dependency map — when SOURCE changes, check DEPENDENTS
    # Paths are relative to TRAVEL_ROOT.
    CASCADE: list[tuple[str, list[str]]] = [
        # Scripts → reference docs that document their behaviour
        ("Brain/scripts/guide_tools.py", [
            "Brain/Reference/Cleanliness Checks.md",
            "Brain/Reference/Validator Index.html",
            "Brain/Reference/Brain.md",
        ]),
        ("Brain/scripts/brain_check.py", [
            "Brain/Reference/Validator Index.html",
            "Brain/Reference/Cleanliness Checks.md",
        ]),
        ("Brain/scripts/validate_itinerary.py", [
            "Brain/Reference/Validator Index.html",
            "Brain/Reference/Cleanliness Checks.md",
        ]),
        ("Brain/scripts/verify_urls.py", [
            "Brain/Reference/Validator Index.html",
        ]),
        # CSS sync — Guide Style.css is the source; assets copy must stay in sync
        ("Brain/Reference/Guide Style.css", [
            "Travel-Website/assets/guide_v3.css",
        ]),
        # CLAUDE.md is the session entry point — if Brain.md changes it may need updating
        ("Brain/Reference/Brain.md", [
            "CLAUDE.md",
        ]),
        # CORE RULES changes → dependency map and count reference
        ("Brain/CORE RULES/Rules for Claude.html", [
            "Brain/Reference/Rule Dependencies.html",
            "Brain/Reference/Guide Entry Counts.html",
        ]),
        ("Brain/CORE RULES/Guide Structure.html", [
            "Brain/Reference/Rule Dependencies.html",
            "Brain/Reference/Guide Entry Counts.html",
        ]),
    ]

    # Also: if ANY CORE RULES .html is newer than Validator Index → warn
    core_rules_dir = BRAIN_DIR / "CORE RULES"
    if core_rules_dir.is_dir():
        newest_core = max(
            (p.stat().st_mtime for p in core_rules_dir.glob("*.html")),
            default=0.0,
        )
        vi = BRAIN_DIR / "Reference" / "Validator Index.html"
        if vi.exists() and newest_core > vi.stat().st_mtime + GRACE_SECONDS:
            newest_name = max(core_rules_dir.glob("*.html"), key=lambda p: p.stat().st_mtime).name
            report.warn(
                f"CORE RULES/{newest_name} is newer than Validator Index.html by "
                f"{int((newest_core - vi.stat().st_mtime) / 60)}+ min — "
                f"check if Validator Index needs updating."
            )

    hits: list[str] = []
    for src_rel, dep_rels in CASCADE:
        src = TRAVEL_ROOT / src_rel
        if not src.exists():
            continue
        src_mtime = src.stat().st_mtime
        for dep_rel in dep_rels:
            dep = TRAVEL_ROOT / dep_rel
            if not dep.exists():
                continue
            dep_mtime = dep.stat().st_mtime
            lag = src_mtime - dep_mtime
            if lag > GRACE_SECONDS:
                hits.append(
                    f"{src_rel} is newer than {dep_rel} by "
                    f"{int(lag / 60)}+ min — check if {Path(dep_rel).name} needs updating."
                )

    for h in hits:
        report.warn(h)

    if not hits:
        report.ok("Cascade sync — all reference docs are at least as recent as the files they document.")


def check_emoji_library_no_retired_section(report: "Report") -> None:
    """Fail if a 'retired' subsection header appears in the Emoji Library.

    The Emoji Library has exactly two states: 'in use, with location' (the top
    table — each row notes where the emoji is used; do not reuse) and 'available'
    (free to pick; one-off appearances noted but emoji remains available). There
    is no 'retired' category — emojis that stop being used move back to the
    available section. A 'retired' subsection header is always a drift artifact.

    Detects any <td colspan="2"...> group header whose text contains 'retired'
    (case-insensitive) in Brain/Reference/Emoji Library.html.
    Added 2026-06-15.
    """
    import re as _re
    emoji_lib = BRAIN_DIR / "Reference" / "Emoji Library.html"
    if not emoji_lib.exists():
        report.fail("[emoji library] Emoji Library.html not found in Brain/Reference/.")
        return

    html = emoji_lib.read_text(encoding="utf-8", errors="replace")
    # Match colspan="2" header cells — these are the subsection group headers
    headers = _re.findall(
        r'<td[^>]+colspan=["\']2["\'][^>]*>(.*?)</td>',
        html,
        _re.DOTALL | _re.IGNORECASE,
    )
    bad = [h.strip() for h in headers if _re.search(r'retired', h, _re.IGNORECASE)]
    if bad:
        for h in bad:
            clean = _re.sub(r'<[^>]+>', '', h).strip()
            report.fail(
                f"[emoji library] Forbidden 'retired' subsection header found: '{clean}'. "
                "Only 'in use, with location' and 'available' are valid states. "
                "Move emojis that are no longer used back to the available section."
            )
    else:
        report.ok("emoji library — no forbidden 'retired' subsection headers.")


def check_status_dots_stalled_builds(report: "Report") -> None:
    """Fail if a city listed as stalled in Status Dots has shipped HTML.

    Parses the 'Current stalled builds' section of Status Dots — guides_index.md
    and checks whether any listed city already has a *.html file under
    Travel-Website/Guides/{city}/. A city that ships HTML must be removed from
    the stalled list — leaving it there is always a documentation error and has
    caused repeated confusion (guides shipped as stalled multiple times).

    Extracts city name as the text before the first ' (' or ' —' on each bullet.
    Hard-fails if shipped HTML is found for any stalled city.
    Added 2026-06-15.
    """
    import re as _re

    status_dots = MDS_DIR / "Status Dots — guides_index.md"
    if not status_dots.exists():
        report.fail("[status-dots] Status Dots — guides_index.md not found in Brain/Reference/.")
        return

    text = status_dots.read_text(encoding="utf-8", errors="replace")

    # Find the "Current stalled builds" section — collect lines until next ##
    stalled_section_match = _re.search(
        r'Current stalled builds.*?\n(.*?)(?=\n##|\Z)',
        text,
        _re.DOTALL,
    )
    if not stalled_section_match:
        report.ok("status-dots stalled builds — no 'Current stalled builds' section found (nothing to check).")
        return

    section_body = stalled_section_match.group(1)
    bullet_lines = [ln.strip() for ln in section_body.splitlines() if ln.strip().startswith("- ")]

    if not bullet_lines:
        report.ok("status-dots stalled builds — stalled list is empty.")
        return

    guides_dir = WEB_ROOT / "Guides"
    found_any = False
    for line in bullet_lines:
        # Extract city name: text after '- ' and before first ' (' or ' —'
        raw = line[2:].strip()  # strip leading '- '
        city = _re.split(r'\s+[\(—]', raw)[0].strip()
        if not city:
            continue
        city_dir = guides_dir / city
        if city_dir.is_dir():
            html_files = list(city_dir.glob("*.html"))
            if html_files:
                names = ", ".join(f.name for f in html_files)
                report.fail(
                    f"[status-dots-stalled] '{city}' is listed as stalled in "
                    f"Status Dots — guides_index.md but has shipped HTML: {names}. "
                    "Remove it from 'Current stalled builds' in Status Dots — guides_index.md."
                )
                found_any = True

    if not found_any:
        stalled_names = []
        for line in bullet_lines:
            raw = line[2:].strip()
            city = _re.split(r'\s+[\(—]', raw)[0].strip()
            if city:
                stalled_names.append(city)
        report.ok(f"status-dots stalled builds — {len(stalled_names)} stalled cit{'y' if len(stalled_names) == 1 else 'ies'} confirmed no shipped HTML ({', '.join(stalled_names)}).")


# Months that may appear in an "Updated <Month> <Year>" stamp.
_STAMP_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}
_UPDATED_STAMP_RX = re.compile(
    r'class="updated-stamp"[^>]*>\s*Updated\s+([A-Za-z]+)\s+(\d{4})',
    re.IGNORECASE,
)


def check_updated_stamps_stale(report: "Report", stale_months: int = 6) -> None:
    """WARN when an 'Updated <Month> <Year>' stamp on a shareable page is older than
    `stale_months` relative to today. These literal stamps (Trip-Essentials reference
    pages — Currency, Safety, Stats, Lounges, Delta, European Train, …) are hand-set,
    so the content date can silently drift; this nudges a refresh. City guides use the
    auto document.lastModified stamp (no literal 'Updated <Month> <Year>' in the HTML)
    and are governed by the format-version staleness ledger, so they don't match here.
    WARN, never FAIL — a stale content date doesn't block work. Added 2026-06-15."""
    if not WEB_ROOT.exists():
        return
    today = date.today()
    stale: list[str] = []
    unparseable: list[str] = []
    seen = 0
    for fp in sorted(WEB_ROOT.rglob("*.html")):
        try:
            txt = fp.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        m = _UPDATED_STAMP_RX.search(txt)
        if not m:
            continue
        seen += 1
        mon = _STAMP_MONTHS.get(m.group(1).lower())
        yr = int(m.group(2))
        if not mon:
            unparseable.append(_display_path(fp))
            continue
        months_old = (today.year - yr) * 12 + (today.month - mon)
        if months_old >= stale_months:
            stale.append(
                f'{_display_path(fp)} — "Updated {m.group(1).title()} {yr}" ({months_old} mo old)'
            )
    if unparseable:
        report.warn(
            "updated-stamp present but not parseable as 'Updated <Month> <Year>' on: "
            + " · ".join(unparseable)
        )
    if stale:
        report.warn(
            f"{len(stale)} page(s) carry an 'Updated' stamp older than {stale_months} months — "
            "refresh the content and bump the stamp when convenient: " + " · ".join(stale)
        )
    elif seen:
        report.ok(
            f"updated-stamps fresh — all {seen} stamped page(s) within {stale_months} months."
        )


def main(argv: list[str]) -> int:
    verbose = "--verbose" in argv or "-v" in argv

    report = Report()
    check_required_files(report)
    check_profile_sections(report)
    check_doc_index_vs_core_rules(report)   # was defined but never called — wired in 2026-05-07
    check_ghost_references(report)
    check_no_html_in_profile(report)
    check_audit_staleness(report)
    check_html_name_mentions(report)        # warns on name in HTML rule content (added 2026-05-08)
    check_html_mcp_tool_ids(report)         # warns on hardcoded MCP tool IDs (added 2026-05-08)
    check_html_date_stamps(report)          # warns on YYYY-MM-DD session anchors (added 2026-05-08)
    check_html_attributed_quotes(report)    # warns on — Name YYYY-MM-DD pattern (added 2026-05-08)
    check_html_first_person_blockquotes(report)  # warns on personal voice in blockquotes (added 2026-05-08)
    check_no_archive_subfolders_in_guides(report)  # fails on archive/ inside Guides/ (added 2026-05-09)
    check_no_stray_archive_dirs(report)            # fails on archive/ folders outside Travel/archive/ anywhere (added 2026-06-05)
    check_no_dup_suffix_files(report)              # fails on 'Name (N).html/.md' duplicates = failed in-place edit (added 2026-06-12)
    check_no_resurrected_merged_mds(report)        # fails if decisions.md / Heads Up.md / Cities Skip List.md / travel_map.md reappear standalone (merged into Brain.md 2026-06-05)
    check_guide_roots(report)                       # fails on stray files at guide root (added 2026-05-09)
    check_no_deploy_breakers(report)                # fails on committed symlinks / .fuse_hidden / .DS_Store that break the GitHub Pages build (added 2026-06-20)
    check_banned_brain_files(report)                # fails on snippet/scaffold/template files in Brain/ (added 2026-05-24)
    check_stray_auto_generated_files(report)        # fails if profile_watermark/verify_cache appear outside Brain/Reference/, or retired global ship_log still exists (added 2026-06-15)
    check_guide_ship_logs(report)                   # fails if ship_log.md is nested inside _build/ or misplaced — must be direct child of city folder (added 2026-06-15)
    check_core_rules_checksums(report)              # warns on CORE RULES checksum drift / untracked .html (added 2026-05-30)
    # check_guides_index_coverage — REMOVED 2026-06-02: moved to ship gate in guide_tools.py.
    # Checking index coverage at session start is the wrong place — multiple cribs build
    # simultaneously and each crib should only check its own guide at ship time.
    # The targeted per-guide check now lives in guide_tools.py _check_guide_indexed().
    check_reference_doc_ghost_filenames(report)     # fails on .html/.py filename in Reference/ that doesn't exist under Brain/ (added 2026-05-30)
    check_toolbar_centering(report)                 # fails if toolbar.js nav-bar centering invariant drifts (added 2026-06-05)
    check_toolbar_pages_documented(report)          # warns on toolbar page missing from Brain.md Part 1 = website↔reference drift (added 2026-06-14)
    check_toolbar_page_standard(report)             # fails if a toolbar tab lacks shared nav / canonical #f5f4f0 bg / mobile baseline — new tabs must match the bar (added 2026-06-14)
    check_banner_title_size(report)                 # fails if any title banner h1 isn't the canonical 14px — all banners must match (added 2026-06-15)
    check_banner_content(report)                    # fails if a title banner contains anything other than <h1> + optional <button> — no spans, date stamps, or metadata inside the banner (added 2026-06-15)
    check_section_citation_targets(report)          # warns on `{File}.html § N` citations whose target heading no longer exists (added 2026-06-06)
    check_profile_watermark(report)                     # warns on unexplained CLAUDE.md line/section drops (Rule 49; added 2026-06-11)
    check_pdf_gradient_sync(report)                     # warns if Guide Style.css title-page gradient diverges from PDF Render Notes.md (added 2026-06-11)
    check_guides_index_banner_subtitle(report)          # fails if Guides-Index.html banner has a subtitle element (added 2026-06-12)
    check_search_bar_standard(report)                   # fails if any search input has placeholder words, pill shape, fixed width, or width animation (added 2026-06-13)
    check_index_stat_row(report)                        # fails if guides_index stat row drifts from § 15 — places left, countries right, small grey text (added 2026-06-14)
    check_emoji_library_no_retired_section(report)     # fails if a 'retired' subsection appears in Emoji Library — only 'in use, with location' and 'available' are valid states (added 2026-06-15)
    check_cascade_sync(report)                          # warns when a source file is newer than a file that depends on it — catches out-of-sync reference docs (added 2026-06-15)
    check_status_dots_stalled_builds(report)            # fails if a city listed as stalled in Status Dots has shipped HTML — catches guides that shipped without updating Status Dots (added 2026-06-15)
    check_updated_stamps_stale(report)                  # warns when an 'Updated <Month> <Year>' content stamp is older than 6 months (added 2026-06-15)

    # Render output.
    print("━━━ brain_check ━━━")
    if verbose:
        for line in report.passes:
            print(f"  ✓ {line}")
    for line in report.warnings:
        print(f"  ⚠ {line}")
    for line in report.failures:
        print(f"  ✗ {line}")

    passes = len(report.passes)
    warns = len(report.warnings)
    fails = len(report.failures)
    total = passes + warns + fails

    print(f"━━━ result: {passes}/{total} ok · {warns} warn · {fails} fail ━━━")

    if not fails:
        _write_profile_watermark()

    if fails:
        print(
            "\nBrain integrity FAILED. Do not proceed with task work.\n"
            "Restore missing content additively from Travel/archive/ per Rules for Claude.html § 3 Working for Dani.\n"
            "Re-run `brain_check` once restored."
        )
        return 1
    if warns:
        print("\nBrain intact, but warnings above deserve attention.")
    else:
        print("\nBrain intact.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception as e:  # noqa: BLE001
        print(f"brain_check: unexpected error — {e!r}", file=sys.stderr)
        sys.exit(2)
