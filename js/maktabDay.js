// ============================================================
// Hifzhelper -- Maktab day view (V3.60.0, maktab delivery (e2)).
// Replaces (e1)'s placeholder. The teacher's entry screen for ONE
// student's Hifz day: the student's name above three cards (Sabaq /
// Sabaq Dhor / Dhor -- no Tadabbur card; a student's PUBLIC tadabbur
// shows as a read-only strip instead, the maktab never writes one),
// each prepopulated, each saving to the (d) endpoints with this
// teacher's provenance stamped server-side.
//
// PREPOP SOURCES (all confirmed in chat; PJ use is OPTIONAL, so every
// PJ fetch below treats empty as the NORMAL case, never an error):
//   Sabaq -- frontier over MAKTAB sabaq history (the PJ's own
//     computeActualSabaqFrontier/nextSabaqDefaults, pure functions from
//     js/position.js, pointed at maktab rows), then the ONE agreed PJ
//     amendment: the student's PJ sabaq frontier may only ever EXTEND
//     sabaq_to (never sabaq_from, never shrink) -- "the PJ should only
//     change the sabaq to field increasing the sabaq. No other
//     changes." A PJ frontier behind the maktab's changes nothing.
//   Sabaq Dhor -- maktab history only: last entry's zone carries over,
//     positions manual (same as the PJ, no calc to port).
//   Dhor -- GET /maktab/dhor-default-entry: the PJ's own
//     computeDefaultDhorEntry against maktab_dhor_log, no plans.
//   Notes -- a non-private student_comment on TODAY's PJ entry of the
//     same type prepopulates the card's student-note field (editable
//     until save; frozen into the maktab row by saving -- later PJ
//     edits change nothing, the teacher edits the maktab log instead).
//   Haidh -- today's PJ attendance; haidh/predicted-haidh shows a
//     banner on all three cards. Saving anyway is allowed and
//     overwrites the mark ((d)'s targeted update -- log always wins).
//
// FIELD STYLE, deliberate: plain inputs (sabaq refs as "s:a" text,
// numeric segments), NOT the PJ's verse-ref pickers -- those are
// deeply coupled to sabaqPage/dhorPage module state, and threading a
// second consumer through them is exactly the mode-flag risk the (e)
// spec said to avoid. A picker upgrade is a later polish item.
//
// TEACHER HAIDH ENTRY (confirmed: BOTH surfaces -- here and the
// summary row; both funnel through maktabMarkHaidhFlow below): writes
// the one shared attendance table via the re-activated POST
// /attendance. Early re-mark guard, exact wording confirmed in chat:
// if the last haidh day is fewer than HAIDH_GAP_OFFICIAL (15, from
// shared/haidhRules.js -- reused, not re-encoded) days ago, a native
// confirm() -- OK marks haidh, Cancel marks absent.
// ============================================================

let maktabDayStudent = null; // { id, name, mushaf } — mushaf rides the roster row (see maktabLog.js)
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

// Shared by the day view button AND the summary row control (both
// surfaces confirmed in chat). onDone re-renders whichever screen called.
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

