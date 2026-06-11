/* ==========================================================
   LUXURY FPS MONITOR v4.0
   Performance HUD · Frame Time · Memory
   ========================================================== */

(function() {
  'use strict';

  const STATUS = {
    good: '#34d399',
    warn: '#fbbf24',
    bad:  '#f87171'
  };

  const FPS = {
    active: false,
    container: null,
    frames: 0,
    lastTime: 0,
    fps: 60,
    frameTime: 16,
    animId: null,

    init() {
      if (this.active || window.location.search.includes('nofps')) return;
      this.active = true;

      this.container = document.createElement('div');
      this.container.style.cssText = `
        position: fixed; top: 8px; right: 8px; z-index: 9999;
        background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
        border-radius: 8px; padding: 8px 12px;
        font-family: var(--font-mono, monospace);
        font-size: 11px; color: white; line-height: 1.5;
        pointer-events: none; opacity: 0; transition: opacity 0.3s;
        min-width: 80px;
      `;
      this.container.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;">
          <span id="fps-val" style="font-weight:700;color:${STATUS.good};">60</span>
          <span style="opacity:0.6;">FPS</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:2px;">
          <span id="ms-val" style="color:${STATUS.warn};">16</span>
          <span style="opacity:0.6;">ms</span>
        </div>
      `;
      document.body.appendChild(this.container);

      // Show after 2s (don't distract on load)
      setTimeout(() => { this.container.style.opacity = '1'; }, 2000);

      this.lastTime = performance.now();
      this.loop();
    },

    loop() {
      if (!this.active) return;
      this.animId = requestAnimationFrame(() => this.loop());
      const now = performance.now();
      this.frames++;

      if (now >= this.lastTime + 1000) {
        this.fps = Math.round((this.frames * 1000) / (now - this.lastTime));
        this.frameTime = Math.round((now - this.lastTime) / this.frames);
        this.frames = 0;
        this.lastTime = now;

        const fpsEl = document.getElementById('fps-val');
        const msEl = document.getElementById('ms-val');
        if (fpsEl) {
          fpsEl.textContent = this.fps;
          fpsEl.style.color = this.fps >= 55 ? STATUS.good : this.fps >= 30 ? STATUS.warn : STATUS.bad;
        }
        if (msEl) msEl.textContent = this.frameTime;
      }
    },

    destroy() {
      this.active = false;
      if (this.animId) cancelAnimationFrame(this.animId);
      if (this.container) this.container.remove();
    }
  };

  window.FPSMonitor = FPS;
})();
