/* Beju Creative client portal v2 (static files, no build step).
   Client screens only: no founder pages and no founder tables. Every query is limited by row-level security to the
   signed-in user's own rows; the database (RLS + triggers) enforces credits, ownership and status changes. The checks
   in this file only give clear messages.
   v2 (SIMAS 11-12, "like frame.io … everything tracked … live … very safe"): a live project board, a review room with
   frame-accurate comments on the timeline, team replies, version compare, activity, realtime updates. Review copies are
   private files played through signed links that expire within the hour. */
(() => {
"use strict";
const CFG = window.BEJU_PORTAL;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const view = $("#view");
const HERE = location.origin + location.pathname;
const RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
let ME = null;            // own profile row + auth email
let SEQ = 0, LAST = "";   // render counter (drops stale renders) and last route shown
let NOTICE = "", WANT = "";   // one-time message for the log-in screen; route to open after an email link
let DATA = null;
let RETRY = "";         // the page that already had its one automatic retry          // last loaded data (for quiet live refreshes)
let ROOM = null;          // the open review room (player state survives live refreshes)

/* ---------------- small helpers ---------------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ic = id => `<svg class="ic" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const ts = t => typeof t === "number" ? t : (t ? Date.parse(t) : 0) || 0;   // ISO string or epoch ms
const DTF = {
  full: new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  day: new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }),
  wkTime: new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  wk: new Intl.DateTimeFormat(undefined, { weekday: "short" }),
};
const fmt = (t, kind) => { const d = t ? new Date(t) : null; return d && !isNaN(d) ? DTF[kind].format(d) : ""; };
const fmtDate = t => fmt(t, "day");
const when = t => fmt(t, "full");
const near = t => t && Math.abs(ts(t) - Date.now()) < 6 * 864e5;
const whenShort = t => near(t) ? fmt(t, "wkTime") : when(t);
const dayShort = t => near(t) ? fmt(t, "wk") : fmtDate(t);
const isPast = t => t && ts(t) < Date.now();
const expected = (t, label = "Expected by", short = false) => !t ? "" : isPast(t)
  ? "Due now. Thanks for your patience." : `${label} ${short ? whenShort(t) : when(t)}`;
const ago = t => {
  const s = Math.max(0, (Date.now() - ts(t)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)} d ago`;
  return fmtDate(t);
};
// "in 3 h", "in 2 days", "late by 1 h"
const countdown = t => {
  const d = ts(t) - Date.now(); if (!t) return "";
  const a = Math.abs(d), h = a / 36e5, txt = h < 1 ? `${Math.max(1, Math.round(a / 6e4))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`;
  return d >= 0 ? `in ${txt}` : `late by ${txt}`;
};
const fmtTime = s => {
  s = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};
const fmtTimeF = s => { s = Math.max(0, Number(s) || 0); const f = Math.floor((s % 1) * 10); return `${fmtTime(s)}.${f}`; };
const greet = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
const firstName = () => String((ME && ME.name) || "").trim().split(/\s+/)[0];
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

// The only way a URL reaches an href or src: must parse as http(s), else "".
function crmHref() {
  try { const x = new URL(String(CFG.crmUrl || ""), location.href); return CFG.crmUrl && (x.protocol === "https:" || x.protocol === "http:") ? x.href : ""; }
  catch { return ""; }
}
function safeUrl(u) {
  try { const x = new URL(String(u ?? "").trim()); return x.protocol === "https:" || x.protocol === "http:" ? x.href : ""; }
  catch { return ""; }
}
function normUrl(v) {
  v = String(v ?? "").trim();
  if (!v) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = "https://" + v.replace(/^\/+/, "");
  const u = safeUrl(v);
  if (!u) return "";
  return /\.[a-z]{2,}$/i.test(new URL(u).hostname) ? u : "";
}
const extLink = (u, label, cls = "") => {
  const h = safeUrl(u);
  return h ? `<a class="${cls}" href="${esc(h)}" target="_blank" rel="noopener noreferrer">${esc(label || h)}</a>` : esc(label || u || "");
};
const callLink = (label, cls = "link") => extLink(CFG.callUrl, label, cls);

// External links we can show: Drive and YouTube become iframes on fixed origins; anything else opens in a new tab.
function media(u) {
  const h = safeUrl(u);
  if (!h) return null;
  const x = new URL(h), host = x.hostname.replace(/^(www|m)\./, "");
  let id;
  if (host === "drive.google.com" || host === "docs.google.com") {
    id = (x.pathname.match(/\/file\/d\/([\w-]+)/) || [])[1] || x.searchParams.get("id");
    if (id && /^[\w-]{10,}$/.test(id)) return { kind: "frame", src: `https://drive.google.com/file/d/${id}/preview`, href: h };
  }
  if (host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
    id = host === "youtu.be" ? x.pathname.split("/")[1] : x.searchParams.get("v") || (x.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/) || [])[1];
    if (id && /^[\w-]{11}$/.test(id)) return { kind: "frame", src: `https://www.youtube-nocookie.com/embed/${id}`, href: h };
  }
  return { kind: "link", href: h };
}

function toast(msg, bad = false, action) {
  const t = $("#toast");
  t.textContent = msg;
  if (action) { const b = document.createElement("button"); b.type = "button"; b.className = "toast-act"; b.textContent = action.label; b.onclick = () => { t.hidden = true; action.run(); }; t.appendChild(b); }
  t.classList.toggle("bad", bad); t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, bad ? 6000 : action ? 7000 : 3400);
}
function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.textContent; btn.disabled = true; btn.setAttribute("aria-busy", "true"); if (label) btn.textContent = label; }
  else { btn.disabled = false; btn.removeAttribute("aria-busy"); if (btn.dataset.label) btn.textContent = btn.dataset.label; }
}
function formErr(form, msg, field) {
  $$("[aria-invalid]", form).forEach(el => el.removeAttribute("aria-invalid"));
  const box = $(".err", form);
  if (box) box.textContent = msg || "";
  if (field) { field.setAttribute("aria-invalid", "true"); field.focus(); }
}
function friendly(err) {
  const m = `${(err && (err.message || err.error_description)) || err || ""} ${(err && err.code) || ""}`;
  const map = [
    [/invalid login credentials/i, "Wrong email or password."],
    [/email not confirmed/i, "Please confirm your email first. Open the link we sent you."],
    [/already registered|already been registered|user already exists/i, "That email already has an account. Log in instead."],
    [/should be different from the old/i, "Pick a new password that's different from your old one."],
    [/weak|easy to guess|pwned|leaked/i, "That password is too easy to guess. Please pick another one."],
    [/password/i, "Use a password with at least 8 characters."],
    [/rate limit|too many|only request this after|security purposes/i, "Too many tries. Please wait a minute and try again."],
    [/validate email|invalid.*email|email.*invalid/i, "That email doesn't look right."],
    [/session missing|jwt|PGRST301|refresh token/i, "Your session has ended. Please log in again."],
    [/failed to fetch|networkerror|load failed|network request/i, "We couldn't connect. Check your internet and try again."],
    [/no credits left|no valid pack/i, "You're out of credits. Pick a pack to keep going."],
    [/paste the link to your video/i, "Paste the link to your video."],
    [/too long/i, "One of your answers is too long. Please shorten it."],
    [/23505|duplicate key/i, "We already have this request."],
    [/not allowed|permission denied|row-level security|violates/i, "That didn't go through. Refresh the page and try again."],
  ];
  for (const [re, msg] of map) if (re.test(m)) return msg;
  return "Something went wrong. Please try again.";
}

// A small confirm sheet (no browser confirm(): it can't be styled and reads as a scam on phones).
function sheet({ title, body, ok = "Confirm", cancel = "Cancel", danger = false }) {
  return new Promise(resolve => {
    const d = $("#sheet"), prev = document.activeElement;
    $("#sheet-in").innerHTML = `<h2 id="sheet-t">${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ""}
      <div class="row end"><button class="btn glass" type="button" data-sh="0">${esc(cancel)}</button>
      <button class="btn ${danger ? "danger" : "primary"}" type="button" data-sh="1">${esc(ok)}</button></div>`;
    d.hidden = false; requestAnimationFrame(() => d.classList.add("open"));
    const done = v => { d.classList.remove("open"); setTimeout(() => { d.hidden = true; }, RM ? 0 : 220); document.removeEventListener("keydown", key); if (prev && prev.isConnected) prev.focus(); resolve(v); };
    const key = e => { if (e.key === "Escape") done(false); };
    document.addEventListener("keydown", key);
    $$("[data-sh]", d).forEach(b => b.onclick = () => done(b.dataset.sh === "1"));
    d.onclick = e => { if (e.target === d) done(false); };
    $("[data-sh='1']", d).focus();
  });
}

/* ---------------- auth link handling (runs before Supabase starts) ---------------- */
(function readAuthLink() {
  const h = location.hash, i = h.indexOf("#", 1);
  const frag = h.startsWith("#/") ? (i > 0 ? h.slice(i + 1) : "") : h.slice(1);
  const p = new URLSearchParams(frag), q = new URLSearchParams(location.search);
  const errCode = p.get("error_code") || q.get("error_code"), errDesc = p.get("error_description") || q.get("error_description");
  if (errCode || errDesc) {
    NOTICE = errCode === "otp_expired" ? "That link has expired or was already used. Log in, or ask for a new reset link."
      : "That link didn't work. Please try again.";
    history.replaceState(null, "", location.pathname + "#/login");
    return;
  }
  if (!p.get("access_token")) return;
  if (p.get("type") === "recovery" || h.startsWith("#/reset")) WANT = "#/reset";
  if (i > 0) history.replaceState(null, "", location.pathname + location.search + "#" + frag);
})();

if (!window.supabase || !CFG) {
  view.innerHTML = `<p class="lede">We couldn't load the portal. Check your connection and refresh the page.</p>`;
  return;
}
const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
sb.auth.onAuthStateChange(ev => {   // no Supabase calls inside this callback (supabase-js can deadlock)
  if (ev === "PASSWORD_RECOVERY") setTimeout(() => go("#/reset"), 0);
  else if (ev === "SIGNED_OUT") { ME = null; DATA = null; stopLive(); setTimeout(render, 0); }
});
const must = async p => { const { data, error } = await p; if (error) throw error; return data; };

/* ---------------- data ---------------- */
async function loadMe(user) {
  const p = await must(sb.from("profiles").select("id,name,email,is_admin,channel,sells,frequency,phone").eq("id", user.id).maybeSingle());
  if (!p) throw new Error("We couldn't find your account details.");
  return { ...p, email: user.email || p.email || "" };
}

// Credits: 1 credit = 1 Short. Only unexpired purchases count; the soonest-expiring pack with credits is used first.
function wallet(purchases, videos) {
  const now = Date.now();
  const live = purchases.filter(p => Date.parse(p.expires_at) > now)
    .map(p => ({ ...p, exp: Date.parse(p.expires_at), left: Math.max(0, p.videos - videos.filter(v => v.purchase_id === p.id).length) }))
    .sort((a, b) => a.exp - b.exp);
  const open = live.filter(p => p.left > 0);
  return {
    left: open.reduce((s, p) => s + p.left, 0), total: live.reduce((s, p) => s + p.videos, 0),
    next: open[0] || null, expires: open.length ? open[0].exp : null, count: purchases.length, open,
  };
}

// Everything the client can see, in one round trip. RLS keeps every list to their own rows.
async function loadAll() {
  const uid = ME.id;
  const [ps, vs, sample, vers, notes] = await Promise.all([
    must(sb.from("purchases").select("id,pack_id,videos,created_at,expires_at").eq("user_id", uid)),
    must(sb.from("videos").select("id,purchase_id,title,notes,footage,status,result_url,delivered_at,created_at,due_at,version")
      .eq("user_id", uid).order("created_at", { ascending: false })),
    must(sb.from("sample_requests").select("id,video_url,moment,style,goal,status,preview_url,note,created_at,delivered_at,due_at")
      .eq("user_id", uid).limit(1)).then(r => r[0] || null),
    must(sb.from("video_versions").select("id,video_id,version,url,note,created_at,storage_path").order("version", { ascending: false })),
    must(sb.from("video_notes").select("id,video_id,at,text,created_at,round,done_at,parent_id,author_role,author_name").order("created_at")),
  ]);
  const byV = id => vers.filter(x => x.video_id === id);
  const seen = store.get(SEEN_KEY()) || {};
  for (const v of vs) {
    v.versions = byV(v.id);
    if (!v.versions.length && v.result_url) v.versions = [{ id: "legacy-" + v.id, video_id: v.id, version: Math.max(1, v.version || 1), url: v.result_url, note: null, created_at: v.delivered_at, storage_path: /^https?:/i.test(v.result_url) ? null : v.result_url }];
    v.notes = notes.filter(n => n.video_id === v.id);
    v.comments = v.notes.filter(n => !n.parent_id);
    v.teamReplies = v.notes.filter(n => n.author_role === "team");
    v.latest = v.versions[0] || null;
    // last thing the client hasn't seen: a new version or a team reply
    v.lastNews = Math.max(ts(v.latest && v.latest.created_at), ...v.teamReplies.map(n => ts(n.created_at)), 0);
    v.unread = v.lastNews > (seen[v.id] || 0) && v.lastNews > ts(v.created_at);
  }
  return { videos: vs, sample, w: wallet(ps, vs), purchases: ps };
}
const SEEN_KEY = () => `beju_portal_seen_${ME ? ME.id : ""}`;
const markSeen = v => { const s = store.get(SEEN_KEY()) || {}; s[v.id] = Math.max(Date.now(), v.lastNews || 0); store.set(SEEN_KEY(), s); };

// Review copies are private files: a signed link that stops working within the hour (cached 50 minutes).
const SIGNED = new Map();
async function signed(paths) {
  const now = Date.now(), need = [...new Set(paths.filter(p => p && !/^https?:/i.test(p)))].filter(p => !(SIGNED.has(p) && SIGNED.get(p).until > now));
  if (need.length) {
    const { data, error } = await sb.storage.from("finished").createSignedUrls(need, 3600);
    if (!error && data) data.forEach(x => { if (x.signedUrl && !x.error) SIGNED.set(x.path, { url: x.signedUrl, until: now + 50 * 6e4 }); });
  }
  return p => (SIGNED.get(p) || {}).url || "";
}
const verPath = x => x && (x.storage_path || (!/^https?:/i.test(x.url || "") ? x.url : null));

/* ---------------- payment return ---------------- */
const PENDING = "beju_portal_buy";
function pendingState(w) {
  const p = store.get(PENDING);
  if (!p || p.uid !== ME.id) return null;
  if (Date.now() - p.at > 864e5) { store.del(PENDING); return null; }
  if (w.count > p.count) { store.del(PENDING); return "arrived"; }
  return "waiting";
}
const pendingHTML = st => st !== "waiting" ? "" : `
  <div class="banner" role="status">
    <p><b>Payment done?</b> Your credits appear here within a minute.</p>
    <button class="btn glass sm" type="button" data-refresh>Refresh</button>
  </div>`;

/* ---------------- shared pieces ---------------- */
const STATUS = { received: "Requested", editing: "In edit", ready: "Ready for review", revision: "Changes requested", approved: "Approved" };
const STAGES = ["received", "editing", "ready", "revision", "approved"];
const SAMPLE_STATUS = { requested: "Requested", accepted: "Accepted", building: "Being made", ready: "Ready", declined: "Not this time" };
const chip = (s, labels = STATUS) => `<span class="st s-${esc(s)}">${esc(labels[s] || s)}</span>`;
const head = (title, sub = "") => `<div class="head"><h1>${title}</h1>${sub ? `<p class="lede">${sub}</p>` : ""}</div>`;
const SELLS = ["Coaching or consulting", "A course or program", "Physical products", "Software or an app", "Services", "Something else"];
const FREQ = ["Every day", "A few times a week", "Once a week", "Less often"];
const chips = (name, opts, val) => opts.map((o, i) =>
  `<label class="chip"><input type="radio" name="${name}" value="${esc(o)}"${o === val ? " checked" : ""}${i === 0 ? " required" : ""}><span>${esc(o)}</span></label>`).join("");
function profileFields(p, withName) {
  return `
    ${withName ? `<div class="field"><label for="pf-name">Your name</label>
      <input class="input" id="pf-name" name="name" autocomplete="name" maxlength="80" value="${esc(p.name)}" required></div>` : ""}
    <div class="field"><label for="pf-channel">Main channel or page link</label>
      <input class="input" id="pf-channel" name="channel" inputmode="url" autocapitalize="none" autocorrect="off" spellcheck="false"
        maxlength="300" placeholder="youtube.com/@yourchannel" value="${esc(p.channel)}" required></div>
    <fieldset class="field"><legend>What do you sell?</legend><div class="chips">${chips("sells", SELLS, p.sells)}</div></fieldset>
    <fieldset class="field"><legend>How often do you post?</legend><div class="chips">${chips("frequency", FREQ, p.frequency)}</div></fieldset>
    <div class="field"><label for="pf-phone">Phone number</label>
      <input class="input" id="pf-phone" name="phone" type="tel" autocomplete="tel" maxlength="30" placeholder="+1 555 123 4567" value="${esc(p.phone)}" required>
      <p class="hint">So we can reach you about your Shorts.</p></div>`;
}
function readProfile(form, withName) {
  const f = new FormData(form), out = {};
  if (withName) {
    out.name = String(f.get("name") || "").trim();
    if (!out.name) return formErr(form, "Please add your name.", $("#pf-name", form));
  }
  out.channel = normUrl(f.get("channel"));
  if (!out.channel) return formErr(form, "Paste the link to your main channel or page, like youtube.com/@yourchannel.", $("#pf-channel", form));
  out.sells = f.get("sells");
  if (!SELLS.includes(out.sells)) return formErr(form, "Pick what you sell.", $("[name=sells]", form));
  out.frequency = f.get("frequency");
  if (!FREQ.includes(out.frequency)) return formErr(form, "Pick how often you post.", $("[name=frequency]", form));
  out.phone = String(f.get("phone") || "").trim();
  const digits = out.phone.replace(/\D/g, "").length;
  if (!/^\+?[\d\s().-]+$/.test(out.phone) || digits < 7 || digits > 15) return formErr(form, "Please add a phone number we can reach, like +1 555 123 4567.", $("#pf-phone", form));
  formErr(form, "");
  return out;
}

/* ---------------- chrome ---------------- */
function chromeOff() { $("#top").hidden = true; $("#tabbar").hidden = true; document.body.classList.remove("in"); }
function chromeOn(route) {
  $("#top").hidden = false; $("#tabbar").hidden = false; document.body.classList.add("in");
  const nav = route === "v" || route === "sample" ? "home" : route;
  $$("[data-nav]").forEach(a => { if (a.dataset.nav === nav) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
}
function setLiveDot(state) {
  const d = $("#live"); if (!d) return;
  d.dataset.state = state;
  d.title = state === "live" ? "Live: updates appear on their own" : "Checking for updates every minute";
  $("#live-t").textContent = state === "live" ? "Live" : "Updating";
}

/* ---------------- signed-out screens ---------------- */
const AUTH_COPY = {
  signup: ["Your Shorts, <em>in one place.</em>", "Create your account to ask for a free sample, follow every Short and leave notes right on the video."],
  login: ["Welcome <em>back.</em>", "Log in to see your Shorts, comments and credits."],
  forgot: ["Reset your <em>password.</em>", "Enter your email. We'll send you a link to set a new one."],
};
function authShell(inner) {
  return `<section class="auth"><div class="auth-in">
    <a class="brand" href="/"><img src="/beju-mark-sm.png" alt="" width="40" height="24"><span>Beju Creative</span></a>
    ${inner}
  </div></section>`;
}
function authView(mode) {
  chromeOff();
  const [title, sub] = AUTH_COPY[mode];
  const notice = NOTICE; NOTICE = "";
  const google = CFG.google === true && mode !== "forgot";
  view.innerHTML = authShell(`
    <div class="card auth-card">
      <nav class="authtabs" aria-label="Account">
        <a href="#/signup"${mode === "signup" ? ` aria-current="page"` : ""}>Sign up</a>
        <a href="#/login"${mode === "login" ? ` aria-current="page"` : ""}>Log in</a>
      </nav>
      <div class="head tight"><h1>${title}</h1><p class="lede">${sub}</p></div>
      ${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ""}
      ${google ? `<button class="btn glass block" type="button" id="google">Continue with Google</button><p class="or"><span>or</span></p>` : ""}
      <form id="af" class="form" novalidate>
        ${mode === "signup" ? `<div class="field"><label for="a-name">Your name</label><input class="input" id="a-name" autocomplete="name" maxlength="80" required></div>` : ""}
        <div class="field"><label for="a-email">Email</label><input class="input" id="a-email" type="email" autocomplete="email" autocapitalize="none" spellcheck="false" maxlength="200" required></div>
        ${mode !== "forgot" ? `<div class="field"><label for="a-pass">Password</label>
          <input class="input" id="a-pass" type="password" minlength="8" maxlength="72" required autocomplete="${mode === "signup" ? "new-password" : "current-password"}">
          ${mode === "signup" ? `<p class="hint">At least 8 characters.</p>` : `<p class="hint"><a class="link" href="#/forgot">Forgot password?</a></p>`}</div>` : ""}
        <button class="btn primary block" type="submit">${mode === "signup" ? "Sign up" : mode === "login" ? "Log in" : "Send reset link"}</button>
        <p class="err" role="alert"></p>
      </form>
      <p class="switch">${mode === "signup" ? `Already have an account? <a class="link" href="#/login">Log in</a>`
        : mode === "login" ? `New here? <a class="link" href="#/signup">Create an account</a>`
        : `Remembered it? <a class="link" href="#/login">Back to log in</a>`}</p>
    </div>
    <p class="secure">${ic("lock")}Private to you. Your videos play through links that expire within the hour.</p>`);
  const form = $("#af");
  if (google) $("#google").onclick = async e => {
    const b = e.currentTarget;
    busy(b, true, "Opening Google…");
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: HERE } });
    if (error) { busy(b, false); formErr(form, friendly(error)); }
  };
  form.onsubmit = async e => {
    e.preventDefault();
    const btn = $("button[type=submit]", form);
    const name = $("#a-name") ? $("#a-name").value.trim() : "";
    const email = $("#a-email").value.trim().toLowerCase();
    const pass = $("#a-pass") ? $("#a-pass").value : "";
    if (mode === "signup" && !name) return formErr(form, "Please add your name.", $("#a-name"));
    if (!EMAIL.test(email)) return formErr(form, "That email doesn't look right.", $("#a-email"));
    if (mode !== "forgot" && pass.length < 8) return formErr(form, mode === "signup" ? "Use a password with at least 8 characters." : "Please enter your password.", $("#a-pass"));
    formErr(form, "");
    busy(btn, true, mode === "signup" ? "Creating your account…" : mode === "login" ? "Logging in…" : "Sending…");
    try {
      if (mode === "signup") {
        const data = await must(sb.auth.signUp({ email, password: pass, options: { data: { name }, emailRedirectTo: HERE } }));
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          busy(btn, false); return formErr(form, "That email already has an account. Log in instead.", $("#a-email"));
        }
        if (!data.session) return checkInbox(email);
        go("#/");
      } else if (mode === "login") {
        await must(sb.auth.signInWithPassword({ email, password: pass }));
        go("#/");
      } else {
        await must(sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + "#/reset" }));
        $(".auth-card").innerHTML = `<div class="head tight"><h1>Check your <em>inbox.</em></h1>
          <p class="lede">If an account uses <b>${esc(email)}</b>, a reset link is on its way. It can take a minute. Check spam too.</p></div>
          <p class="switch"><a class="link" href="#/login">Back to log in</a></p>`;
      }
    } catch (err) { busy(btn, false); formErr(form, friendly(err)); }
  };
}
function checkInbox(email) {
  view.innerHTML = authShell(`
    <div class="card auth-card">
      <div class="head tight"><h1>Check your <em>inbox.</em></h1>
        <p class="lede">We sent a link to <b>${esc(email)}</b>. Open it to confirm your email, and you're in.</p></div>
      <p class="hint">Nothing there? Check spam, or send it again.</p>
      <button class="btn glass block" type="button" id="resend">Send it again</button>
      <p class="switch"><a class="link" href="#/login">Back to log in</a></p>
    </div>`);
  $("#resend").onclick = async e => {
    const b = e.currentTarget; busy(b, true, "Sending…");
    const { error } = await sb.auth.resend({ type: "signup", email, options: { emailRedirectTo: HERE } });
    busy(b, false);
    if (error) toast(friendly(error), true); else toast("Sent. Check your inbox.");
  };
}
function resetView(hasSession) {
  chromeOff();
  if (!hasSession) {
    view.innerHTML = authShell(`<div class="card auth-card"><div class="head tight"><h1>This link has <em>expired.</em></h1>
      <p class="lede">Reset links work once and only for a short time. Ask for a new one.</p></div>
      <a class="btn primary block" href="#/forgot">Send me a new link</a></div>`);
    return;
  }
  view.innerHTML = authShell(`
    <div class="card auth-card">
      <div class="head tight"><h1>Set a new <em>password.</em></h1><p class="lede">Use at least 8 characters.</p></div>
      <form id="rf" class="form" novalidate>
        <div class="field"><label for="r-pass">New password</label><input class="input" id="r-pass" type="password" autocomplete="new-password" minlength="8" maxlength="72" required></div>
        <div class="field"><label for="r-pass2">Type it again</label><input class="input" id="r-pass2" type="password" autocomplete="new-password" minlength="8" maxlength="72" required></div>
        <button class="btn primary block" type="submit">Save new password</button>
        <p class="err" role="alert"></p>
      </form>
    </div>`);
  const form = $("#rf");
  form.onsubmit = async e => {
    e.preventDefault();
    const a = $("#r-pass").value, b = $("#r-pass2").value, btn = $("button[type=submit]", form);
    if (a.length < 8) return formErr(form, "Use a password with at least 8 characters.", $("#r-pass"));
    if (a !== b) return formErr(form, "The two passwords don't match.", $("#r-pass2"));
    busy(btn, true, "Saving…");
    try { await must(sb.auth.updateUser({ password: a })); toast("Your password is updated."); go("#/"); }
    catch (err) { busy(btn, false); formErr(form, friendly(err)); }
  };
}

