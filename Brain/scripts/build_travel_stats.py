#!/usr/bin/env python3
"""
build_travel_stats.py — regenerate Travel Stats.html from Guides-Index.html live data.

Usage:
    python3 Brain/scripts/build_travel_stats.py [--dry-run]

Reads:   Travel-Website/Guides/Guides-Index.html  (FMAP block + dest-card markup)
Writes:  Travel-Website/Trip-Essentials/Travel Stats.html

Sources:
  - FMAP data block  → region, flight time, routing per city
  - dest-card markup → been (no data-status) vs want (data-status="want"), flag, name

Wired into guide_tools.py ship as a best-effort post-step (same pattern as
build_search_index.py — never blocks a clean ship on failure).
Run manually any time guides are added or been/want status changes.
"""

import sys, re, json, datetime
from collections import defaultdict, Counter
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR  = Path(__file__).resolve().parent
TRAVEL_ROOT = SCRIPT_DIR.parent.parent           # …/Travel/
INDEX_HTML  = TRAVEL_ROOT / 'Travel-Website' / 'Guides' / 'Guides-Index.html'
STATS_HTML  = TRAVEL_ROOT / 'Travel-Website' / 'Trip-Essentials' / 'Travel-Stats.html'

DRY_RUN = '--dry-run' in sys.argv

# ── Region config ──────────────────────────────────────────────────────────────
REGION_EMOJI = {
    'Europe':        '🌍',
    'United States': '🇺🇸',
    'Asia':          '🌏',
    'Caribbean':     '🏝',
    'Canada':        '🍁',
    'South America': '🌎',
    'Middle East':   '🕌',
    'Oceania':       '🦘',
    'Africa':        '🌍',
}

# Canonical order for New Frontiers chips
FRONTIER_ORDER = [
    'Europe', 'United States', 'Asia', 'Caribbean',
    'Canada', 'South America', 'Middle East', 'Oceania', 'Africa',
]

# Roll the mixed FMAP "regions" up into true continents for the by-continent view.
REGION_TO_CONTINENT = {
    'Europe':        'Europe',
    'United States': 'North America',
    'Canada':        'North America',
    'North America': 'North America',
    'Caribbean':     'North America',
    'Asia':          'Asia',
    'Middle East':   'Asia',
    'South America': 'South America',
    'Oceania':       'Oceania',
    'Africa':        'Africa',
}

CONTINENT_EMOJI = {
    'Europe':        '🏰',
    'North America': '🗽',
    'Asia':          '⛩',
    'South America': '🗿',
    'Oceania':       '🦘',
    'Africa':        '🦁',
}

# Display order (largest land masses / typical atlas order)
CONTINENT_ORDER = ['North America', 'South America', 'Europe', 'Africa', 'Asia', 'Oceania']

# Section jump-nav — (anchor id, short pill label). ids are mirrored onto the
# matching .section-title (and #overview on the hero row) in generate_html().
NAV_SECTIONS = [
    ('overview',       'Overview'),
    ('sec-split',      'Been vs Want'),
    ('sec-flights',    'Flights'),
    ('sec-been',       'Been by Region'),
    ('sec-bucket',     'Bucket List'),
    ('sec-want',       'Wishlist'),
    ('sec-frontiers',  'Frontiers'),
    ('sec-continents', 'Continents'),
    ('sec-routing',    'Routing'),
    ('sec-hubs',       'Hubs'),
    ('sec-countries',  'Countries'),
]

# ── Parse FMAP ─────────────────────────────────────────────────────────────────
def parse_fmap(html):
    m = re.search(r'var FMAP\s*=\s*(\{.*?\});', html, re.DOTALL)
    if not m:
        sys.exit('ERROR: FMAP block not found in Guides-Index.html')
    return json.loads(m.group(1))

# ── Parse dest-cards ───────────────────────────────────────────────────────────
def parse_cards(html):
    """Return list of dicts: {href_key, been, flag, name}"""
    cards = []
    for block in re.finditer(r'<a class="dest-card"([^>]*)>(.*?)</a>', html, re.DOTALL):
        attrs = block.group(1)
        inner = block.group(2)

        href_m = re.search(r'href="([^"]+)"', attrs)
        if not href_m:
            continue
        # Normalise: strip leading "./"
        href_key = href_m.group(1).lstrip('./')

        status_m = re.search(r'data-status="(\w+)"', attrs)
        been = (status_m is None) or (status_m.group(1) != 'want')

        flag_m = re.search(r'class="dest-flag"[^>]*>(.*?)</span>', inner, re.DOTALL)
        flag = flag_m.group(1).strip() if flag_m else ''

        name_m = re.search(r'class="dest-name"[^>]*>(.*?)</span>', inner, re.DOTALL)
        name = name_m.group(1).strip() if name_m else href_key.split('/')[0]

        cards.append({'href_key': href_key, 'been': been, 'flag': flag, 'name': name})
    return cards

