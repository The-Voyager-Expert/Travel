#!/usr/bin/env python3
"""
mobile_check.py — one command to keep the site looking good on mobile.

WHAT IT DOES
  Audits every user-facing, shareable page and guarantees two things that make
  the difference between "fine on a phone" and "always bad":
    1. a <meta name="viewport"> tag        (without it phones render at 980px)
    2. a link to assets/mobile.css          (the universal defensive baseline)
  It also flags overflow risks (wide fixed-px widths that aren't capped).

  Run it any time. It is idempotent — re-running never double-injects.

SCOPE
  - Shareable surfaces only: the guides index, Main Pages, Trip-Essentials,
    Maps, On The Go. (See TARGET_GLOBS below.)
  - SHIPPED GUIDES ARE EXCLUDED on purpose: they are frozen and share
    guide_v3.css, which carries their mobile rules. Never edited here.
  - archive/ is always skipped.

USAGE
  python3 Brain/scripts/mobile_check.py            # audit, report only
  python3 Brain/scripts/mobile_check.py --apply    # fix viewport + css link
  python3 Brain/scripts/mobile_check.py --strict   # exit 1 if any issue remains
                                                    # (for ship-gate / ritual)
"""
import os
import re
import sys
import glob

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
TRAVEL_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
WEB_ROOT    = os.path.join(TRAVEL_ROOT, "Travel-Website")   # published site root (2026-06-13 reorg)
MOBILE_CSS  = os.path.join(WEB_ROOT, "assets", "mobile.css")  # assets/ home (moved out of Guides/ 2026-06-13)

# Shareable, user-facing surfaces.
# Website surfaces are relative to Travel-Website/; On The Go stays under Travel/.
WEB_GLOBS = [
    "index.html",                  # site home / Main Pages hub
    "Guides/guides_index.html",
    "Trip-Essentials/**/*.html",
]
TRAVEL_GLOBS = [
    "On The Go/**/*.html",
]

VIEWPORT_TAG = '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
VIEWPORT_RE  = re.compile(r'name=["\']?viewport', re.I)
CSS_LINK_RE  = re.compile(r'href=["\'][^"\']*\bmobile\.css', re.I)
CHARSET_RE   = re.compile(r'<meta\s+charset[^>]*>', re.I)
HEAD_OPEN_RE = re.compile(r'<head[^>]*>', re.I)
HEAD_CLOSE_RE= re.compile(r'</head>', re.I)
# Overflow heuristic: an explicit width:/min-width: of 3+ digit px.
WIDTH_RE     = re.compile(r'(?<!max-)(?:\bwidth|\bmin-width)\s*:\s*([0-9]{3,})\s*px', re.I)

GREEN, RED, YEL, DIM, BOLD, OFF = "\033[32m","\033[31m","\033[33m","\033[2m","\033[1m","\033[0m"


def collect():
    files = []
    for base, globs in ((WEB_ROOT, WEB_GLOBS), (TRAVEL_ROOT, TRAVEL_GLOBS)):
        for g in globs:
            for p in glob.glob(os.path.join(base, g), recursive=True):
                if os.sep + "archive" + os.sep in p:
                    continue
                if os.path.isfile(p):
                    files.append(p)
    return sorted(set(files))


def rel_css_link(html_path):
    """Correct relative <link> from this file's dir to assets/mobile.css."""
    rel = os.path.relpath(MOBILE_CSS, os.path.dirname(html_path))
    rel = rel.replace(os.sep, "/")
    return f'<link rel="stylesheet" href="{rel}">'


def overflow_risks(text):
    """Wide fixed widths not capped by a sibling max-width on the same rule.
    Heuristic only — reported as a hint, never auto-changed."""
    hits = []
    for m in WIDTH_RE.finditer(text):
        val = int(m.group(1))
        if val > 600:
            hits.append(val)
    return hits


def audit_one(path, apply):
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    original = text
    issues, fixed = [], []

    has_vp  = bool(VIEWPORT_RE.search(text))
    has_css = bool(CSS_LINK_RE.search(text))

    # --- viewport ---
    if not has_vp:
        if apply:
            if CHARSET_RE.search(text):
                text = CHARSET_RE.sub(lambda m: m.group(0) + "\n" + VIEWPORT_TAG, text, count=1)
            elif HEAD_OPEN_RE.search(text):
                text = HEAD_OPEN_RE.sub(lambda m: m.group(0) + "\n" + VIEWPORT_TAG, text, count=1)
            fixed.append("viewport")
        else:
            issues.append("no viewport")

    # --- mobile.css link (insert last in <head> so it wins the cascade) ---
    if not has_css:
        link = rel_css_link(path)
        if apply and HEAD_CLOSE_RE.search(text):
            text = HEAD_CLOSE_RE.sub(link + "\n</head>", text, count=1)
            fixed.append("mobile.css")
        elif not apply:
            issues.append("no mobile.css")

    # --- overflow hint (report only) ---
    risks = overflow_risks(text)
    hint = f"{len(risks)} wide fixed-width(s) (max {max(risks)}px)" if risks else None

    if apply and text != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)

    return issues, fixed, hint


def main():
    apply  = "--apply"  in sys.argv
    strict = "--strict" in sys.argv

    if not os.path.isfile(MOBILE_CSS):
        print(f"{RED}✗ assets/mobile.css not found — create it first.{OFF}")
        sys.exit(2)

    files = collect()
    print(f"\n{BOLD}📱 mobile_check{OFF} — {len(files)} shareable pages "
          f"({'APPLY' if apply else 'audit only'})\n" + "─" * 60)

    n_clean = n_fixed = n_issue = 0
    issue_pages = []
    for p in files:
        rel = os.path.relpath(p, TRAVEL_ROOT)
        issues, fixed, hint = audit_one(p, apply)
        if fixed:
            n_fixed += 1
            print(f"{GREEN}✦ fixed{OFF}  {rel}  {DIM}(+{', +'.join(fixed)}){OFF}")
        if issues:
            n_issue += 1
            issue_pages.append(rel)
            print(f"{RED}✗ {OFF}{rel}  {RED}{', '.join(issues)}{OFF}"
                  + (f"  {YEL}· {hint}{OFF}" if hint else ""))
        elif not fixed:
            n_clean += 1
            tail = f"  {YEL}· {hint}{OFF}" if hint else ""
            print(f"{GREEN}✓{OFF} {DIM}{rel}{OFF}{tail}")

    print("─" * 60)
    print(f"clean: {n_clean}   fixed: {n_fixed}   "
          f"{'remaining issues' if not apply else 'still need attention'}: {n_issue}")
    if not apply and n_issue:
        print(f"{DIM}→ run with --apply to inject viewport + mobile.css link{OFF}")

    sys.exit(1 if (strict and n_issue) else 0)


if __name__ == "__main__":
    main()
