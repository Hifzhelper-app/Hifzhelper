const CACHE_NAME = 'hifzhelper-v3.34.9'; // bumped for the V3.34.9 release
// Kept in sync with index.html's ?v= query strings (V3.6) so this list
// stays correct for whenever this service worker is actually registered
// (Level 2, not yet done) — it is currently inert, this is a
// no-behavior-change consistency edit only.
const ASSETS = [
  './index.html', './manifest.json', './js/pwaManifest.js?v=3.34.9', 'shared/data.js?v=3.34.9', './appicons/logo.png',
  './css/tokens.css?v=3.34.9', './css/base.css?v=3.34.9', './css/nav.css?v=3.34.9', './css/journal-table.css?v=3.34.9',
  './css/components.css?v=3.34.9', './css/detail-pages.css?v=3.34.9', './css/settings.css?v=3.34.9', './css/admin.css?v=3.34.9',
  './js/icons.js?v=3.34.9', './js/customDate.js?v=3.34.9', './js/api.js?v=3.34.9', './js/uiSwitch.js?v=3.34.9', './js/position.js?v=3.34.9',
  './js/auth.js?v=3.34.9', './js/home.js?v=3.34.9', './js/tajweed.js?v=3.34.9',
  './js/commentPrivacy.js?v=3.34.9', './js/session-timer.js?v=3.34.9', './js/journal.js?v=3.34.9', './js/dhorPage.js?v=3.34.9',
  './js/sabaqPage.js?v=3.34.9', './js/sabaqDhorPage.js?v=3.34.9', './js/reflectionCard.js?v=3.34.9',
  './js/logDetailScreen.js?v=3.34.9', './js/settingsScreen.js?v=3.34.9', './js/adminPage.js?v=3.34.9', './js/app.js?v=3.34.9'
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
