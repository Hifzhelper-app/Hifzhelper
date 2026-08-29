// ============================================================
// Hifzhelper — Haidh calendar (V3.39, range-select V3.40.2, V3.40.4)
// Month-by-month paging calendar for marking/clearing haidh days.
// Reached from the "Haidh" nav item, or from the journal's Sabaq-column
// "Haidh" text for a specific date (param, if provided, jumps straight
// to that date's month).
//
// V3.40.2: making a NEW mark is now tap-first/tap-last range-select —
// no separate "range mode" button (confirmed in chat: real haidh is
// never realistically a single isolated day). Tap 1 = pending start, tap
// 2 = pending end (can be the same day again, for a 1-day range) —
// nothing is written until the confirm bar's button is pressed.
// No minimum range length is enforced; only the existing duration/gap
// caps (POST /attendance/mark-range, server-side, whole range validated
// before anything is written — an invalid range rejects entirely, no
// partial marks). Tapping an already-confirmed/planned day OUTSIDE of an
// active pending selection still clears just that one day directly,
// unchanged from before — continuity with the original "tap a marked
// day to clear it" behavior, which only ever applied to removing.
//
// V3.40.4: the WHOLE pending range gets ONE uniform status, decided
// once, not a per-date future-vs-past split — confirmed in chat: a
// period starting today and running a few days into the future is
// entirely "confirmed", not "today confirmed, the rest predicted".
// The confirm bar's button reflects which action it's about to take
// (haidhRangeTouchesPastOrToday) before the student commits: "Confirm
// as haidh" if the range touches today or the past (even via an
// adjacent existing mark), "Predict as haidh" if it's entirely future.
// Rejection messages now include an actionable suggestion.
//
// A day carries one of three SAVED states here: unmarked,
// 'predicted-haidh' (lighter shade — a plan, not yet real) or 'haidh'
// (full shade — confirmed/actual), plus a 4th, purely local/unsaved
// state while a range is being built ("selecting"). No deletion of any
// log ever happens here, and nothing on the Sabaq/Sabaq Dhor/Dhor detail
// cards is touched (confirmed in chat) — this screen only ever writes
// to the attendance table.
//
// The 10/15-day caps are enforced server-side (worker/src/
// attendance.js, shared/haidhRules.js) — this screen just surfaces
// whatever error message comes back, rather than duplicating the
// run/gap-scanning logic in two places.
// ============================================================

// V3.76.0 (Phase 2): the screen is SHARED with the maktab, the way the day
// view is (V3.64.0, Option A — reuse, not copy). Opened from the summary's
// haidh icon under a maktab log context, it shows that student's calendar
// and writes through the teacher-gated *For endpoints; opened from the nav
// it is the student's own, exactly as before. Every read and write goes
// through haidhCalClient() below — the ONE place the mode is consulted, so
// no call site can forget it. The rules are the worker's either way (run
// cap, 14-day gap, whole range rejected on failure).

let haidhCalViewYear = null;
let haidhCalViewMonth = null; // 0-indexed, matches JS Date
let haidhCalAttendance = {};  // date (YYYY-MM-DD) -> 'haidh' | 'predicted-haidh'
let haidhRangeStart = null;   // pending range being built, not yet saved
let haidhRangeEnd = null;

function haidhTodayISO(){
  // V3.78.0: the maktab's day when the timezone is set (everyone sees
  // maktab time). The old toISOString() was UTC — the very date-shift
  // class the shared timezone exists to end.
  if(typeof appTodayISO === 'function') return appTodayISO();
  return new Date().toISOString().slice(0,10);
}

// V3.76.0: the calendar's three touches on the attendance table, routed by
// log context — mirrors logClient() in js/logContext.js.
function haidhCalClient(){
  if(typeof logCtxIsMaktab === 'function' && logCtxIsMaktab()){
    const id = logCtxStudentId();
    return {
      get:       ()           => apiGetAttendanceFor(id),
      clear:     (date)       => apiClearAttendanceFor(id, date),
      markRange: (start, end, opts) => apiMarkHaidhRangeFor(id, start, end, opts),   // opts: V3.76.2 teacher decision
    };
  }
  return {
    get:       ()           => apiGetAttendance(),
    clear:     (date)       => apiDeleteAttendance(date),
    markRange: (start, end) => apiMarkHaidhRange(start, end),   // the student's own: no decision, the rules stand
  };
}

