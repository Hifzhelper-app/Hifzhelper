/* Hifzhelper build 4.2.15.21 | js/sw.js */
// V4.2.15.21 — Sabaq Dhor date-aware suggestions and picker
const CACHE_NAME = 'hifzhelper-v4.2.15.21'; // V4.2.15.21 Sabaq Dhor planning
// Kept in sync with index.html's ?v= query strings (V3.6) so this list
// stays correct for whenever this service worker is actually registered
// (Level 2, not yet done) — it is currently inert, this is a
// no-behavior-change consistency edit only.
const ASSETS = [
  './js/maktabAttendanceReport.js?v=4.2.15.21',
  './index.html', './manifest.json', './js/pwaManifest.js?v=4.2.15.21', 'shared/data.js?v=4.2.15.21', 'shared/haidhRules.js?v=4.2.15.21', './appicons/logo.png',
  './css/tokens.css?v=4.2.15.21', './css/base.css?v=4.2.15.21', './css/nav.css?v=4.2.15.21', './css/journal-table.css?v=4.2.15.21', './css/daily-report.css?v=4.2.15.21',
  './css/components.css?v=4.2.15.21', './css/detail-pages.css?v=4.2.15.21', './css/settings.css?v=4.2.15.21', './css/admin.css?v=4.2.15.21',
  './css/haidh.css?v=4.2.15.21', './css/juzTracker.css?v=4.2.15.21', './css/sih.css?v=4.2.15.21',
  './js/icons.js?v=4.2.15.21', './js/customDate.js?v=4.2.15.21', './js/api.js?v=4.2.15.21', './js/logContext.js?v=4.2.15.21', './js/uiSwitch.js?v=4.2.15.21', './js/position.js?v=4.2.15.21',
  './js/auth.js?v=4.2.15.21', './js/home.js?v=4.2.15.21', './js/tajweed.js?v=4.2.15.21',
  './js/commentPrivacy.js?v=4.2.15.21', './js/maktabSummary.js?v=4.2.15.21', './js/maktabDailyReport.js?v=4.2.15.21', './js/maktabSettings.js?v=4.2.15.21', './js/maktabSetup.js?v=4.2.15.21', './js/maktabDay.js?v=4.2.15.21', './js/maktabJournal.js?v=4.2.15.21', './js/maktabCalendarPage.js?v=4.2.15.21', './js/maktabAttendancePage.js?v=4.2.15.21', './js/session-timer.js?v=4.2.15.21', './js/journal.js?v=4.2.15.21', './js/dhorPage.js?v=4.2.15.21',
  './js/sabaqPage.js?v=4.2.15.21', './js/sabaqDhorPage.js?v=4.2.15.21', './js/reflectionCard.js?v=4.2.15.21',
  './js/logDetailScreen.js?v=4.2.15.21', './js/haidhDetailScreen.js?v=4.2.15.21', './js/kaabaTracker.js?v=4.2.15.21',
  './js/juzTrackerScreen.js?v=4.2.15.21', './js/sihScreen.js?v=4.2.15.21', './assets/quran-heart.svg?v=4.2.15.21', './assets/quran-heart-regions.json?v=4.2.15.21', './assets/quran-heart-lines.svg?v=4.2.15.21',
  './js/settingsScreen.js?v=4.2.15.21', './js/adminPage.js?v=4.2.15.21', './js/app.js?v=4.2.15.21'
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
