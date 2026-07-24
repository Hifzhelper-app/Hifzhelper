# Hifzhelper — Changelog

Each entry lists what changed and exactly which files were touched, so a
future delivery only needs those specific files re-uploaded — not the whole
repo. See `SETUP.md` for initial setup, `SCHEMA.md`/`CONVENTIONS.md` for the
standing reference docs (those aren't repeated here unless they change).

---

## V3.1 — frontend foundation (2026-07-24)

Bismillah. The first piece of the frontend rebuild against the V2/V3
backend — written fresh (new modular file structure), not adapted from
the old V1.x monolithic `app.js`/`api.js`/`styles.css`, per preference.

**What's actually built and tested this round:**
- **CSS token layer** (`css/tokens.css`) — the five-color palette and the
  three ring colors defined once as named variables with documented
  usage, exactly as instructed, so either can be changed in one place
  later rather than hunted through component files.
- **Journal landing table** (`css/journal-table.css`, `js/journal.js`) —
  the physical-planner-style table (Date | Sabaq | Sabaq Dhor | Dhor |
  Feedback), Sage header for Date, Mauve for the log columns, matching
  the actual paper journal. Pulls from the real `/sabaq`, `/sabaq-dhor`,
  `/dhor`, `/reflections`, `/plans` endpoints — genuinely wired to V2/V3,
  not a mockup.
- **Auth band + slide-down dropdown** (`css/nav.css`, `js/auth.js`) —
  icon+label nav, no background/border, per the styling instruction;
  dropdown adds logout/refresh on top of the same nav set Home uses.
- **Home page** (`js/home.js`) — icon tiles, same nav set as the dropdown.
- **Quick-add modal** — tapping a journal cell opens a simple form and
  saves a real log entry. Deliberately basic (no tajweed tags, timer, or
  flexible units yet) — enough to make the app genuinely usable for daily
  logging while the richer per-type pages are still ahead.
- **Multi-entry-per-day and plan-prepopulation both verified working** —
  tested the actual data-grouping logic (not just eyeballed): two Sabaq
  entries on the same day correctly bucket together under V2's uncapped
  model; a future-dated plan correctly creates a visible row for a day
  with no logs yet, confirming the "plan pre-populates the table row"
  mechanism actually works end to end at the data layer.
- `sw.js` updated to the new file list, cache version bumped so browsers
  don't keep serving the old cached assets.

**Deliberately NOT in this pass — the next pieces of work, not oversights:**
- The gamified three-ring visual map (frequency/mistakes/time, triadic
  colors) — the biggest remaining piece
- The Dhor timer/lap UI
- The dedicated per-log-type pages (reached via the table's column
  headers) — currently show an honest "not built yet" placeholder
- The three-model selector (13-line/Madina/Hybrid) in the UI — the
  underlying `data.js` logic exists (V2.0), not yet surfaced
- Privacy toggles (student_comment_private, teacher_feedback_visibility,
  reflections.is_private) in any input form
- Swipe rails (multiple entries per day currently just show a count
  badge, not a browsable rail)
- The V1.4 setup wizard has NOT been reconciled against the V2/V3 schema
  — everyone currently lands straight on the journal regardless of
  `setup_complete`; flagged directly in `app.js`, not silently skipped

**Please delete these from the repo — fully superseded, nothing imports them:**
```
frontend/app.js
frontend/api.js
frontend/styles.css
```

**Files changed/added:**
```
frontend/index.html
frontend/sw.js
frontend/css/tokens.css        (new)
frontend/css/base.css          (new)
frontend/css/nav.css           (new)
frontend/css/journal-table.css (new)
frontend/css/components.css    (new)
frontend/js/icons.js           (new)
frontend/js/api.js             (new)
frontend/js/auth.js            (new)
frontend/js/home.js            (new)
frontend/js/journal.js         (new)
frontend/js/app.js             (new)
```

---

## V3.0 — plans, timer/lap, privacy (2026-07-24)

Bismillah. Three features designed over several sessions, built together
in one migration since they touch overlapping tables.

**Plans** (`plans`, new table): an intention, not a record — a student can
plan a specific Dhor/Sabaq/Sabaq Dhor for a specific future date, then
complete it later either via a quick checkbox (no log created) or with
full detail (creates the real log entry, linked back via
`completed_log_id`). **The Dhor input screen's default view is now driven
by this** — a day with a plan shows it pre-filled to complete; a day
without falls back to the existing manual picker; multiple plans for one
day show a selection rather than guessing which one's intended.

**Timer/lap** (`dhor_log`): `minutes` renamed to `duration_seconds` (real
precision, not whole minutes — a lap feature needs it), plus a new
`lap_times` JSON array column holding true per-section durations. Same
"variable-length list as one column" pattern as `tajweed_tags`, deliberately
not flat `time1`/`time2` columns (the exact anti-pattern rejected earlier
when discussing reviews) and not a separate table (laps are always
created as one batch, never independently queried).

**Privacy**: `student_comment` (the student's own performance
self-assessment — distinct from `teacher_feedback`) gets a
`student_comment_private` flag; `reflections` gets the equivalent
`is_private`. `teacher_feedback` gets a three-tier
`teacher_feedback_visibility` (`all`/`teachers_only`/`private`), since
multiple teachers viewing one student is confirmed real, not
hypothetical. Enforced in `logHelpers.js`'s new `applyPrivacy()` — a
private field gets redacted at read time based on who's actually asking,
never a full row hidden. **Tested, not just written**: verified all three
viewer perspectives (the student, the authoring teacher, a different
teacher) against a realistic set of rows before shipping — every case
matched the intended rule.

**Files changed:**
```
worker/migrations/0006_plans_timer_privacy.sql   (new)
worker/src/plans.js                               (new)
worker/src/logHelpers.js
worker/src/sabaqLog.js
worker/src/sabaqDhorLog.js
worker/src/dhorLog.js
worker/src/reflections.js
worker/src/index.js
SCHEMA.md
```

**Still ahead**: the frontend — nothing calls `/plans` or the new
privacy/timer fields yet. Same sequencing as every other big change this
project: backend first, frontend as its own pass.

---

## V2.3 — real edit capability, not just comments (2026-07-22)

**Correction to V2.2's design**, not a bug fix — V2.2 only let `PATCH`
touch comment fields, on the reasoning that every save should be a
permanent, unedited record. Pushed back on directly: a user correcting a
mistake doesn't care whether that's implemented as "edit the row" or
"delete and re-log it" — same practical effect either way — and the app
can't enforce honesty about whether an edit reflects what actually
happened regardless of which mechanism exists. That's on the user, not
something to design around.

**What changed**: `PATCH` on all four logs (`/sabaq`, `/sabaq-dhor`,
`/dhor`, `/reflections`) now accepts any subset of that table's own
content fields *and/or* the comment fields, updating only what's
provided — one general-purpose partial update instead of a
comment-only one. `logHelpers.js`'s `updateComment` became the more
general `updateLog`.

**Still true from V2.2, unaffected by this**: saving is still always a
new row (no per-day cap, no upsert-by-date) — this correction is about
editing an *existing* row after the fact, not about how new entries get
created.

**Frontend responsibility, not built yet**: a confirmation before
submitting a content edit, since it overwrites what's there. Not
enforced server-side — that's a UX concern for whoever's about to
overwrite data, not a rule the API imposes.

**Files changed:**
```
worker/src/logHelpers.js
worker/src/sabaqLog.js
worker/src/sabaqDhorLog.js
worker/src/dhorLog.js
worker/src/reflections.js
worker/src/index.js
```

---

## V2.2 — Worker code for the four independent logs (2026-07-22)

The Worker code to actually use the V2.1 schema — written fresh, not
adapted from the old `entries.js`, per preference. A shared
`logHelpers.js` implements the CRUD/duplicate-detection logic once (all
four tables share the same student_id/date/entered_by/comment/
is_duplicate/created_at shape), so each of `sabaqLog.js`, `sabaqDhorLog.js`,
`dhorLog.js`, `reflections.js` stays a thin wrapper supplying just its own
fields and validation.

**Real behavior change from V1.x, worth knowing**: V2 has no per-day cap,
so saving is *always* a new row now, never an upsert. Deleting is by the
row's own `id` (a real primary key), not by `date` + `entry_number` the
way V1.3 worked — there's no more "editing today's entry," each save is
its own permanent record.

**New**: comment/feedback are no longer part of the same save as the
entry's content — a separate `PATCH` (`/sabaq`, `/sabaq-dhor`, `/dhor`,
body `{id, student_comment}` or `{id, teacher_feedback}`) adds or updates
just that field, since a comment can come from a different person, later
(reflections has no comment concept, so no `PATCH` there).

