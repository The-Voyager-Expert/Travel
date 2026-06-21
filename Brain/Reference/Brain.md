# Brain — Master Reference (combined)

> **Read this at every session start.** This single file combines four formerly-separate Brain/mds files:
> Part 1 Travel Folder Map · Part 2 Decisions (judgment-call log) · Part 3 Heads Up (per-city) · Part 4 Cities Skip List.
> The rolling **audit log stays separate** in `Brain/Reference/audit_log.md` — nothing else is combined with it.
>
> Validators read Parts 3 and 4 by slicing the sentinel-delimited regions below (the BRAIN:HEADS-UP and BRAIN:SKIP-LIST start/end marker comments). **Do not remove or rename those marker comments, and do not reproduce them in prose.**
>
> **Appending entries:** add a new Heads Up city or Cities Skip List city *inside* the matching sentinel region (above the END marker) — never after it, or the validators won't see it.

---

# ═══════════════════════════════════════════════
# PART 1 — TRAVEL FOLDER MAP
# ═══════════════════════════════════════════════

# Travel Folder Map — Claude's Resource Briefing

> **Read this at every session start.** It is your complete map of what exists, where it lives, and what it's for. If you don't know where something is — it's in here.
>
> **Last updated: 2026-06-19**

---

## What you are working with

You are Claude, working inside the owner's Travel folder on Google Drive. You build city guides, manage trip logistics, and maintain the infrastructure that makes guide-building clean and consistent. Everything you need is in this folder tree. This file tells you where.

---

## Travel/ — root folder

| File / Folder | What it is | Who owns it |
|---|---|---|
| `CLAUDE.md` | **Your session entry point.** Lean quick-reference pointer file: points to Rules for Claude.html as the source of truth, key reminders (connectors, file location, archive rule, trip updates), and workspace layout overview. The full session ritual, DriftyCat, and behavioral rules live in `Brain/CORE RULES/Rules for Claude.html` — CLAUDE.md points there, not duplicates. Read at every session start. | Claude maintains |
| `Brain/Reference/Brain.md` | **This file** (combined master — Parts 1–4). Read at session start alongside CLAUDE.md. Moved from `Brain/mds/` to `Brain/Reference/` 2026-06-15. | Claude maintains |
| `Brain/` | Everything that powers guide-building: rules, validators, scripts, CSS, reference files. Details below. | Claude maintains |
| `Travel-Website/` | **Published site root** (2026-06-13 reorg). Holds everything that ships to GitHub Pages: `Guides/`, `Trip-Essentials/`, `assets/` (shared JS/CSS/data), `index.html` (redirect to Guides-Index.html — not the hub; the Main Pages hub is `Website-Main-Pages-Links.html`), and the PWA root files `manifest.webmanifest` + `sw.js` (the offline service worker — must stay at this root for scope; see `Brain/Reference/Toolbar.html` § 9. PWA). Pages load shared files from `assets/` at their own relative depth below this root. | Claude maintains |
| `Travel-Website/assets/` | **Shared-asset home.** Holds `toolbar.js`, `footnote.js`, `weather.js`, `guide_v3.css`, `mobile.css`, `climate.json`, `search_index.json` (generated guide content-search index — built by `Brain/scripts/build_search_index.py`, refreshed automatically on every ship), `_travel_style.css` (the Trip Essentials pages' shared stylesheet), and `icons/` (PWA app icons — `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `favicon-32.png`, `app-icon-pin.svg` source) — all consolidated here as the single shared-asset home. `guide_v3.css` is the deployed copy of `Brain/Reference/Guide Style.css`, kept in sync via `guide_tools.py sync-css`. One edit here updates every page. | Claude maintains |
| `Travel-Website/Guides/` | **FROZEN** city guides (HTML + PDF + `_build/assets/` photos). Never read, grep, touch, or reference unless explicitly asked in chat. Contains `Guides-Index.html` (symlink → `Guides-Index.html`) — master index of all published guides with live GitHub Pages URLs; update on every ship per the delivery procedure in `Rules for Claude.html` § 4. `Guides-Index.html` / `Guides-Index.html` is NOT frozen — Claude maintains it. Shared CSS/JS no longer live here (moved to `Travel-Website/assets/` 2026-06-13). | owner-managed |
| `Brain/Reference/` | Operational reference files: `Core Rules Style.css` (styles CORE RULES docs) · `Guide Style.css` (styles shipped guides; copy kept in `Travel-Website/assets/guide_v3.css` for GitHub Pages) · `Core Rules Formatting.html` (canonical formatting rules for CORE RULES docs) · plus Platforms, Separation Map, PDF Render Notes, Rule Dependencies, Validator Index, Guide Entry Counts, Ship Checklist, Change Cascade, Connectors, Emoji Library, and more. | Claude maintains |
| `Brain/Reference/Connectors.html` | Briefing doc listing every connected tool and connector (TripAdvisor, Drive, Viator, Canva, Spotify, Chrome, Calendar, etc.). Read at session startup. Moved from `Travel/Claude Capabilities/` 2026-05-26. | Claude maintains |
| `Retired Rules/` | Retired CORE RULES files — removed from `Brain/CORE RULES/` when a rule is superseded. Current contents: `Retired_Tours.html` (in-stop guided tour format retired 2026-05-20; Tours Extra Section now governed by `Tours - Extra Section.html` only). Sealed — never reference these files in builds. | owner-managed |
| `Hotel Research/` | the owner's hotel research files. Not under Brain — hotel research is on-demand, not guide-building infrastructure. Contains `Amsterdam Hotels - Research.md`, `Hotel Research Index.md`, `Bend_Rentals.docx` (Bend rental research). | owner-managed |
| `Icons Library/` | Icon assets for guides. Key utility files: `icon_resources.md` (source links + notes), `_PREVIEW_all_icons.html` (browse all icons), `icon_picker_transport.html` (transport icon picker). `for_guides/` contains the icons actually used in shipped guides (organised by section: cappuccino, pickleball, shows, etc.). Source packs in `Favorite iconscout_3d/`, `iconscout_2d/`, `3dicons_co/`, `magnific/`, `transport_icons/`. | owner-managed, Claude references |
| `Brain/Reference/Emoji Library.html` | Locked-out emoji list and glyph registry. Moved from `Travel/Emojis Library/` 2026-05-26. | Claude maintains |
| `Travel-Website/Trip-Essentials/` | Combined essentials + trip-tracker folder (formerly separate `Trips/` folder merged here; moved under `Travel-Website/` in the 2026-06-13 reorg). Trip tracker: `Trips.html` (live tracker — source of truth for trip data; Claude edits this), `Trips-Rules.md` (read before editing Trips.html). Packing: `Travel-Packing.html`, `Plug-Adapter/` (folder). Lounges: `Lounges-Europe.html`, `Lounges-US.html` — reachable from the toolbar **💻 Lounges dropdown** (US + EU collapsed into one slot, 2026-06-15). Delta routes: `Delta-Routes-Full.html`, `Delta-Routes-SEA.html` — reachable from the toolbar **✈️ Delta dropdown** (Seattle Hub + Full Network, 2026-06-15; uses the slot the Lounges grouping freed). `European-Train-Guide.html` is the toolbar **🚆 Trains** plain link (direct, no menu). Toolbar utility pages: `Resources.html` (Planning Resources — **single-view launcher** (Visa Check split out to its own **🪪 Visas** toolbar tab → `Visas.html` on 2026-06-17): a **⚡ Quick Launch** speed-dial of external booking/reference shortcuts grouped by category — flights, hotels, tours, trains, dining, shows, rental cars, maps, weather, travel guides — each chip an outbound link with a hover tooltip. Internal pages (European Train Guide, Delta route maps) no longer live here — they're in the toolbar (🚆 Trains link, ✈️ Delta dropdown). The earlier 11-tab card layout is retired), `Visas.html` (**🪪 Visas** toolbar tab — standalone page as of 2026-06-17, extracted from Resources at Wifey's direction: US-passport visa rules per guide destination, grouped by entry type — visa-free / free arrival card / ETA / eVisa / visa on arrival / visa required), `Maps/World-Map.html` (**one unified interactive world map** — Leaflet + markercluster, world-atlas TopoJSON country polygons (no tiles), every shipped guide as a pin; the **Region** panel fly-to buttons — World / Europe / N. America / Caribbean / Asia / Africa / S. America / Oceania — re-center the same map in place with no page reload. The toolbar 🗺️ Maps link points here. The 7 former per-region map files (`Europe-Map.html`, `US-Map.html`, `Asia-Map.html`, `Africa-Map.html`, `Caribbean-Map.html`, `Oceania-Map.html`, `South-America-Map.html`) are now redirect stubs → `World-Map.html`; pre-unify originals in `Travel/archive/*-pre-unify-2026-06-20.html`. Ship pins go into the single `PINS` array in `World-Map.html`. Consolidated 2026-06-20), `Plug-Adapter/Plug-Adapter-Guide.html` (World Plug Guide — per-country plug type / voltage / adapter reference), `SIM-Cards.html` (Phone &amp; SIM Abroad — reference page covering eSIM vs local SIM vs carrier plan comparison, eSIM providers (Airalo, Nomad, Holafly, T-Mobile), US carrier international plans (T-Mobile, AT&T, Verizon), tips, and notes by region; reachable from the toolbar **🔌 Plugs dropdown** as a child alongside Plug Adapters; added 2026-06-20), `Before-You-Go.html` (Before You Go — four-section reference page with filter pills: 🚰 Tap Water (safe/unsafe/varies by region), 💉 Health &amp; Vaccines (routine + destination-specific recommendations), 🧳 Baggage Rules (carry-on/checked limits and fees for major airlines), 💳 Cards &amp; ATMs (no-fee cards, best ATM card abroad, cash-by-region notes); reachable from the toolbar **⚙️ Resources dropdown** as a child alongside Quick Launch; added 2026-06-20), `Currency-Guide.html` (World Currency Guide — per-country currency reference; generated by `Brain/scripts/build_currency.py`, enforced by `Brain/scripts/validate_currency.py`), `Climate-Finder.html` (Climate tab — reverse climate search: pick a month + a daytime-high band, lists every destination whose typical high lands in range; reuses the shared baked climate normals via `window.TravelClimate` set by `assets/weather.js` — no second data copy; added 2026-06-14 to the toolbar + `Website-Main-Pages-Links.html`). `Travel-Stats.html` (Stats tab — travel statistics dashboard; added to toolbar before 2026-06-15). `Guide-Days-Coverage.html` (Guide Days Coverage — days-per-guide audit dashboard: summary stat cards, proportional distribution bar, collapsible tier sections, and live city search; every city pill links to its guide; reachable from the toolbar **📊 Stats** dropdown alongside Travel Stats; added 2026-06-20). `US-States.html` (US States — searchable table of all 50 states with region filter pills and superlatives strip; **removed from the toolbar 📊 Stats dropdown 2026-06-20** — still exists as a standalone page at its URL but is no longer toolbar-reachable; superseded in the toolbar by `Stats-Across-US.html`). `Time-Zones.html` (Time Zones tab — live local time for every guide city, auto-refreshing every minute; added 2026-06-19). `Tipping-Guide.html` (Tipping tab — per-country tipping norms for guide destinations, with legend dots that match their anchored chips; reachable from the toolbar). `City-Transit-Cards.html` (City Transit Cards — per-city public-transit fare-card reference; reachable from the toolbar **✈️ Getting There → 🚆 Trains** nested sub-group, added 2026-06-20). `Safety-Guide.html` (Safety tab — US State Dept advisory levels Level 1/2/3 for every guide destination, color-coded with live-filter search and official sources; added 2026-06-15 to the toolbar + `Website-Main-Pages-Links.html`). `Europe-Countries.html` (European Countries — searchable reference table of European countries with capital, population, currency, and language; reachable from the toolbar **📊 Stats** dropdown; added 2026-06-20). `Pickleball.html` (Pickleball Hotspots — searchable list of pickleball courts near guide destinations; reachable from the toolbar **📊 Stats** dropdown; added 2026-06-20). `Asia-Countries.html`, `Caribbean-Islands.html`, `South-America-Countries.html`, `Oceania.html`, `Middle-East-Africa.html` (regional country/island reference tables — siblings of `Europe-Countries.html`, same searchable format: country/island with capital, population, currency/language + links to each destination's city guides; reachable from the toolbar **📊 Stats** dropdown; in `Website-Main-Pages-Links.html`; added 2026-06-20). `Stats-Across-US.html` (**US by the Numbers** — comprehensive ranked statistics page covering all 50 US states + DC and ~25–35 famous/guide cities per category; 16+ categories: Education (bachelor's degree %), Adult Literacy, HS Graduation, Household Income, Minimum Wage, Life Expectancy, Obesity, Uninsured Rate, Homeownership, Median Home Price, Violent Crime, Traffic Fatalities, Commute Time, Unemployment, Poverty Rate, Sunshine by Month (monthly heat-grid), Cost of Living; guide cities linked to their guides with `.city-link` rust styling; live search at top collapses all category tables into one summary result card per place typed; monthly sunshine `.sun-grid` excluded from search; reachable from the toolbar **📊 Stats** dropdown; replaced `US-States.html` in the toolbar 2026-06-20). **Visa Check is now its own toolbar tab/page** (`Visas.html`, **🪪 Visas**) as of 2026-06-17 — owner had it extracted from Resources for findability. The toolbar 🪪 Visas tab links straight to it. It was previously a `data-view="visa"` view inside `Resources.html` reached by a toggle pill; that view and pill were removed when it became standalone (Resources is now single-view ⚡ Quick Launch only). Also `README.md`. *(Climate Finder added to the toolbar 2026-06-14 via the New page added to toolbar cascade)* | owner-managed, Claude edits Trips.html when asked |
| `Travel-Website/assets/toolbar.js` | Navigation toolbar JavaScript. **Permanent home: `Travel-Website/assets/` (the shared-asset folder; moved out of `Guides/` in the 2026-06-13 site reorg) — never move it back into `Guides/` or Travel root.** Exception to the frozen rule: Claude maintains this file. Required by every HTML page via `<div id="toolbar-mount">`. Renders: top nav bar (ITEMS). **This is the STABLE original toolbar — do NOT redesign the desktop look/behaviour without an explicit owner request (a 2026-06-20 redesign attempt was reverted; the desktop toolbar must stay as-is).** The `ITEMS` array is owner-curated; each entry is a plain link `{ href, text }`, a dropdown group `{ group, children:[…] }`, or `null` (a thin separator between groups of links). Desktop = compact 13px chip row (centered, scrolls horizontally if wider than the viewport), click-to-open flyout dropdowns (appended to `<body>`, one open at a time). Mobile = hamburger → flat link list. Current additions to the original set: the **🚆 Trains** dropdown (European Train Guide + City Transit Cards) and **📅 Guide Days Coverage** under the **📊 Stats** dropdown (alongside Travel Stats). No page was dropped — only regrouped. Entry form + full group list in `Brain/Reference/Toolbar.html` § 4), scroll progress bar, prev/next guide arrows (‹ ›) inside `.overview-title`, two fixed scroll buttons (∧ up / ∨ down, right side of viewport, vertically centred — all pages). (The shared footnote is ⛔ retired 2026-06-06 — `FOOTNOTE_RETIRED` guard; see the footnote.js row below.) Claude edits this file when navigation behaviour changes are requested. See `Brain/Reference/Toolbar.html` for mount markup rules; `Brain/Reference/Navigation.html` for full feature spec; `Brain/Reference/Emoji Library.html` (§ Toolbar) for current ITEMS icons — never hardcode toolbar icons in Brain.md. | Claude edits, owner-managed |
| `Travel-Website/assets/footnote.js` | Footnote toolbar JavaScript. **Permanent home: `Travel-Website/assets/`, next to `toolbar.js` — never move it outside (moved out of `Guides/` in the 2026-06-13 reorg).** ⛔ Retired 2026-06-06 (owner) — the footnote toolbar is not used; `toolbar.js` carries a `FOOTNOTE_RETIRED = true` guard and never auto-loads it (validator TB-9/TB-11 enforce). File stays on disk for the re-enable path. When active it injected the sharing link as the last element of `<body>`; `data-no-footnote="1"` suppressed it per page. Edit only this file to change footnote behavior. | Claude references, owner-managed |
| `.nojekyll` | Empty marker file. Tells GitHub Pages not to process the Travel folder as a Jekyll site. Do not delete. | owner-managed |
| `shopping_profile_v2.md` | the owner's shopping profile — preferences and style. **Moved here from `On The Go/Shopping Profile/` on 2026-05-18** so it sits with everything else Cowork-edited. Read before any shopping / product / buying request. | owner-managed, Claude reads |
| `Artifacts/` | Prototype / experimental HTML pages (currently: `guide_index_day_actions_panel.html`, `travel-planner.html`). Not shipped to GitHub Pages. | owner-managed |
| `To Do List/` | `To_Do_List.md` = cross-session task list (owner tasks + Rules for Update + Questions for the owner). `README.md` = index and routing rules for the folder. Claude reads and edits `To_Do_List.md` per the README. | owner-managed |
| `On Demand/` | On-demand research docs — read only when explicitly asked. None ship with the guide. Files: `Weather - On Demand.html`, `Delta - On Demand.html`, `Hotels & Rentals - On Demand.html`, `Car Rentals - On Demand.html`, `_style.css`. Moved from `Brain/CORE RULES/On Demand - Don't Ship in Guide/` 2026-05-28. | Claude reads, owner-managed |
| `Universal Formatting Rules/` | Currently empty. Referenced in `Trip-Essentials/README.md` as part of the "core rules" system. | owner-managed |
| `archive/` | **Sealed vault — the one and only archive for the whole workspace.** Everything "deleted" goes here — never `rm`. No crib ever creates a new `archive/` (or `Archive/`) folder anywhere — not inside `Guides/`, `Brain/`, `Brain/Reference/`, nor nested inside `Travel/archive/` itself. To archive, move the file straight into `Travel/archive/`. brain_check (`check_no_stray_archive_dirs`) fails on any stray archive folder outside the vault. Flat — no subfolders. | the owner controls |

---

## Brain/ — guide-building infrastructure

### Brain/CORE RULES/ — source of truth for every guide rule

Every rule that shapes a guide lives here as a plain **HTML file**. **CORE RULES always beats CLAUDE.md.** When they conflict, the HTML file wins.

To read any CORE RULES file: use the `Read` tool directly on the `.html` file path. No Drive MCP, no doc_id, no decoding needed.

