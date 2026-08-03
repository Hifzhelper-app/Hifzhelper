# Hifzhelper — Changelog

Each entry lists what changed and exactly which files were touched, so a
future delivery only needs those specific files re-uploaded — not the whole
repo. See `SETUP.md` for initial setup, `SCHEMA.md`/`CONVENTIONS.md` for the
standing reference docs (those aren't repeated here unless they change).

---

## V3.29.0 — Pool updates moved to the Dhor card's actual Save; Dhor Plan's range-select fixed for queue wraparound (2026-08-03)

Two related fixes, both confirmed in chat, both about when/how
`baseline_selection` (the Dhor pool) is allowed to change.

**"Execution of the plan happens on the card, not in the plan."** Plan
Dhor's own Save used to merge any newly-selected units into the pool
immediately — before the student had touched the Dhor card at all. If
they then closed the card without logging anything, the pool had already
grown permanently even though nothing was recited and nothing exists in
`dhor_log`. That merge is removed from `savePlanDhorSelection` entirely —
selecting in Plan Dhor now only ever populates the card, same as before,
but touches nothing else.

The merge moves to the Dhor card's own Save handler instead, covering
both the clean-segment path and the raw-range path (both already compute
a real `segment_from`/`segment_to` before this point) — and running
regardless of whether the entry came from a Plan Dhor selection or was
entered fully manually. Fetches the profile fresh rather than trusting
`planDhorPool`, since that's only populated once Plan Dhor's modal has
actually been opened this session — a fully manual entry might never
touch it. Net effect: the pool now only ever grows at the exact moment
something is genuinely logged, from either path, so "in the pool" and
"in Dhor History" can no longer drift apart the way they could before.

**Dhor Plan's tap-first/tap-last range-select is rebuilt to range by
position in the rendered queue, not by quarter-unit value.** The
previous fix (V3.28.0) reused "View All Completed"/"View All"'s existing
range logic as-is, which works by taking the numeric min/max of the two
tapped rows' quarter-units. That's correct for those two tabs' plain
ascending Juz' grid, but Dhor Plan's own rows follow queue order, which
wraps around near the end of the pool — two rows that are genuinely
adjacent in the queue can have numerically distant unit values, and a
value-based range would sweep in anything numerically in between,
whether or not it was ever actually shown between the two tapped rows.

The fix: `renderPlanDhorTabContent`/`renderPlanDhorQueueDayRow` now build
`planDhorQueueRowUnits`, a flat, render-order list of each visible row's
own units, fresh every render; each row carries `data-row-index` instead
of relying on its raw unit values for ranging. A new
`planDhorHandleQueueRowTap(rowIndex)` ranges by index into that list —
tapping two rows selects the union of every row's units strictly between
them, never anything else. As a direct consequence, this also resolves
the earlier "exclude non-pool units" ask as a side effect, with no
separate filtering logic needed: nothing rendered in this tab can hold a
unit outside the pool in the first place, since every row comes from
`computeUpcomingDhorQueue`, itself built entirely from the pool. "View
All Completed"/"View All" are untouched — their rows never wrap, so the
original value-based `planDhorHandleRowTap` still applies there.

**Verified, not just read over**: ran the actual `planDhorHandleQueueRowTap`
against a simulated wrapped queue (today's row far along the pool
numerically, later rows wrapping back near the start) — confirmed that
tapping two rows adjacent in the queue but numerically distant selects
exactly their two rows' units, not anything sitting numerically between
them that was never actually tapped.

**Files changed:**
```
index.html
sw.js
js/dhorPage.js
CHANGELOG.md
TESTING.md
TODO.md
```

---

## V3.28.0 — Urgent TODO list cleared: 3 real bugs, dead plan-CRUD removed; Dhor card UI polish + Plan Dhor behavior fixes (2026-08-03)

Everything from TODO.md's "Urgent" section, then the previously-deferred
Dhor card/Plan Dhor items in the same delivery.

**Three real bugs, all the same root cause, all fixed.** `isCleanSingleUnit`
and the raw-range Save handler (`js/dhorPage.js`) both destructured
`.quarter` from `quarterUnitToJuzQuarter`'s result — a property that was
never actually there (it returns `.quarterIndex`). `isCleanSingleUnit`'s
version corrupted the Dhor card's Juz/Position fields after a clean
selection from Plan Dhor (`NaN` matching no `<option>`, leaving Juz blank).
The raw-range version is more serious: it's in the actual Save path, so
any raw-range Dhor entry logged before this fix has `NaN` written into
`dhor_log`'s `segment_from`/`segment_to` — flagged on TODO.md as a
decision still needed (repair existing rows, or leave as-is). Both fixed
and verified directly: a half-juz, a full juz, and a single-quarter
selection all now resolve to correct, non-`NaN` values.

**`quarterUnitToJuzQuarter` (`shared/data.js`) is hardened so this exact
mistake can't ship silently a 5th time.** This was the 4th real occurrence
of the same `.quarter`/`.quarterIndex` confusion in this codebase. Its
return value is now wrapped in a `Proxy` — any access to a property other
than `juz`/`quarterIndex` throws immediately, turning a future typo into
a loud, instant error at the exact wrong line instead of a silent `NaN`
surfacing as a confusing symptom several steps downstream. Verified: it
throws on `.quarter`, and works normally for the real properties.

**`apiPlans.create`/`.update`/`.remove` removed entirely** (`js/api.js`,
`handleCreatePlan`/`handleUpdatePlan`/`handleDeletePlan` in
`worker/src/plans.js`, and their 3 routes in `worker/src/index.js`) —
confirmed zero callers anywhere in the app: Dhor's own plan features go
through the queue model instead, and Sabaq/Sabaq Dhor have no planning UI
at all. `GET /plans` (the one real caller, `journal.js`) and its handler
are untouched. `validateBody`/its `isValidDate`/`isInRange` imports are
removed from `plans.js` too — nothing else in that file used them.

**Dhor card UI fixes, originally raised and then dropped from the thread**:
"Plan Dhor"/"Dhor History" shortened to "Plan"/"History" (the likely fix
for the reported button overlap too — the real cause was long text
wrapping inside a fixed-height button, not a missing grid). The Amount
switch is now a percentage width (78%) instead of a fixed 320px cap, so
"Half" no longer clips on wider cards. The "Pre-filled from today's
plan…"/"No plan set up yet…" banner is deleted entirely, along with its
now-empty container div and the `renderDhorPlanBanner` function itself.
"Starting at"'s label text is removed (an invisible spacer keeps Position
vertically aligned with Juz's own label above it). The Timer/stopwatch
column is now vertically centered against Duration beside it.

**Plan Dhor behavior fixes**: rows across all 3 tabs — including Dhor
Plan, which previously used independent checkboxes — now share the same
tap-first/tap-last range-select `.plan-dhor-tap-row` mechanism, so a
selection can't end up non-contiguous. One limitation flagged on
TODO.md, not solved this round: the range is computed by quarter-unit
*number*, correct for the other 2 tabs' plain ascending Juz' grid, but
Dhor Plan's rows follow queue order, which wraps around near the end of
the pool — tapping across a wrap point could select more than intended.
Separately, the "rest of week" rows' expand/collapse is fixed: the day
index was stored as a number when rendered but read back as a string on
tap, so the `Set` lookup could never match and no row would ever expand.

**Verified, not just read over, throughout**: real extracted-code tests
for the Proxy hardening, `isCleanSingleUnit`'s 3 clean-selection shapes,
the new tap-row markup, and the reused range-select logic across 2 taps.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/api.js
js/dhorPage.js
shared/data.js
worker/src/plans.js
worker/src/index.js
TODO.md
CHANGELOG.md
TESTING.md
```

---

## V3.27.0 — Tomorrow's Portion removed; Pure queue model, Phase C: Plan Dhor's queue view (2026-08-03)

Two pieces of work, done together: closing out the last loose end from
Phase A/D, and the 4-phase rebuild's final planned phase.

**Tomorrow's Portion removed entirely.** Confirmed in chat: it served no
purpose once a student could already redirect the queue by simply saving
a different portion via Plan Dhor. Removed from Setup (`index.html`'s
dropdown/label/hint; `js/settingsScreen.js`'s `renderTomorrowPortionOptions`/
`segmentLabel`/`buildSegmentOptions`, all 4 places that called the render
function, and the save handler's `startSegment` construction). This was
also the last remaining caller of `ensureDhorSchedule`/
`handleEnsureDhorSchedule` anywhere in the app (Phase B had already
removed the only other one, dhorPage.js's open-time top-up) — so that
whole mechanism is now gone too: the function, its route
(`/dhor-schedule/ensure`), and the frontend wrapper
(`js/api.js`'s `apiEnsureDhorSchedule`). Per the standing instruction
confirmed this session — delete superseded code promptly rather than
keeping it for a possible future tie-in, since there are no dependent
users yet to break — nothing here was left as a stub.

**The Dhor card's default Amount/Unit changed from Quarter to Half**,
confirmed in chat. This isn't purely cosmetic any more either: it's now
also the source Plan Dhor's "no Setup configured yet" fallback (below)
reads its granularity from.

**Phase C: Plan Dhor's "Dhor Plan" tab.** Replaces V3.24.1's whole
yesterday/today/next-5-days date-grouped view — dead since Phase A
stopped generating dated rows and Phase D purged what existed — with a
new backend computation, `computeUpcomingDhorQueue`
(`worker/src/dhorSchedule.js`, exposed at `GET /dhor-schedule/upcoming`):
several days' worth of upcoming QUEUE batches, no dates involved
anywhere, reusing `buildChunks`/`findChunkIndexForSegment` rather than
re-deriving the chunking logic a second time. Batch size and granularity
come from `dhor_granularity`/`dhor_quantity`/`dhor_frequency` when Setup's
been configured (e.g. 2 halves twice a day = 4 items/day, the exact
example confirmed in chat); otherwise from the Dhor card's own live
Amount/Unit switch, 1 item/day. Number of day-groups returned is
`dhor_days_of_week`'s own length when set (its cardinality, not specific
weekdays — no calendar involved), else 7. **Flagging rather than
silently assuming**: extending the "has Setup, no history yet" case to
also start from the pool's beginning was Claude's own generalisation of
what was confirmed for the "no Setup, no history" case specifically —
chat didn't address that exact combination, and this was the least-bad
reading available; worth double-checking it matches intent.

On the frontend (`js/dhorPage.js`): `openPlanDhorModal` now calls the new
endpoint instead of three date-keyed `apiPlans.get()` calls, and
pre-selects the first item of today's batch so the tab and the card
visually agree. Today's batch always renders individually, no dates, no
completion status (there's nothing here that can be "done" yet — these
are computed queue positions, not real rows). The rest of the week rolls
up one row per batch (`renderPlanDhorQueueDayRow`, replacing the old
`renderPlanDhorDayGroupRow`) — confirmed as the one deliberate exception
to "no rollup," since a future batch can never have the mixed-completion
ambiguity the old date-grouped rollup had to represent; expand/collapse
here is purely a "see more" affordance, always collapsed again the next
time the modal opens.

**A real bug found and fixed along the way, not something new**:
`quarterUnitLabel` destructured `{ juz, quarter }` from
`quarterUnitToJuzQuarter`, which actually returns `{ juz, quarterIndex }`
— producing "Qundefined" every time. This was already visible in the old
V3.24.1 tab (confirmed from an earlier screenshot showing exactly that
artifact); caught this round via testing while rebuilding the code that
calls it, not newly introduced by this rebuild.

**Verified, not just read over**: ran `computeUpcomingDhorQueue` for real
against 4 scenarios (no pool; no-Setup-no-history with a fallback unit;
continuing correctly after a logged entry; Setup configured with a
3-day-of-week schedule) — confirmed correct wraparound both within a
day's batch and across day boundaries when the pool is smaller than what
a batch needs. Separately ran the actual `renderPlanDhorQueueDayRow`
against collapsed, expanded, and single-item cases, confirming the
`quarterUnitLabel` fix and that a single-item day never renders an
expand control.

**Files changed:**
```
index.html
sw.js
js/settingsScreen.js
js/api.js
js/dhorPage.js
worker/src/dhorSchedule.js
worker/src/index.js
SCHEMA.md
CHANGELOG.md
TESTING.md
```

---

## V3.26.2 — Nav dropdown menu fixed to the viewport (2026-08-03)

Standalone fix, unrelated to the Dhor queue rebuild — reported after scrolling
down any page and finding the menu button appeared unresponsive.

**Root cause**: `#authBand` (the top bar) is `position: sticky`, so it
correctly stays pinned to the top as the page scrolls — that part was
never broken, which is why the toggle button itself always felt
reachable. `#authDropdown` (the menu panel it opens) had no positioning
of its own, though, so it sat in normal document flow at its original
spot near the top of the page. Tapping the toggle after scrolling down
genuinely opened it (`max-height` really did expand) — just off-screen,
above the current scroll position, making it look like the tap did
nothing.

**Fix**: `#authDropdown` is now `position: fixed`, anchored directly
under the band regardless of scroll position. The band's actual height
isn't a fixed number (it grows for a device's notch via
`env(safe-area-inset-top)`), so rather than hardcoding an estimate,
`toggleAuthDropdown` (`js/auth.js`) measures the band's real rendered
height and sets it as a CSS variable (`--auth-band-height`) fresh every
time the menu opens.

**Verified, not just read over**: extracted the actual `toggleAuthDropdown`
code and ran it against a fake DOM across open → close → reopen, including
reopening with a deliberately different band height (simulating e.g. a
device rotation between opens) — confirmed it re-measures fresh each open
rather than caching a stale value, and that closing never touches the
height variable.

**Files changed:**
```
index.html
sw.js
css/nav.css
js/auth.js
CHANGELOG.md
TESTING.md
```

---

## V3.26.1 — Dhor card position-selector redesign + a real latent bug fix (2026-08-02)

Follow-up patch within the Phase B round, confirmed in chat after reviewing
a live screenshot: the "Starting at" field always read "Quarter N" even
when Half or Full was the selected unit, which looked contradictory
("Half" next to "Quarter 1") even though the two fields were internally
consistent.

**The dropdown is now a switch, tied to the Amount/Unit value.** Quarter
shows a 4-way switch labeled 1/2/3/4; Half shows a 2-way switch labeled
1/2; Full (Juz) hides the position field entirely — a whole juz' has
exactly one valid starting point, so there's nothing to choose. The Juz/
position row collapses to one column when Full is selected, so Juz's own
field expands to fill the space rather than leaving an empty gap.

**A real bug, not just a labeling one**: switching the Amount switch
never reset Position. Pick Quarter 3, then flip to Full without touching
Position again, and the app would silently compute a segment running
into part of the *next* juz' — not the whole current one — since nothing
ever forced Position back to a value that made sense for the new unit.
Hiding the field for Full (and forcing it to the one valid value) closes
that off structurally, not just visually.

