// ============================================================
// Hifzhelper — Phase 1 student journal
// Storage: entries/position/lastDhor/attendance now live server-side
// (Cloudflare D1, via api.js) — this used to be localStorage-only; that
// gap is closed as of this revision. localStorage is still used for a few
// genuinely local, non-synced things: the login token, which rub' reference
// this device displays, and custom tajweed tags someone's added.
// Quran structural data (surahs, juz'/rub' boundaries) lives in data.js —
// see CONVENTIONS.md principle 2. This file only holds app state/logic.
// ============================================================

const LS_TAJWEED_CUSTOM = 'hh_tajweed_custom';

// Which reference (waterval/uthmani) this app instance is using — an app-state
// preference (depends on localStorage), not Quran structural data, so it stays
// here rather than in data.js.
const RUB_REFERENCE_KEY = 'hh_rub_reference';
function getRubReference(){ return lsGet(RUB_REFERENCE_KEY, 'waterval'); }
function setRubReference(ref){ lsSet(RUB_REFERENCE_KEY, ref); }

function todayISO(){ return new Date().toISOString().slice(0,10); }
function formatDateNice(iso){
  const d = new Date(iso+'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday:'short', year:'numeric', month:'short', day:'numeric' });
}

// ---------- local storage helpers (token, rub' preference, custom tags only) ----------
function lsGet(key, fallback){
  try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(e){ return fallback; }
}
function lsSet(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }
  catch(e){ console.error('storage failed', key, e); }
}

let entries = [];
let position = { activeJuz: 30, studyOrder: [], juz: {} };
let lastDhor = {};
let attendance = {}; // { date: 'present'|'absent'|'haidh'|'predicted-haidh' }, for the currently-viewed month
let customTags = lsGet(LS_TAJWEED_CUSTOM, []);
let selected = { sabaq: [], sabaqDhor: [], dhor: [] };
let currentEntryNumber = 1; // which of today's entries (1 or 2) is loaded in the form

// Persists position + lastDhor together — call this after any mutation to
// either, rather than assuming a save elsewhere will cover it.
async function persistPosition(){
  try{
    await apiSavePosition(JSON.stringify(position), JSON.stringify(lastDhor));
  }catch(e){
    console.error('Could not save position', e);
    showBanner("Couldn't save your progress — check your connection and try again.");
  }
}

