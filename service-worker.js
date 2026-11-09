// ============================================================
// RESTO PRO SERVICE WORKER (OFFLINE PWA CACHE)
// ============================================================
const CACHE_NAME = 'resto-pro-v2.5.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './customer_qr_self_order.html',
  './cashier_pos_register.html',
  './kitchen_display_kds.html',
  './owner_settings_saas.html',
  './assets/css/resto-theme.css',
  './assets/js/resto-data.js',
  './assets/js/resto-sync.js',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Pre-cache non-blocking warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        return networkResponse;
      }).catch(() => {
        if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
