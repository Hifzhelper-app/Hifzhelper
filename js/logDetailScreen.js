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

function updateLogDetailDots(){
  const rail = document.getElementById('logDetailRail');
  const dots = document.querySelectorAll('#logDetailDots .dot');
  const cards = Array.from(rail.children);
  // The rightmost card whose left edge has scrolled into (or past) view is
  // the "active" one — works for both the 1-in-view (mobile) and
  // 2-in-view (tablet) cases without needing to special-case either.
  let activeIndex = 0;
  cards.forEach((card, i) => {
    if(card.offsetLeft <= rail.scrollLeft + 4) activeIndex = i;
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
