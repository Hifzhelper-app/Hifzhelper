/* Hifzhelper build 4.2.14.1 | js/maktabSummary.js */
// ============================================================
// Hifzhelper -- Maktab summary screen (V3.61.0; first shipped V3.59.0,
// day-entry additions V3.60.0, this UI round from device screenshots
// confirmed in chat 2026-08-16).
// The teacher's view of ONE Hifz day: leading narrow haidh column,
// student names, then Sabaq | Sabaq Dhor | Dhor in the PJ journal's
// own cell shorthand (journalCellShorthand reused directly).
//
// V3.61.0 changes, all user-stated:
//   - DATE PICKER in line with the close icon (V3.50.1
//     native-input-as-tap-target pattern via wireCustomDateDisplay --
//     that pattern exists precisely because showPicker() no-ops on
//     iOS). Defaults to today; picking a past date re-renders the
//     grid for it, and the picked date FOLLOWS THROUGH to the day
//     view (backfill/corrections -- confirmed).
//   - Haidh control moved to its own NARROW LEADING column: a small
//     haidh icon (V3.76.0: a LINK to the student's haidh calendar,
//     showing the date's state; it was the haidh checkbox until then),
//     so the controls line up on the extreme left instead of trailing
//     variable-length names. Rendered ONLY for students with track_haidh (the same
//     Settings opt-in that gates the PJ's Haidh nav item) -- the
//     GLOBAL haidh-gating rule. It sits inside the whole-row tap
//     target, so it stops propagation -- the one deliberate
//     exception to the no-nested-controls rule the count badges
//     follow, because this control is an agreed requirement.
//   - Count badges stay downgraded to plain text (V3.59.0 decision).
// ============================================================

let maktabSummaryData = null;
let maktabSummarySelectedDate = null; // ISO; null until first render (defaults to today)

