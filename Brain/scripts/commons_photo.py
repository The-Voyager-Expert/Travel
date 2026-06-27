#!/usr/bin/env python3
"""
Wikimedia Commons photo resolver.

Replaces hash-path guessing. Takes a Commons filename (e.g.
"File:{Commons_File_Name}.jpg") and returns the canonical 800px
thumbnail URL via the Commons API. Confirms the file exists.

Why this exists:
  The upload.wikimedia.org/wikipedia/commons/thumb/{hash}/... URL pattern
  embeds an MD5-derived hash path that CANNOT be guessed from the filename.
  Constructing these URLs by pattern-matching is how we ship wrong/missing
  photos. Use this script to ask Commons for the real URL.

  The Cowork sandbox blocks CDN thumbnail downloads (HTTP 400) but allows
  downloading original files. Use --download to fetch the original and
  resize to 800px with PIL — this is the standard Cowork photo path.

Usage:
  # Print canonical 800px thumb URL only (one line — script-friendly)
  python3 commons_photo.py "File:{Commons_File_Name}.jpg"

  # Download original + resize to 800px, save to path (Cowork standard path)
  python3 commons_photo.py --download "Guides/{City}/_build/assets/800px-Foo.jpg" "File:Foo.jpg"

  # Print full info block (thumb URL, source URL, Commons page, size, mime)
  python3 commons_photo.py --info "File:{Commons_File_Name}.jpg"

  # Custom thumbnail width (default 800)
  python3 commons_photo.py --width 1200 "File:Foo.jpg"

  # Bulk mode — one filename per line on stdin, tab-separated filename/url out
  cat filenames.txt | python3 commons_photo.py --bulk

Reference: `Brain/CORE RULES/Photos Rules.html` (the locked content rule).
"""

import sys
import re
import argparse
import json
import urllib.parse
import requests

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
UA = "DaniTravelGuide/1.0 (mailto:bellinello@gmail.com)"
TIMEOUT = 15


def force_width(thumb_url: str, width: int) -> str:
    """
    Commons occasionally returns a thumb URL whose path width differs from
    the requested width (e.g. /960px-Foo.jpg when we asked for 800).
    Rewrite the final width segment to the exact requested value — Commons
    renders the requested size on demand.
    """
    if not thumb_url:
        return thumb_url
    return re.sub(r"/(\d+)px-", f"/{width}px-", thumb_url, count=1)


def normalize_title(name: str) -> str:
    """Accept 'File:Foo.jpg', 'Foo.jpg', or a full Commons URL."""
    name = name.strip()
    # Extract from Commons page URL
    if "commons.wikimedia.org/wiki/" in name:
        name = name.split("/wiki/", 1)[1]
        name = urllib.parse.unquote(name)
    # Prefix File: if missing
    if not name.lower().startswith(("file:", "image:")):
        name = "File:" + name
    return name


