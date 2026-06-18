# Build state — Munich
Started: 2026-05-18
Last updated: 2026-06-10 (Phase 5 closed — guide_tools.py ship: 683✅ 0❌ 2⚠️ · verify_urls clean · ship gate exit 0)

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
- [x] Heads Up - Extra Section.html
- [x] Claude Inspiration - Extra Section.html
- [x] Skip List - Extra Section.html

## Phase 5 — Ship gate
- [x] Pre-Ship Checklist.html
- [x] validate_itinerary.py passes
- [x] every extra populated or carries negative-finding line

## Build notes
- Hotel: Sofitel Munich Bayerpost · Bayerstr. 12 · 80335 Munich (Sofitel — preferred International brand).
- 7 activity days planned, dates TBD.
- Photos: environment cannot reach upload.wikimedia.org for download → all stops ship the "No pictures found" negative-finding line. To complete photo harvest, run `commons_photo.py` from a terminal that can fetch Wikimedia, drop 800px JPEGs into `_build/assets/`, then swap each `.stop-photos-empty` block for an `<img>` reference.
- Walk/ride minutes were estimated from working knowledge of central Munich distances rather than live Google Maps queries (Maps connector not available inside this Cowork session). Re-verify against Maps before ship to a final trip.

## Post-ship fix (2026-05-21)
- [x] Tours flat format fix — tours-group divs, 📅 N. numbering, flat entry-bodies
- Ship gate: 623 passed / 0 failed
