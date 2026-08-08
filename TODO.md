# Hifzhelper — TODO / known issues

Confirmed findings, not yet built (per the standing process rule: document
first, build only once explicitly told to start). Newest first within each
section.

## Done — V3.40.5 (2026-08-08)

- [x] Haidh calendar screen (`#screen-haidhDetail`) now capped at the
  standard 30%/50% width rule on larger screens
  (`--width-tablet`/`--width-desktop`), matching
  `#screen-settings`/`#screen-admin`/`.login-card` — it had simply never
  been given the cap before, unrelated to Juz Tracker's own deliberate
  full-width exemption.
- [x] Confirm bar's buttons now carry icons alongside their text — a
  `save` icon on the confirm/predict button (same icon Settings' own
  Haidh save button already uses, for visual consistency) and a `close`
  icon on Cancel (same icon the Dhor timer already uses for a
  discard/cancel action). Both dynamic-text and static-text buttons
  updated (`innerHTML` instead of `textContent`).
- [x] Cross-month range selection: confirmed via code trace, not a new
  build — `haidhRangeStart`/`haidhRangeEnd` and every function that
  reads them were already plain date strings never scoped to the
  currently-viewed month, so tapping a day, navigating via prev/next,
  and tapping a day in a different month already produced a valid
  range. Documented with a comment so a future change doesn't
  accidentally scope it to the current view.

## Done — V3.40.4 (2026-08-08)

- [x] Haidh calendar marking model simplified from the automatic
  per-date future-vs-past split to a 2-state toggle, confirmed in chat:
  a new range gets ONE uniform status for the whole thing, decided
  once — "confirmed" (`haidh`) if it touches today or the past, even
  via an adjacent existing mark (`evaluateHaidhRange`'s own `runStart`
  extension, now exposed for this); "predicted" (`predicted-haidh`) if
  it's entirely future with no such connection. No more "today
  confirmed, the rest of the range predicted" for a period that starts
  today. Tapping an already-marked day still just clears it directly
  (unchanged) — that's already the correct 2-state toggle for an
  individual day, nothing needed changing there.
- [x] Confirm bar's button now says which action it's about to take —
  "Confirm as haidh" or "Predict as haidh" — computed client-side via a
  new `haidhRangeTouchesPastOrToday()` that mirrors the server's own
  `runStart` logic, rather than a generic "Mark as haidh" label.
- [x] Rejection messages (both the duration-cap and gap-rule errors, in
  both `handleMarkHaidhRange` and `handleSetAttendance` for
  consistency) now end with "Please revise your history." rather than
  just stating which rule failed.
- [x] Verified the new status-decision logic directly (not just read)
  against 5 scenarios: plain future range, range including today, range
  fully in the past, a future range that connects to an existing run
  touching today (correctly becomes confirmed), and a future range
  adjacent to a future-only existing run (correctly stays predicted,
  not wrongly confirmed just for being adjacent to anything).

## Flagged — Phase 2/Maktab: shared timezone (2026-08-08)

