#!/usr/bin/env python3
"""
build_currency.py — generate the Currency Guide page for Trip-Essentials.

Mirrors the build_climate.py / Plug Adapter pattern: a STATIC country->currency
map (names/symbols/ISO codes never change) plus a LIVE USD rate snapshot baked
into the HTML with an "as of" date. Travelers only need a ballpark, so an
approximate monthly snapshot is the right tradeoff and works offline (file://),
unlike a live fetch.

Usage:
  python3 build_currency.py                 # fetch latest USD rates, rebuild page
  python3 build_currency.py --rates r.json  # use a pre-fetched er-api JSON file
                                            # (er-api.com/v6/latest/USD shape)

Monthly refresh (scheduled): re-run this; it re-fetches and rewrites the page.
Output: Travel-Website/Trip-Essentials/Currency-Guide.html
"""
import argparse, json, os, sys, time, urllib.request, datetime, html

HERE = os.path.dirname(os.path.abspath(__file__))
TRAVEL = os.path.abspath(os.path.join(HERE, "..", ".."))   # .../Travel
# Hyphenated canonical ONLY — the toolbar, the search index, and validate_currency.py
# all read Currency-Guide.html. A space-named twin used to be written alongside it and
# kept reappearing as a published stray duplicate (archived 3× by 2026-06-21); never
# re-add it. brain_check.check_page_filename_spaces fails on any space-named page.
OUT = os.path.join(TRAVEL, "Travel-Website", "Trip-Essentials",
                   "Currency-Guide.html")
RATES_URL = "https://open.er-api.com/v6/latest/USD"
# Last-good rate snapshot. Lives under Brain/scripts/ (never published), so a
# transient API outage during the monthly refresh falls back to the previous
# good fetch instead of hard-aborting. Mirrors build_climate.py's /tmp cache,
# but persistent (survives reboots) since the refresh is monthly, not session.
RATES_CACHE = os.path.join(HERE, ".currency_rates_cache.json")

# ── Region order (Europe first, matching the Plug Adapter Guide) ────────────
REGION_ORDER = ["Europe", "Middle East", "Africa", "Asia",
                "Oceania", "North America", "Caribbean", "South America"]

