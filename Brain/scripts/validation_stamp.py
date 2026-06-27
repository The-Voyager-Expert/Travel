#!/usr/bin/env python3
"""validation_stamp.py — the content-bound validation stamp shared by every gate.

WHY THIS EXISTS
---------------
The old stamp was a plain string: ``<!-- validation: passed 2026-06-22 17:57 -->``.
Nothing tied it to the guide's content, so:

  • a script could write it in bulk without ever running the validator
    (151 guides got byte-identical 2026-06-22 17:57 stamps that way), and
  • a post-validation edit (e.g. the hidden <h1 style="display:none"> injected
    into 163 guides) left the "passed" stamp intact — the guide changed but
    still claimed to be validated.

THE STAMP NOW
-------------
    <!-- validation: passed 2026-06-27 14:30 | v2 | sig=<hex> -->

``sig`` is ``HMAC-SHA256(key, canonical_content)`` truncated to 32 hex chars,
where ``canonical_content`` is the guide HTML with its own validation stamp
removed (so the stamp never signs itself) and line endings normalized.

Properties this buys every gate (validate / ship / pre-push / deploy):
  • A hand-typed or bulk-written stamp does NOT carry a matching signature →
    rejected. You cannot fake "passed" without computing the HMAC.
  • Any edit to the guide after it was stamped changes canonical_content →
    the signature no longer matches → rejected. A stamped guide that was
    tampered with reads as invalid, exactly like an unvalidated one.
  • Verification is a single hash — cheap enough to run on the whole fleet at
    deploy time WITHOUT re-running the 400-rule validator on every guide.

THE KEY
-------
Resolved in order:
  1. ``$VOYAGER_VALIDATION_KEY`` env var       — used by CI (GitHub Actions secret)
  2. ``Brain/scripts/.validation_key`` file    — Drive-only, NOT tracked in git,
                                                  read by the cribs when signing
  3. the built-in DEFAULT_KEY constant         — public fallback

Even with only the public DEFAULT_KEY the stamp is *content-bound*: it defeats
the real incident (bulk fixed-string stamps and post-validation edits both fail
verification). Setting a secret key (Drive file + matching CI secret) adds
forgery resistance on top. And regardless of the key, the CI deploy gate
RE-RUNS the real validator on every changed guide — so the validator, not the
stamp, is always the ultimate authority. The stamp is fast defense-in-depth.

This module is import-only (no side effects) and stdlib-only, so it is safe to
ship in the tracked repo and call from the GitHub Actions runner.
"""

from __future__ import annotations

import datetime as _dt
import hashlib
import hmac
import os
import re
from pathlib import Path

# Public fallback key. Provides content-binding out of the box; override with a
# secret via $VOYAGER_VALIDATION_KEY (CI) or Brain/scripts/.validation_key (Drive)
# for forgery resistance. Changing this value invalidates every existing stamp,
# so treat it as fixed unless you intend a fleet-wide re-validation.
DEFAULT_KEY = "voyager-validation-v2-2026"

STAMP_VERSION = "v2"

# Matches BOTH the new signed stamp and the legacy plain stamp, so callers can
# strip whatever is present before signing/verifying.
_STAMP_RE = re.compile(r"<!--\s*validation:\s*passed.*?-->", re.IGNORECASE | re.DOTALL)
_PENDING_RE = re.compile(r"<!--\s*validation:\s*pending\s*-->", re.IGNORECASE)
# Pulls the signature out of a v2 stamp.
_SIG_RE = re.compile(r"sig=([0-9a-f]{8,64})", re.IGNORECASE)


def load_key() -> bytes:
    """Resolve the signing key (env → Drive file → public default)."""
    env = os.environ.get("VOYAGER_VALIDATION_KEY")
    if env:
        return env.strip().encode("utf-8")
    key_file = Path(__file__).resolve().parent / ".validation_key"
    try:
        txt = key_file.read_text(encoding="utf-8").strip()
        if txt:
            return txt.encode("utf-8")
    except (FileNotFoundError, OSError):
        pass
    return DEFAULT_KEY.encode("utf-8")


def canonical_content(html: str) -> bytes:
    """The bytes that get signed: the guide minus its own validation stamp.

    The stamp (and any 'pending' marker) is removed so it never signs itself,
    then all runs of whitespace are collapsed to a single space. Collapsing makes
    the signature immune to whitespace-only differences — a git autocrlf checkout
    on the CI runner, or the single newline this module inserts around the stamp —
    so the crib that signs and the runner that verifies hash identically. It is
    NOT immune to content: any injected element (e.g. the hidden <h1> added to 163
    guides after validation) adds non-whitespace and breaks the signature.
    """
    stripped = _STAMP_RE.sub(" ", html)
    stripped = _PENDING_RE.sub(" ", stripped)
    stripped = re.sub(r"\s+", " ", stripped).strip()
    return stripped.encode("utf-8")


