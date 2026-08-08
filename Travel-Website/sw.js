/* Travel — service worker. NETWORK-FIRST for everything: when you are online you
   ALWAYS get the latest from the server (no stale cached pages/assets), so deploys
   go live immediately on the next load. The cache is only an offline fallback
   (planes, tunnels, abroad with no data) — a page/asset opened once stays readable
   offline. Lives at the site root (→ /Travel/ on GitHub Pages) so its scope covers
   every page.

   History: previously assets were stale-while-revalidate, which served the OLD
   cached copy first and refreshed in the background — so CSS/JS edits only appeared
   on the SECOND visit ("updates don't go live"). Switched to network-first so the
   cache can never hide a fresh deploy. (2026-06-20)

   2026-07-19: Added URL-rewriting to force-flush stale CSS/JS that iOS Safari
   aggressively caches by URL. Requests for guide-style.css?v<30 are rewritten to
   ?v=30; toolbar.js?v<102 to ?v=102. The SW file itself is always byte-checked
   fresh by the browser, so this fix reaches devices without touching any guide HTML.
   2026-07-19: Bumped toolbar.js min to 106 — adds in-page "Add to Home Screen" banner.
   2026-07-20: Reverted also-nearby-wrap; bumped guide-style.css min to 39, toolbar.js min to 112.
   2026-07-24: Navigation pills (also-on-this-site, nearby-guide, byg-guide) restyled to gold — bumped guide-style.css min to 40.
   2026-07-26: Added :visited color rules for all pill <a> classes — bumped guide-style.css min to 41.
   2026-07-26: Removed bare a:visited color from web-travel-style.css to stop gold bleed on pill anchors — bumped CACHE to v49.
   2026-07-27: Trips page — killed all link underlines/traces, visited-state colors on colored cards — bumped CACHE to v50.
   2026-07-27: Guides-Index sub-panel pills → flat square grid (language, months, trip type, flight); dropdown backgrounds → beige — bumped CACHE to v51.
   2026-07-27: Destination-Records rank-num fixed width (was min-width) — numbers aligned — bumped CACHE to v52.
   2026-07-27: Browse-by-category header matches All-countries style; Caribbean removed from continent filter — bumped CACHE to v53.
   2026-07-27: Action buttons (cal/map/preview/offline) 2×2 grid on mobile; Guides-Index muted pressed-down selected state — bumped guide-style.css min to 42, CACHE to v54.
   2026-07-27: Fix selected-state color — use #f0ede8 (surface2) instead of white for all toolbar .on/expanded states — bumped CACHE to v55.
   2026-07-27: Weather banner — 17 guides now show (accent normalization + 9 climate.json aliases); mobile cut fixed (5 days, no label ≤600px) — bumped toolbar.js min to 127, CACHE to v56.
   2026-07-28: Guides-Index pinned-trip pills — mobile font-size 12→14px in guides-index-style.css — bumped CACHE to v57.
   2026-07-28: Hamburger active item — stripped terracotta border box from mobile.css (reappeared after commit b047d872); added mobile.css to MIN_VERSIONS at 54 so iOS busts cached ?v=53 → bumped CACHE to v58.
   2026-07-28: Removed "This Week" label from weather strip (desktop and mobile) — bumped toolbar.js min to 128, CACHE to v59.
   2026-07-28: .day-jump-x — removed pill background + border-radius; ✕ is now a plain glyph — bumped guide-style.css min to 43, CACHE to v60.
   2026-07-28: Calendar Export modal ✕ — 18px #9a948a → 13px #7a7068 (matches standalone-✕ standard) — bumped toolbar.js min to 129, CACHE to v61.
   2026-07-28: Removed "Before You Go" back pill everywhere — desktop guide back-strip (kept "‹ All Guides") + mobile fixed pill on 21 Trip-Essentials sub-pages; deleted orphan .tve-byg-back CSS — bumped toolbar.js min to 130, CACHE to v62.
   2026-07-28: Plug-Adapter-Guide — added referrer-driven "← Back to {City}" pill at end of page when arrived from a /Guides/{City}/*.html page (no per-guide edits; silent no-op otherwise) — bumped toolbar.js min to 131, CACHE to v63.
   2026-07-28: Plug-Adapter-Guide back-to-guide pill — switched from document-end to MOBILE-ONLY fixed position (bottom-left, always visible while scrolling); hidden on desktop (>600px) — bumped toolbar.js min to 132, CACHE to v64.
   2026-07-28: Restored the desktop guide-top "Before You Go" pill in the #tve-back-guides strip (left of "‹ All Guides", carries #{City} deep-link) — earlier removal overreached; only the mobile fixed pill on 21 Trip-Essentials sub-pages was meant to go — bumped toolbar.js min to 133, CACHE to v65.
   2026-07-28: Weather strip — width:100% so it matches hotel-banner + Trip Overview width (was shrink-to-fit) — bumped toolbar.js min to 134, CACHE to v66.
   2026-07-28: Removed .container from mobile.css's @600px padding rule — was overriding guide-style.css's 14px with 16px !important on the 23 legacy guides, causing a 4px banner-width drift since day one. All 230 guides now render identical widths — bumped mobile.css min to 55, CACHE to v67.
   2026-07-28: Weather strip shows 7 days on mobile (was 5) — width:100% + flex:1 min-width:0 columns fit cleanly at 375px+ — bumped toolbar.js min to 135, CACHE to v68.
   2026-07-28: Extended back-to-guide pill (was Plug-Adapter-Guide only) to every Trip-Essentials page that guides actually link to — 14 pages total: Asia-Stats, Caribbean-Stats, Currency-Guide, Europe-Stats, European-Train-Guide, Plug-Adapter-Guide, Safety-Guide, South-America-Stats, Stats-Across-Canada, Stats-Across-US, Sunrise-Sunset, Time-Zones, Visas, Weather. Same MOBILE-ONLY fixed bottom-left pill + referrer gate; label always "← Back to {City}" (city only, ignores #country deep-link anchor). Silent no-op if referrer isn't a guide or page not in allow-list — bumped toolbar.js min to 136, CACHE to v69.
   2026-07-28: climate.json — 9 missing entries: New York City, Napa Valley, Sao Miguel, Machu Picchu, Nassau, Paro, Anchorage, Cancun, Funchal — weather banner now shows on all guides — bumped CACHE to v72.
   2026-07-28: CACHE bump to v73 — force-purges stale v72 climate.json (231 keys, pre-additions) from all browser caches.
   2026-07-28: climate.json XHR — append ?d=YYYY-MM-DD daily cache-buster so browser HTTP cache never serves stale file — bumped toolbar.js min to 138, CACHE to v76.
   2026-07-28: Pill vertical-centering site-wide — added display:inline-flex + align-items:center to 15 pill classes across guides-index-style.css + 8 Trip-Essentials pages so labels center vertically in their tiles — bumped CACHE to v75.
   2026-07-28: climate.json — added Bend Area alias (bend_v2.html) + coverage now 230/230 guides — bumped CACHE to v76.
   2026-07-28: Repointed hamburger "📊 Personal Stats" entry — file was renamed Personal-Stats.html → Travel-Stats.html in a parallel crib; hamburger + Guides-Index topbar + Been-Map back-link all now point at Travel-Stats.html (label also updated to "📊 Travel Stats"). — bumped toolbar.js min to 139, CACHE to v77.
   2026-07-28: Back-to-guide pill now deep-links to the SECTION the reader left, not the top of the guide — added sessionStorage.setItem('tve-back-anchor', location.href) on guide-side outbound Trip-Essentials click + getItem consume in injectBackToGuidePill (falls back to referrer if no stash). document.referrer alone strips the #fragment; sessionStorage recovers it. Label unchanged — city only. Validator (check_back_to_guide_pill) now hard-fails if either half of the pipeline is missing — bumped toolbar.js min to 140, CACHE to v78.
   2026-07-28: Back-to-guide pill EXTENDED to guide-to-guide navigation (Nearby Guides + "Also in {Country}" strips) — click-listener now fires on any cross-page a[href] (not just Trip-Essentials/), and injectBackToGuidePill now fires on guide pages too when the referrer is a DIFFERENT guide. Section-anchor preserved via same sessionStorage pipeline. Label unchanged. Validator extended: thisIsGuide branch presence is now hard-checked — bumped toolbar.js min to 141, CACHE to v79.
   2026-07-28: #ics-pill-row 2×2 grid restore + Climate-Finder mobile fixes — force fresh guide-style.css fetch so devices with cached ?v=43 pick up the CSS revert (repeat(2,1fr) instead of the interim 1fr) — bumped guide-style.css min to 44, CACHE to v80.
   2026-07-28: mobile.css — exempt #tve-back-guides a, .also-on-this-site-pill, .nearby-guide-pill from the 40px tap-target rule (min-height:40px was overriding their defined heights of 28px/36px, making them bloated on mobile) — bumped mobile.css min to 56, CACHE to v81.
   2026-07-28: Safety-Guide L1-L4 badges → Tap-Water pattern (neutral border, family bg+text+dot); mobile 2×2 Form B glued grid; Travel-Insurance cc-table gets right-edge fade mask + tighter padding on mobile. Force purge stale HTML from SW cache — bumped CACHE to v83.
   2026-07-28: Guides-Index desktop toolbar strip — stretched 11 buttons full-width via flex:1 + squared all corners (border-radius:0), wrapped in @media (min-width:601px) so mobile grid layout untouched. Bump CACHE to v84 so browsers pick up the guides-index-style.css change.
   2026-07-28: Fix toolbar-stretch selectors — display:contents doesn't reparent DOM, so the original .topbar > child selectors matched nothing. Rewrote against real DOM parents (.view-toggle > *, .pill-row > *, .seg-toggle > *, .lang-jump / .days-jump wrappers) + added !important to beat the existing base rules at 427/442/737. Bump CACHE to v85.
   2026-07-28: REVERT toolbar-stretch — owner reported the desktop toolbar disappeared. Removed the @media (min-width:601px) block from guides-index-style.css so the pre-existing toolbar returns intact. Bump CACHE to v86.
   2026-07-28: Retry desktop toolbar-stretch — corrected selectors (.topbar > .view-toggle > *, .topbar > .pill-row > *, .seg-toggle child, .lang-jump/.days-jump wrappers) with higher specificity via .topbar > prefix so no !important is needed. Applies flex:1 1 0 + border-radius:0 to the 11 toolbar buttons on desktop only. Single push, single CACHE bump to avoid the cache-churn issues of the last attempt. Bump CACHE to v87.
   2026-07-28: Toolbar stretch v2 — add min-width:0 so long-label buttons ("Compare cities", "Trip Length") shrink to equal flex share (fixes uneven borders); add justify-content:center to Trips/Stats/Compare/Trip Type/When to go/Flight time buttons that were still flex-start (fixes off-center labels). Bump CACHE to v88.
   2026-07-28: Retired the mobile.css "strip .legend .pill/.badge bg+border" rule — it was wiping the new family-pill standard (Behavior 3) on Safety-Guide + all 5 pages using .legend. Per-page inline @media now owns mobile pill sizing — bumped mobile.css min to 57, CACHE to v89.
   2026-07-28: `.also-in-country-pill` (the "Also in {Country}" strip injected by toolbar.js) was missing its `a.also-in-country-pill:visited { color:#8a6c1a }` lock, so after a click browsers repainted the pill blue via the global `a:visited { color:var(--c-link) }` rule. Added the visited lock in guide-style.css AND extended brain_check with `check_universal_visited_color_match` — a walker that scans every anchor class in the 6 shared CSS assets and hard-fails on any :visited/rest color drift, so this can't reoccur — bumped guide-style.css min to 48, CACHE to v102.
   2026-07-28: Extended visited-color validator to inline <style> blocks in 85 shipped HTML pages (was shared-CSS only). Owner rule: "no font anywhere should change color after visited" applies to inline styles too. Fixed 6 real drifts: web-travel-style.css `.rank-city`/`.city-link`/`.bucket-name`/`.bar-country` (inherit→var(--text)) + `.chip-link`/`.best-of-link` (inherit→explicit); Visas.html `a.chip-link:visited` + `a.apply-link:visited`; Festival-Finder.html `a.ff-cl-city:visited`; Safety-Guide.html `a.badge:visited`. Bumped CACHE to v105.
   2026-07-28: 4 remaining 1.5px #c8a44a borders in guide-style.css (.day-jump-btn, .day-jump-num, .tve-scroll-top, .tve-back-index) → 0.5px per universal gold-border sweep rule (missed by earlier section-pill cleanup). Bumped guide-style.css min to 49, CACHE to v107.
   2026-07-28: CRITICAL — Chrome doesn't resolve var() in :visited rules (privacy restriction to prevent history-sniffing), so every :visited using var(--text)/var(--muted)/var(--accent)/etc. was silently ignored, falling back to the base `a { color: var(--accent) }` = gold. Visible symptom: stats-page country links (Mexico, Costa Rica, ...) rendered gold/orange after being visited, not body-text dark. Swept 32 :visited rules across web-travel-style.css + guide-style.css + guides-index-style.css + 15 Trip-Essentials inline styles — replaced every var() with the literal hex value it resolves to (light-mode). Validator (check_universal_visited_color_match) also taught the var→hex mapping so rest-color `var(--text)` and visited-color `#1a1917` compare equal. Bumped CACHE to v110.
   2026-07-28: The ACTUAL cause of the terracotta stats-page links: `.bar-country a.cgl { color: var(--rust) }` at web-travel-style.css:860 deliberately rendered JS-generated country links (5 regional stats pages) in terracotta by design — not a var()-in-:visited issue at all. Owner rule 2026-07-28: "all fonts on all stats pages need to be same color as body text before AND after clicking" → changed `.cgl` rest to var(--text) + added `:visited { color: #1a1917 }` lock. Bumped CACHE to v114.
   2026-07-28: Before-You-Go .byg-safety-badge / .byg-cost-badge / .byg-water-* variants reconciled to canonical family palette (GREEN/YELLOW/RED/BLUE per Formatting.html#src-pills § Behavior 3). Bumped CACHE to v118 so cached Before-You-Go HTML on all guides refetches.
   2026-07-28: Badge borders darkened site-wide — all 5 pale hex values (#c5d5ee, #ddd6fe, #9ad09a, #e8c870, #e8c0a0) replaced with rgba(text-color, 0.4) across 20 Trip-Essentials pages + web-travel-style.css --c-tag-ok-border + --c2bd. Matches the badge-spec update (Brain/Reference/Badge-Formatting-and-Colors.html — all 8 canonical families now use rgba(text,0.4) border pattern). Bumped CACHE to v138 so shared CSS + Trip-Essentials HTML refetch.
   2026-07-28: Tightened row rhythm inside .tour-box / .ticket-box — row-to-row margin-top 6px → 3px (halved). Applies to hours / visit-time / location rows inside every stop's booking box. Bumped guide-style.css min to 50, CACHE to v142.
   2026-07-28: Delta-Routes-SEA — .tag.new/d1/seasonal/partner reassigned to canonical PINK/PURPLE/YELLOW/BEIGE (was drifted GREEN/RED-brown/warm-cream/BLUE, colliding with tier colors). Also .tags gap 3px → 6px in web-travel-style.css for card badge breathing room. Removed 16 redundant "Seasonal" instances from card meta lines. Bumped CACHE to v150. */
