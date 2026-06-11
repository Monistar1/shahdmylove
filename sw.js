/* ==========================================================
   LUXURY SERVICE WORKER
   Cache-First Static · Network-First Dynamic
   ========================================================== */

const CACHE_NAME = 'shahd-love-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/pin.html',
  '/countdown.html',
  '/hero.html',
  '/lily.html',
  '/gallery.html',
  '/balloons.html',
  '/fireworks.html',
  '/gift.html',
  '/letters.html',
  '/music.html',
  '/footer.html',
  '/css/core.css',
  '/js/core.js',
  '/js/auth.js',
  '/js/engine3d.js',
  '/js/reveal-engine.js',
  '/manifest.json'
];

const FONT_CACHE = 'shahd-fonts-v4';
const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Tajawal:wght@300;400;500;700;800&display=swap'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== FONT_CACHE)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: route-based strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Firebase / dynamic data: network first
  if (url.hostname.includes('firebaseio.com') || url.hostname.includes('gstatic.com')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Fonts: stale-while-revalidate
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  // Static assets: cache first
  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return cached || new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch {
    const cache = await caches.open(CACHE_NAME);
    return cache.match(request) || new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}