# ── Static map: country -> currency facts + the guide cities it covers ──────
# rate_iso = which ISO code to read from the live USD-rate table.
# sym = display symbol used in the rate lines. peg = optional note.
COUNTRIES = [
 # name, region, currency, sym, iso, rate_iso, peg, [guide cities]
 ("Austria","Europe","Euro","€","EUR","EUR","", ["Salzburg","Vienna"]),
 ("Belgium","Europe","Euro","€","EUR","EUR","", ["Bruges","Brussels"]),
 ("Croatia","Europe","Euro","€","EUR","EUR","Adopted the euro in 2023.", ["Dubrovnik","Split"]),
 ("Czech Republic","Europe","Czech Koruna","Kč","CZK","CZK","", ["Prague"]),
 ("Denmark","Europe","Danish Krone","kr","DKK","DKK","", ["Copenhagen"]),
 ("Estonia","Europe","Euro","€","EUR","EUR","", ["Tallinn"]),
 ("Finland","Europe","Euro","€","EUR","EUR","", ["Helsinki"]),
 ("France","Europe","Euro","€","EUR","EUR","", ["Aix-en-Provence","Annecy","Bordeaux","Cannes","Colmar","Lille","Lyon","Marseille","Nice","Paris","Strasbourg"]),
 ("Germany","Europe","Euro","€","EUR","EUR","", ["Berlin","Hamburg","Marktoberdorf","Munich","Stuttgart"]),
 ("Greece","Europe","Euro","€","EUR","EUR","", ["Athens","Corfu","Mykonos","Santorini"]),
 ("Hungary","Europe","Hungarian Forint","Ft","HUF","HUF","", ["Budapest"]),
 ("Iceland","Europe","Icelandic Króna","kr","ISK","ISK","", ["Reykjavik"]),
 ("Ireland","Europe","Euro","€","EUR","EUR","", ["Dublin"]),
 ("Italy","Europe","Euro","€","EUR","EUR","", ["Amalfi","Bologna","Capri","Cinque Terre","Florence","Lake Como","Milan","Naples","Pisa","Rome","Siena","Sorrento","Turin","Venice","Verona"]),
 ("Luxembourg","Europe","Euro","€","EUR","EUR","", ["Luxembourg"]),
 ("Monaco","Europe","Euro","€","EUR","EUR","", ["Monaco"]),
 ("Netherlands","Europe","Euro","€","EUR","EUR","", ["Amsterdam"]),
 ("Norway","Europe","Norwegian Krone","kr","NOK","NOK","", ["Ålesund","Bergen","Oslo","Tromsø"]),
 ("Portugal","Europe","Euro","€","EUR","EUR","", ["Azores","Cascais","Lagos","Lisbon","Madeira","Porto","Sintra"]),
 ("Slovenia","Europe","Euro","€","EUR","EUR","", ["Ljubljana"]),
 ("Spain","Europe","Euro","€","EUR","EUR","", ["Barcelona","Madrid","San Sebastián","Seville","Toledo"]),
 ("Sweden","Europe","Swedish Krona","kr","SEK","SEK","", ["Gothenburg","Stockholm"]),
 ("Switzerland","Europe","Swiss Franc","Fr","CHF","CHF","", ["Geneva","Lucerne","Zurich"]),
 ("Turkey","Europe","Turkish Lira","₺","TRY","TRY","", ["Istanbul"]),
 ("United Kingdom","Europe","Pound Sterling","£","GBP","GBP","", ["Cambridge","Edinburgh","Glasgow","London","Oxford"]),

 ("United Arab Emirates","Middle East","UAE Dirham","Dh","AED","AED","Pegged to the US dollar (~3.67).", ["Abu Dhabi","Dubai"]),
 ("Jordan","Middle East","Jordanian Dinar","JD","JOD","JOD","Pegged to the US dollar (~0.71).", ["Petra"]),

 ("Egypt","Africa","Egyptian Pound","E£","EGP","EGP","", ["Cairo"]),
 ("Morocco","Africa","Moroccan Dirham","DH","MAD","MAD","", ["Marrakech"]),

 ("China","Asia","Chinese Yuan (Renminbi)","¥","CNY","CNY","", ["Beijing","Chongqing","Shanghai","Zhangjiajie"]),
 ("Hong Kong","Asia","Hong Kong Dollar","HK$","HKD","HKD","Pegged to the US dollar (~7.8).", ["Hong Kong"]),
 ("Indonesia","Asia","Indonesian Rupiah","Rp","IDR","IDR","", ["Bali"]),
 ("Japan","Asia","Japanese Yen","¥","JPY","JPY","", ["Kyoto","Tokyo"]),
 ("Singapore","Asia","Singapore Dollar","S$","SGD","SGD","", ["Singapore"]),
 ("Sri Lanka","Asia","Sri Lankan Rupee","Rs","LKR","LKR","", ["Colombo"]),
 ("South Korea","Asia","South Korean Won","₩","KRW","KRW","", ["Seoul"]),
 ("Taiwan","Asia","New Taiwan Dollar","NT$","TWD","TWD","", ["Taipei"]),
 ("Philippines","Asia","Philippine Peso","₱","PHP","PHP","", ["Palawan"]),
 ("Thailand","Asia","Thai Baht","฿","THB","THB","", ["Bangkok","Chiang Mai","Phuket"]),

 ("Australia","Oceania","Australian Dollar","A$","AUD","AUD","", ["Melbourne","Sydney"]),
 ("New Zealand","Oceania","New Zealand Dollar","NZ$","NZD","NZD","", ["Queenstown","Wellington"]),

 ("United States","North America","US Dollar","$","USD","USD","", ["Alaska","Atlanta","Austin","Bend","Big Island","Boston","Boulder","Cape Cod","Carmel-by-the-Sea","Charlotte","Chicago","Columbia","Dallas","Denver","Florida Keys","Glacier National Park","Kauai","Key West","La Jolla","Lake Tahoe","Las Vegas","Los Angeles","Malibu","Maui","Miami","Napa","Naples","Nashville","New Orleans","New York","Oahu","Orcas Island","Orlando","Palm Desert","Palo Alto","Pasadena","Pensacola","Philadelphia","Phoenix","Portland","San Diego","San Francisco","San Jose","San Juan Island","Santa Barbara","Santa Cruz","Santa Monica","Sarasota","Scottsdale","Seattle","Sedona","Virgin Islands","Washington DC","Yellowstone"]),
 ("Canada","North America","Canadian Dollar","C$","CAD","CAD","", ["Montréal","Québec City","Toronto","Vancouver","Victoria","Whistler"]),

 ("Aruba","Caribbean","Aruban Florin","Afl.","AWG","AWG","Pegged to the US dollar; USD widely accepted.", ["Aruba"]),
 ("Bahamas","Caribbean","Bahamian Dollar","B$","BSD","BSD","Pegged 1:1 with the US dollar — USD accepted everywhere.", ["The Bahamas"]),
 ("Barbados","Caribbean","Barbadian Dollar","Bds$","BBD","BBD","Pegged 2:1 with the US dollar — USD widely accepted.", ["Barbados"]),
 ("Cayman Islands","Caribbean","Cayman Islands Dollar","CI$","KYD","KYD","Pegged to the US dollar; one of the few currencies worth more than USD.", ["Cayman Islands"]),
 ("Costa Rica","Caribbean","Costa Rican Colón","₡","CRC","CRC","One of the more expensive Central American destinations. Many establishments accept US dollars, especially in tourist areas.", ["Arenal", "Manuel Antonio", "San José"]),
 ("Curaçao","Caribbean","Caribbean Guilder","ƒ","XCG","XCG","Pegged to the US dollar; replaced the Netherlands Antillean guilder.", ["Curaçao"]),
 ("Sint Maarten","Caribbean","Caribbean Guilder","ƒ","XCG","XCG","Pegged to the US dollar; USD widely accepted.", ["Sint Maarten"]),
 ("Puerto Rico","Caribbean","US Dollar","$","USD","USD","US territory — uses the US dollar.", ["Puerto Rico"]),
 ("Turks and Caicos","Caribbean","US Dollar","$","USD","USD","British Overseas Territory; the US dollar is the official currency.", ["Turks and Caicos"]),

 ("Argentina","South America","Argentine Peso","AR$","ARS","ARS","", ["Buenos Aires"]),
 ("Brazil","South America","Brazilian Real","R$","BRL","BRL","", ["Aracaju","Florianópolis","Fortaleza","Foz do Iguaçu","João Pessoa","Maceió","Natal","Olinda","Porto Alegre","Recife","Rio de Janeiro","Salvador","São Luís"]),
 ("Chile","South America","Chilean Peso","CL$","CLP","CLP","", ["Santiago"]),
 ("Peru","South America","Peruvian Sol","S/","PEN","PEN","", ["Cusco","Lima","Machu Picchu"]),
 ("Uruguay","South America","Uruguayan Peso","$U","UYU","UYU","", ["Montevideo"]),
]


