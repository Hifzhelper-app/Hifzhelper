// ============================================================
// Hifzhelper — Setup screen (V3.9.0, switch redesign V3.10.0, V2 refinements V3.11.0)
// REVISED from V3.7.x/V3.8.0's 2 independently-saved swipeable cards to
// ONE continuous page with 4 independently-saved sections: Profile,
// Hifz Setup, Dhor Plan (renamed from "Dhor Schedule" in V3.11.0), Haidh.
// V3.10.0 turned every plain either/or into a genuine switch; V3.11.0
// adds explanatory hints for all 3 mushaf options, corrects the
// Juz'/Surah switch to always rest neutral (not slide to reflect the
// mode), and adds Tomorrow's Portion — an explicit starting point for
// the Dhor Plan rotation, picked from the student's own memorised juz'.
//
// Reached two ways: the "Settings" nav item (any time), and automatically
// on a new user's first login before setup_complete (see app.js) — the
// same screen either way, just a different entry point.
// ============================================================

document.getElementById('profileSaveBtn').innerHTML = iconHtml('save');
document.getElementById('hifzSetupSaveBtn').innerHTML = iconHtml('save');
document.getElementById('dhorScheduleSaveBtn').innerHTML = iconHtml('save');
document.getElementById('haidhSaveBtn').innerHTML = iconHtml('save');

function addDaysISO(iso, n){
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function refForMushaf(mushaf){ return mushaf === '15line_madani' ? 'uthmani' : 'waterval'; }

// renderSwitch()/wireSwitch() moved to js/uiSwitch.js (V3.12.0) — now
// shared with commentPrivacy.js's private/public switch, loads earlier
// so every screen that needs it can rely on it.


// ---------- Profile: gender switch ----------
let setupSelectedGender = null;
wireSwitch('gender_switch', (value) => {
  setupSelectedGender = value;
  renderSwitch('gender_switch', setupSelectedGender);
  updateHaidhVisibility();
});
function updateHaidhVisibility(){
  document.getElementById('section-haidh').classList.toggle('hidden', setupSelectedGender !== 'F');
}

// ---------- Hifz Setup: mushaf switch ----------
// V3.11.0: every option now has an explanatory hint (Hybrid already had
// one; 13-line/15-line didn't).
const MUSHAF_HINTS = {
  '13line': '13-line IndoPak/Waterval.',
  '15line_madani': '15 Line Uthmani script.',
  hybrid: '15 line pages with 13 line quarter markings.'
};
let setupSelectedMushaf = null;
wireSwitch('mushaf_switch', (value) => {
  setupSelectedMushaf = value;
  renderSwitch('mushaf_switch', setupSelectedMushaf);
  document.getElementById('mushafHint').textContent = MUSHAF_HINTS[value] || '';
  renderTomorrowPortionOptions();
});

// ---------- Hifz Setup: completed-sections slide-in grids ----------
// V3.11.0 correction: the neutral center is the PERMANENT resting state,
// not just a pre-selection placeholder — the switch always springs back
// to neutral once a popup closes, regardless of what was picked inside.
// (V3.10.0 had it slide to reflect baselineMode instead; that's what's
// being corrected here.) Tapping either side still always opens its
// popout no matter where the thumb currently sits.
let baselineMode = null;
let baselineSelection = [];

function renderBaselineSummary(){
  const el = document.getElementById('baselineSummary');
  if(!baselineMode || !baselineSelection.length){ el.textContent = 'Nothing marked yet.'; return; }
  el.textContent = baselineMode === 'juz'
    ? `${baselineSelection.length} juz' marked complete.`
    : `${baselineSelection.length} surah(s) marked complete.`;
}

function openSectionGridModal(mode){
  const draft = baselineMode === mode ? baselineSelection.slice() : [];
  const items = mode === 'juz'
    ? Array.from({length: 30}, (_, i) => [i + 1, `Juz' ${i + 1}`])
    : SURAHS.map(([num, name]) => [num, `${num}. ${name}`]);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay section-grid-modal';
  overlay.innerHTML = `<div class="modal-card">
    <button type="button" class="close-btn" id="sectionGridCloseBtn">&times;</button>
    <h2>${mode === 'juz' ? "Mark completed Juz'" : 'Mark completed Surahs'}</h2>
    <div class="section-grid ${mode === 'juz' ? 'grid-juz' : 'grid-surah'}" id="sectionGridCells"></div>
  </div>`;
  document.body.appendChild(overlay);

  const cellsEl = document.getElementById('sectionGridCells');
  cellsEl.innerHTML = items.map(([num, label]) =>
    `<button type="button" class="tajweed-tag${draft.includes(num) ? ' active' : ''}" data-item="${num}">${label}</button>`
  ).join('');
  cellsEl.querySelectorAll('[data-item]').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = parseInt(btn.dataset.item, 10);
      const idx = draft.indexOf(n);
      if(idx >= 0) draft.splice(idx, 1); else draft.push(n);
      btn.classList.toggle('active');
    });
  });

  const commitAndClose = () => {
    baselineMode = mode;
    baselineSelection = draft;
    renderBaselineSummary();
    renderSwitch('section_grid_switch', null); // V3.11.0: always back to neutral, never reflects baselineMode
    renderTomorrowPortionOptions();
    overlay.remove();
  };
  overlay.addEventListener('click', e => { if(e.target === overlay) commitAndClose(); });
  document.getElementById('sectionGridCloseBtn').addEventListener('click', commitAndClose);
}
document.getElementById('openJuzGridBtn').addEventListener('click', () => openSectionGridModal('juz'));
document.getElementById('openSurahGridBtn').addEventListener('click', () => openSectionGridModal('surah'));

