// ============================================================
// Hifzhelper -- Maktab summary screen (V3.61.0; first shipped V3.59.0,
// day-entry additions V3.60.0, this UI round from device screenshots
// confirmed in chat 2026-08-16).
// The teacher's view of ONE Hifz day: leading narrow haidh column,
// student names, then Sabaq | Sabaq Dhor | Dhor in the PJ journal's
// own cell shorthand (journalCellShorthand reused directly).
//
// V3.61.0 changes, all user-stated:
//   - DATE PICKER in line with the close icon (V3.50.1
//     native-input-as-tap-target pattern via wireCustomDateDisplay --
//     that pattern exists precisely because showPicker() no-ops on
//     iOS). Defaults to today; picking a past date re-renders the
//     grid for it, and the picked date FOLLOWS THROUGH to the day
//     view (backfill/corrections -- confirmed).
//   - Haidh control moved to its own NARROW LEADING column: a small
//     haidh icon acting as the haidh checkbox, so the controls line
//     up on the extreme left instead of trailing variable-length
//     names. Rendered ONLY for students with track_haidh (the same
//     Settings opt-in that gates the PJ's Haidh nav item) -- the
//     GLOBAL haidh-gating rule. It sits inside the whole-row tap
//     target, so it stops propagation -- the one deliberate
//     exception to the no-nested-controls rule the count badges
//     follow, because this control is an agreed requirement.
//   - Count badges stay downgraded to plain text (V3.59.0 decision).
// ============================================================

let maktabSummaryData = null;
let maktabSummarySelectedDate = null; // ISO; null until first render (defaults to today)

function maktabTodayISO(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// journalCellShorthand keys sabaqDhor cells on from_surah/from_ayah/
// to_surah/to_ayah and dhor cells on segment_from/segment_to -- the
// maktab tables carry identical columns, so rows pass straight through.
function maktabCellHtml(type, entries){
  const html = journalCellShorthand(type, entries);
  // downgrade the badge button to non-interactive text (see header)
  return html.replace(/<button type="button" class="entry-count-badge" data-count-badge>(\+\d+)<\/button>/, '<span class="entry-count-badge">$1</span>');
}

function maktabSummaryWireDate(){
  const input = document.getElementById('maktabSummaryDatePicker');
  if(!input) return;
  if(!input.value) input.value = maktabSummarySelectedDate || maktabTodayISO();
  if(typeof wireCustomDateDisplay === 'function') wireCustomDateDisplay('maktabSummaryDatePicker');
  if(!input.dataset.maktabWired){
    input.dataset.maktabWired = 'true';
    input.addEventListener('change', () => {
      if(!input.value) return;
      maktabSummarySelectedDate = input.value;
      renderMaktabSummaryScreen();
    });
  }
}

async function renderMaktabSummaryScreen(){
  const host = document.getElementById('maktabSummaryBody');
  if(!maktabSummarySelectedDate) maktabSummarySelectedDate = maktabTodayISO();
  const date = maktabSummarySelectedDate;
  maktabSummaryWireDate();
  const input = document.getElementById('maktabSummaryDatePicker');
  // programmatic sets keep the display pill in sync automatically --
  // wireCustomDateDisplay intercepts the value setter (the 2026-08-04
  // fix in customDate.js), no event needed.
  if(input && input.value !== date) input.value = date;
  host.innerHTML = '<tr><td colspan="5" class="journal-cell journal-cell-empty">Loading\u2026</td></tr>';

  // V3.59.1: respond() UNWRAPS on the worker (json(result.data)) -- the
  // response body IS the payload, no {data:...} envelope on the wire.
  // Shape-guarded so ANY malformed response renders the error row.
  let data;
  try {
    data = await apiMaktabSummary(date);
  } catch (e) {
    data = null;
  }
  if (!data || !Array.isArray(data.students)) {
    host.innerHTML = '<tr><td colspan="5" class="journal-cell journal-cell-empty">Could not load the maktab summary.</td></tr>';
    return;
  }
  maktabSummaryData = data;

  // group each table's rows by student for O(1) cell lookup
  const byStudent = { sabaq: {}, sabaqDhor: {}, dhor: {} };
  (data.sabaq || []).forEach(r => (byStudent.sabaq[r.student_id] = byStudent.sabaq[r.student_id] || []).push(r));
  (data.sabaq_dhor || []).forEach(r => (byStudent.sabaqDhor[r.student_id] = byStudent.sabaqDhor[r.student_id] || []).push(r));
  (data.dhor || []).forEach(r => (byStudent.dhor[r.student_id] = byStudent.dhor[r.student_id] || []).push(r));

  const haidhByStudent = {};
  (data.attendance || []).forEach(r => { haidhByStudent[r.student_id] = r.status; });

  host.innerHTML = '';
  (data.students || []).forEach(stu => {
    const tr = document.createElement('tr');
    tr.className = 'maktab-summary-row';

    // V3.61.0: leading narrow haidh column -- small haidh icon as the
    // checkbox, ONLY for haidh-tracking students (empty cell otherwise
    // so the grid stays aligned).
    const haidhTd = document.createElement('td');
    haidhTd.className = 'maktab-haidh-col';
    if(stu.track_haidh){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'maktab-haidh-check' + (haidhByStudent[stu.id] ? ' marked' : '');
      btn.innerHTML = iconHtml('haidh');
      btn.setAttribute('aria-label', 'Mark haidh for ' + stu.name);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        maktabMarkHaidhFlow(stu.id, () => renderMaktabSummaryScreen());
      });
      haidhTd.appendChild(btn);
    }
    tr.appendChild(haidhTd);

    const nameTd = document.createElement('td');
    nameTd.className = 'cell-date maktab-student-name';
    nameTd.textContent = stu.name;
    tr.appendChild(nameTd);

    const hasAnyLog = ['sabaq', 'sabaqDhor', 'dhor'].some(t => (byStudent[t][stu.id] || []).length);
    ['sabaq', 'sabaqDhor', 'dhor'].forEach(type => {
      const td = document.createElement('td');
      td.className = 'journal-cell';
      if(type === 'sabaq' && !hasAnyLog && haidhByStudent[stu.id]){
        td.className = 'journal-cell journal-cell-haidh';
        td.textContent = 'Haidh';
      } else {
        td.innerHTML = maktabCellHtml(type, byStudent[type][stu.id]);
      }
      tr.appendChild(td);
    });

    // whole row = one tap target (confirmed); carries the PICKED date
    // so past-day rows open the day view for that day (confirmed).
    tr.addEventListener('click', () => showScreen('maktabDay', { id: stu.id, name: stu.name, mushaf: stu.mushaf || null, track_haidh: !!stu.track_haidh, date }));
    host.appendChild(tr);
  });
  if (!(data.students || []).length) {
    host.innerHTML = '<tr><td colspan="5" class="journal-cell journal-cell-empty">No active students.</td></tr>';
  }
}
