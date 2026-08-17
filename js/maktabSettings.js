// ============================================================
// Hifzhelper -- Maktab settings screen (V3.65.0, delivery (g)).
// ADMIN ONLY: the nav item is gated on role === 'admin' (js/auth.js,
// same as the Admin item) and the write endpoint enforces it again
// server-side with requireAdmin. A teacher never sees this screen --
// but their cards DO read the mushaf, which is why the GET is teacher+.
//
// Four settings, all confirmed in chat 2026-08-16. The two numbers used
// to be planned as worker env vars; they live here so they change
// without a redeploy.
// ============================================================

async function renderMaktabSettingsScreen(){
  const host = document.getElementById('maktabSettingsBody');
  host.innerHTML = '<p class="form-hint">Loading\u2026</p>';

  let s;
  try{
    s = await apiGetMaktabSettings();
  } catch(e){
    host.innerHTML = '<p class="form-hint">Could not load the maktab settings.</p>';
    return;
  }
  if(!s || typeof s !== 'object'){
    host.innerHTML = '<p class="form-hint">Could not load the maktab settings.</p>';
    return;
  }

  const esc = (v) => { const d = document.createElement('span'); d.textContent = v == null ? '' : String(v); return d.innerHTML; };
  host.innerHTML = `
    <label class="form-label">Maktab name
      <input type="text" id="mset_name" maxlength="60" value="${esc(s.name)}">
    </label>

    <label class="form-label">Mushaf
      <select id="mset_mushaf">
        <option value="13line"${s.mushaf === '13line' ? ' selected' : ''}>13-line (IndoPak)</option>
        <option value="15line_madani"${s.mushaf === '15line_madani' ? ' selected' : ''}>Madina</option>
      </select>
    </label>
    <p class="form-hint">Every student in the maktab follows this mushaf. It affects Sabaq line and page counts, Sabaq Dhor portions, and whether a half is labelled Hizb.</p>

    <label class="form-label">Students needed for a maktab day
      <input type="number" id="mset_day_min" min="1" inputmode="numeric" value="${esc(s.maktab_day_min)}">
    </label>
    <p class="form-hint">A date counts as a maktab day once this many different students have any entry. Attendance is only worked out for maktab days.</p>

    <label class="form-label">Flag a student after this many maktab days with no entry
      <input type="number" id="mset_absence" min="1" inputmode="numeric" value="${esc(s.absence_flag_days)}">
    </label>

    <button type="button" class="primary-btn" id="mset_save">Save settings</button>
    <span class="save-status" id="mset_status"></span>`;

  document.getElementById('mset_save').addEventListener('click', saveMaktabSettingsScreen);
}

async function saveMaktabSettingsScreen(){
  const status = document.getElementById('mset_status');
  const payload = {
    name: document.getElementById('mset_name').value,
    mushaf: document.getElementById('mset_mushaf').value,
    maktab_day_min: Number(document.getElementById('mset_day_min').value),
    absence_flag_days: Number(document.getElementById('mset_absence').value),
  };
  status.textContent = 'Saving\u2026';
  try{
    await apiSaveMaktabSettings(payload);
  } catch(e){
    status.textContent = (e && e.message) ? e.message : 'Could not save.';
    return;
  }
  // the mushaf is cached for the session and read by every card -- drop
  // the cache so the change takes effect without a reload
  invalidateMaktabSettings();
  await loadMaktabSettings(true);
  status.textContent = 'Saved \u2713';
}
