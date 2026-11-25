/* BEJÚ founder CRM: Funnel clients page (?p=funnel). SIMAS 11-24: "a tab that tracks our funnel clients: clients that paid for more than
   videos, based on the scope track everything we promised (sites we build for them, posting, videos, everything else), and see clearly
   whether we are on track." A page next to Clients (Clients is unchanged).
   PAGE: four summary tiles, then one card per funnel client (clients.funnel = true): name, the badge (BEHIND: something past due that is
   not live and not waiting on the client · AT RISK: something due within 48 h that is not live · ON TRACK: everything due by now is live
   or waiting on the client), plan, progress (live / every item not dropped), doing now, waiting on the client, next due.
   CLIENT (SIMAS 11-25: "when I press a client it puts me in like almost fullscreen and see cards and squares on what's in progress, what
   we are doing and other tasks that we promised in her scope, categorised; follow the CRM style and make it clean"): a near-fullscreen
   panel (the delivery board panel's look; full screen on a phone):
     four squares: Promises live · Doing now · Waiting on client · Next due (Overdue on us when something is late);
     WHAT WE'RE DOING (SIMAS 11-25): a card per item in progress or waiting on a founder, newest update first (area, title, the latest
       note + when it was updated, description, due, who, link, the status one tap away); any Claude logs work with crm.funnel_work();
     UP NEXT: the items not started yet that are due within 7 days (or overdue), as cards;
     WAITING ON THE CLIENT: the items that wait on them, as cards;
     FOUR CATEGORIES (SIMAS 11-25, replace the 8 area squares): Website (websites + seo) · Content (shorts + posting) · Funnel & sales
       (lead_magnets + setup + reports + other) · What <first name> asked (area asks + the client's inbound emails from public.threads).
       Each tile counts done / doing / waiting / overdue and who owns the open ones; click it for every task in it as a full card (whole
       note, due, status, owner chip coloured per owner: Simas, Benas, Both, Claude). Content also shows the Shorts from the delivery
       board (public.client_items); the asks category lists the client's emails, newest first, tap one to read it;
     CLIENT INFO: plan, email, links and the client notes (folded when long).
   ?fcl=<client id> in the address opens that client's panel. Esc, the X, the dimmed page or any sidebar item closes it. On a computer the
   panel leaves the sidebar open and clickable (funnel.css); on a phone it is full screen.
   Data: public.scope_items + clients.funnel (supabase/crm_scope_items1.sql; note + waiting_founder + Claude owners: crm_scope_items3.sql), clients (links + notes), client_items, retainers; read once per
   page load, then a targeted re-read after realtime events on this page's OWN channels. A database without the table or the column shows
   a calm empty state. Writes: scope_items.status only, as the signed-in founder (row-level security, is_admin()); optimistic: on an error
   it goes back and a toast says why. Claude keeps the rows current; founders read them here.
   Registered with side.js through window.BEJU_SIDE_PAGES, so this file loads before side.js. CSP: no inline styles (CSSOM only). */
