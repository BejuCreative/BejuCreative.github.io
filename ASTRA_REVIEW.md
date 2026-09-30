# Astra website refinement

Branch: `polish/astra`, based on Claude's completed `polish/flagship` at `c3fb516`.
Latest: `polish/bold` (round 3, below) is based on `polish/astra`.
Preview: http://localhost:8767/

## Round 3 — Claude: bold key moments (branch `polish/bold`, 2026-09-30)

Based on `polish/astra` at `fdc90d7`; commit `b9e48da`. Benas's choices: bold key moments,
keep the phone hero but make it premium, one signature moment (a scroll showcase), stay around
Lighthouse 95+ with one standout effect allowed.

**What changed**
- **Premium hero phone:** side buttons, a warm rim catching the gold light, a gold floor glow and
  one glare sweep across the glass after load. The permanent ↗ icon that sat on the footage (and
  overlapped the screen on phones) is replaced by a play disc that appears on hover/focus. Phones:
  the pause control is a 44px icon on the device corner, a small "Watch" label sits on the screen,
  and the two hero buttons share the dock (no empty glass strip at tablet width).
- **Scroll showcase** at the top of Our work: a deck of five reels fans out as you scroll; three
  claims light up in turn and the matching reel lifts into focus and plays. Native scrolling (no
  scroll-jacking), one reel decoding at a time, paused by the preview preference, hidden tabs and
  the player. With reduced motion (or without JS) it is a still, already-open fan.
- The gallery caption and arrows now sit under the showcase, above the filters (text unchanged).
- The nav chapter highlight clears in sections that aren't nav chapters (it used to stay on the
  last chapter while reading e.g. Services).
- This supersedes Astra's "no scroll pinning" rule for this one section only (owner's choice).

