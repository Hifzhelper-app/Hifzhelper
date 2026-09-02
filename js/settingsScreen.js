/* Hifzhelper build 4.2.5 | js/settingsScreen.js */
// ============================================================
// Hifzhelper — Setup screen (V3.9.0, switch redesign V3.10.0, V2 refinements V3.11.0)
// Current as of V3.38
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

// ---------- Haidh: ruling switch + haaidha opt-in checkbox (V3.39) ----------
// V3.96.0: the ruling-hint constant and the hint element are DELETED as one
// set with both writer lines (the V3.51.2 trap). The ruling itself is
// untouched: chosen here, re-rendered, loaded, saved, and enforced by
// haidhOfficialMaxDuration in validation.
let setupSelectedRuling = 'hanafi';
wireSwitch('haidh_ruling_switch', (value) => {
  setupSelectedRuling = value;
  renderSwitch('haidh_ruling_switch', setupSelectedRuling);
});

// Deliberately outside every section's own Save button (confirmed in
// chat: "will not require a separate save") — saves the instant it's
// toggled, then refreshes both nav surfaces (home grid + dropdown) so
// the Haidh nav item appears/disappears immediately, not just after a
// reload.
document.getElementById('haaidha_checkbox').addEventListener('change', async (e) => {
  const checked = e.target.checked;
  try{
    await apiSaveProfile({ track_haidh: checked });
    currentUser.trackHaidh = checked;
    setupAuthBandAndDropdown();
    if(!document.getElementById('screen-home').classList.contains('hidden')) renderHomeScreen();
  } catch(err){
    e.target.checked = !checked; // revert on failure -- never show a state that didn't actually save
    document.getElementById('haidhError').textContent = "Couldn't save: " + err.message;
  }
});

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
// 2026-08-07 (V3.38): IndoPak's own Maqra/Rub'/Hizb terminology picker
// (indopak_terminology_switch/indopakTerminologyRow) is removed entirely,
// on hold -- confirmed in chat. IndoPak is Quarter/Half only now.
let setupSelectedMushaf = null;
wireSwitch('mushaf_switch', (value) => {
  setupSelectedMushaf = value;
  renderSwitch('mushaf_switch', setupSelectedMushaf);
  document.getElementById('mushafHint').textContent = MUSHAF_HINTS[value] || '';
});

// ---------- Hifz Setup: completed-sections grid ----------
// 2026-08-07 (V3.38): this used to be a Juz'/Surah switch (V3.11.0's
// "always rest neutral" design) -- with Surah mode removed entirely,
// there's nothing left to switch between, so it's just a single button
// now. baselineMode itself is also gone -- juz' is the only mode, so
// there's nothing left to distinguish it from.
let baselineSelection = [];

function renderBaselineSummary(){
  const el = document.getElementById('baselineSummary');
  if(!baselineSelection.length){ el.textContent = 'Nothing marked yet.'; return; }
  // V3.15.0: baselineSelection holds quarter-unit IDs — count whole
  // juz' as however many have all 4 of their quarter-units present.
  const juzCount = Array.from({length: 30}, (_, i) => i + 1)
    .filter(juz => quarterUnitsForJuz(juz).every(u => baselineSelection.includes(u))).length;
  el.textContent = `${juzCount} juz' marked complete.`;
}