(() => {
"use strict";
const HTML = document.documentElement, RMQ = matchMedia("(prefers-reduced-motion: reduce)");
const motion = () => !RMQ.matches && HTML.dataset.motion !== "calm";
const esc = s => String(s ?? "").replace(/[&<>"'`]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" }[c]));
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const lc = s => String(s || "").toLowerCase().trim();
const ms = t => { const v = t ? +new Date(t) : 0; return isFinite(v) ? v : 0; };
const webUrl = v => { try { const u = new URL(String(v || "").trim()); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
const H48 = 48 * 36e5, D7 = 7 * 864e5;

/* the areas, in the order the client panel shows them: [id, name, icon] */
const AREAS = [["setup", "Setup & calls", "check"], ["websites", "Websites", "link"], ["lead_magnets", "Lead magnets & emails", "mail"], ["posting", "Posting", "send"],
  ["shorts", "Shorts", "film"], ["seo", "SEO & GEO", "search"], ["reports", "Reports & calls", "chart"], ["other", "Other", "star"], ["asks", "Asked", "mail"]];
const AREA_L = Object.fromEntries(AREAS.map(a => [a[0], a[1]])), AREA_I = Object.fromEntries(AREAS.map(a => [a[0], a[2]]));
/* SIMAS 11-25: the four categories on the client board: [id, name ("{n}" = the client's first name), icon, areas] */
const CATS = [["web", "Website", "link", ["websites", "seo"]], ["content", "Content", "film", ["shorts", "posting"]],
  ["funnel", "Funnel & sales", "chart", ["lead_magnets", "setup", "reports", "other"]], ["asks", "What {n} asked", "mail", ["asks"]]];
const CAT_OF = Object.fromEntries(CATS.flatMap(c => c[3].map(a => [a, c[0]])));
const OWN = { simas: "o-simas", benas: "o-benas", both: "o-both", claude: "o-claude", "simas's claude": "o-claude", "benas's claude": "o-claude" };
const TZ = "Europe/Vilnius", HM = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const ST = [["not_started", "Not started"], ["in_progress", "In progress"], ["waiting_client", "Waiting on client"], ["waiting_founder", "Waiting on founder"], ["live", "Live"], ["dropped", "Dropped"]];
const ST_L = Object.fromEntries(ST);
const SRANK = { in_progress: 0, waiting_founder: 1, waiting_client: 2, not_started: 3, live: 4, dropped: 5 };
const BADGE = { behind: "Behind", risk: "At risk", on: "On track" };
const RANK = { behind: 0, risk: 1, on: 2 };
const PER = r => ({ month: "mo", year: "yr", week: "wk", day: "day" })[lc(r && r.interval) || "month"] || "mo";

let A = null;               // side.js's helpers (sb, all, toast, dayOf, dLabel, usd, el)
let D = null;               // { clients, missing }: the funnel clients (with .plan); missing = the table or the column is not there yet
let ITEMS = null;           // scope_items rows; null = not readable (not created yet)
let CI = null;              // client_items rows (id, client_id, status); null = not readable
let PAN = null;             // the open client panel: { id, pan, scrim, head, body }
let MENU = null;            // the open status menu on a card: "<where>:<item id>" (d doing now, u up next, w waiting)
let TH = null;              // the funnel clients' inbound emails (public.threads); null = not readable
let CAT = null;             // the open category on the client board (CATS id) or null = the overview
const MAIL = new Set();     // emails unfolded (msg ids)
let MAIL_ALL = false;       // every email listed, not just the newest 8
const DET = new Set();      // card notes unfolded (card keys)
let NOTES_OPEN = false;     // the client notes are unfolded
const CH = {}, CHT = {}, AT = {};   // realtime: channel, pending re-read timer, last read time (per table)

/* ---------------- data ---------------- */
const readItems = () => A.all("scope_items", "*").catch(() => null);
const readCI = () => A.all("client_items", "id,client_id,status").catch(() => null);
async function load(api) {
  A = api;
  const [cl, items, ci, rets] = await Promise.all([
    api.all("clients", "id,name,emails,show,funnel,website,instagram,youtube,drive_folder,notes", q => q.eq("funnel", true)).catch(() => null),
    readItems(), readCI(),
    api.all("retainers", "email,amount,interval,status,cancel_at_period_end").catch(() => []),
  ]);
  ITEMS = items; CI = ci; AT.scope_items = AT.client_items = Date.now();
  /* 11-24 audit (C1): the plan that renews wins over one ending at period end, then the larger amount */
  const better = (a, b) => !a ? b : (!!a.cancel_at_period_end !== !!b.cancel_at_period_end ? (a.cancel_at_period_end ? b : a) : ((+b.amount || 0) > (+a.amount || 0) ? b : a));
  const ret = {}; (rets || []).forEach(r => { if (/active|trialing|past_due/i.test(r.status || "")) { const k = lc(r.email); ret[k] = better(ret[k], r); } });
  const clients = (cl || []).filter(c => c.funnel !== false).map(c => {
    const r = (c.emails || []).map(e => ret[lc(e)]).find(Boolean);
    return { id: String(c.id), name: c.name || "Client", show: c.show || "", plan: r ? `${api.usd(r.amount)} / ${PER(r)} plan` : "",
      emails: c.emails || [], website: c.website || "", instagram: c.instagram || "", youtube: c.youtube || "", drive: c.drive_folder || "", notes: c.notes || "" };
  });
  D = { clients, missing: !cl || !ITEMS };
  /* SIMAS 11-25 ("track what she writes in the email and put it in the funnel"): their inbound emails, read once per page load */
  const em = [...new Set(clients.flatMap(c => c.emails.map(lc)).filter(Boolean))];
  TH = em.length ? await api.all("threads", "msg_id,lead_email,at,subject,snippet,body", q => q.in("lead_email", em).eq("direction", "in")).catch(() => null) : [];
  if (ITEMS) live("scope_items", readItems, v => { ITEMS = v; });
  if (CI) live("client_items", readCI, v => { CI = v; });
  return D;
}
/* realtime on this page's OWN channels (a table that is not in the publication yet makes the server reject every listener on its channel):
   events coalesce into one targeted read at most every 10 s; a rejected channel is dropped and tried again in 15 min */
function live(table, read, put) {
  if (CH[table] || !A || !A.sb()) return;
  try { const ch = CH[table] = A.sb().channel("crm-live-funnel-" + table);
    ch.on("postgres_changes", { event: "*", schema: "public", table }, () => {
      if (CHT[table]) return;
      CHT[table] = setTimeout(async () => { CHT[table] = null; const rows = await read(); if (rows) { put(rows); AT[table] = Date.now(); paint(); } }, Math.max(1500, (AT[table] || 0) + 10000 - Date.now())); });
    ch.on("system", {}, m => { if (!m || m.extension !== "postgres_changes" || m.status !== "error" || CH[table] !== ch) return;
      CH[table] = null; try { A.sb().removeChannel(ch); } catch {} setTimeout(() => live(table, read, put), 15 * 6e4); });
    ch.subscribe();
  } catch { CH[table] = null; }
}

/* ---------------- model ---------------- */
const itemsOf = cid => (ITEMS || []).filter(i => String(i.client_id) === String(cid));
const byDue = (a, b) => (ms(a.due_at) || 1e15) - (ms(b.due_at) || 1e15) || a.id - b.id;
function model(c) {
  const now = Date.now(), its = itemsOf(c.id), act = its.filter(i => i.status !== "dropped"), open = act.filter(i => i.status !== "live");
  const live = act.length - open.length;
  const behind = open.filter(i => ms(i.due_at) && ms(i.due_at) < now && i.status !== "waiting_client");
  const risk = open.filter(i => ms(i.due_at) >= now && ms(i.due_at) <= now + H48);
  const state = behind.length ? "behind" : risk.length ? "risk" : "on";
  const next = open.filter(i => ms(i.due_at)).sort(byDue)[0] || null;
  return { c, its, live, total: act.length, pct: act.length ? Math.round(100 * live / act.length) : 0, behind: behind.length, risk: risk.length, state,
    n: state === "behind" ? behind.length : state === "risk" ? risk.length : 0, next,
    work: act.filter(i => i.status === "in_progress" || i.status === "waiting_founder").sort((a, b) => ms(b.updated_at) - ms(a.updated_at)),
    doing: act.filter(i => i.status === "in_progress").sort(byDue), waiting: act.filter(i => i.status === "waiting_client").sort(byDue),
    up: act.filter(i => i.status === "not_started" && ms(i.due_at) && ms(i.due_at) <= now + D7).sort(byDue), wait: act.filter(i => i.status === "waiting_client").length };
}
function shortsOf(cid) {
  if (!CI) return null;
  const r = CI.filter(i => String(i.client_id) === String(cid)), n = f => r.filter(f).length;
  return { total: r.length, sent: n(i => i.status === "sent" || i.status === "approved"), ready: n(i => i.status === "ready"), building: n(i => i.status === "building"), changes: n(i => i.status === "changes") };   // an old "approved" row was sent too
}
const dShort = t => { const now = Date.now(), d = A.dayOf(t); return d === A.dayOf(now) ? "Today" : d === A.dayOf(now + 864e5) ? "Tomorrow" : A.dLabel(d); };
const updAgo = t => { const v = ms(t); if (!v) return ""; const a = ago(v); return a === "today" ? `today ${HM.format(v)}` : a; };
const ago = t => { const v = ms(t); if (!v) return ""; const d = A.dayOf(v), n = Date.now(); return d === A.dayOf(n) ? "today" : d === A.dayOf(n - 864e5) ? "yesterday" : A.dLabel(d); };
/* a due date: [text, class] (late = past due and still on us, soon = within 48 h) */
function due(i) {
  const t = ms(i.due_at); if (!t) return ["", ""];
  const now = Date.now(), d = A.dayOf(t), lab = d === A.dayOf(now) ? "today" : d === A.dayOf(now + 864e5) ? "tomorrow" : A.dLabel(d);
  if (i.status === "live" || i.status === "dropped") return [`Due ${lab}`, ""];
  if (t < now) return i.status === "waiting_client" ? [`Was due ${lab}`, ""] : [`Overdue · ${lab}`, "late"];
  return [`Due ${lab}`, t <= now + H48 ? "soon" : ""];
}
const isLate = i => i.status !== "live" && i.status !== "dropped" && i.status !== "waiting_client" && ms(i.due_at) && ms(i.due_at) < Date.now();
const firstName = n => String(n || "").split(/\s+/).find(w => w && !/\.$/.test(w)) || "the client";   // "Dr. Ann Lee" → "Ann"
const catName = (cat, c) => cat[1].replace("{n}", firstName(c.name));
const ownChip = (o, k) => `<span class="fc-own ${OWN[lc(o)] || ""}">${esc(o)}${k != null ? ` <b>${k}</b>` : ""}</span>`;
const badge = m => `<span class="fc-badge s-${m.state}">${esc(BADGE[m.state])}${m.n ? ` · ${m.n}` : ""}</span>`;
const barOf = (live, total, cls = "") => { const pct = total ? Math.round(100 * live / total) : 0; return `<span class="fc-bar${cls}" role="img" aria-label="${live} of ${total} live"><i data-fw="${total ? Math.max(live ? 3 : 0, pct) : 0}"></i></span>`; };
const bar = m => barOf(m.live, m.total);
const lk = (u, label) => `<a class="fc-lk" href="${esc(u)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(label)}">${ic("link")}<span>Open</span></a>`;

/* ---------------- the page: summary + a card per client ---------------- */
const none = (h, p) => `<div class="card sp-card fc-none"><span class="fc-none-i">${ic("flag")}</span><b>${esc(h)}</b><p>${esc(p)}</p></div>`;
const sorted = () => D.clients.map(model).sort((a, b) => RANK[a.state] - RANK[b.state] || a.c.name.localeCompare(b.c.name));
function clientCardHTML(m) {
  const [, nk] = m.next ? due(m.next) : ["", ""];
  return `<a class="card fc-cc" href="?p=funnel&amp;fcl=${esc(m.c.id)}" data-fc="${esc(m.c.id)}" data-f="fc:${esc(m.c.id)}" data-state="${m.state}" aria-haspopup="dialog">
    <span class="fc-cc1"><span class="fc-dotst s-${m.state}" aria-hidden="true"></span><b class="fc-ccn">${esc(m.c.name)}</b>${badge(m)}</span>
    <span class="fc-ccs">${esc(m.c.plan || m.c.show || "Funnel client")}</span>
    <span class="fc-rp">${bar(m)}<span class="fc-pn">${m.live} / ${m.total} live</span></span>
    <span class="fc-ccq">
      <span class="fc-ccb is-doing"><b>${m.doing.length}</b><small>Doing now</small></span>
      <span class="fc-ccb is-wait"><b>${m.wait}</b><small>Waiting on client</small></span>
      <span class="fc-ccb fc-ccnx"><b class="fc-due ${nk}">${m.next ? esc(dShort(ms(m.next.due_at))) : "None"}</b><small>${m.next ? `Next: ${esc(m.next.title)}` : "Nothing due"}</small></span></span>
    <span class="fc-cco">Open the board${ic("chev")}</span></a>`;
}
function listHTML() {
  if (!D || D.missing) return none("No scopes tracked yet", "When a funnel client's scope is set up, every promise (sites, posting, Shorts and the rest) shows up here with its due date.");
  if (!D.clients.length) return none("No funnel clients yet", "Clients who paid for more than videos show up here once they are marked, with everything their scope promised.");
  const ms0 = sorted(), cnt = k => ms0.filter(m => m.state === k).length;
  const sum = `<div class="fc-sum" aria-label="All funnel clients">
    <div class="tile fc-st"><span class="fc-l">Funnel clients</span><b>${ms0.length}</b></div>
    <div class="tile fc-st${cnt("behind") ? " bad" : ""}"><span class="fc-l">Behind</span><b>${cnt("behind")}</b></div>
    <div class="tile fc-st${cnt("risk") ? " warn" : ""}"><span class="fc-l">At risk</span><b>${cnt("risk")}</b></div>
    <div class="tile fc-st"><span class="fc-l">Waiting on clients</span><b>${ms0.reduce((a, m) => a + m.wait, 0)}</b></div></div>`;
  return `${sum}<div class="fc-ccg" id="fc-rows" aria-label="Funnel clients">${ms0.map(clientCardHTML).join("")}</div>`;
}

/* ---------------- the client panel ---------------- */
const pillHTML = (i, key) => `<button type="button" class="fc-pill s-${esc(i.status)}" data-fcst="${esc(key)}" data-f="st:${esc(key)}" aria-haspopup="menu" aria-expanded="${MENU === key}" aria-label="Status: ${esc(ST_L[i.status] || i.status)}. Change it">${esc(ST_L[i.status] || i.status)}</button>`;
const choices = (i, key) => ST.map(([id, l]) => `<button type="button" role="menuitemradio" class="fc-mi s-${id}" data-fcset="${id}" data-f="set:${esc(key)}:${id}" aria-checked="${id === i.status}">${esc(l)}</button>`).join("");
const menuHTML = (i, key) => `<div class="fc-menu" role="menu" aria-label="Set the status"${MENU === key ? "" : " hidden"}>${choices(i, key)}</div>`;
/* a task card (doing now, up next, waiting on the client) */
function taskCard(i, where, full) {
  const [t, k] = due(i), u = webUrl(i.link), dt = String(i.detail || "").trim(), nt = String(i.note || "").trim(), up = updAgo(i.updated_at), key = where + ":" + i.id, open = DET.has(key), long = !full && dt.length > 150;
  return `<article class="fc-tc" data-id="${esc(i.id)}" data-key="${esc(key)}" data-st="${esc(i.status)}">
    <span class="fc-tc1"><span class="fc-ar">${ic(AREA_I[i.area] || "star")}<span>${esc(AREA_L[i.area] || "Other")}</span></span>${pillHTML(i, key)}</span>
    ${menuHTML(i, key)}
    <b class="fc-at">${esc(i.title)}${i.recurring ? ` <span class="fc-rec">${esc(i.recurring)}</span>` : ""}</b>
    ${nt ? `<p class="fc-nt"><b>Latest</b> ${esc(nt)}</p>` : ""}
    ${dt ? `<p class="fc-an${long && !open ? " short" : ""}">${esc(dt)}</p>` : ""}
    <span class="fc-af">${t ? `<span class="fc-due ${k}">${esc(t)}</span>` : ""}${i.owner ? ownChip(i.owner) : ""}${up ? `<small class="fc-upd">Updated ${esc(up)}</small>` : ""}
      <span class="fc-afr">${long ? `<button type="button" class="fc-dtb" data-fcdt="${esc(key)}" data-f="dt:${esc(key)}" aria-expanded="${open}">${open ? "Less" : "More"}</button>` : ""}${u ? lk(u, `Open the link for ${i.title}`) : ""}</span></span></article>`;
}
function shortsHTML(s) {
  return `<div class="fc-sc" aria-label="Shorts on the delivery board">${[["sent", "delivered"], ["ready", "ready"], ["building", "building"], ...(s.changes ? [["changes", "changes asked"]] : [])]
    .map(([k, l]) => `<span class="fc-scn" data-sc="${k}"><b>${s[k]}</b>${l}</span>`).join("")}<small>delivery board</small></div>`;
}
/* a category tile: done / doing / waiting / overdue, progress, who owns what is open; click it for every task in it */
function catTile(m, cat, s) {
  const [id, , icn] = cat, act = m.its.filter(i => CAT_OF[i.area] === id && i.status !== "dropped"), n = st => act.filter(i => i.status === st).length;
  const lv = n("live"), late = act.filter(isLate).length, on = CAT === id, own = {};
  act.filter(i => i.status !== "live").forEach(i => { const o = i.owner || "Not set"; own[o] = (own[o] || 0) + 1; });
  const extra = id === "asks" ? (k => k ? `${k} email${k === 1 ? "" : "s"}` : "")(mailsOf(m.c).length) : id === "content" && s && s.total ? `${s.sent} Shorts delivered` : "";
  return `<button type="button" class="tile fc-cat${on ? " on" : ""}" data-fccat="${id}" data-f="cat:${id}" aria-pressed="${on}" aria-controls="fc-catd">
    <span class="fc-cath"><span class="fc-cati">${ic(icn)}</span><b>${esc(catName(cat, m.c))}</b><span class="fc-catc">${ic("chev")}</span></span>
    <span class="fc-catn"><span class="fc-cn is-done"><b>${lv}</b><small>Done</small></span><span class="fc-cn is-doing"><b>${n("in_progress")}</b><small>Doing</small></span>
      <span class="fc-cn is-wait"><b>${n("waiting_client") + n("waiting_founder")}</b><small>Waiting</small></span><span class="fc-cn${late ? " bad" : ""}"><b>${late}</b><small>Overdue</small></span></span>
    ${barOf(lv, act.length, " fc-bar-s")}
    <span class="fc-catf">${Object.entries(own).map(([o, k]) => ownChip(o, k)).join("")}${extra ? `<small>${esc(extra)}</small>` : ""}${!act.length && !extra ? "<small>Nothing here yet</small>" : ""}</span></button>`;
}
/* the open category: every task in it as a full card (overdue, doing, waiting, not started; then what is done) */
function catHTML(m, s) {
  const cat = CATS.find(x => x[0] === CAT); if (!cat) return "";
  const id = cat[0], its = m.its.filter(i => CAT_OF[i.area] === id), rk = i => isLate(i) ? -1 : SRANK[i.status] ?? 3;
  const open = its.filter(i => i.status !== "live" && i.status !== "dropped").sort((a, b) => rk(a) - rk(b) || byDue(a, b) || (a.sort || 0) - (b.sort || 0));
  const done = its.filter(i => i.status === "live" || i.status === "dropped").sort((a, b) => ms(b.done_at || b.updated_at) - ms(a.done_at || a.updated_at));
  return `<section class="fc-psec fc-catd" id="fc-catd" aria-labelledby="fc-h-cat">
    <div class="fc-cdh"><h3 class="fc-ph3" id="fc-h-cat">${esc(catName(cat, m.c))}<span class="n">${open.length}</span><small>open · ${done.length} done</small></h3>
      <button type="button" class="fc-dtb" data-fccat="${id}" data-f="cat:${id}">Back to the overview</button></div>
    ${id === "content" && s && s.total ? shortsHTML(s) : ""}
    ${open.length ? cards(open, "c", true) : `<p class="fc-quiet">Nothing open here right now.</p>`}
    ${done.length ? `<h4 class="fc-ph4">Done<span class="n">${done.length}</span></h4>${cards(done, "c", true)}` : ""}
    ${id === "asks" ? mailHTML(m.c) : ""}</section>`;
}
/* the client's inbound emails, newest first; tap one to read it (the quoted older thread is cut off) */
const mailsOf = c => { const e = new Set(c.emails.map(lc)); return (TH || []).filter(t => e.has(lc(t.lead_email))).sort((a, b) => ms(b.at) - ms(a.at)); };
const mailWhen = t => { const v = ms(t); return v ? `${dShort(v)} · ${HM.format(v)}` : ""; };
const mailBody = t => String(t.body || t.snippet || "").split(/\n[ \t>]*On [^\n]{4,240}(?:\n[^\n]{0,120})?wrote:/)[0].trim();
function mailHTML(c) {
  if (!TH) return `<p class="fc-quiet">The emails could not be read.</p>`;
  const all = mailsOf(c); if (!all.length) return "";
  const list = MAIL_ALL ? all : all.slice(0, 8);
  return `<h4 class="fc-ph4">${esc(firstName(c.name))}'s emails<span class="n">${all.length}</span><small>newest first · tap one to read it</small></h4>
    <ul class="fc-eml">${list.map(t => { const k = String(t.msg_id), o = MAIL.has(k);
      return `<li class="fc-emi${o ? " open" : ""}"><button type="button" class="fc-emb" data-fcmail="${esc(k)}" data-f="mail:${esc(k)}" aria-expanded="${o}">
        <span class="fc-emd">${esc(mailWhen(t.at))}</span><b class="fc-ems">${esc(t.subject || "(no subject)")}</b>${o ? "" : `<span class="fc-emp">${esc(String(t.snippet || "").slice(0, 180))}</span>`}</button>
        ${o ? `<div class="fc-emx">${esc(mailBody(t))}</div>` : ""}</li>`; }).join("")}</ul>
    ${all.length > 8 ? `<button type="button" class="fc-dtb fc-emall" data-fcmall data-f="mall" aria-expanded="${MAIL_ALL}">${MAIL_ALL ? "Show the newest 8" : `Show all ${all.length} emails`}</button>` : ""}`;
}
function infoHTML(c) {
  const link = (label, v, icn) => { const u = webUrl(v); return u ? `<a class="fc-il" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${ic(icn)}<span>${esc(label)}</span></a>` : ""; };
  const links = [link("Website", c.website, "link"), link("Instagram", c.instagram, "ig"), link("YouTube", c.youtube, "yt"), link("Drive folder", c.drive, "link")].join("");
  const notes = String(c.notes || "").trim(), long = notes.length > 280 || notes.split("\n").length > 4;   // folded to 4 lines
  return `<div class="tile fc-info"><dl class="fc-kv">
    ${c.plan ? `<div><dt>Plan</dt><dd>${esc(c.plan)}</dd></div>` : ""}
    ${c.emails.length ? `<div><dt>Email</dt><dd>${c.emails.map(esc).join("<br>")}</dd></div>` : ""}
    ${c.show ? `<div><dt>Show</dt><dd>${esc(c.show)}</dd></div>` : ""}</dl>
    ${links ? `<div class="fc-ils">${links}</div>` : ""}
    ${notes ? `<div class="fc-notes${long && !NOTES_OPEN ? " short" : ""}"><p>${esc(notes)}</p>${long ? `<button type="button" class="fc-dtb" data-fcnotes data-f="notes" aria-expanded="${NOTES_OPEN}">${NOTES_OPEN ? "Show less" : "Show all notes"}</button>` : ""}</div>` : ""}</div>`;
}
const sec = (id, title, n, body, sub) => `<section class="fc-psec" aria-labelledby="fc-h-${id}"><h3 class="fc-ph3" id="fc-h-${id}">${esc(title)}${n != null ? `<span class="n">${n}</span>` : ""}${sub ? `<small>${esc(sub)}</small>` : ""}</h3>${body}</section>`;
const cards = (list, where, full) => `<div class="fc-tcg">${list.map(i => taskCard(i, where, full)).join("")}</div>`;
const headHTML = (c, m) => `<div class="fc-phh"><h2 id="fc-pt">${esc(c.name)}</h2><p class="mut">${esc([c.plan, c.emails[0]].filter(Boolean).join(" · ") || "Funnel client")}</p></div>
  <span class="fc-phb">${badge(m)}<span class="fc-rp fc-php">${bar(m)}<span class="fc-pn">${m.live} / ${m.total} live</span></span></span>`;
function bodyHTML(c, m) {
  const s = shortsOf(c.id), late = m.its.filter(isLate).length;
  const who = {}; m.doing.forEach(i => { const o = i.owner || "Not set"; who[o] = (who[o] || 0) + 1; });
  const [nt, nk] = m.next ? due(m.next) : ["", ""];
  const stats = `<div class="fc-pst">
    <div class="tile fc-ps"><span class="ec-l">Promises live</span><b class="fc-pbig">${m.live}<small> / ${m.total}</small></b>${bar(m)}</div>
    <div class="tile fc-ps is-doing"><span class="ec-l">Doing now</span><b class="fc-pbig">${m.doing.length}</b><small>${esc(Object.entries(who).map(([o, n]) => `${o} ${n}`).join(" · ") || "Nothing in progress")}</small></div>
    <div class="tile fc-ps is-wait"><span class="ec-l">Waiting on client</span><b class="fc-pbig">${m.wait}</b><small>${esc(m.waiting[0] ? m.waiting[0].title : "Nothing waiting on them")}</small></div>
    ${late ? `<div class="tile fc-ps bad"><span class="ec-l">Overdue on us</span><b class="fc-pbig">${late}</b><small>Past due and not live yet</small></div>`
      : `<div class="tile fc-ps"><span class="ec-l">Next due</span>${m.next ? `<b class="fc-tn">${esc(m.next.title)}</b><span class="fc-due ${nk}">${esc(nt)}</span>` : `<b class="fc-tn mut">${m.total ? "Nothing else due" : "No items yet"}</b>`}</div>`}</div>`;
  const quiet = t => `<p class="fc-quiet">${esc(t)}</p>`;
  const tiles = `<div class="fc-cats" role="group" aria-label="Categories: click one for every task in it">${CATS.map(x => catTile(m, x, s)).join("")}</div>`;
  if (CAT) return `${stats}${tiles}${catHTML(m, s)}${sec("info", "Client info", null, infoHTML(c))}`;
  return `${stats}${tiles}
    ${sec("doing", "What we're doing", m.work.length, m.work.length ? cards(m.work, "d") : quiet("Nothing in progress right now."), "in progress or waiting on a founder · newest update first")}
    ${m.up.length ? sec("up", "Up next", m.up.length, cards(m.up.slice(0, 8), "u"), m.up.length > 8 ? `${m.up.length - 8} more in the categories above` : "not started, due within 7 days") : ""}
    ${m.waiting.length ? sec("wait", "Waiting on the client", m.waiting.length, cards(m.waiting, "w")) : ""}
    ${sec("info", "Client info", null, infoHTML(c))}`;
}

/* ---------------- painting ---------------- */
const fw = root => root.querySelectorAll("[data-fw]").forEach(e => e.style.setProperty("--w", e.dataset.fw + "%"));
const clientOf = id => id != null && D && D.clients.find(c => c.id === String(id)) || null;
/* repaint in place; the focused control comes back by its data-f key (a closed menu hands focus back to its pill or row) */
function paint() {
  const root = document.getElementById("fc-list"), a = document.activeElement;
  const keep = a && a.dataset && a.dataset.f && ((root && root.contains(a)) || (PAN && PAN.pan.contains(a))) ? a.dataset.f : null;
  if (root) { root.innerHTML = listHTML(); fw(root); }
  if (PAN) { const c = clientOf(PAN.id); if (!c) closePanel(true); else { const m = model(c); PAN.head.innerHTML = headHTML(c, m); PAN.body.innerHTML = bodyHTML(c, m); fw(PAN.head); fw(PAN.body); } }
  if (!keep) return;
  const q = k => document.querySelector(`[data-f="${CSS.escape(k)}"]`);
  let el = q(keep);
  if (!el && keep.startsWith("set:")) el = q("st:" + keep.split(":").slice(1, 3).join(":"));
  el?.focus({ preventScroll: true });
}
const setUrl = id => { try { const u = new URL(location.href); id ? u.searchParams.set("fcl", id) : u.searchParams.delete("fcl"); history.replaceState(history.state, "", u); } catch {} };
const otherLayer = () => !!document.querySelector("#drawer:not([hidden]), #veil:not([hidden]), #pal:not([hidden]), #dlg:not([hidden])");
function openPanel(id, opener) {
  const c = clientOf(id); if (!c || !A) return;
  if (PAN) closePanel(true);
  MENU = null; CAT = null; MAIL.clear(); MAIL_ALL = false; DET.clear(); NOTES_OPEN = false; setUrl(c.id);
  const m = model(c);
  const scrim = document.createElement("div"); scrim.className = "fc-scrim"; scrim.id = "fc-scrim";
  const pan = document.createElement("aside"); pan.className = "fc-pan"; pan.id = "fc-pan"; pan.setAttribute("role", "dialog"); pan.setAttribute("aria-modal", "true"); pan.setAttribute("aria-labelledby", "fc-pt");
  pan.innerHTML = `<header class="fc-ph"><div class="fc-phm">${headHTML(c, m)}</div><button type="button" class="icon-btn fc-x" data-fcx data-f="x" aria-label="Close"><svg aria-hidden="true"><use href="#i-x"/></svg></button></header>
    <div class="fc-pb">${bodyHTML(c, m)}</div>`;
  document.body.append(scrim, pan);
  PAN = { id: c.id, pan, scrim, head: pan.querySelector(".fc-phm"), body: pan.querySelector(".fc-pb"), opener: opener || null };
  fw(pan); HTML.classList.add("fc-locked");
  requestAnimationFrame(() => { scrim.classList.add("on"); pan.classList.add("on"); });
  pan.querySelector(".fc-x").focus({ preventScroll: true });
  scrim.addEventListener("click", () => closePanel());
}
function closePanel(quick) {
  if (!PAN) return; const { id, pan, scrim, opener } = PAN; PAN = null; MENU = null; HTML.classList.remove("fc-locked"); setUrl(null);
  const gone = () => { pan.remove(); scrim.remove(); };
  if (quick || !motion()) gone(); else { pan.classList.remove("on"); scrim.classList.remove("on"); pan.classList.add("out"); setTimeout(gone, 380); }
  if (!quick) (opener && opener.isConnected ? opener : document.querySelector(`#fc-rows [data-fc="${CSS.escape(id)}"]`))?.focus({ preventScroll: true });
}

/* ---------------- one tap: the status ---------------- */
async function setStatus(id, st) {
  const it = (ITEMS || []).find(i => String(i.id) === String(id)); MENU = null;
  if (!it || it.status === st) { paint(); return; }
  const prev = { status: it.status, done_at: it.done_at, updated_at: it.updated_at };
  it.status = st; it.done_at = st === "live" ? new Date().toISOString() : null; it.updated_at = new Date().toISOString(); paint();   // optimistic
  try {
    const { data, error } = await A.sb().from("scope_items").update({ status: st }).eq("id", it.id).select("id"); if (error) throw error;
    if (!data || !data.length) throw new Error("not allowed. The 2-step login may have expired: sign in again");
  } catch (e) {
    if (it.status === st) { Object.assign(it, prev); paint(); }
    A.toast(`Couldn't save "${String(it.title).slice(0, 60)}": ${String(e && e.message || e).slice(0, 120)}`);
  }
}

/* ---------------- one delegated click handler + keys ---------------- */
document.addEventListener("click", ev => {
  const t = ev.target; if (!t.closest || !A) return;
  const card = t.closest("#fc-rows [data-fc]"); if (card) { if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return; ev.preventDefault(); openPanel(card.dataset.fc, card); return; }
  if (!PAN || !PAN.pan.contains(t)) return;
  if (t.closest("[data-fcx]")) { closePanel(); return; }
  const pill = t.closest("[data-fcst]"); if (pill) { MENU = MENU === pill.dataset.fcst ? null : pill.dataset.fcst; paint(); if (MENU) PAN.pan.querySelector(`[data-key="${CSS.escape(MENU)}"] [aria-checked="true"]`)?.focus({ preventScroll: true }); return; }
  const mi = t.closest("[data-fcset]"); if (mi) { setStatus(mi.closest("[data-key]").dataset.id, mi.dataset.fcset); return; }
  const cat = t.closest("[data-fccat]"); if (cat) { CAT = CAT === cat.dataset.fccat ? null : cat.dataset.fccat; MENU = null; DET.clear(); paint();
    if (CAT) PAN.body.querySelector("#fc-catd")?.scrollIntoView({ block: "start", behavior: motion() ? "smooth" : "auto" }); return; }
  const mail = t.closest("[data-fcmail]"); if (mail) { const k = mail.dataset.fcmail; MAIL.has(k) ? MAIL.delete(k) : MAIL.add(k); paint(); return; }
  if (t.closest("[data-fcmall]")) { MAIL_ALL = !MAIL_ALL; paint(); return; }
  if (t.closest("[data-fcnotes]")) { NOTES_OPEN = !NOTES_OPEN; paint(); return; }
  const db = t.closest("[data-fcdt]"); if (db) { const k = db.dataset.fcdt; DET.has(k) ? DET.delete(k) : DET.add(k); paint(); return; }
});
/* SIMAS 11-25: the sidebar stays open next to the panel; any sidebar item closes the panel (capture: before the router moves the page) */
document.addEventListener("click", ev => { if (PAN && ev.target.closest && ev.target.closest("#snav a[data-nav]")) closePanel(true); }, true);
document.addEventListener("keydown", ev => {
  if (!PAN || otherLayer()) return;
  if (ev.key === "Escape") {   // Escape closes an open status menu first, then the panel
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (MENU) { const k = MENU; MENU = null; paint(); PAN.pan.querySelector(`[data-fcst="${CSS.escape(k)}"]`)?.focus({ preventScroll: true }); } else closePanel();
    return;
  }
  if (ev.key === "Tab") {   // keep focus inside the panel
    const f = [...PAN.pan.querySelectorAll('button:not([disabled]),a[href],[tabindex="0"]')].filter(x => x.offsetParent !== null && !x.closest("[hidden]")); if (!f.length) return;
    const a = document.activeElement, first = f[0], last = f[f.length - 1];
    if (!PAN.pan.contains(a)) { ev.preventDefault(); first.focus(); } else if (ev.shiftKey && a === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && a === last) { ev.preventDefault(); first.focus(); }
  }
}, true);
/* the page changed under the panel (another page, or back): close it */
new MutationObserver(() => { if (PAN && new URL(location.href).searchParams.get("p") !== "funnel") closePanel(true); }).observe(document.getElementById("spage") || document.body, { childList: true });

function view() { return `<section class="fc" id="fc-list" aria-label="Funnel">${listHTML()}</section>`; }
function wire(api) {
  A = api; const list = document.getElementById("fc-list"); if (list) fw(list);
  let q = null; try { q = new URL(location.href).searchParams.get("fcl"); } catch {}   // a shared link opens that client
  if (q && !PAN && clientOf(q)) openPanel(q, null);
}
(window.BEJU_SIDE_PAGES = window.BEJU_SIDE_PAGES || {}).funnel = {
  title: "Funnel",
  head: ["Funnel", "What we promised each funnel client, what we're doing now, and what's due next. Click a client to open the board."],
  src: d => d && !d.missing ? ["Scopes", null] : null,
  load, view, wire,
};
})();
