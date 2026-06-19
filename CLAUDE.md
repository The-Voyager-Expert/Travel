# Travel — entry point for Claude

---

## ⚡ READ THIS FIRST — NO ASKING, EVER

**🔑 Three non-negotiables — every session, from the very start:**

1. **Connected?** Before anything else, confirm the Drive is mounted — the mounted `Travel/` path must be reachable with the Read tool (this file loading is the first proof). If it's unreachable (folder not connected), **STOP and ask in one line right away** — *"The Travel folder isn't connected this session — connect it and I'll pick up."* Don't start the ritual, don't build, don't create files. This is the one blocker that always pauses for a one-line ask; it is flagging a hard blocker, not permission-asking. (Full rule: `Rules for Claude.html § 1` Step 0.)
2. **Edit in place.** To change a file that already exists, use the Edit/Write tool on its mounted path. NEVER use Drive MCP `create_file`/upload on an existing file — it spawns a `Name (1).ext` duplicate and the edit is lost (this lost two cribs). `create_file` is for genuinely new files only. (Full rule: `Rules for Claude.html § 2`.)
3. **Archive, never delete.** "delete / remove / clean up / get rid of" = move to `Travel/archive/`. Never `rm`, never permanent-delete — applies to Claude's own mistake files too. (Full rule: `Rules for Claude.html § 2`.)

**All tool use is pre-authorized for the entire session.**
Web searches, URL fetches on any domain, Wikipedia, Wikimedia Commons, Chrome MCP, any connector (Viator, TripAdvisor, Booking, Resy, StubHub, Expedia, any), file reads, script runs — execute immediately. Never ask, never confirm, never announce intent and wait for a reply. No URL requires per-site authorization. **Exactly two things get a one-line message** (plain text, never the AskUserQuestion popup): (a) the Drive isn't connected — ask to connect it before doing anything (see Three non-negotiables above); (b) a destructive irreversible action on a non-build file — a one-line confirm. Nothing else pauses.

**Guide builds require zero clarification.**
When asked to build a guide, all requirements are fully specified in the Brain files. Begin immediately. Run the full build — ritual → reads → research → build → validate → ship — without stopping. Never wait for confirmation.

**Guide builds — HARD GATE: zero HTML before reads.**
Before writing a single line of guide HTML, read in order:
1. `Brain/CORE RULES/Rules for Claude.html`
2. `Brain/CORE RULES/Guide Structure.html`
3. All Phase 1–2 files listed in the Guide build phases section below

Then run: `python3 Brain/scripts/guide_tools.py preflight <City>` — must exit 0 before any HTML is written.

The format lives in `Brain/CORE RULES/` — never in memory, never in past guides. Writing HTML before these reads = wrong format. Self-diagnostic: HTML exists and Phase 0–2 boxes are unchecked in `_build/build_state.md` → stop, delete the HTML, do the reads, re-run preflight, restart from scratch.

**These phrases are banned. Any of these in a draft = stop, delete, act instead:**
- "Want me to…" / "Should I…" / "Shall I…"
- "Would you like me to…" / "Do you want me to…"
- "Let me know if you want me to…"
- "Happy to… if you'd like" / "I can… if that helps"
- "Just say the word and I'll…" / "Ready when you are"
- "Want me to fetch the rules doc?" / "Should I read the brain first?"

**Three moves replace permission-asking:**
1. Do it and announce briefly — "Reading Platforms.md…" then do it.
2. Surface a real fork — "Two paths: A keeps X, B drops it. Which?" (expects a choice, not "yes")
3. Confirm destructive/irreversible only — "About to publish X — confirm?"

**Self-diagnostic:** banned phrase in draft = violation. Delete it. Take the action.

---

## Source of truth

`Brain/CORE RULES/Rules for Claude.html` — governs everything. When this file and Rules for Claude.html disagree, Rules for Claude.html wins. Read it at every session start with the `Read` tool directly — no Drive MCP, no doc_id.

**Google Drive is the ONLY source for rules and guides.** Never fetch `dbellinello.github.io` or any GitHub URL for rules, guides, or structure — the GitHub copies are not the source of truth and fetching them triggers permission pop-ups. GitHub is accessed only when Dani explicitly requests it in the current message.

---

## Session ritual

Runs before the first response, every session. Auto-authorized — no asking.

