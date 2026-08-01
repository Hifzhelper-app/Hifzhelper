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
// V3.21.1: duration is a real editable field (#dhor_duration_minutes) now,
// not something only the timer can set. dhorTimerExactSeconds holds the
// timer's precise result for as long as the field hasn't been manually
// touched since -- used at save time instead of re-deriving seconds from
// the rounded 1-decimal display text, so the timer's own real precision
// isn't lost to display rounding. It's cleared (falls back to parsing
// the field directly) the moment the user actually types in the field.
// dhorLapTimes is genuinely timer-only data (no manual equivalent) and is
// cleared whenever the user overrides the duration, since laps that no
// longer sum to the new total would be actively misleading.
let dhorTimerExactSeconds = null;
let dhorLapTimes = null;
let dhorTodaysPlans = [];    // today's plan(s) for type 'dhor', fetched fresh on every open
let dhorActivePlanId = null; // which one (if any) is currently backing the form
// V3.21.0: segment_from/to came from a picker reflecting today's live
// options, not whatever was actually chosen on the day being edited --
// there's no way to reconstruct that. Editing here never touches segment.
// (V3.21.1: this used to also exclude duration/lap_times for the same
// reason, but duration is a real editable field now -- see
// dhorTimerExactSeconds above -- so those two are no longer excluded.)
let dhorEditingId = null;

function renderDhorPicker(){
  const perJuz = segmentsPerJuz(dhorCurrentRef);
  const posSel = document.getElementById('dhor_position');
  posSel.innerHTML = Array.from({length: perJuz}, (_,i) =>
    `<option value="${i+1}">${dhorCurrentRef === 'waterval' ? 'Quarter' : '1/8'} ${i+1}</option>`).join('');
}

// Fills the form from one plan row and remembers its id for save-time
// linking. Never called with null — clearing back to manual entry just
// means dhorActivePlanId stays null, which callers set directly.
function applyDhorPlan(plan){
  dhorActivePlanId = plan.id;
  if(plan.segment_from != null && plan.segment_to != null){
    const { juz, positionInJuz, unit } = segmentRangeToPicker(plan.segment_from, plan.segment_to, dhorCurrentRef);
    document.getElementById('dhor_juz').value = String(juz);
    document.getElementById('dhor_position').value = String(positionInJuz);
    document.getElementById('dhor_unit').value = unit;
  }
}

function renderDhorPlanBanner(){
  const el = document.getElementById('dhorPlanBanner');
  if(!el) return;
  if(dhorTodaysPlans.length === 0){ el.innerHTML = ''; return; }
  if(dhorTodaysPlans.length === 1){
    el.innerHTML = `<div class="form-hint">Pre-filled from today's plan.</div>`;
    return;
  }
  // More than one planned session for today — a plain selector, never
  // auto-picked (per the "never auto-selected" rule already agreed for
  // this feature). Reuses .tajweed-tag's pill look for consistency with
  // every other single-select control in the app.
  el.innerHTML = `<div class="form-hint">More than one plan for today — pick one, or leave unpicked to enter manually:</div>
    <div id="dhorPlanChoices">` +
    dhorTodaysPlans.map(p => `<button type="button" class="tajweed-tag" data-plan-id="${p.id}">Seg ${p.segment_from}-${p.segment_to}</button>`).join('') +
    `</div>`;
  el.querySelectorAll('[data-plan-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = dhorTodaysPlans.find(p => p.id === parseInt(btn.dataset.planId, 10));
      applyDhorPlan(plan);
      el.querySelectorAll('[data-plan-id]').forEach(b => b.classList.toggle('active', b === btn));
    });
  });
}