**Duplicate handling**: implemented as designed — allowed, not rejected,
just flagged (`is_duplicate = 1` on the new row) when it exactly matches
an existing row's content for that student/date.

**Attendance**: all three activity logs (sabaq, sabaq dhor, dhor) mark
present on save, per the original rule — reflections do not, since
tadabbur isn't one of the three activity logs that rule covers.

**Files changed:**
```
worker/src/logHelpers.js   (new)
worker/src/sabaqLog.js     (new)
worker/src/sabaqDhorLog.js (new)
worker/src/dhorLog.js      (new)
worker/src/reflections.js  (new)
worker/src/index.js
worker/src/utils.js
```

**Delete this file, it's no longer used and nothing imports it:**
```
worker/src/entries.js
```

**Still ahead**: the frontend rebuild (independent views per log, the
three-model selector) — this Worker code has no UI calling it yet.

---

## V2.1 — independent logs schema (2026-07-22)

The actual schema rebuild designed across the long V2 planning session:
the single `entries` table is replaced with four independent logs —
`sabaq_log`, `sabaq_dhor_log`, `dhor_log`, `reflections` — no caps, each
tracking `entered_by` separately from `student_id`, each comment/feedback
field carrying its own author and timestamp. `students`/`attendance`/
`position` are untouched.

