/* Hifzhelper build 5.0 | js/sw.js */
// V5.0 — Sabaq Dhor date-aware suggestions and picker
const CACHE_NAME = 'hifzhelper-v5.0'; // V5.0 Sabaq Dhor planning
// Kept in sync with index.html's ?v= query strings (V3.6) so this list
// stays correct for whenever this service worker is actually registered
// (Level 2, not yet done) — it is currently inert, this is a
// no-behavior-change consistency edit only.
const ASSETS = [
  './js/maktabAttendanceReport.js?v=5.0',
  './index.html', './manifest.json', './js/pwaManifest.js?v=5.0', 'shared/data.js?v=5.0', 'shared/haidhRules.js?v=5.0', './appicons/logo.png',
  './css/tokens.css?v=5.0', './css/base.css?v=5.0', './css/nav.css?v=5.0', './css/journal-table.css?v=5.0', './css/daily-report.css?v=5.0',
  './css/components.css?v=5.0', './css/detail-pages.css?v=5.0', './css/settings.css?v=5.0', './css/admin.css?v=5.0',
  './css/haidh.css?v=5.0', './css/juzTracker.css?v=5.0', './css/sih.css?v=5.0',
  './js/icons.js?v=5.0', './js/customDate.js?v=5.0', './js/api.js?v=5.0', './js/logContext.js?v=5.0', './js/uiSwitch.js?v=5.0', './js/position.js?v=5.0',
  './js/auth.js?v=5.0', './js/home.js?v=5.0', './js/tajweed.js?v=5.0',
  './js/commentPrivacy.js?v=5.0', './js/maktabSummary.js?v=5.0', './js/maktabDailyReport.js?v=5.0', './js/maktabSettings.js?v=5.0', './js/maktabSetup.js?v=5.0', './js/maktabDay.js?v=5.0', './js/maktabJournal.js?v=5.0', './js/maktabCalendarPage.js?v=5.0', './js/maktabAttendancePage.js?v=5.0', './js/session-timer.js?v=5.0', './js/journal.js?v=5.0', './js/dhorPage.js?v=5.0',
  './js/sabaqPage.js?v=5.0', './js/sabaqDhorPage.js?v=5.0', './js/reflectionCard.js?v=5.0',
  './js/logDetailScreen.js?v=5.0', './js/haidhDetailScreen.js?v=5.0', './js/kaabaTracker.js?v=5.0',
  './js/juzTrackerScreen.js?v=5.0', './js/sihScreen.js?v=5.0', './assets/quran-heart.svg?v=5.0', './assets/quran-heart-regions.json?v=5.0', './assets/quran-heart-lines.svg?v=5.0',
  './js/settingsScreen.js?v=5.0', './js/adminPage.js?v=5.0', './js/app.js?v=5.0'
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
