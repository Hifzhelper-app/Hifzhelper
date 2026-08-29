// ============================================================
// Hifzhelper -- Maktab settings screen (V3.65.0, delivery (g);
// restructured V3.79.0 into a THREE-CARD RAIL like the day view —
// user's schematic 2026-08-28).
//
// ADMIN ONLY: the nav item is gated on role === 'admin' (js/auth.js)
// and the write endpoints enforce it again server-side. A teacher never
// sees this screen -- but their cards DO read the mushaf, which is why
// the settings GET is teacher+.
//
// Three cards, two save models — both the user's explicit calls:
//   GENERAL keeps the form + SAVE it has had since V3.65.0 (name,
//     mushaf, day minimum, absence days, timezone). Nothing commits
//     until Save.
//   TAJWEED and GROUPS have NO Save ("keep the existing save, remove
//     the save from tajweed and groups"): every control commits
//     INSTANTLY — the MAJOR/MINOR pill and RETIRE checkbox on tap, the
//     name (and group description) inputs on blur or Enter. A rejection
//     restores the old value and shows the error against that card.
//     There is never an unsaved state on a list.
//
// The timezone control is option 3 (user, 2026-08-28): current setting
// + one-tap "Use this device's timezone", with a type-ahead behind
// "choose a different zone" for the travelling-admin case. It STAGES
// into the hidden #mset_timezone input; General's Save commits it, and
// the worker's Intl validation (V3.78.0) remains the backstop.
// ============================================================