/* 2026-07-29: Delta-Routes-Full + SEA audit — strip redundant "Year-round · Daily" text (56 on Full, 7 on SEA) and add YEAR-ROUND badge; strip leading "Seasonal ·" from meta when card has tag.seasonal badge (14+ Full); add tier bar left-colors + tag.yr + tag.winter on SEA; SEA data-guide dedupe (77); Cancún winter badge + WINTER family (SLATE #3a4a68). Bumped CACHE to v152. */
/* 2026-07-29: Native select chevron gold #c8a44a → muted grey #6a6660 (web-travel-style.css:729) — was drawing attention to a passive control. Bumped CACHE to v154. */
/* 2026-07-29: Booking-box row rhythm — 3px margin change was too subtle vs the 1.6 body line-height. Tightened to margin-top: 0 + line-height: 1.35 on .tour-box/.ticket-box > div so the actual visible gap collapses hard. Bumped guide-style.css min to 51, CACHE to v158. */
/* 2026-07-29: Title banner text → terracotta site-wide. Owner rule: h1 inside .header/.page-header/.site-header/.site-title renders in var(--rust) (#b85c2a light / #d4784a dark), not the previous #3d3a32 near-black. Applied to web-travel-style.css + mobile.css shared rules + Delta-Routes-Full/SEA inline overrides. Dark-mode override removed (var(--rust) already shifts). Bumped mobile.css min to 58, CACHE to v162. */
/* 2026-07-29: Mobile-only "← Back to Before You Go" pill — referrer-driven sibling to #tve-back-to-guide. Fires on the 21 Trip-Essentials pages Before-You-Go links to (Plug/Safety/Tap-Water/Vaccines/Visas/Entry-Requirements/Time-Zones/Sunrise-Sunset/Weather/Currency/Lounges-US/EU/regional Stats/Day-Trips/EU-Trains/Travel-Packing) — SILENT no-op unless document.referrer matches /Before-You-Go\.html/, so guide-referred + direct-nav + bookmark landings show nothing (fixes the unconditional-pill mess from ab9bec020). Href = referrer + #byg-results so a single tap lands on the card grid with city/month state intact. Scroll-FAB ↑ hides both sibling pills. Bumped toolbar.js min to 142, CACHE to v164. */
/* 2026-07-29: Added Trusted-Traveler to pagesLinkedFromByg allow-list (was missing — Global Entry card's "Find airports →" link routes there). Also locked both pills + Before-You-Go's 4 CTA labels with new validators (check_back_to_byg_pill, check_before_you_go_labels) so they can't drift back. Bumped toolbar.js min to 143, CACHE to v169. */
/* 2026-07-29: Title banner text → TERRACOTTA GRADIENT (was solid var(--rust) after earlier flip from #3d3a32). h1 clips var(--banner-gradient) via background-clip:text; color:transparent. Applied to web-travel-style.css + mobile.css shared rules + Delta-Routes-Full/SEA + Visas + Lounges-Europe/US inline overrides. Validators updated + doc § 16. Bumped mobile.css min to 59, CACHE to v170. */
/* 2026-07-29: Booking-box row rhythm — line-height 1.35 was still too loose. Now line-height: 1.15 !important + margin-top: 0 !important + box padding 8px top/bottom (was 10px). Rows now sit tight against each other. Bumped guide-style.css min to 52, CACHE to v178. */
/* 2026-07-29: "Also in [Country]" pills (toolbar.js-injected, 26 countries affected) were missing
   the 🗺️ globe icon that .nearby-guide-pill has, so directly under a Nearby Guides row they read
   as a visually different/unstyled pill even though border+color CSS matched. Added the same
   '🗺️ ' prefix used by nearby-guide-pill. Bumped toolbar.js min to 144, CACHE to v187. */
