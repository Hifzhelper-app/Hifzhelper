// ============================================================
// Hifzhelper — Setup screen (V3.7.x/V3.8.0)
// 2 cards, each independently saved (matching the day-log view's
// per-card save pattern): Profile (view-only header + journal name +
// gender) and Hifz Setup (mushaf, history baseline, default targets).
// Rail/dot scroll behavior mirrors js/logDetailScreen.js, just for 2
// cards instead of 4.
//
// Reached two ways: the "Settings" nav item (any time), and automatically
// on a new user's first login, before setup_complete is set (see
// bootApp() in app.js) — the same screen either way, just a different
// entry point. Dhor planning and haidh tracking are separate, later
// deliveries — not part of this screen.
// ============================================================

document.getElementById('profileSaveBtn').innerHTML = iconHtml('save');
document.getElementById('hifzSetupSaveBtn').innerHTML = iconHtml('save');

let setupSelectedMushaf = null;
let baselineMode = null;
let baselineSelection = []; // selected numbers — surah 1-114, or juz' 1-30, per baselineMode

function renderMushafPicker(selected){
  const el = document.getElementById('setup_mushaf_picker');
  el.querySelectorAll('[data-mushaf]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mushaf === selected);
  });
}
document.querySelectorAll('#setup_mushaf_picker [data-mushaf]:not(:disabled)').forEach(btn => {
  btn.addEventListener('click', () => {
    setupSelectedMushaf = btn.dataset.mushaf;
    renderMushafPicker(setupSelectedMushaf);
  });
});

function renderBaselineModePicker(){
  document.querySelectorAll('#baseline_mode_picker [data-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === baselineMode);
  });
}

// Surahs/Juz' are independent alternatives, not combined (confirmed in
// chat) — the grid re-renders (with a slide-in, see settings.css) for
// whichever mode is active. Multiple items ARE selectable within a mode
// (multiple surahs, or multiple juz') — only the MODE choice is exclusive.
function renderBaselineGrid(){
  const wrap = document.getElementById('baseline_grid_wrap');
  if(!baselineMode){ wrap.innerHTML = ''; return; }
  const items = baselineMode === 'surah'
    ? SURAHS.map(([num, name]) => [num, `${num}. ${name}`])
    : Array.from({length: 30}, (_, i) => [i + 1, `Juz' ${i + 1}`]);
  wrap.innerHTML = items.map(([num, label]) =>
    `<button type="button" class="tajweed-tag${baselineSelection.includes(num) ? ' active' : ''}" data-item="${num}">${label}</button>`
  ).join('');
  wrap.querySelectorAll('[data-item]').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = parseInt(btn.dataset.item, 10);
      const idx = baselineSelection.indexOf(n);
      if(idx >= 0) baselineSelection.splice(idx, 1); else baselineSelection.push(n);
      btn.classList.toggle('active');
    });
  });
}

document.querySelectorAll('#baseline_mode_picker [data-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    if(baselineMode === btn.dataset.mode) return; // already this mode
    // Switching modes discards whatever was selected under the OTHER
    // mode — there's no sensible way to keep both, since only one mode
    // is ever the active one.
    baselineMode = btn.dataset.mode;
    baselineSelection = [];
    renderBaselineModePicker();
    renderBaselineGrid();
  });
});

async function renderSettingsScreen(){
  document.getElementById('profileError').textContent = '';
  document.getElementById('hifzSetupError').textContent = '';
  const profile = await apiGetProfile();

  // Profile card
  document.getElementById('setup_name_display').textContent = profile.name || '';
  document.getElementById('setup_id_display').textContent = profile.id || '';
  document.getElementById('setup_url_display').value = window.location.origin + '/' + profile.id;
  document.getElementById('setup_journal_name').value = profile.journal_name || '';
  document.getElementById('setup_gender').value = profile.gender || 'M';

  // Hifz Setup card
  setupSelectedMushaf = profile.mushaf || null;
  renderMushafPicker(setupSelectedMushaf);

  baselineMode = profile.baseline_mode || null;
  baselineSelection = Array.isArray(profile.baseline_selection) ? profile.baseline_selection.slice() : [];
  renderBaselineModePicker();
  renderBaselineGrid();

  document.getElementById('target_mistakes').value = profile.target_mistakes_per_juz != null ? profile.target_mistakes_per_juz : 2;
  document.getElementById('target_minutes').value = profile.target_minutes_per_juz != null ? profile.target_minutes_per_juz : 40;
  document.getElementById('target_frequency').value = profile.target_frequency_days != null ? profile.target_frequency_days : 30;

  // Card rail: start on the Profile card, sync the dots to match.
  document.getElementById('settingsCardRail').scrollLeft = 0;
  updateSettingsCardDots();
}

function updateSettingsCardDots(){
  const rail = document.getElementById('settingsCardRail');
  const dots = document.querySelectorAll('#settingsCardDots .dot');
  const cards = Array.from(rail.children);
  let activeIndex = 0;
  cards.forEach((card, i) => {
    if(card.offsetLeft <= rail.scrollLeft + 4) activeIndex = i;
  });
  dots.forEach((dot, i) => dot.classList.toggle('active', i === activeIndex));
}
document.getElementById('settingsCardRail').addEventListener('scroll', () => {
  window.requestAnimationFrame(updateSettingsCardDots);
});
document.querySelectorAll('#settingsCardDots .dot').forEach(dot => {
  dot.addEventListener('click', () => {
    const rail = document.getElementById('settingsCardRail');
    const card = rail.children[parseInt(dot.dataset.index, 10)];
    if(card) rail.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
  });
});

wireCopyButton('setupCopyUrlBtn', 'setup_url_display');

// Profile card — saves journal_name + gender only.
document.getElementById('profileSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('profileError');
  errEl.textContent = '';
  const payload = {
    journal_name: document.getElementById('setup_journal_name').value || null,
    gender: document.getElementById('setup_gender').value,
    setup_complete: true // saving EITHER card is enough to mark setup complete
  };
  try{
    await apiSaveProfile(payload);
    document.getElementById('profileSaveStatus').classList.add('show');
    setTimeout(() => document.getElementById('profileSaveStatus').classList.remove('show'), 1800);
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
});

// Hifz Setup card — saves mushaf + history baseline + default targets,
// independently of the Profile card.
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
