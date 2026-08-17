// ============================================================
// Hifzhelper — Sabaq card (one of 4 in the unified day-log view, V3.6.1)
// Current as of V3.38
// V3.14.0 rebuild: sabaq_from/sabaq_to (migration 0015) replace the old
// surah/ayah_from/ayah_to trio — each is a combined "surah:ayah" string,
// letting one entry span multiple surahs and cross at most one juz'
// boundary (confirmed in chat: no other limit on how many ayahs/surahs a
// sabaq entry can cover). Each field renders as one combined control:
// a chevron (opens the full surah picker) + surah name + ":" + an ayah
// number input (steppable via the browser's own number controls, or the
// numeric keypad) bounded to that surah's own 1..N ayah range. Ayahs do
// NOT roll over into the next surah automatically — only the chevron
// changes which surah is selected.
//
// Prepopulation (js/position.js's nextSabaqDefaults): any Dhor history at
// all → neither field prepopulates; no Sabaq history yet → 114:1/114:6;
// otherwise the last reached point prefills To if currently in juz' 30
// (studied backwards) or From otherwise (studied forwards) — the other
// field is left for the student to fill in.
//
// Has its own independent date selector (defaults to today on every open)
// so a missed day can be logged without affecting the other 3 cards —
// this only changes which `date` a NEW entry saves under, doesn't load/
// edit an existing entry for that date (multiple entries per day are
// deliberately allowed app-wide — see SCHEMA.md).
// ============================================================

let sabaqSelectedTags = [];
let sabaqPosition = null;
// V3.45.4: the computed frontier itself, separate from sabaqPosition --
// sabaqPosition now only carries the genuinely stateful fields
// (previousJuz, sabaqDhorRollup, sabaqDhorManualOverride); sabaqTo/
// activeJuz aren't stored anywhere anymore, computed fresh into this
// variable instead (see js/position.js's file header for why).
let sabaqFrontier = null;
let sabaqRef = 'waterval';
// { from: {surah, ayah} | null, to: {surah, ayah} | null } — the two
// combined fields' current values, kept here since the DOM only shows a
// formatted display, not the raw numbers.
let sabaqValue = { from: null, to: null };
// V3.21.0: editing an existing entry (js/dhorPage.js's History popup,
// EDIT_HANDLERS.sabaq below) loads it into this same form rather than a
// separate edit UI. sabaqEditingId is null for a normal new entry.
// sabaqEditingIsFrontier matters specifically for Sabaq: position should
// only ever be recomputed from the entry that's actually the current
// frontier (the one position.sabaqTo was derived from) -- recomputing it
// from an older entry would silently move position backward. It's set
// once, when the entry is loaded (is this the single most recent Sabaq
// entry for this student?), not re-checked after saving.
let sabaqEditingId = null;
let sabaqEditingIsFrontier = false;

// 2026-08-07 (V3.38): IndoPak's Maqra/Rub'/Hizb picker is on hold --
// this used to take a 2nd (indopakTerminology) parameter and branch on
// it for IndoPak specifically; removed along with that picker (and the
// indopak_terminology column, migration 0017). IndoPak is Quarter/Half
// only now, same as 13-line -- both fall to the final `return
// 'waterval'`, natively (see shared/data.js's RUB_BOUNDARIES comment),
// not as a fallback.
function refForMushafSabaq(mushaf){
  if(mushaf === '15line_madani') return 'uthmani';
  return 'waterval';
}

function renderVerseRefField(side){
  const v = sabaqValue[side];
  const surahLabel = document.getElementById(`sabaq_${side}_surah_label`);
  const ayahInput = document.getElementById(`sabaq_${side}_ayah`);
  if(!v){
    surahLabel.textContent = '—';
    ayahInput.value = '';
    ayahInput.min = '';
    ayahInput.max = '';
    return;
  }
  surahLabel.textContent = `${v.surah} ${surahName(v.surah)}`;
  ayahInput.min = '1';
  ayahInput.max = String(maxAyahForSurah(v.surah));
  ayahInput.value = String(v.ayah);
}

function readVerseRefField(side){
  const surahLabel = document.getElementById(`sabaq_${side}_surah_label`);
  const ayahInput = document.getElementById(`sabaq_${side}_ayah`);
  const match = surahLabel.textContent.match(/^(\d+)/);
  if(!match || !ayahInput.value) return null;
  const surah = parseInt(match[1], 10);
  let ayah = parseInt(ayahInput.value, 10);
  const max = maxAyahForSurah(surah);
  if(ayah < 1) ayah = 1;
  if(ayah > max) ayah = max;
  return { surah, ayah };
}

