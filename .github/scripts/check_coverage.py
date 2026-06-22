#!/usr/bin/env python3
"""
check_coverage.py — CI guide-coverage gate (published surfaces).

Runs inside the GitHub Pages deploy workflow (deploy-pages.yml) on a path that
`--no-verify` auto-push CANNOT bypass. For every shipped guide (a Guides/<folder>/
HTML carrying the `<!-- validation: passed -->` stamp) it asserts the guide is
present — with a link that resolves to a real file — in every surface that actually
ships to users:

  index card     Guides/Guides-Index.html              (dest-card href + link)
  index inline   Guides/Guides-Index.html              (CLIMATE_INLINE / COST_DATA / SAFETY_DATA)
  FMAP           Guides/Guides-Index.html              (flight-time view entry)
  map pin        Trip-Essentials/Maps/World-Map.html   (PINS array href + link)
  travel stats   Trip-Essentials/Travel-Stats.html     (guide link; home/origin exempt)
  safety         Trip-Essentials/Safety-Guide.html     (one row + link)
  climate        assets/climate.json + assets/weather.js (both Weather tabs)
  search index   assets/search_index.json              (guides list)

This is the repo-resident SUBSET of Brain/scripts/validate_guide_coverage.py (the
authoritative whole-fleet sweep, which additionally checks the two Brain-only
authoring trackers — status-dots and the currency country map — that are never
published and so can't reach users via a deploy). The Brain superset runs locally
at session start; this runs the user-facing surfaces in CI as the hard gate.

Exit 0 = every shipped guide is fully wired; exit 1 = a gap blocks the deploy.

Added 2026-06-22.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path
from urllib.parse import quote, unquote

REPO_ROOT  = Path(__file__).resolve().parents[2]   # …/.github/scripts/ → repo root
WEB        = REPO_ROOT / "Travel-Website"
GUIDES_DIR = WEB / "Guides"
ESSENTIALS = WEB / "Trip-Essentials"
ASSETS_DIR = WEB / "assets"
MAPS_DIR   = ESSENTIALS / "Maps"

STAMP = "<!-- validation: passed"


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _read(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def _json_block(html: str, var_name: str) -> dict:
    m = re.search(rf"var {re.escape(var_name)}\s*=\s*(\{{.*?\}})\s*;", html, re.DOTALL)
    if not m:
        return {}
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return {}


def _link_ok(base_dir: Path, href: str) -> bool:
    href = unquote(href.split("#")[0].split("?")[0])
    try:
        return (base_dir / href).resolve().is_file()
    except (OSError, ValueError):
        return False


def _find_href(text: str, prefix: str, folder: str) -> str | None:
    for f in {re.escape(folder), re.escape(quote(folder))}:
        m = re.search(rf'href="({re.escape(prefix)}{f}/[^"]+\.html)"', text)
        if m:
            return m.group(1)
    return None


def shipped_guides() -> list[str]:
    out = []
    if not GUIDES_DIR.exists():
        return out
    for folder in sorted(p for p in GUIDES_DIR.iterdir() if p.is_dir()):
        for html in folder.glob("*.html"):
            if STAMP in _read(html):
                out.append(folder.name)
                break
    return out


SURFACES = {
    "card": "index card", "inline": "index inline data", "fmap": "FMAP",
    "pin": "map pin", "stats": "travel stats", "safety": "safety guide",
    "climate": "climate (weather tabs)", "search": "search index",
    "resources": "trip-resources links",
}


def main() -> int:
    guides = shipped_guides()
    if not guides:
        print("check_coverage: no shipped guides found — nothing to check.")
        return 0

    index_html  = _read(GUIDES_DIR / "Guides-Index.html")
    world_html  = _read(MAPS_DIR / "World-Map.html")
    stats_html  = _read(ESSENTIALS / "Travel-Stats.html")
    safety_html = _read(ESSENTIALS / "Safety-Guide.html")
    weather_js  = _read(ASSETS_DIR / "weather.js")

    climate_keys = set()
    cj = ASSETS_DIR / "climate.json"
    if cj.exists():
        try:
            climate_keys = {_norm(k) for k in json.loads(_read(cj)) if k != "_meta"}
        except json.JSONDecodeError:
            pass

    weather_keys = set()
    wm = re.search(r"CLIMATE_DATA_START\s*\*/\s*var CLIMATE = (\{.*?\});\s*/\*\s*CLIMATE_DATA_END",
                   weather_js, re.DOTALL)
    if wm:
        try:
            weather_keys = {_norm(k) for k in json.loads(wm.group(1))}
        except json.JSONDecodeError:
            pass
    if not weather_keys:
        weather_keys = {_norm(k) for k in re.findall(r'"([^"]+)"\s*:', weather_js)}

    search_folders, search_names = set(), set()
    sj = ASSETS_DIR / "search_index.json"
    if sj.exists():
        try:
            for g in json.loads(_read(sj)).get("guides", []):
                if g.get("u"):
                    search_folders.add(g["u"].split("/")[0])
                if g.get("c"):
                    search_names.add(g["c"])
        except json.JSONDecodeError:
            pass

    inline_blocks = {n: _json_block(index_html, n)
                     for n in ("CLIMATE_INLINE", "COST_DATA", "SAFETY_DATA")}
    fmap = _json_block(index_html, "FMAP")
    fmap_keys_lower = [k.lower() for k in fmap]
    home_folders = {k.split("/")[0] for k, fd in fmap.items()
                    if isinstance(fd, dict) and fd.get("r") == "home"}

    folder_to_name = {}
    for href, name in re.findall(
        r'<a class="dest-card"[^>]*href="([^"]+)"[^>]*>.*?<span class="dest-name">([^<]+)</span>',
        index_html, re.DOTALL):
        folder_to_name[unquote(href).lstrip("./").split("/")[0]] = name.strip()

    missing: dict[str, list[str]] = {k: [] for k in SURFACES}

    for folder in guides:
        name = folder_to_name.get(folder)
        keys = {folder} | ({name} if name else set())
        cand = {_norm(folder)} | ({_norm(name)} if name else set())

        card_href = None
        for f in {re.escape(folder), re.escape(quote(folder))}:
            cm = re.search(rf'<a class="dest-card"[^>]*href="(\./{f}/[^"]+\.html)"', index_html)
            if cm:
                card_href = cm.group(1)
                break
        if not card_href or not _link_ok(GUIDES_DIR, card_href):
            missing["card"].append(folder)

        if any(not (keys & set(blk)) for blk in inline_blocks.values()):
            missing["inline"].append(folder)

        if not any(folder.lower() in k for k in fmap_keys_lower):
            missing["fmap"].append(folder)

        pin_href = None
        for f in {re.escape(folder), re.escape(quote(folder))}:
            pm = re.search(rf"['\"](\.\./\.\./Guides/{f}/[^'\"]+\.html)['\"]", world_html)
            if pm:
                pin_href = pm.group(1)
                break
        if not pin_href or not _link_ok(MAPS_DIR, pin_href):
            missing["pin"].append(folder)

        if folder not in home_folders:
            sh = _find_href(stats_html, "../Guides/", folder)
            if not sh or not _link_ok(ESSENTIALS, sh):
                missing["stats"].append(folder)

        fh = _find_href(safety_html, "../Guides/", folder)
        if not fh or not _link_ok(ESSENTIALS, fh):
            missing["safety"].append(folder)

        if not (cand & climate_keys) or not (cand & weather_keys):
            missing["climate"].append(folder)

        if folder not in search_folders and not (name and name in search_names):
            missing["search"].append(folder)

        # trip-resources: block must exist + all four universal links present
        _TR_REQUIRED = ["Safety-Guide.html", "Visas.html", "Before-You-Go.html", "Weather.html"]
        guide_html = ""
        for html in (GUIDES_DIR / folder).glob("*.html"):
            if STAMP in _read(html):
                guide_html = _read(html).lower()
                break
        if "<!-- trip-resources -->" not in guide_html or any(
            f.lower() not in guide_html for f in _TR_REQUIRED
        ):
            missing["resources"].append(folder)

    gaps = {k: v for k, v in missing.items() if v}
    if not gaps:
        print(f"check_coverage: OK — all {len(guides)} shipped guides present in every "
              f"published surface, with resolving links.")
        return 0

    print(f"::error::Deploy blocked — guide coverage gaps ({len(guides)} shipped guides):")
    for key, label in SURFACES.items():
        if missing[key]:
            print(f"  {label}: missing {', '.join(missing[key])}")
    print("Each shipped guide must appear (with a working link) in the index card, "
          "FMAP, map pin, travel stats, safety guide, both Weather tabs, search, "
          "and have a trip-resources block with Safety · Visas · Before You Go · Weather links.")
    print("Fix locally with: python3 Brain/scripts/validate_guide_coverage.py")
    return 1


if __name__ == "__main__":
    sys.exit(main())
