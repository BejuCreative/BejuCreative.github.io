(function () {
var d = document, me = d.currentScript;
if (!me || d.querySelector('.ju-launch')) return;
var dir = me.src.replace(/[^\/]*$/, ''), SITE = me.getAttribute('data-site') || '/';
var ACTS = {
  pricing: ['See prices', '#pricing'], order: ['See packages', '#pricing'],
  sample: ['Get a free sample', '#apply', 'Free sample'], launch: ['Ask for a quote', '#apply', 'Launch video'],
  apply: ['Send a message', '#apply'], email: ['Email', 'mailto:hello@bejucreative.digital'],
  wa: ['WhatsApp', 'https://wa.me/37069575791'], terms: ['See the full rules', 'terms.html#guarantee'],
  privacy: ['Privacy policy', 'privacy.html']
};
var NAME = "BEJÚ's assistant (automated)";
var HELLO = "Hi, I'm Ju, " + NAME + ". Pick a topic or type a question about our editing, prices or orders.";
var MISS = "I'm not sure about that one. A person will answer:";
var DOWN = "My answers didn't load. A person will answer:";
var HUMAN = ['email', 'wa', 'apply'];
var STOP = ' a an the is are am be do does did i im ive you your youre my me we us our can could would will should to of for in on at it its and or so if this that with from what whats how please tell about know want need have has any there just also get got use them they as which something anything video videos clip clips ';
var items = [], byId = {}, launcher, panel, log, chips, input;

function el(t, c, x) { var e = d.createElement(t); if (c) e.className = c; if (x) e.textContent = x; return e; }
function html(s) { var w = el('div'); w.innerHTML = s; return w.firstChild; }

function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f'\u2019]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
function stem(w) { return w.length < 5 ? w : w.replace(/ies$/, 'y').replace(/(ing|ed|s)$/, ''); }
function sform(s) { return ' ' + norm(s).split(' ').map(stem).join(' ') + ' '; }
function toks(s) { return norm(s).split(' ').filter(function (w) { return w && STOP.indexOf(' ' + w + ' ') < 0; }).map(stem); }
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  for (var r = [], i = 0, j; i <= a.length; i++) for (r[i] = [i], j = 1; j <= b.length; j++)
    r[i][j] = i ? Math.min(r[i - 1][j] + 1, r[i][j - 1] + 1, r[i - 1][j - 1] + (a[i - 1] !== b[j - 1]),
      i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? r[i - 2][j - 2] + 1 : 9) : j;
  return r[a.length][b.length];
}
function tm(t, k) {
  if (t === k) return 2;
  if (t.length > 3 && k.length > 3 && (!k.indexOf(t) || !t.indexOf(k))) return 1.5;
  return t.length > 4 && k.length > 4 && lev(t, k) <= (k.length > 7 ? 2 : 1) ? 1.5 : 0;
}
function match(q) {
  var qs = sform(q), qt = toks(q), res = [];
  items.forEach(function (it) {
    var s = 0, n = 0, hit = '';
    it.P.forEach(function (p) { if (qs.indexOf(p) > -1) { s += 3; hit += p; } });
    qt.forEach(function (t) {
      var b = 0;
      it.S.forEach(function (k) { b = Math.max(b, tm(t, k)); });
      if (!b && it.Q.indexOf(t) > -1) b = .5;
      s += b;
      if (b || hit.indexOf(' ' + t + ' ') > -1) n++;
    });
    if (s) res.push({ s: s, it: it, c: qt.length ? n / qt.length : 1 });
  });
  res.sort(function (a, b) { return b.s - a.s; });
  var top = res[0], nx = res[1];
  if (!top || top.s < 1.5 || (top.c < .34 && top.s < 4)) return {};
  return { it: top.it, rel: nx && nx.s >= 2 && nx.s >= top.s * .75 && nx.it };
}
function init(j) {
  Object.keys(j.items).forEach(function (id) {
    var it = byId[id] = j.items[id];
    it.id = id; it.P = []; it.S = []; it.Q = toks(it.q); it.b = it.b && it.b.split(',');
    it.k.split(',').forEach(function (k) {
      if (norm(k).indexOf(' ') > 0) it.P.push(sform(k)); else if (toks(k)[0]) it.S.push(toks(k)[0]);
    });
    items.push(it);
  });
  j.quick.forEach(function (c) { chip(chips, c[0], c[1]); });
}

function link(h) { return h[0] === '#' ? (d.getElementById(h.slice(1)) ? h : SITE + h) : /^(mailto|https?):/.test(h) ? h : SITE + h; }
function chip(box, label, id, said) {
  var b = el('button', 'ju-c', label);
  b.type = 'button'; b.setAttribute('data-q', id); b.setAttribute('data-l', said || label);
  box.appendChild(b);
}
function say(t, who, acts, rel) {
  var m = el('div', 'ju-m ju-' + who), p = el('p', 0, t), row;
  p.prepend(el('span', 'ju-sr', who == 'u' ? 'You: ' : 'Ju: '));
  m.appendChild(p);
  if (acts || rel) {
    row = el('div', 'ju-acts'); m.appendChild(row);
    (acts || []).forEach(function (k) {
      var a = ACTS[k], x = el('a', 'ju-a', a[0]);
      x.href = link(a[1]);
      if (a[2]) x.setAttribute('data-need', a[2]);
      if (/^https/.test(a[1])) { x.target = '_blank'; x.rel = 'noopener'; }
      row.appendChild(x);
    });
    if (rel) chip(row, 'Related: ' + rel.q, rel.id, rel.q);
  }
  log.appendChild(m);
  log.scrollTop = log.scrollHeight;
}
function ask(q, id) {
  say(q, 'u');
  var r = id ? { it: byId[id] } : match(q);
  setTimeout(function () { if (r.it) say(r.it.a, 'b', r.it.b, r.rel); else say(MISS, 'b', HUMAN); }, 300);
}
function act(e) {
  var t = e.target.closest('[data-q],a[href]'), h, need, go;
  if (!t) return;
  if (t.hasAttribute('data-q')) return ask(t.getAttribute('data-l'), t.getAttribute('data-q'));
  h = t.getAttribute('href'); need = t.getAttribute('data-need');
  if (h[0] !== '#') return;
  go = d.getElementById(h.slice(1));
  close(1);
  setTimeout(function () {
    var s = go.querySelector('[name="need"]'), f = go.querySelector('input:not([type=hidden]),select,textarea');
    if (need && s) s.value = need;
    if (!f) { go.tabIndex = -1; f = go; }
    f.focus({ preventScroll: true });
  }, 0);
}
function keys(e) {
  if (e.key == 'Escape') { e.preventDefault(); return close(); }
  if (e.key != 'Tab') return;
  var f = [].filter.call(panel.querySelectorAll('button,a[href],input'), function (x) { return x.offsetParent; }),
    i = f.indexOf(d.activeElement);
  e.preventDefault();
  if (i < 0) i = e.shiftKey ? 0 : -1;
  f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
}
function build() {
  panel = html('<div class="ju-panel" id="ju-panel" role="dialog" aria-modal="true" aria-labelledby="ju-t" aria-describedby="ju-s" tabindex="-1">' +
    '<div class="ju-head"><div><p class="ju-t" id="ju-t">Ju</p><p class="ju-s" id="ju-s">' + NAME + '</p></div>' +
    '<button type="button" class="ju-x" aria-label="Close chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
    '<div class="ju-log" role="log" aria-live="polite"></div><div class="ju-chips" role="group" aria-label="Common questions"></div>' +
    '<form class="ju-form"><label class="ju-sr" for="ju-in">Type your question</label><input class="ju-in" id="ju-in" maxlength="200" autocomplete="off" placeholder="Type a question">' +
    '<button class="ju-send" type="submit">Send</button></form></div>');
  d.body.appendChild(panel);
  log = panel.querySelector('.ju-log'); chips = panel.querySelector('.ju-chips'); input = panel.querySelector('input');
  panel.querySelector('.ju-x').onclick = function () { close(); };
  panel.querySelector('form').onsubmit = function (e) {
    e.preventDefault();
    var q = input.value.trim(); input.value = '';
    if (q) ask(q);
  };
  panel.onkeydown = keys; panel.onclick = act;
  launcher.setAttribute('aria-controls', 'ju-panel');
  say(HELLO, 'b');
  fetch(dir + 'ju-kb.json').then(function (r) { if (!r.ok) throw r; return r.json(); })
    .then(init).catch(function () { say(DOWN, 'b', HUMAN); });
}
function open() {
  if (!panel) build();
  panel.hidden = false; launcher.hidden = true;
  launcher.setAttribute('aria-expanded', 'true');
  d.documentElement.classList.add('ju-lock');
  (matchMedia('(pointer:fine)').matches ? input : panel).focus();
}
function close(keep) {
  panel.hidden = true; launcher.hidden = false;
  launcher.setAttribute('aria-expanded', 'false');
  d.documentElement.classList.remove('ju-lock');
  if (!keep) launcher.focus();
}
var css = el('link');
css.rel = 'stylesheet'; css.href = dir + 'ju.css';
css.onload = function () {
  launcher = html('<button type="button" class="ju-launch" aria-haspopup="dialog" aria-expanded="false" aria-label="Ask Ju, ' + NAME + '">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg><span class="ju-lbl">Ask Ju</span></button>');
  launcher.onclick = open;
  d.body.appendChild(launcher);
  dodge();
};
function dodge() {
  if (!('IntersectionObserver' in window)) return;
  var SEL = '#pricing .price-card a,#pricing a[href*="buy.stripe.com"],a[href*="buy.stripe.com"],form,.apply-form,input,textarea,select',
    live = new Set(), io, band = 120;
  function sync() { launcher.classList.toggle('ju-away', live.size > 0); }
  function watch() {
    if (io) io.disconnect();
    live.clear(); sync();
    io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { x.isIntersecting ? live.add(x.target) : live.delete(x.target); });
      sync();
    }, { rootMargin: '-' + Math.max(0, innerHeight - band) + 'px 0px 0px 0px' });
    [].forEach.call(d.querySelectorAll(SEL), function (n) { if (!n.closest('.ju-panel,.ju-launch')) io.observe(n); });
  }
  watch();
  addEventListener('resize', watch);
}
d.head.appendChild(css);
})();
