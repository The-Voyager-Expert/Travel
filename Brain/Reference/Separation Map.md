> **Claude maintains this file — fix immediately, no approval needed.** When this file drifts from Brain/CORE RULES/, fix it in the same pass. CORE RULES is the authority; this file follows. No questions, no permission, no parking for later.

# Separation Map

Which topic belongs in which core rules doc. Check this before adding anything to any file.

Each doc has ONE job. If a topic isn't listed under a file, it doesn't go there.

---

## Brain/Reference/Toolbar.html  *(moved out of CORE RULES 2026-05-30)*

- Required mount div markup for every HTML page (`<div id="toolbar-mount">` + script tag)
- `data-depth` rule (folder levels below `Travel/` — drives relative hrefs and script path)
- `data-maxwidth` values (760 Trip Essentials / 940 Guides) — legacy, no longer caps the bar; values still present but inactive
- How to add a new page to the menu (edit `toolbar.js` ITEMS array only — never per-file; also update `Travel-Website/Website-Main-Pages-Links.html`)
- Visual design of the toolbar bar (§ 5 — appearance, colors, pill styling)
- Auto-styling behavior (toolbar reads page background at runtime — no per-page override needed)
- Footer sharing link (§ 6 — ⛔ retired 2026-06-06; `FOOTNOTE_RETIRED = true` guard in `toolbar.js`, enforced by TB-9/TB-11; re-enable path documented in § 6)
- Centering rule for toolbar content (§ 7 — LOCKED; row is `width:max-content` + `margin:0 auto`, no width cap ever; enforced by `brain_check.py check_toolbar_centering()`)
- Weather widget integration (§ 8 — toolbar-injected weather widget rules; added 2026-06-13)
- PWA manifest and service worker (§ 9 — Progressive Web App setup; added 2026-06-15)

---

## Brain/Reference/Navigation.html  *(moved out of CORE RULES 2026-05-29)*

- The shared footnote — ⛔ retired 2026-06-06 (was: sharing link on every page, auto-loaded by `toolbar.js`); retired mechanics kept in Navigation.html § 1 for the re-enable path
- `data-prev` / `data-next` attributes on the toolbar mount div (guide pages only)
- Chain integrity rule (bidirectional consistency — predecessor's next must match successor's prev)
- `guides_index.html` wiring (matching `data-guide-prev` / `data-guide-next` on index cards)
- Procedure for inserting a new guide into the chain (5 steps, all in one pass — see Navigation.html § 5)
- Scroll progress bar and scroll button (passive aids on every page)
- Guides index full-text content search (§ 8 — search index file existence and staleness check; added 2026-06-14)

---

## Travel-Website/Trip-Essentials/Essentials-Pages-Rules.md

- Which Trip Essentials pages carry a search box
- Search filtering and group-collapse behaviour
- No-results state: title + search box + message only; content, jump-nav, legends, index table, and shared footnote all hide

---

## Stops Structure

