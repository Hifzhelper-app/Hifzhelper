// ============================================================
// Hifzhelper — Haidh calendar (V3.39)
// Month-by-month paging calendar for marking/clearing haidh days.
// Reached from the "Haidh" nav item, or from the journal's Sabaq-column
// "Haidh" text for a specific date (param, if provided, jumps straight
// to that date's month).
//
// A day carries one of three states here: unmarked, 'predicted-haidh'
// (lighter shade — a plan, not yet real) or 'haidh' (full shade —
// confirmed/actual). Tapping an unmarked day marks it: a date in the
// future becomes a plan ('predicted-haidh'); today or a past date
// becomes real ('haidh') directly, since it isn't a prediction at that
// point. Tapping an already-marked day clears it. No deletion of any
// log ever happens here, and nothing on the Sabaq/Sabaq Dhor/Dhor
// detail cards is touched (confirmed in chat) — this screen only ever
// writes to the attendance table.
//
// The 10/15-day caps are enforced server-side (worker/src/
// attendance.js, shared/haidhRules.js) — this screen just surfaces
// whatever error message comes back, rather than duplicating the
// run/gap-scanning logic in two places.
// ============================================================

let haidhCalViewYear = null;
let haidhCalViewMonth = null; // 0-indexed, matches JS Date
let haidhCalAttendance = {};  // date (YYYY-MM-DD) -> 'haidh' | 'predicted-haidh'

function haidhTodayISO(){ return new Date().toISOString().slice(0,10); }

function haidhFormatMonthLabel(year, month){
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

async function loadHaidhCalAttendance(){
  const { data } = await apiGetAttendance();
  haidhCalAttendance = {};
  (data || []).forEach(row => {
    if(row.status === 'haidh' || row.status === 'predicted-haidh') haidhCalAttendance[row.date] = row.status;
  });
}

function haidhCalDayCell(dateISO, inCurrentMonth){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'haidh-cal-day';
  if(!inCurrentMonth) btn.classList.add('haidh-cal-day-muted');
  if(dateISO === haidhTodayISO()) btn.classList.add('haidh-cal-day-today');
  const status = haidhCalAttendance[dateISO];
  // V3.39: auto-confirm is evaluated lazily, on the fly (confirmed in
  // chat) — a predicted day that's already in the past with no log
  // reads as genuinely haidh here, same full shade as an explicitly
  // confirmed day; only a predicted day still ahead of today shows the
  // lighter "still just a plan" shade.
  const isFuture = dateISO > haidhTodayISO();
  if(status === 'haidh' || (status === 'predicted-haidh' && !isFuture)) btn.classList.add('haidh-cal-day-confirmed');
  else if(status === 'predicted-haidh' && isFuture) btn.classList.add('haidh-cal-day-planned');
  btn.textContent = String(parseInt(dateISO.slice(8, 10), 10));
  btn.addEventListener('click', () => onHaidhCalDayTap(dateISO));
  return btn;
}

async function onHaidhCalDayTap(dateISO){
  const errEl = document.getElementById('haidhCalError');
  errEl.textContent = '';
  const status = haidhCalAttendance[dateISO];
  try{
    if(status){
      await apiDeleteAttendance(dateISO);
    } else {
      const newStatus = dateISO > haidhTodayISO() ? 'predicted-haidh' : 'haidh';
      await apiSetAttendance(dateISO, newStatus);
    }
    await loadHaidhCalAttendance();
    renderHaidhCalGrid();
  } catch(e){
    errEl.textContent = e.message;
  }
}

function renderHaidhCalGrid(){
  document.getElementById('haidhCalMonthLabel').textContent = haidhFormatMonthLabel(haidhCalViewYear, haidhCalViewMonth);

  const weekdaysEl = document.getElementById('haidhCalWeekdays');
  if(!weekdaysEl.childElementCount){
    ['S','M','T','W','T','F','S'].forEach(d => {
      const span = document.createElement('span');
      span.textContent = d;
      weekdaysEl.appendChild(span);
    });
  }

  const gridEl = document.getElementById('haidhCalGrid');
  gridEl.innerHTML = '';

  const firstOfMonth = new Date(haidhCalViewYear, haidhCalViewMonth, 1);
  const startOffset = firstOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = new Date(haidhCalViewYear, haidhCalViewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(haidhCalViewYear, haidhCalViewMonth, 0).getDate();

  const cells = [];
  for(let i = startOffset - 1; i >= 0; i--){
    const d = daysInPrevMonth - i;
    const dt = new Date(haidhCalViewYear, haidhCalViewMonth - 1, d);
    cells.push({ iso: dt.toISOString().slice(0,10), inMonth: false });
  }
  for(let d = 1; d <= daysInMonth; d++){
    const dt = new Date(haidhCalViewYear, haidhCalViewMonth, d);
    cells.push({ iso: dt.toISOString().slice(0,10), inMonth: true });
  }
  let extra = 1;
  while(cells.length % 7 !== 0){
    const dt = new Date(haidhCalViewYear, haidhCalViewMonth + 1, extra);
    cells.push({ iso: dt.toISOString().slice(0,10), inMonth: false });
    extra++;
  }

  cells.forEach(c => gridEl.appendChild(haidhCalDayCell(c.iso, c.inMonth)));
}

function shiftHaidhCalMonth(delta){
  haidhCalViewMonth += delta;
  if(haidhCalViewMonth < 0){ haidhCalViewMonth = 11; haidhCalViewYear--; }
  if(haidhCalViewMonth > 11){ haidhCalViewMonth = 0; haidhCalViewYear++; }
  renderHaidhCalGrid();
}

document.getElementById('haidhCalPrevBtn').addEventListener('click', () => shiftHaidhCalMonth(-1));
document.getElementById('haidhCalNextBtn').addEventListener('click', () => shiftHaidhCalMonth(1));

async function renderHaidhDetailScreen(param){
  document.getElementById('haidhDetailHeaderIcon').innerHTML = iconHtml('haidh');
  document.getElementById('haidhCalError').textContent = '';
  const jumpDate = (typeof param === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(param)) ? param : haidhTodayISO();
  const [y, m] = jumpDate.split('-').map(Number);
  haidhCalViewYear = y;
  haidhCalViewMonth = m - 1;
  try{
    await loadHaidhCalAttendance();
    renderHaidhCalGrid();
  } catch(e){
    showBanner("Couldn't load the Haidh calendar: " + e.message);
  }
}