function openSurahPickerFor(side){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay surah-picker-modal';
  overlay.innerHTML = `<div class="modal-card">
    <button type="button" class="close-btn" id="surahPickerCloseBtn">&times;</button>
    <h2>Choose Surah</h2>
    <div class="surah-picker-list" id="surahPickerList"></div>
  </div>`;
  document.body.appendChild(overlay);
  const listEl = document.getElementById('surahPickerList');
  listEl.innerHTML = SURAHS.map(([num, name]) => `<button type="button" class="tajweed-tag surah-picker-row" data-surah="${num}">${num}. ${name}</button>`).join('');
  listEl.querySelectorAll('[data-surah]').forEach(btn => {
    btn.addEventListener('click', () => {
      const surah = parseInt(btn.dataset.surah, 10);
      sabaqValue[side] = { surah, ayah: 1 };
      renderVerseRefField(side);
      overlay.remove();
    });
  });
  overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
  document.getElementById('surahPickerCloseBtn').addEventListener('click', () => overlay.remove());
}
document.getElementById('sabaq_from_chevron').addEventListener('click', () => openSurahPickerFor('from'));
document.getElementById('sabaq_to_chevron').addEventListener('click', () => openSurahPickerFor('to'));

// V3.18.0: the verse-ref grid's right-hand chevron column is a new
// explicit up/down stepper for the ayah value -- added because it was
// the native number input's own spinner that wasn't rendering ("not
// visible at all"), so this replaces reliance on it rather than trying
// to make it visible. Dispatches 'change' so the existing listeners
// below (which keep sabaqValue in sync and recompute line/page counts)
// fire exactly as if the number had been typed in directly.
function stepAyah(inputId, delta){
  const input = document.getElementById(inputId);
  const min = parseInt(input.min, 10) || 1;
  const max = parseInt(input.max, 10) || 999;
  let val = parseInt(input.value, 10);
  if(isNaN(val)) val = min;
  val = Math.min(max, Math.max(min, val + delta));
  input.value = String(val);
  input.dispatchEvent(new Event('change'));
}
document.querySelectorAll('.verse-ref-ayah-up').forEach(btn => {
  btn.addEventListener('click', () => stepAyah(btn.dataset.target, 1));
});
document.querySelectorAll('.verse-ref-ayah-down').forEach(btn => {
  btn.addEventListener('click', () => stepAyah(btn.dataset.target, -1));
});

document.getElementById('sabaq_from_ayah').addEventListener('change', () => {
  const v = readVerseRefField('from');
  if(v){ sabaqValue.from = v; renderVerseRefField('from'); }
});
document.getElementById('sabaq_to_ayah').addEventListener('change', () => {
  const v = readVerseRefField('to');
  if(v){ sabaqValue.to = v; renderVerseRefField('to'); }
  recomputeSabaqLineCount();
});
// 2026-08-05, confirmed in chat: the auto-calc above only ever fires
// from the "To" ayah field's own change event -- it silently misses the
// stepper buttons, the surah picker (either field), and the "From"
// field entirely, so Lines/Pages could easily go stale relative to
// whatever the range actually is. Checking Confirm selection -- the one
// moment guaranteed to happen right before every save -- recomputes it
// fresh regardless of which of those paths actually built the range.
document.getElementById('sabaq_confirm').addEventListener('change', (e) => {
  if(e.target.checked) recomputeSabaqLineCount();
});

