#!/usr/bin/env python3
"""quarantine_failing_guides.py — deploy-time PROOF check for GitHub Pages.

THE MODEL
---------
Validation runs LOCALLY. The 400-rule validator (Brain/scripts/validate_itinerary.py)
runs on the crib when a guide is built/shipped/edited; on a clean pass it writes a
CONTENT-BOUND SIGNED stamp (Brain/scripts/validation_stamp.py). That signature is
the *proof* the guide passed on this exact content.

This script does NOT re-run the validator. GitHub Pages republishes the whole
Travel-Website/ tree on every push and serves whatever is committed, so the one
thing that must happen server-side is the cheapest possible check: VERIFY THE
SIGNED PROOF on each guide. A guide whose signature does not match its content —
a hand-typed / bulk-written stamp, or a guide edited after it was validated — is
held back; everything else is served.

WHY A SERVER-SIDE CHECK STILL EXISTS
------------------------------------
The local pre-push hook enforces the same signature, but it is `--no-verify`
bypassable (the auto-push automation skips it) and anyone can push directly.
This is the un-bypassable backstop. It is a hash verification, not a re-run of
validation — validation itself stays local.

ISOLATION
---------
A held-back guide does NOT fail the deploy. Its published page is swapped (in the
staged artifact only — never in the repo) for a small "being updated" placeholder
at the same URL, so the index card, prev/next carousel, and search keep resolving;
nothing 404s. Every other guide publishes normally.

LEGACY GRACE
------------
Guides that still carry an old UNSIGNED stamp (no `sig=`) can't be cheaply judged
good-or-bad, so they are SERVED and flagged, not held back — this is what lets the
new scheme roll out without quarantining the existing fleet. They get a real
signature the next time they're validated locally. (To force the backlog onto the
signed scheme, re-validate each guide locally; broken ones will then fail to sign.)

USAGE
-----
    python3 .github/scripts/quarantine_failing_guides.py --stage _site

Runs fully locally too — no GitHub, no network, no validator. Exit 0 always,
unless an infrastructure error occurs (missing site tree, copy failure).
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(subprocess.run(["git", "rev-parse", "--show-toplevel"],
                           capture_output=True, text=True).stdout.strip() or ".")
SITE_SRC = REPO / "Travel-Website"
GUIDES_REL = "Travel-Website/Guides"

# Shared signed-stamp module (tracked in the repo, stdlib-only).
sys.path.insert(0, str(REPO / "Brain" / "scripts"))
try:
    import validation_stamp as _vs
except Exception as _e:  # noqa: BLE001
    _vs = None
    _vs_err = _e


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
    """Every served guide on the site (one per city folder), repo-relative."""
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


def signature_state(guide: Path) -> str:
    """Cheap classification of a guide's stamp signature (no validator re-run).

    'valid'    — a signed stamp whose signature matches the content. SERVED.
    'tampered' — a signed stamp whose signature does NOT match (forged stamp, or
                 the guide was edited after validation). HELD BACK.
    'legacy'   — an unsigned/old stamp (or none). Can't cheaply judge it, so it
                 is SERVED and flagged (re-validate locally to sign it).
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
    if _vs is None:
        print(f"::error::validation_stamp module not importable ({_vs_err}) — cannot verify proofs.")
        return 1
    if not SITE_SRC.is_dir():
        print(f"::error::site tree not found at {SITE_SRC}")
        return 1

    every = all_guide_files()

    valid: list[Path] = []
    tampered: list[Path] = []
    legacy: list[Path] = []
    for g in every:
        st = signature_state(g)
        if st == "valid":
            valid.append(g)
        elif st == "tampered":
            tampered.append(g)
            print(f"  🔒 {g} — signature does not match content (forged/edited) → held back")
        else:
            legacy.append(g)
    if legacy:
        print(f"  ℹ️  {len(legacy)} guide(s) carry a legacy unsigned stamp "
              f"(served as-is; re-validate locally to sign).")

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

    for g in sorted(tampered):
        folder = g.parts[2]                       # Guides/<folder>/file.html
        (stage / g).write_text(placeholder_html(city_from(folder)), encoding="utf-8")
        print(f"  🔒 held back → placeholder: {g}")

    # Job summary (shown in the Actions run).
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write("## Guide deploy gate (signature proof check)\n\n")
            fh.write("> Validation runs locally. This step only verifies the signed proof — "
                     "it does **not** re-run the validator.\n\n")
            fh.write(f"- Guides on site: **{len(every)}**\n")
            fh.write(f"- Valid signature (served): **{len(valid)}**\n")
            fh.write(f"- Bad signature (held back): **{len(tampered)}**\n")
            fh.write(f"- Legacy unsigned (served, flagged): **{len(legacy)}**\n\n")

    print(f"\nResult: {len(every) - len(tampered)} served, {len(tampered)} held back, deploy proceeds.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
