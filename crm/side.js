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
const PAGES = { dashboard: "Dashboard", expenses: "Expenses", email: "Email tests", clients: "Clients", weekly: "Weekly analysis", todos: "To-dos" };
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
  if (p !== "clients") u.searchParams.delete("c"); if (p !== "expenses") u.searchParams.delete("m");
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
const LOAD = { expenses: loadExpenses, email: loadEmail, clients: loadClients, weekly: loadWeekly, todos: loadTodos };
const VIEW = { expenses: viewExpenses, email: viewEmail, clients: viewClients, weekly: viewWeekly, todos: viewTodos };
const HEAD = {
  expenses: ["Expenses <em class=\"sf\">&amp; profit</em>", "Tick what's paid this month and see the profit that's left."],
  email: ["Email <em class=\"sf\">tests</em>", "Which variant wins in each campaign, and whether the change has been made."],
  clients: ["Clients <em class=\"sf\">&amp; videos</em>", "Everyone who paid or got videos from us, and every video we delivered."],
  weekly: ["Weekly <em class=\"sf\">analysis</em>", "What worked, what we changed and what performed best: this week against last week."],
  todos: ["To-<em class=\"sf\">dos</em>", "The founders' board. Drag cards between columns; both of you see changes live."],
};
function srcOf(p, d) {
  if (p === "expenses") return d ? ["Beju Finance sheet + Stripe", d.updated_at] : null;
  if (p === "email") return d && d.ab ? ["Instantly API", d.ab.updated_at] : null;
  if (p === "clients") return d ? ["Drive delivery index + Stripe", d.synced] : null;
  if (p === "weekly") return d ? ["Instantly API, Stripe, Samples tab, CRM", d.synced] : null;
  if (p === "todos") return ["Live board", null];
  return null;
}
function header(p, d) {
  const [h, sub] = HEAD[p], s = srcOf(p, d), old = s && s[1] && Date.now() - new Date(s[1]) > 3 * 36e5;
  return `<header class="sp-h"><div><h1>${h}</h1><p>${esc(sub)}</p></div>${s ? `<span class="sp-src${old ? " old" : ""}"><i></i>${esc(s[0])}${s[1] ? ` · synced ${esc(ago(s[1]))}` : " · live"}</span>` : ""}</header>`;
}
async function renderPage(quiet) {
  const p = PAGE; if (p === "dashboard" || !sb()) return;
  const seq = ++SEQ;
  if (!quiet || !CACHE[p]) PAGE_EL.innerHTML = `${header(p, null)}<div class="sp-sk" aria-label="Loading"><i></i><i></i><i></i></div>`;
  try {
    const d = CACHE[p] || (CACHE[p] = await LOAD[p]());
    if (seq !== SEQ || p !== PAGE) return;
    PAGE_EL.innerHTML = header(p, d) + VIEW[p](d);
    applyVars(PAGE_EL); if (p === "todos") wireBoard(); if (p === "clients") wireClients(); if (p === "weekly") wireWeekly(); if (p === "expenses") wireExpenses(); if (p === "email") wireEmail(); countUps(PAGE_EL);
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
function viewEmail(x) {
  const d = x.ab && x.ab.data, M = x.m && x.m.data, acts = x.acts || [];
  if (!d || !Array.isArray(d.campaigns)) return empty("No A/B data yet. It arrives with the next sync (hourly).");
  const r = d.rules || {}, MIN = r.min_sends || 300, tests = d.campaigns.flatMap(c => (c.steps || []).map(s => ({ c, s, st: abStatus(c, s, acts) })));
  const running = tests.filter(t => t.c.since && t.s.B.sent > 0).length, waiting = tests.filter(t => t.c.since && !t.s.B.sent).length;
  const vcard = (c, s, v) => { const o = s[v], lead = s.lead === v && s.state !== "too_early", win = s.lead === v && s.state === "winner", ahead = s.lead === v && s.margin_pts != null;
    return `<div class="ab-v${win ? " win" : lead ? " lead" : ""}"><div class="ab-vh"><span class="sp-tag">${v}</span><span>${v === "A" ? "Line-first" : "Question-first"}</span>${win ? `<em class="ab-badge w">Winner${s.margin_pts != null ? ` · +${s.margin_pts.toFixed(1)} pts` : ""}</em>` : lead ? `<em class="ab-badge">Leading${s.margin_pts != null ? ` · +${s.margin_pts.toFixed(1)} pts` : ""}</em>` : ahead && s.state === "too_early" ? `<em class="ab-badge e">ahead, too early</em>` : ""}</div>
      <b>${o.pos_rate == null ? "—" : o.pos_rate.toFixed(1) + "%"}</b><small>${o.sent ? `${int(o.positives)} positive of ${int(o.sent)} sent · ${int(o.replies)} replies` : "nothing sent yet"}</small>
      <div class="ab-prog" title="${int(o.sent)} of ${MIN} sends needed"><i data-v="w:${Math.min(100, Math.round(100 * o.sent / MIN))}%"></i></div><span class="ab-pn">${int(Math.min(o.sent, MIN))} / ${MIN} sends${o.sent >= MIN ? " ✓" : ""}</span></div>`; };
  const test = (c, s) => { const st = abStatus(c, s, acts), stateTxt = s.state === "winner" ? "Winner found" : s.state === "leading" ? `Leading, not yet certain (${Math.round(100 * (s.lead === "B" ? s.p_b : 1 - s.p_b))}% likely)` : !s.B.sent ? "B hasn't sent yet" : "Too early";
    return `<div class="ab-test" data-ab="${esc(c.key)}|${esc(s.step)}"><div class="ab-th"><b>${esc(s.step)}</b><span class="chip${s.state === "winner" ? " g" : s.state === "leading" ? " b" : ""}">${esc(stateTxt)}</span></div>
      <div class="ab-pair">${vcard(c, s, "A")}${vcard(c, s, "B")}</div>
      <div class="ab-st"><span class="${st.chip}">${st.k === "done" ? "Change done" : st.k === "due" ? "Change due" : "No change yet"}</span><span class="grow">${esc(st.text)}</span>${st.k === "due" ? `<button type="button" class="act go" data-abdone="${esc(c.key)}|${esc(s.step)}">${ic("check")}Mark change done</button>` : st.k === "done" ? `<button type="button" class="act" data-abundo="${st.a.id}">Undo</button>` : `<button type="button" class="act" data-abdone="${esc(c.key)}|${esc(s.step)}" title="Use this if you swapped a variant by hand before a winner was called">Log a change</button>`}</div></div>`; };
  const smp = c => c.sample ? `<details class="ab-txt"><summary>What A and B say <small>one real lead's emails</small></summary><div class="ab-pair">${["A", "B"].map(v => `<div class="ab-copy"><span class="sp-tag">${v}</span><b>${esc(c.sample[v].subject || "(no subject)")}</b><p>${esc(c.sample[v].body || "")}</p><small>Follow-up: ${esc((c.sample[v].fu || "").slice(0, 260))}</small></div>`).join("")}</div></details>` : "";
  const camps = M && Array.isArray(M.campaigns) ? M.campaigns.filter(c => c.contacted >= 30) : [], rmx = Math.max(1, ...camps.map(c => c.reply_rate || 0));
  const part = x.arms && x.arms.data ? (x.arms.data.arms || []).filter(a => (a.campaigns || []).some(n => /PARTNER/i.test(n))) : null, pmx = part ? Math.max(1, ...part.map(a => a.reply_rate || 0)) : 1;
  const done = acts.filter(a => a.done_at);
  return `<div class="sp-kpis">${kpi("Tests running", cu(running, "int", "ab-run"), waiting ? `${waiting} more waiting for B's first sends` : "A and B both sending")}${kpi("Winners found", cu(tests.filter(t => t.s.state === "winner").length, "int", "ab-win"), `needs ${MIN}+ sends per side and ${r.min_pos || 8}+ positives`)}${kpi("Changes due", cu(tests.filter(t => t.st.k === "due").length, "int", "ab-due"), "loser to drop, new challenger to write")}${kpi("Changes done", cu(done.length, "int", "ab-done"), done[0] ? `last ${esc(dLabel(dayOf(done[0].done_at)))}` : "none yet")}</div>
  <div class="ab-grid">${d.campaigns.map(c => `<section class="card sp-card ab-card"><h2>${esc(c.name)} <small>${c.since ? `B live since ${esc(dLabel(c.since))}` : "no B"}</small></h2>${(c.steps || []).map(s => test(c, s)).join("")}${smp(c)}</section>`).join("")}</div>
  <section class="card sp-card"><h2>Partner campaigns <small>arms are tags, not Instantly variants</small></h2>${part && part.length ? `<div class="sp-bars">${part.map(a => `<div class="sp-bar"><span>${esc(a.arm)} <small class="mut">${esc((a.campaigns || []).filter(n => /PARTNER/i.test(n)).map(n => n.replace(/^PARTNER\s*/i, "")).join(", "))}</small></span><span class="v">${a.reply_rate == null ? "—" : a.reply_rate.toFixed(1) + "% replied"} · ${int(a.positive)} positive · ${int(a.contacted)} contacted</span><div class="bar"><i data-v="w:${Math.max(2, Math.round(100 * (a.reply_rate || 0) / pmx))}%"></i></div></div>`).join("")}</div><p class="sp-note">Too early for a winner: every partner arm is under 100 leads contacted.</p>` : empty("No data yet: no partner-campaign leads are tagged in the arms sync.")}</section>
  <section class="card sp-card"><h2>Reply rate by campaign <small>all time · Instantly API${x.m ? ` · synced ${esc(ago(x.m.updated_at))}` : ""}</small></h2>${camps.length ? `<div class="sp-bars">${camps.map(c => `<div class="sp-bar"><span>${esc(c.name.split(" —")[0])} <small class="mut">${esc(c.status_label || "")}</small></span><span class="v">${c.reply_rate == null ? "—" : c.reply_rate.toFixed(1) + "%"} replied · ${c.pos_rate == null ? "—" : c.pos_rate.toFixed(1) + "%"} positive</span><div class="bar"><i data-v="w:${Math.max(2, Math.round(100 * (c.reply_rate || 0) / rmx))}%"></i></div></div>`).join("")}</div>
    <details class="ab-txt"><summary>Details <small>table</small></summary><div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Campaign</th><th class="num">Sent</th><th class="num">Contacted</th><th class="num">Replies</th><th class="num">Reply rate</th><th class="num">Positive</th><th class="num">Positive rate</th><th class="num">Bounced</th><th>Opens</th></tr></thead><tbody>${M.campaigns.map(c => `<tr><td>${esc(c.name)}</td><td class="num">${int(c.sent)}</td><td class="num">${int(c.contacted)}</td><td class="num">${int(c.replies)}</td><td class="num">${c.reply_rate == null ? "—" : c.reply_rate.toFixed(1) + "%"}</td><td class="num">${int(c.opportunities)}</td><td class="num">${c.pos_rate == null ? "—" : c.pos_rate.toFixed(1) + "%"}</td><td class="num">${c.bounce_rate == null ? "—" : c.bounce_rate.toFixed(1) + "%"}</td><td class="mut">not tracked (plain text)</td></tr>`).join("")}</tbody></table></div></details>
    <p class="sp-note">Reply rate = unique human replies ÷ leads contacted. Opens aren't tracked: the emails are plain text with open tracking off. That doesn't affect reply rate.</p>` : empty("No data yet.")}</section>
  <section class="card sp-card"><h2>Past changes <small>history</small></h2>${done.length ? `<div class="wk-log">${done.map(a => `<div class="wk-ch"><span class="mono">${esc(dLabel(dayOf(a.done_at)))}</span><span class="chip g">${esc(a.campaign)}</span><span class="w">${esc(a.step)}: ${esc(a.action || `kept ${a.winner || "?"}, dropped ${a.loser || "?"}`)}${a.note ? ` · ${esc(a.note)}` : ""}</span><span class="mut">${esc(a.done_by || "")}</span></div>`).join("")}</div>` : empty("No test has been decided yet. B went live on Nov 19; the first verdicts come once each side has 300 sends.")}</section>`;
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
  const [clients, deliveries, payments, retainers, st, notes, m, proms, scs] = await Promise.all([
    all("clients", "id,name,emails,show,drive_folder,source"),
    all("deliveries", "id,client_id,title,order_name,kind,duration_s,link,delivered_at", q => q.order("delivered_at", { ascending: false }).order("id")),
    all("payments", "client_id,amount,refunded,paid_at"),
    all("retainers", "id,email,name,amount,interval,status,started_at,current_period_end").catch(() => []),
    all("sync_status", "name,ran_at").catch(() => []),
    all("client_notes", "lead_email,kind,note,noted_at,created_at", q => q.eq("kind", "priority")).catch(() => []),
    panel("metrics").catch(() => null),
    all("promises", "lead_email,promise,owner,due_at,status", q => q.eq("status", "open")).catch(() => []),
    all("scopes", "slug,client,email,url,status").catch(() => []),
  ]);
  const t = dayOf(Date.now()), plans = (m && m.data && m.data.retainer_plans) || {};
  const vids = {}, paid = {}, nPay = {}, lastPay = {};
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
    const cat = gone ? "past" : r ? "retainer" : (lastAct && lastAct < addDays(t, -60)) ? "past" : "pack";
    const pr = proms.filter(q => es.includes(lc(q.lead_email))).sort((a, b) => String(a.due_at).localeCompare(String(b.due_at))), sc = scs.find(q => q.email && es.includes(lc(q.email))) || null, att = [];
    if (plan) { plan.daysLeft = Math.ceil((new Date(r.current_period_end) - Date.now()) / 864e5); const len = Math.max(1, (new Date(r.current_period_end) - new Date(plan.start + "T00:00:00Z")) / 864e5), frac = Math.min(1, Math.max(0, 1 - plan.daysLeft / len));
      plan.expected = plan.shorts ? Math.round(plan.shorts * frac) : null;
      if (plan.daysLeft <= 5) att.push(["o", `renews in ${plan.daysLeft} day${plan.daysLeft === 1 ? "" : "s"}`]);
      if (plan.shorts && plan.done < plan.expected - Math.max(2, plan.shorts * .15)) att.push(["r", `behind: ${plan.done} delivered, about ${plan.expected} expected by now`]); }
    pr.filter(q => q.due_at && new Date(q.due_at) < new Date()).forEach(q => att.push(["r", `promise overdue: ${String(q.promise).slice(0, 70)}`]));
    return { ...c, vids: vs, paid: paid[c.id] || 0, nPay: nPay[c.id] || 0, last, ret: r, plan, gone, cat, today: vs.filter(v => v.delivered_at === t).length, proms: pr, scope: sc, att };
  }).filter(c => c.vids.length || c.paid || c.ret);
  const by = k => list.filter(c => c.cat === k);
  const groups = [["retainer", "Monthly retainer", by("retainer").sort((a, b) => b.ret.amount - a.ret.amount)],
    ["pack", "Pack clients", by("pack").sort((a, b) => (b.nPay > 1) - (a.nPay > 1) || (b.last || "").localeCompare(a.last || "") || b.paid - a.paid)],
    ["past", "Past / parted ways", by("past").sort((a, b) => (b.last || "").localeCompare(a.last || ""))]];
  const ds = st.find(x => x.name === "deliveries");
  return { list, groups, t, synced: ds ? ds.ran_at : null, lastDelivery: deliveries.reduce((x, v) => v.delivered_at > x ? v.delivered_at : x, ""), todayN: list.reduce((s, c) => s + c.today, 0), todayC: list.filter(c => c.today).length };
}
const fdur = s => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "";
function clientDetail(c, t) {
  if (!c) return empty("Pick a client on the left.");
  const days = {}; c.vids.forEach(v => (days[v.delivered_at || ""] = days[v.delivered_at || ""] || []).push(v));
  const keys = Object.keys(days).sort().reverse();
  return `<div class="cl-head"><div><h2>${esc(c.name || "Client")}</h2><p>${esc([c.show, (c.emails || [])[0], c.last ? `last video ${dLabel(c.last)}` : "no videos yet"].filter(Boolean).join(" · "))}</p></div>
    <div class="cl-chips">${c.today ? `<span class="chip g">${c.today} today</span>` : ""}${c.plan ? `<span class="chip g">${esc(c.plan.text)}</span>` : ""}<span class="chip">${int(c.vids.length)} video${c.vids.length === 1 ? "" : "s"}</span>${c.paid ? `<span class="chip b">${usd(c.paid)} paid${c.nPay > 1 ? ` · ${c.nPay} payments` : ""}</span>` : ""}${c.gone ? `<span class="chip">parted ways</span>` : ""}${c.scope && c.scope.url ? `<a class="chip lkc" href="${esc(c.scope.url)}" target="_blank" rel="noopener noreferrer">Scope ↗</a>` : ""}</div></div>
    ${c.att.length ? `<div class="sp-alerts cl-al">${c.att.map(a => `<div class="sp-alert ${a[0] === "r" ? "red" : "amber"}"><i></i><span>${esc(a[1])}</span></div>`).join("")}</div>` : ""}
    ${c.proms.length ? `<div class="cl-plan"><b class="cl-ph">Promised to this client</b>${c.proms.map(q => `<div class="cl-pr"><span class="grow">${esc(q.promise)}</span><span class="chip${q.due_at && new Date(q.due_at) < new Date() ? " r" : ""}">${q.due_at ? "due " + esc(dLabel(dayOf(q.due_at))) : "no date"}</span></div>`).join("")}</div>` : ""}
    ${c.plan ? `<div class="cl-plan"><div class="sp-bar"><span>Delivered this billing month <small class="mut">since ${esc(dLabel(c.plan.start))} · renews ${esc(dLabel(c.plan.renews))} (${c.plan.daysLeft} days left)${c.plan.expected != null ? ` · about ${c.plan.expected} expected by now` : ""}</small></span><span class="v">${c.plan.done}${c.plan.shorts ? ` / ${c.plan.shorts}` : ""}</span><div class="bar c-green"><i data-v="w:${c.plan.shorts ? Math.min(100, Math.max(2, Math.round(100 * c.plan.done / c.plan.shorts))) : 100}%"></i></div></div><p class="sp-note">Counts each Short once (new versions of the same Short don't add up), from the files in Drive.</p></div>` : ""}
    ${keys.map(k => `<div class="cl-ord${k === t ? " today" : ""}">${k === t ? "Today · " : ""}${esc(dLabel(k))} · ${days[k].length}</div><div class="vid-grid">${days[k].map(v => `<a class="vid${k === t ? " today" : ""}" href="${esc(v.link)}" target="_blank" rel="noopener noreferrer" title="Open in Drive"><span class="pl">${ic("play")}${k === t ? `<em class="vt">Today</em>` : ""}</span><b>${esc(v.title || "Video")}</b><small>${esc(fdur(v.duration_s))}${v.duration_s ? " · " : ""}<span class="vo">${esc(v.order_name || "")}</span></small></a>`).join("")}</div>`).join("") || empty("No videos for this client in the delivery index yet.")}`;
}
let CL_TODAY = false;
function clientRow(c, sel) {
  const sub = c.plan ? `${c.plan.text}${c.plan.shorts ? ` · ${c.plan.done} / ${c.plan.shorts} this month` : ""}` : c.last ? `last video ${dLabel(c.last)}${c.nPay > 1 ? ` · ${c.nPay} payments` : ""}` : c.paid ? `${usd(c.paid)} paid` : "";
  return `<a class="cl-item" href="?p=clients&amp;c=${esc(c.id)}" data-cl="${esc(c.id)}" data-today="${c.today}" data-q="${esc(lc([c.name, c.show, ...(c.emails || [])].join(" ")))}"${sel && c.id === sel.id ? ' aria-current="true"' : ""}><span class="av">${esc(initials(c.name))}</span><span class="grow"><span class="t">${esc(c.name || "Client")}</span><span class="s">${esc(sub)}</span></span>${c.today ? `<span class="chip g">${c.today} today</span>` : ""}<span class="n">${int(c.vids.length)}</span></a>`;
}
function viewClients(d) {
  if (!d.list.length) return empty("No clients with videos or payments yet.");
  const sel = d.list.find(c => c.id === param("c")) || (d.groups.find(g => g[2].length) || [0, 0, []])[2][0], n = d.list.reduce((s, c) => s + c.vids.length, 0);
  return `<div class="sp-kpis">${kpi("Delivered today", int(d.todayN), d.todayN ? `${d.todayC} client${d.todayC === 1 ? "" : "s"} · ${esc(dLabel(d.t))}` : "nothing yet today")}${kpi("On a monthly retainer", int(d.groups[0][2].length), usd(d.groups[0][2].reduce((s, c) => s + (+c.ret.amount || 0), 0)) + " a month")}${kpi("Clients", int(d.list.length), "paid or got videos")}${kpi("Videos delivered", int(n), `newest ${esc(dLabel(d.lastDelivery))}`)}</div>
  ${d.list.some(c => c.att.length) ? `<section class="card sp-card"><h2>Needs attention <small>${d.list.filter(c => c.att.length).length} client${d.list.filter(c => c.att.length).length === 1 ? "" : "s"}</small></h2><div class="sp-alerts">${d.list.filter(c => c.att.length).flatMap(c => c.att.map(a => `<a class="sp-alert ${a[0] === "r" ? "red" : "amber"} cl-go" href="?p=clients&amp;c=${esc(c.id)}" data-cl-go="${esc(c.id)}"><i></i><span><b>${esc(c.name)}</b> · ${esc(a[1])}</span></a>`)).join("")}</div></section>` : ""}
  <div class="cl-wrap"><section class="card sp-card"><div class="cl-tools"><input class="cl-q" id="cl-q" type="search" placeholder="Find a client" aria-label="Find a client" autocomplete="off" spellcheck="false"><button type="button" class="chip${CL_TODAY ? " g" : ""}" id="cl-today" aria-pressed="${CL_TODAY}" title="Show only clients who got videos today">Delivered today · ${d.todayC}</button></div>
    <div class="cl-list" id="cl-list">${d.groups.map(([k, label, cs]) => cs.length ? `<div class="cl-grp" data-grp="${k}"><span>${label}</span><span class="chip">${cs.length}</span></div>${cs.map(c => clientRow(c, sel)).join("")}` : "").join("")}</div></section>
    <section class="card sp-card" id="cl-detail">${clientDetail(sel, d.t)}</section></div>`;
}
function filterClients() {
  const q = lc($("#cl-q")?.value || "");
  $$("#cl-list [data-q]").forEach(el => { el.hidden = (!!q && !el.dataset.q.includes(q)) || (CL_TODAY && el.dataset.today === "0"); });
  $$("#cl-list .cl-grp").forEach(g => { let n = g.nextElementSibling, any = false; while (n && !n.classList.contains("cl-grp")) { if (!n.hidden) any = true; n = n.nextElementSibling; } g.hidden = !any; });
}
function wireClients() {
  $$("[data-cl-go]", PAGE_EL).forEach(a => a.addEventListener("click", ev => { if (ev.metaKey || ev.ctrlKey) return; ev.preventDefault(); $(`#cl-list [data-cl="${CSS.escape(a.dataset.clGo)}"]`)?.click(); $("#cl-detail").scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" }); }));
  $("#cl-q")?.addEventListener("input", filterClients);
  $("#cl-today")?.addEventListener("click", ev => { CL_TODAY = !CL_TODAY; ev.currentTarget.classList.toggle("g", CL_TODAY); ev.currentTarget.setAttribute("aria-pressed", CL_TODAY); filterClients(); });
  filterClients();
  $("#cl-list")?.addEventListener("click", ev => {
    const a = ev.target.closest("[data-cl]"); if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey) return; ev.preventDefault();
    const c = CACHE.clients.list.find(x => x.id === a.dataset.cl); if (!c) return;
    $$("#cl-list [data-cl]").forEach(x => x.dataset.cl === c.id ? x.setAttribute("aria-current", "true") : x.removeAttribute("aria-current"));
    $("#cl-detail").innerHTML = clientDetail(c, CACHE.clients.t); applyVars($("#cl-detail")); history.replaceState({ p: "clients" }, "", `?p=clients&c=${encodeURIComponent(c.id)}`);
    if (innerWidth <= 900) $("#cl-detail").scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" });
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
  if (!abRows.some(c => (c.steps || []).some(s => s.B.sent))) missing.push("A/B tests: variant B went live 11-19 and has not sent yet, so there is nothing to compare.");
  /* headlines: biggest moves with enough volume */
  const H = [];
  funnel.forEach(f => { if (f.cur != null && f.prev != null && Math.max(f.cur, f.prev) >= 5 && f.prev > 0) { const r = (f.cur - f.prev) / f.prev; if (Math.abs(r) >= .15) H.push({ s: Math.abs(r) * Math.log10(10 + Math.max(f.cur, f.prev)), good: r > 0, text: `${f.label}: ${int(f.prev)} → ${int(f.cur)} (${r > 0 ? "+" : "−"}${Math.abs(Math.round(r * 100))}% vs the same ${k} days last week)` }); } });
  if (SC.sent) H.push({ s: 3, good: SC.paid > 0, text: `Scopes: ${SC.sent} sent → ${SC.paid} paid${sPaid.length ? ` (${sPaid.map(s => `${s.client.split(" (")[0]} ${usd(s.amount)}${s.monthly ? "/mo" : ""}`).join(", ")})` : ""}` });
  if (best) H.push({ s: 2, good: true, text: `Best campaign this week: ${best.name.split(" —")[0]} at ${best.week.pos_rate.toFixed(1)}% positive (${best.week.contacted} contacted)` });
  if (worst && worst !== best) H.push({ s: 1.5, good: false, text: `Weakest campaign: ${worst.name.split(" —")[0]} at ${worst.week.pos_rate.toFixed(1)}% positive (${worst.week.contacted} contacted)` });
  if (CL.mrrNew) H.push({ s: 2.5, good: true, text: `New monthly revenue: +${usd(CL.mrrNew)}/mo (${CL.newR.join(", ")}); MRR now ${usd(mrr)}` });
  if (HOT.retention != null && HOT.cohort >= 5) H.push({ s: 1.8, good: HOT.retention >= 50, text: `Hot-lead retention: ${HOT.retention}% of last week's ${HOT.cohort} hot leads are still alive or converted` });
  const heads = H.sort((a, b) => b.s - a.s).slice(0, 5);
  const D = { t, w0, k, funnel, camps, best: best && best.id, worst: worst && worst !== best ? worst.id : null, arms: arms && arms.data, armsAt: arms && arms.updated_at, snaps, ab: abRows, SC, HOT, CL, SA, trend, REV, changes, heads, missing, synced: m ? m.updated_at : null };
  D.export = { week_of: w0, days_so_far: k, compared_with: `same ${k} days last week`, headlines: heads.map(h => h.text), funnel: funnel.map(f => ({ step: f.label, this_week: f.cur, last_week_same_days: f.prev })),
    campaigns: camps.map(c => ({ name: c.name, this_week: c.week, last_week_same_days: c.prev_week })), arms: D.arms ? D.arms.arms : null, ab_tests: abRows.map(c => ({ campaign: c.name, since: c.since, steps: c.steps })),
    scopes: { sent: SC.sent, paid: SC.paid, median_hours_to_pay: SC.medH, revenue_this_week_usd: SC.rev, mrr_from_scopes_usd: SC.mrr, payments_without_scope_usd: SC.other, list: scopes.map(s => ({ client: s.client, offer: s.offer, amount: s.amount, monthly: s.monthly, sent_at: s.sent_at, paid_at: s.paid_at, status: s.status })) },
    hot: HOT, clients: CL, samples: SA, revenue_usd: REV, trend_8_weeks: trend.map(x => ({ week_of: x.w, positives: x.pos, payments: x.paid, revenue_usd: x.rev })), changes: changes.map(c => ({ day: c.day, area: c.area, what: c.what, who: c.who })), thin_or_missing: missing };
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
  const sec = (n, title, small, body, cls = "") => `<section class="card sp-card ${cls}"><h2><span><em class="wk-n">${n}</em>${title}</span>${small ? `<small>${small}</small>` : ""}</h2>${body}</section>`;
  const stat = (label, val, sub) => `<div class="wk-stat"><span>${esc(label)}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
  const H = d.HOT, C = d.CL, S = d.SA, SC = d.SC, rate = c => c && c.contacted ? c : null;
  const fmax = Math.max(1, ...d.funnel.map(f => Math.max(f.cur || 0, f.prev || 0)));
  const funnel = `<div class="wk-fun">${d.funnel.map((f, i) => { const pv = i ? d.funnel[i - 1] : null; return `<div class="wk-fr"><span class="l">${esc(f.label)}</span><span class="b"><i class="c" data-v="w:${f.cur ? Math.max(3, Math.round(Math.sqrt(f.cur / fmax) * 100)) : 0}%"></i><i class="p" data-v="w:${f.prev ? Math.max(3, Math.round(Math.sqrt(f.prev / fmax) * 100)) : 0}%"></i></span><b>${f.cur == null ? "—" : int(f.cur)}</b><span class="cv">${pv && pv.cur ? pp(f.cur || 0, pv.cur) + " of the step before" : ""}</span><span class="d">${dl(f.cur, f.prev)}</span></div>`; }).join("")}</div><p class="sp-note">Blue = this week so far, grey = the same ${d.k} day${d.k === 1 ? "" : "s"} last week. Bars use a square-root scale so small steps stay visible.</p>`;
  const campT = d.camps.length ? `<div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Campaign</th><th class="num">Sent</th><th class="num">Contacted</th><th class="num">Reply %</th><th class="num">vs last wk</th><th class="num">Positive %</th><th class="num">vs last wk</th></tr></thead><tbody>${d.camps.map(c => { const w = c.week, p = rate(c.prev_week), small = w.contacted < 100; return `<tr><td>${esc(c.name.split(" —")[0])}${c.id === d.best ? ` <span class="chip g">best</span>` : c.id === d.worst ? ` <span class="chip r">weakest</span>` : small ? ` <span class="chip">small sample</span>` : ""}</td><td class="num">${int(w.sent)}</td><td class="num">${int(w.contacted)}</td><td class="num">${w.reply_rate == null ? "—" : w.reply_rate.toFixed(1) + "%"}</td><td class="num">${p && p.reply_rate != null ? p.reply_rate.toFixed(1) + "%" : "—"}</td><td class="num">${w.pos_rate == null ? "—" : w.pos_rate.toFixed(1) + "%"}</td><td class="num">${p && p.pos_rate != null ? p.pos_rate.toFixed(1) + "%" : "—"}</td></tr>`; }).join("")}</tbody></table></div>` : empty("No data yet.");
  const A = d.arms && d.arms.arms ? d.arms.arms : null, aOk = A ? A.filter(a => a.contacted >= 100) : [], aBest = aOk.slice().sort((a, b) => b.pos_rate - a.pos_rate)[0], aWorst = aOk.length > 1 ? aOk.slice().sort((a, b) => a.pos_rate - b.pos_rate)[0] : null;
  const armT = A ? `<div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Source / arm</th><th class="num">Contacted</th><th class="num">Reply %</th><th class="num">Positive %</th><th class="num">Positives</th><th class="num">Last 14 d</th><th class="num">Positive % 14 d</th></tr></thead><tbody>${A.filter(a => a.contacted >= 30).map(a => `<tr><td>${esc(a.arm)}${a === aBest ? ` <span class="chip g">best</span>` : a === aWorst ? ` <span class="chip r">weakest</span>` : a.contacted < 100 ? ` <span class="chip">small sample</span>` : ""}<span class="sub">${esc((a.campaigns || []).join(", "))}</span></td><td class="num">${int(a.contacted)}</td><td class="num">${a.reply_rate == null ? "—" : a.reply_rate.toFixed(1) + "%"}</td><td class="num">${a.pos_rate == null ? "—" : a.pos_rate.toFixed(1) + "%"}</td><td class="num">${int(a.positive)}</td><td class="num">${int(a.contacted_14d)}</td><td class="num">${a.pos_rate_14d == null ? "—" : a.pos_rate_14d.toFixed(1) + "%"}</td></tr>`).join("")}</tbody></table></div><p class="sp-note">${A.filter(a => a.contacted < 30).length} arms with under 30 leads contacted are left out. Best and weakest need 100+ leads contacted. ${esc(d.arms.note || "")} Synced ${esc(ago(d.armsAt))}.</p>` : empty("No data yet: the arms sync runs hourly.");
  const abT = d.ab.length ? `<div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Campaign</th><th>Step</th><th class="num">A sent</th><th class="num">A positive %</th><th class="num">B sent</th><th class="num">B positive %</th><th>Leader</th></tr></thead><tbody>${d.ab.flatMap(c => (c.steps || []).map(s => `<tr><td>${esc(c.name)}</td><td>${esc(s.step)}</td><td class="num">${int(s.A.sent)}</td><td class="num">${s.A.pos_rate == null ? "—" : s.A.pos_rate.toFixed(1) + "%"}</td><td class="num">${int(s.B.sent)}</td><td class="num">${s.B.pos_rate == null ? "—" : s.B.pos_rate.toFixed(1) + "%"}</td><td>${/wins/.test(s.verdict) ? `<span class="chip g">${esc(s.verdict)}</span>` : `<span class="chip">${/hasn't/.test(s.verdict) ? "B hasn't sent yet" : "too early"}</span>`}</td></tr>`)).join("")}</tbody></table></div>` : empty("No data yet.");
  return `<div class="wk-tools"><span class="mut">Week of ${esc(dLabel(d.w0))} · day ${d.k} of 7 · compared with the same ${d.k} day${d.k === 1 ? "" : "s"} last week</span>${wkPick(d)}</div>
  ${sec(1, "What worked this week", "", d.heads.length ? `<div class="wk-heads">${d.heads.map(h => `<div class="wk-head ${h.good ? "g" : "r"}"><i></i><span>${esc(h.text)}</span></div>`).join("")}</div>` : empty("Not enough volume yet this week for a clear win or loss."), "wk-top")}
  <div class="sp-2">${sec(2, "Funnel", "this week vs last week", funnel)}
    <div class="sp-col">${sec("", "8-week trend", "positive replies", cols(d.trend, "pos", "c-green", int))}${sec("", "Paid", "payments per week", cols(d.trend, "paid", "c-blue", int) + `<div class="wk-stats two">${stat("Revenue this week", usd(d.REV.cur), dl(d.REV.cur, d.REV.prev, { f: usd }))}${stat("MRR", usd(C.mrr), C.mrrNew ? `<span class="sd-up">+${usd(C.mrrNew)}</span> new this week` : "no change this week")}</div>`)}</div></div>
  ${sec(3, "By campaign", "positive % this week · grey tick = same days last week", rank(d.camps.map(c => ({ name: c.name.split(" —")[0], v: c.week.pos_rate, pv: c.prev_week ? c.prev_week.pos_rate : null, n: c.week.contacted, sub: `${c.week.reply_rate == null ? "—" : c.week.reply_rate.toFixed(1) + "%"} replied`, tag: c.id === d.best ? "best" : c.id === d.worst ? "weakest" : c.week.contacted < 100 ? "small" : "" }))) + `<details class="ab-txt"><summary>Details <small>table</small></summary>${campT}</details><p class="sp-note">Reply % = unique human replies ÷ leads contacted. Positive % = Instantly opportunities ÷ leads contacted. Under 100 contacted is marked "small sample": don't over-read it.</p>`)}
  ${sec("", "By source / arm tag", "positive %, all time · 100+ leads contacted", (aOk.length ? rank(aOk.slice().sort((a, b) => b.pos_rate - a.pos_rate).slice(0, 10).map(a => ({ name: a.arm, v: a.pos_rate, pv: null, n: a.contacted, sub: `${a.reply_rate.toFixed(1)}% replied · ${int(a.positive)} positive`, tag: a === aBest ? "best" : a === aWorst ? "weakest" : "" }))) : empty("No data yet.")) + `<details class="ab-txt"><summary>Details <small>every arm, with the last 14 days</small></summary>${armT}</details>`)}
  ${sec(4, "A/B tests", "A = line-first, B = question-first", `<div class="wk-stats">${stat("Tests with B sending", int(d.ab.reduce((n, c) => n + (c.steps || []).filter(s => s.B.sent).length, 0)), `of ${d.ab.reduce((n, c) => n + (c.steps || []).length, 0)} set up`)}${stat("Winners", int(d.ab.reduce((n, c) => n + (c.steps || []).filter(s => s.state === "winner").length, 0)), "300+ sends per side needed")}</div><p class="sp-note"><a class="lk" href="?p=email" data-go="email">Open Email tests</a> for the winner cards and the change status.</p><details class="ab-txt"><summary>Details <small>table</small></summary>${abT}</details>`)}
  <div class="sp-2b">${sec(5, "Scopes", "since 11-18", `<div class="wk-stats">${stat("Sent", int(SC.sent))}${stat("Paid", int(SC.paid), SC.sent ? pp(SC.paid, SC.sent) + " of sent" : "")}${stat("Scope → paid", fmtH(SC.medH), "median")}${stat("From scopes, this week", usd(SC.rev), SC.mrr ? `${usd(SC.mrr)}/mo recurring` : "")}${stat("Payments without a scope", usd(SC.other), "this week")}</div>
      <div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Client</th><th>Offer</th><th>Sent</th><th>Status</th></tr></thead><tbody>${SC.rows.map(s => `<tr><td>${s.url ? `<a class="lk" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.client)}</a>` : esc(s.client)}</td><td>${esc(s.offer || "—")}${s.amount ? `<span class="sub">${usd(s.amount)}${s.monthly ? " / month" : ""}</span>` : ""}</td><td>${esc(dLabel(dayOf(s.sent_at)))}</td><td>${s.status === "paid" ? `<span class="chip g">paid ${esc(dLabel(dayOf(s.paid_at)))}</span>` : `<span class="chip o">${esc(s.status)}</span>`}</td></tr>`).join("") || `<tr><td colspan="4" class="mut">No scopes yet.</td></tr>`}</tbody></table></div>`)}
    ${sec(6, "Hot leads", "", `<div class="wk-stats">${stat("Hot + interested now", int(H.now), H.weekAgo == null ? "no data for a week ago yet" : dl(H.now, H.weekAgo))}${stat("Answered within 30 min", H.n ? pp(H.in30, H.n) : "—", H.n ? `${H.in30} of ${H.n} replies this week` : "no replies from hot leads yet")}${stat("Within 2 h", H.n ? pp(H.in2h, H.n) : "—", H.n ? `median ${fmtH(H.med == null ? null : H.med / 60)}` : "")}${stat("Overdue follow-ups", int(H.fuOver), "")}${stat("Hot-lead retention", H.retention == null ? "—" : H.retention + "%", H.cohort ? `of last week's ${H.cohort} new hot leads` : "no hot leads last week")}</div>
      ${H.cohort ? `<div class="sp-bars">${[["Paid", H.paid, "c-green"], ["Moved forward (sample / price)", H.forward, "c-green"], ["Still talking", H.alive, ""], ["Went quiet (5+ days)", H.quiet, "c-orange"], ["Lost", H.lost, "c-red"]].map(([l, v, c]) => barRow(l, int(v), v / H.cohort, c)).join("")}</div>` : ""}`)}</div>
  <div class="sp-2b">${sec(7, "Clients & retention", "", `<div class="wk-stats">${stat("MRR", usd(C.mrr), C.mrrNew ? `<span class="sd-up">+${usd(C.mrrNew)}</span> this week` : "no change")}${stat("New retainers", int(C.newR.length), esc(C.newR.join(", ")))}${stat("Churned", int(C.churned.length), esc(C.churned.join(", ")))}${stat("Repeat buyers this week", int(C.repeat.length), esc(C.repeat.slice(0, 4).join(", ")))}${stat("Videos delivered", int(C.vids.cur), dl(C.vids.cur, C.vids.prev))}${stat("Open promises", int(C.promOpen), C.promLate ? `<span class="sd-dn">${C.promLate} overdue</span>` : "none overdue")}</div>
      <p class="sp-note">Next renewals: ${C.renew.map(r => `${esc(r.name)} ${esc(dLabel(r.day))} (${usd(r.amount)})`).join(" · ") || "none"}</p>`)}
    ${sec(8, "Samples", "", `<div class="wk-stats">${stat("Yes → delivered", fmtH(S.medCur), S.nCur ? `median of ${S.nCur} this week · last week ${fmtH(S.medPrev)}` : "none delivered this week")}${stat("Delivered → replied", S.replyN ? pp(S.replied, S.replyN) : "—", S.replyN ? `${S.replied} of ${S.replyN} (delivered 2–14 days ago)` : "")}${stat("Sample → paid", S.del ? pp(S.paid, S.del) : "—", `${S.paid} of ${S.del} all time`)}${stat("Lost this week", int(S.lost.length), "")}</div>
      ${S.lost.length ? `<div class="wk-lost">${S.lost.map(l => `<div><b>${esc(l.name)}</b><span class="mut">${esc(l.why || "no reason noted")}</span></div>`).join("")}</div>` : ""}`)}</div>
  ${sec(9, "What we changed", "tie results to changes", `<form class="wk-add" id="wk-add"><input name="day" type="date" value="${esc(d.t)}" aria-label="Date" required><select name="area" aria-label="Area">${["copy", "offer", "pricing", "leads", "campaigns", "replies", "sales", "editing", "clients", "process"].map(a => `<option>${a}</option>`).join("")}</select><input name="what" type="text" maxlength="600" placeholder="What changed? (one line)" aria-label="What changed" required><button type="submit" class="act go">${ic("plus")}Add</button></form>
    <div class="wk-log" id="wk-log">${logHtml(d.changes)}</div>`)}
  ${sec("", "Thin or missing data", "read before trusting a number", `<ul class="wk-miss">${d.missing.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`)}`;
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
