# Hifzhelper V4.2.15 — changed-files overlay

Baseline: verified `Hifzhelper-main (9).zip` (page/cache release 4.2.14.5).

## Apply

Overlay these files onto the existing Hifzhelper repo, preserving paths. This release has **no Worker/backend/schema/migration changes**.

Frontend files:
- `index.html`
- `css/journal-table.css`
- `js/maktabSummary.js`
- `js/maktabDay.js`
- `js/sw.js`

Regression tests updated/added under `tests/` are included in this ZIP so the repository test contract follows the V4.2.15 supersession of the old one-day Quick Attendance sheet.

## V4.2.15 UI changes

1. Maktab Summary rows are numbered in display order.
2. Maktab Summary has an Attendance button that opens the full Maktab Attendance summary/register.
3. Sabaq Quick Log now prepopulates from the same Sabaq-history frontier/default logic as the full Sabaq card.
4. Sabaq Dhor Quick Log now uses the full Sabaq Dhor quarter-derived layout: selectable quarter rows, manual From/To, and the existing Juz/quarter fallback when no derived position rows exist.
5. Quick Log Detail is now the supplied detail icon + `Detail` label on the right of the date row; it still opens the corresponding full detail card on the selected date.
6. The per-student Attendance icon no longer opens the temporary one-day Quick Attendance sheet. It opens the existing Student Attendance calendar directly on the selected Summary date. The existing calendar remains authoritative: single-day selection or start/end range, with the existing Haidh / Absent rules and validation.

## Version/cache rule

- Page/cache query keys and `CACHE_NAME` advance together to `4.2.15`.
- Build headers were advanced only in served files actually edited by V4.2.15 (`css/journal-table.css`, `js/maktabSummary.js`, `js/maktabDay.js`, `js/sw.js`). Untouched served-file headers remain unchanged.

## Verification

Run:

```bash
node tests/verify_syntax.mjs
node tests/verify_build_stamp.mjs
node tests/verify_v4215_ui.mjs
node tests/run-all.mjs
```

In the supplied baseline environment, all harnesses that could execute reported **522 passed, 0 failed** after V4.2.15 (baseline: 514 passed, 0 failed). The same 27 harnesses were unable to start in both baseline and V4.2.15 because the supplied checkout does not contain their `jsdom`/fixture dependencies; V4.2.15 introduced no additional broken harnesses.
