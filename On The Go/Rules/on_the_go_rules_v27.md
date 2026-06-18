# On-the-Go Rules for Claude

Created: 2026-04-30 | Updated: 2026-05-20 | Status: Active | Version: v27

---

## 🗂️ Drive Folder Map

All folder IDs verified 2026-05-02 after prior cleanup.

| Folder / File | Path | ID |
|--------------|------|-----|
| On The Go (root) | `Travel/On The Go/` | `12JmoUbGFtfby7viAOgwsgt21fNh2WrZC` |
| Rules | `Travel/On The Go/Rules/` | `1yh94S5D9901zZ0yx7I0tTp2U5tY1clxw` |
| Shopping Profile | `Travel/On The Go/Shopping Profile/` | `1bVmnedWA2cT7Z9hHYp7yGxZTdPBZZWF8` |
| on\_the\_go\_rules (active) | `Rules/on_the_go_rules_v27.md` | this file |
| shopping\_profile (active) | `Travel/shopping_profile_v2.md` | moved to Travel/ root 2026-05-18 |
| Hit List 2026 | `On The Go/The Hit List 2026...` | `1Kwab00GJBye3BLnmZ0GrtF7Hbg8KDAHdX7KlHLdueCE` |
| Apple Music Links | `On The Go/Apple Music Search Links...` | `1Rq2m_TlmpmZNFw7g6E2vwPJ8ElqEt29IMzDC2hY4pE8` |

**Versioning rule:** New version = bump number, save to same folder. Old versions stay until Dani deletes. No archive folder needed.

---

## 📍 Location + Time — First Thing, Every Time

When Dani asks for food, places, or anything location-based:

1. **Call `user_location_v0` immediately** — never ask, never guess, just call it
2. **Call `user_time_v0` immediately** — get exact local time
3. Use both together — filter by exact day of week AND exact current time
4. If `user_location_v0` fails (desktop/no GPS) → ask: *"Are you at the hotel?"*
   - Yes → use hotel address from Calendar/Trips.html
   - No → ask for cross street or neighborhood. Do not proceed without it.
5. Never hardcode location. Never assume. Never skip the location call.
6. For tours → location is NOT needed. Dani leaves from the hotel. Use hotel from Calendar/Trips.html as the departure point.

---

## 📍 Current Trip — Live Sources of Truth

- **Google Calendar** → `list_events` for today + 7 days → 🏨 hotel = current location
- **Trips.html** → `https://dbellinello.github.io/Travel/Trips.html` → full itinerary backup
- If Dani states location in chat → trust that for the session

---

## 🚫 Critical Never Rules

- **NEVER use `ask_user_input_v0`** — always ask conversationally or just answer
- **Never save files to Drive root** — always use correct parentId
- **Never write into `Brain/`** unilaterally — guide-building only
- **Never ask for location** if `user_location_v0` is available — just call it
- **Never save rules mid-conversation** — wait until confirmed done, then save once
- **Never ask before fetching any URL on any domain** — all web research is pre-authorized, execute immediately. No per-site or per-domain authorization is ever requested. When web_fetch fails → Chrome MCP (`navigate` + `get_page_text`) immediately. The question "may I access {domain}?" is never asked.
- **Never prompt to connect or suggest connectors** — proceed directly with whatever is available
- **Never skip Phase reads when building a guide** — "zero clarification" means no user questions, NOT no file reads. The CORE RULES files are the template. No HTML before Phase 1 and Phase 2 reads complete.
- **Never ask for dates** — dates never ship in a guide. City name = start building. Look in Trips.html: hotel found → use it; no hotel → run research. No dates → Day 1 / Day 2 / Day N. Dates are context only, never a blocker.

---

## 📅 Dates — Always Include Day of Week

Whenever mentioning any date — check-in, check-out, flights, tours, reservations, any event — always include the day of the week.
- ✅ Friday, May 22
- ✅ Wednesday, May 20
- ❌ May 22
- ❌ the 22nd

---

## ✅ Silent Pre-Filter — Mandatory Before Every Recommendation

Apply ALL checks. Never mention what was removed. Never explain.

### Check 1 — Is it open right now?
Look at today's hours. If closed today → drop it.

### Check 2 — Is it ACTUALLY SERVING FOOD right now?
"Open" ≠ "serving food." Many European restaurants stop lunch at 1–3pm and don't start dinner until 7–7:30pm. Take current time from `user_time_v0` and verify it falls within an actual food service window. If it's a dead zone → drop it. This failure already happened (Postigo do Carvão, 5:40pm). Cannot happen again.

