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
//     haidh icon (V3.76.0: a LINK to the student's haidh calendar,
//     showing the date's state; it was the haidh checkbox until then),
//     so the controls line up on the extreme left instead of trailing
//     variable-length names. Rendered ONLY for students with track_haidh (the same
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
  // V3.74.2: the badge is a real button again. It had been downgraded to a
  // span, which is precisely WHY tapping it opened the day view — with no
  // button to catch the tap it fell through to the row. Now it opens a
  // read-only list of that cell's entries and stops there.
  return html.replace(
    /<button type="button" class="entry-count-badge" data-count-badge>(\+\d+)<\/button>/,
    `<button type="button" class="entry-count-badge" data-entry-peek="${type}">$1</button>`
  );
}

// A read-only peek at every entry in one cell — including the one already
// shown, so the list is the whole truth rather than "the others".
// Deliberately not tappable: the row still opens the day view, so no route
// is lost, and this stays a glance rather than a second way in.
function maktabCloseEntryPeek(){
  const el = document.getElementById('maktabEntryPeek');
  if(el) el.remove();
}

function maktabOpenEntryPeek(btn, type, entries){
  maktabCloseEntryPeek();
  const panel = document.createElement('div');
  panel.id = 'maktabEntryPeek';
  panel.className = 'maktab-entry-peek';
  panel.innerHTML = (entries || []).map(e =>
    `<div class="maktab-entry-peek-row">${journalCellShorthand(type, [e]).replace(/<[^>]+>/g, '')}</div>`
  ).join('') || '<div class="maktab-entry-peek-row">No entries</div>';
  document.body.appendChild(panel);
  const r = btn.getBoundingClientRect();
  // Anchored to the badge, flipped up when there is no room below —
  // summary rows sit near the bottom of the card on a short screen.
  const below = window.innerHeight - r.bottom;
  panel.style.left = Math.min(r.left, window.innerWidth - panel.offsetWidth - 8) + 'px';
  if(below < panel.offsetHeight + 12){
    panel.style.top = (r.top - panel.offsetHeight - 6) + 'px';
  } else {
    panel.style.top = (r.bottom + 6) + 'px';
  }
}

