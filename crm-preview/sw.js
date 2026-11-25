/* BEJÚ founder CRM service worker (BENAS 11-25, iPhone notifications). Scope: /crm/. It does ONE job: Web Push.
   No fetch handler and no caching, so it can never serve old CRM code (update.js keeps the page fresh).
   push: shows the notification the server sent {title, body, tag, url, event}. iOS requires every push to show one, so a
     malformed payload still shows a plain "BEJÚ CRM" notification.
   notificationclick: focuses an open CRM window and tells it where to go (push.js opens the page / card); with no window open, opens the url.
   The url is relative to /crm/ (e.g. "?p=todos"). Nothing sensitive goes in a payload: a first name or an amount. */
"use strict";
const ICON = "icon-192.png";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { try { m = { body: e.data.text() }; } catch { m = {}; } }
  const title = String(m.title || "BEJÚ CRM").slice(0, 120);
  const opts = {
    body: String(m.body || "").slice(0, 200),
    icon: ICON, badge: ICON,
    tag: m.tag ? String(m.tag) : undefined,   // same tag = the phone replaces instead of stacking
    renotify: !!m.tag,
    data: { url: typeof m.url === "string" ? m.url : "./", event: m.event || "" },
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const mine = wins.find(w => w.url.startsWith(self.registration.scope));
    if (mine) {
      try { await mine.focus(); } catch {}
      mine.postMessage({ type: "beju-open", url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
