#!/usr/bin/env python3
"""
validate_currency.py — integrity check for the Currency Guide.

Verifies, with no network:
  1. The country set on the page is EXACTLY the set of countries in the guide
     index (guides_index.html) — no more, no less. Every guide city maps to one
     country block; no orphan cities; no extra countries.
  2. The page exists and carries the "Last update <Mon Year>" stat pill.
  3. The "Last update" month is not stale — it should be the current month or
     later (the monthly refresh keeps it current). Stale => non-zero exit so the
     monthly task knows to rebuild.

Exit 0 = all good. Exit 1 = a check failed (details printed).

Run standalone, or as part of the monthly refresh after build_currency.py.
"""
import os, re, sys, importlib.util, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
TRAVEL = os.path.abspath(os.path.join(HERE, "..", ".."))
INDEX = os.path.join(TRAVEL, "Travel-Website", "Guides", "guides_index.html")
PAGE = os.path.join(TRAVEL, "Travel-Website", "Trip-Essentials", "Currency-Guide.html")
SCRIPT = os.path.join(HERE, "build_currency.py")

MONTHS = {m: i for i, m in enumerate(
    ["January","February","March","April","May","June","July","August",
     "September","October","November","December"], 1)}


def load_countries():
    spec = importlib.util.spec_from_file_location("bc", SCRIPT)
    bc = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bc)
    return bc.COUNTRIES


def index_cities():
    html = open(INDEX, encoding="utf-8").read()
    return set(re.findall(
        r'dest-flag">[^<]+</span><span class="dest-name">([^<]+)</span>', html))


def main():
    fails = []

    # ---- 1. country/city coverage matches the index exactly ----
    countries = load_countries()
    page_cities = set()
    dupes = []
    for row in countries:
        for c in row[7]:
            if c in page_cities:
                dupes.append(c)
            page_cities.add(c)
    idx = index_cities()
    missing = sorted(idx - page_cities)     # in index, not on page
    extra = sorted(page_cities - idx)       # on page, not in index
    if missing:
        fails.append(f"cities in guide index but missing from Currency Guide: {missing}")
    if extra:
        fails.append(f"cities on Currency Guide not in guide index: {extra}")
    if dupes:
        fails.append(f"city listed under more than one country: {sorted(set(dupes))}")

    # ---- 2 & 3. page exists, has the stat pill, and is not stale ----
    if not os.path.exists(PAGE):
        fails.append(f"page not found: {PAGE} (run build_currency.py)")
    else:
        html = open(PAGE, encoding="utf-8").read()
        m = re.search(r'class="updated-stamp">Updated\s+([A-Z][a-z]+)\s+(\d{4})<', html)
        if not m:
            fails.append('"Updated <Month Year>" updated-stamp not found on page')
        else:
            mon, yr = MONTHS[m.group(1)], int(m.group(2))
            page_ym = yr * 12 + mon
            now = datetime.date.today()
            now_ym = now.year * 12 + now.month
            if page_ym < now_ym:
                fails.append(
                    f'"Updated {m.group(1)} {yr}" is stale (current month is '
                    f'{now.strftime("%b %Y")}) — rerun build_currency.py to refresh')

        # ---- 4. locked formatting — fail on any drift (see Essentials Pages - Rules.md) ----
        non_usd = sum(1 for r in countries if r[5] != "USD")
        must_have = {
            "index header = Country | Currency | Sym | US$1":
                '<thead><tr><th>Country</th><th>Currency</th>'
                '<th class="sym-col">Sym</th><th>US$1</th></tr></thead>',
            "index colgroup 28/40/12/20":
                '<colgroup><col style="width:28%"><col style="width:40%">'
                '<col style="width:12%"><col style="width:20%"></colgroup>',
            "number column right-aligned, tabular":
                '.index-table th:last-child, .index-table td:last-child '
                '{ text-align: right; font-variant-numeric: tabular-nums; }',
            "symbol column right-aligned (like the numbers)":
                '.index-table .sym-col { text-align: right; }',
            "gold pipe separators (#8a6c1a)":
                '.hsep { color: #8a6c1a; }',
            "header symbol has no own colour (inherits the line)":
                '.cur-symbol { font-weight: 700; margin-left: 2px; }',
            "converter output matches the US$ label (no bold/own colour)":
                '.conv-out { font-variant-numeric: tabular-nums; }',
            "header line is one colour (#5C3D11)":
                'border-bottom: 2px solid #E8D9BC; color: #5C3D11; }',
            "header row uses the body font size":
                'text-align: left; font-size: var(--fs-body,14px); font-weight: 700;',
        }
        for label, frag in must_have.items():
            if frag not in html:
                fails.append(f"format drift — {label} (missing/changed)")

        must_not = {
            "standalone rate line must stay removed": 'class="rate-row"',
            "index symbols must use body colour (no accent override)": 'td.sym-col { color',
        }
        for label, frag in must_not.items():
            if frag in html:
                fails.append(f"format drift — {label}")

        # typography must use the --fs-* scale, never hardcoded pixels
        px = sorted(set(re.findall(r'font-size:\s*(\d+px)', html)))
        if px:
            fails.append(f"format drift — hardcoded font-size {px}; use the --fs-* scale")

        # no off-palette (green) colours — banner/text stay warm terracotta/brown
        greens = sorted(set(re.findall(
            r'#(?:1f5c3a|2e8b57|5cb87a|8aa890|6a7a6e|5a6a5e|d9e3d4|e3ecdd|dde8d8|f1f5ef)',
            html, re.I)))
        if greens:
            fails.append(f"format drift — off-palette green colour(s) {greens}")

        # a converter on every non-USD block; a Guides line on every block
        n_conv = html.count('class="conv"')
        if n_conv != non_usd:
            fails.append(f"converter count {n_conv} != non-USD countries {non_usd}")
        n_cities = html.count('class="cur-cities"')
        if n_cities != len(countries):
            fails.append(f"Guides line count {n_cities} != countries {len(countries)}")

    n = len(countries)
    if fails:
        print(f"✗ Currency Guide validation FAILED ({n} countries):")
        for f in fails:
            print("   - " + f)
        sys.exit(1)
    print(f"✓ Currency Guide valid — {n} countries, matches the guide index, date current.")


if __name__ == "__main__":
    main()
