/* ==========================================================
   LUXURY AUDIO ENGINE v4.0
   Crossfade · Ambient · Ducking · Spatial
   ========================================================== */

(function() {
  'use strict';

  const AudioEngine = {
    ctx: null,
    gainNodes: new Map(),
    ambientGain: null,
    sfxGain: null,
    masterGain: null,
    isInitialized: false,
    ambientSource: null,

    init() {
      if (this.isInitialized) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.8;
        this.masterGain.connect(this.ctx.destination);

        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = 0;
        this.ambientGain.connect(this.masterGain);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.6;
        this.sfxGain.connect(this.masterGain);

        this.isInitialized = true;
      } catch (e) {
        console.warn('Web Audio API not supported');
      }
    },

    async load(url) {
      if (!this.ctx) this.init();
      if (!this.ctx) return null;
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        return audioBuffer;
      } catch (e) {
        console.warn('Audio load failed:', url);
        return null;
      }
    },

    play(buffer, { loop = false, fadeIn = 0, fadeOut = 0, gain = 1 } = {}) {
      if (!this.ctx || !buffer) return null;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;

      const gainNode = this.ctx.createGain();
      gainNode.gain.value = 0;
      source.connect(gainNode);
      gainNode.connect(this.masterGain);

      source.start();
      if (fadeIn > 0) {
        gainNode.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + fadeIn);
      } else {
        gainNode.gain.value = gain;
      }

      return { source, gainNode, fadeOut };
    },

    stop(instance) {
      if (!instance || !instance.source) return;
      const { source, gainNode, fadeOut } = instance;
      if (fadeOut > 0 && this.ctx) {
        gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fadeOut);
        setTimeout(() => {
          try { source.stop(); } catch (e) {}
        }, fadeOut * 1000);
      } else {
        try { source.stop(); } catch (e) {}
      }
    },

    async playAmbient(url) {
      if (!this.ctx) this.init();
      const buffer = await this.load(url);
      if (!buffer) return;
      if (this.ambientSource) this.stop(this.ambientSource);
      this.ambientSource = this.play(buffer, { loop: true, fadeIn: 3, gain: 0.3 });
    },

    fadeAmbient(to, duration = 2) {
      if (!this.ctx || !this.ambientGain) return;
      this.ambientGain.gain.linearRampToValueAtTime(to, this.ctx.currentTime + duration);
    },

    duck(duration = 0.5) {
      if (!this.ctx || !this.ambientGain) return;
      this.ambientGain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + duration);
    },

    unduck(duration = 1) {
      if (!this.ctx || !this.ambientGain) return;
      this.ambientGain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + duration);
    },

    playSfx(buffer) {
      if (!this.ctx) this.init();
      return this.play(buffer, { gain: 0.5, fadeIn: 0.05, fadeOut: 0.1 });
    }
  };

  window.AudioEngine = AudioEngine;
})();
