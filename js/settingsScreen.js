// ============================================================
// Hifzhelper — Setup screen (V3.9.0, switch redesign V3.10.0)
// REVISED from V3.7.x/V3.8.0's 2 independently-saved swipeable cards to
// ONE continuous page with 4 independently-saved sections: Profile,
// Hifz Setup, Dhor Schedule, Haidh (Haidh shown only when gender is F).
// V3.10.0: every plain either/or control (gender, mushaf, Juz'/Surah,
// Dhor Schedule's granularity/frequency) is now a genuine switch —
// see renderSwitch()/wireSwitch() below, and Hybrid mushaf is enabled.
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

// ---------- Generic switch helper (V3.10.0) ----------
// A switch-track's children are the thumb plus one "slot" per option, in
// DOM order — for a neutral-center switch (Juz'/Surah) one of those slots
// is a plain .switch-neutral-zone div rather than a real option, so the
// thumb has somewhere to rest when nothing's chosen yet. Positioning is
// just "which slot index is active" as a percentage of the track width;
// nothing here needs to special-case 2-way vs 3-way vs neutral-center.
function renderSwitch(trackId, activeValue){
  const track = document.getElementById(trackId);
  const slots = Array.from(track.children).filter(el => !el.classList.contains('switch-thumb'));
  const thumb = track.querySelector('.switch-thumb');
  const totalSlots = slots.length;
  let activeIndex = slots.findIndex(el => el.dataset && el.dataset.value === activeValue);
  const isNeutral = activeIndex === -1;
  if(isNeutral){
    activeIndex = Math.floor((totalSlots - 1) / 2); // rest in the middle slot
    thumb.classList.add('neutral');
  } else {
    thumb.classList.remove('neutral');
  }
  const pct = 100 / totalSlots;
  thumb.style.left = `calc(${pct * activeIndex}% + 2px)`;
  thumb.style.width = `calc(${pct}% - 4px)`;
  slots.forEach(el => { if(el.classList.contains('switch-option')) el.classList.toggle('active', el.dataset.value === activeValue); });
}
function wireSwitch(trackId, onSelect){
  document.querySelectorAll(`#${trackId} .switch-option`).forEach(btn => {
    btn.addEventListener('click', () => onSelect(btn.dataset.value));
  });
}

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

// ---------- Hifz Setup: mushaf switch (V3.10.0: Hybrid enabled) ----------
const MUSHAF_HINTS = {
  '13line': '',
  '15line_madani': '',
  hybrid: '15 line pages with 13 line quarter markings.'
};
let setupSelectedMushaf = null;
wireSwitch('mushaf_switch', (value) => {
  setupSelectedMushaf = value;
  renderSwitch('mushaf_switch', setupSelectedMushaf);
  document.getElementById('mushafHint').textContent = MUSHAF_HINTS[value] || '';
});

// ---------- Hifz Setup: completed-sections slide-in grids (V3.9.0) ----------
// Neutral-center switch (V3.10.0): tapping either side always opens its
// popout grid, regardless of the thumb's current resting position — the
// thumb only reflects baselineMode itself (which grid was actually last
// confirmed), resting in the middle if nothing's been marked yet, since
// tapping here opens a tool rather than flipping a persistent state.
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
    renderSwitch('section_grid_switch', baselineMode);
    overlay.remove();
  };
  overlay.addEventListener('click', e => { if(e.target === overlay) commitAndClose(); });
  document.getElementById('sectionGridCloseBtn').addEventListener('click', commitAndClose);
}
document.getElementById('openJuzGridBtn').addEventListener('click', () => openSectionGridModal('juz'));
document.getElementById('openSurahGridBtn').addEventListener('click', () => openSectionGridModal('surah'));

// ---------- Dhor Schedule (new, V3.9.0; switches V3.10.0) ----------
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
  baselineMode = profile.baseline_mode || null;
  baselineSelection = Array.isArray(profile.baseline_selection) ? profile.baseline_selection.slice() : [];
  renderBaselineSummary();
  renderSwitch('section_grid_switch', baselineMode);
  document.getElementById('target_mistakes').value = profile.target_mistakes_per_juz != null ? profile.target_mistakes_per_juz : 2;
  document.getElementById('target_minutes').value = profile.target_minutes_per_juz != null ? profile.target_minutes_per_juz : 40;
  document.getElementById('target_frequency').value = profile.target_frequency_days != null ? profile.target_frequency_days : 30;

  // Dhor Schedule section
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

// Dhor Schedule (new, V3.9.0) — saves the settings, then immediately
// kicks off generation (rather than waiting for the next time dhorPage.js
// happens to open) so the rolling window is populated right away.
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
    await apiEnsureDhorSchedule();
    document.getElementById('dhorScheduleSaveStatus').classList.add('show');
    setTimeout(() => document.getElementById('dhorScheduleSaveStatus').classList.remove('show'), 1800);
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
});

// Haidh (new, V3.9.0) — saves the settings, then triggers the existing
// prediction endpoint. The student enters the more intuitive "next
// expected day"; lastStart (what /attendance/predict actually takes) is
// computed from it here, so that endpoint needed no changes at all.
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
