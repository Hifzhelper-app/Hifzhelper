/* Hifzhelper build 4.2.15.5 | js/maktabCalendarPage.js */
// ============================================================
// maktabCalendarPage.js — V3.87.0: the MAKTAB CALENDAR page (user spec,
// 2026-08-28). INFORMATION ONLY — nothing here feeds attendance (terms
// do that worker-side). Read-only for EVERYONE on this page: all
// management (terms, adjusting predictions after actual sightings,
// changing holidays) lives in Maktab Settings' Calendar card.
//
// The same module owns the shared year-cache + the marker helper the
// user asked to run "wherever dates appear": calendar day cells,
// journal/summary date cells (via formatDateCell), and the day-view
// date headers.
// ============================================================

const MCAL_CACHE = {};   // year → { entries: [...], terms: [...] }
let mcalMonth = null;    // 'YYYY-MM' shown on the page

async function ensureMaktabCalYear(year){
  if(MCAL_CACHE[year]) return MCAL_CACHE[year];
  try{
    const [entries, terms] = await Promise.all([apiGetMaktabCalendar(year), apiGetMaktabTerms()]);
    // V4.2.15.5: normalize one-day rows defensively. Older/imported
    // calendar rows can carry a blank date_to; they are still a real event
    // on date_from and must not disappear (e.g. 24 Sep between two terms).
    const normalizedEntries = (entries || []).map(e => Object.assign({}, e, { date_to: e.date_to || e.date_from }));
    MCAL_CACHE[year] = { entries: normalizedEntries, terms: terms || [] };
  } catch(e){
    MCAL_CACHE[year] = { entries: [], terms: [] };
  }
  return MCAL_CACHE[year];
}
function mcalInvalidate(){ for(const k of Object.keys(MCAL_CACHE)) delete MCAL_CACHE[k]; }

// SYNC lookup against whatever years are cached — surfaces preload the
// year(s) they show, then paint markers synchronously.
function maktabCalInfoForDate(dateISO){
  if(!dateISO) return null;
  const y = dateISO.slice(0, 4);
  const c = MCAL_CACHE[y];
  if(!c) return null;
  const hits = c.entries.filter(e => {
    const to = e.date_to || e.date_from;
    return e.date_from <= dateISO && to >= dateISO;
  });
  const term = c.terms.find(t => t.term_from <= dateISO && t.term_to >= dateISO);
  if(!hits.length && !term) return null;
  const labels = [];
  if(term) labels.push(term.name);
  hits.forEach(e => labels.push(e.label || (e.type === 'holiday' ? 'Public holiday' : 'Significant day')));
  return {
    islamic: hits.some(e => e.type === 'islamic'),
    holiday: hits.some(e => e.type === 'holiday'),
    term: !!term,
    entries: hits.map(e => ({ type: e.type, label: e.label || (e.type === 'holiday' ? 'Public holiday' : 'Significant Islamic date') })),
    title: labels.join(' · '),
  };
}
// the small marker html shared by the date-cell surfaces
function maktabCalMarkHtml(dateISO){
  const info = maktabCalInfoForDate(dateISO);
  if(!info || (!info.islamic && !info.holiday)) return '';
  const cls = info.islamic ? 'mcal-mark-islamic' : 'mcal-mark-holiday';
  return `<span class="mcal-mark ${cls}" title="${info.title.replace(/"/g, '&quot;')}"></span>`;
}

