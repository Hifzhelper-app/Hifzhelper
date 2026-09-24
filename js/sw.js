/* Hifzhelper build 4.2.15.22 | js/sw.js */
// V4.2.15.22 — Sabaq Dhor date-aware suggestions and picker
const CACHE_NAME = 'hifzhelper-v4.2.15.22'; // V4.2.15.22 Sabaq Dhor planning
// Kept in sync with index.html's ?v= query strings (V3.6) so this list
// stays correct for whenever this service worker is actually registered
// (Level 2, not yet done) — it is currently inert, this is a
// no-behavior-change consistency edit only.
const ASSETS = [
  './js/maktabAttendanceReport.js?v=4.2.15.22',
  './index.html', './manifest.json', './js/pwaManifest.js?v=4.2.15.22', 'shared/data.js?v=4.2.15.22', 'shared/haidhRules.js?v=4.2.15.22', './appicons/logo.png',
  './css/tokens.css?v=4.2.15.22', './css/base.css?v=4.2.15.22', './css/nav.css?v=4.2.15.22', './css/journal-table.css?v=4.2.15.22', './css/daily-report.css?v=4.2.15.22',
  './css/components.css?v=4.2.15.22', './css/detail-pages.css?v=4.2.15.22', './css/settings.css?v=4.2.15.22', './css/admin.css?v=4.2.15.22',
  './css/haidh.css?v=4.2.15.22', './css/juzTracker.css?v=4.2.15.22', './css/sih.css?v=4.2.15.22',
  './js/icons.js?v=4.2.15.22', './js/customDate.js?v=4.2.15.22', './js/api.js?v=4.2.15.22', './js/logContext.js?v=4.2.15.22', './js/uiSwitch.js?v=4.2.15.22', './js/position.js?v=4.2.15.22',
  './js/auth.js?v=4.2.15.22', './js/home.js?v=4.2.15.22', './js/tajweed.js?v=4.2.15.22',
  './js/commentPrivacy.js?v=4.2.15.22', './js/maktabSummary.js?v=4.2.15.22', './js/maktabDailyReport.js?v=4.2.15.22', './js/maktabSettings.js?v=4.2.15.22', './js/maktabSetup.js?v=4.2.15.22', './js/maktabDay.js?v=4.2.15.22', './js/maktabJournal.js?v=4.2.15.22', './js/maktabCalendarPage.js?v=4.2.15.22', './js/maktabAttendancePage.js?v=4.2.15.22', './js/session-timer.js?v=4.2.15.22', './js/journal.js?v=4.2.15.22', './js/dhorPage.js?v=4.2.15.22',
  './js/sabaqPage.js?v=4.2.15.22', './js/sabaqDhorPage.js?v=4.2.15.22', './js/reflectionCard.js?v=4.2.15.22',
  './js/logDetailScreen.js?v=4.2.15.22', './js/haidhDetailScreen.js?v=4.2.15.22', './js/kaabaTracker.js?v=4.2.15.22',
  './js/juzTrackerScreen.js?v=4.2.15.22', './js/sihScreen.js?v=4.2.15.22', './assets/quran-heart.svg?v=4.2.15.22', './assets/quran-heart-regions.json?v=4.2.15.22', './assets/quran-heart-lines.svg?v=4.2.15.22',
  './js/settingsScreen.js?v=4.2.15.22', './js/adminPage.js?v=4.2.15.22', './js/app.js?v=4.2.15.22'
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
