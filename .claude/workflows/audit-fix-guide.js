export const meta = {
  name: 'audit-fix-guide',
  description: 'Audit a guide for formatting problems. If the validator misses them, fix the validator first — then fix the guide and ship.',
  whenToUse: 'When a guide needs auditing and fixing. Run with no args — it detects the guide from recent git changes, or asks if it cannot tell.',
  phases: [
    { title: 'Locate + validate', detail: 'Find the guide and run validate_itinerary.py' },
    { title: 'Deep audit', detail: 'Full manual audit when validator finds nothing' },
    { title: 'Fix validator', detail: 'Add missing checks so the validator fires on the real problem' },
    { title: 'Fix guide', detail: 'Fix every confirmed problem in the guide HTML' },
    { title: 'Ship', detail: 'Validate to 0 failures and ship' },
  ],
}

const ROOT = '/Users/danielebellinello/Documents/The Voyager Expert'

// ── Schema: validator run result ──────────────────────────────────────────────
const VALIDATOR_SCHEMA = {
  type: 'object',
  properties: {
    guide_path:     { type: ['string', 'null'] },
    guide_found:    { type: 'boolean' },
    full_output:    { type: 'string' },
    failure_count:  { type: 'number' },
    failure_lines:  { type: 'array', items: { type: 'string' } },
  },
  required: ['guide_path', 'guide_found', 'full_output', 'failure_count', 'failure_lines'],
}

