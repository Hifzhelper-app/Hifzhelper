import { insertLog, updateLog, deleteLog, getLogs, linkPlanIfProvided } from './logHelpers.js';
import { isValidDate } from './utils.js';

const TABLE = 'sabaq_log';
// V3.14.0: sabaq_from/sabaq_to replace the old surah/ayah_from/ayah_to
// trio (migration 0015) -- each a combined "surah:ayah" text string,
// letting one entry span multiple surahs directly, which the old single
// surah column (shared by both ayah numbers) couldn't represent.
const FIELDS = ['sabaq_from', 'sabaq_to', 'tajweed_tags', 'line_count', 'page_count'];

function validateBody(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (!isValidDate(body.date)) return 'date must be YYYY-MM-DD';
  return null;
}

export async function handleGetSabaq(request, env, auth) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id') || auth.id;
  if (auth.role !== 'teacher' && studentId !== auth.id) return { error: 'Not authorized', status: 403 };
  return await getLogs(env, TABLE, studentId, url.searchParams.get('since'), auth.id, true);
}

// POST /sabaq — always inserts a new row (V2 has no per-day cap; see logHelpers.js).
// Also marks attendance present, same "sabaq always wins" rule as before.
// Optional plan_id — if this fulfills a planned sabaq, links it back (see
// linkPlanIfProvided; a bad/missing plan_id silently no-ops, never fails the save).
// sabaq_from/sabaq_to validation (per-surah ayah bounds, at-most-one-juz'-
// boundary) happens client-side (shared/data.js) before this is ever
// called — the Worker just stores whatever strings it's given, same
// division of responsibility as segment_from/segment_to elsewhere.
export async function handleSaveSabaq(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  const err = validateBody(body);
  if (err) return { error: err, status: 400 };

  const studentId = auth.role === 'teacher' && body.student_id ? body.student_id : auth.id;
  const values = [body.sabaq_from ?? null, body.sabaq_to ?? null, body.tajweed_tags ?? null, body.line_count ?? null, body.page_count ?? null];
  const result = await insertLog(env, TABLE, studentId, body.date, auth.id, FIELDS, values);

  if (body.plan_id) await linkPlanIfProvided(env, body.plan_id, studentId, result.id);

  await env.DB.prepare(
    `INSERT INTO attendance (student_id, date, status) VALUES (?, ?, 'present')
     ON CONFLICT(student_id, date) DO UPDATE SET status = 'present'`
  ).bind(studentId, body.date).run();

  return { data: result };
}

// PATCH /sabaq — any subset of sabaq_from/sabaq_to/tajweed_tags,
// student_comment (+ student_comment_private), teacher_feedback
// (+ teacher_feedback_visibility). Corrects a mistake, adds a comment, or
// both. Frontend should confirm before a content edit; not enforced here.
export async function handleUpdateSabaq(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  if (!body.id) return { error: 'id is required', status: 400 };
  const { id, ...updates } = body;
  return await updateLog(env, TABLE, id, auth.id, updates, auth.id, FIELDS);
}

export async function handleDeleteSabaq(request, env, auth) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return { error: 'id query param is required', status: 400 };
  return await deleteLog(env, TABLE, id, auth.id);
}