# ── Country-name resolution (flag emoji → ISO alpha-2 → name) ────────────────────
COUNTRY_NAMES = {
    'US': 'United States', 'IT': 'Italy', 'FR': 'France', 'PT': 'Portugal',
    'ES': 'Spain', 'GB': 'United Kingdom', 'CA': 'Canada', 'CN': 'China',
    'DE': 'Germany', 'NO': 'Norway', 'PE': 'Peru', 'CH': 'Switzerland',
    'AE': 'United Arab Emirates', 'AU': 'Australia', 'AT': 'Austria',
    'BE': 'Belgium', 'HR': 'Croatia', 'GR': 'Greece', 'JP': 'Japan',
    'NZ': 'New Zealand', 'SE': 'Sweden', 'TH': 'Thailand', 'AR': 'Argentina',
    'BR': 'Brazil', 'AW': 'Aruba', 'BS': 'Bahamas', 'BB': 'Barbados',
    'KY': 'Cayman Islands', 'CW': 'Curaçao', 'PR': 'Puerto Rico',
    'SX': 'Sint Maarten', 'CL': 'Chile', 'HK': 'Hong Kong', 'CZ': 'Czechia',
    'DK': 'Denmark', 'EE': 'Estonia', 'FI': 'Finland', 'IS': 'Iceland',
    'IE': 'Ireland', 'LU': 'Luxembourg', 'MC': 'Monaco', 'MA': 'Morocco',
    'NL': 'Netherlands', 'SG': 'Singapore', 'SI': 'Slovenia',
    'KR': 'South Korea', 'TW': 'Taiwan',
}

def flag_to_country(flag):
    """Decode a flag emoji (two regional-indicator chars) to a country name."""
    code = ''.join(chr(ord(c) - 127397) for c in flag if 127462 <= ord(c) <= 127487)
    return COUNTRY_NAMES.get(code, code or flag)

# ── Format helpers ─────────────────────────────────────────────────────────────
def fmt_mins(m):
    h, mn = divmod(m, 60)
    return f'{h}h {mn}m' if mn else f'{h}h'

def routing_detail(routing, hub):
    if routing == 'nonstop':  return 'Nonstop'
    if routing == 'seasonal': return 'Nonstop · seasonal'
    if routing == '1stop':    return f'1 stop via {hub}'
    if routing == '2stop':    return f'2 stops via {hub}'
    return routing

