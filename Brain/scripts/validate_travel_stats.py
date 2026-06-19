#!/usr/bin/env python3
"""
validate_travel_stats.py — integrity check for Travel Stats.html

Verifies (no network, local files only):
  1. Hero counts (total / been / want / countries visited) match live guides_index data.
  2. Split bar width matches been/total ratio (within ±1%).
  3. Bucket list entries are all want cities and match the top-N farthest-want by minutes.
  4. Frontier chips match which regions actually have been visits.
  5. All guide links in the page resolve to files that exist on disk.
  6. COVERAGE — card/FMAP parity: every guide in guides_index has BOTH a dest-card
     and an FMAP entry, so none is silently dropped from the stats.
  7. COVERAGE — every guide in guides_index (excluding home) is actually rendered on
     the Stats page as a link. This is the hard gate that a newly shipped guide was
     added to Travel Stats correctly.

Exit 0 = all good. Exit 1 = one or more checks failed (details printed).
Run manually after any been/want status change on guides_index without a full ship.
"""
import importlib.util, os, re, sys

HERE   = os.path.dirname(os.path.abspath(__file__))
TRAVEL = os.path.abspath(os.path.join(HERE, "..", ".."))
WEB    = os.path.join(TRAVEL, "Travel-Website")
INDEX  = os.path.join(WEB, "Guides", "guides_index.html")
PAGE   = os.path.join(WEB, "Trip-Essentials", "Travel-Stats.html")
BTS    = os.path.join(HERE, "build_travel_stats.py")


# ── load build_travel_stats helpers ──────────────────────────────────────────
def _load_bts():
    spec = importlib.util.spec_from_file_location("bts", BTS)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


# ── parse Travel Stats.html for current displayed values ─────────────────────
def _parse_page(html):
    """Return dict of values currently baked into Travel Stats.html."""
    nums = re.findall(r'<div class="hero-num">([^<]+)</div>', html)
    # Order: total, been, want, regions
    hero = {}
    labels = re.findall(r'<div class="hero-label">([^<]+)</div>', html)
    for val, label in zip(nums, labels):
        hero[label.strip()] = val.strip()

    # Split bar width: style="width:XX.X%"
    sw = re.search(r'class="split-been"[^>]*style="width:([0-9.]+)%"', html)
    split_pct = float(sw.group(1)) if sw else None

    # Bucket list: href paths
    bucket_links = re.findall(r'class="bucket-name"\s+href="([^"]+)"', html)

    # Frontier chips: (name, visited)
    chips = re.findall(r'class="frontier-chip([^"]*)">[^<]*(?:✓|♡)\s*([^<]+)</div>', html)
    frontiers = {name.strip(): ("visited" in cls) for cls, name in chips}

    return hero, split_pct, bucket_links, frontiers


