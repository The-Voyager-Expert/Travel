# Extra Section Rules ↔ Validator Audit — 2026-06-17

> **UPDATE (fixes applied same day).** Everything not requiring a `Brain/CORE RULES/` edit has been fixed in `validate_itinerary.py` and `Validator Index.html`, and verified across all 137 guides (no crashes, no new false-positive hard-fails; CORE RULES checksum guard confirms no rule file was touched). Applied: Local Tastes cap removed; Food Delivery preference check removed; tram duplicate check retired; Heads Up 5 dead checks revived; RNH seafood added as a **warn** (keyword match can't judge "seafood-primary"); Cappuccino in-hotel-first ordering added; Day Trips postal-code check added; Skip List spec self-check added; Validator Index drift corrected. Three items still need your decision because they'd touch CORE RULES — see the To-Do entry "2026-06-17 — Extra Section audit + fixes". The Michelin §3b "🚶 walk required" gap (#3 below) was found NOT to be a real gap: 🚕-only is valid when the walk exceeds the 40-min Motion-Rule cap. Details below are the original findings.

---


Scope: all 16 `*Extra Section*.html` files in `Brain/CORE RULES/` checked against `validate_itinerary.py` (24,943 lines) and `Brain/Reference/Validator Index.html`. Goal: is every enforceable rule actually enforced, and is the enforcement correct (not dead code, not drifted from the rule).

**Headline:** the per-section enforcement is broadly strong. No section is unguarded. The issues cluster in four buckets: (A) a few real enforcement gaps, (B) two checks that enforce things the rule files do not say, (C) five dead checks in Heads Up, and (D) a stale `Validator Index.html` that documents retired formats in several places.

Findings marked ✅ **VERIFIED** were re-confirmed directly against the rule files / a shipped guide. Others are from the section sweep and should be re-confirmed when fixing.

---

## A. Enforcement gaps — rule states it, validator does not catch it

1. **Restaurants Near Hotel — seafood exclusion not enforced.** ✅ VERIFIED
   RNH §3 carries the seafood-exclusion clause *verbatim* identical to Downtown and Michelin ("primary identity built around fish/shellfish/… excluded; sushi permitted"). Downtown (`_DR_SEAFOOD_RE`, L9747) and Michelin (`_MICH_SEAFOOD_RE`, L20024) both enforce it. RNH has **no** seafood check. RNH cuisine sits on a `↳` row — the same surface the other two scan — so it is directly implementable.

2. **Cappuccino — in-hotel café "always first" ordering not enforced.**
   §3a says the in-hotel café is always the first entry. RNH (`_rnh_hotel_order_ok`, L9188) and Michelin (check D) both enforce their analogous in-hotel-first rule; Cappuccino does not. A misplaced hotel café passes.

3. **Michelin §3b — no explicit presence check for the required `🚶 · 🚕 → hotel` motion row.**
   The row is only caught indirectly by check D's ordering logic; the `🚶` walk component is never required at all. Add a clean shape check.

4. **Day Trips by Train — §4 address rule (no postal code / country only if different) not enforced.**
   Day-trips entries carry no `📍` Maps anchor, so the global address checks never see them, and there is no day-trips-specific heading check. `Strasbourg, France` (redundant country) or a postal code would pass.

5. **Skip List — three of its four clauses unenforced.**
   §2 "nothing follows the footnote" (only Claude Inspiration's tail is guarded), §4 "order follows the Brain.md Part 4 list", and §3 single-italic-grey-line look are all unchecked — only the `Skipping: ` text prefix is verified. Skip List is also the only section with **no spec-drift / calibration-anchor self-check**, so its rule file could be gutted unnoticed. Separately, the skip↔Tours cross-check excludes `local-tastes` (L23582), so a skipped venue can resurface as a Local Tastes establishment uncaught.

---

## B. Checks that enforce more than the rule says (validator-vs-rule contradictions — need your call)

6. **Local Tastes — validator caps establishments at MAX 3; rule says "use as many as are relevant."** ✅ VERIFIED — real bug
   Rule §2: `📍 [Establishment] · [Establishment] · [Establishment] … use as many as are relevant`. Validator check K (L10634/L10833) hard-fails at >3 and cites *§2: "1 to 3 establishments"* — **that phrase does not exist in the rule file.** A valid guide listing 4+ relevant establishments is wrongly failed, on a fabricated citation. Either remove the cap (rule is authoritative → validator is wrong) or, if a cap of 3 is actually wanted, update the rule. Your decision.

7. **Food Delivery — validator hard-fails on a platform preference order the rule never defines.** ✅ VERIFIED
   Check at L11386–11428 fails entries out of DoorDash/Uber Eats → Grubhub → local tier order, citing "§2". The Food Delivery rule file contains **no** mention of preference/tier/ordering. Either add the ordering rule to §2 or remove the check.

8. **Getting Around — tram is treated as mandatory and template wordings don't match the rule.**
   Validator requires every guide to ship a 🚎 Tram subsection or "No tram available in [City]." (L14491). The rule §2 never states tram is universal. Worse, there are **two contradictory tram-template checks**: L14508 expects "No tram rides **planned for this trip**", L24250 expects "No tram rides **on this trip**" (and also accepts "does not have a tram system…") — and **none of those wordings exist in the rule file** (§2b authorizes only `Line(s) used on this trip: [N].` + the negative line). Reconcile to one check whose templates match the rule.

---

## C. Dead / vacuous checks

9. **Heads Up — five checks never fire on current guides.** ✅ VERIFIED
   L21051, L21069, L21108, L21128, L21150 are each guarded by `if _ht.startswith('❗️ ')`. Shipped guides put the `❗️` via CSS, not in the heading text (Atlanta's headings are `'MLK Birth Home — Closed…'`, no `❗️`), so the guard is always false. These five pass vacuously:
   `_cg_venue_nocap`, `_cg_stitle_nocap`, `_cg_venue_period`, `_cg_stitle_quoted`, and the documented duplicate-venue guard `_cg_venue_dupes`. Either re-point the parse at the real heading text (drop the `❗️ ` prefix from the guard) or remove the dead branches. The duplicate-venue catch in particular is a real anti-drift guard currently doing nothing.

(No other live dead checks found. The changelog-documented vacuous cases — Michelin `entries_audit` always-empty, legacy ride-app `.ride-apps`, per-section postal dead code, day-trips always-pass — are already fixed/tombstoned.)

---

## D. Validator Index documentation drift (`Brain/Reference/Validator Index.html`)

The Index is the living index of every check; several entries now describe retired formats and would actively mislead.

10. **Michelin (L743, L756, L757) — actively wrong.** Says entries have "no motion rows" and are "sorted **alphabetically** … ride time is unextractable (validator cannot check it)." The validator was flipped to closest-to-hotel-first by `🚕` ride time on 2026-06-05 (check D) and now *requires* the motion row. L757 is the highest-priority Index fix. Index also omits Michelin check D, the §3a in-hotel format, and the Downtown×Michelin cross-check.

11. **Food Delivery — stale.** Index still documents the retired description-row format (2-child transit-box, ≤80-char description div, terminal-period, expected-domain match) removed 2026-05-24; omits the live T9c domain-link-text check and the preference-order check.

12. **Local Tastes — inverted.** Index L514 says the entry NAME is "**uppercase**"; the validator enforces Title Case / NOT all caps (and the rule agrees). Index L529 states the correct rule, so the Index contradicts itself.

13. **Heads Up — documents the pre-2026-05-19 leading-`❗` entry format** that the validator now bans on entry headings.

14. **Claude Inspiration — under-documented.** Index lists ~10 checks; validator has ~18 (T1b and T_NEW5–T_NEW11 undocumented).

15. **Tours — stale.** Index L374 gives the negative line as "No Tours in {City}." / "Not enough Tours…"; live wording (and rule) is "No qualifying tours in [City]." / "…on [Platform] in [City]." Index L369 still references the removed `_TOURS_MINIMUM_EXEMPT` set and double-documents the 5/5/5 rule with a contradictory mechanism.

16. **Day Trips — phantom check.** Index claims a "≥10 words minimum" on the `↳` description; the live check is ≤320 chars only (no minimum).

---

## Notes / non-issues confirmed clean

- Tours (5/5/5 min + low-count exemption, rating bar, walking-tour cap, banned synonyms, flat format, "private"/"time from hotel" leakage), Shows, Weekly Closures, Pickleball, Downtown, and Train Stations are all well-covered with live, non-vacuous checks matching their rule files.
- Tours **city rule** (T6) has no automated check — but this is intentional (Index marks it `class="no"`, human/not-automatable). The validator changelog L209 misleadingly implies it was implemented; L227 reverts it. Worth reconciling the changelog comment, not a real gap.
- Weak global address checks (postal regex is `$`-anchored → misses mid-string codes; country-leak splits on comma not the locked ` · ` separator) affect Stations §3 and every `📍` section. Low severity, system-wide.

---

## Suggested fix sequencing

Per the locked validator-first workflow, the code/Index changes below belong in a focused validator session (not a build). Order: (1) the two contradictions in bucket B need your decision first since they may touch CORE RULES; (2) bucket A gaps and bucket C dead code are pure validator work; (3) bucket D is immediate working-surface Index cleanup.
