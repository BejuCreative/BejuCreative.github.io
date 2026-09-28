# Flagship audit — bejucreative.digital (before)

Brief: `~/Desktop/BEJU-website-overhaul-prompt.md` §1. Audited 2026-09-29 on branch `polish/flagship`
(identical to live `main` @ 10daf92).

**Method.** Every page (home, 3 service pages, welcome, terms, 404) at **320 · 360 · 390 · 430 · 768 · 1024 ·
1280 · 1440 · 1920 px**, in **Chromium (Chrome) and WebKit (Safari engine)**, full-page + above-the-fold:
252 screenshots in `~/Desktop/BEJU redesign screenshots/before-flagship/` named
`<page>_<width>_<engine>_<fold|full>.jpg` (tall phone pages are split `full-1/2/3`). Each run also *measured*
overflow culprits, headline widows (last rendered line = one word), left edges, section padding, font weights,
radii, tap targets, line length, card-row heights, console messages and HTTP errors
(`~/Documents/beju-flagship-tools/before-metrics.json`). Lighthouse mobile + desktop for every page below.

**Severity.** P0 broken · P1 visibly off / fails a brief rule · P2 polish.
Screenshot refs are relative to `before-flagship/`.

## Summary

- **No P0.** Nothing is broken for visitors; no horizontal overflow anywhere from 320 to 1920 in either engine,
  no 404s except one self-inflicted probe, section padding already consistent (144 px desktop).
- The gaps are **composition and craft**: the homepage is a stack of "kicker + H2 + card grid" sections, the
  service pages look like a cheaper sibling, motion doesn't follow the brief's rules, and the SaaS launch
  service doesn't exist on the site yet.

## P1 — visibly off / fails a brief rule

| # | Page | Width | Issue | Ref |
|---|---|---|---|---|
| 1 | home | all | **Console error + 404 on every load**: the `work/02.mp4` slot probe. Brief: zero console errors, zero 404s. | any `home_*` (console in metrics) |
| 2 | home | 320 | Fold cuts the "See our work" button in half. | `home_320_chromium_fold.jpg` |
| 3 | home | 360 · 390 · 430 · 768 | Hero phone mockup is cut mid-frame by the fold (brief names 390×844 and 430×932). | `home_390_chromium_fold.jpg`, `home_768_chromium_fold.jpg` |
| 4 | home | 768 | Services cards wrap **2 + 1** (orphan card). | `home_768_chromium_full.jpg` |
| 5 | welcome | 768 · 1024–1920 | Steps and channels wrap 2 + 1 at 768; the four "facts" wrap **3 + 1 at every desktop width**. | `welcome_1440_chromium_full.jpg` |
| 6 | several | see list | **Headline widows** (one word alone on the last line): home H1 "…& / founders" @320, 1024 · short-form H1 "…/ Services" @320 · podcast H2 "…/ questions" @320 · 6 service-page FAQ questions @320–390 · welcome H2 "Keep the clips / coming" @**all widths** · welcome H1 "…/ seen." @320–390 (Chrome only; Safari balances it). "Get / seen." and "Simple, / volume-based" are deliberate two-line stacks, not widows. | `home_1024_chromium_fold.jpg`, `welcome_1440_chromium_full.jpg`, `coaches_390_chromium_full-*.jpg` |
| 7 | home | ≥ 1024 | **Left edges off-grid**: every section starts at x = 128 (1440) but the mission and FAQ columns start at 352. | `home_1440_chromium_full.jpg` |
| 8 | service pages | all | Look like a different site: text wordmark instead of the BC mark, different nav (Our work / Packages / Start a project), header and content columns don't align (x 153 vs 234 @1440), header becomes a 2-row capsule on phones. | `podcast_1440_chromium_fold.jpg`, `podcast_390_chromium_fold.jpg` |
| 9 | all | all | **Weight 500** on every nav link, the apply e-mail link, welcome "Need help?" and terms "Back" link. Ladder must be 400/600/700. | metrics `weight500` |
| 10 | home | ≥ 1024 | Nav links are **42 px** tall (< 44 px target). | metrics `smallTargets` |
| 11 | home | all | **Hero text and buttons are invisible until GSAP downloads** from cdnjs (`.rv{opacity:0}`) — the hero does not render instantly; first paint waits on a third-party script. | code: `index.html` `.rv`, `gsap.fromTo('.hero .rv')` |
| 12 | home | desktop | Magnetic effect on **every** button, pull up to ~28 px, and an `elastic.out` **bounce** on release. Brief: primary CTA only, ≤ 6 px, nothing bounces. | code: "Magnetic buttons" |
| 13 | home | all | Motion doesn't follow the brief: reveals travel 34 px over 0.95 s (brief 12–24 px, tokens `--dur-*`/`--ease-*` missing), no stagger between siblings, headings don't line-reveal (except the hero), and a `setInterval` polls every `.rv` element every 900 ms. | code |
| 14 | home | all | Nav doesn't hide on scroll-down / return on scroll-up; mobile menu has no focus trap, no Esc to close, no `aria-expanded`. | code |
| 15 | home | all | Work videos: no click → full-screen player, no keyboard/swipe; 12 `<video>` elements have **no accessible label**; no drag momentum on the rail. | metrics `videoNoLabel` |
| 16 | all | all | **SaaS & app launch videos are not mentioned anywhere** (hero, services, nav, footer, FAQ) and the 3 launch clips aren't on the site. | — |
| 17 | home | all | The "apply" flow is only `mailto:` links — no form, no success/error state (approved: small form → Google Form). | — |
| 18 | all | all | **Radius grammar**: home uses 10 / 14 / 20 / 28 / 40 / 48 / 50% / 999, service pages add 4 px — approved grammar is 8 / 18 / pill (+ one large). | metrics `radii` |
| 19 | home | ≥ 1024 | Nav has 5 links (brief: 3–4) and no Launches link. | `home_1440_chromium_fold.jpg` |
| 20 | home | all | Guarantee copy says "no questions" / "No questions" but `terms.html` §5 has conditions (post the clip, platform view data, claim within 35 days). | `home_1440_chromium_full.jpg` |
| 21 | welcome | all | Promises "We'll email you a link to your own private upload folder" — that system isn't built. | `welcome_390_chromium_fold.jpg` |
| 22 | home | all | **Template stacking**: 11 of 13 sections are the same composition (kicker + H2 + grid of equal cards), one padding value everywhere, and three sections make overlapping points ("So what's the ROI", "The numbers don't lie", "Good ideas shouldn't lose…"). See merge proposal. | `home_1440_chromium_full.jpg` |

