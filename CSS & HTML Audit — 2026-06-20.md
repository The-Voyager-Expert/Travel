# CSS & HTML Audit — The Voyager Expert Travel Site
**Date:** 2026-06-20

---

## 1. CSS Architecture

### Files and Their Roles

| File | Serves | Role |
|------|--------|------|
| `Travel-Website/assets/_travel_style.css` | All Trip-Essentials pages | Shared baseline for non-guide pages |
| `Travel-Website/assets/guide_v3.css` | All city guide HTML files | Guide-specific; deployed copy synced FROM `Brain/Reference/Guide Style.css` |
| `Travel-Website/assets/mobile.css` | All shareable pages except guide HTML | Universal mobile baseline; loaded AFTER page stylesheet |
| `Brain/Reference/Guide Style.css` | Source of truth for guides | **Never deployed directly** — edit here, then `sync-css` copies to `guide_v3.css` |
| `Brain/Reference/Core Rules Style.css` | `Brain/CORE RULES/*.html` docs | Internal rule-doc formatting only; not site-facing |
| `Travel/On Demand/_style.css` | `Travel/On Demand/*.html` docs | On-demand doc formatting only; not site-facing |

**Sync command:** `python3 Brain/scripts/guide_tools.py sync-css`  
**Current sync stamp:** `2026-06-11` (present in both `Guide Style.css` and `guide_v3.css`; files confirmed identical at line-by-line check)

---

### Key CSS Variables — `guide_v3.css` `:root` (Guide Pages)

| Token | Value | Usage |
|-------|-------|-------|
| `--c-warm-bg` | `#fdf8f0` | Section cards, boxes, banners |
| `--c-brand` | `#8a6c1a` | Section titles, day headers, overview accents |
| `--c-brand-hover` | `#faefd8` | Hover state |
| `--c-link` | `#2867c4` | Global link color (blue) |
| `--c-text-primary` | `#1a1a1a` | All body text |
| `--c-text-muted` | `#555` | Empty states, captions |
| `--c-page-bg` | `#f5f4f0` | Page background |
| `--c-card-bg` | `#fff` | Card / day-block background |
| `--fs-base` | `14px` | Body, box rows, transit |
| `--fs-header` | `15px` | Day headers, extras section titles |
| `--font-family` | `'Roboto', Arial, sans-serif` | |

### Section Border Tokens (`guide_v3.css`)

| Section | Token | Value |
|---------|-------|-------|
| 🗓 Weekly Closures | `--c-closures-border` | `#8b3520` |
| 📅 Tours | `--c-tours-border` | `#a61c00` |
| ☕ Cappuccino | `--c-cappuccino-border` | `#7030A0` |
| 🫕 Restaurants Near Hotel | `--c-nearhotel-border` | `#700f31` |
| 🍽️ Downtown | `--c-downtown-border` | `#5c036d` |
| 🍮 Local Tastes | `--c-tastes-border` | `#e08a1f` |
| 🚗 Food Delivery | `--c-delivery-border` | `#9b2335` |
| 🎭 Shows | `--c-shows-border` | `#5a74c4` |
| 🚌 Getting Around | `--c-gettingaround-border` | `#1c8a99` |
| 🚆 Train Stations | `--c-stations-border` | `#3d5282` |
| ⛲️ Day Trips | `--c-daytrips-border` | `#0d6b7a` |
| ⭐ Michelin | `--c-michelin-border` | `#BA7517` |
| 🏓 Pickleball | `--c-pickleball-border` | `#792a45` |
| ❗ Heads Up | `--c-headsup-border` | `#b91c1c` |

### Key CSS Variables — `_travel_style.css` `:root` (Trip-Essentials Pages)

| Token | Value |
|-------|-------|
| `--bg` | `#f5f4f0` |
| `--warm` | `#fdf8f0` |
| `--surface` | `#ffffff` |
| `--border` | `#d8d4cc` |
| `--border2` | `#e6e2da` |
| `--text` | `#1a1917` |
| `--muted` | `#6a6660` |
| `--accent` | `#8a6c1a` |
| `--hover` | `#faefd8` |
| `--font` | `'Roboto', Arial, sans-serif` |
| `--fs-body` | `14px` |
| `--fs-sub` | `12px` |
| `--fs-label` | `11px` |

