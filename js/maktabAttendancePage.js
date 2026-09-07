/* Hifzhelper build 4.2.15.2 | js/maktabAttendancePage.js */
// ============================================================
// Hifzhelper — Maktab Attendance register (V4.2.14).
//
// One roster, one existing Attendance % value, then narrow teaching-day
// columns grouped beneath merged date-range headings. The current Maktab
// week is put in view automatically when the current term opens.
// Present = bold lime text tick. Confirmed Haidh = grey uppercase H;
// predicted Haidh = grey lowercase h. Absent/unresolved = blank.
// Selecting a student's name opens her
// individual Attendance page, where editing continues to live.
// ============================================================

let mkregisterData = null;
let mkregisterSortKey = 'default';
let mkregisterSortDirection = null;

function mkregEsc(value){
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mkregShortDate(iso){
  const d = new Date(iso + 'T00:00:00Z');
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
  return `${d.getUTCDate()} ${mon}`;
}

function mkregWeekLabel(week){
  const cols = week.columns || [];
  if(!cols.length) return '';
  const a = cols[0].date, b = cols[cols.length - 1].date;
  return a === b ? mkregShortDate(a) : `${mkregShortDate(a)} – ${mkregShortDate(b)}`;
}

function mkregMondayOf(iso){
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// V4.2.15.1 — keep V4.2.14.5's primary ordering unchanged: number of
// actual active/logged Maktab days in the current week, highest first.
// ONLY its former Attendance-% tie-breaker changes to alphabetical. Rows
// with no activity remain Haidh alphabetically, then absent alphabetically.
function mkregFirstNameKey(name){
  const full = String(name || '').trim().replace(/\s+/g, ' ');
  return { first: (full.split(' ')[0] || '').toLocaleLowerCase(), full: full.toLocaleLowerCase() };
}
function mkregCompareNames(a, b){
  const ak = mkregFirstNameKey(a && a.name), bk = mkregFirstNameKey(b && b.name);
  return ak.first.localeCompare(bk.first) || ak.full.localeCompare(bk.full) || String((a && a.id) || '').localeCompare(String((b && b.id) || ''));
}
function mkregStudentRank(student, date){
  const status = student && student.cells ? student.cells[date] : '';
  if(status === 'present') return 0;
  if(status === 'haidh' || status === 'predicted-haidh') return 1;
  return 2;
}
function mkregAttendancePercent(student){
  const n = Number(student && student.attendance_percent);
  return Number.isFinite(n) ? n : -1;
}
function mkregActiveDays(student){
  const n = Number(student && student.attendance_active_days);
  return Number.isFinite(n) ? n : 0;
}
function mkregWeekDates(weeks, date){
  const list = (weeks || []).filter(w => w && Array.isArray(w.columns) && w.columns.length);
  if(!list.length) return [];
  const monday = mkregMondayOf(date);
  let week = list.find(w => w.monday === monday);
  if(!week){
    // Safe historical/nearest-term fallback: use the latest rendered week that
    // starts on/before the reference date; otherwise use the first rendered week.
    const past = list.filter(w => String(w.monday || (w.columns[0] && w.columns[0].date) || '') <= date);
    week = past[past.length - 1] || list[0];
  }
  return (week.columns || []).map(c => c && c.date).filter(Boolean);
}
function mkregActiveDaysForDates(student, dates){
  const cells = student && student.cells ? student.cells : {};
  return (dates || []).reduce((count, d) => count + (cells[d] === 'present' ? 1 : 0), 0);
}
function mkregHaidhDaysForDates(student, dates){
  const cells = student && student.cells ? student.cells : {};
  return (dates || []).reduce((count, d) => count + ((cells[d] === 'haidh' || cells[d] === 'predicted-haidh') ? 1 : 0), 0);
}
function mkregStudentWeekBand(student, dates){
  if(mkregActiveDaysForDates(student, dates) > 0) return 0;
  if(mkregHaidhDaysForDates(student, dates) > 0) return 1;
  return 2;
}
function mkregTermDates(weeks, from, to){
  const dates = [];
  (weeks || []).forEach(w => (w && Array.isArray(w.columns) ? w.columns : []).forEach(c => {
    const d = c && c.date;
    if(!d) return;
    if(from && d < from) return;
    if(to && d > to) return;
    dates.push(d);
  }));
  return dates;
}
function mkregSortStudents(students, date, weeks, sortKey, sortDirection, termFrom, termTo){
  const weekDates = mkregWeekDates(weeks, date);
  // Compatibility for isolated one-day callers/tests: when no week model is
  // supplied, the reference date itself is the current activity window.
  const currentWeekDates = weekDates.length ? weekDates : (date ? [date] : []);
  const key = sortKey || 'default';
  const direction = sortDirection || (key === 'attendance' ? 'desc' : 'asc');
  const termDates = mkregTermDates(weeks, termFrom, termTo);
  const attendanceDates = termDates.length ? termDates : currentWeekDates;
  return (students || []).slice().sort((a, b) => {
    if(key === 'name'){
      const cmp = mkregCompareNames(a, b);
      return direction === 'desc' ? -cmp : cmp;
    }
    if(key === 'attendance'){
      // V4.2.15.2: the manual Attendance sort is TERM-WIDE, not current-week.
      // Activity is the first key, Attendance % the second, and alphabetic
      // name the stable tie-break. The reverse state reverses the two numeric
      // keys but keeps alphabetic ties readable A-Z.
      const activeA = mkregActiveDaysForDates(a, attendanceDates);
      const activeB = mkregActiveDaysForDates(b, attendanceDates);
      if(activeA !== activeB) return direction === 'asc' ? activeA - activeB : activeB - activeA;
      const pctA = mkregAttendancePercent(a), pctB = mkregAttendancePercent(b);
      if(pctA !== pctB) return direction === 'asc' ? pctA - pctB : pctB - pctA;
      return mkregCompareNames(a, b);
    }

    // DEFAULT — unchanged first level from V4.2.14.5 / V4.2.15.1:
    // current-week active-day count, then alphabetic ties, then Haidh A-Z,
    // then absent/unresolved A-Z.
    const activeA = mkregActiveDaysForDates(a, currentWeekDates);
    const activeB = mkregActiveDaysForDates(b, currentWeekDates);
    const weeklyActive = activeB - activeA;
    if(weeklyActive) return weeklyActive;
    if(activeA > 0) return mkregCompareNames(a, b);
    const band = mkregStudentWeekBand(a, currentWeekDates) - mkregStudentWeekBand(b, currentWeekDates);
    if(band) return band;
    return mkregCompareNames(a, b);
  });
}

// V4.2.15.2: each sortable header is a 3-state control.
// Name: default -> A-Z -> Z-A -> default.
// Attendance: default -> term-wide high-to-low -> low-to-high -> default.
function mkregSetSort(host, data, key){
  const firstDirection = key === 'attendance' ? 'desc' : 'asc';
  const secondDirection = firstDirection === 'asc' ? 'desc' : 'asc';
  if(mkregisterSortKey !== key){
    mkregisterSortKey = key;
    mkregisterSortDirection = firstDirection;
  } else if(mkregisterSortDirection === firstDirection){
    mkregisterSortDirection = secondDirection;
  } else {
    mkregisterSortKey = 'default';
    mkregisterSortDirection = null;
  }
  const sorted = mkregSortStudents(
    data.students || [], data.today, data.weeks || [], mkregisterSortKey,
    mkregisterSortDirection, data.from, data.to
  );
  const tbody = host.querySelector('.mkregister-grid tbody');
  if(tbody){
    const byId = new Map(Array.from(tbody.querySelectorAll('tr[data-student-id]')).map(tr => [tr.dataset.studentId, tr]));
    sorted.forEach((student, index) => {
      const tr = byId.get(String(student.id));
      if(!tr) return;
      const number = tr.querySelector('.mkregister-row-number');
      if(number) number.textContent = String(index + 1);
      tbody.appendChild(tr);
    });
  }
  mkregUpdateSortButtons(host);
}

function mkregUpdateSortButtons(host){
  host.querySelectorAll('.mkregister-sort-btn').forEach(btn => {
    const active = btn.dataset.sortKey === mkregisterSortKey;
    btn.classList.toggle('is-active', active);
    btn.classList.toggle('is-asc', active && mkregisterSortDirection === 'asc');
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    if(btn.dataset.sortKey === 'name'){
      btn.setAttribute('aria-label', !active ? 'Sort students A to Z' : (mkregisterSortDirection === 'asc' ? 'Sort students Z to A' : 'Return to default student order'));
      btn.title = !active ? 'A-Z' : (mkregisterSortDirection === 'asc' ? 'Z-A' : 'Default order');
    }
    if(btn.dataset.sortKey === 'attendance'){
      btn.setAttribute('aria-label', !active ? 'Sort Attendance highest first for the term' : (mkregisterSortDirection === 'desc' ? 'Sort Attendance lowest first for the term' : 'Return to default Attendance order'));
      btn.title = !active ? 'Term: active days then Attendance %, highest first' : (mkregisterSortDirection === 'desc' ? 'Term: lowest first' : 'Default order');
    }
  });
}

// V4.2.11.1+: a term register can span many weeks. Put the current Maktab
// week beside the two sticky identity columns on every opening of the current
// term. Earlier weeks remain available by scrolling left.
function mkregFocusCurrentWeek(host, data){
  if(!host || !data || !data.today || !data.from || !data.to) return;
  if(data.today < data.from || data.today > data.to) return;
  const monday = mkregMondayOf(data.today);
  const week = (data.weeks || []).find(w => w.monday === monday);
  if(!week || !(week.columns || []).length) return;
  const scroll = host.querySelector('.mkregister-scroll');
  const firstDate = week.columns[0].date;
  const target = host.querySelector(`.mkregister-day-head[data-date="${firstDate}"]`);
  if(!scroll || !target) return;
  const studentHead = host.querySelector('.mkregister-student-head');
  const percentHead = host.querySelector('.mkregister-percent-head');
  const stickyWidth = (studentHead ? studentHead.offsetWidth : 0) + (percentHead ? percentHead.offsetWidth : 0);
  scroll.scrollLeft = Math.max(0, target.offsetLeft - stickyWidth - 3);
}

async function renderMaktabAttendanceScreen(){
  mkregisterSortKey = 'default';
  mkregisterSortDirection = null;
  await mkregisterPaint();
}

async function mkregisterPaint(){
  const host = document.getElementById('mkweekCols');
  const err = document.getElementById('mkweekError');
  err.textContent = '';
  host.innerHTML = '<p class="form-hint">Loading…</p>';

  let data;
  try{
    // V4.2.11.2: the register itself is the time navigation. The removed
    // term-arrow strip no longer selects historical terms, so open the
    // backend's current/nearest term directly.
    data = await apiGetMaktabRegister();
  } catch(e){
    host.innerHTML = '';
    err.textContent = e.message;
    return;
  }
  mkregisterData = data;

  const weeks = data.weeks || [];
  const students = mkregSortStudents(data.students || [], data.today, weeks, 'default', null, data.from, data.to);
  const colCount = weeks.reduce((n, w) => n + (w.columns || []).length, 0);
  if(!colCount){
    host.innerHTML = '<p class="form-hint">No teaching days are configured for this period.</p>';
    return;
  }

  const WD = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' };
  const weekHead = weeks.map((w, wi) => {
    const count = (w.columns || []).length;
    return `<th class="mkregister-week-head mkregister-week-${wi % 2 ? 'b' : 'a'}${wi ? ' mkregister-week-start' : ''}" colspan="${count}">${mkregEsc(mkregWeekLabel(w))}</th>`;
  }).join('');

  const dayHead = weeks.map((w, wi) => (w.columns || []).map((c, ci) => {
    const off = c.no_maktab_day ? ' mkregister-day-off' : '';
    const future = c.future ? ' mkregister-day-future' : '';
    const start = ci === 0 && wi ? ' mkregister-week-start' : '';
    const title = `${WD[c.weekday] || c.weekday} ${mkregShortDate(c.date)}${c.no_maktab_day ? ' — No maktab day' : ''}`;
    return `<th class="mkregister-day-head mkregister-week-${wi % 2 ? 'b' : 'a'}${start}${off}${future}" title="${mkregEsc(title)}" data-date="${c.date}">${WD[c.weekday] || ''}</th>`;
  }).join('')).join('');

  const body = students.map((s, rowIndex) => {
    const cells = weeks.map((w, wi) => (w.columns || []).map((c, ci) => {
      const status = (s.cells && s.cells[c.date]) || '';
      const start = ci === 0 && wi ? ' mkregister-week-start' : '';
      const off = c.no_maktab_day ? ' mkregister-day-off' : '';
      const future = c.future ? ' mkregister-day-future' : '';
      let mark = '';
      let label = 'Absent';
      if(status === 'present'){
        mark = '<span class="mkregister-status mkregister-status-present" aria-hidden="true">✓</span>';
        label = 'Present / logged';
      } else if(status === 'haidh'){
        mark = '<span class="mkregister-status mkregister-status-haidh-confirmed" aria-hidden="true">H</span>';
        label = 'Confirmed Haidh';
      } else if(status === 'predicted-haidh'){
        mark = '<span class="mkregister-status mkregister-status-haidh-predicted" aria-hidden="true">h</span>';
        label = 'Predicted Haidh';
      } else if(c.future){
        label = 'Not yet recorded';
      } else if(c.no_maktab_day){
        label = 'No maktab day';
      }
      return `<td class="mkregister-cell mkregister-week-${wi % 2 ? 'b' : 'a'}${start}${off}${future}" data-date="${c.date}" aria-label="${mkregEsc(`${s.name}, ${WD[c.weekday] || ''} ${mkregShortDate(c.date)}: ${label}`)}" title="${mkregEsc(label)}">${mark}</td>`;
    }).join('')).join('');
    const pct = s.attendance_percent == null ? '—' : `${s.attendance_percent}%`;
    const pctTitle = s.attendance_maktab_days
      ? `${s.attendance_active_days || 0} active · ${s.attendance_haidh_days || 0} Haidh${s.attendance_predicted_haidh_days ? ` (${s.attendance_predicted_haidh_days} predicted)` : ''} · ${s.attendance_absent_days || 0} absent · ${s.attendance_maktab_days} resolved Maktab days`
      : 'No resolved Maktab days in this period';
    return `<tr data-student-id="${mkregEsc(s.id)}">
      <th class="mkregister-student-cell" scope="row"><span class="mkregister-student-cell-inner"><span class="mkregister-row-number" aria-hidden="true">${rowIndex + 1}</span><button type="button" class="mkregister-student" data-student-id="${mkregEsc(s.id)}" title="Open ${mkregEsc(s.name)} attendance">${mkregEsc(s.name)}</button></span></th>
      <td class="mkregister-percent-cell" title="${mkregEsc(pctTitle)}">${pct}</td>${cells}
    </tr>`;
  }).join('');

  host.innerHTML = `<div class="mkregister-scroll"><table class="mkregister-grid" id="mkregisterGrid">
    <thead>
      <tr><th class="mkregister-student-head" rowspan="2"><span class="mkregister-student-head-inner"><button type="button" class="mkregister-sort-btn mkregister-student-head-label" data-sort-key="name" aria-pressed="false" aria-label="Sort students A to Z"><span>Student</span><span class="mkregister-sort-chevron" aria-hidden="true">${iconHtml('chevronDown')}</span></button><button type="button" class="mkregister-percent-toggle" aria-expanded="false" aria-controls="mkregisterGrid" aria-label="Show Attendance percentage" title="Show Attendance %">%</button></span></th><th class="mkregister-percent-head" rowspan="2"><button type="button" class="mkregister-sort-btn" data-sort-key="attendance" aria-pressed="false" aria-label="Sort Attendance highest first"><span>Attendance %</span><span class="mkregister-sort-chevron" aria-hidden="true">${iconHtml('chevronDown')}</span></button></th>${weekHead}</tr>
      <tr>${dayHead}</tr>
    </thead>
    <tbody>${body || `<tr><td colspan="${colCount + 2}" class="form-hint">No active students.</td></tr>`}</tbody>
  </table></div>`;

  const focusCurrentWeek = () => mkregFocusCurrentWeek(host, data);
  if(typeof requestAnimationFrame === 'function') requestAnimationFrame(focusCurrentWeek);
  else focusCurrentWeek();

  // V4.2.13.1: phones default to a rolled-up Attendance % column so 4–5
  // teaching days can remain visible beside the sticky Student column. The
  // percentage values themselves are unchanged; this is presentation only.
  const percentToggle = host.querySelector('.mkregister-percent-toggle');
  const grid = host.querySelector('.mkregister-grid');
  if(percentToggle && grid){
    percentToggle.addEventListener('click', () => {
      const open = !grid.classList.contains('mkregister-percent-open');
      grid.classList.toggle('mkregister-percent-open', open);
      percentToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      percentToggle.setAttribute('aria-label', open ? 'Hide Attendance percentage' : 'Show Attendance percentage');
      percentToggle.title = open ? 'Hide Attendance %' : 'Show Attendance %';
    });
  }

  host.querySelectorAll('.mkregister-sort-btn').forEach(btn => {
    btn.addEventListener('click', () => mkregSetSort(host, data, btn.dataset.sortKey));
  });
  mkregUpdateSortButtons(host);

  host.querySelectorAll('.mkregister-student').forEach(btn => {
    btn.addEventListener('click', () => {
      const student = students.find(s => s.id === btn.dataset.studentId);
      if(!student) return;
      openMaktabAttendancePage(student, data.today);
    });
  });
}


// V4.2.15.1: explicit rectangular green button back to Maktab Summary.
if(typeof document !== 'undefined'){
  const mkweekMaktabSummaryBtn = document.getElementById('mkweekMaktabSummaryBtn');
  if(mkweekMaktabSummaryBtn){
    mkweekMaktabSummaryBtn.innerHTML = iconHtml('maktab') + '<span>Maktab Summary</span>';
    mkweekMaktabSummaryBtn.addEventListener('click', () => showScreen('maktabSummary'));
  }
}
