/* Hifzhelper build 4.2.11.3 | js/sabaqDhorPage.js */
// ============================================================
// Hifzhelper -- Sabaq Dhor card (one of 4 in the unified day-log view)
// Current as of V3.45.13
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
let sabaqDhorMoveOptions = [];   // V3.74.3: per-juz, not per-row
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
  // V3.45.14: preserves BOTH From and To now, not one point -- the
  // manual field became a genuine range.
  const existingManualCb = document.getElementById('sabaqDhorManual_cb');
  const preservedManualFrom = existingManualCb ? readSabaqDhorManualField('from') : null;
  const preservedManualTo = existingManualCb ? readSabaqDhorManualField('to') : null;
  const preservedManualChecked = existingManualCb ? existingManualCb.checked : false;
  // V4.2.8: the empty-state picker is itself a checkable source now.
  // Preserve its live choice if this shared grid is rebuilt.
  const existingSdqConfirm = document.getElementById('sdq_confirm');
  const preservedSdqJuz = document.getElementById('sdq_juz')?.value || null;
  const preservedSdqQuarter = document.getElementById('sdq_quarter')?.value || null;
  const preservedSdqChecked = existingSdqConfirm ? existingSdqConfirm.checked : false;

  // V3.21.2: sabaqDhor_sections is now ITSELF the grid (css/detail-pages.css),
  // not a plain container holding N independent per-row grids -- each row's
  // checkbox kept landing at a slightly different pixel position depending
  // on that row's own text length, because each row was computing its own
  // 80/20 split independently rather than sharing one real column across
  // every row (confirmed in chat: the fix is one shared grid, not flex).
  // Every row emits exactly 3 direct grid children (text, move-button-or-
  // empty-placeholder, checkbox) so column position is never at the mercy
  // of which rows happen to have a Move to Dhor button and which don't.
  // V4.2.4 (user's choice of three options): when there are NO rows, this
  // block shows the JUZ + QUARTER PICKER in their place — the rows are
  // DERIVED from her position, so a student who has memorised but never
  // logged has nothing here to pick. The picker occupies exactly the space
  // the missing information would have filled, costs nothing when she does
  // have history, and never competes with the rows for attention.
  // (V4.2.3 put it below the From/To block, inside a FLEX row — it stole
  // the sections list's width and crushed the pills. Placement, not style.)
  const rowsHtml = sabaqDhorRows.length === 0
    ? sabaqDhorQuarterPickerHtml()
    : sabaqDhorRows.map(r => `
    <label class="sabaq-dhor-row-text" for="sabaqDhor_cb_${r.id}">${r.label}: ${r.fromSurah}:${r.fromAyah} - ${r.toSurah}:${r.toAyah}</label>
    <span></span>
    <span class="checkbox-box"><input type="checkbox" id="sabaqDhor_cb_${r.id}" class="sabaqDhor-row-cb" data-id="${r.id}"></span>
  `).join('');

  // V3.74.3: ONE move option per juz, on its own row, rendered from the
  // juz rather than from any row — so roll-up state cannot make it appear
  // or vanish.
  // V3.75.0 (item 2): HIDDEN until all four quarters are complete, then
  // shown as "Move Juz N to Dhor". The V3.74.3 visible-but-disabled state
  // with its "(2 of 4 complete)" count was Claude's own reasoning, not the
  // user's — user's call 2026-08-26: nothing on screen that can't be used.
  // computeSabaqDhorMoveOptions still returns the ineligible ones (the
  // eligibility rule is unchanged, and moveJuzToDhor still re-checks
  // opt.enabled); only the render filters them out.
  const moveHtml = sabaqDhorMoveOptions.filter(o => o.enabled).map(o => `
    <button type="button" class="move-to-dhor-btn move-to-dhor-row" data-juz="${o.juz}">
      Move ${o.label} to Dhor
    </button>
  `).join('');

  // V3.45.14: "Set Sabaq Dhor" is now a genuine From/To range, confirmed
  // in chat -- "exactly like the Sabaq card," which already has this
  // exact shape (2 separate labeled picker fields). Emits 2 grid
  // "rows" instead of 1 -- From gets an empty placeholder in the
  // checkbox column (same pattern "Quarter 2"/"Quarter 1" already use
  // when they have no Move-to-Dhor button), the ONE shared checkbox
  // sits beside To specifically, confirmed directly: "the user chooses
  // from and to and then confirms." compositeCheckedSabaqDhorRows
  // (below) reads both sides into a genuine 2-point range now, not the
  // zero-length single-point range it used to fold in.
  const manualHtml = `
    <label class="sabaq-dhor-sections-header">From</label>
    <div class="verse-ref-field">
      <button type="button" class="verse-ref-chevron" id="sabaqDhorManual_from_chevron">&#x25B2;&#x25BC;</button>
      <span class="verse-ref-surah-label" id="sabaqDhorManual_from_surah_label">—</span>
      <span class="verse-ref-ayah-cell">
        <span class="verse-ref-sep">:</span>
        <input type="number" inputmode="numeric" class="verse-ref-ayah" id="sabaqDhorManual_from_ayah">
      </span>
      <span class="verse-ref-ayah-stepper">
        <button type="button" class="verse-ref-ayah-up" data-target="sabaqDhorManual_from_ayah">&#x25B2;</button>
        <button type="button" class="verse-ref-ayah-down" data-target="sabaqDhorManual_from_ayah">&#x25BC;</button>
      </span>
    </div>
    <span></span>
    <span></span>
    <label class="sabaq-dhor-sections-header">To</label>
    <div class="verse-ref-field">
      <button type="button" class="verse-ref-chevron" id="sabaqDhorManual_to_chevron">&#x25B2;&#x25BC;</button>
      <span class="verse-ref-surah-label" id="sabaqDhorManual_to_surah_label">—</span>
      <span class="verse-ref-ayah-cell">
        <span class="verse-ref-sep">:</span>
        <input type="number" inputmode="numeric" class="verse-ref-ayah" id="sabaqDhorManual_to_ayah">
      </span>
      <span class="verse-ref-ayah-stepper">
        <button type="button" class="verse-ref-ayah-up" data-target="sabaqDhorManual_to_ayah">&#x25B2;</button>
        <button type="button" class="verse-ref-ayah-down" data-target="sabaqDhorManual_to_ayah">&#x25BC;</button>
      </span>
    </div>
    <span></span>
    <span class="checkbox-box"><input type="checkbox" id="sabaqDhorManual_cb"></span>
  `;

  // V3.51.1 (confirmed in chat): while editing, the quarter rows are
  // not rendered at all -- only the manual From/To remain. Structural
  // by design: CSS-hiding SOME of a shared grid's children would let
  // the survivors reflow into the wrong columns (the V3.45.6-.11
  // lesson: fix the structure, not the symptom). Keyed off the same
  // sabaqDhorEditingId the rest of edit mode already uses.
  // V3.74.3: the move options follow the rows and are suppressed in edit
  // mode alongside them — editing an entry is not the moment to move a juz.
  el.innerHTML = (sabaqDhorEditingId ? '' : rowsHtml + moveHtml) + manualHtml;

  el.querySelectorAll('.move-to-dhor-btn[data-juz]').forEach(btn => {
    btn.addEventListener('click', () => moveJuzToDhor(Number(btn.dataset.juz)));
  });

  // Reapply preserved manual-field state to the freshly-created nodes,
  // then re-wire this row's own listeners fresh -- the previous nodes
  // (and whatever was attached to them) are gone now.
  const sdqJuz = document.getElementById('sdq_juz');
  const sdqQuarter = document.getElementById('sdq_quarter');
  const sdqConfirm = document.getElementById('sdq_confirm');
  if(sdqJuz && preservedSdqJuz) sdqJuz.value = preservedSdqJuz;
  if(sdqQuarter && preservedSdqQuarter) sdqQuarter.value = preservedSdqQuarter;
  if(sdqConfirm) sdqConfirm.checked = preservedSdqChecked;
  wireSabaqDhorQuarterPicker();   // V4.2.8: no-op unless the picker is on screen
  renderSabaqDhorManualField('from', preservedManualFrom);
  renderSabaqDhorManualField('to', preservedManualTo);
  document.getElementById('sabaqDhorManual_cb').checked = preservedManualChecked;
  document.getElementById('sabaqDhorManual_from_chevron').addEventListener('click', () => openSurahPickerForSabaqDhorManual('from'));
  document.getElementById('sabaqDhorManual_to_chevron').addEventListener('click', () => openSurahPickerForSabaqDhorManual('to'));
  document.getElementById('sabaqDhorManual_from_ayah').addEventListener('change', () => {
    const v = readSabaqDhorManualField('from');
    if(v) renderSabaqDhorManualField('from', v);
  });
  document.getElementById('sabaqDhorManual_to_ayah').addEventListener('change', () => {
    const v = readSabaqDhorManualField('to');
    if(v) renderSabaqDhorManualField('to', v);
  });
}

