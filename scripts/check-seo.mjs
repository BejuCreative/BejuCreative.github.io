import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', 'podcast-video-editing/index.html', 'short-form-video-editing/index.html', 'video-editing-for-coaches/index.html', 'saas-launch-videos/index.html', 'guides/index.html', 'guides/turn-podcast-into-short-clips/index.html', 'guides/video-editing-pricing/index.html', 'terms.html'];
const titles = new Set();
const descriptions = new Set();
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
assert.equal(sitemapUrls.length, new Set(sitemapUrls).size, 'No duplicate sitemap URLs');
assert.equal(sitemapUrls.length, pages.length, 'Sitemap matches indexable page inventory');
const links = new Map();
for (const file of [...pages, '404.html', 'welcome/index.html']) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: one H1`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size, `${file}: unique IDs`);
  if (pages.includes(file)) {
    assert(!/<meta name="robots"[^>]*noindex/.test(html), `${file}: indexable`);
    const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
    const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    assert(title && !titles.has(title), `${file}: unique title`);
    assert(description && !descriptions.has(description), `${file}: unique description`);
    titles.add(title); descriptions.add(description);
    const canonical = 'https://bejucreative.digital/' + file.replace('index.html', '');
    assert(html.includes(`rel="canonical" href="${canonical}"`), `${file}: canonical`);
    assert(sitemap.includes(`<loc>${canonical}</loc>`), `${file}: sitemap entry`);
    for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      const data = JSON.parse(m[1]);
      for (const entity of data['@graph'] || [data]) {
        if (entity['@type'] === 'BreadcrumbList') {
          assert(entity.itemListElement.length >= 2, `${file}: breadcrumb depth`);
          entity.itemListElement.forEach((item, i) => assert.equal(item.position, i + 1));
          assert.equal(entity.itemListElement.at(-1).item, canonical, `${file}: breadcrumb destination`);
        }
        if (entity['@type'] === 'Article') {
          assert(html.includes(entity.headline), `${file}: visible article headline`);
          assert(html.includes(entity.datePublished), `${file}: visible article date`);
        }
        assert.notEqual(entity['@type'], 'AggregateRating', `${file}: no unverified ratings`);
      }
    }
  } else assert(/<meta name="robots"[^>]*noindex/.test(html), `${file}: must not be indexed`);
  links.set(file, []);
  for (const m of html.matchAll(/(?:href|src|poster)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|data:)/.test(m[1])) continue;
    const url = new URL(m[1], 'https://bejucreative.digital/' + file);
    let target = path.join(root, decodeURIComponent(url.pathname));
    assert(fs.existsSync(target), `${file}: missing ${m[1]}`);
    if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    if (m[0].startsWith('href=') && target.endsWith('.html')) links.get(file).push(path.relative(root, target));
    if (url.hash && target.endsWith('.html')) assert(fs.readFileSync(target, 'utf8').includes(`id="${url.hash.slice(1)}"`), `${file}: missing anchor ${m[1]}`);
  }
  console.log(`PASS ${file}`);
}
const reached = new Set(), queue = ['index.html'];
while (queue.length) {
  const file = queue.shift();
  if (reached.has(file)) continue;
  reached.add(file);
  queue.push(...(links.get(file) || []));
}
for (const file of pages) assert(reached.has(file), `${file}: reachable through crawlable links`);
console.log(`SEO checks passed: ${pages.length} indexable pages, metadata, canonicals, sitemap, structured data, crawlable internal links and assets. This is not a ranking or rich-results eligibility test.`);