---

### Conflicts and Duplications

1. **Duplicate `:root` in Trip-Essentials pages.**  
   `Safety-Guide.html` (and likely other Trip-Essentials pages) defines its own `:root` inline that redeclares every color token from `_travel_style.css`. Values currently match, but any future change in `_travel_style.css` won't cascade unless both are updated.

2. **`Guides-Index.html` is fully self-contained.**  
   No external CSS link — all styles are inline. Redeclares the same color tokens. Search and pill specs match the canonical values but are not DRY.

3. **Font-family split (intentional).**  
   - Guide pages (`guide_v3.css`): `'Roboto', Arial, sans-serif`  
   - Trip-Essentials + On Demand + Guides-Index: `-apple-system, BlinkMacSystemFont, 'Segoe UI', ...`  
   Two distinct typographic stacks across the site. Intentional (guides load Google Fonts; trip-essentials do not).

4. **`--c-text-primary` value drift.**  
   `guide_v3.css`: `#1a1a1a` vs `_travel_style.css`: `#1a1917`. Visually negligible but technically inconsistent across page types.

---

## 2. Validator: What It Enforces

Source: `Brain/Reference/Validator Index.html` (last updated 2026-06-19).  
Legend: ✅ hard-fail automated | ❌ human-only | ⚠️ suppressible warning

### Core Rules Integrity & Build State
- ✅ SHA-256 checksums file present and readable
- ✅ CORE RULES directory reachable
- ✅ No CORE RULES HTML modified without permission (hash check)
- ✅ Build-state tracker present at `_build/build_state.md`
- ✅ Phase 1–5 entries checked per build phase

### Document Head
- ✅ DOCTYPE html present
- ✅ `lang="en"` on `<html>`
- ✅ `<meta charset="UTF-8">`
- ✅ Viewport meta with `width=device-width`
- ✅ Title format: `"<City> — <Dates>"` (em-dash)
- ✅ No `<h1>` tags in guide body
- ✅ Nothing before `.title-page` inside `.container` (toolbar exempted)
- ✅ No inline `<style>` block in `<head>`
- ✅ Stylesheet link is canonical `../../assets/guide_v3.css`
- ✅ No Google Fonts link in guide head
- ✅ No malformed HTML entities
- ✅ No bare domain names in visible text (must be `<a>`)

### Links
- ✅ All external links `target="_blank"` (except `tel:`, `mailto:`)
- ✅ Every 📍 is a Google Maps link with locked URL pattern
- ✅ Address anchors: no country leak, middle-dot separator
- ✅ No postal/ZIP codes in 📍 anchor text
- ✅ 📍 opens its own `<div>` row — never merged
- ✅ Wikipedia link text is exactly `Wikipedia`
- ✅ 📖 row format, wrapper, and position enforced
- ✅ Every stop carries a 📖 Wikipedia row (or sentinel)
- ✅ no-wikipedia sentinel abuse check (cited usable article → must link)
- ✅ No market/bazaar/souk/bookshop/arcade as a stop
- ✅ Every stop carries ⏰ Avg Time Spent
- ✅ 🎒 backpack emoji banned (retired 2026-06-16)
- ✅ No city-landing tour links (must be specific product page)
- ❌ Whether Google Maps URL points to correct place
- ✅ 📍 Maps link display text must not contain home city name

### Stop Titles
- ✅ Every stop has `.stop-num` + `.stop-name` pair
- ✅ `.stop-num` format `{N}.` (digit + period)
- ✅ No `<h3>` inside stop blocks
- ✅ `.stop-name` carries type-modifier class (`self` only — `guided`/`train` retired)
- ✅ Exactly ONE type-modifier class per `.stop-name`
- ✅ No literal emoji typed into `.stop-name` text
- ✅ No `+` connector in stop names
- ✅ Stop numbering resets to 1 per day, consecutive
- ✅ Non-empty `.stop-name` text content
- ✅ Plain text only in `.stop-name` (no inner HTML)
- ✅ No duplicate stop names within a day
- ✅ Generic labels banned ("Lunch", "Dinner", "Walking Tour", etc.)
- ✅ No build annotations in `.stop-name`

