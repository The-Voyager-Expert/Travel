#!/usr/bin/env python3
"""pre_push_guard.py — block a git push that would publish an UNVALIDATED page.

GitHub Pages republishes the entire Travel-Website/ tree on every push, so a
guide that ships without a validation stamp, or a non-guide page that hasn't
passed brain_check, would go live immediately.

Policy enforced:
  • ALLOW every push by default for asset files (toolbar.js, guide-style.css,
    assets/, climate.json, etc.) that carry no stamp.
  • BLOCK if a GUIDE HTML (Travel-Website/Guides/<City>/<file>.html, depth 4)
    is NEW or MODIFIED IN THIS PUSH and lacks a valid SIGNED validation stamp
    (see validation_stamp.py). A hand-typed or bulk-written stamp carries no
    matching signature, and a guide edited after it was validated no longer
    matches its signature — both are blocked, the same as a guide with no stamp
    at all.
  • BLOCK if ANY HTML in Travel-Website/ is NEW or MODIFIED IN THIS PUSH and
    brain_check.py exits non-zero. brain_check enforces site-wide format rules
    that apply to every page — banner sizing, pill colours, page margins,
    active-state terracotta, inline-style prohibition, toolbar standard,
    also-on-site pill labels, and more. Guides AND Trip-Essentials / Best-of /
    site root pages are all covered. One brain_check run per push.
  • BLOCK if any NON-GUIDE HTML changed in this push, OR either shared mobile
    CSS asset (assets/mobile.css, assets/web-travel-style.css) changed, and
    validate_mobile_render.py exits non-zero. brain_check is STATIC and never
    renders a page — a pill with the right height/font/radius but text pinned
    to the top of an oversized box (mobile.css's global `a,button{min-height:
    40px}` tap-target rule stretches any styled pill that isn't self-centering
    and isn't exempted) sailed through brain_check + mobile_check on 10 pages
    before this gate existed (found 2026-07-12 from a user screenshot of
    Best-Safari.html). Guides get their own scoped hard block inside
    `guide_tools.py ship`; this gate covers the surfaces ship doesn't touch —
    Trip-Essentials / Best-of / site root — and reruns whenever the shared
    mobile CSS itself changes, since a regression there breaks every page at
    once without any single HTML file showing up in the diff.

Guides already on the remote that haven't changed in this push are NOT
rechecked. In-progress guides that sit quietly in the repo (tracked but
unchanged) never block anything. The non-guide brain_check runs once per push
when any non-guide HTML is in the diff — it scans the whole site, not just
the changed file. Same for the mobile-render gate.

Invoked by Brain/scripts/git-hooks/pre-push (installed via core.hooksPath).
Run standalone anytime:  python3 Brain/scripts/pre_push_guard.py

Exit 0 = safe to push.  Exit 1 = push blocked.

Added 2026-06-21. Revised 2026-06-27: check push diff only, not full tree.
Revised 2026-07-07: extend to non-guide pages via brain_check gate.
Revised 2026-07-12: extend to non-guide pages via validate_mobile_render.py
(pill/button centering — see DriftyCat + memory project-mobile-render-validator).
"""

import subprocess
import sys
from pathlib import Path

# Directories (relative to repo root) whose HTML is published but NOT guides.
# When any HTML here is added/modified, we run brain_check before allowing the push.
_NON_GUIDE_HTML_PREFIXES = (
    "Travel-Website/Trip-Essentials",
    "Travel-Website/index.html",
    "Travel-Website/Website-Main-Pages-Links.html",
)

# Verify the CONTENT-BOUND SIGNED stamp, not just the presence of a string.
# A bulk hand-stamp ("<!-- validation: passed … -->" with no real signature, or
# a guide edited after it was stamped) fails verification and is blocked here.
try:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import validation_stamp as _vs
except Exception:  # noqa: BLE001 — never let an import error brick a push
    _vs = None

STAMP_OK = "<!-- validation: passed"  # legacy substring, fallback only


def _is_validated(html: str) -> bool:
    """True iff the guide carries a valid signed validation stamp."""
    if _vs is not None:
        ok, _reason = _vs.verify(html)
        return ok
    # Fallback if the shared module is unavailable: legacy substring check.
    return STAMP_OK in html


def _git(*args: str) -> str:
    """Run a git command from the repo root; return stdout (stripped) or ''. """
    try:
        out = subprocess.run(
            ["git", *args],
            capture_output=True, text=True, check=True,
        )
        return out.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ""


def _only_deletions(stdin_text: str) -> bool:
    """A pre-push that only DELETES refs sends an all-zero local sha per line.

    Deleting a branch shouldn't be blocked by tree state, so detect that case.
    Empty stdin (guard run standalone) is NOT a deletion — fall through to check.
    """
    lines = [ln for ln in stdin_text.splitlines() if ln.strip()]
    if not lines:
        return False
    for ln in lines:
        parts = ln.split()
        # format: <local ref> <local sha> <remote ref> <remote sha>
        if len(parts) >= 2 and set(parts[1]) != {"0"}:
            return False
    return True


