# Astra website refinement

Branch: `polish/astra`, based on Claude's completed `polish/flagship` at `c3fb516`.
Preview: http://localhost:8767/

## Direction

Graphite and soft champagne, with a larger editorial opening and a framed film.
The visual priorities are the work, a clear invitation to start, and quiet interaction.
Three guidance questions were sent about colour, motion and conversion priorities;
the recommended choices were used while answers were pending.

## What changed

- Neutral graphite canvas and glass across all eight pages; quieter champagne actions,
  silver typography and titanium media edging. Browser theme colour matches the canvas.
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
