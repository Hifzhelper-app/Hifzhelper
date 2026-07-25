// ============================================================
// Hifzhelper — Sabaq Dhor detail page
// SCOPE NOTE: `zone` is meant to be computed automatically from the
// student's position/study-order data (see SCHEMA.md) — that computation
// isn't wired into the V3 frontend yet (position.json isn't fetched
// anywhere in this codebase so far), so this stays a manual text field
// for now rather than faking a computed value. Flagged, not hidden.
// ============================================================

let sabaqDhorSelectedTags = [];

async function renderSabaqDhorScreen(){
  sabaqDhorSelectedTags = [];
  document.getElementById('sabaqDhor_zone').value = '';
  document.getElementById('sabaqDhor_mistakes').value = '0';
  renderTajweedPicker('sabaqDhorTajweedPicker', sabaqDhorSelectedTags);
  renderCommentBlock('sabaqDhorCommentBlock', null);
  await renderRecentEntries('sabaqDhor', apiSabaqDhor, 'sabaqDhorRecentRail');
}

document.getElementById('sabaqDhorSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('sabaqDhorError');
  errEl.textContent = '';
  const payload = {
    date: todayISO(),
    zone: document.getElementById('sabaqDhor_zone').value || null,
    mistakes: parseInt(document.getElementById('sabaqDhor_mistakes').value) || 0,
    tajweed_tags: sabaqDhorSelectedTags.join(','),
    ...readCommentBlock()
  };
  try{
    await apiSabaqDhor.save(payload);
    document.getElementById('sabaqDhorSaveStatus').classList.add('show');
    setTimeout(() => document.getElementById('sabaqDhorSaveStatus').classList.remove('show'), 1800);
    await renderRecentEntries('sabaqDhor', apiSabaqDhor, 'sabaqDhorRecentRail');
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
});
