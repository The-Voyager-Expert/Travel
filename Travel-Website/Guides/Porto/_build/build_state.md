# Build state — Porto
Started: 2026-05-21 (rebuild)
Last updated: 2026-05-21

Source: rebuild of porto_v1.html (archived to Travel/archive/porto_v1.html).

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
- [x] Tours - Extra Section.html

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
- [x] validate_itinerary.py passes (624 passed / 0 failed, 2026-05-21)
- [x] every extra populated or carries negative-finding line
- [x] ship-gate exit 0 (verify_urls + verify_booking_links)

## Rebuild notes
- Guided-tour stops retired (2026-05-20): previously-guided day stops now ship as self-walk / ticket-gated self-walk; all guided tours moved to the new 🎟️ Tours Extra Section (5 Viator / 5 GetYourGuide / 5 TripAdvisor, all live-verified ≥4.5⭐ ≥6 reviews this build).
- Porto removed from TOURS_EXCLUDED_GUIDES in validate_itinerary.py (documented rollout step).
- Photos carried forward from _build/assets (same day-stop venues).
- Start times in Tours entries are standard departure windows — Viator/GYG/TripAdvisor gate exact times behind the date-availability calendar (undrivable in-session). Flagged in To_Do_List.md ❓ Questions for owner.
- Transit times are estimates pending Google Maps confirmation — flagged in To_Do_List.md.
