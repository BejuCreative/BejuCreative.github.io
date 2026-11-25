/* BEJÚ founder CRM: Approvals page (?p=approvals[&id=]). BENAS 11-25: "both Claudes send the approvals to one tab, and they send
   notifications for everything they need an approval or an OK to commit or to do ... so one of us can approve something that the other
   Claude has pinged." ONE queue for both founders and both Claudes (benas-claude / simas-claude).
   QUEUE: decision approvals (public.approvals, status pending / held) + the reply drafts that wait for a founder (public.drafts_waiting,
   the lanes big deal / client problem / new terms / big name / other; sample + client delivery drafts stay on their boards). An email
   approval written with draft_id shows ONCE, as its draft, with the approval's why / recommendation / urgency. Order: not-held first,
   money -> client -> routine, then oldest first. Each card: headline, who asked (Benas's / Simas's Claude), urgency, lead / client, why,
   recommendation, the full text (folded), and the buttons.
   BUTTONS: decision = Approve | Approve + note | No + note | Hold; email draft = the draft flow that already exists (Approve and send with
   the exact-text check, Edit, No + note, Hold: drafts_guard enforces it). A decision goes through public.approval_decide(); the row keeps who
   decided and when. needs_both stays pending until BOTH founders approved ("1 of 2"). "Approve all routine" = every routine decision
   waiting for me. The asking Claude reads the answer with crm-api approval_get / approvals and marks it done.
   PHONE (<= 600 px): the list is compact rows; a tap opens ONE card as a full-screen sheet with the buttons fixed at the bottom (like the
   client board's Ready sheet). A notification opens ?p=approvals&id=<n> (a decision) or &id=d<n> (a draft): that card opens / is marked.
   LIVE: its own realtime channels (approvals, drafts) + a 30 s poll while the page is open; the menu badge and the Dashboard card come from
   crm.js's own approvals channel (window.BEJU_APPROVALS.queue). A database without the table yet shows a calm "not switched on yet".
   Registered with side.js through window.BEJU_SIDE_PAGES, so this file loads before side.js. CSP: no inline styles (CSSOM only). */
