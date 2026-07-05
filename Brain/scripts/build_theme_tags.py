#!/usr/bin/env python3
"""build_theme_tags.py — maintain the Trip-type (theme) filter dataset on the guides index.

The 🎯 Trip type filter on Guides-Index.html lets visitors narrow ~155 guides by the
*kind* of trip (beach, wine, ski …) instead of by name. Each guide carries a curated
set of theme tags, baked into the page as `var THEME_DATA = {...};`.

Tags were bootstrapped by auto-deriving from guide content (stop names + sections),
then hand-corrected — so the CURATED lists below are the source of truth, NOT a live
re-scan. Adding a new guide? Add its city to the relevant theme lists here and run
`--apply`. A guide absent from every list is simply untagged (never surfaces under a
theme chip) — that's a soft miss, not a breakage.

Usage:
  python3 Brain/scripts/build_theme_tags.py            # report: counts, untagged, bad names
  python3 Brain/scripts/build_theme_tags.py --apply    # rewrite THEME_DATA in Guides-Index.html
"""
import json
import re
import sys
from html import unescape
from pathlib import Path

INDEX = Path(__file__).resolve().parents[2] / "Travel-Website" / "Guides" / "Guides-Index.html"

# ── Curated theme membership (source of truth) ──────────────────────────────
CURATED = {
    "nature": "Denver,Alaska,Arenal,Chiang Mai,Amalfi,Annecy,Azores,Bali,Bend,Bergen,Big Island,Boulder,Capri,Chongqing,Cinque Terre,Cusco,Foz do Iguaçu,Geneva,Hong Kong,Kauai,Kyoto,La Jolla,Lake Como,Las Vegas,Ljubljana,Lucerne,Luxembourg,Machu Picchu,Madeira,Maldives,Manuel Antonio,Marktoberdorf,Maui,Natal,Napa,Oahu,Orcas Island,Oslo,Palm Desert,Palawan,Petra,Phoenix,Phuket,Portland,Puerto Rico,Queenstown,Reykjavik,Rio de Janeiro,Salzburg,Santa Cruz,Santiago,São Luís,Scottsdale,Seattle,Sintra,Sorrento,Taipei,Tromsø,Vancouver,Victoria,Wellington,Whistler,Zhangjiajie,Zurich,Ålesund",
    "beach": "Abu Dhabi,Amalfi,Aruba,Athens,Azores,Bali,Barbados,Barcelona,Big Island,Cannes,Capri,Carmel-by-the-Sea,Cascais,Cayman Islands,Cinque Terre,Corfu,Curaçao,Dubai,Dubrovnik,Fortaleza,Hoi An,Natal,Olinda,Hong Kong,Kauai,La Jolla,Lagos,Lisbon,Los Angeles,Madeira,Maldives,Malibu,Manuel Antonio,Marseille,Maui,Melbourne,Miami,Monaco,Montevideo,Mykonos,Nice,Oahu,Phuket,Porto,Puerto Rico,Rio de Janeiro,San Diego,San Francisco,San Sebastián,Santa Barbara,Santa Cruz,Santa Monica,Santorini,São Luís,Sint Maarten,Sorrento,Split,Sydney,The Bahamas,Turks and Caicos,Vancouver,Virgin Islands,Ålesund",
    "islands": "Aruba,Azores,Bali,Barbados,Big Island,Capri,Cayman Islands,Corfu,Curaçao,Kauai,Madeira,Maldives,Maui,Mykonos,Oahu,Orcas Island,Palawan,Phuket,Puerto Rico,Santorini,Sint Maarten,Stockholm,The Bahamas,Turks and Caicos,Virgin Islands",
    "snow": "Alaska,Annecy,Bend,Lucerne,Queenstown,Québec City,Reykjavik,Salzburg,Tromsø,Whistler",
    "foodie": "Hamburg,Denver,Aix-en-Provence,Amsterdam,Athens,Atlanta,Austin,Bangkok,Chiang Mai,Barcelona,Colombo,Beijing,Berlin,Bologna,Bordeaux,Boston,Bruges,Brussels,Budapest,Buenos Aires,Cannes,Charlotte,Chicago,Chongqing,Colmar,Copenhagen,Dallas,Dubai,Dublin,Edinburgh,Florence,Geneva,Glasgow,Gothenburg,Helsinki,Hoi An,Hong Kong,Istanbul,Kyoto,Las Vegas,Lille,Lima,Lisbon,London,Los Angeles,Lyon,Madrid,Marrakech,Marseille,Melbourne,Miami,Milan,Montréal,Munich,Napa,Nashville,New Orleans,New York,Nice,Orlando,Palo Alto,Paris,Philadelphia,Portland,Porto,Porto Alegre,Prague,Queenstown,Québec City,Reykjavik,Rome,San Diego,San Francisco,San Jose,San Sebastián,Santa Barbara,Santiago,Seattle,Seoul,Seville,Shanghai,Siena,Singapore,Sorrento,Stockholm,Strasbourg,Stuttgart,Sydney,Taipei,Tokyo,Toronto,Turin,Vancouver,Venice,Victoria,Vienna,Wellington,Zurich",
    "history": "Cairo,Hamburg,Abu Dhabi,Aix-en-Provence,Amalfi,Amsterdam,Petra,Annecy,Athens,Atlanta,Bangkok,Chiang Mai,Barcelona,Beijing,Bergen,Colombo,Berlin,Bologna,Bordeaux,Boston,Bruges,Brussels,Budapest,Buenos Aires,Cambridge,Cascais,Chicago,Cinque Terre,Colmar,Columbia,Copenhagen,Corfu,Curaçao,Cusco,Dublin,Dubrovnik,Edinburgh,Florence,Glasgow,Gothenburg,Helsinki,Hoi An,Istanbul,Kyoto,Lagos,Lake Como,Lille,Lima,Lisbon,Ljubljana,London,Lucerne,Luxembourg,Lyon,Machu Picchu,Madrid,Marrakech,Marseille,Milan,Montevideo,Montréal,Munich,Natal,New Orleans,New York,Oahu,Olinda,Oslo,Oxford,Paris,Pasadena,Philadelphia,Pisa,Porto,Porto Alegre,Prague,Puerto Rico,Québec City,Rio de Janeiro,Rome,Salzburg,San Francisco,Santiago,Santorini,Seoul,Seville,Shanghai,Siena,Singapore,Sintra,Split,Stockholm,Strasbourg,Stuttgart,Taipei,Tallinn,Tokyo,Toledo,Turin,Turks and Caicos,Venice,Verona,Victoria,Vienna,Washington DC,São Luís",
    "art": "Hamburg,Abu Dhabi,Aix-en-Provence,Amsterdam,Atlanta,Barcelona,Beijing,Berlin,Bologna,Boston,Bruges,Brussels,Budapest,Buenos Aires,Cambridge,Carmel-by-the-Sea,Chicago,Copenhagen,Edinburgh,Florence,Glasgow,Helsinki,Istanbul,Lille,London,Los Angeles,Madrid,Melbourne,Milan,Montréal,Munich,New York,Nice,Oslo,Oxford,Paris,Pasadena,Philadelphia,Pisa,Prague,Rome,Salzburg,San Francisco,Seattle,Seoul,Seville,Shanghai,Siena,Stockholm,Stuttgart,Sydney,Tokyo,Toledo,Toronto,Turin,Venice,Vienna,Washington DC,Wellington,Zurich",
    "nightlife": "Hamburg,Denver,Amsterdam,Austin,Bali,Bangkok,Barcelona,Berlin,Budapest,Buenos Aires,Chicago,Dubai,Hong Kong,Istanbul,Las Vegas,Lisbon,London,Los Angeles,Madrid,Melbourne,Miami,Montréal,Munich,Mykonos,Nashville,New Orleans,New York,Paris,Phuket,Prague,Rio de Janeiro,San Francisco,Seoul,Shanghai,Singapore,Split,Sydney,Taipei,Tokyo",
    "wine": "Aix-en-Provence,Barcelona,Bologna,Bordeaux,Budapest,Cinque Terre,Colmar,Florence,Lyon,Madrid,Montevideo,Napa,Porto,Queenstown,Santiago,Siena,Strasbourg,Stuttgart,Turin,Verona,Vienna,Wellington",
    "amusement": "Orlando,Los Angeles,Tokyo,Paris,Copenhagen,Abu Dhabi,Dubai,San Diego,Singapore,Hong Kong,Shanghai,Beijing,Gothenburg",
    "kids": "Orlando,San Diego,Los Angeles,Singapore,Tokyo,Copenhagen,Paris,Abu Dhabi,Dubai,Gothenburg,Hong Kong,Barcelona,London,Boston,Chicago,Atlanta,Washington DC,Vancouver,Sydney,Seattle,Santa Monica,Santa Cruz",
}
ORDER = ["outdoor", "nature", "beach", "islands", "snow", "foodie", "history", "art", "nightlife", "wine", "amusement", "kids"]