/* ---------------- onboarding (until the profile has a channel) ---------------- */
function onboarding() {
  const withName = !String(ME.name || "").trim();
  view.innerHTML = head(`Welcome${firstName() ? `, <em>${esc(firstName())}.</em>` : "."}`, "A few quick questions, so your Shorts fit your channel.") + `
    <form id="ob" class="card form narrow" novalidate>
      ${profileFields(ME, withName)}
      <button class="btn primary block" type="submit">Save and continue</button>
      <p class="err" role="alert"></p>
    </form>
    <p class="foot">Not you? <button class="linkish" type="button" data-out>Sign out</button></p>`;
  const form = $("#ob");
  form.onsubmit = async e => {
    e.preventDefault();
    const vals = readProfile(form, withName);
    if (!vals) return;
    const btn = $("button[type=submit]", form);
    busy(btn, true, "Saving…");
    try {
      await must(sb.from("profiles").update(vals).eq("id", ME.id));
      Object.assign(ME, vals);
      toast("Thanks. You're all set.");
      go("#/");
    } catch (err) { busy(btn, false); formErr(form, friendly(err)); }
  };
}

/* ---------------- home: the live project board ---------------- */
function sampleDate(s) {
  if (s.status === "ready") return s.delivered_at ? `Delivered ${when(s.delivered_at)}` : "";
  if ((s.status === "accepted" || s.status === "building") && s.due_at) return expected(s.due_at);
  return s.status === "declined" ? "" : `Requested ${when(s.created_at)}`;
}
function sampleCard(s, w) {
  if (!s && w.count) return "";
  const btn = (href, label, primary) => `<a class="btn ${primary ? "primary" : "glass"} block" href="${href}">${label}</a>`;
  let body;
  if (!s) body = `<p>One free Short made from your video. It comes as a preview with a small mark.</p>${btn("#/sample", "Ask for your free sample", true)}`;
  else if (s.status === "requested") body = `<p>We review every request by hand. We'll email you and update this page.</p>${btn("#/sample", "See your request")}`;
  else if (s.status === "accepted" || s.status === "building") body = `<p>Your sample is being made. We deliver everything within 24 hours, usually faster.</p>${btn("#/sample", "See your request")}`;
  else if (s.status === "ready") body = `<p>Your sample is ready to watch.</p>${btn("#/sample", "Watch your sample", true)}`;
  else body = `<p>We left you a note about your sample.</p>${btn("#/sample", "Read the note")}`;
  const date = s ? sampleDate(s) : "";
  return `<section class="card sample-card" aria-labelledby="h-sample"><div class="card-h"><h2 id="h-sample">Free sample</h2>${s ? chip(s.status, SAMPLE_STATUS) : ""}</div>${date ? `<p class="when">${esc(date)}</p>` : ""}${body}</section>`;
}
const packName = id => (CFG.packs.find(p => p.id === id) || {}).name || "your pack";
function stats(D) {
  const v = D.videos, n = s => v.filter(x => x.status === s).length, w = D.w;
  const exp = w.expires ? `${countdown(w.expires).replace("in ", "")} left` : w.total ? "used up" : "none yet";
  const box = (label, val, sub, href, cls = "") => `<a class="stat ${cls}" href="${href}"><span>${label}</span><b>${val}</b><small>${sub}</small></a>`;
  return `<div class="stats">
    ${box("Credits", `${w.left}<i>/${w.total}</i>`, w.left ? esc(exp) : w.total ? "all used" : "pick a pack", w.left ? "#/new" : "#/packs")}
    ${box("In progress", n("received") + n("editing") + n("revision"), "with our team", "#/?f=progress")}
    ${box("Ready for review", n("ready"), n("ready") ? "waiting for you" : "nothing waiting", "#/?f=ready", n("ready") ? "hot" : "")}
    ${box("Approved", n("approved"), "done", "#/?f=approved")}
  </div>`;
}
function thumb(v, url) {
  const p = verPath(v.latest);
  if (p && url(p)) return `<video class="thumb" muted playsinline preload="metadata" src="${esc(url(p))}#t=0.5" aria-hidden="true" tabindex="-1"></video>`;
  const icon = v.status === "approved" ? "check" : v.status === "ready" ? "play" : v.status === "revision" ? "pen" : "clock";
  return `<div class="thumb ph s-${esc(v.status)}">${ic(icon)}</div>`;
}
function pipeline(v) {
  const i = STAGES.indexOf(v.status);
  return `<ol class="pipe" aria-label="Progress: ${esc(STATUS[v.status] || v.status)}">${STAGES.map((s, k) =>
    `<li class="${k < i ? "past" : k === i ? "now" : ""}" title="${esc(STATUS[s])}"><span class="sr">${esc(STATUS[s])}</span></li>`).join("")}</ol>`;
}
function cardLine(v) {
  if (v.status === "received" || v.status === "editing") return v.due_at ? `Expected ${countdown(v.due_at)}` : `Requested ${dayShort(v.created_at)}`;
  if (v.status === "revision") return v.due_at ? `Changes ${countdown(v.due_at)}` : "Changes in progress";
  if (v.status === "ready") return v.latest ? `v${v.latest.version} delivered ${ago(v.latest.created_at)}` : "Ready";
  if (v.status === "approved") return v.latest ? `Approved · v${v.latest.version}` : "Approved";
  return "";
}
function vcard(v, url) {
  const open = v.comments.filter(c => c.author_role === "client" && !c.done_at).length;
  return `<a class="vcard${v.unread ? " unread" : ""}${v.status === "ready" ? " review" : ""}" href="#/v/${esc(v.id)}" data-vid="${esc(v.id)}">
    <div class="vthumb">${thumb(v, url)}${v.latest ? `<span class="ver">v${esc(v.latest.version)}</span>` : ""}${v.unread ? `<span class="new">New</span>` : ""}
      ${v.comments.length ? `<span class="cc" title="${plural(v.comments.length, "comment")}">${ic("chat")}${v.comments.length}</span>` : ""}</div>
    <div class="vbody"><b>${esc(v.title)}</b>${pipeline(v)}
      <small class="${v.due_at && isPast(v.due_at) && v.status !== "approved" ? "late" : ""}">${esc(cardLine(v))}${open ? ` · ${plural(open, "open note")}` : ""}</small></div>
  </a>`;
}
const FILTERS = [["all", "All"], ["ready", "Ready for review"], ["progress", "In progress"], ["approved", "Approved"]];
const inFilter = (v, f) => f === "all" || (f === "ready" && v.status === "ready") || (f === "approved" && v.status === "approved")
  || (f === "progress" && /^(received|editing|revision)$/.test(v.status));