// ---------- Dhor Plan (renamed from "Dhor Schedule" in V3.11.0) ----------
let setupSelectedGranularity = null;
let setupSelectedFrequency = null;
let setupSelectedDays = [];

wireSwitch('dhor_granularity_switch', (value) => {
  setupSelectedGranularity = value;
  renderSwitch('dhor_granularity_switch', setupSelectedGranularity);
  renderTomorrowPortionOptions();
});
wireSwitch('dhor_frequency_switch', (value) => {
  setupSelectedFrequency = value;
  renderSwitch('dhor_frequency_switch', setupSelectedFrequency);
});

function renderDaysPicker(){
  document.querySelectorAll('#dhor_days_picker [data-day]').forEach(btn => {
    btn.classList.toggle('active', setupSelectedDays.includes(btn.dataset.day));
  });
}
document.querySelectorAll('#dhor_days_picker [data-day]').forEach(btn => {
  btn.addEventListener('click', () => {
    const day = btn.dataset.day;
    const idx = setupSelectedDays.indexOf(day);
    if(idx >= 0) setupSelectedDays.splice(idx, 1); else setupSelectedDays.push(day);
    renderDaysPicker();
  });
});

// ---------- Tomorrow's Portion (new, V3.11.0) ----------
// Labels one (juz, unitIndexInJuz) position in the naming convention
// confirmed for each print. 13-line and Hybrid share one convention
// (Hybrid always uses 13-line quarter/half/juz' rules); 15-line's is
// different — and per clarification, Hizb is numbered globally across
// the whole Quran (a global count is already unambiguous, unlike a
// 13-line "half" which has no name of its own to fall back on), while
// Rub' stays per-juz'.
function segmentLabel(juz, unitIndexInJuz, ref, granularity){
  if(ref === 'uthmani'){
    if(granularity === 'juz') return `Juz-${juz}`;
    if(granularity === 'half') return `Hizb-${(juz - 1) * 2 + unitIndexInJuz}`;
    return `Rub-${juz}-${unitIndexInJuz}`; // granularity === 'quarter'
  }
  if(granularity === 'juz') return `Juz-${juz}`;
  if(granularity === 'half') return `H-Juz-${juz}-${unitIndexInJuz}`;
  return `Q-Juz-${juz}-${unitIndexInJuz}`; // granularity === 'quarter'
}

