// ============================================================
// Hifzhelper — Setup screen (V3.9.0)
// REVISED from V3.7.x/V3.8.0's 2 independently-saved swipeable cards to
// ONE continuous page with 4 independently-saved sections: Profile,
// Hifz Setup, Dhor Schedule, and Haidh (Haidh shown only when gender is
// F — toggled live off the gender picker, not just on reload). Dhor
// Schedule and Haidh are new in V3.9.0 and live here permanently
// (confirmed in chat: no separate nav destinations for either).
//
// Reached two ways: the "Settings" nav item (any time), and automatically
// on a new user's first login before setup_complete (see bootApp() in
// app.js) — the same screen either way, just a different entry point.
// ============================================================

document.getElementById('profileSaveBtn').innerHTML = iconHtml('save');
document.getElementById('hifzSetupSaveBtn').innerHTML = iconHtml('save');
document.getElementById('dhorScheduleSaveBtn').innerHTML = iconHtml('save');
document.getElementById('haidhSaveBtn').innerHTML = iconHtml('save');

function addDaysISO(iso, n){
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// ---------- Profile: gender picker ----------
let setupSelectedGender = null;
function renderGenderPicker(){
  document.querySelectorAll('#gender_picker [data-gender]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.gender === setupSelectedGender);
  });
}
document.querySelectorAll('#gender_picker [data-gender]').forEach(btn => {
  btn.addEventListener('click', () => {
    setupSelectedGender = btn.dataset.gender;
    renderGenderPicker();
    updateHaidhVisibility();
  });
});
function updateHaidhVisibility(){
  document.getElementById('section-haidh').classList.toggle('hidden', setupSelectedGender !== 'F');
}

// ---------- Hifz Setup: mushaf picker (unchanged from V3.8.0) ----------
let setupSelectedMushaf = null;
function renderMushafPicker(){
  document.querySelectorAll('#setup_mushaf_picker [data-mushaf]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mushaf === setupSelectedMushaf);
  });
}
document.querySelectorAll('#setup_mushaf_picker [data-mushaf]:not(:disabled)').forEach(btn => {
  btn.addEventListener('click', () => {
    setupSelectedMushaf = btn.dataset.mushaf;
    renderMushafPicker();
  });
});

// ---------- Hifz Setup: completed-sections slide-in grids (V3.9.0) ----------
// Replaces the old inline Surahs/Juz' mode-toggle + inline grid with two
// buttons that each open a full overlay instead — built dynamically the
// same way journal.js's quick-add modal is, rather than static hidden
// HTML, since the 114-item Surah grid is much easier to generate from
// SURAHS (shared/data.js) than to hand-write. Still mutually exclusive:
// confirming a selection in one clears the other, same rule as before.
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
  // Draft seeded from the current baseline ONLY if it's already in this
  // mode — opening the other grid starts empty, since only one mode is
  // ever the active one.
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

  // The overlay's close icon IS "save and close" for the grid itself —
  // it commits the draft into the pending baselineMode/baselineSelection
  // module variables. That's not the same as a server write: the outer
  // Hifz Setup section's own Save button is still what actually persists
  // it, same two-step confirm every other field on this screen already
  // uses — one sub-control silently server-saving on its own would be
  // the surprising, inconsistent behavior here, not this.
  const commitAndClose = () => {
    baselineMode = mode;
    baselineSelection = draft;
    renderBaselineSummary();
    overlay.remove();
  };
  overlay.addEventListener('click', e => { if(e.target === overlay) commitAndClose(); });
  document.getElementById('sectionGridCloseBtn').addEventListener('click', commitAndClose);
}
document.getElementById('openJuzGridBtn').addEventListener('click', () => openSectionGridModal('juz'));
document.getElementById('openSurahGridBtn').addEventListener('click', () => openSectionGridModal('surah'));

// ---------- Dhor Schedule (new, V3.9.0) ----------
let setupSelectedGranularity = null;
let setupSelectedFrequency = null;
let setupSelectedDays = [];

function renderGranularityPicker(){
  document.querySelectorAll('#dhor_granularity_picker [data-granularity]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.granularity === setupSelectedGranularity);
  });
}
document.querySelectorAll('#dhor_granularity_picker [data-granularity]').forEach(btn => {
  btn.addEventListener('click', () => {
    setupSelectedGranularity = btn.dataset.granularity;
    renderGranularityPicker();
  });
});

function renderFrequencyPicker(){
  document.querySelectorAll('#dhor_frequency_picker [data-frequency]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.frequency === setupSelectedFrequency);
  });
}
document.querySelectorAll('#dhor_frequency_picker [data-frequency]').forEach(btn => {
  btn.addEventListener('click', () => {
    setupSelectedFrequency = btn.dataset.frequency;
    renderFrequencyPicker();
  });
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
  renderGenderPicker();
  updateHaidhVisibility();

  // Hifz Setup section
  setupSelectedMushaf = profile.mushaf || null;
  renderMushafPicker();
  baselineMode = profile.baseline_mode || null;
  baselineSelection = Array.isArray(profile.baseline_selection) ? profile.baseline_selection.slice() : [];
  renderBaselineSummary();
  document.getElementById('target_mistakes').value = profile.target_mistakes_per_juz != null ? profile.target_mistakes_per_juz : 2;
  document.getElementById('target_minutes').value = profile.target_minutes_per_juz != null ? profile.target_minutes_per_juz : 40;
  document.getElementById('target_frequency').value = profile.target_frequency_days != null ? profile.target_frequency_days : 30;

  // Dhor Schedule section
  setupSelectedGranularity = profile.dhor_granularity || null;
  renderGranularityPicker();
  document.getElementById('dhor_quantity').value = profile.dhor_quantity != null ? profile.dhor_quantity : 1;
  setupSelectedFrequency = profile.dhor_frequency || null;
  renderFrequencyPicker();
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
