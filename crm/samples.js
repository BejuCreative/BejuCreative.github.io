/* BEJÚ founder CRM: Samples page (?p=samples). BENAS 11-22: "a new samples tab instead of the contact one … clean bento style, very smooth,
   modern … dynamic 60 FPS motion blur, Apple style". Spec: reports/Samples tab spec.md (his decisions, asked one by one).
   A pipeline board of the FREE samples: Said yes → Building → Ready → Sent → Replied → Paid. Cards move by themselves only (no dragging).
   Data: no query of its own. It reads crm.js's rows through window.BEJU_CRM_SAMPLES (public.pipeline "*", public.briefs, sync_status) and
   repaints on crm.js's "beju-crm:data" event. pipeline is filled by an hourly sheet sync, so the header says the sync's own "as of" time,
   or the time crm.js's live updates (11-23) last brought rows, whichever is later.
   A refresh that brings a row whose column changed glides that card from its old column to the new one (FLIP: measure, move, transform back
   to zero) and glows once; a move into Paid fires the dashboard's confetti. Nothing glides or glows on the first paint.
   The panel (click a card): the Drive preview of the Short on the left, status line + history + brief + conversation (crm.js's loadConv /
   convBlock, one query when it opens) on the right. Motion: transform + opacity only; off under reduced motion and the "Calm" look setting.
   Registered with side.js through window.BEJU_SIDE_PAGES, so this file loads before side.js. CSP: no inline styles (CSSOM only). */
(() => {
"use strict";
const X = () => window.BEJU_CRM_SAMPLES;
const TZ = (window.BEJU_CRM || {}).timezone || "Europe/Vilnius";
const HTML = document.documentElement, RMQ = matchMedia("(prefers-reduced-motion: reduce)"), PHONE = matchMedia("(max-width: 600px)");
const motion = () => !RMQ.matches && HTML.dataset.motion !== "calm";
const esc = s => String(s ?? "").replace(/[&<>"'`]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" }[c]));
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const lc = s => String(s || "").toLowerCase().trim();
const up = s => String(s || "").toUpperCase().trim();
const ms = t => { const v = t ? +new Date(t) : 0; return isFinite(v) ? v : 0; };
const H = 36e5, DAY = 864e5, FOLD_DAYS = 14, LATE_H = 24;
const fT = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fD = new Intl.DateTimeFormat("en-US", { timeZone: TZ, day: "numeric", month: "short" });   // "Nov 21", the CRM's own date style
const fDay = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayOf = t => t ? fDay.format(t) : "";
const when = t => { const d = dayOf(t), n = Date.now(); return d === dayOf(n) ? `Today ${fT.format(t)}` : d === dayOf(n - DAY) ? `Yesterday ${fT.format(t)}` : `${fD.format(t)}, ${fT.format(t)}`; };
const span = d => { const m = Math.max(0, Math.round(d / 6e4)); return m < 60 ? `${Math.max(1, m)} min` : m < 2880 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; };
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const kfmt = v => { const n = +v; if (!isFinite(n) || n <= 0) return ""; return n >= 1e6 ? nf1.format(n / 1e6) + "M" : n >= 1e3 ? nf1.format(n / 1e3) + "k" : String(Math.round(n)); };
const initials = s => { const w = String(s || "?").replace(/@.*/, "").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/); return ((w[0]?.[0] || "?") + (w[1]?.[0] || "")).toUpperCase(); };
const campName = n => String(n || "").replace(/^TEST\s*[—-]\s*/i, "").replace(/\s*\(\d\d-\d\d\)\s*$/, "").trim();

/* the six columns (spec table) and where a status lands. LOST / DONE are counted under the board; HOLD sits in the column its dates say, marked */
const COLS = [["yes", "Said yes", ["YES"], "No new yes"], ["build", "Building", ["CLAIMED"], "Nothing in edit"], ["ready", "Ready", ["BUILT", "PUBLIC"], "Nothing waiting to send"],
  ["sent", "Sent", ["DELIVERED", "FU1", "FU2", "SILENT"], "Nothing out right now"], ["replied", "Replied", ["REPLIED", "HOT"], "No replies yet"], ["paid", "Paid", ["WON"], "No sample has paid yet"]];