function board(D, url, f) {
  const vs = D.videos.filter(v => inFilter(v, f)).sort((a, b) =>
    (b.status === "ready") - (a.status === "ready") || (b.unread - a.unread) || ts(b.lastNews || b.created_at) - ts(a.lastNews || a.created_at));
  const count = k => D.videos.filter(v => inFilter(v, k)).length;
  const pills = `<div class="pills" role="tablist" aria-label="Show">${FILTERS.map(([k, l]) =>
    `<a role="tab" class="pill${k === f ? " on" : ""}" aria-selected="${k === f}" href="#/?f=${k}">${l}<i>${count(k)}</i></a>`).join("")}</div>`;
  const grid = vs.length ? `<div class="vgrid2">${vs.map(v => vcard(v, url)).join("")}</div>`
    : D.videos.length ? `<div class="empty"><p>Nothing here right now.</p><a class="btn glass sm" href="#/">Show all</a></div>`
    : `<div class="empty teach"><ol class="steps"><li><b>Send footage</b><span>Paste links to your long videos.</span></li><li><b>We edit</b><span>Most Shorts are ready within 24 hours.</span></li><li><b>Review here</b><span>Watch, leave notes on the exact frame, approve.</span></li></ol>
        ${D.w.left ? `<a class="btn primary" href="#/new">Send your first video</a>` : `<a class="btn primary" href="#/packs">See packs</a>`}</div>`;
  return `<section class="card wide board" aria-labelledby="h-board"><div class="card-h"><h2 id="h-board">Your Shorts</h2>${D.w.left ? `<a class="btn glass sm" href="#/new">${ic("plus")}New Short</a>` : ""}</div>${D.videos.length ? pills : ""}${grid}</section>`;
}
// One merged history across everything: requests, deliveries, replies, credits, the sample.
function events(D) {
  const ev = [];
  for (const v of D.videos) {
    ev.push({ t: v.created_at, icon: "send", text: `You sent “${v.title}”`, href: `#/v/${v.id}` });
    for (const x of v.versions) ev.push({ t: x.created_at, icon: "play", text: `v${x.version} of “${v.title}” is ready for review`, href: `#/v/${v.id}?ver=${x.version}`, hot: true });
    for (const n of v.notes) ev.push(n.author_role === "team"
      ? { t: n.created_at, icon: "chat", text: `${n.author_name || "Our team"} replied on “${v.title}”`, href: `#/v/${v.id}?c=${n.parent_id || n.id}`, hot: true }
      : { t: n.created_at, icon: "pen", text: `You left a note at ${fmtTime(n.at)} on “${v.title}”`, href: `#/v/${v.id}?c=${n.parent_id || n.id}` });
  }
  for (const p of D.purchases) ev.push({ t: p.created_at, icon: "bag", text: `${plural(p.videos, "credit")} added (${packName(p.pack_id)})`, href: "#/packs" });
  const s = D.sample;
  if (s) { ev.push({ t: s.created_at, icon: "send", text: "You asked for a free sample", href: "#/sample" }); if (s.delivered_at) ev.push({ t: s.delivered_at, icon: "play", text: "Your free sample is ready", href: "#/sample", hot: true }); }
  return ev.filter(e => e.t).sort((a, b) => ts(b.t) - ts(a.t));
}
const evRow = e => `<li><a href="${esc(e.href)}"><span class="evi${e.hot ? " hot" : ""}">${ic(e.icon)}</span><span class="evt">${esc(e.text)}<time>${esc(ago(e.t))}</time></span></a></li>`;
function activityCard(D) {
  const ev = events(D).slice(0, 6);
  return `<section class="card" aria-labelledby="h-act"><div class="card-h"><h2 id="h-act">Latest</h2><a class="link" href="#/activity">All activity</a></div>
    ${ev.length ? `<ul class="evlist">${ev.map(evRow).join("")}</ul>` : `<p class="hint">Your history shows up here as soon as you start.</p>`}</section>`;
}
function creditsCard(w) {
  if (!w.total) return "";
  return `<section class="card" aria-labelledby="h-credits"><div class="card-h"><h2 id="h-credits">Credits</h2></div>
    <p class="big">${w.left}<span> / ${w.total}</span></p>
    <div class="meter" role="img" aria-label="${w.total - w.left} of ${w.total} credits used"><i data-w="${w.total ? Math.round((w.total - w.left) / w.total * 100) : 0}"></i></div>
    <p>${w.left ? `${plural(w.left, "Short")} left.${w.expires ? ` Next credits expire ${esc(fmtDate(w.expires))} (${esc(countdown(w.expires))}).` : ""}` : "All credits used. Get more any time."}</p>
    ${w.open.length > 1 ? `<ul class="expiries">${w.open.map(p => `<li>Credits from ${esc(packName(p.pack_id))} expire ${esc(fmtDate(p.exp))} <span>(${p.left} left)</span></li>`).join("")}</ul>` : ""}
    ${w.left ? `<a class="btn primary block" href="#/new">Start a new Short</a>` : `<a class="btn glass block" href="#/packs">Get more Shorts</a>`}</section>`;
}
async function home(D, quiet) {
  const f = (new URLSearchParams(location.hash.split("?")[1] || "").get("f")) || "all";
  const url = await signed(D.videos.map(v => verPath(v.latest)));
  const ready = D.videos.filter(v => v.status === "ready");
  const n = firstName();
  view.classList.toggle("quiet", !!quiet);
  view.innerHTML = `<div class="hero">${head(`${greet()}${n ? `, <em>${esc(n)}.</em>` : "."}`, ready.length
      ? `${plural(ready.length, "Short")} ${ready.length === 1 ? "is" : "are"} ready for your review.` : "Your Shorts, notes and credits, live in one place.")}
    ${ready.length ? `<a class="btn primary" href="#/v/${esc(ready[0].id)}">${ic("play")}Review ${ready.length > 1 ? "the first one" : "it now"}</a>` : ""}</div>
    ${pendingHTML(D.pending)}
    ${stats(D)}
    <div class="grid home">
      ${sampleCard(D.sample, D.w)}
      ${board(D, url, FILTERS.some(x => x[0] === f) ? f : "all")}
      ${activityCard(D)}
      ${creditsCard(D.w)}
    </div>
    <p class="foot">${callLink("Need a custom plan? Book a call")}</p>`;
  paintMeters();
}
function paintMeters() { $$(".meter i[data-w]").forEach(i => i.style.setProperty("--w", `${Math.max(0, Math.min(100, +i.dataset.w))}%`)); }

