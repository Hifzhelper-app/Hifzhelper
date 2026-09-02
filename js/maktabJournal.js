/* Hifzhelper build 4.2.6 | js/maktabJournal.js */
// ============================================================
// Hifzhelper -- student Maktab Journal (V3.59.0, maktab delivery (e1)).
// The student's READ-ONLY view over their own maktab logs -- what the
// teachers have confirmed -- kept fully separate from the PJ journal
// (confirmed in chat; a "combine views" option was floated and parked).
// Same table shape as the PJ journal (date | Sabaq | Sabaq Dhor | Dhor,
// css/journal-table.css classes reused), but:
//   - no Tadabbur column (reflections are personal, never maktab),
//   - no haidh row treatment (maktab attendance is derived, delivery (f)),
//   - cells are NOT tap-to-edit -- students don't edit maktab records;
//     count badges are downgraded to plain text (same deviation, and
//     the same reason, as the summary screen's cells).
// Privacy needs nothing here: the (d) GET already returns this user's
// own rows with teachers_only/private feedback nulled by applyPrivacy.
// ============================================================

async function renderMaktabJournalScreen(){
  const host = document.getElementById('maktabJournalBody');
  host.innerHTML = '<tr><td colspan="4" class="journal-cell journal-cell-empty">Loading\u2026</td></tr>';

  // V3.59.1: same wire-shape fix as maktabSummary.js -- the GETs resolve
  // DIRECTLY to the rows array (respond() unwraps); the V3.59.0 cut's
  // (rows.data || []) silently emptied every response, so this screen
  // showed "No maktab entries yet" even with entries.
  let sabaq, sabaqDhor, dhor;
  try {
    [sabaq, sabaqDhor, dhor] = await Promise.all([
      apiGetMaktabSabaq(), apiGetMaktabSabaqDhor(), apiGetMaktabDhor(),
    ]);
  } catch (e) {
    host.innerHTML = '<tr><td colspan="4" class="journal-cell journal-cell-empty">Could not load your maktab journal.</td></tr>';
    return;
  }

  const days = {};
  const add = (rows, type) => (Array.isArray(rows) ? rows : []).forEach(r => {
    (days[r.date] = days[r.date] || { sabaq: [], sabaqDhor: [], dhor: [] })[type].push(r);
  });
  add(sabaq, 'sabaq'); add(sabaqDhor, 'sabaqDhor'); add(dhor, 'dhor');

  const dates = Object.keys(days).sort().reverse();
  host.innerHTML = '';
  dates.forEach(date => {
    const tr = document.createElement('tr');
    const dateTd = document.createElement('td');
    dateTd.className = 'cell-date';
    dateTd.innerHTML = formatDateCell(date);
    tr.appendChild(dateTd);
    ['sabaq', 'sabaqDhor', 'dhor'].forEach(type => {
      const td = document.createElement('td');
      td.className = 'journal-cell';
      td.innerHTML = maktabCellHtml(type, days[date][type]);
      tr.appendChild(td);
    });
    // V3.71.0: the whole row opens that maktab day's log cards, READ ONLY —
    // same shared cards a teacher sees, same tap-the-whole-row target the
    // maktab summary uses. The context names HER (currentUser), so the
    // student-scoped clients ask for her own rows and the worker would 403
    // anything else.
    tr.classList.add('maktab-journal-row');
    tr.addEventListener('click', async () => {
      setMaktabLogContext(
        { id: currentUser.id, name: currentUser.name || currentUser.id, track_haidh: currentUser.trackHaidh },
        date,
        { readOnly: true }
      );
      await showScreen('logDetail', 'sabaq');
    });
    host.appendChild(tr);
  });
  if (!dates.length) {
    host.innerHTML = '<tr><td colspan="4" class="journal-cell journal-cell-empty">No maktab entries yet.</td></tr>';
  }
}
