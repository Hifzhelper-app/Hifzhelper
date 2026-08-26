// ============================================================
// Hifzhelper -- maktab day entry (V3.64.0).
//
// This file no longer renders any cards. The maktab day view IS the PJ
// day view (#screen-logDetail): same rail, same dots, same Sabaq /
// Sabaq Dhor / Dhor cards, same verse pickers, Lines/Pages, Tajweed,
// History and Timer -- because it is literally that screen, opened with
// a maktab context (js/logContext.js) instead of a copy of it.
// Confirmed in chat 2026-08-16 after two hand-built copies drifted
// (V3.60.0's plain inputs, V3.62.0's rail with simplified fields).
//
// What remains here is only what is genuinely maktab-only:
//   - opening the shared screen with the right context,
//   - painting the student-name row + haidh toggle into each card,
//   - clearing the context on exit (the leakage hazard -- see
//     logContext.js's header),
//   - the haidh toggle flow itself, shared with the summary.
//
// Sabaq prepop deliberately needs NO code here any more: the PJ's own
// renderSabaqScreen computes the frontier from logClient('sabaq').get(),
// which in maktab mode returns the student's MAKTAB sabaq history -- the
// agreed rule ("maktab prepop calculates from the maktab's own history --
// copy the PJ prepop logic") now holds by construction rather than by a
// reimplementation. The one agreed PJ amendment (a student's PJ sabaq may
// only ever EXTEND sabaq_to) is applied below as a post-step.
// ============================================================

let maktabDayStudent = null; // { id, name, mushaf, track_haidh }
let maktabDayDate = null;    // ISO -- follows the summary's date picker

