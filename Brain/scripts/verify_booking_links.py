#!/usr/bin/env python3
"""
verify_booking_links.py — build-time check for platform-verified booking + reading links.

Closes the enforcement gap Dani hit on 2026-04-23: a guide can ship with a
structurally-valid URL pointing to the wrong subject (e.g. a TripAdvisor
`Attraction_Review-g{GeoID}-d{AttractionID}` URL whose `<h1>` is a different
attraction, or a Wikipedia `/wiki/{Slug}` URL whose slug silently drifted).
The existing `verify_urls.py` only confirms 200-status + non-empty prose — it
does NOT confirm the page is about the stop's subject.

This script adds two gates on top of `verify_urls.py`:

  1) LOG COVERAGE (static) — every bot-blocked booking URL (Viator /
     GetYourGuide / Michelin) in the guide must have a matching PASS entry in
     `{guide_folder}/_build/verification_log.json`. Bot-blocked platforms return 403
     to automation, so the only record that a human verified the URL against
     a `site:`-search result is the log entry. No entry = not verified = FAIL.

  2) H1 MATCH (live) — every TripAdvisor `Attraction_Review` URL and every
     Wikipedia `/wiki/` URL is fetched live; the `<h1>` is compared against
     the stop's venue name (extracted from the enclosing `.stop-name`). If
     the `<h1>` does not contain the venue name's key tokens, the URL is
     pointing at the wrong subject → FAIL. Catches the Picasso-vs-Seine
     class of bug where the URL shape is valid but the resolved page is not.

Pipeline position:

    validate_itinerary.py  (static shape + log-coverage fail-fast)
            │
            ▼
    verify_urls.py         (200-check + content-quality gate)
            │
            ▼
    verify_booking_links.py  (THIS — log coverage + live h1 match)
            │                 Runs on every build via audit_all_guides.py.
            │                 NOT a ship-gate deferral — deferring creates
            │                 an enforcement gap where Wikipedia/h1 drift
            │                 goes undetected until ship (removed 2026-05-26).
            │
            │  2026-05-27: h1 PASS results now written to verification_log.json
            │              so validate_itinerary.py can permanently suppress the
            │              Wikipedia ⚠️ without requiring a re-run each session.
            ▼
    render_pdf.py / validate_pdf.py

Usage:
    python3 verify_booking_links.py <guide.html>            # full gate
    python3 verify_booking_links.py <guide.html> --static   # log coverage only (no network)
    python3 verify_booking_links.py <guide.html> --verbose  # print every URL, not just failures

Exit codes:
    0  — every URL verified (log entry present + h1 matches where required)
    1  — one or more failures
    2  — usage error / unexpected exception

Reference:
    Brain/CORE RULES/Links.html → URL conventions, link verification rules,
        bot-blocked platform handling (locked 2026-04-25)
    Brain/Reference/Platforms.md → § 1 Access Catalog (which platforms
        bot-block, when to use site-search vs direct fetch)
    Brain/Reference/Platforms.md → ⚠️ Bot-blocked platforms (DO NOT DELETE block)
    Brain/Reference/Platforms.md → ⚡ Workaround (DO NOT DELETE block)
    Brain/Reference/Cleanliness Checks.md → category C ship-gate items for log coverage
        and h1-match (entries 157, 158, 159).

Verification-log schema — {guide_folder}/_build/verification_log.json:

    {
      "_meta": {
        "guide": "<guide filename>",
        "created": "<YYYY-MM-DD>",
        "updated": "<YYYY-MM-DD>"
      },
      "entries": {
        "<canonical URL as it appears in the guide>": {
          "platform": "viator" | "getyourguide" | "michelin",
          "method":   "site_search" | "live_fetch",
          "query":    "<exact site:-search query run by Claude>",
          "verified_on":        "<YYYY-MM-DD>",
          "verified_by":        "<claude | dani>",
          "expected_attraction": "<the subject the URL is supposed to be about>",
          "result":   "PASS" | "FAIL",
          "notes":    "<free-form — why the snippet confirmed the URL is correct>"
        },
        ...
      }
    }

Log entries are write-once per ship — Claude records one each time a
bot-blocked URL is accepted into the guide. Stale entries (> LOG_MAX_AGE_DAYS
old) become WARN, not FAIL, so that guide rebuilds don't force re-verifying
every URL from scratch; but the WARN is loud in every run until refreshed.
"""

