// ============================================================
// Hifzhelper — unified day-log view orchestrator (V3.6.1)
// Replaces the old 3 separate Sabaq/Sabaq Dhor/Dhor screens with one
// screen holding all 4 cards (Sabaq/Sabaq Dhor/Dhor/Tadabbur). Renders all
// 4 on entry, scrolls the rail so whichever journal column header was
// clicked opens on that card, and keeps the dot indicators in sync with
// scroll position on the tablet/mobile rail (desktop is a static 1x4
// grid — no scrolling, dots hidden via CSS).
// ============================================================

// 2026-08-04, confirmed in chat: the rail's 4th slot is now the Timer
// (a permanent card, not an on-demand overlay) instead of Tadabbur --
// Tadabbur moved to its own standalone nav destination/screen
// (js/reflectionCard.js, js/app.js's 'reflections' route). The Timer
// itself is a self-contained web component (js/session-timer.js) --
// nothing here renders its content the way renderSabaqScreen() etc. do
// for the other 3, so it's simply absent from the Promise.all below.
const LOG_DETAIL_CARD_ORDER = ['sabaq', 'sabaqDhor', 'dhor', 'timer'];

// V3.12.0: header icons (display only, no click action) + save-button
// icons for all 3 real cards, injected once here rather than per-render
// since they never change. Tadabbur's own icons moved out along with the
// rest of its markup -- js/reflectionCard.js is otherwise unchanged.
document.getElementById('sabaqHeaderIcon').innerHTML = iconHtml('sabaq');
document.getElementById('sabaqDhorHeaderIcon').innerHTML = iconHtml('sabaqDhor');
document.getElementById('dhorHeaderIcon').innerHTML = iconHtml('dhor');
document.getElementById('sabaqSaveIcon').innerHTML = iconHtml('save');
document.getElementById('sabaqDhorSaveIcon').innerHTML = iconHtml('save');
document.getElementById('dhorSaveIcon').innerHTML = iconHtml('save');

// V3.19.0: xclose exits back to Journal -- the landing page this screen
// is always reached from (via a journal-table cell click). There's no
// navigation history stack anywhere in the app (showScreen is a direct
// switch, not a push/pop), so "back" has no more general meaning here
// than that fixed target.
document.getElementById('logDetailClose').innerHTML = iconHtml('close');
document.getElementById('logDetailClose').addEventListener('click', () => showScreen('journal'));

// V3.22.0: edit screen bottom-bar icons (Sabaq/Sabaq Dhor/Dhor), injected
// once here like the rest of this file's icons. Update reuses the exact
// same 'save' icon as the normal Save button, per the confirmed design.
['sabaq', 'sabaqDhor', 'dhor'].forEach(prefix => {
  document.getElementById(`${prefix}EditCancelIcon`).innerHTML = iconHtml('close');
  document.getElementById(`${prefix}EditDeleteIcon`).innerHTML = iconHtml('trash');
  document.getElementById(`${prefix}EditUpdateIcon`).innerHTML = iconHtml('save');
});
document.getElementById('dhorStopwatchIcon').innerHTML = iconHtml('timer');

// V3.22.0: the edit "screen" is a full takeover of THIS screen rather
// than a new entry in js/app.js's router -- reuses each card's existing
// fields/pickers as-is instead of duplicating them. Hides the tabs/dots
// row and every card except the one being edited; within that card, its
// own loadXEntryForEdit (js/sabaqPage.js etc.) hides the normal header/
// History and shows the grey top/bottom bars in their place.
function enterEditScreenMode(cardId){
  document.getElementById('screen-logDetail').classList.add('log-detail-editing');
  document.getElementById(cardId).classList.add('editing-active');
}
function exitEditScreenMode(cardId){
  document.getElementById('screen-logDetail').classList.remove('log-detail-editing');
  document.getElementById(cardId).classList.remove('editing-active');
}

async function renderLogDetailScreen(initialCard){
  await Promise.all([
    renderSabaqScreen(),
    renderSabaqDhorScreen(),
    renderDhorScreen()
  ]);

  const rail = document.getElementById('logDetailRail');
  const startIndex = Math.max(0, LOG_DETAIL_CARD_ORDER.indexOf(initialCard));
  const startCard = rail.children[startIndex];
  // Instant jump on entry — no smooth-scroll animation for the initial
  // position, that's reserved for deliberate dot taps below.
  if(startCard) rail.scrollLeft = startCard.offsetLeft;
  updateLogDetailDots();
}

// V3.18.0 fix: this used to compare card.offsetLeft against rail.scrollLeft,
// which silently broke once #appContent gained `transform: translateZ(0)`
// (V3.4.3's Safari-paint fix) -- a transformed ancestor becomes the nearest
// offsetParent for elements inside it in every major browser, so each
// card's offsetLeft was actually being measured from #appContent's edge,
// several DOM levels above the rail, not from the rail's own content box.
// That added a constant (#appContent's own padding) to every comparison,
// so a dot only flipped "active" once you'd scrolled well past where the
// card had actually snapped into place -- exactly the "erratic"/
// "misaligned" symptom reported, and invisible from reading either file in
// isolation since neither one looks wrong on its own.
// getBoundingClientRect() is always viewport-relative regardless of any
// ancestor's transform/position tricks, so comparing the rail's own edge
// to each card's edge this way can't drift the same way offsetLeft did.
function updateLogDetailDots(){
  const rail = document.getElementById('logDetailRail');
  const dots = document.querySelectorAll('#logDetailDots .dot');
  const cards = Array.from(rail.children);
  const railLeft = rail.getBoundingClientRect().left;
  // The rightmost card whose left edge has scrolled into (or past) view is
  // the "active" one — works for both the 1-in-view (mobile) and
  // 2-in-view (tablet) cases without needing to special-case either.
  let activeIndex = 0;
  cards.forEach((card, i) => {
    if(card.getBoundingClientRect().left <= railLeft + 4) activeIndex = i;
  });
  dots.forEach((dot, i) => dot.classList.toggle('active', i === activeIndex));
}

document.getElementById('logDetailRail').addEventListener('scroll', () => {
  window.requestAnimationFrame(updateLogDetailDots);
});

document.querySelectorAll('#logDetailDots .dot').forEach(dot => {
  dot.addEventListener('click', () => {
    const rail = document.getElementById('logDetailRail');
    const card = rail.children[parseInt(dot.dataset.index, 10)];
    if(card) rail.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
  });
});
