// ============================================================
// Hifzhelper — Journal landing page
// One row per day (Date | Sabaq | Sabaq Dhor | Dhor | Feedback), matching
// the physical paper planner. This is the landing screen — the single
// most important view in the app.
//
// SCOPE NOTE (V3.1): this shows a recent window of days and supports
// quick-add per cell. Full multi-entry-per-day browsing (swipe rails),
// the gamified rings, the timer, and the three-model flexible-unit input
// are NOT in this pass — those are the next pieces of work. A cell with
// more than one entry just shows the most recent + a count badge for now.
// ============================================================

const JOURNAL_WINDOW_DAYS = 14;

let journalData = {}; // date -> { sabaq: [], sabaqDhor: [], dhor: [], reflections: [], plans: [] }

function isoDateNDaysAgo(n){
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0,10);
}

async function loadJournalData(){
  const since = isoDateNDaysAgo(JOURNAL_WINDOW_DAYS);
  const [sabaq, sabaqDhor, dhor, reflections, plans] = await Promise.all([
    apiSabaq.get(since),
    apiSabaqDhor.get(since),
    apiDhor.get(since),
    apiReflections.get(since),
    apiPlans.get({ since })
  ]);

  journalData = {};
  const today = todayISO();
  // Always include today, even with nothing logged yet, so there's
  // always a row to tap into.
  journalData[today] = { sabaq: [], sabaqDhor: [], dhor: [], reflections: [], plans: [] };

  const bucket = (rows, key) => {
    (rows || []).forEach(row => {
      const d = row.date || row.target_date;
      if(!journalData[d]) journalData[d] = { sabaq: [], sabaqDhor: [], dhor: [], reflections: [], plans: [] };
      journalData[d][key].push(row);
    });
  };
  bucket(sabaq, 'sabaq');
  bucket(sabaqDhor, 'sabaqDhor');
  bucket(dhor, 'dhor');
  bucket(reflections, 'reflections');
  bucket(plans, 'plans');
}

function todayISO(){ return new Date().toISOString().slice(0,10); }

function formatDateCell(iso){
  const d = new Date(iso + 'T00:00:00');
  const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
  const rest = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `<span class="weekday">${weekday}</span>${rest}`;
}

// Renders one log-type's cell: filled (most recent + count badge),
// planned (greyed placeholder from a plan, tap to fill in), or empty.
function renderLogCell(date, type, entries, plans){
  if(entries && entries.length){
    const latest = entries[0]; // API already orders most-recent-first
    const summary = summarizeEntry(type, latest);
    const badge = entries.length > 1 ? `<span class="entry-count-badge">+${entries.length - 1}</span>` : '';
    return `<td class="journal-cell-filled" data-date="${date}" data-type="${type}">${summary}${badge}</td>`;
  }
  const plan = (plans || []).find(p => p.plan_type === (type === 'sabaqDhor' ? 'sabaq_dhor' : type));
  if(plan){
    return `<td class="journal-cell-planned" data-date="${date}" data-type="${type}" data-plan-id="${plan.id}">${summarizePlan(type, plan)}</td>`;
  }
  return `<td class="journal-cell-empty" data-date="${date}" data-type="${type}">+ add</td>`;
}

function summarizeEntry(type, e){
  if(type === 'sabaq') return e.surah ? `${surahName(e.surah)} ${e.ayah_from||''}-${e.ayah_to||''}` : '—';
  if(type === 'sabaqDhor') return e.zone || (e.mistakes != null ? `${e.mistakes} mistakes` : '—');
  if(type === 'dhor') return e.segment_from ? `Seg ${e.segment_from}-${e.segment_to}` : '—';
  return '—';
}
function summarizePlan(type, p){
  if(type === 'sabaq') return p.surah ? `${surahName(p.surah)} (planned)` : 'Planned';
  if(type === 'dhor') return p.segment_from ? `Seg ${p.segment_from}-${p.segment_to} (planned)` : 'Planned';
  return 'Planned';
}