1. `python3 Brain/scripts/guide_tools.py start` — runs brain-check + sweep-stray + mobile-check (audit) + surfaces open To Do items. On brain-check failures: fix before any task work. On strays: run `--apply` automatically, note in opening message. On mobile-check misses (a shareable page missing the viewport tag or `assets/mobile.css` baseline): run `python3 Brain/scripts/mobile_check.py --apply` automatically, note in opening message.
2. Read `Brain/Reference/Brain.md`
3. Read `Brain/CORE RULES/Rules for Claude.html`
4. Check `Brain/Reference/Platforms.md` — note any ❌ or ⏳ in opening message, do not block
5. Read `Brain/Reference/Connectors.html` — know what's available, do not announce or prompt
6. Check `Brain/Reference/audit_log.md` — if last entry > 7 days ago, note in opening message: "Last audit: {date} ({N} days ago) — run `guide_tools.py audit` when convenient." Continue immediately.

---

## Routing

| Task | Go to |
|------|-------|
| Build a guide | CLAUDE.md § Guide build phases — Phase 0–2 reads first, then preflight, then build |
| Trip data update | `Travel-Website/Trip Essentials/Trips.html` — read `Travel-Website/Trip Essentials/Trips - Rules.md` first |
| Flights / hotels / rentals / weather | Read matching file in `Travel/On Demand/` first |
| Shopping request | Read `Travel/shopping_profile_v2.md` first |
| URL failure in a build | `Brain/CORE RULES/Links.html` |
| PDF rendering | `Brain/Reference/PDF Render Notes.md` |
| Connector capabilities | `Brain/Reference/Connectors.html` |
| Validator work | Read `Rules for Claude.html § 4` before touching anything |

**File location:** all Cowork files stay inside `Travel/`. Mobile surface files in `Travel/On The Go/`.
**Archive:** never `rm`. Move to `Travel/archive/`. Always. Pre-authorized — no asking.
**CORE RULES:** never edit `Brain/CORE RULES/` without explicit per-session approval.
**Guides/:** frozen. Never read, grep, or reference any file there unless explicitly named.
**Connectors:** already configured. Do not prompt to connect, suggest connectors, or search the registry.
**Vocabulary:** when the user says "the HTML," "fix the {name} HTML" → means `Brain/CORE RULES/{name}.html`.

---

## Guide build phases

Full spec in `Brain/CORE RULES/Guide Structure.html`. **Do not write a single line of HTML before Phase 0–2 reads are done. Run `Brain/scripts/guide_tools.py preflight <City>` — must exit 0 before first HTML line.**

**First action of any build — create the build-state tracker:**
`python3 Brain/scripts/guide_tools.py init <City>` — creates `Travel-Website/Guides/{City}/_build/build_state.md` with all Phase 0–6 checkboxes unchecked. Flip each to `[x]` when read or completed. The validator and ship gate read this file — an unchecked Phase 6 = not shipped.

- **Phase 0** — `Rules for Claude.html` (session-start read — always done first)
- **Phase 1** — `Links.html` · `Photos Rules.html` · `Brain/Reference/Connectors.html` · `Brain/Reference/Platforms.md`
- **Phase 2** — `Guide Structure.html` · `Stops Structure.html` · `Hotel Banner.html` · `Trip Overview.html` · `Brain/Reference/Toolbar.html` · `Brain/Reference/Navigation.html`
- **Phase 3** — `Day Structure.html` (before locking any day)
- **Phase 4** — `Tickets.html` · `Motion Rule.html` · `Icon Order and Format.html` (per stop)
- **Phase 5** — matching `*Extra Section*.html` · `Motion Rule.html` + `Icon Order and Format.html` when the section has walk/ride rows (re-read at start of each Extra Section build)
- **Phase 6** — `Brain/Reference/Ship Checklist.html` · validator 0 failures · ship gate

**City name only** → look in `Trips.html`, use hotel + dates there.
**City + day count** → skip Trips.html, run hotel research, build for stated day count.
Dates never ship in a guide. Always Day 1 / Day 2 / Day N. Never ask for dates.

---

## Research workflow — follow this order, every build

**Before researching anything** — Phase 1 reads must be done: `Links.html` · `Photos Rules.html` · `Brain/Reference/Connectors.html` · `Brain/Reference/Platforms.md`. These define the tools and rules. Skipping them = building without a method.

