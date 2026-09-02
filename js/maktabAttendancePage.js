/* Hifzhelper build 4.2.11.2 | js/maktabAttendancePage.js */
// ============================================================
// Hifzhelper — Maktab Attendance register (V4.2.11.2).
//
// One roster, one existing Attendance % value, then narrow teaching-day
// columns grouped beneath merged date-range headings. The current Maktab
// week is put in view automatically when the current term opens.
// Present = bold lime text tick. Haa'idha = the former thin green present
// check. Absent/unresolved = blank. Selecting a student's name opens her
// individual Attendance page, where editing continues to live.
// ============================================================

let mkregisterData = null;

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
  const students = data.students || [];
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

  const body = students.map(s => {
    const cells = weeks.map((w, wi) => (w.columns || []).map((c, ci) => {
      const status = (s.cells && s.cells[c.date]) || '';
      const start = ci === 0 && wi ? ' mkregister-week-start' : '';
      const off = c.no_maktab_day ? ' mkregister-day-off' : '';
      const future = c.future ? ' mkregister-day-future' : '';
      let mark = '';
      let label = 'Absent';
      if(status === 'present'){
        mark = '<span class="mkregister-status mkregister-status-present" aria-hidden="true">✓</span>';
        label = 'Present';
      } else if(status === 'haidh'){
        // User request: retire the yellow Haidh glyph in this grid and reuse
        // the former thin green Present check as the distinct Haidh mark.
        mark = `<span class="mkregister-status mkregister-status-haidh" aria-hidden="true">${iconHtml('check')}</span>`;
        label = "Haa'idha";
      } else if(c.future){
        label = 'Not yet recorded';
      } else if(c.no_maktab_day){
        label = 'No maktab day';
      }
      return `<td class="mkregister-cell mkregister-week-${wi % 2 ? 'b' : 'a'}${start}${off}${future}" data-date="${c.date}" aria-label="${mkregEsc(`${s.name}, ${WD[c.weekday] || ''} ${mkregShortDate(c.date)}: ${label}`)}" title="${mkregEsc(label)}">${mark}</td>`;
    }).join('')).join('');
    const pct = s.attendance_percent == null ? '—' : `${s.attendance_percent}%`;
    const pctTitle = s.attendance_maktab_days
      ? `${s.attendance_present_days} of ${s.attendance_maktab_days} maktab days`
      : 'No maktab days in this period';
    return `<tr>
      <th class="mkregister-student-cell" scope="row"><button type="button" class="mkregister-student" data-student-id="${mkregEsc(s.id)}" title="Open ${mkregEsc(s.name)} attendance">${mkregEsc(s.name)}</button></th>
      <td class="mkregister-percent-cell" title="${mkregEsc(pctTitle)}">${pct}</td>${cells}
    </tr>`;
  }).join('');

  host.innerHTML = `<div class="mkregister-scroll"><table class="mkregister-grid">
    <thead>
      <tr><th class="mkregister-student-head" rowspan="2">Student</th><th class="mkregister-percent-head" rowspan="2">Attendance %</th>${weekHead}</tr>
      <tr>${dayHead}</tr>
    </thead>
    <tbody>${body || `<tr><td colspan="${colCount + 2}" class="form-hint">No active students.</td></tr>`}</tbody>
  </table></div>`;

  const focusCurrentWeek = () => mkregFocusCurrentWeek(host, data);
  if(typeof requestAnimationFrame === 'function') requestAnimationFrame(focusCurrentWeek);
  else focusCurrentWeek();

  host.querySelectorAll('.mkregister-student').forEach(btn => {
    btn.addEventListener('click', () => {
      const student = students.find(s => s.id === btn.dataset.studentId);
      if(!student) return;
      openMaktabAttendancePage(student, data.today);
    });
  });
}
