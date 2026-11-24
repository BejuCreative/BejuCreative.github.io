/* BEJÚ founder CRM: Funnel clients page (?p=funnel). SIMAS 11-24: "a tab that tracks our funnel clients: clients that paid for more than
   videos, based on the scope track everything we promised (sites we build for them, posting, videos, everything else), and see clearly
   whether we are on track." A page next to Clients (Clients is unchanged).
   LIST: one card per funnel client (clients.funnel = true): name, plan line (an active retainer), progress = live / every item not dropped,
   a badge (BEHIND: something past due that is not live and not waiting on the client · AT RISK: something due within 48 h that is not
   live · ON TRACK: everything due by now is live or waiting on the client), the next milestone (the soonest due item not live) and
   "Waiting on client: N".
   CLIENT HUB (SIMAS 11-24 15:48: "name the tab Funnel; I don't like the almost full-screen analysis; we want to see what we promised to
   make soonest; not only a task list but also info storing for her: the webs in progress or built"; 16:27: "the assets, you add them,
   not us"). A tap on a card opens a compact panel from the right (a full-screen sheet on phones), top to bottom:
     1. NEXT UP: the 5 soonest promises not live yet, as a short timeline (due · what · who · status).
     2. WHAT WE'RE BUILDING: one card per thing we build (scope items in Websites, Lead magnets & emails, Posting, SEO & GEO) with its
        status, link, note and last update, plus the client's Shorts from the delivery board (public.client_items). Claude keeps these
        rows current (status, link, note); founders only read them here.
     3. CLIENT INFO: plan, site / Instagram / YouTube / Drive folder links, emails and the client notes (clients.notes, folded when long).
     4. THE FULL CHECKLIST, folded: every item by area, each status pill one tap to change (optimistic: on an error it goes back and a
        toast says why).
   Data: public.scope_items + clients.funnel (supabase/crm_scope_items1.sql), clients (links + notes), client_items, retainers; read once per page load, then a
   targeted re-read after realtime events on this page's OWN channels. A database without the table or the column shows a calm empty
   state. Writes: scope_items.status only, as the signed-in founder (row-level security, is_admin()).
   Registered with side.js through window.BEJU_SIDE_PAGES, so this file loads before side.js. CSP: no inline styles (CSSOM only). */