function renderJournalTable(){
  const dates = Object.keys(journalData).sort().reverse();
  const tbody = document.getElementById('journalTbody');
  tbody.innerHTML = dates.map(date => {
    const day = journalData[date];
    const feedback = [...day.sabaq, ...day.sabaqDhor, ...day.dhor]
      .map(e => e.teacher_feedback).find(f => f);
    return `<tr>
      <td class="cell-date">${formatDateCell(date)}</td>
      ${renderLogCell(date, 'sabaq', day.sabaq, day.plans)}
      ${renderLogCell(date, 'sabaqDhor', day.sabaqDhor, day.plans)}
      ${renderLogCell(date, 'dhor', day.dhor, day.plans)}
      <td class="cell-feedback">${feedback || ''}</td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('td[data-type]').forEach(td => {
    td.addEventListener('click', () => openQuickAdd(td.dataset.date, td.dataset.type, td.dataset.planId || null));
  });
}

async function renderJournalScreen(){
  const tbody = document.getElementById('journalTbody');
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--color-ink-faint);padding:24px;">Loading…</td></tr>`;
  try{
    await loadJournalData();
    renderJournalTable();
  } catch(e){
    showBanner("Couldn't load your journal: " + e.message);
  }
}

// ---------- quick-add modal ----------
// Deliberately simple for V3.1 — the richer per-type experience (tajweed
// tags, timer, privacy toggles, flexible units) lives on the dedicated
// pages, not built yet. This gets a real entry saved with the essentials.
function openQuickAdd(date, type, planId){
  // V3.9.0: look up the actual plan object (journalData already holds it —
  // the DOM only ever carried its id) so the form can be pre-filled, not
  // just linked at save time.
  const plan = planId ? (journalData[date]?.plans || []).find(p => String(p.id) === String(planId)) : null;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-card">
    <button class="close-btn">&times;</button>
    <h2>${quickAddTitle(type)} — ${date}</h2>
    <div id="quickAddFields"></div>
    <div class="form-error" id="quickAddError"></div>
    <div class="modal-actions">
      <button class="secondary" id="quickAddCancel">Cancel</button>
      <button class="primary" id="quickAddSave">Save</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  document.getElementById('quickAddFields').innerHTML = quickAddFieldsHtml(type, plan);
  if(type === 'sabaq'){
    populateSurahSelectInto('qa_surah');
    if(plan && plan.surah) document.getElementById('qa_surah').value = plan.surah;
  }

  overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
  overlay.querySelector('.close-btn').addEventListener('click', () => overlay.remove());
  document.getElementById('quickAddCancel').addEventListener('click', () => overlay.remove());
  document.getElementById('quickAddSave').addEventListener('click', () => submitQuickAdd(date, type, planId, overlay));
}

function quickAddTitle(type){
  return { sabaq: 'Sabaq', sabaqDhor: 'Sabaq Dhor', dhor: 'Dhor' }[type] || type;
}

function quickAddFieldsHtml(type, plan){
  if(type === 'sabaq'){
    return `<label>Surah</label><select id="qa_surah"></select>
      <label>Ayah from</label><input type="number" id="qa_ayah_from" value="${plan && plan.ayah_from != null ? plan.ayah_from : ''}">
      <label>Ayah to</label><input type="number" id="qa_ayah_to" value="${plan && plan.ayah_to != null ? plan.ayah_to : ''}">`;
  }
  if(type === 'sabaqDhor'){
    // Not pre-filled: a sabaq_dhor PLAN stores surah/ayah_from/ayah_to
    // (SCHEMA.md), but the log itself takes a computed `zone` string —
    // that computation isn't wired into the frontend yet (same gap noted
    // in sabaqDhorPage.js), so there's no clean value to put here without
    // guessing. Left manual rather than fabricated.
    return `<label>Zone</label><input type="text" id="qa_zone" placeholder="e.g. Juz' 29, 30">
      <label>Mistakes</label><input type="number" id="qa_mistakes" value="0">`;
  }
  if(type === 'dhor'){
    return `<label>Segment from</label><input type="number" id="qa_seg_from" value="${plan && plan.segment_from != null ? plan.segment_from : ''}">
      <label>Segment to</label><input type="number" id="qa_seg_to" value="${plan && plan.segment_to != null ? plan.segment_to : ''}">
      <label>Reference</label>
      <select id="qa_ref"><option value="waterval"${plan && plan.ref === 'waterval' ? ' selected' : ''}>13-line (IndoPak)</option><option value="uthmani"${plan && plan.ref === 'uthmani' ? ' selected' : ''}>Uthmani</option></select>
      <label>Mistakes</label><input type="number" id="qa_mistakes" value="0">
      <label>Duration (minutes)</label><input type="number" id="qa_duration" step="0.5">`;
  }
  return '';
}

async function submitQuickAdd(date, type, planId, overlay){
  const errEl = document.getElementById('quickAddError');
  errEl.textContent = '';
  let payload = { date };
  let client;

  if(type === 'sabaq'){
    payload.surah = parseInt(document.getElementById('qa_surah').value) || null;
    payload.ayah_from = parseInt(document.getElementById('qa_ayah_from').value) || null;
    payload.ayah_to = parseInt(document.getElementById('qa_ayah_to').value) || null;
    client = apiSabaq;
  } else if(type === 'sabaqDhor'){
    payload.zone = document.getElementById('qa_zone').value || null;
    payload.mistakes = parseInt(document.getElementById('qa_mistakes').value) || 0;
    client = apiSabaqDhor;
  } else if(type === 'dhor'){
    payload.segment_from = parseInt(document.getElementById('qa_seg_from').value) || null;
    payload.segment_to = parseInt(document.getElementById('qa_seg_to').value) || null;
    payload.ref = document.getElementById('qa_ref').value;
    payload.mistakes = parseInt(document.getElementById('qa_mistakes').value) || 0;
    const mins = parseFloat(document.getElementById('qa_duration').value);
    payload.duration_seconds = mins ? Math.round(mins * 60) : null;
    client = apiDhor;
  }
  if(planId) payload.plan_id = parseInt(planId);

  try{
    await client.save(payload);
    overlay.remove();
    await renderJournalScreen();
  } catch(e){
    errEl.textContent = "Couldn't save: " + e.message;
  }
}

function populateSurahSelectInto(selectId){
  const sel = document.getElementById(selectId);
  sel.innerHTML = SURAHS.map(([n, name]) => `<option value="${n}">${n}. ${name}</option>`).join('');
}
