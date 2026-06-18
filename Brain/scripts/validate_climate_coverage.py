#!/usr/bin/env python3
"""
validate_climate_coverage.py — coverage check for assets/climate.json

Verifies (no network, local files only):
  1. Every map-pinned guide city has an entry in climate.json (no missing cities).
  2. No entry in climate.json carries an "error" flag from a failed API fetch.
  3. The baked CLIMATE block in assets/weather.js is in sync with climate.json
     (same city set — a mismatch means build_climate.py was partially run or
     weather.js was edited separately).
  4. Every hi[]/lo[] array has exactly 12 values and none are None
     (a None means the API returned no data for that month).
  5. Every climate city has a By-Climate guide link in Climate Finder.html's
     GUIDE_LINKS map, the link resolves to a real file, and there are no stale
     orphan links. (Weather.html / By City is data-driven and needs no per-page
     link; Climate Finder / By Climate links each card to its guide — this is the
     one asymmetric gap between the two Weather tabs.)

Exit 0 = all good. Exit 1 = coverage gaps or sync issues found (details printed).
Fix: run  python3 Brain/scripts/build_climate.py
"""
import importlib.util, json, os, re, sys

HERE   = os.path.dirname(os.path.abspath(__file__))
TRAVEL = os.path.abspath(os.path.join(HERE, "..", ".."))
WEB    = os.path.join(TRAVEL, "Travel-Website")
CJSON  = os.path.join(WEB, "assets", "climate.json")
WJS    = os.path.join(WEB, "assets", "weather.js")
BC     = os.path.join(HERE, "build_climate.py")


def _load_bc():
    spec = importlib.util.spec_from_file_location("bc", BC)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def _baked_keys(wjs_text):
    """Extract city keys from the baked CLIMATE block in weather.js."""
    m = re.search(
        r"/\* CLIMATE_DATA_START \*/\s*var CLIMATE\s*=\s*(\{.*?\});\s*/\* CLIMATE_DATA_END \*/",
        wjs_text, re.S
    )
    if not m:
        return None
    return set(json.loads(m.group(1)).keys())


