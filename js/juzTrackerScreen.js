// ============================================================
// Hifzhelper — Juz Tracker screen behavior (V3.45)
// V3.45: connected to the Dhor pool (students.baseline_selection),
// confirmed in chat. This used to be a one-time IIFE that only wired
// the progress bar/Reset button, run once at page load -- now a proper
// renderJuzTrackerScreen(), called from showScreen() (js/app.js) every
// time this screen is entered, since the tracker's initial state now
// needs to reflect the pool fresh each visit, not just once.
//
// V3.45.3: confirmation switched from a custom .modal-overlay/
// .modal-card popup to a native confirm(), confirmed in chat -- richer
// 2-part message (what's changing, plus the full resulting completed-
// juz list). formatJuzListThreePerLine/buildJuzConfirmMessage (below)
// are shared with js/settingsScreen.js's own "Mark completed Juz" grid,
// which now gets the same confirmation treatment -- this file loads
// before that one (index.html), so it owns these.
// ============================================================

// One-time setup, same pattern reflectionCard.js already uses for
// Tadabbur's own save icon -- juzTrackerHeaderIcon itself is still
// wired centrally in app.js's init() alongside every other screen's
// header icon; this one is new to this screen (the save button itself
// didn't exist before this version), so it's wired here instead.
document.getElementById('juzTrackerSaveIcon').innerHTML = iconHtml('save');

let juzTrackerInitialValue = []; // pool-derived state at screen-entry, for diffing at save time

// Groups a sorted list of juz numbers into lines of 3, comma-separated
// within each line -- confirmed in chat as the exact format wanted for
// the "resulting list" part of the confirmation message.
function formatJuzListThreePerLine(juzArray){
  const sorted = juzArray.slice().sort((a, b) => a - b);
  const lines = [];
  for(let i = 0; i < sorted.length; i += 3){
    lines.push(sorted.slice(i, i + 3).map(j => 'Juz ' + j).join(', '));
  }
  return lines.join('\n');
}

// Builds the full native-confirm() message text, confirmed in chat as
// 2 parts: what's changing (marked complete and/or un-marked -- both
// can appear together if a session did both, Claude's own extension
// beyond the user's own description, which only covered marking), then
// the full RESULTING list of every completed juz (not just what
// changed), 3 per line. Shared between the tracker's own save flow and
// the Settings picker's commitAndClose, so both give the exact same
// message shape.
function buildJuzConfirmMessage(newlyMarked, newlyUnmarked, resultingFullList){
  const parts = [];
  if(newlyMarked.length){
    const list = newlyMarked.slice().sort((a, b) => a - b).map(j => 'Juz ' + j).join(', ');
    parts.push(`${newlyMarked.length} juz have been marked complete: ${list}`);
  }
  if(newlyUnmarked.length){
    const list = newlyUnmarked.slice().sort((a, b) => a - b).map(j => 'Juz ' + j).join(', ');
    parts.push(`${newlyUnmarked.length} juz have been un-marked: ${list}`);
  }
  const line1 = parts.join('\n');
  const line2 = resultingFullList.length
    ? `The list of completed juz will now be:\n${formatJuzListThreePerLine(resultingFullList)}`
    : 'No juz will be marked complete.';
  return `${line1}\n\n${line2}`;
}

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

    // TARGETED add/remove, confirmed as Claude's own recommendation
    // (not directly confirmed by the user either way) -- only touch
    // the specific juz actually interacted with this session, add
    // newly-marked's 4 quarter-units, remove newly-unmarked's,
    // leaving every OTHER juz already in the pool untouched. Avoids
    // the rebuild-from-scratch edge-case risk already documented for
    // the existing Settings picker (TODO.md) -- re-fetches the
    // CURRENT pool right before building the confirm message (not
    // just before writing), rather than reusing the possibly-stale
    // one loaded at screen-entry, in case something else changed it
    // in the meantime (e.g. Sabaq Dhor's own progressive
    // move-to-Dhor, in another tab/session) -- this also means the
    // "resulting list" shown in the confirm message itself is
    // accurate, not just what gets written after confirming.
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
    const resultingFullList = Array.from({length: 30}, (_, i) => i + 1)
      .filter(juz => quarterUnitsForJuz(juz).every(u => updatedPool.includes(u)));

    if(!confirm(buildJuzConfirmMessage(newlyMarked, newlyUnmarked, resultingFullList))) return;

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
  };

  // V3.49.0 Free play (confirmed in chat). The screen ALWAYS opens in
  // tracker mode -- free play is opt-in per visit and never persists,
  // so entry unconditionally resets the toggle and its hidden UI.
  // While playing, the save-wrap and the count/progress/Reset bar hide
  // (nothing to save or count); the component itself renders the blank
  // fidget Kaaba and keeps the real tracker state untouched throughout,
  // so switching back re-renders exactly what was there.
  const fpBtn = document.getElementById('juzFreeplayToggle');
  const saveWrap = document.querySelector('#screen-juzTracker .card-header-save-wrap');
  const barEl = document.querySelector('#screen-juzTracker .juz-tracker-bar');
  function setFreeplay(on){
    if(on) el.setAttribute('mode', 'freeplay');
    else el.removeAttribute('mode');            // component re-renders tracker from its untouched state
    fpBtn.classList.toggle('active', on);
    fpBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    saveWrap.classList.toggle('hidden', on);
    barEl.classList.toggle('hidden', on);
    if(!on) sync();
  }
  setFreeplay(false);                            // "always defaults to juz tracker"
  fpBtn.onclick = () => setFreeplay(el.getAttribute('mode') !== 'freeplay');
}
