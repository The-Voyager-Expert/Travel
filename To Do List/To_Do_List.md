# To Do List

> One file. Three sections. Everything lives here — no separate rule-update file. Resolved items get deleted (no strikethrough).

---

## ✈️ My Tasks

*Private tasks — bookings, flights, hotels, research, logistics.*

### 2026-06-15 — Register Travel Cowork artifacts (BLOCKED — must run from the Cowork crib)

*Files are written and present at `Travel/Artifacts/` (verified 2026-06-21): `guide_index_day_actions_panel.html` → id `guide-index` (day counts load from `guide_days.json`); `travel-planner.html` → id `travel-planner` (trips load live from Drive). Both register with mcp_tools `["mcp__c9c414e0-9fa7-4ae9-9b0b-ddc88a9094c9__download_file_content"]`. **Standing blocker:** registration needs the Cowork `create_artifact` MCP backend — the desktop Claude Code crib does NOT expose it (only DesignSync is present); it cannot register artifacts. The 2026-06-15 "backend down" outage is moot now — the live constraint is the environment. To finish: open this from the **Cowork (web) crib**, copy each HTML into the local outputs/scratch dir, pass that path as `html_path` (throwaway test artifact first). Do NOT edit the files, only register. Delete this item once both are pinned.*

---

## 🗺 Guides to Build

### All guides must pass the validator to be pushed live

Every guide has to run the real validator (`validate_itinerary.py`) and pass to be allowed live. A guide that fails is held back automatically until it's fixed — including old guides that a rule change made non-compliant. No guide is served on a stamp alone. Enforced on every deploy by `.github/workflows/deploy-pages.yml` (`VALIDATE_ALL`).

---

### 2026-06-27 — Validator sweep across 185 guides (15 buckets)

**What to Do:**
- **Run the validator** on every guide in your bucket: `python3 Brain/scripts/validate_itinerary.py Travel-Website/Guides/<City>/guide_v*.html`
- **Fix all the problems** found by the validator without asking — use `autofix_itinerary.py` for auto-fixable issues
- **Push live** to main: commit changes and push after your bucket is complete
- **Track progress**: check off each guide as it passes validation (exit 0)

**Execution:**
1. For each guide in your assigned bucket, run the validator
2. Read the output — note every failure
3. Apply fixes using available repair tools or manual edits in the HTML
4. Re-run validator until it passes (exit 0)
5. Once all guides in bucket pass, commit: `git add Travel-Website/Guides/<YourCityFolders> && git commit -m "Validator sweep: fix all issues in Bucket X" && git push`
6. Check off the guide in the to-do list
7. **Verify live**: After push completes, check that guides appear live at `https://the-voyager-expert.github.io/Travel/Travel-Website/Guides/<City>/guide_v*.html` — paste the clickable link here when confirmed

**Distribution:** 15 cribs, ~12-13 guides each

**Bucket 1 — 12 guides (validate, fix, push):**
1. - [x] Abu Dhabi
2. - [x] Aix-en-Provence
3. - [x] Alaska
4. - [x] Alesund
5. - [x] Amalfi
6. - [x] Amsterdam
7. - [x] Annecy
8. - [x] Arenal
9. - [x] Aruba
10. - [x] Athens
11. - [x] Atlanta
12. - [x] Austin

**Bucket 2 — 12 guides (validate, fix, push):**
13. - [ ] Azores
14. - [ ] Bahamas
15. - [ ] Bali
16. - [ ] Bangkok
17. - [ ] Barbados
18. - [ ] Barcelona
19. - [ ] Beijing
20. - [ ] Bend
21. - [ ] Bergen
22. - [ ] Berlin
23. - [ ] Big Island
24. - [ ] Bologna

**Bucket 3 — 12 guides (validate, fix, push):**
25. - [x] Bordeaux
26. - [x] Boston
27. - [x] Boulder
28. - [x] Bruges
29. - [x] Brussels
30. - [x] Budapest
31. - [x] Buenos Aires
32. - [x] Cairo
33. - [x] Cambridge
34. - [x] Cannes
35. - [x] Cape Cod
36. - [x] Capri

**Bucket 4 — 12 guides (validate, fix, push):**
37. - [x] Carmel-by-the-Sea
38. - [x] Cascais
39. - [x] Cayman Islands
40. - [x] Charlotte
41. - [x] Chiang Mai
42. - [x] Chicago
43. - [x] Chongqing
44. - [x] Cinque Terre
45. - [x] Colmar
46. - [x] Colombo
47. - [x] Columbia
48. - [x] Copenhagen