No data migration from the old `entries` table — nothing real exists in
it yet, per the "delete everything, start fresh" decision made earlier.

**Files changed:**
```
worker/migrations/0005_v2_independent_logs.sql   (new)
SCHEMA.md
```

**Still ahead**: the Worker code (new modules for the four logs, written
fresh rather than adapted from the old `entries.js`, per preference) and
the frontend rebuild (independent views per log, the three-model
selector). This migration alone doesn't make anything work yet — the old
`worker/src/entries.js` still references a table this migration just
dropped, so **do not deploy this migration without also deploying new
Worker code in the same step** — same code/schema-mismatch risk flagged
back in V1.3, same fix: merge and migrate together, not with a gap
between them.

---

## V2.0 — 13-line (IndoPak) line/page data (2026-07-22)

First entry in the V2.x line — the six-table independent-logs redesign
(sabaq_log/sabaq_dhor_log/dhor_log/reflections, the three-model reference
selector, the setup-page rebuild) is designed but not yet built; this
version starts the new numbering with the first concrete piece of it: real
line/page counting for the 13-line print, closing a gap that took most of
a full session to properly source and verify (two rejected reconstruction
attempts before finding data that actually held up).

**What's new**: `shared/data.js` gains `AYAH_WORD_RANGE` (all 6236 ayahs'
word-ID ranges, universal across print layouts) and `LINE13_RANGES`
(10769 real content lines for the 13-line print), plus
`getLines13ForAyahRange(surah, ayahFrom, ayahTo)` — returns line/page
counts for a given ayah range. Verified 114/114 against the print's own
surah markers; noted as approximate (not exact-reference-grade like the
15-line data) given a ~4% discrepancy rate found when cross-checked at
finer granularity.

