/* BEJÚ founder CRM: Funnel clients page (?p=funnel). SIMAS 11-24: "a tab that tracks our funnel clients: clients that paid for more than
   videos, based on the scope track everything we promised (sites we build for them, posting, videos, everything else), and see clearly
   whether we are on track." A page next to Clients (Clients is unchanged).
   LIST: one card per funnel client (clients.funnel = true): name, plan line (an active retainer), progress = live / every item not dropped,
   a badge (BEHIND: something past due that is not live and not waiting on the client · AT RISK: something due within 48 h that is not
   live · ON TRACK: everything due by now is live or waiting on the client), the next milestone (the soonest due item not live) and
   "Waiting on client: N".
   CLIENT (SIMAS 11-24 17:04: "when I click a funnel client it should open like in the Clients tab, a similar layout"): the Clients tab's
   way: the list on the left (a row per client: status dot, name, plan, progress, badge; worst first), the chosen client on the right in
   the same card, on the same page (stacked under the list on narrow screens). Its layout follows the Clients tab's client: the head
   (name, show · email, the badge), three tiles (Promises live, Next due, Waiting on client), then sections:
     NEXT UP: the 5 soonest promises not live yet, as a short timeline (due · what · who · status, changeable in place).
     WHAT WE'RE BUILDING (SIMAS 15:48 "the webs in progress or built"; 16:27 "the assets, you add them, not us"): one card per scope
       item in Websites, Lead magnets & emails, Posting, SEO & GEO (status, link, note, last update) + the client's Shorts from the
       delivery board (public.client_items). Claude keeps these rows current; founders read them here.
     CLIENT INFO: plan, site / Instagram / YouTube / Drive folder links, emails and the client notes (clients.notes, folded when long).
     FULL CHECKLIST, folded: every item by area, each status pill one tap to change (optimistic: on an error it goes back and a toast
       says why). ?fcl=<client id> in the address opens that client.
   Data: public.scope_items + clients.funnel (supabase/crm_scope_items1.sql), clients (links + notes), client_items, retainers; read once per page load, then a
   targeted re-read after realtime events on this page's OWN channels. A database without the table or the column shows a calm empty
   state. Writes: scope_items.status only, as the signed-in founder (row-level security, is_admin()).
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
const H48 = 48 * 36e5;

/* the areas, in the order the client page shows them */
const AREAS = [["setup", "Setup & calls"], ["websites", "Websites"], ["lead_magnets", "Lead magnets & emails"], ["posting", "Posting"], ["shorts", "Shorts"],
  ["seo", "SEO & GEO"], ["reports", "Reports & calls"], ["other", "Other"]];
const BUILD = new Set(["websites", "lead_magnets", "posting", "seo"]);   // areas whose items are things we build for them
const AREA_L = Object.fromEntries(AREAS);
const ST = [["not_started", "Not started"], ["in_progress", "In progress"], ["waiting_client", "Waiting on client"], ["live", "Live"], ["dropped", "Dropped"]];
const ST_L = Object.fromEntries(ST);
const BADGE = { behind: "Behind", risk: "At risk", on: "On track" };
const RANK = { behind: 0, risk: 1, on: 2 };
const BST = { not_started: "Planned", in_progress: "In progress", waiting_client: "Waiting on client", live: "Live" };
const BRANK = { in_progress: 0, waiting_client: 1, live: 2, not_started: 3 };
const PER = r => ({ month: "mo", year: "yr", week: "wk", day: "day" })[lc(r && r.interval) || "month"] || "mo";

