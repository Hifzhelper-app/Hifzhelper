// ============================================================
// Hifzhelper — Dhor card (one of 4 in the unified day-log view, V3.6.1)
// Current as of V3.38
// Segment picker (quarter/half/full-juz', in whichever reference is
// active), the real timer/lap feature, tajweed tags, mistakes, comment.
//
// V3.10.0: the reference (waterval/uthmani) is no longer a local
// per-device dropdown on this page — it's derived from the student's
// own mushaf choice (Setup), fetched fresh on every open, same rule
// everywhere in the app: 13-line and Hybrid both resolve to waterval
// (quarter/half/juz' always follow 13-line rules for Hybrid, confirmed
// in chat), 15-line Madani resolves to uthmani.
//
// V3.9.0: plan-as-default is now wired in. On open, fetches today's Dhor
// plan(s) (produced by the rolling schedule configured in Setup, or
// created any other way — this page doesn't care which) via
// apiPlans.getForDate. Zero plans: falls back to the manual picker,
// unchanged. One plan: pre-fills every field from it and remembers its id
// so saving links back to it (apiDhor.save's existing plan_id handling —
// see linkPlanIfProvided in worker/src/logHelpers.js — already does the
// rest, unchanged). More than one: shows a plain selector instead of
// guessing which one the student means (per the "never auto-selected"
// rule already agreed for this feature) — picking one behaves exactly
// like the one-plan case; leaving none picked behaves like the zero-plan
// case.
//
// V3.23.0 (Dhor detail rebuild, Phase A -- an earlier, unrelated phase
// numbering than the "Phase A/B" below): the zero-plan-for-today case no
// longer just falls back to a blank manual picker. apiGetDhorDefaultEntry
// used to check, in order: a missed plan (backdated to ITS OWN date, a
// catch-up entry) → the closest future plan (today's date, borrowed
// early) → continuing from the last actual Dhor entry → the very first
// eligible segment. Superseded below.
//
// Pure queue model (2026-08-02, Phases A+B of a separate 4-phase rebuild):
// the model above was confirmed wrong -- `plans` isn't a calendar of
// dated commitments, it's a single ordered queue with no dates on
// anything not yet done, so "missed" and "future" never really existed
// as distinct concepts; they only looked like they did because rows used
// to be pre-generated with dates attached. Phase A
// (worker/src/dhorSchedule.js) collapsed computeDefaultDhorEntry to just
// today's plan (an explicit override, if one exists) or else always
// continuing from the last logged entry. Phase B (this file) matches
// that: the missed/future branches and the first_segment source are gone
// from here too, and a same-day batch of more than one plan no longer
// shows an inline "which one do you mean" picker (the "never
// auto-selected" rule from V3.9.0, above -- deliberately reversed) -- the
// first item in the batch is always what's pre-filled, and the rest
// stays reachable via Plan Dhor only.
//
// segmentsPerJuz/unitMarkerCount used to be defined locally here — moved
// to shared/data.js (V3.9.0) since the new server-side schedule generator
// (worker/src/dhorSchedule.js) needs the exact same math, and two copies
// of it is exactly what CONVENTIONS.md principle 2 exists to prevent.
// computeSegmentRange itself stays local: it indexes by raw MARKER
// position (this page's own position picker always lists every marker),
// which is a genuinely different calculation from shared/data.js's
// segmentRangeForUnitIndex (which indexes by unit-of-granularity
// instead) — not just a naming variant of the same thing.
//
// Has its own independent date selector (defaults to today on every open)
// — same reasoning as the other two log cards.
// ============================================================

// V3.21.2 fix: this MUST be declared before anything in this file (or in
// js/sabaqPage.js / js/sabaqDhorPage.js, which load after this one and
// assign into it too) can reference it. It was previously declared much
// further down, after line 237's `EDIT_HANDLERS.dhor = ...` had already
// tried to use it -- a `const` binding is unusable from the top of its
// scope until its own declaration line runs, so that threw
// ReferenceError: Cannot access 'EDIT_HANDLERS' before initialization
// the instant the page loaded. That halted the rest of THIS script,
// which is why Save stopped working on Dhor (its click handler is wired
// up further down in this same file) -- and since the crash meant this
// const never actually ran, js/sabaqPage.js and js/sabaqDhorPage.js hit
// the exact same error on their own EDIT_HANDLERS.sabaq/sabaqDhor lines,
// which is why Save broke on those two cards as well, and why History
// never appeared anywhere (renderRecentEntries, defined further down in
// this file, was never successfully reachable either).
const EDIT_HANDLERS = {}; // populated by each card's own file: EDIT_HANDLERS.sabaq = loadSabaqEntryForEdit, etc.

let dhorCurrentRef = 'waterval'; // derived from profile.mushaf on every open, see renderDhorScreen()
// 2026-08-07 (V3.38): IndoPak's Maqra/Rub'/Hizb picker is on hold --
// this used to take a 2nd (indopakTerminology) parameter and branch on
// it for IndoPak specifically; removed along with that picker (and the
// indopak_terminology column, migration 0017). IndoPak is Quarter/Half
// only now, same as 13-line -- both fall to the final `return
// 'waterval'`, natively (see shared/data.js's RUB_BOUNDARIES comment),
// not as a fallback.
function refForMushaf(mushaf){
  if(mushaf === '15line_madani') return 'uthmani';
  return 'waterval';
}

function computeSegmentRange(juz, positionInJuz, ref, unit){
  const perJuz = segmentsPerJuz(ref);
  const startMarker = (juz - 1) * perJuz + positionInJuz;
  const count = unitMarkerCount(ref, unit);
  return { segment_from: startMarker, segment_to: startMarker + count - 1 };
}

// V3.23.1: replaces raw "Seg X-Y" (segment_from/segment_to, a ref-
// dependent internal marker range with no meaning to a student) with a
// human-readable "Juz X" / "Juz X H1"/"H2" / "Juz X Q1"-"Q4" — deferred
// from earlier rounds specifically until Dhor's own detail work. Reuses
// segmentRangeToPicker below rather than re-deriving juz'/unit a second
// way; an unrecognized (non-clean) span falls back through the same
// 'quarter' approximation that function already uses for its own picker.
// 2026-08-07 (V3.37): Ru'b/Hizb terminology for the Rub'/Hizb model --
// Hizb specifically drops the "Juz X" prefix entirely and uses its own
// global 1-60 number instead (shared/data.js's globalHizbNumber),
// confirmed in chat as a real structural difference from how Half is
// shown for Quarter/Half, not just a word-swap. Rub' stays per-Juz',
// same convention Quarter always used (short form "R", matching the
// existing "Q"/"H" single-letter style -- flagged here since the exact
// abbreviation wasn't separately confirmed in chat; easy one-line change
// if a different letter is wanted).
function describeDhorSegment(segment_from, segment_to, ref){
  const { juz, positionInJuz, unit } = segmentRangeToPicker(segment_from, segment_to, ref);
  if(unit === 'full') return `Juz ${juz}`;
  const perJuz = segmentsPerJuz(ref);
  if(unit === 'half'){
    const halfIndex = positionInJuz <= perJuz / 2 ? 1 : 2;
    return ref === 'uthmani' ? `Hizb ${globalHizbNumber(juz, halfIndex)}` : `Juz ${juz} H${halfIndex}`;
  }
  const quarterSize = perJuz / 4;
  const quarterIndex = Math.ceil(positionInJuz / quarterSize);
  return ref === 'uthmani' ? `Juz ${juz} R${quarterIndex}` : `Juz ${juz} Q${quarterIndex}`;
}

// Reverse of the above: given a stored segment range, figure out which
// juz'/raw-marker-position/unit this page's OWN picker should show to
// represent it. Only needs to handle spans that are a clean quarter/half/
// whole juz' — which is all the schedule generator (or this page itself)
// ever produces — so an unrecognized span falls back to 'quarter' with
// the raw start position rather than guessing further.
function segmentRangeToPicker(segment_from, segment_to, ref){
  const perJuz = segmentsPerJuz(ref);
  const juz = Math.floor((segment_from - 1) / perJuz) + 1;
  const positionInJuz = ((segment_from - 1) % perJuz) + 1;
  const span = segment_to - segment_from + 1;
  let unit = 'quarter';
  if(span === perJuz) unit = 'full';
  else if(span === perJuz / 2) unit = 'half';
  else if(span === perJuz / 4) unit = 'quarter';
  return { juz, positionInJuz, unit };
}

let dhorSelectedTags = [];
// V3.24.0: duration switched from decimal minutes to mm:ss text. Unlike
// the old 1-decimal-minute display, mm:ss is a LOSSLESS round-trip (any
// whole-second value formats and reparses back to the exact same
// seconds) -- so the V3.21.1 dhorTimerExactSeconds mechanism (trusting a
// remembered exact value instead of reparsing the rounded display text)
// is no longer needed and has been removed; getDhorDurationSeconds/
// formatDhorDuration/setDhorDurationFields below always convert
// directly, with no precision lost either way.
// dhorLapTimes is genuinely timer-only data (no manual equivalent) and is
// still cleared whenever the user overrides the duration, since laps
// that no longer sum to the new total would be actively misleading.
let dhorLapTimes = null;
let dhorTodaysPlans = [];    // today's plan(s) for type 'dhor', fetched fresh on every open
let dhorActivePlanId = null; // which one (if any) is currently backing the form
// V3.21.0: segment_from/to came from a picker reflecting today's live
// options, not whatever was actually chosen on the day being edited --
// there's no way to reconstruct that. Editing here never touches segment.
// (V3.21.1: this used to also exclude duration/lap_times for the same
// reason, but duration is a real editable field now -- so those two are
// no longer excluded.)
let dhorEditingId = null;