// A small, visible way to surface errors (CONVENTIONS.md principle 3 — no
// silent fallbacks). Not fancy, just not invisible.
function showBanner(message){
  let el = document.getElementById('errorBanner');
  if(!el){
    el = document.createElement('div');
    el.id = 'errorBanner';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#7d3232;color:#fff;padding:10px 14px;font-family:monospace;font-size:12px;text-align:center;z-index:100;';
    document.body.prepend(el);
  }
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ---------- progress model ----------
function getJuzEntry(juz){
  if(!position.juz[juz]) position.juz[juz] = SURAH_TRACKED_JUZ[juz] ? { surahReached: null } : { quarter: 0 };
  return position.juz[juz];
}
function getJuzFillFraction(juz){
  const j = position.juz[juz];
  if(!j) return 0;
  if(SURAH_TRACKED_JUZ[juz]){
    if(j.surahReached == null) return 0;
    if(juz === 30){
      const total = 114-78+1;
      const done = 114 - j.surahReached + 1;
      return Math.max(0, Math.min(1, done/total));
    } else { // juz 29, ascending from 67
      const total = 77-67+1;
      const done = j.surahReached - 67 + 1;
      return Math.max(0, Math.min(1, done/total));
    }
  }
  return (j.quarter||0)/4;
}
function isJuzComplete(juz){ return getJuzFillFraction(juz) >= 1; }

function touchJuz(juz){
  if(!position.studyOrder.includes(juz)) position.studyOrder.push(juz);
  position.activeJuz = juz;
}

// ---------- zones (sabaq dhor / dhor), based on actual study order ----------
function computeZones(){
  const seq = position.studyOrder || [];
  if(seq.length === 0) return { sabaqDhorJuz: [], dhorJuz: [] };
  const activeIdx = seq.indexOf(position.activeJuz);
  const upTo = activeIdx >= 0 ? activeIdx+1 : seq.length;
  const half = Math.ceil(upTo/2);
  if(upTo <= half){
    return { sabaqDhorJuz: seq.slice(0, upTo), dhorJuz: [] };
  }
  return { sabaqDhorJuz: seq.slice(half, upTo), dhorJuz: seq.slice(0, half) };
}
function juzListLabel(list){
  if(!list.length) return '—';
  return list.map(j => `Juz' ${j}`).join(', ');
}
function juzListToSegments(list, ref){
  const segmentsPerJuz = RUB_BOUNDARIES[ref].length / 30;
  const units = [];
  list.forEach(j => {
    for(let k=1;k<=segmentsPerJuz;k++) units.push((j-1)*segmentsPerJuz + k);
  });
  return units;
}
function segmentLabel(u, ref){
  const segmentsPerJuz = RUB_BOUNDARIES[ref].length / 30;
  const juz = Math.ceil(u/segmentsPerJuz);
  const pos = ((u-1) % segmentsPerJuz) + 1;
  return ref === 'waterval' ? `Juz' ${juz} — Quarter ${pos} of 4` : `Juz' ${juz} — 1/8 marker ${pos} of 8`;
}

// ---------- recency color ----------
function daysSince(dateISO){
  if(!dateISO) return null;
  const then = new Date(dateISO+'T00:00:00');
  const now = new Date(todayISO()+'T00:00:00');
  return Math.round((now-then)/86400000);
}
function lerp(a,b,t){ return a+(b-a)*t; }
function recencyColor(days){
  const SAGE=[86,113,79], BRASS=[168,120,58], BURG=[125,50,50];
  if(days===null) return 'rgb('+BURG.join(',')+')';
  const t = Math.max(0, Math.min(1, days/30));
  let c;
  if(t<=0.5){ const t2=t/0.5; c=SAGE.map((v,i)=>Math.round(lerp(v,BRASS[i],t2))); }
  else{ const t2=(t-0.5)/0.5; c=BRASS.map((v,i)=>Math.round(lerp(v,BURG[i],t2))); }
  return 'rgb('+c.join(',')+')';
}

// ============================================================
// RENDER: journal view
// ============================================================
function populateSurahSelect(){
  const sel = document.getElementById('s_surah');
  sel.innerHTML = SURAHS.map(([n,name]) => `<option value="${n}">${n}. ${name}</option>`).join('');
  // sensible default based on where the student is
  const j = position.activeJuz;
  let def = juzStartSurah(j);
  if(j === 30) def = 114;
  if(j === 29) def = 67;
  sel.value = def;
}

function renderTajweedTags(containerId, key){
  const wrap = document.getElementById(containerId);
  wrap.innerHTML = '';
  const all = [...TAJWEED_DEFAULTS, ...customTags];
  all.forEach(tag => {
    const el = document.createElement('div');
    el.className = 'tag' + (selected[key].includes(tag) ? ' active' : '');
    el.textContent = tag;
    el.tabIndex = 0;
    el.setAttribute('role','button');
    el.addEventListener('click', () => {
      if(selected[key].includes(tag)) selected[key] = selected[key].filter(t=>t!==tag);
      else selected[key].push(tag);
      renderTajweedTags(containerId, key);
    });
    wrap.appendChild(el);
  });
}

function renderJuzStripInto(containerId, { showLabelState } = {}){
  const strip = document.getElementById(containerId);
  strip.innerHTML = '';
  for(let i=1;i<=30;i++){
    const dot = document.createElement('div');
    const frac = getJuzFillFraction(i);
    dot.className = 'juz-dot' + (frac>=1 ? ' filled' : '') + (i===position.activeJuz ? ' current' : '');
    if(frac>0 && frac<1){
      dot.style.background = `linear-gradient(to right, var(--brass) ${frac*100}%, var(--bg-alt) ${frac*100}%)`;
      dot.style.borderColor = 'var(--brass)';
    }
    dot.textContent = i;
    dot.tabIndex = 0;
    dot.setAttribute('role','button');
    dot.setAttribute('aria-label', `Juz ${i} — ${Math.round(frac*100)}% memorized`);
    dot.addEventListener('click', () => setJuzManual(i));
    dot.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setJuzManual(i);} });
    strip.appendChild(dot);
  }
}
function renderJuzStrip(){ renderJuzStripInto('juzStrip'); }

async function setJuzManual(juz){
  const frac = getJuzFillFraction(juz);
  const j = getJuzEntry(juz);
  if(frac >= 1){
    if(SURAH_TRACKED_JUZ[juz]) j.surahReached = null; else j.quarter = 0;
  } else {
    if(SURAH_TRACKED_JUZ[juz]) j.surahReached = (juz===30 ? 78 : 77);
    else j.quarter = 4;
    touchJuz(juz);
  }
  renderAll();
  await persistPosition();
}