/* 2026-07-29: Reverted title-banner text back to solid #3d3a32 — two cribs today (01:42 and 02:32)
   flipped it to solid var(--rust) then to terracotta gradient-clipped text, both wrong. The
   banner-gradient var is the underline bar / Guides-Index hero box background, not a text-clip
   source; clipping it to text put the gradient's dark stop under the leading letters, reading as
   a near-black title. Restored the long-standing #3d3a32 in web-travel-style.css + mobile.css +
   Visas/Lounges-Europe/US/Delta-Routes-Full/SEA inline overrides + brain_check validators.
   Bumped mobile.css min to 60, CACHE to v188. */
/* 2026-07-29: Best-Of cross-links — toolbar.js injects .also-on-this-site-pill row before
   #also-on-this-site on guide pages that appear in a Best-Of collection. CITY_BEST_OF_MAP
   (163 cities, 549 entries) built from Best-*.html links by build_best_of_map.py.
   Bumped toolbar.js min to 145, CACHE to v189. */
/* 2026-07-29: Title banner corrected AGAIN — #3d3a32 (restored two revert-passes ago) was
   itself an already-drifted value, not the real canonical one; confirmed the actual design
   has no black in the title at all. Now solid var(--rust) terracotta (no gradient-clip) in
   web-travel-style.css + mobile.css + Visas/Lounges-Europe/US/Delta-Routes-Full/SEA inline
   overrides + brain_check validators. web-travel-style.css added to MIN_VERSIONS below since
   it has no ?v= on any page and was never covered by the cache-bust rewrite. Bumped mobile.css
   min to 61, CACHE to v190. */
/* 2026-07-29: Title banner corrected a THIRD time — solid var(--rust) text was also wrong.
   The real canonical treatment is the SAME solid gradient box (background: var(--banner-gradient))
   with white text (var(--banner-text)) already used everywhere else on the site (Day-N trip-overview
   pill, region-header, Guides-Index hero) — restored the pre-2026-06-20 box design. Applied to
   web-travel-style.css + mobile.css title banner AND the shared .country-header/.country-name rule,
   plus Visas/Lounges-Europe/US/Delta-Routes-Full/SEA inline h1 overrides + brain_check validators.
   Bumped mobile.css min to 62, web-travel-style.css min to 2, CACHE to v191. */
/* 2026-07-29: Back-to-guide pill (#tve-back-to-guide) was referrer-only, so it silently
   vanished whenever document.referrer was absent — iOS standalone/PWA launch, hard refresh,
   bookmark, or any hop that isn't a direct guide→page click. Added a per-tab sessionStorage
   stash ('tve-src-guide') written on the guide side + read as a fallback in
   injectBackToGuidePill when the referrer isn't a guide. Pill stays referrer-gated as primary
   (fresh tab with no guide visit still shows nothing). Bumped toolbar.js min to 146, CACHE to v194. */
/* 2026-07-29: Guides-Index desktop — search bar sat flush on the glued pill grid.
   Added `.topbar > #search-wrap { margin-bottom:14px }` in the min-width:601px block
   so the search line lifts off row 1 while the two pill rows stay glued (gap:0
   untouched). guides-index-style.css isn't in MIN_VERSIONS, so bump CACHE to v196. */
/* 2026-07-31: Print-Ready Full Guide Mode — "🖨 Print Guide" button added to the
   #tve-back-guides strip on every real guide page. Click injects @media print CSS
   that hides all site chrome and opens the browser print dialog. — bumped toolbar.js
   min to 148, CACHE to v198. */
/* 2026-07-31: Back pills (#tve-back-to-guide, #tve-back-to-byg) invisible on iOS
   Safari when landing on pages with scroll-behavior:smooth + hash fragment (Currency,
   Plug-Adapter). iOS fails to composite fixed-position elements injected during a
   smooth-scroll animation. Fix: transform:translateZ(0) forces a compositor layer +
   void pill.offsetHeight forces a reflow after injection. — bumped toolbar.js min to
   149, CACHE to v199. */
/* 2026-08-01: REAL fix for the same back-pill bug — the prior translateZ/reflow patch
   mis-diagnosed it as scroll-behavior:smooth (shared by Safety/Visas/Travel-Stats, which
   worked). The true differentiator: Currency-Guide + Plug-Adapter-Guide were the ONLY two
   pages that ASSIGNED `location.hash=` on a row-click jump. That native fragment navigation
   drops iOS Safari's compositor layer for the fixed pill, so it stays invisible until a
   later repaint (opening the hamburger), where it then floats over the menu. Fixed at root:
   both pages now use history.replaceState (URL still shareable) + keep scrollIntoView, so
   they match the 14 scrollIntoView-only pages that never break. Also: toolbar.js now hides
   both back pills while the hamburger drawer is open (body.tve-ham-open) so the pill can
   never overlap the nav menu. — bumped toolbar.js min to 150, CACHE to v200. */
/* 2026-08-01: Simplified the Currency/Plug jumpTo to pure scrollIntoView() — dropped the
   interim history.replaceState so both pages are byte-for-byte STANDARD with the other 14
   jump-to-anchor pages (no URL-hash touch at all). No exception left to maintain. Incoming
   #country deep-links still work via the browser's native on-load anchor scroll. — CACHE v201. */
/* 2026-08-01: Self-healing SW updates — toolbar.js now calls registration.update()
   on every load + reloads once (sessionStorage-guarded, loop-proof) when a newer SW
   takes control of an already-controlled page. Root reason fixes appeared to "never
   land": iOS pins the cached service worker (and the toolbar.js/CSS it rewrites via
   MIN_VERSIONS), so a stale SW keeps serving old assets until site data is cleared.
   This makes future fixes propagate automatically after one manual reset. — bumped
   toolbar.js min to 151, CACHE to v202. */
/* 2026-08-01: Back-to-guide pill extended to all 34 Best-Of category pages — guides
   link to them via the ⭐ Best Of strip in #also-on-this-site, so they now correctly
   show "← Back to {City}" on mobile when the referrer is a guide. Added all
   Best-*.html slugs (excluding Best-Of-Index) to pagesLinkedFromGuides in toolbar.js.
   — bumped toolbar.js min to 152, CACHE to v203. */
/* 2026-08-01: Share-this-stop button — injects a share-icon into every
   .stop-header on guide pages. Web Share API on mobile; clipboard copy with
   ✓ flash fallback on desktop. Stop blocks get #stop-{slug} anchors so the
   shared URL deep-links to the exact stop. Zero guide HTML changes.
   — bumped toolbar.js min to 153, CACHE to v204. */
/* 2026-08-03: .empty-state / -icon / -text consolidated into web-travel-style.css
   (was duplicated verbatim in Time-Zones, Tipping-Guide, Vaccines) and the
   Time-Zones no-results div had curly quotes in its class attribute so it never
   picked up the style at all — bumped web-travel-style.css min to 6, CACHE to v205. */
