# To Do List

> One file. Three sections. Everything lives here — no separate rule-update file. Resolved items get deleted (no strikethrough).

---

## ✈️ My Tasks

*Private tasks — bookings, flights, hotels, research, logistics.*

### 2026-06-16 — Flight-time view: per-leg breakdown + total ✅ COMPLETE 2026-06-17 (102/102)

*Decision (Dani): rework the "By flight time from Seattle" cards to show each flight segment's time + total. **DONE** — every connecting destination now shows its real per-leg breakdown.*

**Result:** all **102/102 connecting cities** carry real `lg` legs (92 two-leg, 10 three-leg); nonstops show their single leg. Validator `validate_flight_index.py` = **0 fail · 0 warn** (the old Montevideo/Bali/Istanbul warns cleared). Card example: `SEA→AMS 9h45 · AMS→VIE 1h45 · 11h30 air`.

- **Infrastructure:** FMAP optional `lg` field; card render `.fbreak` sub-line; validator checks legs chain SEA→…→dest + sum==m + positive ints; headline = `m`+(legs−1)×90 layover. Leg count = REAL routing (decoupled from marketed r-tier); colour/routing-authority invariants intact.
- **Data:** first 54 cities = exact connector block times; remaining 48 = web-sourced scheduled durations (connector was down) — real, rounded ~5 min, flagged `_web_sourced` in the cache, refreshable later.
- **Records:** `To Do List/Flight Per-Leg Backfill — Progress.md` (completion log) + `To Do List/flight_legs_cache.json` (96 sourced legs). Reroutes (Nice/Cannes/Monaco via CDG, Marrakech via CDG, Stockholm via AMS, Curacao via JFK) + 10 three-leg trips documented there.

### 2026-06-16 — Validator hardening session — status + backlog

**Validator checks ADDED/RESTORED this session (live in `validate_itinerary.py`, all verified vs 137 guides, changelog entries written):**
- ↳ / 📖 rows must carry `class="stop-row"` (Aix shipped `stop-desc`/`stop-wiki` → broken spacing).
- Every stop carries a yellow operational box; no operational row (🏛/⏳/🚫/🕐/⏰/🆓/💵/⚠️/📍) outside the box (was deferred/unenforced).
- Inside-box icon order 🎟→🏛/⏳→🚫→🕐/⏰→🆓/💵→⚠️→📍 (restored; the 2026-06-16 element-order rewrite had removed it).
- Day-header en-dash, train-day overview parser, in-city em-dash — false-positive fixes (were wrongly failing correct guides post-2026-06-16 en-dash convention).
- Heads Up note row must start with ↳ (§2).
- Food Delivery link text must be the bare domain, not the platform name (§2).

**GUIDE-FIX BACKLOG (guides currently failing — not yet fixed, Dani paused fixing):**
- Bali — 6 stops no box + 7 stops with rows outside box.
- 14 guides — ⚠️ placed above the hours (icon order): Aruba, Cayman Islands, Colmar, Curacao, Dublin, Helsinki, London, Lucerne, Marrakech, Montevideo, Paris, Toledo, Vancouver, Zurich.
- 32 guides — Heads Up note missing ↳.
- 22 guides — Food Delivery link text shows platform name not domain (Geneva, Rome, Florence, Los Angeles, Scottsdale, Stockholm, Dubai, …).
- Aix — already fixed (stop-desc→stop-row); Dubrovnik, Seville, Stockholm — already fixed earlier.

**OPEN — link-text format pass (do as ONE coherent pass; needs rule grounding + maybe CORE RULES clarification):**
- Getting Around ride-app links (e.g. 🚕 Bolt → `bolt.eu`) must show the **bare domain**, like Food Delivery — `Bolt` as link text must fail. Check Getting Around - Extra Section.html for the canonical format.
- 🎫 booking-operator link text (Omio, Trainline) must be the proper **name, Capitalized** (`Omio`, not `omio`) — or the domain; confirm canonical in Tickets.html / Day Trips by Train. Lowercase `omio` must fail.