const COL_OF = {}; COLS.forEach(c => c[2].forEach(s => { COL_OF[s] = c[0]; }));
const PRE = new Set(["yes", "build", "ready"]);   // not delivered yet: the 24 h late clock runs here
const TAG = { BUILT: "Built", PUBLIC: "Public", DELIVERED: "No reply yet", FU1: "Follow-up 1 sent", FU2: "Follow-up 2 sent", SILENT: "Silent" };
const colOf = p => COL_OF[up(p.status)] || null;   // HOLD maps to no column (BENAS 11-23); held rows are taken off the board in model() before this
/* the stage clock (Simas's side 11-22: stage_changed_at is empty on older rows): coalesce(stage_changed_at, delivered_at, public_at, yes_at, updated_at) */
const stageAt = p => ms(p.stage_changed_at) || ms(p.delivered_at) || ms(p.public_at) || ms(p.yes_at) || ms(p.updated_at);
/* Drive: drive_link holds the file id (or a file link). A folder link has no file id = no thumbnail. */
const driveId = v => { v = String(v || "").trim(); if (!v) return ""; const m = v.match(/\/file\/d\/([\w-]{10,})/) || v.match(/[?&]id=([\w-]{10,})/); if (m) return m[1]; return /^[\w-]{10,}$/.test(v) ? v : ""; };
const thumbUrl = id => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w400`;
const frameUrl = id => `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
const webUrl = v => { try { const u = new URL(String(v || "").trim()); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
const audienceOf = p => { for (const k of ["audience", "audience_size", "subscribers", "subs", "followers"]) if (p[k] != null && p[k] !== "") return /^\d+(\.\d+)?$/.test(String(p[k]).trim()) ? kfmt(p[k]) : String(p[k]).trim().slice(0, 12); return ""; };

/* 11-23 (BENAS, live data): pipeline holds every tracked lead, not only sample leads. A row is a SAMPLE only with evidence of one:
   yes_at, delivered_at, drive_link or public_at set, or a sample status (YES / CLAIMED / BUILT / PUBLIC). Anything else (a lead who only
   replied "reach out in December") stays off the board, out of every count, every tile and the lost / on-hold line. */
const SAMPLE_ST = new Set(["YES", "CLAIMED", "BUILT", "PUBLIC"]);
const isSample = p => !!(p.yes_at || p.delivered_at || String(p.drive_link || "").trim() || p.public_at) || SAMPLE_ST.has(up(p.status));
/* the won date: pipeline has no paid timestamp; the text column "paid" STARTS with the first payment's time in Vilnius local time
   ("2026-11-16 21:05 · 75 5-pack (Stripe…) | Order 2: …"). Parsed as Europe/Vilnius; else stage_changed_at, else updated_at. */
const fWall = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const wallMs = t => { const o = Object.fromEntries(fWall.formatToParts(t).map(x => [x.type, x.value])); return Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute); };
const zoned = (y, mo, d, h, mi) => { const g = Date.UTC(y, mo - 1, d, h, mi); let t = g - (wallMs(g) - g); t -= wallMs(t) - g; return t; };   // a Vilnius wall time -> epoch ms (two steps settle a DST edge)
const paidAt = p => { const m = String(p.paid || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/); if (m) { const t = zoned(+m[1], +m[2], +m[3], +m[4], +m[5]); if (isFinite(t)) return t; } return 0; };
const wonAt = p => paidAt(p) || ms(p.stage_changed_at) || ms(p.updated_at);
/* each column folds and sorts by ITS OWN event (11-23): when the sample entered that column, not when the status was last touched
   (the sync re-stamps stage_changed_at when DELIVERED turns FU1 or SILENT, which kept 100+ old samples "recent" in Sent) */
const EVENT = { yes: p => ms(p.yes_at), build: p => ms(p.yes_at), ready: p => ms(p.public_at) || ms(p.stage_changed_at), sent: p => ms(p.delivered_at), replied: p => ms(p.last_reply_at), paid: wonAt };
const NODATE_FOLDS = new Set(["sent", "replied", "paid"]);   // no usable date there = an old row: behind "Show older"
const CAP = 12;   // at most 12 cards per column before "Show N more"

/* ---------------- model ---------------- */
function model() {
  const C = X(), R = C && C.raw; if (!R || !R.pipeline) return null;
  const now = Date.now(), today = dayOf(now), B = {};
  (R.briefs || []).forEach(b => { const k = lc(b.email); if (k && (!B[k] || ms(b.submitted_at) > ms(B[k].submitted_at))) B[k] = b; });
  /* 11-23 (SIMAS): the delivery email a Claude drafted for a Ready sample (public.drafts_waiting, category sample); newest per lead */
  const DR = {}; (R.drafts || []).filter(x => x.category === "sample").forEach(x => { const k = lc(x.lead_email); if (!DR[k] || ms(x.created_at) > ms(DR[k].created_at)) DR[k] = x; });
  const deskHold = new Set((R.desk || []).filter(x => x.kind === "hold").flatMap(x => (x.emails || []).map(lc)));   // the CRM's own holds (desk_items), as the dashboard counts them
  const cards = [], quiet = { lost: 0, done: 0, held: [] }, seen = new Set(), P = [];
  R.pipeline.forEach(p => {
    const s = up(p.status), k = lc(p.email); if (!k || seen.has(k) || !isSample(p)) return; seen.add(k);
    /* 11-23 (BENAS "I told you to remove Patrick"): an on-hold sample (status HOLD, or a founder hold in desk_items) is on no column, in no
       count, late count or tile; only in the "N on hold" list under the board */
    if (s === "HOLD" || deskHold.has(k)) { quiet.held.push({ k, name: p.name || p.email || k, show: p.show || "" }); return; }
    P.push(p);
    if (s === "LOST") quiet.lost++; else if (s === "DONE") quiet.done++;
    const col = colOf(p); if (!col) return;
    const t = stageAt(p), ev = EVENT[col](p), yes = ms(p.yes_at), late = PRE.has(col) && !p.delivered_at && !!yes && now - yes > LATE_H * H;
    cards.push({ k, p, s, col, t, ev, late, lateBy: late ? now - yes - LATE_H * H : 0, hot: s === "HOT", brief: B[k] || null, draft: DR[k] || null, id: driveId(p.drive_link),
      owner: /^s/i.test(p.owner || "") ? "S" : /^b/i.test(p.owner || "") ? "B" : (C.ownerOfInbox(p.inbox) || "")[0] || "",
      old: ev ? now - ev > FOLD_DAYS * DAY : NODATE_FOLDS.has(col) });
  });
  /* newest event first; in Sent the ones still waiting ("no reply yet", follow-ups) come before the silent ones */
  cards.sort((a, b) => (a.col === "sent" && b.col === "sent" ? (a.s === "SILENT") - (b.s === "SILENT") : 0) || (b.ev - a.ev) || (b.t - a.t));
  const by = Object.fromEntries(COLS.map(c => [c[0], cards.filter(x => x.col === c[0])]));
  const done = P.filter(p => p.delivered_at), won = done.filter(p => up(p.status) === "WON").length;
  const builtDay = P.map(p => dayOf(ms(p.public_at) || ms(p.delivered_at))), days = Array.from({ length: 14 }, (_, i) => dayOf(now - (13 - i) * DAY));
  const tiles = { today: builtDay.filter(d => d === today).length, days: days.map(d => builtDay.filter(x => x === d).length), week: done.filter(p => now - ms(p.delivered_at) < 7 * DAY).length, won, sent: done.length, pct: done.length ? Math.round(100 * won / done.length) : null };
  /* 11-23 (founder request 11-23): crm.js's live updates (realtime, or the 60 s poll) stamp liveAt when they bring rows; the later of that and the sheet sync is the "as of" */
  const S = (R.sync || []).find(r => r.name === "sheet"), base = S ? ms(S.ran_at) : Math.max(0, ...P.map(p => ms(p.updated_at))), live = +C.liveAt || 0, at = Math.max(base, live), max = (S && +S.max_age_min) || 90;
  return { cards, by, quiet, tiles, asof: { at, old: !!at && now - at > max * 6e4, max, src: !!S, live: live > base }, total: cards.length + quiet.lost + quiet.done + quiet.held.length };
}

/* ---------------- card ---------------- */
const FAILED = new Set(), LOADED = new Set();   // Drive ids whose thumbnail failed (placeholder from then on, never asked again) / already loaded (shown at once)
/* thumbnails load only when their card comes near the screen: IntersectionObserver with the viewport as root sees the clipping of the column
   scroller (phone swipe, narrow desktop) as well as the page, so a card in a column off to the side or far down asks Drive for nothing.
   Until the image has loaded the designed placeholder shows (the img stays transparent), so a slow or failed image never shows a broken icon. */
let IMGIO = null;
const watchImgs = el => { if (!IMGIO) IMGIO = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; const i = e.target; IMGIO.unobserve(i); if (!i.getAttribute("src") && i.dataset.src) i.src = i.dataset.src; }), { rootMargin: "200px 0px" });
  el.querySelectorAll("img.sm-img[data-src]:not([src])").forEach(i => IMGIO.observe(i)); };
