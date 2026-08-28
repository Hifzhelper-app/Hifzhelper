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

    <!-- V3.78.0: the fifth setting (decided 2026-08-17). Everyone sees
         maktab time (user, 2026-08-27): with a zone chosen, "today" for
         every user — summaries, calendars, the worker's own haidh
         decisions — is the maktab's calendar day wherever their device
         sits. "Not set" keeps each device on its own day, as before. -->
    <label class="form-label">Maktab timezone
      <select id="mset_timezone"></select>
    </label>

    <span class="save-status" id="mset_status"></span>

    <!-- V3.78.0 (items 7 + 8): the two admin-managed lists. One shape,
         instantiated twice: named rows referenced by ID from elsewhere, so
         RENAME propagates and RETIRE replaces delete (nothing that is
         referenced ever dangles). Groups order and filter the summary;
         tags are the tajweed vocabulary every card's picker offers. -->
    <div class="form-label mset-list-label">Groups
      <span class="mset-legend-note">(one per student, assigned on her Admin card; the summary orders by group)</span>
    </div>
    <div class="mset-list" id="msetGroupsList"></div>
    <div class="mset-list-add">
      <input type="text" id="mset_group_new" maxlength="40" placeholder="New group name">
      <button type="button" class="secondary" id="mset_group_add">Add group</button>
    </div>

    <div class="form-label mset-list-label">Tajweed tags
      <span class="mset-legend-note">(&bull; marks a major tag; retiring keeps it on old entries)</span>
    </div>
    <div class="mset-list" id="msetTagsList"></div>
    <div class="mset-list-add">
      <input type="text" id="mset_tag_new" maxlength="40" placeholder="New tag name">
      <label class="mset-major-check"><input type="checkbox" id="mset_tag_new_major"> major</label>
      <button type="button" class="secondary" id="mset_tag_add">Add tag</button>
    </div>
    <div class="form-error" id="mset_list_error"></div>`;

  renderMsetTimezoneSelect(s.timezone);
  await renderMsetLists();

  // V3.74.2: the save icon, drawn from the shared set like every other.
  const si = document.getElementById('mset_save_icon');
  if(si && typeof iconHtml === 'function') si.innerHTML = iconHtml('save');

  document.getElementById('mset_save').addEventListener('click', saveMaktabSettingsScreen);
}

// V3.78.0: the timezone select — every IANA zone the browser knows, or a
// short common list where Intl.supportedValuesOf is missing. Set via
// textContent-safe option construction, current value selected, '' = not set.
function renderMsetTimezoneSelect(current){
  const sel = document.getElementById('mset_timezone');
  let zones = [];
  try{ zones = Intl.supportedValuesOf('timeZone'); }
  catch(e){ zones = ['Africa/Johannesburg', 'Africa/Nairobi', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'UTC']; }
  const opts = [['', 'Not set (each device uses its own day)']].concat(zones.map(z => [z, z]));
  sel.innerHTML = '';
  for(const [value, label] of opts){
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    if((current || '') === value) o.selected = true;
    sel.appendChild(o);
  }
}

// V3.78.0: the two list managers. Same renderer twice — a row per entry
// with rename (tap the name), the major toggle (tags only), and
// retire/restore. All writes go straight to the worker and re-render, so
// what is on screen is always what is stored.
async function renderMsetLists(){
  const errEl = document.getElementById('mset_list_error');
  errEl.textContent = '';
  let groups, tags;
  try{
    [groups, tags] = await Promise.all([apiGetMaktabGroups(), apiGetTajweedTags()]);
  } catch(e){
    errEl.textContent = 'Could not load the lists: ' + e.message;
    return;
  }
  renderMsetList('msetGroupsList', groups, {
    rename: (id, name) => apiUpdateMaktabGroup(id, { name }),
    retire: (id, retired) => apiUpdateMaktabGroup(id, { retired }),
  });
  renderMsetList('msetTagsList', tags, {
    rename: (id, name) => apiUpdateTajweedTag(id, { name }),
    retire: (id, retired) => apiUpdateTajweedTag(id, { retired }),
    toggleMajor: (id, major) => apiUpdateTajweedTag(id, { major }),
  });
}

function renderMsetList(hostId, rows, ops){
  const host = document.getElementById(hostId);
  const errEl = document.getElementById('mset_list_error');
  host.innerHTML = '';
  if(!rows.length){
    host.innerHTML = '<div class="mset-list-empty">None yet.</div>';
    return;
  }
  const act = async (fn) => {
    errEl.textContent = '';
    try{ await fn(); await renderMsetLists(); }
    catch(e){ errEl.textContent = e.message; }
  };
  rows.forEach(row => {
    const div = document.createElement('div');
    div.className = 'mset-list-row' + (row.retired ? ' retired' : '');
    const nameBtn = document.createElement('button');
    nameBtn.type = 'button';
    nameBtn.className = 'mset-list-name';
    nameBtn.textContent = row.name + (row.major ? ' •' : '');
    nameBtn.title = 'Rename';
    nameBtn.addEventListener('click', () => {
      const name = prompt('Rename "' + row.name + '" to:', row.name);
      if(name && name.trim() && name.trim() !== row.name) act(() => ops.rename(row.id, name.trim()));
    });
    div.appendChild(nameBtn);
    if(ops.toggleMajor){
      const mj = document.createElement('button');
      mj.type = 'button';
      mj.className = 'link-btn';
      mj.textContent = row.major ? 'make minor' : 'make major';
      mj.addEventListener('click', () => act(() => ops.toggleMajor(row.id, !row.major)));
      div.appendChild(mj);
    }
    const rt = document.createElement('button');
    rt.type = 'button';
    rt.className = 'link-btn';
    rt.textContent = row.retired ? 'restore' : 'retire';
    rt.addEventListener('click', () => act(() => ops.retire(row.id, !row.retired)));
    div.appendChild(rt);
    host.appendChild(div);
  });
  // the add buttons are outside the list; wire once per render pass
  wireMsetAdd('mset_group_add', 'mset_group_new', null, (name) => apiCreateMaktabGroup(name));
  wireMsetAdd('mset_tag_add', 'mset_tag_new', 'mset_tag_new_major', (name, major) => apiCreateTajweedTag(name, major));
}

function wireMsetAdd(btnId, inputId, majorId, create){
  const btn = document.getElementById(btnId);
  if(!btn || btn._wired) return;
  btn._wired = true;
  btn.addEventListener('click', async () => {
    const errEl = document.getElementById('mset_list_error');
    errEl.textContent = '';
    const input = document.getElementById(inputId);
    const name = input.value.trim();
    if(!name) return;
    const major = majorId ? document.getElementById(majorId).checked : undefined;
    try{
      await create(name, major);
      input.value = '';
      if(majorId) document.getElementById(majorId).checked = false;
      await renderMsetLists();
      // the picker vocabulary is session-cached; a new tag should be
      // offerable without a reload
      if(typeof loadTajweedVocabulary === 'function') await loadTajweedVocabulary();
    } catch(e){
      errEl.textContent = e.message;
    }
  });
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
    timezone: document.getElementById('mset_timezone').value,   // '' clears (V3.78.0)
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
  // V3.78.0: the timezone applies to this session immediately, without a
  // reload — appTodayISO reads this.
  MAKTAB_TIMEZONE = payload.timezone || null;
  status.textContent = 'Saved \u2713';
}
