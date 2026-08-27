import { validateAttendanceBody, isValidDate, isTeacherOrAbove } from './utils.js';
import { haidhOfficialMaxDuration, haidhCodeMaxRunDays, HAIDH_GAP_OFFICIAL, HAIDH_GAP_CODE, evaluateHaidhMark, evaluateHaidhRange, haidhAddDaysISO } from '../../shared/haidhRules.js';

// V3.76.1 — what counts as EVIDENCE for the run and gap checks.
// Bug found on device 2026-08-27: a real range 27–31 Aug was refused with
// "15 days have not passed since the last haidh" although the last real
// haidh was over three weeks back. The blocker was a PREDICTED day on 5 Sep
// — four days AHEAD of the range. Both handlers fed every haidh AND
// predicted-haidh row to the rule, which measures the gap to the nearest
// mark on either side, so a plan sitting in the future vetoed a fact.
//
// A prediction is a plan, not a fact. Rule now: a predicted-haidh row dated
// AFTER today is never evidence. A predicted day at or before today still
// is — the app already treats a passed prediction as real (V3.39's lazy
// auto-confirm; js/haidhDetailScreen.js paints it full shade). Confirmed
// rows always count. The gap rule is unchanged in the other direction: a
// prediction placed too soon after a REAL haidh is still refused.
export function haidhEvidenceDates(rows, todayISO) {
  return rows.filter((r) => r.status === 'haidh' || r.date <= todayISO).map((r) => r.date);
}

// V3.76.1 — after a CONFIRMED mark is written, predictions that can no
// longer be true go. User's call 2026-08-27: "delete predicted rows that
// fall inside the 14-day window after the newly confirmed range, since they
// can no longer be true." Window = the day after the run ends through
// runEnd + HAIDH_GAP_CODE; only 'predicted-haidh' rows, only after today
// (a passed prediction is history, not a plan). Never touches 'haidh'.
async function clearSupersededPredictions(env, studentId, runEndISO, todayISO) {
  const from = haidhAddDaysISO(runEndISO, 1);
  const to = haidhAddDaysISO(runEndISO, HAIDH_GAP_CODE);
  const { results } = await env.DB.prepare(
    `SELECT date FROM attendance WHERE student_id = ? AND status = 'predicted-haidh' AND date >= ? AND date <= ? AND date > ?`
  ).bind(studentId, from, to, todayISO).all();
  const dates = results.map((r) => r.date);
  if (dates.length) {
    await env.DB.batch(dates.map((d) =>
      env.DB.prepare(`DELETE FROM attendance WHERE student_id = ? AND date = ? AND status = 'predicted-haidh'`).bind(studentId, d)
    ));
  }
  return dates;
}

// GET /attendance?month=YYYY-MM (or student_id for a teacher)
export async function handleGetAttendance(request, env, auth) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id') || auth.id;
  const month = url.searchParams.get('month'); // YYYY-MM

  if (!isTeacherOrAbove(auth) && studentId !== auth.id) {
    return { error: 'Not authorized to view this student', status: 403 };
  }

  let query = 'SELECT date, status FROM attendance WHERE student_id = ?';
  const params = [studentId];
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    query += ' AND date LIKE ?';
    params.push(`${month}-%`);
  }
  query += ' ORDER BY date';

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return { data: results };
}