/* marks: on the frame in a narrow column (late / hot top right, brief bottom left); as chips under the clock in a wide one (CSS picks) */
const DST = { pending: ["Email ready", "ok"], held: ["Changes asked", "wait"], approved: ["Sending", "go"], sending: ["Sending", "go"], failed: ["Not sent", "bad"], stale: ["They wrote again", "bad"], unknown: ["Check Instantly", "bad"] };
/* 11-23 (SIMAS): "a timer of 30 minutes; if we don't check it and add revisions, you send it without our request". auto_send_at is kept by the
   drafts_guard trigger (30 min from ready; an edit restarts it; "What to change" stops it); draft-sender approves and sends it when it's up */
const autoLeft = d => { const t = d && d.status === "pending" ? ms(d.auto_send_at) : 0; return t ? t - Date.now() : null; };
const autoTxt = d => { const l = autoLeft(d); return l == null ? "" : l > 6e4 ? `Sends in ${Math.ceil(l / 6e4)} min` : "Sending now"; };
const emChip = d => { if (!d || !DST[d.status]) return ""; const a = autoTxt(d); return `<span class="sm-bd em ${a ? "go" : DST[d.status][1]}">${esc(a || DST[d.status][0])}</span>`; };
const marks = c => ({ top: `${emChip(c.draft)}${c.late ? `<span class="sm-bd late">Late · ${esc(span(c.lateBy + LATE_H * H))}</span>` : ""}${c.hot ? `<span class="sm-bd hot">Hot</span>` : ""}`,
  bot: `${c.brief ? `<span class="sm-bd brief" title="Brief form filled${c.brief.busyness ? `: graphics ${esc(c.brief.busyness)}` : ""}">Brief${c.brief.busyness ? ` · ${esc(String(c.brief.busyness).slice(0, 14))}` : ""}</span>` : ""}` });
function thumbHTML(c) {
  const nm = c.p.name || c.k, m = marks(c);
  const ok = c.id && LOADED.has(c.id), img = c.id && !FAILED.has(c.id) ? `<img class="sm-img" ${ok ? "src" : "data-src"}="${esc(thumbUrl(c.id))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-id="${esc(c.id)}">` : "";
  return `<span class="sm-th${ok ? "" : " ph"}" data-col="${c.col}" aria-hidden="true">${img}<span class="sm-ph"><i>${esc(initials(nm))}</i><small>${c.id ? "Preview not available" : c.col === "build" ? "In edit" : "No video yet"}</small></span>${m.top || m.bot ? `<span class="sm-bds"><span class="sm-bt">${m.top}</span><span class="sm-bb">${m.bot}</span></span>` : ""}</span>`;
}
function bodyHTML(c, now) {
  const p = c.p, nm = p.name || p.email || c.k, aud = audienceOf(p), camp = campName(p.campaign);
  const meta = [aud ? `${aud} audience` : "", camp].filter(Boolean).join(" · "), nx = String(p.next_action || "").trim(), na = ms(p.next_action_at), tag = TAG[c.s];
  const due = na ? (na >= now ? `in ${span(na - now)}` : `${span(now - na)} late`) : ""; const mk = marks(c);
  return `<span class="sm-r1"><b class="sm-nm">${esc(nm)}</b>${c.owner ? `<span class="sd-av sm-ow ${c.owner === "S" ? "s" : "b"}" title="${c.owner === "S" ? "Simas" : "Benas"}">${c.owner}</span>` : ""}</span>
    ${p.show ? `<span class="sm-sh">${esc(p.show)}</span>` : ""}${meta ? `<span class="sm-mt">${esc(meta)}</span>` : ""}
    <span class="sm-ft"><span class="sm-clk">${ic("clock")}<span>${c.t ? `${esc(span(now - c.t))} in this stage` : "no date yet"}</span></span>${tag ? `<span class="sm-tag">${esc(tag)}</span>` : ""}</span>
    ${mk.top || mk.bot ? `<span class="sm-chips" aria-hidden="true">${mk.top}${mk.bot}</span>` : ""}
    ${nx ? `<span class="sm-nx"><span class="sm-nxt"><b>Next</b> ${esc(nx)}</span>${due ? `<span class="sm-due${na < now ? " late" : ""}">${esc(due)}</span>` : ""}</span>` : ""}`;
}
const label = c => [c.p.name || c.k, c.p.show, COLS.find(x => x[0] === c.col)[1], c.late ? "late" : "", c.hot ? "hot" : ""].filter(Boolean).join(", ");