async function renderDhorScreen(){
  dhorEditingId = null;
  document.getElementById('dhorEditTopbar').classList.add('hidden');
  document.getElementById('dhorEditBottombar').classList.add('hidden');
  document.getElementById('dhorSegmentPicker').classList.remove('hidden');
  exitEditScreenMode('card-dhor');
  dhorSelectedTags = [];
  dhorTimerExactSeconds = null;
  dhorLapTimes = null;
  document.getElementById('dhor_duration_minutes').value = '';
  dhorActivePlanId = null;
  document.getElementById('dhor_date').value = todayISO();
  document.getElementById('dhor_juz').innerHTML = Array.from({length:30}, (_,i) => `<option value="${i+1}">Juz' ${i+1}</option>`).join('');

  try{
    const profile = await apiGetProfile();
    dhorCurrentRef = refForMushaf(profile.mushaf);
  } catch(e){
    dhorCurrentRef = 'waterval'; // sensible fallback if the profile fetch fails
  }
  renderDhorPicker();
  document.getElementById('dhor_unit').value = 'quarter';
  document.getElementById('dhor_mistakes').value = '0';
  renderTajweedPicker('dhorTajweedPicker', dhorSelectedTags);
  renderCommentBlock('dhorCommentBlock', null);
  renderTimer('dhorTimerWrap', (result) => {
    dhorTimerExactSeconds = result.duration_seconds;
    dhorLapTimes = result.lap_times || null;
    // Programmatic assignment -- deliberately doesn't fire 'input', so
    // this doesn't trip the manual-override handler below.
    document.getElementById('dhor_duration_minutes').value = (result.duration_seconds / 60).toFixed(1);
    updateDhorTimerSummary();
  });
  updateDhorTimerSummary();

  // Best-effort: top up the rolling schedule before asking for today's
  // plan, so a fresh day gets its row without the student needing to
  // open Setup first. Never blocks or errors the rest of the screen —
  // the manual picker is always the fallback if this fails (e.g. no
  // schedule configured yet).
  try{ await apiEnsureDhorSchedule(); } catch(e){ /* not configured yet, or offline — fine */ }

  try{
    const plans = await apiPlans.getForDate(todayISO());
    dhorTodaysPlans = (plans || []).filter(p => p.plan_type === 'dhor' && p.status === 'planned');
  } catch(e){
    dhorTodaysPlans = [];
  }
  renderDhorPlanBanner();
  if(dhorTodaysPlans.length === 1) applyDhorPlan(dhorTodaysPlans[0]);

  await renderRecentEntries('dhor', apiDhor, 'dhorRecentRail');
}

function updateDhorTimerSummary(){
  const el = document.getElementById('dhorTimerSummary');
  el.textContent = dhorLapTimes ? `${dhorLapTimes.length} laps recorded` : '';
}
// Real user input into the field (not the timer's own programmatic
// auto-fill above) means they're overriding it -- stop trusting the
// timer's exact-seconds value in favour of whatever they typed, and
// drop lap times since they'd no longer sum to the new total.
document.getElementById('dhor_duration_minutes').addEventListener('input', () => {
  dhorTimerExactSeconds = null;
  dhorLapTimes = null;
  updateDhorTimerSummary();
});

