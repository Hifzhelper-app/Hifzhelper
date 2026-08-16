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
  const add = (rows, type) => (rows.data || []).forEach(r => {
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
    host.appendChild(tr);
  });
  if (!dates.length) {
    host.innerHTML = '<tr><td colspan="4" class="journal-cell journal-cell-empty">No maktab entries yet.</td></tr>';
  }
}
