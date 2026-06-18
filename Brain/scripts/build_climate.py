#!/usr/bin/env python3
"""
build_climate.py — regenerate assets/climate.json

Climate NORMALS (typical monthly avg high/low, °C) for every guide city, used by
assets/weather.js to render the 🌡 Climate panel. These are historical averages,
not a forecast — they do not shift, which is why they may live in the guide.

Source of coordinates: the PINS arrays in Trip-Essentials/Maps/*.html (the same
lon/lat already maintained for the map pins). Three cities without a map pin
(Madeira, Naples, Seville) are seeded by hand below.

Data source: Open-Meteo Historical Weather API (no key, CORS-open). Each city's
daily max/min over a multi-year window is averaged per calendar month.

Run:  python3 Brain/scripts/build_climate.py
Notes: Open-Meteo free tier rate-limits bursts (HTTP 429). This script paces
requests sequentially and retries; a full run is slow but resumable — rerunning
only refetches cities that errored last time (delete the cache to force a full
rebuild).
"""
import json, re, glob, os, sys, time, urllib.request, urllib.error, urllib.parse, datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WEB_ROOT = os.path.join(ROOT, "Travel-Website")            # published site root (2026-06-13 reorg)
ASSETS = os.path.join(WEB_ROOT, "assets")                  # climate.json + weather.js live here now
MAPS = os.path.join(WEB_ROOT, "Trip-Essentials", "Maps")
DEST = os.path.join(ASSETS, "climate.json")
CACHE = "/tmp/climate_raw.json"
WINDOW = ("2019-01-01", "2023-12-31")

SEED = {  # guides without a map pin — city, lat, lon
    "Madeira": ("Madeira", 32.66, -16.92),
    "Naples":  ("Naples",  40.85,  14.27),
    "Seville": ("Seville", 37.39,  -5.98),
}

def collect_pins():
    pins = {}
    q = r"['\"]"
    pat = re.compile(rf"\[\s*{q}([^'\"]+){q}\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*{q}([^'\"]*Guides/[^'\"]+){q}\s*\]")
    for f in glob.glob(os.path.join(MAPS, "*.html")):
        txt = open(f, encoding="utf-8", errors="ignore").read()
        for mch in pat.finditer(txt):
            label, lon, lat, path = mch.group(1), float(mch.group(2)), float(mch.group(3)), mch.group(4)
            gm = re.search(r"Guides/([^/]+)/", path)
            if not gm:
                continue
            folder = urllib.parse.unquote(gm.group(1))
            pins[folder] = {"city": label, "lat": lat, "lon": lon}
    for folder, (city, lat, lon) in SEED.items():
        pins.setdefault(folder, {"city": city, "lat": lat, "lon": lon})
    return pins

def fetch(v):
    url = ("https://archive-api.open-meteo.com/v1/archive?latitude=%s&longitude=%s"
           "&start_date=%s&end_date=%s"
           "&daily=temperature_2m_max,temperature_2m_min&timezone=auto"
           % (v["lat"], v["lon"], WINDOW[0], WINDOW[1]))
    for attempt in range(8):
        try:
            with urllib.request.urlopen(url, timeout=15) as r:
                d = json.load(r)
            dl = d["daily"]
            sh = [0.0]*12; sl = [0.0]*12; c = [0]*12
            for t, a, b in zip(dl["time"], dl["temperature_2m_max"], dl["temperature_2m_min"]):
                if a is None or b is None:
                    continue
                mo = int(t[5:7]) - 1
                sh[mo] += a; sl[mo] += b; c[mo] += 1
            return {"city": v["city"], "lat": v["lat"], "lon": v["lon"],
                    "hi": [round(sh[i]/c[i], 1) if c[i] else None for i in range(12)],
                    "lo": [round(sl[i]/c[i], 1) if c[i] else None for i in range(12)]}
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(6); continue
            return {"city": v["city"], "lat": v["lat"], "lon": v["lon"], "error": "HTTP %s" % e.code}
        except Exception:
            time.sleep(3)
    return {"city": v["city"], "lat": v["lat"], "lon": v["lon"], "error": "giveup"}

def main():
    pins = collect_pins()
    out = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    todo = [(k, v) for k, v in pins.items() if k not in out or "error" in out.get(k, {})]
    print("cities: %d | to fetch: %d" % (len(pins), len(todo)))
    for folder, v in todo:
        out[folder] = fetch(v)
        json.dump(out, open(CACHE, "w"))
        time.sleep(1.0)
    bad = [k for k, x in out.items() if "error" in x]
    if bad:
        print("ERRORS (rerun to retry):", bad); sys.exit(1)
    doc = {"_meta": {
        "source": "Open-Meteo Historical Weather API (archive-api.open-meteo.com)",
        "description": "Climate normals — avg daily high/low (°C) per calendar month. Typical averages, not a forecast.",
        "window": WINDOW[0][:4] + "-" + WINDOW[1][:4],
        "generated": datetime.date.today().isoformat(),
        "keys": "guide folder name; hi[]/lo[] are 12 values Jan..Dec in °C"}}
    for k in sorted(out):
        v = out[k]
        doc[k] = {"city": v["city"], "lat": v["lat"], "lon": v["lon"], "hi": v["hi"], "lo": v["lo"]}
    json.dump(doc, open(DEST, "w"), ensure_ascii=False, indent=0)
    print("wrote", DEST, "|", len(out), "cities")

    # Also rewrite the baked-in CLIMATE block in assets/weather.js (the widget
    # carries the data inline so it works from local file:// as well as the live
    # site — a fetch of a sibling .json is blocked under file://). Integer-rounded
    # to keep the script lean; the panel rounds for display anyway.
    embed = {k: {"city": out[k]["city"],
                 "hi": [round(x) for x in out[k]["hi"]],
                 "lo": [round(x) for x in out[k]["lo"]]}
             for k in sorted(out)}
    blob = json.dumps(embed, separators=(",", ":"), ensure_ascii=False)
    wjs_path = os.path.join(ASSETS, "weather.js")
    wjs = open(wjs_path, encoding="utf-8").read()
    new_block = "/* CLIMATE_DATA_START */\n  var CLIMATE = " + blob + ";\n  /* CLIMATE_DATA_END */"
    wjs2 = re.sub(r"/\* CLIMATE_DATA_START \*/.*?/\* CLIMATE_DATA_END \*/",
                  lambda _m: new_block, wjs, count=1, flags=re.S)
    if wjs2 != wjs:
        open(wjs_path, "w", encoding="utf-8").write(wjs2)
        print("updated baked CLIMATE block in", wjs_path)
    else:
        print("WARNING: CLIMATE_DATA markers not found in weather.js — block NOT updated")

    # Trips.html bakes the same CLIMATE block inline (between the same markers) to
    # power its Next-up countdown's upcoming-destination weather — keep it in sync
    # so it never drifts from weather.js / climate.json.
    trips_path = os.path.join(WEB_ROOT, "Trip-Essentials", "Trips.html")
    if os.path.exists(trips_path):
        tp = open(trips_path, encoding="utf-8").read()
        tp2 = re.sub(r"/\* CLIMATE_DATA_START \*/.*?/\* CLIMATE_DATA_END \*/",
                     lambda _m: new_block, tp, count=1, flags=re.S)
        if tp2 != tp:
            open(trips_path, "w", encoding="utf-8").write(tp2)
            print("updated baked CLIMATE block in", trips_path)
        else:
            print("WARNING: CLIMATE_DATA markers not found in Trips.html — block NOT updated")

if __name__ == "__main__":
    main()