function renderRevisionMap(){
  const wrap = document.getElementById('revisionMap');
  wrap.innerHTML = '';
  const ref = getRubReference();
  const segmentsPerJuz = RUB_BOUNDARIES[ref].length / 30;
  const total = segmentsPerJuz * 30;
  for(let u=1; u<=total; u++){
    const juz = Math.ceil(u/segmentsPerJuz);
    const posInJuz = ((u-1) % segmentsPerJuz) + 1;
    const dot = document.createElement('div');
    dot.className = 'juz-dot';
    dot.style.fontSize = segmentsPerJuz > 4 ? '6.5px' : '7.5px';
    dot.textContent = juz;
    const frac = getJuzFillFraction(juz);
    const reached = frac >= (posInJuz / segmentsPerJuz);
    if(!reached){
      dot.title = segmentLabel(u, ref)+': not yet memorized';
    } else {
      const days = daysSince(lastDhor[u]);
      dot.style.background = recencyColor(days);
      dot.style.borderColor = 'transparent';
      dot.style.color = '#fff9ec';
      dot.title = segmentLabel(u, ref) + (days===null ? ': not yet given dhor' : `: last dhor ${days} day${days===1?'':'s'} ago`);
    }
    wrap.appendChild(dot);
  }
}

function updateRubDisplay(){
  const surahNumber = parseInt(document.getElementById('s_surah').value)||1;
  const ayah = document.getElementById('s_to').value || document.getElementById('s_from').value || 1;
  const juz = getJuzForPosition(surahNumber, ayah);
  const disp = document.getElementById('s_rub_display');
  if(SURAH_TRACKED_JUZ[juz]){
    disp.textContent = `Juz' ${juz} — tracked by surah`;
  } else {
    const ref = getRubReference();
    const info = getRubInfo(surahNumber, ayah, ref);
    if(ref === 'waterval'){
      // auto-fill the 4-option quarter select from real boundary data — still editable to correct
      document.getElementById('s_quarter').value = String(info.posInJuz);
      disp.textContent = `Juz' ${juz} • Quarter ${info.posInJuz} of 4 (Waterval)`;
    } else {
      disp.textContent = `Juz' ${juz} • 1/8 marker ${info.posInJuz} of 8 (Uthmani)`;
    }
  }
}

function updateZoneDisplays(){
  const zones = computeZones();
  document.getElementById('sd_zone').textContent = zones.sabaqDhorJuz.length ? juzListLabel(zones.sabaqDhorJuz) : 'Log a sabaq to begin';
  const dZone = document.getElementById('d_zone');
  const dFrom = document.getElementById('d_from');
  const dTo = document.getElementById('d_to');
  const ref = getRubReference();
  if(zones.dhorJuz.length){
    dZone.textContent = `Old-revision zone: ${juzListLabel(zones.dhorJuz)} (${ref === 'waterval' ? 'quarters' : "1/8's"})`;
    const units = juzListToSegments(zones.dhorJuz, ref);
    const options = units.map(u => `<option value="${u}">${segmentLabel(u, ref)}</option>`).join('');
    dFrom.innerHTML = options; dTo.innerHTML = options;
    dFrom.disabled = false; dTo.disabled = false;
    // default to the least-recently revised segment (spaced repetition nudge)
    let oldest = units[0], oldestDays = -1;
    units.forEach(u => { const d = daysSince(lastDhor[u]); const val = d===null ? 99999 : d; if(val>oldestDays){ oldestDays=val; oldest=u; } });
    dFrom.value = oldest; dTo.value = oldest;
  } else {
    dZone.textContent = "Nothing in dhor rotation yet — complete more than one juz' to begin";
    dFrom.innerHTML = ''; dTo.innerHTML = '';
    dFrom.disabled = true; dTo.disabled = true;
  }
}

function defaultAyahFrom(){
  const surahNumber = parseInt(document.getElementById('s_surah').value)||1;
  const last = entries.find(e => e.sabaq && e.sabaq.surahNumber === surahNumber);
  if(last && last.sabaq.ayahTo){
    return parseInt(last.sabaq.ayahTo)+1;
  }
  return '';
}

