# Trips & Calendar — Rules & Decisions

Per owner 2026-05-19 (*"add to the rules trip rules and calendar rules, needs to share 1 doc"*): trip-file rules and calendar rules live in one document. `Trips.html` and the shared **Hubby&Wifey Trips** Google Calendar are two surfaces over the same source of truth — they must stay in sync.

Read this before making any changes to `Trips.html` OR before creating/updating any calendar event. Every structural and content decision is documented here so future sessions don't have to rediscover them.

---

## File purpose

`Trips.html` is a live planning workspace for Wifey's trips (some with Hubby, some solo). owner reads it on her iPhone via GitHub. It is **not** an archive — it's a quick-reference document meant to be scannable at a glance while traveling or planning.

---

## Trip order

- **Upcoming trips** come first, in chronological order by month.
- **Past trips** (return date has passed) move to the bottom under the gray **PAST TRIPS — 2026** banner. Never delete — just move down.
- When a new year starts or the file gets too long, move past trips to the `Archive` file and start fresh.

---

## Archive vs Past Trips section

| | Archive file | Past Trips (bottom of Trips.html) |
|---|---|---|
| What goes there | Trips from previous bulk period (e.g. Jan–Apr 2026) | Recently completed trips from the current active period |
| When to move | When the file starts getting long, or at natural breakpoints (end of semester, new year) | As soon as the return date passes |
| File name | `Archive 2026 Jan-Apr.html` (name reflects date range) | Stays in `Trips.html` |

---

## What to include / exclude

### ✅ Include
- Hotel name + plain-text address + Maps pin link
- Check-in and check-out dates
- Room type / bed type (kept short — one line)
- Booking status (✅ Booked, 🤔 Not confirmed, 📋 Planning)
- Flights: date · time · route · flight number
- Seat numbers as gray sub-detail (`.flight-detail`), not in the main line
- Trains: date · route · duration · booking action if still needed
- Venue: name + address + dates
- **From-hotel-to-venue line** — distance in km + walking time + ride-app time (see § "Hotel → venue distance" below)
- Flight booking refs (e.g. ref ZDIP3M) — keep, useful at the airport
- Action items (things still to book or do)