def _load_cache():
    """Return (rates, time_str) from the last-good snapshot, or None."""
    try:
        with open(RATES_CACHE) as f:
            data = json.load(f)
        if data.get("result") == "success" and data.get("rates"):
            return data["rates"], data.get("time_last_update_utc", "")
    except Exception:  # noqa: BLE001 — a missing/corrupt cache is just "no fallback"
        pass
    return None


def get_rates(path):
    # Explicit pre-fetched file (--rates): use as-is, no network, no cache.
    if path:
        with open(path) as f:
            data = json.load(f)
        if data.get("result") != "success":
            sys.exit("rate fetch failed (from --rates file): " + str(data.get("result")))
        return data["rates"], data.get("time_last_update_utc", "")

    # Live fetch with retry + backoff; persist a last-good snapshot; on total
    # failure fall back to that snapshot rather than killing the refresh.
    last_err = ""
    for attempt in range(1, 4):  # 3 tries
        try:
            with urllib.request.urlopen(RATES_URL, timeout=30) as r:
                data = json.load(r)
            if data.get("result") != "success":
                last_err = "result=" + str(data.get("result"))
            else:
                try:
                    with open(RATES_CACHE, "w") as f:
                        json.dump(data, f)
                except Exception as e:  # noqa: BLE001 — cache write is best-effort
                    print(f"  ⚠️  could not write rate cache ({e}).", file=sys.stderr)
                return data["rates"], data.get("time_last_update_utc", "")
        except Exception as e:  # noqa: BLE001 — network/JSON errors → retry
            last_err = str(e)
        if attempt < 3:
            time.sleep(attempt * 3)  # 3s, 6s backoff

    cached = _load_cache()
    if cached:
        print(f"  ⚠️  live rate fetch failed ({last_err}) after 3 tries — "
              f"using last-good cached snapshot from {cached[1] or 'unknown date'}.",
              file=sys.stderr)
        return cached
    sys.exit(f"rate fetch failed after 3 tries ({last_err}) and no cached "
             f"snapshot at {RATES_CACHE} to fall back to.")