let A = null;               // side.js's helpers (sb, all, toast, dayOf, dLabel, usd, el)
let D = null;               // { clients, missing }: the funnel clients (with .plan); missing = the table or the column is not there yet
let ITEMS = null;           // scope_items rows; null = not readable (not created yet)
let CI = null;              // client_items rows (id, client_id, status); null = not readable
let SEL = null;             // the client shown on the right (?fcl=<id> in the address; the first one, worst first, if none)
let MENU = null;            // the open status menu: "<where>:<item id>" (where = n next up, c checklist)
const DET = new Set();      // item ids whose detail is unfolded
let LIST_OPEN = false;      // the full checklist is unfolded
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
    api.all("retainers", "email,amount,interval,status").catch(() => []),
  ]);
  ITEMS = items; CI = ci; AT.scope_items = AT.client_items = Date.now();
  const ret = {}; (rets || []).forEach(r => { if (/active|trialing|past_due/i.test(r.status || "")) ret[lc(r.email)] = r; });
  const clients = (cl || []).filter(c => c.funnel !== false).map(c => {
    const r = (c.emails || []).map(e => ret[lc(e)]).find(Boolean);
    return { id: String(c.id), name: c.name || "Client", show: c.show || "", plan: r ? `${api.usd(r.amount)} / ${PER(r)} plan` : "",
      emails: c.emails || [], website: c.website || "", instagram: c.instagram || "", youtube: c.youtube || "", drive: c.drive_folder || "", notes: c.notes || "" };
  });
  D = { clients, missing: !cl || !ITEMS };
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
function model(c) {
  const now = Date.now(), its = itemsOf(c.id), act = its.filter(i => i.status !== "dropped"), open = act.filter(i => i.status !== "live");
  const live = act.length - open.length;
  const behind = open.filter(i => ms(i.due_at) && ms(i.due_at) < now && i.status !== "waiting_client");
  const risk = open.filter(i => ms(i.due_at) >= now && ms(i.due_at) <= now + H48);
  const state = behind.length ? "behind" : risk.length ? "risk" : "on";
  const next = open.filter(i => ms(i.due_at)).sort((a, b) => ms(a.due_at) - ms(b.due_at) || a.id - b.id)[0] || null;
  return { c, its, live, total: act.length, pct: act.length ? Math.round(100 * live / act.length) : 0, behind: behind.length, risk: risk.length, state,
    n: state === "behind" ? behind.length : state === "risk" ? risk.length : 0, next, wait: act.filter(i => i.status === "waiting_client").length };
}
function shortsOf(cid) {
  if (!CI) return null;
  const r = CI.filter(i => String(i.client_id) === String(cid)), n = f => r.filter(f).length;
  return { total: r.length, sent: n(i => i.status === "sent" || i.status === "approved"), ready: n(i => i.status === "ready"), building: n(i => i.status === "building"), changes: n(i => i.status === "changes") };   // an old "approved" row was sent too
}
/* a due date: [text, class] (late = past due and still on us, soon = within 48 h) */
function due(i) {
  const t = ms(i.due_at); if (!t) return ["", ""];
  const now = Date.now(), d = A.dayOf(t), lab = d === A.dayOf(now) ? "today" : d === A.dayOf(now + 864e5) ? "tomorrow" : A.dLabel(d);
  if (i.status === "live" || i.status === "dropped") return [`Due ${lab}`, ""];
  if (t < now) return i.status === "waiting_client" ? [`Was due ${lab}`, ""] : [`Overdue · ${lab}`, "late"];
  return [`Due ${lab}`, t <= now + H48 ? "soon" : ""];
}
const badge = m => `<span class="fc-badge s-${m.state}" data-n="${m.n}">${esc(BADGE[m.state])}${m.n ? ` · ${m.n}` : ""}</span>`;
const bar = m => `<span class="fc-bar" role="img" aria-label="${m.live} of ${m.total} live"><i data-fw="${m.total ? Math.max(m.live ? 3 : 0, m.pct) : 0}"></i></span>`;