### Stop Descriptions
- ✅ ↳ row ≤ 320 chars
- ✅ ↳ row required per stop block
- ✅ ↳ row has no embedded links
- ✅ ↳ and 📖 not merged
- ✅ 📖 after ↳, before boxes
- ✅ No two icons back-to-back
- ✅ No stray `<p>` inside stop blocks
- ✅ Parentheses banned in all visible text
- ✅ No commas in titles or row data (`.extras-title` exempt)
- ✅ Time format: `9:00am` not `9am`; range uses spaces around dash
- ✅ No `~` except after ⏰
- ✅ Stop-block canonical element order enforced
- ✅ Every `.stop-block` has at least one 🏛️ opening-hours row
- ✅ No `.stop-block` with 🚶 walk time > 40 min (suppressible with sentinel)
- ✅ 🚶/🚕 zero-time hard fail
- ❌ Whether description is accurate or well-written

### Photos
- ✅ Guide has at most 1 "No pictures found." stop (tightened 2026-06-20 from ≤2 to ≤1)
- ✅ `.stop-photos-empty` requires `<!-- no-photo-reason: -->` sentinel ≥10 chars
- ✅ Every `.stop-block` has `.stop-photos` wrapper (or sentinel)
- ✅ Exactly 1 `<img>` per `.stop-photos` wrapper
- ✅ No inline style on img or wrapper
- ✅ `src` starts with `_build/assets/` and `800px-`
- ✅ Non-empty `alt`; not prefixed "photo of / image of / picture of"
- ✅ Empty wrapper: exact `<em>No pictures found.</em>`
- ✅ No artwork/painting filenames; no weak filenames
- ✅ No `upload.wikimedia.org` hotlinks (all hard-fail, no sentinel exemption)
- ✅ No external hotlinks in `src`
- ✅ `.stop-photos` is LAST element inside `.stop-block`
- ✅ Duplicate `src` filenames banned
- ✅ Every img file resolves on disk (magic-byte + min 250px dimension check)
- ❌ Whether photo shows correct subject

### Flag Rows (🏛 / ⏰ / 🚫 / 🆓 / 💵 / ⚠️ / 📅)
- ✅ 🏛️ strict format (must include variation selector U+FE0F)
- ✅ ⏰ duration-only; `~` prefix required; no prose tail
- ✅ ⏳ standalone duration-only
- ✅ 🚫 format: exactly `🚫 Closed {Full weekday(s)}`
- ✅ 🚫 closed days never stacked (collapse into one row with `–` or `&`)
- ✅ 🆓 exactly `🆓 Free`; required on free stops (with exemptions)
- ✅ 💵 exactly `💵 Cash Only`
- ✅ Universal stop-box inner row order enforced
- ✅ 🏛 OR ⏳ mutual exclusion; ⏰ OR 🕐 mutual exclusion; 🆓 OR 💵 mutual exclusion
- ✅ Venue days fully covered (🏛 + 🚫 = 7 days)
- ✅ Information rows plain text (no `<a>` in 🏛 / ⏰ / 🆓 / 🚫 / 💵 / ⚠️)

### Day Structure, Motion Rule, Toolbar
- Toolbar checks: TB-1 through TB-11 (position, data-depth, connectivity)
- Day-structure order, day-header format, day-count consistency
- Motion Rule: every day-block has exactly 1 `.motion-row`

### Global Checks
- ✅ Placeholder text ban
- ✅ Zero-money values banned
- ✅ Tilde ban (outside ⏰)
- ✅ CSS `text-transform` on `<a>` banned

### Extras Sections (all 14 section types validated)
Tours, Weekly Closures, Cappuccino, Restaurants Near Hotel, Downtown, Local Tastes, Food Delivery, Shows, Getting Around, Train Stations Near Hotel, Day Trips by Train, Michelin, Pickleball, Heads Up, Claude Inspiration, Skip List