def main():
    fails = []

    # ── load source data ──────────────────────────────────────────────────────
    if not os.path.exists(INDEX):
        print(f"ERROR: guides_index not found at {INDEX}", file=sys.stderr); sys.exit(2)
    if not os.path.exists(PAGE):
        print(f"ERROR: Travel Stats not found at {PAGE}", file=sys.stderr); sys.exit(2)

    bts = _load_bts()
    idx_html  = open(INDEX, encoding="utf-8").read()
    page_html = open(PAGE,  encoding="utf-8").read()

    fmap  = bts.parse_fmap(idx_html)
    cards = bts.parse_cards(idx_html)
    stats = bts.compute_stats(fmap, cards)

    hero, split_pct, bucket_links, page_frontiers = _parse_page(page_html)

    # ── 1. Hero counts ────────────────────────────────────────────────────────
    expected = {
        "Total Guides":      str(stats["total"]),
        "Been There":        str(stats["been_count"]),
        "On the List":       str(stats["want_count"]),
        "Countries Visited": str(stats["countries_been"]),
    }
    for label, exp in expected.items():
        got = hero.get(label)
        if got != exp:
            fails.append(f"hero '{label}': Travel Stats shows {got!r}, guides_index says {exp!r}")

    # ── 2. Split bar width ────────────────────────────────────────────────────
    if stats["total"] > 0:
        exp_pct = stats["been_pct"]
        if split_pct is None:
            fails.append("split bar: width attribute not found in Travel Stats")
        elif abs(split_pct - exp_pct) > 1.0:
            fails.append(f"split bar width: Travel Stats shows {split_pct}%, expected ~{exp_pct}%")

    # ── 3. Bucket list ────────────────────────────────────────────────────────
    # Expected bucket: top-8 want by minutes descending (from compute_stats)
    exp_bucket_keys = [e["key"] for e in stats["bucket"]]

    # Extract folder keys from page bucket links  e.g. "../Guides/Queenstown/queenstown_v1.html"
    def _href_to_key(href):
        m = re.search(r"Guides/([^/]+/[^/]+\.html)", href)
        return m.group(1) if m else href

    page_bucket_keys = [_href_to_key(h) for h in bucket_links]

    if page_bucket_keys != exp_bucket_keys:
        fails.append(
            f"bucket list mismatch.\n"
            f"  Travel Stats: {page_bucket_keys}\n"
            f"  Expected:     {exp_bucket_keys}"
        )

    # ── 4. Frontier chips ────────────────────────────────────────────────────
    visited_regions = stats["been_regions"]  # set of region names with ≥1 been visit
    # All known regions from FRONTIER_ORDER
    all_regions = bts.FRONTIER_ORDER
    for region in all_regions:
        exp_visited = region in visited_regions
        got_visited = page_frontiers.get(region)
        if got_visited is None:
            fails.append(f"frontier chip missing for region: {region!r}")
        elif got_visited != exp_visited:
            status = "visited" if exp_visited else "not visited"
            shown  = "visited" if got_visited else "not visited"
            fails.append(f"frontier chip '{region}': shown as {shown}, should be {status}")

    # ── 5. Guide links resolve to real files ─────────────────────────────────
    # All <a href=".."> inside Travel Stats pointing into Guides/
    all_links = re.findall(r'href="(\.\./Guides/[^"]+\.html)"', page_html)
    trip_essentials = os.path.join(WEB, "Trip-Essentials")
    broken = []
    for href in set(all_links):
        target = os.path.normpath(os.path.join(trip_essentials, href))
        if not os.path.exists(target):
            broken.append(href)
    if broken:
        fails.append(f"broken guide links ({len(broken)}): {sorted(broken)}")

    # ── 6. Coverage: card/FMAP parity ─────────────────────────────────────────
    # A guide added to guides_index needs BOTH a dest-card and an FMAP entry, or
    # compute_stats silently drops it. Surface either gap as a hard failure so a
    # half-added guide can never slip a clean Stats build past the ship gate.
    if stats["orphan_cards"]:
        fails.append(
            "guides with a dest-card but NO FMAP entry "
            f"(add to guides_index FMAP): {stats['orphan_cards']}"
        )
    if stats["orphan_fmap"]:
        fails.append(
            "guides with an FMAP entry but NO dest-card "
            f"(add the card to guides_index): {stats['orphan_fmap']}"
        )

    # ── 7. Coverage: every guide is rendered on the Stats page ────────────────
    # Build the universe of guides from guides_index (cards ∩ fmap, excluding home)
    # and confirm each one appears as a link on Travel Stats.html. This is the gate
    # that a newly shipped guide was actually added to the Stats page.
    home_keys = {k for k, fd in fmap.items() if fd.get("r") == "home"}
    card_keys = {c["href_key"] for c in cards}
    universe  = (card_keys & set(fmap)) - home_keys

    page_keys = set()
    for href in re.findall(r'href="(\.\./Guides/[^"]+\.html)"', page_html):
        m = re.search(r"Guides/([^/]+/[^/]+\.html)", href)
        if m:
            page_keys.add(m.group(1))

    missing_on_page = sorted(universe - page_keys)
    if missing_on_page:
        fails.append(
            f"{len(missing_on_page)} guide(s) in guides_index are NOT shown anywhere on "
            f"Travel Stats.html: {missing_on_page}"
        )

    # ── 8. Coverage: by-continent rollup accounts for every guide ─────────────
    # If a region label exists in FMAP that REGION_TO_CONTINENT doesn't map, those
    # guides vanish from the continent view. The totals must sum to stats['total'].
    cont_sum = sum(c["total"] for c in stats["continents"].values())
    if cont_sum != stats["total"]:
        unmapped = sorted({
            fd.get("rg") for k, fd in fmap.items()
            if fd.get("r") != "home"
            and k in card_keys
            and bts.REGION_TO_CONTINENT.get(fd.get("rg")) is None
        } - {None})
        fails.append(
            f"by-continent rollup sums to {cont_sum} but total is {stats['total']} "
            f"— unmapped region(s) in REGION_TO_CONTINENT: {unmapped}"
        )
    # Every computed continent must appear on the page.
    for cont in stats["continents"]:
        if cont not in page_html:
            fails.append(f"continent '{cont}' missing from the By Continent section on the page")

    # ── 9. Routing mix accounts for every guide ───────────────────────────────
    route_sum = sum(stats["routing"].values())
    if route_sum != stats["total"]:
        fails.append(
            f"routing mix sums to {route_sum} but total is {stats['total']} "
            f"(an unrecognised routing value slipped through)"
        )

    # ── 10. Most-covered countries render with resolved names ──────────────────
    # Guard against a flag that doesn't resolve to a name (shows a bare ISO code).
    for flag, name, total, been in stats["top_countries"]:
        if not name or len(name) <= 2:
            fails.append(f"country name unresolved for flag {flag!r} (add it to COUNTRY_NAMES)")
        if name not in page_html:
            fails.append(f"top country '{name}' missing from the Most-Covered Countries section")

    # ── Report ────────────────────────────────────────────────────────────────
    if fails:
        print(f"validate_travel_stats: {len(fails)} issue(s) found:\n")
        for f in fails:
            print(f"  ✗ {f}")
        print(f"\nFix: run  python3 Brain/scripts/build_travel_stats.py")
        sys.exit(1)
    else:
        print(f"validate_travel_stats: OK — "
              f"{stats['total']} guides, {stats['been_count']} been, {stats['want_count']} want, "
              f"{stats['countries_been']}/{stats['countries_total']} countries, "
              f"{stats['regions_visited']} regions, {len(all_links)} links checked, "
              f"coverage parity clean ({len(universe)} guides all on page)")


if __name__ == "__main__":
    main()
