// ============================================================
// Hifzhelper — unified day-log view orchestrator (V3.6.1)
// Replaces the old 3 separate Sabaq/Sabaq Dhor/Dhor screens with one
// screen holding all 4 cards (Sabaq/Sabaq Dhor/Dhor/Tadabbur). Renders all
// 4 on entry, scrolls the rail so whichever journal column header was
// clicked opens on that card, and keeps the dot indicators in sync with
// scroll position on the tablet/mobile rail (desktop is a static 1x4
// grid — no scrolling, dots hidden via CSS).
// ============================================================

const LOG_DETAIL_CARD_ORDER = ['sabaq', 'sabaqDhor', 'dhor', 'tadabbur'];

// V3.12.0: header icons (display only, no click action) + save-button
// icons for all 4 cards, injected once here rather than per-render since
// they never change.
document.getElementById('sabaqHeaderIcon').innerHTML = iconHtml('sabaq');
document.getElementById('sabaqDhorHeaderIcon').innerHTML = iconHtml('sabaqDhor');
document.getElementById('dhorHeaderIcon').innerHTML = iconHtml('dhor');
document.getElementById('tadabburHeaderIcon').innerHTML = iconHtml('reflections');
document.getElementById('sabaqSaveIcon').innerHTML = iconHtml('save');
document.getElementById('sabaqDhorSaveIcon').innerHTML = iconHtml('save');
document.getElementById('dhorSaveIcon').innerHTML = iconHtml('save');
document.getElementById('tadabburSaveIcon').innerHTML = iconHtml('save');

// V3.19.0: xclose exits back to Journal -- the landing page this screen
// is always reached from (via a journal-table cell click). There's no
// navigation history stack anywhere in the app (showScreen is a direct
// switch, not a push/pop), so "back" has no more general meaning here
// than that fixed target.
document.getElementById('logDetailClose').innerHTML = iconHtml('close');
document.getElementById('logDetailClose').addEventListener('click', () => showScreen('journal'));

async function renderLogDetailScreen(initialCard){
  await Promise.all([
    renderSabaqScreen(),
    renderSabaqDhorScreen(),
    renderDhorScreen(),
    renderTadabburScreen()
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
