export const meta = {
  name: 'push',
  description: 'Safe push: runs brain_check + pre_push_guard, commits staged changes, pushes. Pass a commit message as args.',
  whenToUse: 'When you want to push staged changes to the repo. Pass the commit message as args. Runs all guards before committing — if anything fails it stops and reports.',
  phases: [
    { title: 'Pre-flight', detail: 'Check git status, run brain_check and pre_push_guard' },
    { title: 'Commit + push', detail: 'Commit staged changes and push' },
  ],
}

const ROOT = '/Users/danielebellinello/Documents/The Voyager Expert'

if (!args || typeof args !== 'string' || !args.trim()) {
  throw new Error(
    'No commit message provided.\n\n' +
    'Invoke with:\n' +
    '  args: "Your commit message here"'
  )
}

const commitMessage = args.trim()

// ── Schema: pre-flight result ─────────────────────────────────────────────────
const PREFLIGHT_SCHEMA = {
  type: 'object',
  properties: {
    git_status:          { type: 'string' },
    staged_files:        { type: 'array', items: { type: 'string' } },
    unstaged_modified:   { type: 'array', items: { type: 'string' } },
    brain_check_passed:  { type: 'boolean' },
    brain_check_output:  { type: 'string' },
    push_guard_passed:   { type: 'boolean' },
    push_guard_output:   { type: 'string' },
    safe_to_push:        { type: 'boolean' },
    blocker:             { type: ['string', 'null'] },
  },
  required: ['staged_files', 'brain_check_passed', 'push_guard_passed', 'safe_to_push', 'blocker'],
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — Pre-flight checks
// ═══════════════════════════════════════════════════════════════════════════════
phase('Pre-flight')
log(`Commit message: "${commitMessage}"`)

const preflight = await agent(
  `You are running pre-flight checks before a git push.

ROOT: ${ROOT}

STEP 1 — Git status:
  cd "${ROOT}" && git status
  cd "${ROOT}" && git diff --name-only --cached

Report: list of staged files, list of unstaged-but-modified tracked files.

STEP 2 — brain_check:
  cd "${ROOT}" && python3 Brain/scripts/brain_check.py

Capture full output. Passed = exits 0 with no FAIL lines.

STEP 3 — pre_push_guard:
  cd "${ROOT}" && python3 Brain/scripts/pre_push_guard.py

Capture full output. Passed = exits 0.

STEP 4 — Determine safe_to_push:
  true only if BOTH brain_check AND pre_push_guard passed (exit 0, no FAIL lines).
  If either failed, set safe_to_push=false and blocker = a one-sentence summary of what failed.
  If safe_to_push=true, set blocker=null.

Return result.`,
  { label: 'pre-flight checks', phase: 'Pre-flight', schema: PREFLIGHT_SCHEMA }
)

log(`Staged: ${preflight.staged_files.length} file(s)`)
log(`brain_check: ${preflight.brain_check_passed ? 'PASSED' : 'FAILED'}`)
log(`pre_push_guard: ${preflight.push_guard_passed ? 'PASSED' : 'FAILED'}`)

if (!preflight.safe_to_push) {
  throw new Error(
    `Push blocked — ${preflight.blocker}\n\n` +
    `brain_check output:\n${preflight.brain_check_output || '(none)'}\n\n` +
    `pre_push_guard output:\n${preflight.push_guard_output || '(none)'}\n\n` +
    `Fix the failures above, then run this workflow again.`
  )
}

if (preflight.staged_files.length === 0) {
  throw new Error(
    'Nothing staged to commit.\n' +
    'Stage your changes first with git add, then run this workflow again.'
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — Commit and push
// ═══════════════════════════════════════════════════════════════════════════════
phase('Commit + push')
log('All checks passed — committing and pushing…')

await agent(
  `You are committing staged changes and pushing to origin.

ROOT: ${ROOT}

Staged files:
${preflight.staged_files.map(f => `  - ${f}`).join('\n')}

STEP 1 — Commit with this exact message (use a heredoc to preserve formatting):
  cd "${ROOT}" && git commit -m "$(cat <<'EOF'
${commitMessage}

Co-Authored-By: The Expert <noreply@the-voyager-expert.com>
EOF
)"

STEP 2 — Push:
  cd "${ROOT}" && git push

STEP 3 — Confirm push succeeded (exit 0, no rejection errors).
If the push is rejected (non-fast-forward), run:
  cd "${ROOT}" && git pull --rebase && git push

Report: commit hash, files committed, push result.`,
  { label: 'commit + push', phase: 'Commit + push' }
)

log('Done — changes committed and pushed.')
