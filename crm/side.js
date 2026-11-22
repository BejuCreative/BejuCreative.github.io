/* BEJÚ founder CRM: navigation sidebar + section pages (SIMAS 11-19 15:0x: "not completely to the left ... floating ... it will be
   ON the screen ... if I choose to contract it, then I contract it. When I press Clients, it takes me to ANOTHER PAGE").
   Pages live on one URL with ?p= (history.pushState), so back, refresh and links work on GitHub Pages with no 404.
   Shares crm.js's Supabase client (window.BEJU_CRM_SB); shows only while the founder dashboard is on screen.
   Reads: crm_panels ('expenses', 'ab_tests', 'metrics' from scripts/crm_panels_sync.py), clients, deliveries, payments, retainers,
   campaign_daily, interested_leads, pipeline, order_progress, order_problems. Writes: tasks + the row it came from (todo_cards / call_tasks / founder_tasks), orders (size / kind / status), founder RLS. CSP: no inline styles. */
(() => {
"use strict";
const CFG = window.BEJU_CRM || {};
const TZ = CFG.timezone || "Europe/Vilnius";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"'`]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" }[c]));
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const lc = s => String(s || "").toLowerCase().trim();
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const PHONE = matchMedia("(max-width: 600px)");

const fParts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayOf = t => { if (!t) return ""; if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t; const p = Object.fromEntries(fParts.formatToParts(new Date(t)).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; };
const addDays = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const monday = d => addDays(d, -((new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7));
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dLabel = d => d ? `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}` : "—";
const ymLabel = ym => /^\d{4}-\d{2}$/.test(ym) ? `${MON[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}` : ym;
const ago = t => { if (!t) return "never"; const m = Math.max(0, Math.round((Date.now() - new Date(t)) / 6e4)); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }), nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur = v => "€" + nf2.format(+v || 0), usd = v => "$" + nf0.format(Math.round(+v || 0)), int = v => nf0.format(Math.round(+v || 0));
const pct = (a, b) => b ? (Math.round(1000 * a / b) / 10).toFixed(1) + "%" : "—";
const initials = s => { const w = String(s || "?").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/); return ((w[0]?.[0] || "?") + (w[1]?.[0] || w[0]?.[1] || "")).toUpperCase(); };

const NAV = $("#snav"), PAGE_EL = $("#spage"), APP = $("#app"), TIP = $("#sn-tip"), SCRIM = $("#sn-scrim"), MENU = $("#sn-menu"), TOG = $("#sn-tog");
if (!NAV || !PAGE_EL || !APP) return;
const HTML = document.documentElement, BASE_TITLE = document.title;
const PAGES = { dashboard: "Dashboard", expenses: "Expenses", email: "Email campaigns", clients: "Clients", perf: "Client performance", weekly: "Weekly analysis", todos: "To-dos", slack: "Slack" };
const K_NAV = "beju-crm-nav";
let PAGE = "dashboard", ME = null, CACHE = {}, TIMER = null, CH = null, DRAG = null, SEQ = 0, EDIT = null, ON = false;
const sb = () => window.BEJU_CRM_SB;
const must = async p => { const { data, error } = await p; if (error) throw error; return data; };
async function all(table, cols, mod) {   // REST returns at most 1,000 rows per call
  const out = [];
  for (let i = 0; ; i += 1000) { let q = sb().from(table).select(cols).range(i, i + 999); if (mod) q = mod(q); const rows = await must(q); out.push(...rows); if (rows.length < 1000) return out; }
}
const panel = id => must(sb().from("crm_panels").select("data,updated_at").eq("id", id).maybeSingle());
/* 11-21 (tracking check, from v7): Instantly's daily "unique opportunities" counts a lead again on every day it is active, so sums over
   several days ran up to 1.9x too high (Course Creators: 13 by day vs 7 real). Positives per day now come from interested_leads:
   one row per lead, on the day Instantly marked it interested. All-time totals then match Instantly exactly. */
function fixOpp(cd, il) {
  if (!Array.isArray(il) || !il.length) return cd;
  const m = {}, lo = cd.reduce((a, r) => (r.day < a ? r.day : a), "9999"), seen = new Set();
  il.forEach(x => { const d = dayOf(x.interest_changed_at || x.last_reply_at || x.created_at); if (!d || !x.campaign_id) return; const k = x.campaign_id + "|" + d; m[k] = (m[k] || 0) + 1; });
  cd.forEach(r => { const k = r.campaign_id + "|" + r.day; seen.add(k); r.opportunities = m[k] || 0; });
  Object.entries(m).forEach(([k, n]) => { const [campaign_id, day] = k.split("|"); if (!seen.has(k) && day >= lo) cd.push({ campaign_id, day, sent: 0, new_leads: 0, replies: 0, replies_auto: 0, opportunities: n }); });
  return cd;
}
function toast(t) { const box = $("#toasts"); if (!box) return; const el = document.createElement("div"); el.className = "toast"; el.innerHTML = `<div><b>${esc(t)}</b></div>`; box.append(el); setTimeout(() => el.remove(), 4200); }

/* ---------------- rail: expanded / collapsed ---------------- */
const wide = () => { const s = store.get(K_NAV); return s ? s === "x" : innerWidth >= 1300; };   // no choice saved yet: collapsed under 1300 px
function applyRail() {
  if (!ON) { HTML.classList.remove("sn-x", "sn-m", "paged"); return; }
  const x = wide(); HTML.classList.toggle("sn-x", x); HTML.classList.toggle("sn-m", !x);
  TOG.setAttribute("aria-expanded", x ? "true" : "false"); TOG.setAttribute("aria-label", x ? "Collapse the menu" : "Expand the menu"); TOG.title = (x ? "Collapse" : "Expand") + "  ( [ )";
  hideTip();
}
function toggleRail() { store.set(K_NAV, wide() ? "m" : "x"); applyRail(); }
TOG.addEventListener("click", toggleRail);
addEventListener("resize", () => { if (!store.get(K_NAV)) applyRail(); });

/* tooltips on the icon rail */
function showTip(el) {
  if (!HTML.classList.contains("sn-m") || PHONE.matches || !el.dataset.tip) return;
  const b = el.getBoundingClientRect(); TIP.textContent = el.dataset.tip; TIP.hidden = false;
  TIP.style.setProperty("--x", Math.round(b.right + 12) + "px"); TIP.style.setProperty("--y", Math.round(b.top + b.height / 2 - TIP.offsetHeight / 2) + "px");
}
function hideTip() { TIP.hidden = true; }
NAV.addEventListener("pointerover", ev => { const el = ev.target.closest("[data-tip]"); el ? showTip(el) : hideTip(); });
NAV.addEventListener("pointerleave", hideTip);
NAV.addEventListener("focusin", ev => { const el = ev.target.closest("[data-tip]"); if (el) showTip(el); });
NAV.addEventListener("focusout", hideTip);

/* phones: the rail is a drawer */
function drawer(open) {
  NAV.classList.toggle("open", open); MENU.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) { SCRIM.hidden = false; requestAnimationFrame(() => SCRIM.classList.add("on")); setTimeout(() => $('[aria-current="page"]', NAV)?.focus(), RM ? 0 : 200); }
  else { SCRIM.classList.remove("on"); setTimeout(() => { if (!NAV.classList.contains("open")) SCRIM.hidden = true; }, 300); }
}
MENU.addEventListener("click", () => drawer(!NAV.classList.contains("open")));
SCRIM.addEventListener("click", () => drawer(false));
NAV.addEventListener("click", ev => { if (PHONE.matches && ev.target.closest("[data-act]")) drawer(false); });

/* ---------------- router (?p=) ---------------- */
const pageFromUrl = () => { const p = new URLSearchParams(location.search).get("p"); return PAGES[p] ? p : "dashboard"; };
const param = k => new URLSearchParams(location.search).get(k);
function go(p, extra = {}, replace = false) {
  const u = new URL(location.href);
  p === "dashboard" ? u.searchParams.delete("p") : u.searchParams.set("p", p);
  if (p !== "clients") u.searchParams.delete("c"); if (p !== "expenses") u.searchParams.delete("m"); if (p !== "perf") u.searchParams.delete("k"); if (p !== "slack") u.searchParams.delete("ts");
  Object.entries(extra).forEach(([k, v]) => v == null ? u.searchParams.delete(k) : u.searchParams.set(k, v));
  if (u.href !== location.href) history[replace ? "replaceState" : "pushState"]({ p }, "", u);
  show(p);
}
NAV.addEventListener("click", ev => {
  const a = ev.target.closest("a[data-nav]"); if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button > 0) return;
  ev.preventDefault(); if (PHONE.matches) drawer(false); go(a.dataset.nav);
});
addEventListener("popstate", () => { if (ON) show(pageFromUrl()); });
/* the phone tab bar belongs to the dashboard: tapping it from a page goes back there first */
document.addEventListener("click", ev => { if (ON && PAGE !== "dashboard" && ev.target.closest('[data-act="tab"]')) go("dashboard"); }, true);

function show(p) {
  const was = PAGE; PAGE = p; EDIT = null; if (p !== "expenses") EXM = null; if (p !== "email") EPAN = null; EPOFF = false;
  $$("a[data-nav]", NAV).forEach(a => a.dataset.nav === p && !a.classList.contains("sn-brand") ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  HTML.classList.toggle("paged", p !== "dashboard"); PAGE_EL.hidden = p === "dashboard";
  document.title = (document.title.match(/^\(\d+\+?\) /) || [""])[0] + (p === "dashboard" ? BASE_TITLE : `${PAGES[p]} · BEJÚ`);   // keeps the bell's unread count in front
  if (p !== "dashboard") { renderPage(); startTimer(); } else { stopTimer(); PAGE_EL.innerHTML = ""; }
  slackLive(p === "slack");
  if (was !== p) scrollTo(0, 0);
}
function startTimer() { stopTimer(); TIMER = setInterval(() => { if (!document.hidden && PAGE !== "dashboard" && !DRAG && !SAVING && !EDIT && !$(".cl-oe, .cnform, [data-keep]", PAGE_EL)) { delete CACHE[PAGE]; renderPage(true); } }, 5 * 60000); }   // an open Fix / call-notes form is never wiped
function stopTimer() { if (TIMER) clearInterval(TIMER); TIMER = null; }

/* keys: [ toggles the rail, Escape closes the phone drawer */
const layerOpen = () => !!($("#pal:not([hidden])") || $("#dlg:not([hidden])") || $("#drawer:not([hidden])") || $("#veil:not([hidden])"));
document.addEventListener("keydown", ev => {
  if (!ON || layerOpen()) return;
  const ae = document.activeElement, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(ae?.tagName || "") || ae?.isContentEditable;
  if (ev.key === "Escape" && NAV.classList.contains("open")) { ev.stopPropagation(); drawer(false); MENU.focus(); return; }
  if (ev.key === "Escape" && EDIT && PAGE === "todos") { closePanel(); return; }
  if (ev.key === "Escape" && EPAN && PAGE === "email") { ev.preventDefault(); closeEPan(); return; }
  if (!typing && !ev.metaKey && !ev.ctrlKey && !ev.altKey && ev.key === "[" && !PHONE.matches) { ev.preventDefault(); toggleRail(); }
}, true);

/* only with the dashboard (a signed-in founder) */
function syncApp() {
  ON = !APP.hidden; NAV.hidden = !ON; applyRail();
  if (ON) { show(pageFromUrl()); startRealtime(); todoBadge(); }
  else { stopTimer(); stopRealtime(); slackLive(false); CACHE = {}; ME = null; drawer(false); PAGE_EL.hidden = true; }
}

async function me() {
  if (ME) return ME;
  const { data } = await sb().auth.getSession(); const u = data && data.session && data.session.user; if (!u) return null;
  const p = await must(sb().from("profiles").select("id,name,email").eq("id", u.id).maybeSingle()).catch(() => null);
  const nm = (p && p.name) || u.email || "";
  ME = { id: u.id, name: nm, who: /simas/i.test(nm + " " + u.email) ? "Simas" : /benas/i.test(nm + " " + u.email) ? "Benas" : "Both" };
  return ME;
}

/* ---------------- pages ---------------- */
const LOAD = { expenses: loadExpenses, email: loadEmail, clients: loadClients, perf: loadPerf, weekly: loadWeekly, todos: loadTodos, slack: loadSlack };
const VIEW = { expenses: viewExpenses, email: viewEmail, clients: viewClients, perf: viewPerf, weekly: viewWeekly, todos: viewTodos, slack: viewSlack };
const HEAD = {
  expenses: ["Expenses <em class=\"sf\">&amp; profit</em>", "Tick what's paid this month and see the profit that's left."],
  email: ["Email <em class=\"sf\">campaigns</em>", "What to change, which campaign works best, and how each one is sending."],
  clients: ["Clients <em class=\"sf\">&amp; videos</em>", "Everyone who paid or got videos from us, and every video we delivered."],
  perf: ["Client <em class=\"sf\">performance</em>", "Monthly clients' YouTube, TikTok and Instagram: views and trend, which of our Shorts they posted, what works."],
  weekly: ["Weekly <em class=\"sf\">business review</em>", "Health line, money, funnel, campaigns, A/B tests, engine, sales, clients and what we changed: this week against last week and the 4 weeks before."],
  todos: ["To-<em class=\"sf\">dos</em>", "Founder to-dos only. Drag a card to move it, click it to open it. You both see changes live."],
  slack: ["Slack <em class=\"sf\">channels</em>", "#claude-sync and #red-alert, newest first. Messages that mention you are marked."],
};
/* 11-21: a page can live in its own file (contacts.js). It sets window.BEJU_SIDE_PAGES[id] = { title, head: [h1 html, subline], src(d),
   load(api), view(d, api), wire(api) } and loads before this file; side.js gives it the shared client and helpers (API). */
const EXT = window.BEJU_SIDE_PAGES || {};
const API = { sb, me, all, toast, esc, ic, lc, dayOf, dLabel, usd, initials, get el() { return PAGE_EL; } };
Object.entries(EXT).forEach(([id, x]) => { PAGES[id] = x.title; HEAD[id] = x.head; LOAD[id] = () => x.load(API); VIEW[id] = d => x.view(d, API); });
function srcOf(p, d) {
  if (EXT[p]) return EXT[p].src ? EXT[p].src(d) : null;
  if (p === "expenses") return d ? ["Beju Finance sheet + Stripe", d.updated_at] : null;
  if (p === "email") { if (!d || !d.ab) return null; const F = ecFresh(d), o = F.filter(f => f.at).sort((a, b) => new Date(a.at) - new Date(b.at))[0]; return ["Instantly API", o ? o.at : d.ab.updated_at, F.some(f => f.old), "Older than its sync interval: the numbers may be out of date"]; }
  if (p === "clients") return d ? [d.dsOk === false ? "Drive access expired: delivered counts are stale" : "Google Drive + Stripe", d.synced] : null;
  if (p === "perf") return d ? ["YouTube API, TikTok, Instagram (public)", d.synced] : null;
  if (p === "weekly") return d ? ["Instantly API, Stripe, Samples tab, client scans, CRM", d.synced] : null;
  if (p === "todos") return ["Live board", null];
  return null;
}
function header(p, d) {
  const [h, sub] = HEAD[p], s = srcOf(p, d), old = s && (/expired/.test(s[0]) || (s[2] != null ? s[2] : s[1] && Date.now() - new Date(s[1]) > 3 * 36e5));
  return `<header class="sp-h"><div><h1>${h}</h1><p>${esc(sub)}</p></div>${s ? `<span class="sp-src${old ? " old" : ""}"${old ? ` title="${esc(s[3] || "Older than 3 hours: the numbers may be out of date")}"` : ""}><i></i>${esc(s[0])}${s[1] ? ` · synced ${esc(ago(s[1]))}${old ? " · may be out of date" : ""}` : " · live"}</span>` : ""}</header>`;
}
async function renderPage(quiet) {
  const p = PAGE; if (p === "dashboard" || !sb()) return;
  const seq = ++SEQ;
  if (!quiet || !CACHE[p]) PAGE_EL.innerHTML = `${header(p, null)}<div class="sp-sk" aria-label="Loading"><i></i><i></i><i></i></div>`;
  try {
    const d = CACHE[p] || (CACHE[p] = await LOAD[p]());
    if (seq !== SEQ || p !== PAGE) return;
    PAGE_EL.innerHTML = header(p, d) + VIEW[p](d);
    applyVars(PAGE_EL); if (p === "todos") wireBoard(); if (p === "clients") wireClients(); if (p === "perf") wirePerf(); if (p === "weekly") wireWeekly(); if (p === "expenses") wireExpenses(); if (p === "email") wireEmail(); if (p === "slack") wireSlack(); if (EXT[p] && EXT[p].wire) EXT[p].wire(API); countUps(PAGE_EL);
  } catch (e) {
    if (seq !== SEQ) return; delete CACHE[p];
    PAGE_EL.innerHTML = `${header(p, null)}<p class="sp-err">Couldn't load this page. ${esc(String(e && e.message || e).slice(0, 160))}</p><div><button type="button" class="act" id="sp-retry">${ic("refresh")}Try again</button></div>`;
    $("#sp-retry")?.addEventListener("click", () => renderPage());
  }
}
function applyVars(root) {
  const els = $$("[data-v]", root);
  const go2 = () => els.forEach(el => el.dataset.v.split(";").forEach(pair => { const i = pair.indexOf(":"); if (i > 0) el.style.setProperty("--" + pair.slice(0, i), pair.slice(i + 1)); }));
  RM ? go2() : requestAnimationFrame(() => requestAnimationFrame(go2));
}
const empty = t => `<p class="empty">${esc(t)}</p>`;
const kpi = (label, val, sub) => `<div class="card sp-card sp-kpi"><span class="ct">${esc(label)}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
const barRow = (label, val, frac, cls = "") => `<div class="sp-bar"><span>${esc(label)}</span><span class="v">${val}</span><div class="bar ${cls}"><i data-v="w:${Math.max(2, Math.round(frac * 100))}%"></i></div></div>`;

/* 1. expenses: a cost tracker (SIMAS 11-19 18:3x: "actually valuable to us to track our expenses, not revenue") */
const CATS = ["Email infrastructure", "Outreach software", "AI tools", "Servers", "Software", "Domains", "Freelancers", "Fees", "Other"];
const CCOL = ["c-blue", "c-green", "c-orange", "c-purple", "c-red", "c-blue2", "c-grey", "c-ink"];
let EXS = "month", EXE = null, ESORT = "default";
const money = (v, cur) => (cur === "EUR" ? "€" : cur === "USD" ? "$" : "") + nf2.format(+v || 0);
const dlt = (cur, prev) => !prev ? `<span class="mut">no earlier month</span>` : `<span class="${cur <= prev ? "sd-up" : "sd-dn"}">${cur >= prev ? "▲" : "▼"} ${Math.abs(Math.round(100 * (cur - prev) / prev))}%</span> <span class="mut">vs ${eur(prev)}</span>`;
const ord = n => { n = +n; return n ? n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th") : ""; };
function expModel(x) {
  const d = x.exp.data, F = x.fin && x.fin.data, M = x.m && x.m.data, t = dayOf(Date.now()), ym = t.slice(0, 7), rows = d.rows || [], subs = (d.subs || []).filter(s => !/^cancel/i.test(s.status || ""));
  const prevYm = y => addDays(y + "-01", -1).slice(0, 7), byM = {}, cats = [];
  rows.forEach(e => { const k = (e.date || "").slice(0, 7) || "undated"; (byM[k] = byM[k] || { total: 0, cat: {} }); byM[k].total += e.eur; byM[k].cat[e.category || "Other"] = (byM[k].cat[e.category || "Other"] || 0) + e.eur; if (!cats.includes(e.category || "Other")) cats.push(e.category || "Other"); });
  const tot = y => (byM[y] || { total: 0 }).total, lm = prevYm(ym), lm2 = prevYm(lm), lm3 = prevYm(lm2), full = [lm, lm2, lm3].filter(y => byM[y]);
  const months = []; { let y = Object.keys(byM).filter(k => k !== "undated").sort()[0] || ym; for (let i = 0; i < 12 && y <= ym; i++) { months.push(y); const nx = new Date(y + "-15T12:00:00Z"); nx.setUTCMonth(nx.getUTCMonth() + 1); y = nx.toISOString().slice(0, 7); } }
  /* one row per tool / vendor */
  const V = {};
  const g = n => V[n] || (V[n] = { name: n, subs: [], rows: [], month: 0 });
  subs.forEach(s => { const v = g(s.vendor); v.subs.push(s); v.month += s.eur_month || 0; });
  rows.forEach(e => g(e.vendor || "Unknown").rows.push(e));
  const catVend = {};
  const tools = Object.values(V).map(v => {
    const rs = v.rows.slice().sort((a, b) => (a.date || "").localeCompare(b.date || "")), last = rs[rs.length - 1], cc = {}; rs.forEach(e => { cc[e.category || "Other"] = (cc[e.category || "Other"] || 0) + 1; });
    const cat = Object.entries(cc).sort((a, b) => b[1] - a[1])[0], flags = [], byItem = {};
    rs.forEach(e => (byItem[e.item] = byItem[e.item] || []).push(e));
    Object.values(byItem).forEach(a => { if (a.length > 1 && a[a.length - 1].amount !== a[a.length - 2].amount) flags.push(["o", `price changed: ${money(a[a.length - 2].amount, a[a.length - 2].currency)} → ${money(a[a.length - 1].amount, a[a.length - 1].currency)}`]); });
    v.subs.forEach(s => { if (/year/i.test(s.cadence) && s.next_due && s.next_due <= addDays(t, 60)) flags.push(["o", `yearly renewal ${dLabel(s.next_due)}: ${money(s.amount, s.currency)}`]); });
    const o = { name: v.name, purpose: v.subs.length ? v.subs.map(s => s.item).join(" · ") : [...new Set(rs.map(e => e.item).filter(Boolean))].slice(0, 2).join(" · "), cat: cat ? cat[0] : "", month: v.month,
      billing: v.subs.map(s => /year/i.test(s.cadence) ? `yearly ${s.due_day}` : s.due_day ? `${ord(s.due_day) || s.due_day}` : "").filter(Boolean), payers: [...new Set(v.subs.map(s => s.payer).concat(rs.map(e => e.paid_by)).filter(Boolean))],
      since: rs[0] ? rs[0].date : "", total: rs.reduce((a, e) => a + e.eur, 0), last, flags, hasSub: v.subs.length > 0 };
    if (o.month > 0 && o.cat) (catVend[o.cat] = catVend[o.cat] || []).push(o.name);
    return o;
  });
  tools.forEach(o => { const others = (catVend[o.cat] || []).filter(n => n !== o.name); if (o.month > 0 && others.length) o.flags.push(["", `same category as ${others.join(", ")}`]); });
  tools.sort(EXS === "total" ? (a, b) => b.total - a.total : (a, b) => b.month - a.month || b.total - a.total);
  const bills = ((F && F.bills) || []).filter(b => b.due && b.due <= addDays(t, 30)).sort((a, b) => String(a.due).localeCompare(String(b.due)));
  const sumB = n => bills.filter(b => b.due <= addDays(t, n)).reduce((a, b) => a + (+b.eur || 0), 0);
  const fx = d.fx_default || (F && F.fx_usd_eur) || null, spent = tot(ym), contacted = M && M.periods && M.periods.month ? M.periods.month.contacted : null, revUsd = M && M.money ? M.money.stripe_month_usd : null;
  return { d, F, M, t, ym, lm, rows, cats, byM, months, tot, spent, last: tot(lm), last2: tot(lm2), avg3: full.length ? full.reduce((a, y) => a + tot(y), 0) / full.length : null, avgN: full.length, run: subs.reduce((a, s) => a + (s.eur_month || 0), 0), nSubs: subs.length,
    tools, bills, sum7: sumB(7), sum30: sumB(30), fx, contacted, revUsd, vids: x.vids, pending: (x.entries || []).filter(e => !e.synced_at), S: M && M.stripe_now };
}
function expForm(e) {
  const v = (k, dflt = "") => esc(e && e[k] != null ? e[k] : dflt), sel = (k, opts, dflt) => opts.map(o => `<option${(e ? e[k] : dflt) === o ? " selected" : ""}>${o}</option>`).join("");
  return `<form class="ex-form" id="ex-form" data-id="${e ? e.id : ""}">
    <label><span>Date</span><input name="day" type="date" value="${v("day", dayOf(Date.now()))}" required></label>
    <label><span>Vendor / tool</span><input name="vendor" type="text" maxlength="120" value="${v("vendor")}" placeholder="e.g. Instantly" required></label>
    <label><span>What for</span><input name="item" type="text" maxlength="200" value="${v("item")}" placeholder="e.g. 10 more inboxes"></label>
    <label><span>Amount</span><input name="amount" type="number" step="0.01" min="0.01" value="${v("amount")}" required></label>
    <label><span>Currency</span><select name="currency">${sel("currency", ["EUR", "USD"], "EUR")}</select></label>
    <label><span>Category</span><select name="category">${sel("category", CATS, "Other")}</select></label>
    <label><span>Paid by</span><select name="paid_by">${sel("paid_by", ["Simas", "Benas", "Company"], (ME && ME.who !== "Both" ? ME.who : "Simas"))}</select></label>
    <label><span>Repeats</span><select name="recurring">${sel("recurring", ["one-off", "monthly", "annual"], "one-off")}</select></label>
    <label class="w2"><span>Note</span><input name="note" type="text" maxlength="600" value="${v("note")}"></label>
    <label class="w2"><span>Receipt link (https://…)</span><input name="receipt_url" type="url" pattern="https://.*" value="${v("receipt_url")}"></label>
    <div class="row">${e ? `<button type="button" class="act no" id="ex-del">Delete</button>` : ""}<button type="button" class="act" id="ex-cancel">Cancel</button><button type="submit" class="act go">${e ? "Save changes" : "Add expense"}</button></div>
    <p class="sp-note w4">It goes to the Beju Finance sheet's Expenses tab with the next sync (every 15 minutes). Until then you can edit or delete it here; after that, change it in the sheet.</p></form>`;
}
/* count-up numbers on the section pages: <b data-cu="123.4" data-f="eur" data-k="exp-profit"> */
const CU_PREV = {}, CU_F = { eur: v => "€" + nf2.format(v), eur0: v => (v < 0 ? "−€" : "€") + nf0.format(Math.abs(Math.round(v))), usd: v => "$" + nf0.format(Math.round(v)), int: v => nf0.format(Math.round(v)), pct: v => (Math.round(v * 10) / 10).toFixed(1) + "%" };
const cu = (v, f, k, cls = "") => `<span class="cu ${cls}" data-cu="${+v || 0}" data-f="${f}" data-k="${k}">${CU_F[f](+v || 0)}</span>`;
function countUps(root) {
  const calm = HTML.dataset.motion === "calm";
  $$("[data-cu]", root).forEach(el => { const to = +el.dataset.cu, f = CU_F[el.dataset.f] || CU_F.int, k = el.dataset.k, from = k in CU_PREV ? CU_PREV[k] : 0; CU_PREV[k] = to;
    if (RM || calm || from === to) { el.textContent = f(to); return; }
    const t0 = performance.now(); const step = now => { const p = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - p, 3); el.textContent = f(from + (to - from) * e); if (p < 1 && el.isConnected) requestAnimationFrame(step); }; requestAnimationFrame(step); });
}

