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
let dhorTimerResult = null; // { duration_seconds, lap_times }
let dhorTodaysPlans = [];    // today's plan(s) for type 'dhor', fetched fresh on every open
let dhorActivePlanId = null; // which one (if any) is currently backing the form

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
  dhorSelectedTags = [];
  dhorTimerResult = null;
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
  renderTimer('dhorTimerWrap', (result) => { dhorTimerResult = result; updateDhorTimerSummary(); });
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
  if(!dhorTimerResult){ el.textContent = ''; return; }
  const mins = Math.floor(dhorTimerResult.duration_seconds/60);
  const secs = dhorTimerResult.duration_seconds%60;
  let text = `Recorded: ${mins}:${String(secs).padStart(2,'0')}`;
  if(dhorTimerResult.lap_times) text += ` across ${dhorTimerResult.lap_times.length} laps`;
  el.textContent = text;
}

document.getElementById('dhorSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('dhorError');
  errEl.textContent = '';
  const juz = parseInt(document.getElementById('dhor_juz').value);
  const position = parseInt(document.getElementById('dhor_position').value);
  const unit = document.getElementById('dhor_unit').value;
  const { segment_from, segment_to } = computeSegmentRange(juz, position, dhorCurrentRef, unit);

  const payload = {
    date: document.getElementById('dhor_date').value || todayISO(),
    segment_from, segment_to, ref: dhorCurrentRef,
    tajweed_tags: dhorSelectedTags.join(','),
    mistakes: parseInt(document.getElementById('dhor_mistakes').value) || 0,
    ...(dhorTimerResult || {}),
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
async function renderRecentEntries(type, client, railId){
  const rail = document.getElementById(railId);
  try{
    const rows = await client.get(isoDateNDaysAgo(14));
    rail.innerHTML = rows.slice(0, 10).map(r => `<div class="rail-card">
      <div class="rail-card-date">${r.date}</div>
      <div class="rail-card-body">${describeEntryForRail(type, r)}</div>
    </div>`).join('') || '<div class="form-hint">Nothing logged yet in the last two weeks.</div>';
  } catch(e){
    rail.innerHTML = `<div class="form-hint">Couldn't load recent entries.</div>`;
  }
}
function describeEntryForRail(type, r){
  if(type === 'dhor') return `Seg ${r.segment_from}-${r.segment_to} (${r.ref}) · ${r.mistakes||0} mistakes${r.duration_seconds?` · ${Math.round(r.duration_seconds/60)} min`:''}`;
  if(type === 'sabaq') return `${r.surah}:${r.ayah_from||''}-${r.ayah_to||''}${r.line_count?` · ${r.line_count} lines`:''}${r.page_count?` · ${r.page_count} pages`:''}`;
  if(type === 'sabaqDhor') return `${r.from_surah}:${r.from_ayah}-${r.to_surah}:${r.to_ayah} · ${r.mistakes||0} mistakes`;
  return '';
}
