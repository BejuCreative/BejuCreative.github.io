# Astra website refinement

Branch: `polish/astra`, based on Claude's completed `polish/flagship` at `c3fb516`.
Preview: http://localhost:8767/

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
