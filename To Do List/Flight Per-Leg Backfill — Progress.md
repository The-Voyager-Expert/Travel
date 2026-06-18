# Flight-time view — per-leg backfill · ✅ COMPLETE

_Completed 2026-06-17. All 102 connecting cities now show real per-leg breakdowns. Validator: 0 fail · 0 warn._

## Result
- **102/102 connecting cities** carry real `lg` legs (92 two-leg, 10 three-leg). Nonstops show their single leg. Card example: `SEA→AMS 9h45 · AMS→VIE 1h45 · 11h30 air`.
- Infrastructure (schema, render `.fbreak`, validator) done; the 3 old `t≠m+buffer` warns (Montevideo/Bali/Istanbul) cleared once real legs replaced the rough estimates.

## Data sourcing notes
- First 54 cities: exact scheduled block times from the **flight connector** (Delta/partner nonstops, dep 2026-08-19).
- Remaining 48: **web-sourced** scheduled durations (connector was down) — real published flight times, rounded to ~5 min. Flagged in `flight_legs_cache.json` (`_web_sourced`). Can be refreshed to exact connector values later if desired.
- **Reroutes** (real shortest path differs from the marketed FMAP hub, kept for colour/tier only): Nice/Cannes/Monaco via CDG, Marrakech via CDG, Stockholm via AMS, Curacao via JFK.
- **3-leg trips:** Alesund, Cusco, MachuPicchu, Madeira, Montevideo, Quebec City, Queenstown, Tromso, Wellington, Zhangjiajie.

## To refresh/extend later
- Cache of all 96 sourced legs: `To Do List/flight_legs_cache.json`. Backfill script + method retained in git history of this file (earlier revision) — generic 2-leg fill from cache, explicit overrides for reroutes/3-leg.
- A new guide that ships connecting just needs its hub→dest leg sourced + added to the cache, then m=sum(legs), t=fmtMins(m+(legs-1)*90), lg=[...]; validate.