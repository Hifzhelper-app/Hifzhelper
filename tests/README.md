# Hifz Helper tests

Run from the repository root with Node 24.15+ (24.x) or Node 26+:

```sh
npm ci
npm test
```

The root package is test tooling only. `worker/package.json` remains the separate
Worker deployment package. The locked `jsdom` dependency supports DOM interaction
tests; Node supplies the in-memory SQLite implementation. Tests do not connect to
production/development databases, deploy anything, or run the seed tool.

Run an individual harness with `node tests/verify_context.mjs`, for example.
The runner discovers only top-level `tests/verify_*.mjs` and `.js` files.
`tests/retired/` is deliberately excluded.

## Interpreting results

Every active harness must finish successfully and print exactly one line:

```text
123 passed, 0 failed
```

Failed checks, crashes, missing or duplicate summaries, contradictory failure
output, and timeouts all fail the overall run. Child processes use the same Node
executable as the runner and have a 30-second timeout. The final summary names
unsuccessful harnesses separately from reported check totals, so a crash cannot
be mistaken for “zero failures.” `verify_runner.mjs` exercises these failure modes.

## Coverage and maintenance

Keep a test because it protects current behaviour, not because a release once
added it. Versioned filenames are historical origins, not a requirement to retain
superseded expectations. Update a valid contract when the user changes it; retire
a check only with the reason and replacement coverage documented.

| Area | Principal harnesses |
| --- | --- |
| Account isolation, roles, private notes | `verify_context`, `verify_roles`, `verify_routing`, `verify_notes`, `verify_v3770_account_separation` |
| Log persistence, edits, pool updates | `verify_maktab`, `verify_attendance`, `verify_pool`, `verify_e2` |
| Summary actions, entries, selected date | `verify_e1`, `verify_v3750_phase1`, `verify_v3820_student_summary` |
| Attendance, Haidh limits, predictions and stop evidence | `verify_attendance_derived`, `verify_v3760_phase2`, `verify_v3761_haidh_predictions`, `verify_v3800_attendance_page`, `verify_v42114_ui`, `verify_v4213_attendance_model`, `verify_v4214_haidh_engine` |
| Calendar, settings, registration | `verify_v3870_calendar`, `verify_settings`, `verify_maktab_settings_form`, `verify_v42151_admin_haidh`, `verify_v42156_haidh_settings` |
| Current UI contracts | Relevant `verify_v42*` files; many are source checks, not pixel/layout tests |
| Release/cache identity, parsing | `verify_build_stamp`, `verify_version_stamp`, `verify_syntax` |

For new endpoint fixtures, use `helpers/database.mjs`: it replays all real Worker
migrations (currently through 0030), enables foreign keys after the historical
migration rebuilds, and offers a D1-shaped adapter with atomic batches. Seed
required fields explicitly; do not weaken schema constraints to fit a test.
Seven repaired endpoint harnesses now use this fixture. Older isolated fixtures
remain where their tests pass; migration-specific tests deliberately exercise
historical schema transitions.

The routing scan's reachable-module list still needs maintenance whenever another
module becomes reachable in Maktab context. It is not automatic code coverage.

## Cleanup record — 2026-09-24

- Declared and locked test dependencies; restored DOM tests previously unable to run.
- Archived the completed one-off seed-tool diagnostic in `retired/`.
- Replaced stale endpoint fixtures in Summary, account separation, attendance,
  Haidh calendar/parity and groups/settings tests with migration-backed databases.
- Updated menu, monthly summary, attendance reporting, first-Haidh teacher access,
  and separate Summary action expectations to the agreed V4.2.15.11 behaviour.
- Replaced the obsolete whole-row Summary click tests with driven Name,
  Attendance, entry-peek and unified Log action checks, including date carryover.
- Removed the old five-column/yellow-Haidh Summary styling snapshots; current
  screen-specific tests cover the replacement UI. Removed the brittle count of
  calendar client calls; real own-student/teacher routing tests remain.
- Retired six stale assertions in `verify_v3850_batch`: old Haidh heading layout,
  exact old navigation wiring, two obsolete per-day register-sheet contracts,
  separate mobile action row, and Attendance title above the card. Each removal
  names the current replacement harness beside the retired assertion.
- Hardened the aggregate runner and added nine subprocess failure-mode checks.

Verified with Node 24.18.0: **74 active harnesses, 1,615 checks passed, zero failures
or unsuccessful harnesses**. No application code or migration files changed.

## Quick Log follow-up — V4.2.15.12

`verify_quick_log_session.mjs` adds 18 driven checks for multi-entry sessions,
independent Save/Close, confirmation reset, type switching, duplicate handling,
write versus refresh failures, save locking and replacement-window isolation.
Redundant historical release pins now defer to `verify_build_stamp.mjs`.
Current suite: **75 harnesses, 1,610 checks passed**.

## Device checks before a release

1. On phone and desktop, check Log, Attendance, Name and +N have independent targets.
2. Open each Quick Log type; check selector widths, checkbox alignment, Surah search,
   date changes and Save/Detail behaviour using development test accounts.
3. Check mobile attendance column collapse, horizontal scrolling and sort reset.
4. Check User Management cards, student search and Haidh setup on a narrow screen.
5. Check calendar holiday visibility and native report sharing on a real device.

DOM and source-pattern checks do not establish browser layout or native-share behaviour.