// Every individual granularity-sized unit across the student's memorised
// (baseline) juz', ascending — mirrors dhorSchedule.js's own
// buildChunks() at the single-unit level (quantity=1), so the resulting
// segment_from/segment_to values line up exactly with what the generator
// itself produces.
function buildSegmentOptions(pool, ref, granularity){
  const perJuz = segmentsPerJuz(ref);
  const unitSize = unitMarkerCount(ref, granularity);
  const unitsPerJuz = perJuz / unitSize;
  const options = [];
  for(const juz of pool.slice().sort((a,b) => a-b)){
    for(let u = 1; u <= unitsPerJuz; u++){
      const { segment_from, segment_to } = segmentRangeForUnitIndex(juz, u, ref, granularity);
      options.push({ segment_from, segment_to, label: segmentLabel(juz, u, ref, granularity) });
    }
  }
  return options;
}

function renderTomorrowPortionOptions(){
  const sel = document.getElementById('dhor_tomorrow_portion');
  if(!sel) return;
  const previousValue = sel.value;
  const granularity = setupSelectedGranularity;
  if(!granularity || !baselineSelection.length){
    sel.innerHTML = `<option value="">Let the plan continue from where it left off</option>`;
    return;
  }
  const ref = refForMushaf(setupSelectedMushaf);
  const options = buildSegmentOptions(baselineSelection, ref, granularity);
  sel.innerHTML = `<option value="">Let the plan continue from where it left off</option>` +
    options.map(o => `<option value="${o.segment_from}-${o.segment_to}">${o.label}</option>`).join('');
  if(Array.from(sel.options).some(o => o.value === previousValue)) sel.value = previousValue;
}

// ---------- Load + render ----------
async function renderSettingsScreen(){
  document.getElementById('profileError').textContent = '';
  document.getElementById('hifzSetupError').textContent = '';
  document.getElementById('dhorScheduleError').textContent = '';
  document.getElementById('haidhError').textContent = '';
  const profile = await apiGetProfile();

  // Profile section
  document.getElementById('setup_name_display').textContent = profile.name || '';
  document.getElementById('setup_id_display').textContent = profile.id || '';
  document.getElementById('setup_url_display').value = window.location.origin + '/' + profile.id;
  document.getElementById('setup_journal_name').value = profile.journal_name || '';
  setupSelectedGender = profile.gender || null;
  renderSwitch('gender_switch', setupSelectedGender);
  updateHaidhVisibility();

  // Hifz Setup section
  setupSelectedMushaf = profile.mushaf || null;
  renderSwitch('mushaf_switch', setupSelectedMushaf);
  document.getElementById('mushafHint').textContent = MUSHAF_HINTS[setupSelectedMushaf] || '';
  baselineMode = profile.baseline_mode || null;
  baselineSelection = Array.isArray(profile.baseline_selection) ? profile.baseline_selection.slice() : [];
  renderBaselineSummary();
  renderSwitch('section_grid_switch', null); // V3.11.0: always neutral on load too
  document.getElementById('target_mistakes').value = profile.target_mistakes_per_juz != null ? profile.target_mistakes_per_juz : 2;
  document.getElementById('target_minutes').value = profile.target_minutes_per_juz != null ? profile.target_minutes_per_juz : 40;
  document.getElementById('target_frequency').value = profile.target_frequency_days != null ? profile.target_frequency_days : 30;

  // Dhor Plan section
  setupSelectedGranularity = profile.dhor_granularity || null;
  renderSwitch('dhor_granularity_switch', setupSelectedGranularity);
  document.getElementById('dhor_quantity').value = profile.dhor_quantity != null ? profile.dhor_quantity : 1;
  setupSelectedFrequency = profile.dhor_frequency || null;
  renderSwitch('dhor_frequency_switch', setupSelectedFrequency);
  setupSelectedDays = Array.isArray(profile.dhor_days_of_week) ? profile.dhor_days_of_week.slice() : [];
  renderDaysPicker();
  renderTomorrowPortionOptions();

  // Haidh section
  document.getElementById('haidh_cycle_length').value = profile.haidh_cycle_length || '';
  document.getElementById('haidh_period_length').value = profile.haidh_period_length || '';
  document.getElementById('haidh_next_expected').value = profile.haidh_next_expected || '';
}

wireCopyButton('setupCopyUrlBtn', 'setup_url_display');

// ---------- Save handlers — one per section, genuinely separate actions ----------

