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

import hashlib
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
ASSETS_DIR = WEB_ROOT / "assets"                 # shared js/css home: toolbar.js, weather.js, guide-style.css, mobile.css, climate.json (moved out of Guides/ 2026-06-13; footnote.js removed 2026-06-21)
MYDRIVE_ROOT = TRAVEL_ROOT.parent                # My Drive/
ON_THE_GO_DIR = TRAVEL_ROOT / "On The Go"  # Travel/On The Go/ — NOT validated; mobile crib territory, validator only audits guide-building infrastructure.
TODO_DIR = TRAVEL_ROOT / "To Do List"            # Travel/To Do List/  (moved from Brain/ 2026-05-01)
CLAUDE_MD = TRAVEL_ROOT / "CLAUDE.md"
TOOLBAR_JS = ASSETS_DIR / "toolbar.js"   # shared nav bar rendered on every page; PERMANENT home = Travel-Website/assets/ (moved out of Guides/ 2026-06-13); centering invariant checked below (added 2026-06-05)
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
    HERE / "validate_itinerary.py",
    HERE / "verify_urls.py",
    HERE / "verify_booking_links.py",   # ship-gate: log coverage + h1-match (added 2026-04-24)
    HERE / "commons_photo.py",
    HERE / "photo_provenance.py",   # photo-authenticity gate: provenance writer + verify_guide_photos (added 2026-06-27)
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
    # End at the next header of EITHER level (## or ###). The CORE RULES file
    # index is a ### subsection of ## Quick Reference, immediately followed by
    # the ### Validators table — which legitimately cites non-CORE-RULES pages
    # in backticks (e.g. `Guides-Index.html`). Stopping only at `## ` let the
    # block swallow the Validators table and mis-flagged those as ghost CORE
    # RULES files. Bounding to the next `##`/`###` keeps the scan to this table.
    next_h = re.search(r"^###?\s", text[start:], re.MULTILINE)
    end = start + next_h.start() if next_h else len(text)
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
        f"shape facts belong in guide-style.css comments, not in profile fences."
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
    # After single-clone migration (2026-07-04), the repo root IS the Travel folder,
    # so the archive sits directly at TRAVEL_ROOT/archive/ (no nested Travel/ level).
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

_GUIDE_FILENAME_RE = re.compile(r'^(?!.*\s)[a-z0-9àáâãäåèéêëìíîïðòóôõöøùúûüýþÿçñ][a-z0-9àáâãäåèéêëìíîïðòóôõöøùúûüýþÿçñ_\-]*_v\d+\.html$', re.UNICODE)

# Pre-existing mis-named guides, grandfathered as WARN (not a hard fail) so they
# don't freeze the global ship gate while their renames are queued. Each needs a
# rename to {city_slug}_vN.html + index-card/FMAP/map-pin updates; remove from this
# set the moment that lands. A NEW mis-named guide (not in this set) hard-fails.
# Snapshot 2026-06-26 — see audit_log "Ritual made un-skippable" + "guide_vN.html".
# Companion pages allowed inside a guide folder — not versioned guides,
# never renamed to {city_slug}_vN.html.
_GUIDE_COMPANION_RE = __import__("re").compile(r'^.+-read-about\.html$')

_GRANDFATHERED_GUIDE_FILENAMES = {
    "Azores/guide_v1.html",
    "Cairo/Cairo.html",
    "Dubrovnik/guide_v2.html",
    "Glacier National Park/guide_v2.html",
    "Lake Tahoe/Lake Tahoe.html",
    "Manuel Antonio/Manuel Antonio.html",
}

