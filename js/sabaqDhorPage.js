// ============================================================
// Hifzhelper -- Sabaq Dhor card (one of 4 in the unified day-log view)
// V3.16.0 (Phase 2a): rebuilt around position -- recites the CURRENT
// juz' from its start to wherever Sabaq has reached, excluding today's
// brand-new portion. Builds quarter by quarter as Sabaq progresses; the
// in-progress quarter is always its own row, never rollable. Completed
// quarters can be rolled up via the chevron -- quarters 1+2 into "First
// Half", 3+4 into "Second Half", both halves into "Full Juz'" -- and
// back down again. The rollup level is persisted per student
// (position.sabaqDhorRollup) so it sticks across sessions rather than
// resetting every time the card opens.
//
// This delivery is the day-to-day mechanics only (Phase 2a) -- rows,
// rollup, and the daily multi-select save. The actual move-to-Dhor
// transition (the tickbox/auto-trigger that sends a half/full-juz' row
// into the real Dhor Schedule pool) is Phase 2b, a separate, later
// delivery; rows here already carry a canMoveToDhor flag for whichever
// are eligible (halves and full juz', never a lone quarter), but nothing
// acts on it yet.
// ============================================================

let sabaqDhorSelectedTags = [];
let sabaqDhorRows = [];
let sabaqDhorRef = 'waterval';
let sabaqDhorPosition = null;
// V3.21.0: editing state. Sabaq Dhor's checkboxes reflect TODAY's live
// eligible sections (computeSabaqDhorRows against current position), not
// whatever was actually checked when a past entry was saved -- there's no
// way to reconstruct that into the same checkbox UI. So editing here
// only ever touches mistakes/tajweed/notes; the entry's original
// from_surah/from_ayah/to_surah/to_ayah are left exactly as they were,
// simply never included in the PATCH payload. The section list + rollup
// stepper are hidden while editing since they'd otherwise look editable
// but silently do nothing.
let sabaqDhorEditingId = null;
let sabaqDhorRollupLevel = 'quarters';
let sabaqDhorBaselineSelection = [];

function refForMushafSabaqDhor(mushaf){ return mushaf === '15line_madani' ? 'uthmani' : 'waterval'; }

function renderSabaqDhorRows(){
  const el = document.getElementById('sabaqDhor_sections');
  if(sabaqDhorRows.length === 0){
    el.innerHTML = `<p class="form-hint">Nothing to revise yet -- log a Sabaq entry first.</p>`;
    return;
  }
  // V3.21.2: sabaqDhor_sections is now ITSELF the grid (css/detail-pages.css),
  // not a plain container holding N independent per-row grids -- each row's
  // checkbox kept landing at a slightly different pixel position depending
  // on that row's own text length, because each row was computing its own
  // 80/20 split independently rather than sharing one real column across
  // every row (confirmed in chat: the fix is one shared grid, not flex).
  // Every row emits exactly 3 direct grid children (text, move-button-or-
  // empty-placeholder, checkbox) so column position is never at the mercy
  // of which rows happen to have a Move to Dhor button and which don't.
  el.innerHTML = sabaqDhorRows.map(r => `
    <label class="sabaq-dhor-row-text" for="sabaqDhor_cb_${r.id}">${r.label}: ${r.fromSurah}:${r.fromAyah} - ${r.toSurah}:${r.toAyah}</label>
    ${r.canMoveToDhor ? `<button type="button" class="move-to-dhor-btn" data-id="${r.id}">Move to Dhor</button>` : '<span></span>'}
    <input type="checkbox" id="sabaqDhor_cb_${r.id}" class="sabaqDhor-row-cb" data-id="${r.id}">
  `).join('');
  el.querySelectorAll('.move-to-dhor-btn').forEach(btn => {
    btn.addEventListener('click', () => moveRowToDhor(btn.dataset.id));
  });
}

// Phase 2b (V3.17.0): the manual half of the move-to-Dhor transition --
// the automatic trigger (a quarter of the NEW juz' completing) lives in
// sabaqPage.js's save handler instead, since that's where a juz'
// actually gets crossed. Both are independent paths to the same outcome,
// confirmed in chat -- whichever happens first.
async function moveRowToDhor(rowId){
  const row = sabaqDhorRows.find(r => r.id === rowId);
  if(!row || !row.canMoveToDhor) return;
  const juz = row.lingeringJuz || sabaqDhorPosition.activeJuz;
  try{
    const profile = await apiGetProfile();
    const current = Array.isArray(profile.baseline_selection) ? profile.baseline_selection.slice() : [];
    const updated = addRowToBaselinePool(row, juz, current);
    await apiSaveProfile({ baseline_mode: 'juz', baseline_selection: updated });
    // If this was the last lingering piece of a previous juz', clear it
    // from position so it stops being tracked as "lingering" going forward.
    if(row.lingeringJuz){
      const stillLingering = computeLingeringRows(row.lingeringJuz, sabaqDhorRef, sabaqDhorRollupLevel, updated);
      if(stillLingering.length === 0 && sabaqDhorPosition.previousJuz === row.lingeringJuz){
        sabaqDhorPosition = Object.assign({}, sabaqDhorPosition, { previousJuz: null });
        await savePosition(sabaqDhorPosition);
      }
    }
    rebuildRowsFromPosition();
  } catch(e){
    document.getElementById('sabaqDhorError').textContent = "Couldn't move to Dhor: " + e.message;
  }
}

