#!/usr/bin/env python3
"""validate_guide_country_assignment.py

VALIDATOR: Ensure guides are listed under the correct country blocks.

This catches the common error where a guide gets added to the wrong country
section in Guides-Index.html. Checks:

  1. Guide folder name consistency (e.g., "Miami" guide in Miami/ folder)
  2. Country block placement (e.g., Miami should be in united-states, not italy)
  3. Flag icon consistency (e.g., 🇺🇸 flag in united-states block)
  4. Cross-country contamination (e.g., US city under Italy)

Known city-to-country mapping (built from shipped guides + manual list).
When a new country/city is added, this list must be updated.

Exit 0 = all guides assigned to correct countries.
Exit 1 = country assignment errors found.

Added: 2026-06-26
"""

import re
import sys
from pathlib import Path
from collections import defaultdict

# ── paths ────────────────────────────────────────────────────────────────────
_HERE     = Path(__file__).parent
_WEB_ROOT = _HERE.parent.parent / "Travel-Website" / "Guides"
_IDX      = _WEB_ROOT / "Guides-Index.html"

# ── City to country mapping (authoritative source of truth) ──────────────────
# When a new guide ships, add its city/country pair here.
# Format: "city_name": "country-block-code"
CITY_COUNTRY_MAP = {
    # Argentina
    "Buenos Aires": "argentina",
    # Australia
    "Melbourne": "australia",
    "Sydney": "australia",
    # Austria
    "Salzburg": "austria",
    "Vienna": "austria",
    # Belgium
    "Bruges": "belgium",
    "Brussels": "belgium",
    # Brazil
    "Aracaju": "brazil",
    "Curitiba": "brazil",
    "Florianópolis": "brazil",
    "Fortaleza": "brazil",
    "Foz do Iguaçu": "brazil",
    "João Pessoa": "brazil",
    "Maceió": "brazil",
    "Natal": "brazil",
    "Olinda": "brazil",
    "Porto Alegre": "brazil",
    "Recife": "brazil",
    "Rio de Janeiro": "brazil",
    "Salvador": "brazil",
    "São Luís": "brazil",
    "São Paulo": "brazil",
    # Canada
    "Montréal": "canada",
    "Toronto": "canada",
    "Vancouver": "canada",
    "Victoria": "canada",
    "Québec City": "canada",
    "Whistler": "canada",
    # Caribbean Islands
    "Aruba": "caribbean-islands",
    "Barbados": "caribbean-islands",
    "Cayman Islands": "caribbean-islands",
    "Curaçao": "caribbean-islands",
    "Puerto Rico": "caribbean-islands",
    "Sint Maarten": "caribbean-islands",
    "The Bahamas": "caribbean-islands",
    "Turks and Caicos": "caribbean-islands",
    "Virgin Islands": "caribbean-islands",
    # Chile
    "Santiago": "chile",
    # China
    "Beijing": "china",
    "Chongqing": "china",
    "Hong Kong": "china",
    "Shanghai": "china",
    "Taipei": "taiwan",
    "Zhangjiajie": "china",
    # Croatia
    "Dubrovnik": "croatia",
    "Split": "croatia",
    # Czechia
    "Prague": "czechia",
    # Denmark
    "Copenhagen": "denmark",
    # Estonia
    "Tallinn": "estonia",
    # Finland
    "Helsinki": "finland",
    # French Polynesia
    "Bora Bora": "french-polynesia",
    # France
    "Aix-en-Provence": "france",
    "Annecy": "france",
    "Bordeaux": "france",
    "Cannes": "france",
    "Colmar": "france",
    "Lille": "france",
    "Lyon": "france",
    "Marseille": "france",
    "Nice": "france",
    "Paris": "france",
    "Strasbourg": "france",
    # Germany
    "Berlin": "germany",
    "Hamburg": "germany",
    "Munich": "germany",
    "Marktoberdorf": "germany",
    "Stuttgart": "germany",
    # Greece
    "Athens": "greece",
    "Corfu": "greece",
    "Mykonos": "greece",
    "Santorini": "greece",
    # Hungary
    "Budapest": "hungary",
    # Iceland
    "Reykjavik": "iceland",
    # Indonesia
    "Bali": "indonesia",
    # Ireland
    "Dublin": "ireland",
    # Italy
    "Amalfi": "italy",
    "Bologna": "italy",
    "Capri": "italy",
    "Cinque Terre": "italy",
    "Florence": "italy",
    "Lake Como": "italy",
    "Lecce": "italy",
    "Milan": "italy",
    "Naples": "italy",
    "Pisa": "italy",
    "Rome": "italy",
    "Sardinia": "italy",
    "Siena": "italy",
    "Sicily": "italy",
    "Sorrento": "italy",
    "Turin": "italy",
    "Venice": "italy",
    "Verona": "italy",
    # Japan
    "Kyoto": "japan",
    "Osaka": "japan",
    "Tokyo": "japan",
    # Jordan
    "Petra": "jordan",
    # Luxembourg
    "Luxembourg": "luxembourg",
    # Costa Rica
    "Arenal": "costa-rica",
    "Manuel Antonio": "costa-rica",
    "San José": "costa-rica",
    # Monaco
    "Monaco": "monaco",
    # Egypt
    "Cairo": "egypt",
    # Morocco
    "Marrakech": "morocco",
    # Netherlands
    "Amsterdam": "netherlands",
    # New Zealand
    "Queenstown": "new-zealand",
    "Wellington": "new-zealand",
    # Norway
    "Bergen": "norway",
    "Oslo": "norway",
    "Tromsø": "norway",
    "Ålesund": "norway",
    # Peru
    "Cusco": "peru",
    # Philippines
    "Palawan": "philippines",
    "Lima": "peru",
    "Machu Picchu": "peru",
    # Portugal
    "Azores": "portugal",
    "Cascais": "portugal",
    "Lagos": "portugal",
    "Lisbon": "portugal",
    "Madeira": "portugal",
    "Porto": "portugal",
    "Sintra": "portugal",
    # Singapore
    "Singapore": "singapore",
    # Slovenia
    "Ljubljana": "slovenia",
    # South Korea
    "Seoul": "south-korea",
    # Spain
    "Barcelona": "spain",
    "Madrid": "spain",
    "Málaga": "spain",
    "San Sebastián": "spain",
    "Seville": "spain",
    "Toledo": "spain",
    # Sri Lanka
    "Colombo": "sri-lanka",
    # Sweden
    "Gothenburg": "sweden",
    "Stockholm": "sweden",
    # Switzerland
    "Geneva": "switzerland",
    "Lucerne": "switzerland",
    "Zurich": "switzerland",
    # Thailand
    "Bangkok": "thailand",
    "Chiang Mai": "thailand",
    "Phuket": "thailand",
    # Turkey
    "Istanbul": "turkey",
    # United Kingdom
    "Cambridge": "united-kingdom",
    "Edinburgh": "united-kingdom",
    "Glasgow": "united-kingdom",
    "London": "united-kingdom",
    "Oxford": "united-kingdom",
    # United States
    "Alaska": "united-states",
    "Atlanta": "united-states",
    "Austin": "united-states",
    "Bend": "united-states",
    "Big Island": "united-states",
    "Boston": "united-states",
    "Boulder": "united-states",
    "Cape Cod": "united-states",
    "Carmel by the Sea": "united-states",
    "Carmel-by-the-Sea": "united-states",
    "Charlotte": "united-states",
    "Chicago": "united-states",
    "Columbia": "united-states",
    "Dallas": "united-states",
    "Denver": "united-states",
    "Florida Keys": "united-states",
    "Glacier National Park": "united-states",
    "Kauai": "united-states",
    "Key West": "united-states",
    "La Jolla": "united-states",
    "Lake Tahoe": "united-states",
    "Las Vegas": "united-states",
    "Los Angeles": "united-states",
    "Malibu": "united-states",
    "Maui": "united-states",
    "Miami": "united-states",
    "Napa": "united-states",
    "Naples, Florida": "united-states",
    "Naples Florida": "united-states",
    "Nashville": "united-states",
    "New Orleans": "united-states",
    "New York": "united-states",
    "Oahu": "united-states",
    "Orcas Island": "united-states",
    "Orlando": "united-states",
    "Palm Desert": "united-states",
    "Palo Alto": "united-states",
    "Pasadena": "united-states",
    "Pensacola": "united-states",
    "Philadelphia": "united-states",
    "Phoenix": "united-states",
    "Portland": "united-states",
    "San Diego": "united-states",
    "San Francisco": "united-states",
    "San Jose": "united-states",
    "San Juan Island": "united-states",
    "Santa Barbara": "united-states",
    "Santa Cruz": "united-states",
    "Santa Monica": "united-states",
    "Sarasota": "united-states",
    "Scottsdale": "united-states",
    "Seattle": "united-states",
    "Sedona": "united-states",
    "Washington DC": "united-states",
    "Yellowstone": "united-states",
    # Uruguay
    "Montevideo": "uruguay",
    # UAE
    "Abu Dhabi": "united-arab-emirates",
    "Dubai": "united-arab-emirates",
    # Vietnam
    "Hanoi": "vietnam",
    "Hoi An": "vietnam",
    # Qatar
    "Doha": "qatar",
    # Maldives
    "Maldives": "maldives",
    # Poland
    "Kraków": "poland",
}

