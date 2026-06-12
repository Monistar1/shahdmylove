/* ==========================================================
   AI NARRATIVE ENGINE v1.0
   Dynamic storytelling flow & emotional pacing
   ========================================================== */

(function() {
  'use strict';

  const NARRATIVE = {
    scenes: [
      { id: 'index', name: 'البداية', emotion: 'anticipation', next: 'pin' },
      { id: 'pin', name: 'البوابة', emotion: 'mystery', next: 'countdown' },
      { id: 'countdown', name: 'الانتظار', emotion: 'longing', next: 'hero' },
      { id: 'hero', name: 'الملكة', emotion: 'admiration', next: 'lily' },
      { id: 'lily', name: 'حديقة اليلك', emotion: 'tenderness', next: 'gallery' },
      { id: 'gallery', name: 'الذكريات', emotion: 'nostalgia', next: 'balloons' },
      { id: 'balloons', name: 'البالونات', emotion: 'joy', next: 'fireworks' },
      { id: 'fireworks', name: 'الألعاب النارية', emotion: 'celebration', next: 'gift' },
      { id: 'gift', name: 'الهدية', emotion: 'surprise', next: 'letters' },
      { id: 'letters', name: 'الرسائل', emotion: 'intimacy', next: 'music' },
      { id: 'music', name: 'الموسيقى', emotion: 'romance', next: 'footer' },
      { id: 'footer', name: 'الخاتمة', emotion: 'eternity', next: 'index' }
    ],
    emotions: {
      anticipation: { hue: 320, speed: 0.8, music: 'calm' },
      mystery: { hue: 260, speed: 0.6, music: 'calm' },
      longing: { hue: 280, speed: 0.5, music: 'melancholy' },
      admiration: { hue: 340, speed: 0.9, music: 'romantic' },
      tenderness: { hue: 270, speed: 0.7, music: 'romantic' },
      nostalgia: { hue: 300, speed: 0.6, music: 'soft' },
      joy: { hue: 200, speed: 1.2, music: 'upbeat' },
      celebration: { hue: 40, speed: 1.4, music: 'celebration' },
      surprise: { hue: 350, speed: 1.0, music: 'romantic' },
      intimacy: { hue: 330, speed: 0.5, music: 'intimate' },
      romance: { hue: 310, speed: 0.6, music: 'romantic' },
      eternity: { hue: 290, speed: 0.4, music: 'eternal' }
    }
  };

  const state = {
    currentScene: null,
    sceneHistory: JSON.parse(sessionStorage.getItem('_narrative_history') || '[]'),
    startTime: parseInt(sessionStorage.getItem('_narrative_start') || Date.now(), 10),
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
  };

  function getCurrentScene() {
    const page = document.body.dataset.page || window.location.pathname.split('/').pop().replace('.html', '') || 'index';
    return NARRATIVE.scenes.find(s => s.id === page) || NARRATIVE.scenes[0];
  }

  function recordScene(scene) {
    if (!scene || state.sceneHistory[state.sceneHistory.length - 1] === scene.id) return;
    state.sceneHistory.push(scene.id);
    state.currentScene = scene;
    try {
      sessionStorage.setItem('_narrative_history', JSON.stringify(state.sceneHistory.slice(-20)));
      sessionStorage.setItem('_narrative_start', state.startTime.toString());
    } catch (e) { /* ignore */ }
  }

  function applyEmotion(scene) {
    const emotion = NARRATIVE.emotions[scene.emotion];
    if (!emotion || state.reducedMotion) return;

    document.documentElement.style.setProperty('--narrative-hue', emotion.hue);
    document.documentElement.style.setProperty('--narrative-speed', emotion.speed);

    // Subtle ambient tint to luxury-bg orb colors via CSS variables
    const root = document.documentElement;
    const tint = `hsla(${emotion.hue}, 70%, 60%,`;
    root.style.setProperty('--bg-orb-1', `${tint} ${0.08 + emotion.speed * 0.04})`);
    root.style.setProperty('--bg-orb-2', `${tint} ${0.05 + emotion.speed * 0.03})`);
  }

  function showSceneHint(scene) {
    // Optional: whisper the emotional theme via aria-live for screen readers
    const live = document.getElementById('narrative-live');
    if (live) {
      live.textContent = `المشهد الحالي: ${scene.name} — ${scene.emotion}`;
    }
  }

  function getNarrativeProgress() {
    const visited = new Set(state.sceneHistory);
    const total = NARRATIVE.scenes.length;
    return { visited: visited.size, total, percent: Math.round((visited.size / total) * 100) };
  }

  function init() {
    const scene = getCurrentScene();
    recordScene(scene);
    applyEmotion(scene);
    showSceneHint(scene);

    // Add live region if missing
    if (!document.getElementById('narrative-live')) {
      const live = document.createElement('div');
      live.id = 'narrative-live';
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
      live.className = 'sr-only';
      live.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;';
      document.body.appendChild(live);
    }

    // Dispatch narrative ready event
    window.dispatchEvent(new CustomEvent('narrative:ready', {
      detail: { scene, progress: getNarrativeProgress() }
    }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.NarrativeEngine = {
    getCurrentScene,
    getNarrativeProgress,
    get scenes() { return NARRATIVE.scenes; }
  };
})();