def fmt_rate(r):
    """Headline: units of foreign currency per US$1."""
    if r >= 100:
        return f"{r:,.0f}"
    if r >= 1:
        return f"{r:,.2f}"
    return f"{r:.3f}"


def reverse(rate, sym):
    """Friendly reverse line: {sym}{base} ≈ US${val}, base chosen for readability."""
    for base in (1, 10, 100, 1000, 10000, 100000):
        val = base / rate
        if val >= 0.5:
            return f"{sym}{base:,} ≈ US${val:,.2f}"
    # If no base yields val ≥ 0.5 (rate > 200,000), fall through to last-iteration fallback below.
    # (base and val are still defined from the final loop iteration)
    return f"{sym}{base:,} ≈ US${val:,.2f}"


def _parse(stamp):
    # "Sun, 14 Jun 2026 00:02:31 +0000" -> datetime (falls back to today)
    try:
        return datetime.datetime.strptime(stamp[:16].strip(), "%a, %d %b %Y")
    except Exception:
        return datetime.datetime.today()


def as_of(stamp):
    dt = _parse(stamp)
    return f"{dt.day} {dt.strftime('%B %Y')}"         # 14 June 2026


def as_of_month(stamp):
    return _parse(stamp).strftime("%B %Y")            # June 2026


def esc(s):
    return html.escape(s, quote=True)


def anchor(name):
    return name.replace(" ", "_").replace("ç", "c").replace("ó", "o")


