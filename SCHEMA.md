# Hifzhelper — Data Schema

Reset admin pin : npx wrangler d1 execute hifzhelper-personal-db --remote --command="UPDATE students SET pin_hash = NULL, failed_attempts = 0, locked_until = NULL WHERE id = 'ABCDEFG';"

One Cloudflare D1 database per maktab (max ~100 students each). These are the
canonical table names and column names — the Worker and frontend must use
these exact field names (see CONVENTIONS.md, principle 5). If a name needs
to change, change it here first, then everywhere else. The actual `CREATE
TABLE` statements live in `worker/migrations/` — this file is the
human-readable reference for the same thing.

---

## Table: `students`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (PK) | Random code, not sequential (e.g. `K7M2QX`). Used to log in. |
| `name` | TEXT | Display name. |
| `role` | TEXT | `student` or `teacher`. |
| `pin_hash` | TEXT | Set on first login, not at creation. Never store the raw PIN — this is `salt:hash`, see `worker/src/auth.js`. |
| `created_date` | TEXT | `YYYY-MM-DD`. |
| `active` | INTEGER | `1`/`0`. Disable without deleting history. |
| `failed_attempts` | INTEGER | Added in migration 0002, for login rate-limiting. Resets to 0 on success. |
| `locked_until` | TEXT | Added in migration 0002. ISO timestamp; NULL = not locked. |
| `gender` | TEXT | Added in migration 0004. `M` or `F`. Stored directly (not just derived haidh eligibility) — may drive different styling later. |
| `track_haidh` | INTEGER | Added in migration 0004. `1`/`0`. Only ever shown as an option to females; not auto-set from gender. V3.39: finally wired to real UI — Setup's Haidh section "Haaidha" checkbox, saved instantly via `apiSaveProfile({track_haidh})` outside that section's own Save button. Gates the "Haidh" nav item (`js/auth.js`). |
| `setup_complete` | INTEGER | Added in migration 0004. `1`/`0`. Gates whether the setup wizard shows on login. |
| `journal_name` | TEXT | Added in migration 0009. A custom title for the student's own journal — not their real name. |
| `mushaf` | TEXT | Added in migration 0009. `13line` / `15line_madani` / `15line_indopak`. V3.36, confirmed in chat: the earlier `hybrid` value removed entirely (migration 0016) — traced and confirmed it never actually behaved differently from `13line` (its `ref` logic fell through to the same `waterval` branch), so nothing real was lost by removing it. Replaced with `15line_indopak`, using its own verified page/line dataset (`shared/data.js`'s `AYAH_LINE_INDOPAK`) for Sabaq's Lines/Pages, not Madina's. |
| `baseline_selection` | TEXT | JSON array of integers. As of V3.15.0: quarter-unit IDs (1-120 — see `shared/data.js`'s `quarterUnitId`/`quarterUnitToJuzQuarter`), NOT whole juz' numbers — quarter-unit N = juz' `ceil(N/4)`, structural quarter `((N-1)%4)+1`. Lets a juz' be partially eligible (e.g. just one half), needed once Sabaq Dhor can send a half-juz' to Dhor independently of the other half. Setup's Juz' grid still shows/marks whole juz' — it expands each to its 4 quarter-unit IDs on save, and shows a juz' as marked only when all 4 are present. A one-time, self-reported "already memorised" fact, NOT backdated log entries. Deliberately separate from `position` (which holds state DERIVED from actual sabaq sessions). 2026-08-07 (V3.38): `baseline_mode` (added migration 0010, `surah`/`juz`/NULL) is dropped entirely, not just unused — Surah-based history is on hold, confirmed in chat ("History will only be collected as juz"), so juz' is the only mode and there's nothing left for a mode flag to distinguish (migration 0017). |
| `target_mistakes_per_juz` | INTEGER | Added in migration 0010. Default `2`. User-adjustable ring target (see the Gamified visual map design — rings themselves aren't built yet, this just stores the setting). |
| `target_minutes_per_juz` | INTEGER | Added in migration 0010. Default `40`. |
| `target_frequency_days` | INTEGER | Added in migration 0010. Default `30` (represents "once/month" as a day-count for later recency math). |
| `dhor_granularity` | TEXT | Added in migration 0011. `juz` / `half` / `quarter` / NULL. How much of a juz' one Dhor Schedule session covers — always exactly 1/2 or 1/4 of a juz' regardless of `mushaf`, distinct from `dhor_log.ref`'s own quarter/eighth marker system (see `shared/data.js`'s `unitMarkerCount`, which reconciles the two). |
| `dhor_quantity` | INTEGER | Added in migration 0011. How many of the above unit, per session (e.g. `2` quarters). |
| `dhor_frequency` | TEXT | Added in migration 0011. `daily` / `twice` / NULL. |
| `dhor_days_of_week` | TEXT | Added in migration 0011. JSON array, e.g. `["mon","wed","fri"]`. |
| `haidh_cycle_length` | INTEGER | Added in migration 0011. Persisted purely so Setup can redisplay the student's last-entered value — the real prediction logic is unchanged (`/attendance/predict`, live since migration 0001). Labeled "Haidh cycle frequency" in Setup as of V3.39. Clinically-standard start-to-start cycle length (confirmed in chat), NOT the inter-period gap itself — its real minimum is dynamic, `haidh_period_length + 15` (`shared/haidhRules.js`'s `haidhMinCycleFrequency`), not a flat number, since the 15-day gap rule has to hold for whatever duration the student enters. |
| `haidh_period_length` | INTEGER | Added in migration 0011. Same purpose as above. Labeled "How many haidh days per cycle" in Setup as of V3.39. Capped at the student's `haidh_ruling` (10 for hanafi, 15 for shafii — `shared/haidhRules.js`'s `haidhOfficialMaxDuration`). |
| `haidh_next_expected` | TEXT | Added in migration 0011. `YYYY-MM-DD`. What the Setup screen actually asks the student for; the frontend computes `/attendance/predict`'s own `lastStart` param from this (`lastStart = haidh_next_expected − haidh_cycle_length`) rather than asking for `lastStart` directly. |
| `haidh_ruling` | TEXT | Added in migration 0018 (V3.39). `hanafi` / `shafii`, `NOT NULL DEFAULT 'hanafi'` — which of the two supported fiqh rulings sets this student's max haidh duration. Defaults silently rather than blocking (confirmed in chat: not a required choice). |

