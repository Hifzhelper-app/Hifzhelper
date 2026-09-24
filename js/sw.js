/* Hifzhelper build 4.2.15.24 | js/sw.js */
// V4.2.15.24 — Sabaq Dhor date-aware suggestions and picker
const CACHE_NAME = 'hifzhelper-v4.2.15.24'; // V4.2.15.24 Sabaq Dhor planning
// Kept in sync with index.html's ?v= query strings (V3.6) so this list
// stays correct for whenever this service worker is actually registered
// (Level 2, not yet done) — it is currently inert, this is a
// no-behavior-change consistency edit only.
const ASSETS = [
  './js/maktabAttendanceReport.js?v=4.2.15.24',
  './index.html', './manifest.json', './js/pwaManifest.js?v=4.2.15.24', 'shared/data.js?v=4.2.15.24', 'shared/haidhRules.js?v=4.2.15.24', './appicons/logo.png',
  './css/tokens.css?v=4.2.15.24', './css/base.css?v=4.2.15.24', './css/nav.css?v=4.2.15.24', './css/journal-table.css?v=4.2.15.24', './css/daily-report.css?v=4.2.15.24',
  './css/components.css?v=4.2.15.24', './css/detail-pages.css?v=4.2.15.24', './css/settings.css?v=4.2.15.24', './css/admin.css?v=4.2.15.24',
  './css/haidh.css?v=4.2.15.24', './css/juzTracker.css?v=4.2.15.24', './css/sih.css?v=4.2.15.24',
  './js/icons.js?v=4.2.15.24', './js/customDate.js?v=4.2.15.24', './js/api.js?v=4.2.15.24', './js/logContext.js?v=4.2.15.24', './js/uiSwitch.js?v=4.2.15.24', './js/position.js?v=4.2.15.24',
  './js/auth.js?v=4.2.15.24', './js/home.js?v=4.2.15.24', './js/tajweed.js?v=4.2.15.24',
  './js/commentPrivacy.js?v=4.2.15.24', './js/maktabSummary.js?v=4.2.15.24', './js/maktabDailyReport.js?v=4.2.15.24', './js/maktabSettings.js?v=4.2.15.24', './js/maktabSetup.js?v=4.2.15.24', './js/maktabDay.js?v=4.2.15.24', './js/maktabJournal.js?v=4.2.15.24', './js/maktabCalendarPage.js?v=4.2.15.24', './js/maktabAttendancePage.js?v=4.2.15.24', './js/session-timer.js?v=4.2.15.24', './js/journal.js?v=4.2.15.24', './js/dhorPage.js?v=4.2.15.24',
  './js/sabaqPage.js?v=4.2.15.24', './js/sabaqDhorPage.js?v=4.2.15.24', './js/reflectionCard.js?v=4.2.15.24',
  './js/logDetailScreen.js?v=4.2.15.24', './js/haidhDetailScreen.js?v=4.2.15.24', './js/kaabaTracker.js?v=4.2.15.24',
  './js/juzTrackerScreen.js?v=4.2.15.24', './js/sihScreen.js?v=4.2.15.24', './assets/quran-heart.svg?v=4.2.15.24', './assets/quran-heart-regions.json?v=4.2.15.24', './assets/quran-heart-lines.svg?v=4.2.15.24',
  './js/settingsScreen.js?v=4.2.15.24', './js/adminPage.js?v=4.2.15.24', './js/app.js?v=4.2.15.24'
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