**OPEN — CORE RULES edits needed (approval + change cascade):**
- Tours - Extra Section.html — define ONE canonical per-platform negative/low-count line, identical regardless of platform (current state: 14+ free-form variants e.g. "No qualifying open-group tours on TripAdvisor Experiences for Lille…"). Proposed canonical: "No qualifying tours in [City]." Pattern matches Guide Entry Counts negative-line style.
- Food Delivery - Extra Section.html §2 — clarify that link text is the bare domain (validator already enforces; rule text is vague).

**OPEN — investigate:**
- Lake Como — 📅 Tours negative-finding line has "no color" (styling/class missing on the negative line).
- Dubai — Burj Khalifa photo is rotated 90° (building lying down); needs a correctly-oriented Wikimedia Commons image. Rotated-image detection is NOT validator-catchable (no EXIF flag; pixels baked) — needs a vision QA pass; logged separately above.
- Budapest — incomplete build (Phase 6 unchecked) was added to guides_index mid-session; its essentials cascade has since completed and it now validates.

### 2026-06-16 — Transit-time duplicates — SURFACER added; manual re-lookup still open

*Several guides repeat the same `🚶 N min · 🚕 M min` from-hotel time across multiple entries. Suspicion: a crib copy-pasting a placeholder time instead of looking each up. BUT many duplicates are legitimate — shared tour coach meeting point (Dublin's Cliffs of Moher / Giant's Causeway day-trips depart the same O'Connell St stop), one building complex (Bend = 5 buildings of 57100 Beaver Dr), same spot written two ways (Singapore Chinatown Point ≡ Chinatown MRT), adjacent street numbers (Lisbon R. Viriato 1b/9b).*

**Resolved 2026-06-17 (Dani asked "can the validator check that?"):** Partly — as a WARN SURFACER, not a hard fail. Built `Brain/scripts/audit_transit_dupes.py` (advisory, NOT in validate_itinerary.py, never a ship gate). It groups from-hotel `🚶/🚕` rows by identical time and flags any where one time hits ≥ N distinct 📍 pins (default 4 = strong tier). A naive "any repeated time" check would fire on 107/137 guides (mostly legit); the ≥4-pin tier narrows to **19 guides** — the real placeholder band. It CANNOT hard-fail: the validator sees text, not geography, so it cannot tell a real shared point from a paste (even the 19 include confirmed false positives — Bend/Singapore/Lisbon above). Registered in Validator Index.html (Motion/Transit section) + CLAUDE.md Validators table.

**IN PROGRESS 2026-06-17 — re-lookup + fix (Dani: "fix tons / all of them now"):**

DONE + verified (real Google Maps times, validator no new fails):
- **San Sebastian** — all 7 pins fixed. Shipped 5/3 on all; real = La Concha 24/12, Parte Vieja venues 3–7 walk / 1–3 ride.
- **San Francisco** — all 12 pins fixed (done by agent, independently re-verified by me: walking matched 11/11 exactly, driving within traffic variance). Note: changing walk times forced a re-sort of the Restaurants Near Hotel section (ascending-walk-order validator rule) — agent handled it, validates 0 fail.
- **Munich** — all 9 unique pins fixed (I looked up via Chrome; agent applied edits). Real values diverged a lot from the 18/6 placeholder group (Rumfordstraße 30/15, Hildegardstraße 28/14, Viktualienmarkt 23/11, Max-Joseph-Platz 24/16). **CASCADE (important, will recur):** two venues whose placeholder time (18 min) had wrongly put them inside the 25-min "near hotel" cap turned out to be 28–30 min real → they no longer qualify, so they were DROPPED with a documented `<!-- low-count -->` comment (Vits Der Kaffee from Cappuccino, Conviva im Blauen Haus from Restaurants Near Hotel). Validator stays 714/2 (the 2 fails are pre-existing tram-rule, unrelated). **POLICY APPLIED for the rest:** when a real time pushes a near-hotel/cappuccino/downtown venue past its section's walk cap, drop it + add the low-count comment (keeps the guide valid). Alternative (preserve count by researching a closer replacement) is more work — switch to that if Dani prefers. Re-sort ascending-walk sections after any walk-time change.

METHOD (locked — use exactly):
1. Origin MUST be the hotel BY NAME (e.g. "Hyatt Regency San Francisco 5 Embarcadero Center"), NOT just the street address. Street-only geocodes to the wrong end of the street and inflates every time (caught on Budapest: "Kalman Imre utca 19" → Deák tér 15 min/1.1km, but real "Hotel President Budapest" → 12 min/900m). Get the hotel NAME from the guide's title-hotel banner.
2. Google Maps directions URL: `https://www.google.com/maps/dir/?api=1&origin=<HOTEL NAME>&destination=<pin>&travelmode=walking` (and `=driving`). 🚶=walking, 🚕=driving.
3. Read ONLY the `.fontHeadlineSmall` recommended-route headline via Chrome MCP javascript_tool (the naive "first N min on page" grabs stray elements and is WRONG — verified). JS: `[...document.querySelectorAll('.fontHeadlineSmall')].find(e=>/^\d+\s*(h\s*)?\d*\s*min$/.test(e.textContent.trim()))`.
4. browser_batch of navigate→wait 4s→js, ~5 pins per batch (Chrome extension is FLAKY — large batches drop the connection).
5. Edit in place anchored on each pin's unique 📍 query string (the time div text repeats). After editing walk times, RE-SORT any Restaurants Near Hotel / Downtown / Cappuccino section that requires ascending walk order, then run validate_itinerary.py (failed-count must not increase).

CONSTRAINT: subagents CANNOT reach the Chrome extension (wave-1 test: 2 of 3 agents blocked; the one that "finished" used an unsanctioned headless browser). Only the MAIN session can drive Chrome → the lookups are SERIAL, no agent parallelism. This is a long grind: ~55 guides remain (full flagged list: `audit_transit_dupes.py --min 3`, 61 guides; strong tier `--min 4` = 19).

REMAINING (not yet fixed): Budapest (lookups done but ~3min inflated — REDO with hotel-name origin), Munich, Zurich, Melbourne, Iceland, Bend, Alesund, Bangkok, Bruges, Curacao, Lille, Lisbon, Pasadena, Seville, Singapore, Split, Tokyo, Turin (strong tier) + ~40 more at the ≥3 tier. Worklist with origins+pins cached at outputs/worklist.json (regen: outputs/build_worklist.py).*

### 2026-06-15 — Retry: register Travel Cowork artifacts (backend was down)

*The `create_artifact` backend failed on 2026-06-15 — even a trivial test artifact returned "Failed to save artifact", so it's a backend outage, not the files. Retry registration when the backend is back. Files (verified working, use `window.cowork.sendPrompt`/`callMcpTool`; do NOT edit, only register):*

- `Travel/artifacts/guide_index_day_actions_panel.html` → id `guide-index`. Day counts load from `guide_days.json` (present in `My Drive/Travel/`). mcp_tools: `["mcp__c9c414e0-9fa7-4ae9-9b0b-ddc88a9094c9__download_file_content"]`
- `Travel/artifacts/travel-planner.html` → id `travel-planner`. Trips load live from Drive; hotel/flight tabs fire search prompts. Same mcp_tools.

*Note: `create_artifact` needs the HTML copied into the local outputs/scratch dir first, then pass that path as `html_path`. Run a throwaway test artifact first; only register the two real ones if the test succeeds. Delete this item once both are pinned.*

### 2026-06-12 — Plug Adapter Guide.html audit findings (audit only, not yet fixed)

*File: `Travel/Trip Essentials/Plug Adapter/Plug Adapter Guide.html`. 598 images = 28 unique photos (1 plug + 1 socket per type, reused). Internal consistency OK — all 131 countries' detail images match their index lists. Picture mismatches found:*

**1. Type C ⇄ Type F plug photos are SWAPPED (highest impact).**
- "Type C" plug photo shows a grounded Schuko (Type F) plug → wrong in 91 countries. Should be the slim 2-pin Europlug.
- "Type F" plug photo shows the slim Europlug (Type C) → wrong in 52 countries.
- Both wall-socket photos are correct; only the plug faces are swapped. Fix = swap the two plug images.

**2. Type L plug photo is wrong.** Shows a triangular large-pin (Type M) plug; Type L should be three in-line round pins. The Type L socket photo is correctly in-line, so plug/socket contradict. Cause: Type L and Type M share one plug file (the M one). Affects 10 Type-L countries: Argentina, Chile, Ethiopia, Italy, Libya, Maldives, San Marino, Syria, Uruguay, Vatican City. (6 Type-M countries are correct.)

**3. Minor — Type A & Type B wall sockets use the same photo** (grounded US duplex). Correct for B; for A it shows ground holes it shouldn't (30 A + 26 B countries).

**4. Minor — Type O wall socket** (Thailand only) is a busy multi-hole combo outlet, not a clean single Type O.

**5. Type-listing error — Argentina** listed as C + I + L; authoritative sources list only C + I. Type L isn't standard there.

*All other plug/socket photos (D, E, G, H, I, J, K, M, N + A/B plugs + C–N sockets) and all other country type lists check out.*

---

## 🗺 Guides to Build

---

## 🪧 Index Subtitle Proposals

*Proposals to add a `dest-sub` line to an index card — the italic sub-line that surfaces a **non-obvious natural marquee** a guide covers (a major geological phenomenon, famous lake, or national/natural park reached as a day-trip that the city name doesn't telegraph — e.g. Ljubljana → "incl. Postojna Cave · Lake Bled"). Scope is natural features ONLY (caves, lakes, canyons, waterfalls, geysers, fjords, parks); never cathedrals, museums, palaces, or other obvious city sights. A crib never adds one on its own — it parks the proposal here, and adds the span only after Dani approves. Flow: proposal here → approved → crib adds `dest-sub` → item deleted. Full rule: `Brain/Reference/Ship Checklist.html` § 11. (Subtitles added 2026-06-12 at Dani's direction: Ljubljana → "incl. Postojna Cave · Lake Bled" [first use]; Zhangjiajie → "incl. Avatar 'Hallelujah' Mountains".)*

---

## 🔧 Rules for Update

*Only edits to files inside `Brain/CORE RULES/` get parked here — they require explicit approval before Claude touches them. Flow: proposal here → approved in same session → Claude applies the edit → item deleted. Everything outside `Brain/CORE RULES/` (Reference files, scripts, guides, Trips.html, to-do list, etc.) gets fixed immediately without asking or parking.*

*(All 27-file CORE RULES audit findings #1–19 closed 2026-06-05 — see `Brain/Reference/audit_log.md` for the record. Item #17's guide-side consequence — the Michelin backfill — completed 2026-06-05 and closed out 2026-06-06; record in the audit log. The 2026-06-06 CORE RULES audit's three parked proposals all closed same-day: #1 under Dani's toolbar-move authorization, #2 underline-ban re-homed to `Links.html § 8` and #3 Skip List source + decisions.md relabel both Dani-approved and applied — records in the audit log.)*


### 2026-06-17 — Core Rules audit (non-extra-section): validator-vs-rule contradictions (need decision) + validator backlog

*Full audit: `Travel/Core Rules Validator Audit — 2026-06-17.md`. Covers `Rules for Claude`, `Guide Structure`, `Day Structure`, `Trip Overview`, `Hotel Banner`, `Stops Structure`, `Motion Rule`, `Tickets`, `Icon Order and Format`, `Links`, `Photos Rules`.*

*All three validator-vs-rule contradictions RESOLVED 2026-06-17 (Dani-approved): (1) Trip Overview §3 pill label — doc line 62 fixed to `⛲️ Day Trips`, CORE RULES cascade run; (2) Links §3 — booking-URL 90-day staleness check removed from the validator (rule wins, a logged PASS never expires); (3) Photos Rules §5 step 7 + §9 — rewritten to download-only via `commons_photo.py --download` (validator wins), and the stale "hotlink permitted" language purged from Ship Checklist § 6, Rule Dependencies, and Separation Map.*

**Validator-code backlog (pure validator session, no rule decision needed):**
- Rules for Claude §6 placeholder check misses **bare** `TBD`/`TODO` (only `{braced}` caught globally + hotel-banner scope) and the literal phrases "fill in later" / "tour TBD" (no matcher). Add a body-wide scan next to validate_itinerary.py:8467.
- Day Structure §6/§7 train-day quota: 5+ day "must include" is only a suppressible `warn`; the ≤4-day "must NOT include" has no check at all (vacuous pass).
- Day Structure §5 ≥4-stop floor is a `warn`, not a hard fail.
- Motion Rule §1: metro (🚝) inline sub-line has no shape check (tram does); ferry (🚢) standalone banner shape unchecked; `_MOTION_LEAD_RE` omits 🚝/🚎.
- Trip Overview §4 text-transform ban regex only catches the exact `a, a:visited { text-transform: lowercase }` — misses uppercase/capitalize, bare `a`, and `*`/body-level cascades.
- Tickets: ticket-row **field order** (Title · ⭐ · reviews · platform) unchecked (only presence); §1 source waterfall unenforced (mostly behavioral).
- Links §4: TheFork named bot-blocked but no `thefork.com` URL pattern / no log-coverage (low severity — §4 defers to Platforms.md).
- Hotel Banner §1 "no postal code" only caught when a comma is present and no middle-dot (`Calle Mayor · 28013 Madrid` passes).

*Confirmed CORRECT (no action): Icon Order (all formats + tilde carve-out), Guide Structure (incl. the inter-section order the Icon Order doc lists), Hotel Banner middle-dot leniency (intended, resolved 2026-06-15), money/hedging/date/on-demand-leak bans, Stops Structure box shape, Links/Photos shape. Live URL-health + h1 subject-drift correctly live in verify_urls.py / verify_booking_links.py.*

### 2026-06-12 — Mobile baseline — FULLY CLOSED

*DONE & confirmed by Dani: `Guides/mobile.css` (universal defensive baseline) + `Brain/scripts/mobile_check.py` (audit + `--apply` injector + `--strict` gate) + defensive overflow guards in `Brain/Reference/Guide Style.css` → synced to `guide_v3.css`. **Wired into the session:** `guide_tools.py start` runs mobile-check as Step 3/4; `guide_tools.py ship` hard-gates on `mobile-check --strict` after the pin gate. **CORE RULES updated** — `Rules for Claude.html` step-1 enumeration names mobile-check; cascade worked clean (checksum CHANGED(1) `Rules for Claude.html` only; `format_version.json` unchanged; doc_workshop_validator 27/27; brain_check 54/54). Documented in `CLAUDE.md` (ritual + Validators table + DriftyCat) and `Ship Checklist.html` § 10.*

***LOCKED DECISION (Dani, 2026-06-12):** new guides do NOT link `mobile.css` — guides use `guide_v3.css` only (already carries the same overflow guards); all other shareable pages use `mobile.css`. One source of truth per surface. No further action.*

### 2026-06-06 — CORE RULES cross-check — ALL 25 ITEMS CLOSED

*(All findings approved by Dani and applied same-day, one approval cycle each — full records in `Brain/Reference/audit_log.md`. Final batch: #4 ship-gate standing order now checks Phase 6; #9–18 drift fixes; #21 Train Day destination never repeats in Day Trips by Train; #24 stop templates gained 📒/📖/photo rows; #25 file renamed to `Skip List - Extra Section.html` with validator map + all build_state.md files updated. Convention locked the same day: rule cross-references name the file only, never the § number; "→ hotel" on hotel-scoped extras motion rows is a soft-grey note hint, never shipped guide text.)*

---

## ❓ Open Questions

*Only questions concerning fixes or edits to `Brain/CORE RULES/` files park here — every other gap is resolved in-session with Claude's own tools (Rules for Claude.html § 3, applied 2026-06-06).*

<!-- Resolved 2026-06-13: "CORE RULES checksum drift — 4 files unstamped (flagged 2026-06-12)" — Cappuccino / Michelin Restaurants / Motion Rule / Restaurants Near Hotel now match core_rules_checksums.json (validator: SHA-256 matches for all 27 CORE RULES files). Closed by Dani. -->
<!-- Resolved 2026-06-15: "Hotel Banner §1 mandates a street number — but some hotels have none (UAE guide)." Decision by Dani: §1 updated to allow street name · neighborhood when no street number is published. validate_itinerary.py updated: passes if digit present OR · present; fails only on bare street name alone. format_version.json bumped → fp e59f9c9f0bcc68c5. UAE guide (Address Downtown) can now re-ship. -->

