# Hifzhelper — TODO / known issues

Things that are **not done**: confirmed findings, agreed designs awaiting
a build, and open bugs. Per the standing process rule — document first,
build only once explicitly told to "start building".

Specs for delivered work live in `SPECS.md`; what changed and which files
were touched lives in `CHANGELOG.md`. Neither is an action list. This file
is the only one that is.

## LIVE ITEMS — everything open, 2026-08-17

The whole action list. If it is not here it is not outstanding.
Deliberately **no line numbers**: they go stale on the next edit, which is
the failure this restructure exists to stop. Headings are unique — search
the text.

**Designs agreed, nothing built — each needs its own "start building":**

| Item | Where | State |
| --- | --- | --- |
| Maktab records Phase 2, deliveries (a)–(h) | *Design — Maktab records* | **(a)–(h) ALL SHIPPED.** Kept for the design rationale the later deliveries still reference |
| Read-routing rewrite **(i)** | *ARCHITECTURE* | Spec ready, urgent, no schema change — **do this first** |
| Account separation **(j)** | *ARCHITECTURE* | Spec ready; blocks (k) |
| Merged journal **(k)** | *ARCHITECTURE* | Spec ready; depends on (j) |
| Archive **(l)** | *ARCHITECTURE* | Spec ready; depends on (k) |

**Open bugs and flagged items — each verified against the code 2026-08-17:**

| Item | Verified state |
| --- | --- |
| *updateLog writes an unvalidated date* | **Live.** `date` reaches the row through the `contentFields` branch with no validation; `isValidDate` is consulted only to decide attendance sync, so an invalid date is both written *and* silently skips attendance |
| *Home header icon removal* | **Live.** `#homeHeaderIcon` still in index.html, js/app.js (×2), css/nav.css |
| *Phase 2/Maktab: shared timezone* | **Live.** Design question, unresolved |
| *Settings Haidh heading tweaks* | **Live.** `.haidh-ruling-label` still at index.html:1089; both tweaks outstanding |
| *Flagged, not yet resolved* (dhorSchedule ×2) | **Live.** Both are "confirm the intended behaviour" questions |
| *Parked — attendance* | **Partly closed.** Only `apiSetAttendance` is now unwired; see the entry |

**Corrected on 2026-08-17 — previously listed as open, actually shipped:**

- Maktab delivery **(e2)** — its heading still read "OPEN … awaiting start
  building" three deliveries after V3.60.0 built it.
- **V3.51.1 edit bottombar tweaks** — heading read "awaiting start building"
  while the body directly below recorded all ten items as built and verified.

Both are now in `SPECS.md`. Two false open items and one stale migration
instruction, all found in a single pass, is what motivated the split.

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

**16 unrouted call sites:**

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

**(i) Read-routing rewrite + the guard.** All 16 sites through the
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

1. **Existing accounts.** ADMIN-01 currently has an admin role AND
   journal data (including the stray haidh mark and a known-wrong
   stored position). Under the separation it should become a teaching
   account with no journal, and any real hifz data would move to a new
   student account. Test Student / Umme are already students. What
   should happen to ADMIN-01's existing journal rows -- discard
   (dev data), or migrate to a new student account?
2. **Setup screen vs juz tracker.** They do the same job. Claude's
   lean, consistent with what worked for the log cards: the juz tracker
   BECOMES the maktab setup (a teacher opens a student's tracker, it
   reads and writes the maktab pool) and the (h) setup screen is
   deleted. Alternatives: keep both (then which is authoritative?), or
   leave the tracker PJ-only.

## Flagged — updateLog writes an unvalidated date straight to the row (2026-08-15)

Found while writing V3.54.0's test harness, not introduced by it and
not fixed by it. `updateLog`'s generic field-update loop writes
whatever's in `updates.date` directly into the log's `date` column —
no `isValidDate` check on that write itself, only (as of V3.54.0) on
whether it's well-formed enough to trigger the attendance sync. A
malformed date currently can't be produced by the frontend's date
picker, so this needs a direct API call to reach — low real-world
risk, but a genuine gap in what the endpoint itself guarantees.
User's call whether this is worth its own small delivery.

