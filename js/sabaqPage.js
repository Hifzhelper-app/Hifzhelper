// ============================================================
// Hifzhelper — Sabaq card (one of 4 in the unified day-log view, V3.6.1)
// Has its own independent date selector (defaults to today on every open)
// so a missed day can be logged without affecting the other 3 cards —
// this only changes which `date` a NEW entry saves under; it does not
// load/edit an existing entry for that date (multiple entries per day
// are deliberately allowed app-wide — see SCHEMA.md).
// ============================================================

let sabaqSelectedTags = [];

async function renderSabaqScreen(){
  sabaqSelectedTags = [];
  populateSurahSelectInto('sabaq_surah');
  document.getElementById('sabaq_date').value = todayISO();
  document.getElementById('sabaq_ayah_from').value = '';
  document.getElementById('sabaq_ayah_to').value = '';
  renderTajweedPicker('sabaqTajweedPicker', sabaqSelectedTags);
  renderCommentBlock('sabaqCommentBlock', null);
  await renderRecentEntries('sabaq', apiSabaq, 'sabaqRecentRail');
}

document.getElementById('sabaqSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('sabaqError');
  errEl.textContent = '';
  const payload = {
    date: document.getElementById('sabaq_date').value || todayISO(),
    surah: parseInt(document.getElementById('sabaq_surah').value) || null,
    ayah_from: parseInt(document.getElementById('sabaq_ayah_from').value) || null,
    ayah_to: parseInt(document.getElementById('sabaq_ayah_to').value) || null,
    tajweed_tags: sabaqSelectedTags.join(','),
    ...readCommentBlock('sabaqCommentBlock')
  };
  try{
    await apiSabaq.save(payload);
    document.getElementById('sabaqSaveStatus').classList.add('show');
    setTimeout(() => document.getElementById('sabaqSaveStatus').classList.remove('show'), 1800);
    await renderRecentEntries('sabaq', apiSabaq, 'sabaqRecentRail');
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
});