/* expenses: the month board (SIMAS 11-19 18:4x: "click what is already paid, so we see what's the profit ... not just a list") */
let EXM = null, EX_CH = null;
const ymAdd = (y, n) => { const d = new Date(y + "-15T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
async function loadExpenses() {
  await me();
  const ym = dayOf(Date.now()).slice(0, 7);
  const [exp, fin, m, entries, vids, status, pays] = await Promise.all([panel("expenses"), must(sb().from("finance_snapshot").select("data,updated_at").eq("id", "current").maybeSingle()).catch(() => null), panel("metrics").catch(() => null),
    all("expense_entries", "*", q => q.order("id", { ascending: false })).catch(() => []),
    sb().from("deliveries").select("id", { count: "exact", head: true }).gte("delivered_at", ym + "-01").then(r => r.count, () => null),
    all("expense_status", "*").catch(() => []), all("payments", "amount,refunded,paid_at,currency").catch(() => [])]);
  return { exp, fin, m, entries, vids, status, pays, updated_at: exp ? exp.updated_at : null };
}
function boardModel(x, E, MO) {
  const d = E.d, F = E.F, t = E.t, subs = (d.subs || []).filter(s => !/^cancel/i.test(s.status || "")), first = E.months[0] || E.ym, items = [];
  const catOf = Object.fromEntries(E.tools.map(o => [o.name, o.cat || "Other"])), pad = n => String(n).padStart(2, "0"), dim = new Date(Date.UTC(+MO.slice(0, 4), +MO.slice(5, 7), 0)).getUTCDate();
  const pool = E.rows.filter(e => (e.date || "").startsWith(MO)).map(e => ({ ...e, used: false }));
  if (MO >= first) subs.forEach(s => {
    const yearly = /year/i.test(s.cadence); if (yearly && !(s.next_due && s.next_due.slice(5, 7) === MO.slice(5, 7))) return;
    const day = yearly ? +s.next_due.slice(8, 10) : Math.min(dim, parseInt(s.due_day, 10) || 1);
    const hit = pool.find(e => !e.used && e.vendor === s.vendor && e.currency === s.currency && Math.abs(e.amount - s.amount) <= Math.max(.02, s.amount * .01)); if (hit) hit.used = true;
    items.push({ key: `sub:${s.vendor}|${s.item}`, vendor: s.vendor, item: s.item, eur: hit ? hit.eur : s.eur_charge, amount: s.amount, currency: s.currency, due: `${MO}-${pad(day)}`, payer: s.payer, kind: yearly ? "yearly" : "monthly", logged: !!hit, cat: catOf[s.vendor] || "Other" });
  });
  pool.filter(e => !e.used).forEach(e => items.push({ key: `exp:${e.date}|${e.vendor}|${e.item}`, vendor: e.vendor, item: e.item, eur: e.eur, amount: e.amount, currency: e.currency, due: e.date, payer: e.paid_by, kind: "one-off", logged: true, cat: e.category || "Other" }));
  (x.entries || []).filter(e => !e.synced_at && String(e.day).startsWith(MO)).forEach(e => items.push({ key: `ent:${e.id}`, vendor: e.vendor, item: e.item || "", eur: e.currency === "EUR" ? +e.amount : +e.amount * (E.fx || 1), amount: +e.amount, currency: e.currency, due: e.day, payer: e.paid_by, kind: "new", logged: true, cat: e.category }));
  const fm = F && F.month ? [F.month.this, F.month.last].find(z => z && z.ym === MO) : null;
  if (fm && fm.fees) items.push({ key: "fees", vendor: "Stripe", item: "Card processing fees", eur: fm.fees, amount: fm.fees, currency: "EUR", due: MO + "-" + pad(dim), payer: "Company", kind: "auto", logged: true, fixed: true, cat: "Fees" });
  const st = Object.fromEntries((x.status || []).filter(r => r.month === MO).map(r => [r.key, r]));
  items.forEach(i => { i.paid = i.fixed ? true : st[i.key] ? !!st[i.key].paid : i.logged; i.by = st[i.key] ? st[i.key].by : null; i.grp = i.paid ? "paid" : i.due <= addDays(t, 7) ? "soon" : "later"; i.late = !i.paid && i.due < t; });
  items.sort((a, b) => a.due.localeCompare(b.due) || b.eur - a.eur);
  const usdIn = (x.pays || []).filter(p => !p.refunded && dayOf(p.paid_at).startsWith(MO)).reduce((a, p) => a + (+p.amount || 0), 0);
  const inEur = fm ? fm.income : usdIn * (E.fx || 1), paid = items.filter(i => i.paid).reduce((a, i) => a + i.eur, 0), total = items.reduce((a, i) => a + i.eur, 0);
  return { MO, items, usdIn, inEur, inHow: fm ? "as it landed in EUR (Stripe payouts)" : `at ${E.fx} USD→EUR`, paid, toPay: total - paid, total, profit: inEur - paid, after: inEur - total };
}
function tile(i) {
  return `<button type="button" class="ex-tile ${i.grp}${i.fixed ? " fixed" : ""}" data-tick="${esc(i.key)}" aria-pressed="${i.paid}" ${i.fixed ? "disabled" : ""} title="${i.fixed ? "Taken by Stripe automatically" : i.paid ? "Paid. Click to mark as not paid" : "Click when it's paid"}">
    <span class="ex-av">${esc(initials(i.vendor))}</span><span class="ex-tk" aria-hidden="true"><svg><use href="#i-check"/></svg></span>
    <b>${esc(i.vendor)}</b><small>${esc(i.item || "")}</small>
    <span class="ex-amt">${eur(i.eur)}${i.currency !== "EUR" ? `<em>${money(i.amount, i.currency)}</em>` : ""}</span>
    <span class="ex-meta"><span>${i.kind === "auto" ? "automatic" : esc(dLabel(i.due))}</span><span>${esc(i.payer || "?")}</span>${i.late ? `<span class="chip r">overdue</span>` : i.kind === "yearly" ? `<span class="chip">yearly</span>` : i.kind === "new" ? `<span class="chip o">new</span>` : i.logged && !i.fixed ? `<span class="chip g">receipt logged</span>` : ""}</span></button>`;
}
function viewExpenses(x) {
  if (!x.exp || !x.exp.data || !Array.isArray(x.exp.data.rows)) return empty("No expense data yet. It arrives with the next sync (every 15 minutes).");
  const E = expModel(x); if (!EXM) EXM = /^\d{4}-\d{2}$/.test(param("m") || "") ? param("m") : E.ym;
  const B = boardModel(x, E, EXM), grp = k => B.items.filter(i => i.grp === k), base = Math.max(B.inEur, B.total, 1), w = v => Math.max(0, Math.round(1000 * v / base) / 10);
  const G = [["soon", "Due soon", "next 7 days or overdue"], ["later", "Later this month", ""], ["paid", "Paid", ""]];
  const six = []; for (let i = 5; i >= 0; i--) { const y = ymAdd(E.ym, -i), inc = (x.pays || []).filter(p => !p.refunded && dayOf(p.paid_at).startsWith(y)).reduce((a, p) => a + (+p.amount || 0), 0) * (E.fx || 1), sp = E.tot(y); six.push({ y, sp, pr: inc - sp, has: !!(inc || sp) }); }
  const smx = Math.max(1, ...six.map(s => Math.max(s.sp, Math.abs(s.pr))));
  const cats = {}; B.items.forEach(i => { cats[i.cat] = (cats[i.cat] || 0) + i.eur; }); const catL = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  // 11-21 (BENAS; SIMAS: "we are even"): who owes whom = finance.py's split (money each founder took out + transfers), not the 50/50 of tool bills
  const SP = E.F && E.F.split, ow = SP && /^(Simas|Benas) is owed €([\d,.]+)/.exec(SP.even_out || ""), took = f => SP ? `took ${eur((SP.taken || {})[f])}${(SP.transfers_net || {})[f] ? ` · transfers ${eur(SP.transfers_net[f])}` : ""}` : "no data", unit =(label, val, sub) => `<div class="wk-stat"><span>${esc(label)}</span><b>${val}</b><small>${sub}</small></div>`, revEur = E.revUsd != null && E.fx ? E.revUsd * E.fx : null;
  // 11-22 (SIMAS: "a square that compares how much Simas has withdrawn to his bank and how much Benas has"): Stripe payouts per founder bank, from finance.py
  const PO = E.F && E.F.payouts, poS = (PO && PO.Simas) || null, poB = (PO && PO.Benas) || null, poD = (poS ? +poS.all_time_eur || 0 : 0) - (poB ? +poB.all_time_eur || 0 : 0), poT = (poS ? +poS.all_time_eur || 0 : 0) + (poB ? +poB.all_time_eur || 0 : 0);
  const poP = (n, o) => `<div class="p"><span class="ex-av big">${n[0]}</span><b>${n}</b><strong>${o ? eur(o.all_time_eur) : "—"}</strong><small>${o ? `${int(o.count)} payouts · ${esc(o.bank || "")}` : "no payouts"}</small><small>${o ? `this month ${eur(o.month_eur)}${o.last ? ` · last ${esc(dLabel(o.last.date))} ${esc(money(o.last.amount, o.last.currency))}` : ""}` : ""}</small></div>`;
  const wdCard = PO ? `<section class="card sp-card"><h2>Withdrawn to our banks <small>Stripe payouts, all time, EUR</small></h2><div class="ex-owe ex-wd">${poP("Simas", poS)}
      <div class="arrow"><b>${Math.abs(poD) < 0.005 ? "Even" : eur(Math.abs(poD))}</b><i></i><small>${Math.abs(poD) < 0.005 ? "same amount each" : `${poD > 0 ? "Simas" : "Benas"} has withdrawn more`}</small></div>${poP("Benas", poB)}</div>
      <div class="ex-wdbar" role="img" aria-label="Simas ${eur(poS ? poS.all_time_eur : 0)}, Benas ${eur(poB ? poB.all_time_eur : 0)}"><i class="s" data-v="w:${poT ? (100 * (poS ? +poS.all_time_eur || 0 : 0) / poT).toFixed(1) : 50}%"></i><i class="b" data-v="w:${poT ? (100 * (poB ? +poB.all_time_eur || 0 : 0) / poT).toFixed(1) : 50}%"></i></div>
      <div class="ex-legend"><span><i class="dot c-ink"></i>Simas ${poT ? Math.round(100 * (poS ? +poS.all_time_eur || 0 : 0) / poT) : 0}%</span><span><i class="dot c-orange"></i>Benas ${poT ? Math.round(100 * (poB ? +poB.all_time_eur || 0 : 0) / poT) : 0}%</span></div>
      <p class="sp-note">Money Stripe paid into each founder's bank (paid payouts only). Benas's payouts are in USD${poB && poB.all_time && poB.all_time.USD ? ` (${esc(money(poB.all_time.USD, "USD"))})` : ""}, shown in EUR. Bills each of you paid from it are in "Who owes whom" below.</p></section>` : "";
  return `<section class="card sp-card ex-hero">
    <div class="ex-hh"><div class="ex-sw" role="group" aria-label="Month"><button type="button" class="icon-btn" data-mo="-1" aria-label="Previous month"><svg aria-hidden="true"><use href="#i-back"/></svg></button><b>${esc(ymLabel(EXM))}</b><button type="button" class="icon-btn" data-mo="1" aria-label="Next month"><svg aria-hidden="true"><use href="#i-chev"/></svg></button>${EXM !== E.ym ? `<button type="button" class="chip" data-mo="0">Back to ${esc(MON[+E.ym.slice(5, 7) - 1])}</button>` : ""}</div>
      <div class="ex-acts">${E.S ? `<span class="chip" title="Stripe balance right now">Stripe balance ${Object.entries(E.S.available || {}).map(([c, v]) => money(v, c)).join(" + ") || "$0.00"}</span>` : ""}<button type="button" class="act go" id="ex-add">${ic("plus")}Add an expense</button></div></div>
    <div class="ex-nums"><div><span>Money in</span><b>${cu(B.inEur, "eur0", "ex-in")}</b><small>${usd(B.usdIn)} from Stripe, ${esc(B.inHow)}</small></div><i class="op">−</i>
      <div><span>Paid so far</span><b>${cu(B.paid, "eur0", "ex-paid")}</b><small>${B.items.filter(i => i.paid).length} of ${B.items.length} ticked</small></div><i class="op">=</i>
      <div class="pf ${B.profit >= 0 ? "up" : "dn"}"><span>Profit so far</span><b>${cu(B.profit, "eur0", "ex-profit")}</b><small>after the remaining bills: <strong>${cu(B.after, "eur0", "ex-after")}</strong> (${eur(B.toPay)} still to pay)</small></div></div>
    <div class="ex-bar" role="img" aria-label="Paid ${eur(B.paid)}, still to pay ${eur(B.toPay)}, profit after all bills ${eur(B.after)}"><i class="a" data-v="w:${w(B.paid)}%"></i><i class="b" data-v="w:${w(B.toPay)}%"></i><i class="c" data-v="w:${w(Math.max(0, B.after))}%"></i></div>
    <div class="ex-legend"><span><i class="dot c-ink"></i>paid</span><span><i class="dot c-orange"></i>still to pay</span><span><i class="dot c-green"></i>profit left</span></div></section>
  <div id="ex-form-w">${EXE ? `<section class="card sp-card"><h2>${EXE.id ? "Edit expense" : "Add an expense"}</h2>${expForm(EXE.id ? EXE : null)}</section>` : ""}</div>
  ${G.map(([k, label, sub]) => grp(k).length ? `<div class="ex-grp ${k}"><h2>${label} <small>${grp(k).length} · ${eur(grp(k).reduce((a, i) => a + i.eur, 0))}${sub ? " · " + sub : ""}</small></h2><div class="ex-board">${grp(k).map(tile).join("")}</div></div>` : "").join("") || `<section class="card sp-card">${empty(EXM < (E.months[0] || E.ym) ? "No expenses were tracked that far back." : "No bills for this month.")}</section>`}
  <p class="sp-note">Tick a bill when it's paid: the profit updates and both founders see it. Bills with a receipt in the Finance sheet start ticked. Monthly bills come from the sheet's Subscriptions tab.</p>
  ${E.F && (E.F.alerts || []).length && EXM === E.ym ? `<section class="card sp-card"><h2>Needs a look <small>${E.F.alerts.length}</small></h2><div class="sp-alerts">${E.F.alerts.map(a => `<div class="sp-alert ${esc(a.level || "info")}"><i></i><span>${esc(a.text)}</span></div>`).join("")}</div></section>` : ""}
  <div class="sp-2b">
    <section class="card sp-card"><h2>Where it goes <small>${esc(ymLabel(EXM))}, EUR</small></h2>${catL.length ? `<div class="ex-catbar" role="img" aria-label="${esc(catL.map(([c, v]) => `${c} ${eur(v)}`).join(", "))}">${catL.map(([c, v], i) => `<i class="${CCOL[i % CCOL.length]}" data-v="w:${(100 * v / Math.max(1, B.total)).toFixed(1)}%" title="${esc(`${c}: ${eur(v)}`)}"></i>`).join("")}</div><div class="ex-cats">${catL.map(([c, v], i) => `<div><i class="dot ${CCOL[i % CCOL.length]}"></i><span>${esc(c)}</span><b>${eur(v)}</b><small>${Math.round(100 * v / Math.max(1, B.total))}%</small></div>`).join("")}</div>` : empty("Nothing this month.")}</section>
    <section class="card sp-card"><h2>Spend and profit <small>last 6 months, EUR</small></h2><div class="ex-six">${six.map(s => `<div class="ex-sc" title="${esc(`${ymLabel(s.y)}: spent ${eur(s.sp)}, profit ${eur(s.pr)}`)}"><div class="bars"><i class="sp" data-v="h:${s.has ? Math.max(2, Math.round(100 * s.sp / smx)) : 0}%"></i><i class="pr${s.pr < 0 ? " neg" : ""}" data-v="h:${s.has ? Math.max(2, Math.round(100 * Math.abs(s.pr) / smx)) : 0}%"></i></div><b>${s.has ? CU_F.eur0(s.pr) : "—"}</b><span>${esc(MON[+s.y.slice(5, 7) - 1])}</span></div>`).join("")}</div>
      <div class="ex-legend"><span><i class="dot c-ink"></i>spent (logged in the sheet)</span><span><i class="dot c-green"></i>profit = Stripe money in − spent</span></div><p class="sp-note">Expense tracking starts ${esc(ymLabel(E.months[0] || E.ym))}; earlier months show money in only. USD converted at ${esc(E.fx || "?")}.</p></section></div>
  ${wdCard}
  <div class="sp-2b">
    <section class="card sp-card"><h2>Who owes whom <small>50/50, all time, EUR</small></h2><div class="ex-owe"><div class="p"><span class="ex-av big">S</span><b>Simas</b><small>${took("Simas")}</small></div>
      <div class="arrow ${ow ? (ow[1] === "Simas" ? "l" : "r") : ""}"><b>${!SP ? "—" : ow ? "€" + esc(ow[2]) : SP.even_out === "Even" ? "Even" : esc(SP.even_out || "—")}</b><i></i><small>${!SP ? "finance data not loaded" : ow ? `${ow[1] === "Simas" ? "Benas" : "Simas"} owes ${ow[1]}` : SP.even_out === "Even" ? "nobody owes anything" : ""}</small></div>
      <div class="p"><span class="ex-av big">B</span><b>Benas</b><small>${took("Benas")}</small></div></div>
      <p class="sp-note">From the Finance sheet (finance.py): what each founder took out of the company, with transfers between you. Display only; the settle-up is done by hand.</p></section>
    <section class="card sp-card"><h2>Is it worth it? <small>${esc(ymLabel(E.ym))} so far</small></h2><div class="wk-stats">${unit("Fixed costs a month", eur(E.run), `${E.nSubs} subscriptions`)}${unit("Cost per new lead", E.contacted ? "€" + (E.spent / E.contacted).toFixed(3) : "—", E.contacted ? `${eur(E.spent)} ÷ ${int(E.contacted)} contacted` : "no data yet")}${unit("Cost per video", E.vids ? eur(E.spent / E.vids) : "—", E.vids ? `${int(E.vids)} delivered` : "no data yet")}${unit("Costs vs revenue", revEur ? (100 * E.spent / revEur).toFixed(1) + "%" : "—", revEur ? `of ${eur(revEur)}` : "no data yet")}</div>
      <p class="sp-note">Logged spend only (${eur(E.spent)} so far; last month ${eur(E.last)}, ${E.avg3 == null ? "no average yet" : `average ${eur(E.avg3)}`}).</p></section></div>
  <section class="card sp-card"><h2>Coming up <small>next 30 days · ${eur(E.sum30)} · 7 days ${eur(E.sum7)}</small></h2><div class="ex-strip">${E.bills.map(b => `<div class="ex-day${b.state === "overdue" ? " late" : ""}"><span>${esc(dLabel(b.due))}</span><b>${esc(b.vendor || b.bill)}</b><em>${money(b.amount, b.currency)}</em><small>${esc(b.payer || "?")}${b.state === "overdue" ? " · overdue" : b.state === "waiting" ? " · no receipt yet" : ""}</small></div>`).join("") || empty("Nothing due in the next 30 days.")}</div></section>
  <details class="card sp-card sp-more" id="ex-tools"><summary>All tools <small>${E.tools.length} · one row per tool</small></summary><div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Tool</th><th>Category</th><th class="num"><button type="button" class="lk" data-exs="month">A month</button></th><th>Billed</th><th>Who pays</th><th>Since</th><th class="num"><button type="button" class="lk" data-exs="total">Paid so far</button></th><th class="num">Last charge</th></tr></thead><tbody>
    ${E.tools.map(o => `<tr><td><b>${esc(o.name)}</b><span class="sub">${esc(o.purpose || "no description in the sheet")}</span>${o.flags.map(f => `<span class="chip ${f[0]} ex-flag">${esc(f[1])}</span>`).join("")}</td><td>${esc(o.cat || "—")}</td><td class="num">${o.month ? eur(o.month) : `<span class="mut">${o.hasSub ? "—" : "one-off"}</span>`}</td><td>${esc(o.billing.join(", ") || "—")}</td><td>${esc(o.payers.join(", ") || "—")}</td><td>${o.since ? esc(dLabel(o.since)) + " " + esc(o.since.slice(0, 4)) : `<span class="mut">no charge logged</span>`}</td><td class="num">${o.total ? eur(o.total) : "—"}</td><td class="num">${o.last ? `${eur(o.last.eur)}<span class="sub">${esc(dLabel(o.last.date))}</span>` : "—"}</td></tr>`).join("")}
  </tbody></table></div><p class="sp-note">Trials aren't tracked in the sheet, so none are flagged.</p></details>
  <details class="card sp-card sp-more" id="ex-all"${E.pending.length ? " open" : ""}><summary>All expenses <small>${E.rows.length} in the sheet · ${eur(E.d.total_eur)} all time${E.pending.length ? ` · ${E.pending.length} waiting to sync` : ""}</small></summary>
    <div class="ex-filters"><input type="search" id="ex-q" placeholder="Search vendor or item" aria-label="Search expenses"><select id="ex-cat" aria-label="Category"><option value="">All categories</option>${E.cats.map(c => `<option>${esc(c)}</option>`).join("")}</select><select id="ex-mo" aria-label="Month"><option value="">All months</option>${E.months.slice().reverse().map(y => `<option value="${y}">${esc(ymLabel(y))}</option>`).join("")}</select><span class="mut" id="ex-n"></span></div>
    <div class="sp-scroll"><table class="sp-tbl" id="ex-tbl"><thead><tr><th>Date</th><th>What</th><th>Category</th><th>Paid by</th><th class="num">EUR</th></tr></thead><tbody>
    ${E.pending.map(e => `<tr data-q="${esc(lc(e.vendor + " " + (e.item || "")))}" data-c="${esc(e.category)}" data-m="${esc(String(e.day).slice(0, 7))}" data-eur="0"><td>${esc(dLabel(e.day))}</td><td>${esc(e.vendor)} <span class="chip o">waiting to sync</span>${ME && e.created_by === ME.id ? ` <button type="button" class="lk" data-exe="${e.id}">edit</button>` : ""}<span class="sub">${esc(e.item || "")}${e.note ? ` · ${esc(e.note)}` : ""}</span></td><td>${esc(e.category)}</td><td>${esc(e.paid_by)}</td><td class="num">${money(e.amount, e.currency)}</td></tr>`).join("")}
    ${E.rows.map(e => `<tr data-q="${esc(lc(e.vendor + " " + (e.item || "")))}" data-c="${esc(e.category || "Other")}" data-m="${esc((e.date || "").slice(0, 7))}" data-eur="${e.eur}"><td>${esc(dLabel(e.date))}</td><td>${esc(e.vendor)}<span class="sub">${esc(e.item || "")}${e.billing ? ` · ${esc(e.billing)}` : ""}</span></td><td>${esc(e.category || "Other")}</td><td>${esc(e.paid_by || "?")}</td><td class="num">${eur(e.eur)}${e.currency && e.currency !== "EUR" ? `<span class="sub">${money(e.amount, e.currency)}${e.fx ? ` at ${e.fx}` : ""}</span>` : ""}</td></tr>`).join("")}
  </tbody></table></div></details>`;
}
function wireExpenses() {
  const keepOpen = () => $$("details.sp-more[open]", PAGE_EL).map(x => x.id);
  const rer = () => { const op = keepOpen(), y = scrollY; PAGE_EL.innerHTML = header("expenses", CACHE.expenses) + viewExpenses(CACHE.expenses); op.forEach(id => { const el = document.getElementById(id); if (el) el.open = true; }); applyVars(PAGE_EL); countUps(PAGE_EL); wireExpenses(); scrollTo(0, y); };
  const filt = () => { const q = lc($("#ex-q").value), c = $("#ex-cat").value, m = $("#ex-mo").value; let n = 0, s = 0; $$("#ex-tbl tbody tr").forEach(tr => { const on = (!q || tr.dataset.q.includes(q)) && (!c || tr.dataset.c === c) && (!m || tr.dataset.m === m); tr.hidden = !on; if (on) { n++; s += +tr.dataset.eur || 0; } }); $("#ex-n").textContent = `${n} shown · ${eur(s)}`; };
  ["ex-q", "ex-cat", "ex-mo"].forEach(id => $("#" + id)?.addEventListener("input", filt)); if ($("#ex-q")) filt();
  $$("[data-exs]", PAGE_EL).forEach(b => b.addEventListener("click", ev => { ev.preventDefault(); EXS = b.dataset.exs; rer(); }));
  $$("[data-mo]", PAGE_EL).forEach(b => b.addEventListener("click", () => { const n = +b.dataset.mo, now = dayOf(Date.now()).slice(0, 7); EXM = n ? ymAdd(EXM, n) : now; const u = new URL(location.href); EXM === now ? u.searchParams.delete("m") : u.searchParams.set("m", EXM); history.replaceState({ p: "expenses" }, "", u); rer(); }));
  $$("[data-tick]", PAGE_EL).forEach(b => b.addEventListener("click", async () => {
    const key = b.dataset.tick, paid = b.getAttribute("aria-pressed") !== "true", row = { month: EXM, key, paid, paid_at: paid ? new Date().toISOString() : null, by: (ME && ME.who !== "Both" ? ME.who : (ME && ME.name)) || null };
    const L = CACHE.expenses.status, old = L.slice(); CACHE.expenses.status = [...L.filter(r => !(r.month === EXM && r.key === key)), row]; rer(); $(`[data-tick="${CSS.escape(key)}"]`)?.focus();
    try { await must(sb().from("expense_status").upsert(row)); } catch (e) { CACHE.expenses.status = old; rer(); toast("Couldn't save that tick. Check your connection."); }
  }));
  $("#ex-add")?.addEventListener("click", () => { EXE = EXE ? null : {}; rer(); $("#ex-form input[name=vendor]")?.focus(); });
  $$("[data-exe]", PAGE_EL).forEach(b => b.addEventListener("click", () => { EXE = CACHE.expenses.entries.find(e => e.id === +b.dataset.exe) || null; rer(); scrollTo(0, 0); }));
  $("#ex-cancel")?.addEventListener("click", () => { EXE = null; rer(); });
  $("#ex-del")?.addEventListener("click", async () => { const id = +$("#ex-form").dataset.id; if (!confirm("Delete this expense?")) return;
    try { await must(sb().from("expense_entries").delete().eq("id", id)); CACHE.expenses.entries = CACHE.expenses.entries.filter(e => e.id !== id); EXE = null; rer(); toast("Expense deleted"); } catch (e) { toast("Couldn't delete it: it may already be in the sheet."); } });
  $("#ex-form")?.addEventListener("submit", async ev => {
    ev.preventDefault(); const f = ev.target, id = +f.dataset.id || null, url = f.receipt_url.value.trim();
    const row = { day: f.day.value, vendor: f.vendor.value.trim(), item: f.item.value.trim() || null, amount: +f.amount.value, currency: f.currency.value, category: f.category.value, paid_by: f.paid_by.value, recurring: f.recurring.value, note: f.note.value.trim() || null, receipt_url: url || null };
    if (!row.vendor || !(row.amount > 0)) return; if (url && !/^https:\/\//.test(url)) { toast("The receipt link must start with https://"); return; }
    try { const saved = id ? await must(sb().from("expense_entries").update(row).eq("id", id).select().single()) : await must(sb().from("expense_entries").insert({ ...row, created_name: (ME && ME.name) || null }).select().single());
      CACHE.expenses.entries = [saved, ...CACHE.expenses.entries.filter(e => e.id !== saved.id)]; EXE = null; rer(); toast(id ? "Expense updated" : "Expense added: it reaches the sheet with the next sync"); }
    catch (e) { toast("Couldn't save it. " + String(e && e.message || e).slice(0, 80)); }
  });
  if (!EX_CH && sb()) EX_CH = sb().channel("side-exp").on("postgres_changes", { event: "*", schema: "public", table: "expense_status" }, async () => { if (PAGE !== "expenses" || !CACHE.expenses || EXE) return; try { CACHE.expenses.status = await all("expense_status", "*"); const a = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.tick : null; rer(); if (a) $(`[data-tick="${CSS.escape(a)}"]`)?.focus(); } catch {} }).subscribe();
}

/* 2. email campaigns (SIMAS 11-19 18:5x: "show the winner, highlight the winner. And also say the changes are done or not").
   BENAS 11-22 redesign ("Email tests" -> "Email campaigns"): an overview board (Changes to make · Best campaign · Revenue by campaign ·
   Tests running), a "Needs a look" strip only when something is flagged, then one tile per campaign (new leads emailed today or
   yesterday + positive-reply rate). Everything else (A vs B, the emails, rules, change log, full table, partners, subject lines, history)
   opens in a side panel (a bottom sheet on a phone). Same data and requests as before.
   Today / yesterday: campaign_daily.day is Instantly's sending day (America/Chicago, like instantly-sync's sent_today). Sends run in the
   Chicago daytime (Vilnius late afternoon to about 01:00), so the tiles show the last full day until today's row has sends > 0.
   "Draft a challenger" adds an ab_actions row with action 'challenger_requested' and no done_at, for the Claude ops agents to pick up;
   "Mark change done" turns that row into the done change. The switch in Instantly is never automated. */
async function loadEmail() {
  await me();
  const [ab, m, acts, arms, cd, il, rev, sync] = await Promise.all([panel("ab_tests"), panel("metrics").catch(() => null), all("ab_actions", "*", q => q.order("id", { ascending: false })).catch(() => []), panel("arms").catch(() => null),
    all("campaign_daily", "campaign_id,day,sent,new_leads,replies,opportunities", q => q.gte("day", addDays(dayOf(Date.now()), -13))).catch(() => []), all("interested_leads", "campaign_id,interest_changed_at,last_reply_at,created_at").catch(() => []),
    must(sb().from("campaign_revenue").select("campaign_id,campaign_name,revenue_usd,payers,payments,first_paid_at,last_paid_at")).catch(() => null), all("sync_status", "name,ran_at,max_age_min").catch(() => [])]);
  return { ab, m, acts, arms, cd: fixOpp(cd, il), rev, sync, at: Date.now() };
}
const abAct = (acts, key, step) => acts.find(a => a.campaign === key && a.step === step) || null;   // newest first
const CHREQ = "challenger_requested";
function abStatus(c, s, acts) {
  const a = abAct(acts, c.key, s.step), win = s.state === "winner" ? s.lead : null;
  if (a && a.done_at) return { k: "done", chip: "chip g", text: `Change done ${dLabel(dayOf(a.done_at))}${a.done_by ? ` by ${a.done_by}` : ""}: ${a.action || `variant ${a.loser || "?"} dropped`}${a.note ? ` · ${a.note}` : ""}`, a };
  if (win || a) { const w = win || (a && a.winner), l = w === "B" ? "A" : "B"; return { k: "due", chip: "chip o", text: `Change due: drop ${l}, write a new challenger against ${w}`, a, w, l, req: !!a && a.action === CHREQ }; }
  return { k: "none", chip: "chip", text: "No change needed yet", a: null };
}
const SEND_TZ = "America/Chicago";
const sParts = new Intl.DateTimeFormat("en-GB", { timeZone: SEND_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const sendDay = t => { const p = Object.fromEntries(sParts.formatToParts(new Date(t)).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; };
const ecName = n => String(n || "").replace(/ — test\b/, " (test)").replace(/^TEST — /, "Test: ").replace(/ — V1 Batch 1$/, "").replace(/ \(\d\d-\d\d\)$/, "").replace(/^ARM (T\d) — /, "$1 · ").replace(/ — /g, " · ");
/* AUDIT 11-22 (BENAS: "make sure everything is accurate and we can trust it"): each part says how old ITS data is, not when the page loaded.
   Three syncs feed this page, each with its own max age in sync_status: panel_ab_tests (A/B + queued, hourly), panel_metrics (all-time totals,
   every 15 min) and instantly (campaign_daily: the day's sending). Older than its max age = stale, said in words. */
/* BENAS 11-22: the campaign tiles fall into three groups by size. Main lanes = active campaigns with at least EC_MAIN_CONTACTED leads contacted
   in total, or at least EC_MAIN_DAY new leads emailed on the tiles' day (today / yesterday); every other active one is a test or small lane; paused last */
const EC_MAIN_CONTACTED = 300, EC_MAIN_DAY = 20;
const EC_SRC = [["ab", "panel_ab_tests", 90, "A/B numbers"], ["m", "panel_metrics", 45, "campaign totals"], ["cd", "instantly", 25, "daily sending"]];
function ecFresh(x) {
  const ss = Object.fromEntries((x.sync || []).map(r => [r.name, r]));
  return EC_SRC.map(([k, name, def, label]) => { const r = ss[name], at = k === "ab" ? x.ab && x.ab.updated_at : k === "m" ? x.m && x.m.updated_at : r ? r.ran_at : null, max = (r && +r.max_age_min) || def;
    return { k, label, at, max, old: !!at && Date.now() - new Date(at) > max * 6e4 }; });
}
const ecAsOf = (x, ks) => { const F = ecFresh(x).filter(f => ks.includes(f.k) && f.at), o = F.slice().sort((a, b) => new Date(a.at) - new Date(b.at))[0], st = F.filter(f => f.old);
  return o ? `<span class="ec-asof${st.length ? " old" : ""}" title="${esc(F.map(f => `${f.label}: synced ${ago(f.at)}, runs at least every ${f.max} min`).join(" · "))}">as of ${dayOf(o.at) === dayOf(Date.now()) ? "" : esc(dLabel(dayOf(o.at))) + ", "}${esc(hm(o.at))}${st.length ? ` · ${esc(st.map(f => f.label).join(", "))} out of date` : ""}</span>` : ""; };
const ecWhen = t => t ? `${dLabel(dayOf(t))}, ${hm(t)}` : "—";
const r1 = v => v == null || !isFinite(v) ? "—" : (+v).toFixed(1) + "%";
const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), i = s.length >> 1; return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };
const ecPill = (t, k = "") => `<span class="ec-pill${k ? " " + k : ""}">${esc(t)}</span>`;
let EPAN = null, EFOCUS = null, EIN = false, EPOFF = false;   // the open side panel ({ k, id }), the overview control that opened it ([section class, data-ecopen]), whether it just opened (its entrance plays once), and whether the paused group is open (closed again on every page open)
function emailModel(x) {
  const d = x.ab.data, M = (x.m && x.m.data) || {}, acts = x.acts || [], R = d.rules || {}, MIN = R.min_sends || 300, MINP = R.min_pos || 8;
  const abC = d.campaigns, mC = Array.isArray(M.campaigns) ? M.campaigns : [];
  const tests = abC.flatMap(c => (c.steps || []).map(s => ({ c, s, st: abStatus(c, s, acts) })));
  const due = tests.filter(z => z.st.k === "due");
  const split = tests.filter(z => z.s.in_test !== false && z.c.since && z.s.A && z.s.B && z.s.A.sent > 0 && z.s.B.sent > 0);
  const stalled = split.filter(z => z.s.state !== "winner" && z.s.queued === 0), running = split.filter(z => !stalled.includes(z));   // AUDIT 11-22: queued 0 = no lead left for this email, the test can't move
  const prog = s => Math.min(1, Math.min(s.A.sent, s.B.sent) / MIN, ((+s.A.positives || 0) + (+s.B.positives || 0)) / MINP);   // the gate that is further away
  const open = running.filter(z => z.s.state !== "winner"), early = open.filter(z => z.s.state === "too_early"), near = open.filter(z => prog(z.s) < 1).sort((a, b) => prog(b.s) - prog(a.s))[0] || null;
  /* 11-21 (SIMAS: "how much has the campaigns generated revenue each"): public.campaign_revenue. While the view is missing, no revenue part shows */
  const REV = Array.isArray(x.rev) ? x.rev : null, revUn = r => !r.campaign_id || r.campaign_id === "unattributed";
  const revBy = Object.fromEntries((REV || []).filter(r => !revUn(r)).map(r => [r.campaign_id, r]));
  /* the day the campaign tiles show (see the note above loadEmail) */
  const now = Date.now(), vt = dayOf(now), sd = sendDay(now), cd = x.cd || [];
  const started = cd.some(r => r.day === sd && (+r.sent || 0) > 0);
  const day = sd === vt && !started ? addDays(sd, -1) : sd, isToday = day === vt, live = day === sd, full = live ? addDays(day, -1) : day;   // AUDIT 11-22: 00:00-01:00 Vilnius the Chicago day is still sending
  const rowsOf = {}; cd.forEach(r => (rowsOf[r.campaign_id] = rowsOf[r.campaign_id] || []).push(r));
  const sumIn = (id, a, b, k) => (rowsOf[id] || []).filter(r => r.day >= a && r.day <= b).reduce((s, r) => s + (+r[k] || 0), 0);
  const normB = (id, end) => { const v = (rowsOf[id] || []).filter(r => r.day < end && r.day >= addDays(end, -13) && (+r.sent || 0) > 0).map(r => +r.new_leads || 0); return v.length >= 3 ? median(v) : 0; };
  /* one tile per campaign: everything in the Instantly metrics sync, plus any A/B campaign it doesn't have */
  const abBy = Object.fromEntries(abC.filter(c => c.campaign).map(c => [c.campaign, c])), seen = new Set();
  const T = mC.map(m => { const ab = abBy[m.name] || null; if (ab) seen.add(ab.key); return { id: String(m.id), full: m.name, m, ab, st: m.status }; })
    .concat(abC.filter(c => !seen.has(c.key)).map(c => ({ id: "ab-" + c.key, full: c.campaign || c.name, m: null, ab: c, st: c.status })));
  T.forEach(t => {
    const r = (rowsOf[t.id] || []).find(z => z.day === day), steps = (t.ab && t.ab.steps) || [], ins = t.ab && t.ab.since ? steps.filter(s => s.in_test !== false && s.A && s.B) : [], win = steps.find(s => s.state === "winner");
    Object.assign(t, { name: ecName(t.full), on: t.st === 1, nl: r ? +r.new_leads || 0 : 0, fu: r ? Math.max(0, (+r.sent || 0) - (+r.new_leads || 0)) : 0, norm: normB(t.id, live ? sd : day),
      left: t.m && isFinite(t.m.leads) && isFinite(t.m.contacted) ? Math.max(0, t.m.leads - t.m.contacted) : null,
      rev: REV && t.m ? revBy[t.m.id] || { revenue_usd: 0, payers: 0 } : null, flags: [] });
    /* AUDIT 11-22: Instantly status 0 draft, 2 paused, 3 completed (anything else not 1 is not sending); a campaign outside the A/B sync is "No A/B", not "One version" */
    t.pill = !t.on ? ({ 0: "Draft", 2: "Paused", 3: "Finished" }[t.st] || "Not sending") : win ? `Winner ${win.lead}` : !t.ab ? "No A/B" : !ins.length ? "One version" : ins.some(s => s.A.sent >= MIN && s.B.sent >= MIN) ? "Testing A/B" : "Too early";
    t.pk = !t.on ? "off" : win ? "win" : ins.length ? "ab" : "";
  });
  const tileOf = c => T.find(t => t.ab === c) || null;
  /* Needs a look: act = a change to make (amber), warn = something is wrong (red), info = worth a look (grey) */
  due.forEach(z => { const t = tileOf(z.c); if (t) t.flags.push({ kind: "act", text: `${z.s.step}: ${z.st.w} beat ${z.st.l}. ${z.st.req ? "A new challenger is being drafted." : `Drop ${z.st.l}, write a new challenger.`}`, btn: "Review change" }); });
  const act = T.filter(t => t.on), exp = live ? Math.min(1, act.reduce((a, t) => a + t.nl, 0) / Math.max(1, act.reduce((a, t) => a + t.norm, 0))) : 1;   // how far today's sending is, across all lanes
  act.forEach(t => {
    const f = (kind, text) => t.flags.push({ kind, text, btn: "Open" }), s0 = ((t.ab && t.ab.steps) || [])[0];
    if (t.norm >= 10 && (live ? exp >= .25 && t.nl < .4 * t.norm * exp : t.nl < .5 * t.norm)) f("warn", `${int(t.nl)} new leads emailed ${live ? `so far ${isToday ? "today" : "on " + dLabel(day)}` : isToday ? "today" : "yesterday"}, usually about ${int(t.norm)} a day`);
    /* lead supply (AUDIT 11-22, BENAS "out of new leads ... is it accurate?"): out = no lead waiting for email 1 (A/B sync's queue, else Instantly leads − contacted);
       low = 2 days or less at its usual pace. Both say how many are left and that the campaign needs a lead push. Paused / finished campaigns never get these. */
    const q = s0 && typeof s0.queued === "number" ? s0.queued : t.left, L = t.m ? int(t.m.leads) : "";
    t.out = q != null && q <= 0; t.low = !t.out && t.left != null && t.norm >= 5 && t.left <= 2 * t.norm;
    if (t.out) f("warn", `out of new leads: ${t.left ? `${int(t.left)} of ${L} not emailed yet but none queued for email 1` : t.m ? `all ${L} emailed` : "none queued for email 1"}. Needs a lead push.`);
    else if (t.low) f("info", `running low: ${int(t.left)} new leads left, about ${t.left < t.norm ? "less than a day" : `${Math.round(t.left / t.norm)} day${Math.round(t.left / t.norm) === 1 ? "" : "s"}`} at ${int(t.norm)} a day. Needs a lead push soon.`);
    const z = t.ab && t.ab.since && (t.ab.steps || []).find(s => s.in_test !== false && s.A && s.B && Math.max(s.A.sent, s.B.sent) >= 30 && Math.min(s.A.sent, s.B.sent) === 0);
    if (z) f("warn", `${z.step}: ${z.A.sent ? "B" : "A"} has sent 0 emails since the split`);
    if (t.m && t.m.bounce_rate >= 3) f("warn", `bounce rate ${r1(t.m.bounce_rate)}, all time`);
    if (t.m && t.m.contacted >= 150 && !(+t.m.opportunities)) f("warn", `dead lane: ${int(t.m.contacted)} leads contacted, 0 positive replies`);
    const r3 = sumIn(t.id, addDays(full, -2), full, "replies"), base = sumIn(t.id, addDays(full, -12), addDays(full, -3), "replies") * 3 / 10;
    const r3w = `${int(r3)} repl${r3 === 1 ? "y" : "ies"} ${dLabel(addDays(full, -2))}–${addDays(full, -2).slice(0, 7) === full.slice(0, 7) ? +full.slice(8, 10) : dLabel(full)}, usually about ${int(base)} in 3 days`;   // AUDIT 11-22: the 3 full days it counts, named (today is left out)
    if (r3 >= 5 && r3 >= 2.5 * base) f("info", r3w);
    else if (base >= 6 && r3 <= .25 * base) f("warn", r3w);
  });
  const KO = { act: 0, warn: 1, info: 2 };
  T.forEach(t => { t.flags.sort((a, b) => KO[a.kind] - KO[b.kind]); t.sev = t.flags.some(f => f.kind === "warn") ? "warn" : t.flags[0] ? t.flags[0].kind : ""; });
  T.sort((a, b) => (b.on - a.on) || (!!b.sev - !!a.sev) || (b.nl - a.nl) || a.name.localeCompare(b.name));   // flagged first, then today's sending, paused last
  const S = d.subjects && d.subjects.since ? d.subjects : null;
  /* two or more lead-supply flags read as one line in Needs a look (the tiles keep their own); "Which ones" opens the list */
  const out = T.filter(t => t.on && t.out), low = T.filter(t => t.on && t.low), sup = out.length + low.length >= 2, isSup = f => /^(out of new leads|running low)/.test(f.text || "");
  const supF = sup ? [{ kind: out.length ? "warn" : "info", sup: { out, low }, btn: "Which ones" }] : [];
  const flags = [...(S ? (S.groups || []).filter(g => g.state === "winner" || g.state === "tie").map(g => ({ kind: "act", subj: g, btn: "Open" })) : []), ...supF, ...T.flatMap(t => t.flags.filter(f => !(sup && isSup(f))).map(f => ({ ...f, t })))]
    .sort((a, b) => KO[a.kind] - KO[b.kind]);
  /* v7 rule (SIMAS 11-21), renamed "Best campaign" (BENAS 11-22): the best all-time positive rate among campaigns with 100+ leads contacted */
  const best = mC.filter(c => c.contacted >= 100 && c.pos_rate != null).sort((a, b) => b.pos_rate - a.pos_rate || b.contacted - a.contacted)[0] || null;
  /* BENAS 11-22: active tiles only. The Best campaign's own tile gets the highlight; the top sender of the tiles' day (most new leads; a tie goes to
     the first in order; none when nobody sent) gets "Most sent". Groups: see EC_MAIN_CONTACTED */
  const most = T.filter(t => t.on && t.nl > 0).reduce((a, t) => a && a.nl >= t.nl ? a : t, null);
  T.forEach(t => { t.isBest = !!best && t.on && t.m === best; t.isMost = t === most; t.grp = !t.on ? "off" : (t.m && +t.m.contacted >= EC_MAIN_CONTACTED) || t.nl >= EC_MAIN_DAY ? "main" : "small"; });
  const nameOfId = id => { const t = T.find(y => y.m && String(y.m.id) === String(id)); return t ? t.name : ""; };
  const top3 = REV ? REV.filter(r => !revUn(r) && +r.revenue_usd > 0).sort((a, b) => b.revenue_usd - a.revenue_usd).slice(0, 3).map(r => ({ ...r, name: nameOfId(r.campaign_id) || ecName(r.campaign_name) || "Unnamed" })) : [];
  return { d, M, acts, R, MIN, MINP, tests, due, running, stalled, early, near, prog, out, low, REV, revUn, nameOfId, T, tileOf, flags, best, bestT: best ? T.find(t => t.m === best) : null, top3, day, isToday, S };
}
function viewEmail(x) {
  const d = x.ab && x.ab.data;
  if (!d || !Array.isArray(d.campaigns)) return empty("No A/B data yet. It arrives with the next sync (hourly).");
  const E = emailModel(x), dayW = E.isToday ? "today" : "yesterday";
  const d1 = E.due.length === 1 ? E.tileOf(E.due[0].c) : null, np = E.near ? Math.round(100 * E.prog(E.near.s)) : 0;
  const board = `<button type="button" class="tile ec-t${E.due.length ? " ec-due" : ""}" data-ecopen="${d1 ? "camp:" + esc(d1.id) : "changes"}" title="Tests with a winner waiting: drop the loser and write a new challenger"><span class="ec-l">Changes to make</span><b class="ec-n">${cu(E.due.length, "int", "ec-due")}</b><small>${E.due.length ? d1 ? `${esc(d1.name)} · ${esc(E.due[0].s.step)}` : `in ${new Set(E.due.map(z => z.c.key)).size} campaigns` : "nothing waiting"}</small></button>`
    + `<button type="button" class="tile ec-t ec-best" ${E.bestT ? `data-ecopen="camp:${esc(E.bestT.id)}"` : 'data-ecopen="table"'} title="Highest positive-reply rate among campaigns with 100+ leads contacted, all time, from Instantly"><span class="ec-l">Best campaign</span><b class="ec-n">${E.best ? cu(E.best.pos_rate, "pct", "ec-best") : "—"}</b><small>${E.best ? `${esc(ecName(E.best.name))} · positive replies` : "no campaign has 100 leads yet"}</small></button>`
    + `<button type="button" class="tile ec-t ec-rev" data-ecopen="rev" title="Paid revenue credited to each campaign"><span class="ec-l">Revenue by campaign</span>${E.REV ? E.top3.length ? `<span class="ec-r3">${E.top3.map((r, i) => `<span class="ec-r"><b class="ec-n2">${cu(r.revenue_usd, "usd", "ec-rev" + i)}</b><small>${esc(r.name)}</small></span>`).join("")}</span>` : `<b class="ec-n">$0</b><small>no campaign has revenue yet</small>` : `<b class="ec-n">—</b><small>the revenue view isn't live yet</small>`}</button>`
    + `<button type="button" class="tile ec-t ec-tst" data-ecopen="tests" title="A and B both sending since the split, with leads still waiting for that email (stalled = none left). A verdict needs ${E.MIN}+ sends per side and ${E.MINP}+ positives.${E.near ? ` Closest: ${esc((E.tileOf(E.near.c) || {}).name || "")}, ${esc(E.near.s.step)}.` : ""}"><span class="ec-l">Tests running</span><span class="ec-tr"><b class="ec-n">${cu(E.running.length, "int", "ec-run")}</b>${E.near ? `<i class="ring ec-ring" data-v="p:${np}" aria-hidden="true"></i>` : ""}</span><small>${E.running.length && E.early.length === E.running.length ? "all too early" : `${int(E.early.length)} too early`}${E.stalled.length ? ` · ${int(E.stalled.length)} stalled, no leads left` : ""}${E.near ? ` · closest ${np}% there` : ""}</small></button>`;
  const hero = `<section class="card sp-card ec-hero" aria-labelledby="ec-ov"><div class="ec-hh"><h2 id="ec-ov">Overview</h2>${ecAsOf(x, ["ab", "m"])}</div><div class="ec-btns">${[["subj", "Subject lines"], ["table", "Full table"], ["partners", "Partners"], ["history", "History"]].map(([k, l]) => `<button type="button" class="act" data-ecopen="${k}">${l}</button>`).join("")}</div><div class="ec-board">${board}</div></section>`;
  const look = E.flags.length ? `<section class="card sp-card ec-look" aria-labelledby="ec-lk"><div class="ec-ch"><h2 id="ec-lk">Needs a look</h2>${ecAsOf(x, ["ab", "m", "cd"])}</div><div class="ec-flags">${E.flags.slice(0, 5).map(ecFlag).join("")}</div>${E.flags.length > 5 ? `<button type="button" class="act ec-more" data-ecopen="look">All ${E.flags.length} flags</button>` : ""}</section>` : "";
  const dot = t => t.sev ? `<i class="ec-dot k-${t.sev}" title="In Needs a look"></i>` : "", cls = t => `mt ec-c${t.on ? "" : " off"}${t.isBest ? " ec-top" : ""}`;
  const crown = t => t.isBest ? `<span class="ec-crown" title="Best campaign: highest positive-reply rate among campaigns with 100+ leads contacted"><span aria-hidden="true">★</span> Best</span><i class="ec-shine" aria-hidden="true"></i>` : "";
  const most = t => t.isMost ? `<span class="ec-most" title="Most new leads emailed ${dayW}">Most sent</span>` : "";
  const sends = (t, lab, sub) => `<span class="ec-num ec-nl${t.isMost ? " has-most" : ""}"><b class="ec-n2">${cu(t.nl, "int", esc("ec-nl-" + t.id))}</b>${lab}${sub}${most(t)}</span>`;
  const tile = t => `<button type="button" class="${cls(t)}" data-ecopen="camp:${esc(t.id)}" title="${esc(t.full)}">${crown(t)}<span class="ec-ct"><span class="ec-cn">${esc(t.name)}</span>${dot(t)}${ecPill(t.pill, t.pk)}</span>
    <span class="ec-two">${sends(t, `<span class="ec-l">New leads emailed <strong>${dayW}</strong></span>`, `<small>${t.fu ? `+${int(t.fu)} follow-up${t.fu === 1 ? "" : "s"}` : "no follow-ups"}</small>`)}<span class="ec-num"><b class="ec-n2">${t.m && t.m.pos_rate != null ? cu(t.m.pos_rate, "pct", esc("ec-pr-" + t.id)) : "—"}</b><span class="ec-l">Positive-reply rate</span><small>${t.m ? `${int(t.m.opportunities)} of ${int(t.m.contacted)} leads` : "not in the metrics sync"}</small></span></span></button>`;
  /* compact tile (tests, small lanes, paused): the name, one number (new leads emailed on the tiles' day) and the status pill */
  const mini = t => `<button type="button" class="${cls(t)} ec-sm" data-ecopen="camp:${esc(t.id)}" title="${esc(t.full)}">${crown(t)}<span class="ec-ct"><span class="ec-cn">${esc(t.name)}</span>${dot(t)}</span><span class="ec-sr">${sends(t, "", `<small>new leads ${dayW}</small>`)}${ecPill(t.pill, t.pk)}</span></button>`;
  const G = k => E.T.filter(t => t.grp === k), gMain = G("main"), gSmall = G("small"), gOff = G("off");
  const grp = (k, label, list, fn) => list.length ? `<div class="ec-grp" data-ecgrp="${k}"><h3 class="ec-h3">${label}<small>${list.length}</small></h3><div class="ec-grid${fn === mini ? " sm" : ""}">${list.map(fn).join("")}</div></div>` : "";
  const paused = gOff.length ? `<div class="ec-grp" data-ecgrp="off"><button type="button" class="act ec-pbtn" data-ecpaused aria-expanded="${EPOFF}">Paused (${gOff.length})</button>${EPOFF ? `<div class="ec-grid sm">${gOff.map(mini).join("")}</div>` : ""}</div>` : "";
  const camps = `<section class="ec-camps" aria-labelledby="ec-cs"><div class="ec-ch"><h2 id="ec-cs">Campaigns</h2>${ecAsOf(x, ["cd", "m"])}</div>${grp("main", "Main lanes", gMain, tile)}${grp("small", "Tests and small lanes", gSmall, mini)}${paused}</section>`;
  return `${hero}${look}${camps}<div id="ec-pan">${ecPanel(E, x)}</div>`;
}
const ecSupT = ({ out, low }) => `${out.length ? `${out.length} campaign${out.length === 1 ? " is" : "s are"} out of new leads` : ""}${out.length && low.length ? ", " : ""}${low.length ? `${low.length} ${out.length ? "more " : ""}run${low.length === 1 ? "s" : ""} out within 2 days` : ""}. Needs a lead push.`;
const ecFlag = f => `<div class="ec-f k-${f.kind}"><i aria-hidden="true"></i><span>${f.subj ? `<b>Subject lines</b> · ${esc(f.subj.name)}: ${esc(f.subj.verdict || "")}` : f.sup ? `<b>New leads</b> · ${esc(ecSupT(f.sup))}` : `<b>${esc(f.t.name)}</b> · ${esc(f.text)}`}</span><button type="button" class="act" data-ecopen="${f.subj ? "subj" : f.sup ? "supply" : "camp:" + esc(f.t.id)}">${esc(f.btn)}</button></div>`;
/* the side panels: the to-dos board's .sd-panel (bottom sheet on a phone), Esc or the scrim closes it */
function ecPanel(E, x) {
  if (!EPAN) return "";
  const k = EPAN.k, li = (main, side) => `<div class="ec-li"><span>${main}</span>${side || ""}</div>`, go = id => `<button type="button" class="act" data-ecopen="camp:${esc(id)}">Open</button>`;
  let top = "", title = "", body = "", wide = false;
  if (k === "camp") {
    const t = E.T.find(y => y.id === EPAN.id); if (!t) { EPAN = null; return ""; }
    top = `${ecPill(t.pill, t.pk)}${t.on ? "" : `<span class="mut">${esc((t.m && t.m.status_label) || "paused")}</span>`}`; title = esc(t.name); body = ecCamp(E, x, t);
  } else if (k === "changes") {
    title = "Changes to make";
    body = E.due.length ? `<div class="ec-list">${E.due.map(z => { const t = E.tileOf(z.c); return li(`<b>${esc(t ? t.name : z.c.name)}</b> · ${esc(z.s.step)}: ${z.st.w} beat ${z.st.l}${z.st.req ? " · challenger requested" : ""}`, t ? go(t.id) : ""); }).join("")}</div>` : `<p class="ec-p">No test has a winner waiting. Past changes are in History.</p>`;
  } else if (k === "supply") {
    title = "New leads left"; const rows = [...E.out, ...E.low];
    body = `<p class="ec-p">${esc(ecSupT(E))} Left = leads in the campaign not emailed yet (Instantly); usual = its median new leads a day over the last 2 weeks.</p><div class="ec-list">${rows.map(t => li(`<b>${esc(t.name)}</b><small>${t.left != null ? `${int(t.left)} of ${int(t.m.leads)} left` : "no lead count"}${t.norm ? ` · usually ${int(t.norm)} a day` : ""}</small>`, `${ecPill(t.out ? "Out" : "Low", t.out ? "warn" : "")}${go(t.id)}`)).join("")}</div>`;
  } else if (k === "look") {
    title = "Needs a look"; body = `<div class="ec-flags">${E.flags.map(ecFlag).join("")}</div>`;
  } else if (k === "rev") {
    title = "Revenue by campaign"; const rows = E.REV ? E.REV.filter(r => !E.revUn(r)).sort((a, b) => b.revenue_usd - a.revenue_usd) : [];
    body = !E.REV ? `<p class="ec-p">The campaign_revenue view isn't live yet.</p>` : `<div class="ec-list">${rows.map(r => li(`<b>${esc(E.nameOfId(r.campaign_id) || ecName(r.campaign_name) || "Unnamed")}</b><small>${int(r.payers)} paying client${+r.payers === 1 ? "" : "s"}</small>`, `<span class="ec-v">${usd(r.revenue_usd)}</span>`)).join("")}${li(`<b>Not from a campaign</b>`, `<span class="ec-v">${usd(E.REV.filter(E.revUn).reduce((a, r) => a + (+r.revenue_usd || 0), 0))}</span>`)}</div>`;
  } else if (k === "tests") {
    title = "Tests"; const all = [...E.tests].sort((a, b) => (b.s.state === "winner") - (a.s.state === "winner") || (E.running.includes(b) - E.running.includes(a)) || (E.stalled.includes(b) - E.stalled.includes(a)) || (E.running.includes(b) ? E.prog(b.s) - E.prog(a.s) : 0));
    body = `<p class="ec-p">A verdict needs ${E.MIN}+ sends on each side and ${E.MINP}+ positive replies${E.R.p_win ? `, and ${Math.round(100 * E.R.p_win)}% certainty that the leader is better` : ""}.</p><div class="ec-list">${all.map(z => { const t = E.tileOf(z.c), s = z.s, on = E.running.includes(z);
      const stl = E.stalled.includes(z);
      return li(`<b>${esc(t ? t.name : z.c.name)}</b> · ${esc(s.step)}<small>${on || stl ? `${stl ? "No lead left for this email · " : ""}A ${r1(s.A.pos_rate || 0)} · B ${r1(s.B.pos_rate || 0)} · ${int(Math.min(s.A.sent, s.B.sent))}/${E.MIN} sends on the smaller side · ${int((+s.A.positives || 0) + (+s.B.positives || 0))}/${E.MINP} positives` : !z.c.since ? "not split yet" : s.in_test === false ? "one version" : "waiting for both sides to send"}</small>`,
        `${s.state === "winner" ? ecPill(`Winner ${s.lead}`, "win") : stl ? ecPill("Stalled", "warn") : ecPill(on ? (s.state === "leading" ? `${s.lead} ahead` : "Too early") : "Not running", on ? "ab" : "")}${t ? go(t.id) : ""}`); }).join("")}</div>`;
  } else if (k === "subj") {
    title = "Subject lines"; body = ecSubj(E.S);
  } else if (k === "table") {
    title = "All campaigns"; wide = true; body = ecTable(E, x);
  } else if (k === "partners") {
    title = "Partner campaigns";
    const part = x.arms && x.arms.data ? (x.arms.data.arms || []).filter(a => (a.campaigns || []).some(n => /PARTNER/i.test(n))) : null;
    body = part && part.length ? `<p class="ec-p">Arms are tags on the leads, not Instantly variants.${part.every(a => (a.contacted || 0) < 100) ? " Too early for a winner: every arm is under 100 leads contacted." : ""}</p><div class="ec-list">${part.map(a => li(`<b>${esc(a.arm)}</b><small>${esc((a.campaigns || []).filter(n => /PARTNER/i.test(n)).map(n => ecName(n.replace(/^PARTNER\s*/i, ""))).join(", "))}</small>`, `<span class="ec-v">${a.reply_rate == null ? "0%" : a.reply_rate.toFixed(1) + "%"} replied<small>${int(a.positive)} positive · ${int(a.contacted)} contacted</small></span>`)).join("")}</div>` : `<p class="ec-p">No data yet: no partner-campaign leads are tagged in the arms sync.</p>`;
  } else if (k === "history") {
    title = "History"; const done = E.acts.filter(a => a.done_at), req = E.acts.filter(a => !a.done_at && a.action === CHREQ);
    body = `${req.length ? `<h3 class="ec-h3">Waiting for Claude</h3>${ecLog(E, req)}` : ""}<h3 class="ec-h3">Past changes</h3>${done.length ? ecLog(E, done) : `<p class="ec-p">No test has been decided yet. The first verdicts come once each side has ${E.MIN} sends.</p>`}`;
  } else { EPAN = null; return ""; }
  const inC = EIN ? " in" : ""; EIN = false;
  return `<div class="sd-scrim${inC}" data-ecclose></div><aside class="sd-panel ec-panel${wide ? " wide" : ""}${inC}" role="dialog" aria-modal="true" aria-labelledby="ec-pt" data-keep>
    <div class="sd-pt"><span class="ec-ptop">${top}</span><button type="button" class="mini" data-ecclose aria-label="Close" title="Close (Esc)"><svg aria-hidden="true"><use href="#i-x"/></svg></button></div>
    <h2 class="ec-ph" id="ec-pt">${title}</h2>${body}</aside>`;
}
const ecLog = (E, rows) => `<div class="ec-list">${rows.map(a => { const t = E.T.find(y => y.ab && y.ab.key === a.campaign);
  return `<div class="ec-li"><span><b>${esc(t ? t.name : a.campaign)}</b> · ${esc(a.step)}: ${esc(a.action === CHREQ ? `new challenger against ${a.winner || "?"} requested from Claude` : a.action || `kept ${a.winner || "?"}, dropped ${a.loser || "?"}`)}${a.note ? ` · ${esc(a.note)}` : ""}<small>${esc(ecWhen(a.done_at || a.decided_at))}${a.done_by ? ` · ${esc(a.done_by)}` : ""}</small></span>${a.done_at ? "" : `<button type="button" class="act" data-abcancel="${esc(a.id)}">Cancel request</button>`}</div>`; }).join("")}</div>`;
function ecCamp(E, x, t) {
  const c = t.ab, MIN = E.MIN, MINP = E.MINP, dayW = E.isToday ? "today" : "yesterday", isN = v => typeof v === "number" && isFinite(v);
  const out = [t.full !== t.name ? `<p class="ec-p mut">${esc(t.full)}</p>` : ""];
  /* why this tile is in Needs a look (the A/B change has its own box below) */
  const fl = t.flags.filter(f => f.kind !== "act");
  if (fl.length) out.push(`<div class="ec-flags">${fl.map(f => `<div class="ec-f k-${f.kind}"><i aria-hidden="true"></i><span>${esc(f.text.charAt(0).toUpperCase() + f.text.slice(1))}</span></div>`).join("")}</div>`);
  /* the change to make, with its two actions */
  (c ? E.due.filter(z => z.c === c) : []).forEach(z => { const st = z.st;
    out.push(`<div class="ec-do"><p><b>${esc(z.s.step)}: ${st.w} beat ${st.l}.</b> Drop ${st.l} and write a new challenger against ${st.w}. Switch it in Instantly by hand, then mark it done.</p>
      <div class="ec-acts"><button type="button" class="act go" data-abdone="${esc(c.key)}|${esc(z.s.step)}">${ic("check")}Mark change done</button>${st.req ? `<span class="ec-req">Challenger requested ${esc(ecWhen(st.a.decided_at))}: waiting for Claude</span><button type="button" class="act" data-abcancel="${esc(st.a.id)}">Cancel request</button>` : `<button type="button" class="act" data-abreq="${esc(c.key)}|${esc(z.s.step)}">${ic("send")}Draft a challenger</button>`}</div></div>`); });
  /* numbers */
  const t0 = dayOf(Date.now()), cn = from => { const r = (x.cd || []).filter(z => String(z.campaign_id) === t.id && z.day >= from && z.day <= t0), sm = k => r.reduce((a, z) => a + (+z[k] || 0), 0); return { sent: sm("sent"), nl: sm("new_leads"), rep: sm("replies"), opp: sm("opportunities") }; };
  const pc = (a, b) => b ? ` <small>${(100 * a / b).toFixed(1)}%</small>` : "", row = (lab, o) => `<tr><th scope="row">${lab}</th><td class="num">${int(o.sent)}</td><td class="num">${int(o.nl)}</td><td class="num">${int(o.rep)}${pc(o.rep, o.nl)}</td><td class="num">${int(o.opp)}${pc(o.opp, o.nl)}</td></tr>`;
  const m = t.m;
  out.push(`<section class="ec-sec"><h3 class="ec-h3">Numbers</h3><div class="ec-two"><span class="ec-num"><b class="ec-n2">${t.rev ? usd(t.rev.revenue_usd) : "—"}</b><span class="ec-l">Revenue</span><small>${t.rev ? `${int(t.rev.payers)} paying client${+t.rev.payers === 1 ? "" : "s"}` : "not available"}</small></span><span class="ec-num"><b class="ec-n2">${m && m.reply_rate != null ? r1(m.reply_rate) : "—"}</b><span class="ec-l">Reply rate</span><small>all time</small></span></div>
    <div class="sp-scroll"><table class="sp-tbl ec-tbl"><thead><tr><th></th><th class="num">Sent</th><th class="num">New leads</th><th class="num">Replies</th><th class="num">Positive</th></tr></thead><tbody>${row("This week", cn(monday(t0)))}${row("Last 14 days", cn(addDays(t0, -13)))}</tbody></table></div>
    ${m ? `<p class="ec-p mut">All time: ${int(m.contacted)} leads contacted${t.left != null ? ` · ${int(t.left)} not emailed yet` : ""} · ${int(m.opportunities)} positive (${r1(m.pos_rate)}) · bounce rate ${r1(m.bounce_rate)} · ${int(t.nl)} new leads emailed ${dayW}${t.fu ? ` + ${int(t.fu)} follow-ups` : ""}.</p>` : ""}</section>`);
  /* A vs B per step */
  const fStep = s => ((c.funnel && c.funnel.steps) || []).find(f => f.idx === (c.steps || []).indexOf(s)) || null;
  const fPart = o => o && isN(o.sent) ? `${int(o.sent)} sent${isN(o.replies) ? ` · ${int(o.replies)} repl${o.replies === 1 ? "y" : "ies"}` : ""}${isN(o.positives) ? ` · ${int(o.positives)} positive` : ""}` : "";
  const step = s => { const st = abStatus(c, s, E.acts), dl = c.funnel && c.funnel.fu_delay_days, f = fStep(s), fa = f && fPart(f.all), fb = f && fPart(f.d14);
    const meta = [s.leads ? `leads A ${int(s.leads.A)} · B ${int(s.leads.B)}` : "", isN(s.queued) ? `${int(s.queued)} waiting` : "", (c.steps || []).indexOf(s) === 1 && isN(dl) ? `sends ${dl} day${dl === 1 ? "" : "s"} after email 1` : ""].filter(Boolean).join(" · ");
    const inst = fa || fb ? `<p class="ec-p mut" title="Straight from Instantly, A and B together. Replies leave out auto-replies.">All versions${fa ? `, all time: ${fa}` : ""}${fb ? `${fa ? " ·" : ","} last 14 days: ${fb}` : ""}</p>` : "";
    const head = pill => `<div class="ec-abh"><b>${esc(s.step)}</b>${pill}</div>${meta ? `<p class="ec-p mut">${meta}</p>` : ""}`;
    if (!c.since) return `<div class="ec-ab">${head(ecPill("Not split yet"))}<p class="ec-p">This campaign's leads haven't been given their A / B version yet.</p>${inst}</div>`;
    if (s.in_test === false) return `<div class="ec-ab">${head(ecPill("One version"))}<p class="ec-p">No real B for this step, so every lead gets A.</p>${inst}</div>`;
    const v = k => { const o = s[k] || {}, win = s.state === "winner" && s.lead === k; return `<span class="ec-num${win ? " win" : ""}"><span class="ec-l"><b>${k}</b> · ${k === "A" ? "Line-first" : "Question-first"}</span><b class="ec-n2">${o.sent ? r1(o.pos_rate || 0) : "—"}</b><small>${o.sent ? `${int(o.positives)} positive of ${int(o.sent)} sent · ${int(o.replies)} repl${+o.replies === 1 ? "y" : "ies"}` : "0 sends since the split"}</small></span>`; };
    const lo = Math.min(s.A.sent, s.B.sent), pos = (+s.A.positives || 0) + (+s.B.positives || 0);
    const bar = (lab, n, of) => `<div class="ec-pg"><span>${lab}</span><span class="v">${int(Math.min(n, of))} / ${int(of)}${n >= of ? " ✓" : ""}</span><span class="ec-bar"><i data-v="w:${Math.min(100, Math.round(100 * n / of))}%"></i></span></div>`;
    const verdict = s.state === "winner" ? ecPill(`Winner ${s.lead}`, "win") : s.state === "leading" && s.p_b != null ? ecPill(`${s.lead} ahead, ${Math.round(100 * (s.lead === "B" ? s.p_b : 1 - s.p_b))}% likely`) : ecPill("Too early");
    const chg = st.k === "done" ? `<div class="ec-li"><span>${esc(st.text)}</span><button type="button" class="act" data-abundo="${esc(st.a.id)}">Undo</button></div>` : st.k === "none" ? `<div class="ec-acts"><button type="button" class="act" data-abdone="${esc(c.key)}|${esc(s.step)}" title="Use this if you swapped a variant by hand before a winner was called">Log a change</button></div>` : "";
    return `<div class="ec-ab">${head(verdict)}<div class="ec-two">${v("A")}${v("B")}</div><div class="ec-pgs">${bar("Sends, smaller side", lo, MIN)}${bar("Positives, A + B", pos, MINP)}</div>${inst}${chg}</div>`; };
  out.push(`<section class="ec-sec"><h3 class="ec-h3">A vs B</h3>${c ? (c.steps || []).map(step).join("") : `<p class="ec-p">This campaign sends one version, so there is no A/B test.</p>`}</section>`);
  /* the emails, in full (paragraph breaks kept) */
  const W = E.d.what || {};
  if (c && c.sample) out.push(`<section class="ec-sec"><h3 class="ec-h3">The emails <small>as sent to one lead</small></h3>${["A", "B"].map(v => { const sm = c.sample[v] || {};
    return `<div class="ec-copy"><b>${v} · ${v === "A" ? "Line-first" : "Question-first"}</b>${W[v] ? `<p class="ec-p mut">${esc(W[v])}</p>` : ""}<p class="ec-p"><span class="mut">Subject:</span> ${esc(sm.subject || "(no subject)")}</p><div class="ec-body">${esc(sm.body || "")}</div>${sm.fu ? `<p class="ec-p"><span class="mut">Follow-up${W["F" + v] ? ` · ${esc(W["F" + v])}` : ""}</span></p><div class="ec-body">${esc(sm.fu)}</div>` : ""}</div>`; }).join("")}</section>`);
  /* change log + the rules in plain words */
  const log = c ? E.acts.filter(a => a.campaign === c.key) : [];
  out.push(`<section class="ec-sec"><h3 class="ec-h3">Change log</h3>${log.length ? ecLog(E, log) : `<p class="ec-p mut">No change logged yet.</p>`}</section>`);
  if (c) { const dl = c.funnel && c.funnel.fu_delay_days;
    out.push(`<section class="ec-sec"><h3 class="ec-h3">How this test works</h3><ul class="ec-rules"><li>Split 50/50 by lead since ${esc(ecWhen(c.since || E.d.split_since))}. Each lead keeps one version per email, and A vs B is counted by that version, not by Instantly's variant numbers.</li>
      <li>A verdict needs ${MIN}+ sends on each side and ${MINP}+ positive replies${E.R.p_win ? `, and ${Math.round(100 * E.R.p_win)}% certainty that the leader is better` : ""}. Before that it is too early.</li>
      <li>Positive = a sample yes, interested, or a price ask, credited to the version of the email they replied after.</li>${isN(dl) ? `<li>Follow-up 1 goes out ${dl} day${dl === 1 ? "" : "s"} after email 1.</li>` : ""}
      <li>Sends run in the Chicago daytime (Vilnius late afternoon to about 01:00). The tile shows yesterday until today's first sends arrive.</li>
      <li>When a winner is found: switch it in Instantly by hand, then Mark change done. Draft a challenger asks the Claude ops agents to write a new version against the winner; nothing changes in Instantly by itself.</li></ul></section>`); }
  return out.join("");
}
function ecSubj(S) {   /* subject-line test (council 11-19): no verdict before `look` sends per arm */
  if (!S) return `<p class="ec-p">No subject-line test is running.</p>`;
  const R = S.rules || {}, LOOK = R.look || 600, WIN = R.win || 1000, TIE = R.tie || 1500, GAP = R.gap || 2;
  return `<p class="ec-p">Email 1, pooled across campaigns, since ${esc(ecWhen(S.since))}. No verdict before ${int(LOOK)} sends per subject; a winner needs ${int(WIN)}–${int(TIE)} sends and a ${GAP}-point gap. No gap by ${int(TIE)} sends = a tie: keep the shortest subject.</p>
    ${(S.groups || []).map(g => `<div class="ec-ab"><div class="ec-abh"><b>${esc(g.name)}</b>${ecPill(g.verdict || "", g.state === "winner" ? "win" : "")}</div><div class="ec-list">${(g.arms || []).map(a => { const early = a.sent < LOOK, win = g.lead === a.arm && (g.state === "winner" || g.state === "tie");
      return `<div class="ec-li"><span><b>${esc(a.arm)}</b> · ${esc(a.label)}<small>${a.sent ? `${int(a.positives)} positive · ${int(a.replies)} repl${+a.replies === 1 ? "y" : "ies"} · ${int(a.sent)} sent` : "0 sends yet"}</small></span><span class="ec-v">${early ? `${int(a.sent)}/${int(LOOK)}<small>sends before a look</small>` : `${a.pos_rate == null ? "0.0%" : a.pos_rate.toFixed(1) + "%"}<small>positive</small>`}</span>${win ? ecPill(g.state === "tie" ? "Keep (shortest)" : "Winner", "win") : ""}</div>`; }).join("")}</div></div>`).join("")}`;
}
function ecTable(E, x) {
  const M = E.M, mC = Array.isArray(M.campaigns) ? M.campaigns : [], rv = c => E.REV ? +((E.REV.find(r => String(r.campaign_id) === String(c.id)) || {}).revenue_usd) || 0 : 0;
  const list = E.REV && ESORT === "rev" ? [...mC].sort((a, b) => rv(b) - rv(a)) : mC, n = v => v == null ? "n/a" : v.toFixed(1) + "%";
  if (!mC.length) return `<p class="ec-p">No data yet.</p>`;
  return `${E.REV ? `<div class="seg rev-sort" role="group" aria-label="Order">${[["default", "Default order"], ["rev", "By revenue"]].map(([k, l]) => `<button type="button" data-esort="${k}" class="${ESORT === k ? "on" : ""}" aria-pressed="${ESORT === k}">${l}</button>`).join("")}</div>` : ""}
    <div class="sp-scroll"><table class="sp-tbl ec-tbl"><thead><tr><th>Campaign</th><th class="num">Sent</th><th class="num">Contacted</th><th class="num">Replies</th><th class="num">Reply rate</th><th class="num">Positive</th><th class="num">Positive rate</th>${E.REV ? `<th class="num">Revenue</th>` : ""}<th class="num">Bounced</th></tr></thead>
    <tbody>${list.map(c => `<tr${c.status === 1 ? "" : ' class="off"'}><td title="${esc(c.name)}">${esc(ecName(c.name))}${c.status === 1 ? "" : ` <span class="mut">${esc(c.status_label || "paused")}</span>`}</td><td class="num">${int(c.sent)}</td><td class="num">${int(c.contacted)}</td><td class="num">${int(c.replies)}</td><td class="num">${n(c.reply_rate)}</td><td class="num">${int(c.opportunities)}</td><td class="num">${n(c.pos_rate)}</td>${E.REV ? `<td class="num">${usd(rv(c))}</td>` : ""}<td class="num">${n(c.bounce_rate)}</td></tr>`).join("")}</tbody></table></div>
    <p class="ec-p mut">All time, from Instantly${x.m ? `, synced ${esc(ago(x.m.updated_at))}` : ""}. Reply rate = unique human replies ÷ leads contacted. Opens aren't tracked: the emails are plain text with open tracking off, which doesn't affect reply rate.${E.REV ? ` Revenue not from a campaign: ${usd(E.REV.filter(E.revUn).reduce((a, r) => a + (+r.revenue_usd || 0), 0))}.` : ""}</p>`;
}
function closeEPan() { if (!EPAN) return; EPAN = null; const f = EFOCUS; EFOCUS = null; const p = $("#ec-pan"); if (p) p.innerHTML = ""; if (f) ($(`.${f[0]} [data-ecopen="${CSS.escape(f[1])}"]`, PAGE_EL) || $(`[data-ecopen="${CSS.escape(f[1])}"]`, PAGE_EL))?.focus(); }
function wireEmail() {
  const rer = () => { const y = scrollY; PAGE_EL.innerHTML = header("email", CACHE.email) + viewEmail(CACHE.email); applyVars(PAGE_EL); countUps(PAGE_EL); wireEmail(); scrollTo(0, y); if (EPAN) $("#ec-pan .mini")?.focus({ preventScroll: true }); };
  const who = () => (ME && ME.who !== "Both" ? ME.who : (ME && ME.name)) || null;
  $$(".ec-board>.ec-t", PAGE_EL).forEach((el, i) => el.style.setProperty("--n", i)); const tl = $$(".ec-grid>.ec-c", PAGE_EL), pb = $("[data-ecpaused]", PAGE_EL); tl.forEach((el, i) => el.style.setProperty("--n", Math.min(i, 12)));
  if (pb) { pb.style.setProperty("--n", Math.min(tl.filter(el => !el.classList.contains("off")).length, 12)); pb.addEventListener("click", () => { EPOFF = !EPOFF; rer(); $("[data-ecpaused]", PAGE_EL)?.focus(); }); }
  /* the Best tile's one shine plays with the entrance only (data arrived / page opened), never on a redraw inside the page */
  requestAnimationFrame(() => { if (PAGE_EL.classList.contains("sp-in") || HTML.classList.contains("pg-in")) $(".ec-c.ec-top", PAGE_EL)?.classList.add("ec-glint"); });
  $$("[data-ecopen]", PAGE_EL).forEach(b => b.addEventListener("click", () => { if (!b.closest("#ec-pan")) { const sec = b.closest(".ec-hero,.ec-look,.ec-camps"); EFOCUS = [sec ? ["ec-hero", "ec-look", "ec-camps"].find(c => sec.classList.contains(c)) : "spage", b.dataset.ecopen]; } const [k, ...r] = b.dataset.ecopen.split(":"); EIN = !EPAN; EPAN = { k, id: r.join(":") || null }; rer(); }));
  $$("[data-ecclose]", PAGE_EL).forEach(b => b.addEventListener("click", closeEPan));
  $$("[data-esort]", PAGE_EL).forEach(b => b.addEventListener("click", () => { ESORT = b.dataset.esort; rer(); }));
  const find = v => { const [key, step] = v.split("|"), D = CACHE.email, c = D.ab.data.campaigns.find(z => z.key === key), s = c && c.steps.find(z => z.step === step); return { key, step, D, c, s, st: s ? abStatus(c, s, D.acts) : null }; };
  $$("[data-abdone]", PAGE_EL).forEach(b => b.addEventListener("click", async () => {
    const { key, step, D, st } = find(b.dataset.abdone); if (!st) return;
    const note = st.k === "none" ? prompt("What changed? (one line)") : ""; if (st.k === "none" && !note) return;
    try { const row = st.a && !st.a.done_at ? await must(sb().from("ab_actions").update({ done_at: new Date().toISOString(), done_by: who(), ...(st.a.action === CHREQ ? { action: `dropped ${st.l}, new challenger against ${st.w}` } : {}) }).eq("id", st.a.id).select().single())
        : await must(sb().from("ab_actions").insert({ campaign: key, step, winner: st.w || null, loser: st.l || null, action: st.k === "due" ? `dropped ${st.l}, new challenger against ${st.w}` : "manual change", note: note || null, done_at: new Date().toISOString(), done_by: who() }).select().single());
      D.acts = [row, ...D.acts.filter(a => a.id !== row.id)]; rer(); toast("Marked as done"); } catch (e) { toast("Couldn't save that. Check your connection."); }
  }));
  /* BENAS 11-22: "Draft a challenger" = a request row the Claude ops agents pick up (ab_actions, action 'challenger_requested', done_at empty) */
  $$("[data-abreq]", PAGE_EL).forEach(b => b.addEventListener("click", async () => {
    const { key, step, D, st } = find(b.dataset.abreq); if (!st || st.k !== "due" || st.req) return; b.disabled = true;
    try { const row = await must(sb().from("ab_actions").insert({ campaign: key, step, winner: st.w, loser: st.l, action: CHREQ, note: `${who() || "A founder"} asked for a new challenger against ${st.w}`, done_at: null, done_by: null }).select().single());
      D.acts = [row, ...D.acts]; rer(); toast("Sent to Claude: a new challenger gets drafted. The switch in Instantly stays manual."); } catch (e) { b.disabled = false; toast("Couldn't send that. Check your connection."); }
  }));
  $$("[data-abcancel]", PAGE_EL).forEach(b => b.addEventListener("click", async () => { const id = +b.dataset.abcancel, D = CACHE.email, a = D.acts.find(z => z.id === id);
    if (!a || a.done_at || a.action !== CHREQ) return;
    try { await must(sb().from("ab_actions").delete().eq("id", id)); D.acts = D.acts.filter(z => z.id !== id); rer(); toast("Request cancelled"); } catch (e) { toast("Couldn't cancel that."); } }));
  $$("[data-abundo]", PAGE_EL).forEach(b => b.addEventListener("click", async () => { const id = +b.dataset.abundo, D = CACHE.email, a = D.acts.find(z => z.id === id);
    try { if (a && !a.winner && a.action === "manual change") { await must(sb().from("ab_actions").delete().eq("id", id)); D.acts = D.acts.filter(z => z.id !== id); }
      else { const row = await must(sb().from("ab_actions").update({ done_at: null, done_by: null }).eq("id", id).select().single()); D.acts = D.acts.map(z => z.id === id ? row : z); }
      rer(); toast("Undone"); } catch (e) { toast("Couldn't undo that."); } }));
}

/* 3. clients + their videos (SIMAS 11-19 15:3x: grouped by category, retainer plans, videos by date, today's highlighted) */
async function loadClients() {
  const [clients, deliveries, payments, retainers, st, notes, m, proms, scs, pipe, ordRows, probs, calls, cNotes, cTasks] = await Promise.all([
    all("clients", "id,name,emails,show,drive_folder,source"),
    all("deliveries", "id,client_id,title,order_name,kind,duration_s,link,delivered_at", q => q.order("delivered_at", { ascending: false }).order("id")),
    all("payments", "client_id,amount,refunded,paid_at,package"),
    all("retainers", "id,email,name,amount,interval,status,started_at,current_period_end").catch(() => []),
    all("sync_status", "name,ran_at,ok,detail").catch(() => []),
    all("client_notes", "lead_email,kind,note,noted_at,created_at", q => q.eq("kind", "priority")).catch(() => []),
    panel("metrics").catch(() => null),
    all("promises", "lead_email,promise,owner,due_at,status", q => q.eq("status", "open")).catch(() => []),
    all("scopes", "slug,client,email,url,status").catch(() => []),
    all("pipeline", "email,next_action,status").catch(() => []),
    all("order_progress", "*", q => q.order("opened_at")),
    all("order_problems", "*").catch(() => []),
    all("calls", "uid,name,email,title,start_at,end_at,status,organizer,meet_url", q => q.order("start_at", { ascending: false })).catch(() => []),
    all("touches", "id,call_uid,summary,takeaways,recording_url", q => q.not("call_uid", "is", null)).catch(() => []),
    all("call_tasks", "id,touch_id,text,owner,due_at,done_at", q => q.order("id")).catch(() => []),
  ]);
  const t = dayOf(Date.now()), plans = (m && m.data && m.data.retainer_plans) || {};
  const vids = {}, paid = {}, nPay = {}, lastPay = {};
  /* 11-21 (BENAS: "pack status should be in the client's page"): packs come from public.order_progress (one row per paid order,
     Shorts counted once per number in the order folder, revisions per Short). Founders fix size / kind / status on the page. */
  const byOrd = {}, cOrd = {}, cProb = {};
  ordRows.forEach(o => { byOrd[o.id] = o; (cOrd[o.client_id] = cOrd[o.client_id] || []).push(o); });
  probs.forEach(q => { const o = byOrd[q.order_id], k = o ? o.client_id : "n:" + lc(q.client); (cProb[k] = cProb[k] || []).push(q); });
  deliveries.forEach(v => (vids[v.client_id] = vids[v.client_id] || []).push(v));
  payments.forEach(p => { if (p.refunded) return; paid[p.client_id] = (paid[p.client_id] || 0) + (+p.amount || 0); nPay[p.client_id] = (nPay[p.client_id] || 0) + 1; const d = dayOf(p.paid_at); if (!lastPay[p.client_id] || d > lastPay[p.client_id]) lastPay[p.client_id] = d; });
  const ret = {}; retainers.forEach(r => { if (/active|trialing|past_due/i.test(r.status || "")) ret[lc(r.email)] = r; });
  const prio = {}; notes.slice().sort((a, b) => ((a.noted_at || "") + (a.created_at || "")).localeCompare((b.noted_at || "") + (b.created_at || ""))).forEach(n => { prio[lc(n.lead_email)] = n.note; });
  const cadence = n => n >= 60 ? `${Math.round(n / 30)} a day` : n >= 28 ? "1 a day" : n >= 14 ? "every other day" : n ? `${n} a month` : "";
  const uniq = vs => { const k = new Set(); vs.forEach(v => { const mm = /Short\s*(\d+)/i.exec(v.title || ""); k.add(mm ? (v.order_name || "") + "#" + mm[1] : v.id); }); return k.size; };
  const list = clients.map(c => {
    const es = (c.emails || []).map(lc), r = es.map(e => ret[e]).find(Boolean) || null, vs = vids[c.id] || [], last = vs.reduce((x, v) => v.delivered_at > x ? v.delivered_at : x, "");
    const gone = es.some(e => /^gone\b/i.test(prio[e] || "")), lastAct = [last, lastPay[c.id] || ""].sort().pop();
    let plan = null;
    if (r) { const pl = plans[r.id] || {}, start = dayOf(new Date(Math.max(+new Date(r.started_at), +new Date(r.current_period_end) - 31 * 864e5)).toISOString());
      plan = { shorts: pl.shorts || null, text: [pl.shorts ? `${pl.shorts} Shorts/mo` : (pl.product || "Monthly plan"), cadence(pl.shorts), `${usd(r.amount)}/${(r.interval || "month").slice(0, 2)}`].filter(Boolean).join(" · "), done: uniq(vs.filter(v => v.delivered_at >= start)), start, renews: dayOf(r.current_period_end) }; }
    const cat = gone ? "past" : r ? "retainer" : (lastAct && lastAct < addDays(t, -45)) ? "past" : "pack";
    const doms = es.map(e => e.split("@")[1]).filter(x => x && !/^(gmail|yahoo|hotmail|outlook|icloud|aol|proton)\./.test(x)), mine = q => es.includes(lc(q.email)) || doms.includes(lc(q.email).split("@")[1]);
    const waitRow = pipe.find(q => mine(q) && /wait|their ok|on ok\b|approv|footage|awaiting|\bsends\b|next episode|check-?in sent|only if .{0,20}write|until (he|she|they)/i.test(q.next_action || "")), waiting = waitRow ? String(waitRow.next_action).slice(0, 120) : "";
    /* 11-19 late (Simas): a past client's open pack is not "in progress"; a next action that says "parked" is Parked, not waiting. */
    const parked = pipe.some(q => mine(q) && /\bparked\b/i.test(q.next_action || ""));
    const all0 = (cOrd[c.id] || []).map(o => ({ id: o.id, name: ordName(o), kind: o.kind, status: o.status, bought: o.bought, done: +o.delivered || 0, revised: +o.revised || 0, inrev: +o.in_revision || 0,
      exp: o.expected_by_now, last: o.last_delivery_at ? dayOf(o.last_delivery_at) : "", opened: o.opened_at, folder: o.folder || "" }));
    all0.forEach(o => { o.st = o.status === "complete" ? "finished" : o.status !== "open" ? o.status : cat === "past" ? "past" : o.kind === "custom" ? "custom" : o.bought == null ? "unknown" : parked ? "parked" : waiting ? "waiting" : o.done === 0 ? "notstarted" : "progress"; });
    const packs = all0.filter(o => o.status !== "legacy"), legacy = all0.filter(o => o.status === "legacy" && (o.folder || o.bought != null || o.done));
    const mo = packs.filter(o => o.kind === "monthly").pop();   // the newest monthly order carries this billing month's count
    if (plan && mo) { if (mo.bought != null) plan.shorts = mo.bought; plan.done = mo.done; plan.order = mo; }
    const worst = ["notstarted", "progress", "waiting", "paused", "parked", "unknown", "custom", "past", "finished"].find(k => packs.some(o => o.st === k)) || "", state = r ? "retainer" : worst;
    const pr = proms.filter(q => es.includes(lc(q.lead_email))).sort((a, b) => String(a.due_at).localeCompare(String(b.due_at))), sc = scs.find(q => q.email && es.includes(lc(q.email))) || null, att = [];
    if (plan) { plan.daysLeft = Math.ceil((new Date(r.current_period_end) - Date.now()) / 864e5); const len = Math.max(1, (new Date(r.current_period_end) - new Date(plan.start + "T00:00:00Z")) / 864e5), frac = Math.min(1, Math.max(0, 1 - plan.daysLeft / len));
      plan.expected = plan.order ? plan.order.exp : plan.shorts ? Math.round(plan.shorts * frac) : null;
      if (plan.daysLeft <= 5) att.push(["o", `renews in ${plan.daysLeft} day${plan.daysLeft === 1 ? "" : "s"}`]);
      if (!plan.order && plan.shorts && plan.done < plan.expected - Math.max(2, plan.shorts * .15)) att.push(["r", `behind: ${plan.done} delivered, about ${plan.expected} expected by now`]); }
    pr.filter(q => q.due_at && new Date(q.due_at) < new Date()).forEach(q => att.push(["r", `promise overdue: ${String(q.promise).slice(0, 70)}`]));
    const pb = (cProb[c.id] || []).concat(cProb["n:" + lc(c.name)] || []), PB = { behind_pace: "r", past_due: "r", revision_open: "o" };   // size_unknown: the page note above the list
    if (cat !== "past") {
      packs.forEach(o => { if (o.st === "notstarted" && o.opened && Date.now() - new Date(o.opened) > 864e5) att.push(["r", `paid pack not started: ${o.name}${o.bought ? ` (${o.bought} Shorts)` : ""}`]);
        if (o.st === "progress" && o.last && o.last < addDays(t, -3) && o.last >= addDays(t, -30)) att.push(["o", `${o.name}: ${o.done} / ${o.bought}, no delivery since ${dLabel(o.last)}`]); });
      pb.filter(q => PB[q.problem]).forEach(q => att.push([PB[q.problem], `${q.problem === "revision_open" ? "change asked" : byOrd[q.order_id] ? ordName(byOrd[q.order_id]) : q.ref || "order"}: ${q.detail}`])); }
    const unN = pb.filter(q => q.problem === "file_unnumbered").length;   // files the count can't use: one small line on the client, never a card
    const prob = [unN ? `${unN} file${unN === 1 ? "" : "s"} not counted (no Short number in the name)` : "", ...pb.filter(q => q.problem === "folder_unmatched").map(q => `“${q.ref}”: ${q.detail}`),
      ...pb.filter(q => q.problem === "over_delivered").map(q => `${byOrd[q.order_id] ? ordName(byOrd[q.order_id]) : q.ref}: ${q.detail}`)].filter(Boolean).join(" · ");
    return { ...c, vids: vs, paid: paid[c.id] || 0, nPay: nPay[c.id] || 0, last, ret: r, plan, gone, cat, today: vs.filter(v => v.delivered_at === t).length, proms: pr, scope: sc, att, packs, legacy, prob, state, worst, waiting };
  }).filter(c => c.vids.length || c.paid || c.ret);
  const by = k => list.filter(c => c.cat === k);
  const groups = [["retainer", "Monthly retainer", by("retainer").sort((a, b) => b.ret.amount - a.ret.amount)],
    ["pack", "Pack clients", by("pack").sort((a, b) => (/notstarted|progress|waiting/.test(b.worst) - /notstarted|progress|waiting/.test(a.worst)) || (b.last || "").localeCompare(a.last || "") || b.paid - a.paid)],
    ["past", "Past / parted ways", by("past").sort((a, b) => (b.last || "").localeCompare(a.last || ""))]];
  const ds = st.find(x => x.name === "deliveries");
  const allP = list.flatMap(c => c.packs.map(o => ({ ...o, client: c.name }))), nSt = k => allP.filter(o => o.st === k).length;
  return { list, groups, t, calls: callModel(calls, cNotes, cTasks), counts: { retainer: by("retainer").length, progress: nSt("progress"), finished: nSt("finished"), notstarted: nSt("notstarted"), waiting: nSt("waiting"), paused: nSt("paused"), unknown: nSt("unknown") }, unknownL: allP.filter(o => o.st === "unknown").map(o => `${o.client}: ${o.name}`), synced: ds ? ds.ran_at : null, dsOk: ds ? ds.ok !== false : true, lastDelivery: deliveries.reduce((x, v) => v.delivered_at > x ? v.delivered_at : x, ""), todayN: list.reduce((s, c) => s + c.today, 0), todayC: list.filter(c => c.today).length };
}
const fdur = s => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "";
function clientDetail(c, t) {
  if (!c) return empty("Pick a client on the left.");
  const days = {}; c.vids.forEach(v => (days[v.delivered_at || ""] = days[v.delivered_at || ""] || []).push(v));
  const keys = Object.keys(days).sort().reverse();
  return `<div class="cl-head"><div><h2>${esc(c.name || "Client")}</h2><p>${esc([c.show, (c.emails || [])[0], c.last ? `last video ${dLabel(c.last)}` : "no videos yet"].filter(Boolean).join(" · "))}</p></div>
    <div class="cl-chips">${stChip(c, true)}${c.plan ? `<span class="chip">renews in ${c.plan.daysLeft} d</span>` : ""}${c.today ? `<span class="chip g">${c.today} today</span>` : ""}${c.plan ? `<span class="chip g">${esc(c.plan.text)}</span>` : ""}<span class="chip">${int(c.vids.length)} video${c.vids.length === 1 ? "" : "s"}</span>${c.paid ? `<span class="chip b">${usd(c.paid)} paid${c.nPay > 1 ? ` · ${c.nPay} payments` : ""}</span>` : ""}${c.gone ? `<span class="chip">parted ways</span>` : ""}${c.scope && c.scope.url ? `<a class="chip lkc" href="${esc(c.scope.url)}" target="_blank" rel="noopener noreferrer">Scope ↗</a>` : ""}</div></div>
    ${ordLines(c)}
    ${c.att.length ? `<div class="sp-alerts cl-al">${c.att.map(a => `<div class="sp-alert ${a[0] === "r" ? "red" : "amber"}"><i></i><span>${esc(a[1])}</span></div>`).join("")}</div>` : ""}
    ${c.proms.length ? `<div class="cl-plan"><b class="cl-ph">Promised to this client</b>${c.proms.map(q => `<div class="cl-pr"><span class="grow">${esc(q.promise)}</span><span class="chip${q.due_at && new Date(q.due_at) < new Date() ? " r" : ""}">${q.due_at ? "due " + esc(dLabel(dayOf(q.due_at))) : "no date"}</span></div>`).join("")}</div>` : ""}
    ${c.plan && !c.plan.order ? `<div class="cl-plan"><div class="sp-bar"><span>Delivered this billing month <small class="mut">since ${esc(dLabel(c.plan.start))} · renews ${esc(dLabel(c.plan.renews))}${c.plan.expected != null ? ` · about ${c.plan.expected} expected by now` : ""}</small></span><span class="v">${c.plan.done}${c.plan.shorts ? ` / ${c.plan.shorts}` : ""}</span><div class="bar c-green"><i data-v="w:${c.plan.shorts ? Math.min(100, Math.max(2, Math.round(100 * c.plan.done / c.plan.shorts))) : 100}%"></i></div></div><p class="sp-note">No monthly order yet: counted from the files in Drive.</p></div>` : ""}
    ${keys.map(k => `<div class="cl-ord${k === t ? " today" : ""}">${k === t ? "Today · " : ""}${esc(dLabel(k))} · ${days[k].length}</div><div class="vid-grid">${days[k].map(v => `<a class="vid${k === t ? " today" : ""}" href="${esc(v.link)}" target="_blank" rel="noopener noreferrer" title="Open in Drive"><span class="pl">${ic("play")}${k === t ? `<em class="vt">Today</em>` : ""}</span><b>${esc(v.title || "Video")}</b><small>${esc(fdur(v.duration_s))}${v.duration_s ? " · " : ""}<span class="vo">${esc(v.order_name || "")}</span></small></a>`).join("")}</div>`).join("") || empty("No videos for this client in the delivery index yet.")}
    <div class="cl-calls" data-emails="${esc((c.emails || []).join(","))}"></div>`;
}
/* 11-21 (SIMAS): call notes at the bottom of the client (summary, key takeaways, next tasks). crm.js renders and ticks them. */
function fillCalls() {
  const el = $("#cl-detail .cl-calls"); if (!el || !window.BEJU_CRM_CALLS) return;
  window.BEJU_CRM_CALLS(el.dataset.emails.split(",").filter(Boolean)).then(html => { if (el.isConnected && html) el.innerHTML = `<div class="cl-plan"><b class="cl-ph">Calls</b>${html}</div>`; }, () => {});
}
let CL_TODAY = false, CLF = "", CALLS_ALL = false;
/* 11-21 (SIMAS: "in the clients tab, we need a new section about the calls that would be clear"): Upcoming (cal.com bookings still to
   come: when in Vilnius, who, what about, the Meet link) and Past calls (newest first, one row each: when, who, the summary's first
   line, takeaways, open next tasks). No notes = a red "Notes missing" + Add call notes. A tap opens crm.js's full call card. */
function callModel(calls, notes, tasks) {
  const now = Date.now(), live = calls.filter(c => !/cancel/i.test(c.status || "")), note = {}, tk = {};
  notes.forEach(n => { note[n.call_uid] = n; }); tasks.forEach(x => (tk[x.touch_id] = tk[x.touch_id] || []).push(x));
  const row = c => { const n = note[c.uid] || null; return { c, n, tasks: n ? tk[n.id] || [] : [] }; }, at = c => +new Date(c.start_at);
  return { up: live.filter(c => at(c) > now).sort((a, b) => at(a) - at(b)).map(row), past: live.filter(c => at(c) <= now).sort((a, b) => at(b) - at(a)).map(row) };
}
const wkd = t => new Date(t).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short" });
const callWhen = t => `${wkd(t)}, ${dLabel(dayOf(t))} · ${hm(t)}`;
const callAbout = c => String(c.title || "").replace(/\s+between\s+beju creative\s+and\s+.*$/i, "").trim() || "Call";
function callUp({ c }) {
  const meet = webUrl(c.meet_url || "");
  return `<div class="clc-row clc-up"><span class="clc-m"><b class="clc-d">${esc(callWhen(c.start_at))}</b><span class="clc-w">${esc(c.name || c.email || "Lead")}</span><span class="clc-s">${esc(callAbout(c))}</span></span>${meet ? `<a class="act go clc-meet" href="${esc(meet)}" target="_blank" rel="noopener noreferrer">${ic("link")}Join Meet</a>` : ""}</div>`;
}
function callPast({ c, n, tasks }) {
  const ended = +new Date(c.end_at || c.start_at), missing = !n && ended < Date.now() - 2 * 36e5, open = tasks.filter(x => !x.done_at), tk = n && n.takeaways ? n.takeaways.length : 0;
  const line = n ? String(n.summary || "").split("\n")[0] : "";
  const extra = [tk ? `${tk} takeaway${tk === 1 ? "" : "s"}` : "", open.length ? `next: ${open[0].owner}, ${open[0].text}${open.length > 1 ? ` (+${open.length - 1} more)` : ""}` : tasks.length ? "tasks done" : ""].filter(Boolean).join(" · ");
  return `<div class="clc-row" data-uid="${esc(c.uid)}"><button type="button" class="clc-m" data-callopen="${esc(c.uid)}" aria-expanded="false"><b class="clc-d">${esc(callWhen(c.start_at))}</b><span class="clc-w">${esc(c.name || c.email || "Lead")}</span>
    ${n ? `<span class="clc-s">${esc(line)}</span>` : `<span class="clc-s ${missing ? "clc-miss" : "mut"}">${missing ? "Notes missing" : "No notes yet"}</span>`}${extra ? `<span class="clc-x">${esc(extra)}</span>` : ""}</button>
    ${n ? "" : `<button type="button" class="act clc-add" data-calladd="${esc(c.uid)}">${ic("edit")}Add call notes</button>`}</div><div class="clc-card" data-card-uid="${esc(c.uid)}" hidden></div>`;
}
const callsSec = m => m ? `<section class="card sp-card clc" id="clc">${callsInner(m)}</section>` : "";
function callsInner(m) {
  const past = CALLS_ALL ? m.past : m.past.slice(0, 5);
  return `<h2>Calls</h2>
    <h3 class="clc-h">Upcoming</h3>${m.up.length ? `<div class="clc-list">${m.up.map(callUp).join("")}</div>` : `<p class="mut clc-none">No calls booked.</p>`}
    <h3 class="clc-h">Past calls</h3>${past.length ? `<div class="clc-list">${past.map(callPast).join("")}</div>${m.past.length > 5 ? `<button type="button" class="more clc-more" data-callmore>${CALLS_ALL ? "Show fewer" : `Show all ${m.past.length}`}</button>` : ""}` : `<p class="mut clc-none">No calls yet.</p>`}`;
}
function callToggle(uid, add) {   // open / close the full call card under its row; add = open the notes form right away
  const sec = $("#clc"), btn = sec && $(`[data-callopen="${CSS.escape(uid)}"]`, sec), box = sec && $(`[data-card-uid="${CSS.escape(uid)}"]`, sec); if (!btn || !box) return;
  const on = add || box.hidden, row = CACHE.clients && CACHE.clients.calls.past.find(r => r.c.uid === uid);
  if (on && box.hidden) { box.innerHTML = window.BEJU_CRM_CALLCARD && row ? window.BEJU_CRM_CALLCARD(row) : ""; box.hidden = !box.innerHTML; }
  else if (!on) { box.hidden = true; box.innerHTML = ""; }
  btn.setAttribute("aria-expanded", !box.hidden);
  if (add) { const a = $('[data-act="cnadd"]', box); if (a && !a.hidden) a.click(); }
}
const PCH = { notstarted: ["Not started", ""], progress: ["In progress", "o"], waiting: ["Waiting on client", "b"], finished: ["Complete", "g"], unknown: ["Size unknown", ""], past: ["Past client", ""], parked: ["Parked", ""], custom: ["Custom", ""],
  paused: ["Paused", "b"], refunded: ["Refunded", ""], canceled: ["Canceled", ""], legacy: ["Older order", ""] };
const OKIND = [["pack", "Pack"], ["monthly", "Monthly"], ["long", "Long-form"], ["custom", "Custom"], ["referral", "Referral"], ["legacy", "Older order"]];
const OSTAT = [["open", "Open"], ["complete", "Complete"], ["paused", "Paused"], ["refunded", "Refunded"], ["canceled", "Canceled"], ["legacy", "Older order"]];
/* "15 Shorts · Month 1 · 2026-11-19" -> "Month 1 · Nov 19" (the size is the number next to it); other folders as they are */
function ordName(o) {
  const f = String(o.folder || ""), m = /^\d+\s+\S+\s+·\s+(.+?)\s+·\s+(\d{4}-\d{2}-\d{2})$/.exec(f);
  return m ? `${m[1]} · ${dLabel(m[2])}` : f || `${(OKIND.find(k => k[0] === o.kind) || [0, o.kind])[1]} · ${dLabel(dayOf(o.opened_at || o.opened))}`;
}
function stChip(c, bare) {
  if (c.ret) return `<span class="chip acc">Ongoing</span>`;
  const o = c.packs.find(x => x.st === c.worst); if (!o) return "";
  const n = !bare && o.bought != null && !/finished|waiting|paused/.test(o.st) ? ` · ${o.done} / ${o.bought}` : "";
  return `<span class="chip ${PCH[o.st][1]}">${o.st === "finished" ? "✓ " : ""}${PCH[o.st][0]}${n}</span>`;
}
/* one row per order: big delivered / bought, plain words for revisions, the status, and a founder Fix (writes public.orders) */
const ordRow = o => `<div class="cl-or" data-oid="${o.id}"><span class="ring ${PCH[o.st][1]}" data-v="p:${o.bought ? Math.min(100, Math.round(100 * o.done / o.bought)) : 0}"></span>
  <span class="grow"><span class="cl-or-n">${esc(o.name)}</span>${o.revised || o.inrev ? `<span class="cl-or-t">${[o.revised ? `${o.revised} revised` : "", o.inrev ? `<b class="dn">${o.inrev} in revision</b>` : ""].filter(Boolean).join(" · ")}</span>` : ""}</span>
  <b class="cl-or-v">${o.done}<small> / ${o.bought == null ? "?" : o.bought}</small></b><span class="chip ${PCH[o.st][1]}">${o.st === "finished" ? "✓ " : ""}${PCH[o.st][0]}</span><button type="button" class="act cl-or-fix" data-ofix="${o.id}" aria-expanded="false">Fix</button></div>`;
function ordLines(c) {
  if (!c.packs.length && !c.legacy.length) return "";
  return `<div class="cl-plan cl-ords">${c.packs.map(ordRow).join("")}${c.legacy.length ? `<details class="cl-leg"><summary>${c.legacy.length} older order${c.legacy.length === 1 ? "" : "s"} (before the order system)</summary>${c.legacy.map(ordRow).join("")}</details>` : ""}${c.prob ? `<p class="sp-note cl-prob">${esc(c.prob)}</p>` : ""}</div>`;
}
const oSel = (name, opts, v) => `<select name="${name}">${opts.map(([k, l]) => `<option value="${k}"${k === v ? " selected" : ""}>${l}</option>`).join("")}</select>`;
const ordForm = o => `<form class="cl-oe" data-oid="${o.id}" novalidate><label><span>Shorts bought</span><input name="bought" type="number" min="0" max="1000" inputmode="numeric" value="${o.bought == null ? "" : o.bought}"></label>
  <label><span>Kind</span>${oSel("kind", OKIND, o.kind)}</label><label><span>Status</span>${oSel("status", OSTAT, o.status)}</label>
  <div class="cl-oe-b"><button type="button" class="act" data-ocancel>Cancel</button><button type="submit" class="act go">Save</button></div><p class="cl-oe-err" hidden></p></form>`;
function clientRow(c, sel) {
  const sub = c.plan ? c.plan.text : c.last ? `last video ${dLabel(c.last)}${c.nPay > 1 ? ` · ${c.nPay} payments` : ""}` : c.paid ? `${usd(c.paid)} paid` : "";
  return `<a class="cl-item" href="?p=clients&amp;c=${esc(c.id)}" data-cl="${esc(c.id)}" data-st="${esc([c.ret ? "retainer" : "", ...new Set(c.packs.map(o => o.st))].join(" "))}" data-today="${c.today}" data-q="${esc(lc([c.name, c.show, ...(c.emails || [])].join(" ")))}"${sel && c.id === sel.id ? ' aria-current="true"' : ""}><span class="av">${esc(initials(c.name))}</span><span class="grow"><span class="t">${esc(c.name || "Client")}</span><span class="s">${esc(sub)}</span></span><span class="n">${int(c.vids.length)}</span><span class="cl-ch">${stChip(c)}${c.plan && c.plan.shorts ? `<span class="chip">${c.plan.done} / ${c.plan.shorts} this month</span>` : ""}${c.today ? `<span class="chip g">${c.today} today</span>` : ""}</span></a>`;
}
function viewClients(d) {
  if (!d.list.length) return empty("No clients with videos or payments yet.");
  const sel = d.list.find(c => c.id === param("c")) || (d.groups.find(g => g[2].length) || [0, 0, []])[2][0], n = d.list.reduce((s, c) => s + c.vids.length, 0);
  return `<div class="sp-kpis">${kpi("Delivered today", int(d.todayN), d.todayN ? `${d.todayC} client${d.todayC === 1 ? "" : "s"} · ${esc(dLabel(d.t))}` : "nothing yet today")}${kpi("On a monthly retainer", int(d.groups[0][2].length), usd(d.groups[0][2].reduce((s, c) => s + (+c.ret.amount || 0), 0)) + " a month")}${kpi("Clients", int(d.list.length), "paid or got videos")}${kpi("Videos delivered", int(n), `newest ${esc(dLabel(d.lastDelivery))}`)}</div>
  <div class="cl-filt${d.counts.paused ? " n6" : ""}" role="group" aria-label="Filter by status">${[["retainer", "Retainers ongoing", "acc"], ["progress", "Packs in progress", "o"], ["finished", "Packs complete", "g"], ["notstarted", "Not started", ""], ["waiting", "Waiting on client", "b"], ...(d.counts.paused ? [["paused", "Paused", "b"]] : [])].map(([k, l, cl]) => `<button type="button" class="cl-fb ${cl}${CLF === k ? " on" : ""}" data-clf="${k}" aria-pressed="${CLF === k}"><b>${d.counts[k]}</b><span>${l}</span></button>`).join("")}</div>
  ${d.counts.unknown ? `<p class="sp-note">Size unknown for ${d.counts.unknown} order${d.counts.unknown === 1 ? "" : "s"} (not guessed, set it with Fix): ${esc(d.unknownL.join("; "))}.</p>` : ""}
  ${d.list.some(c => c.att.length) ? `<section class="card sp-card"><h2>Needs attention <small>${d.list.filter(c => c.att.length).length} client${d.list.filter(c => c.att.length).length === 1 ? "" : "s"}</small></h2><div class="sp-alerts">${d.list.filter(c => c.att.length).flatMap(c => c.att.map(a => `<a class="sp-alert ${a[0] === "r" ? "red" : "amber"} cl-go" href="?p=clients&amp;c=${esc(c.id)}" data-cl-go="${esc(c.id)}"><i></i><span><b>${esc(c.name)}</b> · ${esc(a[1])}</span></a>`)).join("")}</div></section>` : ""}
  ${callsSec(d.calls)}
  <div class="cl-wrap"><section class="card sp-card"><div class="cl-tools"><input class="cl-q" id="cl-q" type="search" placeholder="Find a client" aria-label="Find a client" autocomplete="off" spellcheck="false"><button type="button" class="chip${CL_TODAY ? " g" : ""}" id="cl-today" aria-pressed="${CL_TODAY}" title="Show only clients who got videos today">Delivered today · ${d.todayC}</button></div>
    <div class="cl-list" id="cl-list">${d.groups.map(([k, label, cs]) => cs.length ? `<div class="cl-grp" data-grp="${k}"><span>${label}</span><span class="chip">${cs.length}</span></div>${cs.map(c => clientRow(c, sel)).join("")}` : "").join("")}</div></section>
    <section class="card sp-card" id="cl-detail">${clientDetail(sel, d.t)}</section></div>`;
}
function filterClients() {
  const q = lc($("#cl-q")?.value || "");
  $$("#cl-list [data-q]").forEach(el => { el.hidden = (!!q && !el.dataset.q.includes(q)) || (CL_TODAY && el.dataset.today === "0") || (!!CLF && !el.dataset.st.split(" ").includes(CLF)); });
  $$("#cl-list .cl-grp").forEach(g => { let n = g.nextElementSibling, any = false; while (n && !n.classList.contains("cl-grp")) { if (!n.hidden) any = true; n = n.nextElementSibling; } g.hidden = !any; });
}
function wireClients() {
  $$("[data-cl-go]", PAGE_EL).forEach(a => a.addEventListener("click", ev => { if (ev.metaKey || ev.ctrlKey) return; ev.preventDefault(); $(`#cl-list [data-cl="${CSS.escape(a.dataset.clGo)}"]`)?.click(); $("#cl-detail").scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" }); }));
  $("#cl-q")?.addEventListener("input", filterClients);
  $("#cl-today")?.addEventListener("click", ev => { CL_TODAY = !CL_TODAY; ev.currentTarget.classList.toggle("g", CL_TODAY); ev.currentTarget.setAttribute("aria-pressed", CL_TODAY); filterClients(); });
  const ordOf = id => { for (const c of CACHE.clients.list) { const o = c.packs.concat(c.legacy).find(x => String(x.id) === String(id)); if (o) return o; } return null; };
  const closeForms = () => { $$("#cl-detail .cl-oe").forEach(f => f.remove()); $$("#cl-detail [data-ofix]").forEach(b => b.setAttribute("aria-expanded", "false")); };
  $("#cl-detail")?.addEventListener("click", ev => {
    const fx = ev.target.closest("[data-ofix]"), cx = ev.target.closest("[data-ocancel]");
    if (cx) { const b = $(`#cl-detail [data-ofix="${cx.closest("form").dataset.oid}"]`); closeForms(); if (b) b.focus(); return; }
    if (!fx) return;
    const row = fx.closest(".cl-or"), was = !!(row.nextElementSibling && row.nextElementSibling.matches(".cl-oe")), o = ordOf(fx.dataset.ofix); closeForms();
    if (was || !o) return;
    row.insertAdjacentHTML("afterend", ordForm(o)); fx.setAttribute("aria-expanded", "true"); $("#cl-detail .cl-oe input").focus();
  });
  $("#cl-detail")?.addEventListener("submit", async ev => {
    const f = ev.target.closest(".cl-oe"); if (!f) return; ev.preventDefault();
    const o = ordOf(f.dataset.oid), err = $(".cl-oe-err", f), go = $('button[type="submit"]', f); if (!o) return;
    const raw = String(f.elements.bought.value || "").trim(), b = raw === "" ? null : Math.round(+raw), kind = f.elements.kind.value, status = f.elements.status.value;
    if (raw !== "" && !(b >= 0 && b <= 1000)) { err.hidden = false; err.textContent = "Shorts bought: a number from 0 to 1000."; f.elements.bought.focus(); return; }
    const patch = {}, said = [];
    if (b !== o.bought) { patch.shorts_bought = b; patch.size_source = "founder"; said.push(`size ${o.bought == null ? "?" : o.bought} to ${b == null ? "?" : b}`); }
    if (kind !== o.kind) { patch.kind = kind; said.push(`kind ${o.kind} to ${kind}`); }
    if (status !== o.status) { patch.status = status; said.push(`status ${o.status} to ${status}`); }
    if (!said.length) { closeForms(); return; }
    await me(); const who = (ME && ME.who !== "Both" ? ME.who : ME && ME.name) || "a founder";
    go.disabled = true; err.hidden = true;
    try {
      const cur = await must(sb().from("orders").select("note").eq("id", o.id).maybeSingle());
      patch.note = [cur && cur.note, `${who} ${dayOf(Date.now())} (CRM): ${said.join(", ")}`].filter(Boolean).join(" · ");
      patch.updated_at = new Date().toISOString();
      const done = await must(sb().from("orders").update(patch).eq("id", o.id).select("id"));
      if (!done || !done.length) throw new Error("not allowed. The 2-step login may have expired: sign in again");
      CACHE.clients = null; await renderPage(true); toast(`Saved: ${o.name}`);
    } catch (e) { go.disabled = false; err.hidden = false; err.textContent = `Couldn't save: ${String(e && e.message || e).slice(0, 140)}`; }
  });
  $$("[data-clf]", PAGE_EL).forEach(b => b.addEventListener("click", () => { CLF = CLF === b.dataset.clf ? "" : b.dataset.clf; $$("[data-clf]", PAGE_EL).forEach(x => { const on = x.dataset.clf === CLF; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); }); filterClients(); }));
  $$(".ring[data-v]", PAGE_EL).forEach(el => el.style.setProperty("--p", el.dataset.v.split(":")[1]));
  $("#clc")?.addEventListener("click", ev => {
    const o = ev.target.closest("[data-callopen]"), a = ev.target.closest("[data-calladd]"), more = ev.target.closest("[data-callmore]");
    if (o) callToggle(o.dataset.callopen, false); else if (a) callToggle(a.dataset.calladd, true);
    else if (more) { CALLS_ALL = !CALLS_ALL; $("#clc").innerHTML = callsInner(CACHE.clients.calls); $("#clc [data-callmore]")?.focus(); }
  });
  filterClients(); fillCalls();
  $("#cl-list")?.addEventListener("click", ev => {
    const a = ev.target.closest("[data-cl]"); if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey) return; ev.preventDefault();
    const c = CACHE.clients.list.find(x => x.id === a.dataset.cl); if (!c) return;
    $$("#cl-list [data-cl]").forEach(x => x.dataset.cl === c.id ? x.setAttribute("aria-current", "true") : x.removeAttribute("aria-current"));
    $("#cl-detail").innerHTML = clientDetail(c, CACHE.clients.t); applyVars($("#cl-detail")); $$("#cl-detail .ring[data-v]").forEach(el => el.style.setProperty("--p", el.dataset.v.split(":")[1])); history.replaceState({ p: "clients" }, "", `?p=clients&c=${encodeURIComponent(c.id)}`); fillCalls();
    if (innerWidth <= 900) $("#cl-detail").scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" });
  });
}

/* 3b. client performance (SIMAS 11-20: "a new tab in the crm for client performance where we could click on the client and see their
   metrics and their account"). Data: scripts/client_metrics.py scan, twice a day (client_accounts, client_posts, client_reports).
   Weeks = rolling 7-day windows by posting date; views are today's counts, so the newest week always looks lower at first. */
const PL = { youtube: ["YouTube", "YT"], tiktok: ["TikTok", "TT"], instagram: ["Instagram", "IG"] };
const kf = v => v == null || !isFinite(v) ? "—" : v >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : v >= 1e4 ? Math.round(v / 1e3) + "k" : v >= 1e3 ? (v / 1e3).toFixed(1).replace(/\.0$/, "") + "k" : String(Math.round(v));
const pfDelta = (cur, prev) => cur == null || !prev ? "" : `<span class="${cur >= prev ? "sd-up" : "sd-dn"}">${cur >= prev ? "▲" : "▼"} ${Math.abs(Math.round(100 * (cur - prev) / prev))}%</span>`;
async function loadPerf() {
  const since = new Date(Date.now() - 120 * 864e5).toISOString();
  const [ret, accts, posts, reps, clients, dels] = await Promise.all([
    all("retainers", "*"), all("client_accounts", "*").catch(() => []),
    all("client_posts", "platform,post_id,email,url,title,posted_at,duration_s,is_short,views,likes,comments,ours,our_ref", q => q.gte("posted_at", since).order("posted_at", { ascending: false })).catch(() => []),
    all("client_reports", "*", q => q.order("week", { ascending: false })).catch(() => []),
    all("clients", "id,name,emails,show,website"), all("deliveries", "client_id,title,order_name,delivered_at")]);
  const now = Date.now(), age = p => (now - new Date(p.posted_at)) / 864e5;
  const list = ret.filter(r => /^(active|past_due|trialing)$/.test(r.status || "")).map(r => {
    const e = lc(r.email), A = accts.filter(a => lc(a.email) === e), P = posts.filter(p => lc(p.email) === e), cl = clients.find(c => (c.emails || []).some(x => lc(x) === e)), byN = {};
    (cl ? dels.filter(x => x.client_id === cl.id) : []).forEach(x => { const m = /Short (\d+)/i.exec(x.title || ""); if (!m) return; const n = +m[1]; if (!byN[n] || String(x.delivered_at || "") >= String(byN[n].delivered_at || "")) byN[n] = x; });
    const ours = Object.entries(byN).map(([n, x]) => ({ n: +n, title: String(x.title || "").replace(/^.*?Short \d+( v\d+)?\s*-?\s*/i, "") || "Short " + n, at: x.delivered_at, order: x.order_name || "", posts: P.filter(p => p.ours && p.our_ref === "Short " + n) })).sort((a, b) => a.n - b.n);
    const pDay = dayOf(r.started_at); ours.forEach(o => { o.plan = !!(o.at && String(o.at).slice(0, 10) >= pDay); });   // Benas 11-20: an earlier pack doesn't count toward the plan
    const planOurs = ours.filter(o => o.plan);
    const end = r.current_period_end ? new Date(r.current_period_end) : null, start = end ? new Date(end) : null; if (start) start.setUTCMonth(start.getUTCMonth() - 1);
    const sDay = start ? dayOf(start.toISOString()) : "", latest = [...ours].sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))[0];
    const plat = ["youtube", "tiktok", "instagram"].map(pl => { const sh = P.filter(p => p.platform === pl && p.is_short && p.views != null && p.posted_at), weeks = [];
      for (let w = 5; w >= 0; w--) { const v = sh.filter(p => age(p) >= 7 * w && age(p) < 7 * (w + 1)).map(p => +p.views); weeks.push({ w, n: v.length, med: medn(v) }); }
      const in28 = sh.filter(p => age(p) < 28).sort((a, b) => b.views - a.views);
      /* v7 (SIMAS 11-21 "the other two clients aren't working"): those clients post long videos and photo posts, no Shorts, so a
         Shorts-only view was empty. Every platform now also carries its latest posts of any kind. */
      const any = P.filter(p => p.platform === pl && p.posted_at), any28 = any.filter(p => age(p) < 28);
      return { pl, acct: A.find(a => a.platform === pl) || null, sh, weeks, last: medn(sh.filter(p => age(p) < 7).map(p => +p.views)), prev: medn(sh.filter(p => age(p) >= 7 && age(p) < 28).map(p => +p.views)), best: in28.slice(0, 3), worst: in28.slice(3).slice(-2).reverse(),
        any28, lastAny: any[0] || null, recent: sh.filter(p => age(p) < 42).length, mv: medn(any28.filter(p => p.views != null).map(p => +p.views)), ml: medn(any28.filter(p => p.likes != null).map(p => +p.likes)) };
    }).filter(x => x.acct || x.sh.length || x.any28.length);
    const posted = new Set(P.filter(p => p.ours && p.our_ref).map(p => p.our_ref)), alt = plat.filter(x => x.any28.length).sort((a, b) => b.any28.length - a.any28.length)[0] || null, quiet = !plat.some(x => x.recent), main = plat.filter(x => x.recent).sort((a, b) => b.sh.filter(p => age(p) < 60).length - a.sh.filter(p => age(p) < 60).length || (b.pl === "youtube") - (a.pl === "youtube"))[0] || null;
    const yt = A.find(a => a.platform === "youtube"), handle = (yt && yt.handle) || (A[0] && A[0].handle) || "";
    return { key: e, r, cl, alt, quiet, web: (cl && cl.website) || "", name: (A.find(a => a.name) || {}).name || (cl && cl.show) || r.name || (cl && cl.name) || e, handle, A, P, plat, main, ours, planOurs, sDay,
      monthN: ours.filter(o => sDay && o.at && String(o.at).slice(0, 10) >= sDay).length, planN: latest ? +((/^(\d+)\s*Shorts/i.exec(latest.order) || [])[1]) || null : null,
      postedN: planOurs.filter(o => posted.has("Short " + o.n)).length, scan: A.reduce((m, a) => (a.updated_at && a.updated_at > m ? a.updated_at : m), ""), reps: reps.filter(x => lc(x.email) === e) };
  }).sort((a, b) => (+b.r.amount || 0) - (+a.r.amount || 0));
  return { list, synced: list.reduce((m, c) => (c.scan > m ? c.scan : m), ""), t: dayOf(new Date().toISOString()) };
}
const PORD = ["youtube", "tiktok", "instagram"], hAt = h => !h ? "" : String(h).startsWith("@") ? String(h) : "@" + h, host = u => String(u || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
const pfAccts = c => c.A.slice().sort((a, b) => PORD.indexOf(a.platform) - PORD.indexOf(b.platform));
/* SIMAS 11-20: "we also need to know YouTube, TikTok and all their social links" */
const pfLinks = c => { const L = pfAccts(c).map(a => ({ k: a.platform, url: a.url, name: PL[a.platform] ? PL[a.platform][0] : a.platform, ab: PL[a.platform] ? PL[a.platform][1] : "", h: hAt(a.handle), f: a.followers }));
  if (c.web) L.push({ k: "website", url: c.web, name: "Website", ab: "W", h: host(c.web), f: null });
  return L.length ? `<div class="pf-links">${L.map(x => `<a class="pf-ln ${x.k}" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer" title="Open ${esc(x.name)}"><i>${esc(x.ab)}</i><span>${esc(x.name)} <b>${esc(x.h)}</b></span>${x.f != null ? `<small>${kf(x.f)}</small>` : ""}${ic("link")}</a>`).join("")}</div>` : ""; };
const pfPost = p => `<a class="vid" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" title="Open on ${esc((PL[p.platform] || [p.platform])[0])}"><span class="pl">${ic("play")}${p.ours ? `<em class="vt">Ours · ${esc(p.our_ref)}</em>` : ""}</span><b>${esc(p.title || "Post")}</b><small><span class="mono">${p.views != null ? kf(p.views) + " views" : p.likes != null ? kf(p.likes) + " likes" : "no count"}</span> · ${esc((PL[p.platform] || [p.platform])[0])} · ${esc(dLabel(dayOf(p.posted_at)))}</small></a>`;
function pfTrend(p) {
  if (!p.recent) { const n = p.any28.length, kind = p.pl === "youtube" ? "video" : "post";
    return `<div class="pf-pl"><div class="pf-h"><b>${PL[p.pl][0]}</b><small>${p.acct ? `${kf(p.acct.followers)} followers` : ""}</small><span class="pf-d">${n ? `${n} ${kind}${n === 1 ? "" : "s"} in 28 days${p.mv != null ? ` · median <b class="mono">${kf(p.mv)}</b> views` : p.ml != null ? ` · median <b class="mono">${kf(p.ml)}</b> likes` : ""}` : `nothing posted in 28 days${p.lastAny ? ` · last post ${esc(dLabel(dayOf(p.lastAny.posted_at)))}` : ""}`}</span></div>
      <p class="sp-note">No Shorts here in the last 6 weeks, so there is no Shorts trend yet.${n ? " Their latest posts:" : ""}</p>${n ? `<div class="vid-grid">${p.any28.slice(0, 3).map(pfPost).join("")}</div>` : ""}</div>`; }
  if (p.pl === "instagram" && !p.sh.length) return `<div class="pf-pl"><div class="pf-h"><b>Instagram</b><small>${p.acct ? `${kf(p.acct.followers)} followers · ${kf(p.acct.posts_count)} posts` : ""}</small></div><p class="sp-note">Reel views need Meta access. Without a login, Instagram shows only the account numbers.</p></div>`;
  const max = Math.max(1, ...p.weeks.map(w => w.med || 0));
  return `<div class="pf-pl"><div class="pf-h"><b>${PL[p.pl][0]}</b><small>${p.acct ? `${kf(p.acct.followers)} followers` : ""}</small><span class="pf-d">last 7 days <b class="mono">${kf(p.last)}</b> ${pfDelta(p.last, p.prev)} <span class="mut">vs ${kf(p.prev)} the 3 weeks before</span></span></div>
    <div class="wk mini pf-wk">${p.weeks.map((w, i) => `<i class="${w.w === 0 ? "on" : ""}" data-v="h:${((w.med || 0) / max * 100).toFixed(1)}%;k:${i}" title="${w.w === 0 ? "Last 7 days (still growing)" : `${w.w}–${w.w + 1} weeks ago`}: ${w.n} Short${w.n === 1 ? "" : "s"}, median ${w.med == null ? "—" : int(w.med)} views"></i>`).join("")}</div>
    <div class="pf-wl">${p.weeks.map(w => `<span><b class="mono">${w.med == null ? "—" : kf(w.med)}</b><small>${w.w === 0 ? "now" : `−${w.w} wk`} · ${w.n}</small></span>`).join("")}</div></div>`;
}
function perfDetail(c) {
  if (!c) return empty("Pick a client on the left.");
  const end = c.r.current_period_end, left = end ? Math.max(0, Math.ceil((new Date(end) - Date.now()) / 864e5)) : null, waiting = c.planOurs.length - c.postedN;
  const d60 = p => (Date.now() - new Date(p.posted_at)) / 864e5 < 60, topS = c.P.filter(p => p.is_short && p.views != null && d60(p)).sort((a, b) => b.views - a.views).slice(0, 6);
  const top = topS.length ? topS : c.P.filter(p => p.posted_at && d60(p) && (p.views != null || p.likes != null)).sort((a, b) => (b.views ?? b.likes ?? 0) - (a.views ?? a.likes ?? 0)).slice(0, 6);
  return `<div class="cl-head"><div><h2>${esc(c.name)}</h2><p>${esc([c.handle, c.key, `last scan ${ago(c.scan)}`].filter(Boolean).join(" · "))}</p></div>
    <div class="cl-chips"><span class="chip acc">${usd(c.r.amount)} / month</span>${c.planN ? `<span class="chip">${c.monthN} / ${c.planN} Shorts this month</span>` : ""}${left != null ? `<span class="chip">renews in ${left} d · ${esc(dLabel(dayOf(end)))}</span>` : ""}<span class="chip ${c.postedN ? "g" : "o"}">ours posted ${c.postedN} / ${c.planOurs.length}</span></div></div>
    ${pfLinks(c)}${c.quiet ? `<p class="pf-quiet"><b>No Shorts posted in the last 6 weeks.</b> This client posts long videos and photo posts, so the numbers below are for those. The Shorts trend starts when they post Shorts, ours or their own.</p>` : ""}
    <div class="cl-plan"><b class="cl-ph">Views and trend</b><p class="sp-note">Median views per Short, by the week it was posted (last 6 weeks). Under each bar: weeks ago · Shorts posted that week. The newest week is still growing.</p>${c.plat.map(pfTrend).join("") || empty("No account scanned yet. Add this client to scripts/data/client_perf/accounts.json.")}</div>
    ${c.plat.filter(p => p.best.length).map(p => `<div class="cl-ord">${esc(PL[p.pl][0])} · best Shorts, last 28 days</div><div class="vid-grid">${p.best.map(pfPost).join("")}</div>${p.worst.length ? `<div class="cl-ord">${esc(PL[p.pl][0])} · lowest, last 28 days</div><div class="vid-grid">${p.worst.map(pfPost).join("")}</div>` : ""}`).join("")}
    <div class="cl-plan"><b class="cl-ph">Did they post ours · ${c.postedN} posted · ${waiting} waiting</b><p class="sp-note">Matched by length and title words against their public YouTube and TikTok posts. Instagram is matched by caption words only (Meta doesn't share video length), so check those by eye.</p>
      ${c.ours.length ? `<div class="tblw"><table class="tbl pf-tbl"><thead><tr><th>Short</th><th>Title</th><th>Delivered</th><th>Posted</th></tr></thead><tbody>${c.ours.map(o => `<tr><td>${o.n}</td><td>${esc(o.title)}</td><td>${esc(dLabel(String(o.at || "").slice(0, 10)))}${o.plan ? "" : ` <small class="mut">earlier pack</small>`}</td><td>${o.posts.length ? o.posts.map(p => `<a class="chip g" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(PL[p.platform][0])} ${esc(dLabel(dayOf(p.posted_at)))}</a>`).join(" ") : `<span class="chip">not yet</span>`}</td></tr>`).join("")}</tbody></table></div>` : empty("No delivered Short indexed for this client yet.")}</div>
    <div class="cl-ord">What works · top ${topS.length ? "Shorts" : "posts"}, last 60 days</div>${top.length ? `<div class="vid-grid">${top.map(pfPost).join("")}</div>` : empty("Nothing posted in the last 60 days.")}
    <div class="cl-plan"><b class="cl-ph">Weekly reports</b>${c.reps.length ? c.reps.map(x => { const dd = x.data || {}; return `<div class="cl-pr"><span class="grow"><b>Week of ${esc(dLabel(String(x.week).slice(0, 10)))}</b> ${esc(dd.summary || dd.headline || "")}</span>${x.page_url ? `<a class="chip lkc" href="${esc(x.page_url)}" target="_blank" rel="noopener noreferrer">Page ↗</a>` : ""}<span class="chip ${x.status === "sent" ? "g" : ""}">${esc(x.status)}${x.sent_at ? " " + esc(dLabel(dayOf(x.sent_at))) : ""}</span></div>`; }).join("") : empty("First report from week 2, once our Shorts are posted and have views.")}</div>
    <div class="cl-plan"><b class="cl-ph">Account and plan</b>${c.A.map(a => `<div class="cl-pr"><span class="grow"><b>${esc(PL[a.platform] ? PL[a.platform][0] : a.platform)}</b> <a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.handle || a.url)} ↗</a></span><span class="mono">${kf(a.followers)} followers · ${kf(a.posts_count)} posts</span></div>`).join("") || empty("No accounts on file.")}
      <div class="cl-pr"><span class="grow">Plan</span><span class="mono">${usd(c.r.amount)} / month${c.planN ? ` · ${c.planN} Shorts` : ""} · since ${esc(dLabel(dayOf(c.r.started_at)))}</span></div>
      <div class="cl-pr"><span class="grow">Delivered this billing month</span><span class="mono">${c.monthN}${c.planN ? ` / ${c.planN}` : ""}${c.sDay ? ` · since ${esc(dLabel(c.sDay))}` : ""}</span></div></div>`;
}
const perfRow = (c, sel) => { const m = c.main;
  return `<a class="cl-item" href="?p=perf&amp;k=${encodeURIComponent(c.key)}" data-pf="${esc(c.key)}"${sel && c.key === sel.key ? ' aria-current="true"' : ""}><span class="av">${esc(initials(c.name))}</span><span class="grow"><span class="t">${esc(c.name)}</span><span class="s">${esc([`${usd(c.r.amount)}/mo`, ...pfAccts(c).map(a => `${PL[a.platform] ? PL[a.platform][1] : a.platform} ${hAt(a.handle)} ${kf(a.followers)}`), c.web ? host(c.web) : ""].filter(Boolean).join(" · "))}</span></span><span class="n">${c.postedN}/${c.planOurs.length}</span><span class="cl-ch">${m ? `<span class="chip">${PL[m.pl][1]} 7 d ${kf(m.last)} ${pfDelta(m.last, m.prev)}</span>` : c.alt ? `<span class="chip">${PL[c.alt.pl][1]} · ${c.alt.any28.length} post${c.alt.any28.length === 1 ? "" : "s"} in 28 d · no Shorts</span>` : `<span class="chip">nothing posted in 28 d</span>`}</span></a>`; };
function viewPerf(d) {
  if (!d.list.length) return empty("No monthly client yet. Retainer clients show here.");
  const sel = d.list.find(c => c.key === lc(param("k") || "")) || d.list[0], all3 = d.list.reduce((s, c) => s + c.planOurs.length, 0), postedAll = d.list.reduce((s, c) => s + c.postedN, 0);
  const best = d.list.flatMap(c => c.P.filter(p => p.is_short && p.views != null && (Date.now() - new Date(p.posted_at)) / 864e5 < 7).map(p => ({ p, c }))).sort((a, b) => b.p.views - a.p.views)[0];
  return `<div class="sp-kpis">${kpi("Monthly clients", int(d.list.length), usd(d.list.reduce((s, c) => s + (+c.r.amount || 0), 0)) + " a month")}${kpi("Our Shorts posted", `${int(postedAll)} / ${int(all3)}`, all3 - postedAll ? `${all3 - postedAll} delivered, not posted yet` : "all posted")}${kpi("Best Short this week", best ? kf(best.p.views) : "—", best ? `${esc(best.c.name)} · ${esc((PL[best.p.platform] || [""])[0])}` : "no Short posted in 7 days")}${kpi("Last scan", esc(ago(d.synced)), "runs every Sunday 10:00")}</div>
  <div class="cl-wrap"><section class="card sp-card"><div class="cl-list" id="pf-list">${d.list.map(c => perfRow(c, sel)).join("")}</div></section>
    <section class="card sp-card" id="pf-detail">${perfDetail(sel)}</section></div>`;
}
function wirePerf() {
  $("#pf-list")?.addEventListener("click", ev => {
    const a = ev.target.closest("[data-pf]"); if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey) return; ev.preventDefault();
    const c = CACHE.perf.list.find(x => x.key === a.dataset.pf); if (!c) return;
    $$("#pf-list [data-pf]").forEach(x => x.dataset.pf === c.key ? x.setAttribute("aria-current", "true") : x.removeAttribute("aria-current"));
    $("#pf-detail").innerHTML = perfDetail(c); applyVars($("#pf-detail")); history.replaceState({ p: "perf" }, "", `?p=perf&k=${encodeURIComponent(c.key)}`);
    if (innerWidth <= 900) $("#pf-detail").scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" });
  });
}

/* 4. weekly analysis (SIMAS 11-19 15:3x: "what worked, what we changed, what performed best"; revenue is one small card) */
const medn = a => { const s = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const fmtH = h => h == null ? "—" : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`;
async function loadWeekly() {
  const t = dayOf(Date.now()), w0 = monday(t), from = addDays(w0, -7 * 7), since21 = new Date(Date.now() - 21 * 864e5).toISOString();
  const opt = p => p.catch(() => null), optL = p => p.catch(() => []);
  const [m, arms, ab, daily, interested, pipe, payments, retainers, deliveries, promises, fu, scopes, changes, threads, snaps, clients, lostLog] = await Promise.all([
    opt(panel("metrics")), opt(panel("arms")), opt(panel("ab_tests")),
    all("campaign_daily", "day,opportunities", q => q.gte("day", from)),
    all("interested_leads", "email,first_name,company,campaign_id,interest_changed_at,last_reply_at,created_at"),
    all("pipeline", "email,name,status,yes_at,delivered_at,last_reply_at,paid,fu_stage,fu_day0,notes,updated_at"),
    all("payments", "client_id,email,payer_name,amount,refunded,paid_at"),
    optL(all("retainers", "id,email,name,amount,interval,status,started_at,current_period_end,canceled_at")),
    all("deliveries", "delivered_at", q => q.gte("delivered_at", from)),
    optL(all("promises", "lead_email,promise,owner,due_at,status", q => q.eq("status", "open"))),
    optL(all("fu_state", "email,state,due_at")),
    optL(all("scopes", "*", q => q.order("sent_at", { ascending: false }))),
    optL(all("change_log", "*", q => q.order("day", { ascending: false }).order("id", { ascending: false }))),
    optL(all("threads", "lead_email,at,direction", q => q.gte("at", since21).order("at"))),
    optL(all("weekly_snapshots", "week,data", q => q.order("week", { ascending: false }).limit(9))),
    optL(all("clients", "id,name")),
    optL(all("stage_log", "lead_email,to_status,at", q => q.eq("to_status", "LOST").gte("at", new Date(Date.now() - 15 * 864e5).toISOString()))),
  ]);
  const M = m && m.data, k = Math.round((new Date(t + "T12:00:00Z") - new Date(w0 + "T12:00:00Z")) / 864e5) + 1, p0 = addDays(w0, -7), p1 = addDays(p0, k - 1);
  const inC = d => d && d >= w0 && d <= t, inP = d => d && d >= p0 && d <= p1, cnt = (rows, f, inR) => rows.filter(r => inR(dayOf(f(r)))).length;
  const both = (rows, f) => ({ cur: cnt(rows, f, inC), prev: cnt(rows, f, inP) });
  const pays = payments.filter(p => !p.refunded && p.paid_at).map(p => ({ ...p, amount: +p.amount || 0, day: dayOf(p.paid_at) }));
  const PW = M && M.periods ? M.periods.week : null, PP = M && M.periods ? M.periods.prev_week_same_days : null;
  const missing = [];
  /* funnel */
  const price = pipe.filter(p => p.fu_stage === "asked_price");
  const funnel = [
    ["New leads contacted", PW ? PW.contacted : null, PP ? PP.contacted : null], ["Real replies", PW ? PW.replies : null, PP ? PP.replies : null], ["Positive replies", PW ? PW.opportunities : null, PP ? PP.opportunities : null],
    ["Sample yes", ...Object.values(both(pipe, r => r.yes_at))], ["Samples delivered", ...Object.values(both(pipe, r => r.delivered_at))],
    ["Price asked", cnt(price, r => r.fu_day0, inC), cnt(price, r => r.fu_day0, inP)], ["Scopes sent", ...Object.values(both(scopes, r => r.sent_at))], ["Paid", ...Object.values(both(pays, r => r.paid_at))],
  ].map(([label, cur, prev]) => ({ label, cur, prev }));
  missing.push("Price asked: only leads whose CURRENT stage is 'asked price' are counted (stage history isn't stored), so last week's number is too low.");
  if (!scopes.some(s => dayOf(s.sent_at) < w0)) missing.push("Scopes started 11-18: there is no earlier week to compare.");
  /* scopes */
  const sPaid = scopes.filter(s => s.status === "paid" && s.paid_at), sHrs = sPaid.map(s => (new Date(s.paid_at) - new Date(s.sent_at)) / 36e5).filter(h => h >= 0);
  const scopeRev = sPaid.filter(s => inC(dayOf(s.paid_at))).reduce((a, s) => a + (+s.amount || 0), 0), weekRev = pays.filter(p => inC(p.day)).reduce((a, p) => a + p.amount, 0);
  const SC = { rows: scopes, sent: scopes.length, paid: sPaid.length, medH: medn(sHrs), rev: scopeRev, mrr: sPaid.filter(s => s.monthly).reduce((a, s) => a + (+s.amount || 0), 0), other: Math.max(0, weekRev - scopeRev) };
  /* hot leads */
  const paidEmails = new Set([...pays.map(p => lc(p.email)), ...pipe.filter(p => p.paid && String(p.paid).trim()).map(p => lc(p.email))].filter(Boolean));
  const pBy = Object.fromEntries(pipe.map(p => [lc(p.email), p])), hotSet = new Set(interested.map(x => lc(x.email)));
  pipe.forEach(p => { if ((p.status || "").toUpperCase() === "HOT" || /^(said_yes|asked_price)$/.test(p.fu_stage || "")) hotSet.add(lc(p.email)); });
  pipe.forEach(p => { if (/^(parked|none)$/.test(p.fu_stage || "")) hotSet.delete(lc(p.email)); });
  const hotNow = [...hotSet].filter(e => !paidEmails.has(e) && !/^LOST$/i.test((pBy[e] || {}).status || "")).length;
  const byLead = {}; threads.forEach(x => (byLead[lc(x.lead_email)] = byLead[lc(x.lead_email)] || []).push(x));
  const gaps = []; hotSet.forEach(e => { let wait = null; (byLead[e] || []).forEach(x => { if (x.direction !== "out") { if (wait == null) wait = +new Date(x.at); } else if (wait != null) { if (inC(dayOf(wait))) gaps.push((+new Date(x.at) - wait) / 6e4); wait = null; } }); });
  const cohort = interested.filter(x => { const d = dayOf(x.interest_changed_at); return d >= p0 && d < w0; }).map(x => { const e = lc(x.email), p = pBy[e] || {}, lastIn = (byLead[e] || []).filter(y => y.direction !== "out").pop();
    const out = paidEmails.has(e) ? "paid" : /^LOST$/i.test(p.status || "") ? "lost" : (p.delivered_at || p.yes_at || /^(asked_price|said_yes)$/.test(p.fu_stage || "")) ? "forward" : (!lastIn || Date.now() - new Date(lastIn.at) > 5 * 864e5) ? "quiet" : "alive"; return { e, out }; });
  const co = k2 => cohort.filter(c => c.out === k2).length;
  const lastSnap = snaps.find(s => s.week === p0), HOT = { now: hotNow, weekAgo: lastSnap && lastSnap.data && lastSnap.data.hot ? lastSnap.data.hot.now : null, n: gaps.length, in30: gaps.filter(g => g <= 30).length, in2h: gaps.filter(g => g <= 120).length, med: medn(gaps),
    cohort: cohort.length, paid: co("paid"), forward: co("forward"), alive: co("alive"), quiet: co("quiet"), lost: co("lost"), retention: cohort.length ? Math.round(100 * (co("paid") + co("forward") + co("alive")) / cohort.length) : null,
    fuOver: fu.filter(f => f.state === "active" && f.due_at && new Date(f.due_at) < new Date()).length };
  if (HOT.weekAgo == null) missing.push("Hot leads a week ago: no saved snapshot yet. This page saves one each week from now on, so the comparison appears next week.");
  /* clients / retention */
  const live = retainers.filter(r => /active|trialing|past_due/i.test(r.status || "")), mrr = live.reduce((a, r) => a + (+r.amount || 0), 0), newR = live.filter(r => inC(dayOf(r.started_at)));
  const firstPay = {}; pays.forEach(p => { const key = p.client_id || lc(p.email); if (!firstPay[key] || p.day < firstPay[key]) firstPay[key] = p.day; });
  const repeat = new Set(pays.filter(p => inC(p.day) && firstPay[p.client_id || lc(p.email)] < w0).map(p => p.client_id || lc(p.email)));
  const cName = Object.fromEntries(clients.map(c => [c.id, c.name]));
  const CL = { mrr, mrrNew: newR.reduce((a, r) => a + (+r.amount || 0), 0), newR: newR.map(r => `${r.name} ${usd(r.amount)}/mo`), churned: retainers.filter(r => inC(dayOf(r.canceled_at))).map(r => r.name), repeat: [...repeat].map(x => cName[x] || x),
    vids: both(deliveries, r => r.delivered_at), promOpen: promises.length, promLate: promises.filter(p => p.due_at && new Date(p.due_at) < new Date()).length,
    renew: live.slice().sort((a, b) => String(a.current_period_end).localeCompare(String(b.current_period_end))).map(r => ({ name: r.name, day: dayOf(r.current_period_end), amount: r.amount })) };
  /* samples */
  const hrs = inR => pipe.filter(p => p.yes_at && p.delivered_at && inR(dayOf(p.delivered_at))).map(p => (new Date(p.delivered_at) - new Date(p.yes_at)) / 36e5).filter(h => h >= 0 && h < 720);
  const d14 = pipe.filter(p => p.delivered_at && dayOf(p.delivered_at) >= addDays(t, -14) && dayOf(p.delivered_at) <= addDays(t, -2)), allDel = pipe.filter(p => p.delivered_at);
  const buyer = p => /^(WON|DONE)$/i.test(p.status || "") || !!(p.paid && String(p.paid).trim());
  const SA = { medCur: medn(hrs(inC)), medPrev: medn(hrs(inP)), nCur: hrs(inC).length, replyN: d14.length, replied: d14.filter(p => p.last_reply_at && new Date(p.last_reply_at) > new Date(p.delivered_at)).length, del: allDel.length, paid: allDel.filter(buyer).length,
    lost: pipe.filter(p => /^LOST$/i.test(p.status || "") && lostLog.some(x => lc(x.lead_email) === lc(p.email) && inC(dayOf(x.at)))).map(p => ({ name: p.name || p.email, why: (p.notes || "").replace(/\s+/g, " ").slice(-160) })) };
  missing.push("Sample rejections: the reason is the tail of the lead's Samples-tab note, not a dedicated field.");
  /* trend, revenue */
  const weeks = []; for (let i = 7; i >= 0; i--) weeks.push(addDays(w0, -7 * i));
  const first = {}; interested.forEach(r => { const d = dayOf(r.interest_changed_at), e = lc(r.email); if (d && (!first[e] || d < first[e])) first[e] = d; }); pipe.forEach(r => { const d = dayOf(r.yes_at), e = lc(r.email); if (d && (!first[e] || d < first[e])) first[e] = d; });
  const trend = weeks.map(w => ({ w, now: w === w0, pos: Object.values(first).filter(d => monday(d) === w).length, paid: pays.filter(p => monday(p.day) === w).length, rev: pays.filter(p => monday(p.day) === w).reduce((a, p) => a + p.amount, 0) }));
  const REV = { cur: weekRev, prev: pays.filter(p => inP(p.day)).reduce((a, p) => a + p.amount, 0) };
  /* campaigns + arms + A/B */
  const camps = M ? (M.campaigns || []).filter(c => c.week && (c.week.sent || (c.prev_week && c.prev_week.sent))).sort((a, b) => b.week.sent - a.week.sent) : [];
  const ok = camps.filter(c => c.week.contacted >= 100 && c.week.pos_rate != null), best = ok.slice().sort((a, b) => b.week.pos_rate - a.week.pos_rate)[0], worst = ok.length > 1 ? ok.slice().sort((a, b) => a.week.pos_rate - b.week.pos_rate)[0] : null;
  if (!M) missing.push("Outreach numbers: the metrics sync hasn't written yet.");
  if (!arms) missing.push("Source / arm tags: the hourly arms sync hasn't written yet.");
  missing.push("Source / arm tags: all time and last-14-days only (Instantly's lead list has no first-send date, so no clean week split), and its replies include auto-replies.");
  const abRows = ab && ab.data ? ab.data.campaigns || [] : [];
  if (!abRows.some(c => (c.steps || []).some(s => s.A.sent && s.B.sent))) missing.push("A/B tests: the 50/50 split started 11-19 evening and A and B have not both sent since, so there is nothing to compare yet.");
  /* ---- Weekly Business Review model (SIMAS 11-20: "a real weekly analysis ... on a big, large-company scale"; Roast Room 2026-11-20-weekly-analysis:
     health line, $10k bridge, funnel constraint, campaign league, A/B readouts, engine, sales, clients, changes with before/after, next week) ---- */
  const [cdR, clR, idlR, cpoR, crpR, caccR] = await Promise.all([
    optL(all("campaign_daily", "campaign_id,day,sent,new_leads,replies,replies_auto,opportunities", q => q.gte("day", addDays(w0, -56)))),
    optL(all("campaign_live", "campaign_id,name,status,daily_limit,inboxes,emails_sent,bounced,unsubscribed")),
    optL(all("inbox_daily", "email,day,sent,replies,bounced", q => q.gte("day", addDays(w0, -56)))),
    optL(all("client_posts", "email,platform,our_ref,posted_at", q => q.eq("ours", true))),
    optL(all("client_reports", "email,week,status,sent_at")),
    optL(all("client_accounts", "email,name")),
  ]);
  const cd = fixOpp(cdR || [], interested), clv = clR || [], idl = idlR || [], cpo = cpoR || [], crp = crpR || [], cacc = caccR || [];
  const sumBy = (rows, f) => rows.reduce((a, r) => a + (+f(r) || 0), 0), rt = (a, b) => b ? 100 * a / b : null;
  const aggC = rows => ({ nl: sumBy(rows, r => r.new_leads), rep: sumBy(rows, r => r.replies), opp: sumBy(rows, r => r.opportunities), sent: sumBy(rows, r => r.sent) });
  const aggI = rows => ({ sent: sumBy(rows, r => r.sent), bnc: sumBy(rows, r => r.bounced), rep: sumBy(rows, r => r.replies) });
  const inDays = (a, b) => r => r.day >= a && r.day <= b;
  const stc = (v, tgt, o = {}) => v == null || !isFinite(v) || (o.n != null && o.n < (o.min || 100)) ? "x" : o.low ? (v <= tgt ? "g" : v <= tgt * (o.amber || 1.25) ? "a" : "r") : (v >= tgt ? "g" : v >= tgt * .8 ? "a" : "r");
  const W8 = weeks.map(w => { const e = addDays(w, 6), f = inDays(w, e); return { w, now: w === w0, ...aggC(cd.filter(f)), i: aggI(idl.filter(f)), rev: sumBy(pays.filter(p => p.day >= w && p.day <= e), p => p.amount) }; });
  const T4 = W8.slice(3, 7), CW = aggC(cd.filter(r => inC(r.day))), CI = aggI(idl.filter(r => inC(r.day)));
  const pace = 10000 * k / 7, d28 = addDays(t, -27), C28 = aggC(cd.filter(inDays(d28, t))), R28 = sumBy(pays.filter(p => p.day >= d28 && p.day <= t), p => p.amount);
  const inbW = {}; idl.filter(r => inC(r.day)).forEach(r => { const o = inbW[r.email] = inbW[r.email] || { sent: 0, bnc: 0, rep: 0 }; o.sent += +r.sent || 0; o.bnc += +r.bounced || 0; o.rep += +r.replies || 0; });
  const redInb = Object.values(inbW).filter(o => o.sent >= 30 && o.bnc / o.sent > .02).length, posNow = rt(CW.opp, CW.nl), rpk = C28.nl ? 1000 * R28 / C28.nl : null, rpkT = 10000 / 1.61, bncNow = rt(CI.bnc, CI.sent);
  const TILES = [
    { label: "Cash collected", v: weekRev, f: usd, st: stc(weekRev, pace), sub: `pace for $10k: ${usd(pace)} by today · MRR ${usd(mrr)}`, tip: "Money paid this week (Stripe + logged payments, refunds out) against $10,000 a week, pro-rated to today.", spark: W8.map(x => ({ v: x.rev, now: x.now })) },
    { label: "Positive reply rate", v: posNow, f: v => v.toFixed(1) + "%", st: stc(posNow, 2, { n: CW.nl }), sub: `${int(CW.opp)} positive of ${int(CW.nl)} new leads · bar 2%`, tip: "Positive replies (Instantly opportunities) ÷ new leads contacted this week. Green at 2% or more; grey under 100 leads.", spark: W8.map(x => ({ v: rt(x.opp, x.nl) || 0, now: x.now })) },
    { label: "New leads contacted", v: CW.nl, f: int, st: stc(CW.nl, 230 * k), sub: `${int(CW.nl / k)} a day vs the 230 plan`, tip: "First emails sent to new leads this week, against 230 a day.", spark: W8.map(x => ({ v: x.nl, now: x.now })) },
    { label: "Revenue per 1,000 leads", v: rpk, f: usd, st: stc(rpk, rpkT, { n: C28.nl }), sub: `last 28 days: ${usd(R28)} ÷ ${int(C28.nl)} leads · target ${usd(rpkT)}`, tip: "Cash in the last 28 days ÷ new leads contacted in the last 28 days × 1,000. One number for the whole funnel. Target = $10k ÷ 1,610 leads a week.", spark: W8.map(x => ({ v: x.nl ? 1000 * x.rev / x.nl : 0, now: x.now })) },
    { label: "Bounce rate", v: bncNow, f: v => v.toFixed(2) + "%", st: stc(bncNow, 1, { low: true, amber: 2, n: CI.sent, min: 200 }), sub: `${int(CI.bnc)} of ${int(CI.sent)} emails · ${redInb ? `<span class="sd-dn">${redInb} inbox${redInb === 1 ? "" : "es"} over 2%</span>` : "no inbox over 2%"}`, tip: "Bounced ÷ emails sent this week, from the per-inbox numbers. Green at 1% or less, red over 2%.", spark: W8.map(x => ({ v: rt(x.i.bnc, x.i.sent) || 0, now: x.now })) },
  ];
  const reds = TILES.filter(x => x.st === "r"), ambers = TILES.filter(x => x.st === "a"), andL = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  const VERD = { st: reds.length >= 3 ? "r" : reds.length || ambers.length >= 2 ? "a" : "g", word: reds.length >= 3 ? "Off track" : reds.length || ambers.length >= 2 ? "Watch" : "On track",
    why: reds.length ? `${andL(reds.map(x => x.label.toLowerCase()))} ${reds.length === 1 ? "is" : "are"} below target` : ambers.length ? `${andL(ambers.map(x => x.label.toLowerCase()))} ${ambers.length === 1 ? "is" : "are"} close to target` : "every health number is at or above target" };
  /* $10k bridge */
  const retBy = Object.fromEntries(live.map(r => [lc(r.email), r])), cNm = Object.fromEntries(cacc.filter(a => a.name).map(a => [lc(a.email), a.name])), nmOf = r => cNm[lc(r.email)] || r.name;
  const wkP = pays.filter(p => inC(p.day)), isMo = p => { const r = retBy[lc(p.email)]; return !!r && Math.abs(p.amount - (+r.amount || 0)) < 1; }, isNew = p => firstPay[p.client_id || lc(p.email)] >= w0;
  const BR = { total: weekRev, monthly: sumBy(wkP.filter(isMo), p => p.amount), packs: sumBy(wkP.filter(p => !isMo(p)), p => p.amount), fromNew: sumBy(wkP.filter(isNew), p => p.amount), fromRepeat: sumBy(wkP.filter(p => !isNew(p)), p => p.amount), n: wkP.length,
    gap: Math.max(0, 10000 - weekRev), pace, st: stc(weekRev, pace), mrrNew: CL.mrrNew, churned: CL.churned, renew14: live.filter(r => r.current_period_end && dayOf(r.current_period_end) <= addDays(t, 14)).map(r => ({ name: nmOf(r), day: dayOf(r.current_period_end), amount: +r.amount || 0 })) };
  /* funnel leak finder: step % this week vs the 4 full weeks before */
  const wkCount = (rows, f, w) => rows.filter(r => { const d0 = dayOf(f(r)); return d0 && d0 >= w && d0 <= addDays(w, 6); }).length;
  const perWeek = x => [x.nl, x.rep, x.opp, wkCount(pipe, r => r.yes_at, x.w), wkCount(pipe, r => r.delivered_at, x.w), wkCount(price, r => r.fu_day0, x.w), wkCount(scopes, r => r.sent_at, x.w), wkCount(pays, r => r.paid_at, x.w)];
  const t4m = T4.map(perWeek), t4s = [0, 1, 2, 3, 4, 5, 6, 7].map(i => t4m.reduce((a, r) => a + r[i], 0));
  const nowC = [CW.nl, CW.rep, CW.opp, ...funnel.slice(3).map(f => f.cur || 0)];
  const FL = ["New leads contacted", "Real replies", "Positive replies", "Sample yes", "Samples delivered", "Price asked", "Scopes sent", "Paid"].map((label, i) => ({ label, now: nowC[i], conv: i ? rt(nowC[i], nowC[i - 1]) : null, avg: i ? rt(t4s[i], t4s[i - 1]) : null, base: i ? nowC[i - 1] : null }));
  let con = null; FL.forEach((s, i) => { if (!i || s.base < 10 || !s.avg) return; const g = (s.conv - s.avg) / s.avg; if (g < -.15 && (!con || g < con.g)) con = { i, g }; });
  if (con) FL[con.i].constraint = true;
  /* campaign league (100-send rule: 100 new leads, then 2%+ positive or dead) */
  const shortN = n => String(n || "").replace(/ — test\b/, " (test)").replace(/^TEST — /, "Test: ").replace(/ — V1 Batch 1$/, "").replace(/ \(\d\d-\d\d\)$/, "").replace(/^ARM (T\d) — /, "$1 · ").replace(/ — /g, " · ");
  const nmC = {}, CB = {}; ((M && M.campaigns) || []).forEach(c => { nmC[c.id] = { name: c.name, status: c.status, emails_sent: c.sent, bounced: c.bounced }; }); clv.forEach(c => { nmC[c.campaign_id] = { ...c, ...(nmC[c.campaign_id] || {}) }; });
  cd.forEach(r => { const o = CB[r.campaign_id] = CB[r.campaign_id] || { id: r.campaign_id, cur: [], prev: [], d28: [] }; if (inC(r.day)) o.cur.push(r); if (inP(r.day)) o.prev.push(r); if (r.day >= d28 && r.day <= t) o.d28.push(r); });
  const LEAGUE = Object.values(CB).map(o => { const L = nmC[o.id] || {}, c = aggC(o.cur), p = aggC(o.prev), m28 = aggC(o.d28), pos28 = rt(m28.opp, m28.nl);
    return { id: o.id, name: shortN(L.name) || "Archived campaign", full: L.name || `No longer in Instantly (id ${o.id.slice(0, 8)})`, active: L.status === 1, cur: c, d28: m28, rep: rt(c.rep, c.nl), repP: rt(p.rep, p.nl), pos: rt(c.opp, c.nl), posP: rt(p.opp, p.nl), pos28,
      bounce: L.emails_sent ? 100 * (+L.bounced || 0) / L.emails_sent : null, verdict: m28.nl < 100 ? "early" : pos28 >= 2 ? "scale" : pos28 < 1 ? "kill" : "hold" }; }).filter(x => x.d28.nl || x.cur.nl);
  const ranked = LEAGUE.filter(x => x.verdict !== "early").sort((a, b) => b.pos28 - a.pos28), mainIds = [...new Set([...ranked.slice(0, 5), ...ranked.slice(5).slice(-3)].map(x => x.id))];
  /* A/B readouts: two-proportion test in words; founders' rule = 300 sends per side + 8 positives before a winner */
  const abD = ab && ab.data ? ab.data : {}, rules = abD.rules || {}, minS = rules.min_sends || 300, minP = rules.min_pos || 8;
  const zOf = (a, b) => { if (!a.sent || !b.sent) return 0; const p = (a.positives + b.positives) / (a.sent + b.sent), se = Math.sqrt(p * (1 - p) * (1 / a.sent + 1 / b.sent)); return se ? Math.abs(b.positives / b.sent - a.positives / a.sent) / se : 0; };
  const AB = (abD.campaigns || []).flatMap(c => (c.steps || []).filter(s => s.in_test !== false && s.A && s.B).map(s => { const n = Math.min(s.A.sent, s.B.sent), z = zOf(s.A, s.B), need = Math.max(0, minS - n), pa = rt(s.A.positives, s.A.sent), pb = rt(s.B.positives, s.B.sent);
    const lead = pa == null || pb == null ? null : pb > pa ? "B" : pa > pb ? "A" : null, lift = pa ? (pb - pa) / pa : null;
    return { camp: c.name, step: s.step, A: s.A, B: s.B, pa, pb, lift, sending: s.A.sent + s.B.sent > 0, conf: need > 0 ? `Too early: needs ~${int(need)} more sends per side` : z >= 1.96 ? "High" : z >= 1.28 ? "Medium" : "Low",
      status: need > 0 ? "Too early" : z >= 1.96 && s.A.positives + s.B.positives >= minP && lead ? `${lead} wins` : lead && z >= 1.28 ? `${lead} leading` : "Tie so far" }; }));
  const SUBJ = (abD.subjects && abD.subjects.groups) || [], ABW = abD.what || {};
  /* engine + deliverability (only outlier inboxes) */
  const nInb = Object.values(inbW).filter(o => o.sent > 0).length, cap = nInb * 30 * k, inb4 = {};
  idl.filter(inDays(addDays(w0, -28), addDays(w0, -1))).forEach(r => { const o = inb4[r.email] = inb4[r.email] || { sent: 0, rep: 0 }; o.sent += +r.sent || 0; o.rep += +r.replies || 0; });
  const OUT = Object.entries(inbW).map(([e, o]) => { const b = inb4[e] || { sent: 0, rep: 0 }, br = rt(o.bnc, o.sent), rr = rt(o.rep, o.sent), rr4 = rt(b.rep, b.sent), why = [];
    if (o.sent >= 30 && br > 2) why.push(`bounce ${br.toFixed(1)}%`); if (b.sent >= 100 && o.sent >= 50 && rr4 && rr < rr4 / 2) why.push(`replies ${rr.toFixed(1)}% vs ${rr4.toFixed(1)}% before`); return { e, sent: o.sent, why }; }).filter(x => x.why.length);
  const ENG = { perDay: CW.nl / k, st: stc(CW.nl / k, 230), nInb, cap, used: cap ? CI.sent / cap : null, sent: CI.sent, bounce: bncNow, unsub: rt(sumBy(clv, c => c.unsubscribed), sumBy(clv, c => c.emails_sent)), lanes: LEAGUE.filter(x => x.cur.nl).sort((a, b) => b.cur.nl - a.cur.nl), out: OUT };
  /* sales + delivery */
  const delAll = pipe.filter(p => p.delivered_at), priced = delAll.filter(p => p.fu_stage === "asked_price" || buyer(p));
  const SL = { replyMed: HOT.med, in30: HOT.n ? rt(HOT.in30, HOT.n) : null, n: HOT.n, sampleH: SA.medCur, toPrice: rt(priced.length, delAll.length), toPaid: rt(SA.paid, SA.del), promOpen: CL.promOpen, promLate: CL.promLate, fuOver: HOT.fuOver };
  SL.st = SL.in30 == null ? "x" : stc(SL.in30, 80);
  /* clients + retention */
  const CLX = { posted: cpo.length, rep: crp.filter(r => String(r.week).slice(0, 10) === w0), renew: CL.renew.map(r => ({ ...r, name: cNm[lc((live.find(x => x.name === r.name) || {}).email)] || r.name })) };
  /* changes + rules with before/after */
  const typ = a => /^(testing|copy|campaigns)$/.test(a) ? "Experiment" : /^(leads|process|ops)$/.test(a) ? "Ops" : "Rule";
  const CH = changes.filter(c => c.day >= addDays(t, -13)).map(c => { let ba = null;
    if (/^(testing|copy|campaigns|leads)$/.test(c.area)) { const b = aggC(cd.filter(inDays(addDays(c.day, -14), addDays(c.day, -1)))), a = aggC(cd.filter(inDays(c.day, t))), days = Math.round((new Date(t + "T12:00:00Z") - new Date(c.day + "T12:00:00Z")) / 864e5) + 1;
      const rb = rt(b.opp, b.nl), ra = rt(a.opp, a.nl), conf = changes.some(o => o !== c && o.area === c.area && Math.abs((new Date(o.day) - new Date(c.day)) / 864e5) <= 7);
      ba = { rb, ra, nb: b.nl, na: a.nl, days, v: days < 7 || a.nl < 300 ? "Too early" : conf ? "Confounded" : rb && ra >= rb * 1.15 ? "Worked" : rb && ra <= rb * .85 ? "Worse" : "No effect" }; }
    return { ...c, type: typ(c.area), ba }; });
  /* next week: 3 actions with an owner */
  const OWN = i => i <= 2 ? "Simas's Claude (lead supply + copy)" : i <= 4 ? "Both Claudes (samples)" : "Founders (closing)";
  const bestC = ranked.find(x => x.verdict === "scale"), worstC = ranked.slice().reverse().find(x => x.verdict === "kill");
  const NEXT = [
    con ? { t: `Fix the constraint: ${FL[con.i].label.toLowerCase()} converted ${FL[con.i].conv.toFixed(1)}% this week vs ${FL[con.i].avg.toFixed(1)}% on average.`, o: OWN(con.i) } : { t: "No funnel step fell below its 4-week average. Keep the volume up.", o: "Simas's Claude" },
    bestC ? { t: `Scale ${bestC.name}: ${bestC.pos28.toFixed(1)}% positive over ${int(bestC.d28.nl)} leads in 28 days. Give it more new leads a day.`, o: "Simas's Claude (lead supply)" } : { t: "No campaign is at 2%+ positive with 100+ leads yet. Keep testing.", o: "Both" },
    worstC ? { t: `Pause or rework ${worstC.name}: ${worstC.pos28.toFixed(1)}% positive over ${int(worstC.d28.nl)} leads (rule: 100 sends, then 2%+ or dead).`, o: "Founders (campaign changes need both)" } : { t: "No campaign is under 1% after 100 leads. Nothing to kill.", o: "—" },
  ];
  const W = { TILES, VERD, BR, FL, con, LEAGUE, mainIds, AB, SUBJ, ABW, minS, ENG, SL, CLX, CH, NEXT, k };
  /* headlines: biggest moves with enough volume */
  const H = [];
  funnel.forEach(f => { if (f.cur != null && f.prev != null && Math.max(f.cur, f.prev) >= 5 && f.prev > 0) { const r = (f.cur - f.prev) / f.prev; if (Math.abs(r) >= .15) H.push({ s: Math.abs(r) * Math.log10(10 + Math.max(f.cur, f.prev)), good: r > 0, text: `${f.label}: ${int(f.prev)} → ${int(f.cur)} (${r > 0 ? "+" : "−"}${Math.abs(Math.round(r * 100))}% vs the same ${k} days last week)` }); } });
  if (SC.sent) H.push({ s: 3, good: SC.paid > 0, text: `Scopes: ${SC.sent} sent → ${SC.paid} paid${sPaid.length ? ` (${sPaid.map(s => `${s.client.split(" (")[0]} ${usd(s.amount)}${s.monthly ? "/mo" : ""}`).join(", ")})` : ""}` });
  if (best) H.push({ s: 2, good: true, text: `Best campaign this week: ${best.name.split(" —")[0]} at ${best.week.pos_rate.toFixed(1)}% positive (${best.week.contacted} contacted)` });
  if (worst && worst !== best) H.push({ s: 1.5, good: false, text: `Weakest campaign: ${worst.name.split(" —")[0]} at ${worst.week.pos_rate.toFixed(1)}% positive (${worst.week.contacted} contacted)` });
  if (CL.mrrNew) H.push({ s: 2.5, good: true, text: `New monthly revenue: +${usd(CL.mrrNew)}/mo (${CL.newR.join(", ")}); MRR now ${usd(mrr)}` });
  if (HOT.retention != null && HOT.cohort >= 5) H.push({ s: 1.8, good: HOT.retention >= 50, text: `Hot-lead retention: ${HOT.retention}% of last week's ${HOT.cohort} hot leads are still alive or converted` });
  const heads = H.sort((a, b) => b.s - a.s).slice(0, 5);
  const D = { W, t, w0, k, funnel, camps, best: best && best.id, worst: worst && worst !== best ? worst.id : null, arms: arms && arms.data, armsAt: arms && arms.updated_at, snaps, ab: abRows, SC, HOT, CL, SA, trend, REV, changes, heads, missing, synced: m ? m.updated_at : null };
  D.export = { week_of: w0, days_so_far: k, compared_with: `same ${k} days last week`, headlines: heads.map(h => h.text), funnel: funnel.map(f => ({ step: f.label, this_week: f.cur, last_week_same_days: f.prev })),
    campaigns: camps.map(c => ({ name: c.name, this_week: c.week, last_week_same_days: c.prev_week })), arms: D.arms ? D.arms.arms : null, ab_tests: abRows.map(c => ({ campaign: c.name, since: c.since, steps: c.steps })),
    scopes: { sent: SC.sent, paid: SC.paid, median_hours_to_pay: SC.medH, revenue_this_week_usd: SC.rev, mrr_from_scopes_usd: SC.mrr, payments_without_scope_usd: SC.other, list: scopes.map(s => ({ client: s.client, offer: s.offer, amount: s.amount, monthly: s.monthly, sent_at: s.sent_at, paid_at: s.paid_at, status: s.status })) },
    hot: HOT, clients: CL, samples: SA, revenue_usd: REV, trend_8_weeks: trend.map(x => ({ week_of: x.w, positives: x.pos, payments: x.paid, revenue_usd: x.rev })), changes: changes.map(c => ({ day: c.day, area: c.area, what: c.what, who: c.who })), thin_or_missing: missing,
    review: { verdict: `${W.VERD.word}: ${W.VERD.why}`, health: W.TILES.map(x => ({ metric: x.label, value: x.v, status: x.st })), constraint: W.con ? W.FL[W.con.i].label : null, funnel_step_pct: W.FL.map(s => ({ step: s.label, this_week: s.now, step_pct: s.conv, avg_4w: s.avg })),
      campaigns: W.LEAGUE.map(x => ({ name: x.full, new_leads_week: x.cur.nl, reply_pct: x.rep, positive_pct: x.pos, positive_28d: x.pos28, leads_28d: x.d28.nl, verdict: x.verdict })), ab: W.AB.filter(x => x.sending).map(x => ({ test: `${x.camp} ${x.step}`, A: x.A, B: x.B, status: x.status, confidence: x.conf })), next_week: W.NEXT } };
  sb().from("weekly_snapshots").upsert({ week: w0, data: D.export, updated_at: new Date().toISOString() }).then(() => {}, () => {});   // history builds up week by week
  return D;
}
const dl = (cur, prev, opts = {}) => { if (cur == null) return `<span class="mut">no data yet</span>`; if (prev == null) return `<span class="mut">no earlier data yet</span>`; if (!prev) return `<span class="mut">last week ${opts.f ? opts.f(prev) : int(prev)}</span>`; const r = (cur - prev) / prev, up = opts.lowGood ? r <= 0 : r >= 0; return `<span class="${up ? "sd-up" : "sd-dn"}">${r >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(r * 100))}%</span> <span class="mut">vs ${opts.f ? opts.f(prev) : int(prev)}</span>`; };
const pp = (a, b) => b ? (100 * a / b).toFixed(1) + "%" : "—";
function cols(weeks, key, cls, fmt) {
  const mx = Math.max(1, ...weeks.map(w => w[key]));
  return `<div class="wk-cols ${cls}" role="img" aria-label="${esc(weeks.map(w => `${dLabel(w.w)}: ${fmt(w[key])}`).join(", "))}">${weeks.map(w => `<i class="${w.now ? "now" : ""}" data-v="h:${Math.max(2, Math.round(100 * w[key] / mx))}%" title="${esc(`Week of ${dLabel(w.w)}: ${fmt(w[key])}`)}"></i>`).join("")}</div>
    <div class="wk-axis" aria-hidden="true">${weeks.map(w => `<span>${esc(dLabel(w.w))}</span>`).join("")}</div>`;
}
function rank(rows) {
  const mx = Math.max(.1, ...rows.map(r => Math.max(r.v || 0, r.pv || 0)));
  return rows.length ? `<div class="wk-rank">${rows.map(r => `<div class="wk-rk"><span class="n">${esc(r.name)}${r.tag === "best" ? ` <em class="chip g">best</em>` : r.tag === "weakest" ? ` <em class="chip r">weakest</em>` : r.tag === "small" ? ` <em class="chip">small sample</em>` : ""}</span><span class="b"><i class="${r.tag === "weakest" ? "c-red" : r.tag === "small" ? "c-grey" : "c-green"}" data-v="w:${r.v ? Math.max(2, Math.round(100 * r.v / mx)) : 0}%"></i>${r.pv != null ? `<u data-v="x:${Math.min(100, Math.round(100 * r.pv / mx))}%" title="last week ${r.pv.toFixed(1)}%"></u>` : ""}</span><b>${r.v == null ? "—" : r.v.toFixed(1) + "%"}</b><small>${esc(r.sub || "")} · ${int(r.n)} contacted</small></div>`).join("")}</div>` : empty("No data yet.");
}
let WKSEL = null;
function viewSnap(w, x, d) {
  const f = x.funnel || [];
  return `<div class="wk-tools"><span class="mut">Saved snapshot of the week of ${esc(dLabel(w))}</span>${wkPick(d)}</div>
  <section class="card sp-card wk-top"><h2>What worked that week</h2>${(x.headlines || []).length ? `<div class="wk-heads">${x.headlines.map(h => `<div class="wk-head g"><i></i><span>${esc(h)}</span></div>`).join("")}</div>` : empty("No headlines were saved.")}</section>
  <section class="card sp-card"><h2>Funnel <small>as saved</small></h2><div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Step</th><th class="num">That week</th><th class="num">Week before (same days)</th></tr></thead><tbody>${f.map(r => `<tr><td>${esc(r.step)}</td><td class="num">${r.this_week == null ? "—" : int(r.this_week)}</td><td class="num">${r.last_week_same_days == null ? "—" : int(r.last_week_same_days)}</td></tr>`).join("")}</tbody></table></div></section>
  <section class="card sp-card"><h2>Changes logged by then</h2><div class="wk-log">${logHtml((x.changes || []).map((c, i) => ({ ...c, id: i })))}</div></section>`;
}
const wkPick = d => `<span class="wk-pick"><label class="mut" for="wk-week">Week</label><select id="wk-week">${[d.w0, ...d.snaps.map(s => s.week).filter(w => w !== d.w0)].map(w => `<option value="${w}"${(WKSEL || d.w0) === w ? " selected" : ""}>${w === d.w0 ? "This week" : "Week of " + esc(dLabel(w))}</option>`).join("")}</select><button type="button" class="act go" id="wk-copy">${ic("copy")}Copy for Claude</button></span>`;
function viewWeekly(d) {
  if (WKSEL && WKSEL !== d.w0) { const sn = d.snaps.find(s => s.week === WKSEL); if (sn) return viewSnap(WKSEL, sn.data || {}, d); }
  const W = d.W, DOT = { g: "At or above target", a: "Within 20% of target", r: "Below target", x: "Too early: small sample" };
  const dot = s => `<i class="wbr-dot ${s}" title="${DOT[s]}"></i>`, f1 = v => v == null || !isFinite(v) ? "—" : v.toFixed(1) + "%";
  const sec = (n, title, s, say, body, next, cls = "") => `<section class="card sp-card wbr-sec ${cls}"><h2><span><em class="wk-n">${n}</em>${title}</span>${s ? dot(s) : ""}</h2>${say ? `<p class="wbr-say">${say}</p>` : ""}${body}${next ? `<p class="wbr-next"><b>Do next</b><span>${next}</span></p>` : ""}</section>`;
  const stat = (label, val, sub, tip) => `<div class="wk-stat"${tip ? ` title="${esc(tip)}"` : ""}><span>${esc(label)}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
  const spark = s => { const mx = Math.max(1e-9, ...s.map(x => x.v || 0)); return `<div class="wbr-spark" aria-hidden="true">${s.map((x, i) => `<i class="${x.now ? "now" : ""}" data-v="h:${Math.max(4, Math.round(100 * (x.v || 0) / mx))}%;k:${i}"></i>`).join("")}</div>`; };
  const arr = (c, p) => c == null || p == null ? "" : ` <span class="${c >= p ? "sd-up" : "sd-dn"}" title="vs the same days last week: ${f1(p)}">${c >= p ? "▲" : "▼"}</span>`;
  /* 1. health line */
  const V = W.VERD, tiles = `<div class="wbr-tiles">${W.TILES.map(x => `<div class="wbr-tile st-${x.st}" title="${esc(x.tip)}"><span class="l">${dot(x.st)}${esc(x.label)}</span><b>${x.v == null || !isFinite(x.v) ? "—" : x.f(x.v)}</b><small>${x.sub}</small>${spark(x.spark)}<span class="wbr-tl">last 8 weeks · faded bar = this week so far</span></div>`).join("")}</div>`;
  const hero = `<section class="card sp-card wbr-hero st-${V.st}"><div class="wbr-hl">${dot(V.st)}<b>${V.word}</b><span>because ${esc(V.why)}.</span></div>
    <div class="wbr-legend"><span>${dot("g")}at or above target</span><span>${dot("a")}within 20%</span><span>${dot("r")}below target</span><span>${dot("x")}too early (small sample)</span><span class="mut">Hover any number for how it's counted.</span></div>${tiles}</section>`;
  /* 2. $10k bridge */
  const B = W.BR, bridge = sec(2, "The $10k bridge", B.st, `${usd(B.total)} collected so far: ${usd(B.gap)} short of $10k, ${B.total >= B.pace ? "ahead of" : "behind"} the ${usd(B.pace)} pace for day ${W.k}.`,
    `<div class="wk-stats">${stat("Monthly plans", usd(B.monthly), "subscription payments this week")}${stat("Packs and one-offs", usd(B.packs), `${int(B.n)} payment${B.n === 1 ? "" : "s"} this week in total`)}${stat("From new clients", usd(B.fromNew), "first payment this week")}${stat("From repeat clients", usd(B.fromRepeat), "paid before")}${stat("New MRR", usd(B.mrrNew), B.churned.length ? `<span class="sd-dn">churned: ${esc(B.churned.join(", "))}</span>` : "no churn this week")}</div>
     <p class="sp-note">Renewals in the next 14 days: ${B.renew14.map(r => `${esc(r.name)} ${esc(dLabel(r.day))} (${usd(r.amount)})`).join(" · ") || "none"}.</p>`,
    "Close the leads already waiting on a price or a scope first: they are one step from paying.");
  /* 3. funnel leak finder */
  const fmx = Math.max(1, ...W.FL.map(s => s.now || 0)), C = W.con ? W.FL[W.con.i] : null;
  const fun = `<div class="wbr-fun"><div class="wbr-fs hd"><span>Step</span><span></span><span class="r">This week</span><span class="r">Step %</span><span class="r">4-wk avg</span></div>${W.FL.map((s, i) => `<div class="wbr-fs${s.constraint ? " con" : ""}"><span class="l">${esc(s.label)}${s.constraint ? ` <em class="chip r">This week's constraint</em>` : ""}</span><span class="b"><i data-v="w:${s.now ? Math.max(3, Math.round(Math.sqrt(s.now / fmx) * 100)) : 0}%"></i></span><b class="mono">${int(s.now)}</b><span class="cv">${i ? f1(s.conv) : ""}</span><span class="avg4">${i ? f1(s.avg) : ""}</span></div>`).join("")}</div>
    <p class="sp-note">Step % = this step ÷ the step before it, this week. 4-wk avg = the same for the 4 full weeks before. Real replies leave out auto-replies. Price asked counts only leads whose current stage is "asked price", so it runs low.</p>`;
  const funnelS = sec(3, "Funnel leak finder", C ? "r" : "g", C ? `The weakest step is <b>${esc(C.label.toLowerCase())}</b>: ${f1(C.conv)} this week vs ${f1(C.avg)} on average.` : "No step fell more than 15% below its 4-week average.", fun, esc(W.NEXT[0].t));
  /* 4. campaign league */
  const vchip = v => ({ scale: `<span class="chip g" title="2%+ positive over 100+ leads (28 days)">Scale</span>`, hold: `<span class="chip" title="Between 1% and 2% positive">Hold</span>`, kill: `<span class="chip r" title="Under 1% positive after 100+ leads">Kill</span>`, early: `<span class="chip" title="Under 100 new leads in 28 days">Too early</span>` }[v]);
  const lrow = x => `<tr><td title="${esc(x.full)}">${esc(x.name)}${x.active ? "" : ` <span class="chip">paused</span>`}</td><td class="num">${int(x.cur.nl)}</td><td class="num">${f1(x.rep)}${arr(x.rep, x.repP)}</td><td class="num">${f1(x.pos)}${arr(x.pos, x.posP)}</td><td class="num">${f1(x.pos28)}<span class="sub">${int(x.d28.nl)} leads</span></td><td class="num">${x.bounce == null ? "—" : x.bounce.toFixed(1) + "%"}</td><td>${vchip(x.verdict)}</td></tr>`;
  const thead = `<thead><tr><th>Campaign</th><th class="num" title="New leads contacted this week">New leads</th><th class="num" title="Real replies ÷ new leads, this week. Auto-replies are not counted: Instantly's unique-reply count excludes them (tested 11-19). Arrow = vs the same days last week.">Reply %</th><th class="num" title="Positive replies (Instantly opportunities) ÷ new leads, this week. Arrow = vs the same days last week.">Positive %</th><th class="num" title="Positive % over the last 28 days: the number the verdict uses">28-day positive</th><th class="num" title="Bounced ÷ emails sent, all time">Bounce</th><th title="Scale = 2%+ positive over 100+ leads · Hold = 1–2% · Kill = under 1% after 100+ · Too early = under 100 leads">Verdict</th></tr></thead>`;
  const main = W.LEAGUE.filter(x => W.mainIds.includes(x.id)).sort((a, b) => b.pos28 - a.pos28), rest = W.LEAGUE.filter(x => !W.mainIds.includes(x.id)).sort((a, b) => b.d28.nl - a.d28.nl);
  const nS = W.LEAGUE.filter(x => x.verdict === "scale").length, nK = W.LEAGUE.filter(x => x.verdict === "kill").length, nE = W.LEAGUE.filter(x => x.verdict === "early").length, top = main[0];
  const A = d.arms && d.arms.arms ? d.arms.arms.filter(a => a.contacted >= 100).sort((a, b) => b.pos_rate - a.pos_rate) : [];
  const armT = A.length ? `<div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Source / arm tag</th><th class="num">Contacted</th><th class="num">Positive %</th><th class="num">Last 14 d contacted</th><th class="num">Positive % 14 d</th></tr></thead><tbody>${A.map(a => `<tr><td>${esc(a.arm)}<span class="sub">${esc((a.campaigns || []).join(", "))}</span></td><td class="num">${int(a.contacted)}</td><td class="num">${f1(a.pos_rate)}</td><td class="num">${int(a.contacted_14d)}</td><td class="num">${f1(a.pos_rate_14d)}</td></tr>`).join("")}</tbody></table></div><p class="sp-note">All-time, 100+ leads contacted. ${esc(d.arms.note || "")}</p>` : empty("No source tags with 100+ leads yet.");
  const league = sec(4, "Campaign league", nS ? "g" : nK ? "r" : "a", `${nS} campaign${nS === 1 ? "" : "s"} ready to scale, ${nK} under 1%, ${nE} still too early to judge.${top ? ` Best over 28 days: <b>${esc(top.name)}</b> at ${f1(top.pos28)}.` : ""}`,
    main.length ? `<div class="sp-scroll"><table class="sp-tbl wbr-lg">${thead}<tbody>${main.map(lrow).join("")}</tbody></table></div>` : empty("No campaign has 100+ new leads in the last 28 days yet."),
    `${esc(W.NEXT[1].t)} ${W.NEXT[2].o !== "—" ? esc(W.NEXT[2].t) : ""}`) .replace("</section>", `<details class="ab-txt"><summary>All campaigns <small>${W.LEAGUE.length} · sorted by 28-day volume</small></summary><div class="sp-scroll"><table class="sp-tbl wbr-lg">${thead}<tbody>${[...main, ...rest].map(lrow).join("")}</tbody></table></div></details><details class="ab-txt"><summary>By source / arm tag <small>all time</small></summary>${armT}</details></section>`);
  /* 5. A/B tests */
  const abS = W.AB.filter(x => x.sending), wins = W.AB.filter(x => /wins/.test(x.status)).length;
  const abT = abS.length ? `<div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Test</th><th class="num">A sends</th><th class="num">A positive</th><th class="num">B sends</th><th class="num">B positive</th><th class="num" title="B's positive rate vs A's">Lift</th><th title="How sure we can be, from a two-proportion test (shown in words)">Confidence</th><th>Status</th></tr></thead><tbody>${abS.map(x => `<tr><td>${esc(x.camp)}<span class="sub">${esc(x.step)}</span></td><td class="num">${int(x.A.sent)}</td><td class="num">${f1(x.pa)}</td><td class="num">${int(x.B.sent)}</td><td class="num">${f1(x.pb)}</td><td class="num">${x.lift == null || !isFinite(x.lift) ? "—" : (x.lift > 0 ? "+" : "") + Math.round(x.lift * 100) + "%"}</td><td>${esc(x.conf)}</td><td><span class="chip${/wins/.test(x.status) ? " g" : /leading/.test(x.status) ? " b" : ""}">${esc(x.status)}</span></td></tr>`).join("")}</tbody></table></div>` : empty("No test has sent both A and B since the 50/50 split started.");
  const subj = W.SUBJ.map(g => `<div class="wbr-subj"><b>Subject lines · ${esc(g.name)}</b>${(g.arms || []).map(a => `<span class="chip">${esc(a.label)} · ${int(a.sent)} sent · ${a.pos_rate == null ? "—" : (+a.pos_rate).toFixed(1) + "%"}</span>`).join("")}<small class="mut">${esc(g.verdict || "")}</small></div>`).join("");
  const abSec = sec(5, "A/B tests", wins ? "g" : "x", `${W.AB.length} tests set up, ${abS.length} sending both sides, ${wins} winner${wins === 1 ? "" : "s"}. A winner needs ${int(W.minS)}+ sends per side and a clear gap.`,
    `<p class="sp-note">${esc(W.ABW.A ? "A: " + W.ABW.A : "")} ${esc(W.ABW.B ? "B: " + W.ABW.B : "")}</p>${abT}${subj}<p class="sp-note"><a class="lk" href="?p=email" data-go="email">Open Email campaigns</a> for the winner cards and whether each change was made.</p>`,
    wins ? "Roll each winner out to its campaign and log the change below." : "Keep the split running and don't change copy mid-test, or the result resets.");
  /* 6. engine + deliverability */
  const E = W.ENG, emx = Math.max(1, ...E.lanes.map(x => x.cur.nl));
  const engine = sec(6, "Engine & deliverability", E.st, `${int(E.perDay)} new leads a day vs the 230 plan. ${E.nInb} inboxes sent ${int(E.sent)} emails, ${E.used == null ? "—" : Math.round(E.used * 100) + "%"} of their capacity. Bounce ${E.bounce == null ? "—" : E.bounce.toFixed(2) + "%"}.`,
    `<div class="wk-stats">${stat("New leads a day", int(E.perDay), "plan 230", "New leads contacted this week ÷ days so far")}${stat("Inboxes sending", int(E.nInb), "this week")}${stat("Capacity used", E.used == null ? "—" : Math.round(E.used * 100) + "%", `${int(E.sent)} of ${int(E.cap)} (30 a day per inbox)`)}${stat("Bounce", E.bounce == null ? "—" : E.bounce.toFixed(2) + "%", "this week")}${stat("Unsubscribed", E.unsub == null ? "—" : E.unsub.toFixed(2) + "%", "all time")}</div>
     <div class="sp-bars">${E.lanes.slice(0, 8).map(x => barRow(x.name, int(x.cur.nl), x.cur.nl / emx)).join("") || empty("No new leads this week yet.")}</div>
     ${E.out.length ? `<div class="wbr-out"><b>Inboxes to look at</b>${E.out.map(o => `<div><span class="mono">${esc(o.e)}</span><span class="sd-dn">${esc(o.why.join(" · "))}</span><small class="mut">${int(o.sent)} sent</small></div>`).join("")}</div>` : `<p class="sp-note">No inbox over 2% bounce, and no inbox's replies fell by half.</p>`}`,
    E.perDay < 230 ? `Fill the lead queues: about ${int(Math.max(0, 230 - E.perDay))} more new leads a day are needed.` : "Hold the volume and watch the inboxes listed above.");
  /* 7. sales + delivery */
  const S = W.SL, sales = sec(7, "Sales & delivery", S.st, `Hot leads got a reply in ${fmtH(S.replyMed == null ? null : S.replyMed / 60)} (median)${S.in30 != null ? `, ${Math.round(S.in30)}% within 30 minutes` : ""}. Samples were ready ${fmtH(S.sampleH)} after the yes. ${f1(S.toPaid)} of delivered samples have paid.`,
    `<div class="wk-stats">${stat("Reply to hot leads", fmtH(S.replyMed == null ? null : S.replyMed / 60), S.n ? `median of ${S.n} this week` : "no hot-lead replies yet")}${stat("Within 30 min", S.in30 == null ? "—" : Math.round(S.in30) + "%", "target 80%")}${stat("Sample yes → ready", fmtH(S.sampleH), "median this week")}${stat("Sample → price asked", f1(S.toPrice), "all delivered samples")}${stat("Sample → paid", f1(S.toPaid), "all time")}${stat("Promises", int(S.promOpen), S.promLate ? `<span class="sd-dn">${S.promLate} late</span>` : "none late")}${stat("Follow-ups overdue", int(S.fuOver), "")}</div>`,
    S.promLate ? `Clear the ${S.promLate} late promise${S.promLate === 1 ? "" : "s"} before any new sales email.` : S.in30 != null && S.in30 < 80 ? "Answer hot leads faster: the goal is 80% within 30 minutes." : "Keep replies under 30 minutes and keep every promise on time.");
  /* 8. clients */
  const CX = W.CLX, Cl = d.CL, nRep = CX.rep.length, nSent = CX.rep.filter(r => r.status === "sent").length;
  const clients = sec(8, "Clients & retention", CX.posted ? "g" : Cl.mrr ? "r" : "x", `MRR ${usd(Cl.mrr)}. Clients have posted ${int(CX.posted)} of our Shorts so far. ${nRep ? `${nSent} of ${nRep} weekly client reports sent.` : "Weekly client reports start in each client's week 2."}`,
    `<div class="wk-stats">${stat("MRR", usd(Cl.mrr), Cl.mrrNew ? `<span class="sd-up">+${usd(Cl.mrrNew)}</span> this week` : "no change")}${stat("New monthly clients", int(Cl.newR.length), esc(Cl.newR.join(", ")))}${stat("Churned", int(Cl.churned.length), esc(Cl.churned.join(", ")))}${stat("Repeat buyers", int(Cl.repeat.length), "this week")}${stat("Videos delivered", int(Cl.vids.cur), dl(Cl.vids.cur, Cl.vids.prev))}${stat("Our Shorts posted", int(CX.posted), `<a class="lk" href="?p=perf" data-go="perf">see Performance</a>`)}</div>
     <p class="sp-note">Renewals: ${CX.renew.map(r => `${esc(r.name)} ${esc(dLabel(r.day))} (${usd(r.amount)})`).join(" · ") || "none"}.</p>`,
    CX.posted ? "Keep the Sunday review going and send each client's weekly report." : "Clients haven't posted our Shorts yet: give each one a simple posting plan at the next check-in.");
  /* 9. changes + rules */
  const tchip = t => t === "Experiment" ? "b" : t === "Ops" ? "" : "o", vc = v => ({ Worked: "g", Worse: "r", Confounded: "o" }[v] || "");
  const nT = t => W.CH.filter(c => c.type === t).length, nWk = W.CH.filter(c => c.ba && c.ba.v === "Worked").length, nEa = W.CH.filter(c => c.ba && c.ba.v === "Too early").length;
  const card = c => `<div class="wbr-card"><div class="top"><span class="mono">${esc(dLabel(c.day))}</span><span class="chip ${tchip(c.type)}">${c.type}</span><span class="chip">${esc(c.area)}</span><span class="mut">${esc(c.who || "")}</span></div><p>${esc(c.what)}</p>${c.ba ? `<div class="ba"><span title="Positive rate, all campaigns, 14 days before the change">before <b>${f1(c.ba.rb)}</b> <small>${int(c.ba.nb)} leads</small></span><span title="Positive rate since the change">since <b>${f1(c.ba.ra)}</b> <small>${int(c.ba.na)} leads · ${c.ba.days} d</small></span><span class="chip ${vc(c.ba.v)}" title="Worked = 15%+ better · Worse = 15%+ lower · Too early = under 7 days or 300 leads · Confounded = another change in the same area within 7 days">${c.ba.v}</span></div>` : ""}</div>`;
  const cards = W.CH.length ? `<div class="wbr-cards">${W.CH.slice(0, 9).map(card).join("")}</div>${W.CH.length > 9 ? `<details class="ab-txt"><summary>${W.CH.length - 9} more from the last 14 days</summary><div class="wbr-cards">${W.CH.slice(9).map(card).join("")}</div></details>` : ""}` : empty("No changes logged in the last 14 days.");
  const chg = sec(9, "What we changed & new rules", "", `${W.CH.length} changes in the last 14 days: ${nT("Rule")} rules, ${nT("Experiment")} experiments, ${nT("Ops")} ops. ${nWk} proven to work so far, ${nEa} too early to judge.`,
    `${cards}<form class="wk-add" id="wk-add"><input name="day" type="date" value="${esc(d.t)}" aria-label="Date" required><select name="area" aria-label="Area">${["copy", "testing", "offer", "pricing", "leads", "campaigns", "replies", "sales", "editing", "clients", "process"].map(a => `<option>${a}</option>`).join("")}</select><input name="what" type="text" maxlength="600" placeholder="Log a change or a new rule (one line)" aria-label="What changed" required><button type="submit" class="act go">${ic("plus")}Add</button></form>
     <details class="ab-txt"><summary>Full change log <small>every change, newest first</small></summary><div class="wk-log" id="wk-log">${logHtml(d.changes)}</div></details>`,
    "Log every new rule here the day it starts, so the page can measure whether it worked.");
  /* 10. next week */
  const next = sec(10, "Next week: 3 actions", "", "", `<ol class="wbr-acts">${W.NEXT.map(x => `<li><span>${esc(x.t)}<small>Owner: ${esc(x.o)}</small></span></li>`).join("")}</ol>`, "");
  /* v7 (SIMAS 11-21: "showcase the winner"): winner of the week in gold = the best 28-day positive rate among the main campaigns, 100+ new leads and at least 2% (verdict "scale"; once-per-lead positives) */
  const win = main.find(x => x.verdict === "scale") || null, runner = win ? main.filter(x => x !== win)[0] || null : main[1] || null, lose = W.LEAGUE.filter(x => x.verdict === "kill").sort((a, b) => a.pos28 - b.pos28)[0] || null, abW = W.AB.find(x => /wins/.test(x.status)) || null;
  const winner = `<section class="card sp-card win-card${win ? "" : " none"}"><span class="win-k">${win ? "Winner of the week" : "No winner yet"}</span>
    ${win ? `<h2 class="win-n">${esc(win.name)}</h2><div class="win-big"><b>${f1(win.pos28)}</b><span>positive replies, last 28 days<small>${int(win.d28.nl)} leads · this week ${int(win.cur.nl)} new leads</small></span></div>` : `<h2 class="win-n">${top ? `${esc(top.name)} is closest, at ${f1(top.pos28)}` : "No campaign has 100 new leads in 28 days yet"}</h2>`}
    <div class="win-rows">${runner ? `<p><b>Runner-up</b><span>${esc(runner.name)} · ${f1(runner.pos28)}</span></p>` : ""}${lose ? `<p><b>Weakest</b><span>${esc(lose.name)} · ${f1(lose.pos28)} over ${int(lose.d28.nl)} leads</span></p>` : ""}<p><b>A/B tests</b><span>${abW ? `${esc(abW.camp)}, ${esc(abW.step)}: ${esc(abW.status)}` : `no test winner yet · ${abS.length} test${abS.length === 1 ? "" : "s"} sending both sides`}</span></p></div>
    <p class="sp-note">Rule: the best 28-day positive rate among the main campaigns, with 100+ new leads and at least 2%.</p></section>`;
  return `<div class="wk-tools"><span class="mut">Week of ${esc(dLabel(d.w0))} · day ${d.k} of 7 · compared with the same ${d.k} day${d.k === 1 ? "" : "s"} last week and the 4 weeks before</span>${wkPick(d)}</div>
  ${hero}${winner}${bridge}${funnelS}${league}${abSec}<div class="sp-2b">${engine}${sales}</div>${clients}${chg}${next}
  <details class="card sp-card ab-txt wbr-notes"><summary>Data notes <small>read before trusting a number</small></summary><ul class="wk-miss">${d.missing.map(x => `<li>${esc(x)}</li>`).join("")}</ul></details>`;
}
const logHtml = rows => rows.length ? rows.map(c => `<div class="wk-ch"><span class="mono">${esc(dLabel(c.day))}</span><span class="chip">${esc(c.area)}</span><span class="w">${esc(c.what)}</span><span class="mut">${esc(c.who || "")}</span></div>`).join("") : empty("No changes logged yet.");
function wireWeekly() {
  $("#wk-week")?.addEventListener("change", ev => { WKSEL = ev.target.value; PAGE_EL.innerHTML = header("weekly", CACHE.weekly) + viewWeekly(CACHE.weekly); applyVars(PAGE_EL); wireWeekly(); });
  $$("[data-go]", PAGE_EL).forEach(a => a.addEventListener("click", ev => { if (ev.metaKey || ev.ctrlKey) return; ev.preventDefault(); go(a.dataset.go); }));
  $("#wk-copy")?.addEventListener("click", async ev => {
    const sn = WKSEL && WKSEL !== CACHE.weekly.w0 ? CACHE.weekly.snaps.find(z => z.week === WKSEL) : null;
    const txt = "BEJÚ weekly snapshot (paste to Claude)\n" + JSON.stringify(sn ? sn.data : CACHE.weekly.export);
    try { await navigator.clipboard.writeText(txt); toast("Copied the week: paste it to Claude"); }
    catch { const ta = document.createElement("textarea"); ta.value = txt; ta.className = "wk-ta"; ta.readOnly = true; ev.currentTarget.closest(".wk-tools").after(ta); ta.select(); toast("Copy blocked by the browser: the text is selected, press ⌘C"); }
  });
  $("#wk-add")?.addEventListener("submit", async ev => {
    ev.preventDefault(); const f = ev.target, what = f.what.value.trim(); if (!what) return;
    await me();
    try { const row = await must(sb().from("change_log").insert({ day: f.day.value, area: f.area.value, what, who: (ME && ME.who !== "Both" ? ME.who : (ME && ME.name)) || null }).select().single());
      CACHE.weekly.changes.unshift(row); CACHE.weekly.changes.sort((a, b) => String(b.day).localeCompare(String(a.day)) || b.id - a.id); $("#wk-log").innerHTML = logHtml(CACHE.weekly.changes); f.what.value = ""; toast("Change logged"); }
    catch (e) { toast("Couldn't save that line. Check your connection."); }
  });
}

/* 5. to-do board (BENAS 11-22 16:0x: "Trello style", "extreme accuracy", founder to-dos ONLY).
   Columns: To do · Benas, To do · Simas, General (a pool either founder takes from), Waiting (paused), Done (last 30 days).
   Reads public.tasks straight, founder sources only: founder_tasks, board, deferred, manual (a Claude-written one shows a "suggested" chip).
   Client work (replies, calls, promises, approvals) lives on its own tabs. A card is a short title + chips; a click opens the side
   panel, where it is edited, parked in Waiting or ticked Done. Dropping a card sets its owner (founder columns, General = "Both")
   or its status (Waiting, Done). The old list a card came from (todo_cards, founder_tasks) gets the same change first.
   v4 (SIMAS 11-22, approval flow): Simas's Claude ends every task as a "Check: <title>" card in To do · Simas (crm.review_card).
   Done = approved. Needs fixing (status 'fixing', owner unchanged) = sent back: the panel opens on "What needs fixing", the note
   is appended to the details as "— YYYY-MM-DD HH:MM <who>: <note>", and the tasks trigger crm_fix pings his Claude
   (crm_events kind 'fix', scripts/watch_board.py). URLs in the details show as link buttons in the panel. */
const FSRC = ["founder_tasks", "board", "deferred", "manual"];   // BENAS 11-22 16:48: only work a FOUNDER must do; Claude's own tasks (source claude) stay off
const COLS = [["Benas", "To do · Benas"], ["Simas", "To do · Simas"], ["fixing", "Needs fixing"], ["general", "General"], ["waiting", "Waiting"], ["done", "Done"]];
const SRCL = { founder_tasks: "Founder to-do", board: "Added on the board", deferred: "Deferred", manual: "Added by hand" };
const OWNL = o => o === "Both" ? "General" : o;
let PNAME = {};
async function promNames() {   // lead / client names for the lead chip: a client's name wins, then the lead's
  const [il, pl, cl] = await Promise.all([all("interested_leads", "email,first_name,company").catch(() => []), all("pipeline", "email,name").catch(() => []), all("clients", "name,emails").catch(() => [])]), m = {};
  il.forEach(x => { const n = [x.first_name, x.company].map(v => String(v || "").trim()).filter(Boolean).join(" · "); if (x.email && n) m[lc(x.email)] = n; });
  pl.forEach(x => { if (x.email && x.name) m[lc(x.email)] = x.name; }); cl.forEach(c => (c.emails || []).forEach(e => { if (c.name) m[lc(e)] = c.name; }));
  return m;
}
const pName = e => PNAME[lc(e)] || String(e || "") || "?";
const vilNoon = d => { const g = Date.parse(d + "T12:00:00Z"), p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(g)).map(x => [x.type, x.value]));
  return new Date(g - (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - g)).toISOString(); };   // a day at 12:00 Vilnius -> ISO
