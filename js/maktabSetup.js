// ============================================================
// Hifzhelper -- Maktab student setup (V3.66.0, delivery (h)).
// Per student, marks the COMPLETED AJZAA and writes their quarter units
// into the maktab Dhor pool (position_json.baselineSelection on
// maktab_position). Confirmed in chat 2026-08-16:
//   - TEACHERS may run this (unlike registration/pin reset, which stay
//     admin-only), so the gate is isTeacherOrAbove on both sides.
//   - Whole ajzaa only: "during set up only complete ajzaa are marked as
//     dhor (the system stores the 4 quarters)". Halves and quarters are
//     NOT settable here -- they only ever enter the pool later, through
//     the normal Sabaq Dhor move-to-Dhor flow, which keeps its own rules
//     (a lone quarter never moves alone; halves move sequentially).
//   - Setup RESETS the pool -- a plain replace, not a merge. So the
//     ticked ajzaa ARE the pool afterwards, and un-ticking removes one.
//     Because that is destructive, an existing pool is named in a
//     confirm before it is overwritten.
//   - Setup does NOT set sabaq: the first maktab sabaq entry establishes
//     that (sabaq prepop computes from history, not stored position, so
//     nothing needs writing here).
//
// The pool stores QUARTER UNITS (1-120) whatever granularity produced
// them -- quarterUnitId(juz, n) = (juz-1)*4 + n -- so a completed juz'
// contributes its four units. That is the same representation the PJ
// uses, which is what lets the shared Sabaq Dhor logic read it.
// ============================================================

let maktabSetupStudent = null; // { id, name }

// V3.72.0: Setup opens as a SHEET over the Dhor card, replacing the old
// full screen. Mirrors the Plan modal's .modal-overlay/.modal-card markup so
// there is one sheet pattern here, not two.
//
// Closing needs no routing at all: the card is still underneath, for the
// same student and date. That is why this replaced both the popup and the
// chip-move approaches — they existed to solve a return path this does not
// have.
function closeMaktabSetupSheet(){
  const el = document.getElementById('maktabSetupSheet');
  if(el) el.remove();
}

async function openMaktabStudentSetup(student){
  maktabSetupStudent = student;
  closeMaktabSetupSheet();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay maktab-setup-modal';
  overlay.id = 'maktabSetupSheet';
  overlay.innerHTML = `<div class="modal-card maktab-setup-card">
    <button type="button" class="maktab-setup-close" id="maktabSetupCloseBtn" aria-label="Close"></button>
    <div id="maktabSetupBody"></div>
  </div>`;
  document.body.appendChild(overlay);
  const closeBtn = document.getElementById('maktabSetupCloseBtn');
  closeBtn.innerHTML = (typeof iconHtml === 'function') ? iconHtml('close') : '\u00d7';
  closeBtn.addEventListener('click', closeMaktabSetupSheet);
  await renderMaktabSetupScreen(document.getElementById('maktabSetupBody'));
}

function maktabJuzUnits(juz){
  return [1, 2, 3, 4].map(q => quarterUnitId(juz, q));
}

// A juz' counts as complete when ALL FOUR of its quarter units are in
// the pool -- the same "membership IS already moved" rule the Sabaq Dhor
// lingering logic uses, rather than a second parallel notion of done.
function maktabCompletedJuzFromPool(pool){
  const set = new Set(Array.isArray(pool) ? pool : []);
  const out = [];
  for(let j = 1; j <= 30; j++){
    if(maktabJuzUnits(j).every(u => set.has(u))) out.push(j);
  }
  return out;
}

// V3.72.0: takes its host, so the one renderer serves the sheet. The old
// full screen is gone; the name heading with it — the sheet opens from her
// own Dhor card, so the name needs no repeating.
async function renderMaktabSetupScreen(host){
  if(!host) return;
  if(!maktabSetupStudent){
    host.innerHTML = '<p class="form-hint">Open a student from the Maktab summary.</p>';
    return;
  }
  host.innerHTML = '<p class="form-hint">Loading\u2026</p>';

  let pool = [];
  try{
    const pos = await apiGetMaktabPosition(maktabSetupStudent.id);
    let blob = null;
    try{ blob = pos && pos.position_json ? JSON.parse(pos.position_json) : null; } catch(e){ blob = null; }
    pool = (blob && Array.isArray(blob.baselineSelection)) ? blob.baselineSelection : [];
  } catch(e){ pool = []; }

  const done = new Set(maktabCompletedJuzFromPool(pool));
  // Partial ajzaa (some but not all four units, from a later half-move)
  // are shown as such and left ALONE by an untouched save -- setup marks
  // whole ajzaa, so it must not silently promote or discard a partial.
  const set = new Set(pool);
  const partial = [];
  for(let j = 1; j <= 30; j++){
    const units = maktabJuzUnits(j);
    const n = units.filter(u => set.has(u)).length;
    if(n > 0 && n < 4) partial.push(j);
  }

  host.innerHTML = `
    <p class="form-hint">Tick every juz' this student has completed and is revising. This sets the maktab's Dhor pool for her — saving replaces whatever is there now.</p>
    <div class="maktab-setup-grid" id="maktabSetupGrid">
      ${Array.from({ length: 30 }, (_, i) => i + 1).map(j => `
        <label class="maktab-setup-juz${partial.includes(j) ? ' partial' : ''}">
          <input type="checkbox" data-juz="${j}"${done.has(j) ? ' checked' : ''}>
          <span>Juz ${j}</span>
        </label>`).join('')}
    </div>
    ${partial.length ? `<p class="form-hint">Juz ${partial.join(', ')} ${partial.length === 1 ? 'is' : 'are'} partly in the pool from a half moved to Dhor. Ticking marks the whole juz'; leaving unticked removes the part.</p>` : ''}
    <button type="button" class="primary-btn" id="maktabSetupSave">Save setup</button>
    <span class="save-status" id="maktabSetupStatus"></span>`;

  document.getElementById('maktabSetupSave').addEventListener('click', () => saveMaktabStudentSetup(pool, host));
}

async function saveMaktabStudentSetup(existingPool, host){
  const status = document.getElementById('maktabSetupStatus');
  const ticked = [...document.querySelectorAll('#maktabSetupGrid input[data-juz]:checked')]
    .map(el => Number(el.dataset.juz));
  const newPool = ticked.flatMap(maktabJuzUnits).sort((a, b) => a - b);

  // Destructive: name what is being replaced rather than a bare "sure?".
  if(Array.isArray(existingPool) && existingPool.length){
    const wasJuz = maktabCompletedJuzFromPool(existingPool);
    const removed = wasJuz.filter(j => !ticked.includes(j));
    const msg = removed.length
      ? `This replaces her current Dhor pool. Juz ${removed.join(', ')} will no longer be in it. Continue?`
      : 'This replaces her current Dhor pool. Continue?';
    if(!confirm(msg)) return;
  }

  status.textContent = 'Saving\u2026';
  let blob = {};
  try{
    const pos = await apiGetMaktabPosition(maktabSetupStudent.id);
    if(pos && pos.position_json) blob = JSON.parse(pos.position_json) || {};
  } catch(e){ blob = {}; }
  blob.baselineSelection = newPool; // replace, never merge (confirmed)

  try{
    await apiSaveMaktabPosition(maktabSetupStudent.id, JSON.stringify(blob), null);
  } catch(e){
    status.textContent = (e && e.message) ? e.message : 'Could not save.';
    return;
  }
  status.textContent = 'Saved \u2713';
}