function rebuildRowsFromPosition(){
  sabaqDhorRows = computeSabaqDhorRows(sabaqDhorPosition, sabaqDhorRef, sabaqDhorRollupLevel, sabaqDhorBaselineSelection);
  renderSabaqDhorRows();
  updateRollupStepperVisibility();
}

// V3.19.0: each rollup button is only shown when it would actually change
// something -- rather than hand-duplicating computeSabaqDhorRows' own
// merge logic (pairs, full-juz' conditions, lingering-juz rows) to work
// out eligibility separately, this just computes the rows one level up
// and one level down and compares the resulting row ids to the current
// level's. If a direction produces the identical set of rows, there's
// nothing for it to do, so it's hidden entirely rather than left as a
// no-op tap.
const ROLLUP_LEVEL_ORDER = ['quarters', 'halves', 'full'];
function updateRollupStepperVisibility(){
  const idx = ROLLUP_LEVEL_ORDER.indexOf(sabaqDhorRollupLevel);
  const currentIds = sabaqDhorRows.map(r => r.id).join(',');
  const rowIdsAtLevel = (level) => computeSabaqDhorRows(sabaqDhorPosition, sabaqDhorRef, level, sabaqDhorBaselineSelection).map(r => r.id).join(',');
  const canMergeUp = idx < ROLLUP_LEVEL_ORDER.length - 1 && rowIdsAtLevel(ROLLUP_LEVEL_ORDER[idx + 1]) !== currentIds;
  const canSplitDown = idx > 0 && rowIdsAtLevel(ROLLUP_LEVEL_ORDER[idx - 1]) !== currentIds;
  document.getElementById('sabaqDhor_rollup_up').style.display = canMergeUp ? '' : 'none';
  document.getElementById('sabaqDhor_rollup_down').style.display = canSplitDown ? '' : 'none';
}

// Chevron cycles the rollup level quarters -> halves -> full -> quarters.
// Each button is hidden by updateRollupStepperVisibility() above whenever
// its direction wouldn't actually change anything, so a click here only
// ever happens when it's a real, eligible action.
document.getElementById('sabaqDhor_rollup_up').innerHTML = iconHtml('rollupMerge');
document.getElementById('sabaqDhor_rollup_down').innerHTML = iconHtml('rollupSplit');
document.getElementById('sabaqDhor_rollup_up').addEventListener('click', () => {
  sabaqDhorRollupLevel = sabaqDhorRollupLevel === 'quarters' ? 'halves' : 'full';
  rebuildRowsFromPosition();
  savePosition(Object.assign({}, sabaqDhorPosition, { sabaqDhorRollup: sabaqDhorRollupLevel })).catch(() => {});
});
document.getElementById('sabaqDhor_rollup_down').addEventListener('click', () => {
  sabaqDhorRollupLevel = sabaqDhorRollupLevel === 'full' ? 'halves' : 'quarters';
  rebuildRowsFromPosition();
  savePosition(Object.assign({}, sabaqDhorPosition, { sabaqDhorRollup: sabaqDhorRollupLevel })).catch(() => {});
});

async function renderSabaqDhorScreen(){
  sabaqDhorEditingId = null;
  document.getElementById('sabaqDhorEditTopbar').classList.add('hidden');
  document.getElementById('sabaqDhorEditBottombar').classList.add('hidden');
  document.getElementById('sabaqDhor_sections').classList.remove('hidden');
  exitEditScreenMode('card-sabaqDhor');
  sabaqDhorSelectedTags = [];
  document.getElementById('sabaqDhor_date').value = todayISO();
  document.getElementById('sabaqDhor_mistakes').value = '0';

  let profile = null;
  try{ profile = await apiGetProfile(); } catch(e){ profile = null; }
  sabaqDhorRef = refForMushafSabaqDhor(profile && profile.mushaf);
  sabaqDhorBaselineSelection = (profile && Array.isArray(profile.baseline_selection)) ? profile.baseline_selection.slice() : [];
  sabaqDhorPosition = await loadPosition();
  sabaqDhorRollupLevel = sabaqDhorPosition.sabaqDhorRollup || 'quarters';
  rebuildRowsFromPosition();

  renderTajweedPicker('sabaqDhorTajweedPicker', sabaqDhorSelectedTags);
  renderCommentBlock('sabaqDhorCommentBlock', null);
  await renderRecentEntries('sabaqDhor', apiSabaqDhor, 'sabaqDhorRecentRail');
}

