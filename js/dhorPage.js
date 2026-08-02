// ============================================================
// Hifzhelper — Dhor card (one of 4 in the unified day-log view, V3.6.1)
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
// V3.23.0 (Dhor detail rebuild, Phase A): the zero-plan-for-today case no
// longer just falls back to a blank manual picker. apiGetDhorDefaultEntry
// (worker/src/dhorSchedule.js's computeDefaultDhorEntry) now checks, in
// order: a missed plan (backdated to ITS OWN date, a catch-up entry) →
// the closest future plan (today's date, borrowed early) → continuing
// from the last actual Dhor entry (at THAT entry's own granularity,
// walking the eligible pool forward) → the very first eligible segment.
// Only when none of those produce anything does the manual picker stay
// genuinely blank, same as before this round.
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
function refForMushaf(mushaf){ return mushaf === '15line_madani' ? 'uthmani' : 'waterval'; }

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
function describeDhorSegment(segment_from, segment_to, ref){
  const { juz, positionInJuz, unit } = segmentRangeToPicker(segment_from, segment_to, ref);
  if(unit === 'full') return `Juz ${juz}`;
  const perJuz = segmentsPerJuz(ref);
  if(unit === 'half'){
    const halfIndex = positionInJuz <= perJuz / 2 ? 1 : 2;
    return `Juz ${juz} H${halfIndex}`;
  }
  const quarterSize = perJuz / 4;
  const quarterIndex = Math.ceil(positionInJuz / quarterSize);
  return `Juz ${juz} Q${quarterIndex}`;
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
// is no longer needed and has been removed; parseDhorDuration/
// formatDhorDuration below always convert directly, with no precision
// lost either way.
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

// V3.24.0: mm:ss parsing/formatting for the Duration field. A colon-less
// digit entry (e.g. "12") is read as whole minutes with 0 seconds --
// confirmed in chat for exactly 2 digits; extended here to any digit
// count (1 or 3+), flagged as Claude's own extension since only the
// 2-digit case was specified.
function parseDhorDuration(text){
  const trimmed = String(text || '').trim();
  if(!trimmed) return null;
  if(trimmed.includes(':')){
    const [mPart, sPart] = trimmed.split(':');
    const m = parseInt(mPart, 10) || 0;
    const s = parseInt(sPart, 10) || 0;
    return m * 60 + s;
  }
  const mins = parseInt(trimmed, 10);
  return isNaN(mins) ? null : mins * 60;
}
function formatDhorDuration(totalSeconds){
  if(totalSeconds == null || isNaN(totalSeconds)) return '';
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function renderDhorPicker(){
  const perJuz = segmentsPerJuz(dhorCurrentRef);
  const posSel = document.getElementById('dhor_position');
  posSel.innerHTML = Array.from({length: perJuz}, (_,i) =>
    `<option value="${i+1}">${dhorCurrentRef === 'waterval' ? 'Quarter' : '1/8'} ${i+1}</option>`).join('');
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
function setDhorUnit(unit){
  document.getElementById('dhor_unit').value = unit;
  renderSwitch('dhor_unit_switch', unit);
}
wireSwitch('dhor_unit_switch', (value) => setDhorUnit(value));

function applyDhorPlan(plan){
  dhorActivePlanId = plan.id;
  if(plan.segment_from != null && plan.segment_to != null){
    const { juz, positionInJuz, unit } = segmentRangeToPicker(plan.segment_from, plan.segment_to, dhorCurrentRef);
    document.getElementById('dhor_juz').value = String(juz);
    document.getElementById('dhor_position').value = String(positionInJuz);
    setDhorUnit(unit);
  }
}

// V3.23.0: now takes the source computeDefaultDhorEntry reported, so the
// student can see WHY something got pre-filled rather than just seeing
// fields silently populated. dateInfo is only meaningful for
// 'missed_plan' (the backdated catch-up date).
function renderDhorPlanBanner(source, dateInfo){
  const el = document.getElementById('dhorPlanBanner');
  if(!el) return;
  if(source === 'today_plan' && dhorTodaysPlans.length > 1){
    // More than one planned session for today — a plain selector, never
    // auto-picked (per the "never auto-selected" rule already agreed for
    // this feature). Reuses .tajweed-tag's pill look for consistency with
    // every other single-select control in the app.
    el.innerHTML = `<div class="form-hint">More than one plan for today — pick one, or leave unpicked to enter manually:</div>
      <div id="dhorPlanChoices">` +
      dhorTodaysPlans.map(p => `<button type="button" class="tajweed-tag" data-plan-id="${p.id}">${describeDhorSegment(p.segment_from, p.segment_to, p.ref || dhorCurrentRef)}</button>`).join('') +
      `</div>`;
    el.querySelectorAll('[data-plan-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const plan = dhorTodaysPlans.find(p => p.id === parseInt(btn.dataset.planId, 10));
        applyDhorPlan(plan);
        el.querySelectorAll('[data-plan-id]').forEach(b => b.classList.toggle('active', b === btn));
      });
    });
    return;
  }
  const TEXT = {
    today_plan: `Pre-filled from today's plan.`,
    missed_plan: `No plan for today — catching up on ${dateInfo}, which was missed.`,
    future_plan: `Nothing planned for today — pre-filled from your next upcoming session.`,
    continue_last: `No plan set up yet — continuing from your last Dhor session.`,
    first_segment: `No plan or history yet — starting from your first eligible segment.`
  };
  el.innerHTML = TEXT[source] ? `<div class="form-hint">${TEXT[source]}</div>` : '';
}

