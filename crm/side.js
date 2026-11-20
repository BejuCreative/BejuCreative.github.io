/* BEJÚ founder CRM: navigation sidebar + section pages (SIMAS 11-19 15:0x: "not completely to the left ... floating ... it will be
   ON the screen ... if I choose to contract it, then I contract it. When I press Clients, it takes me to ANOTHER PAGE").
   Pages live on one URL with ?p= (history.pushState), so back, refresh and links work on GitHub Pages with no 404.
   Shares crm.js's Supabase client (window.BEJU_CRM_SB); shows only while the founder dashboard is on screen.
   Reads: crm_panels ('expenses', 'ab_tests', 'metrics' from scripts/crm_panels_sync.py), clients, deliveries, payments, retainers,
   campaign_daily, interested_leads, pipeline. Writes: todo_cards only (founder RLS). CSP: no inline styles. */
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
const PAGES = { dashboard: "Dashboard", expenses: "Expenses", email: "Email tests", clients: "Clients", perf: "Client performance", weekly: "Weekly analysis", todos: "To-dos" };
const K_NAV = "beju-crm-nav";
let PAGE = "dashboard", ME = null, CACHE = {}, TIMER = null, CH = null, DRAG = null, SEQ = 0, EDIT = null, ON = false;
const sb = () => window.BEJU_CRM_SB;
const must = async p => { const { data, error } = await p; if (error) throw error; return data; };
async function all(table, cols, mod) {   // REST returns at most 1,000 rows per call
  const out = [];
  for (let i = 0; ; i += 1000) { let q = sb().from(table).select(cols).range(i, i + 999); if (mod) q = mod(q); const rows = await must(q); out.push(...rows); if (rows.length < 1000) return out; }
}
const panel = id => must(sb().from("crm_panels").select("data,updated_at").eq("id", id).maybeSingle());
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
  if (p !== "clients") u.searchParams.delete("c"); if (p !== "expenses") u.searchParams.delete("m"); if (p !== "perf") u.searchParams.delete("k");
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
  const was = PAGE; PAGE = p; EDIT = null; if (p !== "expenses") EXM = null;
  $$("a[data-nav]", NAV).forEach(a => a.dataset.nav === p && !a.classList.contains("sn-brand") ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  HTML.classList.toggle("paged", p !== "dashboard"); PAGE_EL.hidden = p === "dashboard";
  document.title = p === "dashboard" ? BASE_TITLE : `${PAGES[p]} · BEJÚ`;
  if (p !== "dashboard") { renderPage(); startTimer(); } else { stopTimer(); PAGE_EL.innerHTML = ""; }
  if (was !== p) scrollTo(0, 0);
}
function startTimer() { stopTimer(); TIMER = setInterval(() => { if (!document.hidden && PAGE !== "dashboard" && !DRAG && !EDIT) { delete CACHE[PAGE]; renderPage(true); } }, 5 * 60000); }
function stopTimer() { if (TIMER) clearInterval(TIMER); TIMER = null; }

/* keys: [ toggles the rail, Escape closes the phone drawer */
const layerOpen = () => !!($("#pal:not([hidden])") || $("#dlg:not([hidden])") || $("#drawer:not([hidden])") || $("#veil:not([hidden])"));
document.addEventListener("keydown", ev => {
  if (!ON || layerOpen()) return;
  const ae = document.activeElement, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(ae?.tagName || "") || ae?.isContentEditable;
  if (ev.key === "Escape" && NAV.classList.contains("open")) { ev.stopPropagation(); drawer(false); MENU.focus(); return; }
  if (ev.key === "Escape" && EDIT) { EDIT = null; renderTodos(); return; }
  if (!typing && !ev.metaKey && !ev.ctrlKey && !ev.altKey && ev.key === "[" && !PHONE.matches) { ev.preventDefault(); toggleRail(); }
}, true);

