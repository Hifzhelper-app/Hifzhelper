/* Hifzhelper build 4.2.6 | js/home.js */
// ============================================================
// Hifzhelper — Home page
// Icon tiles mirroring the dropdown menu's nav items (minus logout/
// refresh, which are session actions, not destinations).
// V3.41.2: a real "Home" tile prepended as the first item, confirmed
// in chat, per a reference image -- always shown active (lavender),
// since you're already on Home. Deliberately NOT part of NAV_ITEMS
// (that would also add it to the dropdown on every other screen,
// redundant with the X-to-Home button already there) -- hardcoded
// here instead, Home-page-only. No data-nav attribute and no click
// listener: showScreen's own active-highlight loop only ever touches
// [data-nav] elements, so this tile's hardcoded "active" class is safe
// from being toggled off later, and there's nothing meaningful for a
// tap to do since you're already here.
// ============================================================

function renderHomeScreen(){
  renderNavItemsInto('homeGrid');
  const homeTile = document.createElement('div');
  homeTile.className = 'nav-icon-item active';
  homeTile.innerHTML = `<span class="nav-icon-item-icon">${iconHtml('home')}</span><span class="nav-icon-item-label">Home</span>`;
  document.getElementById('homeGrid').prepend(homeTile);

  // V3.45.7: Timer tile, confirmed in chat -- same hardcoded pattern as
  // Home's own tile above (also deliberately not part of NAV_ITEMS, for
  // the same reason), but this one DOES get a click listener, unlike
  // Home's -- it's a real action (opens the floating timer), not just
  // an "already here" indicator the way Home's own tile is.
  const timerTile = document.createElement('div');
  timerTile.className = 'nav-icon-item';
  timerTile.innerHTML = `<span class="nav-icon-item-icon">${iconHtml('timer')}</span><span class="nav-icon-item-label">Timer</span>`;
  timerTile.addEventListener('click', () => openFloatingTimer());
  document.getElementById('homeGrid').appendChild(timerTile);
}
