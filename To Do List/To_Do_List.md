# To Do List

> One file. Three sections. Everything lives here — no separate rule-update file. Resolved items get deleted (no strikethrough).

---

## ✈️ My Tasks

*Private tasks — bookings, flights, hotels, research, logistics.*

---

## 🗺 Guides to Build

*(No open guide builds.)*

---

## 🪧 Index Subtitle Proposals

*Proposals to add a `dest-sub` line to an index card — the italic sub-line that surfaces a **non-obvious natural marquee** a guide covers (a major geological phenomenon, famous lake, or national/natural park reached as a day-trip that the city name doesn't telegraph — e.g. Ljubljana → "incl. Postojna Cave · Lake Bled"). Scope is natural features ONLY (caves, lakes, canyons, waterfalls, geysers, fjords, parks); never cathedrals, museums, palaces, or other obvious city sights. A crib never adds one on its own — it parks the proposal here, and adds the span only after owner approves. Flow: proposal here → approved → crib adds `dest-sub` → item deleted. Full rule: `Brain/Reference/Ship Checklist.html` § 11. (Subtitles added 2026-06-12 by owner direction: Ljubljana → "incl. Postojna Cave · Lake Bled" [first use]; Zhangjiajie → "incl. Avatar 'Hallelujah' Mountains".)*

---

## 🔧 Rules for Update

*Only edits to files inside `Brain/CORE RULES/` get parked here — they require explicit approval before Claude touches them. Flow: proposal here → approved in same session → Claude applies the edit → item deleted. Everything outside `Brain/CORE RULES/` (Reference files, scripts, guides, Trips.html, to-do list, etc.) gets fixed immediately without asking or parking.*

*(All 27-file CORE RULES audit findings #1–19 closed 2026-06-05 — see `Brain/Reference/audit_log.md` for the record. Item #17's guide-side consequence — the Michelin backfill — completed 2026-06-05 and closed out 2026-06-06; record in the audit log. The 2026-06-06 CORE RULES audit's three parked proposals all closed same-day: #1 under Wifey's toolbar-move authorization, #2 underline-ban re-homed to `Links.html § 8` and #3 Skip List source + decisions.md relabel both owner-approved and applied — records in the audit log.)*

---

## ❓ Open Questions

*Only questions concerning fixes or edits to `Brain/CORE RULES/` files park here — every other gap is resolved in-session with Claude's own tools (Rules for Claude.html § 3, applied 2026-06-06).*

<!-- Resolved 2026-06-13: "CORE RULES checksum drift — 4 files unstamped (flagged 2026-06-12)" — Cappuccino / Michelin Restaurants / Motion Rule / Restaurants Near Hotel now match core_rules_checksums.json (validator: SHA-256 matches for all 27 CORE RULES files). Closed by owner. -->
<!-- Resolved 2026-06-15: "Hotel Banner §1 mandates a street number — but some hotels have none (UAE guide)." Decision by owner: §1 updated to allow street name · neighborhood when no street number is published. validate_itinerary.py updated: passes if digit present OR · present; fails only on bare street name alone. format_version.json bumped → fp e59f9c9f0bcc68c5. UAE guide (Address Downtown) can now re-ship. -->

<!-- Resolved 2026-07-11: "Add Read About story page to Phase 5 list in Guide Structure.html" — already present at lines 68 + 117; no edit needed. Closed. -->

---

## 🛋️ Lounges Audit — July 2026

*Auto-audit run 2026-07-06. AmEx Centurion guest policy, Delta Sky Club visit caps, Priority Pass/Venture X, and AMS Centurion Lounge all applied to `Lounges-US.html`/`Lounges-Europe.html` 2026-07-10. Two forward-looking watch items remain — no page edit needed yet, just don't forget them when they open:*

- ℹ️ **LAX (US page) — second Delta One Lounge coming to Terminal 2:** US page lists the LAX Delta One Lounge in Terminal 3 (correct today). A **new LAX Delta One Lounge opens in phases in Terminal 2** (first phase 2026, full lounge 2028). Not open yet. Source: https://thepointsguy.com/airline/delta-one-lounge-lax-2027/
- ℹ️ **ATL — Delta One Lounge "in the works":** A Delta One Lounge is planned for ATL but not yet open. Watch for an opening date. Source: https://www.cnn.com/cnn-underscored/travel/delta-sky-club-lounges

---

## 🛡️ Safety Guide Audit — July 2026

*Auto-audit run 2026-07-06. State Dept advisory levels re-checked for all guide countries (L3/L4 priority + full main-list scan). One change found and **applied** same run:*

<!-- Resolved 2026-07-14: "Qatar — level changed L1 → L3." travel.state.gov shows Qatar at Level 3 "Reconsider Travel" (updated 2026-03-02, drone/missile threat after US–Iran hostilities). Applied: safety_levels.json Doha L1→L3; build_safety_guide.py banner extended to cover UAE & Qatar; Safety-Guide.html rebuilt (L3 now ×3: Abu Dhabi, Dubai, Doha); validate_safety_guide.py OK; brain_check 111/111. Guides-Index card safety (crime-risk scale, separate metric) correctly unchanged. Source: https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/qatar-travel-advisory.html -->

*No other change: UAE (Abu Dhabi, Dubai) confirmed still Level 3. No other guide country appears in the current State Dept L3/L4 lists. 17 L2 guide countries spot-checked and accurate.*

---

## 💉 Vaccines Audit — July 2026

*Auto-audit run 2026-07-14. Checked `Vaccines.html` against CDC Yellow Book 2026 + current WHO/CDC entry-requirement guidance. One change found and **applied + pushed live** same run (already in `origin/main`):*

<!-- Resolved 2026-07-14: "Yellow Fever — East Africa card overstated blanket entry requirements." Card said YF is "Required for entry to Uganda, Rwanda, Tanzania, and Ethiopia." Per current WHO/CDC only Uganda requires it from ALL travelers (age 9mo+, any origin); Rwanda, Tanzania, Ethiopia & Kenya require it only from travelers arriving from / transiting 12+ hrs through a YF-endemic country. Card rewritten to that effect; old text gone from the live page. Sources: https://www.cdc.gov/yellow-book/hcp/preparing-international-travelers/yellow-fever-vaccine-and-malaria-prevention-information-by-country.html · https://cdn.who.int/media/docs/default-source/travel-and-health/countries-with-risk-of-yellow-fever-transmission.pdf -->

*No other change: YF life-validity / single-dose / certified-clinic-only, Japanese Encephalitis (IXIARO 2-dose, rural + 1mo+), Dengue Qdenga (2023, ages 4–60, all 4 serotypes), and malaria (prescription antimalarials, no traveler vaccine) all confirmed accurate. No page destination newly declared malaria-free. CDC tool `wwwnc.cdc.gov/travel` resolves correctly.*

---

## ✈️ Delta Routes Audit — July 2026

*Auto-audit run 2026-07-06. All SEA nonstop routes on `Delta-Routes-SEA.html` confirmed accurate against current Delta / Port of Seattle sources — no corrections needed, nothing pushed. Both pages' "Updated June 2026" stamp remains valid.*

- ✅ **Verified accurate — SEA–BCN & SEA–FCO (New May 2026 · Seasonal):** FCO 4x weekly (May 6–Oct 23, 2026), BCN 3x weekly (May 7–Oct 22, 2026), both A330-900neo. Currently in-season; the "Seasonal (May–Oct 2026)" note is correct. Sources: https://www.portseattle.org/news/lets-add-two-sea-welcomes-new-delta-air-lines-international-services-rome-italy-and-barcelona · https://onemileatatime.com/news/delta-seattle-barcelona-rome-flights/
- ✅ **Verified accurate — SEA–Asia nonstops (ICN · PVG · TPE · HND) + SEA–AMS · LHR · CDG:** all still operating as listed. No new SEA nonstop international routes announced for 2027. Source: https://www.delta.com/us/en/flight-deals/asia-flights
- ℹ️ **Next-audit heads-up — revisit seasonal tags after Oct 2026:** SEA–BCN and SEA–FCO end their 2026 season Oct 22–23. Next run, check whether Delta re-filed them for summer 2027 (keep the tag) or dropped them (remove).
- ℹ️ **Not a page issue — SEA Mexico/Caribbean leisure suspensions:** Delta suspended SEA–CUN (Jun 2–Nov 8, 2026) and SEA–SJD / SEA–PVR (Oct 6–Nov 8, 2026) on high fuel costs. The SEA page lists no SEA→Latin America nonstop (routes all via ATL/JFK/SLC), so no correction required. Source: https://simpleflying.com/delta-air-lines-suspends-5-summer-seasonal-routes-high-oil-prices/

---
