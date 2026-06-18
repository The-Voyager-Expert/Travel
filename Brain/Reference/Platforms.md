# PLATFORMS — Platform Access & URL Reference

> **Claude maintains this file — fix immediately, no approval needed.** When this file drifts from Brain/CORE RULES/, fix it in the same pass. CORE RULES is the authority; this file follows. No questions, no permission, no parking for later.

> ⚡ **Pre-authorized:** All platform access during a build — web fetches, `site:` searches, Chrome fetches, connector calls — execute immediately, no asking, no confirming. Full rule: `Rules for Claude.html § 3`.

Merged 2026-04-29 from `url_patterns.md` + `platform_access.md` (both archived to `Travel/archive/`).

**Two jobs, one file:**
1. **Access catalog** — can Claude fetch this platform directly, does it need a `site:` workaround, or is it broken?
2. **URL shapes & city IDs** — how to construct a valid product URL for tour/ticket platforms, with verified destination/location/geo IDs per city.

A guide build needs both every time. Keep this file updated as new cities are added and platform statuses change.

---

## 0. MCP Connectors — Use These First

Where available, **prefer MCP connectors over web fetch**. Connectors are faster, return structured data, and don't hit bot-blocks. Full connector list in `Brain/Reference/Connectors.html`.

| Connector | Use for | How to call |
|-----------|---------|-------------|
| **Viator MCP** | Tours, activities, skip-the-line tickets | `search_experiences` → `get_experience_details` |
| **TripAdvisor MCP** | Tours and hotel research (on-demand only, not guide content) | `search_experiences`, `search_hotels`, `hotel_details`, `compare_hotels` |
| **Booking.com MCP** | Accommodation search (on-demand only) | `accommodations_search` |
| **Trivago MCP** | Hotel price comparison across platforms | `trivago-search-suggestions` → `trivago-accommodation-search` |
| **Expedia MCP** | Flights + hotels (on-demand) | `search_flights`, `search_hotels` |
| **StubHub MCP** | Events, concerts, shows | `event-search` → `fetch-listings` |
| **Resy MCP** | Restaurant reservation availability | web search for Google Places ID → `display_resy_restaurant_availabilities_app` |
| **UberEats MCP** | Food delivery search (on-demand; US/major cities) | `search` (by location, cuisine, or restaurant name) |
| **Uber connector** | Ride-hailing trip planning (on-demand; US-only — NOT for guide ride times) | US trip planning only; see Rules below |

**Rules:**
- Viator MCP returns live ratings, prices, cancellation flag, and direct booking URL — use it instead of `site:viator.com` web search when building tour-boxes.
- GYG has no MCP connector — cascade: direct fetch → `site:getyourguide.com` WebSearch → Chrome MCP. All pre-authorized, no asking at any step.
- TripAdvisor MCP covers both tours and hotel research (on-demand) — use it instead of `site:tripadvisor.com` web search when the connector works. Not for shipped guide content.
- **Uber connector is US-only and is NOT for guide ride times.** 🚕 row = mapping-service driving mode (Google/Apple Maps; a local mapping service where neither covers the region, per Motion Rule § 1). The Uber connector exists for trip planning (on-demand), never for shipped guide content.

---

## 1. Access Catalog

**Maintenance model.** Initial canvas: 2026-04-22 (TripAdvisor updated 2026-04-24). Per-row "Last Used" tracking was retired 2026-05-03 — the dates were drifting stale. Platform statuses are updated **on demand** when (a) a build hits a 403/timeout that was previously green, or (b) a re-canvas is requested. Otherwise the catalog is presumed accurate. Add city-specific platforms (local opera houses, transit sites) as new cities are built.

At the start of every guide build, open this file and check status. Bot-blocked platforms have workarounds in place — no action needed. Flag only genuine new failures in ❓ Open Questions (To_Do_List.md), work around, and keep building.

---

### ✅ Direct Access (no workaround needed)

**Trip Planning & Data**
| Site |
|------|
| docs.google.com |
| drive.google.com |
| www.google.com |

- docs.google.com / drive.google.com — Drive MCP available; trip data is now `Trips.html` (read directly, no Drive MCP needed)
- www.google.com — Google Maps (meeting points, transit times, walking distances)

**Tour & Activity Research**
| Site |
|------|
| www.viator.com |
| www.getyourguide.com |