// V3.76.2: the teacher's decision bar. Shown ONLY in maktab mode, ONLY on a
// gap refusal (the worker says which rule refused via e.code — no prose
// matching). It replaces the confirm bar in place, over the still-pending
// selection, and offers the old confirm's two outcomes plus the way back:
//   Mark as haidh anyway → resubmit with override_gap (worker skips the gap
//                          rule only; the run cap still refuses)
//   Mark absent          → the range written as 'absent' (what the old
//                          Cancel did)
//   Adjust dates         → back to the confirm bar, selection kept
// Never a browser confirm(): it cannot offer three, cannot be styled, and on
// a phone it covers the dates being decided about.
function haidhShowDecision(message){
  document.getElementById('haidhRangeBar').classList.add('hidden');
  const bar = document.getElementById('haidhRangeDecision');
  document.getElementById('haidhRangeDecisionText').textContent = message;
  bar.classList.remove('hidden');
}
function haidhHideDecision(){
  document.getElementById('haidhRangeDecision').classList.add('hidden');
}
async function haidhDecide(opts){
  const bounds = haidhPendingRangeBounds();
  if(!bounds) return;
  const errEl = document.getElementById('haidhCalError');
  errEl.textContent = '';
  try{
    await haidhCalClient().markRange(bounds[0], bounds[1], opts);
    haidhHideDecision();
    haidhClearPendingRange();
    await loadHaidhCalAttendance();
    renderHaidhCalGrid();
  } catch(e){
    // A second refusal (e.g. the run cap on "haidh anyway") is shown as the
    // plain error, with the selection kept, as everywhere else.
    haidhHideDecision();
    renderHaidhRangeBar();
    errEl.textContent = e.message;
  }
}

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
  const data = await haidhCalClient().get();   // V3.76.0: routed by context
  haidhCalAttendance = {};
  (data || []).forEach(row => {
    if(row.status === 'haidh' || row.status === 'predicted-haidh') haidhCalAttendance[row.date] = row.status;
  });
}

function haidhPendingRangeBounds(){
  // V3.40.5: haidhRangeStart/End are plain YYYY-MM-DD strings, never
  // tied to whichever month is currently displayed (haidhCalViewYear/
  // haidhCalViewMonth) -- confirmed as a requirement in chat: a range
  // must be selectable across a calendar month boundary (tap a day,
  // navigate via prev/next, tap a day in the new month). Verified this
  // already holds throughout the file -- nothing here or in
  // onHaidhCalDayTap/renderHaidhRangeBar/onHaidhRangeConfirm reads the
  // viewed month, so this keeps working as long as that stays true. Any
  // future change that scopes range state to the current month view
  // would break this.
  if(haidhRangeStart == null) return null;
  if(haidhRangeEnd == null) return [haidhRangeStart, haidhRangeStart];
  return haidhRangeStart <= haidhRangeEnd ? [haidhRangeStart, haidhRangeEnd] : [haidhRangeEnd, haidhRangeStart];
}

