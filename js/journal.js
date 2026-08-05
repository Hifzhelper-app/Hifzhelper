// ============================================================
// Hifzhelper — Journal landing page
//
// 2026-08-05, confirmed in chat over several rounds -- complete rebuild.
// The V3.1 version this replaces hadn't been touched since its very
// first pass: it read Sabaq entries as e.surah/e.ayah_from/e.ayah_to,
// fields that haven't existed since the verse-ref rework -- so the
// Sabaq column was silently showing "-" for every real entry. Its own
// "quick add" modal was a separate, much simpler form that didn't match
// any card's real current fields at all (no tajweed, no Notes, no
// Juz'/Amount picker). This version reads the same real fields History
// already does (describeEntryForRail, js/dhorPage.js) and drops the
// quick-add modal entirely -- editing now opens the real card directly,
// the same edit path History's own edit button already uses.
//
// Shape: most recent 10 days shown individually, older data rolled up
// into weekly (rolling 7-day) summary rows showing just the date range
// -- trying to summarize several different entries across several days
// in one row either gets crowded fast or too vague to be worth reading,
// confirmed in chat. A default ~3-month window loads up front; "Load
// more" extends the rollup range further back in the same format.
// ============================================================

const JOURNAL_EXPANDED_DAYS = 10;
const JOURNAL_DEFAULT_ROLLUP_DAYS = 80; // ~80 days of rollups + 10 expanded ≈ 3 months
const JOURNAL_LOAD_MORE_DAYS = 28;      // one "page" of further rollup history per tap

let journalData = {};      // date -> { sabaq: [], sabaqDhor: [], dhor: [] }
let journalRollupDays = JOURNAL_DEFAULT_ROLLUP_DAYS; // how far back "Load more" has extended to

function todayISO(){ return new Date().toISOString().slice(0,10); }

function isoDateNDaysAgo(n){
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0,10);
}

// (hover: hover) and (pointer: fine) means a real mouse/trackpad is
// present -- true regardless of screen width, false for touch-only,
// which is the actual thing that matters here (a touchscreen laptop at
// desktop width is still touch). Confirmed in chat as the deliberate
// choice over inferring this from a breakpoint.
const JOURNAL_HAS_FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

async function loadJournalData(totalDays){
  const since = isoDateNDaysAgo(totalDays);
  const [sabaq, sabaqDhor, dhor] = await Promise.all([
    apiSabaq.get(since),
    apiSabaqDhor.get(since),
    apiDhor.get(since)
  ]);

  journalData = {};
  const today = todayISO();
  // Always include today, even with nothing logged yet, so there's
  // always a row to interact with.
  journalData[today] = { sabaq: [], sabaqDhor: [], dhor: [] };

  const bucket = (rows, key) => {
    (rows || []).forEach(row => {
      const d = row.date;
      if(!journalData[d]) journalData[d] = { sabaq: [], sabaqDhor: [], dhor: [] };
      journalData[d][key].push(row);
    });
  };
  bucket(sabaq, 'sabaq');
  bucket(sabaqDhor, 'sabaqDhor');
  bucket(dhor, 'dhor');
}

function formatDateCell(iso){
  const d = new Date(iso + 'T00:00:00');
  const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
  const rest = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `<span class="weekday">${weekday}</span>${rest}`;
}
function formatDateShort(iso){
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Trimmed shorthand, confirmed in chat: same underlying data
// describeEntryForRail (js/dhorPage.js, History's own summary) already
// reads, just the range/segment itself -- lines/pages, mistakes, and
// time all dropped, since the point here is "what portion," not the
// session's own detail.
function journalCellShorthand(type, entries){
  if(!entries || !entries.length) return '<span class="journal-cell-empty">—</span>';
  const e = entries[0]; // most recent first, same ordering the API already returns
  let text = '—';
  if(type === 'sabaq') text = `${e.sabaq_from}–${e.sabaq_to}`;
  else if(type === 'sabaqDhor') text = `${e.from_surah}:${e.from_ayah}–${e.to_surah}:${e.to_ayah}`;
  else if(type === 'dhor') text = describeDhorSegment(e.segment_from, e.segment_to, e.ref || dhorCurrentRef);
  const badge = entries.length > 1 ? `<span class="entry-count-badge">+${entries.length - 1}</span>` : '';
  return `<span class="journal-cell-text">${text}</span>${badge}`;
}

// Press-and-hold (touch) or a plain click (mouse/trackpad, confirmed in
// chat) triggers onActivate -- 450ms hold, 8px cancel-on-movement
// threshold, same pattern already used for the timer's own drag
// handling, applied here to a static table cell instead of a floating
// element. touch-action/user-select:none (css/journal-table.css) is the
// actual mitigation against the device's own native long-press gesture
// (text selection, a context menu) competing with this -- not something
// this function can control on its own.
function wireHoldOrClick(el, onActivate){
  if(JOURNAL_HAS_FINE_POINTER){
    el.addEventListener('click', onActivate);
    return;
  }
  let holdTimer = null, moved = false, startX = 0, startY = 0;
  el.addEventListener('pointerdown', (e) => {
    moved = false;
    startX = e.clientX; startY = e.clientY;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => { if(!moved) onActivate(); }, 450);
  });
  el.addEventListener('pointermove', (e) => {
    if(Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8){
      moved = true;
      clearTimeout(holdTimer);
    }
  });
  el.addEventListener('pointerup', () => clearTimeout(holdTimer));
  el.addEventListener('pointerleave', () => clearTimeout(holdTimer));
}