// 2026-08-04, confirmed in chat: Duration is now 2 plain number fields
// (dhor_duration_min/dhor_duration_sec) instead of one text field
// holding "mm:ss" -- a colon in a single field doesn't play well with
// the native numeric keypad, which expects plain digits. Replaces
// parseDhorDuration entirely (that function's one and only caller, the
// old single-field payload construction, is what's being replaced here).
function getDhorDurationSeconds(){
  const minRaw = document.getElementById('dhor_duration_min').value;
  const secRaw = document.getElementById('dhor_duration_sec').value;
  if(!minRaw && !secRaw) return null;
  const min = parseInt(minRaw, 10) || 0;
  const sec = parseInt(secRaw, 10) || 0;
  return min * 60 + sec;
}
function setDhorDurationFields(totalSeconds){
  const minEl = document.getElementById('dhor_duration_min');
  const secEl = document.getElementById('dhor_duration_sec');
  if(totalSeconds == null || isNaN(totalSeconds)){
    minEl.value = '';
    secEl.value = '';
    return;
  }
  const total = Math.max(0, Math.round(totalSeconds));
  minEl.value = String(Math.floor(total / 60));
  secEl.value = String(total % 60).padStart(2, '0');
}
// Auto-advance (confirmed in chat): typing a 2nd digit into Minutes
// (max 99, per maxlength="2" in index.html) moves focus straight to
// Seconds, no manual tap needed for the common case.
document.getElementById('dhor_duration_min').addEventListener('input', () => {
  if(document.getElementById('dhor_duration_min').value.length >= 2){
    document.getElementById('dhor_duration_sec').focus();
  }
});
// Blur (confirmed in chat): if Minutes is left with exactly 1 digit when
// focus leaves it -- by any means: iOS's checkmark, Android's Next,
// tapping Seconds manually, or tapping away entirely -- that single
// digit is treated as the whole value, defaulting Seconds to 00 rather
// than requiring it to be typed out explicitly. Only fires when Seconds
// is still genuinely empty, so it never overwrites a value someone
// already entered there.
document.getElementById('dhor_duration_min').addEventListener('blur', () => {
  const minEl = document.getElementById('dhor_duration_min');
  const secEl = document.getElementById('dhor_duration_sec');
  if(minEl.value.length === 1 && !secEl.value) secEl.value = '00';
});
function formatDhorDuration(totalSeconds){
  if(totalSeconds == null || isNaN(totalSeconds)) return '';
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Pure queue model follow-up (2026-08-02): replaces the old flat
// "Quarter 1".."Quarter N" dropdown (renderDhorPicker, same options
// regardless of which unit was selected) with a switch tied to the
// Amount/Unit value, confirmed in chat. Quarter always has exactly 4
// valid starting markers and Half always has exactly 2 -- true for BOTH
// 13-line and 15-line accounts, even though the underlying raw marker
// values differ (13-line quarters: 1,2,3,4; 15-line quarters: 1,3,5,7,
// since segmentsPerJuz is 8 there, not 4) -- so the slot COUNT never
// needs to branch on ref, only each slot's data-value does. Full has
// exactly one valid starting marker, so the whole field hides rather
// than showing a single, meaningless button -- this is also the fix for
// a real latent bug: previously nothing ever reset a stale Position when
// Full got selected, so an old Quarter/Half value could silently produce
// a segment that ran into part of the next juz' instead of the whole
// current one. Only rebuilds the available SLOTS for a unit; deciding
// what value they should reflect is left to the caller (setDhorUnit
// itself never overwrites dhor_position -- see its own comment below for
// why that split matters).
function renderDhorPositionOptions(unit){
  const field = document.getElementById('dhorPositionField');
  const row = document.getElementById('dhorJuzPositionRow');
  if(unit === 'full'){
    field.classList.add('hidden');
    row.classList.add('picker-row-single');
    document.getElementById('dhor_position').value = '1';
    return;
  }
  field.classList.remove('hidden');
  row.classList.remove('picker-row-single');
  const perJuz = segmentsPerJuz(dhorCurrentRef);
  const step = unitMarkerCount(dhorCurrentRef, unit); // raw markers per slot
  const slotCount = perJuz / step; // always 4 (quarter) or 2 (half), any ref
  const track = document.getElementById('dhor_position_switch');
  track.innerHTML = '<div class="switch-thumb"></div>' +
    Array.from({length: slotCount}, (_, i) =>
      `<button type="button" class="switch-option" data-value="${i * step + 1}">${i + 1}</button>`).join('');
  wireSwitch('dhor_position_switch', (value) => {
    document.getElementById('dhor_position').value = value;
    renderSwitch('dhor_position_switch', value);
  });
  renderSwitch('dhor_position_switch', document.getElementById('dhor_position').value);
}

// Fills the form from one plan row and remembers its id for save-time
// linking. Never called with null — clearing back to manual entry just
// means dhorActivePlanId stays null, which callers set directly.
// V3.24.0: Amount is now a 3-way switch (js/uiSwitch.js's shared
// renderSwitch/wireSwitch, same component already used elsewhere, e.g.
// Setup's Dhor Schedule granularity switch) instead of a <select>.
// dhor_unit stays a hidden input so the 4 existing .value reads/writes
// throughout this file don't need to change -- this helper is the one
// place that also keeps the visible switch synced whenever the value is
// set from code (a real switch click already updates itself via
// wireSwitch's own handler, further below).
// 2026-08-02: also rebuilds Position's own available slots for the new
// unit, but deliberately never touches dhor_position's VALUE itself --
// callers that restore a specific plan/segment (applyDhorPlan, the
// continue_last branch below) already set dhor_position BEFORE calling
// this, and rely on that value sticking; if this function reset it too,
// prepopulation would always show slot 1 regardless of what was actually
// planned. The "jump to slot 1 on a manual change" behavior confirmed in
// chat lives in the click handler just below instead, specifically
// because that's the one caller where resetting is actually wanted.
// 2026-08-07 (V3.37): index.html's dhor_unit_switch buttons are static
// markup ("Quarter"/"Half"/"Full") -- data-value stays quarter/half/full
// either way (that's the actual stored dhor_unit value, unrelated to
// display text), only the visible button TEXT changes here. "Full" is
// left as "Full" for both models -- not flagged as needing Juz'
// terminology, since it's descriptive UI text rather than a real term
// the way Maqra/Rub'/Hizb/Juz' are.
function updateDhorUnitSwitchLabels(ref){
  const track = document.getElementById('dhor_unit_switch');
  if(!track) return;
  const quarterBtn = track.querySelector('[data-value="quarter"]');
  const halfBtn = track.querySelector('[data-value="half"]');
  if(quarterBtn) quarterBtn.textContent = quarterUnitWord(ref);
  if(halfBtn) halfBtn.textContent = ref === 'uthmani' ? 'Hizb' : 'Half';
}
function setDhorUnit(unit){
  document.getElementById('dhor_unit').value = unit;
  renderSwitch('dhor_unit_switch', unit);
  renderDhorPositionOptions(unit);
}
wireSwitch('dhor_unit_switch', (value) => {
  document.getElementById('dhor_position').value = '1';
  setDhorUnit(value);
});

function applyDhorPlan(plan){
  dhorActivePlanId = plan.id;
  if(plan.segment_from != null && plan.segment_to != null){
    const { juz, positionInJuz, unit } = segmentRangeToPicker(plan.segment_from, plan.segment_to, dhorCurrentRef);
    document.getElementById('dhor_juz').value = String(juz);
    document.getElementById('dhor_position').value = String(positionInJuz);
    setDhorUnit(unit);
  }
}

// Pure queue model (2026-08-02, Phase B): source is one of 'today_plan'/
// 'continue_last'/null now -- 'missed_plan'/'future_plan' can no longer
// be reported (Phase A), and 'first_segment' already couldn't be
// (V3.24.0). 'today_plan' no longer branches on how many rows there are:
// a same-day batch of >1 is named in the text, but never shown as an
// inline picker any more (see renderDhorScreen) -- Plan Dhor is the one
// place left to see or choose among the rest of the batch.
// renderDhorPlanBanner removed entirely 2026-08-03 (confirmed in chat --
// Row 4: delete the banner text, not just shorten it). #dhorPlanBanner's
// container div is removed from index.html too, since nothing writes to
// it any more -- per the standing "no keeping unused things for a
// possible future tie-in" preference, not left as an empty stub.
async function renderDhorScreen(){
  dhorEditingId = null;
  document.getElementById('dhorEditTopbar').classList.add('hidden');
  document.getElementById('dhorEditBottombar').classList.add('hidden');
  document.getElementById('dhorSegmentPicker').classList.remove('hidden');
  document.getElementById('dhorAmountRow').classList.remove('hidden');
  // 2026-08-04: found and fixed -- this used to ensure-hide the timer
  // overlay on a fresh screen-open (back when it was hidden by default,
  // pre-V3.34.5). Since the rail restructuring, the Timer is a
  // permanent rail card, never something this function should hide at
  // all -- this leftover line was undoing that every single time the
  // screen opened, since a fresh timer's elapsed is always 0. Missed
  // during V3.34.5 because it lived here, in the screen's general reset,
  // not alongside the timer's own event handlers where the rest of that
  // cleanup happened.
  exitDhorRawRangeMode();
  exitEditScreenMode('card-dhor');
  dhorSelectedTags = [];
  dhorLapTimes = null;
  renderDhorLapRollup();
  document.getElementById('dhor_confirm').checked = false;
  setDhorDurationFields(null);
  dhorActivePlanId = null;
  document.getElementById('dhor_date').value = todayISO();
  document.getElementById('dhor_juz').innerHTML = Array.from({length:30}, (_,i) => `<option value="${i+1}">Juz ${i+1}</option>`).join('');

  try{
    const profile = await apiGetProfile();
    dhorCurrentRef = refForMushaf(profile.mushaf);
  } catch(e){
    dhorCurrentRef = 'waterval'; // sensible fallback if the profile fetch fails
  }
  updateDhorUnitSwitchLabels(dhorCurrentRef); // V3.37: before setDhorUnit below renders the switch
  // Explicit reset (2026-08-02): dhor_position is now a hidden input, not
  // a <select> -- rebuilding a select's innerHTML used to reset its own
  // displayed selection to the first option automatically every time
  // this screen opened; a hidden input has no such built-in behavior, so
  // this has to be deliberate now. setDhorUnit (next line) reads this
  // value when it rebuilds Position's slot options for whichever unit is
  // being defaulted to.
  document.getElementById('dhor_position').value = '1';
  // Default unit changed from Quarter to Half (confirmed in chat
  // 2026-08-03) -- this same default is also what Plan Dhor's "no setup,
  // no history" fallback reads live from this switch, so it isn't purely
  // cosmetic here any more.
  setDhorUnit('half');
  document.getElementById('dhor_mistakes').value = '0';
  renderTajweedPicker('dhorTajweedPicker', dhorSelectedTags);
  renderCommentBlock('dhorCommentBlock', null);
  // 2026-08-04: the timer (js/session-timer.js) is wired once, further
  // down this file, not re-created here every time this screen opens --
  // it's a static, persistent element (index.html), not something this
  // render function owns any more, the way the old inline #dhorTimerWrap
  // briefly was.

  // Pure queue model (2026-08-02, Phase B): computeDefaultDhorEntry
  // (worker/src/dhorSchedule.js) now only ever reports one of 3 things --
  // today's plan(s) (an explicit override for today, if one exists),
  // continuing from the last logged entry, or genuinely nothing. The old
  // "top up the rolling schedule" call that used to run here is gone --
  // ensureDhorSchedule doesn't generate anything any more (Phase A), so
  // calling it before this fetch never changed what it would return.
  try{
    const result = await apiGetDhorDefaultEntry();
    if(result.source === 'today_plan'){
      // A same-day batch of >1 rows used to force an inline "which one do
      // you mean" picker here (the "never auto-selected" rule, V3.9.0) --
      // deliberately reversed for the queue model: always pre-fill the
      // FIRST item in the batch directly. The rest of the batch is still
      // reachable via Plan Dhor, which shows the whole set, not just this
      // one.
      dhorTodaysPlans = result.plans;
      applyDhorPlan(dhorTodaysPlans[0]);
    } else if(result.source === 'continue_last'){
      dhorTodaysPlans = [];
      dhorActivePlanId = null;
      const { juz, positionInJuz, unit } = segmentRangeToPicker(result.segment_from, result.segment_to, dhorCurrentRef);
      document.getElementById('dhor_juz').value = String(juz);
      document.getElementById('dhor_position').value = String(positionInJuz);
      setDhorUnit(unit);
    } else {
      dhorTodaysPlans = [];
    }
  } catch(e){
    dhorTodaysPlans = [];
  }

  await renderRecentEntries('dhor', apiDhor, 'dhorRecentRail');
}

// 2026-08-04: the timer is now a persistent, static overlay element
// (index.html's #dhorTimerHost, js/session-timer.js) rather than an
// inline panel this screen used to own and re-create -- wired once here,
// not inside renderDhorScreen.
//
// Target (2026-08-04): now reads the student's own configured
// target_minutes_per_juz (Setup's "Minutes / juz'" field, worker/src/
// profile.js -- default 40 there too, so nothing changes for a student
// who's never touched that field), scaled by the card's current Amount/
// Unit selection. V3.34.0 briefly hardcoded 40 here directly -- flagged
// at the time as Claude's own unconfirmed choice, since a real, live
// Setup field turned out to already exist and this wasn't reading it;
// linked properly now, confirmed in chat.
function dhorTimerTargetMinutes(perJuzMinutes){
  const unit = document.getElementById('dhor_unit').value;
  if(unit === 'half') return perJuzMinutes / 2;
  if(unit === 'quarter') return perJuzMinutes / 4;
  return perJuzMinutes; // 'full'
}
// 2026-08-05, confirmed in chat: the mini pill's positioning is now
// pure CSS (css/detail-pages.css), the same inset:0 + flexbox pattern
// the app's own modals (.modal-overlay) already use successfully --
// see that file's comment for the full reasoning. This replaces a
// window.visualViewport-based JS approach from V3.34.8 that worked
// around the underlying iOS bug with a live-recalculated position
// instead of sidestepping the bug's actual mechanism (single-edge
// bottom: anchoring) the way the modals always have. That version
// visibly regressed desktop's position (the override applied
// unconditionally, replacing already-correct CSS with an unnecessary
// JS calculation) and the whole visualViewport/MutationObserver
// approach has been removed entirely, not just adjusted.
// 2026-08-04, confirmed in chat: the Timer is now a permanent rail card
// (js/logDetailScreen.js, index.html) rather than an on-demand overlay,
// so "opening" it means scrolling the rail there, not un-hiding
// anything -- there's no hidden state to remove any more. Navigates to
// logDetail first only if not already there, rather than always calling
// showScreen('logDetail', 'timer') unconditionally -- that would
// re-render Sabaq/Sabaq Dhor/Dhor from scratch every time (renderLogDetailScreen's
// own Promise.all), discarding any in-progress, unsaved work on them
// just because the timer was opened from elsewhere.
function scrollRailToTimer(){
  const screen = document.getElementById('screen-logDetail');
  if(screen.classList.contains('hidden')){
    showScreen('logDetail', 'timer');
    return;
  }
  const rail = document.getElementById('logDetailRail');
  const timerCard = document.getElementById('dhorTimerHost');
  rail.scrollTo({ left: timerCard.offsetLeft, behavior: 'smooth' });
}
document.getElementById('dhorStopwatchToggle').addEventListener('click', async () => {
  const host = document.getElementById('dhorTimerHost');
  let perJuzMinutes = 40;
  try{
    const profile = await apiGetProfile();
    if(profile.target_minutes_per_juz != null) perJuzMinutes = profile.target_minutes_per_juz;
  } catch(e){ /* fall back to the same 40 the field itself defaults to */ }
  host.setAttribute('target', String(dhorTimerTargetMinutes(perJuzMinutes)));
  host.mode = 'full';
  scrollRailToTimer();
});
// Close (2026-08-04, REDEFINED, confirmed in chat): used to minimise;
// now stops AND discards the session entirely -- a genuinely different
// action from the new dedicated Minimise button. reset() (js/session-
// timer.js) now also halts the clock, not just zeros it, so this is a
// clean "throw the whole session away" -- nothing about it is saved.
// No longer hides anything afterward -- the Timer is a permanent rail
// card now, there's nothing to hide; it simply sits there freshly reset,
// same as Sabaq/Sabaq Dhor/Dhor do after their own resets.
document.getElementById('dhorTimerHost').addEventListener('timer-close', (e) => {
  e.target.reset();
});
// Maximise (still emits 'timer-expand', same event the old tap-to-expand
// mini pill used) re-opens the full view and scrolls the rail to the
// Timer card -- the timer's own running state was never actually
// affected by being minimised, just its screen position, so nothing
// about it needs restoring here.
document.getElementById('dhorTimerHost').addEventListener('timer-expand', (e) => {
  e.target.mode = 'full';
  scrollRailToTimer();
});
// "Note Time" (2026-08-04, renamed from "Save", confirmed in chat -- the
// action is genuinely "record what the clock says," not a generic save):
// asks for confirmation first, every time, full view or pill -- Cancel
// leaves the timer exactly as it was (still running/paused, nothing
// lost); OK transfers elapsed+laps into the card's own fields the same
// way "Save" always did, and populates the new lap-times rollup next to
// the Stopwatch button (visible until the Dhor entry itself is actually
// logged). Resets the timer afterward -- no longer hides anything, the
// Timer is a permanent rail card now.
document.getElementById('dhorTimerHost').addEventListener('timer-save', (e) => {
  if(!confirm('Would you like to save this Dhor entry?\n\nCancel: no save, leave data in place.\nOK: save Dhor log.')) return;
  const { elapsed, laps } = e.detail;
  dhorLapTimes = laps && laps.length > 0 ? laps.map(ms => Math.round(ms / 1000)) : null;
  setDhorDurationFields(Math.round(elapsed / 1000));
  renderDhorLapRollup();
  e.target.reset();
});
// Card-level lap-times rollup (2026-08-04, confirmed in chat): shows
// what Note Time captured, right next to the Stopwatch button, until the
// Dhor entry itself is actually saved (at which point History takes
// over as the record of it -- see the 3 dhorLapTimes = null reset points
// elsewhere in this file, each now also calls this to hide/clear it).
function renderDhorLapRollup(){
  const wrap = document.getElementById('dhorLapRollup');
  const list = document.getElementById('dhorLapRollupList');
  if(!dhorLapTimes || dhorLapTimes.length === 0){
    wrap.classList.add('hidden');
    list.classList.add('hidden');
    list.innerHTML = '';
    document.getElementById('dhorLapRollupToggle').textContent = '▸ Lap times';
    return;
  }
  wrap.classList.remove('hidden');
  list.innerHTML = dhorLapTimes.map((s, i) => `<div>Lap ${i + 1}: ${formatDhorDuration(s)}</div>`).join('');
}
document.getElementById('dhorLapRollupToggle').addEventListener('click', () => {
  const list = document.getElementById('dhorLapRollupList');
  const expanded = !list.classList.contains('hidden');
  list.classList.toggle('hidden', expanded);
  document.getElementById('dhorLapRollupToggle').textContent = (expanded ? '▸' : '▾') + ' Lap times';
});


// V3.23.1: View Plan mirrors History's popup, but for what's still
// UPCOMING (today onward, still 'planned') rather than what's already
// been logged. Reuses the exact same .modal-overlay/.modal-card markup
// as renderRecentEntries's History popup (js/dhorPage.js, further below)
// for visual consistency, since it's the same "compact button opens a
// popup list" idea just facing the other direction in time.
// V3.24.0: Plan Dhor replaces the old read-only "View Plan" popup
// entirely -- a single unified selection surface across 3 views (Dhor
// Plan / View All Completed / View All), all sharing ONE underlying
// selection set (planDhorSelectedUnits, quarter-unit IDs) regardless of
// which tab a given unit was toggled from. This is what makes the save
// logic below genuinely uniform across all 3 tabs, per the confirmed
// design, rather than needing separate reconciliation per tab.
let planDhorPool = [];              // sorted quarter-unit IDs currently in baseline_selection
let planDhorTodaysPlans = [];       // today's batch (queueDays[0].items), shown individually
let planDhorQueueDays = [];         // Phase C (2026-08-03): [{day, items:[{segment_from,segment_to,ref}]}] from /dhor-schedule/upcoming -- no dates, day is just this array's own index
let planDhorExpandedDates = new Set(); // which rolled-up days are currently expanded (mixed completion only)
let planDhorSelectedUnits = new Set();
let planDhorRollup = {};            // { juzNum: 'quarters'|'half'|'full' }, default 'quarters'
let planDhorTab = 'plan';
let planDhorQueueRowUnits = []; // 2026-08-03: flat, render-order list of each Dhor Plan row's own units -- rebuilt fresh every render, used to range-select by POSITION in the queue rather than by quarter-unit value (see planDhorHandleQueueRowTap)
// Tap-first/tap-last range-select. null = no anchor yet (next tap starts
// a fresh single-row selection); a genuine 3rd tap always starts over
// rather than extending, which is what makes a non-contiguous selection
// structurally impossible to create at all -- same rule across all 3
// tabs now (2026-08-03: Dhor Plan's own rows used to be simple
// independent checkboxes instead; unified onto this same mechanism).
// {min,max} (quarter-unit value bounds) for "View All Completed"/"View
// All"'s plain ascending Juz' grid; a plain row-index number for Dhor
// Plan specifically (planDhorHandleQueueRowTap) -- queue order can wrap
// near the end of the pool, so ranging by value there could span more
// than the two rows actually tapped; ranging by position in the
// rendered list can't, and as a side effect can never include a unit
// outside the pool either, since nothing rendered here holds one.
let planDhorRangeStart = null;

// Converts a plan's (or any) segment_from/segment_to into the underlying
// quarter-unit IDs it spans -- the common representation every tab's
// selections get reduced to. Mirrors describeDhorSegment's own
// juz'/unit derivation (segmentRangeToPicker) rather than a second way.
function segmentToQuarterUnits(segment_from, segment_to, ref){
  const { juz, positionInJuz, unit } = segmentRangeToPicker(segment_from, segment_to, ref);
  if(unit === 'full') return quarterUnitsForJuz(juz);
  const perJuz = segmentsPerJuz(ref);
  if(unit === 'half'){
    const halfIdx = positionInJuz <= perJuz / 2 ? 1 : 2;
    return quarterUnitsForHalf(juz, halfIdx);
  }
  const quarterSize = perJuz / 4;
  const quarterIdx = Math.ceil(positionInJuz / quarterSize);
  return [quarterUnitId(juz, quarterIdx)];
}

// Given which quarter-unit IDs are "available" for juzNum in the current
// tab (pool membership for View All Completed; always all 4 for View
// All, just visually greyed if not actually in the pool) and that juz's
// current rollup level, returns the rows to show: merging into a half/
// full row only where ALL the quarters it needs are actually available
// -- falls back to individual quarters otherwise, the same "only a
// clean, fully-available group merges" rule Sabaq Dhor's own rollup
// uses, just evaluated per-juz here instead of for one active juz'.
// 2026-08-07 (V3.37): reads dhorCurrentRef (module-level, set in
// renderDhorScreen) rather than taking ref as a parameter -- this always
// renders the CURRENTLY-loaded student's own pool, same pattern already
// used elsewhere in this file (e.g. planDhorDaySummaryLabel's `first.ref
// || dhorCurrentRef`).
function computePlanDhorRowsForJuz(juzNum, availableSet){
  const level = planDhorRollup[juzNum] || 'full';
  const all4 = quarterUnitsForJuz(juzNum);
  const present = all4.filter(u => availableSet.has(u));
  if(present.length === 0) return [];
  if(level === 'full' && all4.every(u => availableSet.has(u))){
    return [{ units: all4, label: `Juz ${juzNum}` }];
  }
  if(level === 'half' || level === 'full'){
    const h1 = quarterUnitsForHalf(juzNum, 1), h2 = quarterUnitsForHalf(juzNum, 2);
    const h1Label = dhorCurrentRef === 'uthmani' ? `Hizb ${globalHizbNumber(juzNum, 1)}` : `Juz ${juzNum} H1`;
    const h2Label = dhorCurrentRef === 'uthmani' ? `Hizb ${globalHizbNumber(juzNum, 2)}` : `Juz ${juzNum} H2`;
    const rows = [];
    if(h1.every(u => availableSet.has(u))) rows.push({ units: h1, label: h1Label });
    else h1.filter(u => availableSet.has(u)).forEach(u => rows.push({ units: [u], label: quarterUnitLabel(u) }));
    if(h2.every(u => availableSet.has(u))) rows.push({ units: h2, label: h2Label });
    else h2.filter(u => availableSet.has(u)).forEach(u => rows.push({ units: [u], label: quarterUnitLabel(u) }));
    return rows;
  }
  return present.map(u => ({ units: [u], label: quarterUnitLabel(u) }));
}
// Bug fix (2026-08-03, found via testing while rebuilding Phase C, not
// something new -- this was already producing "Qundefined" in the old
// V3.24.1 Dhor Plan tab too, visible in an earlier screenshot):
// quarterUnitToJuzQuarter (shared/data.js) returns { juz, quarterIndex },
// not { juz, quarter } -- this was destructuring a property name that
// was never actually there.
// 2026-08-07 (V3.37): "R" for Ru'b, matching describeDhorSegment's own
// choice -- same flagged, easy-to-change-later abbreviation.
function quarterUnitLabel(unitId){
  const { juz, quarterIndex } = quarterUnitToJuzQuarter(unitId);
  return dhorCurrentRef === 'uthmani' ? `Juz ${juz} R${quarterIndex}` : `Juz ${juz} Q${quarterIndex}`;
}

// V3.24.1: "Portion A to Portion B" for a rolled-up day -- the earliest
// plan's own start point through the latest plan's own end point,
// ordered by segment_from since a day's sessions are generated
// sequentially advancing through the pool.
// Boundary label for one rollup row's "first to last" summary. 2026-08-04
// (confirmed in chat): matches the actual granularity each boundary is
// built from (reusing describeDhorSegment, the same "Juz 2 H1" style
// used everywhere else on the card) instead of always describing
// positions in quarter terms regardless of what granularity the batch
// actually is -- a half-juz' batch (what most Setup configurations
// actually produce) was being described with "Q1"/"Q3" even though no
// quarter-level granularity was ever involved. Collapses to the plain
// "Juz X to Juz Y" form only when a batch genuinely runs from the very
// start to the very end of those juz' -- checked by quarter-unit
// position, independent of whatever granularity the batch itself is.
function planDhorDaySummaryLabel(plans){
  const sorted = [...plans].sort((a,b) => a.segment_from - b.segment_from);
  const first = sorted[0], last = sorted[sorted.length - 1];
  const firstUnits = segmentToQuarterUnits(first.segment_from, first.segment_to, first.ref || dhorCurrentRef);
  const lastUnits = segmentToQuarterUnits(last.segment_from, last.segment_to, last.ref || dhorCurrentRef);
  const firstPos = quarterUnitToJuzQuarter(firstUnits[0]);
  const lastPos = quarterUnitToJuzQuarter(lastUnits[lastUnits.length - 1]);
  if(firstPos.quarterIndex === 1 && lastPos.quarterIndex === 4){
    return firstPos.juz === lastPos.juz ? `Juz ${firstPos.juz}` : `Juz ${firstPos.juz} to Juz ${lastPos.juz}`;
  }
  const firstLabel = describeDhorSegment(first.segment_from, first.segment_to, first.ref || dhorCurrentRef);
  const lastLabel = describeDhorSegment(last.segment_from, last.segment_to, last.ref || dhorCurrentRef);
  return `${firstLabel} to ${lastLabel}`;
}

// Renders one "rest of week" row for the Dhor Plan tab: a single row
// when the batch is only 1 item, otherwise an expandable summary --
// always collapsed by default (planDhorExpandedDates resets fresh every
// time the modal opens). No completion-status branching here at all
// (unlike the old date-grouped version this replaces): these are pure
// queue projections, computed on the fly, not real rows that could be
// partly done -- there's nothing to be ambiguous about, so the
// expand/collapse here is purely a "see more" affordance, not a "resolve
// mixed state" one.
function renderPlanDhorQueueDayRow(dayGroup){
  const allUnits = [...new Set(dayGroup.items.flatMap(p => segmentToQuarterUnits(p.segment_from, p.segment_to, p.ref || dhorCurrentRef)))];
  const summaryLabel = planDhorDaySummaryLabel(dayGroup.items);

  if(dayGroup.items.length === 1){
    const rowIndex = planDhorQueueRowUnits.push(allUnits) - 1;
    return `<div class="plan-dhor-tap-row" data-row-index="${rowIndex}">
      <span class="plan-dhor-row-text">${summaryLabel}</span>
      <input type="checkbox" class="plan-dhor-unit-cb" data-units="${allUnits.join(',')}" tabindex="-1">
    </div>`;
  }

  const expanded = planDhorExpandedDates.has(dayGroup.day);
  let html = `<button type="button" class="plan-dhor-expand-btn" data-day="${dayGroup.day}">${expanded ? '▾' : '▸'} ${summaryLabel}</button><span></span>`;
  if(expanded){
    dayGroup.items.forEach(p => {
      const units = segmentToQuarterUnits(p.segment_from, p.segment_to, p.ref || dhorCurrentRef);
      const rowIndex = planDhorQueueRowUnits.push(units) - 1;
      html += `<div class="plan-dhor-tap-row" data-row-index="${rowIndex}">
        <span class="plan-dhor-row-text plan-dhor-subrow">${describeDhorSegment(p.segment_from, p.segment_to, p.ref || dhorCurrentRef)}</span>
        <input type="checkbox" class="plan-dhor-unit-cb" data-units="${units.join(',')}" tabindex="-1">
      </div>`;
    });
  }
  return html;
}
function planDhorCanMergeUp(juzNum, availableSet){
  const level = planDhorRollup[juzNum] || 'full';
  if(level === 'full') return false;
  const rowsNow = computePlanDhorRowsForJuz(juzNum, availableSet).map(r => r.units.join(','));
  const nextLevel = level === 'quarters' ? 'half' : 'full';
  const saved = planDhorRollup[juzNum];
  planDhorRollup[juzNum] = nextLevel;
  const rowsNext = computePlanDhorRowsForJuz(juzNum, availableSet).map(r => r.units.join(','));
  planDhorRollup[juzNum] = saved;
  return rowsNow.join('|') !== rowsNext.join('|');
}
function planDhorCanSplitDown(juzNum){
  return (planDhorRollup[juzNum] || 'full') !== 'quarters';
}

// V3.24.0: raw-range mode -- the main Dhor form's alternate state for a
// selection that doesn't reduce to one clean quarter/half/juz (or spans
// more than one juz). Only ever entered/exited by Plan Dhor's save
// step below; nothing else in this file toggles it directly.
let dhorRawRange = null; // { units, fromLabel, toLabel } or null
function enterDhorRawRangeMode(range){
  dhorRawRange = range;
  document.getElementById('dhorSegmentPicker').classList.add('hidden');
  document.getElementById('dhorAmountRow').classList.add('hidden');
  document.getElementById('dhorRawRangeRow').classList.remove('hidden');
  document.getElementById('dhorRawFromBtn').textContent = range.fromLabel;
  document.getElementById('dhorRawToBtn').textContent = range.toLabel;
  document.getElementById('dhor_mistakes').disabled = true;
  document.getElementById('dhor_duration_min').disabled = true;
  document.getElementById('dhor_duration_sec').disabled = true;
  document.getElementById('dhorStopwatchToggle').disabled = true;
  const tajweedBtn = document.querySelector('#dhorTajweedPicker .tajweed-trigger-btn');
  if(tajweedBtn) tajweedBtn.disabled = true;
  dhorActivePlanId = null;
}
function exitDhorRawRangeMode(){
  dhorRawRange = null;
  document.getElementById('dhorRawRangeRow').classList.add('hidden');
  document.getElementById('dhorSegmentPicker').classList.remove('hidden');
  document.getElementById('dhorAmountRow').classList.remove('hidden');
  document.getElementById('dhor_mistakes').disabled = false;
  document.getElementById('dhor_duration_min').disabled = false;
  document.getElementById('dhor_duration_sec').disabled = false;
  document.getElementById('dhorStopwatchToggle').disabled = false;
  const tajweedBtn = document.querySelector('#dhorTajweedPicker .tajweed-trigger-btn');
  if(tajweedBtn) tajweedBtn.disabled = false;
}
document.getElementById('dhorRawFromBtn').addEventListener('click', () => { if(dhorRawRange) openPlanDhorModal(dhorRawRange.units); });
document.getElementById('dhorRawToBtn').addEventListener('click', () => { if(dhorRawRange) openPlanDhorModal(dhorRawRange.units); });

// Returns {juz, positionInJuz, unit} if sortedUnits is EXACTLY one clean
// quarter, one clean half, or one full juz within a SINGLE juz -- null
// for anything else (spans >1 juz, or an odd shape within one juz).
// Converts to a segment range and reuses the EXISTING
// segmentRangeToPicker to derive juz/positionInJuz/unit, rather than
// re-deriving that a second way.
function isCleanSingleUnit(sortedUnits, ref){
  if(sortedUnits.length === 0) return null;
  const { juz: juzFrom } = quarterUnitToJuzQuarter(sortedUnits[0]);
  const { juz: juzTo } = quarterUnitToJuzQuarter(sortedUnits[sortedUnits.length - 1]);
  if(juzFrom !== juzTo) return null;
  const all4 = quarterUnitsForJuz(juzFrom);
  const h1 = quarterUnitsForHalf(juzFrom, 1), h2 = quarterUnitsForHalf(juzFrom, 2);
  const key = sortedUnits.join(',');
  const isClean = key === all4.join(',') || key === h1.join(',') || key === h2.join(',') || sortedUnits.length === 1;
  if(!isClean) return null;
  const perJuz = segmentsPerJuz(ref);
  const quarterSize = perJuz / 4;
  // Bug fix (2026-08-03, found via testing): quarterUnitToJuzQuarter
  // returns { juz, quarterIndex }, not { juz, quarter } -- this was
  // reading a property name that was never actually there, so
  // firstQuarter/lastQuarter were always undefined and every segFrom/
  // segTo computed here came out NaN. This is what was writing "NaN" to
  // dhor_juz's value on save, leaving the Juz dropdown blank.
  const firstQuarter = quarterUnitToJuzQuarter(sortedUnits[0]).quarterIndex;
  const lastQuarter = quarterUnitToJuzQuarter(sortedUnits[sortedUnits.length - 1]).quarterIndex;
  const segFrom = (juzFrom - 1) * perJuz + (firstQuarter - 1) * quarterSize + 1;
  const segTo = (juzFrom - 1) * perJuz + lastQuarter * quarterSize;
  return segmentRangeToPicker(segFrom, segTo, ref);
}

function savePlanDhorSelection(){
  const errEl = document.getElementById('planDhorError');
  errEl.textContent = '';
  const sorted = [...planDhorSelectedUnits].sort((a,b) => a-b);
  if(sorted.length === 0){
    errEl.textContent = 'Please select at least one section.';
    return;
  }

  // Pool update moved to the Dhor card's own Save (2026-08-03, confirmed
  // in chat): "execution of the plan happens on the card, not in the
  // plan" -- this modal only ever populates the card now. Previously,
  // hitting Save here already grew the pool immediately, even if the
  // student then closed the card without ever logging anything --
  // nothing was recited, but the pool had already changed permanently.
  const finish = () => {
    document.getElementById('planDhorModal').remove();
  };

  const clean = isCleanSingleUnit(sorted, dhorCurrentRef);
  if(clean){
    exitDhorRawRangeMode();
    document.getElementById('dhor_juz').value = String(clean.juz);
    document.getElementById('dhor_position').value = String(clean.positionInJuz);
    setDhorUnit(clean.unit);
    finish();
    return;
  }

  if(!confirm('Your times and mistakes will not be recorded for this selection. Cancel to review, OK to continue.')) return;
  enterDhorRawRangeMode({
    units: sorted,
    fromLabel: quarterUnitLabel(sorted[0]),
    toLabel: quarterUnitLabel(sorted[sorted.length - 1])
  });
  finish();
}

document.getElementById('dhorViewPlanBtn').addEventListener('click', () => openPlanDhorModal());

async function openPlanDhorModal(preselectUnits){
  let profile = {};
  try{ profile = await apiGetProfile(); } catch(e){}
  planDhorPool = Array.isArray(profile.baseline_selection)
    ? [...new Set(profile.baseline_selection.filter(n => Number.isInteger(n) && n >= 1 && n <= 120))].sort((a,b) => a-b)
    : [];

  // Pure queue model, Phase C (2026-08-03): replaces V3.24.1's whole
  // yesterday/today/next-5-days date-grouped fetch with one call to the
  // queue engine's own "what's upcoming" computation -- no dates
  // anywhere in here any more, just queue position. dhor_unit (the
  // card's own live Amount/Unit switch value) is passed through as the
  // fallback granularity for a student who hasn't configured Setup's
  // Dhor Schedule yet -- confirmed in chat as the source for that one
  // case; the backend ignores it otherwise.
  let queueResult = { hasPool: false, days: [] };
  try{ queueResult = await apiGetUpcomingDhorQueue(document.getElementById('dhor_unit').value); } catch(e){ queueResult = { hasPool: false, days: [] }; }
  planDhorQueueDays = queueResult.days || [];
  planDhorTodaysPlans = planDhorQueueDays.length > 0 ? planDhorQueueDays[0].items : [];
  planDhorExpandedDates = new Set(); // always collapsed on open, confirmed in chat

  planDhorSelectedUnits = preselectUnits ? new Set(preselectUnits) : new Set();
  // Item 1 of today's batch is what's already loaded on the card itself
  // (renderDhorScreen's own prepopulation) -- pre-checking it here too,
  // confirmed in chat, keeps the tab and the card visually agreeing.
  if(!preselectUnits && planDhorTodaysPlans.length > 0){
    const first = planDhorTodaysPlans[0];
    segmentToQuarterUnits(first.segment_from, first.segment_to, first.ref || dhorCurrentRef)
      .forEach(u => planDhorSelectedUnits.add(u));
  }
  planDhorRangeStart = null;
  planDhorRollup = {};
  planDhorTab = preselectUnits ? 'all' : 'plan';
  renderPlanDhorModal();
}

function renderPlanDhorModal(){
  const already = document.getElementById('planDhorModal');
  if(already) already.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay plan-dhor-modal';
  overlay.id = 'planDhorModal';
  overlay.innerHTML = `<div class="modal-card plan-dhor-card">
    <div class="plan-dhor-row1">
      <span class="plan-dhor-title">Plan Dhor</span>
      <div class="plan-dhor-row1-icons">
        <button type="button" id="planDhorSaveBtn"><span class="btn-icon" id="planDhorSaveIcon"></span><span>Save</span></button>
        <button type="button" id="planDhorCloseBtn"><span class="btn-icon" id="planDhorCloseIcon"></span><span>Close</span></button>
      </div>
    </div>
    <div class="switch-track" id="planDhorTabSwitch">
      <div class="switch-thumb"></div>
      <button type="button" class="switch-option" data-value="plan">Dhor Plan</button>
      <button type="button" class="switch-option" data-value="all">View All</button>
    </div>
    <button type="button" class="plan-dhor-select-all hidden" id="planDhorSelectAllBtn">Select All</button>
    <div class="form-error" id="planDhorError"></div>
    <div id="planDhorContent" class="plan-dhor-content"></div>
  </div>`;
  document.body.appendChild(overlay);
  document.getElementById('planDhorSaveIcon').innerHTML = iconHtml('save');
  document.getElementById('planDhorCloseIcon').innerHTML = iconHtml('close');
  renderSwitch('planDhorTabSwitch', planDhorTab);
  wireSwitch('planDhorTabSwitch', (value) => {
    planDhorTab = value;
    planDhorRangeStart = null;
    // Bug fix (2026-08-04): this callback used to update planDhorTab and
    // redraw the content below without ever re-running renderSwitch --
    // the pill position and each option's .active state were computed
    // once at modal-open time and never touched again, so tapping a tab
    // correctly changed the view but left the switch itself looking
    // stuck on whichever tab was active when the modal first opened.
    renderSwitch('planDhorTabSwitch', planDhorTab);
    renderPlanDhorTabContent();
  });
  document.getElementById('planDhorSelectAllBtn').addEventListener('click', planDhorSelectAll);
  document.getElementById('planDhorCloseBtn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
  document.getElementById('planDhorSaveBtn').addEventListener('click', savePlanDhorSelection);
  renderPlanDhorTabContent();
}

// Select All applies to whichever set the current tab actually shows --
// all 120 quarter-units for View All (matching that tab's own
// "everything, greyed if incomplete" scope). View All Completed removed
// entirely 2026-08-04 (confirmed in chat): View All already showed
// everything it did, just with incomplete portions greyed out rather
// than hidden, making it redundant.
function planDhorSelectAll(){
  planDhorSelectedUnits = new Set(Array.from({length:120}, (_,i) => i+1));
  planDhorRangeStart = null;
  renderPlanDhorTabContent();
}

function renderPlanDhorTabContent(){
  const el = document.getElementById('planDhorContent');
  const selectAllBtn = document.getElementById('planDhorSelectAllBtn');
  selectAllBtn.classList.toggle('hidden', planDhorTab === 'plan');
  if(planDhorTab === 'plan'){
    if(planDhorQueueDays.length === 0){
      el.innerHTML = '<p class="form-hint">Nothing to show yet — mark some Juz\' complete in Hifz Setup first.</p>';
      return;
    }
    // Pure queue model, Phase C (2026-08-03): today (queueDays[0]) is
    // always shown individually, no dates, no completion status --
    // there's nothing here to be "complete" yet, these are computed
    // queue positions, not real plans rows. The rest of the week
    // (queueDays[1] onward) rolls up one row per batch via
    // renderPlanDhorQueueDayRow (below), confirmed in chat as the one
    // deliberate exception to "no rollup" -- future batches can't have
    // mixed completion state the way V3.24.1's date-grouped rows could,
    // so there's no ambiguity left to hide behind an expand toggle; it's
    // purely a "see more" affordance here, not a "resolve ambiguity" one.
    // 2026-08-03: rows use the same .plan-dhor-tap-row pattern as "View
    // All Completed"/"View All" now, not independent checkboxes --
    // confirmed in chat, so a selection across today's items and/or the
    // rest of the week can't end up non-contiguous. Ranged by POSITION
    // in this rendered list (planDhorQueueRowUnits), not by quarter-unit
    // value -- see planDhorHandleQueueRowTap for why.
    planDhorQueueRowUnits = [];
    let html = '<div class="plan-dhor-grid">';
    html += planDhorTodaysPlans.map(p => {
      const units = segmentToQuarterUnits(p.segment_from, p.segment_to, p.ref || dhorCurrentRef);
      const rowIndex = planDhorQueueRowUnits.push(units) - 1;
      return `<div class="plan-dhor-tap-row" data-row-index="${rowIndex}">
        <span class="plan-dhor-row-text">${describeDhorSegment(p.segment_from, p.segment_to, p.ref || dhorCurrentRef)}</span>
        <input type="checkbox" class="plan-dhor-unit-cb" data-units="${units.join(',')}" tabindex="-1">
      </div>`;
    }).join('');
    planDhorQueueDays.slice(1).forEach(g => { html += renderPlanDhorQueueDayRow(g); });
    html += '</div>';
    el.innerHTML = html;
    wirePlanDhorContent();
    return;
  }

  // View All Completed removed entirely 2026-08-04 (confirmed in chat):
  // View All already showed everything it did, just with incomplete
  // portions greyed out rather than hidden -- redundant to keep both.
  // Only "all" behavior remains for anything reaching this point (the
  // 'plan' tab returns above before this line).
  const availableSet = new Set(Array.from({length:120}, (_,i) => i+1));
  const juzNumbers = Array.from({length:30}, (_,i) => i+1);
  el.innerHTML = juzNumbers.map(juzNum => {
    const rows = computePlanDhorRowsForJuz(juzNum, availableSet);
    if(rows.length === 0) return '';
    const mergeUp = planDhorCanMergeUp(juzNum, availableSet);
    const splitDown = planDhorCanSplitDown(juzNum);
    return `<div class="plan-dhor-juz-block">
      <div class="plan-dhor-juz-rollup">
        ${mergeUp ? `<button type="button" class="plan-dhor-rollup-btn" data-action="up" data-juz="${juzNum}">${iconHtml('rollupMerge')}</button>` : ''}
        ${splitDown ? `<button type="button" class="plan-dhor-rollup-btn" data-action="down" data-juz="${juzNum}">${iconHtml('rollupSplit')}</button>` : ''}
      </div>
      <div class="plan-dhor-grid">
        ${rows.map(r => {
          const greyed = planDhorTab === 'all' && !r.units.every(u => planDhorPool.includes(u));
          return `<div class="plan-dhor-tap-row" data-units="${r.units.join(',')}">
            <span class="plan-dhor-row-text${greyed ? ' plan-dhor-row-greyed' : ''}">${r.label}</span>
            <input type="checkbox" class="plan-dhor-unit-cb" data-units="${r.units.join(',')}" tabindex="-1">
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
  wirePlanDhorContent();
}

function wirePlanDhorContent(){
  // Reflect current selection state on every checkbox, including the
  // 3-way checked/unchecked/indeterminate distinction a tap-based range
  // needs (a range boundary can fall inside a currently-rolled-up row,
  // e.g. half its underlying quarters selected and half not) -- native
  // indeterminate is exactly the right tool for that, no need to force
  // a rollup-level change just to make a partial selection displayable.
  // V3.24.1: disabled (already-completed) checkboxes are skipped here --
  // their checked state was fixed at render time and must stay true
  // regardless of the current selection, which they were never part of.
  document.querySelectorAll('.plan-dhor-unit-cb').forEach(cb => {
    if(cb.disabled) return;
    const units = cb.dataset.units.split(',').map(Number);
    const selectedCount = units.filter(u => planDhorSelectedUnits.has(u)).length;
    cb.checked = selectedCount === units.length;
    cb.indeterminate = selectedCount > 0 && selectedCount < units.length;
  });

  // Tap-first/tap-last range-select — 2026-08-03: now the same mechanism
  // for all 3 tabs, including Dhor Plan (confirmed in chat: a selection
  // spanning today's items and/or the rest of the week shouldn't be able
  // to end up non-contiguous any more than "View All Completed"/"View
  // All" already prevent). The whole row is the tap target (the checkbox
  // itself is display-only, tabindex=-1 and not directly wired), so
  // tapping the label works exactly like tapping the checkbox.
  document.querySelectorAll('.plan-dhor-tap-row').forEach(row => {
    row.addEventListener('click', () => {
      if(row.dataset.rowIndex !== undefined){
        planDhorHandleQueueRowTap(parseInt(row.dataset.rowIndex, 10));
      } else {
        const units = row.dataset.units.split(',').map(Number);
        planDhorHandleRowTap(units);
      }
    });
  });
  // Expand/collapse for Dhor Plan's "rest of week" rows only exist when
  // that tab is showing (renderPlanDhorQueueDayRow), but querying for
  // them elsewhere is harmless -- there simply aren't any to find.
  document.querySelectorAll('.plan-dhor-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Bug fix (2026-08-03): dataset values are always strings, but
      // dayGroup.day (renderPlanDhorQueueDayRow, above) is a number --
      // a Set treats 1 and "1" as different members, so without this
      // parseInt, planDhorExpandedDates.has(...) could never match
      // what was actually added, and no row would ever expand.
      const day = parseInt(btn.dataset.day, 10);
      if(planDhorExpandedDates.has(day)) planDhorExpandedDates.delete(day);
      else planDhorExpandedDates.add(day);
      renderPlanDhorTabContent();
    });
  });

  document.querySelectorAll('.plan-dhor-rollup-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const juzNum = parseInt(btn.dataset.juz, 10);
      const level = planDhorRollup[juzNum] || 'full';
      if(btn.dataset.action === 'up') planDhorRollup[juzNum] = level === 'quarters' ? 'half' : 'full';
      else planDhorRollup[juzNum] = level === 'full' ? 'half' : 'quarters';
      renderPlanDhorTabContent();
    });
  });
}