**Tours (always MCP first — never start with web search):**
1. Viator MCP: `search_experiences` → `get_experience_details`. This is always step 1.
2. GetYourGuide: `site:getyourguide.com {city} {attraction} tour` (no MCP connector exists)
3. TripAdvisor MCP: `search_experiences`
- Bar: 4.5+★ · ≥6 reviews. Full rules in `Tours - Extra Section.html`.

**Photos (Wikimedia Commons only — one source, one method):**
1. Find the filename: WebSearch `site:commons.wikimedia.org {stop name} {city}`
2. Resolve the URL: `python3 Brain/scripts/commons_photo.py "File:{filename}"`
3. Never direct-fetch commons.wikimedia.org — it's blocked. Never use Google Images or Unsplash.

**Links and verification:**
- Every URL live-verified before it ships — including every edit inside a session.
- Platforms marked ⚡ or ❌ in `Platforms.md`: skip web_fetch entirely → `site:{domain}` WebSearch.
- When web_fetch fails on anything else → Chrome MCP (`navigate` + `get_page_text`) immediately.
- Never ask "may I access {domain}?" — pre-authorized, execute.

**Stop research (trusted sources only):**
- Wikipedia (`en.wikipedia.org`) · Fodor's · Culture Trip · Rick Steves · National Geographic Travel · Rough Guides · Atlas Obscura · official tourism boards
- No random blogs, no affiliate lists, no AI-generated SEO content, no content farms — regardless of Google ranking.
- Check `Brain/Reference/Brain.md` for the city before picking any stop.

---

## Behavioral rules

Full detail in `Brain/CORE RULES/Rules for Claude.html` § 3. The short version is at the top of this file. Key points:

- No preamble, no option menus, no pop-up questions. Pick what the rules point to and move.
- Decisive over hesitant. When the task scope is clear, run end-to-end.
- No permission-asking on already-authorized actions. Do it and announce briefly.
- Connector usage stays authorized across the session — no re-asking on every action.
- "Delete" / "remove" / "clean up" = ARCHIVE. Move to `Travel/archive/`. Never `rm`.

---

## ⚠️ DriftyCat — things that keep breaking

One-line tripwires. Full rule for each in its CORE RULES HTML file.