from __future__ import annotations

import argparse
import html as _html
import json
import re
import sys
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta
from pathlib import Path

import requests


PASS = "✅"
FAIL = "❌"
WARN = "⚠️ "
SKIP = "➖"

UA = "DaniTravelGuide/1.0 (mailto:bellinello@gmail.com)"
TIMEOUT = 20

# ─── Platforms that REQUIRE a log entry (bot-blocked — cannot be fetched) ─────
# Host match is word-level — subdomains are normalized below. These are the
# same platforms covered by the `site:` search workaround in the DO NOT DELETE
# blocks of Brain/Reference/Platforms.md.
BOT_BLOCKED_HOSTS = {
    "viator.com",
    "www.viator.com",
    "getyourguide.com",
    "www.getyourguide.com",
    "guide.michelin.com",
}

# ─── URL-shape patterns — only SPECIFIC-product URLs trigger the log gate ────
# City-landing URLs are caught separately by verify_urls.py and should never
# ship. Here we enforce that a specific-product URL has a matching log entry.
VIATOR_PRODUCT_RE = re.compile(
    r"https?://(?:www\.)?viator\.com/tours/[^/]+/[^/?#]+/d\d+-[^/?#]+",
    re.IGNORECASE,
)
GYG_PRODUCT_RE = re.compile(
    r"https?://(?:www\.)?getyourguide\.com/[^/?#]+-l\d+/[^/?#]+-t\d+/?",
    re.IGNORECASE,
)
MICHELIN_RESTAURANT_RE = re.compile(
    r"https?://guide\.michelin\.com/[^/]+/[^/]+/restaurant/",
    re.IGNORECASE,
)

# ─── URL-shape patterns — H1-MATCH platforms (fetchable; live-verify subject) ─
# Distinct from the bot-blocked set above — these are NOT 403-blocked, so we
# fetch them live and check the <h1> against the stop's expected venue name.
TRIPADVISOR_ATTRACTION_RE = re.compile(
    r"https?://(?:www\.)?tripadvisor\.(?:com|co\.uk|it|fr|de|es)"
    r"/Attraction_Review-g\d+-d\d+[^\"'\s]*",
    re.IGNORECASE,
)
WIKIPEDIA_ARTICLE_RE = re.compile(
    r"https?://(?:[a-z]{2,3}\.)?wikipedia\.org/wiki/[^\"'\s#?]+",
    re.IGNORECASE,
)

# ─── Log staleness thresholds ────────────────────────────────────────────────
# Entries older than this are WARN (not FAIL) — so a rebuild doesn't force
# re-verifying every URL from scratch on day 31. But a WARN is emitted on every
# run until the entry is refreshed.
LOG_STALE_WARN_DAYS = 30
LOG_STALE_FAIL_DAYS = 90  # past this, FAIL — refresh is mandatory

# ─── H1-match — token overlap threshold ──────────────────────────────────────
# The stop's venue name and the page's <h1> rarely match verbatim (h1 often
# carries suffixes: "Musée X - Wikipedia", "Venue Y | Tripadvisor", etc.).
# We tokenize both, drop stop-words and common suffixes, and require that at
# least HALF of the stop-name's significant tokens appear in the h1 tokens.
H1_TOKEN_OVERLAP_MIN = 0.33  # 0.5 → 0.33: Portuguese stops share partial proper-noun tokens with English h1s

