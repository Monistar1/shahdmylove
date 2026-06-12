/* ==========================================================
   FLOATING PETALS ENGINE v1.0
   Canvas 2D particle system — 60 FPS, mouse-reactive
   Design System Colors: #e91e63 #ff7a9e #ffc1d6 #ffb3c6
   ========================================================== */

(function() {
  'use strict';

  /* ── Canonical Color Tokens (mirrors css/core.css --petal-*) ── */
  const PALETTE = [
    '#e91e63',   // --petal-rose
    '#ff7a9e',   // --petal-pink
    '#ffc1d6',   // --petal-soft
    '#ffb3c6',   // --petal-blush
    '#ff4d7e',   // mid rose
    '#ffd6e0'    // pale blush
  ];

  class FloatingPetalsEngine {
    constructor(canvasId) {
      this.canvas = typeof canvasId === 'string'
        ? document.getElementById(canvasId)
        : canvasId;
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d');
      this.petals = [];
      // Adapt density to quality level
      const qualityClass = document.body.classList.contains('quality-low') ? 'low'
        : document.body.classList.contains('quality-medium') ? 'medium' : 'high';
      this.maxPetals = qualityClass === 'low' ? 6 : qualityClass === 'medium' ? 12 : 18;
      this.mouse = { x: -1000, y: -1000 };
      this.isActive = true;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.rafId = null;

      this.resize();
      this.initPetals();
      this.bindEvents();
      this.loop();
    }

    resize() {
      const w = this.canvas.offsetWidth || window.innerWidth;
      const h = this.canvas.offsetHeight || window.innerHeight;
      this.canvas.width = w * this.dpr;
      this.canvas.height = h * this.dpr;
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.w = w;
      this.h = h;
    }

    randomColor() {
      return PALETTE[Math.floor(Math.random() * PALETTE.length)];
    }

    createPetal() {
      return {
        x: Math.random() * this.w,
        y: -20 - Math.random() * 120,
        size: 6 + Math.random() * 10,
        speedY: 0.3 + Math.random() * 0.7,
        speedX: (Math.random() - 0.5) * 0.4,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.018,
        opacity: 0.25 + Math.random() * 0.35,
        color: this.randomColor(),
        swayFreq: 0.004 + Math.random() * 0.008,
        swayAmp: 15 + Math.random() * 35,
        time: Math.random() * 1000
      };
    }

    initPetals() {
      for (let i = 0; i < this.maxPetals; i++) {
        const p = this.createPetal();
        p.y = Math.random() * this.h;
        this.petals.push(p);
      }
    }

    drawPetal(p) {
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation);
      this.ctx.globalAlpha = p.opacity;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      // Elliptical petal shape
      this.ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      this.ctx.fill();
      // Subtle highlight
      this.ctx.globalAlpha = p.opacity * 0.4;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.ellipse(-p.size * 0.2, -p.size * 0.15, p.size * 0.3, p.size * 0.15, -0.3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    update() {
      this.petals.forEach(p => {
        p.time++;
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(p.time * p.swayFreq) * 0.25;
        p.rotation += p.rotSpeed;

        // Mouse repulsion (gentle)
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 140 && dist > 0.1) {
          p.x += (dx / dist) * 1.8;
          p.speedX += (dx / dist) * 0.008;
        }

        // Reset when off-screen
        if (p.y > this.h + 20 || p.x < -60 || p.x > this.w + 60) {
          Object.assign(p, this.createPetal());
          p.y = -20;
        }
      });
    }

    draw() {
      this.ctx.clearRect(0, 0, this.w, this.h);
      this.petals.forEach(p => this.drawPetal(p));
    }

    loop() {
      if (!this.isActive) { this.rafId = null; return; }
      if (!window.__FIREWORKS_ACTIVE__) {
        this.update();
        this.draw();
      }
      this.rafId = requestAnimationFrame(() => this.loop());
    }

    bindEvents() {
      window.addEventListener('resize', () => this.resize(), { passive: true });

      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
      }, { passive: true });

      this.canvas.addEventListener('mouseleave', () => {
        this.mouse.x = -1000;
        this.mouse.y = -1000;
      }, { passive: true });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.isActive = false;
          if (this.rafId) cancelAnimationFrame(this.rafId);
        } else {
          this.isActive = true;
          if (!this.rafId) this.loop();
        }
      });
    }

    destroy() {
      this.isActive = false;
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.petals = [];
      window.removeEventListener('resize', this.resize);
    }
  }

  window.FloatingPetalsEngine = FloatingPetalsEngine;
})();