// POST /attendance — mainly for manual haidh marking / predictions.
// "present" is normally set automatically by handleSaveEntry, not through here,
// but a teacher marking a student absent (e.g. missed class) goes through this.
export async function handleSetAttendance(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }

  const validationError = validateAttendanceBody(body);
  if (validationError) return { error: validationError, status: 400 };

  const studentId = isTeacherOrAbove(auth) && body.student_id ? body.student_id : auth.id;

  // V3.39: marking a day haidh/predicted-haidh is capped two ways — a
  // continuous run can't exceed the student's ruling's max duration, and
  // a new run can't start until the gap since the last one has passed.
  // "present"/"absent" are never subject to either check.
  if (body.status === 'haidh' || body.status === 'predicted-haidh') {
    const student = await env.DB.prepare('SELECT haidh_ruling FROM students WHERE id = ?').bind(studentId).first();
    const ruling = (student && student.haidh_ruling) || 'hanafi';

    const { results } = await env.DB.prepare(
      `SELECT date, status FROM attendance WHERE student_id = ? AND status IN ('haidh','predicted-haidh') AND date != ?`
    ).bind(studentId, body.date).all();
    const todayISO = new Date().toISOString().slice(0, 10);
    const existingDates = haidhEvidenceDates(results, todayISO);   // V3.76.1: future predictions are not evidence

    const { runLength, gapDays } = evaluateHaidhMark(existingDates, body.date);
    if (runLength > haidhCodeMaxRunDays(ruling)) {
      return { error: `haidh days cannot exceed ${haidhOfficialMaxDuration(ruling)}. Please revise your history.`, status: 400 };
    }
    if (gapDays !== null && gapDays < HAIDH_GAP_CODE) {
      return { error: `${HAIDH_GAP_OFFICIAL} days have not passed since the last haidh. Please revise your history.`, status: 400 };
    }
  }

  await env.DB.prepare(
    `INSERT INTO attendance (student_id, date, status) VALUES (?, ?, ?)
     ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status`
  ).bind(studentId, body.date, body.status).run();

  // V3.76.1: a CONFIRMED day supersedes predictions in the window after it.
  let cleared = [];
  if (body.status === 'haidh') {
    cleared = await clearSupersededPredictions(env, studentId, body.date, new Date().toISOString().slice(0, 10));
  }

  return { data: { saved: true, clearedPredictions: cleared } };
}

// POST /attendance/mark-range — marks every date from startDate to
// endDate (inclusive) as haidh in one go, from the calendar's
// tap-first/tap-last range-select (V3.40.2, confirmed in chat: no
// separate "range mode" — this replaces the old immediate
// single-tap-toggle for making a NEW mark; tapping a single
// already-confirmed day to CLEAR it still goes through the existing
// DELETE /attendance below, untouched; no minimum range length is
// enforced, only the existing duration/gap caps). The whole range is
// validated BEFORE anything is written (existing dates outside the
// range + every date inside it, evaluated in order via
// evaluateHaidhRange), and written as one atomic D1 batch — confirmed
// in chat: an invalid range rejects entirely, no partial marks.
//
// V3.40.4: the WHOLE range gets ONE uniform status now, not a per-date
// future-vs-past split — confirmed in chat: a period that starts today
// and runs a few days into the future is entirely "confirmed", not
// "today confirmed, the rest predicted", since it's not a guess once
// it's actually started. A range counts as touching today/the past (and
// so becomes 'haidh') if its fully-extended run — including anything it
// connects to via an adjacent existing mark, same runStart
// evaluateHaidhRange already computes for validation — reaches back to
// today or earlier; a range that's entirely future with no such
// connection becomes 'predicted-haidh' instead. Rejection messages now
// include an actionable suggestion rather than just stating the rule.
export async function handleMarkHaidhRange(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  const { startDate, endDate } = body || {};
  if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) {
    return { error: 'startDate and endDate (YYYY-MM-DD, startDate on or before endDate) are required', status: 400 };
  }

  // V3.76.0 (Phase 2): the teacher override handleSetAttendance and
  // handleDeleteAttendance have carried since V3.40.2/V3.63.0 — same
  // one-line shape, same isTeacherOrAbove gate. A student sending
  // student_id is ignored (falls back to her own id), never a wrong-row
  // write. The maktab's haidh calendar marks a RANGE now, as the student's
  // own calendar does, and this was the one attendance route still
  // hard-wired to the caller.
  const bodyStudentId = body && body.student_id;
  const studentId = isTeacherOrAbove(auth) && bodyStudentId ? String(bodyStudentId) : auth.id;
  const student = await env.DB.prepare('SELECT haidh_ruling FROM students WHERE id = ?').bind(studentId).first();
  const ruling = (student && student.haidh_ruling) || 'hanafi';

  // Existing dates OUTSIDE the proposed range only — dates inside it are
  // being freshly set by this call, not "existing" for this check (same
  // exclusion handleSetAttendance does with `date != ?`, generalized to a
  // span).
  const { results } = await env.DB.prepare(
    `SELECT date, status FROM attendance WHERE student_id = ? AND status IN ('haidh','predicted-haidh') AND (date < ? OR date > ?)`
  ).bind(studentId, startDate, endDate).all();
  const todayISO = new Date().toISOString().slice(0, 10);
  const existingDates = haidhEvidenceDates(results, todayISO);   // V3.76.1: future predictions are not evidence

  const { dates, runStart, runEnd, runLength, gapDays } = evaluateHaidhRange(existingDates, startDate, endDate);
  if (runLength > haidhCodeMaxRunDays(ruling)) {
    return { error: `haidh days cannot exceed ${haidhOfficialMaxDuration(ruling)}. Please revise your history.`, status: 400 };
  }
  if (gapDays !== null && gapDays < HAIDH_GAP_CODE) {
    return { error: `${HAIDH_GAP_OFFICIAL} days have not passed since the last haidh. Please revise your history.`, status: 400 };
  }

  const status = runStart <= todayISO ? 'haidh' : 'predicted-haidh';
  const statements = dates.map((date) =>
    env.DB.prepare(
      `INSERT INTO attendance (student_id, date, status) VALUES (?, ?, ?)
       ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status`
    ).bind(studentId, date, status)
  );
  await env.DB.batch(statements);

  // V3.76.1: a CONFIRMED range supersedes predictions in the window after it.
  let cleared = [];
  if (status === 'haidh') cleared = await clearSupersededPredictions(env, studentId, runEnd, todayISO);

  return { data: { saved: true, count: dates.length, status, clearedPredictions: cleared } };
}