- [ ] Future-proofing note, NOT current-phase work (Phase 2/Maktab
  hasn't started — see profile): once there's a maktab with students
  across different timezones, everyone needs to operate on ONE shared,
  canonical timezone (attendance/haidh/journal date boundaries, etc.),
  rather than each device's own local timezone — otherwise "today"
  means a different calendar day for different users, plus the exact
  class of bug just diagnosed below becomes structural rather than a
  one-off. Raised in chat right after debugging the timezone date-shift
  bug, deliberately kept separate from that fix (the fix itself stays
  device-timezone-agnostic and correct either way).
- [ ] Open design questions for whenever this is picked up: is the
  canonical timezone fixed or configurable per maktab; where a
  teacher/admin would set it (Maktab phase doesn't exist yet); whether
  the UI should still DISPLAY times in each user's own local time for
  readability while storing/calculating against the shared one, or show
  the maktab's timezone everywhere regardless of viewer location.


## Done — V3.40.3 (2026-08-08)

- [x] Haidh calendar display bug: TRUE root cause was
  `js/haidhDetailScreen.js`'s `loadHaidhCalAttendance` destructuring
  `const { data } = await apiGetAttendance()` — but `apiGetAttendance()`
  already resolves directly to the array (`worker/src/index.js`'s
  `respond()` always unwraps to `result.data` before sending), so
  `data` was always `undefined` and `haidhCalAttendance` was *always*
  empty regardless of any date. Fixed: `const data = await
  apiGetAttendance();`. Confirmed via live console debugging (not
  inference) that this was the actual cause, not the timezone bug below
  — the timezone bug was real but entirely masked by this one.
- [x] Timezone date-shift bug, same file: `renderHaidhCalGrid`'s 3
  cell-building loops computed each date via `new Date(y,m,d)
  .toISOString().slice(0,10)`, which silently shifts the date backward
  a day for any positive-UTC-offset timezone (device confirmed South
  African Standard Time, UTC+2). Fixed with a new `haidhLocalISO()`
  helper that reads the constructed Date's own local
  getFullYear()/getMonth()/getDate() back out directly, never routing
  through UTC — correct for any timezone. `haidhTodayISO()` and
  `shared/haidhRules.js`'s `haidhAddDaysISO` (uses `Date.UTC()`) were
  never affected.
- [x] Range-validation adjacency bug: `evaluateHaidhRange`
  (`shared/haidhRules.js`) rewritten to evaluate a proposed range as
  ONE unit (extend the run outward from the range's own edges using
  only true external existing dates, gap-check only if neither edge
  touches one) instead of per-date incremental steps — the old version
  wrongly rejected a range directly adjacent to an existing
  haidh/predicted-haidh block with "15 days have not passed", since the
  first date checked hadn't "seen" the rest of its own range yet. Also
  naturally fixes the separate "marking should override predicted"
  note, since the write side already did the right thing — the
  validation bug was the only thing blocking it. Caller
  (`handleMarkHaidhRange`, `worker/src/attendance.js`) updated for the
  function's new single-verdict return shape.
  `evaluateHaidhMark`/`handleSetAttendance` (single-day path) untouched
  and still correct. Re-verified all 3 fixes together against the
  actual edited files before delivery (12/12 range scenarios, timezone
  helper re-tested in SAST).
- [x] `js/juzTrackerScreen.js` (found missing from the live deploy last
  session) included again in this delivery, so one upload covers
  everything outstanding.

## Flagged — Settings Haidh heading tweaks (2026-08-08)

- [ ] Checkbox next to "Haaidha": make it 2x its current size, and move
  it from the LEFT of the heading text (where V3.40.1 put it) to the
  RIGHT of it instead — heading text first, checkbox immediately after.
  User's message cut off after "...to" — worth confirming there wasn't
  more to this before building.
- [ ] Remove the "Ruling" label entirely (`.haidh-ruling-label` above
  the Hanafi/Shafi'i switch, added in V3.40.1) — just the switch itself,
  no text label above it.

## Done — V3.40.2 (2026-08-08)

- [x] Haidh calendar range-select built: tap-first/tap-last, no separate
  mode button. Tap 1 = pending start, tap 2 = pending end (same day
  twice = 1-day range), highlighted live (`.haidh-cal-day-selecting`, a
  3rd color distinct from confirmed/planned). Nothing is written until
  the new confirm bar's "Mark N days as haidh" is pressed; "Cancel"
  clears the pending selection. Tapping an already-confirmed day
  outside of an active selection still clears just that one day
  directly, unchanged.
- [x] No minimum range length enforced (corrected by user mid-spec —
  only the existing max-duration/gap caps apply, not a floor).
- [x] New `POST /attendance/mark-range` (`worker/src/attendance.js`)
  validates the WHOLE proposed span before writing anything — existing
  dates outside the range are fetched, then every date inside the range
  is evaluated in order via the new `evaluateHaidhRange`
  (`shared/haidhRules.js`, reuses `evaluateHaidhMark`'s exact per-date
  run/gap math rather than duplicating it) against the student's
  ruling. Any single date failing rejects the whole batch — nothing is
  written. A valid range writes via one atomic `env.DB.batch()` call.
  Verified directly (not just read) against 9 scenarios: plain ranges,
  exactly-at-cap, over-cap, a range that only exceeds the cap once
  merged with an adjacent existing run, gap violations and gap-OK cases,
  both rulings.
- [x] `apiSetAttendance` (`js/api.js`) removed — its only caller (the
  old single-tap immediate-mark path) no longer exists, replaced by
  `apiMarkHaidhRange`. Backend `handleSetAttendance`/its route left
  untouched — that's the separately PARKED "attendance" decision below,
  not something this change resolves.

## Done — V3.40.1 (2026-08-08)

- [x] Juz Tracker: "Download SVG" and "Mark next juz" buttons both
  removed — marking now happens only by tapping the tiles.
  `js/kaabaTracker.js`'s `controls` attribute is all-or-nothing, so
  this meant switching to `controls="none"` and hand-building a
  progress bar + Reset button ourselves (new `js/juzTrackerScreen.js`,
  CSS in `css/juzTracker.css`) rather than losing Reset along with the
  other two.
- [x] Settings Haidh section redesigned: heading relabeled "Haaidha"
  with the opt-in checkbox now inline in the heading row (same
  `#haaidha_checkbox` id, so its existing save-on-change listener
  needed no changes); Ruling switch rebuilt as its own centered
  75%-width row (also fixes a real bug — "Shafi'i" was clipping to
  "Sha" in the old fixed-72px `.switch-track-small`); the
  `#haidhRulingHint` text and its `HAIDH_RULING_HINTS` lookup removed
  entirely, not hidden; description paragraph moved below the Ruling
  row; the 3 input rows given a shared min-height so they're no longer
  uneven.
- [x] Haidh calendar prev/next month buttons: real bug fixed — they
  were already correctly wired to change the month, just never given
  an icon (`iconHtml('chevronDown')`, matching what `css/haidh.css`'s
  rotation rules already expected), so they were invisible rather than
  just unstyled.
- [ ] NOT built this round, still open in "Flagged" below: the
  tap-first/tap-last range-select gesture and its highlight state —
  genuinely underspecified (see the open questions there), held back
  rather than guessed at given it writes real haidh data.

## Done — V3.38 (2026-08-07)

- [x] IndoPak's Maqra/Rub'/Hizb terminology picker removed entirely, on
  hold ("putting the hybrid build on hold") -- UI, all 4 refForMushaf
  copies, and the indopak_terminology column (migration 0017) all gone,
  not just unused. Madani's own Ru'b/Hizb terminology (V3.37) unaffected.
- [x] Surah-based Hifz Setup history removed entirely ("History will
  only be collected as juz") -- the Juz'/Surah switch, baselineMode, and
  the baseline_mode column (migration 0017) all gone. Genuinely useful
  finding while tracing this: Surah mode was never actually wired into
  Dhor Schedule generation to begin with.
- [x] Both dropped columns confirmed safe under SQLite 3.35.0+ direct
  DROP COLUMN -- no table rebuild needed. Deploy-order note: this
  delivery's code must go live before migration 0017 runs.
- [x] 3 dangling apiSaveProfile payloads (still sending baseline_mode:
  'juz') and a dangling CSS selector found via a whole-repo sweep, not
  just the touched files -- cleaned up.

## Done — V3.37 (2026-08-07)

- [x] Sabaq Dhor row ordering: most-recent-first everywhere (base
  Quarter/Rub' sort, Maqra branch, Half/Full merge, lingering rows,
  leftover-unmerged fallback). See CHANGELOG for the real ordering bug
  found and fixed while testing this directly.
- [x] Sabaq Dhor's Maqra/Rub' behavior: Maqra only ever describes the
  current, in-progress Rub' -- a completed Rub' renders through the
  exact same, unchanged Quarter-level row logic every completed Quarter
  always used, not a parallel implementation. Verified against both of
  the user's own worked examples via direct testing.
- [x] Ru'b/Hizb terminology: Madani's Dhor switch, Sabaq Dhor's labels,
  describeDhorSegment, quarterUnitLabel, and Plan Dhor's per-Juz' rows
  all say Ru'b/Hizb for the Rub'/Hizb model. Hizb is a standalone global
  1-60 number, no Juz' prefix. Flagged: the "R" abbreviation for Rub' in
  condensed labels wasn't separately confirmed in chat -- easy to change.
  Finishes IndoPak's own Maqra/Rub'/Hizb picker option (V3.36) actually
  working as intended.
- [x] journal.js's edit popup now correctly determines isLatest (new
  isLatestEntry helper) -- fixes the bug flagged below since V3.36.1.
- [x] Documentation: shared/data.js's RUB_BOUNDARIES comment and all 4
  refForMushaf copies now state explicitly that IndoPak genuinely shares
  Waterval's data natively, not as a fallback.
- [x] File header versioning: every touched file now carries a "Current
  as of V3.37" line (new standing convention, not yet applied
  retroactively to untouched files).

## Done — V3.36.3 (2026-08-06)

- [x] Maqra added to Sabaq Dhor for the 15-line Madani model -- new
  finest level in the rollup chain, only when Rub'/Hizb model active
  (Waterval's Quarter/Half/Full completely unchanged). New structural
  helpers (studyMaqraIndex/structuralMaqraOf/structuralMaqraBounds,
  shared/data.js) and section-computation (computeSabaqDhorSectionsMaqra,
  js/position.js) mirror the existing quarter equivalents exactly,
  built on the confirmed Maqra dataset. Existing Quarter/Half/Full
  merge logic needed zero changes -- Maqra sits underneath it as a new
  level, not a rebuild of the existing chain. Rollup stepper
  generalized to navigate a variable-length level list by index.
  Stored rollup preference validated against the current model before
  use, so a stale "Maqra" preference can't leak into a Waterval
  session. Verified end to end: Maqra 1+2 combined matches Quarter 1's
  own span exactly (through the full pipeline, not just isolated
  helpers), Juz' 30 reverse order correct, Waterval behavior
  re-confirmed unaffected.

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
