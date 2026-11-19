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
  if (p !== "clients") u.searchParams.delete("c");
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
  const was = PAGE; PAGE = p; EDIT = null;
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
const LOAD = { expenses: loadExpenses, email: async () => ({ ab: await panel("ab_tests"), m: await panel("metrics").catch(() => null) }), clients: loadClients, weekly: loadWeekly, todos: loadTodos };
const VIEW = { expenses: viewExpenses, email: viewEmail, clients: viewClients, weekly: viewWeekly, todos: viewTodos };
const HEAD = {
  expenses: ["Money <em class=\"sf\">&amp; expenses</em>", "What's in Stripe right now, what's coming up, and where the money went."],
  email: ["Email <em class=\"sf\">tests</em>", "Variant A against B per campaign, plus each campaign's real reply and positive rates."],
  clients: ["Clients <em class=\"sf\">&amp; videos</em>", "Everyone who paid or got videos from us, and every video we delivered."],
  weekly: ["Weekly <em class=\"sf\">analysis</em>", "What worked, what we changed and what performed best: this week against last week."],
  todos: ["To-<em class=\"sf\">dos</em>", "The founders' board. Drag cards between columns; both of you see changes live."],
};
function srcOf(p, d) {
  if (p === "expenses") return d ? ["Stripe API + Beju Finance sheet", d.updated_at] : null;
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
    applyVars(PAGE_EL); if (p === "todos") wireBoard(); if (p === "clients") wireClients(); if (p === "weekly") wireWeekly();
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

/* 1. expenses (SIMAS 11-19 15:3x: "we don't need every expense ... upcoming expenses, how much is in the Stripe balance right now") */
async function loadExpenses() {
  const [exp, fin, m] = await Promise.all([panel("expenses"), must(sb().from("finance_snapshot").select("data,updated_at").eq("id", "current").maybeSingle()).catch(() => null), panel("metrics").catch(() => null)]);
  return { exp, fin, m, updated_at: [exp, fin, m].filter(Boolean).map(x => x.updated_at).sort()[0] || null };
}
const money = (v, cur) => (cur === "EUR" ? "€" : cur === "USD" ? "$" : "") + nf2.format(+v || 0) + (cur && cur !== "EUR" && cur !== "USD" ? " " + cur : "");
const curList = o => Object.entries(o || {}).filter(([, v]) => v).map(([c, v]) => money(v, c)).join(" + ") || "$0.00";
function viewExpenses(x) {
  const d = x.exp && x.exp.data, F = x.fin && x.fin.data, S = x.m && x.m.data && x.m.data.stripe_now;
  if (!d && !F && !S) return empty("No money data yet. It arrives with the next sync.");
  const t = dayOf(Date.now()), mo = F && F.month && F.month.this, bills = ((F && F.bills) || []).slice().sort((a, b) => String(a.due).localeCompare(String(b.due)));
  const in30 = bills.filter(b => b.due && b.due <= addDays(t, 30)), sum30 = in30.reduce((s, b) => s + (+b.eur || 0), 0);
  const land = S && S.landing && S.landing[0], onWay = S && S.payouts_on_the_way && S.payouts_on_the_way[0], lastP = S && S.last_payouts && S.last_payouts[0];
  const stChip = b => b.state === "overdue" ? `<span class="chip r">overdue</span>` : b.state === "waiting" ? `<span class="chip o">waiting for receipt</span>` : b.state === "paid" ? `<span class="chip g">paid</span>` : b.days != null && b.days <= 7 ? `<span class="chip o">in ${b.days} d</span>` : `<span class="chip">in ${b.days} d</span>`;
  const maxCat = d ? Math.max(1, ...(d.by_category || []).map(c => c.eur)) : 1;
  return `<div class="sp-kpis">
    ${S ? kpi("Stripe balance now", curList(S.available), `available · plus ${curList(S.pending)} pending`) : ""}
    ${S ? kpi(onWay ? "Payout on the way" : "Next money lands", onWay ? money(onWay.amount, onWay.currency) : land ? curList(Object.fromEntries(Object.entries(land).filter(([k]) => k !== "date"))) : "—", onWay ? `arrives ${dLabel(onWay.arrival)}` : land ? `becomes available ${dLabel(land.date)} · payouts are sent by hand${lastP ? `, last ${dLabel(lastP.arrival)}` : ""}` : "nothing pending") : ""}
    ${mo ? kpi("Money in · " + esc(mo.label || "this month"), eur(mo.income), "EUR, after conversion") : ""}
    ${mo ? kpi("Spent · " + esc(mo.label || "this month"), eur(mo.costs), `EUR · bills ${eur(mo.expenses)} + Stripe fees ${eur(mo.fees)}`) : ""}
    ${mo ? kpi("Net · " + esc(mo.label || "this month"), `<span class="${mo.profit >= 0 ? "sd-up" : "sd-dn"}">${eur(mo.profit)}</span>`, "EUR · money in minus spent") : ""}
  </div>
  ${F && (F.alerts || []).length ? `<section class="card sp-card"><h2>Needs a look <small>${F.alerts.length} alert${F.alerts.length === 1 ? "" : "s"}</small></h2><div class="sp-alerts">${F.alerts.map(a => `<div class="sp-alert ${esc(a.level || "info")}"><i></i><span>${esc(a.text)}</span></div>`).join("")}</div></section>` : ""}
  <div class="sp-2">
    <section class="card sp-card"><h2>Coming up <small>next 30 days: ${eur(sum30)} · ${in30.length} bill${in30.length === 1 ? "" : "s"}</small></h2>
      ${bills.length ? `<div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Due</th><th>Bill</th><th>Who pays</th><th></th><th class="num">Amount</th></tr></thead><tbody>
      ${bills.map(b => `<tr><td>${esc(dLabel(b.due))}</td><td>${esc(b.vendor || b.bill)}<span class="sub">${esc(b.item || "")}${b.cadence ? ` · ${esc(b.cadence)}` : ""}</span></td><td>${esc(b.payer || "?")}<span class="sub">${esc(b.paid_from || "")}</span></td><td>${stChip(b)}</td><td class="num">${money(b.amount, b.currency)}${b.currency !== "EUR" ? `<span class="sub">≈ ${eur(b.eur)}</span>` : ""}</td></tr>`).join("")}
      </tbody></table></div><p class="sp-note">Every recurring bill with its next charge date (Beju Finance sheet, Subscriptions). All ${bills.length} in the next 45 days: ${eur(F.bills_45d_eur)}.</p>` : empty("No upcoming bills found.")}</section>
    <div class="sp-col">
      ${d ? `<section class="card sp-card"><h2>Spent by category <small>all time, EUR</small></h2><div class="sp-bars">${(d.by_category || []).map(c => barRow(c.category, eur(c.eur), c.eur / maxCat)).join("")}</div></section>` : ""}
      ${d && d.split ? `<section class="card sp-card"><h2>Paid out of pocket <small>EUR</small></h2><div class="sp-bars"><div class="sp-bar"><span>Simas</span><span class="v">${eur((d.split.out_of_pocket || {}).Simas || 0)}</span></div><div class="sp-bar"><span>Benas</span><span class="v">${eur((d.split.out_of_pocket || {}).Benas || 0)}</span></div>
        <p class="sp-note">${d.split.settle ? `${esc(d.split.settle.from)} → ${esc(d.split.settle.to)} ${eur(d.split.settle.eur)} evens it out.` : "Even."} Display only; the real settle-up is manual.</p></div></section>` : ""}
    </div>
  </div>
  ${d && Array.isArray(d.rows) ? `<details class="card sp-card sp-more"><summary>Show all expenses <small>${d.rows.length} logged · ${eur(d.total_eur)} all time</small></summary><div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Date</th><th>What</th><th>Category</th><th>Paid by</th><th class="num">EUR</th></tr></thead><tbody>
    ${d.rows.map(e => `<tr><td>${esc(dLabel(e.date))}</td><td>${esc(e.vendor)}<span class="sub">${esc(e.item || "")}${e.billing ? ` · ${esc(e.billing)}` : ""}</span></td><td>${esc(e.category || "Other")}</td><td>${esc(e.paid_by || "?")}</td><td class="num">${eur(e.eur)}${e.currency && e.currency !== "EUR" ? `<span class="sub">${esc(e.amount)} ${esc(e.currency)}</span>` : ""}</td></tr>`).join("")}
  </tbody></table></div></details>` : ""}`;
}

/* 2. email tests (+ live reply rates per campaign from the metrics panel) */
function viewEmail(x) {
  const d = x.ab && x.ab.data, M = x.m && x.m.data;
  if (!d || !Array.isArray(d.campaigns)) return empty("No A/B data yet. It arrives with the next sync.");
  const w = d.what || {}, r = d.rules || {};
  const cell = (o, k) => o[k] == null ? "—" : k === "pos_rate" ? o[k].toFixed(1) + "%" : int(o[k]);
  const vchip = v => /B wins/.test(v) ? "chip g" : /A wins/.test(v) ? "chip b" : /hasn't|No B/.test(v) ? "chip" : "chip o";
  const live = M && Array.isArray(M.campaigns) ? `<section class="card sp-card"><h2>Reply rates by campaign <small>Instantly API, all time · synced ${esc(ago(x.m.updated_at))}</small></h2><div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Campaign</th><th class="num">Sent</th><th class="num">Contacted</th><th class="num">Replies</th><th class="num">Reply rate</th><th class="num">Positive</th><th class="num">Positive rate</th><th class="num">Bounced</th><th>Opens</th></tr></thead><tbody>
      ${M.campaigns.map(c => `<tr><td>${esc(c.name)}<span class="sub">${esc(c.status_label || "")}</span></td><td class="num">${int(c.sent)}</td><td class="num">${int(c.contacted)}</td><td class="num">${int(c.replies)}</td><td class="num">${c.reply_rate == null ? "—" : c.reply_rate.toFixed(1) + "%"}</td><td class="num">${int(c.opportunities)}</td><td class="num">${c.pos_rate == null ? "—" : c.pos_rate.toFixed(1) + "%"}</td><td class="num">${c.bounce_rate == null ? "—" : c.bounce_rate.toFixed(1) + "%"}</td><td class="mut">${c.opens_tracked ? int(c.opens) : "not tracked (plain text)"}</td></tr>`).join("")}
      ${M.total ? `<tr class="now"><td>All campaigns</td><td class="num">${int(M.total.sent)}</td><td class="num">${int(M.total.contacted)}</td><td class="num">${int(M.total.replies)}</td><td class="num">${M.total.reply_rate == null ? "—" : M.total.reply_rate.toFixed(1) + "%"}</td><td class="num">${int(M.total.opportunities)}</td><td class="num">${M.total.pos_rate == null ? "—" : M.total.pos_rate.toFixed(1) + "%"}</td><td class="num">${M.total.bounce_rate == null ? "—" : M.total.bounce_rate.toFixed(1) + "%"}</td><td class="mut">not tracked</td></tr>` : ""}
    </tbody></table></div><p class="sp-note">Reply rate = unique replies ÷ leads contacted. Positive = leads Instantly marks as an opportunity. Our campaigns are plain text with open tracking off (better delivery), so opens can't be measured; reply rate is not affected by that.</p></section>` : "";
  return `<section class="card sp-card"><h2>What's being tested</h2><div class="ab-what"><div><span class="sp-tag">A</span>${esc(w.A || "")}</div><div><span class="sp-tag">B</span>${esc(w.B || "")}</div><div class="mut">${esc(w.FA || "")} ${esc(w.FB || "")}</div>
    <p class="sp-note">A verdict needs ${esc(r.min_sends || 300)}+ sends per side and ${esc(r.min_pos || 8)}+ positives. ${esc(d.note || "")}</p></div></section>
  <div class="ab-grid">${d.campaigns.map(c => `<section class="card sp-card ab-card"><h2>${esc(c.name)} <small>${c.since ? `B since ${esc(dLabel(c.since))}` : "no B"}</small></h2>
    ${(c.steps || []).map(s => `<table><thead><tr><th>${esc(s.step)}</th><th>Sent</th><th>Replies</th><th>Positive</th><th>Rate</th></tr></thead><tbody>
      <tr><td>A</td><td>${cell(s.A, "sent")}</td><td>${cell(s.A, "replies")}</td><td>${cell(s.A, "positives")}</td><td>${cell(s.A, "pos_rate")}</td></tr>
      <tr><td>B</td><td>${cell(s.B, "sent")}</td><td>${cell(s.B, "replies")}</td><td>${cell(s.B, "positives")}</td><td>${cell(s.B, "pos_rate")}</td></tr></tbody></table>
      <div class="vd"><span class="${vchip(s.verdict)}">${esc(s.verdict)}</span></div>`).join("")}</section>`).join("")}</div>${live}`;
}

/* 3. clients + their videos (SIMAS 11-19 15:3x: grouped by category, retainer plans, videos by date, today's highlighted) */
async function loadClients() {
  const [clients, deliveries, payments, retainers, st, notes, m] = await Promise.all([
    all("clients", "id,name,emails,show,drive_folder,source"),
    all("deliveries", "id,client_id,title,order_name,kind,duration_s,link,delivered_at", q => q.order("delivered_at", { ascending: false }).order("id")),
    all("payments", "client_id,amount,refunded,paid_at"),
    all("retainers", "id,email,name,amount,interval,status,started_at,current_period_end").catch(() => []),
    all("sync_status", "name,ran_at").catch(() => []),
    all("client_notes", "lead_email,kind,note,noted_at,created_at", q => q.eq("kind", "priority")).catch(() => []),
    panel("metrics").catch(() => null),
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
    return { ...c, vids: vs, paid: paid[c.id] || 0, nPay: nPay[c.id] || 0, last, ret: r, plan, gone, cat, today: vs.filter(v => v.delivered_at === t).length };
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
    <div class="cl-chips">${c.today ? `<span class="chip g">${c.today} today</span>` : ""}${c.plan ? `<span class="chip g">${esc(c.plan.text)}</span>` : ""}<span class="chip">${int(c.vids.length)} video${c.vids.length === 1 ? "" : "s"}</span>${c.paid ? `<span class="chip b">${usd(c.paid)} paid${c.nPay > 1 ? ` · ${c.nPay} payments` : ""}</span>` : ""}${c.gone ? `<span class="chip">parted ways</span>` : ""}</div></div>
    ${c.plan ? `<div class="cl-plan"><div class="sp-bar"><span>Delivered this billing month <small class="mut">since ${esc(dLabel(c.plan.start))} · renews ${esc(dLabel(c.plan.renews))}</small></span><span class="v">${c.plan.done}${c.plan.shorts ? ` / ${c.plan.shorts}` : ""}</span><div class="bar c-green"><i data-v="w:${c.plan.shorts ? Math.min(100, Math.max(2, Math.round(100 * c.plan.done / c.plan.shorts))) : 100}%"></i></div></div><p class="sp-note">Counts each Short once (new versions of the same Short don't add up), from the files in Drive.</p></div>` : ""}
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
  const D = { t, w0, k, funnel, camps, best: best && best.id, worst: worst && worst !== best ? worst.id : null, arms: arms && arms.data, armsAt: arms && arms.updated_at, ab: abRows, SC, HOT, CL, SA, trend, REV, changes, heads, missing, synced: m ? m.updated_at : null };
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
function viewWeekly(d) {
  const sec = (n, title, small, body, cls = "") => `<section class="card sp-card ${cls}"><h2><span><em class="wk-n">${n}</em>${title}</span>${small ? `<small>${small}</small>` : ""}</h2>${body}</section>`;
  const stat = (label, val, sub) => `<div class="wk-stat"><span>${esc(label)}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
  const H = d.HOT, C = d.CL, S = d.SA, SC = d.SC, rate = c => c && c.contacted ? c : null;
  const fmax = Math.max(1, ...d.funnel.map(f => Math.max(f.cur || 0, f.prev || 0)));
  const funnel = `<div class="wk-fun">${d.funnel.map((f, i) => { const pv = i ? d.funnel[i - 1] : null; return `<div class="wk-fr"><span class="l">${esc(f.label)}</span><span class="b"><i class="c" data-v="w:${f.cur ? Math.max(3, Math.round(Math.sqrt(f.cur / fmax) * 100)) : 0}%"></i><i class="p" data-v="w:${f.prev ? Math.max(3, Math.round(Math.sqrt(f.prev / fmax) * 100)) : 0}%"></i></span><b>${f.cur == null ? "—" : int(f.cur)}</b><span class="cv">${pv && pv.cur ? pp(f.cur || 0, pv.cur) + " of the step before" : ""}</span><span class="d">${dl(f.cur, f.prev)}</span></div>`; }).join("")}</div><p class="sp-note">Blue = this week so far, grey = the same ${d.k} day${d.k === 1 ? "" : "s"} last week. Bars use a square-root scale so small steps stay visible.</p>`;
  const campT = d.camps.length ? `<div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Campaign</th><th class="num">Sent</th><th class="num">Contacted</th><th class="num">Reply %</th><th class="num">vs last wk</th><th class="num">Positive %</th><th class="num">vs last wk</th></tr></thead><tbody>${d.camps.map(c => { const w = c.week, p = rate(c.prev_week), small = w.contacted < 100; return `<tr><td>${esc(c.name.split(" —")[0])}${c.id === d.best ? ` <span class="chip g">best</span>` : c.id === d.worst ? ` <span class="chip r">weakest</span>` : small ? ` <span class="chip">small sample</span>` : ""}</td><td class="num">${int(w.sent)}</td><td class="num">${int(w.contacted)}</td><td class="num">${w.reply_rate == null ? "—" : w.reply_rate.toFixed(1) + "%"}</td><td class="num">${p && p.reply_rate != null ? p.reply_rate.toFixed(1) + "%" : "—"}</td><td class="num">${w.pos_rate == null ? "—" : w.pos_rate.toFixed(1) + "%"}</td><td class="num">${p && p.pos_rate != null ? p.pos_rate.toFixed(1) + "%" : "—"}</td></tr>`; }).join("")}</tbody></table></div>` : empty("No data yet.");
  const A = d.arms && d.arms.arms ? d.arms.arms : null, aOk = A ? A.filter(a => a.contacted >= 100) : [], aBest = aOk.slice().sort((a, b) => b.pos_rate - a.pos_rate)[0], aWorst = aOk.length > 1 ? aOk.slice().sort((a, b) => a.pos_rate - b.pos_rate)[0] : null;
  const armT = A ? `<div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Source / arm</th><th class="num">Contacted</th><th class="num">Reply %</th><th class="num">Positive %</th><th class="num">Positives</th><th class="num">Last 14 d</th><th class="num">Positive % 14 d</th></tr></thead><tbody>${A.filter(a => a.contacted >= 30).map(a => `<tr><td>${esc(a.arm)}${a === aBest ? ` <span class="chip g">best</span>` : a === aWorst ? ` <span class="chip r">weakest</span>` : a.contacted < 100 ? ` <span class="chip">small sample</span>` : ""}<span class="sub">${esc((a.campaigns || []).join(", "))}</span></td><td class="num">${int(a.contacted)}</td><td class="num">${a.reply_rate == null ? "—" : a.reply_rate.toFixed(1) + "%"}</td><td class="num">${a.pos_rate == null ? "—" : a.pos_rate.toFixed(1) + "%"}</td><td class="num">${int(a.positive)}</td><td class="num">${int(a.contacted_14d)}</td><td class="num">${a.pos_rate_14d == null ? "—" : a.pos_rate_14d.toFixed(1) + "%"}</td></tr>`).join("")}</tbody></table></div><p class="sp-note">${A.filter(a => a.contacted < 30).length} arms with under 30 leads contacted are left out. Best and weakest need 100+ leads contacted. ${esc(d.arms.note || "")} Synced ${esc(ago(d.armsAt))}.</p>` : empty("No data yet: the arms sync runs hourly.");
  const abT = d.ab.length ? `<div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Campaign</th><th>Step</th><th class="num">A sent</th><th class="num">A positive %</th><th class="num">B sent</th><th class="num">B positive %</th><th>Leader</th></tr></thead><tbody>${d.ab.flatMap(c => (c.steps || []).map(s => `<tr><td>${esc(c.name)}</td><td>${esc(s.step)}</td><td class="num">${int(s.A.sent)}</td><td class="num">${s.A.pos_rate == null ? "—" : s.A.pos_rate.toFixed(1) + "%"}</td><td class="num">${int(s.B.sent)}</td><td class="num">${s.B.pos_rate == null ? "—" : s.B.pos_rate.toFixed(1) + "%"}</td><td>${/wins/.test(s.verdict) ? `<span class="chip g">${esc(s.verdict)}</span>` : `<span class="chip">${/hasn't/.test(s.verdict) ? "B hasn't sent yet" : "too early"}</span>`}</td></tr>`)).join("")}</tbody></table></div>` : empty("No data yet.");
  return `<div class="wk-tools"><span class="mut">Week of ${esc(dLabel(d.w0))} · day ${d.k} of 7 · compared with the same ${d.k} day${d.k === 1 ? "" : "s"} last week</span><button type="button" class="act go" id="wk-copy">${ic("copy")}Copy for Claude</button></div>
  ${sec(1, "What worked this week", "", d.heads.length ? `<div class="wk-heads">${d.heads.map(h => `<div class="wk-head ${h.good ? "g" : "r"}"><i></i><span>${esc(h.text)}</span></div>`).join("")}</div>` : empty("Not enough volume yet this week for a clear win or loss."), "wk-top")}
  <div class="sp-2">${sec(2, "Funnel", "this week vs last week", funnel)}
    <div class="sp-col">${sec("", "8-week trend", "positive replies", cols(d.trend, "pos", "c-green", int))}${sec("", "Paid", "payments per week", cols(d.trend, "paid", "c-blue", int) + `<div class="wk-stats two">${stat("Revenue this week", usd(d.REV.cur), dl(d.REV.cur, d.REV.prev, { f: usd }))}${stat("MRR", usd(C.mrr), C.mrrNew ? `<span class="sd-up">+${usd(C.mrrNew)}</span> new this week` : "no change this week")}</div>`)}</div></div>
  ${sec(3, "By campaign", "this week so far vs the same days last week", campT + `<p class="sp-note">Reply % = unique human replies ÷ leads contacted. Positive % = Instantly opportunities ÷ leads contacted. Under 100 contacted is marked "small sample": don't over-read it.</p>`)}
  ${sec("", "By source / arm tag", "all time + last 14 days", armT)}
  ${sec(4, "A/B tests", "A = line-first, B = question-first", abT)}
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
  $("#wk-copy")?.addEventListener("click", async ev => {
    const txt = "BEJÚ weekly snapshot (paste to Claude)\n" + JSON.stringify(CACHE.weekly.export);
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
async function loadTodos() { await me(); return all("todo_cards", "*", q => q.order("pos").order("id")); }
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
    <div class="ft"><span class="${oc}">${esc(c.owner)}</span><span class="sp"></span>
      <button type="button" class="mini" data-mv="-1" aria-label="Move left" title="Move left"><svg aria-hidden="true"><use href="#i-back"/></svg></button>
      <button type="button" class="mini" data-mv="1" aria-label="Move right" title="Move right"><svg aria-hidden="true"><use href="#i-chev"/></svg></button>
      <button type="button" class="mini" data-ed aria-label="Edit" title="Edit"><svg aria-hidden="true"><use href="#i-edit"/></svg></button></div></div>`;
}
function formHtml(c) {
  const o = c ? c.owner : (EDIT && EDIT.owner) || (TVIEW === "board" && OWNF !== "All" ? OWNF : "") || (ME && ME.who) || "Both";
  return `<form class="tile sd-form" data-form="${c ? c.id : "new"}" data-col="${esc(c ? c.col : EDIT.col)}">
    <textarea name="title" rows="2" maxlength="300" required placeholder="What needs doing?" aria-label="Card title">${esc(c ? c.title : "")}</textarea>
    <textarea name="detail" rows="2" maxlength="4000" placeholder="Details (optional)" aria-label="Details">${esc(c && c.detail ? c.detail : "")}</textarea>
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
function viewTodos(list) { return `<div class="sd-tools" id="sd-tools">${toolsHtml(list)}</div><div class="sd-board${TVIEW === "founder" ? " lanes" : ""}" id="sd-board">${boardHtml(list)}</div>`; }
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
    const f = ev.target, title = f.title.value.trim(), detail = f.detail.value.trim() || null, owner = $("[data-own].on", f)?.dataset.own || "Both";
    if (!title) { f.title.focus(); return; }
    if (f.dataset.form === "new") {
      const col = f.dataset.col, row = { title, detail, owner, col, pos: posBetween(CACHE.todos, col, 0), created_by: (ME && ME.name) || null };
      EDIT = null;
      try { const ins = await must(sb().from("todo_cards").insert(row).select().single()); CACHE.todos.push(ins); renderTodos(); } catch (e) { renderTodos(); toast("Couldn't add that card. Check your connection."); }
    } else { EDIT = null; await saveCard(+f.dataset.form, { title, detail, owner }); }
  });
  board.addEventListener("keydown", ev => {
    if (ev.target.matches("textarea") && ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); ev.target.form.requestSubmit(); return; }
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