async function renderMaktabDayScreen(param){
  const el = document.getElementById('maktabDayContent');
  if(param && param.id) maktabDayStudent = { id: param.id, name: param.name || param.id, mushaf: param.mushaf || null };
  if(!maktabDayStudent){ el.innerHTML = '<p class="maktab-day-placeholder">Open a student from the Maktab summary.</p>'; return; }
  maktabDayEditing = { sabaq: null, sabaqDhor: null, dhor: null };
  const stu = maktabDayStudent;
  const today = maktabTodayISO();
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
  const todayAtt = (pjAttendance || []).find(r => r.date === today);
  const haidhToday = todayAtt && (todayAtt.status === 'haidh' || todayAtt.status === 'predicted-haidh');

  const pjNoteFor = (rows) => {
    const r = (rows || []).find(x => x.date === today && x.student_comment);
    return r ? r.student_comment : ''; // private ones arrive nulled by applyPrivacy — nothing to filter here
  };
  const publicTadabbur = (pjReflections || []).filter(r => r.date === today && r.reflection);

  const sabaqPrepop = maktabSabaqPrepop(mSabaq, pjSabaq, ref, mDhor.length > 0);
  const lastSabaqDhor = mSabaqDhor[0] || null;
  const todays = {
    sabaq: mSabaq.filter(r => r.date === today),
    sabaqDhor: mSabaqDhor.filter(r => r.date === today),
    dhor: mDhor.filter(r => r.date === today),
  };

  const fmtRef = (v) => v && v.surah ? v.surah + ':' + v.ayah : '';
  let dhorSuggestion = '';
  if(dhorDefault && dhorDefault.source === 'next_in_cycle' && dhorDefault.segment_from){
    dhorSuggestion = { from: dhorDefault.segment_from, to: dhorDefault.segment_to, ref: dhorDefault.ref || '' };
  } else {
    dhorSuggestion = null;
  }

  const haidhBanner = haidhToday
    ? '<div class="maktab-haidh-banner">Marked haidh in her journal today \u2014 saving a log will overwrite the haidh mark.</div>'
    : '';

  const existingList = (type, rows) => rows.map(r =>
    `<div class="maktab-existing-row" data-type="${type}" data-id="${r.id}">
       <span>${maktabDayEsc(maktabExistingLabel(type, r))}</span>
       <span class="maktab-existing-meta">${maktabDayEsc(r.teacher_name || '')}</span>
       <button type="button" class="maktab-mini-btn" data-edit>${'Edit'}</button>
       <button type="button" class="maktab-mini-btn" data-del>${'Delete'}</button>
     </div>`).join('');

  el.innerHTML = `
    <h2 class="maktab-day-name">${maktabDayEsc(stu.name)}</h2>
    <div class="maktab-day-date">${maktabDayEsc(today)}</div>
    <div class="maktab-day-actions">
      <button type="button" class="maktab-haidh-btn" id="maktabDayHaidhBtn">Mark haidh</button>
    </div>
    ${haidhBanner}
    ${publicTadabbur.length ? `<div class="maktab-tadabbur-strip"><strong>Tadabbur (shared):</strong> ${publicTadabbur.map(r => maktabDayEsc(r.reflection)).join(' \u2022 ')}</div>` : ''}

    <div class="maktab-card" data-card="sabaq">
      <h3>Sabaq</h3>
      ${existingList('sabaq', todays.sabaq)}
      <label>From <input id="mk_sabaq_from" placeholder="surah:ayah" value="${maktabDayEsc(fmtRef(sabaqPrepop.from))}"></label>
      <label>To <input id="mk_sabaq_to" placeholder="surah:ayah" value="${maktabDayEsc(fmtRef(sabaqPrepop.to))}"></label>
      <label>Student note <textarea id="mk_sabaq_scomment">${maktabDayEsc(pjNoteFor(pjSabaq))}</textarea></label>
      <label>Teacher note <textarea id="mk_sabaq_tnote"></textarea></label>
      <label>Visibility <select id="mk_sabaq_vis">
        <option value="teachers_only" selected>Teachers only</option>
        <option value="all">Open</option>
        <option value="private">Private</option>
      </select></label>
      <button type="button" class="maktab-save-btn" data-save="sabaq">Save Sabaq</button>
    </div>

    <div class="maktab-card" data-card="sabaqDhor">
      <h3>Sabaq Dhor</h3>
      ${existingList('sabaqDhor', todays.sabaqDhor)}
      <label>Zone <input id="mk_sd_zone" value="${maktabDayEsc(lastSabaqDhor ? (lastSabaqDhor.zone || '') : '')}"></label>
      <label>From <input id="mk_sd_from_surah" placeholder="surah" inputmode="numeric"> : <input id="mk_sd_from_ayah" placeholder="ayah" inputmode="numeric"></label>
      <label>To <input id="mk_sd_to_surah" placeholder="surah" inputmode="numeric"> : <input id="mk_sd_to_ayah" placeholder="ayah" inputmode="numeric"></label>
      <label>Mistakes <input id="mk_sd_mistakes" inputmode="numeric"></label>
      <label>Teacher note <textarea id="mk_sd_tnote"></textarea></label>
      <label>Visibility <select id="mk_sd_vis">
        <option value="teachers_only" selected>Teachers only</option>
        <option value="all">Open</option>
        <option value="private">Private</option>
      </select></label>
      <button type="button" class="maktab-save-btn" data-save="sabaqDhor">Save Sabaq Dhor</button>
    </div>

    <div class="maktab-card" data-card="dhor">
      <h3>Dhor</h3>
      ${existingList('dhor', todays.dhor)}
      ${dhorSuggestion ? `<div class="maktab-dhor-suggestion">Next in cycle: ${maktabDayEsc(describeDhorSegment(dhorSuggestion.from, dhorSuggestion.to, dhorSuggestion.ref || 'waterval'))}</div>` : ''}
      <label>Segment from <input id="mk_dhor_from" inputmode="numeric" value="${dhorSuggestion ? maktabDayEsc(String(dhorSuggestion.from)) : ''}"></label>
      <label>Segment to <input id="mk_dhor_to" inputmode="numeric" value="${dhorSuggestion ? maktabDayEsc(String(dhorSuggestion.to)) : ''}"></label>
      <label>Ref <select id="mk_dhor_ref">
        <option value="waterval"${(!dhorSuggestion || dhorSuggestion.ref !== 'uthmani') ? ' selected' : ''}>Waterval</option>
        <option value="uthmani"${dhorSuggestion && dhorSuggestion.ref === 'uthmani' ? ' selected' : ''}>Uthmani</option>
      </select></label>
      <label>Mistakes <input id="mk_dhor_mistakes" inputmode="numeric"></label>
      <label>Teacher note <textarea id="mk_dhor_tnote"></textarea></label>
      <label>Visibility <select id="mk_dhor_vis">
        <option value="teachers_only" selected>Teachers only</option>
        <option value="all">Open</option>
        <option value="private">Private</option>
      </select></label>
      <button type="button" class="maktab-save-btn" data-save="dhor">Save Dhor</button>
    </div>`;

  document.getElementById('maktabDayHaidhBtn').addEventListener('click', () =>
    maktabMarkHaidhFlow(stu.id, () => renderMaktabDayScreen(null)));

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
    el.querySelector(`[data-save="${type}"]`).textContent = 'Update ' + (type === 'sabaq' ? 'Sabaq' : type === 'sabaqDhor' ? 'Sabaq Dhor' : 'Dhor');
  }));
  el.querySelectorAll('[data-save]').forEach(btn => btn.addEventListener('click', () => maktabDaySave(btn.dataset.save, stu, today)));
}

