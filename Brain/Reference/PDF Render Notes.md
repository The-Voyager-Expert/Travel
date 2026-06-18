> **Claude maintains this file — fix immediately, no approval needed.** When this file drifts from Brain/CORE RULES/, fix it in the same pass. CORE RULES is the authority; this file follows. No questions, no permission, no parking for later.

# Guide PDF Rendering — WeasyPrint Notes

## Background

The canonical renderer is `Brain/scripts/render_pdf.py`, which uses **Playwright + headless Chromium** (500px mobile viewport, `emulate_media("screen")`, 5.5"×11" page, 0.25" margins). This produces the best output because Chrome ignores overly strict CSS rules and renders the guide exactly as it looks in a mobile browser.

**Problem:** The Cowork sandbox blocks the kernel syscalls that headless Chromium needs (seccomp restriction). It crashes with SIGTRAP even with `--no-sandbox`. Use `render_pdf.py` from a normal terminal — not from inside Cowork.

When running from Cowork, **WeasyPrint** is the fallback renderer. It works but needs a set of CSS overrides to compensate for differences in how it handles media queries, fonts, and page flow.

---

## WeasyPrint Setup

Install into `/tmp` to avoid filling the `/sessions` partition:

```bash
PYTHONUSERBASE=/tmp/pylocal pip install weasyprint pdf2image --break-system-packages
```

### Emoji Font

WeasyPrint needs a color emoji font or section icons (🗓️ ☕ 🫕 🍽️ 🍮 🎭 🚌 🚆 ⛲️ 🏓 ⭐ ❗ etc.) won't render.

Download NotoColorEmoji and set up a custom fontconfig:

```bash
mkdir -p /tmp/fontconfig/fonts
wget -q -O /tmp/fontconfig/fonts/NotoColorEmoji.ttf \
  "https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf"

cat > /tmp/fontconfig/fonts.conf << 'EOF'
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/tmp/fontconfig/fonts</dir>
  <dir>/usr/share/fonts</dir>
</fontconfig>
EOF
```

Run WeasyPrint with:

```bash
FONTCONFIG_FILE=/tmp/fontconfig/fonts.conf \
PYTHONPATH=/tmp/pylocal/lib/python3.10/site-packages \
python3 render_script.py
```

---

## CSS Override Block

WeasyPrint renders in **print media mode** by default, which triggers `@media print` in `Guide Style.css` and strips all the colors. The override block below fixes this and everything else discovered during rendering.

```python
OVERRIDE_CSS = """
@page { size: 5.5in 11in; margin: 0.25in; }

/* Do NOT add NotoEmoji to font-family — see Heads Up below */
body { font-family: sans-serif; }

@media print {
  body { background: #f5f4f0 !important; color: #1a1a1a !important;
         font-size: 14px !important; line-height: 1.55 !important; font-family: sans-serif !important; }
  .container { max-width: 760px !important; padding: 0 16px 40px !important; }
  /* Hotel banner — warm gradient per the 2026-05-31 gold reskin (guide_v3.css .title-page).
     Updated 2026-06-06 (audit): was the stale pre-reskin navy #2e4057 / #b8ccde. */
  .title-page { background: linear-gradient(135deg, #7a3b1e 0%, #b85c2a 55%, #d4874a 100%) !important;
                color: #ffffff !important; border: none !important; }
  .title-address { color: #ffffff !important; opacity: .85 !important; }
  .overview-section, .day-block, .extras-section {
    box-shadow: 0 2px 8px rgba(0,0,0,0.07) !important; border: none !important; }
  a { color: #2867c4 !important; text-decoration: none !important; }
}

/* WeasyPrint enforces break-inside strictly; Chrome ignores it when content is too tall.
   Without these overrides, content blocks get pushed to new pages leaving huge gaps. */
.day-block, .extras-section, .claude-inspiration,
.overview-section, .stop-block, .stop-photos {
  break-inside: auto !important; page-break-inside: auto !important;
}

/* Images: WeasyPrint doesn't crop via object-fit the same way Chrome does.
   Force a fixed height with overflow hidden to prevent full-size photos. */
.stop-photos { display: flex !important; flex-direction: column !important; gap: 8px !important; }
.stop-photos img {
  display: block !important; width: 100% !important;
  height: 200px !important; max-height: 200px !important;
  overflow: hidden !important; object-fit: cover !important;
  flex: none !important; border-radius: 8px !important;
}

/* Font sizes (WeasyPrint has no viewport, so @media (max-width: 600px) never fires,
   and @media print would otherwise apply guide_v3.css's 11px --fs-print).
   guide_v3.css uses ONE unified 14px scale — mobile == desktop, no scale-up
   (locked 2026-06-03). Re-assert that 14px scale unconditionally so the PDF
   matches the on-screen guide the reader uses on her phone.
   Updated 2026-06-05 to the flat 14px scale (was a stale 18–22px scale). */
body { font-size: 14px; line-height: 1.55; }
.container { padding: 0 14px 32px; }
.title-city { font-size: 14px; } .title-hotel { font-size: 14px; } .title-address { font-size: 12px; }
.overview-title, .day-header { font-size: 14px; }
.extras-title { font-size: 14px; }
.extras-sub { font-size: 14px; }
.overview-day-title { font-size: 14px; } .overview-day-stops { font-size: 13px; }
.stop-num, .stop-name { font-size: 14px; } .stop-row { font-size: 14px; }
.tour-box, .ticket-box, .entry-body, .shows-box, .transit-box,
.hotel-first, .arrive-first, div.train, .next, .next-tram, .warn
  { padding: 10px 12px; font-size: 14px; }
"""
```

---

## Staging Directory Setup

Before rendering, the staging directory must mirror the relative paths the HTML expects. The guide links `../../assets/guide_v3.css` so the CSS must sit one level above the guide folder.

```bash
STAGING=/sessions/.../mnt/outputs/render
DRIVE="/sessions/.../mnt/GoogleDrive-bellinello@gmail.com/My Drive/Travel"
CITY=Pasadena

mkdir -p "$STAGING/Guides/$CITY/_build/assets"
mkdir -p "$STAGING/assets"

# Guide HTML + photos  (website content lives under Travel-Website/ since 2026-06-13)
cp "$DRIVE/Travel-Website/Guides/$CITY/"*.html "$STAGING/Guides/$CITY/"
cp "$DRIVE/Travel-Website/Guides/$CITY/_build/assets/"*.jpg "$STAGING/Guides/$CITY/_build/assets/"

# Shared CSS — must be at assets/guide_v3.css (the site-root assets/ folder, two
# levels above the guide folder) so the guide's <link href="../../assets/guide_v3.css"> resolves
cp "$DRIVE/Brain/Reference/Guide Style.css" "$STAGING/assets/guide_v3.css"

# Mobile CSS — guides with mobile-check applied link ../../assets/mobile.css;
# must be present in staging or WeasyPrint emits a warning and the link fails silently.
# Source is the live copy in Travel-Website/assets/ (mobile_check.py --apply adds it to guides).
cp "$DRIVE/Travel-Website/assets/mobile.css" "$STAGING/assets/mobile.css"
```

---

## Full Render Script

Run from the staging directory (where `Guides/Pasadena/pasadena_v4.html` lives):

```python
import weasyprint, warnings, os
warnings.filterwarnings('ignore')

# OVERRIDE_CSS = (paste block from above)

guide  = 'Guides/Pasadena/pasadena_v4.html'
output = '/path/to/pasadena_v4.pdf'

html        = weasyprint.HTML(filename=guide, base_url='Guides/Pasadena/')
font_config = weasyprint.text.fonts.FontConfiguration()
html.write_pdf(output, stylesheets=[weasyprint.CSS(string=OVERRIDE_CSS)], font_config=font_config)

from pypdf import PdfReader
print(f"{os.path.getsize(output)/1e6:.2f} MB, {len(PdfReader(output).pages)} pages")
```

Copy output to Drive:

```bash
cp pasadena_v4.pdf \
  "/sessions/.../mnt/GoogleDrive-bellinello@gmail.com/My Drive/Travel/Travel-Website/Guides/Pasadena/pasadena_v4.pdf"
```

---

## Heads Up

### 1. Never add NotoColorEmoji to `font-family`

**Wrong:**
```css
body { font-family: sans-serif, 'NotoEmoji'; }
```

**Right:**
```css
body { font-family: sans-serif; }
```

**Why:** WeasyPrint uses Pango for text shaping. When NotoColorEmoji is explicitly listed in `font-family`, Pango applies the emoji font's glyph metrics to neighboring characters — including plain digits. Every number in the document ends up spaced out: `1 9 2 7` instead of `1927`, `7 : 3 0 am` instead of `7:30 am`.

The fix is to leave NotoEmoji out of `font-family` entirely. Because we set up fontconfig to include `/tmp/fontconfig/fonts/`, Pango automatically finds NotoColorEmoji as a system-level fallback for emoji codepoints only, without polluting text metrics.

### 2. `@media print` strips the title page

WeasyPrint always renders as print media. `Guide Style.css` has an `@media print` block that resets `.title-page` to white background. The override CSS must re-assert the live hotel-banner gradient (`linear-gradient(135deg, #7a3b1e 0%, #b85c2a 55%, #d4874a 100%)` — the 2026-05-31 gold reskin) with `!important` inside its own `@media print` block to win the specificity battle. If the banner palette changes again in `guide_v3.css`, update the override here in the same pass.

### 3. `break-inside: avoid` causes half-empty pages

Chrome ignores `break-inside: avoid` when the element is taller than one page. WeasyPrint obeys it strictly, pushing entire day blocks and stop blocks to new pages and leaving large whitespace gaps. Override with `break-inside: auto !important` on all affected elements.

### 4. `@media (max-width: 600px)` never fires

WeasyPrint has no viewport concept, so mobile media queries don't apply. The mobile font sizes in `Guide Style.css` must be duplicated as unconditional rules in the override CSS.

### 5. Images can render full-size

`object-fit: cover` with a height constraint doesn't always crop correctly in WeasyPrint. Set `height`, `max-height`, and `overflow: hidden` together with `flex: none` to prevent photos from expanding to their natural size.