### Final Gate
- ✅ Open `❓` questions in city's To Do entry block ship

---

## 3. Search Bar & Pill Standard

**Current canonical (updated 2026-06-20 — width enlarged from 260px to 360px):**

### Search Bar
| Property | Value |
|----------|-------|
| Width | `360px` |
| Padding | `11px 18px` |
| Font-size | `15px` |
| Border | `1.5px solid var(--border2)` / `#e6e2da` |
| Border-radius | `6px` |
| Line-height | `1` |
| Focus border-color | `#B8860B` |
| Focus box-shadow | `0 0 0 3px rgba(184,134,11,.12)` |
| Placeholder color | `#A8895A` |
| Position | Centered horizontally on its own row; pills on the row below |

### Filter Pills
| Property | Value |
|----------|-------|
| Padding | `6px 12px` |
| Border | `1px solid var(--border2)/#e6e2da` |
| Border-radius | `6px` |
| Background | `var(--warm)/#fdf8f0` |
| Font-size | `13px` |
| Line-height | `1` |

**Reference shape:** `Safety-Guide.html` `.badge` class — confirmed correct.

### Verification Status
| Location | Width | Radius | Padding |
|----------|-------|--------|---------|
| `_travel_style.css` `.search-input` | 360px ✅ | 6px ✅ | 11px 18px ✅ |
| `Safety-Guide.html` `#city-search` | 360px ✅ | 6px ✅ | 11px 18px ✅ |
| `Guides-Index.html` `#guide-search` | 360px ✅ | 6px ✅ | 11px 18px ✅ |
| `Safety-Guide.html` `.badge` (pill) | — | 6px ✅ | 6px 12px ✅ |
| `Guides-Index.html` `.mchip` (pill) | — | 6px ✅ | 6px 12px ✅ |
| `Guides-Index.html` `.fchip` (filter chip) | — | 6px ✅ | **4px 10px ⚠️** |
| `mobile.css` pill override | — | 6px ✅ | 8px 14px (mobile tap-target, acceptable) |

**Gap:** No structural `.pill` rule in `_travel_style.css` itself. Pill shape is defined per-page inline. Consistent values but not DRY.

---

## 4. Conformance Sample

