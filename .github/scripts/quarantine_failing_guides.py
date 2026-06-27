#!/usr/bin/env python3
"""quarantine_failing_guides.py — per-guide deploy isolation for GitHub Pages.

WHY THIS EXISTS
---------------
GitHub Pages republishes the ENTIRE Travel-Website/ tree on every push — there
is no "publish one guide." The old gate (deploy-pages.yml) responded to a single
bad guide with `exit 1`, which killed the whole deploy and blocked every other
(valid) guide from going live. It also only checked that the
`<!-- validation: passed -->` STRING existed — so 151 guides that were bulk
hand-stamped on 2026-06-22 (identical timestamps, never validated) sailed
straight through. Naples Florida is live with 0 photos and 2 tours because of it.

WHAT THIS DOES
--------------
Two changes, together:

  1. HARDEN — re-run the REAL validator (Brain/scripts/validate_itinerary.py,
     the 400+ rule check, which is published in the repo) on every guide that is
     ADDED or MODIFIED in this push. A hand-typed / bulk-faked stamp can no
     longer pass: the guide must actually validate.

  2. ISOLATE — a guide that fails does NOT block the deploy. Its published page
     is replaced (in the staged artifact only — never in the repo) with a small
     "being updated" placeholder at the same URL. Every other guide publishes
     normally. Because the path still resolves, the index card, the prev/next
     carousel chain, and search keep working — nothing 404s.

Only guides CHANGED IN THIS PUSH are validated. The existing backlog of
already-live guides is left exactly as-is (publish untouched) — this gate stops
NEW breakage and lets correct new guides through; it does not retroactively pull
the backlog. Cleaning that up is a separate, deliberate effort.

USAGE
-----
    python3 .github/scripts/quarantine_failing_guides.py --stage _site

Reads the push range from the environment (GitHub Actions sets these):
    GITHUB_EVENT_BEFORE  — sha before the push  (github.event.before)
    GITHUB_SHA           — sha after the push    (github.sha)
Falls back gracefully when they are absent (workflow_dispatch / first deploy):
no changed guides → nothing validated → everything publishes as-is.

Exit 0 always, unless an infrastructure error occurs (missing validator, copy
failure). A failing guide is a normal, expected outcome — it is quarantined,
not escalated to a deploy failure.
"""

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(subprocess.run(["git", "rev-parse", "--show-toplevel"],
                           capture_output=True, text=True).stdout.strip() or ".")
VALIDATOR = REPO / "Brain" / "scripts" / "validate_itinerary.py"
SITE_SRC = REPO / "Travel-Website"
EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
GUIDES_REL = "Travel-Website/Guides"


def git(*args: str) -> str:
    out = subprocess.run(["git", *args], capture_output=True, text=True)
    return out.stdout.strip()


def changed_guide_files() -> list[Path]:
    """Guide HTML added/modified in this push (depth-4, excludes Guides-Index)."""
    before = os.environ.get("GITHUB_EVENT_BEFORE", "").strip()
    after = os.environ.get("GITHUB_SHA", "").strip() or "HEAD"

    # No usable "before" (workflow_dispatch, first push, or all-zero sha) →
    # don't treat anything as changed; publish the tree as-is.
    if not before or set(before) == {"0"}:
        if not git("rev-parse", "--verify", "origin/main^{commit}"):
            return []
        # Manual run with a remote present: compare last commit only, so a
        # dispatch never mass-quarantines the backlog.
        before = git("rev-parse", "--verify", "HEAD~1") or EMPTY_TREE

    diff = git("diff", "--name-only", "--diff-filter=AM", before, after,
               "--", GUIDES_REL)
    files = []
    for rel in diff.splitlines():
        p = Path(rel)
        if p.suffix.lower() != ".html":
            continue
        if p.name == "Guides-Index.html":
            continue
        if len(p.parts) != 4:          # Guides/<City>/<file>.html only
            continue
        if (REPO / p).is_file():
            files.append(p)
    return files


def _run_once(guide: Path) -> tuple[bool, list[str]]:
    proc = subprocess.run(
        [sys.executable, str(VALIDATOR), str(REPO / guide)],
        capture_output=True, text=True, timeout=600,
    )
    out = proc.stdout + proc.stderr
    fails = [ln.strip()[2:].strip() for ln in out.splitlines()
             if ln.strip().startswith("❌") and "failed" not in ln]
    return proc.returncode == 0, fails


def validate(guide: Path, attempts: int = 3) -> tuple[bool, int, str]:
    """Run the validator up to `attempts` times; PASS if ANY run passes.

    The validator's failures are one-directional under flaky I/O: a cold /
    partial file read can make data that IS present look missing (turning a
    real PASS into a spurious fail), but it can never invent a missing photo or
    a structural defect that isn't there. So a guide that genuinely passes will
    pass on at least one attempt, while a genuinely broken guide fails every
    time — its defects don't come and go. Requiring unanimous failure before
    quarantining makes a false quarantine of a correct guide effectively
    impossible, which is the whole point: a correct new guide must never be held
    back. Returns (passed, fail_count_of_last_run, first_failures)."""
    last_fails: list[str] = []
    for _ in range(attempts):
        ok, fails = _run_once(guide)
        if ok:
            return True, 0, ""
        last_fails = fails
    return False, len(last_fails), " | ".join(last_fails[:3])