async function renderSabaqScreen(){
  // V3.21.0/V3.22.0: reset any stale editing state from a previous visit
  // -- if the screen was closed mid-edit (e.g. via xclose) without
  // saving or cancelling, a fresh open must not silently PATCH that old
  // entry, and must not leave the edit-screen takeover mode stuck on.
  sabaqEditingId = null;
  sabaqEditingIsFrontier = false;
  document.getElementById('sabaqEditTopbar').classList.add('hidden');
  document.getElementById('sabaqEditBottombar').classList.add('hidden');
  exitEditScreenMode('card-sabaq');
  sabaqSelectedTags = [];
  document.getElementById('sabaq_date').value = todayISO();
  document.getElementById('sabaq_line_count').value = '';
  document.getElementById('sabaq_page_count').value = '';

  let profile = null;
  try{ profile = await logProfile(); } catch(e){ profile = null; }
  sabaqRef = refForMushafSabaq(profile && profile.mushaf);
  sabaqPosition = await loadPosition();
  // V3.45.4: computed fresh from real history every time, not read from
  // a stored value -- see js/position.js's file header.
  let entriesForFrontier = [];
  try{ entriesForFrontier = await logClient('sabaq').get(); } catch(e){ entriesForFrontier = []; }
  sabaqFrontier = computeActualSabaqFrontier(entriesForFrontier, sabaqRef);
  const dhorExists = await hasDhorHistory();

  const defaults = nextSabaqDefaults(sabaqFrontier, sabaqRef, dhorExists);
  sabaqValue = { from: defaults.from, to: defaults.to };
  renderVerseRefField('from');
  renderVerseRefField('to');

  renderTajweedPicker('sabaqTajweedPicker', sabaqSelectedTags);
  renderCommentBlock('sabaqCommentBlock', null);
  await renderRecentEntries('sabaq', 'sabaqRecentRail');
}

// V3.14.2: page count is a fixed-standard capacity measure, not a real-
// page tracker (confirmed in chat) -- always divides by 13 lines/page
// and rounds DOWN to the nearest quarter-page, regardless of which
// mushaf print or which actual pages were touched. Only the line count
// itself comes from the real per-print calculation (getLinesForSpan);
// page count is derived from that line count alone.
function recomputeSabaqLineCount(){
  const from = sabaqValue.from, to = sabaqValue.to;
  if(!from || !to) return;
  // 2026-08-06, confirmed in chat: Lines/Pages reads the mushaf's own
  // real dataset directly (pageRefForMushaf) -- deliberately NOT sabaqRef,
  // which is a different concern (Juz'-position tracking elsewhere in
  // this file) that only ever distinguishes uthmani vs waterval, not the
  // IndoPak dataset this needs to reach.
  const result = getLinesForSpan(from.surah, from.ayah, to.surah, to.ayah, pageRefForMushaf(profile && profile.mushaf));
  if(!result) return;
  document.getElementById('sabaq_line_count').value = result.lineCount;
  document.getElementById('sabaq_page_count').value = Math.floor((result.lineCount / 13) * 4) / 4;
}

