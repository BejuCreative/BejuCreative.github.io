/* BEJÚ founder CRM: client delivery board (Clients page). One board per client (opens from a client row) and an all-clients board
   behind the "List | Board" switch. Columns: Building → Ready → Sent → Changes asked (BENAS 11-24: no Approved column; a fixed version goes back to Sent; Changes asked shows only when it has cards). A batch is ONE stacked card (collapsed:
   name, item count, a small count per status, due date); a click opens its items, each with its own status. A one-off is a stack of 1.
   A stack sits in the column where its work is: any item with changes asked → Changes asked, else the least advanced item.
   Ready: the batch delivery email (public.drafts, category client_delivery) with Send / Edit / What to change and the "Sends in" countdown,
   wired to the same draft writes the Samples board uses (crm.js's upd / ask / sha256hex through window.BEJU_CRM_SAMPLES).
   A client with hold_sends (clients.hold_sends) shows "Waits for a founder" and no countdown; the switch in the board's header writes it.
   Data: public.client_items (read here, once per Clients page load, plus a targeted re-read after realtime events on its OWN channel)
   and clients.hold_sends. A database without the table yet (or the column) shows a calm "No deliveries tracked yet". No thumbnails.
   Registered with side.js through window.BEJU_CLIENT_BOARD (load / bar) and one delegated click handler: side.js wires nothing.
   CSP: no inline styles (CSSOM only). Look: clientboard.css reuses the Samples board's columns, chips and email panel classes.
   Phone (≤ 600 px, BENAS 11-24 "like an expensive app"): the board is tabs (Building · Ready N · Sent · Changes N, one column at a time,
   tap or swipe sideways; opens on Changes asked if it has cards, else Ready, else Building; a picked tab is kept for the session), and a
   Ready stack opens a full-screen sheet with the email and a fixed Send · Edit · What to change bar. Send there is one tap with a
   5-second "Sent · Undo" bar: the draft write happens only when the 5 seconds are up.
   Review (BENAS 11-24: "the delivery draft is already done; we click the Ready card, watch each Short, then approve; we see the email that
   will go out, edit it inside the CRM or send it as it is"): a Ready stack (phone: the full-screen sheet; desktop: a centred panel) is ONE
   screen: the batch's Shorts as a carousel of Drive players (swipe / arrows / ← →), each with ✓ Approve (client_items.founder_ok_at) and
   ✎ Needs changes (status 'changes' + changes_note "[m:ss] note", and the draft goes back to Claude: held, founder_note listing every
   Short's note); below it the delivery email as it will go out (Edit = the same editor); a fixed bar "Approve & send" (approves every Short
   not marked, then the same send: phone = 5-s Undo, desktop = the confirm) · "Needs changes" (the batch "What to change" note). With
   some Shorts approved and some marked, "Send the N approved now" holds the draft with "SEND APPROVED NOW: …; HOLD: …" for Claude. */
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
const sess = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch {} } };
const PHONE = matchMedia("(max-width: 600px)"), VV = window.visualViewport;
const webUrl = v => { try { const u = new URL(String(v || "").trim()); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
const span = d => { const m = Math.max(0, Math.round(d / 6e4)); return m < 60 ? `${Math.max(1, m)} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };
/* Drive: the same parse and player URL as samples.js (a file link or a bare id; a folder link has no file id = "Open in Drive" only) */
const driveId = v => { v = String(v || "").trim(); if (!v) return ""; const m = v.match(/\/file\/d\/([\w-]{10,})/) || v.match(/[?&]id=([\w-]{10,})/); if (m) return m[1]; return /^[\w-]{10,}$/.test(v) ? v : ""; };
const frameUrl = id => `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;

/* the five columns: id = the client_items.status they hold */
const COLS = [["building", "Building", "Nothing in edit"], ["ready", "Ready", "Nothing waiting to send"], ["sent", "Sent", "Nothing out right now"],
  ["changes", "Changes asked", "No changes asked"]];
const ST = Object.fromEntries(COLS.map(c => [c[0], c[1]]));
const ORDER = { building: 0, ready: 1, sent: 2 };
const sOf = st => st === "approved" ? "sent" : st;   // 11-24: an old "approved" row counts as Sent (no Approved column)   // how far along; "changes" is handled apart
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
let SHEET = null;            // the open review (phone sheet / desktop panel) { key, el, scrim, opener, idx = the Short shown, sig = its slides }
let UNDO = null;             // phone: an "Approve & send" waiting out its 5 seconds { id, bar, t }
const CUR = {};              // phone: the tab each board shows now (board key: "all" or "c:<client id>")
const PICK = (() => { try { return JSON.parse(sess.get("beju-cb-tab") || "{}") || {}; } catch { return {}; } })();   // tabs picked by hand this session

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
  return COLS.map(c => c[0]).filter(c => c !== "changes").reduce((a, c) => items.some(i => sOf(i.status) === c) && (a == null || ORDER[c] < ORDER[a]) ? c : a, null) || "building";
}
function stacksOf(items) {
  const m = new Map();
  /* 11-24 (SIMAS 23:40: "I added a revision for one video and it moved all their videos to Needs fixing… the videos should be separated
     and not grouped"): a batch only stacks the Shorts that sit in the SAME column; each Short moves on its own. */
  items.forEach(i => { const k = keyOf(i) + "|" + colOf([i]); (m.get(k) || m.set(k, []).get(k)).push(i); });
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
/* the delivery email in the review, exactly as it goes out: From / To / Subject (when the draft has one) / text, Edit in its header.
   Send and "What to change" live in the review's fixed bar (barHTML) */
function emailHTML(s) {
  const d = draftOf(s), hold = holdOf(s.cid);
  if (!d) return `<section class="cb-em" data-k="${esc(s.key)}"><h4>Delivery email</h4><p class="sm-pe">No email drafted yet. Claude adds it here when the batch is ready.</p></section>`;
  const st = d.status, edit = /^(pending|held)$/.test(st), tm = autoTxt(d, hold), subj = String(d.subject || "").trim();
  return `<section class="cb-em" data-k="${esc(s.key)}" data-draft="${esc(d.id)}"><header class="cb-emhd"><h4>Delivery email</h4>${edit ? `<button type="button" class="act cb-edb" data-cbe="edit">${ic("edit")}Edit</button>` : ""}</header>
    <p class="sm-emh"><span>From <b>${esc(d.inbox)}</b></span><span>To <b>${esc([d.to_email, ...(d.cc_list || [])].join(", "))}</b></span>${subj ? `<span>Subject <b>${esc(subj)}</b></span>` : ""}</p>
    ${hold && st === "pending" ? `<p class="sm-ems timer cb-hold">Waits for a founder. This client's emails never send themselves.</p>` : tm ? `<p class="sm-ems timer"><b class="sm-cdb" data-cd="${ms(d.auto_send_at)}">${esc(tm)}</b> unless you send it, edit it or send it back. An edit restarts the hour.</p>` : ""}
    ${EM_ST[st] ? `<p class="sm-ems ${st}">${esc(EM_ST[st])}${d.error && /^(failed|unknown|stale)$/.test(st) ? ` <small>${esc(String(d.error).slice(0, 200))}</small>` : ""}</p>` : ""}
    ${d.founder_note ? `<p class="sm-emn"><b>Your note</b> ${esc(d.founder_note)}</p>` : ""}
    <pre class="sm-emb cb-emb">${esc(d.body)}</pre>
    <div class="sm-emed cb-emed" hidden><textarea class="sm-emta cb-emta" rows="10" aria-label="Edit the email"></textarea><div class="acts sm-pacts"><button type="button" class="act go" data-cbe="save">${ic("check")}Save</button><button type="button" class="act" data-cbe="cancel">Cancel</button></div></div>
    <div class="sm-emch cb-emch" hidden><label class="sm-eml">What should change? The videos, the email, or both.</label><textarea class="sm-emta cb-chta" rows="4" maxlength="1000" aria-label="What should change" placeholder="e.g. start on the second sentence; make the captions bigger; drop the last line of the email"></textarea><div class="acts sm-pacts"><button type="button" class="act go" data-cbe="back">${ic("send")}Send to Claude</button><button type="button" class="act" data-cbe="cancel">Cancel</button></div></div>
    <p class="sm-emerr cb-emerr" role="alert" hidden></p></section>`;
}
/* ---------------- the review: which stacks open it, the carousel, the fixed bar ---------------- */
const isRv = s => s.col === "ready" || (s.col === "changes" && s.items.some(i => i.status === "ready"));   // a batch with Shorts to approve
const chOf = s => s.items.filter(i => i.status === "changes");
const okOf = s => s.items.filter(i => i.status === "ready" && i.founder_ok_at);
const tsOk = v => /^\d{1,3}:[0-5]\d$/.test(v);
const shortsNote = its => its.length ? `Needs changes: ${its.map(i => `${i.title}: ${String(i.changes_note || "").trim()}`).join("; ")}` : "";
function slideVid(i) {
  const id = driveId(i.drive_link), u = webUrl(i.drive_link);
  if (id) return `<iframe class="cb-frame" src="${esc(frameUrl(id))}" title="Short: ${esc(i.title)}" allow="autoplay; fullscreen" allowfullscreen referrerpolicy="no-referrer" loading="lazy"></iframe>`;
  return `<div class="cb-nov"><span class="cb-nov-i">${ic("video")}</span><b>${u ? "No preview for this link" : "No video yet"}</b>${u ? `<a class="act cb-ndl" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${ic("link")}Open in Drive</a>` : `<small>The Short shows here once its file is in Drive.</small>`}</div>`;
}
function slideInfo(i, k, n) {
  const id = esc(i.id), st = i.status, ok = st === "ready" && !!i.founder_ok_at, u = driveId(i.drive_link) ? webUrl(i.drive_link) || `https://drive.google.com/file/d/${encodeURIComponent(driveId(i.drive_link))}/view` : "", note = st === "changes" && String(i.changes_note || "").trim();
  const chip = st === "changes" ? `<span class="cb-chip s-changes">Needs changes</span>` : ok ? `<span class="cb-chip s-approved">Approved${i.founder_ok_by ? ` by ${esc(i.founder_ok_by)}` : ""}</span>` : st !== "ready" ? `<span class="cb-chip s-${sOf(st)}">${esc(ST[sOf(st)] || st)}</span>` : "";
  return `<div class="cb-slh"><b class="cb-slt">${esc(i.title)}</b><span class="cb-sln">${k + 1} of ${n}</span></div>
    ${chip || u ? `<p class="cb-slm">${chip}${u ? `<a class="cb-lk" href="${esc(u)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(i.title)} in Drive">${ic("link")}<span>Open in Drive</span></a>` : ""}</p>` : ""}
    ${note ? `<p class="cb-note cb-slnote">${esc(note)}</p>` : ""}
    ${st === "ready" ? `<div class="cb-slacts"><button type="button" class="act cb-okb" data-cbok="${id}" aria-pressed="${ok}">${ic("check")}${ok ? "Approved" : "Approve"}</button><button type="button" class="act cb-ncb" data-cbnc="${id}" aria-expanded="false">${ic("edit")}Needs changes</button></div>
    <div class="cb-nc" hidden><label class="sm-eml" for="cbn-${id}">What should change in this Short?</label><textarea id="cbn-${id}" class="sm-emta cb-ncta" rows="3" maxlength="600" placeholder="e.g. start on the second sentence; bigger captions"></textarea>
      <label class="cb-ncat"><span>At <small>(optional)</small></span><input class="cb-ncts" type="text" inputmode="numeric" placeholder="m:ss" maxlength="6" autocomplete="off" aria-label="At which moment, m:ss (optional)"></label>
      <p class="sm-emerr cb-ncerr" role="alert" hidden></p>
      <div class="acts sm-pacts"><button type="button" class="act go" data-cbncs="${id}">${ic("send")}Send to Claude</button><button type="button" class="act" data-cbncx>Cancel</button></div></div>` : ""}`;
}
function carHTML(s) {
  const n = s.items.length;
  return `<section class="cb-car" aria-roledescription="carousel" aria-label="The Shorts in this batch"><div class="cb-track">${s.items.map((i, k) => `<article class="cb-sl" data-id="${esc(i.id)}" role="group" aria-roledescription="slide" aria-label="${k + 1} of ${n}: ${esc(i.title)}">
      <div class="cb-vfw"><div class="cb-vf">${slideVid(i)}</div>${n > 1 ? `<button type="button" class="cb-nav prev" data-cbnav="-1" aria-label="Previous Short"${k ? "" : " hidden"}>${ic("back")}</button><button type="button" class="cb-nav next" data-cbnav="1" aria-label="Next Short"${k < n - 1 ? "" : " hidden"}>${ic("chev")}</button>` : ""}</div>
      <div class="cb-sli">${slideInfo(i, k, n)}</div></article>`).join("")}</div>
    ${n > 1 ? `<div class="cb-dots" aria-hidden="true">${s.items.map((_, k) => `<i${k ? "" : ' class="on"'}></i>`).join("")}</div>` : ""}</section>`;
}
/* the fixed bar: "Approve & send" (off, with the reason, while a Short needs changes) · "Needs changes"; "Send the N approved now" only
   when some Shorts are approved and some need changes (it sends nothing itself: Claude rewrites the email for those) */
function barHTML(s) {
  const d = draftOf(s); if (!d || !/^(pending|held|failed)$/.test(d.status)) return "";
  const ch = chOf(s), ok = okOf(s), part = ch.length > 0 && ok.length > 0;
  return `<div class="cb-emacts cb-rvbar" data-draft="${esc(d.id)}" data-k="${esc(s.key)}">
    ${ch.length ? `<p class="cb-rvh" id="cb-rvh">${ch.length} Short${ch.length === 1 ? "" : "s"} need${ch.length === 1 ? "s" : ""} changes, so the batch waits for the fix.</p>` : ""}
    ${part ? `<p class="cb-rvp"><button type="button" class="cb-rvok" data-cbpart>Send the ${ok.length} approved now</button><small>Claude rewrites the email for just ${ok.length === 1 ? "that one" : `those ${ok.length}`}; it comes back here.</small></p>` : ""}
    <div class="cb-rvbtns"><button type="button" class="act go" data-cbe="send" data-draft="${esc(d.id)}"${ch.length ? ` disabled aria-describedby="cb-rvh"` : ""}>${ic("send")}Approve &amp; send</button><button type="button" class="act" data-cbe="change">${ic("refresh")}Needs changes</button></div></div>`;
}
function stackHTML(s, chips) {
  const n = s.items.length, count = st => s.items.filter(i => sOf(i.status) === st).length, rv = isRv(s), open = !rv && OPEN.has(s.key), hold = holdOf(s.cid);
  const d = s.col === "ready" ? draftOf(s) : null, cd = d ? cdSpan(d, hold) : "";
  const sts = COLS.filter(c => count(c[0])).map(c => `<span class="cb-chip s-${c[0]}">${count(c[0])} ${esc(c[1])}</span>`).join("");
  const due = dueTxt(s.due), over = s.due && s.due < Date.now(), cid = esc("cbi-" + s.key.replace(/[^\w-]/g, "_"));
  /* 11-24 (BENAS: "I clicked approved on every card and it still said waiting for a founder"): the chip tells the truth about the approvals.
     No delivery email (clients whose Shorts we post ourselves) → "Approved · ready to post" once every Ready Short is approved, else "To review".
     With an email: on a held client, "Approved · send it" once all are approved, else "Waits for a founder"; otherwise the countdown / Email ready. */
  const rdy = s.items.filter(i => i.status === "ready"), okN = rdy.filter(i => i.founder_ok_at).length, allOk = rdy.length > 0 && okN === rdy.length;
  /* SIMAS 11-26: "I click approve but nothing moved": a partly approved batch says so ("1 of 7 approved · Simas") instead of "To review" */
  const part = okN && !allOk ? `<span class="cb-chip s-approved">${okN} of ${rdy.length} approved${(w => w.length ? " · " + esc(w.join(", ")) : "")([...new Set(rdy.filter(i => i.founder_ok_at && i.founder_ok_by).map(i => i.founder_ok_by))])}</span>` : "";
  const mail = s.col !== "ready" ? "" : !d ? (allOk ? `<span class="cb-chip s-approved">Approved · ready to post</span>` : part || `<span class="cb-chip s-hold">To review</span>`)
    : hold ? (allOk ? `<span class="cb-chip s-approved">Approved · send it</span>` : part || `<span class="cb-chip s-hold">Waits for a founder</span>`)
    : cd ? `<span class="cb-chip s-go">${cd}</span>` : `<span class="cb-chip s-ready">Email ready</span>`;
  return `<article class="cb-stack${n > 1 ? " multi" : ""}${open ? " open" : ""}${rv ? " rv" : ""}" data-key="${esc(s.key)}" data-col="${s.col}" data-n="${n}">
    <button type="button" class="cb-sh" ${rv ? `aria-haspopup="dialog"` :`aria-expanded="${open}" aria-controls="${cid}"`}>
      <span class="cb-r1"><b class="cb-nm">${esc(s.name)}</b><span class="cb-cnt" aria-label="${n} item${n === 1 ? "" : "s"}">${n}</span></span>
      ${chips ? `<span class="cb-cl">${esc(s.cname)}</span>` : ""}
      <span class="cb-sts">${sts}</span>
      ${due || mail ? `<span class="cb-ft">${due ? `<span class="cb-due${over ? " late" : ""}">${esc(due)}</span>` : ""}${mail}</span>` : ""}
    </button>
    ${rv ? "" : `<div class="cb-items" id="${cid}"${open ? "" : " hidden"}><ul class="cb-ul">${s.items.map(itemHTML).join("")}</ul></div>`}</article>`;
}
/* phone tabs: the same columns, one at a time (the tab strip is hidden on desktop) */
const TAB_NM = { building: "Building", ready: "Ready", sent: "Sent", changes: "Changes" };
function tabOf(bkey, ids, st) {
  const p = CUR[bkey] || PICK[bkey]; if (p && ids.includes(p)) return p;
  const has = c => st.some(s => s.col === c); return has("changes") ? "changes" : has("ready") ? "ready" : "building";
}
function boardHTML(items, chips, bkey) {
  const st = stacksOf(items), cols = COLS.filter(([id]) => id !== "changes" || st.some(s => s.col === "changes")), tab = CUR[bkey] = tabOf(bkey, cols.map(c => c[0]), st);
  const tabs = `<div class="cb-tabs" role="tablist" aria-label="Board columns" data-b="${esc(bkey)}">${cols.map(([id]) => { const n = st.filter(s => s.col === id).length;
    return `<button type="button" class="cb-tab" role="tab" data-cbtab="${id}" aria-selected="${id === tab}">${TAB_NM[id]}${id === "ready" || id === "changes" ? `<b class="cb-tn" aria-label="${n} card${n === 1 ? "" : "s"}">${n}</b>` : ""}</button>`; }).join("")}</div>`;
  return `${tabs}<div class="cb-board" data-b="${esc(bkey)}" data-tab="${tab}">${cols.map(([id, name, none], ci) => { const ss = st.filter(s => s.col === id);
    return `<section class="sm-col cb-col${id === tab ? " on" : ""}" data-col="${id}" aria-labelledby="cbh-${id}"><header class="sm-ch"><span class="sm-step" aria-hidden="true">${String(ci + 1).padStart(2, "0")}</span><h2 id="cbh-${id}">${name}</h2><b class="sm-cnt cb-cn" data-cnt="${id}" aria-label="${ss.length} card${ss.length === 1 ? "" : "s"}">${ss.length}</b></header>
      <div class="sm-list cb-list">${ss.length ? ss.map(s => stackHTML(s, chips)).join("") : `<p class="sm-empty">${esc(none)}</p>`}</div></section>`; }).join("")}</div>`;
}
const none = () => `<div class="card sp-card cb-none"><span class="cb-none-i">${ic("board")}</span><b>${EMPTY}</b><p>When we start work for a client, every batch shows up here and moves across as it is built and sent.</p></div>`;
function allHTML() { return !ITEMS || !ITEMS.length ? none() : boardHTML(ITEMS, true, "all"); }
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
  return `${tilesHTML(c, its)}${its.length ? boardHTML(its, false, "c:" + c.id) : none()}`;
}
/* side.js puts this between the Clients overview tiles and the list: the List | Board switch, then the all-clients board */
function bar(d) {
  D = d; if (!API) return "";
  return `<div class="cb-bar" id="cb-bar" data-cbm="${MODE}"><div class="cb-seg" role="group" aria-label="Clients view"><button type="button" class="cb-sg" data-cbm-set="list" aria-pressed="${MODE === "list"}">List</button><button type="button" class="cb-sg" data-cbm-set="board" aria-pressed="${MODE === "board"}">Board</button></div></div>
    <section class="cb-all" id="cb-all" aria-label="Delivery board, all clients">${allHTML()}</section>`;
}

/* ---------------- painting ---------------- */
const editing = el => !!el && [...el.querySelectorAll(".cb-emed,.cb-emch,.cb-nc")].some(x => !x.hidden);
function paintInto(el, html) {
  const a = document.activeElement, sh = a && a.classList && a.classList.contains("cb-sh") && el.contains(a) ? a.closest(".cb-stack").dataset.key : null;
  el.innerHTML = html; if (sh) el.querySelector(`[data-key="${CSS.escape(sh)}"] .cb-sh`)?.focus({ preventScroll: true });
}
function repaint() {
  if (!D) return;
  const all = document.getElementById("cb-all"), body = DRW && DRW.pan.querySelector(".cb-pb");
  if ((all && editing(all)) || (body && editing(body)) || (SHEET && editing(SHEET.el))) { DIRTY = true; return; }   // never wipe an email someone is typing
  DIRTY = false;
  if (SHEET) { const s = (ITEMS ? stacksOf(ITEMS) : []).find(x => x.key === SHEET.key); if (s) paintSheet(s); else closeSheet(true); }
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
  const L = SHEET ? SHEET.el : DRW ? DRW.pan : null;
  if (!L || otherLayer()) return;
  if (ev.key === "Escape") { ev.preventDefault(); ev.stopImmediatePropagation(); SHEET ? closeSheet() : closeClient(); return; }
  if (SHEET && (ev.key === "ArrowLeft" || ev.key === "ArrowRight") && !(ev.target.closest && ev.target.closest("textarea,input,select"))) { ev.preventDefault(); carGo(SHEET.idx + (ev.key === "ArrowRight" ? 1 : -1)); return; }   // the review: ← → change Short
  if (ev.key === "Tab") {
    const f = [...L.querySelectorAll('button:not([disabled]),a[href],input,textarea,[tabindex="0"]')].filter(x => x.offsetParent !== null && !x.closest("[hidden]")); if (!f.length) return;
    const a = document.activeElement, first = f[0], last = f[f.length - 1];
    if (!L.contains(a)) { ev.preventDefault(); first.focus(); } else if (ev.shiftKey && a === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && a === last) { ev.preventDefault(); first.focus(); }
  }
}, true);
new MutationObserver(() => { if (!document.getElementById("cb-bar")) { closeSheet(true); if (DRW) closeClient(true); } }).observe(document.getElementById("spage") || document.body, { childList: true });   // the page changed under the panel

/* ---------------- phone: tabs, the Ready sheet, Send with Undo ---------------- */
function setTab(tabs, id, dir) {
  const bkey = tabs.dataset.b, board = tabs.nextElementSibling; if (!board || !board.classList.contains("cb-board")) return;
  CUR[bkey] = PICK[bkey] = id; sess.set("beju-cb-tab", JSON.stringify(PICK));
  tabs.querySelectorAll("[data-cbtab]").forEach(b => b.setAttribute("aria-selected", b.dataset.cbtab === id));
  board.dataset.tab = id;
  board.querySelectorAll(":scope>.cb-col").forEach(c => { const on = c.dataset.col === id; c.classList.toggle("on", on); c.classList.remove("cb-in-l", "cb-in-r");
    if (on && dir && motion()) { void c.offsetWidth; c.classList.add(dir > 0 ? "cb-in-r" : "cb-in-l"); } });
}
const hdHTML = s => { const n = s.items.length, rd = s.items.filter(i => i.status === "ready").length, ok = okOf(s).length;
  return `<h2 id="cb-sht">${esc(s.name)}</h2><p class="mut">${esc([s.cname, `${n} Short${n === 1 ? "" : "s"}`, rd ? `${ok} of ${rd} approved` : "", dueTxt(s.due)].filter(Boolean).join(" · "))}</p>`; };
function sheetInner(s) {
  return `<header class="cb-shh"><i class="cb-grab" aria-hidden="true"></i><div class="cb-shhd">${hdHTML(s)}</div>
    <button type="button" class="icon-btn cb-shx" data-cbsheetx aria-label="Close"><svg aria-hidden="true"><use href="#i-x"/></svg></button></header>
    <div class="cb-shb">${carHTML(s)}${emailHTML(s)}</div>${barHTML(s)}`;
}
const sigOf = s => s.items.map(i => `${i.id}:${driveId(i.drive_link)}`).join(",");
/* a repaint never reloads the players (a video someone is watching keeps playing): the slides' text, the email and the bar are redrawn,
   the carousel itself only when the batch's Shorts or their files changed. The focused button keeps its focus. */
function paintSheet(s) {
  const el = SHEET.el, a = document.activeElement, fk = a && el.contains(a) ? ["cbok", "cbnc", "cbe", "cbpart", "cbnav"].find(k => a.dataset && a.dataset[k] != null) : null;
  const fsel = fk ? `[data-${fk}="${CSS.escape(a.dataset[fk])}"]` : "";
  el.querySelector(".cb-shhd").innerHTML = hdHTML(s);
  const sig = sigOf(s);
  if (sig !== SHEET.sig) { el.querySelector(".cb-car").outerHTML = carHTML(s); SHEET.sig = sig; fitFrames(el); carGo(SHEET.idx, true); }
  else s.items.forEach((i, k) => { const x = el.querySelector(`.cb-sl[data-id="${CSS.escape(String(i.id))}"] .cb-sli`); if (x) x.innerHTML = slideInfo(i, k, s.items.length); });
  const em = el.querySelector(".cb-em"); if (em) em.outerHTML = emailHTML(s);
  const old = el.querySelector(".cb-rvbar"), nb = barHTML(s); if (old) { if (nb) old.outerHTML = nb; else old.remove(); } else if (nb) el.insertAdjacentHTML("beforeend", nb);
  if (fsel) { const f = el.querySelector(fsel); if (f && !f.disabled) f.focus({ preventScroll: true }); }
}
/* the carousel: native scroll-snap (a swipe on the phone), the arrows / ← → move it; leaving a Short reloads its player so it stops playing */
/* Drive's /preview player has a minimum width: under ~320 px it shifts the video sideways (BENAS 11-24: "the player is off-centered").
   A frame narrower than 340 px gets the player drawn at 340 px and scaled down to fit, so the video always sits centered. */
const FIT = 340;
const fitRO = "ResizeObserver" in window ? new ResizeObserver(es => es.forEach(e => fitFrame(e.target))) : null;
function fitFrame(vf) {
  const w = vf.clientWidth, s = w && w < FIT ? w / FIT : 1;
  vf.classList.toggle("cb-fit", s < 1); vf.style.setProperty("--fs", s.toFixed(4));
}
function fitFrames(root) { root.querySelectorAll(".cb-vf").forEach(vf => { fitFrame(vf); if (fitRO) fitRO.observe(vf); }); }
function carGo(k, instant) {
  const tr = SHEET && SHEET.el.querySelector(".cb-track"); if (!tr) return;
  const n = tr.children.length; k = Math.max(0, Math.min(n - 1, k));
  carMark(k); SHEET.to = Math.abs(tr.scrollLeft - k * tr.clientWidth) < 2 ? null : k; clearTimeout(SHEET.toT); SHEET.toT = setTimeout(() => { if (SHEET) SHEET.to = null; }, 900);   // the scroll events of this move are not a swipe
  tr.scrollTo({ left: k * tr.clientWidth, behavior: instant || !motion() ? "auto" : "smooth" });
}
function carMark(k) {
  if (!SHEET) return; const el = SHEET.el, was = SHEET.idx; SHEET.idx = k;
  el.querySelectorAll(".cb-dots i").forEach((d, j) => d.classList.toggle("on", j === k));
  if (was !== k) { const f = el.querySelectorAll(".cb-sl")[was]?.querySelector("iframe"); if (f) f.src = f.getAttribute("src"); }
}
document.addEventListener("scroll", e => { const tr = e.target; if (!SHEET || !tr.classList || !tr.classList.contains("cb-track") || !SHEET.el.contains(tr)) return;
  const w = Math.max(1, tr.clientWidth), k = Math.round(tr.scrollLeft / w);
  if (SHEET.to != null) { if (Math.abs(tr.scrollLeft - SHEET.to * w) < 2) SHEET.to = null; return; }
  if (k !== SHEET.idx) carMark(k); }, true);
const vvSync = () => { if (SHEET && VV) SHEET.el.style.setProperty("--vvt", Math.max(0, Math.round(VV.offsetTop)) + "px"); };   // stays on the visible area when the keyboard opens
if (VV) { VV.addEventListener("resize", vvSync); VV.addEventListener("scroll", vvSync); }
function openSheet(key, opener) {
  const s = (ITEMS ? stacksOf(ITEMS) : []).find(x => x.key === key); if (!s) return;
  closeSheet(true);
  const scrim = document.createElement("div"); scrim.className = "cb-rvscrim"; scrim.addEventListener("click", () => closeSheet());
  const el = document.createElement("section"); el.className = "cb-sheet" + (UNDO ? " sending" : ""); el.id = "cb-sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "cb-sht");
  el.innerHTML = sheetInner(s); document.body.append(scrim, el); SHEET = { key, el, scrim, opener: opener || null, idx: 0, sig: sigOf(s) };
  HTML.classList.add("cb-sheet-on"); vvSync(); fitFrames(el);
  if (motion()) requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add("on"); scrim.classList.add("on"); })); else { el.classList.add("on"); scrim.classList.add("on"); }
  el.querySelector(".cb-shx").focus({ preventScroll: true });
}
function closeSheet(quick) {
  if (!SHEET) return; const { el, key, scrim } = SHEET; SHEET = null; HTML.classList.remove("cb-sheet-on");
  if (quick || !motion()) { el.remove(); scrim.remove(); } else { el.classList.remove("on"); scrim.classList.remove("on"); el.classList.add("out"); el.style.setProperty("--dy", "0px"); setTimeout(() => { el.remove(); scrim.remove(); }, 320); }
  if (!quick) document.querySelector(`.cb-stack[data-key="${CSS.escape(key)}"] .cb-sh`)?.focus({ preventScroll: true });
  if (DIRTY) repaint();
}
/* "Approve & send" on the phone: "Sent · Undo" for 5 s, then the same writes as the desktop (without its confirm: the Undo is the check) */
function undoStart(btn) {
  const id = btn.dataset.draft; if (!id || UNDO) return;
  const bar = document.createElement("div"); bar.className = "cb-undo"; bar.id = "cb-undo"; bar.setAttribute("role", "status");
  bar.innerHTML = `<span class="cb-undo-t">${ic("check")}Sent</span><button type="button" class="cb-undo-b" data-cbundo>Undo</button><i class="cb-undo-p" aria-hidden="true"></i>`;
  document.body.append(bar); if (SHEET) SHEET.el.classList.add("sending");
  UNDO = { id, bar, t: setTimeout(undoFire, 5000) };
  bar.querySelector(".cb-undo-b").focus({ preventScroll: true });
}
function undoEnd() { const u = UNDO; UNDO = null; if (!u) return null; clearTimeout(u.t); u.bar.remove(); if (SHEET) SHEET.el.classList.remove("sending"); return u; }
function undoFire() {
  const u = undoEnd(); if (!u) return;
  const btn = SHEET && SHEET.el.querySelector(`.cb-rvbar [data-cbe="send"][data-draft="${CSS.escape(String(u.id))}"]`);
  if (btn && !btn.disabled) emailOp("send", btn, true); else if (API) API.toast("Not sent: this email changed or left the board. Open it again.");
}
function undoCancel() { if (undoEnd() && API) API.toast("Not sent. Nothing went out."); SHEET?.el.querySelector('[data-cbe="send"]')?.focus({ preventScroll: true }); }
/* touch: a sideways swipe on a board switches its tab (only once the move is clearly sideways, so scrolling never does);
   a pull down on the sheet (its header, or its text when scrolled to the top) closes it */
