# Build state — Sydney
Started: 2026-05-14
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

## Phase 5 — Ship gate
- [x] Pre-Ship Checklist.html
- [x] validate_itinerary.py passes — 600 passed, 0 failed (2026-05-21)
- [x] every extra populated or carries negative-finding line

## Build notes
- Hotel: InterContinental Sydney · 117 Macquarie Street · Circular Quay (IHG — preferred International brand).
- 8 activity days planned (Day 8 = Train Day — Blue Mountains), dates TBD.
- Tours section rebuilt 2026-05-21: Type 1 / Type 3 guided stop types retired; all 15 tours moved to Tours Extra Section (5 Viator · 5 GYG · 5 TripAdvisor). Munich and Sydney removed from TOURS_EXCLUDED_GUIDES.
- Hotel pickup tours (V5 Blue Mountains, G5 Blue Mountains, T4/T5 Blue Mountains): use Circular Quay · CBD as 📍 meeting point + 🚶 0 min · 🚕 0 min → pickup at hotel.
- Photos: some stops ship the "No pictures found" negative-finding line. Run commons_photo.py from a terminal that can fetch Wikimedia to harvest remaining photos.
- Walk/ride minutes estimated from working knowledge of central Sydney distances. Re-verify against Maps before ship to a final trip.
