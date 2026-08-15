import { insertLog, updateLog, deleteLog, getLogs, linkPlanIfProvided } from './logHelpers.js';
import { isValidDate, isTeacherOrAbove } from './utils.js';

const TABLE = 'sabaq_dhor_log';
const FIELDS = ['zone', 'tajweed_tags', 'mistakes', 'from_surah', 'from_ayah', 'to_surah', 'to_ayah'];
// V3.51.0 (confirmed in chat): 'date' is editable on update only -- a
// separate whitelist, NOT added to FIELDS, which insertLog consumes
// positionally (the V3.44.1 reflections.js lesson).
const UPDATE_FIELDS = [...FIELDS, 'date'];

function validateBody(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (!isValidDate(body.date)) return 'date must be YYYY-MM-DD';
  return null;
}

export async function handleGetSabaqDhor(request, env, auth) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id') || auth.id;
  if (!isTeacherOrAbove(auth) && studentId !== auth.id) return { error: 'Not authorized', status: 403 };
  return await getLogs(env, TABLE, studentId, url.searchParams.get('since'), auth.id, true);
}

// from_surah/from_ayah/to_surah/to_ayah are computed client-side (V3.13.0,
// from the study-order/position model, see js/position.js) from whichever
// checkable quarter-sections the student marked done, then sent as plain
// integers -- the Worker just stores them, doesn't compute them. `zone`
// is left in the payload shape for backward compatibility but is no
// longer populated by the frontend going forward.
export async function handleSaveSabaqDhor(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  const err = validateBody(body);
  if (err) return { error: err, status: 400 };

  const studentId = isTeacherOrAbove(auth) && body.student_id ? body.student_id : auth.id;
  const values = [
    body.zone ?? null, body.tajweed_tags ?? null, body.mistakes ?? null,
    body.from_surah ?? null, body.from_ayah ?? null, body.to_surah ?? null, body.to_ayah ?? null
  ];
  const result = await insertLog(env, TABLE, studentId, body.date, auth.id, FIELDS, values, body.force);

  // V3.45.15: guarded on result.id -- see sabaqLog.js's own identical
  // comment for the full reasoning (a duplicate found with body.force
  // not set means insertLog returned early, nothing to link/mark
  // attendance for yet).
  if (result.id) {
    if (body.plan_id) await linkPlanIfProvided(env, body.plan_id, studentId, result.id);

    // V3.56.0: fresh-save note fix -- see sabaqLog.js's identical block
    // for the full reasoning (why NOT via FIELDS).
    if (body.student_comment != null && body.student_comment !== '') {
      await updateLog(env, TABLE, result.id, studentId, {
        student_comment: body.student_comment,
        student_comment_private: body.student_comment_private ?? false,
      }, auth.id, UPDATE_FIELDS);
    }

    // Sabaq Dhor also counts as recorded activity for attendance — same rule
    // as Sabaq and Dhor (see SCHEMA.md / the original attendance decision).
    await env.DB.prepare(
      `INSERT INTO attendance (student_id, date, status) VALUES (?, ?, 'present')
       ON CONFLICT(student_id, date) DO UPDATE SET status = 'present'`
    ).bind(studentId, body.date).run();
  }

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
  return await updateLog(env, TABLE, id, auth.id, updates, auth.id, UPDATE_FIELDS, true);
}

export async function handleDeleteSabaqDhor(request, env, auth) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return { error: 'id query param is required', status: 400 };
  return await deleteLog(env, TABLE, id, auth.id, true);
}
