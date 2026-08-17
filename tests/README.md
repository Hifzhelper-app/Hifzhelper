# tests/ — verification harnesses

These drive the **real** application code, not copies of it. That is the
whole point: this project's recurring lesson is that bugs get found by
running actual code through actual scenarios, and get missed by reading
it carefully. Several of the checks in here exist because a plausible
assumption turned out to be wrong.

## Running them

```bash
npm install jsdom          # once per environment; node:sqlite is built in
node tests/run-all.mjs     # every harness, one total
node tests/verify_e2.mjs   # or any single one
```

Requires Node 22+ (for `node:sqlite`). Everything resolves paths
relative to this folder, so the repo can live anywhere.

Two techniques are used throughout:

- **Worker code** runs against a `node:sqlite` in-memory DB shaped by the
  real migration files, with a small stub mirroring D1's
  `prepare().bind().first()/all()/run()` — including the *bindless*
  `prepare().first()` form the worker legitimately uses for
  no-parameter queries.
- **Frontend code** runs in jsdom with the real module `eval`'d and its
  dependencies stubbed, so the assertions are against the shipped
  functions.

## What each one covers

| Harness | Covers |
| --- | --- |
| `verify_routing.mjs` | **The "whose data?" guard.** Classifies every API client by whether the call names a student or lets the auth token decide, then fails on any token-deciding call reachable in maktab mode. See below. |
| `verify_context.mjs` | The log context: PJ mode unchanged, maktab mode swapping to student-scoped clients, and the leakage round trip (maktab → PJ → maktab for a *different* student). |
| `verify_timer.js` | Dhor timer: wake lock lifecycle, lap list, ring sizing. |
| `verify_attendance.mjs` | PJ attendance sync when a log's date is edited or the log deleted. |
| `verify_roles.mjs` | `isTeacherOrAbove` across every gated endpoint, all three roles. |
| `verify_notes.mjs` | The fresh-save note fix and private-by-default. |
| `verify_migration.mjs` | Migration 0019's tables against the PJ tables, built by replaying the real migration history. |
| `verify_maktab.mjs` | The maktab log endpoints: gating, self-recitation, provenance, duplicates, haidh overwrite. |
| `verify_e1.mjs` / `verify_e2.mjs` | Maktab summary and day-view behaviour. |
| `verify_settings.mjs` | Maktab settings: single-row table, the asymmetric gate, validation, caching. |
| `verify_maktabsetup.mjs` | Maktab position store and student setup; the server-side pool/mushaf fix. |
| `verify_attendance_derived.mjs` | Derived maktab attendance: the maktab-day threshold, status precedence, calendar-day haidh propagation, the absence flag. |

## `verify_routing.mjs` deserves its own note

One bug class recurred **five times**: code in maktab mode calling an
endpoint that resolves the student from the auth token, so a teacher
read or wrote *their own* journal while logging someone else. Every
instance was found by hand, after shipping. Two careful manual passes
over the same code missed three sites between them.

So it is mechanical now. It also demonstrates why that matters: **the
first draft of the scan was itself broken** — its function-extraction
regex required a closing brace on its own line, so it silently skipped
every one-line client, including `apiSaveProfile`, one of the exact
sites it exists to catch. It reported 13; the truth was 16. A guard
that reports clean while missing the target is worse than no guard, so
it was checked against a hand count before being trusted.

Two things to know when maintaining it:

- `MAKTAB_REACHABLE` — the list of modules that run in maktab mode — is
  maintained **by hand**. The scan cannot verify it. If a maktab screen
  starts calling a module not on the list, the scan goes quiet about it.
- `JUSTIFIED` holds call sites that look like violations but are
  correct. Every entry carries a reason, and the harness asserts those
  reasons exist. An unexplained entry is how this rots into noise.

It currently **passes at 16 unrouted sites** — it is measuring known
debt, not asserting the debt is gone. Delivery (i) in TODO.md ends by
setting the expected count to 0, after which any new unrouted call
fails the suite.

## Adding to them

When a delivery changes behaviour a harness asserts, **update the
assertion rather than working around it** — a check that no longer
describes the code is worse than no check. Several assertions in here
were deliberately rewritten when (g) and (h) changed what they
described, and each rewrite says why in a comment.
