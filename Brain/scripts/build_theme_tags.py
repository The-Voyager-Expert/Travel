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
    "nature": "Denver,Alaska,Arenal,San José,Chiang Mai,Amalfi,Annecy,Azores,Bali,Bend,Bergen,Big Island,Boulder,Cape Cod,Capri,Chongqing,Cinque Terre,Curitiba,Cusco,Florida Keys,Florianópolis,Foz do Iguaçu,Geneva,Glacier National Park,Hong Kong,Kauai,Kyoto,La Jolla,Lake Como,Lake Tahoe,Las Vegas,Ljubljana,Lucerne,Luxembourg,Machu Picchu,Maceió,Madeira,Maldives,Manuel Antonio,Marktoberdorf,Maui,Natal,Napa,Oahu,Orcas Island,Oslo,Palm Desert,Palawan,Petra,Phoenix,Phuket,Pokhara,Portland,Puerto Rico,Queenstown,Reykjavik,Rio de Janeiro,Salzburg,San Juan Island,Santa Cruz,Santiago,São Luís,Scottsdale,Sedona,Seattle,Sintra,Sorrento,Taipei,Tromsø,Vancouver,Victoria,Wellington,Whistler,Yellowstone,Zhangjiajie,Zurich,Ålesund",
    "beach": "Abu Dhabi,Amalfi,Aracaju,Aruba,Athens,Azores,Bali,Barbados,Barcelona,Big Island,Bora Bora,Cancún,Cannes,Cape Cod,Capri,Carmel by the Sea,Cascais,Cayman Islands,Cinque Terre,Corfu,Curaçao,Dubai,Dubrovnik,Florida Keys,Florianópolis,Fortaleza,Hoi An,Hong Kong,João Pessoa,Kauai,Key West,La Jolla,Lagos,Lisbon,Los Angeles,Maceió,Madeira,Maldives,Malibu,Manuel Antonio,Marseille,Maui,Melbourne,Miami,Málaga,Monaco,Montevideo,Mykonos,Natal,Nice,Oahu,Olinda,Pensacola,Phuket,Porto,Puerto Rico,Puerto Vallarta,Recife,Rio de Janeiro,Salvador,San Diego,San Francisco,San Juan Island,San Sebastián,Santa Barbara,Santa Cruz,Santa Monica,Santorini,Sarasota,Sardinia,Seychelles,Sicily,Sint Maarten,Sorrento,Split,Sydney,São Luís,The Bahamas,Turks and Caicos,Vancouver,Virgin Islands,Ålesund",
    "islands": "Aruba,Azores,Bali,Barbados,Big Island,Bora Bora,Capri,Cayman Islands,Corfu,Curaçao,Florida Keys,Kauai,Madeira,Maldives,Maui,Mykonos,Oahu,Orcas Island,Palawan,Phuket,Puerto Rico,San Juan Island,Santorini,Sardinia,Seychelles,Sicily,Sint Maarten,Stockholm,The Bahamas,Turks and Caicos,Virgin Islands",
    "snow": "Alaska,Annecy,Bend,Lake Tahoe,Lucerne,Queenstown,Québec City,Reykjavik,Salzburg,Tromsø,Whistler",
    "foodie": "Hamburg,Denver,Aix-en-Provence,Amsterdam,Athens,Atlanta,Austin,Bangkok,Chiang Mai,Barcelona,Colombo,Beijing,Berlin,Bologna,Bordeaux,Boston,Bruges,Brussels,Budapest,Buenos Aires,Cannes,Charlotte,Chicago,Chongqing,Colmar,Copenhagen,Dallas,Dubai,Dublin,Edinburgh,Florence,Geneva,Glasgow,Gothenburg,Hanoi,Helsinki,Hoi An,Hong Kong,Istanbul,Kraków,Kyoto,Las Vegas,Lecce,Lille,Lima,Lisbon,London,Los Angeles,Luang Prabang,Lyon,Madrid,Marrakech,Marseille,Melbourne,Miami,Milan,Montréal,Munich,Málaga,Napa,Naples,Nashville,New Orleans,New York,Nice,Oaxaca,Orlando,Osaka,Palo Alto,Paris,Philadelphia,Portland,Porto,Porto Alegre,Prague,Queenstown,Québec City,Reykjavik,Rome,San Diego,San Francisco,San Jose,San Sebastián,Santa Barbara,Santiago,Sardinia,Seattle,Seoul,Seville,Shanghai,Sicily,Siena,Singapore,Sorrento,Stockholm,Strasbourg,Stuttgart,Sydney,São Paulo,Taipei,Tbilisi,Tokyo,Toronto,Turin,Vancouver,Venice,Victoria,Vienna,Wellington,Zurich",
    "history": "Abu Dhabi,Aix-en-Provence,San José,Amalfi,Amsterdam,Annecy,Aracaju,Athens,Atlanta,Bangkok,Barcelona,Beijing,Bergen,Berlin,Bologna,Bordeaux,Boston,Bruges,Brussels,Budapest,Buenos Aires,Cairo,Cambridge,Cascais,Chiang Mai,Chicago,Cinque Terre,Colmar,Colombo,Columbia,Copenhagen,Corfu,Curaçao,Curitiba,Cusco,Doha,Dublin,Dubrovnik,Edinburgh,Florence,Glasgow,Gothenburg,Hamburg,Hanoi,Helsinki,Hoi An,Istanbul,João Pessoa,Key West,Kraków,Kyoto,Lagos,Lake Como,Lecce,Lille,Lima,Lisbon,Ljubljana,London,Lucerne,Luxembourg,Luang Prabang,Lyon,Machu Picchu,Maceió,Madrid,Marrakech,Marseille,Milan,Montevideo,Montréal,Munich,Muscat,Málaga,Naples,Natal,New Orleans,New York,Oahu,Oaxaca,Olinda,Oslo,Oxford,Paris,Pasadena,Pensacola,Petra,Philadelphia,Pisa,Porto,Porto Alegre,Prague,Puerto Rico,Québec City,Recife,Rio de Janeiro,Rome,Salvador,Salzburg,San Francisco,Santiago,Santorini,Sardinia,Seoul,Seville,Shanghai,Sicily,Siena,Singapore,Sintra,Split,Stockholm,Strasbourg,Stuttgart,São Luís,São Paulo,Taipei,Tallinn,Tbilisi,Tokyo,Toledo,Turin,Turks and Caicos,Valletta,Venice,Verona,Victoria,Vienna,Washington DC,Osaka",
    "art": "Hamburg,Abu Dhabi,Doha,Aix-en-Provence,Amsterdam,Atlanta,Barcelona,Beijing,Berlin,Bologna,Boston,Bruges,Brussels,Budapest,Buenos Aires,Cambridge,Carmel by the Sea,Chicago,Copenhagen,Dallas,Edinburgh,Florence,Glasgow,Helsinki,Istanbul,Lecce,Lille,London,Los Angeles,Madrid,Melbourne,Milan,Montréal,Munich,Málaga,New York,Nice,Oslo,Oxford,Paris,Pasadena,Philadelphia,Pisa,Prague,Rome,Salzburg,San Francisco,Sarasota,São Paulo,Seattle,Seoul,Seville,Shanghai,Siena,Stockholm,Stuttgart,Sydney,Tokyo,Toledo,Toronto,Turin,Venice,Vienna,Washington DC,Wellington,Zurich",
    "nightlife": "Hamburg,Denver,Amsterdam,Austin,Bali,Bangkok,Barcelona,Berlin,Budapest,Buenos Aires,Chicago,Dubai,Hong Kong,Istanbul,Las Vegas,Lisbon,London,Los Angeles,Madrid,Melbourne,Miami,Montréal,Munich,Mykonos,Nashville,New Orleans,New York,Paris,Phuket,Prague,Rio de Janeiro,San Francisco,São Paulo,Seoul,Shanghai,Singapore,Split,Sydney,Taipei,Tokyo,Osaka",
    "wine": "Aix-en-Provence,Barcelona,Bologna,Bordeaux,Budapest,Cinque Terre,Colmar,Florence,Lyon,Madrid,Montevideo,Napa,Porto,Queenstown,Santiago,Sicily,Siena,Strasbourg,Stuttgart,Tbilisi,Turin,Verona,Vienna,Wellington",
    "amusement": "Orlando,Los Angeles,Tokyo,Paris,Copenhagen,Abu Dhabi,Dubai,San Diego,Singapore,Hong Kong,Shanghai,Beijing,Gothenburg",
    "kids": "Orlando,San Diego,Los Angeles,Singapore,Tokyo,Copenhagen,Paris,Abu Dhabi,Dubai,Gothenburg,Hong Kong,Barcelona,London,Boston,Chicago,Atlanta,Washington DC,Vancouver,Sydney,Seattle,Santa Monica,Santa Cruz",
}
ORDER = ["nature", "beach", "islands", "snow", "foodie", "history", "art", "nightlife", "wine", "amusement", "kids"]

# Flat taxonomy — every chip is an independent leaf, with ONE dependency:
# every island is also a beach, so a city tagged `islands` also carries `beach`
# (not the reverse; Beach shows beaches+islands, Islands is the strict subset).
# Nothing else cascades — nature (forests), snow, foodie, history, art … are all
# independent. CURATED holds primary membership; _propagate lifts islands→beach.
# (`nature` surfaces in the UI as the "Forests" chip; the tag key stays `nature`.)
PARENTS = {"islands": ["beach"]}


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
        import crib_safety as _cs  # atomic: readers never see a half-written page
        _cs.atomic_write(INDEX, new)
        print("  ✓ THEME_DATA written to Guides-Index.html")
    return 0


if __name__ == "__main__":
    sys.exit(main())