### ❌ Do NOT include
- **Hubby's raw notes** — per owner 2026-05-18: *"the html i dont need anything that Hubby wrote. i will give you any updates as he gives to me."* The yellow `.leo-notes` box is removed. Owner will paste anything from Hubby that needs to land in the file.
- **owner / Hubby / Together section dividers** — per owner 2026-05-18: *"no more wifey and hubby sections. keep just the things that matter."* All content inside a trip goes in one consolidated flow (Flights → Trains → Hotels → Venue → Action box), chronologically organized.
- **Any prose** — per owner 2026-05-18: *"cut any prose."* No special-needs notes, no narrative remarks, no "booked on so-and-so's account" reminders. Keep just dates, addresses, room type one-liners, and action items.
- Confirmation numbers (#98122003 etc.)
- Hotel PIN codes
- Cancel deadlines ("Free cancel until May 15")
- Prices / totals (Total €1,644.45 etc.)
- Booking rate names ("MBR SAVE+ BKFST", "Member Stay For Breakfast Rate", "Flexible Rate")

---

## Card layout — every trip, same structure

Per owner 2026-05-18 (*"always this order. Hubby's stuff first"*), trips that involve a separation/reunion arc (e.g. Hubby at an offsite while Wifey travels solo, then meeting up) use these phase-ordered sections. **This order is mandatory** — Hubby's stuff always comes before Wifey's solo stuff, and Together always comes last:

1. **Trip title + status badge**
2. **✈️ Flights** — `.sec` with `🟣 Both` pill (or whichever tag fits if they don't fly together). All legs, outbound and return, in chronological order.
3. **📖 Venue (Hubby)** — always comes BEFORE hotels when Hubby has a separate venue. Use `.hotel.hubby-block` on the venue div for the green left border. Per owner 2026-06-25: *"his hotel always comes first when we are staying separately."*
4. **🏨 Hubby's hotel** — `.sec` with `🟢 Hubby` pill. Solo hotel block.
5. **🏨 Hotels + 🚆 Trains — Wifey solo** — two distinct `.sec` blocks, both with `🔵 Wifey` pill. Per owner 2026-05-18: `🏨 Hotels` first (grouped by city using `.city-sub` labels), then `🚆 Trains`. Not interleaved.
6. **🏨 Hotels — Together** — `.sec` with `🟣 Both` pill. Reunion hotels and onward, in chronological order.
6. **📖 Venue** (if there's a Wifey or together venue separate from Hubby's offsite) — with the hotel→venue distance line.
7. **🚗 Car Rental** (if any)
8. **⏳ Action box** (orange) — only things still to book or confirm

For trips with no separation (Wifey solo all the way, e.g. Iceland; or Hubby solo, e.g. Seoul; or Together the whole time, e.g. FLoC), skip the empty phases and keep the remaining sections in the same relative order.

### Who-tag on section labels

Every `.sec` that represents a phase tied to one person gets a who-tag pill at the end of the label. Per owner 2026-05-18 (*"🚆 Getting Around - this is just mine has to just unde my name"*): when a whole section is solo-Wifey or solo-Hubby or together, the pill goes on the label so the whole block reads as theirs. Use the same pill styling as on hotel blocks. Inside `.sec`, the pill keeps its mixed-case label (uppercase is forced off via `.sec .who-tag`).

---

## Hotel block — required structure

Each hotel uses this exact order (updated 2026-06-25 — city first so you know immediately where you are):

```html
<div class="hotel">
  <div class="hotel-meta">City <span class="hotel-sep">·</span> Jul 25 → Aug 3</div>
  <div class="hotel-name"><a href="https://www.google.com/maps/search/?api=1&query=...">Hotel Name</a></div>
  <span class="copy">Street address, postal code, city, country</span>
</div>
```

City and dates appear on a single line in `.hotel-meta` (bold accent color). The `·` separator uses `.hotel-sep` (muted color).

Why this order:
- **City** is bold and first — the instant orientation anchor
- **Dates** under the city — check-in/out at a glance
- **Hotel name is the Maps link** — tap the name → opens Maps directly. No separate "Open in Maps" line.
- **Plain-text address** in a copyable gray box — tap selects all, paste into Uber / Bolt / Apple Maps
- No phone numbers — per owner 2026-06-25: *"remove phone numbers i dont care"*

### Who-tag — calendar-matched color scheme

Per owner 2026-05-19 (refined twice — *"leo and dai and just leo will be the green you chose update the rules"* → *"actually leave mine purple"*): the who-tag colors mirror owner's Google Calendar event colors so the two surfaces tell the same story at a glance.

The mental model: **anything involving Hubby is green; Wifey alone is purple.**

| Tag | Class | Color | When |
|---|---|---|---|
| 🟣 Wifey | `tag-solo` | Grape purple (`#7030A0`) | Wifey only |
| 🟢 Hubby | `tag-hubby` | Sage green (`#2e7d32`) | Hubby only |
| 🟢 Both | `tag-together` | Sage green (`#2e7d32`) | Both — same green as Hubby on purpose |

**Why Together and Hubby share the green color:** Owner's request — anything that involves Hubby carries the green signal. The label text still distinguishes them ("Hubby" vs "Both"), but at-a-glance color tells owner "Hubby is in this picture" vs "this is just me". Don't try to "fix" the duplication by reassigning Together to a different color.

**Calendar parity rule:** the Hubby&Wifey Trips Google Calendar uses the same scheme — Grape (`colorId 3`) for Wifey-only events, Sage (`colorId 2`) for Hubby events and Together events. If owner recolors the calendar palette, flip the trips palette to match — and vice versa.

### Tag placement — section only, pill leads

Per owner 2026-05-18 (*"i like the lable but no need to repeat before and after"* + *"name first"*): the who-tag pill lives on the **section header** (`.sec`), not on the individual `.booking-name`, and the **pill leads the line** — pill first, then the section icon and label.

```html
<div class="sec"><span class="who-tag tag-solo">🔵 Wifey</span>🏨 Hotels</div>
```

Renders as: `🔵 Wifey  🏨 HOTELS`

Rules:
- Every `.sec` whose content belongs to a specific person/group gets a **leading** `<span class="who-tag tag-...">` followed by the icon + label.
- `.booking-name` is hotel name only — no who-tag span inside, and no city suffix either (the city is on the `.city-sub` above the block).
- A `.sec` only ever holds entries of one tag type. If a trip has mixed phases (e.g. some Hubby nights, some Wifey solo, some together), use separate `.sec` blocks for each phase.
- Inside `.sec`, the pill keeps its mixed-case label (uppercase is forced off via `.sec .who-tag`).

### Hotels grouped by city — `.city-sub`

Per owner 2026-05-18 (*"put hotels separated by city under my name"* + *"Sintra Hotel... Cascais Hotell"*): within a multi-hotel section, every hotel block is preceded by a `.city-sub` line labeled `[City] Hotel`. This becomes the visible identifier — Owner scans for "Sintra Hotel" or "Cascais Hotel", not the hotel brand name.

```html
<div class="sec"><span class="who-tag tag-solo">🔵 Wifey</span>🏨 Hotels</div>

<p class="city-sub">Sintra Hotel</p>
<div class="booking-block">
  <div class="booking-name">Villa Bela Vista</div>
  ...
</div>

<p class="city-sub">Porto Hotel</p>
<div class="booking-block">
  <div class="booking-name">NH Porto Jardim</div>
  ...
</div>
```

Rules:
- Format: `[City] Hotel` (or `[City] Hotels` if there happen to be multiple in one city). Always English city name as written on the trip card.
- The booking-name no longer carries the city suffix (it's redundant with the city-sub).
- Add `.city-sub` to every `🏨 Hotel`/`🏨 Hotels` section — even when the section only has one hotel. Consistency over brevity; owner scans by city.
- Trains and flights don't get city-subs — those rows already carry the route inline.

### Plain-text address format

Use a clean, rideshare-friendly format with commas: `Street Number, Postal Code City, Country`. Examples:
- `Sarphatistraat 104, 1018 GV Amsterdam, Netherlands`
- `Rua Duque de Loulé 66, 4000-324 Porto, Portugal`
- `21 W Walnut St, Pasadena, CA 91103`

No `·` separators (rideshare apps choke on them). No emoji prefix in the copy block (defeats the purpose).

---

## Hotel → venue distance

Per owner 2026-05-18 (*"time from hotel to venue is needed walk and ride app. i see the distance in km!"*): every venue block must end with a from-hotel-to-venue line.

Format: `From [Hotel Name]: 🚶 ~X km · ~N min walk · 🚕 ~N min Uber/Bolt`

Example:
```html
<p>From Lisbon Marriott: 🚶 ~1.5 km · ~20 min walk · 🚕 ~5 min Bolt</p>
```

Rules:
- Always include **km** first — metric first.
- If not walkable, write `not walkable` in place of the walk-time.
- Pick the rideshare app appropriate to the country: Bolt for EU, Uber for US, etc.
- If multiple hotels share a venue, write one line per hotel pair.
- Source: Google Maps directions. If you can't verify, estimate based on coordinates and label nothing — don't fabricate exact minute values.

---

## Trip Overview section

(Optional — keep only if it's still in the file.) One line per trip, format: `MONTH · flag City — EventName · Dates · StatusBadge`.

---

## Status badges

| Badge | Color | Use when |
|---|---|---|
| ✅ Booked | Green | Fully booked, nothing left to do |
| ✅ Flights · [X] to book | Amber | Partially booked — describe what's missing |
| 📋 Planning | Blue | Dates roughly set, nothing booked yet |
| 🤔 Not confirmed | Amber/yellow, larger font | Trip not confirmed — don't book anything |
| ✅ Done | Green | Past trip |

The "Not confirmed" badge is intentionally larger than others — it must be immediately visible.

---

## Flight rows format

```
Date · Time · ORIGIN → DEST · FlightNumber · land HH:MM (if useful)
  [gray sub-detail: seat numbers, notes]
```

- One row per flight leg
- **No seat numbers anywhere.** Per owner 2026-05-18 (*"remove all that: Wifey 5A · Hubby 6A this is noise no need"*): seat assignments are noise. They live in the airline app at boarding time, not in this doc. Don't reintroduce them in `.flight-detail`, inline, or anywhere else.
- Per owner 2026-05-18 (*"Flights should more close together, not skipping line"* → *"the flight shoud not have space like the train"* → *"put all the lights close together. no space"*): `.flight-row` uses `padding: 1px 0; line-height: 1.3`. **No `margin-top` between outbound and return groups.** Each flight is a single line (no sub-detail sub-row unless absolutely needed for ops info). They pack as tight as train rows. Don't loosen this.
- `.flight-detail` is reserved for actual operational info that's still useful on the day — e.g. `KLM operated` for code-shares, `ref ZDIP3M` for booking refs at the airport. Anything else goes in the main row or doesn't go at all.

---

## Amsterdam layover pattern

Hubby and Wifey frequently route SEA → AMS → destination on Delta/KLM. When there's an overnight in Amsterdam, add a **Hyatt Regency Amsterdam** booking block in the Hotels list (chronologically). Address: `Sarphatistraat 104, 1018 GV Amsterdam, Netherlands`.

---

## Trains

- Format: `🚆 Date · Origin → Destination · operator/type · duration · [action if needed]`
- Always link to cp.pt for Portugal trains
- Trains that still need to be booked get `· **book on cp.pt**` in red bold
- Portugal trains: Alfa Pendular is the fast intercity service; regional trains for short hops (Lisbon → Sintra etc.)

---

## Action box rules

- Only appears when there is something **still to do** (book, confirm, contact)
- Items already done (✅) should NOT be in the action box — they just clutter it
- Format: bold red for the action verb, plain text for details
- "⏸️ Hold" pattern for trips not yet confirmed — include who needs to confirm

---

## Status: "Not confirmed" trips

Per owner 2026-06-14 (*"when not confirmed this is all it should show"*): an unconfirmed trip shows **only the banner** — dates + title + the "Not confirmed" badge — and an **empty `.trip-body`**. Nothing else.

- Use the amber "Not confirmed" badge (`<span class="unconfirmed">Not confirmed</span>`).
- Leave the `.trip-body` empty — no hotel block, no flights, no venue, no action box, no "Hold" note.
- The badge alone communicates the status; the "don't book anything" reminder is redundant once the body is empty.
- As soon as the trip is confirmed, drop the badge and fill in the body (flights → hotels → venue → action box) per the normal layout.

---

## Font size — match the guides

Per owner 2026-05-18 (*"The fonts of my trips html is too small. lets increase to match the guide's font size"*):

- Body: `17px` desktop, `21px` mobile. These are the Trips page's own sizes, set larger per owner's request above. Note: `guide-style.css` itself now uses a unified `14px` scale (mobile = desktop), so the Trips page is intentionally larger than the current guides — do not shrink it to "match."
- Mobile breakpoint: `@media (max-width: 600px)`.
- Other elements scale proportionally — see § "Mobile / technical requirements" and the CSS class reference below.

When in doubt, stay within the 14–20px desktop / 17–22px mobile range.

---

## Mobile / technical requirements

- **Always keep** `<meta name="viewport" content="width=device-width, initial-scale=1">` in `<head>`. Critical for iPhone — without it, Safari shrinks everything to desktop size.
- Body margin: `24px 20px` default (mobile), `36px 48px` for screens ≥640px via media query.
- Font: Arial as primary, with `'Apple Color Emoji', 'Segoe UI Emoji'` for clean emoji rendering. Do NOT add Google Fonts or any external font — the file must load offline.
- No external CSS, JS, or image dependencies. Fully self-contained single file.
- File is read on iPhone 16 Pro (393px logical width) via GitHub.
- Test that long trip titles + badges wrap gracefully on narrow screens.
- Touch targets (links) should be large enough to tap — don't pack links too tightly.

---

## CSS class reference

| Class | Purpose |
|---|---|
| `.trip-card.booked` | Green left border — fully booked |
| `.trip-card.partial` | Amber left border — partially booked |
| `.trip-card.planning` | Blue left border — planning stage |
| `.trip-card.hold` | Gray left border — not confirmed |
| `.trip-card.past` | Light gray, slightly muted — past trip |
| `.action-box` | Orange box for outstanding actions |
| `.flight-row` | One flight leg row with bottom border. Tight `padding: 3px 0` per owner 2026-05-18 |
| `.flight-detail` | Gray sub-text under a flight row (seats, notes) |
| `.booking-block` | One hotel/venue entry with dotted bottom border |
| `.booking-name` | Bold dark-blue hotel/venue name (19px desktop / 22px mobile) |
| `.booking-dates` | Bold dates line under the booking name |
| `.addr-copy` | Light-gray copy-friendly address box. `user-select: all` for one-tap select on iPhone |
| `.who-tag` | Pill rendered inside `.booking-name`. Combine with `.tag-solo` / `.tag-together` / `.tag-leo` |
| `.tag-solo` | Purple fill — Wifey alone at this hotel (matches her purple calendar events) |
| `.tag-hubby` | Green fill — Hubby-only hotel (matches Hubby's green calendar events) |
| `.tag-together` | Green fill — Both at this hotel (same green as Hubby: anything with Hubby = green) |
| `.badge-booked` | Green badge |
| `.badge-partial` | Amber badge |
| `.badge-planning` | Blue badge |
| `.badge-hold` | Amber badge, larger — for "not confirmed" |
| `.sec` | Section label within a card (Flights, Hotel, etc.) |
| `.note` | Gray italic small text |
| `.red` | Red bold text for urgent action items |

### Retired classes (do not reintroduce)
- `.who-dani`, `.who-leo`, `.who-together` — removed 2026-05-18. No more per-person sections.
- `.leo-notes`, `.leo-notes-label` — removed 2026-05-18. No raw-notes box.

---

## Adding a new trip

When adding a new trip to the file:

1. Find the correct month section (or add a new month header)
2. Use the single consolidated layout (no Wifey/Hubby/Together splits)
3. Fill flights chronologically (outbound first, return last, with a `margin-top:10px` gap between groups)
4. Add trains in 🚆 Getting Around
5. Add hotels chronologically — every hotel block follows the required structure (name → dates → plain address → Maps link → room type)
6. Add venue with the hotel→venue distance line
7. Add action box if anything still needs to be booked
8. Start with `.trip-card.planning` or `.trip-card.hold` — update to `.booked` or `.partial` as things get confirmed

---

## When a trip is completed

1. Move the full card to the **PAST TRIPS** section at the bottom
2. Change card class to `.trip-card.past`
3. Change badge to `badge-booked` with text "✅ Done"
4. Remove the action box (nothing left to do)

---

## Canonical spacing values (updated 2026-06-25)

These are the locked CSS values for internal card spacing. Do not drift from them without explicit owner sign-off.

| Element | Property | Desktop | Mobile |
|---|---|---|---|
| `.trip-body` | padding | `0 18px 16px` | `0 14px 14px` |
| `.sec` | padding | `20px 0 6px` | `16px 0 6px` |
| `.sec` | margin-bottom | `6px` | `6px` |
| `.trip-body > .sec:first-child` | padding-top | `12px` | `10px` |
| `.hotel` | margin-bottom | `14px` | `12px` |
| `.hotel` | padding-top | `2px` | `2px` |
| `.hotel-meta` | margin-bottom | `4px` | `4px` |
| `.hotel-name` | margin-bottom / margin-top | `3px / 1px` | `3px / 1px` |
| `.hotel p` (venue website row) | padding-top | `2px` | `2px` |

**Why:** `.sec` at 28px and `.hotel` at 24px created a 52px gap between the last hotel in a section and the next section label — visually broken on both desktop and mobile. The new values give ~34px between sections (14px hotel-bottom + 20px sec-top), which is tight and intentional.

---

## Hard rules (never break)

### No Hubby notes box anywhere
Per owner 2026-05-18: *"i dont need anything that Hubby wrote. i will give you any updates as he gives to me."* Do not reintroduce the yellow `.leo-notes` box. If owner pastes Hubby content, it gets folded into the structured fields (dates, addresses, flights) — never preserved as a prose block.

### No Wifey / Hubby / Together sections
Per owner 2026-05-18: one consolidated section per trip. Hotels list in chronological order regardless of who's staying where. If a hotel is for Hubby only or Wifey only, that's clear from the dates and context — no need for a section divider.

### No prose
Per owner 2026-05-18: *"cut any prose. keep just the things that matter. dates, address of venue."* Walking distance from hotel to venue is **not** prose — it's structured travel data and stays. Special-needs reminders, account ownership notes, rate-plan annotations, and similar are prose — cut them.

### No red "to book" on unconfirmed trips
When a trip status is 🤔 Not confirmed, **don't put red "to book" labels anywhere**. Show the route plainly (SEA → ICN) and put "Don't book anything until Hubby confirms" in the action box only. Per owner: *"lets not put to book on trips not confirmed. i dont want to get confused and book something that Hubby decides not to go."*

### No prices anywhere
No flight cost, no hotel cost, no totals — ever. Cost lives in email/booking confirmation, not in this doc. Per owner: *"we dont need flights price or any of that."*

### Final bookings always go in Trips.html
Every finalized booking (flight, train, hotel, car rental, tour) saves directly in Trips.html. Not chat-only, not Apple Notes, not email, not a side doc.

### Hotel name is never a hyperlink
Hotel name is plain text only. The only link on a hotel block is the 📍 Maps pin. Per owner: *"we don't need a link for the hotel website."*

### Venue blocks must have a website link — never miss this
Per owner 2026-06-25: every venue entry must include a 🌐 website link in addition to the 📍 Maps pin. For conferences, link the conference website. For event venues, link the venue or event page. Look it up if unknown — don't ship a venue block without it.

Format:
```html
<p>🌐 <a href="https://...">short-label.org</a></p>
```

Place it after the Maps link (and after the phone number if one is present). The label should be the bare domain or a short readable name — not the full URL.

### One 🏨 icon per trip card
The hotel emoji appears only on the section label. Don't use it again on individual hotel names inside the block — it gets too busy.

### Plain-text address is mandatory on every hotel and venue
Per owner 2026-05-18: every hotel and every venue must have an `.addr-copy` line above the Maps pin link. Skip this and the doc fails its primary on-the-ground use case (one-tap copy into Uber).

### Who-tag is mandatory on every section
Per owner 2026-05-18 (updated *"i like the lable but no need to repeat before and after"*): every content `.sec` carries the who-tag on its header — `🔵 Wifey`, `🟢 Hubby`, or `🟣 Both`. The booking-names inside don't repeat it. If you're not sure which one applies, ask owner — don't pick by default.

### Every night must have a hotel for every traveler
Per owner 2026-05-18 (*"is he sleeping in the streets?"*): both owner and Hubby use this file alongside their calendar. For every night of a trip, the file must show a hotel for everyone who's traveling. If Hubby is at an offsite event before reuniting with owner, his offsite-period hotel goes in the file — even if it's "Hubby solo" and not paid for from Wifey's account. The point is the trip should narratively make sense for both of them.

### Cross-check against the calendar
Before publishing any update to a trip, list the calendar events for that date range (`list_events`) and verify:
- Every confirmed hotel on the calendar appears in `Trips.html` with the same dates and address. Use the calendar address when they differ — it's the booking source of truth.
- Every traveler has continuous accommodation for every night of the trip.
- Flight times/numbers match.

If something is in `Trips.html` but not on the calendar (e.g. an offsite-arranged hotel that FRO booked for Hubby), note it inline — don't quietly drop it.

---

## Flight format details

- Date: `Mon DD` (e.g. May 16, Jul 24)
- Time: `H:MM AM/PM` 12-hour clock (e.g. 5:40 PM)
- Airport codes: IATA 3-letter
- Flight numbers: full `DL####` form
- No "Nonrefundable" annotation — flights are always nonrefundable, label is redundant
- Pending flights on unconfirmed trips: just show the route (`SEA → ICN`), no red callout
- Separate intra-trip legs (not part of main ticket): flag as `· to book (separate leg)` in red

---

## Train operators by country

| Country | Operator | Booking site |
|---|---|---|
| Portugal | CP (Alfa Pendular = fast intercity) | cp.pt |
| Italy | Trenitalia / Italo | trenitalia.com |
| France | SNCF | sncf-connect.com |
| Spain | Renfe | renfe.com |
| UK | National Rail | nationalrail.co.uk |
| Germany | DB | bahn.de |

---

## Icons — reuse existing, don't invent

Use icons already established in the guide vocabulary. Don't introduce new ones unless there's genuinely no equivalent. Established icons: 📋 overview · 🏨 hotel · 🚆 train · 📍 location · 📖 reading · ✈️ flights · 🚗 car rental · 🎟 tour/ticket · 🚶 walk · 🚕 rideshare.

---

# Shared Calendar — Rules

Per owner 2026-05-19: trip rules and calendar rules live in this one document. The shared **Hubby&Wifey Trips** Google Calendar is the second surface for trip data; `Trips.html` is the first. Both stay in sync.

## ✅ Calendar event checklist — run EVERY time (per owner 2026-05-20 "make sure this is done right from now on")

Before considering any calendar event done, confirm all of these. Most of this list exists because each item was missed at least once.

1. **Right calendar** — shared `Hubby&Wifey Trips` (`5bcee1b776f6103a8448fc95742c5f39c57497de53bbf9abc085cd55ef9c7763@group.calendar.google.com`), not Wifey's primary.
2. **Address in the `location` field** — full street address. ⚠️ `create_event` has SILENTLY DROPPED `location` on all-day events. After creating, ALWAYS re-list/re-read the event and confirm `location` is present. If it's missing, set it with `update_event` (which persists reliably).
3. **Phone in the `description`** — `📞 +country-code …`. Mandatory on every hotel. Research it if unknown before marking done.
4. **Color matches who** — 🟢 Sage green (`colorId 2`) for Hubby solo AND owner+Hubby together (incl. shared flights); 🟣 Grape purple (`colorId 3`) for Wifey solo. Flights they take together are GREEN, not blue.
5. **No extras** — no seat numbers, no room types, no meal plans, no "KLM operated", no rate names/prices. Hotel = name + dates + address + phone. Flight = route + flight#. (Confirmation numbers are allowed in the description.)
6. **No duplicates** — if it's on the shared calendar, it must NOT also be on Wifey's primary. Delete the primary copy.
7. **Every night covered for both travelers** — no one "sleeping in the streets".
8. **Matches `Trips.html`** — same name, dates, address, phone, color.

Reads (`list_events`, `list_calendars`) run silently. Writes (`create`/`update`/`delete`) each trigger a Cowork approval prompt — that's the platform, not a Claude limit; don't try to bypass it.

## Calendar identity

- **Name:** `Hubby&Wifey Trips`
- **ID:** `5bcee1b776f6103a8448fc95742c5f39c57497de53bbf9abc085cd55ef9c7763@group.calendar.google.com`
- **Used by:** owner + Hubby. Both reference this calendar for trip logistics.

Wifey's primary `bellinello@gmail.com` calendar holds personal stuff and some duplicates that pre-date the shared calendar — over time, trip events should consolidate to the shared calendar.

## What goes on the shared calendar

Per owner 2026-05-19 (*"everything that is booked should be in the calendar. we both use the trips shared calendar"* + *"all leos stuff needs to be there. hotel name and address"*):

**Every confirmed/booked trip item lands on the shared calendar.** That includes:
- Hotels — Wifey's, Hubby's, and Together. Hubby's solo hotels (e.g. Arribas during FRO offsite) are still in even when owner didn't do the booking — they keep both travelers' picture complete.
- Flights — every leg, including outbound and return.
- Trains — every booked segment.
- Car rentals — pickup/dropoff.
- Tours / venues with a fixed date and time (e.g. Sintra Tour, FLoC sessions).

**What stays off the calendar (per owner 2026-05-19 — *"only add the confirmed stuff"*):**
- Anything with badge 🤔 Not confirmed in `Trips.html` (Seoul, Germany, anything held pending Hubby's confirmation).
- Anything with badge 📋 Planning where no date is locked yet (e.g. Iceland June TBD — flights, hotel, car all `to book`).
- Hypothetical or backup itineraries.

Promote events to the calendar the moment a booking is confirmed and dates lock in.

## Event color scheme — matches Trips.html who-tags

Calendar event colors mirror the `who-tag` pill colors in `Trips.html` so the two surfaces tell the same story at a glance:

| Who | Trips.html tag | Calendar color | Google `colorId` |
|---|---|---|---|
| Wifey solo | 🟣 `tag-solo` (purple) | Grape | `3` |
| Hubby solo | 🟢 `tag-leo` (green) | Sage | `2` |
| owner + Hubby | 🟢 `tag-together` (green) | Sage | `2` |

Mental model: anything involving Hubby → green. owner alone → purple. The Calendar Parity Rule applies in both directions.

## Required event fields

Every calendar event for a hotel, flight, or train must carry:
- **Summary** — emoji + concise label. Hotel pattern: `🏨 [City or neighborhood] — [Hotel Name] · [Who]`. Flight pattern: `✈️ [ORIG] → [DEST] · [Flight#]`.
- **Location** — full plain-text address (rideshare-friendly: commas, no `·` separators).
- **Color** — per the table above.
- **Description** — short context (e.g. "Hubby at FRO offsite", "Booked on Wifey's Hyatt account — request receipt under Hubby's name"). Confirmation numbers and booking refs can live here even though they're banned from `Trips.html`.
- **Start/end dates** — for all-day hotel stays, the end date is the day AFTER checkout (Google Calendar all-day end is exclusive but Wifey's pattern is to span the checkout day inclusively, so end-date = checkout-date + 1).

### 🚫 Essentials only — no extras, anywhere

Per owner 2026-05-20 (*"the code was adding tons of extras"* + *"did i tell you to add canal view etc?"* + *"i want this is the rules too. do not add any of that to the trips HTML or calendar"*): hotel entries — in `Trips.html` AND on the calendar — carry ONLY the essentials. Nothing else.

**Hotels — the only allowed fields:** hotel name · dates · address · phone (· Maps link in Trips.html). That's it.

**Never add (owner never asked for these — they are clutter):**
- Room type / bed type ("Deluxe Twin", "1 King Classic Ocean View", "Standard Room", "2 Twin Bed With View")
- Meal plan ("Breakfast", "Breakfast daily")
- Room features ("canal view", "Balcony", "City view", "ocean view")
- Rate names, free-cancel dates, prices
- Flight extras: "KLM operated", seat numbers, "Nonrefundable"

**Flights — only:** date · time · route · flight number (· land/arrive time if useful). No operator notes, no seats.
**Trains — only:** date · route · type/duration · booking action if still needed.

If you're tempted to add a descriptive detail "to be helpful" — don't. owner will ask for it if she wants it. Default to less.

### 🚨 Address is mandatory on every hotel — NEVER miss this

Per owner 2026-05-20 (*"Why does the calendar not have the hotel address? The most important data?"*): **every hotel event — on the calendar AND in `Trips.html` — must carry the full street address.** This is the piece of data owner actually needs on the ground (navigation). Non-negotiable.

Per owner 2026-06-25: **phone numbers are no longer included anywhere** — not in `Trips.html`, not in calendar events.

- **Calendar:** address goes in the `location` field (so it's tappable → Maps). Verify it saved — the create_event call has dropped `location` silently before (2026-05-19 bug); always re-read the event after creating and confirm `location` is present.
- **`Trips.html`:** address in the `.copy` block (copyable, `user-select: all`).

When the create tool silently drops `location`, fix it with `update_event` (which persists it correctly) — don't leave the event address-less.

## Trips.html ↔ Calendar parity rules

These two surfaces are kept in sync — any addition or change on one propagates to the other. Per owner 2026-05-18 (*"is he sleeping in the streets?"*): every traveler should have continuous accommodation on both surfaces for every night of every confirmed trip.

When adding or editing in `Trips.html`:
1. Confirm the booking exists in some source of truth (email, confirmation).
2. Add or update the corresponding calendar event on `Hubby&Wifey Trips`.
3. Color matches the who-tag.
4. Address matches the `.addr-copy` line exactly.

When adding or editing on the calendar:
1. Update `Trips.html` with the same name, dates, and address.
2. Apply the matching who-tag color in `Trips.html`.

If a calendar event is removed (booking canceled), remove or mark the matching `Trips.html` block as canceled in the same session.

## Calendar event creation needs Wifey's approval

Per the Cowork safety model: every calendar write (create, update, delete) triggers a one-time approve/reject prompt for owner. This is not a Claude limitation — it's the connected-app permission boundary. Don't try to bypass; if owner rejects, re-read intent and ask before retrying.
