// ============================================================
// Hifzhelper — Haidh calendar (V3.39, range-select V3.40.2)
// Month-by-month paging calendar for marking/clearing haidh days.
// Reached from the "Haidh" nav item, or from the journal's Sabaq-column
// "Haidh" text for a specific date (param, if provided, jumps straight
// to that date's month).
//
// V3.40.2: making a NEW mark is now tap-first/tap-last range-select —
// no separate "range mode" button (confirmed in chat: real haidh is
// never realistically a single isolated day). Tap 1 = pending start, tap
// 2 = pending end (can be the same day again, for a 1-day range) —
// nothing is written until the confirm bar's "Mark" button is pressed.
// No minimum range length is enforced; only the existing duration/gap
// caps (POST /attendance/mark-range, server-side, whole range validated
// before anything is written — an invalid range rejects entirely, no
// partial marks). Tapping an already-confirmed/planned day OUTSIDE of an
// active pending selection still clears just that one day directly,
// unchanged from before — continuity with the original "tap a marked
// day to clear it" behavior, which only ever applied to removing.
//
// A day carries one of three SAVED states here: unmarked,
// 'predicted-haidh' (lighter shade — a plan, not yet real) or 'haidh'
// (full shade — confirmed/actual), plus a 4th, purely local/unsaved
// state while a range is being built ("selecting"). A date in the
// future becomes a plan ('predicted-haidh') when confirmed; today or a
// past date becomes real ('haidh') directly. No deletion of any log
// ever happens here, and nothing on the Sabaq/Sabaq Dhor/Dhor detail
// cards is touched (confirmed in chat) — this screen only ever writes
// to the attendance table.
//
// The 10/15-day caps are enforced server-side (worker/src/
// attendance.js, shared/haidhRules.js) — this screen just surfaces
// whatever error message comes back, rather than duplicating the
// run/gap-scanning logic in two places.
// ============================================================

let haidhCalViewYear = null;
let haidhCalViewMonth = null; // 0-indexed, matches JS Date
let haidhCalAttendance = {};  // date (YYYY-MM-DD) -> 'haidh' | 'predicted-haidh'
let haidhRangeStart = null;   // pending range being built, not yet saved
let haidhRangeEnd = null;

function haidhTodayISO(){ return new Date().toISOString().slice(0,10); }