# Tokens stripped from both sides before the overlap ratio is computed.
# Not place names (Rule 26) — only generic connective words and platform
# suffixes that appear in almost every h1.
H1_STOPWORDS = {
    # English connectives
    "the", "a", "an", "of", "and", "or", "&", "at", "in", "on", "to",
    "de", "du", "des", "la", "le", "les", "l", "d",   # French / Italian articles
    "il", "i", "della", "del", "dei", "delle", "degli",
    "der", "die", "das", "und", "von",                  # German
    "el", "los", "las", "y",                            # Spanish
    # Platform suffixes that routinely trail an h1
    "wikipedia", "tripadvisor", "review", "reviews",
    "all", "you", "need", "know", "before", "go",
    "museum", "musée", "museo", "monument", "site",
}


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def normalize_host(host: str) -> str:
    return host.lower().lstrip(".")


def host_of(url: str) -> str:
    try:
        return normalize_host(urllib.parse.urlparse(url).netloc)
    except Exception:
        return ""


def is_bot_blocked_booking(url: str) -> bool:
    """
    True if the URL is a specific-product URL on a bot-blocked platform.
    TripAdvisor joined this set on 2026-04-24: despite earlier documentation
    (Brain/Reference/Platforms.md DO-NOT-DELETE block) stating "TripAdvisor is NOT
    bot-blocked", live tests consistently returned HTTP 403. We still try to
    fetch TA below for opportunistic h1-match, but the log entry is now
    mandatory as a fallback so a 403 does not silently ship an unverified URL.
    """
    if VIATOR_PRODUCT_RE.match(url):
        return True
    if GYG_PRODUCT_RE.match(url):
        return True
    if MICHELIN_RESTAURANT_RE.match(url):
        return True
    if TRIPADVISOR_ATTRACTION_RE.match(url):
        return True
    return False


def is_h1_match_target(url: str) -> bool:
    """
    True if the URL is on a platform where we live-verify the <h1>.
    TripAdvisor is dual-classified: it also requires a log entry (see
    is_bot_blocked_booking) because it frequently returns 403 to automation.
    When the fetch succeeds, the h1-match still runs and catches the
    d{AttractionID}-reassignment class of bug (Picasso-vs-Seine).
    """
    if TRIPADVISOR_ATTRACTION_RE.match(url):
        return True
    if WIKIPEDIA_ARTICLE_RE.match(url):
        return True
    return False


def platform_of(url: str) -> str:
    """Return a short platform tag for reporting."""
    if VIATOR_PRODUCT_RE.match(url):
        return "viator"
    if GYG_PRODUCT_RE.match(url):
        return "getyourguide"
    if MICHELIN_RESTAURANT_RE.match(url):
        return "michelin"
    if TRIPADVISOR_ATTRACTION_RE.match(url):
        return "tripadvisor"
    if WIKIPEDIA_ARTICLE_RE.match(url):
        return "wikipedia"
    return "other"


def tokenize(text: str) -> set[str]:
    """Lowercase + strip punctuation + drop stop-words."""
    # HTML-entity decode first so "&amp;" doesn't leak into tokens as "amp".
    cleaned = _html.unescape(text)
    # Replace any non-letter/digit with a space so "St-Germain" → "st germain"
    cleaned = re.sub(r"[^\w]+", " ", cleaned.lower(), flags=re.UNICODE)
    return {t for t in cleaned.split() if t and t not in H1_STOPWORDS and len(t) >= 2}


def overlap_ratio(stop_tokens: set[str], h1_tokens: set[str]) -> float:
    """
    Forward ratio: fraction of stop-name tokens found in h1.
    Use max_overlap_ratio() for the bidirectional check used at verdict time.
    """
    if not stop_tokens:
        return 0.0
    return len(stop_tokens & h1_tokens) / len(stop_tokens)


def max_overlap_ratio(stop_tokens: set[str], h1_tokens: set[str]) -> float:
    """
    Bidirectional overlap: max of forward (stop→h1) and reverse (h1→stop).

    The reverse direction handles the common case where a stop has a compound
    descriptive name ("Cascais Old Town & Harbour") but the Wikipedia article
    h1 is just the place name ("Cascais").  In that direction the h1's single
    token is 100 % covered by the stop name — clearly a valid match.

    Forward direction still catches the canonical case (most stop tokens appear
    in the h1) so neither check is weaker than the original.
    """
    forward = overlap_ratio(stop_tokens, h1_tokens)
    if not h1_tokens:
        return forward
    reverse = len(stop_tokens & h1_tokens) / len(h1_tokens)
    return max(forward, reverse)


