/* Hifzhelper build 4.2.5 | js/uiSwitch.js */
// ============================================================
// Hifzhelper — generic switch/segmented-control component (V3.10.0)
// Originally local to settingsScreen.js; extracted here (V3.12.0) so
// commentPrivacy.js's private/public switch and other non-Setup screens
// can use the same component without duplicating it — loads early
// (right after icons.js) so every later script can rely on it.
//
// A switch-track's children are the thumb plus one "slot" per option, in
// DOM order — for a neutral-center switch one of those slots is a plain
// .switch-neutral-zone div rather than a real option, so the thumb has
// somewhere to rest when nothing's chosen. Positioning is just "which
// slot index is active" as a percentage of the track width; nothing here
// needs to special-case 2-way vs 3-way vs neutral-center.
// ============================================================

function renderSwitch(trackId, activeValue){
  const track = document.getElementById(trackId);
  const slots = Array.from(track.children).filter(el => !el.classList.contains('switch-thumb'));
  const thumb = track.querySelector('.switch-thumb');
  const totalSlots = slots.length;
  let activeIndex = slots.findIndex(el => el.dataset && el.dataset.value === activeValue);
  const isNeutral = activeIndex === -1;
  if(isNeutral){
    activeIndex = Math.floor((totalSlots - 1) / 2);
    thumb.classList.add('neutral');
  } else {
    thumb.classList.remove('neutral');
  }
  const pct = 100 / totalSlots;
  thumb.style.left = `calc(${pct * activeIndex}% + 2px)`;
  thumb.style.width = `calc(${pct}% - 4px)`;
  slots.forEach(el => { if(el.classList.contains('switch-option')) el.classList.toggle('active', el.dataset.value === activeValue); });
}
function wireSwitch(trackId, onSelect){
  document.querySelectorAll(`#${trackId} .switch-option`).forEach(btn => {
    btn.addEventListener('click', () => onSelect(btn.dataset.value));
  });
}
