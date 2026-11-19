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
const LOAD = { expenses: () => panel("expenses"), email: async () => ({ ab: await panel("ab_tests"), m: await panel("metrics").catch(() => null) }), clients: loadClients, weekly: loadWeekly, todos: loadTodos };
const VIEW = { expenses: viewExpenses, email: viewEmail, clients: viewClients, weekly: viewWeekly, todos: viewTodos };
const HEAD = {
  expenses: ["Expenses", "Every cost we log, the monthly totals and the 50/50 split."],
  email: ["Email <em class=\"sf\">tests</em>", "Variant A against B per campaign, plus each campaign's real reply and positive rates."],
  clients: ["Clients <em class=\"sf\">&amp; videos</em>", "Everyone who paid or got videos from us, and every video we delivered."],
  weekly: ["Weekly <em class=\"sf\">analysis</em>", "Eight weeks of outreach, positive replies and money, week by week."],
  todos: ["To-<em class=\"sf\">dos</em>", "The founders' board. Drag cards between columns; both of you see changes live."],
};
function srcOf(p, d) {
  if (p === "expenses") return d ? ["Beju Finance sheet", d.updated_at] : null;
  if (p === "email") return d && d.ab ? ["Instantly API", d.ab.updated_at] : null;
  if (p === "clients") return d ? ["Drive delivery index + Stripe", d.synced] : null;
  if (p === "weekly") return d ? ["Instantly, Stripe and the Samples tab", d.synced] : null;
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
    applyVars(PAGE_EL); if (p === "todos") wireBoard(); if (p === "clients") wireClients();
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

/* 1. expenses */
function viewExpenses(row) {
  const d = row && row.data;
  if (!d || !Array.isArray(d.rows)) return empty("No expenses data yet. It arrives with the next sync.");
  const ym = dayOf(Date.now()).slice(0, 7), lastYm = addDays(ym + "-01", -1).slice(0, 7);
  const m = Object.fromEntries((d.by_month || []).map(x => [x.ym, x.eur]));
  const sp = d.split || {}, pk = sp.out_of_pocket || {}, maxCat = Math.max(1, ...(d.by_category || []).map(x => x.eur));
  const settle = sp.settle ? `${esc(sp.settle.from)} → ${esc(sp.settle.to)} <b class="mono">${eur(sp.settle.eur)}</b> evens it out.` : "Even.";
  return `<div class="sp-kpis">${kpi("This month", eur(m[ym] || 0), ymLabel(ym))}${kpi("Last month", eur(m[lastYm] || 0), ymLabel(lastYm))}${kpi("All time", eur(d.total_eur), `${d.rows.length} expenses logged`)}${d.run_rate_eur ? kpi("Subscriptions a month", eur(d.run_rate_eur), "active run-rate") : ""}</div>
  <div class="sp-2">
    <section class="card sp-card"><h2>Every expense <small>newest first</small></h2><div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Date</th><th>What</th><th>Category</th><th>Paid by</th><th class="num">EUR</th></tr></thead><tbody>
      ${d.rows.map(e => `<tr><td>${esc(dLabel(e.date))}</td><td>${esc(e.vendor)}<span class="sub">${esc(e.item || "")}${e.billing ? ` · ${esc(e.billing)}` : ""}</span></td><td>${esc(e.category || "Other")}</td><td>${esc(e.paid_by || "?")}</td><td class="num">${eur(e.eur)}${e.currency && e.currency !== "EUR" ? `<span class="sub">${esc(e.amount)} ${esc(e.currency)}</span>` : ""}</td></tr>`).join("")}
    </tbody></table></div></section>
    <div class="sp-col">
      <section class="card sp-card"><h2>50/50 split <small>out of pocket</small></h2><div class="sp-bars">
        <div class="sp-bar"><span>Simas paid</span><span class="v">${eur(pk.Simas || 0)}</span></div><div class="sp-bar"><span>Benas paid</span><span class="v">${eur(pk.Benas || 0)}</span></div><div class="sp-bar"><span>Half each</span><span class="v">${eur(sp.half_each || 0)}</span></div>
        <p class="sp-note">${settle} ${esc(sp.note || "")}</p></div></section>
      <section class="card sp-card"><h2>By category</h2><div class="sp-bars">${(d.by_category || []).map(x => barRow(x.category, eur(x.eur), x.eur / maxCat)).join("")}</div></section>
      <section class="card sp-card"><h2>By payer</h2><div class="sp-bars">${(d.by_payer || []).map(x => barRow(x.payer, eur(x.eur), x.eur / Math.max(1, d.total_eur), "c-green")).join("")}</div></section>
    </div>
  </div>`;
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

/* 3. clients + their videos */
async function loadClients() {
  const [clients, deliveries, payments, retainers, st] = await Promise.all([
    all("clients", "id,name,emails,show,drive_folder,source"),
    all("deliveries", "id,client_id,title,order_name,kind,duration_s,link,delivered_at", q => q.order("delivered_at", { ascending: false }).order("id")),
    all("payments", "client_id,amount,refunded,paid_at"),
    all("retainers", "email,name,amount,interval,status").catch(() => []),
    all("sync_status", "name,ran_at").catch(() => []),
  ]);
  const vids = {}, paid = {}, last = {};
  deliveries.forEach(v => { (vids[v.client_id] = vids[v.client_id] || []).push(v); if (!last[v.client_id] || v.delivered_at > last[v.client_id]) last[v.client_id] = v.delivered_at; });
  payments.forEach(p => { if (!p.refunded) paid[p.client_id] = (paid[p.client_id] || 0) + (+p.amount || 0); });
  const ret = {}; retainers.forEach(r => { if (/active|trialing|past_due/i.test(r.status || "")) ret[lc(r.email)] = r; });
  const list = clients.map(c => ({ ...c, vids: vids[c.id] || [], paid: paid[c.id] || 0, last: last[c.id] || "", ret: (c.emails || []).map(lc).map(e => ret[e]).find(Boolean) || null }))
    .filter(c => c.vids.length || c.paid || c.ret).sort((a, b) => (b.last || "").localeCompare(a.last || "") || b.paid - a.paid);
  const ds = st.find(x => x.name === "deliveries");
  return { list, synced: ds ? ds.ran_at : null, lastDelivery: deliveries.reduce((m, v) => v.delivered_at > m ? v.delivered_at : m, "") };
}
const fdur = s => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "";
function clientDetail(c) {
  if (!c) return empty("Pick a client on the left.");
  const orders = {}; c.vids.forEach(v => (orders[v.order_name || "Videos"] = orders[v.order_name || "Videos"] || []).push(v));
  return `<div class="cl-head"><div><h2>${esc(c.name || "Client")}</h2><p>${esc([c.show, (c.emails || [])[0], c.last ? `last video ${dLabel(c.last)}` : "no videos yet"].filter(Boolean).join(" · "))}</p></div>
    <div class="cl-chips">${c.ret ? `<span class="chip g">${usd(c.ret.amount)} / ${esc((c.ret.interval || "month").replace(/ly$/, ""))}</span>` : ""}<span class="chip">${int(c.vids.length)} video${c.vids.length === 1 ? "" : "s"}</span>${c.paid ? `<span class="chip b">${usd(c.paid)} paid</span>` : ""}${c.drive_folder ? `<span class="chip">Drive: ${esc(c.drive_folder)}</span>` : ""}</div></div>
    ${Object.entries(orders).map(([o, vs]) => `<div class="cl-ord">${esc(o)} · ${vs.length}</div><div class="vid-grid">${vs.map(v => `<a class="vid" href="${esc(v.link)}" target="_blank" rel="noopener noreferrer" title="Open in Drive"><span class="pl">${ic("play")}</span><b>${esc(v.title || "Video")}</b><small>${esc([fdur(v.duration_s), dLabel(v.delivered_at)].filter(Boolean).join(" · "))}</small></a>`).join("")}</div>`).join("") || empty("No videos for this client in the delivery index yet.")}`;
}
function viewClients(d) {
  if (!d.list.length) return empty("No clients with videos or payments yet.");
  const sel = d.list.find(c => c.id === param("c")) || d.list[0], n = d.list.reduce((s, c) => s + c.vids.length, 0);
  return `<div class="sp-kpis">${kpi("Clients", int(d.list.length), "paid or got videos")}${kpi("Videos delivered", int(n), "all clients")}${kpi("Newest video", dLabel(d.lastDelivery), "in the delivery index")}</div>
  <div class="cl-wrap"><section class="card sp-card"><input class="cl-q" id="cl-q" type="search" placeholder="Find a client" aria-label="Find a client" autocomplete="off" spellcheck="false">
    <div class="cl-list" id="cl-list">${d.list.map(c => `<a class="cl-item" href="?p=clients&amp;c=${esc(c.id)}" data-cl="${esc(c.id)}" data-q="${esc(lc([c.name, c.show, ...(c.emails || [])].join(" ")))}"${c.id === sel.id ? ' aria-current="true"' : ""}><span class="av">${esc(initials(c.name))}</span><span class="grow"><span class="t">${esc(c.name || "Client")}</span><span class="s">${esc(c.last ? `last video ${dLabel(c.last)}` : c.ret ? "retainer" : "paid")}</span></span><span class="n">${int(c.vids.length)}</span></a>`).join("")}</div></section>
    <section class="card sp-card" id="cl-detail">${clientDetail(sel)}</section></div>`;
}
function wireClients() {
  $("#cl-q")?.addEventListener("input", ev => { const q = lc(ev.target.value); $$("#cl-list [data-q]").forEach(el => { el.hidden = !!q && !el.dataset.q.includes(q); }); });
  $("#cl-list")?.addEventListener("click", ev => {
    const a = ev.target.closest("[data-cl]"); if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey) return; ev.preventDefault();
    const c = CACHE.clients.list.find(x => x.id === a.dataset.cl); if (!c) return;
    $$("#cl-list [data-cl]").forEach(x => x.dataset.cl === c.id ? x.setAttribute("aria-current", "true") : x.removeAttribute("aria-current"));
    $("#cl-detail").innerHTML = clientDetail(c); history.replaceState({ p: "clients" }, "", `?p=clients&c=${encodeURIComponent(c.id)}`);
    if (innerWidth <= 900) $("#cl-detail").scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" });
  });
}

/* 4. weekly analysis */
async function loadWeekly() {
  const t = dayOf(Date.now()), w0 = monday(t), from = addDays(w0, -7 * 7);
  const [daily, interested, pipe, payments, deliveries, st] = await Promise.all([
    all("campaign_daily", "day,sent,new_leads,replies,replies_auto,opportunities", q => q.gte("day", from)),
    all("interested_leads", "email,interest_changed_at"),
    all("pipeline", "email,yes_at,delivered_at"),
    all("payments", "amount,refunded,paid_at", q => q.gte("paid_at", from)),
    all("deliveries", "delivered_at", q => q.gte("delivered_at", from)),
    all("sync_status", "name,ran_at").catch(() => []),
  ]);
  const weeks = []; for (let i = 7; i >= 0; i--) weeks.push(addDays(w0, -7 * i));
  const W = Object.fromEntries(weeks.map(w => [w, { w, now: w === w0, sent: 0, newLeads: 0, replies: 0, pos: 0, samples: 0, shorts: 0, pays: 0, rev: 0 }]));
  const k = Math.round((new Date(t + "T12:00:00Z") - new Date(w0 + "T12:00:00Z")) / 864e5) + 1, pw0 = addDays(w0, -7), pcut = addDays(pw0, k);
  const P = { sent: 0, newLeads: 0, pos: 0, pays: 0, rev: 0, days: k };   // last week, same weekdays as this week so far
  const wk = d => W[monday(d)], inP = d => d >= pw0 && d < pcut;
  daily.forEach(r => { const x = wk(r.day); if (x) { x.sent += +r.sent || 0; x.newLeads += +r.new_leads || 0; x.replies += +r.replies || 0; } if (inP(r.day)) { P.sent += +r.sent || 0; P.newLeads += +r.new_leads || 0; } });
  const first = {};
  interested.forEach(r => { const d = dayOf(r.interest_changed_at); if (d) { const e = lc(r.email); if (!first[e] || d < first[e]) first[e] = d; } });
  pipe.forEach(r => { const d = dayOf(r.yes_at); if (d) { const e = lc(r.email); if (!first[e] || d < first[e]) first[e] = d; } });
  Object.values(first).forEach(d => { const x = wk(d); if (x) x.pos++; if (inP(d)) P.pos++; });
  pipe.forEach(r => { const d = dayOf(r.delivered_at), x = d && wk(d); if (x) x.samples++; });
  payments.forEach(p => { if (p.refunded) return; const d = dayOf(p.paid_at), x = wk(d); if (x) { x.pays++; x.rev += +p.amount || 0; } if (inP(d)) { P.pays++; P.rev += +p.amount || 0; } });
  deliveries.forEach(v => { const x = wk(v.delivered_at); if (x) x.shorts++; });
  const inst = st.find(x => x.name === "instantly");
  return { weeks: weeks.map(w => W[w]), prevSoFar: P, synced: inst ? inst.ran_at : null };
}
function delta(a, b, f, n) { if (!b) return `same ${n} day${n === 1 ? "" : "s"} last week: ${f(b)}`; const r = (a - b) / b; return `<span class="${r >= 0 ? "sd-up" : "sd-dn"}">${r >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(r * 100))}%</span> vs the same ${n} day${n === 1 ? "" : "s"} last week (${f(b)})`; }
function cols(weeks, key, cls, fmt) {
  const mx = Math.max(1, ...weeks.map(w => w[key]));
  return `<div class="wk-cols ${cls}" role="img" aria-label="${esc(weeks.map(w => `${dLabel(w.w)}: ${fmt(w[key])}`).join(", "))}">${weeks.map(w => `<i class="${w.now ? "now" : ""}" data-v="h:${Math.max(2, Math.round(100 * w[key] / mx))}%" title="${esc(`Week of ${dLabel(w.w)}: ${fmt(w[key])}`)}"></i>`).join("")}</div>
    <div class="wk-axis" aria-hidden="true">${weeks.map(w => `<span>${esc(dLabel(w.w))}</span>`).join("")}</div>`;
}
function viewWeekly(d) {
  const ws = d.weeks, now = ws[ws.length - 1], P = d.prevSoFar, n = P.days;
  if (!ws.some(w => w.sent || w.pos || w.rev)) return empty("No weekly data yet.");
  return `<div class="sp-kpis">${kpi("Positive replies this week", int(now.pos), delta(now.pos, P.pos, int, n))}${kpi("Per 100 new leads", now.newLeads ? pct(now.pos, now.newLeads) : "—", P.newLeads ? `same days last week ${pct(P.pos, P.newLeads)}` : "this week so far")}${kpi("Revenue this week", usd(now.rev), delta(now.rev, P.rev, usd, n))}${kpi("Emails sent this week", int(now.sent), delta(now.sent, P.sent, int, n))}</div>
  <div class="sp-2b"><section class="card sp-card"><h2>Positive replies per week</h2>${cols(ws, "pos", "c-green", int)}</section><section class="card sp-card"><h2>Revenue per week <small>Stripe, USD</small></h2>${cols(ws, "rev", "c-blue", usd)}</section></div>
  <section class="card sp-card"><h2>Week by week <small>newest first</small></h2><div class="sp-scroll"><table class="sp-tbl"><thead><tr><th>Week of</th><th class="num">New leads</th><th class="num">Sent</th><th class="num">Replies</th><th class="num">Positive</th><th class="num">Per 100 new</th><th class="num">Samples</th><th class="num">Paid videos</th><th class="num">Payments</th><th class="num">Revenue</th></tr></thead><tbody>
    ${ws.slice().reverse().map(w => `<tr class="${w.now ? "now" : ""}"><td>${esc(dLabel(w.w))}${w.now ? " · so far" : ""}</td><td class="num">${int(w.newLeads)}</td><td class="num">${int(w.sent)}</td><td class="num">${int(w.replies)}</td><td class="num">${int(w.pos)}</td><td class="num">${w.newLeads ? pct(w.pos, w.newLeads) : "—"}</td><td class="num">${int(w.samples)}</td><td class="num">${int(w.shorts)}</td><td class="num">${int(w.pays)}</td><td class="num">${w.pays ? usd(w.rev) : "—"}</td></tr>`).join("")}
  </tbody></table></div><p class="sp-note">Positive = marked interested in Instantly or said yes to a free sample, counted once in the week it first happened. Per 100 new = positives per 100 new leads emailed that week. Samples = free samples delivered. Paid videos = files in the Drive delivery index. Weeks run Monday to Sunday (Vilnius); this week is compared with the same days of last week.</p></section>`;
}

/* 5. to-do board */
const COLS = [["todo", "To do"], ["doing", "Doing"], ["done", "Done"]];
async function loadTodos() { await me(); return all("todo_cards", "*", q => q.order("pos").order("id")); }
const cardsIn = (list, col) => list.filter(c => c.col === col).sort((a, b) => a.pos - b.pos || a.id - b.id);
async function todoBadge() {
  try { const { count } = await sb().from("todo_cards").select("id", { count: "exact", head: true }).neq("col", "done"); const b = $("#sn-todo-n"); if (b) { b.hidden = !count; b.textContent = count || ""; } } catch {}
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
  const o = c ? c.owner : (ME && ME.who) || "Both";
  return `<form class="tile sd-form" data-form="${c ? c.id : "new"}" data-col="${esc(c ? c.col : EDIT.col)}">
    <textarea name="title" rows="2" maxlength="300" required placeholder="What needs doing?" aria-label="Card title">${esc(c ? c.title : "")}</textarea>
    <textarea name="detail" rows="2" maxlength="4000" placeholder="Details (optional)" aria-label="Details">${esc(c && c.detail ? c.detail : "")}</textarea>
    <div class="seg" role="group" aria-label="Owner">${["Simas", "Benas", "Both"].map(x => `<button type="button" data-own="${x}" class="${x === o ? "on" : ""}" aria-pressed="${x === o}">${x}</button>`).join("")}</div>
    <div class="row">${c ? `<button type="button" class="act no del" data-del>Delete</button>` : ""}<button type="button" class="act" data-cancel>Cancel</button><button type="submit" class="act go">${c ? "Save" : "Add card"}</button></div></form>`;
}
const boardHtml = list => COLS.map(([k, label]) => {
  const cs = cardsIn(list, k);
  return `<section class="sd-col" data-col="${k}" aria-label="${label}"><div class="sd-col-h"><span>${label}</span><span class="chip">${cs.length}</span></div>
    ${EDIT && EDIT.id === "new" && EDIT.col === k ? formHtml(null) : `<button type="button" class="sd-add" data-add="${k}"><svg aria-hidden="true"><use href="#i-plus"/></svg>Add a card</button>`}
    ${cs.map(cardHtml).join("")}${!cs.length && !(EDIT && EDIT.col === k) ? `<p class="empty">Nothing here yet.</p>` : ""}</section>`;
}).join("");
function viewTodos(list) { return `<div class="sd-board" id="sd-board">${boardHtml(list)}</div>`; }
function renderTodos() {
  const bd = $("#sd-board"); if (PAGE !== "todos" || !CACHE.todos || !bd) return;
  const sx = bd.scrollLeft; bd.innerHTML = boardHtml(CACHE.todos); bd.scrollLeft = sx;
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
function wireBoard() {
  const board = $("#sd-board"); if (!board) return;
  board.addEventListener("click", async ev => {
    const t = ev.target.closest("button"); if (!t) return;
    const card = t.closest("[data-card]"), id = card ? +card.dataset.card : null, list = CACHE.todos;
    if (t.dataset.add) { EDIT = { id: "new", col: t.dataset.add }; renderTodos(); return; }
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
  D.on = true;
  D.lift = D.card.cloneNode(true); D.lift.classList.add("lift"); D.lift.removeAttribute("data-card"); D.lift.removeAttribute("tabindex"); D.lift.setAttribute("aria-hidden", "true");
  D.lift.style.setProperty("--w", D.w + "px"); document.body.append(D.lift);
  D.ph = document.createElement("div"); D.ph.className = "sd-ph"; D.ph.style.setProperty("--h", D.h + "px");
  D.card.after(D.ph); D.card.hidden = true;
}
function place(D, x, y) {
  D.lift.style.setProperty("--x", x - D.dx + "px"); D.lift.style.setProperty("--y", y - D.dy + "px");
  const cols = $$(".sd-col"), col = cols.find(c => { const b = c.getBoundingClientRect(); return x >= b.left && x <= b.right && y >= b.top - 40 && y <= b.bottom + 120; });
  cols.forEach(c => c.classList.toggle("drop", c === col));
  if (col) {
    const others = $$("[data-card]:not([hidden])", col), next = others.find(el => { const b = el.getBoundingClientRect(); return y < b.top + b.height / 2; });
    next ? next.before(D.ph) : col.append(D.ph);
    D.col = col.dataset.col; D.idx = next ? others.indexOf(next) : others.length;
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
  moveCard(D.id, D.col, D.idx);
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
