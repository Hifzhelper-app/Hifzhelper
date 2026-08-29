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
| **1** | **DEPLOY AND VERIFY V3.68.0 → V3.71.0 + the catch-up zip** | **Deployed 2026-08-17. Reads CONFIRMED in production; the pool write is NOT yet confirmed** | **Nothing below can be trusted until this is done.** Worker FIRST (V3.68.0 moved the Dhor pool merge server-side), then frontend, then hard-refresh. V3.68.0 shipped without its cache bump, so a warm-cache browser may never have run its JavaScript at all — that is the likely cause of the "logged for Umme, not in her history" report. Manual checklist in `TESTING.md`. |
| ~~2~~ | ~~**Run the admin PJ discard**~~ | **DONE — 2026-08-17, verified** | Ran in the D1 console (no local clone, so the wrangler `--file` route did not apply). Removed 21 rows for `ABCDEFG`: 6 sabaq, 4 sabaq dhor, 3 dhor, 7 attendance (7 not 13 because attendance is per DATE, not per log — several logs shared days), 1 position. `reflections` and `plans` were already 0. Profile fields cleared, and the stray haidh mark and known-wrong stored position went with the attendance and position rows. Verified all zeros; account still `ABCDEFG / ADMIN-01 / admin / 1` with `pin_hash` untouched. **Two non-bugs to expect:** ADMIN-01 still shows in the maktab summary with dashes (the roster filter is part of (j)), and its Dhor prepop reports nothing set up (correct — the pool is empty by instruction). |
| ~~3~~ | ~~**(j) Account separation**~~ | **BUILT — V3.77.0, 2026-08-27** | Roster filter, create-teaching-profile (`<id>TEACHER`, no PIN until first login), the device-local switcher with PIN every time, `updateLog` date validation. No migration. **Testing resumes.** Design and plan retained in the (j) sections below as the record. |
| ~~4~~ | ~~**Shared maktab timezone**~~ | **BUILT — V3.78.0 (delivery 3), 2026-08-27** | Per-maktab setting; everyone sees maktab time. This row had gone stale — struck 2026-08-28. |
| ~~5~~ | ~~**(k) Merged journal**~~ | **BUILT — V3.83.0, 2026-08-28** | Union at read time; provenance = teacher line; marker Option A live (B/C staged). Row struck 2026-08-28. |
| **6** | **(l) Archive** | (k) | 60-day physical copy + re-sync on maktab edit AND delete. |
| **7** | **Settings Haidh heading tweaks** | **"start building"** | Three changes, fully specced. **Carries a trap** — deleting the hint element without its two JS writers reproduces the V3.51.2 blank-fields bug. Still worth doing: Settings is hidden from teachers but live for students. |
| ~~8~~ | ~~**Is `sih` a PJ icon?**~~ | **CLOSED 2026-08-17** | **No — "Surahs in my Heart is unconnected, a feature for everyone."** Already the behaviour, so no code changed; `verify_nav.mjs` now asserts all three roles see it, so the decision is enforced rather than remembered. **The nav work has no open questions left.** |
| ~~10~~ | ~~**The list of eleven**~~ | **ALL PHASES BUILT** — V3.75.0, V3.76.0, V3.78.0 | Delivery 3 (items 7, 8, 9 + the timezone) shipped 2026-08-27. Timezone display answered: **everyone sees maktab time**. |
| **9** | **Reword the empty-pool message** | — | `dhorSchedule.js:176` says "No memorised juz'/quarters recorded **yet** in Hifz Setup", implying she never set it up when she may have cleared it deliberately. Cosmetic, not a bug. |

**Dependency chain:** (j) → (k) → (l) is fixed. Everything else slots in freely.

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

25. ~~**Note-history button on the log cards**~~ **BUILT V3.85.0
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
