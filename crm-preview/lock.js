/* Phone app lock (BENAS 11-24: "locked like an expensive app, no ability to zoom in"). iOS ignores user-scalable=no in the viewport
   meta, so the zoom gestures are stopped here too: Safari's gesture events, any two-finger move and any move that scales.
   Double-tap zoom is off through touch-action in crm.css. Loaded in <head>, before anything can be touched. */
(function () {
  var stop = function (e) { if (e.cancelable) e.preventDefault(); };
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (t) { document.addEventListener(t, stop, { passive: false }); });
  document.addEventListener("touchmove", function (e) { if ((e.touches && e.touches.length > 1) || (typeof e.scale === "number" && e.scale !== 1)) stop(e); }, { passive: false });
})();
