/* ==========================================================
   LUXURY ROMANTIC ENGINE v4.0
   Cinematic Transitions · Cursor Follower · Scroll Progress
   Audio Crossfade · Reveal System · Page Preload
   ========================================================== */

(function() {
  'use strict';

  const CONFIG = {
    transitionDuration: 500,
    revealThreshold: 0.06,
    revealRootMargin: '0px 0px -40px 0px',
    cursorSmoothness: 0.12,
    cursorSize: 20
  };

  const state = {
    reducedMotion: false,
    isMobile: false,
    isTransitioning: false,
    cursorX: -100,
    cursorY: -100,
    cursorTargetX: -100,
    cursorTargetY: -100,
    cursorVelX: 0,
    cursorVelY: 0
  };

  /* ==========================================================
     INIT
     ========================================================== */
  function init() {
    detectCapabilities();
    initReveal();
    initPageTransitions();
    initCursorFollower();
    initScrollProgress();
    initAudioHelper();
    initActiveNav();
    initNavScroll();
    initPetals();
    initServiceWorker();
    initPrefetch();
  }

  function detectCapabilities() {
    state.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    state.isMobile = window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window || !window.matchMedia('(pointer: fine)').matches;
  }

  /* ==========================================================
     REVEAL ON SCROLL (IntersectionObserver)
     ========================================================== */
  function initReveal() {
    const reveals = document.querySelectorAll('.reveal, .reveal--left, .reveal--right, .reveal--scale, .reveal--rotate');
    if (!reveals.length) return;

    if (state.reducedMotion) {
      reveals.forEach(el => el.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: CONFIG.revealThreshold,
      rootMargin: CONFIG.revealRootMargin
    });

    reveals.forEach(el => observer.observe(el));
  }

  /* ==========================================================
     CINEMATIC PAGE TRANSITIONS
     ========================================================== */
  function initPageTransitions() {
    let overlay = document.querySelector('.page-transition-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'page-transition-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      document.body.appendChild(overlay);
    }

    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
      if (/\.(mp3|mp4|png|jpg|jpeg|webp|gif|svg|pdf|zip)(\?.*)?$/i.test(href)) return;

      link.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;
        if (state.isTransitioning) { e.preventDefault(); return; }

        e.preventDefault();
        state.isTransitioning = true;

        // Exit animation
        document.body.style.pointerEvents = 'none';
        overlay.classList.add('active');

        setTimeout(() => {
          window.location.href = href;
        }, CONFIG.transitionDuration);
      });

      // Prefetch on hover
      link.addEventListener('mouseenter', () => prefetchPage(href));
    });

    // Entrance animation on load
    if (!state.reducedMotion && !sessionStorage.getItem('_page_entered')) {
      sessionStorage.setItem('_page_entered', '1');
      overlay.classList.add('active');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          overlay.classList.remove('active');
          document.body.style.pointerEvents = '';
        });
      });
    } else {
      overlay.classList.remove('active');
      document.body.style.pointerEvents = '';
    }
  }

  const prefetched = new Set();
  function prefetchPage(href) {
    if (prefetched.has(href)) return;
    prefetched.add(href);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
  }

  function initPrefetch() {
    // Prefetch next likely pages based on current page
    const page = document.body.dataset.page;
    const nextPages = {
      'index': ['pin.html', 'countdown.html'],
      'pin': ['countdown.html'],
      'countdown': ['hero.html'],
      'hero': ['lily.html'],
      'lily': ['gallery.html'],
      'gallery': ['balloons.html'],
      'balloons': ['fireworks.html'],
      'fireworks': ['gift.html'],
      'gift': ['letters.html'],
      'letters': ['music.html'],
      'music': ['footer.html'],
      'footer': ['index.html']
    };

    (nextPages[page] || []).forEach(href => prefetchPage(href));
  }

  /* ==========================================================
     CURSOR FOLLOWER (Spring Physics)
     ========================================================== */
  function initCursorFollower() {
    if (state.isMobile || state.reducedMotion) return;

    // Disable on the fireworks page to avoid competing with the canvas loop
    if (document.body.dataset.page === 'fireworks') return;

    const follower = document.createElement('div');
    follower.className = 'cursor-follower';
    follower.setAttribute('aria-hidden', 'true');
    document.body.appendChild(follower);

    document.addEventListener('mousemove', (e) => {
      state.cursorTargetX = e.clientX;
      state.cursorTargetY = e.clientY;
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
      state.cursorTargetX = -100;
      state.cursorTargetY = -100;
    }, { passive: true });

    let frameCount = 0;
    let isInteractive = false;
    let cursorRafId = null;
    let isCursorActive = true;

    function updateCursor() {
      if (!isCursorActive || document.hidden) {
        cursorRafId = null;
        return;
      }

      // Spring physics
      const ax = (state.cursorTargetX - state.cursorX) * 0.08;
      const ay = (state.cursorTargetY - state.cursorY) * 0.08;
      state.cursorVelX += ax;
      state.cursorVelY += ay;
      state.cursorVelX *= 0.75;
      state.cursorVelY *= 0.75;
      state.cursorX += state.cursorVelX;
      state.cursorY += state.cursorVelY;

      follower.style.transform = `translate(${state.cursorX}px, ${state.cursorY}px) translate(-50%, -50%) translateZ(0)`;

      // Hit-test interactive elements only every 5 frames (expensive)
      frameCount++;
      if (frameCount % 5 === 0) {
        const el = document.elementFromPoint(state.cursorTargetX, state.cursorTargetY);
        isInteractive = el && (el.tagName === 'A' || el.tagName === 'BUTTON' || el.closest('a') || el.closest('button'));
      }

      follower.style.width = isInteractive ? '40px' : '20px';
      follower.style.height = isInteractive ? '40px' : '20px';
      const primaryRGB = '233, 30, 99';
      follower.style.background = isInteractive
        ? `radial-gradient(circle, rgba(${primaryRGB}, 0.3), transparent 70%)`
        : `radial-gradient(circle, rgba(${primaryRGB}, 0.15), transparent 70%)`;

      cursorRafId = requestAnimationFrame(updateCursor);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        isCursorActive = false;
        if (cursorRafId) cancelAnimationFrame(cursorRafId);
        cursorRafId = null;
      } else if (!cursorRafId) {
        isCursorActive = true;
        cursorRafId = requestAnimationFrame(updateCursor);
      }
    });

    cursorRafId = requestAnimationFrame(updateCursor);
  }

  /* ==========================================================
     SCROLL PROGRESS INDICATOR
     ========================================================== */
  function initScrollProgress() {
    const progress = document.createElement('div');
    progress.className = 'scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progress);

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docHeight > 0 ? scrollTop / docHeight : 0;
        progress.style.transform = `scaleX(${pct}) translateZ(0)`;
        ticking = false;
      });
    }, { passive: true });
  }

  /* ==========================================================
     AUDIO HELPER
     ========================================================== */
  function initAudioHelper() {
    window.CoreAudio = {
      fadeIn(audio, duration = 2000) {
        if (!audio) return;
        audio.volume = 0;
        audio.play().catch(() => {});
        const step = 0.02;
        const interval = duration * step;
        const timer = setInterval(() => {
          if (audio.volume < 0.8) {
            audio.volume = Math.min(0.8, audio.volume + step);
          } else {
            clearInterval(timer);
          }
        }, interval);
      },

      fadeOut(audio, duration = 2000) {
        if (!audio) return;
        const step = 0.02;
        const interval = duration * step;
        const timer = setInterval(() => {
          if (audio.volume > step) {
            audio.volume -= step;
          } else {
            audio.volume = 0;
            audio.pause();
            clearInterval(timer);
          }
        }, interval);
      },

      crossFade(fromAudio, toAudio, duration = 2000) {
        this.fadeOut(fromAudio, duration);
        this.fadeIn(toAudio, duration);
      }
    };
  }

  /* ==========================================================
     ACTIVE NAV HIGHLIGHT
     ========================================================== */
  function initActiveNav() {
    const currentPage = document.body.dataset.page;
    if (!currentPage) return;

    // Legacy cinematic-nav (bottom nav)
    let activeCinematicLink = null;
    document.querySelectorAll('.cinematic-nav .nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.includes(currentPage)) {
        link.classList.add('active');
        activeCinematicLink = link;
      } else {
        link.classList.remove('active');
      }
    });

    // On mobile, scroll the active cinematic-nav item into view so the indicator is never off-screen
    if (state.isMobile && activeCinematicLink) {
      setTimeout(() => {
        activeCinematicLink.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
      }, 100);
    }

    // Enhanced main-nav (top nav)
    document.querySelectorAll('.main-nav .nav-menu-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.includes(currentPage)) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });
  }

  /* ==========================================================
     NAV SCROLL DETECTION (Enhanced Navigation)
     ========================================================== */
  function initNavScroll() {
    const nav = document.querySelector('.main-nav');
    if (!nav) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrolled = window.scrollY > 20;
        nav.classList.toggle('scrolled', scrolled);
        ticking = false;
      });
    }, { passive: true });
  }

  /* ==========================================================
     FLOATING PETALS AUTO-INIT
     ========================================================== */
  function initPetals() {
    const canvas = document.getElementById('petalsCanvas');
    if (!canvas || !window.FloatingPetalsEngine) return;
    // Skip petals canvas on mobile to keep a single lightweight background
    if (state.isMobile) {
      canvas.style.display = 'none';
      return;
    }
    window._petalsEngine = new FloatingPetalsEngine(canvas);
  }

  /* ==========================================================
     SERVICE WORKER REGISTRATION
     ========================================================== */
  function initServiceWorker() {
    if ('serviceWorker' in navigator) {
      // Only register if sw.js exists — prevents console errors
      fetch('./sw.js', { method: 'HEAD', cache: 'no-store' })
        .then(res => {
          if (res.ok) {
            navigator.serviceWorker.register('./sw.js')
              .catch(() => {}); // Silently fail
          }
        })
        .catch(() => {});
    }
  }

  /* ==========================================================
     PUBLIC API
     ========================================================== */
  window.Core = {
    init,
    navigateTo(href) {
      const overlay = document.querySelector('.page-transition-overlay');
      if (overlay) {
        overlay.classList.add('active');
        setTimeout(() => { window.location.href = href; }, CONFIG.transitionDuration);
      } else {
        window.location.href = href;
      }
    },
    getTimeSince(date) {
      const now = new Date();
      const diff = now - new Date(date);
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60)
      };
    },
    animateNumber(el, target, duration = 1200) {
      if (state.reducedMotion) { el.textContent = target; return; }
      const start = performance.now();
      const from = parseInt(el.textContent.replace(/\D/g, '')) || 0;
      function tick(now) {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 4);
        const val = Math.round(from + (target - from) * eased);
        el.textContent = val.toLocaleString('ar-SA');
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