**Works identically for 15-line accounts**, which store raw positions
differently under the hood (15-line has 8 raw markers/juz', not 4) —
Quarter and Half always resolve to exactly 4 and 2 valid slots regardless
of which print is active; only which underlying raw value each slot maps
to differs by ref. Confirmed directly: extracted the real
`renderDhorPositionOptions` code and ran it against both reference
systems, checking the exact raw values each slot produces, not just the
labels.

**Reused, not rebuilt**: the shared switch component (`js/uiSwitch.js`)
already computes option width as a percentage of however many slots
exist — no changes needed there to go from 3-way to 2-way/4-way. A 2-way
variant already existed elsewhere (gender), so this wasn't new ground for
that component, just a new caller of it.

**One behavior worth knowing**: switching Quarter↔Half manually resets
Position to the first slot rather than trying to carry over an
equivalent position — confirmed as the simpler, more predictable choice.
Prepopulation (today's plan, continuing from history, or a Plan Dhor
selection) is unaffected by this reset — those paths set Position to the
actual planned value before the unit switch runs, and that value is
deliberately left alone.

**`renderDhorPicker`** (the old function that unconditionally rebuilt the
position dropdown's options, regardless of unit) is removed — fully
superseded by `renderDhorPositionOptions`, which `setDhorUnit` now calls
directly.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/dhorPage.js
CHANGELOG.md
TESTING.md
```

---

## V3.26.0 — Pure queue model, Phase B: Dhor card prepopulation rewire (2026-08-02)

Second of the 4-phase rebuild. Rewires `js/dhorPage.js` to actually match
the engine V3.25.0 shipped, rather than still branching on sources that
engine can no longer produce.

**The open-time top-up call is gone.** `renderDhorScreen` used to call
`apiEnsureDhorSchedule()` before asking for today's default entry, on the
theory that this would generate a fresh row if one was missing. Since
V3.25.0 made that function an unconditional no-op, the call never changed
what the next fetch would return — removed entirely rather than left as
a pointless round-trip.

**Result-handling collapses to the 3 sources that can actually occur**:
`today_plan`, `continue_last`, or nothing. The `missed_plan`/`future_plan`
branches (impossible since V3.25.0) and the `first_segment` reference
(already impossible since V3.24.0, just never cleaned up) are removed
from both the result-handling `if`/`else` chain and `renderDhorPlanBanner`'s
text map.

**The inline "which one do you mean" picker is gone.** A same-day batch
of more than one `plans` row used to force the student to pick one before
anything pre-filled (the "never auto-selected" rule from V3.9.0) — this
is the one deliberate behavior reversal in the whole 4-phase rebuild,
confirmed in chat. Now the FIRST item in the batch is always pre-filled
directly, fully editable same as any other default; the banner names the
count ("Pre-filled from today's plan (1 of 4 — see Plan Dhor for the
rest)") rather than offering an inline chooser. The rest of the batch
stays visible and selectable through Plan Dhor, which is untouched by
this phase and still shows every row.

**Versioning**: bumped every `?v=` reference in `index.html` and `sw.js`'s
`ASSETS`/`CACHE_NAME` from 3.24.1 to 3.26.0, across all files, not just
`dhorPage.js` — per `CONVENTIONS.md` principle 10, even though only one
JS file's content actually changed.

**Verified, not just read over**: extracted the actual (post-edit)
`renderDhorPlanBanner` function from the delivered file and ran it
against a minimal fake DOM for a single plan, a batch of 4, `continue_last`,
a null source, and a now-dead source (`missed_plan`) — confirmed each
produces the right text, and specifically confirmed the old inline-picker
markup (`data-plan-id`, `#dhorPlanChoices`) is genuinely never generated
any more, not merely hidden.

**Not touched in this delivery, by design**: Plan Dhor's own "Dhor Plan"
tab content (still the yesterday/today/next-5-days layout from V3.24.1)
is Phase C. Setup's "Tomorrow's Portion" and the live purge of existing
`plan_type='dhor'` rows are Phase D. The two prepopulation gaps documented
in V3.24.1 (pool-emptiness checked before `dhor_log`; the manual picker's
Save not updating `baseline_selection`) remain parked, unaffected by this
phase.

**Files changed:**
```
index.html
sw.js
js/dhorPage.js
CHANGELOG.md
TESTING.md
```

---

## V3.25.0 — Pure queue model, Phase A: scheduling engine rewrite (2026-08-02)

First of a 4-phase rebuild (confirmed in chat) correcting the underlying
Dhor scheduling model. The model shipped through V3.24.1 treated `plans`
as a calendar of dated commitments — a rolling window of future rows,
pre-generated ahead of time, with "missed" (backdated catch-up) and
"future" (borrowed early) fallbacks for whenever that window didn't line
up with today. Confirmed wrong: `plans` is a single ordered QUEUE, no
dates baked into any not-yet-done item. "Continue from where it left off"
always means the last thing actually logged in `dhor_log`, with the queue
picking up right after it — nothing else. If a daily quota is 4 halves and
only 2 get done, the other 2 simply stay first in the queue, done
whenever the student next does Dhor; there's no separate "missed" or
"future" concept to reconcile.

**`ensureDhorSchedule` (`worker/src/dhorSchedule.js`)**: the entire
rolling-window generation loop is removed — it used to walk the next 7
active days and INSERT dated `plans` rows ahead of time; now it's a
harmless no-op (`{ generated: 0 }`), unconditionally. Kept rather than
deleted so its two existing callers (dhorPage.js's open-time top-up, and
Setup's save handler, which would otherwise show a false "Couldn't save"
error if this started throwing) don't need to change in this phase. The
now-unused `DAY_ABBR`/`WINDOW_DAYS`/`addDays`/`dateToUTCWeekday` helpers,
which only existed to support that loop, are removed with it.

**`computeDefaultDhorEntry`**: collapses from 5 branches to 1 rule — an
explicit override for today if a `plans` row exists for it (the only way
one currently can, since generation no longer creates any), else ALWAYS
the segment following the last logged entry. The "missed plan" and
"future plan" branches are removed entirely — they only ever existed
because plans used to carry dates. `buildChunks`/`findChunkIndexForSegment`
are unchanged and still do the actual chunking work for the fallback
branch. Verified directly (not just read over): a small standalone
harness mocking `env.DB` confirmed `ensureDhorSchedule` now touches the
database zero times, and confirmed `computeDefaultDhorEntry`'s three
remaining outcomes (today's plan / continue from last / genuinely blank)
each still produce the right shape.

**Not touched in this delivery, by design**: dhorPage.js still has
handling code for the now-impossible `missed_plan`/`future_plan` sources
(dead, not broken — same pattern as `first_segment` becoming dead code in
V3.24.0) — cleaning that up, and wiring the card's own prepopulation to
auto-populate the first item of a multi-item batch, is Phase B. Plan
Dhor's Dhor Plan tab (yesterday/today/next-5-days) is Phase C. Setup's
"Tomorrow's Portion" and the live-DB purge of existing `plan_type='dhor'`
rows are Phase D — confirmed to ship without an intentional pause after
this phase, rather than holding D back as a separately-timed step. Also
carried forward, unaffected by this phase: the two prepopulation gaps
documented in V3.24.1 (pool-emptiness checked before `dhor_log`; the
manual picker's Save not updating `baseline_selection`).

**Files changed:**
```
worker/src/dhorSchedule.js
SCHEMA.md
CHANGELOG.md
TESTING.md
```

---

## V3.24.1 — Dhor Schedule generation fix + Dhor Plan tab redesign (2026-08-02)

Found through live debugging on two real accounts, both traced to
verified root causes rather than assumed — two earlier hypotheses
(an empty `dhor_days_of_week`, a silently-failing generator) were
checked directly against the data and ruled out before the actual
cause was found.

**Real bug in `buildChunks`**: `sessionSize = quartersPerUnit *
quantity` was multiplying quantity INTO each chunk's size, so "Half
granularity, quantity 2" produced one combined full-juz-sized chunk per
session instead of two separate half-sized ones. Confirmed correct
behavior: "Two half juz twice a day should generate four rows every
day" (2 sessions × 2 portions/session = 4 separate half-sized rows).
Fixed: `buildChunks` now always produces chunks at exactly one
granularity-unit each; `quantity` multiplies into rows-per-active-day
in `ensureDhorSchedule`'s generation loop instead. Worth knowing: this
only affects rows generated *after* this fix — a day's row-count is
locked in whenever that day was "tomorrow" in an earlier generation
run, so already-existing plan rows (e.g. from before this update) won't
retroactively split into the corrected shape; only fresh generation for
not-yet-reached days will.

**Dhor Plan tab was missing every row's date** — fixed, now shows
`target_date` on every row.

**The Dhor Plan tab's actual job, reframed and rebuilt**: not just
"today's session," but yesterday (was it covered) / today (confirm
what's expected) / the next 5 days (what's coming) — confirmed as the
minimum useful view. Today shows every row individually. Yesterday and
each of the next 5 days roll up into ONE summary row per day when there
are multiple sessions that day — "[date]: Portion A to Portion B" (the
earliest session's start through the latest session's end). Every row
gets a checkbox; a plan already `status='completed'` shows checked and
disabled rather than a live control. A rolled-up day with genuinely
mixed completion (some sessions logged, some not) is expandable instead
of trying to represent that in one ambiguous checkbox — tapping it
reveals the individual underlying sessions, each with its own normal
state. Confirmed: this tab stays view-only for plans themselves (no
edit/delete facility for a plan's date or portion exists anywhere) —
selecting a portion here loads it into the Dhor card's own form, same
as everywhere else in Plan Dhor; the user still saves from there.

**Not in this delivery, documented but not yet fixed**: two other
prepopulation bugs found during this same debugging session —
`computeDefaultDhorEntry` checks whether the pool is empty before ever
querying `dhor_log`, so a student with an empty Setup pool but real
logged Dhor history never gets branch 4 ("continue from last entry") a
chance to fire; and only Plan Dhor's own save path adds a newly-logged
segment to `baseline_selection` — the regular manual picker's Save does
not, breaking "logging Dhor builds history" for that path specifically.
Both documented for a future round, not folded into this one.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/dhorPage.js
worker/src/dhorSchedule.js
CHANGELOG.md
TESTING.md
```

---

## V3.24.0 — Plan Dhor (2026-08-02)

The full Plan Dhor rebuild, replacing the read-only "View Plan" popup
entirely, plus the row layout changes and a global spelling sweep that
were queued alongside it.

**Global spelling sweep**: "Juz'" → "Juz" across every piece of
user-facing text in the app (10 fixes across 5 files) — deliberately
scoped to display text only, not internal code comments.

**Dhor card layout**: Row 2 is now Date : Plan Dhor : Dhor History in a
40:30:30 grid with fixed-height, wrapping (not truncating) buttons. Row
3 is Amount as a 3-way switch (Quarter/Half/Full), reusing the app's
existing shared switch component, sized to 75% of Row 2's height via a
CSS custom property rather than a guessed value. Row 6's Duration field
changed from decimal minutes to mm:ss text (placeholder "mm:ss",
colon-less digits read as whole minutes), labeled "TIMER" instead of
"Stopwatch" — and since mm:ss is a lossless round-trip (unlike the old
1-decimal-minute display), the V3.21.1 exact-seconds-bypass mechanism
is gone entirely, a real simplification, not just a rename.

**Plan Dhor**: the "View Plan" button is renamed "Plan Dhor" and opens a
much richer screen — a title/Save/Close row, then a 3-way tab switch
(Dhor Plan / View All Completed / View All). Dhor Plan shows today's
scheduled sessions as simple independent checkboxes (this is also where
the old inline "more than one plan for today" picker moves to and is
removed from the card entirely). The two View tabs show all 30 Juz,
grouped with the same roll-up/down mechanism already proven for Sabaq
Dhor, using **tap-first, tap-last range-select** rather than per-row
checkboxes — tap a start point, tap an end point, everything between is
selected; a third tap starts an entirely new range rather than
extending it, which makes a non-contiguous selection structurally
impossible to create. A Select All action is included. View All greys
out anything not yet marked complete but keeps it selectable — saving
something not yet in the pool adds it to `baseline_selection`.

**Save logic, deliberately simple**: if the selection reduces to one
clean quarter/half/juz, it populates Juz/Position/Amount exactly as the
manual picker already does, and Mistakes/Duration work normally.
Anything else (doesn't reduce to one clean unit, or spans more than one
juz) shows: *"Your times and mistakes will not be recorded for this
selection. Cancel to review, OK to continue."* Continuing switches the
card into a From/To display — Mistakes, Tajweed, and the Timer become
disabled, Notes stays available — and tapping either From or To reopens
Plan Dhor with the current selection already ticked, rather than being
edited inline. The user still has to hit the card's own Save to create
the record; Plan Dhor only ever populates the form. (An earlier,
considerably more complex design — decomposing a selection into
multiple clean groups and proportionally splitting mistakes/duration
across them, with a 5-checkbox cap and a 2-run non-contiguous cap — was
fully worked through in chat and then deliberately scrapped in favor of
this simpler version before any of it was built.)

**Backend correction**: `computeDefaultDhorEntry`'s "no plan, no
history at all" case used to default to the first eligible segment —
changed to genuinely blank, since a brand-new student with nothing in
their pool yet realistically isn't doing Dhor. Once their first entry
is ever saved, the existing "continue from last entry" logic takes over
normally — logging builds history the same way Setup's baseline marking
does.

**Caught before shipping:** two real gaps found while reviewing this
before packaging, not after. (1) No CSS had actually been written for
the entire Plan Dhor modal — it would have rendered completely
unstyled. Added comprehensively, reusing the same shared-grid pattern
already proven for Sabaq Dhor's checkbox list. (2) Editing an existing
Dhor entry while raw-range mode was active would have left Mistakes/
Duration stuck disabled and a stale From/To row visible underneath the
edit screen — `loadDhorEntryForEdit` now exits raw-range mode first.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/journal.js
js/position.js
js/dhorPage.js
js/settingsScreen.js
worker/src/dhorSchedule.js
CHANGELOG.md
TESTING.md
```

---

## V3.23.1 — Dhor layout polish, pre-Phase B (2026-08-01)

Confirmed batch of Dhor-specific UI changes, requested before moving on
to Phase B:

- **Amount + View Plan** now sit in their own row directly below the
  date (reusing the date row's exact grid for visual consistency).
  **View Plan** is new — a popup listing upcoming scheduled Dhor
  sessions (`plan_type='dhor'`, `status='planned'`, `target_date >=`
  today), the mirror image of History's popup but facing forward in
  time instead of back. Reuses the existing `/plans?since=` query,
  no backend changes needed for this one.
- **Mistakes + Tajweed** now share one line, matching the pattern
  already used elsewhere (Sabaq's Lines/Pages, Sabaq Dhor's own
  Mistakes/Tajweed from V3.20.0).
- **Duration + Stopwatch**: Duration's column is now a clean 50% (same
  `.picker-row` grid used everywhere else), with a Stopwatch icon
  button (user's exact `timer.svg`) beside it, centered. The actual
  timer widget (Start/Stop/Lap) is no longer always visible — it's
  hidden by default and toggles open/closed via the Stopwatch button.
- **"Seg X-Y" replaced with "Juz X" / "Juz X H1"-"H2" / "Juz X
  Q1"-"Q4" everywhere it appeared** — the History popup, the
  multi-plan-for-today picker, and the edit-screen's "not editable
  here" text. This was explicitly parked in three earlier rounds
  specifically for "when Dhor's own detail work happens" — this is
  that moment. New `describeDhorSegment` helper reuses the existing
  `segmentRangeToPicker` rather than re-deriving juz'/unit a second way.

**Also fixed while restructuring:** Amount is functionally part of the
same segment-determination system as Juz'/Starting-at (all three
together produce `segment_from`/`segment_to`), so it needed to hide
during edit alongside the segment picker for the same reason those two
already do — moving it into its own row for layout purposes had
initially left it out of that hide/show toggle; caught and fixed before
shipping rather than after.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/icons.js
js/dhorPage.js
js/logDetailScreen.js
CHANGELOG.md
TESTING.md
```

---

## V3.23.0 — Dhor detail rebuild, Phase A (2026-08-01)

**Dhor's default entry is no longer just "today's plan or blank."**
Confirmed design: `computeDefaultDhorEntry` (new, `worker/src/dhorSchedule.js`)
now checks, in order: (1) today's plan(s) — unchanged from before; (2) no
entry for today → the most recently MISSED plan, backdated to *that
plan's own date* (a genuine catch-up entry, not logged as today); (3) no
missed entries → the closest upcoming plan, borrowed early under today's
date; (4) no plan at all but real Dhor history exists → the segment that
follows the last logged entry, walking the eligible pool forward at
*that entry's own granularity* — a deliberate choice to match what the
student actually just did, not the account's configured Setup
granularity/quantity (which is what `ensureDhorSchedule`'s own anchor
logic uses for auto-generating future plan rows — a related but
different question); (5) no plan and no history at all → the very first
eligible segment, quarter granularity.

Reuses the existing `buildChunks`/`findChunkIndexForSegment` (this same
file, already proven via `ensureDhorSchedule`) rather than building a
second copy of that gap-aware chunking logic. New endpoint:
`GET /dhor-schedule/default-entry`. The Dhor form now shows a hint
explaining *why* something was pre-filled ("catching up on...",
"continuing from your last session", etc.) instead of populating
silently.

**3 UI fixes, applied across all 3 cards** (shared CSS/HTML, not
Dhor-specific) since they're deferred groundwork for this same rebuild:
- Cancel removed from the edit-screen top bar (redundant with the bottom
  bar's Cancel) — and the now-orphaned JS listeners for those buttons
  were removed too, checked deliberately given how the last critical bug
  happened.
- The date field is no longer a fixed 30% column that could truncate the
  rendered date — now sized to its own natural width.
- History moved into the same row as the date field, right-justified
  with edge padding, height-matched to the date field via the row's own
  `align-items:stretch` rather than a hardcoded pixel value. Width was
  deliberately left unconstrained (sized to its own label) rather than
  forced to match the date field's width too, since "Sabaq Dhor History"
  would otherwise risk wrapping on a narrower screen — flagging this as
  a specific interpretation choice, not an oversight.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/dhorPage.js
js/sabaqPage.js
js/sabaqDhorPage.js
js/api.js
worker/src/dhorSchedule.js
worker/src/index.js
CHANGELOG.md
TESTING.md
```

---

## V3.22.1 — Edit screen polish + null-entry crash fix (2026-08-01)

Three fixes, all confirmed in chat after V3.22.0 went live:

**Topbar/date order was backwards.** The confirmed layout was "Editing
[Type] from [date]" as Row 1, date field as Row 2 below it — V3.22.0
built it in the opposite order. Fixed by reordering the two elements in
`index.html` for all 3 cards. The edit topbar is hidden in normal view
regardless, so this has no effect outside edit mode.

**Sabaq's Delete button now hides entirely for the frontier entry**,
rather than just being disabled — same restriction as before (deleting
the entry `position.sabaqTo` is currently based on isn't allowed), just
not shown as an option at all instead of shown-but-greyed-out.

**Real crash fixed: entries with a null sabaq_from/sabaq_to (shown as
"null-null" in History) couldn't be opened for editing at all.**
`loadSabaqEntryForEdit` called `.split(':')` directly on
`entry.sabaq_from`/`entry.sabaq_to` — if either is genuinely `null`
rather than a string, that throws immediately, before anything else in
the function runs. Since the History popup had already closed by that
point, the failure was invisible: the screen just silently stayed on
the normal Sabaq view, with no way to reach Delete for that entry at
all. Fixed with a small parsing helper that falls back to the same "—"
placeholder state `renderVerseRefField` already shows for a genuinely
empty field, instead of crashing — the edit screen (and Delete) now
opens correctly for these entries regardless of how malformed their
historical data is.

**Files changed:**
```
index.html
css/detail-pages.css
js/sabaqPage.js
sw.js
CHANGELOG.md
TESTING.md
```

---

## V3.22.0 — Dedicated edit screen + Delete (2026-08-01)

**Edit now opens as a full takeover, not an inline banner.** Confirmed
design: tapping the pencil icon on a History row now hides the tabs/dots
row and every card except the one being edited, and within that card
replaces the normal header (icon/heading/Save) with a grey top bar
reading "Editing [Type] from [date]" + Cancel, and adds a matching grey
bottom bar with three centered buttons: Cancel, Delete (red background),
and Update (styled exactly like the existing Save icon). This isn't a
new entry in the screen router (`js/app.js`) — it's a mode toggle within
the existing log-detail screen, specifically so the already-working
verse-ref grid, tajweed picker, and comment block don't need to be
rebuilt a second time for a separate screen.

**Delete is now wired up**, reusing the DELETE endpoints that already
existed server-side (confirmed in an earlier chat, never previously
attached to any button): `apiSabaq.remove`, `apiSabaqDhor.remove`,
`apiDhor.remove`. Confirmation wording, exact as specified: "Deleting
this entry may create gaps in your history which cannot be recovered.
Are you sure you want to DELETE?"

**Sabaq's Delete button is disabled (not hidden) for the frontier
entry** — the one `position.sabaqTo` is currently based on — since
deleting it would leave position pointing at a row that no longer
exists. Sabaq Dhor and Dhor have no such restriction; neither has a
position concept tied to individual entries.

**Consistency pass while rebuilding this:** Dhor's segment picker
(Juz'/Starting at/Amount/plan banner) now hides during edit, matching
Sabaq Dhor's existing precedent of hiding pickers that reflect today's
live options rather than what was actually chosen on the edited day —
previously it stayed visible but non-functional during edit, which
could read as if changing it did something.

**Caught before shipping, not after this time:** the three `renderX
Screen()` functions that reset stale state on every fresh screen open
still referenced the old banner element IDs removed by this same
change — the identical *shape* of failure as V3.21.2's critical bug
(a missing element reference that would silently break the screen),
just caught this time by deliberately grepping for the old IDs before
calling this done, rather than after a user found it live.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/icons.js
js/dhorPage.js
js/sabaqPage.js
js/sabaqDhorPage.js
js/logDetailScreen.js
CHANGELOG.md
TESTING.md
```

**Post-delivery correction:** `js/logDetailScreen.js` — which holds
`enterEditScreenMode`/`exitEditScreenMode` themselves, referenced by all
three of the files above — was edited as part of this change but
accidentally left out of the zip that was actually delivered. Confirmed
live: `ReferenceError: Can't find variable: exitEditScreenMode`, and
History disappearing again, for the same underlying reason as V3.21.2
(a function call to something that doesn't exist where it's being
called from) but caused by an incomplete delivery this time, not a code
ordering mistake. Re-delivered as a single-file follow-up; no code
changes, no version bump — `js/logDetailScreen.js` was already tagged
`?v=3.22.0` in `index.html`, it just hadn't actually been uploaded yet.

---

## V3.21.2 — CRITICAL FIX: Save was broken on all 3 cards (2026-08-01)

**Root cause: `EDIT_HANDLERS` was used before it was declared.** V3.21.0
added `js/dhorPage.js:237: EDIT_HANDLERS.dhor = loadDhorEntryForEdit;`,
but the `const EDIT_HANDLERS = {}` declaration itself didn't get added
until line 328 — much further down in the same file. A `const` binding
is unusable from the top of its scope until its own declaration line
actually runs, so line 237 threw
`ReferenceError: Cannot access 'EDIT_HANDLERS' before initialization`
the instant the page loaded, which halted every remaining top-level
statement in that script.

That's a much bigger problem than it sounds, because **Save's click
handler is wired up further down in the same file, after that line** —
so it never got attached. Since the crash meant the `const` itself never
ran, `js/sabaqPage.js` and `js/sabaqDhorPage.js` (which load after
`dhorPage.js` and each do their own `EDIT_HANDLERS.sabaq = ...` /
`EDIT_HANDLERS.sabaqDhor = ...`) hit the identical error, halting their
scripts too — and their Save handlers are wired up right after those
lines as well. **Net effect: Save silently stopped working on Sabaq,
Sabaq Dhor, and Dhor, and History never appeared on any of the 3 cards**
(`renderRecentEntries`, defined further down in the crashed
`dhorPage.js`, was never successfully reachable either). Confirmed live
in the repo the user re-uploaded, not just suspected from re-reading the
code.

**Fix:** `EDIT_HANDLERS` is now declared right at the top of
`js/dhorPage.js`, before anything in any of the three files can
reference it. This is the only change needed — the assignments and
usages elsewhere were already correct, they just needed the declaration
to actually exist first.

**Also, Sabaq Dhor's checkbox alignment — genuinely fixed this time.**
The 80:20-grid-per-row approach from V3.20.0/V3.20.1 was the wrong tool
for cross-row alignment: each row computed its own 80%/20% split against
its own box, so consistency across rows was never actually guaranteed,
just usually close. `#sabaqDhor_sections` is now itself ONE shared CSS
grid (`1fr auto auto`); every row contributes exactly 3 direct grid
children (text, a Move-to-Dhor button or an empty placeholder to keep
column position stable, checkbox) so every checkbox genuinely shares the
same column across every row, the way an HTML table's cells would.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/dhorPage.js
js/sabaqDhorPage.js
CHANGELOG.md
TESTING.md
```

---

## V3.21.1 — Dhor duration becomes a real input (2026-08-01)

**Note on this delivery: bundled with V3.21.0.** V3.21.0 was never actually
uploaded to production, so this zip contains every file changed by BOTH
V3.21.0 and V3.21.1 together — the live site is still on V3.20.0.

**Duration is now a genuine user input, not something only the timer can
set.** Confirmed in chat: the timer is meant to be an assistive feature
that fills duration in for you and additionally captures lap times (real
richer data a manual entry can't provide) — it was never supposed to be
the *only* way to record a duration. Previously there was no manual
field at all; `js/timer.js` has no `<input>` elements, so
`duration_seconds` could only ever come from actually running the timer.

Added a "Duration (minutes)" field above the timer. The timer auto-fills
it (and separately captures lap times) when used, but it's directly
editable at any time — before, during, or after using the timer.
Stored value is still seconds (unchanged column), entered/displayed in
minutes.

Two precision/consistency details, both confirmed in chat:
- The field displays 1 decimal place, but the timer's real precision
  isn't lost to that rounding — if the field is left exactly as the
  timer set it, saving uses the timer's exact seconds value directly,
  not a re-parse of the rounded "12.6" display text. Detecting "did the
  user actually touch this" relies on a real quirk: setting `.value`
  programmatically doesn't fire an `input` event, only genuine typing
  does — so the auto-fill and the override-detection cleanly never
  collide.
- Manually overriding the duration clears lap times, since laps that no
  longer sum to the new total would be actively misleading rather than
  just unused.

This also meant fixing V3.21.0's Dhor edit flow: duration and lap times
were excluded from editing specifically because no editable field
existed for them yet. That reasoning no longer applies now that one
does, so editing a past Dhor entry includes them like any other field.
Segment (from a picker reflecting today's live options, not what was
actually chosen on the edited day) is still excluded — that part of the
original reasoning still holds.

**Files changed (includes V3.21.0's files, since that hadn't shipped
yet):**
```
index.html
sw.js
css/detail-pages.css
js/icons.js
js/dhorPage.js
js/sabaqPage.js
js/sabaqDhorPage.js
CHANGELOG.md
TESTING.md
```

---

## V3.21.0 — Edit past entries + checkbox alignment fix (2026-08-01)

**Sabaq Dhor checkbox alignment** — the fix identified but held back last
round is now in: `.sabaq-dhor-section-row span` gets `min-width: 0`, so a
longer label like "Quarter 3 (current): 83:1 - 86:2" wraps within its 80%
column instead of overflowing it and dragging that row's checkbox out of
line with shorter rows.

**Editing past entries — confirmed design.** A single edit (pencil) icon
per row in the History popup (Sabaq/Sabaq Dhor/Dhor), loading that entry
into the card's own form rather than a separate edit UI — reuses every
existing field/picker/validation as-is. Saving PATCHes the row.

The important nuance, confirmed in chat: this is NOT "delete and re-save
for every edit." That would be actively risky — recomputing Sabaq's
position from whichever entry happens to be getting a typo fixed today,
even a weeks-old one, would silently drag the student's position
backward. Position is now only ever recomputed when the entry being
edited is confirmed to be the current frontier (the one `position.sabaqTo`
was actually derived from — checked once, when the entry is loaded, by
comparing it against the most recent entry in that student's own history).
Editing any other Sabaq entry saves the content and leaves position alone.

Sabaq Dhor and Dhor have no position side effects to worry about, but
have their own real constraint: their range fields (Sabaq Dhor's
from/to, Dhor's segment_from/to) reflect a picker or checkbox set built
from *today's* live options, not whatever was actually true on the day
being edited — there's no way to correctly reconstruct that UI for a
past entry. So editing those two only ever touches mistakes, tajweed
tags, and notes; the range (and Dhor's timer data, which can't be
redone either) is simply never included in the PATCH and stays exactly
as originally recorded. The banner shown while editing says so
explicitly, and the section checkboxes / rollup stepper are hidden on
Sabaq Dhor while editing since they'd otherwise look actionable but
silently do nothing.

Also fixed while building this: reopening any of the 3 cards now
explicitly resets editing state. Without it, closing the screen mid-edit
(e.g. via xclose) without saving or cancelling would leave the next
save on a fresh visit silently PATCHing the old entry instead of
creating a new one.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/icons.js
js/dhorPage.js
js/sabaqPage.js
js/sabaqDhorPage.js
CHANGELOG.md
TESTING.md
```

---

## V3.20.0 — Prepopulation frontier fix + UI polish (2026-08-01)

**Sabaq position frontier — two more real bugs found live, after V3.19.0.**

Bug 1: `advancePositionAfterSabaq` still trusted "to" as the frontier
unconditionally. That breaks for a bulk/historical catch-up entry whose
fields were filled in ascending numeric order rather than the juz's
actual study/chronological order — e.g. From=88:1/To=114:6 for a juz' 30
student actually means surahs 89-114 are fully done and only ayah 1 of
88 is, so 88:1 (not 114:6) is the real frontier. Fixed by comparing both
endpoints via `shared/data.js`'s existing `compareVerseKey` against the
juz's real study direction (lower endpoint = frontier for juz' 30,
higher = frontier for every other juz'), instead of assuming either
field always plays a fixed role. This corrects the logic from here
onward; it does NOT retroactively fix already-stored position data for
students already affected by the old logic — that needs a one-time
direct D1 correction, separate from this delivery.

Bug 2: `nextSabaqDefaults` gated on `hasDhor` unconditionally, so a
student with real Sabaq history AND any Dhor history at all got nothing
prepopulated. The no-prepopulate rule was only ever meant for the
no-Sabaq-history case — real Sabaq history should always prepopulate
regardless of Dhor history. This one needed no data correction: the
underlying position record was already correct, only the display logic
was wrong.

**UI polish, all confirmed in chat:**
- Save button (all 4 cards): icon doubled in size, whole icon+label unit
  now centered both ways within its grid cell instead of hugging the
  column's right edge.
- Sabaq Dhor section rows: rebuilt as an explicit 80:20 grid (text :
  checkbox) instead of flex + space-between, so the checkbox sits at a
  consistent position across every row instead of trailing wherever that
  row's text happens to end.
- Sabaq Dhor: Mistakes and Tajweed now share one line, reusing the same
  `.picker-row` 2-column pattern already used for Sabaq's own Lines/Pages
  fields.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/position.js
js/sabaqPage.js
CHANGELOG.md
TESTING.md
```

---

## V3.19.0 — Detail-screen UI round 4 + real prepopulation fix (2026-07-31)

**Sabaq prepopulation — real root cause found, not a rendering issue.**
`shared/data.js` already had a fully-written, exported helper,
`nextSabaqPosition`, specifically for advancing one ayah past a given
position in the correct study direction (backwards for juz' 30, forwards
otherwise) — it just was never actually called anywhere. `nextSabaqDefaults`
(`js/position.js`) was reusing `position.sabaqTo` directly as the new
From/To, which repeats the exact ayah the last entry already ended on
instead of continuing past it. Fixed by wiring `nextSabaqPosition` in;
also added a `juzComplete` check so prepopulation stays silent (rather
than guessing) once advancing would leave the juz' entirely.

**Icon-button convention.** The Save button (all 4 cards) now matches
Hifzhelper's own existing `.nav-icon-item` pattern — icon on top, label
below, no border/background — instead of being a special-cased bordered
button. This is the new default for in-app icon buttons generally, not
just Save. Label stays normal weight; caps come from `text-transform`,
not the underlying string.

**Xclose control.** The log-detail screen (Sabaq/Sabaq Dhor/Dhor/Tadabbur)
now has an exit icon on the right of the swipe-dots row, using the
provided Lucide `square-x` source. Exits to Journal — the app has no
navigation history stack, just direct screen switches, and Journal is the
landing page this screen is always reached from. The dots row is now a
3-column grid (spacer:dots:close) so dots stay centered independently of
the close button; only the dots hide on desktop (≥1180px), the close
button stays visible at every size.

**Sabaq Dhor "Sections to revise" redesign.** Heading text removed
entirely; "Mark sections revised" now labels the checkbox list
specifically. Checkboxes moved to the right side of each row. Default
changed from checked to unchecked — this was a real bug, not styling:
`renderSabaqDhorRows` was hardcoding `checked` on every row, forcing
everything pre-selected instead of letting a student actually mark what
was revised. The existing "please check at least one section" validation
in the save handler already covers the resulting empty-selection case, no
changes needed there.

**Rollup control redesign.** The two rollup buttons are now a compact
2-icon vertical stepper sitting to the left of the section list (was a
full-width row above it), using the provided Lucide
`list-chevrons-down-up`/`list-chevrons-up-down` icons in place of the
plain ▲/▼ glyphs. Each button is now hidden entirely (not just a no-op
tap) whenever its direction wouldn't actually change anything — rather
than hand-duplicating `computeSabaqDhorRows`' own merge conditions
(pairs, full-juz' logic, lingering-juz' rows) to detect eligibility
separately, `updateRollupStepperVisibility` computes the rows one level
up and down and compares row-id sets directly, so eligibility can never
drift out of sync with what the button would actually do.

**Deferred, not in this round:** relabeling the Dhor Plan picker's raw
"Seg 113-116"/"Seg 117-120" buttons (segment_from/segment_to quarter-unit
IDs) into a human-readable form — parked for when Dhor's own detail work
happens.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/icons.js
js/position.js
js/sabaqDhorPage.js
js/logDetailScreen.js
CHANGELOG.md
TESTING.md
```

---

## V3.18.0 — Detail-screen UI round 3 (2026-07-31)

Bismillah. This round's scope was fixing UI items confirmed after V3.17.0
went live — Sabaq Dhor confirmed working, so this leaves the Sabaq
prepopulation bug for a later revision as agreed, and focuses purely on
this round's UI list.

**Header, all 4 cards**: rebuilt as two explicit CSS grids instead of the
old flex row — row 1 is icon:heading:save at 10:70:20, row 2 is
date:blank at 30:70. `save-status` and the Save button are now grouped
into one wrapper so they share column 3 as a single grid item instead of
each auto-placing into its own column.

**Notes/Private**: the Private checkbox + label move up onto the same
row as the "Notes" label itself, replacing the row that used to sit
below the textarea.

**"Recent" → History button only**: the heading text is gone entirely,
and the last-2-entries list under the History button is removed per the
confirmed scope — the button alone (now compact and dark green/Evergreen,
with type-specific text: "Sabaq History", "Sabaq Dhor History", "Dhor
History") is enough for now. It still opens the same full popup (up to
50 entries) as before.

**Verse-ref fields (Sabaq from/to) — real bug found, rebuilt, not
patched**: these were flagged as "erratic"/chevrons "not visible at all."
Root cause: the flex version had no `min-width` guard on the surah
label, so a long name could eat into a sibling's share depending on
exactly how much room flex gave it that render — the same underlying
issue (an unconstrained sibling silently stealing a neighbour's assigned
space) as the V3.14.1 ayah-width bug, just via flex-basis this time
instead of a specificity fight. Rebuilt as an explicit 4-column CSS grid
(chevron:Surah:Ayah:chevron at 10:50:30:10, confirmed in chat) with
`min-width: 0` on every text-bearing cell, so each column keeps its
assigned share regardless of content length. Left chevron is unchanged
(still opens the surah picker). **New**: the right-hand chevron column
is an explicit up/down stepper for the ayah value — added because it
was the *native number input's own spinner* that wasn't rendering, so
this replaces reliance on it entirely rather than trying to make it
visible; dispatches a `change` event so it flows through the exact same
sync/recompute logic as typing a value in directly. Flagging this as an
assumption, not a confirmed spec: the 4th column's exact behaviour
(ayah stepper) wasn't explicitly specified, just its width.

**Swipe dots — real bug found, root cause was outside the file being
debugged**: `updateLogDetailDots` compared `card.offsetLeft` against
`rail.scrollLeft`, which silently broke once `#appContent` gained
`transform: translateZ(0)` (V3.4.3's Safari-paint fix, in `css/base.css`)
— a transformed ancestor becomes the nearest `offsetParent` for elements
inside it in every major browser, so each card's `offsetLeft` was
actually measured from `#appContent`'s edge, several DOM levels above
the rail, not from the rail's own content box. That added a constant
(`#appContent`'s own padding) to every comparison, so a dot only flipped
"active" once you'd scrolled well past where the card had actually
snapped into place — matching the "erratic"/"misaligned" report exactly,
and invisible from reading either file in isolation. Fixed by switching
to `getBoundingClientRect()`, which is always viewport-relative and
can't drift the same way regardless of any ancestor's transform/position
tricks.

**Housekeeping**: the three Recent-rail container divs (`sabaqRecentRail`
etc.) previously carried the pre-V3.14.2 `.swipe-rail` class, left over
from before the History-button redesign and now meaningless (nothing
scrolls horizontally there any more) — given their own plain
`.history-container` class instead while already touching this markup.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/commentPrivacy.js
js/dhorPage.js
js/sabaqPage.js
js/logDetailScreen.js
CHANGELOG.md
TESTING.md
```

---

## V3.17.0 — Phase 2b: the move-to-Dhor transition (2026-07-31)

Bismillah. Completes the Sabaq Dhor rebuild — the last piece confirmed
in chat, and the one most likely to have a subtle bug, given how many
moving parts it touches. Bundled complete, same as before: nothing from
V3.14.0 onward had been uploaded yet.

**Two independent paths to the same outcome**, confirmed in chat —
whichever fires first:
- **Manual**: a "Move to Dhor" button now appears next to any row that's
  eligible (halves and full juz' only, never a lone quarter) — clicking
  it adds that row's quarter-units directly into `baseline_selection`
  (Dhor Schedule's own eligibility pool, from V3.15.0's rework).
- **Automatic**: `js/position.js`'s new `maybeAutoMoveToDhor`, called
  right after every Sabaq save — if a previous juz' is still lingering
  and this save just completed at least one quarter of the *new* juz',
  whatever's left of the old one moves to Dhor on its own.

**Progressive eligibility, exactly as specified**: a lone quarter never
has the Dhor option. A First Half always does, once complete. A Second
Half only gets it once First Half has *actually* moved — checked
directly against `baseline_selection` membership (being in that pool
*is* "already moved"), not a separately-tracked flag. Caught a real bug
here before shipping: my first version only showed Second Half as a row
once First Half had moved, when it should always be visible for
revision — the sequential rule governs the Dhor *option*, not whether
the row shows at all. Fixed and re-verified.

**`previousJuz` tracking**: `advancePositionAfterSabaq` now preserves
every other field on `position` instead of replacing the object outright
— its first version would have silently dropped Phase 2a's rollup
preference on every single save, a bug caught in this round's own
review rather than shipped. It also now records which juz' was just left
behind whenever Sabaq crosses a boundary, which is what both the
lingering rows and the auto-trigger read.

Every scenario tested directly with real numbers before packaging:
juz' 30→29 crossing sets `previousJuz` correctly; the auto-trigger
correctly does *not* fire before a quarter of the new juz' is done, and
correctly *does* fire (with the right quarter-units) once it is; lingering
rows show both halves when neither has moved, only Second Half once
First has, and disappear entirely once both have.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
js/position.js
js/sabaqPage.js
js/sabaqDhorPage.js
CHANGELOG.md
TESTING.md
```



Bismillah. This delivery bundles everything still pending from V3.14.0
onward (none of it had been uploaded yet) plus this round's work, all in
one download as requested — nothing here assumes any earlier zip made
it live.

**UI notes, all 4 detail cards:**
- Header is now 2 rows: row 1 is icon + heading (left) and Save (right,
  icon styled like the nav icons, with actual "Save" text next to it —
  reverses the icon-only version from before); row 2 is just the date,
  at 30% width. Putting date and heading on the same row didn't work in
  practice, per direct feedback on what shipped.
- Privacy reverts from the large Public/Private switch back to a plain
  checkbox next to "Notes" (default unchecked = public) — judged too
  much control for what's a minor, occasional toggle.
- "Recent" becomes a "History" button plus the last 2 entries shown
  stacked directly underneath; tapping History opens the full list (up
  to 50 entries) in a popup. Replaces the swipe rail entirely.

**Sabaq-specific: page count is now a fixed-standard capacity measure**,
not a real-page lookup — always divides by 13 lines/page and rounds
down to the nearest quarter-page (20 lines → 1.538 → 1.5), regardless of
mushaf print or which real pages were actually touched. Confirmed in
chat: this is a volume/capacity measure, not a progress tracker, so it
doesn't need real per-print page data at all — just the line count
(still computed properly per-print) divided by that constant.

**Phase 2a — Sabaq Dhor's rollup mechanism.** New `computeSabaqDhorRows`
(`js/position.js`) builds the actual displayable rows: the current,
still-in-progress quarter is always its own row and never rollable
(confirmed: only already-finished units can merge); completed quarters
can be rolled up via a chevron — 1+2 into "First Half", 3+4 into "Second
Half" (fixed pairing), both halves into "Full Juz'" — and back down
again. The rollup level is persisted per student
(`position.sabaqDhorRollup`) so it sticks across sessions. Tested 3
scenarios before shipping: an unmergeable lone completed quarter (its
partner not done yet), a clean half-merge, and the "nothing complete
yet" case (just the current row, chevron a no-op).

Each row also carries a `canMoveToDhor` flag (true for halves and full
juz', never a lone quarter) — this delivery doesn't act on it. The
actual move-to-Dhor transition (tickbox + auto-trigger) is Phase 2b, a
separate delivery once this mechanism itself is confirmed working.

**Files changed (cumulative — includes everything from V3.14.0 onward,
none previously uploaded):**
```
index.html
sw.js
shared/data.js
css/detail-pages.css
js/sabaqPage.js
js/position.js
js/dhorPage.js
js/sabaqDhorPage.js
js/commentPrivacy.js
js/reflectionCard.js
js/logDetailScreen.js
js/settingsScreen.js
worker/src/sabaqLog.js
worker/src/dhorSchedule.js
SCHEMA.md
CONVENTIONS.md
CHANGELOG.md
TESTING.md
```
**New files (cumulative):**
```
worker/migrations/0015_sabaq_from_to.sql
```



Bismillah. Foundational piece both Phase 2b (Sabaq Dhor's move-to-Dhor)
and Phase 3 (Setup's baseline marking) depend on, built first on its own
rather than duplicated inside each.

**`baseline_selection` now stores quarter-unit IDs (1-120), not whole
juz' numbers**, for `baseline_mode='juz'`. A juz' is always exactly 4
quarters, and Dhor's own "Portion per session" setting already only
ever works in quarter/half/full-juz' sizes — so representing the
eligibility pool at quarter granularity (the finest of those) means a
juz' can now be *partially* eligible, e.g. just its first half, which
there was previously no way to represent at all. `shared/data.js` gained
`quarterUnitId`/`quarterUnitToJuzQuarter`/`quarterUnitsForJuz`/
`quarterUnitsForHalf` for converting between a flat unit ID and its
juz'/quarter, print-independent (the logical quarter position is the
same across mushafs; only exact ayah boundaries differ by ref, resolved
separately).

**`dhorSchedule.js`'s chunk-builder reworked** to consume this flat pool
directly — groups *consecutive* quarter-unit IDs into session-sized
chunks (1/2/4 quarter-units per session, matching the granularity
setting), respecting gaps rather than assuming a whole juz' is always
available. Verified with 5 scenarios before shipping, including a pool
with a real gap (a juz' with only its first half eligible, second half
not) — chunking correctly treats that as its own group rather than
bridging into where the missing half would be.

**Setup's Juz' grid** still shows/marks whole juz' (unchanged UI) — it
now expands each marked juz' to its 4 quarter-unit IDs on save, and
shows a juz' as checked on reopen only when all 4 are already present.
Tested the full round-trip (mark → store → reopen → still shows
correctly, including a partially-covered juz' correctly NOT showing as
checked) before finalizing. Surah mode is untouched — still stores surah
numbers directly, and `dhorSchedule.js` already refuses to generate
anything for surah-based baselines, so it can't collide with the new
quarter-unit interpretation.

**Files changed:**
```
shared/data.js
worker/src/dhorSchedule.js
js/settingsScreen.js
SCHEMA.md
CHANGELOG.md
```



Bismillah. Small, contained fix while Phase 2 gets its own proper attention.

Found a real CSS bug from the screenshot: `.detail-page input`'s general `width:100%` rule was beating `.verse-ref-ayah`'s own `width:70px` on specificity (0,1,1 vs 0,1,0), which is exactly why the ayah box was stretching to fill the row instead of staying compact. Fixed by giving it a more specific selector and shrinking it further (46px, enough for 3 digits plus the browser's own spinner), freeing that space back to the surah name. Also removed the header row's ability to wrap — Save was dropping to its own second line on narrow widths because the date field plus everything else didn't quite fit on one row; the date field is now more compact too, so all of icon/title/date/Save fit on the same first row on every card.

**Files changed:**
```
index.html
sw.js
css/detail-pages.css
CHANGELOG.md
```



Bismillah. First of a new 4-phase plan replacing V3.12.0/V3.13.0's Sabaq/
Sabaq Dhor design, once it became clear a sabaq entry isn't confined to
one surah or one juz' the way that design assumed.

**`sabaq_from`/`sabaq_to`** (migration 0015) replace `surah`/`ayah_from`/
`ayah_to` entirely — a clean removal (both columns dropped, not left
deprecated-in-place, per explicit request), not just a rename: the old
trio had one surah shared by both ayah numbers, which couldn't represent
an entry spanning two different surahs at all. Each field is now a
`"surah:ayah"` string (e.g. `"114:6"`), and `sabaq_from`/`sabaq_to` can
each name a different surah. Confirmed scope: no limit on how many
surahs an entry spans, capped at crossing at most one juz' boundary
(`shared/data.js`'s new `crossesAtMostOneJuzBoundary`, which checks
adjacency in *study* order — juz' 29→1 counts as one boundary same as
29→30, even though those aren't numerically next to each other).

**UI**: each field is one combined control — a chevron opens the full
surah picker, the ayah itself is a bounded number input (browser stepper
or the numeric keypad), never rolling over into the next surah on its
own (confirmed: only the chevron changes the surah).

**Prepopulation**, replacing the old advance-by-one-ayah logic: any Dhor
history at all → neither field prepopulates; no Sabaq history yet →
114:1/114:6; otherwise the last reached point prefills *To* if currently
in juz' 30 (studied backwards) or *From* otherwise (studied forwards).
Tested directly, not just reasoned through: brand-new student → 114:1/
114:6; after logging into juz' 30's content → next open prefills To with
the frontier; after crossing into juz' 29 → next open prefills From
instead.

**Line/page calc now sums across every surah a span touches** — the
existing `getLines13/15ForAyahRange` functions still only understand one
surah each; new `getLinesForSpan` walks every surah between `sabaq_from`
and `sabaq_to` (handling juz' 30's reversed, high-to-low surah order,
not just ascending) and adds them up. Caught and fixed a real bug here
before shipping: the first version's surah loop assumed `from ≤ to`
numerically, which silently returned zero for any juz'-30-direction
span — re-verified with both directions before finalizing.

**Position tracking simplified**: `position_json` is now just
`{ sabaqTo, activeJuz }` — `sabaqTo` is the single source of truth,
`activeJuz` is derived from it after every save. The V3.12.0 behaviour
of auto-adding a completed juz' to Hifz Setup's `baseline_selection` is
REMOVED — that's superseded, now Setup's own job (a separate, later
phase). Sabaq Dhor's card (`sabaqDhorPage.js`) is untouched in this
delivery and keeps working exactly as before against this same position
shape — its own rebuild (rollable quarter/half/juz' sections) is Phase 2.

**Files changed:**
```
index.html
sw.js
shared/data.js
css/detail-pages.css
js/sabaqPage.js
js/position.js
js/dhorPage.js
worker/src/sabaqLog.js
SCHEMA.md
CONVENTIONS.md
CHANGELOG.md
TESTING.md
```
**New file:**
```
worker/migrations/0015_sabaq_from_to.sql
```



Bismillah. Second of the 3-part detail-screen delivery (V3.12.0 was
position tracking + Sabaq; this is Sabaq Dhor, which depends on that
landing first; the Dhor card's planner/timer-popup work is still ahead).

**Sabaq Dhor is now genuinely position-driven.** Confirmed definition:
it's revision of the CURRENT juz' (whichever one Sabaq is presently
learning) from that juz's start up to wherever Sabaq has actually
reached, excluding today's brand-new portion — replacing the earlier
"beginning of Quran / halfway point" rule entirely. Shown as a checklist:
the quarter Sabaq is currently partway through is one section, and each
quarter before it that's already fully covered is its own section too —
at most 3 of those, since a juz' only has 4 quarters and the 4th-
equivalent one is always the one currently in progress. Every section
comes prepopulated checked (these are derived from what's actually been
memorised); the student unchecks anything they didn't actually revise
today. Whichever stay checked get composited into one overall from/to
ayah range at save time.

**The juz' 30 direction problem, solved and tested.** Juz' 30 is studied
backwards (114→78) — its quarters, structurally numbered in the normal
ascending direction, don't line up with the order Sabaq actually walks
through them. New in `shared/data.js`: `studyQuarterIndex()` (its own
inverse — reverses for juz' 30, leaves everything else unchanged),
`structuralQuarterOf()`, and `structuralQuarterBounds()`, all built
specifically to get this right rather than assume every juz' behaves
like the other 29. Verified with real numbers before shipping: a
frontier at 90:5 with `activeJuz: 30` correctly produces a *complete*
section for 98:1-114:6 (study quarter 1) and a *current, partial*
section for 89:1-90:5 (study quarter 2) — matching the actual reversed
study order, not the structural one.

Migration 0014 adds `sabaq_dhor_log.from_surah/from_ayah/to_surah/
to_ayah`; the old free-text `zone` column stays in the table (unused
going forward) rather than being dropped.

**Files changed:**
```
index.html
sw.js
shared/data.js
css/detail-pages.css
js/sabaqDhorPage.js
js/dhorPage.js
js/position.js
worker/src/sabaqDhorLog.js
SCHEMA.md
CONVENTIONS.md
CHANGELOG.md
TESTING.md
```
**New file:**
```
worker/migrations/0014_sabaq_dhor_ayah_range.sql
```



Bismillah. First of a 3-part delivery for the detail-screen redesign
(Sabaq Dhor's checkable-quarters and the Dhor card's planner/timer-popup
work are separate, later deliveries — each depends on this one landing
first).

**Position tracking, wired in for the first time.** The `position` table
and its Worker endpoints already existed (built earlier, never called
from anywhere) — this delivery is what actually uses them. Shape:
`{ activeJuz, sabaqFrontier: {surah, ayah} | null }`. New in
`shared/data.js`: `SABAQ_STUDY_ORDER` (30 first backwards through its
surahs 114→78, then 29 forwards, then 1-28 ascending — the "1 or 28"
branch noted elsewhere picks 1 as the simpler deterministic default,
flagged rather than guessed at silently) and the position-math helpers
built on it. New `js/position.js` orchestrates it client-side, per the
Worker's own "computed client-side" design note.

**Sabaq card**, rebuilt around that position: prepopulates surah/
ayah_from from wherever Sabaq last reached (a brand-new student starts at
114:1); ayah references shown as surah:ayah numerals, never surah names;
`line_count`/`page_count` auto-compute once `ayah_to` is entered
(`getLines13ForAyahRange`/`getLines15ForAyahRange`, built in V3.9.1/
V3.9.4, sitting unused until now) and are shown editable, since the
underlying figures are estimates worth letting a student correct; on
save, position advances, and if that completes the current juz', it's
folded into Hifz Setup's `baseline_selection` automatically — confirmed
in chat, no manual Juz' grid check-off needed. Migration 0013 adds
`line_count`/`page_count` to `sabaq_log` (no inline trailing comments —
the exact bug that broke two earlier migrations).

Every position-math function was tested end to end before this shipped —
new student → 114:1; sabaqing to 114:6 → next default 113:1; finishing
all of juz' 30 → `completedJuz: 30`, next default 67:1 (start of juz' 29)
— not just reasoned through, actually run.

**All 4 detail cards** (Sabaq/Sabaq Dhor/Dhor/Tadabbur):
- Header row now holds an icon (display-only), the title, the date field
  (moved here from its own row), and an icon+label Save button — the old
  bottom-of-card Save button is gone.
- Cards capped at `max-width: 30%` on desktop (design target: a 13"
  monitor as the practical maximum, not an ultra-wide external display);
  with all 4 visible the grid already computes ~25% each on its own.
- Tajweed picker is now a compact trigger button opening a popup with a
  checkbox per tag (was an inline row of toggle buttons) — multi-select
  doesn't fit a scroll-wheel or a plain dropdown.
- The comment block's "Your comment on this session" is now "Notes",
  and its privacy checkbox is now a genuine Private/Public switch
  (default Public) — the "keep hidden from teachers" text is gone.
  Tadabbur's own privacy control gets the same switch treatment.
- Swipe dots now show text labels (Sabaq/SDhor/Dhor/Tadabbur) and sit
  above the rail, not below it as plain circles.

The switch component itself moved out of `settingsScreen.js` into a new
`js/uiSwitch.js` (loads early) so `commentPrivacy.js`/`reflectionCard.js`
could use the same one rather than duplicating it.

**Files changed:**
```
index.html
sw.js
shared/data.js
css/detail-pages.css
js/sabaqPage.js
js/commentPrivacy.js
js/tajweed.js
js/reflectionCard.js
js/logDetailScreen.js
js/dhorPage.js
js/settingsScreen.js
worker/src/sabaqLog.js
SCHEMA.md
CONVENTIONS.md
CHANGELOG.md
TESTING.md
```
**New files:**
```
js/position.js
js/uiSwitch.js
worker/migrations/0013_sabaq_line_page_count.sql
```



Bismillah. Everything from the last few rounds of feedback on V3.10.0,
plus one new feature (Tomorrow's Portion) that needed real backend work.

**Text and layout:**
- Gender moved onto the Name row itself as a small inline switch (was
  its own full-width row further down the page).
- Mushaf's 13-line and 15-line options now have explanatory hints too
  (Hybrid already had one): "13-line IndoPak/Waterval." and "15 Line
  Uthmani script."
- "Mark completed sections" → "Mark completed sections using".
- "Default targets" → "Target for Dhor", styled as a proper header
  (darker, heavier) rather than a plain field label.
- "Dhor Schedule" → "Dhor Plan", everywhere (heading text; the
  underlying section id/element ids are unchanged, this is a display
  rename only).
- `inputmode="numeric"` added to every numeric field (the 3 Dhor
  targets, portion quantity, haidh cycle length and duration) — a
  plain number pad on mobile instead of the full keyboard.

**Correction:** the Juz'/Surah switch now always springs back to
neutral once its popup closes, regardless of what was picked inside.
V3.10.0 had it slide to reflect `baselineMode` instead and stay there —
that's what's fixed here. Tapping either side still always opens its
grid no matter where the thumb currently sits.

**New: Tomorrow's Portion.** A row added after Days of week — date is
always tomorrow, the portion is the student's own choice from a
dropdown built out of their memorised (baseline) juz', broken into
individual units at whichever granularity is currently selected above
(e.g. quarters: `Q-Juz-1-1` through the last unit of the last memorised
juz'). Picking one and saving passes it straight through to
`dhorSchedule.js`'s generator as an explicit starting point for that one
generation call only — every other call (routine top-ups from the Dhor
log page, or a later Setup save with nothing picked) is untouched and
keeps the existing auto-detect-from-history behaviour, so this can
never silently reset a rotation that's already progressing.

Naming, confirmed and tested against the actual segment math before
shipping:
- 13-line/Hybrid: `Juz-N` whole, `H-Juz-N-1`/`H-Juz-N-2` halves,
  `Q-Juz-N-1`..`Q-Juz-N-4` quarters.
- 15-line: `Juz-N` whole; `Hizb-N` for halves, numbered *globally*
  across the whole Quran (1-60) rather than per-juz' — a global hizb
  number is already unambiguous on its own, unlike a 13-line "half"
  which has no name of its own to fall back on; `Rub-N-P` for quarters,
  per-juz' (this is the print's true quarter-of-a-juz' unit — the
  project's existing `RUB_BOUNDARIES.uthmani` array is actually
  Maqra-level granularity, 8/juz', not Rub'; `QUARTER_BOUNDARIES_UTHMANI`
  from V3.9.1, 4/juz', is the one that's genuinely Rub'-level, and is
  what this actually reads from).

The dropdown's list and the generator's own chunk sequence are built
from the same underlying math (`segmentRangeForUnitIndex` /
`buildChunks`'s single-unit case) so a picked label always corresponds
to exactly what the rotation would produce on its own.

**Files changed:**
```
index.html
sw.js
css/settings.css
js/settingsScreen.js
worker/src/dhorSchedule.js
js/api.js
CHANGELOG.md
TESTING.md
```



Bismillah. Two things in one delivery, confirmed to go together: Hybrid
becomes a real, selectable mushaf option, and every plain either/or
control across Setup and Dhor Schedule becomes a genuine switch instead
of a button pair.

**Hybrid mushaf:** enabled in Setup (was shown-but-disabled since
V3.7.0). One rule, applied everywhere a `ref` gets derived from a
student's mushaf: page/line math always follows 15-line data for a
Hybrid account, quarter/half/juz' math always follows 13-line rules —
same as a plain 13-line account, never the 15-line print's own
rub'/hizb/juz' system. `worker/src/dhorSchedule.js` already fell through
to `waterval` for anything that wasn't `15line_madani`, so Hybrid needed
no new branch there — just enabling the value in `profile.js`'s
validation and the Setup UI.

**Dhor log page's reference dropdown is gone.** It used to be a separate
per-device `localStorage` setting, independent of the student's actual
mushaf choice — that inconsistency is why Hybrid couldn't have worked
cleanly before. Now `ref` is derived from `profile.mushaf` fresh on every
open, the same rule as above, for every student — not just Hybrid ones.

**Switch redesign**, all in Setup + Dhor Schedule:
- Gender, mushaf (3-way, with an explanatory line under it for Hybrid),
  Dhor Schedule's portion-granularity (3-way) and frequency (2-way) are
  now genuine switches — one rounded track, a sliding highlighted thumb
  — replacing the button-pair look those fields used before.
- "Mark completed sections" (Juz'/Surah) is a switch too, but with a
  neutral center: tapping either side always opens its slide-in grid
  regardless of where the thumb currently sits; the thumb only reflects
  which mode is actually set, resting muted in the middle if nothing's
  been marked yet. A plain 2-way switch doesn't fit here, since tapping
  opens a tool rather than flipping a persistent state.
- Default targets and Haidh's 3 fields are now one row each, label on
  the left, input on the right, instead of stacked. "Frequency (days)"
  is renamed "Revision cycle time (days)".
- Dhor Schedule's portion-per-session row now has the quantity number
  first (left), the granularity switch after it (right) — reversed
  from the original order.
- Days-of-week is now forced onto one line at every width (was allowed
  to wrap) — more compact per-button padding, no change to the 7-day
  multi-select behavior itself.
- Surah grid (the slide-in from "Mark completed sections") is now 3
  columns instead of 2, as a trial — easy to revert if it doesn't read
  well in practice.

The generic switch component (`renderSwitch()`/`wireSwitch()` in
`settingsScreen.js`, `.switch-track`/`.switch-option`/`.switch-thumb` in
`settings.css`) handles 2-way, 3-way, and the neutral-center variant with
the same code — none of it needed a special case per switch, just
however many slots a given track has.

**Files changed:**
```
index.html
sw.js
css/settings.css
js/settingsScreen.js
js/dhorPage.js
worker/src/profile.js
worker/src/dhorSchedule.js
CONVENTIONS.md
CHANGELOG.md
TESTING.md
```



Bismillah. Closes the other half of the sabaq line-count gap —
`getLines13ForAyahRange` had no 15-line counterpart until now.

`AYAH_LINE_UTHMANI` in `shared/data.js`: `[surah, ayah, page, startLine,
endLine]` for all 6236 ayahs, sourced from the Quran.com API's own
word-level `line_number` field (via the user's `Generate_Quran_Mapping.py`,
run locally since this sandbox can't reach that host). Verified before
use: page assignment matches `quranmeta.json`'s independently-sourced
page field at all 6236 ayahs — 0 mismatches. Genuinely per-page line
data too, not another disguised running index: line numbers reset per
page and cap at 15 (matching the print's name), and behave the way real
typesetting does — e.g. Al-Fatiha's ayahs 3 and 4 share one line, ayah 7
spans three.

`getLines15ForAyahRange(surah, ayahFrom, ayahTo)` reads this directly —
no word-ID lookup step needed the way the 13-line version requires,
since this data is already at the same per-ayah granularity `sabaq_log`
itself stores (surah/ayah_from/ayah_to). Handles same-page and
multi-page spans, using each page's *actual* line count
(`PAGE_MAX_LINE_UTHMANI`, derived from the data itself — page 1 only
uses 8 of its 15 lines, so a hardcoded 15-per-page assumption would have
been wrong there).

Unlike the 13-line figure, this one isn't flagged as an approximation —
the underlying per-ayah positions are the real thing.

Not done in this delivery, by design: wiring either line-count function
into any UI (sabaq entries don't display one yet — same "built, not yet
wired up" state `getLines13ForAyahRange` has been in all along).

**Files changed:**
```
shared/data.js
SCHEMA.md
CONVENTIONS.md
CHANGELOG.md
```



Bismillah. `PRAGMA table_info(students)` on production showed exactly 4
of migration 0011's 7 new columns present — all 4 from the Dhor Schedule
section (`dhor_granularity`, `dhor_quantity`, `dhor_frequency`,
`dhor_days_of_week`), none from the Haidh section
(`haidh_cycle_length`, `haidh_period_length`, `haidh_next_expected`).

Honest note: this doesn't fully match the "inline trailing comment"
theory from V3.9.2 — two of the four columns that *did* apply
(`dhor_quantity`, `dhor_days_of_week`) had that exact issue too, so
something else caused execution to stop specifically before the Haidh
section, not addressed by that fix alone. Not chasing the exact
mechanism further right now — the priority is getting production
working again.

New migration 0012 adds only the 3 still-missing columns, kept
deliberately bare (no comments, plain ASCII only, nothing beyond the
3 statements) to remove any further risk. Do not re-run 0011 — the
4 columns it already added would now fail as duplicates.

**Files changed:**
```
CHANGELOG.md
```
**New file:**
```
worker/migrations/0012_haidh_settings_retry.sql
```



Bismillah. Migration 0011 had inline trailing comments after a semicolon
on 3 lines (`dhor_quantity`, `dhor_days_of_week`, `haidh_next_expected`) —
the exact pattern that broke migration 0010's runner before (see that
entry). Same mistake, repeated, despite it already being a documented
gotcha — should have caught this before shipping V3.9.1.

If that migration didn't fully apply as a result, `profile.js`'s GET/POST
handlers would be selecting/updating columns that don't exist yet on the
live `students` table, which fails at the database level — a very likely
explanation for a 500 right after login, since `/profile` is the first
thing called post-login to route to Setup or Journal.

Every comment in the migration is now on its own line; none share a line
with a SQL statement. Re-run this corrected file against production D1,
then retest login.

**Files changed:**
```
worker/migrations/0011_dhor_schedule_and_haidh_settings.sql
CHANGELOG.md
```



Bismillah. Closes the surah-baseline gap flagged in V3.9.0, one layer at a
time — this delivery is the verified reference data itself; wiring it into
Dhor Schedule generation (to let a surah-based Hifz Setup baseline drive it,
not just a juz'-based one) is a natural next step, not done here.

**Resolved this session, all in `shared/data.js`:**
- `JUZ_BOUNDARIES` — confirmed to be the 13-line print's own boundaries
  specifically, not a print-independent average as the code previously
  (incorrectly) commented.
- `JUZ_BOUNDARIES_UTHMANI` (new) — the 15-line Madani print's own 30 juz'
  boundaries, derived from `RUB_BOUNDARIES.uthmani`'s every-8th marker.
  Verified against all 30 — differs from the 13-line boundaries at exactly
  one point, juz' 4 (13-line: 3:92, 15-line: 3:93).
- `getJuzForPosition`/`juzStartSurah`/`getJuzSurahSpan` are now ref-aware
  (optional `ref` param, defaulting to 13-line for existing callers).
- `HALF_BOUNDARIES.waterval`/`.uthmani` and `QUARTER_BOUNDARIES_UTHMANI`
  (new) — half- and quarter-juz' boundaries for both prints (13-line
  quarters are `RUB_BOUNDARIES.waterval` itself, already fine-grained
  enough; no separate array needed there). The 15-line print's own eighth-
  of-juz' breakdown is `RUB_BOUNDARIES.uthmani` as-is.
- `SURAH_JUZ_RANGE`/`getSurahJuzRange()` (new) — which juz' each surah
  touches. Verified identical for both prints across all 114 surahs (the
  one ayah-level difference doesn't change which surahs touch which juz'),
  so one shared table covers both.
- Corrected a stale code comment that had claimed `RUB_BOUNDARIES.waterval`
  diverges from `JUZ_BOUNDARIES` at 6 points "due to a real print
  variation" — re-verified properly (the original check didn't handle
  surah rollover) and it's 5 points (juz' 7,14,20,21,23), and since both
  are confirmed 13-line, it looks like residual imprecision in that source
  rather than a genuine print difference. Flagged in the comment, not
  silently corrected — there's no more-authoritative source to fix it
  against.

**Caught in my own review before this shipped**: my first pass at writing
the derived arrays into the file had transcription errors (wrong lengths on
3 of them). Re-derived everything programmatically from the source data and
cross-checked lengths and internal consistency (e.g. every 2nd quarter-
boundary entry must equal the corresponding half-boundary entry) before
finalizing — worth knowing this class of mistake is possible, and worth the
same check on any future hand-edit of these tables.

**Files changed:**
```
shared/data.js
SCHEMA.md
CONVENTIONS.md
CHANGELOG.md
```



Bismillah. The Setup screen is no longer 2 swipeable cards — it's one
continuous page with 4 independently-saved sections: Profile, Hifz Setup
(both carried over, reshaped), and two entirely new ones, Dhor Schedule and
Haidh. Neither gets its own nav item: both live permanently inside Setup,
reachable via "Settings" at any time, not just during onboarding. The old
"Plans" nav placeholder is gone entirely as a result.

**Profile / Hifz Setup, reshaped:**
- Gender is now two exclusive toggle buttons (matching the mushaf/
  granularity pickers' look) instead of a `<select>` — same M/F values
  underneath, no backend change.
- "Mark completed sections" (the old Surahs/Juz' baseline picker) is now
  two buttons — Juz' and Surah — that each open a full slide-in grid
  overlay (30 cells / 114 cells, scrollable) instead of one inline area
  that swapped content on a mode toggle. Still mutually exclusive:
  confirming a selection in one clears the other. The overlay's close icon
  commits the selection into the section's pending state, same as any
  other field here — it does not save to the server by itself; the Hifz
  Setup section's own Save button still does that, so this doesn't behave
  differently from every other field on the page.
- Default targets (mistakes/minutes/frequency per juz') are unchanged.

**Dhor Schedule (new):** a settings form, no visible table — students pick
a portion size (Juz'/Half/Quarter, plus how many per session), a frequency
(Daily/Twice a day), and which days of the week. Saving drives a rolling
7-day plan generated behind the scenes (`worker/src/dhorSchedule.js`,
called on-demand — Setup save, and whenever the Dhor log page opens — never
a background job). Plan rows land in the existing `plans` table
(`plan_type='dhor'`), which already had full CRUD and completion-linking
built (V2/V3 schema) — nothing new needed there.

Generation walks the student's memorised juz' pool (from Hifz Setup's
`baseline_mode`/`baseline_selection`) in plain ascending order, never
letting one session's segment span across a gap between non-adjacent
memorised juz' (the normal early-stage pattern — e.g. juz' 30, 29, 1
memorised but not 2-28 yet). It anchors to whichever is further along in
that sequence — the last actually-logged `dhor_log` entry, or the last
existing plan row — so logged reality overrides a stale unfulfilled plan,
while an already-generated future plan never gets silently reassigned a
different portion on a later call.

Haidh interaction (confirmed in chat): no dhor is generated on a haidh or
predicted-haidh day — that date is skipped and the window extends outward
to make up the session, rather than losing it. Days not in the chosen
weekday set are just normal off days, not made up.

**Scope note, flagged rather than silently approximated**: generation
currently requires `baseline_mode = 'juz'` (a surah-based baseline isn't
mapped to juz' coverage yet — that needs real ayah-boundary math, a
separate piece of work) and uses plain ascending juz' order, not the
branching "30, then 29, then 1-or-28, then the rest" study order noted
elsewhere for initial memorisation — that branching depends on a
per-student choice this project doesn't store anywhere yet. Both cases
return a clear reason rather than generating something wrong.

**Haidh (new):** also a settings form, no visible calendar — cycle length,
duration, and next expected haidh day. Shown only when gender is F, live
off the gender picker (not just on reload). This reuses the existing
`/attendance/predict` endpoint (`worker/src/attendance.js`, unchanged,
live since migration 0001) entirely as-is — the `attendance` table already
has `predicted-haidh` as a status, and predictions already never overwrite
real data. The only genuinely new work is the Setup UI itself, plus one
small reconciliation: Setup asks for "next expected day" (the more
intuitive input), and the frontend computes that endpoint's own `lastStart`
param from it (`lastStart = next_expected − cycle_length`) — so the backend
needed no changes for this at all.

**Dhor log page and journal quick-add now use plans, not just link them:**
- `dhorPage.js` fetches today's Dhor plan(s) on open. Zero: unchanged manual
  picker. One: every field pre-fills from it, and saving links back to it
  (existing `plan_id` handling in `logHelpers.js`, unchanged). More than
  one: a plain selector, never auto-picked.
- The journal's quick-add cells previously showed a "planned" indicator and
  passed `plan_id` through on save, but never pre-filled the form's actual
  values — tapping one still opened a blank form. Now fixed for `sabaq` and
  `dhor` (whose plan fields map directly onto their quick-add fields).
  `sabaq_dhor` is not pre-filled: its plan rows store `surah`/`ayah_from`/
  `ayah_to` (matching `sabaq`), but the log itself needs a computed `zone`
  string that isn't wired into the frontend yet (same gap already flagged
  in `sabaqDhorPage.js`) — left manual rather than guessed at.

**Also (small, root-cause fix):** the Dhor segment/granularity math
(`segmentsPerJuz`/`unitMarkerCount`) used to be a `dhorPage.js`-local copy.
Moved to `shared/data.js` (already dual-loaded by frontend and Worker) since
`dhorSchedule.js` needs the exact same math server-side — two copies is
exactly what `CONVENTIONS.md` principle 2 exists to prevent.

**Files changed:**
```
index.html
sw.js
css/settings.css
js/api.js
js/app.js
js/auth.js
js/dhorPage.js
js/icons.js
js/journal.js
js/settingsScreen.js
shared/data.js
worker/src/index.js
worker/src/profile.js
SCHEMA.md
CONVENTIONS.md
CHANGELOG.md
TESTING.md
```
**New files:**
```
worker/migrations/0011_dhor_schedule_and_haidh_settings.sql
worker/src/dhorSchedule.js
```

**Retest before merging to `main`**: `TESTING.md` §23, especially the
juz'-gap generation case (a pool like {1, 29, 30}) and the haidh-shifts-the-
window case — both are the kind of thing that looks fine with a small,
contiguous test pool and only shows a problem with a real, gappy one.



Bismillah. Corrects the remaining iPhone-specific gap in V3.8.1: a newly
installed Home Screen app now opens the student's personal `/<uniqueID>` URL
on its very first launch, so the PIN-only screen appears without requiring a
one-time ID entry inside the standalone app.

**Why V3.8.1 was incomplete on iPhone**: iOS Home Screen web apps have cookies
and storage separate from Safari. The ID saved while using the personal page
in Safari therefore was not available inside a newly-created standalone app.
Worse, the shared manifest's `start_url: "/"` explicitly discarded the
personal path during installation, leaving the new app with no possible way
to know which student it belonged to. The fallback screen in the reported
screenshot was therefore the expected result of those two platform rules.

**Apple-mobile installation path**: new `js/pwaManifest.js` detects iPhone,
iPad, iPod, and iPadOS desktop-mode user agents. On those devices it omits the
shared Web App Manifest link, allowing Add to Home Screen to save the exact
current page URL. The existing Apple standalone meta tags and touch icon stay
in place, so the installed experience remains full-screen and branded. Every
other platform still receives `manifest.json`, preserving the normal Chrome/
Android PWA installation route.

**Defence in depth retained**: V3.8.1's remembered-ID behavior remains. It is
still useful after a fallback login, for existing installations, and on
platforms whose installed app shares origin storage. PINs are never stored and
the authentication token remains session-only.

**Required once for existing iPhone installations**: the old Home Screen icon
has already saved `/` as its launch target. Page code cannot rewrite that
installed shortcut. Delete that icon, open the personal `/<uniqueID>` URL in
Safari, and use **Add to Home Screen** again after V3.8.2 is deployed. Future
launches from the replacement icon start on the PIN-only personal screen.

No Worker, D1 schema, or migration changes are needed.

**Files changed:**
```
index.html
sw.js
CHANGELOG.md
TESTING.md
```
**New file:**
```
js/pwaManifest.js
```

**Retest before merging to `main`**: `TESTING.md` §22 on a real iPhone,
including deleting the old icon and reinstalling from a valid personal URL.

## V3.8.1 — home-screen PIN-only return login (2026-07-28)

Bismillah. Installed home-screen launches now remember which journal belongs
to that device, so a returning student enters only their PIN rather than the
unique ID and PIN every time.

**Root cause corrected**: the manifest always launched the installed PWA at
`/index.html`, while the personalized login could only obtain an ID from a
`/<uniqueID>` path. That made every home-screen launch fall through to the
generic ID+PIN screen even after a successful login.

**Remembered device identity**: a successful login now saves only the unique
ID in `localStorage` (`hh_login_id`). The PIN is never stored, and the auth
token remains in `sessionStorage`, so closing the app still requires a fresh
PIN. Opening a personal `/<uniqueID>` link takes priority over the remembered
ID and does not replace it unless that new account successfully logs in.
An already-open authenticated V3.8.0 session is upgraded too: its verified
profile ID is remembered as soon as the new frontend loads.

**Routing and account safety**: `/` and `/index.html` are both treated as
neutral launch paths, covering new installs and already-installed icons that
may retain the old URL. After a remembered-ID lookup succeeds the address is
canonicalized back to the personal URL. `bootApp()` uses the same effective-ID
rule, preserving the V3.4.2 cross-account guard without treating `index.html`
as if it were a student ID. The PIN/create-PIN screens now include **Use
another ID**, which forgets the device association and returns to the generic
sign-in screen; ordinary Log out intentionally keeps the remembered ID.

**Manifest**: `start_url` is now `/`, with an explicit `/` scope. No Worker,
D1 schema, or migration changes are needed.

**Files changed:**
```
manifest.json
index.html
js/api.js
js/auth.js
js/app.js
sw.js
CHANGELOG.md
TESTING.md
```

**Retest before merging to `main`**: `TESTING.md` §21, especially both `/`
and `/index.html` launches on an already-installed mobile home-screen app.

## V3.8.0 — top-paint fix generalized + Hifz Setup (2026-07-27)

Bismillah. Two pieces: a permanent fix for the "invisible until scroll"
bug (queued as a finding, now actioned), and the full Hifz Setup card
(history baseline + default targets), turning the Setup screen into 2
cards.

**Top-paint fix, generalized**: `fixJournalTopPaint()` — hardcoded to only
ever correct `#screen-journal` — is now `fixScreenTopPaint(screenId)`,
called unconditionally at the end of `showScreen()` for whichever screen
is actually showing (including the "not built yet" placeholder). This is
why Setup had the identical symptom: the original fix simply never ran
for any screen besides journal. No future new screen can reintroduce this
gap now, since nothing needs to remember to wire it in again.

**Setup restructured into 2 cards**, matching the unified day-log view's
grid/rail pattern (V3.6.1) — row/grid on larger screens, swipeable rail
on mobile, dot indicators, Sky (`#D0DBE7`) background on both:
- **Profile** — the existing view-only header + journal name + gender,
  unchanged in content, just its own card now, with its own save icon.
- **Hifz Setup** — mushaf (existing picker, moved here from Profile) →
  history (pick Surahs or Juz' — exclusive choice, switching discards the
  other's selection; the matching grid slides in; multiple items ARE
  selectable within whichever mode is active) → default targets
  (mistakes/juz', minutes/juz', frequency in days — pre-filled with 2/40/30).
  Its own independent save icon, separate from Profile's.

**Backend**: migration 0010 adds `baseline_mode`, `baseline_selection`
(JSON array, stored as text), `target_mistakes_per_juz`,
`target_minutes_per_juz`, `target_frequency_days` to `students`.
`profile.js` extended accordingly, with validation on each new field.
Deliberately NOT integrated with `position_json`'s `activeJuz`/`studyOrder`
yet — the baseline is a one-time self-reported fact, not derived progress
state, and that deeper integration is real follow-up work for whenever the
rings feature (which also reads `position`) actually gets built.

**Deliberately unchanged**: saving either card sets `setup_complete`, so
completing just one card is enough to stop being routed back to Setup —
neither card is required to unlock the other.

**Files changed:**
```
index.html
js/app.js
js/icons.js
css/settings.css
worker/src/profile.js
SCHEMA.md
sw.js
```
**New files:**
```
js/settingsScreen.js (full rewrite, not additive)
worker/migrations/0010_history_baseline_targets.sql
```

**Retest before merging to `main`**: `TESTING.md` §20. Migration 0010
needs to actually be applied to D1 before the Hifz Setup card's new
fields will save.

---

## V3.7.1 — Setup screen: sizing fix + save icon (2026-07-27)

Bismillah. Both findings documented against V3.7.0, now actioned.

**Desktop container width**: `--width-desktop` (tokens.css) bumped 25% →
30%. Separately, `#screen-settings` never actually had the width-cap rule
that `.login-card`/`#screen-admin` already carry — it's a single-container
form, same category as those two, and should have had this from the start.
Added the same `max-width: var(--width-tablet)` (768–1179px) /
`max-width: var(--width-desktop)` (≥1180px) rule, mirroring their exact
pattern. Both pieces were needed together — the token bump alone wouldn't
have fixed the reported stretching, since the screen was never wired into
the system in the first place.

**Save icon**: the Setup screen's bottom-of-form text "Save" button moved
to an icon-only button on the right of the header row, next to the "Setup"
title — icon-over-button preference (already on file, reiterated for this
screen specifically). New `save` icon added to `icons.js`, converted from
the uploaded `save.svg` to match this file's existing format; stroke-width
normalized to `1.8` to match most of the current set (the source file used
`1`), same normalization already applied to `home.svg` in the same round
of uploads.

**Explicitly out of scope for this delivery**: the broader icons-folder
migration (item 5 from the nav/icon restructuring discussion) — still a
separate, not-yet-fully-scoped delivery (`close.svg`'s intended use is
still unconfirmed, among other things). This delivery only actions the
two specific V3.7.0 findings.

**Files changed:**
```
index.html
css/tokens.css
css/settings.css
js/icons.js
js/settingsScreen.js
sw.js
```

**Retest before merging to `main`**: `TESTING.md` §19.

---

## V3.7.0 — Setup screen: profile section (2026-07-27)

Bismillah. First piece of the bigger 4-area onboarding design discussed in
chat (profile, history+targets, Dhor planning, haidh tracking) — deliberately
scoped to JUST the profile section this delivery, kept separate from the
other 3 so a broad change doesn't land in the same delivery as a big new
feature (the exact mistake behind the V3.6/V3.6.2 incident).

**New Setup screen** (`screen-settings`), reached two ways: the existing
"Settings" nav item (was a placeholder until now), and automatically on a
new user's first login, before `setup_complete` is set — `bootApp()` in
`app.js` now checks `profile.setup_complete` instead of always going
straight to the journal.

**View-only header**: name, Unique ID, URL (with the existing copy-button
pattern reused from the create-PIN/registered screens).

**Editable**: journal name (a custom title for the journal, not the
student's real name — new `journal_name` column), gender (already existed
as a field, just never had setup-screen UI), and mushaf choice — all 3
options shown (13 line / 15 line Madani / Hybrid), Hybrid rendered
disabled/unselectable since it isn't built yet (new `mushaf` column,
constrained to the 2 real values; the server rejects `hybrid` as a value
for the same reason the UI doesn't offer it).

**Backend**: migration 0009 adds `journal_name` and `mushaf` to `students`.
`profile.js`'s existing GET/POST (already handled name/gender/track_haidh/
setup_complete from the V1.4-era work) extended to include both.

**Deliberately NOT in this delivery**: history capture, default targets,
Dhor planning, haidh tracking, and the icons-folder/nav-label
restructuring — all separate, later work.

**Files changed:**
```
index.html
js/app.js
worker/src/profile.js
SCHEMA.md
CONVENTIONS.md
sw.js
```
**New files:**
```
worker/migrations/0009_setup_profile_fields.sql
css/settings.css
js/settingsScreen.js
```

**Retest before merging to `main`**: `TESTING.md` §18. Needs the migration
applied to D1 before the new fields will actually save — this is a real
schema change, not just frontend.

---

## V3.6.2 — cache policy reversed: nothing cached, anywhere (2026-07-26)

Bismillah. V3.6 paired the `?v=` versioning with `_headers` set to
`immutable, max-age=31536000` for `css/js/shared` — the standard pattern
production build tools use, safe specifically because their deploys are
atomic (a new version string can't appear before every file behind it has
landed). This project's deploys are manual, file-by-file uploads with no
such guarantee, and that gap was hit directly: a browser loaded
`app.js?v=3.6.1` mid-deploy, before the full V3.6.1 file set had actually
landed, got the old code back, and cached it *immutably* — meaning no
later deploy under that same version string could ever fix it for that
browser. `reflectionCard.js`'s 404 during the same window got cached the
same way.

**Reversed, not tuned:** rather than picking a shorter-but-still-nonzero
cache duration, `_headers` now sets `Cache-Control: no-store` for
everything, project-wide — no caching at all, anywhere, by any browser or
intermediate cache. For a project at this stage (active development,
changing minute to minute, no atomic deploy step, and no real user traffic
yet where cache-hit-rate would matter), there's essentially nothing to
gain from caching and a full year of blast radius to lose if this gap
gets hit again. `CONVENTIONS.md` #10 updated with the full reasoning for
future reference, including when it might be worth reintroducing (atomic
deploys, or real production traffic).

**What stays:** the `?v=` query-string versioning on every CSS/JS
reference — it isn't what caused this, and it's still what breaks a cache
that forms somewhere outside this project's control (a stray proxy, a CDN
that ignores `_headers`), plus what any future reintroduced caching would
key off.

**Version bump**: `?v=3.6.1` → `?v=3.6.2` across every reference in
`index.html`, and `sw.js`'s `ASSETS`/`CACHE_NAME` to match — this is what
actually clears the currently-stuck bad cache, since `no-store` alone
doesn't undo a cache entry that already exists under the old URL.

**Files changed:**
```
_headers
index.html
sw.js
CONVENTIONS.md
```

**Retest before merging to `main`**: `TESTING.md` §17.

---

## V3.6.1 — unified day-log view (2026-07-26)

Bismillah. Replaces the 3 separate Sabaq / Sabaq Dhor / Dhor screens with
one screen holding all 4 cards (Sabaq, Sabaq Dhor, Dhor, and a new
Tadabbur/reflection card) — all 3 journal column headers now open this
same screen, starting on whichever card matches the header clicked.

**Layout**: large/desktop screens show all 4 cards as a static 1×4 grid,
no scrolling. Tablet shows a swipeable rail, 2 cards in view. Mobile shows
a swipeable rail, 1 card in view. Dot indicators track position on the
rail (hidden on the desktop grid, where there's nothing to indicate a
position within). Each card is independently vertically scrollable, so
its fields + Recent history fit without growing the card unboundedly.

**Recent history**: each of the 3 log cards' existing "Recent" swipe rail
(past entries of that type) moved to the bottom of its own card — same
feature as before, just relocated.

**Independent per-card date selectors**: Sabaq, Sabaq Dhor, and Dhor each
get their own `<input type="date">`, defaulting to today every time the
screen opens. Changing one card's date only changes which date THAT
card's next save uses — the other 3 cards stay on whatever date they're
each individually set to. This is genuinely new: every save previously
hardcoded `date: todayISO()`, so there was no way to log a missed day at
all before this. Note this only affects what date a NEW entry saves
under — it does not load an existing entry for editing (multiple entries
per day are deliberately allowed app-wide, see SCHEMA.md, so there's no
single "the" entry for a date to load).

**Tadabbur card, new**: the `reflections` table and `apiReflections` API
client already existed with no frontend — this is the first UI for it.
Deliberately different from the other 3 cards: reflections are meant to be
ONE per day, so this card loads today's existing reflection (if any) on
open and updates it in place on save, rather than always creating a new
row. No date selector, no Recent rail on this card, per spec.

**Two latent bugs fixed, exposed by mounting cards simultaneously**: both
`tajweed.js`'s "+ add" button and `commentPrivacy.js`'s comment
textarea/checkbox used fixed, non-unique ids (`tajweedAddBtn`,
`cb_comment`, `cb_private`). This was invisible while only one detail page
was ever mounted at a time, but the unified view mounts all 3 log cards'
pickers/comment blocks at once — `document.getElementById` always
resolves to the FIRST matching id in the document, so the 2nd/3rd card's
"+ add"/comment controls would have silently wired themselves to the 1st
card's elements instead. Both now scope their lookups to their own
container via `querySelector`, documented as new `CONVENTIONS.md`
principle #11.

**Files changed:**
```
index.html
js/app.js
js/tajweed.js
js/commentPrivacy.js
js/sabaqPage.js
js/sabaqDhorPage.js
js/dhorPage.js
css/detail-pages.css
sw.js
CONVENTIONS.md
```
**New files:**
```
js/reflectionCard.js
js/logDetailScreen.js
```

**Version bump**: every CSS/JS reference in `index.html` moved from
`?v=3.6.0` to `?v=3.6.1` (per the `CONVENTIONS.md` #10 discipline from
V3.6) since multiple files changed; `sw.js`'s `ASSETS` list and
`CACHE_NAME` updated to match — still not registered, no behavior change
there.

**Retest before merging to `main`**: `TESTING.md` §16. The per-card date
selectors and the container-scoping fixes both specifically need testing
with all 3 log cards open together (not one at a time), since that's
exactly the condition that was previously untested.

---

## V3.6 — real cache-busting (2026-07-26)

Bismillah. Closes the gap identified while debugging a medium/large-screen
rendering report: `sw.js`'s `CACHE_NAME` bump on every release only ever
evicted the *service worker's* own cache — it never touched the browser's
ordinary HTTP cache or Cloudflare's edge cache, both of which will keep
serving an old file under an unchanged URL indefinitely.

**Version-string query params**: every local `<link rel="stylesheet">` and
`<script src="...">` in `index.html` now carries `?v=3.6.0`
(`css/tokens.css?v=3.6.0`, `js/app.js?v=3.6.0`, etc.) — `sw.js`'s own
`ASSETS` list updated to match, so it stays correct for whenever it's
actually registered (Level 2, still not done, no behavior change here).
New convention documented in `CONVENTIONS.md` #10: bump this version string
across every reference, together, whenever any CSS/JS file changes — this
is manual discipline, there's no build step generating it.

**New `_headers` file** (Cloudflare Pages convention, didn't exist before):
`css/`, `js/`, and `shared/` get `Cache-Control: public, max-age=31536000,
immutable` — safe now that their URLs change whenever their content does.
`appicons/` gets a more moderate week-long cache (not query-string
versioned). `index.html`, `manifest.json`, and `sw.js` are explicitly set to
`no-cache, must-revalidate` — these are the entry points that reference
everything else, so they must always be fetched fresh or the browser never
learns a new version string exists in the first place.

**Files changed:**
```
index.html
sw.js
CONVENTIONS.md
```
**New file:**
```
_headers
```

**Retest before merging to `main`**: `TESTING.md` §15. This needs an actual
deployed preview (Cloudflare Pages) to verify — `_headers` has no effect
served from a plain local file open in a browser.

---

## V3.5 — PWA Level 1: installability (2026-07-26)

Bismillah. Scoped deliberately to core Web App Manifest + responsive web +
HTTPS + Android/Apple install conventions — stopping short of registering
the service worker or any offline behavior (that's Level 2, separate future
work).

**Manifest icon paths, actually fixed**: `manifest.json` declared
`icon-192.png` and `icon-512.png` at the repo root — neither file has ever
existed anywhere in this repo, so Chrome's install criteria (which require
a valid 192px and 512px icon) were failing silently. Now points at the real
files in `appicons/`.

**New maskable icon**: `appicons/maskable-icon-512x512.png`, added as a new
`purpose: "maskable"` manifest entry. The existing badge artwork
(`android-chrome-512x512.png`) fills its canvas edge-to-edge with no safe
margin, so reusing it directly would get clipped by Android's adaptive-icon
mask. The new asset instead places the transparent logo mark
(`appicons/logo.png`) on a `--palette-sage` (#829672) background, scaled so
the mark's bounding-box corners sit ~188px from center — comfortably inside
the ~205px safe-zone radius (80% of the 512px canvas).

**Apple Home Screen conventions**: `index.html`'s `<head>` gained
`apple-touch-icon` (the file already existed in `appicons/`, it just wasn't
referenced anywhere), `apple-mobile-web-app-capable`,
`apple-mobile-web-app-status-bar-style` (set to `black-translucent`, so the
status bar blends with the Sage banner once launched standalone), and
`apple-mobile-web-app-title`.

**Favicon links**: `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`
also already existed in `appicons/` but were never linked from `<head>` —
fixed, so the browser tab icon now actually shows.

**Cleanup**: removed `appicons/site.webmanifest` — an orphaned,
auto-generated manifest never linked from `index.html`, with blank `name`
fields and icon paths pointing at the domain root rather than `appicons/`.
Kept for reference only until now; safe to delete since nothing referenced
it.

**Deliberately unchanged**: `sw.js` — it still exists but is not registered
anywhere. Registering it (plus any actual offline caching behavior) is
Level 2, not part of this delivery.

**Files changed:**
```
manifest.json
index.html
```
**New asset:**
```
appicons/maskable-icon-512x512.png
```
**Removed:**
```
appicons/site.webmanifest
```

**Retest before merging to `main`**: `TESTING.md` §14 — this is a
device/browser-only check, no backend involved. Needs a real Android Chrome
device/desktop Chrome and a real iOS Safari device to confirm properly;
DevTools can confirm the manifest itself is valid but not the actual
install/home-screen behavior.

---

## V3.4.3 — duplicate-flow correctness, inactive-student search, styling fixes (2026-07-26)

Bismillah. Eleven items from a second round of testing on V3.4.2, built together.

**Duplicate-check correctness**: the Continue button on both registration paths now makes a single `force:true` call and reacts to the match info THAT call returns, instead of trusting a flag stored from the original match — the real bug this fixes: editing the WhatsApp number to a genuinely different value and then pressing Continue was still asking "mark existing journal inactive?" even though the edited value no longer collided with anything. The duplicate search itself now also searches inactive students, not just active ones — previously a match against a retired journal went undetected entirely. Since self-registration has no direct admin actions, matching an inactive journal now offers a "request reactivation" email instead of the (now-inapplicable) "deactivate" question. The admin duplicate-match hint text now echoes back the actual matched name, WhatsApp number, and active/inactive status, rather than a generic message — useful now that the admin list can have several similarly-named test entries. Deactivating any student (via the admin toggle or either duplicate-flow's deactivate action) now automatically resets their PIN too, so a later reactivation always starts fresh.

**Styling/layout fixes**: the tablet/desktop breakpoint moves from 900px to 1300px — a real iPad 2 in landscape (1024px CSS width) was landing in the desktop 25%-width bucket instead of the intended tablet 50%-width bucket (known remaining edge case: a 12.9" iPad Pro in landscape, at 1366px, still lands in desktop under this threshold). The admin registration box's label/input regained the `display:block`/full-width styling every other form already has — it only looked right before because a since-removed wrapping `<div>` was accidentally forcing the line break. `.form-hint` (used for the actual explanatory text — the duplicate-match message, the registration-confirmation message) now reads off `--font-size-base` like labels/errors/buttons already do; it was wrongly left at 11px in V3.4.2. The journal table's weekday abbreviation (Sat/Sun) is a little bigger; the "+ add" placeholder text was confirmed already correct and untouched.

**Safari fix, root cause this time**: the "journal hidden under the banner" report turned out to not be a notch/safe-area issue at all — live inspection on an actual iPhone showed the DOM fully populated with real data and no console errors, but nothing painted until the page was scrolled. This is a known WebKit compositing bug: a `position: sticky` flex sibling (`#authBand`) before a `flex: 1` sibling (`#appContent`) computes layout correctly but doesn't paint it until a reflow forces it. Fixed by promoting `#appContent` onto its own compositing layer via `transform: translateZ(0)`. The safe-area-inset fix already shipped in V3.4.2 stays in place — it addresses genuine notch clearance, a separate concern from this paint bug.

**Correction (same day)**: the `translateZ(0)` attempt above did NOT actually fix it — retested on the same iPhone, still invisible until scroll. Likely cause: `#appContent` was never the element being shown/hidden (it always exists) — `#appShell` is what actually flips from `display:none` to `display:flex` at login, so promoting a child of the thing that changes may simply not touch whatever Safari fails to repaint at that transition. Replaced with a JS-driven fix in `app.js` (`fixJournalTopPaint()`): after the journal renders, it measures the real gap between the auth band's bottom edge and the journal content's actual position, and only corrects it if one exists — deliberately not a blind fixed-height margin, since that would double up with the already-correct flex layout once actually painted and leave a permanent visible gap on every device. The act of reading+writing those layout values is what forces Safari through a synchronous layout+paint pass, which is what actually resolves the symptom — the position correction itself is more of a safety net than the real mechanism. The `transform: translateZ(0)` line stays on `#appContent` (harmless, just not sufficient alone). Same pass also made the journal table's column headers sticky (`position: sticky`, offset via a JS-measured `--auth-band-height` custom property rather than a guessed static value, since the band's real height varies with the safe-area inset).

**Second correction (same day)**: the sticky-headers-inside-the-table approach above visually ended up covering the first data row once actually tested. Restructured: the header row now lives in its own container (`.journal-header-row`), a sibling of `.journal-wrap` rather than a `<thead>` inside `.journal-table` — this is what's actually sticky now, positioned via the same `--auth-band-height` variable. Column alignment between the header and the rows below (now two separate elements instead of one table's automatic layout) is kept in sync via an explicit `<colgroup>` on the table matched to identical `nth-child` percentages on the header row. The "Journal" `<h2>` heading was removed, and both the header row and the rows container now bleed to the screen edges (negative margins canceling `#appContent`'s own padding, down to a 4px residual) rather than sitting inset — `journal.js` itself needed no changes, since it only ever touched `#journalTbody`.

**Auth dropdown menu**: "Sign out" renamed to "Log out," moved to the end of the menu (after Refresh), and its icon (only the icon, not the label) is now red to set it apart as the one different-in-kind action in that list.

**Branding**: a new `appicons/logo.png` (added to the repo directly) now appears above the existing content on the personalized login, fallback login, registration, and create-PIN screens — centered, capped near 400px wide but scales down responsively so it can't overflow a narrow phone's card.

**Files changed:**
```
index.html
css/tokens.css
css/base.css
css/components.css
css/journal-table.css
css/admin.css
css/nav.css
js/auth.js
js/adminPage.js
sw.js
worker/src/auth.js
worker/src/admin.js
```

**New asset expected in the repo (not part of this zip)**: `appicons/logo.png` — the user has already added this directly; this delivery only references it.

**Retest before merging to `main`**: `TESTING.md` §13 has the full checklist, including the D1-only tests for inactive-student matching and the auto-reset-on-deactivate rule, plus a manual pass confirming the Continue-button fix (edit the WhatsApp to something new, then Continue, and confirm no deactivate prompt appears).

---

## V3.4.2 — session hardening, duplicate-check gap, typography/responsive protocol (2026-07-26)

Bismillah. Fourteen items from a round of V3.4.1 testing, built together.

**Session/back-guard, refined**: the back-guard now takes two presses instead of one — the first shows "Press back again to log out" (not silent), the second actually logs out. Separately, `bootApp()` now verifies the loaded profile's own ID actually matches the unique ID in the URL, closing a real gap: editing the ID directly in the address bar and pressing enter is a fresh page load, not a back/forward history traversal, so the back-guard's `popstate` listener never saw it and a stale token kept showing whichever account it belonged to regardless of the URL. Both fixes are separate and complementary — one covers history navigation, one covers direct navigation.

**Duplicate-check gap closed**: the name+WhatsApp check only ever ran when a WhatsApp number was actually given — leave it blank and two same-named students went completely undetected. A shared `findDuplicateMatch()` helper (used by both self- and admin-registration) now falls back to a name-only check against active students when WhatsApp is absent.

**Duplicate-match UI restructured, both registration paths**: the form fields now stay visible and editable throughout — no more hiding the inputs behind a separate prompt. Three buttons on a match: **Cancel** (dismiss, form stays as typed), **Continue** (always resubmits with whatever's *currently* in the fields — if unedited, creates the duplicate with an auto-appended number; if edited to no longer collide, becomes an ordinary registration), **Reset PIN** (unchanged, always targets whichever student was matched when the prompt first appeared, regardless of later edits). Admin's "also deactivate?" confirm, and the reset-PIN confirm, now read "CANCEL: Both journals remain active ; OK: mark existing journal INACTIVE" instead of the native dialog's generic Cancel/OK with no context.

**Admin panel**: "optional" removed from both WhatsApp placeholders (registration form and the user-detail card) — the field itself is still optional, just not labeled as such.

**Typography**: new `--font-size-base: 14px` root variable (tokens.css) — body text, form labels, error/result messages, and both button classes now read off it, so a future size change cascades from one place instead of being hunted down across files. Fine-print elements (`.eyebrow`, `.form-hint`, monospace IDs, nav tile labels) stay deliberately smaller by design.

**Responsive width protocol, refined**: replaces the old ~1/3 (33%) cap with exact breakpoints — mobile fills the available width, tablet is 50% (two fit side by side), desktop is 25% (four fit side by side), all centered. Applied to `.login-card` (every login/register/create-PIN/registered screen shares it) and `#screen-admin`. The percentage values live in shared `--width-tablet`/`--width-desktop` tokens; the breakpoints themselves (600px/900px) are necessarily repeated as literals since media queries can't consume CSS custom properties in their condition.

**Fallback screen**: "New Registration" moved from inline with the "Sign in" heading down to the bottom of the card, below the "Forgot your pin or ID?" text.

**Create-PIN screen**: now shows the full registration-confirmation message plus the personal URL and a copy icon (as a reminder — reuses the same message and a new shared `wireCopyButton()` helper, not a duplicate of the "Registered!" screen's Continue button). The "Confirm PIN" row stays hidden until "New PIN" is fully entered, and re-hides if the two don't match.

**Safari fix**: `#authBand` now adds `env(safe-area-inset-top)` on top of its normal padding — confirmed Safari-only (Android was unaffected), consistent with `viewport-fit=cover` letting content render under the notch/status bar without it.

**Files changed:**
```
index.html
css/tokens.css
css/base.css
css/components.css
css/detail-pages.css
css/admin.css
css/nav.css
js/app.js
js/auth.js
js/adminPage.js
sw.js
worker/src/auth.js
worker/src/admin.js
```

**Retest before merging to `main`**: `TESTING.md` §12 has the full checklist — the two-press back-guard timing, the URL-edit-while-logged-in case, the no-WhatsApp duplicate case for both registration paths, and a visual pass on a real Safari/iOS device for the safe-area fix specifically (nothing else in this delivery can be verified from a desktop browser alone).

---

## V3.4.1 — session security, duplicate-registration handling, admin list polish (2026-07-25)

Bismillah. Five items queued up across several rounds of testing/discussion
on V3.4, built together.

**Session security**: the login token moved from `localStorage` to
`sessionStorage` — it's cleared automatically the moment the tab/app
actually closes, so reopening always requires signing in again, given the
journal contents is considered valuable enough to be worth that tradeoff.
Alongside it, a back/forward guard: right after a successful login, one
extra history entry is pushed, so pressing back (or forward) while
authenticated always logs out and drops back to a fresh login screen
instead of silently continuing whatever session happens to still be
active — this is what directly stops one account's session from carrying
over onto a different account's URL via the browser's own back/forward
buttons. It only interrupts an authenticated session; it never traps
anyone or blocks navigation outright.

**Admin registration gets a WhatsApp field** — previously name-only even
though the backend already stored WhatsApp; the admin panel's register
form now collects it too.

**Duplicate-registration handling, for both self- and admin-registration**:
a matching name+WhatsApp against an existing *active* student surfaces a
warning, never a block. Self-registration keeps "Create a new journal
anyway" / "Reset PIN for the existing journal" (email); admin gets
"Continue" / "Reset PIN" (a direct action — no email needed, admin already
has that capability). Both flows now also offer marking the old/matched
journal inactive when continuing anyway — self-registration routes that
through email too (the "match" is just a self-reported claim, not verified
identity), admin gets a direct action. When continuing past a match, the
new record's name gets an auto-appended disambiguating number ("John
Smith" → "John Smith 2", then "John Smith 3", ...) via a shared
`nextDisambiguatedName()` helper used by both registration paths.

**Admin student list**: each row now has copy and native-share icon
buttons for that student's personal URL (share is feature-detected and
simply hidden on browsers without `navigator.share`, e.g. desktop Firefox
— no fallback, it just isn't there). Inactive students' names are greyed
out instead of a separate "Active"/"Inactive" text label, which is
removed — keeps rows more compact. Row markup changed from one big
`<button>` to a clickable name/ID button plus sibling icon-buttons,
since a `<button>` can't legally contain another `<button>`.

**Registration-confirmation screen**: the "Continue" button is now "Copy
and Continue" — it copies the personal URL to clipboard and then
navigates, so pressing the big button without using the copy icon first
doesn't leave anyone without their URL. The standalone copy icon is
unchanged.

**Files changed:**
```
js/api.js
js/app.js
js/auth.js
js/adminPage.js
js/icons.js
index.html
css/admin.css
sw.js
worker/src/auth.js
worker/src/admin.js
```

**Retest before merging to `main`**: the manual walkthrough in
`TESTING.md` §11, plus the D1-only duplicate-check/auto-numbering tests
for both registration paths.

---

## V3.4 — URL-based personalized login + registration duplicate-check (2026-07-25)

Bismillah. A login-flow rework built around one idea: a student's personal
URL is the "lock" for their journal (kept private, never memorized), and
their PIN is the "key" — not reasonable to expect a student to remember a
random ID as well as a PIN.

**Registration**: WhatsApp label/placeholder cleaned up ("WhatsApp number",
hint placeholder `+CODE 123456789`); before creating an account, a matching
NAME+WHATSAPP combination against an existing *active* student (normalized —
trimmed/case-insensitive name, digits-only WhatsApp, so formatting
differences don't hide a real match) now offers a choice instead of silently
creating a possible duplicate: "Create a new journal anyway" or "Reset PIN
for the existing journal" (opens a pre-filled `mailto:`). On success, auto-
navigates to a new "Registered!" screen showing the exact confirmed
onboarding message plus the student's personal URL as copyable text next to
a copy icon-button.

**URL-based login** (new `GET /auth/lookup?id=` endpoint, public, returns
just `{name, hasPin}` for an active ID — 404 for anything else, deliberately
vague like the login endpoint): visiting `/<uniqueID>` now skips the ID
field entirely and greets the student by name ("Ahlan wa Sahlan, [name]"),
either on a plain PIN-entry sign-in (PIN already set) or a new create-PIN
screen (first login — PIN entered twice to confirm). Every PIN entry point
across all three login screens now auto-submits on the 4th digit — no
Sign-in button anywhere.

**Fallback screen kept** for anyone reaching the app with no unique ID in
the URL, an ID that doesn't exist, or one that exists but isn't active —
same ID+PIN screen, with the "4-digit PIN"/"First time..." text and Sign-in
button removed, "New here? Register" → "New Registration", and its lost-
access message changed to "Forgot your pin or ID?" (the personalized
screens keep the original "Lost pin" wording — deliberately different
messages for the two contexts).

**Bug fix, not just a copy change**: the "content hidden behind the auth
banner" report traced to `#welcomeBanner` — `position: fixed` with a higher
z-index than `#authBand`, firing on *every* boot (not just first login), so
it covered the band and page content for 3 seconds on every load. Moved into
normal document flow inside `#appShell`, right after the auth band, so it
pushes content down instead of overlapping it.

**Also**: `sw.js`'s cache-name bumped and its precache list completed (it
was missing `detail-pages.css`, `admin.css`, and six page-specific JS files
that already existed — found while touching this file, unrelated to the
banner bug itself, which private-browsing testing had already ruled out as
a caching issue).

**Deferred, on purpose**: the Sabaq/Sabaq Dhor/Dhor detail-page container
width, the "Recent" rail sizing, and the three commentPrivacy.js tweaks —
holding until history and mushaf/model selection are sorted out first.

**New file needed on the Cloudflare Pages side**: `_redirects` (repo root)
— `/* /index.html 200` — so any path (`/<uniqueID>`) serves `index.html`
instead of a 404; the frontend then reads the path itself.

**Fix applied before merge**: the first pass of this delivery had a real
bug, not a config issue — screen switching used inline `style.display`,
but every login screen except the fallback carries a `hidden` class whose
CSS rule is `display: none !important`, which silently wins over an inline
style. Result: the fallback screen (no `hidden` class) rendered by default
and then hid itself once the URL lookup resolved, but nothing else could
ever show — a brief flash of the wrong screen, then blank. Fixed by
toggling the `hidden` class consistently everywhere instead (and giving
the fallback screen the same class as the others, so nothing shows until
JS explicitly picks one).

**Second fix, same delivery**: on the create-PIN screen, `clearPinGroup()`
was being called on the create row and then the confirm row right after —
since it always focuses the first box of whichever group it's called on,
the second call's focus silently won, so both the initial screen load and
a PIN-mismatch retry left the cursor in the confirm row instead of the
create row. Fixed by clearing confirm first, create last, in all three
places this happens (initial load, mismatch retry, and the server-error
retry after a successful match).

**Files changed:**
```
index.html
css/base.css
css/components.css
js/icons.js
js/api.js
js/auth.js
js/app.js
sw.js
worker/src/auth.js
worker/src/index.js
_redirects (new)
```

**Retest before merging to `main`**: the manual browser walkthrough in
`TESTING.md` §10, plus a private/incognito pass on the personalized and
create-PIN screens specifically, since the fallback/personalized split
depends on `/auth/lookup` behaving correctly for all three of "no ID",
"unknown ID", and "inactive ID".

---

## Reconciliation — repo had drifted significantly behind (2026-07-25)

Bismillah. Triggered by a question about whether the `frontend/` folder
move had actually happened — checking the real uploaded repo directly
(rather than continuing to assume) revealed the gap was much larger than
that one question: **9 files missing entirely, 11 present but stale
(predating V3.3.3/V3.3.4), 1 stray duplicate migration file** sitting at
the repo root outside `worker/`.

**Missing entirely**: `css/detail-pages.css`, `manifest.json`, migration
`0008_whatsapp_number.sql`, and six JS files that `index.html` actively
references — `commentPrivacy.js`, `dhorPage.js`, `sabaqDhorPage.js`,
`sabaqPage.js`, `tajweed.js`, `timer.js`. Their absence meant the Sabaq/
Sabaq Dhor/Dhor detail pages and the PWA manifest were genuinely broken
on the live site, not just out of date.

**Stale (present, but predating recent work)**: `admin.js`, `auth.js`,
`index.js`, `utils.js` (worker), `adminPage.js`, `api.js`, `auth.js`,
`icons.js`, `index.html`, `components.css`, `shared/data.js` (frontend).

**Confirmed NOT a gap, despite showing up in the raw comparison**:
`worker/src/entries.js`'s absence is correct — it was deliberately
deleted back in V2.2; the file only appeared "missing" because my own
scratch working copy had never been cleaned of it either.

**Fix delivered**: one complete package (45 real files) rather than
another incremental delta, given a delta-based approach is what let this
gap accumulate unnoticed in the first place — every current frontend
file, every worker source file, every migration, all syntax-checked
before delivery (26 JS files, all passing).

**Still needed on the user's end**: delete the stray root-level
`migrations/0007_admin_role.sql`, and run migration 0008 against
production (it was never applied — the file itself never made it into
the repo before now). Migration 0007 itself is unaffected by any of this
— confirmed already applied and working (verified earlier via a real
`ABCDEFG` login returning `role: admin`).

**Process note, worth carrying forward**: this happened at least in part
because recent deliveries (V3.3.2's follow-on patches, V3.3.3, V3.3.4)
weren't consistently making it fully into the live repo, and there was
no periodic check to catch that until a folder-structure question
prompted one. Worth periodically diffing the actual repo against the
working state, not just assuming each delivery landed cleanly.

---

## V3.3.4 — self-registration frontend + Lucide icons (2026-07-25)

Bismillah. The actual public registration screen, plus two more findings
that naturally belonged on the same login screen while it was already
being touched.

**Registration screen**: name + optional WhatsApp number, reachable via
a "New here? Register" link from the sign-in screen. On success, shows
the new ID clearly and pre-fills it into the login screen's ID field —
one less thing to copy by hand before setting a PIN.

**First-login "save this URL" message** — a real gap closed, not just
documented: `firstLogin` came back from the login API from the very
start of this project, but nothing in the frontend ever did anything
with it. Now, the first time anyone logs in (fresh registration or an
admin-created account), a one-time message appears encouraging them to
save the page or add it to their home screen — since there's no other
account-recovery path if that's the only place they ever log in from.

**Lost-PIN mailto link** — also previously only documented, not built.
A plain `mailto:hifzhelper.app@gmail.com` link on the sign-in screen,
pre-filled with a "Lost PIN" subject line. Zero backend, zero cost, per
the earlier decision.

**Lucide icon set** — `sabaq`/`sabaqDhor`/`dhor` now use Lucide's
`ellipsis`/`grip-horizontal`/`grip` icons (already correctly built with
`currentColor` and a `24x24` viewBox, matching every other icon in the
set) — **verified directly**: confirmed exact circle counts per icon (3/
6/9) and that all three correctly use `currentColor` + the standard
viewBox, not just eyeballed against the source files.

**Files changed:**
```
frontend/js/icons.js
frontend/js/auth.js
frontend/js/api.js (apiRegister — added in V3.3.3, now actually used)
frontend/css/components.css
frontend/index.html
```

---

## V3.3.3 — self-registration backend + carried-forward findings (2026-07-25)

Bismillah. Backend for self-registration, plus the two items explicitly
carried forward to this version.

**`POST /auth/register`** (public, no token) — creates a student account
(self-registration always creates students only, never teacher/admin —
that stays an admin-only action). `name` required, `whatsapp_number`
optional (its purpose is disambiguating similarly-named students, not
identity verification, so nothing enforces it). No PIN set — same
first-login flow as every other account.

**ID generation consolidated to one place** (`utils.js`) — it was
duplicated in `admin.js` before this; now both admin-created and
self-registered students generate IDs through the same function
(CONVENTIONS.md principle 2).

**`whatsapp_number` column added** (migration 0008) — admin-created
students can now optionally get one too, and `POST /admin/update-user`
can edit it on any existing student, alongside the carried-forward
**editable active status** (a checkbox now, not read-only text) — both
using the same partial-update pattern as everything else, verified
directly: tested the field-diffing logic against realistic scenarios
(nothing changed, only WhatsApp changed, cleared, toggled inactive),
including the null-vs-empty-string edge case for a student who never
had a number set.

**Hamburger icon** replaces the down-chevron on the auth banner's
dropdown toggle — the other carried-forward item.

**Deliberately not in this pass**: the actual public self-registration
*screen* — that's V3.3.4, kept separate per the established backend-
first sequencing. The API client function (`apiRegister`) is ready and
tested, just not called from any UI yet.

**Files changed:**
```
worker/migrations/0008_whatsapp_number.sql  (new)
worker/src/utils.js
worker/src/admin.js
worker/src/auth.js
worker/src/index.js
frontend/js/icons.js
frontend/js/auth.js
frontend/js/api.js
frontend/js/adminPage.js
```

---

## V3.3.2.4 — prep for moving index.html to the deployment root (2026-07-25)

Not deployed yet — this is ready for whenever the folder move actually
happens on your end. Confirmed approach: the **whole** `frontend/`
folder's contents move to the repo root (no `frontend/` folder at all),
not `index.html` alone — this keeps every existing `css/`/`js/` reference
inside `index.html` working unchanged, since they all move together
maintaining the same relative relationship. The only thing that actually
needed fixing: the `shared/data.js` reference, since `shared/` stays
where it is and becomes a sibling of the new root instead of the old
`frontend/` folder.

**Two files needed the fix, not one** — `index.html`'s script tag, and
`sw.js`'s own cached-asset list had the identical stale `../shared/data.js`
reference. Cache version bumped too, so browsers don't keep serving the
old cached files after the structure changes.

**Checked and confirmed unaffected**: `manifest.json`'s `start_url:
"./index.html"` needs no change — it's relative to `manifest.json`
itself, and the two move together. Also noted in passing: `sw.js` isn't
actually registered anywhere in the current code (no
`navigator.serviceWorker.register()` call exists) — a separate, real
finding, not part of this fix.

**Files changed:**
```
frontend/index.html
frontend/sw.js
```

**When you're ready to actually do the move**: upload these two (already-
fixed) versions to the new root location, alongside moving `css/`, `js/`,
and `manifest.json` there too.

---

## V3.3.2.3 — conventions + admin findings batch (2026-07-25)

Bismillah. `CONVENTIONS.md` extended first, then the buildable findings
from the last several rounds of testing.

**`CONVENTIONS.md`**: three new numbered principles, each grounded in a
real bug found this session, not hypothetical — environment values living
in one config spot (the stale `API_BASE` bug), never rendering UI against
async state before it's actually arrived (the missing-Admin-tile boot
order bug), and every component owning its own responsive behavior at
*both* ends of the screen-size spectrum, not just mobile (the register
button overflow + the desktop over-stretch, same underlying discipline,
opposite symptoms). File structure section also brought up to date —
it had drifted significantly behind the actual repo.

**Admin: delete a user** (`DELETE /admin/users`) — deliberately does
**not** cascade-delete history. D1's own foreign key enforcement (which
we hit directly during the 0007 migration) does the real work here: a
student with any existing records in `attendance`/`position`/any log
table fails to delete with a clear, deliberate error, rather than
silently destroying their history. Only a genuinely empty account can be
removed this way.

**Admin: edit name** (`POST /admin/update-user`) — same partial-update
shape as the log tables' `PATCH` endpoints. WhatsApp editing is not in
this pass — that column doesn't exist yet (arrives with V3.3.3).

**Student list redesign**: compact searchable list (ID / Name / Status)
replacing the old 5-column table — selecting a row opens a detail card
with everything editable (name, role, reset PIN, delete). This resolves
the mobile-overflow finding for the student list specifically by making
the list itself simple enough to never need to overflow.

**Both mobile-layout bugs actually fixed, not just documented**:
- Register button: explicit `width: auto` override where it sits inside
  a flex row — the exact fix CONVENTIONS.md principle 9 now documents
- Admin screen container: capped at 720px on screens ≥900px wide,
  rather than stretching to fill an ultra-wide monitor

**4-digit PIN as separate boxes**: auto-advances as each fills, backspace
on an empty box returns focus to the previous one — **tested directly**,
not just written: simulated typing through all four boxes, confirmed
correct advancing and that non-digit characters are filtered without
advancing focus.

**"Welcome, [Name]"**: a brief banner shown once each time the app boots
successfully (fresh login or returning with a valid token) — implemented
as a lightweight greeting rather than a full separate screen+navigation
step, a deliberate simplification worth knowing about.

**Deliberately not in this pass**: WhatsApp number editing (blocked on
the column not existing until V3.3.3); the URL restructuring
(`index.html` to the deployment root, `/UniqueID` path) — a genuinely
different kind of change (deployment/routing structure, not application
code) that deserves its own dedicated pass rather than being folded in
here.

**Files changed:**
```
CONVENTIONS.md
worker/src/admin.js
worker/src/index.js
frontend/js/api.js
frontend/js/adminPage.js
frontend/css/admin.css
frontend/js/auth.js
frontend/css/components.css
frontend/css/base.css
frontend/js/app.js
frontend/index.html
```

---

## V3.3.2.2 — hotfix: Admin tile missing from dropdown (2026-07-25)

`bootApp()` rendered the dropdown nav (`setupAuthBandAndDropdown()`)
*before* fetching the profile that sets `currentUser.role` — so the
dropdown always rendered against the default `role: 'student'`, no
matter who was actually logged in. Reordered: profile fetch now happens
first, dropdown renders after. Home page tiles were never affected —
they render on-demand when navigated to, by which point the role is
already correctly known.

**Verified directly**, not just reasoned about: simulated both the old
and new ordering — old order reproduces exactly 8 items with no Admin
tile (matching the reported screenshot precisely), new order correctly
shows 9 including Admin.

**Files changed:**
```
frontend/js/app.js
```

---

## V3.3.2.1 — hotfix: frontend pointed at the wrong Worker (2026-07-25)

`frontend/js/api.js`'s `API_BASE` was still the old dev Worker URL, left
over from V3.1 — from before the decision to work directly on production
and delete the dev repo. Every account created since then (including
`ABCDEFG`) only exists in production's database, so login was failing
correctly, just against the wrong target. Updated to the production
Worker URL.

**Files changed:**
```
frontend/js/api.js
```

---

## V3.3.2 — admin frontend (2026-07-25)

The user-list screen — reset PIN, change role, and register a new student,
all three together as agreed, since they share the same screen.

**Nav gating, tested not just asserted**: the "Admin" tile only appears for
`role === 'admin'` — verified directly (not just by inspection) that
students and teachers both get exactly 8 nav items with no admin tile,
while an admin gets 9. The backend already 403s non-admins on every
`/admin/*` endpoint regardless — this is purely about not showing a
button that would only ever fail for everyone else.

**Reset PIN and change-role both confirm before acting** — a plain
`confirm()` dialog, since both are real, immediate account-affecting
actions (reset PIN locks someone out until they set a new one; role
change is a genuine permission escalation if going to teacher/admin).
Declining a role-change reverts the dropdown back to its actual current
value rather than leaving it visually wrong.

**Register-student** shows the newly-generated ID clearly on screen after
creation, since that's the one piece of information the admin actually
needs to hand to the real student.

**Files changed/added:**
```
frontend/css/admin.css   (new)
frontend/js/adminPage.js (new)
frontend/js/icons.js
frontend/js/auth.js
frontend/js/api.js
frontend/js/app.js
frontend/index.html
```

**Still ahead**: V3.3.3/3.3.4 — self-registration (backend then frontend).

---

## V3.3.1 — admin backend (2026-07-25)

Bismillah. First piece of a genuine account-management system, replacing
the "teacher inserts a row via the D1 console" habit we've been using for
every test student this whole project — consistent with the explicit
"no manual database changes" principle going forward.

**Schema**: `role`'s `CHECK` constraint only allowed `student`/`teacher` —
rebuilt the table (same pattern as migration 0003, since SQLite can't
alter a `CHECK` constraint in place) to allow `admin` too. Seeded one
bootstrap account in the migration itself — `ABCDEFG` / `ADMIN-01`,
**no `pin_hash` set**, so it goes through the exact same first-login flow
every other account uses (whatever PIN gets typed in first becomes the
real one) — nothing pre-hashed, since the pepper needed for that isn't
available at migration-write time by design.

**Four new endpoints, all gated to `role === 'admin'`** (`worker/src/admin.js`):
- `GET /admin/users` — list every student, never returns `pin_hash`
- `POST /admin/reset-pin` — clears a student's PIN, same recovery mechanic
- `POST /admin/change-role` — student/teacher/admin
- `POST /admin/register-student` — creates a new student with an
  app-generated unique ID (6-char, same format as existing IDs),
  collision-checked against the real database rather than assumed unique
  — **tested**: generated 1000 sample IDs, confirmed correct format and
  zero collisions among them, consistent with the ~2.18 billion possible
  IDs in that space

**Deliberately not in this pass**: the admin frontend (V3.3.2), self-
registration (V3.3.3/4) — this is backend only, same "backend first,
frontend as its own pass" sequencing as everything else.

**Files changed:**
```
worker/migrations/0007_admin_role.sql   (new)
worker/src/admin.js                     (new)
worker/src/index.js
TESTING.md
```

---

## V3.2 — dedicated per-log-type pages (2026-07-24)

The three pages reached via the journal table's column headers — replacing
their "not built yet" placeholders from V3.1. Written fresh, shared logic
factored out rather than repeated three times.

**New shared components** (used across all three pages):
- `tajweed.js` — the tag picker, extendable, major/minor aware.
  `TAJWEED_DEFAULTS` (`shared/data.js`) restructured from a flat string
  list into `{tag, major}` objects — added the three major categories
  agreed in design (Substitution, Omission, Addition), kept the existing
  eight as minor. Custom tags a student adds default to minor.
- `commentPrivacy.js` — the student-comment block with its private
  toggle, plus a read-only teacher-feedback display when present.
- `timer.js` — the real start/lap/stop timer.
  **Tested the actual invariant before shipping**: sum of lap times must
  exactly equal total duration. Verified with a simulated multi-lap
  sequence (15s total, three laps summing to exactly 15) before wiring it
  into the UI. A session with no explicit lap tap sends a plain
  `duration_seconds` with `lap_times: null` — never a trivial one-element
  array — per "make inputs optional wherever possible."

**Dhor page** (the richest of the three): reference selector, a juz'+
position+amount (quarter/half/full-juz') picker that computes
`segment_from`/`segment_to` correctly for whichever reference is active —
**tested this conversion directly**: waterval quarter/half/full = 1/2/4
markers, uthmani = 2/4/8, and confirmed real juz'-boundary examples
compute the right marker ranges, not just the unit counts in isolation.
Plus the timer, tajweed picker, mistakes, and comment block.

**Sabaq and Sabaq Dhor pages**: same shared components, their own fields.
**Known, flagged gap**: Sabaq Dhor's `zone` field is meant to be computed
automatically from the student's position/study-order data — that
computation isn't wired into the V3 frontend yet (nothing fetches
`position.json` anywhere in this codebase so far), so it's a manual text
field for now rather than a faked computation.

**All three pages** also show a swipe rail of recent entries (the last 14
days), reusing the swipe-rail CSS pattern from V3.1.

**Deliberately still not in this pass:**
- The gamified three-ring visual map — still the single biggest remaining
  piece
- Plans aren't wired into these pages yet — no plan-prepopulation, no way
  to create a plan, and no `plan_id` gets sent even though the Worker
  already supports it
- The three-model selector (13-line/Madina/Hybrid) — Dhor's reference
  picker here is the old simple two-option version, not the full model
  system
- Editing an existing entry from the recent-entries rail (currently
  read-only — tapping a rail card doesn't do anything yet)
- Privacy enforcement is visible (the toggle exists and saves) but
  nothing yet reads it back differently for a teacher view, since no
  teacher-facing screen exists

**Files changed/added:**
```
shared/data.js                      (TAJWEED_DEFAULTS restructured)
frontend/index.html
frontend/css/detail-pages.css       (new)
frontend/js/tajweed.js              (new)
frontend/js/commentPrivacy.js       (new)
frontend/js/timer.js                (new)
frontend/js/dhorPage.js             (new)
frontend/js/sabaqPage.js            (new)
frontend/js/sabaqDhorPage.js        (new)
frontend/js/app.js
```

---

## V3.1 — frontend foundation (2026-07-24)

Bismillah. The first piece of the frontend rebuild against the V2/V3
backend — written fresh (new modular file structure), not adapted from
the old V1.x monolithic `app.js`/`api.js`/`styles.css`, per preference.

**What's actually built and tested this round:**
- **CSS token layer** (`css/tokens.css`) — the five-color palette and the
  three ring colors defined once as named variables with documented
  usage, exactly as instructed, so either can be changed in one place
  later rather than hunted through component files.
- **Journal landing table** (`css/journal-table.css`, `js/journal.js`) —
  the physical-planner-style table (Date | Sabaq | Sabaq Dhor | Dhor |
  Feedback), Sage header for Date, Mauve for the log columns, matching
  the actual paper journal. Pulls from the real `/sabaq`, `/sabaq-dhor`,
  `/dhor`, `/reflections`, `/plans` endpoints — genuinely wired to V2/V3,
  not a mockup.
- **Auth band + slide-down dropdown** (`css/nav.css`, `js/auth.js`) —
  icon+label nav, no background/border, per the styling instruction;
  dropdown adds logout/refresh on top of the same nav set Home uses.
- **Home page** (`js/home.js`) — icon tiles, same nav set as the dropdown.
- **Quick-add modal** — tapping a journal cell opens a simple form and
  saves a real log entry. Deliberately basic (no tajweed tags, timer, or
  flexible units yet) — enough to make the app genuinely usable for daily
  logging while the richer per-type pages are still ahead.
- **Multi-entry-per-day and plan-prepopulation both verified working** —
  tested the actual data-grouping logic (not just eyeballed): two Sabaq
  entries on the same day correctly bucket together under V2's uncapped
  model; a future-dated plan correctly creates a visible row for a day
  with no logs yet, confirming the "plan pre-populates the table row"
  mechanism actually works end to end at the data layer.
- `sw.js` updated to the new file list, cache version bumped so browsers
  don't keep serving the old cached assets.

**Deliberately NOT in this pass — the next pieces of work, not oversights:**
- The gamified three-ring visual map (frequency/mistakes/time, triadic
  colors) — the biggest remaining piece
- The Dhor timer/lap UI
- The dedicated per-log-type pages (reached via the table's column
  headers) — currently show an honest "not built yet" placeholder
- The three-model selector (13-line/Madina/Hybrid) in the UI — the
  underlying `data.js` logic exists (V2.0), not yet surfaced
- Privacy toggles (student_comment_private, teacher_feedback_visibility,
  reflections.is_private) in any input form
- Swipe rails (multiple entries per day currently just show a count
  badge, not a browsable rail)
- The V1.4 setup wizard has NOT been reconciled against the V2/V3 schema
  — everyone currently lands straight on the journal regardless of
  `setup_complete`; flagged directly in `app.js`, not silently skipped

**Please delete these from the repo — fully superseded, nothing imports them:**
```
frontend/app.js
frontend/api.js
frontend/styles.css
```

**Files changed/added:**
```
frontend/index.html
frontend/sw.js
frontend/css/tokens.css        (new)
frontend/css/base.css          (new)
frontend/css/nav.css           (new)
frontend/css/journal-table.css (new)
frontend/css/components.css    (new)
frontend/js/icons.js           (new)
frontend/js/api.js             (new)
frontend/js/auth.js            (new)
frontend/js/home.js            (new)
frontend/js/journal.js         (new)
frontend/js/app.js             (new)
```

---

## V3.0 — plans, timer/lap, privacy (2026-07-24)

Bismillah. Three features designed over several sessions, built together
in one migration since they touch overlapping tables.

**Plans** (`plans`, new table): an intention, not a record — a student can
plan a specific Dhor/Sabaq/Sabaq Dhor for a specific future date, then
complete it later either via a quick checkbox (no log created) or with
full detail (creates the real log entry, linked back via
`completed_log_id`). **The Dhor input screen's default view is now driven
by this** — a day with a plan shows it pre-filled to complete; a day
without falls back to the existing manual picker; multiple plans for one
day show a selection rather than guessing which one's intended.

**Timer/lap** (`dhor_log`): `minutes` renamed to `duration_seconds` (real
precision, not whole minutes — a lap feature needs it), plus a new
`lap_times` JSON array column holding true per-section durations. Same
"variable-length list as one column" pattern as `tajweed_tags`, deliberately
not flat `time1`/`time2` columns (the exact anti-pattern rejected earlier
when discussing reviews) and not a separate table (laps are always
created as one batch, never independently queried).

**Privacy**: `student_comment` (the student's own performance
self-assessment — distinct from `teacher_feedback`) gets a
`student_comment_private` flag; `reflections` gets the equivalent
`is_private`. `teacher_feedback` gets a three-tier
`teacher_feedback_visibility` (`all`/`teachers_only`/`private`), since
multiple teachers viewing one student is confirmed real, not
hypothetical. Enforced in `logHelpers.js`'s new `applyPrivacy()` — a
private field gets redacted at read time based on who's actually asking,
never a full row hidden. **Tested, not just written**: verified all three
viewer perspectives (the student, the authoring teacher, a different
teacher) against a realistic set of rows before shipping — every case
matched the intended rule.

**Files changed:**
```
worker/migrations/0006_plans_timer_privacy.sql   (new)
worker/src/plans.js                               (new)
worker/src/logHelpers.js
worker/src/sabaqLog.js
worker/src/sabaqDhorLog.js
worker/src/dhorLog.js
worker/src/reflections.js
worker/src/index.js
SCHEMA.md
```

**Still ahead**: the frontend — nothing calls `/plans` or the new
privacy/timer fields yet. Same sequencing as every other big change this
project: backend first, frontend as its own pass.

---

## V2.3 — real edit capability, not just comments (2026-07-22)

**Correction to V2.2's design**, not a bug fix — V2.2 only let `PATCH`
touch comment fields, on the reasoning that every save should be a
permanent, unedited record. Pushed back on directly: a user correcting a
mistake doesn't care whether that's implemented as "edit the row" or
"delete and re-log it" — same practical effect either way — and the app
can't enforce honesty about whether an edit reflects what actually
happened regardless of which mechanism exists. That's on the user, not
something to design around.

**What changed**: `PATCH` on all four logs (`/sabaq`, `/sabaq-dhor`,
`/dhor`, `/reflections`) now accepts any subset of that table's own
content fields *and/or* the comment fields, updating only what's
provided — one general-purpose partial update instead of a
comment-only one. `logHelpers.js`'s `updateComment` became the more
general `updateLog`.

**Still true from V2.2, unaffected by this**: saving is still always a
new row (no per-day cap, no upsert-by-date) — this correction is about
editing an *existing* row after the fact, not about how new entries get
created.

**Frontend responsibility, not built yet**: a confirmation before
submitting a content edit, since it overwrites what's there. Not
enforced server-side — that's a UX concern for whoever's about to
overwrite data, not a rule the API imposes.

**Files changed:**
```
worker/src/logHelpers.js
worker/src/sabaqLog.js
worker/src/sabaqDhorLog.js
worker/src/dhorLog.js
worker/src/reflections.js
worker/src/index.js
```

---

## V2.2 — Worker code for the four independent logs (2026-07-22)

The Worker code to actually use the V2.1 schema — written fresh, not
adapted from the old `entries.js`, per preference. A shared
`logHelpers.js` implements the CRUD/duplicate-detection logic once (all
four tables share the same student_id/date/entered_by/comment/
is_duplicate/created_at shape), so each of `sabaqLog.js`, `sabaqDhorLog.js`,
`dhorLog.js`, `reflections.js` stays a thin wrapper supplying just its own
fields and validation.

**Real behavior change from V1.x, worth knowing**: V2 has no per-day cap,
so saving is *always* a new row now, never an upsert. Deleting is by the
row's own `id` (a real primary key), not by `date` + `entry_number` the
way V1.3 worked — there's no more "editing today's entry," each save is
its own permanent record.

**New**: comment/feedback are no longer part of the same save as the
entry's content — a separate `PATCH` (`/sabaq`, `/sabaq-dhor`, `/dhor`,
body `{id, student_comment}` or `{id, teacher_feedback}`) adds or updates
just that field, since a comment can come from a different person, later
(reflections has no comment concept, so no `PATCH` there).

**Duplicate handling**: implemented as designed — allowed, not rejected,
just flagged (`is_duplicate = 1` on the new row) when it exactly matches
an existing row's content for that student/date.

**Attendance**: all three activity logs (sabaq, sabaq dhor, dhor) mark
present on save, per the original rule — reflections do not, since
tadabbur isn't one of the three activity logs that rule covers.

**Files changed:**
```
worker/src/logHelpers.js   (new)
worker/src/sabaqLog.js     (new)
worker/src/sabaqDhorLog.js (new)
worker/src/dhorLog.js      (new)
worker/src/reflections.js  (new)
worker/src/index.js
worker/src/utils.js
```

**Delete this file, it's no longer used and nothing imports it:**
```
worker/src/entries.js
```

**Still ahead**: the frontend rebuild (independent views per log, the
three-model selector) — this Worker code has no UI calling it yet.

---

## V2.1 — independent logs schema (2026-07-22)

The actual schema rebuild designed across the long V2 planning session:
the single `entries` table is replaced with four independent logs —
`sabaq_log`, `sabaq_dhor_log`, `dhor_log`, `reflections` — no caps, each
tracking `entered_by` separately from `student_id`, each comment/feedback
field carrying its own author and timestamp. `students`/`attendance`/
`position` are untouched.

No data migration from the old `entries` table — nothing real exists in
it yet, per the "delete everything, start fresh" decision made earlier.

**Files changed:**
```
worker/migrations/0005_v2_independent_logs.sql   (new)
SCHEMA.md
```

**Still ahead**: the Worker code (new modules for the four logs, written
fresh rather than adapted from the old `entries.js`, per preference) and
the frontend rebuild (independent views per log, the three-model
selector). This migration alone doesn't make anything work yet — the old
`worker/src/entries.js` still references a table this migration just
dropped, so **do not deploy this migration without also deploying new
Worker code in the same step** — same code/schema-mismatch risk flagged
back in V1.3, same fix: merge and migrate together, not with a gap
between them.

---

## V2.0 — 13-line (IndoPak) line/page data (2026-07-22)

First entry in the V2.x line — the six-table independent-logs redesign
(sabaq_log/sabaq_dhor_log/dhor_log/reflections, the three-model reference
selector, the setup-page rebuild) is designed but not yet built; this
version starts the new numbering with the first concrete piece of it: real
line/page counting for the 13-line print, closing a gap that took most of
a full session to properly source and verify (two rejected reconstruction
attempts before finding data that actually held up).

**What's new**: `shared/data.js` gains `AYAH_WORD_RANGE` (all 6236 ayahs'
word-ID ranges, universal across print layouts) and `LINE13_RANGES`
(10769 real content lines for the 13-line print), plus
`getLines13ForAyahRange(surah, ayahFrom, ayahTo)` — returns line/page
counts for a given ayah range. Verified 114/114 against the print's own
surah markers; noted as approximate (not exact-reference-grade like the
15-line data) given a ~4% discrepancy rate found when cross-checked at
finer granularity.

**Naming correction, going forward**: stop saying "Waterval" — too
localised a name. Say "13-line (IndoPak)" instead. The internal code key
(`RUB_BOUNDARIES.waterval`) is left as-is for now rather than a piecemeal
rename — it'll be properly renamed as part of the upcoming three-model
selector rebuild (Model 1 / Model 2 / Model 3), which touches this same
code anyway.

**Files changed:**
```
shared/data.js
SCHEMA.md
```

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