function activityPage(D) {
  const ev = events(D);
  view.innerHTML = `<a class="back" href="#/">${ic("back")}Home</a>` + head("Activity", "Everything that happened on your account, newest first.") + `
    <section class="card narrow">${ev.length ? `<ul class="evlist">${ev.map(evRow).join("")}</ul>` : `<p class="hint">Nothing yet.</p>`}</section>`;
}

/* ---------------- free sample ---------------- */
const CAPTIONS = ["Bold, word by word", "Clean subtitles", "Minimal", "No captions"];
function playerHTML(m, title) {
  if (!m) return "";
  if (m.kind === "frame") return `<div class="screen"><iframe src="${esc(m.src)}" title="${esc(title)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  if (m.kind === "video") return `<div class="screen"><video src="${esc(m.src)}" controls playsinline preload="metadata" aria-label="${esc(title)}"></video></div>`;
  return "";
}
async function samplePage(D) {
  const s = D.sample;
  if (!s) return sampleForm();
  let state;
  if (s.status === "requested") state = `<p>We review every request by hand. We'll email you and update this page.</p>`;
  else if (s.status === "accepted" || s.status === "building") state = `<p>Your sample is being made. We deliver everything within 24 hours, usually faster.</p>`;
  else if (s.status === "ready") {
    let m = media(s.preview_url);
    if (!m && s.preview_url && !/^https?:/i.test(s.preview_url)) { const u = await signed([s.preview_url]); if (u(s.preview_url)) m = { kind: "video", src: u(s.preview_url) }; }
    state = `${playerHTML(m, "Your free sample")}
      <p>This preview carries a small mark. The mark comes off with any pack.</p>
      <div class="row">${m && m.kind === "link" ? extLink(m.href, "Watch your sample", "btn glass") : ""}<a class="btn primary" href="#/packs">See packs</a></div>`;
  } else {
    state = `<p>Thank you for your request. We couldn't make a sample from it this time.</p>
      ${s.note ? `<blockquote class="note">${esc(s.note)}</blockquote>` : ""}
      <p>You can still pick a pack, or book a call and we'll find what fits you.</p>
      <div class="row"><a class="btn primary" href="#/packs">See packs</a>${callLink("Book a call", "btn glass")}</div>`;
  }
  view.innerHTML = `<a class="back" href="#/">${ic("back")}Home</a>` + head("Your free sample") + `
    <div class="stack narrow">
      <section class="card" aria-label="Status"><div class="card-h"><h2>Status</h2>${chip(s.status, SAMPLE_STATUS)}</div>
        <ul class="dates"><li>Requested ${esc(when(s.created_at))}</li>
          ${(s.status === "accepted" || s.status === "building") && s.due_at ? `<li class="due">${esc(expected(s.due_at))}</li>` : ""}
          ${s.status === "ready" && s.delivered_at ? `<li>Delivered ${esc(when(s.delivered_at))}</li>` : ""}</ul>
        ${state}</section>
      <section class="card" aria-labelledby="h-sent"><h2 id="h-sent">What you sent</h2>
        <dl class="facts">
          <dt>Video</dt><dd>${extLink(s.video_url)}</dd>
          ${s.moment ? `<dt>The part you like</dt><dd>${esc(s.moment)}</dd>` : ""}
          ${s.style ? `<dt>Style</dt><dd>${esc(s.style)}</dd>` : ""}
          ${s.goal ? `<dt>After watching</dt><dd>${esc(s.goal)}</dd>` : ""}
        </dl></section>
    </div>`;
}
function sampleForm() {
  view.innerHTML = `<a class="back" href="#/">${ic("back")}Home</a>` +
    head("Your free <em>sample.</em>", "One free Short, made from one of your videos. One per person. You get a preview with a small mark. The clean version comes with any pack.") + `
    <form id="sf" class="card form narrow" novalidate>
      <div class="field"><label for="s-url">Link to the video we should use</label>
        <input class="input" id="s-url" type="url" inputmode="url" autocapitalize="none" spellcheck="false" maxlength="500" placeholder="Paste a YouTube, Drive or Dropbox link" required>
        <p class="hint">Make sure we can open it without asking for access.</p></div>
      <div class="field"><label for="s-moment">The part you like <span class="opt">(optional)</span></label>
        <input class="input" id="s-moment" maxlength="200" placeholder="For example 4:20"></div>
      <fieldset class="field"><legend>Captions style</legend><div class="chips">${CAPTIONS.map(c =>
        `<label class="chip"><input type="radio" name="captions" value="${esc(c)}"><span>${esc(c)}</span></label>`).join("")}</div></fieldset>
      <div class="field"><label for="s-level">How much should happen on screen?</label>
        <input id="s-level" type="range" min="1" max="5" step="1" value="3" aria-describedby="s-level-out">
        <p class="range-ends" aria-hidden="true"><span>Calm</span><span>Packed</span></p>
        <p class="hint" id="s-level-out">3 of 5</p></div>
      <div class="field"><label for="s-goal">What should viewers do after watching? <span class="opt">(optional)</span></label>
        <input class="input" id="s-goal" maxlength="500" placeholder="For example: book a call, join my course"></div>
      <button class="btn primary block" type="submit">Ask for my free sample</button>
      <p class="err" role="alert"></p>
    </form>`;
  const lvl = $("#s-level"), out = $("#s-level-out");
  const paintLevel = () => { out.textContent = `${lvl.value} of 5`; lvl.style.setProperty("--v", `${(lvl.value - 1) * 25}%`); };
  lvl.oninput = paintLevel; paintLevel();
  const form = $("#sf");
  form.onsubmit = async e => {
    e.preventDefault();
    const url = normUrl($("#s-url").value);
    if (!url || url.length > 500) return formErr(form, "Paste the full link to your video, starting with https://", $("#s-url"));
    const cap = (form.querySelector("[name=captions]:checked") || {}).value;
    const style = [cap ? `Captions: ${cap}` : "", `On screen: ${lvl.value} of 5`].filter(Boolean).join(" · ");
    const btn = $("button[type=submit]", form);
    formErr(form, ""); busy(btn, true, "Sending…");
    const { error } = await sb.from("sample_requests").insert({
      user_id: ME.id, video_url: url, moment: $("#s-moment").value.trim() || null, style, goal: $("#s-goal").value.trim() || null,
    });
    if (error && error.code === "23505") { toast("You've already asked for your free sample. Here it is."); return render(); }
    if (error) { busy(btn, false); return formErr(form, friendly(error)); }
    toast("Request sent. We'll be in touch.");
    render();
  };
}