// Phase 2b (V3.17.0): the manual half of the move-to-Dhor transition --
// the automatic trigger (a quarter of the NEW juz' completing) lives in
// sabaqPage.js's save handler instead, since that's where a juz'
// actually gets crossed. Both are independent paths to the same outcome,
// confirmed in chat -- whichever happens first.
// V3.74.3: moves a WHOLE JUZ. Was per-row, with halves sequenced so the
// second could not move until the first had. All of that is gone: the
// option belongs to the juz, takes all four quarters, and the juz then
// leaves Sabaq Dhor entirely — it is a handover, not a copy.
//
// The juz disappears on its own once every unit is in the pool: the
// lingering-row builder returns nothing for a fully-moved juz. So there is
// no separate "remove the rows" step to fall out of step with the write.
async function moveJuzToDhor(juz){
  const opt = sabaqDhorMoveOptions.find(o => o.juz === juz);
  if(!opt || !opt.enabled) return;

  if(!confirm(`Move all four quarters of Juz ${juz} into the Dhor pool? It will no longer appear in Sabaq Dhor.`)) return;

  try{
    const profile = await logProfile();
    const pool = Array.isArray(profile.baseline_selection) ? profile.baseline_selection : [];
    const merged = [...new Set(pool.concat(opt.units))].sort((a, b) => a - b);
    await logSavePool(merged);
    sabaqDhorBaselineSelection = merged;
    renderSabaqDhorRows();
  } catch(e){
    const st = document.getElementById('sabaqDhorSaveStatus');
    if(st){ st.textContent = "Couldn't move to Dhor: " + e.message; st.classList.add('show'); }
  }
}