// First tap on a Juz-grid row: single-row selection, remembered as the
// range anchor. Second tap: completes the range from whichever anchor
// bound is earlier to whichever new bound is later (works regardless of
// tap order), then clears the anchor -- so a genuine third tap always
// starts a brand new range rather than extending this one.
function planDhorHandleRowTap(units){
  const minU = Math.min(...units), maxU = Math.max(...units);
  if(planDhorRangeStart === null){
    planDhorSelectedUnits = new Set(units);
    planDhorRangeStart = { min: minU, max: maxU };
  } else {
    const rangeMin = Math.min(planDhorRangeStart.min, minU);
    const rangeMax = Math.max(planDhorRangeStart.max, maxU);
    planDhorSelectedUnits = new Set();
    for(let u = rangeMin; u <= rangeMax; u++) planDhorSelectedUnits.add(u);
    planDhorRangeStart = null;
  }
  renderPlanDhorTabContent();
}
// Dhor Plan's own version of the same tap-first/tap-last idea (2026-08-03,
// confirmed in chat), ranging by POSITION in the rendered queue list
// (planDhorQueueRowUnits, built fresh every render -- see
// renderPlanDhorTabContent/renderPlanDhorQueueDayRow) rather than by
// quarter-unit value like planDhorHandleRowTap above. Queue order can
// wrap around near the end of the pool, so two rows that are adjacent in
// the actual queue could have numerically distant unit values -- ranging
// by value there could sweep in unrelated pool units sitting numerically
// in between, which never happens here, since the range is built purely
// from the actual rows between the two taps. That also means it can
// never include a unit outside the pool either: nothing rendered in this
// tab holds one in the first place, so no separate filtering is needed.
function planDhorHandleQueueRowTap(rowIndex){
  if(planDhorRangeStart === null){
    planDhorSelectedUnits = new Set(planDhorQueueRowUnits[rowIndex]);
    planDhorRangeStart = rowIndex;
  } else {
    const lo = Math.min(planDhorRangeStart, rowIndex);
    const hi = Math.max(planDhorRangeStart, rowIndex);
    planDhorSelectedUnits = new Set();
    for(let i = lo; i <= hi; i++) planDhorQueueRowUnits[i].forEach(u => planDhorSelectedUnits.add(u));
    planDhorRangeStart = null;
  }
  renderPlanDhorTabContent();
}
// Real user input into either field (not the timer's own programmatic
// auto-fill above) means they're overriding it -- drop lap times since
// they'd no longer sum to the new total (the total itself needs no
// special handling here, it's read fresh from both fields at save time
// either way -- see getDhorDurationSeconds above). Attached to both
// Minutes and Seconds now that Duration is 2 fields, not 1.
['dhor_duration_min', 'dhor_duration_sec'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    dhorLapTimes = null;
    renderDhorLapRollup();
  });
});