/* ---------------- packs ---------------- */
function buyHref(p) {
  const u = safeUrl(p.link);
  if (!u || !u.startsWith("https://buy.stripe.com/")) return "";
  const x = new URL(u);
  x.searchParams.set("prefilled_email", ME.email || "");
  x.searchParams.set("client_reference_id", ME.id);
  return x.href;
}
function packCard(p) {
  const href = CFG.showPrices ? buyHref(p) : "";
  return `<article class="card pack${p.best ? " best" : ""}">
    ${p.best ? `<span class="tag">Best value</span>` : ""}
    <h2>${esc(p.name)}</h2>
    <p class="qty">${plural(p.videos, "Short")}${p.monthly ? " a month" : ""}</p>
    ${CFG.showPrices ? `<p class="price">$${esc(p.price)}<small>${p.monthly ? " / month" : " one-time"}</small></p>`
      : `<p class="price-call">Book a call to get pricing</p>`}
    ${p.note ? `<p class="hint">${esc(p.note)}</p>` : ""}
    ${href ? `<a class="btn ${p.best ? "primary" : "glass"} block" href="${esc(href)}" target="_blank" rel="noopener noreferrer" data-buy="${esc(p.id)}">${p.monthly ? `Start ${esc(p.name)}` : `Get ${plural(p.videos, "Short")}`}</a>`
      : callLink("Book a call", `btn ${p.best ? "primary" : "glass"} block`)}
  </article>`;
}
function packsPage(D) {
  const w = D.w;
  view.innerHTML = head("Packs", w.left ? `You have ${plural(w.left, "Short")} left. Top up any time.` : "Pick what fits. Your credits show up here after you pay.") + `
    <div id="pending">${pendingHTML(D.pending)}</div>
    <ul class="perks">${CFG.perks.map(x => `<li>${ic("check")}${esc(x)}</li>`).join("")}</ul>
    <div class="grid packs">${CFG.packs.map(packCard).join("")}</div>
    <p class="foot">We edit full-length videos too. ${callLink("Book a call")} for long-form or custom plans.</p>`;
  $$("[data-buy]").forEach(a => a.addEventListener("click", () => {
    store.set(PENDING, { uid: ME.id, pack: a.dataset.buy, count: w.count, at: Date.now() });
    $("#pending").innerHTML = pendingHTML("waiting");
  }));
}

/* ---------------- new Short ---------------- */
function newPage(D) {
  const w = D.w;
  if (!w.left || !w.next) {
    view.innerHTML = head("New Short") + `<section class="card narrow empty">
      <h2>You're out of credits</h2><p>Pick a pack and you can send your next video right away.</p>
      <a class="btn primary" href="#/packs">See packs</a></section>`;
    return;
  }
  view.innerHTML = head("New <em>Short.</em>", `Uses 1 credit. You have ${w.left} left.`) + `
    <form id="nf" class="card form narrow" novalidate>
      <div class="field"><label for="n-title">Title</label>
        <input class="input" id="n-title" maxlength="120" placeholder="For example: Episode 42, the part about sleep" required></div>
      <div class="field"><label for="n-links">Footage links</label>
        <textarea class="input" id="n-links" maxlength="2000" autocapitalize="none" spellcheck="false" placeholder="https://drive.google.com/…" required aria-describedby="n-links-h"></textarea>
        <p class="hint" id="n-links-h">One or more links, one per line: YouTube, Google Drive, Dropbox or any link we can open.</p></div>
      <div class="field"><label for="n-notes">Notes <span class="opt">(optional)</span></label>
        <textarea class="input" id="n-notes" maxlength="2000" placeholder="The part to use, the style you like, anything we should keep."></textarea></div>
      <button class="btn primary block" type="submit">Send to our team</button>
      <p class="err" role="alert"></p>
    </form>`;
  const form = $("#nf");
  form.onsubmit = async e => {
    e.preventDefault();
    const title = $("#n-title").value.trim();
    if (!title) return formErr(form, "Give this Short a title.", $("#n-title"));
    const raw = $("#n-links").value.split(/[\s,]+/).filter(Boolean);
    const links = raw.map(normUrl);
    if (!raw.length) return formErr(form, "Paste at least one link to your footage.", $("#n-links"));
    const bad = raw.find((r, i) => !links[i]);
    if (bad) return formErr(form, `This doesn't look like a link: ${bad.slice(0, 60)}`, $("#n-links"));
    const btn = $("button[type=submit]", form);
    formErr(form, ""); busy(btn, true, "Sending…");
    try {
      const v = await must(sb.from("videos").insert({
        user_id: ME.id, purchase_id: w.next.id, title, notes: $("#n-notes").value.trim() || null, footage: links.join("\n"),
      }).select("id").single());
      toast("Got it. We're on it.");
      go(`#/v/${v.id}`);
    } catch (err) { busy(btn, false); formErr(form, friendly(err)); }
  };
}

/* ---------------- the review room (Frame.io-style) ---------------- */
function historyHTML(v) {
  const ev = [{ label: "You sent it", at: v.created_at }];
  const rounds = r => v.comments.filter(c => (c.round || 1) === r && c.author_role === "client");
  for (const x of [...v.versions].reverse()) {
    const prev = rounds(x.version - 1);
    if (prev.length) ev.push({ label: `Notes on v${x.version - 1} (${prev.length})`, at: prev[0].created_at });
    ev.push({ label: `v${x.version} delivered`, at: x.created_at });
  }
  const last = v.latest ? v.latest.version : 0, open = rounds(last);
  if (v.status === "revision" && open.length) ev.push({ label: `Notes on v${last} (${open.length})`, at: open[0].created_at });
  if (["received", "editing", "revision"].includes(v.status) && v.due_at) ev.push({ label: expected(v.due_at), due: true });
  if (v.status === "approved") ev.push({ label: "Approved" });
  return `<ol class="timeline" aria-label="History">${ev.map((e, i) => `<li class="${e.due ? "due" : ""}${i === ev.length - 1 ? " now" : ""}"${i === ev.length - 1 ? ` aria-current="step"` : ""}>
    <span class="dot" aria-hidden="true"></span><span>${esc(e.label)}${e.at ? ` <time>${esc(when(e.at))}</time>` : ""}</span></li>`).join("")}</ol>`;
}
const who = n => n.author_role === "team" ? `${esc(n.author_name || "Our team")} <span class="team">BEJÚ team</span>` : "You";
function threadHTML(v, c, canWrite, focusId) {
  const replies = v.notes.filter(n => n.parent_id === c.id);
  const t = Number(c.at) > 0 ? `<button class="tchip" type="button" data-seek="${Number(c.at)}" aria-label="Go to ${fmtTime(c.at)}">${esc(fmtTime(c.at))}</button>` : `<span class="tchip gen">General</span>`;
  return `<li class="thread${c.id === focusId ? " focus" : ""}" id="c-${esc(c.id)}" data-cid="${esc(c.id)}">
    <div class="c-head">${t}<span class="c-who">${who(c)}</span><time title="${esc(when(c.created_at))}">${esc(ago(c.created_at))}</time>
      ${c.author_role === "client" ? (c.done_at ? `<span class="c-state done">${ic("check")}Done</span>` : `<span class="c-state open">Open</span>`) : ""}</div>
    <p class="c-text pre">${esc(c.text)}</p>
    ${replies.length ? `<ul class="replies">${replies.map(r => `<li class="${r.author_role === "team" ? "team-r" : ""}"><div class="c-head"><span class="c-who">${who(r)}</span><time title="${esc(when(r.created_at))}">${esc(ago(r.created_at))}</time></div><p class="c-text pre">${esc(r.text)}</p></li>`).join("")}</ul>` : ""}
    ${canWrite ? `<button class="linkish sm" type="button" data-reply="${esc(c.id)}">Reply</button>` : ""}
  </li>`;
}
function commentsHTML(v, ver, focusId) {
  const canWrite = v.status === "ready" && ver && v.latest && ver.version === v.latest.version;
  const mine = v.comments.filter(c => (c.round || 1) === (ver ? ver.version : 1)).sort((a, b) => (+a.at || 0) - (+b.at || 0) || ts(a.created_at) - ts(b.created_at));
  const older = v.comments.filter(c => (c.round || 1) !== (ver ? ver.version : 1));
  const intro = canWrite ? `<p class="hint">Pause on any frame and press <kbd>C</kbd>, or tap the timeline. Your note sticks to that exact moment.</p>`
    : v.status === "revision" ? `<p class="hint">We're making these changes now. The new version shows up here.</p>`
    : v.status === "approved" ? `<p class="hint">Approved. Thank you!</p>` : "";
  return `${intro}
    ${canWrite ? `<form class="composer" id="composer" novalidate>
      <div class="c-time"><button type="button" class="tchip live" id="c-at" aria-label="Note time">${esc(fmtTime(ROOM ? ROOM.at : 0))}</button>
        <label class="gen-t"><input type="checkbox" id="c-gen"> General note</label></div>
      <textarea class="input" id="c-text" maxlength="1000" rows="2" placeholder="What should change here?" aria-label="Your note"></textarea>
      <div class="row end"><button class="btn primary sm" type="submit">${ic("send")}Add note</button></div>
      <p class="err" role="alert"></p></form>` : ""}
    ${mine.length ? `<ul class="threads">${mine.map(c => threadHTML(v, c, canWrite, focusId)).join("")}</ul>` : canWrite ? "" : `<p class="hint">No notes on this version.</p>`}
    ${older.length ? `<details class="older"><summary>Notes on other versions (${older.length})</summary><ul class="threads">${older.map(c => threadHTML(v, c, false, focusId)).join("")}</ul></details>` : ""}`;
}
function actionsHTML(v, ver) {
  if (v.status !== "ready" || !ver || !v.latest || ver.version !== v.latest.version) return "";
  const open = v.comments.filter(c => (c.round || 1) === ver.version && c.author_role === "client" && !c.done_at).length;
  return `<div class="decide"><button class="btn primary" type="button" id="approve">${ic("check")}Approve v${ver.version}</button>
    <button class="btn glass" type="button" id="changes"${open ? "" : " aria-disabled=\"true\""}>${ic("pen")}Request changes${open ? ` (${open})` : ""}</button></div>`;
}
function verSwitch(v, ver) {
  if (v.versions.length < 2) return v.latest ? `<span class="vbadge">v${esc(v.latest.version)}</span>` : "";
  return `<div class="vswitch" role="tablist" aria-label="Version">${v.versions.slice().reverse().map(x =>
    `<button type="button" role="tab" class="${x.version === ver.version ? "on" : ""}" aria-selected="${x.version === ver.version}" data-ver="${x.version}">v${x.version}</button>`).join("")}
    <button type="button" class="cmp${ROOM && ROOM.compare ? " on" : ""}" data-compare aria-pressed="${!!(ROOM && ROOM.compare)}">${ic("split")}Compare</button></div>`;
}
const playerShell = (id, label) => `<div class="rplayer" data-player="${id}">
  <div class="screen rv"><video id="${id}" playsinline preload="metadata" aria-label="${esc(label)}"></video>
    <button class="bigplay" type="button" data-play="${id}" aria-label="Play">${ic("play")}</button></div>
  <div class="ctrl">
    <button class="cbtn pp" type="button" data-play="${id}" aria-label="Play or pause (Space)"><svg class="ic ip" aria-hidden="true"><use href="#i-play"/></svg><svg class="ic ipa" aria-hidden="true"><use href="#i-pause"/></svg></button>
    <span class="clock" data-clock="${id}">0:00 / 0:00</span>
    <span class="grow"></span>
    <button class="cbtn" type="button" data-step="-1" data-for="${id}" aria-label="Back one frame (,)">${ic("prev")}</button>
    <button class="cbtn" type="button" data-step="1" data-for="${id}" aria-label="Forward one frame (.)">${ic("next")}</button>
    <button class="cbtn" type="button" data-mute="${id}" aria-label="Mute (M)">${ic("vol")}</button>
    <button class="cbtn" type="button" data-full="${id}" aria-label="Full screen (F)">${ic("full")}</button>
  </div>
  <div class="tl" data-tl="${id}" role="slider" tabindex="0" aria-label="Timeline: tap to jump and leave a note there" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">
    <div class="tl-track"><i class="tl-buf"></i><i class="tl-fill"></i></div><div class="tl-marks"></div><i class="tl-head"></i></div>
</div>`;
function stageFor(m, label) {
  if (!m) return `<div class="screen wait"><p>It plays here when it's ready.</p></div>`;
  if (m.kind === "frame") return `<div class="screen"><iframe src="${esc(m.src)}" title="${esc(label)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
    <p class="hint center">Notes on the exact frame work on the review copy. ${extLink(m.href, "Open in a new tab", "link")}</p>`;
  return `<div class="screen wait"><p>${esc(label)} is ready.</p>${extLink(m.href, "Open it", "btn primary")}</div>`;
}

