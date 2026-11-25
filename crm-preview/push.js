/* BEJÚ founder CRM: iPhone notifications (Web Push). BENAS 11-25. The "Notifications" block in the account sheet
   (top-left name / brand button > account) and the service worker's door into the page.
   What it does: registers sw.js (scope /crm/); shows this device's status; "Enable notifications" (a tap = the permission
   prompt, then pushManager.subscribe with the public VAPID key, then public.push_sub_save); five per-device toggles
   (money, replies, sample yes, client changes, needs your OK: push_subs.events); "Send test" (edge function push-send, {test:true});
   "Turn off on this device". iOS shows push only for a home-screen web app (16.4+): in Safari it says "Add to Home Screen first".
   Needs supabase/crm_push1.sql + the push-send function in beju-v2; before they are live the block says "not switched on yet".
   crm.js calls window.BEJU_PUSH.section() inside the account sheet; clicks are handled here (data-push attributes, no data-act).
   A tap on a notification: sw.js focuses this window and posts {type:"beju-open", url}; this file opens that page (?p=, ?c=).
   The VAPID PUBLIC key (config.js vapidPublicKey) is public by design. CSP: no inline styles; sw.js is same-origin. */
(() => {
"use strict";
const KEY = (window.BEJU_CRM || {}).vapidPublicKey || "";
const EVENTS = [["money", "Money in", "A new payment"], ["reply", "Replies waiting", "A new reply needs an answer"],
  ["sample_yes", "Sample yes", "A lead said yes to the free Short"], ["client_changes", "Changes asked", "A client asked for changes"],
  ["approval", "Needs your OK", "A Claude needs a founder's OK (decisions and reply drafts)"]];
const UA = navigator.userAgent || "";
const IOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const STANDALONE = navigator.standalone === true || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
const CAN = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const esc = s => String(s ?? "").replace(/[&<>"'`]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" }[c]));
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const sb = () => window.BEJU_CRM_SB;

/* state of THIS device: setup = the database side is live; sub = the browser's push subscription; row = its push_subs row */
const S = { loaded: 0, loading: false, setup: true, sub: null, row: null, busy: "", msg: "", err: false };

/* ---------------- service worker ---------------- */
let REG = null;
if ("serviceWorker" in navigator) {
  try { navigator.serviceWorker.register("sw.js", { scope: "./" }).then(r => { REG = r; }).catch(() => {}); } catch {}
  navigator.serviceWorker.addEventListener("message", ev => {
    const d = ev.data; if (!d || d.type !== "beju-open" || typeof d.url !== "string") return;
    try {   // a tap on a notification: open the same page / client card as the link
      const u = new URL(d.url, location.href); if (u.origin !== location.origin) return;
      const p = u.searchParams.get("p") || "dashboard", extra = {}, c = u.searchParams.get("c"), id = u.searchParams.get("id"); if (c) extra.c = c; if (id && /^d?\d+$/.test(id)) extra.id = id;   // 11-25: ?p=approvals&id=<n> opens that approval
      if (window.BEJU_CRM_PAGE) window.BEJU_CRM_PAGE(p, extra);
    } catch {}
  });
}
const ready = () => Promise.race([navigator.serviceWorker.ready, new Promise((_, no) => setTimeout(() => no(new Error("The service worker did not start. Reload the CRM and try again.")), 8000))]);
const key64 = s => { const b = atob((s + "=".repeat((4 - s.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); };

/* ---------------- state ---------------- */
const missing = e => !!e && (/42P01|PGRST20[45]|does not exist|schema cache|Could not find the (table|function)/i.test(`${e.code || ""} ${e.message || ""}`));
async function refresh() {
  if (S.loading || !CAN || !KEY || (IOS && !STANDALONE) || !sb()) return;
  S.loading = true;
  try {
    const reg = await ready(); S.sub = await reg.pushManager.getSubscription(); S.row = null;
    if (S.sub) {
      const { data, error } = await sb().from("push_subs").select("events,disabled_at").eq("endpoint", S.sub.endpoint).maybeSingle();
      if (error) { if (missing(error)) S.setup = false; else throw error; }
      else {
        S.setup = true; S.row = data;
        if (!data || data.disabled_at) S.row = await save(S.sub, data ? data.events : null);   // the row was lost or the push service had retired it: save it again
      }
    } else {   // no device yet: is the database side there at all?
      const { error } = await sb().from("push_subs").select("id", { head: true, count: "exact" }).limit(1);
      S.setup = !error || !missing(error);
    }
  } catch (e) { S.msg = "Could not read the notification status."; S.err = true; }
  S.loaded = Date.now(); S.loading = false; paint();
}
async function save(sub, events) {
  const j = sub.toJSON(), k = j.keys || {};
  const { data, error } = await sb().rpc("push_sub_save", { p_endpoint: j.endpoint, p_p256dh: k.p256dh, p_auth: k.auth, p_ua: UA.slice(0, 300), p_events: events || null });
  if (error) throw error;
  return data;
}
const say = (m, err) => { S.msg = m; S.err = !!err; paint(); };

/* ---------------- the block ---------------- */
function body() {
  const perm = CAN ? Notification.permission : "unsupported", on = !!(S.sub && S.row && !S.row.disabled_at && perm === "granted");
  const chip = on ? `<span class="chip g">On for this device</span>` : perm === "denied" ? `<span class="chip r">Blocked</span>` : `<span class="chip">Off</span>`;
  const head = `<div class="grp"><span>Notifications</span><b>this device</b></div>`;
  const tile = (t, s, end = "") => `<div class="tile swrow"><span><b>${t}</b><small>${s}</small></span>${end}</div>`;
  if (!KEY) return head + tile("Not switched on yet", "The notification key is not set up in the CRM yet.");
  if (IOS && !STANDALONE) return head + tile("Add to Home Screen first", "In Safari tap Share, then Add to Home Screen. Open the CRM from the new icon, then come back here to turn notifications on.");
  if (!CAN) return head + tile("Not available here", "This browser can't show push notifications. On iPhone use the CRM from the home-screen icon (iOS 16.4 or newer).");
  if (!S.setup) return head + tile("Not switched on yet", "The server side of notifications is not live yet. Ask Benas's Claude to finish the set-up.");
  const note = S.msg ? `<p class="dr-txt" role="status" aria-live="polite">${esc(S.msg)}</p>` : "";
  if (perm === "denied") return head + tile("Blocked on this device", IOS ? "Open iPhone Settings, Notifications, BEJÚ and allow them, then come back." : "Allow notifications for this site in the browser settings, then come back.", chip) + note;
  if (!on) {
    return head + tile("Lock-screen alerts", "Money in, replies waiting, sample yes, changes asked and Needs your OK. Nothing sensitive: a name, an amount or a short question.", chip)
      + `<div class="acts sp"><button type="button" class="act go" data-push="enable"${S.busy ? " disabled" : ""}>${ic("bell")}${S.busy === "enable" ? "Turning on…" : "Enable notifications"}</button></div>` + note;
  }
  const ev = (S.row && S.row.events) || [];
  return head + tile("Notifications are on", "This device only. Each phone or computer has its own switches.", chip)
    + EVENTS.map(([k, t, s]) => `<div class="tile swrow"><span><b>${t}</b><small>${s}</small></span><button type="button" class="sw" role="switch" data-push="ev" data-e="${k}" aria-checked="${ev.includes(k)}" aria-label="${t}"${S.busy ? " disabled" : ""}></button></div>`).join("")
    + `<div class="acts sp"><button type="button" class="act" data-push="test"${S.busy ? " disabled" : ""}>${ic("bell")}${S.busy === "test" ? "Sending…" : "Send test"}</button><button type="button" class="act no" data-push="off"${S.busy ? " disabled" : ""}>Turn off on this device</button></div>` + note;
}
function paint() { const el = document.getElementById("push-box"); if (el) el.innerHTML = body(); }
function section() {   // crm.js: inside the account sheet. Rendered from what is known; a stale state is re-read in the background.
  if (!S.loading && Date.now() - S.loaded > 20000) setTimeout(refresh, 0);
  return `<div id="push-box">${body()}</div>`;
}

/* ---------------- actions ---------------- */
async function enable() {
  let perm; try { perm = await Notification.requestPermission(); } catch { perm = "default"; }   // first await, so it is still the tap that asks
  if (perm !== "granted") return say(perm === "denied" ? "Notifications were not allowed. You can change that in the phone's Settings." : "Notifications were not turned on.", perm === "denied");
  S.busy = "enable"; S.msg = ""; paint();
  try {
    const reg = await ready(); let sub = await reg.pushManager.getSubscription();
    const opts = { userVisibleOnly: true, applicationServerKey: key64(KEY) };
    try { if (!sub) sub = await reg.pushManager.subscribe(opts); }
    catch (e) { if (sub || e.name !== "InvalidStateError") throw e; await sub.unsubscribe(); sub = await reg.pushManager.subscribe(opts); }
    S.row = await save(sub, null); S.sub = sub; S.busy = ""; say("Notifications are on. Tap Send test to check.");
  } catch (e) {
    S.busy = ""; say(missing(e) ? "The server side of notifications is not live yet." : "Could not turn notifications on. Check your connection and try again.", true);
  }
}
async function toggle(k) {
  if (!S.sub || !S.row) return;
  const was = S.row.events || [], next = was.includes(k) ? was.filter(x => x !== k) : [...was, k];
  S.row = { ...S.row, events: next }; paint();
  const { error } = await sb().from("push_subs").update({ events: next }).eq("endpoint", S.sub.endpoint);
  if (error) { S.row = { ...S.row, events: was }; say("Could not save that switch. Try again.", true); }
}
async function test() {
  if (!S.sub) return; S.busy = "test"; S.msg = ""; paint();
  try {
    const { data, error } = await sb().functions.invoke("push-send", { body: { test: true, endpoint: S.sub.endpoint } });
    if (error) { let m = ""; try { m = (await error.context.json()).error || ""; } catch {} throw new Error(m || "The test did not go out."); }
    S.busy = ""; say(data && data.ok ? "Test sent. It should show on this device in a moment." : "The test did not go out.", !(data && data.ok));
  } catch (e) { S.busy = ""; say(String(e.message || "The test did not go out.").slice(0, 160), true); }
}
async function off() {
  if (!S.sub) return; S.busy = "off"; paint();
  const ep = S.sub.endpoint;
  try { await S.sub.unsubscribe(); await sb().from("push_subs").delete().eq("endpoint", ep); S.sub = null; S.row = null; S.busy = ""; say("Notifications are off on this device."); }
  catch { S.busy = ""; say("Could not turn them off. Try again.", true); }
}

document.addEventListener("click", ev => {
  const b = ev.target.closest && ev.target.closest("[data-push]"); if (!b || b.disabled) return;
  const a = b.dataset.push;
  if (a === "enable") enable(); else if (a === "ev") toggle(b.dataset.e); else if (a === "test") test(); else if (a === "off") off();
});

window.BEJU_PUSH = { section, refresh, get state() { return { setup: S.setup, subscribed: !!S.sub, events: S.row ? S.row.events : null, ios: IOS, standalone: STANDALONE, can: CAN }; } };
})();
