# Hifz Helper V4.2.15.6 — deployment / verification TODO

Baseline: **V4.2.15.5**. This package is a **changed-files-only overlay**.

## What changed

1. **Student Attendance → Haidh Settings**
   - The selected student's Attendance page now ends with the shared Haidh Settings controls.
   - It reuses the same Hanafi/Shafi'i, cycle frequency, Haidh duration and next-expected-date component/validation used by registration and User Management.
   - Saving regenerates the prediction plan while preserving confirmed Haidh history.
   - A new attendance-scoped Worker endpoint allows a teacher/admin to save the student already being edited; a student can only save herself.

2. **Attendance mobile column roll-up**
   - When Attendance % values are rolled up, the Attendance header rolls up as well.
   - The collapsed state is a narrow sticky icon-only control; opening restores the Attendance label/sort control and percentage values.

3. **Student Summary**
   - Removed the redundant **Maktab Summary** header button; X remains the return path.
   - Added a dedicated narrow action column at the extreme right of the activity grid.
   - Its header contains the Lucide circle-plus icon and opens the existing shared Log Quick Action.

4. **User Management rename**
   - Visible `Student Management` page/menu wording is now **User Management**.
   - Routes, IDs, APIs and data model are unchanged.

## Deployment order

### 1. Worker first
The release adds `/attendance/haidh-settings` and extends `/attendance/page` with the existing Haidh setup fields.

Deploy the changed Worker files using the normal Development Worker deployment process before publishing the frontend overlay.

Changed Worker files:
- `worker/src/index.js`
- `worker/src/maktabAttendance.js`

**No D1 migration is required.** The latest migration remains `0029`.

### 2. Frontend overlay
Publish the remaining changed frontend files on top of V4.2.15.5.

## Verification checklist

- Open a student's Attendance page from the Maktab Attendance register.
  - Scroll to the bottom and confirm Haidh Settings show the selected student's saved values.
  - Change/save settings and confirm the calendar prediction plan repaints without losing confirmed Haidh history.
- On a phone, open the Attendance register.
  - Default rolled-up state should show only the narrow Attendance icon control.
  - Tap it: Attendance label/sort + percentage values should open.
  - Tap again: both values and header should roll back up.
- Open an individual Student Summary.
  - Confirm there is no Maktab Summary button in the header.
  - Confirm the far-right grid header has the circle-plus action.
  - Tap it and confirm the existing Log Quick Action opens for that student/date.
- Confirm the menu/Home tile and page heading read **User Management**.

## Automated checks run for this build

- JavaScript syntax checks: passed for edited JS/Worker files.
- New V4.2.15.6 UI regression: **15 passed, 0 failed**.
- New V4.2.15.6 Haidh-settings backend regression: **7 passed, 0 failed**.
- Repository harnesses that reported results: **595 passed, 0 failed**.
- The same pre-existing harnesses that depend on unavailable `jsdom` or old incomplete DB fixtures do not report in this environment; they are not new V4.2.15.6 failures.
