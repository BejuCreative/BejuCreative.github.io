/* Applies the saved look before the first paint (CSP allows no inline script). crm.js owns the picker.
   11-24 (BENAS, phone app): the page background, the browser / home-screen theme colour and the iOS status bar follow the look from
   the first frame (CSSOM, allowed by the CSP), so a launch from the home screen never flashes white. */
(function () {
  var MODE = { frost: "light", graphite: "dark", forest: "dark", ocean: "dark", sunset: "dark" }, t = null, m = null;
  var BG = { frost: "#eef1f8", graphite: "#0b0c0e", forest: "#070805", ocean: "#041226", sunset: "#1a0e16" };
  try { t = localStorage.getItem("beju-crm-look"); m = localStorage.getItem("beju-crm-motion"); } catch (e) {}
  if (!MODE[t]) t = "frost";
  var h = document.documentElement;
  h.dataset.theme = t; h.dataset.mode = MODE[t]; h.dataset.motion = m === "calm" ? "calm" : "full";
  h.style.backgroundColor = BG[t];
  var tc = document.querySelector('meta[name="theme-color"]'), sb = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (tc) tc.content = BG[t];
  if (sb) sb.content = MODE[t] === "dark" ? "black-translucent" : "default";   // dark looks run under the status bar (white text on the dark page)
})();