- ⚠️ **Preflight before first HTML — no exceptions.** Run `python3 Brain/scripts/guide_tools.py preflight <City>` before writing any guide HTML. Non-zero exit = unchecked Phase 0–2 reads. Complete them, re-run, proceed only on exit 0. Full rule: CLAUDE.md § Guide build phases.
- ⚠️ **Working-surface drift = fix immediately, no approval.** Any file outside `Brain/CORE RULES/` that drifts from a CORE RULES rule — fix it in the same pass. CORE RULES is always the authority; working-surface files follow. No questions, no parking. Full rule: `Rules for Claude.html § 3`.
- ⚠️ **After any CORE RULES approval — work the cascade before announcing done.** Read `Brain/Reference/Change Cascade.html`, work every ✅ step for that change type, regenerate checksums, run doc_workshop_validator. A CORE RULES change without its cascade is half-done. Full rule: `Rules for Claude.html § 3 + § 5`.
- ⚠️ **Website change = fire the cascade too — not only CORE RULES edits.** A new tab/page/feature wired into the site or `assets/toolbar.js`, or any change to the navigation structure, fires the **🔗 New page added to toolbar** / **🧭 Navigation structure changed** cascade in `Brain/Reference/Change Cascade.html` — bring `Toolbar.html`, `Navigation.html`, `guides_index.html` (if a guide), and `Brain.md` Part 1 back into parity in the same pass. This holds even when a tab/feature was added directly outside a build: the moment the live site has something the reference docs don't describe, that's drift — fix it, don't wait to be told. `brain_check` flags toolbar pages missing from `Brain.md` Part 1 (warn). Full rule: `Rules for Claude.html § 3` + `Change Cascade.html`.
- ⚠️ **No AskUserQuestion — ever.** The Cowork popup is never invoked for any Travel task. Start immediately. Full rule: `Rules for Claude.html § 4`.
- ⚠️ **Never fetch GitHub for rules/guides.** `dbellinello.github.io` and all GitHub URLs are off-limits unless Dani explicitly asks in the current message. All rules and guides live in Drive — `Brain/CORE RULES/` and `Travel/`.
- ⚠️ **Make the call — only CORE RULES fix/edit questions park.** Every gap Claude's tools can resolve (connector, search, fetch, live browser reads including script reads on pages that never settle, operator sites) is resolved in the same session. `❓ Open Questions` holds only questions concerning `Brain/CORE RULES/` fixes and edits. Full rule: `Rules for Claude.html § 3`.
- ⚠️ **Tour-first always.** Viator MCP → GYG → TripAdvisor before venue site. Bar: 4.5+★ · ≥6 reviews.
- ⚠️ **Zero money in shipped guides.** No `$` `€` `£` `¥` or ISO codes — ever.
- ⚠️ **Tilde has one home — `⏰`.** `~` is valid only as the `⏰` Avg Time Spent prefix (`⏰ ~1 hr`). Never on `⏳` Duration (exact: `⏳ 45 min`), never on walk/ride/start/travel-time, never in prose. One carve-out, no others. Full rule: `Icon Order and Format.html` § 2.
- ⚠️ **No fabrication.** Every fact live-verified this build. Memory from past builds is not a source.
- ⚠️ **No placeholders.** `{TBD}` / `{TODO}` / "fill in later" = fabrication.
- ⚠️ **Every link live-verified — every time.** Including every edit inside a session.
- ⚠️ **Photos in same pass as stop research.** Never deferred.
- ⚠️ **Wide wins over detail (stop photos).** Facade > interior. Wide > close-up.
- ⚠️ **Icon format — read the canonical file.** `Icon Order and Format.html` before any stop box.
- ⚠️ **Validator before "done" — every scope.** Any session touching guide HTML runs validator to 0 failures. Scope of change is not an exemption.
- ⚠️ **Validator check before any guide fix.** Write the check first; fix the guide after.
- ⚠️ **Don't read past guides — they breed drift.** `Guides/` is output, not reference or format template. Old guides are frozen point-in-time builds, valid only under the brain that shipped them — so they are stale-by-design the moment a rule changes. Opening one as a template imports its drift into the new guide: one stale guide becomes many. Format comes from `Brain/CORE RULES/`, content from live research. Only open a guide file when editing that exact guide or wiring the index/chain/map pins (the named carve-outs). Full rule: `Rules for Claude.html § 6` (Don't read past guides).
- ⚠️ **No hedging in factual rows.** "typically open" / "usually takes" / "approximately" = banned. Look it up or omit.
- ⚠️ **🚕 ride time = mapping-service driving mode** (Google or Apple Maps; a local mapping service where neither covers the region — Motion Rule § 1). No ride-share APIs, no estimators.
- ⚠️ **One archive — `Travel/archive/` only.** Never create a subfolder archive anywhere else.
- ⚠️ **Archive loop — editing ≠ archiving.** Editing an existing file in place never triggers an archive step. Archive fires only when a new versioned file is created to replace an old one (e.g. `paris_v8.html` replacing `paris_v7.html`). Self-diagnostic: if the next action after `mv … Travel/archive/` is editing a file with the same name — stop. Just edit the original. Full rule: `Rules for Claude.html § 6`.
- ⚠️ **Edit in place — NEVER create a new file to change an existing one.** To change any existing Drive file, use the `Edit`/`Write` file tools on that file's exact mounted path. NEVER use the Google Drive connector's `create_file`/upload to modify a file that already exists — it produces a duplicate named `Name (1).ext` and the real edit is lost. NEVER write updated content to an `outputs/`/scratchpad temp file and pull it in via an include (`<?python open('/sessions/.../mnt/outputs/…') ?>`) — the temp dies with the session and strands the content. Self-diagnostic: a `Name (1).ext` sibling appeared, or a file's byte size didn't change after an edit = the in-place edit failed. Archive the `(1)` stub to `Travel/archive/`, then redo the edit directly on the original path. The Drive folder is mounted every session; the mounted path is always the write target.
- ⚠️ **"Updated" stamp = content currency, not format currency.** Every city guide shows "Updated Month Year" at the bottom, injected by `toolbar.js` using `document.lastModified` (the guide HTML file's own mtime). Content changes (editing any stop, restaurant, or text in the guide HTML) update the mtime automatically — stamp is accurate with zero extra work. Format changes (`guide_v3.css`, `toolbar.js`, or any shared asset) do NOT touch the guide HTML — stamp stays at the prior content date. This is intentional. Never touch a guide HTML file solely to bump the stamp after a CSS or toolbar change. Full spec: `Brain/Reference/Toolbar.html § 10`.
- ⚠️ **`guide_v3.css` stays in sync with `Brain/Reference/Guide Style.css`.** Edit `Guide Style.css` (source of truth), then run `python3 Brain/scripts/guide_tools.py sync-css` to copy it to `Travel-Website/assets/guide_v3.css` — never edit `guide_v3.css` directly. Every guide HTML loads `../../assets/guide_v3.css` (GitHub Pages can't reach Brain/). Full rule: `Rules for Claude.html § 4`; cascade: `Brain/Reference/Change Cascade.html` § CSS rule changed.
- ⚠️ **Mobile baseline — every shareable page carries it.** Any new or edited user-facing page (site home `index.html`, guides index, Trip Essentials, Maps, On The Go) needs the `<meta name="viewport">` tag and a link to `Travel-Website/assets/mobile.css` (the universal defensive baseline — kills horizontal overflow, caps tables/images, sane tap targets). Don't hand-roll per-page `@media` blocks. Run `python3 Brain/scripts/mobile_check.py --apply` — it injects both at the correct relative depth, idempotently. Surfaced at session start (Step 3/4) and hard-gated at ship (`--strict`). Edit the baseline once in `Travel-Website/assets/mobile.css`; every page updates. Guides themselves are covered by the defensive block in `guide_v3.css` — never edited per-guide (LOCKED 2026-06-12: new guides link `guide_v3.css` only, not `mobile.css`).
- ⚠️ **New main page = add to the Main Pages index, same pass.** Any page added to the toolbar `ITEMS` array in `Travel-Website/assets/toolbar.js` must also be added to `Travel-Website/Website Main Pages Links.html` — the Main Pages hub shared with friends — as a leaf with its live link. (`Travel-Website/index.html` is a redirect to guides_index.html, not the hub.) Toolbar and the Main Pages index must list the same set (Guides index is the one deliberate omission). Full rule: `Brain/Reference/Toolbar.html` § 4.
- ⚠️ **Shared assets live in `Travel-Website/assets/` — permanent.** `assets/toolbar.js` + `assets/footnote.js` + `assets/weather.js` + `assets/guide_v3.css` + `assets/mobile.css` + `assets/climate.json` (moved out of Guides/ in the 2026-06-13 reorg). Every page loads them from `assets/` at its own depth below the site root: site home `index.html` → `assets/toolbar.js`; depth-1 pages (guides_index, Trip Essentials) → `../assets/toolbar.js`; depth-2 pages (Guides/{City}, Trip Essentials/Maps, Plug Adapter) → `../../assets/toolbar.js`. brain_check fails on a stray copy at the Travel root or in Guides/. Full rule: `Brain/Reference/Toolbar.html` § 1–2.
- ⚠️ **guides_index.html — update on every ship, same pass.** Five steps: new card (with `data-status="want"`) + predecessor/successor data-guide-next/prev + counts + toolbar data-prev/data-next + map pin (see next rule). Also add city to `Brain/Reference/Status Dots — guides_index.md` as `[ ]` in the same pass. **Ship gate enforced (added 2026-06-15):** `guide_tools.py ship` hard-fails if the city is absent from Status Dots — guides_index.md (`_check_guide_in_status_dots`). Full rule: `Brain/Reference/Ship Checklist.html` § 11.
- ⚠️ **Flight-time view (guides_index "By flight time from Seattle") — validate after any FMAP or colour edit.** The `FMAP` data block carries each guide's stops + hub + time; its schema, the colour scheme, and the routing authority are documented in a comment right above `var FMAP`. Routing (stops + hub) must match `Trip Essentials/Delta Routes SEA.html` tiers; the dot (CSS `.fdot`), card border (JS `COL`), and Stops chip emoji must all be one colour family per routing. Adding a guide that ships needs a matching FMAP entry — **ship gate enforced (added 2026-06-15):** `guide_tools.py ship` hard-fails if the city has no FMAP entry (`_check_guide_fmap`). Run `python3 Brain/scripts/validate_flight_index.py` — must exit 0. Full check list: `Brain/Reference/Validator Index.html` § flight-time view.
- ⚠️ **Map pins — add on every ship, same pass.** Add pin to the matching region map in `Travel-Website/Trip Essentials/Maps/` (Europe / US / Asia / Africa / Oceania / South America / Caribbean — ship gate scans all seven). Entry format: `['CityName', lon, lat, '../../Guides/City/file.html']` in the `PINS` array (map files sit at depth-2, so the link climbs two levels to `Guides/`). Ship gate blocks if pin is missing.
- ⚠️ **Climate/Weather data — add the city on every ship, same pass.** Both `🌤️ Weather` toolbar tabs — **By Climate** (`Climate Finder.html`) and **By City** (`Trip Essentials/Weather.html`) — read `window.TravelClimate`, baked into `assets/weather.js` from `assets/climate.json`. A guide that ships without climate normals is invisible in BOTH tabs. After the map pin is added, run `python3 Brain/scripts/build_climate.py` (it reads the map pins to know which cities to fetch), then `python3 Brain/scripts/validate_climate_coverage.py` (exit 0). **Ship gate enforced (added 2026-06-15):** `guide_tools.py ship` hard-fails if the city is absent from `climate.json` or the `weather.js` baked block (`_check_guide_in_climate`).
- ⚠️ **Stats · Safety · Currency — add the city on every ship, same pass (ship gates added 2026-06-15).** When a guide finishes it must also land in three more pages, all enforced by `guide_tools.py ship` (hard-fail): **📊 Stats** (`Travel Stats.html` — auto-generated; the gate rebuilds via `build_travel_stats.py` then hard-validates with `validate_travel_stats.py`), **🛡️ Safety** (`Safety Guide.html` — **hardcoded/manual**; add the city's State-Dept-level row by hand — `validate_safety_guide.py` blocks if any guides_index city lacks exactly one row), and **💰 Currency** (`Currency Guide.html` — **per-country**; only if the guide adds a **new country**, add it to the `COUNTRIES` list in `Brain/scripts/build_currency.py` and run `build_currency.py` — `_check_guide_in_currency` blocks if the shipping city maps to no country). All four data-page gates (climate, safety, currency, stats) run in the same post-ship pass as the index card, map pin, status dots, and FMAP.
- ⚠️ **Punt-detection.** "I can't access Viator" / "ratings need manual lookup" = wrong. Run the tool. Chrome MCP bypasses bot-blocks.
- ⚠️ **No full EoI cards in Trip Overview day-card area.** Days-only grid. Compact nav pills permitted.
- ⚠️ **Day count in prompt = trip not in Trips.html.** "Amsterdam" → look in Trips.html. "Amsterdam, 4 days" → skip lookup, run hotel research.
- ⚠️ **Calendar hotel blocks — end = checkout + 1 day.** Google Calendar all-day events use exclusive end dates.
- ⚠️ **Resuming a build — read `build_state.md` first.** If Phase 6 unchecked, the guide is not done.
- ⚠️ **Never archive an incomplete guide build.** Any guide folder with a `_build/build_state.md` (Phase 6 unchecked, or no HTML yet) is a resumable build — NEVER archive, remove, delete, or "clean it up," even if it looks empty or stalled. A stalled crib is finished by another crib from `build_state.md`. There is no step that gets rid of incomplete guides. `guide_tools.py start` flags them as "maybe in progress — check later" — that flag is the only action. Archive one only on Dani's explicit per-case say-so. Full rule: `Rules for Claude.html § 2` (What does NOT trigger auto-archiving).
- ⚠️ **Index card subtitle (`dest-sub`) — gated, never autonomous.** A card's italic sub-line surfaces a *non-obvious natural marquee* a guide covers — caves, lakes, canyons, waterfalls, geysers, fjords, parks (e.g. Ljubljana → "incl. Postojna Cave · Lake Bled"). Especially valuable when the base-city name is unknown/not famous — you'd never guess from the index that an obscure city is the gateway to a major natural feature (the access town for the Grand Canyon, etc.). NEVER cathedrals, museums, palaces, or obvious city sights (= drift). A crib never adds one on its own judgement — it parks a proposal in `To Do List/To_Do_List.md` § 🪧 Index Subtitle Proposals and adds it only after owner approves. Full rule: `Brain/Reference/Ship Checklist.html` § 11.
- ⚠️ **No new files in `Brain/Reference/` without explicit permission.** Fixed set of 3 files: `Brain.md`, `Status Dots — guides_index.md`, `audit_log.md`.
- ⚠️ **Absence of rule = don't ship.** No rule authorizes it → it doesn't ship.
- ⚠️ **Agent prompts are mini-rules.** Every rule the agent's output must respect goes in the prompt.

---

## On-demand documents

Run only when explicitly asked. Output goes to `Travel-Website/Trip Essentials/Trips.html` — never auto-ships in a guide.

- `On Demand/Weather - On Demand.html`
- `On Demand/Delta - On Demand.html`
- `On Demand/Hotels & Rentals - On Demand.html`
- `On Demand/Car Rentals - On Demand.html`

---

## Shopping

When asked to find, buy, or research any product — read `Travel/shopping_profile_v2.md` before responding.

---

## Two-crib architecture

Two environments, same Drive workspace:

| | Cowork (desktop) | On The Go (mobile) |
|---|---|---|
| **Root folder** | `Travel/` | `Travel/On The Go/` |
| **Capabilities** | Full read/write/edit/archive | Read + add files only |
| **Entry point** | `Travel/CLAUDE.md` | `Travel/On The Go/Rules/on_the_go_rules_v27.md` |

---

## Quick Reference

### CORE RULES HTML file index

| File | Purpose |
|------|---------|
| `Rules for Claude.html` | Master behavior doc — session ritual, authority, task execution, build discipline, parking, DriftyCat, guide content prohibitions, on-demand docs, audit, close-out, calendar, format exceptions |
| `Guide Structure.html` | Section order, extra-section sequence, cross-link anchors, build phases, build-state tracker |
| `Day Structure.html` | Day-block shape, From-Hotel opener, stop count, route shape, trip length, train day quota and pattern |
| `Trip Overview.html` | Navigation card spec, day-order rule, extras pills with canonical labels |
| `Hotel Banner.html` | Hotel banner entry — city, hotel/rental name, street address and neighborhood |
| `Stops Structure.html` | Stop selection criteria, stop types, stop box format, train day pattern, discovery/curation rules |
| `Motion Rule.html` | Walk-vs-ride threshold, motion banner formats, day opener/closer (bookends), train day motion blocks |
| `Tickets.html` | Ticket waterfall format, ticket box format (no rating floor) |
| `Photos Rules.html` | Stop-type photo selection (§3a: structure=exterior, venue=interior, else=subject), Wikimedia Commons sourcing, licenses, harvest workflow |
| `Links.html` | Link verification, subject-drift check, verification log, bot-blocked platforms, Wikipedia spec, Google Maps spec |
| `Icon Order and Format.html` | Canonical icon reference — row order, format per icon, section header icons, train icons |
| `Skip List - Extra Section.html` | Footnote for already-visited venues — ships only when city has a skip list |
| `Tours - Extra Section.html` | Tours section — source pool, rating bar, per-source minimums, entry format |
| `Getting Around - Extra Section.html` | Getting around section — ride app, tram, metro, and ferry subsections (each with what-ships criteria and entry format) |
| `Weekly Closures - Extra Section.html` | Weekly closures — recurring patterns only |
| `Local Tastes - Extra Section.html` | Local tastes — city-specific only |
| `Food Delivery - Extra Section.html` | Food delivery — platform availability per city |
| `Michelin Restaurants - Extra Section.html` | Michelin section — stars-only source, tier ordering (⭐⭐⭐ first), hotel-in-building format variant |
| `Restaurants Near Hotel - Extra Section.html` | Restaurants near hotel section |
| `Cappuccino - Extra Section.html` | Cappuccino / coffee culture section |
| `Day Trips by Train - Extra Section.html` | Day trips by train — Train/Why/Book format |
| `Shows, Performances & Concerts - Extra Section.html` | Shows section — destination-level venues only (opera, concert halls, flagship residencies), entry format |
| `Train Stations Near Hotel - Extra Section.html` | Train stations — walk times, negative-finding line |
| `Pickleball - Extra Section.html` | Pickleball section |
| `Downtown Restaurants - Extra Section.html` | Historic downtown restaurants section |
| `Claude Inspiration - Extra Section.html` | Claude's inspiration note section |
| `Heads Up - Extra Section.html` | City-specific heads-up notes — sourced only from Brain.md Part 3; if city absent, section does not ship |

### Validators

| Script | Job |
|--------|-----|
| `guide_tools.py ship` | Single entry point — chains validate + verify + verify-booking + index + pin + status-dots + FMAP + climate (both Weather tabs) + safety + currency (new country) + stats (rebuild+validate) + mobile-check |
| `mobile_check.py` | Mobile baseline — every shareable page (home index.html, guides index, Trip Essentials, Maps) has the viewport tag + `assets/mobile.css`. `--apply` injects both; `--strict` exits 1 on any miss (ship gate + ritual) |
| `brain_check.py` | Brain integrity — required sections, required files, ghost references |
| `validate_itinerary.py` | Guide HTML static checks — structure, toolbar, stop format, extras sections, motion rule, build-state gate (no network) |
| `verify_urls.py` | Link health — every URL returns 200 + editorial prose |
| `verify_booking_links.py` | Subject drift — h1 match for accessible links · verification log coverage for bot-blocked platforms (Viator / GYG / Michelin) |
| `commons_photo.py` | Photo resolution — Commons URLs to 800px thumbs |
| `autofix_itinerary.py` | Guide auto-repair — rewrites mis-filed booking boxes |
| `sweep_stray_travel.py` | Stray-file enforcement |
| `doc_workshop_validator.py` | CORE RULES doc integrity — run after any CORE RULES change |
| `doc_workshop_fixer.py` | CORE RULES doc auto-repair |
| `update_core_rules_checksums.py` | Regenerate checksums after CORE RULES edits |
| `audit_all_guides.py` | Full audit across all shipped guides |
| `validate_travel_stats.py` | Travel Stats integrity — hero counts, split bar %, bucket list, frontier chips, all guide links. Flags drift from guides_index. Exit 0 = clean; exit 1 = stale (rerun `build_travel_stats.py`). **Auto-runs on ship** (best-effort, after build_travel_stats) |
| `validate_search_index.py` | Search index coverage — every guide on disk is indexed, no ghost entries, generated date not stale (>7 days warns). Exit 0 = clean; exit 1 = gaps (rerun `build_search_index.py`) |
| `validate_climate_coverage.py` | Climate coverage — every map-pinned city in climate.json, no error flags, weather.js baked block in sync, all monthly arrays complete. Exit 0 = clean; exit 1 = gaps (rerun `build_climate.py`) |
| `validate_safety_guide.py` | Safety Guide coverage — every guides_index city has exactly one row, no duplicates, no stale rows, all hrefs resolve. Safety Guide is **hardcoded** — update manually when guides are added/removed/renamed or State Dept levels change. Exit 0 = clean; exit 1 = drift |
| `build_travel_stats.py` | Travel Stats — regenerates `Trip Essentials/Travel Stats.html` from `Guides/guides_index.html` FMAP + dest-card data (been/want counts, region breakdown, flight stats, bucket list). Auto-runs as a best-effort post-step in `guide_tools.py ship`; run manually after any been/want status change |
| `build_climate.py` | Climate data — fetches Open-Meteo historical normals for every map-pinned city, regenerates `assets/climate.json` + updates baked `CLIMATE` block in `assets/weather.js` and `Trip Essentials/Trips.html`. **Manual-only** (API calls, slow). Run after new cities are added to maps. Pre-seed `/tmp/climate_raw.json` from `climate.json` to limit to new cities only |
| `build_currency.py` | Currency Guide — fetches live USD rates, regenerates `Trip Essentials/Currency Guide.html` (monthly refresh). Static country→currency map lives in-script |
| `validate_currency.py` | Currency Guide integrity — country set matches the guide index exactly (no more/less), "Last update {Mon Year}" pill present and not stale |
| `render_pdf.py` | PDF render — headless Chromium (on-demand only) |
| `validate_pdf.py` | PDF integrity (on-demand only) |
| `audit_transit_dupes.py` | From-hotel transit-time duplicate **surfacer** (advisory — never a ship gate). Groups `🚶 N · 🚕 M` from-hotel rows by identical time, flags any where one time hits ≥ N distinct 📍 pins (default 4; `--min 3` widens). Surfaces placeholder-paste suspects for manual/map confirmation — CANNOT hard-fail (text, not geography; real shared points are indistinguishable from pastes). Run on demand or in the audit pass |
| `validate_flight_index.py` | guides_index "By flight time from Seattle" view — FMAP schema, routing (stops + hub) matches `Trip Essentials/Delta Routes SEA.html` tiers, and the dot / card-border / Stops-chip colours stay one consistent family per routing. Run after any edit to the FMAP or the flight-view colours. |