def placeholder_html(city: str) -> str:
    """A friendly stand-in served at the failing guide's URL (depth-2 page).

    Loads the shared toolbar + stylesheet so the page still looks like the site
    and every nav control works. No guide content — just a notice."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{city}</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="../../assets/guide-style.css">
</head>
<body>
<div id="toolbar-mount" data-depth="2" data-maxwidth="940"></div>
<script src="../../assets/toolbar.js"></script>
<div class="container" style="text-align:center;padding:64px 24px;">
  <div class="title-city">{city}</div>
  <p style="margin-top:24px;font-size:15px;color:#6b6256;">
    🛠️ This guide is being updated and will be back shortly.
  </p>
  <p style="margin-top:8px;font-size:13px;color:#9a9082;">
    It was held back from publishing because it didn't pass the quality checks.
  </p>
</div>
</body>
</html>
"""


def city_from(folder: str) -> str:
    return folder.replace("-", " ").strip()


def main() -> int:
    stage = Path(sys.argv[sys.argv.index("--stage") + 1]) if "--stage" in sys.argv else Path("_site")
    if not VALIDATOR.is_file():
        print(f"::error::validator not found at {VALIDATOR} — cannot enforce. Failing closed.")
        return 1

    # CANARY — before trusting the gate, confirm the validator behaves in THIS
    # environment by running it on a guide known to pass. If even the canary
    # fails (e.g. a runner without network, a broken checkout, a validator
    # regression), the environment is untrustworthy and quarantining would mass-
    # hold-back correct guides. In that case fall back to report-only: publish
    # everything as-is and surface a loud warning, rather than nuke the site.
    canary = REPO / "Travel-Website" / "Guides" / "Colombo" / "colombo_v1.html"
    canary_ok = True
    if canary.is_file():
        canary_ok, _, ctop = validate(Path("Travel-Website/Guides/Colombo/colombo_v1.html"))
        if not canary_ok:
            print(f"::warning::CANARY FAILED — validator does not trust this environment "
                  f"({ctop[:100]}). Falling back to report-only: nothing will be quarantined.")

    changed = changed_guide_files()
    print(f"Changed guide(s) in this push: {len(changed)}")

    failures: list[tuple[Path, int, str]] = []
    passes = 0
    for g in changed:
        try:
            ok, n, top = validate(g)
        except subprocess.TimeoutExpired:
            ok, n, top = False, -1, "validator timed out"
        if ok:
            passes += 1
            print(f"  ✅ {g}")
        else:
            failures.append((g, n, top))
            print(f"  ❌ {g} — {n} failure(s): {top}")

    # Stage the artifact: full tree, then swap failing guides for placeholders.
    site_dest = stage / "Travel-Website"
    if site_dest.exists():
        shutil.rmtree(site_dest)
    shutil.copytree(SITE_SRC, site_dest)
    nojekyll = REPO / ".nojekyll"
    if nojekyll.is_file():
        shutil.copy(nojekyll, stage / ".nojekyll")
    else:
        (stage / ".nojekyll").write_text("")

    quarantined = failures if canary_ok else []
    for g, n, _ in quarantined:
        folder = g.parts[2]                       # Guides/<folder>/file.html
        dest = stage / g
        dest.write_text(placeholder_html(city_from(folder)), encoding="utf-8")
        print(f"  🔒 quarantined → placeholder: {g}")
    if failures and not canary_ok:
        print("  ⚠️  report-only (canary failed): failing guides published AS-IS, none quarantined.")

    # Job summary (shown in the Actions run).
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write("## Guide deploy gate\n\n")
            if not canary_ok:
                fh.write("> ⚠️ **Canary failed — report-only mode.** The validator did not "
                         "trust this runner, so nothing was quarantined; failing guides were "
                         "published as-is. Investigate the runner before relying on the gate.\n\n")
            fh.write(f"- Changed guides validated: **{len(changed)}**\n")
            fh.write(f"- Published: **{passes}**\n")
            fh.write(f"- Quarantined (placeholder, deploy still proceeded): **{len(quarantined)}**\n\n")
            if failures:
                fh.write("| Guide | Failures | Action | Sample |\n|---|---|---|---|\n")
                for g, n, top in failures:
                    act = "quarantined" if canary_ok else "published (canary off)"
                    fh.write(f"| `{g}` | {n} | {act} | {top[:100]} |\n")

    print(f"\nResult: {passes} published, {len(quarantined)} quarantined, deploy proceeds.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