function haidhCalDayCell(dateISO, inCurrentMonth){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'haidh-cal-day';
  // V3.87.0: the maktab-calendar info rides these day cells too
  if(typeof maktabCalInfoForDate === 'function'){
    const info = maktabCalInfoForDate(dateISO);
    if(info){
      if(info.islamic) btn.classList.add('mcal-day-islamic');
      if(info.holiday) btn.classList.add('mcal-day-holiday');
      btn.title = info.title;
    }
  }
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

// V3.40.4: mirrors the Worker's own runStart extension
// (shared/haidhRules.js's evaluateHaidhRange) so the confirm button can
// tell the student which action it's about to take before they commit --
// extends the pending range's start backward through any
// immediately-adjacent existing mark, then checks whether that reaches
// today or earlier. haidhAddDaysISO comes from shared/haidhRules.js,
// loaded as a plain global script same as everywhere else it's used.
function haidhRangeTouchesPastOrToday(bounds){
  let runStart = bounds[0];
  while(haidhCalAttendance[haidhAddDaysISO(runStart, -1)]) runStart = haidhAddDaysISO(runStart, -1);
  return runStart <= haidhTodayISO();
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
  // V3.40.4: the whole range gets ONE status -- confirmed if it touches
  // today/the past (even via an adjacent existing mark), predicted if
  // it's entirely future with no such connection -- so the button says
  // which action it's about to take rather than a generic "mark". V3.40.5:
  // an icon alongside the text now too, requested directly ("save and
  // cancel icons") -- reuses the same `save` icon already used for
  // Settings' own Haidh save button, for visual consistency across the
  // feature; innerHTML instead of textContent since it's icon+text now.
  document.getElementById('haidhRangeConfirmBtn').innerHTML =
    iconHtml('save') + '<span>' + (haidhRangeTouchesPastOrToday(bounds) ? 'Confirm as haidh' : 'Predict as haidh') + '</span>';
  bar.classList.remove('hidden');
}

function haidhClearPendingRange(){
  haidhRangeStart = null;
  haidhRangeEnd = null;
  haidhHideDecision();   // V3.76.2: a decision cannot outlive its selection
  renderHaidhRangeBar();
}

async function onHaidhCalDayTap(dateISO){
  const errEl = document.getElementById('haidhCalError');
  errEl.textContent = '';
  haidhHideDecision();   // V3.76.2: tapping a day IS adjusting — the confirm bar comes back below
  const status = haidhCalAttendance[dateISO];

  // Tapping an already-confirmed/planned day OUTSIDE of an active
  // pending selection still clears just that one day directly, exactly
  // as before V3.40.2 — continuity with the original "tap a marked day
  // to clear it" behavior, which only ever applied to removing, never
  // to adding (Claude's own judgment call, not separately asked — see
  // TODO.md).
  if(status && haidhRangeStart == null){
    try{
      await haidhCalClient().clear(dateISO);   // V3.76.0: routed by context
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
    await haidhCalClient().markRange(bounds[0], bounds[1]);   // V3.76.0: routed by context
    haidhClearPendingRange();
    await loadHaidhCalAttendance();
    renderHaidhCalGrid();
  } catch(e){
    // Confirmed in chat: an invalid range is rejected wholesale, nothing
    // partially marked — so there's nothing to reconcile. The pending
    // selection is deliberately kept (not cleared) on failure, so the
    // student can see exactly what was rejected and adjust it directly
    // rather than having to re-select from scratch.
    // V3.76.2: in maktab mode a GAP refusal is the teacher's decision, not
    // a dead end — the decision bar replaces the confirm bar, selection
    // kept. Any other refusal, and every refusal on the student's own
    // calendar, is the plain message as before.
    if(e && e.code === 'haidh_gap' && typeof logCtxIsMaktab === 'function' && logCtxIsMaktab()){
      haidhShowDecision(e.message);
      return;
    }
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

// V3.40.2: range-select confirm bar. V3.40.5: Cancel gets its icon+text
// once here (its label never changes) -- reuses `close`, the same icon
// already used elsewhere for a discard/cancel action (the Dhor timer's
// own Close button).
document.getElementById('haidhRangeCancelBtn').innerHTML = iconHtml('close') + '<span>Cancel</span>';
document.getElementById('haidhRangeCancelBtn').addEventListener('click', () => {
  haidhClearPendingRange();
  renderHaidhCalGrid();
});
document.getElementById('haidhRangeConfirmBtn').addEventListener('click', onHaidhRangeConfirm);

// V3.76.2: the decision bar's three buttons.
document.getElementById('haidhDecisionAdjustBtn').addEventListener('click', () => {
  haidhHideDecision();
  renderHaidhRangeBar();   // the selection is still pending — the confirm bar returns
});
document.getElementById('haidhDecisionAbsentBtn').addEventListener('click', () => haidhDecide({ status: 'absent' }));
document.getElementById('haidhDecisionHaidhBtn').addEventListener('click', () => haidhDecide({ overrideGap: true }));

// ============================================================
// V3.80.0: the ATTENDANCE PAGE. Owns the screen; the haidh calendar
// below it is rendered by renderHaidhDetailScreen, unchanged, inside
// #attHaidhBlock (haa'idah only — the worker says via track_haidh).
//
// Period: the worker decides — custom from/to when applied here, else
// the CURRENT TERM (settings, migration 0025), else the last 4 weeks.
// "Day" = MAKTAB DAY (the user's standing definition); present = a day
// with activity OR haidh.
// ============================================================
function attPageClient(){
  if(typeof logCtxIsMaktab === 'function' && logCtxIsMaktab()){
    const id = logCtxStudentId();
    return (from, to) => apiGetAttendancePageFor(id, from, to);
  }
  return (from, to) => apiGetAttendancePage(from, to);
}
let attCustomPeriod = null;   // { from, to } while the custom option is applied

async function renderAttendancePage(param){
  if(typeof ensureMaktabCalYear === 'function'){
    const y = parseInt(maktabTodayISO().slice(0, 4));
    await Promise.all([ensureMaktabCalYear(String(y)), ensureMaktabCalYear(String(y - 1))]);
  }
  const inMaktab = typeof logCtxIsMaktab === 'function' && logCtxIsMaktab();
  document.getElementById('attendanceHeaderIcon').innerHTML = iconHtml('attendance');
  document.getElementById('attendanceTitle').textContent = inMaktab ? 'Attendance — ' + logCtxStudentName() : 'Attendance';
  // V3.88.0 (user schematic): the haidh card heading carries the name
  const hTitle = document.getElementById('haidhDetailTitle');
  if(hTitle) hTitle.textContent = 'Haidh: ' + (inMaktab ? logCtxStudentName() : (typeof currentUser !== 'undefined' && currentUser && currentUser.name) || '');
  document.getElementById('attError').textContent = '';
  attCustomPeriod = null;   // a fresh visit always starts on the default period
  // (V3.86.0: the inline absent list is gone — nothing to reset here)
  wireAttendancePage();
  await loadAttendancePeriod();

  // the calendar below, for haa'idah only — attHaidhBlock is toggled by
  // loadAttendancePeriod from the worker's track_haidh, and the calendar
  // itself renders exactly as it always has.
  if(!document.getElementById('attHaidhBlock').classList.contains('hidden')){
    await renderHaidhDetailScreen(param);
    await renderAttHaidhRanges();
  }
}

async function loadAttendancePeriod(){
  const errEl = document.getElementById('attError');
  errEl.textContent = '';
  let d;
  try{
    d = await attPageClient()(attCustomPeriod && attCustomPeriod.from, attCustomPeriod && attCustomPeriod.to);
  } catch(e){
    errEl.textContent = e.message;
    return;
  }
  attPageData = d;
  // V3.88.0 (user schematic): the heading names the period kind and the
  // stats read as ONE sentence — "Present on X of Y maktab days : Z%".
  // The V3.85.0 empty-period explanation stays, in the same slot.
  document.getElementById('attCardTitle').textContent =
    d.source === 'term' ? 'Attendance this Term' : 'Attendance';
  document.getElementById('attSentence').textContent = d.maktab_days
    ? `Present on ${d.present_days} of ${d.maktab_days} maktab days : ${d.percent}%`
    : `No maktab days in this period (fewer than ${d.maktab_day_min || '?'} students logged per day).`;
  const label = d.source === 'term' ? ' (current term)' : d.source === '4w' ? ' (last 4 weeks)' : ' (custom)';
  const fD = typeof fmtDMY === 'function' ? fmtDMY : (x) => x;   // V3.88.0: dd-mmm-yy for prose
  document.getElementById('attPeriod').textContent = `${fD(d.from)} \u2013 ${fD(d.to)}${label}`;
  document.getElementById('attFrom').value = d.from;
  document.getElementById('attTo').value = d.to;
  document.getElementById('attReset').classList.toggle('hidden', d.source !== 'custom');
  // V3.86.0 (user): the absent list lives in a POPUP behind a small
  // green history-style button now; the inline toggle list is gone.
  document.getElementById('attAbsentBtn').textContent = `Absent days (${d.absent_dates.length})`;
  document.getElementById('attHaidhBlock').classList.toggle('hidden', !d.track_haidh);
}
let attPageData = null;

// V3.86.0: one shared list popup for the two attendance buttons — the
// same modal pattern the History rail uses, read-only.
function attListPopup(title, lines){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay history-popup-modal';
  overlay.innerHTML = `<div class="modal-card">
    <button type="button" class="close-btn" id="attPopupCloseBtn">&times;</button>
    <h2>${title}</h2>
    <div class="history-full-list">
      ${lines.map(l => `<div class="history-entry-row"><div class="history-entry-content"><div class="rail-card-date">${l}</div></div></div>`).join('') || '<div class="form-hint">Nothing here.</div>'}
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if(e.target === overlay) overlay.remove(); });
  document.getElementById('attPopupCloseBtn').addEventListener('click', () => overlay.remove());
}

// V3.86.0 (user): the last 3 periods sit behind a HAIDH HISTORY button
// (history style); the button hides when there are no confirmed runs.
async function renderAttHaidhRanges(){
  const btn = document.getElementById('attHaidhHistoryBtn');
  const ranges = (attPageData && attPageData.haidh_ranges) || [];
  btn.classList.toggle('hidden', !ranges.length);
}

let attPageWired = false;
function wireAttendancePage(){
  if(attPageWired) return;
  attPageWired = true;
  document.getElementById('attApply').addEventListener('click', async () => {
    const from = document.getElementById('attFrom').value;
    const to = document.getElementById('attTo').value;
    const errEl = document.getElementById('attError');
    if(!from || !to){ errEl.textContent = 'Pick both dates.'; return; }
    if(from > to){ errEl.textContent = 'From must not be after to.'; return; }
    attCustomPeriod = { from, to };
    await loadAttendancePeriod();
  });
  document.getElementById('attReset').addEventListener('click', async () => {
    attCustomPeriod = null;
    await loadAttendancePeriod();
  });
  document.getElementById('attAbsentBtn').addEventListener('click', () => {
    const dates = (attPageData && attPageData.absent_dates) || [];
    attListPopup('Absent days', dates.length ? dates.map(d => (typeof fmtDMY === 'function' ? fmtDMY(d) : d)) : ['No absent days in this period.']);
  });
  document.getElementById('attHaidhHistoryBtn').addEventListener('click', () => {
    const ranges = (attPageData && attPageData.haidh_ranges) || [];
    attListPopup('Last haidh', ranges.map(r => { const f = typeof fmtDMY === 'function' ? fmtDMY : (x) => x; return r.from === r.to ? f(r.from) : `${f(r.from)} \u2013 ${f(r.to)}`; }));
  });
}

async function renderHaidhDetailScreen(param){
  document.getElementById('haidhDetailHeaderIcon').innerHTML = iconHtml('haidh');
  document.getElementById('haidhCalError').textContent = '';
  // V3.40.2: a pending, unsaved selection from a previous visit to this
  // screen shouldn't carry over silently.
  haidhClearPendingRange();
  // V3.76.0: param is either the PJ's jump date (a string, as before) or
  // the maktab opener's { maktab: true, date } — see openMaktabHaidhCalendar
  // in js/maktabDay.js. The heading carries the student's name in maktab
  // mode, since the calendar is hers, not the teacher's; and reverts to the
  // plain "Haidh" on the next PJ visit so nothing leaks between modes.
  const inMaktab = typeof logCtxIsMaktab === 'function' && logCtxIsMaktab();
  const titleEl = document.getElementById('haidhDetailTitle');
  if(titleEl) titleEl.textContent = inMaktab ? 'Haidh — ' + logCtxStudentName() : 'Haidh';
  const rawDate = (param && typeof param === 'object') ? param.date : param;
  const jumpDate = (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) ? rawDate : haidhTodayISO();
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