/* 2026-08-03: read-about .page-header — style="margin-top:20px" was repeated inline
   on 223 of the 232 read-about pages; folded into Read-About.css so the 9 stragglers
   match too. Read-About.css had no ?v= and was not in MIN_VERSIONS, so a cached copy
   would drop the margin — added it at min 1, CACHE to v206. */
/* 2026-08-03: back-to-guide desktop card anchors after landing element + mobile pill
   fixes — bumped toolbar.js min to 154, CACHE to v207. */
/* 2026-08-03: Guides-Index.html → index.html (no-redirect root URL); back-to-guide pill
   site-wide (all non-guide pages) — bumped toolbar.js min to 155, CACHE to v208. */
/* 2026-08-03: back-to-guide DESKTOP card now injects on every page layout (robust
   container fallback — .wrap/.wx-wrap/.dt-wrap/.index-section/… + toolbar fallback);
   was silently dropped on pages without .wrap. Bumped toolbar.js min to 156, CACHE to v209. */
/* 2026-08-03: Currency-Guide.html jumpTo still assigned location.hash=hash (the iOS
   compositor-drop bug that hides the fixed "← Back to {City}" pill) — Plug-Adapter was
   fixed 2026-08-01 but Currency was missed. Removed it so Currency matches the other
   scroll-only jump pages. CACHE bump forces the stale Currency/Plug page HTML off the
   user's device. — CACHE to v210. */
/* 2026-08-03: Best-Of pages: added best-of-features.js (continent filter, sort, favorites,
   star ratings, compare panel) across all 35 showcase pages + Best-Of-Index.html.
   New .bo-* CSS appended to web-travel-style.css. — CACHE to v211. */
/* 2026-08-04: back-to-guide pill leaked onto aggregator/nav pages — going guide →
   Guides Index made document.referrer a guide, so "← Back to {City}" fired on the
   index (and would on Before-You-Go / Climate-Finder / When-to-Go). injectBackToGuidePill
   now early-returns on those no-standalone-content hubs. — toolbar.js min to 157, CACHE to v212. */
/* 2026-08-04: Time Zones / Plug Adapter / Currency pills in the guide "Also on this
   site" strip are now MOBILE-ONLY — hidden on desktop (≥601px) via guide-style.css
   attribute-href media query. Pills stay in guide HTML (no per-guide edit). — guide-style.css min to 53, CACHE to v213.
   2026-08-04: Individual entry boxes site-wide — removed continuous-run merge, fit-content(720px) grid, tour/ticket-box width fit-content, internal stop spacing, day-header 1px border, chevron color, entry-body row gap. guide-style.css min to 54, CACHE to v215.
   2026-08-07: Trip Overview section-nav chips grouped into labelled runs on desktop (.ov-grp CSS in guide-style.css; the toolbar.js half shipped in a66baef). Chip appearance unchanged, mobile glued grid untouched. guide-style.css min to 103, toolbar.js min to 191, CACHE to v293.
   2026-08-07: Trip Overview redesign — day rows get a DAY N rail, softened stop list and right-aligned stop count with zebra rows (toolbar.js _dayRowRail + .ovd-* CSS); section-nav chips regrouped into stacked labelled runs (Eat & drink · Get around · Plan & do · Elsewhere on the site) with the beige pill treatment unchanged. Both runtime-injected, zero guide HTML edits. guide-style.css min to 113, toolbar.js min to 204, CACHE to v313.
   2026-08-07: Trip Overview chip grouping now applies on MOBILE too (was desktop-only). The glued 3-across grid moves down one level — .overview-extras stacks the groups and each .ov-grp-row is the 6-column grid with chips spanning 2; trailing orphans widened by the existing _fixPillGridOrphans helper, same idiom as .also-on-this-site-pills. guide-style.css min to 114, toolbar.js min to 205, CACHE to v314.
   2026-08-08: Cache bump only — force a fresh Pages deploy so every CDN edge re-fetches the Trip Overview day rail (.ovd-*) and grouped section-nav chips (.ov-grp*). Both shipped in 76703826 + e934f72b and are correct on origin/main; this purges any edge still holding the pre-deploy copy. guide-style.css min to 122, toolbar.js min to 207, CACHE to v323.
   2026-08-08: Section-nav chips — labelled group runs retired; the row is now an even 3-column grid and each chip carries a dot in its own section's colour, read from that section's --c-*-border token. Chips stay beige; only the radius softens 20px -> 8px. Rendered order returns to canonical (no regrouping). guide-style.css min to 127, toolbar.js min to 210, CACHE to v330.
   2026-08-08: Section-nav grid sized properly — repeat(3, 1fr) handed every chip a third of the guide width, so on a wide screen a two-word label sat alone in a ~440px box. Now repeat(auto-fill, minmax(230px, 1fr)): the column COUNT grows with the viewport (6 at 1600px, 4 at 1200px, 3 at 900px) and a cell stays near the width a chip wants. Chip padding 4px 10px -> 7px 12px. guide-style.css min to 128, CACHE to v331. */
/* 2026-08-04: Best-Of prev/next arrows now insert after .page-intro-card (below the
   banner) instead of after .page-header — bumped toolbar.js min to 158, CACHE to v214. */
/* 2026-08-04: Wikipedia row margin-bottom 12px → 6px (symmetric with margin-top, 2 less
   than prose→wiki gap); mobile .tour-box/.ticket-box min-width:100% so boxes never
   narrower than stop photos — guide-style.css min to 55, CACHE to v216. */
/* 2026-08-04: Weather strip — added NOW block showing live current temperature + current
   condition icon (from Open-Meteo &current=temperature_2m,weather_code); current-moment
   icon matches Google's icon; unit follows °C/°F toggle same as daily forecast — toolbar.js min to 160, CACHE to v219. */
/* 2026-08-05: Transit banners soft warm gold #ede8db; day-header font 17px; nearby-guides
   per-section collapse via inline styles — guide-style.css min to 58, toolbar.js min to 161, CACHE to v220. */
