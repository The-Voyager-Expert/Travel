# To Do List

> One file. Three sections. Everything lives here — no separate rule-update file. Resolved items get deleted (no strikethrough).

---

## ✈️ My Tasks

*Private tasks — bookings, flights, hotels, research, logistics.*

---

## 🗺 Guides to Build

*(No open guide builds.)*

---

## 🪧 Index Subtitle Proposals

*Proposals to add a `dest-sub` line to an index card — the italic sub-line that surfaces a **non-obvious natural marquee** a guide covers (a major geological phenomenon, famous lake, or national/natural park reached as a day-trip that the city name doesn't telegraph — e.g. Ljubljana → "incl. Postojna Cave · Lake Bled"). Scope is natural features ONLY (caves, lakes, canyons, waterfalls, geysers, fjords, parks); never cathedrals, museums, palaces, or other obvious city sights. A crib never adds one on its own — it parks the proposal here, and adds the span only after owner approves. Flow: proposal here → approved → crib adds `dest-sub` → item deleted. Full rule: `Brain/Reference/Ship Checklist.html` § 11. (Subtitles added 2026-06-12 by owner direction: Ljubljana → "incl. Postojna Cave · Lake Bled" [first use]; Zhangjiajie → "incl. Avatar 'Hallelujah' Mountains".)*

---

## 🔧 Rules for Update

*Only edits to files inside `Brain/CORE RULES/` get parked here — they require explicit approval before Claude touches them. Flow: proposal here → approved in same session → Claude applies the edit → item deleted. Everything outside `Brain/CORE RULES/` (Reference files, scripts, guides, Trips.html, to-do list, etc.) gets fixed immediately without asking or parking.*

*(All 27-file CORE RULES audit findings #1–19 closed 2026-06-05 — see `Brain/Reference/audit_log.md` for the record. Item #17's guide-side consequence — the Michelin backfill — completed 2026-06-05 and closed out 2026-06-06; record in the audit log. The 2026-06-06 CORE RULES audit's three parked proposals all closed same-day: #1 under Wifey's toolbar-move authorization, #2 underline-ban re-homed to `Links.html § 8` and #3 Skip List source + decisions.md relabel both owner-approved and applied — records in the audit log.)*

---

## ❓ Open Questions

*Only questions concerning fixes or edits to `Brain/CORE RULES/` files park here — every other gap is resolved in-session with Claude's own tools (Rules for Claude.html § 3, applied 2026-06-06).*

<!-- Resolved 2026-06-13: "CORE RULES checksum drift — 4 files unstamped (flagged 2026-06-12)" — Cappuccino / Michelin Restaurants / Motion Rule / Restaurants Near Hotel now match core_rules_checksums.json (validator: SHA-256 matches for all 27 CORE RULES files). Closed by owner. -->
<!-- Resolved 2026-06-15: "Hotel Banner §1 mandates a street number — but some hotels have none (UAE guide)." Decision by owner: §1 updated to allow street name · neighborhood when no street number is published. validate_itinerary.py updated: passes if digit present OR · present; fails only on bare street name alone. format_version.json bumped → fp e59f9c9f0bcc68c5. UAE guide (Address Downtown) can now re-ship. -->

**Q (2026-07-10) — Add the Read About story page to the Phase 5 list in `Brain/CORE RULES/Guide Structure.html`?**
The story page became mandatory on 2026-07-10 and is now hard-gated in `validate_itinerary.py`, `guide_tools.py ship`, and `update-index` Step 14. It is already wired into every surface I may edit without approval: `CLAUDE.md` § Guide build phases, the `build_state.md` template (Phase 5 read + Phase 6 checkbox), `Brain/Reference/Story-Pages.html` § 9, `Ship Checklist.html` § 9b, `Cleanliness Checks.md` rule 453, `Validator Index.html`, and `Brain.md` Part 1.
The one remaining surface is CORE RULES — `Guide Structure.html` § Phase 5 still lists only the Extra Section files. **Approve and I add one line there**, then regenerate `core_rules_checksums.json` and run `doc_workshop_validator.py` per the Change Cascade. Until then the gates are fully enforcing; only the CORE RULES phase list is silent about it.

---

## 🛋️ Lounges Audit — July 2026

*Auto-audit run 2026-07-06. Items below need a human to review and update `Travel-Website/Trip-Essentials/Lounges-US.html` and/or `Lounges-Europe.html`. The base card-inclusion statements (CSR + Venture X include Priority Pass; AmEx Platinum accesses Centurion + Delta Sky Club with a same-day Delta flight) are all still accurate — what changed is fine-print visit caps and guest policies. No lounge closures found at any listed airport.*

- ⚠️ **AmEx Centurion — guest policy tightens July 8, 2026 (most urgent, lands two days after this audit):** Both pages' "How to Access" legend says only "AmEx Platinum or Centurion card (separate from Priority Pass)." As of July 8, 2026 all guests must be on the **same flight** as the cardholder (was any-flight-that-day), Platinum guests cost **$50/adult · $30/child (2–17)**, complimentary guest access now requires **$75k annual spend**, and layover access extends to 5 hrs before departure. Directly affects the **LHR Centurion Lounge** listed on the EU page (LHR is one of the named affected locations). Consider adding a one-line guest-fee note to the Centurion legend and/or the LHR Centurion entry. Sources: https://upgradedpoints.com/news/amex-centurion-lounge-new-entry-rules-2026/ · https://global.americanexpress.com/card-benefits/detail/lounge-guest-access-pass/platinum
- ⚠️ **Delta Sky Club — AmEx Platinum/Reserve visit caps not reflected:** US page legend says "AmEx Platinum/Reserve card (with same-day Delta flight)" with no mention of the visit limit. Current rule (in effect since Feb 2025, reset Feb 1 2026): **AmEx Platinum = 10 visit-days/yr, Delta Reserve = 15/yr**, then **$50 per extra visit**; unlimited only after $75k annual card spend. Consider adding a short "(annual visit limit applies)" clause so the legend isn't read as unlimited access. Sources: https://thepointsguy.com/loyalty-programs/ultimate-guide-delta-sky-club-access/ · https://www.delta.com/us/en/delta-sky-club/access
- ⚠️ **Priority Pass — Capital One Venture X guest access removed (Feb 1 2026):** Both legends list Venture X as a PP card — still true for the **primary** cardholder, so no correction needed to the base line. But Venture X **no longer includes complimentary Priority Pass guests** (guests now $35/visit), and authorized users pay $125/yr for their own access. Chase Sapphire Reserve is unchanged (still 2 free guests). Optional nuance note only. Sources: https://thriftytraveler.com/guides/airport-lounges/capital-one-priority-pass-changes/ · https://upgradedpoints.com/news/capital-one-venture-x-lounge-access-changes/
- ⚠️ **AMS (EU page) — new AmEx Centurion Lounge opening 2026:** Amsterdam Schiphol is getting a Centurion Lounge in 2026 (AmEx's newest international location). The AMS card on the EU page currently has no AmEx Centurion section. Confirm open date and add when live. Source: https://upgradedpoints.com/travel/airports/american-express-centurion-lounges/
- ⚠️ **LAX (US page) — second Delta One Lounge coming to Terminal 2:** US page lists the LAX Delta One Lounge in Terminal 3 (correct today). A **new LAX Delta One Lounge opens in phases in Terminal 2** (first phase 2026, full lounge 2028). Not open yet — note for a future add, no change needed now. Source: https://thepointsguy.com/airline/delta-one-lounge-lax-2027/
- ℹ️ **ATL — Delta One Lounge "in the works":** A Delta One Lounge is planned for ATL but not yet open. No action; watch for an opening date. Source: https://www.cnn.com/cnn-underscored/travel/delta-sky-club-lounges

---

## 🚄 European Train Guide Audit — July 2026

*Auto-audit run 2026-07-06. Items below need a human to review and update `Travel-Website/Trip-Essentials/European-Train-Guide.html`. Eurostar, OUIGO, and the national high-speed operators (SNCF, DB, Renfe, Trenitalia, ÖBB, SBB) were all re-checked and remain accurate. URL spot-checks (europeansleeper.eu, nightjet.com, thetrainline.com) all resolve correctly. The changes below are concentrated on European Sleeper and the Eurail/Interrail pass card.*

- ⚠️ **European Sleeper — new route missing:** Brussels ↔ Milan began operating (first departure 9 Sep 2026), calling at Antwerp, Cologne, Zürich, and Como. The operator's own site now lists it as one of three active routes. The guide's European Sleeper card does not list Milan. Source: https://www.europeansleeper.eu · https://www.timeout.com/news/a-brand-new-sleeper-train-route-through-the-heart-of-europe-is-launching-next-summer-121025
- ⚠️ **European Sleeper — route terminus stale:** The card lists "Brussels / Amsterdam ↔ Berlin (active)," but the operator now runs the line through to **Prague** (via Dresden) and markets it as "Brussels to Prague." Update the Berlin terminus to Prague. Source: https://www.europeansleeper.eu
- ⚠️ **European Sleeper — Paris–Berlin extended:** The card shows "Paris ↔ Berlin via Brussels (active, launched 2026)." That service was extended to **Hamburg** from 14 Jul 2026. Consider updating to Paris ↔ Berlin ↔ Hamburg. Source: https://www.hourrail.voyage/en/blog/european-sleeper-train-de-nuit-europe · https://www.euronews.com/travel/2026/06/04/love-night-trains-this-new-map-shows-all-the-sleeper-services-running-across-europe-in-202
- ⚠️ **Eurail / Interrail — new Plus Pass + fully digital:** The pass card describes only the standard pass (33 countries, reservations bought separately — both still correct). Two 2026 changes are not reflected: a new **Plus Pass** that bundles seat reservations for most trains, and the retirement of the paper pass (now app-only via the Rail Planner app). Also new: from 29 May 2026 the pass covers Trenitalia's Paris–Lyon–Turin–Milan Frecciarossa with a compulsory ~€13 reservation. Source: https://www.seat61.com/how-to-use-a-eurail-pass.htm · https://community.eurail.com/news-and-announcements-39/10-exciting-rail-updates-to-experience-in-2026-21020
- ℹ️ **Nightjet — La Spezia routes discontinued (no page change needed):** ÖBB dropped the Munich–La Spezia and Vienna–La Spezia Nightjets from the 2026 timetable. Neither is listed on the guide, so no edit is required — noted for completeness. New-generation rolling stock continues rolling out (Zürich–Vienna from 15 Jun 2026, Amsterdam–Zürich from 13 Dec 2026); the guide's Nightjet routes remain accurate. Source: https://www.seat61.com/trains-and-routes/nightjet-new-generation.htm
- ℹ️ **Eurostar — direct London–Frankfurt/Geneva still years out (no page change needed):** Eurostar confirmed direct London–Frankfurt and London–Geneva routes, but they won't launch until the **early 2030s** (new fleet required). The guide correctly does not list them as current routes — no edit needed now, revisit when they near service. Source: https://mediacentre.eurostar.com/mc_view?language=uk-en&article_Id=ka4Rz00000Frp0XIAR

---

## 🛡️ Safety Guide Audit — July 2026

*Auto-audit run 2026-07-06. Items below need a human to review and update `Brain/scripts/safety_levels.json`, then run `python3 Brain/scripts/build_safety_guide.py` to regenerate the page.*

- 🚨 **Qatar — level changed:** safety_levels.json says **L1** (Doha) but travel.state.gov now shows **Level 3: Reconsider Travel** (updated 2026-03-02, "due to risk of armed conflict" — ordered departure of non-emergency US government personnel following US–Iran hostilities). Source: https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/qatar-travel-advisory.html

*Also checked, no change: UAE (Abu Dhabi, Dubai) confirmed still **Level 3** — matches. No other guide country appears in the current State Dept L3/L4 advisory lists. Selected L2 guide countries spot-checked against the main advisory list and confirmed accurate: France, Italy, UK, Germany, Spain, Netherlands, Brazil, Egypt, Turkey, Thailand, China, Morocco, Peru, Indonesia, Philippines, Sri Lanka, Jordan.*

---

## 💉 Vaccines Audit — July 2026

*Auto-audit run 2026-07-07. Items below need a human to review and update `Travel-Website/Trip-Essentials/Vaccines.html`. Checked against CDC Yellow Book 2026 edition and current WHO/CDC entry-requirement guidance. The core framework was re-verified and remains accurate: Yellow Fever valid for life / single dose / certified-clinic-only; Japanese Encephalitis (IXIARO, 2-dose 28 days apart, rural + 1-month+ stays); Dengue Qdenga (2023, ages 4–60, 2 doses 3 months apart, all 4 serotypes); malaria = prescription antimalarials (no traveler vaccine). CDC destination tool `wwwnc.cdc.gov/travel` resolves correctly. No country on the page was newly declared malaria-free (the 2024 Libya airport-malaria cluster does not affect the page — North Africa carries no malaria recommendation). One country-level Yellow Fever precision issue found below.*

- ⚠️ **Yellow Fever — East Africa card overstates entry requirements for Rwanda, Tanzania & Ethiopia:** The East Africa card says YF is *"Required for entry to Uganda, Rwanda, Tanzania, and Ethiopia."* Per current WHO/CDC guidance, only **Uganda** requires proof from **all** travelers (age ≥9 months, any origin). **Rwanda, Tanzania, and Ethiopia require it only from travelers arriving from — or transiting ≥12 hrs through — a YF-endemic country** (the same conditional rule the card already correctly states for Kenya). Consider moving Rwanda / Tanzania / Ethiopia into the "arriving from an endemic country" clause and leaving Uganda as the sole blanket requirement. (In practice YF is still relevant for most multi-country safari itineraries routing through Nairobi/Addis, so the recommendation to vaccinate is unchanged — this is a legal-entry-wording precision fix, not a recommendation change.) Sources: https://www.cdc.gov/yellow-book/hcp/preparing-international-travelers/yellow-fever-vaccine-and-malaria-prevention-information-by-country.html · https://cdn.who.int/media/docs/default-source/travel-and-health/countries-with-risk-of-yellow-fever-transmission.pdf