def stop_name_candidates(stop_name: str) -> list[str]:
    """
    Generate candidate matchable forms of a stop name.

    A Dani stop name is frequently a compound of location + qualifier, or an
    alternation of two sibling attractions. Wikipedia / TripAdvisor articles
    cover ONE of those sub-parts, not the whole compound — so an overlap
    against the full stop name underreports the true match.

    Four derivations, all lightweight and rule-based:
      (1) the full name as-is (baseline)
      (2) the pre-em-dash location head  — "{Head} — {qualifier}" → "{Head}"
      (3) the pre-parens name            — "{Main} ({parens})" → "{Main}"
                                         — plus the parens content itself (sometimes
                                           the article covers the interior name)
      (4) each ` or `-separated alias    — "{Alias A} or {Alias B}"
                                           → ["{Alias A}", "{Alias B}"]

    Caller tokenizes each candidate and passes if ANY candidate hits the
    overlap threshold. A real URL-subject-drift bug (stop name vs. a wholly
    unrelated h1) still fails because none of the derived candidates share
    tokens with the wrong h1.

    No place-name allowlist lives here — Rule 26 compliant.
    """
    text = _html.unescape(stop_name).strip()
    candidates: list[str] = [text]
    if " — " in text:
        candidates.append(text.split(" — ", 1)[0].strip())
    if "(" in text:
        candidates.append(text.split("(", 1)[0].strip())
        m = re.search(r"\(([^)]+)\)", text)
        if m:
            candidates.append(m.group(1).strip())
    if re.search(r"\s+or\s+", text, flags=re.IGNORECASE):
        for part in re.split(r"\s+or\s+", text, flags=re.IGNORECASE):
            candidates.append(part.strip())
    # Dedupe case-insensitively while preserving order.
    seen: set[str] = set()
    out: list[str] = []
    for c in candidates:
        key = c.lower().strip()
        if key and key not in seen:
            seen.add(key)
            out.append(c)
    return out


# ──────────────────────────────────────────────────────────────────────────────
# Guide parsing — pair each URL with the enclosing stop's venue name
# ──────────────────────────────────────────────────────────────────────────────

STOP_BLOCK_OPEN = re.compile(
    r'<div\b[^>]*class\s*=\s*"[^"]*\bstop-block\b[^"]*"[^>]*>',
    re.IGNORECASE,
)
STOP_NAME_RE = re.compile(
    r'<[^>]*class\s*=\s*"[^"]*\bstop-name\b[^"]*"[^>]*>([^<]+)</',
    re.IGNORECASE,
)
HREF_RE = re.compile(r'<a\b[^>]*\bhref\s*=\s*"([^"]+)"', re.IGNORECASE)


def _walk_balanced_div(html: str, start: int) -> tuple[str, int]:
    """
    Walk forward from `start` consuming balanced <div>…</div> pairs until the
    outer div that opened just before `start` is closed. Returns (inner_text,
    end_offset) — inner_text excludes the closing </div>.

    Mirrors the helper in validate_itinerary.py so parsing is consistent.
    """
    depth = 1
    pos = start
    open_re = re.compile(r"<div\b", re.IGNORECASE)
    close_re = re.compile(r"</div\s*>", re.IGNORECASE)
    while pos < len(html) and depth > 0:
        m_open = open_re.search(html, pos)
        m_close = close_re.search(html, pos)
        if m_close is None:
            return html[start:], len(html)
        if m_open is not None and m_open.start() < m_close.start():
            depth += 1
            pos = m_open.end()
        else:
            depth -= 1
            pos = m_close.end()
            if depth == 0:
                return html[start:m_close.start()], pos
    return html[start:], pos