function fillFormFromEntry(entry){
  document.getElementById('s_surah').value = entry.sabaq.surahNumber || '';
  document.getElementById('s_from').value = entry.sabaq.ayahFrom || '';
  document.getElementById('s_to').value = entry.sabaq.ayahTo || '';
  document.getElementById('s_lines').value = entry.sabaq.lines || '';
  document.getElementById('s_quarter').value = entry.sabaq.quarter || '4';
  selected.sabaq = [...(entry.sabaq.tajweed||[])];
  selected.sabaqDhor = [...(entry.sabaqDhor.tajweed||[])];
  selected.dhor = [...(entry.dhor.tajweed||[])];
  renderTajweedTags('s_tajweed','sabaq');
  renderTajweedTags('sd_tajweed','sabaqDhor');
  renderTajweedTags('d_tajweed','dhor');
  document.getElementById('sd_mistakes').value = entry.sabaqDhor.mistakes || '';
  document.getElementById('d_mistakes').value = entry.dhor.mistakes || '';
  document.getElementById('d_time').value = entry.dhor.minutes || '';
  if(entry.dhor.from){ document.getElementById('d_from').value = entry.dhor.from; }
  if(entry.dhor.to){ document.getElementById('d_to').value = entry.dhor.to; }
  const fb = document.getElementById('teacherFeedbackBox');
  fb.textContent = (entry.teacherFeedback && entry.teacherFeedback.trim()) ? entry.teacherFeedback : "Your teacher's feedback will appear here after review.";
  document.getElementById('reflection').value = entry.reflection || '';
  document.getElementById('studentComment').value = entry.studentComment || '';
  updateRubDisplay();
}

function clearFormDefaults(){
  document.getElementById('s_from').value = defaultAyahFrom();
  document.getElementById('s_to').value = '';
  document.getElementById('s_lines').value = '';
  document.getElementById('s_quarter').value = '4';
  document.getElementById('sd_mistakes').value = '';
  document.getElementById('d_mistakes').value = '';
  document.getElementById('d_time').value = '';
  selected.sabaq = []; selected.sabaqDhor = []; selected.dhor = [];
  renderTajweedTags('s_tajweed','sabaq');
  renderTajweedTags('sd_tajweed','sabaqDhor');
  renderTajweedTags('d_tajweed','dhor');
  document.getElementById('teacherFeedbackBox').textContent = "Your teacher's feedback will appear here after review.";
  document.getElementById('reflection').value = '';
  document.getElementById('studentComment').value = '';
  updateRubDisplay();
}

// ---------- up-to-two-entries-per-day controls ----------
function todaysEntries(){
  const today = todayISO();
  return entries.filter(e => e.date === today);
}
function loadEntryNumber(num){
  currentEntryNumber = num;
  const todays = todaysEntries();
  const match = todays.find(e => (e.entryNumber||1) === num);
  if(match) fillFormFromEntry(match);
  else clearFormDefaults();
  updateEntryControls();
}
function updateEntryControls(){
  const todays = todaysEntries();
  const hasEntry1 = todays.some(e => (e.entryNumber||1) === 1);
  const hasEntry2 = todays.some(e => (e.entryNumber||1) === 2);
  const addBtn = document.getElementById('addSecondEntryBtn');
  const switcher = document.getElementById('entrySwitcher');

  if(hasEntry1 && hasEntry2){
    // both exist — show the switcher, hide the add button (cap of two reached)
    addBtn.style.display = 'none';
    switcher.style.display = 'flex';
    document.getElementById('entryTab1').classList.toggle('active', currentEntryNumber===1);
    document.getElementById('entryTab2').classList.toggle('active', currentEntryNumber===2);
  } else if(hasEntry1){
    // only the first exists — offer to add a second
    addBtn.style.display = 'block';
    switcher.style.display = 'none';
  } else {
    // nothing logged today yet
    addBtn.style.display = 'none';
    switcher.style.display = 'none';
  }
}
document.getElementById('addSecondEntryBtn').addEventListener('click', () => {
  loadEntryNumber(2);
});
document.getElementById('entryTab1').addEventListener('click', () => loadEntryNumber(1));
document.getElementById('entryTab2').addEventListener('click', () => loadEntryNumber(2));

