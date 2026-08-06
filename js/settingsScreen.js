// ============================================================
// Hifzhelper — Setup screen (V3.9.0, switch redesign V3.10.0, V2 refinements V3.11.0)
// REVISED from V3.7.x/V3.8.0's 2 independently-saved swipeable cards to
// ONE continuous page with 4 independently-saved sections: Profile,
// Hifz Setup, Dhor Plan (renamed from "Dhor Schedule" in V3.11.0), Haidh.
// V3.10.0 turned every plain either/or into a genuine switch; V3.11.0
// adds explanatory hints for all 3 mushaf options and corrects the
// Juz'/Surah switch to always rest neutral (not slide to reflect the
// mode). V3.11.0 also added Tomorrow's Portion, an explicit starting
// point for the Dhor Plan rotation -- removed entirely 2026-08-03 (see
// the Dhor Plan save handler below for why).
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
// 2026-08-06, confirmed in chat: extended for the new IndoPak+terminology
// case, matching the same function's 3 other copies (js/dhorPage.js,
// js/sabaqDhorPage.js, js/sabaqPage.js).
function refForMushaf(mushaf, indopakTerminology){
  if(mushaf === '15line_madani') return 'uthmani';
  if(mushaf === '15line_indopak' && indopakTerminology === 'maqra_rub_hizb') return 'uthmani';
  return 'waterval';
}

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
// V3.36, confirmed in chat: Hybrid removed entirely -- traced and
// confirmed it never actually behaved differently from 13line. Replaced
// with 15line_indopak, using its own verified page/line dataset.
const MUSHAF_HINTS = {
  '13line': '13-line IndoPak/Waterval.',
  '15line_madani': '15 Line Uthmani script.',
  '15line_indopak': '15 line IndoPak script.'
};
// 2026-08-06, confirmed in chat: only meaningful when 15line_indopak is
// selected -- which Dhor/Sabaq Dhor terminology to use, since IndoPak's
// own Rub'/Hizb boundary data hasn't been sourced yet and the app already
// has both of these ready to use. Confirmed selectable now, ahead of
// V3.37 actually building the real Maqra/Rub'/Hizb display system this
// second option points at -- so its terminology stays incomplete
// (V3.37's own Q/H-style labels, not yet the real thing) until that lands.
let setupSelectedIndopakTerminology = null;
wireSwitch('indopak_terminology_switch', (value) => {
  setupSelectedIndopakTerminology = value;
  renderSwitch('indopak_terminology_switch', setupSelectedIndopakTerminology);
});
function updateIndopakTerminologyVisibility(){
  document.getElementById('indopakTerminologyRow').classList.toggle('hidden', setupSelectedMushaf !== '15line_indopak');
}
let setupSelectedMushaf = null;
wireSwitch('mushaf_switch', (value) => {
  setupSelectedMushaf = value;
  renderSwitch('mushaf_switch', setupSelectedMushaf);
  document.getElementById('mushafHint').textContent = MUSHAF_HINTS[value] || '';
  updateIndopakTerminologyVisibility();
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
  if(baselineMode === 'juz'){
    // V3.15.0: baselineSelection now holds quarter-unit IDs — count whole
    // juz' as however many have all 4 of their quarter-units present.
    const juzCount = Array.from({length: 30}, (_, i) => i + 1)
      .filter(juz => quarterUnitsForJuz(juz).every(u => baselineSelection.includes(u))).length;
    el.textContent = `${juzCount} juz' marked complete.`;
    return;
  }
  el.textContent = `${baselineSelection.length} surah(s) marked complete.`;
}

function openSectionGridModal(mode){
  // V3.15.0: baseline_selection stores quarter-unit IDs now (1-120), not
  // whole juz' numbers — but the Juz' grid still shows/toggles WHOLE juz'
  // for a natural picker. A juz' displays as "marked" only if all 4 of its
  // quarter-units are already in the stored pool; committing expands each
  // marked juz' back out to its 4 quarter-unit IDs. Surah mode is
  // unchanged for now (still stores surah numbers directly) — its own
  // integration with this same quarter pool is a separate, later phase.
  const draft = baselineMode === mode
    ? (mode === 'juz'
        ? Array.from({length: 30}, (_, i) => i + 1).filter(juz => quarterUnitsForJuz(juz).every(u => baselineSelection.includes(u)))
        : baselineSelection.slice())
    : [];
  const items = mode === 'juz'
    ? Array.from({length: 30}, (_, i) => [i + 1, `Juz ${i + 1}`])
    : SURAHS.map(([num, name]) => [num, `${num}. ${name}`]);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay section-grid-modal';
  overlay.innerHTML = `<div class="modal-card">
    <button type="button" class="close-btn" id="sectionGridCloseBtn">&times;</button>
    <h2>${mode === 'juz' ? "Mark completed Juz" : 'Mark completed Surahs'}</h2>
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
    baselineSelection = mode === 'juz'
      ? draft.flatMap(juz => quarterUnitsForJuz(juz))
      : draft;
    renderBaselineSummary();
    renderSwitch('section_grid_switch', null); // V3.11.0: always back to neutral, never reflects baselineMode
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
  setupSelectedIndopakTerminology = profile.indopak_terminology || 'quarter_half';
  renderSwitch('indopak_terminology_switch', setupSelectedIndopakTerminology);
  updateIndopakTerminologyVisibility();
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
  if(setupSelectedMushaf === '15line_indopak') payload.indopak_terminology = setupSelectedIndopakTerminology;
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

// Dhor Plan — just saves the settings now. Used to also kick off
// ensureDhorSchedule's generation immediately after (optionally anchored
// to a Tomorrow's Portion pick) -- both removed 2026-08-03 (confirmed in
// chat): Tomorrow's Portion served no purpose once a student could
// already redirect the queue by saving a different portion via Plan
// Dhor, and removing it was ensureDhorSchedule's last remaining caller
// anywhere in the app, so that whole mechanism (worker/src/
// dhorSchedule.js, js/api.js's apiEnsureDhorSchedule) is gone too.
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
  try{
    await apiSaveProfile(payload);
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