const colOf = (st, owner) => st === "done" || st === "dropped" ? "done" : st === "waiting" ? "waiting" : st === "fixing" ? "fixing" : owner === "Both" || !owner ? "general" : owner;
const isCheck = c => /^check:/i.test(String(c.title || "").trim());
/* fix notes inside the details: "— YYYY-MM-DD HH:MM <who>: <note>", each on its own line (the DB's task_last_fix_note reads the same) */
const FIXRE = /(?:^|\n)— (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) ([^:\n]*): ([\s\S]*?)(?=\n— \d{4}-\d{2}-\d{2} \d{2}:\d{2} |$)/g;
const fixNotes = d => [...String(d || "").matchAll(FIXRE)].map(m => ({ at: m[1], who: m[2], text: m[3].trim() })).filter(n => n.text);
const vilNow = () => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`; };
/* http(s) links in the details, once each; a "- <label>: <url>" line gives the button its label */
function detailLinks(d) {
  const out = [], seen = new Set();
  String(d || "").split("\n").forEach(line => {
    const lab = (line.match(/^\s*[-•*]\s*([^:\n]{1,60}):\s*https?:\/\//i) || [])[1];
    (line.match(/https?:\/\/[^\s<>"'`]+/gi) || []).forEach(raw => {
      const u = webUrl(raw.replace(/[).,;:!?\]]+$/, "")); if (!u || seen.has(u)) return; seen.add(u);
      let short = u; try { const x = new URL(u); short = (x.hostname.replace(/^www\./, "") + (x.pathname.length > 1 ? x.pathname : "")).slice(0, 48); } catch {}
      out.push({ u, label: (lab || "").trim() || short });
    });
  });
  return out.slice(0, 12);
}
const tCard = t => ({ id: +t.id, title: t.title, detail: t.detail || null, owner: t.owner || "Both", st: t.status, col: colOf(t.status, t.owner), due: t.due_at ? dayOf(t.due_at) : null,
  pos: +t.pos || 0, source: t.source, ref: t.source_ref ?? null, lead: lc(t.lead_email), by: t.created_by || null, at: t.created_at || null, done: t.done_at || null });
