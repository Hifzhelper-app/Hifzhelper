# Hifzhelper — TODO / known issues

Things that are **not done**: confirmed findings, agreed designs awaiting
a build, and open bugs. Per the standing process rule — document first,
build only once explicitly told to "start building".

Specs for delivered work live in `SPECS.md`; what changed and which files
were touched lives in `CHANGELOG.md`. Neither is an action list. This file
is the only one that is.

## LIVE ITEMS — the whole action list, in priority order (2026-08-17, rebuilt)

**If it is not in this table it is not outstanding.** Rebuilt because the
previous version had itself gone stale — two items read "say start building"
after being built, and two carried the number 1. Exactly the failure §13
exists to stop, in the table that exists to prevent it. Deliberately no line
numbers; headings are unique, search the text.

| # | Item | Blocked on | Notes |
| --- | --- | --- | --- |
- ~~pool-write production check~~ CONFIRMED IN PRODUCTION (user, 2026-08-30). Closed.
| ~~2~~ | ~~**Run the admin PJ discard**~~ | **DONE — 2026-08-17, verified** | Ran in the D1 console (no local clone, so the wrangler `--file` route did not apply). Removed 21 rows for `ABCDEFG`: 6 sabaq, 4 sabaq dhor, 3 dhor, 7 attendance (7 not 13 because attendance is per DATE, not per log — several logs shared days), 1 position. `reflections` and `plans` were already 0. Profile fields cleared, and the stray haidh mark and known-wrong stored position went with the attendance and position rows. Verified all zeros; account still `ABCDEFG / ADMIN-01 / admin / 1` with `pin_hash` untouched. **Two non-bugs to expect:** ADMIN-01 still shows in the maktab summary with dashes (the roster filter is part of (j)), and its Dhor prepop reports nothing set up (correct — the pool is empty by instruction). |
| ~~3~~ | ~~**(j) Account separation**~~ | **BUILT — V3.77.0, 2026-08-27** | Roster filter, create-teaching-profile (`<id>TEACHER`, no PIN until first login), the device-local switcher with PIN every time, `updateLog` date validation. No migration. **Testing resumes.** Design and plan retained in the (j) sections below as the record. |
| ~~4~~ | ~~**Shared maktab timezone**~~ | **BUILT — V3.78.0 (delivery 3), 2026-08-27** | Per-maktab setting; everyone sees maktab time. This row had gone stale — struck 2026-08-28. |
| ~~5~~ | ~~**(k) Merged journal**~~ | **BUILT — V3.83.0, 2026-08-28** | Union at read time; provenance = teacher line; marker Option A live (B/C staged). Row struck 2026-08-28. |
| ~~6~~ | ~~**(l) Archive**~~ | **BUILT V3.97.0 (2026-08-30)** | 60-day copy, exactness exclusion, re-sync on edit AND delete (the flagged path), opportunistic idempotent trigger. **The (i)–(l) architecture is COMPLETE.** |
| ~~7~~ | ~~**Settings Haidh heading tweaks**~~ | **BUILT V3.96.0 (2026-08-30, user: "get it off the books")** | Three changes, fully specced. **Carries a trap** — deleting the hint element without its two JS writers reproduces the V3.51.2 blank-fields bug. Still worth doing: Settings is hidden from teachers but live for students. |
| ~~8~~ | ~~**Is `sih` a PJ icon?**~~ | **CLOSED 2026-08-17** | **No — "Surahs in my Heart is unconnected, a feature for everyone."** Already the behaviour, so no code changed; `verify_nav.mjs` now asserts all three roles see it, so the decision is enforced rather than remembered. **The nav work has no open questions left.** |
| ~~10~~ | ~~**The list of eleven**~~ | **ALL PHASES BUILT** — V3.75.0, V3.76.0, V3.78.0 | Delivery 3 (items 7, 8, 9 + the timezone) shipped 2026-08-27. Timezone display answered: **everyone sees maktab time**. |
| **9** | **Reword the empty-pool message** | **DEFERRED with the PJ set (2026-08-30)** | `dhorSchedule.js:176` says "No memorised juz'/quarters recorded **yet** in Hifz Setup", implying she never set it up when she may have cleared it deliberately. Cosmetic, not a bug. |
| ~~79~~ | ~~**Deploy + device-verify V4.2.12.1 Quick Log refinement**~~ | **SUPERSEDED by V4.2.13** | V4.2.13 carries the V4.2.12.1 frontend forward and adds the audited Attendance/Haidh correction. |
| ~~80~~ | ~~**Deploy + device-verify V4.2.13 Attendance/Haidh audit**~~ | **SUPERSEDED by V4.2.13.1 device pass** | V4.2.13 remains the required Worker/model base; V4.2.13.1 overlays the mobile register-width refinement. |
| **81** | **Deploy + device-verify V4.2.13.1 mobile Attendance width** | **READY — build complete** | **Deploy V4.2.13 Worker/model first if not already live, then this frontend overlay; no migration.** Confirm collapsed `%`, narrower Student column and 4–5 visible day columns on phone.

**Dependency chain:** (j) → (k) → (l) is fixed. Everything else slots in freely.

## V4.2.13.1 — READY TO DEPLOY / COMPLETE THE UPDATE

1. **Frontend overlay only.** V4.2.13's Worker/model must already be deployed. Upload the V4.2.13.1 Pages files and hard-refresh until the page/cache key reads **v4.2.13.1**. No migration and no new Worker deployment.
2. On a phone, open Maktab Attendance. Confirm the green screen inset is reduced only for this screen and that the sticky Student column is narrower with ellipsis for long names.
3. Attendance % must be collapsed by default behind the `%` button in the Student heading. Reveal it, compare values with V4.2.13/individual Attendance, then collapse it again.
4. With percentage collapsed, confirm roughly 4–5 attendance-day columns are visible on the target phone. Current-week positioning, weekly headers and attendance state marks must remain unchanged.
5. Run `node tests/verify_v42131_mobile_attendance.mjs`, `node tests/verify_v4213_attendance_model.mjs`, the cumulative register/UI harnesses, `verify_build_stamp.mjs`, and `verify_syntax.mjs`.

## V4.2.13 — SUPERSEDED BY V4.2.13.1 FOR DEVICE DEPLOYMENT


1. **No migration. Deploy the Worker first:** `worker/src/maktabAttendance.js`. Then overlay the changed Pages/frontend files and hard-refresh until the page/cache key reads **v4.2.13**.
2. Reproduce the original leakage pattern: confirmed Haidh → later Maktab log → later completed blank Maktab day. The later blank must be **Absent**, not probable Haidh. Confirm additional later blanks do not resume the old Haidh run.
3. Repeat with an explicit teacher **Absent** mark instead of a log as the stopping event. The old probable run must remain stopped. Then place a later new confirmed Haidh mark and verify it can start a fresh run.
4. Open the student's Haidh calendar. Probable days after confirmed Haidh must appear across **calendar days**, including weekends/non-teaching days, until the ruling maximum or stopping evidence. They remain read-only derivation until confirmed. A probable configured teaching-day cell may display in the register even when that date is below threshold/future; it must not enter Attendance % until the day is a resolved qualifying Maktab day.
5. Compare individual Attendance and the term register for the same student. Both must agree even when the stopping Maktab log falls **before the displayed term**.
6. Confirm reporting is explicit: **Active**, **Haidh** (with probable count where relevant), **Absent**, and Attendance %. Do not accept wording that calls Haidh days “Present”.
7. On an in-progress current Maktab day with no student evidence, confirm today does not inflate Attendance % and does not extend the no-log warning streak. A real log today must immediately count Active and reset the streak.
8. Confirm future predictions remain planned exact-date marks but do not seed probable propagation. Probable dates must not be treated as stored evidence by the calendar's Confirm/Predict decision.
9. Run `node tests/verify_v4213_attendance_model.mjs`, `node tests/verify_attendance_derived.mjs`, cumulative V4.2.11.x/V4.2.12.x harnesses, `verify_build_stamp.mjs`, `verify_syntax.mjs`, and `run-all.mjs`.

## V4.2.12.1 — SUPERSEDED BY V4.2.13

1. **No migration and no Worker deployment.** Overlay on V4.2.12 and hard-refresh until the page/cache key reads **v4.2.12.1**.
2. Desktop/tablet: open each Quick Log type. Confirm row 1 is `Type : Student Name`, row 2 is the compact date, and **Save** is narrower with **Detail** beside it.
3. Dhor: confirm `Quarter | Half | Juz` occupies the compact Portion row; the next row contains Juz, the appropriate 1–4 / 1–2 number pill, and confirmation. Whole Juz must not show a number pill.
4. Phone: tap any of the student's log rows/row space. One Quick Log card must open with student, date and `Sabaq | Sabaq Dhor | Dhor`. Switch types and confirm each type's unfinished selection survives when switching away and back.
5. Confirm student-name and attendance-icon taps still open their existing destinations; `+N` still opens only the entry peek; **Detail** opens the currently selected full detail card.
6. Summary ordering for the displayed date: students with logs first (**Group → first name**), then confirmed Haidh alphabetically, then everyone else alphabetically. A logged+Haidh student must remain in the log band; probable Haidh must not enter the confirmed band.
7. Run `node tests/verify_v42121_ui.mjs`, `node tests/verify_v4212_ui.mjs`, cumulative Summary/Haidh harnesses, `verify_build_stamp.mjs`, and `verify_syntax.mjs`.

## V4.2.12 — SUPERSEDED BY V4.2.12.1


1. **No migration and no Worker deployment.** V4.2.12 reuses the existing three Maktab log POST endpoints.
2. Overlay the V4.2.12 Pages/frontend files on V4.2.11.4 and hard-refresh until the login/page cache key reads **v4.2.12**.
3. On Maktab Summary, tap a Sabaq cell. Confirm the Quick Log sheet opens for the tapped student/date instead of navigating away, and exposes only **Ayah From / Ayah To**, confirmation and Save.
4. Repeat for Sabaq Dhor. For Dhor confirm **Juz + Quarter/Half/Juz**, with 1–4 Quarter / 1–2 Half position choices and no position chooser for a whole Juz.
5. Save one new entry of each type. The sheet must close and the same Summary date must refresh with the new shorthand. Exact duplicates must retain the established abortable duplicate confirmation.
6. Use a cell that already has a log. Confirm **Already logged** appears, `+N` still opens only the read-only peek, and **Open details** reaches the correct full card for history/editing.
7. Confirm quick Dhor still updates the Maktab Dhor pool through the existing Worker save path, and quick Sabaq leaves future position/default behaviour aligned with the full-card path.
8. Run `node tests/verify_v4212_ui.mjs`, the V4.2.11.4→V4.2.11 cumulative UI harnesses, `verify_v428_ui.mjs`, `verify_build_stamp.mjs`, and `verify_syntax.mjs`.

## V4.2.11.4 — SUPERSEDED BY V4.2.12

1. **No migration.** V4.2.11.4 adds no table/column/index.
2. **Deploy `worker/src/maktabAttendance.js` first.** The individual Attendance payload gains `probable_haidh_dates`, and the register uses the same derived Haidh truth when deciding whether a cell is excused.
3. Deploy the changed Pages/frontend files and hard-refresh until the page/cache key reads **v4.2.11.4**.
4. On Maktab Summary, confirm a student with an explicit confirmed Haidh mark shows the small pink **Haidh** text, while her attendance icon stays neutral (no yellow treatment).
5. Check a student/date that is Haidh only by propagation. The Summary must show neither pink `Haidh` nor `Absent`; her Attendance register cell must remain excused, and her Haidh calendar must show that date as **Probable Haidh** with the dashed/pale `?` treatment.
6. Tap a probable calendar date. It must begin a normal selection so it can be confirmed; it must not behave like an existing mark being deleted.
7. Confirm explicit stored Haidh and future predicted-Haidh calendar styling still work, and that a real log continues to take precedence over any Haidh state in register ordering/status.
8. Run `node tests/verify_v42114_ui.mjs`, the V4.2.11.3/V4.2.11.2 cumulative harnesses, `verify_v42111_register_data.mjs`, `verify_build_stamp.mjs`, and `verify_syntax.mjs`.

## V4.2.11.3 — SUPERSEDED BY V4.2.11.4

1. **No migration and no new Worker change.** Apply this frontend overlay after V4.2.11.2. If V4.2.11.2 itself is not deployed, follow its Worker-first deployment instructions below before overlaying 4.2.11.3.
2. Upload the V4.2.11.3 Pages files and hard-refresh until the page/cache key reads **v4.2.11.3**.
3. Open Sabaq / Sabaq Dhor / Dhor detail. Confirm there is **one date pill above the rail**, immediately left of Student Search in teaching context, and no repeated date pill inside the three normal cards.
4. Change that date, then move among all three cards. Save-date context must remain the same. Switch students via Search; the selected date and active card must remain unchanged.
5. Open History edit on each of Sabaq, Sabaq Dhor and Dhor. The historical entry's own date must still appear and remain editable in the edit header. Cancel/save and confirm normal mode returns to the shared date. Dhor Plan must remain visible.
6. Open Attendance on a current teaching day with known data. Students with **a log** today must be listed first, then Haidh students, then the remainder. Within every band, order must be alphabetical by first name. A student who has both a log and Haidh state must be in the log/Present band.
7. Run `node tests/verify_v42113_ui.mjs`, then the V4.2.11.2 cumulative checks and build/syntax harnesses.

## V4.2.11.2 — SUPERSEDED BY V4.2.11.3

The V4.2.11.2 Worker/register/header/menu changes remain the required base. Use the V4.2.11.3 checklist above as the active deployment instruction. Historical V4.2.11.2 steps follow for reference:


1. **No migration.** V4.2.11.2 changes the register read response/UI only.
2. **Deploy `worker/src/maktabAttendance.js` first**, then the changed Pages files, then hard-refresh until the login version reads **v4.2.11.2**.
3. Open Maktab Attendance. There must be **no term/date strip and no arrows** above the grid. The current Maktab week must be in view automatically.
4. Weekly headings must read date range only (for example **31 Aug – 3 Sep**), with no word `Week`. Confirm the thick divider beneath the weekday row.
5. Confirm **Present = bold lime text ✓**, **Haidh = thin green check**, **Absent = blank**; the yellow Haidh disk must not appear in this register.
6. Confirm the sticky left columns are **Student | Attendance %**. Compare at least two percentages with those students' individual Attendance pages for the same current term.
7. Open a student's Attendance page from the name. The white header must read **Attendance — Name** and, on a larger screen, be the same width as the two cards below. Re-run the V4.2.11.1 Haidh checks: larger/full-width calendar, Monday-first alignment, full-width selected-days pill, and no previous-student flash.
8. Open the hamburger as Admin and confirm primary order: **Home, Maktab, Attendance, Student Management, Maktab Settings, Calendar**. Confirm Home tiles themselves have not been reordered by this menu-only change.
9. Run `node tests/verify_v42112_ui.mjs`, `node tests/verify_v42111_register_data.mjs`, `node tests/verify_v42111_ui.mjs`, `node tests/verify_v4211_ui.mjs`, `node tests/verify_build_stamp.mjs`, and `node tests/verify_syntax.mjs`.

## V4.2.11.1 — SUPERSEDED BY V4.2.11.2

This frontend overlay is already included beneath the V4.2.11.2 follow-up. Its Haidh-calendar/Register/None fixes remain required, but use the V4.2.11.2 deployment checklist above as the active instruction. Historical V4.2.11.1 steps follow for reference:

This is a frontend overlay on V4.2.11:

1. **No migration and no Worker change.**
2. Apply the V4.2.11 release first if it is not already deployed; V4.2.11.1 contains only this follow-up's changed files.
3. Upload the V4.2.11.1 Pages files, hard-refresh, and confirm the login-card version reads **v4.2.11.1**.
4. In Student Management, open registration on both phone and desktop/tablet. **Register** must use forest green.
5. Check a student with no assigned group and both registration group selectors. Blank group must read **None**, while choosing/saving a real group must continue to work unchanged.
6. Open a Haaidha student's Attendance page on phone and larger screens. The Haidh calendar must use the available card width; the weekday row and date grid must start **Monday**, with dates under the correct weekday.
7. Select a Haidh date range. The **N days selected** pill must span the same full width as the calendar.
8. Stale-state check: open Student A's Attendance/Haidh calendar with obvious marked dates, return, then open Student B. Student A's marks/month state must **never flash**, even briefly, before Student B loads.
9. Open the **current term** Attendance register. It must land on the **current Maktab week** rather than the oldest week in the term; earlier weeks must still be reachable by scrolling left. Confirm a known logged student shows a green tick and a confirmed-Haidh student shows the yellow Haidh icon.
10. Run `node tests/verify_v42111_ui.mjs` and `node tests/verify_v42111_register_data.mjs`, plus the existing V4.2.11 register/Haidh checks.

## V4.2.11 — READY TO DEPLOY / COMPLETE THE UPDATE

Implementation is built. The remaining actions are deployment and device verification:

1. **Do not run a migration.** V4.2.11 reuses the existing `students.gender` and `students.track_haidh` columns.
2. **Deploy the Worker first.** Required worker changes: new `GET /maktab/attendance-register`, registration writes for Female/Haaidha, and automatic Female+Haaidha promotion after a teacher/admin confirms real Haidh.
3. **Deploy the changed Pages files second.** The Attendance screen then begins calling the new register endpoint.
4. **Hard-refresh / clear the old page cache** and verify the page is requesting the 4.2.11 `?v=` assets.
5. **Run the V4.2.11 device checklist in `TESTING.md`**, especially: two-row weekly register headings; green tick / yellow Haidh icon / blank absence; sticky single roster; student-name navigation; Female→Haaidha registration; first confirmed teacher Haidh promotes the profile; future prediction does not.
6. Once dev and production checks pass, strike live item **77** above.


**SHIPPED TODAY, no longer actions:** (i) read-routing rewrite (V3.68.0);
the server-side Dhor pool merge (V3.68.0); Home header row removal (V3.69.0);
the PJ hidden from teaching profiles (V3.69.0–V3.70.2); the student read-only
maktab day and the teaching landing screen (V3.71.0). Specs retained in their
sections as the record of what was agreed and why.

**Design — Maktab records (a)–(h): ALL SHIPPED.** Kept for the design
rationale later deliveries reference — not an action.

## Stated 2026-08-28, NOT BUILT: four further items + agreed build order

Recommended order (agreed rationale: the merge is the foundation; surfaces
that show history or summaries must read the MERGED journal, so they come
after it):

1. ~~**V3.79.0 — the settings rail**~~ **BUILT 2026-08-28.**
2. ~~**Dhor juz-range**~~ **BUILT V3.81.0 (2026-08-28)** — one Save, one
   sitting, one entry per juz; time/mistakes divided (remainder to the
   earliest), tags + note duplicated, laps on the first entry, no
   plan_id; frontend only.
3. ~~**(k) The merge**~~ **BUILT V3.83.0 (2026-08-28)** — one-way union at
   read time; maktab rows read-only by construction (id → maktab_log_id),
   personal entries marked (Option A live; B/C staged in CSS); teacher
   reads stay pure; prepop/frontier/tracker consume the merge. Marker
   choice + the build interpretation both still open to the user's veto.
   (l) Archive is now unblocked.
4. ~~**Notes History + button moves**~~ **BUILT V3.85.0.** Spec: option (c),
   ONE INTERLEAVED RAIL across dates of entry notes + teacher feedback,
   like the entry-history rail. Visibility rules UNCHANGED and do the
   filtering per viewer: the maktab sees PJ notes marked visible to it
   (the existing third read) + the feedback record; the student sees all
   her own notes + feedback visible to her. Layout: BOTH history buttons
   move to the bottom of the page below the notes; on the dhor page the
   Add-Juz and History buttons swap. BUILD-READY.
5. ~~**Student summary page**~~ **REVISION BUILT V3.85.0 (2026-08-28)** — standalone page, PJ layout, maktab data only, attendance icon, rail back to 3. Original revision spec kept below as the record:
   (a) NOT a rail card — a STANDALONE page "copied from the student's
   PJ"; the 4th card + dot come OFF the rail (back to 3). CONFIRMED by
   the user 2026-08-28 ("the maktab only sees maktab data"): the PJ
   Journal PAGE's layout (expanded recent days + weekly rollups) but
   still over the MAKTAB'S OWN entries only —
   "copied from the PJ" = the page design, NOT the merged/personal data
   (a teacher seeing her personal rows would break the three-inputs
   rule). Name tap on the maktab summary opens it as before; cell-level
   routing (sabaq cell → sabaq card etc.) presumably stays.
   (b) The page carries an ATTENDANCE ICON navigating to her attendance
   page (V3.80.0).
   (c) Her own read-only 4th card also comes off — her existing Maktab
   Journal screen already is her standalone view.