## P2 — polish

| # | Page | Width | Issue | Ref |
|---|---|---|---|---|
| 23 | home | 1920 | Hero reads as a small island in a lot of dark space (type and phone cap too early). | `home_1920_chromium_fold.jpg` |
| 24 | home | all | The "Scroll" cue animates forever; the marquee ticker loops forever (continuous motion + a template tell). | `home_1440_chromium_fold.jpg` |
| 25 | home | 320–430 | When the gold kicker (the H1) wraps to 2–3 lines its rule floats at the vertical middle instead of the first line. | `home_320_chromium_fold.jpg` |
| 26 | home | all | 11 prices/stats don't use tabular figures (count-ups jitter in width). | metrics `nonTabularNumbers` |
| 27 | home | all | Carousel arrows are text glyphs "← →" rendered in **Arial** (buttons don't inherit the font); no icon family. | metrics `fontFamilies` |
| 28 | all | — | `og-image.jpg` is pre-redesign (flat yellow, uppercase, no launch videos). | `og-image.jpg` |
| 29 | terms | all | Brand spelled "BEJU" (no accent) in title and body. | `terms_1440_chromium_full.jpg` |
| 30 | welcome | 1024–1440 | List items run 79–84 characters per line (brief 55–75). | metrics `longLines` |
| 31 | service pages | all | Long paragraphs sit on a glass panel (`.offer`) — DESIGN.md says long reading stays on the canvas. | `podcast_1440_chromium_fold.jpg` |
| 32 | home | all | FAQ `<details>` open/close jumps (no height animation, icon swaps instead of rotating). | code |
| 33 | home | all | Pricing shows short- and long-form as two stacked rows of gold numbers — 6 gold prices + badge + gold labels compete in one viewport (brief: ≤ ~3 gold elements per view). Approved: toggle. | `home_1440_chromium_full.jpg` |
| 34 | all | desktop | No styled desktop scrollbar. | — |
| 35 | — | — | DESIGN.md says the sweep is ".7s" but the token is 850 ms; its reference row claims an 8 / 18 radius grammar the tokens don't use. | `DESIGN.md` |

## Lighthouse (before)

Lighthouse 12.8.2, default mobile (simulated slow 4G + 4× CPU) and `--preset=desktop`, against the local
range-capable server. **Caveat:** that server doesn't gzip or set cache headers the way GitHub Pages does, so
"Enable text compression" / "cache policy" flags are environment artefacts; before and after are measured on the
same server so the comparison is fair. Raw JSON: `~/Documents/beju-flagship-tools/lighthouse-before/`.

| Page | Perf | A11y | BP | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| 404-desktop | 100 | 100 | 100 | 54 | 0.24s | 0.000 | 0ms |
| 404-mobile | 100 | 100 | 100 | 54 | 0.90s | 0.000 | 0ms |
| coaches-desktop | 100 | 95 | 100 | 100 | 0.34s | 0.000 | 0ms |
| coaches-mobile | 100 | 95 | 100 | 100 | 1.43s | 0.000 | 0ms |
| home-desktop | 99 | 93 | 96 | 100 | 0.87s | 0.000 | 0ms |
| home-mobile | 84 | 93 | 96 | 100 | 4.35s | 0.000 | 41ms |
| podcast-desktop | 100 | 95 | 100 | 100 | 0.38s | 0.000 | 0ms |
| podcast-mobile | 100 | 95 | 100 | 100 | 1.50s | 0.000 | 0ms |
| short-form-desktop | 100 | 95 | 100 | 100 | 0.39s | 0.000 | 0ms |
| short-form-mobile | 100 | 95 | 100 | 100 | 1.43s | 0.000 | 0ms |
| terms-desktop | 100 | 100 | 100 | 91 | 0.24s | 0.000 | 0ms |
| terms-mobile | 100 | 100 | 100 | 91 | 0.90s | 0.000 | 0ms |
| welcome-desktop | 100 | 100 | 100 | 66 | 0.36s | 0.000 | 0ms |
| welcome-mobile | 100 | 100 | 100 | 66 | 1.35s | 0.000 | 0ms |

Real findings behind the numbers:

| # | Page | Issue | Severity |
|---|---|---|---|
| 36 | home (mobile) | **Performance 84, LCP 4.35 s** — LCP breakdown: TTFB 451 ms, **render delay 3 902 ms**. The hero text waits for GSAP to load and animate in (item 11). Brief target: ≥ 95, LCP < 2.0 s. | P1 |
| 37 | home | **Contrast fails**: the marquee's outlined words ("YouTube Shorts", "Hooks") are 1.81:1. | P1 |
| 38 | home | Heading order skips a level (footer column titles are `<h4>` after `<h2>`). | P2 |
| 39 | home | Console error logged (the `work/02.mp4` probe, item 1) → Best Practices 96. | P1 |
| 40 | 3 service pages | "Links rely on colour to be distinguishable" (breadcrumb "Home" and in-text links have no underline) → Accessibility 95. | P2 |
| 41 | terms | No `<meta name="description">` → SEO 91. | P2 |
| 42 | welcome, 404 | SEO 66 / 54 because they are **deliberately `noindex`** (post-payment page and error page). **Conflict with the brief's "SEO 100 on every page"** — making them indexable would be wrong; flagged for Benas. | — |

## Proposals for the checkpoint (need Benas's OK)

See the checkpoint message; summary:
1. **Section merges** (no content deleted): intro "1 upload = 10 clips" folds into services; "ROI" + "numbers"
   become one "Why BEJÚ" section with one oversized number; mission stays as the single quiet text-only section.
   New order: hero → work → launches → services → how → why → guarantee → pricing → results → mission → FAQ → apply.
2. **Remove the marquee** (and the looping scroll cue).
3. **Display typeface** — side-by-side screenshot provided; recommendation in the checkpoint.
4. **Lenis** — recommendation: don't ship unless a desktop-only prototype passes every anchor/back/forward test.
5. **Launch videos** — own "Launches" section (wide NotchView feature + Fastlane/Frame by Frame two-up) and a
   `/saas-launch-videos/` service page on the service template.
