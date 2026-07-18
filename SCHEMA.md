# Hifzhelper — Data Schema

One Google Sheet per maktab (max ~100 students each). These are the canonical
tab names and column headers — the Worker and frontend must use these exact
field names (see CONVENTIONS.md, principle 5). If a name needs to change,
change it here first, then everywhere else.

Row 1 of every tab is the header row, exactly as written below.

---

## Tab: `students`

| Column | Type | Notes |
|---|---|---|
| `id` | string | Random code, not sequential (e.g. `K7M2QX`). Used to log in. |
| `name` | string | Display name. |
| `role` | string | `student` or `teacher`. |
| `pin_hash` | string | Set on first login, not at creation. Never store the raw PIN. |
| `created_date` | string | `YYYY-MM-DD`. |
| `active` | string | `yes` / `no`. Disable without deleting history. |
| `failed_attempts` | number | Added in migration 0002, for login rate-limiting. Resets to 0 on success. |
| `locked_until` | string | Added in migration 0002. ISO timestamp; NULL = not locked. |

## Tab: `entries`

One row per student per day.

| Column | Type | Notes |
|---|---|---|
| `student_id` | string | FK → `students.id`. |
| `date` | string | `YYYY-MM-DD`. |
| `sabaq_surah` | number | Surah number, 1–114. |
| `sabaq_ayah_from` | number | |
| `sabaq_ayah_to` | number | |
| `sabaq_lines` | number | Lines completed. |
| `sabaq_quarter` | number | 1–4, computed from rub' boundary data (see `data.js`). |
| `sabaq_tajweed` | string | Comma-separated tags, e.g. `Ghunnah,Madd`. |
| `sabaqdhor_zone` | string | Computed juz' list, e.g. `Juz' 29, 30`. Stored for record, not re-derived. |
| `sabaqdhor_tajweed` | string | Comma-separated tags. |
| `sabaqdhor_mistakes` | number | Optional — may be blank. |
| `dhor_from` | number | Segment unit — 1–120 (Waterval quarters) or 1–240 (Uthmani 1/8's), depending on `dhor_ref`. Can span across juz' boundaries. |
| `dhor_to` | number | Same units as `dhor_from`. |
| `dhor_ref` | string | `waterval` or `uthmani` — which reference `dhor_from`/`dhor_to` are expressed in, recorded per-entry so history displays correctly even if the maktab's setting changes later. |
| `dhor_tajweed` | string | Comma-separated tags. |
| `dhor_mistakes` | number | |
| `dhor_minutes` | number | Time is only tracked on dhor, not sabaq/sabaq dhor. |
| `reflection` | string | Tadabbur. |
| `student_comment` | string | Note to teacher. |
| `teacher_feedback` | string | Filled in by the teacher (Phase 2), read-only to the student. |

## Tab: `attendance`

| Column | Type | Notes |
|---|---|---|
| `student_id` | string | FK → `students.id`. |
| `date` | string | `YYYY-MM-DD`. |
| `status` | string | `present` / `absent` / `haidh` / `predicted-haidh`. Auto-set to `present` when any entry is logged that day, unless already `haidh`. |

## Tab: `position`

One row per student — current progress state, updated in place (not appended).

| Column | Type | Notes |
|---|---|---|
| `student_id` | string | FK → `students.id`. |
| `position_json` | string | JSON blob: `{ activeJuz, studyOrder: [...], juz: { "30": {...}, ... } }`. Not meant for hand-editing. |
| `last_dhor_json` | string | JSON blob: `{ "<half-juz-unit>": "<last-revised-date>", ... }`. |
| `updated_at` | string | ISO timestamp of last write, for debugging/sync purposes. |

---

## Reference data (not in the Sheet — lives in `data.js`)

These don't vary per student or per maktab, so they're not stored per-maktab
in Sheets — they ship as static data with the app:

- `SURAHS` — the 114 surah names/numbers
- `JUZ_BOUNDARIES` — standard 30 juz' start points (surah:ayah), print-independent
- `RUB_BOUNDARIES.waterval` — 120 markers, verified from the maktab's own Waterval source file
- `RUB_BOUNDARIES.uthmani` — 240 markers (rub' al-hizb), verified from Quran Foundation metadata
- `TAJWEED_DEFAULTS` — the default tajweed focus-area tags

Each of these should carry a source comment in `data.js` per CONVENTIONS.md
principle 6 — where it came from and that it's been verified, not guessed.
