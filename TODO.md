# Hifzhelper — TODO / known issues

Confirmed findings, not yet built (per the standing process rule: document
first, build only once explicitly told to start). Newest first within each
section.

## Done — V3.34.1 (2026-08-04)

- [x] Timer's target now reads the student's own configured
  target_minutes_per_juz (Setup's "Minutes / juz'" field) instead of a
  hardcoded 40 -- verified the scaling logic against both the default
  and a custom value. Confirmed: the mini pill persisting across every
  screen, not just the Dhor card, is the intended behavior ("if it's
  running it should be visible everywhere") -- no code change needed,
  it already worked this way.

## Done — V3.34.0 (2026-08-04)

- [x] Old timer.js removed entirely, replaced with the user-supplied
  session-timer.js (adapted with Start Dhor/Stop Dhor labels beneath
  the round buttons). Now a persistent overlay (full-screen when
  active, floating pill when minimised via Close) instead of an inline
  panel re-created every screen-open -- an active session now survives
  navigation between tabs rather than resetting.
- [x] Save wired into the existing duration_seconds/lap_times fields
  (already fully wired end to end on the backend) -- just a new data
  source, not a new pipeline. Verified the ms-to-seconds conversion for
  both the total and individual laps directly.
- [x] Laps now display in History -- confirmed this never existed
  before (lap_times was saved but never shown anywhere).
- [ ] Item 5, still deferred (not tied to a specific version yet):
  minimised pill currently only supports tap-to-expand (the component's
  own native mini mode) -- adding dedicated lap/pause-stop buttons
  directly on the pill itself requires editing the supplied component's
  internal mini markup, deliberately held back as a separate, more
  invasive round. (The timer's target-minutes link, also originally
  flagged here, is resolved -- see V3.34.1 above.)

## Done — V3.33.0 (2026-08-04)

- [x] Vertical compression genuinely fixed this time -- root cause was a
  flex-shrink gotcha, not text centering or label length. The modal's
  title row, switch, and Select All button were all shrinking by
  default to make room whenever the content list below overflowed the
  85vh cap, worse the longer the list (View All's 30 rows vs Dhor
  Plan's handful) and worse the shorter the viewport. flex-shrink:0
  added to all 3; only the list (which already had its own scroll
  behavior) absorbs overflow now. Found via the user's own DevTools
  experiment isolating viewport height as the real variable.

## Done — V3.32.0 (2026-08-04)

- [x] Rollup labels now match the actual batch granularity (H1/H2 for
  halves, not always Q1/Q4) via describeDhorSegment, simplifying to
  plain "Juz X to Juz Y" only for a genuine whole-juz span. Verified
  against both cases plus a single-juz case.
- [x] Pill-tracking bug fixed -- the switch's own visual state was only
  computed once at modal-open time, never re-run on tab change.
- [x] "View All Completed" removed entirely; the 2 now-single-branch
  ternaries simplified, an unreachable dead branch removed.
- [x] Vertical compression fixed at the root -- .switch-option (shared by
  every switch in the app) now has proper flex centering, not resolved
  incidentally by having fewer/shorter labels.

## Done — V3.31.0 (2026-08-04)

- [x] Date display bug fixed at its root — every page sets its date
  field with a plain `.value = todayISO()` assignment, which never fires
  a `change` event (unavoidable DOM behavior). The display now overrides
  the input's own `value` property so any assignment, from anywhere,
  triggers a re-render. Verified against a fake `HTMLInputElement` with
  a real prototype-level `value` getter/setter, not just a plain object.
- [x] One shared row-height variable (`--dhor-row2-h`, 44px) for every
  card instead of 3 separate values that happened to coincide — Row 2,
  Juz, Position, Duration, Timer, and Sabaq/Sabaq Dhor's date row all
  reference the same one now.
- [x] Dhor's date field now sizes to its own content (grid changed from
  a fixed 40/30/30 to auto/1fr/1fr), matching Sabaq/Sabaq Dhor exactly —
  resolves the width question from V3.30.0 by making "content-sized"
  the system-wide rule rather than picking one specific percentage.
  Plan/History gained room as a result.
- [x] Margin added above the Amount switch row so it stops touching
  Row 2 directly above it.

## Done — V3.30.0 (2026-08-03)

- [x] Row 3 (Amount switch) — root cause found and fixed: `#dhorAmountRow`
  had a stray `class="card-date-row"` (belongs to a different, unrelated
  layout) forcing it into an auto-sized grid column, which is why the
  V3.28.0 width fix never actually took effect. Class removed.
- [x] Row 2 (History button touching the edge on mobile) — grid columns
  now have `min-width: 0`, so a child can't refuse to shrink below its
  own content and push past its assigned column.
- [x] Juz/Position height mismatch — both now share one explicit height
  instead of the switch having one (42px) and the select having none.
- [x] Timer/Duration alignment — an invisible label spacer above the
  Timer button now mirrors Duration's real label, so both share an
  explicit height and their bottom edges line up exactly. Icon enlarged
  22px → 28px. Also found and consolidated a genuine duplicate
  `#dhorStopwatchToggle` CSS rule from earlier rounds.
- [x] Custom date display (all 3 date fields) — native `<input
  type="date">` elements now show a consistent "DDD dd-MMM" format via
  a new visible overlay (`js/customDate.js`), while the same native
  picker still opens underneath and the input's own id/value/change
  behavior is completely unchanged. Verified via a fake-DOM test:
  wrap/hide/display sequence, exact formatted output, live re-render on
  a simulated picker change, and idempotency (no double-wrap on a
  second call).
- [x] Plan Dhor's "View All Completed"/"View All" now default to
  rolled-up Juz instead of quarters, in all 4 places that read this.

## Done — V3.29.0 (2026-08-03)

- [x] Pool updates moved from Plan Dhor's Save to the Dhor card's own
  Save — "execution of the plan happens on the card, not in the plan."
  The pool now only ever grows at the moment something is genuinely
  logged, from either a Plan-Dhor-populated entry or a fully manual one.
  This also resolves the earlier "manual Save doesn't expand the pool"
  item below — both paths now behave identically.
- [x] Dhor Plan's tap-first/tap-last range-select rebuilt to range by
  position in the rendered queue list, not by quarter-unit value —
  fixes the wraparound issue from V3.28.0. Verified against a simulated
  wrapped queue: tapping two rows adjacent in the queue but numerically
  distant selects exactly those rows, nothing sitting numerically
  between them. Also resolves the "exclude non-pool units" request as a
  side effect — nothing rendered in this tab can hold a non-pool unit in
  the first place, so no separate filtering was needed.

## Done — V3.28.0 (2026-08-03)

- [x] Raw-range Save's `.quarter`/`.quarterIndex` NaN bug — fixed.
  Data audit complete: queried `dhor_log` for any row with a non-integer,
  non-positive, or reversed `segment_from`/`segment_to` — zero matches.
  Since the bug could only ever produce `NaN`, this means saving while it
  was live most likely failed outright rather than writing bad data. No
  repair needed; existing history is unaffected.
- [x] `isCleanSingleUnit`'s identical bug — fixed and verified.
- [x] `quarterUnitToJuzQuarter` (`shared/data.js`) hardened with a
  `Proxy` — verified it throws on the wrong property and still works
  normally for `juz`/`quarterIndex`.
- [x] `apiPlans.create`/`.update`/`.remove` removed — frontend wrappers,
  the 3 backend handlers, and their routes. `GET /plans` untouched.
- [x] Row 2/3/4/5/7 Dhor card UI fixes.
- [x] Dhor Plan's rows use tap-first/tap-last range-select instead of
  independent checkboxes (see V3.29.0 above for the wraparound follow-up
  fix).
- [x] Expand/collapse `Set` string/number mismatch — fixed.

## Flagged, not yet resolved

- [ ] Phase C's "has Setup configured, but no dhor_log yet" case
  (`computeUpcomingDhorQueue`, `worker/src/dhorSchedule.js`) reuses the
  same pool-start logic as "no Setup, no history" — Claude's own
  extrapolation, since chat didn't address that exact combination.
  Worth confirming it's the intended behavior.
- [ ] computeDefaultDhorEntry checks pool-emptiness before ever querying
  dhor_log, so a student with an empty Setup pool but real Dhor history
  never gets a chance at continue-from-last (predates the pure-queue
  rebuild). Low stakes: if the pool is genuinely empty, continue-from-
  last couldn't build anything from it anyway, so the functional result
  is likely the same either way — mostly a tidiness/ordering question.

## Parked — attendance (2026-08-03)

- [ ] `apiGetAttendance`/`apiSetAttendance`/`apiDeleteAttendance` have no
  UI entry point anywhere (only `apiPredictHaidh` is wired up). Left
  alone per instruction — decide later whether to build the manual
  marking/viewing UI this implies, or remove the unused layer.
