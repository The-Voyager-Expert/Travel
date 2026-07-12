#!/usr/bin/env python3
"""
extract_best_of_entries.py — pull every entry out of a legacy .best-of-card
Best-of page as structured JSON, for the SHOWCASE format migration.

Uses balanced <div> depth counting (not a naive non-greedy regex) so a card
with malformed/missing closing tags can't silently swallow the next card or
section label — the same technique check_best_of_css_standard uses.

Usage:
  python3 Brain/scripts/extract_best_of_entries.py Travel-Website/Trip-Essentials/Best-Beaches.html

Prints one JSON object to stdout: {"entries": [{"section", "name", "tag",
"desc", "links": [{"href","text"}, ...]}, ...]}, in on-page order.
"""

import sys
import re
import json


def extract_balanced(html_text, class_name):
    """Return [(start_index, inner_html), ...] for every <div class="{class_name}" ...>...</div>.

    Matches the opening tag by regex (allowing extra attributes after the
    class, e.g. <div class="best-of-card" data-country="Australia">) rather
    than an exact string, so a page-specific attribute variant can't cause
    entries to silently vanish.
    """
    results = []
    open_re = re.compile(r'<div class="' + re.escape(class_name) + r'"[^>]*>')
    pos = 0
    while True:
        m0 = open_re.search(html_text, pos)
        if not m0:
            break
        start = m0.start()
        cursor = m0.end()
        depth = 1
        end = None
        for m in re.finditer(r'<div\b[^>]*>|</div>', html_text[cursor:]):
            depth += -1 if m.group(0) == '</div>' else 1
            if depth == 0:
                end = cursor + m.start()
                pos = cursor + m.end()
                break
        if end is None:
            break
        results.append((start, html_text[cursor:end]))
    return results


def main():
    if len(sys.argv) != 2:
        print("usage: extract_best_of_entries.py <path-to-Best-of-page.html>", file=sys.stderr)
        sys.exit(2)

    path = sys.argv[1]
    text = open(path, encoding="utf-8").read()
    body_m = re.search(r"<body[^>]*>(.*?)</body>", text, re.DOTALL)
    body = body_m.group(1) if body_m else text

    sections = [(m.start(), m.group(1)) for m in re.finditer(
        r'<div class="best-of-section-label">([^<]+)</div>', body
    )]

    cards = extract_balanced(body, "best-of-card")

    entries = []
    for start, card in cards:
        sec = None
        for spos, slabel in sections:
            if spos < start:
                sec = slabel
            else:
                break
        name_m = re.search(r'class="best-of-name">([^<]*)</div>', card)
        tag_m = re.search(r'class="best-of-tag">([^<]*)</div>', card)
        desc_m = re.search(r'class="best-of-desc">(.*?)</div>', card, re.DOTALL)
        links = re.findall(
            r'<a class="best-of-link"\s+href="([^"]+)"[^>]*>([^<]*)</a>', card
        )
        entries.append({
            "section": sec,
            "name": (name_m.group(1) if name_m else "").strip(),
            "tag": (tag_m.group(1) if tag_m else "").strip(),
            "desc": (desc_m.group(1) if desc_m else "").strip(),
            "links": [{"href": h, "text": t.strip()} for h, t in links],
        })

    n_cards_raw = body.count('class="best-of-card"')
    if len(entries) != n_cards_raw:
        print(
            f"WARNING: found {n_cards_raw} 'best-of-card' occurrences but only "
            f"balanced-extracted {len(entries)} — some cards may have malformed/"
            f"missing closing tags (fix the source HTML first).",
            file=sys.stderr,
        )

    print(json.dumps({"entries": entries}, ensure_ascii=False))


if __name__ == "__main__":
    main()
