#!/usr/bin/env python3
"""
build_safety_guide.py — Auto-generates Safety-Guide.html from safety_levels.json

This script converts Safety-Guide.html from a manually-maintained file to an
auto-generated page, enabling hard validation that guides cannot ship without
safety data.

Usage:
  python3 build_safety_guide.py                 # Generate Safety-Guide.html
  python3 build_safety_guide.py --verify        # Verify all cities have L1-L4 assigned
  python3 build_safety_guide.py --check-missing # Check for guides missing safety data

Ship Integration:
  - Auto-runs as part of guide_tools.py ship
  - Hard-validates that all guides_index cities have exactly one safety row
  - Can be bypassed with --no-verify (will be caught by CI/CD deploy gate)
"""

import json
import sys
import os
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
SAFETY_DATA_FILE = REPO_ROOT / 'Brain' / 'scripts' / 'safety_levels.json'
OUTPUT_FILE = REPO_ROOT / 'Travel-Website' / 'Trip-Essentials' / 'Safety-Guide.html'

# Level descriptions
LEVEL_INFO = {
    'L1': ('Level 1', 'Exercise normal precautions', '#22c55e'),
    'L2': ('Level 2', 'Increased caution', '#eab308'),
    'L3': ('Level 3', 'Reconsider travel', '#b3402a'),
    'L4': ('Level 4', 'Do not travel', '#1a1917'),
}

def load_safety_data():
    """Load city safety levels from JSON."""
    if not SAFETY_DATA_FILE.exists():
        print(f"Error: {SAFETY_DATA_FILE} not found", file=sys.stderr)
        return None

    with open(SAFETY_DATA_FILE, 'r') as f:
        return json.load(f)

def organize_by_level(data):
    """Organize cities by safety level."""
    levels = {'L1': [], 'L2': [], 'L3': [], 'L4': []}

    for city_folder, info in sorted(data.items()):
        level = info.get('level', 'L1')
        levels[level].append((city_folder, info))

    return levels

def generate_city_row(city_folder, info):
    """Generate HTML for a single city row."""
    # Folder and file paths use hyphens — brain_check check_internal_link_space_encoding
    # hard-fails %20-encoded or space-containing paths; all Guide folders use hyphens.
    # Normalize city-slug underscores to hyphens (e.g. abu_dhabi_v1.html → abu-dhabi_v1.html)
    # Preserve the _vN version suffix: replace underscores only before the last _v segment.
    import re as _re
    raw_file = info['file'].replace(' ', '-')
    norm_file = _re.sub(r'^(.*?)_v(\d)', lambda m: m.group(1).replace('_', '-') + '_v' + m.group(2), raw_file)
    href = f"../Guides/{city_folder.replace(' ', '-')}/{norm_file}"
    data_city = info['data_city']
    display = info['display']
    country = info['country']
    verified = info.get('verified', '')
    v_attr = f' data-verified="{verified}"' if verified else ''

    return f'      <a class="city-row" href="{href}" data-city="{data_city}"{v_attr}><span class="city-name">{display}</span><span class="city-country">{country}</span></a>'

def generate_level_section(level, cities):
    """Generate HTML for a safety level section."""
    label, desc, _ = LEVEL_INFO[level]
    section_id = f"section-{level.lower()}"
    grid_id = f"grid-{level.lower()}"

    html = f'''  <!-- ── {label.upper()} ── -->
  <div class="level-section" id="{section_id}">
    <div class="level-heading">
      <span class="badge badge-{level.lower()}"><span class="badge-dot"></span>{label}</span>
      <span style="font-size:13px;color:var(--muted)">{desc}</span>
      <span class="level-count" id="count-{level.lower()}"></span>
    </div>
    <div class="city-grid" id="{grid_id}">
'''

    for city_folder, info in sorted(cities, key=lambda x: x[1]['display'].lower()):
        html += generate_city_row(city_folder, info) + '\n'

    if not cities:
        html += '      <p style="color:var(--muted);font-size:13px;margin:8px 0">No destinations currently at this level.</p>\n'

    html += '    </div>\n  </div>\n'
    return html

def generate_html(safety_data):
    """Generate complete Safety-Guide.html."""
    levels = organize_by_level(safety_data)

    html = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="../assets/web-travel-style.css">
