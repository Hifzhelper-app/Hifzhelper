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

  // V3.59.1: respond() UNWRAPS on the worker (json(result.data)) -- the
  // response body IS the payload, there is no {data:...} envelope on the
  // wire (the V3.40.3 apiGetAttendance note documents this same class).
  // The V3.59.0 first cut took .data off the payload -> undefined ->
  // TypeError past the catch, "Loading..." stuck forever (reported by
  // console screenshot). Shape-guarded now so ANY malformed response
  // renders the error row instead of throwing.
  let data;
  try {
    data = await apiMaktabSummary(today);
  } catch (e) {
    data = null;
  }
  if (!data || !Array.isArray(data.students)) {
    host.innerHTML = '<tr><td colspan="4" class="journal-cell journal-cell-empty">Could not load the maktab summary.</td></tr>';
    return;
  }
  maktabSummaryData = data;

  // group each table's rows by student for O(1) cell lookup
  const byStudent = { sabaq: {}, sabaqDhor: {}, dhor: {} };
  (data.sabaq || []).forEach(r => (byStudent.sabaq[r.student_id] = byStudent.sabaq[r.student_id] || []).push(r));
  (data.sabaq_dhor || []).forEach(r => (byStudent.sabaqDhor[r.student_id] = byStudent.sabaqDhor[r.student_id] || []).push(r));
  (data.dhor || []).forEach(r => (byStudent.dhor[r.student_id] = byStudent.dhor[r.student_id] || []).push(r));

  // V3.60.0 ((e2)): today's haidh marks ride the summary payload —
  // shown in the Sabaq cell ONLY when the student has no logs at all
  // (the PJ journal's own rule: any log cancels the haidh display).
  const haidhByStudent = {};
  (data.attendance || []).forEach(r => { haidhByStudent[r.student_id] = r.status; });

  host.innerHTML = '';
  (data.students || []).forEach(stu => {
    const tr = document.createElement('tr');
    tr.className = 'maktab-summary-row';
    const nameTd = document.createElement('td');
    nameTd.className = 'cell-date maktab-student-name';
    nameTd.textContent = stu.name;
    // V3.60.0 ((e2), confirmed in chat: haidh entry from BOTH surfaces):
    // a small per-row control. Nested inside the whole-row tap target,
    // so it stops propagation — the one deliberate exception to the
    // no-nested-controls rule the badges follow, because this control
    // is an agreed requirement, not decoration.
    const haidhBtn = document.createElement('button');
    haidhBtn.type = 'button';
    haidhBtn.className = 'maktab-row-haidh-btn';
    haidhBtn.textContent = 'H';
    haidhBtn.title = 'Mark haidh';
    haidhBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      maktabMarkHaidhFlow(stu.id, () => renderMaktabSummaryScreen());
    });
    nameTd.appendChild(haidhBtn);
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
    // whole row = one tap target (confirmed in chat)
    tr.addEventListener('click', () => showScreen('maktabDay', { id: stu.id, name: stu.name, mushaf: stu.mushaf || null }));
    host.appendChild(tr);
  });
  if (!(data.students || []).length) {
    host.innerHTML = '<tr><td colspan="4" class="journal-cell journal-cell-empty">No active students.</td></tr>';
  }
}

