import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', 'podcast-video-editing/index.html', 'short-form-video-editing/index.html', 'video-editing-for-coaches/index.html'];
const titles = new Set();
const descriptions = new Set();
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
for (const file of [...pages, '404.html']) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: one H1`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size, `${file}: unique IDs`);
  if (file !== '404.html') {
    const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
    const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
    assert(title && !titles.has(title), `${file}: unique title`);
    assert(description && !descriptions.has(description), `${file}: unique description`);
    titles.add(title); descriptions.add(description);
    const canonical = 'https://bejucreative.digital/' + file.replace('index.html', '');
    assert(html.includes(`rel="canonical" href="${canonical}"`), `${file}: canonical`);
    assert(sitemap.includes(`<loc>${canonical}</loc>`), `${file}: sitemap entry`);
    for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
  } else assert(html.includes('content="noindex"'), '404 must not be indexed');
  for (const m of html.matchAll(/(?:href|src|poster)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|data:)/.test(m[1])) continue;
    const url = new URL(m[1], 'https://bejucreative.digital/' + file);
    let target = path.join(root, decodeURIComponent(url.pathname));
    assert(fs.existsSync(target), `${file}: missing ${m[1]}`);
    if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    if (url.hash && target.endsWith('.html')) assert(fs.readFileSync(target, 'utf8').includes(`id="${url.hash.slice(1)}"`), `${file}: missing anchor ${m[1]}`);
  }
  console.log(`PASS ${file}`);
}
console.log('SEO checks passed: metadata, canonicals, sitemap membership, JSON syntax, IDs, local assets and anchor targets. This is not a Google ranking or rich-results eligibility test.');