- Stop selection criteria (what qualifies, what doesn't ship — include/exclude lists, quality bar)
- Research flow and trusted sources (Fodor's, Culture Trip, Rough Guides, Atlas Obscura, Rick Steves, NatGeo, official tourism boards)
- Stop type and shape template (Self-Guided Stop — the only active stop type)
- 🚆 Train Day pattern (day-level wrapper template — § 3c)
- Stop naming rule (always the venue, never generic)

## Tickets.html

- Booking source by stop type (§ 1): US live events/performances → Ticketmaster / StubHub / TodayTix · US attractions/museums → Viator / GetYourGuide / TripAdvisor · International → Viator / GetYourGuide / TripAdvisor (Klook fallback in Asia) · Venue site is always last resort
- Entry formats (§ 2): 2a via platform (`🎟 [Title] · [N.N]⭐ · [Review Count]+ reviews · [Platform]`) · 2b venue site (`🎟 [Title] · [N.N]⭐ · [venue.domain]`) · 2c URL-only (`🎟 [Booking Platform]`)
- No rating floor — unlike Tours, any rating ships

## Tours.html — ~~Retired 2026-05-20~~

Moved to `Travel/Retired Rules/Retired_Tours.html`. In-stop tour boxes and the Guided Tour Stop pattern are retired. All tour rules now live in `Tours - Extra Section.html`.

## Tours - Extra Section

- Per-source minimums (≥5 Viator, ≥5 GetYourGuide, ≥5 TripAdvisor; ship fewer when not enough qualify)
- Walking tour cap (minimum 2 target, not a floor — ship fewer when not enough qualify; maximum 4 is a hard cap; both across all platforms combined)
- Rating bar (≥4.5⭐ AND ≥6 reviews — hard fail below bar)
- Grouping & numbering (grouped by platform: Viator → GYG → TripAdvisor; per-platform counter resets to 1)
- Entry format (📅 [N]. [Tour Name] · [Operator] · [Rating]⭐ · [Reviews]+ reviews + body box with ↳ summary ≤320 chars, 🕐/⏳/👥 row, 📍 meeting point, 🚶/🚕 motion)
- City rule (tours must be held in or depart from the guide city)
- Hotel pickup variants (🏨 ↔ 🚐 / 🏨 → 🚐 / 🏨 ← 🚐)

## Guide Structure

- Section order top-to-bottom (Title Page → Trip Overview → Day blocks → Extra sections; Claude Inspiration is extra section #15 (optional), Skip List is extra section #16 and the true last element)
- Extra-section order (16 sections: Weekly Closures is #1; Tours is #2 — added 2026-05-20, after Weekly Closures; 12 universal + 3 conditional — Pickleball (CA/AZ/OR only), Heads Up (entries gated), Skip List (ships only when destination has a skip list) — plus Claude Inspiration optional; Skip List is always the final element, after Claude Inspiration)
- Universal shipping rule (every guide ships the 12 universal Extra sections; Pickleball + Heads Up + Skip List are conditional)
- Build phases & required reads per phase (Phase 0–6 with mandatory file reads; Phase 6 = ship gate)
- Day numbering (Day 1 = first full touring day per Day Structure § 1)

## Day Structure

- Trip length (§ 1 — count full days only; ignore arrival and departure days)
- Stop count (§ 5 — ≥4 full self-guided day; down to 1 when a single distant or all-day stop sets the pace)
- Geographic clustering / no backtracking rule (§ 4)
- From Hotel opener — mandatory, every day (§ 2; format in Motion Rule.html)
- Stop numbering (§ 3 — resets to 1 every day)
- Train Day quota (§ 6 — guide with ≥5 days must include at least one Train Day; guide with ≤4 days must not)
- Train Day pattern / full-day template (§ 7 — From Hotel → 🚊/🚄 outbound block → stops → 🚊/🚄 return block → 🚉 ARRIVE home; morning outbound, evening return)

## Motion Rule

- Walk vs. ride threshold (≤40 min walk / >40 min ride — 🚕 only when walk exceeds 40 min)
- 🚕 time = driving-mode route duration from Google/Apple Maps (or local app where major apps lack driving coverage) — never from ride-share APIs or estimators
- ` · ` separator between options
- Modes: 🚶 walk · 🚕 ride app · 🚤 water taxi (car-free cities only — replaces 🚕 in every motion banner; e.g. Venice) · 🚎 tram · 🚝 metro · 🚢 ferry — no bus
- Between-stops banner — one between every consecutive stop pair: `🚶 [N min] · 🚕 [M min] → [Next stop]`
- Day closer — `🚶 [N min] · 🚕 [M min] → hotel` — REQUIRED, last element of every regular day
- Which extra sections carry motion rows (§ 2): WITH — Cappuccino, Restaurants Near Hotel, Stations Near Hotel, Pickleball, Shows, Michelin · WITHOUT — Downtown, Local Tastes, Heads Up

## Trip Overview

- Day-type icons: 🚩 Self-Guided (CSS ::before icon removed 2026-06-16) · 🚆 Train Day (defined in § 1)
- Self-Guided card format: `Day N – [Stop 1] · [Stop 2] · [Stop 3]`
- Train Day card format: `Day N · 🚆 Train Day — [Destination]`
- Day order (in-city days first, Train Days last)
- Extras pill row (§ 3 — one pill per shipping section; canonical labels locked, validator hard-fails on deviation)
- Jump anchor format

## Hotel Banner

- Title page layout (CITY / Hotel Name / Address)
- Hotel name appears exactly once (title page only) — enforced by validator; not documented in Hotel Banner.html
- Every other reference = generic "hotel" (never the hotel's name) — enforced by validator; not documented in Hotel Banner.html

## Restaurants Near Hotel

- Minimum 5 · ≤25 min walk · ordered by walk time (closest first)
- Format: name linked to review page (Yelp / Google Reviews / Local Guide) with stars + review count · ↳ cuisine style ≤80 chars · 🏛 hours · 🚫 closed day · 📍 address · walk/ride rows
- Hotel restaurant rule (add first if exists, doesn't count toward the minimum of 5)
- Seafood exclusion: venues whose primary identity is fish/shellfish/bacalhau are excluded (sushi permitted)
- Michelin-starred restaurants are excluded here — they ship in the Michelin Restaurants section only
- Negative-finding line when none qualify within 25 min

## Downtown Restaurants

- Minimum 5 in the historic downtown core, ordered by review consensus and editorial standout
- No walk-time row (district-scoped)
- No overlap with Restaurants Near Hotel — must be different picks
- Seafood exclusion (same as Restaurants Near Hotel)
- Michelin-starred restaurants are excluded here — they ship in the Michelin Restaurants section only
- Negative finding when no qualifying restaurants found in downtown

## Michelin Restaurants

- Stars only (1⭐ 2⭐ 3⭐ — no Bib, no Plate)
- Seafood exclusion (same rule as Restaurants Near Hotel)
- Maximum 5 entries; all qualifying tiers ship within that cap
- Overflow line when >5 qualify: `Not shown: [N] ⭐⭐⭐ · [N] ⭐⭐ · [N] ⭐ more in [City]`
- Order: stars descending (⭐⭐⭐ first), within-tier by ride time from hotel (not walk time)
- Hotel restaurant rule: if the hotel has a Michelin-starred restaurant, ship it first — no 📍 or motion row
- Negative-finding line when none qualify: "No Michelin-starred restaurants in [City]."

## Cappuccino

- Minimum 5 cafés · ≤25 min walk · ordered by walk time (closest first)
- Best espresso by local consensus — independent cafés or non-American-chain specialty roasters only
- Café name links to the review page (Yelp / Google Reviews / Local Guide), not the café's own site
- Hotel café rule: if the hotel has a café, ship it first — before all walk-distance entries; no 📍 or motion row
- Negative-finding line when none qualify within 25 min

## Shows, Performances & Concerts

- Truly exceptional only ("if it tours, it likely doesn't qualify")
- 🎟 → `[Booking Platform]` (format per Shows, Performances & Concerts - Extra Section.html § 3)
- Negative-finding line when none qualify

## Local Tastes

- Tied to a specific place's identity — not country-level clichés
- Negative finding when nothing genuinely distinctive exists

## Food Delivery

- Standalone extra section listing which delivery platforms operate in the destination
- Negative-finding line when no platforms available

## Day Trips by Train - Extra Section

Train day-trips only (by-car/Uber retired 2026-05-03).

- Destinations recommended by trusted sources only (Fodor's, Culture Trip, Rough Guides, Rick Steves, NatGeo, official tourism boards)
- No overlap with Train Days already in the itinerary (rule preserved unchanged in the 2026-06-15 § 4 addition)
- Format: `[Destination] [Travel Time]` + `↳ description ≤320 chars` + `🎫 book at: [Operator] or [omio]`
- Negative-finding line when none qualify
- § 4 European-country minimum: guides in European countries must ship ≥5 entries — hard fail below the floor (added 2026-06-15)

## Getting Around

- Ride apps (Uber primary, fallbacks by city)
- Tram (§ 2 — when a tram system exists)
- Metro (§ 3 — when requested)
- Ferry (§ 4 — when a ferry route is relevant to in-city travel)

## Train Stations Near Hotel

- Two entries: closest local/regional station (🚊) + closest high-speed station (🚄)
- When the same station serves both, ship one combined entry
- No walking-distance limit (always show closest, no matter how far)
- Icon rule: 🚊 always for local/regional · 🚄 always for high-speed (per § 3a / § 3b — not conditional)
- Format: `🚊/🚄 [Station Name]` + `[Lines] → [Key Destinations]` + `📍 address` + `🚶 [N min] · 🚕 [M min] → hotel`
- Row order locked: station name → lines → map → walk
- No-station fallback: ship "No train stations in {City}." when none exist

## Hotels & Rentals  *(rules live in `Travel/On Demand/Hotels & Rentals - On Demand.html`)*

- Listed brands only (US: Marriott/Hilton/Hyatt · Intl: NH Collection/Meliá/Novotel/Sofitel/Pullman/Radisson Blu/Intercontinental)
- No off-list brand ever ships as primary
- Ratings (9.0+ Booking.com / 4.5+ elsewhere)
- Rental fallback when no qualifying hotel

## Delta  *(rules live in `Travel/On Demand/Delta - On Demand.html`)*

- Delta + SkyTeam only — never search or compare others
- Origin SEA · round-trip · First Class preferred

## Car Rentals  *(rules live in `Travel/On Demand/Car Rentals - On Demand.html`)*

- Hertz default
- Fallback ladder: Enterprise → Avis → Budget → Europcar → Sixt

## Links

- Every link live-verified, every edit — HTTP 200 + ≥100 words of editorial content (§ 1)
- Subject-drift check (§ 2) — TripAdvisor Attraction_Review and Wikipedia /wiki/ URLs get a third gate: fetch h1 and match against venue name
- Bot-blocked platforms verify via site: search only — never direct fetch (§ 4): Viator · GetYourGuide · TheFork · Michelin · TripAdvisor; authoritative list in Brain/Reference/Platforms.md
- Verification log (§ 3) — every guide carries `Travel-Website/Guides/{City}/_build/verification_log.json`; PASS entry permanently clears a URL, no age expiry
- 📖 → English Wikipedia only (§ 5)
- 📍 → Google Maps anchor on the address — address text is the anchor, applies everywhere (§ 6)
- target="_blank" on every external link (§ 7)
- No underline on any link (§ 8 — re-homed 2026-06-06; originally Icon Order § 6, locked 2026-05-16)

## Photos

- Source: Wikimedia Commons (default); no placeholders (§ 1)
- One photo per stop — must genuinely depict the stop's subject (§ 3)
- Photo selection by stop type (§ 3a): three categories — (1) structure IS the attraction (e.g. Eiffel Tower, Harpa) → exterior/facade; (2) interior IS the attraction (museums, galleries, theaters) → interior shot; exterior only when no licensed interior exists; (3) everything else → show the subject itself (the natural feature, the plaza space, the view)
- Licenses: Public Domain · CC0 · CC-BY · CC-BY-SA — non-commercial and unclear excluded (§ 2)
- Storage: local in Travel-Website/Guides/{City}/_build/assets/ — download only, always (commons_photo.py --download); upload.wikimedia.org hotlinks are banned and validator-hard-failed; see § 5
- "No pictures found" reserved for genuine search failure only — not for technical/rate-limit errors (§ 6)

## Weekly Closures

- City-wide patterns only (single-venue closures go on the stop block — 🚫 Closed [Weekday])
- Format: Category · Closed Day (supports ranges and & for multiple days)
- Negative-finding line when no notable city-wide pattern exists

## Heads Up

- Per-trip "wish I'd known" intel — venue notes, timing tricks, booking quirks
- Source: Brain/Reference/Brain.md Part 3 (Heads Up region) — city must appear there; no entry = section skips, no negative-finding line
- Format per entry: `❗️ [Venue] — [Short Title]` + `↳ [Note] ≤150 chars` + `Workaround: [What To Do Instead]`

## Pickleball

- Conditional Extra Section — California, Arizona, and Oregon only
- Any court within 25 min walk of the hotel qualifies (proximity is the only filter); no cap on entries
- Mix of outdoor parks and indoor facilities; ordered by walk time (closest first)
- Description line ≤80 chars; venue name is plain text (no hyperlink); no rating stars in name
- Negative-finding line when no court within 25 min
- Section icon: 🏓 Unicode emoji
- Section format and inclusion bar live in `Pickleball - Extra Section.html`

## Weather  *(rules live in `Travel/On Demand/Weather - On Demand.html`)*

- Weather.com · AccuWeather · Ventusky · Windy.com

## Claude Inspiration

- Optional — ships only when something genuinely worth sharing surfaced during research; skip entirely when nothing did (no negative-finding line)
- Free-form prose; multiple `<p>` blocks allowed, no cap — quality bar governs, not length
- Icon, title, and color theme are Claude's pick per guide (any non-reserved emoji; any theme-{color} class)
- Second-to-last element — Skip List follows when it ships

## Skip List

- Conditional extra section — ships only when the destination has venues already visited (no banner, no heading, small italic grey footnote)
- Venue names listed inline; no links, no ratings
- True last element of every guide — after Claude Inspiration, after everything else
- Rules and format live in `Skip List - Extra Section.html`

---

## Icon Order and Format

- Section header icons (which emoji leads which EoI section)
- Universal row order within every stop box (icon sequence rules)
- Exact format rule per icon glyph
- Train icons: 🚊 regional train route header · 🚄 high-speed train route header · 🚉 ARRIVE banner (arrive-first) · 🚆 Trip Overview Train Day card + Stations Near Hotel section title/pill — 🚆 never inside stop or train blocks
- Description character limits per row type

## Rules for Claude

- Claude's behavioral meta-rules — what Claude must/must not do, how to interpret scope and authorization
- File-handling tool choice — edit existing files in place (Edit/Write on the mounted path); never use Drive MCP create_file to modify an existing file (creates a `Name (1)` duplicate)
- "Meaningful over full" principle (every stop earns its place; a short excellent day beats a padded one)
- Pre-authorized actions (build pre-auth, link verification, photo harvest) — referenced from other files via callout blocks
- CSS/HTML formatting rules do NOT go here; they go in Brain/Reference/

---

## What goes where — quick decision

| I need to add... | Goes in... |
|---|---|
| A new stop type | Stops Structure.html |
| A new tour sourcing rule | Tours - Extra Section.html |
| A tour quality bar change (rating/review threshold) | Tours - Extra Section.html |
| A tour grouping or entry format rule | Tours - Extra Section.html |
| A new EoI section | Guide Structure.html |
| A new stop flag (icon, format, or order) | Icon Order and Format.html |
| A new ticket platform | Tickets.html (waterfall) |
| A new in-city transit type (ride app, tram, metro, ferry) | Getting Around - Extra Section.html |
| A new motion icon or walk/ride rule | Motion Rule.html |
| A new station-near-hotel rule | Train Stations Near Hotel - Extra Section.html |
| A new hotel brand | Hotels & Rentals *(On Demand)* |
| A day structure rule | Day Structure.html |
| A walk-vs-ride threshold tweak | Motion Rule.html |
| A research source | Stops Structure.html |
| A new Heads Up entry | Heads Up - Extra Section.html |
| A new Pickleball-section rule | Pickleball - Extra Section.html |
| A new Skip List rule | Skip List - Extra Section.html |
| A new day-trip rule | Day Trips by Train - Extra Section.html |
| A new icon assignment or row-order rule | Icon Order and Format.html |
| A new guide added to the chain | Navigation.html (procedure) |
| A toolbar menu item added | Brain/Reference/Toolbar.html § 4 |
| A Claude behavior or authorization rule | Rules for Claude.html |