6. ~~**Maktab summary search — constrain it**~~ **BUILT V3.84.0
   (2026-08-28)** — the search lives in the green Student header cell,
   tap-to-reveal (Claude's settled choice, open to veto); V3.78.0
   semantics kept. User checking.

7. ~~**Settings General card — schematic rework**~~ **BUILT V3.85.0
   (2026-08-28)** — schematic rows; one tz field (lingering device
   button gone); save-status crash caught and fixed. Spec kept:** label-left /
   control-right rows per the schematic: Maktab Name [input]; Time Zone
   [ONE compact field — shows the staged zone or "Not set"; tapping it
   opens the chooser (use-device-zone, type-ahead, clear) and closes on
   pick]; Mushaf [the boxed radio group, right column]; then two narrow
   rows with a SMALL numeric input on the right: "Minimum number of
   students on a maktab day" and the inactive-days flag; Current term
   keeps its row in the same style. SAVE icon stays top-right.
   FIXES BUG (a) as a consequence: today the "Use this device's
   timezone (X)" button stays visible whenever the device differs from
   the staged zone — by design as a switch-back offer, wrong per the
   user (device zone still on screen after choosing another). The
   single-field control removes the standing button entirely.

8. ~~**Attendance "0 maktab days" report**~~ **VERIFIED CORRECT by the
   user (2026-08-28); the explanatory empty-period message BUILT
   V3.85.0.** Diagnosis kept:** a date only counts as a maktab day
   when ≥ maktab_day_min DISTINCT students have maktab logs on it
   (loadMaktabDays, HAVING n >= min). The user's settings show min = 3;
   test logging for 1–2 students therefore yields ZERO maktab days, so
   the term period is empty and the page reports 0. Verify: set min to 1
   → reload attendance. If STILL 0 with entries in the term, reopen as a
   real bug. Candidate improvement (unbuilt): when the period holds no
   maktab days, say so explicitly — "No maktab days in this period
   (fewer than N students logged per day)" — instead of a bare dash.

9. ~~**Attendance page — card container**~~ **BUILT V3.85.0
   (2026-08-28)** — one card for the data (+ the haidh card), the
   sentence-style custom range. Spec kept:** all the
   attendance data (% present, the count/period line, the custom
   from–to controls, the absent-days history) sits neatly on ONE card
   container, matching the app's existing card styling, instead of
   loose elements on the page. The custom range reads as a sentence
   (user, 2026-08-28): "Choose a custom date range from [date] to
   [date]". The haidh calendar + ranges below keep
   their own block (presumably a second card — confirm at build).

10. ~~**Attendance custom range — Apply becomes a small check**~~ **BUILT V3.86.0.** ( (user,
   2026-08-28, NOT BUILT — batching resumed: the user is not uploading
   per comment, so WAIT for the build word):** the Apply button (renders
   full-width on their device) is replaced by a SMALL CHECK control
   inline next to the two date inputs — tap the check to apply the
   range. "back to default" reset behaviour unchanged.

11. ~~**Attendance page buttons**~~ **BUILT V3.86.0** (assumption applied: the inline ranges block is gone).** (a) ABSENT DAYS becomes a SMALL GREEN button that looks and
   acts like the History button (`.history-btn` styling; opens a POPUP
   modal listing the absent dates, replacing the inline toggle list).
   (b) NEW: a HAIDH HISTORY button in the same style showing the LAST 3
   haidh periods (the haidh_ranges the payload already carries).
   Claude's assumption to confirm at build: the button replaces the
   inline #attHaidhRanges block below the calendar.

12. ~~**History buttons are NOT pills**~~ **BUILT V3.86.0.** ( (user, 2026-08-28, screenshot; same
   batch):** the `.history-btn` capsule/pill shape goes — standard
   button shape (the app's normal radius) for Sabaq History / Notes
   history and everything that inherits the class, including the new
   absent-days and haidh-history buttons from item 11.

13. ~~**Settings Tajweed/Groups add-rows**~~ **BUILT V3.86.0.** ( (user, 2026-08-28, screenshot;
   same batch):** the proportions are inverted today (tiny input, huge
   Add button). The INPUT takes the wide width the Add button has now,
   and Add becomes a SAVE ICON (the mset save-icon pattern), compact
   beside it. Both cards.

14. ~~**Settings General — SAVE on its own row**~~ **BUILT V3.86.0.** ( (user, 2026-08-28,
   screenshot; same batch):** the SAVE icon (and its Saved status)
   crowds the Maktab Name row. Give SAVE its OWN row at the top
   (right-aligned, per the schematic) and lower all the content below
   it — the Name row starts under it.

15. ~~**Settings General — WIDER input boxes**~~ **BUILT V3.86.0.** ( (user, 2026-08-28; same
   batch):** the Name / Time Zone (and term) controls take more of the
   row — shrink the label column so the inputs stretch.

16. ~~**MAKTAB CALENDAR**~~ **BUILT V3.87.0 (2026-08-28).** Full spec
   record kept below; Claude-settled details reported at delivery:
   settings management on a 4th Calendar card; the page view-only for
   everyone; blank label on the add-row = holiday, label = islamic;
   markers repaint on screen re-render (a manually changed card date
   repaints its header on the next render, not instantly).**
   - **Its own PAGE** (user). **INFORMATION ONLY — NO attendance logic**
     (user, explicit). The info is DISPLAYED WHEREVER DATES APPEAR.
   - **Islamic significant days: PRE-LOADED from the Jamiatul Ulama
     (KZN, South Africa) 2025–2030 prediction tables** (user's PDF,
     Most Likely dates), ADJUSTABLE when actual moon sightings differ.
     Seed data (label → date):
     2025: Laylatul-Bara'ah (Eve) 2025-02-13; First Taraweeh 2025-03-01;
       First Fast 2025-03-02; Eid-ul-Fitr 2025-03-31; Eid-ul-Adha
       2025-06-07; New Islamic Year 2025-06-27; 'Aashuraa 2025-07-06.
     2026: Laylatul-Bara'ah 2026-02-03; First Taraweeh 2026-02-18;
       First Fast 2026-02-19; Eid-ul-Fitr 2026-03-21; Eid-ul-Adha
       2026-05-28; New Islamic Year 2026-06-17; 'Aashuraa 2026-06-26.
     2027: Laylatul-Bara'ah 2027-01-23; First Taraweeh 2027-02-08;
       First Fast 2027-02-09; Eid-ul-Fitr 2027-03-10; Eid-ul-Adha
       2027-05-17; New Islamic Year 2027-06-07; 'Aashuraa 2027-06-16.
     2028: Laylatul-Bara'ah 2028-01-12; First Taraweeh 2028-01-28;
       First Fast 2028-01-29; Eid-ul-Fitr 2028-02-28; Eid-ul-Adha
       2028-05-06; New Islamic Year 2028-05-26; 'Aashuraa 2028-06-04.
     2029: First Taraweeh 2029-01-16; First Fast 2029-01-17;
       Eid-ul-Fitr 2029-02-16; Eid-ul-Adha 2029-04-25; New Islamic
       Year 2029-05-16; 'Aashuraa 2029-05-25; Laylatul-Bara'ah
       2029-12-20.
     2030: First Taraweeh 2030-01-05; First Fast 2030-01-06;
       Eid-ul-Fitr 2030-02-05; Eid-ul-Adha 2030-04-14; New Islamic
       Year 2030-05-05; 'Aashuraa 2030-05-14; Laylatul-Bara'ah
       2030-12-10.
   - **Public holidays: SOUTH AFRICA, dates only, no description**
     (user). Fixed: 1 Jan, 21 Mar, 27 Apr, 1 May, 16 Jun, 9 Aug,
     24 Sep, 16 Dec, 25 Dec, 26 Dec; movable: Good Friday (Friday
     before Easter) + Family Day (Monday after Easter). RULE (user):
     a PH falling on a SUNDAY makes the FOLLOWING MONDAY a public
     holiday. Generated per year; changeable in maktab settings.
   - **Maktab settings gains options** (user): ADD THE PREDICTIONS
     (load the seed set) and CHANGE THE PUBLIC HOLIDAYS.
   - **Terms: MULTIPLE, set up manually in MAKTAB SETTINGS (user,
     2026-08-28):** a "Terms" section — an ADD TERM button (visible
     when no terms are defined); each term is ONE LINE: term name,
     start date, end date; a small add control (+) after the rows to
     add another term. Rows: "term name 1  start, end / term name 2
     start, end …".
     ANSWERED (user, 2026-08-28): TERMS DRIVE ATTENDANCE — the
     multiple terms replace the single current-term pair; the
     attendance default period is the term containing today (fallback
     chain otherwise unchanged: custom → term-of-today → last 28
     days).
   - ANSWERED (user, 2026-08-28): (i) display surfaces = YES, that
     set (calendar day cells marker + label; journal/summary date
     cells small marker; day-view date headers show the label);
     (ii) Easter-derived holidays computed automatically (implied
     fine); (iii) students see the calendar page READ-ONLY — yes.
   **STATUS: BUILD-READY** (awaiting the build word). Scope note:
   migration (calendar table + terms table, current-term pair
   migrated in), worker CRUD + holiday/prediction loaders + the
   attendance default-period change, the calendar page, the settings
   Terms editor + the two options, and the date-surface markers.

17. ~~**STUDENT ATTENDANCE LAYOUT**~~ **BUILT V3.88.0 (2026-08-29).** Spec:**
   Card 1 — "Attendance this Term":
   - card heading: "Attendance this Term"
   - the stats as ONE sentence: "Present on X of Y maktab days : Z%"
     (count first, percent at the end — replaces the big % row)
   - the Absent Days button below it (as built)
   - then a "Calculate for another period" label, and beneath it the
     range as: From [date] to [date] [small check] (replaces the
     "Choose a custom date range from…" sentence)
   Card 2 — Haidh:
   - heading with icon: "Haidh: {name}"
   - subtext: "Confirm, cancel or predict haidh." / "Select a single
     day or a range"
   - the haidh CALENDAR expands to 90% of the container width
   - the calendar's range/decision BAR uses the FULL WIDTH (the
     screenshot shows the "15 days have not passed…" decision box
     squeezed left with dead space right)
   - ANSWERED (user, 2026-08-29): REMOVE the "Tap a start day…" hint
     text entirely — replaced by the explanation under the card header.
   - Range-bar cleanup (user screenshot, the circled half-hidden pill):
     the "Confirm as haidh" pill currently clips/overflows beside the
     "N days selected [Cancel]" row. KEEP the pill the SAME SIZE but
     move it to ITS OWN LINE BELOW, CENTRED; the selected-count +
     Cancel row above it uses the full width.
   (Haidh history button not shown on the schematic — KEPT unless
   vetoed.)

18. ~~**"Public Holidays" — the PROPOSE → EDIT → CONFIRM workflow**~~ **BUILT V3.88.0** (incl. the Islamic extension, the 4th-rail-card correction, and the 25% desktop grid). Spec:**
   the button (renamed "Public Holidays", "Add holidays" flow) must
   NOT be locked onto South Africa. Workflow:
   (1) press → SHOW the proposed list of public holidays for the
       picked year (the SA generated set is the current starting
       proposal — "SA atm");
   (2) EDIT, DELETE, or ADD rows on that staged list (dates only);
   (3) CONFIRM →
   (4) the confirmed list is added to the calendar.
   Build shape (Claude): a GET holiday-proposal endpoint returning the
   generated dates WITHOUT inserting; a staged editable panel in the
   settings card; Confirm commits the rows (the item-21 unique index
   makes commits duplicate-proof). Nothing inserts before Confirm.
   **EXTENDED (user, 2026-08-29): the SAME propose → edit → confirm
   system serves the SIGNIFICANT ISLAMIC DAYS** — a second button whose
   proposal source is the Jamiatul Ulama seed filtered to the picked
   year (labels editable in the stage, since these carry names);
   confirm lands them. This SUPERSEDES item 22.
   **FINAL SHAPE (user schematic, 2026-08-29 08:29):**
   - General card: the CURRENT TERM row is REMOVED (pink scribble) —
     terms live only on the Calendar card.
   - CORRECTED (user, 2026-08-29, on-phone): KEEP THE 4-CARD RAIL —
     the Calendar stays the 4th rail card ("as it should be"), holding
     the "CALENDAR" heading with the YEAR PICKER at the top, the TERMS
     section (edit/add rows as built), then the two green buttons —
     "Islamic Calendar" and "Public Holidays". (The earlier "one card"
     reading is void.)
   - LARGE SCREENS (user): the FOUR rail cards sit SIDE BY SIDE, each
     taking 25% — the settings rail's desktop grid becomes four
     columns. (The day rail keeps its own three.)
   - Each green button uses the HISTORY MECHANISM (the popup modal):
     it opens the staged list for the picked year — current entries
     merged with the proposal — editable in the popup (edit dates,
     edit labels on islamic, delete, add) → CONFIRM → "the list is
     then generated": that type+year's calendar entries become the
     confirmed list.
   - The inline "Calendar entries" list, the inline loader buttons,
     and the inline add-row (with its save icon) are GONE from
     settings (green X over the whole current block) — entries are
     VIEWED on the calendar page and EDITED through the popups.

19. ~~**Add-predictions idempotence hole**~~ **CLOSED V3.88.0** (label-per-year dedupe in the proposal). (Claude, spotted 2026-08-29
   answering the user's question; fix with the batch):** the loader
   skips rows matching label + EXACT DATE. An ADJUSTED prediction (the
   whole point — sightings) no longer matches its seed date, so
   pressing "Add predictions" again would RE-INSERT the original
   predicted date alongside the adjusted one. Fix: dedupe by label +
   YEAR (a significant day exists once per year, whatever its current
   date). Small worker change + harness pin.

20. ~~**Holiday rows show the DATE ONLY**~~ **BUILT V3.88.0.** Spec:** in the settings entries list, holiday rows carry no
   label input and no "Public holiday" ghost placeholder — "Public
   Holidays without any explanatory notes". Date + type tag + delete
   only. (Islamic rows keep their editable label.)

21. ~~**HOLIDAY DUPLICATES**~~ **FIXED V3.88.0** (migration 0027 + regenerate-on-confirm + in-flight disable). Record:** duplicates exist in her data
   despite the loader's check and the harness's idempotence pin,
   because the check is TOCTOU: two rapid presses race — both SELECT
   before either INSERT, and the table has no unique constraint.
   Fix, three layers: (a) migration 0027 — DELETE existing duplicate
   rows (keep MIN(id) per type+date+label group) THEN add a UNIQUE
   expression index on (type, date_from, COALESCE(label,'')) (plain
   UNIQUE treats NULL labels as distinct); (b) the loaders switch to
   INSERT OR IGNORE and count changes; (c) the two settings buttons
   disable while a load is in flight. Harness: a racing double-load
   drive + the index pinned.

22. ~~REMOVE the "Add predictions" button~~ SUPERSEDED (user,
   2026-08-29) by item 18's extension: the button becomes the staged
   propose → edit → confirm flow for significant days, proposal source
   = the seed filtered to the picked year.

23. ~~**Plain-text date format: dd-mmm-yy**~~ **BUILT V3.88.0.** Spec:** app-written PLAIN-TEXT dates render as dd-mmm-yy (e.g.
   24-Sep-26) via one shared formatter — attendance period lines,
   absent-days + haidh popups, calendar page lists, settings rows'
   text, notes-history dates, and the staged popup lists. Claude's
   assumption to confirm at build: the JOURNAL DATE CELLS keep their
   designed two-line weekday format (Thu / Aug 27) — they are layout,
   not prose. NOTE (answered in chat): the mm/dd/yyyy in DATE INPUTS
   is the device's region format — native pickers follow the phone
   (Settings → General → Language & Region → Region), not the app.

24. ~~**Term rows: name on its own line ABOVE the dates**~~ **BUILT
   V3.88.1** (Claude shipped it solo before the user's restated
   batching instruction below — noted).

24b. ~~**Staged popups rework**~~ **BUILT V3.89.0** (render bug fixed — the modal's width:100% inputs; Hijri labels with base-name dedupe; visible deletes; editable Public Holiday text). Spec:**
   (a) BUG on her device (screenshot): the Islamic popup rows render
   as date-only boxes — the name input and the delete × aren't
   visible. Investigate the row CSS inside the modal (likely a
   full-width input rule stacking the flex children); fix so all row
   parts show.
   (b) Islamic rows must show the DAY DESCRIPTION **and the ISLAMIC
   (Hijri) DATE** from the Jamiatul Ulama table (e.g. "First Taraweeh
   — 1 Ramadaan 1447"): extend the seed with each row's Hijri string
   (in the PDF: 15 Sha'baan / 1 Ramadaan / 1 Shawwal / 10 Zul Hijjah
   / 1 Muharram / 10 Muharram, with the right Hijri year per entry)
   and carry it in the label. Re-proposal dedupe keys on the full
   label string consistently.
   (c) DELETE per row in BOTH popups (the × — make it visibly work).
   (d) PUBLIC HOLIDAYS — reverses item 20: every holiday row carries
   EDITABLE text prefilled "Public Holiday" (not date-only after
   all); Confirm stores the text (blank → 'Public Holiday'); the
   worker stops forcing label NULL for holidays.


24c. ~~**Settings polish set**~~ **BUILT V3.89.0.** Spec:**
   (a) the MAJOR/MINOR pills on the Tajweed list — noticeably SMALLER;
   (b) REMOVE the explanatory parentheticals from the TERMS heading
   ("terms drive attendance — …") and the GROUPS heading ("one per
   student, …") — Tajweed's note untouched (not named);
   (c) vertical space between the add-row (with its save-icon button)
   and the RETIRE header in BOTH the Groups and Tajweed cards;
   (d) COMBINE Hifz Groups INTO the General card → the settings rail
   returns to THREE cards (General incl. Groups / Tajweed / Calendar);
   dots back to three; the desktop rail override adjusts accordingly
   (the 25%×4 rule dies with the 4th card — three across on large
   screens). Harness realignments expected (card/dot counts, the
   msetCardGroups host id).

25a. ~~**Terms section neatening**~~ **BUILT V3.90.0.** ( (user, 2026-08-29 15:44, NOT BUILT —
   queued for the next build word):**
   (a) term NAME inputs lose their visible box (the quiet borderless
   pattern — border appears on focus, like .mset-name-input);
   (b) the from/to DATE inputs render as PILLS (999px radius, subtle
   fill) instead of squared boxes;
   (c) more vertical spacing between term rows.

25b. ~~**Maktab summary header grid**~~ **BUILT V3.90.0.** ( (user, 2026-08-29 15:46; same
   queue):** the date pill and the X close float at the screen corners
   while the table centres at 70% — put them in a single-row grid AT
   THE TABLE'S WIDTH (the V3.85.1 ss-header pattern: date left, X
   right, same 70%/768px centring as the summary table).

25c. ~~**Summary-page attendance icon beside the name**~~ **BUILT V3.90.0.** ( (user,
   2026-08-29 15:47; same queue):** move the attendance icon from the
   far right to DIRECTLY AFTER the student's name so it reads "Umme's
   attendance"; the X stays far right (ss-header grid becomes
   auto·auto·1fr·auto).

25d. ~~**Day-card rhythm + pill selectors**~~ **BUILT V3.90.0.** ( (user, 2026-08-29 15:48; same
   queue):**
   (a) the date pill touches the box below — increase the VERTICAL
   SPACING across the whole day-card page (shared block rhythm).
   CONFIRMED on the dhor card too (user, 15:54): the pill touches and
   OVERLAPS the Quarter/Half/Juz toggle, and the term-info label
   crowds above the pill — the rhythm fix covers the date-row, the
   info label, and the toggle spacing on all three cards;
   (b) TRIAL: the surah:ayah selector row renders as a PILL instead of
   a box — styled on the SHARED selector class, so it cascades over
   every card (sabaq / sabaq dhor / dhor, PJ and maktab alike), which
   the user confirmed is the intent.

25e. ~~**Dhor selectors labelled**~~ **BUILT V3.90.0.** ( (user, 2026-08-29; same queue):** put
   "From" above the first juz/segment selector box and "To" above the
   second (the sabaq cards' label pattern).

25f. ~~**Space between the history buttons and the note boxes**~~ **BUILT V3.90.0.** ( (user,
   2026-08-29; same queue):** the card-history-bottom row (History +
   Notes history) sits flush under the Notes/Teacher-note block — add
   vertical space between them (folds into the 25d rhythm pass).

26. ~~**MERGE MARKER VERDICT**~~ **BUILT V3.91.0** (verdict settled). ( (user, 2026-08-29; queued for the next
   build word):** Option A "a little too subtle" — keep the marker but:
   use the LAVENDER highlight colour (--palette-lavender #E3DADE) as
   the cell background, and REMOVE the left accent border. Options B/C
   comments can then come out of the CSS (verdict given).

27. ~~**HEADER-CELL SEARCH — clipped invisible**~~ **FIXED V3.91.0.** ( (user, 2026-08-29;
   DIAGNOSED, queued):** the logic works (11/11 in the harness); the
   symptom "no feedback regardless of typing" is `.journal-header-row
   { overflow: hidden }` (there for the rounded top corners) CLIPPING
   the absolutely-positioned results dropdown — and the magnifier icon
   at the cell's right edge with it. Fix: (a) drop the row-level
   overflow and round the corners on the first/last CELLS instead, so
   the dropdown escapes; (b) move the magnifier to the LEFT of
   "Student" (::before, per the user); (c) dropdown z-index above the
   table.

28. ~~**Maktab Calendar page header**~~ **BUILT V3.91.0.** ( (user, 2026-08-29, screenshot;
   queued):** (a) the page title clips to "Maktab Cal…" at the screen
   corner — show it in full, aligned to the card's width (the 50%
   centring the cards use); (b) the month row is broken on desktop:
   the ‹ › buttons stretch into huge boxes and squeeze "August 2026"
   into a wrap — make the nav buttons compact (auto width), the month
   label on one line, centred between them.

29. ~~**Blue pills + the scribble set**~~ **BUILT V3.91.0** (all three scribble readings applied; open to veto). ( (user, 2026-08-29 17:24,
   annotated screenshot; queued):**
   (a) STATED: the selector pills take the LIGHT BLUE from the palette
   (--palette-sky #D0DBE7 = --color-accent-soft) — the mock paints the
   sabaq from/to fields, the sabaqDhor from/to + suggestion boxes, and
   the dhor juz selects, i.e. the selector controls as a family.
   Scribble-readings (open to veto at delivery):
   (b) "Term 2" struck out on ALL THREE cards → remove the term-name
   info label from the day-card date rows (the calendar markers
   elsewhere stay);
   (c) "Confirm" struck in "Confirm Sabaq Dhor" → the heading reads
   just "Sabaq Dhor";
   (d) the pink arrow from Add-Juz-to-Dhor pointing right → the button
   moves to the FAR RIGHT of the date row.

30. ~~**Calendar card year + date-pill chevrons**~~ **BUILT V3.92.0.** ( (user, 2026-08-29,
   photo on V3.90.1; queued):**
   (a) the YEAR select becomes a BLUE PILL (accent-soft) and moves
   next to the "Calendar" heading instead of the far corner;
   (b) the term date pills: the native picker CHEVRON overlaps and
   cuts the date text — REMOVE it (hide the webkit
   calendar-picker-indicator; tapping anywhere on the date still
   opens the picker, as the user notes).

31. ~~**Calendar page: legend out, Hijri in the list + settings**~~ **BUILT V3.92.0.** ( (user,
   2026-08-29, CLARIFIED — replaces the earlier cell-name reading):**
   (a) REMOVE the legend line completely;
   (b) the table below the grid remains the naming surface for
   holidays + islamic days (as built);
   (c) islamic rows in that table show the HIJRI DATE, not the day
   name — the label's Hijri part (after ' — '); manual entries with
   no Hijri part fall back to their full label;
   (d) the Hijri date also shows in MAKTAB SETTINGS (the Islamic
   Calendar popup) — carried by the V3.89 labels; her saved rows gain
   it on the one-press Confirm regeneration; new-year proposals carry
   it natively.

**WORKFLOW (user, restated 2026-08-30, after Claude shipped V3.92.1
solo): NOTHING builds without the explicit build word — INCLUDING
defect fixes. Diagnose, queue, wait. No exceptions.**

33. ~~**SEARCH STILL INVISIBLE — the second clipper**~~ **FIXED V3.93.0.** (** V3.91 unclipped the header ROW, but
   `.journal-header-cell { overflow: hidden }` (there for label
   ellipsis) clips the dropdown a level lower — the results, including
   the "No matching student." empty state, render and are swallowed by
   the CELL. Fix: `.maktab-search-cell { overflow: visible; }` (the
   other header cells keep their ellipsis clipping). Pin it. Honest
   test-gap note: jsdom can't see layout visibility, so both clippers
   passed the suite — the pin encodes the rule, not the pixels.

34. ~~**Dhor duration in minutes**~~ **BUILT V3.93.0** (entry too, per the mock's crossed mm:ss). (** storage stays mm:ss and the entry form keeps its mm/ss
   inputs — every DISPLAY of a saved duration (history rail, entry
   popups, anywhere it prints) shows minutes only. Claude's choice to
   confirm at delivery: ROUNDED to the nearest minute (12:45 → "13
   min"; sub-minute → "1 min").

35. ~~**Sabaq Lines/Pages — one box, unit inside**~~ **BUILT V3.93.0** (as a view switch — both values kept). (** sabaq is measured in EITHER lines OR pages — the two
   separate boxes become ONE box labelled "Lines/Pages" with the UNIT
   INSIDE the box. Claude's proposed shape (confirm at delivery): one
   numeric field + a small lines|pages toggle chip inside the box's
   right edge; saving writes the chosen column and clears the other;
   an old entry with both filled displays its lines. Storage schema
   unchanged.

36. ~~**Day-card set**~~ **BUILT V3.93.0.** (**
   (a) SPACE between the card title and the TIMER icon (all three);
   (b) BOX around the TIMER icon (drawn + stated);
   (c) Sabaq: confirms + extends item 35 — ONE "Lines/Pages" box with
   a lines|pages PILL inside; the freed second box becomes TAJWEED
   (moves up beside it); the separate Tajweed row below goes;
   (d) PILL styling for the Sabaq Dhor suggestion rows (the two
   Quarter/Half boxes drawn as blue pills);
   (e) Dhor: the half/quarter POSITION selector moves IN LINE with the
   juz number (From row: juz select + position pills on one line);
   (f) Dhor: "Add Juz to Dhor" button relabels to "AJZAA COMPLETED";
   (g) Dhor: Duration / Mistakes / Tajweed in ONE ROW; the mm:ss entry
   inputs (crossed out) become a single MINUTES box — extends item 34:
   entry in minutes too, stored as mm:00 (schema unchanged);
   (h) SYMMETRY for the history-button rows across the three cards
   (same placement/order/sizing; the user's arrows on all three).

37. ~~**"Ajzaa completed" (dhor setup) popup rework**~~ **BUILT V3.93.0.** (**
   (a) the explanatory paragraph REMOVED;
   (b) Save becomes a SAVE ICON at the top-right (the bottom "Save
   setup" text button goes);
   (c) the juz list becomes a 3×10 GRID — preferably SELECTABLE
   BUTTONS ("change the text to selectable buttons — if possible":
   possible), i.e. Juz 1–30 as toggle chips, selected state filled;
   fallback shape (checkbox right of text) not needed.

32. ~~**Centre the Calendar card content**~~ **BUILT V3.93.0.** (**
   the settings Calendar card's content — heading row, terms rows, the
   + button, the two green buttons — centres within the card.

38. ~~**Islamic popup: deletions must STICK + Hijri on every row**~~ **BUILT V3.94.0.** (**
   Root cause admitted: proposals re-stage any seed day absent from
   the year (base-name dedupe can't distinguish "deleted" from "never
   had"), so deleting a standard day is impossible — her deleted
   First Fast returned on every open, wearing the new Hijri label.
   And Claude's earlier claim that Confirm would regenerate Hijri
   labels was WRONG (existing short-label rows block their Hijri
   successors by design). Fix, two parts:
   (a) PROPOSE ONLY INTO AN EMPTY YEAR: once any islamic rows exist
   for the year, the popup stages exactly what is saved — nothing
   re-proposed; deletions stick; "+ Add a day" covers additions.
   (Deleting every row then reopening = full fresh proposal — the
   natural reset.) Same rule for holidays.
   (b) HIJRI ENRICHMENT ON CONFIRM: the worker upgrades any confirmed
   islamic label that matches a seed base name for that year and
   lacks a Hijri part to the seed's full "Name — Hijri" label — so
   her existing rows gain their Hijri dates on the next Confirm, no
   duplicates possible. (Partly moot now: she deleted all + reopened,
   so her staged rows already carry Hijri labels — keep (b) anyway as
   the safety net for any short-label row that survives.)
   (c) POPUP ROW FORMAT (user, 08:51): the Hijri date renders in
   ITALICS on its OWN LINE BELOW the name — the editable input holds
   the BASE name only; the italic Hijri line below is display-only;
   Confirm reassembles "base — hijri" for storage (schema/labels
   unchanged). A row with no Hijri part shows no second line.

39. ~~**Calendar card polish**~~ **BUILT V3.94.0.** (**
   (a) "Calendar" becomes a proper HEADER (card-heading weight/size,
   year pill beside it);
   (b) the "Terms" label is REMOVED (struck through);
   (c) the + (add term) button a little BIGGER;
   (d) the whole content block moves DOWN a notch (top spacing).

40. ~~**Ajzaa-completed popup polish**~~ **BUILT V3.94.0.** (**
   (a) juz pills ~20% SMALLER (padding + font);
   (b) text CENTRED in the pill (it sits left);
   (c) the popup CLOSE X moves to the LEFT corner;
   (d) a TITLE added: "Ajzaa completed".

41. ~~**V3.93 follow-ups**~~ **BUILT V3.94.0** (root causes named for both repeats). (**
   (a) REPEAT of 36d: the Sabaq Dhor suggestion rows still aren't
   pills on her device (pink-circled) — the 999px radius must land on
   the actual bordered element (diagnose which element carries the
   border and round THAT);
   (b) REPEAT of 36e: the inline 1|2 position switch renders as a
   broken/squashed oval overlapping its row (pink-circled) — the
   switch-track needs proper inline sizing next to the juz select;
   (c) the Duration / Mistakes / Tajweed labels sit at different
   heights (pink line drawn through them) — one shared baseline;
   (d) placeholder text "Select tajweed tags" → "Select tags"
   (the label above already says Tajweed);
   (e) history buttons: rightward arrows again on all three cards —
   READ AS: align the button pair to the RIGHT edge of the card
   (scribble-reading, open to veto).

42. ~~**CALENDAR CARD DEAD ON RETURN**~~ **FIXED V3.94.0** (+ the double-render net). (** second and later visits to maktab settings
   render the Calendar card with an EMPTY year pill and dead
   year/+/green buttons. Cause: renderMaktabSettingsScreen rebuilds
   the card's innerHTML每 visit, but wireMsetCalendarCard carries a
   run-once guard (msetCalWired) — first visit wires the original
   elements; later visits return early, leaving the rebuilt clones
   unpopulated and listener-less. Fix: DELETE the guard (wire every
   render — old handlers die with their replaced nodes, so nothing
   double-fires). Add a harness drive: render the settings screen
   TWICE and assert the year select still has options + the buttons
   still open the popup (the double-render pattern that would have
   caught this).

43. ~~**V3.94 follow-ups**~~ **BUILT V3.95.0.** (**
   (a) the italic Hijri line moves UNDER THE NAME BOX (it renders
   under the date column) — the name input + Hijri wrap in a column
   so the italic sits directly beneath the name;
   (b) a BORDER around the Calendar card/content (her earlier pink
   outline was the spec, stated now: "I don't have a border around
   calendar");
   (c) SPACE markers (red) across the day cards: above the Teacher
   note on all three; above the history-button row on all three;
   above the Duration row on dhor (below the juz row);
   (d) dhor dashed-line alignment: the From juz select and the 1|2
   pills on ONE line at the SAME height; the Duration/Mistakes/
   Tajweed input boxes horizontally aligned and the SAME height;
   (e) the history pair SPREADS — one to each end (space-between) on
   every card (the pink boxed mock; replaces the V3.94 flex-end
   reading), and "Notes history" capitalises to "Notes History".
   Dead-card bug CONFIRMED FIXED by the user.

**VERDICTS SETTLED (user, 2026-08-30): all three standing verdicts
are closed.** (1) Tap-to-reveal search: WORKS, KEPT. (2) Counting
interpretation: CONFIRMED — maktab-logged entries count as the
student's real progress (prepop/frontier/tracker consume them; the
truth principle stands). (3) Pill selectors: KEPT (blue pills stay).
No code change needed for any of the three — all are live as built.

44. ~~**Position switch — CORRECTED diagnosis**~~ **BUILT V3.96.1 + CONFIRMED WORKING by the user (2026-08-30).** (fourth attempt; first after reading the source — the lesson is pinned: read the component contract before styling it). (2026-08-30, after the
   user's challenge; queued):** read the component source this time.
   renderSwitch positions the thumb as PERCENTAGES assuming N equal
   slots fill the track; the option buttons are natural-width, so the
   forced 84px track (a) clips Quarter's 4x~34px options at
   overflow:hidden — the cut-off 4 — and (b) makes the 2-way thumb
   (50% of 84 = 38px) wider than the ~34px option — the oversized
   lozenge. The earlier thumb-height claim was WRONG (top/bottom:2px
   self-derives; verified). TWO contradictory forced-height rules
   (34px + 44px) are debris to delete. Alignment claim VERIFIED:
   center vs the labelled column parks the switch in the label gap.
   FIX: delete both forced rules; #dhor_position_switch .switch-option
   { flex: 1 1 0 } (restores the percentage contract for any count);
   one track width serving 2 and 4 (~140px); base 42px height; row
   align-items: flex-end so the switch stands level with the select.

45. **MAKTAB ATTENDANCE SCREEN (user, 2026-08-31; spec answered —
   see 45b for the refined version, this is the original ask):** a maktab screen (teacher/admin) — a
   TABLE of FOUR columns, Mon–Thu of one week; each column lists the
   haa'idha predicted for that day; ‹ › pages a week back/forward;
   default = the current week. Claude's proposed shape: worker GET
   /maktab/haidh-forecast?week=<monday> computing, for every active
   student with tracking on, the predicted range(s) from her
   cycle/period/next-expected (projected forward AND backward across
   cycles) plus any CONFIRMED haidh overlapping the four days; client
   renders four columns, names alphabetical, tap a name → her
   attendance/haidh page. Open questions to the user: (a) predicted
   only, or predicted + confirmed distinguished (e.g. confirmed in
   bold / predicted in italics)? (b) placement — a new nav item
   "Haidh" (teacher/admin only)? (c) Mon–Thu fixed, or follow the
   maktab's teaching days?

45b. ~~**MAKTAB ATTENDANCE SCREEN**~~ **BUILT V3.98.0 (2026-08-31).** Spec:**
   (1) FUTURE days show PREDICTED haidh only; TODAY and PAST show
   CONFIRMED and PREDICTED, visually distinguished.
   (2) A new nav item "ATTENDANCE" (teacher/admin).
   (3) Columns = the maktab's days, not a fixed Mon-Thu.
   (4) Range = predicted forward FOUR WEEKS + actual past attendance;
   ‹ › pages weeks.
   (5) The teacher can ADD a student to the haidh list — a maktab-side
   way to set a haidh record for students who don't use the PJ.
   TECHNICAL FINDINGS (Claude, verified in source):
   - predictions already MATERIALISE into `attendance` as
     status='predicted-haidh' (4 cycles ahead) when a student sets her
     cycle; confirmed = status='haidh'. So the screen is a QUERY, not a
     projection engine.
   - (5) IS ALREADY BUILT at the API layer: POST /attendance/mark-range
     accepts student_id when the caller isTeacherOrAbove (V3.76.0) and
     writes the same shared store. This is a new UI surface on a proven
     path, not new plumbing.
   - CONFLICT to resolve: a "maktab day" is DERIVED from logging
     activity (loadMaktabDays vs maktab_day_min) — it cannot exist for
     future dates, since nobody has logged tomorrow. Future columns
     therefore need a different source (calendar term days minus
     holidays, restricted to the weekday pattern of recent maktab days;
     or a fixed Mon-Thu for future weeks).
   - NAMING RESOLVED (user, 2026-08-31): the label stays "Attendance"
     for everyone; the DESTINATION follows the role — students land on
     their own attendance page (unchanged), teacher/admin land on the
     new MAKTAB attendance screen. The per-student view keeps its
     existing entry point: the icon beside the student's name.
   - COLUMNS RESOLVED (user): a TEACHING DAYS setting in Maktab
     Settings drives them (option 3). Proposed shape: migration 0029
     adds maktab_settings.teaching_days (JSON array, e.g.
     ["mon","tue","wed","thu"]); a weekday toggle row on the General
     card. Columns = that week's teaching days. CORRECTION (user,
     2026-08-31): holidays and out-of-term days are NOT omitted — they
     appear as columns, greyed and LABELLED ("Public Holiday" / the
     holiday's own name / "Term break"), so the teacher scrolling
     weeks never silently loses a day and can see WHY a day is empty.
     Labels come from the V3.87/V3.88 maktab calendar. The derived
     maktab-day logic that drives attendance PERCENTAGES elsewhere is
     untouched.
   - CELL CONTENT (user, 2026-08-31, FINAL): PAST columns carry THREE
     lists — PRESENT, ABSENT, HAA'IDHA. PRESENT (today) and FUTURE
     columns carry PREDICTED HAA'IDHA only — today is a planning
     column, not a register: the teacher wants to know who is expected
     to be haa'idha, not who has logged so far. So the three-list
     treatment starts strictly BEFORE today.
   - PREDICTED ABSENTEE (user, 2026-08-31): the teacher can mark a
     student expected-absent on a FUTURE day when she has informed the
     maktab in advance. So future columns carry TWO lists: predicted
     haa'idha and predicted absentees.
     TECHNICAL: attendance.status has a CHECK constraint
     ('present','absent','haidh','predicted-haidh') — a new
     'predicted-absent' value needs the table-rebuild pattern (as
     0007 did), folded into migration 0029 alongside teaching_days.
     Claude's reading (open to veto): the prediction is purely
     FORWARD-LOOKING — once the day passes, the existing derivation
     governs (maktab day + no log = absent; a log = present), so a
     passed prediction needs no conversion and never overrides what
     actually happened.
     ANSWERED (user, 2026-08-31): an informed absence is a PLAIN
     ABSENCE in the percentage — informing the maktab is courtesy, not
     excusal. So 'predicted-absent' NEVER touches the attendance
     derivation or the stats: it exists only to populate the future
     columns, and is cleared/ignored once the day passes. Only haidh
     excuses. SPEC NOW CLOSED — build-ready, awaiting the build word.
   - Claude's reading of the threshold interaction (open to veto): a
     configured teaching day on which the maktab clearly did not
     happen (fewer than maktab_day_min students logged) is NOT turned
     into a wall of false absences — the existing V3.85 rule stands
     ("below the threshold is not a maktab day; nobody is absent").
     Consistent with the labelled-holiday principle, that column is
     shown and LABELLED "No maktab day" rather than left silently
     empty or filled with absences.

46. ~~**Distinct CALENDAR icon**~~ **BUILT V3.98.1.** (** all three
   nav items (student Attendance, maktab Attendance, Calendar) share
   icons.js 'attendance' — the calendar-with-a-check. Add a new
   'calendar' icon (the user's lucide calendar-days: grid of dots) and
   point MAKTAB_CALENDAR_NAV_ITEM at it, so Calendar reads distinctly
   from the two Attendance items. Normalise to the registry's house
   convention (viewBox only, stroke-width 1.8, no width/height/class).

47. ~~**"Kaaba puzzle" for the maktab**~~ **BUILT V3.99.0** (role-driven, as read). ( the
   nav label and the screen heading read "Juz Tracker" for everyone.
   For the MAKTAB they should read "Kaaba puzzle" — for a teacher or
   admin the screen tracks no hifz of their own, so the tracker naming
   is meaningless there; for a student it is her progress and the name
   stands. Claude's reading (open to veto): drive it by ROLE, the same
   pattern V3.98.0 used for the Attendance nav item — isTeachingProfile()
   gets "Kaaba puzzle" (label + the h2 on screen-juzTracker), students
   keep "Juz Tracker". Alternative reading, if wrong: drive it by
   maktab CONTEXT rather than role.

48. ~~**Attendance + Calendar header cards, spacing, width caps**~~ **BUILT V3.99.0.** ( the Attendance screen shows a bare centred <h2> in a
   .mcal-header. Give it the JUZ TRACKER header instead — the white
   card bar: .juz-tracker-header-row shape with a .card-header-icon
   (icons.js 'attendance'), the title, and the screen-close X on the
   right (as the Juz Tracker card carries).
   CONFIRMED (user, 2026-08-31): the CALENDAR screen gets the same card
   header, plus VERTICAL SPACE between that header and the calendar
   card beneath it.
   WIDTH (user, same message): CAP the width of all three — Attendance,
   Calendar and the Kaaba puzzle — instead of letting them run
   edge-to-edge on a wide display. One shared max-width, so the three
   sit consistently with each other.

49. ~~**LINES/PAGES NEVER CALCULATES**~~ **FIXED V3.99.1** (+ the 35th harness, which drives the handler). Record:** recomputeSabaqLineCount (js/sabaqPage.js:215)
   reads `profile && profile.mushaf`, but `profile` is declared
   `let profile = null` INSIDE the render function (:180) — it is a
   LOCAL, and there is no global of that name. So the reference throws
   ReferenceError every time the recompute runs, the handler dies
   before the assignment, and the Lines box silently stays empty for
   EVERY user, PJ and maktab alike, on every path (to-ayah change,
   stepper, confirm tick). The calculator itself is fine: verified
   3:183-186 returns 13 lines (waterval) / 12 (indopak, uthmani).
   FIX: hoist the mushaf the render already fetched into a module-level
   variable (e.g. sabaqMushaf, set beside sabaqRef at :182) and have
   the recompute use THAT — not a second profile lookup, which would
   make the calculation async for no reason.
   TEST-GAP NOTE: no harness ever drove the recompute — the jsdom
   suites pin markup and wiring, and this is a runtime scope error in
   a handler. Add a real drive: set a range, fire the events, assert
   the box fills.

50. ~~**STUDENT ATTENDANCE PAGE rework**~~ **BUILT V4.0.0.** Spec:** the per-student page (icon beside her name) gets the same
   treatment the other screens now have.
   (a) HEADER: the shared header card (icon, title, close X) as
   Calendar/Attendance/Kaaba puzzle carry — and the screen-cap width.
   (b) The period row becomes DATE PILLS and comes FIRST (user
   confirmed): "From [pill] to [pill] [confirm]" — the term's dates are
   the DEFAULT VALUES INSIDE the pills, not narrated in text beside
   them; a confirm/apply control follows the two pills; and all THREE
   stay on ONE LINE, on mobile as well (no wrap).
   (c) Card 1 order, CONFIRMED by the user: the date-range row first,
   then "Attendance" with "Present on Y of Z maktab days : N%", then
   the Days-absent button ON ITS OWN LINE beneath that sentence. End of
   card.
   (d) HAIDH card: heading "Haidh — {name}" with the two-line
   explanation as now (already built V3.88.0).
   (e) The haidh CALENDAR sizes to the screen/card width (it currently
   sits narrow and centred).
   (f) The selection bar becomes a FULL-WIDTH BLUE BAND across the
   calendar's width: "N days selected" at the left, an X at the right
   (replacing the current pill + separate Cancel button).
   (g) "Confirm/Predict as haidh" sits CENTRED UNDER the calendar, on
   its own line.
   (h) ABSENT NOTIFICATIONS (user, same message): the same calendar
   selection can also be marked as an INFORMED ABSENCE — the
   'predicted-absent' status V3.98.0 introduced, written through the
   existing teacher path (apiSetAttendanceFor). Claude's reading, open
   to veto: a second action button beside the haidh one under the
   calendar, labelled exactly "Mark absent" (user), so one selection
   can become either. The V3.98.0 ruling stands — an informed absence
   NEVER excuses and never touches the percentage; it exists so the
   maktab knows in advance, and it shows in the Attendance screen's
   future columns.

51. ~~**SABAQ UNIT: automatic, by amount**~~ **BUILT V4.0.1** (+ the /13 mushaf bug fixed with it). Record:**
   the pill can't hold a Pages choice — sabaqSyncUnitPill shows pages
   only when lines is EMPTY and pages has a value, but the auto-calc
   fills BOTH, so it snaps back to Lines on every recompute. The user's
   rule replaces the whole question: the unit is chosen BY AMOUNT, not
   remembered and not a setting —
     lineCount > linesPerPage  → show PAGES (lines / linesPerPage,
                                 rounded to QUARTER-page units)
     otherwise                 → show LINES.
   This also settles the 2.75-vs-4 question: pages mean TEXT QUANTITY
   (lines ÷ linesPerPage), not the physical pages a span touches.
   BUG FOUND while specifying (Claude): js/sabaqPage.js:225 hardcodes
   `/ 13` — so a 15-line mushaf has always had its page count computed
   against 13 lines per page. linesPerPage must come from the maktab's
   mushaf (13 for 13line, 15 for the 15-line prints), and the same
   value must drive the new unit rule.
   The pill stays switchable — the rule sets what is SHOWN by default.

52. ~~**+N pill inert on the student summary**~~ **FIXED V4.0.2.** ( on the student summary page (maktabDay.js
   rowFor) the cells are built with journalCellShorthand, which RENDERS
   the +N badge but the row only wires a whole-row click (openMaktabDay)
   — nothing listens on the badge, so tapping it just opens the day.
   FIX: copy the maktab-summary pattern (js/maktabSummary.js:47-48 and
   :326) — rewrite the badge to carry data-entry-peek, then wire it with
   stopPropagation so the pill opens the ENTRIES LIST for that cell
   while the rest of the row still opens the day.

53. ~~**ABSENCE IS PREMATURE ON TODAY**~~ **FIXED V4.0.2** (the percentage was affected too). ( a day still in progress marks
   everyone who hasn't logged YET as absent. Confirmed in the
   derivation: deriveMaktabAttendance's loop
   (worker/src/maktabAttendance.js:92-105) walks maktabDays and falls
   through to statuses[date]='absent' with NO today-guard — so TODAY is
   scored the moment the threshold is met by anyone else's logs.
   BLAST RADIUS (wider than the screenshot): the same derivation feeds
   (a) the maktab journal cell that reads "Absent", (b) the ATTENDANCE
   PERCENTAGE and absent-day list on the student attendance page, and
   (c) the inactivity flag. So a student's percentage currently DIPS
   during the day and recovers when she logs — the stats are wrong, not
   just the label.
   RULE (user): absence is derived only for days STRICTLY BEFORE today;
   on today it appears ONLY if a teacher has explicitly marked her
   absent (the 'absent' status already exists in the attendance table).
   FIX: pass today into the derivation and treat today as unresolved —
   no status unless explicitly marked. The V3.98.0 Attendance screen
   already draws this line (past vs today+); this brings the derivation
   itself into agreement.
   Add a drive: a maktab day dated TODAY with no log yields no absence,
   and an explicit teacher 'absent' on today still shows.

54. ~~**ADMIN: one screen, inline editing**~~ **BUILT V4.1.0.** (openUserCard is now unreachable — a tidy-up for later.) Spec:** replace the register-form + list + per-user detail card
   with a SINGLE table, edited in place.
   COLUMNS (from the mock): Unique ID (read-only) | Name | Whatsapp |
   Role | teacher profile (checkbox) | Status (active/inactive) |
   copy (icon) | Share (icon) | Save (icon — ON A NEW ROW IT ACTS AS
   REGISTER) | Reset PIN (button) | Delete (icon, with confirm).
   Search above the table; "+ Add new student" beneath it, which
   appends a blank editable row.
   COLOUR: the mock is pink; use the app's own palette instead — the
   journal tables' header pattern (--palette-sage first column,
   --palette-mauve for the rest) is the established table language, so
   the admin table should read as a sibling of the summary tables, not
   a new visual idiom.
   NO NEW BACKEND: every operation already has an API —
   apiAdminListUsers / RegisterStudent / UpdateUser / ChangeRole /
   CreateTeachingProfile / ResetPin / DeleteUser. This is a UI rebuild
   over the existing surface.
   ANSWERED (user, 2026-09-01):
   (a) PER-FIELD AUTOSAVE on existing rows — the Save column goes; it
   was only in the mock because the old screens had both register and
   save. One toast/status per page rather than per field.
   (b) KEEP ALL EXISTING FUNCTIONALITY — so the duplicate-name guard
   (attemptAdminRegister / cancelAdminMatch) stays on the register
   path, as do copy, share, reset PIN, delete-with-confirm, the
   teaching-profile creation and the active/inactive toggle.
   (c) Role: exactly as it works now (the existing control/values).
   (d) MOBILE: TWO ROWS per user — the data fields on the first, ALL
   the icons/buttons (copy → delete) on the second. Desktop keeps the
   single wide row.
   CLAUDE'S ONE DERIVED DECISION (open to veto): a NEW row still needs
   an explicit commit, because a create needs its fields together and
   must run the duplicate check — so the "+ Add new student" row keeps
   a single register action, while every EXISTING row autosaves per
   field with no Save control at all.

63. ~~**Day-card date pill NAVIGATES**~~ **STRUCK, NOT BUILT (user,
   2026-09-01): "leave the date behaviour as is."** Recorded because
   the reasoning matters: Claude claimed the day-card pill was a mere
   LABEL against the summary's picker, and offered that inconsistency
   as an observation. It was FALSE — both are <input type="date"> with
   the same custom-display wiring (js/customDate.js:102), so both open
   a picker. The only real difference is the EFFECT (summary navigates;
   day card sets the save date), which is a design choice, not a fault.
   The user paused the build; the claim was withdrawn. LESSON: check
   the source before offering an observation as fact — an unchecked
   observation cost a queued item and nearly a wasted change.

62. ~~**MARK REGISTER sheet**~~ **BUILT V4.2.2.** ( an icon on a day's
   column opens a sheet listing the ACTIVE STUDENTS with per-student
   options — so a teacher marks several at once instead of visiting
   each student's page.
   SHAPE (Claude's proposal, open to veto): the sheet ADAPTS to the day,
   because absence means different things either side of today —
     TODAY / FUTURE → Haidh · Absent · Clear. The explicit mark is the
       ONLY way anything is recorded here (V4.0.2: today is deliberately
       unresolved), so this is where the register is genuinely taken.
     PAST → Haidh · Clear, with each student's DERIVED state shown
       (present / absent / haidh) so the teacher sees what she is
       correcting. Marking "absent" on a past day would add nothing —
       the derivation already infers it from "no log".
   Writes go through the paths that exist: haidh via the shared store
   (excuses attendance, appears in her journal), 'absent' and
   'predicted-absent' via apiSetAttendanceFor. The V3.98/V4.0.2 rulings
   stand: an informed absence never excuses.

61. ~~**Remove the background on the MAKTAB SUMMARY page**~~ **BUILT V4.2.2** (scoped). ( the grey panel behind the table.
   FOUND (Claude): it is `.screen { background: var(--surface-track) }`
   — the V3.44 colour inversion, applied to EVERY screen ("screens are
   surface-track, their content becomes white cards"). So the change
   must be SCOPED to #screen-maktabSummary; altering the shared rule
   would strip the panel from every screen in the app, which is a much
   larger decision than the one asked for. Its padding/radius go with
   the background on that screen, which also recovers the horizontal
   room the four-column table is short of on a phone (suggestion 2).

71. ~~**SCREENS STACK ON ONE PAGE**~~ **FIXED V4.2.6** (+ the 37th harness, verified by re-injecting the bug). ( Admin appears
   BELOW the calendar / the register sheet / whatever was open before —
   several screens visible at once.
   CAUSE, proven by version bisect (V4.2.0-4.2.3 clean, V4.2.4 broken):
   removing the V4.2.3 picker markup from index.html left ONE EXTRA
   </div>, which closes #appContent early. showScreen hides only
   `#appContent > .screen` (js/app.js:45), so the SEVEN screens that
   now sit in <body> — reflections, attendancePage, juzTracker, sih,
   admin, placeholder, settings — are NEVER hidden. Once shown they
   stay on the page forever.
   Pristine V3.74.5: 13 of 13 direct. Now: 9 of 16.
   FIX: remove the stray </div> in the logDetail section (~line 778-781)
   so #appContent closes after screen-logDetail as it always did.
   THE REAL LESSON — a STRUCTURAL PIN is missing: 36 harnesses, 1194
   checks, and none of them asserts the DOCUMENT STRUCTURE. Add to the
   build-stamp harness (or its own): every .screen must be a direct
   child of #appContent, and the tag balance of index.html must hold.
   Every markup removal I have done by string-slicing carried this risk
   and nothing was watching.

70. ~~**ADMIN MOBILE duplicates + version headers**~~ **BUILT V4.2.5** (the stray `update` on line 4 is on the USER's side — still to delete there). (
   (a) MY BUG: css/admin.css's mobile block holds the V4.2.2 CARD rules
   AND, immediately after them, the OLD stacked rules from V4.1.0 —
   `.admin-row-fields td::before` appears TWICE. The later copy wins, so
   the eight-deep stacking the user photographed is being re-imposed by
   my own leftovers. Cause: when inserting the card layout I replaced
   only the media query's first three lines and left the rest in place.
   FIX: delete the trailing duplicates so the card rules stand alone.
   (b) THE USER'S FILE has the bare word `update` on line 4 — not in
   Claude's copy, so it came from their side. CSS does not error on it:
   the word silently joins the NEXT selector, turning
   `#screen-admin .card-header-row {…}` into
   `update #screen-admin .card-header-row {…}` — a rule matching an
   element that does not exist. Dead, and silent. Must be deleted.
   (c) CLAUDE'S EARLIER DIAGNOSIS WAS WRONG: I blamed a stale
   deployment for the mobile admin fault. The file was deployed; the
   duplication in it was mine. Recorded so the record is honest.
   (d) USER'S REQUEST, and the right remedy for all of this: put a
   VERSION HEADER at the top of every file on edit, so the deployed
   copy can be identified at a glance without guessing. Pair it with
   the (69d) pin so the header, the ?v= tags and CACHE_NAME must agree.

69. ~~**VERSIONING SAFETY NET**~~ **BUILT V4.2.5** (36th harness). ( the user
   asked for versioning to guarantee refreshed files. FINDINGS:
   (a) index.html is CORRECT today — all 46 assets carry ?v=4.2.4, every
   CSS/JS is versioned, all 11 stylesheets linked. So the mechanism
   works and today's admin fault is a DEPLOYMENT miss, not caching.
   (b) BUT Claude's bump method is fragile: it replaces the PREVIOUS
   version string (sed s/?v=4.2.3"/?v=4.2.4"/g), so a tag that ever
   drifted to another value would be skipped SILENTLY and that file
   would never refresh again. Fix: rewrite EVERY ?v=... to the new
   version regardless of its current value.
   (c) js/sw.js's precache list is STALE — 47 entries still read
   ?v=3.67.0 and one 3.98.0. Those URLs match nothing the page
   requests, so the precache caches files nobody asks for: offline
   support has been quietly broken for months. Harmless for freshness
   (the fetch handler matches the full URL, query included), but it
   should either carry the current version or drop the query entirely.
   (d) ADD A HARNESS PIN — the real safety net: assert that every
   asset in index.html has a version, that they are ALL IDENTICAL, and
   that they match CACHE_NAME in sw.js. That turns a silent drift into
   a red test before a release ever ships.

76. ~~**LOG-DETAIL STUDENT SEARCH + NAME PILL + EMPTY SDHOR ALIGNMENT**~~ **BUILT V4.2.10 (2026-09-02):** teacher/admin Maktab log detail now has one shared **Search student** field above the Sabaq / Sabaq Dhor / Dhor rail on all screen sizes. Search reuses the in-memory summary roster, matches name/Unique ID, and switches student without losing the selected date or active card; it is hidden for PJ and read-only student Maktab views. The active student's name uses the established soft-blue pill rather than larger type. For Sabaq Dhor students with no derived history, the Juz selector and 1|2|3|4 structural switch now share a 42px height and the confirm checkbox sits in that same aligned selector row; shrink guards remain.

75. ~~**STUDENT MANAGEMENT MOBILE REGISTRATION CARD**~~ **BUILT V4.2.9.2 (2026-09-02):** mobile-only correction. **+ Register a user** now opens a purpose-built **Register a student** card rather than the desktop table row. It contains Name + WhatsApp number, Role + Group + Status, and a green Register action; duplicate safeguards remain. Desktop/tablet registration is unchanged. After success the new account remains pinned at the top and mobile search is cleared so Copy/Share are immediately available.

74. ~~**STUDENT MANAGEMENT MOBILE CASCADE CORRECTION**~~ **BUILT V4.2.9.1 (2026-09-02):** the first V4.2.9 remains the original release. Its intended mobile card CSS had two specificity leaks: the later generic `.admin-table { display:block; }` could re-show the hidden table header, and `.admin-table tr { display:block; }` could override the card field row's grid. V4.2.9.1 strengthens those two selectors only, preserving the compact four-row mobile Student Management cards while leaving desktop/tablet unchanged.

73. ~~**STUDENT MANAGEMENT MOBILE CARD REFINEMENT**~~ **BUILT V4.2.9 (2026-09-02):** mobile-only layout pass requested from the Admin screenshot. The page itself is globally renamed **Student Management** (nav/home tile + heading; the Admin role is still named Admin). On mobile the heading now copies the same clean header-card treatment as Maktab Attendance; desktop/tablet keep their existing header structure. Mobile removes the table header and the old white `.admin-wrap` underlay, then renders each user as a short four-row visual card: (1) name as the heading with no caption, (2) Unique ID + WhatsApp, (3) Role + Group + Status, (4) green Reset PIN then delete/copy/share icons. Search placeholder is simply **Search**. Desktop/tablet table layout remains unchanged.

72. ~~**SABAQ DHOR PICKER TAKES THE DHOR CARD'S FORMAT**~~ **BUILT V4.2.8 (2026-09-02):** stated in the 2026-09-02 handoff brief; this
   entry is its first record in the repo (the workspace TODO carrying it
   was lost with that session). The user's words: remove the Use button;
   the quarter dropdown becomes the 1|2|3|4 position switch; checkbox on
   the right.
   SHIPPED READING: the "1|2|3|4 switch" is the Dhor card's own
   control — a `switch-track` of `switch-option` buttons wired through
   js/uiSwitch.js (as `dhor_position_switch`, dhorPage.js:313), replacing
   the `#sdq_quarter` <select>; the Juz <select> stays; with Use gone,
   "checkbox on the right" means the picker row ends in the same
   right-hand checkbox as the section rows above it (the shared
   `1fr auto 44px` grid), and TICKING it is what applies the picked
   quarter. In quarter-word mode ("Quarter/Nisf/Thalatha arba"), the
   switch shows 1|2|3|4 and the configured unit word remains as the
   control label, so the terminology is retained without widening the
   four-position switch. Item 67's shrink guards were retained in the
   rebuilt picker and are pinned by the V4.2.8 harness.

68. ~~**MOBILE SUMMARY CARD: values wrap to one word per line**~~ **BUILT V4.2.8 (2026-09-02):** on the
   mobile card every value breaks up — "Juz 28 H1" over THREE lines,
   "2:24–2:29" over two — while the captions sit fine.
   CAUSE: my V4.2.2 rule gave the caption a fixed `flex: 0 0 92px` and
   left the value to take the rest, but the value sits in a table cell
   that was never told it may use the card's full width, so it collapses
   to its minimum and wraps at every space.
   SHIPPED FIX (V4.2.8, the user's shape): make each log line a real two-column GRID —
   caption left, value right, values aligned down the card:
     SABAQ        2:23 – 2:46
     SABAQ DHOR   Juz 4 Q2
     DHOR         Juz 28 H1
   i.e. `display: grid; grid-template-columns: 96px 1fr;` on
   .journal-cell with the caption in column 1, and `min-width: 0` +
   `white-space: normal` on the value so it uses the whole column and
   only wraps when genuinely too long.
   DEVICE-REVIEW CORRECTION (V4.2.8.1): the first build exposed the
   deeper mobile width leak: desktop `td:nth-child(...)` rules (Student
   21%, logs 24%) were more specific than the mobile `td { width:100% }`
   reset, so the stacked cells still occupied only those fractions of the
   card. Mobile now resets the nth-child widths at matching specificity.
   The user's already-correct equal-width name-pill styling on larger
   screens is left untouched; only the mobile card structure is widened.
   V4.2.8.2 FOLLOW-UP (2026-09-02): returning to the Maktab Summary could
   briefly paint a giant attendance SVG before the fresh data render, because
   item 66's instant-name skeleton omitted the `.maktab-haidh-check` wrapper
   that sizes the real icon. The skeleton now uses the same sizing wrapper.
   On mobile the first line is now a real `name | attendance` sibling grid
   rather than an absolutely positioned attendance control over a reserved
   corner of the name cell; the three log rows span underneath. Name ->
   individual summary, attendance -> attendance page, and each log cell ->
   its matching detail screen remain separate tap targets.

67. ~~**V4.2.4 PICKER WIDENS THE CARD AND BREAKS THE RAIL**~~ **IMPLEMENTED; V4.2.8 preserves the shrink guards (user confirmed 2026-09-02):** the Sabaq
   Dhor card is far wider than its neighbours and Dhor has wrapped below
   the rail.
   CAUSE: .sdq-picker spans the sections grid (grid-column: 1 / -1), and
   a SPANNING grid item's MIN-CONTENT feeds back into track sizing. Its
   minimum is set by two <select>s — whose intrinsic width is their
   longest option — plus the Use button, and NOTHING can shrink: neither
   .sdq-picker nor the selects carry min-width: 0 (only .sdq-field
   does, which is not enough — the select itself must be allowed to
   shrink). So the grid widens, the card widens, the rail breaks.
   SHIPPED/PRESERVED FIX: min-width: 0 on .sdq-picker AND on .sdq-field select; let the
   row wrap (it already may). Verify the card returns to the rail's
   third and that the picker still reads sensibly when narrow.
   PATTERN NOTE, twice now on one feature: V4.2.3 was a FLEX placement
   fault, this is a GRID sizing fault. Both are "the new element takes
   width the neighbours needed". Whenever something is added to an
   existing layout container, check what it does to the container's
   sizing — not just that it looks right by itself.

66. ~~**INSTANT NAMES on the maktab summary**~~ **IMPLEMENTED (user confirmed 2026-09-02):**
   returning to the summary shows "Loading…" until one round trip
   completes — apiMaktabSummary returns the roster AND the day's logs
   together, so the names wait on data that has nothing to do with them.
   SHIPPED SHAPE: cache the ROSTER (id, name, track_haidh) from the last
   successful load; on entry paint the rows from it IMMEDIATELY with
   empty log cells, show a LOADING STRIP under the header row, then fill
   the cells when the response lands.
   IMPLEMENTED DECISIONS:
   (a) Cache the ROSTER ONLY — never the log cells. Names change rarely;
   a day's entries change constantly, and stale entries on screen are
   worse than a short wait, because a teacher could act on them.
   (b) Memory only (a module variable), NOT localStorage. It covers the
   case asked for — returning to the screen within a session — without
   leaving a maktab's student names on the device, which matters on a
   shared or borrowed phone. A cold start still waits once.
   KNOWN COSMETIC EDGE: if the roster changed since the last visit, a
   removed student can flash for the round trip's duration before the
   fresh list replaces her. Acceptable; noted so it isn't a surprise.
   V4.2.8.2 NOTE: the separate giant-attendance-icon flash in this cached
   paint was a markup mismatch, not stale data; fixed by wrapping the interim
   SVG in the same `.maktab-haidh-check` sizing class as the finished row.
   (b2) NAME PILLS ALL ONE SIZE (user, same message): today each pill
   hugs its text, so a column of them is ragged. Give .maktab-name-pill
   a shared width — it fills the name column (display:block / width:100%
   rather than shrink-wrapping. Long names then need
   a decision: V4.2.8 is trialling ELLIPSIS with the full name in a title
   attribute, so every row stays one line high and the table's rhythm
   holds.

65. ~~**V4.2.3 PICKER IS IN THE WRONG CONTAINER**~~ **FIXED V4.2.4** — resolved by the user's option 2: the picker became the rows block's EMPTY STATE, so the container question disappeared entirely. ( the picker WORKS (the
   preview reads 1:1 – 2:46 correctly) but it crushed the card:
   suggestion pills squeezed into ovals with wrapped text, the picker
   sitting BESIDE them instead of below.
   CAUSE: I inserted it inside `.sabaq-dhor-sections-row`, which is a
   FLEX row (rollup stepper · sections list, css/detail-pages.css:628).
   A third flex child takes its own share of the width, so the sections
   list lost most of its own — nothing to do with the picker's styling.
   FIX: move the markup OUT of that flex row, to a sibling AFTER it, so
   it lands below the whole From/To block as specified. No CSS change
   needed; the picker's own rules were fine.
   TEST-GAP NOTE: the harness pins asserted the picker came after
   `sabaqDhor_sections` in source ORDER — true, and useless, because
   source order says nothing about flex placement. A pin should assert
   the picker is NOT a child of the flex row.

64. ~~**SABAQ DHOR: a juz/quarter selector**~~ **BUILT V4.2.3.** ( add a selector like the Dhor card's —
   pick a juz and a position rather than typing an ayah range.
   FEASIBILITY (Claude): the conversion already exists and is shared —
   quarter/half/rub boundaries and segmentRangeForUnitIndex live in
   shared/data.js, which is how Dhor resolves its own picks into a
   range. So this is a UI addition over proven code, not new logic.
   ANSWERED (user, 2026-09-01) — the WHY, which settles all three:
   the existing card serves a student WITH sabaq history; the picker is
   for a student who HAS MEMORISED but has no journal history yet, so
   the suggestion rows have nothing to offer her.
   (a) ADDITIONAL, not a replacement: it sits BELOW the From-ayah /
   To-ayah section. Both remain.
   (b) A JUZ + QUARTER picker (the wording taken literally: quarter
   positions within a juz, as Dhor's Quarter unit does).
   (c) It does NOT compete with the suggestion rows — those derive from
   history this student does not have. It should read as its own thing:
   choose the juz and quarter directly, and it FILLS the From/To ayah
   fields (the stored shape is unchanged: from/to surah+ayah), so the
   save path, the merge logic and every downstream reader stay as they
   are.
   NOTE for the build: the terminology follows the student's mushaf —
   the card already says Quarter/Half for IndoPak and Maqra/Rub for
   15-line Madani (migration 0017). The picker must use HER words, not
   a hardcoded "Quarter".

60. ~~**MOBILE PASS**~~ **BUILT V4.2.2.** (
   (a) MAKTAB ATTENDANCE (the week screen): on mobile show ONE DAY PER
   SCREEN, swipe to the next — only the current date visible. Today's
   four stacked cards are a long scroll. (Desktop keeps its columns.)
   (b) STUDENT ATTENDANCE header: the card reads "Attendance — Amina
   Aslam" and WRAPS onto two lines. Move the word "Attendance" ABOVE
   the card as the page title; the card then carries ONLY the student's
   name, at a slightly smaller size, forced onto ONE line (no wrap;
   ellipsis if it must).
   (c) MAKTAB SUMMARY on mobile: ONE COMPACT CARD PER STUDENT (user
   accepted Claude's suggestion 1) — the name pill currently OVERLAPS
   the sabaq text (screenshot 3: "Hajira Naidu" over "3:187–3:200"),
   and stacking lines alone would only make four squeezed columns
   legible, not comfortable. Card shape: the NAME (its blue pill) on
   the first line with the attendance icon; beneath it Sabaq / Sabaq
   Dhor / Dhor as small-captioned lines, in the admin card's idiom
   (caption above value). Every existing tap target survives: the name
   opens her summary page, each log line opens ITS OWN card, the rest
   of the card opens the day view, and the +N entry pill still peeks.
   The header row hides on mobile (there are no columns to label).
   Desktop keeps the table exactly as it is.
   (d) ADMIN on mobile: drop the header row entirely and give each user
   their own CARD, four rows:
       1. Unique ID — small grey text
       2. Name · WhatsApp
       3. Role · Group · Status
       4. the action icons/buttons
   LABELS (user, clarifying): each input keeps a SMALL EXPLANATORY LABEL
   ABOVE it — so the card is compact by LAYOUT (four rows, fields side
   by side within a row) rather than by dropping labels. Today's problem
   is one label + one field per LINE, stacked eight deep; the fix is
   grouping fields onto four rows, each field still captioned.

58. ~~**ADMIN table column fit**~~ **BUILT V4.2.1** (two tables, one colgroup). ( now that V4.2.0 renders, three fit faults:
   (a) NAME and GROUP truncate ("Naseema La…", "No grou…") — the
   fixed-layout table shares width equally, so Name gets no more room
   than the checkbox column. Name must be the widest by a clear margin.
   (b) HEADER CELLS MISALIGN with the body columns ("TEACHER PROF" cut
   off, sitting over the wrong cells) — the header is a flex row and
   the body a fixed table, sizing independently. They need ONE shared
   set of column widths: a <colgroup> on the table plus matching
   flex-basis on the header cells (or the summary's approach of one
   class on both).
   (c) DELETE ICON is cut off at the right edge — the actions cell
   exceeds its share and the Reset PIN button is far wider than its
   text. Shrink the button to content; give actions a fixed honest
   width so delete is always visible.

59. ~~**ADMIN: register-as-first-row, teacher column retired**~~ **BUILT V4.2.1** (+ new user pinned to the top; openUserCard removed). (
   (a) CORRECTED (user): the Role select KEEPS Student / Teacher /
   Admin. So "remove the option to promote to teacher" must mean
   something else — most likely the TEACHER-PROFILE CHECKBOX column
   (the V3.77.0 (j) mechanism that creates a separate …TEACHER account
   so a student can hold both a student PJ and a teaching profile).
   CONFIRMED (user, 2026-09-01): she has tested that the ROLE select
   already promotes a student to teacher or admin directly, without a
   teaching profile — so the Teacher-profile checkbox column is
   redundant for her maktab and is REMOVED. The trade was stated and
   accepted: promotion is by role change (one account), not by a
   second …TEACHER account. Existing …TEACHER accounts remain as
   ordinary rows (they are real accounts); only the create-column goes.
   The worker endpoint (apiAdminCreateTeachingProfile) stays in place
   unused — removing an API is a separate decision.
   (b) RENAME "Register a student" → "Register a user".
   (c) MOVE the register action to the TOP of the table (it is beneath
   it today).
   (d) Pressing it opens the new user as the FIRST ROW of the table —
   inline, in the same columns: NAME, WHATSAPP, ROLE (Student/Admin),
   GROUP — plus a REGISTER button in that row. The duplicate-name guard
   (attemptAdminRegister / Continue / Cancel) must survive the move:
   its hint and two buttons appear beneath the new row when a match is
   found, with Continue re-submitting whatever the row currently holds
   (the V3.4.2 semantics). The separate register box is then removed.

57. ~~**Student names as light-blue PILLS**~~ **BUILT V4.2.0.** ( the names read as plain text though tapping
   one opens her day — give them the app's light blue
   (--color-accent-soft / --palette-sky, the same fill the selector
   family and the year pill wear) in a rounded pill, so they read as
   the buttons they already are. Target: .maktab-student-name
   (css/journal-table.css:255; set on the cell in
   js/maktabSummary.js:278) — note the pill should wrap the NAME, not
   the whole cell, which also holds the attendance icon.

56. ~~**ADMIN table overflows its card**~~ **BUILT V4.2.0** — resolved the user's way: the card removed and the summary's shape adopted, so no width override was needed at all. ( the header and rows spill past the white card's right
   edge — the screen is capped at 30% on desktop and an 8-column table
   cannot fit it.
   (a) WIDEN the admin screen to 80%. TRAP (Claude): the 30% is the
   SHARED token --width-desktop, used by seven .screen-content screens
   AND the login card (css/base.css:72 and :243, components.css:115).
   Changing the token would widen the WHOLE APP — so the 80% must be
   SCOPED to #screen-admin, leaving every other screen untouched.
   (b) The table must sit INSIDE the white card, header and rows
   together — the card contains it (with horizontal scroll on narrower
   desktops rather than overflow), not be overrun by it.

55. ~~**MAKTAB IS THE TEACHER'S HOME**~~ **BUILT V4.1.1.** (
   closing a screen returns a teacher to the generic Home page, which is
   an unnecessary step in daily use — the maktab summary should be the
   de facto home for a teaching profile.
   FOUND (Claude): LANDING is already right — bootApp (js/app.js:189)
   sends a teaching profile to maktabSummary on login. Only the CLOSE
   paths are wrong, and there are three:
     (a) js/app.js:270 — the generic wiring for every .screen-close-btn
     (b) js/logDetailScreen.js:41 — the day card's own close
     (c) js/auth.js:231 — the menu's HOME button (deliberate, V3.74.1:
         "a button labelled Home goes Home") — LEAVE THIS ALONE.
   FIX: one helper (e.g. homeScreenFor()) returning 'maktabSummary' for
   a teaching profile and 'home' otherwise; (a) and (b) use it. A
   student's close behaviour is unchanged.
   CLAUDE'S READING, open to veto: the Home nav item stays in the menu
   and still goes to the real Home — a teacher may want the personal
   journal; this changes only where CLOSING lands. **BUILT V3.85.0
   (2026-08-28)** — option (c) interleaved rail; both history buttons
   below Notes; the dhor swap. Original note:** — the user flagged it absent
   on V3.82: correct, it is queue item 4 (notes history + button moves,
   option (c), BUILD-READY) and simply not yet built. No spec change.

## The ATTENDANCE PAGE — BUILT V3.80.0 (2026-08-28; the original list-of-11 intent behind item 5)

The user's recollection of the original discussion — item 5 as recorded
(haidh icon → haidh calendar link, built V3.76.0) was NARROWER than the
intent. The full page, stated 2026-08-28:

- **The summary's leading icon changes:** the haidh icon (haa'idah only)
  is REPLACED by an ATTENDANCE icon on EVERY student, every day. It
  navigates to the attendance page for that student.
- **The page contains, top to bottom:**
  1. **% Present over the last 4 weeks** — present = activity logged OR
     haidh. Denominator = MAKTAB DAYS in the window.
  2. A **button showing the history of days absent** (absent = a maktab
     day with neither activity nor haidh).
  3. **The haidh calendar below** (haa'idah only — the same shared
     calendar, reached from here now instead of its own summary icon).
  4. **Haidh history: the dates of the last 3 haidh ranges.**
- **DEFINITION (user, 2026-08-28, applies from now on): "day" = MAKTAB
  DAY** — a day when the minimum number of students had activity logged
  (the existing derived `isMaktabDay`). **Haidh calculations still use
  calendar days.**

Implies a worker endpoint computing the window server-side (per-student:
maktab days in the last 28 calendar days, present count, absent dates,
haidh ranges) rather than 28 frontend calls.

**Answers (2026-08-28) — built accordingly:**
1. Non-haidh students: %-present + absent history only (assumption stood).
2. Absent-days history: the SAME PERIOD as the % calculation (follows
   from the period model below).
3. Last-3 haidh ranges: CONFIRMED runs only (assumption stood).
4. **The student gets this page too** — her own attendance, same layout.
   Placement (Claude's call at build): a nav item alongside her Maktab
   journal item, same gating.

**The period model (user, 2026-08-28):**
- **Maktab Settings (General card) gains "Current term" — a date
  FROM/TO selector.** That term is the DEFAULT attendance period ("the
  easiest way to set term dates"). → migration 0025: `term_from`,
  `term_to` on `maktab_settings` (additive).
- **The attendance page gains a custom FROM/TO option** to calculate
  over any period.
- Fallback while no term is set: the last 4 weeks (the originally
  stated default).

## Maktab Settings as a 3-card rail + group descriptions — BUILT V3.79.0 (2026-08-28)

From the user's schematic (screenshot, 2026-08-28). Spec retained below as
the record.

**Maktab Settings becomes a THREE-CARD RAIL like the day view** (user,
2026-08-28, correcting an earlier typo: "Maktab settings becomes a 3 card
rail like the day view"): General / Tajweed / Groups as horizontally
snapped cards with the pill strip on top jumping between them — the same
rail pattern the maktab day view uses for its cards. The schematic's three
panels are the three cards:
- General: maktab name, time zone, mushaf, maktab-day minimum, absence-flag
  days. One SAVE top right.
  - **Timezone control (user picked option 3, 2026-08-28):** the V3.78.0
    400-entry select goes. The card shows the current setting plus a
    one-tap button "Use this device's timezone (<Intl resolved zone>)";
    under it, "choose a different zone" reveals a TYPE-AHEAD (text input +
    datalist of every IANA zone) for the travelling-admin case. Empty
    still clears to "not set". The worker's Intl validation (V3.78.0)
    stays the backstop for anything typed.
- Tajweed: add-row (input + ADD) on top; each tag = editable NAME INPUT +
  MAJOR/MINOR toggle pill + RETIRE checkbox. **NO Save on this tab**
  (user, 2026-08-28: "keep the existing save, remove the save from tajweed
  and groups") — every control commits INSTANTLY: pill and checkbox on
  tap, name input on blur/Enter (rejection restores the old value, error
  against the row). The browser rename-prompt goes.
- Groups: same shape; each group = NAME + **DESCRIPTION** inputs + RETIRE.
  No Save; same instant-commit semantics.

**Groups gain a description** → migration 0024 (additive:
`ALTER TABLE maktab_groups ADD COLUMN description TEXT`), worker list
endpoints carry it, settings tab edits it.

**Questions — all answered:**
1. ~~"Maktab history becomes a rail"~~ RESOLVED 2026-08-28: a typo — it
   read "Maktab settings becomes a 3 card rail like the day view". Built
   into the heading above; no history feature involved.
2. ~~Description display~~ ANSWERED 2026-08-28: info-only — shown on the
   Groups card and NOWHERE else (not the admin select, not search results).
3. ~~Save semantics~~ ANSWERED 2026-08-28: General keeps its Save; the two
   list tabs have none — instant commit throughout, as above.

## The list of eleven (stated 2026-08-26) — four phases. PHASE 1 BUILT (V3.75.0); 2, 3, 4 NOT BUILT

Recorded here in V3.75.0. The docs-only V3.74.6 that was meant to carry this
list was never built — the chat that drafted it ran out of space — so until
now the list existed only in the user's pasted transcript.

**User's build order, each phase shipped and tested before the next:**
"Phase 1 first because it's cheap and clears the noise — including the error
message that would have told you what went wrong with haidh today. Phase 4
last because it's the only irreversible one, and because tags and groups
share a shape: an admin-managed list, ID-referenced, retire not delete.
Building groups first makes tags cheaper." (j) still touches the summary
roster (why ADMIN-01 appears as a student): if it lands before phase 3,
groups and the roster filter are one pass over that screen instead of two.

| # | Item | Phase | Status |
| --- | --- | --- | --- |
| 1 | Admin header — icon+heading left, close right | 1 | **BUILT V3.75.0** — id-scoped `#screen-admin` rule; `.card-header-row-left` deleted (never won the cascade); base.css grid line removed — it had ALSO broken Tadabbur and Haidh |
| 2 | Move to Dhor — HIDDEN until all four quarters complete, then "Move Juz N to Dhor". No disabled state, no "(2 of 4 complete)". User's call, reversing V3.74.3's visible-but-inactive (Claude's own reasoning) | 1 | **BUILT V3.75.0** |
| 3 | PTP (Public/Teachers/Private) pill — shorter | 1 | **BUILT V3.75.0** — root cause: settings.css's base `.switch-track{height:42px}` loads later and beat the single-class rule; V3.74.4's 20px never applied. Now `.cb-note-box .mk-vis-switch`. **Lands at 20px — say if a different height is wanted** |
| 4 | `+1` badge wired directly | 1 | **BUILT V3.75.0** — delegated listener ran AFTER the row's, so the day view opened anyway; now on the button |
| 5 | Attendance page: the summary's haidh icon becomes a LINK to the student's haidh calendar — the existing Haidh screen SHARED under the maktab log context (Option A reuse, as the day view). Haidh marked as a RANGE (user's call 2026-08-27), under the worker's rules; the single-day toggle flow deleted. The day-card toggle had already gone in V3.73.0 | 2 | **BUILT V3.76.0** — worker + frontend (mark-range gained the teacher override; the "frontend only" note was wrong for the range write). ~~Behaviour change: a teacher no longer gets a confirm-to-override on the 14-day gap~~ — override restored as a three-way decision in V3.76.2 |
| 6 | Surface the worker's real error (the fixed alert made the 2026-08-26 haidh failure unreadable) | 1 | **BUILT V3.75.0** — both haidh alerts + summary load failure carry `e.message` |
| 7 | Tajweed tags — maktab-stored rows with IDs, rename propagates, retire replaces delete | 4 | **BUILT V3.78.0.** Answers: unmatched words DROPPED; browser custom tags NOT imported; the destructive clear is migration 0023, run after verification |
| 8 | Groups — one per student, names in Maktab Settings, assigned on her admin card, summary ordered by group with a SPACE between groups | 3 | **BUILT V3.78.0.** Ungrouped sit LAST (answered); the space is a spacer row |
| 9 | Summary search — a way TO a student; pick a result → her day view on the summary's PICKED date | 3 | **BUILT V3.78.0** |
| 10 | Teacher name in the History rail | 1 | **BUILT V3.75.0** — shown under any entry carrying `teacher_name` |
| 11 | Spacing above the note boxes | 1 | **BUILT V3.75.0** — `--space-md`, matching the PJ notes header |

**Plan as REVISED 2026-08-27 (user's), three deliveries, in order:**
1. **Phase 2** — item 5. **BUILT V3.76.0.**
2. **(j) Account separation** — **BUILT V3.77.0.** Testing resumes.
3. **Groups + tags + shared timezone — BUILT V3.78.0** (migrations 0022 +
   0023; 0023 run separately after verification): items 8, 9, 7 and the timezone
   setting (a fifth `maktab_settings` column). Tags' destructive step (clear
   the old word column) is its OWN migration file, run only after converted
   tags are seen on a real entry.

**Answers given 2026-08-27:** groups — ungrouped students sit LAST, no
heading. Tags — a word on an existing entry that matches no tag in the new
list is DROPPED; custom tags in browser storage are NOT imported. Still
ANSWERED 2026-08-27 for delivery 3: **everyone sees maktab time** —
built so in V3.78.0.

**Haidh, V3.76.2:** the teacher's override is BACK, as a three-way decision bar
in the maktab calendar (haidh anyway / absent / adjust dates) on a gap
refusal — `override_gap` skips the gap rule only; teachers only; the
student's own calendar keeps the plain rules.

**Haidh rule, V3.76.1 (device bug 2026-08-27):** a future PREDICTION never
vetoes a real mark; a confirmed mark deletes predictions in the 14-day window
after it (user's call). Worker-side; the browser only surfaces the message.

**Haidh data model, confirmed 2026-08-27 as the design to build on:** there
is NO maktab-side haidh record. Haidh lives only in the student's PJ
`attendance` table; the maktab reads it live (one of the two permitted
PJ→maktab inputs) and derives its own attendance at read time. A teacher's
mark IS a PJ row. A maktab-side haidh/attendance table would be a design
change (which side wins, derivation rewritten) — not decided, not built.

## Dhor card UI changes (stated 2026-08-26) — BUILT, V3.73.0–V3.74.2 [heading corrected V3.76.0: it still read NOT BUILT two deliveries after it shipped]

Collected together deliberately: these land on the same card as the
Plan-button takeover above, so they should be ONE delivery to that card, not
two passes over it.

**1. Note visibility becomes a compact 3-way switch, inside the note box.**
Today Public / Teachers / Private are three full-size radios sitting above
the note, too large and visually unconnected to the box they govern.

- **Reuse the existing segmented control** — `.switch-track` +
  `.switch-option` + sliding thumb, the same component as the
  Quarter / Half / Juz portion selector (`index.html:521`). Not a new
  control.
- **`.switch-track-small-wide` ALREADY EXISTS and is currently UNUSED**
  (`css/detail-pages.css:827` — 34px tall, `max-width: 220px`, 13px
  options). It was built as a compact variant and never wired to anything.
  Use it; no new CSS needed for the sizing.
- **Place it in the note box** so it reads as belonging to the note. That is
  semantically right, not merely tidier: the setting governs who can see the
  NOTE, not the entry.

**CORRECTION to an earlier note in this entry:** I flagged that these labels
might read wrongly on the PJ card. They do not — the radios are rendered by
`js/commentPrivacy.js` with `aria-label="Teacher note visibility"`, i.e. they
govern the TEACHER's note and are maktab-side. No PJ wording problem to
check.

**Locate when building:** the three radios are not in `index.html` — they are
rendered from JS, so the markup change is in the notes renderer rather than
the static card.

**2. THE MAKTAB WILL NOT READ STUDENT NOTES (stated 2026-08-26).** This
drops one of the three permitted PJ→maktab inputs, leaving two (the sabaq_to
extension and haidh). Directionally consistent with the separation being
built — one less place the maktab reaches into her journal.

**What becomes dead and should be deleted, not left dangling:**
- `js/maktabDay.js:148-154` — the `pjNoteFor` helper, the
  `setLogCtxPjNotes(...)` call, and the `Promise.all` of **three**
  `apiGetPJLogsFor` fetches. **Every maktab day-view open currently costs
  three extra API calls for this feature alone**; removing it is a real
  latency win, not only tidying.
- `js/logContext.js:210-211` — `setLogCtxPjNotes`, `logCtxPjNote`, and the
  `LOG_CTX_PJ_NOTES` state.
- `js/commentPrivacy.js:65` — the `pjNote` read.
- `apiGetPJLogsFor` does NOT become dead: `maktabDay.js:121` still uses it
  for the sabaq_to extension, which stays. Do not delete the client.

**DECISION NEEDED — the plain reading is not the only one.** After this,
`commentPrivacy.js:66` still falls back to
`existingEntry.student_comment`: a student note FROZEN onto a saved maktab
row by an earlier version. That is maktab data now, sitting on a maktab row,
not a read into her journal. So:
- **(a)** stop the live PJ lookup, keep showing notes already frozen onto
  existing maktab rows — the literal reading of "will not read student
  notes"; or
- **(b)** also stop displaying those, hiding data already stored on maktab
  rows.
**DECIDED 2026-08-26: (a) — leave them.** The data already lives in the
maktab's own records, and hiding it would mean entries visible today showing
less tomorrow with nothing explaining why. Going forward it makes no
difference: once the lookup is gone, no new entry captures a note.

**3. REMOVE THE HAIDH ICON FROM THE DAY CARDS (stated 2026-08-26).** It stays
on the summary only. The icon sits in the student-name row painted into each
of the three cards (`js/maktabDay.js:84,100-103`).

**IT IS A CONTROL, NOT A BADGE — say so plainly to anyone building this.**
`data-haidh-toggle` marks and clears haidh, including the 15-day gap
`confirm()` at `maktabDay.js:55-57` and the clear-failure alert at `:75`.
Removing it from the day cards therefore removes **one of the two places a
teacher can mark haidh**, leaving the summary's leading-column toggle as the
only one. That is a behaviour change, not a tidy-up.

**Consequence, raised with the user:** a teacher already inside a student's
cards who needs to mark haidh must back out to the summary, mark it, and come
back in. Accepted as the cost of having one place to do it rather than two.

**When building:** the toggle FLOW is shared with the summary
(`maktabDay.js:17` says so explicitly), so delete only the day-card
rendering and its wiring — not the shared handler, which the summary still
needs. Check whether the whole name row becomes empty; if the name is the
only thing left in it, decide whether the row still earns its space, the same
question the Home header row raised in V3.69.0.

**MORE UI CHANGES EXPECTED FOR THIS CARD** — the user has others to describe.
Do not start building the Dhor card until the list is complete; that is their
stated preference (gather the full spec for a well-defined change rather than
rebuilding after each new detail).

## Maktab Setup takes over the Dhor card's Plan button (stated 2026-08-26) — BUILT, V3.72.0 (`dhorPlanBtnIsSetup`, `#screen-maktabSetup` deleted) [heading corrected V3.76.0]

**SUPERSEDES two earlier approaches in this file — do not build either.**
The popup-via-`enterEditScreenMode` spec and the separate "move the Setup
chip to the Dhor card" spec are both replaced by this, which does the same
job with no new UI at all.

**In maktab mode, the Dhor card's "Plan" button becomes "Setup"** and its
existing slide-up sheet hosts the setup content. In PJ mode Plan is
untouched.

**This costs nothing, because Plan is ALREADY DEAD in the maktab** — the
user's instinct, confirmed in the code. `js/dhorPage.js:886` carries a
V3.64.0 comment stating the upcoming-plans queue is a PJ-only concept (the
maktab has no plans table — migration 0019's header) AND is auth-token-keyed,
so in maktab mode it would show the TEACHER's queue on a student's card; it
was deliberately left at the empty default. So the maktab's Plan button today
opens a sheet with nothing in it. Repurposing it removes a dead control and
gains a live one in the same move.

**Everything the earlier specs worried about dissolves:**
- **Placement** — the button is already on the Dhor card, where Setup
  belongs. No chip to move off the summary row.
- **Return path** — a sheet closes back to the card underneath. No routing,
  no student/date context to carry.
- **The X** — the sheet already has its own close affordance in the right
  place. No screen-level close button floating above a card.
- **The heading** — the sheet is launched from her own Dhor card, so the
  name needs no repeating, as agreed.

**Still to settle when built:**
- The old `#screen-maktabSetup` section becomes unreachable once nothing
  opens it. Delete it with its `.card-header-row`, `maktabSetupName`
  population and `screen-close-btn`, rather than leaving a second way in.
- `openPlanDhorModal` currently loads the pool via `logProfile()` for the
  plan preview; the setup content needs the same pool but for editing.
  Reuse the routed read — do NOT reintroduce an own-only profile call.
- Saving REPLACES the pool, so keep the existing explicit confirmation
  wording; a sheet is easier to open by accident than a screen was.

## FIELD VERIFICATION — V3.71.0 in production (2026-08-17)

**CONFIRMED WORKING by the user, testing as admin against maktab records:**
Sabaq, Sabaq Dhor and Dhor — entries save and **histories show the STUDENT's
rows, not the teacher's**. That is delivery (i) working in production, and it
closes the 2026-08-17 field report ("logged a Dhor for Umme, showed on the
summary but not in her history"). **Cause confirmed as the missing V3.68.0
cache bump** — a warm-cache browser was still running V3.67.0 JavaScript, so
the rails were still calling the own-only client. Not a code defect in
V3.68.0 itself; a delivery defect in how it shipped.

**STILL UNCONFIRMED: the server-side Dhor pool write.** Working histories
prove the READS are routed; they say nothing about the pool. V3.68.0 deleted
the client-side pool write and moved the merge into `handleSaveDhor`, so if
the WORKER did not deploy alongside the frontend, entries still save and
histories still look perfect while the pool silently stops growing.
**The one check that distinguishes it:** after logging a Dhor for a student,
her Dhor prepop should advance past the portion just logged. If it offers the
same portion again, the worker is behind.

**Deployment mechanics are undocumented and were being INFERRED.** `SETUP.md`
is referenced three times in CHANGELOG.md's own header and **does not exist
in the repo**; there is no CI config, no `.github`, and a Pages GitHub
integration would live in the Cloudflare dashboard rather than here. So
whether a repo push deploys the worker too is unknown — write it into
`SETUP.md` once established, so it stops being guessed at each time.

## MIGRATION STATUS — hifzhelper-maktab1 (confirmed 2026-08-17)

**All delivered migrations are RUN. Nothing is pending. Do not re-run.**

| Migration | Delivered | Status on `hifzhelper-maktab1` |
| --- | --- | --- |
| `0019_maktab_tables.sql` | V3.57.0 | RUN |
| `0020_maktab_settings.sql` | V3.65.0–V3.67.0 | RUN |
| `0021_maktab_position.sql` | V3.65.0–V3.67.0 | RUN |

Read this block before any "run the migration first" instruction found
elsewhere in this file. Those instructions were written at delivery time
and are preserved inside the `## Done — V3.xx` entries as a record of what
each delivery required — they are history, not an outstanding action. This
block is the current state; the Done entries are not.

Maktab deployment only — the fork note applies (`hifzhelper-personal-db`
diverged at V3.57 and takes none of these).

## Design — Maktab records (Phase 2): design COMPLETE 2026-08-15 — splits into deliveries (a)–(f) below, each still needs its own build-ready spec + "start building"

Much bigger than anything else on this file (new tables, new
endpoints, a new screen, a role-hierarchy change, derived attendance)
— so this is a design entry, not a build spec. Everything below the
"agreed" line is confirmed in chat; the "still open" list is what
stands between this and "start building".

**Agreed:**
- Maktab summary page = summary of a Hifz day. First column student
  names; remaining columns the SAME headings as the personal journal
  (PJ) — Sabaq | Sabaq Dhor | Dhor, matching css/journal-table.css.
- Prepopulation same as the PJ's, and live: a student editing their
  PJ entry changes what the teacher sees prepopulated — UNTIL the
  teacher saves. A saved maktab log means the teacher actually
  listened, so it FREEZES: later PJ edits change nothing; if wrong,
  the teacher edits the maktab log. So a maktab log is a COPY at save
  time, not a live reference to the PJ row.
- Students recite sabaq to one teacher, sabaq dhor to different
  teacher(s), dhor to one or more others — one student's day may be
  assembled from many teachers' saves (more than 3 is normal). Each
  teacher confirms + saves. Only teachers' logs are seen by the maktab.
- Maktab record is completely independent of the PJ. PJ feeds ONLY:
  prepop, notes (if not private), and haidh. Each student sees PJ and
  maktab journal as two separate things.
- Every maktab log stores the saving teacher's ID and name.
- Teachers may also have their own PJ and be students in the maktab
  — role is just a column on the one `students` table (`role IN
  ('student','teacher','admin')`, migration 0007), so a teacher
  already IS a students-row with a PJ; no separate teachers table.
- A teacher CANNOT log their own hifz in the maktab — another teacher
  must (enforce server-side: teacher_id !== student_id).
- Maktab entries logged AND edited by teacher level or higher.
- **Admin counts as teacher EVERYWHERE** — not just in new maktab
  code. Traced (2026-08-15): today the worker gates on
  `auth.role === 'teacher'` / `!== 'teacher'` ONLY, in 12 places
  across attendance.js, dhorLog.js, plans.js, position.js,
  reflections.js, sabaqDhorLog.js, sabaqLog.js — an admin does NOT
  currently pass any of them. Adopting this = one shared
  `isTeacherOrAbove(auth)` helper in utils.js and all 12 call sites
  switched to it. Worth doing as its OWN small delivery ahead of the
  maktab build (it's independently correct and touches already-live
  code) rather than buried inside it.
- Maktab has its OWN attendance, DERIVED not stored: present is
  assumed; a student shows haidh if their PJ has haidh that day,
  else absent if no maktab log captured. **Log wins over haidh**
  (same "sabaq always wins" rule as the PJ). A "maktab day" only
  exists once ≥ N distinct students have any log — N=3 for now,
  arbitrary, WILL change → a config value, never hardcoded. On a
  non-maktab day nobody is absent. Maktab days = the dates actually
  recorded in the DB.
- This CLEANLY resolves the "does unset mean absent?" question from
  the same session: PJ attendance stays stored (unset ≠ absent, one
  row per date); maktab attendance is computed at read time from the
  logs + the PJ's haidh marks + the ≥N-students rule. Different
  mechanisms, no conflict — the V3.54.0 PJ sync entry below is
  unaffected. And because maktab attendance is derived, editing/
  deleting a maktab log needs NO attendance-sync counterpart at all —
  it just falls out.

**Agreed 2026-08-15 (second round):**
- Storage: THREE tables mirroring the PJ's own split
  (maktab_sabaq_log / maktab_sabaq_dhor_log / maktab_dhor_log —
  naming TBC), not one table + type column. Chosen over Claude's
  one-table lean. Upside: the maktab modules become near-clones of
  the PJ's proven `logHelpers.js`/`dhorLog.js` shape, each with its
  own field list. Cost: the derived-attendance "any log for
  student+date" query is a 3-table UNION, exactly the shape
  `releaseAttendanceIfNoActivity` (V3.54.0) already uses — so it's a
  known, tested pattern, not new ground.
- Edit permissions: ANY teacher (+admin) can edit any maktab log,
  not just the saving teacher. So the saved teacher_id/teacher_name
  is provenance (who confirmed it), not an ownership lock.
- The ≥N-students threshold lives in a worker env var (redeploy to
  change), chosen over Claude's DB-row lean.

**Agreed 2026-08-15 (third round):**
- **No requirement for every student to have a PJ.** The maktab is
  therefore genuinely independent of it — a PJ-less student is fully
  loggable in the maktab. Students WITH a PJ additionally get: prepop
  into the teacher's form, haidh flowing across, and non-private notes
  flowing across. That's the complete list of what the PJ contributes.
- **Prepop is an independent CALCULATION, not a copy** — and it
  calculates from the MAKTAB'S OWN history, copying the PJ's logic.
  Confirmed against how the PJ works today (traced 2026-08-15): PJ
  prepop is already a per-page calc, not a stored value — Sabaq from
  the last reached point in sabaq history (js/sabaqPage.js), Dhor
  from computeDefaultDhorEntry / the dhor schedule queue
  (worker/src/dhorSchedule.js), etc. So the maktab reuses those same
  calcs pointed at the maktab_* tables instead of the PJ ones. A
  student's first-ever maktab entry with no maktab history gets the
  same cold-start defaults the PJ uses (e.g. sabaq's 114:1/114:6).
- **"Haidh and a log cannot co-exist — one or the other."** Resolved
  the same way as the PJ's "sabaq always wins": a teacher's save
  OVERWRITES the haidh mark. Not a reject, not a priority-to-haidh —
  the log lands and the haidh mark is gone for that student/day. So
  the earlier open item 4 (badge vs hidden) is moot: there's never a
  present-with-haidh state to display, the summary just shows the
  log.
- **Student notes:** a non-private PJ `student_comment` flows into
  the maktab log; private ones don't. Uses the PJ's existing
  `student_comment_private` flag — no new column. AND: **PJ notes
  change to PRIVATE by default** — today `student_comment_private`
  is `NOT NULL DEFAULT 0` (open) per migration 0006. This is a
  change to the LIVE PJ, not maktab work: a migration flipping the
  column default + the frontend's own default on the comment field.
  Own small delivery, ahead of the maktab build, same as the
  isTeacherOrAbove refactor.
- **Teacher notes:** three visibility options — private / open /
  teachers-only — DEFAULT teachers-only. Reuses the PJ's existing
  `teacher_feedback_visibility` enum EXACTLY: `('all','teachers_only',
  'private')` with `applyPrivacy` in logHelpers.js already
  implementing the semantics (teachers_only visible to any teacher;
  private only to its author) — no new enum, no new logic. One real
  difference to note: the PJ's default is `'all'`, the maktab's is
  `'teachers_only'`. Admins are teachers with additional authority
  for all of this — nothing admin-specific in note visibility.
- **Where it lives:** maktab summary visible ONLY to teachers
  (+admin). Students see the maktab summary AND their personal
  summary as two separate views — a possible "combine views" option
  was floated, NOT decided; parked as a later enhancement, not part
  of the first build.

**Agreed 2026-08-15 (fourth round — design now COMPLETE):**
- Fields: each maktab table carries ALL its PJ counterpart's columns
  (Claude's lean to trim student_comment_by/_at was NOT taken —
  keep them), PLUS teacher notes (the `teacher_feedback` +
  `teacher_feedback_visibility` pair, reused as-is per the third
  round), PLUS `teacher_id` + `teacher_name`. "All PJ columns" is
  the rule — no per-column trimming.

**Correction, same day:** (a) below was mislabelled as "PJ work" in
chat. It isn't — `isTeacherOrAbove` is an AUTH/permission change,
and its REASON is the maktab ("teacher level or higher"). What's
true is that its blast radius is the LIVE app: those 12 checks gate
the PJ's existing endpoints today (a teacher saving into a student's
PJ, reading their logs/plans/position/attendance), and an admin
currently fails all of them. After the refactor an admin passes.
That's why it stays its own small delivery — a permission change is
easier to reason about, test, and roll back alone — not because it
belongs to the PJ.

**Agreed 2026-08-15 (seventh round): PJ use is OPTIONAL.** Every
student registered on the maktab HAS a PJ (registration creates the
account, and the account IS the PJ) — they just may or may not use
it. Design consequence, and every prepop/flow line below already
holds under it: all PJ-sourced inputs are best-effort extras that
degrade to nothing on an empty PJ — sabaq prepop falls back to pure
maktab history (the only-increase rule vacuously does nothing), no
note flows, no tadabbur strip shows, no haidh reads from the
journal (teacher entry still works — it's the same attendance
table). Nothing in the maktab may ever REQUIRE a PJ entry to exist.
This must hold in the (e2) build, not just here: every PJ fetch in
the day view treats empty results as the normal case, not an error.

**Agreed 2026-08-15 (fifth round — registration, prepop sources, haidh mechanics, absence flag):**
- **Registration:** the maktab registers students — NO self-
  registration — and has a pin-reset facility. Both ALREADY EXIST
  (admin.js: handleRegisterStudent, handleResetPin), admin-gated —
  and STAY admin-only (confirmed 2026-08-15, sixth round). Net new
  work: NONE. This fifth-round item is fully satisfied by what's
  already live; it drops out of the delivery list entirely.
- **Prepop sources, superseding the (e) spec's sabaq line:** the
  maktab does its own prepop of all three; a student's PJ SABAQ
  amends the maktab sabaq prepop AUTOMATICALLY; student sabaq dhor
  and dhor do NOT amend maktab prepop — teachers amend manually. So:
  sabaq prepop reads maktab history + the student's PJ sabaq —
  combination pinned (sixth round): the sabaq prepop is ONE AYAH;
  the PJ may only ever INCREASE the sabaq_to field, nothing else.
  I.e. compute the prepop from maktab sabaq history as normal, then
  if the student's PJ sabaq frontier is FURTHER, extend sabaq_to up
  to it — sabaq_from, and everything else, comes from maktab
  history alone, and a PJ frontier BEHIND the maktab's changes
  nothing (only-increase); sabaq-dhor and dhor prepop
  read MAKTAB history ONLY (the (e) spec's dhor-default variant
  stands, PJ-note flow stands, but no PJ content feeds the
  sabaq-dhor/dhor position fields).
- **Tadabbur:** a student can make their tadabbur PUBLIC to be
  viewable by teachers. The mechanism already exists end to end
  (reflections.is_private + applyPrivacy: teachers already see
  non-private reflections via GET). What's new is surfacing it in
  the maktab day view. Assumption, stated: shown as a READ-ONLY
  strip/card there — the maktab never writes tadabbur. Flag if
  wrong.
- **Haidh, teacher-entered + propagation (extends (f), plus (e2)
  UI):** haidh can be read from the student's journal AND entered by
  a teacher (writes the same attendance table — one haidh store) —
  from BOTH entry points (sixth round): a control on the day view
  AND from the summary row. Both run the same early-re-mark
  confirm() guard below.
  When a haidh day is entered (either way), all subsequent MAKTAB
  DAYS with no logs derive as haidh until the student's max is
  reached (haidh_ruling: hanafi 10 / shafii 15 — already per-student
  since migration 0018), THEREAFTER absent. Early re-mark guard: if
  a teacher marks haidh before the min gap has passed since the last
  haidh day, a native confirm() asks: "15 days has not passed since
  the last haidh day. OK to mark as Haidh, cancel to mark absent"
  (the 15-day min gap is already HAIDH_GAP_OFFICIAL in
  haidhRules.js, fixed across rulings — reuse, don't re-encode).
  Note the derived-attendance model gains a WRITE path (teacher
  haidh entry) but stays derived for present/absent.
- **Absence flag:** a student with NO maktab log for 30 consecutive
  MAKTAB DAYS (arbitrary, subject to change — config alongside the
  ≥N env var, same mechanism) is flagged for teacher attention on
  the summary — visual treatment suggested as a changed row
  background colour ("??" in chat — exact treatment is a build-time
  detail, not a blocker). Maktab days = days meeting the ≥N rule,
  so this counts absence against days the maktab actually ran, not
  calendar days.

**Delivery routing for the fifth round:** registration/pin-reset —
RESOLVED, nothing to build (stays admin-only as it already is).
Sabaq prepop semantics (pinned above) + tadabbur strip + teacher haidh
entry UI + early-re-mark confirm → (e2). Haidh propagation + the
thereafter-absent rule + the 30-day flag computation → (f) (the
summary consumes (f)'s output; (e1) can ship without it and gain
the flag colouring when (f) lands).

**DEPLOYMENT FORK (2026-08-15, stated after (d) was built):** the
personal deployment (hifzhelper-personal-db + its own worker) is for
students NOT connected to a maktab. It was updated through V3.56.0
and stops there — every delivery from V3.57.0 onward is for the
MAKTAB deployment only: zips upload to the maktab repo only, the
worker deploys to the maktab worker only, migrations run on
hifzhelper-maktab1 only (one DB holding both the PJ and maktab
tables). "One zip both repos" ended at V3.56.0. This also dissolves
the personal-deployment maktab-UI question for (e): personal never
receives the maktab frontend at all.

**Delivery split, in this order, each its own spec + "start
building" + zip:**
  (a) `isTeacherOrAbove` refactor — 12 call sites, utils.js helper.
      Auth change with live blast radius (see correction above).
      **DONE — V3.55.0, 2026-08-15.**
  (b) PJ notes private-by-default — frontend default + worker
      explicit write (migration skipped, confirmed — see V3.56.0).
      Genuinely a PJ change. **DONE — V3.56.0, 2026-08-15, bundled
      with the lost-note bug fix.**
  (c) Migration + three maktab_* tables (all PJ columns + teacher
      notes + teacher_id + teacher_name). **DONE — V3.57.0,
      2026-08-15. Migration 0019 RUN on hifzhelper-maktab1
      (confirmed 2026-08-17) — see the migration status block at the
      top of this file.**
  (d) Worker endpoints (save/update/delete/get for all three) —
      via logHelpers.js. **DONE — V3.58.0, 2026-08-15 (one module +
      config map, not three clones — see its entry). 0019 is run;
      no migration gate outstanding.**
  (e) Maktab summary screen (teacher) + the student read-only view
      + prepop reusing the PJ calcs against maktab tables.
  (f) Derived attendance (3-table UNION, haidh from PJ, log-wins
      overwrite). N is NO LONGER an env var — it moved to (g)'s
      settings screen, along with the absence-flag days.
  PLUS two deliveries added 2026-08-16, after (e) shipped, and ordered
  BEFORE (f) because it consumes them:
  (g) Maktab settings — admin-only: mushaf, N, absence days, name.
  (h) Maktab position + student setup — the maktab's own position
      store (so Sabaq Dhor copies the PJ logic rather than running
      without one) + the setup screen marking completed ajzaa, which
      seeds the maktab Dhor pool. Also fixes computeDefaultDhorEntry's
      server-side read of students.baseline_selection/mushaf.
  ORDER: (g) -> (h) -> (f). Each has a full spec above.
  (a) and (b) touch already-live code and are correct on their own —
  worth landing and confirming before (c)–(f) start. (a) and (b)
  are both DONE; (c)'s migration file is delivered (RUN IT before
  deploying (d)); (d) is DONE; (e1) — read paths — is DONE
  (V3.59.0, + the V3.59.1 shape fix); (e2) — day view + prepop +
  write path — is DONE (V3.60.0). NEXT AND LAST: (f), derived
  attendance (haidh propagation, thereafter-absent, ≥N env-var
  rule, 30-day flag).

## ARCHITECTURE — Maktab/PJ separation and the merged journal (agreed 2026-08-16, NOTHING BUILT — deliveries (i)-(l) below, each needs its own "start building")

### Why this exists

One bug class has recurred FIVE times, always silently, always the same
shape: code running in maktab mode resolving "whose data?" from the auth
token, and so reading or writing the TEACHER's own personal journal
while they logged a student.

  1. `position` load/save (found V3.64.0, skipped; properly fixed V3.66.0)
  2. the upcoming-plans queue (found V3.64.0, guarded off)
  3. eight `apiGetProfile()` reads (found V3.64.1 — the teacher's mushaf
     and Dhor pool were being used to render a student's card)
  4. `handleDeleteAttendance` hardcoding `auth.id` (found V3.63.0 — a
     teacher un-ticking a student's haidh would have cleared their own
     day)
  5. the Dhor pool WRITES (found 2026-08-16 by the user's "just like the
     PJ, when a portion is logged as dhor it gets added to the pool" —
     the read was routed, both writes were not)

Every one was found by hand, after shipping, and each fix was a patch.
The user's judgement, correct: patching is not working, and the right
answer is architectural. Their proposal, adopted below, removes the
HARM by construction (a teaching account has no journal to corrupt),
and the read-routing rewrite + guard removes the SILENCE (a missed call
site fails loudly instead of writing the wrong row).

### The architecture, as agreed

**1. Accounts are separated by role.**
- Teaching/admin accounts and student (PJ) accounts are DIFFERENT
  logins, deliberately NOT linked at registration.
- Logging into the maktab you are either a student or a teacher.
- A STUDENT has ONE identity: the same account the maktab records
  against and the one she uses for her journal.
- A TEACHER who also memorises gets a SECOND, unlinked student account.
- A teaching session therefore has no personal hifz data at all. That
  is what kills the bug class: a missed call site writes junk to an
  account nobody reads, instead of damaging a real record.

**2. Account switching — device-local, PIN always (Claude's suggestion,
user asked for anything other than typing another username).**
- The DEVICE remembers account IDs that have signed in on it. Never
  PINs, never tokens-per-account.
- "Switch account" lists them as chips; tapping pre-fills the ID and
  asks for the 4-digit PIN.
- PIN required EVERY time, deliberately: maktab devices get shared, and
  a tablet that lets anyone tap into a teacher account (or a student's
  journal) is a worse problem than four digits of friction.
- "Forget this account" for a borrowed device. Frontend-only: no
  schema, no endpoint, accounts stay genuinely unlinked.

**3. The student's journal: merged, with provenance.**
- A maktab student does NOT normally confirm and save the sabaq/sabaq
  dhor/dhor she recites at the maktab — the maktab confirms it.
- Maktab entries therefore MERGE into her journal and become part of
  her personal record, carrying provenance (the confirming teacher).
- Entries she creates herself stay PERSONAL — the maktab never sees
  them (the three-inputs rule below is the only channel outward).
- She can still view the maktab journal on its own: once entries carry
  provenance that is a FILTER on the merged history, not a second
  store.
- Because maktab entries are part of her journal, her prepop, frontier
  and juz tracker COUNT them.
- Duplication (she logs it AND the maktab does) is rare, and is a
  FEATURE when it happens — user: "as soon as the student sees the
  duplication they will figure out what comes from the maktab and what
  they need to do." No de-duplication logic, no merge-on-write, no
  "which record wins".

**4. Merge mechanism: union at read time + a 60-day archive.**
- UNION: her journal reads her own rows plus maktab rows, interleaved
  by date. Nothing copied while records are still live, so a teacher's
  edit or delete is reflected automatically and there is no sync
  surface for recent data.
- ARCHIVE: maktab data older than ~60 days is PHYSICALLY COPIED into
  her tables, so the journal survives losing maktab access ("hifz is a
  solo journey with the maktab helping during certain periods; even
  when one loses connection the journey continues, so the journal can
  always be used").
- Exactness: her log tables gain a nullable `maktab_log_id` (+ the
  teacher-name snapshot). The union reads her rows PLUS maktab rows
  whose id is not already present as a `maktab_log_id`. Exact
  regardless of when archiving runs -- no cutoff arithmetic, no window
  where a row shows twice or disappears. Archiving is idempotent.
- RE-SYNC, not frozen (user's call): if a teacher edits or deletes a
  maktab record that has already been archived, the copy is patched or
  removed to match. Bounded -- one targeted statement keyed on
  `maktab_log_id`, firing only when a copy exists. **The DELETE path is
  the one that gets forgotten**: an archived copy surviving a deleted
  maktab record would leave her journal asserting something the maktab
  no longer says.
- Trigger: opportunistic, when she opens her journal (bounded work,
  idempotent, no cron -- the project has none, and 100 students does
  not justify one).
- The maktab tables are NEVER moved or emptied: archiving copies into
  her journal, and the maktab keeps its own complete record, including
  for students who leave.

**5. The three PJ->maktab inputs are KEPT** (sabaq_to extension, haidh,
notes/tadabbur). They were never the source of the bug class: each is a
read of a NAMED student (`?student_id=`), which is explicit and safe.
The bugs were always the UNNAMED calls where the token silently
supplied the answer. The code for all three already exists and is
tested.

### The read-routing audit (2026-08-16) — MECHANICAL, and now a harness

Method: classify every api client in js/api.js by whether the CALL
names a student (`?student_id=`) or lets the auth token decide; find
every call site of the token-deciding ones; flag those in modules that
can execute while a maktab context is active. Lives in
`verify_routing.mjs` and runs with the suite, so it re-checks on every
delivery instead of depending on how carefully anyone reads.

**16 unrouted call sites — ALL FIXED in V3.68.0. `verify_routing.mjs` now asserts 0 and fails the suite on any new one. Kept as the record of what was wrong:**

| Sites | What | Effect in maktab mode |
| --- | --- | --- |
| 10 | History rails — `renderRecentEntries(type, apiSabaq/apiSabaqDhor/apiDhor, ...)` in sabaqPage (197, 307, 421), sabaqDhorPage (325, 429, 469), dhorPage (452, 1293, 1342, 1440) | a teacher opening a student's card sees THEIR OWN recent entries |
| 4 | Dhor pool writes — `apiSaveProfile({baseline_selection})` in sabaqPage:415, sabaqDhorPage:190, dhorPage:1436, juzTrackerScreen:146 | portions logged for a student grow the TEACHER's own pool; the maktab pool never grows past setup |
| 2 | juzTrackerScreen:88, :132 — `apiGetProfile()` | the tracker reads the teacher's pool |

Justified exceptions, each with a stated reason in the scan: app.js's
boot identity check (always PJ mode), position.js's two calls (the PJ
branch of an already-routed ternary), dhorPage's plans queue (wrapped
in the logPlansEnabled guard).

**Two findings worth keeping, because they are why this is mechanical
now:**
- The manual passes missed three sites. `sabaqPage:307` is the History
  rail refresh after a DELETE — eyeballing found the save paths and
  skipped the delete path. The juz tracker was raised by the USER, not
  found by Claude.
- **The first draft of the scan itself was broken and reported 13.** Its
  function-extraction regex required a closing brace on its own line,
  so it silently skipped every ONE-LINE client — including
  `apiSaveProfile`, one of the exact sites it exists to catch. A guard
  that reports clean while missing the target is worse than no guard;
  it now chunks on function boundaries instead. **The scan needed
  verifying against a hand count before it could be trusted.**

**The one assumption it cannot check:** `MAKTAB_REACHABLE`, the list of
modules that run in maktab mode, is maintained by hand. If a maktab
screen ever calls a module not on that list, the scan goes quiet about
it. Stated in the file itself so it stays visible.

**Also flagged — now CONFIRMED DEAD (traced 2026-08-17):**
`apiMaktabSabaq` / `apiMaktabSabaqDhor` / `apiMaktabDhor`, js/api.js:213-215.
**Zero call sites.** Every Maktab-named client in js/api.js was counted for
real call sites outside its own definition; these three are the only ones at
0, and the other ten are live (`apiMaktabSummary`, `apiMaktabDhorDefault`,
`apiGetMaktabSabaq` / `SabaqDhor` / `Dhor`, `apiGetMaktabPosition` ×4,
`apiSaveMaktabPosition`, `apiGetMaktabSettings`, `apiSaveMaktabSettings`,
`apiGetMaktabAttendance`). The count is complete rather than merely
name-based: js/ contains **no dynamic lookups at all** — no `window[...]`,
no `globalThis[...]`, no bracket-string access, no `eval` — so nothing can
reach a client under a name a grep cannot see. Delete during (i).

**Why they are worse than clutter, and why the guard cannot cover them:**
they are `makeLogClient('/maktab/sabaq')` — the TOKEN-DECIDING form. Their
live replacements at logContext.js:74-76 are `makeMaktabLogClient(...)`,
which stamps `student_id` onto get / getForDate / save. So the dead trio are
the exact wrong-row footgun this architecture exists to remove, sitting in
scope under names a future session would reasonably reach for.
`verify_routing.mjs` scans call SITES; these have none, so it is silent
about them today and would only catch a future call if the calling module
happened to be on the hand-maintained `MAKTAB_REACHABLE` list. Deleting them
is the only real guard.

### What this changes in what is already built

- **(a)-(h) mostly survive untouched.** They already write maktab
  tables; that stays correct under the new model.
- **js/logContext.js keeps its job but its purpose shifts**: from
  "protect the teacher's PJ" to "point at the right student". Still
  essential -- the shared cards must write the STUDENT's maktab rows.
- **Goes away**: the day view's PJ-reading bits stay (the three inputs
  are kept), but they now read a student account that is never the
  logged-in teacher, which is what makes them safe rather than
  incidental.
- **The (h) student setup screen vs the juz tracker**: both mark
  completed ajzaa into the pool. STILL OPEN -- see the question below.

### Deliveries

**Harnesses now live in `tests/` (V3.67.2)** — 13 of them, 357 checks,
`node tests/run-all.mjs`. They were sandbox-only until now, so every
session discarded them; `verify_routing.mjs` in particular is the guard
this architecture depends on, and it needs to survive a handover.

**Verified from a clean checkout, 2026-08-17:** `npm install jsdom`, then
`node tests/run-all.mjs` → **357 passed, 0 failed across 13, exit 0**, on
Node 22 (`node:sqlite` built in). `grep -rn "/home/claude" tests/` → 0, so
the path rewrite holds outside the sandbox it was made in.

**Do not misread `verify_routing.mjs`'s line in the runner output.** It
reports **5 passed** — those are the scan's own self-checks. The 16 unrouted
sites are asserted inside it, not counted in that number. A future session
seeing "5" next to a 16-site audit will think something regressed; it has
not. When (i) flips the expectation to 0, that 5 does not change either.

**(i) Read-routing rewrite + the guard. — DONE, V3.68.0, 2026-08-17. All 16 sites routed, guard flipped to assert 0, `mergeDhorUnitsIntoPool` moved the Dhor pool write server-side. See the CHANGELOG entry.** All 16 sites through the
context; `renderRecentEntries` takes its client from `logClient(type)`
rather than a passed-in constant; ONE context-aware pool writer serving
all four write sites (setup, ongoing dhor logs, sabaq dhor overflow,
juz tracker); the tracker's two reads routed too. Delete the three
CONFIRMED-dead apiMaktab* log clients (js/api.js:213-215 — traced
2026-08-17, zero call sites; see the audit above for why they are a
footgun rather than clutter). `verify_routing.mjs` already exists and
currently PASSES at 16 — it is measuring the debt, not asserting it is
gone. (i) finishes by flipping its expected count to 0, after which any
new unrouted call fails the suite. **Needed regardless of the rest,
fixes live wrong-row bugs, no schema change -- do this FIRST.**

### CURRENT NAV — what each role sees (V3.70.2, 2026-08-17)

**This is the stable statement. It moved three times in one day through
Claude misreading scope; read this rather than reconstructing it from the
CHANGELOG.**

| role | nav |
| --- | --- |
| **student** | Summary, Detail, Tadabbur, Juz Tracker (FULL tracker), Surahs in my Heart, Settings, Haidh (if `track_haidh`), **Maktab Journal** |
| **teacher** | Juz Tracker (FREE PLAY only), Surahs in my Heart, Maktab. **Lands on the Maktab summary, not Home** (V3.71.0). |
| **admin** | as teacher, plus Maktab Settings and Admin |

Gated by `isTeachingProfile()` (teacher or admin) in `js/auth.js`; the juz
tracker's `FREEPLAY_ONLY` uses the same function so the two cannot drift.

**Why the student keeps Maktab Journal even though it reads maktab tables:**
it is server-scoped to her own rows — `js/maktabJournal.js:28` sends no
`student_id`, and `worker/src/maktabLog.js:138-139` defaults to `auth.id` and
403s a non-teacher who names anyone else. `verify_nav.mjs` asserts both, so
if that scoping ever changes the suite fails and the item must come off her
nav.

### (j) — answers so far and what they imply (2026-08-17) — BUILT V3.77.0, 2026-08-27

**ANSWERED: a teaching account NEVER gets a personal journal.** User,
2026-08-17: *"no the teaching acc does not get a pj — user will have
different teaching and pj acc."* A person who both teaches and does hifz
holds TWO accounts, unlinked (as agreed 2026-08-16).

**Implication 1 — (j) probably needs NO MIGRATION.** `students.role` already
holds `student` / `teacher` / `admin`, so the type distinction exists in the
schema today. What changes is behaviour, not shape: a teaching account has no
journal rows and no PJ screens. That makes (j) a gating change plus a
one-time data discard, not a schema change against live data — a materially
smaller and safer delivery than it looked.

**Implication 2 — the maktab roster must exclude teaching accounts. FOUND
2026-08-17. CLAUDE'S TO FIX INSIDE (j) — no user decision needed; it was
raised as a question in error.** `handleMaktabSummary`
(`worker/src/maktabLog.js:62`) reads
`SELECT id, name, mushaf, track_haidh FROM students WHERE active = 1` — **no
role filter**. Today that is masked because ADMIN-01 is both. The moment
teaching accounts exist as journal-less rows, every one of them appears in
the maktab summary as a student expecting Sabaq/Sabaq Dhor/Dhor to be logged
against it. The fix is small (`AND role = 'student'`) but it MUST ship inside
(j), and the same question needs asking of any other place that enumerates
students — the admin list is separate and admin-gated, so it is fine.

**Implication 3 — RESOLVED 2026-08-17. "A teacher cannot log her own hifz"
is a rule TEACHERS enforce, not code.** User: *"Teachers will enforce not
code."* So (j) adds NOTHING for this. In particular it does NOT compare a
teaching id against its derived student id, even though the `...teacher`
suffix scheme would make that trivially possible — the capability exists and
is deliberately not used.

**The existing guard STAYS, and that is not a contradiction.**
`handleSave` (`worker/src/maktabLog.js:152`) rejects
`body.student_id === auth.id`. Two reasons to keep it:
- It is an **API-level authorization check**, and the API is reachable
  independently of the UI. "Unreachable" would be a property of the current
  screens, not of the endpoint.
- Under (j) it becomes unreachable through the UI anyway, because teaching
  accounts are filtered out of the maktab roster (Implication 2), so a
  teacher can never select her own teaching account to log against.

This is a deliberate exception to process rule 3 (delete superseded code):
an authorization guard that is currently unreachable is defence in depth,
not dead feature code. Recorded so a future pass does not "tidy" it away on
the strength of the social-rule decision.

**PROPOSED id scheme (user, 2026-08-17): derive the teaching id from the PJ
id.** Everyone is set up with a PJ account first; the admin then uses that
profile to create a teaching profile, with `teacher` appended to the unique
id (PJ `K7M2QX` → teaching `K7M2QXTEACHER`). Solves the real usability
problem: remembering two unrelated random codes.
*(Restored 2026-08-17 after Claude deleted this block by accident — a span
replacement whose end anchor sat past it. Same class of error as the stale
claims §13 exists for, caught by grep the same day.)*

**"The id should only be seen by admin" (user, 2026-08-17) — ALREADY TRUE ON
SCREEN, and cannot be made true in the data.** Verified: `js/maktabSummary.js`
uses `stu.id` only as a lookup key (`byStudent[type][stu.id]`) and renders
names; `js/maktabDay.js` prints no id either. No teacher sees an id anywhere
in the maktab today. **Nothing to build for this.**

**The limit, stated plainly:** the id is still IN the data the teacher's
browser receives, because tapping a row has to tell the server which student
to open. Removing it would need an indirection layer — per-session opaque
handles the worker resolves back to real ids — which is real work and a new
failure surface. So "only admin sees ids" is a screen-level truth, not a
technical guarantee: a teacher who opens the browser's network inspector can
still read them, and so could still derive another teacher's login id under
the suffix scheme.

**Judgement:** for a small maktab of trusted teachers that is probably
enough — someone who inspects network traffic is a different person from one
who glances at a screen. But because it is not a guarantee, **the PIN is what
actually protects the teaching account**, which is why the one remaining
question is the PIN and not the id.

**Also to settle with the scheme:** is the ADMIN account derived the same way
(a `...teacher` id carrying role `admin`), or does ADMIN-01 stay as it is? And
a teacher who does no hifz still gets a PJ account she never uses, purely to
derive from — harmless, consistent with "use of the PJ is optional", but
worth naming so it is not a surprise.

**ALL QUESTIONS ANSWERED — (j) IS BUILD-READY, 2026-08-17. Still needs its
own "start building".**

**SEPARATE PIN on the teaching account** (user, 2026-08-17). This falls out
of the existing design at no cost: `pin_hash` is already "set on first login,
not at creation" (SCHEMA.md), so a new teaching row simply starts with a NULL
hash and the teacher sets its PIN the first time she enters it — the same
path every student already takes. No new mechanism.

**The switcher follows from that, and needs no further decision.** "Switch to
teaching" PRE-FILLS the derived id and asks only for the PIN. That is what
makes it not "logging in as someone else": nothing to remember and nothing to
type but four digits. The derived id is a username; the separate PIN is the
secret.

### Student read-only maktab view + teaching landing screen — BUILT, V3.71.0, 2026-08-17

*(Spec retained below as the record of what was agreed and why. The
ambiguity noted in item 2 was resolved by reading it as the Maktab summary;
say so if a journal-shaped teaching landing view was meant instead.)*

**1. A student gets the Maktab Journal AND the maktab log details, VIEW
ONLY.** Today she has the Maktab Journal (her own rows, grouped by date) but
no route into the three log cards for a maktab day.

**The data path already exists and is already safe** — nothing new is needed
server-side. `handleGet` (`worker/src/maktabLog.js:138-139`) defaults to
`auth.id` and 403s a non-teacher naming anyone else, so a student can read
her own maktab rows and no one else's. And **every maktab WRITE is already
teacher-gated** at `:51`, `:97` and `:146` — so even if a student reached a
save control, the worker refuses. View-only is therefore enforced at the
server already; what is missing is the UI.

**What actually needs building is a read-only mode on the shared log cards.**
The maktab day view works by `setMaktabLogContext(student, date)` then
`showScreen('logDetail', 'sabaq')` (`js/maktabDay.js:141,166`) — it reuses the
PJ's own cards, which is what keeps the two from drifting. A student entering
the same screen must get those cards with every write control suppressed:
Save, the confirm checkboxes, Delete, the edit pencil, the Dhor timer's save,
and the notes inputs. `logClient(type).save(...)` is reached from
`sabaqPage.js:368,372` and `dhorPage.js:1392,1396` among others.

**Design note before this is built:** suppressing controls one by one is the
fragile version — the same shape as the four pool writes before (i). Better
is ONE read-only flag on the context (alongside `mode`), with the cards
asking it once, so a control added later is covered by default rather than
by someone remembering. Worth deciding deliberately, not drifting into.

**2. The teacher/admin app OPENS ON THE MAKTAB, not Home.** Landing screen
becomes the maktab summary for teaching profiles; students keep Home.

**AMBIGUITY, flagged not assumed:** the phrasing was "opens to maktab
journal", but Maktab Journal is the STUDENT's own-rows screen and teaching
profiles deliberately do not have it (V3.70.2) — they have the Maktab
summary, the multi-student view. Read here as "the maktab screen a teacher
has", i.e. the summary. If the teaching landing screen really should be a
journal-shaped view rather than the summary grid, say so, because that is a
different screen and not one that exists.

### Admin screen — what (j) changes there (from a screenshot, 2026-08-17)

Three things read off the live admin screen, which is where (j)'s account
creation has to live.

**1. "ADMIN-01" is the NAME, not the id.** The id is `ABCDEFG`. That settles
the note in the discard script: the script's step 0 (`SELECT id, name, role
FROM students WHERE role = 'admin'`) will return exactly this, so the
placeholder stays — nothing needs hardcoding, and the operator confirms the
id from the same query that finds it.

**2. The create-teaching-profile action belongs on this list.** Each row
already carries two per-row icons (copy id, share). The agreed flow — "admin
uses the PJ profile to create a teaching profile" — is naturally a THIRD
per-row action, not a new screen and not a type choice on the Register form
above it. That form stays as it is: it registers students.

**3. The list will need a role indicator, and does not have one.** It shows
id + name only. After (j) it holds roughly twice as many rows —
`ABCDEFG`/`ABCDEFGTEACHER` and so on — with nothing distinguishing a teaching
account from a student. Two consequences to design for:
- the admin needs to see at a glance which is which (a role chip, or
  grouping teaching accounts under their student);
- the row action must not offer "create teaching profile" on a row that is
  already a teaching account, or that already has one.

**Still open on the scheme:** ADMIN-01 has no separate person behind it — it
is not derived from anyone's PJ. So it presumably keeps `ABCDEFG` and simply
loses its journal, rather than becoming `...TEACHER`. Confirm when (j)
starts; it only matters for consistency of the id convention.

### (j) build plan — the whole of it, in order — BUILT V3.77.0 (steps 1–4; step 5 was run 2026-08-17). ADMIN-01 keeps `ABCDEFG`.

1. **Roster filter.** `handleMaktabSummary` (`worker/src/maktabLog.js:62`)
   gains `AND role = 'student'`. Without it every teaching account appears in
   the maktab summary as a student to be logged against. Check any other
   place that enumerates students at the same time; the admin list is
   separate and admin-gated, so it is fine.
2. **Create-teaching-profile action**, admin-only, from an existing student
   profile. Writes a row: `id = <pjId> + 'TEACHER'`, `role = 'teacher'`,
   name derived from the student's, `pin_hash` NULL, `active = 1`, and NONE
   of the journal columns populated. Guard against creating one twice, and
   against creating one from a teaching account.
3. **The switcher**, as above — pre-filled id, PIN prompt.
4. **The updateLog date validation** rides along here (scheduled V3.68.0):
   `updateLog` writes `updates.date` through the `contentFields` branch with
   no `isValidDate` check, so a bad date is both stored AND silently skips
   the attendance sync.
5. **Run `worker/discard-admin-pj.sql`** — by hand, after deploy, per its own
   header.

**No migration.** `students.role` already carries the type and the derived id
already encodes the relationship, so nothing about the schema changes. That
was worth establishing: it makes (j) a gating-and-flow change rather than a
structural one against live data.

**Not in (j), deliberately:** any code enforcing "a teacher cannot log her
own hifz" — teachers enforce that, not code — and any change to how ids are
displayed, which is already correct.

**RESOLVED BY CIRCUMSTANCE:** open question 2 (setup screen vs juz tracker,
which is authoritative) — the tracker went free-play only in V3.69.0, so the
(h) student setup screen is now the only thing marking completed ajzaa.
**ADMIN-01 keeps its admin rights**; losing its history and losing its role
are different things, and only the former was stated.

**(j) Account separation.** Teaching/admin accounts distinct from
student accounts; registration creates one or the other; the
device-local switcher. Includes the migration question below.

**(k) Merged journal.** Union-at-read-time view with provenance, plus
the maktab-only filter; her prepop/frontier/tracker counting maktab
entries.

**(l) Archive.** `maktab_log_id` migration, the 60-day copy, the
opportunistic trigger, and re-sync on maktab edit AND delete.

Order: (i) -> (j) -> (k) -> (l). (i) is independent and urgent; (k)
depends on (j) having settled what a student account is; (l) depends on
(k)'s union being in place.

### Open questions

1. **Existing accounts — ANSWERED 2026-08-17.** ADMIN-01 currently has an
   admin role AND journal data (including the stray haidh mark and a
   known-wrong stored position). **User's decision: ADMIN-01 LOSES ITS
   HISTORY and becomes the maktab teacher.** So: discard, do not migrate.
   Its journal rows (sabaq_log / sabaq_dhor_log / dhor_log / reflections /
   attendance / position / baseline_selection) go, and the account becomes
   a teaching account with no personal journal at all. Test Student / Umme
   remain students. This also disposes of the stray haidh mark and the
   known-wrong stored position — both were dev residue on that row.
   NOT YET BUILT; needs its own "start building".
3. **Remove the PJ icons from the maktab — BUILT, V3.69.0, 2026-08-17.**
   Spec retained below as the record of what was agreed and why.

   **"For now HIDE"** — the user's word. So a reversible gate, not a
   deletion: these come back when the separation settles. That answers the
   scope question raised earlier the same day. Both surfaces are covered by
   one change: `visibleNavItems()` in `js/auth.js` feeds the Home tile grid
   AND the nav dropdown, so gating there does both.

   **Hide these four** (ids from `NAV_ITEMS`, `js/auth.js`):

   | id | label | note |
   | --- | --- | --- |
   | `journal` | Summary | |
   | `logDetail` | Detail | the one entry point to the three log cards |
   | `reflections` | Tadabbur | |
   | `settings` | Settings | the PJ settings screen |

   **Remove the Maktab Journal icon.** `MAKTAB_JOURNAL_NAV_ITEM`
   (`id: 'maktabJournal'`), currently appended unconditionally in
   `visibleNavItems()`. This is the student's read-only view of her own
   maktab logs — it has no place on a teaching account.

   **Juz Tracker: free play only.** The item stays visible; only the
   fidget mode is reachable. Today `js/juzTrackerScreen.js:177` calls
   `setFreeplay(false)` on open ("always defaults to juz tracker") and
   `:178` wires a button that toggles back and forth. Free-play-only means
   opening in freeplay and retiring that toggle.
   **TEMPORARY — user, 2026-08-17: "free play only for now, we may bring
   it back."** So the real tracker is suspended, not retired: keep its code
   intact and reachable behind whatever gate does the hiding, rather than
   deleting it. This is a deliberate exception to process rule 3 (delete
   superseded code promptly) — it is not superseded, it is parked with a
   stated intention to return.
   *Consequence worth knowing:* this makes the tracker's pool reads and
   writes unreachable — the very calls (i) just routed
   (`juzTrackerScreen.js:88`, `:132`, `:146`). The routing stays correct and
   costs nothing, and must NOT be stripped as dead code: it is what makes
   the tracker safe to switch back on.

   **What is left visible afterwards** (admin): Home tile, Juz Tracker
   (free play), Surahs in my Heart, Maktab, Maktab Settings, Admin. A
   coherent teaching surface — nothing personal-journal left on it.

   **Haidh: HIDE IT TOO — confirmed 2026-08-17.** `HAIDH_NAV_ITEM`
   (`id: 'haidhDetail'`) is hidden alongside the four above.
   **What this does NOT touch, because "hide haidh" reads wider than it
   means:** it removes the route to the personal haidh CALENDAR screen and
   nothing else. `trackHaidh` keeps its value; the maktab's OWN haidh
   marking from (e2) — the yellow icon on the summary row and in the day
   view — is untouched; and (f)'s derived attendance keeps propagating
   haidh across maktab days on calendar-day counting exactly as built.
   Only a PJ screen goes out of reach, which is the point.
   *Why it needed saying:* the item is gated on `currentUser.trackHaidh`,
   and that flag is only settable from the Settings screen this same change
   hides — so where it is already true it would otherwise have kept showing
   with no UI route to turn it off.

   **Still NOT stated, flagged rather than assumed:** **Surahs in my Heart**
   (`sih`) was not named. A personal colouring activity, deliberately
   unconnected to progress — arguably a PJ icon by the same logic, arguably
   harmless. Left visible pending a word either way.

2. **Setup screen vs juz tracker.** They do the same job. Claude's
   lean, consistent with what worked for the log cards: the juz tracker
   BECOMES the maktab setup (a teacher opens a student's tracker, it
   reads and writes the maktab pool) and the (h) setup screen is
   deleted. Alternatives: keep both (then which is authoritative?), or
   leave the tracker PJ-only.

## Flagged — V3.68.0 field report: Dhor logged for a student shows on the summary but not in her history (2026-08-17)

**Reported by the user 2026-08-17, testing as admin:** a Dhor entry logged
for Umme appears on the maktab summary page but does not appear in her
history. **User has PAUSED TESTING** until the maktab/PJ separation is
complete, so this is recorded, not chased.

**Most likely explanation: V3.68.0 was not deployed yet when this was
observed, and this is the exact symptom (i) fixes.** Before V3.68.0 the
History rail called `apiDhor` — own-only — so it showed the LOGGED-IN
person's entries. An admin logging for Umme would therefore see the row on
the summary (which reads the maktab tables by date) and NOT in the rail
(which was showing the admin's own history). This is item 4 of the V3.68.0
manual checklist in TESTING.md, described there before the report came in.
**First thing to check on resuming: was V3.68.0 deployed, worker first?**

**If it WAS deployed, this is a new defect and needs one disambiguation
before tracing:** which screen was "her history"? Three candidates behave
differently — (a) the History rail on the maktab Dhor card, (b) the
student's own Maktab Journal view, (c) Umme's personal journal, where a
maktab entry legitimately does NOT appear yet (the merged view is delivery
(k), not built).

**Server side ruled out by inspection 2026-08-17:** `handleGet` in
`worker/src/maktabLog.js:136` takes `student_id` from the query and passes
it to `getLogs`, which filters only on `student_id` (plus `since` when
supplied) and orders by date — no date window, no visibility filter that
could hide a just-saved row. `applyPrivacy` nulls note fields for other
requesters but never drops rows. So a correctly-addressed request returns
the row; suspicion falls on which student id the rail asked for, i.e.
exactly what (i) changed.

## Flagged — updateLog writes an unvalidated date straight to the row (2026-08-15, SCHEDULED 2026-08-17)

**Scheduled: rides along with (j)**, the next delivery that touches the
worker. Not a separate release — the fix is a few lines and bundling it
avoids a worker deploy of its own.

Found while writing V3.54.0's test harness, not introduced by it and not
fixed by it. `updateLog`'s generic field-update loop writes whatever is in
`updates.date` straight into the log's `date` column via the `contentFields`
branch — no `isValidDate` check on the write itself. `isValidDate` is
consulted only for the `dateChanging` flag that decides attendance sync, so a
malformed date is both written to the row AND silently skips the attendance
update.

A malformed date cannot be produced by the frontend's date picker, so
reaching this needs a direct API call — low real-world risk, but a genuine
gap in what the endpoint itself guarantees.

## Done — Home header icon removal (2026-08-09, DECIDED then BUILT 2026-08-17, V3.69.0)

- [ ] Remove the home icon from Home's own header row entirely — this is
  `#homeHeaderIcon`, the lavender `home` icon in Home's `card-header-row`
  (V3.43 already stripped the "Home" text label next to it).
  **DECIDED 2026-08-17: remove the WHOLE header row element, not just the
  icon** — no blank row left behind, so the tile grid becomes the screen's
  only content.
- [ ] Scope, traced 2026-08-17: `#homeHeaderIcon` appears in `index.html`,
  `js/app.js` (×2) and `css/nav.css`. Removing the row means the
  `card-header-row` wrapper on Home goes with it; check nothing else on
  Home positions itself against that row before deleting.

## Flagged — Phase 2/Maktab: shared timezone (2026-08-08, DECIDED 2026-08-17) — BUILT V3.78.0: everyone sees maktab time; `maktab_settings.timezone`, NULL = unset

**DECIDED 2026-08-17: the canonical timezone is a per-maktab setting, set on
the maktab settings screen.** That makes it the screen's 5th setting,
alongside the mushaf, the ≥N-students maktab-day threshold, the
absence-flag days and the maktab name. Admin-only to change, like the rest
of that screen; readable by anything that needs a date boundary.

**Why this is no longer "future work".** The original note below deferred it
on the grounds that Phase 2/Maktab had not started. It has — (a)–(h) have
all shipped — and (f)'s derived attendance propagates haidh by counting
**calendar days**, which is precisely the arithmetic that breaks when users
sit in different timezones. It is also at its cheapest right now: no real
users, so no data has yet been recorded against a wrong day boundary.

**Still open, the one remaining decision:** whether the UI should DISPLAY
times and dates in each viewer's own local timezone for readability while
storing and calculating against the maktab's, or show the maktab's timezone
everywhere regardless of where the viewer is.

**Original note (2026-08-08), kept for context:**

- Once there's a maktab with students across different timezones, everyone
  needs to operate on ONE shared, canonical timezone
  (attendance/haidh/journal date boundaries, etc.), rather than each
  device's own local timezone — otherwise "today" means a different
  calendar day for different users, plus the timezone date-shift class of
  bug becomes structural rather than a one-off. Raised in chat right after
  debugging that bug, deliberately kept separate from the fix (the fix
  itself stays device-timezone-agnostic and correct either way).


## Flagged — Settings Haidh heading tweaks (2026-08-08, CLARIFIED + EXTENDED 2026-08-17)

Three changes to the Haaidha block on the Settings screen. **Confirmed
2026-08-17: none of these has been built yet** — in particular the checkbox
has NOT moved.

- [ ] **Checkbox next to "Haaidha": 2x its current size, and moved from the
  LEFT of the heading text to the RIGHT of it** — heading text first,
  checkbox immediately after. (The 2026-08-08 message cut off after "...to";
  confirmed 2026-08-17 that this is what it meant and that it is still
  outstanding.)
- [ ] **Remove the "Ruling" label entirely** — `.haidh-ruling-label` at
  `index.html:1089`, above the Hanafi/Shafi'i switch, added in V3.40.1. Just
  the switch, no text label above it.
- [ ] **NEW 2026-08-17 — remove the ruling hint text** ("Hanafi: haidh cannot
  exceed 10 days." / "Shafi'i: haidh cannot exceed 15 days.").
  **Scope confirmed by the user 2026-08-17: the TEXT goes off the screen; the
  RULING REMAINS PART OF THE APP.** Verified that the four-piece removal below
  does exactly that and nothing more — the Hanafi/Shafi'i switch keeps working
  end to end:
  - `settingsScreen.js:61` `setupSelectedRuling` — KEPT
  - `:63-64` the switch callback sets the value and re-renders — KEPT
  - `:271-272` the saved ruling is loaded from the profile and rendered — KEPT
  - `:379` `haidhOfficialMaxDuration(setupSelectedRuling)` — KEPT, so
    duration validation still enforces the 10/15-day cap
  - `:394` `haidh_ruling: setupSelectedRuling` — KEPT, so the choice still saves
  Only the two `haidhRulingHint` write lines (`:65`, `:273`), the
  `HAIDH_RULING_HINTS` constant and the `<p>` element go. The ruling is still
  read, rendered, saved, and enforced — the sentence just stops being drawn.
  **Delete rather than CSS-hide** (process rule 3: no back-compat hoarding).

**TRAP — do not delete the hint element alone.** `#haidhRulingHint`
(`index.html:1103`) is written to by `js/settingsScreen.js` at **two** call
sites (:65 in the `wireSwitch` callback, :273 in `renderSettingsScreen`),
both `document.getElementById('haidhRulingHint').textContent = ...` with no
null guard. Deleting the `<p>` and leaving those lines reproduces the exact
V3.51.2 bug: the TypeError kills `renderSettingsScreen` mid-function, and the
three lines immediately after :273 are the haidh cycle / period /
next-expected population — they would go blank and could overwrite real
values on save. That element exists *because* of that bug; its markup comment
says so.

**Correct removal is all four pieces together:** the `<p id="haidhRulingHint">`
and its comment (index.html), the `HAIDH_RULING_HINTS` constant
(settingsScreen.js:57-60), and both write lines (:65, :273).

**Keep** `settingsScreen.js:381` — `Duration cannot exceed ${maxDuration} days
for the selected ruling.` is a validation error shown only when an over-long
duration is actually entered, not a standing label. Different thing, similar
wording; easy to over-delete.

## Flagged — dhorSchedule behaviour questions (one CLOSED 2026-08-17, one open)

- [x] **CLOSED 2026-08-17 — confirmed intended, no change needed.** The
  question was: when a student has marked completed ajzaa in Setup but has
  never logged a Dhor, `computeUpcomingDhorQueue`
  (`worker/src/dhorSchedule.js`) uses the same pool-start logic as a student
  with no Setup and no history — was that right?

  **User's answer: Setup does not set the starting point; the Dhor prepop
  starts from the marked completed ajzaa in ascending juz order.** That is
  exactly what the code already does, verified 2026-08-17 by driving the real
  `computeUpcomingDhorQueue` with a D1-shaped stub: `baseline_selection` is
  sorted ascending (`dhorSchedule.js:256`), `buildChunks` preserves that order
  (`:71`), and `startIdx` stays `0` when there is no `dhor_log` row (`:276-280`)
  — so the queue opens on the lowest-numbered marked unit. Scenario: ajzaa
  entered 5, 9, 2 → queue ran 5,6,7,8,17,18,19 (marker indices) = juz 2's four
  quarters, then juz 5's, with unmarked juz skipped entirely. 6/6 checks.

  **TRAP if this is ever revisited — "Setup does nothing" is true ONLY of the
  starting point.** The `setupConfigured` flag at `dhorSchedule.js:260` still
  drives `granularity` (`:261`) and the per-day count (`:262-264`) — proven in
  the same run: configured 4 items/day vs unconfigured 1. Stripping that
  branch as "Setup does nothing" would silently break granularity and
  quantity. Same over-deletion shape as the `settingsScreen.js:381` note in
  the Haidh entry above.

- [ ] **FINAL SCOPE 2026-08-17.** Two earlier framings of this item were
  wrong and are both withdrawn — recorded here so neither gets revived.

  **Withdrawn 1: "rebuild the pool from history."** Repairing a bad state
  after the fact is mitigation; the user's direction is to prevent the
  mistake instead.

  **Withdrawn 2: "make the pool a derived union so history-derived units
  survive a reset."** This was wrong on the facts, not just the approach.
  **User, 2026-08-17: "There may be legitimate reasons for resetting or
  removing juz from dhor — it's not your call, and all it means is that the
  prepop changes."** Removing a juz from the Dhor pool is a normal action, not
  corruption. A derived union would have made removal impossible — the unit
  would be re-derived from history on the next read — so it would have taken
  away a capability while claiming to prevent a bug. The value judgement
  behind it ("she cannot un-memorise something she has demonstrably revised")
  was never the user's and should not have been assumed.

  **Consequences, which collapse most of this item:**
  - **An empty pool alongside real history is a LEGITIMATE state.** It means
    the Dhor pool has been cleared, so the prepop has nothing to offer. That
    is correct behaviour.
  - **The Setup-reset path is not a fault.** "Setup RESETS the pool"
    (2026-08-16) stands exactly as decided. Nothing to change.
  - **The emptiness gate at `dhorSchedule.js:176` is CORRECT** and stays
    ahead of the history query at `:179`. With an empty pool there is
    genuinely nothing to continue from, so returning early is right. Only the
    wording is slightly off — *"No memorised juz'/quarters recorded yet in
    Hifz Setup"* implies she never set it up, when she may have deliberately
    cleared it. Reword at some point; not a bug.

  **What actually remains — one concrete change.** The only real fault is the
  pool diverging from what she DID, without her asking for it:
  - `js/dhorPage.js:1436` is the only one of the four pool writes that does
    not `await` and swallows its error (`.catch(() => {})`). The Dhor log
    commits, the pool write fails, nothing surfaces.
  - The same line is one of the four unrouted pool writes in the audit above,
    so in maktab mode it grows the TEACHER's pool.

  **The fix (A) — BUILT in V3.68.0, 2026-08-17.** Move the Dhor contribution server-side into the log insert.
  `handleSaveDhor` (`worker/src/dhorLog.js:45`) already receives
  `segment_from`, `segment_to` and `ref` in the same request that writes the
  row, and already knows the target `studentId`. Merge the units there and
  DELETE the client block at `js/dhorPage.js:1426-1437`.
  - Feasibility checked: `shared/data.js` is already dual browser+worker
    (`module.exports` at :640; `dhorSchedule.js:1` imports from it). Only
    `segmentToQuarterUnits` needs moving out of `js/dhorPage.js:637` into
    `shared/data.js` and adding to the export list.
  - No second request left to fail, and the worker writes the pool for the
    same `studentId` it is writing the log for — so the maktab wrong-row case
    becomes unroutable rather than merely routed. `verify_routing.mjs` loses
    a site instead of gaining a guard.
  - **Removal stays entirely free.** Adding on log and removing on demand are
    independent; if she later logs Dhor in a juz she removed, it is added
    again, which is just the existing "logging adds to the pool" rule.

  **Interaction with (i) — read before scoping (i).** (A) removes the Dhor
  pool write from (i)'s set of four rather than routing it, so (A) belongs
  inside (i); otherwise (i) builds a routed writer for a call about to be
  deleted. Cost: (i) stops being frontend-only and gains a worker-first
  deploy order. Still no schema change.

## Closed — attendance clients (2026-08-03, CLOSED 2026-08-17 as already done)

- [x] **Nothing to do — this item was stale.** Original note: the attendance
  clients had no UI entry point. Traced 2026-08-17: `apiSetAttendance`, the
  one function the item still named, **was removed in V3.40.2** — `js/api.js:161`
  carries the comment recording its removal. Every attendance client that
  actually exists is live: `apiGetAttendance` (4 call sites),
  `apiDeleteAttendance` (1), `apiPredictHaidh` (1), `apiMarkHaidhRange`, plus
  the teacher-side `apiGetAttendanceFor` / `apiSetAttendanceFor` /
  `apiClearAttendanceFor` wired by (e2).
- The worker's `handleSetAttendance` (POST /attendance) stays — (e2) uses it
  for teacher haidh entry via `apiSetAttendanceFor`. Nothing to delete on
  either side.


---

## Delivered work

Specs and reasoning for all 90 shipped deliveries: **`SPECS.md`**.
Files touched per delivery: **`CHANGELOG.md`**.
