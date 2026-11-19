/* BEJÚ founder CRM: founder-tools sidebar (SIMAS 11-19: "side bar that covers 30% left side ... detached ... same glassy look
   ... fully retractable ... expenses, email testing, clients + our made vids, weekly analysis, Trello type to dos").
   It shares crm.js's Supabase client (window.BEJU_CRM_SB) and only shows while the founder dashboard is on screen.
   Reads: crm_panels ('expenses', 'ab_tests' from scripts/crm_panels_sync.py), clients, deliveries, payments, retainers,
   campaign_daily, interested_leads, pipeline. Writes: todo_cards only (founder RLS). The bento page is not touched.
   CSP: no inline styles; sizes go through style.setProperty on custom properties. */
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

const SIDE = $("#side"), HANDLE = $("#side-handle"), BODY = $("#sd-body"), FOOT = $("#sd-foot"), SUB = $("#sd-sub"), APP = $("#app");
if (!SIDE || !HANDLE || !APP) return;
const K_OPEN = "beju-crm-side", K_SEC = "beju-crm-side-sec", K_WIDE = "beju-crm-side-wide";
const SECS = { expenses: "Expenses", email: "Email tests", clients: "Clients & videos", weekly: "Weekly analysis", todos: "To-dos" };
let SEC = SECS[store.get(K_SEC)] ? store.get(K_SEC) : "expenses";
let OPEN = store.get(K_OPEN) === "1", ME = null, CACHE = {}, TIMER = null, CH = null, DRAG = null, SEQ = 0, EDIT = null, OPENED = new Set();
const sb = () => window.BEJU_CRM_SB;
const must = async p => { const { data, error } = await p; if (error) throw error; return data; };
async function all(table, cols, mod) {   // REST returns at most 1,000 rows per call
  const out = [];
  for (let i = 0; ; i += 1000) { let q = sb().from(table).select(cols).range(i, i + 999); if (mod) q = mod(q); const rows = await must(q); out.push(...rows); if (rows.length < 1000) return out; }
}
const panel = id => must(sb().from("crm_panels").select("data,updated_at").eq("id", id).maybeSingle());
function toast(t) {   // reuse the page's toast stack
  const box = $("#toasts"); if (!box) return;
  const el = document.createElement("div"); el.className = "toast"; el.innerHTML = `<div><b>${esc(t)}</b></div>`;
  box.append(el); setTimeout(() => el.remove(), 4200);
}

/* ---------------- open / close ---------------- */
function setOpen(on, opts = {}) {
  OPEN = on; store.set(K_OPEN, on ? "1" : "0");
  SIDE.classList.toggle("open", on); SIDE.inert = !on; SIDE.setAttribute("aria-hidden", on ? "false" : "true");
  HANDLE.setAttribute("aria-expanded", on ? "true" : "false");
  if (on) { render(); if (opts.focus) setTimeout(() => $(`#sdt-${SEC}`)?.focus(), RM ? 0 : 120); startTimer(); }
  else { stopTimer(); if (opts.focus || SIDE.contains(document.activeElement)) HANDLE.focus(); }
}
function setWide(on) { SIDE.classList.toggle("wide", on); $("#sd-wide").setAttribute("aria-pressed", on ? "true" : "false"); store.set(K_WIDE, on ? "1" : "0"); }
function startTimer() { stopTimer(); TIMER = setInterval(() => { if (!document.hidden && OPEN && !DRAG && !EDIT) { delete CACHE[SEC]; render(true); } }, 5 * 60000); }
function stopTimer() { if (TIMER) clearInterval(TIMER); TIMER = null; }

HANDLE.addEventListener("click", () => setOpen(true, { focus: true }));
$("#sd-close").addEventListener("click", () => setOpen(false, { focus: true }));
$("#sd-wide").addEventListener("click", () => setWide(!SIDE.classList.contains("wide")));
$$(".sd-nav [data-sd]").forEach(b => b.addEventListener("click", () => { SEC = b.dataset.sd; store.set(K_SEC, SEC); render(); }));
$(".sd-nav").addEventListener("keydown", ev => {   // arrow keys move between the five tabs
  if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
  const ks = Object.keys(SECS), i = ks.indexOf(SEC), n = ks[(i + (ev.key === "ArrowRight" ? 1 : ks.length - 1)) % ks.length];
  ev.preventDefault(); SEC = n; store.set(K_SEC, SEC); render(); $(`#sdt-${n}`).focus();
});
const layerOpen = () => !!($("#pal:not([hidden])") || $("#dlg:not([hidden])") || $("#drawer:not([hidden])") || $("#veil:not([hidden])"));
document.addEventListener("keydown", ev => {   // capture: decide before crm.js closes its own layers on the same key
  if (APP.hidden || layerOpen()) return;
  const ae = document.activeElement, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(ae?.tagName || "") || ae?.isContentEditable;
  if (ev.key === "Escape" && OPEN && SIDE.contains(ae)) {
    if (EDIT) { EDIT = null; renderTodos(); return; }
    ev.stopPropagation(); setOpen(false, { focus: true }); return;
  }
  if (!typing && !ev.metaKey && !ev.ctrlKey && !ev.altKey && ev.key === "[") { ev.preventDefault(); setOpen(!OPEN, { focus: true }); }
}, true);