**Bucket 5 — 12 guides (validate, fix, push):**
49. - [x] Corfu
50. - [x] Curacao
51. - [x] Cusco
52. - [x] Dallas
53. - [x] Denver
54. - [x] Dubai
55. - [x] Dublin
56. - [x] Dubrovnik
57. - [x] Edinburgh
58. - [x] Florence
59. - [ ] Florida Keys
60. - [x] Geneva

**Bucket 6 — 12 guides (validate, fix, push):**
61. - [x] Glacier National Park
62. - [x] Glasgow
63. - [x] Gothenburg
64. - [x] Hamburg
65. - [x] Helsinki
66. - [x] Hong Kong
67. - [x] Istanbul
68. - [x] Kauai
69. - [x] KeyWest
70. - [x] Kyoto
71. - [x] La Jolla
72. - [x] Lagos

**Bucket 7 — 12 guides (validate, fix, push):**
73. - [x] Lake Como
74. - [ ] Lake Tahoe
75. - [x] Las Vegas
76. - [x] Lille
77. - [x] Lima
78. - [x] Lisbon
79. - [x] Ljubljana
80. - [x] London
81. - [x] Los Angeles
82. - [x] Lucerne
83. - [x] Luxembourg
84. - [x] Lyon

**Bucket 8 — 12 guides (validate, fix, push):**
85. - [x] MachuPicchu
86. - [x] Madeira
87. - [x] Madrid
88. - [x] Malibu
89. - [ ] Manuel Antonio
90. - [x] Marktoberdorf
91. - [x] Marrakech
92. - [x] Marseille
93. - [x] Maui
94. - [x] Melbourne
95. - [x] Miami
96. - [x] Milan

**Bucket 9 — 12 guides (validate, fix, push):**
97. - [x] Monaco
98. - [x] Montevideo
99. - [x] Montreal
100. - [x] Munich
101. - [x] Mykonos
102. - [x] Napa
103. - [x] Naples
104. - [x] Naples Florida
105. - [x] Nashville
106. - [x] New Orleans
107. - [x] New York
108. - [x] Nice

**Bucket 10 — 12 guides (validate, fix, push):**
109. - [x] Oahu
110. - [x] Orcas Island
111. - [x] Orlando
112. - [x] Oslo
113. - [x] Oxford
114. - [x] Palawan
115. - [x] Palm Desert
116. - [x] Palo Alto
117. - [x] Paris
118. - [x] Pasadena
119. - [x] Pensacola
120. - [x] Petra

**Bucket 11 — 13 guides (validate, fix, push):**
121. - [x] Philadelphia
122. - [x] Phoenix
123. - [x] Phuket
124. - [x] Pisa
125. - [x] Portland
126. - [x] Porto
127. - [x] Prague
128. - [x] Puerto Rico
129. - [x] Quebec City
130. - [x] Queenstown
131. - [x] Reykjavik
132. - [x] Rio de Janeiro
133. - [x] Rome

**Bucket 12 — 13 guides (validate, fix, push):**
134. - [x] Salvador
135. - [x] Salzburg
136. - [x] San Diego
137. - [x] San Francisco
138. - [x] San Jose
139. - [x] San Jose Costa Rica
140. - [x] San Juan Island
141. - [x] San Sebastian
142. - [x] San-Jose-Costa-Rica
143. - [x] Santa Barbara
144. - [x] Santa Cruz
145. - [x] Santa Monica
146. - [x] Santiago

**Bucket 13 — 13 guides (validate, fix, push):**
147. - [x] Santorini
148. - [x] Sarasota
149. - [x] Scottsdale
150. - [x] Seattle
151. - [x] Sedona
152. - [x] Sedona --regenerate
153. - [x] Seoul
154. - [x] Seville
155. - [x] Shanghai
156. - [x] Siena
157. - [x] Singapore
158. - [x] Sint Maarten
159. - [x] Sintra

**Bucket 14 — 13 guides (validate, fix, push):**
160. - [x] Sorrento
161. - [x] Split
162. - [x] Stockholm
163. - [x] Strasbourg
164. - [x] Stuttgart
165. - [x] Sydney
166. - [x] Taipei
167. - [x] Tallinn
168. - [x] Tokyo
169. - [x] Toledo
170. - [x] Toronto
171. - [x] Tromso
172. - [x] Turin

