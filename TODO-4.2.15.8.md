# Hifz Helper V4.2.15.8 — deployment / verification TODO

Baseline: **V4.2.15.7**. This package is a **changed-files-only overlay**.

## What changed

1. **ZOOM action follows the authenticated band throughout the app**
   - The single Hifz class Zoom URL configured in **Maktab Settings** is unchanged.
   - When configured, the centred blue (`#0B5CFF`) **ZOOM** button is now visible anywhere the authenticated top band is visible.
   - The action is no longer restricted to only Personal Journal / Maktab Journal.
   - If no valid Zoom URL is configured, the action remains hidden.

2. **Public holiday calendar fix — blank one-day end dates**
   - The calendar Worker now treats `date_to = ''` / whitespace the same as `NULL` for one-day events.
   - This fixes saved Public Holidays that appeared in the editor but vanished from the month calendar.
   - A Public Holiday such as **24 September 2026** is returned/displayed even when it falls in a term break.
   - Holiday visibility remains independent of term membership.

3. **Attendance Quick Action icon alignment**
   - Detail, Save and Close now use equal **50px icon slots**.
   - Their icons share one horizontal centreline.
   - Detail retains its label underneath without pushing its icon out of alignment.

4. **Personal Journal default landing**
   - A setup-complete Personal Journal user now opens directly on **Summary**.
   - Incomplete users still open **Settings**.
   - Home remains available explicitly in the existing menu order.

5. **Maktab Summary / Maktab Journal — dedicated Log column**
   - Added a narrow **Log** column on the far right for desktop/tablet as well as mobile.
   - Each row uses the supplied Lucide **circle-plus** icon with the **Log** label.
   - The Log action always opens the same unified mobile-style Quick Action card with selector:
     - Sabaq
     - Sabaq Dhor
     - Dhor
   - Activity cells and row whitespace no longer open separate per-type Quick Action cards.
   - Existing explicit targets remain independent:
     - Student name → Student Summary
     - Attendance icon → Attendance Quick Action
     - `+N` → entry peek
     - Log → unified Log Quick Action

## Deployment order

### 1. Worker
Deploy:
- `worker/src/maktabCalendar.js`

There is **no new D1 migration in V4.2.15.8**. The V4.2.15.7 migration `0030_hifz_class_zoom_link.sql` remains a prerequisite if it has not already been applied.

### 2. Frontend overlay
Publish the frontend changed files on top of **V4.2.15.7**:
- `index.html`
- `js/auth.js`
- `js/app.js`
- `js/maktabSummary.js`
- `js/sw.js`
- `css/journal-table.css`
- `css/haidh.css`

## Verification checklist

- Configure a valid Hifz class Zoom link in **Maktab Settings**.
- Navigate through multiple authenticated screens (Maktab Summary, Attendance, User Management, Maktab Settings, Personal Journal, etc.) and confirm the centred blue **ZOOM** action remains visible wherever the auth band is shown.
- Clear the Zoom link and confirm the ZOOM action is hidden.
- In **Maktab Settings → Calendar**, open September 2026 and confirm the saved Public Holiday on **24 Sep** appears even though it lies between Term 3 and Term 4.
- Open Attendance Quick Action and confirm the Detail / Save / Close icons share the same vertical centreline.
- Log in/open a setup-complete Personal Journal and confirm it lands on **Summary**.
- On desktop/tablet Maktab Summary, confirm a dedicated rightmost **circle-plus + Log** column is visible.
- Tap a row's Log action and confirm one Quick Action card opens with Sabaq / Sabaq Dhor / Dhor selector.
- Confirm tapping Sabaq, Sabaq Dhor or Dhor data cells themselves does **not** open an individual Quick Action.
- Confirm Student name, Attendance icon and `+N` peek targets still work independently.
- Repeat the Log flow on mobile and confirm it still uses the same unified card.

## Automated checks run for this build

- Canonical JavaScript syntax harness: **37 scripts parsed, 0 failures**.
- New V4.2.15.8 regression: **13 passed, 0 failed**.
- Repository harnesses that reported pass/fail totals: **632 passed, 0 failed** across 71 discovered harnesses.
- The remaining non-reporting legacy harnesses require unavailable `jsdom` or older incomplete DB fixtures (`gender` column); they are not new V4.2.15.8 regressions.
