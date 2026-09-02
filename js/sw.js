/* Hifzhelper build 4.2.12 | js/sw.js */
// Current as of V3.67.0
const CACHE_NAME = 'hifzhelper-v4.2.12'; // V4.2.12 Maktab Summary Quick Log trial
// Kept in sync with index.html's ?v= query strings (V3.6) so this list
// stays correct for whenever this service worker is actually registered
// (Level 2, not yet done) — it is currently inert, this is a
// no-behavior-change consistency edit only.
const ASSETS = [
  './index.html', './manifest.json', './js/pwaManifest.js?v=4.2.12', 'shared/data.js?v=4.2.12', 'shared/haidhRules.js?v=4.2.12', './appicons/logo.png',
  './css/tokens.css?v=4.2.12', './css/base.css?v=4.2.12', './css/nav.css?v=4.2.12', './css/journal-table.css?v=4.2.12',
  './css/components.css?v=4.2.12', './css/detail-pages.css?v=4.2.12', './css/settings.css?v=4.2.12', './css/admin.css?v=4.2.12',
  './css/haidh.css?v=4.2.12', './css/juzTracker.css?v=4.2.12', './css/sih.css?v=4.2.12',
  './js/icons.js?v=4.2.12', './js/customDate.js?v=4.2.12', './js/api.js?v=4.2.12', './js/logContext.js?v=4.2.12', './js/uiSwitch.js?v=4.2.12', './js/position.js?v=4.2.12',
  './js/auth.js?v=4.2.12', './js/home.js?v=4.2.12', './js/tajweed.js?v=4.2.12',
  './js/commentPrivacy.js?v=4.2.12', './js/maktabSummary.js?v=4.2.12', './js/maktabSettings.js?v=4.2.12', './js/maktabSetup.js?v=4.2.12', './js/maktabDay.js?v=4.2.12', './js/maktabJournal.js?v=4.2.12', './js/maktabCalendarPage.js?v=4.2.12', './js/maktabAttendancePage.js?v=4.2.12', './js/session-timer.js?v=4.2.12', './js/journal.js?v=4.2.12', './js/dhorPage.js?v=4.2.12',
  './js/sabaqPage.js?v=4.2.12', './js/sabaqDhorPage.js?v=4.2.12', './js/reflectionCard.js?v=4.2.12',
  './js/logDetailScreen.js?v=4.2.12', './js/haidhDetailScreen.js?v=4.2.12', './js/kaabaTracker.js?v=4.2.12',
  './js/juzTrackerScreen.js?v=4.2.12', './js/sihScreen.js?v=4.2.12', './assets/quran-heart.svg?v=4.2.12', './assets/quran-heart-regions.json?v=4.2.12', './assets/quran-heart-lines.svg?v=4.2.12',
  './js/settingsScreen.js?v=4.2.12', './js/adminPage.js?v=4.2.12', './js/app.js?v=4.2.12'
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
