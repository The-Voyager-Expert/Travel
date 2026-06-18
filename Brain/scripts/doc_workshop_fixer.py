#!/usr/bin/env python3
"""
CORE RULES fixer — rewrites every .html in this folder so it conforms to
the Universal Formatting Rules. Companion to `doc_workshop_validator.py` (the enforcer).

Canonical shape (as of 2026-05-14 — external stylesheet era):
  · <head> links the canonical external stylesheet (NOT an inline <style> block)
  · <body> opens with <p class="banner">…READ-ONLY…</p>
  · <h1>{emoji} {title}</h1> follows
  · <div class="meta"> Phase/Summary block follows h1
  · Per-file local <style> overrides (e.g. .entry colors) are PRESERVED — only
    canonical-duplicate declarations are candidates for removal

Failure modes this script corrects:

  1. LEGACY shape — has `<div class="titlebar"/>title/locked/read-only-notice>`
     block-level divs (old Google Docs / Cowork-render heritage).

  2. WRONG_BANNER — uses `<p class="footer" style="color:#cc0000; ...">` for the
     read-only notice instead of `<p class="banner">`. (Files created before the
     2026-05-14 canonical-class alignment.)

  3. SPACER — has `<p class="spacer">` markers.

In all cases the fixer:
  · Ensures the canonical external stylesheet link is present in <head>
  · Replaces the legacy banner (class="footer" read-only paragraph) with
    <p class="banner">…READ-ONLY…</p>
  · Preserves <h1>{emoji} {title}</h1>
  · Preserves <div class="meta">…</div> verbatim
  · Preserves all body content (h2s and below) verbatim
  · Drops legacy header divs and spacer paragraphs
  · Does NOT strip per-file local <style> overrides

Self-contained: no imports from Brain/, no reads outside this folder.

Usage:
    python3 "doc_workshop_fixer.py"                    # fix every non-clean file
    python3 "doc_workshop_fixer.py" Tour\ Rules.html   # fix a specific file
    python3 "doc_workshop_fixer.py" --dry-run          # show what would change, write nothing
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# ──────────────────────────────────────────────────────────────────────────
# Canonical values (must stay in sync with doc_workshop_validator.py)
# ──────────────────────────────────────────────────────────────────────────

CANONICAL_CSS_HREF = "../Reference/Core Rules Style.css"

CANONICAL_LINK_TAG = f'<link rel="stylesheet" href="{CANONICAL_CSS_HREF}">'

CANONICAL_BANNER = (
    '<p class="banner"><strong>ATTENTION: THIS DOCUMENT IS READ-ONLY AND CAN ONLY BE EDITED BY REQUEST</strong><br>\n'
    'Read the formatting rules first — Brain/Reference/.<br>\n'
    'CSS, HTML, and validator code are not permitted in rule text.<br>\n'
    "Rules are written like a legal document — active voice, generic phrasing, no specific examples. "
    "The rules state what is; the validator catches what isn't.</p>"
)

# Canonical hr separators — top hr hugs the top banner, bottom hr hugs the bottom banner.
CANONICAL_HR_TOP = '<hr style="margin: 16px 0 48px 0; border: none; border-top: 1px solid #ddd;">'
CANONICAL_HR_BOTTOM = '<hr style="margin: 48px 0 16px 0; border: none; border-top: 1px solid #ddd;">'

# Fallback emojis for files that have no source emoji on their h1.
# Keys match the file's <title> text (case-insensitive). Add new entries here
# when a new doc lands without an emoji — never have the fixer guess.
EMOJI_FALLBACKS: dict[str, str] = {
    "day trips by train - extra section": "⛲️",
    "motion rule": "🚦",
}


# ──────────────────────────────────────────────────────────────────────────
# Detection — what makes a file need fixing?
# ──────────────────────────────────────────────────────────────────────────

def has_legacy_divs(raw: str) -> bool:
    """File has old block-level div structure from Google Docs / Cowork-render."""
    return bool(
        re.search(r'<div\s+class="titlebar"', raw, flags=re.I)
        or re.search(r'<div\s+class="locked"', raw, flags=re.I)
        or re.search(r'<div\s+class="read-only-notice"', raw, flags=re.I)
    )


def has_canonical_link(raw: str) -> bool:
    """File already links the canonical external stylesheet."""
    return CANONICAL_CSS_HREF in raw


def has_canonical_banner(raw: str) -> bool:
    """File has at least one <p class="banner"> element."""
    return bool(re.search(r'<p\s[^>]*class="[^"]*banner[^"]*"', raw, flags=re.I))


def has_both_banners(raw: str) -> bool:
    """File has both a top and bottom <p class="banner"> (E17 requires two)."""
    return len(re.findall(r'<p\s[^>]*class="[^"]*banner[^"]*"', raw, flags=re.I)) >= 2


def has_footer_banner(raw: str) -> bool:
    """File uses the legacy <p class="footer"> pattern for the read-only notice.
    Detection: same two-phrase check as the validator (read-only + edited by request)."""
    m = re.search(r'<p\s[^>]*class="[^"]*footer[^"]*"[^>]*>(.*?)</p>', raw, flags=re.I | re.S)
    if not m:
        return False
    text = re.sub(r'<[^>]+>', '', m.group(1)).lower()
    return ("read-only" in text or "read only" in text) and "edited by request" in text


def has_spacers(raw: str) -> bool:
    return bool(re.search(r'<p\s+class="spacer"', raw, flags=re.I))


def needs_fix(raw: str) -> bool:
    if has_legacy_divs(raw):
        return True
    if not has_canonical_link(raw):
        return True
    if not has_both_banners(raw):   # catches no banner, wrong-class banner, or missing bottom banner
        return True
    if has_spacers(raw):
        return True
    return False


# ──────────────────────────────────────────────────────────────────────────
# Head repair
# ──────────────────────────────────────────────────────────────────────────

def ensure_canonical_link(raw: str) -> str:
    """Guarantee the canonical external stylesheet link is in <head>.

    - If the correct link is already there: no-op.
    - If a stale link (old _style.css path, inline stylesheet) exists: replace it.
    - If no stylesheet link exists: inject before </head>.
    """
    if has_canonical_link(raw):
        return raw  # already correct — nothing to do

    # Replace any existing <link rel="stylesheet" ...> with the canonical link.
    replaced, n = re.subn(
        r'<link\s+rel="stylesheet"[^>]*>',
        CANONICAL_LINK_TAG,
        raw,
        count=1,
        flags=re.I,
    )
    if n:
        return replaced

    # No link tag at all — inject before </head>.
    return re.sub(r'(</head>)', f'{CANONICAL_LINK_TAG}\n\\1', raw, count=1, flags=re.I)


# ──────────────────────────────────────────────────────────────────────────
# Extraction helpers
# ──────────────────────────────────────────────────────────────────────────

def extract_title_text(raw: str) -> str:
    m = re.search(r"<title>(.*?)</title>", raw, flags=re.S | re.I)
    return _decode_entities(m.group(1).strip()) if m else ""


def extract_legacy_h1(raw: str) -> str | None:
    """Return the inner text of <div class="title">…</div> if present.
    Includes its leading emoji intact."""
    m = re.search(r'<div\s+class="title"[^>]*>(.*?)</div>', raw, flags=re.S | re.I)
    if not m:
        return None
    return _decode_entities(m.group(1).strip())


def extract_existing_h1(raw: str) -> str | None:
    m = re.search(r"<h1[^>]*>(.*?)</h1>", raw, flags=re.S | re.I)
    return _decode_entities(m.group(1).strip()) if m else None


def _strip_div_block(html: str, class_name: str) -> str:
    """Remove a `<div class="{class_name}">…</div>` block from `html`,
    correctly handling nested `<div>` siblings inside it. Repeats until no
    more matches remain."""
    open_pat = re.compile(rf'<div\s+class="{re.escape(class_name)}"[^>]*>', re.I)
    div_tag = re.compile(r"<(/?)div\b[^>]*>", re.I)

    while True:
        m = open_pat.search(html)
        if not m:
            return html
        i = m.end()
        depth = 1
        while depth > 0:
            tm = div_tag.search(html, i)
            if not tm:
                # malformed; bail out without modifying further
                return html
            i = tm.end()
            depth = depth - 1 if tm.group(1) == "/" else depth + 1
        # Strip trailing whitespace after the closing </div> too
        end = i
        while end < len(html) and html[end] in " \t\r\n":
            end += 1
        html = html[: m.start()] + html[end:]


def strip_legacy_footer_banner(body: str) -> str:
    """Remove <p class="footer" style="color:#cc0000; ..."> read-only paragraphs.

    These are the pre-2026-05-14 banner pattern — wrong class, inline style.
    The correct banner is injected separately as <p class="banner">.
    Strips ONLY footer paragraphs that contain read-only text; leaves other
    footer paragraphs (e.g. closing footnotes) intact.
    """
    def _replace(m: re.Match) -> str:
        inner = re.sub(r'<[^>]+>', '', m.group(0)).lower()
        # Only strip footer paragraphs that are actually serving as the read-only
        # banner (both "read-only" AND "edited by request" present — same detection
        # logic as the validator's p_footer_with_readonly check).
        if ("read-only" in inner or "read only" in inner) and "edited by request" in inner:
            return ""
        return m.group(0)

    return re.sub(
        r'<p\s[^>]*class="[^"]*footer[^"]*"[^>]*>.*?</p>\s*',
        _replace,
        body,
        flags=re.I | re.S,
    )


def extract_body_content(raw: str) -> str:
    """Pull out the meaningful body content — everything that should survive
    the rebuild, in order. Drops legacy header divs (read-only-notice,
    titlebar, locked), the legacy footer-as-banner, the existing <p class="banner">,
    the existing <h1>, and `<p class="spacer">` markers.

    NOTE: <div class="meta"> is canonical (Status/Summary block) — preserved verbatim.
    NOTE: per-file local <style> blocks are preserved — only canonical-duplicate
          declarations should be removed manually.
    """
    m = re.search(r"<body[^>]*>(.*?)</body>", raw, flags=re.S | re.I)
    if not m:
        return ""
    body = m.group(1)

    # Drop legacy block-level divs (with proper nested-div handling)
    for cls in ("read-only-notice", "titlebar", "locked"):
        body = _strip_div_block(body, cls)
    # Strip legacy title div (content gets rebuilt from h1 source).
    # NOTE: do NOT strip "meta" — <div class="meta"> is the canonical Status/Summary
    # block in the current format and must be preserved verbatim.
    body = _strip_div_block(body, "title")
    # Drop existing <p class="banner">…</p> (will be re-injected canonical)
    body = re.sub(
        r'<p\s+class="banner"[^>]*>.*?</p>\s*',
        "",
        body,
        flags=re.S | re.I,
    )
    # Drop legacy <p class="footer"> read-only banners
    body = strip_legacy_footer_banner(body)
    # Drop existing <h1>…</h1> (will be re-injected canonical)
    body = re.sub(r"<h1[^>]*>.*?</h1>\s*", "", body, flags=re.S | re.I)
    # Drop spacer paragraphs
    body = re.sub(
        r'<p\s+class="spacer"[^>]*>.*?</p>\s*',
        "",
        body,
        flags=re.S | re.I,
    )
    # Strip canonical banner-separator hr elements — rebuild() re-injects them.
    # Identified by the specific top (16px) and bottom (48px) leading margin values.
    # Internal <hr> elements with other styles are preserved.
    body = re.sub(
        r'\s*<hr\s+style="margin:\s*(?:16|48)px[^"]*"[^>]*>',
        "", body, flags=re.I,
    )
    return body


# ──────────────────────────────────────────────────────────────────────────
# Whitespace normalization
# ──────────────────────────────────────────────────────────────────────────

def normalize_body_whitespace(body: str) -> str:
    """Collapse all extraneous blank lines; re-insert exactly one blank line
    before each <h2>. Blank line before the very first <h2> is omitted."""
    lines = [ln.rstrip() for ln in body.splitlines()]
    # Trim leading/trailing blanks
    while lines and lines[0].strip() == "":
        lines.pop(0)
    while lines and lines[-1].strip() == "":
        lines.pop()

    out: list[str] = []
    for ln in lines:
        if ln.strip() == "":
            # collapse all source blanks; we re-insert the right ones below
            continue
        if re.match(r"\s*<h2\b", ln, flags=re.I):
            # ensure exactly one blank line before, unless we're at the very start
            if out and out[-1].strip() != "":
                out.append("")
        out.append(ln)
    return "\n".join(out)


# ──────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────

def _decode_entities(s: str) -> str:
    return (
        s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
    )


def _encode_title_attr(s: str) -> str:
    """Light HTML-encoding for the <title> tag content. Strips leading emoji
    if present so the page <title> reads cleanly in browser tabs."""
    # Strip a leading emoji + space if any (keep ASCII title in tab)
    s = re.sub(r"^[^\x00-\x7f]+\s*", "", s)
    return s.replace("&", "&amp;")


def _split_h1(h1_inner: str) -> tuple[str, str]:
    """Return (emoji_or_empty, rest_of_text)."""
    h1_inner = h1_inner.strip()
    # Match leading non-ASCII run (emoji etc.) + optional whitespace
    m = re.match(r"^([^\x00-\x7f][^\s]*)\s+(.*)$", h1_inner)
    if m:
        return m.group(1), m.group(2).strip()
    return "", h1_inner


def _extract_head_extras(raw: str) -> str:
    """Extract the per-file local <style> block from <head>, if any.
    Returns the full <style>…</style> string to preserve as a local override,
    or empty string if none exists."""
    m = re.search(r"(<style\b[^>]*>.*?</style>)", raw, flags=re.S | re.I)
    return m.group(1) if m else ""


# ──────────────────────────────────────────────────────────────────────────
# Lightweight fix — for files that only need banner class migration
# ──────────────────────────────────────────────────────────────────────────

def banner_only_fix(raw: str) -> str:
    """Targeted fix when the only problem is the banner class.

    For every <p class="footer" style="…"> that contains read-only text:
      · Changes class="footer" → class="banner"
      · Strips the inline style="…" attribute
      · Preserves paragraph content EXACTLY — no content loss

    Leaves all other paragraphs and the rest of the file untouched.
    This is a surgical find-and-replace, not a rebuild.
    """
    def _swap_class(m: re.Match) -> str:
        full = m.group(0)
        # Only operate on the read-only banner paragraphs — same detection as
        # the validator: both "read-only" AND "edited by request" must appear.
        inner_text = re.sub(r'<[^>]+>', '', full).lower()
        if not (("read-only" in inner_text or "read only" in inner_text)
                and "edited by request" in inner_text):
            return full  # not a banner — leave untouched

        # Extract the opening tag span
        tag_m = re.match(r'<p([^>]*)>', full, re.I)
        if not tag_m:
            return full

        attrs = tag_m.group(1)
        # Swap class="footer" → class="banner"
        attrs = re.sub(r'\bclass="[^"]*footer[^"]*"', 'class="banner"', attrs, flags=re.I)
        # Strip inline style attribute (the color/background overrides are no longer needed
        # because the canonical stylesheet's .banner rule handles styling)
        attrs = re.sub(r'\s*style="[^"]*"', '', attrs, flags=re.I)
        attrs = attrs.strip()

        # Preserve content verbatim — only the opening tag changes
        content = full[tag_m.end():]          # everything after <p …>
        content = content.rstrip()
        if content.lower().endswith('</p>'):
            content = content[:-4]             # strip closing tag for clean rebuild

        if attrs:
            return f'<p {attrs}>{content}</p>'
        else:
            return f'<p>{content}</p>'

    return re.sub(
        r'<p\s[^>]*class="[^"]*footer[^"]*"[^>]*>.*?</p>',
        _swap_class,
        raw,
        flags=re.I | re.S,
    )


# ──────────────────────────────────────────────────────────────────────────
# Full rebuild — for legacy-shaped files
# ──────────────────────────────────────────────────────────────────────────

def rebuild(raw: str) -> str:
    """Full structural rebuild — for files with legacy divs or missing head link.

    Preserves:
      · all h2+ body content
      · <div class="meta"> block
      · per-file local <style> overrides from original <head>
      · existing h1 emoji and text
    """
    title_tag = extract_title_text(raw) or "(untitled)"

    # h1 source priority: legacy <div class="title"> → existing <h1> → page <title>
    h1_inner = extract_legacy_h1(raw) or extract_existing_h1(raw) or title_tag
    emoji, rest = _split_h1(h1_inner)

    # If no emoji in source, look up a hard-coded fallback by title (don't invent).
    if not emoji:
        emoji = EMOJI_FALLBACKS.get(title_tag.strip().lower(), "")

    # Compose h1 — keep the emoji if we found one, leave bare otherwise.
    if emoji:
        h1_html = f"<h1>{emoji} {rest}</h1>"
    else:
        h1_html = f"<h1>{rest}</h1>"

    # Preserve per-file local <style> overrides (e.g. .entry color overrides)
    local_style = _extract_head_extras(raw)

    # Body content (legacy headers + banners + h1 + spacers stripped)
    body_content = extract_body_content(raw)
    body_content = normalize_body_whitespace(body_content)

    # Build <head>
    head_parts = [
        '<!DOCTYPE html>',
        '<html lang="en">',
        '<head>',
        '<meta charset="UTF-8">',
        f'<title>{_encode_title_attr(title_tag)}</title>',
        CANONICAL_LINK_TAG,
    ]
    if local_style:
        head_parts.append(local_style)
    head_parts += ['</head>', '<body>']

    # Compose final document
    doc = "\n".join(head_parts) + "\n"
    doc += CANONICAL_BANNER + "\n"
    doc += CANONICAL_HR_TOP + "\n\n"
    doc += f"{h1_html}\n"
    doc += f"{body_content}\n"
    doc += "\n" + CANONICAL_HR_BOTTOM + "\n"
    doc += CANONICAL_BANNER + "\n"
    doc += "</body>\n</html>\n"
    return doc


# ──────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("targets", nargs="*", help="Specific file(s) (default: every non-clean *.html in this folder)")
    ap.add_argument("--dry-run", action="store_true", help="Show what would change, write nothing")
    ap.add_argument("--all", action="store_true",
                    help="Run rebuild on every file (including already-clean ones) — "
                         "use to apply normalization passes folder-wide")
    args = ap.parse_args()

    # Script lives in `Brain/scripts/`; HTMLs live at
    # `Brain/CORE RULES/`. Resolve up to Brain/ then into CORE RULES/ (moved 2026-05-13).
    folder = Path(__file__).resolve().parent.parent / "CORE RULES"
    if args.targets:
        files = [Path(t) if Path(t).is_absolute() else (folder / t) for t in args.targets]
    else:
        files = sorted(folder.glob("*.html"))

    fixed = 0
    skipped = 0
    unchanged = 0
    for path in files:
        if not path.exists():
            print(f"  ✗ not found: {path.name}")
            continue
        raw = path.read_text(encoding="utf-8", errors="replace")

        if not args.all and not needs_fix(raw):
            print(f"  · {path.name}  (already clean — skipped)")
            skipped += 1
            continue

        # Choose fix strategy:
        #   · Only banner class wrong and has canonical link and no spacers → targeted banner-only fix
        #   · Legacy divs, missing link, or spacers present → full rebuild
        #     (banner_only_fix is surgical — it does NOT strip spacers; fall back to rebuild
        #      if spacers are present regardless of banner state)
        if (not has_legacy_divs(raw)
                and has_canonical_link(raw)
                and not has_canonical_banner(raw)
                and not has_spacers(raw)):
            new_raw = banner_only_fix(raw)
            strategy = "banner class fix"
        else:
            new_raw = rebuild(raw)
            # Ensure head has canonical link (rebuild does this, but guarantee)
            new_raw = ensure_canonical_link(new_raw)
            strategy = "full rebuild"

        if new_raw == raw:
            print(f"  · {path.name}  (no change)")
            unchanged += 1
            continue
        if args.dry_run:
            print(f"  ⟳ {path.name}  ({strategy} — {len(raw)}B → {len(new_raw)}B)")
        else:
            # Atomic write: .tmp sibling → rename
            tmp = path.with_suffix(path.suffix + ".tmp")
            try:
                tmp.write_text(new_raw, encoding="utf-8")
                tmp.replace(path)
            except Exception as e:
                if tmp.exists():
                    try:
                        tmp.unlink()
                    except OSError:
                        pass
                print(f"  ✗ {path.name}  write failed: {e}", file=sys.stderr)
                return 1
            print(f"  ✓ {path.name}  ({strategy} — {len(raw)}B → {len(new_raw)}B)")
        fixed += 1

    print()
    if args.dry_run:
        print(f"Dry run: would fix {fixed} file(s) ({unchanged} unchanged; {skipped} skipped).")
    else:
        print(f"Done: fixed {fixed} file(s); {unchanged} unchanged; skipped {skipped} already-clean.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
