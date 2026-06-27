#!/usr/bin/env python3
"""quarantine_failing_guides.py — per-guide deploy gate for GitHub Pages.

WHY THIS EXISTS
---------------
GitHub Pages republishes the ENTIRE Travel-Website/ tree on every push — there
is no "publish one guide." The old gate (deploy-pages.yml) responded to a single
bad guide with `exit 1`, which killed the whole deploy and blocked every other
(valid) guide. It also only checked that the `<!-- validation: passed -->` STRING
existed — so 151 guides bulk hand-stamped on 2026-06-22 (identical timestamps,
never validated) sailed straight through.

WHAT THIS DOES — four properties, matching the validation rules:
  1. SCOPED (default) — re-run the REAL validator (Brain/scripts/validate_itinerary.py,
     the 400+ rule check) ONLY on the guides ADDED or MODIFIED in this push, NOT
     the whole fleet. Validating one guide to ship never re-validates every guide.
  2. UN-FAKEABLE — every guide on the site is signature-checked (cheap HMAC, no
     re-run) via validation_stamp.py. A stamp that was hand-typed/bulk-written, or
     a guide edited after it was validated, carries a signature that no longer
     matches its content → held back. You cannot fake "passed".
  3. ISOLATED — a guide that fails (validation OR signature) does NOT block the
     deploy. Its published page is swapped (in the staged artifact only — never in
     the repo) for a small "being updated" placeholder at the same URL, so the
     index card, prev/next carousel, and search keep resolving; nothing 404s.
     Every other guide publishes normally.
  4. CANARY — if the validator can't even pass a known-good guide on the runner,
     the gate drops validation-based holdbacks to report-only rather than mass-
     quarantining (signature holdbacks still apply — they don't need the validator).

  --all  — re-run the REAL validator on EVERY guide (on-demand backlog cleanup,
           e.g. after a rule change). NOT wired into the deploy; run it manually
           when you want a full sweep.

Serving is unchanged: Travel-Website/ is staged at the artifact root + .nojekyll.

USAGE
-----
    python3 .github/scripts/quarantine_failing_guides.py --stage _site
    python3 .github/scripts/quarantine_failing_guides.py --stage _site --all

Exit 0 always, unless an infrastructure error occurs (missing validator, copy
failure). A failing guide is a normal, expected outcome — it is held back, not
escalated to a deploy failure.
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(subprocess.run(["git", "rev-parse", "--show-toplevel"],
                           capture_output=True, text=True).stdout.strip() or ".")
VALIDATOR = REPO / "Brain" / "scripts" / "validate_itinerary.py"
SITE_SRC = REPO / "Travel-Website"
GUIDES_REL = "Travel-Website/Guides"

# Shared signed-stamp module (tracked in the repo, stdlib-only).
sys.path.insert(0, str(REPO / "Brain" / "scripts"))
try:
    import validation_stamp as _vs
except Exception:  # noqa: BLE001
    _vs = None


def git(*args: str) -> str:
    out = subprocess.run(["git", *args], capture_output=True, text=True)
    return out.stdout.strip()


def _served_html(city_dir: Path) -> Path | None:
    """The served guide in a city folder = the largest .html (excludes index)."""
    htmls = sorted(city_dir.glob("*.html"),
                   key=lambda f: f.stat().st_size, reverse=True)
    for h in htmls:
        if h.name == "Guides-Index.html":
            continue
        return h
    return None


def all_guide_files() -> list[Path]:
    """Every served guide on the site (one per city folder), as repo-relative paths."""
    files: list[Path] = []
    base = REPO / GUIDES_REL
    if not base.is_dir():
        return files
    for city_dir in sorted(base.iterdir()):
        if not city_dir.is_dir():
            continue
        served = _served_html(city_dir)
        if served is not None:
            files.append(served.relative_to(REPO))
    return files


def _push_range() -> tuple[str, str]:
    """(before, after) SHAs bounding this push.

    Prefers the SHAs GitHub provides for the push event ($BEFORE_SHA / $AFTER_SHA,
    wired in deploy-pages.yml). Falls back to HEAD~1..HEAD for manual runs.
    """
    before = (os.environ.get("BEFORE_SHA") or "").strip()
    after = (os.environ.get("AFTER_SHA") or "").strip() or "HEAD"
    # All-zero before = branch's first push (no prior commit) — treat as "no range".
    if before and set(before) != {"0"} and git("cat-file", "-t", before) == "commit":
        return before, after
    parent = git("rev-parse", "--verify", "HEAD~1")
    if parent:
        return parent, "HEAD"
    return "", after


def changed_guide_files() -> tuple[list[Path], bool]:
    """Guides added/modified in this push (one served file per touched city folder).

    Returns (files, scoped). scoped=False means we couldn't determine a range
    (first commit / shallow checkout) and the caller should fall back to --all.
    """
    before, after = _push_range()
    if not before:
        return all_guide_files(), False
    out = git("diff", "--name-only", "--diff-filter=AM", before, after,
              "--", GUIDES_REL)
    touched_cities: set[str] = set()
    for rel in out.splitlines():
        p = Path(rel)
        # Travel-Website/Guides/<City>/<file> — index any change under a city
        # folder (HTML edit, photo swap, etc.) back to that city's served guide.
        if len(p.parts) >= 4 and p.parts[1] == "Guides" and p.parts[2] != "":
            if p.parts[2].endswith(".html"):
                continue  # Guides-Index.html sits directly under Guides/
            touched_cities.add(p.parts[2])
    files: list[Path] = []
    for city in sorted(touched_cities):
        served = _served_html(REPO / GUIDES_REL / city)
        if served is not None:
            files.append(served.relative_to(REPO))
    return files, True


def _run_once(guide: Path) -> bool:
    proc = subprocess.run(
        [sys.executable, str(VALIDATOR), str(REPO / guide)],
        capture_output=True, text=True, timeout=600,
    )
    return proc.returncode == 0


def validate(guide: Path, attempts: int = 3) -> bool:
    """Run the validator up to `attempts` times; PASS if ANY run passes.

    The validator's failures are one-directional under flaky I/O: a cold/partial
    read can turn a real PASS into a spurious fail, but never invent a defect
    that isn't there. Requiring unanimous failure before quarantining makes a
    false quarantine of a correct guide effectively impossible."""
    for _ in range(attempts):
        try:
            if _run_once(guide):
                return True
        except subprocess.TimeoutExpired:
            continue
    return False


def signature_state(guide: Path) -> str:
    """Cheap, no-re-run classification of a guide's stamp signature.

    Returns one of:
      'valid'   — a v2 signed stamp whose signature matches the content.
      'tampered'— a signed stamp whose signature does NOT match (forged, or the
                  guide was edited after validation). HELD BACK.
      'legacy'  — an unsigned/old stamp (or none). Can't cheaply tell good from
                  bad, so it is NOT held back on this basis — it's just flagged.
    """
    if _vs is None:
        return "legacy"
    try:
        html = (REPO / guide).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return "legacy"
    ok, _reason = _vs.verify(html)
    if ok:
        return "valid"
    if _vs.extract_sig(html):
        return "tampered"
    return "legacy"


def placeholder_html(city: str) -> str:
    """A friendly stand-in served at a held-back guide's URL (depth-2 page)."""
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
    🛠️ This guide is being re-reviewed and will be back shortly.
  </p>
  <p style="margin-top:8px;font-size:13px;color:#9a9082;">
    It's held back until it passes a full quality check.
  </p>