# Containment hierarchy (additive): a city tagged with a child theme also carries
# its parents, so parents act as umbrellas in the filter.
#   🏞 outdoor  ⊃  nature(inland) · beach(⊃ islands) · snow
# CURATED holds only PRIMARY leaf membership (nature/beach/islands/snow/foodie/
# history/art); _propagate derives the `outdoor` umbrella + lifts islands→beach.
# Selecting Outdoor shows every natural-scenery city; Beach shows beaches+islands;
# Islands is most specific; foodie/history/art are independent.
PARENTS = {"islands": ["beach"], "beach": ["outdoor"], "nature": ["outdoor"], "snow": ["outdoor"]}


def card_names(html: str) -> set:
    names = set()
    for cm in re.finditer(r'<div class="country" data-country="[^"]+">(.*?)</div>\s*</div>', html, re.S):
        for a in re.finditer(r'<span class="dest-name">([^<]+)</span>', cm.group(1)):
            names.add(unescape(a.group(1)))
    return names


def _propagate(tags: list) -> list:
    """Add parent themes for any child present (transitively), kept in ORDER."""
    out = set(tags)
    changed = True
    while changed:
        changed = False
        for t in list(out):
            for p in PARENTS.get(t, []):
                if p not in out:
                    out.add(p)
                    changed = True
    return [t for t in ORDER if t in out]


