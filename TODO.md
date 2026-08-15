# Hifzhelper — TODO / known issues

Confirmed findings, not yet built (per the standing process rule: document
first, build only once explicitly told to start). Newest first within each
section.

## Done — V3.53.0 (2026-08-15): Journal→Summary rename + timer wake lock + full lap list — built to the spec below

Three small items bundled together, all confirmed 2026-08-15.

**(1) "Journal" → "Summary":** Display-text only, scoped to the nav
dropdown + Home tiles, both of which already read from the one shared
`NAV_ITEMS` array (`js/auth.js`) — a single `label` edit covers both.
`id`/`icon` stay `'journal'`; every other "journal" string in the app
(Settings' "Journal name" field, the PIN-setup hint, the duplicate-
account dialogs/emails) is confirmed OUT of scope, stays as-is. Root-
level `auth.js` (stale, unused — only `js/auth.js` is actually
`<script>`-loaded) is untouched, same call as the other stale
duplicate already flagged elsewhere in this file.

**(2) Timer wake lock, running-only:** No wake lock exists today.
Screen Wake Lock API, requested/released so it's held if and only if
`mode === 'full' AND _running` — maximising alone doesn't hold it;
pausing while still maximised releases it; resuming re-acquires it.
Single `_syncWakeLock()` check called from `start()`/`pause()`/
`stop()`/`reset()` and the `mode` setter (every path that can change
either already funnels through these). Close already calls `pause()`
first, so it's covered without extra wiring. Feature-detected
(`'wakeLock' in navigator`) + try/catch — silently does nothing on
unsupported browsers. `visibilitychange` re-acquires it on returning
to the app, since the OS/browser silently drops the lock whenever the
screen/tab goes into the background — without this it wouldn't resume
automatically mid-session.