/* show the handle + panel only with the dashboard (signed-in founder) */
function syncApp() {
  const on = !APP.hidden;
  HANDLE.hidden = SIDE.hidden = !on;
  if (on) { setWide(store.get(K_WIDE) === "1" && !PHONE.matches); if (OPEN) setOpen(true); else { SIDE.inert = true; SIDE.setAttribute("aria-hidden", "true"); } }
  else { stopTimer(); stopRealtime(); CACHE = {}; ME = null; SIDE.classList.remove("open"); HANDLE.setAttribute("aria-expanded", "false"); }
}
new MutationObserver(syncApp).observe(APP, { attributes: true, attributeFilter: ["hidden"] });
syncApp();

async function me() {
  if (ME) return ME;
  const { data } = await sb().auth.getSession(); const u = data && data.session && data.session.user; if (!u) return null;
  const p = await must(sb().from("profiles").select("id,name,email").eq("id", u.id).maybeSingle()).catch(() => null);
  const nm = (p && p.name) || u.email || "";
  ME = { id: u.id, name: nm, who: /simas/i.test(nm + " " + u.email) ? "Simas" : /benas/i.test(nm + " " + u.email) ? "Benas" : "Both" };
  return ME;
}

/* ---------------- render ---------------- */
const LOAD = { expenses: () => panel("expenses"), email: () => panel("ab_tests"), clients: loadClients, weekly: loadWeekly, todos: loadTodos };
const VIEW = { expenses: viewExpenses, email: viewEmail, clients: viewClients, weekly: viewWeekly, todos: viewTodos };
async function render(quiet) {
  if (!sb()) return;
  $$(".sd-nav [data-sd]").forEach(b => { const on = b.dataset.sd === SEC; b.setAttribute("aria-selected", on ? "true" : "false"); b.tabIndex = on ? 0 : -1; });
  BODY.setAttribute("aria-labelledby", `sdt-${SEC}`);
  SUB.textContent = SECS[SEC];
  if (SEC === "todos") startRealtime(); else stopRealtime();
  const sec = SEC, seq = ++SEQ;
  if (!quiet || !CACHE[sec]) { BODY.innerHTML = `<div class="sd-sk" aria-label="Loading"><i></i><i></i><i></i></div>`; FOOT.textContent = ""; }
  try {
    const data = CACHE[sec] || (CACHE[sec] = await LOAD[sec]());
    if (seq !== SEQ || sec !== SEC) return;
    BODY.innerHTML = VIEW[sec](data); FOOT.innerHTML = footOf(sec, data);
    applyVars(BODY); if (sec === "todos") wireBoard();
  } catch (e) {
    if (seq !== SEQ) return; delete CACHE[sec];
    BODY.innerHTML = `<p class="sd-err">Couldn't load this part. ${esc(String(e && e.message || e).slice(0, 140))}</p><button type="button" class="act" data-sd-retry>${ic("refresh")}Try again</button>`;
    $("[data-sd-retry]", BODY)?.addEventListener("click", () => render());
  }
}
function applyVars(root) {
  const els = $$("[data-v]", root);
  const go = () => els.forEach(el => el.dataset.v.split(";").forEach(pair => { const i = pair.indexOf(":"); if (i > 0) el.style.setProperty("--" + pair.slice(0, i), pair.slice(i + 1)); }));
  RM ? go() : requestAnimationFrame(() => requestAnimationFrame(go));
}
function footOf(sec, d) {
  if (sec === "expenses") return d ? `From the Beju Finance sheet (Expenses tab) · synced ${esc(ago(d.updated_at))}` : "";
  if (sec === "email") return d ? `From Instantly, per variant · synced ${esc(ago(d.updated_at))}` : "";
  if (sec === "clients") return d && d.lastDelivery ? `From the Drive delivery index · newest video ${esc(dLabel(d.lastDelivery))}` : "";
  if (sec === "weekly") return "Weeks run Monday to Sunday (Vilnius). This week is compared with the same days of last week.";
  if (sec === "todos") return "Drag cards between columns · both founders see changes live";
  return "";
}
const empty = t => `<p class="empty">${esc(t)}</p>`;
const kpi = (label, val, sub) => `<div class="tile sd-kpi"><span class="ct">${esc(label)}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
const barRow = (label, val, frac, cls = "") => `<div class="sd-bar"><span>${esc(label)}</span><span class="v">${val}</span><div class="bar ${cls}"><i data-v="w:${Math.max(2, Math.round(frac * 100))}%"></i></div></div>`;

/* ---------------- 1. expenses ---------------- */
function viewExpenses(row) {
  const d = row && row.data;
  if (!d || !Array.isArray(d.rows)) return empty("No expenses data yet. It arrives with the next hourly sync.");
  const ym = dayOf(Date.now()).slice(0, 7), lastYm = addDays(ym + "-01", -1).slice(0, 7);
  const m = Object.fromEntries((d.by_month || []).map(x => [x.ym, x.eur]));
  const sp = d.split || {}, pk = sp.out_of_pocket || {};
  const maxCat = Math.max(1, ...(d.by_category || []).map(x => x.eur));
  const settle = sp.settle ? `${esc(sp.settle.from)} → ${esc(sp.settle.to)} <b class="mono">${eur(sp.settle.eur)}</b> to even out` : "Even";
  return `<div class="sd-sec">
    <div class="sd-kpis">${kpi("This month", eur(m[ym] || 0), ymLabel(ym))}${kpi("Last month", eur(m[lastYm] || 0), ymLabel(lastYm))}${kpi("All time", eur(d.total_eur), `${d.rows.length} expenses`)}${d.run_rate_eur ? kpi("Subscriptions / month", eur(d.run_rate_eur), "active run-rate") : ""}</div>
    <h3 class="sd-h3">50/50 split <small>out of pocket</small></h3>
    <div class="tile sd-list sd-bars">
      <div class="sd-bar"><span>Simas paid</span><span class="v">${eur(pk.Simas || 0)}</span></div>
      <div class="sd-bar"><span>Benas paid</span><span class="v">${eur(pk.Benas || 0)}</span></div>
      <div class="sd-bar"><span>Half each</span><span class="v">${eur(sp.half_each || 0)}</span></div>
      <p class="sd-note">${settle}. ${esc(sp.note || "")}</p>
    </div>
    <h3 class="sd-h3">By category</h3>
    <div class="tile sd-bars">${(d.by_category || []).map(x => barRow(x.category, eur(x.eur), x.eur / maxCat)).join("") || empty("No categories yet.")}</div>
    <h3 class="sd-h3">By payer</h3>
    <div class="tile sd-bars">${(d.by_payer || []).map(x => barRow(x.payer, eur(x.eur), x.eur / Math.max(1, d.total_eur), "c-green")).join("")}</div>
    <h3 class="sd-h3">Every expense <small>newest first</small></h3>
    <div class="sd-list">${d.rows.map(e => `<div class="tile sd-row"><div class="grow"><span class="t">${esc(e.vendor)}${e.item ? ` · ${esc(e.item)}` : ""}</span><span class="s">${esc(dLabel(e.date))} · ${esc(e.category || "Other")} · ${esc(e.billing || "")} · paid by ${esc(e.paid_by || "?")}</span></div><span class="v" title="${esc(e.currency !== "EUR" ? `${e.amount} ${e.currency}` : "")}">${eur(e.eur)}</span></div>`).join("")}</div>
  </div>`;
}

/* ---------------- 2. email tests ---------------- */
function viewEmail(row) {
  const d = row && row.data;
  if (!d || !Array.isArray(d.campaigns)) return empty("No A/B data yet. It arrives with the next hourly sync.");
  const w = d.what || {}, r = d.rules || {};
  const cell = (x, k) => x[k] == null ? "—" : k === "pos_rate" ? x[k].toFixed(1) + "%" : int(x[k]);
  const vchip = v => /B wins/.test(v) ? "chip g" : /A wins/.test(v) ? "chip b" : /hasn't|No B/.test(v) ? "chip" : "chip o";
  return `<div class="sd-sec">
    <div class="tile sd-what"><div><span class="sd-tag">A</span> ${esc(w.A || "")}</div><div><span class="sd-tag">B</span> ${esc(w.B || "")}</div><div class="mut">${esc(w.FA || "")} ${esc(w.FB || "")}</div></div>
    ${d.campaigns.map(c => `<div class="tile sd-ab">
      <div class="sd-ab-h"><b>${esc(c.name)}</b><span class="mut">${c.since ? `B since ${esc(dLabel(c.since))}` : "no B"}</span></div>
      ${(c.steps || []).map(s => `<table><thead><tr><th>${esc(s.step)}</th><th>Sent</th><th>Replies</th><th>Positive</th><th>Rate</th></tr></thead><tbody>
        <tr><td>A</td><td>${cell(s.A, "sent")}</td><td>${cell(s.A, "replies")}</td><td>${cell(s.A, "positives")}</td><td>${cell(s.A, "pos_rate")}</td></tr>
        <tr><td>B</td><td>${cell(s.B, "sent")}</td><td>${cell(s.B, "replies")}</td><td>${cell(s.B, "positives")}</td><td>${cell(s.B, "pos_rate")}</td></tr></tbody></table>
        <div><span class="${vchip(s.verdict)}">${esc(s.verdict)}</span></div>`).join("")}
    </div>`).join("")}
    <p class="sd-note">A verdict needs ${esc(r.min_sends || 300)}+ sends per side and ${esc(r.min_pos || 8)}+ positives. ${esc(d.note || "")}</p>
  </div>`;
}

/* ---------------- 3. clients + their videos ---------------- */
async function loadClients() {
  const [clients, deliveries, payments, retainers] = await Promise.all([
    all("clients", "id,name,emails,show,drive_folder,source"),
    all("deliveries", "id,client_id,title,order_name,kind,duration_s,link,delivered_at", q => q.order("delivered_at", { ascending: false }).order("id")),
    all("payments", "client_id,amount,refunded,paid_at"),
    all("retainers", "email,name,amount,interval,status").catch(() => []),
  ]);
  const vids = {}, paid = {}, last = {};
  deliveries.forEach(v => { (vids[v.client_id] = vids[v.client_id] || []).push(v); if (!last[v.client_id] || v.delivered_at > last[v.client_id]) last[v.client_id] = v.delivered_at; });
  payments.forEach(p => { if (!p.refunded) paid[p.client_id] = (paid[p.client_id] || 0) + (+p.amount || 0); });
  const ret = {}; retainers.forEach(r => { if (/active|trialing|past_due/i.test(r.status || "")) ret[lc(r.email)] = r; });
  const list = clients.map(c => ({ ...c, vids: vids[c.id] || [], paid: paid[c.id] || 0, last: last[c.id] || "", ret: (c.emails || []).map(lc).map(e => ret[e]).find(Boolean) || null }))
    .filter(c => c.vids.length || c.paid || c.ret)
    .sort((a, b) => (b.last || "").localeCompare(a.last || "") || b.paid - a.paid);
  return { list, lastDelivery: deliveries.reduce((m, v) => v.delivered_at > m ? v.delivered_at : m, "") };
}
const fdur = s => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "";
function clientItem(c) {
  const on = OPENED.has(c.id), orders = {};
  c.vids.forEach(v => (orders[v.order_name || "Videos"] = orders[v.order_name || "Videos"] || []).push(v));
  return `<div class="tile sd-cl${on ? " on" : ""}" data-q="${esc(lc([c.name, c.show, ...(c.emails || [])].join(" ")))}">
    <button type="button" class="sd-row" data-cl="${esc(c.id)}" aria-expanded="${on}"><div class="grow"><span class="t">${esc(c.name || "Client")}</span><span class="s">${esc([c.show, c.last ? `last video ${dLabel(c.last)}` : "no videos yet"].filter(Boolean).join(" · "))}</span></div>
      ${c.ret ? `<span class="chip g">${usd(c.ret.amount)}/${esc((c.ret.interval || "month").replace(/ly$/, ""))}</span>` : ""}<span class="chip">${int(c.vids.length)} video${c.vids.length === 1 ? "" : "s"}</span>${c.paid ? `<span class="v">${usd(c.paid)}</span>` : ""}${ic("chev").replace('class="ic"', 'class="ic ch"')}</button>
    ${on ? `<div class="sd-vids">${Object.entries(orders).map(([o, vs]) => `<div class="sd-ord">${esc(o)}</div>${vs.map(v => `<a class="sd-vid" href="${esc(v.link)}" target="_blank" rel="noopener noreferrer">${ic("play")}<span>${esc(v.title || "Video")}</span><small>${esc(fdur(v.duration_s))} · ${esc(dLabel(v.delivered_at))}</small></a>`).join("")}`).join("") || empty("No videos in the delivery index yet.")}</div>` : ""}
  </div>`;
}
function viewClients(d) {
  if (!d.list.length) return empty("No clients with videos or payments yet.");
  const n = d.list.reduce((s, c) => s + c.vids.length, 0);
  return `<div class="sd-sec">
    <div class="sd-kpis">${kpi("Clients", int(d.list.length), "paid or delivered")}${kpi("Videos delivered", int(n), "all clients")}</div>
    <input class="sd-q" id="sd-cq" type="search" placeholder="Find a client" aria-label="Find a client" autocomplete="off" spellcheck="false">
    <div class="sd-list" id="sd-cl">${d.list.map(clientItem).join("")}</div>
  </div>`;
}
BODY.addEventListener("click", ev => {
  const b = ev.target.closest("[data-cl]"); if (!b || SEC !== "clients" || !CACHE.clients) return;
  const id = b.dataset.cl; OPENED.has(id) ? OPENED.delete(id) : OPENED.add(id);
  const c = CACHE.clients.list.find(x => x.id === id), box = b.closest(".sd-cl");
  if (c && box) { box.outerHTML = clientItem(c); $(`[data-cl="${CSS.escape(id)}"]`, BODY)?.focus(); }
});
BODY.addEventListener("input", ev => {
  if (ev.target.id !== "sd-cq") return;
  const q = lc(ev.target.value); $$("#sd-cl [data-q]", BODY).forEach(el => { el.hidden = !!q && !el.dataset.q.includes(q); });
});

/* ---------------- 4. weekly analysis ---------------- */
async function loadWeekly() {
  const t = dayOf(Date.now()), w0 = monday(t), from = addDays(w0, -7 * 7);
  const [daily, interested, pipe, payments, deliveries] = await Promise.all([
    all("campaign_daily", "day,sent,new_leads,replies,replies_auto,opportunities", q => q.gte("day", from)),
    all("interested_leads", "email,interest_changed_at"),
    all("pipeline", "email,yes_at,delivered_at"),
    all("payments", "amount,refunded,paid_at", q => q.gte("paid_at", from)),
    all("deliveries", "delivered_at", q => q.gte("delivered_at", from)),
  ]);
  const weeks = []; for (let i = 7; i >= 0; i--) weeks.push(addDays(w0, -7 * i));
  const W = Object.fromEntries(weeks.map(w => [w, { w, now: w === w0, sent: 0, newLeads: 0, replies: 0, pos: 0, samples: 0, shorts: 0, pays: 0, rev: 0 }]));
  const k = Math.round((new Date(t + "T12:00:00Z") - new Date(w0 + "T12:00:00Z")) / 864e5) + 1, pw0 = addDays(w0, -7), pcut = addDays(pw0, k);
  const P = { sent: 0, newLeads: 0, replies: 0, pos: 0, samples: 0, shorts: 0, pays: 0, rev: 0, days: k };   // last week, same weekdays as this week so far
  const wk = d => { const m = monday(d); return W[m]; };
  const inP = d => d >= pw0 && d < pcut;
  daily.forEach(r => { const x = wk(r.day); if (x) { x.sent += +r.sent || 0; x.newLeads += +r.new_leads || 0; x.replies += +r.replies || 0; } if (inP(r.day)) { P.sent += +r.sent || 0; P.newLeads += +r.new_leads || 0; } });
  const first = {};   // positive = Instantly "interested" or a free-sample yes; counted once, in the week it first happened
  interested.forEach(r => { const d = dayOf(r.interest_changed_at); if (d) { const e = lc(r.email); if (!first[e] || d < first[e]) first[e] = d; } });
  pipe.forEach(r => { const d = dayOf(r.yes_at); if (d) { const e = lc(r.email); if (!first[e] || d < first[e]) first[e] = d; } });
  Object.values(first).forEach(d => { const x = wk(d); if (x) x.pos++; if (inP(d)) P.pos++; });
  pipe.forEach(r => { const d = dayOf(r.delivered_at); const x = d && wk(d); if (x) x.samples++; });
  payments.forEach(p => { if (p.refunded) return; const d = dayOf(p.paid_at), x = wk(d); if (x) { x.pays++; x.rev += +p.amount || 0; } if (inP(d)) { P.pays++; P.rev += +p.amount || 0; } });
  deliveries.forEach(v => { const x = wk(v.delivered_at); if (x) x.shorts++; });
  return { weeks: weeks.map(w => W[w]), prevSoFar: P };
}
function delta(a, b, f, days) { if (!b) return `last week's first ${days} day${days === 1 ? "" : "s"}: ${f(b)}`; const r = (a - b) / b; return `<span class="${r >= 0 ? "sd-up" : "sd-dn"}">${r >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(r * 100))}%</span> vs the same ${days} day${days === 1 ? "" : "s"} last week (${f(b)})`; }
function cols(weeks, key, cls, fmt) {
  const mx = Math.max(1, ...weeks.map(w => w[key]));
  return `<div class="sd-cols ${cls}" role="img" aria-label="${esc(weeks.map(w => `${dLabel(w.w)}: ${fmt(w[key])}`).join(", "))}">${weeks.map(w => `<i class="${w.now ? "now" : ""}" data-v="h:${Math.max(2, Math.round(100 * w[key] / mx))}%" title="${esc(`${dLabel(w.w)}: ${fmt(w[key])}`)}"></i>`).join("")}</div>
    <div class="sd-axis" aria-hidden="true">${weeks.map((w, i) => `<span>${esc(i === 0 || w.w.slice(5, 7) !== weeks[i - 1].w.slice(5, 7) ? dLabel(w.w) : dLabel(w.w).split(" ")[1])}</span>`).join("")}</div>`;
}
function viewWeekly(d) {
  const ws = d.weeks, now = ws[ws.length - 1], prev = d.prevSoFar, n = prev.days;
  if (!ws.some(w => w.sent || w.pos || w.rev)) return empty("No weekly data yet.");
  return `<div class="sd-sec">
    <div class="sd-kpis">
      ${kpi("Positive replies", int(now.pos), delta(now.pos, prev.pos, int, n))}
      ${kpi("Per 100 new leads", now.newLeads ? pct(now.pos, now.newLeads) : "—", prev.newLeads ? `same days last week ${pct(prev.pos, prev.newLeads)}` : "this week so far")}
      ${kpi("Revenue", usd(now.rev), delta(now.rev, prev.rev, usd, n))}
      ${kpi("Emails sent", int(now.sent), delta(now.sent, prev.sent, int, n))}
    </div>
    <h3 class="sd-h3">Positive replies per week</h3>
    <div class="tile">${cols(ws, "pos", "c-green", int)}</div>
    <h3 class="sd-h3">Revenue per week</h3>
    <div class="tile">${cols(ws, "rev", "c-blue", usd)}</div>
    <h3 class="sd-h3">Week by week <small>newest first</small></h3>
    <div class="tile sd-wk"><table><thead><tr><th>Week of</th><th>New leads</th><th>Sent</th><th>Replies</th><th>Positive</th><th>Rate</th><th>Samples</th><th>Shorts</th><th>Paid</th></tr></thead><tbody>
      ${ws.slice().reverse().map(w => `<tr class="${w.now ? "now" : ""}"><td>${esc(dLabel(w.w))}${w.now ? " · now" : ""}</td><td>${int(w.newLeads)}</td><td>${int(w.sent)}</td><td>${int(w.replies)}</td><td>${int(w.pos)}</td><td>${w.newLeads ? pct(w.pos, w.newLeads) : "—"}</td><td>${int(w.samples)}</td><td>${int(w.shorts)}</td><td>${w.pays ? `${usd(w.rev)} · ${w.pays}` : "—"}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="sd-note">Positive = marked interested in Instantly or said yes to a free sample, counted once in the week it first happened. Rate = positives per 100 new leads emailed that week. Samples = free samples delivered. Shorts = paid videos in the delivery index. Paid = Stripe payments (USD) and how many.</p>
  </div>`;
}

/* ---------------- 5. to-do board ---------------- */
const COLS = [["todo", "To do"], ["doing", "Doing"], ["done", "Done"]];
async function loadTodos() { await me(); return all("todo_cards", "*", q => q.order("pos").order("id")); }
const cardsIn = (list, col) => list.filter(c => c.col === col).sort((a, b) => a.pos - b.pos || a.id - b.id);
function cardHtml(c) {
  if (EDIT && EDIT.id === c.id) return formHtml(c);
  const oc = c.owner === "Simas" ? "chip b" : c.owner === "Benas" ? "chip o" : "chip";
  return `<div class="tile sd-card${c.col === "done" ? " done" : ""}" data-card="${c.id}" tabindex="0" aria-roledescription="draggable card" aria-label="${esc(c.title)}, ${esc(c.owner)}. Alt plus arrow keys move it.">
    <div class="tt">${esc(c.title)}</div>${c.detail ? `<div class="dd">${esc(c.detail)}</div>` : ""}
    <div class="ft"><span class="${oc}">${esc(c.owner)}</span><span class="sp"></span>
      <button type="button" class="mini" data-mv="-1" aria-label="Move left" title="Move left"><svg aria-hidden="true"><use href="#i-back"/></svg></button>
      <button type="button" class="mini" data-mv="1" aria-label="Move right" title="Move right"><svg aria-hidden="true"><use href="#i-chev"/></svg></button>
      <button type="button" class="mini" data-ed aria-label="Edit" title="Edit"><svg aria-hidden="true"><use href="#i-edit"/></svg></button></div>
  </div>`;
}
function formHtml(c) {
  const o = c ? c.owner : (ME && ME.who) || "Both";
  return `<form class="tile sd-form" data-form="${c ? c.id : "new"}" data-col="${esc(c ? c.col : EDIT.col)}">
    <textarea name="title" rows="2" maxlength="300" required placeholder="What needs doing?" aria-label="Card title">${esc(c ? c.title : "")}</textarea>
    <textarea name="detail" rows="2" maxlength="4000" placeholder="Details (optional)" aria-label="Details">${esc(c && c.detail ? c.detail : "")}</textarea>
    <div class="seg" role="group" aria-label="Owner">${["Simas", "Benas", "Both"].map(x => `<button type="button" data-own="${x}" class="${x === o ? "on" : ""}" aria-pressed="${x === o}">${x}</button>`).join("")}</div>
    <div class="row">${c ? `<button type="button" class="act no del" data-del>Delete</button>` : ""}<button type="button" class="act" data-cancel>Cancel</button><button type="submit" class="act go">${c ? "Save" : "Add card"}</button></div>
  </form>`;
}
function viewTodos(list) {
  return `<div class="sd-board" id="sd-board">${COLS.map(([k, label]) => {
    const cs = cardsIn(list, k);
    return `<section class="sd-col" data-col="${k}" aria-label="${label}"><div class="sd-col-h"><span>${label}</span><span class="chip">${cs.length}</span></div>
      ${EDIT && EDIT.id === "new" && EDIT.col === k ? formHtml(null) : `<button type="button" class="sd-add" data-add="${k}"><svg aria-hidden="true"><use href="#i-plus"/></svg>Add a card</button>`}
      ${cs.map(cardHtml).join("")}${!cs.length && !(EDIT && EDIT.col === k) ? `<p class="empty">Nothing here yet.</p>` : ""}</section>`;
  }).join("")}</div>`;
}
function renderTodos() {
  if (SEC !== "todos" || !CACHE.todos) return;
  const sx = $("#sd-board")?.scrollLeft || 0, sy = BODY.scrollTop;
  BODY.innerHTML = viewTodos(CACHE.todos); wireBoard();
  $("#sd-board").scrollLeft = sx; BODY.scrollTop = sy;
  const f = $(".sd-form textarea", BODY); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
}
function posBetween(list, col, idx, skipId) {   // a pos between the neighbours at index idx (cards sorted by pos)
  const cs = cardsIn(list, col).filter(c => c.id !== skipId), a = cs[idx - 1], b = cs[idx];
  return a && b ? (a.pos + b.pos) / 2 : a ? a.pos + 1024 : b ? b.pos - 1024 : 1024;
}
async function saveCard(id, patch) {
  const list = CACHE.todos, c = list.find(x => x.id === id), before = { ...c };
  Object.assign(c, patch); renderTodos();
  try { await must(sb().from("todo_cards").update(patch).eq("id", id)); }
  catch (e) { Object.assign(c, before); renderTodos(); toast("Couldn't save that card. Check your connection."); }
}
async function moveCard(id, col, idx) {
  const list = CACHE.todos; await saveCard(id, { col, pos: posBetween(list, col, idx, id) });
}
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
    if (id && t.dataset.mv) { const c = list.find(x => x.id === id), i = COLS.findIndex(x => x[0] === c.col) + +t.dataset.mv; if (COLS[i]) await moveCard(id, COLS[i][0], 0); return; }
  });
  board.addEventListener("submit", async ev => {
    ev.preventDefault();
    const f = ev.target, title = f.title.value.trim(), detail = f.detail.value.trim() || null, owner = $("[data-own].on", f)?.dataset.own || "Both";
    if (!title) { f.title.focus(); return; }
    const fid = f.dataset.form;
    if (fid === "new") {
      const col = f.dataset.col, row = { title, detail, owner, col, pos: posBetween(CACHE.todos, col, 0), created_by: (ME && ME.name) || null };
      EDIT = null;
      try { const ins = await must(sb().from("todo_cards").insert(row).select().single()); CACHE.todos.push(ins); renderTodos(); }
      catch (e) { renderTodos(); toast("Couldn't add that card. Check your connection."); }
    } else { EDIT = null; await saveCard(+fid, { title, detail, owner }); }
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
    ev.preventDefault();
    moveCard(id, col, idx).then(() => $(`[data-card="${id}"]`, BODY)?.focus());
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
  const cols = $$(".sd-col", BODY), col = cols.find(c => { const b = c.getBoundingClientRect(); return x >= b.left && x <= b.right && y >= b.top - 40 && y <= b.bottom + 80; });
  cols.forEach(c => c.classList.toggle("drop", c === col));
  if (col) {
    const others = $$("[data-card]:not([hidden])", col), next = others.find(el => { const b = el.getBoundingClientRect(); return y < b.top + b.height / 2; });
    next ? next.before(D.ph) : col.append(D.ph);
    D.col = col.dataset.col; D.idx = next ? others.indexOf(next) : others.length;
  }
  const sbx = BODY.getBoundingClientRect();   // auto-scroll near the edges
  if (y < sbx.top + 40) BODY.scrollTop -= 12; else if (y > sbx.bottom - 40) BODY.scrollTop += 12;
  const bd = $("#sd-board"); if (bd) { const bb = bd.getBoundingClientRect(); if (x < bb.left + 30) bd.scrollLeft -= 14; else if (x > bb.right - 30) bd.scrollLeft += 14; }
}
function dragMove(ev) {
  const D = DRAG; if (!D || ev.pointerId !== D.pid) return;
  D.lx = ev.clientX; D.ly = ev.clientY;
  const moved = Math.hypot(ev.clientX - D.sx, ev.clientY - D.sy);
  if (!D.on) {
    if (D.touch) { if (moved > 8) cleanup(); return; }   // a finger that moves before the hold = a scroll
    if (moved < 6) return;
    liftUp(D);
  }
  ev.preventDefault(); place(D, ev.clientX, ev.clientY);
}
function cleanup() {
  const D = DRAG; if (D && D.timer) clearTimeout(D.timer);
  document.removeEventListener("pointermove", dragMove); document.removeEventListener("pointerup", dragEnd); document.removeEventListener("pointercancel", dragEnd);
  DRAG = null; return D;
}
function dragEnd(ev) {
  if (!DRAG || (ev.pointerId !== undefined && ev.pointerId !== DRAG.pid)) return;
  const D = cleanup();
  if (!D.on) return;
  D.lift.remove(); D.ph.remove(); D.card.hidden = false;
  $$(".sd-col", BODY).forEach(c => c.classList.remove("drop"));
  if (ev.type === "pointercancel" || !D.col) return renderTodos();
  moveCard(D.id, D.col, D.idx);
}
document.addEventListener("touchmove", ev => { if (DRAG && DRAG.on) ev.preventDefault(); }, { passive: false });
document.addEventListener("contextmenu", ev => { if (DRAG && ev.target.closest && ev.target.closest(".sd-card")) ev.preventDefault(); });

/* live updates from the other founder */
let RT_T = null;
function startRealtime() {
  if (CH || !sb()) return;
  CH = sb().channel("side-todos").on("postgres_changes", { event: "*", schema: "public", table: "todo_cards" }, () => {
    clearTimeout(RT_T); RT_T = setTimeout(async () => {
      if (DRAG || EDIT || SEC !== "todos") return;
      try { CACHE.todos = await all("todo_cards", "*", q => q.order("pos").order("id")); renderTodos(); } catch {}
    }, 400);
  }).subscribe();
}
function stopRealtime() { if (CH) { try { sb().removeChannel(CH); } catch {} CH = null; } }
})();