let TS = null;
document.addEventListener("touchstart", e => {
  TS = null; if (!PHONE.matches || e.touches.length !== 1 || !e.target.closest || e.target.closest("textarea,input,select")) return;
  const t = e.touches[0], sh = SHEET && SHEET.el.contains(e.target) ? SHEET.el : null, board = sh ? null : e.target.closest(".cb-board");
  if (sh) { const b = sh.querySelector(".cb-shb"); if (!e.target.closest(".cb-shh") && b && b.scrollTop > 0) return; TS = { k: "sheet", el: sh, x: t.clientX, y: t.clientY, lock: 0, dy: 0 }; }
  else if (board) TS = { k: "tab", el: board, x: t.clientX, y: t.clientY, lock: 0 };
}, { passive: true });
document.addEventListener("touchmove", e => {
  if (!TS) return; if (e.touches.length !== 1) { TS = null; return; }
  const t = e.touches[0], dx = t.clientX - TS.x, dy = t.clientY - TS.y;
  if (!TS.lock && Math.hypot(dx, dy) > 10) TS.lock = TS.k === "tab" ? (Math.abs(dx) > Math.abs(dy) * 1.5 ? 1 : -1) : (dy > 0 && dy > Math.abs(dx) ? 1 : -1);
  if (TS.lock !== 1) return;
  if (e.cancelable) e.preventDefault();
  if (TS.k === "sheet" && SHEET && TS.el === SHEET.el) { TS.dy = Math.max(0, dy); TS.el.classList.add("drag"); TS.el.style.setProperty("--dy", TS.dy + "px"); }
}, { passive: false });
const touchEnd = e => {
  const s = TS; TS = null; if (!s || s.lock !== 1) return;
  if (s.k === "sheet") { s.el.classList.remove("drag"); if (s.dy > 110 && SHEET && s.el === SHEET.el) closeSheet(); else s.el.style.setProperty("--dy", "0px"); return; }
  const t = e.changedTouches && e.changedTouches[0]; if (!t) return;
  const dx = t.clientX - s.x, dy = t.clientY - s.y; if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  const tabs = s.el.previousElementSibling; if (!tabs || !tabs.classList.contains("cb-tabs")) return;
  const ids = [...tabs.querySelectorAll("[data-cbtab]")].map(b => b.dataset.cbtab), i = ids.indexOf(s.el.dataset.tab), nx = ids[i + (dx < 0 ? 1 : -1)];
  if (nx) setTab(tabs, nx, dx < 0 ? 1 : -1);
};
document.addEventListener("touchend", touchEnd); document.addEventListener("touchcancel", () => { if (TS && TS.k === "sheet") { TS.el.classList.remove("drag"); TS.el.style.setProperty("--dy", "0px"); } TS = null; });