**Naming correction, going forward**: stop saying "Waterval" — too
localised a name. Say "13-line (IndoPak)" instead. The internal code key
(`RUB_BOUNDARIES.waterval`) is left as-is for now rather than a piecemeal
rename — it'll be properly renamed as part of the upcoming three-model
selector rebuild (Model 1 / Model 2 / Model 3), which touches this same
code anyway.

**Files changed:**
```
shared/data.js
SCHEMA.md
```

---

## V1.4 — self-onboarding setup page (2026-07-20)

New students now walk through a one-time setup screen on first login,
instead of starting from a completely blank journal. Decided against
importing historical data from old systems (a real example — Umme's dhor
log CSV — surfaced the design question, but the answer was: students
self-enter where they're starting from, the app builds forward from there).

**Setup collects**: name, gender (stored directly, may drive future
styling), haidh-tracking preference (shown only for females, independent
toggle — not auto-enabled by gender), Quran print preference (reuses the
existing device-level toggle), current sabaq position, and which juz' are
already complete (reuses the existing manzil strip, in a tap-to-mark-
complete mode). Last-dhor dates are optional — enter them if known,
otherwise a segment is simply treated as never-revised, no fabricated
history.

**Reused rather than rebuilt**: `POST /position` already accepted exactly
the shape setup needs — no new endpoint for the juz'/dhor part. The
position-update logic itself was extracted into a shared
`applyReachedPosition()` function (used by both the daily save handler and
setup), and `renderJuzStripInto()` was parameterized to accept a tap
handler, so setup's "mark complete" mode doesn't trigger a live API call
per tap the way the daily journal's does.

**New**: `GET /profile` / `POST /profile` endpoints; `gender`,
`track_haidh`, `setup_complete` columns on `students`.

**Known shortcut, not a polish gap to ignore forever**: last-dhor date
entry during setup uses a plain browser `prompt()`, not a custom date
picker — deliberate simplicity for a one-time screen, worth revisiting if
it turns out to feel rough in practice.

**Files changed:**
```
worker/migrations/0004_profile_setup.sql   (new)
worker/src/profile.js                       (new)
worker/src/index.js
frontend/api.js
frontend/app.js
frontend/index.html
SCHEMA.md
TESTING.md
```

---

## V1.3 — up to two entries per day (2026-07-19)

Students can now log a second sabaq/sabaq dhor/dhor on the same day
(capped at two). Design: `entries` gets an `entry_number` column (1 or 2),
uniqueness changes from `(student_id, date)` to `(student_id, date,
entry_number)`. Frontend shows a normal form for the first entry; once it
exists, an "Add a second sabaq today" button appears; once both exist, a
small Entry 1 / Entry 2 switcher replaces it.

**Two real bugs fixed along the way, not just the new feature:**
- The delete-entry handler (both Worker and frontend) previously matched
  only on `date` — meaning deleting one entry would have deleted *both* of
  a day's entries once this feature existed. Fixed to match on
  `(date, entry_number)`.
- The frontend's local attendance optimistic-update still had the old
  "unless already haidh" exception from before the V1.1 fix — the server
  was corrected months ago but this client-side mirror wasn't. Now matches:
  sabaq always wins, unconditionally.

**Files changed:**
```
worker/migrations/0003_two_entries_per_day.sql   (new)
worker/src/entries.js
worker/src/utils.js
frontend/api.js
frontend/app.js
frontend/index.html
frontend/styles.css
SCHEMA.md
TESTING.md
```

**Migration note**: 0003 rebuilds the `entries` table (SQLite can't ALTER a
UNIQUE constraint in place) — existing rows are preserved with
`entry_number = 1`. Run it on dev first, verify via `TESTING.md` §2, then
production, same as every migration so far.

---

## V1.2 — new-account secret bug, resolved (2026-07-19)

**Bug (new account only, not a code defect)**: after migrating to the new
`hifzhelper-app` Cloudflare account, `hifzhelper-api-dev` returned a `500`
on every login attempt — `DataError: Imported HMAC key length (0)...`. Root
cause: `HH_AUTH_SECRET` had been saved with an empty value during initial
setup (the dashboard showed it as configured either way, since it never
displays the actual value back). Fixed by deleting and re-adding the secret
with a genuine random value. Confirmed fixed by direct evidence — added a
temporary `/debug/env` route reporting the secret's type/length (never its
value) to get real ground truth instead of continuing to infer from side
effects; removed again once resolved.