// V3.40.3 bug fix: build a YYYY-MM-DD string from a LOCAL calendar date
// directly, never via .toISOString() -- new Date(y,m,d) is local
// midnight, but .toISOString() always converts to UTC, silently
// shifting the date backward a day for anyone in a timezone ahead of
// UTC (confirmed live: South African Standard Time, UTC+2). Reading the
// constructed Date's own local getters back out avoids the UTC
// round-trip entirely, so this is correct regardless of the device's
// timezone or offset direction. Date's constructor already normalizes
// out-of-range month/day values (e.g. day 32, month -1), so this stays
// correct for the prev/next-month trailing cells below too.
function haidhLocalISO(year, month, day){
  const dt = new Date(year, month, day);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function haidhFormatMonthLabel(year, month){
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

async function loadHaidhCalAttendance(){
  // V3.40.3 bug fix: apiGetAttendance() already resolves directly to the
  // array -- worker/src/index.js's respond() always sends result.data as
  // the top-level response body, so there's no extra .data wrapper to
  // destructure here. `const { data } = ...` was silently pulling
  // undefined out of an array every time, which is the real reason
  // nothing ever showed on the calendar (confirmed live in console:
  // apiGetAttendance() itself returns the real rows correctly).
  const data = await apiGetAttendance();
  haidhCalAttendance = {};
  (data || []).forEach(row => {
    if(row.status === 'haidh' || row.status === 'predicted-haidh') haidhCalAttendance[row.date] = row.status;
  });
}

function haidhPendingRangeBounds(){
  if(haidhRangeStart == null) return null;
  if(haidhRangeEnd == null) return [haidhRangeStart, haidhRangeStart];
  return haidhRangeStart <= haidhRangeEnd ? [haidhRangeStart, haidhRangeEnd] : [haidhRangeEnd, haidhRangeStart];
}

function haidhCalDayCell(dateISO, inCurrentMonth){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'haidh-cal-day';
  if(!inCurrentMonth) btn.classList.add('haidh-cal-day-muted');
  if(dateISO === haidhTodayISO()) btn.classList.add('haidh-cal-day-today');
  const status = haidhCalAttendance[dateISO];
  // V3.39: auto-confirm is evaluated lazily, on the fly (confirmed in
  // chat) — a predicted day that's already in the past with no log
  // reads as genuinely haidh here, same full shade as an explicitly
  // confirmed day; only a predicted day still ahead of today shows the
  // lighter "still just a plan" shade.
  const isFuture = dateISO > haidhTodayISO();
  if(status === 'haidh' || (status === 'predicted-haidh' && !isFuture)) btn.classList.add('haidh-cal-day-confirmed');
  else if(status === 'predicted-haidh' && isFuture) btn.classList.add('haidh-cal-day-planned');
  // V3.40.2: the pending (not-yet-saved) range being built takes visual
  // priority over a saved status if they ever overlap -- see the CSS
  // ordering in css/haidh.css.
  const pending = haidhPendingRangeBounds();
  if(pending && dateISO >= pending[0] && dateISO <= pending[1]) btn.classList.add('haidh-cal-day-selecting');
  btn.textContent = String(parseInt(dateISO.slice(8, 10), 10));
  btn.addEventListener('click', () => onHaidhCalDayTap(dateISO));
  return btn;
}

function renderHaidhRangeBar(){
  const bar = document.getElementById('haidhRangeBar');
  const bounds = (haidhRangeStart != null && haidhRangeEnd != null) ? haidhPendingRangeBounds() : null;
  if(!bounds){
    bar.classList.add('hidden');
    return;
  }
  const n = haidhDaysBetween(bounds[0], bounds[1]) + 1;
  document.getElementById('haidhRangeBarText').textContent = n + (n === 1 ? ' day selected' : ' days selected');
  bar.classList.remove('hidden');
}

function haidhClearPendingRange(){
  haidhRangeStart = null;
  haidhRangeEnd = null;
  renderHaidhRangeBar();
}

async function onHaidhCalDayTap(dateISO){
  const errEl = document.getElementById('haidhCalError');
  errEl.textContent = '';
  const status = haidhCalAttendance[dateISO];

  // Tapping an already-confirmed/planned day OUTSIDE of an active
  // pending selection still clears just that one day directly, exactly
  // as before V3.40.2 — continuity with the original "tap a marked day
  // to clear it" behavior, which only ever applied to removing, never
  // to adding (Claude's own judgment call, not separately asked — see
  // TODO.md).
  if(status && haidhRangeStart == null){
    try{
      await apiDeleteAttendance(dateISO);
      await loadHaidhCalAttendance();
      renderHaidhCalGrid();
    } catch(e){
      errEl.textContent = e.message;
    }
    return;
  }

  // Building a NEW pending range: tap 1 = start, tap 2 = end (can be the
  // same day again, for a 1-day range) — nothing is written until the
  // confirm bar's "Mark" button is pressed. A 3rd tap after both ends
  // are already set starts a fresh selection rather than extending the
  // old one.
  if(haidhRangeStart == null){
    haidhRangeStart = dateISO;
  } else if(haidhRangeEnd == null){
    haidhRangeEnd = dateISO;
  } else {
    haidhRangeStart = dateISO;
    haidhRangeEnd = null;
  }
  renderHaidhRangeBar();
  renderHaidhCalGrid();
}

async function onHaidhRangeConfirm(){
  const bounds = haidhPendingRangeBounds();
  if(!bounds) return;
  const errEl = document.getElementById('haidhCalError');
  errEl.textContent = '';
  try{
    await apiMarkHaidhRange(bounds[0], bounds[1]);
    haidhClearPendingRange();
    await loadHaidhCalAttendance();
    renderHaidhCalGrid();
  } catch(e){
    // Confirmed in chat: an invalid range is rejected wholesale, nothing
    // partially marked — so there's nothing to reconcile. The pending
    // selection is deliberately kept (not cleared) on failure, so the
    // student can see exactly what was rejected and adjust it directly
    // rather than having to re-select from scratch.
    errEl.textContent = e.message;
  }
}

function renderHaidhCalGrid(){
  document.getElementById('haidhCalMonthLabel').textContent = haidhFormatMonthLabel(haidhCalViewYear, haidhCalViewMonth);

  const weekdaysEl = document.getElementById('haidhCalWeekdays');
  if(!weekdaysEl.childElementCount){
    ['S','M','T','W','T','F','S'].forEach(d => {
      const span = document.createElement('span');
      span.textContent = d;
      weekdaysEl.appendChild(span);
    });
  }

  const gridEl = document.getElementById('haidhCalGrid');
  gridEl.innerHTML = '';

  const firstOfMonth = new Date(haidhCalViewYear, haidhCalViewMonth, 1);
  const startOffset = firstOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = new Date(haidhCalViewYear, haidhCalViewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(haidhCalViewYear, haidhCalViewMonth, 0).getDate();

  const cells = [];
  for(let i = startOffset - 1; i >= 0; i--){
    const d = daysInPrevMonth - i;
    cells.push({ iso: haidhLocalISO(haidhCalViewYear, haidhCalViewMonth - 1, d), inMonth: false });
  }
  for(let d = 1; d <= daysInMonth; d++){
    cells.push({ iso: haidhLocalISO(haidhCalViewYear, haidhCalViewMonth, d), inMonth: true });
  }
  let extra = 1;
  while(cells.length % 7 !== 0){
    cells.push({ iso: haidhLocalISO(haidhCalViewYear, haidhCalViewMonth + 1, extra), inMonth: false });
    extra++;
  }

  cells.forEach(c => gridEl.appendChild(haidhCalDayCell(c.iso, c.inMonth)));
}

function shiftHaidhCalMonth(delta){
  haidhCalViewMonth += delta;
  if(haidhCalViewMonth < 0){ haidhCalViewMonth = 11; haidhCalViewYear--; }
  if(haidhCalViewMonth > 11){ haidhCalViewMonth = 0; haidhCalViewYear++; }
  renderHaidhCalGrid();
}

// V3.40.1: real bug fix -- these buttons were always correctly wired to
// shiftHaidhCalMonth, but nothing anywhere ever gave them an icon, even
// though css/haidh.css's .haidh-cal-prev/-next svg rules (rotated
// chevron) already expected one -- they rendered as invisible, not just
// unstyled. iconHtml('chevronDown') matches what that CSS rotation was
// always built for.
document.getElementById('haidhCalPrevBtn').innerHTML = iconHtml('chevronDown');
document.getElementById('haidhCalNextBtn').innerHTML = iconHtml('chevronDown');
document.getElementById('haidhCalPrevBtn').addEventListener('click', () => shiftHaidhCalMonth(-1));
document.getElementById('haidhCalNextBtn').addEventListener('click', () => shiftHaidhCalMonth(1));

// V3.40.2: range-select confirm bar.
document.getElementById('haidhRangeCancelBtn').addEventListener('click', () => {
  haidhClearPendingRange();
  renderHaidhCalGrid();
});
document.getElementById('haidhRangeConfirmBtn').addEventListener('click', onHaidhRangeConfirm);

async function renderHaidhDetailScreen(param){
  document.getElementById('haidhDetailHeaderIcon').innerHTML = iconHtml('haidh');
  document.getElementById('haidhCalError').textContent = '';
  // V3.40.2: a pending, unsaved selection from a previous visit to this
  // screen shouldn't carry over silently.
  haidhClearPendingRange();
  const jumpDate = (typeof param === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(param)) ? param : haidhTodayISO();
  const [y, m] = jumpDate.split('-').map(Number);
  haidhCalViewYear = y;
  haidhCalViewMonth = m - 1;
  try{
    await loadHaidhCalAttendance();
    renderHaidhCalGrid();
  } catch(e){
    showBanner("Couldn't load the Haidh calendar: " + e.message);
  }
}