# ── Compute stats ──────────────────────────────────────────────────────────────
def compute_stats(fmap, cards):
    card_map = {c['href_key']: c for c in cards}
    fmap_keys = set(fmap)
    card_keys = {c['href_key'] for c in cards}

    # Coverage parity — a guide added to the index must appear in BOTH sources.
    # A card with no FMAP entry (or vice versa) would be silently dropped from the
    # stats, so surface both gaps. The validator hard-fails on either being non-empty.
    home_keys = {k for k, fd in fmap.items() if fd.get('r') == 'home'}
    orphan_cards = sorted((card_keys - fmap_keys))                 # card, no FMAP row
    orphan_fmap  = sorted((fmap_keys - card_keys) - home_keys)     # FMAP row, no card

    entries = []
    for fmap_key, fd in fmap.items():
        card = card_map.get(fmap_key)
        if not card:
            continue
        entries.append({
            'key':     fmap_key,
            'name':    card['name'],
            'flag':    card['flag'],
            'been':    card['been'],
            'region':  fd.get('rg', ''),
            'mins':    fd.get('m', 0),
            'time':    fd.get('t', ''),
            'routing': fd.get('r', ''),
            'hub':     fd.get('h'),
        })

    # Exclude home (Seattle)
    entries = [e for e in entries if e['routing'] != 'home']

    been = [e for e in entries if e['been']]
    want = [e for e in entries if not e['been']]

    total = len(entries)
    been_count = len(been)
    want_count = len(want)
    been_pct = round(been_count / total * 100, 1) if total else 0
    want_pct = round(want_count / total * 100, 1) if total else 0

    been_regions = {e['region'] for e in been if e['region']}

    # Countries — one country per distinct flag emoji (cities share a flag).
    countries_total = len({e['flag'] for e in entries if e['flag']})
    countries_been  = len({e['flag'] for e in been    if e['flag']})

    # Flight stats
    been_mins = [e for e in been if e['mins'] > 0]
    total_mins = sum(e['mins'] for e in been_mins)
    total_h, total_m = divmod(total_mins, 60)
    total_flight_str = f'{total_h}h {total_m:02d}m'
    total_flight_days = total_mins // (60 * 24)

    # Average one-way flight time to visited destinations
    avg_been_mins = round(total_mins / len(been_mins)) if been_mins else 0
    avg_been_str  = fmt_mins(avg_been_mins) if avg_been_mins else '—'

    # Nonstop-from-Seattle reach (nonstop + seasonal-nonstop routings)
    NONSTOP = {'nonstop', 'seasonal'}
    nonstop_been = sum(1 for e in been if e['routing'] in NONSTOP)
    nonstop_all  = sum(1 for e in entries if e['routing'] in NONSTOP)

    farthest_been = max(been_mins, key=lambda e: e['mins']) if been_mins else None
    want_mins = [e for e in want if e['mins'] > 0]
    closest_want  = min(want_mins, key=lambda e: e['mins']) if want_mins else None
    farthest_want = max(want_mins, key=lambda e: e['mins']) if want_mins else None

    # Region breakdowns — store (name, key) tuples so renderers can build links
    been_by_region = defaultdict(list)
    for e in been:
        if e['region']:
            been_by_region[e['region']].append((e['name'], e['key']))

    want_by_region = defaultdict(list)
    for e in want:
        if e['region']:
            want_by_region[e['region']].append((e['name'], e['key']))

    # Bucket list — top 8 want by flight time descending
    bucket = sorted(want_mins, key=lambda e: e['mins'], reverse=True)[:8]

    # By-continent rollup (regions folded into true continents)
    continents = {}
    for e in entries:
        cont = REGION_TO_CONTINENT.get(e['region'])
        if not cont:
            continue
        c = continents.setdefault(cont, {'total': 0, 'been': 0, 'want': 0})
        c['total'] += 1
        c['been' if e['been'] else 'want'] += 1

    # Gateway hubs — connecting airports ranked by how many guides route through them
    hub_counter = Counter(e['hub'] for e in entries if e['hub'])
    hubs = hub_counter.most_common(8)

    # How you get there — routing mix (seasonal counts as nonstop reach)
    routing = {
        'nonstop': sum(1 for e in entries if e['routing'] in ('nonstop', 'seasonal')),
        '1stop':   sum(1 for e in entries if e['routing'] == '1stop'),
        '2stop':   sum(1 for e in entries if e['routing'] == '2stop'),
    }

    # Most-covered countries — group by flag, top 6, with been split
    by_flag = {}
    for e in entries:
        if not e['flag']:
            continue
        d = by_flag.setdefault(e['flag'], {'total': 0, 'been': 0})
        d['total'] += 1
        if e['been']:
            d['been'] += 1
    top_countries = sorted(
        ((flag, flag_to_country(flag), d['total'], d['been']) for flag, d in by_flag.items()),
        key=lambda x: (-x[2], x[1]),
    )[:6]

    if been_count > total / 2:
        fraction_desc = 'more than half checked off'
    elif been_count == total // 2:
        fraction_desc = 'exactly half checked off'
    else:
        fraction_desc = f'{been_count} of {total} guides visited'

    return {
        'total':             total,
        'been_count':        been_count,
        'want_count':        want_count,
        'been_pct':          been_pct,
        'want_pct':          want_pct,
        'been_regions':      been_regions,
        'regions_visited':   len(been_regions),
        'regions_total':     len(FRONTIER_ORDER),
        'countries_total':   countries_total,
        'countries_been':    countries_been,
        'total_flight_str':  total_flight_str,
        'total_flight_days': total_flight_days,
        'avg_been_str':      avg_been_str,
        'nonstop_been':      nonstop_been,
        'nonstop_all':       nonstop_all,
        'farthest_been':     farthest_been,
        'closest_want':      closest_want,
        'farthest_want':     farthest_want,
        'been_by_region':    dict(been_by_region),
        'want_by_region':    dict(want_by_region),
        'bucket':            bucket,
        'fraction_desc':     fraction_desc,
        'continents':        continents,
        'hubs':              hubs,
        'routing':           routing,
        'top_countries':     top_countries,
        'orphan_cards':      orphan_cards,
        'orphan_fmap':       orphan_fmap,
    }

# ── HTML renderers ─────────────────────────────────────────────────────────────
def guide_link(key):
    """Relative URL from Trip-Essentials/ to a guide."""
    return f'../Guides/{key}'

def render_region_grid(by_region, want=False):
    if not by_region:
        return ''
    max_count = max(len(v) for v in by_region.values())
    sorted_regions = sorted(by_region.items(), key=lambda x: len(x[1]), reverse=True)
    fill_class = 'region-bar-fill want' if want else 'region-bar-fill'
    out = []
    for region, entries in sorted_regions:
        emoji = REGION_EMOJI.get(region, '🌐')
        count = len(entries)
        pct = round(count / max_count * 100) if max_count else 0
        word = 'guide' if count == 1 else 'guides'
        # Each entry is a (name, key) tuple — render as a link
        city_links = ' · '.join(
            f'<a href="{guide_link(key)}">{name}</a>' for name, key in entries
        )
        out.append(f'''    <div class="region-card">
      <div class="region-name">{emoji} {region} <span class="region-count">{count} {word}</span></div>
      <div class="region-bar-track"><div class="{fill_class}" style="width:{pct}%"></div></div>
      <div class="region-cities">{city_links}</div>
    </div>''')
    return '\n'.join(out)