def main():
    fails = []

    # ── load files ────────────────────────────────────────────────────────────
    for path, label in [(CJSON, "climate.json"), (WJS, "weather.js"), (BC, "build_climate.py")]:
        if not os.path.exists(path):
            print(f"ERROR: {label} not found at {path}", file=sys.stderr)
            sys.exit(2)

    try:
        cdata = json.load(open(CJSON, encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"ERROR: climate.json invalid JSON: {e}", file=sys.stderr)
        sys.exit(2)

    climate_keys = {k for k in cdata if not k.startswith("_")}

    # ── 1. Pin coverage ───────────────────────────────────────────────────────
    bc = _load_bc()
    pins = bc.collect_pins()
    pin_keys = {v["city"] for v in pins.values()}  # compare by city label, not folder name

    missing = sorted(pin_keys - climate_keys)   # pinned but not in climate.json
    extra   = sorted(climate_keys - pin_keys)   # in climate.json but no map pin

    if missing:
        fails.append(
            f"{len(missing)} map-pinned city(s) missing from climate.json "
            f"(run build_climate.py):\n    " + "\n    ".join(missing)
        )
    if extra:
        # Extra entries aren't a problem but worth noting (pin removed without cleanup)
        fails.append(
            f"{len(extra)} climate.json entry(s) have no map pin "
            f"(pin removed or SEED leftover):\n    " + "\n    ".join(extra)
        )

    # ── 2. Error flags ────────────────────────────────────────────────────────
    errored = [k for k in climate_keys if "error" in cdata.get(k, {})]
    if errored:
        fails.append(
            f"{len(errored)} city(s) have error flags in climate.json "
            f"(API fetch failed — rerun build_climate.py):\n    " + "\n    ".join(sorted(errored))
        )

    # ── 3. weather.js baked block sync ───────────────────────────────────────
    wjs_text  = open(WJS, encoding="utf-8").read()
    baked_keys = _baked_keys(wjs_text)
    if baked_keys is None:
        fails.append(
            "CLIMATE_DATA_START/END markers not found in weather.js — "
            "baked block is missing; run build_climate.py"
        )
    else:
        js_missing = sorted(climate_keys - baked_keys)
        js_extra   = sorted(baked_keys - climate_keys)
        if js_missing:
            fails.append(
                f"{len(js_missing)} city(s) in climate.json but not in weather.js baked block "
                f"(run build_climate.py):\n    " + "\n    ".join(js_missing)
            )
        if js_extra:
            fails.append(
                f"{len(js_extra)} city(s) in weather.js baked block but not in climate.json:\n    "
                + "\n    ".join(js_extra)
            )

    # ── 4. Data completeness ──────────────────────────────────────────────────
    incomplete = []
    for k in climate_keys:
        entry = cdata[k]
        if "error" in entry:
            continue  # already reported above
        hi = entry.get("hi", [])
        lo = entry.get("lo", [])
        if len(hi) != 12 or len(lo) != 12 or None in hi or None in lo:
            incomplete.append(k)
    if incomplete:
        fails.append(
            f"{len(incomplete)} city(s) have incomplete monthly data "
            f"(None values or wrong array length — rerun build_climate.py):\n    "
            + "\n    ".join(sorted(incomplete))
        )

    # ── 5. Climate Finder GUIDE_LINKS (By Climate tab guide links) ────────────
    # The two Weather tabs share climate data, but By Climate (Climate Finder.html)
    # additionally links each result card to its guide via a hardcoded GUIDE_LINKS
    # map. weather.js coverage only makes a city *appear*; without a GUIDE_LINKS
    # entry its By-Climate card is a dead, non-clickable tile. By City (Weather.html)
    # is a pure weather lookup and needs no per-page link — this is the one
    # asymmetric gap between the two tabs, so it gets its own check. (Added 2026-06-15.)
    cfinder = os.path.join(WEB, "Trip-Essentials", "Climate Finder.html")
    if not os.path.exists(cfinder):
        fails.append("Trip-Essentials/Climate Finder.html not found — cannot check By-Climate guide links")
    else:
        cf_text = open(cfinder, encoding="utf-8").read()
        gm = re.search(r"var GUIDE_LINKS\s*=\s*\{(.*?)\};", cf_text, re.S)
        if not gm:
            fails.append("Climate Finder.html — GUIDE_LINKS map not found (By-Climate guide links)")
        else:
            gl = dict(re.findall(r'"([^"]+)"\s*:\s*"([^"]+)"', gm.group(1)))
            gl_keys = set(gl)
            cf_dir = os.path.join(WEB, "Trip-Essentials")
            link_missing = sorted(climate_keys - gl_keys)   # city in data, no By-Climate link
            link_orphan  = sorted(gl_keys - climate_keys)   # By-Climate link, no climate data
            unresolved = sorted(
                k for k, h in gl.items()
                if not os.path.exists(os.path.normpath(os.path.join(cf_dir, h)))
            )
            if link_missing:
                fails.append(
                    f"{len(link_missing)} city(s) in climate data but missing a By-Climate guide link "
                    f"(add to GUIDE_LINKS in Climate Finder.html):\n    " + "\n    ".join(link_missing)
                )
            if link_orphan:
                fails.append(
                    f"{len(link_orphan)} GUIDE_LINKS entry(s) with no climate data "
                    f"(stale By-Climate link):\n    " + "\n    ".join(link_orphan)
                )
            if unresolved:
                fails.append(
                    f"{len(unresolved)} By-Climate guide link(s) point to a file that doesn't exist:\n    "
                    + "\n    ".join(f"{k} → {gl[k]}" for k in unresolved)
                )

    # ── Report ────────────────────────────────────────────────────────────────
    if fails:
        print(f"validate_climate_coverage: {len(fails)} issue(s):\n")
        for f in fails:
            print(f"  ✗ {f}")
        sys.exit(1)
    else:
        print(
            f"validate_climate_coverage: OK — {len(climate_keys)} cities, "
            f"weather.js baked block in sync, all By-Climate guide links present"
        )


if __name__ == "__main__":
    main()
