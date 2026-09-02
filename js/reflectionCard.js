/* Hifzhelper build 4.2.6 | js/reflectionCard.js */
// ============================================================
// Hifzhelper -- Tadabbur/reflection card (4th card in the unified day-log
// view, V3.6.1). The `reflections` table and apiReflections client
// already existed (SCHEMA.md, api.js), just had no UI until V3.6.1.
//
// Deliberately different from the other 3 cards: reflections are meant to
// be ONE per day (unlike Sabaq/Sabaq Dhor/Dhor, which allow multiple
// entries per day by design). So this card loads today's existing
// reflection if one exists and UPDATES it in place on save, rather than
// always creating a new row.
//
// V3.44.1: date field added, confirmed in chat -- reflections.date
// already existed in the schema (no migration needed), just wasn't
// exposed in the UI before this. Same pattern Sabaq's own date field
// already uses: it doesn't dynamically reload a different day's entry
// when changed, it's simply "which date this entry is for," read at
// save time -- allows backdating a reflection the same way Sabaq
// already allows backdating a log.
//
// V3.45.1: History button added, confirmed in chat -- missed in the
// first round. Reuses js/dhorPage.js's renderRecentEntries (same
// pattern Sabaq/Sabaq Dhor/Dhor already use), extended there with a
// new opt-in onRowClick parameter specifically for this: tapping the
// edit-pencil icon loads the entry for editing (loadTadabburEntryForEdit,
// below, registered the same way the other 3 cards' own edit handlers
// are), while tapping the row's own content opens it for reading
// instead (showTadabburReadView, below) -- both confirmed explicitly
// as the two separate interactions wanted here.
//
// V3.14.2: reverted from V3.12.0's Public/Private switch back to a plain
// checkbox, same as the other 3 cards' Notes block.
// ============================================================

let tadabburCurrentId = null;

// 2026-08-04, confirmed in chat: icon injection moved here from
// js/logDetailScreen.js, along with the rest of Tadabbur's own markup --
// this file now owns the whole standalone screen, not just its save
// logic.
document.getElementById('tadabburHeaderIcon').innerHTML = iconHtml('reflections');
document.getElementById('tadabburSaveIcon').innerHTML = iconHtml('save');

// V3.52.0 (confirmed in chat): the pencil now opens the same popup
// editor the three log cards got in V3.51.x, replacing the V3.21-era
// silent form fill that read as "nothing happens". Its own
// tadabburEditingId -- the main form's today-flow (tadabburCurrentId,
// auto-load + in-place Save) is untouched, as is the tap-to-read view.
let tadabburEditingId = null;
function loadTadabburEntryForEdit(row){
  tadabburEditingId = row.id;
  document.getElementById('tadabbur_text').value = row.reflection || '';
  document.getElementById('tadabbur_private').checked = !!row.is_private;
  document.getElementById('tadabbur_date').value = row.date;
  document.getElementById('tadabburError').textContent = '';
  document.getElementById('tadabburEditTopbar').classList.remove('hidden');
  document.getElementById('tadabburEditBottombar').classList.remove('hidden');
  enterEditScreenMode('tadabburCard');
  moveDateIntoEditSlot('tadabbur');
  initEditFlow('tadabbur', collectTadabburEditState, saveTadabburEdit);
}
EDIT_HANDLERS.reflections = loadTadabburEntryForEdit;

function collectTadabburEditState(){
  return JSON.stringify({
    date: document.getElementById('tadabbur_date').value,
    text: document.getElementById('tadabbur_text').value,
    priv: document.getElementById('tadabbur_private').checked
  });
}

function cancelTadabburEdit(){
  tadabburEditingId = null;
  teardownEditFlow('tadabbur');
  restoreDateFromEditSlot('tadabbur', 'tadabburCard');
  document.getElementById('tadabburEditTopbar').classList.add('hidden');
  document.getElementById('tadabburEditBottombar').classList.add('hidden');
  exitEditScreenMode('tadabburCard');
}

async function saveTadabburEdit(){
  const errEl = document.getElementById('tadabburError');
  errEl.textContent = '';
  if(!isEditConfirmed('tadabbur')) return;
  const fields = {
    date: document.getElementById('tadabbur_date').value || todayISO(),
    reflection: document.getElementById('tadabbur_text').value || null,
    is_private: document.getElementById('tadabbur_private').checked
  };
  try{
    await apiReflections.update(tadabburEditingId, fields);
    cancelTadabburEdit();
    await renderTadabburScreen();   // restores the today-state + rail
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
}

// V3.52.0: the X in the edit heading is Cancel (abandon changes).
document.getElementById('tadabburEditCloseBtn').addEventListener('click', async () => {
  cancelTadabburEdit();
  await renderTadabburScreen();
});
document.getElementById('tadabburEditDeleteBtn').addEventListener('click', async () => {
  if(!tadabburEditingId) return;
  if(!confirm('Deleting this entry may create gaps in your history which cannot be recovered. Are you sure you want to DELETE?')) return;
  try{
    await apiReflections.remove(tadabburEditingId);
    cancelTadabburEdit();
    await renderTadabburScreen();
  } catch(e){
    document.getElementById('tadabburError').textContent = "Couldn't delete: " + e.message;
  }
});

// V3.45.1: read-only view, confirmed in chat -- tapping a history
// entry's own content (not its edit icon) shows the full reflection
// text without loading it into the editable form. Simple modal
// reusing the app's existing .modal-overlay/.modal-card pattern, same
// as everywhere else a small popup is needed.
function showTadabburReadView(row){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-card">
    <button type="button" class="close-btn" id="tadabburReadCloseBtn">&times;</button>
    <h2>${row.date}</h2>
    <p style="white-space:pre-wrap;">${(row.reflection || '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</p>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
  document.getElementById('tadabburReadCloseBtn').addEventListener('click', () => overlay.remove());
}

async function renderTadabburScreen(){
  tadabburCurrentId = null;
  const textarea = document.getElementById('tadabbur_text');
  textarea.value = '';
  document.getElementById('tadabbur_private').checked = false;
  document.getElementById('tadabbur_date').value = todayISO();
  document.getElementById('tadabburError').textContent = '';
  try{
    const rows = await apiReflections.getForDate(todayISO());
    if(rows && rows.length){
      const existing = rows[0];
      tadabburCurrentId = existing.id;
      textarea.value = existing.reflection || '';
      document.getElementById('tadabbur_private').checked = !!existing.is_private;
      document.getElementById('tadabbur_date').value = existing.date;
    }
  } catch(e){
    // Non-fatal -- leave the form blank rather than blocking the whole card
    // over a failed prefill fetch; saving still works either way.
  }
  await renderRecentEntries('reflections', 'tadabburHistoryRail', showTadabburReadView);
}

document.getElementById('tadabburSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('tadabburError');
  errEl.textContent = '';
  const fields = {
    date: document.getElementById('tadabbur_date').value || todayISO(),
    reflection: document.getElementById('tadabbur_text').value || null,
    is_private: document.getElementById('tadabbur_private').checked
  };
  try{
    if(tadabburCurrentId){
      await apiReflections.update(tadabburCurrentId, fields);
    } else {
      const result = await apiReflections.save(fields);
      if(result && result.data && result.data.id) tadabburCurrentId = result.data.id;
    }
    document.getElementById('tadabburSaveStatus').classList.add('show');
    setTimeout(() => document.getElementById('tadabburSaveStatus').classList.remove('show'), 1800);
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
});
