/* BEJÚ founder CRM: client delivery board (Clients page). One board per client (opens from a client row) and an all-clients board
   behind the "List | Board" switch. Columns: Building → Ready → Sent → Changes asked → Approved. A batch is ONE stacked card (collapsed:
   name, item count, a small count per status, due date); a click opens its items, each with its own status. A one-off is a stack of 1.
   A stack sits in the column where its work is: any item with changes asked → Changes asked, else the least advanced item.
   Ready: the batch delivery email (public.drafts, category client_delivery) with Send / Edit / What to change and the "Sends in" countdown,
   wired to the same draft writes the Samples board uses (crm.js's upd / ask / sha256hex through window.BEJU_CRM_SAMPLES).
   A client with hold_sends (clients.hold_sends) shows "Waits for a founder" and no countdown; the switch in the board's header writes it.
   Data: public.client_items (read here, once per Clients page load, plus a targeted re-read after realtime events on its OWN channel)
   and clients.hold_sends. A database without the table yet (or the column) shows a calm "No deliveries tracked yet". No thumbnails.
   Registered with side.js through window.BEJU_CLIENT_BOARD (load / bar) and one delegated click handler: side.js wires nothing.
   CSP: no inline styles (CSSOM only). Look: clientboard.css reuses the Samples board's columns, chips and email panel classes. */
