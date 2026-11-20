/* The homepage's self-building intro: runs before swarm-motion.js (both deferred). The page is complete without either file.
   The pre-paint script in <head> sets "wv-motion" when motion is allowed, and "wv-loader-pending" on the first visit in a tab
   ("wv-return" after the page was built once, so a return or reload shows the finished page). This file keeps "wv-motion" in step
   with the visitor's settings and makes sure the pending class never outlives the opening, even if the motion script never runs. */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduced = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var forcedColors = window.matchMedia ? window.matchMedia("(forced-colors: active)") : null;
  var print = window.matchMedia ? window.matchMedia("print") : null;
  var nav = navigator, connection = nav.connection || {};
  var printing = false;
  function permitted() {
    return !printing && !(print && print.matches) && !(reduced && reduced.matches) &&
      !(forcedColors && forcedColors.matches) && !connection.saveData &&
      !(nav.deviceMemory && nav.deviceMemory <= 2) &&
      !(nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) &&
      "IntersectionObserver" in window;
  }
  function removeLoader() { root.classList.remove("wv-loader-pending", "wv-loader-leaving"); }
  function fadeLoader() {
    if (!root.classList.contains("wv-loader-pending") || root.classList.contains("wv-loader-leaving")) return;
    root.classList.add("wv-loader-leaving");
    setTimeout(removeLoader, 400);
  }
  if (root.classList.contains("wv-loader-pending") && permitted()) {
    var since = window.performance && performance.now ? performance.now() : 0;
    setTimeout(fadeLoader, Math.max(0, 3000 - since));
    ["wv-loader-release", "focusin", "pointerdown", "keydown", "wheel", "touchstart"].forEach(function (name) {
      document.addEventListener(name, fadeLoader, { passive: true });
    });
  } else removeLoader();
  function syncMotion() {
    var allowed = permitted();
    var changed = allowed !== root.classList.contains("wv-motion");
    root.classList.toggle("wv-motion", allowed);
    if (!allowed) removeLoader();
    if (changed) window.dispatchEvent(new Event("wv-motion-change"));
  }
  syncMotion();
  [reduced, forcedColors, print].forEach(function (media) {
    if (!media) return;
    if (media.addEventListener) media.addEventListener("change", syncMotion);
    else if (media.addListener) media.addListener(syncMotion);
  });
  if (connection.addEventListener) connection.addEventListener("change", syncMotion);
  window.addEventListener("beforeprint", function () { printing = true; syncMotion(); });
  window.addEventListener("afterprint", function () { printing = false; syncMotion(); });
  window.addEventListener("pageshow", syncMotion);
})();
