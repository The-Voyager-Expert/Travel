#!/usr/bin/env python3
"""
validate_guide_structure.py — CI structural gate for shipped guide HTML.

Runs on every guide HTML that carries the <!-- validation: passed --> stamp.
Catches guides that were hand-stamped or stamped without running the full
local validate_itinerary.py. Blocks the deploy if any critical structural
failure is found.

Checks are intentionally a focused subset of validate_itinerary.py — the
ones that definitively signal wrong format or an unvalidated guide.

Added 2026-06-26.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT  = Path(__file__).resolve().parents[2]
GUIDES_DIR = REPO_ROOT / "Travel-Website" / "Guides"

# Machine-written stamps look like: <!-- validation: passed 2026-06-27 11:44 -->
# Hand-typed stamps omit the HH:MM time — this regex rejects them.
STAMP_RE   = re.compile(r"<!-- validation: passed \d{4}-\d{2}-\d{2} \d{2}:\d{2} -->")

FAIL = "❌"
OK   = "✅"


def _read(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def shipped_guides() -> list[tuple[str, Path]]:
    out = []
    if not GUIDES_DIR.exists():
        return out
    for folder in sorted(p for p in GUIDES_DIR.iterdir() if p.is_dir()):
        for html in folder.glob("*.html"):
            content = _read(html)
            if "<!-- validation: passed" in content:
                out.append((folder.name, html))
                break
    return out


def check_guide(name: str, path: Path) -> list[str]:
    html = _read(path)
    failures: list[str] = []

    # 0. Stamp must be machine-written: "<!-- validation: passed YYYY-MM-DD HH:MM -->"
    #    Hand-typed stamps (missing HH:MM) are rejected — they bypass validate_itinerary.py
    if not STAMP_RE.search(html):
        failures.append(
            'validation stamp is missing or hand-typed — must be '
            '"<!-- validation: passed YYYY-MM-DD HH:MM -->" (written by guide_tools.py ship only)'
        )
        # If stamp itself is fake, remaining checks are not meaningful — bail early
        return failures

    # 1. .stop-num must be "N." format, not "Stop N"
    if re.search(r'class="stop-num"[^>]*>\s*Stop\s+\d', html, re.IGNORECASE):
        failures.append('.stop-num uses "Stop N" format — must be "N." (digit + period)')

    # 3. No money figures in guide body
    # Strip script/style blocks before checking for money — avoids false positives
    # on CSS values and JS strings that happen to contain currency symbols.
    body_only = re.sub(r'<(script|style)\b[^>]*>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
    money = re.findall(r'(?<![a-zA-Z])[$€£¥₹]\s*\d', body_only)
    if money:
        failures.append(f"money figures found ({', '.join(set(money[:3]))}…) — zero prices in shipped guides")

    # 4. also-on-this-site block must exist
    if "<!-- also-on-this-site -->" not in html.lower():
        failures.append("missing <!-- also-on-this-site --> block")

    # 5. At least one day closer (→ hotel)
    if "→ hotel" not in html:
        failures.append("no '→ hotel' day-closer found — every day-block requires one")

    # 6. .extras-section divs must exist (guide has extras)
    if 'class="extras-section"' not in html:
        failures.append("no .extras-section divs found — guide is missing all extras sections")

    # 7. No <h2>/<h3> in guide body (wrong structure)
    if re.search(r"<h[23][\s>]", html, re.IGNORECASE):
        failures.append("bare <h2>/<h3> tags found — use .extras-title / .stop-name")

    # 8. data-updated attribute must be present on toolbar mount
    if not re.search(r'data-updated="\d{4}-\d{2}"', html):
        failures.append('toolbar mount missing data-updated="YYYY-MM" attribute')

    # 9. No Before-You-Go.html links (drift page — does not belong in guides)
    if "Before-You-Go.html" in html:
        failures.append("Before-You-Go.html link found — this page is drift, remove it")

    # 10. Stylesheet must be guide-style.css
    if "guide-style.css" not in html:
        failures.append("guide-style.css not linked — guide uses stale/wrong stylesheet")

    # 11. Photo authenticity — un-bypassable backstop against fabricated photos.
    #     Pure-Python (no Pillow on CI), so the pixel placeholder test lives in the
    #     local validator; here we catch the two fabrication signatures that need
    #     no image decoding and are safe fleet-wide:
    #       (a) byte-identical served photos (one placeholder copied to N names)
    #       (b) a present provenance manifest that doesn't back the photos
    #           (missing entry, non-Wikimedia source, or swapped file = hash mismatch)
    #     The manifest is NOT required here (existing guides predate it and must keep
    #     deploying) — the local ship gate makes it mandatory for newly-validated guides.
    failures.extend(_photo_failures(path, html))

    return failures


_IMG_EXTS = (".jpg", ".jpeg", ".png", ".webp")
_WIKI_SUFFIXES = ("wikimedia.org", "wikipedia.org")
_SRC_RE = re.compile(r'src\s*=\s*"(_build/assets/[^"]+)"')


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fp:
        for chunk in iter(lambda: fp.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def _is_wiki(url) -> bool:
    if not url:
        return False
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return False
    return any(host == s or host.endswith("." + s) for s in _WIKI_SUFFIXES)


def _photo_failures(guide_html_path: Path, html: str) -> list[str]:
    guide_dir = guide_html_path.parent
    refs = [r for r in _SRC_RE.findall(html) if r.lower().endswith(_IMG_EXTS)]
    seen = set()
    refs = [r for r in refs if not (r in seen or seen.add(r))]
    if not refs:
        return []

    fails: list[str] = []
    hashes: dict[str, str] = {}
    for ref in refs:
        fp = guide_dir / ref
        if fp.is_file():
            hashes[ref] = _sha256(fp)

    by_hash: dict[str, list[str]] = {}
    for ref, h in hashes.items():
        by_hash.setdefault(h, []).append(ref)
    for group in by_hash.values():
        if len(group) > 1:
            fails.append(
                "byte-identical served photos (a placeholder copied to multiple "
                f"filenames): {sorted(group)}"
            )

    manifest_fp = guide_dir / "_build" / "assets" / "photo_provenance.json"
    if manifest_fp.is_file():
        try:
            manifest = json.loads(manifest_fp.read_text(encoding="utf-8"))
        except Exception:
            manifest = None
        if not isinstance(manifest, dict):
            fails.append("photo_provenance.json is present but unreadable/invalid")
        else:
            for ref, h in hashes.items():
                entry = manifest.get(Path(ref).name)
                if not isinstance(entry, dict):
                    fails.append(f"photo missing from provenance manifest: {ref}")
                    continue
                if not _is_wiki(entry.get("source_url")):
                    fails.append(f"photo provenance source is not Wikimedia/Wikipedia: {ref}")
                if entry.get("sha256") and entry["sha256"] != h:
                    fails.append(f"photo bytes don't match recorded provenance sha256: {ref}")
    return fails


def main() -> int:
    guides = shipped_guides()
    if not guides:
        print("validate_guide_structure: no shipped guides found — nothing to check.")
        return 0

    total_failures = 0
    guide_failures: dict[str, list[str]] = {}

    for name, path in guides:
        fails = check_guide(name, path)
        if fails:
            guide_failures[name] = fails
            total_failures += len(fails)

    if not guide_failures:
        print(f"validate_guide_structure: OK — all {len(guides)} guides passed structural checks.")
        return 0

    print(f"::error::Deploy blocked — {len(guide_failures)} guide(s) failed structural checks:")
    for name, fails in guide_failures.items():
        print(f"\n  {name}:")
        for f in fails:
            print(f"    {FAIL} {f}")
    print(f"\n{total_failures} failure(s) across {len(guide_failures)} guide(s).")
    print("Run Brain/scripts/validate_itinerary.py locally and fix all failures before pushing.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