def render_bucket_list(bucket):
    out = []
    for e in bucket:
        detail = routing_detail(e['routing'], e['hub'])
        out.append(f'''    <div class="bucket-card">
      <div class="bucket-top"><a class="bucket-name" href="{guide_link(e["key"])}">{e["flag"]} {e["name"]}</a><span class="bucket-time">{e["time"]}</span></div>
      <div class="bucket-detail">{detail}</div>
    </div>''')
    return '\n'.join(out)

def render_frontiers(been_regions):
    out = []
    for region in FRONTIER_ORDER:
        visited = region in been_regions
        cls  = 'frontier-chip visited' if visited else 'frontier-chip'
        mark = '✓' if visited else '♡'
        out.append(f'      <div class="{cls}">{mark} {region}</div>')
    return '\n'.join(out)

def render_continents(continents):
    if not continents:
        return ''
    ordered = [c for c in CONTINENT_ORDER if c in continents]
    ordered += [c for c in continents if c not in CONTINENT_ORDER]
    out = []
    for cont in ordered:
        d = continents[cont]
        total, been, want = d['total'], d['been'], d['want']
        emoji = CONTINENT_EMOJI.get(cont, '🌐')
        word = 'guide' if total == 1 else 'guides'
        been_pct = round(been / total * 100) if total else 0
        want_pct = 100 - been_pct
        out.append(f'''    <div class="cont-card">
      <div class="cont-head">
        <span class="cont-name">{emoji} {cont}</span>
        <span class="cont-total">{total} {word}</span>
      </div>
      <div class="cont-track">
        <div class="cont-been" style="width:{been_pct}%"></div>
        <div class="cont-want" style="width:{want_pct}%"></div>
      </div>
      <div class="cont-legend"><span class="cont-dot been"></span>{been} visited<span class="cont-dot want"></span>{want} on the list</div>
    </div>''')
    return '\n'.join(out)

def render_routing(routing):
    total = sum(routing.values()) or 1
    segs = [
        ('nonstop', 'Nonstop',      routing['nonstop']),
        ('onestop', '1 connection', routing['1stop']),
        ('twostop', '2 connections', routing['2stop']),
    ]
    bar = ''.join(
        f'<div class="route-seg {cls}" style="width:{round(n/total*100,1)}%"></div>'
        for cls, _, n in segs if n
    )
    legend = ''.join(
        f'<span class="route-key"><span class="route-dot {cls}"></span>{label} · {n}</span>'
        for cls, label, n in segs if n
    )
    return f'''    <div class="route-track">{bar}</div>
    <div class="route-legend">{legend}</div>'''

def render_hubs(hubs):
    if not hubs:
        return ''
    top = hubs[0][1]
    out = []
    for code, n in hubs:
        word = 'guide' if n == 1 else 'guides'
        out.append(f'''      <div class="hub-chip">
        <span class="hub-code">{code}</span>
        <span class="hub-count">{n} {word}</span>
      </div>''')
    return '\n'.join(out)

def render_countries(top_countries):
    out = []
    for flag, name, total, been in top_countries:
        word = 'guide' if total == 1 else 'guides'
        out.append(f'''    <div class="ctry-card">
      <span class="ctry-flag">{flag}</span>
      <div class="ctry-body">
        <div class="ctry-name">{name}</div>
        <div class="ctry-sub">{total} {word} · {been} visited</div>
      </div>
      <span class="ctry-count">{total}</span>
    </div>''')
    return '\n'.join(out)

# ── Full HTML output ───────────────────────────────────────────────────────────
def generate_html(s):
    fb = s['farthest_been']
    fw = s['farthest_want']

    updated   = datetime.date.today().strftime('%B %Y')
    nav_links = '\n'.join(f'    <a href="#{sid}">{label}</a>' for sid, label in NAV_SECTIONS)
    spy_script = (
        "<script>\n"
        "/* Scroll-spy — highlight the jump-nav pill for the section in view. */\n"
        "(function(){\n"
        "  var links=[].slice.call(document.querySelectorAll('.stats-nav a'));\n"
        "  if(!links.length||!('IntersectionObserver' in window))return;\n"
        "  var map={};\n"
        "  links.forEach(function(a){var id=(a.getAttribute('href')||'').replace('#','');if(id)map[id]=a;});\n"
        "  var obs=new IntersectionObserver(function(entries){\n"
        "    entries.forEach(function(en){\n"
        "      if(en.isIntersecting){links.forEach(function(a){a.classList.toggle('active',a===map[en.target.id]);});}\n"
        "    });\n"
        "  },{rootMargin:'-12% 0px -78% 0px',threshold:0});\n"
        "  Object.keys(map).forEach(function(id){var el=document.getElementById(id);if(el)obs.observe(el);});\n"
        "})();\n"
        "</script>"
    )

    farthest_html = ''
    if fb:
        farthest_html = f'''    <div class="flight-card">
      <div class="flight-icon">🛬</div>
      <div class="flight-label">Farthest destination visited</div>
      <div class="flight-val">{fb["time"]}</div>
      <div class="flight-sub">{fb["flag"]} {fb["name"]} · {fb["time"]}</div>
    </div>'''

    farthest_want_html = ''
    if fw:
        farthest_want_html = f'''    <div class="flight-card">
      <div class="flight-icon">🌏</div>
      <div class="flight-label">Farthest on the list</div>
      <div class="flight-val">{fw["time"]}</div>
      <div class="flight-sub">{fw["flag"]} {fw["name"]} · {routing_detail(fw["routing"], fw["hub"])}</div>
    </div>'''

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="../assets/_travel_style.css">
<title>Travel Stats</title>
<style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
:root {{
  --bg: #f5f4f0; --surface: #ffffff; --surface2: #f6f2ec;
  --border: #d8d4cc; --border2: #e6e2da;
  --text: #1a1917; --muted: #6a6660;
  /* Warm rust/terracotta = visited & achieved · navy = on-the-list & aspirational.
     Matches the site banner gradient + _travel_style.css. No green, no yellow. */
  --rust: #b85c2a; --rust-deep: #7a3b1e; --copper: #a8521f;
  --navy: #2f5596; --navy-deep: #1a2e5c;
  --accent: #b85c2a;
  --track: #ece6dd;
}}
body {{
  background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple Color Emoji', 'Segoe UI Emoji', Arial, sans-serif;
  font-size: var(--fs-body,14px); line-height: 1.6; padding-bottom: 80px;
}}
.page {{ max-width: none; margin: 0 auto; padding: 0 32px; }}

