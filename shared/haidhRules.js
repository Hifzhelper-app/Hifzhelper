// ============================================================
// Hifzhelper — Haidh validation rules (V3.39)
// Works as a plain global-scope script in the browser (file:// safe — no
// ES module CORS restrictions) AND as a CommonJS module for the Worker
// (wrangler/esbuild supports require()) — same dual-loading pattern as
// shared/data.js, for the same reason (CONVENTIONS.md principle 2):
// Setup's client-side validation (js/settingsScreen.js) and the
// server-side validation (worker/src/profile.js, worker/src/
// attendance.js) must use the exact same numbers, not two copies that
// can silently drift apart.
//
// Two numbers per limit, confirmed in chat:
//  - the OFFICIAL number: what's shown to the student (labels, error
//    messages) — the actual fiqh-meaningful figure.
//  - the CODE number: what's actually enforced, adjusted by 1 calendar
//    day to accommodate a haidh episode starting or ending mid-day (a
//    clinically-N-day haidh can legitimately touch N+1 calendar dates,
//    since the partial first/last days each still need their own marked
//    date). The student never sees this adjustment.
// ============================================================

const HAIDH_OFFICIAL_MAX_DURATION = { hanafi: 10, shafii: 15 };
const HAIDH_GAP_OFFICIAL = 15; // shown to the student; fixed regardless of ruling
const HAIDH_GAP_CODE = 14;     // actually enforced (HAIDH_GAP_OFFICIAL - 1)

function haidhOfficialMaxDuration(ruling) {
  return HAIDH_OFFICIAL_MAX_DURATION[ruling] || HAIDH_OFFICIAL_MAX_DURATION.hanafi;
}
function haidhCodeMaxRunDays(ruling) {
  return haidhOfficialMaxDuration(ruling) + 1;
}

// Setup's "Haidh cycle frequency" real minimum isn't a flat number — it's
// whatever guarantees a genuine HAIDH_GAP_OFFICIAL-day gap after a period
// of the student's own chosen duration. Cycle length itself stays the
// clinically-standard start-to-start definition (confirmed in chat), so
// this is the derived floor on it, not a redefinition of what it means.
function haidhMinCycleFrequency(periodLength) {
  return (periodLength || 0) + HAIDH_GAP_OFFICIAL;
}

function haidhAddDaysISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function haidhDaysBetween(aISO, bISO) {
  return Math.round((new Date(bISO + 'T00:00:00') - new Date(aISO + 'T00:00:00')) / 86400000);
}

// Given the student's OTHER existing haidh/predicted-haidh dates
// (YYYY-MM-DD strings, any order, not including candidateDate) and the
// date being marked, works out:
//  - runLength: how many contiguous calendar days the resulting run
//    would span, including candidateDate itself
//  - gapDays: the shortest gap (in non-haidh calendar days) to the
//    nearest OTHER run, only when candidateDate starts a genuinely new
//    run (doesn't touch an already-marked neighboring day) — null when
//    candidateDate is extending an existing run, since the gap rule
//    doesn't apply there.
// Pure date-math, no DB/network access — callers fetch the relevant
// dates first (frontend: apiGetAttendance; backend: a D1 SELECT).
function evaluateHaidhMark(existingDates, candidateDate) {
  const existing = new Set(existingDates);
  const touches = (d) => existing.has(d) || d === candidateDate;

  let runStart = candidateDate, runEnd = candidateDate;
  while (touches(haidhAddDaysISO(runStart, -1))) runStart = haidhAddDaysISO(runStart, -1);
  while (touches(haidhAddDaysISO(runEnd, 1))) runEnd = haidhAddDaysISO(runEnd, 1);
  const runLength = haidhDaysBetween(runStart, runEnd) + 1;

  const isNewRun = !existing.has(haidhAddDaysISO(candidateDate, -1)) && !existing.has(haidhAddDaysISO(candidateDate, 1));
  let gapDays = null;
  if (isNewRun) {
    for (const d of existing) {
      if (d >= runStart && d <= runEnd) continue; // ignore the (empty) run candidateDate itself is forming
      const gap = Math.abs(haidhDaysBetween(candidateDate, d)) - 1;
      if (gapDays === null || gap < gapDays) gapDays = gap;
    }
  }
  return { runLength, gapDays };
}

// V3.40.3 bug fix: rewritten to evaluate the WHOLE proposed range as one
// unit, not per-date incremental steps. The original version simulated
// adding each date in chronological order, checking the gap rule against
// only what had been added SO FAR -- so a range directly adjacent to (or
// overlapping) an existing haidh/predicted-haidh block got wrongly
// rejected, because the first date checked hadn't "seen" the rest of its
// own range yet (confirmed live: re-tapping 08-08..08-10 next to an
// already-marked 08-11/08-12 wrongly failed with "15 days have not
// passed"). This version extends the run outward from the range's own
// start/end using only the TRUE external existing dates, and only
// gap-checks if NEITHER edge of the range touches an existing day --
// re-verified against all original test scenarios plus 3 covering this
// exact bug, 12/12 correct via direct Node execution.
// V3.40.4: also returns runStart -- the caller uses it to decide whether
// the WHOLE range is "confirmed" (touches today or the past, even via an
// adjacent existing run) or "predicted" (entirely future, no connection
// to today) as ONE uniform status, rather than the old per-date
// future-vs-past split.
function evaluateHaidhRange(existingDates, startDate, endDate) {
  const existing = new Set(existingDates);
  let runStart = startDate, runEnd = endDate;
  while (existing.has(haidhAddDaysISO(runStart, -1))) runStart = haidhAddDaysISO(runStart, -1);
  while (existing.has(haidhAddDaysISO(runEnd, 1))) runEnd = haidhAddDaysISO(runEnd, 1);
  const runLength = haidhDaysBetween(runStart, runEnd) + 1;

  const touchesBefore = existing.has(haidhAddDaysISO(startDate, -1));
  const touchesAfter = existing.has(haidhAddDaysISO(endDate, 1));
  const isNewRun = !touchesBefore && !touchesAfter;
  let gapDays = null;
  if (isNewRun) {
    for (const d of existing) {
      if (d >= runStart && d <= runEnd) continue;
      const gap = d < startDate ? (haidhDaysBetween(d, startDate) - 1) : (haidhDaysBetween(endDate, d) - 1);
      if (gapDays === null || gap < gapDays) gapDays = gap;
    }
  }

  const dates = [];
  for (let d = startDate; d <= endDate; d = haidhAddDaysISO(d, 1)) dates.push(d);

  return { dates, runStart, runEnd, runLength, gapDays };   // runEnd added V3.76.1 (the superseded-prediction window starts after it)
}

// Works as a plain global-scope script in the browser (file:// safe — no ES module
// CORS restrictions) AND as a CommonJS module for the Worker (wrangler/esbuild
// supports require()). Nothing above this line needs to change either way.
if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    HAIDH_OFFICIAL_MAX_DURATION, HAIDH_GAP_OFFICIAL, HAIDH_GAP_CODE,
    haidhOfficialMaxDuration, haidhCodeMaxRunDays, haidhMinCycleFrequency, evaluateHaidhMark,
    evaluateHaidhRange, haidhAddDaysISO
  };
}
