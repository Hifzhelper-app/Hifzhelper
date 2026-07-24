import { insertLog, updateLog, deleteLog, getLogs } from './logHelpers.js';
import { isValidDate } from './utils.js';

const TABLE = 'reflections';
const FIELDS = ['reflection', 'is_private'];

function validateBody(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (!isValidDate(body.date)) return 'date must be YYYY-MM-DD';
  return null;
}

export async function handleGetReflections(request, env, auth) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id') || auth.id;
  if (auth.role !== 'teacher' && studentId !== auth.id) return { error: 'Not authorized', status: 403 };
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

  const studentId = auth.role === 'teacher' && body.student_id ? body.student_id : auth.id;
  const values = [body.reflection ?? null, body.is_private ? 1 : 0];
  const result = await insertLog(env, TABLE, studentId, body.date, auth.id, FIELDS, values);
  return { data: result };
}

// PATCH /reflections — body: { id, reflection } and/or { id, is_private }.
export async function handleUpdateReflection(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  if (!body.id) return { error: 'id is required', status: 400 };
  const { id, ...updates } = body;
  if (updates.is_private != null) updates.is_private = updates.is_private ? 1 : 0;
  return await updateLog(env, TABLE, id, auth.id, updates, auth.id, FIELDS);
}

export async function handleDeleteReflection(request, env, auth) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return { error: 'id query param is required', status: 400 };
  return await deleteLog(env, TABLE, id, auth.id);
}
