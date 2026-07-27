// ============================================================
// Hifzhelper — Setup screen (V3.7.0/V3.7.1)
// Profile section only: view-only name/ID/URL, editable journal name,
// gender, and mushaf choice. History capture, default targets, Dhor
// planning, and haidh tracking are separate, later deliveries — this
// screen deliberately does not touch any of them.
//
// Reached two ways: the "Settings" nav item (any time), and automatically
// on a new user's first login, before setup_complete is set (see
// bootApp() in app.js) — the same screen either way, just a different
// entry point.
//
// V3.7.1: Save moved from a bottom-of-form text button to an icon-only
// button on the right of the header row (icon-over-button preference).
// ============================================================

document.getElementById('setupSaveBtn').innerHTML = iconHtml('save');

let setupSelectedMushaf = null;

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

async function renderSettingsScreen(){
  document.getElementById('setupError').textContent = '';
  const profile = await apiGetProfile();

  document.getElementById('setup_name_display').textContent = profile.name || '';
  document.getElementById('setup_id_display').textContent = profile.id || '';
  document.getElementById('setup_url_display').value = window.location.origin + '/' + profile.id;

  document.getElementById('setup_journal_name').value = profile.journal_name || '';
  document.getElementById('setup_gender').value = profile.gender || 'M';

  setupSelectedMushaf = profile.mushaf || null;
  renderMushafPicker(setupSelectedMushaf);
}

wireCopyButton('setupCopyUrlBtn', 'setup_url_display');

document.getElementById('setupSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('setupError');
  errEl.textContent = '';

  const payload = {
    journal_name: document.getElementById('setup_journal_name').value || null,
    gender: document.getElementById('setup_gender').value,
    setup_complete: true
  };
  if(setupSelectedMushaf) payload.mushaf = setupSelectedMushaf;

  try{
    await apiSaveProfile(payload);
    document.getElementById('setupSaveStatus').classList.add('show');
    setTimeout(() => document.getElementById('setupSaveStatus').classList.remove('show'), 1800);
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
});