/* ---------------- the delivery email: the same writes as the Samples board, category client_delivery ---------------- */
async function emailOp(op, btn, quick) {
  const C = X(), sheet = btn.closest(".cb-sheet"), pan = btn.closest(".cb-em") || (sheet && sheet.querySelector(".cb-em")), id = pan && pan.dataset.draft, d = id && drafts().find(x => String(x.id) === String(id)); if (!C || !pan || !d) return;
  const s = (ITEMS ? stacksOf(ITEMS) : []).find(x => x.key === pan.dataset.k), who = (s && s.cname) || "the client";
  const $p = q => pan.querySelector(q), err = $p(".cb-emerr"), say = m => { err.hidden = false; err.textContent = m; err.scrollIntoView({ block: "nearest" }); }; err.hidden = true;
  const show = w => { $p(".cb-emed").hidden = w !== "edit"; $p(".cb-emch").hidden = w !== "change"; $p(".cb-emb").hidden = w === "edit"; const eb = $p(".cb-edb"); if (eb) eb.hidden = !!w;
    const a = (sheet || pan).querySelector(".cb-emacts"); if (a) a.hidden = !!w; if (!w && DIRTY) repaint(); };
  if (op === "edit") { show("edit"); const t = $p(".cb-emta"); t.value = d.body; t.focus(); return; }
  if (op === "change") { show("change"); const t = $p(".cb-chta"); t.focus({ preventScroll: true }); t.scrollIntoView({ block: "center", behavior: motion() ? "smooth" : "auto" }); return; }
  if (op === "cancel") { show(""); return; }
  let body = null, done = "";
  if (op === "send") {
    if (s && chOf(s).length) return say("A Short is marked Needs changes: the batch waits for the fix.");
    /* read the email fresh first: if Claude changed it since this page painted, show the new text and ask to read it */
    if (C.drafts) { const before = d.body_sha256; await C.drafts().catch(() => {}); const d2 = drafts().find(x => String(x.id) === String(id));
      if (!d2 || d2.body_sha256 !== before || d2.status !== d.status) { repaint(); const sel = `.cb-em[data-draft="${CSS.escape(String(id))}"] .cb-emerr`, p2 = (SHEET && SHEET.el.querySelector(sel)) || document.querySelector(sel); if (p2) { p2.hidden = false; p2.textContent = "This email just changed. Read the new version, then press Send."; } return; } }
    const shown = $p(".cb-emb").textContent;
    if (shown !== String(d.body).replace(/\r\n?/g, "\n")) return say("The email on screen is not the saved one any more. Close this and open it again.");
    if (!quick) { const r = await C.ask({ title: `Send this to ${who}?`, warn: `It goes out within a minute from ${d.inbox} to ${[d.to_email, ...(d.cc_list || [])].join(", ")}, word for word.`, sees: shown, cta: "Send it" }); if (!r) return; }   // quick = the phone sheet: the 5-second Undo was the check
    body = { status: "approved", approved_sha256: await C.sha256hex(d.body) }; done = "Sending. It goes out within a minute.";
  } else if (op === "save") {
    const v = $p(".cb-emta").value; if (!v.trim()) return say("The email can't be empty.");
    body = { body: v, ...(d.status === "pending" ? {} : { status: "pending" }) }; done = "Saved. Read it once more, then send.";
  } else if (op === "back") {
    const v = $p(".cb-chta").value.trim(); if (!v) return say("Write what should change first.");
    body = { status: "held", founder_note: [v, s ? shortsNote(chOf(s)) : ""].filter(Boolean).join(" | ").slice(0, 1000) }; done = "Sent to Claude. The fixed version comes back here.";   // the Shorts already marked stay in the note
  }
  if (!body) return; btn.disabled = true;
  try { await C.upd("drafts", +d.id, body); C.toast(done, "check", "c-green", who); show("");
    if (op === "send" && s) await approveAll(s).catch(e => API.toast(`Sent. The per-Short approvals didn't save: ${String(e && e.message || e).slice(0, 100)}`));
    await (C.drafts ? C.drafts() : C.refresh()); repaint(); }
  catch (e) { say(String(e && e.message || e)); if (btn.isConnected) btn.disabled = false; }
}
/* ---------------- the review's per-Short writes (client_items, the founder's own login: policy "founders write client_items") ---------------- */
async function itemsUpd(ids, body) {
  let q = API.sb().from("client_items").update(body); q = ids.length === 1 ? q.eq("id", ids[0]) : q.in("id", ids);
  const { data, error } = await q.select("id"); if (error) throw error;
  if (!data || !data.length) throw new Error("not allowed. The 2-step login may have expired: sign in again");
  const set = new Set(ids.map(String)); (ITEMS || []).forEach(i => { if (set.has(String(i.id))) Object.assign(i, body); });
}
const okBody = async () => { const m = await API.me().catch(() => null); return { founder_ok_at: new Date().toISOString(), founder_ok_by: (m && m.name) || null }; };
/* "Approve & send": every Short not marked Needs changes (and not approved yet) gets the founder's OK, in ONE write */
async function approveAll(s) {
  const ids = s.items.filter(i => i.status === "ready" && !i.founder_ok_at).map(i => i.id);
  if (ids.length) await itemsUpd(ids, await okBody());
}
const stackOf = key => (ITEMS ? stacksOf(ITEMS) : []).find(x => x.key === key) || null;
const itemOf = id => (ITEMS || []).find(i => String(i.id) === String(id)) || null;
const tell = (t, sub) => { const C = X(); if (C) C.toast(t, "check", "c-green", sub || ""); else API.toast(t); };
const fail = e => API.toast(`Couldn't save: ${String(e && e.message || e).slice(0, 120)}`);
/* ✓ Approve (a second tap takes it back); after an approval the carousel moves on to the next Short still to review */
async function toggleOk(id, btn) {
  const i = itemOf(id); if (!i || !SHEET) return; const on = !i.founder_ok_at; btn.disabled = true;
  try { await itemsUpd([i.id], on ? await okBody() : { founder_ok_at: null, founder_ok_by: null }); repaint();
    if (on && SHEET) { const s = stackOf(SHEET.key), nx = s ? s.items.findIndex((x, k) => k > SHEET.idx && x.status === "ready" && !x.founder_ok_at) : -1; if (nx > 0) setTimeout(() => carGo(nx), 380); } }
  catch (e) { btn.disabled = false; fail(e); }
}
/* the draft goes back to Claude: the existing "What to change" write (held + founder_note) */
async function holdDraft(d, note) { const C = X(); await C.upd("drafts", +d.id, { status: "held", founder_note: String(note).slice(0, 1000) }); await (C.drafts ? C.drafts() : C.refresh()); }
const holdable = d => !!d && /^(pending|held|failed|stale)$/.test(d.status);
function ncOpen(sl, on) {
  const nc = sl.querySelector(".cb-nc"), acts = sl.querySelector(".cb-slacts"); if (!nc) return;
  nc.hidden = !on; if (acts) acts.hidden = on; sl.querySelector("[data-cbnc]")?.setAttribute("aria-expanded", on);
  const bar = SHEET && SHEET.el.querySelector(".cb-rvbar"); if (bar) bar.hidden = on;   // the note gets the room above the keyboard
  if (on) { const ta = nc.querySelector(".cb-ncta"); ta.focus({ preventScroll: true }); nc.scrollIntoView({ block: "nearest", behavior: motion() ? "smooth" : "auto" }); }
  else { sl.querySelector("[data-cbnc]")?.focus({ preventScroll: true }); if (DIRTY) repaint(); }
}
/* ✎ Needs changes: the Short goes to 'changes' with its note ("[m:ss] " first when a moment is given) and the whole batch waits:
   the draft is held with every marked Short's note, so Claude fixes them and brings the email back */