(() => {
"use strict";
const TZ = (window.BEJU_CRM || {}).timezone || "Europe/Vilnius";
const HTML = document.documentElement, RMQ = matchMedia("(prefers-reduced-motion: reduce)");
const motion = () => !RMQ.matches && HTML.dataset.motion !== "calm";
const esc = s => String(s ?? "").replace(/[&<>"'`]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" }[c]));
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const lc = s => String(s || "").toLowerCase().trim();
const ms = t => { const v = t ? +new Date(t) : 0; return isFinite(v) ? v : 0; };
const X = () => window.BEJU_CRM_SAMPLES;
const PHONE = matchMedia("(max-width: 600px)"), VV = window.visualViewport;
const webUrl = v => { try { const u = new URL(String(v || "").trim()); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
const missing = e => !!e && (/42P01|PGRST20[45]|does not exist|schema cache|Could not find the (table|function)/i.test(`${e.code || ""} ${e.message || ""}`));
const ago = t => { const m = Math.max(0, Math.round((Date.now() - ms(t)) / 6e4)); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const stampF = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const stamp = t => t ? stampF.format(new Date(t)) : "";

/* ---------------- the one queue (shared with crm.js: the Dashboard card, and the menu badge) ---------------- */
const URG = { money: ["Money", "r", 0], client: ["Client", "o", 1], routine: ["Routine", "", 2] };
const DR_URG = { big_deal: "money", new_terms: "money", client_problem: "client", big_name: "client", other: "routine" };
const DR_CAT = { big_deal: "Big deal", client_problem: "Client problem", new_terms: "New terms", big_name: "Big name", other: "Other" };   // the founder lanes; sample / client delivery stay on their boards
const DR_ST = new Set(["pending", "held", "stale", "failed", "unknown"]);
const DRAFT_OPS = { pending: ["approve", "edit", "hold", "no"], held: ["approve", "edit", "no"], failed: ["approve", "hold", "no"], stale: ["approve", "hold", "no"], unknown: ["no"] };
const who = by => { const b = lc(by); return /simas/.test(b) ? "Simas's Claude" : /benas/.test(b) ? "Benas's Claude" : by ? String(by) : "Claude"; };
const nameOf = (raw, email) => { const e = lc(email); if (!e) return ""; const p = raw && (raw.pipeline || []).find(r => lc(r.email) === e); return (p && p.name) || e.split("@")[0]; };
function queue(raw) {
  const ap = (raw && raw.approvals) || [], all = raw && raw.drafts, dr = (all || []).filter(d => DR_ST.has(d.status) && DR_CAT[d.category]), out = [], used = new Set();
  ap.filter(a => a.status === "pending" || a.status === "held").forEach(a => {
    const d = a.draft_id != null ? dr.find(x => String(x.id) === String(a.draft_id)) : null;
    if (a.draft_id != null && !d && all) return;   // its draft was approved, sent or closed: the approval follows it within seconds (trigger), it is not a question any more
    if (d) used.add(String(d.id));
    out.push({ key: "a:" + a.id, link: String(a.id), type: d ? "draft" : "decision", kind: a.kind, approvalId: a.id, draftId: d ? d.id : null, draft: d || null,
      title: a.title, why: a.why || (d && d.reason) || "", rec: a.recommendation || "", body: d ? d.body : (a.body || ""), lead: a.lead_email || (d && d.lead_email) || "",
      client: a.client_name || "", inbox: a.inbox || (d && d.inbox) || "", requester: who(a.requested_by), urgency: a.urgency || "routine", needsBoth: !!a.needs_both,
      decidedBy: a.decided_by || [], decidedUids: a.decided_uids || [], status: d ? (d.status === "held" ? "held" : "pending") : a.status, at: a.created_at, links: Array.isArray(a.links) ? a.links : [], note: a.note || "", outdated: a.outdated_at ? (a.outdated_reason || "Things moved since this was asked. Read the thread first.") : "",
      ops: d ? DRAFT_OPS[d.status] || [] : null, row: a });
  });
  dr.filter(d => !used.has(String(d.id)) && !ap.some(a => a.draft_id != null && String(a.draft_id) === String(d.id))).forEach(d => {
    out.push({ key: "d:" + d.id, link: "d" + d.id, type: "draft", kind: "email", approvalId: null, draftId: d.id, draft: d, title: `Reply to ${nameOf(raw, d.lead_email)}: ${DR_CAT[d.category]}`,
      why: d.reason || "", rec: "", body: d.body || "", lead: d.lead_email, client: "", inbox: d.inbox || "", requester: who(d.created_by), urgency: DR_URG[d.category] || "routine", needsBoth: false,
      decidedBy: [], decidedUids: [], status: d.status === "held" ? "held" : "pending", at: d.created_at, links: [], note: d.founder_note || "", outdated: "", ops: DRAFT_OPS[d.status] || [], row: null });
  });
  out.sort((a, b) => (a.status === "held") - (b.status === "held") || URG[a.urgency][2] - URG[b.urgency][2] || ms(a.at) - ms(b.at));
  const live = out.filter(x => x.status !== "held");
  return { items: out, count: live.length, money: live.filter(x => x.urgency === "money").length };
}

/* ---------------- state ---------------- */
let A = null;                        // side.js's helpers (sb, all, toast, me, el)
let D = null;                        // { open, recent, drafts, missing, at }
let ME_ID = "", ME_NAME = "";
let EDIT = null, SHEET = null, BUSY = false, LATER = false, HANDLED = "", HL = "";
const CH = {}; let POLL = null, CHT = null, SEQ = 0;

async function readAll() {
  const since = new Date(Date.now() - 3 * 864e5).toISOString();
  const [open, recent, drafts] = await Promise.all([
    A.all("approvals", "*", q => q.in("status", ["pending", "held"])).then(r => r, e => missing(e) ? null : Promise.reject(e)),
    A.all("approvals", "*", q => q.in("status", ["approved", "rejected", "done"]).gte("updated_at", since)).then(r => r, () => []),
    A.all("drafts_waiting", "*").catch(() => null)]);
  return { open, recent: (recent || []).sort((a, b) => ms(b.decided_at || b.updated_at) - ms(a.decided_at || a.updated_at)), drafts, missing: open === null, at: Date.now() };
}
async function load(api) {
  A = api; const m = await api.me().catch(() => null); ME_ID = m ? m.id : ""; ME_NAME = m ? m.name : "";
  D = await readAll(); sync(); return D;
}
const raw = () => ({ approvals: D ? D.open : null, drafts: D ? D.drafts : null, pipeline: (X() && X().raw && X().raw.pipeline) || [] });
const Q = () => queue(raw());
const find = key => Q().items.find(x => x.key === key) || null;
/* keep crm.js's copy (the menu badge, the Dashboard card) in step with what this page just read or wrote */
function sync() { const r = X() && X().raw; if (r && D) { if (D.open) r.approvals = D.open; if (D.drafts) r.drafts = D.drafts; } badge(); }

/* ---------------- the menu badge (any page) ---------------- */
function badge() {
  const b = document.getElementById("sn-approvals-n"), a = document.querySelector('#snav a[data-nav="approvals"]'); if (!b) return;
  const r = X() && X().raw, q = queue(D && document.getElementById("ap") ? raw() : r || {}), n = q.count;
  b.hidden = !n; b.textContent = n || ""; b.classList.add("ap-bad");
  // 11-25 (BENAS): "can the tab disappear if it's empty" -> the menu item hides while nothing waits (not while you are on the page), and comes back with its count
  const li = a && a.closest("li"), known = !!((D && D.open) || (r && r.approvals)); if (li) li.hidden = known && !q.items.length && !document.getElementById("ap");
  const tip = n ? `Approvals · ${n} waiting${q.money ? ` (${q.money} money)` : ""}` : "Approvals"; if (a) { a.dataset.tip = tip; a.title = tip; }
}
addEventListener("beju-crm:data", badge);
addEventListener("popstate", () => setTimeout(badge, 0));   // leaving the Approvals page with nothing waiting hides the menu item at once
document.addEventListener("click", ev => { if (ev.target.closest && ev.target.closest('#snav a, [data-act="page"]')) setTimeout(badge, 300); });

/* ---------------- the page ---------------- */
const chip = (t, c = "") => `<span class="ap-chip${c ? " " + c : ""}">${esc(t)}</span>`;
const mine = it => !!(ME_ID && it.decidedUids.includes(ME_ID));
function stateLine(it) {
  if (it.outdated) return "Outdated: " + it.outdated;   // 11-25 (BENAS): approvals_reconcile() flags an item when the lead wrote again or was emailed after it was asked
  if (it.type === "draft" && it.draft) { const d = it.draft;
    return ({ held: "On hold. Approve it, change it or reject it.", failed: `Not sent${d.error ? `: ${d.error}` : ""}. Approve to try again.`, stale: "Not sent: the lead wrote again after this was drafted. Read the thread, then approve, change or reject.", unknown: "This may have gone out. Check the thread in Instantly first; it can't be approved again." })[d.status] || ""; }
  if (it.needsBoth) return it.decidedBy.length ? `1 of 2 · ${it.decidedBy.join(", ")} approved${mine(it) ? ". Waiting for the other founder." : ". Your OK is the second one."}` : "Needs BOTH founders: 0 of 2 so far.";
  if (it.status === "held") return "On hold" + (it.note ? `: ${it.note}` : ".");
  return "";
}
function buttons(it) {
  const k = esc(it.key), b = (op, label, cls = "", extra = "") => `<button type="button" class="act ${cls}" data-ap-act="${op}" data-key="${k}"${extra}>${label}</button>`;
  if (EDIT === it.key) return b("save", "Save the new text", "go") + b("cancel", "Cancel");
  if (it.type === "draft") { const o = it.ops || [];
    return (o.includes("approve") ? b("approve", "Approve &amp; send", "go") : "") + (o.includes("edit") ? b("edit", `${ic("edit")}Edit`) : "") + (o.includes("hold") ? b("hold", "Hold") : "") + (o.includes("no") ? b("no", it.draft && it.draft.status === "unknown" ? "Close it" : "No + note", "no") : ""); }
  const done = mine(it);
  return b("approve", done ? "You approved" : it.needsBoth && it.decidedBy.length ? "Approve (2 of 2)" : "Approve", "go", done ? " disabled" : "") + (done ? "" : b("note", "Approve + note"))
    + (it.status === "held" ? "" : b("hold", "Hold")) + b("no", "No + note", "no");
}
function cardHTML(it, sheet) {
  const U = URG[it.urgency], k = esc(it.key), d = it.draft, links = it.links.map(l => { const u = webUrl(l.url); return u ? `<a class="act" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${ic("link")}${esc(l.label || "Open")}</a>` : ""; }).join("");
  const body = EDIT === it.key && d ? `<textarea class="ap-ta" maxlength="8000" aria-label="The reply text" data-key="${k}">${esc(d.body)}</textarea>`
    : it.body ? `<details class="ap-body"${sheet ? " open" : ""}><summary>${it.kind === "email" ? "The email, word for word" : "Full detail"}</summary><div class="ap-text">${esc(it.body)}</div></details>` : "";
  const to = d ? `<p class="ap-meta"><b>To</b> ${esc(d.to_email)}${(d.cc_list || []).length ? ` · cc ${esc(d.cc_list.join(", "))}` : ""} · from ${esc(d.inbox)}</p>` : "";
  const who2 = [it.client, it.lead && !d ? it.lead : (d ? nameOf(raw(), d.lead_email) : ""), it.inbox && !d ? it.inbox : ""].filter(Boolean);
  const st = stateLine(it);
  return `<article class="tile ap-card u-${it.urgency}${it.status === "held" ? " held" : ""}${it.key === HL ? " ap-hl" : ""}"${sheet ? "" : ` id="ap-${esc(it.link)}"`} data-key="${k}" data-ap-card>
    <header class="ap-hd">${it.outdated ? chip("Outdated", "o") : ""}<span class="ap-chip u-${it.urgency}">${esc(U[0])}</span>${chip(it.requester, "who")}${chip(it.kind === "email" ? "Email" : "Decision")}${it.status === "held" ? chip("Held", "o") : ""}${it.needsBoth ? chip(`Both founders · ${it.decidedBy.length} of 2`, "b") : ""}<time class="ap-age" datetime="${esc(it.at)}">${esc(ago(it.at))}</time></header>
    <h3 class="ap-h">${esc(it.title)}</h3>
    ${who2.length ? `<p class="ap-meta">${who2.map(esc).join(" · ")}</p>` : ""}
    ${it.why ? `<p class="ap-why"><b>Why</b>${esc(it.why)}</p>` : ""}${it.rec ? `<p class="ap-rec"><b>Claude recommends</b>${esc(it.rec)}</p>` : ""}
    ${d && d.lead_last_snippet ? `<p class="ap-why"><b>They wrote</b>${esc(d.lead_last_snippet)}</p>` : ""}${to}${body}
    ${d && (d.warnings || []).length ? `<div class="ap-wr">${d.warnings.map(w => `<span class="ap-chip o">${esc(w)}</span>`).join("")}</div>` : ""}
    ${links ? `<div class="ap-links">${links}</div>` : ""}${st ? `<p class="ap-state" role="status">${esc(st)}</p>` : ""}
    ${sheet ? "" : `<p class="ap-err" role="alert" hidden></p><div class="ap-acts">${buttons(it)}</div>`}</article>`;
}
function doneHTML() {
  const R = (D && D.recent) || []; if (!R.length) return "";
  return `<details class="ap-dn" id="ap-dn"><summary>Recently decided <span class="ap-n">${R.length}</span></summary><div class="ap-dl">${R.map(a => {
    const cl = a.status === "rejected" ? "r" : "g", lab = a.status === "rejected" ? "No" : a.status === "done" ? "Done" : "Approved", names = (a.decided_by || []).join(" + ");
    return `<div class="tile ap-dr" id="ap-${esc(a.id)}"><span class="ap-chip ${cl}">${lab}</span><span class="ap-dt"><b>${esc(a.title)}</b><small>${esc(who(a.requested_by))} asked${names ? ` · ${esc(names)}` : ""}${a.decided_at ? ` · ${esc(stamp(a.decided_at))}` : ""}${a.status === "done" ? " · acted on" : ""}</small>${a.note ? `<small class="ap-nt">${esc(a.note)}</small>` : ""}</span></div>`; }).join("")}</div></details>`;
}
function routineMine() { return Q().items.filter(x => x.type === "decision" && x.urgency === "routine" && x.status === "pending" && !mine(x)); }
function listHTML() {
  const q = Q();
  if (D.missing && !q.items.length) return `<p class="ap-empty">Approvals are not switched on yet.<br><small>The database side is not live yet. Reply drafts that wait for a founder will still show here.</small></p>` + doneHTML();
  const r = routineMine(), sub = q.count ? `${q.count} waiting${q.money ? ` · ${q.money} about money` : ""}` : "";
  if (!q.items.length) return `<p class="ap-empty">Nothing waits for a founder.<br><small>When Benas's or Simas's Claude needs an OK, it shows up here and on both phones.</small></p>` + doneHTML();
  return `<div class="ap-top"><b class="ap-sum">${esc(sub || "Only held items are left")}</b>${r.length >= 2 ? `<button type="button" class="act" data-ap-act="batch">${ic("check")}Approve all routine (${r.length})</button>` : ""}</div>
    <div class="ap-list" id="ap-list">${q.items.map(it => cardHTML(it, false)).join("")}</div>${doneHTML()}`;
}
const view = () => `<section class="ap" id="ap" aria-label="Approvals"><div id="ap-root">${D ? listHTML() : ""}</div></section>`;
function paint() {
  const root = document.getElementById("ap-root"); if (!root || !D) return;
  if (BUSY || EDIT || (root.contains(document.activeElement) && /^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName)) || document.querySelector("#dlg:not([hidden])")) { LATER = true; return; }
  LATER = false; root.toggleAttribute("data-keep", !!EDIT);   // data-keep: side.js's 5-minute refresh never wipes an open editor
  const dn = document.getElementById("ap-dn"), was = dn && dn.open; root.innerHTML = listHTML(); const dn2 = document.getElementById("ap-dn"); if (dn2 && was) dn2.open = true;
  if (SHEET) { const it = find(SHEET.key); if (it) paintSheet(it); else closeSheet(true); }
  badge();
}
/* a repaint that must happen even while a field is open (the typing is the reason it was deferred, so it is kept) */
function force() { const e = EDIT; LATER = false; const root = document.getElementById("ap-root"); if (!root || !D) return; root.toggleAttribute("data-keep", !!EDIT); const dn = document.getElementById("ap-dn"), was = dn && dn.open; root.innerHTML = listHTML(); const dn2 = document.getElementById("ap-dn"); if (dn2 && was) dn2.open = true; if (SHEET) { const it = find(SHEET.key); if (it) paintSheet(it); else closeSheet(true); } badge(); return e; }

/* ---------------- the phone sheet: one card, the buttons fixed at the bottom ---------------- */
function sheetInner(it) {
  return `<div class="ap-shh"><span class="ap-grab" aria-hidden="true"></span><h2 id="ap-sht">Needs your OK</h2><button type="button" class="icon-btn ap-shx" data-ap-act="close" aria-label="Close">${ic("x")}</button></div>
    <div class="ap-shb">${cardHTML(it, true)}</div>
    <div class="ap-bar"><p class="ap-err" role="alert" hidden></p><div class="ap-acts">${buttons(it)}</div></div>`;
}
function openSheet(key, opener) {
  const it = find(key); if (!it) return; closeSheet(true);
  const scrim = document.createElement("div"); scrim.className = "ap-scrim"; scrim.addEventListener("click", () => closeSheet());
  const el = document.createElement("section"); el.className = "ap-sheet"; el.id = "ap-sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "ap-sht");
  el.innerHTML = sheetInner(it); document.body.append(scrim, el); SHEET = { key, el, scrim, opener: opener || null }; HTML.classList.add("ap-sheet-on"); vvSync();
  if (motion()) requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add("on"); scrim.classList.add("on"); })); else { el.classList.add("on"); scrim.classList.add("on"); }
  el.querySelector(".ap-shx").focus({ preventScroll: true });
}
function paintSheet(it) { if (!SHEET) return; const a = document.activeElement, ed = a && SHEET.el.contains(a) && a.tagName === "TEXTAREA" ? a.value : null; SHEET.el.innerHTML = sheetInner(it); const ta = SHEET.el.querySelector(".ap-ta"); if (ta && ed != null) { ta.value = ed; ta.focus(); } }
function closeSheet(quick) {
  if (!SHEET) return; const { el, scrim, opener } = SHEET; SHEET = null; HTML.classList.remove("ap-sheet-on");
  if (quick || !motion()) { el.remove(); scrim.remove(); } else { el.classList.remove("on"); scrim.classList.remove("on"); el.classList.add("out"); setTimeout(() => { el.remove(); scrim.remove(); }, 320); }
  if (!quick && opener && opener.isConnected) opener.focus({ preventScroll: true });
}
const vvSync = () => { if (SHEET && VV) SHEET.el.style.setProperty("--vvt", Math.max(0, Math.round(VV.offsetTop)) + "px"); };
if (VV) { VV.addEventListener("resize", vvSync); VV.addEventListener("scroll", vvSync); }

