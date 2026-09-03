/* Hifzhelper build 4.2.14 | worker/src/attendance.js */
import { validateAttendanceBody, isValidDate, isTeacherOrAbove } from './utils.js';
import { haidhOfficialMaxDuration, haidhCodeMaxRunDays, HAIDH_GAP_OFFICIAL, HAIDH_GAP_CODE, evaluateHaidhMark, evaluateHaidhRange, haidhAddDaysISO } from '../../shared/haidhRules.js';
import { maktabTodayISO } from './utils.js';   // V3.78.0: today by the maktab's clock
import { normalizeHaidhTimeline, latestHaidhTerminationBefore } from './haidhTimeline.js';

// V4.2.14 — predictions are plans, never evidence for a confirmed run.
// The old lazy auto-confirm rule has been retired: a predicted day remains
// predicted until an explicit confirmation is stored.
export function haidhEvidenceDates(rows, todayISO) {
  return rows.filter((r) => r.status === 'haidh').map((r) => r.date);
}

async function loadMaktabActivityDates(env, studentId) {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT date FROM (
       SELECT date FROM maktab_sabaq_log WHERE student_id = ?
       UNION ALL SELECT date FROM maktab_sabaq_dhor_log WHERE student_id = ?
       UNION ALL SELECT date FROM maktab_dhor_log WHERE student_id = ?
     ) ORDER BY date`
  ).bind(studentId, studentId, studentId).all();
  return results.map(r => r.date);
}

async function hasMaktabActivityInRange(env, studentId, startDate, endDate) {
  const row = await env.DB.prepare(
    `SELECT date FROM (
       SELECT date FROM maktab_sabaq_log WHERE student_id = ?
       UNION ALL SELECT date FROM maktab_sabaq_dhor_log WHERE student_id = ?
       UNION ALL SELECT date FROM maktab_dhor_log WHERE student_id = ?
     ) WHERE date >= ? AND date <= ? LIMIT 1`
  ).bind(studentId, studentId, studentId, startDate, endDate).first();
  return row && row.date ? row.date : null;
}

async function resetPredictionsFromConfirmedStart(env, studentId, firstConfirmedDate) {
  await env.DB.prepare(
    `DELETE FROM attendance WHERE student_id = ? AND status = 'predicted-haidh'`
  ).bind(studentId).run();

  const student = await env.DB.prepare(
    `SELECT haidh_cycle_length, haidh_period_length, haidh_ruling FROM students WHERE id = ?`
  ).bind(studentId).first();
  const cycleLength = Number(student && student.haidh_cycle_length);
  const requestedPeriod = Number(student && student.haidh_period_length);
  const ruling = (student && student.haidh_ruling) || 'hanafi';
  if (!Number.isInteger(cycleLength) || cycleLength < 1 || !Number.isInteger(requestedPeriod) || requestedPeriod < 1) {
    return [];
  }

  const periodLength = Math.min(requestedPeriod, haidhOfficialMaxDuration(ruling));
  const dates = [];
  for (let cycle = 0; cycle < 4; cycle++) {
    for (let d = 0; d < periodLength; d++) {
      dates.push(haidhAddDaysISO(firstConfirmedDate, cycle * cycleLength + d));
    }
  }
  if (dates.length) {
    await env.DB.batch(dates.map(date => env.DB.prepare(
      `INSERT INTO attendance (student_id, date, status) VALUES (?, ?, 'predicted-haidh')
       ON CONFLICT(student_id, date) DO NOTHING`
    ).bind(studentId, date)));
  }
  await env.DB.prepare(
    `UPDATE students SET haidh_next_expected = ? WHERE id = ?`
  ).bind(haidhAddDaysISO(firstConfirmedDate, cycleLength), studentId).run();
  return dates;
}

async function normalizedExistingTimeline(env, studentId) {
  const [{ results: rows }, activityDates] = await Promise.all([
    env.DB.prepare(`SELECT date, status FROM attendance WHERE student_id = ? ORDER BY date`).bind(studentId).all(),
    loadMaktabActivityDates(env, studentId),
  ]);
  const explicitStops = rows.filter(r => r.status === 'absent' || r.status === 'present').map(r => r.date);
  return normalizeHaidhTimeline(rows, activityDates, explicitStops);
}

// V4.2.11: a teacher/admin confirming a real haidh day is itself enough
// evidence that this student should be treated as female + haa'idha.
// No schema change is needed: gender and track_haidh have existed since
// migration 0004. Predictions do NOT promote — only confirmed haidh.
async function promoteHaaidhaFromTeacherMark(env, auth, studentId) {
  if (!isTeacherOrAbove(auth)) return;
  await env.DB.prepare(
    "UPDATE students SET gender = 'F', track_haidh = 1 WHERE id = ? AND role = 'student'"
  ).bind(studentId).run();
}

// GET /attendance?month=YYYY-MM (or student_id for a teacher)
export async function handleGetAttendance(request, env, auth) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id') || auth.id;
  const month = url.searchParams.get('month'); // YYYY-MM

  if (!isTeacherOrAbove(auth) && studentId !== auth.id) {
    return { error: 'Not authorized to view this student', status: 403 };
  }

  // V4.2.14: normalize against Maktab activity BEFORE month filtering. A
  // stop before the viewed month can invalidate stale marks inside it.
  const [{ results: rawRows }, activityDates] = await Promise.all([
    env.DB.prepare('SELECT date, status FROM attendance WHERE student_id = ? ORDER BY date').bind(studentId).all(),
    loadMaktabActivityDates(env, studentId),
  ]);
  // Stored Present can come from a personal/PJ log path; it is stop evidence
  // too, even though only teacher-confirmed Maktab log dates paint green here.
  const explicitStops = rawRows.filter(r => r.status === 'absent' || r.status === 'present').map(r => r.date);
  const timeline = normalizeHaidhTimeline(rawRows, activityDates, explicitStops);
  const normalizedHaidh = new Map(timeline.rows.filter(r => r.status !== 'activity').map(r => [r.date, r.status]));
  const activitySet = new Set(activityDates);
  const byDate = new Map();

  // Preserve non-Haidh attendance states for older callers, then replace raw
  // Haidh with the normalized truth and finally let activity win.
  for (const row of rawRows) {
    if (row.status === 'haidh' || row.status === 'predicted-haidh') continue;
    byDate.set(row.date, row.status);
  }
  for (const [date, status] of normalizedHaidh) byDate.set(date, status);
  for (const date of activitySet) byDate.set(date, 'activity');

  let results = [...byDate.entries()].sort((a,b) => a[0].localeCompare(b[0])).map(([date,status]) => ({ date, status }));
  if (month && /^\d{4}-\d{2}$/.test(month)) results = results.filter(r => r.date.startsWith(month + '-'));
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

  if (body.status === 'haidh' || body.status === 'predicted-haidh') {
    const activityDate = await hasMaktabActivityInRange(env, studentId, body.date, body.date);
    if (activityDate) return { error: 'Maktab activity is already logged on this date and takes precedence over Haidh.', status: 400, code: 'haidh_activity' };
  }

  let confirmedRunStart = body.date;

  // V3.39: marking a day haidh/predicted-haidh is capped two ways — a
  // continuous run can't exceed the student's ruling's max duration, and
  // a new run can't start until the gap since the last one has passed.
  // "present"/"absent" are never subject to either check.
  if (body.status === 'haidh' || body.status === 'predicted-haidh') {
    const student = await env.DB.prepare('SELECT haidh_ruling FROM students WHERE id = ?').bind(studentId).first();
    const ruling = (student && student.haidh_ruling) || 'hanafi';

    // V4.2.14: validate against the NORMALIZED confirmed history, not raw
    // rows. A stale stored mark after a Maktab return must not resurrect an
    // ended episode or falsely block a later valid period.
    const timeline = await normalizedExistingTimeline(env, studentId);
    const existingDates = timeline.confirmedDates.filter(date => date !== body.date);
    const { runStart, runLength, gapDays } = evaluateHaidhMark(existingDates, body.date);
    confirmedRunStart = runStart;
    if (body.status === 'haidh') {
      const stop = latestHaidhTerminationBefore(timeline, body.date);
      if (stop && haidhDaysBetweenLocal(stop, body.date) - 1 < HAIDH_GAP_CODE) {
        return { error: `${HAIDH_GAP_OFFICIAL} days have not passed since the last Haidh period ended. Please revise your history.`, status: 400, code: 'haidh_gap' };
      }
    }
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

  // V4.2.14: a confirmed mark is Day 1 for predictions. Replace the old
  // prediction set completely and regenerate it from this confirmed anchor.
  let regenerated = [];
  if (body.status === 'haidh') {
    regenerated = await resetPredictionsFromConfirmedStart(env, studentId, confirmedRunStart);
    await promoteHaaidhaFromTeacherMark(env, auth, studentId);
  }

  return { data: { saved: true, regeneratedPredictions: regenerated.length } };
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

  const activityDate = await hasMaktabActivityInRange(env, studentId, startDate, endDate);
  if (activityDate) {
    return { error: `Maktab activity is already logged on ${activityDate} and takes precedence over Haidh.`, status: 400, code: 'haidh_activity' };
  }

  // V4.2.14: purity and run limits are global. The old teacher
  // former teacher gap-bypass escape hatch is intentionally retired. Teachers can still
  // explicitly mark the selected range Absent, but no caller may bypass the
  // 15-day purity rule when writing Haidh.
  const teacherOpts = isTeacherOrAbove(auth);
  const markAbsent = teacherOpts && body.status === 'absent';
  if (markAbsent) {
    const dates = [];
    for (let d = startDate; d <= endDate; d = haidhAddDaysISO(d, 1)) dates.push(d);
    await env.DB.batch(dates.map((date) =>
      env.DB.prepare(
        `INSERT INTO attendance (student_id, date, status) VALUES (?, ?, 'absent')
         ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status`
      ).bind(studentId, date)
    ));
    return { data: { saved: true, count: dates.length, status: 'absent', clearedPredictions: [] } };
  }

  const student = await env.DB.prepare('SELECT haidh_ruling FROM students WHERE id = ?').bind(studentId).first();
  const ruling = (student && student.haidh_ruling) || 'hanafi';

  // V4.2.14: use normalized confirmed history outside the proposed range.
  // Raw marks invalidated by a prior Maktab return are not evidence.
  const todayISO = await maktabTodayISO(env);   // maktab-local clock
  const existingTimeline = await normalizedExistingTimeline(env, studentId);
  const existingDates = existingTimeline.confirmedDates.filter(date => date < startDate || date > endDate);
  const { dates, runStart, runEnd, runLength, gapDays } = evaluateHaidhRange(existingDates, startDate, endDate);
  const stop = latestHaidhTerminationBefore(existingTimeline, startDate);
  if (stop && haidhDaysBetweenLocal(stop, startDate) - 1 < HAIDH_GAP_CODE) {
    return { error: `${HAIDH_GAP_OFFICIAL} days have not passed since the last Haidh period ended. Please revise your history.`, status: 400, code: 'haidh_gap' };
  }
  if (runLength > haidhCodeMaxRunDays(ruling)) {
    return { error: `haidh days cannot exceed ${haidhOfficialMaxDuration(ruling)}. Please revise your history.`, status: 400, code: 'haidh_run' };
  }
  if (gapDays !== null && gapDays < HAIDH_GAP_CODE) {
    return { error: `${HAIDH_GAP_OFFICIAL} days have not passed since the last haidh. Please revise your history.`, status: 400, code: 'haidh_gap' };
  }

  const status = runStart <= todayISO ? 'haidh' : 'predicted-haidh';
  const statements = dates.map((date) =>
    env.DB.prepare(
      `INSERT INTO attendance (student_id, date, status) VALUES (?, ?, ?)
       ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status`
    ).bind(studentId, date, status)
  );
  await env.DB.batch(statements);

  let regenerated = [];
  if (status === 'haidh') {
    regenerated = await resetPredictionsFromConfirmedStart(env, studentId, runStart);
    await promoteHaaidhaFromTeacherMark(env, auth, studentId);
  }

  return { data: { saved: true, count: dates.length, status, regeneratedPredictions: regenerated.length } };
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

// POST /attendance/predict — replace the student's prediction set from Setup.
// Existing factual rows still win because each regenerated prediction uses DO NOTHING.
// V4.2.14: legacy profiles may still carry a pre-release duration above the
// new global 10-day maximum, so prediction generation clamps defensively even
// though new Setup saves are also validated against shared/haidhRules.js.
export async function handlePredictHaidh(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  const { cycleLength, periodLength, lastStart } = body || {};
  if (!isInt(cycleLength) || !isInt(periodLength) || !isValidDate(lastStart)) {
    return { error: 'cycleLength, periodLength (numbers) and lastStart (YYYY-MM-DD) are required', status: 400 };
  }

  const studentId = auth.id;
  const effectivePeriodLength = Math.min(Number(periodLength), haidhOfficialMaxDuration('hanafi'));
  await env.DB.prepare(`DELETE FROM attendance WHERE student_id = ? AND status = 'predicted-haidh'`).bind(studentId).run();
  const start = new Date(lastStart + 'T00:00:00');
  const inserts = [];
  for (let cycle = 0; cycle < 4; cycle++) {
    for (let d = 0; d < effectivePeriodLength; d++) {
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

function haidhDaysBetweenLocal(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}

function isInt(n) { return Number.isInteger(Number(n)) && Number(n) > 0; }