## Tables: `sabaq_log`, `sabaq_dhor_log`, `dhor_log`, `reflections` (V2 — replaces `entries`)

Four independent logs, replacing the old single `entries` table (V1.x —
see CHANGELOG V2.1 for why: Sabaq, Sabaq Dhor, and Dhor have genuinely
independent lifespans — different people log them, at different times,
at different lifelong frequencies, and a single shared row could never
answer "how has my dhor time-per-session changed over a year"). No caps —
any number of entries per day. `entered_by` records who actually logged it
(the student, or a teacher on their behalf) — distinct from `student_id`
(whose journal it belongs to). Exact-duplicate saves are allowed but
flagged (`is_duplicate = 1`), never rejected or silently dropped.

Each of `sabaq_log`, `sabaq_dhor_log`, and `dhor_log` carries the same
comment/feedback shape — a student comment and a teacher feedback, each
with its own `_by` (who wrote it) and `_at` (when), since a comment can
be added later by a different person than whoever logged the entry.
They also share the same privacy shape (added in migration 0006):
`student_comment` (the student's own performance self-assessment, distinct
from `teacher_feedback`) gets a simple `student_comment_private` flag;
`teacher_feedback` gets a three-tier `teacher_feedback_visibility`
(`all` / `teachers_only` / `private`) since multiple teachers viewing one
student is real, not hypothetical — `private` restricts to the specific
teacher who wrote it, `teachers_only` hides it from the student but shows
any teacher, `all` shows everyone. Enforced in `logHelpers.js`'s
`applyPrivacy()` at read time, not by hiding rows — a private field is
redacted, the entry itself still shows.

**`sabaq_log`**

