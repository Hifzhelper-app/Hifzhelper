# Hifzhelper — Changelog

Each entry lists what changed and exactly which files were touched, so a
future delivery only needs those specific files re-uploaded — not the whole
repo. See `SETUP.md` for initial setup, `SCHEMA.md`/`CONVENTIONS.md` for the
standing reference docs (those aren't repeated here unless they change).

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