function maktabTodayISO(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// journalCellShorthand keys sabaqDhor cells on from_surah/from_ayah/
// to_surah/to_ayah and dhor cells on segment_from/segment_to -- the
// maktab tables carry identical columns, so rows pass straight through.
function maktabCellHtml(type, entries){
  const html = journalCellShorthand(type, entries);
  // V3.74.2: the badge is a real button again. It had been downgraded to a
  // span, which is precisely WHY tapping it opened the day view — with no
  // button to catch the tap it fell through to the row. Now it opens a
  // read-only list of that cell's entries and stops there.
  return html.replace(
    /<button type="button" class="entry-count-badge" data-count-badge>(\+\d+)<\/button>/,
    `<button type="button" class="entry-count-badge" data-entry-peek="${type}">$1</button>`
  );
}


// ============================================================
// V4.2.12 / V4.2.12.1 — Summary Quick Log trial + compact card pass.
//
// Desktop/tablet keeps the direct per-cell Quick Log entry points. V4.2.12.1
// compacts all three sheets into the same two-line identity/date header and
// makes Dhor's Portion -> Juz/position/confirm flow read as one short form.
//
// On phones, the whole log area becomes one Quick Log target. The sheet then
// owns a Sabaq | Sabaq Dhor | Dhor selector, so the teacher does not have to
// hit one narrow log cell precisely. Name and attendance remain their own
// explicit destinations and keep stopping propagation.
//
// Writes still reuse the existing maktab log endpoints — no second backend or
// storage model. Dhor keeps the existing atomic pool merge. Sabaq's position
// metadata remains best-effort synced after the saved log.
// ============================================================
let maktabQuickLogState = null;

const MAKTAB_QUICK_LABEL = { sabaq: 'Sabaq', sabaqDhor: 'Sabaq Dhor', dhor: 'Dhor' };
let maktabQuickLogOpenToken = 0;

function maktabQuickEscape(value){
  return String(value == null ? '' : value).replace(/[&<>\"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[ch]));
}

function maktabCloseQuickLog(){
  maktabQuickLogOpenToken++;
  const el = document.getElementById('maktabQuickLogSheet');
  if(el) el.remove();
  maktabQuickLogState = null;
}

function maktabQuickRefForMushaf(mushaf){
  return mushaf === '15line_madani' ? 'uthmani' : 'waterval';
}

function maktabQuickIsMobile(){
  return !!(window.matchMedia && window.matchMedia('(max-width: 767px)').matches);
}

function maktabQuickFormatDate(iso){
  const d = new Date(String(iso || '') + 'T00:00:00');
  if(Number.isNaN(d.getTime())) return String(iso || '');
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]}`;
}

function maktabQuickExistingText(type, entries){
  if(!entries || !entries.length) return '';
  const text = entries.map(e => journalCellShorthand(type, [e]).replace(/<[^>]+>/g, '').trim()).filter(Boolean).join(' · ');
  return text ? `<div class="maktab-quick-existing"><span>Already logged</span>${text}</div>` : '';
}

function maktabQuickTypeDraft(type){
  const state = maktabQuickLogState;
  return state && state.drafts ? state.drafts[type || state.type] : null;
}

function maktabQuickEntries(type){
  const state = maktabQuickLogState;
  if(!state) return [];
  return (state.entriesByType && state.entriesByType[type || state.type]) || [];
}

function maktabQuickVerseField(side, label){
  return `<div class="maktab-quick-range-row">
    <label>${label}</label>
    <div class="verse-ref-field maktab-quick-verse-field">
      <button type="button" class="verse-ref-chevron" data-mql-surah="${side}" aria-label="Choose Surah for ${label}">&#x25B2;&#x25BC;</button>
      <span class="verse-ref-surah-label" id="mql_${side}_surah_label">—</span>
      <span class="verse-ref-ayah-cell">
        <span class="verse-ref-sep">:</span>
        <input type="number" inputmode="numeric" class="verse-ref-ayah" id="mql_${side}_ayah" aria-label="${label} ayah">
      </span>
      <span class="verse-ref-ayah-stepper">
        <button type="button" data-mql-step="${side}:1" aria-label="Increase ${label} ayah">&#x25B2;</button>
        <button type="button" data-mql-step="${side}:-1" aria-label="Decrease ${label} ayah">&#x25BC;</button>
      </span>
    </div>
  </div>`;
}

function maktabQuickConfirmControl(){
  return `<label class="maktab-quick-confirm maktab-quick-confirm-action">
    <input type="checkbox" id="maktabQuickLogConfirm" aria-label="Confirm selection">
    <span>Confirm</span>
  </label>`;
}

function maktabQuickRenderVerse(side){
  const draft = maktabQuickTypeDraft();
  if(!draft) return;
  const value = draft[side];
  const label = document.getElementById(`mql_${side}_surah_label`);
  const input = document.getElementById(`mql_${side}_ayah`);
  if(!label || !input) return;
  if(!value){
    label.textContent = '—'; input.value = ''; input.min = ''; input.max = '';
    return;
  }
  label.textContent = `${value.surah} ${surahName(value.surah)}`;
  input.min = '1'; input.max = String(maxAyahForSurah(value.surah)); input.value = String(value.ayah);
}

function maktabQuickReadVerse(side){
  const draft = maktabQuickTypeDraft();
  if(!draft) return null;
  const current = draft[side];
  const input = document.getElementById(`mql_${side}_ayah`);
  if(!current || !input || !input.value) return null;
  let ayah = parseInt(input.value, 10);
  if(!Number.isFinite(ayah)) return null;
  ayah = Math.max(1, Math.min(maxAyahForSurah(current.surah), ayah));
  draft[side] = { surah: current.surah, ayah };
  input.value = String(ayah);
  return draft[side];
}

function maktabQuickOpenSurahPicker(side){
  const draft = maktabQuickTypeDraft();
  if(!draft) return;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay surah-picker-modal maktab-quick-surah-modal';
  overlay.innerHTML = `<div class="modal-card">
    <button type="button" class="close-btn" aria-label="Close">&times;</button>
    <h2>Choose Surah</h2>
    <div class="surah-picker-list"></div>
  </div>`;
  document.body.appendChild(overlay);
  const list = overlay.querySelector('.surah-picker-list');
  list.innerHTML = SURAHS.map(([num, name]) => `<button type="button" class="tajweed-tag surah-picker-row" data-surah="${num}">${num}. ${name}</button>`).join('');
  list.querySelectorAll('[data-surah]').forEach(btn => btn.addEventListener('click', () => {
    const surah = parseInt(btn.dataset.surah, 10);
    draft[side] = { surah, ayah: 1 };
    maktabQuickRenderVerse(side);
    overlay.remove();
  }));
  overlay.querySelector('.close-btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
}

function maktabQuickWireVerseFields(){
  ['from','to'].forEach(side => {
    const input = document.getElementById(`mql_${side}_ayah`);
    if(input) input.addEventListener('change', () => maktabQuickReadVerse(side));
  });
  document.querySelectorAll('[data-mql-surah]').forEach(btn => btn.addEventListener('click', () => maktabQuickOpenSurahPicker(btn.dataset.mqlSurah)));
  document.querySelectorAll('[data-mql-step]').forEach(btn => btn.addEventListener('click', () => {
    const [side, rawDelta] = btn.dataset.mqlStep.split(':');
    const value = maktabQuickReadVerse(side);
    if(!value) return;
    const next = Math.max(1, Math.min(maxAyahForSurah(value.surah), value.ayah + parseInt(rawDelta, 10)));
    const draft = maktabQuickTypeDraft();
    draft[side] = { surah: value.surah, ayah: next };
    maktabQuickRenderVerse(side);
  }));
}

function maktabQuickDhorControls(){
  const draft = maktabQuickTypeDraft('dhor') || { juz:null, unit:'quarter', position:1 };
  const juzOptions = Array.from({length:30}, (_,i) => `<option value="${i+1}"${draft.juz === i+1 ? ' selected' : ''}>Juz ${i+1}</option>`).join('');
  return `<div class="maktab-quick-dhor-grid">
    <div class="maktab-quick-dhor-primary-row">
      <select id="mql_dhor_juz" aria-label="Juz selector"><option value="">Juz</option>${juzOptions}</select>
      <div class="unit-pill maktab-quick-unit-pill" id="mql_dhor_unit" aria-label="Juz portion">
        <button type="button" data-unit="quarter" class="${draft.unit === 'quarter' ? 'on' : ''}">Quarter</button>
        <button type="button" data-unit="half" class="${draft.unit === 'half' ? 'on' : ''}">Half</button>
        <button type="button" data-unit="full" class="${draft.unit === 'full' ? 'on' : ''}">Juz</button>
      </div>
    </div>
    <div class="maktab-quick-dhor-position-row" id="mql_dhor_position_row">
      <span class="maktab-quick-control-label">Portion number</span>
      <div class="unit-pill maktab-quick-position-pill" id="mql_dhor_position" aria-label="Portion number"></div>
    </div>
  </div>`;
}

function maktabQuickRenderDhorPosition(){
  const draft = maktabQuickTypeDraft('dhor');
  const pill = document.getElementById('mql_dhor_position');
  if(!draft || !pill) return;
  const unit = draft.unit || 'quarter';
  const row = document.getElementById('mql_dhor_position_row');
  if(unit === 'full'){
    pill.classList.add('hidden');
    if(row) row.classList.add('hidden');
    draft.position = 1;
    return;
  }
  pill.classList.remove('hidden');
  if(row) row.classList.remove('hidden');
  const count = unit === 'half' ? 2 : 4;
  if(draft.position > count) draft.position = 1;
  pill.innerHTML = Array.from({length:count}, (_,i) => `<button type="button" data-pos="${i+1}" class="${draft.position === i+1 ? 'on' : ''}">${i+1}</button>`).join('');
  pill.querySelectorAll('[data-pos]').forEach(btn => btn.addEventListener('click', () => {
    draft.position = parseInt(btn.dataset.pos, 10);
    maktabQuickRenderDhorPosition();
  }));
}

function maktabQuickWireDhor(){
  const draft = maktabQuickTypeDraft('dhor');
  if(!draft) return;
  const juz = document.getElementById('mql_dhor_juz');
  if(juz) juz.addEventListener('change', () => { draft.juz = parseInt(juz.value, 10) || null; });
  document.querySelectorAll('#mql_dhor_unit [data-unit]').forEach(btn => btn.addEventListener('click', () => {
    draft.unit = btn.dataset.unit;
    draft.position = 1;
    document.querySelectorAll('#mql_dhor_unit [data-unit]').forEach(b => b.classList.toggle('on', b === btn));
    maktabQuickRenderDhorPosition();
  }));
  maktabQuickRenderDhorPosition();
}

function maktabQuickBodyHtml(type){
  if(type === 'dhor') return maktabQuickDhorControls();
  return `<div class="maktab-quick-range-grid">${maktabQuickVerseField('from', 'Ayah From')}${maktabQuickVerseField('to', 'Ayah To')}</div>`;
}

function maktabQuickRenderBody(){
  const state = maktabQuickLogState;
  if(!state) return;
  const existing = document.getElementById('maktabQuickExisting');
  const body = document.getElementById('maktabQuickBody');
  const err = document.getElementById('maktabQuickLogError');
  if(existing) existing.innerHTML = maktabQuickExistingText(state.type, maktabQuickEntries(state.type));
  if(body) body.innerHTML = maktabQuickBodyHtml(state.type);
  if(err) err.textContent = '';
  document.querySelectorAll('[data-mql-type]').forEach(btn => btn.classList.toggle('on', btn.dataset.mqlType === state.type));
  if(state.type === 'dhor') maktabQuickWireDhor();
  else {
    maktabQuickWireVerseFields();
    maktabQuickRenderVerse('from');
    maktabQuickRenderVerse('to');
  }
}

function maktabQuickTypeSelector(){
  return `<div class="unit-pill maktab-quick-type-switch" id="maktabQuickTypeSwitch" aria-label="Quick Log type">
    <button type="button" data-mql-type="sabaq">Sabaq</button>
    <button type="button" data-mql-type="sabaqDhor">Sabaq Dhor</button>
    <button type="button" data-mql-type="dhor">Dhor</button>
  </div>`;
}

async function maktabQuickPost(path, payload, duplicateLabel){
  let result = await apiFetch(path, { method: 'POST', body: JSON.stringify(payload) });
  if(result && result.isDuplicate && !result.id){
    const proceed = confirm(`${duplicateLabel} has already been saved. Select OK to save it again or CANCEL to abort.`);
    if(!proceed) return null;
    result = await apiFetch(path, { method: 'POST', body: JSON.stringify(Object.assign({}, payload, { force: true })) });
  }
  return result;
}

async function maktabQuickSyncSabaqPosition(studentId, oldEntries, ref){
  try{
    const row = await apiGetMaktabPosition(studentId);
    let position = {};
    try{ position = row && row.position_json ? (JSON.parse(row.position_json) || {}) : {}; } catch(e){ position = {}; }
    const oldFrontier = computeActualSabaqFrontier(oldEntries || [], ref);
    const freshEntries = await apiGetMaktabSabaq(studentId);
    const newFrontier = computeActualSabaqFrontier(freshEntries || [], ref);
    const next = advancePositionAfterSabaq(position, oldFrontier, newFrontier, ref);
    delete next.sabaqTo; delete next.activeJuz;
    await apiSaveMaktabPosition(studentId, JSON.stringify(next), null);
  } catch(e){ /* best effort, matching the full Sabaq card */ }
}

async function maktabSaveQuickLog(){
  const state = maktabQuickLogState;
  if(!state) return;
  const err = document.getElementById('maktabQuickLogError');
  const save = document.getElementById('maktabQuickLogSave');
  const confirmBox = document.getElementById('maktabQuickLogConfirm');
  if(err) err.textContent = '';
  if(!confirmBox || !confirmBox.checked){
    if(err) err.textContent = 'Please confirm the selection before saving.';
    return;
  }
  let path, payload, duplicateLabel = MAKTAB_QUICK_LABEL[state.type];
  if(state.type === 'sabaq' || state.type === 'sabaqDhor'){
    const from = maktabQuickReadVerse('from');
    const to = maktabQuickReadVerse('to');
    if(!from || !to){ if(err) err.textContent = 'Please set both Ayah From and Ayah To.'; return; }
    if(state.type === 'sabaq' && !crossesAtMostOneJuzBoundary(from.surah, from.ayah, to.surah, to.ayah, state.ref)){
      if(err) err.textContent = "This Sabaq range crosses more than one juz' boundary — please split it into separate entries.";
      return;
    }
    if(state.type === 'sabaq'){
      path = '/maktab/sabaq';
      payload = { student_id: state.student.id, date: state.date, sabaq_from: formatVerseRef(from.surah, from.ayah), sabaq_to: formatVerseRef(to.surah, to.ayah) };
    } else {
      path = '/maktab/sabaq-dhor';
      payload = { student_id: state.student.id, date: state.date, from_surah: from.surah, from_ayah: from.ayah, to_surah: to.surah, to_ayah: to.ayah };
    }
  } else {
    const draft = maktabQuickTypeDraft('dhor');
    const juzEl = document.getElementById('mql_dhor_juz');
    const juz = parseInt(juzEl && juzEl.value, 10) || (draft && draft.juz);
    if(!juz){ if(err) err.textContent = 'Please select a Juz.'; return; }
    if(draft) draft.juz = juz;
    const unit = (draft && draft.unit) || 'quarter';
    const unitName = unit === 'full' ? 'juz' : unit;
    const position = unit === 'full' ? 1 : ((draft && draft.position) || 1);
    const seg = segmentRangeForUnitIndex(juz, position, state.ref, unit === 'full' ? 'juz' : unit);
    path = '/maktab/dhor';
    payload = { student_id: state.student.id, date: state.date, segment_from: seg.segment_from, segment_to: seg.segment_to, ref: state.ref };
    duplicateLabel = unit === 'full' ? `Juz ${juz}` : `Juz ${juz} ${unitName} ${position}`;
  }
  try{
    if(save) save.disabled = true;
    let oldSabaqHistory = null;
    if(state.type === 'sabaq'){
      try{ oldSabaqHistory = await apiGetMaktabSabaq(state.student.id); } catch(e){ oldSabaqHistory = []; }
    }
    const result = await maktabQuickPost(path, payload, duplicateLabel);
    if(!result) return;
    if(state.type === 'sabaq') await maktabQuickSyncSabaqPosition(state.student.id, oldSabaqHistory, state.ref);
    maktabCloseQuickLog();
    await renderMaktabSummaryScreen();
  } catch(e){
    if(err) err.textContent = "Couldn't save: " + e.message;
  } finally {
    const liveSave = document.getElementById('maktabQuickLogSave');
    if(liveSave) liveSave.disabled = false;
  }
}

async function maktabOpenQuickLog(student, date, type, entries, entriesByType){
  maktabCloseQuickLog();
  const openToken = ++maktabQuickLogOpenToken;
  let settings = null;
  try{ settings = typeof loadMaktabSettings === 'function' ? await loadMaktabSettings() : await apiGetMaktabSettings(); } catch(e){ settings = null; }
  if(openToken !== maktabQuickLogOpenToken) return;
  const combined = maktabQuickIsMobile();
  const entryMap = entriesByType || { sabaq: [], sabaqDhor: [], dhor: [] };
  if(!entriesByType) entryMap[type] = (entries || []).slice();
  maktabQuickLogState = {
    student, date, type, combined,
    entriesByType: {
      sabaq: (entryMap.sabaq || []).slice(),
      sabaqDhor: (entryMap.sabaqDhor || []).slice(),
      dhor: (entryMap.dhor || []).slice()
    },
    drafts: {
      sabaq: { from:null, to:null },
      sabaqDhor: { from:null, to:null },
      dhor: { juz:null, unit:'quarter', position:1 }
    },
    ref: maktabQuickRefForMushaf(settings && settings.mushaf)
  };
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay maktab-quick-log-modal';
  overlay.id = 'maktabQuickLogSheet';
  const desktopHeading = `<span class="maktab-quick-kind">${MAKTAB_QUICK_LABEL[type]} :</span>`;
  overlay.innerHTML = `<div class="modal-card maktab-quick-log-card" role="dialog" aria-modal="true" aria-label="Quick Log">
    <button type="button" class="close-btn" aria-label="Close">&times;</button>
    <div class="maktab-quick-heading${combined ? ' is-combined' : ''}">
      ${combined ? '' : desktopHeading}
      <span class="maktab-name-pill maktab-quick-student" title="${maktabQuickEscape(student.name)}">${maktabQuickEscape(student.name)}</span>
    </div>
    <div class="maktab-quick-date-row"><span class="maktab-quick-date">${maktabQuickEscape(maktabQuickFormatDate(date))}</span></div>
    ${combined ? maktabQuickTypeSelector() : ''}
    <div id="maktabQuickExisting"></div>
    <div id="maktabQuickBody"></div>
    <div class="form-error" id="maktabQuickLogError"></div>
    <div class="maktab-quick-actions">
      ${maktabQuickConfirmControl()}
      <button type="button" class="primary maktab-quick-save" id="maktabQuickLogSave">Save</button>
      <button type="button" class="maktab-quick-details" id="maktabQuickLogDetails">Detail</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.close-btn').addEventListener('click', maktabCloseQuickLog);
  overlay.addEventListener('click', e => { if(e.target === overlay) maktabCloseQuickLog(); });
  document.getElementById('maktabQuickLogSave').addEventListener('click', maktabSaveQuickLog);
  document.getElementById('maktabQuickLogDetails').addEventListener('click', () => {
    const snapshot = maktabQuickLogState;
    maktabCloseQuickLog();
    openMaktabDay({ id: snapshot.student.id, name: snapshot.student.name, mushaf: snapshot.student.mushaf || null, track_haidh: !!snapshot.student.track_haidh }, snapshot.date, snapshot.type);
  });
  document.querySelectorAll('[data-mql-type]').forEach(btn => btn.addEventListener('click', () => {
    if(!maktabQuickLogState) return;
    maktabQuickLogState.type = btn.dataset.mqlType;
    maktabQuickRenderBody();
  }));
  maktabQuickRenderBody();
}

// A read-only peek at every entry in one cell — including the one already
// shown, so the list is the whole truth rather than "the others".
// Deliberately not tappable: the row still opens the day view, so no route
// is lost, and this stays a glance rather than a second way in.
function maktabCloseEntryPeek(){
  const el = document.getElementById('maktabEntryPeek');
  if(el) el.remove();
}

function maktabOpenEntryPeek(btn, type, entries){
  maktabCloseEntryPeek();
  const panel = document.createElement('div');
  panel.id = 'maktabEntryPeek';
  panel.className = 'maktab-entry-peek';
  panel.innerHTML = (entries || []).map(e =>
    `<div class="maktab-entry-peek-row">${journalCellShorthand(type, [e]).replace(/<[^>]+>/g, '')}</div>`
  ).join('') || '<div class="maktab-entry-peek-row">No entries</div>';
  document.body.appendChild(panel);
  const r = btn.getBoundingClientRect();
  // Anchored to the badge, flipped up when there is no room below —
  // summary rows sit near the bottom of the card on a short screen.
  const below = window.innerHeight - r.bottom;
  panel.style.left = Math.min(r.left, window.innerWidth - panel.offsetWidth - 8) + 'px';
  if(below < panel.offsetHeight + 12){
    panel.style.top = (r.top - panel.offsetHeight - 6) + 'px';
  } else {
    panel.style.top = (r.bottom + 6) + 'px';
  }
}

// V3.78.0 (item 9): search-to-student. Rebuilt each render with that
// render's roster and picked date, so a result always opens the day the
// summary is showing. The input keeps its text across renders (the render
// replaces only the results and the handler's data).
let maktabSearchWired = false;
function wireMaktabSummarySearch(students, date){
  const input = document.getElementById('maktabSummarySearch');
  const results = document.getElementById('maktabSummarySearchResults');
  if(!input || !results) return;
  input._students = students;
  input._date = date;
  if(maktabSearchWired) return;
  maktabSearchWired = true;
  const render = () => {
    const q = input.value.trim().toLowerCase();
    if(!q){ results.classList.add('hidden'); results.innerHTML = ''; return; }
    const matches = (input._students || []).filter(s => s.name.toLowerCase().includes(q)).slice(0, 8);
    results.innerHTML = '';
    if(!matches.length){
      const d = document.createElement('div');
      d.className = 'maktab-search-empty';
      d.textContent = 'No matching student.';
      results.appendChild(d);
    }
    matches.forEach(stu => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'maktab-search-result';
      btn.textContent = stu.name + (stu.group_name ? ' · ' + stu.group_name : '');
      btn.addEventListener('click', () => {
        input.value = '';
        results.classList.add('hidden');
        results.innerHTML = '';
        input.classList.add('hidden');                                    // V3.84.0: back to the label
        document.getElementById('maktabSummarySearchToggle').classList.remove('hidden');
        openMaktabDay(stu, input._date);
      });
      results.appendChild(btn);
    });
    results.classList.remove('hidden');
  };
  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  // V3.84.0: tap-to-reveal — the green Student header cell is a label
  // until tapped; the tap swaps in the input (sized to the cell) and
  // focuses it. Esc, or a tap anywhere outside the cell, restores the
  // label and clears any open results. The reveal choice (vs an
  // always-visible field) was left to Claude and is easy to flip.
  const toggle = document.getElementById('maktabSummarySearchToggle');
  const restore = () => {
    input.classList.add('hidden');
    toggle.classList.remove('hidden');
    results.classList.add('hidden');
  };
  toggle.addEventListener('click', () => {
    toggle.classList.add('hidden');
    input.classList.remove('hidden');
    input.focus();
  });
  input.addEventListener('keydown', (e) => { if(e.key === 'Escape'){ input.value = ''; restore(); } });
  document.addEventListener('click', (e) => {
    if(!e.target.closest || (!e.target.closest('.maktab-search-cell'))){
      if(!input.classList.contains('hidden') || !results.classList.contains('hidden')) restore();
    }
  });
}

