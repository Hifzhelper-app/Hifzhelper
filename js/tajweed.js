// ============================================================
// Hifzhelper -- shared tajweed tag picker
// Used on all detail-view cards (Sabaq / Sabaq Dhor / Dhor). Vocabulary
// starts from TAJWEED_DEFAULTS (shared/data.js) and can be extended with
// custom tags -- extensions default to minor (major is meant to stay a
// short, deliberate, predefined list).
//
// V3.12.0: was an inline row of toggle buttons -- now a compact trigger
// button (shows a short summary of what's selected) that opens a popup
// with a checkbox per tag, since multi-select doesn't fit a scroll-wheel
// or a plain dropdown. Reuses .modal-overlay/.modal-card (components.css)
// for the overlay shell, same as Setup's slide-in grids.
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

// Renders the compact trigger into `containerId`. `selected` is a mutable
// array of tag-name strings -- the caller reads it back at save time,
// same contract as before.
function renderTajweedPicker(containerId, selected){
  const el = document.getElementById(containerId);
  const summary = selected.length ? selected.join(', ') : 'Select tajweed tags';
  el.innerHTML = `<button type="button" class="tajweed-trigger-btn">${summary}</button>`;
  el.querySelector('.tajweed-trigger-btn').addEventListener('click', () => openTajweedPopup(containerId, selected));
}

function openTajweedPopup(containerId, selected){
  const vocab = getTajweedVocabulary();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay tajweed-popup-modal';
  overlay.innerHTML = `<div class="modal-card">
    <button type="button" class="close-btn" id="tajweedPopupCloseBtn">&times;</button>
    <h2>Tajweed</h2>
    <div class="tajweed-checkbox-list" id="tajweedCheckboxList"></div>
    <button type="button" class="tajweed-tag tajweed-add" id="tajweedPopupAddBtn">+ add</button>
  </div>`;
  document.body.appendChild(overlay);

  const listEl = document.getElementById('tajweedCheckboxList');
  function renderList(){
    listEl.innerHTML = vocab.map(t => `<label class="tajweed-checkbox-row">
      <input type="checkbox" class="tajweed-cb" data-tag="${t.tag}"${selected.includes(t.tag) ? ' checked' : ''}>
      ${t.tag}${t.major ? ' &bull;' : ''}
    </label>`).join('');
    listEl.querySelectorAll('.tajweed-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const tag = cb.dataset.tag;
        const idx = selected.indexOf(tag);
        if(cb.checked && idx < 0) selected.push(tag);
        else if(!cb.checked && idx >= 0) selected.splice(idx, 1);
      });
    });
  }
  renderList();

  document.getElementById('tajweedPopupAddBtn').addEventListener('click', () => {
    const name = prompt('New tajweed tag name:');
    if(name && name.trim()){
      addCustomTajweedTag(name.trim());
      selected.push(name.trim());
      vocab.push({ tag: name.trim(), major: false });
      renderList();
    }
  });

  const closeAndRefresh = () => {
    renderTajweedPicker(containerId, selected);
    overlay.remove();
  };
  overlay.addEventListener('click', e => { if(e.target === overlay) closeAndRefresh(); });
  document.getElementById('tajweedPopupCloseBtn').addEventListener('click', closeAndRefresh);
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
