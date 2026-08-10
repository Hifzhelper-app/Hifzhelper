// ============================================================
// Hifzhelper -- Sabaq Dhor card (one of 4 in the unified day-log view)
// Current as of V3.38
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

// 2026-08-07 (V3.38): IndoPak's Maqra/Rub'/Hizb picker is on hold --
// this used to take a 2nd (indopakTerminology) parameter and branch on
// it for IndoPak specifically; removed along with that picker (and the
// indopak_terminology column, migration 0017). IndoPak is Quarter/Half
// only now, same as 13-line -- both fall to the final `return
// 'waterval'`, natively (see shared/data.js's RUB_BOUNDARIES comment),
// not as a fallback.
function refForMushafSabaqDhor(mushaf){
  if(mushaf === '15line_madani') return 'uthmani';
  return 'waterval';
}

// V3.45.10: "Set Sabaq Dhor" is now a genuine part of this SAME shared
// grid, confirmed in chat -- the unified-grid architecture, extending
// V3.21.2's own "every checkbox genuinely shares the same column"
// principle to include the manual field too. Resolves the height/
// width/left-alignment mismatches that persisted across V3.45.6-
// V3.45.9 by construction (all 3 "rows" now genuinely share identical
// column tracks) rather than by matching values across what used to be
// 2 separate layout contexts. Since this container's own innerHTML
// gets rebuilt from scratch on every rollup-toggle tap and Move-to-
// Dhor action (not just fresh screen loads -- rebuildRowsFromPosition
// calls this from 4 separate places), this function now preserves the
// manual field's own live state (its surah:ayah value, its checkbox)
// across every one of those rebuilds -- read BEFORE clearing innerHTML,
// reapplied to the freshly-created nodes AFTER. A student who's already
// entered something there before tapping merge/split shouldn't lose
// it. The chevron/ayah-change listeners (previously wired once, at
// script-load time, back when these elements were static markup in
// index.html) now get re-wired fresh every render instead -- the same
// established pattern this function already used successfully for
// Move-to-Dhor's own buttons, just extended to cover this row too.
function renderSabaqDhorRows(){
  const el = document.getElementById('sabaqDhor_sections');

  // Preserve manual field state, if it currently exists -- it won't on
  // this function's very first-ever call this session (nothing to
  // preserve then, which correctly means it starts blank on a fresh
  // screen load, same as the section checkboxes always start
  // unchecked).
  const existingManualCb = document.getElementById('sabaqDhorManual_cb');
  const preservedManualValue = existingManualCb ? readSabaqDhorManualField() : null;
  const preservedManualChecked = existingManualCb ? existingManualCb.checked : false;

  // V3.21.2: sabaqDhor_sections is now ITSELF the grid (css/detail-pages.css),
  // not a plain container holding N independent per-row grids -- each row's
  // checkbox kept landing at a slightly different pixel position depending
  // on that row's own text length, because each row was computing its own
  // 80/20 split independently rather than sharing one real column across
  // every row (confirmed in chat: the fix is one shared grid, not flex).
  // Every row emits exactly 3 direct grid children (text, move-button-or-
  // empty-placeholder, checkbox) so column position is never at the mercy
  // of which rows happen to have a Move to Dhor button and which don't.
  const rowsHtml = sabaqDhorRows.length === 0
    ? `<p class="form-hint">Nothing to revise yet -- log a Sabaq entry first.</p>`
    : sabaqDhorRows.map(r => `
    <label class="sabaq-dhor-row-text" for="sabaqDhor_cb_${r.id}">${r.label}: ${r.fromSurah}:${r.fromAyah} - ${r.toSurah}:${r.toAyah}</label>
    ${r.canMoveToDhor ? `<button type="button" class="move-to-dhor-btn" data-id="${r.id}">Move to Dhor</button>` : '<span></span>'}
    <span class="checkbox-box"><input type="checkbox" id="sabaqDhor_cb_${r.id}" class="sabaqDhor-row-cb" data-id="${r.id}"></span>
  `).join('');

  // V3.45.11: "Set Sabaq Dhor"'s own heading is REMOVED entirely,
  // confirmed in chat -- one shared border now wraps all 3 rows as a
  // single visual group (css/detail-pages.css), making clear on its
  // own they're all the same "Confirm Sabaq Dhor" action, without
  // needing a 2nd heading to say so. This also resolves the previously
  // inconsistent row-to-row spacing as a side effect -- that heading's
  // own inherited margin-top was the specific cause of the larger gap
  // before this row; with the label gone, every row transition now has
  // nothing but the grid's own row-gap between it, matching "Quarter
  // 2"-to-"Quarter 1"'s own spacing exactly. "Set Sabaq Dhor" itself
  // still emits the same 3 grid children every section row does
  // (picker field / empty placeholder, since it never has a
  // Move-to-Dhor action / checkbox-box) -- always rendered,
  // independent of whether there are any section rows to revise at
  // all.
  const manualHtml = `
    <div class="verse-ref-field">
      <button type="button" class="verse-ref-chevron" id="sabaqDhorManual_chevron">&#x25B2;&#x25BC;</button>
      <span class="verse-ref-surah-label" id="sabaqDhorManual_surah_label">—</span>
      <span class="verse-ref-ayah-cell">
        <span class="verse-ref-sep">:</span>
        <input type="number" inputmode="numeric" class="verse-ref-ayah" id="sabaqDhorManual_ayah">
      </span>
      <span class="verse-ref-ayah-stepper">
        <button type="button" class="verse-ref-ayah-up" data-target="sabaqDhorManual_ayah">&#x25B2;</button>
        <button type="button" class="verse-ref-ayah-down" data-target="sabaqDhorManual_ayah">&#x25BC;</button>
      </span>
    </div>
    <span></span>
    <span class="checkbox-box"><input type="checkbox" id="sabaqDhorManual_cb"></span>
  `;

  el.innerHTML = rowsHtml + manualHtml;

  el.querySelectorAll('.move-to-dhor-btn').forEach(btn => {
    btn.addEventListener('click', () => moveRowToDhor(btn.dataset.id));
  });

  // Reapply preserved manual-field state to the freshly-created nodes,
  // then re-wire this row's own listeners fresh -- the previous nodes
  // (and whatever was attached to them) are gone now.
  renderSabaqDhorManualField(preservedManualValue);
  document.getElementById('sabaqDhorManual_cb').checked = preservedManualChecked;
  document.getElementById('sabaqDhorManual_chevron').addEventListener('click', openSurahPickerForSabaqDhorManual);
  document.getElementById('sabaqDhorManual_ayah').addEventListener('change', () => {
    const v = readSabaqDhorManualField();
    if(v) renderSabaqDhorManualField(v);
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
    await apiSaveProfile({ baseline_selection: updated });
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
// 2026-08-06, confirmed in chat: Maqra only ever appears as a new,
// finest 4th level when the Rub'/Hizb model is active (ref='uthmani') --
// Waterval's own chain is completely unchanged, still exactly the 3
// levels it always was. A function of ref rather than a fixed constant,
// since the array's own length and contents now genuinely differ by ref.
function rollupLevelOrder(ref){
  return ref === 'uthmani' ? ['maqras', 'quarters', 'halves', 'full'] : ['quarters', 'halves', 'full'];
}
function updateRollupStepperVisibility(){
  const order = rollupLevelOrder(sabaqDhorRef);
  const idx = order.indexOf(sabaqDhorRollupLevel);
  const currentIds = sabaqDhorRows.map(r => r.id).join(',');
  const rowIdsAtLevel = (level) => computeSabaqDhorRows(sabaqDhorPosition, sabaqDhorRef, level, sabaqDhorBaselineSelection).map(r => r.id).join(',');
  const canMergeUp = idx < order.length - 1 && rowIdsAtLevel(order[idx + 1]) !== currentIds;
  const canSplitDown = idx > 0 && rowIdsAtLevel(order[idx - 1]) !== currentIds;
  document.getElementById('sabaqDhor_rollup_up').style.display = canMergeUp ? '' : 'none';
  document.getElementById('sabaqDhor_rollup_down').style.display = canSplitDown ? '' : 'none';
}

// Chevron steps one position up/down through rollupLevelOrder(sabaqDhorRef)
// -- generalized to navigate the array by index rather than hardcoded
// specific transitions, since the array's own length now varies by ref
// (3 levels for Waterval, 4 for Rub'/Hizb). Each button is hidden by
// updateRollupStepperVisibility() above whenever its direction wouldn't
// actually change anything, so a click here only ever happens when it's
// a real, eligible action -- idx+1/idx-1 are always in bounds by the
// time either handler can actually fire.
document.getElementById('sabaqDhor_rollup_up').innerHTML = iconHtml('rollupMerge');
document.getElementById('sabaqDhor_rollup_down').innerHTML = iconHtml('rollupSplit');
document.getElementById('sabaqDhor_rollup_up').addEventListener('click', () => {
  const order = rollupLevelOrder(sabaqDhorRef);
  sabaqDhorRollupLevel = order[order.indexOf(sabaqDhorRollupLevel) + 1];
  rebuildRowsFromPosition();
  savePosition(Object.assign({}, sabaqDhorPosition, { sabaqDhorRollup: sabaqDhorRollupLevel })).catch(() => {});
});
document.getElementById('sabaqDhor_rollup_down').addEventListener('click', () => {
  const order = rollupLevelOrder(sabaqDhorRef);
  sabaqDhorRollupLevel = order[order.indexOf(sabaqDhorRollupLevel) - 1];
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
  // V3.45.4/V3.45.5: sabaqTo/activeJuz computed fresh from real Sabaq
  // history, same source js/sabaqPage.js's own screen now uses. The
  // manual-select field itself no longer factors into this at all
  // (see file header) -- it always starts blank on a fresh load, same
  // as the "Confirm Sabaq Dhor" checkboxes below it always start
  // unchecked.
  let entriesForFrontier = [];
  try{ entriesForFrontier = await apiSabaq.get(); } catch(e){ entriesForFrontier = []; }
  const computedFrontier = computeActualSabaqFrontier(entriesForFrontier, sabaqDhorRef);
  sabaqDhorPosition = Object.assign({}, sabaqDhorPosition, {
    sabaqTo: computedFrontier,
    activeJuz: computedFrontier ? getJuzForPosition(computedFrontier.surah, computedFrontier.ayah, sabaqDhorRef) : null
  });
  // V3.45.10: the old renderSabaqDhorManualField(null)/checkbox-reset
  // pair that used to sit here is REMOVED -- the manual field's own
  // DOM nodes no longer exist yet at this point in the load flow
  // (they're only created inside renderSabaqDhorRows, called below via
  // rebuildRowsFromPosition, now that "Set Sabaq Dhor" is a genuine
  // part of that same rendered grid rather than static markup already
  // present in index.html). That function now handles "starts blank on
  // a fresh screen load" naturally on its own: nothing exists yet to
  // preserve on its very first call this session, which is exactly the
  // blank state this used to set explicitly.
  // 2026-08-06, confirmed in chat: Maqra is the new base/default level
  // when the Rub'/Hizb model is active -- Waterval's own default
  // (quarters) is completely unchanged.
  // 2026-08-06, confirmed in chat: Maqra is the new base/default level
  // when the Rub'/Hizb model is active -- Waterval's own default
  // (quarters) is completely unchanged. Guards against a stored
  // 'maqras' value left over from a previous Rub'/Hizb session no
  // longer being valid if the student's mushaf/terminology later
  // changed to Waterval -- Maqra has no Waterval equivalent, so a
  // stale stored value there would otherwise call Maqra-only functions
  // for the wrong ref.
  const storedRollup = sabaqDhorPosition.sabaqDhorRollup;
  const storedIsValid = storedRollup && rollupLevelOrder(sabaqDhorRef).includes(storedRollup);
  sabaqDhorRollupLevel = storedIsValid ? storedRollup : (sabaqDhorRef === 'uthmani' ? 'maqras' : 'quarters');
  rebuildRowsFromPosition();

  renderTajweedPicker('sabaqDhorTajweedPicker', sabaqDhorSelectedTags);
  renderCommentBlock('sabaqDhorCommentBlock', null);
  await renderRecentEntries('sabaqDhor', apiSabaqDhor, 'sabaqDhorRecentRail');
}

// Composites whichever rows stayed checked into one overall from/to range
// -- earliest checked row's start to the latest checked row's end.
// Returns null if nothing's checked (nothing to save).
// V3.45.5: also folds in the manual-select field, confirmed in chat as
// a 3rd source feeding the exact same composite, not a separate
// mechanism -- when #sabaqDhorManual_cb is checked, its own surah:ayah
// point (both "from" and "to" the same point, a zero-length range)
// competes in the same earliest-start/latest-end comparison as every
// section row already does.
function compositeCheckedSabaqDhorRows(){
  const checkedIds = Array.from(document.querySelectorAll('.sabaqDhor-row-cb:checked')).map(cb => cb.dataset.id);
  const checked = sabaqDhorRows.filter(r => checkedIds.includes(r.id));
  const manualChecked = document.getElementById('sabaqDhorManual_cb').checked;
  const manualValue = manualChecked ? readSabaqDhorManualField() : null;
  if(manualValue){
    checked.push({ fromSurah: manualValue.surah, fromAyah: manualValue.ayah, toSurah: manualValue.surah, toAyah: manualValue.ayah });
  }
  if(checked.length === 0) return null;
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
    // Bug fix (2026-08-04, found by the user): the checkboxes never got
    // cleared after a save, so the exact same sections stayed checked --
    // tapping Save a second time (accidental double-tap, or simply not
    // realising it had already saved) would recompute the identical
    // range and duplicate the entry. renderSabaqDhorScreen already
    // rebuilds the rows from scratch on every fresh open (rebuildRowsFromPosition,
    // reflecting the student's current position/pool, which may well have
    // changed if this save just triggered a Dhor-transition) -- reusing it
    // here means the checkboxes come back genuinely unchecked as a natural
    // consequence, not a separate manual reset that could drift out of
    // sync with what a fresh open actually does. Also handles updating
    // History, so the separate renderRecentEntries call below is gone.
    await renderSabaqDhorScreen();
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
});

// V3.45.4: manual-select for Sabaq Dhor's own "current" position,
// confirmed in chat -- exactly like Sabaq's own picker fields, reused
// here as its own single point rather than a from/to pair. Deliberately
// its OWN implementation rather than generalizing Sabaq's own
// openSurahPickerFor/renderVerseRefField (js/sabaqPage.js), which are
// tightly coupled to that screen's own sabaqValue module state --
// avoids any risk of regressing Sabaq's own, already-working picker to
// generalize it. Clears automatically the next time a new Sabaq entry
// is saved (js/position.js's advancePositionAfterSabaq) -- confirmed
// as the reset mechanism, no separate reset action needed here.

function renderSabaqDhorManualField(value){
  const surahLabel = document.getElementById('sabaqDhorManual_surah_label');
  const ayahInput = document.getElementById('sabaqDhorManual_ayah');
  if(!value){
    surahLabel.textContent = '—';
    ayahInput.value = '';
    ayahInput.min = '';
    ayahInput.max = '';
    return;
  }
  surahLabel.textContent = `${value.surah} ${surahName(value.surah)}`;
  ayahInput.min = '1';
  ayahInput.max = String(maxAyahForSurah(value.surah));
  ayahInput.value = String(value.ayah);
}

function readSabaqDhorManualField(){
  const surahLabel = document.getElementById('sabaqDhorManual_surah_label');
  const ayahInput = document.getElementById('sabaqDhorManual_ayah');
  const match = surahLabel.textContent.match(/^(\d+)/);
  if(!match || !ayahInput.value) return null;
  const surah = parseInt(match[1], 10);
  let ayah = parseInt(ayahInput.value, 10);
  const max = maxAyahForSurah(surah);
  if(ayah < 1) ayah = 1;
  if(ayah > max) ayah = max;
  return { surah, ayah };
}

function openSurahPickerForSabaqDhorManual(){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay surah-picker-modal';
  overlay.innerHTML = `<div class="modal-card">
    <button type="button" class="close-btn" id="sabaqDhorManualSurahPickerCloseBtn">&times;</button>
    <h2>Choose Surah</h2>
    <div class="surah-picker-list" id="sabaqDhorManualSurahPickerList"></div>
  </div>`;
  document.body.appendChild(overlay);
  const listEl = document.getElementById('sabaqDhorManualSurahPickerList');
  listEl.innerHTML = SURAHS.map(([num, name]) => `<button type="button" class="tajweed-tag surah-picker-row" data-surah="${num}">${num}. ${name}</button>`).join('');
  listEl.querySelectorAll('[data-surah]').forEach(btn => {
    btn.addEventListener('click', () => {
      const surah = parseInt(btn.dataset.surah, 10);
      renderSabaqDhorManualField({ surah, ayah: 1 });
      overlay.remove();
    });
  });
  overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
  document.getElementById('sabaqDhorManualSurahPickerCloseBtn').addEventListener('click', () => overlay.remove());
}
// V3.45.10: the top-level chevron/ayah-change listener setup that used
// to sit here is REMOVED entirely -- these elements no longer exist at
// script-load time at all now (they're only ever created dynamically,
// inside renderSabaqDhorRows, now that "Set Sabaq Dhor" is a genuine
// part of that rendered grid rather than static markup already present
// in index.html) -- the same wiring now happens fresh inside that
// function on every render instead (see its own comment for why).
// Ayah up/down steppers still need no separate wiring of their own --
// js/sabaqPage.js's generic .verse-ref-ayah-up/-down handlers are
// keyed off data-target, not scoped to Sabaq specifically, so they
// already reach these elements automatically regardless of where in
// the DOM they're created.
// V3.45.5: the old #sabaqDhorManualSaveBtn click handler is REMOVED
// entirely -- the checkbox that replaced that button is passive, same
// as the 2 "Confirm Sabaq Dhor" section checkboxes, with no listener
// of its own. Its checked state and the picker's current value are
// only ever read once, inside compositeCheckedSabaqDhorRows, at the
// moment the card's own Save button is tapped.
