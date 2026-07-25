// ============================================================
// Hifzhelper — Dhor detail page
// Segment picker (quarter/half/full-juz', in whichever reference is
// active), the real timer/lap feature, tajweed tags, mistakes, comment.
//
// SCOPE NOTE: the full three-model selector (13-line/Madina/Hybrid) isn't
// built yet — this page uses a simple local device-setting for which
// reference (waterval/uthmani) to work in, same two options, just without
// the richer page/line display the full model system will add later.
//
// Plan-as-default (pre-filling from a planned Dhor session) is NOT yet
// wired into this page — it's still a clear next step, not done here.
// ============================================================

const DHOR_REF_KEY = 'hh_dhor_ref';
function getDhorRef(){ return localStorage.getItem(DHOR_REF_KEY) || 'waterval'; }
function setDhorRef(ref){ localStorage.setItem(DHOR_REF_KEY, ref); }

function segmentsPerJuz(ref){ return ref === 'uthmani' ? 8 : 4; }
function unitMarkerCount(ref, unit){
  const perJuz = segmentsPerJuz(ref);
  if(unit === 'quarter') return perJuz / 4;
  if(unit === 'half') return perJuz / 2;
  return perJuz; // 'full'
}
function computeSegmentRange(juz, positionInJuz, ref, unit){
  const perJuz = segmentsPerJuz(ref);
  const startMarker = (juz - 1) * perJuz + positionInJuz;
  const count = unitMarkerCount(ref, unit);
  return { segment_from: startMarker, segment_to: startMarker + count - 1 };
}

let dhorSelectedTags = [];
let dhorTimerResult = null; // { duration_seconds, lap_times }

function renderDhorPicker(){
  const ref = getDhorRef();
  const perJuz = segmentsPerJuz(ref);
  document.getElementById('dhor_ref').value = ref;
  const posSel = document.getElementById('dhor_position');
  posSel.innerHTML = Array.from({length: perJuz}, (_,i) =>
    `<option value="${i+1}">${ref === 'waterval' ? 'Quarter' : '1/8'} ${i+1}</option>`).join('');
}

async function renderDhorScreen(){
  dhorSelectedTags = [];
  dhorTimerResult = null;
  document.getElementById('dhor_juz').innerHTML = Array.from({length:30}, (_,i) => `<option value="${i+1}">Juz' ${i+1}</option>`).join('');
  renderDhorPicker();
  document.getElementById('dhor_unit').value = 'quarter';
  document.getElementById('dhor_mistakes').value = '0';
  renderTajweedPicker('dhorTajweedPicker', dhorSelectedTags);
  renderCommentBlock('dhorCommentBlock', null);
  renderTimer('dhorTimerWrap', (result) => { dhorTimerResult = result; updateDhorTimerSummary(); });
  updateDhorTimerSummary();

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

document.getElementById('dhor_ref').addEventListener('change', (e) => {
  setDhorRef(e.target.value);
  renderDhorPicker();
});

document.getElementById('dhorSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('dhorError');
  errEl.textContent = '';
  const juz = parseInt(document.getElementById('dhor_juz').value);
  const position = parseInt(document.getElementById('dhor_position').value);
  const unit = document.getElementById('dhor_unit').value;
  const ref = getDhorRef();
  const { segment_from, segment_to } = computeSegmentRange(juz, position, ref, unit);

  const payload = {
    date: todayISO(),
    segment_from, segment_to, ref,
    tajweed_tags: dhorSelectedTags.join(','),
    mistakes: parseInt(document.getElementById('dhor_mistakes').value) || 0,
    ...(dhorTimerResult || {}),
    ...readCommentBlock()
  };

  try{
    await apiDhor.save(payload);
    document.getElementById('dhorSaveStatus').classList.add('show');
    setTimeout(() => document.getElementById('dhorSaveStatus').classList.remove('show'), 1800);
    await renderRecentEntries('dhor', apiDhor, 'dhorRecentRail');
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
});

// Shared across the three detail pages — a swipe rail of recent entries
// for that log type, tapped to view (read-only for now; editing an
// existing entry from here is a follow-up, not built in this pass).
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
  if(type === 'sabaq') return `${surahName(r.surah)} ${r.ayah_from||''}-${r.ayah_to||''}`;
  if(type === 'sabaqDhor') return `${r.zone||'—'} · ${r.mistakes||0} mistakes`;
  return '';
}