(() => {
"use strict";
const X = () => window.BEJU_CRM_SAMPLES;
const HTML = document.documentElement, RMQ = matchMedia("(prefers-reduced-motion: reduce)");
const motion = () => !RMQ.matches && HTML.dataset.motion !== "calm";
const esc = s => String(s ?? "").replace(/[&<>"'`]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" }[c]));
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const lc = s => String(s || "").toLowerCase().trim();
const ms = t => { const v = t ? +new Date(t) : 0; return isFinite(v) ? v : 0; };
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const webUrl = v => { try { const u = new URL(String(v || "").trim()); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
const span = d => { const m = Math.max(0, Math.round(d / 6e4)); return m < 60 ? `${Math.max(1, m)} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };

/* the five columns: id = the client_items.status they hold */
const COLS = [["building", "Building", "Nothing in edit"], ["ready", "Ready", "Nothing waiting to send"], ["sent", "Sent", "Nothing out right now"],
  ["changes", "Changes asked", "No changes asked"], ["approved", "Approved", "Nothing approved yet"]];
const ST = Object.fromEntries(COLS.map(c => [c[0], c[1]]));
const ORDER = { building: 0, ready: 1, sent: 2, approved: 3 };   // how far along; "changes" is handled apart
const OPEN_ST = new Set(["building", "ready", "changes"]);       // not delivered / not settled: they carry a due date and can be overdue
const EMPTY = "No deliveries tracked yet";

let API = null;              // side.js's helpers (esc, dayOf, dLabel, toast, sb, all)
let D = null;                // side.js's clients data: D.list = every client with its orders, plan, videos
let ITEMS = null;            // client_items rows; null = the table is not readable (not created yet)
let HOLD = null;             // Map client id -> hold_sends; null = the column is not readable yet
let MODE = store.get("beju-cb-mode") === "board" ? "board" : "list";
const OPEN = new Set();      // expanded stack keys
let DRW = null;              // the open client board { id, pan, scrim, opener }
let CH = null, CHT = null, CHR = null, DIRTY = false, READ_AT = 0;

const dayOf = t => API ? API.dayOf(t) : "";
const dLabel = d => API ? API.dLabel(d) : d;
const clientOf = id => D && D.list.find(c => String(c.id) === String(id)) || null;

/* ---------------- data ---------------- */
async function readItems() { try { return await API.all("client_items", "*"); } catch { return null; } }
async function load(api) {
  API = api;
  const [items, holds] = await Promise.all([readItems(), api.all("clients", "id,hold_sends").then(r => r, () => null)]);
  ITEMS = items; HOLD = holds ? new Map(holds.map(r => [String(r.id), !!r.hold_sends])) : null; READ_AT = Date.now();
  if (ITEMS) subscribe();
  return true;
}
/* realtime on its OWN channel (a table that is not in the publication yet makes the server reject every listener on a channel; here
   that costs only this board): events coalesce into one targeted read at most every 10 s; a rejected channel is dropped and retried in 15 min */
function subscribe() {
  if (CH || !API || !API.sb()) return;
  try { const ch = CH = API.sb().channel("crm-live-client_items");
    ch.on("postgres_changes", { event: "*", schema: "public", table: "client_items" }, () => {
      if (CHT) return; CHT = setTimeout(async () => { CHT = null; const rows = await readItems(); if (rows) { ITEMS = rows; READ_AT = Date.now(); repaint(); } }, Math.max(1500, READ_AT + 10000 - Date.now())); });
    ch.on("system", {}, m => { if (!m || m.extension !== "postgres_changes" || m.status !== "error" || CH !== ch) return;
      CH = null; try { API.sb().removeChannel(ch); } catch {} CHR = setTimeout(() => { CHR = null; subscribe(); }, 15 * 6e4); });
    ch.subscribe();
  } catch { CH = null; }
}
const drafts = () => ((X() && X().raw && X().raw.drafts) || []).filter(d => d.category === "client_delivery");

/* ---------------- model: items → stacks → columns ---------------- */
const keyOf = i => `${i.client_id || "n:" + lc(i.client_name)}|${i.batch_key || "item-" + i.id}`;
const pretty = k => { const s = String(k || "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim(); return s ? s[0].toUpperCase() + s.slice(1) : "Batch"; };
function colOf(items) {
  if (items.some(i => i.status === "changes")) return "changes";
  return COLS.map(c => c[0]).filter(c => c !== "changes").reduce((a, c) => items.some(i => i.status === c) && (a == null || ORDER[c] < ORDER[a]) ? c : a, null) || "building";
}
function stacksOf(items) {
  const m = new Map();
  items.forEach(i => { const k = keyOf(i); (m.get(k) || m.set(k, []).get(k)).push(i); });
  const out = [...m].map(([key, its]) => {
    its.sort((a, b) => ms(a.status_at) - ms(b.status_at) || a.id - b.id);
    const open = its.filter(i => OPEN_ST.has(i.status)), due = Math.min(Infinity, ...open.map(i => ms(i.due_at) || Infinity)), f = its[0];
    return { key, items: its, col: colOf(its), name: its.length === 1 ? f.title : pretty(f.batch_key), cid: f.client_id, cname: f.client_name || (clientOf(f.client_id) || {}).name || "Client", due: isFinite(due) ? due : 0 };
  });
  return out.sort((a, b) => (a.due || 1e15) - (b.due || 1e15) || ms(b.items[0].status_at) - ms(a.items[0].status_at));
}
const holdOf = cid => !!(HOLD && HOLD.get(String(cid)));
function draftOf(s) {
  const all = drafts(), ids = new Set(s.items.map(i => i.draft_id).filter(x => x != null).map(String));
  const hit = all.filter(d => ids.has(String(d.id)));
  if (hit.length) return hit.sort((a, b) => ms(b.created_at) - ms(a.created_at))[0];
  const c = clientOf(s.cid), es = new Set(((c && c.emails) || []).map(lc));   // no link on the items: the client's newest open delivery draft
  return s.col === "ready" ? all.filter(d => es.has(lc(d.lead_email))).sort((a, b) => ms(b.created_at) - ms(a.created_at))[0] || null : null;
}
/* the countdown: only a pending draft with an auto_send_at, and never for a client who holds */
const autoLeft = (d, hold) => { const t = !hold && d && d.status === "pending" ? ms(d.auto_send_at) : 0; return t ? t - Date.now() : null; };
const clock = l => { const s = Math.max(0, Math.ceil(l / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const autoTxt = (d, hold) => { const l = autoLeft(d, hold); return l == null ? "" : l > 0 ? `Sends in ${clock(l)}` : "Sending now"; };
const cdSpan = (d, hold) => { const l = autoLeft(d, hold); return l == null ? "" : `<span class="sm-cdb" data-cd="${ms(d.auto_send_at)}">${esc(autoTxt(d, hold))}</span>`; };

/* header numbers of a client: owed / delivered this month / next due / overdue. Owed and delivered use what the Clients page already
   computed (the monthly plan, open packs, delivered videos); a client with none of that falls back to the board's own items. */
function statsOf(c, its) {
  const now = Date.now(), mo = dayOf(now).slice(0, 7), open = its.filter(i => OPEN_ST.has(i.status));
  let owed = null, of = "";
  if (c && c.plan && c.plan.shorts) { owed = Math.max(0, c.plan.shorts - (c.plan.done || 0)); of = `of ${c.plan.shorts} this month`; }
  else if (c) { const o = (c.packs || []).filter(x => x.status === "open" && x.bought != null); if (o.length) { owed = o.reduce((a, x) => a + Math.max(0, x.bought - Math.min(x.done || 0, x.bought)), 0); of = `of ${o.reduce((a, x) => a + x.bought, 0)} in open packs`; } }
  if (owed == null) { owed = open.length; of = "still to deliver"; }
  const vids = c ? (c.vids || []).filter(v => String(v.delivered_at || "").slice(0, 7) === mo).length : 0;
  const sent = its.filter(i => { const t = ms(i.sent_at) || ms(i.approved_at); return t && dayOf(t).slice(0, 7) === mo; }).length;
  const dues = open.map(i => ms(i.due_at)).filter(Boolean), up = dues.filter(t => t >= now).sort((a, b) => a - b)[0] || 0, over = dues.filter(t => t < now).length;
  return { owed, of, done: Math.max(vids, sent), next: up, over };
}
function dueTxt(t) {
  const n = Date.now(); if (!t) return ""; if (t < n) return `Overdue · ${span(n - t)}`;
  const d = dayOf(t), td = dayOf(n); return d === td ? "Due today" : `Due ${dLabel(d)}`;
}

/* ---------------- html ---------------- */
function itemHTML(i) {
  const u = webUrl(i.drive_link), q = i.status === "approved" && String(i.approved_quote || "").trim(), note = i.status === "changes" && String(i.changes_note || "").trim();
  return `<li class="cb-it" data-id="${esc(i.id)}" data-st="${i.status}"><span class="cb-chip s-${i.status}">${esc(ST[i.status] || i.status)}</span><span class="cb-tt">${esc(i.title)}</span>
    ${u ? `<a class="cb-lk" href="${esc(u)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(i.title)} in Drive">${ic("link")}<span>Open</span></a>` : ""}
    ${q ? `<button type="button" class="cb-qb" data-cbq aria-expanded="false" aria-label="Show the approval">${ic("msg")}<span>Quote</span></button>` : ""}
    ${note ? `<span class="cb-note">${esc(note)}</span>` : ""}
    ${q ? `<q class="cb-q">${esc(q)}</q>` : ""}</li>`;
}
const EM_ST = { pending: "", held: "Sent back with changes. Claude is on it; it comes back here when fixed.", approved: "Approved. It goes out within a minute.", sending: "Sending now.",
  failed: "Not sent: Instantly refused it. Read the reason, then send again or close it.", stale: "Not sent: the thread moved after this was drafted. Claude is writing a fresh one; it comes back here.", unknown: "Unclear if it went out. Check Instantly before anything else." };
function emailHTML(s) {
  const d = draftOf(s), hold = holdOf(s.cid);
  if (!d) return `<section class="cb-em" data-k="${esc(s.key)}"><h4>Delivery email</h4><p class="sm-pe">No email drafted yet. Claude adds it here when the batch is ready.</p></section>`;
  const st = d.status, can = /^(pending|held|failed)$/.test(st), edit = /^(pending|held)$/.test(st), tm = autoTxt(d, hold);
  return `<section class="cb-em" data-k="${esc(s.key)}" data-draft="${esc(d.id)}"><h4>Delivery email</h4>
    <p class="sm-emh"><span>From <b>${esc(d.inbox)}</b></span><span>To <b>${esc([d.to_email, ...(d.cc_list || [])].join(", "))}</b></span></p>
    ${hold && st === "pending" ? `<p class="sm-ems timer cb-hold">Waits for a founder. This client's emails never send themselves.</p>` : tm ? `<p class="sm-ems timer"><b class="sm-cdb" data-cd="${ms(d.auto_send_at)}">${esc(tm)}</b> unless you send it, edit it or send it back. An edit restarts the hour.</p>` : ""}
    ${EM_ST[st] ? `<p class="sm-ems ${st}">${esc(EM_ST[st])}${d.error && /^(failed|unknown|stale)$/.test(st) ? ` <small>${esc(String(d.error).slice(0, 200))}</small>` : ""}</p>` : ""}
    ${d.founder_note ? `<p class="sm-emn"><b>Your note</b> ${esc(d.founder_note)}</p>` : ""}
    <pre class="sm-emb cb-emb">${esc(d.body)}</pre>
    <div class="sm-emed cb-emed" hidden><textarea class="sm-emta cb-emta" rows="10" aria-label="Edit the email"></textarea><div class="acts sm-pacts"><button type="button" class="act go" data-cbe="save">${ic("check")}Save</button><button type="button" class="act" data-cbe="cancel">Cancel</button></div></div>
    <div class="sm-emch cb-emch" hidden><label class="sm-eml">What should change? The videos, the email, or both.</label><textarea class="sm-emta cb-chta" rows="4" maxlength="1000" aria-label="What should change" placeholder="e.g. start on the second sentence; make the captions bigger; drop the last line of the email"></textarea><div class="acts sm-pacts"><button type="button" class="act go" data-cbe="back">${ic("send")}Send to Claude</button><button type="button" class="act" data-cbe="cancel">Cancel</button></div></div>
    <p class="sm-emerr cb-emerr" role="alert" hidden></p>
    ${can ? `<div class="acts sm-pacts cb-emacts"><button type="button" class="act go" data-cbe="send">${ic("send")}Send</button>${edit ? `<button type="button" class="act" data-cbe="edit">${ic("edit")}Edit</button>` : ""}<button type="button" class="act" data-cbe="change">${ic("refresh")}What to change</button></div>` : ""}</section>`;
}
function stackHTML(s, chips) {
  const n = s.items.length, count = st => s.items.filter(i => i.status === st).length, open = OPEN.has(s.key), hold = holdOf(s.cid);
  const d = s.col === "ready" ? draftOf(s) : null, cd = d ? cdSpan(d, hold) : "";
  const sts = COLS.filter(c => count(c[0])).map(c => `<span class="cb-chip s-${c[0]}">${count(c[0])} ${esc(c[1])}</span>`).join("");
  const due = dueTxt(s.due), over = s.due && s.due < Date.now();
  const mail = s.col === "ready" ? (hold ? `<span class="cb-chip s-hold">Waits for a founder</span>` : cd ? `<span class="cb-chip s-go">${cd}</span>` : d ? `<span class="cb-chip s-ready">Email ready</span>` : "") : "";
  return `<article class="cb-stack${n > 1 ? " multi" : ""}${open ? " open" : ""}" data-key="${esc(s.key)}" data-col="${s.col}" data-n="${n}">
    <button type="button" class="cb-sh" aria-expanded="${open}" aria-controls="${esc("cbi-" + s.key.replace(/[^\w-]/g, "_"))}">
      <span class="cb-r1"><b class="cb-nm">${esc(s.name)}</b><span class="cb-cnt" aria-label="${n} item${n === 1 ? "" : "s"}">${n}</span></span>
      ${chips ? `<span class="cb-cl">${esc(s.cname)}</span>` : ""}
      <span class="cb-sts">${sts}</span>
      ${due || mail ? `<span class="cb-ft">${due ? `<span class="cb-due${over ? " late" : ""}">${esc(due)}</span>` : ""}${mail}</span>` : ""}
    </button>
    <div class="cb-items" id="${esc("cbi-" + s.key.replace(/[^\w-]/g, "_"))}"${open ? "" : " hidden"}><ul class="cb-ul">${s.items.map(itemHTML).join("")}</ul>${s.col === "ready" ? emailHTML(s) : ""}</div></article>`;
}
function boardHTML(items, chips) {
  const st = stacksOf(items);
  return `<div class="cb-board">${COLS.map(([id, name, none], ci) => { const ss = st.filter(s => s.col === id);
    return `<section class="sm-col cb-col" data-col="${id}" aria-labelledby="cbh-${id}"><header class="sm-ch"><span class="sm-step" aria-hidden="true">${String(ci + 1).padStart(2, "0")}</span><h2 id="cbh-${id}">${name}</h2><b class="sm-cnt cb-cn" data-cnt="${id}" aria-label="${ss.length} card${ss.length === 1 ? "" : "s"}">${ss.length}</b></header>
      <div class="sm-list cb-list">${ss.length ? ss.map(s => stackHTML(s, chips)).join("") : `<p class="sm-empty">${esc(none)}</p>`}</div></section>`; }).join("")}</div>`;
}
const none = () => `<div class="card sp-card cb-none"><span class="cb-none-i">${ic("board")}</span><b>${EMPTY}</b><p>When we start work for a client, every batch shows up here and moves across as it is built, sent and approved.</p></div>`;
function allHTML() { return !ITEMS || !ITEMS.length ? none() : boardHTML(ITEMS, true); }
function tilesHTML(c, its) {
  const t = statsOf(c, its);
  return `<div class="cb-stats" aria-label="This month">
    <div class="tile cb-tl" data-t="owed"><span class="ec-l">Owed this month</span><b class="cb-big">${t.owed}</b><small>${esc(t.of)}</small></div>
    <div class="tile cb-tl" data-t="done"><span class="ec-l">Delivered this month</span><b class="cb-big">${t.done}</b><small>Shorts out the door</small></div>
    <div class="tile cb-tl" data-t="next"><span class="ec-l">Next due</span><b class="cb-big cb-date">${t.next ? esc(dayOf(t.next) === dayOf(Date.now()) ? "Today" : dLabel(dayOf(t.next))) : "—"}</b><small>${t.next ? esc(its.filter(i => OPEN_ST.has(i.status) && ms(i.due_at) === t.next)[0].title) : "nothing due"}</small></div>
    <div class="tile cb-tl${t.over ? " bad" : ""}" data-t="over"><span class="ec-l">Overdue</span><b class="cb-big">${t.over}</b><small>${t.over ? `item${t.over === 1 ? "" : "s"} past the due date` : "all on time"}</small></div></div>`;
}
function holdHTML(c) {
  if (!c || !HOLD) return "";
  const on = holdOf(c.id);
  return `<button type="button" class="cb-sw" role="switch" aria-checked="${on}" data-cbhold="${esc(c.id)}"><i aria-hidden="true"></i><span>Always wait for a founder</span></button>`;
}
function clientBoardHTML(c) {
  const its = (ITEMS || []).filter(i => String(i.client_id) === String(c.id));
  return `${tilesHTML(c, its)}${its.length ? boardHTML(its, false) : none()}`;
}
/* side.js puts this between the Clients overview tiles and the list: the List | Board switch, then the all-clients board */
function bar(d) {
  D = d; if (!API) return "";
  return `<div class="cb-bar" id="cb-bar" data-cbm="${MODE}"><div class="cb-seg" role="group" aria-label="Clients view"><button type="button" class="cb-sg" data-cbm-set="list" aria-pressed="${MODE === "list"}">List</button><button type="button" class="cb-sg" data-cbm-set="board" aria-pressed="${MODE === "board"}">Board</button></div></div>
    <section class="cb-all" id="cb-all" aria-label="Delivery board, all clients">${allHTML()}</section>`;
}

/* ---------------- painting ---------------- */
const editing = el => !!el && [...el.querySelectorAll(".cb-emed,.cb-emch")].some(x => !x.hidden);
function paintInto(el, html) {
  const a = document.activeElement, sh = a && a.classList && a.classList.contains("cb-sh") && el.contains(a) ? a.closest(".cb-stack").dataset.key : null;
  el.innerHTML = html; if (sh) el.querySelector(`[data-key="${CSS.escape(sh)}"] .cb-sh`)?.focus({ preventScroll: true });
}
function repaint() {
  if (!D) return;
  const all = document.getElementById("cb-all"), body = DRW && DRW.pan.querySelector(".cb-pb");
  if ((all && editing(all)) || (body && editing(body))) { DIRTY = true; return; }   // never wipe an email someone is typing
  DIRTY = false;
  if (all) paintInto(all, allHTML());
  if (DRW && body) { const c = clientOf(DRW.id); if (c) { paintInto(body, clientBoardHTML(c)); const hs = DRW.pan.querySelector(".cb-hs"); if (hs) hs.innerHTML = holdHTML(c); } }
}
addEventListener("beju-crm:data", repaint);

/* ---------------- the client's board (a panel, like the Samples one) ---------------- */
const otherLayer = () => !!document.querySelector("#drawer:not([hidden]), #veil:not([hidden]), #pal:not([hidden]), #dlg:not([hidden])");
function openClient(id, opener) {
  const c = clientOf(id); if (!c || !API) return false; closeClient(true);
  const scrim = document.createElement("div"); scrim.className = "sm-scrim cb-scrim"; scrim.id = "cb-scrim";
  const pan = document.createElement("aside"); pan.className = "cb-pan"; pan.id = "cb-pan"; pan.setAttribute("role", "dialog"); pan.setAttribute("aria-modal", "true"); pan.setAttribute("aria-labelledby", "cb-pt"); pan.dataset.client = String(id);
  pan.innerHTML = `<header class="cb-ph"><div class="cb-phh"><h2 id="cb-pt">${esc(c.name || "Client")}</h2><p class="mut">${esc([c.show, (c.emails || [])[0]].filter(Boolean).join(" · ") || "Delivery board")}</p></div><span class="cb-hs">${holdHTML(c)}</span>
    <button type="button" class="act cb-det" data-cbclose>Client details</button><button type="button" class="icon-btn cb-x" data-cbclose aria-label="Close"><svg><use href="#i-x"/></svg></button></header>
    <div class="cb-pb">${clientBoardHTML(c)}</div>`;
  document.body.append(scrim, pan); DRW = { id: String(id), pan, scrim, opener: opener || null };
  HTML.classList.add("cb-locked");
  requestAnimationFrame(() => { scrim.classList.add("on"); pan.classList.add("on"); });
  pan.querySelector(".cb-x").focus({ preventScroll: true });
  scrim.addEventListener("click", () => closeClient());
  return true;
}
function closeClient(quick) {
  if (!DRW) return; const { pan, scrim, opener } = DRW; DRW = null; HTML.classList.remove("cb-locked");
  const gone = () => { pan.remove(); scrim.remove(); };
  if (quick || !motion()) gone(); else { pan.classList.remove("on"); scrim.classList.remove("on"); pan.classList.add("out"); setTimeout(gone, 380); }
  if (!quick && opener && opener.isConnected) opener.focus({ preventScroll: true });
  if (DIRTY) repaint();
}
document.addEventListener("keydown", ev => {
  if (!DRW || otherLayer()) return;
  if (ev.key === "Escape") { ev.preventDefault(); ev.stopImmediatePropagation(); closeClient(); return; }
  if (ev.key === "Tab") {
    const f = [...DRW.pan.querySelectorAll('button:not([disabled]),a[href],input,textarea,[tabindex="0"]')].filter(x => x.offsetParent !== null && !x.closest("[hidden]")); if (!f.length) return;
    const a = document.activeElement, first = f[0], last = f[f.length - 1];
    if (!DRW.pan.contains(a)) { ev.preventDefault(); first.focus(); } else if (ev.shiftKey && a === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && a === last) { ev.preventDefault(); first.focus(); }
  }
}, true);
new MutationObserver(() => { if (DRW && !document.getElementById("cb-bar")) closeClient(true); }).observe(document.getElementById("spage") || document.body, { childList: true });   // the page changed under the panel

/* ---------------- the delivery email: the same writes as the Samples board, category client_delivery ---------------- */
async function emailOp(op, btn) {
  const C = X(), pan = btn.closest(".cb-em"), id = pan && pan.dataset.draft, d = id && drafts().find(x => String(x.id) === String(id)); if (!C || !pan || !d) return;
  const s = (ITEMS ? stacksOf(ITEMS) : []).find(x => x.key === pan.dataset.k), who = (s && s.cname) || "the client";
  const $p = q => pan.querySelector(q), err = $p(".cb-emerr"), say = m => { err.hidden = false; err.textContent = m; }; err.hidden = true;
  const show = w => { $p(".cb-emed").hidden = w !== "edit"; $p(".cb-emch").hidden = w !== "change"; $p(".cb-emb").hidden = w === "edit"; const a = $p(".cb-emacts"); if (a) a.hidden = !!w; if (!w && DIRTY) repaint(); };
  if (op === "edit") { show("edit"); const t = $p(".cb-emta"); t.value = d.body; t.focus(); return; }
  if (op === "change") { show("change"); $p(".cb-chta").focus(); return; }
  if (op === "cancel") { show(""); return; }
  let body = null, done = "";
  if (op === "send") {
    /* read the email fresh first: if Claude changed it since this page painted, show the new text and ask to read it */
    if (C.drafts) { const before = d.body_sha256; await C.drafts().catch(() => {}); const d2 = drafts().find(x => String(x.id) === String(id));
      if (!d2 || d2.body_sha256 !== before || d2.status !== d.status) { repaint(); const p2 = document.querySelector(`.cb-em[data-draft="${CSS.escape(String(id))}"] .cb-emerr`); if (p2) { p2.hidden = false; p2.textContent = "This email just changed. Read the new version, then press Send."; } return; } }
    const shown = $p(".cb-emb").textContent;
    if (shown !== String(d.body).replace(/\r\n?/g, "\n")) return say("The email on screen is not the saved one any more. Close this and open it again.");
    const r = await C.ask({ title: `Send this to ${who}?`, warn: `It goes out within a minute from ${d.inbox} to ${[d.to_email, ...(d.cc_list || [])].join(", ")}, word for word.`, sees: shown, cta: "Send it" }); if (!r) return;
    body = { status: "approved", approved_sha256: await C.sha256hex(d.body) }; done = "Sending. It goes out within a minute.";
  } else if (op === "save") {
    const v = $p(".cb-emta").value; if (!v.trim()) return say("The email can't be empty.");
    body = { body: v, ...(d.status === "pending" ? {} : { status: "pending" }) }; done = "Saved. Read it once more, then send.";
  } else if (op === "back") {
    const v = $p(".cb-chta").value.trim(); if (!v) return say("Write what should change first.");
    body = { status: "held", founder_note: v.slice(0, 1000) }; done = "Sent to Claude. The fixed version comes back here.";
  }
  if (!body) return; btn.disabled = true;
  try { await C.upd("drafts", +d.id, body); C.toast(done, "check", "c-green", who); show(""); await (C.drafts ? C.drafts() : C.refresh()); repaint(); }
  catch (e) { say(String(e && e.message || e)); if (btn.isConnected) btn.disabled = false; }
}
/* "Always wait for a founder": clients.hold_sends, written like the page's other writes (the founder's own login, row-level security) */
async function setHold(id, btn) {
  const on = !holdOf(id); btn.disabled = true;
  try {
    const { data, error } = await API.sb().from("clients").update({ hold_sends: on }).eq("id", id).select("id"); if (error) throw error;
    if (!data || !data.length) throw new Error("not allowed. The 2-step login may have expired: sign in again");
    HOLD.set(String(id), on); API.toast(on ? "This client's emails now wait for a founder" : "This client's emails send themselves after an hour"); repaint();
    if (DRW) { const hs = DRW.pan.querySelector(".cb-hs"); if (hs) { hs.innerHTML = holdHTML(clientOf(id)); hs.querySelector(".cb-sw")?.focus(); } }
  } catch (e) { btn.disabled = false; API.toast(`Couldn't save: ${String(e && e.message || e).slice(0, 120)}`); }
}

/* ---------------- one delegated click handler ---------------- */
document.addEventListener("click", ev => {
  const t = ev.target; if (!t.closest) return;
  const seg = t.closest("[data-cbm-set]"); if (seg) { MODE = seg.dataset.cbmSet === "board" ? "board" : "list"; store.set("beju-cb-mode", MODE); const b = document.getElementById("cb-bar"); if (b) { b.dataset.cbm = MODE; b.querySelectorAll("[data-cbm-set]").forEach(x => x.setAttribute("aria-pressed", x.dataset.cbmSet === MODE)); } return; }
  const sh = t.closest(".cb-sh"); if (sh) { const st = sh.closest(".cb-stack"), on = sh.getAttribute("aria-expanded") !== "true"; sh.setAttribute("aria-expanded", on); st.classList.toggle("open", on); st.querySelector(".cb-items").hidden = !on; on ? OPEN.add(st.dataset.key) : OPEN.delete(st.dataset.key); return; }
  const qb = t.closest("[data-cbq]"); if (qb) { const li = qb.closest(".cb-it"), on = !li.classList.contains("q-open"); li.classList.toggle("q-open", on); qb.setAttribute("aria-expanded", on); return; }
  const eb = t.closest("[data-cbe]"); if (eb) { emailOp(eb.dataset.cbe, eb); return; }
  const hb = t.closest("[data-cbhold]"); if (hb) { setHold(hb.dataset.cbhold, hb); return; }
  if (t.closest("[data-cbclose]")) { closeClient(); return; }
  /* a client row opens that client's board (the page's own handler still selects the row; a touch tap on the activity dot only shows its note) */
  const row = t.closest("#cl-list [data-cl]"); if (row && API && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !(t.closest(".cl-ad") && (innerWidth <= 900 || matchMedia("(hover: none)").matches))) openClient(row.dataset.cl, row);
});

(window.BEJU_CLIENT_BOARD = window.BEJU_CLIENT_BOARD || {}).load = load;
window.BEJU_CLIENT_BOARD.bar = bar;
})();
