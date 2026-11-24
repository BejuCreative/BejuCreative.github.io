/* Self-update (BENAS 11-24: a tab open since the morning kept running old code after 6 deploys; the side menu sat in the wrong place
   until a hard refresh). Every 5 minutes, and whenever the tab comes back into view, this fetches ./index.html fresh (no-store) and
   compares the ?v= cache keys of its <script> / <link> tags with the ones this page was loaded with. A difference = a newer version is
   live: "update pending". The page then reloads itself ONLY at a safe moment:
     - the tab becomes visible again after being hidden, or
     - 60 s with no input (tap, key, scroll, wheel)
   and in both cases only when nothing is in progress: no open sheet / panel / drawer / dialog / editor, no 5-second Undo bar showing,
   focus not in a field, and no text field holding unsaved text. At most ONE reload per new key set (sessionStorage; a storage that
   throws = no automatic reload at all, so it can never loop). Offline = no check. Works the same in the iPhone home-screen app.
   Test hook: window.__BEJU_UPD = { every, idle, tick } (ms) set before this script runs. CSP: connect-src 'self' (index.html). */
(() => {
"use strict";
const CFG = Object.assign({ every: 5 * 6e4, idle: 6e4, tick: 5000 }, window.__BEJU_UPD || {});
const SS = "beju-crm-upd";
const keysOf = doc => [...doc.querySelectorAll("script[src],link[href]")].map(e => e.getAttribute("src") || e.getAttribute("href") || "")
  .filter(u => /[?&]v=/.test(u)).map(u => u.replace(/#.*$/, "")).sort().join("|");
let RUN = null, PENDING = null, LAST = performance.now(), BUSY = false, AT = 0, WAS_HIDDEN = false;

/* nothing in progress: no layer open, no Undo window, no field in use or holding text the founder typed */
const OPEN = "#cb-sheet,#cb-pan,#sm-pan,#fc-pan,#cb-undo,.cb-undo,.wof-undo,#drawer:not([hidden]),#veil:not([hidden]),#dlg:not([hidden]),#pal:not([hidden])";
const TEXT = 'textarea,input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="url"],input[type="tel"],input[type="password"],[contenteditable="true"]';
const TYPED = new Set();   // fields the founder typed into (a value a script set, like the Dashboard calculator's, is not unsaved text)
function calm() {
  try {
    const a = document.activeElement; if (a && a !== document.body && a.matches && a.matches(TEXT + ",select,input[type=\"number\"]")) return false;
    if (document.querySelector(OPEN) || [...document.querySelectorAll('[role="dialog"]')].some(e => e.getClientRects().length)) return false;   // any panel / sheet / dialog on screen
    for (const e of [...TYPED]) if (!e.isConnected) TYPED.delete(e);
    return ![...TYPED].some(e => e.isContentEditable ? !!e.textContent.trim() : !!String(e.value || "").trim());
  } catch { return false; }
}
function reload() {
  if (!PENDING) return;
  try { if (sessionStorage.getItem(SS) === PENDING) return; sessionStorage.setItem(SS, PENDING); } catch { return; }   // once per key set; no storage = never
  location.reload();
}
async function check() {
  if (BUSY || !RUN || (navigator.onLine === false)) return;
  BUSY = true; AT = performance.now();
  try {
    const r = await fetch("./index.html", { cache: "no-store", credentials: "same-origin" }); if (!r.ok) return;
    const live = keysOf(new DOMParser().parseFromString(await r.text(), "text/html"));
    if (live && live !== RUN) PENDING = live;
  } catch {} finally { BUSY = false; }
}
const poke = e => { LAST = performance.now(); if (e && e.type === "input" && e.target && e.target.matches && e.target.matches(TEXT)) TYPED.add(e.target); };
["pointerdown", "keydown", "touchstart", "wheel", "input"].forEach(t => addEventListener(t, poke, { capture: true, passive: true }));
addEventListener("scroll", poke, { capture: true, passive: true });
document.addEventListener("visibilitychange", async () => {
  if (document.hidden) { WAS_HIDDEN = true; return; }
  if (!WAS_HIDDEN) return; WAS_HIDDEN = false;
  if (performance.now() - AT > 3e4 || !PENDING) await check();   // back in view: look again (at most every 30 s)
  if (PENDING && calm()) reload();
});
const start = () => {
  RUN = keysOf(document);   // the tags this page was parsed with (anything added later is not part of the version)
  setInterval(check, CFG.every);
  setInterval(() => { if (PENDING && !document.hidden && performance.now() - LAST >= CFG.idle && calm()) reload(); }, CFG.tick);
};
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