// RESTORED V3.74.5. This function was destroyed by a span replacement in
// V3.74.3: the slice that replaced moveRowToDhor ran from its opening line
// to the next "\n}" after a `renderSabaqDhorRows` reference, and swallowed
// this whole function on the way. Nothing assigned sabaqDhorRows any more,
// so the Sabaq Dhor card rendered empty — no rows, no history, no manual
// field. It shipped in V3.74.3 and V3.74.4 because no harness drives this
// render path; only a screenshot caught it.
function rebuildRowsFromPosition(){
  sabaqDhorRows = computeSabaqDhorRows(sabaqDhorPosition, sabaqDhorRef, sabaqDhorRollupLevel, sabaqDhorBaselineSelection);
  // V3.74.3: the per-juz move options, computed alongside the rows so the
  // two can never describe different states.
  sabaqDhorMoveOptions = computeSabaqDhorMoveOptions(sabaqDhorPosition, sabaqDhorRef, sabaqDhorBaselineSelection);
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
  const mergeBtn = document.getElementById('sabaqDhor_rollup_up');
  const splitBtn = document.getElementById('sabaqDhor_rollup_down');
  mergeBtn.style.display = canMergeUp ? '' : 'none';
  splitBtn.style.display = canSplitDown ? '' : 'none';
  // V3.45.13: both hidden buttons used to leave their empty wrapper and
  // the parent flex gap in place. Mobile CSS uses this state class to
  // remove that inactive gutter and return the width to the section grid;
  // tablet/desktop styling deliberately ignores the class.
  mergeBtn.parentElement.classList.toggle('rollup-inactive', !canMergeUp && !canSplitDown);
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
  document.getElementById('sabaqDhor_date').value = (typeof logDetailSelectedDate === 'function' ? logDetailSelectedDate() : todayISO());
  document.getElementById('sabaqDhor_mistakes').value = '0';

  let profile = null;
  try{ profile = await logProfile(); } catch(e){ profile = null; }
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
  try{ entriesForFrontier = await logClient('sabaq').get(); } catch(e){ entriesForFrontier = []; }
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
  await renderRecentEntries('sabaqDhor', 'sabaqDhorRecentRail');
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
  // V3.45.14: reads BOTH From and To now, folding in a genuine 2-point
  // range instead of duplicating a single value into a zero-length one
  // -- the manual field became a real From/To pair, "exactly like the
  // Sabaq card." If either side is missing (e.g. checked before both
  // are actually filled in), the manual entry is left out entirely
  // rather than folding in a partial/nonsensical range -- same
  // graceful-fallback principle the single-point version already had.
  const manualFrom = manualChecked ? readSabaqDhorManualField('from') : null;
  const manualTo = manualChecked ? readSabaqDhorManualField('to') : null;
  if(manualFrom && manualTo){
    checked.push({ fromSurah: manualFrom.surah, fromAyah: manualFrom.ayah, toSurah: manualTo.surah, toAyah: manualTo.ayah });
  }
  // V4.2.8 / item 72: the picker checkbox replaces the old Use button.
  // It contributes the chosen quarter directly to the SAME composite as
  // the derived rows and manual From/To; storage and the save path stay
  // unchanged. Changing Juz/position while it is ticked changes the live
  // selection, exactly like the Dhor card's confirmed picker.
  const sdqConfirm = document.getElementById('sdq_confirm');
  const picked = sdqConfirm && sdqConfirm.checked ? sdqBounds() : null;
  if(picked){
    checked.push({
      fromSurah: picked.startSurah, fromAyah: picked.startAyah,
      toSurah: picked.endSurah, toAyah: picked.endAyah
    });
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
  sabaqDhorSelectedTags = (entry.tajweed_tag_ids || '').split(',').filter(Boolean);
  renderTajweedPicker('sabaqDhorTajweedPicker', sabaqDhorSelectedTags);
  renderCommentBlock('sabaqDhorCommentBlock', entry);
  // V3.51.0 (confirmed in chat): the RANGE is editable now -- ayah-level
  // From/To is ref-independent (physical Quran coordinates, the user's
  // own point), so the manual pickers show prepopulated from the entry;
  // the quarter-section rows and the manual row's own checkbox hide via
  // CSS while editing (Confirm changes replaced the checkbox's role).
  document.getElementById('sabaqDhorEditTopbar').classList.remove('hidden');
  document.getElementById('sabaqDhorEditBottombar').classList.remove('hidden');
  document.getElementById('sabaqDhor_rollup_up').style.display = 'none';
  document.getElementById('sabaqDhor_rollup_down').style.display = 'none';
  renderSabaqDhorRows();   // V3.51.1: re-render WITHOUT the quarter rows (editing id is set)
  renderSabaqDhorManualField('from', (entry.from_surah && entry.from_ayah) ? { surah: entry.from_surah, ayah: entry.from_ayah } : null);
  renderSabaqDhorManualField('to', (entry.to_surah && entry.to_ayah) ? { surah: entry.to_surah, ayah: entry.to_ayah } : null);
  enterEditScreenMode('card-sabaqDhor');
  moveDateIntoEditSlot('sabaqDhor');
  initEditFlow('sabaqDhor', collectSabaqDhorEditState, () => document.getElementById('sabaqDhorSaveBtn').click());
}
function collectSabaqDhorEditState(){
  return JSON.stringify({
    date: document.getElementById('sabaqDhor_date').value,
    from: readSabaqDhorManualField('from'),
    to: readSabaqDhorManualField('to'),
    mistakes: document.getElementById('sabaqDhor_mistakes').value,
    tags: sabaqDhorSelectedTags.join(','),
    notes: readCommentBlock('sabaqDhorCommentBlock')
  });
}
function cancelSabaqDhorEdit(){
  teardownEditFlow('sabaqDhor');
  restoreDateFromEditSlot('sabaqDhor', 'card-sabaqDhor');
  sabaqDhorEditingId = null;
  renderSabaqDhorRows();   // V3.51.1: quarter rows come back (id cleared)
  // edit repurposed the manual From/To for the entry's range -- clear
  // them so normal mode starts clean (same V3.45.15 principle)
  renderSabaqDhorManualField('from', null);
  renderSabaqDhorManualField('to', null);
  document.getElementById('sabaqDhorEditTopbar').classList.add('hidden');
  document.getElementById('sabaqDhorEditBottombar').classList.add('hidden');
  document.getElementById('sabaqDhor_sections').classList.remove('hidden');
  updateRollupStepperVisibility();
  exitEditScreenMode('card-sabaqDhor');
}
function resetSabaqDhorFormAfterEdit(){
  document.getElementById('sabaqDhor_date').value = (typeof logDetailSelectedDate === 'function' ? logDetailSelectedDate() : todayISO());
  document.getElementById('sabaqDhor_mistakes').value = 0;
  sabaqDhorSelectedTags = [];
  renderTajweedPicker('sabaqDhorTajweedPicker', sabaqDhorSelectedTags);
  renderCommentBlock('sabaqDhorCommentBlock', null);
}
// V3.51.0: the X in the edit heading is Cancel (abandon changes).
document.getElementById('sabaqDhorEditCloseBtn').addEventListener('click', () => {
  cancelSabaqDhorEdit();
  resetSabaqDhorFormAfterEdit();
});
document.getElementById('sabaqDhorEditDeleteBtn').addEventListener('click', async () => {
  if(!sabaqDhorEditingId) return;
  if(!confirm('Deleting this entry may create gaps in your history which cannot be recovered. Are you sure you want to DELETE?')) return;
  try{
    await logClient('sabaqDhor').remove(sabaqDhorEditingId);
    cancelSabaqDhorEdit();
    resetSabaqDhorFormAfterEdit();
    await renderRecentEntries('sabaqDhor', 'sabaqDhorRecentRail');
  } catch(e){
    document.getElementById('sabaqDhorError').textContent = "Couldn't delete: " + e.message;
  }
});
EDIT_HANDLERS.sabaqDhor = loadSabaqDhorEntryForEdit;

document.getElementById('sabaqDhorSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('sabaqDhorError');
  errEl.textContent = '';

  if(sabaqDhorEditingId){
    // V3.51.0 (confirmed in chat): gated by Confirm changes, and the
    // range IS editable now -- sent from the manual From/To pickers,
    // with 'date' included too (worker UPDATE_FIELDS accepts both).
    if(!isEditConfirmed('sabaqDhor')) return;
    const editFrom = readSabaqDhorManualField('from');
    const editTo = readSabaqDhorManualField('to');
    if(!editFrom || !editTo){
      errEl.textContent = 'Please set both From and To before saving.';
      return;
    }
    const payload = {
      date: document.getElementById('sabaqDhor_date').value || todayISO(),
      from_surah: editFrom.surah, from_ayah: editFrom.ayah,
      to_surah: editTo.surah, to_ayah: editTo.ayah,
      mistakes: parseInt(document.getElementById('sabaqDhor_mistakes').value) || 0,
      tajweed_tag_ids: sabaqDhorSelectedTags.join(','),
      ...readCommentBlock('sabaqDhorCommentBlock')
    };
    try{
      await logClient('sabaqDhor').update(sabaqDhorEditingId, payload);
      document.getElementById('sabaqDhorSaveStatus').classList.add('show');
      setTimeout(() => document.getElementById('sabaqDhorSaveStatus').classList.remove('show'), 1800);
      cancelSabaqDhorEdit();
      document.getElementById('sabaqDhor_date').value = (typeof logDetailSelectedDate === 'function' ? logDetailSelectedDate() : todayISO());
      document.getElementById('sabaqDhor_mistakes').value = 0;
      sabaqDhorSelectedTags = [];
      renderTajweedPicker('sabaqDhorTajweedPicker', sabaqDhorSelectedTags);
      renderCommentBlock('sabaqDhorCommentBlock', null);
      await renderRecentEntries('sabaqDhor', 'sabaqDhorRecentRail');
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
    tajweed_tag_ids: sabaqDhorSelectedTags.join(','),
    ...readCommentBlock('sabaqDhorCommentBlock')
  };
  try{
    // V3.45.15: duplicate-save confirmation, confirmed in chat -- same
    // mechanism as Sabaq's own version (js/sabaqPage.js), see that
    // file's own comment for the full reasoning. Checked here before
    // any of the success-only steps below (save-status, manual-field
    // clearing) run -- those should only happen once a genuine save
    // has actually occurred, not on the first, duplicate-detected
    // attempt that didn't insert anything yet.
    const saveResult = await logClient('sabaqDhor').save(payload);
    if(saveResult && saveResult.isDuplicate && !saveResult.id){
      const proceed = confirm('This entry has already been saved. Select OK to continue with saving or CANCEL to abort');
      if(!proceed) return;
      await logClient('sabaqDhor').save(Object.assign({}, payload, { force: true }));
    }
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
    // V3.45.15: the manual field's own From/To/checkbox are now explicitly
    // cleared HERE, before renderSabaqDhorScreen() runs -- confirmed as a
    // real regression the state-preservation logic added in V3.45.10
    // introduced. That logic reads whatever's currently in these 3
    // elements BEFORE clearing/rebuilding the grid, specifically so a
    // student's in-progress manual entry survives an incidental re-render
    // (a rollup-toggle tap, Move to Dhor). It has no way to tell that
    // re-render apart from this one, where the entry was just actually
    // saved and should genuinely reset -- so it was preserving the
    // just-saved values right back into the newly "blank" screen. Setting
    // these to blank/unchecked immediately before the re-render means the
    // preservation logic reads already-blank state and correctly
    // reapplies that, rather than needing to distinguish the 2 cases with
    // a new parameter threaded through multiple functions.
    renderSabaqDhorManualField('from', null);
    renderSabaqDhorManualField('to', null);
    document.getElementById('sabaqDhorManual_cb').checked = false;
    // V4.2.8: same duplicate-save guard for the new empty-state source.
    // renderSabaqDhorRows deliberately preserves live picker state across
    // incidental rebuilds, so a SUCCESSFUL save must clear its checkbox
    // explicitly before that preservation runs. Keep Juz/position in place
    // for convenience; only the confirmed selection resets.
    const sdqConfirm = document.getElementById('sdq_confirm');
    if(sdqConfirm) sdqConfirm.checked = false;
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

// V3.45.14: generalized to take a `side` parameter ('from'/'to'),
// confirmed in chat -- the manual field became a genuine From/To range
// instead of a single point, "exactly like the Sabaq card." Same
// pattern Sabaq's own renderVerseRefField(side) (js/sabaqPage.js)
// already established for this exact shape of problem -- not invented
// fresh.
function renderSabaqDhorManualField(side, value){
  const surahLabel = document.getElementById(`sabaqDhorManual_${side}_surah_label`);
  const ayahInput = document.getElementById(`sabaqDhorManual_${side}_ayah`);
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

function readSabaqDhorManualField(side){
  const surahLabel = document.getElementById(`sabaqDhorManual_${side}_surah_label`);
  const ayahInput = document.getElementById(`sabaqDhorManual_${side}_ayah`);
  const match = surahLabel.textContent.match(/^(\d+)/);
  if(!match || !ayahInput.value) return null;
  const surah = parseInt(match[1], 10);
  let ayah = parseInt(ayahInput.value, 10);
  const max = maxAyahForSurah(surah);
  if(ayah < 1) ayah = 1;
  if(ayah > max) ayah = max;
  return { surah, ayah };
}

function openSurahPickerForSabaqDhorManual(side){
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
      renderSabaqDhorManualField(side, { surah, ayah: 1 });
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

// ============================================================
// V4.2.4 — THE JUZ + QUARTER PICKER, as the rows block's EMPTY STATE.
//
// Why it exists: the suggestion rows are DERIVED from the student's own
// position, so a student who HAS MEMORISED but has no journal history is
// offered nothing — computeSabaqDhorRows returns [] for her, verified.
// Rather than adding a second control below (V4.2.3, which also landed in
// the wrong container), the picker fills the space those rows would have
// occupied: visible exactly when it is needed, invisible when it is not.
//
// V4.2.8 keeps it ADDITIVE to the same save composite: its right-hand
// checkbox contributes the selected structural quarter beside the derived
// rows and the manual From/To range. Stored shape (from/to surah+ayah), the
// save path and every downstream reader stay untouched.
//
// The conversion is the app's own proven helper, structuralQuarterBounds
// (shared/data.js) — the same one the suggestion rows use. The unit's WORD
// follows her mushaf: Quarter for IndoPak, Ru'b for 15-line Madani
// (quarterUnitWord, migration 0017's terminology).
// ============================================================
function sdqRef(){
  return (typeof sabaqDhorRef !== 'undefined' && sabaqDhorRef)
    || (typeof dhorCurrentRef !== 'undefined' && dhorCurrentRef)
    || 'waterval';
}

function sabaqDhorQuarterPickerHtml(){
  const word = typeof quarterUnitWord === 'function' ? quarterUnitWord(sdqRef()) : 'Quarter';
  const juzOpts = Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">Juz ${i + 1}</option>`).join('');
  // V4.2.8 / item 72: the quarter dropdown takes the Dhor card's own
  // segmented-control shape. The word remains as the field label; the
  // control itself is position 1|2|3|4 for every mushaf.
  const qButtons = Array.from({ length: 4 }, (_, i) =>
    `<button type="button" class="switch-option" data-value="${i + 1}">${i + 1}</button>`).join('');
  return `<p class="form-hint sdq-hint">No history yet — choose the portion she is revising.</p>
      <div class="sdq-picker" id="sabaqDhorQuarterPicker">
        <div class="sdq-row">
          <span class="sdq-field"><label class="dhor-sel-label">Juz</label><select id="sdq_juz">${juzOpts}</select></span>
          <span class="sdq-field sdq-position-field"><label class="dhor-sel-label">${word}</label>
            <input type="hidden" id="sdq_quarter" value="1">
            <div class="switch-track" id="sdq_quarter_switch"><div class="switch-thumb"></div>${qButtons}</div>
          </span>
          <span class="checkbox-box sdq-confirm-box"><input type="checkbox" id="sdq_confirm" aria-label="Confirm selected Sabaq Dhor portion"></span>
        </div>
        <div class="sdq-preview" id="sdq_preview"></div>
      </div>`;
}

function sdqBounds(){
  const juzEl = document.getElementById('sdq_juz');
  const qEl = document.getElementById('sdq_quarter');
  if(!juzEl || !qEl || typeof structuralQuarterBounds !== 'function') return null;
  const juz = parseInt(juzEl.value, 10);
  const q = parseInt(qEl.value, 10);
  if(!juz || !q) return null;
  try{ return structuralQuarterBounds(juz, q, sdqRef()); } catch(e){ return null; }
}

function sdqUpdatePreview(){
  const el = document.getElementById('sdq_preview');
  if(!el) return;
  const b = sdqBounds();
  el.textContent = b ? `${b.startSurah}:${b.startAyah} \u2013 ${b.endSurah}:${b.endAyah}` : '';
}

// Wired per render — the block's innerHTML is rebuilt each time, so the
// previous nodes and their listeners are gone (the same reason the manual
// row re-wires itself in renderSabaqDhorRows).
function wireSabaqDhorQuarterPicker(){
  const juzSel = document.getElementById('sdq_juz');
  const qInput = document.getElementById('sdq_quarter');
  const confirm = document.getElementById('sdq_confirm');
  const track = document.getElementById('sdq_quarter_switch');
  if(!juzSel || !qInput || !confirm || !track) return;   // rows exist: no picker on screen
  juzSel.addEventListener('change', sdqUpdatePreview);
  wireSwitch('sdq_quarter_switch', (value) => {
    qInput.value = value;
    renderSwitch('sdq_quarter_switch', value);
    sdqUpdatePreview();
  });
  renderSwitch('sdq_quarter_switch', qInput.value);
  sdqUpdatePreview();
}