**(3) All laps, beside the ring:** Confirmed cause of "only one line
visible" today — `.laps` is a `flex:1` column below the LAP button
with `overflow:hidden`; between the ring, the LAP button and the
controls row there's rarely more than one row's worth of leftover
height, so laps past the first were being silently clipped, not just
capped (the `.slice(-4)` cap in `_paint()` was masking a layout
problem, not the only limit in play). Fix: remove the cap (render
every lap in `this._laps`) AND move the list — `.dial` becomes a row
with the laps list on the LEFT and the ring on the right, ring resized
down ~20% (`min(210px,25vh)` → `min(168px,20vh)`, user's figure) to
make room. `.laps` gets `overflow-y:auto` sized against the (now
smaller) ring's height instead of `overflow:hidden`, so a long
session's laps scroll instead of clipping. Claude's own call, stated
not confirmed: narrowing `.laprow`'s two grid columns slightly so the
list comfortably fits next to a 168px ring on the file's own 390px-
wide reference viewport; `.lapwrap` (the LAP button itself) stays
exactly where it is today — only the results list moves.

**Build:**
- `js/auth.js` — `NAV_ITEMS[0].label`: `'Journal'` → `'Summary'`.
- `js/session-timer.js` — wake lock state/methods + `_syncWakeLock()`
  wired into start/pause/stop/reset/the mode setter + a
  `visibilitychange` listener; `_paint()`'s laps render loses
  `.slice(-4)`; CSS: `.dial` → row layout, `.dial-in` ~20% smaller,
  `.laps` repositioned + scrollable, `.laprow` narrowed.
- `index.html`/`js/sw.js` — version bump only, same as every delivery.

**Built + verified:** all built as spec'd above. One real bug caught by
the harness, not by inspection: `_requestWakeLock` originally kept
whatever sentinel came back unconditionally, but `mode`/`_running` can
change while the platform is still responding to the request (e.g.
pause landing before it resolves) — fixed to re-check both right after
the await and release immediately if they no longer hold, instead of
keeping a lock that's already stale by the time it arrives. Verified
against the real `session-timer.js` in jsdom (mocked
`navigator.wakeLock`): the full request/release matrix across every
start/pause/stop/reset/mode-change combination, that exact race
(reproduced, then confirmed fixed), visibilitychange re-acquisition
after a simulated browser-forced release, silent no-op on a browser
without the API at all, and the lap list rendering every entry
(6 recorded → 6 rendered, correctly numbered, no `slice(-4)` left) —
29/29. Not harness-checkable: the actual on-device layout/scroll feel
next to the shrunk ring — that's the one part worth confirming on a
real phone.

## Done — V3.52.0 (2026-08-15): Tadabbur edit parity — the popup editor, built to the spec below

Reported as "nothing happens when the edit pencil is clicked" — traced:
not a broken path, but the V3.21-era design: Tadabbur's pencil silently
closes the History popup and loads the entry into the main form (its
only editor). With an empty/similar entry that legitimately reads as
nothing happening, and it is now badly out of step with the three log
cards' V3.51.x popup editors. Confirmed direction: Tadabbur gets the
same edit popup.

**Confirmed + verified groundwork:** the date input sits in a standard
.card-date-row (moveDateIntoEditSlot/restoreDateFromEditSlot and the
.editing-active hides work unchanged); apiReflections is the same
generic client (.update/.delete present); the worker's PATCH/DELETE
routes exist — frontend-only change, no worker deploy.

**Build:**
- index.html: Tadabbur gains the same hidden edit-topbar ("Edit
  Tadabbur" + .edit-date-slot + X-close) and edit-bottombar (Confirm
  changes / Save / red Delete), tadabbur-prefixed ids.
- js/reflectionCard.js: loadTadabburEntryForEdit becomes the popup
  loader — its own tadabburEditingId (separate from the today-flow's
  tadabburCurrentId), fills date/text/private, shows the bars,
  enterEditScreenMode('tadabburCard'), moveDateIntoEditSlot,
  initEditFlow with a date/text/private collector; saveTadabburEdit
  gated on isEditConfirmed -> apiReflections.update, then cancel +
  renderTadabburScreen() (restores the today-state and rail).
  cancelTadabburEdit = teardown/restore/exit + re-render; X-close =
  Cancel; Delete = the same confirm() popup pattern ->
  apiReflections.delete -> cancel + re-render. The main form's
  today-flow (auto-load + Save updating in place) is UNTOUCHED, and
  the read-view (tapping a row's content) stays.
- js/logDetailScreen.js: the X-icon injection loop gains 'tadabbur'.
- CSS: hide the absolute .tadabbur-close-btn while editing (it would
  otherwise float inside the popup); the generic .editing-active hides
  (header row, date row, history rail) already cover the rest.

Flagged: the pencil opens the popup for ANY entry including today's —
consistency over special-casing; the main form remains the quick path
for today. Version V3.52.0 (feature). One zip both repos.

**As built (V3.52.0), verified end to end:** exactly per spec, one
addition worth recording: generalizing the edit-mode CSS from
.log-detail-card.editing-active to .editing-active initially
DOWNGRADED the popup sizing rule's specificity to (0,2,0), which loses
on source order to the later equal-specificity takeover-height rule —
log cards in the popup would have regained the viewport-height
formula. Caught by the harness's strict no-stragglers check before
shipping; fixed with two explicit selectors
(.edit-popup-card .log-detail-card.editing-active at (0,3,0) +
.edit-popup-card #tadabburCard.editing-active at (1,2,0)), each
out-ranking its own competitor regardless of order. The width caps are
screen-level (#screen-*) and stay behind when the card moves, so the
popup needs no extra width neutralization for Tadabbur. Verified: 16
new checks — the REAL loader + cancel + shared machinery driving the
REAL tadabburCard (a .screen-content, the case the generalization
exists for) through load → dirty → confirm → cancel, fields, date-slot
round-trip, delete wording/API, today-flow and read-view untouched —
plus all five prior harnesses green (37+18+24+31+27) = 153 this round.

## Done — V3.51.2 (2026-08-15): Tadabbur save 500 + two companion regressions — built to the spec below

**BUG 1 (the reported 500):** every reflections INSERT throws `table
reflections has no column named is_duplicate` — reproduced by running
the REAL worker code against the REAL production schema in a simulated
D1. The shared insertLog unconditionally writes is_duplicate, which
the 3 activity logs have and reflections never did; the V3.45.15
insertLog rewrite was sim-verified against the 3 logs only, and no
Tadabbur had been saved since. Fix: handleSaveReflection does its own
direct INSERT (student_id, date, entered_by, reflection, is_private,
created_at) — honest at the design level too: reflections deliberately
has no duplicate concept (one-per-day, frontend updates in place), so
borrowing the activity-log inserter was always a category mismatch.
No schema change, no shared-helper risk.

**BUG 2 (found by the same simulation):** V3.44.1's separate
UPDATE_FIELDS whitelist is GONE from worker/src/reflections.js —
updateLog gets plain FIELDS, so backdating an existing reflection
silently drops the date change (delivered 2026-08-09, later clobbered
by a subsequent delivery's copy of the file). Fix: restore
`const UPDATE_FIELDS = [...FIELDS, 'date'];` and pass it to updateLog.

**BUG 3 (the console TypeError):** #haidhRulingHint does not exist in
index.html markup at all, yet js/settingsScreen.js writes to it in two
places (V3.39 shipped the JS; the element never made the markup). The
async renderSettingsScreen() dies at that line — everything after it
is silently skipped, INCLUDING populating haidh cycle/period/
next-expected from the profile, so a haidh-tracking user opening Setup
sees blanks and could overwrite real values by saving. Fix: add the
missing hint element after the ruling switch (the hint text is real
and useful: the ruling's day cap).

Worker-touching (reflections.js) — deploy worker first or together;
frontend-alone leaves the 500. One zip both repos.

**As built (V3.51.2), verified end to end:** worker/src/reflections.js
— handleSaveReflection now runs its own direct INSERT (student_id,
date, entered_by, reflection, is_private, created_at), insertLog
import removed; UPDATE_FIELDS = [...FIELDS, 'date'] restored and
passed to updateLog. index.html — <p class="form-hint"
id="haidhRulingHint"> added after the ruling switch (JS fills it per
ruling), unblocking renderSettingsScreen's haidh field population.
Verified by re-running the SAME simulation that exposed the bug (real
handler + real schema in node:sqlite D1): all four insert shapes
succeed, and the backdate test proves the update actually MOVES the
row's date now; markup/worker contracts + all five prior harnesses
green (37+18+24+31+27) = 143 total this round. DEPLOY ORDER: worker
first or together — frontend-alone leaves the 500.

## Done — V3.51.1 (2026-08-15): Edit-popup desktop fixes + heading/button polish — built to the spec below

Round of fixes from desktop testing of V3.51.0 (screenshot), all
root-caused in code:

1. **Popup illegible on desktop (all 3 cards):** the card keeps its
   RAIL sizing inside the popup — >=768px flex-basis 50%, >=1180px
   max-width 30% (exactly the narrow strip in the screenshot). Fix:
   the .edit-popup-card override gains width:100%; max-width:none;
   flex:none.
2. **Sabaq Dhor edit still shows the quarter rows:** the V3.51.0 hide
   (.log-detail-card.editing-active .sabaq-dhor-row-text, specificity
   0,3,0) LOSES to the existing #sabaqDhor_sections > 
   .sabaq-dhor-row-text rule (1,1,0) — and the Move-to-Dhor buttons,
   their empty placeholder spans, and the "Confirm Sabaq Dhor" label
   above the group were never covered. Fix: ID-scoped edit-mode hides
   for row-text + move-to-dhor-btn (placeholders are empty spans in a
   grid — hidden rows collapse), plus the group label; only the
   From/To rows remain, as requested.
3. **Big gap between heading and content (all 3):** .card-date-row was
   never hidden in edit — after its date control relocates to the
   heading it sits as an empty 44px row. Fix: hide it under
   .editing-active (restore untouched — the control moves back before
   the class is removed).
4. **Heading grey background removed (all 3):** .edit-topbar loses its
   --color-page-bg fill (transparent, padding trimmed).
5. **Heading text:** "Editing <type> entry for" → "Edit Sabaq" /
   "Edit Sabaq Dhor" / "Edit Dhor" followed by the date control (the
   user's "(Date)" = the selector's position, not literal parens).
6. **X-close pinned to the popup's top-right corner** (absolute within
   the popup card), not inline in the heading row.
7. **Active Save must look different from the confirmed button:** Save
   enabled = white background, evergreen border + text (the green fill
   removed), so solid-green remains unique to "Changes confirmed".

8. **Bottombar grey shading removed** (merged from the parallel
   session's agreed spec, 2026-08-15): .edit-bottombar loses its
   --color-page-bg background — with the topbar's grey also going
   (item 4), the popup reads as one clean card.
9. **More margin above Delete** (same source): --space-sm →
   --space-md.

10. **Popup card height capped at ~75% of the screen** (confirmed
   2026-08-15): .edit-popup-card max-height 88vh → 75vh (the card's
   inner override follows), so the popup sits clear of the screen
   edges with the app visible around it.

Frontend-only (index.html headings, css/detail-pages.css). One zip
both repos.

## Open — V3.51.1: edit bottombar styling tweaks — spec agreed 2026-08-15, awaiting "start building"

Two adjustments to the V3.51.0 Confirm/Save/Delete section (both
confirmed 2026-08-15): (1) remove the grey shading -- .edit-bottombar
drops its --color-page-bg background (and with it the padding/radius
that only existed to shape the grey panel, if removing them reads
cleanly against the card); (2) more separation above Delete --
.edit-delete-btn margin-top var(--space-sm) -> var(--space-md)
(Claude's value, user said "increase").

**As built (V3.51.1), verified end to end:** all ten items. The one
mechanism deviation from the spec draft, deliberate and better: the
Sabaq Dhor quarter rows are NOT CSS-hidden — renderSabaqDhorRows now
skips rowsHtml entirely while sabaqDhorEditingId is set (loader
re-renders before prepopulating the manual fields; cancel clears the
id and re-renders, quarter rows return). CSS-hiding some of a shared
grid's children would have let the survivors reflow into the wrong
columns (auto-placement) — structure over symptom, the V3.45.6-.11
lesson; the weak .sabaq-dhor-row-text hide was deleted, the manual
checkbox + new .sabaq-dhor-group-label hides stay (ID-scoped, winning
specificity). Popup: card's rail sizing neutralized (width:100%,
max-width:none) — the >=1180px max-width:30% was the illegible strip;
cap 88vh → 75vh both places; .edit-popup-card position:relative
anchors the X, now absolute top-right. Headings "Edit Sabaq"/"Edit
Sabaq Dhor"/"Edit Dhor" + date control; topbar+bottombar grey fills
removed; .card-date-row hidden in edit (the 44px gap); active Save =
white/evergreen-border (solid green unique to Changes confirmed);
Delete margin --space-md. Verified: 18 new checks — including driving
the REAL renderSabaqDhorRows through normal → edit → normal and
asserting the quarter rows leave and return with the manual fields
intact — plus all four prior harnesses re-run green (37+24+31+27,
two expectations updated to the intended V3.51.1 reality) = 137/137.

## Done — V3.51.0 (2026-08-14): Edit screens redesigned as popups, editable dates/portions, new confirm flow — built to the spec below

**Main Dhor page (small fix):** the Quarter/Half/Juz pill touches the
Juz/portion row below — V3.50.2's label removal took the spacing those
labels provided. Fix: margin-top var(--space-sm) on
#dhorJuzPositionRow (Claude's value).

**Date editing, ALL THREE log cards (confirmed):** Dhor's loader never
sets dhor_date (display bug); Sabaq and Sabaq Dhor display correctly
but silently DROP a changed date on save — 'date' is in none of the
three workers' update whitelists (updateLog filters unknown fields
silently). Fix: 'date' added to FIELDS in sabaqLog.js /
sabaqDhorLog.js / dhorLog.js; each edit form sends it. DEPLOY ORDER:
worker first or together. Documented limitations (not solved): no
duplicate re-check on update (insert-only by design); attendance is
not re-evaluated when an entry moves dates.

**Edit screens become popups (confirmed):** instead of the V3.22.0
full-screen takeover, editing opens like the History popup — a
body-level .modal-overlay with the other screens visible beneath.
Mechanism: the card element itself is MOVED into the overlay's
modal-card on edit enter and moved back on exit (the V3.50.0
relocation pattern scaled up — reuses every live field/listener,
and avoids CSS-elevating inside the horizontally-scrolling rail,
the position-fixed-inside-scroller Safari trap from V3.34.x).
Claude's flagged call: tap-outside does NOT close the edit popup
(unlike History) — unsaved changes deserve an explicit X, not an
accidental dismissal.

**Shared edit redesign, ALL THREE cards (confirmed — Dhor's earlier
spec extended to Sabaq and Sabaq Dhor):**
- X-close icon top-right of the popup = Cancel (abandon changes).
- Heading row: "Editing <type> entry for [date selector]" — the
  selector shows the entry's real date, fully editable.
- The confirm checkbox, Plan button (Dhor), and the icon bottombar
  (CANCEL/DELETE/UPDATE) all removed while editing.
- "Confirm changes" button: greyed/disabled until any field differs
  from the loaded entry (dirty snapshot: date, range/portion,
  mistakes, tags, duration, lines/pages, notes+private as each card
  has them); active green when dirty; tapped = confirmed, solid green
  reversed text. "Save" text button to its right: greyed until
  confirmed, then active green; performs the update. Any change after
  confirming drops back to unconfirmed (flagged rule).
- Red Delete below, same pop-up confirmation as the existing delete.

**Portions become editable (confirmed):**
- Dhor: the Juz picker + portion switch + Quarter/Half/Juz pill appear
  in the edit popup exactly as on the log detail (same elements — the
  card moves whole, so edit mode simply stops hiding
  dhorAmountRow/dhorSegmentPicker and prepopulates them from the
  entry). Claude's flagged approach for the unrepresentable case:
  entries whose segment reduces cleanly to amount+juz+position get the
  live picker; plan-path raw-range entries keep a greyed READ-ONLY
  portion box instead (the picker physically cannot express them —
  the original reason for the old exclusion, now scoped to only the
  entries it truly applies to). REVISED 2026-08-14 (user, confirmed
  against shared/data.js): the edit picker runs in the student's
  CURRENT mushaf ref, and ref conversion is trivial at Dhor
  granularity — Dhor's vocabulary is the LABEL triple (juz, unit,
  position), which maps 1:1 across systems by construction
  (unitMarkerCount already normalizes: 'quarter' = exactly 1/4 juz in
  either ref — 1 waterval marker, 2 uthmani). Mismatched-ref entries
  just decompose in the stored ref and re-emit the same triple in the
  current ref via the existing segmentsPerJuz/unitMarkerCount math —
  no boundary data involved, no failure mode. Saving re-stamps ref to
  current (worker FIELDS accepts 'ref' — checked). The ONLY read-only
  fallback is ref-independent: plan-path raw ranges that don't reduce
  to a clean triple at all. (Sabaq Dhor needs none of this — its
  ayah-level From/To is physical-coordinate, ref-independent, per the
  user's point.)
- Sabaq Dhor: the manual From/To surah:ayah pickers (V3.45.14) show
  in the edit popup prepopulated from the entry's range; the two
  quarter-section rows and the manual row's own checkbox hide while
  editing (Confirm changes replaces the checkbox role) — flagged
  layout call. Worker already accepts the range fields.
- Sabaq: range fields (sabaq_from/sabaq_to) already editable via its
  normal form; gains the new confirm flow + popup + editable date.

**History popups titled (confirmed):** the hardcoded <h2>History</h2>
becomes the per-type label already computed for the button — "Sabaq
History", "Sabaq Dhor History", "Dhor History", "Tadabbur History".

Scope: worker-touching (3 files, one-line each). One zip both repos
(worker files identical across repos apart from wrangler config —
verify at build).
**As built (V3.51.0), verified end to end — DEPLOY ORDER: worker files
FIRST (or together): the old worker silently drops the new 'date'
field, so frontend-alone would make date edits silently no-op.** Worker:
each of the 3 log files gained `const UPDATE_FIELDS = [...FIELDS,
'date']` (the V3.44.1 reflections.js pattern — NOT added to FIELDS,
which insertLog consumes positionally) and updateLog switched to it;
inserts untouched. Popup: enterEditScreenMode/exitEditScreenMode
rewritten — the card MOVES into a body-level overlay (same-class
placeholder keeps the rail slot, so layout/scroll never shift), no
tap-outside close; the three takeover CSS rules deleted; the card's
takeover-era viewport-height formula overridden to popup sizing.
Shared flow (logDetailScreen.js): initEditFlow polls collect() vs a
load-time snapshot every 300ms — polling deliberately, since surah/
tajweed pickers write via JS with no events — driving Confirm changes
(disabled → .ready → .confirmed with re-dirty reset) and gating Save;
moveDateIntoEditSlot/restoreDateFromEditSlot relocate each card's own
date control into the heading. Dhor: strict segmentRangeToTriple
(returns null for raw ranges — spans-juz/odd/misaligned; the old
segmentRangeToPicker deliberately never rejects and stays for display)
+ tripleToPositionInJuz; the edit picker prepopulates via decompose-in-
stored-ref → re-emit-in-current-ref and saves re-stamp ref (verified by
unit tests incl. a cross-ref uthmani→waterval round-trip);
saveDhorEdit() extracted; 'park' relocation deleted everywhere (box
CSS-hides in edit). Sabaq/Sabaq Dhor edit saves gated by the flow (new-
entry checkboxes untouched); Sabaq's Save button drives the existing
full handler (its frontier-position logic rides along); Sabaq Dhor's
payload gained date + the range from the prepopulated manual From/To
(both-sides validation), cancel clears them. History h2 → per-type
label. Verified: 37 new checks (decompose math, popup round-trip, flow
state machine, markup/wiring/CSS/worker contracts) + all three prior
harnesses re-run green against the changed files (24 updated + 31 + 27)
= 119/119.

## Done — V3.50.2 (2026-08-14): Tadabbur header rework + Dhor/Sabaq UI set — built to the spec below

Reported via screenshot: Tadabbur's Save and X-close overlap on mobile.
Root cause traced: the X-to-Home is absolutely positioned at the card's
top-right corner (V3.45.1), independent of the header grid, while the
header's 10/70/20 grid puts .card-header-save-wrap in the rightmost 20%
column — directly under the floating X on narrow screens.

**Confirmed decisions (2026-08-14):**
- Tadabbur adopts the V3.45.9 title-group pattern, with Save taking
  the position the timer occupies on the other cards ("save will
  replace the timer" — Tadabbur has no timer): the existing
  .card-header-save-wrap (status + button, internal layout untouched)
  moves inside a .card-header-title-group next to the "Tadabbur"
  heading, following wherever the text ends. Grid stays 10/70/20; the
  3rd column is left empty, giving the floating X clear space —
  overlap resolved at the root, not nudged.
- Log detail cards (Sabaq / Sabaq Dhor / Dhor): timer icon slightly
  bigger and slightly right. Claude's chosen values (user explicitly
  deferred values): svg 20px -> 24px, plus margin-left var(--space-xs)
  on the timer button inside the title group (doubling the effective
  heading-to-timer gap to 8px).

- Dhor UI set (2026-08-14, folded in per the include-in-this-revision
  decision):
  1. The Plan button leaves row 2 and moves to the bottom of the card,
     below Notes ("botes" read as Notes). The vacated row then FOLLOWS
     SABAQ/SABAQ DHOR'S OWN DATE-ROW LAYOUT (confirmed): date pill
     left, History button right — Dhor's bespoke 40:30:30
     date:Plan:History row (V3.24.0) is replaced by the same
     .card-date-row pattern the other two cards use. At build: trace
     every --dhor-row2-h / .dhor-row2 dependency before removing.
     Plan keeps its styling; placed below Notes at 30% width,
     left-aligned (confirmed 2026-08-14, replacing Claude's earlier
     flagged full-width guess).
  2. Quarter/Half/Full pill moves slightly lower (more gap above it).
  3. Pill text "Full" -> "Juz" — DISPLAY TEXT ONLY; the internal
     data-value 'full' and all dhorPage.js logic untouched.
  4. The "Juz" label text above the juz picker removed — and with it
     the invisible &nbsp; placeholder label beside it that only
     existed to match its height, so the controls rise together
     (checkbox alignment unaffected: align-self:end + 42px height).
  5. Dhor confirm checkbox nudged right — gap from the 1|2 portion
     switch widens (Claude's value: margin-left var(--space-sm)).
  6. Sabaq confirm checkbox likewise nudged right within its group
     (Claude's value, same treatment).
  7. Dhor's History button label "History" -> "Dhor History"
     (confirmed 2026-08-14) — one word in dhorPage.js's
     HISTORY_BTN_LABEL map, matching the naming every other card
     already uses (Sabaq History / Sabaq Dhor History / Tadabbur
     History).
- Tadabbur icon-to-heading gap reduced by moving the text left
  (confirmed 2026-08-14, and likely what the earlier cut-off "Also the
  Icon- Tabsabbir" line meant): the header grid's fixed 10% icon
  column holds the heading at a set distance regardless of the icon's
  actual width — the icon column becomes max-content (auto-sized to
  the icon) for Tadabbur so the heading sits directly beside it. Can
  extend to the other cards later if wanted; scoped to Tadabbur per
  the request's wording for now.

**As built (V3.50.2), verified end to end:** one identical file set for
both repos (index.html, css/detail-pages.css, js/dhorPage.js, js/sw.js
+ docs). Tadabbur: save-wrap moved inside .card-header-title-group
after the h2 (V3.45.9 pattern), row gained .tadabbur-header-row with
grid max-content 1fr 32px — icon column hugs the icon, empty 32px
spacer reserves the floating X's corner. Timer icon 20→24px +
margin-left --space-xs (three log cards). Dhor: .dhor-row2 markup and
ALL its scoped CSS rules deleted; row 2 now literally the same
.card-date-row structure Sabaq uses (rail gained .history-container,
History button picks up the general .history-btn sizing; the
--dhor-row2-h property kept — .card-date-row, the amount switch, and
Tadabbur's date row still size from it). Plan button relocated after
#dhorCommentBlock at 30% width left-aligned, id and .dhor-row2-btn
styling preserved (that rule now stands alone). Amount pill margin
--space-sm→--space-md. Pill text Full→Juz, data-value untouched
(verified no 'Full' string dependency in dhorPage.js). Both labels
removed from the Juz row (select gained aria-label="Juz");
renderDhorPositionOptions traced — toggles classes by id only, labels
never referenced. Dhor checkbox margin-left --space-sm; Sabaq group
columns 1fr 44px/40px → 1fr auto with the same margin. HISTORY_BTN_LABEL
dhor → 'Dhor History'. Verified via jsdom on the real files: 27/27 new
checks, PLUS both prior harnesses re-run green against the changed
markup (28/28 confirm-box relocation, 31/31 date wiring) = 86/86.

## Done — V3.50.1 (2026-08-14): BUG, log detail cards' date selector not opening on iOS — fixed to the spec below

Symptom: tapping the date display on Sabaq / Sabaq Dhor / Dhor does not
open the date picker. Root cause is NOT in this codebase's logic — it
is WebKit bug 268114 (open since 2023, still unresolved): showPicker()
for date inputs has NEVER been implemented on iOS, where native pickers
are tied to element focus. js/customDate.js's tap handler (2026-08-03)
only falls back to focus()+click() when showPicker is ABSENT or THROWS
— but on current iOS the method exists and silently does nothing, so
the catch never fires, the fallback never runs, and nothing opens. An
iOS update changing what showPicker exposes flips this overnight with
zero code change on our side, which matches "suddenly, all cards at
once". A jsdom test against the real shipped files confirmed the
wiring itself is intact (tap reaches showPicker on all 3 cards).

Why Tadabbur alone still works (confirmed 2026-08-14, and it seals
the diagnosis): its date input was never wired into customDate.js —
the wiring list predates Tadabbur's date field (V3.44.1, six days
after customDate shipped) and was never updated — so it's a bare
native input, i.e. already the direct-tap pattern the fix uses.

Fix (updated 2026-08-14 with the user's styling direction from the
Tadabbur screenshot): drop the showPicker dependency entirely. The
native date input becomes the tap target — .native-date-hidden loses
pointer-events:none and gains z-index above the display, so a tap is
a DIRECT user tap on a real date input, which iOS opens reliably and
always has. The display becomes purely visual (aria-hidden, not a
button — avoids a double tab stop; the input keeps an aria-label),
the click handler + showPicker branch in customDate.js is deleted
outright, and the value-override re-render mechanism stays untouched.
Identical behaviour on desktop.
- ALL FOUR cards, Tadabbur included: 'tadabbur_date' joins the wiring
  list, so it gains the custom format too ("change all to ddd DD-mmm",
  confirmed — e.g. "Thu 14-Aug"; the native display it currently shows
  can't be reformatted, which is the whole reason customDate exists).
- PILL styling, all four ("change all to pills", confirmed — user
  prefers Tadabbur's iOS-native pill look over the current bordered
  box): .custom-date-display drops its border + --radius-sm box for a
  fully-rounded pill (border-radius 999px, borderless light-neutral
  background echoing the iOS pill, centred text, comfortable
  horizontal padding). Dhor's --dhor-row2-h height coupling checked at
  build so the pill height stays consistent with its row.
Files: js/customDate.js, css/detail-pages.css, index.html (version
bumps), js/sw.js. One zip for both repos.

**As built (V3.50.1), verified end to end:** js/customDate.js rewritten
— the display is now an aria-hidden <span> (not a button: no second tab
stop), the input gains aria-label="Date", the click handler and every
showPicker code path are deleted outright (showPicker survives only in
comments explaining the WebKit bug), and 'tadabbur_date' joined the
wiring list, so all four cards share both the working direct-tap picker
and the "DDD dd-MMM" format. CSS: .native-date-hidden trades
pointer-events:none for z-index:2 + cursor:pointer (the input IS the
tap target now); a :focus-visible sibling rule rings the pill when the
invisible input has keyboard focus; .custom-date-display became the
pill (border-radius 999px, borderless, #E9E9EB iOS-native neutral,
flex-centred since a span has no button layout of its own).
.card-header-date's own padding rule loses to the pill's later
equal-specificity rule — checked, not assumed. Verified via jsdom on
the REAL index.html + REAL rewritten customDate.js: 31/31 — all four
inputs wired/wrapped, span+aria contract, input-first sibling order,
programmatic value sets re-rendering (the reflectionCard.js path
Tadabbur relies on), change-event re-renders, and the CSS contract
(tap-target inversion, pill, focus ring). One note: the date shown
today reads "Fri 14-Aug" — an earlier chat message said "Thu 14-Aug"
in passing; the formatter was always right.

## Done — V3.50.0 (2026-08-12): Confirm-selection checkboxes restyled to the Sabaq Dhor pattern — built to the spec below

Both Sabaq's and Dhor's "Confirm selection" checkboxes restyled to
match Sabaq Dhor's established group/checkbox pattern (V3.45.6-.15:
one shared outer border, .checkbox-box 44x44 containers, scale-1.5
enlargement at >=768px). Reuses the IDENTICAL classes/tokens, not
approximations — per this project's own V3.45.6-.11 lesson.
Confirmed decisions (2026-08-12): bare checkbox, "Confirm selection"
text dropped on both cards (aria-label retained for accessibility);
checkbox SIZE enlargement applies to medium/large screens only —
mobile (<768px) keeps the native checkbox size, inherited automatically
from .checkbox-box's existing media query (V3.45.14-.15), same as
Sabaq Dhor today (confirmed 2026-08-12);
change ships to BOTH repos (original + personal) as two separate
builds — the repos diverged at V3.49.0 (original-only), so index.html
differs and one shared zip cannot serve both.

**Sabaq.** The standalone .cb-private-row confirm label goes away.
"Sabaq from" + "Sabaq to" (labels and verse-ref fields) wrap in one
visible bordered group styled identically to .sabaq-dhor-sections-list
(same border/background/radius/padding tokens). The confirm checkbox
(#sabaq_confirm, same id so sabaqPage.js logic is untouched) sits
INSIDE the group in a .checkbox-box to the right of the "Sabaq to"
field — same placement and size as Sabaq Dhor's manual To-row
checkbox; the From row gets the established empty-placeholder
treatment in that column. Grid: 1fr 44px (40px at >=768px, matching
Sabaq Dhor's own breakpoint adjustments).

**Dhor.** The standalone confirm label goes away. In the normal mode
the checkbox (#dhor_confirm, id unchanged) joins the Juz + portion
picker-row as a third grid column (1fr 1fr auto; the
.picker-row-single collapse becomes 1fr auto), right-aligned, in a
.checkbox-box. CRITICAL, traced in dhorPage.js: the confirm hard-block
applies to every save path, but dhorSegmentPicker (which contains that
row) is HIDDEN in two modes — plan-range mode (enterDhorRawRangeMode,
V3.24.0) and edit mode (loadDhorEntryForEdit) — so the checkbox cannot
live only there. It is ONE element relocated by the four existing
mode-transition functions (enter/exitDhorRawRangeMode,
loadDhorEntryForEdit/cancelDhorEdit): normal mode = in the Juz row as
above; plan-range mode = right end of dhorRawRangeRow (assumption,
flagged); edit mode = its own right-aligned slim row where the picker
would sit (assumption, flagged). Behaviour unchanged everywhere: same
hard-block until checked, same auto-clear after save.

**Versioning note (flagged):** ships as V3.50.0 in BOTH repos; the
personal repo's history will show a documented gap (V3.49.0 = Juz
Tracker Free play, original repo only, never ported).

**As built (V3.50.0), verified end to end:** one changed-file set,
identical in both repos (verified by diff — after the user uploaded
V3.49.0 to both, the repos differ only in the intentional personal-only
files: appicons, js/api.js, worker/*), so ONE zip serves both uploads.
The versioning-gap note in the earlier spec draft is obsolete — V3.49.0
went to both repos after all. Sabaq's group reuses .checkbox-box and
the group-border tokens verbatim (mobile keeps native checkbox size
automatically via the existing >=768px media query, confirmed
2026-08-12). Dhor's box is one element relocated by the four existing
mode-transition functions; the with-confirm picker-row variant composes
with V3.26.1's picker-row-single collapse. Verified via a jsdom harness
loading the REAL index.html and executing the REAL functions extracted
verbatim from the shipped dhorPage.js: 28/28 checks — initial placement,
raw-mode round-trip (checked state surviving the move), edit-mode
parking and restore, all four transition call sites present in the
shipped file, Sabaq's 8-child grid landing the checkbox on the To row,
aria-labels, and both save handlers still reading their unchanged ids.
Both stale 2026-08-05 comments describing the removed label rows were
cleaned out; .cb-private-row survives untouched for the Private
checkboxes that still use it.

## Done — V3.49.0 (2026-08-12): Juz Tracker "Free play" mode — built to the spec below

A fidget-toy mode for the Kaaba tracker. Grounded in direct inspection
of js/kaabaTracker.js: 48 tiles total (16 roof + 16 per side wall); 30
carry juz numbers (roof + the two lower wall rows); the two upper wall
rows (8/side, where the gold kiswah band polygons sit), and the 2 door
tiles (gold door drawn on top in .door-grp) are currently inert
structure, always dark. The component's existing `labels` option
already removes the "Juz N" numbers.

**Confirmed decisions:**
- Toggle lives INSIDE the tracker header row on the Juz Tracker
  screen. Screen ALWAYS opens in normal tracker mode; free play is
  opt-in per visit and never persists ("always defaults to juz
  tracker").
- Selecting free play shows a blank, unnumbered Kaaba: all tiles
  light, band hidden, gold door hidden, nothing pre-marked from real
  progress ("untiled image").
- Every tile tappable: all 30 former juz tiles + the upper two rows on
  both sides, each toggling dark/light individually.
- Band strip separately active per side (left/right independent),
  3-state cycle: blank → strip black → black + yellow/gold band → back
  to blank.
- Door: same pattern as the band ("like the band", confirmed) — its
  two tiles act as one door unit, 3-state cycle: blank → tiles dark →
  dark + gold door graphic appears → back to blank.
- No saving of any kind: leaving the screen discards free-play state;
  the real tracker state (and its backend pool wiring) is never
  touched while playing.

**Assumptions Claude is making (flagging, not asking further):**
- While free play is active, the header's Save button and saved-status
  text hide (nothing to save), and the component's own completed-count
  display hides too; all restored on switching back.
- Taps landing on the band strip polygons drive the band cycle; taps
  on the rest of those upper-row tiles toggle that tile individually.
- Settings' embedded tracker is unaffected — free play exists only on
  the Juz Tracker screen.
- The band's "black" state colours the strip region itself (the
  polygons), matching the kiswah-cloth look, not the whole row.

**As built (V3.49.0), verified end to end:** free play lives in the
component itself (js/kaabaTracker.js) as a `mode="freeplay"` attribute
riding the existing attributeChangedCallback→_build() rebuild path —
tracker mode's markup and behaviour are byte-for-byte unchanged
(regression-checked). Free-play state is DOM classes + two tiny
in-memory counters only, discarded on every rebuild, so re-entering
free play always starts blank and the real tracker state (this._set)
is never touched while playing. The screen's toggle (juzTrackerScreen)
unconditionally resets to tracker mode on every entry and hides the
save-wrap and count/progress/Reset bar while playing. Verified with a
jsdom harness driving the REAL custom element — real shadow DOM, real
click events — 36/36 checks: tracker markup/behaviour unchanged,
free-play markup (46 individual tiles + 2 door tiles + door graphic as
one data-fpdoor unit + 2 per-side band groups, no juz data, no labels,
nothing pre-marked), tile toggles independent, band 3-state cycles per
side independent and never toggling underlying tiles, door cycling as
one unit from taps on either tile or the graphic, zero localStorage
writes, tracker state identical after a full free-play round-trip, and
blank-on-re-entry. Visual QA: all three states rendered and inspected
(blank / black-band+dark-door mid state / gold band+gold door).

## Done — V3.48.0 (2026-08-11): SIH Eraser — built to the spec below

Removes the colour from one specific surah region, distinct from the
existing Reset (which clears the whole picture). Fits the engine as-is:
a region's fill is already just "whatever its latest action says",
so an eraser is one more action type in the same list.

**Confirmed decisions:**
- Invocation: a third mode alongside Solid / Gradient — "Eraser". While
  active, tapping a coloured region clears it back to white. Tapping an
  already-white region does nothing (no-op — nothing to erase, no
  action recorded, matching how line/exterior taps are already ignored
  elsewhere).
- Undoable: yes — erasing pushes an {k, mode:'erase'} action onto the
  same undo stack as fills. Undo after an erase brings the region's
  previous colour straight back (it's still in the action before it).
- Chip: still appears, same look, with " — cleared" appended, e.g.
  "الرحمن · Ar-Rahman — cleared".

**Assumptions Claude is making (flagging, not asking further) —**
- Mode toggle becomes Solid | Gradient | Eraser. In Eraser mode the
  colour wheel, lightness slider, and swatches hide (nothing to pick)
  and a short instruction line takes their place: "Tap a coloured
  surah to clear it."
- Toolbar swatch button shows an eraser glyph instead of a colour
  circle while Eraser mode is active.
- New eraser icon added to js/icons.js (Lucide eraser), same normalized
  format as the other icons in that file.
- Save/export/migration all keep working unchanged: an erased region
  is simply absent from the "latest action per region" result, same as
  a region nobody ever touched.

**As built (V3.48.0), verified against the real shipped engine:**
erase is just a third action `{k, mode:'erase'}` on the same undo stack
as a fill — sihApplyFill/sihRecomputeFills treat it as "this region's
latest action says no colour", so save, export, and the v1 migration
all keep working with no special-casing beyond one guard in the export
SVG builder (an erase action carries no c1/c2). The Node harness
extended with 15 more checks against the real shipped code: no-op on
an already-white region (nothing pushed to actions), no-op on a
region freshly erased a second time, exactly one action pushed on a
real erase, chip text ends in " — cleared", Undo right after an erase
restores the exact prior colour (solid or gradient) and leaves the
action list exactly as it was before the erase, erasing one region
never touches a sibling region's fill, a full recompute-from-scratch
(the undo/reset code path) reproduces the erased state correctly, and
the export SVG builder doesn't crash on an erase action for a region
that was never painted. 43/43 checks total (28 carried over from
V3.47.0 unchanged, 15 new).

## Done — V3.47.0 (2026-08-11): SIH vector-region engine ("Option C") — built to the spec below

Replaces the pixel flood-fill engine to fix the white specks inside
letter counters at the root, chosen over two alternatives (owner-region
hole painting; adopting the reference site's traced geometry wholesale):

**Architecture (3 layers).** Bottom: optional background photo. Middle:
one closed vector shape per region (115: all 114 surahs, Ash-Shu'ara in
2 parts) — white by default, these are what get coloured AND what catch
taps. Top: the original artwork unchanged (lines + names, transparent
elsewhere), pointer-events off. Names sit ABOVE the colour, so letter
counters colour correctly by construction.

**Region shapes: generated offline by Claude** from the verified
segmentation of the ORIGINAL artwork's text-free lines layer, in the
artwork's own coordinate frame, dilated to tuck under the linework
(adjacent shapes overlap beneath lines — no seam gaps, no bleed past
lines; verified by rendering fills under the real artwork). NOT the
reference site's geometry — that tracing deviates mean ~1.6 / 95th ~5
viewBox units from the original lines (measured), too far to sit under
the original art. Surah identity ({n, ar, en}) per shape transferred
spatially from the reference site's tagged data, cross-checked. Ships
as assets/quran-heart-regions.json.

**Confirmed decisions:**
- Export: keep 1191x1684 (offered higher — declined).
- Taps exactly on boundary lines: keep ignored (as today) — via the
  text-free lines layer as a hit-test mask, so this does NOT re-ignore
  the names.
- Taps on printed surah names: fill their region (recommended option,
  confirmed) — names become natural big tap targets.
- Chip: brief transient popup after each fill naming the surah
  ("الرحمن · Ar-Rahman"), fades — useful zoomed out where printed
  labels are unreadable.
- Save format moves from tap-coordinates to region ids; silent
  one-time migration converts any V3.46.0-saved picture on first load.
- Everything else carries over unchanged: colour picker, solid/vertical-
  gradient modes (gradient = per-region SVG linearGradient), undo,
  save-per-user semantics + wording, reset wording, background
  add/remove (never persisted, around the heart only via the white
  default fills), export with/without-background prompt only when a
  background is loaded, desktop panel + mobile toolbar/sheets, zoom/pan
  gestures (now vector-crisp at every zoom level).

**As built (V3.47.0), verified end to end:** region shapes traced from
the artwork's own text-free segmentation at 4x, audited at export
resolution with a real SVG rasterizer under the composite-visibility
criterion: 100% coverage of every region, 0 foreign-colour pixels
visible in the exterior or inside any region (one sub-perceptual
anti-aliased seam pixel at x=0 where the artwork itself is clipped by
the viewBox — unavoidable in principle, documented). Surah identity
transferred spatially from the reference site's tagged data as a clean
115/115 bijection and independently verified by three glyph anchors
(ص→Sad, طه→Ta-Ha, the "Al-Anfal" hyphen→Al-Anfal), full 1–114 n
coverage, and name cross-check against shared/data.js (2 diffs, both
transliteration variants — chip uses the app's surahName(n)). A Node
harness executed the real shipped js/sihScreen.js against the real
shipped assets: 28/28 checks, including label-tap fills, boundary-line
taps ignored via the text-free mask, gradient defs, undo/save/restore,
per-user key, the v1→v2 migration mapping every old-format tap to its
independently-computed region, transform commit, and a self-contained
export SVG.

## Done — V3.46.0 (2026-08-11): "Surahs in my Heart" (SIH) — built to the spec below, agreed 2026-08-11

A relaxation/connection activity: the user colours in a heart artwork
divided into all 114 surah regions as they memorise them. Deliberately
NOT connected to any progress marking anywhere in the app — purely a
creative space.

**Artwork.** User-supplied `Quran_Heart_-SVG4.svg` (anatomical heart,
viewBox 595×842, all 114 surahs as labelled regions, Arabic + English).
Inspected directly: no per-region ids — the 1,603 paths are the black
outlines and outlined label text; regions are the white space between
lines. Therefore the implementation is canvas-based flood fill, not
per-path SVG fills. The artwork file itself needs no changes.

**Colouring interaction.**
- Tap a region → fill it. Two fill types: solid colour, and
  colour-gradient fill (two-colour gradient within the region).
  No freehand brush (explicitly decided against after sizing it —
  the contained-brush masking work roughly doubles the build).
- Multi-step undo.
- Surah labels/outlines stay black on top of fills (natural
  consequence of flood-fill bounded by the black line art).

**Palette.** Full free colour picker: hue wheel + lightness slider
(explicitly chosen over a fixed swatch set) — the "tones and shades"
requirement, enabling genuinely rich images.

**Background image.**
- User can upload a background image; it sits only AROUND the heart —
  heart regions stay opaque (white or coloured), never see-through.
- Background can be changed/deleted separately at any time.
- The uploaded image itself is NOT persisted — re-uploaded per session
  if wanted. Only the colouring state is saved.

**Persistence.**
- Explicit Save button. Saved to LOCAL DEVICE only for now (no D1
  table, no Worker routes, no server work in this phase).
- App remembers the last saved picture and restores it on entry.
- One picture per user.
- Reset clears colours only (background handled separately, above).

**Canvas resolution.** Fixed internal resolution (~2× viewBox ≈
1190×1684) regardless of device, displayed scaled to fit the screen —
so exports are always crisp and identical across devices. This
decision replaced the "full vs screen resolution" question entirely.

**Export.** Save as PNG; at export time the user chooses with or
without the background image. Exports at the fixed internal
resolution.

**Layout & zoom.**
- Large screens: the heart image takes up to 75% of the screen, with
  the controls (palette, fill type, undo, background, save/reset/
  export) in a fully-expanded panel on the left-hand side.
- Mobile: controls roll up. A slim always-visible toolbar (current
  colour swatch, solid/gradient toggle, undo, Zoom to fit, menu
  button); tapping the swatch slides the hue wheel + lightness
  slider up as a bottom sheet over the lower canvas, and the menu
  button does the same for background/save/reset/export. Tap the
  canvas or a close chevron to roll back down — the heart stays
  maximally visible while colouring.
- Zoom: pinch/scroll zoom + pan on the canvas (several of the 114
  regions are small — zooming makes tapping them precise). The
  "Zoom to fit" button resets the view so the whole heart fits on
  screen again (confirmed reading).

**Navigation.** New NAV_ITEMS entry + auto-mirrored Home tile, label
"Surahs in my Heart", icon = a simple heart glyph in the existing
icon style (`js/icons.js`).

**As built (V3.46.0), verified against the real artwork + real code, not assumed:**
the artwork rendered at the fixed internal resolution segments into
exactly 115 fillable regions (114 surahs + one small unlabelled vessel
shape) with zero leaks between neighbours at every alpha threshold
tried; the exterior is detected as the CORNER-connected region, because
two real surah regions on the artwork's left edge are clipped by the
viewBox and genuinely touch the border. A Node harness executed the
real js/sihScreen.js against the real pixels: 21/21 checks passed
(region count, containment/no-leak on fill, dilation staying within
bbox+2 and never touching another region, exterior/text-hole/line taps
ignored, gradient orientation, undo as a pure function of remaining
actions, save/restore round-trip byte-identical, per-user storage key,
reset correctness). Visual composition also inspected directly: no
white halos at fill edges, labels stay crisp on top.

## Done — V3.45.15 (2026-08-11)

3 items: fixed a real V3.45.10 regression, added a genuinely-abortable
duplicate-save confirmation across all 3 log cards, and refined Sabaq
Dhor's own checkbox sizing further.

- [x] **Manual field now correctly clears after a Sabaq Dhor save** —
  the save handler already re-rendered the whole screen after success
  (an earlier, separate fix), but V3.45.10's state-preservation logic
  couldn't tell that re-render apart from an in-progress rollup-toggle
  one, so it was preserving the just-saved values right back onto the
  "fresh" screen. Fixed by explicitly clearing the manual field's own
  DOM state immediately before the re-render runs, rather than
  threading a distinguishing parameter through multiple functions —
  verified directly against the real file that this clear sits after
  the save call and before the re-render, exactly where it needs to.
- [x] **Duplicate-save confirmation, all 3 log cards, genuinely
  abortable this time** — the real architectural piece: `insertLog`
  (`worker/src/logHelpers.js`) previously always inserted regardless
  of duplicate status. It now takes a `force` parameter — when a
  duplicate is found and `force` isn't set, it returns
  `{ isDuplicate: true }` WITHOUT inserting anything at all, so a
  student can genuinely cancel before anything is written. Verified
  directly against the real function with a simulated database across
  5 scenarios (first entry inserts normally, an identical repeat is
  correctly blocked with nothing actually written, the same content
  forced through afterward inserts and is correctly flagged,
  genuinely different content isn't blocked, the same content from a
  different student isn't blocked either) — all pass. Each of the 3
  worker handlers (`sabaqLog.js`/`sabaqDhorLog.js`/`dhorLog.js`) passes
  `body.force` through and now guards its own plan-linking/attendance-
  marking steps on `result.id`, since neither should run against an
  entry that wasn't actually inserted yet. Frontend: each of the 3
  save handlers shows the exact specified native message
  ("This entry has already been saved. Select OK to continue with
  saving or CANCEL to abort") when a save comes back duplicate-
  flagged-without-an-id, OK re-sends the same payload with
  `force: true`, Cancel leaves the form untouched with nothing sent.
  Dhor's own save handler needed particular care here — it has a
  pool-update step after the save that must not run at all until a
  genuine save has actually happened, not just on the first,
  possibly-duplicate attempt.
- [x] **Checkbox refined further** — scale reduced from 1.8 to 1.5
  ("a little smaller"), plus a new left margin on `.checkbox-box`
  separating it from the range/picker box beside it — the grid's own
  3rd column grown from 36px to 40px to correctly accommodate the
  checkbox-box's width plus this new margin together, avoiding an
  overflow that would have resulted from adding a margin to an element
  already exactly matching its own column's width. Same medium/large-
  only scope as V3.45.14; this is a different edge (left) than that
  version's own right-edge space reduction, not a reversal of it.
- [x] All syntax checked (frontend via Node, worker files via Node's
  own module-syntax checking) and CSS balance verified before
  delivery.

## Done — V3.45.14 (2026-08-11)

Two changes: Sabaq Dhor's checkboxes made genuinely bigger on medium/large
screens (plus the requested space reduction), and its manual field
rebuilt as a real From/To range instead of a single ayah.

- [x] **Checkbox size, medium/large only** — `transform: scale(1.8)` on
  the native checkbox input itself, not width/height directly (that
  approach doesn't reliably hold up across browsers, per this app's
  own V3.45.5 history). `.checkbox-box`'s own container width shrinks
  from 44px to 36px at the same breakpoint (height stays 44px,
  matching the other 44px elements on the row), and the outer group's
  right-edge padding trims down too — confirmed via an annotated
  screenshot as covering both readings of "the space to the right of
  the checkbox" together, not one or the other. Mobile completely
  untouched.
- [x] **Manual field rebuilt as a genuine From/To range** — "exactly
  like the Sabaq card," which already has this exact shape. 3 core
  functions generalized to take a `side` parameter (`'from'`/`'to'`),
  the same established pattern Sabaq's own `renderVerseRefField(side)`
  already uses, not invented fresh. The one shared confirmation
  checkbox sits beside "To" specifically, confirmed directly ("the
  user chooses from and to and then confirms") — "From"'s own row gets
  an empty placeholder in that column instead, same pattern "Quarter
  2"/"Quarter 1" already use when they have no Move-to-Dhor button.
  `.sabaq-dhor-sections-header` (removed entirely in V3.45.11) is
  re-added for a different purpose this time — From/To's own labels,
  not "Set Sabaq Dhor"'s old single heading — now including a
  `margin: 0` reset from the start, since V3.45.12's own margin
  discovery came after this class was first removed.
  `compositeCheckedSabaqDhorRows` reads both sides into a genuine
  2-point range now, falling back gracefully (excluding the manual
  entry entirely, not crashing) if only one side is filled in.
- [x] State preservation across re-renders (the mechanism V3.45.10
  first built) extended to cover both From and To together, not just
  one point — verified directly against the real function body: 7
  structural checks on the actual generated markup plus 5 scenarios
  run against the real `compositeCheckedSabaqDhorRows` body (genuine
  range preserved, graceful fallback when one side is empty, a range
  correctly spanning a different surah, an unchecked manual value
  correctly ignored, nothing checked at all) — all pass.
- [x] All syntax/CSS balance checked before delivery.

## Done — V3.45.13 (2026-08-10)

Sabaq Dhor's large- and mobile-screen layouts refined after live checks;
the already-correct medium breakpoint is unchanged.

- [x] Large grid now sizes to its content, uses max-content implicit rows,
  and packs rows at the start instead of stretching the first rows vertically.
- [x] Large outer group retains its border with compact 4px vertical padding
  and the existing 4px spacing between rows.
- [x] Roll-up visibility now exposes an explicit `.rollup-inactive` state when
  neither direction is available.
- [x] Mobile removes only the inactive roll-up gutter, preserving genuinely
  available roll-up controls.
- [x] Mobile checkbox track reduced from 44px to 32px without changing its
  44px height or moving the checkbox inside the field border.
- [x] Mobile column gaps and horizontal outer padding reduced from 8px to 4px,
  returning width to the field column to prevent the current-quarter wrap.
- [x] No rules added for 768-1179px; the medium rendering remains unchanged.
- [x] All CSS/JS version references synchronized at V3.45.13.

## Done — V3.45.12 (2026-08-10)

Sabaq Dhor's 3 fields now sit as compact, equally aligned bordered rows
inside the existing outer group border.

- [x] Kept the existing outer border, background, radius, and padding
  around the complete 3-row group.
- [x] Restored an individual border around each of the 2 quarter fields
  and the manual surah:ayah picker.
- [x] Kept every checkbox outside its associated field border but inside
  the outer group border, in the existing fixed 44px checkbox column.
- [x] Reset the generated `<label>` rows' inherited top and bottom margins
  so all 3 rows use only the same 4px grid gap.
- [x] Kept the 44px minimum field height and 44px checkbox container height,
  giving the 3 rows equal height when text remains on one line while still
  allowing a narrow-screen label to wrap without clipping.
- [x] Preserved the shared-grid architecture and optional Move-to-Dhor
  column; no JavaScript, save logic, or data handling changed.
- [x] Synchronized every `index.html` and `js/sw.js` CSS/JS version reference
  at V3.45.12.

## Done — V3.45.11 (2026-08-10)

Sabaq Dhor's 3 rows visually consolidated into one clean group — a single
shared border instead of 3 separate ones, one heading instead of two,
and even spacing throughout as a direct consequence rather than a
separately-chased fix.

- [x] **One shared border, not 3 separate ones.** `border`/`border-radius`/
  `background`/outer `padding` moved from each individual row
  (`.sabaq-dhor-row-text`/`.verse-ref-field`) up to
  `.sabaq-dhor-sections-list` itself — the whole grid now reads as one
  visual container, with all 3 rows genuinely inside it rather than each
  drawing its own box. Each row's own internal padding (breathing room
  within its own cell) stays, kept separate from the group's own outer
  edge.
- [x] **The manual field's own border-removal scoped precisely** —
  `#sabaqDhor_sections > .verse-ref-field { border: none; background: none; }`,
  not a change to the shared `.verse-ref-field` rule itself, which
  Sabaq's own From/To fields also use and still need their individual
  border untouched.
- [x] **"Set Sabaq Dhor" heading removed entirely** — one shared border
  around all 3 rows already makes clear on its own they're the same
  "Confirm Sabaq Dhor" action, so a 2nd heading became redundant.
  `.sabaq-dhor-sections-header`'s own CSS rule and its markup in
  `js/sabaqDhorPage.js` both removed.
- [x] **Even spacing resolved as a direct consequence, not a separate
  fix** — the previously-larger, inconsistent gap before this row was
  specifically that removed heading's own inherited `margin-top` sitting
  on top of the grid's `row-gap`. With the label gone, every row
  transition now has nothing but that same `row-gap` between it,
  matching the "Quarter 2"-to-"Quarter 1" spacing exactly, confirmed
  directly by the user as already looking right.
- [x] No dangling comments left behind — the explanatory comment that
  used to describe the now-removed `.sabaq-dhor-sections-header` rule
  was found and removed along with it, not left orphaned.
- [x] All syntax/CSS balance checked, every reference to the removed
  heading confirmed genuinely gone from both files before delivery.

## Done — V3.45.10 (2026-08-10)

Sabaq Dhor's "Set Sabaq Dhor" rebuilt as a genuine 4th part of the same
shared grid "Quarter 2"/"Quarter 1" already share — the architectural fix,
not another round of patching values to match across 2 separate contexts.

- [x] **User's own proposal**, confirmed fixable with real evidence before
  building: extends V3.21.2's own "every checkbox genuinely shares the
  same column" principle (already proven for the 2 section rows) to
  include the manual field as a 3rd row in that same grid.
- [x] **The real risk, confirmed and solved directly**: `#sabaqDhor_sections`
  gets its entire `innerHTML` rebuilt from scratch 4 separate times
  during normal use (initial load, Move to Dhor, both rollup-merge/split
  toggles) — moving the manual field inside that same container meant
  every one of those, including an ordinary rollup-toggle tap mid-entry,
  would wipe out whatever a student had already entered there.
  `renderSabaqDhorRows` now reads the manual field's live state (its
  surah:ayah value, its checkbox) BEFORE clearing `innerHTML`, and
  reapplies it to the freshly-created nodes AFTER — the same "rebuild +
  re-wire" pattern this function already used successfully for the
  Move-to-Dhor buttons, just extended to cover one more element. Verified
  directly against the real function body (not a reimplementation): 4
  state-preservation scenarios (blank on first render, value+checkbox
  surviving one re-render, value surviving with checkbox left unchecked,
  value surviving 2 consecutive re-renders) all pass, plus 6 structural
  checks confirming the actual markup/operation-ordering is correct.
- [x] **"Set Sabaq Dhor" (the label) is now a genuine grid item** spanning
  all 3 columns (`grid-column: 1 / -1`, new `.sabaq-dhor-sections-header`
  class) — CSS grid auto-places a full-span item onto its own row, so it
  correctly sits between "Quarter 1"'s own row and the picker row without
  breaking the grid's continuous flow.
- [x] **V3.45.9's invisible-spacer hack is gone** — no longer needed. The
  picker field now naturally occupies this grid's same `1fr` first column
  "Quarter 2"/"Quarter 1" use, with a genuine empty `<span></span>` in the
  2nd column (the same placeholder those rows already use when they have
  no Move-to-Dhor button) rather than a hidden button faking that
  column's width.
- [x] **Height and left-alignment resolved as a natural consequence** of
  all 3 rows now genuinely sharing identical column tracks — not
  something matched after the fact. `min-height: 44px` kept (scoped to
  `#sabaqDhor_sections > .verse-ref-field` now, its new position), since
  matching row heights still isn't automatic even within one shared grid
  (grid rows size independently unless explicitly matched) — full
  reasoning on why the V3.45.9 attempt didn't hold up, and why this
  should still work now, documented in the delivery notes; flagged for
  live re-confirmation given that history.
- [x] Old, now-dead code removed entirely: `.sabaq-dhor-manual-row` (CSS),
  the static manual-field markup in `index.html`, the old top-level
  (script-load-time) chevron/ayah-change listener wiring — replaced with
  wiring that happens fresh inside the render function instead, since the
  old wiring would have failed outright once these elements stopped being
  static markup.
- [x] All syntax/HTML/CSS balance checked, plus 10 total Node-based
  verifications (4 state-preservation scenarios + 6 structural checks)
  before delivery.

## Done — V3.45.9 (2026-08-10)

3 refinements: removed the visible box around every checkbox (keeping the
checkbox itself and its sizing role untouched), moved the timer icon to
sit right against each card's own heading, and matched all 3 of Sabaq
Dhor's long boxes in height and width.

- [x] **`.checkbox-box`'s border and background removed entirely** —
  confirmed 3 times, most precisely as "the container's border, not
  the checkbox's own" — the checkbox itself (its own native border,
  size) is completely untouched. Its `width`/`height`/`display: flex`/
  `align-items`/`justify-content` (the sizing/alignment role that
  actually solved the original cross-browser checkbox-sizing problem,
  V3.45.6) all stay exactly as they were.
- [x] **Timer icon now sits immediately after each heading** rather
  than floating in a separately fixed-width grid column. New
  `.card-header-title-group` wraps the `<h2>` and timer button
  together as one flex unit — the button's position now dynamically
  follows wherever the heading text actually ends, instead of a fixed
  ~65% position regardless of text length. Header grid simplified
  back to 3 columns (`10% 70% 20%`, matching the shared default's own
  proportions) from the previous 4-column variant. The shared
  `.card-header-row h2` ellipsis-truncation rule still reaches the
  heading correctly at its new nesting depth (a descendant selector,
  confirmed directly) — no duplicate rule needed. `justify-self`
  (a grid-only property) removed from `.card-header-timer-btn`, no
  longer relevant now that it's a flex child, not a direct grid child.
- [x] **Sabaq Dhor's 3 long boxes now match in height and width.**
  Height: both `.sabaq-dhor-row-text` and (scoped specifically to
  Sabaq Dhor's own manual field, NOT the shared `.verse-ref-field`
  rule Sabaq's own From/To fields also use) `.sabaq-dhor-manual-row
  .verse-ref-field` get an explicit `min-height: 44px`, matching
  `.checkbox-box`'s own size. `min-height` deliberately, not a hard
  `height` — "Quarter 2 (current): 3:130 - 3:165" can wrap to 2 lines
  on narrower screens, and a fixed height would have clipped that
  wrapped text; `min-height` matches on the wide screens where the
  mismatch was actually reported, without risking overflow anywhere
  narrower. Width: an invisible spacer (`visibility: hidden`, `aria-
  hidden`, `tabindex="-1"`) added to the manual row, sharing
  `.move-to-dhor-btn`'s exact class and text content rather than a
  guessed pixel value — guarantees its rendered width genuinely
  matches the "Confirm Sabaq Dhor" rows' own 2nd grid column (which
  takes up real space even when empty, since it's one shared grid
  track across both rows), rather than assuming a number that could
  drift if that button's own CSS ever changes.
- [x] All syntax/HTML/CSS balance checked before delivery.

## Done — V3.45.8 (2026-08-10)

V3.45.7 follow-up: fixed a real bug the rail-shrink introduced, removed
Dhor's now-redundant Stopwatch button, labeled every timer icon, and
gave the maximized timer its own proper size and centered position.

- [x] **Real bug fixed**: `.log-detail-rail`'s `≥1180px` rule was still
  `grid-template-columns: repeat(4, 1fr)`, left over from the old
  4-card layout — 3 real cards were being squeezed into 1/4-width
  columns each, with a permanently empty 4th column explaining the
  large unused gap in the screenshot. Now `repeat(3, 1fr)`. 2 nearby
  stale "all 4 cards" comments corrected too, for accuracy.
- [x] **Dhor's own pre-existing Stopwatch button removed entirely**
  (`.dhor-stopwatch-col`/`#dhorStopwatchToggle`, its CSS, and every
  JS reference — click handler, 2 disabled-state toggles, icon
  injection) — genuinely redundant with V3.45.7's own header-icon
  entry point. Duration deliberately left exactly as it was, NOT
  expanded to fill the resulting space, per the explicit correction.
  Its target-minutes-per-juz' setup logic didn't just get deleted —
  moved into Dhor's own new header-icon handler instead, since Dhor
  is still the one card with a genuine target concept of its own
  (`target_minutes_per_juz`, Setup) that the old button always set
  correctly before opening.
- [x] **"Timer" text label added** to all 3 new header-icon buttons
  (Sabaq/Sabaq Dhor/Dhor), matching `.card-header-save-btn`'s own
  icon-on-top/uppercase-label convention. Icon shrunk 24px→20px so
  icon+label together still fit the existing column width rather than
  widening the column itself.
- [x] **Maximized timer given its own real size and position** —
  previously inherited the base rule's unconditional full-viewport
  `inset: 0`. New `#dhorTimerHost[mode="full"]` rule: `height: 60vh`
  (a direct, specific value, not derived from an existing pattern),
  centered both horizontally and vertically
  (`top/left: 50%; transform: translate(-50%, -50%)`), width capped
  at the app's own standard 50%/30% breakpoints
  (`--width-tablet`/`--width-desktop`, same tokens every other capped
  screen already uses). This should also resolve the reported
  close-icon dead zone as a side effect — the × no longer sits at the
  very top edge overlapping the device's status bar — to be
  re-confirmed live rather than assumed fixed.
- [x] All syntax/HTML/CSS balance checked, every removed reference
  confirmed genuinely gone (only explanatory comments remain), before
  delivery.

## Done — V3.45.7 (2026-08-10)

Timer relocated from a permanent 4th rail card to a truly top-level,
always-mounted overlay — a genuine architectural change, not a UI tweak.

- [x] **Removed from the rail entirely**: `LOG_DETAIL_CARD_ORDER` drops
  `'timer'` (rail is now exactly 3 cards), the Timer dot is gone from
  the dots row.
- [x] **Relocated in the DOM**: `<session-timer id="dhorTimerHost">`
  moves out of `#screen-logDetail` to a true sibling of `#appShell` —
  outside the entire screen-swapping system, so `showScreen()`'s own
  `.hidden` toggling (which only ever touches `.screen` elements)
  never affects it. Hidden by default now (`class="hidden"`), since
  it's no longer always-visible as a rail card.
- [x] **CSS rewritten for both modes**: the old "full" mode styling
  (`flex`, `scroll-snap-align`) was entirely rail-context-specific and
  meaningless once there's no rail to belong to — replaced with its
  own `position: fixed; inset: 0` treatment, matching the approach
  "mini" mode already used. Both modes are now genuine, full-viewport
  overlays.
- [x] **New `openFloatingTimer()`/`closeFloatingTimer()`**
  (`js/dhorPage.js`) replace the old `scrollRailToTimer()` entirely —
  opening now means un-hiding the relocated element directly (no rail
  to scroll to anymore); closing hides it again. Every entry point
  opens minimized (`mode = 'mini'`) per the confirmed default,
  including Dhor's own pre-existing Stopwatch toggle, which previously
  opened in full mode.
- [x] **3 new entry points**: a timer icon on Sabaq/Sabaq Dhor/Dhor's
  own header rows (explicitly not Tadabbur, confirmed) — scoped via a
  new 4-column header-grid variant applied only to these 3 cards by
  id, leaving the shared `.card-header-row` rule untouched for every
  other screen. Plus a "Timer" entry in the dropdown and a new Home
  tile, both hardcoded the same way "Home" itself was added earlier
  (deliberately not part of `NAV_ITEMS`, which is built for navigating
  to full screens via `showScreen()`, not toggling a floating overlay)
  — each calling `openFloatingTimer()` directly.
- [x] **"Never hidden while running" confirmed to fall out naturally
  from the relocation itself** — once `showScreen()` no longer touches
  the timer at all, the only way it's ever hidden is the explicit
  Close action, which already resets the session first (never "hidden
  while still running," always "hidden after being reset"). No extra
  event-listening logic needed beyond the relocation itself.
- [x] All syntax/HTML/CSS balance checked, plus every new element ID
  confirmed to exist exactly once (or, for the dynamically-generated
  dropdown entries, confirmed to match the same `0`-in-static-HTML
  pattern the existing "Home" entry already has) before delivery.

## Done — V3.45.6 (2026-08-10)

Checkbox sizing finally resolved for real, via a container-box approach
rather than trying to size the native checkbox itself — plus the
matching bordered-box treatment for the section-row text labels.

- [x] **`.checkbox-box`** (new, shared, `css/detail-pages.css`): a
  44×44px bordered container (same `border`/`border-radius`/
  `background` as `.verse-ref-field`), the checkbox sitting inside it
  unstyled. Replaces V3.45.5's `width`/`height`-on-the-native-checkbox
  fix entirely, which turned out not to reliably work — a container
  element respects explicit CSS dimensions consistently across
  browsers where a native checkbox doesn't always. One shared class
  now used everywhere this treatment applies, not a scattered
  per-screen rule.
- [x] **`.sabaq-dhor-row-text`** gets the same bordered-box look as
  `.verse-ref-field` — border/radius/padding/background all matching
  exactly. Previously these labels had no box of their own at all,
  just plain grid-cell text.
- [x] **Alignment**: `.sabaq-dhor-sections-list`'s checkbox column
  changed from `auto` to a fixed `44px`, matching `.checkbox-box`'s own
  width exactly, so the section checkboxes and the manual-selection
  row's own checkbox-box land at the identical horizontal position.
- [x] **Manual field restructured**: the checkbox moves out of "Set
  Sabaq Dhor" entirely (previously both lived together in one
  `.cb-private-row` label) into its own `.checkbox-box`, sitting next
  to the picker in a new `.sabaq-dhor-manual-row` flex row — the
  picker takes remaining space, the checkbox-box stays fixed-width at
  the end. "Set Sabaq Dhor" is now a plain, unboxed label above the
  row, matching what the annotated screenshot specified.
- [x] All syntax/HTML/CSS balance checked before delivery.

## Done — V3.45.5 (2026-08-10)

Sabaq Dhor's manual field rebuilt to match what it actually turned out
to be — a 3rd input into the existing composited-range mechanism, not a
persistent override — plus the confirmed UI restructure and checkbox
sizing fix.

- [x] **`sabaqDhorManualOverride` removed entirely** — out of
  `js/position.js` (`advancePositionAfterSabaq` no longer clears it,
  since it no longer exists at all) and out of `js/sabaqDhorPage.js`'s
  load flow (no more checking it ahead of the computed frontier — the
  field just starts blank on every fresh load now, same as the section
  checkboxes always start unchecked).
- [x] **`compositeCheckedSabaqDhorRows` extended** to fold in the
  manual field as a genuine 3rd source — when its checkbox is checked,
  the entered surah:ayah (treated as a zero-length range at that one
  point) competes in the exact same earliest-start/latest-end
  comparison the section checkboxes' own rows already go through, not
  a separate calculation. Verified directly via 5 Node scenarios
  (section-only, manual-only, both together with the manual value
  correctly extending the range, manual checked but the field somehow
  empty falling back gracefully with no crash, and nothing checked at
  all) before delivery.
- [x] **The old `#sabaqDhorManualSaveBtn` click handler is gone** —
  the checkbox that replaced it is fully passive, exactly like the 2
  "Confirm Sabaq Dhor" checkboxes, with no listener of its own; its
  state is only ever read once, inside the composite function, at the
  moment the card's own Save button is tapped.
- [x] **Reordered**: the manual selection section now sits below the
  auto (section-based) selection, not above it.
- [x] **2 label changes**: "Set current position manually" → "Set
  Sabaq Dhor"; "Mark sections revised" → "Confirm Sabaq Dhor".
  "Set Sabaq Dhor" now labels the checkbox directly (same
  `.cb-private-row` pattern Sabaq's/Sabaq Dhor's own existing "Confirm
  selection" checkbox already uses) rather than sitting as a separate
  label above the picker.
- [x] **Checkbox sizing fix**: `.sabaqDhor-row-cb` and the new
  `#sabaqDhorManual_cb` both get explicit `20px × 20px` sizing, scoped
  to the app's own `768px` breakpoint upward only — mobile is left
  completely untouched, since it was never the problem. Deliberately
  scoped by class/id rather than a global `.cb-private-row input`
  rule, since Sabaq's/Sabaq Dhor's own "Confirm selection" checkboxes
  already use that same class and were confirmed already rendering
  correctly — a global change there would have resized something that
  was never reported as broken.
- [x] All syntax/HTML/CSS balance checked before delivery.

## Done — V3.45.4 (2026-08-10)

Sabaq/Sabaq Dhor position tracking rebuilt around real history instead of
a separately-stored, silently-desyncable value — the architectural fix
for the prepopulation bug, not a patch.

- [x] **`computeActualSabaqFrontier`** (new, `js/position.js`): the
  frontier is now always computed fresh from actual Sabaq entries, never
  stored. Deliberately simple per the user's own correction to an
  earlier draft — no cross-juz' comparison at all, just whichever entry
  is most recently dated (date descending, id as tiebreaker), then that
  one entry's own within-entry frontier. `sabaqTo`/`activeJuz` are no
  longer part of the stored position shape at all — `savePosition`
  strips them centrally before every single write, regardless of what's
  passed in, so they can never be accidentally persisted from any call
  site (caught this as a real risk in my own draft mid-build, before
  delivery — every position object in memory during this session
  legitimately carries them for the existing row-computation functions
  to read, which made it an easy mistake to nearly make).
- [x] **`advancePositionAfterSabaq`** substantially simplified — the old
  `SABAQ_STUDY_ORDER`-based cross-juz' "is this genuinely further along"
  check is gone entirely (it's what could never actually be correct once
  study paths diverge past juz' 30/29). Still detects a genuine
  juz'-crossing for `previousJuz`'s own lingering-juz' tracking (real,
  unrelated state), and now also clears `sabaqDhorManualOverride` on
  every save — logging a new Sabaq entry IS the reset, confirmed in
  chat, no separate reset action anywhere.
- [x] **Sabaq Dhor gets a genuinely new manual-select field** — "Set
  current position manually," a single surah:ayah point (not a from/to
  pair), built to visually and structurally match Sabaq's own picker
  fields exactly per the user's explicit confirmation, though
  implemented as its own dedicated functions rather than generalizing
  Sabaq's tightly-coupled existing ones — avoids any risk to Sabaq's
  own, already-working picker. The ayah up/down steppers needed no new
  wiring at all — Sabaq's own stepper handler is already a generic,
  app-wide selector keyed off `data-target`, not scoped to Sabaq
  specifically.
- [x] Every downstream row-computation function — `computeLingeringRows`,
  `computeSabaqDhorRows`, `computeCurrentJuzRows`,
  `computeSabaqDhorSections`, `computeSabaqDhorSectionsMaqra`,
  `maybeAutoMoveToDhor` — is completely UNCHANGED. They always just read
  `.sabaqTo`/`.activeJuz`/`.previousJuz` off whatever position-shaped
  object they're given; what changed is only who constructs that object
  and how (`js/sabaqPage.js`/`js/sabaqDhorPage.js` now compute
  `sabaqTo`/`activeJuz` fresh before calling into any of this).
- [x] Verified directly against the REAL production code throughout, not
  a reimplementation — loaded the actual `shared/data.js` and
  `js/position.js` into Node and ran the exact originally-reported bug
  scenario end-to-end (Sabaq's own prepopulation AND Sabaq Dhor's
  "current" quarter both independently recompute to the correct 3:166/
  3:165), plus 6 frontier scenarios (out-of-order dates, same-date
  tiebreaking, juz' 30's backwards direction, no history at all,
  malformed entries) and the `savePosition` stripping fix itself, before
  writing a single line of the delivery.
- [x] One judgment call flagged rather than silently assumed: the
  position-advance block in `sabaqPage.js`'s save handler keeps a
  best-effort silent catch, same shape as before — but what's actually
  at stake behind it is now much smaller than the original bug. A
  failure there can now only affect `previousJuz`/clearing the manual
  override, never prepopulation itself (which recomputes independently
  from real history on its own next load, unconditionally). Not
  separately re-confirmed with the user.
- [x] All syntax/HTML-balance checked before delivery.

## Done — V3.45.3 (2026-08-09)

Native confirm() for both the Juz Tracker and the Settings picker, plus
the previously-deferred Settings link to the Juz Tracker.

- [x] **Juz Tracker's confirmation switched to native `confirm()`**,
  replacing the earlier custom `.modal-overlay`/`.modal-card` popup —
  richer 2-part message: what's changing (marked complete and/or
  un-marked, both if a session did both), then the full RESULTING list
  of every completed juz, grouped 3 per line. Verified directly via 4
  Node scenarios before delivery (marking, un-marking, both together,
  and the resulting-list-becomes-empty edge case).
- [x] **Settings "Mark completed Juz" grid gets the same treatment** —
  previously had zero confirmation of any kind when closed. New
  `buildJuzConfirmMessage`/`formatJuzListThreePerLine` helpers
  (`js/juzTrackerScreen.js`) are shared between both screens so the
  message is identical either way. Cancel leaves the modal open for
  further adjustment rather than closing it.
- [x] **Settings link to the Juz Tracker added** (the piece deferred
  from the original V3.45 planning): label above the button changes
  from "Mark completed sections" (a Surah-history leftover) to "Mark
  completed Juz", matching the button's own text. New switcher reuses
  the app's existing `.switch-track`/`.switch-thumb`/`.switch-option`
  component (`js/uiSwitch.js`) — an icon (`iconHtml('juzTracker')`,
  newly sized specifically for this compact switch, since `.btn-icon`
  has no sizing of its own anywhere else in the app) for the Tracker
  choice, defaulting to selected; plain text for "Juz list". The
  existing button's click handler now branches on the switch's current
  value — `showScreen('juzTracker')` or the existing grid modal — no
  separate buttons needed. The choice itself is a plain in-memory
  preference, not persisted — resets to Tracker on every fresh
  Settings visit, since saving it wasn't asked for.
- [x] All syntax/HTML-balance/CSS-balance checked.

## Done — V3.45.2 (2026-08-09)

The Tadabbur card sizing fix — both the min-height-not-taking-effect issue
and the still-open textarea-flex issue, resolved together by one root
cause and one change.

- [x] Root cause (user's own diagnosis, verified by tracing the full
  ancestor chain): the flex relationship was broken 2 levels above
  `#tadabburCard`, not at the card's own level. `#appContent` never
  set `display:flex` for its own children, so `#screen-reflections`
  (and `#tadabburCard` inside it) was never actually forced to fill
  the available space — each level's own `min-height` just happened
  to be independently viewport-relative, which is why nothing looked
  wrong reading each rule in isolation.
- [x] Two approaches considered — extending the flex chain up through
  `#appContent`/`.screen` (rejected: those are shared by every screen
  in the app, too risky to fix one card by touching all of them) vs.
  giving `#tadabburCard` itself a definite size (chosen: fully scoped
  to this one card).
- [x] Fix implemented: `#tadabburCard`'s `min-height` formula becomes
  `height` (replacing, not duplicating alongside it) — same viewport-
  relative calc, same values, just a definite size instead of a
  minimum. `#tadabburCard`'s own `display:flex; flex-direction:column`
  and `#tadabbur_text`'s own `flex:1; min-height:0` were never the
  problem and are unchanged — they just needed a container with an
  actual, known size to distribute within. `height` still lets
  genuinely long content overflow taller, same as before, since
  nothing here sets `overflow: hidden`.
- [x] CSS balance checked before delivery.

## Done — V3.45.1 (2026-08-09)

Tadabbur regression fixes plus a new History feature, all found and
confirmed via a live screenshot.

- [x] **Date-field visibility bug fixed**: `#tadabbur_date` now sits
  inside a proper `.card-date-row` wrapper (same pattern
  Sabaq/Sabaq Dhor/Dhor already use), which gives it the explicit,
  fixed height (`--dhor-row2-h`, defined directly on `#tadabburCard`
  since it doesn't carry the `.detail-page` class that normally
  provides it) that `wireCustomDateDisplay`'s own `height: 100%`
  mechanism needs to resolve correctly. Today's date (already being
  set correctly under the hood since V3.44.1) should now actually be
  visible.
- [x] **Close button repositioned**: moved out of the header row's
  grid entirely, now `position: absolute` pinned to `#tadabburCard`'s
  top-right corner (`#tadabburCard` itself gained `position:
  relative` as the anchor) — same corner-× pattern `.modal-card
  .close-btn` already uses elsewhere in the app, rather than
  inventing new values.
- [x] **Tadabbur History added**: reuses `renderRecentEntries`
  (`js/dhorPage.js`, already powering Sabaq/Sabaq Dhor/Dhor's own
  history), extended with a new opt-in `onRowClick` parameter —
  purely additive, the 3 existing callers don't pass it, so their own
  rows stay exactly as non-interactive as before. Tapping the
  edit-pencil icon loads the entry into the form for editing
  (`loadTadabburEntryForEdit`, registered via `EDIT_HANDLERS`, same
  mechanism the other 3 types use); tapping the row's own content
  instead opens a simple read-only modal showing the full date and
  reflection text. The list itself shows each entry's first line
  (truncated at 60 characters) — verified directly via several Node
  scenarios (short/multi-line/very-long/empty/whitespace-only
  reflections) before delivery.
- [x] **Textarea-not-flexing issue**: left as-is, still not
  root-caused. The CSS reads correctly on paper and I can't confirm
  why the live result doesn't match without actual browser access —
  flagged plainly rather than guessing at a fix. Worth checking again
  after this delivery, since the header-row/date-row restructuring
  done alongside it might incidentally change something, but this
  wasn't verified either way.
- [x] All syntax/HTML-balance/CSS-balance checked, plus the new
  first-line/truncation logic directly verified via Node before
  delivery.

## Done — V3.45 (2026-08-09)

Juz Tracker connected to the Dhor pool, plus its own sizing fix and
header restructure.

- [x] **Pool-based initialization**: the tracker now fetches the
  student's profile (`apiGetProfile`) every time the screen is
  entered (`renderJuzTrackerScreen`, now called from `showScreen`
  rather than the old one-time IIFE) and colors tiles for whichever
  juz have all 4 of their quarter-units present in
  `baseline_selection` — same "complete" rule the existing Settings
  picker already uses (`quarterUnitsForJuz`, `shared/data.js`).
- [x] **Save flow**: tapping the new Save icon compares the tracker's
  current state against what was loaded at screen-entry, computing
  which juz were newly marked and newly unmarked. If nothing changed,
  it's a silent no-op. Otherwise, a confirmation modal
  (`.modal-overlay`/`.modal-card`, matching the app's existing
  pattern) lists exactly what's about to happen — "X juz have been
  marked complete: Juz ..." and/or "Y juz have been un-marked: Juz
  ..." if both happened in the same session — with OK/Cancel.
- [x] **TARGETED add/remove** (Claude's own recommendation from
  earlier, not separately re-confirmed, but implemented as the safer
  choice): on OK, only the specific juz actually touched this session
  get added/removed — 4 quarter-units each — re-fetching the current
  pool right before writing rather than trusting a possibly-stale
  copy. Verified directly via 4 Node-run scenarios before delivery,
  including the specific case this whole approach exists to protect:
  a partial juz already in the pool (simulating Sabaq Dhor's own
  leftover progress) stays completely untouched by an unrelated
  save elsewhere on the tracker.
- [x] **Un-marking supported**, confirmed explicitly — same
  confirmation flow as marking, matching the existing picker's own
  toggle-either-direction capability.
- [x] **Header restructured**: white background (was sitting on the
  screen's own `--surface-track` like every other screen); Save sits
  right next to the "Juz Tracker" heading, Close pushed separately to
  the far right via `margin-left: auto` — a plain flex row rather than
  the standard 3-column `.card-header-row` grid, since that shape
  didn't fit this specific layout.
- [x] **Sizing fix**: the SVG's own internal CSS (inside its shadow
  DOM — confirmed via direct inspection that external CSS can't reach
  it, so this had to go in `js/kaabaTracker.js` itself, not
  `css/juzTracker.css`) now caps at `max-height: 70vh`, so the cube
  always fits the viewport without scrolling — confirmed via 2
  screenshots showing exactly this problem on a wide desktop window
  before the fix.
- [x] No backend changes needed at all — `apiSaveProfile`/`POST
  /profile` already fully supported `baseline_selection` via the
  existing Settings picker, confirmed by reading the handler directly
  before assuming so.
- [x] All syntax/HTML-balance/CSS-balance checked, plus the core
  add/remove logic directly verified via Node before delivery (not
  just assumed correct from reading it).

## Done — V3.44.1 (2026-08-09)

Full Tadabbur redesign, scoped to frontend-only per the user's explicit
"no new backend for now."

- [x] Header row (icon/"Tadabbur"/save-wrap/close button) moved inside
  the white `.screen-content` card as its first child, matching
  Sabaq's own `.log-detail-card` pattern.
- [x] Date field added (`#tadabbur_date`) — `reflections.date` already
  existed in the schema, just wasn't exposed in the UI; no migration
  needed. Wired the same way Sabaq's own date field works: not a
  dynamic reload-on-change, just "which date this entry is for," read
  at save time. Added to `wireCustomDateDisplay`'s list alongside the
  other 3 date inputs for consistent cross-browser display.
- [x] Private checkbox moved above the reflection textarea.
- [x] Reflection textarea flexes to fill the card (`flex:1;
  min-height:0`) instead of a fixed `rows="8"`, with bigger text
  (18px). Card (`#tadabburCard`) is a flex column with its own
  min-height formula so there's real vertical space for the textarea
  to actually grow into.
- [x] Card gets its own 50% width restriction — deliberately not the
  standard 30/50 rule; stays at 50% even at the `≥1180px` breakpoint
  where `.screen-content` would otherwise drop to 30%, to give the
  long reflection text more room. A third exception alongside
  Journal's 70% and Juz Tracker's full-width.
- [x] REAL MISTAKE caught and fixed during this build: an early edit
  accidentally deleted `.log-detail-rail`'s own CSS properties
  (display/gap/overflow/scroll-snap) while adding an unrelated section
  comment above it — caught immediately via direct inspection before
  delivery, restored correctly.
- [x] RESOLVED (V3.44.1 follow-up, `worker/src/reflections.js`): the
  update path can now write `date` too. NOT a simple one-line whitelist
  edit as first proposed, though — direct verification caught a real
  bug in that first attempt before delivery: `FIELDS` is shared with
  the CREATE path, and `insertLog` (`logHelpers.js`) zips that array
  with its own `values` array BY POSITION to build the INSERT
  statement's column list. Adding `date` there would have made
  `FIELDS` 3 items against `values`' still-2, misaligning every column
  after it — not an error, silently wrong data. Fixed instead with a
  separate `UPDATE_FIELDS` whitelist used only by the update path
  (which iterates present fields by name, not position, so this one
  was safe on its own) — `FIELDS` itself stays untouched, `date`
  already being handled by its own dedicated parameter there. Verified
  directly via Node simulation before delivery: insert path unaffected
  (correct column/value alignment, no duplicate `date`), update path
  correctly picks up a `date` key when present and still works
  normally without one.
- [x] All syntax/HTML-tag-balance/CSS-brace-balance checked before
  delivery.

## Flagged — Home header icon removal, separate from the redesign above (2026-08-09)

- [ ] Remove the home icon from Home's own header row entirely,
  confirmed in chat — this is `#homeHeaderIcon`, the lavender `home`
  icon in Home's `card-header-row` (V3.43 already stripped the "Home"
  text label next to it). Now the icon itself goes too, leaving that
  header row empty of both icon and text. Not yet decided/asked: does
  the empty `card-header-row` div stay in the markup (just visually
  blank), or does the whole header row element get removed too,
  leaving the tile grid as the screen's only content? Leaning toward
  removing the whole row rather than leaving a blank one, but flagging
  rather than assuming. NOT part of the V3.44 build below — separate,
  still unresolved.

## Done — V3.44 (2026-08-09)

Full build of the entire `#appContent`/screen redesign thread, plus the
Admin gap found and confirmed along the way.

- [x] **Core color inversion**: `#appContent` is now `--color-page-bg`
  (was `--surface-track`); every individual screen is now
  `--surface-track` (was white, via the universal `.screen` rule).
  Screens get real padding (10px all sides), radius, and their own
  min-height formula (mirrors `#appContent`'s, additionally
  subtracting `#appContent`'s own padding via `--appcontent-vpad`,
  same pattern already used for Log Detail/Timer).
- [x] New shared `.screen-content` class (`css/base.css`) — white,
  standard 30/50 cap, own padding/radius. Used by Tadabbur, Haidh, and
  Admin's new body-content wrappers, and each of Settings' 4 sections
  (replacing their individually-duplicated cap rules).
- [x] **Settings**: `--surface-app` special case fully removed —
  Settings is no longer different from any other screen, just another
  `--surface-track` screen with white `.screen-content` sections
  inside it. `--surface-app` retired from actual use (token definition
  kept, nothing references it anymore).
- [x] **Journal**: the old negative-margin edge-bleed technique removed
  (incompatible with a fixed-width, centered element). New confirmed
  exception: `.journal-header-row` + `.journal-wrap` together, fixed
  70% width + centered, same shape as Juz Tracker's existing full-width
  exemption.
- [x] **Haidh**: its own screen-level width cap removed (this was also
  where the confirmed rendering bug lived — calendar spanning the full
  browser width with no cap at all). Calendar content now wrapped in
  `.screen-content` for its own explicit width control.
- [x] **Admin**: same gap as Haidh, found on request by checking the
  code directly — register box + search + list had no shared wrapper
  either. Same fix: screen-level cap removed, body content wrapped in
  `.screen-content`.
- [x] **Juz Tracker**: `#screen-juzTracker` picks up the same
  min-height formula as every other screen via the universal `.screen`
  rule — no separate work needed. `.juz-tracker-wrap` confirmed
  unchanged (already transparent, stays that way — the one deliberate
  exception to the white-content rule).
- [x] **Breakpoint corrections**: `--appcontent-vpad` and
  `#appContent`'s own padding both moved from 720px to 768px;
  `#appContent`'s `max-width` breakpoint moved from 1200px to 1180px
  (value stays Hifzhelper's own 1400px, not stdstyles' 1280px) — all
  three now match every other width threshold in the app.
- [x] **Dropdown**: "Home" added, hardcoded the same way Refresh/Log
  out already are (not added to `NAV_ITEMS`, so `#homeGrid` doesn't
  duplicate it).
- [x] Flagged, not touched in this build: `#screen-home` still has its
  own separate screen-level cap, same pattern that was just removed
  from Settings/Admin/Haidh — it wasn't part of the explicitly-named
  list, so left as-is rather than assumed. Worth a decision on
  consistency.
- [x] All syntax/HTML-tag-balance/CSS-brace-balance checked before
  delivery.

## Done — V3.43 (2026-08-09)

Built from the REAL V3.41.2 baseline the user uploaded directly
(`Hifzhelper-ca4ed3c5cc7ed3104dfc425a5a921ad3b15ad62b.zip`), not from
Claude's earlier speculative V3.42/V3.42.1 sandbox work, which the user
confirmed was never actually implemented. Final agreed terminology:
`#appContent` (the one persistent wrapper) = user's "screen";
each individual `#screen-home`/`#screen-journal`/etc. = user's
"container".

- [x] 4 new tokens added (`css/tokens.css`): `--surface-app: #EBE5D9`,
  `--surface-track: #A2ABA1`, `--surface-banner: #4A5D4E` (value
  corrected from an earlier `#758976` given in this same
  conversation), `--surface-contrast: #9E83B8`. Plus a new
  `--appcontent-vpad` helper token (mobile = `--space-md`, `--space-lg`
  from 720px, matching `#appContent`'s own existing breakpoint) — one
  source of truth reused by the Log Detail/Timer height recalibration
  below, instead of duplicating that breakpoint condition elsewhere.
- [x] `#appContent` gets `background: var(--surface-track)` plus an
  explicit `min-height` (`100vh`/`100dvh` minus the auth band) — mostly
  making explicit what its existing `flex:1` already provided
  implicitly, per the user's request; kept as `min-height` so genuinely
  long content still grows and the page scrolls, never a fixed box.
- [x] Auth band (`--color-banner`) changed from `var(--palette-sage)`
  to `var(--surface-banner)`.
- [x] Every individual screen is white by default now (new `.screen`
  rule, `css/base.css`) — including Home, whose old olive-specific
  `#screen-home` background override is removed entirely.
- [x] Settings is the one deliberate exception, confirmed twice in
  chat: `#screen-settings` keeps its own distinct `--surface-app`
  backdrop rather than the universal white, with its 4 sections
  (Profile/Hifz Setup/Dhor Schedule/Haidh) white inside it — a second,
  nested instance of the same "colored backdrop, white cards" pattern
  the rest of the app has one layer up. The 4 sections' own background
  changed from `--palette-sky` to white to match. The existing
  `#screen-settings` 30/50 width cap from the real V3.41.2 baseline
  needed no changes — it already matched what "containers get 30/50"
  wants.
- [x] Home's header text deleted entirely, confirmed in chat — just
  the lavender `home` icon remains, no `<h2>Home</h2>` at all. The
  white-heading-text color fix from V3.41.1 (needed for contrast
  against the old olive) removed as dead code along with it.
- [x] `.log-detail-card` (both its normal and `.editing-active` states)
  and `#dhorTimerHost` (both its normal and `>=1180px` desktop states)
  all recalibrated to also subtract `#appContent`'s own vertical
  padding (`--appcontent-vpad`) from their height formulas — these
  predated `#appContent` having any explicit sizing of its own, so
  they never accounted for that space being unavailable; without this
  they'd run past the visible viewport by exactly that amount.
- [x] All syntax/HTML-tag-balance/CSS-brace-balance checked before
  delivery.

## Done — V3.42.1 (2026-08-09)

- [x] REAL BUG, found via screenshot right after V3.42 shipped: the
  Log Detail screen (Sabaq/Sabaq Dhor/Dhor rail + Timer) was cramped
  into unreadable slivers on tablet/desktop. Root cause: V3.42 added a
  width-cap to `.log-detail-rail` itself, but this screen already had
  its own bespoke width handling at the exact same `>=1180px`
  breakpoint (a 4-column grid + each `.log-detail-card`'s own
  `max-width: 30%`) — the two compounded, each column ending up at
  roughly 30% ÷ 4 ≈ 7.5% of the viewport. Fixed by removing V3.42's
  addition entirely — this screen never needed it, its own pre-existing
  system already handled this correctly. `css/detail-pages.css` only;
  no other screen was affected (they didn't have a competing system
  like this one did).

## Done — V3.42 (2026-08-08)

- [x] `.screen` is now a real, universal base class (`css/base.css`) —
  previously had no styling at all. Own card treatment (padding,
  `--surface-track` background, radius, shadow), full-width (no cap at
  the screen level), a real `min-height` formula
  (`100vh`/`100dvh`-based, reusing the existing dynamic
  `--auth-band-height` rather than a new fixed constant). Show/hide
  itself is unchanged — still `.hidden`, still `showScreen()`.
- [x] New shared `.screen-container` class — white, the 30/50 cap
  (moved here from individual screens), centered once that cap
  actually narrows it, sits at the top of its `.screen` by default (no
  vertical centering).
- [x] Applied per screen: Home (`#homeGrid`, already white, just
  capped+centered now); Tadabbur/Haidh/Admin — new container wraps the
  body, header row stays on the screen's own background; Settings — 4
  independent sections, each its own container (background changed
  from sky-blue to white to match); Journal — header row + table
  together in one container (the old negative-margin edge-bleed
  technique removed, no longer applicable); Log Detail — only the
  width-cap/centering portion applied to `.log-detail-rail` itself
  (not padding/background, which would've fought the existing
  scroll-snap swipe rail) — individual `.log-detail-card`s already had
  their own white/border/radius, nothing there needed to change.
- [x] Juz Tracker deliberately EXCLUDED from the new container
  treatment — it was already built to always stay full-width, and
  adding a container would have reintroduced the exact cap it was
  built to avoid.
- [x] Home's olive/sage-specific background reconsidered and reverted
  — every screen now shares the one universal `--surface-track`
  background instead. Home's white heading text (added specifically
  for contrast against the darker olive) reverted to the normal
  dark-ink heading every other screen uses.
- [x] All syntax/HTML-tag-balance/CSS-brace-balance checked before
  delivery — no JS files touched this round (show/hide mechanism
  intentionally unchanged).

## Done — V3.41.2 (2026-08-08)

- [x] Real "Home" tile added inside `#homeGrid` itself, as the first
  tile — hardcoded in `js/home.js`'s `renderHomeScreen()`, deliberately
  NOT part of `NAV_ITEMS` (would also add it to the dropdown on every
  other screen, redundant with the X-to-Home buttons already there).
  Always shown active: lavender-filled box + a visibly darker
  lavender-toned border (`color-mix()` off the same `--palette-lavender`
  token, not a new hardcoded color), icon and label stay dark ink — a
  distinct, more specific treatment from the generic cross-screen
  `.active` highlight elsewhere, scoped so it only applies to this one
  tile. No `data-nav`, no click listener — nothing meaningful for a tap
  to do since you're already on Home, and `showScreen`'s own
  active-highlight loop only ever touches `[data-nav]` elements, so
  this tile's hardcoded active state is safe from being toggled off.
- [x] `#screen-home` given the standard 30%/50% width cap on larger
  screens, matching every other capped screen — it had never had one.
- [x] Tiles switched from a stretching grid (`1fr` columns) to
  `flex-wrap` with fixed pixel sizing (64px icon box, 76px tile) — they
  now stay a constant size regardless of viewport and wrap onto a new
  row rather than growing/shrinking to fill the container.
- [x] Tile border darkened from `--color-table-border`
  (`--palette-lavender`, barely visible) to `--color-ink-faint`
  (`#9A9A90`), matching the reference image's clearly visible
  medium-gray outline.
- [x] Syntax-checked, CSS brace-balanced before delivery.

## Done — V3.41.1 (2026-08-08)

- [x] Home screen restructured: olive background (`#screen-home`,
  reuses `--palette-sage` — the same color the top auth band already
  uses, not a new color), a real `card-header-row` + lavender `home`
  icon added (previously just a bare `<h2>`), heading text set to white
  for contrast against the new olive background (Claude's own necessary
  follow-on, not separately asked — dark ink text on sage would have
  been hard to read).
- [x] `#homeGrid` is now a white container (`--color-surface`) sitting
  on that olive background, tiles arranged inside it.
- [x] Tile structure corrected (was cosmetic-only in V3.41, now
  structural): `js/auth.js`'s `renderNavItemsInto` wraps each icon in
  its own `.nav-icon-item-icon` span, separate from the label — Home's
  own CSS boxes just that icon span (square, white background, thin
  border, rounded corners, shadow), with the label sitting below it,
  outside the box. The dropdown menu's own tiles use the exact same
  new markup but stay visually unchanged (the wrapper is neutral by
  default; only `#homeGrid`'s own rules add the chip look) — same for
  the Refresh/Log out items, updated for structural consistency even
  though they're dropdown-only.
- [x] Active-nav highlight corrected from evergreen to lavender
  (`.nav-icon-item.active`, `css/base.css`) — one-line color swap, same
  mechanism otherwise. Flagging for awareness, not blocking: lavender
  (`#E3DADE`) is a pale color, and the dropdown's own background is
  white — contrast there will be soft/subtle. Built exactly as
  specified since it was stated explicitly and repeated; worth a look
  once live in case a bolder tone is wanted after all.
- [x] Home replaces Journal as the post-login landing screen
  (`bootApp()`, `js/app.js`) — new-user-lands-on-Settings-first is
  untouched; Journal remains fully reachable as its own nav item.
- [x] "Progress" deleted from `NAV_ITEMS` (`js/auth.js`) — was always
  just an unbuilt coming-soon placeholder. Its now-orphaned icon
  definition removed from `js/icons.js` too, confirmed no other
  callers anywhere.
- [x] All syntax-checked, HTML tag balance re-confirmed (181 div, 9
  section, matched) before delivery.

## Done — V3.41 (2026-08-08)

- [x] X-to-Home button on every screen except Home itself (Journal,
  Log Detail, Admin, Settings, Tadabbur, Haidh, Juz Tracker) — reuses
  the existing `close` icon throughout, `showScreen('home')` on click.
  `screen-logDetail`'s pre-existing close button repointed from Journal
  to Home (was the one open question, resolved by the user). Every
  other new button wired centrally in `js/app.js`'s own `init()` (all
  identical: same icon, same action), rather than 6 files each
  repeating the same 2 lines.
  - `card-header-row` screens (Tadabbur/Haidh/Juz Tracker): button
    joins the existing icon+h2 row's 3rd column. Tadabbur's own save
    controls already lived there, so a small `.card-header-right`
    wrapper holds both together rather than fighting for the slot.
  - `screen-admin`: given a real `card-header-row` for the first time
    (previously just a bare `<h2>`), reusing the existing `admin` icon.
  - `screen-settings`/`screen-journal`: no single screen-level header
    to attach to (4 independent sections; a data-table header,
    respectively) — a small dedicated `.screen-top-close-row` at the
    very top of each instead.
- [x] Home screen tiles restyled to read as distinct app icons —
  background chip, rounded corners, subtle shadow (`#homeGrid
  .nav-icon-item`, `css/nav.css`) — scoped so the dropdown menu's own
  tiles (same underlying class) stay exactly as they were. CSS only;
  same tiles, same destinations, same `renderNavItemsInto` markup.
- [x] Whichever screen is currently open gets its nav icon highlighted
  in accent color, in both the dropdown and Home grid — reuses the
  same visual language `.log-detail-dots .dot.active` already
  established rather than inventing a new one. `showScreen`
  (`js/app.js`) updates it on every navigation, placed after any
  screen-specific render so it survives Home's own grid rebuild
  (`renderHomeScreen` regenerates `#homeGrid`'s markup from scratch
  every time it's called).

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
