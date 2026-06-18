# Build state — Palo Alto (v6 rebuild)
Started: 2026-05-21
Last updated: 2026-06-10 (Phase 5 closed — guide_tools.py ship: 684✅ 0❌ 2⚠️ · verify_urls clean · ship gate exit 0)

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
- [x] Pickleball - Extra Section.html
- [x] Michelin Restaurants - Extra Section.html
- [x] Heads Up - Extra Section.html

## Phase 5 — Ship gate
- [x] Pre-Ship Checklist.html
- [x] validate_itinerary.py passes
- [x] every extra populated or carries negative-finding line

## v6 rebuild notes
- In-stop tour boxes RETIRED (2026-05-20) — all stops Type 2 self-guided; tours ship only in Tours Extra Section.
- US no-trains rule: Day 7 (was Caltrain Train Day to SF) converted to a Self Uber/car day. All 7 days are Self, car/Uber based.
- Train Day quota cannot be satisfied under no-trains directive — palo_alto_v6.html added to _TRAIN_DAY_QUOTA_EXEMPT in validate_itinerary.py.
- Palo Alto removed from TOURS_EXCLUDED_GUIDES — full Tours section enforced (5 Viator / 5 GYG / 5 TripAdvisor, no private tours, small-group favored).
