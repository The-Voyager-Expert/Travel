#!/usr/bin/env python3
"""
validate_flight_index.py — integrity checks for the "By flight time from Seattle"
view in Travel-Website/Guides/Guides-Index.html (the FMAP data block + its colours).

Enforces, in one place, every rule this feature depends on:
  • FMAP parses as JSON; every entry has the exact schema (t,m,r,d,i,h,rg,o).
  • r is one of: home|nonstop|seasonal|1stop|2stop.
  • Connecting routings (1stop/2stop) carry a hub; nonstop/seasonal/home do not.
  • Destination code i is a 3-letter IATA.
  • Every mosaic guide card has an FMAP entry, and vice-versa (no orphans).
  • ROUTING AUTHORITY: r (and hub family) agree with the crib-built
    Trip-Essentials/Delta Routes SEA.html tiers (t0=nonstop/seasonal, t1=1stop, t2=2stop)
    for any IATA listed there.
  • COLOUR CONSISTENCY: the dot (CSS .fdot), the card border (JS COL) and the Stops
    filter chip emoji all resolve to the SAME colour family for nonstop / 1stop / 2stop.
    (This is the "two-tone purple" class of bug.) Colours may change freely — they
    just have to stay identical across the three places.
  • Label t == displayed time (m + connection buffer), within rounding.

Exit code 0 = clean (no FAILs). Exit 1 = at least one FAIL.
Stdlib only. Run:  python3 Brain/scripts/validate_flight_index.py
"""
import re, sys, json, colorsys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent                       # …/Travel
INDEX = ROOT / "Travel-Website" / "Guides" / "Guides-Index.html"
SEA   = ROOT / "Travel-Website" / "Trip-Essentials" / "Delta-Routes-SEA.html"

REQUIRED_KEYS = {"t", "m", "r", "d", "i", "h", "rg", "o"}
OPTIONAL_KEYS = {"lg"}                          # per-leg block-time breakdown (connecting routes)
ROUTINGS = {"home", "nonstop", "seasonal", "1stop", "2stop"}
NEEDS_HUB = {"1stop", "2stop"}
BUFFER = {"1stop": 90, "2stop": 180}            # minutes added per stop in the renderer
SEGS_FOR = {"nonstop": 1, "seasonal": 1, "1stop": 2, "2stop": 3}  # expected leg count by routing
EMOJI_FAMILY = {"🟣": "purple", "🟢": "green", "🟡": "yellow", "🔵": "blue",
                "🟠": "orange", "🔴": "red", "⚪": "white", "🟤": "brown", "⚫": "black"}

fails, warns = [], []
def FAIL(m): fails.append(m)
def WARN(m): warns.append(m)


