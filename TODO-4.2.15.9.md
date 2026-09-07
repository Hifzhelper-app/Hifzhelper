# Hifz Helper V4.2.15.9 — deployment / verification TODO

Baseline: **V4.2.15.8**. This package is a **changed-files-only overlay**.

## What changed

1. **Maktab Summary / Maktab Journal — Log action rail**
   - The right-hand Log action no longer has a visible column heading.
   - On desktop/tablet, the Log track is transparent and has no table border/background, so the circle-plus + **Log** control reads as an action sitting outside the white data table.
   - Student / Sabaq / Sabaq Dhor / Dhor remain the visible table headings.
   - The row-aligned Log button remains the only Maktab Summary logging entry point and still opens the unified Quick Log card.
   - Mobile card behaviour is unchanged.

2. **Unified Quick Log selector styling**
   - The Sabaq / Sabaq Dhor / Dhor selector now has a dark evergreen outline.
   - The selected activity is highlighted green with white text instead of the previous pale-blue active state.

3. **Attendance Quick Action — Save label**
   - Save now uses the same icon + label pattern as Detail.
   - The word **Save** appears under the Save icon.
   - Detail, Save and Close keep the same aligned 50px icon row; Close remains icon-only.

4. **Student Summary — one unified Log Quick Action**
   - The Sabaq / Sabaq Dhor / Dhor headings are display-only.
   - The dedicated circle-plus action is the single Log entry point.
   - It now forces the same unified Sabaq / Sabaq Dhor / Dhor selector on desktop/tablet as well as mobile.
   - Saving from the unified card refreshes the Student Summary as before.

## Deployment

This revision is **frontend-only**.

- No Worker changes.
- No D1 migration.
- The V4.2.15.7 `0030_hifz_class_zoom_link.sql` migration remains a prerequisite only if that earlier Zoom feature has not yet been deployed.

Publish the changed frontend files on top of **V4.2.15.8**:
- `index.html`
- `js/maktabDay.js`
- `js/sw.js`
- `css/journal-table.css`
- `css/haidh.css`

The package also carries the updated compatibility/regression harnesses for this release.

## Verification checklist

- Open Maktab Summary on desktop/tablet:
  - confirm the visible headings stop at **Dhor**;
  - confirm there is no Log heading/background;
  - confirm each row still has circle-plus + **Log** aligned on the far right over the page background;
  - confirm Sabaq / Sabaq Dhor / Dhor cells themselves remain display-only.
- Tap a row Log action and confirm one card opens with **Sabaq / Sabaq Dhor / Dhor** selector.
- Confirm the selector has a dark green outline and the selected segment is green with white text.
- Open Attendance Quick Action and confirm **Detail** and **Save** both show icon + label, with their icons aligned with Close.
- Open an individual Student Summary:
  - confirm Sabaq / Sabaq Dhor / Dhor headings are no longer individual quick-action targets;
  - tap the circle-plus and confirm the same unified 3-way Quick Log card opens on desktop/tablet and mobile.
- Save a Student Summary quick log and confirm the monthly summary refreshes.

## Automated checks run for this build

- Canonical JavaScript syntax harness: **37 scripts parsed, 0 failures**.
- New V4.2.15.9 regression: **9 passed, 0 failed**.
- Repository harnesses that reported pass/fail totals: **641 passed, 0 failed** across 72 discovered harnesses.
- The same legacy non-reporting harnesses remain limited by unavailable `jsdom` or older incomplete DB fixtures (`gender` column); they are not new V4.2.15.9 regressions.