| Column | Type | Notes |
|---|---|---|
| `student_id` | TEXT (FK) | → `students.id`. |
| `date` | TEXT | `YYYY-MM-DD`. |
| `entered_by` | TEXT (FK) | → `students.id`. Who actually logged this. |
| `sabaq_from` / `sabaq_to` | TEXT | Added in migration 0015, replacing `surah`/`ayah_from`/`ayah_to` (dropped that same migration — a clean removal, not left deprecated-in-place). Each is a combined `"surah:ayah"` string (e.g. `"114:6"`) — since `sabaq_from` and `sabaq_to` can each name a *different* surah, one entry can span multiple surahs directly (confirmed in chat: capped at crossing at most one juz' boundary, no other limit). Validation (per-surah ayah bounds, the one-juz'-boundary cap) happens client-side (`shared/data.js`'s `crossesAtMostOneJuzBoundary`) before save. |
| `line_count` | INTEGER | Added in migration 0013. Auto-computed client-side (`getLinesForSpan`, `shared/data.js` — sums across every surah the from/to span touches, not just one) once both fields are set, shown editable. |
| `page_count` | INTEGER | Added in migration 0013, same computation/editability as `line_count`. |
| `tajweed_tags` | TEXT | Comma-separated tags, e.g. `Ghunnah,Madd`. |
| `student_comment` / `_by` / `_at` | TEXT / TEXT (FK) / TEXT | |
| `student_comment_private` | INTEGER | `1` = hidden from teachers, visible only to the student themself. NOTE (V3.56.0): the column's `DEFAULT 0` (migration 0006) is dead code — every code path that writes a note writes this flag explicitly alongside it, and the UI defaults NEW entries to private (checked). The DDL default was deliberately NOT changed (a full 3-table rebuild for a default nothing reaches); don't read `DEFAULT 0` as the app's actual behaviour. Rows with no note keep flag 0, which is meaningless without a note. |
| `teacher_feedback` / `_by` / `_at` | TEXT / TEXT (FK) / TEXT | |
| `teacher_feedback_visibility` | TEXT | `all` / `teachers_only` / `private`. Default `all`. |
| `is_duplicate` | INTEGER | `1` if it exactly matches an existing entry for this student/date. |
| `created_at` | TEXT | ISO timestamp. |

**`sabaq_dhor_log`**

| Column | Type | Notes |
|---|---|---|
| `student_id` / `date` / `entered_by` | — | Same as `sabaq_log`. |
| `zone` | TEXT | Deprecated as of migration 0014 (V3.13.0) — no longer written to by the frontend, left in place for backward compatibility. Was a computed juz' list at save time, e.g. `Juz' 29, 30`. |
| `from_surah` / `from_ayah` / `to_surah` / `to_ayah` | INTEGER | Added in migration 0014. The actual saved range — composited client-side from whichever checkable quarter-sections the student left checked (`js/position.js`'s `computeSabaqDhorSections`), replacing `zone`. |
| `tajweed_tags` | TEXT | |
| `mistakes` | INTEGER | |
| `student_comment` / `_by` / `_at` / `_private`, `teacher_feedback` / `_by` / `_at` / `_visibility` | — | Same shape as `sabaq_log`. |
| `is_duplicate`, `created_at` | — | Same as `sabaq_log`. |

**`dhor_log`**

| Column | Type | Notes |
|---|---|---|
| `student_id` / `date` / `entered_by` | — | Same as `sabaq_log`. |
| `segment_from` | INTEGER | Segment unit — 1–120 (13-line/IndoPak quarters) or 1–240 (Uthmani 1/8's), depending on `ref`. Can span across juz' boundaries. Dhor keeps its own quarter-granularity input — it does not use the flexible ayah/page/surah system that `sabaq_log` uses. |
| `segment_to` | INTEGER | Same units as `segment_from`. |
| `ref` | TEXT | `waterval` (internal key name — see naming note in CHANGELOG V2.0) or `uthmani`. Recorded per-entry so history displays correctly even if the setting changes later. |
| `tajweed_tags` | TEXT | |
| `mistakes` | INTEGER | |
| `duration_seconds` | INTEGER | Renamed from `minutes` in migration 0006 — the timer feature needs real precision, not whole minutes. Time is only tracked on dhor, not sabaq/sabaq dhor. |
| `lap_times` | TEXT | JSON array of true per-section durations in seconds, e.g. `[125,95,140]` — same "variable-length list as one column" pattern as `tajweed_tags`, not numbered columns or a separate table. Optional. |
| `student_comment` / `_by` / `_at` / `_private`, `teacher_feedback` / `_by` / `_at` / `_visibility` | — | Same shape as `sabaq_log`. |
| `is_duplicate`, `created_at` | — | Same as `sabaq_log`. |

**`reflections`**

| Column | Type | Notes |
|---|---|---|
| `student_id` / `date` / `entered_by` | — | Same as above. |
| `reflection` | TEXT | Tadabbur only — genuinely separate from teacher feedback, which lives on the three logs above, not here. |
| `is_private` | INTEGER | `1` = hidden from teachers. Same idea as `student_comment_private`, but reflections have no teacher-feedback concept, so no visibility tiers needed. |
| `created_at` | TEXT | |

## Table: `plans`

A plan is an intention, not a record of something that happened — genuinely
different from the four logs above (no mistakes, no minutes, no comments;
those only exist once something's actually occurred). The Dhor input
screen's *default* view is driven by this table: a day with a plan shows it
pre-filled to complete; a day without one falls back to the manual picker.

`dhor`-type rows have no creation path left at all as of V3.28.0. They
used to come from either a direct `POST /plans` call, or from a rolling
Dhor Schedule generator that pre-generated a window of dated future rows
from a student's `dhor_granularity`/`dhor_quantity`/`dhor_frequency`/
`dhor_days_of_week` settings (added migration 0011), including an
explicit-anchor variant for Setup's "Tomorrow's Portion" field. The
generator was confirmed wrong and removed as of V3.25.0 (see
`CHANGELOG.md`) — a `plans` row isn't supposed to carry a date for
anything not yet done at all.
`worker/src/dhorSchedule.js`'s `ensureDhorSchedule` was kept briefly as a
no-op, then removed entirely as of V3.27.0 once Setup's "Tomorrow's
Portion" (its last remaining caller) was itself removed — confirmed in
chat: it served no purpose once a student could already redirect the
queue by saving a different portion via Plan Dhor. `POST`/`PATCH`/
`DELETE /plans` (`handleCreatePlan`/`handleUpdatePlan`/`handleDeletePlan`)
were removed as of V3.28.0 too — confirmed zero callers anywhere in the
app for any of the 3 plan types, not just dhor. Only `GET /plans`
remains, for `journal.js`'s own upcoming-plans view.
`computeDefaultDhorEntry` computes the next queue item live, from
`dhor_log`, instead of relying on pre-generated dated rows — its
`today_plan`/explicit-override branch is now fully dormant (nothing in
the app can create a `plans` row at all any more, dhor-type or otherwise);
the check itself is left in place rather than removed, since it's cheap
and doesn't assume anything false.

| Column | Type | Notes |
|---|---|---|
| `student_id` | TEXT (FK) | → `students.id`. |
| `entered_by` | TEXT (FK) | Student or teacher who created the plan. |
| `plan_type` | TEXT | `dhor` / `sabaq` / `sabaq_dhor`. |
| `target_date` | TEXT | A specific date, not a range — "next week" means several individually-dated plans. |
| `segment_from` / `segment_to` / `ref` | INTEGER / INTEGER / TEXT | For `dhor` plans — same units as `dhor_log`. |
| `surah` / `ayah_from` / `ayah_to` | INTEGER | For `sabaq` / `sabaq_dhor` plans. |
| `notes` | TEXT | Optional free text. |
| `status` | TEXT | `planned` / `completed` / `skipped`. |
| `completed_log_id` | INTEGER | Set only if completed with full detail — links to the real `dhor_log`/`sabaq_log`/`sabaq_dhor_log` row that fulfilled it. Null if completed via the quick checkbox (both completion paths are supported). |
| `completed_at` | TEXT | |
| `created_at` | TEXT | |

## Table: `attendance`

Composite primary key `(student_id, date)`.

| Column | Type | Notes |
|---|---|---|
| `student_id` | TEXT (FK) | → `students.id`. |
| `date` | TEXT | `YYYY-MM-DD`. |
| `status` | TEXT | `present` / `absent` / `haidh` / `predicted-haidh`. Auto-set to `present` whenever any entry is logged that day — sabaq always wins, overriding even a prior `haidh`. V3.39: setting `haidh`/`predicted-haidh` (`handleSetAttendance`, `worker/src/attendance.js`) is capped two ways, both via `shared/haidhRules.js`'s `evaluateHaidhMark` — a continuous run can't exceed the student's `haidh_ruling` max (+1 calendar day, for a haidh that starts/ends mid-day), and a new run can't start until 15 official / 14 code days have passed since the last one. Never touches `sabaq_log`/`sabaq_dhor_log`/`dhor_log` in either direction (confirmed in chat: "no log deletion, nothing changes on detail cards"). |

## Table: `position`

One row per student (`student_id` is the primary key) — current progress
state, updated in place, not appended.

| Column | Type | Notes |
|---|---|---|
| `student_id` | TEXT (PK/FK) | → `students.id`. |
| `position_json` | TEXT | JSON blob. As of V3.14.0: `{ sabaqTo: {surah, ayah} \| null, activeJuz }` — `sabaqTo` is the single source of truth, the actual last point Sabaq reached; `activeJuz` is a DERIVED value (recomputed from `sabaqTo` after every save) kept only so the not-yet-rebuilt Sabaq Dhor card (`computeSabaqDhorSections`) keeps working unchanged in the meantime — nothing treats it as independently meaningful. The old `juz'-completion → auto-add to baseline_selection` behaviour is REMOVED (V3.12.0 had it; superseded — that's now Setup's own job). Computed/updated entirely client-side (`js/position.js`). Not meant for hand-editing. |
| `last_dhor_json` | TEXT | JSON blob: `{ "<segment-unit>": "<last-revised-date>", ... }` — segment units match whichever reference (waterval/uthmani) is active. |
| `updated_at` | TEXT | ISO timestamp of last write, for debugging/sync purposes. |

---

## Reference data (not in the database — lives in `shared/data.js`)

These don't vary per student or per maktab, so they aren't stored per-maktab
in D1 — they ship as static data with the app instead:

- `SURAHS` — the 114 surah names/numbers
- `JUZ_BOUNDARIES` — 30 juz' start points (surah:ayah) — CONFIRMED (2026-07-29) to be the
  13-line print's own boundaries specifically, not print-independent as previously assumed here
- `JUZ_BOUNDARIES_UTHMANI` — the 15-line Madani print's own 30 juz' start points, derived
  2026-07-29 from `RUB_BOUNDARIES.uthmani` (every 8th marker). Differs from `JUZ_BOUNDARIES`
  at exactly one point (juz' 4) — verified against all 30, not assumed
- `RUB_BOUNDARIES.waterval` — 120 markers for the 13-line (IndoPak) print (internal key name
  predates the "stop calling it Waterval" naming correction — kept as-is for now, to be
  properly renamed as part of the three-model selector rebuild rather than a piecemeal rename)
- `RUB_BOUNDARIES.uthmani` — 240 markers (rub' al-hizb), verified from Quran Foundation metadata.
  This is the 15-line print's own eighth-of-juz' breakdown — every 8th marker gives that print's
  juz' boundary, every 4th its half-juz', every 2nd its quarter-juz'
- `HALF_BOUNDARIES.waterval` / `.uthmani` — half-juz' boundaries for each print, derived
  2026-07-29 (every 2nd `RUB_BOUNDARIES.waterval` entry / every 4th `.uthmani` entry)
- `QUARTER_BOUNDARIES_UTHMANI` — quarter-juz' boundaries for the 15-line print, derived
  2026-07-29 (every 2nd `RUB_BOUNDARIES.uthmani` entry). The 13-line print's quarter
  boundaries are `RUB_BOUNDARIES.waterval` itself — no separate array needed there
- `SURAH_JUZ_RANGE` / `getSurahJuzRange(surah)` — which juz' each surah touches,
  `[juzStart, juzEnd]`. Derived 2026-07-29 from `JUZ_BOUNDARIES` — verified identical for
  both prints across all 114 surahs (the one ayah-level difference, juz' 4, doesn't change
  which surahs touch which juz'), so one shared table covers both
- `TAJWEED_DEFAULTS` — the default tajweed focus-area tags
- `AYAH_WORD_RANGE` — all 6236 ayahs, `[surah, ayah, first_word_id, last_word_id]`, using the
  universal word-ID scheme confirmed identical across the 15-line Madina and 13-line IndoPak
  page-layout databases
- `LINE13_RANGES` — 10769 real content lines for the 13-line print, `[page, line, first_word_id,
  last_word_id]`. Verified 114/114 against the print's own surah-start markers; a broader
  cross-check against the (fully verified) 15-line data found ~4% of arbitrary page-boundary
  lookups differ by 1-2 ayahs — good enough for approximate line/page counts, not claimed as
  exact as the 15-line mapping
- `getLines13ForAyahRange(surah, ayahFrom, ayahTo)` — returns `{lineCount, pageCount, pages}`
  for the 13-line print, given a canonical ayah range. Approximate by design, per the note above
- `AYAH_LINE_UTHMANI` / `getLines15ForAyahRange(surah, ayahFrom, ayahTo)` — the 15-line print's
  own counterpart, added 2026-07-29. `[surah, ayah, page, startLine, endLine]` per ayah (6236
  rows), sourced from the Quran.com API's own word-level `line_number` field (via the user's
  `Generate_Quran_Mapping.py`) — genuine per-page line positions, not a reconstruction. Verified
  before use: page assignment matches `quranmeta.json`'s independently-sourced page field at all
  6236 ayahs (0 mismatches). Already per-ayah, so unlike the 13-line version this needs no
  word-ID lookup step — matches how `sabaq_log` itself stores a range directly
- `PAGE_MAX_LINE_UTHMANI` — how many lines each of the 604 pages actually uses (not always 15 —
  e.g. page 1 uses only 8), derived from `AYAH_LINE_UTHMANI` itself


Each of these carries a source comment in `shared/data.js` per CONVENTIONS.md
principle 6 — where it came from and that it's been verified, not guessed.