/* ---------------- decisions ---------------- */
const errBox = key => { const sc = SHEET && SHEET.key === key ? SHEET.el : document.getElementById("ap-list"); return sc && (sc.querySelector(".ap-bar .ap-err") || sc.querySelector(`[data-key="${CSS.escape(key)}"] .ap-err`) || sc.querySelector(".ap-err")); };
function say(key, m) { const e = errBox(key); if (e) { e.hidden = !m; e.textContent = m || ""; } }
const scope = key => SHEET && SHEET.key === key ? SHEET.el : document;   // the open sheet's copy of a card wins over the list's
async function after(msg, sub) {
  A.toast(sub ? `${msg} · ${sub}` : msg);
  try { D = await readAll(); sync(); } catch {}
  if (X() && X().approvals) X().approvals().catch(() => {}); if (X() && X().drafts) X().drafts().catch(() => {});
}
async function decide(it, action, note) {
  const { data, error } = await A.sb().rpc("approval_decide", { p_id: it.approvalId, p_action: action, p_note: note || null, p_edited_body: null });
  if (error) throw error;
  if (D && D.open) { const row = data && data.id ? data : null; if (row) { D.open = D.open.filter(a => a.id !== row.id); if (row.status === "pending" || row.status === "held") D.open.push(row); else D.recent = [row, ...(D.recent || [])]; } }
  return data;
}
function ask(o) { return X().ask(o); }
async function act(op, key, btn) {
  const it = find(key); if (!it) return; say(key, "");
  const x = X(); if (!x) return;
  if (op === "edit") { EDIT = key; force(); const ta = scope(key).querySelector(`.ap-ta[data-key="${CSS.escape(key)}"]`); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } return; }
  if (op === "cancel") { EDIT = null; force(); return; }
  let done = "", run = null;
  const sub = it.client || (it.lead ? nameOf(raw(), it.lead) : "");
  if (it.type === "decision") {
    if (op === "approve") { run = () => decide(it, "approve"); done = it.needsBoth && !it.decidedBy.length ? "Approved. It still needs the other founder." : "Approved"; }
    else if (op === "note") { const r = await ask({ title: "Approve with a note", sees: "Nothing goes out. Claude reads your note with the approval.", fields: [{ k: "note", label: "Note for Claude", type: "area", max: 1000, req: true }], cta: "Approve" }); if (!r) return; run = () => decide(it, "approve", r.note); done = "Approved with your note"; }
    else if (op === "no") { const r = await ask({ title: "Say no", sees: "Nothing goes out. Claude reads your reason and stops.", fields: [{ k: "note", label: "Why not (Claude reads this)", type: "area", max: 1000, req: true }], cta: "No", danger: true }); if (!r) return; run = () => decide(it, "reject", r.note); done = "Declined. Claude will read your note."; }
    else if (op === "hold") { const r = await ask({ title: "Hold this", sees: "Nothing happens. It stays in the list, marked Held, until a founder decides.", fields: [{ k: "note", label: "Note for Claude (optional)", type: "area", max: 1000 }], cta: "Hold" }); if (!r) return; run = () => decide(it, "hold", r.note); done = "On hold"; }
  } else {
    const d = it.draft; if (!d) return;
    if (op === "approve") {
      const shown = scope(key).querySelector(`[data-key="${CSS.escape(key)}"] .ap-text`);   // the text on screen must be the saved draft (what the Samples / draft sheet checks too)
      if (shown && shown.textContent !== d.body.replace(/\r\n?/g, "\n")) return say(key, "The text on screen is not the saved draft any more. Close this and open it again.");
      const r = await ask({ title: `Send this reply to ${nameOf(raw(), d.lead_email)}?`, warn: `It goes out within a minute from ${d.inbox} to ${[d.to_email, ...(d.cc_list || [])].join(", ")}, word for word.`, sees: d.body, cta: "Approve and send" }); if (!r) return;
      run = async () => { await x.upd("drafts", +d.id, { status: "approved", approved_sha256: await x.sha256hex(d.body) }); }; done = "Approved. It goes out within a minute.";
    } else if (op === "save") {
      const ta = scope(key).querySelector(`.ap-ta[data-key="${CSS.escape(key)}"]`), v = ta ? ta.value : ""; if (!v.trim()) return say(key, "The reply can't be empty.");
      run = async () => { await x.upd("drafts", +d.id, { body: v, ...(d.status === "pending" ? {} : { status: "pending" }) }); EDIT = null; }; done = "Saved. Read it once more, then approve.";
    } else if (op === "no" || op === "hold") {
      const rj = op === "no", r = await ask({ title: rj ? (d.status === "unknown" ? "Close this draft" : "Reject this draft") : "Hold this draft", sees: rj ? "Nothing. The draft is closed and never sent." : "Nothing. The draft waits until a founder approves or rejects it.", fields: [{ k: "note", label: rj ? "Why not (Claude reads this)" : "Note for Claude (optional)", type: "area", max: 1000, req: rj }], cta: rj ? (d.status === "unknown" ? "Close it" : "Reject") : "Hold", danger: rj }); if (!r) return;
      run = () => x.upd("drafts", +d.id, { status: rj ? "rejected" : "held", ...(r.note ? { founder_note: r.note } : {}) }); done = rj ? "Draft closed. Nothing was sent." : "On hold. Nothing goes out.";
    }
  }
  if (!run) return;
  BUSY = true; if (btn) btn.disabled = true;
  try { await run(); BUSY = false; const sheetOpen = SHEET && SHEET.key === key; await after(done, sub); if (sheetOpen && op !== "save") closeSheet(); force(); }
  catch (e) { BUSY = false; const m = String((e && e.message) || e); if (btn && btn.isConnected) btn.disabled = false; say(key, m.slice(0, 220)); A.toast("Not saved: " + m.slice(0, 140)); if (LATER) paint(); }
}
async function batch() {
  const list = routineMine(); if (list.length < 2) return;
  const r = await ask({ title: `Approve ${list.length} routine items?`, sees: list.map(x => "• " + x.title).join("\n").slice(0, 1500), fields: [], cta: `Approve ${list.length}` }); if (!r) return;
  BUSY = true; let n = 0, fail = "";
  for (const it of list) { try { await decide(it, "approve"); n++; } catch (e) { fail = String((e && e.message) || e).slice(0, 140); break; } }
  BUSY = false; await after(`Approved ${n} of ${list.length}`, fail ? "stopped: " + fail : ""); force();
}

