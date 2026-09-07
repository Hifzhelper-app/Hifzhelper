# Hifzhelper V4.2.15.3 — Daily Maktab Report

## Baseline
Apply this changed-files overlay **on top of V4.2.15.2**.

## What changed
- Maktab Summary now has a green **Daily Report** action beside Attendance.
- Daily Report opens as a read-only popup with its own native/iOS-safe date picker.
- The report uses the existing Maktab Summary endpoint for the selected date and shows **only students who actually logged Sabaq, Sabaq Dhor, or Dhor activity on that date**.
- Rows keep the useful Summary information: row number, Student, Sabaq, Sabaq Dhor, Dhor. The logged band remains alphabetic like Maktab Summary.
- **Share** prepares a clean PNG version of the report and sends that file to the browser/device native share sheet. On supported phones/tablets the OS can offer WhatsApp, Files, AirDrop, Mail, Messages, etc. according to what is installed.
- If native file sharing is unavailable, the same PNG is saved/downloaded locally instead of sending report data to a third-party service.
- No Worker/API/schema/storage changes.

## Changed / new files
- `index.html`
- `js/sw.js`
- `js/maktabDailyReport.js` (new)
- `css/daily-report.css` (new)
- `tests/verify_v42153_ui.mjs` (new)
- `tests/verify_v4215_ui.mjs` (version-regression assertion made future-overlay safe)
- `tests/verify_v42151_ui.mjs` (version-regression assertion made future-overlay safe)
- `tests/verify_v42152_ui.mjs` (version-regression assertion made future-overlay safe)
- `TODO-4.2.15.3.md`

## Deploy
Frontend only. Deploy the changed files to Cloudflare Pages. There is **no D1 migration and no Worker deployment** for this revision.

## Device check
1. Open Maktab Summary and choose a date containing a mixture of logged and unlogged students.
2. Tap **Daily Report**. Confirm the report defaults to that Summary date.
3. Confirm only students with actual Sabaq / Sabaq Dhor / Dhor activity appear and row numbers are sequential.
4. Change the report date from its date control and confirm the filtered rows reload without changing the underlying Maktab Summary date.
5. Tap **Share** on iPhone/iPad/Android/Safari/Chrome with native file share support. Confirm the OS share sheet opens with a PNG report and installed targets such as WhatsApp/Files appear according to the device.
6. Cancel the share sheet: the report popup should remain open and unchanged.
7. On a browser that cannot share files natively, tap Share and confirm the PNG saves/downloads locally.
8. Test a date with no logged activity: the empty message should show and Share should remain disabled.