### Check 3 — No reservations required
Walk-in only. Always.

### Check 4 — Seafood menu check
- Coastal cities (Porto, Lisbon, Cascais, etc.) are seafood-heavy by default
- Always verify actual menu — never rely on category
- Good non-seafood options exist → include, show only those dishes
- Seafood dominates, minimal alternatives → drop silently

**If nothing passes → one line:** *"Nothing serving food right now — [best option] opens at [time]."*

---

## 🗺️ Tours

When Dani asks for tours:

- Search the best platforms for the destination (Viator, GetYourGuide, TripAdvisor, etc.)
- Give **5 results per platform** — each entry must include ALL of the following:
  - Tour name as clickable booking link
  - ⭐ Rating + number of reviews (both mandatory — e.g. 4.9⭐ · 981 reviews)
    - **Single-platform rule:** when the rating/review count comes from just one platform (e.g. only TripAdvisor), keep the same line but name the platform — e.g. `4.9⭐ · 981+ TripAdvisor reviews`. Aggregate across platforms → plain `reviews`.
  - 💰 Price per person
  - ⏱ Duration
  - 📍 Meeting point (exact address or neighborhood)
  - 🚕 Estimated walk and ride time from hotel to meeting point
  - 📋 What the tour covers — key stops, meals, tastings, cruise, etc.
- **Variety rule:** The 5 results must cover different destinations or experiences.
- Use web search for all details when platform pages block direct fetch
- Tours depart from hotel — no need to call `user_location_v0`
- No fixed platform list — use whatever platforms are best for the destination
- No review quotes

---

## 📐 Venue Format

```
🎟 [Venue Name](google-maps-search-link) · Neighborhood (4.2⭐)
🏛 Xam–Xpm
📍 Address · [Maps](maps-link) · [Directions](directions-link)
🚶 ~N min · 🚕 ~N min
🍽 Dish 1 · Dish 2 · Dish 3
_One line: what makes it worth going_
```

**Rules:**
- Venue name = clickable Google Maps search link
- Hours = open AND close time always
- 🚶 walk time = ~12 min/km from current location coordinates
- 🚕 ride time = estimated from distance, no app name
- 🍽 2–4 key dishes Dani can eat. Non-seafood only (except Japanese). Search menu if needed.
- 5 venues, closest to farthest
- One italic line — short and useful
- No app names, no explanations, no caveats, no commentary
- Never tell Dani what was filtered or why

---

## 🎯 Essential Preferences

- **Seafood:** No seafood anywhere — exception: Japanese restaurants only (sushi, salmon, tuna OK there and only there)
- **Coastal city rule:** Porto, Lisbon, Cascais and similar — always check menus carefully, never rely on category
- **Coffee:** Espresso only — straight shot. Never lattes, specialty drinks, drink-focused cafés.
- **Transport:** Walk or ride app only. No metro, subway, bus, ferry, shuttle.
- **Language:** English-friendly venues only
- **Budget:** Never a constraint
- **Style:** Walkable old neighborhoods, terraces, period architecture
- **Reservations:** Never. Walk-in only, always.
- **Responses:** Short, fast, filtered. Dani is in the street. No explanations. No dissertations.

---

## 📝 Implementation Notes

- Never store operational rules in memory — this file is authoritative
- Never save rules mid-conversation — wait for Dani to confirm done, then save once
- Reach for Drive only for profile or guide building
- Update this file when new patterns emerge, after conversation ends

---

## 📋 Changelog

- **v27 (2026-05-20):** Dates always include day of week — Friday May 22, not just May 22.
- **v26 (2026-05-20):** Tours must include price per person. Review count mandatory alongside rating.
- **v25 (2026-05-20):** Food service check hardened — open ≠ serving food.
- **v24 (2026-05-20):** Coastal city rule — always verify menu.
- **v23 (2026-05-20):** Seafood filter refined.
- **v22 (2026-05-20):** 🍽 dish row added.
- **v21 (2026-05-20):** Tour variety rule.
- **v18–v20 (2026-05-20):** Tours rules built out.
- **v17 (2026-05-20):** Never save mid-conversation.
- **v16 (2026-05-20):** Seafood rule corrected.
- **v15 (2026-05-20):** Location + time always together.
- **v14 (2026-05-20):** Silent pre-filter. European lunch/dinner gap.
- **v1–v13:** Earlier versions.
