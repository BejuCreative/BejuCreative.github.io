// Run from the repository root: node scripts/check-guarantee.mjs
// The guarantee lives only in the FAQ answers below (homepage and /faq/), in terms section 5,
// and in one disclosure line under the Shorts pack cards (DISCLOSURE).
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const REFUND = "You can cancel for a full refund until we start work. If you buy as a consumer, you also have a 14-day right to cancel (section 8 of our Terms): if you cancel after we have started, you pay only for the videos already delivered, and the right ends once your videos are fully delivered. Packs expire 14 days after you pay: if by then we still have no usable footage from you, or you've stopped replying, we close the order and the videos not yet made lapse (section 2.4). Your first Shorts pack, with a baseline we agreed before you ordered, is also covered by our 2× views guarantee (section 5). This doesn't limit your rights under the law.";
const RESULTS = "Yes, on your first Shorts pack, where we agree your baseline before you order. If the average views of your pack's Shorts don't reach twice that baseline, we refund the pack price. The guarantee covers your first order only. The posting rules and how to claim are in section 5 of our Terms. Want it? Send us your channel before you order and we'll confirm your baseline within 24 hours.";
const DISCLOSURE = 'Want the 2× views guarantee on your first order? We agree your baseline before you order. How it works';
const GUARANTEE_WORDS = /guarantee|2×|money back|baseline/i;
const STRIPE = {
  short_1: 'https://buy.stripe.com/00w8wP7eWf363D8a6K5EY0E', short_3: 'https://buy.stripe.com/8x29AT8j06wA7Togv85EY0D', short_5: 'https://buy.stripe.com/eVqcN556Og7a3D85Qu5EY0C',
  long_1: 'https://buy.stripe.com/9B6dR9bvc5swgpUbaO5EY0F', long_3: 'https://buy.stripe.com/00w6oHar8dZ2a1w3Im5EY0G', long_5: 'https://buy.stripe.com/4gM3cv7eW6wAflQdiW5EY0H'
};

const read = file => readFileSync(file, 'utf8');
const clean = text => text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const noScripts = html => html.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<style\b[\s\S]*?<\/style>/g, '');
const DETAILS = /<details[^>]*><summary>([\s\S]*?)<\/summary><div class="ans">([\s\S]*?)<\/div><\/details>/g;
const visibleFaqs = html => [...html.matchAll(DETAILS)].map(([, q, a]) => ({ question: clean(q), answer: clean(a) }));
const schemaFaqs = html => {
  const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  return graph.find(item => item['@type'] === 'FAQPage').mainEntity.map(item => ({ question: item.name, answer: item.acceptedAnswer.text }));
};
const section = (html, id) => {
  const start = html.indexOf(`<section class="sec-s" id="${id}"`);
  assert(start > -1, `section #${id} exists`);
  return html.slice(start, html.indexOf('</section>', start) + 10);
};

// 1. Homepage: five FAQs, visible text equals the FAQPage JSON-LD word for word.
const home = read('index.html');
const homeFaqSection = section(home, 'faq');
const homeFaqs = visibleFaqs(homeFaqSection);
assert.equal(homeFaqs.length, 5, 'homepage shows five FAQs');
assert.equal(visibleFaqs(home).length, 5, 'no FAQ markup outside the homepage FAQ section');
assert.deepEqual(schemaFaqs(home), homeFaqs, 'homepage FAQ schema matches visible FAQ text');
assert.equal(homeFaqs.find(f => f.question === 'Can I get a refund?')?.answer, REFUND, 'homepage refund answer is the canonical text');
assert.equal(homeFaqs.find(f => f.question === 'Do you guarantee results?')?.answer, RESULTS, 'homepage results answer is the canonical text');
assert.match(homeFaqSection, /href="\/faq\/"/, 'homepage FAQ links to every question on /faq/');
console.log('PASS index.html: 5 FAQs match schema; canonical refund and results answers');

// 2. /faq/: every FAQ, matching its own JSON-LD; the homepage five appear word for word.
const faqPage = read('faq/index.html');
const allFaqs = visibleFaqs(faqPage);
assert.deepEqual(schemaFaqs(faqPage), allFaqs, '/faq/ schema matches visible FAQ text');
assert.equal(new Set(allFaqs.map(f => f.question)).size, allFaqs.length, '/faq/ questions are unique');
for (const f of homeFaqs) assert.deepEqual(allFaqs.find(g => g.question === f.question), f, `/faq/ carries "${f.question}" word for word`);
console.log(`PASS faq/index.html: ${allFaqs.length} FAQs match schema; homepage FAQs included word for word`);