async function saveChanges(id, btn) {
  const sl = btn.closest(".cb-sl"), i = itemOf(id); if (!sl || !i || !SHEET) return;
  const v = sl.querySelector(".cb-ncta").value.trim(), at = sl.querySelector(".cb-ncts").value.trim(), er = sl.querySelector(".cb-ncerr");
  const say = m => { er.hidden = false; er.textContent = m; }; er.hidden = true;
  if (!v) return say("Write what should change first.");
  if (at && !tsOk(at)) return say("Write the moment as m:ss, e.g. 0:12.");
  const note = `${at ? `[${at}] ` : ""}${v}`.slice(0, 1000); btn.disabled = true;
  try {
    await itemsUpd([i.id], { status: "changes", changes_note: note, ...(i.founder_ok_at ? { founder_ok_at: null, founder_ok_by: null } : {}) });
    const s = stackOf(SHEET.key), d = s && draftOf(s);
    if (holdable(d)) await holdDraft(d, shortsNote(chOf(s)));
    tell(`Sent to Claude: ${i.title}`, d ? "The batch waits for the fix. Nothing goes out." : "");
    ncOpen(sl, false); repaint();
  } catch (e) { btn.disabled = false; say(String(e && e.message || e)); }
}
/* "Send the N approved now": sends nothing itself; the held draft tells Claude to rewrite the email for the approved Shorts only */
async function sendPart(btn) {
  const s = SHEET && stackOf(SHEET.key), d = s && draftOf(s); if (!s || !holdable(d)) return;
  const ok = okOf(s), ch = chOf(s); if (!ok.length || !ch.length) return; btn.disabled = true;
  try { await holdDraft(d, `SEND APPROVED NOW: ${ok.map(i => i.title).join(", ")}; HOLD: ${ch.map(i => i.title).join(", ")}`);
    tell(`Sent to Claude: an email for the ${ok.length} approved`, "It comes back here to send."); repaint(); }
  catch (e) { btn.disabled = false; fail(e); }
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
  const tb = t.closest("[data-cbtab]"); if (tb) { const tabs = tb.closest(".cb-tabs"), ids = [...tabs.querySelectorAll("[data-cbtab]")].map(b => b.dataset.cbtab), from = ids.indexOf(tabs.nextElementSibling?.dataset.tab); setTab(tabs, tb.dataset.cbtab, Math.sign(ids.indexOf(tb.dataset.cbtab) - from)); return; }
  if (t.closest("[data-cbundo]")) { undoCancel(); return; }
  if (t.closest("[data-cbsheetx]")) { closeSheet(); return; }
  const sh = t.closest(".cb-sh"); if (sh && sh.closest(".cb-stack").classList.contains("rv")) { openSheet(sh.closest(".cb-stack").dataset.key, sh); return; }   // a Ready stack opens the review (phone: full-screen sheet; desktop: panel)
  const nv = t.closest("[data-cbnav]"); if (nv && SHEET) { carGo(SHEET.idx + +nv.dataset.cbnav); return; }
  const okb = t.closest("[data-cbok]"); if (okb) { toggleOk(okb.dataset.cbok, okb); return; }
  const ncb = t.closest("[data-cbnc]"); if (ncb) { ncOpen(ncb.closest(".cb-sl"), true); return; }
  if (t.closest("[data-cbncx]")) { ncOpen(t.closest(".cb-sl"), false); return; }
  const ncs = t.closest("[data-cbncs]"); if (ncs) { saveChanges(ncs.dataset.cbncs, ncs); return; }
  const pt = t.closest("[data-cbpart]"); if (pt) { sendPart(pt); return; }
  if (sh) { const st = sh.closest(".cb-stack"), on = sh.getAttribute("aria-expanded") !== "true"; sh.setAttribute("aria-expanded", on); st.classList.toggle("open", on); st.querySelector(".cb-items").hidden = !on; on ? OPEN.add(st.dataset.key) : OPEN.delete(st.dataset.key); return; }
  const qb = t.closest("[data-cbq]"); if (qb) { const li = qb.closest(".cb-it"), on = !li.classList.contains("q-open"); li.classList.toggle("q-open", on); qb.setAttribute("aria-expanded", on); return; }
  const eb = t.closest("[data-cbe]"); if (eb) { if (eb.dataset.cbe === "send" && PHONE.matches && eb.closest(".cb-sheet")) undoStart(eb); else emailOp(eb.dataset.cbe, eb); return; }
  const hb = t.closest("[data-cbhold]"); if (hb) { setHold(hb.dataset.cbhold, hb); return; }
  if (t.closest("[data-cbclose]")) { closeClient(); return; }
  /* a client row opens that client's board (the page's own handler still selects the row; a touch tap on the activity dot only shows its note) */
  const row = t.closest("#cl-list [data-cl]"); if (row && API && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !(t.closest(".cl-ad") && (innerWidth <= 900 || matchMedia("(hover: none)").matches))) openClient(row.dataset.cl, row);
});

(window.BEJU_CLIENT_BOARD = window.BEJU_CLIENT_BOARD || {}).load = load;
window.BEJU_CLIENT_BOARD.bar = bar;
})();
