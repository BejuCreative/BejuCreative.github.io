/* Beju Creative client portal (static files, no build step).
   Client screens only: no founder pages and no founder tables. Every query is filtered to the signed-in user's own rows,
   so a founder account sees only its own client view here. The database enforces the real rules (row-level security +
   triggers for credits, ownership and status changes); the checks in this file exist to give clear messages. */
(() => {
"use strict";
const CFG = window.BEJU_PORTAL;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const view = $("#view");
const HERE = location.origin + location.pathname;
let ME = null;            // own profile row + auth email
let SEQ = 0, LAST = "";   // render counter (drops stale renders) and last route shown
let NOTICE = "", WANT = "";   // one-time message for the log-in screen; route to open after an email link

/* ---------------- small helpers ---------------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ic = id => `<svg class="ic" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
// Dates in the client's own locale and time zone: "Tue 11 Nov, 20:44" (order follows their locale), 24 h, no seconds.
const DTF = {
  full: new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  day: new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }),
  wkTime: new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  wk: new Intl.DateTimeFormat(undefined, { weekday: "short" }),
};
const fmt = (t, kind) => { const d = t ? new Date(t) : null; return d && !isNaN(d) ? DTF[kind].format(d) : ""; };
const fmtDate = t => fmt(t, "day");           // Tue 11 Nov
const when = t => fmt(t, "full");             // Tue 11 Nov, 20:44
const near = t => t && Math.abs(Date.parse(t) - Date.now()) < 6 * 864e5;
const whenShort = t => near(t) ? fmt(t, "wkTime") : when(t);   // Wed 20:44 within a week, else the full date
const dayShort = t => near(t) ? fmt(t, "wk") : fmtDate(t);      // Thu within a week
const isPast = t => t && Date.parse(t) < Date.now();
// "Expected by Wed 12 Nov, 20:44", or a calm "Due now" once that time has passed
const expected = (t, label = "Expected by", short = false) => !t ? "" : isPast(t)
  ? "Due now. Thanks for your patience." : `${label} ${short ? whenShort(t) : when(t)}`;
const fmtTime = s => {
  s = Math.max(0, Math.round(Number(s) || 0));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};
const greet = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
const firstName = () => String((ME && ME.name) || "").trim().split(/\s+/)[0];
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

// The only way a URL reaches an href or src: must parse as http(s), else "".
function safeUrl(u) {
  try { const x = new URL(String(u ?? "").trim()); return x.protocol === "https:" || x.protocol === "http:" ? x.href : ""; }
  catch { return ""; }
}
// Accepts "youtube.com/@me" as well as full links; returns a clean https URL or "".
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

// What can we play? Drive and YouTube become iframes on fixed origins; direct video files use <video>.
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
  if (/\.(mp4|m4v|mov|webm)$/i.test(x.pathname)) return { kind: "video", src: h, href: h };
  return { kind: "link", href: h };
}
function playerHTML(m, title) {
  if (!m) return "";
  if (m.kind === "frame") return `<div class="screen"><iframe src="${esc(m.src)}" title="${esc(title)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  if (m.kind === "video") return `<div class="screen"><video src="${esc(m.src)}" controls playsinline preload="metadata" aria-label="${esc(title)}"></video></div>`;
  return "";
}

function toast(msg, bad = false) {
  const t = $("#toast");
  t.textContent = msg; t.classList.toggle("bad", bad); t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, bad ? 6000 : 3400);
}
function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.textContent; btn.disabled = true; btn.setAttribute("aria-busy", "true"); if (label) btn.textContent = label; }
  else { btn.disabled = false; btn.removeAttribute("aria-busy"); if (btn.dataset.label) btn.textContent = btn.dataset.label; }
}
// Show a plain-words error under a form and point at the field.
function formErr(form, msg, field) {
  $$("[aria-invalid]", form).forEach(el => el.removeAttribute("aria-invalid"));
  const box = $(".err", form);
  if (box) box.textContent = msg || "";
  if (field) { field.setAttribute("aria-invalid", "true"); field.focus(); }
}

// Database / auth errors in plain words.
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

/* ---------------- auth link handling (runs before Supabase starts) ----------------
   Our routes live in the hash (#/reset). Supabase adds its own fragment after the redirect URL, which gives
   "#/reset#access_token=…". Supabase can't read that, so we turn it back into "#access_token=…" and remember the route. */
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
  else if (ev === "SIGNED_OUT") { ME = null; setTimeout(render, 0); }
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

async function loadAll() {
  const uid = ME.id;
  const [ps, vs, sample] = await Promise.all([
    must(sb.from("purchases").select("id,pack_id,videos,created_at,expires_at").eq("user_id", uid)),
    must(sb.from("videos").select("id,purchase_id,title,notes,footage,status,result_url,delivered_at,created_at,due_at,version")
      .eq("user_id", uid).order("created_at", { ascending: false })),
    must(sb.from("sample_requests").select("id,video_url,moment,style,goal,status,preview_url,note,created_at,delivered_at,due_at")
      .eq("user_id", uid).limit(1)).then(r => r[0] || null),
  ]);
  return { videos: vs, sample, w: wallet(ps, vs) };
}

// Delivered files are links (Drive, YouTube, .mp4). Older deliveries may be a path in the private "finished" bucket.
async function resolveUrl(u) {
  u = String(u || "").trim();
  if (!u || /^https?:\/\//i.test(u)) return u;
  const { data, error } = await sb.storage.from("finished").createSignedUrl(u, 3600);
  return error ? "" : data.signedUrl;
}

/* ---------------- payment return ----------------
   Buy opens Stripe in a new tab. We remember how many purchases the account had, and show
   "Payment done?" until a new purchase shows up (the webhook adds it) or a day passes. */
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
const STATUS = { received: "Received", editing: "In edit", ready: "Ready", revision: "Changes requested", approved: "Approved" };
const SAMPLE_STATUS = { requested: "Requested", accepted: "Accepted", building: "Being made", ready: "Ready", declined: "Not this time" };
const chip = (s, labels = STATUS) => `<span class="st s-${esc(s)}">${esc(labels[s] || s)}</span>`;
const head = (title, sub = "") => `<div class="head"><h1>${title}</h1>${sub ? `<p class="lede">${sub}</p>` : ""}</div>`;

const SELLS = ["Coaching or consulting", "A course or program", "Physical products", "Software or an app", "Services", "Something else"];
const FREQ = ["Every day", "A few times a week", "Once a week", "Less often"];
const chips = (name, opts, val) => opts.map((o, i) =>
  `<label class="chip"><input type="radio" name="${name}" value="${esc(o)}"${o === val ? " checked" : ""}${i === 0 ? " required" : ""}><span>${esc(o)}</span></label>`).join("");

// Profile fields shared by onboarding and account.
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

/* ---------------- signed-out screens ---------------- */
function chromeOff() {
  $("#top").hidden = true; $("#tabbar").hidden = true; document.body.classList.remove("in");
}
function chromeOn(route) {
  $("#top").hidden = false; $("#tabbar").hidden = false; document.body.classList.add("in");
  $$("[data-nav]").forEach(a => { if (a.dataset.nav === route) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
}

const AUTH_COPY = {
  signup: ["Your Shorts, <em>in one place.</em>", "Create your account to ask for a free sample, see our packs and follow every Short."],
  login: ["Welcome <em>back.</em>", "Log in to see your Shorts and credits."],
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
    </div>`);
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

/* ---------------- home ---------------- */
function sampleDate(s) {
  if (s.status === "ready") return s.delivered_at ? `Delivered ${when(s.delivered_at)}` : "";
  if ((s.status === "accepted" || s.status === "building") && s.due_at) return expected(s.due_at);
  return s.status === "declined" ? "" : `Requested ${when(s.created_at)}`;
}
function sampleCard(s, w) {
  if (!s && w.count) return "";   // paying clients aren't nudged towards a free sample
  const btn = (href, label, primary) => `<a class="btn ${primary ? "primary" : "glass"} block" href="${href}">${label}</a>`;
  let body;
  if (!s) body = `<p>One free Short made from your video. It comes as a preview with a small mark.</p>${btn("#/sample", "Ask for your free sample", true)}`;
  else if (s.status === "requested") body = `<p>We review every request by hand. We'll email you and update this page.</p>${btn("#/sample", "See your request")}`;
  else if (s.status === "accepted" || s.status === "building") body = `<p>Your sample is being made. We deliver everything within 24 hours, usually faster.</p>${btn("#/sample", "See your request")}`;
  else if (s.status === "ready") body = `<p>Your sample is ready to watch.</p>${btn("#/sample", "Watch your sample", true)}`;
  else body = `<p>We left you a note about your sample.</p>${btn("#/sample", "Read the note")}`;
  const date = s ? sampleDate(s) : "";
  return `<section class="card" aria-labelledby="h-sample"><div class="card-h"><h2 id="h-sample">Free sample</h2>${s ? chip(s.status, SAMPLE_STATUS) : ""}</div>${date ? `<p class="when">${esc(date)}</p>` : ""}${body}</section>`;
}
const packName = id => (CFG.packs.find(p => p.id === id) || {}).name || "your pack";
function creditsCard(w) {
  const body = !w.total
    ? `<p class="big">0</p><p>No credits yet. Pick a pack and send us your first video.</p><a class="btn glass block" href="#/packs">See packs</a>`
    : `<p class="big">${w.left}<span> / ${w.total}</span></p>
       <p>${w.left ? `${plural(w.left, "Short")} left.${w.expires ? ` Next credits expire on ${esc(fmtDate(w.expires))}.` : ""}` : "All credits used. Get more any time."}</p>
       ${w.open.length > 1 ? `<ul class="expiries">${w.open.map(p => `<li>Credits from ${esc(packName(p.pack_id))} expire ${esc(fmtDate(p.exp))} <span>(${p.left} left)</span></li>`).join("")}</ul>` : ""}
       ${w.left ? `<a class="btn primary block" href="#/new">Start a new Short</a>` : `<a class="btn glass block" href="#/packs">Get more Shorts</a>`}`;
  return `<section class="card" aria-labelledby="h-credits"><div class="card-h"><h2 id="h-credits">Credits</h2></div>${body}</section>`;
}
function rowDate(v) {
  const vn = `v${Math.max(1, v.version || 1)}`;
  if (v.status === "received" || v.status === "editing") return expected(v.due_at, "Expected by", true) || `Requested ${whenShort(v.created_at)}`;
  if (v.status === "revision") return expected(v.due_at, "Changes due", true) || "Changes in progress";
  if (v.status === "ready") return v.delivered_at ? `${vn} delivered ${whenShort(v.delivered_at)}` : `${vn} delivered`;
  if (v.status === "approved") return v.delivered_at ? `Approved · ${vn} from ${dayShort(v.delivered_at)}` : "Approved";
  return "";
}
function shortsCard(videos, w) {
  const list = videos.length
    ? `<ul class="vlist">${videos.map(v => `<li><a href="#/v/${esc(v.id)}"><span class="vt"><b>${esc(v.title)}</b>
        <small>${esc(rowDate(v))}</small></span>${chip(v.status)}</a></li>`).join("")}</ul>`
    : `<div class="empty"><p>No Shorts yet. When you send us footage, your Shorts show up here.</p>
        ${w.left ? `<a class="btn glass" href="#/new">Send your first video</a>` : ""}</div>`;
  return `<section class="card wide" aria-labelledby="h-shorts"><div class="card-h"><h2 id="h-shorts">Your Shorts</h2>
    ${videos.length ? `<span class="count">${videos.length}</span>` : ""}</div>${list}</section>`;
}
function packsCta() {
  const from = CFG.showPrices ? Math.min(...CFG.packs.map(p => p.price)) : 0;
  return `<section class="card wide cta" aria-labelledby="h-packs"><div><h2 id="h-packs">Packs</h2>
    <p>${from ? `From $${esc(from)}. ` : ""}Delivered within 24 hours, usually faster.</p></div>
    <a class="btn primary" href="#/packs">See packs ${ic("arrow")}</a></section>`;
}
function home(D) {
  const n = firstName();
  view.innerHTML = head(`${greet()}${n ? `, <em>${esc(n)}.</em>` : "."}`, "Your sample, credits and Shorts, all in one place.") + `
    ${pendingHTML(D.pending)}
    <div class="grid home">
      ${sampleCard(D.sample, D.w)}
      ${creditsCard(D.w)}
      ${shortsCard(D.videos, D.w)}
      ${packsCta()}
    </div>
    <p class="foot">${callLink("Need a custom plan? Book a call")}</p>`;
}

/* ---------------- free sample ---------------- */
const CAPTIONS = ["Bold, word by word", "Clean subtitles", "Minimal", "No captions"];
function samplePage(D) {
  const s = D.sample;
  if (!s) return sampleForm();
  let state;
  if (s.status === "requested") state = `<p>We review every request by hand. We'll email you and update this page.</p>`;
  else if (s.status === "accepted" || s.status === "building") state = `<p>Your sample is being made. We deliver everything within 24 hours, usually faster.</p>`;
  else if (s.status === "ready") {
    const m = media(s.preview_url);
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
  x.searchParams.set("prefilled_email", ME.email || "");   // URLSearchParams encodes both values
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
    ${href ? `<a class="btn ${p.best ? "primary" : "glass"} block" href="${esc(href)}" target="_blank" rel="noopener" data-buy="${esc(p.id)}">${p.monthly ? `Start ${esc(p.name)}` : `Get ${plural(p.videos, "Short")}`}</a>`
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

/* ---------------- one Short ---------------- */
function parseTime(s) {
  s = String(s || "").trim();
  if (!s) return 0;
  if (/^\d{1,5}$/.test(s)) return Number(s);
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(s);
  if (!m || Number(m[3]) > 59 || (m[1] && Number(m[2]) > 59)) return null;
  return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}
// Dated history, oldest first: requested → v1 delivered → changes asked on v1 → v2 delivered → … → expected by / approved.
function timeline(v, versions, rounds) {
  const ev = [{ label: "Requested", at: v.created_at }];
  const asked = r => rounds.find(g => g.round === r);
  for (const ver of [...versions].reverse()) {
    const prev = asked(ver.version - 1);
    if (prev) ev.push({ label: `Changes asked on v${prev.round}`, at: prev.first });
    ev.push({ label: `v${ver.version} delivered`, at: ver.created_at });
  }
  const last = versions.length ? versions[0].version : 0, open = asked(last);
  if (open && last && v.status === "revision") ev.push({ label: `Changes asked on v${last}`, at: open.first });
  if (["received", "editing", "revision"].includes(v.status) && v.due_at) ev.push({ label: expected(v.due_at), due: true });
  if (v.status === "approved") ev.push({ label: "Approved" });
  return `<ol class="timeline" aria-label="History">${ev.map((e, i) => `<li class="${e.due ? "due" : ""}${i === ev.length - 1 ? " now" : ""}"${i === ev.length - 1 ? ` aria-current="step"` : ""}>
    <span class="dot" aria-hidden="true"></span><span>${esc(e.label)}${e.at ? ` <time>${esc(when(e.at))}</time>` : ""}</span></li>`).join("")}</ol>`;
}
const changeRow = i => `<div class="crow">
  <div class="field t"><label for="c-at-${i}">Time <span class="opt">(optional)</span></label>
    <input class="input" id="c-at-${i}" name="at" inputmode="numeric" maxlength="8" placeholder="0:12"></div>
  <div class="field"><label for="c-text-${i}">What should change?</label>
    <textarea class="input" id="c-text-${i}" name="text" maxlength="1000" placeholder="For example: cut this pause, make the captions bigger"></textarea></div>
</div>`;
function videoPage(v, notes, versions) {
  const cur = versions[0] || null, curM = cur ? media(cur.src) : null;
  const footage = String(v.footage || "").split(/\s+/).filter(Boolean);
  // change requests grouped by the version they were about (newest round first)
  const rounds = [...new Set(notes.map(n => n.round || 1))].sort((a, b) => b - a)
    .map(r => { const ns = notes.filter(n => (n.round || 1) === r).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
      return { round: r, notes: ns, first: ns[0].created_at }; });

  let side = "";
  if (v.status === "ready") side = `
    <section class="card" aria-labelledby="h-happy">
      <h2 id="h-happy">Happy with v${cur ? cur.version : 1}?</h2>
      <p>Approve it, or tell us what to change. Unlimited changes until you're happy.</p>
      <div class="row"><button class="btn primary" type="button" id="approve">Approve</button></div>
    </section>
    <form class="card form" id="cf" novalidate aria-labelledby="h-change">
      <h2 id="h-change">Request changes</h2>
      <div id="crows">${changeRow(0)}</div>
      <button class="linkish" type="button" id="addrow">+ Add another change</button>
      <button class="btn glass block" type="submit">Send changes</button>
      <p class="err" role="alert"></p>
    </form>`;
  else if (v.status === "revision") side = `<section class="card"><h2>We're on your changes</h2>
    ${v.due_at ? `<p class="when">${esc(expected(v.due_at))}</p>` : ""}
    <p>We deliver everything within 24 hours, usually faster. The new version shows up right here.</p></section>`;
  else if (v.status === "approved") side = `<section class="card"><h2>Approved</h2><p>Thank you. This Short is done.</p></section>`;
  else side = `<section class="card"><h2>${v.status === "received" ? "We have your footage" : "We're editing your Short"}</h2>
    ${v.due_at ? `<p class="when">${esc(expected(v.due_at))}</p>` : ""}
    <p>We deliver everything within 24 hours, usually faster.</p></section>`;

  const placeholder = `<div class="screen wait"><p>${v.status === "received" ? "We have your footage." : "We're editing your Short."}<br>It plays here when it's ready.</p></div>`;
  const playerFor = (m, label) => !m ? placeholder : m.kind === "link"
    ? `<div class="screen wait"><p>${esc(label)} is ready.</p>${extLink(m.href, "Open it", "btn primary")}</div>` : playerHTML(m, `${v.title} (${label})`);

  const versionList = versions.length ? `
    <section class="card" aria-labelledby="h-versions"><h2 id="h-versions">Versions</h2>
      <ul class="versions">${versions.map((x, i) => { const m = media(x.src);
        return `<li class="${i === 0 ? "current" : ""}${i === 0 ? " on" : ""}" data-vrow="${x.version}">
          <p><b>v${x.version}</b>${i === 0 ? ` <span class="st s-ready">Latest</span>` : ""}</p>
          <p class="hint">${esc(when(x.created_at))}${x.note ? ` · Fixed: ${esc(x.note)}` : x.version === 1 ? " · First version" : ""}</p>
          <div class="row">${m && m.kind !== "link" ? `<button class="btn glass sm" type="button" data-play="${x.version}" aria-pressed="${i === 0}">Play</button>` : ""}
            ${m ? extLink(m.href, "Open / download", "btn glass sm") : ""}</div></li>`; }).join("")}</ul>
    </section>` : "";

  view.innerHTML = `<a class="back" href="#/">${ic("back")}Home</a>
    <div class="head"><p>${chip(v.status)}</p><h1 class="title">${esc(v.title)}</h1></div>
    ${timeline(v, versions, rounds)}
    <div class="vgrid">
      <div class="vmedia" id="player">${playerFor(curM, cur ? `v${cur.version}` : "")}</div>
      <div class="stack">
        ${side}
        ${versionList}
        <section class="card" aria-labelledby="h-notes"><h2 id="h-notes">Changes you asked for</h2>
          ${rounds.length ? rounds.map(g => `<div class="round"><h3>Changes on v${g.round}</h3><ul class="notes">${g.notes.map(n => `<li>
              <span class="ts">${Number(n.at) > 0 ? esc(fmtTime(n.at)) : "General"}</span>
              <p class="pre">${esc(n.text)}</p>
              <p class="nstate">${n.done_at ? `<span class="done">${ic("check")}Done ${esc(when(n.done_at))}</span>` : `<span class="prog">In progress</span>`} · asked ${esc(when(n.created_at))}</p></li>`).join("")}</ul></div>`).join("")
            : `<p class="hint">No changes asked for yet.</p>`}
        </section>
        <section class="card" aria-labelledby="h-brief"><h2 id="h-brief">Your brief</h2>
          <dl class="facts">
            <dt>Footage</dt><dd>${footage.length ? `<ul class="links">${footage.map(f => `<li>${extLink(f)}</li>`).join("")}</ul>` : "—"}</dd>
            ${v.notes ? `<dt>Notes</dt><dd class="pre">${esc(v.notes)}</dd>` : ""}
          </dl></section>
      </div>
    </div>`;

  $$("[data-play]").forEach(b => b.onclick = () => {
    const x = versions.find(y => String(y.version) === b.dataset.play);
    $("#player").innerHTML = playerFor(media(x.src), `v${x.version}`);
    $$("[data-play]").forEach(o => o.setAttribute("aria-pressed", String(o === b)));
    $$("[data-vrow]").forEach(r => r.classList.toggle("on", r.dataset.vrow === b.dataset.play));
    if (window.matchMedia && matchMedia("(max-width: 899px)").matches) $("#player").scrollIntoView({ block: "start" });
  });
  const approve = $("#approve");
  if (approve) approve.onclick = async () => {
    if (!confirm("Approve this Short? It will be marked as done.")) return;
    busy(approve, true, "Approving…");
    try { await must(sb.from("videos").update({ status: "approved" }).eq("id", v.id).eq("user_id", ME.id)); toast("Approved. Thank you!"); render(); }
    catch (err) { busy(approve, false); toast(friendly(err), true); }
  };
  const form = $("#cf");
  if (!form) return;
  let rows = 1;
  $("#addrow").onclick = () => {
    if (rows >= 10) return toast("That's a lot of changes. Put the rest in one box.");
    $("#crows").insertAdjacentHTML("beforeend", changeRow(rows));
    $(`#c-at-${rows}`).focus(); rows++;
  };
  form.onsubmit = async e => {
    e.preventDefault();
    const out = [];
    for (const row of $$(".crow", form)) {
      const tIn = $("[name=at]", row), xIn = $("[name=text]", row), text = xIn.value.trim();
      if (!text && !tIn.value.trim()) continue;
      if (!text) return formErr(form, "Tell us what should change at that time.", xIn);
      const at = parseTime(tIn.value);
      if (at === null) return formErr(form, "Write the time like 0:45 or 1:02:30.", tIn);
      out.push({ video_id: v.id, user_id: ME.id, at, text });   // the database sets the round (= this version)
    }
    if (!out.length) return formErr(form, "Tell us what you'd like changed.", $("[name=text]", form));
    const btn = $("button[type=submit]", form);
    formErr(form, ""); busy(btn, true, "Sending…");
    try {
      await must(sb.from("video_notes").insert(out));   // notes first: the database only takes them while the Short is ready
      await must(sb.from("videos").update({ status: "revision" }).eq("id", v.id).eq("user_id", ME.id));
      toast("Sent. We're making your changes.");
      render();
    } catch (err) { busy(btn, false); formErr(form, friendly(err)); }
  };
}

/* ---------------- account ---------------- */
function account() {
  const crm = ME.is_admin === true ? safeUrl(CFG.crmUrl) : "";
  view.innerHTML = head("Account") + `
    <form id="acc" class="card form narrow" novalidate>
      <div class="field"><span class="label">Email</span><p class="static">${esc(ME.email)}</p></div>
      ${profileFields(ME, true)}
      <button class="btn primary block" type="submit">Save changes</button>
      <p class="err" role="alert"></p>
    </form>
    <section class="card narrow"><div class="row"><button class="btn glass" type="button" data-out>Sign out</button></div>
      ${crm ? `<p class="hint"><a class="link" href="${esc(crm)}">Founders' CRM</a></p>` : ""}</section>`;
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
}

/* ---------------- router ---------------- */
const LOADING = `<div class="loading" role="status"><span class="spin" aria-hidden="true"></span>Loading…</div>`;
function go(h) { if (location.hash === h) render(); else location.hash = h; }
function parseHash() {
  const [route = "", arg = ""] = location.hash.replace(/^#\/?/, "").split("/");
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
  const spin = setTimeout(() => { if (!stale()) view.innerHTML = LOADING; }, 200);
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (stale()) return;
    if (route === "reset") return resetView(!!session);
    if (!session) { ME = null; return authView(route === "login" || route === "forgot" ? route : "signup"); }
    if (!ME || ME.id !== session.user.id) {
      try { ME = await loadMe(session.user); }
      catch (err) {   // a dead session: sign out on this device and ask to log in again
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
    if (route === "login" || route === "signup" || route === "forgot") { history.replaceState(null, "", location.pathname + "#/"); return render(); }
    chromeOn(route);
    if (!ME.channel) return onboarding();
    if (route === "account") return account();

    const D = await loadAll();
    if (stale()) return;
    D.pending = pendingState(D.w);
    if (D.pending === "arrived") toast("Payment received. Your credits are here.");

    if (route === "v") {
      if (!UUID.test(arg)) return notFound();
      const v = D.videos.find(x => x.id === arg);
      if (!v) return notFound();
      const [notes, vers] = await Promise.all([
        must(sb.from("video_notes").select("id,at,text,created_at,round,done_at").eq("video_id", v.id).order("created_at")),
        must(sb.from("video_versions").select("id,version,url,note,created_at").eq("video_id", v.id).order("version", { ascending: false })),
      ]);
      // older deliveries may have no version rows: show the current file as the latest version
      if (!vers.length && v.result_url) vers.push({ version: Math.max(1, v.version || 1), url: v.result_url, note: null, created_at: v.delivered_at });
      await Promise.all(vers.map(async x => { x.src = await resolveUrl(x.url); }));
      if (stale()) return;
      return videoPage(v, notes, vers);
    }
    if (route === "sample") {
      if (D.sample && D.sample.status === "ready") D.sample.preview_url = await resolveUrl(D.sample.preview_url);
      if (stale()) return;
      return samplePage(D);
    }
    if (route === "packs") return packsPage(D);
    if (route === "new") return newPage(D);
    if (route !== "home") history.replaceState(null, "", location.pathname + "#/");
    return home(D);
  } catch (err) {
    if (!stale()) errorView(err);
  } finally {
    clearTimeout(spin);
    if (!stale()) {
      const key = location.hash;
      if (key !== LAST) { if (LAST) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); } LAST = key; }
    }
  }
}

// Buttons that appear on several screens.
view.addEventListener("click", async e => {
  const t = e.target.closest("[data-out],[data-retry],[data-refresh]");
  if (!t) return;
  if (t.matches("[data-retry]")) return render();
  if (t.matches("[data-refresh]")) { busy(t, true, "Checking…"); return render(); }
  busy(t, true, "Signing out…");
  await sb.auth.signOut({ scope: "local" });
  ME = null; store.del(PENDING);
  go("#/login");
});
// Back from the payment tab: check for new credits (only on screens without a form to lose).
document.addEventListener("visibilitychange", () => {
  if (document.hidden || !ME || !store.get(PENDING)) return;
  const [route] = parseHash();
  if (route === "home" || route === "packs") render();
});

sb.auth.getSession().then(() => {
  if (WANT && location.hash !== WANT) history.replaceState(null, "", location.pathname + location.search + WANT);
  window.addEventListener("hashchange", render);
  render();
});
})();