def main() -> int:
    # If launched as a git hook, refs arrive on stdin (git writes them and closes
    # the pipe, so a read returns promptly). When run standalone the pipe may stay
    # open with no data — reading would block forever — so poll with select(0) and
    # only read when data is actually waiting.
    stdin_text = ""
    if not sys.stdin.isatty():
        try:
            import select
            ready, _, _ = select.select([sys.stdin], [], [], 0)
            if ready:
                stdin_text = sys.stdin.read()
        except Exception:
            stdin_text = ""
    if _only_deletions(stdin_text):
        return 0

    root = _git("rev-parse", "--show-toplevel")
    if not root:
        # Not a git repo / git unavailable — nothing to guard, don't block.
        return 0
    repo = Path(root)

    # Find the remote HEAD so we can diff against it.
    # If there's no remote yet (first push), diff against the empty tree.
    remote_head = _git("rev-parse", "--verify", "origin/main")
    if not remote_head:
        # No remote main yet — diff from the empty tree.
        remote_head = _git("rev-parse", "--verify", "origin/master") or "4b825dc642cb6eb9a060e54bf8d69288fbee4904"

    # ── 1. Guide HTML: must carry a valid signed validation stamp ────────────────
    # Files ADDED or MODIFIED in commits being pushed (not already on remote).
    guide_diff = _git("diff", "--name-only", "--diff-filter=AM", remote_head, "HEAD",
                      "--", "Travel-Website/Guides")

    guide_offenders: list[str] = []
    for rel in (guide_diff.splitlines() if guide_diff else []):
        p = Path(rel)
        if p.suffix.lower() != ".html":
            continue
        if p.name == "Guides-Index.html":
            continue
        # Companion pages (read-about.html, etc.) live in a guide folder but are not
        # versioned guides — they have no validation stamp and don't need one.
        if __import__("re").match(r'^.+-read-about\.html$', p.name):
            continue
        # Guide HTML lives at Travel-Website/Guides/<City>/<file>.html (depth 4).
        # Skip anything deeper (e.g. _build/ helpers) — only the guide page matters.
        if len(p.parts) != 4:
            continue
        f = repo / p
        try:
            html = f.read_text(encoding="utf-8", errors="replace")
        except FileNotFoundError:
            continue  # deletion is fine
        if not _is_validated(html):
            guide_offenders.append(rel)

    # ── 2. Any HTML in Travel-Website/: must pass brain_check ───────────────────
    # brain_check enforces site-wide format rules — banner sizing, pill colours,
    # page margins, active-state terracotta, inline-style prohibition in Best-of
    # pages, toolbar standard, also-on-site pill labels, and more. These rules
    # apply to EVERY page on the site, including guides. Run once per push if any
    # HTML anywhere in Travel-Website/ is added or modified.
    all_html_diff = _git("diff", "--name-only", "--diff-filter=AM", remote_head, "HEAD",
                         "--", "Travel-Website")
    any_html_changed = any(
        Path(rel).suffix.lower() == ".html"
        for rel in (all_html_diff.splitlines() if all_html_diff else [])
    )

    brain_check_failed = False
    _brain_check_output = ""
    if any_html_changed:
        brain_check_script = Path(__file__).resolve().parent / "brain_check.py"
        try:
            result = subprocess.run(
                [sys.executable, str(brain_check_script)],
                capture_output=True, text=True,
            )
            if result.returncode != 0:
                brain_check_failed = True
                _brain_check_output = (result.stdout + result.stderr).strip()
            else:
                _brain_check_output = ""
        except Exception as exc:  # noqa: BLE001
            # If brain_check can't run at all, warn but don't hard-block —
            # a broken Python env shouldn't make pushes impossible.
            print(
                f"\n⚠️  pre_push_guard: brain_check.py could not be executed ({exc}).\n"
                "    Proceeding without the non-guide page check.\n",
                file=sys.stderr,
            )
            _brain_check_output = ""

    # ── 3. Non-guide HTML / shared mobile CSS: must pass validate_mobile_render.py ─
    # STATIC checks (brain_check, mobile_check) never render the page, so a pill
    # with the right height/font/radius but text pinned to the top of an
    # oversized box (see module docstring) is invisible to them. Re-run whenever
    # (a) any non-guide HTML changed, since that's the check's own scope, or
    # (b) either shared mobile CSS file changed, since a regression there breaks
    # every page at once without any single HTML file appearing in the diff.
    non_guide_html_changed = any(
        Path(rel).suffix.lower() == ".html" and str(rel).startswith(_NON_GUIDE_HTML_PREFIXES)
        for rel in (all_html_diff.splitlines() if all_html_diff else [])
    )
    css_diff = _git("diff", "--name-only", "--diff-filter=AM", remote_head, "HEAD",
                     "--", "Travel-Website/assets/mobile.css", "Travel-Website/assets/web-travel-style.css")
    shared_mobile_css_changed = bool(css_diff.strip())

    mobile_render_failed = False
    _mobile_render_output = ""
    if non_guide_html_changed or shared_mobile_css_changed:
        mobile_render_script = Path(__file__).resolve().parent / "validate_mobile_render.py"
        try:
            result = subprocess.run(
                [sys.executable, str(mobile_render_script)],
                capture_output=True, text=True, cwd=str(repo), timeout=180,
            )
            if result.returncode != 0:
                mobile_render_failed = True
                _mobile_render_output = (result.stdout + result.stderr).strip()
        except subprocess.TimeoutExpired:
            print(
                "\n⚠️  pre_push_guard: validate_mobile_render.py timed out after 180s.\n"
                "    Proceeding without the mobile-render check.\n",
                file=sys.stderr,
            )
        except Exception as exc:  # noqa: BLE001
            # If it can't run at all (e.g. playwright not installed), warn but
            # don't hard-block — a missing optional dep shouldn't brick pushes.
            print(
                f"\n⚠️  pre_push_guard: validate_mobile_render.py could not be executed ({exc}).\n"
                "    Proceeding without the mobile-render check.\n",
                file=sys.stderr,
            )

    # ── Report and block ─────────────────────────────────────────────────────────
    if not guide_offenders and not brain_check_failed and not mobile_render_failed:
        return 0

    exit_code = 1

    if guide_offenders:
        print(
            "\n🚫  PUSH BLOCKED — guide(s) added/modified in this push are not validated:\n",
            file=sys.stderr,
        )
        for rel in guide_offenders:
            reason = ""
            if _vs is not None:
                try:
                    _ok, reason = _vs.verify((repo / rel).read_text(encoding="utf-8", errors="replace"))
                    reason = f"  ({reason})"
                except Exception:  # noqa: BLE001
                    reason = ""
            print(f"      • {rel}{reason}", file=sys.stderr)
        print(
            "\n    These guides lack a valid SIGNED validation stamp — the stamp is missing,\n"
            "    hand-typed/bulk-written (no real signature), or the guide was edited after it\n"
            "    was validated (so the signature no longer matches its content). A stamp can only\n"
            "    be produced by a real validator pass; it cannot be typed by hand.\n"
            "    Other in-progress guides already in the repo are NOT affected — only the\n"
            "    files changed in THIS push trigger this block.\n"
            "\n    Fix: run  python3 Brain/scripts/guide_tools.py ship <path>  for each blocked guide.\n"
            "    (Or just re-validate:  python3 Brain/scripts/guide_tools.py validate <path>.)\n",
            file=sys.stderr,
        )

    if brain_check_failed:
        print(
            "\n🚫  PUSH BLOCKED — HTML added/modified in this push failed brain_check:\n",
            file=sys.stderr,
        )
        if _brain_check_output:
            for line in _brain_check_output.splitlines():
                print(f"    {line}", file=sys.stderr)
        print(
            "\n    Every page on the site has a required format. brain_check enforces it:\n"
            "    banner sizing, pill colours, page margins, active-state terracotta,\n"
            "    inline-style prohibition, toolbar standard, also-on-site pill labels.\n"
            "    These rules apply to guides AND all Trip-Essentials / Best-of / site pages.\n"
            "\n    Fix: run  python3 Brain/scripts/brain_check.py  and address all FAIL lines.\n"
            "    Then re-commit the corrected file(s) and push again.\n",
            file=sys.stderr,
        )

    if mobile_render_failed:
        print(
            "\n🚫  PUSH BLOCKED — mobile render check failed (off-standard pill sizing/wrap,\n"
            "    off-center pill/button text, or horizontal overflow at 393px):\n",
            file=sys.stderr,
        )
        if _mobile_render_output:
            for line in _mobile_render_output.splitlines():
                print(f"    {line}", file=sys.stderr)
        print(
            "\n    brain_check is STATIC and never renders a page, so an off-standard or\n"
            "    off-center pill sails through it. This gate actually renders every\n"
            "    non-guide page at 393px and measures the result.\n"
            "\n    Fix: run  python3 Brain/scripts/validate_mobile_render.py  and address\n"
            "    every issue (fix: add `display:inline-flex; align-items:center;\n"
            "    justify-content:center;` to the offending class, or add it to the\n"
            "    mobile.css 40px tap-target exemption list at line ~161).\n"
            "    Then re-commit the corrected file(s) and push again.\n",
            file=sys.stderr,
        )

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
