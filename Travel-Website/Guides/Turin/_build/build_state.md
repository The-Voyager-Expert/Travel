# Build state — Turin
Started: 2026-05-21
Last updated: 2026-05-21

## Phase 0 — Session start
- [x] Rules for Claude.html

## Phase 1 — Pre-build orientation
- [x] Connectors.html
- [x] Platforms.md
- [x] Guide Structure.html
- [x] Stops Structure.html
- [x] Hotel Banner.html
- [x] Trip Overview.html
- [x] Toolbar.html
- [x] Navigation.html

## Phase 2 — Day shape
- [x] Day Structure.html

## Phase 3 — Per-stop build
- [x] Tickets.html
- [x] Motion Rule.html
- [x] Icon Order and Format.html
- [x] Photos Rules.html
- [x] Links.html

## Phase 4 — Per-section build
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
- [x] Claude Inspiration - Extra Section.html

## Phase 5 — Ship gate
- [x] Pre-Ship Checklist.html
- [x] validate_itinerary.py passes (624 passed / 0 failed)
- [x] every extra populated or carries negative-finding line
- [x] ship-gate exit 0 (booking links + 14 Wikipedia h1-matches all pass)

## Rebuild notes (2026-05-21 — v13 → v14)
- 5-day guide (was 6): Days 1-4 Turin self-guided + Day 5 Train Day to Milan.
- Tours moved to the Tours Extra Section (15 tours: 5 Viator / 5 GYG / 5 TripAdvisor) per the 2026-05-20 retirement of in-stop Guided Tour Stops. All day stops are now Type 2 (self-guided / ticket-gated).
- Removed Porta Palazzo Market (markets excluded per Stops Structure.html § 1c).
- Removed Turin from TOURS_EXCLUDED_GUIDES in validate_itinerary.py so the Tours section is enforced.
- v13 archived to Travel/archive/turin_v13.html.
