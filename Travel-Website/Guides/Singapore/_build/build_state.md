# Build state — Singapore
Started: 2026-05-16
Last updated: 2026-05-24 (GYG tour #3 replaced — cycling content removed)

## Phase 1 — Core structure rules
- [x] Connectors.html
- [x] Platforms.md
- [x] Guide Structure.html
- [x] Stops Structure.html
- [x] Hotel Banner.html
- [x] Trip Overview.html
- [x] Toolbar.html
- [x] Navigation.html

## Phase 2 — Day and stop rules
- [x] Day Structure.html

## Phase 3 — Stop content rules
- [x] Tickets.html
- [x] Motion Rule.html
- [x] Icon Order and Format.html
- [x] Photos Rules.html
- [x] Links.html

## Phase 4 — Extras sections
- [x] Tours - Extra Section.html
- [x] Weekly Closures - Extra Section.html
- [x] Cappuccino - Extra Section.html
- [x] Restaurants Near Hotel - Extra Section.html
- [x] Downtown Restaurants - Extra Section.html
- [x] Local Tastes - Extra Section.html
- [x] Food Delivery - Extra Section.html
- [x] Shows, Performances & Concerts - Extra Section.html
- [x] Getting Around - Extra Section.html
- [x] Train Stations Near Hotel - Extra Section.html
- [x] Day Trips by Train - Extra Section.html
- [x] Michelin Restaurants - Extra Section.html

## v3 rebuild (2026-05-21) — fill thin days + fresh tour data
- [x] Archived singapore_v2.html → Travel/archive/ (Wall 1)
- [x] Day 3 (Ethnic Quarters) → 4 self-guided stops: Asian Civilisations Museum · Buddha Tooth Relic Temple · Sri Veeramakaliamman Temple · Sultan Mosque (was 2 stops with a pseudo-tour stop + invalid carve-out sentinel)
- [x] Day 5 (Colonial District) → 4 self-guided stops: Fort Canning Park · National Gallery Singapore · St Andrew's Cathedral · Clarke Quay (was 3 stops incl. river-cruise pseudo-stop; cruise now lives only in the Tours section)
- [x] Removed both thin-day day-count sentinels; every touring day now ≥4 stops (Day 8 = valid full-day single-venue carve-out, Universal Studios)
- [x] FRESH Viator data via MCP get_experience_details — all 11 Viator products (5 Tours-section + 6 in-stop tickets) re-confirmed; every URL refreshed from stale d50 → canonical d60449 / d50208; ratings re-verified; river cruise reviews 800+→900+ (922)
- [x] GetYourGuide (5) + TripAdvisor (5) tours carried from v2 verified set — no TripAdvisor tours MCP available this session; GYG undrivable for live calendar (per prior sessions). Tours 5/5/5.
- [x] 5 new Wikimedia Commons photos (CC BY-SA 4.0): Buddha Tooth, Sri Veeramakaliamman, Sultan Mosque, National Gallery interior, St Andrew's Cathedral. Reused Clarke Quay/Singapore River photo. Archived 2 now-unused photos (Chinatown Alley, Teatro Victoria).
- [x] Fixed dead carry-over link: ACM nhb.gov.sg/acm/visit-us/admission-fees (404) → /acm/visit/admissions (200)
- [x] verification_log.json repointed to v3; 11 refreshed Viator MCP PASS entries added; 19 stale d50 entries pruned
- [x] validate_itinerary.py: singapore_v3.html added to _TRAIN_DAY_QUOTA_EXEMPT (Singapore has no intercity rail)

## Ship gate (2026-05-21)
- [x] validate_itinerary.py — ✅ 602 passed / 0 failed (thin-day warning resolved)
- [x] verify_booking_links.py — ✅ 41 passed / 0 failed (25 Wikipedia h1-match PASS)
- [x] live-URL sweep — 0 dead links (109 OK · 29 expected bot-blocks · 2 official MBS anti-bot timeouts carried from v2)
- [x] Guides-Index.html updated Singapore v1 → v3
- [~] Single-pass `guide_tools.py ship` exit code not capturable in-session — sandbox 45s wall truncates the 141-URL serial live sweep. All three component gates pass independently.
