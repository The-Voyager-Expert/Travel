#!/usr/bin/env python3
"""pre_push_guard.py — block a git push that would publish an UNVALIDATED guide.

GitHub Pages republishes the entire Travel-Website/ tree on every push, so a
guide that ships without a validation stamp would go live immediately.

Policy enforced:
  • ALLOW every push by default — toolbar.js, guide-style.css, assets, index,
    Trip-Essentials data pages, etc. None carry a guide validation stamp, so
    none of them trip this guard.
  • BLOCK only if a guide HTML that is NEW or MODIFIED IN THIS PUSH lacks
    <!-- validation: passed -->. Guides already on the remote that haven't
    changed in this push are NOT rechecked — they were validated when they
    shipped. In-progress guides that sit quietly in the repo (tracked but
    unchanged in the current push) never block anything.

This means in-progress guides can be tracked without blocking other ships.
The guard catches only guides that are being introduced or changed right now.

Invoked by Brain/scripts/git-hooks/pre-push (installed via core.hooksPath).
Run standalone anytime:  python3 Brain/scripts/pre_push_guard.py

Exit 0 = safe to push.  Exit 1 = push blocked (unvalidated guide in diff).

Added 2026-06-21. Revised 2026-06-27: check push diff only, not full tree.
"""

import subprocess
import sys
from pathlib import Path

STAMP_OK = "<!-- validation: passed"


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

    # Files that are ADDED or MODIFIED in commits being pushed (not already on remote).
    # This is the set of files the remote will see for the first time or updated.
    diff_output = _git("diff", "--name-only", "--diff-filter=AM", remote_head, "HEAD",
                       "--", "Travel-Website/Guides")
    if not diff_output:
        # Nothing in Travel-Website/Guides changed — nothing to check.
        return 0

    offenders: list[str] = []
    for rel in diff_output.splitlines():
        p = Path(rel)
        if p.suffix.lower() != ".html":
            continue
        if p.name == "Guides-Index.html":
            continue
        # Guide HTML lives at Travel-Website/Guides/<City>/<file>.html (depth 4).
        # Skip anything deeper (e.g. _build/ helpers) — only the guide page matters.
        if len(p.parts) != 4:
            continue
        f = repo / p
        try:
            html = f.read_text(encoding="utf-8", errors="replace")
        except FileNotFoundError:
            # File deleted — the deletion is being pushed; fine.
            continue
        if STAMP_OK not in html:
            offenders.append(rel)

    if not offenders:
        return 0

    print(
        "\n🚫  PUSH BLOCKED — guide(s) added/modified in this push are not validated:\n",
        file=sys.stderr,
    )
    for rel in offenders:
        print(f"      • {rel}", file=sys.stderr)
    print(
        "\n    This push introduces or modifies guide HTML that hasn't passed the ship gate.\n"
        "    Other in-progress guides already in the repo are NOT affected — only the\n"
        "    files changed in THIS push trigger this block.\n"
        "\n    Fix: run  python3 Brain/scripts/guide_tools.py ship <path>  for each blocked guide.\n"
        "    The ship gate stamps <!-- validation: passed --> and then auto-pushes.\n",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