### Paris (`paris_v7.html`)
| Check | Result |
|-------|--------|
| CSS link | `../../assets/guide_v3.css?v=20` ✅ |
| mobile.css NOT linked in guide | ✅ (correct — guides use guide_v3.css's own block) |
| DOCTYPE + `lang="en"` | ✅ |
| Viewport meta | ✅ |
| No `<h1>` in body | ✅ |
| Toolbar `data-depth="2"` | ✅ |
| `.title-page` — all 4 children | ✅ |
| Stop-name modifier = `self` | ✅ |
| `guided` modifier retired | ✅ confirmed absent |
| 📖 placement (after ↳, before boxes) | ✅ |
| Validation stamp | `passed 2026-06-20 10:54` ✅ |
| `.overview-day-stops` div | ⚠️ Missing — stop names embedded in title string |

### London (`london_v5.html`)
| Check | Result |
|-------|--------|
| CSS link | `../../assets/guide_v3.css?v=20` ✅ |
| DOCTYPE + `lang="en"` | ✅ |
| `.title-page` — all 4 children | ✅ (`title-country: UK`) |
| Toolbar `data-depth="2"` | ✅ |
| Stop-name modifier = `self` | ✅ |
| `warn-ok` sentinels for exceptions | ✅ properly suppressed |
| Validation stamp | `passed 2026-06-20 10:54` ✅ |
| `.overview-day-stops` div | ⚠️ Missing — same pattern |
| Stop header wrapper | Uses `<div class="stop-header">` — per spec ✅ |

### Turin (`turin_v14.html`)
| Check | Result |
|-------|--------|
| CSS link | `../../assets/guide_v3.css?v=20` ✅ |
| DOCTYPE + `lang="en"` | ✅ |
| `.title-page` — all 4 children | ✅ (`title-country: Italy`) |
| Toolbar `data-depth="2"` | ✅ |
| Stop-name modifier = `self` | ✅ |
| Validation stamp | `passed 2026-06-20 10:55` ✅ |
| `.overview-day-stops` div | ⚠️ Missing — same pattern |

### Safety-Guide.html
| Check | Result |
|-------|--------|
| CSS link | `../assets/_travel_style.css` ✅ |
| `#city-search` dimensions | 360px / 6px / 11px 18px ✅ |
| `.badge` pill shape | 6px 12px / 6px radius / warm bg ✅ |
| Font stack | `-apple-system ...` (no Roboto) — intentional |
| Inline `:root` tokens | Mirrors `_travel_style.css` — maintenance risk |
| `.search-row` visibility | `display: none` by default (JS controls display) |

### Guides-Index.html
| Check | Result |
|-------|--------|
| External CSS link | None — fully inline ⚠️ (maintenance risk) |
| `#guide-search` dimensions | 360px / 6px ✅ |
| `.mchip` pills | 6px 12px / 6px radius ✅ |
| `.fchip` filter chips | **4px 10px** padding ⚠️ (should be 6px 12px) |

---

## 5. Issues Found

### ⚠️ Issue 1 — `.fchip` padding in Guides-Index does not match canonical pill spec
**Where:** `Guides-Index.html` inline CSS  
**Value:** `padding: 4px 10px` (radius 6px is correct)  
**Standard:** `padding: 6px 12px`  
**Severity:** Minor visual inconsistency — region/country/status filter chips are slightly smaller than the reference shape.

### ⚠️ Issue 2 — `.overview-day-stops` div absent across all sampled guides
**Where:** `paris_v7.html`, `london_v5.html`, `turin_v14.html`  
**What:** `guide_v3.css` doc comment specifies `.overview-day` should have two child divs: `.overview-day-title` AND `.overview-day-stops`. In all sampled guides, stop names are folded into the title string directly. All three guides passed validation, so either this is accepted practice or the CSS comment is aspirational/stale.

### ⚠️ Issue 3 — Duplicate `:root` in Trip-Essentials pages
**Where:** `Safety-Guide.html` and likely other Trip-Essentials pages with inline `<style>` blocks  
**What:** Full `:root` redeclares all tokens from `_travel_style.css`. Values match now; maintenance risk if tokens ever change in one place.

### ⚠️ Issue 4 — Guides-Index.html has no external CSS link
**Where:** `Guides-Index.html`  
**What:** Entirely self-contained. Does not link `_travel_style.css`. Color tokens, search, and pill specs match canonical values but are duplicated inline.

### ℹ️ Note — Font-family split is intentional
Guide pages: `'Roboto', Arial, sans-serif`  
Trip-Essentials: `-apple-system, BlinkMacSystemFont, 'Segoe UI'...`  
Not a bug — guides load Roboto from Google Fonts; trip-essentials do not. Two distinct typographic stacks.

### ℹ️ Note — `--c-text-primary` value drift
`guide_v3.css`: `#1a1a1a` vs `_travel_style.css`: `#1a1917`. Visually negligible (3 LSBs difference).

---

## Summary

| Area | Status |
|------|--------|
| `guide_v3.css` ↔ `Guide Style.css` sync | ✅ In sync (stamp 2026-06-11) |
| Search bar 360px / 6px radius | ✅ Consistent across all checked pages |
| Filter pill 6px radius | ✅ All checked pages |
| Filter pill `6px 12px` padding | ⚠️ Guides-Index `.fchip` uses `4px 10px` |
| Guide CSS link path | ✅ All 3 sampled guides: `../../assets/guide_v3.css?v=20` |
| `.title-country` present | ✅ All 3 sampled guides |
| Validation stamps current | ✅ All 3 guides passed 2026-06-20 |
| `.overview-day-stops` div | ⚠️ All 3 guides omit it (stop names in title string) |
| Duplicate `:root` tokens | ⚠️ Safety-Guide + Guides-Index self-define shared tokens |
| Font-family consistency | ℹ️ Intentional two-stack split |
