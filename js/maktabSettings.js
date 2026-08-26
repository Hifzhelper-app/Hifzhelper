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
    <div class="mset-name-row">
      <label class="form-label mset-name-field">Maktab name
        <input type="text" id="mset_name" maxlength="60" value="${esc(s.name)}">
      </label>
      <!-- V3.74.2: save moved up here as an icon, matching the Dhor card's
           icon-plus-SAVE pattern. It REPLACES the text button that used to
           sit at the bottom — one way to save, not two. -->
      <button type="button" class="mset-save-btn" id="mset_save" aria-label="Save settings">
        <span class="mset-save-icon" id="mset_save_icon"></span><span>SAVE</span>
      </button>
    </div>

    <!-- V3.74.2: was a <legend>, which sits inset into the fieldset border
         at a smaller size — that is why it never lined up with "Maktab
         name" above. Now a normal label outside the group, same styling. -->
    <div class="form-label mset-mushaf-label">Mushaf
      <span class="mset-legend-note">(counting lines and pages, and determining boundaries for juz)</span>
    </div>
    <fieldset class="mset-mushaf">
      ${[
        ['13line', '13 line indopak', 'quarter and half from the ruku'],
        ['15line_madani', '15 line madani', 'maqra (sabaq dhor only), rub and hizb'],
        ['15line_indopak', '15 line indopak', 'quarter and half from the ruku'],
      ].map(([value, name, detail]) => `
        <label class="mset-mushaf-opt">
          <input type="radio" name="mset_mushaf" value="${value}"${s.mushaf === value ? ' checked' : ''}>
          <span class="mset-mushaf-name">${name}</span>
          <span class="mset-mushaf-detail">${detail}</span>
        </label>`).join('')}
    </fieldset>

    <label class="form-label">Minimum no of students to mark a Hifz maktab day
      <input type="number" id="mset_day_min" min="1" inputmode="numeric" value="${esc(s.maktab_day_min)}">
    </label>

    <label class="form-label">Students will be flagged as inactive after
      <input type="number" id="mset_absence" min="1" inputmode="numeric" value="${esc(s.absence_flag_days)}"> days
    </label>

    <span class="save-status" id="mset_status"></span>`;

  // V3.74.2: the save icon, drawn from the shared set like every other.
  const si = document.getElementById('mset_save_icon');
  if(si && typeof iconHtml === 'function') si.innerHTML = iconHtml('save');

  document.getElementById('mset_save').addEventListener('click', saveMaktabSettingsScreen);
}

async function saveMaktabSettingsScreen(){
  const status = document.getElementById('mset_status');
  const payload = {
    name: document.getElementById('mset_name').value,
    // V3.74.0: radios now, not a select. Falls back to the first option
    // rather than undefined if none is checked — an unchecked group would
    // otherwise send undefined and be rejected by the worker whitelist.
    mushaf: (document.querySelector('input[name="mset_mushaf"]:checked') || {}).value || '13line',
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
