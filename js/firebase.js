/* ==========================================================
   LUXURY FIREBASE INTEGRATION v4.0
   Offline Persistence · Optimistic UI · Retry · Rate Limit
   Connection State · Data Validation
   ========================================================== */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, push, onValue } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyAENc3TUjTBl47xSmIfuGYjBKxBWaMOVnE",
  authDomain: "yahya-90c6b.firebaseapp.com",
  databaseURL: "https://yahya-90c6b-default-rtdb.firebaseio.com",
  projectId: "yahya-90c6b",
  storageBucket: "yahya-90c6b.firebasestorage.app",
  messagingSenderId: "445642285585",
  appId: "1:445642285585:web:1e3fc3f66b35962aec87b0",
  measurementId: "G-HP5J23BW5Z"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const wishesRef = ref(db, 'wishes');

/* ==========================================================
   RATE LIMITING
   ========================================================== */
const RATE_LIMIT_MS = 3000; // 3 seconds between messages
const lastPushTimes = new Map(); // per-session rate limit

function checkRateLimit() {
  const now = Date.now();
  const sessionId = sessionStorage.getItem('_active_session') || 'anonymous';
  const lastPush = lastPushTimes.get(sessionId) || 0;
  if (now - lastPush < RATE_LIMIT_MS) {
    const wait = Math.ceil((RATE_LIMIT_MS - (now - lastPush)) / 1000);
    return { allowed: false, wait };
  }
  lastPushTimes.set(sessionId, now);
  return { allowed: true };
}

/* ==========================================================
   DATA VALIDATION
   ========================================================== */
function validateWish(wishData) {
  const errors = [];
  if (!wishData || typeof wishData !== 'object') {
    errors.push('Invalid data');
    return { valid: false, errors };
  }
  if (!wishData.text || typeof wishData.text !== 'string') {
    errors.push('Message is required');
  } else {
    const text = wishData.text.trim();
    if (text.length < 1) errors.push('Message cannot be empty');
    if (text.length > 500) errors.push('Message too long (max 500 chars)');
    // Sanitize: remove HTML tags
    wishData.text = text.replace(/<[^>]*>/g, '');
  }
  if (wishData.name && typeof wishData.name === 'string') {
    const name = wishData.name.trim();
    if (name.length > 50) errors.push('Name too long');
    wishData.name = name.replace(/<[^>]*>/g, '');
  }
  if (!wishData.timestamp) {
    wishData.timestamp = Date.now();
  }
  return { valid: errors.length === 0, errors, data: wishData };
}

/* ==========================================================
   PUSH WITH RETRY & OPTIMISTIC UI
   ========================================================== */
function pushWish(wishData, { onOptimistic, onSuccess, onError } = {}) {
  const rateCheck = checkRateLimit();
  if (!rateCheck.allowed) {
    const err = new Error(`Rate limited. Wait ${rateCheck.wait}s.`);
    if (onError) onError(err);
    return Promise.reject(err);
  }

  const validation = validateWish(wishData);
  if (!validation.valid) {
    const err = new Error(validation.errors.join(', '));
    if (onError) onError(err);
    return Promise.reject(err);
  }

  const cleanData = validation.data;

  // Optimistic update
  if (onOptimistic) {
    onOptimistic({ ...cleanData, _optimistic: true, _id: 'opt-' + Date.now() });
  }

  // Retry logic with exponential backoff
  return pushWithRetry(cleanData, 3)
    .then(result => {
      if (onSuccess) onSuccess(result);
      return result;
    })
    .catch(err => {
      if (onError) onError(err);
      throw err;
    });
}

function pushWithRetry(data, maxRetries, attempt = 1) {
  return push(wishesRef, data).catch(err => {
    if (attempt >= maxRetries) throw err;
    const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
    return new Promise(resolve => setTimeout(resolve, delay))
      .then(() => pushWithRetry(data, maxRetries, attempt + 1));
  });
}

/* ==========================================================
   REALTIME LISTENER WITH CONNECTION STATE
   ========================================================== */
function onWishUpdate(callback) {
  let isFirstLoad = true;

  const unsubscribe = onValue(wishesRef, (snapshot) => {
    const data = snapshot.val();
    const wishes = [];
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        wishes.push({ id: key, ...value });
      });
      wishes.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    }
    callback(wishes, { isFirstLoad });
    isFirstLoad = false;
  }, (err) => {
    console.error('Firebase listener error:', err);
    callback([], { error: err.message, isFirstLoad: false });
  });

  return unsubscribe;
}

/* ==========================================================
   CONNECTION STATE INDICATOR
   ========================================================== */
function initConnectionIndicator(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const dot = document.createElement('div');
  dot.className = 'connection-dot connecting';
  dot.setAttribute('aria-label', 'جاري الاتصال');
  dot.setAttribute('role', 'status');
  container.appendChild(dot);

  const connectedRef = ref(db, '.info/connected');
  const unsubscribe = onValue(connectedRef, (snap) => {
    const connected = snap.val();
    dot.className = connected ? 'connection-dot online' : 'connection-dot offline';
    dot.setAttribute('aria-label', connected ? 'متصل' : 'غير متصل');
  });

  return unsubscribe;
}

/* ==========================================================
   LOADING SKELETON
   ========================================================== */
function createSkeleton(type = 'text', count = 1) {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'skeleton';
    if (type === 'text') {
      el.style.cssText = 'height: 16px; width: ' + (70 + Math.random() * 30) + '%; border-radius: 4px;';
    } else if (type === 'avatar') {
      el.style.cssText = 'width: 40px; height: 40px; border-radius: 50%;';
    } else if (type === 'card') {
      el.style.cssText = 'height: 80px; width: 100%; border-radius: 12px;';
    }
    wrapper.appendChild(el);
  }
  return wrapper;
}

export { db, wishesRef, pushWish, onWishUpdate, initConnectionIndicator, createSkeleton };
