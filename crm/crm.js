/* BEJÚ founder CRM: bento dashboard v2 (2026-11-12, Simas).
   Reads the CRM database; the ONLY writes are the client-portal actions in pOp() (sample_requests, videos,
   video_versions, video_notes.done_at, purchases), the same writes scripts/portal_ops.py makes. Nothing else is written.
   11-21 (BENAS, PR #9): plus the founder's decision on a lane-3 draft (public.drafts: status, body, founder_note, approved_sha256) in draftOp();
   the drafts_guard trigger enforces every rule (2-step founder session, approve only the exact text shown, nothing while sending).
   Data is protected by row-level security (is_admin() on every CRM table); the sign-in gate here is only UX.
   CSP forbids inline styles, so every dynamic size goes through data-v="name:value" -> style.setProperty. */
(() => {
"use strict";
const CFG = window.BEJU_CRM || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"'`]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" }[c]));
const TZ = CFG.timezone || "Europe/Vilnius";
const GOAL = +CFG.monthlyGoal || 10000;
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const HOVER = matchMedia("(hover: hover) and (pointer: fine)").matches;
const PHONE = matchMedia("(max-width: 600px)"), COARSE = matchMedia("(pointer: coarse)").matches;
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sum = (a, f) => a.reduce((s, x) => s + (+f(x) || 0), 0);
const lc = s => String(s || "").toLowerCase().trim();
const cut = (s, n) => { s = String(s ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const ON_SITE = /(^|\.)bejucreative\.digital$/i.test(location.hostname);
const SITE = ON_SITE ? "/" : "https://bejucreative.digital/", PORTAL_HOME = ON_SITE ? "/portal/" : "https://bejucreative.digital/portal/", PORTAL = PORTAL_HOME + "?view=portal";   // ?view=portal: the portal sends a founder to /crm/ unless the founder asks for the portal
const PORTAL_ON = false;   // 11-21 (founders): client portal hidden in the CRM (top bar, account menu, ⌘K, wait screen); code kept, true brings the links back
/* looks: id, name, mode, browser bar colour, one-line description. theme.js applies the saved one before the first paint. */
const THEMES = [["frost", "Frost", "light", "#eef1f8", "Bright white glass"], ["graphite", "Graphite", "dark", "#0b0c0e", "Neutral dark glass"], ["forest", "Forest", "dark", "#070805", "BEJÚ brand green"], ["ocean", "Ocean", "dark", "#041226", "Deep blue glass"], ["sunset", "Sunset", "dark", "#1a0e16", "Warm peach and rose"]];
const lookOf = () => THEMES.find(t => t[0] === document.documentElement.dataset.theme) || THEMES[0];
const motionFull = () => document.documentElement.dataset.motion !== "calm";

/* ---------------- dates (all in CFG.timezone) ---------------- */
const fParts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const parts = t => Object.fromEntries(fParts.formatToParts(new Date(t)).map(p => [p.type, p.value]));
const dayOf = t => { if (!t) return ""; const p = parts(t); return `${p.year}-${p.month}-${p.day}`; };   // timestamp -> YYYY-MM-DD
const timeOf = t => { const p = parts(t); return `${p.hour === "24" ? "00" : p.hour}:${p.minute}`; };
const hourOf = t => +parts(t).hour % 24;
const today = () => dayOf(Date.now());
const addDays = (d, n) => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dow = d => new Date(d + "T12:00:00Z").getUTCDay();
const DOW = ["S", "M", "T", "W", "T", "F", "S"], DOWL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dLabel = d => d ? `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}` : "—";
const dLong = d => d ? `${DOWL[dow(d)]} ${dLabel(d)}` : "—";
const fDT = t => t ? `${dLabel(dayOf(t))}, ${timeOf(t)}` : "—";
const ago = t => { if (!t) return "never"; const m = Math.max(0, Math.round((Date.now() - new Date(t)) / 6e4)); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
const rel = t => { const m = Math.max(0, Math.round((Date.now() - t) / 6e4)); return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : m < 1440 * 14 ? `${Math.round(m / 1440)}d` : dLabel(dayOf(t)); };
const dueIn = t => { if (!t) return null; const h = (new Date(t) - Date.now()) / 36e5, a = Math.abs(h), txt = a < 1 ? `${Math.max(1, Math.round(a * 60))} min` : a < 48 ? `${Math.round(a)} h` : `${Math.round(a / 24)} d`; return { late: h < 0, txt: h < 0 ? `${txt} late` : `due in ${txt}` }; };
const daysInMonth = d => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 0)).getUTCDate();
const monday = d => addDays(d, -((dow(d) + 6) % 7));
const nowIso = () => new Date().toISOString();
const fmtMin = m => m == null || !isFinite(m) ? "—" : m < 60 ? `${Math.max(1, Math.round(m))} min` : m < 1440 ? `${(m / 60).toFixed(1)} h` : `${(m / 1440).toFixed(1)} d`;
const med = a => { const s = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

/* ---------------- numbers ---------------- */
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const usd = v => "$" + nf0.format(Math.round(+v || 0));
const FMT = { int: v => nf0.format(Math.round(v)), usd: v => "$" + nf0.format(Math.round(v)), pct: v => Math.round(v) + "%", pct1: v => (Math.round(v * 10) / 10).toFixed(1) + "%", h1: v => (Math.round(v * 10) / 10).toFixed(1) + " h" };
const N = (v, f = "int") => v == null || !isFinite(v) ? "—" : `<span class="n" data-n="${+v}" data-f="${f}">${FMT[f](+v)}</span>`;
const PREV = new Map();
function countUp(card) {
  $$(".n[data-n]", card.el).forEach((el, i) => {
    const key = card.id + ":" + i, to = +el.dataset.n, f = FMT[el.dataset.f] || FMT.int, had = PREV.has(key), from = had ? PREV.get(key) : 0;
    PREV.set(key, to);
    if (RM || from === to) { el.textContent = f(to); return; }
    el.textContent = f(from); if (had) el.classList.add("tick");   // 11-22 motion: a number that changed rolls up into place while it counts
    const t0 = performance.now(), dur = 900;
    const step = now => { const k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3); el.textContent = f(from + (to - from) * e); if (k < 1 && el.isConnected) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
function applyVars(root) {   // data-v="w:45%;k:2" -> CSS custom properties, one frame later so transitions run from 0
  const els = $$("[data-v]", root);
  els.forEach(el => el.dataset.v.split(";").forEach(pair => { const i = pair.indexOf(":"); if (i > 0 && /^(k|x|y|c|tx)$/.test(pair.slice(0, i))) el.style.setProperty("--" + pair.slice(0, i), pair.slice(i + 1)); }));
  const go = () => { els.forEach(el => el.dataset.v.split(";").forEach(pair => { const i = pair.indexOf(":"); if (i > 0) el.style.setProperty("--" + pair.slice(0, i), pair.slice(i + 1)); })); $$("[data-go]", root).forEach(el => el.classList.add("go")); };
  RM ? go() : requestAnimationFrame(() => requestAnimationFrame(go));
}

/* ---------------- state ---------------- */
let sb = null, ME = null, RAW = null, D = null, TIMER = null, LAST_OK = 0, OPENER = null, CH = null, RT = "off", RT_T = null, NAV = [], SEQ = 0;
const PLOT = {};   // interactive charts: id -> { n, i, paint(i), drill(i) }
const STATE = { owner: "All", period: "month", range: 14, att: "", day: "", hotAll: false, todayAll: false, q: "", sel: 0, sa: true, sb: true, rg: true, rp: true, hotSort: "wait", campSort: "sent", drill: null, pq: {} };
const must = async p => { const { data, error } = await p; if (error) throw error; return data; };
async function all(table, cols = "*", mod) {   // REST caps at 1,000 rows per call
  const out = [];
  for (let i = 0; ; i += 1000) { let q = sb.from(table).select(cols).range(i, i + 999); if (mod) q = mod(q); const rows = await must(q); out.push(...rows); if (rows.length < 1000) return out; }
}
/* 11-21 (SIMAS: "a square that says action … a payment, a new instantly reply, changes to the CRM"): the extra rows behind the Activity feed.
   Read-only. Every read fails soft, so a missing grant leaves a kind out instead of blanking the page. The small lookup tables
   (founder_tasks, desk_items, promises, opportunities) are read whole: audit_log update rows carry only the changed fields, not the title. */
function feedX() {
  const soft = q => must(q).catch(() => []), d14 = new Date(Date.now() - 14 * 864e5).toISOString();
  return Promise.all([
    soft(sb.from("audit_log").select("id,at,table_name,row_key,op,actor,changed").gte("at", d14).neq("table_name", "api_keys").order("at", { ascending: false }).limit(300)),
    soft(sb.from("founder_tasks").select("id,title")), soft(sb.from("desk_items").select("id,kind,client,title")),
    soft(sb.from("promises").select("id,lead_email,promise")), soft(sb.from("opportunities").select("id,client,email")),
    soft(sb.from("touches").select("id,lead_email,at,actor,call_uid").not("call_uid", "is", null).order("at", { ascending: false }).limit(100)),
    soft(sb.from("call_tasks").select("id,lead_email,text,done_at,done_by").not("done_at", "is", null).order("done_at", { ascending: false }).limit(100)),
    soft(sb.from("pack_overrides").select("client_id,order_name,status,set_by,set_at").not("set_at", "is", null)),
  ]).then(([audit, ft, desk, prom, opps, cnotes, ctasks, packs]) => ({ audit, ft, desk, prom, opps, cnotes, ctasks, packs }));
}
/* 11-23 (founder request 11-23): the reads the live updates repeat on their own (see "live: samples, deliveries, brief forms") */
const PIPE_READ = () => all("pipeline", "*", q => q.order("email"));
const DLV_READ = () => all("deliveries", "id,client_id,title,order_name,delivered_at", q => q.order("id"));
const BRIEF_COLS = "email,busyness,captions,cta,brand,dream_short,part_ts,submitted_at", FORMS_READ = () => all("form_leads_v2", "*");
async function fetchAll() {
  const t = today(), since60 = new Date(Date.now() - 60 * 864e5).toISOString(), since14 = new Date(Date.now() - 14 * 864e5).toISOString();
  const [pipeline, payments, daily, camps, replies, attention, fu, inboxes, todayItems, sync, deliveries, clients, promises, profiles, sampleReq, videos, purchases, vnotes, leadAdds, tlite, interested, cnotes, ftasks, retainers, calls, panels, desk, stages, nextSteps, forecast, fx, deals, drafts, dismiss, flags, forms, inb14, scopes, briefs, checks] = await Promise.all([
    PIPE_READ(),
    all("payments", "id,client_id,email,payer_name,amount,currency,package,refunded,paid_at", q => q.order("paid_at", { ascending: false })),
    all("campaign_daily", "campaign_id,day,sent,new_leads,replies,replies_auto,opportunities", q => q.gte("day", addDays(t, -75)).order("day").order("campaign_id")),
    all("campaign_live"),
    all("reply_queue", "lead_email,inbox,received_at,kind,answered,blocklisted,snippet", q => q.gte("received_at", since60).order("received_at", { ascending: false })),
    all("needs_attention"), all("fu_state"), all("inbox_live"),
    all("today_items", "*", q => q.eq("day", t)), all("sync_status"),
    DLV_READ(), all("clients", "id,name,emails,source,instagram"),
    all("promises", "*", q => q.eq("status", "open")),
    all("profiles", "id,name,email,is_admin,created_at,channel,sells,frequency,phone"),
    all("sample_requests", "*", q => q.order("created_at", { ascending: false })),
    all("videos", "id,user_id,purchase_id,title,notes,footage,status,result_url,created_at,delivered_at,due_at,version", q => q.order("created_at", { ascending: false })),
    all("purchases", "id,user_id,pack_id,videos,amount,created_at,expires_at"),
    all("video_notes", "id,video_id,user_id,at,text,created_at,round,done_at,parent_id,author_role,author_name", q => q.order("created_at", { ascending: false })),
    all("lead_adds", "day,tab,n", q => q.gte("day", addDays(t, -21))),
    all("threads", "lead_email,at,direction", q => q.order("at").order("msg_id")),   // light copy of every message: counts per lead + speed to reply
    all("interested_leads", "*", q => q.order("email")),   // 11-12: every lead Instantly marks Interested = hot
    all("client_notes", "lead_email,kind,note,noted_at,created_at").catch(() => []),   // 11-16: docs/clients/*.md notes (Paid clients + Hot leads pages)
    all("founder_tasks", "*", q => q.is("done_at", null).order("due_at", { ascending: true })).catch(() => []),   // 11-16: only what a founder must do (Do next)
    all("retainers", "*").catch(() => []),   // 11-17: Stripe subscriptions = retainer clients (crm_sync.py)
    all("calls", "*", q => q.gte("start_at", new Date(Date.now() - 30 * 864e5).toISOString()).order("start_at")).catch(() => []),   // 11-17: cal.com bookings = the only calls
    all("crm_panels", "id,data,updated_at", q => q.eq("id", "metrics")).catch(() => []),   // 11-19: outreach + money straight from the APIs (scripts/crm_panels_sync.py, every 15 min)
    all("desk_items", "*", q => q.eq("status", "open").order("created_at")).catch(() => []),   // 11-21: founder holds + what is being built right now (scripts/crm_desk.py)
    all("lead_stage", "*").catch(() => null),   // 11-21: each lead's stage from evidence (drawer chip, Pipeline card list)
    all("lead_next_step", "*").catch(() => null),   // 11-21: one next step per lead (drawer)
    must(sb.from("pipeline_forecast").select("*").order("ord")).catch(() => null),   // 11-21: leads and weighted $ per stage (Pipeline card)
    feedX(),   // 11-21: CRM changes, calls and to-dos for the Activity feed
    all("big_deals_v2", "*").catch(() => null),   // 11-22 (SIMAS "big deals is showing nonsense"): real quotes only = open opportunities with a value, sent scopes, the lead's own words naming a $600+/mo plan
    all("drafts_waiting", "*").catch(() => null),   // 11-21 (BENAS): lane-3 drafts for a founder (PR #9). Not live yet = null = the card hides
    all("reply_dismissals", "lead_email,received_at").catch(() => []),   // 11-21: "no reply needed" marks (Do next; needs_attention misses one stamped to the minute)
    all("lead_flags", "email,lost_reason,snoozed_until").catch(() => []),   // 11-21 (BENAS): lost / snoozed by a founder = out of Do next and Hot leads
    FORMS_READ().catch(() => null),   // 11-22 (SIMAS "lots of money sleeping there"): brief forms + how far each lead got
    all("threads", "lead_email,at,snippet", q => q.neq("direction", "out").gte("at", since14).order("at", { ascending: false })).catch(() => []),   // 11-22: their words, last 14 days (Hot leads)
    all("scopes", "email,offer,amount,currency,monthly,sent_at,paid_at,status,url", q => q.order("sent_at", { ascending: false })).catch(() => null),   // 11-22 (SIMAS "we should see the scope that u have sent them"): the Forms person sheet
    all("briefs", BRIEF_COLS).catch(() => null),   // 11-22 (BENAS, Samples page): the sample brief per lead (graphics level + answers); one small soft read, null = no brief marks
    all("tasks", "id,title,owner,status,lead_email,due_at,created_at,big", q => q.in("source", ["founder_tasks", "board", "deferred", "manual"]).eq("status", "todo").ilike("title", "check:%")).catch(() => []),   // 11-23 (BENAS, Waiting on a founder): "Check:" cards in To do on the To-dos board (its own sources) = Claude's work to approve
  ]);
  /* 11-21 (tracking check, from v7): Instantly's daily "unique opportunities" counts a lead again on each day it is active, so sums over days
     ran up to 1.9x too high. Positives per day come from interested_leads: one row per lead, on the day it was marked interested. */
  { const m = {}, seen = new Set(), lo = daily.length ? daily[0].day : "9999";
    interested.forEach(x => { const dd = dayOf(x.interest_changed_at || x.last_reply_at || x.created_at); if (!dd || !x.campaign_id) return; const k = x.campaign_id + "|" + dd; m[k] = (m[k] || 0) + 1; });
    if (interested.length) { daily.forEach(r => { const k = r.campaign_id + "|" + r.day; seen.add(k); r.opportunities = m[k] || 0; });
      Object.entries(m).forEach(([k, n]) => { const [campaign_id, day] = k.split("|"); if (!seen.has(k) && day >= lo) daily.push({ campaign_id, day, sent: 0, new_leads: 0, replies: 0, replies_auto: 0, opportunities: n }); }); } }
  return { pipeline, payments, daily, camps, replies, attention, fu, inboxes, todayItems, sync, deliveries, clients, promises, profiles, sampleReq, videos, purchases, vnotes, leadAdds, tlite, interested, cnotes, ftasks, retainers, calls, panels, desk, stages, nextSteps, forecast, fx, deals, drafts, dismiss, flags, forms, inb14, scopes, briefs, checks };
}

/* ---------------- derive ---------------- */
const ownerOfInbox = ib => /^(simas|simon|team|editor|studio)@/i.test(ib || "") ? "Simas" : /^(ben|benas|hello|official|info)@/i.test(ib || "") ? "Benas" : "";
const isBuyer = p => /^(WON|DONE)$/i.test(p.status || "") || !!(p.paid && String(p.paid).trim());
function mood(p) {
  const s = (p.status || "").toUpperCase(), f = (p.fu_stage || "").toLowerCase();
  if (isBuyer(p)) return "buyer";
  if (s === "LOST") return "lost";
  if (s === "HOT" || f === "said_yes") return "hot";
  if (f === "asked_price") return "asked";
  if (s === "REPLIED") return "talking";
  if (f === "thinking") return "thinking";
  if (f === "parked") return "quiet";
  if (/^(YES|CLAIMED|BUILT|PUBLIC)$/.test(s)) return "edit";
  if (/^(DELIVERED|FU1|FU2)$/.test(s) || f === "sample_sent") return "watching";
  return "quiet";
}
const MOODS = [["hot", "Hot", "c-red"], ["asked", "Asked price", "c-orange"], ["talking", "Talking", "c-blue"], ["thinking", "Thinking", "c-purple"], ["edit", "Sample in edit", "c-blue2"], ["watching", "Watching sample", "c-green"], ["quiet", "Quiet", "c-grey"], ["lost", "Lost", "c-ink"]];
const MOOD_LABEL = Object.fromEntries(MOODS.map(m => [m[0], m[1]]).concat([["buyer", "Buyer"]]));
const initials = p => { const s = (p.name || p.email || p.lead_email || "?").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/); return ((s[0]?.[0] || "?") + (s[1]?.[0] || s[0]?.[1] || "")).toUpperCase(); };
const campName = n => String(n || "").replace(/^TEST\s*[—-]\s*/i, "").replace(/\s*[—-]\s*(V\d.*|test.*)$/i, "").replace(/\s*\(\d\d-\d\d\)\s*$/, "").trim();
const PACK = { monthly_30_300: "30 Shorts a month", short_5: "5 Shorts", short_3: "3 Shorts", short_1: "1 Short", short_5_150: "Starter, 5 Shorts", monthly_growth_300: "Growth, monthly", monthly_daily_500: "Daily, monthly", dfy_daily_600: "Done For You", dfy_max_growth_1000: "Max Growth" };
const PER = { today: ["Today", 1], "7d": ["Last 7 days", 7], "30d": ["Last 30 days", 30], month: ["This month", 0] };
const nameOf = e => { const p = RAW && RAW.pipeline.find(x => lc(x.email) === lc(e)); return p && p.name ? p.name : e; };
const payKey = p => p.client_id ? "c:" + p.client_id : p.email ? "e:" + lc(p.email) : "p:" + p.id;
/* 11-21 (Do next noise): which waiting replies are real work. HARD_PASS = the send guard's _HARD_PASS (scripts/instantly.py) + "stop" /
   "unsubscribe" alone. AUTO_TX / YES_TX / HUMAN_TX = the reply sync's classifier (supabase/functions/ops-sync). AUTO_MORE = auto-replies it
   still files as REAL (11-21 data: "received your message", "landed safe", "my working hours", "only check this email", "thanks for writing in"). */
const HARD_PASS = /\b(?:going to|gonna|will|'ll|have to|must|i|we)\s+pass\b(?!\s+(?:this|it|that|them|your|you|the|along|on to|on your|on the))|\bpass(?:ing)? on (?:this|it|that|the offer|your offer)\b|\bno,?\s+thanks?\b|\bno thank you\b|\bnot interested\b|\bnot for (?:us|me)\b|\bplease (?:don'?t|do not) (?:follow up|contact|email|reach out|send)|^\W*(?:stop|unsubscribe|remove me)\b/i;
const AUTO_TX = /out of (the )?office|\bOOO\b|on (vacation|holiday|leave|maternity)|auto(matic)?[- ]?reply|thank(s| you)( so much| very much)? for (your (email|message|e-mail|inquiry|enquiry|note)|reaching|getting|emailing|contacting)|your (message|email) has been (received|forwarded)|you will receive a (response|reply)|vielen dank f|(reply|respond|get back)[^.]{0,40}(upon|on|after) my return|away at a conference|reply above this line|your request (\(#?\d+\) )?has been received|we strive to respond within|limited access to (my )?e-?mails?|for (the )?fastest (assistance|response)|we (aim to )?(respond|reply) to (all )?e-?mails? within|in the meantime, here are|view (this email )?in (your )?browser|unsubscribe/i;
const HUMAN_TX = /sorry for the (late|delayed|slow) (reply|response)|\bi was (out|away|travell?ing)\b|\b(adding|looping in|cc'?ing|copying in)\b|\bi'?ve (now )?(reviewed|watched|looked)|\b(aren'?t|are not|am not|i'?m not|not) (currently )?(looking for|interested)|\bno,? thank(s| you)\b|\b(just|i'?ve|we'?ve|i|we) (just )?paid\b|looking forward to working (together|with)/i;
const YES_TX = /\b(yes|yeah|sure|interested|go ahead|send it|please do|sounds good|let'?s do|i'?d (like|love|be happy)|take you up on)\b/i;
const AUTO_MORE = /\b(we('ve)?|i('ve)?|team has) received your (message|e-?mail|inquiry|enquiry|note)\b|\b(has|have) landed (safe|safely)\b|\bmy working hours\b|\bonly check (this|my) (e-?mail|inbox)\b|\bthanks? (so much )?for writing in\b|\byour (request|ticket)\b[^.]{0,30}\bhas been received\b/i;
/* 11-22 (truth pass, Hot leads): "later", "no budget" and "taking it elsewhere" are not hot. Kept narrow: "keep the budget around $1,500" is a buyer. */
const SOFT_NO = /\b(?:(?:no|little|limited|tight|small) budget|budget (?:is )?(?:tight|limited)|(?:don'?t|do not) (?:really )?have (?:the|a|any) budget|unlikely i have the budget|out of (?:my|our) budget|can'?t afford|cannot afford|too expensive|commission|elsewhere|below expectations|zero chance|need to find funding|not need your help|maybe later|not (?:right )?now|not at (?:this|the) (?:time|moment)|(?:reach|circle|check) (?:out|back)\b[^.]{0,40}\b(?:later|next (?:week|month|year)|in (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|after)|next (?:year|quarter)|after the holidays|in the new year)\b/i;
const ownWords = t => String(t || "").split(/\bFrom: |\bOn .{5,120}?wrote:|-----Original Message-----|\bSent from my\b/)[0];   // the lead's own words, not the quoted thread
const autoText = w => /\bautomated (e-?mail |email )?(response|reply|message)\b/i.test(w) || ((AUTO_TX.test(w) || AUTO_MORE.test(w)) && !YES_TX.test(w) && !HUMAN_TX.test(w));

function derive() {
  const R = RAW, t = today(), own = r => STATE.owner === "All" || (r.owner || "") === STATE.owner, ownLoose = r => STATE.owner === "All" || !r.owner || r.owner === STATE.owner;
  const d = { t };
  /* money */
  const pays = R.payments.filter(p => !p.refunded && p.paid_at).map(p => ({ ...p, amount: +p.amount || 0, day: dayOf(p.paid_at) }));
  d.pays = pays;
  const ym = t.slice(0, 7), dom = +t.slice(8, 10), dim = daysInMonth(t), prevEnd = addDays(ym + "-01", -1), pym = prevEnd.slice(0, 7);
  d.ym = ym; d.pym = pym;
  d.month = sum(pays.filter(p => p.day.slice(0, 7) === ym), p => p.amount);
  d.monthN = pays.filter(p => p.day.slice(0, 7) === ym).length;
  d.prevSame = sum(pays.filter(p => p.day.slice(0, 7) === pym && +p.day.slice(8, 10) <= dom), p => p.amount);
  d.prevFull = sum(pays.filter(p => p.day.slice(0, 7) === pym), p => p.amount);
  d.monthDelta = d.prevSame > 0 ? (d.month - d.prevSame) / d.prevSame * 100 : null;
  d.cum = []; { let c = 0; for (let i = 1; i <= dom; i++) { const dd = `${ym}-${String(i).padStart(2, "0")}`; c += sum(pays.filter(p => p.day === dd), p => p.amount); d.cum.push(c); } }
  d.goalPct = d.month / GOAL * 100; d.dom = dom; d.dim = dim; d.daysLeft = dim - dom + 1;
  d.perDay = Math.max(0, GOAL - d.month) / d.daysLeft; d.projected = d.month / dom * dim; d.monthName = MON[+ym.slice(5, 7) - 1]; d.prevName = MON[+pym.slice(5, 7) - 1];
  d.allTime = sum(pays, p => p.amount); d.payN = pays.length; d.avgOrder = pays.length ? d.allTime / pays.length : null;
  d.nextMs = (Math.floor(d.allTime / 1000) + 1) * 1000; d.msPct = (d.allTime - (d.nextMs - 1000)) / 10;
  const byMonth = {}; pays.forEach(p => { byMonth[p.day.slice(0, 7)] = (byMonth[p.day.slice(0, 7)] || 0) + p.amount; });
  const best = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0]; d.bestMonth = best ? { ym: best[0], name: MON[+best[0].slice(5, 7) - 1], v: best[1] } : null;
  d.recentPays = pays.slice(0, 5); d.clients = R.clients.length;
  /* outreach */
  const byDay = {}; R.daily.forEach(r => { const x = byDay[r.day] || (byDay[r.day] = { sent: 0, nw: 0, rep: 0, auto: 0, opp: 0 }); x.sent += r.sent || 0; x.nw += r.new_leads || 0; x.rep += r.replies || 0; x.auto += r.replies_auto || 0; x.opp += r.opportunities || 0; });
  d.series = []; for (let i = 59; i >= 0; i--) { const dd = addDays(t, -i); d.series.push({ day: dd, ...(byDay[dd] || { sent: 0, nw: 0, rep: 0, auto: 0, opp: 0 }) }); }
  const tgt = (R.sync.find(s => s.name === "new_lead_target") || {}).detail; d.target = parseInt(tgt, 10) > 0 ? parseInt(tgt, 10) : 150;
  d.todayNew = d.series[59].nw; d.todaySent = d.series[59].sent; d.yNew = d.series[58].nw; d.ySent = d.series[58].sent;
  d.streak = d.todayNew >= 150 ? 1 : 0; for (let i = 58; i >= 0 && d.series[i].nw >= 150; i--) d.streak++;
  d.queued = sum(R.camps, c => c.uncontacted); d.sentAll = sum(R.camps, c => c.emails_sent); d.contacted = sum(R.camps, c => c.new_contacted); d.loaded = sum(R.camps, c => c.leads_total);
  d.repAll = sum(R.camps, c => c.replies); d.autoAll = sum(R.camps, c => c.replies_auto); d.oppAll = sum(R.camps, c => c.opportunities); d.bounced = sum(R.camps, c => c.bounced);
  d.replyRate = d.contacted ? d.repAll / d.contacted * 100 : null; d.posRate = d.contacted ? d.oppAll / d.contacted * 100 : null;
  const win = (a, b) => { const s = d.series.slice(a, b), nw = sum(s, x => x.nw); return nw ? sum(s, x => x.rep) / nw * 100 : null; };
  const r7 = win(52, 59), p7 = win(45, 52); d.rate7 = r7; d.rateDelta = r7 != null && p7 != null ? r7 - p7 : null;
  /* 11-19 (Simas: "we are not supposed to guess the metrics"): outreach totals come straight from Instantly's analytics for ALL
     campaigns (campaign_live above only holds the active ones), and period totals from Instantly's overview (unique replies per
     period; adding up daily unique counts double-counts a lead who replies on two days). Written by scripts/crm_panels_sync.py. */
  const MR = (R.panels || []).find(x => x.id === "metrics"), M = d.M = MR && MR.data ? MR.data : null; d.mAt = MR ? MR.updated_at : null;
  const MPer = k => M && M.periods ? M.periods[k] : null;
  if (M && M.total) {
    d.sentAll = M.total.sent; d.contacted = M.total.contacted; d.repAll = M.total.replies; d.autoAll = M.total.replies_auto; d.oppAll = M.total.opportunities;
    d.bounced = M.total.bounced; d.loaded = M.total.leads; d.replyRate = M.total.reply_rate; d.posRate = M.total.pos_rate;
    const a7 = MPer("7d"), b7 = MPer("prev_7d"); if (a7 && b7 && a7.reply_rate != null && b7.reply_rate != null) { d.rate7 = a7.reply_rate; d.rateDelta = a7.reply_rate - b7.reply_rate; }
    if (MPer("today")) { d.todayNew = MPer("today").contacted; d.todaySent = MPer("today").sent; }
    if (MPer("yesterday")) d.yNew = MPer("yesterday").contacted;
  }
  const newest = Math.max(0, ...R.camps.map(c => +new Date(c.updated_at || 0)));
  const rr = c => c.new_contacted ? (c.replies || 0) / c.new_contacted * 100 : -1;
  d.camps = R.camps.filter(c => newest - +new Date(c.updated_at || 0) < 3 * 36e5).sort(STATE.campSort === "rate" ? (a, b) => rr(b) - rr(a) : (a, b) => (b.emails_sent || 0) - (a.emails_sent || 0));
  d.campsOld = R.camps.length - d.camps.length;
  /* inboxes */
  d.inb = { n: R.inboxes.filter(i => i.status === 1).length, total: R.inboxes.length, cap: sum(R.inboxes, i => i.daily_limit), capOn: sum(R.inboxes.filter(i => i.status === 1), i => i.daily_limit), sent: sum(R.inboxes, i => i.sent_today), warm: R.inboxes.length ? sum(R.inboxes, i => i.warmup_score) / R.inboxes.length : null };
  /* pipeline */
  const pipe = R.pipeline.filter(own); d.pipe = pipe;
  const counts = {}; pipe.forEach(p => { const m = mood(p); counts[m] = (counts[m] || 0) + 1; });
  d.buyers = counts.buyer || 0; d.moodTotal = pipe.length - d.buyers;
  d.moods = MOODS.map(([k, label, c]) => ({ k, label, c, n: counts[k] || 0 })).filter(m => m.n);
  /* 11-16 (Simas): client priority from client_notes "priority" lines, newest wins: "very hot | valuable | normal | quiet | gone: why".
     "gone" (Faraz 11-16: "he's gone, drop him") leaves every list; their past money stays in the totals. */
  const prioBy = d.prioBy = {}; (R.cnotes || []).filter(n => n.kind === "priority").sort((x, y) => ((x.noted_at || "") + (x.created_at || "")).localeCompare((y.noted_at || "") + (y.created_at || ""))).forEach(n => { prioBy[lc(n.lead_email)] = n.note; });
  const gone = d.gone = new Set(Object.keys(prioBy).filter(e => /^gone\b/i.test(prioBy[e])));
  const flagged = new Set((R.flags || []).filter(x => x.lost_reason || (x.snoozed_until && +new Date(x.snoozed_until) > Date.now())).map(x => lc(x.email)));   // lead_flags: lost, or snoozed for now
  /* 11-22 (truth pass, all 4 seats: "every list respects holds"): an open founder hold (desk_items) takes that person out of Do next, Today,
     Follow-ups, Needs attention and Hot leads. They show once, under "On hold", with who lifts it. A row with no email (partner items)
     is held when it names the held person (first + last word of the hold's name). */
  const deskHolds = (R.desk || []).filter(x => x.kind === "hold"), deskE = new Set(deskHolds.flatMap(x => (x.emails || []).map(lc)));
  const holdsOpen = deskHolds.concat(R.pipeline.filter(p => /^HOLD$/i.test(p.status || "") && !deskE.has(lc(p.email))).map(p => ({ kind: "hold", sheet: true, client: p.name || p.email, emails: [p.email], title: `Status HOLD in the samples sheet${p.next_action ? ": " + cut(p.next_action, 160) : ""}`, set_by: "", created_at: p.stage_changed_at || p.yes_at || null })));   // a HOLD status in the samples sheet holds too (Patrick); its age = when the status changed
  const holdE = new Set(holdsOpen.flatMap(x => (x.emails || []).map(lc))), holdOfE = e => holdsOpen.find(x => (x.emails || []).some(m => lc(m) === lc(e))) || null;
  const rxW = w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"), holdNames = holdsOpen.map(x => String(x.client || "").replace(/\(.*?\)/g, " ").trim().split(/\s+/).filter(Boolean)).filter(w => w.length).map(w => [rxW(w[0]), rxW(w[w.length - 1])]);
  const held = d.held = (email, text) => email ? holdE.has(lc(email)) : !!text && holdNames.some(([a, b]) => a.test(text) && b.test(text));
  /* 11-22 (truth pass: ONE "replies waiting" number): the hero, the Leads badge, Needs attention and Do next all read this one list.
     Real, unanswered, not answered by a later email of ours, not dismissed, not a hard pass or an auto-reply, lead not lost / snoozed / gone. */
  const ms = x => x ? +new Date(x) : 0;
  const outAt = {}; R.tlite.forEach(m => { if (m.direction === "out") { const k = lc(m.lead_email), x = ms(m.at); if (!(outAt[k] >= x)) outAt[k] = x; } });
  const dsm = {}; (R.dismiss || []).forEach(x => { const k = lc(x.lead_email), v = ms(x.received_at); if (!(dsm[k] >= v)) dsm[k] = v; });   // a mark covers its reply even when stamped to the minute
  d.replyWait = R.attention.filter(a => a.kind === "reply" && ownLoose(a)).map(a => ({ email: a.lead_email, name: a.name || a.lead_email, detail: a.detail, due: a.due_at }))
    .filter(x => { const w = ownWords(x.detail), at = ms(x.due), k = lc(x.email); return !(outAt[k] > at) && !(dsm[k] >= at - 6e4) && !flagged.has(k) && !gone.has(k) && !HARD_PASS.test(w) && !autoText(w); });
  const waitUs = new Set(d.replyWait.map(x => lc(x.email)));
  /* 11-22 (truth pass: Hot leads 76 vs ~45-50 real): hot = they wrote to us in the last 14 days (threads or the reply queue, auto-replies
     skipped), their newest words are not a no / later / no budget, not a client, not lost, not on hold. */
  const lastIn = {}; [...(R.inb14 || []).map(x => ({ e: lc(x.lead_email), at: ms(x.at), w: x.snippet || "" })), ...R.replies.filter(r => r.kind === "REAL").map(r => ({ e: lc(r.lead_email), at: ms(r.received_at), w: r.snippet || "" }))]
    .filter(x => x.at >= Date.now() - 14 * 864e5 && !autoText(ownWords(x.w))).forEach(x => { if (!lastIn[x.e] || lastIn[x.e].at < x.at) lastIn[x.e] = x; });
  d.lastIn = lastIn;
  const fuBy = Object.fromEntries(R.fu.map(f => [lc(f.email), f]));
  const intr = Object.fromEntries((R.interested || []).map(x => [lc(x.email), x])), pipeAll = Object.fromEntries(R.pipeline.map(p => [lc(p.email), p]));
  const hotP = p => (p.status || "").toUpperCase() === "HOT" || /^(said_yes|asked_price)$/.test(p.fu_stage || "");
  /* 11-16 (Simas: "hot leads all of them"): also thinking and replied after their sample; parked / none and blocklisted leave the list */
  const blk = new Set(R.replies.filter(r => r.blocklisted).map(r => lc(r.lead_email)));
  const warmP = p => !isBuyer(p) && !/^LOST$/i.test(p.status || "") && !!(intr[lc(p.email)] || p.fu_stage === "thinking" || (p.delivered_at && p.last_reply_at && new Date(p.last_reply_at) > new Date(p.delivered_at)));
  /* 11-17 (Simas: "in hot leads we don't need paid clients"): anyone who has paid lives in Paid clients, never in Hot leads. */
  const paidSet = new Set([...R.payments.filter(x => !x.refunded).map(x => lc(x.email || "")), ...R.pipeline.filter(x => x.paid).map(x => lc(x.email || ""))].filter(Boolean));
  const payCids = new Set(R.payments.filter(x => !x.refunded && x.client_id).map(x => String(x.client_id)));
  R.clients.filter(c => payCids.has(String(c.id))).forEach(c => (c.emails || []).forEach(e => paidSet.add(lc(e))));
  const hotNow = e => { const x = lastIn[lc(e)], w = x ? ownWords(x.w) : ""; return !!x && !HARD_PASS.test(w) && !SOFT_NO.test(w) && !holdE.has(lc(e)); };   // 11-22: see lastIn above
  const cand = pipe.filter(p => (hotP(p) || warmP(p)) && !/^(parked|none)$/.test(p.fu_stage || "") && !blk.has(lc(p.email)) && !gone.has(lc(p.email)) && !flagged.has(lc(p.email)) && !paidSet.has(lc(p.email)) && !isBuyer(p) && hotNow(p.email));
  Object.values(intr).forEach(x => { if (pipeAll[lc(x.email)] || blk.has(lc(x.email)) || gone.has(lc(x.email)) || flagged.has(lc(x.email)) || paidSet.has(lc(x.email)) || !hotNow(x.email)) return;
    const p = { email: x.email, name: x.first_name || x.company || "", show: [x.company, x.campaign].filter(Boolean).join(" · "), owner: ownerOfInbox(x.inbox), inbox: x.inbox, status: "INTERESTED", last_reply_at: x.last_reply_at, interested: true };
    if (own(p)) cand.push(p); });
  d.hot = cand.map(p => {
    const e = lc(p.email), f = fuBy[e], x = intr[e];
    const lr = lastIn[e] ? lastIn[e].at : 0, lo = f && f.last_out ? +new Date(f.last_out) : 0;   // 11-22: their newest real message (was Instantly's sticky last_reply_at)
    const us = waitUs.has(e) || (lr && lo && lr > lo);
    const tag = p.fu_stage === "said_yes" ? ["said yes", "g"] : p.fu_stage === "asked_price" ? ["asked price", "o"] : isBuyer(p) ? ["hot client", "b"] : hotP(p) ? ["hot", "r"] : p.fu_stage === "thinking" ? ["thinking", "b"] : x ? ["interested", "b"] : ["replied after sample", "b"];
    const days = lr ? (Date.now() - lr) / 864e5 : null;
    return { p, us, tag, lr, days, hl: days == null ? 3 : days <= 2 ? 0 : days <= 5 ? 1 : days <= 10 ? 2 : 3, na: p.next_action_at ? +new Date(p.next_action_at) : Infinity };
  }).sort(STATE.hotSort === "next" ? (a, b) => a.na - b.na : STATE.hotSort === "reply" ? (a, b) => b.lr - a.lr : (a, b) => (!!b.us - !!a.us) || (a.na - b.na) || (b.lr - a.lr));
  d.hotStatus = pipe.filter(p => (p.status || "").toUpperCase() === "HOT").length;
  /* samples */
  const delivered = pipe.filter(p => p.delivered_at), wk = monday(t);
  d.delivered = delivered; d.wk = wk;
  const hrs = delivered.filter(p => p.yes_at && dayOf(p.delivered_at) >= addDays(t, -30)).map(p => (new Date(p.delivered_at) - new Date(p.yes_at)) / 36e5).filter(h => h >= 0 && h < 24 * 30).sort((a, b) => a - b);
  const paidOfDelivered = delivered.filter(isBuyer).length;
  d.samples = { total: delivered.length, week: delivered.filter(p => dayOf(p.delivered_at) >= wk).length, wip: pipe.filter(p => /^(YES|CLAIMED|BUILT)$/i.test(p.status || "")).length,
    median: hrs.length ? (hrs.length % 2 ? hrs[(hrs.length - 1) / 2] : (hrs[hrs.length / 2 - 1] + hrs[hrs.length / 2]) / 2) : null, buyers: paidOfDelivered, conv: delivered.length ? paidOfDelivered / delivered.length * 100 : null };
  /* attention */
  /* 11-22 (truth pass): replies = the one replyWait list; held people out; late promises counted once (the view's "promise" rows are the same
     open promises past due, so the page's own copy is only a fallback when the view has none) */
  const att = {}; R.attention.filter(a => ownLoose(a) && a.kind !== "reply" && !held(a.lead_email)).forEach(a => { (att[a.kind] || (att[a.kind] = [])).push({ email: a.lead_email, name: a.name || a.lead_email, detail: a.detail, due: a.due_at }); });
  if (d.replyWait.length) att.reply = d.replyWait;
  const late = R.promises.filter(p => p.due_at && new Date(p.due_at) < new Date() && ownLoose(p) && !held(p.lead_email)).map(p => ({ email: p.lead_email, name: p.lead_email, detail: p.promise, due: p.due_at }));
  if (late.length && !att.promise) att.promises = late;
  d.att = att; d.attTotal = Object.entries(att).filter(([k]) => k !== "followup_done").reduce((s, [, v]) => s + v.length, 0); d.promisesOpen = R.promises.filter(ownLoose).length;
  /* away */
  const wkAgo = Date.now() - 7 * 864e5, d14 = Date.now() - 14 * 864e5; d.away = R.replies.filter(r => r.kind === "AUTO" && !r.answered && +new Date(r.received_at) >= wkAgo);
  d.realOpen = R.replies.filter(r => r.kind === "REAL" && !r.answered && !r.blocklisted && +new Date(r.received_at) >= d14); d.realWaiting = d.replyWait.length;   // 11-22: the Leads badge = the one replies-waiting list
  /* follow-ups (11-22: a held person is never due) */
  const fu = R.fu.filter(f => f.state === "active" && f.due_at && own(f) && !held(f.email)).map(f => ({ ...f, day: dayOf(f.due_at) }));
  d.fuDays = []; for (let i = 0; i < 7; i++) { const dd = addDays(t, i); d.fuDays.push({ day: dd, list: fu.filter(f => f.day === dd) }); }
  d.fuOver = fu.filter(f => f.day < t); d.fuWeek = sum(d.fuDays, x => x.list.length);
  if (!STATE.day || STATE.day < t || STATE.day > addDays(t, 6)) STATE.day = t;
  /* today */
  const ord = { call: 0, payment_failed: 1, action: 2, partner: 3 };
  /* 11-17 (Simas: "you need to track it through cal.com"): a call = a cal.com booking (public.calls), never a "call" note. */
  d.calls = (R.calls || []).filter(x => x.status === "booked");
  d.callsUp = d.calls.filter(x => +new Date(x.end_at || x.start_at) >= Date.now() - 15 * 6e4 && +new Date(x.start_at) <= Date.now() + 7 * 864e5);
  /* 11-21 (Simas: "dont send X anything", "have u adjusted her vids"): founder holds and the work in production (public.desk_items) */
  d.holds = holdsOpen;
  d.prod = (R.desk || []).filter(x => x.kind === "production").sort((a, b) => STG_ORD.indexOf(a.stage) - STG_ORD.indexOf(b.stage) || String(a.client).localeCompare(String(b.client)));
  /* 11-21: a call that has ended is no longer one of today's calls (same 15-minute grace as callsUp) */
  const calToday = d.calls.filter(x => dayOf(x.start_at) === t && +new Date(x.end_at || x.start_at) >= Date.now() - 15 * 6e4).map(x => ({ id: "cal-" + x.uid, kind: "call", title: x.name || x.email || "Call", detail: "Booked on cal.com", at: x.start_at, lead_email: x.email || "" }));
  d.todayItems = R.todayItems.filter(x => x.kind !== "call" && !gone.has(lc(x.lead_email || "")) && !held(x.lead_email, x.title)).concat(calToday)   // 11-22: held work ("We owe Henry …") is not today's work.sort((a, b) => (ord[a.kind] ?? 9) - (ord[b.kind] ?? 9) || String(a.at || "").localeCompare(String(b.at || "")));
  /* 11-22 (truth pass: "Videos delivered" = unique Shorts, not files): one Short = client + order + Short number (+ part); a v2 or a re-render
     of the same Short counts once, on the day it first landed. INTERNAL folders are stock, not sent. A file with no Short number counts by
     its title without the version tag. */
  const vKey = x => { const s = String(x.title || ""), m = /\bShort\s+0*(\d+)(?:\s*-\s*Part\s+(\d+))?/i.exec(s);
    return `${x.client_id || ""}|${x.order_name || ""}|${m ? "S" + m[1] + (m[2] ? "p" + m[2] : "") : lc(s).replace(/\.(mp4|mov|m4v)$/, "").replace(/\s*\((?:v\d+(?:\.\d+)?|new look[^)]*|alt[^)]*|final)\)|\s+v\d+(?:\.\d+)?\b/g, "").trim()}`; };
  const shG = {}; R.deliveries.filter(x => x.delivered_at && !/^INTERNAL\b/i.test(x.order_name || "")).forEach(x => { (shG[vKey(x)] || (shG[vKey(x)] = [])).push(x); });
  d.shorts = Object.values(shG).map(fs => { const s = [...fs].sort((a, b) => String(a.delivered_at).localeCompare(String(b.delivered_at))); return { ...s[0], day: String(s[0].delivered_at).slice(0, 10), files: s }; }).sort((a, b) => b.day.localeCompare(a.day));
  /* 11-16 (Simas: "how many leads are we sending out today"): today's live numbers for the Today card */
  d.td = { rep: MPer("today") ? MPer("today").replies : d.series[59].rep, opp: MPer("today") ? MPer("today").opportunities : d.series[59].opp, money: sum(pays.filter(p => p.day === t), p => p.amount), vids: d.shorts.filter(x => x.day === t).length,
    samples: R.pipeline.filter(p => p.delivered_at && dayOf(p.delivered_at) === t).length, calls: d.todayItems.filter(x => x.kind === "call").length, stuck: d.todayItems.filter(x => x.kind === "payment_failed").length };
  /* funnel + deliveries */
  const allDelivered = R.pipeline.filter(p => p.delivered_at).length, allBuyers = R.pipeline.filter(isBuyer).length;
  d.funnel = [["Leads contacted", d.contacted, "c-blue"], ["Real replies", d.repAll, "c-blue2"], ["Positive replies", d.oppAll, "c-orange"], ["Samples delivered", allDelivered, "c-green"], ["Buyers", allBuyers, "c-ink"]];
  const dl = d.shorts.map(x => x.day);   // 11-22: unique Shorts by the day each first landed (was every file row)
  d.vid = { total: d.shorts.length, files: R.deliveries.length, month: dl.filter(x => x.slice(0, 7) === ym).length, weeks: [] };
  for (let w = 7; w >= 0; w--) { const s = addDays(wk, -7 * w), e = addDays(s, 7); d.vid.weeks.push({ s, n: dl.filter(x => x >= s && x < e).length }); }
  /* portal + sync */
  /* 11-21 (Simas: "a comparison percentage on the valuable numbers"): bases for the ▲/▼ chips. Today's outreach numbers against yesterday
     (Instantly's day totals, same source as today's); money up to this time of day (payments carry a time); videos by delivery date. */
  { const Y = MPer("yesterday"), yd = addDays(t, -1), nowT = timeOf(Date.now()), pd = `${pym}-${String(dom).padStart(2, "0")}`;
    d.yd = { sent: Y ? Y.sent : d.series[58].sent, rep: Y ? Y.replies : d.series[58].rep, money: sum(pays.filter(p => p.day === yd && timeOf(p.paid_at) <= nowT), p => p.amount) };
    d.prevSameNow = sum(pays.filter(p => p.day.slice(0, 7) === pym && (p.day < pd || (p.day === pd && timeOf(p.paid_at) <= nowT))), p => p.amount);
    d.vid.prevSame = dl.filter(x => x.slice(0, 7) === pym && x <= pd).length; }
  d.portal = { signups: R.profiles.filter(p => !p.is_admin).length, req: R.sampleReq.length, reqOpen: R.sampleReq.filter(s => s.status === "requested").length, edit: R.videos.filter(v => /^(received|editing|revision)$/.test(v.status || "")).length, ready: R.videos.filter(v => /^(ready|approved)$/.test(v.status || "")).length };
  /* 11-22 (crm-api): hb:<side>:<process> rows are watcher heartbeats, not sync jobs. Stale = older than the row's own max_age_min. */
  const ageMin = x => (Date.now() - +new Date(x.ran_at || 0)) / 6e4, staleOf = x => !!(+x.max_age_min && ageMin(x) > +x.max_age_min);
  d.sync = R.sync.filter(s => s.name !== "new_lead_target" && !/^hb:/.test(s.name)).map(s => ({ ...s, stale: staleOf(s) })); d.syncAt = Math.max(0, ...d.sync.map(s => +new Date(s.ran_at || 0))); d.syncOk = d.sync.every(s => s.ok && !s.stale);
  d.beats = R.sync.filter(s => /^hb:/.test(s.name)).map(s => { const [, side = "", proc = ""] = s.name.split(":"); return { ...s, side: side.replace(/^./, c => c.toUpperCase()), proc, stale: staleOf(s) || !s.ok }; }).sort((a, b) => a.name.localeCompare(b.name));

  /* ---- v2: period (hero, money and outreach follow it) ---- */
  const per = STATE.period, pLen = per === "month" ? dom : PER[per][1], pStart = per === "month" ? ym + "-01" : addDays(t, -(pLen - 1)), qStart = addDays(pStart, -pLen);
  const inP = x => x >= pStart && x <= t, ser = d.series.filter(x => inP(x.day));
  const P = d.per = { key: per, start: pStart, len: pLen, label: per === "month" ? d.monthName : PER[per][0].toLowerCase(), chip: per === "month" ? d.monthName : per === "today" ? "Today" : per, days: ser };
  P.rev = sum(pays.filter(p => inP(p.day)), p => p.amount); P.revN = pays.filter(p => inP(p.day)).length;
  P.prev = per === "month" ? d.prevSame : sum(pays.filter(p => p.day >= qStart && p.day < pStart), p => p.amount);
  P.delta = P.prev > 0 ? (P.rev - P.prev) / P.prev * 100 : null; P.vs = per === "month" ? "vs same days last month" : `vs the ${pLen === 1 ? "day" : pLen + " days"} before`;
  P.cum = []; { let c = 0; for (let i = 0; i < pLen; i++) { const dd = addDays(pStart, i); c += sum(pays.filter(p => p.day === dd), p => p.amount); P.cum.push(c); } }
  P.nw = sum(ser, x => x.nw); P.sent = sum(ser, x => x.sent); P.rep = sum(ser, x => x.rep); P.opp = sum(ser, x => x.opp);
  const MP = MPer(per); if (MP) { P.nw = MP.contacted; P.sent = MP.sent; P.rep = MP.replies; P.opp = MP.opportunities; }
  P.samples = delivered.filter(p => inP(dayOf(p.delivered_at))).length;
  P.vsS = per === "today" ? "vs yesterday" : `vs prior ${pLen} d`;   // what each hero chip is compared with

  /* ---- v2: client portal ---- */
  const users = Object.fromEntries(R.profiles.map(p => [p.id, p]));
  const usedBy = {}; R.videos.forEach(v => { if (v.purchase_id) usedBy[v.purchase_id] = (usedBy[v.purchase_id] || 0) + 1; });
  const pipeBy = Object.fromEntries(R.pipeline.map(p => [lc(p.email), p]));
  const paidBy = {}; pays.forEach(p => { if (p.email) paidBy[lc(p.email)] = (paidBy[lc(p.email)] || 0) + p.amount; });
  const who = id => { const u = users[id] || {}; return { id, name: u.name || u.email || "Unknown client", email: u.email || "" }; };
  const hist = email => { const p = pipeBy[lc(email)]; return { lead: !!p, sample: p && p.delivered_at ? dayOf(p.delivered_at) : "", paid: paidBy[lc(email)] || 0 }; };
  d.pClients = R.profiles.filter(p => !p.is_admin).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).map(p => {
    const packs = R.purchases.filter(x => x.user_id === p.id), live = packs.filter(x => new Date(x.expires_at) > new Date());
    return { ...p, packs, left: sum(live, x => Math.max(0, (x.videos || 0) - (usedBy[x.id] || 0))), exp: live.map(x => x.expires_at).sort()[0] || "", hist: hist(p.email), req: R.sampleReq.find(s => s.user_id === p.id) || null, vids: R.videos.filter(v => v.user_id === p.id) };
  });
  const SORD = { requested: 0, accepted: 1, building: 2, ready: 3, declined: 4 }, VORD = { revision: 0, received: 1, editing: 2, ready: 3, approved: 4 };
  d.pSamples = R.sampleReq.map(s => ({ ...s, who: who(s.user_id), hist: hist((users[s.user_id] || {}).email) })).sort((a, b) => (SORD[a.status] ?? 9) - (SORD[b.status] ?? 9) || +new Date(b.created_at) - +new Date(a.created_at));
  const openNotes = R.vnotes.filter(n => !n.done_at && n.author_role !== "team");
  d.pVideos = R.videos.map(v => ({ ...v, who: who(v.user_id), open: openNotes.filter(n => n.video_id === v.id).length })).sort((a, b) => (VORD[a.status] ?? 9) - (VORD[b.status] ?? 9) || +new Date(b.created_at) - +new Date(a.created_at));
  const groups = {}; openNotes.forEach(n => { const k = n.video_id + ":" + (n.round || 1); (groups[k] || (groups[k] = { video: R.videos.find(v => v.id === n.video_id) || { id: n.video_id, title: "Video" }, round: n.round || 1, who: who(n.user_id), notes: [] })).notes.push(n); });
  d.pNotes = Object.values(groups).map(g => ({ ...g, notes: g.notes.sort((a, b) => (+a.at || 0) - (+b.at || 0)) }));
  d.pOpen = d.pSamples.filter(s => /^(requested|accepted|building)$/.test(s.status)).length + d.pVideos.filter(v => /^(received|editing|revision)$/.test(v.status)).length;

  /* ---- v2: activity feed (newest first). 11-21 (SIMAS: "a payment, a new instantly reply, and maybe changes to the CRM"): every row says who
     did it. g = the filter chip it sits under (money, reply, crm, call, deliv; "" = All only). quiet = sync-job rows: full list only, never the card.
     The hero ticker keeps to money, replies and deliveries. ---- */
  const ev = [], X = R.fx || {}, cByE = {}, cById = Object.fromEntries(R.clients.map(c => [String(c.id), c])); R.clients.forEach(c => (c.emails || []).forEach(e => { cByE[lc(e)] = c; }));
  const calBy = {}; (R.calls || []).forEach(x => { if (x.email && x.name) calBy[lc(x.email)] = x.name; });   // cal.com names read better than some client records
  const nm = (e, alt) => { const k = lc(e), p = pipeAll[k], x = intr[k], c = cByE[k]; return (p && p.name) || (x && x.first_name) || calBy[k] || alt || (c && c.name) || e || "a lead"; };
  const actor = a => { const s = lc(a); return !s || /^(service|system|sync|script|sheet|cron|orders_sync|call notes)$/.test(s) ? "" : /^simas(.?s claude|-claude)$/.test(s) ? "Simas's Claude" : /^benas(.?s claude|-claude)$/.test(s) ? "Benas's Claude" : s === "both" ? "Simas and Benas" : s === "simas" ? "Simas" : s === "benas" ? "Benas" : String(a).trim(); };
  const words = v => String(v ?? "none").replace(/_/g, " ").toLowerCase();
  pays.slice(0, 40).forEach(p => ev.push({ g: "money", t: +new Date(p.paid_at), icon: "cash", c: "c-green", title: `+${usd(p.amount)} from ${p.payer_name || p.email || "a client"}`, sub: PACK[p.package] || "Payment", k: "client", a: payKey(p) }));
  R.replies.filter(r => r.kind === "REAL").slice(0, 60).forEach(r => ev.push({ g: "reply", t: +new Date(r.received_at), icon: "mail", c: "c-blue", title: `Reply from ${nm(r.lead_email)}`, sub: r.snippet || "", email: r.lead_email }));
  R.pipeline.filter(p => p.delivered_at).forEach(p => ev.push({ g: "deliv", t: +new Date(p.delivered_at), icon: "film", c: "c-orange", title: `Sample delivered to ${p.name || p.email}`, sub: p.show || "", email: p.email }));
  /* paid videos (public.deliveries = the Drive index, day only): one row per client per day; INTERNAL folders are stock, not sent */
  const dv = {}; R.deliveries.filter(x => x.delivered_at && !/^INTERNAL\b/i.test(x.order_name || "")).forEach(x => { const day = String(x.delivered_at).slice(0, 10), k = (x.client_id || x.title) + "|" + day; (dv[k] || (dv[k] = { day, cid: x.client_id, list: [] })).list.push(x); });
  Object.values(dv).forEach(g => { const t0 = String(g.list[0].title || ""), n = g.list.length, to = t0.includes(" - ") ? t0.split(" - ")[0].trim() : (cById[g.cid] || {}).name || "a client",
      nums = g.list.map(x => (String(x.title || "").match(/\bShort\s+0*(\d+)/i) || [])[1]), sh = [...new Set(nums)].sort((a, b) => a - b), m = sh.length,   // a v2 of the same Short counts once
      what = n === 1 ? (t0.match(/\bShort\s+\d+(\s+v\d+)?/i) || ["1 video"])[0] : nums.every(Boolean) ? (m === 1 ? `Short ${sh[0]}` : m <= 4 ? `Shorts ${sh.slice(0, -1).join(", ")} and ${sh[m - 1]}` : `${m} Shorts`) : `${n} videos`;
    ev.push({ g: "deliv", t: Math.min(Date.now() - 1000, +new Date(tzAt(g.day, 0))), dateOnly: true, icon: "play", c: "c-orange", title: `${what} delivered to ${to}`, sub: g.list.map(x => x.title).join(" · "), ...(g.cid ? { k: "client", a: "c:" + g.cid } : { k: "vids", a: g.day.slice(0, 7) }) }); });
  /* calls: booked and cancelled on cal.com, call notes added, call to-dos ticked */
  (R.calls || []).forEach(x => { const n = nm(x.email, x.name), when = `${dLabel(dayOf(x.start_at))}, ${timeOf(x.start_at)}`, base = { g: "call", c: "c-blue2", ...(x.email ? { email: x.email } : { k: "feed", a: "call" }) };
    if (x.booked_at) ev.push({ ...base, t: +new Date(x.booked_at), icon: "phone", title: `${n} booked a call for ${when}`, sub: x.title || "" });
    if (/cancel/i.test(x.status || "")) ev.push({ ...base, t: +new Date(x.updated_at || x.start_at), icon: "x", c: "c-grey", title: `${n} cancelled the call on ${when}` }); });
  (X.cnotes || []).filter(x => x.call_uid).forEach(x => ev.push({ g: "call", t: +new Date(x.at), icon: "edit", c: "c-blue2", title: `${actor(x.actor) || "The team"} added call notes for ${nm(x.lead_email)}`, email: x.lead_email }));
  (X.ctasks || []).filter(x => x.done_at).forEach(x => ev.push({ g: "call", t: +new Date(x.done_at), icon: "check", c: "c-green", title: `${actor(x.done_by) || "The team"} ticked “${cut(x.text, 70)}”`, sub: `Call to-do · ${nm(x.lead_email)}`, email: x.lead_email }));
  /* CRM changes with who did them: public.audit_log (stage moves, holds, to-dos, contact edits, promises, deals) + pack edits (pack_overrides.set_by).
     Call notes and call to-dos come from their own tables above. Rows by a sync job (actor "service") fold into one quiet row per table per half hour. */
  (X.packs || []).forEach(x => ev.push({ g: "crm", t: +new Date(x.set_at), icon: "edit", c: "c-grey", title: `${actor(x.set_by) || "The team"} marked ${(cById[x.client_id] || {}).name || "a client"}'s ${x.order_name} ${words(x.status)}`, sub: "", k: "client", a: "c:" + x.client_id }));
  const ftT = Object.fromEntries((X.ft || []).map(x => [String(x.id), x.title])), dkB = Object.fromEntries((X.desk || []).map(x => [String(x.id), x])), prB = Object.fromEntries((X.prom || []).map(x => [String(x.id), x])), opB = Object.fromEntries((X.opps || []).map(x => [String(x.id), x]));
  const ST = { YES: "said yes", CLAIMED: "claimed", BUILT: "built", DELIVERED: "sample delivered", REPLIED: "replied", HOT: "hot", WON: "won", LOST: "lost", SILENT: "silent", FU1: "follow-up 1", FU2: "follow-up 2" }, sys = {}, runs = [];
  (X.audit || []).forEach(r => { const tb = r.table_name, ch = r.changed || {}, up = r.op === "update", key = String(r.row_key || ""), A = actor(r.actor), t = +new Date(r.at);
    if (/^(call_tasks|api_keys)$/.test(tb) || (tb === "touches" && (up || ch.call_uid))) return;
    if (!A) { let g = sys[tb]; if (!g || g.lo - t > 18e5) { g = sys[tb] = { t, lo: t, tb, keys: new Set() }; runs.push(g); } g.lo = t; g.keys.add(key); return; }   // rows come newest first: a gap of 30 min+ starts a new run
    const has = k => k in ch, nv = k => up && Array.isArray(ch[k]) ? ch[k][1] : ch[k];
    let e = null;
    if (tb === "pipeline") { const N = nm(key), em = { email: key };
      e = !up ? { ...em, icon: "plus", title: `${A} added ${N} to the samples pipeline` }
        : has("status") ? { ...em, icon: "edit", title: `${A} moved ${N} to ${ST[nv("status")] || words(nv("status"))}` }
        : has("fu_stage") ? { ...em, icon: "edit", title: `${A} set ${N} to ${words(nv("fu_stage"))}`, sub: nv("fu_note") || "" }
        : has("owner") ? { ...em, icon: "user", title: `${A} gave ${N} to ${nv("owner") || "nobody"}` }
        : has("next_action") || has("next_action_at") ? { ...em, icon: "clock", title: `${A} set the next step for ${N}`, sub: nv("next_action") || "" }
        : { ...em, icon: "edit", title: `${A} added a note on ${N}`, sub: nv("fu_note") || "" }; }
    else if (tb === "founder_tasks") { const T = `“${cut(!up && ch.title ? ch.title : ftT[key] || "a to-do", 70)}”`, base = { k: "next", a: "" };
      e = r.op === "insert" ? { ...base, icon: "plus", title: `${A} added ${T}${ch.who ? ` for ${ch.who}` : ""}` } : r.op === "delete" ? { ...base, icon: "x", title: `${A} deleted ${T}` }
        : has("done_at") ? (nv("done_at") ? { ...base, icon: "check", c: "c-green", title: `${A} ticked ${T}` } : { ...base, icon: "edit", title: `${A} reopened ${T}` })
        : { ...base, icon: "edit", title: `${A} edited ${T}` }; }
    else if (tb === "desk_items") { const x = !up ? ch : dkB[key] || {}, hold = x.kind === "hold", who = x.client || "a client", T = `“${cut(x.title || who, 50)}”`, base = { k: hold ? "holds" : "prod", a: "" };
      e = r.op === "insert" ? (hold ? { ...base, icon: "flag", c: "c-red", title: `${A} put ${who} on hold`, sub: x.title || "" } : { ...base, icon: "film", title: `${A} added ${T} for ${who}` })
        : r.op === "delete" ? { ...base, icon: "x", title: `${A} removed ${T}` }
        : has("status") && nv("status") !== "open" ? { ...base, icon: "check", c: "c-green", title: hold ? `${A} lifted the hold on ${who}` : `${A} closed ${T}` }
        : has("stage") ? { ...base, icon: "film", title: `${A} moved “${cut(x.title || "a job", 34)}” to ${(STG[nv("stage")] || [words(nv("stage"))])[0].toLowerCase()}`, sub: who }
        : { ...base, icon: "edit", title: `${A} updated ${T}`, sub: nv("detail") || who }; }
    else if (tb === "touches") e = { email: ch.lead_email || "", icon: "edit", title: `${A} logged ${words(ch.kind || "a touch")} with ${nm(ch.lead_email)}`, sub: ch.summary || "" };
    else if (tb === "clients") { const name = (!up ? ch.name : (cById[key] || {}).name) || "a client", base = { k: "client", a: "c:" + key };
      e = r.op === "insert" ? { ...base, icon: "user", title: `${A} added the client ${name}` } : r.op === "delete" ? { ...base, icon: "x", title: `${A} removed the client ${name}` } : { ...base, icon: "user", title: `${A} edited ${name}'s details`, sub: Object.keys(ch).map(words).join(", ") }; }
    else if (tb === "promises") { const x = !up ? ch : prB[key] || {}, em = x.lead_email || "", N = nm(em), base = em ? { email: em, sub: x.promise || "" } : { k: "feed", a: "crm", sub: x.promise || "" };
      e = r.op === "insert" ? { ...base, icon: "flag", title: `${A} logged a promise to ${N}` } : has("status") ? { ...base, icon: "check", c: "c-green", title: `${A} marked a promise to ${N} ${words(nv("status"))}` } : { ...base, icon: "edit", title: `${A} edited a promise to ${N}` }; }
    else if (tb === "opportunities") { const x = !up ? ch : opB[key] || {}, who = x.client || "a", base = x.email ? { email: x.email } : { k: "pipeline", a: "" };
      e = r.op === "insert" ? { ...base, icon: "cash", title: `${A} added a deal: ${who}` } : has("stage") ? { ...base, icon: "edit", title: `${A} moved the ${who} deal to ${words(nv("stage"))}` } : { ...base, icon: "edit", title: `${A} updated the ${who} deal`, sub: nv("next_step") || "" }; }
    else if (tb === "deal_stages") e = { k: "pipeline", a: "", icon: "edit", title: `${A} edited the deal stages` };
    if (e) ev.push({ g: "crm", c: "c-grey", sub: "", ...e, t }); });
  const NOUN = { pipeline: ["lead", "leads"], desk_items: ["desk item", "desk items"], founder_tasks: ["to-do", "to-dos"], clients: ["client", "clients"], promises: ["promise", "promises"], opportunities: ["deal", "deals"], touches: ["touch", "touches"] };
  runs.forEach(g => { const ks = [...g.keys], n = ks.length, pipe = g.tb === "pipeline", names = pipe ? ks.map(k => nm(k)) : [], w = NOUN[g.tb] || ["row", "rows"];
    ev.push({ g: "crm", quiet: true, t: g.t, icon: "refresh", c: "c-grey", title: pipe && n <= 2 ? `Sync updated ${names.join(" and ")}` : `Sync updated ${n} ${w[n === 1 ? 0 : 1]}`, sub: pipe && n > 2 ? names.join(", ") : "", ...(pipe && n === 1 ? { email: ks[0] } : { k: "feed", a: "crm" }) }); });
  R.profiles.filter(p => !p.is_admin).forEach(p => ev.push({ g: "", t: +new Date(p.created_at), icon: "user", c: "c-purple", title: `Portal sign-up: ${p.name || p.email}`, sub: p.email || "", k: "client", a: "e:" + lc(p.email) }));
  R.sampleReq.forEach(s => ev.push({ g: "", t: +new Date(s.created_at), icon: "film", c: "c-purple", title: `Portal sample request from ${who(s.user_id).name}`, sub: s.video_url || "", k: "psamples", a: "" }));
  R.videos.forEach(v => ev.push({ g: "", t: +new Date(v.created_at), icon: "play", c: "c-purple", title: `Portal video request: ${v.title || "Untitled"}`, sub: who(v.user_id).name, k: "pvideos", a: "" }));
  const adds = {}; R.leadAdds.forEach(a => { (adds[a.day] || (adds[a.day] = { n: 0, tabs: [] })).n += +a.n || 0; adds[a.day].tabs.push(`${a.tab} ${a.n}`); });
  Object.entries(adds).forEach(([day, x]) => ev.push({ g: "", t: Math.min(Date.now() - 1000, +new Date(day + "T16:00:00Z")), dateOnly: true, icon: "bolt", c: "c-ink", title: `${nf0.format(x.n)} new leads loaded`, sub: x.tabs.join(" · "), k: "day", a: day }));
  d.feed = ev.filter(e => e.t > 0).sort((a, b) => b.t - a.t).slice(0, 150);

  /* ---- v2: heatmap (8 weeks), reply clock ---- */
  const hs = addDays(wk, -49), serBy = Object.fromEntries(d.series.map(x => [x.day, x]));
  d.heat = { rows: [], max: 1, weeks: [] };
  for (let w = 0; w < 8; w++) d.heat.weeks.push(addDays(hs, w * 7));
  for (let r = 0; r < 7; r++) { const row = []; for (let w = 0; w < 8; w++) { const day = addDays(hs, w * 7 + r), x = serBy[day]; row.push({ day, n: x ? x.nw : 0, fut: day > t }); d.heat.max = Math.max(d.heat.max, x ? x.nw : 0); } d.heat.rows.push(row); }
  const hrsN = Array(24).fill(0); R.replies.filter(r => r.kind === "REAL").forEach(r => { hrsN[hourOf(r.received_at)]++; });
  d.clock = { h: hrsN, max: Math.max(1, ...hrsN), total: sum(hrsN, x => x), peak: hrsN.indexOf(Math.max(...hrsN)) };

  /* ---- v2: conversations (message counts) + speed to reply (an estimate: threads do not say which inbound mails are auto-replies, the reply queue does for the last 60 days) ---- */
  const byLead = {}; R.tlite.forEach(m => { (byLead[lc(m.lead_email)] || (byLead[lc(m.lead_email)] = [])).push(m); });
  d.tc = Object.fromEntries(Object.entries(byLead).map(([k, v]) => [k, v.length]));
  d.cEmails = Object.fromEntries(R.clients.map(c => [c.id, (c.emails || []).map(lc)]));
  d.emailsOf = p => [...new Set([lc(p.email), ...((p.client_id && d.cEmails[p.client_id]) || [])].filter(Boolean))];
  d.cn = emails => sum(emails, e => d.tc[lc(e)] || 0);
  const minute = x => new Date(x).toISOString().slice(0, 16), autoK = new Set(R.replies.filter(r => r.kind === "AUTO").map(r => lc(r.lead_email) + "|" + minute(r.received_at)));
  const gaps = []; Object.entries(byLead).forEach(([e, ms]) => { let wait = null; ms.forEach(m => { if (m.direction !== "out") { if (wait == null && !autoK.has(e + "|" + minute(m.at))) wait = +new Date(m.at); } else if (wait != null) { const g = (+new Date(m.at) - wait) / 6e4; if (g >= 0 && g < 14 * 1440) gaps.push({ t: wait, g, e }); wait = null; } }); });
  const w7 = Date.now() - 7 * 864e5, w14 = Date.now() - 14 * 864e5;
  d.speed = { gaps, n: gaps.length, all: med(gaps.map(x => x.g)), w: med(gaps.filter(x => x.t >= w7).map(x => x.g)), pw: med(gaps.filter(x => x.t >= w14 && x.t < w7).map(x => x.g)), h1: gaps.length ? gaps.filter(x => x.g <= 60).length / gaps.length * 100 : null, max: gaps.length ? Math.max(...gaps.map(x => x.g)) : null, weeks: [] };
  for (let w = 7; w >= 0; w--) { const s = addDays(wk, -7 * w), e = addDays(s, 7), g = gaps.filter(x => { const dd = dayOf(x.t); return dd >= s && dd < e; }); d.speed.weeks.push({ s, n: g.length, med: med(g.map(x => x.g)) }); }
  d.hot.forEach(h => { h.msgs = d.tc[lc(h.p.email)] || 0; });

  /* ---- v2: top clients, deliverability, sample turnaround, per-inbox bars, period deltas ---- */
  const groups2 = {}; pays.forEach(p => { const k = payKey(p), g = groups2[k] || (groups2[k] = { key: k, name: "", total: 0, n: 0, last: "", emails: new Set() }); g.total += p.amount; g.n++; if (p.day > g.last) g.last = p.day; d.emailsOf(p).forEach(e => g.emails.add(e)); if (!g.name) g.name = (p.client_id && (R.clients.find(c => c.id === p.client_id) || {}).name) || p.payer_name || p.email || "Client"; });
  const buyersL = Object.values(groups2).map(g => ({ ...g, msgs: d.cn([...g.emails]) })).sort((x, y) => y.total - x.total);
  /* 11-17 (Simas): "show faraz in the top buyers and in the clients but we have parted ways with him" → listed, tagged "parted ways". */
  d.isGone = es => [...es].some(e => d.gone.has(lc(e)));
  buyersL.forEach(g => { g.gone = d.isGone(g.emails); });
  d.top = buyersL.slice(0, 5); d.buyersN = buyersL.length; d.repeat = buyersL.length ? buyersL.filter(g => g.n > 1).length / buyersL.length * 100 : null; d.ltv = buyersL.length ? d.allTime / buyersL.length : null; d.buyersL = buyersL;
  d.deliv = { rate: d.sentAll ? d.bounced / d.sentAll * 100 : 0, unsub: sum(R.camps, c => c.unsubscribed), worst: R.camps.filter(c => (c.emails_sent || 0) >= 100).map(c => ({ ...c, rate: (c.bounced || 0) / c.emails_sent * 100 })).sort((x, y) => y.rate - x.rate).slice(0, 3) };
  d.turn = []; for (let w = 7; w >= 0; w--) { const s = addDays(wk, -7 * w), e = addDays(s, 7), hs2 = delivered.filter(p => p.yes_at && dayOf(p.delivered_at) >= s && dayOf(p.delivered_at) < e).map(p => (new Date(p.delivered_at) - new Date(p.yes_at)) / 36e5).filter(h => h >= 0 && h < 24 * 30); d.turn.push({ s, n: hs2.length, med: med(hs2) }); }
  d.inbList = [...R.inboxes].sort((x, y) => String(x.email).localeCompare(String(y.email)));
  const sumDays = (from, to, k) => { let s = 0; for (let x = from; x < to; x = addDays(x, 1)) s += (byDay[x] || {})[k] || 0; return s; }, chg = (now, was) => was > 0 ? (now - was) / was * 100 : null;
  P.dNw = chg(P.nw, sumDays(qStart, pStart, "nw")); P.dRep = chg(P.rep, sumDays(qStart, pStart, "rep")); P.dSamples = chg(P.samples, delivered.filter(p => { const dd = dayOf(p.delivered_at); return dd >= qStart && dd < pStart; }).length);
  const MQ = MPer({ today: "yesterday", "7d": "prev_7d", "30d": "prev_30d", month: "prev_month_same_days" }[per]);
  if (MP && MQ) { P.dNw = chg(MP.contacted, MQ.contacted); P.dRep = chg(MP.replies, MQ.replies); }
  P.vsN = MP && MQ && per === "month" ? "vs last month" : P.vsS;

  /* ---- 11-16: Paid clients page (Simas: "all of our paid clients, what are the next steps and important info") ---- */
  const lastAt = d.lastAt = {}; R.tlite.forEach(m => { lastAt[lc(m.lead_email)] = m.at; });   // tlite is oldest first, so the newest wins
  const notesBy = d.notesBy = {}, nKey = n => (n.noted_at || dayOf(n.created_at)) + (n.created_at || "");
  (R.cnotes || []).forEach(n => { (notesBy[lc(n.lead_email)] || (notesBy[lc(n.lead_email)] = [])).push(n); }); Object.values(notesBy).forEach(a => a.sort((x, y) => nKey(y).localeCompare(nKey(x))));
  const freeMail = /@(gmail|googlemail|hotmail|outlook|yahoo|icloud|me|aol|live|msn|proton|protonmail)\./i, domOf = e => freeMail.test(e) ? "" : e.split("@")[1] || "";
  const nmW = v => lc(v).replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  const PC = buyersL.map(g => ({ key: g.key, name: g.name, emails: new Set(g.emails), total: g.total, n: g.n, last: g.last, pays: pays.filter(p => payKey(p) === g.key), lead: null }));
  R.pipeline.forEach(p => { const e = lc(p.email), txt = lc(`${p.paid || ""} ${p.notes || ""}`), dm = domOf(e);   // a buyer's payer email is often named in paid/notes, or shares the company domain
    let c = PC.find(x => x.emails.has(e)) || (isBuyer(p) ? PC.find(x => !x.lead && [...x.emails].some(m => txt.includes(m) || (dm && domOf(m) === dm))) : null);
    /* 11-22 (truth pass: Danielle listed twice): a buyer row with no payment of its own is the same person as a payer whose first name
       matches and whose last name is in the lead's name or show ("Danielle" · "Danielle Oteri's Italy" = Danielle E Oteri, who paid) */
    if (!c && isBuyer(p)) { const lw = nmW(`${p.name || ""} ${p.show || ""}`), f0 = nmW(p.name)[0]; c = f0 ? PC.find(x => !x.lead && x.total > 0 && (w => w.length > 1 && w[0] === f0 && w[w.length - 1].length > 2 && lw.includes(w[w.length - 1]))(nmW(x.name))) : null; }
    if (!c && !isBuyer(p)) return;
    if (!c) PC.push(c = { key: "e:" + e, name: p.name || e, emails: new Set(), total: 0, n: 0, last: "", pays: [], lead: null });
    if (!c.lead || isBuyer(p)) c.lead = p; c.emails.add(e); });
  d.pClients.filter(a => a.packs.length && !PC.some(x => x.emails.has(lc(a.email)))).forEach(a => PC.push({ key: "e:" + lc(a.email), name: a.name || a.email, emails: new Set([lc(a.email)]), total: 0, n: 0, last: dayOf(a.packs[0].created_at), pays: [], lead: null }));   // bought in the portal only
  const waitPaid = new Set(R.attention.filter(a => a.kind === "paid_waiting").map(a => lc(a.lead_email)));
  const owedOf = p => { for (const t of [p.next_action, p.fu_note, p.notes]) { const s = String(t || "").split(/(?<=[.;!?|])\s+/).find(x => /\b(owed?|owing|still to (build|deliver|send|make)|left to (build|deliver|make)|remaining)\b/i.test(x) && !/\b(nothing|none|no longer|not)\s+(is\s+|are\s+)?(owed|owing|remaining|left)\b/i.test(x)); if (s) return s; } return ""; };   // 11-22: "Nothing owed" is not owed
  d.paidC = PC.map(c => { const p = c.lead || {}, em = [...c.emails], acct = d.pClients.find(a => c.emails.has(lc(a.email)));
    return { ...c, p, owner: p.owner || ownerOfInbox(p.inbox), name: p.name || c.name, prom: R.promises.filter(x => c.emails.has(lc(x.lead_email))), notes: em.flatMap(e => notesBy[e] || []).sort((x, y) => nKey(y).localeCompare(nKey(x))),
      lastEmail: em.map(e => lastAt[e] || "").sort().pop() || "", owed: owedOf(p), waiting: em.some(e => waitPaid.has(e)), credits: acct && acct.packs.length ? acct.left : null,
      at: [c.last, (/^\d{4}-\d\d-\d\d/.exec(p.paid || "") || [""])[0]].sort().pop() };
  }).filter(own).map(c => {   /* 11-16 (Simas): priority, videos delivered (Drive index), the plan we sold them */
    const em = [...c.emails], ids = new Set(R.clients.filter(k => (k.emails || []).some(e => c.emails.has(lc(e)))).map(k => String(k.id))); if (c.key.startsWith("c:")) ids.add(c.key.slice(2));
    const dels = d.shorts.filter(x => ids.has(String(x.client_id))), plan = c.notes.find(n => n.kind === "price") || null;
    const man = em.map(e => prioBy[e]).find(Boolean) || "", mt = (/^(very hot|valuable|normal|quiet)\b/i.exec(man) || [""])[0].toLowerCase();
    const age = c.at ? (Date.now() - +new Date(c.at)) / 864e5 : 999, monthly = /\/\s?mo\b|a month|monthly|per month/i.test(`${c.p.paid || ""} ${plan ? plan.note : ""}`);
    const valuable = mt === "valuable" || c.total >= 300 || c.n >= 2 || monthly;
    const parted = em.some(e => gone.has(e));   // 11-17 (Simas): parted ways, still listed as a past client
    const nopay = !c.total && c.credits == null;   // 11-22: marked won in the sheet, no payment on record (Henry, barter partner)
    const tier = parted ? "parted ways" : nopay ? "no payment" : mt || (age <= 7 || c.owed || c.prom.length ? "very hot" : age > 45 ? "quiet" : "normal");   // very hot = paid this week, or videos/promise still owed
    return { ...c, vids: dels.length, lastVid: dels.map(x => String(x.delivered_at || "")).sort().pop() || "", plan, monthly, valuable: valuable && !parted && !nopay, parted, tier, why: man.replace(/^[a-z ]+:\s*/i, ""),
      nopay, rank: parted ? 4 : nopay ? 5 : tier === "very hot" ? 0 : valuable || tier === "valuable" ? 1 : tier === "quiet" ? 3 : 2 };
  }).sort((x, y) => x.rank - y.rank || y.at.localeCompare(x.at) || x.name.localeCompare(y.name));
  /* 11-16 (Simas): "how many emails do we need to send to the client to close them": our sent emails to any of the client's
     addresses before their FIRST payment (Stripe paid_at, else the Paid at cell). Clients with no email trail (IG DMs) are left out. */
  const outBy = {}; R.tlite.forEach(m => { if (m.direction === "out") (outBy[lc(m.lead_email)] || (outBy[lc(m.lead_email)] = [])).push(+new Date(m.at)); });
  d.paidC.forEach(c => { const pa = /^\d{4}-\d\d-\d\d( \d\d:\d\d)?/.exec(c.p.paid || ""), cell = pa ? +new Date(pa[0].length > 10 ? pa[0].replace(" ", "T") : pa[0] + "T23:59") : null;
    const first = c.pays.length ? Math.min(...c.pays.map(x => +new Date(x.paid_at))) : cell, outs = [...c.emails].flatMap(e => outBy[e] || []);
    c.firstPaid = first; c.toClose = first && outs.length ? outs.filter(t => t <= first).length || null : null; });
  { const L = d.paidC.filter(c => c.toClose).sort((x, y) => x.toClose - y.toClose), a = L.map(c => c.toClose);
    d.close = { list: L, n: a.length, med: med(a), avg: a.length ? sum(a, x => x) / a.length : null, min: a[0] ?? null, max: a.length ? a[a.length - 1] : null, in5: a.length ? a.filter(x => x <= 5).length / a.length * 100 : null }; }
  /* 11-17 (Simas): retainer clients = Stripe subscriptions only (repeat pack buyers are not retainers) */
  const mo = r => (+r.amount || 0) * (r.interval === "year" ? 1 / 12 : r.interval === "week" ? 52 / 12 : 1);
  const retAll = (R.retainers || []).map(r => ({ ...r, live: /^(active|past_due|trialing)$/.test(r.status || ""), monthly: mo(r), e: lc(r.email || "") }));
  d.ret = { all: retAll.sort((a, b) => (b.live - a.live) || String(b.started_at || "").localeCompare(String(a.started_at || ""))), live: retAll.filter(r => r.live) };
  d.ret.mrr = sum(d.ret.live, r => r.monthly); d.ret.total = sum(retAll, r => +r.paid_total || 0); d.ret.ended = retAll.filter(r => !r.live).length;
  d.paidC.forEach(c => { c.ret = d.ret.live.find(r => c.emails.has(r.e)) || null; });
  const live = d.paidC.filter(c => !c.parted && !c.nopay); d.paidLive = live.length; d.paidParted = d.paidC.filter(c => c.parted).length; d.paidNoPay = d.paidC.filter(c => c.nopay).length;
  d.paidEver = d.paidC.filter(c => c.total > 0).length;   // 11-22 (truth pass: "30 paying clients" = everyone who ever paid; 3 pay monthly)
  d.paidHot = d.paidC.filter(c => c.tier === "very hot").length; d.paidVal = d.paidC.filter(c => c.valuable || c.tier === "valuable").length;
  d.paidLate = live.filter(c => c.p.next_action_at && new Date(c.p.next_action_at) < new Date()).length; d.paidNoNext = live.filter(c => !c.p.next_action).length; d.paidProm = sum(live, c => c.prom.length);

  /* ---- 11-21 (BENAS, main page): Big deals = public.big_deals (open deals worth $300+/mo; the view sorts stale first, then value).
     Waiting for approval = public.drafts_waiting (PR #9): approved / sending drafts are in the sender's hands, the rest wait on a founder.
     null = the view isn't there (yet): the card says so or hides. ---- */
  d.deals = R.deals ? R.deals.filter(ownLoose) : null;
  d.drafts = R.drafts ? R.drafts.filter(x => /^(pending|held|unknown|failed|stale)$/.test(x.status || "") && ownLoose({ owner: ownerOfInbox(x.inbox) })).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)) : null;
  /* ---- 11-21 (BENAS): "Do next" = ONE ranked list, one row per lead (its most urgent reason wins):
     1 approvals > 2 replies waiting (oldest first) > 3 calls today > 4 deliveries, promises and to-dos due > 5 follow-ups due > 6 hot leads with no next step.
     A founder to-do (founder_tasks) always keeps its own row and Done button; it still takes its lead's place for the lower rows. ---- */
  const todoC = [], age = x => x ? rel(+new Date(x)) : "", dueT = x => { const u = dueIn(x); return u ? u.txt : ""; };
  /* 11-22 (truth pass): a held person's work, promises, follow-ups and hot-lead rows stay out (their row sits under "On hold");
     a reply from them still shows, because a founder decides it (the hold says so) */
  const c0 = (r, at, key, x) => { if (key && !/^t:/.test(key) && (gone.has(key) || flagged.has(key) || (r >= 4 && holdE.has(key)))) return; todoC.push({ ...x, r, at, key }); };
  (d.drafts || []).forEach(x => c0(1, ms(x.created_at), lc(x.lead_email), { icon: "check", c: "c-purple", title: `Approve the reply to ${nm(x.lead_email)}`, sub: `${DRAFT_L[x.category] || words(x.category)}${x.status === "pending" ? "" : " · " + x.status}`, end: age(x.created_at), k: "draft", a: String(x.id) }));
  const hotBy = Object.fromEntries(d.hot.map(h => [lc(h.p.email), h]));
  d.replyWait.forEach(x => { const h = hotBy[lc(x.email)], hd = holdOfE(x.email); c0(2, ms(x.due), lc(x.email), { icon: "mail", c: h ? "c-red" : "c-blue", title: `Reply to ${nm(x.email)}`, sub: `${hd ? `On hold: ${lifts(hd, "decide")} · ` : ""}${h ? `Hot lead, ${h.tag[0]} · ` : ""}${x.detail || "A reply is waiting"}`, end: age(x.due), email: x.email }); });
  d.callsUp.filter(x => dayOf(x.start_at) === t).forEach(x => c0(3, ms(x.start_at), x.email ? lc(x.email) : "cal:" + x.uid, { icon: "phone", c: "c-blue", title: `Call ${x.name || x.email}`, sub: `Today ${timeOf(x.start_at)} · booked on cal.com`, end: timeOf(x.start_at), email: x.email || "", k: "todaylist", a: "" }));
  (R.ftasks || []).filter(x => STATE.owner === "All" || !x.who || x.who === STATE.owner).forEach(x => c0(x.due_at && ms(x.due_at) > Date.now() + 7 * 864e5 ? 7 : 4, ms(x.due_at || x.created_at), "t:" + x.id, { icon: "flag", c: "c-red", title: x.title, sub: [x.who || "Either of you", dueT(x.due_at), x.detail || ""].filter(Boolean).join(" · "), task: x.id, lead: lc(x.lead_email || ""), email: x.lead_email || "" }));
  (att.paid_waiting || []).forEach(x => c0(4, ms(x.due), lc(x.email), { icon: "cash", c: "c-green", title: `Deliver to ${x.name}`, sub: x.detail || "Paid and still waiting for the videos", end: age(x.due), email: x.email }));
  d.pVideos.filter(v => /^(received|revision)$/.test(v.status)).forEach(v => c0(4, ms(v.due_at || v.created_at), "pv:" + v.id, { icon: "play", c: "c-purple", title: `${v.status === "revision" ? "Changes asked" : "New video request"}: ${v.title || "Untitled"}`, sub: `${v.who.name}${v.due_at ? " · " + dueT(v.due_at) : ""}`, end: dueT(v.due_at), k: "pvideos", a: "" }));
  d.pSamples.filter(s => s.status === "requested").forEach(s => c0(4, ms(s.created_at), "ps:" + s.id, { icon: "film", c: "c-purple", title: `Answer ${s.who.name}'s sample request`, sub: "Accept or decline it in the portal queue", k: "psamples", a: "" }));
  [...(att.promise || []), ...(att.promises || [])].forEach(x => c0(4, ms(x.due), lc(x.email), { icon: "flag", c: "c-ink", title: `Keep the promise to ${nm(x.email)}`, sub: x.detail || "", end: dueT(x.due), email: x.email }));
  (att.overdue || []).forEach(x => c0(4, ms(x.due), lc(x.email), { icon: "alert", c: "c-orange", title: `Next step overdue: ${nm(x.email)}`, sub: x.detail || "", end: dueT(x.due), email: x.email }));
  [...d.fuOver, ...d.fuDays[0].list].forEach(f => c0(5, ms(f.due_at), lc(f.email), { icon: "clock", c: "c-grey", title: `Follow up with ${f.name || nm(f.email)}`, sub: `touch ${Math.min((f.touches_done || 0) + 1, f.touches_total || 99)} of ${f.touches_total || "?"} · ${f.day < t ? "overdue" : "due today"}`, end: f.day < t ? dLabel(f.day) : "today", email: f.email }));
  const hasNext = new Set((R.nextSteps || []).filter(x => String(x.next_step || "").trim()).map(x => lc(x.email)));
  const valOf = {}; (R.deals || []).forEach(x => (x.emails || [x.email]).forEach(e => { const k = lc(e); valOf[k] = Math.max(valOf[k] || 0, +x.value_usd || 0); }));   // 11-22 (truth pass): "worth $X" only from a real quote (big_deals_v2); the $150 stage default is gone
  d.hot.filter(h => !String(h.p.next_action || "").trim() && !hasNext.has(lc(h.p.email))).sort((a, b) => (valOf[lc(b.p.email)] || 0) - (valOf[lc(a.p.email)] || 0) || (b.lr || 0) - (a.lr || 0))
    .forEach((h, i) => { const v = valOf[lc(h.p.email)] || 0; c0(6, i, lc(h.p.email), { icon: "bolt", c: "c-orange", title: `Hot lead: ${h.p.name || nm(h.p.email)}`, sub: `No next step set · ${h.tag[0]}${v ? ` · worth ${usd(v)}` : ""}`, end: h.lr ? age(h.lr) : "", email: h.p.email }); });
  const seenT = new Set(); d.todo = []; d.todoMore = [];
  d.todoLater = [];
  todoC.sort((x, y) => x.r - y.r || x.at - y.at).forEach(x => { if (x.task) { (x.r === 7 ? d.todoLater : d.todo).push(x); if (x.lead) seenT.add(x.lead); return; } if (seenT.has(x.key)) return; seenT.add(x.key);
    (x.r === 6 && d.todo.filter(y => y.r === 6).length >= 8 ? d.todoMore : d.todo).push(x); });
  d.todoN = d.todo.length;
  /* 11-21 Pipeline card: pipeline_forecast for everyone; with the owner switch on, the same counts from lead_stage.
     11-22 (truth pass): lead counts only. The "$ forecast" was 100% the $150 default per lead (no open lead has a real value), so it is gone. */
  { const F = (R.forecast || []).filter(x => x.is_open).sort((a, b) => a.ord - b.ord), L = (R.stages || []).filter(x => x.is_open && STATE.owner !== "All" && own(x));
    d.fc = !F.length ? null : STATE.owner === "All" ? { open: F.map(x => ({ stage: x.stage, leads: +x.leads || 0 })), overdue: sum(F, x => x.overdue) }
      : { open: F.map(x => ({ stage: x.stage, leads: L.filter(y => y.stage === x.stage).length })), overdue: L.filter(y => y.overdue).length };
    if (d.fc) d.fc.total = sum(d.fc.open, x => x.leads); }
  /* 11-22 (SIMAS 16:4x "home page must track the forms: lots of money sleeping there"): public.form_leads_v2, one row per brief form.
     Open money = the ladder value of every form that has not paid and is not lost. */
  d.forms = R.forms ? R.forms.filter(ownLoose).map(x => ({ ...x, open: !/^(paid|lost)$/.test(x.stage) })) : null;
  if (d.forms) { const sr = { form: 0, sample: 1, scope: 2, paid: 3, lost: 4 }; d.forms.sort((a, b) => (b.open - a.open) || (!!b.thirty - !!a.thirty) || (!!b.value_usd - !!a.value_usd) || (a.open && b.open ? (sr[b.stage] - sr[a.stage]) : 0) || String(b.submitted_at).localeCompare(String(a.submitted_at)));
    d.formsOpen = sum(d.forms.filter(x => x.open), x => +x.value_usd || 0); d.formsThirty = d.forms.filter(x => x.open && x.thirty).length; }
  d.wof = wofOf(R, paidSet);   // 11-23 (BENAS): the "Waiting on a founder" rows (shared by both founders: the owner switch does not filter them)
  return d;
}

/* ---------------- svg + html helpers ---------------- */
function smooth(pts, top, bot) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}h.01` : "";
  let s = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, k = 0.17;
    const c1y = clamp(p1[1] + (p2[1] - p0[1]) * k, top, bot), c2y = clamp(p2[1] - (p3[1] - p1[1]) * k, top, bot);
    s += `C${(p1[0] + (p2[0] - p0[0]) * k).toFixed(1)},${c1y.toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * k).toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return s;
}
const lineXY = (vals, W, H, pad, max) => vals.map((v, i) => [vals.length === 1 ? W / 2 : i / (vals.length - 1) * W, H - pad - (max ? v / max : 0) * (H - pad * 2)]);
const webUrl = u => { try { const x = new URL(String(u).trim()); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };   // only http/https ever becomes a link
const short = u => cut(String(u).replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), 44);
const ext = (u, label) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label || short(u))}</a>`;
const linkify = (text, max = 4) => String(text || "").split(/\s+/).map(webUrl).filter(Boolean).slice(0, max).map(u => ext(u)).join(" · ");
const head = (title, right = "", strong = false) => `<header class="ch"><span class="ct${strong ? " strong" : ""}">${title}</span>${right ? `<span class="cx">${right}</span>` : ""}</header>`;
const bar = (pct, c = "") => `<div class="bar ${c}"><i data-v="w:${clamp(pct || 0, 0, 100).toFixed(1)}%"></i></div>`;
const relA = t => { const r = rel(t); return r === "now" ? "just now" : /^[A-Z]/.test(r) ? "on " + r : r + " ago"; };
const empty = t => `<p class="empty">${t}</p>`;
/* every number and row is a real control: dB = "drill button" (opens the list behind it in the modal) */
const dB = (k, a, inner, cls = "", label = "") => `<button type="button" class="${cls}" data-act="drill" data-k="${k}" data-a="${esc(a ?? "")}"${label ? ` aria-label="${esc(label)}" title="${esc(label)}"` : ""}>${inner}</button>`;
const big = (k, a, inner, label, cls = "") => dB(k, a, inner, "big tapn " + cls, label);
const tri = (label, val, k, a) => k ? dB(k, a, `<span>${label}</span><b>${val}</b>`, "", `${label}: open the list`) : `<div><span>${label}</span><b>${val}</b></div>`;
const kv = (label, val, k, a, cls = "") => k ? dB(k, a, `<span>${label}</span><span>${val}</span>`, "kv " + cls) : `<div class="kv ${cls}"><span>${label}</span><span>${val}</span></div>`;
const leadBtn = (email, inner, cls = "tile row") => `<button type="button" class="${cls}" data-act="lead" data-email="${esc(email)}">${inner}</button>`;
/* 11-21: deal stages (public.lead_stage, computed from evidence by the database) */
const STAGE_L = { replied: "Replied", engaged: "Engaged", proposal: "Proposal", committed: "Committed", won: "Won", parked: "Parked", lost: "Lost" };
const stageOf = e => ((RAW && RAW.stages) || []).find(x => lc(x.email) === e) || null;
const nextOf = e => ((RAW && RAW.nextSteps) || []).find(x => lc(x.email) === e) || null;
const stDays = x => `${Math.max(0, Math.round(+x.days_in_stage || 0))} d`;
/* 11-21 (BENAS, main page): Big deals rows (public.big_deals) and the drafts that wait for a founder (public.drafts_waiting, PR #9) */
const DRAFT_L = { big_deal: "Big deal", client_problem: "Client problem", new_terms: "New terms", big_name: "Big name", other: "Other" };
/* 11-22 (truth pass, SIMAS: "the big deals section is showing nonsense"): rows from public.big_deals_v2 = real quotes only. "Quiet" = days since
   THEIR last message (any of their addresses), not days in a stage. An open founder hold shows as a chip with who lifts it. */
const liftBy = x => ({ simas: "Simas", benas: "Benas", both: "both founders" })[lc(x && x.set_by)] || "a founder";
const lifts = (x, v = "lift") => { const w = liftBy(x); return w === "both founders" ? `${w} ${v}` : `${w} ${v}s`; };   // "Simas lifts it" / "both founders lift it"
const DSRC = { opportunity: "deal in the CRM", scope: "scope sent", "their words": "their own words" };
const dealVal = x => `${usd(x.value_usd)}${x.monthly ? "/mo" : ""}`;
const quietD = x => x.days_quiet == null ? "no reply on record" : `${x.days_quiet ? `their last reply ${x.days_quiet} d ago` : "they wrote today"}`;
const holdChip = x => x.on_hold ? `<span class="chip r" title="${esc(x.hold_title || "On hold")}">On hold · ${esc(lifts({ set_by: x.hold_by }))} it</span>` : "";
const bigRow = x => leadBtn(x.email, `<span class="av">${esc(initials(x))}</span><span class="row-main"><b>${esc(x.name || x.email)}</b><small>${x.current_mrr ? `Client upsell, pays ${usd(x.current_mrr)}/mo now · ` : ""}<span class="${!x.on_hold && x.days_quiet >= 7 ? "dn" : ""}">${quietD(x)}</span>${x.on_hold ? ` · on hold, ${esc(lifts({ set_by: x.hold_by }))} it` : ""}</small><small>${esc(cut(x.offer || x.their_words || (x.sources || "").split(" + ").map(k => DSRC[k] || k).join(" + "), 140))}</small></span><span class="row-end">${dealVal(x)}</span>`);
const dealTile = x => `<div class="tile pt"><div class="pt-top">${leadBtn(x.email, `<span class="av">${esc(initials(x))}</span><span class="row-main"><b>${esc(x.name || x.email)}</b><small>${esc(x.email)}</small></span>`, "row np0")}<span class="chip g">${dealVal(x)}</span></div>
  <div class="pt-meta">${holdChip(x)}${(x.sources || "").split(" + ").filter(Boolean).map(k => `<span class="chip b">${esc(DSRC[k] || k)}</span>`).join("")}${x.current_mrr ? `<span class="chip">client · ${usd(x.current_mrr)}/mo now</span>` : ""}<span class="chip${!x.on_hold && x.days_quiet >= 7 ? " r" : ""}" title="Days since their last message to us">${esc(quietD(x))}</span><span class="chip">${esc(x.owner || "No owner")}</span></div>
  <div class="pt-lines">${x.offer ? `<span><b>Offer</b> ${esc(cut(x.offer, 240))}</span>` : ""}${x.their_words ? `<span><b>Their words</b> “${esc(cut(x.their_words, 240))}”</span>` : ""}${x.on_hold ? `<span><b>Hold</b> ${esc(cut(x.hold_title || "", 200))}</span>` : ""}${x.next_step ? `<span><b>Next</b> ${esc(cut(x.next_step, 240))}</span>` : ""}<span><b>Quoted</b> ${x.quoted_at ? fDT(x.quoted_at) : "—"}</span><span><b>Their last reply</b> ${x.last_in_at ? fDT(x.last_in_at) : "none on record"}</span>${webUrl(x.link) ? `<span><b>Scope</b> ${ext(webUrl(x.link))}</span>` : ""}</div></div>`;
/* 11-22 (SIMAS 16:4x; BENAS "Brief responses"): brief forms (public.form_leads_v2). Stage = how far that lead got; value = our ladder by how often they post. */
const FST = { form: ["Form in", ""], sample: ["Sample sent", "b"], scope: ["Scope sent", "o"], paid: ["Paid", "g"], lost: ["Lost", "w"] };
const fKey = x => `${lc(x.email)}|${x.submitted_at}`;
const fStage = x => { const s0 = FST[x.stage] || [x.stage, ""]; return `<span class="chip ${s0[1]}">${s0[0]}</span>`; };
const formRow = x => dB("form", fKey(x), `<span class="it ${x.thirty && x.open ? "c-red" : "c-purple"}"><svg><use href="#i-${x.has_phone ? "phone" : "edit"}"/></svg></span><span class="row-main"><b>${esc(x.name || x.email)}</b><small>${esc([x.needs ? "needs " + lc(x.needs) : "", x.post_freq ? "posts " + x.post_freq : "", x.sells ? "sells " + cut(x.sells, 40) : ""].filter(Boolean).join(" · ") || "Older form: only the video and style questions")}</small><span class="tagline">${fStage(x)}${x.thirty && x.open ? `<span class="chip r" title="Posts daily or 5+ times a week">30/mo candidate</span>` : ""}${x.has_phone ? `<span class="chip" title="Phone number given">${ic("phone")}phone</span>` : ""}</span></span><span class="row-end">${x.value_usd && x.open ? usd(x.value_usd) : x.stage === "paid" && x.paid_usd ? `<small>paid</small>${usd(x.paid_usd)}` : ""}</span>`, "tile row frow", `${x.name || x.email}: open the whole form`);
const qaRows = a => Object.entries(a || {}).filter(([k]) => !/^(Timestamp|Your name|Your phone number|The email we wrote to you on)$/.test(k)).map(([k, v]) => `<span><b>${esc(k)}</b> ${linkify(v, 3) && /^https?:\/\/\S+$/.test(String(v).trim()) ? linkify(v, 3) : esc(cut(v, 400))}</span>`).join("");
/* 11-22 (SIMAS "we should see the scope that u have sent them"): public.scopes matched by lower(email), loaded once per refresh in fetchAll */
const scopesOf = x => { const es = new Set([lc(x.email), lc(x.lead_email)].filter(Boolean)); return (RAW && RAW.scopes || []).filter(z => es.has(lc(z.email))); };
const scopeRows = x => { if (!RAW || !RAW.scopes) return `<p class="mut fsc-none">Couldn't load the scopes.</p>`; const L = scopesOf(x); if (!L.length) return `<p class="mut fsc-none">No scope sent yet</p>`;
  return `<div class="stack">${L.map(z => { const paid = z.status === "paid" || !!z.paid_at, cur = String(z.currency || "USD").toUpperCase(), amt = z.amount == null ? "" : cur === "USD" ? usd(z.amount) : `${nf0.format(Math.round(+z.amount))} ${esc(cur)}`, u = webUrl(z.url);
    return `<div class="tile row fsc"><span class="row-main"><b>${esc(z.offer || "Scope")}${amt ? ` · ${amt}${z.monthly ? "/mo" : ""}` : ""}</b><small><span class="chip ${paid ? "g" : "o"}">${paid ? "paid" : esc(z.status || "sent")}</span> sent ${z.sent_at ? esc(dLabel(dayOf(z.sent_at))) : "—"}${paid && z.paid_at ? ` · paid ${esc(dLabel(dayOf(z.paid_at)))}` : ""}</small></span>${u ? `<a class="act" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${ic("link")}Open scope</a>` : ""}</div>`; }).join("")}</div>`; };
function formSheet(key) {
  const x = (D.forms || []).find(z => fKey(z) === key) || (D.forms || []).find(z => lc(z.email) === lc(key)); if (!x) return { title: "Form", html: empty("This form is not in the list any more.") };
  const tel = String(x.phone || "").replace(/[^\d+]/g, ""), step = (label, at, extra = "") => `<div class="hf"><span>${label}</span><b>${at ? dLabel(dayOf(at)) : "—"}</b>${extra}</div>`;
  return { title: x.name || x.email, sub: `Form in ${fDT(x.submitted_at)} · ${x.email}`,
    html: `${x.phone ? `<div class="acts fphone">${tel ? `<a class="act go" href="tel:${esc(tel)}">${ic("phone")}${esc(x.phone)}</a>` : `<span class="act">${ic("phone")}${esc(x.phone)}</span>`}<button type="button" class="act" data-act="copy" data-what="Phone number" data-t="${esc(x.phone)}">${ic("copy")}Copy</button></div>` : ""}<div class="hero-facts mfacts">${step("Form in", x.submitted_at)}${step("Sample sent", x.sample_at)}${step("Scope or price sent", x.scope_at)}</div>
      <div class="pt-meta sp">${fStage(x)}${x.thirty && x.open ? `<span class="chip r">30/mo candidate</span>` : ""}${x.paid_at ? `<span class="chip g">paid ${usd(x.paid_usd)} · first ${dLabel(dayOf(x.paid_at))}</span>` : ""}${x.on_hold ? `<span class="chip r">On hold</span>` : ""}${x.owner ? `<span class="chip">${esc(x.owner)}</span>` : ""}</div>
      ${grp("Scopes we sent")}${scopeRows(x)}
      ${grp("What they told us")}<div class="tile pt"><div class="pt-lines">${x.plan ? `<span><b>Fits</b> ${esc(x.plan)} (they post ${esc(x.post_freq)})</span>` : `<span><b>Fits</b> unknown: this form did not ask how often they post</span>`}
        ${x.phone ? `<span><b>Phone</b> ${tel ? `<a href="tel:${esc(tel)}">${esc(x.phone)}</a>` : esc(x.phone)}</span>` : ""}${x.channel ? `<span><b>Channel</b> ${linkify(x.channel, 2) || esc(cut(x.channel, 120))}</span>` : ""}
        ${x.needs ? `<span><b>Needs most</b> ${esc(x.needs)}</span>` : ""}${x.sells ? `<span><b>Sells</b> ${esc(cut(x.sells, 200))}</span>` : ""}${x.video ? `<span><b>Video</b> ${linkify(x.video, 1) || esc(cut(x.video, 160))}</span>` : ""}</div></div>
      ${grp("Every answer")}<div class="tile pt"><div class="pt-lines">${qaRows(x.answers) || "<span>No answers stored.</span>"}</div></div>
      <div class="acts sp"><button type="button" class="act go" data-act="lead" data-email="${esc(x.lead_email || x.email)}">${ic("user")}Open the lead</button>${webUrl(x.scope_url) ? `<a class="act" href="${esc(webUrl(x.scope_url))}" target="_blank" rel="noopener noreferrer">${ic("link")}Their scope</a>` : ""}${dB("forms", "", "All forms", "act")}</div>` };
}
const draftRow = x => dB("draft", x.id, `<span class="it c-purple"><svg><use href="#i-check"/></svg></span><span class="row-main"><b>${esc(nameOf(x.lead_email))}</b><small>${esc(DRAFT_L[x.category] || x.category)}${x.status === "pending" ? "" : " · " + esc(x.status)} · to ${esc(x.to_email)}${(x.cc_list || []).length ? ` +${x.cc_list.length} cc` : ""}</small></span><span class="row-end"><small>${esc(rel(+new Date(x.created_at)))}</small></span>`, "tile row", `Open the draft to ${nameOf(x.lead_email)}`);
/* the sheet: their last message, the exact text, who it goes to, flags, and the founder's four buttons (what each status allows = the trigger's rules) */
const DRAFT_OPS = { pending: ["approve", "edit", "hold", "reject"], held: ["approve", "edit", "reject"], failed: ["approve", "hold", "reject"], stale: ["approve", "hold", "reject"], unknown: ["reject"] };
function draftSheet(id) {
  const x = (D.drafts || []).find(z => String(z.id) === String(id)); if (!x) return { title: "Draft", html: empty("This draft is no longer waiting: it was decided or sent.") };
  const ops = DRAFT_OPS[x.status] || [], L = { approve: ["Approve and send", " go"], edit: ["Edit", ""], hold: ["Hold", ""], reject: [x.status === "unknown" ? "Close it (checked Instantly)" : "Reject", " no"] };
  const why = { held: "On hold. Approve it, change it or reject it.", failed: `Not sent${x.error ? `: ${x.error}` : ""}. Approve to try again.`, stale: "Not sent: the lead wrote again after this was drafted. Read the thread, then approve, change or reject.", unknown: "This may have gone out. Check the thread in Instantly first; it can't be approved again." }[x.status] || "";
  return { title: `Reply to ${nameOf(x.lead_email)}`, sub: `${DRAFT_L[x.category] || x.category} · ${x.status} · written by ${x.created_by || "Claude"} ${relA(+new Date(x.created_at))}`,
    html: `${why ? `<p class="warn dft-why">${esc(why)}</p>` : ""}${x.reason ? `<p class="sub">${esc(x.reason)}</p>` : ""}
      ${grp("They wrote")}<div class="tile note">${esc(x.lead_last_snippet || "—")}</div>
      ${grp("Our draft", esc(`from ${x.inbox}`))}<div class="tile note dft-to"><small>To</small>${esc(x.to_email)}${(x.cc_list || []).length ? `<small>Cc</small>${esc(x.cc_list.join(", "))}` : ""}</div>
      <div class="tile note draft-body">${esc(x.body)}</div>
      <div class="draft-ed" hidden><textarea class="draft-ta" maxlength="8000" aria-label="The reply text"></textarea><div class="acts sp"><button type="button" class="act go" data-act="dft" data-op="save" data-id="${esc(x.id)}">Save the new text</button><button type="button" class="act" data-act="dft" data-op="cancel" data-id="${esc(x.id)}">Cancel</button></div></div>
      ${(x.warnings || []).length ? `<div class="pt-meta sp">${x.warnings.map(w => `<span class="chip o">${esc(w)}</span>`).join("")}</div>` : ""}${x.founder_note ? `<p class="sub">Founder note: ${esc(x.founder_note)}</p>` : ""}
      <p class="dlg-err" id="dft-err" role="alert" hidden></p>
      <div class="acts sp" id="dft-acts">${ops.map(o => `<button type="button" class="act${L[o][1]}" data-act="dft" data-op="${o}" data-id="${esc(x.id)}">${L[o][0]}</button>`).join("")}<button type="button" class="act" data-act="lead" data-email="${esc(x.lead_email)}">${ic("user")}Open the lead</button></div>` };
}
const stageChip = x => `<span class="chip ${x.overdue ? "o" : "b"}" title="${x.overdue ? "Longer in this stage than its limit" : "Days in this stage"}">${esc(STAGE_L[x.stage] || x.stage)} · ${stDays(x)}</span>`;
/* 11-21: On hold + In production cards (public.desk_items) */
const STG = { founder_check: ["Waits on a founder", "o", "c-orange"], ready: ["Ready to send", "g", "c-green"], review: ["Our check", "b", "c-purple"], building: ["Building", "b", "c-blue"], client_check: ["Waits on the client", "w", "c-grey"], queued: ["Queued", "", "c-grey"] };
const STG_ORD = Object.keys(STG);
const holdRow = x => dB("holds", "", `<span class="it c-red"><svg><use href="#i-flag"/></svg></span><span class="row-main"><b>${esc(cut(x.client, 40))}</b></span>`, "tile row", `${x.client}: ${x.title}`);
const prodRow = x => { const s = STG[x.stage] || [x.stage || "Open", "", "c-grey"]; return dB("prod", "", `<span class="it ${s[2]}"><svg><use href="#i-film"/></svg></span><span class="row-main"><b>${esc(cut(x.title, 60))}</b></span>`, "tile row", `${x.client}: ${x.title} (${s[0]})`); };
const lrow = (p, sub, end = "") => leadBtn(p.email || p.lead_email, `<span class="av">${esc(initials(p))}</span><span class="row-main"><b>${esc(p.name || p.email || p.lead_email)}</b><small>${esc(cut(sub, 90))}</small></span>${end}`);
const cvChip = n => `<span class="chip cvn${n ? "" : " z"}" title="${n ? n + " messages in the conversation" : "No email conversation synced for this address yet"}">💬 ${n}</span>`;
/* ▲/▼ chip, whole percent, with what it is compared with (11-21, Simas: "add a comparison percentage ... based on last week, and for todays new
   leads base it off yesterdays"). No base (0) = no chip. o.inv: down is good. o.part: today so far against yesterday's full day; sends run in US
   hours, so a fall is not shown before the day is over (a rise already beats yesterday). */
const pctChg = (now, was) => was > 0 && now != null && isFinite(now) ? (now - was) / was * 100 : null;
const dl = (v, vs = "", o = {}) => v == null || !isFinite(v) || (o.part && v < 0) ? "" : `<em class="dl ${(o.inv ? v <= 0 : v >= 0) ? "up" : "dn"}" title="${esc(o.tip || "Against the same length of time just before")}">${v >= 0 ? "▲" : "▼"}\u00a0${Math.abs(v) >= 1000 ? "999+" : Math.abs(v).toFixed(0)}%${vs ? " " + vs.replace(/ /g, "\u00a0") : ""}</em>`;
const sortB = (key, cur, opts) => `<button type="button" class="sortb" data-act="sort" data-key="${key}" title="Change the order" aria-label="Order: ${opts[cur]}. Change the order.">${ic("sort")}${opts[cur]}</button>`;

/* ---------------- client-portal tiles (cards and modals share them) ---------------- */
const SCHIP = { requested: "o", accepted: "b", building: "b", ready: "g", declined: "r" }, VCHIP = { received: "o", editing: "b", revision: "r", ready: "g", approved: "g" };
const histChips = h => `${h.sample ? `<span class="chip w" title="One free sample per person, ever">had a sample ${dLabel(h.sample)}</span>` : h.lead ? `<span class="chip" title="This email is a lead in the samples pipeline">in the pipeline</span>` : ""}${h.paid ? `<span class="chip g">paid ${usd(h.paid)} before</span>` : ""}`;
const act = (op, id, label, cls = "") => `<button type="button" class="act ${cls}" data-act="pop" data-op="${op}" data-id="${esc(id)}">${label}</button>`;
const dueChip = t => { const x = dueIn(t); return x ? `<span class="due${x.late ? " late" : ""}">${x.txt}</span>` : ""; };
const whoBtn = w => dB("client", "e:" + lc(w.email), `<span class="av">${esc(initials(w))}</span><span class="row-main"><b>${esc(w.name || w.email)}</b><small>${esc(w.email || "")}</small></span>`, "row np0", "Open this client");
const clientTile = c => `<div class="tile pt" id="pc-${esc(c.id)}"><div class="pt-top">${whoBtn(c)}<span class="due" title="Joined ${fDT(c.created_at)}">${rel(+new Date(c.created_at))}</span></div>
  <div class="pt-meta">${dB("client", "e:" + lc(c.email), `${c.left} credit${c.left === 1 ? "" : "s"} left`, `chip ${c.left ? "g" : ""}`, "Open this client: packs, videos, payments, conversation")}${c.exp ? dB("client", "e:" + lc(c.email), `until ${dLabel(dayOf(c.exp))}`, "chip", "Credits are valid until this day. Open this client.") : ""}${c.req ? `<button type="button" class="chip ${SCHIP[c.req.status] || ""}" data-act="jump" data-id="psamples" title="Jump to the sample requests">sample ${esc(c.req.status)}</button>` : ""}${histChips(c.hist)}</div>
  <div class="pt-lines">${c.channel ? `<span><b>Channel</b> ${linkify(c.channel, 1) || esc(cut(c.channel, 60))}</span>` : ""}${c.sells ? `<span><b>Sells</b> ${esc(cut(c.sells, 90))}</span>` : ""}${c.frequency ? `<span><b>Posts</b> ${esc(cut(c.frequency, 40))}</span>` : ""}<span><b>Phone</b> ${c.phone ? "yes" : "no"}</span></div>
  <div class="acts">${act("pack", c.id, "Add a pack")}</div></div>`;
const sampleTile = s => { const A = { requested: [["s-accept", "Accept", "go"], ["s-decline", "Decline", "no"]], accepted: [["s-building", "Building"], ["s-ready", "Ready, send link", "go"], ["s-decline", "Decline", "no"]], building: [["s-ready", "Ready, send link", "go"]] }[s.status] || [], pv = webUrl(s.preview_url), vu = webUrl(s.video_url);
  return `<div class="tile pt"><div class="pt-top">${whoBtn(s.who)}${dB("client", "e:" + lc(s.who.email), esc(s.status), `chip ${SCHIP[s.status] || ""}`, "Open this client")}</div>
  <div class="pt-meta">${dueChip(s.status === "ready" || s.status === "declined" ? null : s.due_at)}<span class="due">asked ${relA(+new Date(s.created_at))}</span>${histChips(s.hist)}</div>
  <div class="pt-lines"><span><b>Video</b> ${vu ? ext(vu) : esc(cut(s.video_url, 70))}</span>${s.moment ? `<span><b>Moment</b> ${esc(cut(s.moment, 140))}</span>` : ""}${s.style ? `<span><b>Style</b> ${esc(cut(s.style, 160))}</span>` : ""}${s.goal ? `<span><b>Goal</b> ${esc(cut(s.goal, 140))}</span>` : ""}${s.note ? `<span><b>Our note</b> ${esc(cut(s.note, 160))}</span>` : ""}${pv ? `<span><b>Preview</b> ${ext(pv)}</span>` : ""}</div>
  ${A.length ? `<div class="acts">${A.map(a => act(a[0], s.id, a[1], a[2] || "")).join("")}</div>` : ""}</div>`; };
const videoTile = v => { const A = { received: [["v-editing", "Mark editing"], ["v-deliver", "Deliver", "go"]], editing: [["v-deliver", "Deliver", "go"]], revision: [["v-editing", "Mark editing"], ["v-deliver", "Deliver new version", "go"]], ready: [["v-deliver", "Deliver new version"]] }[v.status] || [], ru = webUrl(v.result_url), links = linkify(v.footage);
  return `<div class="tile pt"><div class="pt-top">${dB("client", "e:" + lc(v.who.email), `<span class="it c-purple"><svg><use href="#i-play"/></svg></span>`, "itb", "Open this client")}<span class="row-main">${dB("client", "e:" + lc(v.who.email), esc(v.title || "Untitled video"), "vtb", "Open this client")}<small>${dB("client", "e:" + lc(v.who.email), esc(v.who.name), "lk", "Open this client")}</small></span>${dB("client", "e:" + lc(v.who.email), `${esc(v.status)}${v.version ? ` · v${+v.version}` : ""}`, `chip ${VCHIP[v.status] || ""}`, "Open this client")}</div>
  <div class="pt-meta">${dueChip(/^(ready|approved)$/.test(v.status) ? null : v.due_at)}<span class="due">asked ${relA(+new Date(v.created_at))}</span>${v.open ? `<span class="chip r">${v.open} open change${v.open === 1 ? "" : "s"}</span>` : ""}</div>
  <div class="pt-lines"><span><b>Footage</b> ${links || esc(cut(v.footage || "none sent", 80))}</span>${v.notes ? `<span><b>Notes</b> ${esc(cut(v.notes, 200))}</span>` : ""}${ru ? `<span><b>Delivered</b> ${ext(ru)}${v.delivered_at ? ` · ${fDT(v.delivered_at)}` : ""}</span>` : v.result_url ? `<span><b>Delivered</b> review copy v${+v.version || 1} uploaded${v.delivered_at ? ` · ${fDT(v.delivered_at)}` : ""}</span>` : ""}</div>
  ${A.length ? `<div class="acts">${A.map(a => act(a[0], v.id, a[1], a[2] || "")).join("")}</div>` : ""}</div>`; };
const mmss = s => { s = Math.max(0, Math.round(+s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const noteTile = g => `<div class="tile pt"><div class="pt-top">${dB("pvideos", "", `<span class="it c-red"><svg><use href="#i-alert"/></svg></span>`, "itb", "Open the video requests")}<span class="row-main">${dB("pvideos", "", esc(g.video.title || "Untitled video"), "vtb", "Open the video requests")}<small>${dB("client", "e:" + lc(g.who.email), esc(g.who.name), "lk", "Open this client")} · round ${g.round}</small></span>${dB("pvideos", "", g.notes.length, "chip r", "Open the video requests")}</div>
  <div class="pt-lines">${g.notes.map(n => `<span><b>${mmss(n.at)}</b> ${esc(cut(n.text, 220))} <b>· ${fDT(n.created_at)}</b>${(RAW.vnotes || []).filter(r => r.parent_id === n.id).map(r => `<span class="reply-l"><b>${r.author_role === "team" ? esc(r.author_name || "Team") : "Client"}:</b> ${esc(cut(r.text, 180))}</span>`).join("")} ${act("n-reply", n.id, "Reply")}</span>`).join("")}</div>
  <div class="acts">${act("v-editing", g.video.id, "Mark editing")}${act("v-deliver", g.video.id, "Deliver new version", "go")}</div></div>`;
const feedSeen = new Set();
const feedRow = (e, fresh, bare) => { const inner = `<span class="it ${e.c}"><svg><use href="#i-${e.icon}"/></svg></span><span class="fe-m"><b>${esc(cut(e.title, 96))}</b>${bare ? "" : `<small>${esc(cut(e.sub, 80))}</small>`}</span><time>${e.dateOnly ? dLabel(dayOf(e.t)) : rel(e.t)}</time>`;
  return e.email ? `<button type="button" class="fe${fresh ? " new" : ""}" data-act="lead" data-email="${esc(e.email)}">${inner}</button>` : `<button type="button" class="fe${fresh ? " new" : ""}" data-act="drill" data-k="${e.k}" data-a="${esc(e.a)}">${inner}</button>`; };

/* ---------------- 11-16: Paid clients + Hot leads pages (search and owner filter; rows filter in place while typing) ---------------- */
const KIND = { like: "Likes", dislike: "Dislikes", ask: "Asked for", fact: "Fact", price: "Price / deal" };
const nDay = n => dLabel(n.noted_at || dayOf(n.created_at));
const pageTools = (k, ph) => `<div class="cv-tools"><label class="search cv-s pg-s">${ic("search")}<input class="pg-q" data-k="${k}" type="search" value="${esc(STATE.pq[k] || "")}" placeholder="${ph}" aria-label="${ph}" autocomplete="off" spellcheck="false"></label><div class="seg" role="group" aria-label="Whose">${["All", "Simas", "Benas"].map(o => `<button type="button" data-act="owner" data-o="${o}" class="${STATE.owner === o ? "on" : ""}" aria-pressed="${STATE.owner === o}">${o}</button>`).join("")}</div></div>`;
const pgRow = (k, txt, html) => { const q = lc(STATE.pq[k] || ""), s = lc(txt); return `<div class="tile pt" data-q="${esc(s)}"${q && !s.includes(q) ? " hidden" : ""}>${html}</div>`; };
const nextLine = p => `<span><b>Next</b> ${esc(cut(p.next_action || "none set", 240))}${p.next_action_at ? ` · ${fDT(p.next_action_at)} ${dueChip(p.next_action_at)}` : ""}</span>`;
let LASTW = null, LASTW_AT = 0;   // email -> their newest inbound message (threads); loaded when the Hot leads page opens, at most every 5 min
function needLastWords() { if (Date.now() - LASTW_AT < 5 * 6e4) return; LASTW_AT = Date.now();
  all("threads", "lead_email,at,snippet", q => q.neq("direction", "out").order("at", { ascending: false })).then(rows => { const m = {}; rows.forEach(r => { const k = lc(r.lead_email); if (!m[k] && r.snippet) m[k] = r; }); LASTW = m; refreshDrill(); }).catch(() => { LASTW_AT = 0; }); }
const lastWords = e => { const t = LASTW && LASTW[e], r = RAW.replies.find(x => x.kind === "REAL" && lc(x.lead_email) === e); return !r ? t || null : !t || new Date(r.received_at) > new Date(t.at) ? { at: r.received_at, snippet: r.snippet } : t; };
const hotTile = ({ p, us, tag, lr }) => { const e = lc(p.email), pr = (D.notesBy[e] || []).find(n => n.kind === "price"), offer = pr ? pr.note : p.fu_note || "", w = lastWords(e), lt = Math.max(+new Date(D.lastAt[e] || 0), lr || 0),
    money = isBuyer(p) || /\$\s?\d/.test(`${offer} ${p.next_action || ""} ${p.fu_note || ""} ${p.paid || ""}`);
  return pgRow("hotlist", [p.name, p.email, p.show, p.owner, p.status, tag[0], offer, w && w.snippet, p.next_action].join(" "), `<div class="pt-top">${leadBtn(p.email, `<span class="av${us ? " hot" : ""}">${esc(initials(p))}</span><span class="row-main"><b>${esc(p.name || p.email)}</b><small>${esc(cut(p.show || p.email, 90))}</small></span>`, "row np0")}${cvChip(D.tc[e] || 0)}</div>
    <div class="pt-meta"><span class="chip ${tag[1]}">${tag[0]}</span>${us ? `<span class="chip r">waiting on us</span>` : ""}${money ? `<span class="chip g">$ money</span>` : ""}${p.status ? `<span class="chip">${esc(p.status)}</span>` : ""}${p.owner ? `<span class="chip">${esc(p.owner)}</span>` : ""}</div>
    <div class="pt-lines"><span><b>Offer</b> ${offer ? `${esc(cut(offer, 240))}${pr ? ` · ${nDay(pr)}` : ""}` : "nothing pitched yet"}</span><span><b>Last words</b> ${w ? `“${esc(cut(unent(w.snippet), 220))}” · ${fDT(w.at)}` : LASTW ? "no reply on record" : "loading…"}</span><span><b>Last touch</b> ${lt ? fDT(lt) : "—"}</span>${nextLine(p)}</div>`); };
const paidTile = c => { const p = c.p, inner = `<span class="av">${esc(initials({ name: c.name }))}</span><span class="row-main"><b>${esc(c.name)}</b><small>${esc(cut(p.show || [...c.emails].join(", "), 90))}</small></span>`;
  const bought = p.paid ? esc(cut(p.paid, 200)) : c.pays[0] ? `${usd(c.pays[0].amount)} · ${esc(PACK[c.pays[0].package] || "custom payment")} · ${fDT(c.pays[0].paid_at)}` : "no payment on record";
  return pgRow("paid", [c.name, c.tier, c.valuable ? "valuable" : "", p.show, ...c.emails, c.owner, p.inbox, p.paid, p.next_action, c.owed, ...c.notes.map(n => n.note)].join(" "), `<div class="pt-top">${p.email ? leadBtn(p.email, inner, "row np0") : dB("client", c.key, inner, "row np0", "Open this client")}${dB("client", c.key, usd(c.total), `chip ${c.total ? "g" : ""}`, "Open payments, videos and the whole conversation")}</div>
    <div class="pt-meta">${c.ret ? `<span class="chip g" title="Retainer: Stripe subscription, ${esc(c.ret.status)}">🔁 retainer ${usd(c.ret.amount)}/${esc(c.ret.interval === "month" ? "mo" : c.ret.interval || "")}</span>` : ""}${c.parted ? `<span class="chip" title="${esc(c.why || "We parted ways. Past client: listed, never chased.")}">👋 parted ways</span>` : ""}${c.tier === "very hot" ? `<span class="chip r" title="${esc(c.why || "Paid in the last 7 days, or videos or a promise still owed")}">🔥 very hot</span>` : c.tier === "quiet" ? `<span class="chip" title="${esc(c.why || "No payment for 45+ days and nothing owed")}">💤 quiet</span>` : ""}${c.valuable || c.tier === "valuable" ? `<span class="chip g" title="${esc(c.why || "$300+ paid, a repeat buyer or a monthly plan")}">💎 future valuable</span>` : ""}${c.owner ? `<span class="chip">${esc(c.owner)}</span>` : ""}${p.inbox ? `<span class="chip">${esc(p.inbox)}</span>` : ""}${p.status ? `<span class="chip b">${esc(p.status)}</span>` : ""}${c.waiting ? `<span class="chip o" title="Paid 48 h+ ago and no delivery is indexed: check their Drive folder">deliveries not indexed</span>` : ""}${c.credits != null ? `<span class="chip g">${c.credits} portal credit${c.credits === 1 ? "" : "s"} left</span>` : ""}${cvChip(D.cn([...c.emails]))}</div>
    <div class="pt-lines"><span><b>Bought</b> ${bought}${c.n > 1 ? ` · ${c.n} payments, ${usd(c.total)} in total` : ""}</span>${c.plan ? `<span><b>Plan</b> ${esc(cut(c.plan.note, 220))} · ${nDay(c.plan)}</span>` : ""}${c.toClose ? `<span><b>Emails to close</b> ${c.toClose} sent before the first payment</span>` : ""}<span><b>Videos</b> ${c.vids ? `${c.vids} delivered${c.lastVid ? ` · last ${dLabel(c.lastVid.slice(0, 10))}` : ""}` : "none indexed yet"}</span>${c.why ? `<span><b>Priority</b> ${esc(cut(c.why, 160))}</span>` : ""}${c.owed ? `<span><b>Owed</b> ${esc(cut(c.owed, 220))}</span>` : ""}${p.email ? nextLine(p) : `<span><b>Next</b> not in the samples pipeline</span>`}${c.prom.map(x => `<span><b>Promise</b> ${esc(cut(x.promise, 200))} ${dueChip(x.due_at)}</span>`).join("")}${c.notes.filter(n => n !== c.plan && n.kind !== "priority").slice(0, 5).map(n => `<span><b>${KIND[n.kind] || esc(n.kind)}</b> ${esc(cut(n.note, 220))} · ${nDay(n)}</span>`).join("")}<span><b>Last email</b> ${c.lastEmail ? fDT(c.lastEmail) : "none synced"}</span></div>`); };

/* Do next rows: a founder task gets a Done button (founders tick it); other rows open the lead or the list behind them */
const nextRow = (x, i, long) => { const inner = `<span class="it ${x.c}"><svg><use href="#i-${x.icon}"/></svg></span><span class="row-main"><b>${esc(cut(x.title, long ? 90 : 64))}</b>${long ? `<small>${esc(cut(x.sub, 160))}</small>` : ""}</span>`;
  if (x.task) return `<div class="tile row">${inner}<span class="row-end"><button type="button" class="act go" data-act="ftdone" data-id="${esc(x.task)}" aria-label="Mark “${esc(cut(x.title, 60))}” done">Done</button></span></div>`;
  const end = long || x.end ? `<span class="row-end">${x.end ? `<small>${esc(x.end)}</small>` : ""}${long ? `<small>#${i + 1}</small>` : ""}</span>` : ""; return x.email ? leadBtn(x.email, inner + end) : dB(x.k, x.a, inner + end, "tile row"); };

/* price calculator (11-18, Simas): our quoted prices, Shorts a month -> USD a month. Straight lines between the points, +$10 a Short above 80, rounded to $5. */
const PRICE_PTS = [[1, 50], [5, 150], [15, 300], [30, 500], [40, 600], [60, 840], [80, 1040]];
const priceFor = n => { const P = PRICE_PTS, L = P[P.length - 1]; let v; if (n >= L[0]) v = L[1] + (n - L[0]) * 10; else { let i = 1; while (P[i][0] < n) i++; const [a, x] = P[i - 1], [b, y] = P[i]; v = x + (y - x) * (n - a) / (b - a); } return Math.round(v / 5) * 5; };
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/* ---------------- cards ---------------- */
/* 11-22 minimal pass (SIMAS: "cleaner and more minimalistic, but keep it informative"; "just a few numbers and clean text"): a card face is a
   title, ONE number or a short list (max 5 flat rows: name + one value), at most one quiet line. No tiles, avatars, icons or chips on the face;
   everything that left a face is one tap away in its drill sheet. The title opens the card's page (c.page) or its full list (c.focus). */
const liI = (name, val = "", vc = "") => `<span class="li-n">${name}</span>${val !== "" ? `<span class="li-v${vc ? " " + vc : ""}">${val}</span>` : ""}`;
const liLead = (email, name, val = "", vc = "") => leadBtn(email, liI(name, val, vc), "li");
const liDr = (k, a, name, val = "", vc = "", label = "") => dB(k, a, liI(name, val, vc), "li", label);
const quiet = (k, a, txt, label = "") => dB(k, a, txt, "qt", label);
const PAGE_L = { clients: "Clients", todos: "To-dos", email: "Email campaigns" };
const nextLi = x => { const t = esc(cut(x.title, 70));
  if (x.task) return `<div class="li"><span class="li-n">${t}</span><button type="button" class="act go" data-act="ftdone" data-id="${esc(x.task)}" aria-label="Mark “${esc(cut(x.title, 60))}” done">Done</button></div>`;
  return x.email ? liLead(x.email, t, x.end ? esc(x.end) : "", "mu") : liDr(x.k, x.a, t, x.end ? esc(x.end) : "", "mu"); };
/* 11-21 (BENAS): hidden, code kept. moneypage: crm/money.html is 404 on the live site. Client portal zone: videos,
   sample_requests, purchases, video_notes, video_versions all have 0 rows. Take an id out of this set to show it again. */
const HIDDEN = new Set(["moneypage", "portal", "psamples", "pvideos", "pnotes", "pclients"]);
const keyLabel = k => String(k || "").replace(/_/g, " ").replace(/^./, c => c.toUpperCase());   // an attention kind with no label yet reads as words, not a raw key
/* 11-22 (BENAS: "making the contacts just a card in the main dashboard page, somewhere in the middle"): a search box + the 5 people whose
   newest message to us is the most recent (threads in + real reply_queue rows), each opening that person (a client: the client sheet; anyone
   else: the lead drawer); "See all" opens the Contacts page (?p=contacts). No query of its own: pipeline, clients, threads, reply_queue are in RAW. */
let CTC = { raw: null, list: [] };   // built once per data refresh, not per keystroke
const ctcPeople = () => { if (CTC.raw === RAW) return CTC.list; const P = new Map(), byE = {}, add = x => { P.set(x.k, x); return x; };
  RAW.clients.forEach(c => { const x = add({ k: "c:" + c.id, client: c.id, name: c.name || (c.emails || [])[0] || "Client", q: lc([c.name, ...(c.emails || [])].join(" ")), at: 0 }); (c.emails || []).forEach(e => { byE[lc(e)] = x; }); });
  RAW.pipeline.forEach(p => { const e = lc(p.email); if (!e) return; if (byE[e]) { byE[e].q += " " + lc(`${p.name || ""} ${p.show || ""}`); return; } byE[e] = add({ k: "e:" + e, email: e, name: p.name || e, q: lc(`${p.name || ""} ${p.show || ""} ${e}`), at: 0 }); });
  const wrote = (e, t) => { e = lc(e); t = +new Date(t) || 0; if (!e || !t) return; const x = byE[e] || (byE[e] = add({ k: "e:" + e, email: e, name: e, q: e, at: 0 })); if (t > x.at) x.at = t; };
  RAW.tlite.forEach(m => { if (m.direction !== "out") wrote(m.lead_email, m.at); }); RAW.replies.forEach(r => { if (r.kind === "REAL") wrote(r.lead_email, r.received_at); });
  CTC = { raw: RAW, list: [...P.values()] }; return CTC.list; };
const ctcRow = x => { const v = x.at ? esc(rel(x.at)) : ""; return x.client ? liDr("client", "c:" + x.client, esc(x.name), v ? `Client · ${v}` : "Client", "mu", `Open ${x.name}: payments, videos, conversation`) : liLead(x.email, esc(x.name), v, "mu"); };
/* ---------------- 11-23 (BENAS, "Waiting on a founder"): ONE shared list of every decision only a founder makes, right under the money hero.
   reply = a draft in public.drafts that waits on a founder (pending / held / failed / stale / unknown: what the old approvals card listed);
   check = a "Check:" card in To do on the To-dos board (Claude's work to approve); deal = an open big deal (big_deals_v2) with no next step
   or on a founder hold; hold = an open founder hold (desk_items); prod = client work at stage founder_check (desk_items).
   One row per lead: a draft wins over its deal (and carries the deal's value), a deal over its hold. Order: paying clients, then deal value,
   then oldest. Hidden at 0 ("0 waiting" sits by the "as of" time). A new row after a refresh pops one clickable toast.
   Not here: the Email page's campaign flags (out of leads, starved) are computed on that page only, from tables the Dashboard does not read. ---------------- */
/* urgency (BENAS 11-23 "colour matching the urgency"): minutes a row may wait before it turns amber (today) or red (act now). Tune here.
   client: a paying client's hold / client problem / client work (red after) · reply: a pending or held draft to a lead (red after)
   check: a "Check:" approval (amber after) · deal: a deal with no next step (amber after). A passed due date is always red. */
const WOF_URG = { client: 240, reply: 30, check: 240, deal: 1440 };
/* recent only (BENAS 11-23 "it should only show recent relevant stuff, not overstayed"): minutes a row stays on the card from when it started
   waiting. Past that a hold lives on the Clients page's holds list only, a deal in the Big deals card, client work on the Clients page; it is
   out of the count, the split line, the colours, the badge and the toasts. Replies and "Check:" cards have no limit (they stay until answered). Tune here. */
const WOF_MAX = { hold: 48 * 60, deal: 7 * 1440, prod: 7 * 1440 };
const wofFresh = (kind, t) => !WOF_MAX[kind] || Date.now() - t <= WOF_MAX[kind] * 6e4;   // also caps Do next's "On hold: …" line (BENAS 11-23: recent holds only; the full list stays on the On hold card)
const WOF_UL = ["", "Today", "Act now"];
const wofUrg = r => { const m = (Date.now() - r.at) / 6e4, U = [0];
  if (r.due && +new Date(r.due) < Date.now()) U.push(2);
  if ((r.paying && /^(hold|prod|reply)$/.test(r.kind)) || (r.draft && r.draft.category === "client_problem")) U.push(m > WOF_URG.client ? 2 : 1);
  if (r.draft && /^(pending|held)$/.test(r.draft.status || "")) U.push(m > WOF_URG.reply ? 2 : 1);
  if (r.kind === "check" && m > WOF_URG.check) U.push(1);
  if (r.kind === "check" && r.big) U.push(2);   // BENAS 11-23: a founder decision with money at stake is a red alert from the first minute
  if (r.kind === "deal" && r.nonext && m > WOF_URG.deal) U.push(1);
  return Math.max(...U); };
const WOF_K = { reply: ["Reply", "mail", "c-purple"], check: ["To approve", "check", "c-blue"], deal: ["Deal", "cash", "c-green"], hold: ["Hold", "flag", "c-red"], prod: ["Client work", "film", "c-orange"] };
const WOF_ST = { failed: "Not sent", stale: "They wrote again", unknown: "Check Instantly" };
const founderOf = o => ({ benas: "Benas", simas: "Simas" })[lc(o)] || "";
const WOF = { el: null, html: "", prev: null, told: new Set(), open: new Set(), all: false, rows: [] };
function wofOf(R, paid) {
  const rows = [], seen = new Set(), at = (...v) => { const x = v.find(Boolean); return x ? +new Date(x) : Date.now(); };
  const payN = new Set(R.clients.filter(c => (c.emails || []).some(e => paid.has(lc(e)))).map(c => lc(c.name)));
  const pays = (es, name) => es.some(e => paid.has(lc(e))) || (!!name && payN.has(lc(name)));
  const deals = {}; (R.deals || []).forEach(x => (x.emails || [x.email]).forEach(e => { if (e) deals[lc(e)] = x; }));
  const next = new Set((R.nextSteps || []).filter(x => String(x.next_step || "").trim()).map(x => lc(x.email)));
  R.pipeline.forEach(p => { if (String(p.next_action || "").trim()) next.add(lc(p.email)); });
  (R.drafts || []).filter(x => /^(pending|held|failed|stale|unknown)$/.test(x.status || "")).forEach(x => { const e = lc(x.lead_email), dl = deals[e]; seen.add(e);
    rows.push({ key: "d:" + x.id, kind: "reply", who: nameOf(x.lead_email), what: [WOF_ST[x.status], DRAFT_L[x.category] || x.category, x.reason].filter(Boolean).join(" · "), at: at(x.created_at),
      value: dl ? +dl.value_usd || 0 : 0, mo: !!(dl && dl.monthly), paying: pays([e]) || !!(dl && dl.current_mrr), owner: /^(new_terms|client_problem)$/.test(x.category) ? ownerOfInbox(x.inbox) : "", go: { t: "lead", e }, draft: x }); });
  (R.deals || []).forEach(x => { const es = (x.emails || [x.email]).filter(Boolean).map(lc);
    const t = at(x.last_in_at, x.quoted_at, x.scope_at);   // waiting since their last message (else the quote, else the scope)
    if (!es.length || es.some(e => seen.has(e)) || !(x.on_hold || !es.some(e => next.has(e))) || !wofFresh("deal", t)) return; es.forEach(e => seen.add(e));   // a stale deal stays in the Big deals card
    rows.push({ key: "b:" + es[0], kind: "deal", who: x.name || x.email, what: x.on_hold ? `On hold, ${lifts({ set_by: x.hold_by }, "decide")}` : "No next step set", at: t,
      value: +x.value_usd || 0, mo: !!x.monthly, paying: pays(es) || !!x.current_mrr, owner: "", nonext: !es.some(e => next.has(e)), go: { t: "lead", e: es[0] } }); });
  (R.desk || []).forEach(x => { const es = (x.emails || []).map(lc);
    if (x.kind === "hold") { if (es.some(e => seen.has(e)) || !wofFresh("hold", at(x.created_at))) return;   // age from when the hold was SET (created_at), never updated_at   // a draft or a deal row already covers this lead; two holds on one client stay two rows
      rows.push({ key: "h:" + x.id, kind: "hold", who: x.client, what: x.title, at: at(x.created_at), value: 0, paying: pays(es, x.client), owner: founderOf(x.set_by), go: { t: "page", p: "clients", c: "holds" } }); }
    else if (x.kind === "production" && x.stage === "founder_check" && wofFresh("prod", at(x.updated_at, x.created_at)))   // updated_at = when the stage was last logged (no stage-change column)
      rows.push({ key: "p:" + x.id, kind: "prod", who: x.client, what: x.title, at: at(x.updated_at, x.created_at), value: 0, paying: pays(es, x.client), owner: founderOf(x.set_by), go: { t: "page", p: "clients", c: "prod" } }); });
  (R.checks || []).filter(x => x.status === "todo" && /^check:/i.test(String(x.title || "").trim())).forEach(x => rows.push({ key: "t:" + x.id, kind: "check", who: String(x.title).trim().replace(/^check:\s*/i, "") || "Check",
    what: `Claude's work${x.lead_email ? " · " + nameOf(x.lead_email) : ""}`, at: at(x.created_at), due: x.due_at || null, value: 0, paying: !!x.lead_email && pays([lc(x.lead_email)]), owner: founderOf(x.owner), go: { t: "todo", id: x.id }, big: !!x.big }));
  rows.forEach(r => { r.urg = wofUrg(r); });   // colour only: the order below never reads it
  return rows.sort((a, b) => (b.paying - a.paying) || (!!b.big - !!a.big) || (b.value - a.value) || (a.at - b.at));
}
/* design pass (BENAS 11-23 "more professional, just like the other cards"): the bento list row (.li / .li-n / .li-nm / .li-v) with a sprite line
   icon; the whole row is one button stretched over it (.wof-b), so "Read the draft" can sit in the row's own meta line. The draft opens in the
   lead drawer's message bubbles (.conv / .cv-m). */
const WOF_SPLIT = { reply: ["reply", "replies"], check: ["to approve", "to approve"], deal: ["deal", "deals"], hold: ["hold", "holds"], prod: ["client check", "client checks"] };
const wofRow = r => { const K = WOF_K[r.kind], x = r.draft, open = !!x && WOF.open.has(r.key), id = "wofd-" + String(x ? x.id : "").replace(/\W/g, "");
  return `<div class="li wof-r${x ? " dr" : ""}">${ic(K[1])}<span class="li-n"><span class="li-nm"><span class="wof-who">${r.urg ? `<i class="wof-dot u${r.urg}" role="img" aria-label="${WOF_UL[r.urg]}" title="${WOF_UL[r.urg]}"></i>` : ""}<span>${esc(cut(r.who, 70))}</span>${r.paying ? `<span class="chip wof-cl">client</span>` : ""}${r.owner ? `<span class="chip wof-f" title="${r.owner} decides">${r.owner[0]}</span>` : ""}</span>
    <small class="wof-ask"><span><span class="wof-kl">${K[0]}</span> · ${esc(cut(r.what, 140))}</span>${x ? `<button type="button" class="lk wof-rd" data-act="wofx" data-k="${esc(r.key)}" aria-expanded="${open}" aria-controls="${id}">${open ? "Hide the draft" : "Read the draft"}</button>` : ""}</small></span></span>
    ${r.value ? `<span class="li-v">${usd(r.value)}${r.mo ? "/mo" : ""}</span>` : ""}<span class="li-v mu${r.urg ? " u" + r.urg : ""}" title="${r.urg ? WOF_UL[r.urg] + " · " : ""}Waiting since ${esc(fDT(r.at))}">${esc(rel(r.at))}</span>
    <button type="button" class="wof-b" data-act="wof" data-k="${esc(r.key)}" aria-label="${esc(`${r.urg ? WOF_UL[r.urg] + ". " : ""}${r.who}: ${K[0]}, ${r.what}. Waiting ${ago(r.at)}. ${r.go.t === "lead" ? "Open the lead" : r.go.t === "todo" ? "Open the card on the To-dos page" : "Open it on the Clients page"}`)}"></button></div>
    ${x ? `<div class="conv wof-d" id="${id}"${open ? "" : " hidden"}>${x.lead_last_snippet ? `<div class="cv-m in"><div class="cv-meta">them · ${esc(x.lead_email)}</div><div class="cv-t">${esc(cut(x.lead_last_snippet, 400))}</div></div>` : ""}
      <div class="cv-m out"><div class="cv-meta">${esc(`our draft · from ${x.inbox || "—"} to ${x.to_email || "—"} · written by ${x.created_by || "Claude"} ${relA(r.at)}`)}</div><div class="cv-t">${esc(x.body || "")}</div></div>
      <div class="acts"><button type="button" class="act" data-act="drill" data-k="draft" data-a="${esc(x.id)}">Open the draft sheet</button></div></div>` : ""}`; };
function renderWof(d) {
  const rows = d.wof || [], n = rows.length;
  if (!WOF.el) { const el = WOF.el = document.createElement("section"); el.id = "c-wof"; el.className = "card wof"; el.dataset.tab = "home"; el.setAttribute("aria-label", "Waiting on a founder"); el.hidden = true; $("#hero").after(el); }
  WOF.rows = rows; const shown = WOF.all ? rows : rows.slice(0, 6), was = !WOF.el.hidden;
  const worst = Math.max(0, ...rows.map(r => r.urg || 0));
  const split = Object.keys(WOF_K).map(k => { const c = rows.filter(r => r.kind === k).length; return c ? `<span>${c} ${WOF_SPLIT[k][c === 1 ? 0 : 1]}</span>` : ""; }).join("");
  const html = n ? `<div class="wof-a"><header class="ch"><h2 class="ct strong">Waiting on <em class="sf">a founder</em></h2></header><p class="odo wof-n${worst ? " u" + worst : ""}" aria-label="${n} waiting${worst ? ", " + WOF_UL[worst].toLowerCase() : ""}">${n}</p><p class="hero-sub">${split}</p></div>
    <div class="wof-m"><div class="lst wof-l">${shown.map(wofRow).join("")}</div>${n > 6 ? `<button type="button" class="more" data-act="wofall" aria-expanded="${WOF.all}">${WOF.all ? "Show fewer" : `Show all (${n})`}</button>` : ""}</div>` : "";
  if (html !== WOF.html) { WOF.html = html; WOF.el.innerHTML = html; }
  WOF.el.hidden = !n;
  if (n && !was && WOF.prev && !RM) { WOF.el.classList.remove("wof-in"); void WOF.el.offsetWidth; WOF.el.classList.add("wof-in"); }   // an item landed: the card slides in
  const a = $('#snav .sn-list a[data-nav="dashboard"]'); let b = $("#sn-wof-n");
  if (a && !b) { a.insertAdjacentHTML("beforeend", `<i class="sn-badge" id="sn-wof-n" hidden></i>`); b = $("#sn-wof-n"); }
  if (b) { b.hidden = !n; b.textContent = n ? (n > 99 ? "99+" : n) : ""; b.classList.toggle("wof-bad", worst === 2); } if (a) { a.dataset.tip = n ? `Dashboard · ${n} waiting on a founder${worst === 2 ? ", act now" : ""}` : "Dashboard"; a.title = a.dataset.tip; }
  let z = $("#wof-zero"); if (!z) { $("#asof").insertAdjacentHTML("beforeend", `<span class="wof-zero" id="wof-zero" hidden>0 waiting</span>`); z = $("#wof-zero"); } z.hidden = !!n;
  if (WOF.prev) rows.filter(r => !WOF.prev.has(r.key) && !WOF.told.has(r.key)).slice(0, 3).forEach(r => toast(`Waiting on a founder: ${cut(r.who, 48)}`, WOF_K[r.kind][1], WOF_K[r.kind][2], cut(r.what, 90), "wof:" + r.key, () => wofGo(r)));   // not on the first load; once per item
  rows.forEach(r => WOF.told.add(r.key)); WOF.prev = new Set(rows.map(r => r.key));
}
const waitEl = (sel, ms = 8000) => new Promise(res => { const t0 = Date.now(), tick = () => { const el = $(sel); if (el && el.offsetParent !== null) return res(el); if (Date.now() - t0 > ms) return res(null); setTimeout(tick, 100); }; tick(); });
function wofGo(r, opener) {
  if (!r) return; const g = r.go;
  if (g.t === "lead") { openLead(g.e, opener); return; }
  pageGo(() => goPage(g.t === "todo" ? "todos" : g.p));
  if (g.t === "todo") waitEl(`#sd-board [data-card="${+g.id}"]`).then(el => { if (!el) { toast("That card is not on the To-dos board any more", "alert", "c-orange"); return; } el.click(); el.scrollIntoView({ block: "center", behavior: RM ? "auto" : "smooth" }); });   // the board's own click opens the card's panel
  else waitEl("#c-" + g.c).then(el => { if (!el) return; el.scrollIntoView({ block: "center", behavior: RM ? "auto" : "smooth" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); });
}
const CARDS = [
{ id: "brand", cls: "brand", title: "Status", mount(el) {
    el.innerHTML = `<div class="brand-top"><button type="button" class="brandrow" data-act="drill" data-k="me" data-a="" title="Your login and the shortcuts"><span class="logo"><img src="../beju-mark-sm.png" alt="" width="34" height="20"></span><span class="bt"><b>BEJÚ</b><small>Founder CRM</small></span></button>
      <div class="brand-tools"><button type="button" class="icon-btn" data-act="refresh" id="b-refresh" aria-label="Refresh now" title="Refresh now"><svg><use href="#i-refresh"/></svg></button><button type="button" class="icon-btn" data-act="signout" aria-label="Sign out" title="Sign out"><svg><use href="#i-out"/></svg></button></div></div>
      <button type="button" class="live" data-act="drill" data-k="sync" data-a="" title="Open the sync details"><span class="pulse" id="b-pulse"></span><span id="b-live">Live</span></button>
      <div class="wave"><svg viewBox="0 0 1200 96" preserveAspectRatio="none" aria-hidden="true"><path class="w2" d="M0,40 C100,10 200,10 300,40 S500,70 600,40 S800,10 900,40 S1100,70 1200,40 V96 H0Z"/><path class="w1" d="M0,52 C100,30 200,30 300,52 S500,74 600,52 S800,30 900,52 S1100,74 1200,52 V96 H0Z"/></svg>
      <div class="brand-me"><button type="button" id="b-me" data-act="drill" data-k="me" data-a="" title="Your login and the shortcuts"></button><button type="button" class="brand-date" id="b-date" data-act="drill" data-k="day" title="Open today's sends"></button></div></div>`;
  }, update(d) {
    $("#b-live").textContent = d.syncAt ? `${RT === "live" ? "Live" : "Polling"} · synced ${ago(d.syncAt)}` : "Live";
    $("#b-pulse").classList.toggle("off", !d.syncOk);   // 11-22: each job's own max_age_min decides "stale" (was a fixed 45 min)
    $("#b-me").textContent = ME ? (ME.name || ME.email) : ""; $("#b-date").textContent = dLong(d.t); $("#b-date").dataset.a = d.t;
  } },
/* 11-21 (BENAS, main page = one goal number + a work queue): the $ hero, then these four, top to bottom. Everything else lives in its tab. */
/* 11-22 (SIMAS 16:4x "home page must track the forms: lots of money sleeping there"; BENAS "Brief responses"): the top card on Home */
{ id: "forms", cls: "w2", title: "Forms: money sleeping", focus: ["forms", ""], render: d => { const F = d.forms;
    if (!F) return `${head(`Forms: <em class="sf">money sleeping</em>`, "", true)}${empty("The forms list isn't there yet.")}`;
    return `${head(`Forms: <em class="sf">money sleeping</em>`, "", true)}${big("forms", "", `${N(d.formsOpen, "usd")}<small>potential</small>`, `Open every form: stage, value, what they need${d.formsThirty ? ` (${d.formsThirty} post daily: 30/mo candidates)` : ""}`)}
    <div class="lst two">${F.slice(0, 4).map(x => liDr("form", fKey(x), `${(String(x.phone || "").replace(/\D/g, "").length >= 7) ? `<span class="li-ph" title="Phone number given">${ic("phone")}</span>` : ""}<span class="li-nm">${esc(x.name || x.email)}${String(x.phone || "").replace(/\D/g, "").length >= 7 ? `<small class="li-tel">${esc(x.phone)}</small>` : ""}</span>`, x.value_usd && x.open ? usd(x.value_usd) : esc((FST[x.stage] || [x.stage || ""])[0]), x.value_usd && x.open ? "" : "mu", `${x.name || x.email}: open the whole form`)).join("") || empty("No brief form yet.")}</div>
    ${F.length > 4 ? dB("forms", "", `Show all ${F.length}`, "more") : ""}`; } },
{ id: "bigdeals", title: "Big deals", focus: ["deals", ""], render: d => { const B = d.deals;   // source: public.big_deals_v2 (fetchAll)
    if (!B) return `${head(`Big <em class="sf">deals</em>`, "", true)}${empty("The big-deals list isn't there yet.")}`;
    const st = B.filter(x => !x.on_hold && x.days_quiet >= 7).length;
    const W = new Set((d.wof || []).filter(r => r.go.t === "lead").map(r => r.go.e)), L = B.filter(x => !(x.emails || [x.email]).some(e => W.has(lc(e))));   // 11-23: a deal waiting on a founder is listed once, in "Waiting on a founder"
    return `${head(`Big <em class="sf">deals</em>`, "", true)}${B.length ? big("deals", "", `${N(sum(B, x => +x.value_usd || 0), "usd")}<small>quoted</small>`, "Open every big deal: the quote, their words, their last reply, holds") + quiet("deals", "", `${B.length} open${st ? ` · <span class="dn">${st} gone quiet</span>` : ""}`) : ""}
    <div class="lst">${L.slice(0, 4).map(x => liLead(x.email, esc(x.name || x.email), dealVal(x))).join("") || empty(B.length ? "Every open deal waits on a founder: they are at the top of the page." : "No real quote of $600+ a month is open. Deals show here from a sent scope, a deal in the CRM, or the lead's own words.")}</div>
    ${B.length > Math.min(4, L.length) ? dB("deals", "", "Show all", "more") : ""}`; } },
{ id: "approvals", title: "Waiting for approval", focus: ["approvals", ""], render: d => { const A = d.drafts;   // nothing waiting (or no view) = "" = no card at all
    if (!A || !A.length) return "";
    return `${head(`Waiting for <em class="sf">approval</em>`, "", true)}${big("approvals", "", `${N(A.length)}<small>waiting</small>`, "Open every draft that waits for a founder")}
    <div class="lst">${A.slice(0, 4).map(x => liDr("draft", x.id, esc(nameOf(x.lead_email)), esc(rel(+new Date(x.created_at))), "mu", `Open the draft to ${nameOf(x.lead_email)}`)).join("")}</div>
    ${A.length > 4 ? dB("approvals", "", "Show all", "more") : ""}`; } },
{ id: "next", title: "Do next", page: "todos", focus: ["next", ""], render: d => `${head(`Do <em class="sf">next</em>`, "", true)}${big("next", "", `${N(d.todoN)}<small>to do</small>`, "Open the whole list, most urgent first")}
    <div class="lst">${d.todo.slice(0, 5).map(nextLi).join("")}</div>
    ${(h => h.length ? quiet("holds", "", `On hold: ${esc(h.map(x => cut(String(x.client || "").replace(/\s*\(.*?\)/g, ""), 24)).join(", "))}`, "Open the holds: who, the rule, who lifts it") : "")(d.holds.filter(x => wofFresh("hold", x.created_at ? +new Date(x.created_at) : 0)))}
    ${d.todoN > 5 || d.todoMore.length || d.todoLater.length ? dB("next", "", "Show all", "more") : ""}` },
/* 11-21 (SIMAS: "a square that says action"; BENAS: lower on the main page, under Do next) */
{ id: "activity", title: "Activity", focus: ["feed", ""], render: d => { const all0 = d.feed.filter(e => !e.quiet), html = `${head("Activity", "", true)}<div class="feed lite">${all0.slice(0, 5).map(e => feedRow(e, feedSeen.size > 0 && !feedSeen.has(e.t + e.title), true)).join("") || empty("Nothing has happened yet.")}</div>${all0.length > 5 ? dB("feed", "", "Show all", "more") : ""}`;
    d.feed.forEach(e => feedSeen.add(e.t + e.title)); return html; } },
{ id: "today", title: "Today", render: d => { const T = d.td, I = { call: ["phone", "c-blue"], payment_failed: ["alert", "c-red"], action: ["check", "c-green"], partner: ["flag", "c-orange"], sample_due: ["film", "c-purple"], followup: ["clock", "c-grey"] }, items = d.todayItems, list = STATE.todayAll ? items : items.slice(0, 4), pct = d.target ? Math.round(d.todayNew / d.target * 100) : 0;
    /* 11-19 (Simas: "looks ugly w this structure"): one clean 3x2 grid, label on top, one value; 11-21: a ▲/▼ chip on the valuable ones instead of sub-lines */
    const cell = (label, val, k, a, chg = "") => dB(k, a, `<span class="tl">${label}</span><b>${val}</b>${chg}`, "tc", `${label}: open the list`), part = { part: true, tip: "Today so far against yesterday's full day" };
    return `${head(`Today <em class="sf">${esc(dLabel(d.t))}</em>`, T.stuck ? `<span class="tchips">${dB("todaylist", "", `${T.stuck} money stuck`, "chip r", "Payments that failed today")}</span>` : "", true)}
    ${big("day", d.t, `${N(d.todayNew)}<small>/ ${nf0.format(d.target)} new leads today</small>${dl(pctChg(d.todayNew, d.yNew), "vs yesterday", part)}`, "Open today's split per campaign")}
    ${dB("day", d.t, bar(pct, pct >= 100 ? "c-green" : ""), "barb", `${pct}% of today's target of ${nf0.format(d.target)} new leads`)}
    ${kv("Sending today", `up to ${N(d.inb.capOn)}`, "sending", "", "sp")}${dB("sending", "", bar(d.inb.capOn ? d.todaySent / d.inb.capOn * 100 : 0), "barb", `${nf0.format(d.todaySent)} of up to ${nf0.format(d.inb.capOn)} sent today`)}
    <div class="tgrid">${cell("Sent", N(d.todaySent), "day", d.t, dl(pctChg(d.todaySent, d.yd.sent), "vs yesterday", part))}${cell("Replies", N(T.rep), "replies", "", dl(pctChg(T.rep, d.yd.rep), "vs yesterday", part))}${cell("Money", N(T.money, "usd"), "pays", d.t, dl(pctChg(T.money, d.yd.money), "vs yesterday", { tip: "Today so far against yesterday up to the same time" }))}${cell("Videos", N(T.vids), "vids", d.t)}${cell("Samples", N(T.samples), "samples", "week")}${cell("Calls", N(T.calls), "todaylist", "")}</div>
    <div class="stack sp">${list.map(x => { const [icon, c] = I[x.kind] || ["clock", "c-grey"]; const inner = `<span class="it ${c}"><svg><use href="#i-${icon}"/></svg></span><span class="row-main"><b>${esc(cut(x.title, 60))}</b></span>${x.kind === "call" && x.at ? `<span class="row-end">${timeOf(x.at)}</span>` : ""}`;
      return x.lead_email ? leadBtn(x.lead_email, inner) : dB("item", x.id, inner, "tile row"); }).join("") || empty("Nothing else on today's list.")}</div>
    ${items.length > 4 ? `<button type="button" class="more" data-act="todayall">${STATE.todayAll ? "Show fewer" : `Show all ${items.length}`}</button>` : ""}`; } },
{ id: "paidc", title: "Paid clients", page: "clients", focus: ["paid", ""], render: d => `${head("Paid clients", "", true)}${big("retainers", "", `${N(d.ret.live.length)}<small>monthly</small>`, "Monthly = a live Stripe subscription. Open the monthly clients.")}
    <div class="lst">${liDr("paid", "", "Ever paid", N(d.paidEver), "", "Open every paid client: very hot, future valuable, promises, next steps")}${liDr("vids", d.ym, "Shorts delivered this month", N(d.vid.month), "", "Open this month's Shorts")}</div>
    ${dB("paid", "", "Show all", "more")}` },
{ id: "retainers", title: "Retainers", focus: ["retainers", ""], render: d => { const R0 = d.ret;   // 11-17 (Simas): recurring clients, only those who bought a retainer
    return `${head("Retainer <em class=\"sf\">clients</em>", "", true)}${big("retainers", "", `${N(R0.live.length)}<small>on a retainer</small>`, "Open every retainer: amount, since when, next bill")}
    <div class="stack sp">${R0.live.map(r => dB("retainers", "", `<span class="av">${esc(initials({ name: r.name || r.email }))}</span><span class="row-main"><b>${esc(cut(r.name || r.email || "Client", 40))}</b></span><span class="row-end">${usd(r.amount)}${r.interval && r.interval !== "month" ? `<small>/${esc(r.interval)}</small>` : ""}</span>`, "tile row", "Open the retainers")).join("") || empty("No retainer yet. Monthly plans show here.")}</div>
    ${kv("Per month", usd(R0.mrr), "retainers", "")}${kv("Paid on retainers so far", usd(R0.total), "retainers", "")}${R0.ended ? kv("Ended retainers", N(R0.ended), "retainers", "") : ""}`; } },
{ id: "holds", title: "On hold", focus: ["holds", ""], render: d => `${head(`On <em class="sf">hold</em>`, dB("holds", "", d.holds.length ? `${d.holds.length} active` : "none", `chip ${d.holds.length ? "r" : "g"}`, "Open every hold: who it covers, the rule, who set it"), true)}<div class="stack">${d.holds.slice(0, 5).map(holdRow).join("") || empty("Nothing is on hold.")}</div>
    ${d.holds.length > 5 ? dB("holds", "", `Show all ${d.holds.length}`, "more") : ""}` },
{ id: "prod", title: "In production", focus: ["prod", ""], render: d => { const w = d.prod.filter(x => x.stage === "founder_check").length;
    return `${head(`In <em class="sf">production</em>`, dB("prod", "", `${d.prod.length} open`, `chip ${w ? "o" : ""}`, "Open every piece of client work: stage, who builds it, the file"), true)}<div class="stack">${d.prod.slice(0, 6).map(prodRow).join("") || empty("Nothing is in production.")}</div>
    ${d.prod.length > 6 ? dB("prod", "", `Show all ${d.prod.length}`, "more") : ""}`; } },
{ id: "outreach", cls: "w2 chart-card", title: "Outreach", page: "email", focus: ["days", ""], render: d => {
    const OR = d.M && d.M.periods ? d.M.periods[STATE.range + "d"] : null, days = d.series.slice(-STATE.range), W = 600, H = 200, pad = 10, max = Math.max(1, ...days.map(x => Math.max(STATE.sa ? x.sent : 0, STATE.sb ? x.nw : 0)));
    const pa = lineXY(days.map(x => x.sent), W, H, pad, max), pb = lineXY(days.map(x => x.nw), W, H, pad, max), part = days.length > 2 && days[days.length - 1].day === d.t, n = part ? -1 : undefined,
      A = smooth(pa.slice(0, n), pad, H - pad), B = smooth(pb.slice(0, n), pad, H - pad), ax = part ? pa[pa.length - 2][0].toFixed(1) : W,
      dash = (q, c) => part ? `<line class="${c} part" x1="${q[q.length - 2][0].toFixed(1)}" y1="${q[q.length - 2][1].toFixed(1)}" x2="${q[q.length - 1][0].toFixed(1)}" y2="${q[q.length - 1][1].toFixed(1)}"/>` : "";
    PLOT.out = { n: days.length, i: days.length - 1, paint: i => paintOut(days, max, H, pad, i), drill: i => openDrill("day", days[i].day) };
    const ticks = [...new Set([0, .25, .5, .75, 1].map(f => Math.round(f * (days.length - 1))))], lg = (s, c, label, v) => `<button type="button" class="lgt${STATE[s] ? "" : " off"}" data-act="series" data-s="${s}" aria-pressed="${STATE[s]}" title="Show or hide this line"><i class="dot round ${c}"></i>${label} <b>${v}</b></button>`;
    return `${head("Outreach", `<span class="lgd">${lg("sa", "c-blue", "Sent", N(OR ? OR.sent : sum(days, x => x.sent)))}${lg("sb", "c-orange", "New leads", N(OR ? OR.contacted : sum(days, x => x.nw)))}</span><span class="rng" role="group" aria-label="Range">${[7, 14, 30].map(r => `<button type="button" data-act="range" data-r="${r}" class="${STATE.range === r ? "on" : ""}" aria-pressed="${STATE.range === r}">${r}d</button>`).join("")}</span>`, true)}
    <div class="chart plot" id="chart" data-plot="out" tabindex="0" role="group" aria-label="Emails sent and new leads per day. Arrow keys move through the days, Enter opens the day."><svg class="lines" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="g-chart" x1="0" y1="0" x2="0" y2="1"><stop class="stop-a" offset="0"/><stop class="stop-b" offset="1"/></linearGradient></defs>
      ${[.25, .5, .75].map(f => `<line class="gl" x1="0" x2="${W}" y1="${(H * f).toFixed(0)}" y2="${(H * f).toFixed(0)}"/>`).join("")}${STATE.sa ? `<path class="aa" d="${A}L${ax},${H}L0,${H}Z"/>` : ""}${STATE.sb ? `<path class="lb" d="${B}"/>${dash(pb, "lb")}` : ""}${STATE.sa ? `<path class="la" d="${A}"/>${dash(pa, "la")}` : ""}</svg>
      <i class="cur"></i><i class="cdot a c-blue"></i><i class="cdot b c-orange"></i><div class="tip"></div></div>
    <div class="xl">${ticks.map(i => `<span class="${i === days.length - 1 ? "on" : ""}">${i === days.length - 1 ? "Today" : dLabel(days[i].day)}</span>`).join("")}</div>`;
  } },
{ id: "close", cls: "feat tilt", title: "Emails to close", focus: ["close", ""], render: d => { const C = d.close, c1 = 2 * Math.PI * 62, p = clamp(C.in5 || 0, 0, 100);   // 11-16 (Simas): replaces the 10k goal card (the goal stays in the hero)
    return `${head(`Emails to <em class="sf">close</em>`)}
    ${dB("close", "", `<svg viewBox="0 0 150 150" aria-hidden="true"><circle class="tr" cx="75" cy="75" r="62"/><circle class="pr" cx="75" cy="75" r="62" data-v="p:${(c1 * p / 100).toFixed(1)}"/></svg>
      <span class="ring-mid"><span><b>${C.med == null ? "—" : Number.isInteger(C.med) ? N(C.med) : C.med.toFixed(1)}</b><small>emails, typical</small></span></span>`, "ring", "Ring: share of paying clients who paid within 5 of our emails. Middle: the typical (median) number of emails we sent before a client's first payment. Open the list.")}
    ${quiet("close", "", `${C.in5 == null ? "—" : N(C.in5, "pct")} paid within 5 emails`, "Open the list: emails sent before each first payment")}`; } },
{ id: "hot", title: "Hot leads", focus: ["hotlist", ""], render: d => `${head("Hot leads", sortB("hotSort", STATE.hotSort, { wait: "waiting on us", next: "next action", reply: "last reply" }), true)}${big("hotlist", "", `${N(d.hot.length)}<small>hot now</small>`, "Open every hot lead")}
    <div class="lst">${d.hot.slice(0, 5).map(({ p, us }) => liLead(p.email, `${us ? `<i class="li-dot" title="Waiting on us"></i>` : ""}<span>${esc(p.name || p.email)}</span>`)).join("") || empty("No hot leads right now.")}</div>
    ${d.hot.length > 5 ? dB("hotlist", "", "Show all", "more") : ""}` },
{ id: "moods", title: "Buyer moods", render: d => `${head("Buyer moods")}
    <div class="tile row-pad"><div class="segbar">${d.moods.map(m => `<button type="button" class="${m.c}" data-act="drill" data-k="mood" data-a="${m.k}" data-v="g:${m.n}" title="${m.label}: ${m.n}" aria-label="${m.label}: ${m.n} leads. Open them."></button>`).join("")}</div>
    <div class="legend">${d.moods.map(m => dB("mood", m.k, `<i class="dot ${m.c}"></i><span>${m.label}</span><b>${m.n}</b>`, "lg")).join("") || empty("No leads.")}</div></div>` },
{ id: "attention", title: "Needs attention", render: d => { const K = { reply: ["Replies waiting", "mail", "c-blue"], followup: ["Follow-ups due", "clock", "c-orange"], overdue: ["Overdue actions", "alert", "c-red"], paid_waiting: ["Paid, not delivered", "cash", "c-green"], promises: ["Promises past due", "flag", "c-ink"], brief: ["Said yes, no brief", "film", "c-purple"], followup_done: ["Finished, park", "check", "c-grey"], no_next: ["No next step", "alert", "c-orange"], promise: ["Promise due", "flag", "c-ink"] };
    const kinds = Object.keys(K).filter(k => d.att[k]?.length).concat(Object.keys(d.att).filter(k => !K[k]));
    return `${head("Needs attention", dB("att", "all", d.attTotal, `chip ${d.attTotal ? "o" : "g"}`, "Open everything that needs attention"), true)}<div class="stack">${kinds.map(k => { const [label, icon, c] = K[k] || [keyLabel(k), "alert", "c-grey"], list = d.att[k], open = STATE.att === k;
      return `<div class="tile"><button type="button" class="row" data-act="att" data-k="${esc(k)}" aria-expanded="${open}"><span class="it ${c}"><svg><use href="#i-${icon}"/></svg></span><span class="row-main"><b>${esc(label)}</b></span><span class="row-end">${list.length}</span></button>
        ${open ? `<div class="names">${list.slice(0, 10).map(x => `<button type="button" data-act="lead" data-email="${esc(x.email)}" title="${esc(cut(x.detail, 140))}">${esc(cut(x.name, 30))}${x.due ? ` · <span class="mut">${dLabel(dayOf(x.due))}</span>` : ""}</button>`).join("")}${list.length > 10 ? dB("att", k, `+${list.length - 10} more`, "lk") : ""}</div>` : ""}</div>`; }).join("") || empty("Nothing waiting. All clear.")}</div>`; } },
{ id: "total", title: "Sent in total", render: d => `${head("Sent in total")}${big("sent", "", `${N(d.sentAll)}<small>emails</small>`, "Open the totals per campaign")}
    <div class="stack sp">${kv("Leads contacted", N(d.contacted), "sent", "")}${kv("Leads loaded", N(d.loaded), "sent", "")}${kv("Still queued", N(d.queued), "queued", "")}</div>
    ${dB("queued", "", bar(d.loaded ? d.contacted / d.loaded * 100 : 0), "barb", "Leads contacted out of leads loaded. Open what is still queued.")}` },
{ id: "heat", title: "Lead heatmap", render: d => { const flat = []; for (let w = 0; w < 8; w++) for (let r = 0; r < 7; r++) flat.push(d.heat.rows[r][w]); const live = flat.filter(c => !c.fut);
    PLOT.heat = { n: live.length, i: live.length - 1, paint: i => { const c = live[i]; $$("#heat .hc").forEach(el => el.classList.toggle("sel", el.dataset.a === c.day)); const cap = $("#heat-cap"); if (cap) cap.textContent = `${dLong(c.day)} · ${nf0.format(c.n)} new leads`; }, drill: i => openDrill("day", live[i].day) };
    return `${head("New leads, 8 weeks")}<div class="heat plot" id="heat" data-plot="heat" tabindex="0" role="group" aria-label="New leads per day for 8 weeks. Arrow keys move through the days, Enter opens the day.">${d.heat.rows.map((row, r) => `<small>${"MTWTFSS"[r]}</small>` + row.map((c, w) => c.fut ? `<i class="fut"></i>` : `<i class="hc${c.day === d.t ? " now" : ""}" data-i="${live.indexOf(c)}" data-a="${c.day}" data-v="o:${(c.n / d.heat.max).toFixed(2)};k:${w * 7 + r}" title="${dLong(c.day)}: ${nf0.format(c.n)} new leads"></i>`).join("")).join("")}</div>
    <div class="heat-l"><span>${dLabel(d.heat.weeks[0])}</span><span id="heat-cap">tap a day</span><span>this week</span></div>`; } },
{ id: "samples", title: "Samples done", render: d => { const L = Math.PI * 75, p = clamp(d.samples.conv || 0, 0, 100), a = Math.PI - Math.PI * p / 100, kx = 85 + 75 * Math.cos(a), ky = 90 - 75 * Math.sin(a);
    return `${head("Samples done")}${big("samples", "", `${N(d.samples.total)}<small>delivered</small>`, "Open the delivered samples")}
    ${dB("samples", "buyers", `<svg viewBox="0 0 170 96" aria-hidden="true"><path class="tr" d="M10,90 A75,75 0 0 1 160,90"/><path class="pr" d="M10,90 A75,75 0 0 1 160,90" data-v="p:${(L * p / 100).toFixed(1)}"/><circle cx="${kx.toFixed(1)}" cy="${ky.toFixed(1)}" r="5.5" class="knob"/></svg>
      <span class="gauge-mid"><b>${N(d.samples.conv, "pct1")}</b><span class="sub">sample → buyer</span></span>`, "gauge", `${d.samples.buyers} of ${d.samples.total} samples became buyers. Open them.`)}
    <div class="trio">${tri("Buyers", N(d.samples.buyers), "samples", "buyers")}${tri("In edit", N(d.samples.wip), "samples", "wip")}</div>`; } },
{ id: "turn", title: "Sample turnaround", focus: ["samples", "recent"], render: d => { const T = d.turn, max = Math.max(1, ...T.map(w => w.med || 0)), cur = [...T].reverse().find(w => w.med != null);
    return `${head("Sample turnaround", "", true)}${big("samples", cur ? "w:" + cur.s : "recent", cur ? `${N(cur.med, "h1")}<small>median, week of ${dLabel(cur.s)}</small>` : "—", "Open the samples of that week")}
    <div class="wk mini">${T.map((w, i) => `<button type="button" class="${i === 7 ? "on" : ""}" data-act="drill" data-k="samples" data-a="w:${w.s}" data-v="h:${(w.med == null ? 0 : w.med / max * 100).toFixed(1)}%;k:${i}" title="Week of ${dLabel(w.s)}: ${w.med == null ? "no samples" : w.med.toFixed(1) + " h median, " + w.n + " samples"}" aria-label="Week of ${dLabel(w.s)}: ${w.med == null ? "no samples" : w.med.toFixed(1) + " hours median"}. Open them."></button>`).join("")}</div>`; } },
{ id: "followups", title: "Follow-ups", page: "todos", focus: ["fu", "week"], render: d => { const sel = d.fuDays.find(x => x.day === STATE.day) || d.fuDays[0];
    return `${head("Follow-ups", "", true)}${quiet("fu", "week", `${d.fuWeek} due this week`)}
    <div class="days">${d.fuDays.map(x => `<button type="button" data-act="day" data-d="${x.day}" class="${x.day === sel.day ? "on" : ""}${x.list.length ? " has" : ""}" aria-pressed="${x.day === sel.day}" aria-label="${dLabel(x.day)}: ${x.list.length} due"><small>${DOW[dow(x.day)]}</small><b>${+x.day.slice(8)}</b><i></i></button>`).join("")}</div>
    <div class="lst duelist">${sel.list.slice(0, 4).map(f => liLead(f.email, esc(f.name || f.email))).join("") || empty(`Nobody due on ${dLabel(sel.day)}.`)}</div>${sel.list.length > 4 ? dB("fu", sel.day, `+${sel.list.length - 4} more`, "more") : ""}`; } },
{ id: "rate", title: "Reply rate", render: d => `${head("Reply rate")}<div class="hrow">${big("sent", "rate", N(d.replyRate, "pct1"), "Open the reply rate per campaign")}${d.rateDelta == null ? "" : dB("days", "", `<i class="tri"></i>${d.rateDelta >= 0 ? "+" : "−"}${Math.abs(d.rateDelta).toFixed(1)} pts`, `delta ${d.rateDelta >= 0 ? "up" : "dn"}`, "Last 7 days against the 7 before. Open the days.")}</div>
    <div class="trio">${tri("Positive", `<span class="up">${N(d.posRate, "pct1")}</span>`, "funnel", "2")}${tri("Real", N(d.repAll), "replies", "real")}${tri("Auto", N(d.autoAll), "away", "")}</div>` },
{ id: "speed", title: "Speed to reply", render: d => { const S = d.speed, max = Math.max(1, ...S.weeks.map(w => w.med || 0));
    return `${head("Speed to reply")}${big("speed", "", S.all == null ? "—" : esc(fmtMin(S.all)), "Open every answered reply with its waiting time")}
    <div class="wk mini">${S.weeks.map((w, i) => `<button type="button" class="${i === 7 ? "on" : ""}" data-act="drill" data-k="speed" data-a="${w.s}" data-v="h:${(w.med == null ? 0 : w.med / max * 100).toFixed(1)}%;k:${i}" title="Week of ${dLabel(w.s)}: ${w.med == null ? "no answered replies" : fmtMin(w.med) + " median, " + w.n + " replies"}" aria-label="Week of ${dLabel(w.s)}: ${w.med == null ? "no answered replies" : fmtMin(w.med) + " median"}. Open them."></button>`).join("")}</div>
    <div class="trio">${tri("Last 7 days", esc(fmtMin(S.w)) + dl(pctChg(S.w, S.pw), "vs last week", { inv: true, tip: "Median of the last 7 days against the 7 days before. Lower is better." }), "speed", "7")}${tri("Within 1 h", S.h1 == null ? "—" : N(S.h1, "pct"), "speed", "fast")}${tri("Slowest", esc(fmtMin(S.max)), "speed", "slow")}</div>`; } },
{ id: "clock", title: "Reply clock", render: d => { const C = d.clock, R0 = 46, LEN = 40, pos = (h, r) => { const a = h / 24 * 2 * Math.PI - Math.PI / 2; return [(100 + r * Math.cos(a)).toFixed(1), (100 + r * Math.sin(a)).toFixed(1)]; };
    PLOT.clock = { n: 24, i: C.peak, paint: i => { $$("#clock .cb").forEach(el => el.classList.toggle("on", +el.dataset.h === i)); const m = $("#clock-mid"); if (m) m.innerHTML = `<span><b>${String(i).padStart(2, "0")}:00</b><small>${C.h[i]} repl${C.h[i] === 1 ? "y" : "ies"}</small></span>`; }, drill: i => openDrill("hour", i) };
    return `${head("Reply clock")}<div class="clock plot" id="clock" data-plot="clock" tabindex="0" role="group" aria-label="Real replies by hour of the day, ${esc(TZ)} time. Arrow keys move through the hours, Enter opens the replies of that hour.">
      <svg viewBox="0 0 200 200" aria-hidden="true"><circle class="cr" cx="100" cy="100" r="${R0 - 5}"/>${C.h.map((n, h) => { const [x1, y1] = pos(h, R0), [x2, y2] = pos(h, R0 + LEN), l = n ? Math.max(3, n / C.max * LEN) : 0;
        return `<line class="cb${h === C.peak && n ? " pk" : ""}" data-h="${h}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" data-v="l:${l.toFixed(1)};k:${h}"/><line class="hit" data-i="${h}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><title>${String(h).padStart(2, "0")}:00 · ${n} repl${n === 1 ? "y" : "ies"}</title></line>`; }).join("")}
        ${[0, 6, 12, 18].map(h => { const [x, y] = pos(h, R0 + LEN + 10); return `<text x="${x}" y="${y}">${String(h).padStart(2, "0")}</text>`; }).join("")}</svg>
      <div class="clock-mid" id="clock-mid"><span><b>${String(C.peak).padStart(2, "0")}:00</b><small>busiest hour</small></span></div></div>`; } },
{ id: "camps", title: "Campaigns", page: "email", render: d => `${head("Campaigns", sortB("campSort", STATE.campSort, { sent: "most sent", rate: "best reply %" }), true)}<div class="lst">${d.camps.slice(0, 5).map(c => { const rr = c.new_contacted ? (c.replies || 0) / c.new_contacted * 100 : null;
      return liDr("camp", c.campaign_id, `<span title="${esc(c.name)}">${esc(campName(c.name))}</span>`, rr == null ? "—" : rr.toFixed(1) + "%"); }).join("") || empty("No campaign data.")}</div>
    ${d.camps.length > 5 ? dB("sent", STATE.campSort === "rate" ? "rate" : "", "Show all", "more") : ""}` },
{ id: "deliv", title: "Deliverability", render: d => `${head("Deliverability")}${big("deliv", "", `${N(d.deliv.rate, "pct1")}<small>bounced</small>`, "Open bounces per campaign")}
    ${dB("deliv", "", bar(clamp(d.deliv.rate / 3 * 100, 0, 100), d.deliv.rate > 2 ? "c-red" : "c-green"), "barb", "Bounce rate against the 3% danger line")}
    <div class="stack sp">${d.deliv.worst.map(c => dB("camp", c.campaign_id, `<span>${esc(cut(campName(c.name), 22))}</span><span>${c.rate.toFixed(1)}%</span>`, "kv")).join("")}</div>
    <div class="trio">${tri("Bounced", N(d.bounced), "deliv", "")}${tri("Unsubscribed", N(d.deliv.unsub), "deliv", "")}</div>` },
{ id: "buyers", title: "Buyers", page: "clients", focus: ["pays", "all"], render: d => `${head("Buyers", "", true)}<div class="lst">${d.recentPays.slice(0, 4).map(p => liDr("client", payKey(p), esc(cut(p.payer_name || p.email || "Payment", 30)), `+$${nf0.format(p.amount)}`, "up")).join("") || empty("No payments yet.")}</div>
    ${d.payN > 4 ? dB("pays", "all", "Show all", "more") : ""}` },
{ id: "topc", title: "Top clients", page: "clients", focus: ["clients", ""], render: d => `${head("Top clients", "", true)}<div class="lst">${d.top.slice(0, 4).map(x => liDr("client", x.key, esc(cut(x.name, 30)), usd(x.total))).join("") || empty("No payments yet.")}</div>
    ${d.buyersN > 4 ? dB("clients", "", "Show all", "more") : ""}` },
{ id: "alltime", title: "All-time money", render: d => `${dB("pays", "all", `<span class="it c-blue"><svg><use href="#i-flag"/></svg></span><span class="row-main"><b>Next milestone $${nf0.format(d.nextMs)}</b></span><span class="big sm">${N(d.msPct, "pct")}</span>`, "row np", "Open every payment")}
    ${dB("pays", "all", bar(d.msPct), "barb", "Progress to the next $1,000 milestone")}
    <div class="tile row-pad sp2">${kv("Money generated, all time", N(d.allTime, "usd"), "pays", "all")}${kv("To go", N(d.nextMs - d.allTime, "usd"), "pays", "all")}</div>` },
{ id: "contacts", title: "Contacts", mount(el) {
    el.innerHTML = `<header class="ch"><button type="button" class="ct strong go" data-act="page" data-p="contacts" title="Open the Contacts page">Contacts${ic("chev")}</button></header>
      <label class="search ctc-s">${ic("search")}<input class="ctc-q" type="search" placeholder="Search people" aria-label="Search contacts by name, show or email" autocomplete="off" spellcheck="false"></label>
      <div class="lst ctc-l" aria-live="polite"></div><a class="more ctc-all" href="?p=contacts" data-act="page" data-p="contacts">See all</a>`;
    $(".ctc-q", el).addEventListener("input", () => this.update());
    el.addEventListener("click", ev => { if (!ev.target.closest(".ctc-all")) return; if (ev.metaKey || ev.ctrlKey || ev.shiftKey) ev.stopPropagation(); else ev.preventDefault(); });   // the router moves the page; a modified click opens a new tab
  }, update() {
    const el = this.el, L = $(".ctc-l", el); if (!L || !RAW) return; const q = lc($(".ctc-q", el).value).split(/\s+/).filter(Boolean), P = ctcPeople();
    const rows = (q.length ? P.filter(x => q.every(w => x.q.includes(w))) : P.filter(x => x.at)).sort((a, b) => b.at - a.at).slice(0, 5);
    const html = rows.map(ctcRow).join("") || empty(q.length ? "No one matches. Try part of a name, a show or an email." : "No one has written to us yet.");
    if (L.innerHTML !== html) L.innerHTML = html;
  } },
{ id: "pipeline", title: "Pipeline", focus: ["pipeline", ""], render: d => { const F = d.fc;   // 11-21 (Simas: "clear pipeline stages ... keeping forecasts realistic"); stage counts are in the sheet
    if (!F) return `${head("Pipeline", "", true)}${empty("The stage numbers aren't there yet.")}`;
    return `${head("Pipeline", "", true)}${big("pipeline", "", `${N(F.total)}<small>open leads</small>`, "Leads in an open stage. Open them, stage by stage.")}
    ${F.overdue ? quiet("pipeline", "overdue", `<span class="dn">${F.overdue} overdue</span> in their stage`, "Open the leads that sat in their stage too long") : ""}`; } },
{ id: "funnel", title: "Funnel", page: "email", render: d => { const max = Math.max(1, d.funnel[0][1]);
    return `${head("Funnel, all time", "", true)}<div class="fun">${d.funnel.map(([label, v, c], i) => dB("funnel", i, `<span class="fl"><span>${label}</span><b>${N(v)}</b></span><span class="fb"><i class="${c}" data-v="w:${clamp(Math.sqrt(v / max) * 100, v ? 5 : 0, 100).toFixed(1)}%;k:${i}"></i></span>`, "fr", `${label}: ${nf0.format(v)}. Open them.`)).join("")}</div>`; } },
{ id: "away", title: "Away leads", render: d => `${head("Away, last 7 days")}${big("away", "", `${N(d.away.length)}<small>leads away</small>`, "Open every lead that is away")}
    <div class="stack sp">${d.away.slice(0, 3).map(r => leadBtn(r.lead_email, `<span class="it c-grey"><svg><use href="#i-moon"/></svg></span><span class="row-main"><b>${esc(cut(r.lead_email, 30))}</b></span>`)).join("") || empty("No auto-replies this week.")}</div>` },
{ id: "inboxes", title: "Inboxes", page: "email", render: d => `${head("Inboxes", "", true)}${big("inboxes", "", `${N(d.inb.sent)}<small>/ ${nf0.format(d.inb.cap)} sent today</small>`, "Open every inbox")}
    ${quiet("inboxes", "", `${d.inb.n} inboxes active`)}
    <div class="wk mini ib">${d.inbList.map((i, k) => `<button type="button" class="${i.status === 1 ? "" : "off"}" data-act="drill" data-k="inbox" data-a="${esc(i.email)}" data-v="h:${(i.daily_limit ? clamp((i.sent_today || 0) / i.daily_limit * 100, 0, 100) : 0).toFixed(1)}%;k:${k / 2}" title="${esc(i.email)}: ${i.sent_today || 0} of ${i.daily_limit || 0} sent today" aria-label="${esc(i.email)}: ${i.sent_today || 0} of ${i.daily_limit || 0} sent today. Open this inbox."></button>`).join("")}</div>` },
{ id: "videos", title: "Videos delivered", render: d => { const max = Math.max(1, ...d.vid.weeks.map(w => w.n));
    return `${head("Shorts delivered")}${big("vids", "all", `${N(d.vid.total)}<small>unique Shorts</small>`, "Unique Shorts sent to clients (a v2 of the same Short counts once). Open them.")}
    <div class="wk mini">${d.vid.weeks.map((w, i) => `<button type="button" class="${i === 7 ? "on" : ""}" data-act="drill" data-k="vids" data-a="${w.s}" data-v="h:${(w.n / max * 100).toFixed(1)}%;k:${i}" title="Week of ${dLabel(w.s)}: ${w.n} new Shorts" aria-label="Week of ${dLabel(w.s)}: ${w.n} new Shorts. Open them."></button>`).join("")}</div>`; } },
{ id: "portal", title: "Client portal numbers", render: d => `${head("Client portal", `<button type="button" class="chip ${d.pOpen ? "o" : ""}" data-act="jump" data-id="psamples" title="Jump to the portal queues">${d.pOpen} open</button>`)}<button type="button" class="big tapn" data-act="jump" data-id="pclients" title="Jump to the portal sign-ups">${N(d.portal.signups)}<small>sign-ups</small></button>
    <div class="stack sp"><button type="button" class="kv" data-act="jump" data-id="psamples"><span>Sample requests</span><span>${N(d.portal.req)}</span></button><button type="button" class="kv" data-act="jump" data-id="pvideos"><span>Videos in edit</span><span>${N(d.portal.edit)}</span></button><button type="button" class="kv" data-act="jump" data-id="pvideos"><span>Videos ready</span><span>${N(d.portal.ready)}</span></button></div>` },
/* 11-22 (crm-api): sync_status also holds watcher heartbeats (hb:<side>:<process>). Jobs keep their tiles; the watchers sit on one line.
   Fresh = within the row's own max_age_min (no limit set = no colour). */
{ id: "sync", title: "Sync status", render: d => `<div class="stack">${d.sync.map(s => { const c = !s.ok ? ["c-red", "alert"] : s.stale ? ["c-orange", "clock"] : ["c-ink", "check"];
      return dB("sync", s.name, `<span class="it ${c[0]}"><svg><use href="#i-${c[1]}"/></svg></span><span class="row-main"><b>${esc({ instantly: "Sending", replies: "Replies", sheet: "Samples" }[s.name] || s.name)}</b></span><span class="row-end"><small class="${s.stale ? "dn" : ""}">${ago(s.ran_at)}</small></span>`, "tile row", s.max_age_min ? `${s.name}: runs at least every ${s.max_age_min} min` : s.name); }).join("") || empty("No sync info.")}</div>
    ${d.beats.length ? dB("sync", "", `<span class="it ${d.beats.some(b => b.stale) ? "c-orange" : "c-ink"}"><svg><use href="#i-bolt"/></svg></span><span class="row-main"><b>Watchers</b><small>${d.beats.map(b => `<span class="${b.stale ? "dn" : ""}">${esc(b.side)} · ${esc(b.proc)} · ${esc(ago(b.ran_at))}${b.stale ? " (stale)" : ""}</span>`).join(" · ")}</small></span>`, "tile row sp", "The watcher processes on each Mac: their last heartbeat") : ""}` },
{ id: "moneypage", title: "Money page", mount(el) { el.innerHTML = `${head("💰 Money")}<div class="acts sp"><a class="act go" href="money.html">${ic("cash")}Open the Money page</a></div>`; }, update() {} },
{ id: "price", title: "Price calculator", mount(el) {   // 11-18 (Simas): drag to N Shorts a month, see the monthly retainer. Reads and writes nothing.
    el.innerHTML = `${head("Price calculator")}<div class="big" id="calc-p"></div><p class="sub" id="calc-per"></p>
      <div class="calc-in"><label for="calc-r">Shorts a month</label><input id="calc-n" type="number" min="1" max="120" step="1" inputmode="numeric" aria-label="Shorts a month, type a number" aria-describedby="calc-p calc-per"></div>
      <input id="calc-r" type="range" min="1" max="120" step="1">
      <div class="rng" role="group" aria-label="Quick picks">${[5, 10, 15, 30, 60].map(v => `<button type="button" data-s="${v}" aria-pressed="false">${v}</button>`).join("")}</div>`;
    const r = $("#calc-r", el), n = $("#calc-n", el);
    const set = (v, from) => { const p = priceFor(v), per = nf1.format(p / v);
      if (from !== r) r.value = v; if (from !== n) n.value = v;
      r.setAttribute("aria-valuetext", `${v} Short${v === 1 ? "" : "s"} a month: ${usd(p)} a month, $${per} per Short`);
      $("#calc-p", el).innerHTML = `${usd(p)}<small> / month</small>`;
      $("#calc-per", el).textContent = `$${per} per Short`;
      $$(".rng button", el).forEach(b => { const on = +b.dataset.s === v; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); }); };
    r.addEventListener("input", () => set(+r.value, r));
    n.addEventListener("input", () => { const v = +n.value; if (n.value !== "" && Number.isInteger(v) && v >= 1 && v <= 120) set(v, n); });
    n.addEventListener("change", () => set(clamp(Math.round(+n.value) || +r.value, 1, 120)));
    $(".rng", el).addEventListener("click", ev => { const b = ev.target.closest("button[data-s]"); if (b) set(+b.dataset.s); });
    set(15);
  } },
/* ---- client portal zone (second grid) ---- */
{ id: "psamples", grid: 2, title: "Portal: sample requests", focus: ["psamples", ""], render: d => `${head("Free sample requests", "", true)}<div class="stack">${d.pSamples.slice(0, 3).map(sampleTile).join("") || empty("No sample request yet. New ones land here the moment a client asks.")}</div>${d.pSamples.length > 3 ? dB("psamples", "", `Show all ${d.pSamples.length}`, "more") : ""}` },
{ id: "pvideos", grid: 2, cls: "w2", title: "Portal: video requests", focus: ["pvideos", ""], render: d => `${head("Video requests", dB("pvideos", "", d.pVideos.length, `chip ${d.pVideos.some(v => /^(received|revision)$/.test(v.status)) ? "o" : ""}`, "Open every video request"), true)}<div class="stack two">${d.pVideos.slice(0, 4).map(videoTile).join("") || empty("No video request yet. Paid clients send footage links from their portal and they show up here.")}</div>${d.pVideos.length > 4 ? dB("pvideos", "", `Show all ${d.pVideos.length}`, "more") : ""}` },
{ id: "pnotes", grid: 2, title: "Portal: change requests", focus: ["pnotes", ""], render: d => `${head("Change requests", dB("pnotes", "", sum(d.pNotes, g => g.notes.length), `chip ${d.pNotes.length ? "r" : ""}`, "Open every change request"), true)}<div class="stack">${d.pNotes.slice(0, 3).map(noteTile).join("") || empty("No open change request.")}</div>${d.pNotes.length > 3 ? dB("pnotes", "", `Show all ${d.pNotes.length}`, "more") : ""}` },
{ id: "pclients", grid: 2, title: "Portal: sign-ups", focus: ["pclients", ""], render: d => `${head("Sign-ups", "", true)}<div class="stack">${d.pClients.slice(0, 3).map(clientTile).join("") || empty("No client has signed up yet.")}</div>${d.pClients.length > 3 ? dB("pclients", "", `Show all ${d.pClients.length}`, "more") : ""}` },
].filter(c => !HIDDEN.has(c.id));
const byId = id => CARDS.find(c => c.id === id);
/* 11-22 (SIMAS, Benas handed the dashboard over; "bento style like it was but updated based on me and Benas"): ONE long Dashboard. The $ hero
   stays as it is; under it a summary row of the key numbers (updateTiles), then ONE dense bento of mixed card sizes, in the order Work ·
   Money · Leads · Outreach (no boxed sections). Only the best 12 Money / Leads / Outreach cards, and every
   number shows once on the page: a card whose number is already in the hero, the summary row or another card is cut ("cut": built but never
   shown; its lists still open from the summary number or the drill sheets). Money / Leads / Outreach left the side menu and the phone bar.
   "clients" cards (On hold, In production) still sit on top of the Clients page (crm.css). */
const SECS = { work: ["forms", "bigdeals", "next", "activity"], money: ["buyers", "topc", "paidc", "close"], leads: ["hot", "contacts", "pipeline", "turn", "followups"], outreach: ["outreach", "funnel", "camps", "inboxes"] };
const TABS = { home: Object.values(SECS).flat(), clients: ["holds", "prod", "portal", "psamples", "pvideos", "pnotes", "pclients"],
  cut: ["approvals", "retainers", "alltime", "rate", "speed", "deliv", "total", "today", "videos", "attention", "moods", "samples", "away", "heat", "clock", "sync", "price", "moneypage"], none: ["brand"] };
const TABOF = {}; Object.entries(TABS).forEach(([t, ids]) => ids.forEach(id => { TABOF[id] = t; }));

/* ---------------- chart painters (hover, tap and arrow keys share them) ---------------- */
function paintOut(days, max, H, pad, i) {
  const box = $("#chart"); if (!box) return; const n = days.length, d = days[i];
  const x = n < 2 ? 50 : i / (n - 1) * 100, yy = v => (H - pad - v / max * (H - pad * 2)) / H * 100;
  $$(".cur,.cdot,.tip", box).forEach(el => el.style.setProperty("--x", x + "%"));
  const a = $(".cdot.a", box), b = $(".cdot.b", box); a.style.setProperty("--y", yy(d.sent) + "%"); b.style.setProperty("--y", yy(d.nw) + "%"); a.hidden = !STATE.sa; b.hidden = !STATE.sb;
  const tip = $(".tip", box); tip.style.setProperty("--tx", x < 22 ? "-8%" : x > 78 ? "-92%" : "-50%");
  tip.innerHTML = `<span class="tl">${dLong(d.day)}${d.day === today() ? " · so far" : ""}</span><b>${nf0.format(d.sent)} sent</b><div class="tr"><span><i class="dot round c-orange"></i>New leads</span><em>${nf0.format(d.nw)}</em></div><div class="tr"><span><i class="dot round c-blue"></i>Real replies</span><em>${nf0.format(d.rep)}</em></div><div class="tr"><span><i class="dot round c-green"></i>Positive</span><em>${nf0.format(d.opp)}</em></div><span class="tl">${HOVER ? "click" : "tap again"} to open the day</span>`;
}
function paintRev(d, ymax, H, pad, i) {
  const box = $("#rev"); if (!box) return; const day = i + 1, has = day <= d.dom, cum = has ? d.cum[i] : null, pace = GOAL * day / d.dim, proj = !has && d.dim > d.dom ? d.month + (d.projected - d.month) * (day - d.dom) / (d.dim - d.dom) : null;
  const x = day / d.dim * 100, v = has ? cum : proj ?? 0, y = (H - pad - v / ymax * (H - pad * 2)) / H * 100, dd = `${d.ym}-${String(day).padStart(2, "0")}`, got = has ? sum(d.pays.filter(p => p.day === dd), p => p.amount) : 0;
  $$(".cur,.cdot,.tip", box).forEach(el => el.style.setProperty("--x", x + "%")); $(".cdot", box).style.setProperty("--y", y + "%");
  const tip = $(".tip", box); tip.style.setProperty("--tx", x < 22 ? "-8%" : x > 78 ? "-92%" : "-50%");
  tip.innerHTML = `<span class="tl">${dLong(dd)}</span><b>${has ? usd(cum) + " so far" : usd(proj) + " projected"}</b>${has ? `<div class="tr"><span>Paid that day</span><em>${usd(got)}</em></div>` : ""}<div class="tr"><span>Goal pace</span><em>${usd(pace)}</em></div><div class="tr"><span>${has ? "Behind pace" : "Gap at this pace"}</span><em>${usd(Math.max(0, pace - v))}</em></div>${has ? `<span class="tl">${HOVER ? "click" : "tap again"} to open the payments</span>` : ""}`;
}

/* ---------------- hero band ---------------- */
const HERO = {};
function setOdo(el, str) {
  const sig = str.replace(/\d/g, "0");
  if (el.dataset.sig !== sig) { el.dataset.sig = sig; el.innerHTML = [...str].map(ch => /\d/.test(ch) ? `<span class="od"><span class="os">${"0123456789".split("").map(x => `<span>${x}</span>`).join("")}</span></span>` : `<span class="oc${ch === "$" ? " u" : ""}">${ch}</span>`).join(""); }
  const cols = $$(".od", el), digits = str.replace(/\D/g, ""), go = () => cols.forEach((c, i) => { c.style.setProperty("--oi", i); c.style.setProperty("--d", digits[i]); });
  RM ? go() : requestAnimationFrame(() => requestAnimationFrame(go));
}
function mountHero() {
  const k = f => { const v = GOAL * f; return v >= 1000 ? `$${+(v / 1000).toFixed(1)}k` : usd(v); };
  $("#hero").innerHTML = `<div class="hero-top"><div><div class="hero-h"><button type="button" class="hero-t" data-act="drill" data-k="goal" data-a="" title="Open the maths">Road to <b>${usd(GOAL)}</b> a <em class="sf">month</em></button><span class="seg per" role="group" aria-label="Period for the numbers on this page">${Object.keys(PER).map(p => `<button type="button" data-act="period" data-p="${p}">${p === "month" ? "Month" : p === "today" ? "Today" : p}</button>`).join("")}</span></div>
      <button type="button" class="odo tapn" id="odo" data-act="drill" data-k="pays" data-a="month" aria-label="Money this month. Open the payments."></button>
      <button type="button" class="hero-sub" id="hero-sub" data-act="drill" data-k="goal" data-a="" title="Open the maths: needed per day, days left"></button></div>
    <div><div class="kpis" id="kpis"></div></div></div>
    <button type="button" class="trk-w" data-act="drill" data-k="goal" data-a="" aria-label="Progress to the monthly goal. Open the maths."><span class="trk" id="trk"><i class="fill"></i><i class="pace"></i><i class="head"></i></span><span class="tk t25">${k(.25)}</span><span class="tk t50">${k(.5)}</span><span class="tk t75">${k(.75)}</span><span class="tk t100">${k(1)}</span><span class="tk pc" id="trk-pc">where today's pace is</span></button>
    <i class="spec" aria-hidden="true"></i>`;
  Object.keys(HERO).forEach(x => delete HERO[x]);
}
function part(id, html, cardKey) { if (HERO[id] === html) return; HERO[id] = html; const el = $("#" + id); el.innerHTML = html; if (cardKey) countUp({ id: cardKey, el }); }
function updateHero(d) {
  const P = d.per, mp = d.dom / d.dim * 100, w = clamp(d.goalPct, 0, 100).toFixed(2) + "%";
  /* BENAS 11-23: the big number follows the period tabs (Today / 7d / 30d / Month), not always the month. The goal title and track stay monthly. */
  const isM = P.key === "month", odo = $("#odo");
  setOdo(odo, usd(isM ? d.month : P.rev));
  odo.dataset.a = isM ? "month" : "period"; odo.setAttribute("aria-label", `Money ${isM ? "this month" : P.label}. Open the payments.`);
  part("hero-sub", isM ? `${dl(pctChg(d.month, d.prevSameNow), "vs last month", { tip: `${d.monthName} 1–${d.dom} against ${d.prevName} 1–${d.dom}, up to this time of day` })}<span>On pace for ${N(d.projected, "usd")}</span>`
    : `${dl(pctChg(P.rev, P.prev), P.vs, P.key === "today" ? { part: true, tip: "Today so far against yesterday's full day" } : undefined)}<span>${esc(d.monthName)} so far ${N(d.month, "usd")}</span>`, "hero-sub");
  const isT = P.key === "today", po = { part: isT, tip: isT ? "Today so far against yesterday's full day" : undefined }, pn = P.vsN === "vs last month" ? { tip: `${d.monthName} 1–${d.dom} against ${d.prevName} 1–${d.dom}` } : po,
    nl = isT ? `${N(d.todayNew)}<small>/ ${nf0.format(d.target)}</small>` : N(P.nw) + dl(P.dNw, P.vsN, pn);
  part("kpis", `${dB("pays", "period", `<span><i class="c-green"></i>Payments · ${P.chip}</span><b>${N(P.revN)}</b>`, "kpi")}${dB(isT ? "day" : "days", isT ? d.t : "", `<span><i class="c-blue"></i>New leads · ${P.chip}</span><b>${nl}</b>`, "kpi")}${dB("replies", "real", `<span><i class="c-blue2"></i>Real replies · ${P.chip}</span><b>${N(P.rep)}${dl(P.dRep, P.vsN, pn)}</b>`, "kpi")}${dB("samples", "period", `<span><i class="c-orange"></i>Samples · ${P.chip}</span><b>${N(P.samples)}${dl(P.dSamples, P.vsS, po)}</b>`, "kpi")}`, "hero-kpis");
  const trk = $("#trk"); $(".fill", trk).style.setProperty("--w", w); $(".head", trk).style.setProperty("--w", w); $(".pace", trk).style.setProperty("--x", mp + "%"); $("#trk-pc").style.setProperty("--x", clamp(mp, 12, 88) + "%");
  $$("#hero .per button").forEach(b => { const on = b.dataset.p === STATE.period; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
}

/* ---------------- 11-22: summary row under the hero (SIMAS: key business numbers, each number once on the page) ----------------
   Only numbers no hero tile and no card shows. Money says paid. Each one opens the rows behind it (the cut cards' lists). */
let TILES = "";
function updateTiles(d) {
  const el = $("#mtiles"); if (!el) return;
  const cell = (label, k, a, val, title) => `<div class="mt sum"><span class="sum-l">${label}</span>${big(k, a, val, title, "mt-big")}</div>`;
  const html = cell("Monthly recurring", "retainers", "", `${N(d.ret.mrr, "usd")}<small>/mo</small>`, "Live retainers, paid per month. Open them.")
    + cell("Paid, all time", "pays", "all", N(d.allTime, "usd"), "Every payment so far. Open them.")
    + cell("Reply rate, all time", "sent", "rate", N(d.replyRate, "pct1"), "Reply rate per campaign. Open it.")
    + cell("Speed to reply", "speed", "", d.speed.all == null ? "—" : esc(fmtMin(d.speed.all)), "Typical (median) wait before we answer. Open every answered reply.")
    + cell("Bounce rate", "deliv", "", N(d.deliv.rate, "pct1"), "Bounces per campaign")
    + cell("Leads queued", "queued", "", N(d.queued), "Leads loaded but not emailed yet");
  if (TILES !== html) { TILES = html; el.innerHTML = html; countUp({ id: "mtiles", el }); }
  const asof = LAST_OK ? `as of ${timeOf(LAST_OK)}` : ""; $$("[data-asof]").forEach(x => { x.textContent = asof; });   // Benas: every section says how fresh it is
}

/* ---------------- render ---------------- */
const IO = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle("inview", e.isIntersecting)), { rootMargin: "60px" });   // ambient loops run only on cards in view
function build() {
  const g1 = $("#grid"), g2 = $("#grid2"); g1.innerHTML = g2.innerHTML = ""; IO.disconnect();
  const ro = new ResizeObserver(es => es.forEach(e => fit(e.target)));
  CARDS.forEach((c, i) => {
    const el = document.createElement("section"); el.id = "c-" + c.id; el.className = "card " + (c.cls || ""); el.dataset.tab = TABOF[c.id] || "home"; el.style.setProperty("--i", c.grid === 2 ? i - 30 : i); el.setAttribute("aria-label", c.title || c.id);
    el.style.setProperty("--j", i % 8); c.sh = document.createElement("i"); c.sh.className = "sheen"; c.sh.setAttribute("aria-hidden", "true");
    c.lf = document.createElement("i"); c.lf.className = "lift"; c.lf.setAttribute("aria-hidden", "true");   // 11-22 motion: hover shadow
    c.el = el; c.last = null; if (c.mount) c.mount(el); el.append(c.sh, c.lf); (c.grid === 2 ? g2 : g1).appendChild(el); ro.observe(el); IO.observe(el);
  });
  TABS.home.forEach(id => { const c = byId(id); if (c && c.el) g1.appendChild(c.el); });   // 11-22: the bento reads Work, Money, Leads, Outreach
}
function fit(el) { el.style.gridRowEnd = "span " + Math.ceil((el.offsetHeight + 16) / 4); }
function renderAll(fromData) {
  D = derive();
  CARDS.forEach(c => {
    if (c.render) { const html = c.render(D); if (html !== c.last) { c.last = html; c.el.innerHTML = html; c.el.hidden = !html; c.el.append(c.sh, c.lf); const t = (c.page || c.focus) && TABOF[c.id] === "home" ? $(".ch .ct", c.el) : null; if (t) t.outerHTML = `<button type="button" class="${t.className} go" ${c.page ? `data-act="page" data-p="${c.page}" title="Open the ${PAGE_L[c.page]} page"` : `data-act="drill" data-k="${c.focus[0]}" data-a="${c.focus[1]}" title="Open the full list"`}>${t.innerHTML}${ic("chev")}</button>`;
        else if (c.focus) { const h = $(".ch", c.el); if (h) h.insertAdjacentHTML("beforeend", `<button type="button" class="xp" data-act="drill" data-k="${c.focus[0]}" data-a="${c.focus[1]}" aria-label="Expand ${esc(c.title)}" title="Expand">${ic("expand")}</button>`); } countUp(c); applyVars(c.el);
        const sig = $$(".n[data-n]", c.el).map(x => x.dataset.n).join("|"); if (fromData && c.sig !== undefined && c.sig !== sig && !RM) { c.el.classList.remove("chg"); void c.el.offsetWidth; c.el.classList.add("chg"); } c.sig = sig; } }
    if (c.update) c.update(D);
  });
  renderWof(D);   // 11-23 (BENAS): "Waiting on a founder" under the hero
  updateHero(D); updateTiles(D); paintStatus(); syncChrome(); Object.values(PLOT).forEach(p => { try { p.paint(clamp(p.i, 0, p.n - 1)); } catch {} }); refreshDrill(); dispatchEvent(new Event("beju-crm:data"));   // replies.js: the Replies page + its menu badge
  $("#zone-sub").textContent = D.pOpen ? `${D.pOpen} open request${D.pOpen === 1 ? "" : "s"} · what you do here shows in the client's portal at once` : "What you do here shows in the client's portal at once.";
}
function paintStatus() {
  const t = $("#stat-t"); if (!t || !D) return;
  t.textContent = RT === "live" ? "Live" : "Polling"; $("#stat-s").textContent = D.syncAt ? `synced ${ago(D.syncAt)}` : "";
  $("#stat").title = RT === "live" ? "Live: changes arrive the moment they happen. A full refresh also runs every minute." : "Polling: the page refreshes every minute. The live connection is not up.";
  $("#stat-p").classList.toggle("off", RT !== "live" || !D.syncOk);
}
function jump(id) {
  const el = $("#c-" + id); if (!el) return; const tb = el.dataset.tab, paged = document.documentElement.classList.contains("paged");
  if (tb === "cut") { const c = byId(id); if (c && c.focus) openDrill(c.focus[0], c.focus[1]); return; }   // 11-22: cut from the page, its list still opens
  if (tb === "none") { if (PHONE.matches) return; }
  else if (tb === "clients") { const l = $('#snav a[data-nav="clients"]'); if (l && l.getAttribute("aria-current") !== "page") l.click(); }   // these cards sit on the Clients page
  else { const l = $('#snav a[data-nav="dashboard"]'); if (l && paged) l.click(); setTab(tb, true); }
  el.scrollIntoView({ block: "center", behavior: RM ? "auto" : "smooth" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  const f = $("button,input,[tabindex]", el); if (f) f.focus({ preventScroll: true });
}
function syncChrome() {   // header owner switch + tab badges
  $$("#top-owner button").forEach(b => { const on = b.dataset.o === STATE.owner; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
  const bd = { home: D.todoN }; $$("#tabs button").forEach(b => { const n = bd[b.dataset.t] || 0, i = $("i", b); i.hidden = !n; i.textContent = n > 99 ? "99+" : n; });   // 11-22: Home · To-dos · Clients (To-dos keeps the menu's own badge)
}
function setTab(t, quiet) {
  if (!TABS[t] || t === "none" || t === "cut" || (t === "clients" && !PORTAL_ON)) t = "home"; STATE.tab = t; document.documentElement.dataset.tab = t; store.set("beju-crm-tab", t);
  $$("#tabs button").forEach(b => { const on = b.dataset.t === t; b.classList.toggle("on", on); b.setAttribute("aria-current", on ? "page" : "false"); });
  if (!quiet) scrollTo(0, 0);
  requestAnimationFrame(() => { CARDS.forEach(c => { if (c.el) fit(c.el); }); Object.values(PLOT).forEach(p => { try { p.paint(clamp(p.i, 0, p.n - 1)); } catch {} }); });
}
function setPeriod(p) { STATE.period = p; STATE.range = p === "30d" ? 30 : p === "month" ? clamp(+today().slice(8, 10), 7, 30) : 7; renderAll(); }

/* ---------------- drill-downs: every number, mark and row opens the list behind it ---------------- */
const tbl = (heads, rows) => `<div class="tblw"><table class="tbl"><thead><tr>${heads.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
const stackOf = (rows, none) => rows.length ? `<div class="stack">${rows.join("")}</div>` : empty(none || "Nothing here.");
const grp = (label, right = "") => `<div class="grp"><span>${label}</span><b>${right}</b></div>`;
const motionRow = () => `<div class="tile swrow"><span><b>Motion: <span data-motion-l>${motionFull() ? "Full" : "Calm"}</span></b><small>${RM ? "Your device asks for less motion, so the loops stay off." : "Full keeps the glass moving. Calm stops the loops."}</small></span><button type="button" class="sw" role="switch" data-act="motion" aria-checked="${motionFull()}" aria-label="Ambient motion"${RM ? " disabled" : ""}></button></div>`;
const lookBox = () => `${grp("Look", "saved on this device")}<div class="looks" role="group" aria-label="Colour theme">${THEMES.map(t => `<button type="button" class="lkb" data-act="look" data-t="${t[0]}" aria-pressed="${t[0] === lookOf()[0]}" aria-label="${t[1]} look" title="${t[1]}"><span class="thsw" data-th="${t[0]}"></span></button>`).join("")}</div>${motionRow()}`;
const facts = arr => `<div class="hero-facts mfacts">${arr.map(([l, v]) => `<div class="hf"><span>${l}</span><b>${v}</b></div>`).join("")}</div>`;
const campBy = () => Object.fromEntries(RAW.camps.map(c => [c.campaign_id, c]));
const cname = (cb, id) => esc(campName((cb[id] || {}).name || id));
const payRow = p => dB("client", payKey(p), `<span class="av">${esc(initials({ name: p.payer_name, email: p.email }))}</span><span class="row-main"><b>${esc(cut(p.payer_name || p.email || "Payment", 40))}</b><span class="tagline">${cvChip(D.cn(D.emailsOf(p)))}<small>${esc(PACK[p.package] || p.package || "Custom")} · ${esc(p.email || "no email")}</small></span></span><span class="row-end up">+${usd(p.amount)}<small>${dLabel(p.day)}</small></span>`, "tile row");
const replyRow = r => leadBtn(r.lead_email, `<span class="it ${r.kind === "AUTO" ? "c-grey" : r.answered ? "c-green" : "c-blue"}"><svg><use href="#i-${r.kind === "AUTO" ? "moon" : "mail"}"/></svg></span><span class="row-main"><b>${esc(nameOf(r.lead_email))}</b><small>${esc(cut(r.snippet, 110))}</small></span><span class="row-end"><small>${fDT(r.received_at)}</small><small>${r.blocklisted ? "blocklisted" : r.answered ? "answered" : r.kind === "AUTO" ? "auto" : "waiting"}</small></span>`);
const leadList = (list, sub) => stackOf(list.map(p => lrow(p, sub ? sub(p) : [p.show, p.next_action].filter(Boolean).join(" · "), `<span class="row-end">${isBuyer(p) || (p.status || "").toUpperCase() === "HOT" ? cvChip(D.tc[lc(p.email)] || 0) : `<small>${esc(MOOD_LABEL[mood(p)])}</small>`}${p.owner ? `<small>${esc(p.owner)}</small>` : ""}</span>`)), "No leads in this list.");
const DR = {
  day(a) { const day = a || D.t, cb = campBy(), rows = RAW.daily.filter(r => r.day === day).sort((x, y) => (y.sent || 0) - (x.sent || 0)), T = k => nf0.format(sum(rows, r => r[k])), adds = RAW.leadAdds.filter(x => x.day === day);
    return { title: `${dLong(day)}${day === D.t ? " · so far" : ""}`, sub: "What was sent that day, per campaign", html: `${rows.length ? tbl(["Campaign", "Sent", "New leads", "Replies", "Positive"], rows.map(r => `<tr><td>${dB("camp", r.campaign_id, cname(cb, r.campaign_id), "lk")}</td><td>${nf0.format(r.sent || 0)}</td><td>${nf0.format(r.new_leads || 0)}</td><td>${nf0.format(r.replies || 0)}</td><td>${nf0.format(r.opportunities || 0)}</td></tr>`).concat(`<tr class="tot"><td>Total</td><td>${T("sent")}</td><td>${T("new_leads")}</td><td>${T("replies")}</td><td>${T("opportunities")}</td></tr>`)) : empty("Nothing was sent on this day, or the sending sync has not run yet.")}
      ${adds.length ? grp("Leads loaded that day", nf0.format(sum(adds, x => x.n))) + `<p class="sub">${adds.map(x => `${esc(x.tab)} ${+x.n}`).join(" · ")}</p>` : ""}
      <div class="acts sp">${dB("day", addDays(day, -1), `← ${dLabel(addDays(day, -1))}`, "act")}${day < D.t ? dB("day", addDays(day, 1), `${dLabel(addDays(day, 1))} →`, "act") : ""}${dB("days", "", "All 30 days", "act")}</div>` }; },
  days() { const s = D.series.slice(-30).reverse(), max = Math.max(1, ...s.map(x => x.sent)), d = D;
    const OR = d.M && d.M.periods ? d.M.periods[STATE.range + "d"] : null, OQ = OR ? d.M.periods[{ 7: "prev_7d", 30: "prev_30d" }[STATE.range]] : null, days = d.series.slice(-STATE.range), was = d.series.slice(-2 * STATE.range, -STATE.range),
      cmp = (k, pk) => dl(OR && OQ ? pctChg(OR[pk], OQ[pk]) : pctChg(sum(days, x => x[k]), sum(was, x => x[k])), `vs prior ${STATE.range} d`, { tip: `The last ${STATE.range} days against the ${STATE.range} days before` }),
      quad = `<div class="trio quad">${tri(`Sent, ${STATE.range} d`, N(OR ? OR.sent : sum(days, x => x.sent)) + cmp("sent", "sent"))}${tri("New leads", N(OR ? OR.contacted : sum(days, x => x.nw)) + cmp("nw", "contacted"))}${tri("Real replies", N(OR ? OR.replies : sum(days, x => x.rep)) + cmp("rep", "replies"), "replies", "real")}${tri("Positive", `<span class="up">${N(OR ? OR.opportunities : sum(days, x => x.opp))}</span>` + cmp("opp", "opportunities"), "funnel", "2")}</div>`;
    return { title: "Last 30 days", sub: "Click a day for its campaigns", html: quad + tbl(["Day", "Sent", "New leads", "Replies", "Positive"], s.map(x => `<tr><td>${dB("day", x.day, dLong(x.day), "lk")}<i class="mb" data-v="w:${(x.sent / max * 100).toFixed(1)}%"></i></td><td>${nf0.format(x.sent)}</td><td>${nf0.format(x.nw)}</td><td>${nf0.format(x.rep)}</td><td>${nf0.format(x.opp)}</td></tr>`)) }; },
  sent(a) { const rr = c => c.new_contacted ? (c.replies || 0) / c.new_contacted * 100 : -1, list = [...RAW.camps].sort(a === "rate" ? (x, y) => rr(y) - rr(x) : (x, y) => (y.emails_sent || 0) - (x.emails_sent || 0));
    return { title: a === "rate" ? "Reply rate per campaign" : "Sent in total, per campaign", sub: `${nf0.format(D.sentAll)} emails · ${nf0.format(D.contacted)} leads contacted · click a campaign`, html: tbl(["Campaign", "Sent", "Contacted", "Queued", "Reply %", "Positive"], list.map(c => `<tr><td>${dB("camp", c.campaign_id, esc(campName(c.name)), "lk")}</td><td>${nf0.format(c.emails_sent || 0)}</td><td>${nf0.format(c.new_contacted || 0)}</td><td>${nf0.format(c.uncontacted || 0)}</td><td>${rr(c) < 0 ? "—" : rr(c).toFixed(1) + "%"}</td><td>${nf0.format(c.opportunities || 0)}</td></tr>`)) }; },
  queued() { const list = [...RAW.camps].filter(c => c.uncontacted).sort((x, y) => y.uncontacted - x.uncontacted);
    return { title: "Leads still queued", sub: `${nf0.format(D.queued)} loaded leads not contacted yet`, html: list.length ? tbl(["Campaign", "Queued", "Daily cap", "Days of sends"], list.map(c => `<tr><td>${dB("camp", c.campaign_id, esc(campName(c.name)), "lk")}</td><td>${nf0.format(c.uncontacted)}</td><td>${c.daily_max_leads ? nf0.format(c.daily_max_leads) : "—"}</td><td>${c.daily_max_leads ? (c.uncontacted / c.daily_max_leads).toFixed(1) : "—"}</td></tr>`)) : empty("No lead is queued. Push new leads today.") }; },
  camp(id) { const c = RAW.camps.find(x => x.campaign_id === id) || { name: id }, rows = RAW.daily.filter(r => r.campaign_id === id), by = Object.fromEntries(rows.map(r => [r.day, r])), s = []; for (let i = 29; i >= 0; i--) { const day = addDays(D.t, -i); s.push({ day, ...(by[day] || {}) }); }
    const max = Math.max(1, ...s.map(x => x.sent || 0)), rr = c.new_contacted ? (c.replies || 0) / c.new_contacted * 100 : null;
    return { title: campName(c.name) || "Campaign", sub: c.name || "", html: `${facts([["Sent", nf0.format(c.emails_sent || 0)], ["Reply rate", rr == null ? "—" : rr.toFixed(1) + "%"], ["Positive", nf0.format(c.opportunities || 0)]])}${facts([["Contacted", nf0.format(c.new_contacted || 0)], ["Queued", nf0.format(c.uncontacted || 0)], ["Bounced", nf0.format(c.bounced || 0)]])}
      ${grp("Sent per day, last 30 days", `${c.inboxes || 0} inboxes · cap ${c.daily_max_leads || "—"}/day`)}<div class="wk">${s.map((x, i) => `<button type="button" class="${i === 29 ? "on" : ""}" data-act="drill" data-k="day" data-a="${x.day}" data-v="h:${((x.sent || 0) / max * 100).toFixed(1)}%;k:${i / 3}" title="${dLong(x.day)}: ${x.sent || 0} sent, ${x.new_leads || 0} new" aria-label="${dLong(x.day)}: ${x.sent || 0} sent. Open the day."></button>`).join("")}</div>
      ${tbl(["Day", "Sent", "New leads", "Replies", "Positive"], s.slice(-14).reverse().map(x => `<tr><td>${dB("day", x.day, dLong(x.day), "lk")}</td><td>${nf0.format(x.sent || 0)}</td><td>${nf0.format(x.new_leads || 0)}</td><td>${nf0.format(x.replies || 0)}</td><td>${nf0.format(x.opportunities || 0)}</td></tr>`))}` }; },
  samples(a) { let list = [...D.delivered].sort((x, y) => +new Date(y.delivered_at) - +new Date(x.delivered_at)), title = "Samples delivered";
    if (a === "week") { list = list.filter(p => dayOf(p.delivered_at) >= D.wk); title = "Samples delivered this week"; } else if (a === "buyers") { list = list.filter(isBuyer); title = "Samples that became buyers"; }
    else if (a === "wip") { list = D.pipe.filter(p => /^(YES|CLAIMED|BUILT)$/i.test(p.status || "")); title = "Samples in edit"; } else if (a === "recent") { list = list.filter(p => dayOf(p.delivered_at) >= addDays(D.t, -30)); title = "Samples of the last 30 days"; }
    else if (a === "period") { list = list.filter(p => dayOf(p.delivered_at) >= D.per.start); title = `Samples delivered, ${D.per.label}`; }
    else if (/^m:\d{4}-\d\d$/.test(a)) { list = list.filter(p => dayOf(p.delivered_at).slice(0, 7) === a.slice(2)); title = `Samples delivered in ${MON[+a.slice(7) - 1]}`; }
    else if (/^w:/.test(a)) { const s0 = a.slice(2); list = list.filter(p => dayOf(p.delivered_at) >= s0 && dayOf(p.delivered_at) < addDays(s0, 7)); title = `Samples delivered, week of ${dLabel(s0)}`; }
    return { title, sub: `${list.length} lead${list.length === 1 ? "" : "s"}${STATE.owner === "All" ? "" : " · " + STATE.owner}`, html: leadList(list, p => `${p.delivered_at ? "delivered " + fDT(p.delivered_at) : "said yes " + fDT(p.yes_at)}${p.yes_at && p.delivered_at ? ` · ${((new Date(p.delivered_at) - new Date(p.yes_at)) / 36e5).toFixed(1)} h after the yes` : ""}`) }; },
  away() { return { title: "Leads away", sub: "Auto-replies of the last 7 days, not answered", html: stackOf(D.away.map(replyRow), "No auto-replies this week.") }; },
  replies(a) { const list = a === "waiting" ? D.realOpen : RAW.replies.filter(r => r.kind === "REAL"); return { title: a === "waiting" ? "Real replies still waiting" : "Real replies, last 60 days", sub: `${list.length} repl${list.length === 1 ? "y" : "ies"}`, html: stackOf(list.slice(0, 150).map(replyRow), "No replies in this list.") }; },
  hour(h) { h = +h; const list = RAW.replies.filter(r => r.kind === "REAL" && hourOf(r.received_at) === h); return { title: `Replies around ${String(h).padStart(2, "0")}:00`, sub: `${list.length} real repl${list.length === 1 ? "y" : "ies"} in the last 60 days, ${TZ} time`, html: stackOf(list.map(replyRow), "No reply came in at this hour.") + `<div class="acts sp">${dB("hour", (h + 23) % 24, `← ${String((h + 23) % 24).padStart(2, "0")}:00`, "act")}${dB("hour", (h + 1) % 24, `${String((h + 1) % 24).padStart(2, "0")}:00 →`, "act")}</div>` }; },
  pays(a) { let list = D.pays, title = "Every payment";
    if (a === "period") { list = list.filter(p => p.day >= D.per.start); title = `Payments, ${D.per.label}`; } else if (a === "month") { list = list.filter(p => p.day.slice(0, 7) === D.ym); title = `Payments in ${D.monthName}`; }
    else if (/^\d{4}-\d\d$/.test(a)) { list = list.filter(p => p.day.slice(0, 7) === a); title = `Payments in ${MON[+a.slice(5) - 1]} ${a.slice(0, 4)}`; } else if (/^\d{4}-\d\d-\d\d$/.test(a)) { list = list.filter(p => p.day === a); title = `Payments on ${dLong(a)}`; }
    const months = {}; list.forEach(p => { (months[p.day.slice(0, 7)] || (months[p.day.slice(0, 7)] = [])).push(p); });
    return { title, sub: `${list.length} payment${list.length === 1 ? "" : "s"} · ${usd(sum(list, p => p.amount))}${a === "all" && D.avgOrder != null ? ` · average order ${usd(D.avgOrder)}` : ""}${a === "all" && D.bestMonth ? ` · best month ${D.bestMonth.name} ${D.bestMonth.ym.slice(0, 4)}, ${usd(D.bestMonth.v)}` : ""} · click one for the client`, html: list.length ? Object.entries(months).map(([m, ps]) => grp(`${MON[+m.slice(5) - 1]} ${m.slice(0, 4)}`, usd(sum(ps, p => p.amount))) + `<div class="stack">${ps.map(payRow).join("")}</div>`).join("") : empty("No payment in this period yet.") }; },
  goal() { const paceNow = GOAL * D.dom / D.dim, mp = D.pays.filter(p => p.day.slice(0, 7) === D.ym);
    return { title: `Road to ${usd(GOAL)} a month`, sub: `${D.monthName}: day ${D.dom} of ${D.dim}`, html: `${facts([["So far", usd(D.month)], ["Goal", usd(GOAL)], ["Still to go", usd(Math.max(0, GOAL - D.month))]])}${facts([["Needed per day", usd(D.perDay)], ["Pace needed by today", usd(paceNow)], ["On pace for", usd(D.projected)]])}
      <p class="sub sp">Needed per day = what is left, split over the ${D.daysLeft} days that remain (today included). On pace for = money so far ÷ days gone × days in the month. A ${usd(150)} Starter pack every day adds ${usd(150 * D.daysLeft)}; one ${usd(500)} monthly plan adds ${usd(500)}.</p>
      ${grp(`Payments in ${D.monthName}`, usd(D.month))}${stackOf(mp.map(payRow), "No payment this month yet.")}` }; },
  mood(a) { const list = a === "all" ? D.pipe.filter(p => !isBuyer(p)) : D.pipe.filter(p => mood(p) === a); return { title: a === "all" ? "Warm leads" : a === "buyer" ? "Buyers" : `Mood: ${MOOD_LABEL[a] || a}`, sub: `${list.length} lead${list.length === 1 ? "" : "s"}${STATE.owner === "All" ? "" : " · " + STATE.owner} · click one to open it`, html: leadList([...list].sort((x, y) => +new Date(y.last_reply_at || 0) - +new Date(x.last_reply_at || 0)), p => [p.show, p.last_reply_at ? "last reply " + dLabel(dayOf(p.last_reply_at)) : ""].filter(Boolean).join(" · ")) }; },
  hotlist() { needLastWords(); return { title: "Hot leads", sub: `${D.hot.length} lead${D.hot.length === 1 ? "" : "s"}${STATE.owner === "All" ? "" : ` · ${STATE.owner}'s`} · ordered by ${{ wait: "waiting on us first, then next action", next: "next action date", reply: "last reply" }[STATE.hotSort]}`, html: pageTools("hotlist", "Search a name, show, offer or their words") + stackOf(D.hot.map(hotTile), "No hot leads right now.") }; },
  paid() { return { title: "Paid clients", sub: `${D.ret.live.length} monthly · ${D.paidEver} ever paid${D.paidParted ? ` · ${D.paidParted} parted ways (listed last)` : ""}${D.paidNoPay ? ` · ${D.paidNoPay} marked won with no payment on record (last)` : ""}${STATE.owner === "All" ? "" : ` · ${STATE.owner}'s`} · ${D.paidHot} very hot now · ${D.paidVal} future valuable · ${D.paidProm} open promise${D.paidProm === 1 ? "" : "s"} · very hot first, then future valuable · ${D.paidLate} next step${D.paidLate === 1 ? "" : "s"} overdue`, html: pageTools("paid", "Search a name, show, email or note") + stackOf(D.paidC.map(paidTile), "No paying client yet.") }; },
  att(a) { const L = { reply: "Replies waiting", followup: "Follow-ups due", overdue: "Overdue actions", paid_waiting: "Paid, not delivered", promises: "Promises past due", brief: "Said yes, no brief", followup_done: "Finished, park", no_next: "No next step", promise: "Promise due" }, kinds = a === "all" ? Object.keys(D.att) : [a];
    return { title: a === "all" ? "Needs attention" : L[a] || keyLabel(a), sub: "Click a name to open the lead", html: kinds.filter(k => D.att[k]).map(k => grp(L[k] || keyLabel(k), D.att[k].length) + `<div class="stack">${D.att[k].map(x => lrow({ email: x.email, name: x.name }, x.detail || "", x.due ? `<span class="row-end"><small>${fDT(x.due)}</small></span>` : "")).join("")}</div>`).join("") || empty("Nothing waiting. All clear.") }; },
  fu(a) { const list = a === "over" ? D.fuOver : a === "due" ? [...D.fuOver, ...D.fuDays[0].list] : a === "week" ? D.fuDays.flatMap(x => x.list) : (D.fuDays.find(x => x.day === a) || { list: [] }).list;
    return { title: a === "over" ? "Follow-ups overdue" : a === "due" ? "Follow-ups due now (overdue + today)" : a === "week" ? "Follow-ups due this week" : `Follow-ups due ${dLong(a)}`, sub: `${list.length} lead${list.length === 1 ? "" : "s"}`, html: stackOf(list.map(f => lrow(f, `touch ${Math.min((f.touches_done || 0) + 1, f.touches_total || 99)} of ${f.touches_total || "?"} · ${(f.fu_stage || "").replace(/_/g, " ")} · ${f.show || ""}`, `<span class="row-end"><small>${dLabel(f.day)}</small>${f.owner ? `<small>${esc(f.owner)}</small>` : ""}</span>`)), "Nobody is due.") }; },
  funnel(i) { i = +i; if (i === 0) return DR.sent(""); if (i === 1) return DR.replies("real"); if (i === 3) { const list = RAW.pipeline.filter(p => p.delivered_at).sort((x, y) => +new Date(y.delivered_at) - +new Date(x.delivered_at)); return { title: "Samples delivered, everyone", sub: `${list.length} leads`, html: leadList(list, p => "delivered " + fDT(p.delivered_at)) }; }
    if (i === 4) { const list = RAW.pipeline.filter(isBuyer); return { title: "Buyers", sub: `${list.length} leads from the samples pipeline bought`, html: leadList(list, p => cut(p.paid || p.show || "", 90)) }; }
    const list = [...RAW.camps].filter(c => c.opportunities).sort((x, y) => y.opportunities - x.opportunities); return { title: "Positive replies per campaign", sub: `${nf0.format(D.oppAll)} positive replies · ${D.posRate == null ? "—" : D.posRate.toFixed(1) + "%"} of the leads contacted`, html: tbl(["Campaign", "Positive", "Real replies", "Contacted", "Positive %"], list.map(c => `<tr><td>${dB("camp", c.campaign_id, esc(campName(c.name)), "lk")}</td><td>${nf0.format(c.opportunities)}</td><td>${nf0.format(c.replies || 0)}</td><td>${nf0.format(c.new_contacted || 0)}</td><td>${c.new_contacted ? (c.opportunities / c.new_contacted * 100).toFixed(1) + "%" : "—"}</td></tr>`)) }; },
  inboxes() { const list = [...RAW.inboxes].sort((x, y) => (y.sent_today || 0) - (x.sent_today || 0)); return { title: "Inboxes", sub: `${D.inb.n} active · ${nf0.format(D.inb.sent)} of ${nf0.format(D.inb.cap)} sent today · click one for its last 14 days`, html: tbl(["Inbox", "Sent today", "Daily limit", "Warm-up", "Status"], list.map(i => `<tr><td>${dB("inbox", i.email, esc(i.email), "lk")}</td><td>${nf0.format(i.sent_today || 0)}</td><td>${nf0.format(i.daily_limit || 0)}</td><td>${i.warmup_score ?? "—"}</td><td>${i.status === 1 ? "active" : "paused"}</td></tr>`)) }; },
  async inbox(email) { const rows = await must(sb.from("inbox_daily").select("day,sent,new_leads,replies,bounced").eq("email", email).gte("day", addDays(D.t, -14)).order("day", { ascending: false })), ib = RAW.inboxes.find(i => i.email === email) || {};
    return { title: email, sub: "One sending inbox, last 14 days", html: `${facts([["Sent today", `${ib.sent_today || 0} / ${ib.daily_limit || 0}`], ["Warm-up", ib.warmup_score ?? "—"], ["Status", ib.status === 1 ? "active" : "paused"]])}${rows.length ? tbl(["Day", "Sent", "New leads", "Replies", "Bounced"], rows.map(r => `<tr><td>${dB("day", r.day, dLong(r.day), "lk")}</td><td>${nf0.format(r.sent || 0)}</td><td>${nf0.format(r.new_leads || 0)}</td><td>${nf0.format(r.replies || 0)}</td><td>${nf0.format(r.bounced || 0)}</td></tr>`)) : empty("No sends recorded for this inbox in the last 14 days.")}<div class="acts sp">${dB("inboxes", "", "← All inboxes", "act")}</div>` }; },
  clients(a) { const list = a === "repeat" ? D.buyersL.filter(g => g.n > 1) : D.buyersL, paidKeys = new Set(D.buyersL.map(g => g.key)), rest = a === "repeat" ? [] : RAW.clients.filter(c => !paidKeys.has("c:" + c.id));
    return { title: a === "repeat" ? "Repeat buyers" : "Clients by money paid", sub: `${D.buyersN} buyers · ${D.repeat == null ? "—" : Math.round(D.repeat) + "%"} bought more than once · average lifetime ${usd(D.ltv)}`, html: stackOf(list.map((g, n) => dB("client", g.key, `<span class="av">${n + 1}</span><span class="row-main"><b>${esc(cut(g.name, 44))}</b><span class="tagline">${cvChip(g.msgs)}<small>${g.n} payment${g.n === 1 ? "" : "s"} · last ${dLabel(g.last)} · ${esc(cut([...g.emails].join(", "), 50))}</small></span></span><span class="row-end up">${usd(g.total)}</span>`, "tile row")), "No buyer in this list.")
      + (rest.length ? grp("On the clients list, no payment matched", rest.length) + `<div class="stack">${rest.map(c => dB("client", "c:" + c.id, `<span class="av">${esc(initials({ name: c.name }))}</span><span class="row-main"><b>${esc(c.name || "Client")}</b><small>${esc(cut((c.emails || []).join(", "), 70))}</small></span>`, "tile row")).join("")}</div>` : "") }; },
  async client(key) { const t = key.slice(0, 1), v = key.slice(2); let cl = null, email = "";
    if (t === "c") cl = RAW.clients.find(c => c.id === v); else if (t === "e") { email = v; cl = RAW.clients.find(c => (c.emails || []).some(e => lc(e) === v)) || null; }
    const emails = new Set([email, ...((cl && cl.emails) || []).map(lc)].filter(Boolean));
    const pays = D.pays.filter(p => (cl && p.client_id === cl.id) || (p.email && emails.has(lc(p.email))) || (t === "p" && String(p.id) === v));
    pays.forEach(p => { if (p.email) emails.add(lc(p.email)); if (!cl && p.client_id) cl = RAW.clients.find(c => c.id === p.client_id) || null; });
    ((cl && cl.emails) || []).forEach(e => emails.add(lc(e)));
    const dels = cl ? RAW.deliveries.filter(x => x.client_id === cl.id).sort((x, y) => String(y.delivered_at || "").localeCompare(String(x.delivered_at || ""))) : [];
    const acct = D.pClients.find(c => emails.has(lc(c.email))), leads = RAW.pipeline.filter(p => emails.has(lc(p.email)));
    const name = (cl && cl.name) || (acct && acct.name) || (pays[0] && pays[0].payer_name) || (leads[0] && leads[0].name) || email || "Client";
    const [msgs, calls] = await Promise.all([loadConv([...emails]), loadCalls([...emails]).catch(() => [])]), ig = cl && cl.instagram ? String(cl.instagram).replace(/^https?:\/\/(www\.)?instagram\.com\//i, "@").replace(/\/$/, "") : "";
    return { title: name, sub: [...emails].join(" · ") || "No email on file", html: `${facts([["Paid in total", usd(sum(pays, p => p.amount))], ["Payments", pays.length], ["Videos delivered", dels.length]])}
      ${grp("Conversation", emails.size > 1 ? `${emails.size} addresses merged` : "")}${convBlock(msgs, "m", emails.size ? `No email conversation synced for ${emails.size > 1 ? "these addresses" : "this address"} yet.${ig ? ` Conversation is on Instagram (${ig}).` : ""}` : `No email on file for this client, so no conversation can be matched.${ig ? ` Conversation is on Instagram (${ig}).` : ""}`)}
      ${grp("Client portal account")}${acct ? clientTile(acct) + (acct.vids.length ? `<div class="stack sp">${acct.vids.map(x => videoTile(D.pVideos.find(z => z.id === x.id) || { ...x, who: acct, open: 0 })).join("")}</div>` : "") : empty("No portal account with this email yet.")}
      ${leads.length ? grp("In the samples pipeline") + `<div class="stack">${leads.map(p => lrow(p, [p.status, p.show, p.next_action].filter(Boolean).join(" · "))).join("")}</div>` : ""}
      ${grp("Payments", usd(sum(pays, p => p.amount)))}${stackOf(pays.map(p => `<div class="tile row"><span class="it c-green"><svg><use href="#i-cash"/></svg></span><span class="row-main"><b>${esc(PACK[p.package] || p.package || "Custom payment")}</b><small>${fDT(p.paid_at)}${p.email ? " · " + esc(p.email) : ""}</small></span><span class="row-end up">+${usd(p.amount)}</span></div>`), "No payment matched to this client.")}
      ${grp("Videos delivered", dels.length)}${stackOf(dels.slice(0, 40).map(x => `<div class="tile row"><span class="it c-orange"><svg><use href="#i-film"/></svg></span><span class="row-main"><b>${esc(cut(x.title || "Video", 70))}</b><small>${x.delivered_at ? dLong(String(x.delivered_at).slice(0, 10)) : "no date"}</small></span></div>`), cl ? "No delivery indexed for this client." : "Deliveries are matched through the clients list; this email is not on it.")}${dels.length > 40 ? `<p class="sub">+${dels.length - 40} older videos.</p>` : ""}
      ${calls.length ? grp("Calls") + callsList(calls) : ""}` }; },
  owner(a) { const [o, k] = a.split("|"), F = { hot: p => (p.status || "").toUpperCase() === "HOT", samples: p => !!p.delivered_at, buyers: isBuyer }, L = { hot: "hot leads", samples: "samples delivered", buyers: "buyers", waiting: "replies waiting" };
    if (k === "waiting") { const list = RAW.attention.filter(x => x.kind === "reply" && x.owner === o); return { title: `${o}: replies waiting`, sub: `${list.length} lead${list.length === 1 ? "" : "s"}`, html: stackOf(list.map(x => lrow({ email: x.lead_email, name: x.name || x.lead_email }, x.detail || "")), "Nobody is waiting on a reply.") }; }
    const list = RAW.pipeline.filter(p => p.owner === o && F[k](p)); return { title: `${o}: ${L[k]}`, sub: `${list.length} lead${list.length === 1 ? "" : "s"}`, html: leadList(list) }; },
  vids(a) { const all = D.shorts, cn = Object.fromEntries(RAW.clients.map(c => [c.id, c]));   // 11-22: unique Shorts (a v2 of the same Short is one row, with its files)
    let list = all, title = "Shorts delivered";
    if (/^\d{4}-\d\d$/.test(a)) { list = all.filter(x => x.day.slice(0, 7) === a); title = `Shorts delivered in ${MON[+a.slice(5) - 1]}`; } else if (/^\d{4}-\d\d-\d\d$/.test(a)) { list = all.filter(x => x.day >= a && x.day < addDays(a, 7)); title = `Shorts delivered, week of ${dLabel(a)}`; }
    return { title, sub: `${list.length} unique Short${list.length === 1 ? "" : "s"}${a === D.ym && D.vid.prevSame != null ? ` (${D.vid.prevSame} in ${D.prevName} 1–${D.dom})` : ""}, by the day each first landed · ${sum(list, x => x.files.length)} files incl. new versions · INTERNAL folders left out${list.length > 120 ? " · newest 120 shown" : ""}`, html: stackOf(list.slice(0, 120).map(x => dB("client", "c:" + x.client_id, `<span class="it c-orange"><svg><use href="#i-film"/></svg></span><span class="row-main"><b>${esc(cut(x.title || "Video", 70))}</b><small>${esc((cn[x.client_id] || {}).name || "Unknown client")}${x.files.length > 1 ? ` · ${x.files.length} versions, last ${dLabel(String(x.files[x.files.length - 1].delivered_at).slice(0, 10))}` : ""}</small></span><span class="row-end"><small>${dLabel(x.day)}</small></span>`, "tile row")), "No Short delivered in this period.") }; },
  item(id) { const x = RAW.todayItems.find(z => String(z.id) === String(id)); if (!x) return { title: "Today", html: empty("This item is gone.") }; return { title: x.title || "Today", sub: `${x.kind}${x.at ? " · " + fDT(x.at) : ""}`, html: `<p class="dr-txt">${esc(x.detail || "No more detail.")}</p>${x.lead_email ? `<div class="stack sp">${lrow({ email: x.lead_email, name: nameOf(x.lead_email) }, "Open the lead")}</div>` : ""}` }; },
  sync() { return { title: "Where the numbers come from", sub: RT === "live" ? "Live connection is up; a full refresh also runs every minute" : "The page refreshes every minute", html: stackOf(RAW.sync.filter(s => !/^hb:/.test(s.name)).map(s => `<div class="tile pt"><div class="pt-top"><span class="it ${s.ok ? "c-green" : "c-red"}"><svg><use href="#i-${s.ok ? "check" : "alert"}"/></svg></span><span class="row-main"><b>${esc({ instantly: "Sending (Instantly → campaigns, inboxes)", replies: "Replies (mail → reply queue, threads)", sheet: "Samples sheet → pipeline", new_lead_target: "New-lead target" }[s.name] || s.name)}</b><small>ran ${ago(s.ran_at)} · ${fDT(s.ran_at)}${+s.max_age_min ? ` · expected at least every ${s.max_age_min} min` : ""}</small></span><span class="chip ${!s.ok ? "r" : (D.sync.find(x => x.name === s.name) || {}).stale ? "o" : "g"}">${!s.ok ? "failed" : (D.sync.find(x => x.name === s.name) || {}).stale ? "late" : "ok"}</span></div><div class="pt-lines"><span>${esc(cut(s.detail, 300))}</span></div></div>`))
      + (D.beats.length ? grp("Watchers (heartbeats)", D.beats.length) + `<div class="stack">${D.beats.map(b => `<div class="tile row"><span class="it ${b.stale ? "c-orange" : "c-ink"}"><svg><use href="#i-${b.stale ? "clock" : "bolt"}"/></svg></span><span class="row-main"><b>${esc(b.side)} · ${esc(b.proc)}</b><small>last beat ${ago(b.ran_at)} · ${fDT(b.ran_at)}${+b.max_age_min ? ` · stale after ${b.max_age_min} min` : ""}${b.detail ? " · " + esc(cut(b.detail, 120)) : ""}</small></span><span class="chip ${b.stale ? "o" : "g"}">${b.stale ? "stale" : "beating"}</span></div>`).join("")}</div>` : "") }; },
  me() { return { title: ME ? (ME.name || ME.email) : "You", sub: ME ? ME.email : "", html: `${facts([["Role", "Founder"], ["Connection", RT === "live" ? "Live" : "Polling"], ["Look", `<span data-look-name>${lookOf()[1]}</span>`]])}
      ${lookBox()}
      ${grp("Shortcuts")}<div class="stack">${[["⌘K / Ctrl K", "Search leads and clients, jump to a card, run an action"], ["/", "Search leads"], ["← →", "In a chart: move through the days. In a lead: previous and next lead of the list"], ["Enter", "Open what is selected"], ["Esc", "Close the top layer"], ["W", "Wall mode"]].map(x => `<div class="tile row"><span class="kbd">${x[0]}</span><span class="row-main"><small>${x[1]}</small></span></div>`).join("")}</div>
      <div class="acts sp">${PORTAL_ON ? `<a class="act" href="${esc(PORTAL)}">${ic("link")}Client portal</a>` : ""}<a class="act" href="${esc(SITE)}">${ic("link")}Website</a>${dB("look", "", ic("sun") + "All looks", "act")}<button type="button" class="act" data-act="refresh">${ic("refresh")}Refresh now</button><button type="button" class="act" data-act="chpw">${ic("user")}Change password</button><button type="button" class="act" data-act="mfa">${ic("check")}2-step login</button><button type="button" class="act no" data-act="signout">${ic("out")}Sign out</button></div>` }; },
  look(a) { const first = a === "first"; return { title: first ? "Pick your look" : "Look", sub: first ? "Five kinds of glass. Change it any time from the account menu." : "Saved on this device", html:
    `<div class="thg" role="group" aria-label="Colour theme">${THEMES.map(t => `<button type="button" class="thp" data-act="look" data-t="${t[0]}" aria-pressed="${t[0] === lookOf()[0]}"><span class="thsw" data-th="${t[0]}" aria-hidden="true"><i></i><i></i><i></i></span><b>${t[1]}</b><small>${t[4]}</small></button>`).join("")}</div>${motionRow()}${first ? `<div class="acts sp"><button type="button" class="act go" data-act="mclose">Done</button></div>` : ""}` }; },
  todaylist() { const I = { call: ["phone", "c-blue"], payment_failed: ["alert", "c-red"], action: ["check", "c-green"], partner: ["flag", "c-orange"] };
    return { title: `Today, ${dLong(D.t)}`, sub: `${D.todayItems.length} items`, html: stackOf(D.todayItems.map(x => { const [icon, c] = I[x.kind] || ["clock", "c-grey"], inner = `<span class="it ${c}"><svg><use href="#i-${icon}"/></svg></span><span class="row-main"><b>${esc(cut(x.title, 90))}</b><small>${esc(cut(x.detail || x.kind, 160))}</small></span>${x.at ? `<span class="row-end"><small>${timeOf(x.at)}</small></span>` : ""}`; return x.lead_email ? leadBtn(x.lead_email, inner) : dB("item", x.id, inner, "tile row"); }), "Nothing on the list for today.") }; },
  next() { const G = ["", "Approvals", "Replies waiting", "Calls today", "Due: deliveries, promises, to-dos", "Follow-ups due", "Hot leads with no next step"];   // one ranked list, labelled by reason
    return { title: "Do next", sub: `${D.todoN} to do, most urgent first · one row per lead`, html: (D.todo.length ? G.map((g, r) => { const xs = D.todo.map((x, i) => [x, i]).filter(([x]) => x.r === r); return xs.length ? grp(g, xs.length) + `<div class="stack">${xs.map(([x, i]) => nextRow(x, i, true)).join("")}</div>` : ""; }).join("") : empty("Nothing needs you right now."))
      + (D.todoMore.length ? grp("More hot leads with no next step", D.todoMore.length) + `<div class="stack">${D.todoMore.map(x => nextRow({ ...x, end: "" }, 0, false)).join("")}</div>` : "")
      + (D.todoLater.length ? grp("Later: to-dos due in more than 7 days", D.todoLater.length) + `<div class="stack">${D.todoLater.map((x, i) => nextRow(x, i, true)).join("")}</div>` : "")
      + (D.holds.length ? grp("On hold: left out of this list", D.holds.length) + `<div class="stack">${D.holds.map(x => dB("holds", "", `<span class="it c-red"><svg><use href="#i-flag"/></svg></span><span class="row-main"><b>${esc(x.client)}</b><small>${esc(lifts(x))} it · ${esc(cut(x.title, 140))}</small></span>`, "tile row")).join("")}</div>` : "") }; },   // the 8 most valuable are in the list; the rest wait here, not counted
  rwait() { const L = D.replyWait; return { title: "Replies waiting on us", sub: `${L.length} repl${L.length === 1 ? "y" : "ies"} · real, unanswered, not a hard pass, not an auto-reply, lead not lost or snoozed · oldest first`, html: stackOf([...L].sort((a, b) => +new Date(a.due) - +new Date(b.due)).map(x => lrow({ email: x.email, name: nameOf(x.email) }, x.detail || "", `<span class="row-end"><small>${fDT(x.due)}</small></span>`)), "No reply is waiting on us.") }; },
  deals() { const B = D.deals || []; return { title: "Big deals", sub: `${B.length} open · ${usd(sum(B, x => +x.value_usd || 0))} · real quotes only: a deal in the CRM, a sent scope, or their own words naming a $600+/mo plan · biggest first`,
    html: stackOf(B.map(dealTile), D.deals ? "No real quote of $600+ a month is open." : "The big-deals list isn't there yet.") + `<p class="sub">Left out: lost or finished leads, a "no" or no-budget last reply, people who already pay that much, and anyone quiet for 21+ days unless a founder hold covers them.</p>` }; },
  forms() { const F = D.forms || [], op = F.filter(x => x.open), G = [["Open: money sleeping", op], ["Paid", F.filter(x => x.stage === "paid")], ["Lost", F.filter(x => x.stage === "lost")]];
    return { title: "Forms: money sleeping", sub: `${F.length} form${F.length === 1 ? "" : "s"} · ${usd(D.formsOpen || 0)} open · value = our ladder by how often they post (daily or 5+/week = 30/mo 500 USD, 1-4 a week = 15/mo 300, less = 5 Shorts 150)`,
      html: D.forms ? G.filter(([, xs]) => xs.length).map(([g, xs]) => grp(g, g.startsWith("Open") ? usd(sum(xs, x => +x.value_usd || 0)) : xs.length) + `<div class="stack">${xs.map(formRow).join("")}</div>`).join("") || empty("No brief form yet.") : empty("The forms list isn't there yet.") }; },
  form(a) { return formSheet(a); },
  approvals() { const A = D.drafts || []; return { title: "Waiting for approval", sub: `${A.length} draft${A.length === 1 ? "" : "s"} wait for a founder · oldest first`, html: stackOf(A.map(draftRow), "No draft is waiting for you.") }; },
  draft(id) { return draftSheet(id); },
  close() { const C = D.close; return { title: "Emails to close", sub: `${C.n} paying client${C.n === 1 ? "" : "s"} · typical ${C.med ?? "—"} · average ${C.avg == null ? "—" : C.avg.toFixed(1)} · fewest first`, html: stackOf(C.list.map(c => { const inner = `<span class="av">${esc(initials({ name: c.name }))}</span><span class="row-main"><b>${esc(c.name)}</b><small>${esc(cut(c.p.show || [...c.emails].join(", "), 80))} · first paid ${c.firstPaid ? fDT(c.firstPaid) : "—"}</small></span><span class="row-end">${c.toClose}<small>email${c.toClose === 1 ? "" : "s"}</small></span>`; return c.p.email ? leadBtn(c.p.email, inner) : dB("client", c.key, inner, "tile row"); }), "No paying client with an email trail yet.") }; },
  retainers() { const R0 = D.ret; return { title: "Retainer clients", sub: `${R0.live.length} live · ${usd(R0.mrr)}/month · ${usd(R0.total)} paid so far${R0.ended ? ` · ${R0.ended} ended` : ""}`, html: stackOf(R0.all.map(r => { const inner = `<span class="av">${esc(initials({ name: r.name || r.email }))}</span><span class="row-main"><b>${esc(r.name || r.email || "Client")}</b><small>${esc(r.status || "")} · since ${r.started_at ? dLabel(dayOf(r.started_at)) : "—"}${r.current_period_end && r.live ? ` · next bill ${dLabel(dayOf(r.current_period_end))}` : ""}${r.canceled_at ? ` · ended ${dLabel(dayOf(r.canceled_at))}` : ""} · ${r.invoices_paid || 0} paid, ${usd(r.paid_total)}</small></span><span class="row-end">${usd(r.amount)}<small>/${esc(r.interval === "month" ? "mo" : r.interval || "")}</small></span>`; return r.e ? dB("client", "e:" + r.e, inner, "tile row", "Open this client") : `<div class="tile row">${inner}</div>`; }), "No retainer yet.") }; },
  holds() { return { title: "On hold", sub: `${D.holds.length} active hold${D.holds.length === 1 ? "" : "s"} · nothing goes out to these people until a founder lifts it`, html: stackOf(D.holds.map(x => `<div class="tile note"><small>${x.sheet ? "Samples sheet status" : `Set by ${esc(x.set_by || "a founder")}`} · ${esc(lifts(x))} it${(x.emails || []).length ? ` · ${esc(x.emails.join(", "))}` : ""}</small><b>${esc(x.client)}</b><br>${esc(x.title)}${x.detail ? `<br><span class="mut">${esc(x.detail)}</span>` : ""}</div>`), "Nothing is on hold.") + `<p class="sub">To set or lift a hold, tell Claude. It checks this list before every send.</p>` }; },
  prod() { const by = {}; D.prod.forEach(x => { (by[x.client] || (by[x.client] = [])).push(x); });
    return { title: "In production", sub: `${D.prod.length} open piece${D.prod.length === 1 ? "" : "s"} of client work · the stage is the last one Claude logged`, html: Object.keys(by).map(c => grp(esc(c), by[c].length) + stackOf(by[c].map(x => { const s = STG[x.stage] || [x.stage || "Open", ""]; return `<div class="tile note"><small><span class="chip ${s[1]}">${esc(s[0])}</span> ${esc([x.builder, x.set_by && x.stage === "founder_check" ? "waits on " + (x.set_by === "Both" ? "both of you" : x.set_by) : "", "updated " + ago(x.updated_at)].filter(Boolean).join(" · "))}</small><b>${esc(x.title)}</b>${x.detail ? `<br><span class="mut">${esc(x.detail)}</span>` : ""}${x.link && webUrl(x.link) ? `<br>${rich(x.link)}` : ""}</div>`; }))).join("") || empty("Nothing is in production.") }; },
  speed(a) { let list = [...D.speed.gaps], title = "Speed to reply";
    if (a === "slow") { list.sort((x, y) => y.g - x.g); title = "Slowest replies"; } else if (a === "fast") { list = list.filter(x => x.g <= 60).sort((x, y) => y.t - x.t); title = "Answered within an hour"; } else if (a === "7") { list = list.filter(x => x.t >= Date.now() - 7 * 864e5).sort((x, y) => y.t - x.t); title = "Replies answered in the last 7 days"; }
    else if (/^\d{4}-/.test(a)) { list = list.filter(x => dayOf(x.t) >= a && dayOf(x.t) < addDays(a, 7)).sort((x, y) => y.t - x.t); title = `Replies answered, week of ${dLabel(a)}`; } else list.sort((x, y) => y.t - x.t);
    return { title, sub: `${list.length} answered repl${list.length === 1 ? "y" : "ies"} · median ${fmtMin(med(list.map(x => x.g)))} · an estimate from the synced threads`, html: stackOf(list.slice(0, 150).map(x => lrow({ email: x.e, name: nameOf(x.e) }, `their email ${fDT(x.t)}`, `<span class="row-end ${x.g <= 60 ? "up" : x.g > 1440 ? "dn" : ""}">${fmtMin(x.g)}<small>until our reply</small></span>`)), "No answered reply in this list.") }; },
  deliv() { const list = [...RAW.camps].filter(c => c.emails_sent).map(c => ({ ...c, rate: (c.bounced || 0) / c.emails_sent * 100 })).sort((x, y) => y.rate - x.rate);
    return { title: "Deliverability", sub: `${nf0.format(D.bounced)} bounced of ${nf0.format(D.sentAll)} sent · ${D.deliv.rate.toFixed(2)}% · keep every campaign under 2%`, html: tbl(["Campaign", "Sent", "Bounced", "Bounce %", "Unsubscribed"], list.map(c => `<tr><td>${dB("camp", c.campaign_id, esc(campName(c.name)), "lk")}</td><td>${nf0.format(c.emails_sent)}</td><td>${nf0.format(c.bounced || 0)}</td><td class="${c.rate > 2 ? "dn" : ""}">${c.rate.toFixed(2)}%</td><td>${nf0.format(c.unsubscribed || 0)}</td></tr>`)) + `<div class="acts sp">${dB("inboxes", "", "Open the inboxes", "act")}</div>` }; },
  feed(a) { const F = [["", "All"], ["money", "Money"], ["reply", "Replies"], ["crm", "CRM changes"], ["call", "Calls"], ["deliv", "Deliveries"]], f = F.some(x => x[0] === a) ? a : "", list = D.feed.filter(e => !f || e.g === f);
    return { title: "Activity", sub: "Payments, replies, CRM changes, calls and deliveries, newest first", html: `<div class="ffl" role="group" aria-label="Show">${F.map(([k, l]) => `<button type="button" data-act="feedf" data-f="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</div><div class="feed">${list.map(e => feedRow(e, false)).join("") || empty("Nothing here in the last two weeks.")}</div>` }; },
  pipeline(a) { const L = (RAW.stages || []).filter(x => STATE.owner === "All" || (x.owner || "") === STATE.owner), list = (a === "overdue" ? L.filter(x => x.is_open && x.overdue) : a ? L.filter(x => x.stage === a) : L.filter(x => x.is_open))
      .sort((x, y) => x.ord - y.ord || +y.overdue - +x.overdue || (+y.days_in_stage || 0) - (+x.days_in_stage || 0)), by = {}; list.forEach(x => (by[x.stage] = by[x.stage] || []).push(x));
    return { title: a === "overdue" ? "Overdue in their stage" : a ? STAGE_L[a] || a : "Open pipeline", sub: `${list.length} lead${list.length === 1 ? "" : "s"}${STATE.owner === "All" ? "" : ` · ${STATE.owner}`} · stage from evidence · days in the stage on the right`,
      html: Object.entries(by).map(([k, xs]) => `${grp(esc(STAGE_L[k] || k), xs.length)}${stackOf(xs.slice(0, 300).map(x => lrow({ email: x.email, name: x.name || x.email }, x.evidence || "", `<span class="row-end">${x.overdue ? `<span class="chip o">${stDays(x)}</span>` : stDays(x)}</span>`)))}`).join("") || empty("No lead in this stage.") }; },
  notifs() { return ntDrill(); },
  sending() { const on = RAW.inboxes.filter(i => i.status === 1), lim = [...new Set(on.map(i => +i.daily_limit || 0))];   // 11-21 (Simas: "how much will we be sending out today")
    return { title: "Sending today", sub: `${nf0.format(D.todaySent)} sent so far, up to ${nf0.format(D.inb.capOn)} today`,
      html: `${facts([["Up to", nf0.format(D.inb.capOn)], ["Sent so far", nf0.format(D.todaySent)], ["Active inboxes", nf0.format(on.length)]])}
        <p class="sub">Up to = the daily limits of the active inboxes added up${lim.length === 1 ? ` (${on.length} × ${lim[0]})` : ""}. Sent so far = today's sends from the campaigns, the same number as the Sent tile${D.inb.sent !== D.todaySent ? `; the inboxes report ${nf0.format(D.inb.sent)} (they sync at a different moment)` : ""}. There is no forecast on purpose: the synced data has the new leads queued per campaign but not the follow-ups due today, so the real total lands somewhere under the limit.</p>
        <div class="acts sp">${dB("inboxes", "", "Open the inboxes", "act")}${dB("day", D.t, "Today per campaign", "act")}</div>` }; },
  psamples() { return { title: "Free sample requests", sub: "One free sample per person, ever. Check the badges before accepting.", html: stackOf(D.pSamples.map(sampleTile), "No sample request yet.") }; },
  pvideos() { return { title: "Video requests", sub: "Deliver = the next numbered version; open change requests are marked done", html: stackOf(D.pVideos.map(videoTile), "No video request yet.") }; },
  pnotes() { return { title: "Change requests", sub: "Open notes, grouped by video and round", html: stackOf(D.pNotes.map(noteTile), "No open change request.") }; },
  pclients() { return { title: "Portal sign-ups", sub: `${D.pClients.length} client account${D.pClients.length === 1 ? "" : "s"}`, html: stackOf(D.pClients.map(clientTile), "No client has signed up yet.") }; },
};
const STACK = []; let M_OPENER = null, M_SRC = null;
/* 11-22: every list says how fresh it is ("as of HH:MM" = the last full read of the database) */
function showDrill(r, seq, keep) { if (seq !== SEQ) return; $("#m-title").textContent = r.title || ""; $("#m-sub").textContent = [r.sub, LAST_OK ? `as of ${timeOf(LAST_OK)}` : ""].filter(Boolean).join(" · "); const body = $("#m-body"), top = body.scrollTop; body.innerHTML = r.html || ""; applyVars(body); body.scrollTop = keep ? top : 0; $("#m-back").hidden = STACK.length < 2; }
function openDrill(k, a = "", opener, back) {
  if (!DR[k] || !D) return; a = String(a ?? "");
  const veil = $("#veil"), seq = ++SEQ, fresh = veil.hidden;
  if (fresh) { M_OPENER = opener || document.activeElement; STACK.length = 0; }
  if (!back) STACK.push({ k, a }); STATE.drill = { k, a };
  const run = () => { veil.hidden = false; let r; try { r = DR[k](a); } catch (e) { r = { title: "Couldn't open this", html: empty("Something went wrong building this list.") }; }
    if (r && typeof r.then === "function") { showDrill({ title: "Loading…", html: `<div class="skl-list" aria-label="Loading"><i></i><i></i><i></i><i></i><i></i></div>` }, seq); r.then(x => showDrill(x, seq)).catch(() => showDrill({ title: "Couldn't load this", html: empty("Check your connection and try again.") }, seq)); } else showDrill(r, seq);
    if (fresh) $("#m-close").focus(); };
  /* 11-22 motion: the sheet grows out of the tapped pane (View Transitions shared element) and the page behind blurs in; without a pane
     (top-bar buttons, the palette) or without the API it scales up from the control that opened it. .vtm keeps the sheet's own CSS entrance off. */
  const src = fresh && opener && opener.closest ? opener.closest(".kpi,.hf,.mt,.card,.hero") : null, h = document.documentElement;
  if (src && VT && !RM && inView(src)) { M_SRC = src; src.classList.add("vt-src"); veil.classList.add("vtm"); h.classList.add("vt-open");
    const vt = vtGo(() => { src.classList.remove("vt-src"); run(); }), done = () => h.classList.remove("vt-open"); vt.finished.then(done, done); }
  else { if (fresh) { M_SRC = null; veil.classList.remove("vtm"); } run(); if (fresh && !RM) growFrom(opener); }
}
function growFrom(o) {
  const m = $("#veil .modal"), ok = o && o.isConnected && o.getBoundingClientRect && !PHONE.matches; if (!ok) { m.style.removeProperty("--ox"); m.style.removeProperty("--oy"); return; }
  const a = o.getBoundingClientRect(), b = m.getBoundingClientRect(); m.style.setProperty("--ox", Math.round(a.left + a.width / 2 - b.left) + "px"); m.style.setProperty("--oy", Math.round(a.top + a.height / 2 - b.top) + "px");
}
function refreshDrill() { const s = STATE.drill; if (!s || $("#veil").hidden || s.k === "inbox" || s.k === "client" || s.k === "notifs" || document.activeElement?.classList.contains("pg-q") || $("#m-body .draft-ed:not([hidden])")) return; try { const r = DR[s.k](s.a); if (r && !r.then) showDrill(r, SEQ, true); } catch {} }
function closeDrill() { const veil = $("#veil"); if (veil.hidden) return; const h = document.documentElement, src = M_SRC && M_SRC.isConnected && inView(M_SRC) ? M_SRC : null, go = () => { veil.hidden = true; veil.classList.remove("vtm"); STATE.drill = null; STACK.length = 0; SEQ++; CONVS.delete("m"); if (src) src.classList.add("vt-src"); };
  if (VT && !RM) { const cls = src ? "vt-back" : "vt-drop"; h.classList.add(cls); const vt = vtGo(go); const done = () => { if (src) src.classList.remove("vt-src"); h.classList.remove(cls); }; vt.finished.then(done, done); } else { go(); if (src) src.classList.remove("vt-src"); } M_SRC = null; if (M_OPENER && M_OPENER.isConnected) M_OPENER.focus(); M_OPENER = null; }

/* ---------------- conversations: every message of a lead or client, newest first (BENAS 11-22) ---------------- */
const CONVS = new Map();   // "dr" (drawer) / "m" (modal) -> messages
async function loadConv(emails) {
  const list = [...new Set(emails.flatMap(e => [String(e || "").trim(), lc(e)]).filter(Boolean))]; if (!list.length) return [];
  const run = async cols => { const out = []; for (let i = 0; ; i += 1000) { const rows = await must(sb.from("threads").select(cols).in("lead_email", list).order("at").order("msg_id").range(i, i + 999)); out.push(...rows); if (rows.length < 1000) return out; } };
  try { return await run("msg_id,lead_email,at,direction,inbox,subject,snippet,body,source"); } catch { return run("msg_id,lead_email,at,direction,inbox,subject,snippet"); }
}
const unent = t => String(t || "").replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");   // some synced bodies arrive HTML-escaped; everything is escaped again below
const rich = t => unent(t).split(/(https?:\/\/[^\s<>"')\]]+)/g).map((s, i) => { if (!(i % 2)) return esc(s); const u = webUrl(s); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(cut(s, 70))}</a>` : esc(s); }).join("");
/* 11-22 (BENAS "the top of the column is the latest message, scrolling down goes to the old ones"): newest first, the newest fully open
   and marked "Newest"; past the newest CV_N the rest wait behind "Show older messages (N)" (already loaded, no query). A search runs over all. */
const CV_N = 10;
function convMsgs(msgs, q, all) {
  q = lc(q); const last = msgs[msgs.length - 1], list = [...msgs].reverse(), shown = q ? list.filter(m => lc(`${m.body || m.snippet || ""} ${m.subject || ""} ${m.inbox || ""}`).includes(q)) : list, cap = !q && !all && shown.length > CV_N; let day = "", subj = "", out = "";
  shown.forEach((m, i) => { const d0 = dayOf(m.at), sj = String(m.subject || "").replace(/^(\s*(re|fwd?|aw)\s*:\s*)+/i, "").trim(), txt = String(m.body || m.snippet || m.subject || "").trim(), long = txt.length > 700 || (txt.match(/\n/g) || []).length > 8, mine = m.direction === "out", top = m === last, cl = long && !top;
    if (cap && i === CV_N) out += `<div class="cv-older" hidden>`;
    if (d0 !== day) { day = d0; out += `<div class="cv-day"><span>${dLong(d0)}</span></div>`; }
    if (sj && lc(sj) !== lc(subj)) { subj = sj; out += `<div class="cv-subj">${esc(cut(sj, 120))}</div>`; }
    out += `<div class="cv-m ${mine ? "out" : "in"}${top ? " cv-top" : ""}"><div class="cv-meta">${top ? `<span class="cv-new">Newest</span>` : ""}${mine ? "us" : "them"} · ${esc(mine ? (m.inbox || "") : (m.lead_email || ""))} · ${fDT(m.at)}${m.source === "gmail" ? " · Gmail" : ""}${m.body ? "" : " · preview only, full text not synced yet"}</div><div class="cv-t${cl ? " clamp" : ""}">${rich(txt)}</div>${long ? `<button type="button" class="lk" data-act="msgmore" aria-expanded="${!cl}">${cl ? "Show more" : "Show less"}</button>` : ""}</div>`; });
  if (cap) out += `</div><button type="button" class="act cv-more" data-act="convolder">Show older messages (${shown.length - CV_N})</button>`;
  return out || empty(`No message contains “${esc(cut(q, 30))}”.`);
}
function convBlock(msgs, id, none) {
  if (!msgs.length) { CONVS.delete(id); return `<p class="empty cv-none">${esc(none)}</p>`; }
  CONVS.set(id, msgs);
  const gaps = []; let wait = null; msgs.forEach(m => { if (m.direction !== "out") { if (wait == null) wait = +new Date(m.at); } else if (wait != null) { gaps.push((+new Date(m.at) - wait) / 6e4); wait = null; } });
  const mine = msgs.filter(m => m.direction === "out").length, full = msgs.filter(m => m.body).length;
  return `<div class="cvw" data-cv="${id}"><p class="cv-sum">${msgs.length} message${msgs.length === 1 ? "" : "s"} (${mine} ours, ${msgs.length - mine} theirs) · first contact ${dLabel(dayOf(msgs[0].at))} · last ${dLabel(dayOf(msgs[msgs.length - 1].at))}${gaps.length ? ` · we replied in ${fmtMin(med(gaps))} (median)` : ""}${full < msgs.length ? ` · ${msgs.length - full} shown as previews until the full text is synced` : ""}</p>
    <div class="cv-tools"><label class="search cv-s">${ic("search")}<input class="cv-q" type="search" placeholder="Find in this conversation" aria-label="Find in this conversation" autocomplete="off" spellcheck="false"></label><button type="button" class="act" data-act="convjump">Jump to newest ↑</button></div>
    <div class="conv">${convMsgs(msgs, "")}</div></div>`;
}

/* ---------------- lead drawer ---------------- */
const safeUrl = u => { try { const x = new URL(String(u).trim()); return x.protocol === "https:" ? x.href : ""; } catch { return ""; } };
async function openLead(email, opener, keepNav) {
  email = lc(email); if (!email) return;
  const p = RAW.pipeline.find(x => lc(x.email) === email), f = RAW.fu.find(x => lc(x.email) === email), acct = D.pClients.find(c => lc(c.email) === email);
  if (!keepNav) { OPENER = opener || document.activeElement; const box = opener && opener.closest ? opener.closest(".stack,.feed,.names,.res,.modal-body") : null; NAV = box ? [...new Set($$('[data-act="lead"]', box).map(b => lc(b.dataset.email)))] : [email]; if (!NAV.includes(email)) NAV = [email]; }
  $("#dr-name").textContent = p ? (p.name || p.email) : email; $("#dr-sub").textContent = p ? [p.show, p.email].filter(Boolean).join(" · ") : "Not in the samples pipeline";
  const link = p ? safeUrl(p.drive_link) : "", at = NAV.indexOf(email), st = stageOf(email);
  const body = $("#dr-body");
  // 11-22 (BENAS "status line, then newest message"): one status line (stage · next step · owner), then the conversation newest first;
  // the 11-21 block (stage, next step with its owner, the deal, the actions) follows the conversation, unchanged
  body.innerHTML = `${stLine(email, p)}
    <div class="dr-sec" id="dr-conv"><h3>Conversation</h3><div class="skl-list conv" aria-label="Loading the thread"><i></i><i></i><i></i></div></div>
    <div class="dr-sec dr-sum"><div class="dt"><span class="dt-l">Stage</span><div class="dt-v">${st ? stageChip(st) : `<span class="mut">No stage yet</span>`}${st && st.evidence ? `<small>${esc(cut(st.evidence, 220))}</small>` : ""}</div></div>
      ${nextSec(email, p)}${dealRow(email, st, null, null)}
      <div class="acts sp"><button type="button" class="act" data-act="copy" data-t="${esc(email)}">${ic("copy")}Copy email</button>${link ? `<a class="act" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${ic("link")}Open sample</a>` : ""}${acct ? dB("client", "e:" + email, `${ic("user")}Portal account`, "act") : ""}${p && isBuyer(p) ? dB("client", "e:" + email, `${ic("cash")}Payments`, "act") : ""}</div>
      ${NAV.length > 1 ? `<div class="dr-navr"><button type="button" class="act" data-act="nav" data-d="-1" ${at <= 0 ? "disabled" : ""} aria-label="Previous lead in the list">←</button><span class="mut mono">${at + 1} / ${NAV.length}</span><button type="button" class="act" data-act="nav" data-d="1" ${at >= NAV.length - 1 ? "disabled" : ""} aria-label="Next lead in the list">→</button><span class="mut">arrow keys move through the list</span></div>` : ""}</div>
    ${p ? `<div class="dr-sec" id="dr-pchips">${drChips(email, p, f)}</div>
    <div class="dr-sec" id="dr-ptl">${drTl(p)}</div>
    ${p.notes ? `<div class="dr-sec"><h3>Notes</h3><p class="dr-txt">${esc(cut(p.notes, 900))}</p></div>` : ""}` : ""}
    <div id="dr-more"></div>`;
  body.scrollTop = 0;
  $("#dr-stage").innerHTML = st ? stageChip(st) : ""; drFoot();
  const dr = $("#drawer"), sc = $("#scrim"); dr.hidden = sc.hidden = false; dr.dataset.email = email;
  requestAnimationFrame(() => { dr.classList.add("on"); sc.classList.add("on"); if (!keepNav) $("#dr-close").focus(); });
  const ems = [...new Set([email, p ? lc(p.email) : "", ...(((RAW.clients.find(c => (c.emails || []).some(e => lc(e) === email)) || {}).emails) || []).map(lc)].filter(Boolean))]; DR_EMS = ems; TL = { rows: null, all: false };
  try {
    const [prom, notes, msgs, tl, calls, opps, scopes] = await Promise.all([
      must(sb.from("promises").select("promise,due_at,status,owner").eq("lead_email", email).eq("status", "open").order("due_at")),
      must(sb.from("client_notes").select("kind,note,created_at").eq("lead_email", email).order("created_at", { ascending: false }).limit(5)),
      loadConv([email, p ? p.email : "", ...(((RAW.clients.find(c => (c.emails || []).some(e => lc(e) === email)) || {}).emails) || [])]),   // a buyer with several addresses: one merged conversation
      loadTl(ems),
      loadCalls(ems).catch(() => []),
      must(sb.from("opportunities").select("what,value_usd,monthly,stage,owner").in("email", ems).is("closed_at", null)).catch(() => []),
      must(sb.from("scopes").select("offer,amount,monthly,status,sent_at").in("email", ems)).catch(() => []),
    ]);
    if (dr.dataset.email !== email) return;
    TL.rows = tl;
    const dl = $("#dr-deal"); if (dl) dl.outerHTML = dealRow(email, st, opps, scopes);
    $("#dr-conv").innerHTML = `<h3>Conversation</h3>${convBlock(msgs, "dr", `No email conversation synced for this address yet.${igOf(email) ? ` Conversation is on Instagram (${igOf(email)}).` : ""}`)}`;
    $("#dr-more").outerHTML = `${tlSec()}${prom.length ? `<div class="dr-sec"><h3>Open promises</h3><div class="stack">${prom.map(x => `<div class="tile note"><small>${esc(x.owner || "")} · due ${fDT(x.due_at)}</small>${esc(cut(x.promise, 300))}</div>`).join("")}</div></div>` : ""}
      ${notes.length ? `<div class="dr-sec"><h3>Client notes</h3><div class="stack">${notes.map(x => `<div class="tile note"><small>${esc(x.kind || "note")} · ${dLabel(dayOf(x.created_at))}</small>${esc(cut(x.note, 400))}</div>`).join("")}</div></div>` : ""}
      ${calls.length ? `<div class="dr-sec" id="dr-calls"><h3>Calls</h3>${callsList(calls)}</div>` : ""}`;
  } catch (e) { const c2 = $("#dr-conv"); if (c2) c2.innerHTML = `<h3>Conversation</h3>${empty("Couldn't load the thread. Try again.")}`; }
}
/* the lead's pipeline row in the drawer (status chips + timeline); drPipe() repaints just these when live samples data arrives (11-23) */
function drChips(email, p, f) { const m = mood(p);
  return `<div class="dr-chips"><span class="chip b">${esc(p.status || "—")}</span>${cvChip(D.tc[email] || 0)}${dB("mood", m, esc(MOOD_LABEL[m] || m), "chip", "Open every lead with this mood")}${p.inbox ? `<span class="chip">${esc(p.inbox)}</span>` : ""}${f && f.touches_total ? `<span class="chip">follow-ups ${f.touches_done || 0}/${f.touches_total}</span>` : ""}</div>`; }
const drTl = p => `<h3>Timeline</h3><div class="kv"><span>Said yes</span><span>${fDT(p.yes_at)}</span></div><div class="kv"><span>Sample delivered</span><span>${fDT(p.delivered_at)}</span></div><div class="kv"><span>Last reply</span><span>${fDT(p.last_reply_at)}</span></div>${p.paid ? `<div class="kv"><span>Paid</span><span class="up">${esc(cut(p.paid, 40))}</span></div>` : ""}`;
function drPipe() {
  const dr = $("#drawer"), email = dr.dataset.email; if (dr.hidden || !email) return;
  const p = RAW.pipeline.find(x => lc(x.email) === email), c = $("#dr-pchips"), t = $("#dr-ptl"); if (!p || !c || !t) return;
  const ch = drChips(email, p, RAW.fu.find(x => lc(x.email) === email)), th = drTl(p); if (c.innerHTML !== ch) c.innerHTML = ch; if (t.innerHTML !== th) t.innerHTML = th;
  $("#dr-sub").textContent = [p.show, p.email].filter(Boolean).join(" · ");
}
/* phone (BENAS 11-21 "actions reachable with one thumb"): the toolbar + prev/next row move from the top block into a
   footer under the scrolling body; the stage chip sits next to the name in the fixed top. Back in place on a wide screen. */
function drFoot() {
  const f = $("#dr-foot"), s = $("#dr-body .dr-sum"); if (!f) return;
  if (!s) { f.textContent = ""; f.hidden = true; return; }
  const els = [...$$(":scope>.acts,:scope>.dr-navr", s), ...f.children]; f.hidden = !PHONE.matches; (PHONE.matches ? f : s).append(...els);
}
PHONE.addEventListener("change", drFoot);
const igOf = email => { const c = RAW.clients.find(x => (x.emails || []).some(e => lc(e) === lc(email))); return c && c.instagram ? String(c.instagram).replace(/^https?:\/\/(www\.)?instagram\.com\//i, "@").replace(/\/$/, "") : ""; };
function navLead(dir) { const dr = $("#drawer"); if (dr.hidden) return; const i = NAV.indexOf(dr.dataset.email) + dir; if (i >= 0 && i < NAV.length) openLead(NAV[i], null, true); }
function closeLead() {
  const dr = $("#drawer"), sc = $("#scrim"); if (dr.hidden) return;
  dr.classList.remove("on"); sc.classList.remove("on"); dr.dataset.email = ""; CONVS.delete("dr");
  setTimeout(() => { if (!dr.classList.contains("on")) dr.hidden = sc.hidden = true; }, RM ? 0 : 380);
  if (OPENER && OPENER.isConnected) OPENER.focus(); OPENER = null;
}

/* 11-22 (BENAS "I can't find the new replies"): read-only handle for the Replies page (replies.js). The same rows and the one replyWait
   list the dashboard counts, so the page's number matches it; no extra query. */
window.BEJU_CRM_REPLIES = { get raw() { return RAW; }, get d() { return D; }, get at() { return LAST_OK; }, get owner() { return STATE.owner; }, nameOf, ownerOfInbox, auto: s => autoText(ownWords(s)), pass: s => HARD_PASS.test(ownWords(s)) };
/* 11-22 (BENAS): read-only handle for the Samples page (samples.js): the same rows, the drawer's conversation helpers and the payment confetti. No extra query. */
window.BEJU_CRM_SAMPLES = { get raw() { return RAW; }, get at() { return LAST_OK; }, get liveAt() { return LIVE_AT; }, ownerOfInbox, loadConv, convBlock, confetti: () => confetti() };

/* ---------------- toasts + confetti ---------------- */
function toast(title, icon = "check", c = "c-green", sub = "", key = "", go = null) {
  const box = $("#toasts"); if (key && $$(".nt-toast", box).some(t => t.dataset.key === key || t.dataset.kind === key)) return;   // 11-21: the action toast about the same lead already shows
  const lead = !!go || key.includes("@");   // 11-23: go = what a click opens (Waiting on a founder)   // 11-22 (BENAS "I want the live pop-up to be clickable"): a toast about a lead opens its drawer (the conversation)
  const el = document.createElement("button"); el.type = "button"; el.className = "toast" + (lead ? " toast-lead" : ""); el.title = go ? "Open it" : lead ? "Open the conversation" : "Dismiss"; if (key) el.dataset.key = key;
  if (lead) el.setAttribute("aria-label", `${title}. ${go ? "Open it" : "Open the conversation"}`);
  el.innerHTML = `<span class="it ${c}"><svg><use href="#i-${icon}"/></svg></span><span><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span>${lead ? `<span class="toast-go" aria-hidden="true">Open<svg><use href="#i-chev"/></svg></span>` : ""}`;
  const kill = () => { if (!el.isConnected) return; el.classList.add("out"); setTimeout(() => el.remove(), RM ? 0 : 300); };
  el.addEventListener("click", () => { if (go) go(); else if (lead) openLead(key); kill(); }); box.appendChild(el); setTimeout(kill, lead ? 12000 : 6500); while (box.children.length > 4) box.firstElementChild.remove();
}
function confetti() {
  if (RM) return; const cv = $("#fx"), ctx = cv.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1), W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
  const cs = getComputedStyle(document.documentElement), cols = ["--signal", "--blue", "--blue-2", "--orange", "--purple"].map(v => cs.getPropertyValue(v).trim() || "#FFD35C"), ps = Array.from({ length: innerWidth < 600 ? 50 : 110 }, () => ({ x: W * (.5 + (Math.random() - .5) * .2), y: H * .62, vx: (Math.random() - .5) * 22 * dpr, vy: -(10 + Math.random() * 16) * dpr, s: (4 + Math.random() * 6) * dpr, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[Math.random() * cols.length | 0] }));
  const t0 = performance.now(); cv.hidden = false;
  const step = now => { const k = (now - t0) / 1900; ctx.clearRect(0, 0, W, H); if (k >= 1) { cv.hidden = true; return; }
    ps.forEach(p => { p.vy += .55 * dpr; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
    requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* ---------------- 11-21: touchpoints in the lead drawer (public.lead_timeline, public.lead_next_step) ----------------
   Read-only. The "Log a touch" form was cut (founders 11-21); calls are logged through "Add call notes" below. */
let DR_EMS = [], TL = { rows: null, all: false };
const TL_IC = { email: "mail", call: "phone", meeting: "user", payment: "cash", stage: "chev", note: "edit", promise: "flag", hold: "alert", production: "film", delivery: "film", dm: "send", loom: "play", decision: "check", other: "clock" };
const loadTl = ems => ems.length ? must(sb.from("lead_timeline").select("*").in("email", ems).order("at", { ascending: false }).limit(400)).catch(() => null) : Promise.resolve(null);
const tlRow = x => { const c = x.kind === "payment" ? "c-green" : x.kind === "hold" ? "c-red" : x.status === "planned" ? "c-orange" : x.direction === "in" ? "c-blue" : x.direction === "out" ? "c-blue2" : "c-grey",
    txt = [x.summary, x.next_step ? `next: ${x.next_step}` : ""].filter(Boolean).join(" · ");
  return `<div class="fe tl${x.status === "canceled" ? " cx" : ""}"><span class="it ${c}"><svg><use href="#i-${TL_IC[x.kind] || "clock"}"/></svg></span><span class="fe-m"><b title="${esc(txt)}">${esc(cut(txt, 220))}</b></span><time title="${esc(fDT(x.at))}">${x.status === "planned" ? esc(dLabel(dayOf(x.at))) : esc(rel(+new Date(x.at)))}</time></div>`; };
function tlSec() {
  const R = TL.rows; if (!R) return `<div id="dr-tl" hidden></div>`;
  const show = TL.all ? R : R.slice(0, 15);
  return `<div class="dr-sec" id="dr-tl"><h3>Touchpoints</h3>${R.length ? `<div class="feed">${show.map(tlRow).join("")}</div>${R.length > 15 ? `<button type="button" class="more" data-act="tlall">${TL.all ? "Show fewer" : `Show all ${R.length}`}</button>` : ""}` : empty("Nothing logged for this lead yet.")}</div>`;
}
const whoOf = x => /simas/i.test(x || "") ? "Simas" : /benas/i.test(x || "") ? "Benas" : /both/i.test(x || "") ? "Both" : x || "";
const nextInfo = (email, p) => { const n = nextOf(email), st = stageOf(email), at = n ? n.next_at : p && p.next_action_at;
  return { txt: n ? n.next_step : p && p.next_action, at, late: n ? !!n.overdue : !!(at && new Date(at) < Date.now()), own: whoOf((st && st.owner) || (p && p.owner) || (n && n.actor)) }; };
function nextSec(email, p) {
  const { txt, at, late, own } = nextInfo(email, p);
  return `<div class="dt" id="dr-next"><span class="dt-l">Next step</span><div class="dt-v">${own || at ? `<b>${esc(own || "No owner")}</b>${at ? ` · <span class="${late ? "dn" : ""}">${fDT(at)}</span>` : ""}` : ""}<p class="dr-txt">${esc(txt || "None set")}</p></div></div>`;
}
/* 11-22 (BENAS): the drawer's top line: stage · next step · owner (with the due day); a missing part is left out, no placeholder */
function stLine(email, p) {
  const st = stageOf(email), { txt, at, late, own } = nextInfo(email, p);
  const parts = [st ? `<span class="dr-st-s">${stageChip(st)}</span>` : "", txt ? `<span class="dr-st-n" title="${esc(txt)}">${esc(txt)}</span>` : "", own || at ? `<span class="dr-st-o">${own ? `<b>${esc(own)}</b>` : ""}${own && at ? " · " : ""}${at ? `<span class="${late ? "dn" : ""}">${dLabel(dayOf(at))}</span>` : ""}</span>` : ""].filter(Boolean);
  return `<p class="dr-st" id="dr-st" aria-label="Status"${parts.length ? "" : " hidden"}>${parts.join("")}</p>`;
}
/* the deal: a live retainer, an open opportunity (plan + size), else the latest scope; plus what they paid so far */
function dealRow(email, st, opps, scopes) {
  const ems = DR_EMS.length && DR_EMS.includes(email) ? DR_EMS : [email], has = e => ems.includes(lc(e)), per = (v, mo) => `${usd(v)}${mo ? "/mo" : ""}`;
  const ret = (RAW.retainers || []).find(r => has(r.email) && /^(active|trialing|past_due)$/i.test(r.status || "")), opp = (opps || [])[0];
  const sc = (scopes || []).filter(x => x.offer || x.amount).sort((a, b) => String(b.sent_at || "").localeCompare(String(a.sent_at || "")))[0];
  const cl = RAW.clients.find(c => (c.emails || []).some(has)), paid = sum(D.pays.filter(x => (x.email && has(x.email)) || (cl && x.client_id === cl.id)), x => x.amount), lines = [];
  if (ret) lines.push(`Retainer ${per(ret.amount, ret.interval === "month")}${ret.cancel_at_period_end ? " · ends at period end" : ""}`);
  if (opp) lines.push(`${ret ? "Offer: " : ""}${esc(cut(opp.what || "Deal", 110))} · ${opp.value_usd ? per(opp.value_usd, opp.monthly) : "size not set"}${opp.stage ? " · " + esc(opp.stage) : ""}`);
  else if (sc && !ret) lines.push(`${esc(sc.offer || "Scope")}${sc.amount ? " · " + per(sc.amount, sc.monthly) : ""} · scope ${esc(sc.status || "")}`);
  else if (!ret && st && +st.opp_value) lines.push(per(st.opp_value));
  const none = paid ? `Packs · paid ${usd(paid)} so far` : `<span class="mut">No plan yet</span>`;
  return `<div class="dt" id="dr-deal"><span class="dt-l">Deal</span><div class="dt-v">${lines.length ? lines.map(l => `<p>${l}</p>`).join("") + (paid ? `<small>paid ${usd(paid)} so far</small>` : "") : none}</div></div>`;
}
async function drReload(email) {   // after call notes are saved: fresh touchpoints + next step
  const [tl, ns] = await Promise.all([loadTl(DR_EMS), must(sb.from("lead_next_step").select("*").eq("email", email).maybeSingle()).catch(() => undefined)]);
  if ($("#drawer").dataset.email !== email) return;
  if (ns !== undefined && RAW.nextSteps) { RAW.nextSteps = RAW.nextSteps.filter(x => lc(x.email) !== email).concat(ns ? [ns] : []); const el = $("#dr-next"), p = RAW.pipeline.find(x => lc(x.email) === email), sl = $("#dr-st"); if (el) el.outerHTML = nextSec(email, p); if (sl) sl.outerHTML = stLine(email, p); }
  if (tl) { TL.rows = tl; const el = $("#dr-tl"); if (el) el.outerHTML = tlSec(); }
}
const founderName = () => { const s = `${ME && ME.name || ""} ${ME && ME.email || ""}`; return /simas/i.test(s) ? "Simas" : /benas/i.test(s) ? "Benas" : (ME && (ME.name || ME.email)) || "Founder"; };
const tzAt = (day, h) => { const g = Date.parse(`${day}T${String(h).padStart(2, "0")}:00:00Z`), p = parts(g); return new Date(g - (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - g)).toISOString(); };   // day + hour in Vilnius -> ISO

/* ---------------- 11-21 (SIMAS): call notes at the bottom of the client / lead profile, no separate tab ----------------
   "short summaries of the call and key takeaways and next tasks that we have to do for them". A call = a cal.com booking
   (public.calls); its notes = the touches row with call_uid = calls.uid (summary, takeaways, recording_url); its next tasks =
   public.call_tasks (owner Simas / Benas / Both, due, done tick). Notes come in through scripts/crm.py touch(call_uid=...)
   (crm-api touch gets the same fields later). The only write here: ticking a task (call_tasks.done_at / done_by). */
const CALL_TITLE = /^free brand content analysis between beju creative and\s*/i;
async function loadCalls(ems) {
  ems = [...new Set(ems.map(lc).filter(Boolean))]; if (!ems.length) return [];
  const calls = (await must(sb.from("calls").select("uid,name,email,title,start_at,end_at,status,organizer").in("email", ems).order("start_at", { ascending: false }))).filter(c => !/cancel/i.test(c.status || ""));
  if (!calls.length) return [];
  const notes = await must(sb.from("touches").select("id,call_uid,summary,takeaways,recording_url").in("call_uid", calls.map(c => c.uid)));
  const tasks = notes.length ? await must(sb.from("call_tasks").select("id,touch_id,text,owner,due_at,done_at").in("touch_id", notes.map(n => n.id)).order("id")) : [];
  return calls.map(c => { const n = notes.find(x => x.call_uid === c.uid) || null; return { c, n, tasks: n ? tasks.filter(t => t.touch_id === n.id) : [] }; });
}
const ctMeta = t => `${esc(t.owner)} · ${t.done_at ? `done ${dLabel(dayOf(t.done_at))}` : t.due_at ? `<span class="${new Date(t.due_at) < Date.now() ? "dn" : ""}">due ${dLabel(dayOf(t.due_at))}</span>` : "no date"}`;
const callTask = t => `<li class="ctask${t.done_at ? " done" : ""}" data-owner="${esc(t.owner)}" data-due="${esc(t.due_at || "")}"><button type="button" class="ctick" data-act="ctdone" data-id="${t.id}" aria-pressed="${!!t.done_at}" aria-label="Done: ${esc(t.text)}">${ic("check")}</button><span class="ct-t">${esc(t.text)}</span><small class="ct-m">${ctMeta(t)}</small></li>`;
const callCard = ({ c, n, tasks }) => {
  const who = cut(String(c.title || "").replace(CALL_TITLE, "").trim() || c.name || c.email || "Call", 60), rec = n && n.recording_url ? safeUrl(n.recording_url) : "";
  const missing = !n && +new Date(c.end_at || c.start_at) < Date.now() - 2 * 36e5;   // ended over 2 h ago, nothing written
  const add = !n && +new Date(c.start_at) <= Date.now() ? `<button type="button" class="act cc-add" data-act="cnadd" data-uid="${esc(c.uid)}" data-email="${esc(lc(c.email))}">${ic("edit")}Add call notes</button>` : "";
  return `<div class="tile ccall" data-uid="${esc(c.uid)}"><div class="cc-h"><b>${dLong(dayOf(c.start_at))} · ${timeOf(c.start_at)}</b><small>${esc([who, c.organizer ? `organizer ${c.organizer}` : ""].filter(Boolean).join(" · "))}</small></div>${n ? `<p class="dr-txt">${esc(n.summary)}</p>${(n.takeaways || []).length ? `<p class="cc-l">Key takeaways</p><ul class="cc-ul">${n.takeaways.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${tasks.length ? `<p class="cc-l">Next tasks</p><ul class="cc-tasks">${tasks.map(callTask).join("")}</ul>` : ""}${rec ? `<a class="lk cc-rec" href="${esc(rec)}" target="_blank" rel="noopener noreferrer">${ic("play")}Recording</a>` : ""}` : `${missing ? `<p class="cc-miss">Notes missing</p>` : ""}${add}`}</div>`;
};
const callsList = rows => rows.length ? `<div class="stack">${rows.map(callCard).join("")}</div>` : "";
async function ctDone(id, btn) {   // tick / untick one call task
  const li = btn.closest(".ctask"), on = btn.getAttribute("aria-pressed") !== "true";
  btn.disabled = true;
  try {
    await upd("call_tasks", +id, on ? { done_at: nowIso(), done_by: founderName() } : { done_at: null, done_by: null });
    li.classList.toggle("done", on); btn.setAttribute("aria-pressed", on);
    $(".ct-m", li).innerHTML = ctMeta({ owner: li.dataset.owner, due_at: li.dataset.due || null, done_at: on ? nowIso() : null });
    toast(on ? "Task done" : "Task open again", "check", "c-green");
  } catch (e) { toast("Couldn't save the tick", "alert", "c-red", cut(e && e.message || e, 120)); }
  btn.disabled = false;
}
const CN_OWN = ["Simas", "Benas", "Both"];
const callNotesForm = (uid, email) => { const me = founderName(); return `<form class="cnform dlg sp" data-uid="${esc(uid)}" data-email="${esc(email)}" novalidate>
  <label class="fld"><span>Summary, 2-3 short lines</span><textarea name="summary" rows="3" maxlength="600" required></textarea></label>
  <label class="fld"><span>Key takeaways, one per line (up to 5)</span><textarea name="takeaways" rows="4" maxlength="1500"></textarea></label>
  <div class="fld"><span>Next tasks</span>${[0, 1, 2].map(i => `<div class="cn-t"><input type="text" name="t${i}" maxlength="300" autocomplete="off" placeholder="Task" aria-label="Task ${i + 1}"><select name="o${i}" aria-label="Owner of task ${i + 1}">${CN_OWN.map(o => `<option${o === me ? " selected" : ""}>${o}</option>`).join("")}</select><input type="date" name="d${i}" aria-label="Due date of task ${i + 1}"></div>`).join("")}</div>
  <label class="fld"><span>Recording or transcript link</span><input type="url" name="rec" maxlength="1000" autocomplete="off" placeholder="https://"></label>
  <p class="dlg-err" hidden></p><div class="acts"><button type="button" class="act" data-act="cncancel">Cancel</button><button type="submit" class="act go">${ic("check")}Save call notes</button></div></form>`; };
async function saveCallNotes(f) {
  const g = n => (f.elements[n] ? String(f.elements[n].value || "").trim() : ""), err = $(".dlg-err", f), go = $('button[type="submit"]', f), email = lc(f.dataset.email), uid = f.dataset.uid;
  const say = t => { err.hidden = false; err.textContent = t; }, summary = g("summary"), rec = g("rec");
  const takeaways = g("takeaways").split("\n").map(x => x.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
  const tasks = [0, 1, 2].map(i => ({ text: g("t" + i), owner: g("o" + i), day: g("d" + i) })).filter(t => t.text);
  if (!summary) { say("Write a short summary."); f.elements.summary.focus(); return; }
  if (takeaways.length > 5) { say("Keep it to 5 takeaways."); return; }
  if (rec && !safeUrl(rec)) { say("The link must start with https://"); return; }
  if (tasks.some(t => !CN_OWN.includes(t.owner))) { say("Pick an owner for each task."); return; }
  go.disabled = true; err.hidden = true;
  let t0;
  try { [t0] = await must(sb.from("touches").insert({ lead_email: email, kind: "call", direction: "out", at: nowIso(), summary, takeaways: takeaways.length ? takeaways : null, recording_url: rec ? safeUrl(rec) : null, call_uid: uid, actor: founderName(), source: "crm" }).select("id")); }
  catch (e) { say(/duplicate|unique/i.test(e && e.message || "") ? "This call already has notes. Close and reopen the profile to see them." : `Couldn't save: ${cut(e && e.message || e, 140)}`); go.disabled = false; return; }
  let bad = "";
  if (tasks.length) try { await must(sb.from("call_tasks").insert(tasks.map(t => ({ touch_id: t0.id, lead_email: email, text: t.text, owner: t.owner, due_at: /^\d{4}-\d{2}-\d{2}$/.test(t.day) ? tzAt(t.day, 12) : null })))); } catch (e) { bad = cut(e && e.message || e, 120); }
  toast(bad ? "Notes saved, tasks not saved" : "Call notes saved", bad ? "alert" : "check", bad ? "c-red" : "c-green", bad || nameOf(email));
  const card = f.closest(".ccall"), row = (await loadCalls([email]).catch(() => [])).find(r => r.c.uid === uid);
  if (card && card.isConnected && row) card.outerHTML = callCard(row);
  if ($("#drawer").dataset.email === email) drReload(email).catch(() => {});
}
window.BEJU_CRM_CALLS = async ems => callsList(await loadCalls(ems || []));   // side.js: the same section on the Clients page
window.BEJU_CRM_CALLCARD = callCard;   // side.js: the full card under a row of the Clients page's Calls section (11-21)

/* ---------------- 11-21: notification centre (public.crm_inbox = crm_events + MY crm_event_state) ----------------
   Founders: "add greater notifications in the crm, make them interactive also". The bell shows only once crm_inbox answers.
   Writes: my own crm_event_state rows (read / snooze / done) and touches. Desktop alerts only after a click, only hot / money / alert. */
let NT = null, NT_T = null, NT_SN = null, BELL = null;
const NTS = { open: null, form: null, all: false }, TOASTED = new Map(), SLACK = { ok: null }, DESK = "beju-crm-desk";
const SEV = { hot: "c-orange", money: "c-green", alert: "c-red", info: "c-blue" };
const KICON = { form: "edit", reply: "mail", hot: "bolt", payment: "cash", booking: "phone", sample: "film", hold: "flag", task: "check", touch: "edit", stage: "chev", slack: "hash", alert: "alert" };
const ntSnoozed = x => !!(x.snoozed_until && new Date(x.snoozed_until) > Date.now());
const ntShown = x => !x.done_at && !ntSnoozed(x);
const ntMine = x => !!(ME && x.actor && [lc(ME.name), lc(founderName())].includes(lc(x.actor)));   // what I did myself never counts as unread for me
const ntUnread = x => ntShown(x) && !x.read_at && x.is_unread !== false && !ntMine(x);
const ntFind = id => (NT || []).find(r => String(r.id) === String(id)) || TOASTED.get(String(id)) || null;
const goPage = (pg, extra) => { if (window.BEJU_CRM_PAGE) window.BEJU_CRM_PAGE(pg, extra || {}); };
async function loadInbox() {
  try { const since = new Date(Date.now() - 14 * 864e5).toISOString(); NT = await all("crm_inbox", "*", q => q.gte("at", since).order("at", { ascending: false }).order("id", { ascending: false })); }
  catch (e) { if (NT == null) { paintBell(); return; } }
  ntTimer(); paintBell(); ntRender();
}
function ntTimer() {   // a snoozed item comes back by itself when its snooze ends
  clearTimeout(NT_SN); const next = Math.min(...(NT || []).filter(ntSnoozed).map(x => +new Date(x.snoozed_until)));
  if (isFinite(next)) NT_SN = setTimeout(() => { paintBell(); ntRender(); loadInbox().catch(() => {}); }, Math.min(2 ** 31 - 1, next - Date.now() + 800));
}
function paintBell() {
  const b = $("#nt-btn"), i = $("#nt-n"); if (!b || !i) return;
  b.hidden = NT == null; const n = NT ? NT.filter(ntUnread).length : 0, t = n > 99 ? "99+" : String(n);
  i.hidden = !n; i.textContent = n ? t : ""; b.setAttribute("aria-label", n ? `Notifications: ${n} unread` : "Notifications");
  if (NT == null) BELL = null; else { if (BELL != null && n > BELL && !RM) { b.classList.remove("ring"); void b.offsetWidth; b.classList.add("ring"); } BELL = n; }   // 11-22 motion: a new unread item rings the bell once
  const base = document.title.replace(/^\(\d+\+?\) /, ""); document.title = n ? `(${t}) ${base}` : base;
}
const ntBtn = (x, op, label, cls = "", icon = "") => `<button type="button" class="act ${cls}" data-act="nt" data-op="${op}" data-id="${esc(String(x.id))}">${icon ? ic(icon) : ""}${label}</button>`;
const slackText = x => [x.title, x.body ? cut(x.body, 400) : "", x.lead_email ? `Lead: ${x.lead_email}` : ""].filter(Boolean).join("\n");
const slackForm = x => `<form class="sform dlg" data-id="${esc(String(x.id))}" novalidate><label class="fld"><span>Channel</span><select name="channel"><option value="claude-sync">#claude-sync</option><option value="red-alert"${/^(hot|money|alert)$/.test(x.severity) ? " selected" : ""}>#red-alert</option></select></label>
  <label class="fld"><span>Message</span><textarea name="text" maxlength="3000" rows="4">${esc(slackText(x))}</textarea></label><p class="dlg-err" hidden></p>
  <div class="acts">${ntBtn(x, "slack", "Cancel")}<button type="submit" class="act go">${ic("send")}Post</button></div></form>`;
function ntItem(x) {
  const id = String(x.id), open = NTS.open === id, un = ntUnread(x), canOpen = !!(x.lead_email || webUrl(x.link) || x.kind === "slack");
  return `<div class="tile nt${un ? "" : " rd"}" data-nt="${esc(id)}"><button type="button" class="row" data-act="nt" data-op="toggle" data-id="${esc(id)}" aria-expanded="${open}"><span class="it ${SEV[x.severity] || SEV.info}"><svg><use href="#i-${KICON[x.kind] || "bell"}"/></svg></span><span class="row-main"><b>${esc(cut(x.title, 120))}</b></span><span class="row-end">${un ? `<i class="nt-dot" aria-label="unread"></i>` : ""}${esc(rel(+new Date(x.at)))}</span></button>
    ${open ? `<div class="nt-x">${x.body ? `<p class="dr-txt">${esc(cut(x.body, 700))}</p>` : ""}<div class="acts">${canOpen ? ntBtn(x, "open", "Open", "go") : ""}${un ? ntBtn(x, "read", "Mark read", "", "check") : ""}${ntBtn(x, "snooze1", "Snooze 1 h", "", "clock")}${ntBtn(x, "snooze9", "Tomorrow 09:00", "", "clock")}${ntBtn(x, "done", "Done", "", "check")}${SLACK.ok ? ntBtn(x, "slack", "Post to Slack", "", "send") : ""}</div>
      ${NTS.form === "slack" && SLACK.ok ? slackForm(x) : ""}</div>` : ""}</div>`;
}
const deskOk = () => "Notification" in window && window.isSecureContext !== false && !COARSE;   // desktop only: phones can't show these from a page
const deskOn = () => deskOk() && Notification.permission === "granted" && store.get(DESK) === "1";
function ntDrill() {
  const list = (NT || []).filter(ntShown), un = list.filter(ntUnread).length, show = NTS.all ? list : list.slice(0, 60), t = today(), td = show.filter(x => dayOf(x.at) === t), older = show.filter(x => dayOf(x.at) !== t);
  const desk = !deskOk() ? "" : Notification.permission === "denied" ? `<span class="chip">Desktop alerts are blocked in this browser</span>` : deskOn() ? `<button type="button" class="act" data-act="nt" data-op="deskoff" aria-pressed="true">${ic("bell")}Desktop alerts on</button>` : `<button type="button" class="act" data-act="nt" data-op="deskon" aria-pressed="false" title="Hot, money and alert items pop up on this computer while the CRM is open in a tab">${ic("bell")}Desktop alerts</button>`;
  return { title: "Notifications", sub: un ? `${un} unread` : "All read",
    html: `<div class="acts nt-tools">${un ? `<button type="button" class="act" data-act="nt" data-op="allread">${ic("check")}Mark all read</button>` : ""}${desk}<button type="button" class="act" data-act="nt" data-op="slackpage">${ic("hash")}Slack</button></div>
      ${td.length ? `${grp("Today")}<div class="stack">${td.map(ntItem).join("")}</div>` : ""}${older.length ? `${grp("Earlier")}<div class="stack">${older.map(ntItem).join("")}</div>` : ""}
      ${list.length ? "" : empty("Nothing waiting. Replies, payments, bookings, holds and tasks land here the moment they happen.")}${list.length > show.length ? `<button type="button" class="more" data-act="nt" data-op="all">Show all ${list.length}</button>` : ""}` };
}
function ntRender(force) {
  if (!STATE.drill || STATE.drill.k !== "notifs" || $("#veil").hidden) return;
  const ae = document.activeElement, typing = ae && $("#m-body").contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
  if (!force && (typing || NTS.form)) return;
  showDrill(ntDrill(), SEQ, true);
}
const ntFocus = (id, sel = ".row") => { const el = $(`#m-body [data-nt="${CSS.escape(String(id))}"] ${sel}`); if (el) el.focus({ preventScroll: true }); };
async function ntSet(rows, patch) {   // my own state rows; the page changes first, a failed write puts it back
  if (!rows.length || !ME) return;
  const prev = rows.map(x => [x, { read_at: x.read_at, snoozed_until: x.snoozed_until, done_at: x.done_at }]);
  rows.forEach(x => Object.assign(x, patch)); if ((patch.snoozed_until || patch.done_at) && rows.some(x => String(x.id) === NTS.open)) { NTS.open = null; NTS.form = null; }
  ntTimer(); paintBell(); ntRender(true);
  try { await must(sb.from("crm_event_state").upsert(rows.map(x => ({ user_id: ME.id, event_id: x.id, read_at: x.read_at || null, snoozed_until: x.snoozed_until || null, done_at: x.done_at || null })), { onConflict: "user_id,event_id" })); }
  catch (e) { prev.forEach(([x, s0]) => Object.assign(x, s0)); ntTimer(); paintBell(); ntRender(true); toast("Couldn't save that", "alert", "c-red", "Check your connection and try again."); }
}
async function ntAllRead() {
  const list = (NT || []).filter(ntUnread); if (!list.length) return;
  const now = nowIso(), upto = list.reduce((m, x) => (x.at > m ? x.at : m), ""); list.forEach(x => { x.read_at = now; }); paintBell(); ntRender(true);
  try { const { error } = await sb.rpc("crm_mark_all_read", { p_before: upto }); if (error) throw error; }
  catch (e) { list.forEach(x => { x.read_at = null; }); await ntSet(list, { read_at: now }); }
}
function ntOpen(x) {
  if (x.kind === "form" && x.lead_email && (D.forms || []).some(f => lc(f.email) === lc(x.lead_email))) { closeLead(); return openDrill("form", lc(x.lead_email)); }   // 11-22: a new brief form opens its answers
  if (x.kind === "slack") { const m = /\/p(\d{10})(\d{6})/.exec(String(x.link || "")); closeLead(); closeDrill(); return goPage("slack", m ? { ts: `${m[1]}.${m[2]}` } : {}); }
  if (x.lead_email) return openLead(x.lead_email, $(`#m-body [data-nt="${CSS.escape(String(x.id))}"] .row`) || $("#nt-btn"));
  const u = webUrl(x.link); if (u) window.open(u, "_blank", "noopener");
}
async function ntOp(op, id, btn) {
  if (op === "allread") return ntAllRead();
  if (op === "all") { NTS.all = true; return ntRender(true); }
  if (op === "slackpage") { closeDrill(); return goPage("slack"); }
  if (op === "deskoff") { store.set(DESK, "0"); return ntRender(true); }
  if (op === "deskon") { try { const r = await Notification.requestPermission(); if (r === "granted") { store.set(DESK, "1"); toast("Desktop alerts on", "bell", "c-green", "Hot, money and alert items, while the CRM is open"); } } catch {} return ntRender(true); }
  const x = ntFind(id); if (!x) return;
  const tst = btn && btn.closest ? btn.closest(".toast") : null; if (tst) tst.remove();
  if (op === "toggle") { NTS.open = NTS.open === String(x.id) ? null : String(x.id); NTS.form = null; ntRender(true); return ntFocus(x.id); }
  if (op === "open") { if (!x.read_at) ntSet([x], { read_at: nowIso() }); return ntOpen(x); }
  if (op === "read") { await ntSet([x], { read_at: nowIso() }); return ntFocus(x.id); }
  if (op === "snooze1" || op === "snooze9") { const until = op === "snooze1" ? new Date(Date.now() + 36e5).toISOString() : tzAt(addDays(today(), 1), 9);
    toast(op === "snooze1" ? "Snoozed for 1 hour" : "Snoozed until tomorrow 09:00", "clock", "c-blue", cut(x.title, 70)); return ntSet([x], { snoozed_until: until, read_at: null }); }
  if (op === "done") return ntSet([x], { done_at: nowIso(), read_at: x.read_at || nowIso() });
  if (op === "slack") { NTS.open = String(x.id); NTS.form = NTS.form === op ? null : op; ntRender(true); const f = $(`#m-body [data-nt="${CSS.escape(String(x.id))}"] textarea`); if (f && NTS.form) f.focus(); else ntFocus(x.id); }
}
function ntToast(x) {   // hot / money / alert: a toast with Open + Snooze (replaces the plain toast about the same lead)
  const box = $("#toasts"), keys = [x.lead_email ? lc(x.lead_email) : "", "k:" + x.kind].filter(Boolean), id = esc(String(x.id));
  $$(".toast:not(.nt-toast)", box).forEach(el => { if (keys.includes(el.dataset.key)) el.remove(); });
  TOASTED.set(String(x.id), x);
  const el = document.createElement("div"); el.className = "toast nt-toast"; el.setAttribute("role", "group"); el.setAttribute("aria-label", "New notification");
  el.dataset.key = keys[0]; el.dataset.kind = "k:" + x.kind;
  el.innerHTML = `<span class="it ${SEV[x.severity] || SEV.info}"><svg><use href="#i-${KICON[x.kind] || "bell"}"/></svg></span><span class="nt-tm"><b>${esc(cut(x.title, 120))}</b><span class="acts"><button type="button" class="act go" data-act="nt" data-op="open" data-id="${id}">Open</button><button type="button" class="act" data-act="nt" data-op="snooze1" data-id="${id}">Snooze 1 h</button></span></span><button type="button" class="nt-tx" aria-label="Dismiss"><svg aria-hidden="true"><use href="#i-x"/></svg></button>`;
  const kill = () => { if (!el.isConnected) return; el.classList.add("out"); setTimeout(() => el.remove(), RM ? 0 : 300); };
  $(".nt-tx", el).addEventListener("click", kill); box.appendChild(el); setTimeout(kill, 15000); while (box.children.length > 4) box.firstElementChild.remove();
}
function ntDesk(x) {   // only after the founder turned it on, only while this tab is open but not in front
  if (!deskOn() || (!document.hidden && document.hasFocus())) return;
  try { const n = new Notification(cut(x.title, 120), { body: cut(x.body || "", 180), tag: "beju-" + x.id, icon: "icon-64.png" }); n.onclick = () => { window.focus(); ntOpen(x); if (!x.read_at) ntSet([x], { read_at: nowIso() }); n.close(); }; } catch {}
}
function ntArrive(n) {   // a new crm_events row by Realtime
  if (!n || n.id == null) return;
  const x = { read_at: null, snoozed_until: null, done_at: null, is_unread: true, ...n };
  if (NT && !NT.some(r => String(r.id) === String(x.id))) NT.unshift(x);
  paintBell(); ntRender();
  if ((/^(hot|money|alert)$/.test(x.severity) || x.kind === "form") && !ntMine(x) && x.source !== "backfill" && Date.now() - new Date(x.at) < 2 * 36e5) { ntToast(x); ntDesk(x); }   // 11-22 (SIMAS "ping us when a form is answered"): a form pops too
  if (x.kind === "slack") document.dispatchEvent(new CustomEvent("beju-crm-slack"));
  clearTimeout(NT_T); NT_T = setTimeout(() => loadInbox().catch(() => {}), 1500);
}
/* Slack: the edge function slack-post (founder JWT). The post boxes show only after a probe ({probe:true} -> {ok:true}, posts nothing) succeeds. */
async function slackPost(channel, text, lead_email) {
  const { data, error } = await sb.functions.invoke("slack-post", { body: { channel, text, ...(lead_email ? { lead_email } : {}) } });
  if (error) throw error; if (!data || data.ok !== true) throw new Error((data && data.error) || "Slack did not take the message"); return data;
}
async function slackProbe() {
  try { const { data, error } = await sb.functions.invoke("slack-post", { body: { probe: true } }); SLACK.ok = !error && !!data && data.ok === true; } catch { SLACK.ok = false; }
  document.dispatchEvent(new CustomEvent("beju-crm-slack")); ntRender();
}
async function postSlackForm(f) {
  const ch = f.elements.channel.value, text = String(f.elements.text.value || "").trim(), err = $(".dlg-err", f), go = $('button[type="submit"]', f), x = ntFind(f.dataset.id);
  if (!text) { err.hidden = false; err.textContent = "Write the message first."; return; }
  go.disabled = true; err.hidden = true;
  try { await slackPost(ch, text, x && x.lead_email); toast(`Posted to #${ch}`, "send", "c-green"); NTS.form = null; ntRender(true); if (x) ntFocus(x.id); document.dispatchEvent(new CustomEvent("beju-crm-slack")); }
  catch (e) { err.hidden = false; err.textContent = `Couldn't post: ${cut(e && e.message || e, 140)}`; go.disabled = false; }
}
window.BEJU_CRM_SLACK = { get ok() { return SLACK.ok === true; }, post: slackPost, probe: slackProbe, open: (id) => { const x = ntFind(id); if (x) ntOpen(x); } };

/* ---------------- client-portal actions (the only writes in this file; same fields and order as scripts/portal_ops.py) ---------------- */
let ASK = null;
function ask({ title, sees, warn = "", fields = [], cta = "Confirm", danger = false }) {
  return new Promise(resolve => {
    const d = $("#dlg"), prev = document.activeElement;
    $("#dlg-body").innerHTML = `<h2 id="dlg-title">${esc(title)}</h2>${warn ? `<p class="warn">${esc(warn)}</p>` : ""}<div class="sees"><small>What the client sees</small>${esc(sees)}</div>
      ${fields.map(f => `<label class="fld"><span>${esc(f.label)}</span>${f.type === "select" ? `<select data-k="${f.k}">${f.opts.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join("")}</select>` : f.type === "area" ? `<textarea data-k="${f.k}" maxlength="${f.max || 500}" placeholder="${esc(f.ph || "")}"></textarea>` : f.type === "file" ? `<input data-k="${f.k}" type="file" accept="video/mp4,video/quicktime,video/webm">` : `<input data-k="${f.k}" type="${f.type === "num" ? "number" : f.type === "url" ? "url" : f.type === "pass" ? "password" : "text"}" ${f.type === "pass" ? 'autocomplete="new-password" autocapitalize="none" spellcheck="false"' : f.type === "url" ? 'inputmode="url" autocapitalize="none" autocomplete="off"' : ""} ${f.type === "num" ? `min="${f.min ?? 0}" step="1" inputmode="numeric"` : `maxlength="${f.max || 500}"`} value="${esc(f.val ?? "")}" placeholder="${esc(f.ph || "")}">`}</label>`).join("")}
      <p class="dlg-err" id="dlg-err" role="alert" hidden></p><div class="dlg-row"><button type="button" class="btn-ghost" data-act="dlg-no">Cancel</button><button type="submit" class="btn-go mag${danger ? " danger" : ""}">${esc(cta)}</button></div>`;
    $("#dlg-body").oninput = $("#dlg-body").onchange = () => { const e = $("#dlg-err"); if (e) e.hidden = true; };   // a fixed field clears the old error
    ASK = { fields, done: v => { ASK = null; d.hidden = true; if (prev && prev.isConnected) prev.focus(); resolve(v); } };
    d.hidden = false; const first = $("input,select,textarea", d) || $(".btn-go", d); first.focus();
  });
}
function askSubmit() {
  if (!ASK) return; const out = {}, err = $("#dlg-err");
  for (const f of ASK.fields) { const el = $(`[data-k="${f.k}"]`, $("#dlg"));
    if (f.type === "file") { const file = el.files && el.files[0] || null;
      if (file && !/^video\/(mp4|quicktime|webm)$/.test(file.type)) { err.hidden = false; err.textContent = "The review copy must be an MP4, MOV or WebM video."; return; }
      if (file && file.size > 50 * 1024 * 1024) { err.hidden = false; err.textContent = "The review copy is over 50 MB. Export a 720p copy for review."; return; }
      out[f.k] = file; continue; }
    let v = (el.value || "").trim();
    if (f.type === "url" && v) { const u = webUrl(v); if (!u) { err.hidden = false; err.textContent = "Paste a full link that starts with https:// or http://."; return; } v = u; }
    if (f.type === "num") { v = Math.round(+v); if (!isFinite(v) || v < (f.min ?? 0)) { err.hidden = false; err.textContent = `${f.label}: enter a number of ${f.min ?? 0} or more.`; return; } }
    if (f.type === "pass") { v = $(`[data-k="${f.k}"]`, $("#dlg")).value; if (v.length < 10) { err.hidden = false; err.textContent = "Use at least 10 characters."; return; } if (f.same && v !== out[f.same]) { err.hidden = false; err.textContent = "The two passwords are not the same."; return; } }
    if (f.req && !v) { err.hidden = false; err.textContent = `${f.label} is needed.`; return; }
    out[f.k] = v; }
  for (const f of ASK.fields) if (f.either && !out[f.k] && !out[f.either]) { err.hidden = false; err.textContent = "Choose a review copy file or paste a link (or both)."; return; }
  ASK.done(out);
}
const upd = async (table, id, body) => { const rows = await must(sb.from(table).update(body).eq("id", id).select("id")); if (!rows.length) throw new Error("Nothing changed: the row is gone or this login may not edit it."); };
const PACKS = [["short_5_150", "Starter · 5 Shorts · $150", 5, 150], ["monthly_growth_300", "Growth · 15 a month · $300", 15, 300], ["monthly_daily_500", "Daily · 30 a month · $500", 30, 500], ["custom", "Custom pack", 5, 0]];
async function pOp(op, id, btn) {
  const s = D.pSamples.find(x => x.id === id), v = D.pVideos.find(x => x.id === id), c = D.pClients.find(x => x.id === id), noteF = { k: "note", label: "Note the client will read (optional)", type: "area", max: 300 };
  if (btn) btn.disabled = true;
  try {
    if (op === "s-accept" && s) { const h = s.hist, warn = h.sample ? `This email already had a free sample on ${dLabel(h.sample)}. One free sample per person, ever.` : h.paid ? `This email has already paid ${usd(h.paid)}. A paying client does not need a free sample.` : "";
      const r = await ask({ title: `Accept ${s.who.name}'s free sample?`, warn, sees: `Their portal shows "Accepted" with an expected-by time 24 hours from now.`, fields: [noteF], cta: warn ? "Accept anyway" : "Accept the sample" }); if (!r) return;
      const body = { status: "accepted", due_at: new Date(Date.now() + 864e5).toISOString() }; if (r.note) body.note = r.note; await upd("sample_requests", id, body); toast("Sample accepted", "check", "c-green", s.who.name); }
    else if (op === "s-building" && s) { const r = await ask({ title: `Mark ${s.who.name}'s sample as in edit?`, sees: `Their portal shows that the team is building the sample.`, fields: [noteF], cta: "Mark building" }); if (!r) return;
      const body = { status: "building" }; if (r.note) body.note = r.note; await upd("sample_requests", id, body); toast("Sample marked building", "check", "c-green", s.who.name); }
    else if (op === "s-decline" && s) { const r = await ask({ title: `Decline ${s.who.name}'s free sample?`, sees: `Their portal shows "Declined" and your note, if you write one. They are not emailed.`, fields: [noteF], cta: "Decline", danger: true }); if (!r) return;
      const body = { status: "declined" }; if (r.note) body.note = r.note; await upd("sample_requests", id, body); toast("Sample declined", "check", "c-grey", s.who.name); }
    else if (op === "s-ready" && s) { const r = await ask({ title: `Send ${s.who.name} the sample preview?`, sees: `Their portal shows "Ready" with this link as the watermarked preview. Check the link opens signed-out first.`, fields: [{ k: "link", label: "Preview link (Drive, anyone with the link)", type: "url", req: true, ph: "https://drive.google.com/…" }], cta: "Send the preview" }); if (!r) return;
      await upd("sample_requests", id, { status: "ready", preview_url: r.link, delivered_at: nowIso(), due_at: null }); toast("Sample preview sent", "check", "c-green", s.who.name); }
    else if (op === "v-editing" && v) { const r = await ask({ title: `Mark “${cut(v.title || "this video", 40)}” as in edit?`, sees: `${v.who.name}'s portal shows "In edit" for this video.`, cta: "Mark editing" }); if (!r) return;
      await upd("videos", id, { status: "editing" }); toast("Video marked in edit", "check", "c-green", v.title || ""); }
    else if (op === "v-deliver" && v) { const next = (+v.version || 0) + 1;
      const r = await ask({ title: `Deliver v${next} of “${cut(v.title || "this video", 40)}”?`, sees: `${v.who.name}'s portal shows "Ready for review" with version ${next}. An uploaded review copy plays in their review room, where they can leave notes on the exact frame; a link opens as a preview.${v.open ? ` Their ${v.open} open change request${v.open === 1 ? " is" : "s are"} marked done.` : ""}`, fields: [{ k: "file", label: "Review copy (MP4/MOV/WebM, 720p, up to 50 MB)", type: "file", either: "link" }, { k: "link", label: "Link to the full-quality file (optional with an upload)", type: "url", either: "file", ph: "https://drive.google.com/…" }, { k: "note", label: "What changed (optional, the client reads it)", type: "area", max: 400 }], cta: `Deliver v${next}` }); if (!r) return;
      const cur = await must(sb.from("videos").select("version,user_id").eq("id", id).single()), n = (+cur.version || 0) + 1;
      let path = null;
      if (r.file) { const ext = r.file.type === "video/quicktime" ? "mov" : r.file.type === "video/webm" ? "webm" : "mp4";
        path = `${cur.user_id}/${id}/v${n}-${Math.random().toString(36).slice(2, 8)}.${ext}`;   // the client's own private folder; the database checks the path
        if (btn) btn.textContent = "Uploading…";
        const { error: upErr } = await sb.storage.from("finished").upload(path, r.file, { contentType: r.file.type, upsert: false, cacheControl: "3600" });
        if (upErr) throw upErr; }
      await must(sb.from("video_versions").insert({ video_id: id, version: n, url: r.link || path, storage_path: path, note: r.note || null }));
      await must(sb.from("video_notes").update({ done_at: nowIso() }).eq("video_id", id).is("done_at", null));
      await upd("videos", id, { status: "ready", result_url: r.link || path, delivered_at: nowIso(), version: n, due_at: null }); toast(`Delivered v${n}`, "check", "c-green", v.title || ""); }
    else if (op === "n-reply") { const n = RAW.vnotes.find(x => x.id === id); if (!n) return; const vid = RAW.videos.find(x => x.id === n.video_id) || {};
      const r = await ask({ title: `Reply to the note at ${mmss(n.at)}`, sees: `Their review room shows your reply under this note, with your name and "BEJÚ team". Their note: “${cut(n.text, 160)}”`, fields: [{ k: "text", label: "Your reply", type: "area", max: 1000, req: true }], cta: "Send reply" }); if (!r) return;
      await must(sb.from("video_notes").insert({ video_id: n.video_id, user_id: ME.id, parent_id: n.id, at: n.at || 0, text: r.text })); toast("Reply sent", "check", "c-green", vid.title || ""); }
    else if (op === "pack" && c) { const r = await ask({ title: `Add a pack for ${c.name || c.email}?`, sees: `Their portal shows the new credits at once, valid for 30 days. Use this only for someone who paid outside the portal; no money is charged here.`, fields: [{ k: "pack", label: "Pack", type: "select", opts: PACKS.map(p => [p[0], p[1]]) }, { k: "videos", label: "Videos (credits)", type: "num", min: 1, val: 5, req: true }, { k: "amount", label: "Amount paid, USD", type: "num", min: 0, val: 150, req: true }], cta: "Add the pack" }); if (!r) return;
      await must(sb.from("purchases").insert({ user_id: c.id, pack_id: r.pack, videos: r.videos, amount: r.amount })); toast(`${r.videos} credits added`, "check", "c-green", c.name || c.email); }
    else return;
    await refresh();
  } catch (e) { toast("That did not save", "alert", "c-red", cut(String(e && e.message || e), 140)); }
  finally { if (btn && btn.isConnected) btn.disabled = false; }
}

/* 11-21 (BENAS, PR #9): a founder decides a lane-3 draft. The drafts_guard trigger checks everything (2-step founder, the exact text,
   nothing while sending); when it refuses, its own message is shown as it is. Approve sends the sha256 of the text on screen. */
const sha256hex = async t => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map(b => b.toString(16).padStart(2, "0")).join("");
async function draftOp(op, id, btn) {
  const x = (D.drafts || []).find(z => String(z.id) === String(id)), box = $("#m-body"), err = $("#dft-err", box), say = m => { if (err) { err.hidden = false; err.textContent = m; } };
  if (!x) return; if (err) err.hidden = true;
  const ed = $(".draft-ed", box), txt = $(".draft-body", box), acts = $("#dft-acts", box);
  if (op === "edit" || op === "cancel") { const on = op === "edit"; ed.hidden = !on; txt.hidden = on; acts.hidden = on; if (on) { const ta = $(".draft-ta", box); ta.value = x.body; ta.focus(); } else { const eb = $('[data-op="edit"]', box); if (eb) eb.focus(); } return; }
  let body = null, done = "";
  if (op === "approve") {
    const shown = txt.textContent;   // the HTML parser turns \r\n into \n; anything else that differs = the text moved under us
    if (shown !== x.body.replace(/\r\n?/g, "\n")) return say("The text on screen is not the saved draft any more. Close this and open it again.");
    const r = await ask({ title: `Send this reply to ${nameOf(x.lead_email)}?`, warn: `It goes out within a minute from ${x.inbox} to ${[x.to_email, ...(x.cc_list || [])].join(", ")}, word for word.`, sees: shown, cta: "Approve and send" }); if (!r) return;
    body = { status: "approved", approved_sha256: await sha256hex(x.body) }; done = "Approved. It goes out within a minute.";
  } else if (op === "hold" || op === "reject") {
    const rj = op === "reject", r = await ask({ title: rj ? (x.status === "unknown" ? "Close this draft" : "Reject this draft") : "Hold this draft", sees: rj ? "Nothing. The draft is closed and never sent." : "Nothing. The draft waits until a founder approves or rejects it.", fields: [{ k: "note", label: "Note for Claude (optional)", type: "area", max: 1000 }], cta: rj ? (x.status === "unknown" ? "Close it" : "Reject") : "Hold", danger: rj }); if (!r) return;
    body = { status: rj ? "rejected" : "held", ...(r.note ? { founder_note: r.note } : {}) }; done = rj ? "Draft closed. Nothing was sent." : "On hold. Nothing goes out.";
  } else if (op === "save") {
    const v = $(".draft-ta", box).value; if (!v.trim()) return say("The reply can't be empty.");
    body = { body: v, ...(x.status === "pending" ? {} : { status: "pending" }) }; done = "Saved. Read it once more, then approve.";
  }
  if (!body) return;
  if (btn) btn.disabled = true;
  try { await upd("drafts", +id, body); toast(done, "check", "c-green", nameOf(x.lead_email));
    if (op === "save") { ed.hidden = true; txt.hidden = false; acts.hidden = false; await refresh(); } else { closeDrill(); await refresh(); } }
  catch (e) { const m = String(e && e.message || e); say(m); toast("Not saved", "alert", "c-red", cut(m, 140)); if (btn && btn.isConnected) btn.disabled = false; }
}
async function ftDone(id, btn) {   // 11-16: a founder ticks a founder task done
  if (btn) btn.disabled = true;
  try { await upd("founder_tasks", +id, { done_at: nowIso() }); toast("Marked done", "check", "c-green", ""); await refresh(); }
  catch (e) { toast("That did not save", "alert", "c-red", cut(String(e && e.message || e), 140)); if (btn && btn.isConnected) btn.disabled = false; }
}

async function changePw() {   // own account only
  const r = await ask({ title: "Change your password", sees: "Nothing. This changes only your own login. Other devices stay signed in until their session ends.", fields: [{ k: "pw", label: "New password (10 characters or more)", type: "pass", req: true }, { k: "pw2", label: "The same password again", type: "pass", req: true, same: "pw" }], cta: "Change password" });
  if (!r) return;
  try { const { error } = await sb.auth.updateUser({ password: r.pw }); if (error) throw error; toast("Password changed", "check", "c-green", ME ? ME.email : ""); }
  catch (e) { toast("The password was not changed", "alert", "c-red", cut(String(e && e.message || e), 140)); }
}

/* ---------------- command palette ---------------- */
let PAL = null;
function toggleWall() { document.documentElement.classList.toggle("wall"); requestAnimationFrame(() => CARDS.forEach(c => fit(c.el))); }
function palItems(q) {
  q = lc(q); const cmd = (label, hint, icon, run) => ({ g: "Actions", label, hint, icon, run });
  const cmds = [cmd("Refresh now", "", "refresh", () => refresh(true)), ...THEMES.map(t => cmd(`Look: ${t[1]}`, t[4] + (t[0] === lookOf()[0] ? " · on now" : ""), "sun", () => setTheme(t[0], true))), cmd(motionFull() ? "Motion: switch to Calm" : "Motion: switch to Full", "ambient motion", "bolt", () => setMotion(motionFull() ? "calm" : "full", true)), cmd("Pick a look", "all five", "sun", () => openDrill("look", "")),
    ...["All", "Simas", "Benas"].map(o => cmd(o === "All" ? "Show everyone's leads" : `Show only ${o}'s leads`, "owner filter", "user", () => { STATE.owner = o; STATE.att = ""; renderAll(); })),
    ...Object.keys(PER).map(p => cmd(`Period: ${PER[p][0]}`, "hero, money, outreach", "clock", () => setPeriod(p))),
    cmd("Open the website", "new tab", "link", () => window.open(SITE, "_blank", "noopener")), ...(PORTAL_ON ? [cmd("Open the client portal", "new tab", "link", () => window.open(PORTAL, "_blank", "noopener"))] : []),
    ...(NT ? [cmd("Notifications", "N", "bell", () => openDrill("notifs", ""))] : []), cmd("Slack", "#claude-sync · #red-alert", "hash", () => goPage("slack")), cmd("Contacts", "everyone we talk to, one row per person", "users", () => goPage("contacts")),
    cmd("Wall mode on / off", "W", "expand", toggleWall), cmd("Celebrate", "confetti", "bolt", confetti), cmd("Sign out", "", "out", signOut)];
  const jumps = CARDS.filter(c => c.title && !(PHONE.matches && TABOF[c.id] === "none") && !(TABOF[c.id] === "cut" && !c.focus)).map(c => ({ g: "Jump to", label: c.title, hint: c.grid === 2 ? "client portal" : "card", icon: "chev", run: () => jump(c.id) }));
  const leads = q ? RAW.pipeline.filter(p => [p.name, p.show, p.email].some(v => lc(v).includes(q))).slice(0, 7).map(p => ({ g: "Leads", label: p.name || p.email, hint: cut(p.show || p.email, 40), icon: "user", run: () => openLead(p.email) })) : [];
  const cls = q ? D.pClients.filter(c => [c.name, c.email].some(v => lc(v).includes(q))).slice(0, 4).map(c => ({ g: "Portal clients", label: c.name || c.email, hint: c.email, icon: "user", run: () => openDrill("client", "e:" + lc(c.email)) })) : [];
  const f = x => !q || lc(x.label + " " + x.hint).includes(q);
  return [...leads, ...cls, ...cmds.filter(f), ...jumps.filter(f).slice(0, q ? 10 : 7)];
}
function palRender() { if (!PAL) return; PAL.items = palItems($("#pal-q").value); PAL.sel = clamp(PAL.sel, 0, Math.max(0, PAL.items.length - 1)); let g = "";
  $("#pal-list").innerHTML = PAL.items.map((x, i) => `${x.g !== g ? `<div class="pal-g">${g = x.g}</div>` : ""}<button type="button" role="option" id="pal-o${i}" aria-selected="${i === PAL.sel}" class="pal-i${i === PAL.sel ? " sel" : ""}" data-act="palrun" data-i="${i}" tabindex="-1">${ic(x.icon)}<span>${esc(x.label)}</span><small>${esc(x.hint || "")}</small></button>`).join("") || empty("Nothing matches. Try a lead's name, a card or an action.");
  $("#pal-q").setAttribute("aria-activedescendant", PAL.items.length ? "pal-o" + PAL.sel : ""); const sel = $(".pal-i.sel"); if (sel) sel.scrollIntoView({ block: "nearest" }); }
function openPal() { if (!D || PAL) return; PAL = { items: [], sel: 0, prev: document.activeElement }; $("#pal").hidden = false; const q = $("#pal-q"); q.value = ""; palRender(); q.focus(); }
function closePal() { if (!PAL) return; const prev = PAL.prev; PAL = null; $("#pal").hidden = true; if (prev && prev.isConnected) prev.focus(); }
function palRun(i) { const x = PAL && PAL.items[i]; if (!x) return; PAL.prev = null; closePal(); try { x.run(); } catch {} }

/* ---------------- export ---------------- */

/* ---------------- refresh loop + realtime ---------------- */
function offline(on) { let el = $("#offline"); if (on && !el) { el = document.createElement("div"); el.id = "offline"; el.className = "offline"; el.setAttribute("role", "status"); el.textContent = "Offline, retrying…"; document.body.appendChild(el); } else if (!on && el) el.remove(); }
/* 11-17 (Simas: "we had a payment but the confetti didn't come"): realtime alone missed it (page closed, or the channel
   fell back to polling). Now every payment we haven't celebrated yet gets a toast + confetti: on a refresh, and on the
   first load after a visit (last seen payment time kept in this browser). */
const CELEB = new Set(), LASTPAY = "beju-crm-lastpay";
function celebrateNew(prev) {
  const pays = RAW.payments.filter(x => !x.refunded && x.paid_at), maxAt = pays.reduce((m, x) => x.paid_at > m ? x.paid_at : m, "");
  const seen = store.get(LASTPAY);
  const fresh = pays.filter(x => !CELEB.has(x.id) && (prev ? !prev.has(x.id) : (seen && x.paid_at > seen)));
  fresh.forEach(x => CELEB.add(x.id));
  if (!prev) pays.forEach(x => CELEB.add(x.id));
  if (maxAt) store.set(LASTPAY, maxAt);
  if (!fresh.length) return;
  const tot = sum(fresh, x => +x.amount || 0), one = fresh[0];
  toast(fresh.length === 1 ? `+${usd(one.amount)} from ${one.payer_name || one.email || "a client"}` : `+${usd(tot)} from ${fresh.length} payments`, "cash", "c-green", prev ? (PACK[one.package] || "New payment") : "since your last visit");
  confetti();
}
async function refresh(manual) {
  const btns = $$('[data-act="refresh"]'); if (manual) btns.forEach(b => b.classList.add("spinning"));
  const first = !RAW, prevPay = RAW ? new Set(RAW.payments.map(x => x.id)) : null;
  try { RAW = await fetchAll(); LAST_OK = Date.now(); offline(false); renderAll(!first); celebrateNew(prevPay); loadInbox().catch(() => {}); }
  catch (e) { if (!RAW) throw e; offline(true); }
  finally { setTimeout(() => btns.forEach(b => b.classList.remove("spinning")), 500); }
}
function startLoop() { stopLoop(); TIMER = setInterval(() => { if (!document.hidden && Date.now() - LAST_OK >= 295000) refresh().catch(() => {}); }, 300000); }   // 11-22 bug hunt: every 5 min (was 60 s); one full read = ~45 requests incl. 1-2 s views on the free-plan database   // 11-22 (prod DB overload): skip a tick when a realtime refresh just ran
function stopLoop() { if (TIMER) clearInterval(TIMER); TIMER = null; }
document.addEventListener("visibilitychange", () => { if (!document.hidden && RAW && Date.now() - LAST_OK > 300000) refresh().catch(() => {}); });
function startRealtime() {
  stopRealtime();
  try { CH = sb.channel("crm-live");
    ["payments", "reply_queue", "sample_requests", "videos", "video_notes", "profiles", "crm_events", "crm_event_state"].forEach(tb => CH.on("postgres_changes", { event: "*", schema: "public", table: tb }, p => onChange(tb, p)));
    CH.subscribe(st => { RT = st === "SUBSCRIBED" ? "live" : "poll"; if (D) { paintStatus(); const b = byId("brand"); if (b && b.update) b.update(D); } });
  } catch { RT = "poll"; }
  liveStart();
}
function stopRealtime() { clearTimeout(RT_T); RT_T = null; if (CH) { try { sb.removeChannel(CH); } catch {} CH = null; } RT = "off"; liveStop(); }
function onChange(tb, p) {
  const n = p.new || {}, ins = p.eventType === "INSERT";
  if (tb === "crm_events") { if (ins) ntArrive(n); return; }   // 11-21: the bell
  if (tb === "crm_event_state") { clearTimeout(NT_T); NT_T = setTimeout(() => loadInbox().catch(() => {}), 800); return; }   // my state changed in another tab
  if (tb === "payments" && ins && !n.refunded && !CELEB.has(n.id)) { CELEB.add(n.id); toast(`+${usd(n.amount)} from ${n.payer_name || n.email || "a client"}`, "cash", "c-green", PACK[n.package] || "New payment", lc(n.email)); confetti(); }
  else if (tb === "reply_queue" && ins && n.kind === "REAL") { toast(`New reply from ${nameOf(n.lead_email)}`, "mail", "c-blue", cut(n.snippet, 90), lc(n.lead_email)); dispatchEvent(new CustomEvent("beju-crm:reply", { detail: n })); }   // replies.js adds the row at once
  else if (tb === "profiles" && ins && !n.is_admin) toast(`Portal sign-up: ${n.name || n.email || "new client"}`, "user", "c-purple", n.email || "");
  else if (tb === "sample_requests" && ins) toast("New free-sample request", "film", "c-purple", cut(n.video_url, 70), "k:sample");
  else if (tb === "videos" && ins) toast(`New video request: ${cut(n.title || "Untitled", 40)}`, "play", "c-purple");
  else if (tb === "videos" && p.eventType === "UPDATE" && n.status === "revision") toast(`Changes asked on “${cut(n.title || "a video", 40)}”`, "alert", "c-red");
  else if (tb === "video_notes" && ins) toast("New change request", "alert", "c-red", cut(n.text, 90));
  /* 11-22 (prod DB overload): one full read is ~45 requests, so realtime events no longer each force one. They coalesce into at most one
     full refresh per 60 s (the toasts above stay instant); only a new payment refreshes at once. */
  const soon = tb === "payments" && ins, wait = soon ? 1500 : Math.max(1500, 300000 - (Date.now() - LAST_OK));
  if (RT_T && !soon) return; clearTimeout(RT_T); RT_T = setTimeout(() => { RT_T = null; refresh().catch(() => {}); }, wait);
}

/* ---------------- live: samples, deliveries, brief forms (founder request 11-23: "appear instantly") ----------------
   pipeline, deliveries and briefs each get their OWN small channel, not crm-live: a table that is not in the supabase_realtime
   publication yet makes the server reject (and retry every few seconds) every postgres_changes listener of that channel, which
   would also stop the payments / replies events. A rejected channel (system message status "error") is removed at once and
   tried again in 15 min, so nothing retries in a loop. Events coalesce like crm-live's: one TARGETED read per table at most
   every 10 s (pipeline = 1 request, deliveries = 1, briefs = briefs + form_leads_v2 = 2), never the ~45-request fetchAll.
   Fallback that works without the publication: while the tab is visible, every 60 s ONE small read per table for rows newer than
   the newest loaded (pipeline updated_at, briefs submitted_at); skipped for a table that had a realtime event in the last 5 min,
   and right after a full refresh. deliveries has no change time (delivered_at is a day), so it has no poll: realtime or the
   5-minute full refresh. Targeted reads never move LAST_OK, so the 5-minute safety loop runs exactly as before. */
const POLL_MS = +CFG.livePollMs || 60000, LIVE_TB = ["pipeline", "deliveries", "briefs"];
const PIPE_COLS = "email,name,show,owner,inbox,status,fu_stage,yes_at,delivered_at,public_at,last_reply_at,stage_changed_at,updated_at,next_action,next_action_at,paid,drive_link,campaign,builder";   // what the Samples board + the dashboard's sample counts use
const LIVE = Object.fromEntries(LIVE_TB.map(t => [t, { ch: null, ev: 0, read: 0, t: null, busy: false, retry: null, err: 0 }]));
let LIVE_AT = 0, LIVE_POLL = null, LIVE_LAST = 0;   // LIVE_AT = when a poll or a realtime event last brought rows (the Samples board's "as of")
const newest = (rows, k) => (rows || []).reduce((m, r) => r[k] && (!m || +new Date(r[k]) > +new Date(m)) ? r[k] : m, "");   // the raw string: keeps the database's microseconds for gt.
function liveDone() { LIVE_AT = Date.now(); renderAll(true); drPipe(); }
async function liveRead(tb) {   // the targeted read after realtime events
  const L = LIVE[tb]; if (L.busy || !RAW) return; L.busy = true; L.read = Date.now();
  try {
    if (tb === "pipeline") { const rows = await PIPE_READ(); if (RAW) RAW.pipeline = rows; }
    else if (tb === "deliveries") { const rows = await DLV_READ(); if (RAW) RAW.deliveries = rows; }
    else { const [b, f] = await Promise.all([all("briefs", BRIEF_COLS), FORMS_READ().catch(() => null)]); if (RAW) { RAW.briefs = b; if (f) RAW.forms = f; } }
    if (RAW) liveDone();
  } catch {} finally { L.busy = false; }
}
function onLive(tb) {
  const L = LIVE[tb]; L.ev = Date.now(); if (L.t) return;
  L.t = setTimeout(() => { L.t = null; liveRead(tb); }, Math.max(1500, L.read + 10000 - Date.now()));
}
function liveSub(tb) {
  const L = LIVE[tb]; clearTimeout(L.retry); L.retry = null; if (!sb) return;
  try { const ch = L.ch = sb.channel("crm-live-" + tb);
    ch.on("postgres_changes", { event: "*", schema: "public", table: tb }, () => onLive(tb));
    ch.on("system", {}, m => { if (!m || m.extension !== "postgres_changes" || m.status !== "error" || L.ch !== ch) return;   // not in the publication (yet)
      L.ch = null; try { sb.removeChannel(ch); } catch {} L.retry = setTimeout(() => liveSub(tb), 15 * 6e4); });
    ch.subscribe();
  } catch { L.ch = null; }
}
async function livePoll() {
  if (document.hidden || !RAW || Date.now() - Math.max(LAST_OK, LIVE_LAST) < POLL_MS * 0.9) return;   // a full read or a poll just ran: nothing to ask yet
  LIVE_LAST = Date.now(); const now = Date.now(), go = tb => now - LIVE[tb].ev >= 300000 && now >= LIVE[tb].err && !LIVE[tb].busy;
  const P = go("pipeline") && RAW.pipeline, B = go("briefs") && RAW.briefs ? newest(RAW.briefs, "submitted_at") : "";   // briefs null = not readable here: no poll
  const pc = P ? newest(RAW.pipeline, "updated_at") : "";
  const [pr, br] = await Promise.all([
    P ? all("pipeline", PIPE_COLS, q => pc ? q.gt("updated_at", pc) : q).catch(() => { LIVE.pipeline.err = Date.now() + 6e5; return []; }) : [],
    B ? all("briefs", BRIEF_COLS, q => q.gt("submitted_at", B)).catch(() => { LIVE.briefs.err = Date.now() + 6e5; return []; }) : []]);
  if (!RAW || (!pr.length && !br.length)) return;
  if (pr.length) { const by = new Map(RAW.pipeline.map(r => [lc(r.email), r])); pr.forEach(r => { const o = by.get(lc(r.email)); if (o) Object.assign(o, r); else RAW.pipeline.push(r); }); }
  if (br.length) { const seen = new Set(RAW.briefs.map(b => lc(b.email) + "|" + b.submitted_at)); br.forEach(b => { if (!seen.has(lc(b.email) + "|" + b.submitted_at)) RAW.briefs.push(b); });
    const f = await FORMS_READ().catch(() => null); if (f && RAW) RAW.forms = f; }   // a new form: the Forms card's view, read once
  if (RAW) liveDone();
}
function liveStart() { liveStop(); LIVE_TB.forEach(liveSub); LIVE_POLL = setInterval(() => livePoll().catch(() => {}), POLL_MS); }
function liveStop() { clearInterval(LIVE_POLL); LIVE_POLL = null; LIVE_TB.forEach(tb => { const L = LIVE[tb]; clearTimeout(L.t); clearTimeout(L.retry); L.t = L.retry = null; L.ev = 0; if (L.ch) { try { sb.removeChannel(L.ch); } catch {} L.ch = null; } }); }
document.addEventListener("visibilitychange", () => { if (!document.hidden && LIVE_POLL && RAW && Date.now() - LAST_OK <= 300000) livePoll().catch(() => {}); });   // back on the tab: catch up once (over 5 min away, the full refresh above runs instead)

/* ---------------- look: five glass themes, motion Full / Calm (both saved on this device) ---------------- */
function syncLook() {
  const cur = lookOf(), full = motionFull();
  $$('[data-act="look"]').forEach(b => b.setAttribute("aria-pressed", b.dataset.t === cur[0]));
  $$('[data-act="motion"]').forEach(b => { b.setAttribute("aria-checked", full); b.disabled = RM; });
  $$("[data-look-name]").forEach(x => { x.textContent = cur[1]; }); $$("[data-motion-l]").forEach(x => { x.textContent = full ? "Full" : "Calm"; });
}
function setTheme(id, save) {
  const t = THEMES.find(x => x[0] === id) || THEMES[0], h = document.documentElement;
  h.dataset.theme = t[0]; h.dataset.mode = t[2];
  const tc = $('meta[name="theme-color"]'); if (tc) tc.content = t[3];
  if (save) store.set("beju-crm-look", t[0]); syncLook();
}
function setMotion(m, save) { document.documentElement.dataset.motion = RM || m === "calm" ? "calm" : "full"; if (save) store.set("beju-crm-motion", m); syncLook(); }
const FIRST_LOOK = !store.get("beju-crm-look");   // nothing saved yet: Frost, and offer the picker once after sign-in
setTheme(store.get("beju-crm-look")); setMotion(store.get("beju-crm-motion"));
/* Glass costs frames on weak machines. Measure once after the first render; under ~40 frames a second the cards drop the
   live blur and keep the tint (html.fx-lite). Phones never blur the cards, so there is nothing to measure there. */
let FXM = false;
function measureFx() {
  if (FXM || RM || PHONE.matches) return; FXM = true;
  setTimeout(() => { if (document.hidden) { FXM = false; return; } let n = 0; const t0 = performance.now();
    const tick = t => { if (document.hidden) { FXM = false; return; } n++; if (t - t0 < 1500) requestAnimationFrame(tick); else if (n / (t - t0) * 1000 < 40) document.documentElement.classList.add("fx-lite"); };
    requestAnimationFrame(tick); }, 2600);
}
/* Phones that report tilt without asking (Android) move the hero highlight with the device. This never asks for the permission:
   where the browser wants a prompt first (iOS) no event arrives and the sheen keeps sweeping on its own. */
if (COARSE && !RM && "DeviceOrientationEvent" in window) {
  let q = false;
  addEventListener("deviceorientation", e => { if (e.gamma == null || q || !motionFull()) return; q = true;
    requestAnimationFrame(() => { q = false; const h = $("#hero"); if (!h) return; document.documentElement.classList.add("tilt-on");
      h.style.setProperty("--sx", (clamp(e.gamma / 30, -1, 1) * 30).toFixed(1) + "%"); h.style.setProperty("--sy", (clamp((e.beta - 40) / 30, -1, 1) * 18).toFixed(1) + "%"); }); }, { passive: true });
}

/* ---------------- 11-22 motion pass (SIMAS "crazy opening animations and transitions, very smooth, very clean, with a WOW effect") ----------------
   Transform and opacity only (plus a short blur on the logo). Opening: the full sequence once per browser session (sessionStorage), a light fade
   on later loads. Page switches and drill sheets use the View Transitions API where the browser has it; elsewhere a CSS entrance. Reduced motion:
   everything instant. The classes on <html> (intro, soft, pg-in, vt-*) only switch the CSS in anim.css on and off; no data logic here. */
const VT = typeof document.startViewTransition === "function", INTRO = "beju-crm-intro";
const PG = ["home", "money", "leads", "outreach", "expenses", "email", "clients", "samples", "contacts", "perf", "weekly", "todos", "slack"];
let VT_PASS = false, PG_T = null, SP_T = null, PG_SEQ = 0; const PG_NAMED = [];
{ const s = store.get("beju-crm-nav"); document.documentElement.dataset.skr = (s ? s === "x" : innerWidth >= 1300) ? "x" : "m"; }   // the loading screen draws the menu rail at its saved width (side.js's rule)
const vtGo = cb => { const vt = document.startViewTransition(cb); vt.ready.catch(() => {}); return vt; };   // a skipped transition (a new one started, the tab hid) is not an error
const inView = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; };
function order() {   // --n = a pane's place in reading order (top to bottom, then left to right) for the staggered entrances
  const els = [...$$("#mtiles>.mt"), ...CARDS.map(c => c.el)].filter(el => el && el.offsetParent !== null), r = new Map(els.map(el => [el, el.getBoundingClientRect()]));
  els.sort((a, b) => (Math.round(r.get(a).top / 8) - Math.round(r.get(b).top / 8)) || (r.get(a).left - r.get(b).left)).forEach((el, i) => el.style.setProperty("--n", Math.min(i, 8)));
}
function intro() {
  if (RM) return; const h = document.documentElement;
  let seen = false; try { seen = sessionStorage.getItem(INTRO) === "1"; sessionStorage.setItem(INTRO, "1"); } catch {}
  CARDS.forEach(c => { if (c.el) fit(c.el); }); order();
  const k = seen ? "soft" : "intro"; h.classList.add(k); setTimeout(() => h.classList.remove(k), seen ? 700 : 1600);
  if (!seen) requestAnimationFrame(() => {   // the loading screen's BEJÚ mark flies into the menu's logo (phones: it blooms away)
    const boot = $("#boot"), mk = $(".skl-mark", boot), lg = $("#snav .sn-logo"); if (!mk || !lg || PHONE.matches || !inView(lg) || !boot.classList.contains("out")) return;
    const b = lg.getBoundingClientRect(), mx = mk.offsetLeft + mk.offsetWidth / 2, my = mk.offsetTop + mk.offsetHeight / 2;   // layout boxes: the entrances' own scaling does not move a centre
    mk.style.setProperty("--fx", Math.round(b.left + b.width / 2 - mx) + "px"); mk.style.setProperty("--fy", Math.round(b.top + b.height / 2 - my) + "px"); mk.style.setProperty("--fs", (lg.offsetWidth / mk.offsetWidth).toFixed(3));
    boot.classList.add("fly"); });
}
function pageIn() {   // the new page's panes rise in, in reading order
  if (RM) return; const h = document.documentElement; order(); h.classList.add("pg-in"); clearTimeout(PG_T); PG_T = setTimeout(() => h.classList.remove("pg-in"), 900);
}
const pgCur = () => $('#snav .sn-list a[data-nav][aria-current="page"]');   // side.js marks the open page
const pgNow = () => { const a = pgCur(); return document.documentElement.classList.contains("paged") && a ? a.dataset.nav : STATE.tab || "home"; };
const pgTo = t => t.dataset.act === "tab" ? t.dataset.t || "home" : t.dataset.act === "page" ? t.dataset.p : t.dataset.nav === "dashboard" ? "home" : t.dataset.nav;
function pills() {   // the highlighted menu item and phone tab: they slide to their new place during a page switch
  const p = pgNow(), paged = document.documentElement.classList.contains("paged"), vis = el => el && el.offsetParent !== null ? el : null, ok = PG.includes(p);
  return [PHONE.matches || !ok ? null : vis(paged ? pgCur() : p === "home" ? $('#snav .sn-list a[data-nav="dashboard"]') : $(`#snav .sn-list button[data-t="${p}"]`)),
    !ok ? null : vis(paged ? $(`#tabs [data-p="${p}"]`) : $("#tabs button.on"))];
}
function pageGo(update) {
  if (!VT || RM || $("#snav").classList.contains("open")) { update(); pageIn(); return; }   // the phone drawer slides away on its own; a snapshot would freeze it
  /* the page's content regions leave as their own groups (vt-o*) and the new ones arrive as others (vt-n*): a fade through, so the menu,
     the top bar and the backdrop stay perfectly still and old and new content never double-expose */
  const h = document.documentElement, my = ++PG_SEQ, name = (el, n) => { el.style.setProperty("view-transition-name", n); PG_NAMED.push(el); }, untag = () => PG_NAMED.splice(0).forEach(el => el.style.removeProperty("view-transition-name")),
    tag = pre => { pills().forEach((el, i) => { if (el) name(el, i ? "vt-tpill" : "vt-pill"); }); ["#hero", "#mtiles", "#grid", "#spage", "#app>.foot", "#asof"].forEach((q, i) => { const el = $(q); if (el && el.offsetParent !== null) name(el, pre + i); });
      [["#snav", "vt-nav"], ["#tabs", "vt-tabs"], ["#toasts", "vt-toasts"], ["#sn-tip", "vt-tip"]].forEach(([q, n]) => { const el = $(q); if (el && el.getClientRects().length) name(el, n); }); };   // fixed overlays keep painting above the content
  untag(); tag("vt-o"); h.classList.add("vt-pg");   // untag first: a switch clicked during the previous one starts clean
  const vt = vtGo(() => { untag(); VT_PASS = true; try { update(); } finally { VT_PASS = false; } tag("vt-n"); pageIn(); });
  const done = () => { if (my !== PG_SEQ) return; h.classList.remove("vt-pg"); untag(); }; vt.finished.then(done, done);   // a newer switch owns the names now
}
document.addEventListener("click", ev => {   // capture phase, before side.js and the handlers below: a page switch replays its click inside a view transition
  if (VT_PASS || !ev.isTrusted || ev.button > 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || $("#app").hidden || !$("#veil").hidden) return;
  const t = ev.target.closest && ev.target.closest('#snav a[data-nav], [data-act="tab"], [data-act="page"]'); if (!t || pgTo(t) === pgNow()) return;
  ev.preventDefault(); ev.stopImmediatePropagation(); pageGo(() => t.click());
}, true);
addEventListener("popstate", ev => {   // back / forward between pages: the same transition (side.js routes the replayed event)
  if (VT_PASS || !VT || RM || $("#app").hidden) return;
  const a = pgCur(), was = a ? a.dataset.nav : "dashboard", to = new URLSearchParams(location.search).get("p") || "dashboard"; if (was === to) return;
  ev.stopImmediatePropagation(); pageGo(() => dispatchEvent(new PopStateEvent("popstate", { state: ev.state })));
});
{ const sp = $("#spage"); let sk = false;   // a side page's skeleton gives way to its content with a short fade
  new MutationObserver(() => { const now = !!$(".sp-sk", sp); if (sk && !now && !RM) { sp.classList.add("sp-in"); clearTimeout(SP_T); SP_T = setTimeout(() => sp.classList.remove("sp-in"), 800); } sk = now; }).observe(sp, { childList: true }); }

/* ---------------- events ---------------- */
const layer = () => PAL ? $("#pal") : !$("#dlg").hidden ? $("#dlg") : !$("#drawer").hidden ? $("#drawer") : !$("#veil").hidden ? $("#veil") : null;
document.addEventListener("click", ev => {
  $$(".plot.hov").forEach(p => { if (!p.contains(ev.target) && document.activeElement !== p) { p.classList.remove("hov"); delete p.dataset.armed; } });
  const b = ev.target.closest("[data-act]");
  if (!b) { const id = ev.target.id; if (id === "scrim") closeLead(); else if (id === "veil") closeDrill(); else if (id === "pal") closePal(); else if (id === "dlg" && ASK) ASK.done(null);
    else { const pl = ev.target.closest(".plot"); if (pl) plotAt(pl, ev, true); } return; }
  const a = b.dataset.act;
  if (a === "lead") openLead(b.dataset.email, b);
  else if (a === "drill") openDrill(b.dataset.k, b.dataset.a, b);
  else if (a === "page") goPage(b.dataset.p);   // 11-22 (SIMAS): a bento card's title moves to its page
  else if (a === "feedf") { const s = STATE.drill, top = STACK[STACK.length - 1]; if (s && s.k === "feed") { s.a = b.dataset.f; if (top && top.k === "feed") top.a = s.a; showDrill(DR.feed(s.a), SEQ); const nb = $(`[data-act="feedf"][data-f="${s.a}"]`); if (nb) nb.focus(); } }   // Activity filter chips: swap the list in place, no new back step
  else if (a === "back") { if (STACK.length > 1) { STACK.pop(); const s = STACK[STACK.length - 1]; openDrill(s.k, s.a, null, true); } }
  else if (a === "mclose") closeDrill();
  else if (a === "owner") { STATE.owner = b.dataset.o; STATE.att = ""; renderAll(); }
  else if (a === "period") setPeriod(b.dataset.p);
  else if (a === "tab") setTab(b.dataset.t);
  else if (a === "page") { const l = $(`#snav a[data-nav="${b.dataset.p}"]`); if (l) l.click(); }   // phone tab bar -> a side page (side.js routes it)
  else if (a === "chpw") changePw();
  else if (a === "mfa") mfaManage();
  else if (a === "pernext") { const o = Object.keys(PER); setPeriod(o[(o.indexOf(STATE.period) + 1) % o.length]); const nb = $('[data-act="pernext"]'); if (nb) nb.focus(); }
  else if (a === "msgmore") { const t = b.previousElementSibling, open = t.classList.toggle("clamp") === false; b.textContent = open ? "Show less" : "Show more"; b.setAttribute("aria-expanded", open); }
  else if (a === "convjump") { const w = b.closest(".cvw"), last = w && $(".conv .cv-m", w); if (last) { last.scrollIntoView({ block: "start", behavior: RM ? "auto" : "smooth" }); last.classList.remove("flashm"); void last.offsetWidth; last.classList.add("flashm"); } }   // the newest = the first message
  else if (a === "convolder") { const w = b.closest(".cvw"), o = w && $(".cv-older", w); if (o) { o.hidden = false; w.dataset.all = "1"; b.remove(); const f = $(".cv-m", o); if (f) { f.tabIndex = -1; f.focus({ preventScroll: true }); } } }
  else if (a === "range") { STATE.range = +b.dataset.r; renderAll(); }
  else if (a === "series") { STATE[b.dataset.s] = !STATE[b.dataset.s]; if (!STATE.sa && !STATE.sb) STATE[b.dataset.s === "sa" ? "sb" : "sa"] = true; renderAll(); }
  else if (a === "sort") { const k = b.dataset.key, o = k === "hotSort" ? ["wait", "next", "reply"] : ["sent", "rate"]; STATE[k] = o[(o.indexOf(STATE[k]) + 1) % o.length]; renderAll(); const nb = $(`[data-act="sort"][data-key="${k}"]`); if (nb) nb.focus(); }
  else if (a === "att") { STATE.att = STATE.att === b.dataset.k ? "" : b.dataset.k; renderAll(); const nb = $(`[data-act="att"][data-k="${CSS.escape(b.dataset.k)}"]`); if (nb) nb.focus(); }
  else if (a === "day") { STATE.day = b.dataset.d; renderAll(); const nb = $(`[data-act="day"][data-d="${b.dataset.d}"]`); if (nb) nb.focus(); }
  else if (a === "hotall") { STATE.hotAll = !STATE.hotAll; renderAll(); }
  else if (a === "todayall") { STATE.todayAll = !STATE.todayAll; renderAll(); }
  else if (a === "ftdone") ftDone(b.dataset.id, b);
  else if (a === "dft") draftOp(b.dataset.op, b.dataset.id, b);
  else if (a === "wof") wofGo(WOF.rows.find(x => x.key === b.dataset.k), b);   // 11-23: Waiting on a founder row
  else if (a === "wofx") { const k = b.dataset.k; if (!WOF.open.delete(k)) WOF.open.add(k); renderWof(D); const nb = $(`[data-act="wofx"][data-k="${CSS.escape(k)}"]`); if (nb) nb.focus(); }
  else if (a === "wofall") { WOF.all = !WOF.all; renderWof(D); const nb = $('[data-act="wofall"]'); if (nb) nb.focus(); }
  else if (a === "ctdone") ctDone(b.dataset.id, b);
  else if (a === "cnadd") { b.hidden = true; b.insertAdjacentHTML("afterend", callNotesForm(b.dataset.uid, b.dataset.email)); const t = b.nextElementSibling && $("textarea", b.nextElementSibling); if (t) t.focus(); }
  else if (a === "cncancel") { const f = b.closest("form"), add = f && f.previousElementSibling; if (f) f.remove(); if (add && add.dataset.act === "cnadd") { add.hidden = false; add.focus(); } }
  else if (a === "look") setTheme(b.dataset.t, true);
  else if (a === "motion") setMotion(motionFull() ? "calm" : "full", true);
  else if (a === "refresh") refresh(true).catch(() => {});
  else if (a === "signout") signOut();
  else if (a === "jump") jump(b.dataset.id);
  else if (a === "palette") openPal();
  else if (a === "palrun") palRun(+b.dataset.i);
  else if (a === "pop") pOp(b.dataset.op, b.dataset.id, b);
  else if (a === "dlg-no") { if (ASK) ASK.done(null); }
  else if (a === "nav") navLead(+b.dataset.d);
  else if (a === "notifs") openDrill("notifs", "", b);
  else if (a === "nt") ntOp(b.dataset.op, b.dataset.id, b);
  else if (a === "tlall") { TL.all = !TL.all; const el = $("#dr-tl"); if (el) el.outerHTML = tlSec(); const nb = $('#dr-tl [data-act="tlall"]'); if (nb) nb.focus(); }
  else if (a === "copy") { const t = b.dataset.t; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast(`${b.dataset.what || "Email"} copied`, "copy", "c-green", t)).catch(() => toast("Copy did not work here", "alert", "c-red", t)); }
});
$("#dlg-form").addEventListener("submit", ev => { ev.preventDefault(); askSubmit(); });
document.addEventListener("submit", ev => { const f = ev.target; if (!f.classList) return; if (f.classList.contains("cnform")) { ev.preventDefault(); saveCallNotes(f); } else if (f.classList.contains("sform")) { ev.preventDefault(); postSlackForm(f); } });   // 11-21: call-notes + Slack forms
$("#dlg").addEventListener("change", ev => { if (ev.target.dataset.k === "pack") { const p = PACKS.find(x => x[0] === ev.target.value); if (p) { $('[data-k="videos"]', $("#dlg")).value = p[2]; $('[data-k="amount"]', $("#dlg")).value = p[3]; } } });
/* charts: hover, tap and arrow keys all go through PLOT[id] */
function plotAt(box, ev, go) {
  const P = PLOT[box.dataset.plot]; if (!P) return; const hit = ev.target.closest ? ev.target.closest("[data-i]") : null; let i;
  if (hit && box.contains(hit)) i = +hit.dataset.i; else if (box.dataset.plot === "heat" || box.dataset.plot === "clock") return; else { const r = box.getBoundingClientRect(), x = clamp((ev.clientX - r.left) / r.width, 0, 1); i = box.dataset.plot === "rev" ? clamp(Math.round(x * P.n) - 1, 0, P.n - 1) : P.n < 2 ? 0 : Math.round(x * (P.n - 1)); }
  P.i = clamp(i, 0, P.n - 1); P.paint(P.i); box.classList.add("hov");
  if (go) { if ((ev.pointerType === "touch" || COARSE) && box.dataset.armed !== String(P.i)) { box.dataset.armed = P.i; return; } delete box.dataset.armed; P.drill(P.i); }
}
let PM = null, PMQ = false, LAST_T = null, LAST_M = null, LAST_P = null;
document.addEventListener("pointermove", ev => { PM = ev; if (PMQ) return; PMQ = true; requestAnimationFrame(() => { PMQ = false; const e = PM, tg = e.target; if (!tg || !tg.closest) return;
  const pl = tg.closest(".plot"); if (pl) { plotAt(pl, e); LAST_P = pl; } else if (LAST_P) { if (document.activeElement !== LAST_P) LAST_P.classList.remove("hov"); LAST_P = null; }
  if (!HOVER || RM) return;
  const c = tg.closest(".card,.hero"); if (c) { const r = c.getBoundingClientRect(); c.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px"); c.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px"); }
  const t = c && c.classList.contains("tilt") ? c : null; if (LAST_T && LAST_T !== t) { LAST_T.style.setProperty("--rx", "0deg"); LAST_T.style.setProperty("--ry", "0deg"); }
  if (t) { const r = t.getBoundingClientRect(); t.style.setProperty("--ry", (((e.clientX - r.left) / r.width - .5) * 7).toFixed(2) + "deg"); t.style.setProperty("--rx", ((.5 - (e.clientY - r.top) / r.height) * 7).toFixed(2) + "deg"); } LAST_T = t;
  const m = tg.closest(".mag"); if (LAST_M && LAST_M !== m) { LAST_M.style.setProperty("--bx", "0px"); LAST_M.style.setProperty("--by", "0px"); }
  if (m) { const r = m.getBoundingClientRect(); m.style.setProperty("--bx", (((e.clientX - r.left) / r.width - .5) * 8).toFixed(1) + "px"); m.style.setProperty("--by", (((e.clientY - r.top) / r.height - .5) * 6).toFixed(1) + "px"); } LAST_M = m;
}); }, { passive: true });
document.addEventListener("pointerdown", ev => { const pl = ev.target.closest && ev.target.closest(".plot"); if (pl) plotAt(pl, ev); });
document.addEventListener("focusin", ev => { const pl = ev.target.classList && ev.target.classList.contains("plot") ? ev.target : null; if (pl && pl.matches(":focus-visible")) { const P = PLOT[pl.dataset.plot]; if (P) { P.paint(P.i); pl.classList.add("hov"); } } });
document.addEventListener("focusout", ev => { if (ev.target.classList && ev.target.classList.contains("plot")) ev.target.classList.remove("hov"); });
document.addEventListener("input", ev => { if (ev.target.classList && ev.target.classList.contains("cv-q")) { const w = ev.target.closest(".cvw"), ms = w && CONVS.get(w.dataset.cv); if (ms) { if (ev.target.value) w.dataset.all = "1"; $(".conv", w).innerHTML = convMsgs(ms, ev.target.value, w.dataset.all === "1"); } return; }   // a search reveals the older messages for good
  if (ev.target.classList && ev.target.classList.contains("pg-q")) { STATE.pq[ev.target.dataset.k] = ev.target.value; const q = lc(ev.target.value); $$("#m-body [data-q]").forEach(el => { el.hidden = !!q && !el.dataset.q.includes(q); }); return; }
  if (ev.target.id === "pal-q" && PAL) { PAL.sel = 0; palRender(); } });
document.addEventListener("keydown", ev => {
  const ae = document.activeElement, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(ae?.tagName || ""), L = layer();
  if ((ev.metaKey || ev.ctrlKey) && lc(ev.key) === "k") { ev.preventDefault(); if (!$("#app").hidden) PAL ? closePal() : openPal(); return; }
  if (ev.key === "Escape") { if (PAL) return closePal(); if (ASK) return ASK.done(null); if (!$("#drawer").hidden) return closeLead(); if (!$("#veil").hidden) return closeDrill(); return; }
  if (PAL) { if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); PAL.sel = clamp(PAL.sel + (ev.key === "ArrowDown" ? 1 : -1), 0, Math.max(0, PAL.items.length - 1)); palRender(); } else if (ev.key === "Enter") { ev.preventDefault(); palRun(PAL.sel); } else if (ev.key === "Tab") ev.preventDefault(); return; }
  if (ev.key === "Tab" && L) { const f = $$('button:not([disabled]),a[href],input,select,textarea,[tabindex="0"]', L).filter(x => x.offsetParent !== null); if (!f.length) return; const first = f[0], last = f[f.length - 1];
    if (!L.contains(ae)) { ev.preventDefault(); first.focus(); } else if (ev.shiftKey && ae === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && ae === last) { ev.preventDefault(); first.focus(); } return; }
  if (ae && ae.classList && ae.classList.contains("plot")) { const P = PLOT[ae.dataset.plot]; if (P) { const step = ev.key === "ArrowRight" || ev.key === "ArrowDown" ? 1 : ev.key === "ArrowLeft" || ev.key === "ArrowUp" ? -1 : 0, jmp = ae.dataset.plot === "heat" && (ev.key === "ArrowLeft" || ev.key === "ArrowRight") ? 7 : 1;
      if (step) { ev.preventDefault(); P.i = ae.dataset.plot === "clock" ? (P.i + step + P.n) % P.n : clamp(P.i + step * jmp, 0, P.n - 1); P.paint(P.i); ae.classList.add("hov"); return; } if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); P.drill(P.i); return; } } }
  if (!$("#drawer").hidden && !typing && !ASK && (ev.key === "ArrowRight" || ev.key === "ArrowLeft")) { ev.preventDefault(); return navLead(ev.key === "ArrowRight" ? 1 : -1); }
  if (!typing && !L && !ev.metaKey && !ev.ctrlKey && !ev.altKey && !$("#app").hidden) {
    if (ev.key === "/") { ev.preventDefault(); return openPal(); }
    if (lc(ev.key) === "w") return toggleWall();
    if (lc(ev.key) === "n" && NT) { ev.preventDefault(); return openDrill("notifs", "", $("#nt-btn")); }
  }
});
$("#dr-close").addEventListener("click", closeLead);

/* ---------------- phone: bottom sheets drag down to close, keyboard-safe height, paused when hidden ---------------- */
function sheet(handle, el, close) { let y0 = null, dy = 0;
  handle.addEventListener("touchstart", e => { if (!PHONE.matches) return; y0 = e.touches[0].clientY; dy = 0; el.classList.add("drag"); }, { passive: true });
  handle.addEventListener("touchmove", e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); el.style.setProperty("--dy", dy + "px"); }, { passive: true });
  const end = () => { if (y0 == null) return; y0 = null; el.classList.remove("drag"); el.style.setProperty("--dy", "0px"); if (dy > 110) close(); };
  handle.addEventListener("touchend", end); handle.addEventListener("touchcancel", end); }
sheet($("#drawer .dr-top"), $("#drawer"), closeLead); sheet($("#veil .modal-top"), $("#veil .modal"), closeDrill);
const VV = window.visualViewport, setVV = () => document.documentElement.style.setProperty("--vvh", Math.round(VV ? VV.height : innerHeight) + "px"); setVV(); if (VV) VV.addEventListener("resize", setVV); addEventListener("resize", setVV);
document.addEventListener("visibilitychange", () => document.documentElement.classList.toggle("paused", document.hidden));
setTab(store.get("beju-crm-tab") || "home", true);

/* ---------------- founder 2-step login (TOTP; SIMAS 11-12 "make it very safe") ----------------
   The CRM asks for the authenticator code before it loads any data. Until crm_mfa_enforce.sql is applied, the
   database itself still accepts a password-only founder session: this gate is the page's side of the lock. */
const MFA_LATER = "beju-crm-mfa-later";
function mfaScreen(html) { $("#mfa-card").innerHTML = html; show("mfa"); const i = $("#mfa-code"); if (i) setTimeout(() => i.focus(), 40); }
const mfaMsg = (t, ok) => { const el = $("#mfa-msg"); if (!el) return; el.hidden = !t; el.textContent = t || ""; el.classList.toggle("ok", !!ok); };
const qrSrc = q => { q = String(q || ""); if (q.startsWith("data:")) { const i = q.indexOf(","); return q.slice(0, i + 1).replace(/;utf-8,$/, ";charset=utf-8,") + encodeURIComponent(decodeURIComponentSafe(q.slice(i + 1))); } return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(q); };
function decodeURIComponentSafe(x) { try { return decodeURIComponent(x); } catch { return x; } }
const codeField = `<label class="fld"><span>6-digit code from your authenticator app</span><input id="mfa-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" required></label>`;
async function mfaGate() {
  const { data: aal, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  if (aal.currentLevel === "aal2") return true;
  const { data: f, error: e2 } = await sb.auth.mfa.listFactors(); if (e2) throw e2;
  const ok = (f.totp || []).filter(x => x.status === "verified");
  if (ok.length) return mfaChallenge(ok[0]);
  let later = false; try { later = sessionStorage.getItem(MFA_LATER) === "1"; } catch {}
  return later ? true : mfaEnroll(true);
}
function mfaChallenge(factor) {
  return new Promise(resolve => {
    mfaScreen(`<div class="brandrow"><span class="logo"><img src="../beju-mark-sm.png" alt="" width="34" height="20"></span><div><b>Beju Creative</b><small>Founder <em class="sf">CRM</em></small></div></div>
      <h1 class="wait-h">Enter your code</h1><p class="wait-p">Open your authenticator app and type the 6-digit code for BEJÚ. The CRM stays locked until you do.</p>
      <form id="mfa-form" novalidate>${codeField}<p class="gate-msg" id="mfa-msg" role="alert" hidden></p>
      <button class="btn-go mag" type="submit">Unlock the CRM</button></form>
      <div class="wait-row"><button class="btn-ghost" type="button" id="mfa-out">Sign out</button></div>`);
    $("#mfa-form").onsubmit = async ev => { ev.preventDefault(); const code = $("#mfa-code").value.replace(/\D/g, "");
      if (code.length !== 6) return mfaMsg("Enter the 6 digits from the app.");
      const b = $("#mfa-form .btn-go"); b.disabled = true; mfaMsg("");
      const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      b.disabled = false;
      if (error) { $("#mfa-code").value = ""; $("#mfa-code").focus(); return mfaMsg(/rate|too many/i.test(error.message) ? "Too many tries. Wait a minute." : "That code didn't work. Codes change every 30 seconds: use the newest one."); }
      resolve(true); };
    $("#mfa-out").onclick = () => { resolve(false); signOut(); };
  });
}
async function mfaEnroll(gateMode) {
  const { data: f } = await sb.auth.mfa.listFactors();   // remove a half-finished set-up first
  for (const x of ((f && f.all) || []).filter(x => x.factor_type === "totp" && x.status !== "verified")) { try { await sb.auth.mfa.unenroll({ factorId: x.id }); } catch {} }
  const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `BEJÚ CRM ${new Date().toISOString().slice(0, 16)}` });
  if (error) throw error;
  return new Promise(resolve => {
    mfaScreen(`<div class="brandrow"><span class="logo"><img src="../beju-mark-sm.png" alt="" width="34" height="20"></span><div><b>Beju Creative</b><small>Founder <em class="sf">CRM</em></small></div></div>
      <h1 class="wait-h">Turn on 2-step login</h1>
      <p class="wait-p">This CRM can change client data. With 2-step login, a stolen password alone can't open it.</p>
      <ol class="mfa-steps"><li>Open an authenticator app (Google Authenticator, 1Password, Authy…).</li><li>Scan this code, or type the key by hand.</li><li>Enter the 6-digit code it shows.</li></ol>
      <div class="mfa-qr"><img id="mfa-qr" alt="QR code for your authenticator app" width="180" height="180"><div><span class="mut">Key</span><code id="mfa-secret"></code></div></div>
      <form id="mfa-form" novalidate>${codeField}<p class="gate-msg" id="mfa-msg" role="alert" hidden></p>
      <button class="btn-go mag" type="submit">Turn it on</button></form>
      <div class="wait-row">${gateMode ? `<button class="btn-ghost" type="button" id="mfa-later">Not now</button><button class="btn-ghost" type="button" id="mfa-out">Sign out</button>` : `<button class="btn-ghost" type="button" id="mfa-cancel">Cancel</button>`}</div>`);
    $("#mfa-qr").src = qrSrc(data.totp.qr_code); $("#mfa-secret").textContent = data.totp.secret;
    $("#mfa-form").onsubmit = async ev => { ev.preventDefault(); const code = $("#mfa-code").value.replace(/\D/g, "");
      if (code.length !== 6) return mfaMsg("Enter the 6 digits from the app.");
      const b = $("#mfa-form .btn-go"); b.disabled = true; mfaMsg("");
      const { error: e } = await sb.auth.mfa.challengeAndVerify({ factorId: data.id, code });
      b.disabled = false;
      if (e) { $("#mfa-code").value = ""; return mfaMsg("That code didn't work. Check the phone's clock and use the newest code."); }
      resolve(true); };
    if (gateMode) { $("#mfa-later").onclick = () => { try { sessionStorage.setItem(MFA_LATER, "1"); } catch {} resolve(true); }; $("#mfa-out").onclick = () => { resolve(false); signOut(); }; }
    else $("#mfa-cancel").onclick = async () => { try { await sb.auth.mfa.unenroll({ factorId: data.id }); } catch {} resolve(false); };
  });
}
async function mfaManage() {
  try {
    const { data: f, error } = await sb.auth.mfa.listFactors(); if (error) throw error;
    const ok = (f.totp || []).filter(x => x.status === "verified");
    if (!ok.length) { const on = await mfaEnroll(false); show("app"); if (on) toast("2-step login is on", "check", "c-green", "Next logins ask for the code"); return; }
    const r = await ask({ title: "2-step login is on", sees: `Nothing for clients. Turned on ${fDT(ok[0].created_at)}. Turning it off means your password alone opens the CRM again.`, cta: "Turn it off", danger: true }); if (!r) return;
    const { error: e2 } = await sb.auth.mfa.unenroll({ factorId: ok[0].id }); if (e2) throw e2;
    toast("2-step login is off", "alert", "c-orange", "Turn it back on from this menu");
  } catch (e) { show("app"); toast("That didn't work", "alert", "c-red", cut(String(e && e.message || e), 140)); }
}

/* ---------------- auth gate ---------------- */
let BOOT_T = null;
const show = id => { ["gate", "wait", "mfa", "app"].forEach(x => { $("#" + x).hidden = x !== id; }); $("#tabs").hidden = id !== "app";
  const boot = $("#boot"), was = !boot.hidden && !boot.classList.contains("out"); clearTimeout(BOOT_T);
  if (id === "boot") { boot.classList.remove("out", "fly"); boot.hidden = false; }
  else if (id === "app" && was && !RM) { boot.classList.add("out"); BOOT_T = setTimeout(() => { boot.hidden = true; boot.classList.remove("out", "fly"); }, 800); }   // 11-22 motion: the skeleton fades while the dashboard rises in under it
  else { boot.hidden = true; boot.classList.remove("out", "fly"); } };
let MODE = "in", JUST_UP = false;
function setMode(m) {
  MODE = m; $("#tab-in")?.classList.toggle("on", m === "in"); $("#tab-up")?.classList.toggle("on", m === "up");
  $("#tab-in")?.setAttribute("aria-selected", m === "in"); $("#tab-up")?.setAttribute("aria-selected", m === "up");
  $("#fld-name").hidden = m !== "up"; $("#g-pass").autocomplete = m === "up" ? "new-password" : "current-password";
  $("#gate-go-t").textContent = m === "up" ? "Create login" : "Log in"; msg("");
}
function msg(t, ok) { const el = $("#gate-msg"); el.hidden = !t; el.textContent = t || ""; el.classList.toggle("ok", !!ok); }
$("#tab-in")?.addEventListener("click", () => setMode("in")); $("#tab-up")?.addEventListener("click", () => setMode("up"));   // sign-up tab removed 11-12 (Benas): the page is log in only
$("#gate-form").addEventListener("submit", async ev => {
  ev.preventDefault();
  const email = $("#g-email").value.trim().toLowerCase(), pass = $("#g-pass").value, name = $("#g-name").value.trim(), go = $("#gate-go");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return msg("Enter your email address.");
  if (pass.length < 8) return msg("The password needs at least 8 characters.");
  if (MODE === "up" && !name) return msg("Enter your name.");
  go.disabled = true; msg("");
  try {
    if (MODE === "up") {
      const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { name } } });
      if (error) throw error;
      if (!data.session) { setMode("in"); return msg("Login created. Check your email to confirm it, then log in.", true); }
      JUST_UP = true; await enter(data.session.user);
    } else {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      await enter(data.user);
    }
    $("#g-pass").value = "";
  } catch (e) {
    const m = String(e && e.message || e);
    msg(/invalid login/i.test(m) ? "Wrong email or password." : /already registered/i.test(m) ? "That email already has a login. Use Log in." : /fetch|network/i.test(m) ? "No connection. Try again." : cut(m, 140));
  } finally { go.disabled = false; }
});
async function enter(user) {
  let p = null;
  for (let i = 0; i < 3 && !p; i++) {   // the profile row is created by a trigger right after sign-up
    p = await must(sb.from("profiles").select("id,name,email,is_admin").eq("id", user.id).maybeSingle());
    if (!p) await new Promise(r => setTimeout(r, 500));
  }
  if (!p || p.is_admin !== true) {   // not a founder: fetch nothing else
    ME = null; RAW = null; stopLoop(); stopRealtime();
    if (!JUST_UP) { show("boot"); location.replace(PORTAL_HOME); return; }   // a client login belongs in the portal; only someone who just asked for a founder login waits here
    $("#wait-email").textContent = user.email || ""; show("wait"); return; }
  ME = { ...p, email: user.email || p.email };
  try { if (!(await mfaGate())) return; }   // 2-step login before any founder data loads
  catch (e) { ME = null; show("gate"); msg("The 2-step login check didn't work. Check your connection and log in again."); return; }
  $("#nav-site").href = $("#nav-web").href = SITE; $("#nav-portal").href = PORTAL; $("#nav-portal").hidden = !PORTAL_ON;
  show("boot"); build(); mountHero();
  try { await refresh(); show("app"); intro(); startLoop(); startRealtime(); slackProbe(); requestAnimationFrame(() => CARDS.forEach(c => fit(c.el))); measureFx();
    if (FIRST_LOOK && !store.get("beju-crm-look")) { store.set("beju-crm-look", lookOf()[0]); openDrill("look", "first"); } }
  catch (e) { show("gate"); msg("Couldn't load the CRM data. Check your connection and log in again."); }
}
async function signOut() { stopLoop(); stopRealtime(); closePal(); if (ASK) ASK.done(null); closeLead(); closeDrill(); try { await sb.auth.signOut(); } catch {} ME = RAW = D = null; NT = null; NTS.open = NTS.form = null; NTS.all = false; TOASTED.clear(); clearTimeout(NT_SN); paintBell(); PREV.clear(); feedSeen.clear(); $("#grid").innerHTML = $("#grid2").innerHTML = $("#hero").innerHTML = ""; setMode("in"); show("gate"); }
$("#wait-out").addEventListener("click", signOut); $("#wait-portal").href = PORTAL_HOME; $("#wait-portal").hidden = !PORTAL_ON;
$("#wait-check").addEventListener("click", async () => { const { data } = await sb.auth.getSession(); if (data.session) enter(data.session.user).catch(() => {}); else show("gate"); });

/* ---------------- boot ---------------- */
(async () => {
  if (!window.supabase || !CFG.supabaseUrl || !CFG.supabaseAnonKey) { show("gate"); return msg("Couldn't load the page. Check your connection and refresh."); }
  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  window.BEJU_CRM_SB = sb;   // 11-19: the sidebar (side.js) shares this one client, so there is one session and one token refresh
  sb.auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT" && ME) setTimeout(signOut, 0); });   // no Supabase calls inside this callback
  try { const { data } = await sb.auth.getSession(); if (data.session) await enter(data.session.user); else show("gate"); }
  catch (e) { show("gate"); }
})();
})();
