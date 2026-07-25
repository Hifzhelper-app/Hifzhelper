// ============================================================
// Hifzhelper — shared tajweed tag picker
// Used on all three detail pages (Sabaq / Sabaq Dhor / Dhor). Vocabulary
// starts from TAJWEED_DEFAULTS (shared/data.js) and can be extended with
// custom tags — extensions default to minor (major is meant to stay a
// short, deliberate, predefined list).
// ============================================================

const TAJWEED_CUSTOM_KEY = 'hh_tajweed_custom';
function getTajweedVocabulary(){
  const custom = JSON.parse(localStorage.getItem(TAJWEED_CUSTOM_KEY) || '[]');
  return TAJWEED_DEFAULTS.concat(custom);
}
function addCustomTajweedTag(tagName){
  const custom = JSON.parse(localStorage.getItem(TAJWEED_CUSTOM_KEY) || '[]');
  if(!custom.some(t => t.tag === tagName) && !TAJWEED_DEFAULTS.some(t => t.tag === tagName)){
    custom.push({ tag: tagName, major: false });
    localStorage.setItem(TAJWEED_CUSTOM_KEY, JSON.stringify(custom));
  }
}

// Renders a tag picker into `containerId`. `selected` is a mutable array of
// tag-name strings — the caller reads it back at save time. Re-renders
// itself on every tap, since the "is this tag major" veto needs to be
// visible immediately, not just computed at save time.
function renderTajweedPicker(containerId, selected){
  const vocab = getTajweedVocabulary();
  const el = document.getElementById(containerId);
  el.innerHTML = vocab.map(t => {
    const active = selected.includes(t.tag);
    return `<button type="button" class="tajweed-tag${active?' active':''}${t.major?' major':''}" data-tag="${t.tag}">${t.tag}${t.major?' •':''}</button>`;
  }).join('') + `<button type="button" class="tajweed-tag tajweed-add" id="tajweedAddBtn">+ add</button>`;

  el.querySelectorAll('.tajweed-tag[data-tag]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      const idx = selected.indexOf(tag);
      if(idx >= 0) selected.splice(idx, 1); else selected.push(tag);
      renderTajweedPicker(containerId, selected);
    });
  });
  document.getElementById('tajweedAddBtn').addEventListener('click', () => {
    const name = prompt('New tajweed tag name:');
    if(name && name.trim()){
      addCustomTajweedTag(name.trim());
      selected.push(name.trim());
      renderTajweedPicker(containerId, selected);
    }
  });
}

// Given the selected tag names, does this set include a major tag? Used to
// decide whether the mistakes ring can close, independent of the numeric
// mistake count.
function hasMajorTajweedTag(selectedTags){
  const vocab = getTajweedVocabulary();
  return selectedTags.some(name => {
    const entry = vocab.find(t => t.tag === name);
    return entry && entry.major;
  });
}
