#!/usr/bin/env python3
"""
CORE RULES enforcer — checks every .html in Brain/CORE RULES/ against the
Universal Formatting Rules.

Single source of truth for the rules:
    Brain/Reference/Core Rules Formatting.html
The canonical CSS lives at:
    Brain/Reference/Core Rules Style.css
Every CORE RULES HTML must link that file (E1). When the external stylesheet
changes, E1 will catch any file that still uses a stale link.

Scope: ONLY the .html files in the target folder. Not a guide validator. Does
not import from Brain/ or read anything outside CORE RULES/. Safe to delete at
any time.

Default folder: Brain/CORE RULES/ (parent.parent of this script / "CORE RULES").
Override with --folder if running from a different location or via symlink.

Usage (from anywhere):
    python3 "doc_workshop_validator.py"                    # check every .html in Brain/CORE RULES/
    python3 "doc_workshop_validator.py" Tour\ Rules.html   # check one file
    python3 "doc_workshop_validator.py" --quiet            # only show files with violations
    python3 "doc_workshop_validator.py" --warn-only        # downgrade ERRORs to warnings
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import html.parser
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path


# ──────────────────────────────────────────────────────────────────────────
# Canonical external stylesheet path (E1). When the UFR canonical changes,
# update this constant and re-run.
# ──────────────────────────────────────────────────────────────────────────

CANONICAL_CSS_HREF = "../Reference/Core Rules Style.css"

# The canonical banner class.
# Files must use <p class="banner"> — NOT <p class="footer"> with inline style.
# Banner text is keyword-checked: must contain "read-only" and "edited by request" (W3).
# Every file must have a banner at both top and bottom of <body> (E17).

# Legacy class names that are explicitly forbidden — replaced by the current
# canonical structure. (.meta is NOT legacy; it's the canonical meta block.)
#
# NOTE: "title" is intentionally included. These files are a controlled set
# where a plain class="title" element is always a legacy artefact. If a new
# rule doc legitimately needs class="title" for a different purpose, add it to
# FORMAT_EXCEPTION_FILES rather than removing "title" from this list.
LEGACY_CLASSES = ("titlebar", "title", "locked", "read-only-notice")

# ──────────────────────────────────────────────────────────────────────────
# Format-exception files — Claude reference files, not guide-builder rule docs.
# These use curly-brace notation ({like this}) as intentional technical notation,
# <em> for illustrative phrases, and may contain JSON/URL/HTML examples that
# standard checks would flag as violations. Checks that do not apply to these
# files gate themselves with: if path.name not in FORMAT_EXCEPTION_FILES
# These files are also automatically exempt from the E14 domain check.
# Documented in Rules for Claude.html § 12.
# ──────────────────────────────────────────────────────────────────────────
FORMAT_EXCEPTION_FILES = frozenset({
    "Links.html",
    "Photos Rules.html",
    "Rules for Claude.html",
    "Toolbar.html",
    "Guide Structure.html",
    "Claude Inspiration - Extra Section.html",  # §2 reference prose fired E15 false positive (2026-06-06)
})

# ──────────────────────────────────────────────────────────────────────────
# Module-level constants used by check_file() — defined once, not per call.
# ──────────────────────────────────────────────────────────────────────────

# W1 — sanctioned inline <style> pairs and selectors
_W1_FULL_CSS_FILES = frozenset({"Icon Order and Format.html"})
# NOTE: pairs are matched against the exact selector string produced by parse_css()
# (after stripping whitespace and splitting on commas). Selector variations such as
# "li:last-child" do NOT match ("li", "margin-bottom"). Add explicit pairs here
# if a sanctioned override uses a more specific selector.
_W1_ALLOWED_PAIRS = frozenset({
    ("code", "font-size"),
    (".entry", "background"),
    ("li", "margin-bottom"),
})
_W1_ALLOWED_SELECTORS = frozenset({".retired-notice"})

# W4 — files exempt from the h1-must-start-with-emoji rule.
# Claude Inspiration - Extra Section.html: icon/title/color are chosen by Claude
# at guide-build time, not fixed at rule time, so the h1 has no emoji at rest.
# Stops Structure.html: title icons (🚩 / 🚊) removed by request 2026-06-16 — plain title.
_W4_EXEMPT: frozenset[str] = frozenset({
    "Claude Inspiration - Extra Section.html",
    "Stops Structure.html",
})

# E11 — canonical selectors that must never have display:none applied
# Also used for compound-selector decomposition via _E11_CSS_COMBINATOR.
_E11_CANONICAL_SELECTORS = frozenset({
    "p.banner", "h1", "h2", "h3", "h4", "p", "ul", "ol", "li", ".banner", ".template",
})
_E11_CSS_COMBINATOR = re.compile(r"[\s>+~]+")

# E11b — multi-line-safe inline-style hiding check (Vector B).
# Extracts every opening p/h1–h6/div tag (re.DOTALL handles multi-line attributes),
# then inspects each tag string separately with class and style sub-patterns that
# accept both double- and single-quoted attribute values.
# Known limitation: [^>]*? stops at the first literal '>' character, so a tag whose
# attribute value contains '>' (technically valid but rare/invalid in practice) may
# be cut short and miss the class/style check. Acceptable for this controlled file set.
_E11B_TAG_RE = re.compile(r'<(?:p|h[1-6]|div)\b[^>]*?>', re.IGNORECASE | re.DOTALL)
_E11B_CLASS_RE = re.compile(
    r'''\bclass\s*=\s*(?:"[^"]*\b(?:banner|meta|template)\b[^"]*"|'[^']*\b(?:banner|meta|template)\b[^']*')''',
    re.IGNORECASE,
)
_E11B_STYLE_RE = re.compile(
    r'''\bstyle\s*=\s*(?:"[^"]*display\s*:\s*none[^"]*"|'[^']*display\s*:\s*none[^']*')''',
    re.IGNORECASE,
)

# E14 — domain-exempt files (all lowercase; compared with path.name.lower()).
# Automatically covers every FORMAT_EXCEPTION_FILES entry (which may reference
# real domains as technical examples) so the two sets never drift apart.
_DOMAIN_EXEMPT_FILES: frozenset[str] = frozenset(n.lower() for n in FORMAT_EXCEPTION_FILES)

# E14 — domain detection patterns (compiled once, reused across all files)
_E14_DOMAIN_PAT = re.compile(
    r'(?<![{/\w.-])([a-z0-9][a-z0-9\-]{1,60}'
    r'\.(?:com|org|net|fr|pt|es|it|de|uk|nl|be|ch|at|io|co|gov|edu'
    r'|eu|app|dev|au|ca|se|no|dk|fi|us))'
    r'(?![}\w-])',
    re.IGNORECASE,
)
# NOTE: the TLD list covers common western TLDs adequate for European travel docs.
# Extend if rule docs ever reference domains under other ccTLDs (.me, .travel, etc.).
_E14_DOMAIN_PLACEHOLDER = re.compile(
    r'\{[^}]*\}'                   # {placeholder}
    r'|site:[a-z0-9.\-]+'          # site:viator.com search operators
    r'|show-or-venue-site\.com'
    r'|example\.com'
    r'|venue-site\.com'
    r'|venue-url',
    re.IGNORECASE,
)

# E12 — personal-name check patterns (compiled once, reused across all files)
# Only the two canonical section-label patterns are exempt by design; add here
# if new legitimate section headers containing the name emerge.
_E12_EXEMPT_PAT = re.compile(
    r'Questions for Dani'    # section label
    r'|My Tasks[^.]*?Dani',  # section label (allow for parenthetical before name)
    re.I | re.DOTALL,
)
_E12_NAME_RE = re.compile(r'\bDani\b')

# E13 — dated attribution pattern (compiled once).
# Only the two canonical forms are caught by design; add patterns here if other
# forms (e.g. parenthetical dates) need to be prohibited.
_E13_ATTR_RE = re.compile(
    r'(?:Per Dani|(?:—|–|--)\s*Dani)\s+\d{4}-\d{2}-\d{2}',
    re.I,
)

# E15 — banned-word patterns (compiled once, reused across all files)
_E15_LINKS_FILENAME_RE = re.compile(r'\bLinks?\.html\b', re.IGNORECASE)
_E15_MAP_FILENAME_RE   = re.compile(r'\b\w[\w ]*?Map\.html\b', re.IGNORECASE)
_E15_WORD_RE           = re.compile(r'>([^<]*\b(?:Maps?|Links?)\b[^<]*)<', re.IGNORECASE)

# W9 — redundant prose patterns, pre-compiled for performance (re.I included)
_REDUNDANT_PROSE_PATTERNS = tuple(re.compile(p, re.I) for p in (
    # Original catches
    r'ships as its own entry',
    r'each\s+\S+\s+ships\s+as',
    r'each\s+entry\s+carries',
    r'the\s+entry\s+carries',
    r'appears\s+on\s+every\s+entry\s+without\s+exception',
    r'followed\s+by\s+the\s+(?:cuisine|description|map|address)',
    # Heading / row narration
    r'is\s+the\s+(?:heading|sub-?heading)',
    r'is\s+the\s+first\s+row',
    r'immediately\s+below\s+the\s+(?:\w+\s+)?title',
    # Entry structure narration
    r'ships\s+as\s+one\s+(?:guided\s+)?stop',
    r'inside\s+the\s+same\s+colored\s+entry',
    r'outside\s+the\s+entry',
    r'one\s+heading\s+and\s+box\s+pair',
    # Link / element narration
    r'the\s+only\s+clickable\s+element',
    r'carries\s+the\s+same\s+visual\s+shape',
    # Row/box content narration
    r'the\s+box\s+(?:shows|contains|lists|carries|displays)',
    r'is\s+followed\s+by\s+(?:its|the)\s+(?:closure|booking|description|rating|address)',
))


# ──────────────────────────────────────────────────────────────────────────
# General-purpose helpers — compiled once, reused across all checks and files.
# ──────────────────────────────────────────────────────────────────────────

# Whitespace normalisation (collapse any run of whitespace to a single space).
# Used when building short diagnostic snippets in E9, E12, W9, and elsewhere.
_WHITESPACE_RE = re.compile(r'\s+')

# HTML stripping — removes element content or markup from raw HTML strings.
# These four are the canonical strippers; every check that needs to work on
# "rendered" text should use them rather than re-compiling inline.
_STRIP_SCRIPT_RE  = re.compile(r'<script[^>]*>.*?</script>', re.DOTALL | re.IGNORECASE)
_STRIP_STYLE_RE   = re.compile(r'<style[^>]*>.*?</style>',  re.DOTALL | re.IGNORECASE)
_STRIP_COMMENT_RE = re.compile(r'<!--.*?-->',                re.DOTALL)
_STRIP_TAGS_RE    = re.compile(r'<[^>]+>')

# CSS helpers — used inside parse_css()
_CSS_COMMENT_RE   = re.compile(r'/\*.*?\*/', re.S)
_CSS_IMPORTANT_RE = re.compile(r'\s*!important\s*$', re.I)

# E9 — motion-emoji followed by tilde (hard fail)
_E9_TILDE_RE = re.compile(r'(?:🚶|🚕|🚌)\s*~\s*\d')

# E10 — currency symbol adjacent to a digit
_E10_CURRENCY_RE = re.compile(r'([\$€£¥₩₹₽฿])\s*\d|\d+\s*([\$€£¥₩₹₽฿])')

# W7 / _scan_version_meta helpers
_VM_BODY_RE    = re.compile(r'<body\b', re.IGNORECASE)
_VM_VERSION_RE = re.compile(r'\bv\d+\s*·\s*\d{4}-\d{2}-\d{2}')

# E0a — DOCTYPE check (anchored at start; U+FEFF / \ufeff matches UTF-8 BOM bytes that
# appear in the decoded string when the file was opened with encoding="utf-8"
# rather than "utf-8-sig").
_DOCTYPE_RE = re.compile(r'[\s\ufeff]*<!doctype\s+html', re.IGNORECASE)

# ──────────────────────────────────────────────────────────────────────────
# CSS parsing — used only for E11 (display:none in inline style blocks)
# ──────────────────────────────────────────────────────────────────────────

def parse_css(css: str) -> dict[str, dict[str, str]]:
    """Parse flat CSS into {selector: {prop: value}}. Tolerant of whitespace.
    Strips /* ... */ comments. Does NOT handle @media or nested rules — the
    canonical CSS is flat by design."""
    css = _CSS_COMMENT_RE.sub("", css)
    rules: dict[str, dict[str, str]] = {}
    for chunk in css.split("}"):
        chunk = chunk.strip()
        if not chunk or "{" not in chunk:
            continue
        sel, body = chunk.split("{", 1)
        selectors = [s.strip() for s in sel.split(",") if s.strip()]
        decls: dict[str, str] = {}
        for d in body.split(";"):
            d = d.strip()
            if not d or ":" not in d:
                continue
            k, v = d.split(":", 1)
            # Strip !important so "none !important" matches "none" in E11 checks.
            v_clean = _CSS_IMPORTANT_RE.sub('', v.strip())
            decls[k.strip().lower()] = " ".join(v_clean.split())
        for s in selectors:
            rules.setdefault(s, {}).update(decls)
    return rules


# ──────────────────────────────────────────────────────────────────────────
# HTML walker — collects everything we need in one pass
# ──────────────────────────────────────────────────────────────────────────

@dataclass
class Walk:
    style_blocks: list[str] = field(default_factory=list)
    stylesheet_links: list[str] = field(default_factory=list)
    has_h1: bool = False
    h1_text: str = ""
    h1_starts_with_visual: bool = False     # leading emoji or <img>
    headings: list[tuple[int, str]] = field(default_factory=list)
    # Banner tracking: first <p class="banner"> seen
    p_banner_text: str | None = None
    # All banner texts in document order — used to validate bottom banner
    p_all_banner_texts: list[str] = field(default_factory=list)
    # Whether an <hr> appeared before the LAST (bottom) banner
    hr_before_bottom_banner: bool = False
    # Legacy footer-as-banner: <p class="footer"> containing read-only text
    p_footer_with_readonly: bool = False
    legacy_class_hits: list[tuple[str, str]] = field(default_factory=list)   # (tag, class)
    spacer_count: int = 0
    external_imgs: list[str] = field(default_factory=list)
    # has_em / has_i only reflect tags in <body> — tags in <head>/<title> are excluded
    # to prevent false E16 positives from <em> inside <title>.
    has_em: bool = False
    has_i: bool = False
    banner_count: int = 0
    has_charset: bool = False
    has_lang: bool = False
    has_title_tag: bool = False


class _Walker(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.w = Walk()
        self._capture: str | None = None     # current capture: "style" | "h" | "p" | "title"
        self._h_level: int | None = None
        self._buf: list[str] = []
        self._p_is_banner: bool = False
        self._p_is_footer: bool = False
        self._p_banner_seen: bool = False    # track whether we've seen the FIRST banner
        self._hr_after_first_banner: bool = False  # <hr> seen after current banner window
        self._in_head: bool = False          # True while inside <head>; gates has_em/has_i

    # — start tags —
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get("class") or "").split()

        if tag == "head":
            self._in_head = True
        if tag == "body":
            # Fallback: ensure _in_head is cleared even when </head> is missing
            # (malformed HTML). Without this, has_em/has_i would never be set.
            self._in_head = False
        if tag == "html" and (a.get("lang") or "").lower().startswith("en"):
            self.w.has_lang = True
        if tag == "meta" and (a.get("charset") or "").lower() == "utf-8":
            self.w.has_charset = True
        if tag == "title":
            self._capture = "title"
            self._buf = []
        if tag == "style":
            self._capture = "style"
            self._buf = []
        if tag == "link" and (a.get("rel") or "").lower() == "stylesheet":
            self.w.stylesheet_links.append(a.get("href") or "")
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self._capture = "h"
            self._h_level = int(tag[1])
            self._buf = []
            if tag == "h1":
                self.w.has_h1 = True
        if tag == "img":
            src = a.get("src") or ""
            # Non-data-URI image: flag as external (policy requires base64 embedding).
            if src and not src.lower().startswith("data:"):
                self.w.external_imgs.append(src)
            # Visual opener detection: leading <img> in <h1>.
            # Strip the buffer to ignore leading whitespace-only text nodes so that
            # <h1> <img src="..."> does not produce a false W4.
            if self._capture == "h" and self._h_level == 1 and not "".join(self._buf).strip():
                self.w.h1_starts_with_visual = True
        if tag == "p":
            self._capture = "p"
            self._buf = []
            self._p_is_banner = "banner" in cls
            self._p_is_footer = "footer" in cls
            if "spacer" in cls:
                self.w.spacer_count += 1
        if tag == "div" and "spacer" in cls:
            self.w.spacer_count += 1
        if tag == "hr" and self._p_banner_seen:
            # Track <hr> appearing after the most recent banner (inter-banner window).
            self._hr_after_first_banner = True
        # Only flag <em>/<i> in <body> — tags in <head> (e.g. inside <title>) are
        # excluded to prevent false E16 positives from legitimate head markup.
        if not self._in_head:
            if tag == "em":
                self.w.has_em = True
            if tag == "i":
                self.w.has_i = True
        # E5 — legacy class check on any element (not just div/p)
        for legacy in LEGACY_CLASSES:
            if legacy in cls:
                self.w.legacy_class_hits.append((tag, legacy))

    # — end tags —
    def handle_endtag(self, tag):
        if tag == "head":
            self._in_head = False
        if tag == "title" and self._capture == "title":
            self.w.has_title_tag = True
            self._capture = None
            self._buf = []
        elif tag == "style" and self._capture == "style":
            self.w.style_blocks.append("".join(self._buf))
            self._capture = None
            self._buf = []
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6") and self._capture == "h":
            text = "".join(self._buf).strip()
            if self._h_level == 1:
                self.w.h1_text = text
                # leading visual = leading <img> (set above) OR leading emoji char
                if not self.w.h1_starts_with_visual and text:
                    if _starts_with_emoji(text):
                        self.w.h1_starts_with_visual = True
            self.w.headings.append((self._h_level or 0, text))
            self._capture = None
            self._h_level = None
            self._buf = []
        elif tag == "p" and self._capture == "p":
            text = "".join(self._buf).strip()
            if self._p_is_banner:
                self.w.banner_count += 1
                self.w.p_all_banner_texts.append(text)
                if not self._p_banner_seen:
                    # First banner: capture text and begin the inter-banner hr window.
                    self.w.p_banner_text = text
                    self._p_banner_seen = True
                    self._hr_after_first_banner = False  # reset — start watching for hr
                else:
                    # Subsequent banner (2nd, 3rd, …): always update hr_before_bottom_banner
                    # so it tracks the <hr> before the LAST banner, not just the second.
                    # This means 3-banner files correctly check hr before banner #3.
                    self.w.hr_before_bottom_banner = self._hr_after_first_banner
                    self._hr_after_first_banner = False  # reset for next inter-banner window
            if self._p_is_footer:
                # Legacy pattern: <p class="footer" style="color:#cc0000; …">
                # Files should use class="banner" instead.
                # Detection: both "read-only" AND "edited by request" must appear.
                _tl = text.lower()
                if ("read-only" in _tl or "read only" in _tl) and "edited by request" in _tl:
                    self.w.p_footer_with_readonly = True
            self._capture = None
            self._buf = []

    # — text —
    def handle_data(self, data):
        if self._capture in ("style", "h", "p", "title"):
            self._buf.append(data)


def _starts_with_emoji(s: str) -> bool:
    """Detect whether the first character of s is an emoji or common symbol.
    Covers the ranges used as guide-title openers; good enough for W4."""
    if not s:
        return False
    cp = ord(s[0])
    if cp >= 0x1F300:              # supplementary plane — most modern emoji
        return True
    if 0x2600 <= cp <= 0x27BF:    # misc symbols & dingbats (☕ ⚠ ✈ etc.)
        return True
    if 0x2B00 <= cp <= 0x2BFF:    # misc symbols & arrows (⭐ ⬆ etc.)
        return True
    if 0x2300 <= cp <= 0x23FF:    # misc technical (⏳ ⌚ etc.)
        return True
    if 0x2100 <= cp <= 0x214F:    # letterlike symbols (™ ℃ ℹ etc.)
        return True
    if 0x2190 <= cp <= 0x21FF:    # arrows (← → ↑ ↓ ↗ etc.)
        return True
    if 0x25A0 <= cp <= 0x25FF:    # geometric shapes (■ □ ◆ ▶ ▷ etc.)
        return True
    if cp in (0x00A9, 0x00AE):    # © ®
        return True
    return False


# ──────────────────────────────────────────────────────────────────────────
# Per-file checks
# ──────────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Finding:
    level: str          # "ERROR" or "WARN"
    rule: str           # e.g. "E2 [§3,§7]"
    message: str


def check_file(path: Path) -> list[Finding]:
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        return [Finding("ERROR", "E0 [read]", f"Could not read file: {e}")]

    # E0a — DOCTYPE must be at the very start (allow leading whitespace or BOM \ufeff).
    # Files saved as UTF-8-with-BOM are read with encoding="utf-8" (not "utf-8-sig"),
    # so the BOM appears as \ufeff in the string; \s alone would not match it.
    has_doctype = bool(_DOCTYPE_RE.match(raw))

    # walk
    walker = _Walker()
    try:
        walker.feed(raw)
        walker.close()
    except Exception as e:  # noqa: BLE001
        return [Finding("ERROR", "E0 [parse]", f"HTML parse failed: {type(e).__name__}: {e}")]

    w = walker.w
    findings: list[Finding] = []

    # E0 — shell sanity
    if not has_doctype:
        findings.append(Finding("ERROR", "E0a [§3]", "missing `<!DOCTYPE html>`"))
    if not w.has_lang:
        findings.append(Finding("ERROR", "E0b [§3]", "`<html>` missing `lang=\"en\"`"))
    if not w.has_charset:
        findings.append(Finding("ERROR", "E0c [§3]", "missing `<meta charset=\"UTF-8\">`"))
    if not w.has_title_tag:
        findings.append(Finding("ERROR", "E0d [§3]", "missing `<title>` in `<head>`"))

    # E1 — linked canonical stylesheet required (2026-05-14: CSS extracted from
    # inline to external link, one source of truth at Brain/Reference/Core Rules Style.css)
    if not w.stylesheet_links:
        findings.append(Finding(
            "ERROR", "E1 [§1,§3]",
            f'missing `<link rel="stylesheet" href="{CANONICAL_CSS_HREF}">` in `<head>` — '
            "CSS lives in the canonical stylesheet, linked from every file",
        ))
    elif not any(href == CANONICAL_CSS_HREF for href in w.stylesheet_links):
        findings.append(Finding(
            "ERROR", "E1 [§1,§3]",
            f"stylesheet link does not point to canonical "
            f"(→ {', '.join(w.stylesheet_links)}; should be `{CANONICAL_CSS_HREF}`)",
        ))
    else:
        # Canonical link present — warn on any additional non-canonical stylesheet links.
        _extra_css = [h for h in w.stylesheet_links if h != CANONICAL_CSS_HREF]
        if _extra_css:
            findings.append(Finding(
                "WARN", "W_css [§1,§3]",
                f"extra stylesheet link(s) alongside canonical — only the canonical should be linked: "
                f"{', '.join(_extra_css)}",
            ))

    # Pre-compute parsed inline style rules once — reused by W1 and E11a to
    # avoid calling parse_css twice per file when both checks fire.
    _parsed_style: dict[str, dict[str, str]] = (
        parse_css("\n".join(w.style_blocks)) if w.style_blocks else {}
    )

    # W1 — unexpected inline <style> declarations.
    # Sanctioned per-file overrides: code/font-size, .entry/background, li/margin-bottom,
    # and .retired-notice. Any other (selector, property) pair warrants a warning.
    # _W1_FULL_CSS_FILES carry intentional full <style> blocks (e.g. rich icon tables) —
    # W1 is suppressed for them. See _W1_ALLOWED_PAIRS comment at module level.
    if w.style_blocks and path.name not in _W1_FULL_CSS_FILES:
        unexpected = []
        for sel, props in _parsed_style.items():
            if sel in _W1_ALLOWED_SELECTORS:
                continue
            for prop in props:
                if (sel, prop) not in _W1_ALLOWED_PAIRS:
                    unexpected.append(f"`{sel} {{ {prop} }}`")
        if unexpected:
            _uniq = sorted(set(unexpected))
            _suffix = f" (and {len(_uniq) - 5} more)" if len(_uniq) > 5 else ""
            findings.append(Finding(
                "WARN", "W1 [§3]",
                f"unexpected declaration(s) in inline `<style>` — sanctioned overrides are "
                f"code/font-size, .entry/background, li/margin-bottom, and .retired-notice; "
                f"unexpected: {', '.join(_uniq[:5])}{_suffix}",
            ))

    # E3 — RETIRED 2026-05-14 (CSS now lives in the external canonical stylesheet).

    # E4 — banner is <p class="banner"> with the canonical text.
    # Case-insensitive match: source text may be stored lower or upper case;
    # the CSS text-transform renders it visually uppercased either way.
    #
    # MIGRATION NOTE: files pre-dating 2026-05-14 used <p class="footer"
    # style="color:#cc0000; ..."> as the banner. Run doc_workshop_fixer.py to migrate.
    if w.p_banner_text is None:
        hint = ""
        if w.p_footer_with_readonly:
            hint = (
                " — hint: found `<p class=\"footer\">` containing read-only text; "
                "rename class to `banner` and remove inline style override"
            )
        findings.append(Finding(
            "ERROR", "E4 [§3,§6]",
            f"missing `<p class=\"banner\">` read-only notice at top of `<body>`{hint}",
        ))
    elif not (
        "read-only" in w.p_banner_text.lower()
        and "edited by request" in w.p_banner_text.lower()
    ):
        # W3 checks for the two required phrases rather than exact text — the banner
        # may include additional reminder lines beyond the canonical single line.
        findings.append(Finding(
            "WARN", "W3 [§6]",
            f"banner text missing required phrases 'read-only' and/or 'edited by request' — "
            f"got: {w.p_banner_text[:80]!r}",
        ))

    # W_footer — <p class="footer"> used as banner (wrong class)
    # Separate from E4 so this fires even when E4 doesn't (unlikely but complete).
    if w.p_footer_with_readonly and w.p_banner_text is not None:
        findings.append(Finding(
            "WARN", "W_footer [§3,§6]",
            '`<p class="footer">` with read-only text found alongside a correct '
            '`<p class="banner">` — remove the duplicate `footer` banner',
        ))

    # E17 — banner must appear at both top and bottom of every file (§3)
    # E4 catches a missing top banner; E17 catches a missing bottom banner.
    # Files with zero banners already fail E4, so E17 only fires when count == 1.
    if w.banner_count == 1:
        findings.append(Finding(
            "ERROR", "E17 [§3]",
            "only one `<p class=\"banner\">` found — banner must appear at both top "
            "and bottom of `<body>`; add a matching banner (with `<hr>`) at the bottom",
        ))

    # W_banner_count — more than 2 banners is structurally wrong
    if w.banner_count > 2:
        findings.append(Finding(
            "WARN", "W_banner_count [§3]",
            f"{w.banner_count} `<p class=\"banner\">` elements found — expected exactly 2 "
            "(top and bottom); remove extras",
        ))

    # W3b — bottom (last) banner must also contain the required phrases (W3 only checks top)
    if w.banner_count >= 2:
        _bottom_text = w.p_all_banner_texts[-1].lower()
        if not ("read-only" in _bottom_text and "edited by request" in _bottom_text):
            findings.append(Finding(
                "WARN", "W3b [§6]",
                f"bottom `<p class=\"banner\">` missing required phrases 'read-only' and/or "
                f"'edited by request' — got: {w.p_all_banner_texts[-1][:80]!r}",
            ))

    # W_hr — bottom banner must be preceded by an <hr> separator
    if w.banner_count >= 2 and not w.hr_before_bottom_banner:
        findings.append(Finding(
            "WARN", "W_hr [§3]",
            "no `<hr>` found before the bottom `<p class=\"banner\">` — "
            "add `<hr>` immediately before the closing banner",
        ))

    # E5 — no legacy <div class=titlebar/title/meta/locked/read-only-notice>
    if w.legacy_class_hits:
        seen = sorted(set(c for _, c in w.legacy_class_hits))
        findings.append(Finding(
            "ERROR", "E5 [§7]",
            f"legacy classes present (forbidden): {', '.join(f'`.{c}`' for c in seen)}",
        ))

    # E6 — no spacer elements (<p> or <div> with class="spacer")
    if w.spacer_count:
        findings.append(Finding(
            "ERROR", "E6 [§7]",
            f"{w.spacer_count} `class=\"spacer\"` element(s) — CSS margins already handle vertical spacing",
        ))

    # E7 — exactly one <h1> for the title
    h1_count = sum(1 for lv, _ in w.headings if lv == 1)
    if h1_count == 0:
        findings.append(Finding("ERROR", "E7 [§3,§6]", "missing `<h1>` title"))
    elif h1_count > 1:
        findings.append(Finding("ERROR", "E7 [§3,§6]", f"{h1_count} `<h1>` elements — should be exactly 1"))

    # W4 — h1 should start with an emoji (or embedded <img>).
    # Add filenames to _W4_EXEMPT (module level) if a file legitimately has no emoji h1.
    if (w.has_h1
            and not w.h1_starts_with_visual
            and path.name not in _W4_EXEMPT):
        findings.append(Finding(
            "WARN", "W4 [§3,§6]",
            f"`<h1>` doesn't start with an emoji or `<img>` — got: {w.h1_text[:60]!r}",
        ))

    # W5 — RETIRED 2026-05-14 (§ N. prefixes removed from all h2 headers).

    # E8 — non-data-URI <img src="..."> (policy: all images must be base64-embedded)
    if w.external_imgs:
        findings.append(Finding(
            "ERROR", "E8 [§7]",
            f"{len(w.external_imgs)} `<img src=…>` with non-data URI — embed as base64 data URI",
        ))

    # E11 — canonical elements must not be hidden with display:none
    # Catches two hiding vectors:
    #   A) display:none in an inline <style> block targeting canonical selectors
    #   B) style="display:none" attribute directly on canonical-class elements

    # Vector A — inline style block scan
    if w.style_blocks:
        hidden = [
            sel for sel, props in _parsed_style.items()
            if props.get("display") == "none"
            and (
                sel in _E11_CANONICAL_SELECTORS
                or any(
                    token in _E11_CANONICAL_SELECTORS
                    for token in _E11_CSS_COMBINATOR.split(sel)
                    if token
                )
            )
        ]
        if hidden:
            findings.append(Finding(
                "ERROR", "E11a [§3,§6]",
                "canonical element(s) hidden with `display:none` in inline `<style>` — required structural "
                f"elements must be visible: {', '.join(f'`{s}`' for s in sorted(hidden))}",
            ))

    # W6 — RETIRED 2026-05-14 (blank-line-before-h2 stylistic check; no longer applicable).
    # W8 — RETIRED 2026-05-14 (short-consecutive-<p> merge suggestion; no longer applicable).

    # ── Build the shared source bases used by ALL content and structural checks below.
    #
    # Stripping order (each step builds on the previous):
    #   1. _raw_no_comments     — HTML comments removed;         intermediate for level 2
    #   2. _raw_no_script_style — <script>/<style> bodies also removed; used by E11b, E14, E15
    #   3. _rendered_text       — all remaining tags stripped to spaces; used by E9–E13, W7, W9
    #
    # Why three levels?
    #   • E11b inspects tag ATTRIBUTES (class=, style=) so it needs tags present → _raw_no_script_style
    #     (using _raw_no_script_style rather than _raw_no_comments also eliminates false positives
    #     from template/example HTML strings inside <script> blocks)
    #   • E9/E10/E12/E13/W9 search visible prose → must exclude <script>/<style> content or
    #     CSS/JS literals (currency symbols, names, prose patterns) cause false positives
    #   • E14/E15 also need the script/style body gone → reuse _raw_no_script_style
    _raw_no_comments     = _STRIP_COMMENT_RE.sub('', raw)
    _raw_no_script_style = _STRIP_SCRIPT_RE.sub('', _raw_no_comments)
    _raw_no_script_style = _STRIP_STYLE_RE.sub('', _raw_no_script_style)
    _rendered_text       = _STRIP_TAGS_RE.sub(' ', _raw_no_script_style)

    # Vector B — inline style attribute on elements with canonical classes.
    # Uses _E11B_TAG_RE (re.DOTALL) to extract each opening tag as a whole string,
    # then checks class and style attributes independently — handles multi-line tags
    # and both single- and double-quoted attribute values.
    # Operates on _raw_no_script_style (not raw or _raw_no_comments) to avoid false
    # positives from tags in HTML comments OR template/example strings inside <script> blocks.
    _inline_hidden = [
        tag_str
        for tag_str in (m.group(0) for m in _E11B_TAG_RE.finditer(_raw_no_script_style))
        if _E11B_CLASS_RE.search(tag_str) and _E11B_STYLE_RE.search(tag_str)
    ]
    if _inline_hidden:
        findings.append(Finding(
            "ERROR", "E11b [§3,§6]",
            f"{len(_inline_hidden)} canonical element(s) hidden via inline `style=\"display:none\"` — "
            "structural elements must not be hidden",
        ))

    # W7 — version metadata pattern under the title (e.g. "v9 · 2026-04-30").
    # Uses _raw_no_script_style so that version-like strings inside <script>/<style>
    # blocks (e.g. a JS variable assigned a date string) don't trigger a false positive.
    version_meta = _scan_version_meta(_raw_no_script_style)
    if version_meta:
        findings.append(Finding(
            "WARN", "W7 [§7]",
            f"version-metadata-looking text near top of `<body>`: {version_meta[:60]!r}",
        ))

    # E9 — ~ directly after a motion emoji (🚶 🚕 🚌) is a hard fail.
    # Rule docs use ~ in prose/examples legitimately; the broad ban lives in
    # validate_itinerary.py which checks shipped guide HTML.
    # Uses _rendered_text (comments, scripts, and styles stripped — no false positives from
    # inline CSS literals or JS strings that happen to contain a tilde after an emoji).
    tilde_hits = []
    for m in _E9_TILDE_RE.finditer(_rendered_text):
        snip = _WHITESPACE_RE.sub(' ', _rendered_text[max(0, m.start()-20):m.end()+30].strip())[:80]
        tilde_hits.append(snip)
    if tilde_hits:
        findings.append(Finding(
            "ERROR", "E9 [Motion §1]",
            f"~ after motion emoji — hard fail, actual minutes only: "
            f"{len(tilde_hits)} hit(s): "
            + "; ".join(f'"{s}"' for s in tilde_hits[:3]),
        ))

    # E10 — no currency/price figures in rule-doc HTMLs.
    # Rule-doc HTMLs document format rules — they must never show actual prices
    # ($, €, £, ¥, etc. adjacent to a digit). On Demand files live in a
    # subfolder and are not scanned by this validator (folder-level glob only).
    # html.unescape converts entity-encoded symbols (&euro;, &dollar;, &pound;, etc.)
    # _rendered_currency is also reused by E14 — entity-encoded domain names must
    # be normalised before the domain scan (e.g. "example&#46;com" → "example.com").
    _rendered_currency = html.unescape(_rendered_text)
    currency_hits = []
    for m in _E10_CURRENCY_RE.finditer(_rendered_currency):
        snip = _rendered_currency[max(0, m.start() - 20):m.end() + 20].strip()[:60]
        currency_hits.append(snip)
    if currency_hits:
        findings.append(Finding(
            "ERROR", "E10 [content]",
            f"currency/price figure in rule-doc HTML — prices belong in On Demand files only: "
            f"{len(currency_hits)} hit(s): "
            + "; ".join(f'"{s}"' for s in currency_hits[:3]),
        ))

    # E12 — no personal name references in rule-doc HTMLs
    # "Dani" is prohibited except in two section-label patterns (see _E12_EXEMPT_PAT).
    # Uses exempt-span approach (not substitution) to keep match positions correct
    # in _rendered_text so snippets are extracted from the right location.
    _e12_exempt_spans = [(m.start(), m.end()) for m in _E12_EXEMPT_PAT.finditer(_rendered_text)]
    _name_hits = [
        m for m in _E12_NAME_RE.finditer(_rendered_text)
        if not any(s <= m.start() < e for s, e in _e12_exempt_spans)
    ]
    if _name_hits:
        _snips = []
        for m in _name_hits:
            snip = _rendered_text[max(0, m.start()-30):m.end()+30]
            snip = _WHITESPACE_RE.sub(' ', snip).strip()[:80]
            _snips.append(snip)
        findings.append(Finding(
            "ERROR", "E12 [content]",
            f"personal name reference(s) in rule doc ({len(_name_hits)} hit(s)) — "
            f"use neutral phrasing (e.g. 'the traveler'). First: {_snips[0]!r}",
        ))

    # E13 — no dated personal attributions (Per Dani YYYY-MM-DD or [—/–/--] Dani YYYY-MM-DD)
    # Pattern is module-level _E13_ATTR_RE; see its comment for scope notes.
    _attr_hits = _E13_ATTR_RE.findall(_rendered_text)
    if _attr_hits:
        findings.append(Finding(
            "ERROR", "E13 [content]",
            f"{len(_attr_hits)} dated personal attribution(s) — remove 'Per Dani YYYY-MM-DD' "
            f"and '— Dani YYYY-MM-DD' patterns. First: {_attr_hits[0]!r}",
        ))

    # E15 — banned words must not appear as visible text in any rule doc.
    # Banned: "Map", "Maps", "Link", "Links" — the format shows what to do;
    # these words are never written out in guide text or rule docs.
    # FORMAT_EXCEPTION_FILES are exempt — they are Claude reference files that
    # may use these terms technically.
    # Per Icon Order and Format.html row 7 + Rules for Claude.html § 12.
    if path.name not in FORMAT_EXCEPTION_FILES:
        _e15_raw = _raw_no_script_style
        # Exempt filename citations — proper noun references, not the banned word itself.
        # Covers Links.html and any *Map.html reference (Europe Map.html, US Map.html, etc.)
        _e15_raw = _E15_LINKS_FILENAME_RE.sub('___FILENAME___', _e15_raw)
        _e15_raw = _E15_MAP_FILENAME_RE.sub('___FILENAME___', _e15_raw)
        _e15_hits: list[str] = [
            m.group(1).strip()[:60]
            for m in _E15_WORD_RE.finditer(_e15_raw)
            if m.group(1).strip()
        ]
        if _e15_hits:
            findings.append(Finding(
                "ERROR", "E15 [content]",
                f'banned word(s) "Map/Maps/Link/Links" in visible text — '
                f'the format shows what to do; these words are never written out; '
                f'{len(_e15_hits)} hit(s): '
                + '; '.join(f'"{h}"' for h in _e15_hits[:3]),
            ))

    # E14 — no real domain names in rule docs (hard fail).
    # _DOMAIN_EXEMPT_FILES covers all FORMAT_EXCEPTION_FILES plus any additional
    # platform/link reference files (see module-level constant).
    if path.name.lower() not in _DOMAIN_EXEMPT_FILES:
        # Reuse _rendered_currency (html.unescape(_rendered_text)) — identical to
        # stripping _raw_no_script_style and unescaping, with no redundant computation.
        _rendered_no_placeholders = _E14_DOMAIN_PLACEHOLDER.sub('___PLACEHOLDER___', _rendered_currency)
        _domain_hits = sorted(set(_E14_DOMAIN_PAT.findall(_rendered_no_placeholders)))
        if _domain_hits:
            findings.append(Finding(
                "ERROR", "E14 [content]",
                f"real domain(s) in rule doc — use {{venue-site.com}} placeholder instead: "
                f"{', '.join(_domain_hits[:5])}",
            ))

    # FORMAT_EXCEPTION_FILES are exempt from E16 and W9 — they use <em> intentionally
    # and may legitimately contain constructions like "without exception" in rule prose.
    if path.name in FORMAT_EXCEPTION_FILES:
        return findings

    # E16 — <em> and <i> forbidden in rule docs (§8 No italic).
    # has_em / has_i are only set for tags in <body> (walker excludes <head>),
    # so <em> inside <title> does not trigger a false positive here.
    if w.has_em or w.has_i:
        _italic_tags = ", ".join(t for t, flag in [("<em>", w.has_em), ("<i>", w.has_i)] if flag)
        findings.append(Finding(
            "ERROR", "E16 [§8]",
            f"{_italic_tags} tag(s) present — italic is not permitted in rule docs; strip on sight",
        ))

    # W9 — redundant prose that restates what the entry template already shows visually.
    # The template is the spec; prose descriptions of it create drift. Patterns are
    # pre-compiled at module level as _REDUNDANT_PROSE_PATTERNS (includes re.I).
    _prose_hits = []
    _prose_seen: set[str] = set()
    for pat in _REDUNDANT_PROSE_PATTERNS:
        for m in pat.finditer(_rendered_text):
            snip = _rendered_text[max(0, m.start()-20):m.end()+40].strip()
            snip = _WHITESPACE_RE.sub(' ', snip)[:80]
            if snip not in _prose_seen:
                _prose_seen.add(snip)
                _prose_hits.append(snip)
    if _prose_hits:
        findings.append(Finding(
            "WARN", "W9 [content]",
            f"redundant prose restating the entry template ({len(_prose_hits)} hit(s)) — "
            f"the template row is the spec; remove the prose description. "
            f"First: {_prose_hits[0]!r}",
        ))

    return findings


def _scan_version_meta(src: str) -> str | None:
    """Look for version-metadata text in the first ~25 lines after `<body>`.
    Catches things like 'v9 · 2026-04-30'. Caller should pass _raw_no_script_style
    (comments, scripts, and styles stripped) to avoid false positives from JS/CSS."""
    lines = src.splitlines()
    body_start = None
    for i, ln in enumerate(lines):
        if _VM_BODY_RE.search(ln):
            body_start = i + 1
            break
    if body_start is None:
        return None
    head = "\n".join(lines[body_start:body_start + 25])
    text = _STRIP_TAGS_RE.sub(' ', head)
    m = _VM_VERSION_RE.search(text)
    return m.group(0) if m else None


# ──────────────────────────────────────────────────────────────────────────
# Reporting
# ──────────────────────────────────────────────────────────────────────────

def _hr(c: str = "─", n: int = 78) -> str:
    return c * n


def report(
    folder: Path,
    results: list[tuple[Path, list[Finding]]],
    quiet: bool,
    show_cascade: bool = True,
) -> int:
    # When specific target files were passed, derive a display label from the
    # actual file locations rather than always showing the default folder, which
    # would be misleading when files come from a different directory.
    _dirs = sorted({p.parent for p, _ in results})
    _folder_label = str(_dirs[0]) if len(_dirs) == 1 else f"{folder} (+ {len(_dirs)-1} other dir(s))"

    print(_hr("═"))
    print(f"  {folder.name} validator — {dt.datetime.now():%Y-%m-%d %H:%M}")
    print(_hr("═"))
    print(f"  Folder: {_folder_label}")
    print(f"  Rules:  Brain/Reference/Core Rules Formatting.html")
    print(f"  Files:  {len(results)} HTML file(s) checked")
    print()

    clean_files: list[str] = []
    error_files: list[str] = []
    warn_files: list[str] = []

    for path, file_findings in results:
        errs  = [f for f in file_findings if f.level == "ERROR"]
        warns = [f for f in file_findings if f.level == "WARN"]
        if errs:
            error_files.append(path.name)
        elif warns:
            warn_files.append(path.name)
        else:
            clean_files.append(path.name)

        if quiet and not file_findings:
            continue

        # File header
        if errs:
            tag = f"❌ {len(errs)} error(s)"
            if warns:
                tag += f", {len(warns)} warning(s)"
        elif warns:
            tag = f"⚠️  {len(warns)} warning(s)"
        else:
            tag = "✅ clean"
        print(f"  {path.name}  —  {tag}")
        for f in file_findings:
            print(f"     [{f.level:<5} {f.rule}] {f.message}")
        print()

    print(_hr())
    print(f"  Summary: {len(clean_files)} clean · {len(warn_files)} warn-only · {len(error_files)} with errors")
    print(_hr())
    if error_files:
        print(f"  Files with errors ({len(error_files)}):")
        for n in error_files:
            print(f"     · {n}")

    # ── Post-edit cascade reminder ────────────────────────────────────────
    if not show_cascade:
        return 1 if error_files else 0
    # Fires after every run. If this followed a CORE RULES edit, verify each
    # item before announcing done. Full cascade: Brain/Reference/Change Cascade.html.
    print()
    print("  ── Cascade check (after any CORE RULES edit) ──────────────────")
    print("  ✦ Travel/CLAUDE.md          — DriftyCat · build phases · session ritual")
    print("  ✦ Validator Index.html       — if any validator check was added/changed")
    print("  ✦ Rule Dependencies.html     — if icons, thresholds, or concepts changed")
    print("  ✦ Separation Map.md          — if rule ownership moved")
    print("  ✦ Guide Entry Counts.html    — if any count or threshold changed")
    print("  ✦ travel_map.md              — if files were added, removed, or renamed")
    print("  ✦ Toolbar.html / Navigation.html — if toolbar or nav rules changed")
    print("  ✦ core_rules_checksums.json  — run update_core_rules_checksums.py")
    print("  Full checklist: Brain/Reference/Change Cascade.html")
    print(_hr())

    return 1 if error_files else 0


# ──────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("targets", nargs="*", help="Specific file(s) to check (default: every *.html in --folder)")
    ap.add_argument("--quiet", "-q", action="store_true", help="Only show files with violations")
    ap.add_argument("--warn-only", action="store_true", help="Downgrade ERRORs to warnings (always exit 0)")
    # Default folder: Brain/CORE RULES/ relative to this script's location.
    # Override with --folder if the script is run from a different location or symlinked.
    _default_folder = Path(__file__).resolve().parent.parent / "CORE RULES"
    ap.add_argument(
        "--folder", "-f",
        type=Path,
        default=_default_folder,
        help=f"Folder of .html files to validate (default: {_default_folder})",
    )
    args = ap.parse_args()

    folder = args.folder.resolve()
    if args.targets:
        files = [Path(t) if Path(t).is_absolute() else (folder / t) for t in args.targets]
        files = [p.resolve() for p in files]
        for p in files:
            if not p.exists():
                print(f"error: not found: {p}", file=sys.stderr)
                return 2
    else:
        files = sorted(folder.glob("*.html"))

    if not files:
        print(f"No .html files in {folder}")
        return 0

    results = [(p, check_file(p)) for p in files]

    # --warn-only: create downgraded copies of Finding objects (Finding is frozen,
    # so mutations are not possible; new objects are created instead).
    if args.warn_only:
        results = [
            (
                p,
                [
                    Finding("WARN", f.rule, f.message) if f.level == "ERROR" else f
                    for f in file_findings
                ],
            )
            for p, file_findings in results
        ]

    code = report(folder, results, quiet=args.quiet, show_cascade=not args.quiet)
    return 0 if args.warn_only else code


if __name__ == "__main__":
    raise SystemExit(main())