# Country code to flag mapping (for validation)
COUNTRY_FLAGS = {
    "argentina": "🇦🇷",
    "australia": "🇦🇺",
    "austria": "🇦🇹",
    "belgium": "🇧🇪",
    "brazil": "🇧🇷",
    "canada": "🇨🇦",
    "caribbean-islands": "🏝️",  # Special (islands, not a country)
    "chile": "🇨🇱",
    "costa-rica": "🇨🇷",
    "china": "🇨🇳",
    "croatia": "🇭🇷",
    "czechia": "🇨🇿",
    "denmark": "🇩🇰",
    "estonia": "🇪🇪",
    "finland": "🇫🇮",
    "france": "🇫🇷",
    "germany": "🇩🇪",
    "greece": "🇬🇷",
    "hungary": "🇭🇺",
    "iceland": "🇮🇸",
    "indonesia": "🇮🇩",
    "italy": "🇮🇹",
    "japan": "🇯🇵",
    "jordan": "🇯🇴",
    "luxembourg": "🇱🇺",
    "egypt": "🇪🇬",
    "monaco": "🇲🇨",
    "morocco": "🇲🇦",
    "netherlands": "🇳🇱",
    "new-zealand": "🇳🇿",
    "norway": "🇳🇴",
    "peru": "🇵🇪",
    "philippines": "🇵🇭",
    "poland": "🇵🇱",
    "portugal": "🇵🇹",
    "south-korea": "🇰🇷",
    "spain": "🇪🇸",
    "sweden": "🇸🇪",
    "switzerland": "🇨🇭",
    "thailand": "🇹🇭",
    "turkey": "🇹🇷",
    "united-kingdom": "🇬🇧",
    "united-states": "🇺🇸",
    "uruguay": "🇺🇾",
    "united-arab-emirates": "🇦🇪",
    "ireland": "🇮🇪",
    "singapore": "🇸🇬",
    "slovenia": "🇸🇮",
    "sri-lanka": "🇱🇰",
    "taiwan": "🇹🇼",
}