// 2026-08-07 (V3.38): Surah-based history removed entirely, on hold --
// confirmed in chat, "History will only be collected as juz." This used
// to take a mode ('juz'/'surah') parameter; Juz' is the only mode now,
// so the parameter, the whole Surah branch, and the Juz'/Surah switch
// itself (index.html's section_grid_switch) are gone, not just hidden.
function openSectionGridModal(){
  // V3.15.0: baseline_selection stores quarter-unit IDs (1-120), not
  // whole juz' numbers -- the grid still shows/toggles WHOLE juz' for a
  // natural picker. A juz' displays as "marked" only if all 4 of its
  // quarter-units are already in the stored pool; committing expands
  // each marked juz' back out to its 4 quarter-unit IDs.
  const draft = Array.from({length: 30}, (_, i) => i + 1)
    .filter(juz => quarterUnitsForJuz(juz).every(u => baselineSelection.includes(u)));
  // V3.45.3: snapshot of what was complete when the modal opened,
  // separate from `draft` itself since that array gets mutated as the
  // user toggles tiles -- needed to diff against at close time for the
  // new confirmation message.
  const initialComplete = draft.slice();
  const items = Array.from({length: 30}, (_, i) => [i + 1, `Juz ${i + 1}`]);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay section-grid-modal';
  overlay.innerHTML = `<div class="modal-card">
    <button type="button" class="close-btn" id="sectionGridCloseBtn">&times;</button>
    <h2>Mark completed Juz</h2>
    <div class="section-grid grid-juz" id="sectionGridCells"></div>
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

  // V3.45.3: same confirmation treatment as the Juz Tracker, confirmed
  // in chat -- this picker previously had zero confirmation of any
  // kind when closed. Reuses buildJuzConfirmMessage
  // (js/juzTrackerScreen.js, loads before this file) so both give the
  // exact same message shape. Nothing changed -> commits silently with
  // no prompt, same as before. Cancel leaves the modal open rather
  // than closing it, so the user can keep adjusting.
  const commitAndClose = () => {
    const newlyMarked = draft.filter(j => !initialComplete.includes(j));
    const newlyUnmarked = initialComplete.filter(j => !draft.includes(j));
    if(newlyMarked.length || newlyUnmarked.length){
      if(!confirm(buildJuzConfirmMessage(newlyMarked, newlyUnmarked, draft))) return;
    }
    baselineSelection = draft.flatMap(juz => quarterUnitsForJuz(juz));
    renderBaselineSummary();
    overlay.remove();
  };
  overlay.addEventListener('click', e => { if(e.target === overlay) commitAndClose(); });
  document.getElementById('sectionGridCloseBtn').addEventListener('click', commitAndClose);
}
// V3.45.3: previously-deferred "Settings link" to the Juz Tracker,
// confirmed in chat -- lets the user choose between the visual tracker
// (default) or this existing grid-list picker. juzMethodChoice is a
// plain in-memory preference, not persisted anywhere -- defaults back
// to 'tracker' on every fresh Settings visit rather than remembering a
// prior choice, since nothing in chat asked for it to be saved.
let juzMethodChoice = 'tracker';
document.getElementById('juzMethodTrackerIcon').innerHTML = iconHtml('juzTracker');
renderSwitch('juzMethodSwitch', juzMethodChoice);
wireSwitch('juzMethodSwitch', (value) => {
  juzMethodChoice = value;
  renderSwitch('juzMethodSwitch', juzMethodChoice);
});
document.getElementById('openJuzGridBtn').addEventListener('click', () => {
  if(juzMethodChoice === 'tracker') showScreen('juzTracker');
  else openSectionGridModal();
});

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
  baselineSelection = Array.isArray(profile.baseline_selection) ? profile.baseline_selection.slice() : [];
  renderBaselineSummary();
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
  document.getElementById('haaidha_checkbox').checked = !!profile.track_haidh;
  setupSelectedRuling = profile.haidh_ruling || 'hanafi';
  renderSwitch('haidh_ruling_switch', setupSelectedRuling);
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
  if(baselineSelection.length) payload.baseline_selection = baselineSelection;
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
// V3.39: client-side mirror of the backend's cap checks (shared/
// haidhRules.js, same numbers, never duplicated by value) — catches an
// invalid combination before a round trip, backend still re-checks
// regardless (never trust the frontend's shape blindly, CONVENTIONS.md
// principle 4).
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
  const maxDuration = haidhOfficialMaxDuration(setupSelectedRuling);
  if(periodLength > maxDuration){
    errEl.textContent = `Duration cannot exceed ${maxDuration} days for the selected ruling.`;
    return;
  }
  const minFrequency = haidhMinCycleFrequency(periodLength);
  if(cycleLength < minFrequency){
    errEl.textContent = `Haidh cycle frequency must be at least ${minFrequency} days for a ${periodLength}-day duration.`;
    return;
  }
  try{
    await apiSaveProfile({
      haidh_cycle_length: cycleLength,
      haidh_period_length: periodLength,
      haidh_next_expected: nextExpected,
      haidh_ruling: setupSelectedRuling,
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