/* ---------------- clicks, keys ---------------- */
document.addEventListener("click", ev => {
  const t = ev.target; if (!t.closest || !A) return;
  const root = document.getElementById("ap"), sh = SHEET && SHEET.el;
  const b = t.closest("[data-ap-act]");
  if (b && ((root && root.contains(b)) || (sh && sh.contains(b)))) {
    if (b.disabled) return; const op = b.dataset.apAct;
    if (op === "close") return closeSheet();
    if (op === "batch") return void batch();
    return void act(op, b.dataset.key, b);
  }
  if (root && root.contains(t) && PHONE.matches && !t.closest("a,button,textarea,summary,details")) { const c = t.closest("[data-ap-card]"); if (c) openSheet(c.dataset.key, c); }
});
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && SHEET && !document.querySelector("#dlg:not([hidden])")) { ev.preventDefault(); ev.stopImmediatePropagation(); closeSheet(); } }, true);

/* ---------------- live: its own channels, a 30 s poll while the page is open ---------------- */
async function reread() {
  if (!A || !document.getElementById("ap")) return; const my = ++SEQ;
  try { const d = await readAll(); if (my !== SEQ) return; const sig = x => JSON.stringify([(x.open || []).map(a => [a.id, a.status, (a.decided_by || []).length, a.updated_at]), (x.drafts || []).map(a => [a.id, a.status, a.body_sha256]), (x.recent || []).map(a => [a.id, a.status])]);
    if (!D || sig(d) !== sig(D)) { D = d; sync(); paint(); } else { D.at = d.at; } } catch {}
}
function subscribe() {
  if (!A || !A.sb()) return;
  ["approvals", "drafts"].forEach(tb => { if (CH[tb]) return; try { const ch = CH[tb] = A.sb().channel("ap-live-" + tb);
    ch.on("postgres_changes", { event: "*", schema: "public", table: tb }, () => { clearTimeout(CHT); CHT = setTimeout(reread, 1200); });
    ch.on("system", {}, m => { if (m && m.extension === "postgres_changes" && m.status === "error" && CH[tb] === ch) { try { A.sb().removeChannel(ch); } catch {} CH[tb] = null; } });   // not in the publication: the poll covers it
    ch.subscribe(); } catch { CH[tb] = null; } });
  if (!POLL) POLL = setInterval(() => { if (!document.hidden) reread(); }, 30000);
}
function unsubscribe() { Object.keys(CH).forEach(tb => { if (CH[tb]) { try { A.sb().removeChannel(CH[tb]); } catch {} CH[tb] = null; } }); clearInterval(POLL); POLL = null; clearTimeout(CHT); closeSheet(true); EDIT = null; HANDLED = ""; HL = ""; }
document.addEventListener("visibilitychange", () => { if (!document.hidden && document.getElementById("ap")) reread(); });
new MutationObserver(() => { if (!document.getElementById("ap") && (POLL || CH.approvals || CH.drafts || SHEET)) unsubscribe(); }).observe(document.getElementById("spage") || document.body, { childList: true });

