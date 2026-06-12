/* ==========================================================
   FPS MONITOR SHIM
   Prevents ReferenceError when pages call FPSMonitor.init().
   ========================================================== */
(function() {
  'use strict';
  window.FPSMonitor = {
    init() {},
    start() {},
    stop() {},
    destroy() {}
  };
})();
