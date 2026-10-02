# SEO release — 1 October 2026

## Follow-up audit — 2 October 2026

Based on Claude's published `b22c24b`; original checkout/branch left untouched.
Worktree: `/Users/benas/Desktop/BEJU-seo-release`, branch `seo/recheck-oct02`.

- Split homepage structured offers into short-form and long-form Services so prices
  are no longer grouped under the wrong service. All six prices remain unchanged.
- Clarified delivery conditions in service metadata and the long-form pricing note,
  preserving Claude's 24-hour short-form / 48-hour long-form terms and new baseline.
- Connected Organization and WebSite entities inside all seven service/guide graphs;
  article publisher/author references now resolve within the same page.
- Completed guide sharing metadata and set the two article pages to `og:type=article`.
- Updated sitemap modification dates only for the eight pages changed in this pass.
- Extended SEO regression checks to the noindex client guide, explicit sitemap
  exclusions and local entity references; extended offer checks to reject old rules.
- Added `node scripts/check-live-seo.mjs`: read-only production check of exact deployed
  HTML, sitemap, canonicals, noindex pages, robots, redirects and real 404 responses.
- Static checks pass for nine public pages and three excluded pages; offer tests
  preserve 12 FAQ/schema matches, all prices and Claude's baseline rules.
- Browser layout audit: 66 layouts (11 pages × 3 widths × Chromium/WebKit) passed.
- Offer dialog passes Chromium/WebKit/Firefox, keyboard and no-JS fallback tests.
- Full interaction regression: 129/129 passed across Chromium, WebKit and Firefox,
  including navigation, video lightboxes, pricing, menus and mocked form submissions.
- Final local mobile Lighthouse: homepage 99 performance / 100 accessibility /
  100 best practices / 100 SEO, LCP 1.7s and CLS 0. Pricing guide 100 in all four
  categories, LCP 1.2s and CLS 0. Reports live in `beju-flagship-tools/seo-oct02-*.json`.
  These lab scores are not Google ranking positions or field Core Web Vitals.

The sections below document the first release (`43e99ef`), already confirmed live.
No ranking improvement is claimed from technical tests or structured data.

Owner explicitly requested SEO improvements and publication. This supersedes earlier
local-only instructions for the approved offer/design. Release includes the stronger
32%-opacity gold halo already requested by the owner; prices and offer rules unchanged.

## What changed

- Nine indexable pages: existing homepage, four service pages and terms, plus a new
  guides hub and two original practical articles. Welcome and 404 remain noindex.
- Homepage description names the actual five-for-$75 offer and services.
- Podcast and SaaS page titles clarify their service intent. Service social-share
  metadata now includes matching Twitter title/description/image and image alt text.
- Four service pages now have connected WebPage, Service and BreadcrumbList data;
  the short-form page includes its visible guide-price offers. No review scores added.
- Article metadata names BEJÚ Creative as the organization author, with matching
  visible publication date, headline and breadcrumbs. The hub lists both articles.
- Homepage, service pages and footers link the guides using descriptive anchor text.
- Sitemap expanded to all nine indexable pages; robots wording corrected. No blocking
  of CSS, JavaScript, media, articles or service pages.
- Regression checks now validate sitemap inventory, noindex exclusions, article and
  breadcrumb data, and crawlable paths from the homepage to every indexable page.

## Search intent map

| Page | Primary reader intent |
| --- | --- |
| `/` | Find BEJÚ and understand its editing services |
| `/short-form-video-editing/` | Hire an editor for Reels, TikToks or Shorts |
| `/podcast-video-editing/` | Buy clips from existing video podcasts |
| `/video-editing-for-coaches/` | Get lessons and talking-head content edited |
| `/saas-launch-videos/` | Commission a SaaS or app launch film |
| `/guides/` | Browse practical editing guidance |
| `/guides/turn-podcast-into-short-clips/` | Learn the podcast repurposing workflow |
| `/guides/video-editing-pricing/` | Understand BEJÚ prices, scope and quote comparisons |

These are editorial intent choices, not measured keyword volumes or ranking claims.
No location doorway pages, fabricated case studies, hidden keywords or paid links.

## Verification and measurement

- `node scripts/check-seo.mjs`: nine indexable pages plus welcome/404 checks pass.
- `node scripts/check-guarantee.mjs`: 12 FAQ/schema pairs and all prices preserved.
- Seven service/guide pages × four widths × Chromium/WebKit: 56 successful layouts,
  HTTP 200, no horizontal overflow and no JavaScript errors.
- Offer dialog: Chrome/WebKit/Firefox checks pass, including keyboard, no-JS fallback
  and reduced motion. See final completion for release and performance confirmation.
- Existing workflow regression: 129/129 checks pass across Chromium, WebKit and Firefox.
- Final local mobile Lighthouse: homepage and new podcast guide both 100/100/100/100
  (performance/accessibility/best practices/SEO). Homepage LCP 1.4s and CLS 0.
  These are lab measurements, not ranking predictions. HTTP and www redirects were
  checked and both resolve to the canonical HTTPS apex domain.
- Existing form regression uses mocked submissions; it does not establish delivery
  into the owner's Google Form. No real lead was submitted during this release.

After publication, use the verified Search Console property:

1. Submit or confirm `https://bejucreative.digital/sitemap.xml` under Sitemaps.
2. Inspect homepage, service pages and the two new articles. Request indexing where
   appropriate; a request is not a guarantee of indexing or a ranking position.
3. In Performance → Search results, filter by page and track impressions, clicks,
   CTR and queries. Compare consistent 28-day periods as data becomes available.
4. Separate branded queries (“beju”) from non-branded service queries. Average
   position varies by query, country and device; a personal Google search is not a
   reliable rank report.
5. Track enquiries and qualified clients separately. Search Console does not tell
   you whether an enquiry became a sale. No new trackers were installed here.

Owner follow-ups remain: substantiate existing numerical results claims, review the
performance claim and terms, add an accurate privacy notice, and test a real enquiry.
This release is not legal clearance or a promise that the website will rank first.

## Primary references

- Google Search Essentials: https://developers.google.com/search/docs/essentials
- SEO starter guide: https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Crawlable links: https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- Breadcrumbs: https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
- Article data: https://developers.google.com/search/docs/appearance/structured-data/article
- Video pages: https://developers.google.com/search/docs/appearance/video

Video rich results generally need an appropriate watch page; no upload dates or
VideoObject evidence were invented for decorative portfolio clips. FAQ markup is
kept consistent with visible answers, not advertised as an agency rich-result benefit.