// V3.75.0 (item 4): this listener only CLOSES the peek now. Opening moved
// onto the badge button itself (see the render below) — delegated here it
// ran after the <tr>'s own click handler and could not stop the day view
// opening. A badge click never reaches document (the button stops it), so
// the click-away close cannot fire against the badge that just opened it.
document.addEventListener('click', (e) => {
  if(!e.target.closest || !e.target.closest('#maktabEntryPeek')) maktabCloseEntryPeek();
});

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
  let data, loadErr = null;
  try {
    data = await apiMaktabSummary(date);
  } catch (e) {
    data = null;
    loadErr = e;
  }
  if (!data || !Array.isArray(data.students)) {
    // V3.75.0 (item 6): carry the worker's message rather than a fixed
    // line. Set via textContent, so a message containing markup is text.
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'journal-cell journal-cell-empty';
    td.textContent = 'Could not load the maktab summary: ' + ((loadErr && loadErr.message) || 'unexpected response');
    host.innerHTML = '';
    const tr = document.createElement('tr'); tr.appendChild(td); host.appendChild(tr);
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

  // V3.67.0 (delivery (f)): derived attendance — absent / haidh
  // propagation / the attention flag. Fetched alongside, and failing
  // softly: a summary that can still show today's entries is more useful
  // than an error, and every value here is derived rather than recorded.
  let derived = {};
  let isMaktabDay = false;
  try {
    const att = await apiGetMaktabAttendance(date);
    if(att && att.attendance){ derived = att.attendance; isMaktabDay = !!att.isMaktabDay; }
  } catch(e){ derived = {}; }

  host.innerHTML = '';
  (data.students || []).forEach(stu => {
    const tr = document.createElement('tr');
    tr.className = 'maktab-summary-row';

    // V3.61.0: leading narrow haidh column -- small haidh icon, ONLY for
    // haidh-tracking students (empty cell otherwise so the grid stays
    // aligned).
    // V3.76.0 (Phase 2): it is a LINK now, not a toggle. It still shows the
    // date's state (.marked), but tapping it opens the shared haidh calendar
    // for this student, on the month of the picked date, where haidh is
    // marked as a range. The single-day toggle with its 15-day confirm is
    // deleted (js/maktabDay.js). stopPropagation stays: the row itself
    // still opens the day view.
    const haidhTd = document.createElement('td');
    haidhTd.className = 'maktab-haidh-col';
    if(stu.track_haidh){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'maktab-haidh-check' + (haidhByStudent[stu.id] ? ' marked' : '');
      btn.innerHTML = iconHtml('haidh');
      btn.setAttribute('aria-label', 'Open haidh calendar for ' + stu.name);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openMaktabHaidhCalendar(stu, date);
      });
      haidhTd.appendChild(btn);
    }
    tr.appendChild(haidhTd);

    const nameTd = document.createElement('td');
    nameTd.className = 'cell-date maktab-student-name';
    const nameSpan = document.createElement('span');
    nameSpan.textContent = stu.name;
    nameTd.appendChild(nameSpan);
    // V3.72.0: the Setup chip is GONE from this row. Setup opens from the
    // Dhor card's own button now — it configures the Dhor pool and nothing
    // else, so it belongs with Dhor rather than on a row spanning all three
    // log types. The V3.66.0 concern that made it a small explicit control
    // (saving REPLACES her pool, so it must not be reachable by a mis-tap
    // meant for the day view) is satisfied differently: it is no longer on
    // the tappable row at all.
    tr.appendChild(nameTd);

    const hasAnyLog = ['sabaq', 'sabaqDhor', 'dhor'].some(t => (byStudent[t][stu.id] || []).length);
    ['sabaq', 'sabaqDhor', 'dhor'].forEach(type => {
      const td = document.createElement('td');
      td.className = 'journal-cell';
      const d = derived[stu.id];
      if(type === 'sabaq' && !hasAnyLog && (haidhByStudent[stu.id] || (d && d.status === 'haidh'))){
        td.className = 'journal-cell journal-cell-haidh';
        // "Haidh" covers both an explicit mark and a propagated day —
        // the teacher does not need to know which; both mean the same
        // thing on the register.
        td.textContent = 'Haidh';
      } else if(type === 'sabaq' && !hasAnyLog && d && d.status === 'absent'){
        td.className = 'journal-cell journal-cell-absent';
        td.textContent = 'Absent';
      } else {
        td.innerHTML = maktabCellHtml(type, byStudent[type][stu.id]);
        // V3.74.2: the peek reads its entries from the cell rather than
        // re-querying — the rows are already here, and re-deriving them
        // from the DOM would be parsing text back into data.
        td._peekEntries = byStudent[type][stu.id];
        // V3.75.0 (item 4): wired DIRECTLY on the badge. V3.74.2 handled it
        // by delegation on document, but the row's day-view handler is on
        // the <tr> itself — so during bubbling the row fired FIRST and
        // opened the day view, and the stopPropagation at document level
        // came too late to matter. A listener on the button runs before
        // the tap ever reaches the row. The rows are rebuilt on every
        // render, so this cannot leak: the old buttons go with the old
        // rows.
        const peekBtn = td.querySelector('[data-entry-peek]');
        if(peekBtn){
          peekBtn.addEventListener('click', (e) => {
            e.stopPropagation();   // must NOT reach the row's day-view nav
            maktabOpenEntryPeek(peekBtn, type, td._peekEntries);
          });
        }
      }
      tr.appendChild(td);
    });

    // attention flag: the row is tinted when a student has gone
    // absence_flag_days consecutive MAKTAB DAYS without an entry.
    if(derived[stu.id] && derived[stu.id].flagged) tr.classList.add('maktab-row-flagged');

    // whole row = one tap target (confirmed); carries the PICKED date
    // so past-day rows open the day view for that day (confirmed).
    // V3.64.0: opens the PJ's OWN day view with a maktab context — not a
    // maktab copy of it. See js/logContext.js.
    tr.addEventListener('click', () => openMaktabDay({ id: stu.id, name: stu.name, mushaf: stu.mushaf || null, track_haidh: !!stu.track_haidh }, date));
    host.appendChild(tr);
  });
  if (!(data.students || []).length) {
    host.innerHTML = '<tr><td colspan="5" class="journal-cell journal-cell-empty">No active students.</td></tr>';
  }
}
