/* Hifzhelper build 4.2.5 | js/maktabAttendancePage.js */
// ============================================================
// Hifzhelper — the maktab ATTENDANCE screen (V3.98.0, user 2026-08-31).
//
// One week per view, ‹ › pages by week. Columns are the maktab's
// TEACHING DAYS (Maktab Settings), because a "maktab day" is derived
// from logging activity and no future date can ever be one.
//
// A column is never silently dropped (user: "so that the user doesn't
// skip days as they scroll") — a holiday, a term break, or a past day
// the maktab plainly didn't hold appears LABELLED with its reason.
//
// Content follows the calendar, not the column:
//   before today → Present / Absent / Haa'idha (the derived truth)
//   today onward → predicted haa'idha + predicted absentees (planning)
// ============================================================
let mkweekMonday = null;

function mkweekMondayOf(iso){
  const d = new Date(iso + 'T00:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7;   // Monday-first, as everywhere in this app
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
function mkweekShift(iso, days){
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function renderMaktabAttendanceScreen(){
  if(!mkweekMonday) mkweekMonday = mkweekMondayOf(appTodayISO());
  await mkweekPaint();
  const prev = document.getElementById('mkweekPrevBtn');
  const next = document.getElementById('mkweekNextBtn');
  if(prev && !prev._wired){
    prev._wired = true;
    prev.addEventListener('click', async () => { mkweekMonday = mkweekShift(mkweekMonday, -7); await mkweekPaint(); });
    next.addEventListener('click', async () => { mkweekMonday = mkweekShift(mkweekMonday, 7); await mkweekPaint(); });
  }
}

async function mkweekPaint(){
  const host = document.getElementById('mkweekCols');
  const err = document.getElementById('mkweekError');
  err.textContent = '';
  host.innerHTML = '<p class="form-hint">Loading\u2026</p>';
  let data;
  try{
    data = await apiGetMaktabWeek(mkweekMonday);
  } catch(e){
    host.innerHTML = '';
    err.textContent = e.message;
    return;
  }
  const f = (d) => (typeof fmtDMY === 'function' ? fmtDMY(d) : d);
  document.getElementById('mkweekLabel').textContent =
    data.columns.length ? `${f(data.columns[0].date)} \u2013 ${f(data.columns[data.columns.length - 1].date)}` : f(mkweekMonday);

  if(!data.columns.length){
    host.innerHTML = '<p class="form-hint">No teaching days set \u2014 choose them in Maktab Settings.</p>';
    return;
  }

  const WD = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  const list = (title, names, cls) => names.length
    ? `<div class="mkweek-list ${cls}"><div class="mkweek-list-title">${title}</div>${names.map(n => `<div class="mkweek-name">${n}</div>`).join('')}</div>`
    : '';

  host.innerHTML = data.columns.map(c => {
    const head = `<div class="mkweek-col-head"><span class="mkweek-wd">${WD[c.weekday] || ''}</span><span class="mkweek-date">${f(c.date)}</span></div>`;
    if(c.note){
      // a labelled non-day: shown, never skipped
      return `<div class="mkweek-col mkweek-col-off" data-date="${c.date}">${head}<div class="mkweek-note">${c.note}</div></div>`;
    }
    const body = c.past
      ? list('Present', c.present, 'mkweek-present') + list('Absent', c.absent, 'mkweek-absent') + list("Haa'idha", c.haidh, 'mkweek-haidh')
      : list("Haa'idha (predicted)", c.predictedHaidh, 'mkweek-haidh') + list('Absent (informed)', c.predictedAbsent, 'mkweek-absent');
    // V4.2.2 (user): the REGISTER icon — one sheet for the whole day, so a
    // teacher marks several students at once instead of visiting each.
    const add = `<button type="button" class="mkweek-add" data-register="${c.date}" data-past="${c.past ? '1' : ''}">${c.past ? 'Mark register' : '+ Add'}</button>`;
    return `<div class="mkweek-col${c.past ? '' : ' mkweek-col-future'}" data-date="${c.date}">${head}${body || '<div class="mkweek-note">\u2014</div>'}${add}</div>`;
  }).join('');

  host.querySelectorAll('.mkweek-add').forEach(b =>
    b.addEventListener('click', () => mkweekOpenRegister(b.dataset.register, !!b.dataset.past, data)));
}

// The teacher's forward-looking entry: mark a student expected haa'idha
// or expected absent on a future day. Haidh writes through the SAME
// shared store a student's own journal uses (the teacher path that has
// existed since V3.76.0); 'predicted-absent' is a planning marker only
// and never touches the attendance stats (user: informing is courtesy,
// not excusal).
// ============================================================
// V4.2.2 — THE MARK REGISTER SHEET (user, improving Claude's one-at-a-
// time idea). One sheet per day, listing the active students, so several
// are marked in one sitting.
//
// It ADAPTS to the day, because absence means different things either
// side of today:
//   TODAY / FUTURE → Haidh · Absent · Clear. An explicit mark is the ONLY
//     way anything is recorded here (V4.0.2 made today deliberately
//     unresolved), so this is where the register is genuinely taken.
//   PAST → Haidh · Clear, with each student's DERIVED state shown, so the
//     teacher sees what she is correcting. "Absent" is not offered: the
//     derivation already infers it from "no log", so the mark would add
//     nothing.
// The V3.98/V4.0.2 rulings stand: haidh excuses, an informed absence
// never does.
// ============================================================
function mkweekOpenRegister(date, past, data){
  const students = data.students || [];
  const col = (data.columns || []).find(c => c.date === date) || {};
  const stateOf = (name) => {
    if((col.haidh || []).includes(name) || (col.predictedHaidh || []).includes(name)) return 'haidh';
    if((col.present || []).includes(name)) return 'present';
    if((col.predictedAbsent || []).includes(name)) return 'absent-informed';
    if((col.absent || []).includes(name)) return 'absent';
    return '';
  };
  const STATE_TEXT = { haidh: "Haa'idha", present: 'Present', absent: 'Absent', 'absent-informed': 'Absent (informed)' };
  const f = (d) => (typeof fmtDMY === 'function' ? fmtDMY(d) : d);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay history-popup-modal';
  overlay.innerHTML = `<div class="modal-card mkweek-register-card">
    <button type="button" class="close-btn" id="mkregClose">&times;</button>
    <h2>Register \u2014 ${f(date)}</h2>
    <div class="form-hint">${past
      ? 'Correct the record: mark a day as haa\u2019idha, or clear a mark. Absence is derived from the logs, so it is not set here.'
      : 'Mark who is expected haa\u2019idha, or absent because she has told the maktab. An informed absence does not excuse attendance.'}</div>
    <div class="mkreg-list">${students.map(s => `
      <div class="mkreg-row" data-id="${s.id}">
        <span class="mkreg-name">${s.name}</span>
        <span class="mkreg-state">${STATE_TEXT[stateOf(s.name)] || ''}</span>
        <span class="mkreg-actions">
          <button type="button" class="mkreg-btn" data-set="haidh">Haidh</button>
          ${past ? '' : '<button type="button" class="mkreg-btn" data-set="absent">Absent</button>'}
          <button type="button" class="mkreg-btn mkreg-clear" data-set="clear">Clear</button>
        </span>
      </div>`).join('')}</div>
    <div class="form-error" id="mkregError"></div>
  </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if(e.target === overlay) close(); });
  overlay.querySelector('#mkregClose').addEventListener('click', async () => { close(); await mkweekPaint(); });
  overlay.querySelectorAll('.mkreg-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.mkreg-row');
      const id = row.dataset.id;
      const what = btn.dataset.set;
      const err = overlay.querySelector('#mkregError');
      err.textContent = '';
      row.querySelectorAll('.mkreg-btn').forEach(b => { b.disabled = true; });
      try{
        if(what === 'clear'){
          await apiClearAttendanceFor(id, date);
          row.querySelector('.mkreg-state').textContent = '';
        } else {
          // haidh on a past/today column is a CONFIRMED mark; ahead of
          // today it is a prediction — the same distinction the calendar
          // draws. 'absent' here is the informed-absence marker.
          const status = what === 'haidh' ? (past ? 'haidh' : 'predicted-haidh') : 'predicted-absent';
          await apiSetAttendanceFor(id, date, status);
          row.querySelector('.mkreg-state').textContent = what === 'haidh' ? "Haa'idha" : 'Absent (informed)';
        }
      } catch(e){
        err.textContent = e.message;
      }
      row.querySelectorAll('.mkreg-btn').forEach(b => { b.disabled = false; });
    });
  });
}

