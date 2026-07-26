const CACHE_NAME = 'hifzhelper-v3.4.3'; // bumped for the V3.4.3 release
const ASSETS = [
  './index.html', './manifest.json', 'shared/data.js', './appicons/logo.png',
  './css/tokens.css', './css/base.css', './css/nav.css', './css/journal-table.css',
  './css/components.css', './css/detail-pages.css', './css/admin.css',
  './js/icons.js', './js/api.js', './js/auth.js', './js/home.js', './js/tajweed.js',
  './js/commentPrivacy.js', './js/timer.js', './js/journal.js', './js/dhorPage.js',
  './js/sabaqPage.js', './js/sabaqDhorPage.js', './js/adminPage.js', './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