/* 2026-08-05: Nearby Guides — restore chevron + cursor:pointer; collapse btn white bg — guide-style.css min to 59, CACHE to v221. */
/* 2026-08-05: Collapsed extras-title — keep gold bar visible (remove border-bottom-color:transparent) — guide-style.css min to 60, toolbar.js min to 162, CACHE to v222. */
/* 2026-08-05: Transit banner font color → #7a5c1e (warm olive-gold) — guide-style.css min to 61, CACHE to v223. */
/* 2026-08-05: ICS pill row → Option D style (beige fill #ede8db, no border, #7a5c1e text, separate chips) — guide-style.css min to 62, CACHE to v224. */
/* 2026-08-05: ICS pills hover → darker beige #d8d2c2 + keep #7a5c1e text (no white); min-height 52px — guide-style.css min to 63, CACHE to v225. */
/* 2026-08-05: also-on-this-site-pills + also-in-country-pills: flex-start + gap:8px (was space-between/gap:0) — fixes 2-pill Best-Of section showing pills at opposite ends on wide desktop — guide-style.css min to 64, CACHE to v226. */
/* 2026-08-05: nav pills → Option D style (beige fill #ede8db, no border, #7a5c1e text, hover darkens to #d8d2c2) — guide-style.css min to 65, CACHE to v227. */
/* 2026-08-05: nav pills min-height: 52px — both nav pill rows same height as ICS row — guide-style.css min to 66, CACHE to v228. */
/* 2026-08-05: Revert nav + ICS pills to Aug 3 style — gold-border chips (var(--c-card-bg) fill, 0.5px #c8a44a border, terracotta hover gradient); ICS row back to button-group (flush, collapsed borders, rounded ends) — guide-style.css min to 68, CACHE to v230. */
/* 2026-08-05: weather-strip: fix NOW block — strip.insertBefore(nowBlock, grid) threw NotFoundError because grid was not yet a child of strip; changed to strip.appendChild(nowBlock) so it inserts left of grid correctly — toolbar.js min to 163, CACHE to v231. */
/* 2026-08-05: weather-strip toggle: stack °C/°F vertically + fill full strip height — flex-direction:column, align-self:stretch, flex:1 per button — toolbar.js min to 164, CACHE to v232. */
/* 2026-08-05: weather-strip: remove "Today" label — show day abbreviation for all 7 columns; NOW block already identifies the current day — toolbar.js min to 165, CACHE to v233. */
/* 2026-08-05: weather-strip: larger 7-day grid — day+temp 9px→12px, icon 15px→22px, col gap 1px→3px, strip padding 6px→9px desktop — toolbar.js min to 166, CACHE to v234. */
/* 2026-08-05: weather-strip: reduce desktop strip padding 9px→6px to tighten banner height — toolbar.js min to 167, CACHE to v235. */
/* 2026-08-05: stop-name/stop-num 15px→17px; share-btn margin-left 6px→12px gap; stop-dur time pill audit — guide-style.css min to 69, toolbar.js min to 168, CACHE to v236. */
/* 2026-08-05: day-block padding 14/28/20 → 10/20/14 (smaller card) — guide-style.css min to 70, CACHE to v237. */
/* 2026-08-05: a:hover underline site-wide; remove scoped prose rule + check_pill_link_underline validator — web-travel-style.css min to 9, CACHE to v238. */
/* 2026-08-05: move .overview-extras + #ics-pill-row out of white card to beige background — toolbar.js min to 169, CACHE to v239. */
/* 2026-08-05: overview-extras gap 6→8px, margin-top 12→20px; ics-pill-row margin-bottom 10→14px — guide-style.css min to 71, CACHE to v240. */
/* 2026-08-05: guide a:hover underline; day-block background warm→white — guide-style.css min to 72, CACHE to v241. */
/* 2026-08-05: day-block revert warm-bg; tve-been terracotta pressed; overview-section bottom padding 16→8px — guide-style.css min to 73, CACHE to v242. */
/* 2026-08-05: overview-section padding revert 16px; fix overview-day:hover underline — guide-style.css min to 74, CACHE to v243. */
/* 2026-08-05: index.html changed after the v250 bump (Hiroshima listing) but shipped without a CACHE bump — returning visitors were served the stale cached index when clicking "The Voyager Expert" / All Guides. Bump CACHE to v251 to purge the stale index for all clients. */
/* 2026-08-05: action-pill row — remove font-weight (back to normal), I've Been button matches its siblings at rest/hover and its been-state uses var(--c-next-bg) bg with terracotta text+border — guide-style.css min to 80, CACHE to v252. */
/* 2026-08-05: I've Been been-state → font-weight 700 (terracotta bold), scoped to #tve-visited-btn.tve-been only; rest of the row unchanged — guide-style.css min to 81, CACHE to v253. */
/* 2026-08-05: I've Been been-state — restore collapsed left border so all four sides are uniformly terracotta (was showing the neighbour's faded gold on the shared edge) — guide-style.css min to 82, CACHE to v254. */
/* 2026-08-05: collapse/expand toggle (.overview-toggle-btn) — full-width bar → small right-aligned pill matching the action-pill look (bg, border, size, hover); ▲ Collapse / ▼ Expand — guide-style.css min to 83, CACHE to v255. */
/* 2026-08-05: Save-for-offline — label "Saved" → "✓ Saved for offline", saved state now mirrors I've Been (terracotta bold, uniform terracotta border via .tve-saved), plus a bottom-centre confirmation toast on save — toolbar.js min to 172, guide-style.css min to 84, CACHE to v256. */
/* 2026-08-05: collapse pill — centre it (was right-aligned) + bottom gap 8px→20px so Day 1 isn't crowding it — guide-style.css min to 85, CACHE to v257. */
/* 2026-08-05: section nav chips (row 2) font 13px→14px for readability, still under the 15px action row — guide-style.css min to 86, CACHE to v258. */
/* 2026-08-05: Save-for-offline is now a two-way toggle — a second click returns it from "✓ Saved for offline" to the resting "⏬ Save for offline" (mirrors I've Been); was previously one-way/stuck — toolbar.js min to 173, CACHE to v259. */
/* 2026-08-05: action toolbar — top gap from Trip Overview card 20px→36px so the pill band doesn't overshadow the itinerary; gap between the two pill rows stays 20px (they group as a controls unit) — guide-style.css min to 87, CACHE to v260. */
/* 2026-08-05: weather banner — recolour blue→warm to fit the palette (bg #e8f3fc→#f3efe6, border #c2d8ef→#e3dccd, hover #dcedf8→#ece5d6, active °C/°F toggle #5b8db8→#8a6c1a); icons/temps unchanged — toolbar.js min to 174, CACHE to v261. */
/* 2026-08-05: back-guides strip (Print Guide / Before You Go / All Guides) — add margin-bottom 12px so the guide title isn't jammed against it (was 0px gap) — toolbar.js min to 175, CACHE to v262. */
/* 2026-08-05: guide city title #3d3a32→#b85c2a terracotta (ties to the gradient underline + brand accent); country label stays dark; dark-mode override unchanged — guide-style.css min to 88, CACHE to v263. */
/* 2026-08-06: collapse pill symmetric 20px top+bottom margin; Save-for-Offline label capitalised (Save for Offline / Saved for Offline, preposition lowercase like Export to Calendar) — guide-style.css min to 89, toolbar.js min to 176, CACHE to v264. */
/* 2026-08-06: toolbar breathing room (owner-approved) — brand box 220px→184px, tb-inner padding-right 20px→6px, theme-toggle margin-left 12px→6px; reclaims ~56px so the 13 nav items go from 5px→~9px gaps. Matching brain_check guards updated. — toolbar.js min to 177, CACHE to v265. */
/* 2026-08-06: no-entries footnote — .tve-stamp-row padding-right:120px so the right-aligned footnote always ends before the fixed day-jump + scroll-top pills (was running under them at the page bottom) — guide-style.css min to 90, CACHE to v266. */
/* 2026-08-06: collapse pill margin 20px/20px → 32px top / 8px bottom so it sits closer to Day 1 and reads as the control for the day blocks (was ambiguous, floating between the nav pills and the days) — guide-style.css min to 91, CACHE to v267. */
/* 2026-08-06: stop content card inset 28px each side (desktop) so it reads as a card floating inside the beige day-block section (beige frames it left+right); title header stays full-width — guide-style.css min to 92, CACHE to v268. */
/* 2026-08-06: all extras sections + Claude Inspiration + Hotel Alternatives — inner white cards now inset to the same width as the stop card (48px section padding, desktop) so every section reads as a card-in-a-section, consistent with the stops — guide-style.css min to 93, CACHE to v269. */
/* 2026-08-06: uniform 16px title-to-content gap across all sections (was 12px most, 20px Tours) — guide-style.css min to 94, CACHE to v270. */
/* 2026-08-06: transit banner attaches to the stop ABOVE it — pulled up to 4px below the card (was 14px) vs 8px above the next stop, so it reads as departing the stop above — guide-style.css min to 95, CACHE to v271. */
/* 2026-08-06: stop title-to-content gap 10px→16px so it matches the extras sections' 16px — title-to-content spacing now uniform across every section (stops + extras) — guide-style.css min to 96, CACHE to v272. */
/* 2026-08-06: transit banner inset 28px each side to align with the inset stop cards (was full day-block width) so it sits in the same column as the card above — guide-style.css min to 97, CACHE to v273. */
/* 2026-08-06: extras section titles pulled back out of the inset (−28px) so only the content cards move inside, not the titles — now mirrors the stops exactly (title 52-1358 wider than the inset content 80-1330) — guide-style.css min to 98, CACHE to v274. */
/* 2026-08-06: mobile fixes — no-entries footnote: (1) the 120px pill-reservation padding is now desktop-only (was crushing the footnote on phones), (2) on mobile the footnote wraps to its own full-width left-aligned line below the stamp (was a 39px-wide/155px-tall sliver) — guide-style.css min to 99, CACHE to v275. */
/* 2026-08-06: back-to-guide pill now fires on Before-You-Go — owner wants "← Back to {City}" when arriving from a guide toolbar tap; removed Before-You-Go from the aggregator exclusion in injectBackToGuidePill + matching brain_check validator updated — toolbar.js min to 178, CACHE to v276. */
/* 2026-08-06: also-on-this-site + also-in-country mobile grid — switch to 6-col (span 2 = 1/3 each); orphan layout via JS _fixPillGridOrphans (inline gridColumn, bypasses iOS Safari :nth-child bug); all CSS :nth-child overrides removed — guide-style.css min to 100, toolbar.js min to 179, CACHE to v277. */
/* 2026-08-06: stop-dur chip — remove ⏱ icon prefix, plain duration text only — toolbar.js min to 180, CACHE to v278. */
/* 2026-08-06: mobile toolbar redesign — icon-only hamburger (no MENU/CLOSE text), dark-mode toggle moved to left, title absolutely centered — toolbar.js min to 181, CACHE to v279. */
/* 2026-08-06: mobile stamp-row stacked layout fix — margin -20px overlapped 16px mobile card gap; changed to -10px — guide-style.css min to 101, CACHE to v280. */
/* 2026-08-06: Currency-Guide jumpTo REGRESSED to location.hash=hash (reintroduced by the
   99f482b fleet regen after 14e67ca fixed it) — the iOS-Safari compositor-drop bug that
   makes the fixed "← Back to {City}" pill invisible on mobile, then float over the hamburger.
   Removed the hash assignment so Currency matches Plug + the other scroll-only jump pages.
   New brain_check.check_no_location_hash_in_jump_pages hard-fails on any future reintroduction.
   CACHE bump purges the stale Currency page HTML off devices. — CACHE to v281. */
