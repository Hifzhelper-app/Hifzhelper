const CACHE_NAME = 'hifzhelper-v3.3.2.4'; // bumped: index.html/manifest.json/sw.js moved to the deployment root
const ASSETS = [
  './index.html', './manifest.json', 'shared/data.js',
  './css/tokens.css', './css/base.css', './css/nav.css', './css/journal-table.css', './css/components.css',
  './js/icons.js', './js/api.js', './js/auth.js', './js/home.js', './js/journal.js', './js/app.js'
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