function maktabExistingLabel(type, r){
  if(type === 'sabaq') return (r.sabaq_from || '?') + '\u2013' + (r.sabaq_to || '?');
  if(type === 'sabaqDhor') return (r.zone ? r.zone + ' ' : '') + (r.from_surah ? `${r.from_surah}:${r.from_ayah}\u2013${r.to_surah}:${r.to_ayah}` : '');
  return describeDhorSegment(r.segment_from, r.segment_to, r.ref || 'waterval');
}

function maktabDayPrefill(type, e){
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.value = v == null ? '' : v; };
  if(type === 'sabaq'){ set('mk_sabaq_from', e.sabaq_from); set('mk_sabaq_to', e.sabaq_to); set('mk_sabaq_scomment', e.student_comment); }
  if(type === 'sabaqDhor'){ set('mk_sd_zone', e.zone); set('mk_sd_from_surah', e.from_surah); set('mk_sd_from_ayah', e.from_ayah); set('mk_sd_to_surah', e.to_surah); set('mk_sd_to_ayah', e.to_ayah); set('mk_sd_mistakes', e.mistakes); }
  if(type === 'dhor'){ set('mk_dhor_from', e.segment_from); set('mk_dhor_to', e.segment_to); set('mk_dhor_mistakes', e.mistakes); const sel = document.getElementById('mk_dhor_ref'); if(sel && e.ref) sel.value = e.ref; }
}

function maktabDayReadPayload(type){
  const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const num = (id) => { const v = val(id); return v === '' ? null : Number(v); };
  if(type === 'sabaq'){
    return {
      sabaq_from: val('mk_sabaq_from') || null, sabaq_to: val('mk_sabaq_to') || null,
      student_comment: val('mk_sabaq_scomment') || null, student_comment_private: false,
      teacher_feedback: val('mk_sabaq_tnote') || null, teacher_feedback_visibility: val('mk_sabaq_vis') || 'teachers_only',
    };
  }
  if(type === 'sabaqDhor'){
    return {
      zone: val('mk_sd_zone') || null,
      from_surah: num('mk_sd_from_surah'), from_ayah: num('mk_sd_from_ayah'),
      to_surah: num('mk_sd_to_surah'), to_ayah: num('mk_sd_to_ayah'),
      mistakes: num('mk_sd_mistakes'),
      teacher_feedback: val('mk_sd_tnote') || null, teacher_feedback_visibility: val('mk_sd_vis') || 'teachers_only',
    };
  }
  return {
    segment_from: num('mk_dhor_from'), segment_to: num('mk_dhor_to'),
    ref: val('mk_dhor_ref') || 'waterval', mistakes: num('mk_dhor_mistakes'),
    teacher_feedback: val('mk_dhor_tnote') || null, teacher_feedback_visibility: val('mk_dhor_vis') || 'teachers_only',
  };
}

async function maktabDaySave(type, stu, today){
  const client = { sabaq: apiMaktabSabaq, sabaqDhor: apiMaktabSabaqDhor, dhor: apiMaktabDhor }[type];
  const payload = maktabDayReadPayload(type);
  const editingId = maktabDayEditing[type];
  try{
    if(editingId){
      await client.update(editingId, payload);
    } else {
      const res = await client.save(Object.assign({ student_id: stu.id, date: today }, payload));
      if(res && res.isDuplicate && !res.id){
        if(confirm('An identical entry already exists for today. Save anyway?')){
          await client.save(Object.assign({ student_id: stu.id, date: today, force: true }, payload));
        }
      }
    }
  } catch(err){
    alert('Could not save: ' + (err && err.message ? err.message : 'unknown error'));
    return;
  }
  renderMaktabDayScreen(null);
}