## Flagged — Home header icon removal, separate from the redesign above (2026-08-09)

- [ ] Remove the home icon from Home's own header row entirely,
  confirmed in chat — this is `#homeHeaderIcon`, the lavender `home`
  icon in Home's `card-header-row` (V3.43 already stripped the "Home"
  text label next to it). Now the icon itself goes too, leaving that
  header row empty of both icon and text. Not yet decided/asked: does
  the empty `card-header-row` div stay in the markup (just visually
  blank), or does the whole header row element get removed too,
  leaving the tile grid as the screen's only content? Leaning toward
  removing the whole row rather than leaving a blank one, but flagging
  rather than assuming. NOT part of the V3.44 build below — separate,
  still unresolved.

## Flagged — Phase 2/Maktab: shared timezone (2026-08-08)

- [ ] Future-proofing note, NOT current-phase work (Phase 2/Maktab
  hasn't started — see profile): once there's a maktab with students
  across different timezones, everyone needs to operate on ONE shared,
  canonical timezone (attendance/haidh/journal date boundaries, etc.),
  rather than each device's own local timezone — otherwise "today"
  means a different calendar day for different users, plus the exact
  class of bug just diagnosed below becomes structural rather than a
  one-off. Raised in chat right after debugging the timezone date-shift
  bug, deliberately kept separate from that fix (the fix itself stays
  device-timezone-agnostic and correct either way).
- [ ] Open design questions for whenever this is picked up: is the
  canonical timezone fixed or configurable per maktab; where a
  teacher/admin would set it (Maktab phase doesn't exist yet); whether
  the UI should still DISPLAY times in each user's own local time for
  readability while storing/calculating against the shared one, or show
  the maktab's timezone everywhere regardless of viewer location.


## Flagged — Settings Haidh heading tweaks (2026-08-08)

- [ ] Checkbox next to "Haaidha": make it 2x its current size, and move
  it from the LEFT of the heading text (where V3.40.1 put it) to the
  RIGHT of it instead — heading text first, checkbox immediately after.
  User's message cut off after "...to" — worth confirming there wasn't
  more to this before building.
- [ ] Remove the "Ruling" label entirely (`.haidh-ruling-label` above
  the Hanafi/Shafi'i switch, added in V3.40.1) — just the switch itself,
  no text label above it.

## Flagged, not yet resolved

- [ ] Phase C's "has Setup configured, but no dhor_log yet" case
  (`computeUpcomingDhorQueue`, `worker/src/dhorSchedule.js`) reuses the
  same pool-start logic as "no Setup, no history" — Claude's own
  extrapolation, since chat didn't address that exact combination.
  Worth confirming it's the intended behavior.
- [ ] computeDefaultDhorEntry checks pool-emptiness before ever querying
  dhor_log, so a student with an empty Setup pool but real Dhor history
  never gets a chance at continue-from-last (predates the pure-queue
  rebuild). Low stakes: if the pool is genuinely empty, continue-from-
  last couldn't build anything from it anyway, so the functional result
  is likely the same either way — mostly a tidiness/ordering question.

## Parked — attendance (2026-08-03, rechecked 2026-08-17)

- [ ] **Rechecked 2026-08-17 — this item is now only one third true.**
  `apiGetAttendance` has 4 call sites and `apiDeleteAttendance` has 1;
  `apiPredictHaidh` has 1, as originally noted. Only **`apiSetAttendance`**
  is still at zero call sites. Note that (e2) wired the teacher-side
  `apiSetAttendanceFor` / `apiClearAttendanceFor` variants for maktab haidh
  entry — those are separate functions and are live; the own-scoped
  `apiSetAttendance` is the one with no UI entry point. Decide whether to
  build the own-scoped manual marking UI or delete that one function.


---

## Delivered work

Specs and reasoning for all 90 shipped deliveries: **`SPECS.md`**.
Files touched per delivery: **`CHANGELOG.md`**.