/* 2026-08-06: THE REAL back-pill fix for Currency + Plug — the pill was invisible on iOS
   because these two are the only pill-pages whose incoming #Country deep-link matches an
   element id (<div class="country-block" id="France">), so iOS Safari does a NATIVE on-load
   fragment jump that drops the fixed pill's compositor layer. (The prior jumpTo/location.hash
   fix only covered the CLICK path, not the incoming deep-link — hence "no progress".) Both
   pages now strip the incoming #Country hash in a <head> script BEFORE the id block parses
   (history.replaceState), then re-scroll to the country via scrollIntoView on window load
   (Plug force-loads its ~580 lazy flags first so the target doesn't drift). No native fragment
   nav = pill survives on iOS. Matches how Safety/Time-Zones (no matching id) already worked.
   CACHE bump purges stale Currency/Plug HTML off devices. — CACHE to v282. */
/* 2026-08-06: bo-sort-select pill-ified — matched border-radius/font/background to .bo-chip so Sort dropdown no longer clashes with region chips. web-travel-style.css → v10. CACHE to v283. */
/* 2026-08-06: read-about back-strip pills — two fixes: (1) querySelector updated from .story-back (removed) to .story-footer-back so "‹ City" pill links correctly; (2) added white-space:nowrap + line-height:1 + box-sizing:border-box to pillStyle so text can't overflow fixed 28px pill height on mobile. Also overflow-x:auto on strip container. toolbar.js → v182. CACHE to v284. */
/* 2026-08-06: read-about story-footer Print button — stripped heavy pill styling (height:28px, border, padding, box-shadow) to match plain-text style of the flanking ← City link and label; font-size:13px, font-weight:500, no border/bg. toolbar.js → v183. CACHE to v285. */
/* 2026-08-07: lounge arrival chip — toolbar.js injects .lounge-arrival-chip at top of Day 1: teal banner with IATA + airport name → Lounges-US / Lounges-Europe / BYG#lounges based on which page covers that airport; CSS in guide-style.css. toolbar.js → v184, guide-style.css → v102. CACHE to v286. */
/* 2026-08-07: Photo lightbox — toolbar.js attaches click handlers to .stop-photos img on guide pages; opens fullscreen overlay with stop-name caption + ←→ day navigation; keyboard Escape/arrows; touch swipe on mobile. Zero guide HTML changes. toolbar.js → v185. CACHE to v287. */
/* 2026-08-07: Fix lounge arrival chip — TypeError crash in _inject() when toolbar-mount is already removed from DOM; explicit null-check on mountEl before reading .dataset.depth. toolbar.js → v190. CACHE to v292. */
/* 2026-08-07: Quick Facts strip — toolbar.js injects #tve-quick-facts above TRIP OVERVIEW on every guide: 🗣️ language · 💰 cost tier · 🔌 plug type · 🌤️ best months, read from the new assets/quick_facts.json (built by Brain/scripts/build/build_quick_facts.py, which joins Budget-Guide + Plug-Adapter-Guide + When-to-Go + climate.json per guide). Zero guide HTML changes. toolbar.js → v192. CACHE to v294. */
/* 2026-08-07: Copy Day as Text — toolbar.js injects a "Copy day" button into every .day-header on guide pages; writes the day to the clipboard as plain text (day label, From-Hotel line, then each stop with number, name, address and the transit hop to the next stop, ending in a #dayN deep link). Descriptions/hours/photos deliberately excluded — the paste target is Notes or WhatsApp. Own CSS injected from toolbar.js, so no guide-style.css dependency. Zero guide HTML changes. toolbar.js → v193. CACHE to v295. */
/* 2026-08-07: "Also a day trip from" row — toolbar.js injects #tve-also-day-trip-from at the foot of TRIP OVERVIEW on the 62 guides that other guides list as a train day trip ("Also a day trip from  Bologna / Pisa / Rome / Siena", each city linked). Reads the new assets/day_trip_from.json (reverse index emitted by Brain/scripts/build/build_day_trips.py from the same parse that builds Day-Trips.html). Self-contained variant — the CSS ships inside toolbar.js as <style id="tve-adtf-css">, using --c-text-muted / --c-index-accent with literal fallbacks so the row follows dark mode. Zero guide HTML changes. toolbar.js -> v194. CACHE to v296. */
/* 2026-08-07: ✨ Worth Knowing (was ✨ Claude Inspiration) — section title is now CSS-injected via #claude-inspiration .extras-title:empty::before so the heading always matches the Extras-row pill; each guide's own creative line moves into <p class="wk-headline"> as the first row of the white card. guide-style.css -> v104. CACHE to v297. */
/* 2026-08-07: Mark Stop circle — the unchecked circle was an empty ring (color:transparent) that gave no clue what it did, and the checked state only dimmed the header, which read as "disabled". Unchecked now carries a faint #c8baa8 ✓ so it reads as a tick-box; checked fills SOLID #b85c2a with a white ✓; hover tints the ✓ terracotta; toolbar.js sets a title/aria-label that flips between "Mark as visited" and "Visited — click to unmark". guide-style.css -> v105, toolbar.js -> v195. CACHE to v298. */
/* 2026-08-07: Mark Stop — checked state is now a "✓ Visited" pill, not a bare filled circle. The tooltip only reachable on desktop hover left mobile with no wording at all; the word now ships in the control itself once a stop is marked (::after on .stop-block.stop-done .stop-mark-btn; width:auto + 8px padding + 10px radius). Unchecked stays a compact circle — every stop carrying the word permanently would be noise. Verified at 393px and 1200px: no horizontal overflow, long stop names wrap cleanly. guide-style.css -> v106. CACHE to v299. */
/* 2026-08-07: Luggage Storage wired into the toolbar — new '🧳 Luggage Storage' child in the ✈️ Flights dropdown, directly after 🛄 Baggage (owner-approved). Filed with Baggage rather than 🚆 Trains: Trains is strictly rail-travel, while the page spans 71 cities across 5 regions, many with no station storage at all — Baggage is the real sibling (airline bag rules vs. on-the-ground bag storage). One ITEMS edit covers desktop chips + mobile hamburger. An earlier note in this file claimed min 196/CACHE v300; that bump was committed by a parallel crib (798d280e) BEFORE this toolbar.js edit landed, so the floor has to move again or browsers holding a cached v198 never receive the new entry — bumped toolbar.js min to 199, CACHE to v303. */
/* 2026-08-07: Scams & Tourist Traps wired into the toolbar — new '🕵️ Scams & Traps' child in the 🛡️ Safety dropdown, directly after 🛡️ Safety Guide (owner-approved 2026-08-07). Placed there because Safety-Guide gives a country's macro advisory level and this page gives the specific schemes at each city — the two are read together. 🕵️ picked from the Emoji Library (Detective) so the child does not repeat the group's own 🛡️. toolbar.js -> v197. CACHE to v301. */
/* 2026-08-07: Stop hours collapse — toolbar.js _upgradeStopHours() rewrites the authored 🏛 hours row on every stop whose listing has 2+ ' · '-separated segments: the authored row is hidden (.tve-ph-src) and replaced by a collapsed row naming today, expanding on hover (pointer devices) or tap/Enter/Space to a Mon–Sun grid with 24h badges. Single-segment listings are left exactly as authored. 'Today' resolves against the DESTINATION timezone via _tveDestNow(), never the reader's clock. 425 rows across 142 guides. Self-contained — CSS ships inside toolbar.js as <style id="tve-ph-css">. Zero guide HTML changes. This bump also releases the _syncFab and _injectCopyDayButtons fixes that shipped in the same window without one. toolbar.js -> v198. CACHE to v302. */
/* 2026-08-07: Cache-floor sweep — four shared assets had shipped changes that no returning browser or installed PWA could load, because their MIN_VERSIONS floor was never raised: guide-style.css (3 commits behind, newest 'Read more' chip fill), mobile.css (floor untouched since the 2026-08-03 fresh-history commit, newest the 7-item mobile-UX fix), web-travel-style.css (newest the dark-mode FAB token fix) and Read-About.css (floor untouched since 2026-08-03, newest the story-back header removal across 235 pages). Each was live for a first-time visitor and invisible to everyone else — the worst shape for a bug, since the person checking usually has the stale copy. Found by the new pre_push_guard cache-bump gate, added the same day after the stop-hours collapse shipped without a bump. guide-style.css -> v107, mobile.css -> v66, web-travel-style.css -> v11, Read-About.css -> v2. CACHE to v304. */
/* 2026-08-07: Mobile nav-pill pass — three toolbar.js changes ship under one floor. (1) Scroll-top FAB: _injectScrollFab() gated CREATION on a one-shot scrollHeight test at DOMContentLoaded, so pages that build their own body from JS were measured empty and never got a FAB at all — When-to-Go (852px at DCL vs 26,785px final, 31 screens), Climate-Finder (1,005 vs 14,066) and Budget-Guide (852 vs 6,344), plus Before-You-Go and Sports-Calendar once a search renders. The button is now always created and the "> 1.5x viewport" rule is evaluated per scroll/resize. (2) Best-Of country pill: fixed "🌍 N countries" bottom-right on mobile, opening the same country list as the page's #regionJump dropdown, which is position:relative and gone after one swipe on pages up to 96 screens tall; rows forward to .click() on the hidden dropdown item so no filter logic is duplicated. (3) Map pages: fixed "← All Guides" bottom-left on World-Map and the seven region maps, making visible the destination that was previously only reachable through toggleHamMenu()'s undiscoverable close-tap branch. toolbar.js -> v200. CACHE to v305. */
/* 2026-08-07: Mark Stop — control MOVED from the right rail to directly after .stop-name, so it reads as part of the title (toolbar.js inserts it after the name; the name drops to flex:0 1 auto and the button carries margin-right:auto as the row's only spacer, with .stop-mark-btn ~ .stop-dur pinned to a fixed 8px so "Visited" never touches the chip on a full row). Checked state is no longer a solid terracotta pill — the ring is REPLACED by the plain word "Visited" in #6a6660, the same grey as the NOT REQUIRED badge on Visa-Processing-Times (--muted; literal here because guides do not load web-travel-style.css); dark mode #9a9690. font-size:0 on the element hides the ✓ text node and ::after restores the label, so the swap needs no extra element. Verified at 393px and 1200px: no overflow, row height stable across both states, toggle + localStorage round-trip intact. guide-style.css -> v108, toolbar.js -> v201. CACHE to v306. */
/* 2026-08-07: Mark Stop — BOTH states now wear the .stop-dur chip treatment so a stop header reads as one uniform line. Unchecked: the #c8baa8-on-transparent ring was barely visible against the page — now --c-next-bg fill, 1px --c-next-border hairline, --c-action-text checkmark (still a 20px circle). Checked: the plain grey word is now the full chip — same fill, hairline, ink, 20px radius, 12px/700 — computed-style verified identical to the neighbouring duration chip at both 393px and 1200px. All token-based, so the dark-mode override on .stop-mark-btn is gone (the tokens are already themed). guide-style.css -> v109. CACHE to v307. */
/* 2026-08-07: 📖 Read more chip — font-weight 500 -> 700. Owner reported the chip's font "not matching" the NOT REQUIRED pill on Visa-Processing-Times and asked for the colour code to be copied. A computed-style diff of both elements showed all three colours were ALREADY byte-identical (text #6a6660, fill rgba(138,108,26,0.07), border rgba(106,102,96,0.4)) — the mismatch was weight, not colour: the pill inks at 700, the chip at 500, and thinner strokes in the same hex read as a paler grey. Only the weight moved; 14px and sentence case stay, since the pill's own 11px UPPERCASE would turn the label into "READ MORE" and break the approved Option E mockup. guide-style.css -> v110. CACHE to v308. */
/* 2026-08-07: Stop hours — single-segment listings now get the flat styled row too (🕐 Daily · 9:00am – 5:00pm / 🕐 Open 24h · every day), not just varied schedules. The first cut left uniform listings exactly as authored, which meant the feature was invisible on the 93 guides whose every stop is 'Daily 9-5' or 'Open 24/7' — Big-Island has 16 hours rows and not one of them is varied, so the guide looked completely unchanged. No chevron on these: there is nothing to expand. Coverage 142 -> 235 guides, 425 -> 3,486 rows. toolbar.js -> v202. CACHE to v309. */
/* 2026-08-07: 🕵️ Scams & Traps moved to the bottom of the 🛡️ Safety dropdown (was second, right under Safety Guide). Owner request. One nav array feeds both the desktop flyout and the mobile hamburger, so the order moves on both surfaces in a single edit. toolbar.js -> v203. CACHE to v310. */
/* 2026-08-07: Dark mode — four un-themed components, all the same root cause: a hardcoded light hex that never flipped. (1) --c-brand had no dark value, so the guide's primary accent (TRIP OVERVIEW, day headers, section titles, section left-borders, focus rings) stayed #8a6c1a at 2.97:1 on the dark card — now #c8a060, the gold the pills use, at 6.1:1; it is only ever a foreground, never a fill, so the flip is safe everywhere. (2) The global `a, a:visited` rule hardcoded #2867c4, so --c-link's dark value #5a9aee reached nothing and body links sat at 2.68:1 — now var(--c-link), same hex in light, and validate_itinerary's CANONICAL_LINK_BLUE check still passes because it resolves var() against the light :root. (3) The mobile hotel card pinned color:#8a6c1a !important, which beat the dark #ccc8c0 override — now var(--c-pill-text). (4) New --c-navbtn-bd / --c-navbtn-text for the prev/next chevrons, which rendered as white boxes. Sydney measures clean in dark via the new validate_dark_mode.py; light mode verified byte-identical by rendering both schemes before/after and diffing computed styles. guide-style.css -> v111, web-travel-style.css -> v12. CACHE to v311. */
/* 2026-08-08: Open-right-now row — the "🕐 {City} · {time}" label now inks exactly like the "Open right now" pill beside it. It was the row's only un-matched element: --c-text-muted (#555) at the default weight 400, against the pill's --c-action-text (#5a3c0e) at 600, so on the warm card it read as a faint caption rather than the pill's counterpart — owner reported it as barely visible. Label picks up font-weight 600, color var(--c-action-text) and letter-spacing 0.01em; 12px and tabular-nums were already shared. Computed styles on Melbourne now diff clean across all four properties. Dark mode needs no override — --c-action-text already flips to #c8a060. guide-style.css -> v112. CACHE to v312. */
/* 2026-08-08: "📖 Read more" chip recoloured onto the duration pill. It carried the GREY badge recipe (rgba(138,108,26,.07) fill, rgba(106,102,96,.4) border, #6a6660 ink) while the "~45 min" .stop-dur chip a few pixels above it is built from --c-next-bg / --c-next-border / --c-action-text — two different families sitting in the same stop, which is what the owner saw as a colour mismatch. The chip now uses those three tokens verbatim rather than hand-matched hexes, so the dark block themes both together and the separate dark fill/border/ink override for the Wikipedia anchor is gone (its hover terracotta stays). Shape untouched: 4px radius, 14px, sentence case, weight 700. guide-style.css -> v115. CACHE to v315. */
/* 2026-08-08: Stop-type comments in guide-style.css purged of the retired backpack (U+1F392). The glyph was retired from guide titles 2026-06-16 and is hard-failed in guide HTML, but four comments in guide-style.css still presented it as the current icon for .stop-name.self - directly above the rule that renders no icon at all. Agents read the comment, trusted it over the code, and kept re-adding the backpack to mockups; the owner rejected it repeatedly. Comments now state the truth and spell the character as "the backpack (U+1F392)" instead of printing it, so brain_check.check_no_backpack_in_shared_assets can ban the glyph outright from Travel-Website/assets/ CSS+JS. Comment-only change - no rendered byte differs - but the asset hash moves, so the floor moves with it. guide-style.css -> v118. CACHE to v318. */
/* 2026-08-08: Stop card - the description keeps the white block, everything below it goes onto the report panel. The Read more row, the booking box and the photo strip now share #f1ece3 with a #e4ddd0 hairline at the white->panel join, so the panel runs to the bottom of the card and wraps the photo on all four sides; the card seals on the panel instead of on white. The tone is copied verbatim from Travel-Website/Reports/Reports.html (--surface2 / --line, line 9; .tbody, line 65) rather than hand-mixed, and the dark twins use that same file's dark tokens (#2a251d / #38322a / #221e18). The prose row regains 14px of bottom padding (it was zeroed against the Read more row) and the booking box takes 10px of top padding so neither sits flush on a colour boundary. The Read more chip keeps the duration-pill border and ink; only its fill moved to #fffdf9, the report's --surface, because #f5f0e6 on #f1ece3 is a two-value difference and the chip had lost its ground. guide-style.css -> v119. CACHE to v319. */
/* 2026-08-08: Free-entry row — 🆓 retired fleet-wide (owner rule 2026-08-08). The row was `<div>🆓 Free</div>`; it is now `<div><span class="free-flag">Free</span></div>`, with a torn-ticket-stub icon drawn by .free-flag::before in guide-style.css. Two reasons: 🆓 is Latin text inside a blue-grey iOS badge that ignores CSS color — the same defect that retired the up-right arrow site-wide (CLAUDE.md sixth non-negotiable) — and it was the only non-pictogram in an icon row of pictograms (🏛️ ⏰ 🚫 📍 💵). The mark is a CSS mask, so it takes the guide accent as a background-color and retints to #d4874a in dark mode like every other guide foreground; the artwork lives in exactly one place, so a future swap is a one-line change. The label stays the single word "Free" and inks the same terracotta as the stub, so icon and word read as one mark rather than a glyph with a grey caption beside it. 505 rows across 152 guides + the guide_tools.py stub. validate_itinerary.py hard-fails on any surviving literal 🆓 and on any .free-flag row whose text is not exactly "Free", then normalises the row back to the legacy token in memory so the ~30 downstream position-5a checks keep matching one canonical form. guide-style.css -> v121. CACHE to v321. */
/* 2026-08-08: Destination-clock label in the open-right-now row — `.open-now-local-time` was bare text ("🕐 Melbourne · 5:51 PM") sitting beside the "Open right now" pill, so the row read as a caption plus a control rather than as a pair. It now takes the Quick Facts chip shell verbatim (5px 10px padding, 6px radius, --c-warm-bg on a --c-index-border hairline, 12px/500, --c-text-primary): a beige rectangle pill, the same one the 🌤️ best-months chip uses directly above the card. Weight drops 600 → 500 and the ink moves off --c-action-text because the label is now a surface, not ink on the card — matching the pill it copies matters more than matching the toggle beside it, which is deliberately heavier since it is interactive. tabular-nums stays so the minute digit does not shift the pill width once a second. A `:empty` rule drops the shell entirely on guides with no timezone, where toolbar.js writes an empty string. `.open-now-row` padding goes 9/16/11 -> 22/16/12: the row is the last thing inside the TRIP OVERVIEW card, and once the label became a pill the two pills sat pinned under the gold divider with the whole card's bottom margin below them; the deeper top side seats the pair against the card's bottom edge instead. guide-style.css -> v121. CACHE to v321. */
/* 2026-08-07: Stop hours — palette swapped onto the site's own warm tokens. The rows shipped green (#2d6a4f) and blue (#2980b9), which exist nowhere else in the guide palette: --c-warm-bg #fdf8f0 is "the single shared background — all section cards, boxes, banners", #b85c2a is the brand terracotta, and --c-next-bg/--c-next-border (#f5f0e6/#bba070) is the one other warm tone in use. Now terracotta rail = a specific schedule, tan-gold rail = open around the clock; today's row is a warm terracotta wash (#f3e3d7) instead of mint. Dark mode uses the palette's own warm gold #c8a060, honouring its token note that it is only ever a foreground, never a fill. toolbar.js -> v206. CACHE to v322. */
/* 2026-08-08: Booking row — 🎟️ retired (owner rule 2026-08-08), the solid twin of the .free-flag change above. The row was `<div>🎟️ <a>{domain}</a></div>`; it is now `<div><span class="ticket-flag"></span><a>{domain}</a></div>` — the symbol and the link, nothing else. Same reason as 🆓: the Apple glyph is a fixed-colour platform drawing that ignores CSS and cannot flip for dark mode. Deliberately the SAME silhouette as the Free stub, just filled: a whole ticket means one is required, a torn hollow stub means none is, and the only difference between the two rows is weight. 1375 rows across 210 guides. Scope is the row lead only — 🎟 survives in day titles and prose, so the new hard-fail is anchored on a div-leading glyph, and the row is normalised back to the legacy token in memory so every position-1 check keeps matching one canonical form. guide-style.css -> v123. CACHE to v324. */
/* 2026-08-08: Stop panel recoloured onto --c-next-bg. The panel structure came from the Open-Recommendations report card body, and its #f1ece3 was copied verbatim - but that hex was picked for a small tile framed in white, and once it filled two thirds of every stop card it read flat and grey rather than warm. Owner picked #f5f0e6 instead: --c-next-bg, the guide's own token, already the fill of the .stop-dur duration chip and the transit banners, so the panel belongs to the guide palette rather than importing the report's. Using the token rather than the hex also retires the hardcoded dark overrides - --c-next-bg is themed to #222120 above, so only the hairline literal and the chip fill still need a dark twin. guide-style.css -> v124. CACHE to v325. */
/* 2026-08-08: Free row — the word "Free" goes bold (owner rule 2026-08-08). It already inked terracotta to match the torn-stub mark, but at weight 400 the label still read lighter than the full-colour emoji rows bracketing it (🚫 Closed Monday above, 📍 address below), so the pairing landed as icon-plus-caption rather than one mark. Weight 700 on .free-flag closes it. Colour and the dark-mode #d4874a retint are unchanged. guide-style.css -> v125. CACHE to v326. */
/* 2026-08-08: Comment-only correction on the Read more chip. Its note still explained the #fffdf9 fill as "--c-next-bg against #f1ece3 is a two-value difference" - true when the panel was the report's #f1ece3, false the moment the panel moved onto --c-next-bg itself. The reason is now stated correctly: the chip sits ON the panel, the panel IS --c-next-bg, so a --c-next-bg fill would be no chip at all; #fffdf9 is what lifts it off. Same drift class as the retired-backpack comments purged earlier today - a comment that contradicts the code beside it is what feeds wrong values back into the next change. guide-style.css -> v126. CACHE to v327. */
/* 2026-08-07: Stop hours — row spacing normalised. .tour-box/.ticket-box give every direct child margin-top:6px and the hours row added 6px of its own vertical padding on top, so its text sat 12px from the next row's while every other pair in the card sat at 6px. Outer margins now 0 and the following sibling's margin-top cancelled, so the padding provides the spacing and text-to-text rhythm is a uniform 6px. Verified on Melbourne, Boston, Rome, Big-Island. toolbar.js -> v208. CACHE to v328. */
/* 2026-08-08: HOTEL_ALT_DATA['maui'] — added Grand Wailea and Fairmont Kea Lani as runner-up hotels, added Booking.com url field to all 4 Maui entries. toolbar.js -> v209. CACHE to v329. */
/* 2026-08-07: Stop hours — one band per STOP, not per authored row, and the row now sits on the card's own rhythm. Carmel Mission ships "Mon-Sat 9:30am - 5:00pm" and "Sun 10:30am - 5:00pm" as two separate 🏛️ rows; that is one weekly schedule split over two lines, and emitting a band each stacked two near-identical strips with a gap between them. All 🏛️ rows in a card are now parsed together into one week and rendered as a single row — which also removes any band-to-band gap to tune. Spacing: the card gives every child margin-top:6px and the band added 6px of its own padding, so it sat 14px below the card's top edge where a plain first row sits at 8px; the margin is dropped (scoped to the card to beat .tour-box > div on specificity) so edges align and internal text-to-text is 6px throughout. Chevron goes from an 11px inline glyph to a 22px round terracotta chip so it reads as a control and has a real tap target. toolbar.js -> v211. CACHE to v332. */
var CACHE = 'travel-cache-v332';