def build():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rates", help="pre-fetched er-api JSON file")
    args = ap.parse_args()
    rates, stamp = get_rates(args.rates)
    updated = as_of(stamp)

    # group by region
    by_region = {r: [] for r in REGION_ORDER}
    for row in COUNTRIES:
        by_region[row[1]].append(row)

    # ---- index table rows (alphabetical across all) ----
    idx_rows = []
    flat = sorted(COUNTRIES, key=lambda c: c[0])
    for i, (name, region, cur, sym, iso, riso, peg, cities) in enumerate(flat):
        bg = "#FAF7F0" if i % 2 == 0 else "#FFFFFF"
        if riso == "USD":
            head = "—"
        else:
            head = fmt_rate(rates[riso])
        idx_rows.append(
          f'<tr style="background:{bg}">\n'
          f'      <td style="padding:5px 12px;font-size:var(--fs-body);font-weight:600;color:var(--text);"><a href="#{anchor(name)}">{esc(name)}</a></td>\n'
          f'      <td style="padding:5px 12px;font-size:var(--fs-body);color:var(--text);">{esc(cur)} <span style="color:var(--accent);">{esc(iso)}</span></td>\n'
          f'      <td class="sym-col" style="padding:5px 8px;font-size:var(--fs-body);">{esc(sym)}</td>\n'
          f'      <td style="padding:5px 12px;font-size:var(--fs-body);color:var(--text);white-space:nowrap;">{esc(head)}</td>\n'
          f'    </tr>')

    # ---- detail region sections ----
    sections = []
    for region in REGION_ORDER:
        blocks = []
        for (name, _r, cur, sym, iso, riso, peg, cities) in by_region[region]:
            cities_line = " · ".join(esc(c) for c in cities)
            rate = rates[riso]
            if riso == "USD":
                rate_html = (
                  '<div class="rate-row">'
                  '<div class="rate-main">US Dollar — no conversion needed</div>'
                  '</div>')
                conv_html = ""
            else:
                rate_html = (
                  '<div class="rate-row">'
                  f'<div class="rate-main"><span class="rate-from">US$1</span>'
                  f'<span class="rate-eq">≈</span>'
                  f'<span class="rate-to">{esc(sym)}{fmt_rate(rate)}</span></div>'
                  '</div>')
                conv_html = (
                  '<div class="conv">US$ '
                  '<input class="conv-in" type="number" min="0" step="1" value="1" '
                  'inputmode="decimal" aria-label="Amount in US dollars"> = '
                  '<span class="conv-out"></span></div>')
            peg_html = f'<div class="cur-note">{esc(peg)}</div>' if peg else ""
            blocks.append(
              f'<div class="country-block" id="{anchor(name)}" data-rate="{rate}" data-sym="{esc(sym)}">\n'
              f'  <div class="country-header">\n'
              f'    <span class="country-name">{esc(name)}</span>\n'
              f'    <span class="hsep">|</span>\n'
              f'    <span class="cur-full">{esc(cur)}</span>\n'
              f'    <span class="hsep">|</span>\n'
              f'    <span class="cur-code">{esc(iso)}</span>\n'
              f'    <span class="hsep">|</span>\n'
              f'    <span class="cur-symbol">{esc(sym)}</span>\n'
              f'    <span class="cur-cities">Guides: {cities_line}</span>\n'
              f'  </div>\n'
              f'  <div class="cur-block">\n'
              f'    {conv_html}\n'
              f'    {peg_html}\n'
              f'  </div>\n'
              f'</div>')
        sections.append(
          '<div class="region-section">\n'
          f'  <div class="region-header">{esc(region)}</div>\n'
          + "\n".join(blocks) + "\n</div>")

    page = TEMPLATE.format(
        updated=esc(updated),
        updated_month=esc(as_of_month(stamp)),
        index_rows="\n".join(idx_rows),
        sections="\n".join(sections),
        n_countries=len(COUNTRIES),
    )
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(page)
    print(f"✓ wrote {OUT}")
    print(f"  {len(COUNTRIES)} countries · rates as of {updated}")


TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="../assets/web-travel-style.css">
<title>World Currency Guide</title>
<style>
/* Typography follows the site scale in web-travel-style.css:
   --font, --fs-body(14) --fs-title(14) --fs-sub(12) --fs-label(11).
   The page banner (.site-header) and search input are styled site-wide there —
   not overridden here. */
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ font-family: var(--font); background: var(--bg,#f5f4f0); color: var(--text,#1a1917);
  font-size: var(--fs-body,14px); line-height: 1.5; }}