function loadDhorEntryForEdit(entry){
  exitDhorRawRangeMode();
  dhorEditingId = entry.id;
  document.getElementById('dhor_mistakes').value = entry.mistakes || 0;
  dhorSelectedTags = (entry.tajweed_tags || '').split(',').filter(Boolean);
  renderTajweedPicker('dhorTajweedPicker', dhorSelectedTags);
  renderCommentBlock('dhorCommentBlock', entry);
  // V3.21.1: duration/lap times are no longer excluded from editing.
  // V3.24.0: mm:ss is lossless, so this is just a direct format now --
  // no more "trust as exact until touched" bookkeeping needed.
  dhorLapTimes = entry.lap_times || null;
  renderDhorLapRollup();
  setDhorDurationFields(entry.duration_seconds);
  document.getElementById('dhorEditTopbarDate').textContent =
    `${entry.date} (${describeDhorSegment(entry.segment_from, entry.segment_to, entry.ref || dhorCurrentRef)} — not editable here)`;
  document.getElementById('dhorEditTopbar').classList.remove('hidden');
  document.getElementById('dhorEditBottombar').classList.remove('hidden');
  document.getElementById('dhorSegmentPicker').classList.add('hidden');
  document.getElementById('dhorAmountRow').classList.add('hidden');
  enterEditScreenMode('card-dhor');
}
function cancelDhorEdit(){
  dhorEditingId = null;
  document.getElementById('dhorEditTopbar').classList.add('hidden');
  document.getElementById('dhorEditBottombar').classList.add('hidden');
  document.getElementById('dhorSegmentPicker').classList.remove('hidden');
  document.getElementById('dhorAmountRow').classList.remove('hidden');
  exitEditScreenMode('card-dhor');
}
function resetDhorFormAfterEdit(){
  document.getElementById('dhor_mistakes').value = 0;
  dhorSelectedTags = [];
  renderTajweedPicker('dhorTajweedPicker', dhorSelectedTags);
  renderCommentBlock('dhorCommentBlock', null);
  dhorLapTimes = null;
  renderDhorLapRollup();
  setDhorDurationFields(null);
}
document.getElementById('dhorEditCancelBtn2').addEventListener('click', () => {
  cancelDhorEdit();
  resetDhorFormAfterEdit();
});
document.getElementById('dhorEditUpdateBtn').addEventListener('click', () => {
  document.getElementById('dhorSaveBtn').click();
});
document.getElementById('dhorEditDeleteBtn').addEventListener('click', async () => {
  if(!dhorEditingId) return;
  if(!confirm('Deleting this entry may create gaps in your history which cannot be recovered. Are you sure you want to DELETE?')) return;
  try{
    await apiDhor.remove(dhorEditingId);
    cancelDhorEdit();
    resetDhorFormAfterEdit();
    await renderRecentEntries('dhor', apiDhor, 'dhorRecentRail');
  } catch(e){
    document.getElementById('dhorError').textContent = "Couldn't delete: " + e.message;
  }
});
EDIT_HANDLERS.dhor = loadDhorEntryForEdit;

