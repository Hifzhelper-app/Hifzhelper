import { isValidDate, isInRange } from './utils.js';

// Plans are simpler than the four logs — no duplicate detection, no
// comment/feedback layer, no privacy (a plan is just an intention, made by
// the student or a teacher for them). Kept as its own small module rather
// than squeezed through logHelpers.js, since its shape genuinely differs
// (status/completed_log_id have no equivalent in the logs).

function validateBody(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (!isValidDate(body.target_date)) return 'target_date must be YYYY-MM-DD';
  if (!['dhor', 'sabaq', 'sabaq_dhor'].includes(body.plan_type)) return 'plan_type must be dhor, sabaq, or sabaq_dhor';
  if (body.ref != null && !['waterval', 'uthmani'].includes(body.ref)) return 'ref must be waterval or uthmani';
  if (body.surah != null && !isInRange(body.surah, 1, 114)) return 'surah out of range';
  return null;
}

// GET /plans?date=X (plans for one specific day — the primary use case:
// "what's planned for today, to show as the default Dhor input") or
// ?since=X (a range, for a planning/calendar view) or neither (all plans).
export async function handleGetPlans(request, env, auth) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id') || auth.id;
  if (auth.role !== 'teacher' && studentId !== auth.id) return { error: 'Not authorized', status: 403 };

  const date = url.searchParams.get('date');
  const since = url.searchParams.get('since');
  let query = 'SELECT * FROM plans WHERE student_id = ?';
  const params = [studentId];
  if (date) { query += ' AND target_date = ?'; params.push(date); }
  else if (since) { query += ' AND target_date >= ?'; params.push(since); }
  query += ' ORDER BY target_date, created_at';

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return { data: results };
}

export async function handleCreatePlan(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  const err = validateBody(body);
  if (err) return { error: err, status: 400 };

  const studentId = auth.role === 'teacher' && body.student_id ? body.student_id : auth.id;
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `INSERT INTO plans (student_id, entered_by, plan_type, target_date, segment_from, segment_to, ref,
       surah, ayah_from, ayah_to, notes, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planned', ?)`
  ).bind(
    studentId, auth.id, body.plan_type, body.target_date,
    body.segment_from ?? null, body.segment_to ?? null, body.ref ?? null,
    body.surah ?? null, body.ayah_from ?? null, body.ayah_to ?? null,
    body.notes ?? null, now
  ).run();

  return { data: { id: result.meta.last_row_id } };
}

// PATCH /plans — body: { id, ...any field }. Covers both the quick-checkbox
// path ({id, status: 'completed'}, no log created) and general edits
// (change target_date, notes, etc.) — the two aren't different endpoints,
// just different fields in the same partial update.
export async function handleUpdatePlan(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  if (!body.id) return { error: 'id is required', status: 400 };

  const row = await env.DB.prepare('SELECT student_id FROM plans WHERE id = ?').bind(body.id).first();
  if (!row) return { error: 'Not found', status: 404 };
  if (row.student_id !== auth.id && auth.role !== 'teacher') return { error: 'Not authorized', status: 403 };

  const allowedFields = ['target_date', 'segment_from', 'segment_to', 'ref', 'surah', 'ayah_from', 'ayah_to', 'notes', 'status'];
  const setClauses = [];
  const values = [];
  for (const [field, value] of Object.entries(body)) {
    if (field === 'id') continue;
    if (!allowedFields.includes(field)) continue;
    setClauses.push(`${field} = ?`);
    values.push(value);
  }
  if (body.status === 'completed' && !body.completed_at) {
    setClauses.push('completed_at = ?');
    values.push(new Date().toISOString());
  }
  if (setClauses.length === 0) return { error: 'No valid fields to update', status: 400 };
  values.push(body.id);
  await env.DB.prepare(`UPDATE plans SET ${setClauses.join(', ')} WHERE id = ?`).bind(...values).run();
  return { data: { saved: true } };
}

export async function handleDeletePlan(request, env, auth) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return { error: 'id query param is required', status: 400 };
  const row = await env.DB.prepare('SELECT student_id FROM plans WHERE id = ?').bind(id).first();
  if (!row) return { error: 'Not found', status: 404 };
  if (row.student_id !== auth.id) return { error: 'Not authorized', status: 403 };
  await env.DB.prepare('DELETE FROM plans WHERE id = ?').bind(id).run();
  return { data: { deleted: true } };
}