async function renderMaktabSettingsScreen(){
  const general = document.getElementById('msetCardGeneral');
  general.innerHTML = '<p class="form-hint">Loading\u2026</p>';

  let s;
  try{
    s = await apiGetMaktabSettings();
  } catch(e){
    general.innerHTML = '<p class="form-hint">Could not load the maktab settings.</p>';
    return;
  }
  if(!s || typeof s !== 'object'){
    general.innerHTML = '<p class="form-hint">Could not load the maktab settings.</p>';
    return;
  }

  const esc = (v) => { const d = document.createElement('span'); d.textContent = v == null ? '' : String(v); return d.innerHTML; };

  // ---------- card 1: GENERAL (form + Save, as always) ----------
  general.innerHTML = `
    <!-- V3.85.0: rebuilt to the user's schematic (2026-08-28) —
         label-left / control-right rows; SAVE stays top-right; the
         timezone is ONE field (tap to open the chooser), which also
         removes the standing "Use this device's timezone" button the
         user reported lingering after choosing another zone. -->
    <!-- V3.86.0 (user): SAVE gets its OWN row at the top, right-aligned
         (the schematic); every content row starts below it. -->
    <div class="mset-save-row">
      <button type="button" class="mset-save-btn" id="mset_save" aria-label="Save settings">
        <span class="mset-save-icon" id="mset_save_icon"></span><span>SAVE</span>
      </button>
      <span class="mset-save-status" id="mset_status"></span>
    </div>
    <div class="mset-row mset-name-row">
      <span class="mset-row-label">Maktab Name</span>
      <input type="text" id="mset_name" maxlength="60" value="${esc(s.name)}">
    </div>

    <input type="hidden" id="mset_timezone" value="${esc(s.timezone || '')}">
    <div class="mset-row">
      <span class="mset-row-label">Time Zone</span>
      <button type="button" class="mset-tz-field" id="mset_tz_field"></button>
    </div>
    <div class="mset-tz-chooser hidden" id="mset_tz_chooser">
      <button type="button" class="secondary" id="mset_tz_device"></button>
      <div class="mset-tz-other-row" id="mset_tz_other_row">
        <input type="text" id="mset_tz_other" list="mset_tz_zones" placeholder="Start typing a zone\u2026" autocomplete="off">
        <datalist id="mset_tz_zones"></datalist>
      </div>
      <button type="button" class="link-btn" id="mset_tz_clear">clear (each device uses its own day)</button>
    </div>

    <div class="mset-row mset-row-top">
      <span class="mset-row-label">Mushaf
        <span class="mset-legend-note">(counting lines and pages, and determining boundaries for juz)</span>
      </span>
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
    </div>

    <div class="mset-row mset-row-narrow">
      <span class="mset-row-label">Minimum number of students on a maktab day</span>
      <input type="number" class="mset-num" id="mset_day_min" min="1" inputmode="numeric" value="${esc(s.maktab_day_min)}">
    </div>
    <div class="mset-row mset-row-narrow">
      <span class="mset-row-label">No. of inactive maktab days before flagging a student</span>
      <input type="number" class="mset-num" id="mset_absence" min="1" inputmode="numeric" value="${esc(s.absence_flag_days)}">
    </div>

    <div class="mset-row mset-row-narrow">
      <span class="mset-row-label">Current term
        <span class="mset-legend-note">(the default attendance period)</span>
      </span>
      <span class="mset-term-row">
        <input type="date" id="mset_term_from" value="${esc(s.term_from || '')}" aria-label="Term from">
        <span>&ndash;</span>
        <input type="date" id="mset_term_to" value="${esc(s.term_to || '')}" aria-label="Term to">
      </span>
    </div>`;

  // ---------- cards 2 + 3: the two instant-commit lists ----------
  document.getElementById('msetCardTajweed').innerHTML = `
    <div class="form-label mset-list-label">Tajweed tags
      <span class="mset-legend-note">(major blocks the mistakes ring; retiring keeps a tag on old entries)</span>
    </div>
    <!-- V3.86.0 (user): the input takes the width; Add is a save ICON. -->
    <div class="mset-list-add">
      <input type="text" id="mset_tag_new" maxlength="40" placeholder="New tag name">
      <button type="button" class="mset-add-btn" id="mset_tag_add" aria-label="Add tag"><span class="mset-save-icon"></span></button>
    </div>
    <div class="mset-list-headers"><span>Retire</span></div>
    <div class="mset-list" id="msetTagsList"></div>
    <div class="form-error" id="mset_tag_error"></div>`;

  document.getElementById('msetCardGroups').innerHTML = `
    <div class="form-label mset-list-label">Hifz groups
      <span class="mset-legend-note">(one per student, assigned on her Admin card; the summary orders by group. Descriptions are info-only — they show here and nowhere else)</span>
    </div>
    <!-- V3.86.0 (user): the input takes the width; Add is a save ICON. -->
    <div class="mset-list-add">
      <input type="text" id="mset_group_new" maxlength="40" placeholder="New group name">
      <button type="button" class="mset-add-btn" id="mset_group_add" aria-label="Add group"><span class="mset-save-icon"></span></button>
    </div>
    <div class="mset-list-headers"><span>Retire</span></div>
    <div class="mset-list" id="msetGroupsList"></div>
    <div class="form-error" id="mset_group_error"></div>`;

  // ---------- card 4: the CALENDAR (V3.87.0, user spec) ----------
  // Terms (they DRIVE attendance): one line each — name, start, end —
  // instant-commit like the tag/group lists; ADD TERM shows when none
  // are defined, a small + thereafter. Below: the two options the user
  // asked for (load the 2025–2030 predictions; South African public
  // holidays per year) and the year's entries, each adjustable (actual
  // moon sightings overrule predictions) or deletable.
  document.getElementById('msetCardCalendar').innerHTML = `
    <div class="form-label mset-list-label">Terms
      <span class="mset-legend-note">(terms drive attendance — the default period is the term containing today)</span>
    </div>
    <div class="mset-terms" id="msetTermsList"></div>
    <button type="button" class="secondary" id="mset_term_add_big">Add term</button>
    <button type="button" class="mset-add-btn hidden" id="mset_term_add" aria-label="Add another term">+</button>
    <div class="form-error" id="mset_term_error"></div>

    <div class="form-label mset-list-label">Calendar entries
      <span class="mset-legend-note">(information only — shown on the calendar page and wherever dates appear)</span>
    </div>
    <div class="mset-cal-year-row">
      <label for="mset_cal_year">Year</label>
      <select id="mset_cal_year"></select>
      <button type="button" class="secondary" id="mset_cal_load_predictions">Add predictions</button>
      <button type="button" class="secondary" id="mset_cal_load_holidays">SA holidays</button>
    </div>
    <div class="mset-cal-list" id="msetCalList"></div>
    <div class="mset-cal-add-row">
      <input type="date" id="mset_cal_new_date" aria-label="New entry date">
      <input type="text" id="mset_cal_new_label" maxlength="60" placeholder="Label (blank = public holiday)">
      <button type="button" class="mset-add-btn" id="mset_cal_add" aria-label="Add entry"><span class="mset-save-icon"></span></button>
    </div>
    <div class="form-error" id="mset_cal_error"></div>`;
  wireMsetCalendarCard();
  renderMsetTerms();
  renderMsetCalList();

  renderMsetTimezoneControl();
  await renderMsetLists();
  wireMsetRail();

  const si = document.getElementById('mset_save_icon');
  if(si && typeof iconHtml === 'function') si.innerHTML = iconHtml('save');
  // V3.86.0: the two list add-buttons carry the same save icon
  if(typeof iconHtml === 'function'){
    document.querySelectorAll('.mset-add-btn .mset-save-icon').forEach(el => { el.innerHTML = iconHtml('save'); });
  }
  document.getElementById('mset_save').addEventListener('click', saveMaktabSettingsScreen);
}

