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

*Auto-audit run 2026-07-06. AmEx Centurion guest policy, Delta Sky Club visit caps, Priority Pass/Venture X, and AMS Centurion Lounge all applied to `Lounges-US.html`/`Lounges-Europe.html` 2026-07-10. Two forward-looking watch items remain — no page edit needed yet, just don't forget them when they open:*

- ℹ️ **LAX (US page) — second Delta One Lounge coming to Terminal 2:** US page lists the LAX Delta One Lounge in Terminal 3 (correct today). A **new LAX Delta One Lounge opens in phases in Terminal 2** (first phase 2026, full lounge 2028). Not open yet. Source: https://thepointsguy.com/airline/delta-one-lounge-lax-2027/
- ℹ️ **ATL — Delta One Lounge "in the works":** A Delta One Lounge is planned for ATL but not yet open. Watch for an opening date. Source: https://www.cnn.com/cnn-underscored/travel/delta-sky-club-lounges

---