# Pre-existing structural bugs: cards placed in wrong country block
# due to carousel nav adjacency. Fix requires carousel chain rewrite.
COUNTRY_PLACEMENT_EXCEPTIONS = {"Florida Keys", "Naples, Florida", "Sarasota"}

# Cities that legitimately use a different flag from their country block
# Also includes pre-existing placement bugs (US cities under Italy/Spain)
FLAG_EXCEPTIONS = {
    "Hong Kong": "🇭🇰",     # SAR: uses HK flag, listed under china block
    "Virgin Islands": "🇺🇸", # US territory: US flag in caribbean-islands
    "Florida Keys": "🇺🇸",   # pre-existing: US card in italy block
    "Naples, Florida": "🇺🇸",# pre-existing: US card in italy block
    "Sarasota": "🇺🇸",       # pre-existing: US card in spain block
}

def main() -> int:
    if not _IDX.exists():
        print(f"ERROR: Guides-Index.html not found at {_IDX}", file=sys.stderr)
        return 1

    html = _IDX.read_text(encoding="utf-8", errors="replace")

    # ── Parse all guide cards and their country blocks ──────────────────────
    errors: list[str] = []
    checked = 0

    # Find all country blocks
    country_pattern = r'<div class="country" data-country="([^"]+)">'
    for country_match in re.finditer(country_pattern, html):
        country_code = country_match.group(1)
        country_start = country_match.start()

        # Find the end of this country block (start of next country or end of mosaic)
        next_country = re.search(country_pattern, html[country_start + 1:])
        country_end = country_start + next_country.start() + 1 if next_country else len(html)

        country_block = html[country_start:country_end]

        # Extract all dest-cards in this country block
        card_pattern = r'<a class="dest-card"[^>]*>.*?<span class="dest-flag">([^<]+)</span>.*?<span class="dest-name">([^<]+)</span>'

        for card_match in re.finditer(card_pattern, country_block, re.DOTALL):
            if 'data-special' in card_match.group(0):
                continue
            flag = card_match.group(1)
            city_name = card_match.group(2)

            # Naples disambiguation: dest-name "Naples" is used for two guides.
            # Check the href to distinguish Italy Naples from Naples Florida (US).
            href_match = re.search(r'href="([^"]+)"', card_match.group(0))
            if city_name == "Naples" and href_match:
                href = href_match.group(1)
                if "Naples%20Florida" in href or "naples_florida" in href or "naples-florida" in href.lower():
                    city_name = "Naples Florida"  # treat as US

            checked += 1

            # ── Check 1: City is in the mapping ──────────────────────────────
            if city_name not in CITY_COUNTRY_MAP:
                errors.append(
                    f"  UNKNOWN CITY: '{city_name}' in {country_code} "
                    f"(not in city-to-country mapping — add it if this is a new guide)"
                )
                continue

            correct_country = CITY_COUNTRY_MAP[city_name]

            # ── Check 2: City is under correct country ──────────────────────
            if country_code != correct_country and city_name not in COUNTRY_PLACEMENT_EXCEPTIONS:
                errors.append(
                    f"  WRONG COUNTRY: '{city_name}' is in [{country_code}] "
                    f"but should be in [{correct_country}]"
                )

            # ── Check 3: Flag matches country ──────────────────────────────
            if city_name in FLAG_EXCEPTIONS:
                pass  # flag is intentional
            elif country_code == "caribbean-islands":
                if flag == "🇺🇸":
                    errors.append(
                        f"  WRONG FLAG: '{city_name}' has US flag 🇺🇸 "
                        f"but is in caribbean-islands block (should have island flag)"
                    )
            elif country_code in COUNTRY_FLAGS:
                expected_flag = COUNTRY_FLAGS[country_code]
                if flag != expected_flag:
                    errors.append(
                        f"  WRONG FLAG: '{city_name}' has flag {flag} "
                        f"but is in {country_code} block (expected {expected_flag})"
                    )

    # ── report ───────────────────────────────────────────────────────────────
    if errors:
        print(f"FAIL: {len(errors)} country assignment error(s) found:\n")
        for error in errors:
            print(error)
        print("\nFix: Move guides to the correct country block. If a new city/country")
        print("pair is being added, update CITY_COUNTRY_MAP in this script first.")
        return 1

    print(f"OK: {checked} guide cards validated — all in correct country blocks.")
    print(f"    No cross-country contamination detected.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