/* ---------------- the list (left, like the Clients tab) ---------------- */
const none = (h, p) => `<div class="card sp-card fc-none"><span class="fc-none-i">${ic("flag")}</span><b>${esc(h)}</b><p>${esc(p)}</p></div>`;
const sorted = () => D.clients.map(model).sort((a, b) => RANK[a.state] - RANK[b.state] || a.c.name.localeCompare(b.c.name));
function rowHTML(m) {
  return `<a class="cl-item fc-item" href="?p=funnel&amp;fcl=${esc(m.c.id)}" data-fc="${esc(m.c.id)}" data-state="${m.state}"${SEL === m.c.id ? ' aria-current="true"' : ""}>
    <span class="fc-dotst s-${m.state}" aria-hidden="true"></span>
    <span class="grow"><span class="t fc-nm">${esc(m.c.name)}</span><span class="s">${esc(m.c.plan || m.c.show || "Funnel client")}</span>
      <span class="fc-rp">${bar(m)}<span class="fc-pn">${m.live} / ${m.total} live</span></span></span>${badge(m)}</a>`;
}
function listHTML() {
  if (!D || D.missing) return none("No scopes tracked yet", "When a funnel client's scope is set up, every promise (sites, posting, Shorts and the rest) shows up here with its due date.");
  if (!D.clients.length) return none("No funnel clients yet", "Clients who paid for more than videos show up here once they are marked, with everything their scope promised.");
  const ms0 = sorted(), cnt = k => ms0.filter(m => m.state === k).length;
  if (!clientOf(SEL)) SEL = ms0[0].c.id;
  const sum = `<div class="fc-sum" aria-label="All funnel clients">
    <div class="tile fc-st"><span class="fc-l">Funnel clients</span><b>${ms0.length}</b></div>
    <div class="tile fc-st${cnt("behind") ? " bad" : ""}" data-k="behind"><span class="fc-l">Behind</span><b>${cnt("behind")}</b></div>
    <div class="tile fc-st${cnt("risk") ? " warn" : ""}" data-k="risk"><span class="fc-l">At risk</span><b>${cnt("risk")}</b></div>
    <div class="tile fc-st" data-k="wait"><span class="fc-l">Waiting on clients</span><b>${ms0.reduce((a, m) => a + m.wait, 0)}</b></div></div>`;
  return `${sum}<div class="cl-wrap fc-wrap"><section class="card sp-card fc-lc" aria-label="Funnel clients"><div class="cl-list" id="fc-rows">${ms0.map(rowHTML).join("")}</div></section>
    <section class="card sp-card" id="fc-detail" aria-live="polite">${detailHTML(clientOf(SEL))}</section></div>`;
}
/* ---------------- the client page ---------------- */
const pillHTML = (i, key) => `<button type="button" class="fc-pill s-${esc(i.status)}" data-fcst="${esc(key)}" aria-haspopup="menu" aria-expanded="${MENU === key}" aria-label="Status: ${esc(ST_L[i.status] || i.status)}. Change it">${esc(ST_L[i.status] || i.status)}</button>`;
const menuHTML = (i, key) => `<div class="fc-menu" role="menu" aria-label="Set the status"${MENU === key ? "" : " hidden"}>${ST.map(([id, l]) => `<button type="button" role="menuitemradio" class="fc-mi s-${id}" data-fcset="${id}" aria-checked="${id === i.status}">${esc(l)}</button>`).join("")}</div>`;
function itemHTML(i) {
  const [t, k] = due(i), u = webUrl(i.link), dt = String(i.detail || "").trim(), open = DET.has(String(i.id)), key = "c:" + i.id;
  return `<li class="fc-it" data-id="${esc(i.id)}" data-key="${esc(key)}" data-st="${esc(i.status)}">
    <div class="fc-row">${pillHTML(i, key)}
      <span class="fc-tt">${esc(i.title)}${i.recurring ? ` <span class="fc-rec">${esc(i.recurring)}</span>` : ""}</span>
      <span class="fc-meta">${t ? `<span class="fc-due ${k}">${esc(t)}</span>` : ""}${i.owner ? `<span class="fc-own">${esc(i.owner)}</span>` : ""}
        ${u ? `<a class="fc-lk" href="${esc(u)}" target="_blank" rel="noopener noreferrer" aria-label="Open the link for ${esc(i.title)}">${ic("link")}<span>Open</span></a>` : ""}
        ${dt ? `<button type="button" class="fc-dtb" data-fcdt="${esc(i.id)}" aria-expanded="${open}">${open ? "Less" : "Details"}</button>` : ""}</span></div>
    ${dt ? `<p class="fc-dt"${open ? "" : " hidden"}>${esc(dt)}</p>` : ""}
    ${menuHTML(i, key)}</li>`;
}
function shortsHTML(s) {
  return `<div class="fc-sc" aria-label="Shorts on the delivery board">${[["sent", "delivered"], ["ready", "ready"], ["building", "building"], ...(s.changes ? [["changes", "changes asked"]] : [])]
    .map(([k, l]) => `<span class="fc-scn" data-sc="${k}"><b>${s[k]}</b>${l}</span>`).join("")}<small>from the delivery board</small></div>`;
}
const dShort = t => { const now = Date.now(), d = A.dayOf(t); return d === A.dayOf(now) ? "Today" : d === A.dayOf(now + 864e5) ? "Tomorrow" : A.dLabel(d); };
const ago = t => { const v = ms(t); if (!v) return ""; const d = A.dayOf(v), n = Date.now(); return d === A.dayOf(n) ? "today" : d === A.dayOf(n - 864e5) ? "yesterday" : A.dLabel(d); };
/* 1. next up: the soonest promises that are not live yet */
function nextUpHTML(m) {
  const up = m.its.filter(i => i.status !== "live" && i.status !== "dropped" && ms(i.due_at)).sort((a, b) => ms(a.due_at) - ms(b.due_at) || a.id - b.id).slice(0, 5);
  if (!up.length) return `<p class="fc-quiet">${m.total ? "Nothing open with a due date. Everything promised so far is live." : "No promises tracked yet."}</p>`;
  return `<ol class="fc-tl-list">${up.map(i => { const [, k] = due(i), key = "n:" + i.id;
    return `<li class="fc-nx" data-id="${esc(i.id)}" data-key="${esc(key)}" data-st="${esc(i.status)}">
      <span class="fc-nd ${k}"><b>${esc(dShort(ms(i.due_at)))}</b>${k === "late" ? "<small>overdue</small>" : ""}</span><i class="fc-dot ${k}" aria-hidden="true"></i>
      <span class="fc-nb"><span class="fc-tt">${esc(i.title)}</span><span class="fc-nm2">${esc(AREA_L[i.area] || "")}${i.owner ? ` · ${esc(i.owner)}` : ""}</span></span>
      ${pillHTML(i, key)}${menuHTML(i, key)}</li>`; }).join("")}</ol>`;
}
/* 2. what we're building: the things in the build areas + the Shorts */
function buildHTML(m, s) {
  const its = m.its.filter(i => BUILD.has(i.area) && i.status !== "dropped").sort((a, b) => BRANK[a.status] - BRANK[b.status] || (ms(a.due_at) || 1e15) - (ms(b.due_at) || 1e15) || a.id - b.id);
  const card = i => { const u = webUrl(i.link), dt = String(i.detail || "").trim(), up = ago(i.updated_at);
    return `<article class="fc-as" data-id="${esc(i.id)}" data-st="${esc(i.status)}">
      <span class="fc-as1"><span class="fc-ar">${esc(AREA_L[i.area] || "")}</span><span class="fc-chip s-${esc(i.status)}">${esc(BST[i.status] || ST_L[i.status] || i.status)}</span></span>
      <b class="fc-at">${esc(i.title)}</b>${dt ? `<p class="fc-an">${esc(dt)}</p>` : ""}
      <span class="fc-af">${u ? `<a class="fc-lk" href="${esc(u)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(i.title)}">${ic("link")}<span>Open</span></a>` : `<span class="fc-nolk">No link yet</span>`}${up ? `<small>Updated ${esc(up)}</small>` : ""}</span></article>`; };
  const sh = s && s.total ? `<article class="fc-as fc-as-sh" data-st="shorts"><span class="fc-as1"><span class="fc-ar">Shorts</span></span><b class="fc-at">${s.total} Shorts on the delivery board</b>${shortsHTML(s)}</article>` : "";
  if (!its.length && !sh) return `<p class="fc-quiet">Nothing being built yet. Sites, lead magnets and posting set-ups show here as we start them.</p>`;
  return `<div class="fc-asg">${its.map(card).join("")}${sh}</div>`;
}
/* 3. client info */
function infoHTML(c) {
  const lk = (label, v, icn) => { const u = webUrl(v); return u ? `<a class="fc-il" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${ic(icn)}<span>${esc(label)}</span></a>` : ""; };
  const links = [lk("Website", c.website, "link"), lk("Instagram", c.instagram, "link"), lk("YouTube", c.youtube, "link"), lk("Drive folder", c.drive, "link")].join("");
  const notes = String(c.notes || "").trim(), long = notes.length > 280 || notes.split("\n").length > 4;   // folded to 4 lines
  return `<dl class="fc-kv">
    ${c.plan ? `<div><dt>Plan</dt><dd>${esc(c.plan)}</dd></div>` : ""}
    ${c.emails.length ? `<div><dt>Email</dt><dd>${c.emails.map(esc).join("<br>")}</dd></div>` : ""}
    ${c.show ? `<div><dt>Show</dt><dd>${esc(c.show)}</dd></div>` : ""}</dl>
    ${links ? `<div class="fc-ils">${links}</div>` : ""}
    ${notes ? `<div class="fc-notes${long && !NOTES_OPEN ? " short" : ""}"><p>${esc(notes)}</p>${long ? `<button type="button" class="fc-dtb" data-fcnotes aria-expanded="${NOTES_OPEN}">${NOTES_OPEN ? "Show less" : "Show all notes"}</button>` : ""}</div>` : ""}`;
}
/* 4. the full checklist (folded) */
function checklistHTML(m, s) {
  const sort = (a, b) => (a.sort || 0) - (b.sort || 0) || (ms(a.due_at) || 1e15) - (ms(b.due_at) || 1e15) || a.id - b.id;
  return AREAS.map(([a, name]) => {
    const its = m.its.filter(i => i.area === a).sort(sort), sh = a === "shorts" && s && s.total ? s : null;
    if (!its.length && !sh) return "";
    const act = its.filter(i => i.status !== "dropped"), lv = act.filter(i => i.status === "live").length;
    return `<section class="fc-grp" data-area="${a}"><h4>${esc(name)}${its.length ? `<small>${lv} / ${act.length} live</small>` : ""}</h4>${its.length ? `<ul class="fc-ul">${its.map(itemHTML).join("")}</ul>` : ""}</section>`;
  }).join("");
}
/* the client, laid out like the Clients tab's client: head, three tiles, then sections */
function detailHTML(c) {
  if (!c) return `<p class="empty">Pick a client on the left.</p>`;
  const m = model(c), s = shortsOf(c.id), nb = m.its.filter(i => BUILD.has(i.area) && i.status !== "dropped").length + (s && s.total ? 1 : 0);
  const [nt, nk] = m.next ? due(m.next) : ["", ""];
  const tiles = `<div class="cl-tiles fc-tiles">
    <div class="tile cl-tl"><span class="ec-l">Promises live</span><b class="cl-big">${m.live}<small> / ${m.total}</small></b>${bar(m)}</div>
    <div class="tile cl-tl"><span class="ec-l">Next due</span>${m.next ? `<b class="fc-tn">${esc(m.next.title)}</b><span class="fc-due ${nk}">${esc(nt)}</span>` : `<b class="fc-tn mut">${m.total ? "Nothing else due" : "No items yet"}</b>`}</div>
    <div class="tile cl-tl"><span class="ec-l">Waiting on client</span><b class="cl-big">${m.wait}</b><small class="mut">${m.state === "behind" ? `${m.n} past due on us` : m.state === "risk" ? `${m.n} due within 48 h` : "Everything due is live or with the client"}</small></div></div>`;
  return `<div class="cl-head"><div class="grow"><h2 id="fc-pt">${esc(c.name)}</h2><p>${esc([c.show, c.emails[0]].filter(Boolean).join(" · ") || "Funnel client")}</p></div><div class="cl-chips">${badge(m)}</div></div>
    ${tiles}
    <section class="cl-sec fc-sec"><h3 class="cl-h">Next up</h3>${nextUpHTML(m)}</section>
    <section class="cl-sec fc-sec"><h3 class="cl-h">What we're building <span class="n">${nb}</span></h3>${buildHTML(m, s)}</section>
    <section class="cl-sec fc-sec"><h3 class="cl-h">Client info</h3>${infoHTML(c)}</section>
    ${m.its.length ? `<div class="cl-sec fc-all"><button type="button" class="act fc-fold" data-fcall aria-expanded="${LIST_OPEN}" aria-controls="fc-allb">${ic("chev")}Full checklist <small>${m.live} / ${m.total} live</small></button>
      <div class="fc-allb" id="fc-allb"${LIST_OPEN ? "" : " hidden"}>${checklistHTML(m, s)}</div></div>` : ""}`;
}