// ---------- save ----------
// ---------- API <-> local entry shape ----------
// The app's internal entry objects are nested (entry.sabaq.X, entry.dhor.X)
// because so much of the rendering code depends on that shape. The API's
// schema (SCHEMA.md) is flat, matching the D1 columns. These two functions
// are the only place that translation happens — never build a flat payload
// or parse a flat row anywhere else.
function entryToApiPayload(entry){
  return {
    date: entry.date,
    entry_number: entry.entryNumber || 1,
    sabaq_surah: entry.sabaq.surahNumber || null,
    sabaq_ayah_from: entry.sabaq.ayahFrom || null,
    sabaq_ayah_to: entry.sabaq.ayahTo || null,
    sabaq_lines: entry.sabaq.lines || null,
    sabaq_quarter: entry.sabaq.quarter || null,
    sabaq_tajweed: (entry.sabaq.tajweed||[]).join(','),
    sabaqdhor_zone: entry.sabaqDhor.zoneJuz && entry.sabaqDhor.zoneJuz.length ? juzListLabel(entry.sabaqDhor.zoneJuz) : '',
    sabaqdhor_tajweed: (entry.sabaqDhor.tajweed||[]).join(','),
    sabaqdhor_mistakes: entry.sabaqDhor.mistakes || null,
    dhor_from: entry.dhor.from || null,
    dhor_to: entry.dhor.to || null,
    dhor_ref: entry.dhor.ref || null,
    dhor_tajweed: (entry.dhor.tajweed||[]).join(','),
    dhor_mistakes: entry.dhor.mistakes || null,
    dhor_minutes: entry.dhor.minutes || null,
    reflection: entry.reflection || '',
    student_comment: entry.studentComment || ''
  };
}
function apiRowToEntry(row){
  return {
    date: row.date,
    entryNumber: row.entry_number || 1,
    sabaq: {
      surahNumber: row.sabaq_surah, surah: row.sabaq_surah ? surahName(row.sabaq_surah) : '',
      ayahFrom: row.sabaq_ayah_from, ayahTo: row.sabaq_ayah_to,
      lines: row.sabaq_lines, quarter: row.sabaq_quarter,
      tajweed: row.sabaq_tajweed ? row.sabaq_tajweed.split(',').filter(Boolean) : []
    },
    sabaqDhor: {
      zoneJuz: null, zoneLabel: row.sabaqdhor_zone || '',
      tajweed: row.sabaqdhor_tajweed ? row.sabaqdhor_tajweed.split(',').filter(Boolean) : [],
      mistakes: row.sabaqdhor_mistakes
    },
    dhor: {
      from: row.dhor_from, to: row.dhor_to, ref: row.dhor_ref,
      tajweed: row.dhor_tajweed ? row.dhor_tajweed.split(',').filter(Boolean) : [],
      mistakes: row.dhor_mistakes, minutes: row.dhor_minutes
    },
    reflection: row.reflection || '',
    studentComment: row.student_comment || '',
    teacherFeedback: row.teacher_feedback || ''
  };
}