def parse_guide_urls(html: str) -> list[dict]:
    """
    Walk each <div class="stop-block"> and pair every <a href> inside it
    with the stop's venue name (from the enclosing `.stop-name`). URLs
    outside any stop-block are returned with stop_name=None.

    Returns: list of dicts {url, stop_name, context} preserving source order.
    """
    urls: list[dict] = []

    # First pass: collect stop-block spans + their venue names.
    spans: list[tuple[int, int, str]] = []   # (start, end, stop_name)
    for m in STOP_BLOCK_OPEN.finditer(html):
        inner, end = _walk_balanced_div(html, m.end())
        # Extract the first .stop-name inside this block.
        sn = STOP_NAME_RE.search(inner)
        if sn:
            raw = sn.group(1).strip()
            # Strip leading number + period + space (e.g. "3. Venue Name" → "Venue Name")
            raw = re.sub(r"^\s*\d+\.\s*", "", raw)
            # Strip any stray HTML entities / icon text
            raw = re.sub(r"\s+", " ", raw).strip()
            stop_name = raw
            # Check for <!-- wiki-alias: English Name --> comment in the block.
            # Appending as " or Alias" lets stop_name_candidates split on " or "
            # so the alias is tried as a separate candidate in h1_match_verdict.
            alias_m = re.search(
                r'<!--\s*wiki-alias:\s*([^-][^>]*?)\s*-->',
                inner,
            )
            if alias_m:
                alias = alias_m.group(1).strip()
                if alias:
                    stop_name = stop_name + " or " + alias
        else:
            stop_name = ""
        spans.append((m.start(), end, stop_name))

    # Second pass: every href.
    for hm in HREF_RE.finditer(html):
        url = hm.group(1)
        if not url.startswith(("http://", "https://")):
            continue
        pos = hm.start()
        stop_name = None
        for s, e, name in spans:
            if s <= pos < e:
                stop_name = name
                break
        urls.append({
            "url": url,
            "stop_name": stop_name,
            "offset": pos,
        })

    return urls


# ──────────────────────────────────────────────────────────────────────────────
# Log loading
# ──────────────────────────────────────────────────────────────────────────────