.index-section {{ max-width: none; margin: 8px auto 0; padding: 0 32px; }}
/* last-update stamp uses shared .updated-stamp from web-travel-style.css */
.index-table thead th {{
  background: var(--surface2, #f0ede8); border-bottom: 2px solid var(--border, #d8d4cc);
  padding: 8px 12px; text-align: left; font-size: var(--fs-body,14px); font-weight: 700;
  color: var(--muted, #6a6660);
}}
.index-table th:last-child, .index-table td:last-child {{ text-align: right; font-variant-numeric: tabular-nums; }}
.index-table .sym-col {{ text-align: right; }}
.index-table {{ width: 100%; border-collapse: collapse; border-radius: 0 0 6px 6px; overflow: hidden; box-shadow: 0 2px 12px rgba(92,61,17,0.10); }}
.index-table tbody td {{ font-size: var(--fs-body,14px); }}
.index-table tbody tr {{ cursor: pointer; }}
.index-table tbody tr:hover {{ filter: brightness(0.96); }}
.index-table tbody td a {{ color: var(--text); text-decoration: none; display: block; }}
.index-table tbody td a:hover {{ color: var(--accent,#8a6c1a); text-decoration: underline; }}
.index-table tbody tr.idx-hide {{ display: none; }}
#cur-search {{ display: block; margin-left: auto; margin-right: auto; }}
.content-wrap {{ max-width: none; margin: 0 auto; padding: 0 32px; }}
.region-section {{ margin-top: 20px; margin-bottom: 20px; }}
.region-header {{
  background: var(--banner-gradient, linear-gradient(90deg, #7a3b1e 0%, #b85c2a 55%, #d4874a 100%));
  color: var(--banner-text,#fff); font-size: var(--fs-sub,12px); font-weight: 700; padding: 11px 22px;
  border-radius: 6px; margin-bottom: 18px; letter-spacing: 0.5px; text-transform: uppercase;
}}
.country-block {{
  background: var(--surface,#fff); border: 1px solid #E0D4B8; border-radius: 8px;
  padding: 20px 24px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(92,61,17,0.07);
  scroll-margin-top: 72px;
}}
.country-header {{ display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 2px solid #E8D9BC; color: #5C3D11; }}
.country-name {{ font-size: var(--fs-title,14px); font-weight: 700; }}
.cur-full, .cur-code {{ font-size: var(--fs-body,14px); font-weight: 600; }}
.cur-code {{ letter-spacing: 0.02em; }}
.hsep {{ color: #8a6c1a; }}
.cur-symbol {{ font-weight: 700; margin-left: 2px; }}
.rate-row {{ display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 18px; padding: 12px 16px; background: #f0eeea; border: 1px solid #EAE0C8; border-radius: 6px; }}
.rate-main {{ font-size: var(--fs-body,14px); font-weight: 700; color: #5C3D11; display: inline-flex; align-items: baseline; gap: 8px; }}
.rate-from {{ color: #7A5C2E; font-weight: 600; }}
.rate-eq {{ color: #C8A96A; }}
.cur-note {{ font-size: var(--fs-sub,12px); color: #7A5C2E; margin-top: 10px; }}
.cur-cities {{ font-size: var(--fs-sub,12px); margin-left: auto; padding-left: 16px; }}
.conv {{ display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; font-size: var(--fs-body,14px); color: #5A4A2E; }}
.conv input {{ width: 96px; padding: 5px 10px; font-size: var(--fs-body,14px); font-family: var(--font); border: 1.5px solid var(--border2,#e6e2da); border-radius: 6px; background: var(--surface,#fff); color: var(--text,#1a1917); outline: none; }}
.conv input:focus {{ border-color: #B8860B; box-shadow: 0 0 0 3px rgba(184,134,11,.12); }}
.conv-out {{ font-variant-numeric: tabular-nums; }}
#cur-noresult {{ display: none; padding: 12px 4px; font-size: var(--fs-body,14px); color: #5A4A2E; }}
html {{ scroll-behavior: smooth; }}
.region-section:last-child, .region-section:last-child *:last-child {{ margin-bottom: 0 !important; }}
@media (max-width: 600px) {{
  .index-section, .content-wrap {{ padding: 0 12px; }}
  .index-table td, .index-table th {{ font-size: var(--fs-sub,12px) !important; padding: 4px 8px !important; }}
  .country-block {{ padding: 14px 14px; }}
  .country-header {{ flex-direction: row; align-items: center; gap: 10px; }}
  .region-header {{ padding: 9px 14px; }}
}}
</style>
<link rel="stylesheet" href="../assets/mobile.css">
</head>
<body>

<div id="toolbar-mount" data-depth="1" data-maxwidth="940"></div>
<script src="../assets/toolbar.js?v=69"></script>

<div class="index-section">
  <div class="site-header">
    <h1 class="site-title">World Currency Guide</h1>
  </div>
  <span class="updated-stamp">Updated {updated_month}</span>
  <input id="cur-search" type="search" placeholder="🔍  Country or currency" aria-label="Search by country or currency" autocomplete="off" spellcheck="false">
  <div id="cur-noresult">No country matches that search.</div>
  <table class="index-table">
    <colgroup><col style="width:28%"><col style="width:40%"><col style="width:12%"><col style="width:20%"></colgroup>
    <thead><tr><th>Country</th><th>Currency</th><th class="sym-col">Sym</th><th>US$1</th></tr></thead>
    <tbody>
{index_rows}
    </tbody>
  </table>
</div>

<div class="content-wrap">
{sections}
</div>

<script>
(function(){{
  var input=document.getElementById('cur-search'); if(!input)return;
  var rows=[].slice.call(document.querySelectorAll('.index-table tbody tr'));
  var blocks=[].slice.call(document.querySelectorAll('.country-block'));
  var regions=[].slice.call(document.querySelectorAll('.region-section'));
  var indexTable=document.querySelector('.index-table');
  var noRes=document.getElementById('cur-noresult');
  function norm(s){{return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();}}
  function jumpTo(hash){{var el=document.getElementById(decodeURIComponent(hash.replace(/^#/,'')));if(el){{el.scrollIntoView();location.hash=hash;var ci=el.querySelector('.conv-in');if(ci){{ci.focus();ci.select();}}}}}}
  rows.forEach(function(r){{r.addEventListener('click',function(e){{var a=r.querySelector('a[href^="#"]');if(!a)return;e.preventDefault();jumpTo(a.getAttribute('href'));}});}});
  /* per-country converter: type a US$ amount, see it in that currency */
  function fmtAmt(v){{
    if(v>=1000)return v.toLocaleString('en-US',{{maximumFractionDigits:0}});
    if(v>=1)return v.toLocaleString('en-US',{{minimumFractionDigits:2,maximumFractionDigits:2}});
    return v.toLocaleString('en-US',{{maximumFractionDigits:3}});
  }}
  blocks.forEach(function(b){{
    var inp=b.querySelector('.conv-in'); if(!inp)return;
    var out=b.querySelector('.conv-out');
    var rate=parseFloat(b.getAttribute('data-rate'))||0;
    var sym=b.getAttribute('data-sym')||'';
    function upd(){{var a=parseFloat(inp.value);if(isNaN(a)){{out.textContent='';return;}}out.textContent=sym+fmtAmt(a*rate);}}
    inp.addEventListener('input',upd); upd();
  }});
  input.addEventListener('input',function(){{
    var q=norm(input.value.trim()),shown=0;
    rows.forEach(function(r){{var m=q===''||norm(r.textContent).indexOf(q)>-1;r.classList.toggle('idx-hide',!m);if(m)shown++;}});
    blocks.forEach(function(b){{var t=norm(b.textContent);b.style.display=(q===''||t.indexOf(q)>-1)?'':'none';}});
    regions.forEach(function(s){{var vis=[].slice.call(s.querySelectorAll('.country-block')).some(function(b){{return b.style.display!=='none';}});s.style.display=(q===''||vis)?'':'none';}});
    var noHits=(shown===0&&q!=='');
    if(noRes)noRes.style.display=noHits?'block':'none';
    if(indexTable)indexTable.style.display=noHits?'none':'';
  }});
}})();
</script>
</body>
</html>
"""

if __name__ == "__main__":
    build()