- www.viator.com — ✅ direct; for guide tour-box builds use Viator MCP first (see §0); fall back to direct fetch, then `site:` workaround on 403s
- www.getyourguide.com — ✅ direct (approved 2026-04-22). On 403: `site:getyourguide.com` → Chrome MCP. No MCP connector exists — Chrome MCP is the bot-block override.
- www.klook.com — ⚡ direct fetch returns 403; moved to §Workaround below; primary platform for Asia
- www.tripadvisor.com — ⚠️ bot-blocked as of 2026-04-24 (HTTP 403). Use TripAdvisor MCP first for research (see §0); for URL verification use `site:tripadvisor.com` workaround + log entry; h1-match runs opportunistically when fetch succeeds. See §Workaround below.

**Editorial Research**
| Site |
|------|
| en.wikipedia.org |
| www.nationalgeographic.com |
| www.fodors.com |
| www.ricksteves.com |
| www.roughguides.com |

- www.fodors.com · www.ricksteves.com · www.roughguides.com · www.nationalgeographic.com/travel · en.wikipedia.org — ✅ direct
- www.atlasobscura.com — ⚡ direct fetch returns 403; moved to §Workaround below

**Photos**
| Site |
|------|
| upload.wikimedia.org |

- upload.wikimedia.org — ✅ photo file URLs (direct image load confirmed after commons_photo.py resolves the URL).
- commons.wikimedia.org — ❌ web_fetch blocked; moved to §❌ Failed / Unreachable below. Use WebSearch `site:commons.wikimedia.org` to find filenames, then `python3 Brain/scripts/commons_photo.py "File:{name}"` via bash to resolve 800px URLs. Never direct fetch.
- source.unsplash.com / images.unsplash.com — not used; Wikimedia Commons is the sole photo source

**Train Day Trips — Operators**
| Site |
|------|
| www.omio.com |
| www.thetrainline.com |
| www.trainline.com |
| www.trenitalia.com |
| www.eurostar.com |
| www.nationalrail.co.uk |
| www.bahn.de |
| www.cp.pt |

- www.omio.com — ✅ pan-European aggregator (trains, buses, flights, ferries); used in Day Trips by Train `🎫 book at:` lines alongside the route operator; no MCP connector
- www.thetrainline.com — ✅ pan-European rail (www.trainline.com redirects here)
- www.trenitalia.com — ✅ Italian trains (Frecciarossa, Frecciargento, regional)
- www.nationalrail.co.uk — ✅ UK trains
- int.bahn.de — ✅ Deutsche Bahn / German trains (www.bahn.de redirects here)
- www.eurostar.com — ✅ London ↔ Paris / Brussels
- www.cp.pt — ✅ CP Portugal (Alfa Pendular; approved 2026-04-22)
- www.italotreno.com — ⚡ direct fetch times out; moved to §Workaround below; do NOT confuse with `italo.it` which redirects to a broken Google Sites page
- www.italotreno.it — status unknown post-Apr-21-2026; treat as ⚡; moved to §Workaround below
- www.renfe.com — ⚡ Spain AVE; direct fetch returns 403; moved to §Workaround below
- www.scotrail.co.uk — ⚡ Scotland's national rail operator; returns 403 to the crawler, live in browser (added 2026-06-12, Glasgow build); in `verify_urls.py` BOT_BLOCKED_HOSTS so it warns instead of fails. Use `site:scotrail.co.uk {route}` if a specific page is needed.
**Dining**
| Site |
|------|
| resy.com |

- resy.com — ✅ Resy MCP connector (see §0); tool: `display_resy_restaurant_availabilities_app`. Two steps: (1) web search to confirm restaurant is on Resy + find Google Places ID; (2) call connector with that ID. Not all restaurants are on Resy. Tested live.
- guide.michelin.com — ⚡ bot-blocked; moved to §Workaround below
- www.thefork.com — ⚡ direct fetch blocked; moved to §Workaround below

**Shows & Performances**
| Site |
|------|
| www.operadeparis.fr |
| www.comedie-francaise.fr |
| www.ticketmaster.com |
| www.todaytix.com |
| www.stubhub.com |

- www.operadeparis.fr — ✅ (Palais Garnier + Opéra Bastille)
- www.comedie-francaise.fr — ✅ ⚠️ Salle Richelieu closed for renovations as of January 2026 — verify current venue before building a Shows entry
- www.ticketmaster.com — ✅ US shows (approved 2026-04-22)
- www.stubhub.com — ✅ US shows (resale); also available via StubHub MCP connector (`event-search` → `fetch-listings`); see §0
- www.todaytix.com — ✅ Broadway / Off-Broadway (approved 2026-04-22)
- www.ticketmaster.fr, www.fnacspectacles.com, www.wiener-staatsoper.at, www.arshtcenter.org, www.drphillipscenter.org, roythomsonhall.mhrth.com — all ⚡; moved to §Workaround below

