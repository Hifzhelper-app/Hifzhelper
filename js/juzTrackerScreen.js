// ============================================================
// Hifzhelper — Juz Tracker screen behavior (V3.40.1)
// Download SVG and Mark next juz were both removed per user request
// (marking now happens only by tapping the tiles) -- since
// js/kaabaTracker.js's `controls` attribute is all-or-nothing
// ("full" or "none"), index.html now uses controls="none" and the
// progress bar + Reset button are hand-built in index.html/css/
// juzTracker.css, wired here instead of coming from the component.
// ============================================================

(function(){
  const el = document.querySelector('kaaba-juz-tracker');
  if(!el) return; // defensive -- shouldn't happen, screen markup always includes it
  const countEl = document.getElementById('juzTrackerCount');
  const fillEl = document.getElementById('juzTrackerFill');
  const resetBtn = document.getElementById('juzTrackerResetBtn');

  function sync(){
    const total = el.total || 30;
    const n = el.value.length;
    countEl.textContent = n + ' / ' + total + ' juz';
    fillEl.style.width = (n / total * 100) + '%';
  }

  el.addEventListener('juz-change', sync);
  resetBtn.addEventListener('click', () => el.reset());

  // The component builds its own initial state in connectedCallback
  // (already in the DOM via index.html by the time this script runs),
  // and 'juz-change' only fires on a future toggle/reset -- so an
  // explicit first sync is needed here to show the correct count on
  // page load rather than a stale "0 / 30" until the first tap.
  sync();
})();