// ---------- the rail's dots, mirroring the day view's driver ----------
// (log-detail classes are reused for the CSS; the driver can't be shared
// because it is wired to the other screen's ids at load time.)
function updateMsetDots(){
  const rail = document.getElementById('msetRail');
  const dots = document.querySelectorAll('#msetDots .dot');
  const cards = Array.from(rail.children);
  const railLeft = rail.getBoundingClientRect().left;
  let activeIndex = 0;
  cards.forEach((card, i) => {
    if(card.getBoundingClientRect().left <= railLeft + 4) activeIndex = i;
  });
  dots.forEach((dot, i) => dot.classList.toggle('active', i === activeIndex));
}
let msetRailWired = false;
function wireMsetRail(){
  const rail = document.getElementById('msetRail');
  rail.scrollLeft = 0;   // always open on General
  updateMsetDots();
  if(msetRailWired) return;
  msetRailWired = true;
  rail.addEventListener('scroll', () => { window.requestAnimationFrame(updateMsetDots); });
  document.querySelectorAll('#msetDots .dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const card = rail.children[parseInt(dot.dataset.index, 10)];
      if(card) rail.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
    });
  });
}

// ---------- the timezone control (option 3) ----------
function msetDeviceZone(){
  try{ return Intl.DateTimeFormat().resolvedOptions().timeZone || null; }
  catch(e){ return null; }
}
// V3.85.0: ONE Time Zone field. The field shows the staged zone (or
// "Not set"); tapping it toggles the chooser (device zone, type-ahead,
// clear). Every stage action CLOSES the chooser and repaints the field —
// nothing stays on screen advertising the device's zone, which is the
// user's reported bug with the old standing button. Staging semantics
// unchanged: everything writes the hidden #mset_timezone; General's
// Save commits; the worker validates.
function renderMsetTimezoneControl(){
  const staged = document.getElementById('mset_timezone').value;
  const field = document.getElementById('mset_tz_field');
  const chooser = document.getElementById('mset_tz_chooser');
  field.textContent = staged ? staged : 'Not set';
  const stage = (v) => {
    document.getElementById('mset_timezone').value = v;
    chooser.classList.add('hidden');
    renderMsetTimezoneControl();
  };
  if(!field._wired){
    field._wired = true;
    field.addEventListener('click', () => {
      chooser.classList.toggle('hidden');
      if(!chooser.classList.contains('hidden')){
        // the device-zone offer lives INSIDE the chooser only, and only
        // when it would change anything
        const dz = msetDeviceZone();
        const cur = document.getElementById('mset_timezone').value;
        const deviceBtn = document.getElementById('mset_tz_device');
        if(dz && dz !== cur){
          deviceBtn.textContent = `Use this device's timezone (${dz})`;
          deviceBtn.classList.remove('hidden');
        } else {
          deviceBtn.classList.add('hidden');
        }
        document.getElementById('mset_tz_clear').classList.toggle('hidden', !cur);
        msetFillZoneDatalist();
        document.getElementById('mset_tz_other').focus();
      }
    });
    document.getElementById('mset_tz_device').addEventListener('click', () => stage(msetDeviceZone() || ''));
    document.getElementById('mset_tz_clear').addEventListener('click', () => stage(''));
    // typing a full, known zone stages it; the worker validates again on Save
    document.getElementById('mset_tz_other').addEventListener('change', () => {
      const v = document.getElementById('mset_tz_other').value.trim();
      if(!v) return;
      document.getElementById('mset_tz_other').value = '';
      stage(v);
    });
  }
}
function msetFillZoneDatalist(){
  const dl = document.getElementById('mset_tz_zones');
  if(dl.children.length) return;   // fill once
  let zones = [];
  try{ zones = Intl.supportedValuesOf('timeZone'); }
  catch(e){ zones = ['Africa/Johannesburg', 'Africa/Nairobi', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'UTC']; }
  for(const z of zones){
    const o = document.createElement('option');
    o.value = z;
    dl.appendChild(o);
  }
}