/* only with the dashboard (a signed-in founder) */
function syncApp() {
  ON = !APP.hidden; NAV.hidden = !ON; applyRail();
  if (ON) { show(pageFromUrl()); startRealtime(); todoBadge(); }
  else { stopTimer(); stopRealtime(); CACHE = {}; ME = null; drawer(false); PAGE_EL.hidden = true; }
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
const LOAD = { expenses: loadExpenses, email: loadEmail, clients: loadClients, perf: loadPerf, weekly: loadWeekly, todos: loadTodos };
const VIEW = { expenses: viewExpenses, email: viewEmail, clients: viewClients, perf: viewPerf, weekly: viewWeekly, todos: viewTodos };
const HEAD = {
  expenses: ["Expenses <em class=\"sf\">&amp; profit</em>", "Tick what's paid this month and see the profit that's left."],
  email: ["Email <em class=\"sf\">tests</em>", "Which variant wins in each campaign, and whether the change has been made."],
  clients: ["Clients <em class=\"sf\">&amp; videos</em>", "Everyone who paid or got videos from us, and every video we delivered."],
  perf: ["Client <em class=\"sf\">performance</em>", "Monthly clients' YouTube, TikTok and Instagram: views and trend, which of our Shorts they posted, what works."],
  weekly: ["Weekly <em class=\"sf\">business review</em>", "Health line, money, funnel, campaigns, A/B tests, engine, sales, clients and what we changed: this week against last week and the 4 weeks before."],
  todos: ["To-<em class=\"sf\">dos</em>", "The founders' board. Drag cards between columns; both of you see changes live."],
};
function srcOf(p, d) {
  if (p === "expenses") return d ? ["Beju Finance sheet + Stripe", d.updated_at] : null;
  if (p === "email") return d && d.ab ? ["Instantly API", d.ab.updated_at] : null;
  if (p === "clients") return d ? [d.dsOk === false ? "Drive access expired: delivered counts are stale" : "Google Drive + Stripe", d.synced] : null;
  if (p === "perf") return d ? ["YouTube API, TikTok, Instagram (public)", d.synced] : null;
  if (p === "weekly") return d ? ["Instantly API, Stripe, Samples tab, client scans, CRM", d.synced] : null;
  if (p === "todos") return ["Live board", null];
  return null;
}
function header(p, d) {
  const [h, sub] = HEAD[p], s = srcOf(p, d), old = s && (/expired/.test(s[0]) || (s[1] && Date.now() - new Date(s[1]) > 3 * 36e5));
  return `<header class="sp-h"><div><h1>${h}</h1><p>${esc(sub)}</p></div>${s ? `<span class="sp-src${old ? " old" : ""}"${old ? ' title="Older than 3 hours: the numbers may be out of date"' : ""}><i></i>${esc(s[0])}${s[1] ? ` · synced ${esc(ago(s[1]))}${old ? " · may be out of date" : ""}` : " · live"}</span>` : ""}</header>`;
}
async function renderPage(quiet) {
  const p = PAGE; if (p === "dashboard" || !sb()) return;
  const seq = ++SEQ;
  if (!quiet || !CACHE[p]) PAGE_EL.innerHTML = `${header(p, null)}<div class="sp-sk" aria-label="Loading"><i></i><i></i><i></i></div>`;
  try {
    const d = CACHE[p] || (CACHE[p] = await LOAD[p]());
    if (seq !== SEQ || p !== PAGE) return;
    PAGE_EL.innerHTML = header(p, d) + VIEW[p](d);
    applyVars(PAGE_EL); if (p === "todos") wireBoard(); if (p === "clients") wireClients(); if (p === "perf") wirePerf(); if (p === "weekly") wireWeekly(); if (p === "expenses") wireExpenses(); if (p === "email") wireEmail(); countUps(PAGE_EL);
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
let EXS = "month", EXE = null;
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
  const pay = (who, y) => rows.filter(e => e.paid_by === who && (!y || (e.date || "").startsWith(y))).reduce((a, e) => a + e.eur, 0);
  const fx = d.fx_default || (F && F.fx_usd_eur) || null, spent = tot(ym), contacted = M && M.periods && M.periods.month ? M.periods.month.contacted : null, revUsd = M && M.money ? M.money.stripe_month_usd : null;
  return { d, F, M, t, ym, lm, rows, cats, byM, months, tot, spent, last: tot(lm), last2: tot(lm2), avg3: full.length ? full.reduce((a, y) => a + tot(y), 0) / full.length : null, avgN: full.length, run: subs.reduce((a, s) => a + (s.eur_month || 0), 0), nSubs: subs.length,
    tools, bills, sum7: sumB(7), sum30: sumB(30), pay, fx, usdN: rows.filter(e => e.currency === "USD").length, contacted, revUsd, vids: x.vids, pending: (x.entries || []).filter(e => !e.synced_at), S: M && M.stripe_now };
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
  const S = E.d.split && E.d.split.settle, unit = (label, val, sub) => `<div class="wk-stat"><span>${esc(label)}</span><b>${val}</b><small>${sub}</small></div>`, revEur = E.revUsd != null && E.fx ? E.revUsd * E.fx : null;
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
  <div class="sp-2b">
    <section class="card sp-card"><h2>Who owes whom <small>50/50, all time, EUR</small></h2><div class="ex-owe"><div class="p"><span class="ex-av big">S</span><b>Simas</b><small>paid ${eur(E.pay("Simas"))}</small></div>
      <div class="arrow ${S ? (S.from === "Benas" ? "l" : "r") : ""}"><b>${S ? eur(S.eur) : "Even"}</b><i></i><small>${S ? `${esc(S.from)} owes ${esc(S.to)}` : "nobody owes anything"}</small></div>
      <div class="p"><span class="ex-av big">B</span><b>Benas</b><small>paid ${eur(E.pay("Benas"))}</small></div></div>
      <p class="sp-note">This month: Simas ${eur(E.pay("Simas", E.ym))}, Benas ${eur(E.pay("Benas", E.ym))}. Display only; the settle-up is done by hand. ${E.usdN} of ${E.rows.length} charges were in USD, converted at each receipt's rate${E.fx ? ` (or ${E.fx})` : ""}.</p></section>
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

/* 2. email tests (SIMAS 11-19 18:5x: "show the winner, highlight the winner. And also say the changes are done or not") */
async function loadEmail() {
  await me();
  const [ab, m, acts, arms] = await Promise.all([panel("ab_tests"), panel("metrics").catch(() => null), all("ab_actions", "*", q => q.order("id", { ascending: false })).catch(() => []), panel("arms").catch(() => null)]);
  return { ab, m, acts, arms };
}
const abAct = (acts, key, step) => acts.find(a => a.campaign === key && a.step === step) || null;   // newest first
function abStatus(c, s, acts) {
  const a = abAct(acts, c.key, s.step), win = s.state === "winner" ? s.lead : null;
  if (a && a.done_at) return { k: "done", chip: "chip g", text: `Change done ${dLabel(dayOf(a.done_at))}${a.done_by ? ` by ${a.done_by}` : ""}: ${a.action || `variant ${a.loser || "?"} dropped`}${a.note ? ` · ${a.note}` : ""}`, a };
  if (win || a) { const w = win || (a && a.winner), l = w === "B" ? "A" : "B"; return { k: "due", chip: "chip o", text: `Change due: drop ${l}, write a new challenger against ${w}`, a, w, l }; }
  return { k: "none", chip: "chip", text: "No change needed yet", a: null };
}
function subjCard(S, vt) {   /* subject-line test (council 11-19): arms greyed out until each has `look` sends; no verdict before that */
  if (!S || !S.since) return "";
  const R = S.rules || {}, LOOK = R.look || 600, WIN = R.win || 1000, TIE = R.tie || 1500, GAP = R.gap || 2;
  const row = g => { const early = g.state === "too_early";
    return `<div class="ab-test"><div class="ab-th"><b>${esc(g.name)}</b><span class="chip${g.state === "winner" ? " g" : g.state === "looking" || g.state === "no_winner" ? " b" : ""}">${esc(g.verdict)}</span></div>
    <div class="ab-tri">${g.arms.map(a => { const grey = a.sent < LOOK, win = !early && g.lead === a.arm && (g.state === "winner" || g.state === "tie");
      return `<div class="ab-v${grey ? " grey" : ""}${win ? " win" : !early && g.lead === a.arm ? " lead" : ""}"><div class="ab-vh"><span class="sp-tag">${esc(a.label)}</span>${win ? `<em class="ab-badge w">${g.state === "tie" ? "Keep (shortest)" : "Winner"}</em>` : ""}</div>
      <b>${grey || a.pos_rate == null ? "—" : a.pos_rate.toFixed(1) + "%"}</b><small>${a.sent ? `${int(a.positives)} positive of ${int(a.sent)} sent · ${int(a.replies)} replies` : "nothing sent yet"}${grey && a.sent ? " · rate hidden until " + LOOK : ""}</small>
      <div class="ab-prog" title="${int(a.sent)} of ${LOOK} sends before any look"><i data-v="w:${Math.min(100, Math.round(100 * a.sent / LOOK))}%"></i></div><span class="ab-pn">${int(Math.min(a.sent, LOOK))} / ${LOOK} sends${a.sent >= LOOK ? " ✓" : ""} · ${int(a.leads)} leads</span></div>`; }).join("")}</div></div>`; };
  return `<section class="card sp-card ab-subj"><h2>Subject lines <small>email 1 · pooled across campaigns · since ${esc(vt(S.since))}</small></h2>${(S.groups || []).map(row).join("")}
  <p class="sp-note">No verdict before ${int(LOOK)} sends per arm; winner needs ${int(WIN).toLocaleString("en-US")}–${int(TIE).toLocaleString("en-US")} sends and a ${GAP}-point gap. No gap by ${int(TIE).toLocaleString("en-US")} = tie, keep the shortest subject. A send counts only when its subject matches the lead's arm.</p></section>`;
}
function viewEmail(x) {
  const d = x.ab && x.ab.data, M = x.m && x.m.data, acts = x.acts || [];
  if (!d || !Array.isArray(d.campaigns)) return empty("No A/B data yet. It arrives with the next sync (hourly).");
  const r = d.rules || {}, MIN = r.min_sends || 300, tests = d.campaigns.flatMap(c => (c.steps || []).map(s => ({ c, s, st: abStatus(c, s, acts) })));
  const live = tests.filter(t => t.s.in_test !== false && t.c.since), running = live.filter(t => t.s.A.sent > 0 && t.s.B.sent > 0).length, waiting = live.length - running;
  const vt = t => t ? `${dLabel(dayOf(t))}, ${new Date(t).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })}` : "—";
  const vcard = (c, s, v) => { const o = s[v], lead = s.lead === v && s.state !== "too_early", win = s.lead === v && s.state === "winner", ahead = s.lead === v && s.margin_pts != null;
    return `<div class="ab-v${win ? " win" : lead ? " lead" : ""}"><div class="ab-vh"><span class="sp-tag">${v}</span><span>${v === "A" ? "Line-first" : "Question-first"}</span>${win ? `<em class="ab-badge w">Winner${s.margin_pts != null ? ` · +${s.margin_pts.toFixed(1)} pts` : ""}</em>` : lead ? `<em class="ab-badge">Leading${s.margin_pts != null ? ` · +${s.margin_pts.toFixed(1)} pts` : ""}</em>` : ahead && s.state === "too_early" ? `<em class="ab-badge e">ahead, too early</em>` : ""}</div>
      <b>${o.pos_rate == null ? "—" : o.pos_rate.toFixed(1) + "%"}</b><small>${o.sent ? `${int(o.positives)} positive of ${int(o.sent)} sent · ${int(o.replies)} replies` : "nothing sent yet"}</small>
      <div class="ab-prog" title="${int(o.sent)} of ${MIN} sends needed"><i data-v="w:${Math.min(100, Math.round(100 * o.sent / MIN))}%"></i></div><span class="ab-pn">${int(Math.min(o.sent, MIN))} / ${MIN} sends${o.sent >= MIN ? " ✓" : ""}</span></div>`; };
  const test = (c, s) => { const st = abStatus(c, s, acts), stateTxt = s.state === "winner" ? "Winner found" : s.state === "leading" ? `Leading, not yet certain (${Math.round(100 * (s.lead === "B" ? s.p_b : 1 - s.p_b))}% likely)` : !s.A.sent && !s.B.sent ? "No sends since the split yet" : !s.B.sent ? "B hasn't sent yet" : !s.A.sent ? "A hasn't sent yet" : "Too early";
    if (!c.since) return `<div class="ab-test"><div class="ab-th"><b>${esc(s.step)}</b><span class="chip">Not split yet</span></div><p class="sp-note">This campaign's leads haven't been given their A / B version yet.</p></div>`;
    if (s.in_test === false) return `<div class="ab-test"><div class="ab-th"><b>${esc(s.step)}</b><span class="chip">Not in this test</span></div><p class="sp-note">No real B for this step, so every lead gets A.</p></div>`;
    return `<div class="ab-test" data-ab="${esc(c.key)}|${esc(s.step)}"><div class="ab-th"><b>${esc(s.step)}${s.leads ? ` <small class="mut">leads A ${int(s.leads.A)} · B ${int(s.leads.B)}</small>` : ""}</b><span class="chip${s.state === "winner" ? " g" : s.state === "leading" ? " b" : ""}">${esc(stateTxt)}</span></div>
      <div class="ab-pair">${vcard(c, s, "A")}${vcard(c, s, "B")}</div>
      <div class="ab-st"><span class="${st.chip}">${st.k === "done" ? "Change done" : st.k === "due" ? "Change due" : "No change yet"}</span><span class="grow">${esc(st.text)}</span>${st.k === "due" ? `<button type="button" class="act go" data-abdone="${esc(c.key)}|${esc(s.step)}">${ic("check")}Mark change done</button>` : st.k === "done" ? `<button type="button" class="act" data-abundo="${st.a.id}">Undo</button>` : `<button type="button" class="act" data-abdone="${esc(c.key)}|${esc(s.step)}" title="Use this if you swapped a variant by hand before a winner was called">Log a change</button>`}</div></div>`; };
  const smp = c => c.sample ? `<details class="ab-txt"><summary>What A and B say <small>one real lead's emails</small></summary><div class="ab-pair">${["A", "B"].map(v => `<div class="ab-copy"><span class="sp-tag">${v}</span><b>${esc(c.sample[v].subject || "(no subject)")}</b><p>${esc(c.sample[v].body || "")}</p><small>Follow-up: ${esc((c.sample[v].fu || "").slice(0, 260))}</small></div>`).join("")}</div></details>` : "";
  const camps = M && Array.isArray(M.campaigns) ? M.campaigns.filter(c => c.contacted >= 30) : [], rmx = Math.max(1, ...camps.map(c => c.reply_rate || 0));
  const part = x.arms && x.arms.data ? (x.arms.data.arms || []).filter(a => (a.campaigns || []).some(n => /PARTNER/i.test(n))) : null, pmx = part ? Math.max(1, ...part.map(a => a.reply_rate || 0)) : 1;
  const done = acts.filter(a => a.done_at);
  return `<div class="sp-kpis">${kpi("Tests running", cu(running, "int", "ab-run"), waiting ? `${waiting} more waiting for first sends since the split` : "A and B both sending")}${kpi("Winners found", cu(tests.filter(t => t.s.state === "winner").length, "int", "ab-win"), `needs ${MIN}+ sends per side and ${r.min_pos || 8}+ positives`)}${kpi("Changes due", cu(tests.filter(t => t.st.k === "due").length, "int", "ab-due"), "loser to drop, new challenger to write")}${kpi("Changes done", cu(done.length, "int", "ab-done"), done[0] ? `last ${esc(dLabel(dayOf(done[0].done_at)))}` : "none yet")}</div>
  <p class="sp-note ab-split"><b>Split 50/50 by lead since ${esc(vt(d.split_since))}</b> · each lead keeps one version per email, and A vs B is counted by that version, not by Instantly's variant numbers.</p>
  ${subjCard(d.subjects, vt)}
  <div class="ab-grid">${d.campaigns.map(c => `<section class="card sp-card ab-card"><h2>${esc(c.name)} <small>${c.since ? `split since ${esc(vt(c.since))}` : "not split yet"}</small></h2>${(c.steps || []).map(s => test(c, s)).join("")}${smp(c)}</section>`).join("")}</div>
  <section class="card sp-card"><h2>Partner campaigns <small>arms are tags, not Instantly variants</small></h2>${part && part.length ? `<div class="sp-bars">${part.map(a => `<div class="sp-bar"><span>${esc(a.arm)} <small class="mut">${esc((a.campaigns || []).filter(n => /PARTNER/i.test(n)).map(n => n.replace(/^PARTNER\s*/i, "")).join(", "))}</small></span><span class="v">${a.reply_rate == null ? "—" : a.reply_rate.toFixed(1) + "% replied"} · ${int(a.positive)} positive · ${int(a.contacted)} contacted</span><div class="bar"><i data-v="w:${Math.max(2, Math.round(100 * (a.reply_rate || 0) / pmx))}%"></i></div></div>`).join("")}</div><p class="sp-note">Too early for a winner: every partner arm is under 100 leads contacted.</p>` : empty("No data yet: no partner-campaign leads are tagged in the arms sync.")}</section>
  <section class="card sp-card"><h2>Reply rate by campaign <small>all time · Instantly API${x.m ? ` · synced ${esc(ago(x.m.updated_at))}` : ""}</small></h2>${camps.length ? `<div class="sp-bars">${camps.map(c => `<div class="sp-bar"><span>${esc(c.name.split(" —")[0])} <small class="mut">${esc(c.status_label || "")}</small></span><span class="v">${c.reply_rate == null ? "—" : c.reply_rate.toFixed(1) + "%"} replied · ${c.pos_rate == null ? "—" : c.pos_rate.toFixed(1) + "%"} positive</span><div class="bar"><i data-v="w:${Math.max(2, Math.round(100 * (c.reply_rate || 0) / rmx))}%"></i></div></div>`).join("")}</div>
    <details class="ab-txt"><summary>Details <small>table</small></summary><div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Campaign</th><th class="num">Sent</th><th class="num">Contacted</th><th class="num">Replies</th><th class="num">Reply rate</th><th class="num">Positive</th><th class="num">Positive rate</th><th class="num">Bounced</th><th>Opens</th></tr></thead><tbody>${M.campaigns.map(c => `<tr><td>${esc(c.name)}</td><td class="num">${int(c.sent)}</td><td class="num">${int(c.contacted)}</td><td class="num">${int(c.replies)}</td><td class="num">${c.reply_rate == null ? "—" : c.reply_rate.toFixed(1) + "%"}</td><td class="num">${int(c.opportunities)}</td><td class="num">${c.pos_rate == null ? "—" : c.pos_rate.toFixed(1) + "%"}</td><td class="num">${c.bounce_rate == null ? "—" : c.bounce_rate.toFixed(1) + "%"}</td><td class="mut">not tracked (plain text)</td></tr>`).join("")}</tbody></table></div></details>
    <p class="sp-note">Reply rate = unique human replies ÷ leads contacted. Opens aren't tracked: the emails are plain text with open tracking off. That doesn't affect reply rate.</p>` : empty("No data yet.")}</section>
  <section class="card sp-card"><h2>Past changes <small>history</small></h2>${done.length ? `<div class="wk-log">${done.map(a => `<div class="wk-ch"><span class="mono">${esc(dLabel(dayOf(a.done_at)))}</span><span class="chip g">${esc(a.campaign)}</span><span class="w">${esc(a.step)}: ${esc(a.action || `kept ${a.winner || "?"}, dropped ${a.loser || "?"}`)}${a.note ? ` · ${esc(a.note)}` : ""}</span><span class="mut">${esc(a.done_by || "")}</span></div>`).join("")}</div>` : empty("No test has been decided yet. The 50/50 split by lead started on Nov 19; the first verdicts come once each side has 300 sends.")}</section>`;
}
function wireEmail() {
  const rer = () => { const y = scrollY; PAGE_EL.innerHTML = header("email", CACHE.email) + viewEmail(CACHE.email); applyVars(PAGE_EL); countUps(PAGE_EL); wireEmail(); scrollTo(0, y); };
  const who = () => (ME && ME.who !== "Both" ? ME.who : (ME && ME.name)) || null;
  $$("[data-abdone]", PAGE_EL).forEach(b => b.addEventListener("click", async () => {
    const [key, step] = b.dataset.abdone.split("|"), D = CACHE.email, c = D.ab.data.campaigns.find(z => z.key === key), s = c.steps.find(z => z.step === step), st = abStatus(c, s, D.acts);
    const note = st.k === "none" ? prompt("What changed? (one line)") : ""; if (st.k === "none" && !note) return;
    try { const row = st.a && !st.a.done_at ? await must(sb().from("ab_actions").update({ done_at: new Date().toISOString(), done_by: who() }).eq("id", st.a.id).select().single())
        : await must(sb().from("ab_actions").insert({ campaign: key, step, winner: st.w || null, loser: st.l || null, action: st.k === "due" ? `dropped ${st.l}, new challenger against ${st.w}` : "manual change", note: note || null, done_at: new Date().toISOString(), done_by: who() }).select().single());
      D.acts = [row, ...D.acts.filter(a => a.id !== row.id)]; rer(); toast("Marked as done"); } catch (e) { toast("Couldn't save that. Check your connection."); }
  }));
  $$("[data-abundo]", PAGE_EL).forEach(b => b.addEventListener("click", async () => { const id = +b.dataset.abundo, D = CACHE.email, a = D.acts.find(z => z.id === id);
    try { if (a && !a.winner && a.action === "manual change") { await must(sb().from("ab_actions").delete().eq("id", id)); D.acts = D.acts.filter(z => z.id !== id); }
      else { const row = await must(sb().from("ab_actions").update({ done_at: null, done_by: null }).eq("id", id).select().single()); D.acts = D.acts.map(z => z.id === id ? row : z); }
      rer(); toast("Undone"); } catch (e) { toast("Couldn't undo that."); } }));
}

/* 3. clients + their videos (SIMAS 11-19 15:3x: grouped by category, retainer plans, videos by date, today's highlighted) */
async function loadClients() {
  const [clients, deliveries, payments, retainers, st, notes, m, proms, scs, pipe, ovs] = await Promise.all([
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
    all("pack_overrides", "*").catch(() => []),
  ]);
  const t = dayOf(Date.now()), plans = (m && m.data && m.data.retainer_plans) || {};
  const vids = {}, paid = {}, nPay = {}, lastPay = {}, payL = {};
  payments.forEach(p => { if (!p.refunded) (payL[p.client_id] = payL[p.client_id] || []).push(p); });
  /* 11-19 21:1x (Simas: "is the pack they bought finished or not"): bought = the number the order folder starts with, else the Stripe
     pack; delivered = Shorts in that folder, each counted once. No size is guessed: an unmapped payment says "size unknown". */
  const sizeOf = q => { const mm = /short_(\d+)/.exec(String(q.package || "")); if (mm) return +mm[1]; return ({ 150: 5, 75: 5, 60: 3, 27: 1, 100: 10 })[Math.round(+q.amount)] || null; };
  const PST = { notstarted: ["Not started", ""], progress: ["In progress", "o"], waiting: ["Waiting on client", "b"], finished: ["Finished", "g"], unknown: ["Size unknown", ""] };
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
    const isRet = q => /month/i.test(q.package || "") || (r && Math.round(+q.amount) === Math.round(+r.amount) && +new Date(q.paid_at) >= +new Date(r.started_at) - 864e5);
    const pp = (payL[c.id] || []).filter(q => !isRet(q)).sort((a, b) => String(a.paid_at).localeCompare(String(b.paid_at))), ords = {};
    vs.forEach(v => { const mm = /^(\d+)[\s-]*(shorts?|short form|videos?|long)/i.exec(v.order_name || ""); if (!mm) return; (ords[v.order_name] = ords[v.order_name] || { name: v.order_name, bought: +mm[1], vs: [] }).vs.push(v); });
    const packs = Object.values(ords).map(o => ({ name: o.name, bought: o.bought, files: o.vs.length, done: uniq(o.vs), last: o.vs.reduce((x, v) => v.delivered_at > x ? v.delivered_at : x, ""), first: o.vs.reduce((x, v) => !x || v.delivered_at < x ? v.delivered_at : x, "") }))
      .filter(o => !(plan && plan.shorts && o.bought === plan.shorts && o.last >= plan.start)).sort((a, b) => a.first.localeCompare(b.first));
    pp.slice(packs.length).forEach(q => { const recent = Date.now() - new Date(q.paid_at) < 14 * 864e5, n = sizeOf(q); if (recent) packs.push({ name: `Paid ${dLabel(dayOf(q.paid_at))} · ${usd(q.amount)}`, bought: n, done: 0, last: "", first: "", paidAt: q.paid_at, unpaired: true }); });
    /* 11-19 late (Simas): old-style folders or far more files than the folder's number = a custom deal, not an n/m pack; a past
       client's open pack is not "in progress"; a next action that says "parked" is Parked, not waiting on the client. */
    const parked = pipe.some(q => mine(q) && /\bparked\b/i.test(q.next_action || ""));
    packs.forEach(o => { const std = o.unpaired || /^\d+\s+Shorts?\s+·/i.test(o.name), fin = o.bought != null && o.done >= o.bought, custom = !std || (!fin && o.bought != null && o.files > o.bought * 2 + 2);
      o.st = std && fin ? "finished" : cat === "past" && o.bought != null ? (fin ? "finished" : "past") : custom ? "custom" : o.bought == null ? "unknown" : parked ? "parked" : waiting ? "waiting" : o.done === 0 ? "notstarted" : "progress"; });
    packs.forEach(o => { const ov = ovs.find(q => q.client_id === c.id && q.order_name === o.name); if (!ov) return;   /* a founder's word beats the Drive count */
      o.st = ov.status; if (ov.done != null) o.done = ov.done; if (ov.bought != null) o.bought = ov.bought; o.ov = ov; });
    const worst = ["notstarted", "progress", "waiting", "parked", "unknown", "past", "finished", "custom"].find(k => packs.some(o => o.st === k)) || "", state = r ? "retainer" : worst;
    const pr = proms.filter(q => es.includes(lc(q.lead_email))).sort((a, b) => String(a.due_at).localeCompare(String(b.due_at))), sc = scs.find(q => q.email && es.includes(lc(q.email))) || null, att = [];
    if (plan) { plan.daysLeft = Math.ceil((new Date(r.current_period_end) - Date.now()) / 864e5); const len = Math.max(1, (new Date(r.current_period_end) - new Date(plan.start + "T00:00:00Z")) / 864e5), frac = Math.min(1, Math.max(0, 1 - plan.daysLeft / len));
      plan.expected = plan.shorts ? Math.round(plan.shorts * frac) : null;
      if (plan.daysLeft <= 5) att.push(["o", `renews in ${plan.daysLeft} day${plan.daysLeft === 1 ? "" : "s"}`]);
      if (plan.shorts && plan.done < plan.expected - Math.max(2, plan.shorts * .15)) att.push(["r", `behind: ${plan.done} delivered, about ${plan.expected} expected by now`]); }
    pr.filter(q => q.due_at && new Date(q.due_at) < new Date()).forEach(q => att.push(["r", `promise overdue: ${String(q.promise).slice(0, 70)}`]));
    packs.forEach(o => { if (o.st === "notstarted" && o.paidAt && Date.now() - new Date(o.paidAt) > 864e5) att.push(["r", `paid pack not started: ${o.name}${o.bought ? ` (${o.bought} Shorts)` : ""}`]);
      if (o.st === "progress" && o.last && o.last < addDays(t, -3) && o.last >= addDays(t, -30) && cat !== "past") att.push(["o", `pack ${o.done} / ${o.bought}, no delivery since ${dLabel(o.last)}`]); });
    return { ...c, vids: vs, paid: paid[c.id] || 0, nPay: nPay[c.id] || 0, last, ret: r, plan, gone, cat, today: vs.filter(v => v.delivered_at === t).length, proms: pr, scope: sc, att, packs, state, worst, waiting };
  }).filter(c => c.vids.length || c.paid || c.ret);
  const by = k => list.filter(c => c.cat === k);
  const groups = [["retainer", "Monthly retainer", by("retainer").sort((a, b) => b.ret.amount - a.ret.amount)],
    ["pack", "Pack clients", by("pack").sort((a, b) => (/notstarted|progress|waiting/.test(b.worst) - /notstarted|progress|waiting/.test(a.worst)) || (b.last || "").localeCompare(a.last || "") || b.paid - a.paid)],
    ["past", "Past / parted ways", by("past").sort((a, b) => (b.last || "").localeCompare(a.last || ""))]];
  const ds = st.find(x => x.name === "deliveries");
  const allP = list.flatMap(c => c.packs.map(o => ({ ...o, client: c.name }))), nSt = k => allP.filter(o => o.st === k).length;
  return { list, groups, t, PST, counts: { retainer: by("retainer").length, progress: nSt("progress"), finished: nSt("finished"), notstarted: nSt("notstarted"), waiting: nSt("waiting"), unknown: nSt("unknown") }, unknownL: allP.filter(o => o.st === "unknown").map(o => `${o.client}: ${o.name}`), synced: ds ? ds.ran_at : null, dsOk: ds ? ds.ok !== false : true, lastDelivery: deliveries.reduce((x, v) => v.delivered_at > x ? v.delivered_at : x, ""), todayN: list.reduce((s, c) => s + c.today, 0), todayC: list.filter(c => c.today).length };
}
const fdur = s => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "";
function clientDetail(c, t) {
  if (!c) return empty("Pick a client on the left.");
  const days = {}; c.vids.forEach(v => (days[v.delivered_at || ""] = days[v.delivered_at || ""] || []).push(v));
  const keys = Object.keys(days).sort().reverse();
  return `<div class="cl-head"><div><h2>${esc(c.name || "Client")}</h2><p>${esc([c.show, (c.emails || [])[0], c.last ? `last video ${dLabel(c.last)}` : "no videos yet"].filter(Boolean).join(" · "))}</p></div>
    <div class="cl-chips">${stChip(c)}${c.plan ? `<span class="chip">renews in ${c.plan.daysLeft} d</span>` : ""}${c.today ? `<span class="chip g">${c.today} today</span>` : ""}${c.plan ? `<span class="chip g">${esc(c.plan.text)}</span>` : ""}<span class="chip">${int(c.vids.length)} video${c.vids.length === 1 ? "" : "s"}</span>${c.paid ? `<span class="chip b">${usd(c.paid)} paid${c.nPay > 1 ? ` · ${c.nPay} payments` : ""}</span>` : ""}${c.gone ? `<span class="chip">parted ways</span>` : ""}${c.scope && c.scope.url ? `<a class="chip lkc" href="${esc(c.scope.url)}" target="_blank" rel="noopener noreferrer">Scope ↗</a>` : ""}</div></div>
    ${packLines(c)}
    ${c.att.length ? `<div class="sp-alerts cl-al">${c.att.map(a => `<div class="sp-alert ${a[0] === "r" ? "red" : "amber"}"><i></i><span>${esc(a[1])}</span></div>`).join("")}</div>` : ""}
    ${c.proms.length ? `<div class="cl-plan"><b class="cl-ph">Promised to this client</b>${c.proms.map(q => `<div class="cl-pr"><span class="grow">${esc(q.promise)}</span><span class="chip${q.due_at && new Date(q.due_at) < new Date() ? " r" : ""}">${q.due_at ? "due " + esc(dLabel(dayOf(q.due_at))) : "no date"}</span></div>`).join("")}</div>` : ""}
    ${c.plan ? `<div class="cl-plan"><div class="sp-bar"><span>Delivered this billing month <small class="mut">since ${esc(dLabel(c.plan.start))} · renews ${esc(dLabel(c.plan.renews))} (${c.plan.daysLeft} days left)${c.plan.expected != null ? ` · about ${c.plan.expected} expected by now` : ""}</small></span><span class="v">${c.plan.done}${c.plan.shorts ? ` / ${c.plan.shorts}` : ""}</span><div class="bar c-green"><i data-v="w:${c.plan.shorts ? Math.min(100, Math.max(2, Math.round(100 * c.plan.done / c.plan.shorts))) : 100}%"></i></div></div><p class="sp-note">Counts each Short once (new versions of the same Short don't add up), from the files in Drive.</p></div>` : ""}
    ${keys.map(k => `<div class="cl-ord${k === t ? " today" : ""}">${k === t ? "Today · " : ""}${esc(dLabel(k))} · ${days[k].length}</div><div class="vid-grid">${days[k].map(v => `<a class="vid${k === t ? " today" : ""}" href="${esc(v.link)}" target="_blank" rel="noopener noreferrer" title="Open in Drive"><span class="pl">${ic("play")}${k === t ? `<em class="vt">Today</em>` : ""}</span><b>${esc(v.title || "Video")}</b><small>${esc(fdur(v.duration_s))}${v.duration_s ? " · " : ""}<span class="vo">${esc(v.order_name || "")}</span></small></a>`).join("")}</div>`).join("") || empty("No videos for this client in the delivery index yet.")}`;
}
let CL_TODAY = false, CLF = "";
const PCH = { notstarted: ["Not started", ""], progress: ["In progress", "o"], waiting: ["Waiting on client", "b"], finished: ["Finished", "g"], unknown: ["Size unknown", ""], past: ["Past client", ""], parked: ["Parked", ""], custom: ["Custom deal", ""] };
function stChip(c) {
  if (c.ret) return `<span class="chip acc">Ongoing</span>`;
  const o = c.packs.find(x => x.st === c.worst); if (!o) return "";
  if (o.st === "custom") return `<span class="chip">Custom deal</span>`;
  if (o.st === "past") return `<span class="chip">Past client · ${o.done} of ${o.bought} delivered</span>`;
  return `<span class="chip ${PCH[o.st][1]}">${o.st === "finished" ? `✓ Finished${o.ov && o.bought != null ? ` · ${o.done} / ${o.bought}` : ""}` : `${PCH[o.st][0]}${o.bought != null && o.st !== "waiting" ? ` · ${o.done} / ${o.bought}` : ""}`}</span>`;
}
const packLines = c => c.packs.length ? `<div class="cl-plan"><b class="cl-ph">Packs</b>${c.packs.map(o => `<div class="cl-pk"><span class="ring ${PCH[o.st][1]}" data-v="p:${o.bought ? Math.min(100, Math.round(100 * o.done / o.bought)) : 0}"></span><span class="grow">${esc(o.name)}${o.st === "waiting" && c.waiting ? `<small class="mut"> · ${esc(c.waiting)}</small>` : ""}</span><b class="mono">${o.st === "custom" ? `${o.files} files` : o.bought == null ? "? " : `${o.done} / ${o.bought}`}</b><span class="chip ${PCH[o.st][1]}">${o.st === "finished" ? "✓ Finished" : PCH[o.st][0]}</span>${o.ov ? `<small class="mut">set by ${esc(o.ov.set_by || "a founder")} ${esc(dLabel(dayOf(o.ov.set_at)))}</small><button type="button" class="lk" data-ovundo="${esc(o.name)}">undo</button>` : o.st !== "finished" && !o.unpaired ? `<button type="button" class="act" data-ovfin="${esc(o.name)}" data-b="${o.bought == null ? "" : o.bought}">Mark finished</button>` : ""}</div>`).join("")}</div>` : "";
function clientRow(c, sel) {
  const sub = c.plan ? c.plan.text : c.last ? `last video ${dLabel(c.last)}${c.nPay > 1 ? ` · ${c.nPay} payments` : ""}` : c.paid ? `${usd(c.paid)} paid` : "";
  return `<a class="cl-item" href="?p=clients&amp;c=${esc(c.id)}" data-cl="${esc(c.id)}" data-st="${esc([c.ret ? "retainer" : "", ...new Set(c.packs.map(o => o.st))].join(" "))}" data-today="${c.today}" data-q="${esc(lc([c.name, c.show, ...(c.emails || [])].join(" ")))}"${sel && c.id === sel.id ? ' aria-current="true"' : ""}><span class="av">${esc(initials(c.name))}</span><span class="grow"><span class="t">${esc(c.name || "Client")}</span><span class="s">${esc(sub)}</span></span><span class="n">${int(c.vids.length)}</span><span class="cl-ch">${stChip(c)}${c.plan && c.plan.shorts ? `<span class="chip">${c.plan.done} / ${c.plan.shorts} this month</span>` : ""}${c.today ? `<span class="chip g">${c.today} today</span>` : ""}</span></a>`;
}
function viewClients(d) {
  if (!d.list.length) return empty("No clients with videos or payments yet.");
  const sel = d.list.find(c => c.id === param("c")) || (d.groups.find(g => g[2].length) || [0, 0, []])[2][0], n = d.list.reduce((s, c) => s + c.vids.length, 0);
  return `<div class="sp-kpis">${kpi("Delivered today", int(d.todayN), d.todayN ? `${d.todayC} client${d.todayC === 1 ? "" : "s"} · ${esc(dLabel(d.t))}` : "nothing yet today")}${kpi("On a monthly retainer", int(d.groups[0][2].length), usd(d.groups[0][2].reduce((s, c) => s + (+c.ret.amount || 0), 0)) + " a month")}${kpi("Clients", int(d.list.length), "paid or got videos")}${kpi("Videos delivered", int(n), `newest ${esc(dLabel(d.lastDelivery))}`)}</div>
  <div class="cl-filt" role="group" aria-label="Filter by status">${[["retainer", "Retainers ongoing", "acc"], ["progress", "Packs in progress", "o"], ["finished", "Packs finished", "g"], ["notstarted", "Not started", ""], ["waiting", "Waiting on client", "b"]].map(([k, l, cl]) => `<button type="button" class="cl-fb ${cl}${CLF === k ? " on" : ""}" data-clf="${k}" aria-pressed="${CLF === k}"><b>${d.counts[k]}</b><span>${l}</span></button>`).join("")}</div>
  ${d.counts.unknown ? `<p class="sp-note">Size unknown for ${d.counts.unknown} payment${d.counts.unknown === 1 ? "" : "s"} (not guessed): ${esc(d.unknownL.join("; "))}.</p>` : ""}
  ${d.list.some(c => c.att.length) ? `<section class="card sp-card"><h2>Needs attention <small>${d.list.filter(c => c.att.length).length} client${d.list.filter(c => c.att.length).length === 1 ? "" : "s"}</small></h2><div class="sp-alerts">${d.list.filter(c => c.att.length).flatMap(c => c.att.map(a => `<a class="sp-alert ${a[0] === "r" ? "red" : "amber"} cl-go" href="?p=clients&amp;c=${esc(c.id)}" data-cl-go="${esc(c.id)}"><i></i><span><b>${esc(c.name)}</b> · ${esc(a[1])}</span></a>`)).join("")}</div></section>` : ""}
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
  $("#cl-detail")?.addEventListener("click", async ev => {
    const f = ev.target.closest("[data-ovfin]"), u = ev.target.closest("[data-ovundo]"); if (!f && !u) return;
    const cid = new URLSearchParams(location.search).get("c") || ($("#cl-list [aria-current=true]") || {}).dataset?.cl; if (!cid) return;
    await me(); const who = (ME && ME.who !== "Both" ? ME.who : (ME && ME.name)) || null;
    try {
      if (f) { const b = f.dataset.b ? +f.dataset.b : null; if (!confirm(`Mark "${f.dataset.ovfin}" as finished${b ? ` (${b} / ${b})` : ""}?`)) return;
        await must(sb().from("pack_overrides").upsert({ client_id: cid, order_name: f.dataset.ovfin, status: "finished", done: b, bought: b, set_by: who, set_at: new Date().toISOString() })); }
      else await must(sb().from("pack_overrides").delete().eq("client_id", cid).eq("order_name", u.dataset.ovundo));
      history.replaceState({ p: "clients" }, "", `?p=clients&c=${encodeURIComponent(cid)}`); CACHE.clients = null; await renderPage(true); toast(f ? "Marked finished" : "Override removed");
    } catch (e) { toast("Couldn't save that. Check your connection."); }
  });
  $$("[data-clf]", PAGE_EL).forEach(b => b.addEventListener("click", () => { CLF = CLF === b.dataset.clf ? "" : b.dataset.clf; $$("[data-clf]", PAGE_EL).forEach(x => { const on = x.dataset.clf === CLF; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); }); filterClients(); }));
  $$(".ring[data-v]", PAGE_EL).forEach(el => el.style.setProperty("--p", el.dataset.v.split(":")[1]));
  filterClients();
  $("#cl-list")?.addEventListener("click", ev => {
    const a = ev.target.closest("[data-cl]"); if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey) return; ev.preventDefault();
    const c = CACHE.clients.list.find(x => x.id === a.dataset.cl); if (!c) return;
    $$("#cl-list [data-cl]").forEach(x => x.dataset.cl === c.id ? x.setAttribute("aria-current", "true") : x.removeAttribute("aria-current"));
    $("#cl-detail").innerHTML = clientDetail(c, CACHE.clients.t); applyVars($("#cl-detail")); $$("#cl-detail .ring[data-v]").forEach(el => el.style.setProperty("--p", el.dataset.v.split(":")[1])); history.replaceState({ p: "clients" }, "", `?p=clients&c=${encodeURIComponent(c.id)}`);
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
      return { pl, acct: A.find(a => a.platform === pl) || null, sh, weeks, last: medn(sh.filter(p => age(p) < 7).map(p => +p.views)), prev: medn(sh.filter(p => age(p) >= 7 && age(p) < 28).map(p => +p.views)), best: in28.slice(0, 3), worst: in28.slice(3).slice(-2).reverse() };
    }).filter(x => x.acct || x.sh.length);
    const posted = new Set(P.filter(p => p.ours && p.our_ref).map(p => p.our_ref)), main = plat.filter(x => x.sh.length).sort((a, b) => b.sh.filter(p => age(p) < 60).length - a.sh.filter(p => age(p) < 60).length || (b.pl === "youtube") - (a.pl === "youtube"))[0] || null;
    const yt = A.find(a => a.platform === "youtube"), handle = (yt && yt.handle) || (A[0] && A[0].handle) || "";
    return { key: e, r, cl, web: (cl && cl.website) || "", name: (A.find(a => a.name) || {}).name || (cl && cl.show) || r.name || (cl && cl.name) || e, handle, A, P, plat, main, ours, planOurs, sDay,
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
const pfPost = p => `<a class="vid" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" title="Open on ${esc((PL[p.platform] || [p.platform])[0])}"><span class="pl">${ic("play")}${p.ours ? `<em class="vt">Ours · ${esc(p.our_ref)}</em>` : ""}</span><b>${esc(p.title || "Post")}</b><small><span class="mono">${kf(p.views)} views</span> · ${esc((PL[p.platform] || [p.platform])[0])} · ${esc(dLabel(dayOf(p.posted_at)))}</small></a>`;
function pfTrend(p) {
  if (p.pl === "instagram" && !p.sh.length) return `<div class="pf-pl"><div class="pf-h"><b>Instagram</b><small>${p.acct ? `${kf(p.acct.followers)} followers · ${kf(p.acct.posts_count)} posts` : ""}</small></div><p class="sp-note">Reel views need Meta access. Without a login, Instagram shows only the account numbers.</p></div>`;
  const max = Math.max(1, ...p.weeks.map(w => w.med || 0));
  return `<div class="pf-pl"><div class="pf-h"><b>${PL[p.pl][0]}</b><small>${p.acct ? `${kf(p.acct.followers)} followers` : ""}</small><span class="pf-d">last 7 days <b class="mono">${kf(p.last)}</b> ${pfDelta(p.last, p.prev)} <span class="mut">vs ${kf(p.prev)} the 3 weeks before</span></span></div>
    <div class="wk mini pf-wk">${p.weeks.map((w, i) => `<i class="${w.w === 0 ? "on" : ""}" data-v="h:${((w.med || 0) / max * 100).toFixed(1)}%;k:${i}" title="${w.w === 0 ? "Last 7 days (still growing)" : `${w.w}–${w.w + 1} weeks ago`}: ${w.n} Short${w.n === 1 ? "" : "s"}, median ${w.med == null ? "—" : int(w.med)} views"></i>`).join("")}</div>
    <div class="pf-wl">${p.weeks.map(w => `<span><b class="mono">${w.med == null ? "—" : kf(w.med)}</b><small>${w.w === 0 ? "now" : `−${w.w} wk`} · ${w.n}</small></span>`).join("")}</div></div>`;
}
function perfDetail(c) {
  if (!c) return empty("Pick a client on the left.");
  const end = c.r.current_period_end, left = end ? Math.max(0, Math.ceil((new Date(end) - Date.now()) / 864e5)) : null, waiting = c.planOurs.length - c.postedN;
  const top = c.P.filter(p => p.is_short && p.views != null && (Date.now() - new Date(p.posted_at)) / 864e5 < 60).sort((a, b) => b.views - a.views).slice(0, 6);
  return `<div class="cl-head"><div><h2>${esc(c.name)}</h2><p>${esc([c.handle, c.key, `last scan ${ago(c.scan)}`].filter(Boolean).join(" · "))}</p></div>
    <div class="cl-chips"><span class="chip acc">${usd(c.r.amount)} / month</span>${c.planN ? `<span class="chip">${c.monthN} / ${c.planN} Shorts this month</span>` : ""}${left != null ? `<span class="chip">renews in ${left} d · ${esc(dLabel(dayOf(end)))}</span>` : ""}<span class="chip ${c.postedN ? "g" : "o"}">ours posted ${c.postedN} / ${c.planOurs.length}</span></div></div>
    ${pfLinks(c)}
    <div class="cl-plan"><b class="cl-ph">Views and trend</b><p class="sp-note">Median views per Short, by the week it was posted (last 6 weeks). Under each bar: weeks ago · Shorts posted that week. The newest week is still growing.</p>${c.plat.map(pfTrend).join("") || empty("No account scanned yet. Add this client to scripts/data/client_perf/accounts.json.")}</div>
    ${c.plat.filter(p => p.best.length).map(p => `<div class="cl-ord">${esc(PL[p.pl][0])} · best Shorts, last 28 days</div><div class="vid-grid">${p.best.map(pfPost).join("")}</div>${p.worst.length ? `<div class="cl-ord">${esc(PL[p.pl][0])} · lowest, last 28 days</div><div class="vid-grid">${p.worst.map(pfPost).join("")}</div>` : ""}`).join("")}
    <div class="cl-plan"><b class="cl-ph">Did they post ours · ${c.postedN} posted · ${waiting} waiting</b><p class="sp-note">Matched by length and title words against their public YouTube and TikTok posts. Instagram is matched by caption words only (Meta doesn't share video length), so check those by eye.</p>
      ${c.ours.length ? `<div class="tblw"><table class="tbl pf-tbl"><thead><tr><th>Short</th><th>Title</th><th>Delivered</th><th>Posted</th></tr></thead><tbody>${c.ours.map(o => `<tr><td>${o.n}</td><td>${esc(o.title)}</td><td>${esc(dLabel(String(o.at || "").slice(0, 10)))}${o.plan ? "" : ` <small class="mut">earlier pack</small>`}</td><td>${o.posts.length ? o.posts.map(p => `<a class="chip g" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(PL[p.platform][0])} ${esc(dLabel(dayOf(p.posted_at)))}</a>`).join(" ") : `<span class="chip">not yet</span>`}</td></tr>`).join("")}</tbody></table></div>` : empty("No delivered Short indexed for this client yet.")}</div>
    <div class="cl-ord">What works · top Shorts, last 60 days</div>${top.length ? `<div class="vid-grid">${top.map(pfPost).join("")}</div>` : empty("No Shorts in the last 60 days.")}
    <div class="cl-plan"><b class="cl-ph">Weekly reports</b>${c.reps.length ? c.reps.map(x => { const dd = x.data || {}; return `<div class="cl-pr"><span class="grow"><b>Week of ${esc(dLabel(String(x.week).slice(0, 10)))}</b> ${esc(dd.summary || dd.headline || "")}</span>${x.page_url ? `<a class="chip lkc" href="${esc(x.page_url)}" target="_blank" rel="noopener noreferrer">Page ↗</a>` : ""}<span class="chip ${x.status === "sent" ? "g" : ""}">${esc(x.status)}${x.sent_at ? " " + esc(dLabel(dayOf(x.sent_at))) : ""}</span></div>`; }).join("") : empty("First report from week 2, once our Shorts are posted and have views.")}</div>
    <div class="cl-plan"><b class="cl-ph">Account and plan</b>${c.A.map(a => `<div class="cl-pr"><span class="grow"><b>${esc(PL[a.platform] ? PL[a.platform][0] : a.platform)}</b> <a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${esc(a.handle || a.url)} ↗</a></span><span class="mono">${kf(a.followers)} followers · ${kf(a.posts_count)} posts</span></div>`).join("") || empty("No accounts on file.")}
      <div class="cl-pr"><span class="grow">Plan</span><span class="mono">${usd(c.r.amount)} / month${c.planN ? ` · ${c.planN} Shorts` : ""} · since ${esc(dLabel(dayOf(c.r.started_at)))}</span></div>
      <div class="cl-pr"><span class="grow">Delivered this billing month</span><span class="mono">${c.monthN}${c.planN ? ` / ${c.planN}` : ""}${c.sDay ? ` · since ${esc(dLabel(c.sDay))}` : ""}</span></div></div>`;
}
const perfRow = (c, sel) => { const m = c.main;
  return `<a class="cl-item" href="?p=perf&amp;k=${encodeURIComponent(c.key)}" data-pf="${esc(c.key)}"${sel && c.key === sel.key ? ' aria-current="true"' : ""}><span class="av">${esc(initials(c.name))}</span><span class="grow"><span class="t">${esc(c.name)}</span><span class="s">${esc([`${usd(c.r.amount)}/mo`, ...pfAccts(c).map(a => `${PL[a.platform] ? PL[a.platform][1] : a.platform} ${hAt(a.handle)} ${kf(a.followers)}`), c.web ? host(c.web) : ""].filter(Boolean).join(" · "))}</span></span><span class="n">${c.postedN}/${c.planOurs.length}</span><span class="cl-ch">${m ? `<span class="chip">${PL[m.pl][1]} 7 d ${kf(m.last)} ${pfDelta(m.last, m.prev)}</span>` : `<span class="chip">no Shorts data</span>`}</span></a>`; };
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
    all("interested_leads", "email,first_name,company,interest_changed_at,last_reply_at"),
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
  const cd = cdR || [], clv = clR || [], idl = idlR || [], cpo = cpoR || [], crp = crpR || [], cacc = caccR || [];
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
  const nmC = Object.fromEntries(clv.map(c => [c.campaign_id, c])), CB = {};
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
    `<p class="sp-note">${esc(W.ABW.A ? "A: " + W.ABW.A : "")} ${esc(W.ABW.B ? "B: " + W.ABW.B : "")}</p>${abT}${subj}<p class="sp-note"><a class="lk" href="?p=email" data-go="email">Open Email tests</a> for the winner cards and whether each change was made.</p>`,
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
  return `<div class="wk-tools"><span class="mut">Week of ${esc(dLabel(d.w0))} · day ${d.k} of 7 · compared with the same ${d.k} day${d.k === 1 ? "" : "s"} last week and the 4 weeks before</span>${wkPick(d)}</div>
  ${hero}${bridge}${funnelS}${league}${abSec}<div class="sp-2b">${engine}${sales}</div>${clients}${chg}${next}
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

/* 5. to-do board */
const COLS = [["todo", "To do"], ["doing", "Doing"], ["done", "Done"]], OWNERS = ["Simas", "Benas", "Both"];
const K_TV = "beju-crm-todo-view";
let TVIEW = store.get(K_TV) === "founder" ? "founder" : "board", OWNF = "All";
let PROMS = [];
async function loadTodos() { await me(); PROMS = await all("promises", "lead_email,promise,owner,due_at,status", q => q.eq("status", "open").order("due_at")).catch(() => []); return all("todo_cards", "*", q => q.order("pos").order("id")); }
const overdue = d => d && d < dayOf(Date.now());
const cardsIn = (list, col) => list.filter(c => c.col === col).sort((a, b) => a.pos - b.pos || a.id - b.id);
async function todoBadge() {
  try { const rows = await must(sb().from("todo_cards").select("owner").neq("col", "done")), n = rows.length, by = o => rows.filter(r => r.owner === o).length;
    const b = $("#sn-todo-n"), a = $('#snav a[data-nav="todos"]'), tip = n ? `To-dos · Simas ${by("Simas")} · Benas ${by("Benas")}${by("Both") ? ` · Both ${by("Both")}` : ""}` : "To-dos";
    if (b) { b.hidden = !n; b.textContent = n || ""; } if (a) { a.dataset.tip = tip; a.title = tip; } } catch {}
}
function cardHtml(c) {
  if (EDIT && EDIT.id === c.id) return formHtml(c);
  const oc = c.owner === "Simas" ? "chip b" : c.owner === "Benas" ? "chip o" : "chip";
  return `<div class="tile sd-card${c.col === "done" ? " done" : ""}" data-card="${c.id}" tabindex="0" aria-roledescription="draggable card" aria-label="${esc(c.title)}, ${esc(c.owner)}. Alt plus arrow keys move it.">
    <div class="tt">${esc(c.title)}</div>${c.detail ? `<div class="dd">${esc(c.detail)}</div>` : ""}
    <div class="ft"><span class="${oc}">${esc(c.owner)}</span>${c.due ? `<span class="chip${c.col !== "done" && overdue(c.due) ? " r" : ""}">${c.col !== "done" && overdue(c.due) ? "overdue · " : "due "}${esc(dLabel(c.due))}</span>` : ""}<span class="sp"></span>
      <button type="button" class="mini" data-mv="-1" aria-label="Move left" title="Move left"><svg aria-hidden="true"><use href="#i-back"/></svg></button>
      <button type="button" class="mini" data-mv="1" aria-label="Move right" title="Move right"><svg aria-hidden="true"><use href="#i-chev"/></svg></button>
      <button type="button" class="mini" data-ed aria-label="Edit" title="Edit"><svg aria-hidden="true"><use href="#i-edit"/></svg></button></div></div>`;
}
function formHtml(c) {
  const o = c ? c.owner : (EDIT && EDIT.owner) || (TVIEW === "board" && OWNF !== "All" ? OWNF : "") || (ME && ME.who) || "Both";
  return `<form class="tile sd-form" data-form="${c ? c.id : "new"}" data-col="${esc(c ? c.col : EDIT.col)}">
    <textarea name="title" rows="2" maxlength="300" required placeholder="What needs doing?" aria-label="Card title">${esc(c ? c.title : "")}</textarea>
    <textarea name="detail" rows="2" maxlength="4000" placeholder="Details (optional)" aria-label="Details">${esc(c && c.detail ? c.detail : "")}</textarea>
    <label class="sd-due"><span>Due</span><input type="date" name="due" value="${esc(c && c.due ? c.due : "")}" aria-label="Due date"></label>
    <div class="seg" role="group" aria-label="Owner">${["Simas", "Benas", "Both"].map(x => `<button type="button" data-own="${x}" class="${x === o ? "on" : ""}" aria-pressed="${x === o}">${x}</button>`).join("")}</div>
    <div class="row">${c ? `<button type="button" class="act no del" data-del>Delete</button>` : ""}<button type="button" class="act" data-cancel>Cancel</button><button type="submit" class="act go">${c ? "Save" : "Add card"}</button></div></form>`;
}
const addBtn = (k, o) => EDIT && EDIT.id === "new" && EDIT.col === k && (EDIT.owner || "") === (o || "") ? formHtml(null) : `<button type="button" class="sd-add" data-add="${k}"${o ? ` data-owner="${o}"` : ""}><svg aria-hidden="true"><use href="#i-plus"/></svg>Add a card</button>`;
function boardHtml(list) {
  if (TVIEW === "founder") return OWNERS.map(o => { const mine = list.filter(c => c.owner === o), open = mine.filter(c => c.col !== "done").length, done = cardsIn(mine, "done");
    return `<section class="sd-lane${o === "Both" ? " slim" : ""}" data-lane="${o}" aria-label="${o}"><div class="sd-col-h"><span>${o === "Both" ? "Both / unassigned" : o}</span><span class="chip">${open} open</span></div>
      ${[["todo", "To do"], ["doing", "Doing"]].map(([k, label]) => { const cs = cardsIn(mine, k); return `<div class="sd-sub">${label} · ${cs.length}</div><div class="sd-col sd-zone" data-col="${k}" data-owner="${o}">${k === "todo" ? addBtn(k, o) : ""}${cs.map(cardHtml).join("")}${!cs.length && k === "doing" ? `<p class="empty">Drop a card here.</p>` : ""}</div>`; }).join("")}
      <details class="sd-done"><summary>Done · ${done.length}</summary><div class="sd-col sd-zone" data-col="done" data-owner="${o}">${done.map(cardHtml).join("")}</div></details></section>`; }).join("");
  const show = OWNF === "All" ? list : list.filter(c => c.owner === OWNF);
  return COLS.map(([k, label]) => { const cs = cardsIn(show, k);
    return `<section class="sd-col" data-col="${k}" aria-label="${label}"><div class="sd-col-h"><span>${label}</span><span class="chip">${cs.length}</span></div>
      ${addBtn(k, "")}${cs.map(cardHtml).join("")}${!cs.length && !(EDIT && EDIT.col === k) ? `<p class="empty">Nothing here yet.</p>` : ""}</section>`; }).join("");
}
function toolsHtml(list) { const n = o => list.filter(c => c.col !== "done" && (o === "All" || c.owner === o)).length;
  return `<div class="seg sd-view" role="group" aria-label="View">${[["board", "Board"], ["founder", "By founder"]].map(([k, l]) => `<button type="button" data-tv="${k}" class="${TVIEW === k ? "on" : ""}" aria-pressed="${TVIEW === k}">${l}</button>`).join("")}</div>
    ${TVIEW === "board" ? `<span class="sd-chips" role="group" aria-label="Owner">${["All", ...OWNERS].map(o => `<button type="button" class="chip${OWNF === o ? " b" : ""}" data-of="${o}" aria-pressed="${OWNF === o}">${o} · ${n(o)}</button>`).join("")}</span>` : `<span class="mut">Drag a card to another lane to change its owner.</span>`}`; }
function promsHtml() { return PROMS.length ? `<section class="card sp-card sd-proms"><h2>Promised to clients <small>${PROMS.length} open · from the CRM, read-only</small></h2><div class="sd-pr">${PROMS.map(q => { const late = q.due_at && new Date(q.due_at) < new Date(); return `<div class="tile sd-pc${late ? " late" : ""}"><div class="tt">${esc(q.promise)}</div><div class="ft"><span class="chip">${esc(q.owner || "?")}</span><span class="chip${late ? " r" : ""}">${q.due_at ? (late ? "overdue · " : "due ") + esc(dLabel(dayOf(q.due_at))) : "no date"}</span><span class="sp"></span><small class="mut">${esc(q.lead_email)}</small></div></div>`; }).join("")}</div></section>` : ""; }
function viewTodos(list) { return `${promsHtml()}<div class="sd-tools" id="sd-tools">${toolsHtml(list)}</div><div class="sd-board${TVIEW === "founder" ? " lanes" : ""}" id="sd-board">${boardHtml(list)}</div>`; }
function renderTodos() {
  const bd = $("#sd-board"); if (PAGE !== "todos" || !CACHE.todos || !bd) return;
  const sx = bd.scrollLeft, openD = new Set($$("details.sd-done[open]", bd).map(x => x.closest("[data-lane]").dataset.lane));
  bd.classList.toggle("lanes", TVIEW === "founder"); bd.innerHTML = boardHtml(CACHE.todos); bd.scrollLeft = sx; $("#sd-tools").innerHTML = toolsHtml(CACHE.todos);
  $$("details.sd-done", bd).forEach(x => { if (openD.has(x.closest("[data-lane]").dataset.lane)) x.open = true; });
  const f = $(".sd-form textarea", bd); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
  todoBadge();
}
function posBetween(list, col, idx, skipId) { const cs = cardsIn(list, col).filter(c => c.id !== skipId), a = cs[idx - 1], b = cs[idx]; return a && b ? (a.pos + b.pos) / 2 : a ? a.pos + 1024 : b ? b.pos - 1024 : 1024; }
async function saveCard(id, patch) {
  const c = CACHE.todos.find(x => x.id === id), before = { ...c };
  Object.assign(c, patch); renderTodos();
  try { await must(sb().from("todo_cards").update(patch).eq("id", id)); } catch (e) { Object.assign(c, before); renderTodos(); toast("Couldn't save that card. Check your connection."); }
}
const moveCard = (id, col, idx) => saveCard(id, { col, pos: posBetween(CACHE.todos, col, idx, id) });
function dropCard(id, col, owner, prevId, nextId) {   // position from the neighbours in the zone it was dropped into (works in both views)
  const L = CACHE.todos, a = L.find(x => x.id === prevId), b = L.find(x => x.id === nextId), pos = a && b ? (a.pos + b.pos) / 2 : a ? a.pos + 1024 : b ? b.pos - 1024 : posBetween(L, col, 0, id);
  return saveCard(id, { col, pos, ...(owner ? { owner } : {}) });
}
function wireBoard() {
  const board = $("#sd-board"); if (!board) return;
  board.addEventListener("click", async ev => {
    const t = ev.target.closest("button"); if (!t) return;
    const card = t.closest("[data-card]"), id = card ? +card.dataset.card : null, list = CACHE.todos;
    if (t.dataset.add) { EDIT = { id: "new", col: t.dataset.add, owner: t.dataset.owner || "" }; renderTodos(); return; }
    if (t.dataset.own) { $$("[data-own]", t.parentElement).forEach(b => { b.classList.toggle("on", b === t); b.setAttribute("aria-pressed", b === t); }); return; }
    if (t.hasAttribute("data-cancel")) { EDIT = null; renderTodos(); return; }
    if (t.hasAttribute("data-del")) {
      const fid = +t.closest("[data-form]").dataset.form, c = list.find(x => x.id === fid);
      if (!c || !confirm(`Delete "${c.title}"?`)) return;
      EDIT = null; CACHE.todos = list.filter(x => x.id !== fid); renderTodos();
      try { await must(sb().from("todo_cards").delete().eq("id", fid)); } catch (e) { CACHE.todos = list; renderTodos(); toast("Couldn't delete that card."); }
      return;
    }
    if (id && t.hasAttribute("data-ed")) { EDIT = { id, col: list.find(x => x.id === id).col }; renderTodos(); return; }
    if (id && t.dataset.mv) { const c = list.find(x => x.id === id), i = COLS.findIndex(x => x[0] === c.col) + +t.dataset.mv; if (COLS[i]) await moveCard(id, COLS[i][0], 0); }
  });
  board.addEventListener("submit", async ev => {
    ev.preventDefault();
    const f = ev.target, title = f.title.value.trim(), detail = f.detail.value.trim() || null, owner = $("[data-own].on", f)?.dataset.own || "Both", due = f.due.value || null;
    if (!title) { f.title.focus(); return; }
    if (f.dataset.form === "new") {
      const col = f.dataset.col, row = { title, detail, owner, due, col, pos: posBetween(CACHE.todos, col, 0), created_by: (ME && ME.name) || null };
      EDIT = null;
      try { const ins = await must(sb().from("todo_cards").insert(row).select().single()); CACHE.todos.push(ins); renderTodos(); } catch (e) { renderTodos(); toast("Couldn't add that card. Check your connection."); }
    } else { EDIT = null; await saveCard(+f.dataset.form, { title, detail, owner, due }); }
  });
  board.addEventListener("keydown", ev => {
    if (ev.target.matches("textarea") && ev.key === "Enter" && (ev.metaKey || ev.ctrlKey || (ev.target.name === "title" && !ev.shiftKey))) { ev.preventDefault(); ev.target.form.requestSubmit(); return; }
    const card = ev.target.closest("[data-card]"); if (!card || ev.target !== card) return;
    const id = +card.dataset.card, c = CACHE.todos.find(x => x.id === id);
    if (ev.key === "Enter") { ev.preventDefault(); EDIT = { id, col: c.col }; renderTodos(); return; }
    if (!ev.altKey) return;
    if (TVIEW === "founder" && (ev.key === "ArrowLeft" || ev.key === "ArrowRight")) { const oi = OWNERS.indexOf(c.owner) + (ev.key === "ArrowRight" ? 1 : -1); if (OWNERS[oi]) { ev.preventDefault(); saveCard(id, { owner: OWNERS[oi] }).then(() => $(`[data-card="${id}"]`)?.focus()); } return; }
    const cs = cardsIn(CACHE.todos, c.col), i = cs.findIndex(x => x.id === id), ci = COLS.findIndex(x => x[0] === c.col);
    let col = c.col, idx = null;
    if (ev.key === "ArrowLeft" && ci > 0) { col = COLS[ci - 1][0]; idx = 0; }
    else if (ev.key === "ArrowRight" && ci < 2) { col = COLS[ci + 1][0]; idx = 0; }
    else if (ev.key === "ArrowUp" && i > 0) idx = i - 1;
    else if (ev.key === "ArrowDown" && i < cs.length - 1) idx = i + 2;
    if (idx == null) return;
    ev.preventDefault(); moveCard(id, col, idx).then(() => $(`[data-card="${id}"]`)?.focus());
  });
  board.addEventListener("pointerdown", dragStart);
  $("#sd-tools").addEventListener("click", ev => { const b = ev.target.closest("button"); if (!b) return;
    if (b.dataset.tv) { TVIEW = b.dataset.tv; store.set(K_TV, TVIEW); EDIT = null; renderTodos(); } else if (b.dataset.of) { OWNF = b.dataset.of; renderTodos(); } });
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
  D.on = true; $$("details.sd-done").forEach(x => { x.open = true; });
  D.lift = D.card.cloneNode(true); D.lift.classList.add("lift"); D.lift.removeAttribute("data-card"); D.lift.removeAttribute("tabindex"); D.lift.setAttribute("aria-hidden", "true");
  D.lift.style.setProperty("--w", D.w + "px"); document.body.append(D.lift);
  D.ph = document.createElement("div"); D.ph.className = "sd-ph"; D.ph.style.setProperty("--h", D.h + "px");
  D.card.after(D.ph); D.card.hidden = true;
}
function place(D, x, y) {
  D.lift.style.setProperty("--x", x - D.dx + "px"); D.lift.style.setProperty("--y", y - D.dy + "px");
  const cols = $$(".sd-col").filter(c => c.offsetParent), hit = (c, up, down) => { const b = c.getBoundingClientRect(); return x >= b.left && x <= b.right && y >= b.top - up && y <= b.bottom + down; },
    col = cols.find(c => hit(c, 0, 0)) || cols.find(c => hit(c, 24, 24)) || cols.find(c => hit(c, 40, 120));
  cols.forEach(c => c.classList.toggle("drop", c === col));
  if (col) {
    const others = $$("[data-card]:not([hidden])", col), next = others.find(el => { const b = el.getBoundingClientRect(); return y < b.top + b.height / 2; });
    next ? next.before(D.ph) : col.append(D.ph);
    D.col = col.dataset.col; D.idx = next ? others.indexOf(next) : others.length; D.owner = col.dataset.owner || null;
    const i = next ? others.indexOf(next) : others.length; D.nextId = next ? +next.dataset.card : null; D.prevId = others[i - 1] ? +others[i - 1].dataset.card : null;
  }
  if (y < 60) scrollBy(0, -14); else if (y > innerHeight - 60) scrollBy(0, 14);   // auto-scroll near the edges
  const bd = $("#sd-board"); if (bd) { const bb = bd.getBoundingClientRect(); if (x < bb.left + 30) bd.scrollLeft -= 14; else if (x > bb.right - 30) bd.scrollLeft += 14; }
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
  DRAG = null; return D;
}
function dragEnd(ev) {
  if (!DRAG || (ev.pointerId !== undefined && ev.pointerId !== DRAG.pid)) return;
  const D = cleanup(); if (!D.on) return;
  D.lift.remove(); D.ph.remove(); D.card.hidden = false;
  $$(".sd-col").forEach(c => c.classList.remove("drop"));
  if (ev.type === "pointercancel" || !D.col) return renderTodos();
  dropCard(D.id, D.col, D.owner, D.prevId, D.nextId);
}
document.addEventListener("touchmove", ev => { if (DRAG && DRAG.on) ev.preventDefault(); }, { passive: false });
document.addEventListener("contextmenu", ev => { if (DRAG && ev.target.closest && ev.target.closest(".sd-card")) ev.preventDefault(); });

/* live updates from the other founder (board + the menu badge) */
let RT_T = null;
function startRealtime() {
  if (CH || !sb()) return;
  CH = sb().channel("side-todos").on("postgres_changes", { event: "*", schema: "public", table: "todo_cards" }, () => {
    clearTimeout(RT_T); RT_T = setTimeout(async () => {
      todoBadge();
      if (DRAG || EDIT || PAGE !== "todos") return;
      try { CACHE.todos = await all("todo_cards", "*", q => q.order("pos").order("id")); renderTodos(); } catch {}
    }, 400);
  }).subscribe();
}
function stopRealtime() { if (CH) { try { sb().removeChannel(CH); } catch {} CH = null; } }

/* start last, once every function and table above exists */
new MutationObserver(syncApp).observe(APP, { attributes: true, attributeFilter: ["hidden"] });
syncApp();
})();
