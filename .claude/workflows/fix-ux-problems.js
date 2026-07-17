export const meta = {
  name: 'fix-ux-problems',
  description: 'Find every open UX/format problem across the site and fix them all. Reads ux-fix-queue.html (the central hand-off file), all *-ux-handoff-*.html files, and every other Recommendations/ report, plus live brain_check + validate_mobile_render. Triages, fixes, and pushes.',
  whenToUse: 'Run manually whenever you want to clear the UX backlog. No args needed. Reads ALL Recommendations/ files — ux-fix-queue.html (open ☐ items), dated *-ux-handoff-*.html files, and other audit reports — then fixes everything that is a confirmed, actionable UX or format problem in a site file.',
  phases: [
    { title: 'Collect', detail: 'Read ux-fix-queue.html + all *-ux-handoff* files + most-recent copy of every other report type + live brain_check + validate_mobile_render' },
    { title: 'Triage', detail: 'Deduplicate and prioritize the full problem list across all sources' },
    { title: 'Fix', detail: 'Fix each confirmed problem in place' },
    { title: 'Validate + push', detail: 'Run brain_check + pre_push_guard, commit, push, mark items done in ux-fix-queue.html' },
  ],
}

const ROOT = '/Users/danielebellinello/Documents/The Voyager Expert'

// ── Schema: one UX problem ────────────────────────────────────────────────────
const PROBLEM_SCHEMA = {
  type: 'object',
  properties: {
    problems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id:          { type: 'string' },        // short slug, e.g. "beige-pill-visas"
          severity:    { type: 'string', enum: ['high', 'medium', 'low'] },
          file:        { type: 'string' },        // absolute path of the file to fix
          description: { type: 'string' },        // what is wrong, specific
          fix:         { type: 'string' },        // exactly what to change
          rule_source: { type: 'string' },        // which CORE RULES file / brain_check check
          source:      { type: 'string' },        // "audit-report" | "brain_check" | "mobile_render" | "css_duplication"
        },
        required: ['id', 'severity', 'file', 'description', 'fix', 'source'],
      },
    },
    skipped: {
      type: 'array',
      items: { type: 'string' },
    },
    summary: { type: 'string' },
  },
  required: ['problems', 'skipped', 'summary'],
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — Collect: audit report + live checks
// ═══════════════════════════════════════════════════════════════════════════════
phase('Collect')
log('Reading ALL Recommendations/ files + running live diagnostic checks…')