// V3.21.0: loads an existing entry into this same form for editing --
// reuses every existing field/picker/validation rather than a separate
// edit UI. Registered below as EDIT_HANDLERS.sabaq (js/dhorPage.js's
// History popup calls this when its edit icon is tapped).
// V3.22.0: now opens the dedicated edit screen (enterEditScreenMode,
// js/logDetailScreen.js) instead of showing an inline banner in the
// normal card. Delete is disabled (not hidden) for the frontier entry --
// confirmed in chat, Sabaq-only, since deleting it would leave
// position.sabaqTo pointing at a row that no longer exists.
function loadSabaqEntryForEdit(entry, isLatest){
  sabaqEditingId = entry.id;
  sabaqEditingIsFrontier = isLatest;
  document.getElementById('sabaq_date').value = entry.date;
  // V3.22.1 fix: some historical rows have a genuinely null sabaq_from/
  // sabaq_to (shown as "null-null" in History) -- calling .split() on
  // null threw immediately, before anything else in this function ran,
  // so the edit screen never actually opened for those entries and
  // Delete was unreachable. parseVerseRef falls back to null (the same
  // "—" placeholder state renderVerseRefField already handles for a
  // genuinely empty field) instead of crashing.
  const parseVerseRef = (raw) => {
    const parts = String(raw || '').split(':').map(Number);
    return (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) ? { surah: parts[0], ayah: parts[1] } : null;
  };
  sabaqValue = { from: parseVerseRef(entry.sabaq_from), to: parseVerseRef(entry.sabaq_to) };
  renderVerseRefField('from');
  renderVerseRefField('to');
  document.getElementById('sabaq_line_count').value = entry.line_count || '';
  document.getElementById('sabaq_page_count').value = entry.page_count || '';
  sabaqSelectedTags = (entry.tajweed_tags || '').split(',').filter(Boolean);
  renderTajweedPicker('sabaqTajweedPicker', sabaqSelectedTags);
  renderCommentBlock('sabaqCommentBlock', entry);
  // V3.51.0: heading date is the card's own control, relocated into the
  // edit heading -- entry's real date, fully editable (worker accepts
  // 'date' on update now).
  document.getElementById('sabaqEditTopbar').classList.remove('hidden');
  document.getElementById('sabaqEditBottombar').classList.remove('hidden');
  const deleteBtn = document.getElementById('sabaqEditDeleteBtn');
  deleteBtn.style.display = isLatest ? 'none' : '';
  enterEditScreenMode('card-sabaq');
  moveDateIntoEditSlot('sabaq');
  initEditFlow('sabaq', collectSabaqEditState, () => document.getElementById('sabaqSaveBtn').click());
}
function collectSabaqEditState(){
  return JSON.stringify({
    date: document.getElementById('sabaq_date').value,
    from: sabaqValue.from, to: sabaqValue.to,
    lines: document.getElementById('sabaq_line_count').value,
    pages: document.getElementById('sabaq_page_count').value,
    tags: sabaqSelectedTags.join(','),
    notes: readCommentBlock('sabaqCommentBlock')
  });
}
function cancelSabaqEdit(){
  teardownEditFlow('sabaq');
  restoreDateFromEditSlot('sabaq', 'card-sabaq');
  sabaqEditingId = null;
  sabaqEditingIsFrontier = false;
  document.getElementById('sabaqEditTopbar').classList.add('hidden');
  document.getElementById('sabaqEditBottombar').classList.add('hidden');
  exitEditScreenMode('card-sabaq');
}
async function resetSabaqFormAfterEdit(){
  const dhorExists = await hasDhorHistory();
  const next = nextSabaqDefaults(sabaqFrontier, sabaqRef, dhorExists);
  sabaqValue = { from: next.from, to: next.to };
  renderVerseRefField('from');
  renderVerseRefField('to');
  document.getElementById('sabaq_date').value = todayISO();
  document.getElementById('sabaq_line_count').value = '';
  document.getElementById('sabaq_page_count').value = '';
  sabaqSelectedTags = [];
  renderTajweedPicker('sabaqTajweedPicker', sabaqSelectedTags);
  renderCommentBlock('sabaqCommentBlock', null);
}
// V3.51.0: the X in the edit heading is Cancel (abandon changes).
document.getElementById('sabaqEditCloseBtn').addEventListener('click', async () => {
  cancelSabaqEdit();
  await resetSabaqFormAfterEdit();
});
document.getElementById('sabaqEditDeleteBtn').addEventListener('click', async () => {
  if(!sabaqEditingId || sabaqEditingIsFrontier) return;
  if(!confirm('Deleting this entry may create gaps in your history which cannot be recovered. Are you sure you want to DELETE?')) return;
  try{
    await logClient('sabaq').remove(sabaqEditingId);
    cancelSabaqEdit();
    await resetSabaqFormAfterEdit();
    await renderRecentEntries('sabaq', 'sabaqRecentRail');
  } catch(e){
    document.getElementById('sabaqError').textContent = "Couldn't delete: " + e.message;
  }
});
EDIT_HANDLERS.sabaq = loadSabaqEntryForEdit;

