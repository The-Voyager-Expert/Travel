# Status Dots — guides_index

Source-of-truth for the been / want-to-go markers on `guides_index.html`.
Edit the checklist below, and Claude syncs the dots into the index from it.

## What the dots mean

- 🔵 **Blue dot** (bottom-right of a card) = **Want to go** — haven't been yet.
- ⚪ **No dot** = **Been there.**

Default is **"want to go."** Every new guide ships with `data-status="want"` (blue dot) until you've been there and tick it `[x]`. This means the blue dot is the starting state, not the exception.

Color: dusty blue `#6a7fa3`, 6px, 0.85 opacity, pinned bottom-right.

## How it works in the HTML

Each city is an `<a class="dest-card" …>`. To mark one as want-to-go, add `data-status="want"`:

```html
<a class="dest-card" data-status="want" href="./Bend/bend_v2.html" …>
```

Remove the attribute to turn it back to "been." That's the only change — the CSS and legend handle the rest. No dot color or position lives in the cards.

## Master list

Tick `[x]` for places you've **been**. Leave `[ ]` for **want to go** (gets the blue dot).
Give Claude your "been" list and it will tick these and sync the index in one pass.

*(Grouped by country, A→Z — matching the index's country split, 2026-06-07.)*

### 🇦🇷 Argentina
- [ ] Buenos Aires

### 🇦🇼 Aruba
- [x] Aruba

### 🇦🇺 Australia
- [ ] Melbourne
- [ ] Sydney

### 🇦🇹 Austria
- [ ] Salzburg
- [x] Vienna

### 🇧🇪 Belgium
- [x] Bruges
- [x] Brussels

### 🇧🇷 Brazil
- [x] Rio de Janeiro

### 🇨🇦 Canada
- [ ] Montréal
- [ ] Québec City
- [x] Toronto
- [x] Vancouver

### 🏝️ Caribbean Islands
- [x] Bahamas
- [ ] Barbados
- [ ] Cayman Islands
- [x] Curaçao
- [ ] Puerto Rico
- [x] Sint Maarten
- [x] Virgin Islands

### 🇨🇱 Chile
- [ ] Santiago

### 🇨🇳 China
- [x] Beijing
- [x] Chongqing
- [x] Shanghai
- [x] Zhangjiajie

### 🇭🇷 Croatia
- [ ] Dubrovnik
- [ ] Split

### 🇨🇿 Czechia
- [ ] Prague

### 🇩🇰 Denmark
- [x] Copenhagen

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

### 🇩🇪 Germany
- [ ] Berlin
- [ ] Marktoberdorf
- [x] Munich
- [x] Stuttgart

### 🇬🇷 Greece
- [x] Athens
- [x] Corfu

### 🌺 Hawaii
- [x] Big Island
- [x] Kauai
- [x] Maui
- [x] Oahu

### 🇭🇺 Hungary
- [ ] Budapest

### 🇭🇰 Hong Kong
- [x] Hong Kong

### 🇮🇩 Indonesia
- [ ] Bali

### 🇮🇸 Iceland
- [ ] Iceland

### 🇮🇪 Ireland
- [ ] Dublin

### 🇮🇹 Italy
- [ ] Amalfi
- [ ] Bologna
- [x] Capri
- [x] Cinque Terre
- [x] Florence
- [ ] Lake Como
- [ ] Milan
- [ ] Naples
- [x] Pisa
- [x] Rome
- [ ] Siena
- [ ] Sorrento
- [x] Turin
- [x] Venice
- [x] Verona

### 🇯🇵 Japan
- [x] Kyoto
- [x] Tokyo

### 🇱🇺 Luxembourg
- [x] Luxembourg

### 🇲🇨 Monaco
- [x] Monaco

### 🇲🇦 Morocco
- [ ] Marrakech

### 🇳🇱 Netherlands
- [x] Amsterdam

### 🇳🇿 New Zealand
- [ ] Queenstown
- [ ] Wellington

### 🇳🇴 Norway
- [ ] Ålesund
- [ ] Bergen
- [ ] Oslo
- [ ] Tromsø

### 🇵🇪 Peru
- [ ] Cusco
- [ ] Lima
- [ ] Machu Picchu

### 🇵🇹 Portugal
- [ ] Azores
- [x] Cascais
- [x] Lagos
- [x] Lisbon
- [ ] Madeira
- [x] Porto
- [x] Sintra

### 🇸🇬 Singapore
- [ ] Singapore

### 🇸🇮 Slovenia
- [ ] Ljubljana

### 🇰🇷 South Korea
- [x] Seoul

### 🇪🇸 Spain
- [ ] Barcelona
- [x] Madrid
- [x] San Sebastián
- [ ] Seville
- [x] Toledo

### 🇸🇪 Sweden
- [x] Gothenburg
- [ ] Stockholm

### 🇨🇭 Switzerland
- [x] Geneva
- [ ] Lucerne
- [ ] Zürich

### 🇹🇼 Taiwan
- [x] Taipei

### 🇹🇭 Thailand
- [ ] Bangkok
- [ ] Phuket

### 🇹🇷 Turkey
- [ ] Istanbul

### 🇦🇪 United Arab Emirates
- [ ] Abu Dhabi
- [ ] Dubai
- [ ] United Arab Emirates

### 🇬🇧 United Kingdom
- [ ] Cambridge
- [x] Edinburgh
- [ ] Glasgow
- [x] London
- [ ] Oxford

### 🇺🇸 United States
- [ ] Alaska
- [x] Atlanta
- [x] Austin
- [ ] Bend
- [ ] Boston
- [x] Chicago
- [x] Los Angeles
- [x] Miami
- [x] New York
- [x] Orlando
- [ ] Palm Desert
- [x] Palo Alto
- [x] Pasadena
- [x] San Diego
- [x] San Francisco
- [x] Scottsdale
- [x] Seattle

## Pending builds (not on the index yet)

Unshipped — `_build/` scaffolding only, no guide HTML, no index card. Add to the master list when they ship as `[ ]` (blue dot, want to go) by default, unless owner confirms they've already been — in that case enter as `[x]`. (Brussels shipped 2026-06-06 and moved to the Europe list as been.)

Current stalled builds (as of 2026-06-15 audit — no HTML yet, Phase 6 unchecked or no scaffolding):
_(none — all known stalled builds have shipped HTML as of 2026-06-15)_

## Guide count line

The legend row (right-aligned) shows a live total: **`N guides · N countries · N visited · N on the list`**.

It's computed by a small script at the bottom of `guides_index.html` — it counts every `.dest-card`, counts the ones with `data-status="want"`, and derives visited = total − want. Nothing to update by hand: add a guide or clear a dot and the numbers re-derive on load. The markup is `<span class="legend-count" id="guide-count">` inside `.status-legend`.

## Keeping it in sync

When a new guide ships, add the city here as `[ ]` (blue dot) by default — the assumption is you haven't been yet. When you visit a want-to-go place, tick it `[x]` and Claude removes its blue dot. This file and the index should always agree. The guide-count line needs no maintenance — it counts itself.