def resolve(filename: str, width: int = 800) -> dict:
    """
    Query the Commons API for a file's canonical thumb URL.

    Returns dict with keys:
        ok (bool): True if file exists
        title (str): canonical title
        thumb_url (str|None): {width}px thumbnail URL
        source_url (str|None): original full-resolution URL
        page_url (str|None): Commons file-description page
        width, height, mime: image metadata
        error (str|None): human-readable message if ok=False
    """
    title = normalize_title(filename)
    params = {
        "action": "query",
        "format": "json",
        "titles": title,
        "prop": "imageinfo",
        "iiprop": "url|size|mime",
        "iiurlwidth": str(width),
    }
    try:
        r = requests.get(
            COMMONS_API,
            params=params,
            headers={"User-Agent": UA},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
    except requests.RequestException as e:
        return {"ok": False, "title": title, "error": f"API request failed: {e}"}

    data = r.json()
    pages = data.get("query", {}).get("pages", {})
    if not pages:
        return {"ok": False, "title": title, "error": "Empty API response"}

    page = next(iter(pages.values()))
    if "missing" in page:
        return {
            "ok": False,
            "title": title,
            "error": f"File does not exist on Commons: {title}",
        }

    info_list = page.get("imageinfo")
    if not info_list:
        return {"ok": False, "title": title, "error": "No imageinfo for file"}
    info = info_list[0]

    raw_thumb = info.get("thumburl")
    return {
        "ok": True,
        "title": page.get("title", title),
        "thumb_url": force_width(raw_thumb, width),
        "api_thumb_url": raw_thumb,  # what the API returned verbatim
        "source_url": info.get("url"),
        "page_url": info.get("descriptionurl"),
        "width": info.get("thumbwidth") or info.get("width"),
        "height": info.get("thumbheight") or info.get("height"),
        "orig_width": info.get("width"),
        "orig_height": info.get("height"),
        "mime": info.get("mime"),
        "error": None,
    }


def print_info(result: dict) -> None:
    if not result["ok"]:
        print(f"❌ {result['title']}", file=sys.stderr)
        print(f"   {result['error']}", file=sys.stderr)
        return
    print(f"✅ {result['title']}")
    print(f"   thumb : {result['thumb_url']}")
    print(f"   source: {result['source_url']}")
    print(f"   page  : {result['page_url']}")
    print(
        f"   thumb dims: {result['width']}×{result['height']}   "
        f"original: {result['orig_width']}×{result['orig_height']}   "
        f"({result['mime']})"
    )


def main() -> int:
    p = argparse.ArgumentParser(
        description="Resolve Wikimedia Commons filenames to canonical thumb URLs."
    )
    p.add_argument("filename", nargs="?", help="Commons filename (File:Foo.jpg)")
    p.add_argument("--info", action="store_true", help="Print full info block")
    p.add_argument("--width", type=int, default=800, help="Thumbnail width (default 800)")
    p.add_argument("--bulk", action="store_true", help="Read filenames from stdin, one per line")
    p.add_argument("--json", action="store_true", help="Emit JSON per result")
    p.add_argument(
        "--download",
        metavar="PATH",
        help="Download original + resize to 800px (or --width), save to PATH",
    )
    args = p.parse_args()

    if args.download:
        if not args.filename:
            p.error("--download requires a filename argument")
        result = resolve(args.filename, width=args.width)
        if not result["ok"]:
            print(f"ERROR: {result['error']}", file=sys.stderr)
            return 1
        src = result["source_url"]
        try:
            import io
            import pathlib
            import urllib.request

            from PIL import Image

            req = urllib.request.Request(src, headers={"User-Agent": UA})
            data = urllib.request.urlopen(req, timeout=TIMEOUT).read()
            img = Image.open(io.BytesIO(data))
            w, h = img.size
            new_h = int(h * args.width / w)
            img = img.resize((args.width, new_h), Image.LANCZOS)
            # Blank-image guard — a near-solid-colour image (stddev < 10 across all
            # channels) means the download silently returned a placeholder instead of
            # the real photo.  Reject it so the caller gets a hard failure rather than
            # a blue box on the live site.
            import statistics as _stats
            _bands = img.split()
            _max_sd = max(
                _stats.stdev(list(b.getdata())) for b in _bands
            )
            if _max_sd < 10:
                print(
                    f"ERROR: downloaded image is nearly solid colour (stddev={_max_sd:.1f}) "
                    f"— likely a placeholder, not a real photo. "
                    f"Check the Commons URL: {src}",
                    file=sys.stderr,
                )
                return 1
            pathlib.Path(args.download).parent.mkdir(parents=True, exist_ok=True)
            img.save(args.download, quality=85)
            print(args.download)
            return 0
        except Exception as e:
            print(f"ERROR: download/resize failed: {e}", file=sys.stderr)
            return 1

    if args.bulk:
        exit_code = 0
        for line in sys.stdin:
            name = line.strip()
            if not name or name.startswith("#"):
                continue
            result = resolve(name, width=args.width)
            if args.json:
                print(json.dumps(result))
            elif result["ok"]:
                print(f"{result['title']}\t{result['thumb_url']}")
            else:
                print(f"{name}\tERROR: {result['error']}", file=sys.stderr)
                exit_code = 1
        return exit_code

    if not args.filename:
        p.print_help()
        return 2

    result = resolve(args.filename, width=args.width)
    if args.json:
        print(json.dumps(result, indent=2))
        return 0 if result["ok"] else 1
    if args.info:
        print_info(result)
    elif result["ok"]:
        print(result["thumb_url"])
    else:
        print(f"ERROR: {result['error']}", file=sys.stderr)
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