const collected = await agent(
  `You are collecting ALL currently open UX and format problems across the Voyager Expert site.
Read every source below in full. Miss nothing.

ROOT: ${ROOT}
RECS: ${ROOT}/Recommendations

═══════════════════════════════════════════════════════════════════
SOURCE 1 — ux-fix-queue.html  (THE PRIMARY HAND-OFF FILE)
═══════════════════════════════════════════════════════════════════
Read: ${ROOT}/Recommendations/ux-fix-queue.html

This file is the canonical queue where content routines log items for the UX routine.
Structure: one <div class="run-block"> per routine run. Each item is:
  - .item-open  (check = ☐) → OPEN, must be fixed
  - .item-done  (check = ✓) → already fixed, SKIP

Extract EVERY item-open entry. For each:
  - The <span class="run-page"> gives the target file (relative to Travel-Website/)
  - The <span class="desc"> gives the problem description
  - The <span class="run-source"> gives the originating routine name

═══════════════════════════════════════════════════════════════════
SOURCE 2 — All *-ux-handoff*.html files (dated hand-off files from routines)
═══════════════════════════════════════════════════════════════════
Run:
  ls -t "${ROOT}/Recommendations/"*ux-handoff*.html 2>/dev/null

Read EVERY file found (not just the latest — each may cover a different page).
Each file lists UX items found by a specific routine for a specific page.
Extract every listed problem that is not marked as "fixed in this session" or "already applied".

═══════════════════════════════════════════════════════════════════
SOURCE 3 — Most-recent copy of every other report type
═══════════════════════════════════════════════════════════════════
For EACH of the following patterns, find the most-recent file and read it:
  ls -t "${ROOT}/Recommendations/"*ux-audit*.html    | head -1
  ls -t "${ROOT}/Recommendations/"*mobile-audit*.html | head -1
  ls -t "${ROOT}/Recommendations/"*css-docs-audit*.html | head -1
  ls -t "${ROOT}/Recommendations/"*cross-page-consistency*.html | head -1
  ls -t "${ROOT}/Recommendations/"*brain-health*.html | head -1
  ls -t "${ROOT}/Recommendations/"*safety-guide-ux*.html 2>/dev/null | head -1

Also read any non-dated files (no YYYY-MM-DD prefix) that are not ux-fix-queue.html:
  ls "${ROOT}/Recommendations/" | grep -v '^20[0-9][0-9]-' | grep -v '^ux-fix-queue'

From each of these reports extract ONLY:
  - Confirmed problems with a specific file to fix (not aspirational/ideas)
  - Items NOT already marked fixed or resolved in the report itself
  - Items that are in site files (not guides, not CORE RULES)

Do NOT include:
  - Findings from *-ideas*.html (content/feature ideas, not UX fixes)
  - Findings from *-tooling-gaps*.html (tooling improvements, not site UX)
  - Findings from *-daily-audit*.html (guide-specific; use audit-fix-guide for those)
  - Findings from *-stats-pages-recommendations*.html unless they describe a concrete CSS/format bug
  - Findings from *-currency-guide-refresh*.html (content refresh, not UX)
  - Findings from *-photo-audit*.html (guide photo sizes; auto-healed on ship)
  - Layer 4 / Layer 6 items from mobile-audit (lazy-loading on guides, 100vh on iOS — already tracked in To Do List)

═══════════════════════════════════════════════════════════════════
SOURCE 4 — brain_check live run
═══════════════════════════════════════════════════════════════════
Run:
  cd "${ROOT}" && python3 Brain/scripts/brain_check.py 2>&1

Capture every FAIL line. Each is a confirmed, gate-blocking problem.
WARN lines: include if they point to a specific non-guide file.

═══════════════════════════════════════════════════════════════════
SOURCE 5 — CSS duplication check
═══════════════════════════════════════════════════════════════════
Run:
  cd "${ROOT}" && python3 Brain/scripts/check_css_duplication.py 2>&1 | head -80

Extract violations: hardcoded hex in non-guide pages, body{}/root{} in pages, duplicated components.

═══════════════════════════════════════════════════════════════════
SOURCE 6 — Mobile render check (best-effort, skip if playwright unavailable)
═══════════════════════════════════════════════════════════════════
Run:
  cd "${ROOT}" && python3 Brain/scripts/validate_mobile_render.py --warn 2>&1 | head -80

Extract FAIL lines (skinny pills, overflow, off-center text) for non-guide pages only.

═══════════════════════════════════════════════════════════════════
WHAT TO SKIP (do NOT include):
  - Guide HTML files in Travel-Website/Guides/ (use audit-fix-guide workflow)
  - Files in Brain/CORE RULES/ (read-only without explicit per-session owner approval)
  - Files in Travel/archive/
  - Items already marked ✓ / done / "fixed in this session" / "already applied"
  - Items requiring a new feature decision from the owner
  - Findings that only affect guides (also-on-this-site pills, stop boxes, etc.)

WHAT TO INCLUDE:
  - Trip-Essentials pages (Travel-Website/Trip-Essentials/*.html)
  - Shared CSS/JS assets (assets/guide-style.css, assets/mobile.css, assets/web-travel-style.css, assets/toolbar.js, assets/weather.js)
  - Guides-Index.html, World-Map.html, other Maps pages
  - Site root pages and Best-of pages
  - Brain/Reference/ files (editable — not CORE RULES)

═══════════════════════════════════════════════════════════════════
OUTPUT FORMAT — for EACH confirmed open problem:
  id:          short-kebab-slug unique within this run (e.g. "tag-strong-hardcoded-hex")
  severity:    high (gate-blocking / visually broken) | medium (standards drift) | low (polish)
  file:        absolute path of the file to edit
  description: exactly what is wrong (element, class, line area, current value)
  fix:         exactly what to change (prescriptive — the fixer agent uses this verbatim)
  rule_source: which check / CORE RULES section / report caught it
  source:      "ux-fix-queue" | "ux-handoff" | "ux-audit" | "mobile-audit" | "css-docs-audit" |
               "cross-page-consistency" | "brain-health" | "brain_check" | "mobile_render" |
               "css_duplication" | "safety-guide-ux" | other
═══════════════════════════════════════════════════════════════════
skipped: one-line reason for each excluded item (helps the owner see what was deliberately left out).
summary: "N problems from M sources across K files"`,
  { label: 'collect problems', phase: 'Collect', schema: PROBLEM_SCHEMA, effort: 'high' }
)

