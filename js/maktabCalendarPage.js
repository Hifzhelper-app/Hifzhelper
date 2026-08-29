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
    MCAL_CACHE[year] = { entries: entries || [], terms: terms || [] };
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
  const hits = c.entries.filter(e => e.date_from <= dateISO && e.date_to >= dateISO);
  const term = c.terms.find(t => t.term_from <= dateISO && t.term_to >= dateISO);
  if(!hits.length && !term) return null;
  const labels = [];
  if(term) labels.push(term.name);
  hits.forEach(e => labels.push(e.label || (e.type === 'holiday' ? 'Public holiday' : 'Significant day')));
  return {
    islamic: hits.some(e => e.type === 'islamic'),
    holiday: hits.some(e => e.type === 'holiday'),
    term: !!term,
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

async function renderMaktabCalendarScreen(){
  const grid = document.getElementById('mcalGrid');
  if(!grid) return;
  if(!mcalMonth){
    const t = (typeof appTodayISO === 'function' ? appTodayISO() : new Date().toISOString().slice(0, 10));
    mcalMonth = t.slice(0, 7);
  }
  const [yearStr, monthStr] = mcalMonth.split('-');
  const year = parseInt(yearStr), month = parseInt(monthStr);
  await ensureMaktabCalYear(yearStr);
  // a January/December view can show spillover days of the next/prev year
  await ensureMaktabCalYear(String(month === 1 ? year - 1 : month === 12 ? year + 1 : year));

  document.getElementById('mcalMonthLabel').textContent =
    new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const wk = document.getElementById('mcalWeekdays');
  wk.innerHTML = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<span>${d}</span>`).join('');

  const first = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = (first.getUTCDay() + 6) % 7;   // Monday-first
  const cursor = new Date(first); cursor.setUTCDate(cursor.getUTCDate() - startOffset);
  grid.innerHTML = '';
  for(let i = 0; i < 42; i++){
    const iso = cursor.toISOString().slice(0, 10);
    const cell = document.createElement('div');
    cell.className = 'mcal-day';
    if(iso.slice(0, 7) !== mcalMonth) cell.classList.add('mcal-day-muted');
    if(typeof appTodayISO === 'function' && iso === appTodayISO()) cell.classList.add('mcal-day-today');
    const info = maktabCalInfoForDate(iso);
    if(info){
      if(info.term) cell.classList.add('mcal-day-term');
      if(info.islamic) cell.classList.add('mcal-day-islamic');
      if(info.holiday) cell.classList.add('mcal-day-holiday');
      cell.title = info.title;
    }
    cell.innerHTML = `<span class="mcal-day-num">${cursor.getUTCDate()}</span>` +
      (info && info.islamic ? '<span class="mcal-dot mcal-dot-islamic"></span>' : '') +
      (info && info.holiday ? '<span class="mcal-dot mcal-dot-holiday"></span>' : '');
    grid.appendChild(cell);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // the month's entries, listed under the grid (terms overlapping first)
  const list = document.getElementById('mcalList');
  const monthFrom = `${mcalMonth}-01`, monthTo = `${mcalMonth}-31`;
  const c = MCAL_CACHE[yearStr] || { entries: [], terms: [] };
  const rows = [];
  const f = (d) => (typeof fmtDMY === 'function' ? fmtDMY(d) : d);   // V3.88.0: dd-mmm-yy
  c.terms.filter(t => t.term_from <= monthTo && t.term_to >= monthFrom)
    .forEach(t => rows.push(`<div class="mcal-list-row mcal-list-term"><span class="mcal-list-date">${f(t.term_from)} &ndash; ${f(t.term_to)}</span><span>${t.name}</span></div>`));
  // V3.92.0 (user): islamic rows show the HIJRI DATE, not the day name
  // — the label's Hijri part (after the em-dash); a manual entry with
  // no Hijri recorded falls back to its full label.
  const listText = (e) => {
    if(e.type !== 'islamic') return e.label || 'Public holiday';
    return (e.label && e.label.includes(' \u2014 ')) ? e.label.split(' \u2014 ')[1] : (e.label || '');
  };
  c.entries.filter(e => e.date_from <= monthTo && e.date_to >= monthFrom)
    .forEach(e => rows.push(`<div class="mcal-list-row"><span class="mcal-list-date">${e.date_from === e.date_to ? f(e.date_from) : f(e.date_from) + ' &ndash; ' + f(e.date_to)}</span><span class="mcal-list-${e.type}">${listText(e)}</span></div>`));
  list.innerHTML = rows.join('') || '<div class="form-hint">Nothing marked this month.</div>';
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
  document.getElementById('mcalPrevBtn').addEventListener('click', () => shift(-1));
  document.getElementById('mcalNextBtn').addEventListener('click', () => shift(1));
}
document.addEventListener('DOMContentLoaded', wireMaktabCalendarScreen);
