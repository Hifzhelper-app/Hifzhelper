# Hifz Helper V4.2.15.1 — Deployment / Smoke Test TODO

This package is a **changed-files-only overlay on V4.2.15**.

## Deployment order

1. **Deploy the Worker change first**
   - `worker/src/admin.js`
   - No D1/schema migration is required. V4.2.15.1 uses the existing student Haidh columns and existing `attendance` table.

2. **Deploy the frontend changed files**
   - `index.html`
   - `css/admin.css`
   - `css/detail-pages.css`
   - `css/journal-table.css`
   - `css/settings.css`
   - `js/adminPage.js`
   - `js/api.js`
   - `js/maktabAttendancePage.js`
   - `js/sw.js`

3. The service-worker cache key is now `hifzhelper-v4.2.15.1`. If a device still shows the old UI after deployment, close/reopen the app or refresh once so the new cache takes over.

## Attendance smoke tests

- Maktab Summary: confirm **Attendance** is a forest-green rectangular button, not a pill, and opens Attendance.
- Attendance: confirm **Maktab Summary** is the matching forest-green rectangular button, not a pill, and returns to Maktab Summary.
- Confirm Attendance rows are numbered `1, 2, 3...` and renumber after manual sorting.
- Default order:
  1. Keep the existing first-level rule: more **actual active Maktab days in the current week** first.
  2. When active-day counts tie, students are now alphabetical (Attendance % is no longer the tie-breaker).
  3. With no current-week activity: Haidh alphabetically, then absent/unresolved alphabetically.
- Tap the Student/name chevron: confirm A→Z / Z→A sorting.
- Tap the Attendance % chevron: confirm Attendance % sorting within the factual status bands, with **actual activity always ahead of Haidh**, then absent/unresolved.

## Student Management / Haidh setup smoke tests

- Start **Register a student**.
- Select **Female**: Haaidha should become available.
- Select **Haaidha**: the Haidh setup should open with the same Personal Journal controls:
  - Hanafi / Shafi'i
  - Haidh cycle frequency (days)
  - How many haidh days per cycle
  - Next expected haidh day
- Confirm the shared Haidh limits are enforced before registration (10-day maximum; cycle frequency must preserve the 15-day purity interval).
- Register a valid Haaidha student and confirm the saved student profile contains the setup values and the expected predicted Haidh periods appear in Attendance.
- Open an existing student's Personal Journal Haidh setup and confirm **Haaidha + its confirmation checkbox are on the same row**.

## Regression checks completed for the build

- `node tests/verify_syntax.mjs` — clean.
- V4.2.15.1 focused UI regression — 15 passed, 0 failed.
- V4.2.15.1 admin/Haidh backend regression — 7 passed, 0 failed.
- Repository dependency-free/reporting harnesses — 544 passed, 0 failed.
- The repository still contains pre-existing harnesses that cannot execute in this source bundle because `jsdom` is not installed and several old fixture schemas are incomplete; these were already broken on the V4.2.15 baseline and are not V4.2.15.1 failures.
