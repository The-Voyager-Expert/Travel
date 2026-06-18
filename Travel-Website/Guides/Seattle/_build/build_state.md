# Build state — Seattle
Started: 2026-06-05
Last updated: 2026-06-07 (session 4 — HTML completed by session 3 crib, format-fixed to validator 0 this crib; SHIPPED, ship gate exit 0)

## Session 3 research recovered/completed (2026-06-06)
- Guide: 2 days · Hotel: Inn at the Market, 86 Pine St (Pike Place Market, Downtown)
- Day 1 (planned): Pike Place Market → Seattle Great Wheel → Smith Tower → Seattle Central Library
- Day 2 (planned): Olympic Sculpture Park → Space Needle → Chihuly Garden and Glass → Kerry Park
- 8 stop photos in `_build/assets/` (done, prior session)
- STOPS research DONE (hours/addresses/Wikipedia/descriptions/tickets verified live this session):
  - Pike Place Market FREE · 85 Pike St · Daily, most 10am–5pm · wiki ok
  - Great Wheel · 1301 Alaskan Way Pier 57 · Daily 11am–9pm · ticket: venue store behind Cloudflare (verify via Chrome MCP) — tickets.minerslanding.com/WebStore/landingpage?CG=consumer&c=WH
  - Smith Tower · 506 Second Ave · Wed–Thu 11–8, Fri–Sat 11–9, Sun 11–8 · 🚫 Mon & Tue · Viator d704-42889P2 · 4.2⭐ · 140 reviews
  - Central Library FREE · 1000 Fourth Ave · Mon 10–6, Tue–Thu 10–8, Fri–Sun 10–6
  - Olympic Sculpture Park FREE · 2901 Western Ave · dawn–dusk (30 min before sunrise–30 after sunset)
  - Space Needle · 400 Broad St · ~8:30/9am–10:30/11pm rolling · Viator d704-5929GEN · 4.3⭐ · 529 reviews
  - Chihuly · 305 Harrison St · rolling ~9am–7:30/9:30pm · Viator d704-5934CHIHULY · 1,061 reviews · rating N.N UNCONFIRMED → get via Viator MCP get_experience_details
  - Kerry Park FREE · 211 W Highland Dr · Daily 6am–10pm
- LOGISTICS research DONE (verified live): Shows = Benaroya Hall (seattlesymphony.org, 200 University St), McCaw Hall (seattleopera.org + pnb.org, 321 Mercer St), 5th Avenue Theatre (5thavenue.org, 1308 5th Ave); Paramount excluded (touring). Getting Around: Uber+Lyft ok; Seattle Streetcar (SLU+First Hill, seattle.gov/transportation/getting-around/transit/streetcar); Monorail (seattlemonorail.com); WSF ferry Colman Dock Pier 52. Station: King Street Station only, 303 S Jackson St · Pioneer Square (Cascades/Coast Starlight/Empire Builder/Sounder); no high-speed. Day Trips by Train: Tacoma 48 min, Portland 3 hr 25 min, Edmonds 26 min (Vancouver BC excluded — no reputable-guide day-trip rec); book at Amtrak + omio (omio sells Cascades). Weekly Closures pattern: Art Museums · Closed Monday & Tuesday (SAM, Asian Art, Frye, Wing Luke; Burke Mon only). Food Delivery: Uber Eats, DoorDash, Grubhub (omit Postmates).
- STILL TO DO before HTML: (1) FOOD agent — 5 cafés ≤25 min walk incl. Monorail Espresso (no US-chain roasters), 5 restaurants near hotel (seafood-core excluded; Place Pigalle candidate — verify still open), 5 downtown restaurants, Local Tastes, Michelin check (expect negative line); (2) TOURS via Viator MCP search_experiences→get_experience_details (prior candidates: Beneath the Streets 4.7·8,500+, Mt. Rainier Highlights 4.8·3,300+, Seattle City Highlights 4.8·761, Seattle City + Snoqualmie Falls 4.9·1,364) + GYG site: search (5 target) + TripAdvisor MCP (5 target); bar 4.5+⭐ ≥6 reviews; walking tours 2–4 cap; (3) ALL walk/ride times via Google Maps (Chrome MCP) — both days' consecutive-stop pairs, hotel↔first/last, cafés, restaurants, show venues, King Street Station; (4) Chihuly Viator rating via MCP; (5) verification_log.json for bot-blocked URLs.
- THEN: write HTML (Guides/Seattle/seattle_v1.html, CSS ../guide_v3.css, toolbar depth 2), sections: Title → Trip Overview (+pills) → Day 1 → Day 2 → Weekly Closures → Tours → Cappuccino → Restaurants Near Hotel → Downtown → Local Tastes → Food Delivery → Shows → Getting Around → Stations Near Hotel → Day Trips by Train → Michelin (negative expected) → Claude Inspiration. NO Pickleball (WA), NO Heads Up (no Seattle in Brain.md Part 3), NO Skip List (none). Flip Phase 5 boxes per section; then Phase 6 validate→0, audit log entry, ship, guides_index 5-step (incl. US Map pin — Navigation.html §5 says Trip Essentials/Maps/US Map.html; CLAUDE.md says Trip Essentials/US Map.html — verify actual path on disk).

