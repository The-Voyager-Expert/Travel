# Status Dots — guides_index

**GENERATED FILE — do not hand-edit the master list below.** The single source of
truth for every been / want-to-go marker is the `data-status` attribute on each
dest-card in `Guides-Index.html`. This checklist is regenerated *from* the index by
`Brain/scripts/build_status_dots.py` — which runs automatically at every session
start (`guide_tools.py start`, Step 0b) and on every ship (`update-index`), right
alongside `sync_tracker.py` (which regenerates `Travel-Tracker.html` the same way).

To change a status: flip `data-status` on the card in `Guides-Index.html` (or toggle
it in the Travel Tracker and paste the change back), then let the builders regenerate
this file — never edit the checklist directly, or the next resync silently reverts it.

## What the dots mean

- 🟡 **Gold dot** (bottom-right of a card) = **Want to go** — haven't been yet.
- ⚪ **No dot** = **Been there.**

Default is **"want to go."** Every new guide ships with `data-status="want"` (gold dot) until you've been there and tick it `[x]`. This means the gold dot is the starting state, not the exception.

Color: gold `var(--gold)` (`#c8961a`), 7px, 0.95 opacity, pinned bottom-right.

## How it works in the HTML

Each city is an `<a class="dest-card" …>`. To mark one as want-to-go, add `data-status="want"`:

```html
<a class="dest-card" data-status="want" href="./Bend/bend_v2.html" …>
```

Remove the attribute to turn it back to "been." That's the only change — the CSS and legend handle the rest. No dot color or position lives in the cards.

## Master list

`[x]` = **been**, `[ ]` = **want to go** (gets the gold dot). Regenerated from the
index by `build_status_dots.py` — do not hand-edit; flip `data-status` on the card
in `Guides-Index.html` instead.

