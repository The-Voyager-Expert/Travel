#!/usr/bin/env python3
"""
build_search_index.py — Global guide content search index generator.

Parses every shipped guide HTML under Travel-Website/Guides/{City}/ and emits a
compact JSON at Travel-Website/assets/search_index.json. The Guides-Index.html
search box lazy-loads this file to offer full-text search across guide content
(stops, venues, tours, restaurants, sections) that deep-links into each guide.

Run from the Travel root:  python3 Brain/scripts/build_search_index.py
Re-run after shipping or editing any guide so the index stays fresh.

Reads guide files only to build the index (the one sanctioned reason to read
frozen Guides/ — never used as a format template). Writes only the JSON.
"""
import os, re, json, html, sys
from datetime import date

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SITE = os.path.join(ROOT, "Travel-Website")
GUIDES = os.path.join(SITE, "Guides")
INDEX = os.path.join(GUIDES, "Guides-Index.html")
OUT = os.path.join(SITE, "assets", "search_index.json")

# Section id -> human label. day\d+ handled specially on the client ("Day N").
LABELS = {
    "weekly-closures": "Weekly Closures",
    "tours": "Tours",
    "getting-around": "Getting Around",
    "cappuccino": "Cappuccino",
    "restaurants": "Restaurants Near Hotel",
    "downtown": "Downtown Restaurants",
    "local-tastes": "Local Tastes",
    "food-delivery": "Food Delivery",
    "michelin": "Michelin",
    "shows": "Shows",
    "stations-near-hotel": "Train Stations",
    "day-trips-by-train": "Day Trips by Train",
    "pickleball": "Pickleball",
    "heads-up": "Heads Up",
    "skip-list": "Skip List",
    "overview": "Overview",
}
SECTION_IDS = set(LABELS.keys())

# Generic ticket-box / booking boilerplate that shows up as <strong> in some guides.
# Dropped only on an EXACT match (lowercased) so real venue names are never lost.
SKIP_EXACT = {
    "guided tour", "admission ticket", "entry ticket", "visitor entry",
    "cathedral visitor entry", "general admission", "priority access",
    "skip-the-line", "skip the line", "fast track", "fast-track",
    "audio guide", "self-guided", "ticket", "tickets", "entry",
    "guided visit", "standard ticket", "combo ticket", "day pass",
}

def strip_tags(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()

def card_map():
    """href -> clean display city name, from the index cards."""
    with open(INDEX, encoding="utf-8") as f:
        t = f.read()
    out = {}
    for a in re.finditer(r'<a\b[^>]*class="[^"]*dest-card[^"]*"[^>]*>(.*?)</a>', t, re.S):
        block = a.group(0)
        hm = re.search(r'href="([^"]+)"', block)
        nm = re.search(r'class="dest-name"[^>]*>(.*?)</span>', block, re.S)
        if not hm:
            continue
        href = hm.group(1).lstrip("./")
        name = strip_tags(nm.group(1)) if nm else href.split("/")[0]
        out[href] = name
    return out

# One scanner regex, document order preserved: section ids + the three entry kinds.
SCAN = re.compile(
    r'id="(?P<sid>[a-z0-9\-]+)"'
    r'|<span class="stop-name[^"]*">(?P<stop>.*?)</span>'
    r'|class="extras-title"[^>]*>(?P<sec>.*?)</'
    r'|<strong>(?P<v>.*?)</strong>',
    re.S,
)

def parse_guide(path):
    with open(path, encoding="utf-8") as f:
        t = f.read()
    # drop the toolbar/script noise tail lightly; scan whole body is fine.
    cur = "overview"
    seen = set()
    entries = []
    for m in SCAN.finditer(t):
        sid = m.group("sid")
        if sid is not None:
            if sid in SECTION_IDS or re.match(r"^day\d+$", sid):
                cur = sid
            continue
        raw = m.group("stop") or m.group("sec") or m.group("v")
        if raw is None:
            continue
        txt = strip_tags(raw)
        if m.group("sec"):
            # section heading: strip leading emoji/symbols, keep label words
            txt = re.sub(r"^[^\w]+", "", txt).strip()
        if len(txt) < 2 or len(txt) > 90:
            continue
        if not re.search(r"[A-Za-z]", txt):
            continue
        key = txt.lower()
        if key in SKIP_EXACT:
            continue
        if key in seen:
            continue
        seen.add(key)
        entries.append([txt, cur])
    return entries

def main():
    cards = card_map()
    guides = []
    total = 0
    missing = 0
    for href, city in sorted(cards.items()):
        path = os.path.join(GUIDES, href)
        if not os.path.isfile(path):
            missing += 1
            continue
        entries = parse_guide(path)
        if not entries:
            continue
        guides.append({"c": city, "u": href, "e": entries})
        total += len(entries)
    payload = {
        "generated": date.today().isoformat(),
        "labels": LABELS,
        "guides": guides,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    size = os.path.getsize(OUT)
    print(f"✓ search_index.json — {len(guides)} guides · {total} entries · "
          f"{size/1024:.0f} KB  ({missing} cards skipped, no file)")

if __name__ == "__main__":
    main()