/* ===== Unified header — underline style, inherits from _travel_style.css ===== */
.header-desc {{ display: none !important; }}

/* ===== Hero stat cards ===== */
.hero-row {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }}
.hero-card {{ position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px 14px; min-height: 110px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; text-align: center; overflow: hidden; }}
.hero-card::before {{ content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: currentColor; opacity: .9; }}
.hero-icon {{ font-size: 18px; line-height: 1; margin-bottom: 6px; }}
.hero-num {{ font-size: 26px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; margin-bottom: 4px; }}
.hero-label {{ font-size: var(--fs-label,11px); letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); }}
.hero-card.total   {{ color: var(--rust-deep); }}
.hero-card.been    {{ color: var(--rust); }}
.hero-card.country {{ color: var(--copper); }}
.hero-card.want    {{ color: var(--navy); }}
.hero-card .hero-num {{ color: currentColor; }}

/* ===== Quick facts strip ===== */
.quickfacts {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; }}
.qf {{ background: var(--surface2); border: 1px solid var(--border2); border-radius: 9px; padding: 12px 14px; min-height: 110px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 2px; }}
.qf-icon {{ display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; background: #efe7f0; background: rgba(47,85,150,.09); font-size: 15px; line-height: 1; }}
.qf-val {{ font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: var(--text); margin-top: 4px; }}
.qf-of {{ font-size: 13px; font-weight: 600; color: var(--muted); }}
.qf-label {{ font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }}

/* ===== Section headings ===== */
.section-title {{
  font-size: var(--fs-label,11px); letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--muted); font-weight: 700; margin: 24px 0 12px;
}}

/* ===== Been / Want split bar ===== */
.split-wrap {{ background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 18px 20px; margin-bottom: 20px; }}
.split-labels {{ display: flex; justify-content: space-between; margin-bottom: 8px; }}
.split-label {{ font-size: var(--fs-sub,12px); font-weight: 600; }}
.split-label.been {{ color: var(--rust); }}
.split-label.want {{ color: var(--navy); }}
.split-track {{ height: 10px; background: var(--track); border-radius: 5px; overflow: hidden; display: flex; }}
.split-been {{ height: 100%; background: linear-gradient(90deg, var(--rust-deep), var(--rust)); border-radius: 5px 0 0 5px; transition: width 0.6s ease; }}
.split-want {{ height: 100%; background: var(--navy); flex: 1; border-radius: 0 5px 5px 0; }}
.split-sub {{ font-size: var(--fs-sub,12px); color: var(--muted); margin-top: 10px; }}

/* ===== Region bars ===== */
.region-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }}
.region-card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; }}
.region-name {{ font-size: var(--fs-sub,12px); font-weight: 600; color: var(--text); margin-bottom: 3px; display: flex; align-items: center; justify-content: space-between; }}
.region-count {{ font-size: var(--fs-label,11px); color: var(--muted); }}
.region-bar-track {{ height: 4px; background: var(--track); border-radius: 2px; margin: 6px 0; overflow: hidden; }}
.region-bar-fill {{ height: 100%; border-radius: 2px; background: var(--rust); transition: width 0.5s ease; }}
.region-bar-fill.want {{ background: var(--navy); }}
.region-cities {{ font-size: var(--fs-label,11px); color: var(--muted); line-height: 1.5; }}
.region-cities a {{ color: var(--muted); text-decoration: none; border-bottom: 1px dotted #c0b9b0; transition: color .12s, border-color .12s; }}
.region-cities a:hover {{ color: var(--accent); border-color: var(--accent); }}

/* ===== Flight stat cards ===== */
.flight-row {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }}
.flight-card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; border-top: 3px solid var(--rust); }}
.flight-icon {{ display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 9px; background: #fbeee4; font-size: 17px; margin-bottom: 8px; }}
.flight-val {{ font-size: 21px; font-weight: 800; letter-spacing: -0.02em; color: var(--rust); line-height: 1.1; margin-bottom: 2px; }}
.flight-label {{ font-size: var(--fs-label,11px); letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }}
.flight-sub {{ font-size: var(--fs-sub,12px); color: var(--muted); }}

/* ===== Bucket list ===== */
.bucket-row {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }}
.bucket-card {{ background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--navy); border-radius: 8px; padding: 12px 14px; }}
.bucket-top {{ display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 2px; }}
.bucket-name {{ font-size: 13px; font-weight: 600; color: var(--text); text-decoration: none; }}
.bucket-name:hover {{ color: var(--navy); }}
.bucket-time {{ font-size: var(--fs-sub,12px); color: var(--navy); font-weight: 700; white-space: nowrap; }}
.bucket-detail {{ font-size: var(--fs-sub,12px); color: var(--muted); }}