// V3.75.0 (item 4): this listener only CLOSES the peek now. Opening moved
// onto the badge button itself (see the render below) — delegated here it
// ran after the <tr>'s own click handler and could not stop the day view
// opening. A badge click never reaches document (the button stops it), so
// the click-away close cannot fire against the badge that just opened it.
document.addEventListener('click', (e) => {
  if(!e.target.closest || !e.target.closest('#maktabEntryPeek')) maktabCloseEntryPeek();
});

// V4.2.12.1 — Summary ordering is based on the DISPLAYED day, not
// historical attendance. A real log is the strongest state. Logged students
// are grouped by Group then first name; confirmed Haidh and the remainder are
// each plain first-name alphabetical bands. Haidh ordering is fed only by
// the normalized Attendance read; raw attendance rows are never consulted.
function maktabSummaryNameKey(student){
  const full = String((student && student.name) || '').trim();
  const first = (full.split(/\s+/)[0] || '').toLocaleLowerCase();
  return { first, full: full.toLocaleLowerCase(), id: String((student && student.id) || '').toLocaleLowerCase() };
}

function maktabSummaryHasLog(studentId, byStudent){
  return ['sabaq', 'sabaqDhor', 'dhor'].some(type => ((byStudent[type] && byStudent[type][studentId]) || []).length > 0);
}

