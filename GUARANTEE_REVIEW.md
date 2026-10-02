# Performance offer — local review

## Current status — 2 October 2026 (supersedes historical draft below)

The offer/design was published in `43e99ef`. Claude subsequently published `b22c24b`:
baseline = current public view counts of the last 10 clips at least 30 days old on
the agreed account, using all available if fewer than 10. At least three eligible
clips are required; baseline is confirmed before payment. Delivered clips are still
measured over each clip's first 30 days. The three-month baseline, 14-day standard
posting deadline, agreed larger-package schedule and seven-day claim window remain.
Standard long-form delivery is 48 hours; short-form remains 24 hours after payment,
usable footage and brief confirmation, with exceptions agreed upfront.

The old five-clip/historical-first-30-day baseline below is superseded. Current
`terms.html` is the published reference. Client onboarding is at `/guide/` (noindex),
not the public `/guides/` editorial hub. No automated analytics/refund system was
implemented, and this website release does not alter Stripe or Instantly.

2026-10-01 · branch `offer/performance-guarantee`, based on `ddf8852`.
Preview: http://localhost:8767/ . Not published; no changes to Stripe or Instantly.

Publication authorized by Benas on 2026-10-01 (“GO CRAZY ON SEO AND PUBLISH IT”).
Earlier local-only instructions below are historical; the SEO release includes this
approved offer and design. See `SEO_RELEASE.md` and the completion report for checks
and deployment status. Stripe and Instantly remain unchanged.

## Hero simplification — 2026-10-01

Latest visual refinement: owner requested a different text colour and glass bubble so
the offer does not compete with “Get seen.”. Hero guarantee now uses smaller soft-white
text, a muted secondary line/link and a content-sized glass-style panel with existing
olive surface/edge tokens. Gold headline and CTA unchanged. No extra blur, assets or
changes to the commercial rules. Layout checked at eight widths (320–1920px) in
Chromium/WebKit, no overflow; dialog regression passes all three engines.

Owner requested less visible explanation. Removed the hero paragraph; retained the
short guarantee and “How it works · terms apply”. This opens a compact three-step
dialog with eligibility, measurement, refund summary and a full-terms link. Detailed
FAQ and terms remain unchanged. Without JS, the trigger links to the guarantee section.
The panel supports close button, Escape, outside click, keyboard focus containment,
focus return, mobile scrolling and reduced motion. No new libraries or assets.
Regression script: `/Users/benas/Documents/beju-flagship-tools/offer-dialog-check.cjs`.
Passed Chromium, WebKit and Firefox at 320/390/1440px: dialog opening, close button,
Escape, backdrop dismiss, keyboard focus containment/return, full-terms navigation,
no-JS fallback and reduced motion. Existing gallery/hero interaction checks also pass
in all three engines; guarantee/schema, SEO, syntax and diff checks pass.

## Owner direction

- Cover all qualifying paid short-form packages, not only the $75 five-clip package.
- Keep “Get seen.”; put the guarantee directly below it.
- Keep local for review. Preserve the newest olive/gold design and interactions.
- Free custom sample requires no payment, card or purchase obligation.
- Refund for a missed performance target, not editing-style dissatisfaction alone.

## Copy and rule changes

- “Double your views, or you don't pay” → “Double your average views. Or your money back.”
- State payment upfront and full refund of the qualifying package's actual price.
- Before payment: agree one account/platform and record previous 10 comparable clips'
  first-30-day organic views, or five if fewer than ten are available; use their mean.
- Measure the delivered package's mean using each clip's own first 30 days after posting.
  Target = baseline × 2. A one-clip order is measured on that clip alone.
- Confirmed posting rule: all delivered clips within 14 calendar days, or a written
  larger-package schedule agreed before payment; public, unchanged and without paid
  promotion throughout measurement.
- Replace ambiguous 35-day claim deadline with seven calendar days after the last
  posted clip completes its own 30-day window; require all clip analytics.
- Confirmed renewal rule: baseline fixed for three months from agreement, then reassessed
  for future orders. No retroactive baseline changes or monthly compounding promise.
- Long-form edits and launch films excluded. At least five comparable historical clips
  plus sufficient analytics required. Existing orders keep the terms originally agreed.
- Standard short-form delivery: 24 hours after payment, usable footage and brief,
  with larger-order/cleanup timing agreed upfront. One revision round included.

Hero, guarantee panel, pricing notes, 12 FAQ answers and matching JSON-LD, three
short-form service pages, launch exclusions, terms and client welcome guide updated.
Prices, form mapping, SEO title/H1/canonicals, assets and interactions unchanged.

## Before publishing

- Owner confirmed three-month baseline reset and a written posting schedule for larger
  packages. Visual review and publication approval are still required.
- Record baseline evidence, clip IDs, first-30-day views, platform/account, target,
  package size, fee and agreement date before taking payment. This is a manual process;
  the site does not create records, monitor analytics or process refunds automatically.
- Capture each result at its 30-day point. Do not compare lifetime totals with 30-day totals.
- Keep supporting performance evidence and obtain appropriate review of the claim and
  terms before launch. A money-back guarantee does not itself substantiate a results claim:
  https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business
- Existing footage, testimonials and social-share image are preserved, not re-audited
  as advertising evidence. Check baked-in video copy before publishing this new offer.
- No publication until Benas explicitly approves.

## Verification

- `node scripts/check-seo.mjs`: pass.
- `node scripts/check-guarantee.mjs`: pass; 12 FAQ/schema pairs, old deadline removed,
  coverage across six pages and all six prices preserved.
- `node --check site.js` and `git diff --check`: pass.
- Existing `flows.js`: 129/129 in Chromium, WebKit and Firefox; form requests mocked.
- Existing `astra-check.cjs`: pass in all three engines.
- Six supporting pages × 320/390/1440px × Chromium/WebKit: 36 layouts without overflow.
- Homepage: 20 layouts across 320–2560px in Chromium/WebKit; no document overflow,
  console errors or HTTP errors. A heading widow found in three mobile captures was
  corrected; final heading fit checked at 320/360/390/430/1440px.
- Local Lighthouse: mobile and desktop both 100/100/100/100 for performance,
  accessibility, best practices and SEO. Mobile LCP 1.7s / CLS 0; desktop LCP 0.4s /
  CLS 0.036. Reports: `/Users/benas/Documents/beju-flagship-tools/guarantee-lighthouse-{mobile,desktop}.json`.
  These are lab checks, not ranking evidence or substantiation of the 2× promise.
- After the owner-approved larger-package schedule change: FAQ/schema test re-passed,
  plus final FAQ interaction and overflow checks at 320/390/1440px in Chromium/WebKit.