const TCOLS = "id,title,detail,owner,status,due_at,lead_email,source,source_ref,pos,created_by,created_at,done_at";
async function loadTaskList() {
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const [open, done] = await Promise.all([all("tasks", TCOLS, r => r.in("source", FSRC).in("status", ["todo", "doing", "waiting", "fixing"])),
    all("tasks", TCOLS, r => r.in("source", FSRC).eq("status", "done").gte("done_at", since))]);
  return open.concat(done).map(tCard);
}
async function loadTodos() { EDIT = null; await me(); const [list, pn] = await Promise.all([loadTaskList(), promNames()]); PNAME = pn; return list; }
const overdue = d => d && d < dayOf(Date.now());
const cardsIn = (list, col) => list.filter(c => c.col === col).sort(col === "done" ? (a, b) => String(b.done || "").localeCompare(String(a.done || "")) : (a, b) => a.pos - b.pos || a.id - b.id);
async function todoBadge() {   // the menu badge: open founder to-dos (not Waiting), per founder in the tooltip
  try { const rows = await must(sb().from("tasks").select("owner").in("source", FSRC).in("status", ["todo", "doing"])), n = rows.length, by = o => rows.filter(r => r.owner === o).length;
    const b = $("#sn-todo-n"), a = $('#snav a[data-nav="todos"]'), tip = n ? `To-dos · Benas ${by("Benas")} · Simas ${by("Simas")} · General ${by("Both")}` : "To-dos";
    if (b) { b.hidden = !n; b.textContent = n || ""; } if (a) { a.dataset.tip = tip; a.title = tip; } } catch {}
}
const avatar = o => o === "Simas" || o === "Benas" ? `<span class="sd-av ${o === "Simas" ? "s" : "b"}" title="${o}" aria-hidden="true">${o[0]}</span>` : "";
function cardHtml(c) {
  const late = c.col !== "done" && overdue(c.due), sel = EDIT && EDIT.id === c.id, chk = isCheck(c) && c.col !== "done";
  const chips = [avatar(c.col === "Simas" || c.col === "Benas" ? "" : c.owner),
    c.due ? `<span class="chip${late ? " r" : ""}">${late ? "overdue · " : ""}${esc(dLabel(c.due))}</span>` : "",
    c.lead ? `<span class="chip sd-lead" title="${esc(c.lead)}">${esc(pName(c.lead))}</span>` : "",
    isCheck(c) ? (chk && c.col !== "fixing" ? `<span class="chip b" title="Drag to Done to approve, or to Needs fixing to send it back">to approve</span>` : "")
      : /claude/i.test(c.by || "") ? `<span class="chip" title="Suggested by Claude">suggested</span>` : ""].join("");
  return `<div class="tile sd-card${c.col === "done" ? " done" : ""}${chk ? " chk" : ""}${sel ? " sel" : ""}" data-card="${c.id}" tabindex="0" role="button" aria-roledescription="draggable card" aria-label="${esc(c.title)}. ${esc(OWNL(c.owner))}${c.due ? `, due ${esc(dLabel(c.due))}` : ""}. Enter opens it. Alt plus arrow keys move it.">
    <div class="tt">${esc(c.title)}</div>${chips ? `<div class="ft">${chips}</div>` : ""}</div>`;
}
function boardHtml(list) {
  return COLS.map(([k, label]) => { const cs = cardsIn(list, k), add = k !== "waiting" && k !== "done" && k !== "fixing";
    return `<section class="sd-col sd-c-${k.toLowerCase()}" data-col="${k}" aria-label="${esc(label)}"><div class="sd-col-h"><span>${k === "Simas" || k === "Benas" ? avatar(k) : ""}${esc(label)}</span><span class="chip">${cs.length}</span></div>
      ${add ? `<button type="button" class="sd-add" data-add="${k}"><svg aria-hidden="true"><use href="#i-plus"/></svg>Add a to-do</button>` : ""}
      ${cs.map(cardHtml).join("")}${cs.length ? "" : `<p class="empty">${k === "waiting" ? "Paused to-dos wait here." : k === "done" ? "Nothing done in the last 30 days." : k === "general" ? "Nothing in the pool." : k === "fixing" ? "Drop a card here to send it back with a note." : "All clear."}</p>`}</section>`; }).join("");
}
function toolsHtml() { return ""; }
function panelHtml() {
  if (!EDIT) return "";
  const isNew = EDIT.id === "new", c = isNew ? null : CACHE.todos.find(x => x.id === EDIT.id);
  if (!isNew && !c) return "";
  const own = c ? c.owner : EDIT.col === "general" ? "Both" : EDIT.col, meta = c ? [SRCL[c.source] || c.source, c.at ? `added ${dLabel(dayOf(c.at))}${c.by ? ` by ${c.by}` : ""}` : "", c.col === "done" && c.done ? `done ${dLabel(dayOf(c.done))}` : ""].filter(Boolean).join(" · ") : "New to-do";
  const fix = !!c && c.col === "fixing", notes = c ? fixNotes(c.detail).reverse() : [], links = c ? detailLinks(c.detail) : [];
  return `<div class="sd-scrim" data-close></div><aside class="sd-panel" role="dialog" aria-modal="true" aria-label="${isNew ? "New to-do" : "To-do"}">
    <form class="sd-pform" data-form="${isNew ? "new" : c.id}">
      <div class="sd-pt"><span class="mut">${esc(meta)}</span><button type="button" class="mini" data-close aria-label="Close" title="Close (Esc)"><svg aria-hidden="true"><use href="#i-x"/></svg></button></div>
      ${fix && notes.length ? `<div class="fld sd-notes"><span>Sent back${notes.length > 1 ? ` · ${notes.length} notes` : ""}</span><ol>${notes.map(n => `<li><b>${esc(n.who)} · ${esc(dLabel(n.at.slice(0, 10)))} ${esc(n.at.slice(11))}</b><p>${esc(n.text)}</p></li>`).join("")}</ol></div>` : ""}
      ${fix && c.detail ? `<div class="fld sd-desc"><span>This card says</span><div class="sd-desc-t">${esc(c.detail.split("\n\n— ")[0])}</div></div>` : ""}
      ${fix ? `<label class="fld sd-fix"><span>What needs fixing</span><textarea name="fix" rows="4" maxlength="1500" placeholder="What is wrong, and what you want instead. Then press Send to Claude.">${esc(FIXDRAFT[c.id] || "")}</textarea></label><div class="sd-fixgo"><span class="mut">Closing this panel also sends your note.</span><button type="submit" class="act go">${ic("send")}Send to Claude</button></div>` : ""}
      <label class="fld"><span>To-do</span><textarea name="title" rows="2" maxlength="300" required placeholder="A short, clear next step">${esc(c ? c.title : "")}</textarea></label>
      ${links.length ? `<div class="fld"><span>${c && isCheck(c) ? "Links to check" : "Links"}</span><div class="sd-links">${links.map(l => `<a class="act" href="${esc(l.u)}" target="_blank" rel="noopener noreferrer" title="${esc(l.u)}">${ic("link")}<span>${esc(l.label)}</span></a>`).join("")}</div></div>` : ""}
      <label class="fld"><span>Details</span><textarea name="detail" rows="7" maxlength="4000" placeholder="Anything that helps (optional)">${esc(c && c.detail ? c.detail : "")}</textarea></label>
      <div class="fld"><span>Owner</span><div class="seg" role="group" aria-label="Owner">${[["Benas", "Benas"], ["Simas", "Simas"], ["Both", "General"]].map(([v, l]) => `<button type="button" data-own="${v}" class="${v === own ? "on" : ""}" aria-pressed="${v === own}">${l}</button>`).join("")}</div></div>
      ${c ? `<label class="fld sd-move"><span>Move to</span><select name="move">${COLS.map(([k, l]) => `<option value="${k}"${k === c.col ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>` : ""}
      <label class="fld sd-due"><span>Due</span><input type="date" name="due" value="${esc(c && c.due ? c.due : "")}"></label>
      ${c && c.lead ? `<div class="fld"><span>Lead</span><div><span class="chip">${esc(pName(c.lead))}</span> <span class="mut">${esc(c.lead)}</span></div></div>` : ""}
      <div class="sd-pa">${c ? `<button type="button" class="act no del" data-del>${c.source === "board" ? "Delete" : "Drop"}</button>` : ""}
        ${c && c.col !== "done" ? `<button type="button" class="act" data-wait>${c.st === "waiting" ? "Back to To do" : "Move to Waiting"}</button>` : ""}
        ${c && c.col === "done" ? `<button type="button" class="act" data-reopen>Reopen</button>` : ""}
        <button type="submit" class="act${c && c.col !== "done" ? "" : " go"}">${isNew ? "Add" : "Save"}</button>
        ${c && c.col !== "done" ? `<button type="button" class="act go" data-tick>${ic("check")}Done</button>` : ""}</div>
    </form></aside>`;
}
function viewTodos(list) { return `<div class="sd-tools" id="sd-tools">${toolsHtml()}</div><div class="sd-board" id="sd-board">${boardHtml(list || [])}</div><div id="sd-pan">${panelHtml()}</div>`; }
/* 11-22 (SIMAS "the to do cards are glitchy, when i drag them they disappear"): the board never redraws under a lifted card (the drop
   redraws it anyway), and every card that changed place slides there (FLIP: transform only, none under reduced motion) */
let SAVING = 0, RT_LATER = false, GHOST_FROM = null;
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const cardRects = root => { const m = new Map(); $$("[data-card]", root).forEach(el => { if (!el.hidden) m.set(el.dataset.card, el.getBoundingClientRect()); }); return m; };
function flipCards(root, before, from) {   // from = { id, rect } of the ghost for the card that was just dropped
  if (calm() || !Element.prototype.animate) return;
  $$("[data-card]", root).forEach(el => {
    const id = el.dataset.card, g = !!from && String(from.id) === id, a = g ? from.rect : before.get(id); if (!a) return;
    const b = el.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top; if (!g && Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    if (!g && (b.bottom < 0 || b.top > innerHeight) && (a.bottom < 0 || a.top > innerHeight)) return;   // off screen before and after
    el.animate(g ? [{ transform: `translate(${dx}px,${dy}px) rotate(2deg) scale(1.03)` }, { transform: "none" }]
      : [{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: g ? 300 : 240, easing: "cubic-bezier(.2,.8,.2,1)" });
  });
}
function renderTodos(panel = false) {
  const bd = $("#sd-board"); if (PAGE !== "todos" || !CACHE.todos || !bd || (DRAG && DRAG.on)) return;
  const before = cardRects(bd), from = GHOST_FROM; GHOST_FROM = null;
  const sx = bd.scrollLeft; bd.innerHTML = boardHtml(CACHE.todos); bd.scrollLeft = sx; flipCards(bd, before, from);
  if (panel) { const p = $("#sd-pan"); p.innerHTML = panelHtml(); const ta = $("textarea[name=fix]", p) || $("textarea[name=title]", p); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
  todoBadge();
}
const openPanel = e => { EDIT = e; renderTodos(true); };
const FIXDRAFT = {};   // card id -> a typed, not yet sent "What needs fixing" note (survives a re-render)
const pendingFix = () => { const ta = $("#sd-pan textarea[name=fix]"); return ta && ta.value.trim() ? ta : null; };
const closePanel = () => { const pf = pendingFix(); if (pf) { pf.form.requestSubmit(); return; } const id = EDIT && EDIT.id; EDIT = null; renderTodos(true); if (id && id !== "new") $(`[data-card="${id}"]`)?.focus(); };
function posBetween(list, col, idx, skipId) { const cs = cardsIn(list, col).filter(c => c.id !== skipId), a = cs[idx - 1], b = cs[idx]; return a && b ? (a.pos + b.pos) / 2 : a ? a.pos + 1024 : b ? b.pos - 1024 : 1024; }
async function mirror(c, patch, t) {   // the same change on the old list's row (best effort; the tasks row is the one that counts)
  const has = k => k in patch, nowI = new Date().toISOString(), flip = has("st") && (patch.st === "done") !== (c.st === "done");
  if (c.source === "board" && c.ref) { const u = {}; if (has("st")) u.col = patch.st === "waiting" || patch.st === "fixing" ? "doing" : patch.st; /* todo_cards.col has no 'waiting' / 'fixing' */ ["pos", "owner", "title", "detail", "due"].forEach(k => { if (has(k)) u[k] = patch[k]; });
    if (Object.keys(u).length) await must(sb().from("todo_cards").update(u).eq("id", +c.ref)); }
  else if (c.source === "founder_tasks" && c.ref) { const u = {}; if (flip) u.done_at = t.done_at; if (has("owner")) u.who = patch.owner; if (has("title")) u.title = patch.title; if (has("detail")) u.detail = patch.detail; if (has("due")) u.due_at = t.due_at;
    if (Object.keys(u).length) { u.updated_at = nowI; await must(sb().from("founder_tasks").update(u).eq("id", +c.ref)); } }
}
async function writeTask(c, patch) {   // c = the card before the change. tasks is written LAST, so it wins over the todo_cards trigger
  const t = { updated_at: new Date().toISOString() };
  if ("st" in patch && patch.st !== c.st) { t.status = patch.st; t.done_at = patch.st === "done" ? t.updated_at : null; }
  if ("pos" in patch) t.pos = patch.pos; if ("owner" in patch) t.owner = patch.owner; if ("title" in patch) t.title = patch.title; if ("detail" in patch) t.detail = patch.detail;
  if ("due" in patch) t.due_at = patch.due ? vilNoon(patch.due) : null;
  let warn = false; try { await mirror(c, patch, t); } catch { warn = true; }
  const ok = await must(sb().from("tasks").update(t).eq("id", c.id).select("id"));
  if (!ok || !ok.length) throw new Error("not allowed");
  if (warn) toast("Saved. The list it came from didn't update.");
}
async function saveCard(id, patch) {
  const c = CACHE.todos.find(x => x.id === id); if (!c) return; const before = { ...c };
  Object.assign(c, patch); c.col = colOf(c.st, c.owner); if ("st" in patch) c.done = patch.st === "done" ? new Date().toISOString() : null;
  renderTodos(!!EDIT);
  SAVING++;
  try { await writeTask(before, patch); } catch (e) { Object.assign(c, before); renderTodos(!!EDIT); toast("Couldn't save that to-do. Check your connection."); }
  finally { SAVING--; if (!SAVING && RT_LATER) { RT_LATER = false; rtHit(); } }   // one reload once every write landed, not mid-write
}
const colPatch = col => col === "done" ? { st: "done" } : col === "waiting" ? { st: "waiting" } : col === "fixing" ? { st: "fixing" } : { st: "todo", owner: col === "general" ? "Both" : col };
const moveCard = (id, p) => { if (p.st === "fixing") EDIT = { id }; return saveCard(id, p); };   // sent back: the panel opens on "What needs fixing"
function dropCard(id, col, prevId, nextId) {   // position from the neighbours in the column it was dropped into
  const L = CACHE.todos, a = L.find(x => x.id === prevId), b = L.find(x => x.id === nextId), pos = a && b ? (a.pos + b.pos) / 2 : a ? a.pos + 1024 : b ? b.pos - 1024 : posBetween(L, col, 0, id);
  const c = L.find(x => x.id === id), p = { pos, ...(c && c.col === col ? {} : colPatch(col)) };
  return moveCard(id, p);
}
let JUSTDRAG = 0;
function wireBoard() {
  const board = $("#sd-board"), pan = $("#sd-pan"); if (!board) return;
  board.addEventListener("click", ev => {
    if (Date.now() - JUSTDRAG < 350) return;
    const add = ev.target.closest("[data-add]"); if (add) { openPanel({ id: "new", col: add.dataset.add }); return; }
    const card = ev.target.closest("[data-card]"); if (card) openPanel({ id: +card.dataset.card });
  });
  board.addEventListener("keydown", ev => {
    const card = ev.target.closest("[data-card]"); if (!card || ev.target !== card) return;
    const id = +card.dataset.card, c = CACHE.todos.find(x => x.id === id); if (!c) return;
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openPanel({ id }); return; }
    if (!ev.altKey) return;
    const cs = cardsIn(CACHE.todos, c.col), i = cs.findIndex(x => x.id === id), ci = COLS.findIndex(x => x[0] === c.col);
    let p = null;
    if (ev.key === "ArrowLeft" && ci > 0) p = { ...colPatch(COLS[ci - 1][0]), pos: posBetween(CACHE.todos, COLS[ci - 1][0], 0, id) };
    else if (ev.key === "ArrowRight" && ci < COLS.length - 1) p = { ...colPatch(COLS[ci + 1][0]), pos: posBetween(CACHE.todos, COLS[ci + 1][0], 0, id) };
    else if (ev.key === "ArrowUp" && i > 0 && c.col !== "done") p = { pos: posBetween(CACHE.todos, c.col, i - 1, id) };
    else if (ev.key === "ArrowDown" && i < cs.length - 1 && c.col !== "done") p = { pos: posBetween(CACHE.todos, c.col, i + 2, id) };
    if (!p) return;
    ev.preventDefault(); moveCard(id, p).then(() => { if (!EDIT) $(`[data-card="${id}"]`)?.focus(); });
  });
  board.addEventListener("pointerdown", dragStart);
  pan.addEventListener("click", async ev => {
    const t = ev.target.closest("button,[data-close]"); if (!t) return;
    if (t.hasAttribute("data-close")) { if (Date.now() - JUSTDRAG > 350) closePanel(); return; }   // the click that ends a drop onto Needs fixing must not close its panel
    if (t.dataset.own) { $$("[data-own]", t.parentElement).forEach(b => { b.classList.toggle("on", b === t); b.setAttribute("aria-pressed", b === t); }); return; }
    const f = t.closest("[data-form]"), id = f && f.dataset.form !== "new" ? +f.dataset.form : null, c = id ? CACHE.todos.find(x => x.id === id) : null;
    if (!c) return;
    if (t.hasAttribute("data-tick")) { EDIT = null; renderTodos(true); await saveCard(id, { st: "done" }); toast("Done"); return; }
    if (t.hasAttribute("data-wait")) { await saveCard(id, { st: c.st === "waiting" ? "todo" : "waiting" }); return; }
    if (t.hasAttribute("data-reopen")) { await saveCard(id, { st: "todo" }); return; }
    if (t.hasAttribute("data-del")) {
      if (!confirm(`${c.source === "board" ? "Delete" : "Drop"} "${c.title}"?`)) return;
      const list = CACHE.todos; EDIT = null; CACHE.todos = list.filter(x => x.id !== id); renderTodos(true);
      try {
        if (c.source === "board" && c.ref) { await must(sb().from("todo_cards").delete().eq("id", +c.ref)); await must(sb().from("tasks").delete().eq("id", id)); }
        else { const tt = { status: "dropped", done_at: new Date().toISOString(), updated_at: new Date().toISOString() }; try { await mirror(c, { st: "done" }, tt); } catch {} const ok = await must(sb().from("tasks").update(tt).eq("id", id).select("id")); if (!ok || !ok.length) throw new Error("not allowed"); }
      } catch (e) { CACHE.todos = list; renderTodos(); toast("Couldn't remove that to-do."); }
    }
  });
  pan.addEventListener("submit", async ev => {
    ev.preventDefault();
    const f = ev.target, title = f.title.value.trim(), note = f.fix ? f.fix.value.trim() : "", owner = $("[data-own].on", f)?.dataset.own || "Both", due = f.due.value || null;
    if (!title) { f.title.focus(); return; }
    let detail = f.detail.value.trim();
    if (note) {   // a fix note goes to the end of the details; the tasks trigger reads the newest one and pings Simas's Claude
      await me(); const who = (ME && ME.who !== "Both" ? ME.who : ME && ME.name) || "a founder";
      detail = `${detail ? detail + "\n\n" : ""}— ${vilNow()} ${String(who).replace(/[:\n]/g, " ").trim()}: ${note}`;
      if (detail.length > 4000) { toast("The details are too long to add this note. Shorten them first."); f.fix.focus(); return; }
    }
    detail = detail || null;
    if (f.dataset.form === "new") {
      const col = colOf("todo", owner), row = { title, detail, owner, due, col: "todo", pos: posBetween(CACHE.todos, col, 0), created_by: (ME && ME.name) || null };
      EDIT = null; renderTodos(true);
      try { const ins = await must(sb().from("todo_cards").insert(row).select().single()), t = await must(sb().from("tasks").select(TCOLS).eq("source", "board").eq("source_ref", String(ins.id)).maybeSingle());
        if (t) CACHE.todos.push(tCard(t)); else CACHE.todos = await loadTaskList(); renderTodos(); } catch (e) { renderTodos(); toast("Couldn't add that to-do. Check your connection."); }
    } else { const id = +f.dataset.form; delete FIXDRAFT[id]; EDIT = null; renderTodos(true); await saveCard(id, { title, detail, owner, due }); if (note) toast("Note sent to Simas's Claude"); }
  });
  pan.addEventListener("change", ev => {
    if (ev.target.name !== "move") return;
    const f = ev.target.form, id = f && +f.dataset.form, c = id && CACHE.todos.find(x => x.id === id), col = ev.target.value; if (!c || col === c.col) return;
    EDIT = null; moveCard(id, { ...colPatch(col), pos: posBetween(CACHE.todos, col, 0, id) }).then(() => { if (!EDIT) $(`[data-card="${id}"]`)?.focus(); });
  });
  pan.addEventListener("input", ev => { if (ev.target.name === "fix") { const f = ev.target.form, id = f && +f.dataset.form; if (id) FIXDRAFT[id] = ev.target.value; } });
  pan.addEventListener("keydown", ev => {
    if (ev.key === "Escape") { ev.preventDefault(); closePanel(); return; }
    if (ev.target.matches("textarea") && ev.key === "Enter" && (ev.metaKey || ev.ctrlKey || (ev.target.name === "title" && !ev.shiftKey))) { ev.preventDefault(); ev.target.form.requestSubmit(); }
  });
}
/* pointer drag: a mouse drags after a 6 px move; a finger needs a short press-and-hold (280 ms), so a swipe still scrolls */
function dragStart(ev) {
  const card = ev.target.closest("[data-card]");
  if (!card || ev.button > 0 || ev.target.closest("button,a,textarea,input") || DRAG) return;
  const r = card.getBoundingClientRect(), touch = ev.pointerType !== "mouse";
  DRAG = { id: +card.dataset.card, card, sx: ev.clientX, sy: ev.clientY, lx: ev.clientX, ly: ev.clientY, dx: ev.clientX - r.left, dy: ev.clientY - r.top, w: r.width, h: r.height, on: false, pid: ev.pointerId, touch };
  if (touch) DRAG.timer = setTimeout(() => { if (DRAG && !DRAG.on) { liftUp(DRAG); place(DRAG, DRAG.lx, DRAG.ly); try { navigator.vibrate && navigator.vibrate(12); } catch {} } }, 280);
  document.addEventListener("pointermove", dragMove); document.addEventListener("pointerup", dragEnd); document.addEventListener("pointercancel", dragEnd);
}
function liftUp(D) {
  D.on = true; D.card = $(`#sd-board [data-card="${D.id}"]`) || D.card;   // the board may have been redrawn since the press
  D.lift = D.card.cloneNode(true); D.lift.classList.add("sd-ghost"); D.lift.classList.remove("sel"); D.lift.removeAttribute("data-card"); D.lift.removeAttribute("tabindex"); D.lift.setAttribute("aria-hidden", "true");
  D.lift.style.setProperty("--w", D.w + "px"); D.lift.style.setProperty("--x", D.lx - D.dx + "px"); D.lift.style.setProperty("--y", D.ly - D.dy + "px"); document.body.append(D.lift);
  if (!calm() && D.lift.animate) D.lift.animate([{ transform: "none" }, {}], { duration: 160, easing: "cubic-bezier(.2,.8,.2,1)" });
  D.ph = document.createElement("div"); D.ph.className = "sd-ph"; D.ph.style.setProperty("--h", D.h + "px");
  D.card.after(D.ph); D.card.hidden = true;
  $("#sd-board")?.classList.add("sd-dragging"); D.raf = requestAnimationFrame(edgeTick);
}
/* auto-scroll while the pointer rests near an edge (every frame, not only on a move; the board's scroll-snap is off meanwhile) */
function edgeTick() {
  const D = DRAG; if (!D || !D.on) return;
  const bd = $("#sd-board"), y0 = scrollY, x0 = bd ? bd.scrollLeft : 0;
  if (D.ly < 60) scrollBy(0, -12); else if (D.ly > innerHeight - 60) scrollBy(0, 12);
  if (bd) { const bb = bd.getBoundingClientRect(), e = Math.min(48, bb.width * .12); if (D.lx < bb.left + e) bd.scrollLeft -= 12; else if (D.lx > bb.right - e) bd.scrollLeft += 12; }
  if (scrollY !== y0 || (bd && bd.scrollLeft !== x0)) place(D, D.lx, D.ly);
  D.raf = requestAnimationFrame(edgeTick);
}
function place(D, x, y) {
  D.lift.style.setProperty("--x", x - D.dx + "px"); D.lift.style.setProperty("--y", y - D.dy + "px");
  const cols = $$("#sd-board .sd-col").filter(c => c.offsetParent), hit = (c, up, down) => { const b = c.getBoundingClientRect(); return x >= b.left && x <= b.right && y >= b.top - up && y <= b.bottom + down; },
    col = cols.find(c => hit(c, 0, 0)) || cols.find(c => hit(c, 24, 24)) || cols.find(c => hit(c, 40, 120));
  cols.forEach(c => c.classList.toggle("drop", c === col));
  if (col) {
    const others = $$("[data-card]:not([hidden])", col), next = others.find(el => { const b = el.getBoundingClientRect(); return y < b.top + b.height / 2; });
    if (D.ph.parentNode !== col || D.ph.nextElementSibling !== (next || null)) {
      const bf = cardRects($("#sd-board"));
      next ? next.before(D.ph) : col.append(D.ph);
      if (!calm()) $$("#sd-board [data-card]:not([hidden])").forEach(el => { const a = bf.get(el.dataset.card), b = el.getBoundingClientRect(); if (a && (Math.abs(a.top - b.top) >= 1 || Math.abs(a.left - b.left) >= 1)) el.animate([{ transform: `translate(${a.left - b.left}px,${a.top - b.top}px)` }, { transform: "none" }], { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" }); });
    }
    D.col = col.dataset.col; const i = next ? others.indexOf(next) : others.length; D.nextId = next ? +next.dataset.card : null; D.prevId = others[i - 1] ? +others[i - 1].dataset.card : null;
  }
}
function dragMove(ev) {
  const D = DRAG; if (!D || ev.pointerId !== D.pid) return;
  D.lx = ev.clientX; D.ly = ev.clientY;
  const moved = Math.hypot(ev.clientX - D.sx, ev.clientY - D.sy);
  if (!D.on) { if (D.touch) { if (moved > 8) cleanup(); return; } if (moved < 6) return; liftUp(D); }
  ev.preventDefault(); place(D, ev.clientX, ev.clientY);
}
function cleanup() {
  const D = DRAG; if (D && D.timer) clearTimeout(D.timer);
  document.removeEventListener("pointermove", dragMove); document.removeEventListener("pointerup", dragEnd); document.removeEventListener("pointercancel", dragEnd);
  if (D && D.raf) cancelAnimationFrame(D.raf); $("#sd-board")?.classList.remove("sd-dragging");
  DRAG = null; return D;
}
function dragEnd(ev) {
  if (!DRAG || (ev.pointerId !== undefined && ev.pointerId !== DRAG.pid)) return;
  const D = cleanup(); if (!D.on) return;
  JUSTDRAG = Date.now();
  GHOST_FROM = { id: D.id, rect: D.lift.getBoundingClientRect() };
  D.lift.remove(); D.ph.remove(); D.card.hidden = false;
  $$("#sd-board .sd-col").forEach(c => c.classList.remove("drop"));
  if (ev.type === "pointercancel" || !D.col) return renderTodos();
  dropCard(D.id, D.col, D.prevId, D.nextId);
}
document.addEventListener("touchmove", ev => { if (DRAG && DRAG.on) ev.preventDefault(); }, { passive: false });
document.addEventListener("contextmenu", ev => { if (DRAG && ev.target.closest && ev.target.closest(".sd-card")) ev.preventDefault(); });

/* 7. Slack (11-21, SIMAS: "we need to implement slack into the crm"): the latest #claude-sync and #red-alert messages from
   public.slack_messages, text escaped, links through webUrl. The post box shows only when crm.js's probe of the edge
   function slack-post succeeded (window.BEJU_CRM_SLACK.ok). A Slack notification opens this page at its message (?ts=). */
const SLCH = ["claude-sync", "red-alert"], chOf = m => String(m.channel_name || "").replace(/^#/, "");
let SLF = "all";
const webUrl = u => { try { const x = new URL(String(u).trim()); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };
const hm = t => new Date(t).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const whenS = t => !t ? "" : dayOf(t) === dayOf(Date.now()) ? hm(t) : `${dLabel(dayOf(t))}, ${hm(t)}`;
async function loadSlack() {
  await me();
  const cols = "ts,channel_id,channel_name,user_name,text,at,thread_ts,permalink,mentions", ts = param("ts");
  const msgs = await must(sb().from("slack_messages").select(cols).in("channel_name", [...SLCH, ...SLCH.map(c => "#" + c)]).order("at", { ascending: false }).limit(200)).catch(() => null);
  if (msgs && ts && !msgs.some(m => m.ts === ts)) { const one = await must(sb().from("slack_messages").select(cols).eq("ts", ts).limit(1)).catch(() => []); msgs.push(...one); }   // an older message a notification points at
  return { msgs };
}
function slackHtml(t, who) {   // Slack markup -> safe HTML: <url|label> and bare links become links, everything else is escaped
  t = String(t || "").replace(/<@([A-Z0-9]+)(?:\|([^>]+))?>/g, (m0, id, nm) => "@" + (nm || id)).replace(/<!(here|channel|everyone)[^>]*>/g, "@$1");
  const un = x => x.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"), me = who && who !== "Both" ? new RegExp(`@${who}\\b`, "gi") : null;
  const txt = x => { const h = esc(un(x)); return me ? h.replace(me, w => `<b class="sl-at">${w}</b>`) : h; };
  const re = /<(https?:\/\/[^|>\s]+)(?:\|([^>]+))?>|(https?:\/\/[^\s<>"')\]]+)/g; let out = "", last = 0, m;
  while ((m = re.exec(t))) { out += txt(t.slice(last, m.index)); const u = webUrl(un(m[1] || m[3])); out += u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(un(m[2] || m[1] || m[3]).slice(0, 80))}</a>` : esc(un(m[0])); last = re.lastIndex; }
  return out + txt(t.slice(last));
}
const slackRow = (m, who) => { const mine = !!who && who !== "Both" && ((m.mentions || []).some(x => lc(String(x).replace(/^@/, "")) === lc(who)) || new RegExp(`@${who}\\b`, "i").test(m.text || "")), u = webUrl(m.permalink), ch = chOf(m);
  return `<article class="tile sl-m${mine ? " me" : ""}" data-ts="${esc(m.ts)}"><div class="sl-h"><b>${esc(m.user_name || "Someone")}</b><span class="chip${ch === "red-alert" ? " r" : ""}">#${esc(ch)}</span><time class="mut" datetime="${esc(m.at || "")}">${esc(whenS(m.at))}</time>${u ? `<a class="sl-o" href="${esc(u)}" target="_blank" rel="noopener noreferrer">Open in Slack ${ic("link")}</a>` : ""}</div><p class="sl-t">${slackHtml(m.text, who)}</p></article>`; };
function viewSlack(d) {
  const S = window.BEJU_CRM_SLACK, can = !!(S && S.ok), who = ME ? ME.who : "", list = (d.msgs || []).filter(m => SLF === "all" || chOf(m) === SLF);
  const post = can ? `<form class="card sp-card sl-post" id="sl-post" novalidate><label class="fld sl-pr"><span>Channel</span><select name="channel">${SLCH.map(c => `<option value="${c}"${c === SLF ? " selected" : ""}>#${c}</option>`).join("")}</select></label>
    <label class="fld"><span>Message</span><textarea name="text" rows="3" maxlength="3000"></textarea></label><p class="sp-err" hidden></p><div class="row"><button type="submit" class="act go">${ic("send")}Post</button></div></form>` : "";
  if (!d.msgs) return post + empty("Slack messages are not in the CRM yet. They show here once the Slack sync runs.");
  const seg = `<div class="seg sl-f" role="group" aria-label="Channel">${[["all", "Both"], ...SLCH.map(c => [c, "#" + c])].map(([k, l]) => `<button type="button" data-slf="${k}" class="${SLF === k ? "on" : ""}" aria-pressed="${SLF === k}">${esc(l)}</button>`).join("")}</div>`;
  return `${post}${seg}<section class="card sp-card sl-list">${list.map(m => slackRow(m, who)).join("") || empty("No message in this channel yet.")}</section>`;
}
function wireSlack() {
  $$("[data-slf]", PAGE_EL).forEach(b => b.addEventListener("click", () => { SLF = b.dataset.slf; renderPage(true); }));
  const f = $("#sl-post");
  if (f) f.addEventListener("submit", async ev => { ev.preventDefault();
    const t = String(f.elements.text.value || "").trim(), ch = f.elements.channel.value, err = $(".sp-err", f), go2 = $('button[type="submit"]', f);
    if (!t) { err.hidden = false; err.textContent = "Write the message first."; return; }
    go2.disabled = true; err.hidden = true;
    try { await window.BEJU_CRM_SLACK.post(ch, t); toast(`Posted to #${ch}`); f.elements.text.value = ""; delete CACHE.slack; renderPage(true); }
    catch (e) { err.hidden = false; err.textContent = `Couldn't post: ${String(e && e.message || e).slice(0, 140)}`; go2.disabled = false; } });
  const ts = param("ts"), el = ts ? $(`[data-ts="${CSS.escape(ts)}"]`, PAGE_EL) : null;
  if (el) { el.scrollIntoView({ block: "center", behavior: RM ? "auto" : "smooth" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); const u = new URL(location.href); u.searchParams.delete("ts"); history.replaceState(history.state, "", u); }
}
/* new Slack messages / the probe result: redraw, unless a founder is writing in the post box */
document.addEventListener("beju-crm-slack", () => { if (!ON || PAGE !== "slack") return; const ta = $("#sl-post textarea"); if (ta && (document.activeElement === ta || ta.value.trim())) return; delete CACHE.slack; renderPage(true); });
let SL_CH = null, SL_T = null;   // live while the Slack page is open (its own channel, so the To-dos channel is never affected)
function slackLive(on) {
  if (on && !SL_CH && sb()) { try { SL_CH = sb().channel("side-slack").on("postgres_changes", { event: "INSERT", schema: "public", table: "slack_messages" }, () => { clearTimeout(SL_T); SL_T = setTimeout(() => document.dispatchEvent(new CustomEvent("beju-crm-slack")), 600); }).subscribe(); } catch { SL_CH = null; } }
  else if (!on && SL_CH) { try { sb().removeChannel(SL_CH); } catch {} SL_CH = null; }
}
window.BEJU_CRM_PAGE = (p, extra = {}) => { if (!ON || !PAGES[p]) return; if (p === "slack" && extra.ts) SLF = "all"; delete CACHE[p]; go(p, extra); };

/* live updates from the other founder (board + the menu badge) */
let RT_T = null;
function rtHit() { clearTimeout(RT_T); RT_T = setTimeout(async () => {   // 11-22: tasks too, so crm-api / Claude adds show live
    todoBadge();
    if (PAGE !== "todos") return;
    if (DRAG || EDIT || SAVING) { RT_LATER = RT_LATER || !!SAVING; return; }   // a write of ours in flight: reload once it lands (a half-written row made cards jump)
    try { const L = await loadTaskList(); if (DRAG || EDIT || SAVING || PAGE !== "todos") { RT_LATER = RT_LATER || !!SAVING; return; } CACHE.todos = L; renderTodos(); } catch {}
  }, 400); }
function startRealtime() {
  if (CH || !sb()) return;
  CH = sb().channel("side-todos").on("postgres_changes", { event: "*", schema: "public", table: "todo_cards" }, rtHit).on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, rtHit).subscribe();
}
function stopRealtime() { if (CH) { try { sb().removeChannel(CH); } catch {} CH = null; } }

/* start last, once every function and table above exists */
new MutationObserver(syncApp).observe(APP, { attributes: true, attributeFilter: ["hidden"] });
syncApp();
})();
