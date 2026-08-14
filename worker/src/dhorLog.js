import { insertLog, updateLog, deleteLog, getLogs, linkPlanIfProvided } from './logHelpers.js';
import { isValidDate, isInRange } from './utils.js';

const TABLE = 'dhor_log';
// duration_seconds (renamed from minutes) + lap_times (JSON array of true
// per-section durations, seconds) — the timer/lap feature. lap_times uses
// the same "variable-length list as one column" pattern as tajweed_tags,
// not numbered columns or a separate table.
const FIELDS = ['segment_from', 'segment_to', 'ref', 'tajweed_tags', 'mistakes', 'duration_seconds', 'lap_times'];
// V3.51.0 (confirmed in chat): 'date' is editable on update only -- a
// separate whitelist, NOT added to FIELDS, which insertLog consumes
// positionally (the V3.44.1 reflections.js lesson).
const UPDATE_FIELDS = [...FIELDS, 'date'];

function validateBody(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (!isValidDate(body.date)) return 'date must be YYYY-MM-DD';
  if (body.ref != null && !['waterval', 'uthmani'].includes(body.ref)) return 'ref must be waterval or uthmani';
  if (body.segment_from != null && !isInRange(body.segment_from, 1, 240)) return 'segment_from out of range';
  if (body.segment_to != null && !isInRange(body.segment_to, 1, 240)) return 'segment_to out of range';
  if (body.lap_times != null) {
    if (!Array.isArray(body.lap_times) || !body.lap_times.every(n => Number.isFinite(n) && n >= 0)) {
      return 'lap_times must be an array of non-negative numbers (seconds)';
    }
  }
  return null;
}

export async function handleGetDhor(request, env, auth) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id') || auth.id;
  if (auth.role !== 'teacher' && studentId !== auth.id) return { error: 'Not authorized', status: 403 };
  const result = await getLogs(env, TABLE, studentId, url.searchParams.get('since'), auth.id, true);
  // lap_times is stored as a JSON string — parse it back for the caller
  if (result.data) {
    for (const row of result.data) {
      if (row.lap_times) { try { row.lap_times = JSON.parse(row.lap_times); } catch (e) { row.lap_times = null; } }
    }
  }
  return result;
}

// Dhor keeps its own quarter-granularity input (segment_from/to + ref) —
// it does not use the flexible ayah/page/surah system sabaq_log uses.
export async function handleSaveDhor(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  const err = validateBody(body);
  if (err) return { error: err, status: 400 };

  const studentId = auth.role === 'teacher' && body.student_id ? body.student_id : auth.id;
  const values = [
    body.segment_from ?? null, body.segment_to ?? null, body.ref ?? null,
    body.tajweed_tags ?? null, body.mistakes ?? null,
    body.duration_seconds ?? null,
    body.lap_times != null ? JSON.stringify(body.lap_times) : null
  ];
  const result = await insertLog(env, TABLE, studentId, body.date, auth.id, FIELDS, values, body.force);

  // V3.45.15: guarded on result.id -- see sabaqLog.js's own identical
  // comment for the full reasoning (a duplicate found with body.force
  // not set means insertLog returned early, nothing to link/mark
  // attendance for yet).
  if (result.id) {
    if (body.plan_id) await linkPlanIfProvided(env, body.plan_id, studentId, result.id);

    await env.DB.prepare(
      `INSERT INTO attendance (student_id, date, status) VALUES (?, ?, 'present')
       ON CONFLICT(student_id, date) DO UPDATE SET status = 'present'`
    ).bind(studentId, body.date).run();
  }

  return { data: result };
}

export async function handleUpdateDhor(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  if (!body.id) return { error: 'id is required', status: 400 };
  if (body.ref != null && !['waterval', 'uthmani'].includes(body.ref)) return { error: 'ref must be waterval or uthmani', status: 400 };
  if (body.lap_times != null && !Array.isArray(body.lap_times)) return { error: 'lap_times must be an array', status: 400 };
  const { id, ...updates } = body;
  if (updates.lap_times != null) updates.lap_times = JSON.stringify(updates.lap_times);
  return await updateLog(env, TABLE, id, auth.id, updates, auth.id, UPDATE_FIELDS);
}

export async function handleDeleteDhor(request, env, auth) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return { error: 'id query param is required', status: 400 };
  return await deleteLog(env, TABLE, id, auth.id);
}