## Phase 0 — Session start
- [x] Rules for Claude.html

## Phase 1 — Technical prerequisites
- [x] Links.html
- [x] Photos Rules.html
- [x] Brain/Reference/Connectors.html
- [x] Brain/Reference/Platforms.md

## Phase 2 — Guide structure
- [x] Guide Structure.html
- [x] Stops Structure.html
- [x] Hotel Banner.html
- [x] Trip Overview.html
- [x] Brain/Reference/Toolbar.html
- [x] Brain/Reference/Navigation.html

## Phase 3 — Day shape
- [x] Day Structure.html

## Phase 4 — Per-stop build
- [x] Tickets.html
- [x] Motion Rule.html
- [x] Icon Order and Format.html
- [x] Guide Style.css (markup contract)

## Phase 5 — Per-section build
- [x] Weekly Closures - Extra Section.html
- [x] Tours - Extra Section.html
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

## Phase 6 — Ship gate
- [x] Brain/Reference/Ship Checklist.html
- [x] validate_itinerary.py passes (701 passed / 0 failed · 2026-06-07 18:16)
- [x] every extra populated or carries negative-finding line

## Session 4 close-out (2026-06-07)
- Fixed 47 validator failures left by session 3 HTML (format drift: overview/day-header/hours/ticket-box/review-link/tours formats).
- Replaced excluded tour types: chef food tour + donut tasting tour dropped; added Welcome to Seattle Walking Tour (Viator 479383P1, 5.0⭐ 194 reviews, verified via Viator MCP + TA product page: 10:00am, 2 hr 30 min, 15 max, 100 Yesler Way; 18 min walk / 5 min ride to hotel via Google Maps).
- Dropped TA Locks Cruise (no published group size — required 🕐/⏳/👥 row cannot ship complete); TA ships 1 entry, documented in low-count comments.
- Review links: all café/restaurant headings now link Yelp biz pages with live-verified Yelp ratings/counts (Chrome renders). Il Bistro dropped (3.8 on Yelp); RNH ships 5.
- Kerry Park→hotel walk = 42 min (Google Maps) → walk-over-40 sentinel on Day 2 closer.
- OSP hours: PACCAR Pavilion 9:00am - 4:00pm + paren qualifier for sunrise/sunset grounds (per seattleartmuseum.org live).
- Getting Around: tram template 2 (has system, no rides this trip) + ferry negative line; extras-empty pollution removed.
- verify_urls.py BOT_BLOCKED_HOSTS: added seattlesymphony.org + tickets.minerslanding.com (403 to crawlers, live in browser).
- guides_index 5-step done (card num 64, Scottsdale↔Seattle↔Seoul chain, banner 64 guides, US 15 guides, US Map pin).
- Ship gate exit 0 (validate 701/0 + verify_urls + verify-booking + index + map pin).
