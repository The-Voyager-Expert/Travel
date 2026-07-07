#!/usr/bin/env python3
"""
validate_guide_coverage.py — whole-fleet guide coverage sweep.

SOURCE OF TRUTH: the Guides/ directory. For EVERY shipped guide folder (one whose
HTML carries the `<!-- validation: passed -->` stamp), this asserts the guide is
present — with a link that resolves to a real file — in every cross-guide surface:

  index card     Guides/Guides-Index.html              (./<folder>/ dest-card href + link)
  index inline   Guides/Guides-Index.html              (CLIMATE_INLINE / COST_DATA / SAFETY_DATA)
  FMAP           Guides/Guides-Index.html              (flight-time view entry)
  theme          Guides/Guides-Index.html              (THEME_DATA — Type ▾ filter)
  days           Guides/Guides-Index.html              (DAYS_DATA — Trip Length ▾ filter)
  lang           Guides/Guides-Index.html              (data-lang on dest-card — Language ▾ filter)
  best-of        Trip-Essentials/Best-*.html           (<!-- best-of: ... --> declared + link present)
  map pin        Trip-Essentials/Maps/World-Map.html   (PINS array + link)
  travel stats   Trip-Essentials/Travel-Stats.html     (guide link)
  safety         Trip-Essentials/Safety-Guide.html     (one row + link)
  climate        assets/climate.json + assets/weather.js (both Weather tabs)
  search index   assets/search_index.json              (guides list)
  status dots    Brain/Reference/Status Dots — guides_index.md   (Brain-only tracker)
  currency       build_currency.py COUNTRIES                     (Brain-only, per-country)
  time zones     Trip-Essentials/Time-Zones.html               (CITIES entry + url link)

WHY THIS EXISTS
The per-guide ship gates in guide_tools.py already enforce each surface AT SHIP TIME
for the one guide being shipped. They do NOT re-check the rest of the fleet. This
sweep is the whole-fleet backstop: it re-checks EVERY guide against EVERY surface,
catching drift introduced *after* a guide shipped — a card or pin deleted in a later
edit, a version-bumped/renamed file that orphans an existing link, or a guide that
was hand-pushed around the gate. The ship gate protects guide N+1; this protects
guides 1..N forever.

A guide counts as "shipped" only if its HTML carries the validation-passed stamp —
the same definition the Pages deploy uses — so in-progress builds (untracked, no
stamp) are never flagged.

USAGE
  python3 Brain/scripts/validate_guide_coverage.py            # full sweep, exit 1 on any gap (strict)
  python3 Brain/scripts/validate_guide_coverage.py --fails-only

CI BACKSTOP
The published-surface subset (everything except the two Brain-only trackers, which
are authoring material and never reach users) is independently enforced in CI by
.github/scripts/check_coverage.py, which gates the GitHub Pages deploy on a path that
`--no-verify` auto-push cannot bypass.

Added 2026-06-22.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path
from urllib.parse import quote, unquote

HERE        = Path(__file__).resolve().parent          # Brain/scripts/
BRAIN_DIR   = HERE.parent                              # Brain/
TRAVEL_ROOT = BRAIN_DIR.parent                         # Travel/
WEB_ROOT    = TRAVEL_ROOT / "Travel-Website"           # published site root
GUIDES_DIR  = WEB_ROOT / "Guides"
ESSENTIALS  = WEB_ROOT / "Trip-Essentials"
ASSETS_DIR  = WEB_ROOT / "assets"
MAPS_DIR    = ESSENTIALS / "Maps"
REFERENCE   = BRAIN_DIR / "Reference"

STAMP = "<!-- validation: passed"

PASS = "✅"
FAIL = "❌"
WARN = "⚠️ "


# ── shipped-guide discovery ──────────────────────────────────────────────────

def shipped_guides() -> list[tuple[str, Path]]:
    """Return [(folder_name, stamped_html_path)] for every shipped guide.

    A folder is a shipped guide iff it holds at least one *.html that carries the
    `<!-- validation: passed -->` stamp. In-progress builds (no stamp) are skipped
    — this mirrors the Pages deploy's definition of a publishable guide. Where a
    folder has several stamped files, the lexicographically-last (highest version)
    is used as the canonical link target.
    """
    out: list[tuple[str, Path]] = []
    if not GUIDES_DIR.exists():
        return out
    for folder in sorted(p for p in GUIDES_DIR.iterdir() if p.is_dir()):
        stamped = []
        for html in sorted(folder.glob("*.html")):
            try:
                if STAMP in html.read_text(encoding="utf-8", errors="replace"):
                    stamped.append(html)
            except OSError:
                continue
        if stamped:
            out.append((folder.name, stamped[-1]))
    return out


# ── helpers ──────────────────────────────────────────────────────────────────

def _norm(s: str) -> str:
    """Accent-fold + strip non-alphanumerics + lowercase, for matching a guide
    across surfaces that key on the display name rather than the ASCII folder.
    'Curaçao' / 'Curacao', 'Ålesund' / 'Alesund', 'Machu Picchu' / 'MachuPicchu',
    'Zürich' / 'Zurich' all collapse to the same token.
    """
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def _json_block(html: str, var_name: str) -> dict:
    """Parse `var NAME = {...};` out of an HTML/JS blob; {} if absent/unparseable."""
    m = re.search(rf"var {re.escape(var_name)}\s*=\s*(\{{.*?\}})\s*;", html, re.DOTALL)
    if not m:
        return {}
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return {}


def _link_ok(base_dir: Path, href: str) -> bool:
    """True if a relative href resolves to a file that exists on disk."""
    href = unquote(href.split("#")[0].split("?")[0])
    try:
        return (base_dir / href).resolve().is_file()
    except (OSError, ValueError):
        return False


def _find_guide_href(text: str, prefix: str, folder: str) -> str | None:
    """Find a guide href for `folder` under `prefix` in `text`, returning the raw
    href string (or None). Tolerant of folder names written with literal spaces OR
    percent-encoded (`%20`) — the index uses literal spaces, the data pages encode.
    Also handles partial encoding where non-ASCII chars are literal but spaces are %20.
    """
    space_encoded = re.sub(r' ', '%20', folder)  # João%20Pessoa — partial encoding
    candidates = {folder, quote(folder), space_encoded}
    for f in candidates:
        m = re.search(rf'href="({re.escape(prefix)}{re.escape(f)}/[^"]+\.html)"', text)
        if m:
            return m.group(1)
    return None


# ── the sweep ────────────────────────────────────────────────────────────────

# Surface keys, in report order. Each value is a short human label.
SURFACES = {
    "card":      "index card",
    "inline":    "index inline data",
    "fmap":      "FMAP (flight view)",
    "theme":     "THEME_DATA (Type filter)",
    "days":      "DAYS_DATA (Trip Length filter)",
    "lang":      "data-lang (Language filter)",
    "best-of":   "Best-of declaration + membership",
    "pin":       "map pin",
    "stats":     "travel stats",
    "safety":    "safety guide",
    "climate":   "climate (weather tabs)",
    "search":    "search index",
    "status":    "status dots",
    "currency":  "currency guide",
    "resources": "also-on-this-site links",
    "delta":     "Delta Routes card (Step 10)",
    "timezones": "Time-Zones.html (Step 9)",
}


def run_sweep() -> dict[str, list[str]]:
    """Return {surface_key: [folder, ...]} of guides MISSING from each surface."""
    guides = shipped_guides()

    index_html = _read(GUIDES_DIR / "Guides-Index.html")
    world_html = _read(MAPS_DIR / "World-Map.html")
    stats_html = _read(ESSENTIALS / "Travel-Stats.html")
    safety_html = _read(ESSENTIALS / "Safety-Guide.html")
    delta_html = _read(ESSENTIALS / "Delta-Routes-SEA.html")
    tz_html    = _read(ESSENTIALS / "Time-Zones.html")
    status_md  = _read(REFERENCE / "Status Dots — guides_index.md")

    climate_keys: set[str] = set()
    cj = ASSETS_DIR / "climate.json"
    if cj.exists():
        try:
            climate_keys = {_norm(k) for k in json.loads(_read(cj)) if k != "_meta"}
        except json.JSONDecodeError:
            pass

    # weather.js baked CLIMATE block — the keys the Weather tabs actually read.
    weather_js = _read(ASSETS_DIR / "weather.js")
    weather_keys: set[str] = set()
    wm = re.search(
        r"CLIMATE_DATA_START\s*\*/\s*var CLIMATE = (\{.*?\});\s*/\*\s*CLIMATE_DATA_END",
        weather_js, re.DOTALL,
    )
    if wm:
        try:
            weather_keys = {_norm(k) for k in json.loads(wm.group(1))}
        except json.JSONDecodeError:
            pass
    if not weather_keys:  # fallback: any bare "Key": in the file
        weather_keys = {_norm(k) for k in re.findall(r'"([^"]+)"\s*:', weather_js)}

    # status-dots bullet labels (text before "(", "—", "·"), normalized.
    status_labels: set[str] = set()
    for line in status_md.splitlines():
        bm = re.match(r'^\s*-\s+(?:\[.\]\s+)?(.+)$', line)
        if bm:
            label = re.split(r'[(—·–|]', bm.group(1))[0]
            status_labels.add(_norm(label))

    search_folders: set[str] = set()
    search_names: set[str] = set()
    sj = ASSETS_DIR / "search_index.json"
    if sj.exists():
        try:
            sd = json.loads(_read(sj))
            for g in sd.get("guides", []):
                u = g.get("u", "")
                if u:
                    search_folders.add(unquote(u).split("/")[0])
                if g.get("c"):
                    search_names.add(g["c"])
        except json.JSONDecodeError:
            pass

    # Inline data blocks (keyed by folder OR display name).
    inline_blocks = {
        name: _json_block(index_html, name)
        for name in ("CLIMATE_INLINE", "COST_DATA", "SAFETY_DATA")
    }

    # THEME_DATA (Type ▾ filter) — keys are display names.
    theme_data = _json_block(index_html, "THEME_DATA")
    theme_keys_norm = {_norm(k) for k in theme_data}

    # DAYS_DATA (Trip Length ▾ filter) — keys are display names.
    days_data = _json_block(index_html, "DAYS_DATA")
    days_keys_norm = {_norm(k) for k in days_data}

    # data-lang on dest-cards — extract folder → lang string from index HTML.
    card_langs: dict[str, str] = {}
    for m in re.finditer(
        r'<a class="dest-card"[^>]*href="\./([^/]+)/[^"]+\.html"[^>]*data-lang="([^"]*)"',
        index_html,
    ):
        card_langs[unquote(m.group(1))] = m.group(2).strip()
    # FMAP keys (loose, lowercased substring match — mirrors _check_guide_fmap).
    fmap = _json_block(index_html, "FMAP")
    fmap_keys_lower = [unquote(k).lower() for k in fmap]

    # Home/origin city (flights are "from <home>") — build_travel_stats.py excludes
    # any FMAP entry whose routing is "home" from the destination stats, so it must
    # NOT be required on the stats page even though it's a full guide. Derive it from
    # the data (not hardcoded) so it follows a future origin change. (build_travel_stats.py:169,191)
    home_folders = {
        unquote(k).split("/")[0] for k, fd in fmap.items()
        if isinstance(fd, dict) and fd.get("r") == "home"
    }

    # folder -> display name (the JS fallback key for inline/search).
    folder_to_name: dict[str, str] = {}
    for href, name in re.findall(
        r'<a class="dest-card"(?:(?!data-special)[^>])*href="([^"]+)"[^>]*>.*?<span class="dest-name">([^<]+)</span>',
        index_html, re.DOTALL,
    ):
        folder_to_name[unquote(href).lstrip("./").split("/")[0]] = name.strip()

    # Delta Routes Step 10: every shipped guide must have a dest-card or us-card
    # with data-guide="FolderName" in Delta-Routes-SEA.html. This is the MANUAL
    # routing card (with tier + routing info) — not the auto-generated GUIDES JS
    # map. Seattle is the origin city and is exempt.
    import re as _re
    delta_card_guides = set(_re.findall(r'data-guide="([^"]+)"', delta_html))

    # Time-Zones Step 9: every shipped guide must have a CITIES entry that
    # carries a url: field pointing back to the guide HTML.
    # Build two lookups from the CITIES array:
    #   tz_guide_folders — set of folder names extracted from url: paths
    #   tz_has_url       — same set (an entry without url: never appears here)
    tz_guide_folders: set[str] = set()
    if tz_html:
        for m in re.finditer(r"url\s*:\s*['\"](\.\./Guides/([^/'\"]+)/[^'\"]+\.html)['\"]", tz_html):
            tz_guide_folders.add(unquote(m.group(2)))

    # Currency cities (Brain-only; load build_currency.COUNTRIES if reachable).
    currency_cities: set[str] | None = None
    bc_path = HERE / "build_currency.py"
    if bc_path.exists():
        try:
            import importlib.util as _ilu
            spec = _ilu.spec_from_file_location("bc_cov", str(bc_path))
            bc = _ilu.module_from_spec(spec)
            spec.loader.exec_module(bc)
            currency_cities = {_norm(c) for row in bc.COUNTRIES for c in row[7]}
        except Exception:  # noqa: BLE001 — advisory; treat as unavailable
            currency_cities = None

    # Best-of pages — load each Best-*.html so we can check guide link presence.
    # Keyed by filename (e.g. "Best-Beaches.html") → html content.
    best_of_pages: dict[str, str] = {}
    for bp in sorted((ESSENTIALS).glob("Best-*.html")):
        if bp.name != "Best-Of-Index.html":
            try:
                best_of_pages[bp.name] = bp.read_text(encoding="utf-8", errors="replace")
            except OSError:
                pass

    # Canonical topic → filename map (mirrors _BEST_OF_PAGES in guide_tools.py).
    BEST_OF_MAP = {
        "Amusement Parks": "Best-Amusement-Parks.html",
        "Aquariums": "Best-Aquariums.html",
        "Architecture": "Best-Architecture.html",
        "Art Museums": "Best-Art-Museums.html",
        "Beaches": "Best-Beaches.html",
        "Castles": "Best-Castles.html",
        "Cathedrals": "Best-Cathedrals.html",
        "Caves": "Best-Caves.html",
        "Gardens": "Best-Gardens.html",
        "Hot Springs": "Best-Hot-Springs.html",
        "Islands": "Best-Islands.html",
        "Kid-Friendly Places": "Best-Kids-Friendly-Places.html",
        "Kids' Museums": "Best-Kids-Museums.html",
        "Lakes": "Best-Lakes.html",
        "Mountains & Rock Formations": "Best-Mountains-and-Rock-Formations.html",
        "Museums": "Best-Museums.html",
        "National Parks by Country": "Best-National-Parks-by-Country.html",
        "Observation Decks": "Best-Observation-Decks.html",
        "Resorts": "Best-Resorts.html",
        "Safari": "Best-Safari.html",
        "Scuba Diving": "Best-Scuba-Diving.html",
        "Ski Resorts": "Best-Ski-Resorts.html",
        "Surfing": "Best-Surfing.html",
        "UNESCO Sites": "Best-UNESCO-Sites.html",
        "Unique Museums": "Best-Unique-Museums.html",
        "US National Parks": "Best-US-National-Parks.html",
        "Volcanoes": "Best-Volcanoes.html",
        "Wine Regions": "Best-Wine-Regions.html",
        "Wonders of the World": "Best-Wonders-of-the-World.html",
    }

    missing: dict[str, list[str]] = {k: [] for k in SURFACES}

    for folder, _html in guides:
        name = folder_to_name.get(folder)
        keys = {folder} | ({name} if name else set())
        # accent-folded candidates for surfaces that key on the display name
        cand = {_norm(folder)} | ({_norm(name)} if name else set())

        # index card (dest-card anchor to this folder) + link resolution
        card_href = None
        for f in {re.escape(folder), re.escape(quote(folder))}:
            cm = re.search(rf'<a class="dest-card"[^>]*href="(\./{f}/[^"]+\.html)"', index_html)
            if cm:
                card_href = cm.group(1)
                break
        if not card_href or not _link_ok(GUIDES_DIR, card_href):
            missing["card"].append(folder)

        # index inline data (all three blocks)
        if any(not (keys & set(blk)) for blk in inline_blocks.values()):
            missing["inline"].append(folder)

        # FMAP (loose substring)
        if not any(folder.lower() in k for k in fmap_keys_lower):
            missing["fmap"].append(folder)

        # THEME_DATA (Type ▾ filter) — keyed by display name
        if theme_data and not (cand & theme_keys_norm):
            missing["theme"].append(folder)

        # DAYS_DATA (Trip Length ▾ filter) — keyed by display name
        if days_data and not (cand & days_keys_norm):
            missing["days"].append(folder)

        # data-lang on dest-card (Language ▾ filter)
        if not card_langs.get(folder):
            missing["lang"].append(folder)

        # Read guide HTML once — used for best-of and also-on-this-site checks.
        try:
            guide_html = _html.read_text(encoding="utf-8", errors="replace")
        except OSError:
            guide_html = ""

        # Best-of declaration + membership.
        # Only hard-fail when a declaration IS present but the guide link is
        # missing from the named page (real gap). Missing declaration on legacy
        # guides is tracked separately (advisory — not a hard sweep failure).
        bom = re.search(r'<!--\s*best-of\s*:\s*([^-][^>]*?)-->', guide_html, re.IGNORECASE)
        if not bom:
            # No declaration yet — advisory only (not added to missing["best-of"])
            pass
        else:
            raw_topics = bom.group(1).strip()
            if raw_topics.lower() != "none":
                for topic in (t.strip() for t in raw_topics.split(",") if t.strip()):
                    page_name = BEST_OF_MAP.get(topic)
                    if not page_name:
                        missing["best-of"].append(folder)  # unknown topic
                        break
                    page_html_bo = best_of_pages.get(page_name, "")
                    if f"../Guides/{folder}/" not in page_html_bo:
                        missing["best-of"].append(folder)  # declared but not linked
                        break

        # map pin (PINS-array href) + link resolution
        pin_href = None
        for f in {re.escape(folder), re.escape(quote(folder))}:
            pm = re.search(rf"['\"](\.\./\.\./Guides/{f}/[^'\"]+\.html)['\"]", world_html)
            if pm:
                pin_href = pm.group(1)
                break
        if not pin_href or not _link_ok(MAPS_DIR, pin_href):
            missing["pin"].append(folder)

        # travel stats + link resolution (home/origin city is excluded by design)
        if folder not in home_folders:
            stats_href = _find_guide_href(stats_html, "../Guides/", folder)
            if not stats_href or not _link_ok(ESSENTIALS, stats_href):
                missing["stats"].append(folder)

        # safety guide + link resolution
        safety_href = _find_guide_href(safety_html, "../Guides/", folder)
        if not safety_href or not _link_ok(ESSENTIALS, safety_href):
            missing["safety"].append(folder)

        # climate: present in climate.json AND the baked weather.js block
        if not (cand & climate_keys) or not (cand & weather_keys):
            missing["climate"].append(folder)

        # search index
        if folder not in search_folders and not (name and name in search_names):
            missing["search"].append(folder)

        # status dots (Brain-only)
        if status_md and not (cand & status_labels):
            missing["status"].append(folder)

        # currency (Brain-only)
        if currency_cities is not None and not (cand & currency_cities):
            missing["currency"].append(folder)

        # Delta Routes Step 10 card — every shipped guide (except Seattle) must
        # have a dest-card or us-card with data-guide="FolderName" in
        # Delta-Routes-SEA.html. Seattle is the origin city and is exempt.
        if delta_card_guides and folder != "Seattle" and folder not in delta_card_guides:
            missing["delta"].append(folder)

        # also-on-this-site block must exist (links vary per guide)
        if ("<!-- also-on-this-site -->" not in guide_html.lower()
                or "<!-- /also-on-this-site -->" not in guide_html.lower()):
            missing["resources"].append(folder)

        # Time-Zones Step 9 — entry with url: pointing to this guide's folder
        if tz_html and folder not in tz_guide_folders:
            missing["timezones"].append(folder)

    missing["__count__"] = [str(len(guides))]  # piggyback the total for the report
    if currency_cities is None:
        missing["__skip_currency__"] = ["1"]
    if not status_md:
        missing["__skip_status__"] = ["1"]
    if not delta_html:
        missing["__skip_delta__"] = ["1"]
    if not tz_html:
        missing["__skip_timezones__"] = ["1"]
    return missing


def main() -> int:
    fails_only = "--fails-only" in sys.argv

    res = run_sweep()
    total = int(res.pop("__count__", ["0"])[0])
    skip_currency = res.pop("__skip_currency__", None) is not None
    skip_status = res.pop("__skip_status__", None) is not None
    skip_delta = res.pop("__skip_delta__", None) is not None
    skip_timezones = res.pop("__skip_timezones__", None) is not None

    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"  🗺  Guide coverage sweep — {total} shipped guides")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    if total == 0:
        print(f"\n  {WARN} No shipped guides found under Guides/ (no validation-passed stamps).")
        return 0

    # Per-surface rollup (most actionable view).
    any_gap = False
    for key, label in SURFACES.items():
        if key == "currency" and skip_currency:
            print(f"  {WARN} {label:<24} skipped (build_currency.py not reachable)")
            continue
        if key == "status" and skip_status:
            print(f"  {WARN} {label:<24} skipped (Status Dots tracker not reachable)")
            continue
        if key == "delta" and skip_delta:
            print(f"  {WARN} {label:<24} skipped (Delta-Routes-SEA.html not reachable)")
            continue
        if key == "timezones" and skip_timezones:
            print(f"  {WARN} {label:<24} skipped (Time-Zones.html not reachable)")
            continue
        miss = res.get(key, [])
        if miss:
            any_gap = True
            print(f"  {FAIL} {label:<24} {len(miss)} missing: {', '.join(miss[:12])}"
                  + (f" …+{len(miss) - 12}" if len(miss) > 12 else ""))
        elif not fails_only:
            print(f"  {PASS} {label:<24} all {total} present")

    # Per-guide rollup of which surfaces each affected guide misses.
    by_guide: dict[str, list[str]] = {}
    for key, label in SURFACES.items():
        for folder in res.get(key, []):
            by_guide.setdefault(folder, []).append(label)
    if by_guide:
        print("\n  Per-guide gaps:")
        for folder in sorted(by_guide):
            print(f"    {FAIL} {folder} — missing: {', '.join(by_guide[folder])}")

    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    if not any_gap:
        print(f"  {PASS} Every shipped guide is present in every surface, with resolving links.")
        print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
        return 0

    print(f"  {FAIL} Coverage gaps found — {len(by_guide)} guide(s) missing from one or more surfaces.")
    print("     Fix by completing the index/pin/stats/etc. entry for each, then re-run.")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
    return 1


if __name__ == "__main__":
    sys.exit(main())
