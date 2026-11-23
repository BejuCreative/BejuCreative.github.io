/* BEJÚ founder CRM: Weekly reports (?p=perf), v3. SIMAS 11-23, spec docs/perf_1123/REPORTS_SPEC.md. Founder verdict on v2: "very hard to
   navigate and doesn't do what we want" → one job: read each client's weekly report exactly as they will see it, fix the text, press Send.
   Left: report_clients (active) + this week's client_reports, one status chip each (Due / Draft ready / Held / Sent this week).
   Right: the report rendered by ../report/render.js, the SAME code the client's private page uses. Buttons: Edit (best.why, ideas[].idea,
   next_week, summary_lines → data.edits {path: text}), Send (rpc report_send(report_id) → draft_id; then that draft's email shows with
   "Send it" = the Samples approve: status approved + approved_sha256 of the body on screen; draft-sender sends it within a minute),
   Hold (status held ↔ draft), Past reports. Nothing leaves before the founder presses "Send it" and confirms.
   Health (collapsed): platform badges (perf_health), posting rate + rescue flags (v_perf_clients), "Is this our Short?" (link_suggestions):
   the v2 logic, kept. Anything missing (backend lane still building) shows a calm "not ready", never an error. CSP: no inline styles. */
(() => {
"use strict";
let A = null, D = null, SEL = null, VIEW = null, EDIT = false, MAIL = null, PAST = false;
const R = () => window.BEJU_REPORT;
const TZ = (window.BEJU_CRM || {}).timezone || "Europe/Vilnius";
const PL = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok" }, PORD = ["youtube", "instagram", "tiktok"];
const plN = p => PL[p] || p || "—";
const FLAG = { rescue: ["Rescue", "r", "alert"], upsell: ["Upsell", "g", "cash"], proof: ["Proof", "pv-proof", "star"] };
const STALE_H = 26;
const fAt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const at = t => t ? fAt.format(new Date(t)) : "never";
const hrs = t => t ? (Date.now() - new Date(t)) / 36e5 : Infinity;
const daysAgo = s => s ? (Date.now() - new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + "T23:59:59Z" : s)) / 864e5 : Infinity;
const notReady = (what, why) => `<p class="pv-nr">${A.ic("clock")}<span><b>${A.esc(what)}: not ready yet.</b> ${A.esc(why || "It shows here as soon as the backend step is live.")}</span></p>`;
const health = p => (D.health || []).find(h => h.platform === p) || null;
const stale = p => { const h = health(p); return !h || !h.ok || hrs(h.last_ok_at) > STALE_H; };
const missing = e => e && (e.code === "PGRST202" || e.code === "42883" || e.code === "42P01" || e.code === "PGRST205" || /could not find|does not exist/i.test(e.message || ""));
const refused = e => e && (e.code === "42501" || /row-level security|permission denied/i.test(e.message || ""));

/* ---------------- load ---------------- */
async function load(api) {
  A = api;
  const q = (t, mod) => api.all(t, "*", mod).catch(() => null);   // null = not there yet → "not ready"
  const [rc, cr, cl, hl, sug] = await Promise.all([q("report_clients", x => x.eq("active", true)),
    q("client_reports", x => x.neq("status", "internal").order("week", { ascending: false })),
    q("v_perf_clients"), q("perf_health"), q("link_suggestions", x => x.eq("status", "open").order("created_at"))]);
  let posts = [], dels = [];
  if (sug && sug.length) {
    const pids = [...new Set(sug.map(s => s.post_id).filter(Boolean))], dids = [...new Set(sug.map(s => s.delivery_id).filter(Boolean))];
    const get = (t, cols, k, ids) => ids.length ? api.sb().from(t).select(cols).in(k, ids).then(r => r.data || [], () => []) : [];
    [posts, dels] = await Promise.all([get("client_posts", "platform,post_id,title,url,posted_at,duration_s", "post_id", pids), get("deliveries", "id,title,delivered_at", "id", dids)]);
  }
  return model({ rc, cr, cl, health: hl, sug, posts, dels });
}
const weekEnd = r => (r.data && r.data.week_end) || r.week;
function model(x) {
  const lc = A.lc, reps = (x.cr || []).map(r => ({ ...r, key: lc(r.email) }));
  const base = x.rc ? x.rc.map(c => ({ key: lc(c.email), email: c.email, name: c.name, reason: c.reason, tier: c.tier, inbox: c.inbox }))
    : [...new Set(reps.map(r => r.key))].map(k => ({ key: k, email: k, name: (reps.find(r => r.key === k).data || {}).client?.name || "", reason: "", tier: "", inbox: "" }));
  const clients = base.map(c => {
    const all = reps.filter(r => r.key === c.key), cur = all.find(r => R().isV1(r.data) && daysAgo(weekEnd(r)) <= 8) || null;
    const st = !cur ? "due" : cur.status === "sent" ? "sent" : cur.status === "held" ? "held" : cur.status === "sending" ? "sending" : "draft";
    return { ...c, name: c.name || (cur && cur.data.client && cur.data.client.name) || c.email, all, cur, st };
  }).sort((a, b) => ORD[a.st] - ORD[b.st] || String(a.name).localeCompare(String(b.name)));
  return { ...x, clients, listOk: !!x.rc, reportsOk: !!x.cr };
}
const ORD = { draft: 0, held: 1, sending: 2, due: 3, sent: 4 };
const CHIP = { due: ["Due", "r"], draft: ["Draft ready", "b"], held: ["Held", "o"], sending: ["Sending", "b"], sent: ["Sent this week", "g"] };
const chip = s => `<span class="chip ${CHIP[s][1]}">${CHIP[s][0]}</span>`;

/* ---------------- list ---------------- */
function row(c) {
  const { esc, initials } = A;
  return `<a class="cl-item wr-item" href="?p=perf&amp;k=${encodeURIComponent(c.key)}" data-wr-c="${esc(c.key)}"${SEL === c.key ? ' aria-current="true"' : ""}>
    <span class="av">${esc(initials(c.name || c.email))}</span>
    <span class="grow"><span class="t">${esc(c.name)}</span><span class="s">${esc(c.reason || (c.tier === "high_ticket" ? "High ticket" : c.tier === "promised" ? "Promised in our emails" : c.email))}</span></span>${chip(c.st)}</a>`;
}

/* ---------------- detail ---------------- */
const curOf = c => VIEW ? c.all.find(r => String(r.id) === String(VIEW)) || c.cur : c.cur;
function detail(c) {
  const { esc, ic } = A;
  if (!c) return D.clients.length ? `<p class="empty">Pick a client on the left.</p>` : `<div class="wr-empty">${A.ic("clock")}<b>No reports to show yet.</b><span>They show here once the report client list is live and the Sunday job has built them.</span></div>`;
  const r = curOf(c), past = !!VIEW && r && r !== c.cur, wk = r && R().isV1(r.data) ? R().weekLabel(r.data.week_start, r.data.week_end) : r ? A.dLabel(r.week) : "";
  const canEdit = r && !past && (r.status === "draft" || r.status === "held") && !r.draft_id, canSend = r && !past && R().isV1(r.data) && (r.status === "draft" || (r.status === "sending" && r.draft_id != null));
  const olds = c.all.filter(x => x !== c.cur);
  const head = `<div class="wr-head"><div class="wr-ht"><h2>${esc(c.name)}</h2><p>${esc([c.reason, c.inbox ? "from " + c.inbox : ""].filter(Boolean).join(" · ") || c.email)}</p></div>
    <div class="wr-hs">${past ? `<span class="chip">Past report</span>` : chip(c.st)}${wk ? `<span class="chip">${esc(wk)}</span>` : ""}</div></div>`;
  let acts;
  if (EDIT) acts = `<button type="button" class="act go wr-a" data-wr="save">${ic("check")}Save</button><button type="button" class="act wr-a" data-wr="cancel">Cancel</button>`;
  else if (past) acts = `<button type="button" class="act wr-a" data-wr="back">${ic("back")}Back to this week</button>${r.page_url ? `<a class="act wr-a" href="${esc(r.page_url)}" target="_blank" rel="noopener noreferrer">${ic("link")}Client's page</a>` : ""}`;
  else acts = `${r ? `<button type="button" class="act wr-a" data-wr="edit"${canEdit ? "" : ` disabled title="${esc(r.draft_id ? "The email is already made from this text" : "Only a draft or held report can be edited")}"`}>${ic("edit")}Edit</button>
      <button type="button" class="act go wr-a" data-wr="send"${canSend ? "" : " disabled"}>${ic("send")}${r.draft_id ? "Open email" : "Send"}</button>
      ${r.status === "draft" || r.status === "held" ? `<button type="button" class="act wr-a" data-wr="hold">${ic(r.status === "held" ? "refresh" : "clock")}${r.status === "held" ? "Unhold" : "Hold"}</button>` : ""}` : ""}
      <button type="button" class="act wr-a" data-wr="past" aria-expanded="${PAST}"${olds.length ? "" : " disabled"}>${ic("clock")}Past reports${olds.length ? ` (${olds.length})` : ""}</button>
      ${r && r.page_url ? `<a class="act wr-a" href="${esc(r.page_url)}" target="_blank" rel="noopener noreferrer">${ic("link")}Client's page</a>` : ""}`;
  const pastList = PAST && !past && olds.length ? `<div class="wr-past">${olds.map(x => `<button type="button" class="wr-pi" data-wr="view" data-id="${esc(x.id)}"><span>${esc(R().isV1(x.data) ? R().weekLabel(x.data.week_start, x.data.week_end) : A.dLabel(x.week))}</span><span class="chip ${x.status === "sent" ? "g" : ""}">${esc(x.status === "sent" ? "sent " + (x.sent_at ? A.dLabel(A.dayOf(x.sent_at)) : "") : x.status)}</span></button>`).join("")}</div>` : "";
  const note = r && r.status === "held" && !past ? `<p class="sp-note wr-note">Held: it won't go out. Unhold it to send.</p>` : r && r.status === "sending" && !past ? `<p class="sp-note wr-note">The email is made and waits for your "Send it" below, or it's on its way.</p>` : "";
  const body = !D.reportsOk ? notReady("Weekly reports", "The report table can't be read yet.")
    : !r ? `<div class="wr-empty">${A.ic("clock")}<b>No report for this week yet.</b><span>It's built every Sunday at 10:00.${olds.length ? " Older ones are under Past reports." : ""}</span></div>`
    : `<div class="wr-frame">${R() ? R().render(r.data, { edit: EDIT, name: c.name }) : notReady("Report preview", "render.js didn't load.")}</div>`;
  return `${head}<div class="wr-acts">${acts}</div><p class="pv-err wr-err" id="wr-err" role="alert" hidden></p>${note}${pastList}<div id="wr-mail">${MAIL && !past ? mailHTML(c) : ""}</div>${body}`;
}

/* the email report_send made: the Samples approve flow (status approved + approved_sha256 of the body on screen) */
const MST = { pending: "", held: "Sent back with changes. It comes back here when fixed.", approved: "Approved. It goes out within a minute.", sending: "Sending now.", sent: "Sent.",
  failed: "Not sent: the sender refused it. Read the reason first.", stale: "Not sent: the client wrote again after this was made.", unknown: "Unclear if it went out. Check the inbox before anything else." };
function mailHTML(c) {
  const { esc, ic } = A, d = MAIL; if (!d) return "";
  if (d.missing) return `<div class="wr-mail">${notReady("The email", "The draft can't be read yet. Nothing was sent.")}</div>`;
  const to = [d.to_email, ...(d.cc_list || [])].filter(Boolean).join(", "), can = /^(pending|failed|stale)$/.test(d.status);
  return `<div class="wr-mail"><h3>${ic("mail")}The email that goes out</h3>
    <p class="wr-emh"><span>From <b>${esc(d.inbox || "—")}</b></span><span>To <b>${esc(to || "—")}</b></span></p>
    ${MST[d.status] ? `<p class="wr-ems ${esc(d.status)}">${esc(MST[d.status])}${d.error && /^(failed|unknown|stale)$/.test(d.status) ? ` <small>${esc(String(d.error).slice(0, 200))}</small>` : ""}</p>` : ""}
    <pre class="wr-emb" id="wr-emb">${esc(d.body)}</pre>
    <div class="wr-acts">${can ? `<button type="button" class="act go wr-a" data-wr="sendit">${ic("send")}Send it</button>` : ""}<button type="button" class="act wr-a" data-wr="mailx">Close</button></div>
    <p class="sp-note">Nothing goes out until you press Send it and confirm. ${c.name ? esc(R().first(c.name)) + " gets" : "They get"} this email with the link to the page below.</p></div>`;
}
async function getDraft(id) {
  const sb = A.sb(), one = t => sb.from(t).select("*").eq("id", id).maybeSingle().then(r => (r.error ? null : r.data), () => null);
  return (await one("drafts_waiting")) || (await one("drafts"));
}

/* ---------------- health (collapsed; the v2 logic) ---------------- */
function healthHTML() {
  const { esc, ic } = A, C = D.cl ? D.cl.slice().sort((a, b) => (b.flag === "rescue") - (a.flag === "rescue") || (+b.mrr_usd || 0) - (+a.mrr_usd || 0)) : null, S = (D.sug || []).filter(s => s.status === "open");
  const nStale = D.health ? PORD.filter(p => health(p) && stale(p)).length : 0, nRes = C ? C.filter(c => c.flag === "rescue").length : 0;
  const sum = [nRes ? `${nRes} rescue` : "", S.length ? `${S.length} link check${S.length === 1 ? "" : "s"}` : "", nStale ? `${nStale} platform${nStale === 1 ? "" : "s"} stale` : ""].filter(Boolean);
  const badges = !D.health || !D.health.length ? notReady("Data health", "The platform sync status can't be read yet.") : `<div class="pv-health" role="list" aria-label="Data freshness per platform">${PORD.map(p => { const h = health(p); if (!h) return "";
    const bad = stale(p); return `<span role="listitem" class="pv-hb ${bad ? "r" : "g"}"${h.detail ? ` title="${esc(h.detail)}"` : ""}>${ic(bad ? "alert" : "check")}<b>${esc(plN(p))}</b>${p === "tiktok" ? `<small class="pv-be">best effort</small>` : ""}<span>${!h.ok ? "error" : bad ? "over 26 h old" : "fresh"} · as of ${esc(at(h.last_ok_at))}</span></span>`; }).join("")}</div>`;
  const rows = !C ? notReady("Posting rate") : C.map(c => { const del = +c.delivered || 0, pos = +c.posted || 0, old = +c.oldest_unposted_days || 0, F = FLAG[c.flag];
    return `<div class="wr-hr"><b>${esc(c.client_name || c.client_email)}</b><span class="mono">${pos} of ${del} posted (${del ? Math.round(100 * pos / del) : 0}%)${old ? ` · oldest unposted <i class="${old > 7 ? "pv-late" : ""}">${old} d</i>` : ""}</span>${F ? `<span class="wr-hf"><span class="chip ${F[1]}">${ic(F[2])}${F[0]}</span>${c.flag_reason ? `<small>${esc(c.flag_reason)}</small>` : ""}</span>` : ""}</div>`; }).join("");
  const sugs = S.length ? `<div class="pv-sug"><b class="cl-ph">Is this our Short?</b><p class="sp-note">A post that may be one of ours. Yes links it (it counts after the next sync). No hides it.</p>${S.map(sugCard).join("")}</div>` : "";
  return `<details class="card sp-card wr-health" id="wr-health"${HOPEN ? " open" : ""}><summary><span>${ic("bolt")}<b>Health</b></span><small>${esc(sum.join(" · ") || "all fine")}</small></summary>
    <div class="wr-hb">${badges}<div class="wr-hrs">${rows}</div>${sugs}</div></details>`;
}
let HOPEN = false;
function sugCard(s) {
  const { esc, ic, dLabel, dayOf } = A, p = D.posts.find(x => x.platform === s.platform && x.post_id === s.post_id) || {}, dl = D.dels.find(x => String(x.id) === String(s.delivery_id)) || {};
  const who = (D.cl || []).find(c => A.lc(c.client_email) === A.lc(s.client_email));
  const th = s.platform === "youtube" && /^[\w-]{6,20}$/.test(s.post_id || "") ? `<img class="pv-th" src="https://i.ytimg.com/vi/${encodeURIComponent(s.post_id)}/mqdefault.jpg" alt="" loading="lazy" width="160" height="90">` : `<span class="pv-th">${ic("play")}</span>`;
  return `<div class="pv-sc" data-sid="${esc(s.id)}">
    <div class="pv-sp"><small>Ours${who ? " · " + esc(who.client_name || "") : ""}</small><b>${esc(dl.title || "One of our Shorts")}</b><span>${dl.delivered_at ? `delivered ${esc(dLabel(dayOf(dl.delivered_at)))}` : ""}</span></div>
    <a class="pv-sp pv-their" href="${esc(p.url || "#")}" target="_blank" rel="noopener noreferrer">${th}<span><small>Their ${esc(plN(s.platform))} post</small><b>${esc(p.title || s.post_id || "Post")}</b><span>${p.posted_at ? `posted ${esc(dLabel(dayOf(p.posted_at)))}` : ""}</span></span></a>
    ${s.reason ? `<p class="sp-note pv-why">${esc(s.reason)}${s.score != null ? ` · match ${Math.round(+s.score * (+s.score <= 1 ? 100 : 1))}%` : ""}</p>` : ""}
    <div class="pv-sb"><button type="button" class="act go" data-sug="${esc(s.id)}" data-st="accepted">${ic("check")}Yes, ours</button><button type="button" class="act" data-sug="${esc(s.id)}" data-st="rejected">${ic("x")}No</button></div>
    <p class="pv-err" role="alert" hidden></p></div>`;
}
async function setSug(btn) {
  const id = btn.dataset.sug, st = btn.dataset.st, card = btn.closest(".pv-sc"), err = card.querySelector(".pv-err");
  card.querySelectorAll("button").forEach(b => { b.disabled = true; }); err.hidden = true;
  try {
    const { data, error } = await A.sb().from("link_suggestions").update({ status: st }).eq("id", id).select("id");
    if (error) throw error;
    if (!data || !data.length) throw { code: "42501" };
    const s = D.sug.find(x => String(x.id) === String(id)); if (s) s.status = st;
    paintHealth(); A.toast(st === "accepted" ? "Linked. It counts after the next sync." : "Hidden: not ours.");
  } catch (e) {
    card.querySelectorAll("button").forEach(b => { b.disabled = false; }); err.hidden = false;
    err.textContent = refused(e) ? "Not saved: the database refused it (founders only). Sign in again, then retry." : `Couldn't save: ${String((e && e.message) || e).slice(0, 140)}`;
  }
}

/* ---------------- view + wire ---------------- */
function view(d, api) {
  A = api; D = d;
  const k = api.lc(new URLSearchParams(location.search).get("k") || "");
  SEL = d.clients.length ? (d.clients.find(c => c.key === k) || d.clients[0]).key : null; VIEW = null; EDIT = false; MAIL = null; PAST = false;
  const counts = Object.keys(CHIP).map(s => [s, d.clients.filter(c => c.st === s).length]).filter(x => x[1]);
  const list = !d.listOk && !d.clients.length ? notReady("Report clients", "The list of clients who get a weekly report can't be read yet.")
    : !d.clients.length ? `<p class="empty">No report clients yet.</p>`
    : `${!d.listOk ? `<p class="sp-note wr-lh">The report client list isn't ready yet, so these come from the reports themselves.</p>` : ""}<div class="cl-list" id="wr-list">${d.clients.map(row).join("")}</div>`;
  return `<div class="cl-wrap wr-wrap"><section class="card sp-card wr-left"><p class="sp-note wr-lh">${counts.length ? counts.map(([s, n]) => `${n} ${CHIP[s][0].toLowerCase()}`).join(" · ") : "Built every Sunday at 10:00."}</p>${list}</section>
    <section class="card sp-card wr-right" id="wr-detail">${detail(d.clients.find(c => c.key === SEL))}</section></div>${healthHTML()}`;
}
const say = m => { const e = A.el.querySelector("#wr-err"); if (e) { e.hidden = !m; e.textContent = m || ""; } };
function paintDetail() { const box = A.el.querySelector("#wr-detail"); if (box) box.innerHTML = detail(D.clients.find(c => c.key === SEL)); }
function paintHealth() { const h = A.el.querySelector("#wr-health"); if (!h) return; const t = document.createElement("div"); t.innerHTML = healthHTML(); h.replaceWith(t.firstElementChild); }
function paintMail() { const c = D.clients.find(x => x.key === SEL), m = A.el.querySelector("#wr-mail"); if (m && c) m.innerHTML = MAIL ? mailHTML(c) : ""; }
const X = () => window.BEJU_CRM_SAMPLES || {};

async function act(op, btn) {
  const c = D.clients.find(x => x.key === SEL); if (!c) return; const r = curOf(c); say("");
  if (op === "edit") { EDIT = true; MAIL = null; paintDetail(); A.el.querySelector("#wr-detail .bjr-ed")?.focus(); return; }
  if (op === "cancel") { EDIT = false; paintDetail(); return; }
  if (op === "past") { PAST = !PAST; paintDetail(); return; }
  if (op === "view") { VIEW = btn.dataset.id; PAST = false; MAIL = null; EDIT = false; paintDetail(); A.el.querySelector("#wr-detail")?.scrollIntoView({ block: "start", behavior: "auto" }); return; }
  if (op === "back") { VIEW = null; paintDetail(); return; }
  if (op === "mailx") { MAIL = null; paintMail(); return; }
  if (!r) return;
  const lock = on => A.el.querySelectorAll("#wr-detail [data-wr]").forEach(b => { if (on) { b.dataset.was = b.disabled ? "1" : ""; b.disabled = true; } else b.disabled = b.dataset.was === "1"; });
  lock(true);
  try {
    if (op === "save") {
      const box = A.el.querySelector("#wr-detail"), sb = A.sb();
      const { data: fresh, error } = await sb.from("client_reports").select("data,status").eq("id", r.id).maybeSingle(); if (error) throw error;
      if (!fresh) throw new Error("This report is gone. Reload the page.");
      if (!/^(draft|held)$/.test(fresh.status)) throw new Error("This report is no longer a draft, so it can't be edited.");
      const base = fresh.data || {}, E = { ...R().edits(base) };
      box.querySelectorAll("[data-ed]").forEach(t => { const p = t.dataset.ed, orig = p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), base), v = t.value.replace(/\r\n?/g, "\n").trim();
        if (!v || v === String(orig ?? "").trim()) delete E[p]; else E[p] = v; });
      const nd = { ...base, edits: E };
      await X().upd("client_reports", r.id, { data: nd });
      r.data = nd; EDIT = false; paintDetail(); A.toast("Saved. The page and the email use your text.");
      return;
    }
    if (op === "hold") {
      const to = r.status === "held" ? "draft" : "held";
      await X().upd("client_reports", r.id, { status: to }); r.status = to; c.st = to;
      A.toast(to === "held" ? "Held. It won't go out." : "Back to draft."); repaintRow(c); paintDetail(); return;
    }
    if (op === "send") {
      let id = r.draft_id;
      if (!id) {
        const { data, error } = await A.sb().rpc("report_send", { report_id: r.id });
        if (error) { if (missing(error)) throw new Error("Send isn't switched on yet: the report_send step is still being built. Nothing was sent."); throw error; }
        id = data && typeof data === "object" ? (Array.isArray(data) ? data[0] && (data[0].draft_id ?? data[0].report_send) : data.draft_id) : data;
        if (id == null) throw new Error("The email wasn't made (no draft came back). Nothing was sent.");
        r.draft_id = id;
      }
      const d = await getDraft(id); MAIL = d || { missing: true, id };
      paintDetail(); A.el.querySelector("#wr-mail")?.scrollIntoView({ block: "nearest", behavior: "auto" }); return;
    }
    if (op === "sendit") {
      const d = MAIL; if (!d || d.missing) return;
      const now = await getDraft(d.id);   // read it fresh: if it changed since it painted, show the new text and ask to read it again
      if (!now || now.body !== d.body || now.status !== d.status) { MAIL = now || { missing: true, id: d.id }; paintMail(); say("This email just changed. Read the new version, then press Send it."); return; }
      const shown = A.el.querySelector("#wr-emb").textContent, to = [d.to_email, ...(d.cc_list || [])].filter(Boolean).join(", ");
      if (shown !== String(d.body).replace(/\r\n?/g, "\n")) { say("The email on screen is not the saved one any more. Reload and open it again."); return; }
      const ok = await X().ask({ title: `Send this to ${c.name}?`, warn: `It goes out within a minute from ${d.inbox} to ${to}, word for word, with the link to the report page.`, sees: shown, cta: "Send it" });
      if (!ok) return;
      await X().upd("drafts", +d.id, { status: "approved", approved_sha256: await X().sha256hex(d.body) });
      A.toast("Sending. It goes out within a minute."); MAIL = (await getDraft(d.id)) || { ...d, status: "approved" }; paintMail(); return;
    }
  } catch (e) {
    say(refused(e) ? "Not saved: the database refused it (founders only, or the backend step isn't live yet). Nothing was sent." : String((e && e.message) || e).slice(0, 220));
  } finally { lock(false); }
}
function repaintRow(c) { const a = A.el.querySelector(`[data-wr-c="${CSS.escape(c.key)}"]`); if (!a) return; const t = document.createElement("div"); t.innerHTML = row(c); a.replaceWith(t.firstElementChild); }
const WIRED = new WeakSet();
function wire(api) {
  A = api; const el = api.el;
  el.querySelector("#wr-list")?.addEventListener("click", ev => {
    const a = ev.target.closest("[data-wr-c]"); if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey) return; ev.preventDefault();
    if (EDIT && !confirm("Leave without saving your edits?")) return;
    SEL = a.dataset.wrC; VIEW = null; EDIT = false; MAIL = null; PAST = false;
    el.querySelectorAll("#wr-list [data-wr-c]").forEach(x => x.dataset.wrC === SEL ? x.setAttribute("aria-current", "true") : x.removeAttribute("aria-current"));
    paintDetail(); history.replaceState({ p: "perf" }, "", `?p=perf&k=${encodeURIComponent(SEL)}`);
    if (innerWidth <= 900) el.querySelector("#wr-detail")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });
  el.querySelector("#wr-detail")?.addEventListener("click", ev => { const b = ev.target.closest("[data-wr]"); if (b && !b.disabled) act(b.dataset.wr, b); });
  if (WIRED.has(el)) return; WIRED.add(el);   // the page element outlives each render: bind these two once
  el.addEventListener("click", ev => { const s = ev.target.closest("#wr-health [data-sug]"); if (s) setSug(s); });
  el.addEventListener("toggle", ev => { if (ev.target.id === "wr-health") HOPEN = ev.target.open; }, true);
}
(window.BEJU_SIDE_PAGES = window.BEJU_SIDE_PAGES || {}).perf = {
  title: "Weekly reports",
  head: ["Weekly <em class=\"sf\">reports</em>", "Pick a client, read the report as they'll see it, then press Send."],
  src: d => { const t = d && (d.cr || []).map(r => r.created_at).filter(Boolean).sort().pop(); return d ? ["Built Sundays 10:00", t || null, false] : null; },
  load, view, wire,
};
})();
