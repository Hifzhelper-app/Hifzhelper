# Hifz Helper V4.2.15.7 — deployment / verification TODO

Baseline: **V4.2.15.6**. This package is a **changed-files-only overlay**.

## What changed

1. **Hifz class Zoom link**
   - Admin can set/clear one Hifz class Zoom URL in **Maktab Settings**.
   - Only `https://` URLs are accepted.
   - When configured, a centred blue (`#0B5CFF`) **ZOOM** button appears in the authenticated top band on:
     - Personal Journal
     - Maktab Journal
   - The Zoom action is hidden on unrelated screens and when no link is configured.

2. **User Management**
   - `+ Register a user` is now a solid green button.

3. **Maktab Settings Calendar**
   - A one-day Public Holiday is now read correctly even when legacy/seeded data has `date_to = NULL`.
   - Public Holidays therefore remain visible on their actual Gregorian date even during a term break (for example 24 September between terms).

4. **Attendance Quick Action**
   - Detail, Save and Close are aligned on one clean horizontal controls row.
   - Detail keeps its icon + label; Save stays the larger save icon; Close remains a separate X control.

5. **Mobile Attendance register — true column roll-up**
   - Closed Attendance now removes the Attendance header and percentage cells from the table layout entirely.
   - The reveal icon moves into the right edge of the Student header while collapsed.
   - Opening restores the Attendance header, sort control, reveal icon and percentage values.
   - This removes the Safari ghost/blank column left by the previous width-only collapse.

6. **Personal Journal**
   - Non-Maktab/personal entries use full-control-height, fixed-width pills.
   - Personal Journal menu order is now:
     1. Home
     2. Summary
     3. Detail
     4. Attendance
     5. Settings
     6. Maktab Journal

## Deployment order

### 1. D1 migration first
Apply:
- `worker/migrations/0030_hifz_class_zoom_link.sql`

This adds the nullable `maktab_settings.zoom_link` column.

### 2. Worker
Deploy the changed Worker files:
- `worker/src/maktabSettings.js`
- `worker/src/profile.js`
- `worker/src/maktabCalendar.js`

The Worker contains temporary read fallbacks so existing settings/timezone reads remain safe during rollout, but the migration should still be applied before the frontend is published.

### 3. Frontend overlay
Publish the remaining frontend changed files on top of V4.2.15.6.

## Verification checklist

- In **Maktab Settings**, enter a valid `https://` Hifz class Zoom URL and save.
- Open **Personal Journal** and **Maktab Journal**: confirm the centred blue **ZOOM** button appears and opens the configured URL.
- Open another screen: confirm the Zoom button is not shown there.
- Clear the Zoom URL and confirm the journal Zoom action disappears.
- Open **User Management** and confirm `+ Register a user` is a solid green button.
- Open **Maktab Settings → Calendar** for a month containing a Public Holiday in a term break and confirm the holiday is visible on its actual date.
- Open **Attendance Quick Action** and confirm Detail / Save / Close are aligned on one row.
- On iPhone/Safari, open the main Attendance register:
  - collapsed: there must be no blank Attendance column between Student and the first week;
  - the Attendance reveal icon sits at the right of the Student header;
  - tap it and confirm Attendance heading/sort/percentages return;
  - tap again and confirm the entire Attendance column disappears from layout.
- Open **Personal Journal** and confirm personal/non-Maktab pills have consistent fixed width/full height.
- Confirm Personal Journal menu order: Home → Summary → Detail → Attendance → Settings → Maktab Journal.

## Automated checks run for this build

- JavaScript syntax: **57 scripts checked, 0 failures**.
- New V4.2.15.7 regression: **17 passed, 0 failed**.
- Repository harnesses that reported results: **619 passed, 0 failed**.
- The remaining non-reporting legacy harnesses depend on unavailable `jsdom` or older incomplete DB fixtures; they are not new V4.2.15.7 failures.
