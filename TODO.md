# Hifzhelper — TODO / known issues

Confirmed findings, not yet built (per the standing process rule: document
first, build only once explicitly told to start). Newest first within each
section.

## Done — V3.36.2 (2026-08-06)

- [x] Corrected JUZ_BOUNDARIES (13-line/IndoPak's own Juz' start
  points) -- now genuinely derived from RUB_BOUNDARIES.waterval itself
  (each Juz's own last quarter marker, one ayah past it) rather than a
  separately-sourced file that only agreed with the quarter data at 25
  of 30 points. Not framed as fixing an error -- Juz' divisions are a
  human convenience, not something with one universally correct answer
  the way surah/ayah boundaries themselves are; deriving from the same
  source as the quarters just keeps the model internally consistent.
  Traced full scope first (4 functions in shared/data.js inherit this
  automatically), verified directly at Juz' 7 specifically before
  considering it done.
- [x] Confirmed directly against live code (not recollection):
  V3.36.2's earlier planned scope, adding Maqra to Sabaq Dhor, was
  never actually built -- the conversation branched into the
  Rub'-vs-Maqra terminology correction mid-build and never returned to
  it. Still fully outstanding, tracked below under V3.37.

## Done — V3.36.1 (2026-08-06)

- [x] Fixed a real, confirmed bug: splitting a previously-logged Sabaq
  range into 2 separate entries (or any backfill entry for an
  already-passed range) could silently rewind the stored frontier
  backward, since advancePositionAfterSabaq (js/position.js)
  overwrote position unconditionally with whatever the just-saved
  entry's own frontier was, never comparing against what was already
  there. Now compares before overwriting -- only advances when the
  new frontier is genuinely further along (using SABAQ_STUDY_ORDER for
  a different Juz', the same study-direction comparison already used
  for the same Juz'). Verified against 6 scenarios directly, including
  Juz' 30's own reverse study order in both directions.

## Done — V3.36.0 (2026-08-06)

- [x] Hybrid removed entirely -- traced and confirmed it never actually
  behaved differently from 13line (its ref logic fell through to the
  same waterval branch), so nothing real was lost removing it.
- [x] New 15-line IndoPak mushaf built, replacing Hybrid as the 3rd
  option. Uses its own verified page/line dataset for Sabaq's Lines/
  Pages, independently confirmed against the Quran's real ayah count,
  zero duplicates, all 604 pages present, and all 604 page boundaries
  cross-checked exactly against the already-verified Madina data.
- [x] New picker for IndoPak's Dhor/Sabaq Dhor terminology (Quarter/
  Half vs Maqra/Rub'/Hizb), selectable now even though the real
  Maqra/Rub'/Hizb display system is V3.37's work -- borrows Madani's
  existing boundary data in the meantime.
- [x] Sabaq's Lines/Pages routing (pageRefForMushaf) and Dhor/Sabaq
  Dhor's terminology routing (refForMushaf, 4 duplicated copies)
  kept deliberately separate -- verified end to end they resolve
  independently for every mushaf/terminology combination.
- [x] New indopak_terminology database column (migration 0016).

## Done — V3.35.2 (2026-08-05)

- [x] Fixed a real, long-standing bug found by the user: editing any of
  the 3 cards could land on the Timer instead, regardless of how
  editing was triggered. Root cause: #dhorTimerHost was never a
  .log-detail-card (a separate custom element, targeted by its own id
  everywhere else), so the "hide every card except the one being
  edited" rule genuinely never reached it -- the Timer stayed visible
  throughout editing, leaving 2 elements visible in the rail instead of
  the intended 1. Fixed by extending that same rule to explicitly cover
  #dhorTimerHost too.

## Done — V3.35.1 (2026-08-05)

- [x] Sabaq's Lines/Pages recompute when "Confirm selection" is
  checked -- the existing auto-calc only ever fired from the "To" ayah
  field's own change event, missing the stepper/surah-picker/"From"
  field entirely.
- [x] Journal's "+N" badge is now a real popup trigger (button, not a
  passive span), listing every entry for that date/type, each
  individually editable -- previously only the most recent was
  reachable.
- [x] Journal's hold-to-edit removed entirely, replaced with a plain
  click everywhere (touch and mouse alike) -- fixes touch-action:none
  blocking the browser's own scroll-vs-tap disambiguation, which could
  make an ordinary slow scroll accidentally trigger a navigation.
- [x] .log-detail-card and #dhorTimerHost height fixed at its actual
  root -- replaced a flat, hardcoded 70vh/75vh (which left substantial
  empty space below every card and stranded edit-mode's bottom
  controls) with 2 calculated standards, confirmed as a pattern to
  reuse going forward: "normal" (auth band + dots row subtracted) and
  "no dots row present" (auth band only) -- applies to .editing-active,
  desktop's grid layout, AND #dhorTimerHost, all 3 of which genuinely
  have no dots row to subtract for.

## Done — V3.35.0 (2026-08-05)

- [x] Journal page rebuilt entirely -- js/journal.js hadn't been touched
  since its very first version and was reading fields that stopped
  existing since the verse-ref rework (Sabaq column was silently always
  blank). New version reads the same real data History already does,
  drops the old quick-add modal (didn't match any card's real fields),
  editing now opens the real card via the same EDIT_HANDLERS entry
  point History's own edit button uses.
- [x] Trimmed shorthand per type, latest-date-first, 10 days expanded
  then weekly (rolling 7-day) rollups showing just the date range,
  Load More extending further back. Tested the bucketing algorithm
  directly against a realistic scattered-date set with gaps.
- [x] Click (mouse/trackpad, via hover+pointer media query, not screen
  width) or press-and-hold (touch) opens an entry for editing; same on
  the date cell but opens the detail screen for that date instead.
- [x] Fixed the real "all 3 columns go to Sabaq" bug found while
  testing this -- exitEditScreenMode was unconditionally restoring
  scroll position on every fresh screen-open (not just genuine edit
  exits), so 3 cards' own reset calls were racing and overriding
  whatever a column tap was actually trying to scroll to. Now only
  restores when actually exiting edit mode.
- [x] Nav: 3 placeholder items (Sabaq/Sabaq Dhor/Dhor) removed, one new
  "Detail" entry added with the user-supplied icon.
- [x] Header no longer position:sticky -- sits fixed above a bounded,
  independently-scrolling rows region instead (closer to a frozen
  spreadsheet header). Made a precise 20% taller (36px vs 30px).

## Done — V3.34.13 (2026-08-05)

- [x] Both "Confirm selection" checkboxes repositioned higher on their
  cards -- Sabaq's under Sabaq History (before "Sabaq from"), Dhor's
  under the portion selector (before Juz), both left-aligned with the
  rest of each card's content. Pure markup move, no logic changes.

## Done — V3.34.12 (2026-08-05)

- [x] Fixed the pill-stretches-when-dragged bug the user found -- .mini's
  own width:100% resolves against the full viewport once switched to
  position:fixed (was resolving against its constrained flex space
  before), and on a phone narrower than the 420px cap, that cap never
  gets a chance to catch it. Fixed by locking in the pill's own already-
  correct width before the drag switches its positioning mode.
- [x] New "Confirm selection" checkbox on both Sabaq and Dhor --
  hard-blocks Save until checked (same pattern as Sabaq Dhor's own
  checkboxes), clears immediately after every successful save, replaces
  the earlier "nothing entered" confirm() entirely on both cards.
  Applies to edits as well as new entries on both cards now (the
  earlier check on Dhor specifically only applied to new entries).

## Done — V3.34.11 (2026-08-05)

- [x] Drag now triggered by a dedicated handle (small move icon,
  leftmost in the pill's top row) instead of press-and-hold anywhere --
  the hold approach was leaking through to the device's own native
  long-press gesture (text selection/context menu) on whatever was
  underneath the pill, since pointer-events doesn't block that
  lower-level, OS-adjacent behavior. Touching the handle starts the
  drag immediately, no hold duration, no gesture-competition window.
  All hold-timing/cancel-threshold logic removed entirely. Underlying
  drag mechanics (on-screen clamping, session-only position memory)
  unchanged from V3.34.10 -- only the trigger changed.

## Done — V3.34.10 (2026-08-05)

- [x] Mini pill is genuinely draggable now -- scope changed in chat
  from "fix its fixed position" to "move it wherever you want."
  Press-and-hold (450ms, 8px cancel threshold) anywhere on the pill
  starts a drag; a plain tap still reaches the buttons underneath
  normally, and the trailing click after a drag ends is suppressed so
  releasing near a button never also triggers it.
- [x] Default starting position moved from bottom to top of the screen.
- [x] Position remembered for the current session only (plain instance
  field, not persisted) -- resets to top-center on reload, but holds
  across minimise/maximise cycles within the same session.
- [x] Constrained to stay fully on-screen, both live during the drag
  and re-clamped on resize/rotation afterward. Tested the exact
  clamping formula directly against normal, past-edge, negative, and
  viewport-shrink cases.
- [ ] Genuinely real pointer-drag interaction (hold-timing, threshold-
  cancel, live tracking) can't be fully exercised without a real
  touchscreen/mouse session -- worth a careful pass on an actual device
  rather than trusting the code read-through alone.

## Done — V3.34.9 (2026-08-05)

- [x] Mini pill's positioning fixed at its actual root, replacing
  V3.34.8's window.visualViewport workaround entirely. Prompted by the
  user asking why History/Plan Dhor's own modals never hit this bug --
  answer: .modal-overlay never anchors via bottom: at all, it's
  inset:0 + flexbox (align-items:flex-end), sidestepping the single-
  edge bottom: calculation iOS Safari's bug actually affects. Applied
  the same technique to the pill: full-viewport, invisible positioning
  wrapper + pointer-events:none (re-enabled on the pill's own .mini
  div), flexbox pushing it to the bottom. No JS, no visualViewport, no
  MutationObserver -- all removed. Confirmed: modals (z-index:300) now
  cover the pill (z-index:250) while open, same underlying shape as
  each other -- timer keeps running underneath, unaffected, pill
  reappears correctly once the modal closes.

## Done — V3.34.8 (2026-08-04)

- [x] Full view resized against a 390x844 (6.1") target -- ring was a
  fixed 300px regardless of available height (the real clipping cause),
  now min(210px, 25vh); round controls 96px -> 72px; padding trimmed
  throughout. Worked the numbers out directly (543px available content
  space, ~453px used, ~90px margin), not eyeballed.
- [x] Mini pill repositioned around a real, currently-open iOS Safari
  bug (Apple's own developer forums document position:fixed content
  clipping near the bottom edge on iOS 26 specifically) -- researched
  this rather than assuming a CSS tweak would hold. Real fix uses
  window.visualViewport to track the actual visible area; CSS
  bottom-anchoring remains the fallback for anything without that API.
  Tested the repositioning math directly against a shrunk viewport
  height and a scrolled offset, and confirmed it cleans up its own
  inline styles when not minimised.
- [x] Confirmed with user: "floating" means fixed-position overlay, not
  draggable -- no change needed, matches what's already built.

## Done — V3.34.7 (2026-08-04)

- [x] Fixed the actual root cause of the missing Timer card, reported
  across several rounds: renderDhorScreen still had a leftover
  if(timerHost.elapsed === 0) classList.add('hidden') line from before
  V3.34.5 (when the timer needed to hide by default). Since it's a
  permanent rail card now, and this function runs on every screen open,
  it was re-hiding the timer immediately every single time -- explaining
  why the source, deployed scripts, and zip all checked out clean while
  the live behavior was still wrong. Only a live DOM inspection caught
  it. Removed, swept for anything similar, found nothing else.

## Done — V3.34.6 (2026-08-04)

- [x] Fixed: editing Sabaq Dhor/Dhor from History returned to the Sabaq
  card afterward. Root cause: editing collapses the rail's scrollable
  width to just the one card being edited, so scroll position is
  effectively 0 throughout -- once the other cards reappear, that stale
  0 points at Sabaq regardless of which card was actually edited.
  exitEditScreenMode now explicitly restores the correct position.
- [x] Duration split into 2 plain number fields (Minutes/Seconds)
  instead of 1 text field holding "mm:ss" -- native numeric keypad
  works cleanly for both now. 2 digits in Minutes auto-advances to
  Seconds; leaving Minutes with 1 digit defaults Seconds to 00 on blur
  (covers iOS checkmark, Android Next, and manual tap-away, all the
  same underlying signal). Tested the actual helpers and the exact
  typing sequences directly, not just described.

## Done — V3.34.5 (2026-08-04)

- [x] Tadabbur moved out of the rail into its own standalone nav
  destination (reused the existing but never-built 'reflections' nav
  item, relabeled to "Tadabbur"). js/reflectionCard.js needed no logic
  changes at all.
- [x] Timer is now the rail's permanent 4th card, sharing its own dot
  indicator, positioned the same way as Sabaq/Sabaq Dhor/Dhor rather
  than an on-demand overlay. Stopwatch/Maximise now scroll the rail to
  it instead of toggling visibility.
- [x] Close no longer hides anything -- nothing left to hide now that
  it's a permanent card.
- [x] Minimise/maximise confirmed unchanged in spirit -- the mini pill
  is still a genuine floating element independent of the rail.
- [x] Found and fixed a real sizing risk: the component's own
  min-height:640px could have overflowed its new 70-75vh rail-card
  allotment on a shorter screen. Removed, added overflow:auto as a
  safety net.

## Done — V3.34.4 (2026-08-04)

- [x] Maximise icon moved into the pill's top row, rightmost of 4.
- [x] Second row reordered: toggle-left, elapsed time-center, Lap-right.
- [x] White dot per recorded lap under the Lap button -- tested the
  rendering logic directly (0 laps = no dots, 3 laps = exactly 3).
- [x] Full-screen timer now respects the device's own safe-area insets
  instead of claiming the literal 100% viewport -- the actual fix for
  controls overlapping mobile status bar/home indicator.

## Done — V3.34.3 (2026-08-04)

- [x] Sabaq Dhor's checkboxes never cleared after a save (found by the
  user before this delivery went out) -- made an accidental duplicate
  save possible by tapping Save twice. Fixed by reusing
  renderSabaqDhorScreen's own fresh-open logic, same pattern as the
  Dhor fix below.
- [x] After every Dhor save, the card clears and repopulates with the
  next queue item immediately (reuses renderDhorScreen directly).
- [x] "Nothing entered" confirmation for new Dhor and Sabaq entries --
  not a comparison against the last entry (confirmed with the user this
  wouldn't actually catch it, since Dhor's segment always legitimately
  differs as the queue advances), but whether Duration/Lines-Pages,
  Mistakes, tajweed, and Notes are all still at their defaults. Tested
  directly against a blank form and each field individually. Sabaq Dhor
  doesn't need this -- it already hard-blocks with nothing checked.
- [x] Sabaq's From and To now prepopulate with the same starting ayah,
  not one field left blank/dashed.

## Done — V3.34.2 (2026-08-04)

- [x] Close now stops and fully discards (was minimise); Reset now also
  stops the clock, not just zeros it (a real change to the supplied
  component's own reset(), verified the _running=false line is actually
  present). Minimise is its own new dedicated icon since the pill's
  body is no longer a single tap-to-expand surface.
- [x] "Save" renamed "Note Time", re-iconed with the user-supplied
  clipboard-clock SVG. Confirmation dialog added, every tap, both views.
- [x] Mini pill rebuilt entirely: Close/Reset/Note Time icons above,
  elapsed time + Lap + Pause/Restart + Maximise in one row below.
- [x] New lap-times rollup on the Dhor card next to the Timer button --
  visible until the entry is actually saved, then clears (History takes
  over). Tested against both the empty and populated cases directly.
- [x] Full-view timer now capped to --width-tablet/--width-desktop at
  the same breakpoints every other single-screen element in the app
  already uses -- the real fix for the earlier full-screen complaint
  (separate from the missing-deployed-file bug that caused the blank
  full-screen symptom reported at the time).

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

## V3.37 — Madani's own real terminology (confirmed spec, not yet built)

- Madani's Dhor switch relabeled Rub'/Hizb/Juz' (was Quarter/Half/Full)
  -- a real relabel, not cosmetic, since Rub' and quarter are genuinely
  different boundaries (quarter is 4 per Juz'; Rub' al-Hizb/Maqra, the
  data already in the file mislabeled as RUB_BOUNDARIES, is 8 per Juz').
- Full hierarchy, all derivable from that one existing 240-entry
  dataset (verified consistent with the existing Hizb data already in
  the file, zero mismatches): Maqra (1/8, 8 per Juz') -> Rub' (1/4,
  every 2nd Maqra) -> Hizb (1/2, every 4th Maqra) -> Juz' (1).
- Sabaq Dhor gains the Maqra level underneath Rub'/Hizb -- Maqra is
  Sabaq Dhor-only, Dhor itself stays at Rub'/Hizb/Juz'.
- Display: Hizb shown as a standalone global number (1-60), no Juz'
  prefix. Rub' shown per-Juz', matching the existing quarter
  convention exactly (e.g. "Juz 4 R2").
- This same terminology becomes IndoPak's Maqra/Rub'/Hizb picker
  option (V3.36) actually working as intended, not the placeholder-
  via-borrowed-Uthmani-boundaries state V3.36 shipped it in.

## Flagged, not yet resolved

- Found while diagnosing V3.36.1, confirmed real but separate from that
  fix and not yet built: Journal's edit popup (js/journal.js,
  openEntryForEdit) calls EDIT_HANDLERS[type](entry) with only the
  entry itself. The Sabaq card's own History list correctly determines
  whether an entry is the current frontier before opening it for
  editing (EDIT_HANDLERS[type](row, row === rows[0]), js/dhorPage.js)
  -- Journal never makes that determination, so sabaqEditingIsFrontier
  is always false for anything edited through Journal specifically,
  regardless of whether that entry genuinely is the frontier. Confirmed
  NOT what caused V3.36.1's bug (user edited through the card's own
  History), but still a real inconsistency worth fixing on its own --
  editing the actual most-recent Sabaq entry through Journal currently
  skips the position-advance it should get.

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
