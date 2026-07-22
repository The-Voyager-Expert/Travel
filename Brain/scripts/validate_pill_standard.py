#!/usr/bin/env python3
"""
Validate pill/chip/button CSS SIZING consistency across the site.

SIZING STANDARDS AUTOMATED:

1. FILTER PILL: padding 6px 12px, border-radius 6px, font-size 13px
2. CONTROL BUTTON: height 32px or 40px, padding 0 12px/14px, font-size 12-13px

All new pill classes must follow one of these two size patterns.
Special cases (stat pills, one-offs) are logged but not blocked.

COLORS/EFFECTS STANDARDS (manual review required):

Only TWO approved visual states across the site:
  - FILLED: terracotta gradient (linear-gradient(135deg, #7a3b1e 0%, #b85c2a 55%, #d4874a 100%))
  - OUTLINED: terracotta border (#b85c2a)

See Brain/Reference/Pill-Standard.md for full color/effect specifications.
Code review should verify that active/selected pill states use only approved colors.
"""

import re
import sys
from pathlib import Path
from collections import defaultdict

# ═══════════════════════════════════════════════════════════════════════════
# STANDARD PATTERNS

FILTER_PILL = {
    'padding': '6px 12px',
    'border-radius': '6px',
    'font-size': '13px',
}

CONTROL_BUTTON = {
    'height': ['32px', '40px'],
    'padding': ['0 12px', '0 14px'],
    'font-size': ['12px', '13px'],
}

# Classes that are intentional special cases (exempt from standard)
SPECIAL_CASES = {
    # Container/layout classes (not styled directly)
    'pills',
    'legend-pills',
    'll-chips',
    'cmp-sel-chips',
    'filter-btn',  # Container
    'filter-row',
    'filter-bar',
    'controls',

    # Status/badge pills with rounded style
    'stat-pill',

    # Compare mode
    'cmp-chip',   # Compare mode chips
    'cmp-go-btn', # Compare action buttons
    'cmp-exit-btn',
    'cmp-remove-btn',
    'cmp-chip-x',  # Close button in chips

    # Intentional size variants
    'utab',       # Unit toggle tabs (smaller)
    'pkl-pill',   # Pickleball special styling
    'pkl-chip',
    'pkl-finder-btn',
    'pkl-pill-val',
    'pkl-pill-label',
    'pill-count',  # Tiny counter pills
    'norm-chip',   # Tipping guide chips
    'hub-pill',    # Delta hub badges
    'net-chip',    # Transit network chips
    'card-pill',   # Packing list pills
    'chip-link',   # Navigation chip links
    'view-pill',   # Visa view pills
    'city-pill',   # Coverage city pills
    'jump-btn',    # Jump navigation buttons
    'reset-btn',   # Utility buttons
    'print-btn',
    'toggle-btn',
    'size-pill',   # Baggage size/weight pills
    'weight-pill',
    'apill',       # Airline pills
    'routine-chip',  # Vaccine routine chips
    'rpill',       # Vaccine routine pills
    'cmp-btn',     # Compare buttons
    'cmp-btn-clear',
    'cat-ctrl-btn',  # Category control buttons
    'sort-btn',    # Sort buttons
    'row-chip',    # Table row chips
    'hub-chip',    # Travel Stats hub chips
    'nu-chip',     # Trip nuance chips
    'nu-chips',    # Trip nuance chips container
    'pill',        # City-Transit-Cards uses pill with 12px (acceptable variant)
    'tier-pill',   # Delta Routes pills (have desktop/mobile variants)
    'stab',        # Status tabs (control button variant)
    'view-pills',  # Visa view pills container
    'chips',       # Visa chips container
    'chip',        # Visa chip variant (14px font)
    'pill-num',    # Main Pages custom counter pill styling
    'pill-label',  # Main Pages custom counter pill label
    'reach-chip',  # Restaurants.html quick-reach link chips (compact, intentional 11.5px)
    'stat-chip',   # Compact stat chips
}

# ═══════════════════════════════════════════════════════════════════════════

