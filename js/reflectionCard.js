// ============================================================
// Hifzhelper -- Tadabbur/reflection card (4th card in the unified day-log
// view, V3.6.1). The `reflections` table and apiReflections client
// already existed (SCHEMA.md, api.js), just had no UI until V3.6.1.
//
// Deliberately different from the other 3 cards: reflections are meant to
// be ONE per day (unlike Sabaq/Sabaq Dhor/Dhor, which allow multiple
// entries per day by design). So this card loads today's existing
// reflection if one exists and UPDATES it in place on save, rather than
// always creating a new row. No date selector on this card (per spec) --
// always today.
//
// V3.14.2: reverted from V3.12.0's Public/Private switch back to a plain
// checkbox, same as the other 3 cards' Notes block.
// ============================================================

let tadabburCurrentId = null;

async function renderTadabburScreen(){
  tadabburCurrentId = null;
  const textarea = document.getElementById('tadabbur_text');
  textarea.value = '';
  document.getElementById('tadabbur_private').checked = false;
  document.getElementById('tadabburError').textContent = '';
  try{
    const rows = await apiReflections.getForDate(todayISO());
    if(rows && rows.length){
      const existing = rows[0];
      tadabburCurrentId = existing.id;
      textarea.value = existing.reflection || '';
      document.getElementById('tadabbur_private').checked = !!existing.is_private;
    }
  } catch(e){
    // Non-fatal -- leave the form blank rather than blocking the whole card
    // over a failed prefill fetch; saving still works either way.
  }
}

document.getElementById('tadabburSaveBtn').addEventListener('click', async () => {
  const errEl = document.getElementById('tadabburError');
  errEl.textContent = '';
  const fields = {
    reflection: document.getElementById('tadabbur_text').value || null,
    is_private: document.getElementById('tadabbur_private').checked
  };
  try{
    if(tadabburCurrentId){
      await apiReflections.update(tadabburCurrentId, fields);
    } else {
      const result = await apiReflections.save(Object.assign({ date: todayISO() }, fields));
      if(result && result.data && result.data.id) tadabburCurrentId = result.data.id;
    }
    document.getElementById('tadabburSaveStatus').classList.add('show');
    setTimeout(() => document.getElementById('tadabburSaveStatus').classList.remove('show'), 1800);
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
});