/* keyed cards: a card's node lives as long as the lead is on the board, so a move keeps its thumbnail and the FLIP measures the same node */
const NODES = new Map();   // key -> { el, th, bd }
const thSig = h => h.replace(/ (?:data-)?src="/, ' s="').replace('sm-th ph"', 'sm-th"');   // loading state is not a change: a loaded frame is never rebuilt
function cardEl(c, now) {
  const th = thSig(thumbHTML(c)), bd = bodyHTML(c, now); let n = NODES.get(c.k);
  if (!n) { const el = document.createElement("button"); el.type = "button"; el.className = "sm-card"; el.dataset.k = c.k; el.innerHTML = `${thumbHTML(c)}<span class="sm-b">${bd}</span>`; n = { el, th, bd }; NODES.set(c.k, n); }
  else { if (n.th !== th) { n.el.querySelector(".sm-th").outerHTML = thumbHTML(c); n.th = th; } if (n.bd !== bd) { n.el.querySelector(".sm-b").innerHTML = bd; n.bd = bd; } }
  n.el.dataset.col = c.col; n.el.classList.toggle("is-late", c.late); n.el.setAttribute("aria-label", `Open the sample: ${label(c)}`);
  return n.el;
}

/* ---------------- page state ---------------- */
let A = null, M = null, LAST = null, OPEN = new Set(), LIM = {}, HOLDS_OPEN = false, FIRST = true, PAN = null, CELEB = new Set(), TAB = 0, CU_DONE = false;
const root = () => document.getElementById("sm");

function view() {
  return `<div class="sm" id="sm" data-keep>
    <section class="sm-tiles" aria-label="Samples in numbers">
      <div class="card sp-card sm-tile"><span class="sm-tl">${ic("bolt")}Built today</span><b class="sm-big"><span class="sm-n" data-t="today">0</span></b><span class="sm-spark" aria-hidden="true">${"<i></i>".repeat(14)}</span><small class="sm-ts" data-ts="today"></small></div>
      <div class="card sp-card sm-tile sm-tile-c"><span class="sm-tl">${ic("chart")}Sample → paid</span><b class="sm-big"><span class="sm-n" data-t="pct">0</span><span class="sm-u" data-u="pct">%</span></b><small class="sm-ts" data-ts="pct"></small><span class="sm-meter" aria-hidden="true"><i></i></span></div>
      <div class="card sp-card sm-tile"><span class="sm-tl">${ic("check")}Samples done</span><b class="sm-big"><span class="sm-n" data-t="sent">0</span></b><small class="sm-ts" data-ts="sent"></small></div>
    </section>
    <div class="sm-tabs" role="tablist" aria-label="Stages">${COLS.map((c, i) => `<button type="button" role="tab" class="sm-tab" id="sm-tab-${c[0]}" data-tab="${i}" aria-controls="sm-col-${c[0]}" aria-selected="${i === 0}"><span>${c[1]}</span><b class="sm-tc" data-tc="${c[0]}">0</b></button>`).join("")}</div>
    <div class="sm-wrap"><div class="sm-board" id="sm-board">${COLS.map((c, i) => `<section class="sm-col" id="sm-col-${c[0]}" data-col="${c[0]}" aria-labelledby="sm-h-${c[0]}">
      <header class="sm-ch"><span class="sm-step" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><h2 id="sm-h-${c[0]}">${c[1]}</h2><span class="sm-lt" data-lt="${c[0]}"></span><b class="sm-cnt" data-cnt="${c[0]}" aria-label="0 cards">0</b></header>
      <div class="sm-list" data-list="${c[0]}"></div><button type="button" class="sm-older" data-older="${c[0]}" aria-expanded="false" hidden></button></section>`).join("")}</div></div>
    <div class="sm-quiet" id="sm-quiet"><span class="sm-qt" aria-live="polite"></span><ul class="sm-holds" id="sm-holds" hidden></ul></div>
    <div class="card sp-card sm-none" id="sm-none" hidden><span class="sm-none-i">${ic("video")}</span><b>No samples yet</b><p>When a lead says yes to a free Short, it lands in <em class="sf">Said yes</em> and moves across on its own as the Samples sheet syncs.</p></div>
  </div>`;
}

function asof(m) {
  const sp = document.querySelector("#spage .sp-h"); if (!sp) return;
  let el = document.getElementById("sm-asof"); if (!el) { el = document.createElement("span"); el.id = "sm-asof"; el.className = "sp-src sm-asof"; sp.append(el); }
  const a = m.asof, t = a.at ? `as of ${dayOf(a.at) === dayOf(Date.now()) ? "" : fD.format(a.at) + ", "}${fT.format(a.at)}` : "sync time unknown";
  el.classList.toggle("old", a.old); el.title = a.live ? "The newest change in the samples list arrived live at this time (the page checks for changes every minute)" : a.src ? `The board comes from the Samples sheet, synced about every hour${a.old ? `. The last sync is older than ${a.max} min: cards may be out of date` : ""}` : "Newest change in the samples list";
  el.innerHTML = `<i></i>Samples sheet · ${esc(t)}${a.old ? " · out of date" : ""}`;
}

/* tiles: big numbers that count up once (the first paint); later refreshes just set them */
function tiles(m) {
  const T = m.tiles, el = root(), set = (k, v) => { const n = el.querySelector(`.sm-n[data-t="${k}"]`); if (!n) return; n.dataset.v = v; if (CU_DONE || !motion() || !/^\d+$/.test(String(v))) n.textContent = v; };
  set("today", T.today); set("pct", T.pct == null ? "—" : T.pct); set("sent", T.sent);
  el.querySelector('[data-u="pct"]').textContent = T.pct == null ? "" : "%";
  el.querySelector('[data-ts="today"]').textContent = T.today === 1 ? "sample ready or sent today" : "samples ready or sent today";
  el.querySelector('[data-ts="pct"]').textContent = T.sent ? `${T.won} of ${T.sent} sent samples paid` : "no sample sent yet";
  el.querySelector('[data-ts="sent"]').textContent = `${T.sent === 1 ? "sample" : "samples"} sent, all time${T.sent ? ` · ${T.week} this week` : ""}`;
  const mx = Math.max(1, ...T.days), sp = el.querySelector(".sm-spark"); sp.title = `Built per day, last 14 days: ${T.days.join(", ")}`;
  const bars = () => [...sp.children].forEach((b, i) => { b.style.setProperty("--h", (T.days[i] / mx).toFixed(3)); b.classList.toggle("now", i === 13); b.classList.toggle("z", !T.days[i]); });
  if (CU_DONE || !motion()) bars(); else requestAnimationFrame(() => requestAnimationFrame(bars));   // the first paint: the bars grow up
  const mi = el.querySelector(".sm-meter i"), w = String((T.pct || 0) / 100); if (CU_DONE || !motion()) mi.style.setProperty("--w", w); else requestAnimationFrame(() => requestAnimationFrame(() => mi.style.setProperty("--w", w)));
  if (!CU_DONE) { CU_DONE = true; if (motion()) countUp(el); }
}
function countUp(el) {
  const ns = [...el.querySelectorAll(".sm-n")].filter(n => /^\d+$/.test(n.dataset.v || "")), t0 = performance.now(), dur = 900;
  const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); ns.forEach(n => { n.textContent = Math.round(+n.dataset.v * e); }); if (k < 1 && el.isConnected) requestAnimationFrame(step); else ns.forEach(n => { n.textContent = n.dataset.v; }); };
  requestAnimationFrame(step);
}