// Profile — saves journal_name + gender only.
document.getElementById('profileSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('profileError');
  errEl.textContent = '';
  const payload = {
    journal_name: document.getElementById('setup_journal_name').value || null,
    gender: setupSelectedGender,
    setup_complete: true
  };
  try{
    await apiSaveProfile(payload);
    document.getElementById('profileSaveStatus').classList.add('show');
    setTimeout(() => document.getElementById('profileSaveStatus').classList.remove('show'), 1800);
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
});

// Hifz Setup — saves mushaf + history baseline + default targets.
document.getElementById('hifzSetupSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('hifzSetupError');
  errEl.textContent = '';
  const payload = { setup_complete: true };
  if(setupSelectedMushaf) payload.mushaf = setupSelectedMushaf;
  if(baselineMode){
    payload.baseline_mode = baselineMode;
    payload.baseline_selection = baselineSelection;
  }
  const mistakes = parseInt(document.getElementById('target_mistakes').value, 10);
  const minutes = parseInt(document.getElementById('target_minutes').value, 10);
  const frequency = parseInt(document.getElementById('target_frequency').value, 10);
  if(!isNaN(mistakes)) payload.target_mistakes_per_juz = mistakes;
  if(!isNaN(minutes)) payload.target_minutes_per_juz = minutes;
  if(!isNaN(frequency)) payload.target_frequency_days = frequency;

  try{
    await apiSaveProfile(payload);
    document.getElementById('hifzSetupSaveStatus').classList.add('show');
    setTimeout(() => document.getElementById('hifzSetupSaveStatus').classList.remove('show'), 1800);
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
});

// Dhor Plan — saves the settings, then immediately kicks off generation
// (rather than waiting for the next time dhorPage.js happens to open) so
// the rolling window is populated right away. If the student picked a
// Tomorrow's Portion starting point, that's passed through as an
// explicit anchor for this one generation call only.
document.getElementById('dhorScheduleSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('dhorScheduleError');
  errEl.textContent = '';
  if(!setupSelectedGranularity || !setupSelectedFrequency || setupSelectedDays.length === 0){
    errEl.textContent = 'Please choose a portion size, frequency, and at least one day of the week.';
    return;
  }
  const quantity = parseInt(document.getElementById('dhor_quantity').value, 10);
  if(!quantity || quantity < 1){
    errEl.textContent = 'Portion quantity must be at least 1.';
    return;
  }
  const payload = {
    dhor_granularity: setupSelectedGranularity,
    dhor_quantity: quantity,
    dhor_frequency: setupSelectedFrequency,
    dhor_days_of_week: setupSelectedDays,
    setup_complete: true
  };
  const portionValue = document.getElementById('dhor_tomorrow_portion').value;
  let startSegment = null;
  if(portionValue){
    const [segment_from, segment_to] = portionValue.split('-').map(Number);
    startSegment = { segment_from, segment_to };
  }
  try{
    await apiSaveProfile(payload);
    await apiEnsureDhorSchedule(startSegment);
    document.getElementById('dhorScheduleSaveStatus').classList.add('show');
    setTimeout(() => document.getElementById('dhorScheduleSaveStatus').classList.remove('show'), 1800);
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
});

// Haidh — saves the settings, then triggers the existing prediction
// endpoint. The student enters the more intuitive "next expected day";
// lastStart (what /attendance/predict actually takes) is computed from
// it here, so that endpoint needed no changes at all.
document.getElementById('haidhSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('haidhError');
  errEl.textContent = '';
  const cycleLength = parseInt(document.getElementById('haidh_cycle_length').value, 10);
  const periodLength = parseInt(document.getElementById('haidh_period_length').value, 10);
  const nextExpected = document.getElementById('haidh_next_expected').value;
  if(!cycleLength || !periodLength || !nextExpected){
    errEl.textContent = 'Please fill in cycle length, duration, and next expected day.';
    return;
  }
  try{
    await apiSaveProfile({
      haidh_cycle_length: cycleLength,
      haidh_period_length: periodLength,
      haidh_next_expected: nextExpected,
      setup_complete: true
    });
    const lastStart = addDaysISO(nextExpected, -cycleLength);
    await apiPredictHaidh(cycleLength, periodLength, lastStart);
    document.getElementById('haidhSaveStatus').classList.add('show');
    setTimeout(() => document.getElementById('haidhSaveStatus').classList.remove('show'), 1800);
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
});
