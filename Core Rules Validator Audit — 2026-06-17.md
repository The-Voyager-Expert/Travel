# Core Rules Validator Audit — 2026-06-17

Scope: the **non-extra-section** CORE RULES files, cross-checked against `Brain/scripts/validate_itinerary.py` (the guide-HTML static validator) and, where relevant, `verify_urls.py` / `verify_booking_links.py`. Question asked: is the validator enforcing everything these rules state, and is it right?

Files audited: `Rules for Claude.html`, `Guide Structure.html`, `Day Structure.html`, `Trip Overview.html`, `Hotel Banner.html`, `Stops Structure.html`, `Motion Rule.html`, `Tickets.html`, `Icon Order and Format.html`, `Links.html`, `Photos Rules.html`.

Method: six parallel reads of the rule files vs. the 819-`check()` validator, then I re-verified every "validator is wrong" claim against the actual code, a live run on a shipped guide (Zurich: 728✓/7✗/3⚠ — failures are recent content-rule tightenings, not bugs), and the To Do List history.

**Bottom line:** format enforcement (icon order, per-icon formats, the tilde carve-out, money ban, hedging ban, stop-box shape, link/maps/wiki shape, photo shape) is thorough and accurate. Three places where the **validator and the rule doc actively disagree** need your decision. A handful of stated rules are unenforced or under-enforced — pure validator work, no decision needed.

---

## A. Validator ⇄ rule CONTRADICTIONS — need a decision (which side wins, then I apply)

**A1 — Trip Overview §3: "Day Trips" pill label.** *(I verified this directly.)*
The 2026-06-16 pill-shortening changed three canonical labels in the validator: `Day Trips by Train → Day Trips`, `Michelin Restaurants → Michelin`, `Stations Near Hotel → Train Stations`. The doc was updated for **Michelin** (line 64) and **Train Stations** (line 61) — but `Trip Overview.html` line 62 still reads **`⛲️ Day Trips by Train`**. The validator hard-fails any pill that isn't exactly **`⛲️ Day Trips`** (validate_itinerary.py:2563), and every shipped guide uses `⛲️ Day Trips` (136 in use; Zurich passes). So this is a **missed doc edit**, not a validator bug. → Fix `Trip Overview.html` line 62 to `⛲️ Day Trips` (validator + guides win). One-token CORE RULES edit.

**A2 — Links §3: "a PASS never goes stale" vs. a 90-day hard-fail.** *(I verified this directly.)*
`Links.html` §3 line 51 states plainly: *"A PASS entry permanently clears the warning for that URL — there is no age expiry (a PASS never goes stale)"* — and §3 line 41 scopes the log to all bot-blocked booking URLs (Viator / GYG / Michelin / TripAdvisor). But the validator has a **hard** `check()` — *"Every bot-blocked booking URL log entry is within 90 days"* (validate_itinerary.py:~23758) — that fails any PASS entry older than 90 days. Wikipedia PASS is correctly exempted from aging; booking URLs are not. This is a real contradiction. → Decide: drop the 90-day hard check (rule wins), or amend Links §3 to state a 90-day refresh requirement (validator wins).

**A3 — Photos Rules §5 step 7 + §9: Wikimedia hotlinking permitted vs. banned.** *(I verified this directly.)*
`Photos Rules.html` §5 step 7 (lines 65–68) and §9 (line 92) still present hotlinking the resolved `upload.wikimedia.org` URL as a valid path ("Download or hotlink — two paths," with the `<!-- hotlink: CDN download blocked in Cowork sandbox -->` comment). The validator (changed 2026-05-31) hard-fails **every** `upload.wikimedia.org` `<img src>`, and its own comment says that hotlink comment *"no longer authorises a hotlink."* → Update `Photos Rules.html` §5 step 7 + §9 to drop the hotlink path and state download-only via `commons_photo.py --download` (validator wins — the rationale is that `--download` now works), or relax the validator.

---

## B. Stated rules the validator does NOT enforce (or under-enforces) — validator work, no rule decision

**B1 — Placeholder detection misses bare forms.** *(Verified.)* Rules for Claude §6 bans `{TBD}` / `{TODO}` / "fill in later" / "tour TBD". The global body check (validate_itinerary.py:8467) requires **curly braces**; bare `\bTBD\b`/`\bTODO\b` are only caught in the hotel banner (line 2106), and the literal phrases "fill in later" / "tour TBD" have **no matcher anywhere**. A stop row reading `Tour TBD` or `Booking TODO` ships clean. Fix: add a body-wide scan `\bTBD\b|\bTODO\b|fill[\s-]?in later|tour\s+TBD` next to line 8467.