/* ---------------- the board ---------------- */
function paint() {
  const el = root(); if (!el) return;
  const m = model(); if (!m) return; M = m; asof(m); tiles(m);
  const now = Date.now(), anim = !FIRST && motion(), was = LAST, before = new Map();
  if (anim) NODES.forEach((n, k) => { if (n.el.isConnected) before.set(k, n.el.getBoundingClientRect()); });
  const live = new Set();
  COLS.forEach(([id, , , none]) => {
    const all = m.by[id], recent = all.filter(c => !c.old), older = all.filter(c => c.old), pool = OPEN.has(id) ? recent.concat(older) : recent, lim = LIM[id] || CAP, show = pool.slice(0, lim);
    const list = el.querySelector(`[data-list="${id}"]`), els = show.map(c => { live.add(c.k); return cardEl(c, now); });
    if (els.length !== list.children.length || els.some((x, i) => list.children[i] !== x)) list.replaceChildren(...els);
    if (!els.length) list.innerHTML = `<p class="sm-empty">${esc(none)}${older.length ? `<small>in the last ${FOLD_DAYS} days</small>` : ""}</p>`;
    const nl = all.filter(c => c.late).length; el.querySelector(`[data-lt="${id}"]`).textContent = nl ? `${nl} late` : "";   // shown only where the header has room (CSS)
    /* the header counts the column's 14-day window; "12 of 40" when the cap hides some of them */
    const vis = Math.min(show.length, recent.length), cnt = el.querySelector(`[data-cnt="${id}"]`);
    cnt.textContent = vis < recent.length ? `${vis} of ${recent.length}` : recent.length;
    cnt.setAttribute("aria-label", `${vis < recent.length ? `${vis} shown of ` : ""}${recent.length} card${recent.length === 1 ? "" : "s"} in the last ${FOLD_DAYS} days`);
    const tc = el.querySelector(`[data-tc="${id}"]`); if (tc) tc.textContent = recent.length;
    /* one button under the column: 12 more at a time, then the older ones (12 at a time too), then hide them again */
    const ob = el.querySelector(`[data-older="${id}"]`), more = pool.length - show.length;
    const [act, txt] = more > 0 ? ["more", `Show ${Math.min(CAP, more)} more`] : !OPEN.has(id) && older.length ? ["older", `Show older (${older.length})`] : OPEN.has(id) && older.length ? ["hide", `Hide older (${older.length})`] : ["", ""];
    ob.hidden = !act; ob.dataset.do = act; ob.textContent = txt; ob.setAttribute("aria-expanded", OPEN.has(id));
  });
  NODES.forEach((n, k) => { if (!live.has(k)) { n.el.remove(); NODES.delete(k); } });
  watchImgs(el);
  /* the quiet line: "N on hold" opens a plain list of the held people (name + show; a row opens the lead), then lost and done */
  const q = m.quiet, nh = q.held.length, qe = el.querySelector("#sm-quiet"), hl = el.querySelector("#sm-holds"); if (!nh) HOLDS_OPEN = false;
  const parts = [nh ? `<button type="button" class="sm-hb" data-holds aria-expanded="${HOLDS_OPEN}" aria-controls="sm-holds">${nh} on hold</button>` : "", q.lost ? `${q.lost} lost` : "", q.done ? `${q.done} done` : ""].filter(Boolean);
  const qh = parts.join(" · "), qt = qe.querySelector(".sm-qt"); if (qt.innerHTML !== qh) qt.innerHTML = qh; qe.hidden = !parts.length;
  const lh = q.held.map(h => `<li><button type="button" data-act="lead" data-email="${esc(h.k)}"><b>${esc(h.name)}</b>${h.show ? `<span>${esc(h.show)}</span>` : ""}</button></li>`).join("");
  if (hl.innerHTML !== lh) hl.innerHTML = lh; hl.hidden = !HOLDS_OPEN;
  el.querySelector("#sm-none").hidden = !!m.total; el.querySelector(".sm-wrap").hidden = !m.total; el.querySelector(".sm-tabs").hidden = !m.total;

  /* live moments: cards whose column changed since the last paint */
  const movers = was ? m.cards.filter(c => was.has(c.k) && was.get(c.k) !== c.col).map(c => c.k) : [];
  LAST = new Map(m.cards.map(c => [c.k, c.col]));
  if (FIRST) { FIRST = false; entrance(el); }
  else {
    if (anim) flip(before, new Set(movers));
    if (motion()) movers.forEach(k => { const n = NODES.get(k); if (n && n.el.isConnected) glow(n.el); });
    movers.forEach(k => { if (LAST.get(k) === "paid" && !CELEB.has(k)) { CELEB.add(k); if (motion() && X() && X().confetti) X().confetti(); } });
    if (movers.length) el.dispatchEvent(new CustomEvent("sm:moved", { detail: movers, bubbles: true }));
  }
  if (PAN) panelRefresh();
}

/* the first paint: tiles rise, then the cards ripple in column by column (CSS, --n = place in that ripple) */
function entrance(el) {
  if (!motion()) return;
  COLS.forEach(([id], ci) => [...el.querySelectorAll(`[data-list="${id}"] > .sm-card`)].forEach((c, ri) => c.style.setProperty("--n", Math.min(ci + ri * 2, 20))));
  el.classList.add("sm-in"); setTimeout(() => { el.classList.remove("sm-in"); el.querySelectorAll(".sm-card").forEach(c => c.style.removeProperty("--n")); }, 1500);
}
/* FLIP: every card that changed place starts where it was and slides home on the compositor. A card that changed COLUMN travels on a
   short arc, lifted, with a directional motion streak (a pre-blurred layer behind it: only its opacity and scale animate) */
function flip(before, movers) {
  const after = new Map(); NODES.forEach((n, k) => { if (before.has(k) && n.el.isConnected) after.set(k, n.el.getBoundingClientRect()); });
  after.forEach((r, k) => {
    const b = before.get(k), dx = b.left - r.left, dy = b.top - r.top, el = NODES.get(k).el; if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    if (movers.has(k)) {
      const dist = Math.hypot(dx, dy), lift = Math.min(36, 10 + dist / 14), dur = Math.round(Math.min(900, 560 + dist / 3));
      el.classList.add("sm-fly"); el.classList.toggle("sm-back", dx > 0); el.style.setProperty("--dir", dx > 0 ? 1 : -1);   // the streak trails behind: to the left when the card travels right
      const a = el.animate([{ transform: `translate(${dx}px,${dy}px) scale(1)` }, { transform: `translate(${dx * .45}px,${dy * .45 - lift}px) scale(1.045)`, offset: .45 }, { transform: "translate(0,0) scale(1)" }],
        { duration: dur, easing: "cubic-bezier(.3,.7,.2,1)" });
      el.style.setProperty("--fly", dur + "ms");
      a.onfinish = a.oncancel = () => { el.classList.remove("sm-fly", "sm-back"); el.style.removeProperty("--dir"); el.style.removeProperty("--fly"); };
    } else el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "translate(0,0)" }], { duration: 420, easing: "cubic-bezier(.16,1,.3,1)" });
  });
}
function glow(el) { el.classList.remove("sm-glow"); void el.offsetWidth; el.classList.add("sm-glow"); el.dataset.glow = +(el.dataset.glow || 0) + 1; setTimeout(() => el.classList.remove("sm-glow"), 2400); }

/* ---------------- phone: stage tabs + swipe (scroll-snap) ---------------- */
function tabTo(i, smooth) {
  const b = document.getElementById("sm-board"), col = b && b.children[i]; if (!col) return;
  b.scrollTo({ left: col.offsetLeft - b.offsetLeft - (b.firstElementChild.offsetLeft - b.offsetLeft), behavior: smooth && motion() ? "smooth" : "auto" });
  setTab(i);
}
function setTab(i) {
  if (i === TAB && document.querySelector('.sm-tab[aria-selected="true"]')?.dataset.tab === String(i)) return;
  TAB = i; document.querySelectorAll(".sm-tab").forEach(t => { const on = +t.dataset.tab === i; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; if (on) { const s = t.parentElement; s.scrollTo({ left: t.offsetLeft - (s.clientWidth - t.offsetWidth) / 2, behavior: motion() ? "smooth" : "auto" }); } });
}

