const CACHE_NAME = 'hifzhelper-v3.40'; // bumped for the V3.40 release
// Kept in sync with index.html's ?v= query strings (V3.6) so this list
// stays correct for whenever this service worker is actually registered
// (Level 2, not yet done) — it is currently inert, this is a
// no-behavior-change consistency edit only.
// V3.40: also restores haidh.css/shared/haidhRules.js/js/haidhDetailScreen.js,
// which V3.39 added to index.html but this list was never updated for —
// caught while touching this file for Juz Tracker's own new assets.
const ASSETS = [
  './index.html', './manifest.json', './js/pwaManifest.js?v=3.40', 'shared/data.js?v=3.40', 'shared/haidhRules.js?v=3.40', './appicons/logo.png',
  './css/tokens.css?v=3.40', './css/base.css?v=3.40', './css/nav.css?v=3.40', './css/journal-table.css?v=3.40',
  './css/components.css?v=3.40', './css/detail-pages.css?v=3.40', './css/settings.css?v=3.40', './css/admin.css?v=3.40',
  './css/haidh.css?v=3.40', './css/juzTracker.css?v=3.40',
  './js/icons.js?v=3.40', './js/customDate.js?v=3.40', './js/api.js?v=3.40', './js/uiSwitch.js?v=3.40', './js/position.js?v=3.40',
  './js/auth.js?v=3.40', './js/home.js?v=3.40', './js/tajweed.js?v=3.40',
  './js/commentPrivacy.js?v=3.40', './js/session-timer.js?v=3.40', './js/journal.js?v=3.40', './js/dhorPage.js?v=3.40',
  './js/sabaqPage.js?v=3.40', './js/sabaqDhorPage.js?v=3.40', './js/reflectionCard.js?v=3.40',
  './js/logDetailScreen.js?v=3.40', './js/haidhDetailScreen.js?v=3.40', './js/kaabaTracker.js?v=3.40',
  './js/settingsScreen.js?v=3.40', './js/adminPage.js?v=3.40', './js/app.js?v=3.40'
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
