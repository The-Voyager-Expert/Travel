#!/usr/bin/env python3
"""
replace_best_of_grid.py — splice a newly-generated SHOWCASE grid fragment
into a Best-of page in place of its old <div class="best-of-grid">...</div>
block, using balanced-div counting to find the TRUE closing tag (never a
plain non-greedy regex, which can stop at the first inner closing div).

Usage:
  python3 Brain/scripts/replace_best_of_grid.py <page.html> <new_grid_fragment.html>

Writes the page file in place. Exits 1 (no changes made) if no
best-of-grid block is found, or if more than one is found (ambiguous).
"""

import sys
import re


def find_balanced_span(text, open_tag_re):
    m = open_tag_re.search(text)
    if not m:
        return None
    start = m.start()
    cursor = m.end()
    depth = 1
    for tm in re.finditer(r'<div\b[^>]*>|</div>', text[cursor:]):
        depth += -1 if tm.group(0) == '</div>' else 1
        if depth == 0:
            return start, cursor + tm.end()
    return None


def main():
    if len(sys.argv) != 3:
        print("usage: replace_best_of_grid.py <page.html> <new_grid_fragment.html>", file=sys.stderr)
        sys.exit(2)

    page_path, fragment_path = sys.argv[1], sys.argv[2]
    text = open(page_path, encoding="utf-8").read()
    fragment = open(fragment_path, encoding="utf-8").read().rstrip("\n")

    open_tag_re = re.compile(r'<div class="best-of-grid">')
    if len(open_tag_re.findall(text)) != 1:
        print(f"ERROR: expected exactly one <div class=\"best-of-grid\"> in {page_path}, "
              f"found {len(open_tag_re.findall(text))}", file=sys.stderr)
        sys.exit(1)

    span = find_balanced_span(text, open_tag_re)
    if span is None:
        print(f"ERROR: could not find a balanced closing </div> for the best-of-grid in {page_path}", file=sys.stderr)
        sys.exit(1)

    start, end = span
    new_text = text[:start] + fragment + text[end:]
    open(page_path, "w", encoding="utf-8").write(new_text)
    print(f"replaced best-of-grid span [{start}:{end}] ({end - start} chars) with {len(fragment)} chars", file=sys.stderr)


if __name__ == "__main__":
    main()
