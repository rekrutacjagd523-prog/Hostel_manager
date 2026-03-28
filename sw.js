const CACHE_NAME = 'lokum-v10';
const PRECACHE = [
  '/',
  '/index.html'
];

// Install — cache shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate — delete old caches, keep current
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — ALWAYS network first, no caching of JS modules
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (e.request.method !== 'GET') return;
  if (url.hostname.includes('googleapis.com')) return;
  if (url.hostname.includes('gstatic.com')) return;
  if (url.hostname.includes('firebaseapp.com')) return;
  if (url.hostname.includes('unpkg.com')) return;
  if (url.hostname.includes('cdnjs.cloudflare.com')) return;

  // Never cache JS modules — always fetch fresh
  if (url.pathname.endsWith('.js')) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response.ok && url.protocol === 'https:') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