**Bucket 15 — 13 guides (validate, fix, push):**
173. - [ ] Turks and Caicos
174. - [ ] Vancouver
175. - [ ] Venice
176. - [ ] Verona
177. - [ ] Victoria
178. - [ ] Vienna
179. - [ ] Virgin Islands
180. - [ ] Washington DC
181. - [ ] Wellington
182. - [ ] Whistler
183. - [ ] Yellowstone
184. - [ ] Zhangjiajie
185. - [ ] Zurich

## 🔧 Ride-app format — 5 guides deferred (2026-07-05)

*New validator checks landed 2026-07-05 (Getting Around §1b: one operator per 🚕 entry + heading names the operator). 52 drifted guides were normalized to per-app format the same session. These 5 also carry an **unrelated pre-existing failure** that needs research/content work, so their ride-app fix was reverted (left at their shipped, validly-stamped state) to keep that fix out of scope. Each needs BOTH fixes in one pass:*

- [ ] **Kraków** — ride apps still `🚕 Ride Apps → Bolt · Uber` (split to `🚕 Bolt` / `🚕 Uber`) **+** 9 `🎟` ticket rows put domain/platform before the rating (reorder so `🎟 {Title} · {N.N⭐} · {Platform}`; no domain/note left of ⭐).
- [ ] **Corfu** — ride apps `🚕 Ride Apps → Uber` → `🚕 Uber` **+** 3 tour `⏳ Full day` → exact number-led durations (research each Viator tour's real length).
- [ ] **Prague** — ride apps `🚕 Ride Apps → Bolt · Uber` → split **+** 1 tour `⏳ Full day` → exact duration.
- [ ] **Malibu** — ride apps `🚕 Ride Apps → uber.com · lyft.com` → `🚕 Uber` / `🚕 Lyft` **+** Pickleball (Malibu Bluffs Park, Reed Park) entries have `🚕` drive time — confirm all entries have `🚕` and optionally `🚶` if walkable (rule changed 2026-07-06: drive is required, walk is optional).
- [ ] **San-Jose** — ride apps `🚕 Ride Apps → uber.com` → `🚕 Uber` **+** Pickleball entries — confirm all have `🚕` drive time (rule changed 2026-07-06: drive required, walk optional).
- [ ] **San-Jose-Costa-Rica** — 2 validator failures: (1) Days 4/5/6 have 3/2/3 stops (below the ≥4 floor) — add missing stops; (2) 5 stops have `.ticket-box` without leading `🎟️` (Mistico Hanging Bridges · La Fortuna Waterfall · Monteverde Cloud Forest · Selvatura Park · Lankester Botanical Garden) — add ticket/booking row or convert to tour-box.


---

## 🏓 Pickleball T5 — US guide rebuild (2026-07-06)

*Rule expanded 2026-07-06 (Dani-approved): Pickleball section now required for ALL US guides (was CA/AZ/OR only). Rule also changed from 25 min walk to 25 min drive. Every US guide without a pickleball section now hard-fails T5. Each guide needs a full Pickleball section researched and built: courts within 25 min drive, `🚕` drive time required, `🚶` optional. Run `guide_tools.py validate <City>` after to confirm it passes before committing.*

*From the 2026-07-06 full fleet scan — confirmed US guides failing T5 (alphabetical):*

- [ ] Boulder
- [ ] Cape Cod
- [ ] Charlotte
- [ ] Chicago
- [ ] Columbia
- [ ] Dallas
- [ ] Denver
- [ ] Florida Keys
- [ ] Glacier National Park
- [ ] Kauai
- [ ] Key West
- [ ] Lake Tahoe
- [ ] Las Vegas
- [ ] Maui
- [ ] Miami
- [ ] Naples Florida
- [ ] Nashville
- [ ] New Orleans
- [ ] New York
- [ ] Oahu
- [ ] Orcas Island
- [ ] Orlando
- [ ] Pensacola
- [ ] Philadelphia
- [ ] San Juan Island
- [ ] Sarasota
- [ ] Seattle
- [ ] Sedona
- [ ] Virgin Islands
- [ ] Washington DC
- [ ] Yellowstone

*(Run `python3 Brain/scripts/validate_itinerary.py <guide.html> 2>&1 | grep "Pickleball section ships"` on any US guide not listed above to check for others — Alaska/Atlanta/Austin/Bend/Big Island/Boston/Portland may already have pickleball sections from the CA/AZ/OR-era build.)*

---

## 🪧 Index Subtitle Proposals

*Proposals to add a `dest-sub` line to an index card — the italic sub-line that surfaces a **non-obvious natural marquee** a guide covers (a major geological phenomenon, famous lake, or national/natural park reached as a day-trip that the city name doesn't telegraph — e.g. Ljubljana → "incl. Postojna Cave · Lake Bled"). Scope is natural features ONLY (caves, lakes, canyons, waterfalls, geysers, fjords, parks); never cathedrals, museums, palaces, or other obvious city sights. A crib never adds one on its own — it parks the proposal here, and adds the span only after owner approves. Flow: proposal here → approved → crib adds `dest-sub` → item deleted. Full rule: `Brain/Reference/Ship Checklist.html` § 11. (Subtitles added 2026-06-12 by owner direction: Ljubljana → "incl. Postojna Cave · Lake Bled" [first use]; Zhangjiajie → "incl. Avatar 'Hallelujah' Mountains".)*

---

## 🔧 Rules for Update

*Only edits to files inside `Brain/CORE RULES/` get parked here — they require explicit approval before Claude touches them. Flow: proposal here → approved in same session → Claude applies the edit → item deleted. Everything outside `Brain/CORE RULES/` (Reference files, scripts, guides, Trips.html, to-do list, etc.) gets fixed immediately without asking or parking.*

*(All 27-file CORE RULES audit findings #1–19 closed 2026-06-05 — see `Brain/Reference/audit_log.md` for the record. Item #17's guide-side consequence — the Michelin backfill — completed 2026-06-05 and closed out 2026-06-06; record in the audit log. The 2026-06-06 CORE RULES audit's three parked proposals all closed same-day: #1 under Wifey's toolbar-move authorization, #2 underline-ban re-homed to `Links.html § 8` and #3 Skip List source + decisions.md relabel both owner-approved and applied — records in the audit log.)*


### 2026-06-21 — Process/system audit follow-ups (all outside CORE RULES — applied immediately, no approval needed)

*Audit scope: process, scripts, validators, reference folder, integrations, deploy. Six items applied this session; one backlog (DriftyCat root-cause) parked below.*

**Applied this session:**
- **Wired 3 orphaned whole-index validators into `guide_tools.py ship`** (advisory/warn-only, post-PASS): `validate_search_index.py`, `validate_climate_coverage.py`, `validate_currency.py`. They were documented as gates but only ran when a human remembered. Now they fire on every ship and print a loud fix line on drift — without blocking an unrelated guide's ship. CLAUDE.md + Brain.md tables updated to match.
- **Completed the 2026-06-17 Links §3 resolution** (item 38 above): the 90-day booking-PASS staleness FAIL was removed from `validate_itinerary.py` then but **lingered in `verify_booking_links.py`** (`LOG_STALE_FAIL_DAYS=90`, lines ~502–512) — live drift from the CORE RULE ("a PASS never goes stale"). Now removed there too; has-entry / is-PASS / valid-date / not-future checks retained. The two threshold constants are marked RETIRED.
- **`build_currency.py` made resilient**: live USD-rate fetch now retries 3× with backoff and falls back to a persistent last-good cache (`Brain/scripts/.currency_rates_cache.json`, gitignored) instead of `sys.exit`-ing on a transient API blip. Mirrors `build_climate.py`.
- **Fixed a latent false-positive in `brain_check.py`**: `_extract_doc_index_block` only terminated the CORE-RULES-doc-index scan at the next `## ` header, so it over-read into the `### Validators` table and mis-flagged a backticked `Guides-Index.html` (a non-CORE-RULES page) as a ghost CORE RULES file → a spurious hard FAIL. Now bounded to the next `##`/`###`. brain_check back to 0 fail.
- **Brain.md map repaired**: added 6 ghost scripts that existed on disk but weren't in the folder map (`mobile_check`, `validate_mobile_render`, `validate_image_sizes`, `pre_push_guard`, `audit_transit_dupes`, `mobile_shot`, plus `build_currency`/`validate_currency`/`validate_flight_index`); removed the dead `Universal Formatting Rules/` folder entry (folder doesn't exist).
- **Repo/disk hygiene**: removed a stale 980 MB git worktree (`agent-a7353adf379f36bdd`, 0 unique commits); untracked 3 private `Brain/` files leaked into the public repo (`Brain.md`, `Guide Entry Counts.html`, `validate_itinerary.py`); archived 3 spent root-level migration scripts + 3 loose dated audit `.md` files to `Travel/archive/`; cleared 5 `.fuse_hidden*` Pages-hostile FUSE artifacts.

**🐛 DriftyCat root-cause backlog (the 48-item tripwire list is an incident backlog — convert recurring classes into real checks):**
- **B9 — ALREADY COVERED (closed 2026-06-21 on review).** The `Name (1).ext` duplicate-edit footgun *is* detected: `brain_check.py:check_no_dup_suffix_files` (added 2026-06-12) hard-fails on any `Name (N).html` / `Name (N).md` stub, excluding archive/, Icons Library/, _build/, On The Go/. It covers the high-risk doc surfaces — which is exactly where the 2 lost cribs were (.html/.md). The audit flagged this as a gap only because the check is buried among brain_check's ~50 checks. *Optional future hardening:* extend beyond .html/.md to any extension, but ONLY when a de-suffixed sibling exists in the same dir (Wikimedia photo filenames legitimately end in ` (digits).jpg` with no sibling, so the sibling test avoids false positives). Low priority — the doc surfaces are the ones that matter.
- **B10 (MED) — mobile-render gate is the weakest guard on the most-recurring regression.** Skinny-pill / overflow regressions keep recurring; `validate_mobile_render.py` catches them but is **warn-only + playwright-gated** (silently skips if playwright absent). Decide: make it a hard ship gate when playwright is present (fail the ship), and/or add a CI step that guarantees playwright so it can't silently no-op.
- **B11 (MED) — cascade-drift on direct site edits.** "Live site has a tab/feature the reference docs don't describe" recurs (e.g. the `Europe-Stats.html` toolbar↔Brain.md warn seen this session). brain_check only *warns*. Consider promoting toolbar↔Brain.md/Toolbar.html/Navigation.html parity to a hard gate on ship.
- **Note:** the data-page parity class (climate/safety/currency/stats/FMAP/pin/status-dots/index-inline) is already well-covered by the 2026-06-15/06-21 `_check_guide_*` hard gates — that's the model to replicate for B9–B11.

### 2026-06-17 — Core Rules audit (non-extra-section): validator-vs-rule contradictions (need decision) + validator backlog

*Full audit: `Travel/Core Rules Validator Audit — 2026-06-17.md`. Covers `Rules for Claude`, `Guide Structure`, `Day Structure`, `Trip Overview`, `Hotel Banner`, `Stops Structure`, `Motion Rule`, `Tickets`, `Icon Order and Format`, `Links`, `Photos Rules`.*

*All three validator-vs-rule contradictions RESOLVED 2026-06-17 (owner-approved): (1) Trip Overview §3 pill label — doc line 62 fixed to `⛲️ Day Trips`, CORE RULES cascade run; (2) Links §3 — booking-URL 90-day staleness check removed from the validator (rule wins, a logged PASS never expires); (3) Photos Rules §5 step 7 + §9 — rewritten to download-only via `commons_photo.py --download` (validator wins), and the stale "hotlink permitted" language purged from Ship Checklist § 6, Rule Dependencies, and Separation Map.*

**Validator-code backlog (pure validator session, no rule decision needed):**
- ~~Rules for Claude §6 placeholder check misses **bare** `TBD`/`TODO` (only `{braced}` caught globally + hotel-banner scope) and the literal phrases "fill in later" / "tour TBD" (no matcher). Add a body-wide scan next to validate_itinerary.py:8467.~~ **DONE 2026-06-19 (B1) — body-wide bare-placeholder hard fail.**
- ~~Day Structure §6/§7 train-day quota: 5+ day "must include" is only a suppressible `warn`; the ≤4-day "must NOT include" has no check at all (vacuous pass).~~ **DONE 2026-06-19 (B2) — ≤4-day prohibition now enforced.**
- ~~Day Structure §5 ≥4-stop floor is a `warn`, not a hard fail.~~ **DONE 2026-06-19 (B3) — flipped to `check()` hard fail.**
- ~~Motion Rule §1: metro (🚝) inline sub-line has no shape check (tram does); ferry (🚢) standalone banner shape unchecked; `_MOTION_LEAD_RE` omits 🚝/🚎.~~ **DONE 2026-06-19 (B4) — `_MOTION_LEAD_RE` broadened to include 🚝/🚎.** (metro/tram inline shape + ferry standalone shape remain ❌ human.)
- ~~Trip Overview §4 text-transform ban regex only catches the exact `a, a:visited { text-transform: lowercase }` — misses uppercase/capitalize, bare `a`, and `*`/body-level cascades.~~ **DONE 2026-06-19 (B5) — now scans all CSS rules.**
- Tickets: ticket-row **field order** (Title · ⭐ · reviews · platform) unchecked (only presence); §1 source waterfall unenforced (mostly behavioral). **(B6 — open)**
- Links §4: TheFork named bot-blocked but no `thefork.com` URL pattern / no log-coverage (low severity — §4 defers to Platforms.md). **(B7 — already in `BOT_BLOCKED_TICKET_HOSTS`; confirmed present 2026-06-19; closed)**
- Hotel Banner §1 "no postal code" only caught when a comma is present and no middle-dot (`Calle Mayor · 28013 Madrid` passes). **(B8 — intentional limitation; indistinguishable from house numbers; documented)**

*Confirmed CORRECT (no action): Icon Order (all formats + tilde carve-out), Guide Structure (incl. the inter-section order the Icon Order doc lists), Hotel Banner middle-dot leniency (intended, resolved 2026-06-15), money/hedging/date/on-demand-leak bans, Stops Structure box shape, Links/Photos shape. Live URL-health + h1 subject-drift correctly live in verify_urls.py / verify_booking_links.py.*

### 2026-06-12 — Mobile baseline — FULLY CLOSED

*DONE & confirmed by owner: `Guides/mobile.css` (universal defensive baseline) + `Brain/scripts/mobile_check.py` (audit + `--apply` injector + `--strict` gate) + defensive overflow guards in `Brain/Reference/Guide Style.css` → synced to `guide_v3.css`. **Wired into the session:** `guide_tools.py start` runs mobile-check as Step 3/4; `guide_tools.py ship` hard-gates on `mobile-check --strict` after the pin gate. **CORE RULES updated** — `Rules for Claude.html` step-1 enumeration names mobile-check; cascade worked clean (checksum CHANGED(1) `Rules for Claude.html` only; `format_version.json` unchanged; doc_workshop_validator 27/27; brain_check 54/54). Documented in `CLAUDE.md` (ritual + Validators table + DriftyCat) and `Ship Checklist.html` § 10.*

***LOCKED DECISION ( 2026-06-12):** new guides do NOT link `mobile.css` — guides use `guide_v3.css` only (already carries the same overflow guards); all other shareable pages use `mobile.css`. One source of truth per surface. No further action.*

### 2026-06-06 — CORE RULES cross-check — ALL 25 ITEMS CLOSED

*(All findings approved by owner and applied same-day, one approval cycle each — full records in `Brain/Reference/audit_log.md`. Final batch: #4 ship-gate standing order now checks Phase 6; #9–18 drift fixes; #21 Train Day destination never repeats in Day Trips by Train; #24 stop templates gained 📒/📖/photo rows; #25 file renamed to `Skip List - Extra Section.html` with validator map + all build_state.md files updated. Convention locked the same day: rule cross-references name the file only, never the § number; "→ hotel" on hotel-scoped extras motion rows is a soft-grey note hint, never shipped guide text.)*

---

## ❓ Open Questions

*Only questions concerning fixes or edits to `Brain/CORE RULES/` files park here — every other gap is resolved in-session with Claude's own tools (Rules for Claude.html § 3, applied 2026-06-06).*

<!-- Resolved 2026-06-13: "CORE RULES checksum drift — 4 files unstamped (flagged 2026-06-12)" — Cappuccino / Michelin Restaurants / Motion Rule / Restaurants Near Hotel now match core_rules_checksums.json (validator: SHA-256 matches for all 27 CORE RULES files). Closed by owner. -->
<!-- Resolved 2026-06-15: "Hotel Banner §1 mandates a street number — but some hotels have none (UAE guide)." Decision by owner: §1 updated to allow street name · neighborhood when no street number is published. validate_itinerary.py updated: passes if digit present OR · present; fails only on bare street name alone. format_version.json bumped → fp e59f9c9f0bcc68c5. UAE guide (Address Downtown) can now re-ship. -->

