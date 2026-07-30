// ============================================================
// Hifzhelper -- Sabaq Dhor card (one of 4 in the unified day-log view, V3.6.1)
// V3.13.0: rebuilt around position (js/position.js) -- confirmed in chat,
// Sabaq Dhor recites the CURRENT juz' from its start up to wherever Sabaq
// has reached, excluding today's brand-new portion, replacing the earlier
// "beginning of Quran / halfway point" rule entirely. Shown as a checklist
// of quarter-sized sections (the quarter Sabaq is currently in, plus each
// already-completed quarter before it, at most 3, since a juz' has 4
// quarters and the 4th-equivalent is always in progress) -- each
// prepopulated checked, since these are derived from what's actually been
// memorised; the student unchecks anything they didn't actually revise
// today. Whichever stay checked at save time are composited into one
// overall from/to ayah range (migration 0014's from_surah/from_ayah/
// to_surah/to_ayah), replacing the old free-text `zone` field.
//
// Has its own independent date selector (defaults to today on every open)
// -- same reasoning as the Sabaq card: only changes which `date` a NEW
// entry saves under, doesn't load/edit an existing entry for that date.
// ============================================================

let sabaqDhorSelectedTags = [];
let sabaqDhorSections = [];
let sabaqDhorRef = 'waterval';

function refForMushafSabaqDhor(mushaf){ return mushaf === '15line_madani' ? 'uthmani' : 'waterval'; }

function renderSabaqDhorSections(){
  const el = document.getElementById('sabaqDhor_sections');
  if(sabaqDhorSections.length === 0){
    el.innerHTML = `<p class="form-hint">Nothing to revise yet -- log a Sabaq entry first.</p>`;
    return;
  }
  el.innerHTML = sabaqDhorSections.map((s, i) => `
    <label class="sabaq-dhor-section-row">
      <input type="checkbox" class="sabaqDhor-section-cb" data-index="${i}" checked>
      ${s.fromSurah}:${s.fromAyah} - ${s.toSurah}:${s.toAyah}${s.complete ? '' : ' (today so far)'}
    </label>
  `).join('');
}

async function renderSabaqDhorScreen(){
  sabaqDhorSelectedTags = [];
  document.getElementById('sabaqDhor_date').value = todayISO();
  document.getElementById('sabaqDhor_mistakes').value = '0';

  let profile = null;
  try{ profile = await apiGetProfile(); } catch(e){ profile = null; }
  sabaqDhorRef = refForMushafSabaqDhor(profile && profile.mushaf);
  const position = await loadPosition();
  sabaqDhorSections = computeSabaqDhorSections(position, sabaqDhorRef);
  renderSabaqDhorSections();

  renderTajweedPicker('sabaqDhorTajweedPicker', sabaqDhorSelectedTags);
  renderCommentBlock('sabaqDhorCommentBlock', null);
  await renderRecentEntries('sabaqDhor', apiSabaqDhor, 'sabaqDhorRecentRail');
}

// Composites whichever sections stayed checked into one overall from/to
// range -- earliest checked section's start to the latest checked
// section's end. Returns null if nothing's checked (nothing to save).
function compositeCheckedSabaqDhorSections(){
  const checkedIndices = Array.from(document.querySelectorAll('.sabaqDhor-section-cb:checked'))
    .map(cb => parseInt(cb.dataset.index, 10));
  if(checkedIndices.length === 0) return null;
  const checked = checkedIndices.map(i => sabaqDhorSections[i]);
  let from = checked[0], to = checked[0];
  for(const s of checked){
    if(compareVerseKey(s.fromSurah, s.fromAyah, from.fromSurah, from.fromAyah) < 0) from = s;
    if(compareVerseKey(s.toSurah, s.toAyah, to.toSurah, to.toAyah) > 0) to = s;
  }
  return { fromSurah: from.fromSurah, fromAyah: from.fromAyah, toSurah: to.toSurah, toAyah: to.toAyah };
}

document.getElementById('sabaqDhorSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('sabaqDhorError');
  errEl.textContent = '';
  const range = compositeCheckedSabaqDhorSections();
  if(!range){
    errEl.textContent = 'Please check at least one section that was actually revised today.';
    return;
  }
  const payload = {
    date: document.getElementById('sabaqDhor_date').value || todayISO(),
    from_surah: range.fromSurah, from_ayah: range.fromAyah,
    to_surah: range.toSurah, to_ayah: range.toAyah,
    mistakes: parseInt(document.getElementById('sabaqDhor_mistakes').value) || 0,
    tajweed_tags: sabaqDhorSelectedTags.join(','),
    ...readCommentBlock('sabaqDhorCommentBlock')
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
