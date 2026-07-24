import { insertLog, updateLog, deleteLog, getLogs, linkPlanIfProvided } from './logHelpers.js';
import { isValidDate } from './utils.js';

const TABLE = 'sabaq_dhor_log';
const FIELDS = ['zone', 'tajweed_tags', 'mistakes'];

function validateBody(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (!isValidDate(body.date)) return 'date must be YYYY-MM-DD';
  return null;
}

export async function handleGetSabaqDhor(request, env, auth) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id') || auth.id;
  if (auth.role !== 'teacher' && studentId !== auth.id) return { error: 'Not authorized', status: 403 };
  return await getLogs(env, TABLE, studentId, url.searchParams.get('since'), auth.id, true);
}

// zone is computed client-side (from the study-order/position model) and
// sent as a plain string — the Worker just stores it, doesn't compute it.
export async function handleSaveSabaqDhor(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  const err = validateBody(body);
  if (err) return { error: err, status: 400 };

  const studentId = auth.role === 'teacher' && body.student_id ? body.student_id : auth.id;
  const values = [body.zone ?? null, body.tajweed_tags ?? null, body.mistakes ?? null];
  const result = await insertLog(env, TABLE, studentId, body.date, auth.id, FIELDS, values);

  if (body.plan_id) await linkPlanIfProvided(env, body.plan_id, studentId, result.id);

  // Sabaq Dhor also counts as recorded activity for attendance — same rule
  // as Sabaq and Dhor (see SCHEMA.md / the original attendance decision).
  await env.DB.prepare(
    `INSERT INTO attendance (student_id, date, status) VALUES (?, ?, 'present')
     ON CONFLICT(student_id, date) DO UPDATE SET status = 'present'`
  ).bind(studentId, body.date).run();

  return { data: result };
}

// PATCH /sabaq-dhor — any subset of zone/tajweed_tags/mistakes, and/or
// student_comment (+ student_comment_private), teacher_feedback
// (+ teacher_feedback_visibility).
export async function handleUpdateSabaqDhor(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  if (!body.id) return { error: 'id is required', status: 400 };
  const { id, ...updates } = body;
  return await updateLog(env, TABLE, id, auth.id, updates, auth.id, FIELDS);
}

export async function handleDeleteSabaqDhor(request, env, auth) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return { error: 'id query param is required', status: 400 };
  return await deleteLog(env, TABLE, id, auth.id);
}
