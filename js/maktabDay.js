// ============================================================
// Hifzhelper -- Maktab day view (V3.61.0; first shipped V3.60.0, this
// UI round from device screenshots confirmed in chat 2026-08-16).
// The teacher's entry screen for ONE student's Hifz day: three cards
// in the PJ LOG-CARD FORMAT (user-stated: "copy the format of the PJ
// log cards exactly" -- .log-detail-card/.card-scroll/.card-header-row
// chrome with the Save button in the header), the student's NAME as
// the first row of each card, above the header.
//
// V3.61.0 changes, all user-stated unless noted:
//   - Cards restyled to the PJ chrome (above). Field style inside
//     stays plain inputs -- the format is the card chrome; the PJ's
//     verse-ref pickers remain welded to PJ page state (the standing
//     V3.60.0 decision; picker polish is a later item).
//   - DATE follows the summary's picker (confirmed): renders, prepop
//     calcs, every PJ fetch, and saves all key on the date the row
//     was tapped under -- backfilling/corrections on past days.
//   - The "Mark haidh" button is REMOVED from this screen -- haidh
//     marking lives ONLY on the summary's leading checkbox column
//     now. Claude's stated reading, unchallenged: the read-only
//     "marked haidh in her journal" banner STAYS (information, not a
//     marking control), and it too is gated on track_haidh.
//   - Teacher's note sits ABOVE the student's note.
//   - Teacher-note visibility: radio-style Public / Teachers /
//     Private, pick one, styled SMALL -- one slim inline line above
//     the teacher's note box, no row of its own (confirmed). Default
//     Teachers (teachers_only), the standing agreement.
//   - Student's note is VIEW-ONLY and rendered only when there IS
//     one (a non-private PJ note for this date/type). It freezes
//     into the maktab row on save exactly as displayed -- it is not
//     the teacher's to edit.
//
// PJ use is OPTIONAL (standing rule): every PJ fetch here treats an
// empty result as the NORMAL case, never an error.
// ============================================================

let maktabDayStudent = null; // { id, name, mushaf, track_haidh } — all ride the roster row
let maktabDayDate = null;    // ISO — follows the summary's picker (confirmed)
let maktabDayEditing = { sabaq: null, sabaqDhor: null, dhor: null }; // existing entry id being edited, per type