function maktabSummarySortBand(student, byStudent, haidhByStudent){
  if(maktabSummaryHasLog(student.id, byStudent)) return 0;
  if(haidhByStudent[student.id] === 'haidh') return 1;
  return 2;
}

function maktabSummaryCompareName(a, b){
  const aa = maktabSummaryNameKey(a), bb = maktabSummaryNameKey(b);
  return aa.first.localeCompare(bb.first, undefined, { sensitivity:'base', numeric:true })
    || aa.full.localeCompare(bb.full, undefined, { sensitivity:'base', numeric:true })
    || aa.id.localeCompare(bb.id, undefined, { sensitivity:'base', numeric:true });
}

function maktabSummaryCompareGroup(a, b){
  const ga = String(a.group_name || '').trim();
  const gb = String(b.group_name || '').trim();
  if(!ga && gb) return 1;
  if(ga && !gb) return -1;
  return ga.localeCompare(gb, undefined, { sensitivity:'base', numeric:true });
}

function maktabSummarySortedStudents(students, byStudent, haidhByStudent){
  return (students || []).slice().sort((a, b) => {
    const ab = maktabSummarySortBand(a, byStudent, haidhByStudent);
    const bb = maktabSummarySortBand(b, byStudent, haidhByStudent);
    if(ab !== bb) return ab - bb;
    if(ab === 0){
      const groupCmp = maktabSummaryCompareGroup(a, b);
      if(groupCmp) return groupCmp;
    }
    return maktabSummaryCompareName(a, b);
  });
}

