# Hifzhelper — Data Schema

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

## Table: `entries`

One row per student per day (`UNIQUE(student_id, date)` — saving is an upsert).

| Column | Type | Notes |
|---|---|---|
| `student_id` | TEXT (FK) | → `students.id`. |
| `date` | TEXT | `YYYY-MM-DD`. |
| `sabaq_surah` | INTEGER | Surah number, 1–114. |
| `sabaq_ayah_from` | INTEGER | |
| `sabaq_ayah_to` | INTEGER | |
| `sabaq_lines` | INTEGER | Lines completed. |
| `sabaq_quarter` | INTEGER | 1–4, computed from rub' boundary data (see `shared/data.js`). |
| `sabaq_tajweed` | TEXT | Comma-separated tags, e.g. `Ghunnah,Madd`. |
| `sabaqdhor_zone` | TEXT | Computed juz' list, e.g. `Juz' 29, 30`. Stored for record, not re-derived. |
| `sabaqdhor_tajweed` | TEXT | Comma-separated tags. |
| `sabaqdhor_mistakes` | INTEGER | Optional — may be NULL. |
| `dhor_from` | INTEGER | Segment unit — 1–120 (Waterval quarters) or 1–240 (Uthmani 1/8's), depending on `dhor_ref`. Can span across juz' boundaries. |
| `dhor_to` | INTEGER | Same units as `dhor_from`. |
| `dhor_ref` | TEXT | `waterval` or `uthmani` — which reference `dhor_from`/`dhor_to` are expressed in, recorded per-entry so history displays correctly even if the maktab's setting changes later. |
| `dhor_tajweed` | TEXT | Comma-separated tags. |
| `dhor_mistakes` | INTEGER | |
| `dhor_minutes` | INTEGER | Time is only tracked on dhor, not sabaq/sabaq dhor. |
| `reflection` | TEXT | Tadabbur. |
| `student_comment` | TEXT | Note to teacher. |
| `teacher_feedback` | TEXT | Filled in by the teacher (Phase 2), read-only to the student. |

## Table: `attendance`

Composite primary key `(student_id, date)`.

| Column | Type | Notes |
|---|---|---|
| `student_id` | TEXT (FK) | → `students.id`. |
| `date` | TEXT | `YYYY-MM-DD`. |
| `status` | TEXT | `present` / `absent` / `haidh` / `predicted-haidh`. Auto-set to `present` when any entry is logged that day, unless already `haidh`. |

## Table: `position`

One row per student (`student_id` is the primary key) — current progress
state, updated in place, not appended.

| Column | Type | Notes |
|---|---|---|
| `student_id` | TEXT (PK/FK) | → `students.id`. |
| `position_json` | TEXT | JSON blob: `{ activeJuz, studyOrder: [...], juz: { "30": {...}, ... } }`. Not meant for hand-editing. |
| `last_dhor_json` | TEXT | JSON blob: `{ "<segment-unit>": "<last-revised-date>", ... }` — segment units match whichever reference (waterval/uthmani) is active. |
| `updated_at` | TEXT | ISO timestamp of last write, for debugging/sync purposes. |

---

## Reference data (not in the database — lives in `shared/data.js`)

These don't vary per student or per maktab, so they aren't stored per-maktab
in D1 — they ship as static data with the app instead:

- `SURAHS` — the 114 surah names/numbers
- `JUZ_BOUNDARIES` — standard 30 juz' start points (surah:ayah), print-independent
- `RUB_BOUNDARIES.waterval` — 120 markers, verified from the maktab's own Waterval source file
- `RUB_BOUNDARIES.uthmani` — 240 markers (rub' al-hizb), verified from Quran Foundation metadata
- `TAJWEED_DEFAULTS` — the default tajweed focus-area tags

Each of these carries a source comment in `shared/data.js` per CONVENTIONS.md
principle 6 — where it came from and that it's been verified, not guessed.