def check_html_file(html_path):
    """Check a single HTML file for pill consistency."""
    errors = []
    warnings = []

    content = html_path.read_text()

    # Find all CSS class definitions for pills/chips/buttons
    # Pattern: .classname { ... rules ... }
    pill_classes = re.findall(
        r'\.([a-z\-]*(?:pill|chip|tab|btn)[a-z\-]*)\s*\{([^}]+)\}',
        content,
        re.IGNORECASE
    )

    for cls_name, rules in pill_classes:
        # Skip pseudo-selectors and utility classes
        if any(x in cls_name for x in ['hover', 'active', 'child', 'header', 'footer', 'icon', 'wrap', 'row', 'group', 'table']) or cls_name.endswith('-on') or cls_name == 'on':
            continue

        # Skip empty rules (just layout containers, not styling)
        rules_clean = rules.strip()
        if not rules_clean or rules_clean == '':
            continue

        # Extract CSS properties
        props = {}

        padding = re.search(r'padding:\s*([^;!]+)', rules)
        if padding:
            props['padding'] = padding.group(1).strip()

        radius = re.search(r'border-radius:\s*([^;!]+)', rules)
        if radius:
            props['border-radius'] = radius.group(1).strip()

        font = re.search(r'font-size:\s*([^;!]+)', rules)
        if font:
            props['font-size'] = font.group(1).strip()

        height = re.search(r'(?:min-)?height:\s*([^;!]+)', rules)
        if height:
            props['height'] = height.group(1).strip()

        # Check if it's a mobile override (contains !important)
        is_mobile_override = '!important' in rules

        # Check if it matches a standard pattern
        is_filter_pill = (
            props.get('padding') == '6px 12px' and
            props.get('border-radius') == '6px' and
            props.get('font-size') == '13px'
        )

        # For mobile overrides, allow flexible padding/height as long as it's in the right range
        is_mobile_control_button = False
        if is_mobile_override and 'height' in props:
            # Mobile overrides often have partial definitions
            height_val = props.get('height', '')
            padding_val = props.get('padding', '')
            font_val = props.get('font-size', '')

            # Check if it's a reasonable control button variant
            is_mobile_control_button = (
                any(h in height_val for h in ['32px', '40px', '30px']) and
                (any(p in padding_val for p in CONTROL_BUTTON['padding']) or padding_val.startswith('0'))
            )

        is_control_button = (
            ('height' in props and
            any(h in props.get('height', '') for h in CONTROL_BUTTON['height']) and
            any(p in props.get('padding', '') for p in CONTROL_BUTTON['padding']))
            or is_mobile_control_button
        )

        # Log results
        rel_path = html_path.relative_to(Path(__file__).resolve().parent.parent.parent)

        # Skip if it's a known special case
        if cls_name in SPECIAL_CASES:
            warnings.append({
                'file': rel_path,
                'class': cls_name,
                'status': 'special-case',
                'props': props
            })
        # Flag if it doesn't match a standard
        elif not (is_filter_pill or is_control_button):
            errors.append({
                'file': rel_path,
                'class': cls_name,
                'status': 'non-standard',
                'props': props
            })

    return errors, warnings


def check_js_pill_centering(html_path):
    """
    Detect JS-built pills/chips that use display:inline-block without text centering.

    Pattern caught: style.cssText = '...display:inline-block...' missing both
    text-align:center AND display:inline-flex+justify-content:center.

    When text wraps (e.g. 'Nature & Outdoors'), inline-block leaves it left-aligned.
    Fix: use display:inline-flex;align-items:center;justify-content:center.
    """
    errors = []
    content = html_path.read_text()
    rel_path = html_path.relative_to(Path(__file__).resolve().parent.parent.parent)

    # Find all cssText assignments in JS (both single and double quoted strings)
    css_text_pattern = re.compile(
        r'\.style\.cssText\s*=\s*([\'"])(.*?)\1',
        re.DOTALL
    )

    for m in css_text_pattern.finditer(content):
        css = m.group(2)

        # Only care about inline-block (not inline-flex which is already correct)
        if 'display:inline-block' not in css and 'display: inline-block' not in css:
            continue

        has_text_align_center = 'text-align:center' in css or 'text-align: center' in css
        has_flex_center = (
            ('display:inline-flex' in css or 'display: inline-flex' in css) and
            ('justify-content:center' in css or 'justify-content: center' in css)
        )

        if not has_text_align_center and not has_flex_center:
            # Get a short snippet for context
            snippet = css[:80].replace('\n', ' ')
            errors.append({
                'file': rel_path,
                'snippet': snippet,
                'fix': 'Replace display:inline-block with display:inline-flex;align-items:center;justify-content:center or add text-align:center',
            })

    return errors


def main():
    """Audit all HTML files for pill standard compliance."""
    root = Path(__file__).resolve().parent.parent.parent
    html_files = sorted(root.glob('Travel-Website/**/*.html'))

    all_errors = []
    all_warnings = []
    all_centering_errors = []

    for html_file in html_files:
        errors, warnings = check_html_file(html_file)
        all_errors.extend(errors)
        all_warnings.extend(warnings)
        all_centering_errors.extend(check_js_pill_centering(html_file))

    # Report
    print('=' * 80)
    print('PILL STANDARD VALIDATOR')
    print('=' * 80)

    if all_errors:
        print(f'\n❌ {len(all_errors)} NON-STANDARD PILLS FOUND:\n')
        for err in all_errors:
            print(f"{err['file']}")
            print(f"  .{err['class']}: {err['props']}")
            print(f"  → Should be FILTER PILL (6px 12px/6px/13px) or CONTROL BUTTON (32-40px height)")
    else:
        print('\n✓ All pills follow the standard!')

    if all_centering_errors:
        print(f'\n❌ {len(all_centering_errors)} JS PILL TEXT-CENTERING VIOLATIONS:\n')
        for err in all_centering_errors:
            print(f"{err['file']}")
            print(f"  cssText: '{err['snippet']}...'")
            print(f"  → {err['fix']}")
    else:
        print('\n✓ All JS-built pills have text centering!')

    if all_warnings:
        print(f'\n⚠️  {len(all_warnings)} SPECIAL-CASE PILLS (exempt):\n')
        for warn in all_warnings:
            print(f"{warn['file']}")
            print(f"  .{warn['class']}: {warn['props']}")

    exit_code = 1 if (all_errors or all_centering_errors) else 0
    print(f'\nExit code: {exit_code}')
    return exit_code


if __name__ == '__main__':
    sys.exit(main())
