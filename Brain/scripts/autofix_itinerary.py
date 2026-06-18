#!/usr/bin/env python3
"""
autofix_itinerary.py — Brain-level reproducible transformation.

Mechanically rewrites mis-filed booking boxes in a guide HTML so the file
matches the Brain's shape rules. Runs the SAME detection logic the validator
uses, then applies the canonical transformation instead of just flagging it.

Why this exists:
    The validator says "these 3 📅 rows carry ticket-signal tokens — move
    to 🎟️ .ticket-box." That's a deterministic structural rule. Hand-edits
    to the guide perpetuate the problem across future guides. A Brain tool
    that runs the fix means every guide can be re-run through it and come
    up correctly. No author discipline, no drift.

Transformations (current):
    • `.tour-box` whose first row carries a ticket-signal token
      (ticket / fast-track entry / hosted entry / timed-entry / admission /
       rooftop pass) →
         class="tour-box"  →  class="ticket-box"
         leading "📅 "     →  "🎟️ "
      Everything else (link, rating, review count, 🕐/⏳/👥, 📍) is
      preserved verbatim. The author's data survives; only the class +
      glyph flip so the box lands in the right bucket. This transform
      replaces a mis-filed tour-box with a ticket-box; it never adds a
      second box. (Type 3 Alternation Stops — re-locked 2026-04-25 per
      core rules/Stops Structure.html — DO ship both .tour-box
      and .ticket-box together, but those stops were authored that way
      intentionally and don't need autofixing. The CSS `:has()` auto-flip
      that promotes the title icon to "🚩 or 🎒" lives in guide_v3.css
      and triggers structurally — no autofix transform required.)

Scope boundaries:
    • Does NOT touch tour-boxes without ticket-signal tokens (real tours).
    • Does NOT touch .ticket-box that already exists.
    • Does NOT rewrite URLs, ratings, addresses, photos, or any prose.
    • Does NOT change stop-name classes.
    • Does NOT overwrite the source file until the transform succeeds. Writes
      atomically via a .tmp sibling, then renames.

Usage:
    python3 autofix_itinerary.py <guide.html>              # in-place fix
    python3 autofix_itinerary.py <guide.html> --dry-run    # report only
    python3 autofix_itinerary.py <guide.html> --verbose    # show each change

Exit codes:
    0 — no changes needed (guide was already clean)
    0 — changes applied successfully
    1 — error (input missing, transform failed, I/O)
    2 — usage error

Re-running after a successful fix is a no-op: the transform is idempotent.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

# Same tokens the validator uses. Keep in sync if the validator's list shifts.
# Sourced from validate_itinerary.py::TICKET_SIGNAL_TOKENS.
TICKET_SIGNAL_TOKENS = (
    "fast-track entry",
    "fast track entry",
    "hosted entry",
    "timed entry",
    "timed-entry",
    "rooftop pass",
    "admission",
    "ticket",  # catches "Skip-the-Line Ticket", "Museum Ticket", etc.
)

# Same tour-box extraction pattern the validator uses.
TOUR_BOX_PATTERN = re.compile(
    r'<div\b[^>]*class\s*=\s*"[^"]*\btour-box\b[^"]*"[^>]*>'
    r'(.*?)'
    r'(?=<div\b[^>]*class\s*=\s*"(?:stop-photos|tour-box|ticket-box|stop-block|next|tour-meet)\b|</section|</body)',
    re.DOTALL,
)


def _die(msg: str, code: int = 2) -> None:
    print(f"autofix_itinerary: {msg}", file=sys.stderr)
    sys.exit(code)


def _strip_tags(fragment: str) -> str:
    """Flatten HTML → plain text for token matching (matches validator)."""
    return re.sub(r'<[^>]+>', ' ', fragment)


def _first_row_text(box_inner: str) -> str:
    """Return the lowercased plain text of the first row (up to first <br>)."""
    first_row = re.split(r'<br\s*/?>', box_inner, maxsplit=1)[0]
    return _strip_tags(first_row).lower()


def _find_ticket_mislabeled_boxes(html: str) -> list[tuple[int, int, str, list[str]]]:
    """
    Scan the HTML for .tour-box blocks whose first row carries ticket-signal
    tokens. Returns a list of tuples:
        (box_start, box_end, original_box_html, matched_tokens)
    where box_start/end are offsets into `html` for the entire `<div ...>...`
    span (the tour-box open tag + its body up to the next sibling).
    """
    hits: list[tuple[int, int, str, list[str]]] = []
    for m in TOUR_BOX_PATTERN.finditer(html):
        inner = m.group(1)
        first_row_lc = _first_row_text(inner)
        matched = [t for t in TICKET_SIGNAL_TOKENS if t in first_row_lc]
        if not matched:
            continue
        hits.append((m.start(), m.end(), m.group(0), matched))
    return hits


def _transform_box(box_html: str) -> str:
    """Apply the tour-box → ticket-box transformation to a single box."""
    # 1. Class swap on the opening <div>. Handle both `tour-box` exact and
    #    `tour-box` inside a multi-class string. The validator's matcher is
    #    token-boundary-aware; we do the same with \b.
    def _swap_class(match: re.Match) -> str:
        attr = match.group(0)
        # Only flip the first occurrence of `tour-box` as a whole token.
        return re.sub(r'\btour-box\b', 'ticket-box', attr, count=1)

    new_html = re.sub(
        r'class\s*=\s*"[^"]*\btour-box\b[^"]*"',
        _swap_class,
        box_html,
        count=1,
    )

    # 2. Emoji swap: replace the FIRST 📅 inside the box with 🎟️. Scoped to
    #    the first occurrence to avoid rewriting any stray 📅 that somehow
    #    lives later in the box body.
    new_html = new_html.replace("📅", "🎟️", 1)

    return new_html


def autofix(html: str, verbose: bool = False) -> tuple[str, list[dict]]:
    """
    Apply all transformations to `html` and return (new_html, change_log).
    `change_log` is a list of dicts describing each transformation applied.
    """
    hits = _find_ticket_mislabeled_boxes(html)
    if not hits:
        return html, []

    change_log: list[dict] = []
    # Apply in reverse so earlier offsets stay valid.
    new_html = html
    for start, end, original, matched_tokens in reversed(hits):
        transformed = _transform_box(original)
        new_html = new_html[:start] + transformed + new_html[end:]

        # Extract a short label for the log — product name after 📅.
        first_row_plain = _strip_tags(
            re.split(r'<br\s*/?>', original, maxsplit=1)[0]
        )
        prod = first_row_plain.split("📅", 1)[-1].strip()
        prod = re.split(r'\s[—·]\s', prod, maxsplit=1)[0].strip()
        if len(prod) > 80:
            prod = prod[:77] + "…"

        change_log.append({
            "offset": start,
            "product": prod,
            "matched_tokens": matched_tokens,
            "action": "tour-box → ticket-box, 📅 → 🎟️",
        })

    # Restore chronological order (earliest first) for reporting.
    change_log.reverse()

    if verbose:
        for entry in change_log:
            print(
                f"  [{entry['offset']}] {entry['product']}  "
                f"(hits: {', '.join(entry['matched_tokens'])})"
            )

    return new_html, change_log


def run(src: Path, dry_run: bool = False, verbose: bool = False) -> int:
    if not src.exists():
        _die(f"input file not found: {src}", code=1)
    if src.suffix.lower() != ".html":
        _die(f"expected a .html file, got: {src.name}")

    html = src.read_text(encoding="utf-8")
    new_html, change_log = autofix(html, verbose=verbose)

    print(f"━━━ autofix_itinerary ━━━")
    print(f"  source: {src}")

    if not change_log:
        print(f"  no changes needed — file is already clean ✓")
        return 0

    print(f"  changes: {len(change_log)} tour-box → ticket-box conversion(s)")
    for entry in change_log:
        print(f"    • {entry['product']}  (hits: {', '.join(entry['matched_tokens'])})")

    if dry_run:
        print(f"  --dry-run: file NOT written. Re-run without --dry-run to apply.")
        return 0

    # Atomic write via sibling tmp file, then rename.
    tmp = src.with_suffix(src.suffix + ".tmp")
    try:
        tmp.write_text(new_html, encoding="utf-8")
        tmp.replace(src)
    except Exception as e:  # noqa: BLE001
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass
        _die(f"write failed: {e!r}", code=1)

    print(f"  wrote: {src}")
    print(f"  re-run validate_itinerary.py to confirm.")
    return 0


def main(argv: list[str]) -> int:
    dry_run = "--dry-run" in argv
    verbose = "--verbose" in argv or "-v" in argv
    positional = [a for a in argv if not a.startswith("-")]
    if len(positional) != 1:
        _die("usage: autofix_itinerary.py <guide.html> [--dry-run] [--verbose]")
    return run(Path(positional[0]).resolve(), dry_run=dry_run, verbose=verbose)


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except KeyboardInterrupt:
        print("\nautofix_itinerary: interrupted", file=sys.stderr)
        sys.exit(1)
