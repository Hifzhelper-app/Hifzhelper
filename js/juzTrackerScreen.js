// ============================================================
// Hifzhelper — Juz Tracker screen behavior (V3.45)
// V3.45: connected to the Dhor pool (students.baseline_selection),
// confirmed in chat. This used to be a one-time IIFE that only wired
// the progress bar/Reset button, run once at page load -- now a proper
// renderJuzTrackerScreen(), called from showScreen() (js/app.js) every
// time this screen is entered, since the tracker's initial state now
// needs to reflect the pool fresh each visit, not just once.
// ============================================================

// One-time setup, same pattern reflectionCard.js already uses for
// Tadabbur's own save icon -- juzTrackerHeaderIcon itself is still
// wired centrally in app.js's init() alongside every other screen's
// header icon; this one is new to this screen (the save button itself
// didn't exist before this version), so it's wired here instead.
document.getElementById('juzTrackerSaveIcon').innerHTML = iconHtml('save');

let juzTrackerInitialValue = []; // pool-derived state at screen-entry, for diffing at save time

async function renderJuzTrackerScreen(){
  const el = document.querySelector('kaaba-juz-tracker');
  if(!el) return; // defensive -- shouldn't happen, screen markup always includes it
  const countEl = document.getElementById('juzTrackerCount');
  const fillEl = document.getElementById('juzTrackerFill');
  const resetBtn = document.getElementById('juzTrackerResetBtn');
  const saveBtn = document.getElementById('juzTrackerSaveBtn');
  const saveStatusEl = document.getElementById('juzTrackerSaveStatus');

  function sync(){
    const total = el.total || 30;
    const n = el.value.length;
    countEl.textContent = n + ' / ' + total + ' juz';
    fillEl.style.width = (n / total * 100) + '%';
  }

  // The Dhor pool determines which tiles are colored when the tracker
  // is opened, confirmed in chat -- a juz counts as complete only if
  // all 4 of its quarter-units are present in the pool, same rule the
  // existing Settings picker already uses
  // (js/settingsScreen.js's openSectionGridModal).
  let pool = [];
  try {
    const profile = await apiGetProfile();
    pool = Array.isArray(profile.baseline_selection) ? profile.baseline_selection : [];
  } catch(e) {
    // Non-fatal -- leave the tracker blank rather than blocking the
    // whole screen over a failed profile fetch.
  }
  const completeJuz = Array.from({length: 30}, (_, i) => i + 1)
    .filter(juz => quarterUnitsForJuz(juz).every(u => pool.includes(u)));
  el.value = completeJuz;
  juzTrackerInitialValue = completeJuz.slice();
  sync();

  // Re-render can happen more than once (screen re-entered) -- remove
  // any previous listener first so sync() doesn't end up bound twice.
  el.removeEventListener('juz-change', sync);
  el.addEventListener('juz-change', sync);
  resetBtn.onclick = () => el.reset();

  saveBtn.onclick = async () => {
    const current = el.value;
    const initial = juzTrackerInitialValue;
    const newlyMarked = current.filter(j => !initial.includes(j));
    const newlyUnmarked = initial.filter(j => !current.includes(j));

    if(newlyMarked.length === 0 && newlyUnmarked.length === 0){
      return; // nothing changed since entry/last save -- nothing to confirm
    }

    showJuzConfirmModal(newlyMarked, newlyUnmarked, async () => {
      // TARGETED add/remove, confirmed as Claude's own recommendation
      // (not directly confirmed by the user either way) -- only touch
      // the specific juz actually interacted with this session, add
      // newly-marked's 4 quarter-units, remove newly-unmarked's,
      // leaving every OTHER juz already in the pool untouched. Avoids
      // the rebuild-from-scratch edge-case risk already documented for
      // the existing Settings picker (TODO.md) -- re-fetches the
      // CURRENT pool right before writing, rather than reusing the
      // possibly-stale one loaded at screen-entry, in case something
      // else changed it in the meantime (e.g. Sabaq Dhor's own
      // progressive move-to-Dhor, in another tab/session).
      let currentPool;
      try {
        const profile = await apiGetProfile();
        currentPool = Array.isArray(profile.baseline_selection) ? profile.baseline_selection : [];
      } catch(e) {
        currentPool = pool.slice(); // fall back to what was loaded at screen-entry
      }
      const toAdd = newlyMarked.flatMap(juz => quarterUnitsForJuz(juz));
      const toRemove = new Set(newlyUnmarked.flatMap(juz => quarterUnitsForJuz(juz)));
      const updatedPool = [...new Set([...currentPool, ...toAdd])].filter(u => !toRemove.has(u));

      try {
        await apiSaveProfile({ baseline_selection: updatedPool });
        juzTrackerInitialValue = current.slice();
        saveStatusEl.classList.add('show');
        setTimeout(() => saveStatusEl.classList.remove('show'), 1800);
      } catch(e){
        // This screen has no dedicated form-error element the way
        // Sabaq/Tadabbur/etc. do -- a plain alert is the simplest way
        // to surface a save failure without adding one just for this.
        alert("Couldn't save: " + e.message);
      }
    });
  };
}

// Confirmation modal, confirmed in chat: "X juz have been marked
// complete" + a list, OK to continue / Cancel to correct. Extended
// here (Claude's own reasoning, not separately specified) to also
// cover un-marking with a parallel message, since removal is
// confirmed as a supported action too -- both can appear together if
// the same session did both. Reuses the existing .modal-overlay/
// .modal-card pattern (css/components.css), built dynamically the
// same way js/settingsScreen.js's own section-grid modal already is,
// rather than a native confirm() (which can't render a formatted list
// this way).
function showJuzConfirmModal(newlyMarked, newlyUnmarked, onConfirm){
  const messages = [];
  if(newlyMarked.length){
    const list = newlyMarked.slice().sort((a, b) => a - b).map(j => 'Juz ' + j).join(', ');
    messages.push(`<p>${newlyMarked.length} juz have been marked complete: ${list}</p>`);
  }
  if(newlyUnmarked.length){
    const list = newlyUnmarked.slice().sort((a, b) => a - b).map(j => 'Juz ' + j).join(', ');
    messages.push(`<p>${newlyUnmarked.length} juz have been un-marked: ${list}</p>`);
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-card">
    <h2>Confirm changes</h2>
    ${messages.join('')}
    <div class="modal-actions">
      <button type="button" class="secondary" id="juzConfirmCancelBtn">Cancel</button>
      <button type="button" class="primary" id="juzConfirmOkBtn">OK</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  document.getElementById('juzConfirmCancelBtn').addEventListener('click', () => overlay.remove());
  document.getElementById('juzConfirmOkBtn').addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
}