/* ---------------- deep link: ?p=approvals&id=<n> | d<n> ---------------- */
function openLink() {
  let id = ""; try { id = new URL(location.href).searchParams.get("id") || ""; } catch {}
  if (!id || id === HANDLED) return; HANDLED = id;
  const it = Q().items.find(x => x.link === id);
  if (it) { HL = it.key; if (PHONE.matches) openSheet(it.key, null); else { force(); document.getElementById("ap-" + it.link)?.scrollIntoView({ block: "center", behavior: motion() ? "smooth" : "auto" }); } return; }
  const done = D && (D.recent || []).find(a => String(a.id) === id);
  const root = document.getElementById("ap-root"); if (!root) return;
  root.insertAdjacentHTML("afterbegin", `<p class="ap-note" role="status" id="ap-gone">${done ? `That one is already decided: ${esc(done.title)}${(done.decided_by || []).length ? ` (${esc(done.decided_by.join(" + "))}, ${esc(stamp(done.decided_at))})` : ""}.` : "That approval is not waiting any more: it was decided, cancelled or sent."}</p>`);
  if (done) { const dn = document.getElementById("ap-dn"); if (dn) dn.open = true; }
}
function wire(api) { A = api; subscribe(); openLink(); badge(); if (D && Date.now() - (D.at || 0) > 4000) reread(); }   // back on the page from side.js's cache: read again, the channels were off while away
window.BEJU_APPROVALS = { queue };
setTimeout(() => { const x = X(); if (x && x.raw && x.approvals) x.approvals().catch(() => {}); }, 0);   // crm.js drew its cards before this file ran (a fast sign-in): draw the Approvals card again
(window.BEJU_SIDE_PAGES = window.BEJU_SIDE_PAGES || {}).approvals = {
  title: "Approvals",
  head: ["<em class=\"sf\">Approvals</em>", "What either Claude needs an OK for, and the replies that wait. Either of you can decide."],
  src: () => null,
  load, view, wire,
};
})();