async function renderDhorScreen(){
  dhorEditingId = null;
  document.getElementById('dhorEditTopbar').classList.add('hidden');
  document.getElementById('dhorEditBottombar').classList.add('hidden');
  document.getElementById('dhorSegmentPicker').classList.remove('hidden');
  document.getElementById('dhorAmountRow').classList.remove('hidden');
  document.getElementById('dhorTimerPanel').classList.add('hidden');
  exitDhorRawRangeMode();
  exitEditScreenMode('card-dhor');
  dhorSelectedTags = [];
  dhorLapTimes = null;
  document.getElementById('dhor_duration_minutes').value = '';
  dhorActivePlanId = null;
  document.getElementById('dhor_date').value = todayISO();
  document.getElementById('dhor_juz').innerHTML = Array.from({length:30}, (_,i) => `<option value="${i+1}">Juz ${i+1}</option>`).join('');

  try{
    const profile = await apiGetProfile();
    dhorCurrentRef = refForMushaf(profile.mushaf);
  } catch(e){
    dhorCurrentRef = 'waterval'; // sensible fallback if the profile fetch fails
  }
  renderDhorPicker();
  setDhorUnit('quarter');
  document.getElementById('dhor_mistakes').value = '0';
  renderTajweedPicker('dhorTajweedPicker', dhorSelectedTags);
  renderCommentBlock('dhorCommentBlock', null);
  renderTimer('dhorTimerWrap', (result) => {
    dhorLapTimes = result.lap_times || null;
    // Programmatic assignment -- deliberately doesn't fire 'input', so
    // this doesn't trip the manual-override handler below. mm:ss is a
    // lossless format (unlike the old 1-decimal-minute display), so this
    // is the exact value, not an approximation.
    document.getElementById('dhor_duration_minutes').value = formatDhorDuration(result.duration_seconds);
    updateDhorTimerSummary();
  });
  updateDhorTimerSummary();

  // Best-effort: top up the rolling schedule before asking for today's
  // plan, so a fresh day gets its row without the student needing to
  // open Setup first. Never blocks or errors the rest of the screen —
  // the manual picker is always the fallback if this fails (e.g. no
  // schedule configured yet).
  try{ await apiEnsureDhorSchedule(); } catch(e){ /* not configured yet, or offline — fine */ }

  // V3.23.0: computeDefaultDhorEntry (worker/src/dhorSchedule.js) checks
  // today's plan(s) first, then falls through missed → future → continue-
  // from-last-entry → first-ever-segment, in that order. Only 'today_plan'
  // with more than one row still needs a picker here (dhorTodaysPlans) --
  // every other source is a single, fully-resolved answer.
  try{
    const result = await apiGetDhorDefaultEntry();
    if(result.source === 'today_plan'){
      dhorTodaysPlans = result.plans;
      renderDhorPlanBanner('today_plan');
      if(dhorTodaysPlans.length === 1) applyDhorPlan(dhorTodaysPlans[0]);
    } else if(result.source === 'missed_plan' || result.source === 'future_plan'){
      dhorTodaysPlans = [];
      applyDhorPlan({ id: result.plan_id, segment_from: result.segment_from, segment_to: result.segment_to });
      if(result.source === 'missed_plan') document.getElementById('dhor_date').value = result.date;
      renderDhorPlanBanner(result.source, result.date);
    } else if(result.source === 'continue_last' || result.source === 'first_segment'){
      dhorTodaysPlans = [];
      dhorActivePlanId = null;
      const { juz, positionInJuz, unit } = segmentRangeToPicker(result.segment_from, result.segment_to, dhorCurrentRef);
      document.getElementById('dhor_juz').value = String(juz);
      document.getElementById('dhor_position').value = String(positionInJuz);
      setDhorUnit(unit);
      renderDhorPlanBanner(result.source);
    } else {
      dhorTodaysPlans = [];
      renderDhorPlanBanner(null);
    }
  } catch(e){
    dhorTodaysPlans = [];
    renderDhorPlanBanner(null);
  }

  await renderRecentEntries('dhor', apiDhor, 'dhorRecentRail');
}

