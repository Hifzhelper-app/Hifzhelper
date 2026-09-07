# Hifz Helper V4.2.15.5 — deployment TODO

## Baseline
- Overlay is built on the verified **V4.2.15.4** frontend baseline.
- Changed files only; do not replace unrelated files with older copies.
- File build headers were advanced only for product files actually edited in this revision.

## What changed

### Daily Report
- Daily Report now shows **every** Sabaq / Sabaq Dhor / Dhor entry logged by a student on the selected date.
- Multiple entries in one activity cell are shown as a **comma-separated list** instead of the Maktab Summary `+N` compression.
- The generated PNG/share output uses the same full entry lists and wraps/grows rows so extra entries are not lost.

### Per-student current-month Summary
- The existing standalone Student Summary is now a **current calendar month** report for that student.
- It fetches from the first day of the current month and filters through the month end.
- Every activity date in the month is displayed newest-first.
- Multiple same-day entries are shown inline, comma separated.
- Old weekly roll-ups / Load more behavior is removed from this monthly report.

### Maktab Settings → Calendar
- One-day calendar entries are normalized defensively (`date_to` falls back to `date_from`).
- A saved holiday is shown even when it lies **between terms / outside a term** (regression covered for **24 Sep 2026**).
- The redundant term summary directly beneath the embedded month calendar is removed; holiday / Islamic event rows remain.
- Each editable term is now presented in its own bordered card.
- **+ Add another term** is visually separated below the term cards.

### Quick Action UI
- Attendance Quick Action has a clean top control group with distinct **Detail**, larger **Save**, and **Close** controls.
- Mobile Sabaq Dhor Quick Action uses a fixed right-side checkbox column so quarter/manual checkboxes remain aligned.
- Mobile Maktab Summary adds the large Lucide **circle-plus + Log** target on each student card; it opens the existing combined Quick Log action.

## Deployment
This revision is **frontend only**.

1. Apply the files in this overlay on top of V4.2.15.4.
2. Deploy the Pages/frontend project.
3. No Worker deployment is required.
4. No D1 migration is required; latest migration remains `0029`.
5. After deployment, hard refresh/reopen the app once so the V4.2.15.5 service-worker cache is active.

## Validation performed
- JavaScript syntax check: all app/shared/Worker source files parsed successfully.
- New V4.2.15.5 regression harness: **17 passed, 0 failed**.
- All harnesses that report in this environment: **609 passed, 0 failed**.
- The remaining older harnesses that do not report are environment/legacy-fixture limited (primarily unavailable `jsdom` and old fixture/schema assumptions); no reporting harness failed.
- Worker tree is byte-for-byte unchanged from the V4.2.15.4 baseline.
