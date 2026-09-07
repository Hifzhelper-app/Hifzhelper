/* Hifzhelper build 4.2.15.5 | js/maktabDay.js */
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

// ============================================================
// V4.2.15.2 — Attendance Quick Action POPUP.
//
// Reuse means reuse: the popup temporarily moves the real #attHaidhBlock
// (the Student Attendance calendar) into the modal and lets
// js/haidhDetailScreen.js continue to own day selection, month navigation,
// clearing existing Haidh marks, and the authoritative /mark-range rules.
// The popup adds only the quick-action choice (Haidh vs Absent) + Save.
// ============================================================
let maktabQuickAttendanceState = null;

function maktabQuickAttendanceBounds(){
  if(typeof haidhPendingRangeBounds !== 'function') return null;
  return haidhPendingRangeBounds(); // one tap may be saved as a single day
}
function maktabQuickAttendanceIsOpen(){ return !!maktabQuickAttendanceState; }
function maktabQuickAttendanceSelectionMode(){
  return maktabQuickAttendanceState ? maktabQuickAttendanceState.mode : null;
}
function maktabQuickAttendanceSetMode(mode){
  if(!maktabQuickAttendanceState) return;
  maktabQuickAttendanceState.mode = mode;
  document.querySelectorAll('#maktabQuickAttendanceSheet [data-mqa-mode]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.mqaMode === mode);
    btn.setAttribute('aria-pressed', btn.dataset.mqaMode === mode ? 'true' : 'false');
  });
}
function maktabCloseQuickAttendance(options){
  const state = maktabQuickAttendanceState;
  if(!state) return;
  if(typeof haidhClearPendingRange === 'function') haidhClearPendingRange();
  const block = document.getElementById('attHaidhBlock');
  const page = document.getElementById('screen-attendancePage');
  if(block && page) page.appendChild(block);
  if(state.overlay && state.overlay.parentNode) state.overlay.remove();
  maktabQuickAttendanceState = null;
  if(!(options && options.keepContext)){
    if(state.priorContext){
      setMaktabLogContext(state.priorContext.student, state.priorContext.date, { readOnly: state.priorContext.readOnly });
    } else {
      clearLogContext();
    }
  }
}
async function maktabSaveQuickAttendance(){
  const state = maktabQuickAttendanceState;
  if(!state) return;
  const err = document.getElementById('maktabQuickAttendanceError');
  if(err) err.textContent = '';
  const bounds = maktabQuickAttendanceBounds();
  if(!bounds){ if(err) err.textContent = 'Select a date or date range.'; return; }
  if(!state.mode){ if(err) err.textContent = 'Choose Mark as Haidh or Mark Absent.'; return; }
  const save = document.getElementById('maktabQuickAttendanceSave');
  if(save) save.disabled = true;
  try{
    const client = haidhCalClient();
    if(state.mode === 'haidh'){
      // Exact Student Attendance / Worker Haidh behaviour and validation.
      await client.markRange(bounds[0], bounds[1]);
    } else {
      // Quick Attendance records a factual absence for every selected day.
      // Logged activity is stronger and cannot be replaced by an absence.
      for(let d = bounds[0]; d <= bounds[1]; d = haidhAddDaysISO(d, 1)){
        if(typeof haidhCalAttendance !== 'undefined' && haidhCalAttendance[d] === 'activity'){
          throw new Error(`Maktab activity is already logged on ${d} and takes precedence over absence.`);
        }
      }
      // Explicit absence is stop evidence for the normalized Haidh run.
      for(let d = bounds[0]; d <= bounds[1]; d = haidhAddDaysISO(d, 1)){
        await client.setDay(d, 'absent');
      }
    }
    maktabCloseQuickAttendance();
  } catch(e){
    if(err) err.textContent = e.message;
    if(save) save.disabled = false;
  }
}
async function maktabOpenQuickAttendance(student, date){
  if(maktabQuickAttendanceState) maktabCloseQuickAttendance();
  const selectedDate = date || maktabTodayISO();
  const priorContext = (typeof logCtxIsMaktab === 'function' && logCtxIsMaktab()) ? {
    student: { id: logCtxStudentId(), name: logCtxStudentName(), track_haidh: logCtxTrackHaidh() },
    date: logCtxDate(), readOnly: typeof logCtxReadOnly === 'function' ? logCtxReadOnly() : false
  } : null;
  setMaktabLogContext(student, selectedDate);
  const block = document.getElementById('attHaidhBlock');
  if(!block){ openMaktabAttendancePage(student, selectedDate); return; }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay maktab-quick-attendance-modal';
  overlay.id = 'maktabQuickAttendanceSheet';
  overlay.innerHTML = `<div class="modal-card maktab-quick-attendance-card" role="dialog" aria-modal="true" aria-label="Attendance quick action for ${typeof maktabQuickEscape === 'function' ? maktabQuickEscape(student.name) : String(student.name || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')}">
    <div class="maktab-quick-attendance-head">
      <div class="maktab-quick-attendance-identity">
        <strong>Attendance :</strong>
        <span class="maktab-name-pill" title="${typeof maktabQuickEscape === 'function' ? maktabQuickEscape(student.name) : String(student.name || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')}">${typeof maktabQuickEscape === 'function' ? maktabQuickEscape(student.name) : String(student.name || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')}</span>
      </div>
      <div class="maktab-quick-attendance-controls">
        <button type="button" class="maktab-quick-attendance-detail" id="maktabQuickAttendanceDetail" aria-label="Open full Student Attendance page" title="Detail"><span>${iconHtml('detail')}</span><span>Detail</span></button>
        <button type="button" class="maktab-quick-attendance-save" id="maktabQuickAttendanceSave" aria-label="Save attendance" title="Save">${iconHtml('save')}</button>
        <button type="button" class="maktab-quick-attendance-close" id="maktabQuickAttendanceClose" aria-label="Close" title="Close">${iconHtml('close')}</button>
      </div>
    </div>
    <div id="maktabQuickAttendanceCalendarHost"></div>
    <p class="maktab-quick-attendance-help">Select one date, or select a start and end date.</p>
    <div class="maktab-quick-attendance-mode-row">
      <button type="button" class="maktab-quick-attendance-mode" data-mqa-mode="haidh" aria-pressed="false">Mark as Haidh</button>
      <button type="button" class="maktab-quick-attendance-mode" data-mqa-mode="absent" aria-pressed="false">Mark Absent</button>
    </div>
    <div class="form-error" id="maktabQuickAttendanceError"></div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#maktabQuickAttendanceCalendarHost').appendChild(block);
  maktabQuickAttendanceState = { student, date: selectedDate, mode: null, overlay, priorContext };

  document.getElementById('maktabQuickAttendanceClose').addEventListener('click', () => maktabCloseQuickAttendance());
  overlay.addEventListener('click', e => { if(e.target === overlay) maktabCloseQuickAttendance(); });
  document.querySelectorAll('#maktabQuickAttendanceSheet [data-mqa-mode]').forEach(btn => btn.addEventListener('click', () => maktabQuickAttendanceSetMode(btn.dataset.mqaMode)));
  document.getElementById('maktabQuickAttendanceSave').addEventListener('click', maktabSaveQuickAttendance);
  document.getElementById('maktabQuickAttendanceDetail').addEventListener('click', () => {
    const snapshot = maktabQuickAttendanceState;
    maktabCloseQuickAttendance({ keepContext: true });
    showScreen('attendancePage', { maktab: true, date: snapshot.date });
  });

  resetHaidhCalendarVisualState();
  await renderHaidhDetailScreen({ maktab: true, date: selectedDate });
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
// V4.2.15.5 narrows the standalone summary to the CURRENT CALENDAR MONTH
// for this student only. Every same-day activity entry is displayed inline
// (comma separated) rather than collapsing extras behind +N. Rows still tap
// through to that day's log
// cards; the Sabaq / Sabaq Dhor / Dhor header labels open the SAME Quick
// Log sheet used by Maktab Summary, preselected to that activity, while the
// attendance icon opens the existing Student Attendance calendar directly.
// Data: the three maktab GETs (student_id in teacher mode; her own
// read-only path calls without one).
// ============================================================
function studentSummaryMonthBounds(){
  const today = maktabTodayISO();
  const month = today.slice(0, 7);
  const first = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const label = new Date(`${first}T00:00:00Z`).toLocaleDateString(undefined, { month:'long', year:'numeric', timeZone:'UTC' });
  return { month, first, last, label };
}

function studentSummaryEntryText(type, entries){
  if(!entries || !entries.length) return '—';
  return entries.map(entry => {
    const holder = document.createElement('div');
    holder.innerHTML = journalCellShorthand(type, [entry]);
    return (holder.textContent || '').replace(/\s+/g, ' ').trim();
  }).filter(Boolean).join(', ') || '—';
}

async function openStudentSummaryPage(student, date){
  setMaktabLogContext(student, date || maktabTodayISO());
  await showScreen('studentSummary');
}

async function renderStudentSummaryScreen(){
  const tbody = document.getElementById('studentSummaryTbody');
  if(!tbody) return;
  document.getElementById('studentSummaryTitle').textContent = logCtxStudentName() || 'Summary';
  const headerIcon = document.getElementById('studentSummaryHeaderIcon');
  if(headerIcon) headerIcon.innerHTML = iconHtml('maktab');
  const student = { id: logCtxStudentId(), name: logCtxStudentName(), track_haidh: logCtxTrackHaidh() };
  const quickDate = logCtxDate() || maktabTodayISO();
  const monthBounds = studentSummaryMonthBounds();
  const period = document.getElementById('studentSummaryPeriod');
  if(period) period.textContent = monthBounds.label;
  const quickLogButtons = Array.from(document.querySelectorAll('#screen-studentSummary [data-ss-quick-type]'));
  // Disable while the three activity feeds load; the exact Maktab Summary
  // Quick Log action is wired below once we have the carried-date entries.
  quickLogButtons.forEach(btn => { btn.disabled = true; btn.onclick = null; });
  const attBtn = document.getElementById('studentSummaryAttendanceBtn');
  if(attBtn){
    if(typeof iconHtml === 'function') attBtn.innerHTML = iconHtml('attendance');
    attBtn.setAttribute('aria-label', 'Attendance');
    attBtn.title = 'Attendance';
    attBtn.onclick = () => maktabOpenQuickAttendance(student, quickDate);
  }
  const summaryBtn = document.getElementById('studentSummaryMaktabSummaryBtn');
  if(summaryBtn){
    summaryBtn.innerHTML = iconHtml('maktab') + '<span>Maktab Summary</span>';
    summaryBtn.onclick = () => showScreen('maktabSummary');
  }
  const ajzaaBtn = document.getElementById('studentSummaryAjzaaBtn');
  if(ajzaaBtn){
    ajzaaBtn.innerHTML = '<span>Ajzaa Completed</span>';
    ajzaaBtn.onclick = () => openMaktabStudentSetup({ id: logCtxStudentId(), name: logCtxStudentName() });
  }
  const closeBtn = document.getElementById('studentSummaryCloseBtn');
  if(closeBtn) closeBtn.onclick = () => showScreen('maktabSummary');

  const since = monthBounds.first;
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
    if(!r.date || r.date < monthBounds.first || r.date > monthBounds.last) return;
    (days[r.date] = days[r.date] || { sabaq: [], sabaqDhor: [], dhor: [] })[key].push(r);
  });
  bucket(sabaq, 'sabaq'); bucket(sabaqDhor, 'sabaqDhor'); bucket(dhor, 'dhor');

  // V4.2.14.2: each activity LABEL is the Student Summary quick action.
  // It calls maktabOpenQuickLog directly — the very same sheet/function used
  // by Maktab Summary — and simply chooses the tapped label as the initial
  // activity. On mobile the shared sheet still exposes its Sabaq/Sabaq Dhor/
  // Dhor selector, exactly as it does from Maktab Summary.
  const entriesByType = days[quickDate] || { sabaq: [], sabaqDhor: [], dhor: [] };
  quickLogButtons.forEach(btn => {
    const type = btn.dataset.ssQuickType;
    if(!['sabaq', 'sabaqDhor', 'dhor'].includes(type)) return;
    btn.disabled = false;
    btn.onclick = () => maktabOpenQuickLog(
      student, quickDate, type, entriesByType[type] || [], entriesByType,
      { afterSave: () => renderStudentSummaryScreen() }
    );
  });

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
      // V4.2.15.5: this is now a current-month report view. Every activity
      // logged on the same date is visible inline, comma separated.
      td.classList.add('student-summary-entry-list');
      td.textContent = studentSummaryEntryText(type, days[date][type]);
      tr.appendChild(td);
    });
    tr.addEventListener('click', () => {
      const student = { id: logCtxStudentId(), name: logCtxStudentName(), track_haidh: logCtxTrackHaidh() };
      openMaktabDay(student, date);
    });
    return tr;
  };
  allDates.forEach(date => tbody.appendChild(rowFor(date)));
}