function updateDhorTimerSummary(){
  const el = document.getElementById('dhorTimerSummary');
  el.textContent = dhorLapTimes ? `${dhorLapTimes.length} laps recorded` : '';
}
// V3.23.1: the timer widget (Start/Stop/Lap) used to always take up its
// own space below Duration -- now hidden by default, toggled open/closed
// by the Stopwatch button beside Duration.
document.getElementById('dhorStopwatchToggle').addEventListener('click', () => {
  document.getElementById('dhorTimerPanel').classList.toggle('hidden');
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
let planDhorTodaysPlans = [];       // today's plan_type='dhor', status='planned' rows
let planDhorSelectedUnits = new Set();
let planDhorRollup = {};            // { juzNum: 'quarters'|'half'|'full' }, default 'quarters'
let planDhorTab = 'plan';
// V3.24.0 (revised): tap-first/tap-last range-select for the 2 Juz-grid
// tabs (Dhor Plan tab keeps simple per-plan checkbox toggles instead --
// plans are discrete scheduled sessions, not really a "range" concept).
// null = no anchor yet (next tap starts a fresh single-row selection);
// {min,max} = first tap's quarter-unit bounds, waiting for a second tap
// to complete the range. A genuine 3rd tap always starts over rather
// than extending, which is what makes a non-contiguous selection
// structurally impossible to create at all.
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
function computePlanDhorRowsForJuz(juzNum, availableSet){
  const level = planDhorRollup[juzNum] || 'quarters';
  const all4 = quarterUnitsForJuz(juzNum);
  const present = all4.filter(u => availableSet.has(u));
  if(present.length === 0) return [];
  if(level === 'full' && all4.every(u => availableSet.has(u))){
    return [{ units: all4, label: `Juz ${juzNum}` }];
  }
  if(level === 'half' || level === 'full'){
    const h1 = quarterUnitsForHalf(juzNum, 1), h2 = quarterUnitsForHalf(juzNum, 2);
    const rows = [];
    if(h1.every(u => availableSet.has(u))) rows.push({ units: h1, label: `Juz ${juzNum} H1` });
    else h1.filter(u => availableSet.has(u)).forEach(u => rows.push({ units: [u], label: quarterUnitLabel(u) }));
    if(h2.every(u => availableSet.has(u))) rows.push({ units: h2, label: `Juz ${juzNum} H2` });
    else h2.filter(u => availableSet.has(u)).forEach(u => rows.push({ units: [u], label: quarterUnitLabel(u) }));
    return rows;
  }
  return present.map(u => ({ units: [u], label: quarterUnitLabel(u) }));
}
function quarterUnitLabel(unitId){
  const { juz, quarter } = quarterUnitToJuzQuarter(unitId);
  return `Juz ${juz} Q${quarter}`;
}
function planDhorCanMergeUp(juzNum, availableSet){
  const level = planDhorRollup[juzNum] || 'quarters';
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
  return (planDhorRollup[juzNum] || 'quarters') !== 'quarters';
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
  document.getElementById('dhor_duration_minutes').disabled = true;
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
  document.getElementById('dhor_duration_minutes').disabled = false;
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
  const firstQuarter = quarterUnitToJuzQuarter(sortedUnits[0]).quarter;
  const lastQuarter = quarterUnitToJuzQuarter(sortedUnits[sortedUnits.length - 1]).quarter;
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

  const finish = () => {
    const newUnits = sorted.filter(u => !planDhorPool.includes(u));
    if(newUnits.length > 0){
      const merged = [...new Set([...planDhorPool, ...newUnits])].sort((a,b) => a-b);
      apiSaveProfile({ baseline_mode: 'juz', baseline_selection: merged }).catch(() => { /* best-effort */ });
    }
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

  let allPlans = [];
  try{ allPlans = await apiPlans.get({ date: todayISO() }); } catch(e){ allPlans = []; }
  planDhorTodaysPlans = (allPlans || []).filter(p => p.plan_type === 'dhor' && p.status === 'planned');

  planDhorSelectedUnits = preselectUnits ? new Set(preselectUnits) : new Set();
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
      <button type="button" class="switch-option" data-value="completed">View All Completed</button>
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
    renderPlanDhorTabContent();
  });
  document.getElementById('planDhorSelectAllBtn').addEventListener('click', planDhorSelectAll);
  document.getElementById('planDhorCloseBtn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
  document.getElementById('planDhorSaveBtn').addEventListener('click', savePlanDhorSelection);
  renderPlanDhorTabContent();
}

// Select All applies to whichever set the current tab actually shows --
// the pool for View All Completed, all 120 quarter-units for View All
// (matching that tab's own "everything, greyed if incomplete" scope).
function planDhorSelectAll(){
  planDhorSelectedUnits = planDhorTab === 'completed'
    ? new Set(planDhorPool)
    : new Set(Array.from({length:120}, (_,i) => i+1));
  planDhorRangeStart = null;
  renderPlanDhorTabContent();
}

function renderPlanDhorTabContent(){
  const el = document.getElementById('planDhorContent');
  const selectAllBtn = document.getElementById('planDhorSelectAllBtn');
  selectAllBtn.classList.toggle('hidden', planDhorTab === 'plan');
  if(planDhorTab === 'plan'){
    if(planDhorTodaysPlans.length === 0){
      el.innerHTML = '<p class="form-hint">Nothing scheduled for today.</p>';
      return;
    }
    // Dhor Plan tab: simple per-plan checkbox toggles, not range-select --
    // plans are discrete scheduled sessions, confirmed as a different
    // interaction from the two Juz-grid tabs below.
    el.innerHTML = `<div class="plan-dhor-grid">` + planDhorTodaysPlans.map(p => {
      const units = segmentToQuarterUnits(p.segment_from, p.segment_to, p.ref || dhorCurrentRef);
      const checked = units.every(u => planDhorSelectedUnits.has(u));
      return `<label class="plan-dhor-row-text">${describeDhorSegment(p.segment_from, p.segment_to, p.ref || dhorCurrentRef)}</label>
        <input type="checkbox" class="plan-dhor-unit-cb" data-units="${units.join(',')}"${checked ? ' checked' : ''}>`;
    }).join('') + `</div>`;
    wirePlanDhorContent();
    return;
  }

  const availableSet = planDhorTab === 'completed' ? new Set(planDhorPool) : new Set(Array.from({length:120}, (_,i) => i+1));
  const juzNumbers = planDhorTab === 'completed'
    ? [...new Set(planDhorPool.map(u => quarterUnitToJuzQuarter(u).juz))].sort((a,b) => a-b)
    : Array.from({length:30}, (_,i) => i+1);
  if(juzNumbers.length === 0){
    el.innerHTML = '<p class="form-hint">Nothing marked complete yet.</p>';
    return;
  }
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
  document.querySelectorAll('.plan-dhor-unit-cb').forEach(cb => {
    const units = cb.dataset.units.split(',').map(Number);
    const selectedCount = units.filter(u => planDhorSelectedUnits.has(u)).length;
    cb.checked = selectedCount === units.length;
    cb.indeterminate = selectedCount > 0 && selectedCount < units.length;
  });

  if(planDhorTab === 'plan'){
    // Simple independent toggle, one plan at a time.
    document.querySelectorAll('.plan-dhor-unit-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const units = cb.dataset.units.split(',').map(Number);
        units.forEach(u => cb.checked ? planDhorSelectedUnits.add(u) : planDhorSelectedUnits.delete(u));
      });
    });
  } else {
    // Tap-first/tap-last range-select -- the whole row is the tap
    // target (the checkbox itself is display-only, tabindex=-1 and not
    // directly wired), so tapping the label works exactly like tapping
    // the checkbox.
    document.querySelectorAll('.plan-dhor-tap-row').forEach(row => {
      row.addEventListener('click', () => {
        const units = row.dataset.units.split(',').map(Number);
        planDhorHandleRowTap(units);
      });
    });
  }

  document.querySelectorAll('.plan-dhor-rollup-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const juzNum = parseInt(btn.dataset.juz, 10);
      const level = planDhorRollup[juzNum] || 'quarters';
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
// Real user input into the field (not the timer's own programmatic
// auto-fill above) means they're overriding it -- drop lap times since
// they'd no longer sum to the new total (mm:ss itself needs no special
// handling here, it's parsed fresh from whatever's in the field at save
// time either way -- see parseDhorDuration above).
document.getElementById('dhor_duration_minutes').addEventListener('input', () => {
  dhorLapTimes = null;
  updateDhorTimerSummary();
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
  document.getElementById('dhor_duration_minutes').value = formatDhorDuration(entry.duration_seconds);
  updateDhorTimerSummary();
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
  document.getElementById('dhor_duration_minutes').value = '';
  updateDhorTimerSummary();
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

// V3.21.1: shared by both save paths below. Uses the timer's exact
// seconds if the field hasn't been manually touched since it was set
// (see the 'input' listener above); otherwise parses the field's own
// text directly, since that's the user's actual intent at that point.
// V3.24.0: used by both save paths below. Simple direct parse now --
// mm:ss has no precision to lose, so there's no need to distinguish
// "the timer's own untouched value" from "whatever's in the field".
function computeDhorDuration(){
  const raw = document.getElementById('dhor_duration_minutes').value;
  return { duration_seconds: parseDhorDuration(raw), lap_times: dhorLapTimes };
}

document.getElementById('dhorSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('dhorError');
  errEl.textContent = '';

  if(dhorEditingId){
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
      cancelDhorEdit();
      resetDhorFormAfterEdit();
      await renderRecentEntries('dhor', apiDhor, 'dhorRecentRail');
    } catch(e){
      errEl.textContent = "Couldn't save: " + e.message;
    }
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
    segment_from = (first.juz - 1) * perJuz + (first.quarter - 1) * quarterSize + 1;
    segment_to = (last.juz - 1) * perJuz + last.quarter * quarterSize;
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
    document.getElementById('dhorSaveStatus').classList.add('show');
    setTimeout(() => document.getElementById('dhorSaveStatus').classList.remove('show'), 1800);
    if(dhorRawRange) exitDhorRawRangeMode();
    await renderRecentEntries('dhor', apiDhor, 'dhorRecentRail');
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
const HISTORY_BTN_LABEL = { sabaq: 'Sabaq History', sabaqDhor: 'Sabaq Dhor History', dhor: 'Dhor History' };
// V3.21.0: each row now gets an edit (pencil) icon. Editing loads the
// entry into that card's own form (loadXForEdit, defined per-card) rather
// than a separate edit form -- reuses all the existing validation/
// pickers as-is. isLatest (this row === rows[0], since rows is already
// sorted most-recent-first) is passed through so Sabaq's save handler
// knows whether it's safe to recompute position afterward -- see
// js/sabaqPage.js for why that matters.
async function renderRecentEntries(type, client, railId){
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
          <div>
            <div class="rail-card-date">${r.date}</div>
            <div class="rail-card-body">${describeEntryForRail(type, r)}</div>
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
    overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
    document.getElementById('historyPopupCloseBtn').addEventListener('click', () => overlay.remove());
  });
}
function describeEntryForRail(type, r){
  if(type === 'dhor') return `${describeDhorSegment(r.segment_from, r.segment_to, r.ref || dhorCurrentRef)} · ${r.mistakes||0} mistakes${r.duration_seconds?` · ${Math.round(r.duration_seconds/60)} min`:''}`;
  if(type === 'sabaq') return `${r.sabaq_from}-${r.sabaq_to}${r.line_count?` · ${r.line_count} lines`:''}${r.page_count?` · ${r.page_count} pages`:''}`;
  if(type === 'sabaqDhor') return `${r.from_surah}:${r.from_ayah}-${r.to_surah}:${r.to_ayah} · ${r.mistakes||0} mistakes`;
  return '';
}
