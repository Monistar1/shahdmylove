/* ==========================================================
   LUXURY AUTH SYSTEM v4.0
   SHA-256 PIN · Encrypted Session · Route Guard · Lockout
   Haptic UX · Biometric Success Animation
   ========================================================== */

(function() {
  'use strict';

  const AUTH_KEY = '_shahd_session_v4';
  const PEPPER = 'shahd_love_2026';
  const SESSION_DURATION = 1000 * 60 * 60 * 4; // 4 hours
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION = 30000; // 30 seconds
  let cachedExpectedHash = null;
  let failedAttempts = parseInt(sessionStorage.getItem('_pin_failures') || '0');
  let isLocked = false;

  /* ---- Crypto ---- */
  async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text + PEPPER);
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return fallbackHash(text + PEPPER);
  }

  function fallbackHash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const hash = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
    return hash.padStart(64, '0');
  }

  function generateToken() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  }

  function encryptSession(token, expires) {
    const payload = JSON.stringify({ t: token, e: expires, n: Date.now() });
    let encrypted = '';
    for (let i = 0; i < payload.length; i++) {
      encrypted += String.fromCharCode(payload.charCodeAt(i) ^ PEPPER.charCodeAt(i % PEPPER.length));
    }
    return btoa(encrypted);
  }

  function decryptSession(str) {
    try {
      const decoded = atob(str);
      let decrypted = '';
      for (let i = 0; i < decoded.length; i++) {
        decrypted += String.fromCharCode(decoded.charCodeAt(i) ^ PEPPER.charCodeAt(i % PEPPER.length));
      }
      return JSON.parse(decrypted);
    } catch (e) { return null; }
  }

  /* ---- Lockout System ---- */
  function checkLockout() {
    const lockoutUntil = parseInt(sessionStorage.getItem('_pin_lockout') || '0');
    if (lockoutUntil && Date.now() < lockoutUntil) {
      isLocked = true;
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      showLockout(remaining);
      setTimeout(() => {
        isLocked = false;
        sessionStorage.removeItem('_pin_lockout');
        hideLockout();
      }, lockoutUntil - Date.now());
      return true;
    }
    isLocked = false;
    hideLockout();
    return false;
  }

  function showLockout(seconds) {
    const lockoutEl = document.getElementById('pinLockout');
    if (lockoutEl) {
      lockoutEl.textContent = `انتظر ${seconds} ثوانٍ`;
      lockoutEl.classList.add('show');
    }
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach(d => d.classList.add('locked'));
  }

  function hideLockout() {
    const lockoutEl = document.getElementById('pinLockout');
    if (lockoutEl) lockoutEl.classList.remove('show');
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach(d => d.classList.remove('locked'));
  }

  function triggerLockout() {
    const lockoutUntil = Date.now() + LOCKOUT_DURATION;
    sessionStorage.setItem('_pin_lockout', lockoutUntil.toString());
    sessionStorage.setItem('_pin_failures', '0');
    failedAttempts = 0;
    checkLockout();
  }

  /* ---- Haptic Visual Feedback ---- */
  function hapticPress(element) {
    element.style.transform = 'scale(0.92)';
    element.style.transition = 'transform 0.05s ease';
    setTimeout(() => {
      element.style.transform = '';
      element.style.transition = '';
    }, 80);
  }

  /* ---- Biometric Success Animation ---- */
  function showBiometricSuccess() {
    const lock = document.getElementById('heartLock');
    if (!lock) return;

    // Create ripple
    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position: absolute; inset: -20px; border-radius: 50%;
      border: 2px solid var(--accent-rose); opacity: 0.6;
      animation: ripple 0.8s ease-out forwards; pointer-events: none;
    `;
    lock.appendChild(ripple);
    setTimeout(() => ripple.remove(), 800);

    // Glow burst
    const burst = document.createElement('div');
    burst.style.cssText = `
      position: absolute; inset: -40px; border-radius: 50%;
      background: radial-gradient(circle, rgba(233, 30, 99, 0.3), transparent 60%);
      animation: scaleIn 0.6s var(--ease-out-back) forwards;
      pointer-events: none;
    `;
    lock.appendChild(burst);
    setTimeout(() => burst.remove(), 600);

    // Unlock animation
    lock.classList.add('unlocked');
  }

  /* ---- Session Expiry Warning ---- */
  function scheduleExpiryWarning() {
    const session = getSession();
    if (!session) return;

    const warningTime = session.e - (SESSION_DURATION - (SESSION_DURATION - 15 * 60 * 1000)); // 15 min before
    const now = Date.now();
    if (warningTime > now) {
      setTimeout(() => {
        showExpiryWarning();
      }, warningTime - now);
    }
  }

  function showExpiryWarning() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay show';
    modal.innerHTML = `
      <div class="modal-box" role="alertdialog" aria-modal="true" aria-labelledby="expiry-title">
        <h2 id="expiry-title" class="display-title display-title--3" style="margin-bottom: var(--space-md);">جلسة تنتهي قريباً</h2>
        <p style="color: var(--text-muted); margin-bottom: var(--space-lg);">ستنتهي جلستك خلال 15 دقيقة. هل تريد البقاء متصلاً؟</p>
        <div style="display: flex; gap: var(--space-md); justify-content: center;">
          <button class="btn btn--primary" id="extendSession">البقاء متصلاً</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('extendSession').addEventListener('click', () => {
      const session = getSession();
      if (session) {
        session.e = Date.now() + SESSION_DURATION;
        localStorage.setItem(AUTH_KEY, encryptSession(session.t, session.e));
      }
      modal.remove();
      scheduleExpiryWarning();
    });
  }

  function getSession() {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) return null;
    return decryptSession(stored);
  }

  /* ---- Public API ---- */
  window.AuthSystem = {
    async validatePin(pin) {
      if (isLocked) return { success: false, locked: true };
      if (!pin || pin.length < 4) return { success: false };

      const hash = await sha256(pin);
      if (!cachedExpectedHash) cachedExpectedHash = await sha256('1093109');

      if (hash !== cachedExpectedHash) {
        failedAttempts++;
        sessionStorage.setItem('_pin_failures', failedAttempts.toString());
        if (failedAttempts >= MAX_ATTEMPTS) {
          triggerLockout();
          return { success: false, locked: true };
        }
        return { success: false, remaining: MAX_ATTEMPTS - failedAttempts };
      }

      // Success
      failedAttempts = 0;
      sessionStorage.removeItem('_pin_failures');
      const expires = Date.now() + SESSION_DURATION;
      const token = generateToken();
      const session = encryptSession(token, expires);
      localStorage.setItem(AUTH_KEY, session);
      sessionStorage.setItem('_active_session', '1');
      showBiometricSuccess();
      scheduleExpiryWarning();
      return { success: true };
    },

    isAuthenticated() {
      const stored = localStorage.getItem(AUTH_KEY);
      if (!stored) return false;
      const session = decryptSession(stored);
      if (!session || !session.e) return false;
      if (Date.now() > session.e) {
        localStorage.removeItem(AUTH_KEY);
        return false;
      }
      return true;
    },

    guard() {
      const page = document.body.dataset.page;
      if (page === 'pin' || page === 'index') return;
      if (!this.isAuthenticated()) {
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = 'pin.html?return=' + returnUrl;
      }
    },

    logout() {
      localStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem('_active_session');
      sessionStorage.removeItem('_pin_failures');
      sessionStorage.removeItem('_pin_lockout');
      window.location.href = 'index.html';
    },

    getSessionInfo() {
      const session = getSession();
      if (!session) return null;
      const remaining = session.e - Date.now();
      return {
        expiresAt: session.e,
        remainingMs: remaining,
        remainingMinutes: Math.floor(remaining / 60000)
      };
    },

    checkLockout,
    hapticPress
  };

  // Auto-guard on load
  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    if (page !== 'pin' && page !== 'index') {
      AuthSystem.guard();
    }
    if (page === 'pin') {
      AuthSystem.checkLockout();
    }
    if (AuthSystem.isAuthenticated()) {
      scheduleExpiryWarning();
    }
  });
})();
