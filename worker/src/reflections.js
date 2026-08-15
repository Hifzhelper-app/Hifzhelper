import { updateLog, deleteLog, getLogs } from './logHelpers.js';
import { isValidDate, isTeacherOrAbove } from './utils.js';

const TABLE = 'reflections';
const FIELDS = ['reflection', 'is_private'];
// V3.51.2 (confirmed in chat): restores V3.44.1's separate update
// whitelist, clobbered by a later delivery's copy of this file --
// without it, backdating an existing reflection silently dropped the
// date change (updateLog discards non-whitelisted fields).
const UPDATE_FIELDS = [...FIELDS, 'date'];

function validateBody(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (!isValidDate(body.date)) return 'date must be YYYY-MM-DD';
  return null;
}

export async function handleGetReflections(request, env, auth) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id') || auth.id;
  if (!isTeacherOrAbove(auth) && studentId !== auth.id) return { error: 'Not authorized', status: 403 };
  // hasFeedback=false — reflections use is_private, not teacher_feedback_visibility
  return await getLogs(env, TABLE, studentId, url.searchParams.get('since'), auth.id, false);
}

// Reflections don't mark attendance present — tadabbur is a personal
// reflection, not one of the three activity logs the attendance rule
// covers (sabaq/sabaq dhor/dhor).
export async function handleSaveReflection(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  const err = validateBody(body);
  if (err) return { error: err, status: 400 };

  const studentId = isTeacherOrAbove(auth) && body.student_id ? body.student_id : auth.id;
  // V3.51.2 (confirmed in chat): direct INSERT, no longer via the shared
  // insertLog -- that helper unconditionally writes is_duplicate, a
  // column the 3 activity logs have and reflections never did, so EVERY
  // reflection insert has 500'd since the V3.45.15 insertLog rewrite
  // (whose simulation covered only the 3 logs). Root-caused by running
  // this real handler against the real schema in a simulated D1.
  // Deliberately not "fixed" by adding the column: reflections has no
  // duplicate concept by design (one per day, the frontend updates in
  // place), so borrowing the activity-log inserter was always a
  // category mismatch.
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    'INSERT INTO reflections (student_id, date, entered_by, reflection, is_private, created_at) VALUES (?,?,?,?,?,?)'
  ).bind(studentId, body.date, auth.id, body.reflection ?? null, body.is_private ? 1 : 0, now).run();
  return { data: { id: result.meta.last_row_id } };
}

// PATCH /reflections — body: { id, reflection } and/or { id, is_private }.
export async function handleUpdateReflection(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  if (!body.id) return { error: 'id is required', status: 400 };
  const { id, ...updates } = body;
  if (updates.is_private != null) updates.is_private = updates.is_private ? 1 : 0;
  return await updateLog(env, TABLE, id, auth.id, updates, auth.id, UPDATE_FIELDS);
}

export async function handleDeleteReflection(request, env, auth) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return { error: 'id query param is required', status: 400 };
  return await deleteLog(env, TABLE, id, auth.id);
}
