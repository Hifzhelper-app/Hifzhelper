// ============================================================
// Hifzhelper -- Maktab summary screen (V3.59.0, maktab delivery (e1)).
// The teacher's view of TODAY's Hifz day (confirmed in chat: today
// only): first column student names, then Sabaq | Sabaq Dhor | Dhor
// with the SAME cell shorthand as the PJ journal table -- reused
// directly (journalCellShorthand/describeDhorSegment are plain global
// functions from journal.js/dhorPage.js, loaded before this file; a
// pure-function reuse, no PJ behaviour threaded through).
// Teacher+ only -- the nav item is role-gated (js/auth.js), and the
// endpoint itself 403s anyone else, so a hand-typed URL shows the
// error state, not data.
// The WHOLE ROW is one tap target (confirmed in chat) -> the maktab
// day view for that student. In (e1) that target screen is a
// placeholder (see js/maktabDay.js's placeholder note in index.html);
// the real 3-card entry view is delivery (e2).
// Count badges: journalCellShorthand emits a "+N" popup-trigger
// button; the PJ wires it to an entries popup. Here the row is one
// tap target, so nested interactive elements would fight it --
// badges are downgraded to plain text spans after formatting
// (documented deviation, (e2) revisits when the day view can show
// every entry).
// ============================================================

let maktabSummaryData = null;

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

async function renderMaktabSummaryScreen(){
  const host = document.getElementById('maktabSummaryBody');
  const dateEl = document.getElementById('maktabSummaryDate');
  const today = maktabTodayISO();
  dateEl.textContent = formatDateCell ? formatDateCell(today).replace(/<[^>]*>/g, ' ').trim() : today;
  host.innerHTML = '<tr><td colspan="4" class="journal-cell journal-cell-empty">Loading\u2026</td></tr>';

  let data;
  try {
    data = (await apiMaktabSummary(today)).data;
  } catch (e) {
    host.innerHTML = '<tr><td colspan="4" class="journal-cell journal-cell-empty">Could not load the maktab summary.</td></tr>';
    return;
  }
  maktabSummaryData = data;

  // group each table's rows by student for O(1) cell lookup
  const byStudent = { sabaq: {}, sabaqDhor: {}, dhor: {} };
  (data.sabaq || []).forEach(r => (byStudent.sabaq[r.student_id] = byStudent.sabaq[r.student_id] || []).push(r));
  (data.sabaq_dhor || []).forEach(r => (byStudent.sabaqDhor[r.student_id] = byStudent.sabaqDhor[r.student_id] || []).push(r));
  (data.dhor || []).forEach(r => (byStudent.dhor[r.student_id] = byStudent.dhor[r.student_id] || []).push(r));

  host.innerHTML = '';
  (data.students || []).forEach(stu => {
    const tr = document.createElement('tr');
    tr.className = 'maktab-summary-row';
    const nameTd = document.createElement('td');
    nameTd.className = 'cell-date maktab-student-name';
    nameTd.textContent = stu.name;
    tr.appendChild(nameTd);
    ['sabaq', 'sabaqDhor', 'dhor'].forEach(type => {
      const td = document.createElement('td');
      td.className = 'journal-cell';
      td.innerHTML = maktabCellHtml(type, byStudent[type][stu.id]);
      tr.appendChild(td);
    });
    // whole row = one tap target (confirmed in chat)
    tr.addEventListener('click', () => showScreen('maktabDay', { id: stu.id, name: stu.name }));
    host.appendChild(tr);
  });
  if (!(data.students || []).length) {
    host.innerHTML = '<tr><td colspan="4" class="journal-cell journal-cell-empty">No active students.</td></tr>';
  }
}

// (e1) placeholder for the day view -- (e2) replaces this with the real
// 3-card entry screen. Kept minimal on purpose: name + explanation, so
// the row-tap navigation is real and testable now.
function renderMaktabDayScreen(param){
  const el = document.getElementById('maktabDayContent');
  const name = param && param.name ? param.name : 'Student';
  el.innerHTML = '<h2 class="maktab-day-name"></h2><p class="maktab-day-placeholder">Log entry for this student is coming in the next update. Their saved entries for today already show on the Maktab summary.</p>';
  el.querySelector('.maktab-day-name').textContent = name;
}