def build(names: set):
    data, bad = {}, []
    for tag in CURATED:
        for c in (x.strip() for x in CURATED[tag].split(",")):
            if c not in names:
                bad.append((tag, c))
            else:
                data.setdefault(c, []).append(tag)
    return {c: _propagate(data[c]) for c in sorted(data)}, bad


def main():
    html = INDEX.read_text(encoding="utf-8")
    names = card_names(html)
    data, bad = build(names)
    counts = {t: sum(1 for v in data.values() if t in v) for t in ORDER}
    untagged = sorted(c for c in names if c not in data)
    print(f"theme tags — {len(data)}/{len(names)} guides tagged")
    print("  counts:", counts)
    if untagged:
        print(f"  untagged ({len(untagged)}): {', '.join(untagged)}")
    if bad:
        print("  ✗ UNKNOWN NAMES (not a real card — fix CURATED):", bad)
        return 1
    if "--apply" in sys.argv:
        obj = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        new, n = re.subn(r"var THEME_DATA = \{.*?\};", "var THEME_DATA = " + obj + ";", html, count=1, flags=re.S)
        if n != 1:
            print("  ✗ could not find `var THEME_DATA = {...};` to replace")
            return 1
        INDEX.write_text(new, encoding="utf-8")
        print("  ✓ THEME_DATA written to Guides-Index.html")
    return 0


if __name__ == "__main__":
    sys.exit(main())
