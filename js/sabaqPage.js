// ============================================================
// Hifzhelper — Sabaq detail page
// ============================================================

let sabaqSelectedTags = [];

async function renderSabaqScreen(){
  sabaqSelectedTags = [];
  populateSurahSelectInto('sabaq_surah');
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
    date: todayISO(),
    surah: parseInt(document.getElementById('sabaq_surah').value) || null,
    ayah_from: parseInt(document.getElementById('sabaq_ayah_from').value) || null,
    ayah_to: parseInt(document.getElementById('sabaq_ayah_to').value) || null,
    tajweed_tags: sabaqSelectedTags.join(','),
    ...readCommentBlock()
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