**Ride Apps**
| Site |
|------|
| www.uber.com |
| www.lyft.com |

- www.uber.com · www.lyft.com — ✅ direct (approved 2026-04-22); Uber connector available for US trip planning only — never for guide ride times (see §0)
- bolt.eu · www.freenow.com · www.grab.com · www.olacabs.com — referenced by name only in guide, no fetch needed; freenow.com / free-now.com also ❌ (see §❌ Failed / Unreachable below)
- cabify.com — ⚡ Spain/Latin America ride app; `/es` landing is live but the server times out / drops the connection to the sandbox crawler (confirmed live in browser via Chrome MCP, 2026-06-12, San Sebastián build). In `verify_urls.py` BOT_BLOCKED_HOSTS so a timeout warns instead of fails. Use `cabify.com/es`, never `/es/particulares` (404).

**Food Delivery**
| Site |
|------|
| www.doordash.com |
| www.ubereats.com |

- www.ubereats.com — ✅ UberEats MCP connector live (eats-3p-mcp); see §0. Tools: `search` (restaurants/dishes by location, cuisine, name), `publish_analytics`. Untested end-to-end for guide use; likely US/major cities only.
- www.doordash.com — no MCP connector; reference by name only in Food Delivery section.
- www.foodora.se — ⚡ direct fetch returns 403; moved to §Workaround below; Sweden's main delivery platform (added 2026-06-07, Stockholm build)
- www.just-eat.es — ⚡ Spain food delivery; returns 403 to the sandbox crawler, real page in browser (confirmed live via Chrome MCP, 2026-06-12, San Sebastián build). In `verify_urls.py` BOT_BLOCKED_HOSTS (warns instead of fails). Sibling to the already-listed just-eat.fr / justeat.it / just-eat.dk.

---

### ⚡ Workaround (site: search or Chrome MCP — direct fetch blocked, 403, or timeout)

> ```
> ***DO NOT DELETE THIS BLOCK — THIS IS AN EXCEPTION TO THE RULE OF
> NO REFERENCE OUTSIDE AND SHOULD NOT BE DELETED***
> ```
>
> **Why this block exists.** Viator, GetYourGuide, Michelin, and (as of 2026-04-24) TripAdvisor block automated fetch (HTTP 403). Without the `site:` workaround, every 📅 tour / 🎟️ ticket / Michelin / TripAdvisor link would fail the ship-gate — and the builder would be forced to strip them from every guide. This workaround is the ONLY way to verify these URLs at build time. It is an acknowledged, approved exception to Rule 24; keeping it inside the Brain (here, in this file) is what makes it compliant. Do not trim, collapse, or "clean up" this section — explicitly instructed it must remain visible and intact.
>
> **TripAdvisor note (2026-04-24):** prior wording "TripAdvisor is NOT bot-blocked — fetch directly" is retired but preserved per Rule 11. Live tests from `verify_booking_links.py` returned HTTP 403, so TA is now dual-classified: `site:` log entry mandatory, h1-match fetch opportunistic (the d-ID-reassignment catch still runs when fetch succeeds).
>
> **Platforms already marked ⚡ or ❌ in the Access Catalog — skip the fetch entirely.** Go straight to step 1 below. Direct fetch on a known-blocked platform is a violation.
>
> **What to do when a fetch returns 403 — four-step cascade (execute each step, never ask):**
> 1. Run a WebSearch for `site:{domain} {city} {attraction} tour` (or equivalent).
> 2. Inspect the search-result snippet. If the exact product URL appears with the correct product ID + slug (matching the URL shape in §2 below), that's sufficient verification.
> 3. If the snippet doesn't give enough detail (need full page content, tour descriptions, live ratings) — use **Chrome MCP**: `mcp__Claude_in_Chrome__navigate` to the URL, then `mcp__Claude_in_Chrome__get_page_text`. Chrome renders JavaScript and bypasses bot-blocks. Pre-authorized — execute immediately, no asking.
> 4. Record the URL as verified.

**Tour Booking**
| Site |
|------|
| www.tripadvisor.com |
| www.klook.com |

- www.viator.com — `site:viator.com {city} {attraction} tour`
- www.getyourguide.com — `site:getyourguide.com {city} {attraction} tour`
- www.tripadvisor.com — `site:tripadvisor.com {city} {attraction}` (added 2026-04-24)
- www.klook.com — `site:klook.com {city} {attraction}` (primary platform for Asia)