// Shared by both save paths below -- reads whatever's currently sitting
// in the 2 duration fields (Minutes/Seconds), same whether they were
// populated by the timer's own Note Time or typed in directly, since
// there's nothing left to distinguish once a value is in the fields.
function computeDhorDuration(){
  return { duration_seconds: getDhorDurationSeconds(), lap_times: dhorLapTimes };
}

document.getElementById('dhorSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('dhorError');
  errEl.textContent = '';

  if(dhorEditingId){
    // 2026-08-05, confirmed in chat: same hard-block as the new-entry
    // path below -- applies to edits too, not just new entries.
    if(!document.getElementById('dhor_confirm').checked){
      errEl.textContent = 'Please confirm the selection before saving.';
      return;
    }
    // segment fields deliberately omitted -- see loadDhorEntryForEdit.
    // duration/lap_times ARE included now (V3.21.1) -- there's a real
    // field for them, unlike segment which still isn't reconstructable.
    const payload = {
      mistakes: parseInt(document.getElementById('dhor_mistakes').value) || 0,
      tajweed_tags: dhorSelectedTags.join(','),
      ...computeDhorDuration(),
      ...readCommentBlock('dhorCommentBlock')
    };
    try{
      await apiDhor.update(dhorEditingId, payload);
      document.getElementById('dhorSaveStatus').classList.add('show');
      setTimeout(() => document.getElementById('dhorSaveStatus').classList.remove('show'), 1800);
      document.getElementById('dhor_confirm').checked = false;
      cancelDhorEdit();
      resetDhorFormAfterEdit();
      await renderRecentEntries('dhor', apiDhor, 'dhorRecentRail');
    } catch(e){
      errEl.textContent = "Couldn't save: " + e.message;
    }
    return;
  }

  // 2026-08-05, confirmed in chat: replaces the earlier "nothing
  // entered" confirm() entirely -- a real, dedicated confirmation
  // checkbox now, operating exactly like Sabaq Dhor's own hard-block.
  // Applies to every save, new or edit -- unlike the check it replaces,
  // which only applied to new entries, this is about confirming
  // whatever the current selection actually is, which matters just as
  // much when editing.
  if(!document.getElementById('dhor_confirm').checked){
    errEl.textContent = 'Please confirm the selection before saving.';
    return;
  }

  let segment_from, segment_to;
  if(dhorRawRange){
    // V3.24.0: a Plan Dhor selection that didn't reduce to one clean
    // quarter/half/juz -- the raw range IS the segment, computed once
    // already when the selection was made (dhorRawRange.units). Mistakes/
    // duration/tajweed are disabled fields in this mode and deliberately
    // excluded below, not just left at whatever they happen to show.
    const sorted = dhorRawRange.units;
    const perJuz = segmentsPerJuz(dhorCurrentRef);
    const quarterSize = perJuz / 4;
    const first = quarterUnitToJuzQuarter(sorted[0]);
    const last = quarterUnitToJuzQuarter(sorted[sorted.length - 1]);
    // Bug fix (2026-08-03, found via audit): same .quarter/.quarterIndex
    // property-name mistake as isCleanSingleUnit -- this one is worse,
    // since it's in the actual Save path: every raw-range Dhor entry
    // logged before this fix has NaN written to dhor_log's segment_from/
    // segment_to.
    segment_from = (first.juz - 1) * perJuz + (first.quarterIndex - 1) * quarterSize + 1;
    segment_to = (last.juz - 1) * perJuz + last.quarterIndex * quarterSize;
  } else {
    const juz = parseInt(document.getElementById('dhor_juz').value);
    const position = parseInt(document.getElementById('dhor_position').value);
    const unit = document.getElementById('dhor_unit').value;
    ({ segment_from, segment_to } = computeSegmentRange(juz, position, dhorCurrentRef, unit));
  }

  const payload = {
    date: document.getElementById('dhor_date').value || todayISO(),
    segment_from, segment_to, ref: dhorCurrentRef,
    tajweed_tags: dhorRawRange ? '' : dhorSelectedTags.join(','),
    mistakes: dhorRawRange ? null : (parseInt(document.getElementById('dhor_mistakes').value) || 0),
    ...(dhorRawRange ? { duration_seconds: null, lap_times: null } : computeDhorDuration()),
    ...readCommentBlock('dhorCommentBlock')
  };
  if(dhorActivePlanId) payload.plan_id = dhorActivePlanId;

  try{
    await apiDhor.save(payload);
    // Pool update, moved here from Plan Dhor's own Save (2026-08-03,
    // confirmed in chat): "logged entries go into history and add to
    // the dhor pool... any save from the dhor card should add to the
    // dhor pool" -- covers both branches above (a clean segment and a
    // raw range both already computed a real segment_from/segment_to),
    // and runs regardless of whether this entry came from a Plan Dhor
    // selection or was entered fully manually, so the two paths can no
    // longer drift apart the way they could before. Fetches the profile
    // fresh rather than trusting planDhorPool, since that's only ever
    // populated once Plan Dhor's own modal has been opened this session
    // -- a fully manual entry might never have touched it at all.
    let profile = {};
    try{ profile = await apiGetProfile(); } catch(e){}
    const currentPool = Array.isArray(profile.baseline_selection)
      ? [...new Set(profile.baseline_selection.filter(n => Number.isInteger(n) && n >= 1 && n <= 120))].sort((a,b) => a-b)
      : [];
    const loggedUnits = segmentToQuarterUnits(segment_from, segment_to, dhorCurrentRef);
    const newUnits = loggedUnits.filter(u => !currentPool.includes(u));
    if(newUnits.length > 0){
      const merged = [...new Set([...currentPool, ...newUnits])].sort((a,b) => a-b);
      apiSaveProfile({ baseline_selection: merged }).catch(() => { /* best-effort, matches the original behaviour this moved from */ });
    }
    document.getElementById('dhorSaveStatus').classList.add('show');
    setTimeout(() => document.getElementById('dhorSaveStatus').classList.remove('show'), 1800);
    await renderRecentEntries('dhor', apiDhor, 'dhorRecentRail');
    // Items 1+2 (2026-08-04, confirmed in chat): every successful save --
    // whether the entry came from the timer or was entered fully
    // manually -- clears the whole form and immediately repopulates it
    // with the next queue item, rather than leaving the just-saved
    // entry's values sitting on screen until the student navigates away
    // and back. renderDhorScreen already does exactly this (fresh reset
    // + a real fetch of the next default entry) every time the screen
    // opens, so reusing it here directly is simpler and more consistent
    // than duplicating a second, partial version of the same reset --
    // this replaces what used to be 3 separate lines doing part of the
    // same job (clearing laps/the rollup, exiting raw-range mode).
    await renderDhorScreen();
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
});

