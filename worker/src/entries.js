import { validateEntryBody } from './utils.js';

// GET /entries?student_id=X&date=Y or &since=Y
// A teacher can pass any student_id they have access to; a student can only
// ever see their own (enforced below, not just assumed from the frontend).
export async function handleGetEntries(request, env, auth) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id') || auth.id;
  const date = url.searchParams.get('date');
  const since = url.searchParams.get('since');

  if (auth.role !== 'teacher' && studentId !== auth.id) {
    return { error: 'Not authorized to view this student', status: 403 };
  }

  let query = 'SELECT * FROM entries WHERE student_id = ?';
  const params = [studentId];
  if (date) { query += ' AND date = ?'; params.push(date); }
  else if (since) { query += ' AND date >= ?'; params.push(since); }
  query += ' ORDER BY date DESC, entry_number ASC';

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return { data: results };
}

// DELETE /entries?date=YYYY-MM-DD&entry_number=1|2 — a student can only delete their own.
// entry_number defaults to 1 if omitted, for compatibility with anything not yet updated.
export async function handleDeleteEntry(request, env, auth) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const entryNumber = parseInt(url.searchParams.get('entry_number')) || 1;
  if (!date) return { error: 'date query param is required', status: 400 };
  if (![1, 2].includes(entryNumber)) return { error: 'entry_number must be 1 or 2', status: 400 };

  await env.DB.prepare('DELETE FROM entries WHERE student_id = ? AND date = ? AND entry_number = ?')
    .bind(auth.id, date, entryNumber).run();
  return { data: { deleted: true } };
}

// POST /entries — upsert a given date's entry for the logged-in student.
// entry_number (1 or 2) identifies which of up to two entries per day this
// is; defaults to 1 if omitted, so existing single-entry callers still work.
// Attendance is auto-marked "present" here — sabaq always wins, so this
// overrides even a day previously marked haidh.
export async function handleSaveEntry(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }

  const validationError = validateEntryBody(body);
  if (validationError) return { error: validationError, status: 400 };

  const entryNumber = body.entry_number != null ? parseInt(body.entry_number) : 1;
  if (![1, 2].includes(entryNumber)) return { error: 'entry_number must be 1 or 2', status: 400 };

  const studentId = auth.role === 'teacher' && body.student_id ? body.student_id : auth.id;

  const fields = [
    'sabaq_surah','sabaq_ayah_from','sabaq_ayah_to','sabaq_lines','sabaq_quarter','sabaq_tajweed',
    'sabaqdhor_zone','sabaqdhor_tajweed','sabaqdhor_mistakes',
    'dhor_from','dhor_to','dhor_ref','dhor_tajweed','dhor_mistakes','dhor_minutes',
    'reflection','student_comment'
  ];
  // teacher_feedback is deliberately excluded here — students can't set their own
  // feedback; that's a separate, teacher-only endpoint (Phase 2).

  const columns = ['student_id', 'date', 'entry_number', ...fields];
  const placeholders = columns.map(() => '?').join(',');
  const updateClause = fields.map(f => `${f} = excluded.${f}`).join(', ');
  const values = [studentId, body.date, entryNumber, ...fields.map(f => body[f] ?? null)];

  await env.DB.prepare(
    `INSERT INTO entries (${columns.join(',')}) VALUES (${placeholders})
     ON CONFLICT(student_id, date, entry_number) DO UPDATE SET ${updateClause}`
  ).bind(...values).run();

  // Sabaq always wins: any logged entry marks present, unconditionally —
  // including overriding a day previously marked haidh. This applies
  // regardless of which entry_number was just saved — a second sabaq the
  // same day doesn't need to re-confirm attendance, but doing it
  // unconditionally here is simpler than branching, and idempotent either way.
  await env.DB.prepare(
    `INSERT INTO attendance (student_id, date, status) VALUES (?, ?, 'present')
     ON CONFLICT(student_id, date) DO UPDATE SET status = 'present'`
  ).bind(studentId, body.date).run();

  return { data: { saved: true } };
}