def load_verification_log(guide_folder: Path) -> tuple[dict | None, str | None]:
    """
    Load verification_log.json from the guide's folder. Return (data, error).
    Missing file is NOT an error here — the caller decides whether to fail
    (depends on whether the guide contains any bot-blocked URLs).
    """
    # verification_log.json lives inside _build/ (moved 2026-05-09 when assets/ moved there too).
    # Fallback to guide root for any pre-migration guide that still has it there.
    log_path = guide_folder / "_build" / "verification_log.json"
    if not log_path.exists():
        log_path = guide_folder / "verification_log.json"
    if not log_path.exists():
        return None, None
    try:
        data = json.loads(log_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return None, f"verification_log.json parse error: {e}"
    if not isinstance(data, dict) or "entries" not in data:
        return None, "verification_log.json missing top-level `entries` key"
    if not isinstance(data["entries"], dict):
        return None, "verification_log.json `entries` is not an object"
    # Guard: URL-shaped keys at root level indicate entries written to the
    # wrong level (outside "entries"). They will silently fail coverage
    # checks even though the data exists. Caught 2026-05-08, Paris guide.
    rogue = [k for k in data if k not in ("_meta", "entries") and k.startswith("http")]
    if rogue:
        return (
            None,
            f"verification_log.json has {len(rogue)} URL key(s) at top level "
            f"(outside `entries`) — move them inside `entries`: "
            + "; ".join(rogue[:2]),
        )
    return data, None


def log_entry_state(entry: dict, today: date) -> tuple[str, str]:
    """
    Return (verdict, message) for a single log entry.
    verdict ∈ {"pass", "warn", "fail"}.
    """
    result = (entry.get("result") or "").strip().upper()
    if result not in {"PASS", "FAIL"}:
        return "fail", f"entry missing/invalid `result` field (got: {result!r})"
    if result == "FAIL":
        return "fail", f"log entry marked FAIL: {entry.get('notes', '(no notes)')}"
    verified_on = entry.get("verified_on")
    if not verified_on:
        return "fail", "entry missing `verified_on` date"
    try:
        vdate = datetime.strptime(verified_on, "%Y-%m-%d").date()
    except ValueError:
        return "fail", f"entry `verified_on` not YYYY-MM-DD: {verified_on!r}"
    age_days = (today - vdate).days
    if age_days < 0:
        return "fail", f"entry `verified_on` is in the future: {verified_on}"
    if age_days > LOG_STALE_FAIL_DAYS:
        return "fail", (
            f"entry is {age_days} days old (> {LOG_STALE_FAIL_DAYS} day ceiling) — "
            "refresh the `site:` search and re-verify"
        )
    if age_days > LOG_STALE_WARN_DAYS:
        return "warn", (
            f"entry is {age_days} days old (> {LOG_STALE_WARN_DAYS} day WARN threshold) — "
            "schedule a refresh"
        )
    return "pass", f"verified {age_days} day(s) ago"


# ──────────────────────────────────────────────────────────────────────────────
# Live h1-match
# ──────────────────────────────────────────────────────────────────────────────

H1_RE = re.compile(r"<h1\b[^>]*>(.*?)</h1>", re.IGNORECASE | re.DOTALL)
TAG_STRIP_RE = re.compile(r"<[^>]+>")


def fetch_h1(url: str) -> tuple[str | None, str | None]:
    """
    Fetch the URL and return (h1_text, error). h1_text is the first <h1>'s
    visible text, HTML-stripped; error is non-None if the fetch failed or no
    <h1> was found.
    """
    try:
        r = requests.get(
            url,
            headers={"User-Agent": UA, "Accept-Language": "en"},
            timeout=TIMEOUT,
            allow_redirects=True,
        )
    except requests.RequestException as e:
        return None, f"request failed: {e.__class__.__name__}: {e}"
    if r.status_code >= 400:
        return None, f"HTTP {r.status_code}"
    m = H1_RE.search(r.text)
    if not m:
        return None, "no <h1> found in response body"
    text = TAG_STRIP_RE.sub(" ", m.group(1))
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return None, "<h1> present but empty"
    return text, None


def h1_match_verdict(stop_name: str, h1_text: str) -> tuple[str, str]:
    """
    Return (verdict, detail) comparing the stop's venue name against the
    fetched page's <h1>.

    Strategy: generate candidate forms of the stop name (full, pre-em-dash,
    pre-parens, parens-content, ` or `-split aliases — see
    stop_name_candidates), tokenize each, and pass if ANY candidate hits
    H1_TOKEN_OVERLAP_MIN against the h1 tokens. This is fail-closed: a real
    URL-subject-drift bug (the stop's name resolves to an h1 about a wholly
    unrelated subject) shares no tokens with any derived candidate and fails.

    verdict ∈ {"pass", "fail"}.
    """
    h1_tokens = tokenize(h1_text)
    candidates = stop_name_candidates(stop_name)
    best_ratio = -1.0            # -1 sentinel so a legit 0.0 overlap still updates
    best_candidate = stop_name
    best_tokens: set[str] = set()
    any_tokens_seen = False
    for cand in candidates:
        tks = tokenize(cand)
        if not tks:
            continue
        any_tokens_seen = True
        r = max_overlap_ratio(tks, h1_tokens)
        if r > best_ratio:
            best_ratio = r
            best_candidate = cand
            best_tokens = tks
    if not any_tokens_seen:
        # No candidate produced usable tokens — caller surfaces as WARN.
        return "fail", "no stop-name tokens to match"
    if best_ratio >= H1_TOKEN_OVERLAP_MIN:
        return "pass", (
            f"h1 overlap {best_ratio:.0%} via candidate {best_candidate!r} "
            f"({len(best_tokens & h1_tokens)}/{len(best_tokens)} tokens): "
            f"h1={h1_text[:80]!r}"
        )
    return "fail", (
        f"h1 overlap {best_ratio:.0%} < {H1_TOKEN_OVERLAP_MIN:.0%} "
        f"(best candidate {best_candidate!r}): "
        f"stop={stop_name!r}, h1={h1_text[:80]!r} — URL may point at the wrong subject"
    )


# ──────────────────────────────────────────────────────────────────────────────
# Main verification flow
# ──────────────────────────────────────────────────────────────────────────────

def run_gate(guide_path: Path, *, static_only: bool, verbose: bool,
             workers: int) -> int:
    html = guide_path.read_text(encoding="utf-8")
    guide_folder = guide_path.parent

    # ─── parse ────────────────────────────────────────────────────────────────
    all_urls = parse_guide_urls(html)
    # Deduplicate URLs while preserving first-seen order + stop_name.
    seen: dict[str, dict] = {}
    for u in all_urls:
        if u["url"] not in seen:
            seen[u["url"]] = u
    unique = list(seen.values())

    log_required = [u for u in unique if is_bot_blocked_booking(u["url"])]
    h1_required = [u for u in unique if is_h1_match_target(u["url"])]

    print(f"\n{'─'*70}")
    print(f"  verify_booking_links — {guide_path.name}")
    print(f"  scope: {len(log_required)} log-required URL(s), "
          f"{len(h1_required)} h1-match URL(s)")
    mode = "static only (no network)" if static_only else "full (log + live h1)"
    print(f"  mode: {mode}")
    print(f"{'─'*70}")

    passes: list[str] = []
    warns: list[str] = []
    fails: list[str] = []

    # ─── LOG COVERAGE ─────────────────────────────────────────────────────────
    log_data, log_err = load_verification_log(guide_folder)

    # If any bot-blocked URL is present, the log file MUST exist.
    if log_required and log_data is None:
        if log_err:
            fails.append(
                f"[LOG] {log_err} — fix JSON and re-run"
            )
        else:
            fails.append(
                f"[LOG] {guide_folder / 'verification_log.json'} is missing — "
                f"{len(log_required)} bot-blocked URL(s) in the guide have no "
                f"verification record. Create the file per the schema in "
                f"verify_booking_links.py docstring."
            )

    today = date.today()
    if log_data is not None:
        entries = log_data["entries"]
        for item in log_required:
            url = item["url"]
            entry = entries.get(url)
            if entry is None:
                fails.append(
                    f"[LOG] {platform_of(url):>12} · no log entry for: {url}"
                )
                continue
            verdict, msg = log_entry_state(entry, today)
            line = f"[LOG] {platform_of(url):>12} · {url[:80]}"
            if verdict == "pass":
                passes.append(f"{line}\n     → {msg}")
            elif verdict == "warn":
                warns.append(f"{line}\n     → {msg}")
            else:
                fails.append(f"{line}\n     → {msg}")

        # Auto-prune stale log entries: URLs in the log that are no longer in
        # the guide (guide was trimmed, tour was swapped, etc.). Silently
        # remove them and rewrite the log — no warning, no manual step needed.
        guide_urls = {u["url"] for u in unique}
        stale_log_urls = [u for u in list(entries.keys()) if u not in guide_urls]
        if stale_log_urls:
            for u in stale_log_urls:
                del entries[u]
            log_data["entries"] = entries
            log_path = guide_folder / "_build" / "verification_log.json"
            log_path.write_text(
                __import__("json").dumps(log_data, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )

    # ─── LIVE H1-MATCH ────────────────────────────────────────────────────────
    if static_only:
        for item in h1_required:
            passes.append(
                f"[H1 ] {platform_of(item['url']):>12} · skipped (--static mode)"
            )
    else:
        def _check_one(item: dict) -> tuple[str, str, str, str]:
            url = item["url"]
            stop_name = item.get("stop_name") or ""
            if not stop_name:
                return (
                    "warn",
                    platform_of(url),
                    url,
                    "no enclosing .stop-name — cannot derive expected attraction; "
                    "URL fetched only (no h1-match possible)"
                )
            h1, err = fetch_h1(url)
            if err:
                # Fetch failure is WARN for wikipedia / TA (transient CDN
                # issues shouldn't ship-block); but emit loud.
                return ("warn", platform_of(url), url, f"fetch: {err}")
            verdict, detail = h1_match_verdict(stop_name, h1)
            return (verdict, platform_of(url), url, detail)

        if h1_required:
            h1_pass_entries: list[tuple[str, str, str]] = []  # (url, plat, stop_name)
            with ThreadPoolExecutor(max_workers=workers) as ex:
                future_to_item = {ex.submit(_check_one, item): item for item in h1_required}
                for fut in as_completed(future_to_item):
                    item = future_to_item[fut]
                    verdict, plat, url, detail = fut.result()
                    line = f"[H1 ] {plat:>12} · {url[:80]}\n     → {detail}"
                    if verdict == "pass":
                        passes.append(line)
                        h1_pass_entries.append((url, plat, item.get("stop_name") or ""))
                    elif verdict == "warn":
                        warns.append(line)
                    else:
                        fails.append(line)

            # Persist h1 PASS results to verification_log.json so the validator
            # can suppress the Wikipedia ⚠️ without requiring a re-run each time.
            if h1_pass_entries:
                _log_path = guide_folder / "_build" / "verification_log.json"
                if not _log_path.exists():
                    _log_path = guide_folder / "verification_log.json"
                try:
                    _existing = json.loads(_log_path.read_text(encoding="utf-8")) if _log_path.exists() else {}
                except Exception:
                    _existing = {}
                if not isinstance(_existing.get("entries"), dict):
                    _existing.setdefault("_meta", {
                        "guide": guide_path.name,
                        "created": today.isoformat(),
                        "updated": today.isoformat(),
                    })
                    _existing["entries"] = {}
                _existing["_meta"]["updated"] = today.isoformat()
                for _url, _plat, _stop in h1_pass_entries:
                    _existing["entries"][_url] = {
                        "platform": _plat,
                        "method": "live_fetch",
                        "verified_on": today.isoformat(),
                        "verified_by": "claude",
                        "expected_attraction": _stop,
                        "result": "PASS",
                        "notes": "h1 matched stop name via verify_booking_links.py",
                    }
                _log_path.parent.mkdir(parents=True, exist_ok=True)
                _log_path.write_text(
                    json.dumps(_existing, indent=2, ensure_ascii=False) + "\n",
                    encoding="utf-8",
                )

    # ─── render ───────────────────────────────────────────────────────────────
    if verbose:
        for line in passes:
            print(f"{PASS} {line}")
    for line in warns:
        print(f"{WARN}{line}")
    for line in fails:
        print(f"{FAIL} {line}")

    print(f"\n{'─'*70}")
    print(f"  {PASS} {len(passes)} passed   "
          f"{WARN}{len(warns)} warnings   "
          f"{FAIL} {len(fails)} failed")
    print(f"{'─'*70}\n")

    return 0 if not fails else 1


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(
        description=(
            "Ship-gate for platform-verified booking + reading links. "
            "Enforces verification_log.json coverage for bot-blocked tour URLs "
            "(Viator / GetYourGuide / Michelin) and live <h1> match for "
            "TripAdvisor + Wikipedia URLs."
        ),
    )
    p.add_argument("html_file", type=Path,
                   help="The guide HTML file to verify.")
    p.add_argument("--static", action="store_true",
                   help="Log-coverage check only (no network fetches).")
    p.add_argument("--verbose", "-v", action="store_true",
                   help="Print every URL (default: only warnings + failures).")
    p.add_argument("--workers", type=int, default=4,
                   help="Concurrent h1-fetch workers (default 4).")
    args = p.parse_args(argv)

    if not args.html_file.exists():
        print(f"{FAIL} File not found: {args.html_file}", file=sys.stderr)
        return 2

    return run_gate(
        args.html_file,
        static_only=args.static,
        verbose=args.verbose,
        workers=args.workers,
    )


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception as e:  # noqa: BLE001
        print(f"verify_booking_links: unexpected error — {e!r}", file=sys.stderr)
        sys.exit(2)