*(Auto-generated, grouped by country A→Z to match the index's country split.)*

### 🇦🇷 Argentina
- [ ] Buenos-Aires

### 🇦🇺 Australia
- [ ] Melbourne
- [ ] Sydney

### 🇦🇹 Austria
- [ ] Salzburg
- [x] Vienna

### 🇧🇪 Belgium
- [x] Bruges
- [x] Brussels

### 🇧🇹 Bhutan
- [ ] Bhutan

### 🇧🇷 Brazil
- [ ] Aracaju
- [ ] Curitiba
- [ ] Florianopolis
- [ ] Fortaleza
- [ ] Foz-do-Iguaçu
- [ ] João-Pessoa
- [ ] Maceió
- [ ] Natal
- [ ] Olinda
- [ ] Porto-Alegre
- [ ] Recife
- [x] Rio-de-Janeiro
- [ ] Salvador
- [ ] São-Luís
- [ ] São-Paulo

### 🇨🇦 Canada
- [ ] Montreal
- [ ] Quebec-City
- [x] Toronto
- [x] Vancouver
- [x] Victoria
- [x] Whistler

### 🏝️ Caribbean Islands
- [x] Aruba
- [x] Bahamas
- [ ] Barbados
- [ ] Cayman-Islands
- [x] Curacao
- [ ] Puerto-Rico
- [x] Sint-Maarten
- [ ] Turks-and-Caicos
- [x] Virgin-Islands

### 🇨🇱 Chile
- [ ] Santiago

### 🇨🇳 China
- [x] Beijing
- [x] Chongqing
- [ ] Hong-Kong
- [x] Shanghai
- [x] Zhangjiajie

### 🇨🇷 Costa Rica
- [ ] Arenal
- [ ] Manuel-Antonio
- [ ] San-Jose-Costa-Rica

### 🇭🇷 Croatia
- [ ] Dubrovnik
- [ ] Split

### 🇨🇿 Czechia
- [ ] Prague

### 🇩🇰 Denmark
- [x] Copenhagen

### 🇪🇬 Egypt
- [ ] Cairo

### 🇪🇪 Estonia
- [ ] Tallinn

### 🇫🇮 Finland
- [ ] Helsinki

### 🇫🇷 France
- [ ] Aix-en-Provence
- [ ] Annecy
- [ ] Bordeaux
- [x] Cannes
- [ ] Colmar
- [ ] Lille
- [ ] Lyon
- [ ] Marseille
- [x] Nice
- [x] Paris
- [x] Strasbourg

### 🇵🇫 French Polynesia
- [ ] Bora-Bora

### 🇬🇪 Georgia
- [ ] Tbilisi

### 🇩🇪 Germany
- [ ] Berlin
- [x] Hamburg
- [x] Marktoberdorf
- [x] Munich
- [x] Stuttgart

### 🇬🇷 Greece
- [x] Athens
- [x] Corfu
- [ ] Mykonos
- [ ] Santorini

### 🇭🇺 Hungary
- [ ] Budapest

### 🇮🇸 Iceland
- [ ] Reykjavik

### 🇮🇩 Indonesia
- [ ] Bali

### 🇮🇪 Ireland
- [ ] Dublin

### 🇮🇹 Italy
- [x] Amalfi
- [x] Bologna
- [x] Capri
- [x] Cinque-Terre
- [x] Florence
- [ ] Lake-Como
- [ ] Lecce
- [ ] Milan
- [ ] Naples
- [x] Pisa
- [x] Rome
- [ ] Sardinia
- [ ] Sicily
- [ ] Siena
- [x] Sorrento
- [x] Turin
- [x] Venice
- [ ] Verona

### 🇯🇵 Japan
- [x] Kyoto
- [ ] Osaka
- [x] Tokyo

### 🇯🇴 Jordan
- [ ] Petra

### 🇱🇦 Laos
- [ ] Luang-Prabang

### 🇱🇺 Luxembourg
- [x] Luxembourg

### 🇲🇻 Maldives
- [ ] Maldives

### 🇲🇹 Malta
- [ ] Valletta

### 🇲🇽 Mexico
- [x] Cancun
- [x] Los-Cabos
- [ ] Oaxaca
- [x] Puerto-Vallarta

### 🇲🇨 Monaco
- [x] Monaco

### 🇲🇪 Montenegro
- [ ] Kotor

### 🇲🇦 Morocco
- [ ] Marrakech

### 🇳🇵 Nepal
- [ ] Pokhara

### 🇳🇱 Netherlands
- [x] Amsterdam

### 🇳🇿 New Zealand
- [ ] Queenstown
- [ ] Wellington

### 🇳🇴 Norway
- [ ] Alesund
- [ ] Bergen
- [ ] Oslo
- [ ] Tromso

### 🇴🇲 Oman
- [ ] Muscat

### 🇵🇪 Peru
- [ ] Cusco
- [ ] Lima
- [ ] MachuPicchu

### 🇵🇭 Philippines
- [ ] Palawan

### 🇵🇱 Poland
- [ ] Kraków

### 🇵🇹 Portugal
- [ ] Azores
- [x] Cascais
- [x] Lagos
- [ ] Lisbon
- [ ] Madeira
- [x] Porto
- [x] Sintra

### 🇶🇦 Qatar
- [ ] Doha

### 🇸🇨 Seychelles
- [ ] Seychelles

### 🇸🇬 Singapore
- [ ] Singapore

### 🇸🇮 Slovenia
- [ ] Ljubljana

### 🇰🇷 South Korea
- [x] Seoul

### 🇪🇸 Spain
- [ ] Barcelona
- [x] Madrid
- [ ] Malaga
- [x] San-Sebastian
- [ ] Seville
- [x] Toledo

### 🇱🇰 Sri Lanka
- [ ] Colombo

### 🇸🇪 Sweden
- [x] Gothenburg
- [ ] Stockholm

### 🇨🇭 Switzerland
- [x] Geneva
- [ ] Lucerne
- [ ] Zurich

### 🇹🇼 Taiwan
- [x] Taipei

### 🇹🇭 Thailand
- [ ] Bangkok
- [ ] Chiang-Mai
- [ ] Phuket

### 🇹🇷 Turkey
- [ ] Istanbul

### 🇦🇪 United Arab Emirates
- [ ] Abu-Dhabi
- [ ] Dubai

### 🇬🇧 United Kingdom
- [x] Cambridge
- [x] Edinburgh
- [ ] Glasgow
- [x] London
- [x] Oxford

### 🇺🇸 United States
- [ ] Alaska
- [x] Atlanta
- [x] Austin
- [ ] Bend
- [x] Big-Island
- [ ] Boston
- [ ] Boulder
- [ ] Cape-Cod
- [ ] Carmel-by-the-Sea
- [ ] Charlotte
- [x] Chicago
- [ ] Columbia
- [ ] Dallas
- [ ] Denver
- [ ] Florida-Keys
- [ ] Glacier-National-Park
- [x] Kauai
- [ ] KeyWest
- [x] La-Jolla
- [ ] Lake-Tahoe
- [x] Las-Vegas
- [ ] Los-Angeles
- [ ] Malibu
- [x] Maui
- [x] Miami
- [ ] Napa
- [ ] Naples-Florida
- [x] Nashville
- [ ] New-Orleans
- [x] New-York
- [x] Oahu
- [ ] Orcas-Island
- [x] Orlando
- [ ] Palm-Desert
- [x] Palo-Alto
- [x] Pasadena
- [ ] Pensacola
- [ ] Philadelphia
- [ ] Phoenix
- [ ] Portland
- [x] San-Diego
- [x] San-Francisco
- [ ] San-Jose
- [x] San-Juan-Island
- [ ] Santa-Barbara
- [ ] Santa-Cruz
- [ ] Santa-Monica
- [ ] Sarasota
- [x] Scottsdale
- [x] Seattle
- [x] Sedona
- [ ] Washington-DC
- [ ] Yellowstone

### 🇺🇾 Uruguay
- [ ] Montevideo

### 🇻🇳 Vietnam
- [ ] Hanoi
- [ ] Hoi-An

## Pending builds (not on the index yet)

Unshipped — `_build/` scaffolding only, no guide HTML, no index card. Add to the master list when they ship as `[ ]` (gold dot, want to go) by default, unless owner confirms they've already been — in that case enter as `[x]`. (Brussels shipped 2026-06-06 and moved to the Europe list as been.)

Current stalled builds (as of 2026-06-15 audit — no HTML yet, Phase 6 unchecked or no scaffolding):
_(none — all known stalled builds have shipped HTML as of 2026-06-15)_

## Guide count line

The legend row (right-aligned) shows a live total: **`N guides · N countries · N visited · N on the list`**.

It's computed by a small script at the bottom of `Guides-Index.html` — it counts every `.dest-card`, counts the ones with `data-status="want"`, and derives visited = total − want. Nothing to update by hand: add a guide or clear a dot and the numbers re-derive on load. The markup is `<span class="legend-count" id="guide-count">` inside `.status-legend`.

## Keeping it in sync

When a new guide ships, add the city here as `[ ]` (gold dot) by default — the assumption is you haven't been yet. When you visit a want-to-go place, tick it `[x]` and Claude removes its gold dot. This file and the index should always agree. The guide-count line needs no maintenance — it counts itself.