def check_guide_filenames(report: Report) -> None:
    """
    Fail if a guide's HTML file is not named {city_slug}_vN.html.

    Rule source: Brain/CORE RULES/Rules for Claude.html § ("A guide directory …
    holds … the guide HTML (`{city}_vN.html`)"). check_guide_roots enforces the
    file *type* (.html/.pdf) but never the *name*, so two drift patterns slipped
    through unflagged:
      • the generic placeholder `guide_vN.html` — a crib that skipped the Phase 0
        read doesn't know guides are named by city, so it defaults the slug to the
        literal word "guide" (Azores, Dubrovnik, Glacier all did this).
      • the space/titlecase twin `City Name.html` — no `_vN`, spaces, capitals
        (Cairo.html, Lake Tahoe.html, Manuel Antonio.html).
    The read-gate hook stops new occurrences at the source; this is the
    deterministic backstop that catches them even if the hook ever fails open.

    The slug itself is intentionally NOT checked against the folder name — slugs are
    legitimately abbreviated (San Francisco → sf_v3, Carmel-by-the-Sea → carmel_v1).
    Only the shape ({slug}_vN.html, lowercase) and the generic-"guide" placeholder
    are enforced. Added 2026-06-26.
    """
    guides_dir = WEB_ROOT / "Guides"
    if not guides_dir.exists():
        return

    fails = []
    grandfathered = []
    for city_dir in sorted(guides_dir.iterdir()):
        if not city_dir.is_dir():
            continue
        for item in sorted(city_dir.iterdir()):
            if item.is_dir() or item.suffix.lower() != ".html":
                continue
            if item.name == "Guides-Index.html":
                continue
            if _GUIDE_COMPANION_RE.match(item.name):
                continue
            rel = f"{city_dir.name}/{item.name}"
            if item.name.startswith("guide_v"):
                msg = (
                    f"Guides/{rel} — generic placeholder name: the slug is the literal "
                    f"word 'guide' instead of the city. A build that skipped the Phase 0 read. "
                    f"Rename to {{city_slug}}_vN.html and update its index card / FMAP / map-pin references."
                )
            elif not _GUIDE_FILENAME_RE.match(item.name):
                suggest = city_dir.name.lower().replace(" ", "_")
                msg = (
                    f"Guides/{rel} — guide file not named {{city_slug}}_vN.html "
                    f"(lowercase, no spaces, ends in _v<digits>). Rename to e.g. {suggest}_v1.html "
                    f"and update its index card / FMAP / map-pin references."
                )
            else:
                continue
            if rel in _GRANDFATHERED_GUIDE_FILENAMES:
                grandfathered.append(msg + "  [grandfathered — rename queued]")
            else:
                fails.append(msg)

    for m in fails:
        report.fail(m)
    for m in grandfathered:
        report.warn(m)
    if not fails and not grandfathered:
        report.ok("Guide filenames clean — every guide named {city_slug}_vN.html.")

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
    "guide-style.css",         # Travel-Website/assets/
    "Guides-Index.html",    # Travel-Website/Guides/
    "Trips.html",           # Travel-Website/Trip-Essentials/
    "Resources.html",       # RETIRED 2026-06-25 — archived; still referenced historically in Brain.md/Cleanliness Checks.md
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
    # Enforcement-Standards.md lists aspirational/planned check scripts in a spec table.
    # None of these scripts exist yet (check_typography_standard.py, etc.). Excluded 2026-06-25.
    "Enforcement-Standards.md",
    # Travel-Folder-Organization.md uses `city_v1.html` / `city_v2.html` as illustrative
    # example names in a NEVER-add list — not real file pointers. Excluded 2026-07-05.
    "Travel-Folder-Organization.md",
    # Brain.md (Part 1 Folder Map) intentionally records RETIRED / archived file paths
    # in its documentation prose (e.g. Travel/archive/Resources-superseded-*.html).
    # These archive references are valid documentary records, not stale pointers.
    # Excluded 2026-07-05 (same rationale as audit_log.md).
    "Brain.md",
    # Validator Index.html documents check rules using illustrative bad-example filenames
    # (e.g. `new_orleans_v1.html` as the underscore-form that fails the hyphenation check).
    # These are examples of invalid names, not real file pointers. Excluded 2026-07-06.
    "Validator Index.html",
    # Read-About-Pages.html is the companion-page spec doc — it uses illustrative example filenames
    # (paris-read-about.html, new-orleans-read-about.html, story.html, -read-about.html) as template
    # patterns and negative examples, not real file pointers. Excluded 2026-07-09.
    "Read-About-Pages.html",
    # Guides-Index-Format.html uses ./City-Folder/city_vN.html as illustrative example paths
    # in its spec prose — not real file pointers. Excluded 2026-07-11.
    "Guides-Index-Format.html",
    # Maps-Layout.html uses paris_v6.html and ../../Guides/City-Folder/city_vN.html as
    # illustrative example paths — not real file pointers. Excluded 2026-07-11.
    "Maps-Layout.html",
    # Non-Guide-Ship-Checklist.html references "Currency Guide.html" (the spaced pre-hyphenation
    # form) as an example of filename issues — not a real file pointer. Excluded 2026-07-11.
    "Non-Guide-Ship-Checklist.html",
    # Stats-Pages-Format.html uses ../Guides/City-Folder/city_vN.html as illustrative
    # example paths — not real file pointers. Excluded 2026-07-11.
    "Stats-Pages-Format.html",
    # Cleanliness Checks.md documents ghost-filename exclusion rules using illustrative
    # example paths (./City-Folder/city_vN.html, paris_v6.html) — not real file pointers.
    # Excluded 2026-07-11.
    "Cleanliness Checks.md",
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
    "Visa Check.html",       # archived to Travel/archive/ 2026-06-14; was a tab inside Resources.html; Resources.html itself retired 2026-06-25 (archived to Travel/archive/Resources-superseded-2026-06-25.html); Brain.md explicitly notes "do not recreate"
    "Documents & Entry.html",# archived to Travel/archive/ 2026-06-14; Brain.md explicitly notes "do not recreate"
    "Trips v2.html",         # v2 variant referenced in Brain.md root table but never created; stale ref
    "Travel Packing v2.html",# v2 variant referenced in Brain.md root table but never created; stale ref
    "Lounges Europe v2.html",# v2 variant referenced in Brain.md root table but never created; stale ref
    "Lounges US v2.html",    # v2 variant referenced in Brain.md root table but never created; stale ref
    "guides_index.html",     # was a committed symlink that broke deploys (2026-06-20); mentioned as a deploy-breaker example in Cleanliness Checks.md
    "new_orleans_v1.html",   # illustrative bad-filename example in Cleanliness Checks.md rule 466; actual file is new-orleans_v1.html
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
                # Normalise: URL-decode (%20 → space), strip a published-site
                # URL prefix (e.g. https://dbellinello.github.io/Travel/) down to
                # the Travel-relative path, then strip leading ../ sequences.
                ref_clean = unquote(ref)
                ref_clean = re.sub(r'^https?://[^/]+/Travel/', '', ref_clean)
                ref_clean = re.sub(r'^(?:\.\./|\./)+', '', ref_clean)
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
                        # Guide links in docs are written index-relative
                        # (`./City/file.html`) — resolve those under Guides/.
                        or (WEB_ROOT / "Guides" / stripped).exists()
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
#      active tab, pushing the first button (Guides) off the left edge.
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
    # footnote.js (footer sharing bar) was REMOVED 2026-06-21 — archived to
    # Travel/archive/, all traces stripped from toolbar.js and the guides. No
    # existence check anymore; the file is intentionally gone.
    # toolbar.js must stay INSIDE Travel-Website/assets/ — fail if a stray copy
    # reappears at the Travel root or in Guides/ (the old pre-2026-06-13 home).
    for stray in (TRAVEL_ROOT / "toolbar.js",
                  WEB_ROOT / "Guides" / "toolbar.js"):
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
            "scroll and the active-tab auto-scroll then hides the first button (Guides). "
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

    # Required: the mobile hamburger title (.tb-ham-label) must cancel mobile.css's
    # universal 40px tap-target `a{}` rule. It became an <a> (from a <span>) when it
    # was wired to link to Trips.html (commit e45eb60d1) — without the override, the
    # inflated block-level box pushes "THE VOYAGER EXPERT" text off the bar's vertical
    # center on phones (same class of bug as `.title-address a{min-height:0}` in
    # guide-style.css). Caught 2026-07-12 from a live screenshot.
    if not re.search(r"\.tb-ham-label\{[^}]*min-height:0", flat):
        problems.append(
            "the mobile .tb-ham-label rule no longer overrides min-height — mobile.css's "
            "universal a{min-height:40px} tap-target rule will inflate the hamburger "
            "title's box and push its text off-center in the toolbar. Add "
            "min-height:0!important to .tb-ham-label"
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


def _toolbar_item_paths() -> "list[str] | None":
    """Parse assets/toolbar.js → list of ITEMS href paths (site-root-relative,
    URL-decoded), excluding the Guides index (guides:true). Returns None if the
    array can't be located (callers then no-op — check_toolbar_pages_documented
    already warns loudly on a renamed array)."""
    if not TOOLBAR_JS.exists():
        return None
    src = TOOLBAR_JS.read_text(encoding="utf-8")
    m = re.search(r"ITEMS\s*=\s*\[(.*?)\];", src, re.S)
    if not m:
        return None
    block = m.group(1)
    paths: list[str] = []
    for entry in re.finditer(r"href:\s*base\s*\+\s*'([^']+)'(?P<rest>[^}]*)", block):
        if re.search(r"guides\s*:\s*true", entry.group("rest")):
            continue  # the Guides index — deliberate omission (documented separately)
        paths.append(unquote(entry.group(1)))
    return paths


def check_toolbar_in_main_pages(report: Report) -> None:
    """WARN when a page wired into assets/toolbar.js ITEMS is missing from
    Travel-Website/Website-Main-Pages-Links.html (the shareable Main Pages
    directory). Toolbar.html § 4 + CLAUDE.md: the toolbar and the Main Pages
    index must list the same set (the Guides index is the one deliberate
    omission). Nothing enforced this parity before — a page added to the bar
    without a matching hub row drifted silently (caught Europe-Stats, 2026-06-21).

    WARN, not FAIL — a stale hub doesn't block a build, but must not stay
    invisible. Fix = add the missing leaf to Website-Main-Pages-Links.html
    ('New page added to toolbar' cascade in Change Cascade.html)."""
    paths = _toolbar_item_paths()
    if paths is None:
        return
    hub = WEB_ROOT / "Website-Main-Pages-Links.html"
    if not hub.exists():
        report.fail(
            f"Website-Main-Pages-Links.html missing at {_display_path(hub)} — the "
            "shareable Main Pages directory that mirrors the toolbar is gone."
        )
        return
    hub_text = hub.read_text(encoding="utf-8")
    missing: list[str] = []
    for path in paths:
        filename = path.rstrip("/").split("/")[-1]
        # the hub stores absolute github.io URLs; match on the filename, which is
        # unique across the site (every toolbar target is a distinct .html file).
        if filename and filename not in hub_text:
            missing.append(f"{filename}  (toolbar path: {path})")
    if missing:
        report.warn(
            "toolbar↔Main-Pages-Links drift — "
            f"{len(missing)} toolbar page(s) absent from Website-Main-Pages-Links.html "
            "(the shared Main Pages hub): "
            + " · ".join(missing)
            + ". A tab is on the bar but missing from the directory friends use. "
            "Add each as a leaf row with its live link — 'New page added to toolbar' "
            "cascade in Brain/Reference/Change Cascade.html."
        )
    else:
        report.ok(
            "toolbar↔Main-Pages-Links parity — every toolbar page is listed in the "
            "Main Pages hub."
        )


def check_main_pages_internal_links(report: Report) -> None:
    """WARN on broken internal links across the shareable site pages — every
    relative *.html href in a Trip-Essentials page (and the two site-root hub
    pages) must resolve to a file on disk.

    Why (added 2026-06-21): the stats/reference pages cross-link each other and
    link guides; nothing checked those targets, so rot accumulated silently —
    Stats-Across-US.html linked every city through ../../Guides/ (depth-2) from a
    depth-1 page (531 dead links); Munich links pointed at a bumped v1 filename;
    a Plug-Adapter link kept spaces after the folder was hyphenated. validate_*
    scripts each cover one generated page; this is the cross-page integrity net.

    WARN, not FAIL — pre-existing dead links (e.g. a link to an unbuilt city)
    shouldn't block every unrelated session; the pre-push guard + Pages workflow
    remain the hard publish gates. Surfacing them here gets them fixed in-pass."""
    essentials = WEB_ROOT / "Trip-Essentials"
    if not essentials.exists():
        return  # nothing to scan; other checks fail on a missing web root
    pages = sorted(essentials.rglob("*.html"))
    for root_page in ("index.html", "Website-Main-Pages-Links.html"):
        p = WEB_ROOT / root_page
        if p.exists():
            pages.append(p)

    href_re = re.compile(r'href\s*=\s*"([^"#?]+\.html)(?:[#?][^"]*)?"', re.I)
    broken: list[str] = []
    for page in pages:
        base = page.parent
        try:
            text = page.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        seen: set[str] = set()
        for href in href_re.findall(text):
            if href.startswith(("http://", "https://", "mailto:", "//")):
                continue
            if href in seen:
                continue
            seen.add(href)
            target = (base / unquote(href)).resolve()
            if not target.exists():
                broken.append(f"{page.name} → {href}")

    if broken:
        shown = broken[:25]
        more = f"  …+{len(broken) - len(shown)} more" if len(broken) > len(shown) else ""
        report.warn(
            f"broken internal links on shareable pages — {len(broken)} dead "
            f"relative .html link(s): " + " · ".join(shown) + more
            + ". Fix the href (wrong depth / stale version filename / renamed "
            "folder) or build the missing target; if a link points at an unbuilt "
            "city, remove it until the guide ships."
        )
    else:
        report.ok(
            "internal links — every relative .html link on the shareable pages "
            "resolves on disk."
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

    The search-bar colour standard (§ 14 — focus ring #C8B99A, placeholder #A8895A,
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
        # Accept #f5f4f0 set inline OR via web-travel-style.css (which sets body{background:var(--bg)} where --bg:#f5f4f0)
        has_bg = "f5f4f0" in html.lower() or "web-travel-style.css" in html
        if not has_bg:
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
    nav (check_toolbar_page_standard); guide-page CSS stays separate (guide-style.css)
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
            # font-size — the canonical 14px
            m = re.search(r'font-size:\s*([^;]+)', body, re.I)
            if m:
                val = m.group(1).replace("!important", "").strip()
                if val not in OK_VALUES:
                    failures.append(
                        f"{rel}: title-banner h1 font-size is {val} — every banner must be "
                        "14px (var(--fs-title)) so all title banners match."
                    )
            # colour — the canonical dark #3d3a32 (NOT gold/terracotta/accent/white).
            # The shared sheet forces this with !important so an off-standard inline
            # value renders correct but is a misleading template a crib clones — pin
            # the source. (caught Delta/Lounges/Packing gold+600 titles 2026-06-21)
            mc = re.search(r'(?<!-)color:\s*([^;]+)', body, re.I)
            if mc:
                cval = mc.group(1).replace("!important", "").strip().lower()
                if cval not in ("#3d3a32", "var(--text)", "#3d3a32ff"):
                    failures.append(
                        f"{rel}: title-banner h1 colour is {mc.group(1).strip()} — every "
                        "banner title is the dark #3d3a32 (no gold/terracotta/accent/white). "
                        "Match it or drop the override (the shared sheet already sets it)."
                    )
            # weight — the canonical bold 700 (NOT 600).
            mw = re.search(r'font-weight:\s*([^;]+)', body, re.I)
            if mw:
                wval = mw.group(1).replace("!important", "").strip().lower()
                if wval not in ("700", "bold"):
                    failures.append(
                        f"{rel}: title-banner h1 font-weight is {wval} — banner titles are "
                        "700 (bold). Match it or drop the override."
                    )

    # The shared default — assets/web-travel-style.css. Pages that DON'T override
    # inherit their banner h1 size from here, so this rule is the real root: if it
    # ever drifts off 14px again (it was hardcoded 18px until 2026-06-21), every
    # page that relies on the shared sheet silently renders the wrong size while the
    # per-page loop above still passes. Pin it so the contradiction can't return.
    for shared_name in ("web-travel-style.css", "mobile.css"):
        shared = ASSETS_DIR / shared_name
        if not shared.exists():
            continue
        css = _strip_media_print(shared.read_text(encoding="utf-8", errors="replace"))
        for rule in re.finditer(r'([^{}]+)\{([^}]*)\}', css):
            sel, body = rule.group(1), rule.group(2)
            if not re.search(r'(?:\.header|\.page-header|\.site-header)\s+h1|\.site-title', sel):
                continue
            m = re.search(r'font-size:\s*([^;]+)', body, re.I)
            if not m:
                continue
            val = m.group(1).replace("!important", "").strip()
            if val not in OK_VALUES:
                failures.append(
                    f"assets/{shared_name}: shared banner h1 font-size is {val} — the "
                    "shared default every non-overriding page inherits (desktop "
                    "web-travel-style.css + mobile mobile.css) must be 14px "
                    "(var(--fs-title)), one size everywhere. NEVER hardcode 18/16px here."
                )

    if failures:
        for f in failures:
            report.fail(f"[banner-title-size] {f}")
    else:
        report.ok("banner-title-size — every title banner h1 (and the shared default) renders at the canonical 14px.")


# Banner title-strip classes, matched as WHOLE class tokens (so "card-header",
# "region-header", "country-header" etc. are never mistaken for the page banner).
_BANNER_CLASS_TOKENS = ("header", "page-header", "site-header")
# Subtitle / eyebrow elements the shared sheets force to display:none
# (web-travel-style.css + mobile.css — "banner must contain only h1"). They are
# invisible, so they create NO vertical space between the title and the underline
# bar. Allowed to remain inside the banner; everything else that renders does not.
_BANNER_HIDDEN_CLASSES = (
    "header-desc", "header-label", "header-eyebrow", "page-header-eyebrow", "eyebrow",
)


def _banner_inner_blocks(html: str) -> "list[tuple[str, str]]":
    """Yield (class-attr, inner-html) for every title-banner <div> on the page,
    matched by exact class token and div-balanced so nested wrappers (the page
    body <div class="page"> that closes only at the very end) never swallow the
    banner or bleed unrelated markup into it."""
    events = list(re.finditer(r'<div\b[^>]*>|</div>', html, re.I))
    out: list[tuple[str, str]] = []
    for i, ev in enumerate(events):
        tok = ev.group(0)
        if tok.lower().startswith("</"):
            continue
        cm = re.search(r'\bclass=["\']([^"\']*)["\']', tok, re.I)
        if not cm:
            continue
        if not any(t in _BANNER_CLASS_TOKENS for t in cm.group(1).split()):
            continue
        depth, j = 1, i + 1
        while j < len(events) and depth > 0:
            depth += -1 if events[j].group(0).lower().startswith("</") else 1
            j += 1
        close = events[j - 1].start() if j - 1 < len(events) else len(html)
        out.append((cm.group(1), html[ev.end():close]))
    return out


def check_banner_content(report: "Report") -> None:
    """FAIL when a shareable page's title banner (.header / .page-header /
    .site-header) holds any VISIBLE element other than the <h1> — i.e. anything
    that opens a gap between the title and the underline bar beneath it.

    The banner is a pure title strip: <h1> only, plus an optional <button> or a
    source-link <a> that rides the title line. A subtitle <p>, a metadata <span>,
    a date stamp, or any extra <div> pushes the underline down and detaches the
    title from its bar — that drift is what this gates (caught the Travel Packing
    page's intro <p> on 2026-06-29). The display:none eyebrow/subtitle classes
    (header-desc, header-label, …) are exempt: the shared sheets hide them, so
    they take no space. Put real subtitles below the banner / updated-stamp.

    Scope: same shareable set as the other banner checks (every Trip-Essentials
    page + guides_index + Website Main Pages Links + index). Matched by whole
    class token, so .card-header / .region-header are never touched.
    """
    _ANY_TAG_RE = re.compile(r'<(/?\w+)[^>]*>', re.I)
    # Strip the shared-CSS-hidden subtitle/eyebrow elements before scanning — they
    # render at display:none and so add no space between the title and the bar.
    _hidden_strip = re.compile(
        r'<(div|p|span)\b[^>]*\bclass=["\'][^"\']*\b(?:'
        + "|".join(_BANNER_HIDDEN_CLASSES)
        + r')\b[^"\']*["\'][^>]*>.*?</\1>',
        re.S | re.I,
    )

    failures: list[str] = []
    for page in _shareable_pages():
        try:
            html = page.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        rel = page.relative_to(WEB_ROOT)
        for _classval, inner in _banner_inner_blocks(html):
            inner = _hidden_strip.sub("", inner)
            for tag_m in _ANY_TAG_RE.finditer(inner):
                tag = tag_m.group(1).lower().lstrip("/")
                if tag not in ("h1", "button", "a", "!--"):
                    failures.append(
                        f"{rel}: banner contains a visible <{tag}> beside the <h1> — "
                        "it opens a gap between the title and the bar below. Banners "
                        "hold only <h1> (+ optional <button> / source-link <a>); move "
                        "subtitles, date stamps, or metadata out of the banner div."
                    )
                    break  # one failure per banner is enough

    if failures:
        for f in failures:
            report.fail(f"[banner-content] {f}")
    else:
        report.ok("banner-content — every title banner is a pure <h1> strip (no gap above the bar).")


# Pages scanned by the page-format checks below: the same shareable, non-guide
# set as the banner checks — every Trip-Essentials page (so a NEW page is gated
# the moment it lands, with or without a toolbar entry) + the guides index, the
# Main Pages hub, and the site-root redirect.
def _shareable_pages() -> "list[Path]":
    pages = list((WEB_ROOT / "Trip-Essentials").rglob("*.html"))
    for extra in ("Guides/Guides-Index.html", "Website-Main-Pages-Links.html", "index.html"):
        p = WEB_ROOT / extra
        if p.exists():
            pages.append(p)
    return pages


def check_banner_h1_text_only(report: "Report") -> None:
    """FAIL when a page's title-banner <h1> contains an emoji or other non-text
    glyph. The banner h1 is text-only and uppercase (Essentials-Pages-Rules.md
    'Banner rules' + Colors and Font Size.html § Title Banner); the emoji belongs
    in the toolbar link label and the page subtitle, never in the heading. Cribs
    keep pasting the tab's emoji into the h1 (caught Pickleball 🏓
    on 2026-06-21) — this pins it. Glob-driven, so a new page is gated at session
    start. Claude-maintained — no approval needed."""
    # Banner header block: <h1> living inside a .page-header / .site-header / .header
    # div (compound classes like "site-header wx-banner" included).
    banner_h1 = re.compile(
        r'<div[^>]+class=["\'][^"\']*(?:page-header|site-header|header)[^"\']*["\'][^>]*>'
        r'.*?<h1[^>]*>(.*?)</h1>',
        re.S | re.I,
    )
    # Emoji / pictographic / regional-indicator / variation-selector ranges.
    emoji = re.compile(
        "[\U0001F000-\U0001FAFF"   # emoji, pictographs, symbols & supplemental
        "\U0001F1E6-\U0001F1FF"     # regional indicators (flag pairs, e.g. 🇺🇸)
        "\U00002190-\U000021FF"     # arrows
        "\U00002300-\U000027BF"     # misc technical, dingbats, misc symbols
        "\U00002B00-\U00002BFF"     # misc symbols & arrows
        "\U0000FE00-\U0000FE0F"     # variation selectors (emoji-style)
        "\U000020E3"                # combining enclosing keycap
        "\U00002122\U00002139]"     # ™  ℹ
    )
    failures: list[str] = []
    for page in _shareable_pages():
        try:
            html = page.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        rel = page.relative_to(WEB_ROOT)
        for inner in banner_h1.findall(html):
            hit = emoji.search(inner)
            if hit:
                txt = re.sub(r"<[^>]+>", "", inner).strip()
                failures.append(
                    f"{rel}: banner h1 contains a non-text glyph "
                    f"({hit.group()!r}) — \"{txt}\". The title banner is text-only; "
                    "move the emoji to the toolbar label / subtitle."
                )
                break
    if failures:
        for f in failures:
            report.fail(f"[banner-h1-text] {f}")
    else:
        report.ok("banner-h1-text — every title banner h1 is text-only (no emoji).")


def _horiz_padding_values(body: str) -> "list[str]":
    """Horizontal padding tokens declared in a CSS rule body. Reads
    padding-left/right and the shorthand `padding:` (positions 2 & 4 = L/R).
    Returns the raw tokens (e.g. ['16px']); empty if none set."""
    out: list[str] = []
    for m in re.finditer(r'padding-(left|right)\s*:\s*([^;]+)', body, re.I):
        out.append(m.group(2).replace("!important", "").strip())
    sh = re.search(r'(?<![\w-])padding\s*:\s*([^;]+)', body, re.I)
    if sh:
        parts = sh.group(1).replace("!important", "").split()
        if len(parts) == 1:
            out += [parts[0], parts[0]]
        elif len(parts) == 2:
            out.append(parts[1])                       # L = R = 2nd token
        elif len(parts) == 3:
            out.append(parts[1])                       # L = R = 2nd token
        elif len(parts) >= 4:
            out += [parts[1], parts[3]]                # R = 2nd, L = 4th
    return out


def check_page_margins(report: "Report") -> None:
    """FAIL on the two horizontal-margin anti-patterns that make pages sit at
    different gutters from the rest of the site (Dani: 'wrong spacing from the
    margins'). The canonical page gutter is the shared `.wrap` — 0 32px desktop /
    0 14px mobile (assets/web-travel-style.css). Two ways a page drifts:

      1. body carries a horizontal padding — gutters belong on the content
         container, never on <body> (a body pad shifts the whole page, toolbar
         included, off every other page). Caught Weather's `body{padding:0 20px
         !important}` 2026-06-21.
      2. a `.wrap` override sets a horizontal padding that is neither 32px nor
         14px (and isn't a deliberately width-capped variant that also sets
         max-width). Caught Trips 16px / Europe-Stats 12px 2026-06-21.

    Glob-driven (every shareable page incl. brand-new ones). Custom-named
    containers (.page/.cf-wrap/.page-wrap) that already render 32px are out of
    scope here — the standard is to use `.wrap`; new pages should. Claude-
    maintained — no approval needed."""
    OK_H = {"0", "14px", "32px"}

    def _is_body_selector(sel: str) -> bool:
        """True only when a comma-separated selector token targets the <body>
        element itself (body / html,body / body.x / body:root) — not a class that
        merely ends in '-body' (.trip-body) and not the word 'body' in a comment."""
        return any(
            re.match(r'^body(?:[.:#\[\s]|$)', tok.strip())
            for tok in sel.split(",")
        )

    failures: list[str] = []
    for page in _shareable_pages():
        try:
            html = page.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        rel = page.relative_to(WEB_ROOT)
        # Strip CSS comments so a "/* Trip body */" note can't masquerade as a selector.
        html_nc = re.sub(r'/\*.*?\*/', ' ', html, flags=re.S)
        for rule in re.finditer(r'([^{}]+)\{([^}]*)\}', html_nc):
            sel, body = rule.group(1).strip(), rule.group(2)
            # 1. body horizontal padding
            if _is_body_selector(sel):
                for val in _horiz_padding_values(body):
                    if val not in OK_H:
                        failures.append(
                            f"{rel}: <body> sets horizontal padding ({val}) — page "
                            "gutters belong on the .wrap container, not <body>. "
                            "Remove it; wrap content in <div class=\"wrap\"> (0 32px "
                            "desktop / 0 14px mobile)."
                        )
                        break
            # 2. .wrap padding override (skip width-capped variants)
            if re.search(r'(?<![\w-])\.wrap(?![\w-])', sel):
                if re.search(r'max-width\s*:', body, re.I):
                    continue
                for val in _horiz_padding_values(body):
                    if val not in OK_H:
                        failures.append(
                            f"{rel}: `.wrap` is overridden to a non-standard "
                            f"horizontal padding ({val}) — the shared gutter is "
                            "32px desktop / 14px mobile. Match it or drop the override."
                        )
                        break
    if failures:
        for f in failures:
            report.fail(f"[page-margins] {f}")
    else:
        report.ok("page-margins — no body gutters; every .wrap override matches the 32/14 standard.")


def check_inline_base_reset(report: "Report") -> None:
    """FAIL on any shareable page that defines * {}, body {}, or :root {} in an
    inline <style> block with standard properties (font, margin, padding, color,
    box-sizing, etc.).  SHARED CSS ONLY rule (CLAUDE.md): 'NEVER define body {},
    * {}, :root {} in pages — these belong ONLY in web-travel-style.css.'

    A :root {} that ONLY sets page-specific custom properties (--hubby, --wifey)
    is exempt — those are additions, not redefinitions of the shared base.
    A :root {} that redefines shared palette vars (--text, --surface, --bg, --accent,
    --border, --muted, --warm, --hover, --border2, --navy, --green, --gold) is a
    violation."""
    SHARED_VARS = {"--text", "--surface", "--bg", "--accent", "--border", "--muted",
                   "--warm", "--hover", "--border2", "--navy", "--green", "--gold"}
    LAYOUT_ONLY_PROPS = {"display", "flex-direction", "height", "min-height",
                         "overflow", "padding-bottom", "flex"}
    SEL_PAT = re.compile(
        r'(?:^|[,\s])'
        r'(\*|:root|body)'
        r'\s*\{([^}]*)\}',
        re.MULTILINE,
    )
    failures: list[str] = []
    for page in _shareable_pages():
        try:
            html = page.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        rel = page.relative_to(WEB_ROOT)
        for style_block in re.findall(r'<style[^>]*>(.*?)</style>', html, re.S | re.I):
            clean = re.sub(r'/\*.*?\*/', ' ', style_block, flags=re.S)
            for m in SEL_PAT.finditer(clean):
                sel, body = m.group(1), m.group(2)
                if sel == ":root":
                    props = re.findall(r'(--[\w-]+)\s*:', body)
                    if props and not any(p in SHARED_VARS for p in props):
                        continue
                if sel == "body":
                    props = {p.strip().split(":")[0].lower()
                             for p in body.split(";") if ":" in p}
                    if props and props <= LAYOUT_ONLY_PROPS:
                        continue
                failures.append(
                    f"{rel}: inline <style> defines `{sel} {{}}` — base resets "
                    "belong only in web-travel-style.css (SHARED CSS ONLY rule)."
                )
                break
    if failures:
        for f in failures:
            report.fail(f"[inline-base-reset] {f}")
    else:
        report.ok("inline-base-reset — no page defines *, :root, or body {} inline.")


def check_stats_page_css_var_scoping(report: "Report") -> None:
    """FAIL if a stats page (body class="stats-page") defines its custom color
    vars (--rust, --rust-deep, --copper, --navy, --navy-deep, --track) under
    :root instead of `body.stats-page` — Stats-Pages-Format.html §5/§8.

    check_inline_base_reset only flags a :root {} block that redefines a
    SHARED var (--text/--surface/--bg/etc.); these stats-only vars aren't in
    that shared set, so a stats page defining them at :root scope passed
    silently. Found live in Travel-Stats.html (fixed in the same pass this
    check was added — build_travel_stats.py's template moved all five vars
    into body.stats-page). Added 2026-07-11 (enforcement-gap sweep)."""
    STATS_VARS = {"--rust", "--rust-deep", "--copper", "--navy", "--navy-deep", "--track"}
    ROOT_BLOCK = re.compile(r':root\s*\{([^}]*)\}', re.MULTILINE)
    failures: list[str] = []
    for page in _shareable_pages():
        try:
            html = page.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        if 'class="stats-page"' not in html and "class='stats-page'" not in html:
            continue
        rel = page.relative_to(WEB_ROOT)
        for style_block in re.findall(r'<style[^>]*>(.*?)</style>', html, re.S | re.I):
            clean = re.sub(r'/\*.*?\*/', ' ', style_block, flags=re.S)
            for m in ROOT_BLOCK.finditer(clean):
                props = set(re.findall(r'(--[\w-]+)\s*:', m.group(1)))
                leaked = props & STATS_VARS
                if leaked:
                    failures.append(
                        f"{rel}: :root {{}} defines {sorted(leaked)} — stats color vars belong "
                        f"under `body.stats-page {{}}`, not :root (Stats-Pages-Format.html §5/§8)."
                    )
    if failures:
        for f in failures:
            report.fail(f"[stats-css-var-scoping] {f}")
    else:
        report.ok("stats-css-var-scoping — no stats page leaks --rust/--navy/--track etc. into :root.")


def check_toolbar_version_parity(report: "Report") -> None:
    """WARN on pages loading toolbar.js with a stale or missing cache-bust version.
    Every page that loads toolbar.js should use the same ?v= query string so browsers
    pick up the latest version. Unversioned loads or loads far behind the highest
    version in use are flagged."""
    versions: dict[str, list[str]] = {}
    pat = re.compile(r'src="[^"]*toolbar\.js(?:\?v=(\d+))?"', re.I)
    for page in _shareable_pages():
        try:
            html = page.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        rel = str(page.relative_to(WEB_ROOT))
        for m in pat.finditer(html):
            v = m.group(1) or "none"
            versions.setdefault(v, []).append(rel)
    if not versions:
        return
    max_v = max((int(k) for k in versions if k != "none"), default=0)
    issues: list[str] = []
    for v, pages in sorted(versions.items()):
        if v == "none":
            for p in pages:
                issues.append(f"{p}: toolbar.js loaded WITHOUT a ?v= cache-bust version")
        elif int(v) < max_v:
            for p in pages:
                issues.append(f"{p}: toolbar.js?v={v} is behind current v={max_v}")
    if issues:
        for i in issues:
            report.warn(f"[toolbar-version] {i}")
    else:
        report.ok(f"toolbar-version — all pages load toolbar.js?v={max_v}.")


def check_css_duplication_summary(report: "Report") -> None:
    """WARN when check_css_duplication.py finds >10 duplicated selectors across
    pages (SHARED CSS ONLY rule). Runs the standalone script and parses its exit
    code + output for the total count. This surfaces the problem at session start
    instead of only at ship time."""
    script = Path(__file__).parent / "check_css_duplication.py"
    if not script.exists():
        report.ok("css-duplication — check_css_duplication.py not found (skipped).")
        return
    try:
        import subprocess
        result = subprocess.run(
            [sys.executable, str(script)],
            capture_output=True, text=True, timeout=30,
            cwd=str(Path(__file__).resolve().parents[2]),
        )
        m = re.search(r"Total duplicated selectors:\s*(\d+)", result.stdout)
        count = int(m.group(1)) if m else 0
        mp = re.search(r"Total pages affected:\s*(\d+)", result.stdout)
        pages = int(mp.group(1)) if mp else 0
    except Exception:
        report.ok("css-duplication — check_css_duplication.py failed to run (skipped).")
        return
    if count > 10:
        report.warn(
            f"[css-duplication] {count} duplicated CSS selectors across {pages} pages — "
            "SHARED CSS ONLY rule: move repeated selectors to shared CSS files "
            "(web-travel-style.css / guides-index-style.css / Read-About.css)."
        )
    else:
        report.ok(f"css-duplication — {count} duplicated selectors (within threshold).")


def check_no_hardcoded_hex_colors(report: "Report") -> None:
    """WARN on any shareable page whose inline <style> block hardcodes a hex
    color that exactly matches a shared web-travel-style.css palette variable
    (color:#2a6a2a instead of color:var(--green), etc.) — CLAUDE.md's SHARED
    CSS ONLY rule (a): "NEVER hardcode hex colors in pages — use CSS
    variables." Previously this only surfaced indirectly through
    check_css_duplication_summary's >10-duplicate-selector threshold, which
    doesn't catch a single hardcoded value repeated only once or twice; a
    dedicated check_no_hardcoded_styles.py exists but scans GUIDE HTML for a
    DIFFERENT, already-enforced rule (guides may carry no inline <style> at
    all — validate_itinerary.py's own "No inline <style> block" hard-fail
    already covers that), so it doesn't apply here and wiring it in as-is
    would be a no-op. WARN, not fail: a fleet scan (2026-07-11) found 56
    instances across 30 Trip-Essentials/site pages — real, pre-existing
    content that needs a dedicated find-and-replace pass, not an unreviewed
    mass hard-fail landing in this session. Added 2026-07-11 (enforcement-gap
    sweep)."""
    PALETTE = {
        '#f5f4f0': '--bg', '#fdf8f0': '--warm', '#ffffff': '--surface',
        '#f0ede8': '--surface2', '#d8d4cc': '--border', '#e6e2da': '--border2',
        '#1a1917': '--text', '#6a6660': '--muted', '#8a6c1a': '--accent',
        '#faefd8': '--hover', '#1a3a8b': '--navy', '#2a6a2a': '--green',
        '#c8961a': '--gold', '#a02020': '--red',
    }
    STYLE_BLOCK = re.compile(r'<style[^>]*>(.*?)</style>', re.S | re.I)
    PROP_VAL = re.compile(r'(color|background(?:-color)?|border-color)\s*:\s*(#[0-9a-fA-F]{6})\b', re.I)
    total = 0
    pages_hit = 0
    examples: list[str] = []
    for page in _shareable_pages():
        try:
            text = page.read_text(encoding='utf-8', errors='replace')
        except Exception:
            continue
        rel = page.relative_to(WEB_ROOT)
        hits = []
        for sb in STYLE_BLOCK.findall(text):
            for m in PROP_VAL.finditer(sb):
                hexval = m.group(2).lower()
                var = PALETTE.get(hexval)
                if var:
                    hits.append(f"{m.group(1)}:{hexval} (use var({var}))")
        if hits:
            pages_hit += 1
            total += len(hits)
            if len(examples) < 8:
                examples.append(f"{rel}: {hits[0]} (+{len(hits)-1} more)" if len(hits) > 1 else f"{rel}: {hits[0]}")
    if total:
        report.warn(
            f"[hardcoded-hex] {total} hardcoded hex color(s) across {pages_hit} page(s) exactly "
            f"match a shared CSS variable — use var(--x) instead (CLAUDE.md SHARED CSS ONLY rule (a)): "
            + "; ".join(examples)
        )
    else:
        report.ok("hardcoded-hex — no page hardcodes a hex color matching a shared CSS variable.")


def check_page_filename_spaces(report: "Report") -> None:
    """FAIL on any published page filename containing a space. Pages are named
    with hyphens (Currency-Guide.html); a space-named twin (`Currency Guide.html`)
    is the classic stray-duplicate that keeps reappearing — archived 3× by
    2026-06-21 — and gets published as dead weight while the toolbar points at the
    hyphen version. Pin it so the dup is caught the moment it lands. Archive the
    space-named file (Travel/archive/) and keep only the hyphenated canonical."""
    offenders: list[str] = []
    base = WEB_ROOT / "Trip-Essentials"
    if base.exists():
        for p in base.rglob("*.html"):
            if " " in p.name:
                offenders.append(str(p.relative_to(WEB_ROOT)))
    if offenders:
        for o in sorted(offenders):
            report.fail(
                f"[filename-spaces] {o}: page filename contains a space — pages use "
                "hyphens. This is usually a stray duplicate; archive it to "
                "Travel/archive/ and keep the hyphenated canonical."
            )
    else:
        report.ok("filename-spaces — every Trip-Essentials page filename is hyphenated (no spaces).")


# ── Stats pages — city/country name column bold ───────────────────────────────
# Every stats page must bold its city/country name column so non-linked entries
# look consistent with linked ones. Two patterns:
#   • Stats-Across-US.html: uses .data-table; city name in 2nd <td>, so
#     `.data-table tbody td:nth-child(2){font-weight:700}` must be present.
#   • All other stats pages (Canada, Caribbean, Europe, Asia, South-America):
#     use .sun-table td.country-name; must carry font-weight:700.
# Hard-fails on any stats page missing the required rule (added 2026-07-06).
_STATS_PAGES_DATA_TABLE = {"Stats-Across-US.html"}
_STATS_PAGES_SUN_TABLE = {
    "Stats-Across-Canada.html",
    "Caribbean-Stats.html",
    "Europe-Stats.html",
    "Asia-Stats.html",
    "South-America-Stats.html",
}


def check_stats_city_name_bold(report: "Report") -> None:
    """FAIL if any stats page is missing font-weight on its city/country name column."""
    essentials = WEB_ROOT / "Trip-Essentials"
    failures: list[str] = []

    for fname in _STATS_PAGES_DATA_TABLE:
        path = essentials / fname
        if not path.exists():
            continue
        src = path.read_text(encoding="utf-8", errors="replace")
        # Must have font-weight on .data-table tbody td:nth-child(2)
        if "data-table tbody td:nth-child(2)" not in src or "font-weight" not in src.split("data-table tbody td:nth-child(2)", 1)[1].split("}", 1)[0]:
            failures.append(f"{fname}: .data-table tbody td:nth-child(2) missing font-weight — add font-weight:700")

    for fname in _STATS_PAGES_SUN_TABLE:
        path = essentials / fname
        if not path.exists():
            continue
        src = path.read_text(encoding="utf-8", errors="replace")
        # Must have font-weight on .sun-table td.country-name
        if "sun-table td.country-name" not in src:
            failures.append(f"{fname}: .sun-table td.country-name selector missing entirely")
        else:
            rule_body = src.split("sun-table td.country-name", 1)[1].split("}", 1)[0]
            if "font-weight" not in rule_body:
                failures.append(f"{fname}: .sun-table td.country-name missing font-weight — add font-weight:700")

    if failures:
        for f in failures:
            report.fail(f"[stats-city-bold] {f}")
    else:
        report.ok("stats-city-bold — all stats pages bold their city/country name column.")


# ── Internal link space-encoding ─────────────────────────────────────────────
# Guide folders may legitimately contain spaces ("Glacier National Park/"), but a
# LINK to one must percent-encode the space — href="./Glacier%20National%20Park/…"
# — never the raw href="./Glacier National Park/…". Browsers auto-encode the raw
# form so it "works", which is exactly why it keeps regressing into index cards,
# data-guide-prev/next chains, map-pin arrays, and the generated data pages
# (Safety, Stats, Climate-Finder, Time-Zones). The raw form is malformed and
# breaks every non-browser consumer (link checkers, copied URLs, JSON). HARD fail,
# no grandfathering — fix with `python3 Brain/scripts/encode_link_spaces.py --fix`.
# Added 2026-06-27. External query/scheme URLs (Google Maps ?query=Name With
# Spaces) are NOT local-file links and are deliberately exempt.
_LINK_QUOTED_RE = re.compile(r"""(['"])(.*?)\1""")
_LINK_SCHEME_PREFIXES = ("http://", "https://", "file:", "mailto:", "tel:", "data:", "javascript:", "#")


def _is_spaced_local_link(value: str) -> bool:
    low = value.lower()
    if low.startswith(_LINK_SCHEME_PREFIXES):
        return False
    if "=" in value:  # query string / meta-refresh directive, not a bare path
        return False
    path = value.split("#", 1)[0].split("?", 1)[0]
    if not path.lower().endswith((".html", ".pdf")):
        return False
    # New rule (Links.html § 9): local paths use hyphens — a space in the path,
    # written plainly OR percent-encoded (%20), is a violation. Only hyphenated
    # folder/file names pass.
    return (" " in path) or ("%20" in path.lower())


def check_internal_link_space_encoding(report: "Report") -> None:
    """HARD-FAIL any internal guide/page link whose path carries a space.

    New rule (Links.html § 9, 2026-07-05): local paths use hyphens. A space in the
    path — plain OR percent-encoded (%20) — is a violation; only a hyphenated
    folder/file name passes. Display names, titles, and pin labels keep their
    spaces; the path they point to may not. No grandfathering — a spaced folder
    not yet renamed to hyphens fails here until it is migrated.
    """
    if not WEB_ROOT.exists():
        return
    offenders: list[tuple[str, int, str]] = []
    for p in sorted(WEB_ROOT.rglob("*.html")):
        txt = p.read_text(encoding="utf-8", errors="ignore")
        bad = {m.group(2) for m in _LINK_QUOTED_RE.finditer(txt)
               if _is_spaced_local_link(m.group(2))}
        if bad:
            offenders.append((str(p.relative_to(WEB_ROOT)), len(bad), sorted(bad)[0]))
    if offenders:
        for rel, n, sample in offenders:
            hyph = sample.replace("%20", "-").replace(" ", "-")
            report.fail(
                f"[link-spaces] {rel}: {n} internal link(s) whose path carries a space "
                f"(plain or %20-encoded) — local folders, files, and the links to them must "
                f"use hyphens, e.g. \"{sample}\" → \"{hyph}\". Rename the folder to hyphens "
                f"and update every link to it (folder migration)."
            )
    else:
        report.ok("link-spaces — every internal guide/page link path is hyphenated (no spaces).")


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
    """Warn if the title-page gradient in guide-style.css and PDF Render Notes.md diverge.

    PDF Render Notes.md carries a hardcoded copy of the gradient for the
    WeasyPrint override CSS. When guide-style.css is reskinned, both must
    match. brain_check.py now greps both files and warns on divergence.
    Reference: Brain/Reference/PDF Render Notes.md § 2 (Heads Up).
    """
    guide_v3 = HERE.parent.parent / "Travel-Website" / "assets" / "guide-style.css"
    if not guide_v3.exists():
        return
    if not PDF_RENDER_NOTES.exists():
        return

    css_text = guide_v3.read_text(encoding="utf-8", errors="replace")
    pdf_text = PDF_RENDER_NOTES.read_text(encoding="utf-8", errors="replace")

    # Grab all linear-gradient(...) strings from both files
    gradient_re = re.compile(r"linear-gradient\([^)]+\)")
    css_grads = set(gradient_re.findall(css_text))
    pdf_grads = set(gradient_re.findall(pdf_text))

    # Only compare gradients that appear near '.title-page' in guide-style.css
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
            "[PDF gradient sync] guide-style.css .title-page gradient(s) not found in "
            "PDF Render Notes.md — update the OVERRIDE_CSS block in that file: "
            + "; ".join(missing[:2])
        )
    else:
        report.ok("PDF gradient sync — title-page gradient matches PDF Render Notes.md.")


def check_search_bar_standard(report: "Report") -> None:
    """Fail if any Travel-Website HTML file violates the search bar standard (§ 14,
    Colors and Font Size.html, 2026-06-13).

    Rules enforced:
      1. placeholder must be non-empty and carry real descriptive text beyond
         the 🔍 emoji (e.g. "🔍  Country name") — not blank, not emoji-only.
         (Standard flipped 2026-06-20 from "bare 🔍 only" to descriptive text;
         re-asserted as a non-empty-content check 2026-07-11.)
      2. CSS must not use border-radius:20px (pill shape) on a search selector.
      3. CSS must not animate width on focus for a search input (transition:width).
      4. CSS search selector must use width:360px (standard fixed size, updated
         2026-06-20). Any other width value (width:auto, width:200px, width:260px,
         min-width, max-width without the 360px anchor) is a violation.
      5. Every core property (width, padding, font-size, border, border-radius,
         background, color) must resolve to the standard value (the index look).
      6. Every var(--X) used in the search bar CSS must be defined or have a fallback.
      7. The :focus rule must set border-color:#C8B99A and the focus ring
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

        # Check 1 (placeholder text): the bare-emoji-only check was REMOVED
        # 2026-06-20 when the standard flipped to a DESCRIPTIVE placeholder
        # ("🔍  Country name", etc.) like the Lounges pages — but no
        # replacement check was ever added, so a blank placeholder="" (or a
        # placeholder with no descriptive text at all) silently passed.
        # Re-added 2026-07-11 (enforcement-gap sweep): every <input
        # type="search"> must carry a non-empty placeholder with real
        # descriptive text beyond the magnifying-glass emoji. Fleet scan
        # found every current search input already conforms (0 impact) —
        # this only guards against a future blank/emoji-only placeholder.
        if path.suffix.lower() == '.html':
            for inp_m in _re.finditer(
                r'<input\b[^>]*\btype=["\']search["\'][^>]*>', src, _re.IGNORECASE
            ):
                inp_tag = inp_m.group(0)
                ph_m = _re.search(r'\bplaceholder=["\']([^"\']*)["\']', inp_tag, _re.IGNORECASE)
                ph_text = ph_m.group(1) if ph_m else ''
                # Strip the magnifying-glass emoji + surrounding whitespace, then
                # require at least one real word left over.
                ph_words = _re.sub(r'[🔍\s]+', ' ', ph_text).strip()
                if not ph_words or not _re.search(r'[A-Za-z]', ph_words):
                    failures.append(
                        f"{rel}: search bar placeholder is missing or non-descriptive "
                        f'(placeholder="{ph_text}") — must carry real descriptive text '
                        f'(e.g. "🔍  Country name"), not blank or emoji-only (§ 14 '
                        f"Colors and Font Size.html)."
                    )

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
                # A missing property is inherited from the shared web-travel-style.css
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
        # border-color (#C8B99A) and the focus box-shadow ring (the "line around"
        # that appears on focus). These are hardcoded per § 14 — no var(--accent).
        # Only enforced on pages that style a search bar (a main block exists).
        _FOCUS_BLOCK_RE = _re.compile(
            _SEL + r'\s*:focus\s*\{([^}]+)\}',
            _re.IGNORECASE | _re.DOTALL,
        )
        _FOCUS_EXPECTED = {
            'border-color': '#c8b99a',
            'box-shadow':   'none',
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
    # The rule may live inline OR in a linked stylesheet (SHARED CSS ONLY rule,
    # CLAUDE.md 2026-06-23, favors extracting reusable component styles out of
    # individual pages) — search both. A page-only inline check false-failed
    # the moment .stat-line was correctly extracted into guides-index-style.css.
    _css_search_text = html
    for _href in _re.findall(r'<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"', html):
        _css_path = (guides_index.parent / _href.split('?', 1)[0]).resolve()
        if _css_path.is_file():
            _css_search_text += "\n" + _css_path.read_text(encoding="utf-8", errors="replace")
    if not _re.search(r'\.stat-line\s*\{[^}]*font-size:\s*12px', _css_search_text) or \
       not _re.search(r'\.stat-line\s*\{[^}]*color:\s*var\(--muted\)', _css_search_text):
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


def check_guides_index_topbar_layout(report: Report) -> None:
    """HARD-FAIL if the Guides-Index.html topbar layout drifts from the LOCKED
    spec (Navigation.html § 8, added 2026-07-08): #search-wrap is full-width
    and centers the search bar; #status-toggle (All/Been/Want) sits
    `position:absolute; right:calc(50% + 300px)` inside #search-wrap on
    desktop, clear of the pill row, and resets to `position:static; width:100%`
    stacked above the input on mobile (≤600px). This layout previously had no
    validator at all — only the 360px search-bar width was checked
    (check_search_bar_standard). Added 2026-07-11 (enforcement-gap sweep).
    """
    index_path = TRAVEL_ROOT / "Travel-Website" / "Guides" / "Guides-Index.html"
    css_path = TRAVEL_ROOT / "Travel-Website" / "assets" / "guides-index-style.css"
    if not index_path.exists():
        report.fail("check_guides_index_topbar_layout: Guides-Index.html is missing")
        return
    html_text = index_path.read_text(encoding="utf-8", errors="ignore")

    sw_m = re.search(r'<div\b[^>]*id=["\']search-wrap["\'][^>]*>', html_text, re.IGNORECASE)
    if not sw_m:
        report.fail("check_guides_index_topbar_layout: #search-wrap element not found on Guides-Index.html")
    else:
        sw_tag = sw_m.group(0)
        if not re.search(r'justify-content\s*:\s*center', sw_tag, re.IGNORECASE):
            report.fail("check_guides_index_topbar_layout: #search-wrap must center its contents "
                        "(justify-content:center) — the search bar drifts off-center without it")

    st_m = re.search(r'<div\b[^>]*id=["\']status-toggle["\'][^>]*>', html_text, re.IGNORECASE)
    if not st_m:
        report.fail("check_guides_index_topbar_layout: #status-toggle element not found on Guides-Index.html")
    else:
        st_tag = st_m.group(0)
        if not re.search(r'position\s*:\s*absolute', st_tag, re.IGNORECASE):
            report.fail("check_guides_index_topbar_layout: #status-toggle must be position:absolute on "
                        "desktop — a static/relative toggle pushes into the pill row and hides 'Best of' "
                        "(Navigation.html § 8)")
        if not re.search(r'right\s*:\s*calc\(\s*50%\s*\+\s*300px\s*\)', st_tag, re.IGNORECASE):
            report.fail("check_guides_index_topbar_layout: #status-toggle must sit at "
                        "right:calc(50% + 300px) — placing it just left of the search bar, clear of the "
                        "pill row (Navigation.html § 8). Do not move to left:0 or back into topbar flow.")

    if not css_path.exists():
        report.fail("check_guides_index_topbar_layout: assets/guides-index-style.css is missing")
        return
    css_text = css_path.read_text(encoding="utf-8", errors="ignore")
    mobile_reset = re.search(
        r'#search-wrap\s+#status-toggle\s*\{[^}]*position\s*:\s*static[^}]*\}',
        css_text, re.IGNORECASE | re.DOTALL,
    )
    if not mobile_reset:
        report.fail("check_guides_index_topbar_layout: guides-index-style.css is missing the mobile reset "
                    "`#search-wrap #status-toggle { position:static; ... }` — on ≤600px the toggle must "
                    "reset to static/full-width and stack above the input (Navigation.html § 8)")
    elif not re.search(r'width\s*:\s*100%', mobile_reset.group(0), re.IGNORECASE):
        report.fail("check_guides_index_topbar_layout: mobile #search-wrap #status-toggle reset is "
                    "missing width:100% (Navigation.html § 8)")

    if not report.failures or not any("check_guides_index_topbar_layout" in f for f in report.failures):
        report.ok("Guides-Index topbar layout — #status-toggle position + #search-wrap centering match "
                   "the locked spec (Navigation.html § 8)")


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


def check_updated_stamp_format(report: "Report") -> None:
    """FAIL when a page carries an updated-stamp with wrong tag, wrong placement, or inline styles.

    Three hard rules enforced here:
      1. Tag must be <span class="updated-stamp"> — never <div> or any other element.
      2. The span must appear immediately after </div> that closes .page-header — no
         other elements may sit between the closing page-header tag and the stamp.
      3. The span must carry no style= attribute — font, color, and size are supplied
         exclusively by the shared .updated-stamp rule in web-travel-style.css.
    Guides are excluded (their stamp is injected by toolbar.js into .title-page, not
    hand-coded). Only Trip-Essentials / Best-of / site-root pages are checked.
    Added 2026-07-09."""
    if not WEB_ROOT.exists():
        return

    # Match any element that carries class="updated-stamp"
    _any_stamp_rx = re.compile(r'<(\w+)[^>]+class=["\'][^"\']*updated-stamp[^"\']*["\'][^>]*>', re.IGNORECASE)
    # Correct form: <span class="updated-stamp"> with no style attribute
    _correct_tag_rx = re.compile(r'<span\s+class="updated-stamp">', re.IGNORECASE)
    # Correct placement: closing page-header div immediately followed (whitespace ok) by the span
    _correct_placement_rx = re.compile(
        r'</div>\s*<span\s+class="updated-stamp">',
        re.IGNORECASE,
    )
    # Inline style that overrides typography (font-size, color, font-weight, letter-spacing)
    # Layout-only styles (margin, flex-shrink, padding) are permitted.
    _inline_typo_rx = re.compile(
        r'<span[^>]+class=["\'][^"\']*updated-stamp[^"\']*["\'][^>]*style=["\'][^"\']*'
        r'(?:font-size|(?<!\w)color|font-weight|letter-spacing)',
        re.IGNORECASE,
    )

    wrong_tag: list[str] = []
    wrong_placement: list[str] = []
    inline_style: list[str] = []

    for fp in sorted(WEB_ROOT.rglob("*.html")):
        # Skip guide HTML (in Guides/<City>/) — stamp is toolbar-injected there
        rel = fp.relative_to(WEB_ROOT)
        parts = rel.parts
        if len(parts) >= 2 and parts[0] == "Guides" and parts[1] != "Guides-Index.html":
            continue
        try:
            txt = fp.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        if "updated-stamp" not in txt:
            continue

        path_label = _display_path(fp)

        # Rule 1: must be a <span>, not <div> or anything else
        for m in _any_stamp_rx.finditer(txt):
            if m.group(1).lower() != "span":
                wrong_tag.append(f"{path_label} (used <{m.group(1)}>)")

        # Rule 2: must immediately follow closing </div> of page-header
        if _correct_tag_rx.search(txt) and not _correct_placement_rx.search(txt):
            wrong_placement.append(path_label)

        # Rule 3: no inline typography overrides on the stamp element
        if _inline_typo_rx.search(txt):
            inline_style.append(path_label)

    failures: list[str] = []
    if wrong_tag:
        failures.append("wrong element tag (must be <span class=\"updated-stamp\">): " + " · ".join(wrong_tag))
    if wrong_placement:
        failures.append("wrong placement (must be immediately after </div> closing .page-header): " + " · ".join(wrong_placement))
    if inline_style:
        failures.append("inline style= on stamp (font/color/size must come from web-travel-style.css only): " + " · ".join(inline_style))

    if failures:
        report.fail(
            "updated-stamp format violations — font, color, and size are locked to .updated-stamp in "
            "web-travel-style.css; placement is locked to immediately after .page-header:\n  "
            + "\n  ".join(failures)
        )
    else:
        report.ok("updated-stamp format — tag, placement, and no inline styles all correct.")


def check_pickleball_bar_color(report: "Report") -> None:
    """Fail if Pickleball.html bar-fill classes use any color other than the locked yellow gradient.

    Locked spec (Essentials-Pages-Rules.md § Pickleball page):
      .pkl-bar-fill       background: linear-gradient(90deg,#c8960c,#e8c020)
      .pkl-state-bar-fill background: linear-gradient(90deg,#c8960c,#e8c020)

    Any rust/orange hex (#b85c2a, #d4874a, #7a3b1e) in either rule = failure.
    Missing class = failure.
    """
    pkl_path = TRAVEL_ROOT / "Travel-Website" / "Trip-Essentials" / "Pickleball.html"
    if not pkl_path.exists():
        report.fail("check_pickleball_bar_color: Pickleball.html not found")
        return

    text = pkl_path.read_text(encoding="utf-8")

    YELLOW_RE = re.compile(
        r"\.pkl-bar-fill\s*\{[^}]*background\s*:[^}]*#c8960c[^}]*#e8c020[^}]*\}", re.S
    )
    STATE_RE = re.compile(
        r"\.pkl-state-bar-fill\s*\{[^}]*background\s*:[^}]*#c8960c[^}]*#e8c020[^}]*\}", re.S
    )
    BAD_COLORS = re.compile(r"#b85c2a|#d4874a|#7a3b1e", re.I)

    ok = True

    if not YELLOW_RE.search(text):
        report.fail(
            "Pickleball.html: .pkl-bar-fill does not use the locked yellow gradient "
            "(linear-gradient(90deg,#c8960c,#e8c020)) — "
            "see Essentials-Pages-Rules.md § Pickleball page"
        )
        ok = False

    if not STATE_RE.search(text):
        report.fail(
            "Pickleball.html: .pkl-state-bar-fill does not use the locked yellow gradient "
            "(linear-gradient(90deg,#c8960c,#e8c020)) — "
            "see Essentials-Pages-Rules.md § Pickleball page"
        )
        ok = False

    # Also catch if rust colors snuck in to either fill rule
    for m in re.finditer(r"\.(pkl-bar-fill|pkl-state-bar-fill)\s*\{([^}]*)\}", text, re.S):
        rule_body = m.group(2)
        bad = BAD_COLORS.findall(rule_body)
        if bad:
            report.fail(
                f"Pickleball.html: .{m.group(1)} contains rust/orange color(s) {bad} — "
                "bars must be yellow (#c8960c→#e8c020); "
                "see Essentials-Pages-Rules.md § Pickleball page"
            )
            ok = False

    if ok:
        report.ok("Pickleball.html bar colors locked yellow (#c8960c→#e8c020)")


def check_world_map_colors(report: "Report") -> None:
    """FAIL if World-Map.html's region-nav dot palette or pin marker colors
    drift from the locked spec (Maps-Layout.html §5/§6). Only the ACTIVE
    .rn.rn-on gold-fill state was covered by the general active-pill-color
    gates; the rest-state .rn-* dot hexes and .city-pin/.pin-name-tip colors
    had no check at all. Added 2026-07-11 (enforcement-gap sweep) — also
    corrected Maps-Layout.html itself in the same pass: §5's table had a typo
    (.rn-sa listed as #4a7ad8; the shipped CSS is #3a74d4) and was missing
    the .rn-oc (Oceania, purple #8050d0) row entirely."""
    RN_DOTS = {
        'rn-eu': '#dc4444', 'rn-na': '#e87830', 'rn-cb': '#14a18d',
        'rn-as': '#c8940a', 'rn-af': '#2ea84e', 'rn-sa': '#3a74d4',
        'rn-oc': '#8050d0', 'rn-wd': '#8a8270',
    }
    map_path = TRAVEL_ROOT / "Travel-Website" / "Trip-Essentials" / "Maps" / "World-Map.html"
    if not map_path.exists():
        report.fail("check_world_map_colors: World-Map.html is missing")
        return
    text = map_path.read_text(encoding="utf-8", errors="ignore")
    fails = []
    for cls, hexval in RN_DOTS.items():
        m = re.search(r'\.' + re.escape(cls) + r'::before\s*\{([^}]*)\}', text, re.IGNORECASE)
        if not m:
            fails.append(f".{cls}::before rule is missing")
        elif hexval.lower() not in m.group(1).lower():
            fails.append(f".{cls}::before should be background:{hexval} — rule body is {m.group(1).strip()!r}")
    pin_m = re.search(r'\.city-pin\s*\{([^}]*)\}', text, re.IGNORECASE)
    if not pin_m:
        fails.append(".city-pin rule is missing")
    elif '#b85c2a' not in pin_m.group(1):
        fails.append(f".city-pin should be background:#b85c2a — rule body is {pin_m.group(1).strip()!r}")
    tip_m = re.search(r'\.pin-name-tip\s*\{([^}]*)\}', text, re.IGNORECASE)
    if not tip_m:
        fails.append(".pin-name-tip rule is missing")
    else:
        tip_body = tip_m.group(1)
        if '#4a2810' not in tip_body:
            fails.append(f".pin-name-tip should carry color:#4a2810 — rule body is {tip_body.strip()!r}")
        if '12px' not in tip_body:
            fails.append(".pin-name-tip should be font-size:12px")
    if fails:
        for f in fails:
            report.fail(f"check_world_map_colors: {f} (Maps-Layout.html §5/§6)")
    else:
        report.ok("World-Map.html — region-nav dot palette + pin marker colors match Maps-Layout.html §5/§6")


def check_world_map_no_cdn(report: "Report") -> None:
    """FAIL if World-Map.html loads a map vendor (tile server, JS library) from
    an external CDN instead of the self-hosted copy. Maps-Layout.html §2/§10
    requires the Leaflet library and all data (PINS, region GeoJSON) to be
    self-hosted under Travel-Website/ — the ~1GB Pages-deploy ceiling and the
    'no external dependency can break the map' rule both depend on this, but
    nothing checked it. Added 2026-07-11 (enforcement-gap sweep)."""
    map_dir = TRAVEL_ROOT / "Travel-Website" / "Trip-Essentials" / "Maps"
    map_path = map_dir / "World-Map.html"
    if not map_path.exists():
        report.fail("check_world_map_no_cdn: World-Map.html is missing")
        return
    text = map_path.read_text(encoding="utf-8", errors="ignore")
    fails = []
    # <script src=...>, <link href=...>, and L.tileLayer('...') calls that point
    # off-host (http(s):// or protocol-relative //) are all vendor loads that
    # must instead reference a local ../../assets/ or ./data/ path.
    for m in re.finditer(r'(?:src|href)\s*=\s*["\']((?:https?:)?//[^"\']+)["\']', text, re.IGNORECASE):
        fails.append(f'off-host asset load: {m.group(1)}')
    for m in re.finditer(r'L\.tileLayer\(\s*["\']((?:https?:)?//[^"\']+)["\']', text, re.IGNORECASE):
        fails.append(f'L.tileLayer points off-host: {m.group(1)}')
    if fails:
        for f in fails:
            report.fail(f"check_world_map_no_cdn: {f} — Maps-Layout.html §2/§10 requires self-hosted vendor/data files")
    else:
        report.ok("World-Map.html — no external CDN / off-host tile server or script loads")


def check_toolbar_group_icon_consistency(report: "Report") -> None:
    """Fail if any toolbar dropdown group (except Flights and Safety) has children
    whose leading icon differs from the group's leading icon. Flights and Safety
    intentionally use different icons per child — all other groups must be uniform.
    (added 2026-07-12; generalized from check_maps_toolbar_icon_consistency)
    """
    import re as _re

    # Groups whose children are intentionally heterogeneous — skip them
    EXEMPT_GROUPS = {"Flights", "Safety"}

    toolbar_path = TRAVEL_ROOT / "Travel-Website" / "assets" / "toolbar.js"
    if not toolbar_path.exists():
        report.fail("check_toolbar_group_icon_consistency: toolbar.js not found")
        return

    content = toolbar_path.read_text(encoding="utf-8")

    # Find every group: 'ICON Name' ... children: [ ... ] block
    group_blocks = _re.findall(
        r"group:\s*'([^']+)'[^[]*children:\s*\[(.*?)\]",
        content, _re.DOTALL
    )

    failures = []
    for group_label, children_text in group_blocks:
        group_label = group_label.strip()
        # Extract the plain-text name (strip leading emoji/non-ASCII)
        name_match = _re.search(r"[A-Za-z].*", group_label)
        group_name = name_match.group(0).strip() if name_match else group_label

        if group_name in EXEMPT_GROUPS:
            continue

        # Derive the group icon (everything before the first ASCII letter)
        icon_match = _re.match(r"(.*?)\s*[A-Za-z]", group_label)
        group_icon = icon_match.group(1).strip() if icon_match else ""
        if not group_icon:
            failures.append(f"'{group_label}' group has no leading icon")
            continue

        child_labels = _re.findall(r"text:\s*'([^']+)'", children_text)
        bad = [lbl for lbl in child_labels if not lbl.startswith(group_icon)]
        if bad:
            failures.append(
                f"'{group_label}' children must all start with '{group_icon}' — non-conforming: {bad}"
            )

    if failures:
        for f in failures:
            report.fail(f"check_toolbar_group_icon_consistency: {f}")
    else:
        report.ok("toolbar.js dropdown groups — all non-exempt children use uniform group icon")


def check_also_on_site_pill_labels(report: "Report") -> None:
    """Fail if any guide's 'Also on this site' pill uses a non-canonical icon or name.

    Both the icon (emoji) AND the section name are locked independently:
      ICON CHANGED  — right name, wrong emoji
      NAME CHANGED  — right emoji, wrong/extended name (e.g. "Currency · CHF",
                      "Plug Adapter · G", "Stats Across the US", "Climate")
      UNKNOWN PILL  — matches nothing canonical at all

    Crib regressions that are caught:
      💱 Currency, 💰 Currency · Switzerland, 💰 Currency of the country,
      🔌 Plug Adapter · G, 📊 Stats Across the US, 🌤️ Climate, etc.
    """
    # (icon, name) — BOTH locked
    _CANONICAL_PAIRS: list[tuple[str, str]] = [
        ("🌤️", "Weather"),
        ("🕐", "Time Zones"),
        ("🔌", "Plug Adapter"),
        ("💰", "Currency"),
        ("🛡️", "Safety Guide"),
        ("🪪", "Visas"),
        ("📊", "Stats Across Europe"),
        ("📊", "Stats Across US"),
        ("📊", "Stats Across Asia"),
        ("📊", "Stats Across Canada"),
        ("📊", "Stats Across the Caribbean"),
        ("📊", "Stats Across South America"),
        ("🚆", "European Train Guide"),  # EU guides only; always last
    ]
    _FULL = {f"{ic} {nm}" for ic, nm in _CANONICAL_PAIRS}
    _NAME_TO_ICON = {nm: ic for ic, nm in _CANONICAL_PAIRS}
    _ICON_TO_NAMES: dict[str, list[str]] = {}
    for _ic, _nm in _CANONICAL_PAIRS:
        _ICON_TO_NAMES.setdefault(_ic, []).append(_nm)

    # Split "EMOJI name" → (emoji, name); handles multi-codepoint emoji
    _SPLIT = re.compile(
        r'^((?:[\U00010000-\U0010FFFF][︀-️]?|[☀-➿][︀-️]?'
        r'|[\U0001F300-\U0001FAFF][︀-️]?)+)\s+(.*)', re.DOTALL
    )

    def _split(label: str) -> tuple[str, str]:
        m = _SPLIT.match(label)
        if m:
            return m.group(1), m.group(2).strip()
        return label[:2].strip(), label[2:].strip()

    def _diagnose(label: str) -> str:
        icon, name = _split(label)
        if name in _NAME_TO_ICON:
            exp = _NAME_TO_ICON[name]
            return (
                f'ICON CHANGED — section name "{name}" is correct but icon is '
                f'"{icon}", must be "{exp}"'
            )
        if icon in _ICON_TO_NAMES:
            valid = _ICON_TO_NAMES[icon]
            for cname in valid:
                if name.startswith(cname):
                    suffix = name[len(cname):]
                    return (
                        f'NAME CHANGED — icon "{icon}" OK but name has added suffix '
                        f'"{suffix}" on "{cname}". Must be exactly "{cname}"'
                    )
            v_str = " / ".join(f'"{n}"' for n in valid)
            return (
                f'NAME CHANGED — icon "{icon}" OK but name "{name}" is not canonical. '
                f'With this icon name must be {v_str}'
            )
        return (
            f'UNKNOWN PILL — "{label}" matches no canonical icon or name. '
            f'Must be one of the {len(_CANONICAL_PAIRS)} canonical pills'
        )

    # Live pill class is `also-on-this-site-pill` (CSS-styled).  The retired
    # `trip-resource-pill` is never used in shipped guides; matching it would
    # make this check a silent no-op (the bug this replaced — 2026-06-27).
    PILL_RE = re.compile(r'<a\s+([^>]*)class="also-on-this-site-pill"([^>]*)>([^<]+)</a>', re.IGNORECASE)
    HREF_RE = re.compile(r'href="([^"]*)"', re.IGNORECASE)
    guides_dir = TRAVEL_ROOT / "Travel-Website" / "Guides"

    # Scope: shipped fleet only — folder wired into navigation (in FMAP) AND
    # carrying the validation-passed stamp.  In-progress / unstamped guides and
    # unpublished duplicate folders are excluded so a half-built guide can't
    # block session start (their also-block is gated at ship by validate_itinerary
    # TR-1…TR-6).  Glob covers every version (v1, v2, … v7) — not just v1.
    fmap_folders: set[str] = set()
    _idx = guides_dir / "Guides-Index.html"
    if _idx.exists():
        _m = re.search(r"var FMAP = (\{.*?\});", _idx.read_text(encoding="utf-8", errors="replace"), re.DOTALL)
        if _m:
            try:
                fmap_folders = {k.split("/")[0] for k in json.loads(_m.group(1))}
            except Exception:
                fmap_folders = set()

    bad: list[str] = []
    checked = 0
    for path in sorted(guides_dir.glob("**/*_v[0-9]*.html")):
        if path.parent.name not in fmap_folders:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if "validation: passed" not in text:
            continue
        checked += 1
        _pill_count = 0
        for m in PILL_RE.finditer(text):
            attrs = m.group(1) + m.group(2)
            href_m = HREF_RE.search(attrs)
            if href_m and href_m.group(1).startswith("#"):
                continue  # internal anchor nav pill — not an "Also on this site" cross-link
            _pill_count += 1
            label = m.group(3).strip()
            if label not in _FULL:
                rel = path.relative_to(TRAVEL_ROOT)
                bad.append(f'{rel}: {_diagnose(label)}')
        if _pill_count == 0:
            # A guide with zero also-on-this-site-pill anchors is missing the
            # whole "Also on this site" section, not just a label — previously
            # this loop just did nothing and the guide passed silently.
            rel = path.relative_to(TRAVEL_ROOT)
            bad.append(f'{rel}: SECTION MISSING — no "Also on this site" pills found at all '
                       f'(section absent; must carry all 7 canonical pills)')

    if bad:
        for b in bad:
            report.fail(f"check_also_on_site_pill_labels: {b}")
    else:
        report.ok(
            f"Also-on-this-site pills: all icons and names canonical "
            f"across {checked} shipped guides"
        )


def check_guide_header_css_standard(report: "Report") -> None:
    """Fail if guide-style.css header block drifts from the locked standard.

    Locked values (approved 2026-06-26):
      .title-hotel   — font-size: 14px, font-weight: 500, order: 4
      .title-address — order: 4 (font-size/weight allowed to vary)
      .title-country — font-size: 14px, font-weight: 600
      .title-updated — order: 4, margin-left: auto (right-aligned same row as hotel)
      .title-page    — margin-bottom: 16px (gap below header block)
    """
    css_path = TRAVEL_ROOT / "Travel-Website" / "assets" / "guide-style.css"
    if not css_path.exists():
        report.warn("check_guide_header_css_standard: guide-style.css not found")
        return
    css = css_path.read_text(encoding="utf-8", errors="replace")

    fails = []

    # .title-hotel
    m = re.search(r'\.title-hotel\s*\{([^}]+)\}', css)
    if m:
        block = m.group(1)
        if 'font-size: 14px' not in block:
            fails.append(".title-hotel font-size must be 14px")
        if 'font-weight: 500' not in block:
            fails.append(".title-hotel font-weight must be 500")
        if 'order: 4' not in block:
            fails.append(".title-hotel order must be 4")
    else:
        fails.append(".title-hotel rule not found in guide-style.css")

    # .title-country
    m = re.search(r'\.title-country\s*\{([^}]+)\}', css)
    if m:
        block = m.group(1)
        if 'font-size: 14px' not in block:
            fails.append(".title-country font-size must be 14px")
        if 'font-weight: 600' not in block:
            fails.append(".title-country font-weight must be 600")
    else:
        fails.append(".title-country rule not found in guide-style.css")

    # .title-address
    m = re.search(r'\.title-address\s*\{([^}]+)\}', css)
    if m:
        block = m.group(1)
        if 'font-size: 14px' not in block:
            fails.append(".title-address font-size must be 14px (matches hotel name)")
    else:
        fails.append(".title-address rule not found in guide-style.css")

    # .title-address a — link color must be #3d3a32 (matches hotel name, unified 2026-06-28)
    m = re.search(r'\.title-page\s+\.title-address\s+a[^{]*\{([^}]+)\}', css)
    if m:
        block = m.group(1)
        color_match = re.search(r'color\s*:\s*([^;]+)', block)
        if color_match:
            link_color = color_match.group(1).strip()
            if link_color != '#3d3a32':
                fails.append(
                    f".title-address a color must be #3d3a32 (matches hotel name, unified 2026-06-28), got {link_color!r}"
                )
    else:
        fails.append(".title-page .title-address a rule not found in guide-style.css")

    # .title-updated
    m = re.search(r'\.title-updated\s*\{([^}]+)\}', css)
    if m:
        block = m.group(1)
        if 'order: 4' not in block:
            fails.append(".title-updated order must be 4 (same row as hotel)")
        if 'margin-left: auto' not in block:
            fails.append(".title-updated must have margin-left: auto (pushes to right)")
    else:
        fails.append(".title-updated rule not found in guide-style.css")

    # .title-page margin-bottom
    m = re.search(r'\.title-page\s*\{([^}]+)\}', css)
    if m:
        block = m.group(1)
        if 'margin-bottom: 16px' not in block:
            fails.append(".title-page margin-bottom must be 16px (gap below header)")
    else:
        fails.append(".title-page rule not found in guide-style.css")

    if fails:
        for f in fails:
            report.fail(f"check_guide_header_css_standard: {f}")
    else:
        report.ok("Guide header CSS standard: font sizes, weights, order and gap all locked")


def _extract_balanced_divs(html_text: str, class_name: str) -> list[str]:
    """Return the inner HTML of every <div class="{class_name}">...</div>,
    matching the TRUE closing tag by counting nested <div> opens/closes.

    A plain non-greedy regex (.*?</div>) breaks the moment a card wraps its
    content in an intermediate wrapper div — e.g. a SHOWCASE card's
    .showcase-photo and .showcase-body wrappers — because it stops at the
    FIRST standalone closing </div> (the photo wrapper's) instead of the
    card's own, silently truncating what gets checked. LEGACY cards have no
    such wrapper so the old regex happened to work for them, but this
    balanced version is correct for both formats.
    """
    results = []
    marker = f'<div class="{class_name}">'
    pos = 0
    while True:
        start = html_text.find(marker, pos)
        if start == -1:
            break
        cursor = start + len(marker)
        depth = 1
        end = None
        for m in re.finditer(r'<div\b[^>]*>|</div>', html_text[cursor:]):
            depth += -1 if m.group(0) == '</div>' else 1
            if depth == 0:
                end = cursor + m.start()
                pos = cursor + m.end()
                break
        if end is None:
            break  # unbalanced markup — stop rather than loop forever
        results.append(html_text[cursor:end])
    return results


def check_best_of_css_standard(report: "Report") -> None:
    """Fail if the shared Best-of CSS or any Best-of page's HTML drifts
    from the locked standard.

    Two valid card formats coexist during the fleet-wide migration started
    2026-07-12:

      LEGACY   — .best-of-card / .best-of-name / .best-of-tag / .best-of-meta /
                 .best-of-desc / .best-of-links (.best-of-link pills). Text
                 only, no photo. The original uniform format from 2026-07-05.

      SHOWCASE — .showcase-card / .showcase-photo (a real Commons-sourced
                 photo, never hotlinked) / .showcase-body / .showcase-name /
                 .showcase-tag / .showcase-meta / .showcase-desc /
                 .showcase-links (plain <a> pills, no per-link class needed).
                 The new default (LOCKED 2026-07-12) — every Best-of page is
                 being migrated to this format one at a time; a page still on
                 LEGACY simply hasn't been converted yet. Best-Safari.html and
                 Best-Ultra-Luxurious-Hotels.html were the first two
                 conversions (originally two separate one-off class families,
                 .safari-* and .luxe-*) and proved the pattern before it was
                 consolidated into one shared .showcase-* CSS block that every
                 future conversion reuses — no page should ever add its own
                 bespoke photo-card CSS again.

    Both shared CSS blocks live once in web-travel-style.css (moved out of
    per-page duplication 2026-07-05, per the SHARED CSS ONLY rule) — this
    check reads them there, not per-page. A page must use exactly one format
    — never both, never neither. Best-Of-Index.html is exempt from format
    checks entirely (it's the category index; its cards link to other pages,
    not places).

    Common rules regardless of format: no per-page inline <style> block, no
    legacy sf-/np- prefixed classes, the card name is plain text (never
    wraps an <a> — the guide link lives in the links row instead), no
    inline style= inside a card, a summary is MANDATORY on every card and
    must never be stripped (LOCKED 2026-07-06, extended to SHOWCASE
    2026-07-12), every card ends with a Google Maps pill, and every
    internal guide link carries the 🌐 prefix and resolves to a file on
    disk. SHOWCASE adds two more: every card needs a
    "<!-- photo: ... -->" Commons attribution comment, and no <img> may
    hotlink upload.wikimedia.org (must be downloaded locally instead).
    """
    essentials = TRAVEL_ROOT / "Travel-Website" / "Trip-Essentials"
    all_files = sorted(essentials.glob("Best-*.html"))
    if not all_files:
        report.warn("check_best_of_css_standard: no Best-of pages found")
        return

    fails = []

    # ── Shared CSS — both formats live once in web-travel-style.css ──────────
    shared_css_path = TRAVEL_ROOT / "Travel-Website" / "assets" / "web-travel-style.css"
    if not shared_css_path.exists():
        fails.append("web-travel-style.css not found")
    else:
        css = shared_css_path.read_text(encoding="utf-8", errors="replace")
        CSS_CHECKS = {
            ".best-of-section-label": [
                ("font-size: 14px", "font-size must be 14px"),
                ("font-weight: 700", "font-weight must be 700"),
                ("color: var(--muted)", "color must be var(--muted)"),
                ("letter-spacing: 0.18em", "letter-spacing must be 0.18em"),
                ("text-transform: uppercase", "must be uppercase"),
            ],
            ".best-of-name": [
                ("font-size: 15px", "font-size must be 15px"),
                ("font-weight: 700", "font-weight must be 700"),
                ("color: var(--text)", "color must be var(--text)"),
            ],
            ".best-of-tag": [
                ("font-size: 13px", "font-size must be 13px"),
                ("color: var(--muted)", "color must be var(--muted)"),
            ],
            ".best-of-desc": [
                ("font-size: 13px", "font-size must be 13px"),
                ("color: var(--text)", "color must be var(--text)"),
                ("line-height: 1.5", "line-height must be 1.5"),
            ],
            ".best-of-card": [
                ("border-left: 3px solid var(--accent)", "border-left must be 3px solid var(--accent)"),
                ("padding: 14px 18px", "padding must be 14px 18px"),
                ("flex-direction: column", "card must be a flex column"),
            ],
            ".showcase-card": [
                ("border-radius: 12px", "border-radius must be 12px"),
                ("flex-direction: column", "card must be a flex column"),
            ],
            ".showcase-photo": [
                ("height: 190px", "photo box height must be 190px"),
            ],
            ".showcase-name": [
                ("font-size: 16px", "font-size must be 16px"),
                ("font-weight: 700", "font-weight must be 700"),
            ],
            ".showcase-tag": [
                ("font-size: 12.5px", "font-size must be 12.5px"),
                ("color: var(--muted)", "color must be var(--muted)"),
            ],
            ".showcase-desc": [
                ("font-size: 13px", "font-size must be 13px"),
                ("line-height: 1.55", "line-height must be 1.55"),
            ],
        }
        for selector, rules in CSS_CHECKS.items():
            block_m = re.search(re.escape(selector) + r"\s*\{([^}]+)\}", css)
            if not block_m:
                fails.append(f"web-travel-style.css: {selector} rule not found")
                continue
            block = block_m.group(1)
            for needle, msg in rules:
                if needle not in block:
                    fails.append(f"web-travel-style.css: {selector} {msg}")

        # Separator lines were removed 2026-07-05 — must not drift back.
        FORBIDDEN_BORDERS = {
            ".best-of-section-label": ("border-bottom", "must have NO bottom separator line"),
            ".best-of-links": ("border-top", "must have NO top separator line"),
        }
        for selector, (needle, msg) in FORBIDDEN_BORDERS.items():
            block_m = re.search(re.escape(selector) + r"\s*\{([^}]+)\}", css)
            if block_m and needle in block_m.group(1):
                fails.append(f"web-travel-style.css: {selector} {msg}")

        # Locked 2026-07-07: when a country's first region subsection label
        # immediately follows the country label (no card between them), the
        # subsection's own top margin/padding stacked with the country
        # label's bottom padding, producing an oversized gap (e.g. AUSTRALIA
        # / QUEENSLAND). Zeroed via an adjacent-sibling rule — must not drift.
        adj_m = re.search(
            r"\.best-of-section-label\s*\+\s*\.best-of-subsection-label\s*\{([^}]+)\}", css
        )
        if not adj_m:
            fails.append(
                "web-travel-style.css: .best-of-section-label + .best-of-subsection-label rule not found "
                "(needed to zero the gap when a region label directly follows its country label)"
            )
        else:
            adj_block = adj_m.group(1)
            if "margin-top: 0" not in adj_block:
                fails.append("web-travel-style.css: .best-of-section-label + .best-of-subsection-label must set margin-top: 0")
            if "padding-top: 0" not in adj_block:
                fails.append("web-travel-style.css: .best-of-section-label + .best-of-subsection-label must set padding-top: 0")

    LEGACY_ALLOWED = {"best-of-card", "best-of-name", "best-of-tag", "best-of-desc",
                      "best-of-meta", "best-of-links", "best-of-link"}
    SHOWCASE_ALLOWED = {"showcase-card", "showcase-photo", "showcase-body", "showcase-name",
                        "showcase-tag", "showcase-desc", "showcase-meta", "showcase-links"}

    n_legacy_pages = 0
    n_showcase_pages = 0

    for fpath in all_files:
        page_html = fpath.read_text(encoding="utf-8", errors="replace")

        # Retired legacy prefixes must never reappear.
        if re.search(r'class="[^"]*\b(sf|np)-[a-z-]+', page_html):
            fails.append(f"{fpath.name}: legacy 'sf-'/'np-' prefixed class found (retired 2026-07-05, use best-of-/showcase-)")

        # Section/subsection labels must carry no inline style= — spacing lives
        # ONLY in the shared .best-of-section-label / .best-of-subsection-label
        # CSS rules, on both formats. An inline style would silently defeat it
        # on that one page.
        for m in re.finditer(r'<div class="(best-of-section-label|best-of-subsection-label)"[^>]*>', page_html):
            if 'style="' in m.group(0):
                fails.append(f"{fpath.name}: inline style= on .{m.group(1)} — spacing must come from shared CSS only")

        # CSS must not be re-duplicated inline — it lives once in the shared sheet.
        if re.search(r"<style>", page_html):
            fails.append(f"{fpath.name}: inline <style> block found — Best-of CSS must live only in web-travel-style.css")

        body_m = re.search(r"<body[^>]*>(.*?)</body>", page_html, re.DOTALL)
        body = body_m.group(1) if body_m else page_html

        if fpath.name == "Best-Of-Index.html":
            continue  # category index — cards link to other pages, format-exempt

        n_legacy_cards = body.count('class="best-of-card"')
        n_showcase_cards = body.count('class="showcase-card"')

        if n_legacy_cards and n_showcase_cards:
            fails.append(f"{fpath.name}: mixes legacy .best-of-card ({n_legacy_cards}) and .showcase-card ({n_showcase_cards}) — a page must use exactly one format")
            continue
        if not n_legacy_cards and not n_showcase_cards:
            fails.append(f"{fpath.name}: no .best-of-card or .showcase-card found — cannot determine format")
            continue

        if n_showcase_cards:
            n_showcase_pages += 1
            n_cards = n_showcase_cards
            card_class, allowed = "showcase-card", SHOWCASE_ALLOWED
            name_cls, tag_cls, desc_cls, links_cls, photo_cls = (
                "showcase-name", "showcase-tag", "showcase-desc", "showcase-links", "showcase-photo",
            )
        else:
            n_legacy_pages += 1
            n_cards = n_legacy_cards
            card_class, allowed = "best-of-card", LEGACY_ALLOWED
            name_cls, tag_cls, desc_cls, links_cls, photo_cls = (
                "best-of-name", "best-of-tag", "best-of-desc", "best-of-links", None,
            )

        # ── Per-card structural checks (balanced-div extraction) ──────────
        for card_body in _extract_balanced_divs(body, card_class):
            classes_in_card = set(re.findall(r'class="([a-z-]+)"', card_body))
            stray = classes_in_card - allowed
            if stray:
                fails.append(f"{fpath.name}: card has non-standard class(es) {sorted(stray)} — cards must contain only {sorted(allowed)}")
            if re.search(rf'class="{name_cls}"><a\b', card_body):
                fails.append(f"{fpath.name}: {name_cls} wraps an <a> — name must be plain text (guide link goes in the links row)")
            if 'style="' in card_body:
                fails.append(f"{fpath.name}: inline style= inside a card — no hardcoded styles, use shared CSS")

        # ── MANDATORY summary — every place card carries one, never stripped.
        # Counted rather than parsed per-card so multi-line .*-meta blocks
        # don't cause false misses.
        n_desc = body.count(f'class="{desc_cls}"')
        if n_desc < n_cards:
            fails.append(f"{fpath.name}: {n_cards - n_desc} card(s) missing a .{desc_cls} summary — every place card must carry a summary (mandatory, never strip)")
        elif n_desc > n_cards:
            fails.append(f"{fpath.name}: {n_desc} .{desc_cls} vs {n_cards} cards — stray/duplicate summary block")

        # ── card element completeness — name / tag / links (+ photo on SHOWCASE)
        elems = [(name_cls, name_cls), (tag_cls, tag_cls), (links_cls, links_cls)]
        if photo_cls:
            elems.append((photo_cls, photo_cls))
        elem_names = "/".join(e for e, _ in elems)
        for elem, label in elems:
            n_elem = body.count(f'class="{elem}"')
            if n_elem < n_cards:
                fails.append(f"{fpath.name}: {n_cards - n_elem} card(s) missing .{label} — every card needs {elem_names}")
            elif n_elem > n_cards:
                fails.append(f"{fpath.name}: {n_elem} .{label} vs {n_cards} cards — stray element")

        # ── Map link required on every card ───────────────────────────────
        n_map = body.count("google.com/maps")
        if n_map < n_cards:
            fails.append(f"{fpath.name}: {n_cards - n_map} card(s) missing a Google Maps link — every card must end with a Map pill")

        # ── Guide links: globe emoji + link resolution (format-agnostic —
        # LEGACY wraps the link in class="best-of-link", SHOWCASE uses a
        # plain <a>; both match the same pattern). ────────────────────────
        essentials_dir = fpath.parent
        for lm in re.finditer(r'<a\b[^>]*href="(\.\./Guides/[^"]+)"[^>]*>([^<]*)</a>', page_html):
            href, text = lm.group(1), lm.group(2).strip()
            if not text.startswith("🌐"):
                fails.append(f"{fpath.name}: guide link '{text}' missing 🌐 prefix — use '🌐 City Guide'")
            target = (essentials_dir / href).resolve()
            if not target.is_file():
                fails.append(f"{fpath.name}: guide link {href!r} does not resolve to a file on disk")

        # ── SHOWCASE only: photo credited + never hotlinked ───────────────
        if n_showcase_cards:
            n_photo_credits = len(re.findall(r'<!--\s*photo:.+?-->', body, re.DOTALL))
            if n_photo_credits < n_cards:
                fails.append(f"{fpath.name}: {n_cards - n_photo_credits} card(s) missing a '<!-- photo: ... -->' Commons attribution comment")
            for im in re.finditer(r'<img\b[^>]*\bsrc="([^"]+)"', body):
                if "upload.wikimedia.org" in im.group(1):
                    fails.append(f"{fpath.name}: hotlinked Commons image {im.group(1)!r} — download it locally to assets/best-of/ instead")

    if fails:
        for f in fails:
            report.fail(f"check_best_of_css_standard: {f}")
    else:
        report.ok(
            f"Best-of CSS standard: shared CSS locked, {n_showcase_pages} page(s) on the SHOWCASE "
            f"photo-card format, {n_legacy_pages} still on LEGACY (migration in progress) — every "
            f"page internally consistent, every card carries a summary, Map pill, 🌐 guide links, "
            f"no name-anchors, no inline styles, no legacy sf-/np- classes"
        )


def check_best_of_country_order(report: "Report") -> None:
    """Fail if country sections or the filter dropdown in any Best-of page are not
    in alphabetical order.

    Two sub-checks per page (Best-Of-Index.html exempt):

    (1) SECTION ORDER — <div class="best-of-section-label"> elements must appear
        in case-insensitive A→Z order in the HTML.

    (2) FILTER SOURCE — the regionJump filter dropdown must be built dynamically
        from querySelector('.best-of-section-label'), not a hardcoded list.
        Because the filter reads section labels in DOM order, enforcing (1) also
        enforces alphabetical filter order. If the JS is replaced with a hardcoded
        list, (2) catches the drift before (1) can guarantee anything.

    Added 2026-07-07. Filter sub-check added 2026-07-07.
    """
    essentials = TRAVEL_ROOT / "Travel-Website" / "Trip-Essentials"
    all_files = sorted(essentials.glob("Best-*.html"))
    if not all_files:
        report.warn("check_best_of_country_order: no Best-of pages found")
        return

    fails = []

    for fpath in all_files:
        if fpath.name == "Best-Of-Index.html":
            continue
        try:
            body = fpath.read_text(encoding="utf-8")
        except OSError:
            fails.append(f"{fpath.name}: could not read file")
            continue

        # Sub-check 1: section label order
        labels = re.findall(r'<div class="best-of-section-label">([^<]+)</div>', body)
        if labels:
            stripped = [lbl.strip() for lbl in labels]
            expected = sorted(stripped, key=lambda s: s.lower())
            if stripped != expected:
                out_of_order = []
                for i, (actual, exp) in enumerate(zip(stripped, expected)):
                    if actual.lower() != exp.lower():
                        out_of_order.append(f"pos {i+1}: got '{actual}', expected '{exp}'")
                fails.append(
                    f"{fpath.name}: country sections not in alphabetical order — "
                    + "; ".join(out_of_order[:5])
                    + (f" (…+{len(out_of_order)-5} more)" if len(out_of_order) > 5 else "")
                )

        # Sub-check 2: filter dropdown must be built from section labels, not hardcoded.
        # The canonical pattern queries '.best-of-section-label' elements to populate
        # the regionJump menu. A hardcoded list of days-jump-item buttons in the HTML
        # (outside of <script>) would bypass section ordering entirely.
        # Strip all <script>…</script> blocks before checking — the dynamic builder
        # itself contains the button template string and would false-positive otherwise.
        html_only = re.sub(r'<script\b[^>]*>.*?</script>', '', body, flags=re.DOTALL)
        static_filter_items = re.findall(
            r'<button[^>]+class="days-jump-item"[^>]*data-region="(?!all)[^"]*"',
            html_only
        )
        if static_filter_items:
            fails.append(
                f"{fpath.name}: filter dropdown has {len(static_filter_items)} hardcoded "
                f"country button(s) in HTML — filter must be built dynamically from "
                f".best-of-section-label elements so section order controls filter order"
            )

    for f in fails:
        report.fail(f"check_best_of_country_order: {f}")

    if not fails:
        report.ok(
            f"Best-of country order: all {len(all_files)} pages — sections A→Z and "
            f"filter built dynamically from section labels (filter order = section order)"
        )


def check_best_of_sidebar_coverage(report: "Report") -> None:
    """
    HARD-FAIL if any Best-*.html page in Trip-Essentials/ is missing a
    dest-card[data-special] entry in Guides-Index.html sidebar.

    Best-Of-Index.html is exempt (it's the category index, not a Best-of page).

    Added 2026-07-09 after Natural Phenomena was found missing from the sidebar.
    """
    essentials = WEB_ROOT / "Trip-Essentials"
    index_path = WEB_ROOT / "Guides" / "Guides-Index.html"
    if not essentials.exists() or not index_path.exists():
        return

    import re as _re

    index_html = index_path.read_text(encoding="utf-8")

    # Collect all href values from data-special dest-cards pointing into Trip-Essentials
    sidebar_hrefs = set(_re.findall(
        r'<a\s[^>]*data-special[^>]*href=["\']([^"\']+)["\']',
        index_html
    ))

    fails = []
    best_files = sorted(essentials.glob("Best-*.html"))
    for fpath in best_files:
        if fpath.name == "Best-Of-Index.html":
            continue
        expected_href = f"../Trip-Essentials/{fpath.name}"
        if expected_href not in sidebar_hrefs:
            fails.append(fpath.name)

    for f in fails:
        report.fail(f"check_best_of_sidebar_coverage: {f} exists in Trip-Essentials/ but has no sidebar card in Guides-Index.html")

    if not fails:
        report.ok(f"Best-of sidebar coverage: all {len(best_files) - 1} pages have a sidebar card")


def check_guide_filename_hyphenation(report: "Report") -> None:
    """
    HARD-FAIL if a guide filename's city-name part doesn't match its folder name
    (accounting for hyphens vs underscores).

    Rule: Guide HTML filenames must use hyphens in the city-name part to match the
    folder name exactly. Pattern: {city-name-with-hyphens}_v{n}.html

    Examples:
      • Folder: New-Orleans → Filename: new-orleans_v1.html (PASS)
      • Folder: New-Orleans → Filename: new_orleans_v1.html (FAIL)
      • Folder: Paris → Filename: paris_v1.html (PASS - no hyphens needed)

    This enforces consistency between folder naming (which uses hyphens per the
    Local Paths rule) and guide filenames (which must match their containing folder).

    Added 2026-07-05 after renaming 47 guides to use hyphens throughout the fleet.
    """
    guides_dir = WEB_ROOT / "Guides"
    if not guides_dir.exists():
        return

    fails = []

    for city_dir in sorted(guides_dir.iterdir()):
        if not city_dir.is_dir():
            continue

        folder_name = city_dir.name
        folder_lower = folder_name.lower()

        # Only check folders with hyphens (multi-word cities)
        if '-' not in folder_name:
            continue

        import unicodedata as _ud
        def _ascii_lower(s: str) -> str:
            """Normalize Unicode diacritics to ASCII for filename comparison."""
            return _ud.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()

        for item in sorted(city_dir.iterdir()):
            if item.is_dir() or item.suffix.lower() != ".html":
                continue
            if item.name == "Guides-Index.html":
                continue

            filename = item.name

            # Extract the city-name part (before _v)
            if '_v' not in filename:
                continue

            city_part = filename.split('_v')[0]
            # Compare using ASCII-normalized forms so that e.g.
            # folder "Foz-do-Iguaçu" (ç) matches file "foz-do-iguacu" (c)
            expected_city = folder_lower

            # Check if they match (normalize diacritics for comparison)
            if _ascii_lower(city_part) != _ascii_lower(expected_city):
                rel = f"Guides/{folder_name}/{filename}"
                msg = (
                    f"{rel} — guide filename city-name part doesn't match folder. "
                    f"Folder: {folder_name} ({folder_lower}) · Filename: {filename} ({city_part}). "
                    f"Rename to {expected_city}_v*.html to match the folder name. "
                    f"Then update all references in index cards, cross-links, data pages, and related guides."
                )
                fails.append(msg)

    for msg in fails:
        report.fail(msg)

    if not fails:
        report.ok("Guide filename hyphenation: all guide filenames match their folder names (city-name-with-hyphens_vN.html)")


def check_pill_rest_state(report: "Report") -> None:
    """FAIL if any shareable page or shared CSS file defines a filter pill / category
    chip whose REST-state shape deviates from the section 17 standard (Colors and Font
    Size.html, 2026-06-20):

      padding:       6px 12px    (exact)
      border-radius: 6px         (exact — never pill-round / 16px / 20px / 999px)
      font-size:     13px        (exact)
      background:    #fdf8f0 or var(--warm) or var(--surface)

    Scans <style> blocks in shareable pages AND linked CSS files in assets/
    (web-travel-style.css, guide-style.css -- but NOT mobile.css which is a defensive
    override utility).  Only non-active/non-hover rules are checked (the active/hover
    state is covered by check_active_pill_color and check_pill_hover_behavior).

    DESKTOP ONLY -- @media block bodies are stripped before scanning (see
    _strip_media_blocks). Section 17 is the desktop pill shape; the mobile @media
    overrides are a deliberate separate format (the full-width glued-grid tile:
    46px tall, border-radius 0, 12px font, 4px 6px padding, in a gap:0 grid) used on
    the guides-index filter panels, the stats/jump nav grids, and the European Train
    Guide filter strip. Judging those against the desktop shape is a false positive.

    Severity: HARD-FAIL (promoted from warn 2026-07-11, enforcement-gap sweep).
    The prior tolerant thresholds (radius flagged only 16/20/999px/50%, padding
    flagged only outside a 5-8px / 10-14px band) let a value like radius:8px or
    padding:7px 13px pass silently and it was never a ship gate. Tightened to
    exact-match; fleet scan found 0 violations among the true filter-pill
    selectors once .tier-pill was excluded (see below) — safe to hard-fail.

    Added 2026-07-10 to close the gap between the section 17 spec and brain_check
    coverage; promoted to hard-fail + exact match 2026-07-11.
    """
    import re as _re

    # -- pill selectors to scan ---------------------------------------------------
    # Filter pills only -- NOT control buttons (.stab / .seg-btn / .disc-btn), which
    # are the All/Been/Want-style status toggles governed by Pill-Standard.md
    # "Behavior 2: Control Button" (height 32-40px, font-size 12px valid). Judging a
    # 12px control button against the 13px filter-pill shape is a false positive.
    # .tier-pill EXCLUDED 2026-07-11 (enforcement-gap sweep): Delta-Routes-Full.html
    # / Delta-Routes-SEA.html use it as a semantic flight-tier BADGE (🟢 Nonstop /
    # 🔵 1-stop / 🟠 2-stop), each with its own tier-specific background color
    # (var(--c0bg)/--c1bg/--c2bg) — a data badge, not a filter pill, and its shape
    # (4px radius, 5px 12px padding) is deliberately distinct in both usages. Same
    # reasoning as the .stab/.seg-btn control-button exclusion above.
    PILL_SELS = (
        r'\.pill\b', r'\.filter-btn\b', r'\.filter-pill\b',
        r'\.fchip\b', r'\.mchip\b', r'\.tchip\b', r'\.lchip\b',
    )
    PILL_SEL_RE = _re.compile('|'.join(PILL_SELS), _re.I)

    # Skip rules whose selector indicates an active/hover/selected state --
    # those are covered by the active-pill-color check, not this rest-state check.
    ACTIVE_SEL_RE = _re.compile(
        r'\.(active|on|selected|copied|set)\b|:hover|:focus', _re.I
    )
    # Sub-elements inside pills (count badges, carets) are not filter pills
    PILL_SUB_RE = _re.compile(r'\.pill-count\b|\.disc-caret\b', _re.I)

    STYLE_BLOCK_RE = _re.compile(r'<style[^>]*>(.*?)</style>', _re.S | _re.I)
    CSS_RULE_RE    = _re.compile(r'([^{}]+)\{([^{}]*)\}', _re.S)

    def _strip_media_blocks(css_text: str) -> str:
        """Remove every @media block body (brace-balanced) so only DESKTOP,
        top-level rules survive. This rest-state check enforces the section-17
        DESKTOP standard; the mobile @media overrides are a deliberate, separate
        format — the full-width glued-grid filter tile (height 46px,
        border-radius 0, font-size 12px, padding 4px 6px), used on the guides
        index filter panels, the stats/jump nav grids, and the European Train
        Guide filter strip. Those are NOT skinny-pill regressions and must not be
        judged against the desktop pill shape. The plain CSS_RULE_RE above is not
        nesting-aware, so without this strip it would match a chip selector INSIDE
        an @media block (the '@media' text having been consumed by an earlier
        partial match) and false-flag it. Added 2026-07-11."""
        out: list[str] = []
        i, n = 0, len(css_text)
        low = css_text.lower()
        while i < n:
            m = low.find('@media', i)
            if m == -1:
                out.append(css_text[i:])
                break
            out.append(css_text[i:m])
            brace = css_text.find('{', m)
            if brace == -1:
                break
            depth, j = 1, brace + 1
            while j < n and depth > 0:
                c = css_text[j]
                if c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                j += 1
            i = j  # resume after the closing brace of the @media block
        return ''.join(out)

    # Property extractors -- tolerant of whitespace
    BORDER_RADIUS_RE = _re.compile(r'border-radius\s*:\s*([^;}\n]+)', _re.I)
    FONT_SIZE_RE     = _re.compile(r'(?<![a-z-])font-size\s*:\s*([^;}\n]+)', _re.I)
    PADDING_RE       = _re.compile(r'(?<![a-z-])padding\s*:\s*([^;}\n]+)', _re.I)
    BACKGROUND_RE    = _re.compile(r'(?<![a-z-])background(?:-color)?\s*:\s*([^;}\n]+)', _re.I)

    # Acceptable values
    OK_RADIUS  = {'6px'}
    OK_FONT    = {'13px'}
    OK_PADDING = {'6px 12px', '6px12px'}  # collapsed whitespace variant
    OK_BG      = {'#fdf8f0', 'var(--warm)', 'var(--surface)', '#faf5eb'}

    # -- collect files to scan ----------------------------------------------------
    files_to_scan: list[Path] = []

    # Shareable pages (inline <style>)
    files_to_scan.extend(_shareable_pages())

    # Shared CSS assets (not mobile.css -- it is a defensive override utility)
    _EXCLUDED_CSS = {'mobile.css'}
    assets_dir = ASSETS_DIR
    if assets_dir.exists():
        for css_file in sorted(assets_dir.glob('*.css')):
            if css_file.name not in _EXCLUDED_CSS:
                files_to_scan.append(css_file)

    # -- scan ---------------------------------------------------------------------
    warnings: list[str] = []

    for fpath in sorted(set(files_to_scan)):
        if not fpath.exists():
            continue
        try:
            text = fpath.read_text(encoding='utf-8', errors='replace')
        except Exception:
            continue

        rel = fpath.relative_to(TRAVEL_ROOT) if str(fpath).startswith(str(TRAVEL_ROOT)) else fpath

        # For CSS files, the entire content is CSS; for HTML, extract <style> blocks
        css_chunks: list[str] = []
        if fpath.suffix.lower() == '.css':
            css_chunks.append(text)
        else:
            for m in STYLE_BLOCK_RE.finditer(text):
                css_chunks.append(m.group(1))

        for css in css_chunks:
            css = _strip_media_blocks(css)  # desktop rest-state only; mobile grid-tiles are a separate format
            for rule_match in CSS_RULE_RE.finditer(css):
                selector = rule_match.group(1).strip()
                body     = rule_match.group(2)

                # Only care about pill selectors
                if not PILL_SEL_RE.search(selector):
                    continue
                # Skip active/hover/selected states
                if ACTIVE_SEL_RE.search(selector):
                    continue
                # Skip pill sub-elements (count badges, carets)
                if PILL_SUB_RE.search(selector):
                    continue
                # Skip @media rules (the selector text may contain @media)
                if '@media' in selector:
                    continue

                # -- border-radius (exact match) ----------------------------------
                m_radius = BORDER_RADIUS_RE.search(body)
                if m_radius:
                    val = m_radius.group(1).strip().rstrip('!important').strip()
                    # Only judge a plain px value — var()/calc() are left alone.
                    if _re.match(r'^\d+(\.\d+)?px$', val) and val not in OK_RADIUS:
                        warnings.append(
                            f"{rel} -- selector '{selector[:80]}' has "
                            f"border-radius:{val} (standard is exactly 6px)"
                        )
                    elif val == '50%':
                        warnings.append(
                            f"{rel} -- selector '{selector[:80]}' has "
                            f"border-radius:50% (standard is exactly 6px)"
                        )

                # -- font-size (exact match) ---------------------------------------
                m_font = FONT_SIZE_RE.search(body)
                if m_font:
                    val = m_font.group(1).strip().rstrip('!important').strip()
                    # Only judge a plain px value — var()/calc()/inherit are left alone.
                    if _re.match(r'^\d+(\.\d+)?px$', val) and val not in OK_FONT:
                        warnings.append(
                            f"{rel} -- selector '{selector[:80]}' has "
                            f"font-size:{val} (standard is exactly 13px)"
                        )

                # -- padding (exact match) ------------------------------------------
                m_pad = PADDING_RE.search(body)
                if m_pad:
                    val = m_pad.group(1).strip().rstrip('!important').strip()
                    # Normalize whitespace for comparison
                    normalized = _re.sub(r'\s+', ' ', val)
                    # Only judge a plain two-value px padding — var()/calc()/single-value
                    # shorthand (e.g. "6px" alone) are left alone (different shape entirely).
                    if (_re.match(r'^\d+(\.\d+)?px \d+(\.\d+)?px$', normalized)
                            and normalized not in OK_PADDING):
                        warnings.append(
                            f"{rel} -- selector '{selector[:80]}' has "
                            f"padding:{normalized} (standard is exactly 6px 12px)"
                        )

                # -- background (rest state) --------------------------------------
                m_bg = BACKGROUND_RE.search(body)
                if m_bg:
                    val = m_bg.group(1).strip().rstrip('!important').strip()
                    val_lower = val.lower()
                    if val_lower not in {
                        '#fdf8f0', '#faf5eb', 'var(--warm)', 'var(--surface)',
                        'transparent', 'inherit', 'none', '#fff', '#ffffff',
                        'white',
                    } and not val_lower.startswith('var(') and not val_lower.startswith('linear-gradient'):
                        # Flag obviously wrong solid colors but allow warm-cream
                        # tones (#fXXXXX where first nibble is f)
                        if _re.match(r'^#[0-9a-f]{3,8}$', val_lower):
                            if not val_lower.startswith('#f'):
                                warnings.append(
                                    f"{rel} -- selector '{selector[:80]}' has "
                                    f"rest-state background:{val} (standard is "
                                    f"#fdf8f0 / var(--warm))"
                                )

    for w in warnings:
        report.fail(f"check_pill_rest_state: {w}")
    if not warnings:
        report.ok(
            f"Pill rest-state standard (section 17): border-radius 6px, font-size "
            f"13px, padding 6px 12px, warm background -- all conformant across "
            f"{len(files_to_scan)} files"
        )


def check_mobile_design_system(report: "Report") -> None:
    """HARD-FAIL if the shared mobile design system regresses.

    The 2026-07 mobile redesign is centralized in shared CSS assets (mobile.css,
    guides-index-style.css, and — for the extras-nav row's desktop chip + its
    mobile Form B tile — guide-style.css), and every page inherits it, so the
    whole site's mobile/desktop pill look lives or dies by these files. This locks
    the signature invariants so a stray edit (or a revert) to a shared source is
    caught at session start (brain_check must exit 0) before it silently ships to
    every page. This is the "does not drift over time" gate; when you make a
    DELIBERATE change to one of these rules, update the matching invariant here in the
    same pass (the same discipline as check_guide_header_css_standard /
    check_best_of_css_standard). Full spec: Colors and Font Size.html § 17 +
    Pill-Standard.md. Added 2026-07-11; guide-style.css entries added 2026-07-12.
    """
    import re as _re

    def _norm(txt: str) -> str:
        # collapse all whitespace to single spaces so block-spanning regexes are stable
        return _re.sub(r'\s+', ' ', txt)

    assets = ASSETS_DIR
    mobile_p = assets / 'mobile.css'
    gindex_p = assets / 'guides-index-style.css'
    guide_style_p = assets / 'guide-style.css'

    # (file-label, Path, [(invariant-name, compiled-regex), ...])
    checks: list[tuple[str, Path, list[tuple[str, "re.Pattern"]]]] = []

    if mobile_p.exists():
        m = _norm(mobile_p.read_text(encoding='utf-8', errors='replace'))
        checks.append(('assets/mobile.css', mobile_p, [
            ('universal box-sizing (no-overflow guard)',
             _re.compile(r'box-sizing: border-box', _re.I)),
            ('media max-width:100% (no-overflow guard)',
             _re.compile(r'img, svg, video, canvas, iframe, embed, object \{[^}]*max-width: 100%', _re.I)),
            ('table horizontal-scroll containment',
             _re.compile(r'table \{[^}]*display: block[^}]*overflow-x: auto', _re.I)),
            ('body hard-stop on horizontal scroll',
             _re.compile(r'body \{[^}]*overscroll-behavior-x: contain', _re.I)),
            ('banner h1 = 14px / 700 / #3d3a32 / uppercase',
             _re.compile(r'\.header h1[^{]*\{[^}]*font-size: 14px[^}]*font-weight: 700[^}]*color: #3d3a32[^}]*text-transform: uppercase', _re.I)),
            ('Form A rounded pill = 13px / 8px 14px / 6px radius',
             _re.compile(r'\.fchip[^{]*\{[^}]*font-size: 13px[^}]*padding: 8px 14px[^}]*border-radius: 6px', _re.I)),
            ('Form B section-nav grid = repeat(3,1fr) / gap 0',
             _re.compile(r'\.stats-nav, \.jump-nav \{[^}]*grid-template-columns: repeat\(3, 1fr\)[^}]*gap: 0', _re.I)),
            ('Form B glued tile = 46px height / 0 radius',
             _re.compile(r'\.stats-nav a, \.jump-pill, \.jump-btn \{[^}]*height: 46px[^}]*border-radius: 0', _re.I)),
            ('search bar uniform height 48px',
             _re.compile(r'height: 48px !important; min-height: 48px !important', _re.I)),
            ('toolbar terracotta gradient bar',
             _re.compile(r'\.tb \{[^}]*background: linear-gradient\(135deg,#7a3b1e', _re.I)),
            ('text-size-adjust normalization',
             _re.compile(r'-webkit-text-size-adjust:\s*100%', _re.I)),
            ('prefers-reduced-motion guard',
             _re.compile(r'@media \(prefers-reduced-motion:\s*reduce\)', _re.I)),
            ('safe-area-inset support',
             _re.compile(r'env\(safe-area-inset-', _re.I)),
            ('focus-visible on toolbar (accessibility)',
             _re.compile(r'\.tb.*:focus-visible', _re.I)),
            ('landscape orientation rules',
             _re.compile(r'@media \(orientation:\s*landscape\)', _re.I)),
        ]))

    if gindex_p.exists():
        g = _norm(gindex_p.read_text(encoding='utf-8', errors='replace'))
        checks.append(('assets/guides-index-style.css', gindex_p, [
            ('index filter panel Form B tile (.fchip) = 46px / 0 radius / 12px / 4px 6px',
             _re.compile(r'\.fchip \{[^}]*height: 46px[^}]*border-radius: 0[^}]*font-size: 12px[^}]*padding: 4px 6px', _re.I)),
            ('index Type panel Form B tile (.tchip) = 46px / 0 radius',
             _re.compile(r'\.tchip \{[^}]*height: 46px[^}]*border-radius: 0', _re.I)),
            ('index Language panel Form B tile (.lchip) = 46px / 0 radius',
             _re.compile(r'\.lchip \{[^}]*height: 46px[^}]*border-radius: 0', _re.I)),
        ]))

    if guide_style_p.exists():
        gs = _norm(guide_style_p.read_text(encoding='utf-8', errors='replace'))
        checks.append(('assets/guide-style.css', guide_style_p, [
            # Extras-nav row (Trip Overview.html § 6) — desktop chip added 2026-07-12,
            # reusing the .also-on-this-site-pill visual language. Mobile keeps its
            # own pre-existing Form B glued-grid tile, untouched by that change.
            ('extras-nav desktop chip (.overview-extras .overview-extra-link) = 6px radius / 6px 12px padding',
             _re.compile(r'\.overview-extras \.overview-extra-link \{[^}]*border-radius: 6px[^}]*padding: 6px 12px', _re.I)),
            ('extras-nav desktop chip hover = terracotta gradient (not gold, not underline)',
             _re.compile(r'\.overview-extras \.overview-extra-link:hover \{[^}]*background: linear-gradient\(135deg,#7a3b1e', _re.I)),
            ('extras-nav legacy pipe separator suppressed (.overview-extras > span hidden)',
             _re.compile(r'\.overview-extras > span \{[^}]*display: none', _re.I)),
            ('extras-nav mobile Form B tile = 46px height / 0 radius (separate format, must survive the desktop chip change)',
             _re.compile(r'\.overview-extra-link \{[^}]*width: auto !important; height: 46px !important', _re.I)),
        ]))

    missing_files = []
    for label, path in [('assets/mobile.css', mobile_p), ('assets/guides-index-style.css', gindex_p),
                         ('assets/guide-style.css', guide_style_p)]:
        if not path.exists():
            missing_files.append(label)
    for mf in missing_files:
        report.fail(f"check_mobile_design_system: shared mobile source {mf} is MISSING — every page's mobile look depends on it")

    n_ok = 0
    for label, path, invariants in checks:
        text = _norm(path.read_text(encoding='utf-8', errors='replace'))
        for name, rx in invariants:
            if rx.search(text):
                n_ok += 1
            else:
                report.fail(
                    f"check_mobile_design_system: {label} lost its locked invariant "
                    f"'{name}' — the mobile design system has drifted. Restore it, or if "
                    f"the change is deliberate update the invariant in brain_check + "
                    f"Colors and Font Size.html § 17 in the same pass."
                )

    if not missing_files and n_ok and not any(
        'check_mobile_design_system' in f for f in report.failures
    ):
        report.ok(
            f"Mobile design system locked — {n_ok} shared-CSS invariants intact "
            f"(no-overflow guards, banner 14px, Form A pill, Form B glued tiles, "
            f"48px search, index filter panels, reduced-motion, safe-area, "
            f"text-size-adjust, focus-visible, landscape)"
        )


def check_stop_row_rhythm(report: "Report") -> None:
    """HARD-FAIL if the stop-block vertical rhythm regresses in guide-style.css.

    Before this rule, only the trailing (usually .stop-row-classed) row inside
    a .tour-box/.ticket-box carried a margin — every row above it was a bare
    <div> with zero margin, so row-to-row gaps were visibly uneven, and the
    same bare-div gap existed above the ↳ prose summary row in most shipped
    guides (that class was applied inconsistently fleet-wide). Locks the six
    rules that fixed it — all container-scoped or position-scoped, so the fix
    lands on every existing guide with no HTML edits. When you make a
    DELIBERATE change to one of these values, update the matching invariant
    here in the same pass. Added 2026-07-12.
    """
    import re as _re

    def _norm(txt: str) -> str:
        return _re.sub(r'\s+', ' ', txt)

    guide_style_p = ASSETS_DIR / 'guide-style.css'
    if not guide_style_p.exists():
        report.fail("check_stop_row_rhythm: assets/guide-style.css is MISSING — every guide's stop rhythm depends on it")
        return

    text = _norm(guide_style_p.read_text(encoding='utf-8', errors='replace'))

    invariants = [
        ('.stop-block margin-bottom = 8px',
         _re.compile(r'\.stop-block\s*\{[^}]*margin-bottom:\s*8px', _re.I)),
        ('↳ prose row (2nd child of .stop-block) margin-top = 6px, position-scoped',
         _re.compile(r'\.stop-block\s*>\s*:nth-child\(2\)\s*\{[^}]*margin-top:\s*6px', _re.I)),
        ('📖 Wikipedia row = 4px top / 8px bottom (asymmetric, compensates for text-leading)',
         _re.compile(r'\.stop-block\s*>\s*\.stop-row:has\(>\s*a\[href\*="en\.wikipedia\.org"\]\)\s*\{[^}]*margin-top:\s*4px[^}]*margin-bottom:\s*8px', _re.I)),
        ('.tour-box/.ticket-box internal rows margin-top = 6px, position-scoped (not class-scoped)',
         _re.compile(r'\.tour-box\s*>\s*div,\s*\.ticket-box\s*>\s*div\s*\{\s*margin-top:\s*6px', _re.I)),
        ('.tour-box/.ticket-box internal rows first-child margin-top reset to 0',
         _re.compile(r'\.tour-box\s*>\s*div:first-child,\s*\.ticket-box\s*>\s*div:first-child\s*\{\s*margin-top:\s*0', _re.I)),
        ('.stop-photos margin-top = 8px',
         _re.compile(r'\.stop-photos\s*\{[^}]*margin-top:\s*8px', _re.I)),
        ('end-of-day .next banner margin-bottom = 12px (heavier break than the 8px same-day transition)',
         _re.compile(r'\.day-block\s*>\s*\.next:last-child\s*\{\s*margin-bottom:\s*12px', _re.I)),
    ]

    n_ok = 0
    for name, rx in invariants:
        if rx.search(text):
            n_ok += 1
        else:
            report.fail(
                f"check_stop_row_rhythm: assets/guide-style.css lost its locked invariant "
                f"'{name}' — the stop-block vertical rhythm has drifted. Restore it, or if "
                f"the change is deliberate update the invariant in brain_check.py "
                f"(check_stop_row_rhythm) in the same pass."
            )

    if n_ok == len(invariants):
        report.ok(
            f"Stop-block rhythm locked — {n_ok} invariants intact "
            f"(name→↳ 6px, ↳→📖 4px/8px, box rows 6px, box→photo 8px, "
            f"end-of-day banner 12px)"
        )


def check_active_pill_color(report: "Report") -> None:
    """HARD-FAIL if any Trip-Essentials or site page uses the gold/olive accent color
    (#8a6c1a or var(--accent)) as a solid background on an active/selected/on/hover-fill state.

    The correct active-state background is always terracotta: #b85c2a or the terracotta gradient.
    Gold (#8a6c1a / --accent) is legitimate only for TEXT color, small semantic dots/indicators,
    and the Amex gold brand color in Lounges pages.

    Allowed exemptions:
      - Semantic data colors: SAFE_COLORS 'Moderate', cost tier 'Moderate', FMAP home dot — these
        use #8a6c1a as a DATA value embedded in JS objects, not as a CSS rule.
      - Amex section label in Lounges pages: .section-label.amex { background:#f7f3e8; color:var(--gold) }
        (very light background, text use only).
      - Pickleball bar fill uses yellow (#c8960c) by spec — separate check.

    Pattern matched: any CSS rule block containing both:
      1. A selector with active / .on / .selected / :hover / .copied / .set
      2. A background property using #8a6c1a or var(--accent)

    Added 2026-07-07 after recurring crib drift putting gold on filter pill active states.
    """
    import re

    site_root = TRAVEL_ROOT / "Travel-Website"
    pages_to_check = list(site_root.glob("*.html")) + list((site_root / "Trip-Essentials").glob("*.html"))
    pages_to_check += list((site_root / "Trip-Essentials" / "Maps").glob("*.html"))

    # Pattern: a CSS block whose selector contains an active/on/selected/hover/copied keyword
    # and whose body contains background referencing the gold color.
    # We scan <style> blocks only; inline style= on individual elements is not matched.
    STYLE_BLOCK = re.compile(r"<style[^>]*>(.*?)</style>", re.S | re.I)
    # A CSS rule: selector { ... }
    CSS_RULE = re.compile(r"([^{}]+)\{([^{}]*)\}", re.S)
    ACTIVE_SEL = re.compile(r"\.(active|on|selected|copied|set)\b|:hover", re.I)
    GOLD_BG = re.compile(
        r"background\s*:[^;]*(?:#8a6c1a|var\(--accent\))", re.I
    )
    # Exempt very-faint rgba gold tints (opacity < 0.15 — hover hint, not a real fill)
    FAINT_RGBA = re.compile(r"rgba\(138,\s*108,\s*26,\s*0\.(0\d|1[0-4])\)", re.I)
    # Exempt small semantic dot selectors (.nu-dot, .fdot) — these use gold as a DATA color
    DOT_EXEMPT = re.compile(r"\.(nu-dot|fdot)\b", re.I)
    # We scope to CSS rules inside <style> blocks, so JS object literals are not matched.

    fails = []

    for html_path in sorted(pages_to_check):
        if not html_path.exists():
            continue
        text = html_path.read_text(encoding="utf-8", errors="replace")
        for style_match in STYLE_BLOCK.finditer(text):
            css = style_match.group(1)
            for rule in CSS_RULE.finditer(css):
                selector = rule.group(1).strip()
                body = rule.group(2)
                if DOT_EXEMPT.search(selector):
                    continue
                bg_match = GOLD_BG.search(body)
                if not bg_match:
                    continue
                if FAINT_RGBA.search(body):
                    continue
                if ACTIVE_SEL.search(selector):
                    rel = html_path.relative_to(TRAVEL_ROOT / "Travel-Website")
                    fails.append(
                        f"{rel} — selector '{selector.strip()}' uses gold (#8a6c1a / --accent) "
                        f"as background on an active/hover/on/selected state. "
                        f"Use terracotta #b85c2a or the gradient instead."
                    )

    # Also scan the shared external stylesheets — the loop above only reads
    # inline <style> blocks in HTML pages, so a solid gold active/hover fill
    # written directly into a shared CSS file (rather than a page's own
    # <style> block) was invisible to this gate. Added 2026-07-11
    # (enforcement-gap sweep; 0 files affected fleet-wide).
    css_files_to_check = [
        site_root / "assets" / "web-travel-style.css",
        site_root / "assets" / "guide-style.css",
        site_root / "assets" / "mobile.css",
        site_root / "assets" / "guides-index-style.css",
    ]
    for css_path in css_files_to_check:
        if not css_path.exists():
            continue
        css = css_path.read_text(encoding="utf-8", errors="replace")
        for rule in CSS_RULE.finditer(css):
            selector = rule.group(1).strip()
            body = rule.group(2)
            if DOT_EXEMPT.search(selector):
                continue
            bg_match = GOLD_BG.search(body)
            if not bg_match:
                continue
            if FAINT_RGBA.search(body):
                continue
            if ACTIVE_SEL.search(selector):
                fails.append(
                    f"assets/{css_path.name} — selector '{selector.strip()}' uses gold "
                    f"(#8a6c1a / --accent) as background on an active/hover/on/selected state. "
                    f"Use terracotta #b85c2a or the gradient instead."
                )

    for f in fails:
        report.fail(f"check_active_pill_color: {f}")
    if not fails:
        report.ok("Active pill color: no gold (#8a6c1a / --accent) backgrounds on active/hover states")


def check_pill_link_underline(report: "Report") -> None:
    """HARD-FAIL if any boxed pill / button-style link can render a text underline.

    Boxed links (Trip-Essentials source pills, "Also on this site" pills, jump-nav
    chips, filter buttons) convey their affordance with a border + colour, never an
    underline. The site-wide default `a:hover { text-decoration: underline }` in
    web-travel-style.css would otherwise leak an underline onto these anchors on hover
    (it did — the sibling-pill weather links underlined). The systemic fix is the
    shared neutralizer in web-travel-style.css; this check guards it two ways:

      1. The shared neutralizer must still list `.sibling-pill` and
         `.also-on-this-site-pill` (regression guard for the fix).
      2. No non-guide page — nor the shared sheets — may set
         `text-decoration: underline` on any boxed-link class. These links never
         underline in any state.

    Guides are exempt: guide-style.css has no global `a:hover` underline, so its
    per-class hover-underlines (review links, tour links) are intentional and safe.

    Added 2026-07-10 after the sibling-pill weather links (Weather25 / Weather
    Channel) rendered an underline on hover on Climate-Finder and When-to-Go.
    """
    import re

    site_root = TRAVEL_ROOT / "Travel-Website"
    shared_css = site_root / "assets" / "web-travel-style.css"

    fails = []

    # --- Guard 1: the shared neutralizer still covers the boxed-link classes ---
    if not shared_css.exists():
        report.fail("check_link_underline: assets/web-travel-style.css is missing")
        return
    shared_text = shared_css.read_text(encoding="utf-8", errors="replace")
    # The neutralizer rule sets text-decoration:none on the pill hover states.
    neutralizer = re.compile(
        r"\.sibling-pill:hover[^{}]*\{[^{}]*text-decoration:\s*none",
        re.S | re.I,
    )
    also_neutralizer = re.compile(
        r"\.also-on-this-site-pill:hover[^{}]*\{[^{}]*text-decoration:\s*none",
        re.S | re.I,
    )
    if not neutralizer.search(shared_text):
        fails.append(
            "web-travel-style.css — the pill-hover neutralizer no longer lists "
            "`.sibling-pill:hover { text-decoration:none }`; boxed weather/source links "
            "will underline on hover. Restore it in the shared '── Links ──' block."
        )
    if not also_neutralizer.search(shared_text):
        fails.append(
            "web-travel-style.css — the pill-hover neutralizer no longer lists "
            "`.also-on-this-site-pill:hover { text-decoration:none }`. Restore it."
        )

    # --- Guard 2: no boxed-link class may set text-decoration:underline anywhere ---
    BOXED_LINK = re.compile(
        r"\.(sibling-pill|also-on-this-site-pill|pill|filter-btn|disc-btn|"
        r"jump-btn|nav-link|stab|badge)\b|\.stats-nav\s+a\b",
        re.I,
    )
    UNDERLINE = re.compile(r"text-decoration(?:-line)?\s*:[^;{}]*underline", re.I)
    STYLE_BLOCK = re.compile(r"<style[^>]*>(.*?)</style>", re.S | re.I)
    CSS_RULE = re.compile(r"([^{}]+)\{([^{}]*)\}", re.S)

    pages = (
        list(site_root.glob("*.html"))
        + list((site_root / "Trip-Essentials").glob("*.html"))
        + list((site_root / "Trip-Essentials" / "Maps").glob("*.html"))
    )
    # Include the shared non-guide sheets themselves.
    css_sources = [site_root / "assets" / "web-travel-style.css",
                   site_root / "assets" / "mobile.css",
                   site_root / "assets" / "guides-index-style.css"]

    def scan(css_text, label):
        for rule in CSS_RULE.finditer(css_text):
            selector, body = rule.group(1).strip(), rule.group(2)
            if BOXED_LINK.search(selector) and UNDERLINE.search(body):
                fails.append(
                    f"{label} — selector '{selector[:70].strip()}' sets "
                    f"text-decoration:underline on a boxed pill/button link. "
                    f"Boxed links never underline — use border + colour instead."
                )

    for html_path in sorted(pages):
        if not html_path.exists():
            continue
        text = html_path.read_text(encoding="utf-8", errors="replace")
        rel = html_path.relative_to(site_root)
        for style_match in STYLE_BLOCK.finditer(text):
            scan(style_match.group(1), str(rel))
    for css_path in css_sources:
        if css_path.exists():
            scan(css_path.read_text(encoding="utf-8", errors="replace"),
                 f"assets/{css_path.name}")

    for f in fails:
        report.fail(f"check_pill_link_underline: {f}")
    if not fails:
        report.ok("Link underline: boxed pill/button links never underline (shared neutralizer intact)")


def check_pill_hover_behavior(report: "Report") -> None:
    """HARD-FAIL if any interactive element's :hover / .active / .on / .selected state
    uses a background or border color outside the two approved behaviors:

      Behavior 1 (link pills at rest + hover):
        background: #ffffff / var(--surface) at rest
        border-color: #b85c2a on :hover  (no fill change)

      Behavior 2 (active/selected chips):
        background: the terracotta gradient (linear-gradient(135deg,#7a3b1e …#b85c2a …#d4874a))
        border-color: #b85c2a

    This catches:
      - Any non-white, non-transparent, non-terracotta background on :hover
      - Beige fills (#f0ece3, #faf0dd, #fafaf8, #efe9e0, #faefd8, var(--surface2), rgba gold tints > 0.15)
      - Blue fills (rgba(37,99,235,*), #2563eb, #1d4ed8)
      - Green fills (#2a6a2a and family)
      - References to undefined CSS variables used as fills (--rust, --copper, --track when not defined
        in the same <style> block or shared CSS)
      - Non-terracotta border-color on hover (#c8b480, #d4b896, #c4bfb6, #c8961a)

    Approved exemptions (not flagged):
      - var(--banner-gradient) — alias for the terracotta gradient in guides-index
      - background: none / transparent / inherit on hover
      - border-color: var(--border) / var(--border2) on non-active states (rest border)
      - Leaflet .leaflet-bar controls — already fixed
      - .also-on-this-site-pill.active — uses terracotta gradient (approved)
      - .fchip.on — uses var(--banner-gradient) = terracotta gradient (approved)
      - .overview-extras .overview-extra-link:hover — extras-nav desktop chip,
        added 2026-07-12, uses the terracotta gradient (approved, same pattern
        as .also-on-this-site-pill)
      - Toolbar / navigation items — excluded (use --nav-* tokens)
      - rgba gold tints with opacity < 0.15 (faint hover hints, acceptable)
      - .section-label.amex — lounge page gold brand color (exempt by prior rule)
      - Pickleball bar fill — yellow by spec (exempt by check_pickleball_bar_color)

    Added 2026-07-07 after site-wide audit found 21 violations across 13 files.
    """
    import re

    site_root = TRAVEL_ROOT / "Travel-Website"
    pages_to_check = (
        list(site_root.glob("*.html"))
        + list((site_root / "Trip-Essentials").glob("*.html"))
        + list((site_root / "Trip-Essentials" / "Maps").glob("*.html"))
    )
    # Also scan shared CSS files. guides-index-style.css added 2026-07-11
    # (enforcement-gap sweep) — it powers .mchip/.tchip/.lchip/.stab/
    # .view-toggle button.on on Guides-Index.html and was unguarded by either
    # active-color check (0 guides affected; safe to add).
    css_files = [
        site_root / "assets" / "web-travel-style.css",
        site_root / "assets" / "guide-style.css",
        site_root / "assets" / "mobile.css",
        site_root / "assets" / "guides-index-style.css",
    ]

    STYLE_BLOCK = re.compile(r"<style[^>]*>(.*?)</style>", re.S | re.I)
    CSS_RULE = re.compile(r"([^{}]+)\{([^{}]*)\}", re.S)
    ACTIVE_SEL = re.compile(r"\.(active|on|selected|copied|set)\b|:hover", re.I)

    # Banned background values (fills that are not white, transparent, or the terracotta gradient)
    BANNED_BG = re.compile(
        r"background(?:-color)?\s*:\s*(?:"
        # beige/warm fills
        r"#f0ec[a-f0-9]{2}|#faf0dd|#fafaf8|#efe9e0|#faefd8|#fdf0d0"
        r"|var\(--surface2\)"
        r"|rgba\(184,\s*134,\s*11,\s*0\.(1[5-9]|[2-9]\d?)\)"  # gold tint >= 0.15
        # blue fills
        r"|rgba\(37,\s*99,\s*235"
        r"|#2563eb|#1d4ed8"
        # green fills
        r"|#2a6a2a|#1a5c1a|#22692[0-9a-f]"
        # solid gold fill — Colors and Font Size.html §11: gold is text/border
        # only, never a solid active/hover background (added 2026-07-11,
        # enforcement-gap sweep — check_active_pill_color only scanned inline
        # <style> blocks, never this shared CSS, so a solid gold fill here
        # would have been invisible to both active-color gates; 0 hits fleet-wide)
        r"|#8a6c1a|var\(--accent\)"
        # undefined variable fills (not in approved set)
        r"|var\(--rust\)|var\(--copper\)|var\(--track\)|var\(--hover\)"
        r")",
        re.I,
    )

    # Banned border-color values (non-terracotta on hover)
    BANNED_BORDER = re.compile(
        r"border(?:-color)?\s*:\s*(?:#c8b480|#d4b896|#c4bfb6|#c8961a|#c8b[0-9a-f]{3})",
        re.I,
    )

    # Exempt selectors
    EXEMPT_SEL = re.compile(
        r"\.(amex|nu-dot|fdot|leaflet-bar|nav-link|toolbar|also-on-this-site-pill|fchip|banner-gradient|pkl-bar|overview-extra-link)\b"
        r"|#toolbar|\.toolbar",
        re.I,
    )

    fails = []

    def scan_css(css_text: str, source_label: str) -> None:
        for rule in CSS_RULE.finditer(css_text):
            selector = rule.group(1).strip()
            body = rule.group(2)
            if EXEMPT_SEL.search(selector):
                continue
            if not ACTIVE_SEL.search(selector):
                continue
            if BANNED_BG.search(body):
                m = BANNED_BG.search(body)
                fails.append(
                    f"{source_label} — '{selector}' has a banned background fill on "
                    f"hover/active/selected state: {m.group(0).strip()!r}. "
                    f"Use white (#fff/var(--surface)) or the terracotta gradient."
                )
            if BANNED_BORDER.search(body):
                m = BANNED_BORDER.search(body)
                fails.append(
                    f"{source_label} — '{selector}' has a non-terracotta border on "
                    f"hover/active/selected state: {m.group(0).strip()!r}. "
                    f"Use border-color: #b85c2a."
                )

    for css_path in css_files:
        if css_path.exists():
            scan_css(css_path.read_text(encoding="utf-8", errors="replace"),
                     str(css_path.relative_to(TRAVEL_ROOT / "Travel-Website")))

    for html_path in sorted(pages_to_check):
        if not html_path.exists():
            continue
        text = html_path.read_text(encoding="utf-8", errors="replace")
        for style_match in STYLE_BLOCK.finditer(text):
            scan_css(style_match.group(1),
                     str(html_path.relative_to(TRAVEL_ROOT / "Travel-Website")))

    for f in fails:
        report.fail(f"check_pill_hover_behavior: {f}")
    if not fails:
        report.ok("Pill hover behavior: all interactive hover/active states use approved white+terracotta pattern")


def check_trusted_traveler_integrity(report: "Report") -> None:
    """Fail if Trusted-Traveler.html is missing structural invariants.

    Five hard gates (Cleanliness Checks.md check #130, added 2026-07-07):
      (a) File exists.
      (b) All 5 filter pill data-filter values present: all, both, ge, clear, eoa.
      (c) Every .apt-row has data-ge, data-clear, data-eoa each = "0" or "1".
      (d) Both program explanation badges exist (.badge-ge and .badge-clear inside .program-card).
      (e) id="intl-section" block present.
    """
    tt_path = TRAVEL_ROOT / "Travel-Website" / "Trip-Essentials" / "Trusted-Traveler.html"
    if not tt_path.exists():
        report.fail("check_trusted_traveler_integrity: Trusted-Traveler.html not found")
        return

    text = tt_path.read_text(encoding="utf-8")
    fails = []

    # (b) Required filter pill data-filter values
    REQUIRED_FILTERS = {"all", "both", "ge", "clear", "eoa"}
    found_filters = set(re.findall(r'data-filter="([^"]+)"', text))
    missing = REQUIRED_FILTERS - found_filters
    if missing:
        fails.append(
            f"Trusted-Traveler.html: missing filter pill(s) with data-filter values: "
            f"{sorted(missing)} — all 5 required (all/both/ge/clear/eoa)"
        )

    # (c) Every .apt-row inside #airport-list must have data-ge, data-clear, data-eoa each = "0"/"1"
    # Scope to #airport-list only — intl-section rows are static and don't participate in filtering.
    airport_list_m = re.search(r'id="airport-list"[^>]*>(.*?)</div>\s*<!--\s*/airport-list', text, re.S)
    if not airport_list_m:
        # Fallback: grab everything between the id and the intl-section
        airport_list_m = re.search(r'id="airport-list">(.*?)id="intl-section"', text, re.S)
    airport_list_text = airport_list_m.group(1) if airport_list_m else text

    apt_rows = re.findall(r'<div[^>]+class="apt-row"[^>]*>', airport_list_text)
    VALID_DATA_ATTR = re.compile(r'data-(ge|clear|eoa)="([^"]*)"')
    for i, row_tag in enumerate(apt_rows, 1):
        attrs_found = {m.group(1): m.group(2) for m in VALID_DATA_ATTR.finditer(row_tag)}
        for attr in ("ge", "clear", "eoa"):
            if attr not in attrs_found:
                fails.append(
                    f"Trusted-Traveler.html: apt-row #{i} (in #airport-list) missing data-{attr} attribute — "
                    "every filterable airport row must declare all three data flags (0 or 1)"
                )
            elif attrs_found[attr] not in ("0", "1"):
                fails.append(
                    f"Trusted-Traveler.html: apt-row #{i} (in #airport-list) data-{attr}=\"{attrs_found[attr]}\" "
                    "is not 0 or 1 — only binary values allowed"
                )

    # (d) Both program explanation cards present — check for the card head names
    if 'Global Entry' not in text:
        fails.append(
            "Trusted-Traveler.html: 'Global Entry' not found — Global Entry program card must be present"
        )
    if '>CLEAR<' not in text and '"CLEAR"' not in text and 'program-name">CLEAR' not in text:
        # broader check: the word CLEAR appears many times, but the program card heading must be there
        if text.count('program-name') < 2:
            fails.append(
                "Trusted-Traveler.html: CLEAR program card (.program-name) missing"
            )
    # Check badge classes are present in the airport rows
    if 'class="badge badge-ge"' not in text and 'badge-ge' not in text:
        fails.append(
            "Trusted-Traveler.html: .badge-ge not found — Global Entry airport badges must be present"
        )
    if 'class="badge badge-clear"' not in text and 'badge-clear' not in text:
        fails.append(
            "Trusted-Traveler.html: .badge-clear not found — CLEAR airport badges must be present"
        )

    # (e) International preclearance section
    if 'id="intl-section"' not in text:
        fails.append(
            "Trusted-Traveler.html: id=\"intl-section\" not found — "
            "international preclearance section must be present"
        )

    for f in fails:
        report.fail(f"check_trusted_traveler_integrity: {f}")

    if not fails:
        n_rows = len(apt_rows)
        report.ok(
            f"Trusted-Traveler.html integrity: {n_rows} apt-rows all have required data attrs; "
            "filter pills complete; program cards present; intl section present"
        )


def check_link_underline(report: "Report") -> None:
    """Fail if any <a> tag has an inline style with text-decoration:underline.

    Links site-wide must never carry a hardcoded underline — web-travel-style.css
    and guide-style.css both set a { text-decoration: none }. An inline
    text-decoration:underline on an <a> overrides that and is always drift.
    Hover states (:hover in <style> blocks) are intentional and excluded.
    Only inline style= attributes on <a> tags are checked here.
    (added 2026-07-09)
    """
    import re as _re
    site_root = TRAVEL_ROOT / "Travel-Website"
    html_files = list(site_root.rglob("*.html"))
    _a_inline_re = _re.compile(
        r'<a\b[^>]*\bstyle=["\'][^"\']*text-decoration\s*:\s*underline',
        _re.IGNORECASE,
    )
    hits = []
    for p in sorted(html_files):
        try:
            body = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for m in _a_inline_re.finditer(body):
            rel = p.relative_to(TRAVEL_ROOT)
            hits.append(str(rel))
            break  # one hit per file is enough
    if hits:
        for h in hits:
            report.fail(f"check_link_underline: <a> with inline text-decoration:underline in {h}")


def _walk_balanced_div_bc(text: str, start: int) -> str:
    """Return the inner content of a <div> opening at `start` (position right
    after the opening tag's '>'), handling nested divs. Local to brain_check —
    mirrors validate_itinerary.py's _walk_balanced_div (kept independent since
    the two scripts don't share a module)."""
    depth = 1
    j = start
    div_open_re = re.compile(r'<div\b')
    while j < len(text) and depth > 0:
        nxt_open_m = div_open_re.search(text, j)
        nxt_open = nxt_open_m.start() if nxt_open_m else -1
        nxt_close = text.find('</div>', j)
        if nxt_close == -1:
            return text[start:]
        if nxt_open != -1 and nxt_open < nxt_close:
            depth += 1
            j = nxt_open + 4
        else:
            depth -= 1
            if depth == 0:
                return text[start:nxt_close]
            j = nxt_close + 6
    return text[start:j]


def check_story_pages(report: "Report") -> None:
    """Validate any {city}-read-about.html companion pages found in Travel-Website/Guides/.

    Each story page must:
    - Load web-travel-style.css (not guide-style.css)
    - Load mobile.css (mandatory mobile baseline, per Read-About-Pages.html §3)
    - Have a .page-header element
    - Have an h1 inside .page-header
    - Have a .story-back link inside .page-header
    - Have a .story-deck element
    - Have a .story-body element, prose-only (no stop/ticket/tour/photo markup
      or itinerary icon glyphs — per §8)
    - Have a .story-footer element containing a .story-footer-back link (§5)
    - <title> tag starts with "Read About " (§8)
    - Toolbar-mount must NOT carry data-updated, data-prev, or data-next (§4)
    Plus one whole-fleet check: the shared assets/Read-About.css carries the
    §8 h2 (uppercase/terracotta/14px) and .pullquote (italic/terracotta
    left-border) styling every page depends on.
    (added 2026-07-09; extended 2026-07-11 — enforcement-gap sweep closed 6
    partial/unenforced gaps: mobile.css, data-prev/data-next, title format,
    prose-only body, h2/pullquote CSS, footer-back presence)
    """
    import re as _re
    guides_root = TRAVEL_ROOT / "Travel-Website" / "Guides"
    _story_re = _re.compile(r'^.+-read-about\.html$')
    story_files = [
        p for p in guides_root.rglob("*.html")
        if _story_re.match(p.name)
    ]
    if not story_files:
        return  # no story pages yet — nothing to check

    # Shared stylesheet check — Read-About.css carries the h2/pullquote rules
    # every page's .story-body h2 / .pullquote depend on (extracted out of
    # per-page inline <style> blocks; checked once, not per-page).
    _css_path = TRAVEL_ROOT / "Travel-Website" / "assets" / "Read-About.css"
    if not _css_path.exists():
        report.fail("check_story_pages: Travel-Website/assets/Read-About.css is missing — "
                    "every Read About page loads it for .story-body h2 / .pullquote styling")
    else:
        _css_text = _css_path.read_text(encoding="utf-8", errors="ignore")
        _h2_m = _re.search(r'\.story-body\s+h2\s*\{([^}]*)\}', _css_text, _re.DOTALL)
        if not _h2_m:
            report.fail("check_story_pages: Read-About.css missing a .story-body h2 rule "
                        "(§8: section headings are uppercase, terracotta, 14px)")
        else:
            _h2_rule = _h2_m.group(1)
            if not _re.search(r'text-transform\s*:\s*uppercase', _h2_rule, _re.IGNORECASE):
                report.fail("check_story_pages: Read-About.css .story-body h2 missing text-transform:uppercase (§8)")
            if not _re.search(r'font-size\s*:\s*14px', _h2_rule, _re.IGNORECASE):
                report.fail("check_story_pages: Read-About.css .story-body h2 missing font-size:14px (§8)")
            if not _re.search(r'color\s*:\s*#b85c2a', _h2_rule, _re.IGNORECASE):
                report.fail("check_story_pages: Read-About.css .story-body h2 missing terracotta color #b85c2a (§8)")
        _pq_m = _re.search(r'\.story-body\s+\.pullquote\s*\{([^}]*)\}', _css_text, _re.DOTALL)
        if not _pq_m:
            report.fail("check_story_pages: Read-About.css missing a .story-body .pullquote rule "
                        "(§8: pull-quotes are italicized, left-bordered in terracotta)")
        else:
            _pq_rule = _pq_m.group(1)
            if not _re.search(r'font-style\s*:\s*italic', _pq_rule, _re.IGNORECASE):
                report.fail("check_story_pages: Read-About.css .pullquote missing font-style:italic (§8)")
            if not _re.search(r'border-left\s*:[^;]*#d4874a', _pq_rule, _re.IGNORECASE):
                report.fail("check_story_pages: Read-About.css .pullquote missing terracotta border-left #d4874a (§8)")

    # Forbidden guide-content markers inside .story-body (§8: "prose only —
    # no stop boxes, no ticket rows, no tour entries, no icon rows").
    _STORY_BODY_FORBIDDEN_CLASSES = ('stop-block', 'ticket-box', 'tour-box',
                                      'stop-photos', 'day-block', 'extras-section')
    _ITINERARY_ICON_RE = _re.compile(r'[🎟📅⏳🕐🚶🚕📍🏛⏰🆓💵🚫🚎🚝🚢👥]')

    for p in sorted(story_files):
        try:
            body = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        rel = str(p.relative_to(TRAVEL_ROOT))
        # Must load web-travel-style.css
        if "web-travel-style.css" not in body:
            report.fail(f"check_story_pages: {rel} must load web-travel-style.css (not guide-style.css)")
        # Must NOT load guide-style.css
        if "guide-style.css" in body:
            report.fail(f"check_story_pages: {rel} must not load guide-style.css — use web-travel-style.css")
        # Must load mobile.css (mandatory mobile baseline, §3)
        if "mobile.css" not in body:
            report.fail(f"check_story_pages: {rel} must load mobile.css (mandatory mobile baseline, §3)")
        # Toolbar-mount must not carry data-updated / data-prev / data-next
        _tm_m = _re.search(r'<div\b[^>]*id=["\']toolbar-mount["\'][^>]*>', body, _re.IGNORECASE)
        if _tm_m:
            _tm_tag = _tm_m.group(0)
            if _re.search(r'\bdata-updated\b', _tm_tag, _re.IGNORECASE):
                report.fail(f"check_story_pages: {rel} toolbar-mount must not carry data-updated (§4)")
            if _re.search(r'\bdata-prev\b', _tm_tag, _re.IGNORECASE):
                report.fail(f"check_story_pages: {rel} toolbar-mount must not carry data-prev — "
                            f"Read About pages are not part of the guide prev/next chain (§4)")
            if _re.search(r'\bdata-next\b', _tm_tag, _re.IGNORECASE):
                report.fail(f"check_story_pages: {rel} toolbar-mount must not carry data-next — "
                            f"Read About pages are not part of the guide prev/next chain (§4)")
        # <title> tag must start with "Read About " (§8)
        if not _re.search(r'<title>\s*Read About\s', body, _re.IGNORECASE):
            report.fail(f"check_story_pages: {rel} <title> must be \"Read About {{City}}\" (§8)")
        # Required structural elements
        if 'class="page-header"' not in body and "class='page-header'" not in body:
            report.fail(f"check_story_pages: {rel} missing .page-header element")
        else:
            # h1 and .story-back must be inside .page-header
            _ph_re = _re.compile(r'class=["\']page-header["\'][^>]*>(.*?)</div>', _re.DOTALL | _re.IGNORECASE)
            ph_m = _ph_re.search(body)
            if ph_m:
                ph_content = ph_m.group(1)
                if '<h1' not in ph_content:
                    report.fail(f"check_story_pages: {rel} .page-header must contain an h1")
                if 'story-back' not in ph_content:
                    report.fail(f"check_story_pages: {rel} .page-header must contain a .story-back link")
        if 'class="story-deck"' not in body and "class='story-deck'" not in body:
            report.fail(f"check_story_pages: {rel} missing .story-deck element")
        _sb_m = _re.search(r'class=["\']story-body["\'][^>]*>', body, _re.IGNORECASE)
        if not _sb_m:
            report.fail(f"check_story_pages: {rel} missing .story-body element")
        else:
            _sb_inner = _walk_balanced_div_bc(body, _sb_m.end())
            _sb_bad_classes = [c for c in _STORY_BODY_FORBIDDEN_CLASSES
                                if f'class="{c}"' in _sb_inner or f"class='{c}'" in _sb_inner]
            if _sb_bad_classes:
                report.fail(f"check_story_pages: {rel} .story-body contains guide markup "
                            f"{_sb_bad_classes} — prose only, no stop boxes/ticket rows/tour "
                            f"entries (§8)")
            _sb_icons = sorted(set(_ITINERARY_ICON_RE.findall(_sb_inner)))
            if _sb_icons:
                report.fail(f"check_story_pages: {rel} .story-body contains itinerary icon "
                            f"glyph(s) {_sb_icons} — prose only, no icon rows (§8)")
        _sf_m = _re.search(r'class=["\']story-footer["\'][^>]*>', body, _re.IGNORECASE)
        if not _sf_m:
            report.fail(f"check_story_pages: {rel} missing .story-footer element")
        else:
            _sf_inner = _walk_balanced_div_bc(body, _sf_m.end())
            if 'story-footer-back' not in _sf_inner:
                report.fail(f"check_story_pages: {rel} .story-footer must contain a "
                            f".story-footer-back link (§5)")


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
    check_guide_filenames(report)                   # fails on guides not named {city_slug}_vN.html — generic guide_vN.html / space-named twins (added 2026-06-26)
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
    check_toolbar_in_main_pages(report)             # warns on toolbar page missing from Website-Main-Pages-Links.html = toolbar↔hub parity drift (added 2026-06-21)
    check_main_pages_internal_links(report)         # warns on broken relative .html links across Trip-Essentials + site-root hub pages = cross-page link rot (added 2026-06-21)
    check_toolbar_page_standard(report)             # fails if a toolbar tab lacks shared nav / canonical #f5f4f0 bg / mobile baseline — new tabs must match the bar (added 2026-06-14)
    check_banner_title_size(report)                 # fails if any title banner h1 isn't the canonical 14px — all banners must match (added 2026-06-15)
    check_banner_content(report)                    # fails if a title banner contains anything other than <h1> + optional <button> — no spans, date stamps, or metadata inside the banner (added 2026-06-15)
    check_banner_h1_text_only(report)               # fails if a title banner h1 carries an emoji/glyph — h1 is text-only; emoji belongs in the toolbar label/subtitle (added 2026-06-21)
    check_page_margins(report)                      # fails on body horizontal padding or a non-standard .wrap padding override — page gutters must be the shared 32/14 (added 2026-06-21)
    check_inline_base_reset(report)                 # fails on inline *, :root, or body {} in any shareable page — base resets belong only in web-travel-style.css (SHARED CSS ONLY rule; added 2026-07-10)
    check_stats_page_css_var_scoping(report)        # fails if a stats page defines --rust/--navy/--track etc. under :root instead of body.stats-page (Stats-Pages-Format.html §5/§8; added 2026-07-11)
    check_toolbar_version_parity(report)            # warns on stale or missing toolbar.js ?v= cache-bust version — all pages should load the same version (added 2026-07-10)
    check_page_filename_spaces(report)              # fails on a space in a Trip-Essentials page filename — the recurring stray-duplicate signature; archive it (added 2026-06-21)
    check_internal_link_space_encoding(report)      # HARD-fails any internal guide/page link with a raw space in the path — folders may have spaces, links must %20-encode (added 2026-06-27)
    check_section_citation_targets(report)          # warns on `{File}.html § N` citations whose target heading no longer exists (added 2026-06-06)
    check_profile_watermark(report)                     # warns on unexplained CLAUDE.md line/section drops (Rule 49; added 2026-06-11)
    check_pdf_gradient_sync(report)                     # warns if Guide Style.css title-page gradient diverges from PDF Render Notes.md (added 2026-06-11)
    check_guides_index_banner_subtitle(report)          # fails if Guides-Index.html banner has a subtitle element (added 2026-06-12)
    check_search_bar_standard(report)                   # fails if any search input has placeholder words, pill shape, fixed width, or width animation (added 2026-06-13)
    check_index_stat_row(report)                        # fails if guides_index stat row drifts from § 15 — places left, countries right, small grey text (added 2026-06-14)
    check_guides_index_topbar_layout(report)            # fails if #status-toggle position or #search-wrap centering drifts from the locked topbar layout (Navigation.html § 8; added 2026-07-11)
    check_emoji_library_no_retired_section(report)     # fails if a 'retired' subsection appears in Emoji Library — only 'in use, with location' and 'available' are valid states (added 2026-06-15)
    check_cascade_sync(report)                          # warns when a source file is newer than a file that depends on it — catches out-of-sync reference docs (added 2026-06-15)
    check_status_dots_stalled_builds(report)            # fails if a city listed as stalled in Status Dots has shipped HTML — catches guides that shipped without updating Status Dots (added 2026-06-15)
    check_updated_stamps_stale(report)                  # warns when an 'Updated <Month> <Year>' content stamp is older than 6 months (added 2026-06-15)
    check_updated_stamp_format(report)                  # fails if stamp uses wrong tag (<div> instead of <span>), wrong placement (not immediately after .page-header), or inline styles (added 2026-07-09)
    check_pickleball_bar_color(report)                  # fails if Pickleball.html bar-fill classes are not the locked yellow gradient (added 2026-06-22)
    check_world_map_colors(report)                      # fails if World-Map.html region-nav dot palette or pin marker colors drift from Maps-Layout.html §5/§6 (added 2026-07-11)
    check_world_map_no_cdn(report)                      # fails if World-Map.html loads a map vendor/tile-server/script from an external CDN instead of self-hosted (Maps-Layout.html §2/§10; added 2026-07-11)
    check_toolbar_group_icon_consistency(report)        # fails if any toolbar dropdown group (except Flights/Safety) has children with mixed icons — all must match group icon (added 2026-07-12)
    check_also_on_site_pill_labels(report)              # fails if any guide pill uses a non-canonical icon or label — locks icon+name against crib drift (added 2026-06-24)
    check_guide_header_css_standard(report)             # fails if guide-style.css header block drifts from locked standard — font sizes, weights, order, gap (added 2026-06-26)
    check_best_of_css_standard(report)                  # fails if any Best-of page CSS drifts from locked spec — section labels, card, name, tag, meta (added 2026-07-04)
    check_best_of_country_order(report)                 # fails if country sections not A→Z OR filter dropdown hardcoded instead of dynamic (added 2026-07-07)
    check_best_of_sidebar_coverage(report)              # HARD-FAIL if any Best-*.html in Trip-Essentials/ has no sidebar card in Guides-Index.html (added 2026-07-09)
    check_guide_filename_hyphenation(report)            # HARD-FAIL if guide filename city-name part doesn't match folder (with hyphens) — added 2026-07-05
    check_stats_city_name_bold(report)                  # fails if any stats page is missing font-weight on its city/country name column (added 2026-07-06)
    check_pill_rest_state(report)                       # fails if any pill rest-state CSS drifts from section 17 standard (exact 6px radius, 13px font, 6px 12px padding, warm bg); .tier-pill exempt as a semantic badge (added 2026-07-10, promoted to hard-fail + exact match 2026-07-11)
    check_mobile_design_system(report)                  # HARD-FAILS if the shared mobile CSS design system (mobile.css + guides-index-style.css) loses a locked invariant — no-overflow guards, banner 14px, Form A pill, Form B glued tiles, 48px search (added 2026-07-11)
    check_stop_row_rhythm(report)                       # HARD-FAILS if guide-style.css loses the stop-block vertical rhythm — ↳ row 6px, wiki row 4px/8px, box rows 6px, box→photo 8px, end-of-day banner 12px (added 2026-07-12)
    check_active_pill_color(report)                     # fails if any page uses gold (#8a6c1a / --accent) as background on active/hover/on/selected states — terracotta only (added 2026-07-07)
    check_pill_hover_behavior(report)                   # fails if any pill/button :hover or .active/.on/.selected state uses a non-approved background or border (added 2026-07-07)
    check_pill_link_underline(report)                   # fails if any boxed pill/button link can render a text underline (shared neutralizer intact; no boxed-link class sets underline) (added 2026-07-10)
    check_trusted_traveler_integrity(report)            # fails if Trusted-Traveler.html is missing required filter pills, apt-row data attributes, program cards, or intl section (added 2026-07-07)
    check_link_underline(report)                        # fails if any <a> tag carries an inline text-decoration:underline (non-hover) — links must never have hardcoded underlines (added 2026-07-09)
    check_story_pages(report)                           # fails if any {city}-read-about.html companion page is missing required structure or uses wrong stylesheet (added 2026-07-09)
    check_css_duplication_summary(report)               # warns if check_css_duplication.py finds >10 duplicated selectors — SHARED CSS ONLY rule (added 2026-07-10)
    check_no_hardcoded_hex_colors(report)               # warns if a shareable page hardcodes a hex color matching a shared CSS variable (added 2026-07-11)

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
