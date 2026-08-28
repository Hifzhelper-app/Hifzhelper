import { insertLog, updateLog, deleteLog, getLogs, getMergedLogs, linkPlanIfProvided } from './logHelpers.js';
import { isValidDate, isTeacherOrAbove } from './utils.js';

const TABLE = 'sabaq_log';
// V3.14.0: sabaq_from/sabaq_to replace the old surah/ayah_from/ayah_to
// trio (migration 0015) -- each a combined "surah:ayah" text string,
// letting one entry span multiple surahs directly, which the old single
// surah column (shared by both ayah numbers) couldn't represent.
const FIELDS = ['sabaq_from', 'sabaq_to', 'tajweed_tag_ids', 'line_count', 'page_count'];
// V3.51.0 (confirmed in chat): 'date' is editable on update only -- a
// separate whitelist, NOT added to FIELDS, which insertLog consumes
// positionally (the V3.44.1 reflections.js lesson).
const UPDATE_FIELDS = [...FIELDS, 'date'];

function validateBody(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (!isValidDate(body.date)) return 'date must be YYYY-MM-DD';
  return null;
}

export async function handleGetSabaq(request, env, auth) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id') || auth.id;
  if (!isTeacherOrAbove(auth) && studentId !== auth.id) return { error: 'Not authorized', status: 403 };
  // V3.83.0 (k): HER OWN read is the MERGED journal — PJ + maktab rows,
  // one-way. A named-student read (teacher, three-inputs channel) stays
  // the pure PJ read it always was. See getMergedLogs, logHelpers.js.
  if (studentId === auth.id) return await getMergedLogs(env, TABLE, 'maktab_sabaq_log', studentId, url.searchParams.get('since'), auth.id, true);
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

  const studentId = isTeacherOrAbove(auth) && body.student_id ? body.student_id : auth.id;
  const values = [body.sabaq_from ?? null, body.sabaq_to ?? null, body.tajweed_tag_ids ?? null, body.line_count ?? null, body.page_count ?? null];
  const result = await insertLog(env, TABLE, studentId, body.date, auth.id, FIELDS, values, body.force);

  // V3.45.15: guarded on result.id now -- when insertLog returns early
  // (a duplicate found, body.force not set), there's no row to link a
  // plan against or mark attendance for; both would be acting on an
  // entry that doesn't actually exist yet. Confirming with the student
  // first (the whole point of this feature) happens entirely on the
  // frontend, which re-calls this same endpoint with force:true once
  // they've confirmed -- this function runs again from the top then,
  // this time actually inserting and correctly reaching these steps.
  if (result.id) {
    if (body.plan_id) await linkPlanIfProvided(env, body.plan_id, studentId, result.id);

    // V3.56.0 (2026-08-15, confirmed in chat): the fresh-save path used
    // to DROP notes -- the frontend payload has always carried
    // student_comment + student_comment_private, but nothing here read
    // them (insertLog writes only FIELDS, which rightly excludes them:
    // FIELDS also drives isDuplicate, and identical content with a
    // different note is still the same recitation logged twice).
    // Deliberately NOT fixed by adding them to FIELDS -- written onto
    // the just-inserted row via updateLog's existing student_comment
    // branch instead (text + _by/_at stamps + flag normalization).
    if (body.student_comment != null && body.student_comment !== '') {
      await updateLog(env, TABLE, result.id, studentId, {
        student_comment: body.student_comment,
        student_comment_private: body.student_comment_private ?? false,
      }, auth.id, UPDATE_FIELDS);
    }

    await env.DB.prepare(
      `INSERT INTO attendance (student_id, date, status) VALUES (?, ?, 'present')
       ON CONFLICT(student_id, date) DO UPDATE SET status = 'present'`
    ).bind(studentId, body.date).run();
  }

  return { data: result };
}

// PATCH /sabaq — any subset of sabaq_from/sabaq_to/tajweed_tag_ids,
// student_comment (+ student_comment_private), teacher_feedback
// (+ teacher_feedback_visibility). Corrects a mistake, adds a comment, or
// both. Frontend should confirm before a content edit; not enforced here.
export async function handleUpdateSabaq(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  if (!body.id) return { error: 'id is required', status: 400 };
  const { id, ...updates } = body;
  return await updateLog(env, TABLE, id, auth.id, updates, auth.id, UPDATE_FIELDS, true);
}

export async function handleDeleteSabaq(request, env, auth) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return { error: 'id query param is required', status: 400 };
  return await deleteLog(env, TABLE, id, auth.id, true);
}
