/* BEJÚ founder CRM: Replies page (?p=replies). BENAS 11-22: "I can't find the new replies ... take me to the lead, the conversation."
   Newest real replies first; a row opens the lead drawer with the conversation (crm.js's data-act="lead", focus returns to the row).
   No query of its own: it reads crm.js's rows through window.BEJU_CRM_REPLIES. "Waiting on us" is the dashboard's one replyWait list,
   so the count matches the dashboard. A live reply (crm.js fires "beju-crm:reply" on a realtime INSERT) is added at the top from the
   event itself, no reload; crm.js's coalesced refresh ("beju-crm:data") then replaces it with the stored row.
   Registered with side.js through window.BEJU_SIDE_PAGES, so this file loads before side.js. CSP: no inline styles. */
(() => {
"use strict";
const C = () => window.BEJU_CRM_REPLIES;
const TZ = (window.BEJU_CRM || {}).timezone || "Europe/Vilnius";
const K_F = "beju-crm-replies-f", DAYS = 14;
const store = { get() { try { return localStorage.getItem(K_F); } catch { return null; } }, set(v) { try { localStorage.setItem(K_F, v); } catch {} } };
const esc = s => String(s ?? "").replace(/[&<>"'`]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" }[c]));
const lc = s => String(s || "").toLowerCase().trim();
const ms = t => t ? +new Date(t) : 0;
const fDay = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const fTime = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fDate = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" });
const when = t => { const d = fDay.format(t), now = Date.now(); return d === fDay.format(now) ? `Today ${fTime.format(t)}` : d === fDay.format(now - 864e5) ? `Yesterday ${fTime.format(t)}` : `${fDate.format(t)}, ${fTime.format(t)}`; };
const ago = t => { const m = Math.max(0, Math.round((Date.now() - t) / 6e4)); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const keyOf = (email, t) => lc(email) + "|" + t;

let F = null, LIVE = [], DIRTY = false;   // F: "wait" | "all"; LIVE: realtime rows the next refresh has not brought yet
const NEW = new Set();                      // keys that arrived live while the page was open (marked "New" until the page redraws)

/* the rows: { email, at, inbox, words, st: wait | answered | none, live } */
function model() {
  const X = C(), R = X && X.raw, D = X && X.d; if (!R || !D) return null;
  const owner = X.owner, mine = ib => owner === "All" || !X.ownerOfInbox(ib) || X.ownerOfInbox(ib) === owner;
  const real = (R.replies || []).filter(r => r.kind === "REAL" && !r.blocklisted && !X.auto(r.snippet));
  const byKey = new Map(real.map(r => [keyOf(r.lead_email, ms(r.received_at)), r]));
  const waitK = new Set();
  const wait = D.replyWait.map(x => { const t = ms(x.due), k = keyOf(x.email, t), r = byKey.get(k); waitK.add(k); return { email: x.email, at: t, inbox: r ? r.inbox : "", words: (r && r.snippet) || x.detail || "", st: "wait", why: X.why(x.email, t) }; });
  const outAt = {}; (R.tlite || []).forEach(m => { if (m.direction === "out") { const k = lc(m.lead_email), t = ms(m.at); if (!(outAt[k] >= t)) outAt[k] = t; } });
  const since = Date.now() - DAYS * 864e5;
  const all = real.filter(r => ms(r.received_at) >= since && mine(r.inbox)).map(r => { const t = ms(r.received_at), k = keyOf(r.lead_email, t);
    const st = waitK.has(k) ? "wait" : r.answered || outAt[lc(r.lead_email)] > t ? "answered" : "none";
    return { email: r.lead_email, at: t, inbox: r.inbox, words: r.snippet || "", st, why: st === "wait" ? X.why(r.lead_email, t) : null, rule: st === "none" ? X.skip(r.lead_email, t, r.snippet) : "" }; });
  /* live rows: shown until the stored copy arrives; one that would join the dashboard's list counts as waiting already */
  LIVE = LIVE.filter(l => !byKey.has(keyOf(l.email, l.at)));
  const flagged = e => (R.flags || []).some(f => lc(f.email) === e && (f.lost_reason || (f.snoozed_until && ms(f.snoozed_until) > Date.now())));
  const live = LIVE.filter(l => mine(l.inbox)).map(l => ({ ...l, st: !l.answered && !X.pass(l.words) && !flagged(lc(l.email)) && !(D.gone && D.gone.has(lc(l.email))) ? "wait" : "none" })).map(l => ({ ...l, why: l.st === "wait" ? X.why(l.email, l.at) : null, rule: l.st === "none" ? X.skip(l.email, l.at, l.words) : "" }));
  const desc = (a, b) => b.at - a.at;
  return { wait: [...live.filter(l => l.st === "wait"), ...wait].sort(desc), all: [...live, ...all].sort(desc), at: X.at, owner, nameOf: X.nameOf, ownerOfInbox: X.ownerOfInbox };
}

function badge(M) {
  const b = document.getElementById("sn-rep-n"), a = document.querySelector('#snav a[data-nav="replies"]'); if (!b) return;
  const n = M ? M.wait.length : 0, tip = n ? `Replies · ${n} waiting on us` : "Replies";
  b.hidden = !n; b.textContent = n || ""; if (a) { a.dataset.tip = tip; a.title = tip; }
}

function row(M, x, flash) {
  const o = M.ownerOfInbox(x.inbox), nm = M.nameOf(x.email), k = keyOf(x.email, x.at), isNew = NEW.has(k);
  const X = C(), st = x.st === "wait" ? (x.why ? X.chip(x.why.t, x.why.u) : `<span class="rp-pill wait">Waiting</span>`) : x.st === "answered" ? `<span class="rp-pill">Answered</span>` : X.chip(x.rule ? `No reply needed · ${x.rule}` : "No reply needed");   // 11-23: the reason, not a bare "Waiting" / a hover-only title
  return `<button type="button" class="tile rp-row${flash ? " rp-new" : ""}" data-act="lead" data-email="${esc(lc(x.email))}" data-key="${esc(k)}" title="Open the conversation">
    <span class="rp-top"><b class="rp-name">${esc(nm)}</b>${isNew ? `<span class="rp-pill new">New</span>` : ""}<span class="rp-when"><time datetime="${new Date(x.at).toISOString()}">${esc(when(x.at))}</time> · ${esc(ago(x.at))}</span></span>
    <span class="rp-words">${esc(x.words) || `<span class="rp-mute">No text synced</span>`}</span>
    <span class="rp-meta">${o ? `<span class="sd-av rp-av ${o === "Simas" ? "s" : "b"}" title="${o}'s inbox" aria-hidden="true">${o[0]}</span>` : ""}<span class="rp-ib">${esc(x.inbox || "inbox not synced")}${o ? `<span class="rp-sr"> (${o})</span>` : ""}</span>${st}</span>
  </button>`;
}

function paint() {
  const el = document.getElementById("rp-list"); if (!el) return;
  const M = model(); badge(M); if (!M) return;
  if (F == null) F = store.get() || (M.wait.length ? "wait" : "all");
  if (!document.getElementById("drawer")?.hidden) { DIRTY = true; head(M); return; }   // a redraw would replace the row the drawer returns focus to
  DIRTY = false;
  const fk = (document.activeElement && document.activeElement.closest && document.activeElement.closest("#rp-list .rp-row") ? document.activeElement.dataset.key : null);
  head(M);
  const L = F === "wait" ? M.wait : M.all;
  el.innerHTML = L.map(x => row(M, x)).join("") || `<p class="empty rp-empty">${F === "wait" ? "No reply is waiting on us." : `No replies in the last ${DAYS} days.`}</p>`;
  [...el.children].forEach((r, i) => r.style.setProperty("--n", Math.min(i, 12)));
  if (fk) { const r = el.querySelector(`.rp-row[data-key="${CSS.escape(fk)}"]`); if (r) r.focus({ preventScroll: true }); }
}
function head(M) {
  const n = document.getElementById("rp-n"), a = document.getElementById("rp-asof");
  if (n) n.innerHTML = `<b>${M.wait.length}</b> waiting on us${M.owner !== "All" ? ` · ${esc(M.owner)}'s leads only` : ""}`;   // the dashboard's owner filter (top bar on a phone, ⌘K) applies here too
  if (a) a.textContent = M.at ? `as of ${fTime.format(M.at)}` : "";
  document.querySelectorAll("[data-rpf]").forEach(b => { const on = b.dataset.rpf === F; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); const c = b.querySelector(".rp-cnt"); if (c) c.textContent = (b.dataset.rpf === "wait" ? M.wait : M.all).length; });
}

/* a realtime INSERT (crm.js onChange): the row goes on top at once, the count and the badge move with it */
addEventListener("beju-crm:reply", ev => {
  const n = ev.detail || {}, X = C(); if (!X || n.kind !== "REAL" || n.blocklisted || X.auto(n.snippet)) return;
  const l = { email: n.lead_email, at: ms(n.received_at) || Date.now(), inbox: n.inbox || "", words: n.snippet || "", answered: !!n.answered, live: true }, k = keyOf(l.email, l.at);
  if (LIVE.some(x => keyOf(x.email, x.at) === k) || (X.raw && (X.raw.replies || []).some(r => keyOf(r.lead_email, ms(r.received_at)) === k))) return;
  LIVE.unshift(l);
  const list = document.getElementById("rp-list"), M = model(); badge(M);
  if (!list || !M) return;
  head(M);
  const x = (F === "wait" ? M.wait : M.all).find(y => keyOf(y.email, y.at) === k); if (!x) return;
  NEW.add(k); list.querySelector(".rp-empty")?.remove();
  list.insertAdjacentHTML("afterbegin", row(M, x, true));   // prepend only: the other rows (and the drawer's focus target) stay as they are
});
addEventListener("beju-crm:data", () => { if (document.getElementById("rp-list")) paint(); else badge(model()); });
badge(model());   // crm.js may have loaded the data before this file ran
{ const dr = document.getElementById("drawer"); if (dr) new MutationObserver(() => { if (dr.hidden && DIRTY) paint(); }).observe(dr, { attributes: true, attributeFilter: ["hidden"] }); }

function wire(api) {
  const el = api.el; NEW.clear(); F = null; paint();
  el.querySelectorAll("[data-rpf]").forEach(b => b.addEventListener("click", () => { F = b.dataset.rpf; store.set(F); NEW.clear(); paint(); }));
}
const ready = () => { const X = C(); return X && X.raw && X.d; };
(window.BEJU_SIDE_PAGES = window.BEJU_SIDE_PAGES || {}).replies = {
  title: "Replies",
  head: ["New <em class=\"sf\">replies</em>", "Real replies from leads, newest first. Click one to open the conversation."],
  src: () => ["CRM database", null],
  load: () => ready() ? Promise.resolve({}) : new Promise(res => addEventListener("beju-crm:data", () => res({}), { once: true })),
  view: () => `<section class="card sp-card rp-card" aria-labelledby="rp-h">
    <div class="rp-hh"><h2 id="rp-h">Replies</h2><span class="rp-n" id="rp-n" aria-live="polite"></span><span class="rp-asof" id="rp-asof"></span>
      <div class="rp-chips" role="group" aria-label="Show"><button type="button" class="rp-f" data-rpf="wait" aria-pressed="false">Waiting on us<span class="rp-cnt"></span></button><button type="button" class="rp-f" data-rpf="all" aria-pressed="false">All real replies<span class="rp-cnt"></span></button></div></div>
    <div class="stack rp-list" id="rp-list"></div>
  </section>`,
  wire,
};
})();
