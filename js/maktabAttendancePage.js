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
    const add = c.past ? '' : `<button type="button" class="mkweek-add" data-date="${c.date}">+ Add</button>`;
    return `<div class="mkweek-col${c.past ? '' : ' mkweek-col-future'}" data-date="${c.date}">${head}${body || '<div class="mkweek-note">\u2014</div>'}${add}</div>`;
  }).join('');

  host.querySelectorAll('.mkweek-add').forEach(b =>
    b.addEventListener('click', () => mkweekOpenAdd(b.dataset.date, data.students || [])));
}

// The teacher's forward-looking entry: mark a student expected haa'idha
// or expected absent on a future day. Haidh writes through the SAME
// shared store a student's own journal uses (the teacher path that has
// existed since V3.76.0); 'predicted-absent' is a planning marker only
// and never touches the attendance stats (user: informing is courtesy,
// not excusal).
function mkweekOpenAdd(date, students){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay history-popup-modal';
  const f = (d) => (typeof fmtDMY === 'function' ? fmtDMY(d) : d);
  overlay.innerHTML = `<div class="modal-card mkweek-add-card">
    <button type="button" class="close-btn" id="mkweekAddClose">&times;</button>
    <h2>Add \u2014 ${f(date)}</h2>
    <label for="mkweekAddStudent">Student</label>
    <select id="mkweekAddStudent">${students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
    <label for="mkweekAddKind">Expected</label>
    <select id="mkweekAddKind">
      <option value="predicted-haidh">Haa'idha</option>
      <option value="predicted-absent">Absent (informed the maktab)</option>
    </select>
    <div class="cal-stage-actions">
      <button type="button" class="secondary" id="mkweekAddCancel">Cancel</button>
      <button type="button" class="history-btn" id="mkweekAddSave">Add</button>
    </div>
    <div class="form-error" id="mkweekAddError"></div>
  </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if(e.target === overlay) close(); });
  overlay.querySelector('#mkweekAddClose').addEventListener('click', close);
  overlay.querySelector('#mkweekAddCancel').addEventListener('click', close);
  overlay.querySelector('#mkweekAddSave').addEventListener('click', async () => {
    const btn = overlay.querySelector('#mkweekAddSave');
    btn.disabled = true;
    try{
      await apiSetAttendanceFor(
        overlay.querySelector('#mkweekAddStudent').value,
        date,
        overlay.querySelector('#mkweekAddKind').value
      );
      close();
      await mkweekPaint();
    } catch(e){
      overlay.querySelector('#mkweekAddError').textContent = e.message;
      btn.disabled = false;
    }
  });
}