/* ---------------- the sample panel ---------------- */
const STEPS = [["Said yes", p => ms(p.yes_at)], ["Ready", p => ms(p.public_at)], ["Sent", p => ms(p.delivered_at)], ["Replied", p => ms(p.last_reply_at)], ["Paid", p => up(p.status) === "WON" ? wonAt(p) || -1 : 0]];   // the won date parsed from "paid" (see wonAt)
function history(c) {
  const p = c.p;
  return `<ol class="sm-hist">${STEPS.map(([l, f]) => { const t = f(p), on = t !== 0; return `<li class="${on ? "on" : ""}"><i aria-hidden="true"></i><b>${l}</b><small>${t > 0 ? esc(when(t)) : on ? "paid" : "—"}</small></li>`; }).join("")}</ol>`;
}
function statusLine(c) {
  const p = c.p, now = Date.now(), col = COLS.find(x => x[0] === c.col)[1], na = ms(p.next_action_at);
  const bits = [`<span class="chip b">${esc(col)}${TAG[c.s] ? ` · ${esc(TAG[c.s])}` : ""}</span>`, c.t ? `<span>${esc(span(now - c.t))} in this stage</span>` : "",
    c.late ? `<span class="chip r">Late · ${esc(span(c.lateBy + LATE_H * H))} since the yes</span>` : "", c.hot ? `<span class="chip o">Hot</span>` : "",
    c.owner ? `<span>Owner ${c.owner === "S" ? "Simas" : "Benas"}</span>` : "", p.builder ? `<span>Built by ${esc(p.builder)}</span>` : ""].filter(Boolean);
  return `<div class="sm-st">${bits.join('<i class="sm-dot" aria-hidden="true"></i>')}</div>${p.next_action ? `<p class="sm-pnx"><b>Next</b> ${esc(p.next_action)}${na ? ` <span class="${na < now ? "dn" : "mut"}">· ${na < now ? `${esc(span(now - na))} late` : `due ${esc(when(na))}`}</span>` : ""}</p>` : ""}`;
}
const BRIEF = [["busyness", "Graphics level"], ["captions", "Captions"], ["cta", "Call to action"], ["brand", "Brand"], ["dream_short", "Dream Short"], ["part_ts", "Part to use"]];
function briefHTML(c) {
  const b = c.brief; if (!b) return `<p class="sm-pe">No brief form yet.</p>`;
  const rows = BRIEF.filter(([k]) => b[k] != null && String(b[k]).trim()).map(([k, l]) => { const v = String(b[k]).trim(), u = webUrl(v); return `<div class="sm-kv"><dt>${l}</dt><dd>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(v.length > 60 ? v.slice(0, 59) + "…" : v)}</a>` : esc(v.length > 600 ? v.slice(0, 599) + "…" : v)}</dd></div>`; });
  return `<dl class="sm-brief">${rows.join("") || `<div class="sm-kv"><dt>Answers</dt><dd>none stored</dd></div>`}</dl>${b.submitted_at ? `<p class="sm-pe">Form sent ${esc(when(ms(b.submitted_at)))}</p>` : ""}`;
}
/* 11-23 (SIMAS): "when it's Ready, we review it, the email you'd send is attached, a Send button sends it to the lead at once, and a box for
   revisions or what to change in the email". The email is a public.drafts row (category sample) a Claude created; Send = the founder's
   approval of the exact text on screen (sha256, same rule as the approvals card); draft-sender sends it within a minute with its thread
   checks. "What to change" holds the draft with the note, and the Claude that drafted it is woken to fix the video or the email. */
const EM_ST = { pending: "", held: "Sent back with changes. Claude is on it; it comes back here when fixed.", approved: "Approved. It goes out within a minute.", sending: "Sending now.",
  failed: "Not sent: Instantly refused it. Read the reason, then send again or close it.", stale: "Not sent: the lead wrote again after this was drafted. Claude redrafts it.", unknown: "Unclear if it went out. Check Instantly before anything else." };
function emailHTML(c) {
  const d = c.draft;
  if (!d) return `<h3>Delivery email</h3><p class="sm-pe">${c.col === "ready" ? "No email drafted yet. Claude adds it here when the Short is ready." : "No delivery email waiting."}</p>`;
  const st = d.status, can = /^(pending|held|failed|stale)$/.test(st), edit = /^(pending|held)$/.test(st);
  return `<h3>Delivery email</h3>
    <p class="sm-emh"><span>From <b>${esc(d.inbox)}</b></span><span>To <b>${esc([d.to_email, ...(d.cc_list || [])].join(", "))}</b></span></p>
    ${autoTxt(d) ? `<p class="sm-ems timer"><b>${esc(autoTxt(d))}</b> unless you send it, edit it or send it back. An edit restarts the 30 minutes.</p>` : ""}
    ${EM_ST[st] ? `<p class="sm-ems ${st}">${esc(EM_ST[st])}${d.error && /^(failed|unknown|stale)$/.test(st) ? ` <small>${esc(String(d.error).slice(0, 200))}</small>` : ""}</p>` : ""}
    ${d.founder_note ? `<p class="sm-emn"><b>Your note</b> ${esc(d.founder_note)}</p>` : ""}
    <pre class="sm-emb" id="sm-emb">${esc(d.body)}</pre>
    <div class="sm-emed" id="sm-emed" hidden><textarea class="sm-emta" id="sm-emta" rows="10" aria-label="Edit the email"></textarea><div class="acts sm-pacts"><button type="button" class="act go" data-em="save">${ic("check")}Save</button><button type="button" class="act" data-em="cancel">Cancel</button></div></div>
    <div class="sm-emch" id="sm-emch" hidden><label class="sm-eml" for="sm-chta">What should change? The video, the email, or both.</label><textarea class="sm-emta" id="sm-chta" rows="4" maxlength="1000" placeholder="e.g. start on the second sentence; make the captions bigger; drop the last line of the email"></textarea><div class="acts sm-pacts"><button type="button" class="act go" data-em="back">${ic("send")}Send to Claude</button><button type="button" class="act" data-em="cancel">Cancel</button></div></div>
    <p class="sm-emerr" id="sm-emerr" role="alert" hidden></p>
    ${can ? `<div class="acts sm-pacts sm-emacts" id="sm-emacts"><button type="button" class="act go" data-em="send">${ic("send")}Send</button>${edit ? `<button type="button" class="act" data-em="edit">${ic("edit")}Edit</button>` : ""}<button type="button" class="act" data-em="change">${ic("refresh")}What to change</button></div>` : ""}`;
}
async function emailOp(op, btn) {
  const C = X(), c = M && PAN && M.cards.find(x => x.k === PAN.k), d = c && c.draft, pan = PAN && PAN.pan; if (!C || !d || !pan) return;
  const $p = q => pan.querySelector(q), err = $p("#sm-emerr"), say = m => { err.hidden = false; err.textContent = m; }; err.hidden = true;
  const show = w => { $p("#sm-emed").hidden = w !== "edit"; $p("#sm-emch").hidden = w !== "change"; $p("#sm-emb").hidden = w === "edit"; const a = $p("#sm-emacts"); if (a) a.hidden = !!w; };
  if (op === "edit") { show("edit"); const t = $p("#sm-emta"); t.value = d.body; t.focus(); return; }
  if (op === "change") { show("change"); $p("#sm-chta").focus(); return; }
  if (op === "cancel") { show(""); return; }
  let body = null, done = "";
  if (op === "send") {
    /* read the email fresh first: if Claude changed it since this panel painted, show the new text and ask to read it */
    if (C.drafts) { const before = d.body_sha256; await C.drafts().catch(() => {}); const c2 = M && M.cards.find(x => x.k === PAN.k), d2 = c2 && c2.draft;
      if (!d2 || d2.id !== d.id || d2.body_sha256 !== before || d2.status !== d.status) { const em = pan.querySelector("#sm-pem"); if (em && c2) em.innerHTML = emailHTML(c2); const e2 = pan.querySelector("#sm-emerr"); if (e2) { e2.hidden = false; e2.textContent = "This email just changed. Read the new version, then press Send."; } return; } }
    const shown = $p("#sm-emb").textContent;
    if (shown !== String(d.body).replace(/\r\n?/g, "\n")) return say("The email on screen is not the saved one any more. Close this and open it again.");
    const r = await C.ask({ title: `Send this to ${c.p.name || c.k}?`, warn: `It goes out within a minute from ${d.inbox} to ${[d.to_email, ...(d.cc_list || [])].join(", ")}, word for word.`, sees: shown, cta: "Send it" }); if (!r) return;
    body = { status: "approved", approved_sha256: await C.sha256hex(d.body) }; done = "Sending. It goes out within a minute.";
  } else if (op === "save") {
    const v = $p("#sm-emta").value; if (!v.trim()) return say("The email can't be empty.");
    body = { body: v, ...(d.status === "pending" ? {} : { status: "pending" }) }; done = "Saved. Read it once more, then send.";
  } else if (op === "back") {
    const v = $p("#sm-chta").value.trim(); if (!v) return say("Write what should change first.");
    body = { status: "held", founder_note: v.slice(0, 1000) }; done = "Sent to Claude. The fixed version comes back here.";
  }
  if (!body) return; if (btn) btn.disabled = true;
  try { await C.upd("drafts", +d.id, body); C.toast(done, "check", "c-green", c.p.name || c.k); show(""); await (C.drafts ? C.drafts() : C.refresh()); }
  catch (e) { say(String(e && e.message || e)); if (btn && btn.isConnected) btn.disabled = false; }
}
function videoHTML(c) {
  const nm = c.p.name || c.k;
  if (c.id) return `<div class="sm-vf"><iframe class="sm-frame" src="${esc(frameUrl(c.id))}" title="Sample video: ${esc(nm)}" allow="autoplay; fullscreen" allowfullscreen referrerpolicy="no-referrer"></iframe></div>`;
  return `<div class="sm-vf sm-nov" data-col="${c.col}"><span class="sm-nov-i">${ic("video")}</span><b>No video yet</b><small>${c.col === "build" ? "In edit. The Short shows here once its file is in Drive." : "The Short shows here once its file is in Drive."}</small></div>`;
}
function openPanel(k, opener) {
  const c = M && M.cards.find(x => x.k === k); if (!c) return; closePanel(true);
  const p = c.p, nm = p.name || p.email || k, link = c.id ? `https://drive.google.com/file/d/${encodeURIComponent(c.id)}/view` : webUrl(p.drive_link);
  const scrim = document.createElement("div"); scrim.className = "sm-scrim"; scrim.id = "sm-scrim";
  const pan = document.createElement("aside"); pan.className = "sm-pan"; pan.id = "sm-pan"; pan.setAttribute("role", "dialog"); pan.setAttribute("aria-modal", "true"); pan.setAttribute("aria-labelledby", "sm-pt"); pan.dataset.k = k;
  pan.innerHTML = `<div class="sm-pv">${videoHTML(c)}</div>
    <div class="sm-pd"><header class="sm-phd"><div class="sm-phh"><h2 id="sm-pt">${esc(nm)}</h2><p class="mut">${esc([p.show, p.email].filter(Boolean).join(" · "))}</p></div><button type="button" class="icon-btn sm-x" id="sm-x" aria-label="Close"><svg><use href="#i-x"/></svg></button></header>
      <div class="sm-psec" id="sm-pst">${statusLine(c)}${history(c)}</div>
      <section class="sm-psec sm-em" id="sm-pem">${emailHTML(c)}</section>
      <section class="sm-psec"><h3>Brief</h3><div id="sm-pbr">${briefHTML(c)}</div></section>
      <section class="sm-psec" id="sm-pconv"><h3>Conversation</h3><div class="skl-list conv" aria-label="Loading the thread"><i></i><i></i><i></i></div></section>
      <div class="acts sm-pacts"><button type="button" class="act go" data-act="lead" data-email="${esc(k)}">${ic("user")}Open the lead</button>${link ? `<a class="act" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${ic("link")}Open in Drive</a>` : ""}</div></div>`;
  document.body.append(scrim, pan);
  PAN = { k, opener: opener || null, pan, scrim };
  HTML.classList.add("sm-locked");
  requestAnimationFrame(() => { scrim.classList.add("on"); pan.classList.add("on"); });
  pan.querySelector("#sm-x").focus({ preventScroll: true });
  scrim.addEventListener("click", () => closePanel());
  pan.querySelector("#sm-x").addEventListener("click", () => closePanel());
  pan.addEventListener("click", ev => { const b = ev.target.closest("[data-em]"); if (b) emailOp(b.dataset.em, b); });
  const C = X(); if (C && C.loadConv) C.loadConv([p.email || k]).then(msgs => { if (!PAN || PAN.k !== k) return; const s = pan.querySelector("#sm-pconv"); s.innerHTML = `<h3>Conversation</h3>${C.convBlock(msgs, "sm", "No email conversation synced for this address yet.")}`; })
    .catch(() => { const s = PAN && PAN.k === k && pan.querySelector("#sm-pconv"); if (s) s.innerHTML = `<h3>Conversation</h3><p class="sm-pe">Couldn't load the thread. Close and open the sample again.</p>`; });
}
function panelRefresh() {   // a data refresh while the panel is open: its status line and history follow; the video and the thread stay
  const c = M && M.cards.find(x => x.k === PAN.k), s = PAN.pan.querySelector("#sm-pst"); if (!c || !s) return;
  const h = statusLine(c) + history(c); if (s.innerHTML !== h) s.innerHTML = h;
  const em = PAN.pan.querySelector("#sm-pem"), busy = em && [...em.querySelectorAll("#sm-emed,#sm-emch")].some(x => !x.hidden), eh = emailHTML(c);
  if (em && !busy && em.innerHTML !== eh) em.innerHTML = eh;
  const b = PAN.pan.querySelector("#sm-pbr"), bh = briefHTML(c); if (b && b.innerHTML !== bh) b.innerHTML = bh;
}
function closePanel(quick) {
  if (!PAN) return; const { pan, scrim, k } = PAN; PAN = null; HTML.classList.remove("sm-locked");
  const gone = () => { pan.remove(); scrim.remove(); };
  if (quick || !motion()) gone(); else { pan.classList.remove("on"); scrim.classList.remove("on"); pan.classList.add("out"); setTimeout(gone, 380); }
  if (!quick) { const n = NODES.get(k); if (n && n.el.isConnected) n.el.focus({ preventScroll: false }); }
}
const otherLayer = () => !!document.querySelector("#drawer:not([hidden]), #veil:not([hidden]), #pal:not([hidden]), #dlg:not([hidden])");
document.addEventListener("keydown", ev => {
  if (!PAN || otherLayer()) return;
  if (ev.key === "Escape") { ev.preventDefault(); ev.stopImmediatePropagation(); closePanel(); return; }
  if (ev.key === "Tab") {   // keep the focus inside the panel
    const f = [...PAN.pan.querySelectorAll('button:not([disabled]),a[href],input,iframe,[tabindex="0"]')].filter(x => x.offsetParent !== null); if (!f.length) return;
    const a = document.activeElement, first = f[0], last = f[f.length - 1];
    if (!PAN.pan.contains(a)) { ev.preventDefault(); first.focus(); } else if (ev.shiftKey && a === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && a === last) { ev.preventDefault(); first.focus(); }
  }
}, true);

/* ---------------- wiring ---------------- */
function wire(api) {
  A = api; const el = root(); if (!el) return;
  closePanel(true); NODES.clear(); OPEN.clear(); LIM = {}; HOLDS_OPEN = false; LAST = null; FIRST = true; CU_DONE = false; TAB = 0;   // a new visit: no glide, no glow, numbers count up once
  paint();
  el.addEventListener("click", ev => {
    const card = ev.target.closest(".sm-card"); if (card) { openPanel(card.dataset.k, card); return; }
    const ob = ev.target.closest("[data-older]"); if (ob) { const id = ob.dataset.older, rc = M ? M.by[id].filter(c => !c.old).length : 0;
      if (ob.dataset.do === "more") LIM[id] = (LIM[id] || CAP) + CAP; else if (ob.dataset.do === "older") { OPEN.add(id); LIM[id] = rc + CAP; } else { OPEN.delete(id); LIM[id] = CAP; }
      paint(); if (!ob.hidden) ob.focus(); else el.querySelector(`[data-list="${id}"] .sm-card:last-child`)?.focus(); return; }
    const hb = ev.target.closest("[data-holds]"); if (hb) { HOLDS_OPEN = !HOLDS_OPEN; paint(); el.querySelector("[data-holds]")?.focus(); return; }
    const t = ev.target.closest(".sm-tab"); if (t) tabTo(+t.dataset.tab, true);
  });
  el.querySelector(".sm-tabs").addEventListener("keydown", ev => { if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return; ev.preventDefault(); const i = Math.max(0, Math.min(COLS.length - 1, TAB + (ev.key === "ArrowRight" ? 1 : -1))); tabTo(i, true); document.getElementById("sm-tab-" + COLS[i][0]).focus(); });
  /* a Drive thumbnail that fails (private file, removed, offline): the designed placeholder, and never asked for again this session */
  el.addEventListener("error", ev => { const img = ev.target; if (!img.classList || !img.classList.contains("sm-img")) return; FAILED.add(img.dataset.id); const th = img.closest(".sm-th"); img.remove(); if (th) { th.classList.add("ph"); const s = th.querySelector(".sm-ph small"); if (s) s.textContent = "Preview not available"; } }, true);
  el.addEventListener("load", ev => { const img = ev.target; if (!img.classList || !img.classList.contains("sm-img") || !img.naturalWidth) return; LOADED.add(img.dataset.id); img.closest(".sm-th")?.classList.remove("ph"); }, true);   // the frame replaces the placeholder only once it has really arrived
  const b = el.querySelector("#sm-board"), wrap = el.querySelector(".sm-wrap"); let raf = 0;
  const edges = () => { const ph = PHONE.matches, max = b.scrollWidth - b.clientWidth; wrap.classList.toggle("fl", !ph && b.scrollLeft > 2); wrap.classList.toggle("fr", !ph && max - b.scrollLeft > 2); };
  b.addEventListener("scroll", () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; edges(); if (!PHONE.matches) return; const w = b.firstElementChild ? b.firstElementChild.getBoundingClientRect().width + 16 : 1; setTab(Math.max(0, Math.min(COLS.length - 1, Math.round(b.scrollLeft / w)))); }); }, { passive: true });
  new ResizeObserver(edges).observe(b); edges();
}
addEventListener("beju-crm:data", () => { if (root()) paint(); });
setInterval(() => { if (root() && M && M.cards.some(c => autoLeft(c.draft) != null)) paint(); }, 30e3);   // 11-23: the "Sends in N min" countdown
/* the side page rerenders on its 5-minute timer only without [data-keep]; this page keeps its nodes and repaints from crm.js's refresh */
addEventListener("popstate", () => { if (PAN && !root()) closePanel(true); });
new MutationObserver(() => { if (PAN && !root()) closePanel(true); }).observe(document.getElementById("spage") || document.body, { childList: true });

const ready = () => { const C = X(); return C && C.raw; };
(window.BEJU_SIDE_PAGES = window.BEJU_SIDE_PAGES || {}).samples = {
  title: "Samples",
  head: ["Free <em class=\"sf\">samples</em>", "Every free Short from the yes to the payment. Cards move on their own when the Samples sheet syncs."],
  src: () => null,
  load: () => ready() ? Promise.resolve({}) : new Promise(res => addEventListener("beju-crm:data", () => res({}), { once: true })),
  view, wire,
};
})();
