# Hifzhelper — TODO / known issues

Confirmed findings, not yet built (per the standing process rule: document
first, build only once explicitly told to start). Newest first within each
section.

## Done — V3.28.0 (2026-08-03)

- [x] Raw-range Save's `.quarter`/`.quarterIndex` NaN bug — fixed.
  **Still needs a decision, not yet made**: whether to audit/repair
  existing `dhor_log` rows saved before this fix, which may have `NaN`
  (or a stringified `"NaN"`, depending on how D1 stored it) in
  `segment_from`/`segment_to`.
- [x] `isCleanSingleUnit`'s identical bug — fixed and verified (Juz2 H2,
  a full juz, and a single quarter all now resolve without `NaN`).
- [x] `quarterUnitToJuzQuarter` (`shared/data.js`) hardened with a
  `Proxy` — any future `.quarter` access throws immediately instead of
  silently returning `undefined`. Verified it throws on the wrong
  property and still works normally for `juz`/`quarterIndex`.
- [x] `apiPlans.create`/`.update`/`.remove` removed — frontend wrappers,
  the 3 backend handlers, and their routes are all gone. `GET /plans`
  (the one real caller, via `journal.js`) is untouched.
- [x] Row 2/3/4/5/7 UI fixes — button labels shortened, Amount switch
  now a percentage width, banner text deleted, "Starting at" label
  removed (with an invisible spacer keeping Juz/Position aligned), Timer
  vertically centered.
- [x] Dhor Plan's rows now use the same tap-first/tap-last range-select
  as "View All Completed"/"View All", instead of independent checkboxes.
  **One known limitation, not solved**: the range is still computed as
  "every quarter-unit number between the two taps" — correct for the
  other 2 tabs (a plain ascending Juz' grid), but Dhor Plan's rows follow
  queue order, which wraps around near the end of the pool. Tapping two
  rows on either side of a wrap point could select a wider range than
  intended. Not fixed this round.
- [x] Expand/collapse bug (string/number `Set` mismatch) — fixed and
  verified against the real code (collapsed/expanded/single-item cases).

## Flagged, not yet resolved

- [ ] Phase C's "has Setup configured, but no dhor_log yet" case
  (`computeUpcomingDhorQueue`, `worker/src/dhorSchedule.js`) reuses the
  same pool-start logic as "no Setup, no history" — Claude's own
  extrapolation, since chat didn't address that exact combination.
  Worth confirming it's the intended behavior.
- [ ] computeDefaultDhorEntry checks pool-emptiness before ever querying
  dhor_log, so a student with an empty Setup pool but real Dhor history
  never gets a chance at continue-from-last (predates the pure-queue
  rebuild).
- [ ] Only Plan Dhor's own save path adds a newly-logged segment to
  baseline_selection — the manual picker's Save does not, breaking
  "logging builds history" for that path specifically (predates the
  pure-queue rebuild).

## Parked — attendance (2026-08-03)

- [ ] `apiGetAttendance`/`apiSetAttendance`/`apiDeleteAttendance` have no
  UI entry point anywhere (only `apiPredictHaidh` is wired up). Left
  alone per instruction — decide later whether to build the manual
  marking/viewing UI this implies, or remove the unused layer.