/* Minimum asset versions — any request with a lower v= is rewritten to this version
   so the browser is forced to fetch fresh content even when it has an older copy
   aggressively cached under the old URL.
   THIS IS THE ONLY PLACE to bump toolbar.js / guide-style.css versions.
   NEVER bump ?v= inside guide HTML — it breaks HMAC stamps and forces re-validation
   of 230+ guides. Instead, bump MIN_VERSIONS here + increment the CACHE version. */
var MIN_VERSIONS = { 'guide-style.css': 128, 'toolbar.js': 211, 'mobile.css': 66, 'web-travel-style.css': 12, 'Read-About.css': 2, 'best-of-features.js': 1 };

function rewriteAssetUrl(urlStr) {
  var u;
  try { u = new URL(urlStr); } catch (_) { return urlStr; }
  for (var asset in MIN_VERSIONS) {
    if (u.pathname.slice(-asset.length - 1) === '/' + asset) {
      var m = u.search.match(/[?&]v=(\d+)/);
      var ver = m ? parseInt(m[1], 10) : 0;
      if (ver < MIN_VERSIONS[asset]) {
        u.search = '?v=' + MIN_VERSIONS[asset];
        return u.toString();
      }
      break;
    }
  }
  return urlStr;
}

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;

  /* Rewrite stale asset version URLs so iOS HTTP cache is bypassed */
  var rewrittenUrl = rewriteAssetUrl(req.url);
  var fetchReq = (rewrittenUrl !== req.url)
    ? new Request(rewrittenUrl, { cache: 'reload' })
    : req;

  // Network-first: try the network, cache the fresh copy, and only fall back to
  // the cache when the network fails (offline). Navigations fall back to the
  // Guides index when the exact page isn't cached.
  e.respondWith(
    fetch(fetchReq).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(fetchReq, copy); });
      return res;
    }).catch(function () {
      return caches.match(fetchReq).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    })
  );
});
