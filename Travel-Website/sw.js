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
   2026-08-04: Individual entry boxes site-wide — removed continuous-run merge, fit-content(720px) grid, tour/ticket-box width fit-content, internal stop spacing, day-header 1px border, chevron color, entry-body row gap. guide-style.css min to 54, CACHE to v215. */
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
var CACHE = 'travel-cache-v244';

/* Minimum asset versions — any request with a lower v= is rewritten to this version
   so the browser is forced to fetch fresh content even when it has an older copy
   aggressively cached under the old URL.
   THIS IS THE ONLY PLACE to bump toolbar.js / guide-style.css versions.
   NEVER bump ?v= inside guide HTML — it breaks HMAC stamps and forces re-validation
   of 230+ guides. Instead, bump MIN_VERSIONS here + increment the CACHE version. */
var MIN_VERSIONS = { 'guide-style.css': 75, 'toolbar.js': 169, 'mobile.css': 65, 'web-travel-style.css': 9, 'Read-About.css': 1, 'best-of-features.js': 1 };

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