/* ---------------- painting ---------------- */
const fw = root => root.querySelectorAll("[data-fw]").forEach(e => e.style.setProperty("--w", e.dataset.fw + "%"));
const clientOf = id => id != null && D && D.clients.find(c => c.id === String(id)) || null;
/* repaint in place, keeping focus (the same control, by its key) and the detail's scroll */
function paint() {
  const root = document.getElementById("fc-list"); if (!root) return;
  const a = document.activeElement, inR = a && root.contains(a);
  const keep = inR ? (a.dataset.fc ? ["fc", a.dataset.fc] : a.dataset.fcall !== undefined ? ["fcall"] : a.dataset.fcnotes !== undefined ? ["fcnotes"]
    : [a.dataset.fcst ? "fcst" : a.dataset.fcset ? "fcset" : a.dataset.fcdt ? "fcdt" : "", a.closest("[data-key]")?.dataset.key, a.dataset.fcset]) : null;
  root.innerHTML = listHTML(); fw(root);
  if (!keep) return;
  if (keep[0] === "fc") root.querySelector(`[data-fc="${CSS.escape(keep[1])}"]`)?.focus({ preventScroll: true });
  else if (keep.length === 1) root.querySelector(`#fc-detail [data-${keep[0]}]`)?.focus({ preventScroll: true });
  else if (keep[0] && keep[1]) { const li = root.querySelector(`[data-key="${CSS.escape(keep[1])}"]`), el = li && (keep[0] === "fcset" ? li.querySelector(`[data-fcset="${keep[2]}"]`) || li.querySelector("[data-fcst]") : li.querySelector(`[data-${keep[0]}]`)); el?.focus({ preventScroll: true }); }
}
/* pick a client: the row lights up and the detail shows it, on the same page (the Clients tab's way) */
function select(id, row) {
  if (!clientOf(id)) return;
  if (SEL !== String(id)) { SEL = String(id); MENU = null; LIST_OPEN = false; NOTES_OPEN = false; DET.clear(); }
  try { const u = new URL(location.href); u.searchParams.set("fcl", SEL); history.replaceState(history.state, "", u); } catch {}
  paint();
  const det = document.getElementById("fc-detail");
  if (det && matchMedia("(max-width: 900px)").matches) det.scrollIntoView({ block: "start", behavior: motion() ? "smooth" : "auto" });   // stacked layout: the detail sits under the list
  if (row) document.querySelector(`#fc-rows [data-fc="${CSS.escape(SEL)}"]`)?.focus({ preventScroll: true });
}

