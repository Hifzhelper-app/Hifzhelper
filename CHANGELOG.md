# Hifzhelper — Changelog

Each entry lists what changed and exactly which files were touched, so a
future delivery only needs those specific files re-uploaded — not the whole
repo. See `SETUP.md` for initial setup, `SCHEMA.md`/`CONVENTIONS.md` for the
standing reference docs (those aren't repeated here unless they change).

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