(() => {
"use strict";
const HTML = document.documentElement, RMQ = matchMedia("(prefers-reduced-motion: reduce)"), PHONE = matchMedia("(max-width: 600px)");
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
let PAN = null;             // the open client page { id, pan, scrim, opener }
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
function nextHTML(m) {
  if (!m.next) return `<span class="fc-next none">${m.total ? "Nothing else due" : "No items yet"}</span>`;
  const [t, k] = due(m.next);
  return `<span class="fc-next"><span class="fc-l">Next</span><b>${esc(m.next.title)}</b>${t ? `<span class="fc-due ${k}">${esc(t)}</span>` : ""}</span>`;
}

/* ---------------- the list ---------------- */
const none = (h, p) => `<div class="card sp-card fc-none"><span class="fc-none-i">${ic("flag")}</span><b>${esc(h)}</b><p>${esc(p)}</p></div>`;
function listHTML() {
  if (!D || D.missing) return none("No scopes tracked yet", "When a funnel client's scope is set up, every promise (sites, posting, Shorts and the rest) shows up here with its due date.");
  if (!D.clients.length) return none("No funnel clients yet", "Clients who paid for more than videos show up here once they are marked, with everything their scope promised.");
  const ms0 = D.clients.map(model).sort((a, b) => RANK[a.state] - RANK[b.state] || a.c.name.localeCompare(b.c.name)), cnt = k => ms0.filter(m => m.state === k).length;
  const sum = `<div class="fc-sum" aria-label="All funnel clients">
    <div class="tile fc-st"><span class="fc-l">Funnel clients</span><b>${ms0.length}</b></div>
    <div class="tile fc-st${cnt("behind") ? " bad" : ""}" data-k="behind"><span class="fc-l">Behind</span><b>${cnt("behind")}</b></div>
    <div class="tile fc-st${cnt("risk") ? " warn" : ""}" data-k="risk"><span class="fc-l">At risk</span><b>${cnt("risk")}</b></div>
    <div class="tile fc-st" data-k="wait"><span class="fc-l">Waiting on clients</span><b>${ms0.reduce((a, m) => a + m.wait, 0)}</b></div></div>`;
  return `${sum}<div class="fc-grid">${ms0.map(m => `<button type="button" class="tile fc-card" data-fc="${esc(m.c.id)}" data-state="${m.state}" aria-label="Open ${esc(m.c.name)}">
    <span class="fc-r1"><b class="fc-nm">${esc(m.c.name)}</b>${badge(m)}</span>
    ${m.c.plan ? `<span class="fc-plan">${esc(m.c.plan)}</span>` : ""}
    <span class="fc-pr">${bar(m)}<span class="fc-pn">${m.live} / ${m.total} live</span></span>
    ${nextHTML(m)}
    <span class="fc-wait${m.wait ? " on" : ""}">Waiting on client: ${m.wait}</span></button>`).join("")}</div>`;
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
function pageHTML(c) {
  const m = model(c), s = shortsOf(c.id);
  return `<section class="fc-sec" aria-labelledby="fc-h-next"><h3 id="fc-h-next">Next up</h3>${nextUpHTML(m)}</section>
    <section class="fc-sec" aria-labelledby="fc-h-build"><h3 id="fc-h-build">What we're building</h3>${buildHTML(m, s)}</section>
    <section class="fc-sec" aria-labelledby="fc-h-info"><h3 id="fc-h-info">Client info</h3>${infoHTML(c)}</section>
    ${m.its.length ? `<section class="fc-sec fc-all" aria-labelledby="fc-h-all"><h3 id="fc-h-all"><button type="button" class="fc-fold" data-fcall aria-expanded="${LIST_OPEN}">Full checklist <small>${m.live} / ${m.total} live</small><i aria-hidden="true"></i></button></h3>
      <div class="fc-allb"${LIST_OPEN ? "" : " hidden"}>${checklistHTML(m, s)}</div></section>` : ""}`;
}
function headHTML(c) {
  const m = model(c);
  return `<div class="fc-phh"><h2 id="fc-pt">${esc(c.name)}</h2><p class="fc-sub">${badge(m)}<span class="fc-pr">${bar(m)}<span class="fc-pn">${m.live} / ${m.total} live</span></span>${m.wait ? `<span class="fc-wait on">Waiting on client: ${m.wait}</span>` : ""}</p>
    <p class="mut">${esc([c.plan, c.show].filter(Boolean).join(" · ") || "Funnel client")}</p></div>`;
}

/* ---------------- painting ---------------- */
const fw = root => root.querySelectorAll("[data-fw]").forEach(e => e.style.setProperty("--w", e.dataset.fw + "%"));
const clientOf = id => D && D.clients.find(c => c.id === String(id)) || null;
function paint() {
  const list = document.getElementById("fc-list");
  if (list) { const a = document.activeElement, k = a && list.contains(a) && a.dataset.fc; list.innerHTML = listHTML(); fw(list); if (k) list.querySelector(`[data-fc="${CSS.escape(k)}"]`)?.focus({ preventScroll: true }); }
  if (PAN) { const c = clientOf(PAN.id); if (!c) { closeClient(true); return; } paintPanel(c); }
}
function paintPanel(c) {
  const body = PAN.pan.querySelector(".fc-pb"), a = document.activeElement, top = body.scrollTop, ptop = PAN.pan.scrollTop;
  const keep = a && body.contains(a) ? (a.dataset.fcall !== undefined ? ["fcall"] : a.dataset.fcnotes !== undefined ? ["fcnotes"] : [a.dataset.fcst ? "fcst" : a.dataset.fcset ? "fcset" : a.dataset.fcdt ? "fcdt" : "", a.closest("[data-key]")?.dataset.key, a.dataset.fcset]) : null;
  PAN.pan.querySelector(".fc-phw").innerHTML = headHTML(c); body.innerHTML = pageHTML(c); fw(PAN.pan); body.scrollTop = top; PAN.pan.scrollTop = ptop;
  if (keep && keep.length === 1) body.querySelector(`[data-${keep[0]}]`)?.focus({ preventScroll: true });
  else if (keep && keep[0] && keep[1]) { const li = body.querySelector(`[data-key="${CSS.escape(keep[1])}"]`), el = li && (keep[0] === "fcset" ? li.querySelector(`[data-fcset="${keep[2]}"]`) || li.querySelector("[data-fcst]") : li.querySelector(`[data-${keep[0]}]`)); el?.focus({ preventScroll: true }); }
}
const otherLayer = () => !!document.querySelector("#drawer:not([hidden]), #veil:not([hidden]), #pal:not([hidden]), #dlg:not([hidden])");
function openClient(id, opener) {
  const c = clientOf(id); if (!c) return; closeClient(true); MENU = null; LIST_OPEN = false; NOTES_OPEN = false; DET.clear();
  const scrim = document.createElement("div"); scrim.className = "fc-scrim"; scrim.id = "fc-scrim";
  const pan = document.createElement("aside"); pan.className = "fc-pan"; pan.id = "fc-pan"; pan.setAttribute("role", "dialog"); pan.setAttribute("aria-modal", "true"); pan.setAttribute("aria-labelledby", "fc-pt"); pan.dataset.client = c.id;
  pan.innerHTML = `<header class="fc-ph"><div class="fc-phw"></div><button type="button" class="icon-btn fc-x" data-fcx aria-label="Close"><svg aria-hidden="true"><use href="#i-x"/></svg></button></header><div class="fc-pb"></div>`;
  document.body.append(scrim, pan); PAN = { id: c.id, pan, scrim, opener: opener || null }; paintPanel(c);
  HTML.classList.add("fc-locked");
  if (motion()) requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add("on"); pan.classList.add("on"); })); else { scrim.classList.add("on"); pan.classList.add("on"); }
  pan.querySelector(".fc-x").focus({ preventScroll: true });
  scrim.addEventListener("click", () => closeClient());
}
function closeClient(quick) {
  if (!PAN) return; const { pan, scrim, opener } = PAN; PAN = null; MENU = null; HTML.classList.remove("fc-locked");
  const gone = () => { pan.remove(); scrim.remove(); };
  if (quick || !motion()) gone(); else { pan.classList.remove("on"); scrim.classList.remove("on"); pan.classList.add("out"); setTimeout(gone, 380); }
  if (!quick && opener && opener.isConnected) opener.focus({ preventScroll: true });
  else if (!quick) document.querySelector(`#fc-list [data-fc="${CSS.escape(String(pan.dataset.client))}"]`)?.focus({ preventScroll: true });
}
new MutationObserver(() => { if (PAN && !document.getElementById("fc-list")) closeClient(true); }).observe(document.getElementById("spage") || document.body, { childList: true });   // the page changed under the panel

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
  const t = ev.target; if (!t.closest || !A) return;
  const card = t.closest("#fc-list [data-fc]"); if (card) { openClient(card.dataset.fc, card); return; }
  if (!PAN || !PAN.pan.contains(t)) return;
  if (t.closest("[data-fcx]")) { closeClient(); return; }
  const pill = t.closest("[data-fcst]"); if (pill) { MENU = MENU === pill.dataset.fcst ? null : pill.dataset.fcst; paint(); if (MENU) PAN.pan.querySelector(`[data-key="${CSS.escape(MENU)}"] [aria-checked="true"]`)?.focus({ preventScroll: true }); return; }
  const mi = t.closest("[data-fcset]"); if (mi) { setStatus(mi.closest("[data-key]").dataset.id, mi.dataset.fcset); return; }
  if (t.closest("[data-fcall]")) { LIST_OPEN = !LIST_OPEN; MENU = null; paint(); return; }
  if (t.closest("[data-fcnotes]")) { NOTES_OPEN = !NOTES_OPEN; paint(); return; }
  const db = t.closest("[data-fcdt]"); if (db) { const k = db.dataset.fcdt; DET.has(k) ? DET.delete(k) : DET.add(k); paint(); return; }
});
document.addEventListener("keydown", ev => {
  if (!PAN || otherLayer()) return; const L = PAN.pan;
  if (ev.key === "Escape") { ev.preventDefault(); ev.stopImmediatePropagation(); if (MENU) { const k = MENU; MENU = null; paint(); L.querySelector(`[data-fcst="${CSS.escape(k)}"]`)?.focus({ preventScroll: true }); } else closeClient(); return; }
  if (ev.key === "Tab") {
    const f = [...L.querySelectorAll('button:not([disabled]),a[href]')].filter(x => x.offsetParent !== null && !x.closest("[hidden]")); if (!f.length) return;
    const a = document.activeElement, first = f[0], last = f[f.length - 1];
    if (!L.contains(a)) { ev.preventDefault(); first.focus(); } else if (ev.shiftKey && a === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && a === last) { ev.preventDefault(); first.focus(); }
  }
}, true);

function view() { return `<section class="fc" id="fc-list" aria-label="Funnel">${listHTML()}</section>`; }
function wire(api) {
  A = api; const list = document.getElementById("fc-list"); if (list) fw(list);
  if (PAN) { const c = clientOf(PAN.id); c ? paintPanel(c) : closeClient(true); }   // the 5-minute refresh redrew the list: the open client follows the new rows
}
(window.BEJU_SIDE_PAGES = window.BEJU_SIDE_PAGES || {}).funnel = {
  title: "Funnel",
  head: ["Funnel", "What we promised each funnel client, what's due next, and what we've built for them."],
  src: d => d && !d.missing ? ["Scopes", null] : null,
  load, view, wire,
};
})();