/* ---------------- one tap: the status ---------------- */
async function setStatus(id, st) {
  const it = (ITEMS || []).find(i => String(i.id) === String(id)); MENU = null;
  if (!it || it.status === st) { paint(); return; }
  const prev = { status: it.status, done_at: it.done_at };
  it.status = st; it.done_at = st === "live" ? new Date().toISOString() : null; paint();   // optimistic
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
  const t = ev.target; if (!t.closest || !A || !document.getElementById("fc-list")) return;
  const row = t.closest("#fc-rows [data-fc]"); if (row) { if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return; ev.preventDefault(); select(row.dataset.fc, row); return; }
  const det = document.getElementById("fc-detail"); if (!det || !det.contains(t)) return;
  const pill = t.closest("[data-fcst]"); if (pill) { MENU = MENU === pill.dataset.fcst ? null : pill.dataset.fcst; paint(); if (MENU) det.ownerDocument.querySelector(`#fc-detail [data-key="${CSS.escape(MENU)}"] [aria-checked="true"]`)?.focus({ preventScroll: true }); return; }
  const mi = t.closest("[data-fcset]"); if (mi) { setStatus(mi.closest("[data-key]").dataset.id, mi.dataset.fcset); return; }
  if (t.closest("[data-fcall]")) { LIST_OPEN = !LIST_OPEN; MENU = null; paint(); return; }
  if (t.closest("[data-fcnotes]")) { NOTES_OPEN = !NOTES_OPEN; paint(); return; }
  const db = t.closest("[data-fcdt]"); if (db) { const k = db.dataset.fcdt; DET.has(k) ? DET.delete(k) : DET.add(k); paint(); return; }
});
document.addEventListener("keydown", ev => {
  if (ev.key !== "Escape" || !MENU || !document.getElementById("fc-detail")) return;   // Escape closes an open status menu
  ev.preventDefault(); ev.stopImmediatePropagation(); const k = MENU; MENU = null; paint(); document.querySelector(`#fc-detail [data-fcst="${CSS.escape(k)}"]`)?.focus({ preventScroll: true });
}, true);

function view() {
  if (SEL == null) { try { SEL = new URL(location.href).searchParams.get("fcl"); } catch {} }   // a shared link opens that client
  return `<section class="fc" id="fc-list" aria-label="Funnel">${listHTML()}</section>`;
}
function wire(api) { A = api; const list = document.getElementById("fc-list"); if (list) fw(list); }
(window.BEJU_SIDE_PAGES = window.BEJU_SIDE_PAGES || {}).funnel = {
  title: "Funnel",
  head: ["Funnel", "What we promised each funnel client, what's due next, and what we've built for them."],
  src: d => d && !d.missing ? ["Scopes", null] : null,
  load, view, wire,
};
})();