**Production was unaffected** — tested cleanly on first attempt, confirming
it was set up correctly from the start; this was a dev-environment-only
mistake.

**Files changed:**
```
worker/src/index.js
```
(temporary debug route added, then fully removed in the same version — net
effect on this file is zero, but noting it here since two separate patches
were shipped and reverted during the diagnosis)

**Lesson for future setup**: a "Value encrypted" / secret-looks-configured
display in the dashboard does not confirm the value is non-empty. Worth a
quick `/debug/env`-style sanity check (or just an immediate login test)
right after setting secrets on any new environment, rather than assuming
success from the save confirmation alone.

---

## V1.1.1 — new Cloudflare account/repo migration (2026-07-19)

Moved Hifzhelper to its own dedicated repo and Cloudflare account
(previously shared with other projects). No code logic changed — only
the backend URLs the frontend points at, since the new account has a
different Workers subdomain.

**Files changed:**
```
frontend/api.js
TESTING.md
```

**New URLs** (replacing the old `*.maktab4life.workers.dev` ones):
- Dev: `https://hifzhelper-api-dev.hifzhelper-app.workers.dev`
- Production: `https://hifzhelper-api.hifzhelper-app.workers.dev`

**Still needed on the new account before this is testable** (see SETUP.md):
migrations run against both new D1 databases, secrets set on both new
Worker projects, Git integration connected for both, a fresh test student
inserted into the new dev database. None of this carries over automatically
just because the repo/code is identical.

---

## V1.1 — attendance rule correction (2026-07-19)

**Bug fix**: attendance was built with a "haidh takes precedence over a
logged entry" exception that was never actually part of the agreed rule —
it was my own assumption layered on top of "any recorded activity marks
present." The real rule is simpler: **sabaq always wins**. Logging an
entry now unconditionally marks that day present, including overriding a
day previously marked haidh manually.

**Files changed:**
```
worker/src/entries.js
SCHEMA.md
TESTING.md
```

**Retest before merging to `main`**: re-run the "Manual override" row in
`TESTING.md` §3 — mark a date `haidh`, then save an entry for that same
date, then confirm via D1 console it now shows `present`, not `haidh`.

---

## V1.0 — baseline (2026-07-19)

The first fully working version: student journal PWA (localStorage removed,
now backed by a real Cloudflare Worker + D1), login/PIN auth with lockout,
entries/attendance/position all persisted server-side and verified working
end-to-end against the dev environment (login, repeat-login, wrong-PIN,
5-attempt lockout, entry save/read, attendance auto-marking — all tested via
Hoppscotch against `hifzhelper-api-dev`).

See `TESTING.md` for the repeatable version of that same test sequence —
worth re-running it against any future version before considering it done.

**Everything in this delivery** (full repo, since this is the baseline):
```
.gitignore
CONVENTIONS.md
SCHEMA.md
SETUP.md
frontend/index.html
frontend/app.js
frontend/api.js
frontend/styles.css
frontend/manifest.json
frontend/sw.js
shared/data.js
worker/wrangler.jsonc
worker/package.json
worker/src/index.js
worker/src/auth.js
worker/src/entries.js
worker/src/attendance.js
worker/src/position.js
worker/src/utils.js
worker/migrations/0001_initial.sql
worker/migrations/0002_auth_lockout.sql
```

**Known gaps, carried forward (not bugs, just not done yet):**
- Custom tajweed tags stay local-only (no server field for them yet)
- No offline write queue — a failed save just shows an error, no retry
- Production Worker/database never tested end-to-end (only dev)
- CSS not yet split into modules (requested for next revision)
- Teacher/Maktab view (Phase 2) not started
- Mistake-marking on a page image (Phase 3) not started