// ── Schema: one confirmed problem ──────────────────────────────────────────────
const PROBLEM_SCHEMA = {
  type: 'object',
  properties: {
    problems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description:            { type: 'string' },
          location_in_html:       { type: 'string' },
          rule_source:            { type: 'string' },
          validator_should_catch: { type: 'boolean' },
          why_validator_misses:   { type: 'string' },
        },
        required: ['description', 'location_in_html', 'rule_source', 'validator_should_catch'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['problems', 'summary'],
}

// ── Resolve city from args ────────────────────────────────────────────────────
if (!args || typeof args !== 'string' || !args.trim()) {
  throw new Error('Which guide do you need me to audit?')
}

const city = args.trim()
log(`Guide to audit: ${city}`)

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — Locate the guide and run the validator
// ═══════════════════════════════════════════════════════════════════════════════
phase('Locate + validate')

const setup = await agent(
  `You are locating the guide for "${city}" and running the validator on it.

ROOT: ${ROOT}

STEP 1 — Find the guide HTML file.
Run this to locate it:
  find "${ROOT}/Travel-Website/Guides" -maxdepth 2 -name "*.html" | grep -iv "read-about\\|story\\|_build" | grep -i "${city.replace(/\s+/g, '[-_]')}"

If nothing found, try a broader scan:
  ls "${ROOT}/Travel-Website/Guides/" | grep -i "${city}"

The guide file is the *_vN.html file (not read-about, not story, not in _build/).
Report the exact absolute path or null if not found.

STEP 2 — Run the validator:
  cd "${ROOT}" && python3 Brain/scripts/validate_itinerary.py "<guide_path>"

Capture the COMPLETE stdout+stderr output verbatim.
Count lines that start with FAIL or contain [FAIL] or ✗ — those are failures.

Return the result.`,
  { label: `locate + validate: ${city}`, phase: 'Locate + validate', schema: VALIDATOR_SCHEMA }
)

if (!setup.guide_found || !setup.guide_path) {
  throw new Error(
    `Guide for "${city}" not found under Travel-Website/Guides/.\n` +
    `Check the exact folder name: ls "${ROOT}/Travel-Website/Guides/" | grep -i "${city}"`
  )
}

log(`Guide: ${setup.guide_path}`)
log(`Validator: ${setup.failure_count} failure(s)`)

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — Deep audit (only when validator finds nothing)
// You are asking because you saw a real problem. "Looks fine" is not an answer.
// ═══════════════════════════════════════════════════════════════════════════════

let problemsToFix = []
let validatorWorking = setup.failure_count > 0

if (validatorWorking) {
  log(`Validator already caught ${setup.failure_count} failure(s) — going straight to the fix.`)
  problemsToFix = setup.failure_lines.map(line => ({
    description: line,
    location_in_html: '(see validator output)',
    rule_source: 'validate_itinerary.py',
    validator_should_catch: true,
    why_validator_misses: '',
  }))
} else {
  // Validator is silent — but the user SAW a problem. Run the deep audit.
  phase('Deep audit')
  log('Validator found nothing — running full manual audit. The crib cannot come back empty-handed.')

  const audit = await agent(
    `You are doing a MANDATORY DEEP MANUAL AUDIT of the guide at:
${setup.guide_path}

The user saw a problem in this guide. The automated validator found nothing. That means either:
(a) the validator has a gap that needs fixing, or
(b) there is a subtle formatting/content problem the validator cannot catch mechanically.

Either way — "this guide looks fine" is NOT an acceptable answer. Read everything, check everything.

─────────────────────────────────────────────────────────────────
STEP 1 — Read the full guide HTML:
  Use the Read tool on: ${setup.guide_path}

STEP 2 — Read the canonical rules (ALL of these):
  ${ROOT}/Brain/CORE RULES/Guide Structure.html
  ${ROOT}/Brain/CORE RULES/Icon Order and Format.html
  ${ROOT}/Brain/CORE RULES/Stops Structure.html
  ${ROOT}/Brain/CORE RULES/Motion Rule.html
  ${ROOT}/Brain/CORE RULES/Trip Overview.html
  ${ROOT}/Brain/CORE RULES/Hotel Banner.html
  ${ROOT}/Brain/Reference/Cleanliness Checks.md   ← scan all 500 rules

STEP 3 — Cross-check the guide against EVERY one of these drift categories:

ICON ORDER (canonical: 📍 🏷️ 🕐 ⏰ ⏳ 🎟️ 📖 🌐 🗺️ 🚶 🚕 motion row)
  · Any icon out of sequence in any stop box?
  · Any icon missing that should be present?
  · Tilde (~) used anywhere except as ⏰ prefix? (⏰ ~1 hr is the ONLY valid use)

MONEY / PRICES
  · Any $ € £ ¥ or ISO currency code anywhere in the guide?

ACTIVE / HOVER STATES
  · Any .active / .on / .selected / :hover fill using gold (#8a6c1a) instead of terracotta (#b85c2a)?

PILL / BUTTON REST STATES
  · Any pill or button with a beige/cream background (#fdf3e0 / #fdf6ec / #fdf3e0 / #fdf8f0 / etc.) instead of white?

ALSO-ON-THIS-SITE BLOCK
  · Class is .also-on-this-site-pill (not trip-resource-pill)?
  · Required pills present in exact order: 🌤️ Weather · 🕐 Time Zones · 🔌 Plug Adapter · 💰 Currency · 🛡️ Safety Guide · 🪪 Visas · 📊 Stats · (🚆 European Train Guide if EU)?
  · Labels exact match (e.g. "Stats Across the Caribbean" not "Caribbean Stats")?

DATA-UPDATED ATTRIBUTE
  · Present on the toolbar-mount div?
  · Format YYYY-MM?

CLAUDE INSPIRATION SECTION
  · .claude-inspiration div present?
  · ✨ Claude Inspiration pill present in Trip Overview?

READ-ABOUT PAGE
  · Back-link in the read-about page pointing to THIS guide's current _vN filename (not a stale version)?

MOTION BANNERS
  · Walk/ride banners in correct format?
  · Ride time sourced from mapping-service driving mode, not estimators?
  · Walk threshold respected (motion rule)?

STOP PHOTOS
  · Each stop has a photo?
  · Photo type correct: structure → exterior, venue → interior, other → subject?

HARDCODED STYLES
  · Any hardcoded hex colors in HTML instead of CSS variables?
  · Any body{} / *{} / :root{} blocks in the page?

PLACEHOLDERS / FABRICATION
  · Any {TBD} / {TODO} / "fill in later" text remaining?
  · Any placeholder ellipsis in input placeholders?

WEEKLY CLOSURES
  · Any <strong> or <b> tags inside weekly-closures entries? (banned)

TOOLBAR
  · data-prev / data-next pointing to correct neighbors?
  · data-updated well-formed?

CONTENT PROHIBITIONS
  · "typically open" / "usually takes" / "approximately" in factual rows?
  · Any hedging language in icon rows?

─────────────────────────────────────────────────────────────────
Report EVERY problem found, no matter how small. For each:
- What is wrong (specific, not vague)
- Where in the HTML (element, section, class, approximate line area)
- Which CORE RULES file and section says it is wrong
- Whether the validator SHOULD be catching this (and if not, why)

You may NOT conclude this audit with zero problems. If after reading every rule and every line of the guide you genuinely cannot find anything wrong, report the single most suspicious thing you noticed and flag it as uncertain — then the next step will investigate further.`,
    { label: `deep audit: ${city}`, phase: 'Deep audit', schema: PROBLEM_SCHEMA, effort: 'high' }
  )

  log(`Deep audit: ${audit.problems.length} problem(s) found — ${audit.summary}`)

  if (!audit.problems || audit.problems.length === 0) {
    throw new Error(
      `Audit returned 0 problems for ${city} — but the user saw a real issue.\n` +
      `Do not accept this result. Re-run the audit with more scrutiny, especially:\n` +
      `- Icon order in every stop box\n` +
      `- Also-on-this-site pill labels and order\n` +
      `- data-updated attribute presence and format\n` +
      `- Claude Inspiration section presence\n` +
      `Validator output for reference:\n${setup.full_output}`
    )
  }

  problemsToFix = audit.problems

  // ── Fix the validator for any gaps it should have caught ──────────────────
  const validatorGaps = audit.problems.filter(p => p.validator_should_catch)

  if (validatorGaps.length > 0) {
    phase('Fix validator')
    log(`${validatorGaps.length} problem(s) should have been caught by the validator — fixing the validator before touching the guide.`)

    await agent(
      `You are fixing the validator so it catches problems it currently misses.

PROBLEMS THAT THE VALIDATOR SHOULD CATCH BUT DOESN'T:
${validatorGaps.map((p, i) =>
  `${i + 1}. PROBLEM: ${p.description}
   Location in guide: ${p.location_in_html}
   Rule source: ${p.rule_source}
   Why validator misses it: ${p.why_validator_misses || 'unknown — investigate the validator code'}`
).join('\n\n')}

GUIDE UNDER TEST: ${setup.guide_path}

─────────────────────────────────────────────────────────────────
STEP 1 — Read the validator source:
  ${ROOT}/Brain/scripts/validate_itinerary.py
  ${ROOT}/Brain/Reference/Cleanliness Checks.md  ← understand the existing check naming conventions

STEP 2 — For each gap: write a new check function or extend an existing one.
  Follow the exact pattern in validate_itinerary.py:
  - Check function named check_<short_description>()
  - Appends to failures[] with a descriptive FAIL message
  - Called in the main run() chain

STEP 3 — VERIFY the fix actually fires:
  cd "${ROOT}" && python3 Brain/scripts/validate_itinerary.py "${setup.guide_path}"

  The output MUST now contain FAIL lines for the problems you added checks for.
  If it does not fire → debug and fix until it does.
  Repeat until every gap now produces a FAIL line.

CRITICAL: Do NOT touch the guide HTML yet.
The validator must fire on the broken guide BEFORE you fix the guide.
Report: what checks you added, the exact FAIL messages they produce, and paste the validator output confirming they fire.`,
      { label: 'fix validator gaps', phase: 'Fix validator', effort: 'high' }
    )
  } else {
    log('All problems are content/style issues the validator cannot catch mechanically — no validator changes needed.')
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — Fix the guide
// ═══════════════════════════════════════════════════════════════════════════════
phase('Fix guide')
log(`Fixing ${problemsToFix.length} confirmed problem(s) in the guide…`)

await agent(
  `You are fixing every confirmed formatting problem in the guide:
${setup.guide_path}

─────────────────────────────────────────────────────────────────
PROBLEMS TO FIX (fix ALL of them):
${problemsToFix.map((p, i) => {
  const desc = typeof p === 'string' ? p : p.description
  const loc  = typeof p === 'object' ? p.location_in_html : ''
  const rule = typeof p === 'object' ? p.rule_source : ''
  return `${i + 1}. ${desc}${loc ? `\n   Location: ${loc}` : ''}${rule ? `\n   Rule: ${rule}` : ''}`
}).join('\n\n')}

─────────────────────────────────────────────────────────────────
BEFORE TOUCHING ANYTHING — read the canonical rules:
  ${ROOT}/Brain/CORE RULES/Guide Structure.html
  ${ROOT}/Brain/CORE RULES/Icon Order and Format.html
  ${ROOT}/Brain/CORE RULES/Stops Structure.html
  ${ROOT}/Brain/CORE RULES/Motion Rule.html

RULES FOR THIS STEP:
- Use the Edit tool for surgical in-place fixes — never rewrite the whole file unless the problem requires it
- Fix ONLY the listed problems — do not restructure, rewrite prose, or improve other things
- After all fixes, run the validator:
    cd "${ROOT}" && python3 Brain/scripts/validate_itinerary.py "${setup.guide_path}"
- If the validator now shows NEW failures (beyond what was listed), fix those too — the guide must validate clean before shipping
- Report every change made (file, what was changed, what it was changed to)`,
  { label: `fix guide: ${city}`, phase: 'Fix guide', effort: 'high' }
)

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5 — Validate to 0 and ship
// ═══════════════════════════════════════════════════════════════════════════════
phase('Ship')
log('Running final validation and shipping…')

await agent(
  `You are doing the final validation and ship for the guide:
${setup.guide_path}

City: ${city}

─────────────────────────────────────────────────────────────────
STEP 1 — Run the validator to 0 failures:
  cd "${ROOT}" && python3 Brain/scripts/validate_itinerary.py "${setup.guide_path}"

If there are ANY remaining failures: fix them now. Do not proceed to ship with failures.
Repeat until the validator exits 0.

STEP 2 — Ship:
  cd "${ROOT}" && python3 Brain/scripts/guide_tools.py ship ${city}

This runs: index card · map pin · climate · safety · currency · stats · search index · mobile check.
Fix any ship-gate failures before pushing.

STEP 3 — Commit and push.
Commit message (use exactly this format):
  ${city}: fix guide formatting + update validator

  Co-Authored-By: The Expert <noreply@the-voyager-expert.com>

STEP 4 — Report:
  - What problems were found in the guide
  - What validator checks were added (if any) and what FAIL messages they produce
  - Confirmation that the ship succeeded and the push went through`,
  { label: `validate + ship: ${city}`, phase: 'Ship' }
)

log(`Done — ${city} audited, fixed, validated, and shipped.`)
