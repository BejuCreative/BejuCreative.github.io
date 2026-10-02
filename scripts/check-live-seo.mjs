// Read-only production audit. Run after GitHub Pages deploys; no form submissions.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://bejucreative.digital';
async function get(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(30000), headers: {'Cache-Control': 'no-cache'}});
  return {response, body: await response.text()};
}
const localSitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const sitemap = await get(origin + '/sitemap.xml');
assert.equal(sitemap.response.status, 200);
assert.equal(sitemap.body, localSitemap, 'Live sitemap matches this release');
const urls = [...localSitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
for (const url of [...urls, origin + '/welcome/', origin + '/guide/']) {
  const {response, body} = await get(url);
  assert.equal(response.status, 200, url);
  assert.equal(response.url, url, `${url}: no unexpected redirect`);
  const pathname = new URL(url).pathname;
  const file = path.join(root, pathname.endsWith('/') ? pathname + 'index.html' : pathname);
  assert.equal(body, fs.readFileSync(file, 'utf8'), `${url}: live HTML matches tested release`);
  if (urls.includes(url)) {
    assert(body.includes(`rel="canonical" href="${url}"`), `${url}: canonical`);
    assert(!/<meta name="robots"[^>]*noindex/.test(body), `${url}: indexable`);
  } else assert(/<meta name="robots"[^>]*noindex/.test(body), `${url}: excluded from search`);
  console.log(`PASS ${url}`);
}
const robots = await get(origin + '/robots.txt');
assert.equal(robots.response.status, 200);
assert(robots.body.includes(`Sitemap: ${origin}/sitemap.xml`));
assert(!/^Disallow:\s*\/\s*$/mi.test(robots.body), 'No site-wide crawl block');
for (const url of ['http://bejucreative.digital/', 'https://www.bejucreative.digital/']) {
  const {response} = await get(url);
  assert.equal(response.status, 200);
  assert.equal(response.url, origin + '/', `${url}: canonical redirect`);
  console.log(`PASS redirect ${url}`);
}
const missing = await get(origin + '/seo-audit-missing-page-' + Date.now());
assert.equal(missing.response.status, 404, 'Missing pages return real 404, not soft 404');
console.log('PASS production SEO delivery, robots, sitemap and 404. Indexing and rankings are not verified by this test.');