/* ===== New frontiers ===== */
.frontiers-card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; }}
.frontiers-chips {{ display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }}
.frontier-chip {{ font-size: var(--fs-sub,12px); padding: 5px 12px; border-radius: 20px; font-weight: 600; background: #eef2f9; color: var(--navy); border: 1px solid #c5d3ec; display: flex; align-items: center; gap: 6px; }}
.frontier-chip.visited {{ background: #fbeee4; color: var(--rust); border-color: #e6c3a8; }}

/* ===== By continent ===== */
.cont-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }}
.cont-card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; transition: box-shadow .15s, transform .15s; }}
.cont-card:hover {{ box-shadow: 0 3px 10px rgba(0,0,0,.07); transform: translateY(-1px); }}
.cont-head {{ display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 9px; }}
.cont-name {{ font-size: 13px; font-weight: 700; color: var(--text); }}
.cont-total {{ font-size: var(--fs-label,11px); font-weight: 600; color: var(--muted); }}
.cont-track {{ height: 8px; background: var(--track); border-radius: 4px; overflow: hidden; display: flex; }}
.cont-been {{ height: 100%; background: var(--rust); }}
.cont-want {{ height: 100%; background: var(--navy); }}
.cont-legend {{ font-size: var(--fs-label,11px); color: var(--muted); margin-top: 8px; display: flex; align-items: center; gap: 6px; }}
.cont-dot {{ width: 8px; height: 8px; border-radius: 2px; display: inline-block; }}
.cont-dot.been {{ background: var(--rust); }}
.cont-dot.want {{ background: var(--navy); margin-left: 8px; }}

/* ===== How you get there (routing) ===== */
.route-wrap {{ background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 18px 20px; margin-bottom: 20px; }}
.route-track {{ height: 14px; border-radius: 7px; overflow: hidden; display: flex; background: var(--track); }}
.route-seg {{ height: 100%; }}
.route-seg.nonstop {{ background: var(--rust); }}
.route-seg.onestop {{ background: var(--navy); }}
.route-seg.twostop {{ background: var(--navy-deep); }}
.route-legend {{ display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px; }}
.route-key {{ font-size: var(--fs-sub,12px); color: var(--muted); display: flex; align-items: center; gap: 6px; }}
.route-dot {{ width: 9px; height: 9px; border-radius: 2px; display: inline-block; }}
.route-dot.nonstop {{ background: var(--rust); }}
.route-dot.onestop {{ background: var(--navy); }}
.route-dot.twostop {{ background: var(--navy-deep); }}

/* ===== Gateway hubs ===== */
.hub-strip {{ display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }}
.hub-chip {{ background: var(--surface); border: 1px solid var(--border); border-radius: 9px; padding: 8px 13px; display: flex; align-items: baseline; gap: 8px; transition: box-shadow .15s, transform .15s; }}
.hub-chip:hover {{ box-shadow: 0 3px 10px rgba(0,0,0,.07); transform: translateY(-1px); }}
.hub-code {{ font-size: 15px; font-weight: 800; letter-spacing: 0.04em; color: var(--rust-deep); }}
.hub-count {{ font-size: var(--fs-label,11px); color: var(--muted); }}

/* ===== Most-covered countries ===== */
.ctry-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }}
.ctry-card {{ background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; transition: box-shadow .15s, transform .15s; }}
.ctry-card:hover {{ box-shadow: 0 3px 10px rgba(0,0,0,.07); transform: translateY(-1px); }}
.ctry-flag {{ font-size: 26px; line-height: 1; }}
.ctry-body {{ flex: 1; min-width: 0; }}
.ctry-name {{ font-size: 13px; font-weight: 700; color: var(--text); }}
.ctry-sub {{ font-size: var(--fs-label,11px); color: var(--muted); }}
.ctry-count {{ font-size: 22px; font-weight: 800; color: var(--rust); letter-spacing: -0.02em; }}

