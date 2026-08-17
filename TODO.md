# Hifzhelper — TODO / known issues

Things that are **not done**: confirmed findings, agreed designs awaiting
a build, and open bugs. Per the standing process rule — document first,
build only once explicitly told to "start building".

Specs for delivered work live in `SPECS.md`; what changed and which files
were touched lives in `CHANGELOG.md`. Neither is an action list. This file
is the only one that is.

## LIVE ITEMS — the whole action list, in priority order (2026-08-17)

**If it is not in this table it is not outstanding.** One list, not two — a
summary kept separately from the detail is a second thing to keep in sync,
which is the failure CONVENTIONS.md §13 exists to stop. Deliberately **no
line numbers**: they go stale on the next edit. Headings are unique, so
search the text.

| # | Item | Blocked on | Why it sits here |
| --- | --- | --- | --- |
| ~~1~~ | ~~**(i) Read-routing rewrite**~~ — *ARCHITECTURE* | **DONE — V3.68.0, 2026-08-17** | The only item producing wrong data **now**: teachers see their own recent entries on a student's card, logged portions grow the teacher's pool instead of the maktab's, the tracker reads the teacher's pool. 16 sites, no schema change, no dependencies, spec ready, harness already written and flips to a permanent guard when done |
| **2** | **Shared maktab timezone** — *Flagged: Phase 2/Maktab* | One remaining decision (see the entry) | **DECIDED 2026-08-17: canonical timezone is a per-maktab setting, set on the maktab settings screen** (its 5th setting). Promoted from "future-proofing" because that premise expired — (a)–(h) have shipped, and (f)'s haidh propagation counts CALENDAR days, which is exactly what breaks across timezones. Cheapest to settle now: no real users, so nothing is yet recorded against a wrong day boundary |
| **1** | **(j) Account separation** — *ARCHITECTURE* | Needs "start building (j)" | **User paused testing 2026-08-17 until the maktab/PJ separation is done, so (j) is now the blocking item.** Two decisions landed with that: ADMIN-01 loses its history and becomes the maktab teacher; the PJ icons come out of the maktab. Both in the Open questions below | Unblocks (k). Largest single piece: migration + auth + the device-local switcher |
| **4** | **updateLog writes an unvalidated date** — *Flagged* | Nothing — scheduled | **DECIDED 2026-08-17: rides along with (j)**, the next worker-touching delivery. Not its own release. Real integrity gap (a bad date is written **and** silently skips attendance sync) but unreachable through the UI — the date picker cannot produce one; it needs a direct API call. Scheduling call, not a product decision |
| **5** | **(k) Merged journal** — *ARCHITECTURE* | (j) | Depends on (j) settling what a student account is |
| **6** | **(l) Archive** — *ARCHITECTURE* | (k) | Depends on (k)'s union existing |
| **7** | **dhorSchedule — 1 left** — *Flagged: dhorSchedule behaviour questions* | Your confirmation | **First one CLOSED 2026-08-17: confirmed intended, code already starts Dhor from the lowest marked juz ascending — proven against the real function, no change needed.** **Final scope 2026-08-17 — much smaller than it looked.** Removing/resetting juz from Dhor is LEGITIMATE (user's call, and it only changes the prepop), so an empty pool with history is a valid state, the Setup-reset path is not a fault, and the emptiness gate is correct as written. All that remains is (A): move the Dhor pool write server-side into the log insert. **Read before scoping (i)** — it removes a site from (i) rather than routing it, and makes (i) worker-touching |
| **8** | **Settings Haidh heading tweaks** — *Flagged* | Nothing — say "start building" | **Now THREE changes** (2026-08-17): resize + move the checkbox (confirmed not yet done), delete the "Ruling" label, and delete the ruling hint text. The hint deletion has a trap — see the entry; removing the element without its two JS writers reproduces the V3.51.2 blank-fields bug |
| **9** | **Home header icon removal** — *Flagged* | Nothing — say "start building" | **DECIDED 2026-08-17: remove the whole header row**, not just the icon. `#homeHeaderIcon` is in index.html, js/app.js (×2), css/nav.css |
| ~~10~~ | ~~**`apiSetAttendance`**~~ — *now "Closed — attendance clients"* | **CLOSED 2026-08-17** | **Was stale — nothing to do.** The function it named was removed back in V3.40.2; every attendance client that exists is live |

**Dependency chain:** (i) → (j) → (k) → (l) is fixed. Everything else can be
slotted between them in any order.

**Design — Maktab records (a)–(h): ALL SHIPPED.** That section is kept for
the design rationale later deliveries still reference — it is not an action.

**Corrected on 2026-08-17 — previously listed as open, actually shipped:**
maktab delivery **(e2)** (its heading read "OPEN … awaiting start building"
three deliveries after V3.60.0 built it) and the **V3.51.1 edit bottombar
tweaks** (heading read "awaiting start building" while the body directly
below recorded all ten items as built and verified). Both now in `SPECS.md`.
Two false open items and one stale migration instruction, all found in a
single pass, is what motivated the split.

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

## Flagged — Phase 2/Maktab: shared timezone (2026-08-08, DECIDED 2026-08-17)

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