**Dining**
| Site |
|------|
| guide.michelin.com |
| www.thefork.com |

- guide.michelin.com — `site:guide.michelin.com {city} restaurants`
- www.thefork.com — `site:thefork.com {city} restaurants`. URL shape: `thefork.com/restaurants/{city}-c{CityID}` — city ID live-verified from search result (confirmed 2026-05-30)

**Train Day Trips**
| Site |
|------|
| www.sncf-connect.com |
| www.italotreno.com |
| www.italotreno.it |
| www.renfe.com |

- www.sncf-connect.com — `site:sncf-connect.com {city} train timetables` (French SNCF booking site)
- www.italotreno.com — `site:italotreno.com {city} train` (Italian domestic; direct fetch times out; do NOT use `italo.it`)
- www.italotreno.it — treat as ⚡; same domain cluster as italotreno.com; status unknown post-Apr-21-2026; prefer italotreno.com — use `site:italotreno.com {city} train` as the canonical workaround
- www.renfe.com — `site:renfe.com {city} train` (Spain AVE; direct fetch returns 403)

**Editorial Research**
| Site |
|------|
| www.atlasobscura.com |

- www.atlasobscura.com — `site:atlasobscura.com {city} attractions`

**City Tourism Boards**
| Site |
|------|
| www.parisinfo.com |

- en.parisinfo.com / www.parisinfo.com — `site:parisinfo.com {topic}`

**Shows & Performances**
| Site |
|------|
| www.ticketmaster.fr |
| www.fnacspectacles.com |
| www.wiener-staatsoper.at |
| www.arshtcenter.org |
| www.drphillipscenter.org |
| roythomsonhall.mhrth.com |

- www.ticketmaster.fr — `site:ticketmaster.fr {city} shows {year}`; also on denylist per Rule 179 (not a valid 🎟️ link target in guides)
- www.fnacspectacles.com — `site:fnacspectacles.com {city} spectacles {year}`; also on denylist per Rule 179
- www.wiener-staatsoper.at — `site:wiener-staatsoper.at {opera/ballet title}`; Vienna-specific
- www.arshtcenter.org — `site:arshtcenter.org {event}`; Miami-specific; renders empty to automation, use Chrome MCP if site: yields no results
- www.drphillipscenter.org — Chrome MCP: navigate + get_page_text (Cloudflare bot challenge; live-verified 2026-06-06); Orlando city flagship arts venue
- roythomsonhall.mhrth.com — Chrome MCP: navigate + get_page_text (blocks automated UAs; live-verified 2026-06-07); Toronto TSO concert hall

**City Ticket Stores**
| Site |
|------|
| secure.toronto.ca |

- secure.toronto.ca — Chrome MCP: navigate + get_page_text (city WAF; live-verified 2026-06-07); Toronto Island Ferry ticket store

**Food Delivery**
| Site |
|------|
| www.foodora.se |
| www.menulog.com.au |

- www.foodora.se — `site:foodora.se {city} {restaurant}` (Cloudflare geo-ban on non-Nordic/automated access; added 2026-06-07, Stockholm build)
- www.menulog.com.au — Chrome MCP: navigate (Cloudflare bot challenge "Just a moment…"; live-verified 2026-06-12, Melbourne build); Australia's major food-delivery platform

---

### 🚫 On-Demand Only — Never in Guide

On-demand research only — never ship in guide content. Access status varies per platform (see notes).

**Hotels**
| Site |
|------|
| www.booking.com |
| www.staycity.com |
| www.hilton.com |
| www.hyatt.com |
| www.marriott.com |

- www.booking.com — ✅ direct; also available via Booking.com MCP connector (`accommodations_search`); see §0
- www.staycity.com — ✅ direct (approved 2026-04-22)
- www.hilton.com — ❌ 403
- www.hyatt.com — ❌ 403
- www.marriott.com — ❌ 403
- trivago.com — MCP connector only (`trivago-search-suggestions` → `trivago-accommodation-search`); no direct web fetch needed; see §0

**Flights**
| Site |
|------|
| www.delta.com |
| www.skyscanner.com |
| www.skyscanner.fr |

- www.delta.com — ✅ direct (on-demand only)
- www.skyscanner.com / www.skyscanner.fr — status unknown (no fetch test performed; on-demand only)
- expedia.com — MCP connector only (`search_flights`, `search_hotels`); no direct web fetch needed; see §0