document.getElementById('sabaqSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('sabaqError');
  errEl.textContent = '';
  const from = sabaqValue.from, to = sabaqValue.to;
  if(!from || !to){
    errEl.textContent = 'Please fill in both the From and To ayahs.';
    return;
  }
  if(!crossesAtMostOneJuzBoundary(from.surah, from.ayah, to.surah, to.ayah, sabaqRef)){
    errEl.textContent = "This range crosses more than one juz' boundary — please split it into separate entries.";
    return;
  }
  // 2026-08-05, confirmed in chat: replaces the earlier "nothing
  // entered" confirm() entirely -- a real, dedicated confirmation
  // checkbox now, operating exactly like Sabaq Dhor's own hard-block
  // ("please check at least one section" there; the equivalent message
  // here below). Applies to every save, new or edit -- unlike the
  // check it replaces, which only applied to new entries, this is about
  // confirming whatever the current selection actually is, which
  // matters just as much when editing.
  if(sabaqEditingId){
    // V3.51.0: editing is gated by Confirm changes (the flow), not the
    // checkbox -- which is hidden in edit mode.
    if(!isEditConfirmed('sabaq')) return;
  } else if(!document.getElementById('sabaq_confirm').checked){
    errEl.textContent = 'Please confirm the selection before saving.';
    return;
  }
  const payload = {
    date: document.getElementById('sabaq_date').value || todayISO(),
    sabaq_from: formatVerseRef(from.surah, from.ayah),
    sabaq_to: formatVerseRef(to.surah, to.ayah),
    line_count: parseInt(document.getElementById('sabaq_line_count').value) || null,
    page_count: parseInt(document.getElementById('sabaq_page_count').value) || null,
    tajweed_tags: sabaqSelectedTags.join(','),
    ...readCommentBlock('sabaqCommentBlock')
  };
  try{
    if(sabaqEditingId){
      await logClient('sabaq').update(sabaqEditingId, payload);
    } else {
      // V3.45.15: duplicate-save confirmation, confirmed in chat --
      // insertLog (worker/src/logHelpers.js) now returns
      // { isDuplicate: true } WITHOUT actually inserting when it finds
      // an identical entry already logged for this student/date and
      // the payload doesn't already carry force:true. That's exactly
      // the signal checked for here: no result.id means nothing was
      // saved yet, genuinely still abortable. Native confirm(), same
      // established pattern already used elsewhere in this app (Juz
      // Tracker/Settings) rather than a custom modal -- OK re-sends
      // the exact same payload with force:true added, which
      // insertLog then honors by inserting regardless (still correctly
      // flagged is_duplicate on the row either way); Cancel leaves the
      // form exactly as it was, nothing sent, nothing saved.
      const result = await logClient('sabaq').save(payload);
      if(result && result.isDuplicate && !result.id){
        const proceed = confirm('This entry has already been saved. Select OK to continue with saving or CANCEL to abort');
        if(!proceed) return;
        await logClient('sabaq').save(Object.assign({}, payload, { force: true }));
      }
    }
    document.getElementById('sabaqSaveStatus').classList.add('show');
    setTimeout(() => document.getElementById('sabaqSaveStatus').classList.remove('show'), 1800);
    document.getElementById('sabaq_confirm').checked = false;

    // Position only ever advances here for a genuinely new entry, or an
    // edit to the entry that's confirmed to be the current frontier
    // (sabaqEditingIsFrontier, set when the entry was loaded -- see
    // loadSabaqEntryForEdit). Editing an older entry must never touch
    // position, regardless of what changed in it.
    // V3.45.4: re-fetches Sabaq history fresh (now including the entry
    // just saved above) and recomputes the frontier from it, rather than
    // trusting whatever sabaqFrontier already held -- this is the fix
    // itself: even if something in this block fails, prepopulation and
    // Sabaq Dhor's own "current" display are NEVER affected, since both
    // now always recompute independently from real history on their own
    // next load, not from anything this block writes. What CAN still be
    // lost on a failure here is narrower than before: only previousJuz
    // (the lingering-juz' tracking) and sabaqDhorManualOverride's clear
    // -- both real but genuinely lower-stakes than the original bug,
    // which could stick prepopulation itself. Kept as a best-effort
    // catch for that reason, flagged here rather than silently assumed
    // fine -- not separately re-confirmed with the user.
    if(!sabaqEditingId || sabaqEditingIsFrontier){
      try{
        const freshEntries = await logClient('sabaq').get();
        const newFrontier = computeActualSabaqFrontier(freshEntries, sabaqRef);
        sabaqPosition = advancePositionAfterSabaq(sabaqPosition, sabaqFrontier, newFrontier, sabaqRef);
        sabaqFrontier = newFrontier;
        await savePosition(sabaqPosition);
        // Phase 2b (V3.17.0): the automatic half of the move-to-Dhor
        // transition -- if a previous juz' is lingering and this save just
        // completed at least one quarter of the new one, whatever's left
        // of the old juz' moves to Dhor automatically. Independent of the
        // manual tickbox on Sabaq Dhor's own card -- whichever happens first.
        const profile = await logProfile();
        const currentPool = Array.isArray(profile.baseline_selection) ? profile.baseline_selection.slice() : [];
        const autoMove = maybeAutoMoveToDhor(sabaqPosition, sabaqRef, currentPool);
        if(autoMove.moved){
          sabaqPosition = autoMove.position;
          await savePosition(sabaqPosition);
          await logSavePool(autoMove.baselineSelection);
        }
      } catch(e){ /* best-effort -- sabaq entry itself already saved */ }
    }

    if(sabaqEditingId) cancelSabaqEdit();
    await renderRecentEntries('sabaq', 'sabaqRecentRail');
    const dhorExists = await hasDhorHistory();
    const next = nextSabaqDefaults(sabaqFrontier, sabaqRef, dhorExists);
    sabaqValue = { from: next.from, to: next.to };
    renderVerseRefField('from');
    renderVerseRefField('to');
    document.getElementById('sabaq_line_count').value = '';
    document.getElementById('sabaq_page_count').value = '';
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
});
