# Annecy v1 — build research notes

Built 2026-06-12. City + day-count prompt ("1 day guide to Annecy") → hotel-research
path (not in Trips.html), 1-day itinerary (no Train Day, per Day Structure ≤4-day rule).

## Hotel anchor
Hôtel La Cour du 6 · 6 bis Rue Royale · Annecy city centre. Booking.com 9.0 / 548 reviews,
3-star, central (between the Vieille Ville and the Pâquier lakefront). Coordinates
45.900705, 6.124946.

## Motion times — OSM routing fallback (Glasgow 2026-06-12 precedent)
Google/Apple Maps are unreadable in the Cowork sandbox (heavy SPAs never reach
document_idle). Per the Glasgow v1 decision, motion minutes are real computed
route durations from open routing engines, disclosed here:
- 🚶 walk = Valhalla `pedestrian` profile (valhalla1.openstreetmap.de) over OSM data.
- 🚕 ride = OSRM `driving` profile (router.project-osrm.org) over OSM data.
  (Valhalla `auto` over-detoured around Annecy's pedestrian old-town core, returning
  10-16 min for 100-200 m hops; OSRM's car profile gives realistic 1-4 min values
  that match what Google/Apple would show. Both are real driving-mode route durations,
  not estimates or ride-share APIs — the things Motion Rule.html actually bans.)
Coordinates geocoded via Nominatim (OSM).

## Stop hours / tickets — sources
- Château d'Annecy & Palais de l'Isle: musees.annecy.fr + lac-annecy.com — Jun 1–Sep 30
  open daily except Tuesday 10:30am–6:00pm; closed Tuesday. Combined museum ticket via
  musees.annecy.fr billetterie.
- Lake Annecy cruise: Compagnie des Bateaux du Lac d'Annecy (bateaux-annecy.com),
  embarcadère at 2 Place aux Bois. Peak-summer daily departures 11:15am–7:35pm.

## Tours — zero qualifying (low-count line)
No tour cleared the 4.5★ / 6-review bar after Viator MCP + GetYourGuide + TripAdvisor:
Annecy food tour (4.95/285) is an excluded type; "Explore Annecy in 60 min" 4.38/34,
GYG old-town/cruise products 4.1–4.3 or private. Section ships its low-count line
(Stockholm/Siena small-market precedent).

## Section calls
- Getting Around: no ride-hailing app operates in Annecy (Uber rideshare/Bolt/Heetch all
  absent — Uber only launched a lake boat-rental service Jun 2026); tram & metro absent →
  three negative lines.
- Shows: no destination-level venue (Bonlieu is a regional scène nationale, below the bar)
  → negative line.
- Michelin: Le Clos des Sens ⭐⭐⭐ (Annecy-le-Vieux) + L'Esquisse ⭐ (rue Royale).
- Cappuccino (3), Restaurants Near Hotel (2), Downtown (4) ship with low-count comments —
  verified hours/ratings prioritised over hitting 5.
- No Heads Up (not in Brain Part 3), no Pickleball (France), no Skip List.

## Photos — Wikimedia Commons (downloaded to _build/assets)
Château → Annecy Castle.JPG · Vieille Ville → Annecy Pont sur le Thiou Vue Panoramique 1.jpg
· Palais de l'Isle → Palais de l'Ile - Annecy 608 flip de bruyn.JPG · Cruise → Libellule
Annecy.jpg · Pont des Amours → Canal du Vassé à Annecy.JPG.