/* ===== Responsive ===== */
@media (max-width: 600px) {{
  .page {{ padding: 0 14px; }}
  .hero-row {{ grid-template-columns: repeat(2, 1fr); }}
  .quickfacts {{ grid-template-columns: repeat(2, 1fr); }}
  .flight-row {{ grid-template-columns: repeat(2, 1fr); }}
  .region-grid {{ grid-template-columns: 1fr; }}
  .cont-grid {{ grid-template-columns: 1fr; }}
  .ctry-grid {{ grid-template-columns: 1fr; }}
  .bucket-row {{ grid-template-columns: 1fr; }}
  .hero-num {{ font-size: 26px; }}
}}
html {{ scroll-behavior: smooth; }}
.hero-card, .qf, .region-card, .flight-card, .bucket-card {{ transition: box-shadow .15s, transform .15s; }}
.hero-card:hover, .qf:hover, .region-card:hover, .flight-card:hover, .bucket-card:hover {{ box-shadow: 0 3px 10px rgba(0,0,0,.07); transform: translateY(-1px); }}
/* ===== Section jump nav ===== */
.stats-nav {{ display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 0 0 18px; }}
.stats-nav a {{ font-size: 13px; line-height: 1; color: #6a5230; text-decoration: none; padding: 6px 12px; border: 1px solid var(--border2); border-radius: 6px; background: #fdf8f0; white-space: nowrap; transition: all .15s; }}
.stats-nav a:hover {{ border-color: #b85c2a; color: #fff; background: linear-gradient(135deg,#7a3b1e 0%,#b85c2a 55%,#d4874a 100%); font-weight: 600; }}
.stats-nav a.active {{ border-color: #b85c2a; color: #fff; background: linear-gradient(135deg,#7a3b1e 0%,#b85c2a 55%,#d4874a 100%); font-weight: 600; }}
.stats-nav a:focus-visible {{ outline: 2px solid #b85c2a; outline-offset: 1px; }}
.section-title {{ scroll-margin-top: 14px; }}
#overview {{ scroll-margin-top: 14px; }}
@media (max-width:600px) {{
  .stats-nav {{ flex-wrap: wrap; }}
}}
</style>
<link rel="stylesheet" href="../assets/mobile.css?v=48">
</head>
<body>

<div id="toolbar-mount" data-depth="1" data-maxwidth="940" data-no-footnote="1"></div>
<script src="../assets/toolbar.js?v=64"></script>

<div class="page">

  <div class="header">
    <h1>Travel Stats</h1>
    <div class="header-desc">A look at where I've been — and where I'm going next.</div>
  </div>
  <span class="updated-stamp">Updated {updated}</span>

  <!-- SECTION JUMP NAV -->
  <nav class="stats-nav" aria-label="Jump to section">
{nav_links}
  </nav>

  <!-- HERO NUMBERS -->
  <div class="hero-row" id="overview">
    <div class="hero-card total">
      <div class="hero-icon">📚</div>
      <div class="hero-num">{s["total"]}</div>
      <div class="hero-label">Total Guides</div>
    </div>
    <div class="hero-card been">
      <div class="hero-icon">📸</div>
      <div class="hero-num">{s["been_count"]}</div>
      <div class="hero-label">Been There</div>
    </div>
    <div class="hero-card want">
      <div class="hero-icon">🗺️</div>
      <div class="hero-num">{s["want_count"]}</div>
      <div class="hero-label">On the List</div>
    </div>
    <div class="hero-card country">
      <div class="hero-icon">🌍</div>
      <div class="hero-num">{s["countries_been"]}</div>
      <div class="hero-label">Countries Visited</div>
    </div>
  </div>

  <!-- QUICK FACTS -->
  <div class="quickfacts">
    <div class="qf">
      <span class="qf-icon">🧭</span>
      <span class="qf-val">{s["regions_visited"]}<span class="qf-of"> / {s["regions_total"]}</span></span>
      <span class="qf-label">Regions visited</span>
    </div>
    <div class="qf">
      <span class="qf-icon">🚩</span>
      <span class="qf-val">{s["countries_been"]}<span class="qf-of"> / {s["countries_total"]}</span></span>
      <span class="qf-label">Countries reached</span>
    </div>
    <div class="qf">
      <span class="qf-icon">⏱</span>
      <span class="qf-val">{s["avg_been_str"]}</span>
      <span class="qf-label">Avg flight (visited)</span>
    </div>
    <div class="qf">
      <span class="qf-icon">✈️</span>
      <span class="qf-val">{s["nonstop_been"]}<span class="qf-of"> / {s["nonstop_all"]}</span></span>
      <span class="qf-label">Nonstop from Seattle</span>
    </div>
  </div>

  <!-- BEEN VS WANT SPLIT -->
  <div class="section-title" id="sec-split">Been vs. Still Want to Go</div>
  <div class="split-wrap">
    <div class="split-labels">
      <span class="split-label been">✓ {s["been_count"]} been &nbsp;({int(s["been_pct"])}%)</span>
      <span class="split-label want">♡ {s["want_count"]} on the list &nbsp;({int(s["want_pct"])}%)</span>
    </div>
    <div class="split-track">
      <div class="split-been" style="width:{s["been_pct"]}%"></div>
      <div class="split-want"></div>
    </div>
    <div class="split-sub">{s["total"]} guides total — {s["fraction_desc"]}.</div>
  </div>

  <!-- FLIGHT STATS -->
  <div class="section-title" id="sec-flights">Flight Stats (from Seattle)</div>
  <div class="flight-row">
    <div class="flight-card">
      <div class="flight-icon">⏳</div>
      <div class="flight-label">Total one-way time to all been destinations</div>
      <div class="flight-val">{s["total_flight_str"]}</div>
      <div class="flight-sub">That's {s["total_flight_days"]} days in the air — one-way.</div>
    </div>
{farthest_html}
{farthest_want_html}
  </div>

  <!-- REGION BREAKDOWN — BEEN -->
  <div class="section-title" id="sec-been">Where I've Been — By Region</div>
  <div class="region-grid">
{render_region_grid(s["been_by_region"])}
  </div>

  <!-- BUCKET LIST SNEAK PEEK -->
  <div class="section-title" id="sec-bucket">Bucket List — Top Picks</div>
  <div class="bucket-row">
{render_bucket_list(s["bucket"])}
  </div>

  <!-- BUCKET LIST REGIONS — WANT -->
  <div class="section-title" id="sec-want">On the List — By Region</div>
  <div class="region-grid">
{render_region_grid(s["want_by_region"], want=True)}
  </div>

  <!-- NEW FRONTIERS -->
  <div class="section-title" id="sec-frontiers">New Frontiers</div>
  <div class="frontiers-card">
    <div style="font-size:13px;color:var(--muted);line-height:1.6;">Regions visited so far are highlighted. The rest are still waiting.</div>
    <div class="frontiers-chips">
{render_frontiers(s["been_regions"])}
    </div>
  </div>

  <!-- BY CONTINENT -->
  <div class="section-title" id="sec-continents">By Continent</div>
  <div class="cont-grid">
{render_continents(s["continents"])}
  </div>

  <!-- HOW YOU GET THERE -->
  <div class="section-title" id="sec-routing">How You Get There (from Seattle)</div>
  <div class="route-wrap">
{render_routing(s["routing"])}
  </div>

  <!-- GATEWAY HUBS -->
  <div class="section-title" id="sec-hubs">Gateway Hubs — Top Connecting Airports</div>
  <div class="hub-strip">
{render_hubs(s["hubs"])}
  </div>

  <!-- MOST-COVERED COUNTRIES -->
  <div class="section-title" id="sec-countries">Most-Covered Countries</div>
  <div class="ctry-grid">
{render_countries(s["top_countries"])}
  </div>

</div>
{spy_script}
</body>
</html>
'''

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print(f'Reading {INDEX_HTML}…')
    html_src = INDEX_HTML.read_text(encoding='utf-8')

    print('Parsing FMAP…')
    fmap = parse_fmap(html_src)
    print(f'  {len(fmap)} FMAP entries')

    print('Parsing dest-cards…')
    cards = parse_cards(html_src)
    print(f'  {len(cards)} cards found')

    print('Computing stats…')
    s = compute_stats(fmap, cards)

    if s['orphan_cards'] or s['orphan_fmap']:
        print('  ⚠️  COVERAGE GAP — these guides will be dropped from the Stats page:')
        for k in s['orphan_cards']:
            print(f'       • {k}  (dest-card present, no FMAP entry — add it to guides_index FMAP)')
        for k in s['orphan_fmap']:
            print(f'       • {k}  (FMAP entry present, no dest-card — add the card to guides_index)')

    print(f'  Total: {s["total"]} | Been: {s["been_count"]} | Want: {s["want_count"]}')
    print(f'  Countries: {s["countries_been"]}/{s["countries_total"]} visited')
    print(f'  Regions visited: {s["regions_visited"]} — {sorted(s["been_regions"])}')
    print(f'  Avg flight (been): {s["avg_been_str"]} | Nonstop from SEA: {s["nonstop_been"]} been / {s["nonstop_all"]} total')
    print(f'  Total flight time (been): {s["total_flight_str"]} ({s["total_flight_days"]} days)')
    if s['farthest_been']:
        fb = s['farthest_been']
        print(f'  Farthest been: {fb["name"]} ({fb["time"]})')
    if s['closest_want']:
        cw = s['closest_want']
        print(f'  Closest want: {cw["name"]} ({cw["time"]})')

    print('Generating HTML…')
    output = generate_html(s)

    if DRY_RUN:
        print(f'[DRY RUN] Would write {STATS_HTML} ({len(output):,} chars)')
        return 0

    STATS_HTML.write_text(output, encoding='utf-8')
    print(f'✅ Written: {STATS_HTML}')
    return 0

if __name__ == '__main__':
    sys.exit(main())