function maktabSummaryWireDate(){
  const input = document.getElementById('maktabSummaryDatePicker');
  if(!input) return;
  if(!input.value) input.value = maktabSummarySelectedDate || maktabTodayISO();
  if(typeof wireCustomDateDisplay === 'function') wireCustomDateDisplay('maktabSummaryDatePicker');
  if(!input.dataset.maktabWired){
    input.dataset.maktabWired = 'true';
    input.addEventListener('change', () => {
      if(!input.value) return;
      maktabSummarySelectedDate = input.value;
      renderMaktabSummaryScreen();
    });
  }
}

async function renderMaktabSummaryScreen(){
  const host = document.getElementById('maktabSummaryBody');
  if(!maktabSummarySelectedDate) maktabSummarySelectedDate = maktabTodayISO();
  const date = maktabSummarySelectedDate;
  maktabSummaryWireDate();
  const input = document.getElementById('maktabSummaryDatePicker');
  // programmatic sets keep the display pill in sync automatically --
  // wireCustomDateDisplay intercepts the value setter (the 2026-08-04
  // fix in customDate.js), no event needed.
  if(input && input.value !== date) input.value = date;

  // V4.2.5 (user): the names appeared only after the round trips finished,
  // though they have nothing to do with the day's data. The last roster is
  // cached and painted IMMEDIATELY — names, their pills and the attendance
  // icon — with the log cells left blank and a loading strip under the
  // header; the cells fill when the responses land.
  //
  // Deliberately the ROSTER ONLY, never the log cells: names change
  // rarely, a day's entries change constantly, and a stale entry on
  // screen is worse than a wait because a teacher could act on it.
  // Deliberately in MEMORY, not localStorage: it covers returning to the
  // screen within a session without leaving a maktab's student names on a
  // shared or borrowed device. A cold start still waits once.
  if(maktabRosterCache && maktabRosterCache.length){
    maktabSummaryPaintSkeleton(host, maktabRosterCache);
  } else {
    host.innerHTML = '<tr><td colspan="5" class="journal-cell journal-cell-empty">Loading\u2026</td></tr>';
  }
  maktabSummarySetLoading(true);

  // V3.59.1: respond() UNWRAPS on the worker (json(result.data)) -- the
  // response body IS the payload, no {data:...} envelope on the wire.
  // Shape-guarded so ANY malformed response renders the error row.
  let data, loadErr = null;
  try {
    data = await apiMaktabSummary(date);
  } catch (e) {
    data = null;
    loadErr = e;
  }
  if (!data || !Array.isArray(data.students)) {
    // V3.75.0 (item 6): carry the worker's message rather than a fixed
    // line. Set via textContent, so a message containing markup is text.
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'journal-cell journal-cell-empty';
    td.textContent = 'Could not load the maktab summary: ' + ((loadErr && loadErr.message) || 'unexpected response');
    maktabSummarySetLoading(false);   // V4.2.5
    host.innerHTML = '';
    const tr = document.createElement('tr'); tr.appendChild(td); host.appendChild(tr);
    return;
  }
  maktabSummaryData = data;
  maktabRosterCache = (data.students || []).map(s => ({ id: s.id, name: s.name, track_haidh: s.track_haidh }));   // V4.2.5

  // group each table's rows by student for O(1) cell lookup
  const byStudent = { sabaq: {}, sabaqDhor: {}, dhor: {} };
  (data.sabaq || []).forEach(r => (byStudent.sabaq[r.student_id] = byStudent.sabaq[r.student_id] || []).push(r));
  (data.sabaq_dhor || []).forEach(r => (byStudent.sabaqDhor[r.student_id] = byStudent.sabaqDhor[r.student_id] || []).push(r));
  (data.dhor || []).forEach(r => (byStudent.dhor[r.student_id] = byStudent.dhor[r.student_id] || []).push(r));

  // V4.2.14: consume the SAME normalized Attendance model used by the
  // register/calendar. There is deliberately no raw-Haidh fallback: if this
  // request fails, Summary omits Haidh state rather than surfacing stale data.
  let derived = {};
  let isMaktabDay = false;
  const haidhByStudent = {};
  try {
    const att = await apiGetMaktabAttendance(date);
    if(att && att.attendance){
      derived = att.attendance;
      isMaktabDay = !!att.isMaktabDay;
      Object.entries(derived).forEach(([studentId, state]) => {
        if(state && (state.status === 'haidh' || state.status === 'predicted-haidh')) haidhByStudent[studentId] = state.status;
      });
    }
  } catch(e){ derived = {}; }

  host.innerHTML = '';
  const sortedStudents = maktabSummarySortedStudents(data.students || [], byStudent, haidhByStudent);
  // V4.2.12.1: group spacing belongs only to the LOGGED band, because that
  // is the only band whose requested order is Group -> first name. Confirmed
  // Haidh and the remaining students are deliberately plain alphabetical
  // lists, so applying group gaps there would imply a grouping that is not
  // part of their sort rule.
  let prevGroup = null;
  let prevBand = null;
  sortedStudents.forEach((stu, i) => {
    const band = maktabSummarySortBand(stu, byStudent, haidhByStudent);
    const groupKey = stu.group_name || null;
    if(i > 0 && band === 0 && prevBand === 0 && groupKey !== prevGroup){
      const gap = document.createElement('tr');
      gap.className = 'maktab-group-gap';
      gap.setAttribute('aria-hidden', 'true');
      const gtd = document.createElement('td');
      gtd.colSpan = 5;
      gap.appendChild(gtd);
      host.appendChild(gap);
    }
    prevBand = band;
    prevGroup = band === 0 ? groupKey : null;
    const tr = document.createElement('tr');
    tr.className = 'maktab-summary-row';

    // V3.61.0: leading narrow haidh column -- small haidh icon, ONLY for
    // haidh-tracking students (empty cell otherwise so the grid stays
    // aligned).
    // V3.76.0 (Phase 2): it is a LINK now, not a toggle. It still shows the
    // date's state (.marked), but tapping it opens the shared haidh calendar
    // for this student, on the month of the picked date, where haidh is
    // marked as a range. The single-day toggle with its 15-day confirm is
    // deleted (js/maktabDay.js). stopPropagation stays: the row itself
    // still opens the day view.
    // V3.80.0: the leading icon is ATTENDANCE, on EVERY student (was the
    // haidh icon, haa'idah only). V4.2.14.1 turns it into Quick Attendance;
    // the sheet's Detail action opens the full page/Haidh calendar.
    const haidhTd = document.createElement('td');
    haidhTd.className = 'maktab-haidh-col';
    const btn = document.createElement('button');
    btn.type = 'button';
    // V4.2.14.1: the attendance icon is a QUICK ACTION. The sheet can mark
    // Present / confirmed Haidh / Absent for the summary's selected date;
    // its Detail action preserves the route to the full Attendance page.
    btn.className = 'maktab-haidh-check';
    btn.innerHTML = iconHtml('attendance');
    btn.setAttribute('aria-label', 'Quick attendance for ' + stu.name);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      maktabOpenQuickAttendance(stu, date, { afterSave: () => renderMaktabSummaryScreen() });
    });
    haidhTd.appendChild(btn);
    tr.appendChild(haidhTd);

    const nameTd = document.createElement('td');
    nameTd.className = 'cell-date maktab-student-name';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'maktab-name-pill';   // V4.2.0 (user): reads as the button it already is
    nameSpan.textContent = stu.name;
    // V4.2.8 (user): every pill has the same width; long names are
    // visually ellipsised by CSS, so keep the full name available on hover.
    nameSpan.title = stu.name;
    nameTd.appendChild(nameSpan);
    // V3.85.0 (was V3.82.0's rail card): tapping the NAME opens her
    // STANDALONE student summary page; the rest of the row keeps opening
    // the day view, and each log cell routes to its own card (below).
    nameTd.addEventListener('click', (e) => {
      e.stopPropagation();
      openStudentSummaryPage({ id: stu.id, name: stu.name, mushaf: stu.mushaf || null, track_haidh: !!stu.track_haidh }, date);
    });
    // V3.72.0: the Setup chip is GONE from this row. Setup opens from the
    // Dhor card's own button now — it configures the Dhor pool and nothing
    // else, so it belongs with Dhor rather than on a row spanning all three
    // log types. The V3.66.0 concern that made it a small explicit control
    // (saving REPLACES her pool, so it must not be reachable by a mis-tap
    // meant for the day view) is satisfied differently: it is no longer on
    // the tappable row at all.
    tr.appendChild(nameTd);

    const hasAnyLog = ['sabaq', 'sabaqDhor', 'dhor'].some(t => (byStudent[t][stu.id] || []).length);
    const CELL_LABEL = { sabaq: 'Sabaq', sabaqDhor: 'Sabaq Dhor', dhor: 'Dhor' };
    ['sabaq', 'sabaqDhor', 'dhor'].forEach(type => {
      const td = document.createElement('td');
      td.className = 'journal-cell';
      td.setAttribute('data-label', CELL_LABEL[type]);   // V4.2.2: the mobile card's caption
      const d = derived[stu.id];
      // V4.2.14: the pink Haidh note is removed. Haidh may still affect the
      // normalized sort/attendance result, but the Sabaq cell stays visually
      // empty unless there is an explicit Absent result.
      if(type === 'sabaq' && !hasAnyLog && d && d.status === 'absent'){
        td.className = 'journal-cell journal-cell-absent';
        td.textContent = 'Absent';
      } else {
        // V4.2.8 / item 68: one summary-only wrapper makes the value +
        // its +N badge ONE grid item on mobile. Keep maktabCellHtml itself
        // unchanged because Maktab Journal reuses that helper too.
        td.innerHTML = `<span class="maktab-summary-cell-value">${maktabCellHtml(type, byStudent[type][stu.id])}</span>`;
        // V3.74.2: the peek reads its entries from the cell rather than
        // re-querying — the rows are already here, and re-deriving them
        // from the DOM would be parsing text back into data.
        td._peekEntries = byStudent[type][stu.id];
        // V3.75.0 (item 4): wired DIRECTLY on the badge. V3.74.2 handled it
        // by delegation on document, but the row's day-view handler is on
        // the <tr> itself — so during bubbling the row fired FIRST and
        // opened the day view, and the stopPropagation at document level
        // came too late to matter. A listener on the button runs before
        // the tap ever reaches the row. The rows are rebuilt on every
        // render, so this cannot leak: the old buttons go with the old
        // rows.
        const peekBtn = td.querySelector('[data-entry-peek]');
        if(peekBtn){
          peekBtn.addEventListener('click', (e) => {
            e.stopPropagation();   // must NOT reach the row's day-view nav
            maktabOpenEntryPeek(peekBtn, type, td._peekEntries);
          });
        }
      }
      // V4.2.12: a log cell is now the Quick Log trigger. The full detail
      // card is still available from inside the sheet; the +N peek keeps
      // stopping propagation above, so inspecting existing entries never
      // accidentally opens a new-entry sheet.
      td.addEventListener('click', (e) => {
        e.stopPropagation();
        const entriesByType = {
          sabaq: byStudent.sabaq[stu.id] || [],
          sabaqDhor: byStudent.sabaqDhor[stu.id] || [],
          dhor: byStudent.dhor[stu.id] || []
        };
        maktabOpenQuickLog(
          { id: stu.id, name: stu.name, mushaf: stu.mushaf || null, track_haidh: !!stu.track_haidh },
          date, type, entriesByType[type], entriesByType
        );
      });
      tr.appendChild(td);
    });

    // attention flag: the row is tinted when a student has gone
    // absence_flag_days consecutive MAKTAB DAYS without an entry.
    if(derived[stu.id] && derived[stu.id].flagged) tr.classList.add('maktab-row-flagged');

    // whole row = one tap target (confirmed); carries the PICKED date
    // so past-day rows open the day view for that day (confirmed).
    // V3.64.0: opens the PJ's OWN day view with a maktab context — not a
    // maktab copy of it. See js/logContext.js.
    tr.addEventListener('click', () => {
      const student = { id: stu.id, name: stu.name, mushaf: stu.mushaf || null, track_haidh: !!stu.track_haidh };
      if(maktabQuickIsMobile()){
        const entriesByType = {
          sabaq: byStudent.sabaq[stu.id] || [],
          sabaqDhor: byStudent.sabaqDhor[stu.id] || [],
          dhor: byStudent.dhor[stu.id] || []
        };
        maktabOpenQuickLog(student, date, 'sabaq', entriesByType.sabaq, entriesByType);
      } else {
        openMaktabDay(student, date);
      }
    });
    host.appendChild(tr);
  });
  // Search follows the visible ordering for predictable results, while its
  // destination remains the student's full day view on the selected date.
  wireMaktabSummarySearch(sortedStudents, date);

  if (!(data.students || []).length) {
    host.innerHTML = '<tr><td colspan="5" class="journal-cell journal-cell-empty">No active students.</td></tr>';
  }
}