def family(hexv):
    """Classify a CSS colour into a coarse colour family (hue bucket)."""
    h = hexv.strip().lower().lstrip("#")
    if h in ("fff", "ffffff", "white"):
        return "white"
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        return "?"
    r, g, b = (int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
    hue, s, v = colorsys.rgb_to_hsv(r, g, b)
    hue *= 360
    if v < 0.15:           return "black"
    if s < 0.15:           return "white" if v > 0.6 else "gray"
    if hue < 15 or hue >= 345: return "red"
    if hue < 40:           return "orange"
    if hue < 70:           return "yellow"
    if hue < 170:          return "green"
    if hue < 200:          return "cyan"
    if hue < 255:          return "blue"
    if hue < 300:          return "purple"
    return "magenta"


def fmt_minutes(t):
    h, n = divmod(t, 60)
    return f"{h}h {n:02d}m" if n else f"{h}h"


def load(path):
    if not path.exists():
        FAIL(f"missing file: {path}")
        return None
    return path.read_text(encoding="utf-8")


def parse_sea_tiers(html):
    """IATA -> '0'|'1'|'2' connection tier, from Delta Routes SEA."""
    out, tier = {}, None
    pat = re.compile(
        r'tier-badge (t[012])"[^>]*>([^<]*)'
        r'|dest-card (t[012])"><div class="dest-city">([^<]*)</div>'
        r'<div class="dest-code">([^<]*)</div><div class="dest-meta">([^<]*)</div>')
    for tb, _lbl, dc, _city, code, _meta in pat.findall(html):
        if dc:
            iata = code.split("·")[0].strip()
            tval = {"t0": "0", "t1": "1", "t2": "2"}[dc]
            # an IATA can appear in several tiers (e.g. BCN/FCO: seasonal nonstop AND
            # off-season connection) — keep the BEST (fewest-stop) tier it ever reaches.
            if iata not in out or tval < out[iata]:
                out[iata] = tval
    return out


def main():
    html = load(INDEX)
    if html is None:
        report(); return
    sea_html = load(SEA)

    # ---- FMAP ----
    m = re.search(r"var FMAP = (\{.*?\});", html)
    if not m:
        FAIL("FMAP object not found in Guides-Index.html")
        report(); return
    try:
        fmap = json.loads(m.group(1))
    except json.JSONDecodeError as e:
        FAIL(f"FMAP is not valid JSON: {e}")
        report(); return

    for key, d in fmap.items():
        keys = set(d)
        missing = REQUIRED_KEYS - keys
        extra = keys - REQUIRED_KEYS - OPTIONAL_KEYS
        if missing or extra:
            FAIL(f"{key}: key mismatch (missing {missing or '-'}, extra {extra or '-'})")
            continue
        if d["r"] not in ROUTINGS:
            FAIL(f"{key}: invalid routing r={d['r']!r}")
        if not isinstance(d["m"], int) or d["m"] < 0:
            FAIL(f"{key}: m must be a non-negative int (got {d['m']!r})")
        if d["r"] != "home" and not re.fullmatch(r"[A-Z]{3}", d["i"] or ""):
            FAIL(f"{key}: i must be a 3-letter IATA (got {d['i']!r})")
        if d["r"] in NEEDS_HUB:
            if not re.fullmatch(r"[A-Z]{3}", d["h"] or ""):
                FAIL(f"{key}: {d['r']} needs a hub IATA in h (got {d['h']!r})")
        elif d["h"] is not None:
            FAIL(f"{key}: {d['r']} must have h=null (got {d['h']!r})")
        # per-leg breakdown (optional): real sourced routing. legs must chain SEA→…→dest,
        # ≥2 legs for a connecting route, every block time a positive int, sum(legs)==m
        # (the air total). Leg count is the REAL routing — it need not equal the marketed
        # r-tier (a "2stop"-tier city is often flyable in one connection), so buffer for
        # the headline is (legs-1)×90, not r-based.  h stays a representative-hub label.
        legs_ok = True
        if d.get("lg") is not None:
            lg = d["lg"]
            if d["r"] in ("home", "nonstop", "seasonal"):
                FAIL(f"{key}: {d['r']} must not carry lg (legs are for connecting routes only)")
                legs_ok = False
            elif (not isinstance(lg, list) or len(lg) < 2
                  or not all(isinstance(s, list) and len(s) == 3 for s in lg)):
                FAIL(f"{key}: lg must be a list of ≥2 [from,to,minutes] legs (got {lg!r})")
                legs_ok = False
            else:
                if lg[0][0] != "SEA":
                    FAIL(f"{key}: first leg must start at SEA (got {lg[0][0]!r})")
                if lg[-1][1] != d["i"]:
                    FAIL(f"{key}: last leg must end at dest {d['i']} (got {lg[-1][1]!r})")
                for a_, b_ in zip(lg, lg[1:]):
                    if a_[1] != b_[0]:
                        FAIL(f"{key}: leg chain breaks ({a_[1]} → {b_[0]})")
                if not all(isinstance(s[2], int) and s[2] > 0 for s in lg):
                    FAIL(f"{key}: every leg block time must be a positive int (got {[s[2] for s in lg]})")
                elif sum(s[2] for s in lg) != d["m"]:
                    FAIL(f"{key}: sum(legs)={sum(s[2] for s in lg)} != m={d['m']} (air total must equal m)")
        # label vs rendered time — buffer is per-connection when real legs are known
        if d["r"] != "home":
            if d.get("lg") and legs_ok:
                buf = (len(d["lg"]) - 1) * 90
            else:
                buf = BUFFER.get(d["r"], 0)
            disp = d["m"] + buf
            want = fmt_minutes(disp)
            tmin = (lambda s: (int(re.search(r'(\d+)h', s).group(1)) if 'h' in s else 0) * 60
                    + (int(re.search(r'(\d+)m', s).group(1)) if 'm' in s else 0))(d["t"])
            if abs(tmin - disp) > 5:
                WARN(f"{key}: label t={d['t']!r} != displayed {want} (m+buffer)")

    # ---- mosaic coverage (every card has FMAP, every FMAP key has a card) ----
    mosaic = html.split('<div class="mosaic">', 1)[-1].split("<!-- /mosaic -->", 1)[0]
    hrefs = set(re.findall(r'<a class="dest-card"[^>]*?href="\.?/?([^"]+\.html)"', mosaic))
    fkeys = {k for k in fmap if fmap[k]["r"] != "home"}
    for h in hrefs - set(fmap):
        FAIL(f"mosaic card has no FMAP entry: {h}")
    for k in fkeys - hrefs:
        FAIL(f"FMAP entry has no mosaic card (orphan): {k}")

    # ---- routing authority vs Delta Routes SEA ----
    if sea_html:
        tiers = parse_sea_tiers(sea_html)
        tier_of = {"nonstop": "0", "seasonal": "0", "1stop": "1", "2stop": "2"}
        for key, d in fmap.items():
            if d["r"] == "home":
                continue
            t = tiers.get(d["i"])
            if t and tier_of.get(d["r"]) != t:
                FAIL(f"{key}: routing r={d['r']} disagrees with Delta Routes SEA "
                     f"(IATA {d['i']} is tier {t}-connection there)")

    # ---- colour consistency: .fdot  ==  COL  ==  chip emoji ----
    fdot = dict(re.findall(r"\.fdot\.r-(\w+)\s*\{\s*background:\s*(#[0-9a-fA-F]{3,6}|white)", html))
    colm = re.search(r"var COL = \{([^}]*)\}", html)
    col = dict(re.findall(r"(\w+|'\w+'|'\dstop')\s*:\s*'(#[0-9a-fA-F]{6})'", colm.group(1))) if colm else {}
    col = {k.strip("'"): v for k, v in col.items()}
    chips = dict(re.findall(r'data-stop="(\w+)">\s*(\S+)\s', html))

    for rcat in ("nonstop", "1stop", "2stop"):
        fc = family(fdot[rcat]) if rcat in fdot else None
        cc = family(col[rcat]) if rcat in col else None
        ec = EMOJI_FAMILY.get(chips.get(rcat, ""))
        if fc is None: FAIL(f"colour: .fdot.r-{rcat} not found")
        if cc is None: FAIL(f"colour: COL['{rcat}'] not found")
        if fc and cc and fc != cc:
            FAIL(f"colour mismatch for {rcat}: dot is {fc} ({fdot[rcat]}) but card border is {cc} ({col[rcat]})")
        if ec and cc and ec != cc:
            FAIL(f"colour mismatch for {rcat}: chip emoji {chips[rcat]} is {ec} but colour is {cc} ({col[rcat]})")
    # seasonal dot is the nonstop variant (white fill, nonstop-coloured border)
    sb = re.search(r"\.fdot\.r-seasonal\s*\{[^}]*border:\s*\d+px solid (#[0-9a-fA-F]{6})", html)
    if sb and "nonstop" in fdot and family(sb.group(1)) != family(fdot["nonstop"]):
        WARN(f"seasonal dot border {family(sb.group(1))} != nonstop colour {family(fdot['nonstop'])}")

    report()


def report():
    print("━━━ validate_flight_index ━━━")
    for w in warns: print(f"  ⚠️  WARN  {w}")
    for f in fails: print(f"  ❌ FAIL  {f}")
    print(f"━━━ result: {len(fails)} fail · {len(warns)} warn ━━━")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