function loadDhorEntryForEdit(entry){
  dhorEditingId = entry.id;
  document.getElementById('dhor_mistakes').value = entry.mistakes || 0;
  dhorSelectedTags = (entry.tajweed_tags || '').split(',').filter(Boolean);
  renderTajweedPicker('dhorTajweedPicker', dhorSelectedTags);
  renderCommentBlock('dhorCommentBlock', entry);
  // V3.21.1: duration/lap times are no longer excluded from editing --
  // treat the stored value as "exact" (same as a fresh timer result)
  // until the user actually types in the field, same rule as new entries.
  dhorTimerExactSeconds = typeof entry.duration_seconds === 'number' ? entry.duration_seconds : null;
  dhorLapTimes = entry.lap_times || null;
  document.getElementById('dhor_duration_minutes').value =
    dhorTimerExactSeconds !== null ? (dhorTimerExactSeconds / 60).toFixed(1) : '';
  updateDhorTimerSummary();
  document.getElementById('dhorEditTopbarDate').textContent =
    `${entry.date} (Seg ${entry.segment_from}-${entry.segment_to} — not editable here)`;
  document.getElementById('dhorEditTopbar').classList.remove('hidden');
  document.getElementById('dhorEditBottombar').classList.remove('hidden');
  document.getElementById('dhorSegmentPicker').classList.add('hidden');
  enterEditScreenMode('card-dhor');
}
function cancelDhorEdit(){
  dhorEditingId = null;
  document.getElementById('dhorEditTopbar').classList.add('hidden');
  document.getElementById('dhorEditBottombar').classList.add('hidden');
  document.getElementById('dhorSegmentPicker').classList.remove('hidden');
  exitEditScreenMode('card-dhor');
}
function resetDhorFormAfterEdit(){
  document.getElementById('dhor_mistakes').value = 0;
  dhorSelectedTags = [];
  renderTajweedPicker('dhorTajweedPicker', dhorSelectedTags);
  renderCommentBlock('dhorCommentBlock', null);
  dhorTimerExactSeconds = null;
  dhorLapTimes = null;
  document.getElementById('dhor_duration_minutes').value = '';
  updateDhorTimerSummary();
}
document.getElementById('dhorEditCancelBtn').addEventListener('click', () => {
  cancelDhorEdit();
  resetDhorFormAfterEdit();
});
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
function computeDhorDuration(){
  const minutesVal = document.getElementById('dhor_duration_minutes').value;
  const duration_seconds = dhorTimerExactSeconds !== null
    ? dhorTimerExactSeconds
    : (minutesVal ? Math.round(parseFloat(minutesVal) * 60) : null);
  return { duration_seconds, lap_times: dhorLapTimes };
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
      document.getElementById('dhor_mistakes').value = 0;
      dhorSelectedTags = [];
      renderTajweedPicker('dhorTajweedPicker', dhorSelectedTags);
      renderCommentBlock('dhorCommentBlock', null);
      dhorTimerExactSeconds = null;
      dhorLapTimes = null;
      document.getElementById('dhor_duration_minutes').value = '';
      updateDhorTimerSummary();
      await renderRecentEntries('dhor', apiDhor, 'dhorRecentRail');
    } catch(e){
      errEl.textContent = "Couldn't save: " + e.message;
    }
    return;
  }

  const juz = parseInt(document.getElementById('dhor_juz').value);
  const position = parseInt(document.getElementById('dhor_position').value);
  const unit = document.getElementById('dhor_unit').value;
  const { segment_from, segment_to } = computeSegmentRange(juz, position, dhorCurrentRef, unit);

  const payload = {
    date: document.getElementById('dhor_date').value || todayISO(),
    segment_from, segment_to, ref: dhorCurrentRef,
    tajweed_tags: dhorSelectedTags.join(','),
    mistakes: parseInt(document.getElementById('dhor_mistakes').value) || 0,
    ...computeDhorDuration(),
    ...readCommentBlock('dhorCommentBlock')
  };
  if(dhorActivePlanId) payload.plan_id = dhorActivePlanId;

  try{
    await apiDhor.save(payload);
    document.getElementById('dhorSaveStatus').classList.add('show');
    setTimeout(() => document.getElementById('dhorSaveStatus').classList.remove('show'), 1800);
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
  if(type === 'dhor') return `Seg ${r.segment_from}-${r.segment_to} (${r.ref}) · ${r.mistakes||0} mistakes${r.duration_seconds?` · ${Math.round(r.duration_seconds/60)} min`:''}`;
  if(type === 'sabaq') return `${r.sabaq_from}-${r.sabaq_to}${r.line_count?` · ${r.line_count} lines`:''}${r.page_count?` · ${r.page_count} pages`:''}`;
  if(type === 'sabaqDhor') return `${r.from_surah}:${r.from_ayah}-${r.to_surah}:${r.to_ayah} · ${r.mistakes||0} mistakes`;
  return '';
}