**Bugs caught and fixed while building it**
- The showcase's scroll track sat over the gallery and swallowed clicks on the filters and arrows
  (found because Astra's test hung). Only the copy and the reels take clicks now.
- The fanned cards overlapped as click targets (Lighthouse accessibility 97). Only the reel in
  focus is a target now; the others are inert and every clip is still in the gallery below.

**Copy changes**
- New showcase lines: "Hooks that stop the scroll." · "Captions people actually read." ·
  "Cut for retention, not just views." (the last is the phrase from the original hero intro).
- New on phones/tablets: a "Watch" label on the hero phone (the button's name is unchanged).
- Hero pause control on phones is icon-only; its accessible name ("Pause previews"/"Play previews")
  is unchanged. Showcase cards reuse the existing clip titles and chips. Nothing else changed:
  prices, claims, guarantee, testimonials, client names, form mapping and SEO metadata are intact.

**Verification (local lab, GitHub-Pages simulation)**
- Lighthouse: all six indexable pages **100 / 100 / 100 / 100** on mobile and desktop; homepage
  mobile LCP **1.73 s** (same as Astra's pass), **0** layout shift, **0 ms** blocking time.
  Welcome and 404 stay lower on SEO only because they are `noindex` on purpose.
- Full capture: 8 pages × 10 widths (320–2560) × Chrome + WebKit = **160 runs, 0 issues**
  (overflow, headline widows and split words, console errors, 404s, touch targets, labels,
  duplicate IDs, dead anchors, line length, row alignment, font weights).
  Screenshots: `~/Desktop/BEJU redesign screenshots/bold/` (full-page shots show the showcase in its
  still, open state; the pinned animation can only be seen live).
- New showcase suite `showcase-check.cjs`: **99/99** in Chrome, WebKit and Firefox (desktop, phone,
  reduced motion): opening, beats, one playing reel, player with sound, pause preference,
  clickable gallery underneath, gap under the fan, inert targets, keyboard focus kept while scrolling.
- Astra's suite `astra-check.cjs`: passes in all three engines. Functional suite: **129/129**.
  `check-seo.mjs`, `node --check site.js` and `git diff --check` pass.

**Still needs Benas**: visual approval (especially the showcase, live), a real-iPhone check,
launch-film terms review, and explicit approval before anything is merged or published.

## Direction

Benas’s final direction on 2026-09-30: deep ambient olive-green fades and rich
metallic gold based on Claude’s final `c3fb516` palette, with subtler gradients.
Keep the new layout, filters and animations. The graphite/champagne proposal and
brief lime-green experiment are superseded. This colour revision changes no copy.

## What changed

- Deep olive canvas and tinted glass across all eight pages; metallic gold actions,
  warm-silver typography and olive titanium edging. Theme colour matches the canvas.
- Larger hero typography, shorter introduction and a framed showreel that opens in the
  full-screen player. Desktop pointer tilt and scroll drift give the film depth.
- Portfolio filters for podcasts, brands and ads, with result counts, a gallery progress
  track, animated changes, and lightbox navigation restricted to the selected category.
- Pause/play controls for inline previews, including service-page media. The preference
  lasts for the browser session. Background tabs, off-screen media and open lightboxes
  pause the previews. Reduced-motion visitors start with still images.
- Launch feature gently expands into view on desktop; touch scrolling stays native.
- Numbered service cards, quieter process steps, staggered mobile menu links, active
  navigation chapters and a moving selection pill in the pricing switch.
- Space is reserved for the new controls to prevent a shift when JavaScript loads.
- Animated headings keep spaces at visual line breaks in their accessible names.

No added web fonts, motion dependencies, images or video encodes. Existing footage,
offers, prices, guarantee, testimonials, SEO metadata and form mappings are preserved.

## Copy changes

Latest hero refinement (owner-approved 2026-09-30):

- Hero paragraph: “Your footage. A sharper story. Short-form edits built to hold
  attention, and launch films for SaaS and apps.” → “Your footage, turned into
  short-form stories worth watching.” Launch services remain in the main nav and section.
- Video subtitle: “BEJÚ showreel · Tap to play” → “Watch the showreel”.
- Removed decorative “BEJÚ / In the frame”, “01”, and the repeated lower service list.
- Original H1 wording, offer, buttons, reassurance, guarantee and all prices unchanged.

The table below records the earlier layout pass:

| Location | Previous | Current |
|---|---|---|
| Hero introduction | BEJÚ Creative edits short-form video for podcasters, coaches and founders — cut for retention, not just views. We also make launch videos for SaaS, apps and product launches. | Your footage. A sharper story. Short-form edits built to hold attention, and launch films for SaaS and apps. |
| Work heading | The clips / never stop | Made to be / watched. |
| Hero media framing | None | BEJÚ / In the frame; 01; The Edit Effect; BEJÚ showreel · Tap to play |
| Hero lower navigation | None | Short-form · Podcasts · Product films; Explore the work |
| Gallery filtering | None | All work; Podcasts; Brands; Ads; [count] selected film(s) · Drag to explore |
| Preview controls | None | Pause previews / Play previews |
| Service card markers | None | 01–04, decorative sequence markers |
| Hero player accessible name | None | Watch The Edit Effect — BEJÚ showreel |

## Verification

- Latest glass/hero pass: **129/129** functional checks pass; focused nav-marker,
  filters, media and reduced-motion checks pass in Chrome, WebKit and Firefox.
  **20 homepage captures** across 320–2560px in Chrome/WebKit report no overflow,
  headline widows, small touch targets or console errors. Desktop and phone heroes
  were visually reviewed. Fresh Lighthouse: homepage mobile and desktop plus podcast
  service mobile all score **100/100/100/100**, with **0 layout shift**. Homepage
  mobile LCP is **1.73s**. These are local lab results, not production field data.
- Olive-and-gold revision: interaction checks pass in Chrome, WebKit and Firefox;
  SEO validation passes; fresh mobile Lighthouse accessibility is 100, including contrast.
  The full performance/layout results below describe the preceding layout pass.
- Existing functional suite: **129/129 pass** across Chrome, WebKit and Firefox.
  Form submissions were intercepted; no test lead was submitted to Google Forms.
- New interaction suite: passes in all three engines. Covers filters, filtered lightbox
  order, hero playback, persisted pause/resume, pointer tilt and reduced motion.
- Homepage captures: 20 engine/viewport combinations from 320 to 2560px, no horizontal
  overflow, headline widows, missing labels, duplicate IDs or dead anchors reported.
- SEO validator and JavaScript syntax check pass.
- All eight pages checked at five widths in Chrome and WebKit: **80/80** checks pass,
  including reduced motion and horizontal overflow checks. Desktop and mobile captures
  were reviewed, including the hero, work gallery, launch feature, services and pricing.
- Lighthouse on all six indexable pages, mobile and desktop: **100 performance,
  100 accessibility, 100 best practices, 100 SEO**. Homepage mobile: **1.73s LCP,
  0 layout shift, 0ms total blocking time** after reserving preview-control space.
  These are local lab results using the GitHub Pages simulation, not production field data.
- Welcome and 404 also score 100 in the first three categories; their SEO scores are
  intentionally lower because both stay `noindex`.

Artifacts: `~/Desktop/BEJU redesign screenshots/astra/`,
`~/Desktop/BEJU redesign screenshots/astra-review/`, and
`~/Documents/beju-flagship-tools/lighthouse-astra/`.
Reusable tests: `astra-check.cjs` and `astra-review.cjs` in the same tools folder.

## Review before publishing

Open the preview on desktop and a real iPhone. The site's existing legal coverage for
launch videos still needs the owner's review. The branch is local and ready for visual
review; publication remains a separate decision, as requested in the handoff.