// Shared across the log cards — a swipe rail of recent entries for that
// log type, tapped to view (read-only for now; editing an existing entry
// from here is a follow-up, not built in this pass).
// V3.14.2: replaced the swipe rail with a "History" button. Tapping it
// opens the full list (up to 50 entries) in a popup, reusing the same
// per-type describeEntryForRail formatting.
// V3.18.0: the last-2-entries stack below the button is removed per the
// confirmed scope -- button alone is enough for now. Button text is now
// type-specific ("Sabaq History", "Dhor History", etc.) instead of a
// generic "History".
const HISTORY_BTN_LABEL = { sabaq: 'Sabaq History', sabaqDhor: 'Sabaq Dhor History', dhor: 'History', reflections: 'Tadabbur History' };
// V3.21.0: each row now gets an edit (pencil) icon. Editing loads the
// entry into that card's own form (loadXForEdit, defined per-card) rather
// than a separate edit form -- reuses all the existing validation/
// pickers as-is. isLatest (this row === rows[0], since rows is already
// sorted most-recent-first) is passed through so Sabaq's save handler
// knows whether it's safe to recompute position afterward -- see
// js/sabaqPage.js for why that matters.
// V3.45.1: optional 4th parameter onRowClick, confirmed in chat for
// Tadabbur specifically -- tapping an entry's own content area (not
// its edit icon) opens it for reading. Purely additive: the 3 existing
// callers (Sabaq/Sabaq Dhor/Dhor) don't pass this, so their rows stay
// exactly as non-interactive as before -- only Tadabbur's own call
// site opts in.
async function renderRecentEntries(type, client, railId, onRowClick){
  const container = document.getElementById(railId);
  let rows = [];
  try{ rows = await client.get(); } catch(e){ rows = []; }
  rows = rows.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id||0) - (a.id||0));

  const label = HISTORY_BTN_LABEL[type] || 'History';
  container.innerHTML = `<button type="button" class="history-btn" id="${railId}_historyBtn">${label}</button>`;

  document.getElementById(`${railId}_historyBtn`).addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay history-popup-modal';
    overlay.innerHTML = `<div class="modal-card">
      <button type="button" class="close-btn" id="historyPopupCloseBtn">&times;</button>
      <h2>History</h2>
      <div class="history-full-list">
        ${rows.slice(0, 50).map((r, i) => `<div class="history-entry-row">
          <div class="history-entry-content"${onRowClick ? ` data-index="${i}"` : ''}>
            <div class="rail-card-date">${r.date}</div>
            <div class="rail-card-body">${describeEntryForRail(type, r)}</div>
            ${type === 'dhor' && r.lap_times && r.lap_times.length > 0 ? `<div class="rail-card-laps">${r.lap_times.map(formatDhorDuration).join(' · ')}</div>` : ''}
          </div>
          ${EDIT_HANDLERS[type] ? `<button type="button" class="history-entry-edit-btn" data-index="${i}" aria-label="Edit"></button>` : ''}
        </div>`).join('') || '<div class="form-hint">Nothing logged yet.</div>'}
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('.history-entry-edit-btn').forEach(btn => {
      btn.innerHTML = iconHtml('edit');
      btn.addEventListener('click', () => {
        const row = rows.slice(0, 50)[parseInt(btn.dataset.index, 10)];
        overlay.remove();
        EDIT_HANDLERS[type](row, row === rows[0]);
      });
    });
    if(onRowClick){
      overlay.querySelectorAll('.history-entry-content').forEach(el => {
        el.classList.add('history-entry-content-clickable');
        el.addEventListener('click', () => {
          const row = rows.slice(0, 50)[parseInt(el.dataset.index, 10)];
          onRowClick(row);
        });
      });
    }
    overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
    document.getElementById('historyPopupCloseBtn').addEventListener('click', () => overlay.remove());
  });
}
function describeEntryForRail(type, r){
  if(type === 'dhor') return `${describeDhorSegment(r.segment_from, r.segment_to, r.ref || dhorCurrentRef)} · ${r.mistakes||0} mistakes${r.duration_seconds?` · ${Math.round(r.duration_seconds/60)} min`:''}`;
  if(type === 'sabaq') return `${r.sabaq_from}-${r.sabaq_to}${r.line_count?` · ${r.line_count} lines`:''}${r.page_count?` · ${r.page_count} pages`:''}`;
  if(type === 'sabaqDhor') return `${r.from_surah}:${r.from_ayah}-${r.to_surah}:${r.to_ayah} · ${r.mistakes||0} mistakes`;
  // V3.45.1: reflections' own summary is its first line, confirmed in
  // chat ("date and first line of tadabbur entry") -- truncated too,
  // in case a single line itself runs long, so a row never grows to
  // dominate the list.
  if(type === 'reflections'){
    const firstLine = (r.reflection || '').split('\n')[0].trim();
    if(!firstLine) return '(empty)';
    return firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine;
  }
  return '';
}