def compute_sig(html: str, key: bytes | None = None) -> str:
    if key is None:
        key = load_key()
    return hmac.new(key, canonical_content(html), hashlib.sha256).hexdigest()[:32]


def make_stamp(html: str, key: bytes | None = None, now: _dt.datetime | None = None) -> str:
    """Build the signed stamp string for this guide's current content."""
    ts = (now or _dt.datetime.now()).strftime("%Y-%m-%d %H:%M")
    sig = compute_sig(html, key)
    return f"<!-- validation: passed {ts} | {STAMP_VERSION} | sig={sig} -->"


def has_stamp(html: str) -> bool:
    return bool(_STAMP_RE.search(html))


def is_pending(html: str) -> bool:
    return bool(_PENDING_RE.search(html))


def extract_sig(html: str) -> str | None:
    m = _STAMP_RE.search(html)
    if not m:
        return None
    sm = _SIG_RE.search(m.group(0))
    return sm.group(1).lower() if sm else None


def verify(html: str, key: bytes | None = None) -> tuple[bool, str]:
    """Verify the guide carries a valid, content-matching signed stamp.

    Returns (ok, reason). ``ok`` is True only when a v2 signed stamp is present
    AND its signature matches the guide's current content. A legacy unsigned
    stamp, a missing stamp, a 'pending' marker, or a signature that no longer
    matches the content all return False with a human-readable reason.
    """
    if is_pending(html):
        return False, "stamp is 'pending' — guide has never passed validation"
    if not has_stamp(html):
        return False, "no validation stamp present"
    sig = extract_sig(html)
    if not sig:
        return False, "legacy unsigned stamp (no sig=) — re-run the validator to sign"
    expected = compute_sig(html, key)
    if hmac.compare_digest(sig, expected):
        return True, "valid signed stamp"
    return False, "signature does not match content — stamp is forged or the guide was edited after validation"


def write_stamp(filepath: str | Path, html: str | None = None, key: bytes | None = None) -> bool:
    """Stamp a guide file in place. Returns True if the file was rewritten.

    Replaces a 'pending' marker or an existing (legacy or v2) stamp; if neither
    is present, inserts after <!DOCTYPE html>/<html>, else prepends — so a passing
    guide is never left unstamped.
    """
    path = Path(filepath)
    if html is None:
        html = path.read_text(encoding="utf-8")
    stamp = make_stamp(html, key)

    if _PENDING_RE.search(html):
        stamped = _PENDING_RE.sub(stamp, html, count=1)
    elif _STAMP_RE.search(html):
        # count=1: collapse to a single fresh stamp even if duplicates exist.
        stamped = _STAMP_RE.sub(stamp, html, count=1)
    else:
        stamped = None
        for marker in ("<!DOCTYPE html>", "<html"):
            idx = html.lower().find(marker.lower())
            if idx != -1:
                idx_end = idx + len(marker)
                eol = html.find("\n", idx_end)
                insert_at = eol + 1 if eol != -1 else idx_end
                stamped = html[:insert_at] + stamp + "\n" + html[insert_at:]
                break
        if stamped is None:
            stamped = stamp + "\n" + html

    if stamped != html:
        path.write_text(stamped, encoding="utf-8")
        return True
    return False


if __name__ == "__main__":
    # CLI: verify (default) or stamp a guide file.
    #   python3 validation_stamp.py <file.html>            → verify, exit 0/1
    #   python3 validation_stamp.py --stamp <file.html>    → write a signed stamp
    import sys

    args = sys.argv[1:]
    if not args:
        print("Usage: validation_stamp.py [--stamp] <file.html>", file=sys.stderr)
        sys.exit(2)
    if args[0] == "--stamp":
        if len(args) < 2:
            print("Usage: validation_stamp.py --stamp <file.html>", file=sys.stderr)
            sys.exit(2)
        changed = write_stamp(args[1])
        print(("✅ signed stamp written → " if changed else "• stamp already current → ") + args[1])
        sys.exit(0)
    target = args[0]
    try:
        content = Path(target).read_text(encoding="utf-8")
    except FileNotFoundError:
        print(f"❌ File not found: {target}", file=sys.stderr)
        sys.exit(1)
    ok, reason = verify(content)
    print(("✅ " if ok else "❌ ") + f"{target} — {reason}")
    sys.exit(0 if ok else 1)
