#!/usr/bin/env python3
"""
build_showcase_cards.py — deterministic HTML generator for the SHOWCASE
Best-of card format migration.

Takes a JSON file of entries (each already carrying its name/tag/desc/links
verbatim from the original legacy .best-of-card page, plus a "photo" object
sourced from Wikimedia Commons and an optional "meta" list of short fact
pills) and prints the exact <div class="showcase-grid">...</div> block,
re-inserting <div class="best-of-section-label">...</div> headers wherever
the section changes from the previous entry (preserving original order —
callers must not reorder entries).

Deliberately does NOT touch text content (name/tag/desc/links are placed
verbatim, no re-escaping) — all HTML escaping was already correct in the
source page these values were extracted from.

Input JSON shape:
{
  "slug": "beaches",
  "entries": [
    {
      "section": "Australia",
      "name": "Whitehaven Beach",
      "tag": "Whitsunday Island, Australia",
      "desc": "...",
      "links": [{"href": "...", "text": "..."}, ...],
      "meta": ["Free Entry", "Best at Low Tide"],   // optional, 0-2 items
      "photo": {
        "filename": "whitehaven-beach.jpg",
        "alt": "...",
        "width": 800,
        "height": 533,
        "credit": "<!-- photo: whitehaven-beach.jpg — Wikimedia Commons CC BY-SA 4.0 · \"...\" by ... · https://commons.wikimedia.org/wiki/File:... -->"
      }
    },
    ...
  ]
}

Usage:
  python3 Brain/scripts/build_showcase_cards.py entries.json > grid_fragment.html
  python3 Brain/scripts/build_showcase_cards.py entries.json --out grid_fragment.html
"""

import sys
import json
import argparse


def build_card(entry, slug):
    photo = entry.get("photo")
    if not photo or not photo.get("filename"):
        raise ValueError(f"entry {entry.get('name')!r} has no photo data — cannot build a showcase card without one")

    lines = []
    lines.append('    <div class="showcase-card">')
    lines.append('      <div class="showcase-photo">')
    lines.append(f'        {photo["credit"]}')
    lines.append(
        f'        <img src="../assets/best-of/{slug}/{photo["filename"]}" '
        f'alt="{photo["alt"]}" loading="lazy" width="{photo["width"]}" height="{photo["height"]}">'
    )
    lines.append('      </div>')
    lines.append('      <div class="showcase-body">')
    lines.append(f'        <div class="showcase-name">{entry["name"]}</div>')
    lines.append(f'        <div class="showcase-tag">{entry["tag"]}</div>')
    meta = entry.get("meta") or []
    if meta:
        spans = "".join(f"<span>{m}</span>" for m in meta[:2])
        lines.append(f'        <div class="showcase-meta">{spans}</div>')
    lines.append(f'        <div class="showcase-desc">{entry["desc"]}</div>')
    lines.append('        <div class="showcase-links">')
    for link in entry.get("links", []):
        href = link["href"]
        text = link["text"]
        target_attrs = '' if href.startswith("../") else ' target="_blank" rel="noopener"'
        lines.append(f'          <a href="{href}"{target_attrs}>{text}</a>')
    lines.append('        </div>')
    lines.append('      </div>')
    lines.append('    </div>')
    return "\n".join(lines)


def build_grid(data):
    slug = data["slug"]
    entries = data["entries"]
    out = ['<div class="showcase-grid">', '']
    last_section = None
    for entry in entries:
        section = entry.get("section")
        if section != last_section:
            if last_section is not None:
                out.append('')
            out.append(f'    <div class="best-of-section-label">{section}</div>')
            out.append('')
            last_section = section
        out.append(build_card(entry, slug))
        out.append('')
    out.append('  </div>')
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("json_path")
    ap.add_argument("--out", help="write to this file instead of stdout")
    args = ap.parse_args()

    data = json.load(open(args.json_path, encoding="utf-8"))
    html = build_grid(data)

    missing = [e["name"] for e in data["entries"] if not (e.get("photo") or {}).get("filename")]
    if missing:
        print(f"ERROR: {len(missing)} entries missing photo data: {missing}", file=sys.stderr)
        sys.exit(1)

    if args.out:
        open(args.out, "w", encoding="utf-8").write(html)
        print(f"wrote {args.out} ({len(data['entries'])} cards)", file=sys.stderr)
    else:
        print(html)


if __name__ == "__main__":
    main()