document.getElementById('saveBtn').addEventListener('click', async () => {
  const date = todayISO();
  const existing = entries.find(e => e.date === date && (e.entryNumber||1) === currentEntryNumber);
  const surahSelect = document.getElementById('s_surah');
  const surahNumber = parseInt(surahSelect.value)||1;
  const quarterVal = parseInt(document.getElementById('s_quarter').value)||1;
  const ayahTo = document.getElementById('s_to').value;
  const ayahFrom = document.getElementById('s_from').value;
  const reachedAyah = ayahTo || ayahFrom;

  const zones = computeZones();
  const dFromVal = document.getElementById('d_from').value;
  const dToVal = document.getElementById('d_to').value;

  const entry = {
    date,
    entryNumber: currentEntryNumber,
    sabaq: {
      surahNumber, surah: surahName(surahNumber),
      ayahFrom, ayahTo,
      lines: document.getElementById('s_lines').value,
      quarter: document.getElementById('s_quarter').value,
      tajweed: [...selected.sabaq]
    },
    sabaqDhor: {
      zoneJuz: [...zones.sabaqDhorJuz],
      tajweed: [...selected.sabaqDhor],
      mistakes: document.getElementById('sd_mistakes').value
    },
    dhor: {
      from: dFromVal, to: dToVal, ref: getRubReference(),
      tajweed: [...selected.dhor],
      mistakes: document.getElementById('d_mistakes').value,
      minutes: document.getElementById('d_time').value
    },
    reflection: document.getElementById('reflection').value,
    studentComment: document.getElementById('studentComment').value,
    teacherFeedback: existing ? (existing.teacherFeedback||'') : ''
  };

  // update progress model
  if(reachedAyah){
    const computedJuz = getJuzForPosition(surahNumber, reachedAyah);
    touchJuz(computedJuz);
    const j = getJuzEntry(computedJuz);
    if(SURAH_TRACKED_JUZ[computedJuz]){
      if(computedJuz===30) j.surahReached = (j.surahReached==null) ? surahNumber : Math.min(j.surahReached, surahNumber);
      else j.surahReached = (j.surahReached==null) ? surahNumber : Math.max(j.surahReached, surahNumber);
    } else {
      j.quarter = Math.max(j.quarter||0, quarterVal);
    }
  }

  // update dhor recency
  if(dFromVal && dToVal){
    const a = Math.min(parseInt(dFromVal), parseInt(dToVal));
    const b = Math.max(parseInt(dFromVal), parseInt(dToVal));
    for(let u=a; u<=b; u++) lastDhor[u] = date;
  }

  // attendance: sabaq always wins — the Worker marks present unconditionally
  // on any saved entry, including overriding haidh. Mirror that locally so
  // the ledger chip reflects it without waiting on a re-fetch.
  attendance[date] = 'present';

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  try{
    await apiSaveEntry(entryToApiPayload(entry));
    await persistPosition();

    if(existing) Object.assign(existing, entry); else entries.unshift(entry);
    entries.sort((a,b) => b.date.localeCompare(a.date) || (a.entryNumber||1) - (b.entryNumber||1));
    lsSet(LS_TAJWEED_CUSTOM, customTags);

    renderAll();
    updateEntryControls();
    const status = document.getElementById('saveStatus');
    status.classList.add('show');
    setTimeout(()=>status.classList.remove('show'), 1800);
  } catch(e){
    showBanner("Couldn't save: " + e.message);
  } finally {
    saveBtn.disabled = false;
  }
});

// ---------- ledger ----------
function renderLedger(){
  const list = document.getElementById('entryList');
  list.innerHTML = '';
  if(entries.length===0){
    list.innerHTML = '<div class="empty-state">No entries yet — today\'s log will be the first page.</div>';
    return;
  }
  entries.forEach(e => {
    const row = document.createElement('div');
    row.className = 'entry-row';
    const att = attendance[e.date] || 'present';
    const entryTag = (e.entryNumber||1) === 2 ? '<span class="entry-num-tag">Entry 2</span>' : '';
    row.innerHTML = `
      <div class="entry-date">${e.date}</div>
      <div class="entry-summary"><span class="surah">${e.sabaq.surah||'—'}</span> ${e.sabaq.ayahFrom ? (e.sabaq.ayahFrom+'–'+(e.sabaq.ayahTo||'')) : ''} ${entryTag}</div>
      <div class="att-chip att-${att}">${att}</div>
    `;
    row.addEventListener('click', () => openDetail(e));
    list.appendChild(row);
  });
}

