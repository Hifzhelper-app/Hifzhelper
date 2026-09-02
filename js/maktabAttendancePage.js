/* Hifzhelper build 4.2.11 | js/maktabAttendancePage.js */
// ============================================================
// Hifzhelper — Maktab Attendance register (V4.2.11).
//
// One roster, many narrow teaching-day columns. Maktab weeks are grouped
// under merged first-row headings, with Mon/Tue/Wed/... on row two.
// Present = green tick (any Maktab log). Haa'idha = yellow haidh icon.
// Absent/unresolved = blank. Selecting a student's name opens her own
// Attendance page, where the teacher edits attendance/haidh.
// ============================================================

let mkregisterTermId = null;
let mkregisterWired = false;
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
  return a === b ? `Week ${mkregShortDate(a)}` : `Week ${mkregShortDate(a)} – ${mkregShortDate(b)}`;
}

function mkregPeriodLabel(data){
  const f = typeof fmtDMY === 'function' ? fmtDMY : (x) => x;
  const range = `${f(data.from)} – ${f(data.to)}`;
  return data.period_name ? `${data.period_name} · ${range}` : range;
}

async function renderMaktabAttendanceScreen(){
  await mkregisterPaint();
  if(mkregisterWired) return;
  mkregisterWired = true;
  const prev = document.getElementById('mkweekPrevBtn');
  const next = document.getElementById('mkweekNextBtn');
  prev.addEventListener('click', async () => {
    if(!mkregisterData || mkregisterData.prev_term_id == null) return;
    mkregisterTermId = mkregisterData.prev_term_id;
    await mkregisterPaint();
  });
  next.addEventListener('click', async () => {
    if(!mkregisterData || mkregisterData.next_term_id == null) return;
    mkregisterTermId = mkregisterData.next_term_id;
    await mkregisterPaint();
  });
}

async function mkregisterPaint(){
  const host = document.getElementById('mkweekCols');
  const err = document.getElementById('mkweekError');
  const prev = document.getElementById('mkweekPrevBtn');
  const next = document.getElementById('mkweekNextBtn');
  err.textContent = '';
  host.innerHTML = '<p class="form-hint">Loading…</p>';

  let data;
  try{
    data = await apiGetMaktabRegister(mkregisterTermId);
  } catch(e){
    host.innerHTML = '';
    err.textContent = e.message;
    return;
  }
  mkregisterData = data;
  if(data.term_id != null) mkregisterTermId = data.term_id;
  document.getElementById('mkweekLabel').textContent = mkregPeriodLabel(data);
  prev.disabled = data.prev_term_id == null;
  next.disabled = data.next_term_id == null;

  const weeks = data.weeks || [];
  const students = data.students || [];
  const colCount = weeks.reduce((n, w) => n + (w.columns || []).length, 0);
  if(!colCount){
    host.innerHTML = '<p class="form-hint">No teaching days are configured for this period.</p>';
    return;
  }

  const WD = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' };
  let columnIndex = 0;
  const weekHead = weeks.map((w, wi) => {
    const count = (w.columns || []).length;
    const html = `<th class="mkregister-week-head mkregister-week-${wi % 2 ? 'b' : 'a'}${wi ? ' mkregister-week-start' : ''}" colspan="${count}">${mkregEsc(mkregWeekLabel(w))}</th>`;
    columnIndex += count;
    return html;
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
        mark = `<span class="mkregister-status mkregister-status-present" aria-hidden="true">${iconHtml('check')}</span>`;
        label = 'Present';
      } else if(status === 'haidh'){
        mark = `<span class="mkregister-status mkregister-status-haidh" aria-hidden="true">${iconHtml('haidh')}</span>`;
        label = "Haa'idha";
      } else if(c.future){
        label = 'Not yet recorded';
      } else if(c.no_maktab_day){
        label = 'No maktab day';
      }
      return `<td class="mkregister-cell mkregister-week-${wi % 2 ? 'b' : 'a'}${start}${off}${future}" data-date="${c.date}" aria-label="${mkregEsc(`${s.name}, ${WD[c.weekday] || ''} ${mkregShortDate(c.date)}: ${label}`)}" title="${mkregEsc(label)}">${mark}</td>`;
    }).join('')).join('');
    return `<tr><th class="mkregister-student-cell" scope="row"><button type="button" class="mkregister-student" data-student-id="${mkregEsc(s.id)}" title="Open ${mkregEsc(s.name)} attendance">${mkregEsc(s.name)}</button></th>${cells}</tr>`;
  }).join('');

  host.innerHTML = `<div class="mkregister-scroll"><table class="mkregister-grid">
    <thead>
      <tr><th class="mkregister-student-head" rowspan="2">Student</th>${weekHead}</tr>
      <tr>${dayHead}</tr>
    </thead>
    <tbody>${body || `<tr><td colspan="${colCount + 1}" class="form-hint">No active students.</td></tr>`}</tbody>
  </table></div>`;

  host.querySelectorAll('.mkregister-student').forEach(btn => {
    btn.addEventListener('click', () => {
      const student = students.find(s => s.id === btn.dataset.studentId);
      if(!student) return;
      openMaktabAttendancePage(student, data.today);
    });
  });
}