// ============================================================
// V4.2.5 — the roster cache, the skeleton paint and the loading strip.
// ============================================================
let maktabRosterCache = null;

function maktabSummarySetLoading(on){
  const row = document.querySelector('.maktab-summary-headers');
  if(!row) return;
  row.classList.toggle('is-loading', !!on);
}

// The cached paint: real names in real pills with the attendance icon, and
// EMPTY log cells — never stale ones. Deliberately not wired for taps: the
// row's handlers are attached by the real render a moment later, and a tap
// on a half-drawn row would open a card whose data has not arrived.
function maktabSummaryPaintSkeleton(host, roster){
  host.innerHTML = '';
  roster.forEach(stu => {
    const tr = document.createElement('tr');
    tr.className = 'journal-row maktab-summary-skeleton-row';
    const haidhTd = document.createElement('td');
    haidhTd.className = 'maktab-haidh-col';
    // V4.2.8.2: never paint iconHtml('attendance') naked. The real row
    // sizes that SVG through .maktab-haidh-check; the cached instant-name
    // paint used to omit the wrapper, so Safari briefly rendered the SVG at
    // its intrinsic/available size before fresh data replaced the row. Use
    // the same visual wrapper here (non-interactive until the real render).
    const attendanceGhost = document.createElement('span');
    attendanceGhost.className = 'maktab-haidh-check maktab-summary-skeleton-attendance';
    attendanceGhost.setAttribute('aria-hidden', 'true');
    attendanceGhost.innerHTML = typeof iconHtml === 'function' ? iconHtml('attendance') : '';
    haidhTd.appendChild(attendanceGhost);
    tr.appendChild(haidhTd);
    const nameTd = document.createElement('td');
    nameTd.className = 'cell-date maktab-student-name';
    const span = document.createElement('span');
    span.className = 'maktab-name-pill';
    span.textContent = stu.name;
    span.title = stu.name;
    nameTd.appendChild(span);
    tr.appendChild(nameTd);
    ['sabaq', 'sabaqDhor', 'dhor'].forEach(type => {
      const td = document.createElement('td');
      td.className = 'journal-cell';
      td.setAttribute('data-label', { sabaq: 'Sabaq', sabaqDhor: 'Sabaq Dhor', dhor: 'Dhor' }[type]);
      td.innerHTML = '<span class="journal-cell-skeleton"></span>';
      tr.appendChild(td);
    });
    host.appendChild(tr);
  });
}