function openDetail(e){
  const content = document.getElementById('detailContent');
  const entryLabel = (e.entryNumber||1) === 2 ? ' — Entry 2' : '';
  content.innerHTML = `
    <button class="close" id="closeDetail2">×</button>
    <h3>${formatDateNice(e.date)}${entryLabel}</h3>
    <div class="detail-grid">
      <div class="detail-sec"><div class="h">Sabaq</div><strong>${e.sabaq.surah||'—'}</strong> ${e.sabaq.ayahFrom?(e.sabaq.ayahFrom+'–'+(e.sabaq.ayahTo||'')):''} · ${e.sabaq.lines||0} lines${e.sabaq.tajweed&&e.sabaq.tajweed.length?' · '+e.sabaq.tajweed.join(', '):''}</div>
      <div class="detail-sec"><div class="h">Sabaq Dhor</div>${e.sabaqDhor.zoneJuz&&e.sabaqDhor.zoneJuz.length?juzListLabel(e.sabaqDhor.zoneJuz):(e.sabaqDhor.zoneLabel||'—')} · ${e.sabaqDhor.mistakes||0} mistakes${e.sabaqDhor.tajweed&&e.sabaqDhor.tajweed.length?' · '+e.sabaqDhor.tajweed.join(', '):''}</div>
      <div class="detail-sec"><div class="h">Dhor</div>${e.dhor.from?(segmentLabel(parseInt(e.dhor.from), e.dhor.ref||'waterval')+' → '+segmentLabel(parseInt(e.dhor.to), e.dhor.ref||'waterval')):'—'} · ${e.dhor.mistakes||0} mistakes · ${e.dhor.minutes||0} min${e.dhor.tajweed&&e.dhor.tajweed.length?' · '+e.dhor.tajweed.join(', '):''}</div>
      ${e.reflection?`<div class="detail-sec"><div class="h">Tadabbur</div>${e.reflection}</div>`:''}
      ${e.studentComment?`<div class="detail-sec"><div class="h">Note to teacher</div>${e.studentComment}</div>`:''}
      <div class="detail-sec"><div class="h">Teacher feedback</div>${e.teacherFeedback&&e.teacherFeedback.trim()?e.teacherFeedback:'<em>Awaiting review.</em>'}</div>
    </div>
    <button class="delete-link" id="deleteEntry">Delete this entry</button>
  `;
  document.getElementById('overlay').classList.remove('hidden');
  document.getElementById('closeDetail2').addEventListener('click', closeDetail);
  document.getElementById('deleteEntry').addEventListener('click', async () => {
    try{
      await apiDeleteEntry(e.date, e.entryNumber||1);
      // filter by date AND entry number — deleting entry 2 must not also
      // remove entry 1 for the same day (a real bug before two-per-day existed).
      entries = entries.filter(en => !(en.date === e.date && (en.entryNumber||1) === (e.entryNumber||1)));
      renderAll();
      updateEntryControls();
      closeDetail();
      if(e.date === todayISO() && (e.entryNumber||1) === currentEntryNumber){
        loadEntryNumber(1);
      }
    } catch(err){
      showBanner("Couldn't delete: " + err.message);
    }
  });
}
function closeDetail(){ document.getElementById('overlay').classList.add('hidden'); }
document.getElementById('closeDetail').addEventListener('click', closeDetail);
document.getElementById('overlay').addEventListener('click', e => { if(e.target.id==='overlay') closeDetail(); });

['s_surah','s_from','s_to','s_quarter'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateRubDisplay);
  document.getElementById(id).addEventListener('change', updateRubDisplay);
});

function renderRubRefToggle(){
  const cur = getRubReference();
  document.querySelectorAll('#rubRefToggle .tag').forEach(el => {
    el.classList.toggle('active', el.dataset.ref === cur);
  });
}
document.querySelectorAll('#rubRefToggle .tag').forEach(el => {
  el.addEventListener('click', () => {
    setRubReference(el.dataset.ref);
    renderRubRefToggle();
    updateRubDisplay();
  });
});

// ============================================================
// RENDER: progress view
// ============================================================
let currentZoom = 'focus';
function renderProgressView(){
  renderJuzStripInto('juzStripProgress');
  const grid = document.getElementById('surahGrid');
  grid.innerHTML = '';
  let range;
  if(currentZoom === 'full') range = { start:1, end:114 };
  else if(currentZoom === 'juz30') range = getJuzSurahSpan(30);
  else if(currentZoom === 'juz29') range = getJuzSurahSpan(29);
  else { // focus: whatever juz is active
    range = getJuzSurahSpan(position.activeJuz);
  }
  for(let n=range.start; n<=range.end; n++){
    const juz = SURAH_TRACKED_JUZ[position.activeJuz] ? null : null;
    // determine which juz this surah primarily belongs to (approx by span match)
    let owningJuz = null;
    for(let j=1;j<=30;j++){
      const span = getJuzSurahSpan(j);
      if(n>=span.start && n<=span.end){ owningJuz = j; break; }
    }
    const frac = owningJuz ? getJuzFillFraction(owningJuz) : 0;
    const pill = document.createElement('div');
    pill.className = 'surah-pill' + (frac>=1 ? ' done' : (frac>0 ? ' progress' : ''));
    pill.textContent = n + '. ' + surahName(n);
    pill.title = `Juz' ${owningJuz}`;
    grid.appendChild(pill);
  }
}
document.querySelectorAll('.zoom-toggle button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.zoom-toggle button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentZoom = btn.dataset.zoom;
    renderProgressView();
  });
});