// 3. Guarantee placement: only in those two FAQ answers, then terms section 5.
// form options (the "Guarantee baseline" request the results answer links to) are not claims
const outsideFaqAnswers = (html, faqs) => {
  let text = clean(noScripts(html).replace(/<select\b[\s\S]*?<\/select>/g, ''));
  for (const f of faqs.filter(f => f.answer === REFUND || f.answer === RESULTS)) text = text.replace(f.answer, '').replace(f.question, '');
  return text.replace(DISCLOSURE, '');
};
const shortsPane = home.slice(home.indexOf('id="pane-short"'), home.indexOf('id="pane-long"'));
assert.equal(clean(noScripts(home)).split(DISCLOSURE).length - 1, 1, 'homepage: the guarantee disclosure line appears exactly once');
assert(clean(shortsPane).includes(DISCLOSURE), 'homepage: the disclosure line sits under the Shorts pack cards');
assert.match(shortsPane, /href="#faq-guarantee"/, 'homepage: the disclosure links to the FAQ answer');
assert.match(home, /<details id="faq-guarantee">/, 'homepage: the FAQ answer has the id the disclosure links to');
assert.doesNotMatch(outsideFaqAnswers(home, homeFaqs), GUARANTEE_WORDS, 'homepage: no guarantee outside the two FAQ answers and the disclosure line (hero, trust, packs, sections)');
assert.doesNotMatch(outsideFaqAnswers(faqPage, allFaqs), GUARANTEE_WORDS, '/faq/: no guarantee outside the two FAQ answers');
assert.doesNotMatch(home, /offer-dialog|id="guarantee"|data-offer-details/, 'homepage: no guarantee dialog or section');
for (const file of ['short-form-video-editing/index.html', 'podcast-video-editing/index.html', 'video-editing-for-coaches/index.html', 'saas-launch-videos/index.html']) {
  assert.doesNotMatch(clean(noScripts(read(file))), /2×|money back|performance guarantee|views guarantee|baseline/i, `${file}: no guarantee section`);
  console.log(`PASS ${file}: no guarantee section`);
}
const terms = read('terms.html');
assert.match(terms, /id="guarantee"/, 'terms: section 5 anchor the FAQ links to');
assert.match(terms, /baseline/i, 'terms: guarantee baseline');
assert.match(terms, /refund/i, 'terms: refund remedy');
for (const file of ['index.html', 'faq/index.html', 'terms.html', 'welcome/index.html']) {
  assert.doesNotMatch(read(file), /35[- ]day|views or you don.t pay|five comparable|previous 10 comparable/i, `${file}: obsolete guarantee wording`);
}
console.log('PASS guarantee lives only in the FAQ answers, the one disclosure line and terms section 5');

// 4. Prices, pack links and the two hero doors are unchanged.
const prices = JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph']
  .filter(item => ['https://bejucreative.digital/#service', 'https://bejucreative.digital/#long-form'].includes(item['@id']))
  .flatMap(item => item.hasOfferCatalog.itemListElement);
assert.deepEqual(prices.map(item => item.price), ['27', '60', '75', '75', '180', '255']);
const pricing = section(home, 'pricing');
assert.deepEqual([...pricing.matchAll(/<p class="p">([^<]+)<\/p>/g)].map(m => m[1]), ['$27', '$60', '$75', '$75', '$180', '$255'], 'visible pack prices');
for (const [pack, url] of Object.entries(STRIPE)) assert(pricing.includes(`href="${url}" data-pack="${pack}"`), `${pack} card links to its Stripe link`);
assert(home.includes(`<a class="btn-gold" href="${STRIPE.short_5}" data-pack="short_5">5 Shorts for $75</a>`), 'hero pay door is the 5-pack link');
assert(home.includes('<a class="btn-glass gold-ring" href="#apply" data-need="Free sample">Free sample</a>'), 'hero sample door scrolls to the sample form');
console.log('PASS prices, pack links and both hero doors unchanged');