**B2 — Train-Day quota is soft; the short-guide prohibition is absent.** *(Reported, evidence cited.)* Day Structure §6/§7 says a 5+ day guide **must** include a Train Day and a ≤4-day guide **must not**. The 5+ case is only a suppressible `warn` (validate_itinerary.py:~16352); the ≤4-day "must not" has **no check** — the short-guide branch just prints a vacuous pass. Both are concrete must/must-not rules.

**B3 — Stop-count floor (§5, ≥4 stops/full day) is a warn, not a hard fail** (lines ~5026, ~24188). A thin day ships with only a soft flag.

**B4 — Motion Rule §1 sub-line gaps.** *(Reported.)* The **tram** sub-line gets a full shape check (2 walks + 1 tram + order + 3 links); the structurally identical **metro (🚝)** inline row has no shape check, only a "followed by a digit" check. The **ferry (🚢) standalone** banner shape (`🚢 N min → Destination`) isn't shape-checked either (the existing ferry check is Getting-Around-only). Minor: `_MOTION_LEAD_RE` (line 6378) omits 🚝/🚎, so a stray metro/tram-only row off its sub-line skips `_validate_motion_row` entirely.

**B5 — Trip Overview §4 text-transform ban is too narrow.** *(Reported.)* The check (validate_itinerary.py:~24668) only matches the literal `a, a:visited { … text-transform: lowercase }`. It misses `uppercase`/`capitalize`, a bare `a { … }` without `a:visited`, and `*`/body-level transforms that cascade to anchors. The rule bans *any* global text-transform on anchors.

**B6 — Tickets: field order + source waterfall unenforced.** *(Reported.)* Ticket-row checks verify **presence** of `N.N⭐` and `NNN+ reviews` but not their **order** (`Title · ⭐ · reviews · platform`), so a mis-ordered row passes. Tickets §1's platform-by-stop-type waterfall (US live events → Ticketmaster/StubHub/TodayTix; attractions → Viator/GYG/TripAdvisor; venue = last resort) is unenforced — mostly behavioral, but the homepage-check allowlist diverges from the doc's named platforms.

**B7 — Links §4: TheFork named but unenforced.** *(Verified.)* §4 lists five bot-blocked platforms incl. **TheFork**, but neither validator builds a `thefork.com` URL pattern, so a TheFork booking URL never requires a verification-log entry. Low severity — §4 defers the authoritative list to `Platforms.md`; only act if TheFork is still in use.

**B8 — Hotel Banner "no postal code" only partially caught** (minor). A postal code is flagged only when a comma is present and a middle-dot is absent (line ~1473); `Calle Mayor · 28013 Madrid` would pass.

---

## C. Confirmed correct — no action (stated so the audit is complete)

- **Icon Order and Format** — inside-box icon order, every per-icon format (⏳/⏰/🏛/🚫/🆓/💵/⚠️/🎟/📖/↳, motion glyphs, train icons), and the **tilde carve-out** (`~` valid only as the ⏰ prefix, banned everywhere else) are all enforced exactly to spec.
- **Guide Structure** — extras-section order, canonical anchors, phase gates, build-state tracker: fully enforced. (This also covers the inter-section ORDER that the Icon Order doc lists — it's enforced here via `eoi_canonical_order`, so that is **not** a gap.)
- **Hotel Banner §1 middle-dot leniency** — passing on a digit OR a `·` is the **intended** behavior (owner-resolved 2026-06-15, To Do List). Not a bug.
- **Rules for Claude §6/§7** — money/currency-symbol ban, ISO-code ban, hedging-language ban, dates/years ban, on-demand-doc leak checks (weather/Delta/car-rental): comprehensive and closely tracked.
- **Stops Structure §3** — stop-box row presence, box enclosure, ↳-before-📖, 📍-last, 📸-last, ticket-box 🎟 lead + rating/review format, named-venue + generic-market blocklists: thorough.
- **Links/Photos shape** — Wikipedia host/text/target, Google-Maps query pattern, address separator/no-country, `target="_blank"`, local `800px-` photo path, alt-text rules, "No pictures found" cap: all enforced (live URL-health + h1 subject-drift correctly live in `verify_urls.py` / `verify_booking_links.py`, not here).

Selection-quality bars (Stops §1 "visually exceptional," route geographic flow, photo license §2, interior-vs-exterior §3a) are inherently non-static and remain judgment calls — noted, not counted as validator defects.