async function reviewRoom(v, opts = {}) {
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  const want = Number(q.get("ver")) || 0, focusId = q.get("c") || "";
  const ver = v.versions.find(x => x.version === want) || v.latest;
  ROOM = { id: v.id, ver: ver ? ver.version : 0, compare: ROOM && ROOM.id === v.id ? ROOM.compare : false, focus: focusId, at: 0, gen: false, players: [] };
  markSeen(v);
  const footage = String(v.footage || "").split(/\s+/).filter(Boolean);
  view.classList.remove("quiet");
  view.innerHTML = `<a class="back" href="#/">${ic("back")}All Shorts</a>
    <div class="rhead"><div><p class="rstate" id="r-state">${chip(v.status)}${v.due_at && v.status !== "approved" && v.status !== "ready" ? `<span class="due${isPast(v.due_at) ? " late" : ""}">${esc(expected(v.due_at, "Expected by", true))}</span>` : ""}</p>
      <h1 class="title">${esc(v.title)}</h1></div><div id="r-ver">${ver ? verSwitch(v, ver) : ""}</div></div>
    <div class="room${ROOM.compare ? " comparing" : ""}" id="room">
      <div class="stage" id="stage"></div>
      <div class="side">
        <div id="r-actions">${actionsHTML(v, ver)}</div>
        <div class="tabs" role="tablist" aria-label="Details">
          <button role="tab" type="button" class="on" aria-selected="true" data-tab="notes">Notes<i id="r-ncount">${v.comments.length || ""}</i></button>
          <button role="tab" type="button" aria-selected="false" data-tab="hist">History</button>
          <button role="tab" type="button" aria-selected="false" data-tab="brief">Brief</button></div>
        <section class="tabp" data-p="notes" id="r-notes">${commentsHTML(v, ver, focusId)}</section>
        <section class="tabp" data-p="hist" hidden>${historyHTML(v)}${ver && ver.note ? `<p class="hint">What changed in v${esc(ver.version)}: ${esc(ver.note)}</p>` : ""}</section>
        <section class="tabp" data-p="brief" hidden><dl class="facts">
          <dt>Footage</dt><dd>${footage.length ? `<ul class="links">${footage.map(f => `<li>${extLink(f)}</li>`).join("")}</ul>` : "—"}</dd>
          ${v.notes ? `<dt>Your notes</dt><dd class="pre">${esc(v.notes)}</dd>` : ""}
          <dt>Sent</dt><dd>${esc(when(v.created_at))}</dd></dl></section>
      </div>
    </div>`;
  await paintStage(v);
  wireRoom(v);
  if (focusId) { const el = $(`#c-${CSS.escape(focusId)}`); if (el) { el.scrollIntoView({ block: "center", behavior: RM ? "auto" : "smooth" }); const c = v.comments.find(x => x.id === focusId); if (c && +c.at > 0) seekAll(+c.at); } }
}
async function paintStage(v) {
  const ver = v.versions.find(x => x.version === ROOM.ver) || v.latest;
  const stage = $("#stage"); ROOM.players = [];
  if (!ver) { stage.innerHTML = `<div class="screen wait"><p>${v.status === "received" ? "We have your footage." : "We're editing your Short."}<br>It plays here when it's ready.</p></div>`; return; }
  const list = ROOM.compare && v.versions.length > 1 ? [v.versions.find(x => x.version === ROOM.cmpA && x.version !== ver.version) || v.versions.find(x => x.version !== ver.version), ver] : [ver];
  if (ROOM.compare && !ROOM.cmpA) ROOM.cmpA = list[0].version;
  const url = await signed(list.map(verPath));
  if (!stage.isConnected) return;   // the page changed while the play links were loading
  stage.innerHTML = list.map((x, i) => {
    const p = verPath(x), u = p ? url(p) : "";
    const head = ROOM.compare ? `<div class="cmp-h">${i === 0 ? `<label>Left <select data-cmpa>${v.versions.filter(y => y.version !== ver.version).map(y => `<option value="${y.version}"${y.version === x.version ? " selected" : ""}>v${y.version}</option>`).join("")}</select></label>` : `<b>v${esc(x.version)}</b> <small>(this version)</small>`}</div>` : "";
    return `<div class="pane">${head}${u ? playerShell(`pv${i}`, `${v.title} v${x.version}`) : stageFor(media(x.url), `v${x.version}`)}</div>`;
  }).join("");
  list.forEach((x, i) => {
    const p = verPath(x), u = p ? url(p) : "";
    if (!u) return;
    const el = $(`#pv${i}`, stage); if (!el) return; el.src = u; ROOM.players.push(el);
    wirePlayer(el, v, i === list.length - 1);
  });
  if (ROOM.compare && ROOM.players.length === 2) syncPair(ROOM.players[0], ROOM.players[1]);
  const full = safeUrl(ver.url);
  if (full && verPath(ver)) stage.insertAdjacentHTML("beforeend", `<p class="hint center">Full-quality file: ${extLink(full, "open or download", "link")}</p>`);
}
const FPS = 30;
function wirePlayer(el, v, main) {
  const id = el.id, tl = $(`[data-tl="${id}"]`), clock = $(`[data-clock="${id}"]`), fill = $(".tl-fill", tl), buf = $(".tl-buf", tl), headI = $(".tl-head", tl), shell = el.closest(".rplayer");
  const paint = () => {
    const d = el.duration || 0, t = el.currentTime || 0, k = d ? t / d : 0;
    fill.style.setProperty("--k", k); headI.style.setProperty("--k", k);
    clock.textContent = `${fmtTimeF(t)} / ${fmtTime(d)}`;
    tl.setAttribute("aria-valuemax", Math.round(d)); tl.setAttribute("aria-valuenow", Math.round(t)); tl.setAttribute("aria-valuetext", fmtTime(t));
    if (el.buffered.length && d) buf.style.setProperty("--k", el.buffered.end(el.buffered.length - 1) / d);
    if (main) { ROOM.at = t; const c = $("#c-at"); if (c && !ROOM.gen && document.activeElement !== $("#c-text")) c.textContent = fmtTime(t); }
  };
  const marks = () => {
    if (!main) return;
    const d = el.duration || 0, wrap = $(".tl-marks", tl), r = ROOM.ver, cur = (DATA && DATA.videos.find(x => x.id === v.id)) || v;   // newest notes after a refresh
    const cs = cur.comments.filter(c => (c.round || 1) === r && Number(c.at) > 0 && d);
    wrap.innerHTML = cs.map(c => `<button type="button" class="mark${c.author_role === "team" ? " team" : ""}${c.done_at ? " done" : ""}" data-mark="${esc(c.id)}" aria-label="Note at ${fmtTime(c.at)}" title="${esc(fmtTime(c.at))}: ${esc(c.text.slice(0, 80))}"></button>`).join("");
    $$(".mark", wrap).forEach(b => { const c = cs.find(x => x.id === b.dataset.mark); b.style.setProperty("--k", Math.min(1, Number(c.at) / d)); });
  };
  el.addEventListener("timeupdate", paint); el.addEventListener("progress", paint);
  el.addEventListener("loadedmetadata", () => { paint(); marks(); });
  el.addEventListener("play", () => shell.classList.add("playing")); el.addEventListener("pause", () => shell.classList.remove("playing"));
  el.addEventListener("ended", () => shell.classList.remove("playing"));
  el.addEventListener("click", () => toggle(el));
  el.addEventListener("error", () => { const s = $(".screen", shell); if (s) s.insertAdjacentHTML("beforeend", `<p class="verr">This copy didn't load. Refresh the page to get a fresh link.</p>`); });
  const seekFrom = ev => { const r = tl.getBoundingClientRect(), k = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)); if (el.duration) el.currentTime = k * el.duration; paint(); };
  let drag = false;
  tl.addEventListener("pointerdown", ev => { if (ev.target.closest(".mark")) return; drag = true; tl.setPointerCapture(ev.pointerId); el.pause(); seekFrom(ev); });
  tl.addEventListener("pointermove", ev => { if (drag) seekFrom(ev); });
  tl.addEventListener("pointerup", ev => { if (!drag) return; drag = false; seekFrom(ev); if (main) openComposer(); });
  tl.addEventListener("keydown", ev => {
    const d = el.duration || 0; if (!d) return;
    if (ev.key === "ArrowRight") { el.currentTime = Math.min(d, el.currentTime + (ev.shiftKey ? 5 : 1)); ev.preventDefault(); }
    else if (ev.key === "ArrowLeft") { el.currentTime = Math.max(0, el.currentTime - (ev.shiftKey ? 5 : 1)); ev.preventDefault(); }
    else if (ev.key === "Home") { el.currentTime = 0; ev.preventDefault(); } else if (ev.key === "End") { el.currentTime = d; ev.preventDefault(); }
    paint();
  });
  if (main) ROOM.paintMarks = marks;
}
function toggle(el) { if (!el) return; if (el.paused) el.play().catch(() => {}); else el.pause(); }
function seekAll(t) { const ps = ROOM ? ROOM.players : []; ps.forEach(p => { if (p.readyState) p.currentTime = Math.min(p.duration || t, t); else p.addEventListener("loadedmetadata", () => { p.currentTime = Math.min(p.duration || t, t); }, { once: true }); }); }
function syncPair(a, b) {   // compare: the left player follows the right one
  const follow = () => { if (Math.abs(a.currentTime - b.currentTime) > .12) a.currentTime = b.currentTime; };
  b.addEventListener("play", () => { a.currentTime = b.currentTime; a.play().catch(() => {}); });
  b.addEventListener("pause", () => a.pause()); b.addEventListener("seeked", follow); b.addEventListener("timeupdate", follow);
  a.muted = true;
}
function mainPlayer() { return ROOM && ROOM.players.length ? ROOM.players[ROOM.players.length - 1] : null; }
function openComposer() {
  const c = $("#c-text"); if (!c) return;
  const p = mainPlayer(); if (p) p.pause();
  ROOM.gen = false; const g = $("#c-gen"); if (g) g.checked = false;
  $("#c-at").textContent = fmtTime(ROOM.at);
  ROOM.noteAt = ROOM.at;
  c.focus({ preventScroll: true });
  c.closest(".composer").scrollIntoView({ block: "nearest", behavior: RM ? "auto" : "smooth" });
}
function wireRoom(v) {
  const ver = () => v.versions.find(x => x.version === ROOM.ver) || v.latest;
  view.onclick = async e => {
    const b = e.target.closest("button,[data-tab]"); if (!b) return;
    if (b.dataset.play) return toggle($("#" + b.dataset.play));
    if (b.dataset.step) { const p = $("#" + b.dataset.for); if (p) { p.pause(); p.currentTime = Math.max(0, Math.min(p.duration || 0, p.currentTime + Number(b.dataset.step) / FPS)); } return; }
    if (b.dataset.mute) { const p = $("#" + b.dataset.mute); p.muted = !p.muted; b.classList.toggle("off", p.muted); return; }
    if (b.dataset.full) { const p = $("#" + b.dataset.full); const s = p.closest(".rplayer"); (s.requestFullscreen || p.webkitEnterFullscreen || (() => {})).call(s.requestFullscreen ? s : p); return; }
    if (b.dataset.mark) { const c = v.comments.find(x => x.id === b.dataset.mark); if (c) { seekAll(+c.at); focusThread(c.id); } return; }
    if (b.dataset.seek) { seekAll(Number(b.dataset.seek)); const p = mainPlayer(); if (p) { p.pause(); p.closest(".rplayer").scrollIntoView({ block: "nearest", behavior: RM ? "auto" : "smooth" }); } return; }
    if (b.dataset.tab) { $$("[data-tab]").forEach(t => { const on = t === b; t.classList.toggle("on", on); t.setAttribute("aria-selected", on); }); $$(".tabp").forEach(p => { p.hidden = p.dataset.p !== b.dataset.tab; }); return; }
    if (b.dataset.ver) { history.replaceState(null, "", `#/v/${v.id}?ver=${b.dataset.ver}`); ROOM.ver = Number(b.dataset.ver); ROOM.cmpA = 0; $("#r-ver").innerHTML = verSwitch(v, ver()); $("#r-notes").innerHTML = commentsHTML(v, ver(), ""); $("#r-actions").innerHTML = actionsHTML(v, ver()); await paintStage(v); wireComposer(v); return; }
    if (b.hasAttribute("data-compare")) { ROOM.compare = !ROOM.compare; ROOM.cmpA = 0; $("#room").classList.toggle("comparing", ROOM.compare); $("#r-ver").innerHTML = verSwitch(v, ver()); await paintStage(v); return; }
    if (b.dataset.reply) return replyBox(v, b.dataset.reply, b);
    if (b.id === "c-at") { if (ROOM.gen) return; const p = mainPlayer(); if (p) { p.currentTime = ROOM.noteAt || 0; p.pause(); } return; }
    if (b.id === "approve") return approve(v, ver());
    if (b.id === "changes") return requestChanges(v, ver());
  };
  view.onchange = async e => { if (e.target.matches("[data-cmpa]")) { ROOM.cmpA = Number(e.target.value); await paintStage(v); } };
  wireComposer(v);
}
function focusThread(id) { $$(".thread.focus").forEach(t => t.classList.remove("focus")); const el = $(`#c-${CSS.escape(id)}`); if (el) { el.classList.add("focus"); el.scrollIntoView({ block: "nearest", behavior: RM ? "auto" : "smooth" }); } }
function wireComposer(v) {
  const form = $("#composer"); if (!form) return;
  const txt = $("#c-text"), gen = $("#c-gen");
  txt.addEventListener("focus", () => { if (ROOM.noteAt == null || !txt.value) ROOM.noteAt = ROOM.at; const p = mainPlayer(); if (p && !p.paused) p.pause(); if (!ROOM.gen) $("#c-at").textContent = fmtTime(ROOM.noteAt); });
  gen.onchange = () => { ROOM.gen = gen.checked; $("#c-at").textContent = gen.checked ? "General" : fmtTime(ROOM.noteAt || ROOM.at); $("#c-at").classList.toggle("gen", gen.checked); };
  txt.addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); form.requestSubmit(); } });
  form.onsubmit = async e => {
    e.preventDefault();
    const text = txt.value.trim(); if (!text) return formErr(form, "Write what should change.", txt);
    const btn = $("button[type=submit]", form); formErr(form, ""); busy(btn, true, "Adding…");
    const at = ROOM.gen ? 0 : Math.floor((ROOM.noteAt ?? ROOM.at) * 10) / 10;   // floor: the saved time shows the same second as the chip
    try {
      await must(sb.from("video_notes").insert({ video_id: v.id, user_id: ME.id, at, text }));   // the database sets the round and author
      txt.value = ""; ROOM.noteAt = null; busy(btn, false); toast(at ? `Note added at ${fmtTime(at)}` : "Note added");
      await refreshRoom(v.id);
    } catch (err) { busy(btn, false); formErr(form, friendly(err)); }
  };
}
function replyBox(v, cid, btn) {
  if ($(`#rb-${CSS.escape(cid)}`)) return $(`#rb-${CSS.escape(cid)} textarea`).focus();
  btn.insertAdjacentHTML("afterend", `<form class="rbox" id="rb-${esc(cid)}" novalidate><textarea class="input" maxlength="1000" rows="2" placeholder="Reply" aria-label="Reply"></textarea>
    <div class="row end"><button class="btn glass sm" type="button" data-x>Cancel</button><button class="btn primary sm" type="submit">Reply</button></div><p class="err" role="alert"></p></form>`);
  const f = $(`#rb-${CSS.escape(cid)}`), t = $("textarea", f); t.focus();
  $("[data-x]", f).onclick = () => f.remove();
  f.onsubmit = async e => {
    e.preventDefault(); const text = t.value.trim(); if (!text) return formErr(f, "Write your reply.", t);
    const b = $("button[type=submit]", f); busy(b, true, "Sending…");
    try { await must(sb.from("video_notes").insert({ video_id: v.id, user_id: ME.id, parent_id: cid, at: 0, text })); toast("Reply added"); await refreshRoom(v.id); }
    catch (err) { busy(b, false); formErr(f, friendly(err)); }
  };
}
async function approve(v, ver) {
  const ok = await sheet({ title: `Approve v${ver.version}?`, body: "This Short is marked as done. You can still download it any time.", ok: "Approve" });
  if (!ok) return;
  const b = $("#approve"); busy(b, true, "Approving…");
  try { await must(sb.from("videos").update({ status: "approved" }).eq("id", v.id).eq("user_id", ME.id)); celebrate(); toast("Approved. Thank you!"); await refreshRoom(v.id); }
  catch (err) { busy(b, false); toast(friendly(err), true); }
}
async function requestChanges(v, ver) {
  const open = v.comments.filter(c => (c.round || 1) === ver.version && c.author_role === "client" && !c.done_at).length;
  if (!open) { toast("Add at least one note first: pause on the frame and press C, or tap the timeline."); return openComposer(); }
  const ok = await sheet({ title: `Send ${plural(open, "note")} to our team?`, body: "We start on your changes right away. The new version shows up here, usually within 24 hours.", ok: "Send changes" });
  if (!ok) return;
  const b = $("#changes"); busy(b, true, "Sending…");
  try { await must(sb.from("videos").update({ status: "revision" }).eq("id", v.id).eq("user_id", ME.id)); toast("Sent. We're making your changes."); await refreshRoom(v.id); }
  catch (err) { busy(b, false); toast(friendly(err), true); }
}
// Quiet refresh of the open room: the player keeps playing unless a new version arrived.
async function refreshRoom(id, fromLive) {
  const D = await loadAll(); DATA = D;
  const v = D.videos.find(x => x.id === id); if (!v || !ROOM || ROOM.id !== id) return;
  const newest = v.latest ? v.latest.version : 0;
  const ver = v.versions.find(x => x.version === ROOM.ver) || v.latest;
  $("#r-state").innerHTML = `${chip(v.status)}${v.due_at && v.status !== "approved" && v.status !== "ready" ? `<span class="due${isPast(v.due_at) ? " late" : ""}">${esc(expected(v.due_at, "Expected by", true))}</span>` : ""}`;
  const keep = $("#c-text") ? $("#c-text").value : "";
  $("#r-notes").innerHTML = commentsHTML(v, ver, ""); $("#r-actions").innerHTML = actionsHTML(v, ver); $("#r-ncount").textContent = v.comments.length || "";
  if ($("#c-text")) $("#c-text").value = keep;
  $("#r-ver").innerHTML = ver ? verSwitch(v, ver) : "";
  wireRoom(v); if (ROOM.paintMarks) ROOM.paintMarks();
  if (ROOM.ver === 0 && newest > 0) {   // the very first version arrived while the room showed "we're editing": show it at once
    ROOM.ver = newest; await paintStage(v); if (fromLive) toast(`Version ${newest} is ready`);
  } else if (newest > ROOM.ver && fromLive) toast(`Version ${newest} is ready`, false, { label: "Watch it", run: async () => { ROOM.ver = newest; history.replaceState(null, "", `#/v/${v.id}?ver=${newest}`); $("#r-ver").innerHTML = verSwitch(v, v.latest); $("#r-notes").innerHTML = commentsHTML(v, v.latest, ""); $("#r-actions").innerHTML = actionsHTML(v, v.latest); await paintStage(v); wireComposer(v); } });
  markSeen(v);
}
function celebrate() {
  if (RM) return;
  const c = document.createElement("canvas"); c.className = "confetti"; document.body.appendChild(c);
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = c.width = innerWidth * dpr, H = c.height = innerHeight * dpr, ctx = c.getContext("2d");
  const cols = ["#FFD35C", "#44B874", "#F7F5EC", "#D9B45A", "#BD424F"];
  const ps = Array.from({ length: 90 }, () => ({ x: W / 2, y: H * .55, vx: (Math.random() - .5) * 18 * dpr, vy: (-Math.random() * 16 - 6) * dpr, s: (5 + Math.random() * 6) * dpr, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[Math.floor(Math.random() * cols.length)] }));
  const t0 = performance.now();
  const step = now => { const k = (now - t0) / 1600; ctx.clearRect(0, 0, W, H); if (k > 1) return c.remove();
    ps.forEach(p => { p.vy += .5 * dpr; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
    requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
// Keyboard: Space/K play, J/L ±5 s, ,/. one frame, C note here, M mute, F full screen (not while typing).
document.addEventListener("keydown", e => {
  if (!ROOM || parseHash()[0] !== "v" || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest("input,textarea,select,[contenteditable]") || !$("#sheet").hidden) return;
  const p = mainPlayer(); if (!p) return;
  const k = e.key.toLowerCase();
  if (k === " " || k === "k") { e.preventDefault(); toggle(p); }
  else if (k === "j") p.currentTime = Math.max(0, p.currentTime - 5);
  else if (k === "l") p.currentTime = Math.min(p.duration || 0, p.currentTime + 5);
  else if (k === ",") { p.pause(); p.currentTime = Math.max(0, p.currentTime - 1 / FPS); }
  else if (k === ".") { p.pause(); p.currentTime = Math.min(p.duration || 0, p.currentTime + 1 / FPS); }
  else if (k === "c") { e.preventDefault(); openComposer(); }
  else if (k === "m") p.muted = !p.muted;
  else if (k === "f") { const s = p.closest(".rplayer"); if (s.requestFullscreen) s.requestFullscreen().catch(() => {}); }
});

/* ---------------- account ---------------- */
function account() {
  const crm = ME.is_admin === true ? crmHref() : "";
  view.innerHTML = head("Account") + `
    <div class="grid acct">
    <form id="acc" class="card form" novalidate>
      <h2>Your details</h2>
      <div class="field"><span class="label">Email</span><p class="static">${esc(ME.email)}</p></div>
      ${profileFields(ME, true)}
      <button class="btn primary block" type="submit">Save changes</button>
      <p class="err" role="alert"></p>
    </form>
    <div class="stack">
      <form id="pw" class="card form" novalidate>
        <h2>Password</h2>
        <input class="sr" type="email" autocomplete="username" value="${esc(ME.email || "")}" readonly tabindex="-1" aria-hidden="true">
        <div class="field"><label for="pw1">New password</label><input class="input" id="pw1" type="password" autocomplete="new-password" minlength="8" maxlength="72" required></div>
        <div class="field"><label for="pw2">Type it again</label><input class="input" id="pw2" type="password" autocomplete="new-password" minlength="8" maxlength="72" required></div>
        <button class="btn glass block" type="submit">Change password</button>
        <p class="err" role="alert"></p>
      </form>
      <section class="card"><h2>Sessions</h2>
        <p class="hint">Lost a phone or used a shared computer? Sign out everywhere, then log in again here.</p>
        <div class="row"><button class="btn glass" type="button" data-out>Sign out</button><button class="btn glass" type="button" id="out-all">Sign out everywhere</button></div>
        ${crm ? `<p class="hint"><a class="link" href="${esc(crm)}">Founders' CRM</a></p>` : ""}</section>
      <section class="card"><h2>What we store and why</h2>
        <p class="hint">Your name, email and channel details, so we can make your Shorts. Your password is stored hashed: nobody at BEJÚ can see it. Your review copies are private files: only you and our team can open them, and every play link expires within the hour. Your notes and approvals tell our editors what to change.</p>
        <p class="hint"><a class="link" href="/privacy.html">Read the full privacy policy</a></p></section>
    </div></div>`;
  const form = $("#acc");
  form.onsubmit = async e => {
    e.preventDefault();
    const vals = readProfile(form, true);
    if (!vals) return;
    const btn = $("button[type=submit]", form);
    busy(btn, true, "Saving…");
    try { await must(sb.from("profiles").update(vals).eq("id", ME.id)); Object.assign(ME, vals); busy(btn, false); toast("Saved."); }
    catch (err) { busy(btn, false); formErr(form, friendly(err)); }
  };
  const pw = $("#pw");
  pw.onsubmit = async e => {
    e.preventDefault();
    const a = $("#pw1").value, b = $("#pw2").value, btn = $("button[type=submit]", pw);
    if (a.length < 8) return formErr(pw, "Use a password with at least 8 characters.", $("#pw1"));
    if (a !== b) return formErr(pw, "The two passwords don't match.", $("#pw2"));
    busy(btn, true, "Saving…");
    try { await must(sb.auth.updateUser({ password: a })); $("#pw1").value = $("#pw2").value = ""; busy(btn, false); formErr(pw, ""); toast("Your password is changed."); }
    catch (err) { busy(btn, false); formErr(pw, friendly(err)); }
  };
  $("#out-all").onclick = async e => {
    const ok = await sheet({ title: "Sign out everywhere?", body: "Every phone and computer logged in to your account is signed out, this one too.", ok: "Sign out everywhere", danger: true });
    if (!ok) return;
    busy(e.currentTarget, true, "Signing out…");
    await sb.auth.signOut({ scope: "global" }).catch(() => sb.auth.signOut({ scope: "local" }));
    ME = null; store.del(PENDING); go("#/login");
  };
}

/* ---------------- live: realtime with a polling fallback ---------------- */
let CH = null, POLL = 0, LIVE_T = 0;
function startLive() {
  if (CH || !ME) return;
  const uid = ME.id, sub = (table, filter) => ({ event: "*", schema: "public", table, ...(filter ? { filter } : {}) });
  CH = sb.channel(`portal-${uid}`)
    .on("postgres_changes", sub("videos", `user_id=eq.${uid}`), p => liveEvent("videos", p))
    .on("postgres_changes", sub("video_versions"), p => liveEvent("video_versions", p))
    .on("postgres_changes", sub("video_notes"), p => liveEvent("video_notes", p))
    .on("postgres_changes", sub("purchases", `user_id=eq.${uid}`), p => liveEvent("purchases", p))
    .on("postgres_changes", sub("sample_requests", `user_id=eq.${uid}`), p => liveEvent("sample_requests", p))
    .subscribe(st => setLiveDot(st === "SUBSCRIBED" ? "live" : "poll"));
  clearInterval(POLL); POLL = setInterval(() => { if (!document.hidden && $("#live") && $("#live").dataset.state !== "live") liveRefresh(); }, 60000);
}
function stopLive() { if (CH) { sb.removeChannel(CH); CH = null; } clearInterval(POLL); POLL = 0; setLiveDot("poll"); }
const LIVE_MSG = [];
function liveEvent(table, p) {
  const n = p.new || {}, o = p.old || {};
  if (table === "video_versions" && p.eventType === "INSERT") LIVE_MSG.push(`Version ${n.version} is ready for review`);
  else if (table === "video_notes" && p.eventType === "INSERT" && n.author_role === "team") LIVE_MSG.push(`${n.author_name || "Our team"} replied to your note`);
  else if (table === "videos" && p.eventType === "UPDATE" && n.status !== o.status) LIVE_MSG.push(n.status === "editing" ? `“${n.title}” is in edit` : n.status === "ready" ? `“${n.title}” is ready for review` : "");
  else if (table === "purchases" && p.eventType === "INSERT") LIVE_MSG.push(`${plural(n.videos || 0, "credit")} added to your account`);
  else if (table === "sample_requests" && p.eventType === "UPDATE" && n.status !== o.status) LIVE_MSG.push(n.status === "ready" ? "Your free sample is ready" : n.status === "accepted" ? "Your free sample request is accepted" : "Your free sample request was updated");
  clearTimeout(LIVE_T); LIVE_T = setTimeout(liveRefresh, 900);
}
async function liveRefresh() {
  const msg = LIVE_MSG.filter(Boolean); LIVE_MSG.length = 0;
  if (!ME || $("#sheet").hidden === false) return;
  const [route, arg] = parseHash();
  try {
    if (route === "v" && ROOM && ROOM.id === arg) { await refreshRoom(arg, true); if (msg.length && !msg[0].startsWith("Version")) toast(msg[0]); return; }
    if (route === "home") { const D = await loadAll(); DATA = D; D.pending = pendingState(D.w); await home(D, true); }
    else if (route === "activity" || route === "sample" || route === "packs") render();
    if (msg.length) toast(msg[0]);
  } catch { /* the next event or poll tries again */ }
}

/* ---------------- router ---------------- */
const LOADING = `<div class="skel" role="status" aria-label="Loading"><i></i><i></i><i></i><i></i></div>`;
function go(h) { if (location.hash === h) render(); else location.hash = h; }
function parseHash() {
  const [path] = location.hash.replace(/^#\/?/, "").split("?");
  const [route = "", arg = ""] = path.split("/");
  return [route || "home", arg];
}
function errorView(err) {
  view.innerHTML = `<section class="card narrow empty" role="alert"><h1>Something went wrong</h1><p>${esc(friendly(err))}</p>
    <div class="row"><button class="btn primary" type="button" data-retry>Try again</button>${ME ? `<button class="btn glass" type="button" data-out>Sign out</button>` : ""}</div></section>`;
}
function notFound() {
  view.innerHTML = `<section class="card narrow empty"><h1>We couldn't find that</h1><p>It may have moved, or the link is wrong.</p>
    <a class="btn primary" href="#/">Back home</a></section>`;
}

async function render() {
  const my = ++SEQ, stale = () => my !== SEQ;
  const [route, arg] = parseHash();
  if (route !== "v") ROOM = null;
  view.onclick = null; view.onchange = null;
  const spin = setTimeout(() => { if (!stale()) view.innerHTML = LOADING; }, 200);
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (stale()) return;
    if (route === "reset") return resetView(!!session);
    if (!session) { ME = null; stopLive(); return authView(route === "login" || route === "forgot" ? route : "signup"); }
    if (!ME || ME.id !== session.user.id) {
      try { ME = await loadMe(session.user); }
      catch (err) {
        if (/jwt|PGRST301|401/i.test(`${err.message} ${err.code}`)) {
          NOTICE = "Your session has ended. Please log in again.";
          history.replaceState(null, "", location.pathname + "#/login");
          await sb.auth.signOut({ scope: "local" });
          ME = null;
          return render();
        }
        throw err;
      }
      if (stale()) return;
    }
    // One Log in for everyone (SIMAS 11-12): a founder lands on the founder CRM, a client stays in the portal.
    if (ME.is_admin === true && crmHref() && new URLSearchParams(location.search).get("view") !== "portal") { location.replace(crmHref()); return; }
    if (route === "login" || route === "signup" || route === "forgot") { history.replaceState(null, "", location.pathname + "#/"); return render(); }
    chromeOn(route);
    startLive();
    if (!ME.channel) return onboarding();
    if (route === "account") return account();

    const D = await loadAll(); DATA = D;
    if (stale()) return;
    clearTimeout(spin);   // the data is here: the loading skeleton must not replace a screen that is still painting (play links)
    D.pending = pendingState(D.w);
    if (D.pending === "arrived") toast("Payment received. Your credits are here.");

    if (route === "v") {
      if (!UUID.test(arg)) return notFound();
      const v = D.videos.find(x => x.id === arg);
      if (!v) return notFound();
      return await reviewRoom(v);
    }
    if (route === "sample") return await samplePage(D);
    if (route === "packs") return packsPage(D);
    if (route === "new") return newPage(D);
    if (route === "activity") return activityPage(D);
    if (route !== "home") history.replaceState(null, "", location.pathname + "#/");
    return await home(D);
  } catch (err) {
    if (stale()) return;
    console.error("Page failed to load:", err && err.message || err);
    // one quiet retry per page: a network blip or the auth lock held by another tab must not show an error screen
    if (RETRY !== location.hash) { RETRY = location.hash; setTimeout(() => { if (!stale()) render(); }, 700); return; }
    errorView(err);
  } finally {
    clearTimeout(spin);
    if (!stale()) {
      const key = location.hash.split("?")[0];
      if (key !== LAST) { if (LAST) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); } LAST = key; }
    }
  }
}

// Buttons that appear on several screens (the review room sets its own view.onclick; this listener still runs).
view.addEventListener("click", async e => {
  const t = e.target.closest("[data-out],[data-retry],[data-refresh]");
  if (!t) return;
  if (t.matches("[data-retry]")) return render();
  if (t.matches("[data-refresh]")) { busy(t, true, "Checking…"); return render(); }
  busy(t, true, "Signing out…");
  stopLive();
  await sb.auth.signOut({ scope: "local" });
  ME = null; store.del(PENDING);
  go("#/login");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden || !ME) return;
  const [route] = parseHash();
  if (store.get(PENDING) && (route === "home" || route === "packs")) return render();
  if ($("#live") && $("#live").dataset.state !== "live") liveRefresh();
});

sb.auth.getSession().then(() => {
  if (WANT && location.hash !== WANT) history.replaceState(null, "", location.pathname + location.search + WANT);
  window.addEventListener("hashchange", render);
  render();
});
})();