// ---------- the two lists: inline rows, instant commit ----------
async function renderMsetLists(){
  let groups, tags;
  try{
    [groups, tags] = await Promise.all([apiGetMaktabGroups(), apiGetTajweedTags()]);
  } catch(e){
    const g = document.getElementById('mset_group_error');
    const t = document.getElementById('mset_tag_error');
    if(g) g.textContent = 'Could not load: ' + e.message;
    if(t) t.textContent = 'Could not load: ' + e.message;
    return;
  }
  renderMsetList('msetGroupsList', 'mset_group_error', groups, {
    rename: (id, name) => apiUpdateMaktabGroup(id, { name }),
    describe: (id, description) => apiUpdateMaktabGroup(id, { description }),
    retire: (id, retired) => apiUpdateMaktabGroup(id, { retired }),
  });
  renderMsetList('msetTagsList', 'mset_tag_error', tags, {
    rename: (id, name) => apiUpdateTajweedTag(id, { name }),
    retire: (id, retired) => apiUpdateTajweedTag(id, { retired }),
    toggleMajor: (id, major) => apiUpdateTajweedTag(id, { major }),
  });
}

function renderMsetList(hostId, errId, rows, ops){
  const host = document.getElementById(hostId);
  const errEl = document.getElementById(errId);
  host.innerHTML = '';
  if(!rows.length){
    host.innerHTML = '<div class="mset-list-empty">None yet.</div>';
    wireMsetAdds();
    return;
  }
  // One action → one write → re-render, so the screen always shows what
  // is stored. On failure the error lands against this card and the
  // re-render restores the stored value.
  const act = async (fn) => {
    errEl.textContent = '';
    try{ await fn(); await renderMsetLists(); }
    catch(e){ errEl.textContent = e.message; await renderMsetLists(); }
  };
  rows.forEach(row => {
    const div = document.createElement('div');
    div.className = 'mset-list-row' + (row.retired ? ' retired' : '');

    // the name: an inline input committing on blur/Enter (V3.79.0 — the
    // browser rename-prompt is gone)
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = 40;
    nameInput.className = 'mset-name-input';
    nameInput.value = row.name;
    nameInput.setAttribute('aria-label', 'Name');
    nameInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') nameInput.blur(); });
    nameInput.addEventListener('blur', () => {
      const name = nameInput.value.trim();
      if(!name){ nameInput.value = row.name; return; }   // empty: restore, no write
      if(name !== row.name) act(() => ops.rename(row.id, name));
    });
    div.appendChild(nameInput);

    // groups: the description, same commit semantics, info-only
    if(ops.describe){
      const descInput = document.createElement('input');
      descInput.type = 'text';
      descInput.maxLength = 200;
      descInput.className = 'mset-desc-input';
      descInput.value = row.description || '';
      descInput.placeholder = 'description';
      descInput.setAttribute('aria-label', 'Description');
      descInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') descInput.blur(); });
      descInput.addEventListener('blur', () => {
        const d = descInput.value.trim();
        if(d !== (row.description || '')) act(() => ops.describe(row.id, d));
      });
      div.appendChild(descInput);
    }

    // tags: the MAJOR/MINOR pill, committing on tap
    if(ops.toggleMajor){
      const pill = document.createElement('div');
      pill.className = 'mset-major-pill';
      [['MAJOR', 1], ['MINOR', 0]].forEach(([label, val]) => {
        const seg = document.createElement('button');
        seg.type = 'button';
        seg.textContent = label;
        seg.className = (row.major ? 1 : 0) === val ? 'active' : '';
        seg.addEventListener('click', () => {
          if((row.major ? 1 : 0) !== val) act(() => ops.toggleMajor(row.id, !!val));
        });
        pill.appendChild(seg);
      });
      div.appendChild(pill);
    }

    // retire: a checkbox committing on tap; unchecking restores
    const retire = document.createElement('input');
    retire.type = 'checkbox';
    retire.className = 'mset-retire-cb';
    retire.checked = !!row.retired;
    retire.setAttribute('aria-label', `Retire ${row.name}`);
    retire.addEventListener('change', () => act(() => ops.retire(row.id, retire.checked)));
    div.appendChild(retire);

    host.appendChild(div);
  });
  wireMsetAdds();
}