log(`Collected: ${collected.problems.length} problem(s) — ${collected.summary}`)
if (collected.skipped.length > 0) {
  log(`Skipped ${collected.skipped.length} item(s): ${collected.skipped.slice(0, 3).join('; ')}${collected.skipped.length > 3 ? '…' : ''}`)
}

if (collected.problems.length === 0) {
  log('No open UX problems found — the site is clean.')
  // Still run brain_check one more time to triple-check
  await agent(
    `Run brain_check one final time to confirm no problems exist:
  cd "${ROOT}" && python3 Brain/scripts/brain_check.py

If it exits 0 with no FAIL lines, report "brain_check clean — no UX problems to fix."
If it finds failures, report them verbatim.`,
    { label: 'final brain_check', phase: 'Collect' }
  )
  return { status: 'clean', problems_fixed: 0 }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — Triage: deduplicate and prioritize
// ═══════════════════════════════════════════════════════════════════════════════
phase('Triage')
log(`Triaging ${collected.problems.length} problem(s) by severity and file…`)

// Sort: high first, then medium, then low. Within each tier, group by file.
const byFile = {}
for (const p of collected.problems) {
  if (!byFile[p.file]) byFile[p.file] = []
  byFile[p.file].push(p)
}

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 }
const sortedProblems = collected.problems.sort(
  (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
)

const highCount   = sortedProblems.filter(p => p.severity === 'high').length
const mediumCount = sortedProblems.filter(p => p.severity === 'medium').length
const lowCount    = sortedProblems.filter(p => p.severity === 'low').length
const fileCount   = Object.keys(byFile).length

log(`Priority breakdown: ${highCount} high / ${mediumCount} medium / ${lowCount} low across ${fileCount} file(s)`)

// Log each problem clearly so the user can see what's being fixed
for (const p of sortedProblems) {
  const sev = p.severity.toUpperCase().padEnd(6)
  const shortFile = p.file.replace(ROOT + '/', '')
  log(`[${sev}] ${p.id} — ${shortFile}: ${p.description.slice(0, 80)}`)
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — Fix: one agent per file, batched in parallel
// ═══════════════════════════════════════════════════════════════════════════════
phase('Fix')
log(`Fixing ${fileCount} file(s) with confirmed UX problems…`)

// Group all problems for the same file into one agent so edits don't collide
const fileEntries = Object.entries(byFile)

const fixResults = await parallel(
  fileEntries.map(([filePath, fileProblems]) => async () => {
    const shortPath = filePath.replace(ROOT + '/', '')
    const highestSev = fileProblems.some(p => p.severity === 'high') ? 'HIGH'
                     : fileProblems.some(p => p.severity === 'medium') ? 'MEDIUM' : 'LOW'

    return agent(
      `You are fixing ${fileProblems.length} confirmed UX problem(s) in ONE file.

FILE: ${filePath}

─────────────────────────────────────────────────────────────────
PROBLEMS TO FIX IN THIS FILE (fix ALL of them):
${fileProblems.map((p, i) => `
${i + 1}. [${p.severity.toUpperCase()}] ${p.id}
   Source: ${p.source} / ${p.rule_source || ''}
   Problem: ${p.description}
   Fix: ${p.fix}
`).join('')}
─────────────────────────────────────────────────────────────────

RULES FOR THIS STEP:
- Read the file first with the Read tool (required before any Edit/Write)
- Use the Edit tool for surgical in-place fixes
- Fix ONLY the listed problems — do not restructure unrelated things
- For CSS problems: use CSS variables (var(--accent), var(--surface), etc.) — never hardcode hex
- For pill rest-state problems: background must be #ffffff or var(--surface), never beige
- For active/hover fill problems: must be #b85c2a or the terracotta gradient, never gold
- For placeholder ellipsis: remove …/... from input placeholder text
- After ALL edits on this file are done, verify by reading back the edited section

After fixing, report:
  - For each problem: what you changed (before → after), line/element reference
  - Any problem you could not fix (with reason)`,
      { label: `fix: ${shortPath} [${highestSev}]`, phase: 'Fix', effort: 'medium' }
    )
  })
)

log(`Fix phase complete — ${fixResults.filter(Boolean).length}/${fileCount} file(s) processed.`)

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — Validate and push
// ═══════════════════════════════════════════════════════════════════════════════
phase('Validate + push')
log('Running final validation checks before committing…')

const fixedIds = sortedProblems.map(p => p.id)
const queueFixedItems = sortedProblems
  .filter(p => p.source === 'ux-fix-queue')
  .map(p => p.description.slice(0, 80))

await agent(
  `You are running final validation, marking fixed items in the queue file, and pushing UX fixes.

ROOT: ${ROOT}
QUEUE FILE: ${ROOT}/Recommendations/ux-fix-queue.html

PROBLEMS THAT WERE FIXED (from ux-fix-queue or ux-handoff sources):
${sortedProblems.filter(p => p.source === 'ux-fix-queue' || p.source === 'ux-handoff').map(p =>
  `  - [${p.id}] ${p.file.replace(ROOT + '/', '')} — ${p.description.slice(0, 80)}`
).join('\n') || '  (none from queue/handoff sources)'}

─────────────────────────────────────────────────────────────────
STEP 1 — brain_check (must pass before push):
  cd "${ROOT}" && python3 Brain/scripts/brain_check.py

If there are FAIL lines: fix each failing file now. Repeat until brain_check exits 0.

STEP 2 — pre_push_guard (must pass before push):
  cd "${ROOT}" && python3 Brain/scripts/pre_push_guard.py

If it fails: fix the reported issues. Repeat until it exits 0.

STEP 3 — Mark fixed items done in ux-fix-queue.html.
For each open .item-open entry in ${ROOT}/Recommendations/ux-fix-queue.html
that matches a problem this workflow fixed:
  - Change class="item item-open" → class="item item-done"
  - Change <span class="check">☐</span> → <span class="check">✓</span>
Use the Edit tool on ${ROOT}/Recommendations/ux-fix-queue.html.
DO NOT change .item-done entries or entries for problems NOT fixed this run.
DO NOT delete any entries — the file is an audit history.

STEP 4 — Check git status:
  cd "${ROOT}" && git status

Stage ONLY the files this workflow fixed + ux-fix-queue.html (if modified):
  cd "${ROOT}" && git add <each specific file>

NEVER use git add -A or git add . — stage only what this workflow touched.

STEP 5 — Commit with this exact format (heredoc required):
  cd "${ROOT}" && git commit -m "$(cat <<'EOF'
UX fix: resolve format/CSS problems across site pages

Co-Authored-By: The Expert <noreply@the-voyager-expert.com>
EOF
)"

STEP 6 — Push:
  cd "${ROOT}" && git push

If the push is rejected (non-fast-forward):
  cd "${ROOT}" && git pull --rebase && git push

STEP 7 — Report:
  - brain_check final result (exit code + any remaining warnings)
  - Which ux-fix-queue items were marked done
  - List of files committed
  - Commit hash
  - Push result
  - Any problems that could NOT be fixed this run (with reason)`,
  { label: 'validate + push', phase: 'Validate + push', effort: 'high' }
)

log('Done — UX problems found, fixed, validated, and pushed.')

return {
  status: 'complete',
  problems_found: collected.problems.length,
  files_fixed: fileCount,
  high: highCount,
  medium: mediumCount,
  low: lowCount,
}
