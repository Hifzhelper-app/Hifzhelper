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
//   - painting the student-name row into each card,
//   - clearing the context on exit (the leakage hazard -- see
//     logContext.js's header),
//   - opening the shared haidh CALENDAR for a student (V3.76.0; the
//     single-day toggle flow that used to live here is gone).
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
  // V3.78.0: the maktab's day (appTodayISO, js/logContext.js), not the
  // device's — with no timezone set it falls back to the device day.
  return appTodayISO();
}

// V3.76.0 (Phase 2): the haidh TOGGLE flow is GONE — maktabHaidhGapDays,
// maktabMarkHaidhFlow and maktabToggleHaidh (V3.61.0–V3.63.0, the single-day
// mark with its client-side 15-day confirm and the "cancel to mark absent"
// branch). Haidh is marked from the shared calendar now, as a RANGE, under
// the worker's rules (run cap, 14-day gap, whole range rejected on failure)
// — the same rules the student's own calendar has always had. A teacher no
// longer gets a confirm-to-override on the gap; the worker refuses and says
// why. Deleted rather than left dangling: nothing calls them.
//
// The summary's haidh icon is a LINK to that calendar:
// V3.80.0: the summary's per-student icon opens the ATTENDANCE PAGE now
// (the calendar sits inside it). Same ctx mechanics as the day view.
function openMaktabAttendancePage(student, date){
  setMaktabLogContext(student, date || maktabTodayISO());
  showScreen('attendancePage', { maktab: true, date });
}
// V3.76.0 opener, kept as the route in: the calendar has no standalone
// screen since V3.80.0, so opening "the calendar" means opening the page.
function openMaktabHaidhCalendar(student, date){
  openMaktabAttendancePage(student, date);
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
    // V3.76.0: the flow those controls shared (maktabToggleHaidh,
    // maktabMarkHaidhFlow, the gap check) is now deleted too — the summary
    // icon became a link to the shared haidh calendar.
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
