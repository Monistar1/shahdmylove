/* ==========================================================
   SELF-EVOLVING PERFORMANCE & STABILITY ENGINE v1.0
   Monitors FPS, errors, and adapts quality in real time
   ========================================================== */

(function() {
  'use strict';

  const CONFIG = {
    fpsSampleCount: 30,
    lowFpsThreshold: 45,
    criticalFpsThreshold: 30,
    adaptCooldownMs: 5000,
    logKey: '_self_evolve_log'
  };

  const state = {
    frameTimes: [],
    lastFrameTime: performance.now(),
    averageFps: 60,
    quality: 'high', // high | medium | low
    lastAdapt: 0,
    errors: [],
    log: []
  };

  let rafId = null;
  let adaptIntervalId = null;

  function loadLog() {
    try {
      state.log = JSON.parse(localStorage.getItem(CONFIG.logKey) || '[]');
    } catch (e) { state.log = []; }
  }

  function saveLog() {
    try {
      localStorage.setItem(CONFIG.logKey, JSON.stringify(state.log.slice(-50)));
    } catch (e) { /* ignore */ }
  }

  function pushLog(entry) {
    state.log.push(entry);
    saveLog();
  }

  function measureFps() {
    rafId = null;
    if (document.hidden) return;

    const now = performance.now();
    const delta = now - state.lastFrameTime;
    state.lastFrameTime = now;
    if (delta > 0) {
      state.frameTimes.push(1000 / delta);
      if (state.frameTimes.length > CONFIG.fpsSampleCount) {
        state.frameTimes.shift();
      }
      const avg = state.frameTimes.reduce((a, b) => a + b, 0) / state.frameTimes.length;
      state.averageFps = avg;
    }
    rafId = requestAnimationFrame(measureFps);
  }

  function startMeasureFps() {
    if (rafId) return;
    state.lastFrameTime = performance.now();
    rafId = requestAnimationFrame(measureFps);
  }

  function stopMeasureFps() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function adaptQuality() {
    const now = Date.now();
    if (now - state.lastAdapt < CONFIG.adaptCooldownMs) return;

    const fps = state.averageFps;
    let target = state.quality;

    if (fps < CONFIG.criticalFpsThreshold) {
      target = 'low';
    } else if (fps < CONFIG.lowFpsThreshold) {
      target = state.quality === 'high' ? 'medium' : 'low';
    } else if (fps > 55 && state.quality === 'low') {
      target = 'medium';
    } else if (fps > 58 && state.quality === 'medium') {
      target = 'high';
    }

    if (target !== state.quality) {
      state.quality = target;
      state.lastAdapt = now;
      applyQuality(target);
      pushLog({ type: 'quality', value: target, fps: Math.round(fps), time: now });
      window.dispatchEvent(new CustomEvent('selfevolve:quality', { detail: { quality: target, fps } }));
    }
  }

  function applyQuality(level) {
    const body = document.body;
    body.classList.remove('quality-high', 'quality-medium', 'quality-low');
    body.classList.add('quality-' + level);
  }

  function initErrorCapture() {
    window.addEventListener('error', (e) => {
      const entry = { type: 'error', message: e.message, file: e.filename, line: e.lineno, time: Date.now() };
      state.errors.push(entry);
      pushLog(entry);
    });

    window.addEventListener('unhandledrejection', (e) => {
      const entry = { type: 'rejection', message: String(e.reason), time: Date.now() };
      state.errors.push(entry);
      pushLog(entry);
    });
  }

  function startAdaptQuality() {
    if (adaptIntervalId) return;
    adaptIntervalId = setInterval(adaptQuality, 1000);
  }

  function stopAdaptQuality() {
    if (adaptIntervalId) {
      clearInterval(adaptIntervalId);
      adaptIntervalId = null;
    }
  }

  function initVisibilityThrottling() {
    document.addEventListener('visibilitychange', () => {
      const hidden = document.hidden;
      document.body.classList.toggle('page-hidden', hidden);
      pushLog({ type: 'visibility', hidden, time: Date.now() });

      // Pause expensive background animations when tab hidden
      if (hidden) {
        document.documentElement.style.setProperty('--animation-play-state', 'paused');
        stopMeasureFps();
        stopAdaptQuality();
      } else {
        document.documentElement.style.removeProperty('--animation-play-state');
        startMeasureFps();
        startAdaptQuality();
      }
    });
  }

  function getInitialQuality() {
    // Start conservative on low-end devices
    const memory = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && (memory < 4 || cores < 4)) return 'medium';
    if (memory < 4 || cores < 2) return 'low';
    // Use last known quality from previous session
    const last = state.log.slice(-1)[0];
    if (last && last.type === 'quality') return last.value;
    return 'high';
  }

  function init() {
    loadLog();
    applyQuality(getInitialQuality());
    initErrorCapture();
    initVisibilityThrottling();
    startMeasureFps();
    startAdaptQuality();

    window.SelfEvolve = {
      get fps() { return Math.round(state.averageFps); },
      get quality() { return state.quality; },
      get errors() { return state.errors.slice(); },
      get log() { return state.log.slice(); },
      report: (detail) => pushLog({ type: 'report', detail, time: Date.now() })
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