function maktabDayEsc(s){ const d = document.createElement('span'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

// ---- sabaq prepop: maktab frontier + the one-way PJ sabaq_to extension ----
function maktabVerseKeyFurther(a, b, ref){
  // mirrors computeActualSabaqFrontier's direction rule: juz' 30 studies
  // DOWNWARD through the surahs, everywhere else ascends.
  const juz = getJuzForPosition(a.surah, a.ayah, ref);
  const cmp = compareVerseKey(a.surah, a.ayah, b.surah, b.ayah);
  return juz === 30 ? cmp < 0 : cmp > 0;
}
function maktabSabaqPrepop(maktabEntries, pjEntries, ref, hasMaktabDhor){
  const maktabFrontier = computeActualSabaqFrontier(maktabEntries, ref);
  const d = nextSabaqDefaults(maktabFrontier, ref, hasMaktabDhor);
  if(!d.from) return d; // juz' complete / deliberate no-prepop — PJ never overrides a deliberate blank
  const pjFrontier = computeActualSabaqFrontier(pjEntries, ref);
  if(pjFrontier && maktabVerseKeyFurther(pjFrontier, d.to, ref)){
    // extend TO only — from, and everything else, stays maktab-derived
    return { from: d.from, to: { surah: pjFrontier.surah, ayah: pjFrontier.ayah } };
  }
  return d;
}

// ---- haidh gap check (pure, harness-tested) ----
function maktabHaidhGapDays(attendanceRows, todayIso){
  const prior = (attendanceRows || [])
    .filter(r => (r.status === 'haidh' || r.status === 'predicted-haidh') && r.date < todayIso)
    .map(r => r.date).sort();
  if(!prior.length) return null;
  const last = prior[prior.length - 1];
  return Math.round((new Date(todayIso + 'T00:00:00Z') - new Date(last + 'T00:00:00Z')) / 86400000);
}

// Shared haidh-entry flow — since V3.61.0 called ONLY from the summary's
// leading checkbox column (the day-view button was removed, confirmed),
// kept in this file because the gap logic belongs with the day machinery.
async function maktabMarkHaidhFlow(studentId, onDone){
  const today = maktabTodayISO();
  let rows = [];
  try{ rows = await apiGetAttendanceFor(studentId); } catch(e){ rows = []; }
  if(!Array.isArray(rows)) rows = [];
  const gap = maktabHaidhGapDays(rows, today);
  let status = 'haidh';
  if(gap != null && gap < HAIDH_GAP_OFFICIAL){
    // exact wording confirmed in chat
    status = confirm('15 days has not passed since the last haidh day. Ok to mark as Haidh, cancel to mark absent') ? 'haidh' : 'absent';
  }
  try{
    await apiSetAttendanceFor(studentId, today, status);
  } catch(e){
    alert('Could not save the attendance mark.');
    return;
  }
  if(onDone) await onDone();
}

// ---- visibility control: 3 small radios on one slim line (confirmed) ----
function maktabVisibilityControl(idPrefix){
  return `<div class="maktab-vis-row" role="radiogroup" aria-label="Teacher note visibility">
    <label class="maktab-vis-opt"><input type="radio" name="${idPrefix}_vis" value="all"><span>Public</span></label>
    <label class="maktab-vis-opt"><input type="radio" name="${idPrefix}_vis" value="teachers_only" checked><span>Teachers</span></label>
    <label class="maktab-vis-opt"><input type="radio" name="${idPrefix}_vis" value="private"><span>Private</span></label>
  </div>`;
}
function maktabVisibilityValue(idPrefix){
  const el = document.querySelector(`input[name="${idPrefix}_vis"]:checked`);
  return el ? el.value : 'teachers_only';
}

async function renderMaktabDayScreen(param){
  const el = document.getElementById('maktabDayContent');
  if(param && param.id){
    maktabDayStudent = { id: param.id, name: param.name || param.id, mushaf: param.mushaf || null, track_haidh: !!param.track_haidh };
    maktabDayDate = param.date || maktabTodayISO();
  }
  if(!maktabDayStudent){ el.innerHTML = '<p class="maktab-day-placeholder">Open a student from the Maktab summary.</p>'; return; }
  maktabDayEditing = { sabaq: null, sabaqDhor: null, dhor: null };
  const stu = maktabDayStudent;
  const date = maktabDayDate || maktabTodayISO();
  el.innerHTML = '<p class="maktab-day-placeholder">Loading\u2026</p>';

  const settle = (p) => p.then(v => Array.isArray(v) ? v : []).catch(() => []);
  const settleObj = (p) => p.then(v => v || null).catch(() => null);
  // PJ use is optional: every PJ fetch here degrading to [] IS the
  // designed behaviour for a student who never opens their PJ.
  const [mSabaq, mSabaqDhor, mDhor, pjSabaq, pjReflections, pjAttendance, dhorDefault] = await Promise.all([
    settle(apiGetPJLogsFor('/maktab/sabaq', stu.id)),
    settle(apiGetPJLogsFor('/maktab/sabaq-dhor', stu.id)),
    settle(apiGetPJLogsFor('/maktab/dhor', stu.id)),
    settle(apiGetPJLogsFor('/sabaq', stu.id)),
    settle(apiGetPJLogsFor('/reflections', stu.id)),
    settle(apiGetAttendanceFor(stu.id)),
    settleObj(apiMaktabDhorDefault(stu.id)),
  ]);

  const ref = refForMushafSabaq(stu.mushaf);
  const dayAtt = (pjAttendance || []).find(r => r.date === date);
  const haidhOnDate = stu.track_haidh && dayAtt && (dayAtt.status === 'haidh' || dayAtt.status === 'predicted-haidh');

  const pjNoteFor = (rows) => {
    const r = (rows || []).find(x => x.date === date && x.student_comment);
    return r ? r.student_comment : ''; // private ones arrive nulled by applyPrivacy — nothing to filter here
  };
  const publicTadabbur = (pjReflections || []).filter(r => r.date === date && r.reflection);

  const sabaqPrepop = maktabSabaqPrepop(mSabaq, pjSabaq, ref, mDhor.length > 0);
  const lastSabaqDhor = mSabaqDhor[0] || null;
  const todays = {
    sabaq: mSabaq.filter(r => r.date === date),
    sabaqDhor: mSabaqDhor.filter(r => r.date === date),
    dhor: mDhor.filter(r => r.date === date),
  };

  const fmtRef = (v) => v && v.surah ? v.surah + ':' + v.ayah : '';
  let dhorSuggestion = null;
  if(dhorDefault && dhorDefault.source === 'next_in_cycle' && dhorDefault.segment_from){
    dhorSuggestion = { from: dhorDefault.segment_from, to: dhorDefault.segment_to, ref: dhorDefault.ref || '' };
  }

  const haidhBanner = haidhOnDate
    ? '<div class="maktab-haidh-banner">Marked haidh in her journal for this day \u2014 saving a log will overwrite the haidh mark.</div>'
    : '';

  const existingList = (type, rows) => rows.map(r =>
    `<div class="maktab-existing-row" data-type="${type}" data-id="${r.id}">
       <span>${maktabDayEsc(maktabExistingLabel(type, r))}</span>
       <span class="maktab-existing-meta">${maktabDayEsc(r.teacher_name || '')}</span>
       <button type="button" class="maktab-mini-btn" data-edit>Edit</button>
       <button type="button" class="maktab-mini-btn" data-del>Delete</button>
     </div>`).join('');

  // Teacher note (ABOVE) + read-only student note (below, only when
  // present) — the shared notes block for all three cards.
  const notesBlock = (idPrefix, studentNote) => `
    ${maktabVisibilityControl(idPrefix)}
    <label class="maktab-field-label">Teacher note <textarea id="${idPrefix}_tnote"></textarea></label>
    ${studentNote ? `<div class="maktab-student-note"><span class="maktab-student-note-label">Student note</span><div class="maktab-student-note-text">${maktabDayEsc(studentNote)}</div></div>` : ''}`;

  // PJ log-card chrome (user-stated: copy the format exactly):
  // .log-detail-card > .card-scroll > [name row] + .card-header-row
  // (icon + title group + header save-wrap), fields below.
  const card = (type, title, iconName, bodyHtml) => `
    <div class="log-detail-card maktab-day-card" data-card="${type}">
      <div class="card-scroll">
        <div class="maktab-card-student-row">${maktabDayEsc(stu.name)}</div>
        <div class="card-header-row">
          <span class="card-header-icon">${iconHtml(iconName)}</span>
          <div class="card-header-title-group"><h2>${title}</h2></div>
          <div class="card-header-save-wrap">
            <button type="button" class="card-header-save-btn" data-save="${type}"><span class="save-btn-text">Save</span></button>
          </div>
        </div>
        ${bodyHtml}
      </div>
    </div>`;

  el.innerHTML = `
    <div class="maktab-day-date">${maktabDayEsc(date)}</div>
    ${haidhBanner}
    ${publicTadabbur.length ? `<div class="maktab-tadabbur-strip"><strong>Tadabbur (shared):</strong> ${publicTadabbur.map(r => maktabDayEsc(r.reflection)).join(' \u2022 ')}</div>` : ''}

    ${card('sabaq', 'Sabaq', 'sabaq', `
      ${existingList('sabaq', todays.sabaq)}
      <label class="maktab-field-label">From <input id="mk_sabaq_from" placeholder="surah:ayah" value="${maktabDayEsc(fmtRef(sabaqPrepop.from))}"></label>
      <label class="maktab-field-label">To <input id="mk_sabaq_to" placeholder="surah:ayah" value="${maktabDayEsc(fmtRef(sabaqPrepop.to))}"></label>
      ${notesBlock('mk_sabaq', pjNoteFor(pjSabaq))}`)}

    ${card('sabaqDhor', 'Sabaq Dhor', 'sabaqDhor', `
      ${existingList('sabaqDhor', todays.sabaqDhor)}
      <label class="maktab-field-label">Zone <input id="mk_sd_zone" value="${maktabDayEsc(lastSabaqDhor ? (lastSabaqDhor.zone || '') : '')}"></label>
      <label class="maktab-field-label">From <input id="mk_sd_from_surah" placeholder="surah" inputmode="numeric"> : <input id="mk_sd_from_ayah" placeholder="ayah" inputmode="numeric"></label>
      <label class="maktab-field-label">To <input id="mk_sd_to_surah" placeholder="surah" inputmode="numeric"> : <input id="mk_sd_to_ayah" placeholder="ayah" inputmode="numeric"></label>
      <label class="maktab-field-label">Mistakes <input id="mk_sd_mistakes" inputmode="numeric"></label>
      ${notesBlock('mk_sd', '')}`)}

    ${card('dhor', 'Dhor', 'dhor', `
      ${existingList('dhor', todays.dhor)}
      ${dhorSuggestion ? `<div class="maktab-dhor-suggestion">Next in cycle: ${maktabDayEsc(describeDhorSegment(dhorSuggestion.from, dhorSuggestion.to, dhorSuggestion.ref || 'waterval'))}</div>` : ''}
      <label class="maktab-field-label">Segment from <input id="mk_dhor_from" inputmode="numeric" value="${dhorSuggestion ? maktabDayEsc(String(dhorSuggestion.from)) : ''}"></label>
      <label class="maktab-field-label">Segment to <input id="mk_dhor_to" inputmode="numeric" value="${dhorSuggestion ? maktabDayEsc(String(dhorSuggestion.to)) : ''}"></label>
      <label class="maktab-field-label">Ref <select id="mk_dhor_ref">
        <option value="waterval"${(!dhorSuggestion || dhorSuggestion.ref !== 'uthmani') ? ' selected' : ''}>13-line (IndoPak)</option>
        <option value="uthmani"${dhorSuggestion && dhorSuggestion.ref === 'uthmani' ? ' selected' : ''}>Madina</option>
      </select></label>
      <label class="maktab-field-label">Mistakes <input id="mk_dhor_mistakes" inputmode="numeric"></label>
      ${notesBlock('mk_dhor', '')}`)}`;

  // stash the displayed student notes so save can freeze them as-is
  el.dataset.sabaqStudentNote = pjNoteFor(pjSabaq) || '';

  el.querySelectorAll('.maktab-existing-row [data-del]').forEach(btn => btn.addEventListener('click', async (e) => {
    const row = e.target.closest('.maktab-existing-row');
    if(!confirm('Delete this entry?')) return;
    const client = { sabaq: apiMaktabSabaq, sabaqDhor: apiMaktabSabaqDhor, dhor: apiMaktabDhor }[row.dataset.type];
    try{ await client.remove(row.dataset.id); } catch(err){ alert('Could not delete.'); return; }
    renderMaktabDayScreen(null);
  }));
  el.querySelectorAll('.maktab-existing-row [data-edit]').forEach(btn => btn.addEventListener('click', (e) => {
    const row = e.target.closest('.maktab-existing-row');
    const type = row.dataset.type;
    maktabDayEditing[type] = Number(row.dataset.id);
    const all = { sabaq: todays.sabaq, sabaqDhor: todays.sabaqDhor, dhor: todays.dhor }[type];
    const entry = all.find(x => x.id === Number(row.dataset.id));
    if(entry) maktabDayPrefill(type, entry);
    const saveBtn = el.querySelector(`[data-save="${type}"] .save-btn-text`);
    if(saveBtn) saveBtn.textContent = 'Update';
  }));
  el.querySelectorAll('[data-save]').forEach(btn => btn.addEventListener('click', () => maktabDaySave(btn.dataset.save, stu, date)));
}

function maktabExistingLabel(type, r){
  if(type === 'sabaq') return (r.sabaq_from || '?') + '\u2013' + (r.sabaq_to || '?');
  if(type === 'sabaqDhor') return (r.zone ? r.zone + ' ' : '') + (r.from_surah ? `${r.from_surah}:${r.from_ayah}\u2013${r.to_surah}:${r.to_ayah}` : '');
  return describeDhorSegment(r.segment_from, r.segment_to, r.ref || 'waterval');
}

function maktabDayPrefill(type, e){
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.value = v == null ? '' : v; };
  if(type === 'sabaq'){ set('mk_sabaq_from', e.sabaq_from); set('mk_sabaq_to', e.sabaq_to); }
  if(type === 'sabaqDhor'){ set('mk_sd_zone', e.zone); set('mk_sd_from_surah', e.from_surah); set('mk_sd_from_ayah', e.from_ayah); set('mk_sd_to_surah', e.to_surah); set('mk_sd_to_ayah', e.to_ayah); set('mk_sd_mistakes', e.mistakes); }
  if(type === 'dhor'){ set('mk_dhor_from', e.segment_from); set('mk_dhor_to', e.segment_to); set('mk_dhor_mistakes', e.mistakes); const sel = document.getElementById('mk_dhor_ref'); if(sel && e.ref) sel.value = e.ref; }
  if(e.teacher_feedback != null){ set(({ sabaq: 'mk_sabaq', sabaqDhor: 'mk_sd', dhor: 'mk_dhor' })[type] + '_tnote', e.teacher_feedback); }
  if(e.teacher_feedback_visibility){
    const radio = document.querySelector(`input[name="${({ sabaq: 'mk_sabaq', sabaqDhor: 'mk_sd', dhor: 'mk_dhor' })[type]}_vis"][value="${e.teacher_feedback_visibility}"]`);
    if(radio) radio.checked = true;
  }
}

function maktabDayReadPayload(type){
  const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const num = (id) => { const v = val(id); return v === '' ? null : Number(v); };
  const host = document.getElementById('maktabDayContent');
  if(type === 'sabaq'){
    return {
      sabaq_from: val('mk_sabaq_from') || null, sabaq_to: val('mk_sabaq_to') || null,
      // the read-only student note freezes into the row exactly as displayed
      student_comment: (host.dataset.sabaqStudentNote || '') || null, student_comment_private: false,
      teacher_feedback: val('mk_sabaq_tnote') || null, teacher_feedback_visibility: maktabVisibilityValue('mk_sabaq'),
    };
  }
  if(type === 'sabaqDhor'){
    return {
      zone: val('mk_sd_zone') || null,
      from_surah: num('mk_sd_from_surah'), from_ayah: num('mk_sd_from_ayah'),
      to_surah: num('mk_sd_to_surah'), to_ayah: num('mk_sd_to_ayah'),
      mistakes: num('mk_sd_mistakes'),
      teacher_feedback: val('mk_sd_tnote') || null, teacher_feedback_visibility: maktabVisibilityValue('mk_sd'),
    };
  }
  return {
    segment_from: num('mk_dhor_from'), segment_to: num('mk_dhor_to'),
    ref: val('mk_dhor_ref') || 'waterval', mistakes: num('mk_dhor_mistakes'),
    teacher_feedback: val('mk_dhor_tnote') || null, teacher_feedback_visibility: maktabVisibilityValue('mk_dhor'),
  };
}

async function maktabDaySave(type, stu, date){
  const client = { sabaq: apiMaktabSabaq, sabaqDhor: apiMaktabSabaqDhor, dhor: apiMaktabDhor }[type];
  const payload = maktabDayReadPayload(type);
  const editingId = maktabDayEditing[type];
  try{
    if(editingId){
      await client.update(editingId, payload);
    } else {
      const res = await client.save(Object.assign({ student_id: stu.id, date }, payload));
      if(res && res.isDuplicate && !res.id){
        if(confirm('An identical entry already exists for this day. Save anyway?')){
          await client.save(Object.assign({ student_id: stu.id, date, force: true }, payload));
        }
      }
    }
  } catch(err){
    alert('Could not save: ' + (err && err.message ? err.message : 'unknown error'));
    return;
  }
  renderMaktabDayScreen(null);
}