function mcalEsc(value){
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function mcalEventText(entry){
  const label = String(entry && entry.label || '').trim();
  if(!label) return entry && entry.type === 'holiday' ? 'Public holiday' : 'Islamic date';
  return entry && entry.type === 'islamic' && label.includes(' — ') ? label.split(' — ')[0] : label;
}
async function renderMaktabCalendarInto(opts){
  const o = opts || {};
  const grid = document.getElementById(o.gridId || 'mcalGrid');
  if(!grid) return;
  const monthValue = o.month || mcalMonth || (typeof appTodayISO === 'function' ? appTodayISO().slice(0, 7) : new Date().toISOString().slice(0, 7));
  const [yearStr, monthStr] = monthValue.split('-');
  const year = parseInt(yearStr), month = parseInt(monthStr);
  await ensureMaktabCalYear(yearStr);
  await ensureMaktabCalYear(String(month === 1 ? year - 1 : month === 12 ? year + 1 : year));

  const label = document.getElementById(o.labelId || 'mcalMonthLabel');
  if(label) label.textContent = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const wk = document.getElementById(o.weekdaysId || 'mcalWeekdays');
  if(wk) wk.innerHTML = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<span>${d}</span>`).join('');

  const first = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = (first.getUTCDay() + 6) % 7;
  const cursor = new Date(first); cursor.setUTCDate(cursor.getUTCDate() - startOffset);
  grid.innerHTML = '';
  for(let i = 0; i < 42; i++){
    const iso = cursor.toISOString().slice(0, 10);
    const cell = document.createElement('div');
    cell.className = 'mcal-day';
    if(iso.slice(0, 7) !== monthValue) cell.classList.add('mcal-day-muted');
    if(typeof appTodayISO === 'function' && iso === appTodayISO()) cell.classList.add('mcal-day-today');
    const info = maktabCalInfoForDate(iso);
    if(info){
      if(info.term) cell.classList.add('mcal-day-term');
      if(info.islamic) cell.classList.add('mcal-day-islamic');
      if(info.holiday) cell.classList.add('mcal-day-holiday');
      cell.title = info.title;
    }
    const events = info && info.entries && info.entries.length
      ? `<span class="mcal-day-events">${info.entries.slice(0, 2).map(e => `<span class="mcal-day-event mcal-day-event-${e.type}">${mcalEsc(mcalEventText(e))}</span>`).join('')}</span>`
      : '';
    cell.innerHTML = `<span class="mcal-day-num">${cursor.getUTCDate()}</span>` +
      (info && info.islamic ? '<span class="mcal-dot mcal-dot-islamic"></span>' : '') +
      (info && info.holiday ? '<span class="mcal-dot mcal-dot-holiday"></span>' : '') + events;
    grid.appendChild(cell);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const list = document.getElementById(o.listId || 'mcalList');
  if(!list) return;
  const monthFrom = `${monthValue}-01`, monthTo = `${monthValue}-31`;
  const c = MCAL_CACHE[yearStr] || { entries: [], terms: [] };
  const rows = [];
  const f = (d) => (typeof fmtDMY === 'function' ? fmtDMY(d) : d);
  // On the Settings-embedded viewer the editable term cards immediately
  // below already show every term/date range, so do not repeat them in the
  // month list. The legacy read-only screen may still opt into term rows.
  if(o.includeTermList !== false){
    c.terms.filter(t => t.term_from <= monthTo && t.term_to >= monthFrom)
      .forEach(t => rows.push(`<div class="mcal-list-row mcal-list-term"><span class="mcal-list-date">${f(t.term_from)} &ndash; ${f(t.term_to)}</span><span>${mcalEsc(t.name)}</span></div>`));
  }
  const listText = (e) => {
    if(e.type !== 'islamic') return e.label || 'Public holiday';
    return (e.label && e.label.includes(' — ')) ? e.label.split(' — ')[1] : (e.label || '');
  };
  c.entries.filter(e => e.date_from <= monthTo && (e.date_to || e.date_from) >= monthFrom)
    .forEach(e => rows.push(`<div class="mcal-list-row"><span class="mcal-list-date">${e.date_from === e.date_to ? f(e.date_from) : f(e.date_from) + ' &ndash; ' + f(e.date_to)}</span><span class="mcal-list-${e.type}">${mcalEsc(listText(e))}</span></div>`));
  list.innerHTML = rows.join('') || '<div class="form-hint">Nothing marked this month.</div>';
}

async function renderMaktabCalendarScreen(){
  if(!mcalMonth){
    const t = (typeof appTodayISO === 'function' ? appTodayISO() : new Date().toISOString().slice(0, 10));
    mcalMonth = t.slice(0, 7);
  }
  await renderMaktabCalendarInto({ month: mcalMonth });
}

let msetMcalMonth = null;
async function renderMsetEmbeddedCalendar(){
  const grid = document.getElementById('msetMcalGrid');
  if(!grid) return;
  const yearSel = document.getElementById('mset_cal_year');
  const selectedYear = yearSel && yearSel.value ? yearSel.value : (typeof appTodayISO === 'function' ? appTodayISO().slice(0,4) : String(new Date().getUTCFullYear()));
  if(!msetMcalMonth){
    const today = typeof appTodayISO === 'function' ? appTodayISO() : new Date().toISOString().slice(0,10);
    msetMcalMonth = `${selectedYear}-${today.slice(5,7)}`;
  }
  if(msetMcalMonth.slice(0,4) !== selectedYear) msetMcalMonth = `${selectedYear}-${msetMcalMonth.slice(5,7)}`;
  await renderMaktabCalendarInto({ month:msetMcalMonth, gridId:'msetMcalGrid', labelId:'msetMcalMonthLabel', weekdaysId:'msetMcalWeekdays', listId:'msetMcalList', includeTermList:false });
}
function setMsetEmbeddedCalendarYear(year){
  const y = String(year || '');
  if(!/^\d{4}$/.test(y)) return;
  const month = msetMcalMonth ? msetMcalMonth.slice(5,7) : (typeof appTodayISO === 'function' ? appTodayISO().slice(5,7) : '01');
  msetMcalMonth = `${y}-${month}`;
  renderMsetEmbeddedCalendar();
}
function wireMsetEmbeddedCalendar(){
  const prev = document.getElementById('msetMcalPrevBtn');
  const next = document.getElementById('msetMcalNextBtn');
  if(!prev || !next || prev.dataset.wired === '1') return;
  prev.dataset.wired = next.dataset.wired = '1';
  const shift = (n) => {
    if(!msetMcalMonth){
      const today = typeof appTodayISO === 'function' ? appTodayISO() : new Date().toISOString().slice(0,10);
      msetMcalMonth = today.slice(0,7);
    }
    const [y,m] = msetMcalMonth.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    msetMcalMonth = d.toISOString().slice(0,7);
    const yearSel = document.getElementById('mset_cal_year');
    if(yearSel && [...yearSel.options].some(o => o.value === msetMcalMonth.slice(0,4))) yearSel.value = msetMcalMonth.slice(0,4);
    renderMsetEmbeddedCalendar();
  };
  prev.addEventListener('click', () => shift(-1));
  next.addEventListener('click', () => shift(1));
}

let mcalWired = false;
function wireMaktabCalendarScreen(){
  if(mcalWired) return;
  mcalWired = true;
  const shift = (n) => {
    const [y, m] = mcalMonth.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    mcalMonth = d.toISOString().slice(0, 7);
    renderMaktabCalendarScreen();
  };
  const prev = document.getElementById('mcalPrevBtn');
  const next = document.getElementById('mcalNextBtn');
  if(prev) prev.addEventListener('click', () => shift(-1));
  if(next) next.addEventListener('click', () => shift(1));
}
document.addEventListener('DOMContentLoaded', wireMaktabCalendarScreen);