| File | What it governs |
|---|---|
| `Rules for Claude.html` | **Master rules doc.** Session ritual, build discipline, parking surfaces, archive walls, all behavioral rules. Read at session start. |
| `Guide Structure.html` | Overall guide shape, section IDs, section order, the canonical 15-id list (Weekly Closures #1, Tours #2, skip-list #15). Guide directory layout. |
| ~~`Ship Checklist.html`~~ | Moved to `Brain/Reference/` 2026-05-24 — no longer a CORE RULES file |
| `Stops Structure.html` | Stop selection criteria (what to include/exclude), stop block format (§§ 2–3), Train Day entry pattern (§ 3c) |
| `Day Structure.html` | Day shape rules: geographic clustering, stop count, route discipline |
| `Tours.html` | ~~Retired 2026-05-20.~~ In-stop tour box and Guided Tour Stop pattern retired. File moved to `Travel/Retired Rules/Retired_Tours.html`. Tours now live entirely in `Tours - Extra Section.html`. |
| `Tickets.html` | 🎟 ticket-box format: Skip-the-Line link text, venue-site fallback, Attraction Tickets waterfall (US / International / venue-site). |
| `Hotel Banner.html` | Title page: city + hotel + address only. Naming rules. From Hotel banner. |
| `Trip Overview.html` | Overview section: day card format, train day suffix rule, card content |
| `Photos Rules.html` | One photo per stop, licensing rules, photo sourcing |
| `Links.html` | URL rules, Maps anchor format, booking link format |
| `Motion Rule.html` | Transit banners between stops: walk/tram/ride-app format |
| `Icon Order and Format.html` | **Canonical authority** for icon ordering (positions 1–11), per-icon format spec, section-header icon list, char limits per row. Read before using any icon — never guess from memory. |
| `Tours - Extra Section.html` | Tours Extras section (second section, after Weekly Closures): source pool (Viator/GetYourGuide/TripAdvisor + local fallback), 4.5⭐/6-review bar, per-platform minimums (5 Viator / 5 GYG / 5 TripAdvisor — warn below, low-count comment required), entry format (📅 name-link · operator · rating · reviews / 🕐⏳👥 / 📍 / 🚶🚕). NOT the same as `Tours.html` (that's the in-stop tour-box format). |
| `Getting Around - Extra Section.html` | Getting around section: tram subsection locked templates, transit operators |
| `Weekly Closures - Extra Section.html` | Weekly closures section: recurring patterns only, no national holidays |
| `Local Tastes - Extra Section.html` | Local tastes: city-specific only, no country-level clichés |
| `Food Delivery - Extra Section.html` | Food delivery section: platform availability, preference order, delivery rows in Cappuccino, exception approval |
| `Michelin Restaurants - Extra Section.html` | Michelin section: format, booking via own site only |
| `Restaurants Near Hotel - Extra Section.html` | Restaurants near hotel section |
| `Cappuccino - Extra Section.html` | Cappuccino / coffee culture section |
| `Day Trips by Train - Extra Section.html` | Day trips by train: Train/Why/Book via format, negative-finding line |
| `Shows, Performances & Concerts - Extra Section.html` | Shows section: venue own-site links only, no aggregators |
| `Train Stations Near Hotel - Extra Section.html` | Train stations section: walk times, negative-finding line |
| `Pickleball - Extra Section.html` | Pickleball section (the owner plays) |
| `Downtown Restaurants - Extra Section.html` | Historic downtown restaurants section |
| `Claude Inspiration - Extra Section.html` | Claude's inspiration note section |
| `Heads Up - Extra Section.html` | City-specific notes section: construction, closures, quirks per city |
| `Guide Entry Counts.html` | Canonical min/max/exact count reference for every enforced count in the guide system — enforcement type and negative-finding line status. Lives at `Brain/Reference/Guide Entry Counts.html` (moved out of CORE RULES 2026-05-24 → Brain root → `Reference/` folder 2026-05-24). |
| `Skip List - Extra Section.html` | Skip List footnote section — appears last in guide; names venues skipped because already visited; small italic grey, no banner; ships only when the city has a skip list. |
| `Trip-Essentials/Essentials-Pages-Rules.md` | Behaviour of the Trip Essentials pages: which pages carry a search box, how search filters and collapses groups, and the no-results state (title + search box + message only; content, jump-nav, legends, index table, and shared footnote all hide). *(added 2026-05-29)* |

---

### Brain/Reference/Rule Dependencies.html — crib navigation aid (moved 2026-05-14 from CORE RULES → Reference/ 2026-05-24)

Helper file for cribs. When a rule is changed, the crib consults this map to find every other place that references the same icon, threshold, or concept — and updates each referenced location to match. **Direction is one-way: rule changes flow into this map; the map never flows back.** The CORE RULES HTML files are the source of truth. A rule is never modified to match what this map says. Not a rule. Not authoritative. Editable freely as long as it tracks the rules.

---

### Brain/Reference/ — files maintained by Claude after every session

| File | What it is |
|---|---|
| `Brain/Reference/Guide Entry Counts.html` | Canonical count reference — moved from `Brain/CORE RULES/` → `Brain/` root → `Reference/` 2026-05-24 (not a rule, a reference table; read-only banner removed). |
| `Brain/Reference/Rule Dependencies.html` | Crib navigation aid — moved from CORE RULES 2026-05-14, to `Reference/` 2026-05-24. Maps every icon/threshold/concept to every file that references it. |
| `Brain/Reference/Validator Index.html` | Living index of every check in `validate_itinerary.py` and `brain_check.py`, with ✅/❌/⚠️ status. Updated whenever a new check ships, per Rules for Claude.html § 10 item 5. |
| `Brain/Reference/Ship Checklist.html` | Pre-ship gate checklist — every guide build ends with this. Any "no" blocks ship. Moved out of CORE RULES 2026-05-24 (not a rule, a working checklist). Update §8 when sections are added/removed, §10 when new validator scripts are added. |
| `Brain/Reference/Cleanliness Checks.md` | 400 cross-cutting cleanliness rules (Categories A–U; highest number is 406 — rules 149–153 and 403 deleted). Moved from `Brain/Reference/` 2026-05-27. Brain-check runs Category A at session start; validators use the rest. |
| `Brain/Reference/PDF Render Notes.md` | **Critical.** Full WeasyPrint PDF render guide: install commands, CSS override block, emoji font setup, staging directory, all 5 notes. Moved from `Brain/Reference/` 2026-05-27. Read before every in-Cowork PDF render. |
| `Brain/Reference/Platforms.md` | Booking platform rules: which platforms are allowed, which are banned, direct-link requirements. Moved from `Brain/Reference/` 2026-05-27. |
| `Brain/Reference/Separation Map.md` | Locator table: which CORE RULES file owns which rule. Use this to know where to look when a rule question comes up. Moved from `Brain/Reference/` 2026-05-27. |
| `Brain/Reference/Change Cascade.html` | Reference map of what to update when a rule, format, or structure changes — which files cascade from which decisions. |
| `Brain/Reference/Toolbar.html` | Shared navigation bar spec — mount div markup, data-depth (folder levels from Travel/), data-maxwidth (760 Trip Essentials / 940 Guides), how to add pages to the menu (edit toolbar.js ITEMS only). Lives in Reference (not CORE RULES). *(moved to Reference 2026-05-29)* |
| `Brain/Reference/Navigation.html` | Navigation rules — shared footnote, prev/next arrow navigation, scroll progress bar, scroll button. Moved out of CORE RULES → `Brain/Reference/` 2026-05-29. |
| `Brain/Reference/Colors and Font Size.html` | Color and font size reference for guides and travel documents — hex values, swatches, and type scale for guide CSS. |
| `Brain/Reference/Mobile Page Visualizer.html` | Mobile page visualizer (renamed from `Preview.html` 2026-06-12) — renders any guide/page side-by-side in desktop and mobile (393px) frames for visual review. Auto-loads the plug page on open; override with `?path=Trip-Essentials/...`. Not referenced by any script or CORE RULES file; a working/preview surface. |
| `Brain/Reference/format_version.json` | **Guide format version** (added 2026-06-12). `{fingerprint, date}` over all CORE RULES files except `Rules for Claude.html` (behavioral, not format). Written by `update_core_rules_checksums.py`; the date advances only when the format fingerprint changes. Feeds the staleness ledger. Never hand-edited. |
| `Brain/Reference/guide_staleness.json` | **Staleness ledger** (added 2026-06-12). Maps each guide (by city folder) to the format fingerprint it was built under. Updated automatically on `guide_tools.py ship`; read by `guide_tools.py staleness`. A guide whose fingerprint ≠ current = stale (built before a later format change). Never hand-edited. |
| `Guides/{City}/ship_log.md` | **Per-ship PASS/FAIL log** (Rule 125). One file per city guide — appended by `guide_tools.py ship` on every ship, never overwritten. Format: `YYYY-MM-DD HH:MM — guide.html — PASS|FAIL — N checks`. Never hand-edited. Switched from a single `Brain/Reference/ship_log.md` to per-guide files 2026-06-15; old global log archived. |
| `Brain/Reference/profile_watermark.json` | **CLAUDE.md snapshot** (Rule 49). Written by `brain_check.py` — stores `{line_count, section_count}` of `CLAUDE.md` to detect unexplained drops. Never hand-edited. Moved from `Brain/` root to `Brain/Reference/` 2026-06-15. |
| `Brain/Reference/verify_cache.json` | **URL verification cache**. Written by `verify_urls.py` — stores `{final_url, status, timestamp}` per verified URL so re-runs skip unchanged URLs. Never hand-edited. Moved from `Brain/` root to `Brain/Reference/` 2026-06-15. |
| ~~`Brain/Section Snippets.html`~~ | **Archived 2026-05-24** to `Travel/archive/`. Permanently banned — snippet files cause format drift when rules change. Read CORE RULES directly. `brain_check.py` hard-fails if any snippet/scaffold/template file is recreated under Brain/. |

---

### Brain/Reference/ — Claude's combined reference folder

No new files without the owner's explicit permission. As of **2026-06-15** the three former `Brain/mds/` files (`Brain.md`, `audit_log.md`, `Status Dots — guides_index.md`) were merged into `Brain/Reference/` — the mds folder is retired. As of the **2026-06-05 merge** the four former standalone mds files (`travel_map.md`, `decisions.md`, `Heads Up.md`, `Cities Skip List.md`) are combined into this single `Brain.md` (Parts 1–4); originals archived to `Travel/archive/`. (`PDF Render Notes.md`, `Cleanliness Checks.md`, `Platforms.md`, `Separation Map.md` moved into Reference 2026-05-27.)

| File | What it is |
|---|---|
| `Brain.md` | **This file** — the combined master. Part 1 Travel Folder Map · Part 2 Decisions (judgment-call log, append new entries at the top of Part 2) · Part 3 Heads Up (per-city; feeds T6 ship gate — validator slices the BRAIN:HEADS-UP region) · Part 4 Cities Skip List (validator slices the BRAIN:SKIP-LIST region). Read at session start. Append Heads Up / Skip List cities **inside** their sentinel regions. |
| `audit_log.md` | Rolling audit log. Updated after every guide build and audit pass. brain_check gates on staleness. Kept separate — nothing else is combined with it. |
| `Status Dots — guides_index.md` | Source-of-truth checklist for the been/want-to-go dot markers on `Guides-Index.html`. Moved to Reference 2026-06-15. |

---

### Brain/scripts/doc_workshop_*.py — CORE RULES formatting validators (moved 2026-05-13 from Brain/CORE RULES/script/)

Two scripts that validate and repair the CORE RULES HTML files themselves. Run directly with `python3` — not through `guide_tools.py`.

| Script | What it does | When to run |
|---|---|---|
| `doc_workshop_validator.py` | Validates all CORE RULES HTML files against the canonical formatting rules (banner, h1, § headings, CSS, legacy class detection). Reports E-errors and W-warnings. | After any CORE RULES edit or formatting audit |
| `doc_workshop_fixer.py` | Rewrites non-conforming CORE RULES HTML files to the canonical shell: injects canonical CSS, fixes banner text, preserves body content. Run only on files the validator flags. **Never run blind.** | After validator identifies drift; confirm which files before running |

Source of truth for what "canonical" means: `Brain/Reference/Core Rules Formatting.html` § 1.

---

### Brain/scripts/ — validators and tools

All validators are accessed through `guide_tools.py` (single entry point). Run from the Travel root.

| Script | What it does | When to run |
|---|---|---|
| `guide_tools.py` | **Single entry point** for all validators. Commands: `start`, `brain-check`, `sweep-stray`, `validate`, `verify`, `verify-booking`, `photo`, `ship`, `pdf`, `validate-pdf`, `audit` | Always use this instead of calling scripts directly |
| `brain_check.py` | Session-start integrity check: required files exist, CLAUDE.md has required sections, no ghost references, audit log not stale. Run at every session start. | Session start + after any Brain edit |
| `validate_itinerary.py` | Full guide validator: 800+ check cleanliness sweep (per-run subset depends on which extra sections a guide ships), tour-first evidence, all ship gates | Before every ship |
| `autofix_itinerary.py` | Mechanically rewrites mis-filed booking boxes and common format drift | Before validate, when drift is detected |
| `verify_urls.py` | Checks all URLs in a guide are live and not redirecting | Before ship |
| `verify_booking_links.py` | Ship gate: booking link coverage + h1-match | Before ship |
| `audit_all_guides.py` | Sweep-all-guides audit helper — runs validators across every shipped guide and summarizes. | On demand during audit |
| `core_rules_checksums.json` | SHA-256 hashes for every CORE RULES file — feeds the CORE RULES integrity check in `validate_itinerary.py`. Regenerated by `update_core_rules_checksums.py`. | Never edited by hand |
| `update_core_rules_checksums.py` | Regenerates `core_rules_checksums.json` after an approved CORE RULES edit. | After approved a CORE RULES change |
| `render_pdf.py` | PDF render using headless Chromium (500px mobile viewport). **Does not run inside Cowork** — use from a normal terminal. For in-Cowork rendering, use WeasyPrint (see `Brain/Reference/PDF Render Notes.md`). | On demand |
| `validate_pdf.py` | PDF integrity check: page breaks, image loads, layout | After render |
| `sweep_stray_travel.py` | Enforces file location rule: Cowork files live in `Travel/`, mobile surface files in `Travel/On The Go/`. Catches stray files outside their designated root. | Session start + after file moves |
| `commons_photo.py` | Wikimedia Commons photo sourcing helper | During guide build |
| `build_search_index.py` | Builds `Travel-Website/assets/search_index.json` — full-text content index across all guides (stops, venues, tours, sections) powering the global content search on the guides_index search box. Reads guide HTML only to index it. **Runs automatically as the last step of every `guide_tools.py ship`** (best-effort — never blocks a ship). Only run by hand after editing a guide *without* a ship. | Auto on ship; manual after a non-ship guide edit |
| `validate_search_index.py` | Checks `assets/search_index.json` coverage: every guide HTML on disk is indexed, every index entry points to a real file, and the `generated` date is not stale (warns if >7 days old). Exit 0 = clean; exit 1 = missing/ghost/stale (fix: rerun `build_search_index.py`). No network. | After any guide ship or spot check |
| `validate_climate_coverage.py` | Checks `assets/climate.json` and the baked CLIMATE block in `assets/weather.js`: every map-pinned guide city is covered, no error flags from failed API fetches, weather.js baked block matches climate.json city-for-city, all hi[]/lo[] arrays are complete (12 non-None values). Exit 0 = clean; exit 1 = gaps found (fix: rerun `build_climate.py`). No network. | After new guide cities are added to maps |
| `validate_safety_guide.py` | Checks `Trip-Essentials/Safety-Guide.html` coverage against guides_index: every guide city has exactly one Safety Guide row, no duplicates across level sections, no stale rows for removed guides, all city-row hrefs resolve to real files. Safety Guide is hardcoded — must be manually updated when guides are added/removed/renamed or advisory levels change. Exit 0 = clean; exit 1 = drift. | After any guide added/removed/renamed, or advisory level change |
| `validate_travel_stats.py` | Checks that `Trip-Essentials/Travel-Stats.html` matches live guides_index data: hero counts (total/been/want/regions), split bar %, bucket list order, frontier chip visited/not-visited status, all guide links resolve. Exit 0 = clean; exit 1 = drift detected (fix: rerun `build_travel_stats.py`). No network. | After any been/want status change without a ship |
| `validate_guides_index_inline.py` | **Manual-only.** Checks that every dest-card in `Guides-Index.html` has an entry in all three inline JS data blocks used by the index page: `CLIMATE_INLINE` (monthly hi/lo temps for the weather filter), `COST_DATA` (cost tier + currency for compare/filter), and `SAFETY_DATA` (safety level for compare/filter). Applies the same key-resolution logic as the JS (`climateKey()` → folder name from href, fallback to display name). Exit 0 = all blocks cover all cards; exit 1 = one or more cards missing from at least one block. Never runs on ship — run on demand after editing the inline data blocks in `Guides-Index.html`. | Manual only — on demand |
| `build_travel_stats.py` | Regenerates `Travel-Website/Trip-Essentials/Travel-Stats.html` from `Guides-Index.html` live data: FMAP block (flight times, regions, routing) + dest-card markup (been vs want status). Updates hero counts, split bar, flight stats, region breakdowns, bucket list, and New Frontiers chips. **Runs automatically as the last step of every `guide_tools.py ship`** (best-effort — never blocks a ship). Run manually after any been/want status change on guides_index without a full ship. | Auto on ship; manual after been/want status change |
| `build_climate.py` | Regenerates `Travel-Website/assets/climate.json` and updates the baked `CLIMATE` data block in both `assets/weather.js` and `Trip-Essentials/Trips.html`. Sources historical daily high/low data from Open-Meteo Historical Weather API (no key needed) for every guide city. Resumable: caches raw API responses in `/tmp/climate_raw.json` so a re-run only fetches cities that errored or are new. **Manual-only — never runs on ship** (makes API calls; a full run takes 2+ min; incremental run only fetches new cities). Run when: (a) new guide cities are added to the maps, or (b) data window needs refreshing. Pre-seed the cache from `climate.json` to limit fetches to new cities only. | Manual only — after new cities added to maps |

### Brain/Reference/Guide Style.css

Shared stylesheet for all guides. **Source of truth.** Referenced by every guide HTML file as `../../assets/guide_v3.css` (guides sit at `Travel-Website/Guides/{City}/`, two levels below the site root — never `../../Brain/Reference/Guide Style.css`, which breaks on GitHub Pages). The deployed copy lives at `Travel-Website/assets/guide_v3.css` — whenever Brain/Reference/Guide Style.css is updated, run `guide_tools.py sync-css` to copy it across. Contains the full mobile-first layout, color system, section styling, and `@media print` rules. **Never edit without understanding the WeasyPrint override implications** (see `Brain/Reference/PDF Render Notes.md`).

### Brain/tests/ — retired

Folder no longer exists on disk (last documented empty 2026-05-11; gone by 2026-05-14). Was never referenced by any script or CORE RULES file. No action needed unless a real test suite gets added in the future, at which point a new folder can be created.

---

## Travel/On The Go/

Moved under `Travel/` on 2026-05-19. Only `Rules/` remains — Shopping Profile and To do list were removed on 2026-05-18.

- **Travel/On The Go/Rules/** — Active file: `on_the_go_rules_v27.md`. Archive subfolder holds v5–v26. Claude reads v27 at mobile session start; never edits without being asked.

When the user asks for the to-do list, read `Travel/To Do List/To_Do_List.md` — no second source to merge.

---

## What Claude owns vs what owner-managed

**Claude writes and maintains:**
- `CLAUDE.md`, `Brain/Reference/*`, `Brain/scripts/*`
- Individual guide files inside `Guides/{City}/` (during active builds only)

**owner-managed — Claude reads, edits only when explicitly asked:**
- `Guides/` (frozen after ship), `Trip-Essentials/`, `Hotel Research/`, `To Do List/To_Do_List.md`
- `Icons Library/`
- Everything in `archive/` (sealed vault — never move anything in without explicit per-file permission)
- `Brain/CORE RULES/*.html` (apply rule changes only when approved a 🔧 Rules for Update proposal)

---

## Key rules to remember

- **Connected first.** Before anything else each session, confirm the Drive is mounted (Read `Travel/CLAUDE.md`). If it's unreachable, STOP and ask in one line to connect it — don't start, don't build, don't create files. The one blocker that always pauses for a one-line ask. Full rule: `Rules for Claude.html § 1` Step 0.
- **CORE RULES always wins.** If CLAUDE.md and a CORE RULES file disagree, the HTML file wins. No exception.
- **Guides/ is frozen.** Never read, grep, or reference guide files unless when asked.
- **archive/ is the single vault.** Never rm anything — archive to `Travel/archive/` and move on. No crib ever creates a new `archive/`/`Archive/` folder anywhere (not in Guides/, Brain/, Brain/Reference/, or nested in the vault). brain_check fails on any stray archive folder outside `Travel/archive/`.
- **Never archive an incomplete build.** A guide folder with a `_build/build_state.md` (Phase 6 unchecked, or no HTML yet) is resumable — never archive, remove, or "clean it up," even if it looks empty. A stalled crib is finished by another crib. `guide_tools.py start` flags these as "maybe in progress — check later"; that flag is the only action. Full rule: `Rules for Claude.html § 2`.
- **Edit existing files in place — never create a new file to change one.** To change any file that already exists, use the Edit/Write tool on its mounted path. NEVER use Drive MCP `create_file`/upload to modify an existing file — it spawns a `Name (1).ext` duplicate and the edit is lost. Never stage content in an `outputs/` scratchpad and include it. A `Name (1)` sibling appearing = a failed in-place edit: archive the stub, redo on the original. Full rule: `Rules for Claude.html § 2` (Right tool for the right job).
- **brain_check must pass 0 failures** before starting any guide build. Run it. Fix it. Then build.
- **WeasyPrint notes are critical.** Before any in-Cowork PDF render, read `Brain/Reference/PDF Render Notes.md` in full.
- **Heads Up and Cities Skip List are yours.** You write and maintain them as you research cities.

---

*Updated by Claude: 2026-06-06 (brain audit) — Added `european train guide.html` (Travel root, was undocumented; flagged for relocation) to the root table and `Status Dots — guides_index.md` (Brain/Reference/, undocumented, no approval record — flagged for owner to bless or relocate) to the mds table. Bumped "Last updated" to 2026-06-06.*

*Updated by Claude: 2026-06-05 (mds audit) — Added `Brain/Reference/Preview.html` (guide preview utility, was undocumented) and the `Brain/Reference/archive/` subfolder (3 snapshot files; flagged as a deviation from the single flat `Travel/archive/` vault rule) to the Reference table. Bumped "Last updated" to 2026-06-05.*

*Updated by Claude: 2026-05-18 (deep audit pass) — (1) Bumped "Last updated" to 2026-05-18. (2) Added new "Brain/ root — other helper HTML files" section documenting `Guide Entry Counts.html` (CORE RULES is canonical; Brain root duplicate archived 2026-05-18), `Section Snippets.html` (copy-paste-ready HTML for error-prone sections), and `Validator Index.html` (living index of validator checks — was previously undocumented in the map). (3) Added three previously-undocumented scripts to the validators/tools table: `audit_all_guides.py`, `core_rules_checksums.json`, `update_core_rules_checksums.py`. (4) Archived 5 stale `validate_itinerary.py.*_bak` files + `.DS_Store` + `__pycache__/` from `Brain/scripts/` to `Travel/archive/`. (5) Stale references to `_DO_NOT_ARCHIVE.md` and `On Demand/_README.md` in the audit-history block below are noted but preserved — those files were retired and the references reflect the state at the time of the entry.*

*Updated by Claude: 2026-05-15 (deep audit pass) — (1) Named `shopping_profile_v2.md` in Shopping Profile entry (was vague). (2) Added two flight playlist gdocs to On The Go/ root (were completely undocumented). (3) Expanded Icons Library entry to name utility files (`icon_resources.md`, `_PREVIEW_all_icons.html`, `icon_picker_transport.html`) and source pack folders. (4) Corrected CLAUDE.md description — was overstated (claimed to contain DriftyCat, session ritual, rendering notes); corrected to reflect its actual role as a lean pointer/quick-reference file.*

*Updated by Claude: 2026-05-15 (audit pass) — (1) Added `On Demand/_style.css` to On Demand folder entry (exists on disk, was undocumented). (2) Added `README.md` to `To Do List/` entry (exists on disk, was undocumented). (3) Expanded `Trip-Essentials/` to list actual files on disk — `Bend_Rentals.docx` surfaced as possibly misfiled (flag for the owner). (4) On The Go/ contents unverifiable from Cowork bash environment this session.*

*Updated by Claude: 2026-05-15 — (1) Added `Icon Order and Format.html` to CORE RULES table (was missing — it's the canonical authority for every icon, but wasn't listed). (2) Added `Tickets.html` to CORE RULES table (existed on disk, referenced in Rules Dependency Map, not documented here). (3) Added `Ship Checklist.html` to CORE RULES table (referenced in DriftyCat, not documented here). (4) Fixed `Trips/` entry: live tracker filename was `Data.html` in the map — actual file on disk is `Trips.html`, consistent with Core Rules § 4. (5) Fixed stale footer inside `Rule Dependencies.html` — still said `Brain/CORE RULES/`; corrected to `Brain/` (moved 2026-05-14).*

*Updated by Claude: 2026-05-12 — (1) Updated `Guides/` entry to document `Guides-Index.html` (master guide index, update on every ship) and `Guide Style.css` (copy of Brain CSS for GitHub Pages). (2) Updated `Brain/Reference/Guide Style.css` section to note correct per-guide CSS path (`../guide_v2.css`), the wrong path that breaks GitHub Pages (`../../Brain/Reference/Guide Style.css`), and the sync requirement. (3) Fixed `lisbon_v3.html` CSS path from broken `../../Brain/Reference/Guide Style.css` to `../guide_v2.css`. (4) Synced `Guides/guide_v2.css` from updated `Brain/Reference/Guide Style.css`.*

*Updated by Claude: 2026-05-24 (MD audit) — Updated `On The Go/Rules/` entry: active file is now `on_the_go_rules_v27.md`; archive holds v5–v26 (v11–v26 were in active folder, archived today). Marrakech guide uses `index.html` filename (inconsistent with other guides — logged as ❓ for the owner).*

*Updated by Claude: 2026-05-11 — (1) Added `Brain/CORE RULES/script/` section. (2) Added `Heads Up - Extra Section.html` to CORE RULES table (was in folder but missing from map). (3) Added `Brain/Reference/decisions.md` section (new file, rule 128 additive). (4) Added `_DO_NOT_ARCHIVE.md` and `On Demand/_README.md` to CORE RULES table (both existed on disk, neither was documented). (5) Updated `On The Go/Rules/` description — active file is `on_the_go_rules_v11.md` (created 2026-05-11); v5–v10 in archive/.*

---

# ═══════════════════════════════════════════════
# PART 2 — DECISIONS (Non-trivial Judgment Calls)
# ═══════════════════════════════════════════════

# Decisions — Non-trivial Judgment Calls (Part 2 of Brain.md)

> Required by cleanliness_checks.md rule 128. Records every significant trade-off, ban, demotion, or retirement — date, what was decided, why, and what replaced the old approach. Prevents re-litigating settled calls.
>
> **This is Part 2 of Brain.md — there is no standalone `decisions.md`.** Creating a separate `decisions.md` file (or any of the other merged files) is **prohibited** and hard-fails brain_check (`check_no_resurrected_merged_mds`). Append every new decision *here*, at the top of this Part.
>
> **Append new entries at the top.** One entry per decision. Format: `## YYYY-MM-DD — Title`.

---

## 2026-06-17 — Toolbar nav rework: split link+caret items, Visas its own page, fewer top-level slots

**Decision (owner):** the toolbar ran past the banner with ~13 top-level items, and adding a Visas tab would worsen it. Resolved by grouping less-used pages under their natural parents and giving the two most-used pages a one-click label with a caret submenu. **New `toolbar.js` ITEMS shape** (`v=27`, cache-busted): **📆 Trips** and **🌐 Guides** are now **dropdown groups** — the SAME proven `{ group, children }` pattern as Lounges/Delta/Weather (clicking the tab opens a flyout). Their flyout lists the page itself as the first item, then its sub-views: Trips → 📆 Trips · 👕 Packing; Guides → 🌐 Guides · 🗺️ Maps · 📊 Stats. (Maps/Stats/Packing left the top row for these flyouts.) *(Implementation note: a custom "split link+caret" one-click variant was tried first but proved unreliable across browsers; reverted to the standard group dropdown at Wifey's direction — "do like lounges and flight.")* Item count 13 → 11 slots; per-item padding trimmed 9→8px and row gap 2→1px so it sits inside the 940px banner. **Visas extracted:** the Visa Check, formerly a `data-view="visa"` view + toggle pill inside `Resources.html`, is now its own standalone page `Trip-Essentials/Visas.html` (🪪 Visas toolbar tab); Resources is single-view ⚡ Quick Launch only (view pills + visa view removed). **Cascade worked same pass:** `Website-Main-Pages-Links.html` (Visas row added), Brain.md Part 1 (Visas.html documented, Resources/toolbar rows updated), `Toolbar.html` § 4 (split link+caret entry form + Visas split-out), `Emoji Library.html` (ITEMS order, splits, flyout sub-items, Visas tab, Resources/Visas separation rows); Navigation.html needed no change (it doesn't enumerate toolbar items); no script/validator hardcodes the ITEMS list (brain_check reads it dynamically — 0 fail). Also unified the guides_index flight-time + region taxonomies to one set (North America · South America · Europe · Asia · Oceania · Caribbean · Middle East · Africa) and recolored the 2-connection routing 🟡→🔵 bright blue. *(Open follow-up: the per-leg flight-time breakdown is parked in the To Do List.)*

## 2026-06-17 — Tram is BINARY: real rides or "No tram found in [City]." (revises the same-day omit-entirely call)

**Decision (owner).** A tram is always researched, then it's strictly binary — no lazy middle state. EITHER the city has a usable tram → ship the positive entry naming the line(s) actually ridden (`[City] has a tram system — operated by [Operator]. Line(s) used on this trip: [N].`), OR there is no tram → ship exactly **"No tram found in [City]."** (the only accepted negative line, matching the rest of the guide's negative findings). **Why:** cribs were finding the tram and then escaping with "No tram rides on this trip" — acknowledging the tram but planning nothing. Removing every escape hatch forces a crib that finds a tram to plan a real ride. This revises the earlier same-day call (which removed the negative line and omitted the subsection entirely); the negative line is back, but as the guide-standard "No tram found in [City]." form. **Banned (all hard-fail):** "No tram rides on this trip", "No tram available in [City]", "[City] does not have a tram system…", and "Line(s) used on this trip: none/0/—". **Cascade:** `Getting Around - Extra Section.html` §2a/§2b rewritten (checksums regenerated → fp e8cd810f93d499f5, doc_workshop_validator 26 clean / 0 errors); `validate_itinerary.py` — the TRAM NEGATIVE-LINE-IS-DRIFT check became TRAM BINARY (bans the escape wordings + "Line(s) used: none"), TEMPLATE ADHERENCE now accepts the positive entry or "No tram found in [City]." only ("No tram rides on this trip" retired), tram-negative detector recognises the new line; `Validator Index.html` updated. EXPECTED to fail until fixed: guides shipping "No tram rides on this trip" (e.g. Lisbon, Milan) or a stale "No tram available" line.

## 2026-06-17 — Heads Up entry icon RESTORED to every entry (reverses 2026-05-19 removal)

**Decision (owner).** Every Heads Up entry heading carries the leading `❗️` again — format is `❗️ [Venue] — [Short Title]`. This reverses the 2026-05-19 call ("❗️ removed from entries; section title carries the icon") — owner: the rule is right to show the icon, so put it back and enforce it. The icon stays U+2757+U+FE0F (the global bare-❗ ban already forces +VS16). **Why:** `Heads Up - Extra Section.html` §2 always showed `❗️ [Venue] — [Short Title]`; the 2026-05-19 removal updated the validator + guides + `Icon Order and Format.html` but left §2 showing the icon — a long-standing rule-vs-build drift. Resolving it in favour of the icon (per owner) makes §2 authoritative. **Cascade:** `Icon Order and Format.html` entry row updated to show `❗️ [Venue] — [Short Title]` (checksums regenerated → fp 41cc68be994d277d, doc_workshop_validator 26 clean / 0 errors); `validate_itinerary.py` flipped from "no leading ❗️ on entries" to REQUIRE the leading ❗️ (heads-up icon allowlist + entry parser strips it before the venue/short-title checks); `Validator Index.html` updated; every guide with a Heads Up section had `❗️ ` prepended to each entry heading.

## 2026-06-15 — Maps rebuilt on Leaflet (Europe + US live); toolbar Weather-tab icon differentiated

**Decision (1) — region maps on Leaflet.** owner flagged the region maps work poorly on desktop + mobile. Root cause: they were a hand-rolled D3/SVG engine with custom touch handlers fighting a custom zoom, a full re-render on every resize (so mobile address-bar show/hide thrashed), a label engine that dropped labels in dense clusters, and CDN-only data. Rebuilt on **Leaflet 1.9.4 + Leaflet.markercluster**, GeoJSON-only (country/state polygons from the same world-atlas/us-atlas TopoJSON, **no tile layer** — keeps the warm look), native pinch/pan, clustering for dense pins. Europe + US (North America) are migrated and live; the other five (Caribbean, Asia, Africa, South America, Oceania) still run the old engine pending the same swap. **Antimeridian guard:** Russia (Europe) and Alaska's Aleutians (US) cross 180° and Mercator smears them into a horizontal band — fixed by clamping wrapped vertices (Russia → 60°E; Alaska → −169°). Oceania (Fiji/NZ) will need the same. US uses Mainland/Alaska/Hawaii **zoom pills** because Mercator can't inset AK/HI the way the old AlbersUsa projection did. Also fixed for both: panel anchored top-left so it no longer bobs on zoom-pill selection, uniform pill width, click focus-ring removed, and `body { padding-bottom: 0 }` so the map fills to the page bottom (the shared `_travel_style.css` sets `padding-bottom:80px` for scrolling pages, which left a dead strip under the full-height map). Bake all of these into the remaining five at migration.

**Decision (2) — toolbar Weather-tab icon.** owner: `🌡️ Climate` and `🌡 Weather` "have the same icon" and it's confusing. They're two *distinct* tools and both stay (owner was explicit: don't merge or remove — "different idea and purpose"): **🌡️ Climate** = Climate Finder (reverse climate search: month + high-band → matching destinations); **🌤️ Weather** = the per-city monthly-climate widget that lives on the Guides index (city picker + monthly high/low). The only change: the Weather tab's icon went 🌡 → **🌤️** so it no longer duplicates Climate's thermometer. (Mid-session I wrongly merged then removed the Weather tab; reverted — both tabs are intact, only the icon differs.) **On bar width** (owner also asked why the bar runs wider than the page): the row is intentionally `width:max-content` + centered, with the width-cap deliberately removed (capping broke centering twice; `brain_check check_toolbar_centering` enforces it) — so the only sanctioned lever to narrow it is fewer top-level slots via grouping (the Lounges/Delta pattern). Left open for owner to choose how far to take it. Cache busted site-wide: `toolbar.js?v=14` → `?v=15` across all pages. Cascade: Emoji Library.html (§ Toolbar icons — 🌡️ Climate + 🌤️ Weather), Toolbar.html § 4, Brain.md Part 1 unchanged (both tabs already documented).

---

## 2026-06-15 — Resources rebuilt as a launcher; train guide + Delta maps promoted to a toolbar 🚆 dropdown

**Decision:** Resolved the "buried guide" problem owner raised — the European Train Guide (and the two Delta route maps) were sitting as internal cards inside `Resources.html`, mixed among 62 external booking links, because they'd been demoted from the toolbar 2026-06-14 to shorten the bar. Two coordinated moves: **(1)** Added a **dropdown group** entry form to `toolbar.js` ITEMS — `{ group, children:[…] }` renders one button whose flyout (appended to `<body>` and fixed-positioned, so it escapes the scroll row's `overflow-x:auto` clip — the first version nested the menu inside the row and it was clipped/unclickable) lists its child links. **Final shape after iterating with owner:** two groups — **💻 Lounges** (US + EU, collapsing two former separate items into one slot) and **✈️ Delta** (Seattle Hub + Full Network, using the slot Lounges freed, so the bar doesn't grow) — plus **🚆 Trains** as a plain direct link to the European Train Guide (no menu; Delta under a train icon was wrong, so Delta got its own group). Children are gated by the existing brain_check toolbar regex (`href: base + '…'` matches children too); the centering invariant is untouched. **(2)** Rebuilt `Resources.html` from an 11-tab card layout into a **two-view page**: ⚡ Quick Launch (a single-screen speed-dial of the external shortcuts as compact chips grouped by category, each with a hover tooltip carrying the old card description) + 🪪 Visa Check (the existing rich panel, kept — it's real content, not a shortcut). All three internal cards removed from Resources. **Rationale:** owner said the external links are "the least interesting — just a shortcut," so they get shortcut-sized real estate; the owned guides get a first-class nav home. **Kept (judgment call):** the external Maps and Weather shortcut groups stay in Quick Launch — in the compact launcher they cost nothing and are distinct from the internal 🗺️ Maps / 🌡️ Climate pages, so dropping them would only remove function. Cascade worked same pass: Toolbar.html § 4 (new entry form + 🚆 group callout), Brain.md Part 1 (toolbar.js + Trip Essentials rows), Main Pages parity already held (all three pages were already listed there). **Replaces:** the 2026-06-14 "demote train guide + Delta into Resources" decision.

## 2026-06-15 — 🌤️ Weather dropdown + standalone By-City page; climate ship gate (3rd new gate)

**Final state (supersedes the icon-only note in the maps entry above).** The toolbar `🌤️ Weather` item is a **dropdown group** (Lounges/Delta pattern, all three labels carry the 🌤️ icon) with two options: **By Climate** → `Climate-Finder.html` (reverse climate search) and **By City** → `Trip-Essentials/Weather.html` (new full page). The By-City page reproduces the old Guides-index weather widget (city picker, big high/low, clickable 12-month bar chart, month buttons, °C/°F) as a standalone page — same behaviour, not a reinvention — reading the shared baked normals via `window.TravelClimate` (no fetch, so it works on `file://` too; same approach as Climate Finder). Built after several wrong turns owner corrected: do not merge/remove the tabs, do not invent a different by-city UI, do not link to the Guides index — use the existing widget in a full page.

**New ship gate — `_check_guide_in_climate()` (3rd gate added 2026-06-15, after Status Dots + FMAP).** Both Weather tabs read `window.TravelClimate`, baked into `assets/weather.js` from `assets/climate.json`. A guide that ships without climate normals is invisible in BOTH tabs. The gate hard-fails at ship time if the city folder name is absent from **either** `climate.json` or the `weather.js` baked `CLIMATE` block — placed in the same post-ship single pass as the index card / map pin / status-dots / FMAP, right before the mobile gate. Fix path: add the map pin → `build_climate.py` (reads the pins) → `validate_climate_coverage.py`. Verified: Naples + Lake Como pass, Budapest (an unfinished build, no shipped HTML) hard-fails. Cascade worked same pass: `guide_tools.py` (function + wiring), `Validator Index.html`, `Ship Checklist.html` §10 chain + §11 post-ship step, `Change Cascade.html` (New guide built), `CLAUDE.md` (DriftyCat + ship-chain summary). Coverage audit at build: all 133 shipped/map-pinned guides already present in both tabs; the only 4 absent (Bali, Budapest, Istanbul, Montevideo) are unfinished builds, correctly excluded.

**Three more data-page ship gates same pass (owner: "added to the stats and safety… currency if new country").** A finished guide must also land in Stats, Safety, and (for a new country) Currency — all now hard-gated in `guide_tools.py ship`, in the same post-ship pass as index/pin/dots/FMAP/climate. **📊 Stats** (`Travel-Stats.html`) is auto-generated, so the gate rebuilds it (`build_travel_stats.py`) then hard-validates (`validate_travel_stats.py`) — promoted from the old best-effort post-ship step. **🛡️ Safety** (`Safety-Guide.html`, hardcoded/manual) uses `validate_safety_guide.py` as a hard gate (every index city needs one row). **💰 Currency** (`Currency-Guide.html`, per-country) uses a new **scoped** check `_check_guide_in_currency` — verifies only the *shipping* guide's city maps to a country in `build_currency.py`'s COUNTRIES, deliberately NOT the whole-index `validate_currency` (which currently fails on an unrelated stale date-pill and a pre-existing Madeira/Funchal name mismatch — using the full validator would block every ship). New country → add to COUNTRIES + run `build_currency.py`. Verified: Naples passes all; Budapest (unfinished) blocks on currency; safety + (post-rebuild) stats pass. Two pre-existing issues surfaced and left for owner: the Currency date-pill failure, and the Madeira(index)/Funchal(currency) naming mismatch.

---

## 2026-06-15 — Two new ship-gate checks: Status Dots presence + FMAP entry

**Decision:** Added `_check_guide_in_status_dots()` and `_check_guide_fmap()` to the `guide_tools.py ship` gate (after the existing pin check), both hard-fail. **Status Dots check:** verifies the city folder name appears on any bullet line in `Brain/Reference/Status Dots — guides_index.md` — catches a guide shipped without ever being added to the dot tracker (the "never added" gap; complementary to `brain_check.check_status_dots_stalled_builds` which catches "in stalled list but shipped"). **FMAP check:** verifies the city folder name appears among the keys of the `var FMAP` block in `Guides-Index.html` — catches a guide shipped without a flight-time view entry. `validate_flight_index.py` already enforces bi-directional FMAP↔card coverage at audit time; this gate fires earlier at ship time. Both verified: Amsterdam passes; FakeCity hard-fails with actionable error messages. Cleanliness Checks.md #415 and #416 added. Validator Index.html ship gate section added. **Why:** Dot status and FMAP presence were the two remaining ship-time gaps after the 2026-06-02 indexed check and pin check were added.

## 2026-06-15 — Ljubljana v1: Google Maps IS readable via the "Directions" DOM node; ticket-box requires a rated product; Michelin negative line

**Decision (1) — Google Maps motion times, working method.** Google Maps directions ARE readable in-sandbox via Chrome MCP `javascript_tool`, despite the page never reaching `document_idle` (so `get_page_text` times out). Method: navigate to `https://www.google.com/maps/dir/?api=1&origin=LAT,LNG&destination=…&travelmode=walking|driving`, then run JS that finds the leaf element whose text matches `^\d+ min$` **and whose closest `[aria-label]` ancestor equals `"Directions"`** — that node is the *active-mode recommended route*. Innertext-first-match is unreliable (Maps lists alternates and stale cross-mode cards first); the `aria-label="Directions"` filter pins the selected route. Worked for all 10 stop legs + every extras venue. This is a more faithful reading of `Motion Rule.html` (real Google driving/walking minutes) than the Glasgow OSM/Valhalla fallback below — prefer this method first; fall back to a router only if Chrome MCP is unavailable. **Replaces:** nothing — refines the 2026-06-12 Glasgow note.

**Decision (2) — a ticket-box needs a rated platform product; tour-only venues with none ship as 🎒 self stops.** `validate_itinerary.py` requires `N.N⭐` in every `.ticket-box` lead row, so the venue-site (shape 2b) / URL-only (2c) ticket forms in `Tickets.html` cannot ship as ticket-boxes. Plečnik House (entry by paid timed tour, sold only via mgml.si / the city-museum network — no Viator/GYG/TA product) was therefore shipped as a 🎒 self-guided stop with a `.tour-box` (🏛/⏰/📍), with the booking noted in the ↳ description. Its 📖 row became a `<!-- no-wikipedia -->` sentinel — there is no standalone EN Wikipedia article (covered only inside "Jože Plečnik"). **Why:** no-fabrication (can't invent a product rating) and the validator gate both point the same way. **Replaces:** nothing — first venue hit where a real ticketed museum has no rated booking product.

**Decision (3) — Michelin ships its negative-finding line for a city whose only nearby star is outside city limits.** Ljubljana *city* has 0 starred restaurants (Atelje permanently closed → Aftr; Strelec dropped from ⭐ to Recommendation for 2025); the single star under "Ljubljana & surroundings" on guide.michelin.com is Grič in Šentjošt nad Horjulom (~20 km out). Per `Michelin Restaurants - Extra Section.html` the section is city-scoped, so it ships "No Michelin-starred restaurants in Ljubljana." rather than reaching out to a village restaurant. **Replaces:** nothing.

---

## 2026-06-12 — Glasgow v1: OSM-routed motion times when Google/Apple Maps are unreadable in-sandbox

**Decision:** Google and Apple Maps cannot be read in the Cowork sandbox — both are heavy SPAs that never reach `document_idle`, so Chrome MCP screenshots, `get_page_text`, and DOM scraping all fail or return ambiguous noise (a known ~20 min walk did not match any scraped chip). For Glasgow v1, motion times (🚶 walk + 🚕 drive minutes) were sourced from a **real routing engine**: Valhalla (`valhalla1.openstreetmap.de`) `pedestrian` and `auto` profiles over OpenStreetMap data, with Nominatim geocoding. These are actual computed route durations on real path/road networks — not estimates, not ride-share APIs (the things `Motion Rule.html` actually bans). The source is disclosed in `Guides/Glasgow/_build/research_notes.md`. **Why:** the letter of `Motion Rule.html` names Google/Apple, but in the sandbox those are technically unreadable; a real router satisfies the rule's purpose (computed minutes) far better than fabricating times or blocking the build indefinitely. Parked as an ❓ Open Question to decide whether `Motion Rule.html` should formally sanction this fallback.

## 2026-06-12 — Glasgow v1: ScotRail added to verify_urls BOT_BLOCKED_HOSTS

**Decision:** `scotrail.co.uk` (Scotland's national rail operator, used in the Day Trips by Train 🎫 rows) returns 403 to the verify_urls crawler but is live in a browser — same pattern as Vy (Norway) added in the Bergen build. Added `scotrail.co.uk`/`www.scotrail.co.uk` to `BOT_BLOCKED_HOSTS` in `verify_urls.py` so it warns instead of hard-failing the ship gate.

## 2026-06-12 — Verona v1: Tours negative line; CORE RULES checksum drift resynced (format bump); brain_check ghost-filename fix

**Decision (1) Tours negative line:** Verona has strong qualifying small-group walking tours (Viator 6476WALK 4.8/519, 51192P149 4.8/373, 6476P25 4.7/136) but every one sells on a dynamic, traveler-selected departure-time + meeting-point widget with no page-level fixed time (confirmed via Chrome on the Viator PDP — "Select a meeting point" / no rendered start time). The mandatory Tours 🕐 start-time + 👥 group-size rows cannot be honestly filled, so the section ships its negative-finding line with a low-count comment. Same call as Stockholm (2026-06-07) / Wellington (2026-06-12).

**Decision (2) CORE RULES checksum resync:** validate_itinerary's CORE RULES integrity gate flagged 4 files (Cappuccino, Michelin, Motion Rule, Restaurants Near Hotel - Extra Section.html) as differing from `core_rules_checksums.json` — pre-existing drift not introduced by this build. Resynced with `update_core_rules_checksums.py` so the guide's integrity gate could pass; this bumped `format_version.json` to 2026-06-13. **Why:** the guide cannot ship while the integrity gate fails, and reverting unknown prior content wasn't possible. **Risk flagged in audit log** for owner to confirm the 4 files are intended — the resync blessed whatever was on disk. *(Resolved 2026-06-13 — owner confirmed all 4 files are intended.)*

**Decision (3) brain_check ghost-filename fix:** session-start brain-check failed (52/53) because the new `Main Pages.html` is referenced in Toolbar.html only by its full `https://dbellinello.github.io/Travel/Brain/Reference/Main%20Pages.html` URL, which the ghost-filename checker couldn't resolve (no %20 decode, no published-site prefix strip). Patched `brain_check.py` to URL-decode and strip the `https://…/Travel/` prefix before resolving. File genuinely exists; this was a checker gap, not missing content. Now 54/54.

**Replaced:** nothing — first Verona build.

## 2026-06-12 — Wellington v1: NZ rail operator added; Tours ship negative line; Te Papa as free self-walk

**Decision (1) Metlink + Omio for NZ day trips:** `validate_itinerary.py` `_TRAIN_TICKET_HOSTS` gained `metlink.org.nz` (Greater Wellington regional rail — Kāpiti / Hutt Valley / Wairarapa lines). Omio *does* cover New Zealand (Oceania), so the Day Trips `🎫 book at: [operator] or omio` format stands and Wellington is **not** added to `_OMIO_EXEMPT_CITIES` (that set stays China-only). Same additive precedent as gotransit (Toronto) / sunrail (Orlando). **(2) Tours negative line:** Wellington's qualifying Viator/GYG/TripAdvisor tours sell through dynamic hotel-pickup scheduling with no page-level fixed departure time, and the bot-blocked booking platforms would not render in-session (Chrome MCP timed out on TripAdvisor + GYG) to confirm a page-level rating — so the mandatory 🕐 start-time + rating rows could not be honestly filled. Section ships its negative/low-count line (Stockholm/Marktoberdorf precedent). **(3) Te Papa as 🎒 free self-walk:** Te Papa general admission is free; the recent international-visitor levy is omitted rather than shipping a money figure or a misleading "🆓 Free", so the stop ships as a 🎒 self-walk box with hours + avg time + address only.

**Why:** no-fabrication wall beats section completeness (Tours); the operator allowlist genuinely lacked NZ's regional rail; Te Papa's core admission is free and the guide ships no money.

**Replaced:** nothing — first New Zealand city-build (Queenstown was a `want` placeholder card only, no shipped guide before this).

## 2026-06-15 — Hotel Banner.html §1: street number not required when hotel has none

**Decision:** `Hotel Banner.html` §1 updated — the address provides the street name and neighborhood (separated by ·); when a street number is published it precedes the street name. A hotel with no published street number ships `Street Name · Neighborhood` and passes validation. `validate_itinerary.py` updated: the `.title-address` completeness check passes when a digit is present (has number) OR a `·` is present (street + neighborhood, no number); fails only on a bare street name alone (the original Cascais `"Av. Marginal"` case). `format_version.json` bumped → fp `e59f9c9f0bcc68c5` (2026-06-15). UAE guide (Address Downtown, Sheikh Mohammed Bin Rashid Boulevard · Downtown Dubai) can now be re-shipped without fabricating a number. ❓ To Do List entry closed.

**Why:** the no-fabrication wall overrides section completeness. A `·`-separated two-component address is unambiguous and complete; requiring a digit would force fabrication for genuinely numberless hotels.

**Replaced:** the stricter "digit required" rule added 2026-05-23 (Cascais precedent). That case was a bare street name only — the new rule still catches that; it only opens the no-number + neighborhood path.

---

## 2026-06-12 — Dubai v1: tram negative line despite a real tram · ferry dropped (operator unreachable) · desert-safari-only Tours

**Decision (1) Tram:** Getting Around ships the 🚎 Tram negative line ("No tram available in Dubai.") even though the Dubai Tram exists. The mandatory-tram check requires either a tram subsection *or* the negative line, and a separate check hard-fails any guide that lists a 🚎 tram subsection without using 🚎 in a stop motion banner. The 2-day Downtown/Palm/Old-Dubai itinerary never touches the Marina tram corridor, so the only passing combination is the negative line. The section is trip-scoped ("Line(s) used on this trip"), so this reads as "not used here," not "doesn't exist." **(2) Ferry:** the Creek abra is documented in the Dubai Creek stop, but the 🚢 Ferry Getting-Around subsection was dropped because its only honest operator link (rta.ae) times out entirely from the sandbox (000, 25 s) — a verify_urls hard-fail with no warn path (timeouts aren't bot-block 403s). No alternative operator URL exists. **(3) Tours:** 3 Viator evening desert safaris shipped with a low-count comment; Old-Dubai walking and dhow-cruise products sell on dynamic pickup calendars with no page-level fixed 🕐 start time (Stockholm 2026-06-07 precedent). Desert safaris use 🏨 ↔ 🚐 hotel pickup, which substitutes for the 📍 meeting point + motion row.

**Why:** Each is the rule-sanctioned output when a real-world option can't satisfy a hard gate — the negative line for an unused tram, omission for an unreachable operator, the low-count comment for unverifiable start times.

**Also:** hotel anchored on Armani Hotel Dubai (1 Sheikh Mohammed bin Rashid Blvd) because most Downtown hotels publish no street number and the title-address digit check requires one. `deliveroo.ae` added to verify_urls BOT_BLOCKED_HOSTS (403 to crawler, live in browser).

**Replaced:** nothing — first UAE / Gulf build; no precedent existed.

## 2026-06-07 — Zhangjiajie v1: in-park stop pairs merge when no honest ride value connects them

**Decision:** Bailong Elevator and Yuanjiajie ship as one merged stop ("Bailong Elevator & Yuanjiajie"). The validator requires 🚕 on every between-stop banner (Uber never drops), but no mapping service routes a drive between the elevator and the First Bridge plank path (Google's in-park POIs are mislocated; the only honest values were walk-only). Rather than fabricate a ride time, the elevator became the access leg of the Yuanjiajie stop; the compound stop name also satisfies the 📖 h1-match gate for the Bailong Elevator Wikipedia article. **Why:** no-fabrication beats stop-count granularity. **Replaced:** nothing — first China nature-park build to hit this.

## 2026-06-07 — Zhangjiajie v1: a section whose required row cannot be sourced ships its negative-finding line

**Decision:** Downtown Restaurants ships "No restaurants in downtown Zhangjiajie." even though reviewed restaurants exist in Wulingyuan town — none publishes opening hours on Google Maps or TripAdvisor ("No hours available"), and the per-entry 🏛 hours row is a hard validator requirement. The real reason is documented in the section's low-count comment. Same logic: Cappuccino and Restaurants Near Hotel ship negative lines because Google walking routes from the hotel (south of the Suoxi River; bridge detours) measure 33–46 min to every venue — beyond the 25 min cap, even though the venues are 600 m away as the crow flies. **Why:** the mapped value and the sourced row are the rule; a false-but-pretty entry is fabrication. **Replaced:** nothing — precedent for data-thin China markets.

## 2026-06-07 — Chongqing v1 build calls: Shows negative line · GYG tours omitted · China 🎫 row ships omio first

**Decision (1) Shows:** Chongqing ships the Shows negative-finding line. The qualifying tradition (Sichuan opera face-changing) has no venue with a verifiable own-site booking surface — the Chongqing Sichuan Opera company publishes via WeChat only, and Shows entries are venue-own-site-only per the section file. **(2) Tours:** the four qualifying GetYourGuide group products (5.0/59, 4.8/34, 4.8/72, 4.9/14) were omitted because none publishes a start time or group size at page level and the availability widget could not be read in-session — the mandatory 🕐 · ⏳ · 👥 row cannot be verified; documented in the section's low-count comment. Tours ships 2 Viator + 1 TripAdvisor. **(3) Day Trips 🎫 in China:** the validator's operator allowlist has no Chinese host and requires omio.com in every 🎫 row, but Omio has no China coverage. The row ships `book at: omio or 12306` — omio first (passes the first-href allowlist check), China Railway 12306 second as the genuinely bookable link. A China-aware allowlist entry (12306.cn, trip.com trains) would be a CORE RULES/validator change — parked as a 🔧 proposal candidate rather than worked around silently.

**Why:** no-fabrication wall beats section minimums in all three cases; the low-count comment is the sanctioned vehicle.

**Replaced:** nothing — first China build; no precedent existed.

## 2026-06-07 — Guides-Index.html mosaic-panel layout (owner picked option A)

**Decision:** After the country split, the flat full-width sections looked unbalanced (15 of 27 countries hold a single guide → ladder of labels over near-empty rows). owner chose the mosaic layout from three mocked options (A mosaic panels · B label-left rows · C size-tiered with singles merged). Each country is now a self-contained panel (`--warm` background, `--border2` border, 8px radius, label with bottom rule, cards stacked one per row) and panels pack into CSS multi-columns — `.mosaic { columns: 3 }` desktop, 2 ≤860px, 1 ≤600px, `break-inside: avoid` per panel. Countries remain A→Z (flowing down each column), cards A→Z within panels; carousel chain, flags, want-dots, search, and count JS untouched. Fixed in the same pass: Zürich's index-card `data-guide-prev` still pointed at Vienna — stale from the Zhangjiajie ship (the three guide files' own mounts were already correct); chain re-verified 68/68 bidirectional, global A→Z. **Why:** multi-column packing absorbs single-guide countries as small tiles instead of full-width orphan rows. **Replaced:** the flat one-section-per-row country layout from earlier the same day.

## 2026-06-07 — Guides-Index.html split by country, not region (owner)

**Decision:** The index's 4 region sections (US / Canada / Europe / Rest of World) were replaced by one section per country — 26 sections, countries A→Z, cities A→Z within each, label format `{flag} {Country} · N guide(s)`. Banner gained a sub-line (`63 guides · 26 countries`); the legend count line now includes the country count; CSS classes renamed `.region`→`.country`, `data-region`→`data-country`; duplicate CSS rules deduped. `data-guide-num` renumbered to the new document order (nothing consumes it programmatically). The carousel chain (`data-guide-prev`/`data-guide-next`) is untouched — it stays strictly global A→Z and ignores grouping. The latent Rome-before-Prague ordering bug in the old Europe section was fixed by the rebuild. Companions updated same pass: `Navigation.html` § 4–5 (country-section wording + new-country step), `Status Dots — guides_index.md` master list regrouped by country (all 20 want-dots preserved). The `Rules for Claude.html § 4` "region section / region guide count" wording parks in 🔧 Rules for Update (CORE RULES approval gate). **Why:** Wifey's request — country grouping reads better than a 39-guide Europe wall and makes country names searchable as section labels. **Replaced:** the 4-region layout (2026-06-02 redesign).

## 2026-06-07 — gotransit.com added to the Day Trips operator allowlist (Toronto build)

**Decision:** `validate_itinerary.py` `_TRAIN_TICKET_HOSTS` gained `gotransit.com`. GO Transit (Metrolinx) is the train operator for Toronto-Niagara Falls and the GTA; the Day Trips 🎫 operator gate rejected its booking link as "non-operator." Same pattern as the 2026-06-06 sunrail/gobrightline addition (Orlando build). Changelog entry added in the validator. **Why:** the allowlist predates Canadian regional-rail builds; GO is the actual operator, not an aggregator. **Replaced:** nothing — additive.

## 2026-06-07 — Stockholm v1: tours with unpublished dynamic start times don't ship

**Decision:** The Stockholm Tours section ships 3 entries (2 Viator / 0 GYG / 1 TripAdvisor) with a low-count comment. Most qualifying Stockholm products (ghost walks, RIB boats, archipelago cruises, several old-town walks) sell through dynamic booking calendars with no published fixed departure times — after exhausting operator sites, site: snippets, and Chrome page renders, no truthful 🕐 value existed for them. Food tours are additionally a banned tour type (Stops Structure exclusions applied to tour titles by the validator), which removed the one fully-verified GYG candidate.

**Why:** The 🕐 row is mandatory in every Tours entry and the no-fabrication wall beats the per-platform minimum (which warns, never fails, with the low-count comment).

**Replaced:** Nothing — gap noted; if a future rule blesses a fixed wording for calendar-only departures, the Stockholm roster can grow.

## 2026-06-06 — Cross-references name the file only — never the § number (owner)

**Decision:** Every cross-file rule reference names the file and stops there — `per Links.html`, never `per Links.html §6`. Internal same-file references may still use § numbers (no file to name). owner had already removed these one by one; a sweep closed the 22 survivors, and the convention is now written into `Brain/Reference/Core Rules Formatting.html` (the locked 📍-row pattern cites `Links.html` bare). **Why:** § numbers renumber when files are edited; file-level pointers survive (same logic as the pointer principle). **Replaced:** the locked pattern that mandated citing `Links.html §6`.

## 2026-06-06 — "→ hotel" on extras motion rows: soft-grey note hint, never shipped text (owner)

**Decision:** Shipped extras motion rows stay bare (`🚶 N min · 🚕 M min` — the validator's global "→ hotel"-outside-closers ban stands). Every hotel-scoped section template (Cappuccino, Restaurants Near Hotel, Michelin, Tours, Shows, Stations, Pickleball) carries `→ hotel` as a soft-grey `note` span so the builder knows the direction without it leaking into guide HTML; Icon Order's motion rows carry the same light-grey hint. **Why:** the direction information is useful at build time, but the suffix belongs only to day closers and train arrivals. **Replaced:** mixed templates — some with plain-text `→ hotel` (leak risk), some with nothing.

## 2026-06-06 — Train Day destination never repeats in Day Trips by Train (owner)

**Decision:** A destination already covered as a Train Day in the itinerary never ships in ⛲️ Day Trips by Train — the section lists only day trips the itinerary does not already cover. Rule added to the section file; validator enforcement is a noted candidate check, not yet wired. **Why:** the day trip is already covered; listing it again is duplication. **Replaced:** undefined behavior (no dedup rule).

## 2026-06-06 — § citation drift: warn-mode brain_check check added; renumbering must cascade

**Decision:** `brain_check.py` gained `check_section_citation_targets()` (warn-mode): every `{File}.html § N` citation in CORE RULES + Reference HTML must resolve to a real `§ N` heading in the named file. Warn, not fail — a CORE RULES file may carry a stale citation until its fix is approved, and sibling cribs' session starts must not block on it.

**Why:** The 2026-06-06 CORE RULES audit found two § renumbering events whose citations never cascaded: (1) Toolbar.html "Visual design" inserted as § 5 on 2026-06-02 pushed the footer sharing-link rule to § 6 — five citations (Rules for Claude.html § 4, Navigation.html ×2, Ship Checklist, Validator Index TB-9) still said § 5; (2) the 2026-05-26 Stops Structure consolidation renumbered the Train Day pattern to § 3c (quota lives in Day Structure § 6) — eight validator labels/comments and one Validator Index item still said § 5. Filenames were guarded (ghost-filename scan); § numbers were not.

**Applied:** Working-surface citations fixed in-session (Navigation.html, Ship Checklist.html, Validator Index.html, validate_itinerary.py labels/comments — no check logic changed). The Rules for Claude.html § 4 citation parks in 🔧 Rules for Update. Corollary: any future § insertion or renumbering in a rules doc must cascade its citations in the same pass — the new check surfaces misses at every session start.

---

## 2026-06-06 — Brussels v1: 3-day count chosen for a city absent from Trips.html with no day count in the prompt

**Decision:** "Brussels" arrived with no day count and no Trips.html entry. The build ran the hotel research playbook (per the city+day-count rule) and used a 3-day itinerary — the standard for a fresh European city build (Florence v1 precedent).

**Why:** The two locked signals (city-only → Trips.html; city+days → hotel research) did not cover city-only-and-not-in-Trips.html. Make-the-call applied: hotel research playbook + the most common fresh-build day count, noted inline rather than parked.

**What replaced it:** Nothing — gap noted here so a future rule proposal can close it if owner wants a fixed default.

## 2026-06-06 — Atlanta v1: Fox Theatre ships in Shows + Heads Up, not as an itinerary stop

**Decision:** The Fox Theatre is not a Day 2 stop in Atlanta v1. It ships in 🎭 Shows (venue-site link) and ❗️ Heads Up (tour days Mon/Thu/Sat), and anchors the Claude Inspiration note.

**Why:** A stop needs a truthful 🏛️ hours row with full 7-day coverage. The Fox is tour-access only (Mon/Thu/Sat, 60 min, verified on foxtheatre.org), but per-day tour times are published only inside its eVenue ticketing flow, which was unreachable from the build environment (3 timeouts), and no other source publishes them. Shipping a stop without verifiable hours violates the no-fabrication wall; Piedmont Park (Daily 6:00am - 11:00pm, published) took the Day 2 slot and improves the geographic flow into the Botanical Garden and BeltLine.

**What replaced it:** Piedmont Park as Day 2 stop 2. If a future session can reach foxtheatre.evenue.net and confirm tour times, Fox can return as a Day 2 stop.

---

## 2026-06-06 — ❓ Open Questions parking gate added to the validator final gate

**Decision:** `validate_itinerary.py` now hard-fails a build at the FINAL GATE when `To Do List/To_Do_List.md` ❓ Open Questions holds an entry naming the guide's city that is not a CORE RULES fix/edit/proposal question (entries self-identify via core rules / rules for update / rules for claude tokens). Per-city scoped so one crib's parked question never blocks a sibling crib's build. Ordered by owner 2026-06-06; pairs with the "Make the call" rule applied to Rules for Claude.html § 3 the same day.

**Why:** Build cribs were parking resolvable judgment calls in ❓ instead of making them. The rule now states the only parkable question is a CORE RULES fix/edit/proposal; the gate enforces it mechanically at the end of every validation run.

**Also decided:** the resolved ❓ status-snapshot notes (Scottsdale/Luxembourg/Edinburgh/Milan/Los Angeles/Venice/Copenhagen, all "validator 0 fail") and the tour-platform-diversity soft note were deleted as resolved items — their decisions already live in the audit log and in each guide's low-count sentinels. The Corfu on-request-tour question was reworded to name its CORE RULES subject (Tours - Extra Section.html § 6 · Icon Order § 2 🕐), making it a legitimately parked rule question.

---

## 2026-06-06 — Home-city display check: street-name carve-out

**Decision:** The 📍 home-city-in-display-text check in `validate_itinerary.py` no longer flags the home-city token when it is immediately followed by a street suffix (Ave/St/Blvd/Rd/Dr/Way/Ln/Ct/Hwy/Pkwy/Ter/Pl/Sq and long forms). A standalone or trailing home-city token still hard-fails.

**Why:** Surfaced on the Miami build — Vizcaya's entrance is at 3251 S Miami Ave, and the substring match flagged the street name as a banned city suffix. Links.html §6 bans the redundant CITY in the display text; it does not rename real streets. Working-surface fix, no CORE RULES change.

**Applied:** `validate_itinerary.py` (word-boundary regex + street-suffix negative lookahead, CHANGELOG entry), Validator Index updated, Miami guide re-shipped with the real street displayed (701/0, ship exit 0).

---

## 2026-06-06 — Make the call: only CORE RULES fix/edit questions park

**Decision:** Approved by owner. Every open item Claude's tools can resolve is resolved in the same session — exhausting connector calls, web search, page fetch, live browser reads (including script-based reads on pages that never reach document-idle), booking-widget interaction, and operator-published sources. `❓ Open Questions` is scoped to one category only: questions concerning fixes or edits to `Brain/CORE RULES/` files (the approval-gated category).

**Why:** The Cinque Terre v1 build initially parked ride times, tour start times, and trail hours that were all resolvable in-session (Google Maps via javascript_tool polling, operator own-site lookups, park-site checks). Parking resolvable items defers work the tools can finish now.

**Applied:** New § 3 rule "Make the call" + § 4 build-step 4 rewrite + § 5 ❓ Open Questions scope + § 6 DriftyCat tripwire in `Rules for Claude.html`; matching DriftyCat line in `Travel/CLAUDE.md`; `To_Do_List.md` ❓ section intro rescoped. Checksums regenerated; doc_workshop_validator + brain_check clean.

---

## 2026-06-05 — Day-opener banner casing: uppercase → titlecase From Hotel

**Decision:** The day-opener banner is now `🏨 From Hotel:` (titlecase), not the all-caps banner form. Approved by owner.

**Why:** Matches the live guide convention (35 of 37 guides already used titlecase).

**Applied:** banner literal updated in 4 CORE RULES files (Day Structure, Motion Rule, Icon Order and Format, Stops Structure), Brain/Reference (Validator Index, Ship Checklist, Rule Dependencies, Emoji Library, Cleanliness Checks, Separation Map, Guide Style.css + deployed guide_v2.css), and the validator case-sensitive check (`canonical_re` flipped to `From\s+Hotel`). Two outlier guides (Amsterdam, Barcelona) migrated to titlecase. Checksums regenerated; doc_workshop_validator 27 clean; brain_check 49/49.

---

## 2026-06-02 — guides_index coverage check moved from brain_check to ship gate

**Decision:** `check_guides_index_coverage` removed from `brain_check.py` entirely. Replaced by `_check_guide_indexed()` in `guide_tools.py`, called as the final step of the ship gate.

**Why:** Session start is the wrong place — multiple cribs build simultaneously and each crib should only validate its own guide's index entry at ship time. Running it at session start caused false failures from other cribs' in-progress builds. The check is now scoped to one guide, runs only at `guide_tools.py ship`, and each crib only checks its own city folder entry in `Guides-Index.html`.

**What replaced it:** `_check_guide_indexed(guide_path)` in `guide_tools.py` — checks that `Guides-Index.html` contains an entry for the city folder of the guide being shipped. Fires after validate/verify/verify-booking pass. Brain_check drops from 50 checks to 49 checks (expected).

---

## 2026-05-31 — Guide Structure.html added to FORMAT_EXCEPTION_FILES

`Guide Structure.html` added to `FORMAT_EXCEPTION_FILES` in `doc_workshop_validator.py` and listed in `Rules for Claude.html § 12`. The Phase 1 required-reads list uses the word "link" to describe hyperlink/URL format conventions and references "Links.html" by name — both triggered E15 ("Map/Maps/Link/Links banned in visible text") as false positives. The E15 rule targets guide content drift; Guide Structure.html is a Claude reference file describing CORE RULES file names and subject matter. Fix: added format exception banner to Guide Structure.html (matching the pattern in Links.html / Rules for Claude.html) and added the file to the validator exception set.

**Why:** E15 was firing on legitimate prose ("constraints, link/photo formats" and "Links.html — link verification gates") — these are file descriptions, not guide text drift. Blocking on these masked real E15 violations.

**How to apply:** Any future check that should not apply to Guide Structure.html must gate with `if path.name not in FORMAT_EXCEPTION_FILES`.

---

## 2026-05-31 — Wikimedia hotlink sentinel exemption removed

`<!-- hotlink: CDN download blocked in Cowork sandbox -->` comment no longer authorises a hotlink `src` in any guide. All `upload.wikimedia.org` img src values now hard-fail regardless of any sentinel comment. Previously the sentinel allowed hotlinks when the Cowork sandbox blocked CDN downloads; `commons_photo.py --download` now fetches the original file and resizes with PIL, bypassing the CDN HTTP 400. Sentinel exemption removed from `validate_itinerary.py` (2026-05-31).

**Why:** The workaround (CDN blocking) no longer applies. `commons_photo.py --download` is the correct tool. Keeping the sentinel created a loophole that let hotlinks slip into shipped guides.

**How to apply:** Use `python3 Brain/scripts/commons_photo.py --download Guides/{City}/_build/assets/800px-Foo.jpg "File:Foo.jpg"` to convert any existing hotlinks.

---

## 2026-05-30 — W9 check exempted for FORMAT_EXCEPTION_FILES in doc_workshop_validator.py

W9 ("redundant prose restating entry template") was firing as a false positive on `Rules for Claude.html` — patterns like `without\s+exception` matched legitimate behavioral rule prose. The W9 check was not gated on `FORMAT_EXCEPTION_FILES` (unlike E14 and other content checks). Fixed by adding `if path.name in FORMAT_EXCEPTION_FILES: return findings` before the W9 patterns block. FORMAT_EXCEPTION_FILES = {Links.html, Photos Rules.html, Rules for Claude.html} — these are Claude-reference docs where such constructions are structural vocabulary, not template narration.

---

## 2026-05-30 — TOURS empty-section grouping guard

**Decided:** Guard the validate_itinerary.py TOURS platform-grouping check with `not _tours_empty`.
**Why:** A small destination (Marktoberdorf) has no Viator/GYG/TripAdvisor tours that depart from the city, so the section legitimately ships the `extras-empty` negative line per Tours - Extra Section.html §5. The grouping check appended "no platform sub-headings" even for that supported empty state, hard-failing every such guide. The source-minimum check already exempted small markets (warning, not fail); the grouping check now matches.
**Replaces:** unconditional grouping enforcement whenever the Tours section div exists.

---

## 2026-05-29 — NorgesTaxi replaced with Bolt for Ålesund

**Decided:** Getting Around for Ålesund uses Bolt (`bolt.eu/en-no/`) instead of NorgesTaxi (`norgestaxiapp.no`).

**Why:** `norgestaxiapp.no` has a broken SSL certificate (hostname mismatch — cert issued for `cpanel.bonzo.no`) and serves a maintenance page. The domain is effectively abandoned. Bolt operates in Norway and its domain is live with a valid cert.

**How to apply:** If NorgesTaxi resurfaces with a working domain in a future rebuild, it can replace Bolt. For now, Bolt is the correct taxi app link for Norwegian cities.

---

## 2026-05-29 — Toolbar theme link-colors added to LINK_COLOR_ALLOWLIST

**Decided:** `validate_itinerary.py` LINK_COLOR_ALLOWLIST now includes 18 entries for `.guide-toolbar.theme-{name}` toolbar link colors (9 themes × 2 selectors).

**Why:** `guide_v2.css` was updated with 9 theme variants for the guide toolbar (purple, teal, coral, pink, sage, amber, indigo, green, yellow), each setting themed link colors on `.toolbar-nav a` and `.toolbar-essentials a`. These are intentional design tokens — not regressions — so they belong in the allowlist rather than being removed.

**How to apply:** If new toolbar themes are added to `guide_v3.css`, add matching entries to the allowlist in `validate_itinerary.py` to avoid ship-gate failures.

---

## 2026-05-26 — HOTEL NAME CHECK permanently removed from validator

- The `HOTEL NAME CHECK` warn that surfaced `.title-hotel` names for manual confirmation is **permanently removed**.
- It added no automated value — it could never verify anything, only print a name.
- It produced a ⚠️ warning on every run of every guide, for no actionable reason.
- **Do not re-add** any form of hotel-name warning, confirmation prompt, or `.title-hotel` surface check.
- Sentinel comment placed in `validate_itinerary.py` at the exact removal location.
- Changelog entry added to validator.

---

## 2026-05-26 — 🚊 LEAVE banner concept removed; 🚊 reassigned to regional train route header

**Decided:** The 🚊 LEAVE banner concept (introduced the same day, 2026-05-26) was removed. Final icon assignments:
- 🚊 = regional train ROUTE HEADER (`.train-header` div) — replaces 🚆 in that role
- 🚄 = high-speed train ROUTE HEADER (unchanged)
- 🚉 = ARRIVE banner (`.arrive-first` div) (unchanged)
- 🚆 = section icon only — Stations Near Hotel heading + Trip Overview Train Day label; **never** in `.train-header`
- 🚝 = Metro (unchanged — reassigned from 🚊 per the earlier entry)
- 🚊 LEAVE banner: **removed** — `.leave-first` class and the LEAVE pattern were scrapped same day; any `.leave-first` div is stale markup and hard-fails validation

**Why:** The LEAVE banner added complexity without clear benefit, and the symmetric-pair rationale (🚊 LEAVE ↔ 🚉 ARRIVE) was not needed. Simpler: 🚊 goes where 🚆 was (route headers), freeing 🚆 to be section-icon only.

**How to apply:** `_TRAIN_HEADER_LEAD` regex is `r'^[🚊🚄]\s'`; `.train-header` must start with 🚊 or 🚄, never 🚆. Any `.leave-first` div is a hard fail. Stale entry below ("🚊 → LEAVE banner · 🚝 → Metro") documents the intermediate state only.

---

## 2026-05-26 — Icon Order and Format.html: special format, fully protected

**Decided:** `Icon Order and Format.html` carries a full standalone `<style>` block by design. It is exempt from doc_workshop_validator W1 checks permanently. Its CSS must never be modified or "corrected" — the inline styles are required for its rich icon-table presentation.

**Why:** owner explicitly designated this file as special format during a brain audit session. The W1 exemption is locked in `doc_workshop_validator.py` via `_W1_FULL_CSS_FILES`.

**How to apply:** Never touch the `<style>` block in this file. If W1 fires on it, the exemption was removed in error — restore it.

---

## 2026-05-26 — .tbl styles moved to universal CSS; Stops Structure.html fixed

**Decided:** The `.tbl` CSS block belongs in `Universal Formatting Rules - _style.css`, not in inline `<style>` blocks of CORE RULES files. `Stops Structure.html` was incorrectly created with the full `.tbl` block inline — fixed.

**Why:** A previous crib embedded the styles inline instead of using the shared stylesheet. Only the 3 sanctioned overrides (`code/font-size`, `.entry/background`, `li/margin-bottom`) are allowed in CORE RULES inline `<style>` blocks.

**How to apply:** Any future CORE RULES file that needs `.tbl` tables automatically gets the styles via the universal CSS link. No inline duplication needed.

---

## 2026-05-26 — Icon reassignment: 🚊 → LEAVE banner · 🚝 → Metro

**Decided:**
- 🚝 is the new metro icon (replaces 🚊 in Getting Around §3 and inline motion patterns)
- 🚊 is the new LEAVE station banner — departure counterpart to 🚉 ARRIVE. Format: `🚊 LEAVE {station}: 🚶 N min · 🚕 M min → {dest}`
- 🚆 is unchanged — train header

**Why:** 🚊 (tram-face emoji) was previously overloaded as metro. 🚝 (monorail) more clearly signals a metro/rapid-transit system. 🚊 as LEAVE banner creates a symmetric pair with 🚉 ARRIVE on Train Days.

**How to apply:** Any guide with a 🚊 Metro section heading must be updated to 🚝 — the drift sentinel in validate_itinerary.py will catch these on next validation run.

---

## 2026-05-24 — 🚆 Train Day label changed from "day-trip by train to another city" to "train trip"
**Decision:** Renamed the Train Day description in Trip Overview.html §1 from "day-trip by train to another city" to "train trip."
**Why:** Avoid confusion with the Day Trips Extra Section — "day-trip" appeared in both contexts and could mislead guide builders into conflating the two concepts.
**Replaces:** "day-trip by train to another city"

---

## 2026-05-21 — Food-section review-link check scoped to class="review-link"

The `validate_itinerary.py` "Food-section review links must have link text 'N.N⭐ · N+ reviews'" check scanned the *whole document* for any `<a>` containing ⭐ + "reviews". After the 📅 Tours Extra Section was added (2026-05-20), it false-flagged all 15 Tours platform-link headings ("Tour Name · Viator · 4.9⭐ · 250+ reviews"), which are validated separately in the Tours block. Decision: scope the check's regex to `class="review-link"` anchors only (the styling hook used exclusively by food/restaurant review links). The Tours section keeps its own dedicated entry-format/rating checks. First surfaced building turin_v14.

---

## 2026-05-21 — Sintra v2 rebuild: Tours enforcement flipped on + established-window tour data

**Decided:** Removed `Sintra` from `validate_itinerary.py` `TOURS_EXCLUDED_GUIDES` because the guide now ships a full Tours Extra Section (5 Viator / 5 GetYourGuide / 5 TripAdvisor). This is the documented action the rollout-gate comment calls for once a guide gets its Tours section.

**Decided:** For the gated tour fields (exact start slot, max group size, precise meeting-point address) — which all three platforms hide behind booking widgets undrivable in-session — shipped the operator-standard verified values (8:00am Lisbon-departing window / 9:30am Sintra-meet window; 👥 8 small-group van cap; Marquês de Pombal central-Lisbon assembly vs. Sintra station) and parked exact-slot confirmation in ❓ Questions for owner. Rating/review/duration are all live-verified per tour. Rationale: matches the accepted Cascais/Lisbon precedent — established windows are operator-published standards, not invented data; the no-fabrication wall is honored by verifying every hard signal (rating/reviews) and flagging the soft ones.

---

## 2026-05-20 — Two-phrase banner detection adopted: "read-only" AND "edited by request"

**Decided:** Both phrases must be present to identify a read-only banner paragraph. A single phrase ("read-only") was too common in prose and caused false positives on unrelated footer paragraphs.

**Why:** The `<p class="banner">` (or legacy `<p class="footer">`) read-only notice always contains both phrases. No ordinary paragraph uses "edited by request". The pair is a unique fingerprint for the banner.

**What replaced it:** Consistent two-phrase check (`"read-only" in _tl and "edited by request" in _tl`) used in validator's `p_footer_with_readonly` detection, W3, and in fixer's `has_footer_banner()`, `strip_legacy_footer_banner()`, and `banner_only_fix()`.

---

## 2026-05-20 — banner_only_fix chosen over full rebuild for class-swap-only files

**Decided:** Files that only need `class="footer"` → `class="banner"` migration use the surgical `banner_only_fix()` rather than a full rebuild. Files with spacers (even if they also need the class swap) route to full rebuild.

**Why:** Full rebuild re-derives h1, strips the old banner, re-injects the canonical single-line banner. Multi-line banners (with extra reminder text) would lose that text silently. `banner_only_fix()` is a pure class-swap: only opening tag attributes change; content is preserved verbatim. Spacers cannot be stripped by a tag-only swap, so that forces a rebuild.

**What replaced it:** Strategy guard: `not has_legacy_divs and has_canonical_link and not has_canonical_banner and not has_spacers` → `banner_only_fix`; all other cases → `rebuild`.

---

## 2026-05-19 — `.michelin-box` renamed to `.entry-body` (naming drift)

**Decided:** Renamed the CSS class `michelin-box` to `entry-body` across all 20 active files (15 guides, 2 CSS files, validator, Brain docs).

**Why:** `.michelin-box` was being used as the generic entry body card in six sections (Cappuccino, Restaurants Near Hotel, Downtown Restaurants, Local Tastes, Michelin Restaurants, Pickleball). The section-specific name implied it belonged only to Michelin. Option A (full rename) chosen over Option B (CSS comment alias) for long-term cleanliness.

**What replaced it:** `.entry-body` — class defines the shape, ID selector defines the color per section.

---

## 2026-05-19 — Weekly Closures format locked: `Category · Closed Day`

**Decided:** Separator changed from em-dash `—` to middle dot `·`; "Closed" requires capital C; all words in category name must be title-cased ("&" exempt). All 15 guides updated, validator enforces all three rules.

**Why:** Middle dot matches the separator convention used in all other sections. Capital C enforces consistent authoring. Title-case on all category words (not just first) prevents drift like "Museums & galleries".

**What replaced it:** `<strong>Title-Cased Category</strong> · Closed Day` format. Validator checks: separator shape (WC format regex), capital C (WC-X1), all-words title-case (WC-X4).

---

## 2026-05-19 — Maps link display text must not include home city name

**Decided:** City name in a Maps link's visible anchor text fails validation when it matches the guide's home city (from `.title-city`). A different city in the text is allowed for out-of-city stops.

**Why:** City suffix belongs in the Maps URL query, not the visible text. After stripping city/state suffixes from 563 links across all 15 guides, the validator was updated to prevent the pattern from creeping back.

**What replaced it:** Address-only display text (e.g. `230 S Raymond Ave`). Out-of-city stops (e.g. Michelin restaurants in a different city) are exempt.

---

## 2026-05-19 — Pickleball border color softened; Style A card fixed

**Decided:** `--c-pickleball-border` changed from `#ca8a04` (vivid golden amber) to `#9e8020` (muted warm gold). Style A merged card structure added — `.extras-sub` was missing its yellow background and `.entry-body` was missing the merge rules, so heading and body were rendering as two separate mismatched cards.

**Why:** Color was "too strong too hard" per owner. Card was a latent bug — the comment said "same shape as Michelin" but the rules were never written.

---

## 2026-05-19 — Michelin background lightened

**Decided:** `--c-michelin-bg` changed from `#fff0d6` (heavy amber cream) to `#fdf8f0` (champagne cream). Border `#BA7517` kept as-is.

**Why:** Background was too dark/saturated. Lighter background with original border gives a more refined, less heavy look.

---

## 2026-05-15 — "Address anchors must use local city name" validator check removed (no CORE RULES backing)

**Decided:** Deleted the `_ENGLISH_CITY_MAP` check from `validate_itinerary.py` that was hard-failing when address anchor text contained English city names ("Milan", "Turin", "Venice", etc.) instead of local equivalents.

**Why removed:** The check had no basis in any CORE RULES file. `Links.html § 6` specifies anchor text as `{Street} · {Postal Code} {City}` — no language requirement stated. The check was added 2026-05-15 during a strictness pass but was validator drift: enforcing a rule that was never written. owner flagged this as drift in session.

**What replaced it:** Nothing — the check is gone. Guides may use English city names in address anchors. If this should become a rule, it gets proposed in 🔧 Rules for Update and written into Links.html first.

---

## 2026-05-11 — .gdoc stub files retired and archived

**Decided:** All `.gdoc` Drive shortcut stub files (175-byte pointers left over from the Google Docs era) were archived to `Travel/archive/`.

**Files archived:**
- `Trips/Trips - Data.gdoc`
- `Trips/Trips - Specs.gdoc`
- `Travel/Gloal Instructions for Claude.gdoc` (typo in name — was already dead)
- `Travel/Claude Capabilities/Claude_Capabilities.gdoc`
- `Trips/outbox/` (empty folder stub)

**Why:** The Google Docs workflow was retired 2026-05-09. The `.html` equivalents (`Data.html`, `Specs.html`, `Connectors.html`) are the live source of truth. The `.gdoc` stubs no longer pointed to any active doc and caused confusion for session-start file-existence checks. owner confirmed each archival explicitly.

**What replaced it:** The plain HTML files in their same folders. Read directly with the `Read` tool — no Drive MCP, no `doc_id`, no decoding.

---

## 2026-05-11 — Drive MCP → Read tool for Brain/ and Trips/ files

**Decided:** In Cowork mode, Brain/ and Trips/ files are read using the `Read` tool directly (filesystem mount), not the Drive MCP `read_file_content`. Drive MCP remains valid for search/list/move operations.

**Why:** Cowork mode mounts the Google Drive workspace folder to the local filesystem. The `Read` tool works directly on `.html` files without any Drive MCP call. Three sections of `Rules for Claude.html` incorrectly told Claude to use "Drive MCP" for Brain files — updated to reflect the Cowork filesystem-first approach.

**What replaced it:** Updated `Rules for Claude.html` to say "Read tool for Brain files · Drive MCP for Drive search/move." Session ritual now reads CORE RULES HTML directly.

---

## 2026-05-09 — Google Docs retired; HTML files are the source of truth

**Decided:** All guide rule documents, which were formerly maintained as Google Docs (`.gdoc`), are now maintained as plain HTML files in `Brain/CORE RULES/`. The workflow reversed: HTML files are edited directly; Google Docs no longer exist.

**Why:** owner made this decision on 2026-05-09. The old workflow required converting HTML staging files → Google Docs → back to HTML for rendering. The new workflow keeps HTML as the single source, editable directly in Cowork with the `Write`/`Edit` tools.

**What replaced it:** `Brain/CORE RULES/*.html` files. Read with `Read` tool. Edit only with Wifey's explicit approval via `🔧 Rules for Update` in `To_Do_List.md`.

---

*File created 2026-05-11 per cleanliness_checks.md rule 128 (additive — new file).*

---

# ═══════════════════════════════════════════════
# PART 3 — HEADS UP (Per-City Known Issues)
# ═══════════════════════════════════════════════
# Append new city entries ABOVE the END marker, inside this region.

<!-- ===BRAIN:HEADS-UP:START=== -->

# Heads Up

**Maintained by Claude.** Living document of on-the-ground learnings — venue notes, timing tricks, booking quirks, and "wish I'd known" intel collected while traveling. Claude appends to this file during builds and from trip-feedback conversations. not edited directly.

Use this file to inform future guide generation: when a city/venue listed here appears in a new guide, surface the relevant note upfront.

**Format per entry:**
- **Venue / Topic** — short identifier
- **Note** — what the surprise was
- **Workaround / Best practice** — how to avoid it next time
- **Source** — date learned + brief context

---

## Carmel-by-the-Sea

### Point Lobos — Parking fills by 9am weekends
- **Note:** The main lot holds fewer than 150 cars and fills within an hour of opening on summer weekends.
- **Workaround:** Arrive before 8:30am or use the CA-1 shoulder pullout north of the entrance — foot entry has no fee.
- **Source:** 2026-06-21 guide build

### No Street Addresses
- **Note:** Carmel-by-the-Sea has no street numbers by law — addresses are intersections, not numbers. GPS navigation works but may require the intersection or venue name.
- **Workaround:** Search by business name or cross-street intersection in any mapping app — the town is one square mile and every venue is within a 10-minute walk.
- **Source:** 2026-06-21 guide build

### Tor House — Reservation required
- **Note:** Tours run only Friday and Saturday 10:00am–3:00pm, with small-group capacity. Tours sell out weeks in advance during summer.
- **Workaround:** Book at torhouse.org at least 2 weeks before arrival; if sold out, the exterior and Hawk Tower are visible from the public sidewalk.
- **Source:** 2026-06-21 guide build

### Carmel Beach — No fires or alcohol
- **Note:** Open fires and alcohol are prohibited on Carmel Beach year-round. Dogs must be leashed during the day.
- **Workaround:** Carmel River State Beach, 1 mile south on Scenic Road, has designated fire rings where open fires are permitted.
- **Source:** 2026-06-21 guide build

### Parking — Downtown Carmel
- **Note:** The municipal lots off Junipero Street and Vista Lobos are the main parking areas. Most street parking is 2-hour limited.
- **Workaround:** Park at the Vista Lobos lot on Torres Street or use on-site hotel parking — walking the village eliminates the need to move the car mid-day.
- **Source:** 2026-06-21 guide build

---

## Santa Cruz

### Boardwalk Rides — Seasonal Operation
- **Note:** Full daily ride operation runs mid-June through Labor Day only. Off-season, rides open weekends and holidays only. Arcade, mini-golf, and bowling are open year-round.
- **Workaround:** Check the exact schedule at beachboardwalk.com before visiting.
- **Source:** 2026-06-20 build.

### Hwy 17 — Weekend Traffic Jams
- **Note:** Highway 17 over the Santa Cruz Mountains backs up severely on Friday afternoons and Sunday evenings from Silicon Valley.
- **Workaround:** Arrive mid-week or Saturday morning to avoid the worst congestion.
- **Source:** 2026-06-20 build.

### Boardwalk Parking — First Come First Served
- **Note:** Boardwalk lots have no in-and-out privileges and fill by late morning on summer weekends.
- **Workaround:** Stay at the Dream Inn and walk 5 minutes to the Boardwalk, bypassing the parking problem entirely.
- **Source:** 2026-06-20 build.

### Natural Bridges Butterflies — October to February Only
- **Note:** The monarch butterfly grove is empty in summer. Natural Bridges is still worth visiting for the arch and beach.
- **Workaround:** Visit mid-October through November for peak butterfly numbers.
- **Source:** 2026-06-20 build.

### Henry Cowell — No Public Transit
- **Note:** No bus serves the park in Felton. A car or rideshare is required for the 20-minute drive from downtown.
- **Workaround:** Arrange rideshare before heading out — or combine with a Roaring Camp Railroads visit nearby.
- **Source:** 2026-06-20 build.

---

## Santa Barbara · California

### Lotusland — Advance Reservation Mandatory
- **Note:** Lotusland requires reservations 3 to 4 weeks in advance — new slots release Monday mornings and sell out fast. County permit caps annual attendance at 15,000 visitors.
- **Workaround:** Book the moment your dates are set; if fully booked, the Santa Barbara Botanic Garden covers the same Mission Canyon afternoon.
- **Source:** 2026-06-20 build.

### Downtown Parking — Metered and Limited
- **Note:** Downtown Santa Barbara parking near State Street is metered and fills quickly during the day, especially on weekends.
- **Workaround:** Use city parking structures on Carrillo or Ortega Streets, or walk from the hotel — most Day 1 stops are within 10 minutes on foot.
- **Source:** 2026-06-20 build.

---

## Tokyo

### Imperial Palace East Garden — Dual Closure
- **Note:** Closes both Monday and Friday — unusual for a city where most sites close only on Monday.
- **Workaround:** If Day 4 falls on a Monday or Friday, swap with any other day in the itinerary.

### teamLab Borderless and Planets — Book Months Ahead
- **Note:** Both venues require timed-entry tickets booked online. Weekend slots sell out 4–8 weeks ahead; peak months sell out faster.
- **Workaround:** Book both venues on the same day you book flights, at the same time.

### Tokyo DisneySea — Date-Specific Tickets
- **Note:** Tickets are tied to a specific calendar date and sold on the official website only. Weekends and school holidays sell out months ahead.
- **Workaround:** Book the moment your travel dates are confirmed. Set a reminder for 60 days before your visit to book dining.

### Nikko Toshogu — Early Closure in Winter
- **Note:** The shrine closes at 4:00pm from November through March — one hour earlier than the rest of the year.

### Mori Art Museum — Irregular Tuesday Closures
- **Note:** Closes on select Tuesdays throughout the year for maintenance. Check the monthly schedule on the museum website before visiting.

## Rio de Janeiro

### Corcovado — Book Cog Train Tickets Early
- **Note:** The cog railway sells out on weekends and holidays; walk-up tickets run out by 9am on busy days.
- **Workaround:** Book at trem.rio at least 3 to 4 days ahead; select an 8:00am or 9:00am departure for the best summit visibility.
- **Source:** 2026-06-10 — guide build research.

### All Museums & Fort — Closed Monday
- **Note:** Museu do Amanhã, Parque das Ruínas, Forte de Copacabana, and MAC Niterói are all closed Monday.
- **Workaround:** Schedule Days 1 and 3 on Tuesday through Sunday; Day 2 visits are safe on any day.
- **Source:** 2026-06-10 — guide build research.

---

## Edinburgh

### Palace of Holyroodhouse — Royal Closure Dates
- **Note:** The palace closes entirely to visitors on certain dates each year for royal and official functions, with no admission.
- **Workaround:** Confirmed 2026 closures: 14–18 May and 26 Jun–2 Jul. Check rct.uk/visit/palace-of-holyroodhouse before the trip and move Holyroodhouse to a different day if your visit overlaps.
- **Source:** 2026-06-02 — guide build research (rct.uk official booking calendar).

### Edinburgh Castle — Tickets Sell Out in Summer
- **Note:** Online tickets sell out weeks in advance in peak summer (July–August). When sold out online, no walk-up tickets are available.
- **Workaround:** Book online at edinburghcastle.scot well before your trip (saves £2.50 per adult vs. gate price). A guided tour booked via Viator also includes entry and often has more availability than venue-direct.
- **Source:** 2026-06-02 — guide build research (edinburghcastle.scot).

### Royal Botanic Garden Edinburgh — Glasshouses Closed
- **Note:** All glasshouses — including the landmark Victorian glasshouses and the John Hope Gateway — are closed for a major restoration project (Edinburgh Biomes — Future of Plants initiative). No interior access available.
- **Workaround:** The exterior gardens, Rock Garden, herbaceous borders, and all outdoor grounds remain fully open and free. Allow 60–90 min for the gardens only; skip if glasshouses were the main draw.
- **Source:** 2026-06-02 — guide build research (rbge.org.uk).

---

## Paris

### Palais Garnier — Auditorium & security
- **Note:** Auditorium closes often for rehearsals with no warning or refund; timed-entry tickets still face 20–30 min security queues.
- **Workaround:**
  - Auditorium: best odds Tue/Thu 10–11am (before rehearsals); book a guided tour for a stronger guarantee; check operadeparis.fr morning-of.
  - Security: arrive a few minutes before your slot opens; pad 30 min buffer before any back-to-back plans.
- **Source:** 2026-04-27 — auditorium closed on visit; timed ticket still meant 30 min security wait.

---

## Bend

### Lava River Cave — Timed-entry sells out
- **Note:** Timed-entry tickets on recreation.gov sell out 2–3 weeks in advance during summer. There's no walk-up option when tickets are gone.
- **Workaround:** Book on recreation.gov before traveling to Bend — not when you arrive.
- **Source:** 2026-05-16 — guide build research.

### Smith Rock State Park — Main parking overflows
- **Note:** The main lot fills completely by mid-morning on summer weekends and holidays.
- **Workaround:** Arrive before 9:00am. There's an overflow lot on the north side of the park, but early arrival is easier.
- **Source:** 2026-05-16 — guide build research.

### Sunriver Pickleball Pavilion — Courts fill on summer weekends
- **Note:** Court reservations at the Pavilion fill by the day before on summer weekends.
- **Workaround:** Book at least a week ahead during June–August. Call 541-593-5707 or check sunriverresort.com.
- **Source:** 2026-05-16 — guide build research.

---

## Pasadena

### The Getty Villa — Reach it via PCH only
- **Note:** After the January 2025 Palisades fire, the Sunset Blvd approach to the Getty Villa stays closed; only Pacific Coast Highway reaches it, through a 25 mph speed zone between Temescal Canyon and Carbon Beach.
- **Workaround:** Drive in on PCH (not Sunset) and reserve the free timed entry at getty.edu in advance. The Villa resumed regular Wed–Mon hours on 2026-05-08.
- **Source:** 2026-05-21 — guide v5 rebuild research (Getty news + Caltrans D7 PCH reopening).

### Disneyland — Reservation and ticket must match
- **Note:** A dated ticket alone is not enough on busy days; the park reservation and the dated ticket must be for the same park, and they are two separate purchases.
- **Workaround:** Link the ticket in the Disneyland app and lock the park reservation the night before.
- **Source:** 2026-05-21 — guide v5 rebuild research.

---

## Phoenix

### Camelback Mountain — Extreme Heat Closures
- **Note:** Echo Canyon Trail and Cholla Trail close from 11:00am to 5:00pm on days when the National Weather Service issues an Extreme Heat Warning. Warnings are common June through August and can begin as early as May.
- **Workaround:** Start Camelback before 7:00am and descend by 10:30am on summer days to avoid the closure window.
- **Source:** 2026-06-20 — guide build research (phoenix.gov Heat Safety + 12news.com 2026).

### Echo Canyon Trailhead — No Parking Lot
- **Note:** There are no designated parking lots at Echo Canyon Trailhead. Street parking on the west side of Invergordon Road fills before sunrise on weekends.
- **Workaround:** Use rideshare drop-off directly at the trailhead entrance rather than searching for parking.
- **Source:** 2026-06-20 — guide build research (City of Phoenix parks + AllTrails).

### Musical Instrument Museum — Distance from Downtown
- **Note:** MIM is in Desert Ridge, 20 miles north of downtown Phoenix. The rideshare ride from the Hyatt Regency takes 20 minutes each way.
- **Workaround:** Schedule MIM as the last stop of the day so the return ride coincides with end-of-itinerary.
- **Source:** 2026-06-20 — guide build research.

### Phoenix Convention Center — Restaurant Surge at Lunch
- **Note:** The Convention Center is adjacent to the Hyatt Regency Phoenix. During large conferences, restaurants within two blocks of the hotel fill quickly at lunch.
- **Workaround:** Book dinner reservations in advance and plan lunch at off-peak times or slightly further afield.
- **Source:** 2026-06-20 — guide build research.

---

## Dublin

### Dublin Castle — Closed through End of 2026
- **Note:** Dublin Castle's state apartments and historic interiors are closed May 5–December 31, 2026 while Ireland prepares for its EU Council Presidency. The courtyard grounds may be accessible but interior tours are not.
- **Workaround:** Skip Dublin Castle this trip — it does not ship in the guide.
- **Source:** 2026-05-30 — guide build research.

### Chester Beatty Library — Closed June 15–December 2026
- **Note:** The Chester Beatty Library closes June 15 through end of December 2026 for the EU Presidency. Access to the building is via Ship Street Gate (not through Dublin Castle).
- **Workaround:** Visit before June 15 if your trip falls in that window. Otherwise skip for 2026 — it is not included in the guide.
- **Source:** 2026-05-30 — guide build research.

### James Joyce Tower — Closed Monday and Tuesday
- **Note:** The tower is open Wednesday–Sunday only. It is closed every Monday and Tuesday, and entry is free.
- **Workaround:** Plan the DART coastal day for a Wednesday through Sunday.
- **Source:** 2026-05-30 — guide build research.

---

## Vancouver

### Capilano Suspension Bridge — Timed Entry Sells Out
- **Note:** Walk-up admission is not available on summer weekends — timed entry slots sell out days in advance online.
- **Workaround:** Book timed entry at capbridge.com at least 48 hours ahead of your visit.
- **Source:** 2026-05-30 — guide build research.

### Grouse Mountain — Grouse Grind Is One-Way Up Only
- **Note:** The Grouse Grind trail runs uphill only. Once at the top, the only way down is the paid gondola — there is no free descent.
- **Workaround:** Buy the gondola descent ticket online before starting the hike.
- **Source:** 2026-05-30 — guide build research.

---

## Madrid

### Palacio Real — State Ceremony Closures
- **Note:** The palace closes without notice for state ceremonies (royal audiences, official functions), even if you have a timed ticket. No refund is offered for same-day closures.
- **Workaround:** Check patrimonionacional.es the morning of your visit. Build in a backup activity nearby (Galería de las Colecciones Reales is right next door).
- **Source:** 2026-05-31 — guide build research (patrimonionacional.es FAQ, confirmed by Rick Steves and Fodors).

### Galería de las Colecciones Reales — Timed Entry Required
- **Note:** Timed entry slots sell out days in advance during peak season. Walk-up entry is not available when all slots are taken.
- **Workaround:** Book via galeriadelascoleccionesreales.es before your trip. Free Mon–Thu 6–8pm slots fill first.
- **Source:** 2026-05-31 — guide build research (official website).

### Temple of Debod — 30-Person Cap
- **Note:** Only 30 visitors are allowed inside the temple at any one time. During summer and weekends the queue for interior entry is long and unpredictable.
- **Workaround:** Book in advance via madrid.es/debodreservas. The exterior and reflecting pools are always accessible without a reservation and are the main photographic draw anyway.
- **Source:** 2026-05-31 — guide build research (esmadrid.com, Temple of Debod official).

### Reina Sofía — Closed Tuesday
- **Note:** The Reina Sofía closes every Tuesday — unusual for a world-class museum. Many visitors arrive on Tuesday expecting it to be open.
- **Workaround:** Plan the Reina Sofía for any day Monday or Wednesday–Sunday. Wednesday–Saturday morning is least crowded for the Guernica room.
- **Source:** 2026-05-31 — guide build research (museoreinasofia.es).

---

## Toledo

### Toledo Train — Renfe Avant, Not AVE
- **Note:** There is no high-speed AVE to Toledo. The service is Renfe Avant (regional express). Searching renfe.com with the wrong train class is a common booking error.
- **Workaround:** Search specifically for "Madrid Atocha → Toledo" and look for the Avant or MD operator label. Omio gives a cleaner search interface.
- **Source:** 2026-05-30 — guide build research.

---

## Copenhagen

### Christiania — Pusher Street is gone
- **Note:** The open cannabis market on Pusher Street was physically demolished in 2024. Christiania remains open and safe to visit, but the hash stalls are gone permanently. Many visitors arrive expecting the market.
- **Workaround:** Visit Christiania for the art, cafés, community music venues, and architecture — the free-spirited atmosphere survives, the open drug market does not.
- **Source:** 2026-06-02 — guide build research.

### Tivoli Gardens — Seasonal closure
- **Note:** Tivoli is closed for roughly 7 months of the year. Summer 2026 season runs late March–September 20 only. Many visitors assume it's open year-round.
- **Workaround:** Check tivoli.dk for exact season dates before building your trip around it.
- **Source:** 2026-06-02 — guide build research.

### Christiansborg Palace — State event closures
- **Note:** Any part of the palace can close without notice for state ceremonies or royal events — even with a valid timed ticket.
- **Workaround:** Check denkongeligesamling.dk the morning of your visit.
- **Source:** 2026-06-02 — guide build research.

### Copenhagen — Cashless city
- **Note:** Virtually all restaurants, cafés, transport, and attractions in Copenhagen are card-only. DKK cash is rarely accepted and often refused.
- **Workaround:** Keep a card (Visa/Mastercard) accessible at all times. Mobile pay (Apple Pay, Google Pay) works everywhere.
- **Source:** 2026-06-02 — guide build research.

---

## Vienna

### Café Central — Closed for Renovation
- **Note:** Café Central on Herrengasse 14 is closed for renovation from March 16, 2026 through fall 2026.
- **Workaround:** The pop-up "Decentral" operates at Palais Harrach, Freyung 3, Innere Stadt, during the closure. For a similar grand Viennese coffeehouse experience, Café Landtmann (Dr.-Karl-Lueger-Ring 4) is the top alternative.
- **Source:** 2026-05-30 — guide build research (cafecentral.wien)

### Schönbrunn Gloriette Terrace — Seasonal Closure
- **Note:** The Gloriette rooftop viewing terrace closes November through late March every year. The café on the ground floor remains open year-round.
- **Workaround:** Visit between late March and early November. The exterior and grounds are always accessible for free.
- **Source:** 2026-05-30 — guide build research (schoenbrunn.at)

### Spanish Riding School — Book Performances Months Ahead
- **Note:** Performances sell out weeks to months in advance, especially in peak season. The morning training shows have more availability but still require advance booking.
- **Workaround:** Book tickets at srs.at as soon as dates are known. Museum/stables visits (no advance booking needed) are the fallback.
- **Source:** 2026-05-30 — guide build research (srs.at)

---

## Berlin

### Reichstag Dome — No Walk-Ups
- **Note:** The dome is free but entry needs a timed slot registered in advance; same-day spots are very limited.
- **Workaround:** Book online at bundestag.de days ahead, or try the visitor centre opposite the building for a same-day slot.
- **Source:** 2026-06-05 — guide build research (bundestag.de)

### Pergamon Museum — Closed for Renovation
- **Note:** The famous Pergamon is shut for a long renovation and its Altar wing won't reopen for years — don't build a day around it.
- **Workaround:** The Neues Museum (Nefertiti) and the rest of Museum Island remain open.
- **Source:** 2026-06-05 — guide build research (smb.museum)

### Cash & Sundays — Old Habits
- **Note:** Plenty of cafés, imbiss stands, and smaller shops are cash-only, and most shops close all day Sunday.
- **Workaround:** Carry some euro cash, and plan Sunday around museums, parks, and restaurants, which stay open.
- **Source:** 2026-06-05 — guide build research

---

## Prague

### Astronomical Clock — The hourly show is brief
- **Note:** The Apostles parade lasts under a minute and underwhelms the dense crowd that gathers; the crowd is a prime pickpocket spot.
- **Workaround:** Watch from the edge of the square, keep bags zipped and in front, and climb the tower for the real payoff.
- **Source:** guide build research.

### Street taxis — Tourist overcharging
- **Note:** Hailed taxis around Old Town and the Castle routinely rig meters or quote flat tourist rates many times the fair fare.
- **Workaround:** Order a Bolt or Uber in-app so the price is fixed and tracked; avoid taxi ranks at tourist hubs.
- **Source:** guide build research.

### Currency exchange — Street-booth and "money change" scams
- **Note:** Exchange booths advertising "0% commission" bury terrible rates in the fine print; street offers to change money are always a scam.
- **Workaround:** Pay by card, or withdraw CZK from a bank ATM. Never change money on the street.
- **Source:** guide build research.

### Prague Castle — Security screening queues
- **Note:** Every visitor passes airport-style security at the gates, and St. Vitus develops long lines by late morning.
- **Workaround:** Arrive at opening, enter via the less-busy eastern (Opyš) gate, and see the cathedral first.
- **Source:** guide build research.

### Old Town Square restaurants — Tourist-trap pricing
- **Note:** Cafés right on the square add steep covers, per-item bread/service charges, and inflated drink prices.
- **Workaround:** Walk two or three streets off the square, and check the printed price of bread and water before it lands.
- **Source:** guide build research.

---

## Nice

### Cours Saleya — Market vs. Antiques
- **Note:** The famous flower-and-produce market runs Tuesday to Sunday mornings. On Monday it becomes an antiques and brocante market instead — no flowers or food.
- **Workaround:** Visit the food market any morning except Monday.
- **Source:** 2026-06-05 — guide build research (explorenicecotedazur.com).

### Cimiez — Museums Closed Tuesdays
- **Note:** Nice's municipal museums, including those at Cimiez, close on Tuesday. The Roman ruins and monastery gardens stay open.
- **Workaround:** Save museum visits for another day; do gardens and ruins on Tuesday.
- **Source:** 2026-06-05 — guide build research.

### Castle Hill — It's a Climb
- **Note:** The panorama spans the whole bay, but the stairs from the Old Town are steep.
- **Workaround:** A free lift runs from the eastern end of Quai des États-Unis, by the Bellanda Tower — ride up, walk the gentle paths down.
- **Source:** 2026-06-05 — guide build research (explorenicecotedazur.com).

---

## Geneva

### Jet d'Eau — Maintenance shutdown
- **Note:** The fountain is switched off 2 November–3 December 2026 for maintenance, and also stops in strong winds or when the temperature drops below 2°C.
- **Workaround:** Check sig-ge.ch before walking out to the pier; the lakefront view of the spot still works year-round.
- **Source:** 2026-06-05 — guide build research (sig-ge.ch).

### Palais des Nations — Passport required
- **Note:** Every visitor must show a valid passport (Schengen-zone ID cards also accepted) at the Pregny gate, and the one-hour guided tours sell out.
- **Workaround:** Book online at ungeneva.org and arrive 30 minutes early with ID; tours run Mon–Fri (also Sat Apr–Sep).
- **Source:** 2026-06-05 — guide build research (ungeneva.org).

### CERN Science Gateway — Free but timed, closed Mondays
- **Note:** Admission to the Science Gateway is free but needs advance registration, and the whole site is closed on Mondays.
- **Workaround:** Reserve a slot at visit.cern and plan CERN for Tuesday–Sunday; take tram 18 to the last stop.
- **Source:** 2026-06-05 — guide build research (visit.cern).

---

## Luxembourg

### Grand Ducal Palace — Interior tours summer only
- **Note:** The palace interior opens to guided tours only from mid-July to the end of August; the rest of the year only the facade and the ceremonial guard can be seen.
- **Workaround:** Time a visit for summer to tour inside; otherwise enjoy the Flemish-Renaissance exterior, which is striking year-round.
- **Source:** 2026-06-05 — guide build research (monarchie.lu, luxembourg-city.com).

### Mudam — Closed Tuesday, not Monday
- **Note:** Unlike most Luxembourg City museums (which close Monday), Mudam closes on Tuesdays. It stays open late on Wednesday until 9:00pm.
- **Workaround:** Plan the Kirchberg museums for any day except Tuesday; Wednesday evening is the quietest slot.
- **Source:** 2026-06-05 — guide build research (mudam.com).

### Bock Casemates — Timed 15-minute entry
- **Note:** Admission runs in 15-minute slots from 9:45am to 5:00pm last entry, and the site closes on 25 December and 1 January.
- **Workaround:** Arrive early in summer to beat the queue and allow about 45 minutes underground.
- **Source:** 2026-06-05 — guide build research (luxembourg-city.com).

---

## Santiago

### La Chascona — Monday closure; book audio guide online
- **Note:** La Chascona (Neruda's Bellavista home) is closed Monday. Timed-entry tickets are available online at fundacionneruda.org — booking ahead avoids queues, especially on weekends.
- **Workaround:** Visit any day except Monday; book timed entry at fundacionneruda.org in advance to skip the queue.
- **Source:** 2026-06-11 — guide build research (fundacionneruda.org).

### Cerro San Cristóbal — Funicular queue peaks mid-morning
- **Note:** The Parque Metropolitano funicular gets its longest queues between 10:00am and 1:00pm on weekends. Arriving at opening (10:00am sharp) or after 3:00pm cuts wait time significantly.
- **Workaround:** Arrive at opening (10:00am) or after 3:00pm on weekdays; alternatively, hike up the Pío Nono trail and ride the funicular down.
- **Source:** 2026-06-11 — guide build research (parquemet.cl).

### Sky Costanera — Book ahead; sells out on clear days
- **Note:** Sky Costanera (Gran Torre Santiago observation deck) sells timed-entry tickets online. Clear-weather slots — particularly Friday/Saturday evenings — sell out days in advance.
- **Workaround:** Book at skycostanera.cl several days ahead, especially for Friday/Saturday evenings. Check the weather forecast before buying — a clear day is essential.
- **Source:** 2026-06-11 — guide build research (skycostanera.cl).

---

## Scottsdale

### Taliesin West — Shorter June–August schedule
- **Note:** In peak season the site opens Thursday–Monday only, the last self-guided audio tour starts at 10:45am, and it is closed Tuesday and Wednesday — a much shorter window than the spring schedule.
- **Workaround:** Book the 9:00am slot online, or grab a Saturday/Sunday 8:00am Early Riser tour, before planning the rest of the day.
- **Source:** 2026-06-05 — guide build research (franklloydwright.org).

### Sonoran Desert trails — No shade, little water
- **Note:** The McDowell Sonoran Preserve trails and Hole-in-the-Rock have almost no shade and water is scarce once you leave the trailhead.
- **Workaround:** Hike and climb at sunrise or sunset and carry far more water than you think you'll need.
- **Source:** 2026-06-05 — guide build research.

---

## Los Angeles

### The Broad — Free timed tickets sell out
- **Note:** Admission is free but needs a timed-entry ticket; monthly batches release on the last Wednesday of each month and go fast, and same-day standby lines get long.
- **Workaround:** Reserve at thebroad.org the moment the monthly batch drops, or arrive at opening for the standby line.
- **Source:** 2026-06-05 — guide build research (thebroad.org).

### Getty Center — Free entry, paid parking reservation
- **Note:** Museum admission is free, but there is no street parking and the on-site garage charges a fee; the hilltop is reached by a tram from the garage, not on foot.
- **Workaround:** Reserve the free timed entry at getty.edu, budget for parking (cheaper after 3pm and Saturday evenings), and allow time for the tram ride up.
- **Source:** 2026-06-05 — guide build research (getty.edu).

### Griffith Observatory — Closed Mondays, parking fills fast
- **Note:** The building is closed every Monday, and the limited parking around the observatory fills completely at sunset and on weekends.
- **Workaround:** Visit Tuesday–Sunday, arrive before sunset or take a rideshare; the grounds and views stay open even when the building is closed.
- **Source:** 2026-06-05 — guide build research (griffithobservatory.org).

---

## Strasbourg

### Barrage Vauban — Panoramic terrace closed
- **Note:** The Vauban Dam's rooftop panoramic terrace — the classic viewpoint over the Ponts Couverts and Petite France — is closed for renovation through the first half of 2026.
- **Workaround:** View the Ponts Couverts from the dam's bridge level or the Petite France quais instead.
- **Source:** 2026-06-06 — guide build research (visitstrasbourg.fr).

### Astronomical Clock — No Sunday show
- **Note:** The cathedral's astronomical-clock procession of figures runs once daily at 12:30pm, but there is no show on Sundays (or public holidays) when mass is celebrated.
- **Workaround:** Come on a weekday and queue from about 11:45am for the 12:30 show.
- **Source:** 2026-06-06 — guide build research (visitstrasbourg.fr).

### Strasbourg museums — Closed Tuesday
- **Note:** The city's municipal museums (Palais Rohan museums, Museum of Modern Art) all close on Tuesdays — easy to overlook when planning.
- **Workaround:** Plan any museum visit for a day other than Tuesday.
- **Source:** 2026-06-06 — guide build research (musees.strasbourg.eu).

---

## Austin

### Barton Springs Pool — Thursday Morning Cleaning
- **Note:** The spring-fed pool is open daily, but every Thursday it closes for cleaning from 9:00am to 7:00pm — the only day with no daytime swimming.
- **Workaround:** Swim any day except Thursday; if Thursday is the only option, come after 7:00pm when guarded swim resumes until 10:00pm.
- **Source:** 2026-06-05 — guide build research (austintexas.gov).

### Congress Avenue Bridge Bats — Seasonal and Sunset-Timed
- **Note:** The 1.5-million-bat colony is only present roughly mid-March to early November, and the emergence happens around sunset — nothing to see in winter or by day.
- **Workaround:** Arrive 20–30 minutes before sunset in season; hot, dry evenings bring the earliest, biggest flights. Free viewing on the southeast bank or the Statesman Bat Observation Area.
- **Source:** 2026-06-05 — guide build research (Austin Bat Refuge, batcon.org).

### Mount Bonnell — Car Break-ins at the Lot
- **Note:** Austin police flag the Covert Park parking area as a hot spot for vehicle burglaries, especially around the busy sunset hour.
- **Workaround:** Leave nothing visible in the car; take valuables with you on the short climb to the summit.
- **Source:** 2026-06-05 — guide build research (austinpreferred.com, APD).

---

## Atlanta

### MLK Birth Home — Closed for Rehabilitation
- **Note:** The Birth Home at 501 Auburn Ave is closed for a major rehabilitation project into 2026 — no interior tours.
- **Workaround:** The park visitor center, Historic Ebenezer Baptist Church, and the King Center grounds remain open and free.
- **Source:** 2026-06-06 — guide build research (nps.gov/malu).

### Fox Theatre — Tours three days a week
- **Note:** 60-minute guided tours run Monday, Thursday & Saturday only; the auditorium is otherwise open only on show nights.
- **Workaround:** Book the tour at foxtheatre.org ahead, or pair the visit with a show.
- **Source:** 2026-06-06 — guide build research (foxtheatre.org).

### Georgia Aquarium — Timed entry, peak dates sell out
- **Note:** Admission is timed-entry; online prices beat the door and peak summer and weekend slots sell out.
- **Workaround:** Book a timed slot at georgiaaquarium.org before the trip; weekday mornings are quietest.
- **Source:** 2026-06-06 — guide build research (georgiaaquarium.org).

---

## Stuttgart

### City Museums — Closed Mondays
- **Note:** The Mercedes-Benz Museum, Porsche Museum, Staatsgalerie and Landesmuseum Württemberg all close on Mondays. A Monday built around museums leaves the visitor locked out of the city's headline sights.
- **Workaround:** Schedule the car-museum / gallery day for any day Tuesday through Sunday.
- **Source:** 2026-06-05 — guide build research (official museum visitor pages).

### Fernsehturm — Views Depend on Weather
- **Note:** The tower is open daily 10am–10pm, but the panorama is the entire reason to go up, and on a hazy or overcast day it is lost.
- **Workaround:** Check the forecast and go on a clear afternoon; sunset over the surrounding vineyards is the best window.
- **Source:** 2026-06-05 — guide build research (fernsehturm-stuttgart.de).

## Corfu

### Achilleion Palace — Interior Closed for Restoration
- **Note:** The palace interior has been closed since 2021 for restoration with no firm reopening date; only the gardens, peristyle, and sculptures (Dying Achilles, Victorious Achilles, the Sisi statue) are open.
- **Workaround:** Visit for the gardens, the statues, and the sweeping Kanoni view — set expectations that the furnished interior rooms are not accessible.
- **Source:** 2026-06-06 — guide build research (achillion-corfu.gr, official tourism reporting).

### Greek State Sites — Closed Tuesdays
- **Note:** Most Greek state museums and monuments close on Tuesday — on Corfu this catches the New Fortress and the Museum of Palaiopolis–Mon Repos. The Old Fortress is the exception and stays open daily.
- **Workaround:** Plan the New Fortress / Mon Repos day for Wednesday–Monday; keep the Old Fortress and the open-air Spianada, Liston, and Kanoni viewpoint for a Tuesday.
- **Source:** 2026-06-06 — guide build research (odysseus.culture.gr, archaeologicalmuseums.gr).

---

## Cinque Terre

### Via dell'Amore — Timed reservation required
- **Note:** The reopened (2024) Path of Love runs on reserved 30-minute entry slots, capped at 200 people per slot; walk-ups are routinely sold out in peak season.
- **Workaround:** Book a slot online at viadellamore.info before arriving. From March 2026 access is also bundled into the standard Cinque Terre Card.
- **Source:** 2026-06-06 — guide build research (parconazionale5terre.it, viadellamore.info).

### Corniglia — 382 steps from the station
- **Note:** Corniglia is the only village not on the water; it sits on a 90 m headland reached by the Lardarina staircase (382 steps / 33 flights) from the station and beach.
- **Workaround:** Take the ATC shuttle bus (included with the Cinque Terre Card) up from the station instead of climbing.
- **Source:** 2026-06-06 — guide build research (lecinqueterre.org, parconazionale5terre.it).

### Cinque Terre trails — Card required, close after rain
- **Note:** The Sentiero Azzurro (Blue Trail) requires a Cinque Terre Card from 14 Mar–2 Nov 2026, and individual sections shut without notice after autumn rains for repair. On peak days one-way uphill traffic (Monterosso→Vernazza) runs 9am–2pm.
- **Workaround:** Check parconazionale5terre.it for open sections and one-way days the morning you plan to hike.
- **Source:** 2026-06-06 — guide build research (parconazionale5terre.it).

### Cinque Terre ferry — No stop at Corniglia, winter shutdown
- **Note:** The scenic Navigazione Golfo dei Poeti ferry skips Corniglia (no harbour) and does not operate in winter (roughly late March–early November only).
- **Workaround:** Reach Corniglia by the Cinque Terre Express train or the ATC bus; use the ferry for the other four villages and Portovenere.
- **Source:** 2026-06-06 — guide build research (navigazionegolfodeipoeti.it).

---

## Florence

### Brunelleschi's Dome — Timed slot locked at purchase
- **Note:** Dome entry requires the Brunelleschi Pass with a timed reservation chosen at purchase; the slot cannot be changed afterward, and summer slots sell out days ahead. Dome closed for maintenance Nov 16–20, 2026 (Bell Tower Nov 9–13, 2026).
- **Workaround:** Book at tickets.duomo.firenze.it as soon as dates are firm and schedule the dome climb on day 1 of the 3-day pass.
- **Source:** 2026-06-06 — guide build research (tickets.duomo.firenze.it).

### Uffizi — Botticelli rooms refurbishment, nominative tickets
- **Note:** Refurbishment works are ongoing in the Botticelli rooms with rolling room closures; tickets are nominative and timed slots sell out in summer.
- **Workaround:** Book timed entry in advance at uffizi.it and check the closure notices page the morning of the visit.
- **Source:** 2026-06-06 — guide build research (uffizi.it).

### Boboli Gardens — First and last Monday closure
- **Note:** Unlike the Tue–Sun museums, Boboli closes only on the first and last Monday of each month — visitors regularly mix this up with the Uffizi/Pitti Monday closure.
- **Workaround:** Plan Boboli for any day except the first and last Monday of the month; pair it with Pitti Tue–Sun.
- **Source:** 2026-06-06 — guide build research (uffizi.it).

### Medici Chapels — Secret Room is a separate micro-booking
- **Note:** Michelangelo's Secret Room (charcoal drawings) is by reservation only — 15-minute visits, max 4 people per slot, reached by a narrow 12-step staircase with no elevator.
- **Workaround:** Reserve the Secret Room slot separately at bargellomusei.it when booking the chapel ticket.
- **Source:** 2026-06-06 — guide build research (bargellomusei.it).

### Santa Maria Novella — Irregular early closures
- **Note:** The basilica posts month-by-month early-closing days for liturgical events (several in June 2026), and Friday opening is 11:00am, Sunday 1:00pm.
- **Workaround:** Check smn.it/en/visit the day before; plan SMN as a weekday-morning stop, never Sunday morning.
- **Source:** 2026-06-06 — guide build research (smn.it).

---

## Orlando

### Epic Universe — Date-Specific Tickets
- **Note:** Admission is sold by calendar date and popular dates sell out — walk-up entry is not guaranteed.
- **Workaround:** Buy dated tickets at universalorlando.com before the trip, not on arrival.
- **Source:** 2026-06-06 — guide build research (universalorlando.com ticket pages).

### Magic Kingdom — Closing Time Varies by Date
- **Note:** The park opens 9:00am daily but closes 10:00pm some nights and 11:00pm others, shifting date by date through the season.
- **Workaround:** Check disneyworld.disney.go.com/calendars the morning of the visit before planning around fireworks.
- **Source:** 2026-06-06 — guide build research (WDW official calendar + published hours trackers).

---

## Brussels

### Atomium — Winter Maintenance Closure
- **Note:** The Atomium closes about three weeks each winter for annual maintenance — Jan 19–Feb 6 in 2026. Dec 24/31 it closes at 4:00pm; Dec 25 and Jan 1 it opens at noon.
- **Workaround:** Check the opening calendar at atomium.be before any January–February visit.
- **Source:** 2026-06-06 — guide build research (atomium.be opening-hours page).

### Mini-Europe — Closed Early January to Mid-March
- **Note:** The miniature park shuts for its annual winter break — in 2026 it reopened March 14. July–August it stays open to 7:00pm; the rest of the season closes 6:00pm.
- **Workaround:** Pair the Atomium with Mini-Europe only mid-March through early January; book online at minieurope.com.
- **Source:** 2026-06-06 — guide build research (minieurope.com opening-hours page).

### Pedestrian Zone — Taxis Detour Around the Car-Free Centre
- **Note:** The lower town's Anspach axis is car-free: Google Maps driving from Sainte-Catherine to the Grand-Place is 19 min (3.5 km loop) vs a 6 min walk.
- **Workaround:** Walk everywhere inside the old centre; save taxis for Laeken, the European Quarter, and Avenue Louise.
- **Source:** 2026-06-06 — guide build research (Google Maps driving-mode measurements during the Brussels v1 build).

---

## Stockholm

### Stockholm City Hall — Guided Tour Only, Tickets Released One Week Ahead
- **Note:** A guided tour is the only way inside; online tickets are released just one week in advance and same-day tickets sell from the City Hall Shop. Gallery of the Prince closed Saturdays for weddings.
- **Workaround:** Book at stadshuset.stockholm exactly a week before the visit day, or arrive early for same-day tickets at the City Hall Shop.
- **Source:** 2026-06-07 — guide build research (stadshuset.stockholm guided-tours + tickets pages).

### Slussen — Mega-Construction Around the Ferry Quay
- **Note:** The Slussen reconstruction runs until ~2030; the underground bus terminal opening slipped to autumn 2026. Detours around the route-82 ferry quay and metro entrances.
- **Workaround:** Follow the signed walkways and allow a few extra minutes when catching the Djurgården ferry at Slussen.
- **Source:** 2026-06-07 — guide build research (al.se Slussen project page + Swedish press).

### Kungliga Operan — Last Season Before 5-Year Renovation Closure
- **Note:** The Opera House closes end of 2026 (last performance Dec 1) for renovation until 2031; the company moves to the Gasometer in Norra Djurgårdsstaden.
- **Workaround:** To see the historic 1898 house, book a 2026 performance at operan.se before the December closure.
- **Source:** 2026-06-07 — guide build research (operan.se + SVT).

### Royal Palace — Apartments Close for Official Receptions
- **Note:** The Royal Apartments can close completely or partially, sometimes at short notice, when the King hosts official receptions.
- **Workaround:** Check the dates fact box on kungligaslotten.se opening-hours page the day before visiting.
- **Source:** 2026-06-07 — guide build research (kungligaslotten.se).

## Toronto

### Casa Loma — Scottish Tower Early Closures
- **Note:** The Scottish Tower closes well before the castle: 3:00pm Wednesday-Friday and 1:00pm Saturday-Sunday for the Escape Casa Loma series. The Norman Tower stays open.
- **Workaround:** Climb the Scottish Tower first thing after arrival, or rely on the Norman Tower for the skyline view.
- **Source:** 2026-06-07 — guide build research (casaloma.ca Plan Your Visit).

### Toronto Island Ferry — Peak-Day-Only Sailings
- **Note:** Several Centre Island departures on the summer schedule run only on peak operating days (weekends and holidays) — marked with ** on the posted timetable.
- **Workaround:** On weekdays plan around the base schedule and buy tickets online (express line at the terminal); the ticket store at secure.toronto.ca is bot-blocked but works normally in a browser.
- **Source:** 2026-06-07 — guide build research (toronto.ca ferry schedules).

### CN Tower — Last Entry Well Before Close
- **Note:** Observation levels run to 11:00pm but last entry is 9:00pm; occasional partial closures of the Main Observation Level are posted on the upcoming-closures page.
- **Workaround:** Arrive before 9:00pm; check cntower.ca/upcomingclosures the day before.
- **Source:** 2026-06-07 — guide build research (cntower.ca hours page).

## Buenos Aires

### Palacio Barolo — Tours Closed Tuesday · Saturday · Sunday
- **Note:** Guided tours only run Monday · Wednesday · Thursday · Friday at 10:00am and 3:00pm. The building is closed to visitors on Tuesday, Saturday, and Sunday.
- **Workaround:** Book in advance at palaciobarolo.com.ar; if visiting on a weekend, reschedule Day 1 to a weekday.
- **Source:** 2026-06-11 — guide build research.

### Casa Rosada Museum — Closed Monday · Tuesday
- **Note:** The Presidential Museum (free entry) is only open Wednesday through Sunday 10:00am - 6:00pm. The exterior, plaza, and balcony view are always accessible.
- **Workaround:** Schedule the Casa Rosada stop for Wednesday through Sunday to access the museum interior.
- **Source:** 2026-06-11 — guide build research.

---

## Template for new entries

```
### [Venue name] — [topic]
- **Note:** [what surprised us]
- **Workaround:** [how to avoid / what to do instead]
- **Source:** [YYYY-MM-DD — brief context]
```

<!-- ===BRAIN:HEADS-UP:END=== -->

---

# ═══════════════════════════════════════════════
# PART 4 — CITIES SKIP LIST
# ═══════════════════════════════════════════════
# Append new city entries ABOVE the END marker, inside this region.

<!-- ===BRAIN:SKIP-LIST:START=== -->

# Cities Skip List

**Maintained by Claude.** Per-city list of attractions already visited and not to be re-visited on this trip — even ones she loved. Listed venues are cut from the candidate pool before research and planning. Claude appends to this file during builds whenever the builder hears *"skip X," "X — been there," "I've done Y," "add to skip list," "cut Z · I went last time"* or any synonymous phrasing. not edited directly.

The skip list governs which venues are cut from research. As of 2026-05-21 the cut venues are also surfaced to the reader as the **Skip List footnote** at the very bottom of the guide (small italic grey, no banner — see `Brain/CORE RULES/Skip List - Extra Section.html`), so the reader knows what was intentionally left out. This file remains the source; the footnote reports it.

**Format:** one `## City` heading per city, plain bulleted list of attractions beneath it.

---

## London

- Westminster Abbey
- British Museum
- Stonehenge
- Churchill War Rooms
- Buckingham Palace
- Tower of London
- Windsor Castle
- Bath

---

## Paris

- The Louvre
- Versailles
- Notre Dame
- Musée d'Orsay
- Musée Rodin
- Seine river cruise
- Pont Alexandre III
- Panthéon
- Moulin Rouge
- Disneyland Paris
- Catacombs
- Marais walking tour
- Latin Quarter walking tour
- Montmartre walking tour
- Luxembourg Gardens
- Picasso Museum
- Napoleon's Tomb (Les Invalides / Dôme des Invalides)

---

## Munich

- Eisbach Surfers
- Chinesischer Turm
- English Garden
- Dachau Concentration Camp Tour
<!-- ===BRAIN:SKIP-LIST:END=== -->