**Car Rental**
| Site |
|------|
| www.hertz.com |
| www.hertz.fr |
| www.europcar.com |
| www.europcar.fr |
| www.enterprise.com |

- www.hertz.com · www.hertz.fr — ✅ direct
- www.europcar.com — ⚡ `site:europcar.com {city} car rental` (direct fetch times out)
- www.europcar.fr — ⚠️ status unknown (no fetch test performed)
- www.enterprise.com — ❌ 403

**Rental Houses & Apartments**
| Site |
|------|
| www.airbnb.com |
| www.airbnb.fr |
| www.vrbo.com |
| www.hometogo.com |
| www.hometogo.fr |

- www.airbnb.com · www.airbnb.fr — ✅ direct (approved 2026-04-22)
- www.vrbo.com — ✅ direct (approved 2026-04-22)
- www.hometogo.com · www.hometogo.fr — ✅ direct

---

### ❌ Failed / Unreachable

**Photos**
| Site |
|------|
| commons.wikimedia.org |

- commons.wikimedia.org — web_fetch blocked ("Web fetch was not allowed"). Use WebSearch `site:commons.wikimedia.org` to find filenames, then `python3 Brain/scripts/commons_photo.py "File:{name}"` via bash to resolve 800px URLs. Never direct fetch.

**Transit**
| Site |
|------|
| www.ratp.fr |

- www.ratp.fr — domain not resolving (2026-04-22); use WebSearch for Paris metro/tram info

**Ride Apps**
| Site |
|------|
| www.freenow.com |
| www.free-now.com |

- www.freenow.com / www.free-now.com — connection refused / rate-limited (2026-04-22); referenced by name only, no fetch needed

---

### ⏳ Unresolved — Retry Next Build

- www.theculturetrip.com — timed out on test (2026-04-22)
- www.oebb.at — Austrian Federal Railways (ÖBB); status untested — add to ✅ Train table when confirmed

---

## 2. URL Shapes

**Rule (canonical in Rules for Claude):** every 📅 tour and 🎟️ ticket link must resolve to a single specific product. Fabricating numeric IDs is a Rule 1 violation — every ID must come from a real search result, never pattern-matching or memory.

**City IDs are NOT stored here.** Pull them live from a real search result URL every time. IDs are not predictable — never guess or reuse from memory.

---

### Viator

**Shape.** `viator.com/tours/{City}/{Tour-Slug}/d{DestinationID}-{ProductCode}`

**NEVER** `viator.com/{City}/d{DestinationID}-ttd` (city landing page — ship-gate fails on it).

**ProductCode** — examples: `6476P66`, `101430P8`. Always live-verified from a real search result.

---

### GetYourGuide

**Shape.** `getyourguide.com/{city}-l{LocationID}/{activity-slug}-t{ActivityID}/`

**NEVER** a bare `getyourguide.com/{city}-l{LocationID}/` (city landing).

**ActivityID** — examples: `t381454`, `t634580`. Live-verified.

---

### TripAdvisor

**Attraction page.** `tripadvisor.com/Attraction_Review-g{GeoID}-d{AttractionID}-Reviews-{Slug}-{City_Region_Country}.html`

**Tour product.** `tripadvisor.com/AttractionProductReview-g{GeoID}-d{ProductID}-{Slug}-{City_Region_Country}.html`

---

## 3. Verification Flow

1. Search via `site:viator.com` / `site:getyourguide.com` / `site:tripadvisor.com` / `site:klook.com` for the specific tour.
2. Copy the exact URL from the search result.
3. For ✅ platforms: fetch and confirm it loads the intended page. For ⚡ bot-blocked platforms: `site:` search-result inspection is sufficient — do not attempt a direct fetch.
4. If no real specific-tour URL is verified, remove the tour box — don't ship a placeholder.

---

## 4. Notes

- **thetrainline.com** redirects to **www.thetrainline.com** — use the redirect URL.
- **bahn.de** redirects to **int.bahn.de** — use the redirect URL.
- **Comédie-Française**: Salle Richelieu closed for renovations as of January 2026 — verify current venue before building a Shows entry. (Also flagged inline in §1 Shows catalog.)
- **ratp.fr**: Paris tram sub-line verification falls back to WebSearch (`"{tram line number} Paris board stop end of line"`).
- **Italo trains**: correct domain is `italotreno.com` (confirmed 2026-04-22; `italo.it` redirects to a broken Google Sites page). Direct fetch times out — use `site:italotreno.com` or Trainline as fallback.
- City-specific platforms (local opera houses, tourism boards, transit) added here as new cities are built.
