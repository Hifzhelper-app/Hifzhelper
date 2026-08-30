// ============================================================
// Hifzhelper -- shared tajweed tag picker
// Used on all detail-view cards (Sabaq / Sabaq Dhor / Dhor), PJ and maktab.
//
// V3.78.0 (delivery 3, item 7): the vocabulary is MAKTAB-STORED now — rows
// in tajweed_tags with IDs, managed by the admin on Maktab Settings.
// Entries hold CSVs of IDs (tajweed_tag_ids), so renaming a tag propagates
// to every entry that ever used it, and RETIRE replaces delete: a retired
// tag stops being offered for new entries but keeps its name on old ones.
// The device-local custom-tag store (hh_tajweed_custom) is GONE — the
// user's call 2026-08-27: custom browser tags are not imported, they go.
// The "+ add" in the picker went with it: additions are admin work now.
//
// The picker's contract with the cards is unchanged in shape: `selected`
// is a mutable array the caller reads back at save time — but it holds
// tag-ID STRINGS now, not names. The cards send them as tajweed_tag_ids.
// ============================================================

// The vocabulary, loaded once per session at boot (js/app.js) for every
// role — students' PJ cards carry the same picker. [] until loaded; the
// picker renders names it can resolve and plain ids it cannot (which only
// happens if the fetch failed).
let TAJWEED_VOCAB = [];
async function loadTajweedVocabulary(){
  try{
    TAJWEED_VOCAB = await apiGetTajweedTags();
  } catch(e){
    TAJWEED_VOCAB = [];   // the picker degrades; a retry happens next boot
  }
}
function tajweedTagById(id){
  return TAJWEED_VOCAB.find(t => String(t.id) === String(id)) || null;
}
function tajweedNamesFor(selectedIds){
  return selectedIds.map(id => { const t = tajweedTagById(id); return t ? t.name : String(id); });
}

// Renders the compact trigger into `containerId`. `selected` is a mutable
// array of tag-ID strings -- the caller reads it back at save time.
function renderTajweedPicker(containerId, selected){
  const el = document.getElementById(containerId);
  const summary = selected.length ? tajweedNamesFor(selected).join(', ') : 'Select tags';   // V3.94.0 (user): the label above already says Tajweed
  el.innerHTML = `<button type="button" class="tajweed-trigger-btn"></button>`;
  const btn = el.querySelector('.tajweed-trigger-btn');
  btn.textContent = summary;   // names are admin-entered text — never innerHTML
  btn.addEventListener('click', () => openTajweedPopup(containerId, selected));
}

function openTajweedPopup(containerId, selected){
  // Offered: every live tag, PLUS any retired tag this entry already has —
  // so an old entry keeps showing (and can keep or drop) what it recorded,
  // while a retired tag never appears on an entry that lacks it.
  const vocab = TAJWEED_VOCAB.filter(t => !t.retired || selected.includes(String(t.id)));
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay tajweed-popup-modal';
  overlay.innerHTML = `<div class="modal-card">
    <button type="button" class="close-btn" id="tajweedPopupCloseBtn">&times;</button>
    <h2>Tajweed</h2>
    <div class="tajweed-checkbox-list" id="tajweedCheckboxList"></div>
  </div>`;
  document.body.appendChild(overlay);

  const listEl = document.getElementById('tajweedCheckboxList');
  listEl.innerHTML = vocab.map(t => `<label class="tajweed-checkbox-row">
    <input type="checkbox" class="tajweed-cb" data-tag-id="${t.id}"${selected.includes(String(t.id)) ? ' checked' : ''}>
    <span class="tajweed-cb-name"></span>${t.major ? ' &bull;' : ''}${t.retired ? ' <span class="tajweed-retired-note">(retired)</span>' : ''}
  </label>`).join('');
  listEl.querySelectorAll('.tajweed-checkbox-row').forEach((row, i) => {
    row.querySelector('.tajweed-cb-name').textContent = vocab[i].name;
  });
  listEl.querySelectorAll('.tajweed-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.tagId;
      const idx = selected.indexOf(id);
      if(cb.checked && idx < 0) selected.push(id);
      else if(!cb.checked && idx >= 0) selected.splice(idx, 1);
    });
  });

  const closeAndRefresh = () => {
    renderTajweedPicker(containerId, selected);
    overlay.remove();
  };
  overlay.addEventListener('click', e => { if(e.target === overlay) closeAndRefresh(); });
  document.getElementById('tajweedPopupCloseBtn').addEventListener('click', closeAndRefresh);
}

// Given the selected tag IDs, does this set include a major tag? Used to
// decide whether the mistakes ring can close, independent of the numeric
// mistake count.
function hasMajorTajweedTag(selectedIds){
  return selectedIds.some(id => { const t = tajweedTagById(id); return t && t.major; });
}