function maktabTodayISO(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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

// Marking runs the 15-day guard with the exact confirmed wording. Takes
// the date it should mark -- V3.63.0 fixed it hardcoding today, which
// went wrong once the summary gained a date picker.
async function maktabMarkHaidhFlow(studentId, onDone, date){
  const target = date || maktabTodayISO();
  let rows = [];
  try{ rows = await apiGetAttendanceFor(studentId); } catch(e){ rows = []; }
  if(!Array.isArray(rows)) rows = [];
  const gap = maktabHaidhGapDays(rows, target);
  let status = 'haidh';
  if(gap != null && gap < HAIDH_GAP_OFFICIAL){
    status = confirm('15 days has not passed since the last haidh day. Ok to mark as Haidh, cancel to mark absent') ? 'haidh' : 'absent';
  }
  try{
    await apiSetAttendanceFor(studentId, target, status);
  } catch(e){
    alert('Could not save the attendance mark.');
    return;
  }
  if(onDone) await onDone();
}

// Un-ticking CLEARS the day back to unset rather than writing 'absent':
// 'absent' is a different claim, and the maktab derives absence anyway.
async function maktabToggleHaidh(studentId, date, currentlyMarked, onDone){
  if(currentlyMarked){
    try{
      await apiClearAttendanceFor(studentId, date);
    } catch(e){
      alert('Could not clear the haidh mark.');
      return;
    }
    if(onDone) await onDone();
    return;
  }
  await maktabMarkHaidhFlow(studentId, onDone, date);
}

// The student name + haidh toggle row, painted into each of the three
// shared cards. Hidden entirely in PJ mode.
function maktabPaintNameRows(marked){
  // V3.72.0: the Dhor card's Plan/Setup button follows the same context this
  // repaint does, so it is refreshed here rather than from a second hook
  // that could fall out of step.
  if(typeof refreshDhorPlanBtn === 'function') refreshDhorPlanBtn();
  ['sabaq', 'sabaqDhor', 'dhor'].forEach(type => {
    const row = document.getElementById('maktabNameRow_' + type);
    if(!row) return;
    if(!logCtxIsMaktab()){ row.hidden = true; row.innerHTML = ''; return; }
    row.hidden = false;
    row.innerHTML = '';
    const name = document.createElement('span');
    name.className = 'maktab-name-text';
    name.textContent = logCtxStudentName();
    row.appendChild(name);
    // V3.73.0: the haidh toggle is GONE from the day cards. Haidh is marked
    // in ONE place now — the summary's leading-column icon.
    //
    // It was a CONTROL here, not a badge: it marked and cleared haidh
    // including the 15-day gap confirm. So this removed one of the two ways
    // to mark, and a teacher already inside a student's cards now backs out
    // to the summary to do it. Accepted as the cost of one place, not two.
    //
    // maktabToggleHaidh, maktabMarkHaidhFlow and the gap check are NOT
    // deleted — the summary's toggle still uses them; this file's header
    // records that the flow is shared. Only the rendering and wiring went.
  });
}

// The one agreed PJ->maktab amendment: after the PJ's own prepop has run
// off maktab history, a student's PJ sabaq frontier may EXTEND sabaq_to
// (never sabaq_from, never shrink it). Applied as a post-step so the PJ's
// prepop logic itself stays untouched.
async function maktabExtendSabaqToFromPJ(){
  const toAyahEl = document.getElementById('sabaq_to_ayah');
  const toSurahEl = document.getElementById('sabaq_to_surah');
  if(!toAyahEl || !toSurahEl) return; // no prepop rendered -- nothing to extend
  let pjRows = [];
  try{ pjRows = await apiGetPJLogsFor('/sabaq', logCtxStudentId()); } catch(e){ pjRows = []; }
  if(!Array.isArray(pjRows) || !pjRows.length) return; // PJ optional -- empty is the normal case
  const ref = typeof sabaqRef !== 'undefined' ? sabaqRef : 'waterval';
  const pjFrontier = computeActualSabaqFrontier(pjRows, ref);
  if(!pjFrontier) return;
  const curSurah = Number(toSurahEl.value);
  const curAyah = Number(toAyahEl.value);
  if(!curSurah || !curAyah) return;
  const juz = getJuzForPosition(curSurah, curAyah, ref);
  const cmp = compareVerseKey(pjFrontier.surah, pjFrontier.ayah, curSurah, curAyah);
  const further = juz === 30 ? cmp < 0 : cmp > 0;
  if(!further) return; // PJ behind the maktab changes nothing (only-increase)
  toSurahEl.value = pjFrontier.surah;
  toAyahEl.value = pjFrontier.ayah;
}

// Entry point from the summary's row tap.
async function openMaktabDay(student, date){
  maktabDayStudent = student;
  maktabDayDate = date || maktabTodayISO();
  setMaktabLogContext(student, maktabDayDate);

  // V3.73.0: the maktab NO LONGER READS STUDENT NOTES. That drops one of the
  // three permitted PJ inputs, leaving two — the sabaq_to extension above
  // and haidh. It also removes THREE apiGetPJLogsFor calls that fired on
  // every day-view open purely to fetch her notes.
  //
  // apiGetPJLogsFor itself stays: the sabaq_to extension above still uses
  // it. Notes already FROZEN onto saved maktab rows keep showing — that is
  // maktab data sitting on a maktab row, not a read into her journal.

  // V3.66.0: the maktab Dhor pool for this student, from the maktab
  // position blob — loaded BEFORE the cards render, since logProfile()
  // serves it to Sabaq Dhor and Dhor during showScreen.
  try{
    const pos = await apiGetMaktabPosition(student.id);
    let blob = null;
    try{ blob = pos && pos.position_json ? JSON.parse(pos.position_json) : null; } catch(e){ blob = null; }
    setLogCtxPool(blob && Array.isArray(blob.baselineSelection) ? blob.baselineSelection : []);
  } catch(e){ setLogCtxPool([]); }

  await showScreen('logDetail', 'sabaq');

  // date: every card's own date control, set to the day being logged
  ['sabaq_date', 'sabaqDhor_date', 'dhor_date'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = maktabDayDate; // setter-intercepted by customDate.js -- pill follows
  });

  let attendance = [];
  try{ attendance = await apiGetAttendanceFor(student.id); } catch(e){ attendance = []; }
  const onDate = (Array.isArray(attendance) ? attendance : []).find(r => r.date === maktabDayDate);
  maktabPaintNameRows(!!(onDate && (onDate.status === 'haidh' || onDate.status === 'predicted-haidh')));

  await maktabExtendSabaqToFromPJ();
}

// Leaving the shared screen MUST drop the context and repaint, or the
// next PJ visit inherits maktab state (see logContext.js's header).
function exitMaktabDay(){
  if(!logCtxIsMaktab()) return;
  clearLogContext();
  maktabDayStudent = null;
  maktabDayDate = null;
  maktabPaintNameRows(false);
}
