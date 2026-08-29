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
  ['sabaq', 'sabaqDhor', 'dhor'].forEach(type => {   // V3.85.0: back to 3 — the summary is a page
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
// V3.82.0: initialCard — the summary's cells route to their own card
// (name → studentSummary, sabaq cell → sabaq, and so on); default stays
// 'sabaq', the behaviour every existing caller had.
async function openMaktabDay(student, date, initialCard){
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

  await showScreen('logDetail', initialCard || 'sabaq');

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

// ============================================================
// V3.85.0: the STUDENT SUMMARY as a STANDALONE PAGE (the user's V3.82
// revision, confirmed 2026-08-28: "the maktab only sees maktab data").
// "Copied from the student's PJ" = the PJ Journal PAGE's layout —
// expanded recent days, weekly rollup rows, Load more — reusing the
// journal's own row/rollup renderers, but over the MAKTAB'S entries for
// this student ONLY, read-only. Rows tap through to that day's log
// cards; the header's attendance icon opens her attendance page.
// Data: the three maktab GETs (student_id in teacher mode; her own
// read-only path calls without one).
// ============================================================
const SS_EXPANDED_DAYS = 10;
const SS_DEFAULT_DAYS = 90;
const SS_LOAD_MORE_DAYS = 28;
let ssTotalDays = SS_DEFAULT_DAYS;

async function openStudentSummaryPage(student, date){
  setMaktabLogContext(student, date || maktabTodayISO());
  ssTotalDays = SS_DEFAULT_DAYS;
  await showScreen('studentSummary');
}

async function renderStudentSummaryScreen(){
  const tbody = document.getElementById('studentSummaryTbody');
  if(!tbody) return;
  document.getElementById('studentSummaryTitle').textContent = logCtxStudentName() || 'Summary';
  const hIcon = document.getElementById('studentSummaryHeaderIcon');
  if(hIcon && typeof iconHtml === 'function') hIcon.innerHTML = iconHtml('journal');
  const attBtn = document.getElementById('studentSummaryAttendanceBtn');
  if(attBtn){
    if(typeof iconHtml === 'function') attBtn.innerHTML = iconHtml('attendance');
    attBtn.onclick = () => {
      const student = { id: logCtxStudentId(), name: logCtxStudentName(), track_haidh: logCtxTrackHaidh() };
      openMaktabAttendancePage(student, logCtxDate());
    };
  }
  const closeBtn = document.getElementById('studentSummaryCloseBtn');
  if(closeBtn) closeBtn.onclick = () => showScreen('maktabSummary');

  const since = (() => { const d = new Date(); d.setDate(d.getDate() - ssTotalDays); return d.toISOString().slice(0,10); })();
  const id = logCtxStudentId();
  const own = (typeof currentUser !== 'undefined' && currentUser && currentUser.id === id);
  if(typeof ensureMaktabCalYear === 'function'){   // V3.87.0: markers on the summary's date cells
    const y = parseInt(maktabTodayISO().slice(0, 4));
    await Promise.all([ensureMaktabCalYear(String(y)), ensureMaktabCalYear(String(y - 1))]);
  }
  let sabaq, sabaqDhor, dhor;
  try{
    [sabaq, sabaqDhor, dhor] = await Promise.all([
      apiGetMaktabSabaq(own ? undefined : id, since),
      apiGetMaktabSabaqDhor(own ? undefined : id, since),
      apiGetMaktabDhor(own ? undefined : id, since),
    ]);
  } catch(e){
    tbody.innerHTML = '<tr><td colspan="4" class="journal-cell journal-cell-empty">Could not load the maktab record.</td></tr>';
    return;
  }
  const days = {};
  const bucket = (rows, key) => (Array.isArray(rows) ? rows : []).forEach(r => {
    (days[r.date] = days[r.date] || { sabaq: [], sabaqDhor: [], dhor: [] })[key].push(r);
  });
  bucket(sabaq, 'sabaq'); bucket(sabaqDhor, 'sabaqDhor'); bucket(dhor, 'dhor');

  const allDates = Object.keys(days).sort().reverse();
  tbody.innerHTML = '';
  if(!allDates.length){
    tbody.innerHTML = '<tr><td colspan="4" class="journal-cell journal-cell-empty">No maktab entries yet.</td></tr>';
    return;
  }
  const rowFor = (date) => {
    const tr = document.createElement('tr');
    const dateTd = document.createElement('td');
    dateTd.className = 'cell-date';
    dateTd.innerHTML = formatDateCell(date);
    tr.appendChild(dateTd);
    ['sabaq', 'sabaqDhor', 'dhor'].forEach(type => {
      const td = document.createElement('td');
      td.className = 'journal-cell';
      td.innerHTML = journalCellShorthand(type, days[date][type]);
      tr.appendChild(td);
    });
    tr.addEventListener('click', () => {
      const student = { id: logCtxStudentId(), name: logCtxStudentName(), track_haidh: logCtxTrackHaidh() };
      openMaktabDay(student, date);
    });
    return tr;
  };
  const expanded = allDates.slice(0, SS_EXPANDED_DAYS);
  const rest = allDates.slice(SS_EXPANDED_DAYS);
  expanded.forEach(date => tbody.appendChild(rowFor(date)));
  // the PJ journal's own rolling-7-day buckets, verbatim shape
  if(rest.length){
    let bucketStart = null, bucketDates = [];
    const flush = () => {
      if(bucketDates.length) tbody.appendChild(renderJournalRollupRow(bucketDates[bucketDates.length - 1], bucketDates[0]));
      bucketDates = [];
    };
    const oldestExpanded = expanded.length ? new Date(expanded[expanded.length - 1] + 'T00:00:00') : new Date();
    rest.forEach(date => {
      const d = new Date(date + 'T00:00:00');
      const daysFromBoundary = Math.floor((oldestExpanded - d) / 86400000);
      const idx = Math.floor((daysFromBoundary - 1) / 7);
      if(bucketStart !== idx){ flush(); bucketStart = idx; }
      bucketDates.push(date);
    });
    flush();
  }
  const more = document.createElement('tr');
  const moreTd = document.createElement('td');
  moreTd.colSpan = 4;
  moreTd.className = 'journal-load-more-cell';
  moreTd.innerHTML = '<button type="button" id="studentSummaryLoadMore">Load more</button>';
  more.appendChild(moreTd);
  tbody.appendChild(more);
  document.getElementById('studentSummaryLoadMore').addEventListener('click', async () => {
    ssTotalDays += SS_LOAD_MORE_DAYS;
    await renderStudentSummaryScreen();
  });
}