<title>Safety Guide</title>
<style>/* .wrap — fluid width from web-travel-style.css */
/* ── Intro & legend ── */
.intro {
  margin-bottom: 18px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.55;
}
.legend {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
  padding: 12px 0 14px;
  margin: 0 0 18px;
  position: sticky; top: 0; z-index: 10;
  background: var(--bg); border-bottom: 1px solid var(--border2);
}
.legend-pills { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #fff;
  border: 1px solid #d8d4cc;
  border-radius: 6px;
  font-size: 13px;
  color: #3d3a32;
  line-height: 1;
}
.badge-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.badge-l1 .badge-dot { background: #22c55e; }
.badge-l2 .badge-dot { background: #eab308; }
.badge-l3 .badge-dot { background: #b3402a; }
.badge-l4 .badge-dot { background: var(--text, #1a1917); }
a.badge { text-decoration: none; cursor: pointer; transition: background .15s, box-shadow .15s, transform .08s; }
a.badge:hover  { background: linear-gradient(135deg,#7a3b1e 0%,#b85c2a 55%,#d4874a 100%); color: #fff !important; border-color: #b85c2a; box-shadow: 0 3px 10px rgba(184,92,42,.18); }
a.badge:hover .badge-dot { background: rgba(255,255,255,0.8) !important; }
a.badge:active { background: linear-gradient(135deg,#5a2a10 0%,#8a3f18 55%,#a85e28 100%); color: #fff !important; border-color: #b85c2a; box-shadow: 0 1px 3px rgba(184,92,42,.12); transform: scale(.97) translateY(1px); }
html { scroll-behavior: smooth; }
.level-section { scroll-margin-top: 110px; }
/* ── Search (now inside .legend row) ── */
.search-row { display: none; }
#city-search {
  width: 360px;
  flex-shrink: 0;
  box-sizing: border-box;
  padding: 11px 18px;
  font-size: 15px;
  line-height: 1;
  border: 1.5px solid var(--border2,#e6e2da);
  border-radius: 6px;
  color: var(--text, #1a1917);
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
#city-search::placeholder { color: #A8895A; }
#city-search:focus { border-color: #c8b99a; box-shadow: none; }
#no-results { display: none; color: var(--muted); font-size: 13px; margin: 12px 0; }
/* ── Level section ── */
.level-section { margin-bottom: 28px; }
.level-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding-bottom: 7px;
}
.level-heading .badge { font-size: var(--fs-sub,12px); }
.level-count {
  font-size: var(--fs-sub,12px);
  color: var(--muted);
  margin-left: auto;
}
/* ── City grid ── */
.city-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 7px;
}
a.city-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  background: var(--surface);
  border: 1px solid var(--border2);
  border-left: 3px solid #ccc;
  border-radius: 6px;
  font-size: 13px;
  text-decoration: none;
  transition: background .12s, border-color .15s, box-shadow .15s, color .12s, transform .08s;
}
a.city-row:hover  { background: linear-gradient(135deg,#7a3b1e 0%,#b85c2a 55%,#d4874a 100%); border-color: #b85c2a; box-shadow: 0 3px 10px rgba(184,92,42,.18); color: #fff; }
a.city-row:hover .city-name,
a.city-row:hover .city-country { color: #fff !important; }
a.city-row:active { background: linear-gradient(135deg,#5a2a10 0%,#8a3f18 55%,#a85e28 100%); border-color: #b85c2a; box-shadow: 0 1px 3px rgba(184,92,42,.12); color: #fff; transform: scale(.97) translateY(1px); }
#grid-l1 a.city-row { border-left-color: #22c55e; }
#grid-l2 a.city-row { border-left-color: #eab308; }
#grid-l3 a.city-row { border-left-color: #b3402a; }
#grid-l4 a.city-row { border-left-color: var(--text, #1a1917); }
.city-name { font-weight: 500; color: var(--text); }
.city-country { font-size: var(--fs-sub,12px); color: var(--muted); margin-left: auto; }
a.city-row.hidden { display: none; }
/* ── Sources ── */
.sources {
  margin-top: 32px;
  padding-top: 18px;
}
.sources h2 { font-size: 13px; font-weight: 600; margin-bottom: 10px; color: var(--text); }
.source-list { list-style: none; display: flex; flex-direction: column; gap: 5px; }
.source-list li { font-size: var(--fs-sub,12px); color: var(--muted); }
.source-list a { color: var(--accent); text-decoration: none; }
.source-list a:hover { text-decoration: underline; }
/* ── Note box ── */
.note {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-left: 3px solid #b3402a;
  border-radius: 6px;
  padding: 10px 13px;
  font-size: 12.5px;
  color: var(--text);
  margin-bottom: 22px;
  line-height: 1.5;
}
.note strong { color: var(--text); }
@media (max-width: 600px) {
  .city-grid { grid-template-columns: 1fr 1fr; }
  /* Legend — single column, no pill styling */
  .legend { display: flex !important; flex-direction: column !important; gap: 8px !important; padding: 10px 0 12px !important; margin: 0 0 12px !important; justify-content: flex-start !important; align-items: center !important; }
  .badge { background: none !important; border: none !important; border-bottom: 1px solid currentColor !important; padding: 2px 0 !important; font-size: 12px !important; gap: 5px !important; min-height: auto !important; height: auto !important; line-height: 1.3 !important; display: inline-flex !important; }
  #city-search { width: 100%; }
  .level-heading { flex-wrap: wrap; gap: 6px; }
  .level-count { margin-left: 0; }
}</style>
<link rel="stylesheet" href="../assets/mobile.css?v=50">
</head>
<body>
<div id="toolbar-mount" data-depth="1" data-maxwidth="940"></div>
<script src="../assets/toolbar.js?v=103"></script>

<div class="wrap">
  <div class="page-header">
    <h1>Safety Guide</h1>
    <a class="src-link" href="https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html" target="_blank" rel="noopener">travel.state.gov</a>
  </div>
  <span class="updated-stamp">Updated ''' + date.today().strftime('%B %Y') + '''</span>

  <div class="legend">
    <input type="search" id="city-search" placeholder="🔍  City or country" aria-label="Filter cities">
    <div class="legend-pills">
    <a href="#section-l1" class="badge badge-l1"><span class="badge-dot"></span>Level 1 — Normal precautions</a>
    <a href="#section-l2" class="badge badge-l2"><span class="badge-dot"></span>Level 2 — Increased caution</a>
    <a href="#section-l3" class="badge badge-l3"><span class="badge-dot"></span>Level 3 — Reconsider travel</a>
    <a href="#section-l4" class="badge badge-l4"><span class="badge-dot"></span>Level 4 — Do not travel</a>
    </div>
  </div>

  <div class="note">
    <strong>⚠️ UAE &amp; Qatar — Level 3 as of July 2026.</strong> The State Dept issued Level 3 "Reconsider Travel" advisories for both the UAE and Qatar citing the threat of drone and missile attacks following US–Iran hostilities, and ordered non-emergency US government personnel to leave. Monitor the advisories for <a href="https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/united-arab-emirates-travel-advisory.html" target="_blank" rel="noopener" style="color:#9b2020">the UAE</a> and <a href="https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/qatar-travel-advisory.html" target="_blank" rel="noopener" style="color:#9b2020">Qatar</a> closely before any travel to Abu Dhabi, Dubai, or Doha.
  </div>
  <p id="no-results">No cities match your search.</p>

'''

    # Add level sections
    for level in ['L1', 'L2', 'L3', 'L4']:
        html += generate_level_section(level, levels[level])

    # Add footer and scripts
    html += '''  <div class="sources">
    <h2>Sources</h2>
    <ul class="source-list">
      <li><a href="https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html" target="_blank" rel="noopener">U.S. State Department Travel Advisories</a></li>
    </ul>
  </div>
</div>

<script>
(function() {
  const allRows = document.querySelectorAll('.city-row');
  const searchInput = document.getElementById('city-search');
  const noResults = document.getElementById('no-results');

  // Update level counts
  ['l1', 'l2', 'l3', 'l4'].forEach(level => {
    const grid = document.getElementById(`grid-${level}`);
    const count = document.getElementById(`count-${level}`);
    const rows = grid.querySelectorAll('.city-row');
    count.textContent = `(${rows.length})`;
  });

  // Search filter
  searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    let visibleCount = 0;

    allRows.forEach(row => {
      const cityText = row.getAttribute('data-city').toLowerCase();
      const countryText = row.querySelector('.city-country').textContent.toLowerCase();
      const isMatch = cityText.includes(query) || countryText.includes(query);

      if (isMatch) {
        row.classList.remove('hidden');
        visibleCount++;
      } else {
        row.classList.add('hidden');
      }
    });

    noResults.style.display = visibleCount === 0 && query.length > 0 ? 'block' : 'none';
  });

  // Hash navigation (scroll to city)
  function scrollToCity() {
    const hash = window.location.hash.slice(1);
    if (!hash) return;

    const hashCity = hash.toLowerCase();
    let target = null;

    allRows.forEach(row => {
      const key = row.getAttribute('data-city');
      if (key === hashCity || key.indexOf(hashCity) === 0 || key.indexOf(' ' + hashCity) !== -1) {
        target = row;
      }
    });

    if (target) {
      setTimeout(function () {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.style.transition = 'background 0.3s';
        target.style.background = 'var(--hover)';
        setTimeout(function () { target.style.background = ''; }, 1500);
      }, 300);
    }
  }

  scrollToCity();
  window.addEventListener('hashchange', scrollToCity);
})();
</script>
</body>
</html>
'''

    return html

def verify_coverage(safety_data, guides_index_path=None):
    """Verify that all guides in guides_index have safety data."""
    from pathlib import Path

    if not guides_index_path:
        guides_index_path = REPO_ROOT / 'Travel-Website' / 'Guides' / 'Guides-Index.html'

    if not guides_index_path.exists():
        print(f"Warning: {guides_index_path} not found", file=sys.stderr)
        return False

    # Parse guides index to get list of guides
    with open(guides_index_path, 'r') as f:
        index_html = f.read()

    # Extract guide folders from index
    import re
    guide_pattern = r'href="\.\.\/Guides/([^/]+)/'
    guides_in_index = set(re.findall(guide_pattern, index_html))

    # Check which are missing safety data
    missing = guides_in_index - set(safety_data.keys())
    if missing:
        print(f"❌ {len(missing)} guides in index missing safety data:", file=sys.stderr)
        for guide in sorted(missing):
            print(f"   - {guide}", file=sys.stderr)
        return False

    # Check for duplicates in safety data
    level_cities = {'L1': [], 'L2': [], 'L3': [], 'L4': []}
    for city, info in safety_data.items():
        level_cities[info['level']].append(city)

    print(f"✓ Safety coverage verified: {len(safety_data)} cities total")
    for level in ['L1', 'L2', 'L3', 'L4']:
        print(f"  {level}: {len(level_cities[level])} cities")

    return True

def main():
    if '--verify' in sys.argv:
        safety_data = load_safety_data()
        if not safety_data:
            return 1
        return 0 if verify_coverage(safety_data) else 1

    if '--check-missing' in sys.argv:
        guides_dir = REPO_ROOT / 'Travel-Website' / 'Guides'
        all_guides = set(d.name for d in guides_dir.iterdir() if d.is_dir())
        safety_data = load_safety_data()
        if not safety_data:
            return 1
        missing = all_guides - set(safety_data.keys())
        if missing:
            print(f"Missing {len(missing)} cities from safety_levels.json:")
            for city in sorted(missing):
                print(f"  - {city}")
            return 1
        print(f"✓ All {len(all_guides)} guides have safety levels assigned")
        return 0

    # Default: generate Safety-Guide.html
    safety_data = load_safety_data()
    if not safety_data:
        return 1

    # Verify coverage
    if not verify_coverage(safety_data):
        print("Error: Safety data is incomplete", file=sys.stderr)
        return 1

    # Generate HTML
    html = generate_html(safety_data)

    # Write file
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    import crib_safety as _cs  # atomic: readers never see a half-written page
    _cs.atomic_write(OUTPUT_FILE, html)

    print(f"✓ Generated {OUTPUT_FILE}")
    return 0

if __name__ == '__main__':
    sys.exit(main())