// DELETE /attendance?date=YYYY-MM-DD[&student_id=X] — clears a day back
// to "unset".
// V3.63.0: gained the teacher-override that handleSetAttendance has had
// all along (same one-line shape, same isTeacherOrAbove gate) — the
// maktab day view's haidh icon is a TOGGLE, so a teacher clearing a mark
// they can already set needs to reach the student's row. Without this
// the untick silently cleared the TEACHER's own day instead: not a
// permission error, a wrong-row write, which is worse.
export async function handleDeleteAttendance(request, env, auth) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (!isValidDate(date)) return { error: 'date query param (YYYY-MM-DD) is required', status: 400 };

  const bodyStudentId = url.searchParams.get('student_id');
  const studentId = isTeacherOrAbove(auth) && bodyStudentId ? bodyStudentId : auth.id;
  await env.DB.prepare('DELETE FROM attendance WHERE student_id = ? AND date = ?').bind(studentId, date).run();
  return { data: { deleted: true } };
}

// POST /attendance/predict — bulk-insert "predicted-haidh" rows, never overwriting
// anything already set (a real recorded day always wins over a prediction).
// V3.39: no separate cap-checking needed here — cycleLength/periodLength
// are already validated against the student's ruling and the dynamic
// minCycleFrequency floor at Setup-save time (worker/src/profile.js), and
// cycle length stays the clinically-standard start-to-start definition
// (confirmed in chat), so this loop's existing math is unchanged and the
// caps hold by construction.
export async function handlePredictHaidh(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  const { cycleLength, periodLength, lastStart } = body || {};
  if (!isInt(cycleLength) || !isInt(periodLength) || !isValidDate(lastStart)) {
    return { error: 'cycleLength, periodLength (numbers) and lastStart (YYYY-MM-DD) are required', status: 400 };
  }

  const studentId = auth.id;
  const start = new Date(lastStart + 'T00:00:00');
  const inserts = [];
  for (let cycle = 0; cycle < 4; cycle++) {
    for (let d = 0; d < periodLength; d++) {
      const dt = new Date(start);
      dt.setDate(dt.getDate() + cycle * cycleLength + d);
      inserts.push(dt.toISOString().slice(0, 10));
    }
  }

  for (const date of inserts) {
    await env.DB.prepare(
      `INSERT INTO attendance (student_id, date, status) VALUES (?, ?, 'predicted-haidh')
       ON CONFLICT(student_id, date) DO NOTHING`
    ).bind(studentId, date).run();
  }

  return { data: { predicted: inserts.length } };
}

function isInt(n) { return Number.isInteger(Number(n)) && Number(n) > 0; }
