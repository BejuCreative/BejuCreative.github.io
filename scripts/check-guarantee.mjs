// Run from the repository root: node scripts/check-guarantee.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const home = readFileSync('index.html', 'utf8');
const clean = text => text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const faq = home.slice(home.indexOf('<!-- ══ FAQ'));
const visible = [...faq.matchAll(/<details[^>]*><summary>([\s\S]*?)<\/summary><div class="ans">([\s\S]*?)<\/div><\/details>/g)]
  .map(([, question, answer]) => ({ question: clean(question), answer: clean(answer) }));
const schema = JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const structured = schema['@graph'].find(item => item['@type'] === 'FAQPage').mainEntity
  .map(item => ({ question: item.name, answer: item.acceptedAnswer.text }));
assert.equal(visible.length, 12);
assert.deepEqual(structured, visible, 'FAQ schema must match visible offer rules');
assert.match(home, /class="hero-offer"/);
const heroOffer = home.match(/<div class="hero-offer">([\s\S]*?)<\/div>/)[1];
assert.doesNotMatch(heroOffer, /<p\b/, 'Hero keeps the explanation behind the details link');
assert.match(heroOffer, /href="#guarantee" data-offer-details/, 'No-JS fallback stays usable');
assert.match(home, /<dialog class="offer-dialog" id="offer-details" aria-labelledby="offer-details-title"/);
assert.match(home, /All short-form packages qualify/);
const prices = schema['@graph'].filter(item => ['https://bejucreative.digital/#service', 'https://bejucreative.digital/#long-form'].includes(item['@id']))
  .flatMap(item => item.hasOfferCatalog.itemListElement);
assert.deepEqual(prices.map(item => item.price), ['27', '60', '75', '75', '180', '255']);
const baseline = visible.find(item => item.question.includes('calculate my baseline')).answer;
assert.match(baseline, /public view counts/);
assert.match(baseline, /fewer than three clips/);
assert.match(baseline, /at least 30 days old/);

for (const file of ['index.html', 'terms.html', 'welcome/index.html', 'short-form-video-editing/index.html', 'podcast-video-editing/index.html', 'video-editing-for-coaches/index.html']) {
  const text = readFileSync(file, 'utf8');
  assert.doesNotMatch(text, /35[- ]day|views or you don.t pay/i, `${file}: obsolete guarantee`);
  assert.match(text, /14/, `${file}: posting deadline`);
  assert.match(text, /30/, `${file}: measurement window`);
  assert.match(text, /seven/, `${file}: claim deadline`);
  assert.match(text, /baseline/i, `${file}: comparison baseline`);
  assert.match(text, /schedule agreed before payment|posting schedule agreed before payment|schedule agreed in writing before payment/, `${file}: larger-package posting schedule`);
  assert.match(text, /refund/i, `${file}: payment remedy`);
  assert.doesNotMatch(text, /five comparable|previous 10 comparable|first-30-day organic views of your previous/, `${file}: no obsolete baseline rule`);
  console.log(`PASS ${file}: performance guarantee coverage`);
}
console.log('PASS 12 FAQ answers match schema; all six prices unchanged.');