// Opens the real card directly in edit mode -- the same EDIT_HANDLERS
// entry point History's own edit button already calls (js/logDetailScreen.js
// registers EDIT_HANDLERS.sabaq/sabaqDhor/dhor from each page's own
// file) -- not a separate, second edit mechanism.
async function openEntryForEdit(type, entry){
  await showScreen('logDetail', type);
  const handler = EDIT_HANDLERS[type];
  if(handler) handler(entry);
}

// Sets every card's own date field to the tapped date and opens the
// detail screen -- so a new entry logged from there is dated correctly
// for that day, confirmed in chat as the actual point (not date-
// filtered browsing, which History's own rail already covers).
async function openDetailForDate(date){
  await showScreen('logDetail', 'sabaq');
  ['sabaq_date', 'sabaqDhor_date', 'dhor_date'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = date;
  });
}

function renderJournalRow(date, day){
  const dateCell = document.createElement('td');
  dateCell.className = 'cell-date';
  dateCell.innerHTML = formatDateCell(date);
  wireHoldOrClick(dateCell, () => openDetailForDate(date));

  const tr = document.createElement('tr');
  tr.appendChild(dateCell);

  ['sabaq', 'sabaqDhor', 'dhor'].forEach(type => {
    const td = document.createElement('td');
    td.className = 'journal-cell';
    td.innerHTML = journalCellShorthand(type, day[type]);
    if(day[type] && day[type].length){
      wireHoldOrClick(td, () => openEntryForEdit(type, day[type][0]));
    }
    tr.appendChild(td);
  });
  return tr;
}

function renderJournalRollupRow(fromDate, toDate){
  const tr = document.createElement('tr');
  tr.className = 'journal-rollup-row';
  const td = document.createElement('td');
  td.colSpan = 4;
  td.className = 'journal-rollup-cell';
  td.textContent = fromDate === toDate
    ? formatDateShort(fromDate)
    : `${formatDateShort(fromDate)} – ${formatDateShort(toDate)}`;
  tr.appendChild(td);
  return tr;
}

function renderJournalTable(){
  const allDates = Object.keys(journalData).sort().reverse();
  const tbody = document.getElementById('journalTbody');
  tbody.innerHTML = '';

  const expanded = allDates.slice(0, JOURNAL_EXPANDED_DAYS);
  const rest = allDates.slice(JOURNAL_EXPANDED_DAYS);

  expanded.forEach(date => tbody.appendChild(renderJournalRow(date, journalData[date])));

  // Rolling 7-day buckets counting back from the end of the expanded
  // section -- deliberately not calendar weeks (Sun-Sat etc.), since
  // that would produce an uneven, confusing partial week right where
  // the expanded section ends. Only dates that actually appear in
  // journalData feed a bucket's own from/to range -- an entirely empty
  // week produces no row at all, rather than a blank one.
  if(rest.length){
    let bucketStart = null, bucketDates = [];
    const flushBucket = () => {
      if(bucketDates.length) tbody.appendChild(renderJournalRollupRow(bucketDates[bucketDates.length - 1], bucketDates[0]));
      bucketDates = [];
    };
    const oldestExpanded = expanded.length ? new Date(expanded[expanded.length - 1] + 'T00:00:00') : new Date();
    rest.forEach(date => {
      const d = new Date(date + 'T00:00:00');
      const daysFromBoundary = Math.floor((oldestExpanded - d) / 86400000);
      const bucketIndex = Math.floor((daysFromBoundary - 1) / 7);
      if(bucketStart !== bucketIndex){
        flushBucket();
        bucketStart = bucketIndex;
      }
      bucketDates.push(date);
    });
    flushBucket();
  }

  const loadMoreRow = document.createElement('tr');
  const loadMoreCell = document.createElement('td');
  loadMoreCell.colSpan = 4;
  loadMoreCell.className = 'journal-load-more-cell';
  loadMoreCell.innerHTML = `<button type="button" id="journalLoadMoreBtn">Load more</button>`;
  loadMoreRow.appendChild(loadMoreCell);
  tbody.appendChild(loadMoreRow);
  document.getElementById('journalLoadMoreBtn').addEventListener('click', loadMoreJournalHistory);
}

async function loadMoreJournalHistory(){
  const btn = document.getElementById('journalLoadMoreBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Loading…'; }
  journalRollupDays += JOURNAL_LOAD_MORE_DAYS;
  try{
    await loadJournalData(JOURNAL_EXPANDED_DAYS + journalRollupDays);
    renderJournalTable();
  } catch(e){
    showBanner("Couldn't load more history: " + e.message);
  }
}

async function renderJournalScreen(){
  const tbody = document.getElementById('journalTbody');
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--color-ink-faint);padding:24px;">Loading…</td></tr>`;
  try{
    journalRollupDays = JOURNAL_DEFAULT_ROLLUP_DAYS;
    await loadJournalData(JOURNAL_EXPANDED_DAYS + journalRollupDays);
    renderJournalTable();
  } catch(e){
    showBanner("Couldn't load your journal: " + e.message);
  }
}
