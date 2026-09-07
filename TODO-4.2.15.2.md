# Hifzhelper V4.2.15.2 — deployment / verification TODO

V4.2.15.2 is a changed-files overlay on V4.2.15.1.

## Deployment order

1. Deploy `worker/src/admin.js` first.
   - Student Management now reads and saves the existing Haidh setup fields through `/admin/users` and `/admin/update-user`.
   - Saving Haidh settings replaces only `predicted-haidh` rows and regenerates the prediction set with the shared Haidh rules; factual attendance/history is retained.
2. Deploy the frontend changed files.
3. No D1 migration or seed is required for V4.2.15.2.
4. Hard refresh / allow the V4.2.15.2 service-worker cache to replace the prior cache.

## Functional checks

- Maktab Summary → a student's Attendance icon opens the calendar in a popup rather than leaving the page.
- In the popup, select one date or a start/end range, choose **Mark as Haidh** or **Mark Absent**, then use the Save icon.
- Haidh saves use the existing Student Attendance Haidh endpoint/validation. Logged Maktab activity must continue to override Haidh/absence.
- Popup **Detail** opens that student's full Student Attendance page.
- Attendance register opens with the current week in view and can be swiped/scrolled horizontally to past and future weeks.
- Student sort chevron cycles: default → A–Z → Z–A → default.
- Attendance sort chevron cycles: default → term-wide descending → term-wide ascending → default.
- Default register ordering remains current-week active-day count descending, alphabetical ties, then Haidh A–Z, then absent A–Z.
- Manual Attendance ordering uses Term Start through Term End: active days first, then Attendance %, then alphabetical tie-break.
- Student Management has the Attendance-style header and a **Haidh Settings** column. Incomplete Haidh pills are muted; completed pills are active. Both open the same Haidh setup component used by registration.
- Individual Student Summary uses the Attendance-style header and includes **Ajzaa Completed** plus **Maktab Summary** navigation. Ajzaa Completed must open the same setup as the Dhor Detail action.

## Regression checks included

- `tests/verify_v42152_ui.mjs`
- `tests/verify_v42152_admin_haidh.mjs`
- Historical dependency-free V4.2.x regression pins were updated where their "current overlay" assumptions changed.