function wireMsetAdds(){
  wireMsetAdd('mset_group_add', 'mset_group_new', (name) => apiCreateMaktabGroup(name), 'mset_group_error');
  wireMsetAdd('mset_tag_add', 'mset_tag_new', (name) => apiCreateTajweedTag(name, false), 'mset_tag_error');
}

function wireMsetAdd(btnId, inputId, create, errId){
  const btn = document.getElementById(btnId);
  if(!btn || btn._wired) return;
  btn._wired = true;
  btn.addEventListener('click', async () => {
    const errEl = document.getElementById(errId);
    errEl.textContent = '';
    const input = document.getElementById(inputId);
    const name = input.value.trim();
    if(!name) return;
    try{
      await create(name);   // new tags start minor — the pill flips them
      input.value = '';
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
    timezone: document.getElementById('mset_timezone').value,   // the STAGED value; '' clears (V3.78.0/V3.79.0)
    term_from: document.getElementById('mset_term_from').value,   // V3.80.0; '' clears
    term_to: document.getElementById('mset_term_to').value,
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

// ============================================================
// V3.87.0: the settings Calendar card — terms + entries management.
// Everything commits instantly (the V3.79.0 no-Save pattern of the
// Tajweed/Groups cards); rejection repaints from the server's truth.
// ============================================================
async function renderMsetTerms(){
  const host = document.getElementById('msetTermsList');
  if(!host) return;
  let terms = [];
  try{ terms = await apiGetMaktabTerms(); } catch(e){ terms = []; }
  host.innerHTML = '';
  terms.forEach(t => {
    const row = document.createElement('div');
    row.className = 'mset-term-row';
    row.innerHTML = `<input type="text" value="${t.name.replace(/"/g, '&quot;')}" maxlength="40" data-f="name">
      <input type="date" value="${t.term_from}" data-f="term_from">
      <input type="date" value="${t.term_to}" data-f="term_to">
      <button type="button" class="mset-list-x" aria-label="Delete term">&times;</button>`;
    row.querySelectorAll('input').forEach(inp => inp.addEventListener('change', async () => {
      const err = document.getElementById('mset_term_error');
      err.textContent = '';
      try{ await apiUpdateMaktabTerm(t.id, { [inp.dataset.f]: inp.value }); mcalInvalidate(); }
      catch(e){ err.textContent = e.message; await renderMsetTerms(); }
    }));
    row.querySelector('.mset-list-x').addEventListener('click', async () => {
      if(!confirm(`Delete ${t.name}?`)) return;
      try{ await apiDeleteMaktabTerm(t.id); mcalInvalidate(); } catch(e){}
      await renderMsetTerms();
    });
    host.appendChild(row);
  });
  // ADD TERM is the big button only while no terms exist (user);
  // afterwards the small + takes over.
  document.getElementById('mset_term_add_big').classList.toggle('hidden', terms.length > 0);
  document.getElementById('mset_term_add').classList.toggle('hidden', terms.length === 0);
}

async function msetAddTerm(){
  const err = document.getElementById('mset_term_error');
  err.textContent = '';
  const today = appTodayISO();
  try{
    await apiCreateMaktabTerm({ name: 'New term', term_from: today, term_to: today });
    mcalInvalidate();
    await renderMsetTerms();
  } catch(e){ err.textContent = e.message; }
}

async function renderMsetCalList(){
  const host = document.getElementById('msetCalList');
  if(!host) return;
  const year = document.getElementById('mset_cal_year').value;
  let entries = [];
  try{ entries = await apiGetMaktabCalendar(year); } catch(e){ entries = []; }
  host.innerHTML = '';
  entries.forEach(e => {
    const row = document.createElement('div');
    row.className = 'mset-cal-row';
    row.innerHTML = `<input type="date" value="${e.date_from}" data-f="date_from">
      <input type="text" value="${(e.label || '').replace(/"/g, '&quot;')}" maxlength="60" placeholder="Public holiday" data-f="label">
      <span class="mset-cal-type mset-cal-type-${e.type}">${e.type}</span>
      <button type="button" class="mset-list-x" aria-label="Delete entry">&times;</button>`;
    row.querySelectorAll('input').forEach(inp => inp.addEventListener('change', async () => {
      const err = document.getElementById('mset_cal_error');
      err.textContent = '';
      const body = inp.dataset.f === 'date_from'
        ? { date_from: inp.value, date_to: inp.value }   // single-day entries move whole
        : { label: inp.value };
      try{ await apiUpdateMaktabCalEntry(e.id, body); mcalInvalidate(); }
      catch(err2){ err.textContent = err2.message; await renderMsetCalList(); }
    }));
    row.querySelector('.mset-list-x').addEventListener('click', async () => {
      try{ await apiDeleteMaktabCalEntry(e.id); mcalInvalidate(); } catch(e2){}
      await renderMsetCalList();
    });
    host.appendChild(row);
  });
  if(!entries.length) host.innerHTML = '<div class="form-hint">No entries for this year yet.</div>';
}

let msetCalWired = false;
function wireMsetCalendarCard(){
  if(msetCalWired) return;
  msetCalWired = true;
  const yearSel = document.getElementById('mset_cal_year');
  const thisYear = parseInt(appTodayISO().slice(0, 4));
  yearSel.innerHTML = Array.from({ length: 8 }, (_, i) => thisYear - 1 + i)
    .map(y => `<option value="${y}"${y === thisYear ? ' selected' : ''}>${y}</option>`).join('');
  yearSel.addEventListener('change', renderMsetCalList);
  document.getElementById('mset_term_add_big').addEventListener('click', msetAddTerm);
  document.getElementById('mset_term_add').addEventListener('click', msetAddTerm);
  document.getElementById('mset_cal_load_predictions').addEventListener('click', async () => {
    const err = document.getElementById('mset_cal_error');
    err.textContent = '';
    try{
      const r = await apiLoadCalPredictions();
      err.textContent = `${r.added} prediction${r.added === 1 ? '' : 's'} added (2025\u20132030).`;
      mcalInvalidate();
      await renderMsetCalList();
    } catch(e){ err.textContent = e.message; }
  });
  document.getElementById('mset_cal_load_holidays').addEventListener('click', async () => {
    const err = document.getElementById('mset_cal_error');
    err.textContent = '';
    try{
      const r = await apiLoadCalHolidays(parseInt(yearSel.value));
      err.textContent = `${r.added} public holiday${r.added === 1 ? '' : 's'} added for ${r.year}.`;
      mcalInvalidate();
      await renderMsetCalList();
    } catch(e){ err.textContent = e.message; }
  });
  document.getElementById('mset_cal_add').addEventListener('click', async () => {
    const err = document.getElementById('mset_cal_error');
    err.textContent = '';
    const date = document.getElementById('mset_cal_new_date').value;
    const label = document.getElementById('mset_cal_new_label').value.trim();
    if(!date){ err.textContent = 'Pick a date first.'; return; }
    try{
      // blank label = a public holiday (dates only — the user's rule);
      // a label makes it a significant (islamic) day.
      await apiCreateMaktabCalEntry({ date_from: date, date_to: date, label: label || null, type: label ? 'islamic' : 'holiday' });
      document.getElementById('mset_cal_new_date').value = '';
      document.getElementById('mset_cal_new_label').value = '';
      mcalInvalidate();
      await renderMsetCalList();
    } catch(e){ err.textContent = e.message; }
  });
}
