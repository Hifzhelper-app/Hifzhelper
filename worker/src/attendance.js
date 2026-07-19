import { validateAttendanceBody, isValidDate } from './utils.js';

// GET /attendance?month=YYYY-MM (or student_id for a teacher)
export async function handleGetAttendance(request, env, auth) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id') || auth.id;
  const month = url.searchParams.get('month'); // YYYY-MM

  if (auth.role !== 'teacher' && studentId !== auth.id) {
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

  const studentId = auth.role === 'teacher' && body.student_id ? body.student_id : auth.id;

  await env.DB.prepare(
    `INSERT INTO attendance (student_id, date, status) VALUES (?, ?, ?)
     ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status`
  ).bind(studentId, body.date, body.status).run();

  return { data: { saved: true } };
}

// DELETE /attendance?date=YYYY-MM-DD — clears a day back to "unset".
export async function handleDeleteAttendance(request, env, auth) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (!isValidDate(date)) return { error: 'date query param (YYYY-MM-DD) is required', status: 400 };

  const studentId = auth.id;
  await env.DB.prepare('DELETE FROM attendance WHERE student_id = ? AND date = ?').bind(studentId, date).run();
  return { data: { deleted: true } };
}

// POST /attendance/predict — bulk-insert "predicted-haidh" rows, never overwriting
// anything already set (a real recorded day always wins over a prediction).
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