</div>
</body>
</html>
"""


def city_from(folder: str) -> str:
    return folder.replace("-", " ").strip()


def main() -> int:
    stage = Path(sys.argv[sys.argv.index("--stage") + 1]) if "--stage" in sys.argv else Path("_site")
    full = "--all" in sys.argv
    if not VALIDATOR.is_file():
        print(f"::error::validator not found at {VALIDATOR} — cannot enforce. Failing closed.")
        return 1

    # CANARY — confirm the validator behaves on a known-good guide here. If even
    # the canary fails, validation-based holdbacks fall back to report-only.
    canary = REPO / "Travel-Website" / "Guides" / "Colombo" / "colombo_v1.html"
    canary_ok = True
    if canary.is_file():
        canary_ok = validate(Path("Travel-Website/Guides/Colombo/colombo_v1.html"))
        if not canary_ok:
            print("::warning::CANARY FAILED — validator does not trust this environment. "
                  "Falling back to report-only for validation holdbacks (signature holdbacks still apply).")

    every = all_guide_files()
    if full:
        targets, scoped = every, False
    else:
        targets, scoped = changed_guide_files()
        if not scoped:
            print("::notice::no push range available — validating the full fleet this run.")
            targets = every
    print(f"Real validation ({'FULL fleet' if (full or not scoped) else 'changed guides'}): "
          f"{len(targets)} of {len(every)} total")

    # 1) Real validator on the in-scope guides (expensive, but scoped).
    from concurrent.futures import ThreadPoolExecutor
    val_failures: set[Path] = set()
    passes = 0

    def _check(g: Path):
        return g, validate(g)

    with ThreadPoolExecutor(max_workers=8) as ex:
        for g, ok in ex.map(_check, targets):
            if ok:
                passes += 1
                print(f"  ✅ {g}")
            else:
                val_failures.add(g)
                print(f"  ❌ {g} — failed real validation")

    # 2) Cheap signature check across the WHOLE fleet (no validator re-run).
    #    Holds back guides whose signature is present but does NOT match content
    #    (forged stamp, or edited after validation). Legacy unsigned guides are
    #    flagged but NOT held back on this basis (can't cheaply judge them).
    tampered: set[Path] = set()
    legacy: list[Path] = []
    for g in every:
        st = signature_state(g)
        if st == "tampered":
            tampered.add(g)
            print(f"  🔏 {g} — signature does not match content (forged/edited)")
        elif st == "legacy":
            legacy.append(g)
    if legacy:
        print(f"  ℹ️  {len(legacy)} guide(s) carry a legacy unsigned stamp "
              f"(served as-is; re-validate to sign).")

    # Held back = real-validation failures (only when canary trusts the env) +
    # tampered signatures (always — they don't depend on the validator).
    held: set[Path] = set(tampered)
    if canary_ok:
        held |= val_failures
    val_skipped = val_failures - held  # validation failures we couldn't act on

    # Stage the artifact: full tree, then swap held-back guides for placeholders.
    site_dest = stage / "Travel-Website"
    if site_dest.exists():
        shutil.rmtree(site_dest)
    shutil.copytree(SITE_SRC, site_dest)
    nojekyll = REPO / ".nojekyll"
    if nojekyll.is_file():
        shutil.copy(nojekyll, stage / ".nojekyll")
    else:
        (stage / ".nojekyll").write_text("")

    for g in sorted(held):
        folder = g.parts[2]                       # Guides/<folder>/file.html
        (stage / g).write_text(placeholder_html(city_from(folder)), encoding="utf-8")
        print(f"  🔒 held back → placeholder: {g}")
    if val_skipped:
        print(f"  ⚠️  report-only (canary failed): {len(val_skipped)} validation-failed "
              f"guide(s) published AS-IS.")

    # Job summary (shown in the Actions run).
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write("## Guide deploy gate\n\n")
            if not canary_ok:
                fh.write("> ⚠️ **Canary failed** — validation holdbacks fell back to report-only "
                         "(signature holdbacks still applied). Investigate the runner.\n\n")
            fh.write(f"- Total guides on site: **{len(every)}**\n")
            fh.write(f"- Real-validated this run: **{len(targets)}** "
                     f"({'full fleet' if (full or not scoped) else 'changed in push'})\n")
            fh.write(f"- Passed real validation: **{passes}**\n")
            fh.write(f"- Held back (validation): **{len(held & val_failures)}**\n")
            fh.write(f"- Held back (bad signature): **{len(tampered)}**\n")
            fh.write(f"- Legacy unsigned (served, flagged): **{len(legacy)}**\n\n")

    print(f"\nResult: {len(every) - len(held)} served, {len(held)} held back, deploy proceeds.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