// ============================================================
// RENDER: attendance view
// ============================================================
let calMonth = new Date();
async function loadAttendanceForMonth(){
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  const monthStr = `${y}-${String(m+1).padStart(2,'0')}`;
  try{
    const rows = await apiGetAttendance(monthStr);
    attendance = {};
    (rows || []).forEach(r => { attendance[r.date] = r.status; });
  } catch(e){
    showBanner("Couldn't load attendance: " + e.message);
  }
}
async function renderAttendance(){
  await loadAttendanceForMonth();
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  document.getElementById('calMonthLabel').textContent = calMonth.toLocaleDateString(undefined,{month:'long', year:'numeric'});
  const dowWrap = document.getElementById('calDow');
  dowWrap.innerHTML = ['S','M','T','W','T','F','S'].map(d=>`<div class="cal-dow">${d}</div>`).join('');
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  const firstDow = new Date(y,m,1).getDay();
  const daysInMonth = new Date(y,m+1,0).getDate();
  for(let i=0;i<firstDow;i++){ const e=document.createElement('div'); e.className='cal-day empty'; grid.appendChild(e); }
  for(let d=1; d<=daysInMonth; d++){
    const iso = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const state = attendance[iso];
    const cell = document.createElement('div');
    let cls = 'cal-day';
    if(state==='present') cls += ' present';
    else if(state==='absent') cls += ' absent';
    else if(state==='haidh') cls += ' haidh';
    else if(state==='predicted-haidh') cls += ' haidh predicted';
    cell.className = cls;
    cell.textContent = d;
    cell.addEventListener('click', () => cycleAttendance(iso));
    grid.appendChild(cell);
  }
}
async function cycleAttendance(iso){
  const cur = attendance[iso];
  const order = [undefined,'present','absent','haidh'];
  const idx = order.indexOf(cur === 'predicted-haidh' ? 'haidh' : cur);
  const next = order[(idx+1) % order.length];
  try{
    if(next){ await apiSetAttendance(iso, next); attendance[iso] = next; }
    else { await apiDeleteAttendance(iso); delete attendance[iso]; }
    renderAttendance();
  } catch(e){
    showBanner("Couldn't update attendance: " + e.message);
  }
}
document.getElementById('predictBtn').addEventListener('click', async () => {
  const cycle = parseInt(document.getElementById('cycleLen').value);
  const period = parseInt(document.getElementById('periodLen').value);
  const lastStr = document.getElementById('lastHaidh').value;
  if(!cycle || !period || !lastStr) return;
  try{
    await apiPredictHaidh(cycle, period, lastStr);
    renderAttendance();
  } catch(e){
    showBanner("Couldn't generate prediction: " + e.message);
  }
});

// ============================================================
// TAB NAV
// ============================================================
document.querySelectorAll('nav.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-'+btn.dataset.view).classList.add('active');
    const titles = { journal: "Today's Log", progress: 'Your Progress', attendance: 'Attendance' };
    document.getElementById('viewTitle').textContent = titles[btn.dataset.view];
    if(btn.dataset.view === 'progress') renderProgressView();
    if(btn.dataset.view === 'attendance') renderAttendance();
  });
});

// ============================================================
// INIT
// ============================================================
function renderAll(){
  renderJuzStrip();
  renderRevisionMap();
  updateZoneDisplays();
  renderLedger();
}

async function loadAppData(){
  try{
    const [entriesRows, positionRow] = await Promise.all([
      apiGetEntries(),
      apiGetPosition()
    ]);
    entries = (entriesRows || []).map(apiRowToEntry);
    if(positionRow){
      if(positionRow.position_json) position = JSON.parse(positionRow.position_json);
      if(positionRow.last_dhor_json) lastDhor = JSON.parse(positionRow.last_dhor_json);
    }
  } catch(e){
    showBanner("Couldn't load your data: " + e.message);
  }
}

async function startApp(){
  document.getElementById('todayLine').textContent = formatDateNice(todayISO());
  populateSurahSelect();
  renderRubRefToggle();
  renderTajweedTags('s_tajweed','sabaq');
  renderTajweedTags('sd_tajweed','sabaqDhor');
  renderTajweedTags('d_tajweed','dhor');
  await loadAppData();
  renderAll();
  loadEntryNumber(1);
}

function showMainApp(){
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
}
function showLoginScreen(){
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('mainApp').style.display = 'none';
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const id = document.getElementById('login_id').value.trim();
  const pin = document.getElementById('login_pin').value.trim();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  if(!id || !/^\d{4}$/.test(pin)){
    errEl.textContent = 'Enter your ID and a 4-digit PIN.';
    return;
  }
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  try{
    await apiLogin(id, pin);
    showMainApp();
    await startApp();
  } catch(e){
    errEl.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  clearToken();
  location.reload();
});

(function init(){
  if(getToken()){
    showMainApp();
    startApp();
  } else {
    showLoginScreen();
  }
})();
