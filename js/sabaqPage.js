// ============================================================
// Hifzhelper — Sabaq card (one of 4 in the unified day-log view, V3.6.1)
// V3.12.0: position-driven — on open, fetches the student's position
// (js/position.js) and profile (for mushaf/ref) and prepopulates
// surah/ayah_from from wherever Sabaq last reached, per the confirmed
// study order (juz' 30 first, backwards through its surahs; then 29
// forwards; then 1-28 ascending -- see shared/data.js's
// SABAQ_STUDY_ORDER). A brand new student with no position yet starts at
// Surah An-Nas (114:1), the first surah in that order.
//
// Once ayah_to is filled in, line_count/page_count are auto-computed
// (getLines13ForAyahRange for 13-line/Hybrid, getLines15ForAyahRange for
// 15-line -- both built in earlier deliveries, unused until now) and shown
// editable, since the underlying figures are estimates (13-line) or can
// still need a manual correction (15-line).
//
// On save: position advances to the saved ayah_to. If that completes the
// current juz' (nothing left of it to sabaq), the NEXT juz' in study
// order becomes current, and the just-completed juz' is added to Hifz
// Setup's baseline_selection automatically -- confirmed in chat, no manual
// Juz' grid check-off needed for a juz' finished this way.
//
// Has its own independent date selector (defaults to today on every open)
// so a missed day can be logged without affecting the other 3 cards --
// this only changes which `date` a NEW entry saves under, doesn't load/
// edit an existing entry for that date (multiple entries per day are
// deliberately allowed app-wide -- see SCHEMA.md).
// ============================================================

let sabaqSelectedTags = [];
let sabaqPosition = null;
let sabaqRef = 'waterval';

function refForMushafSabaq(mushaf){ return mushaf === '15line_madani' ? 'uthmani' : 'waterval'; }
function formatVerseRef(surah, ayah){ return `${surah}:${ayah}`; }

async function renderSabaqScreen(){
  sabaqSelectedTags = [];
  document.getElementById('sabaq_date').value = todayISO();
  populateSurahSelectInto('sabaq_surah');
  document.getElementById('sabaq_ayah_to').value = '';
  document.getElementById('sabaq_line_count').value = '';
  document.getElementById('sabaq_page_count').value = '';

  let profile = null;
  try{ profile = await apiGetProfile(); } catch(e){ profile = null; }
  sabaqRef = refForMushafSabaq(profile && profile.mushaf);
  sabaqPosition = await loadPosition();

  const start = nextSabaqDefault(sabaqPosition, sabaqRef);
  document.getElementById('sabaq_surah').value = String(start.surah);
  document.getElementById('sabaq_ayah_from').value = String(start.ayah);

  renderTajweedPicker('sabaqTajweedPicker', sabaqSelectedTags);
  renderCommentBlock('sabaqCommentBlock', null);
  await renderRecentEntries('sabaq', apiSabaq, 'sabaqRecentRail');
}

function recomputeSabaqLineCount(){
  const surah = parseInt(document.getElementById('sabaq_surah').value, 10);
  const ayahFrom = parseInt(document.getElementById('sabaq_ayah_from').value, 10);
  const ayahTo = parseInt(document.getElementById('sabaq_ayah_to').value, 10);
  if(!surah || !ayahFrom || !ayahTo) return;
  const result = sabaqRef === 'uthmani'
    ? getLines15ForAyahRange(surah, ayahFrom, ayahTo)
    : getLines13ForAyahRange(surah, ayahFrom, ayahTo);
  if(!result) return;
  document.getElementById('sabaq_line_count').value = result.lineCount;
  document.getElementById('sabaq_page_count').value = result.pageCount;
}
document.getElementById('sabaq_ayah_to').addEventListener('change', recomputeSabaqLineCount);

document.getElementById('sabaqSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('sabaqError');
  errEl.textContent = '';
  const surah = parseInt(document.getElementById('sabaq_surah').value) || null;
  const ayahFrom = parseInt(document.getElementById('sabaq_ayah_from').value) || null;
  const ayahTo = parseInt(document.getElementById('sabaq_ayah_to').value) || null;
  const payload = {
    date: document.getElementById('sabaq_date').value || todayISO(),
    surah, ayah_from: ayahFrom, ayah_to: ayahTo,
    line_count: parseInt(document.getElementById('sabaq_line_count').value) || null,
    page_count: parseInt(document.getElementById('sabaq_page_count').value) || null,
    tajweed_tags: sabaqSelectedTags.join(','),
    ...readCommentBlock('sabaqCommentBlock')
  };
  try{
    await apiSabaq.save(payload);
    document.getElementById('sabaqSaveStatus').classList.add('show');
    setTimeout(() => document.getElementById('sabaqSaveStatus').classList.remove('show'), 1800);

    if(surah && ayahTo){
      try{
        const adv = advancePositionAfterSabaq(sabaqPosition, surah, ayahTo, sabaqRef);
        sabaqPosition = adv.position;
        await savePosition(sabaqPosition);
        if(adv.completedJuz){
          const profile = await apiGetProfile();
          const current = Array.isArray(profile.baseline_selection) ? profile.baseline_selection.slice() : [];
          if(!current.includes(adv.completedJuz)){
            current.push(adv.completedJuz);
            await apiSaveProfile({ baseline_mode: 'juz', baseline_selection: current });
          }
        }
      } catch(e){ /* best-effort -- sabaq entry itself already saved */ }
    }

    await renderRecentEntries('sabaq', apiSabaq, 'sabaqRecentRail');
    const next = nextSabaqDefault(sabaqPosition, sabaqRef);
    document.getElementById('sabaq_surah').value = String(next.surah);
    document.getElementById('sabaq_ayah_from').value = String(next.ayah);
    document.getElementById('sabaq_ayah_to').value = '';
    document.getElementById('sabaq_line_count').value = '';
    document.getElementById('sabaq_page_count').value = '';
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
});
