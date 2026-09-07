# Hifzhelper V4.2.15.4 — Attendance UI + Calendar consolidation

## Baseline
Apply this changed-files overlay **on top of V4.2.15.3**.

## What changed
- Attendance Student sort is now two-way only: A–Z / Z–A.
- Attendance manual term sort is now two-way only: high-to-low / low-to-high. It still uses Term Start → Term End, active-day count first, Attendance % second, alphabetical ties.
- A small **Sort** reset pill beside the Attendance page title restores the established default current-week ordering in one tap.
- The redundant green **Maktab Summary** button was removed from Attendance; the existing X already returns teaching profiles to Maktab Summary.
- Mobile Attendance header removes the literal `%` from the heading, lets **Attendance** wrap, and centres the Attendance reveal icon directly below the word. Desktop/tablet heading remains `Attendance %`.
- Student Management Haidh Setup styles the student name like the **Haaidha** heading, separates Save and Close, and enlarges Save.
- The standalone **Calendar** item is removed from the hamburger menu and Home tiles.
- The full month calendar now appears inside **Maktab Settings → Calendar**, beneath the Calendar/year heading and above the term editors.
- Public holidays and significant Islamic dates are visibly marked/named on their calendar dates and remain listed beneath the month grid. Existing Public Holidays / Islamic Calendar staged editors remain the management controls.
- Term/calendar edits immediately refresh the embedded month view.
- No Worker/API/schema/storage changes.

## Deploy
Frontend only. Deploy the changed files to Cloudflare Pages. There is **no D1 migration and no Worker deployment** for this revision.

## Device check
1. Attendance: tap Student repeatedly and confirm it alternates A–Z / Z–A only.
2. Attendance: tap Attendance repeatedly and confirm it alternates the two term-wide directions only.
3. Tap the small **Sort** pill and confirm default current-week ordering returns without leaving the page.
4. On mobile, confirm `Attendance` has no `%` in the heading, can wrap, and the circular Attendance reveal icon is centred below it.
5. Confirm the Attendance header no longer has a separate Maktab Summary button; X returns to Maktab Summary.
6. Open a Student Management Haidh pill: student name should match Haaidha heading weight, Save should be larger, and Save/X should be clearly separated.
7. Confirm Calendar no longer appears as a standalone menu/Home destination.
8. Open Maktab Settings → Calendar: month viewer should appear above the term rows. Swipe/use arrows across months and change the year.
9. Confirm saved Public Holidays and significant Islamic dates appear on their Gregorian calendar dates and are named in the list below.
10. Edit/Confirm a holiday/Islamic list or term and confirm the embedded calendar refreshes immediately.