// Composites whichever rows stayed checked into one overall from/to range
// -- earliest checked row's start to the latest checked row's end.
// Returns null if nothing's checked (nothing to save).
function compositeCheckedSabaqDhorRows(){
  const checkedIds = Array.from(document.querySelectorAll('.sabaqDhor-row-cb:checked')).map(cb => cb.dataset.id);
  if(checkedIds.length === 0) return null;
  const checked = sabaqDhorRows.filter(r => checkedIds.includes(r.id));
  let from = checked[0], to = checked[0];
  for(const r of checked){
    if(compareVerseKey(r.fromSurah, r.fromAyah, from.fromSurah, from.fromAyah) < 0) from = r;
    if(compareVerseKey(r.toSurah, r.toAyah, to.toSurah, to.toAyah) > 0) to = r;
  }
  return { fromSurah: from.fromSurah, fromAyah: from.fromAyah, toSurah: to.toSurah, toAyah: to.toAyah };
}

function loadSabaqDhorEntryForEdit(entry){
  sabaqDhorEditingId = entry.id;
  document.getElementById('sabaqDhor_date').value = entry.date;
  document.getElementById('sabaqDhor_mistakes').value = entry.mistakes || 0;
  sabaqDhorSelectedTags = (entry.tajweed_tags || '').split(',').filter(Boolean);
  renderTajweedPicker('sabaqDhorTajweedPicker', sabaqDhorSelectedTags);
  renderCommentBlock('sabaqDhorCommentBlock', entry);
  document.getElementById('sabaqDhorEditTopbarDate').textContent =
    `${entry.date} (${entry.from_surah}:${entry.from_ayah} - ${entry.to_surah}:${entry.to_ayah} — range isn't editable here)`;
  document.getElementById('sabaqDhorEditTopbar').classList.remove('hidden');
  document.getElementById('sabaqDhorEditBottombar').classList.remove('hidden');
  document.getElementById('sabaqDhor_rollup_up').style.display = 'none';
  document.getElementById('sabaqDhor_rollup_down').style.display = 'none';
  document.getElementById('sabaqDhor_sections').classList.add('hidden');
  enterEditScreenMode('card-sabaqDhor');
}
function cancelSabaqDhorEdit(){
  sabaqDhorEditingId = null;
  document.getElementById('sabaqDhorEditTopbar').classList.add('hidden');
  document.getElementById('sabaqDhorEditBottombar').classList.add('hidden');
  document.getElementById('sabaqDhor_sections').classList.remove('hidden');
  updateRollupStepperVisibility();
  exitEditScreenMode('card-sabaqDhor');
}
function resetSabaqDhorFormAfterEdit(){
  document.getElementById('sabaqDhor_date').value = todayISO();
  document.getElementById('sabaqDhor_mistakes').value = 0;
  sabaqDhorSelectedTags = [];
  renderTajweedPicker('sabaqDhorTajweedPicker', sabaqDhorSelectedTags);
  renderCommentBlock('sabaqDhorCommentBlock', null);
}
document.getElementById('sabaqDhorEditCancelBtn2').addEventListener('click', () => {
  cancelSabaqDhorEdit();
  resetSabaqDhorFormAfterEdit();
});
document.getElementById('sabaqDhorEditUpdateBtn').addEventListener('click', () => {
  document.getElementById('sabaqDhorSaveBtn').click();
});
document.getElementById('sabaqDhorEditDeleteBtn').addEventListener('click', async () => {
  if(!sabaqDhorEditingId) return;
  if(!confirm('Deleting this entry may create gaps in your history which cannot be recovered. Are you sure you want to DELETE?')) return;
  try{
    await apiSabaqDhor.remove(sabaqDhorEditingId);
    cancelSabaqDhorEdit();
    resetSabaqDhorFormAfterEdit();
    await renderRecentEntries('sabaqDhor', apiSabaqDhor, 'sabaqDhorRecentRail');
  } catch(e){
    document.getElementById('sabaqDhorError').textContent = "Couldn't delete: " + e.message;
  }
});
EDIT_HANDLERS.sabaqDhor = loadSabaqDhorEntryForEdit;

document.getElementById('sabaqDhorSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('sabaqDhorError');
  errEl.textContent = '';

  if(sabaqDhorEditingId){
    // Range fields deliberately omitted -- see loadSabaqDhorEntryForEdit.
    const payload = {
      mistakes: parseInt(document.getElementById('sabaqDhor_mistakes').value) || 0,
      tajweed_tags: sabaqDhorSelectedTags.join(','),
      ...readCommentBlock('sabaqDhorCommentBlock')
    };
    try{
      await apiSabaqDhor.update(sabaqDhorEditingId, payload);
      document.getElementById('sabaqDhorSaveStatus').classList.add('show');
      setTimeout(() => document.getElementById('sabaqDhorSaveStatus').classList.remove('show'), 1800);
      cancelSabaqDhorEdit();
      document.getElementById('sabaqDhor_date').value = todayISO();
      document.getElementById('sabaqDhor_mistakes').value = 0;
      sabaqDhorSelectedTags = [];
      renderTajweedPicker('sabaqDhorTajweedPicker', sabaqDhorSelectedTags);
      renderCommentBlock('sabaqDhorCommentBlock', null);
      await renderRecentEntries('sabaqDhor', apiSabaqDhor, 'sabaqDhorRecentRail');
    } catch(e){
      errEl.textContent = "Couldn't save: " + e.message;
    }
    return;
  }

  const range = compositeCheckedSabaqDhorRows();
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
