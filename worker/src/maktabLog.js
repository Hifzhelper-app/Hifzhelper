/* Hifzhelper build 4.2.14 | worker/src/maktabLog.js */
// ============================================================
// Hifzhelper -- Maktab log endpoints (V3.58.0, maktab delivery (d)).
// The teacher-confirmed record of a Hifz day, completely independent of
// the PJ logs (see SCHEMA.md's maktab section + TODO.md's design entry).
//
// ONE module for all three tables, not three near-clone files: the PJ
// modules are separate because their field lists/validations differ,
// but the maktab versions share every behaviour per-table via the
// CONFIG map below (CONVENTIONS.md principle 2).
//
// Auth model (confirmed in chat, 2026-08-15):
//   - save/update/delete: teacher or above, always.
//   - save: body.student_id REQUIRED (a teacher logs FOR a student --
//     never defaults to auth.id), and student_id === auth.id is
//     rejected for everyone including admins: another teacher must
//     confirm your own hifz. The rule is about who CONFIRMS -- an auth
//     rule, deliberately not a DB CHECK (see migration 0019's header).
//   - update/delete: ANY teacher (+admin), not just the saving one --
//     teacher_id/teacher_name are provenance (who confirmed), not an
//     ownership lock, and are immutable on edit (not whitelisted).
//   - GET: teacher+ reads anyone's; a student reads their OWN only
//     (the read-only "my maktab journal" view). applyPrivacy rides
//     along via getLogs: with this table's 'teachers_only' default a
//     student sees no teacher notes unless one was explicitly set
//     to 'all'.
//
// Saves are a direct INSERT, not insertLog -- same precedent as
// reflections (V3.51.2): insertLog can't write the two NOT NULL
// provenance columns. Duplicate detection is kept by calling the
// exported isDuplicate on the CONTENT fields only (teacher_id/name
// deliberately excluded: the same recitation confirmed twice is a
// duplicate regardless of which teacher pressed save), with the same
// abortable force flow as the PJ (V3.45.15).
// ============================================================

import { isDuplicate, updateLog, deleteLog, getLogs, applyPrivacy } from './logHelpers.js';
import { isValidDate, isInRange, isTeacherOrAbove } from './utils.js';
import { computeDefaultDhorEntry, mergeDhorUnitsIntoPool } from './dhorSchedule.js';
import { haidhAddDaysISO, haidhCodeMaxRunDays } from '../../shared/haidhRules.js';

// V3.59.0 (maktab delivery (e1)): one round-trip payload for the maktab
// summary screen — the active-student roster PLUS all three tables'
// entries for one date, across all students. Folds the spec's separate
// /maktab/roster endpoint in (documented deviation, same info): a
// roster-only endpoint would force 1 + 3-per-student requests to paint
// the grid; this is one. Roster is id+name ONLY — the admin list stays
// admin-gated because it carries whatsapp numbers etc. that a teacher
// roster shouldn't. applyPrivacy runs per requester exactly as getLogs
// does per-student, so another teacher's 'private' feedback is nulled
// here the same as everywhere else.
async function handleMaktabSummary(request, env, auth) {
  if (!isTeacherOrAbove(auth)) return { error: 'Not authorized', status: 403 };
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  if (!isValidDate(date)) return { error: 'date must be YYYY-MM-DD', status: 400 };

  // V3.60.0 ((e2)): + mushaf — the day view needs the STUDENT's ref
  // (juz'-30 direction, dhor segment naming) and /profile is own-only
  // by design; the teacher-gated roster is the right carrier, one
  // column, no new endpoint. Still no whatsapp/pin — see above.
  // V3.61.0: + track_haidh — haidh controls render ONLY for students
  // who opted in (Settings), same flag that gates the PJ's Haidh nav.
  const students = (await env.DB.prepare(
    // V3.77.0 (j): teaching accounts are rows in this table with no journal
    // — without the role filter every one of them would sit in the summary
    // as a student to be logged against (ADMIN-01 did, with dashes).
    // V3.78.0 (item 8): each student carries her group; ordered by group
    // name (ungrouped LAST — user's call), then by name within a group.
    // The frontend draws a gap where group_name changes.
    `SELECT s.id, s.name, s.mushaf, s.track_haidh, s.group_id, g.name AS group_name
     FROM students s LEFT JOIN maktab_groups g ON g.id = s.group_id
     WHERE s.active = 1 AND s.role = 'student'
     ORDER BY (g.name IS NULL), g.name, s.name`
  ).all()).results;

  async function dayRows(table, cfg) {
    const rows = (await env.DB.prepare(
      `SELECT * FROM ${table} WHERE date = ? ORDER BY created_at DESC`
    ).bind(date).all()).results;
    applyPrivacy(rows, null, auth.id, true); // studentId null => requester is never "owner"; correct: the requester here is always a teacher
    if (cfg && cfg.parseRow) for (const row of rows) cfg.parseRow(row);
    return rows;
  }

  // V4.2.14: raw attendance rows no longer ride on the Summary payload.
  // The frontend obtains Haidh state only from /maktab/attendance, whose
  // normalized timeline also knows about activity stop-evidence.

  return { data: {
    students,
    sabaq: await dayRows('maktab_sabaq_log', CONFIG.sabaq),
    sabaq_dhor: await dayRows('maktab_sabaq_dhor_log', CONFIG.sabaqDhor),
    dhor: await dayRows('maktab_dhor_log', CONFIG.dhor),
  } };
}

// V3.60.0 (maktab delivery (e2)): the dhor card's prepop -- the PJ's own
// computeDefaultDhorEntry pointed at the MAKTAB dhor history, no plans
// ("copy the PJ logic", confirmed in chat). Teacher+ only, like every
// maktab read that isn't the student's own.
async function handleMaktabDhorDefault(request, env, auth) {
  if (!isTeacherOrAbove(auth)) return { error: 'Not authorized', status: 403 };
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id');
  if (!studentId) return { error: 'student_id is required', status: 400 };
  const data = await computeDefaultDhorEntry(env, studentId, { table: 'maktab_dhor_log', includePlans: false });
  return { data };
}

export { handleMaktabSummary, handleMaktabDhorDefault };

const CONFIG = {
  sabaq: {
    table: 'maktab_sabaq_log',
    fields: ['sabaq_from', 'sabaq_to', 'tajweed_tag_ids', 'line_count', 'page_count'],
    validate(body) { return null; },
  },
  sabaqDhor: {
    table: 'maktab_sabaq_dhor_log',
    fields: ['zone', 'tajweed_tag_ids', 'mistakes', 'from_surah', 'from_ayah', 'to_surah', 'to_ayah'],
    validate(body) { return null; },
  },
  dhor: {
    table: 'maktab_dhor_log',
    fields: ['segment_from', 'segment_to', 'ref', 'tajweed_tag_ids', 'mistakes', 'duration_seconds', 'lap_times'],
    validate(body) {
      if (body.ref != null && !['waterval', 'uthmani'].includes(body.ref)) return 'ref must be waterval or uthmani';
      if (body.segment_from != null && !isInRange(body.segment_from, 1, 240)) return 'segment_from out of range';
      if (body.segment_to != null && !isInRange(body.segment_to, 1, 240)) return 'segment_to out of range';
      if (body.lap_times != null && (!Array.isArray(body.lap_times) || !body.lap_times.every(n => Number.isFinite(n) && n >= 0))) {
        return 'lap_times must be an array of non-negative numbers (seconds)';
      }
      return null;
    },
    // lap_times is stored as a JSON string, same as the PJ table
    serialize(body) { return { ...body, lap_times: body.lap_times != null ? JSON.stringify(body.lap_times) : null }; },
    parseRow(row) { if (row.lap_times) { try { row.lap_times = JSON.parse(row.lap_times); } catch (e) { row.lap_times = null; } } },
  },
};

async function handleGet(cfg, request, env, auth) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id') || auth.id;
  if (!isTeacherOrAbove(auth) && studentId !== auth.id) return { error: 'Not authorized', status: 403 };
  const result = await getLogs(env, cfg.table, studentId, url.searchParams.get('since'), auth.id, true);
  if (cfg.parseRow && result.data) for (const row of result.data) cfg.parseRow(row);
  return result;
}

async function handleSave(cfg, request, env, auth) {
  if (!isTeacherOrAbove(auth)) return { error: 'Not authorized', status: 403 };
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  if (!body || typeof body !== 'object') return { error: 'Body must be a JSON object', status: 400 };
  if (!isValidDate(body.date)) return { error: 'date must be YYYY-MM-DD', status: 400 };
  if (!body.student_id) return { error: 'student_id is required', status: 400 };
  if (body.student_id === auth.id) return { error: 'A teacher cannot log their own hifz — another teacher must', status: 403 };
  const err = cfg.validate(body);
  if (err) return { error: err, status: 400 };

  const teacher = await env.DB.prepare('SELECT name FROM students WHERE id = ?').bind(auth.id).first();
  if (!teacher) return { error: 'Not authorized', status: 403 };

  const src = cfg.serialize ? cfg.serialize(body) : body;
  const values = cfg.fields.map(f => src[f] ?? null);

  const dup = await isDuplicate(env, cfg.table, body.student_id, body.date, cfg.fields, values);
  if (dup && !body.force) return { data: { isDuplicate: true } };

  const now = new Date().toISOString();
  // Optional notes, written inline (columns are nullable, unlike the
  // provenance pair). Student note: flowed from the student's PJ at
  // prepop time -- stamped to the STUDENT (it's their note; the teacher
  // pressing save is not its author). Note-only trigger, as V3.56.0.
  // Teacher note: stamped to the teacher, who IS its author; visibility
  // resolves to this table's 'teachers_only' default when absent.
  const hasStudentNote = src.student_comment != null && src.student_comment !== '';
  const hasTeacherNote = src.teacher_feedback != null && src.teacher_feedback !== '';
  const columns = [
    'student_id', 'date', 'entered_by', 'teacher_id', 'teacher_name',
    ...cfg.fields,
    'student_comment', 'student_comment_by', 'student_comment_at', 'student_comment_private',
    'teacher_feedback', 'teacher_feedback_by', 'teacher_feedback_at', 'teacher_feedback_visibility',
    'is_duplicate', 'created_at',
  ];
  const bindVals = [
    body.student_id, body.date, auth.id, auth.id, teacher.name,
    ...values,
    hasStudentNote ? src.student_comment : null,
    hasStudentNote ? body.student_id : null,
    hasStudentNote ? now : null,
    hasStudentNote && src.student_comment_private ? 1 : 0,
    hasTeacherNote ? src.teacher_feedback : null,
    hasTeacherNote ? auth.id : null,
    hasTeacherNote ? now : null,
    src.teacher_feedback_visibility ?? 'teachers_only',
    dup ? 1 : 0, now,
  ];
  const result = await env.DB.prepare(
    `INSERT INTO ${cfg.table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`
  ).bind(...bindVals).run();

  // V3.68.0 (delivery (i)): Dhor only -- the maktab pool grows in the same
  // request that writes the row, into THIS student's maktab_position blob.
  // Sabaq and Sabaq Dhor do not touch the pool here; sabaq-dhor's
  // move-to-Dhor still runs through the frontend's routed logSavePool.
  if (cfg.table === 'maktab_dhor_log') {
    await mergeDhorUnitsIntoPool(env, body.student_id, src.segment_from, src.segment_to, src.ref, { maktab: true });
  }

  // V4.2.14: Maktab activity is the strongest evidence. If this date was
  // inside a confirmed/predicted Haidh run, activity wins on the date AND
  // terminates the remainder of that old run. Future prediction cycles are
  // safely outside this bounded 11-touched-date episode window.
  const existingHaidh = await env.DB.prepare(
    `SELECT status FROM attendance WHERE student_id = ? AND date = ? AND status IN ('haidh','predicted-haidh')`
  ).bind(body.student_id, body.date).first();
  if (existingHaidh) {
    await env.DB.prepare(
      `UPDATE attendance SET status = 'present' WHERE student_id = ? AND date = ? AND status IN ('haidh','predicted-haidh')`
    ).bind(body.student_id, body.date).run();
    const through = haidhAddDaysISO(body.date, haidhCodeMaxRunDays('hanafi') - 1);
    await env.DB.prepare(
      `DELETE FROM attendance WHERE student_id = ? AND date > ? AND date <= ? AND status IN ('haidh','predicted-haidh')`
    ).bind(body.student_id, body.date, through).run();
  }

  return { data: { id: result.meta.last_row_id, isDuplicate: dup } };
}

async function handleUpdate(cfg, request, env, auth) {
  if (!isTeacherOrAbove(auth)) return { error: 'Not authorized', status: 403 };
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  if (!body.id) return { error: 'id is required', status: 400 };
  const err = cfg.validate(body);
  if (err) return { error: err, status: 400 };
  // Fetch the row's own student_id: any teacher may edit any maktab log
  // (provenance, not ownership), so updateLog's ownership check is
  // satisfied by passing the row's actual student rather than the
  // caller. teacher_id/teacher_name stay immutable: not whitelisted.
  const row = await env.DB.prepare(`SELECT student_id FROM ${cfg.table} WHERE id = ?`).bind(body.id).first();
  if (!row) return { error: 'Not found', status: 404 };
  const { id, ...updates } = body;
  if (cfg.serialize && updates.lap_times != null) updates.lap_times = JSON.stringify(updates.lap_times);
  return await updateLog(env, cfg.table, id, row.student_id, updates, auth.id, [...cfg.fields, 'date']);
}

async function handleDelete(cfg, request, env, auth) {
  if (!isTeacherOrAbove(auth)) return { error: 'Not authorized', status: 403 };
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return { error: 'id query param is required', status: 400 };
  const row = await env.DB.prepare(`SELECT student_id FROM ${cfg.table} WHERE id = ?`).bind(id).first();
  if (!row) return { error: 'Not found', status: 404 };
  return await deleteLog(env, cfg.table, id, row.student_id);
}

export const handleGetMaktabSabaq = (r, e, a) => handleGet(CONFIG.sabaq, r, e, a);
export const handleSaveMaktabSabaq = (r, e, a) => handleSave(CONFIG.sabaq, r, e, a);
export const handleUpdateMaktabSabaq = (r, e, a) => handleUpdate(CONFIG.sabaq, r, e, a);
export const handleDeleteMaktabSabaq = (r, e, a) => handleDelete(CONFIG.sabaq, r, e, a);

export const handleGetMaktabSabaqDhor = (r, e, a) => handleGet(CONFIG.sabaqDhor, r, e, a);
export const handleSaveMaktabSabaqDhor = (r, e, a) => handleSave(CONFIG.sabaqDhor, r, e, a);
export const handleUpdateMaktabSabaqDhor = (r, e, a) => handleUpdate(CONFIG.sabaqDhor, r, e, a);
export const handleDeleteMaktabSabaqDhor = (r, e, a) => handleDelete(CONFIG.sabaqDhor, r, e, a);

export const handleGetMaktabDhor = (r, e, a) => handleGet(CONFIG.dhor, r, e, a);
export const handleSaveMaktabDhor = (r, e, a) => handleSave(CONFIG.dhor, r, e, a);
export const handleUpdateMaktabDhor = (r, e, a) => handleUpdate(CONFIG.dhor, r, e, a);
export const handleDeleteMaktabDhor = (r, e, a) => handleDelete(CONFIG.dhor, r, e, a);

// ============================================================
// Maktab position (V3.66.0, delivery (h)) — the maktab's own copy of the
// PJ position blob, so the PJ's Sabaq Dhor logic (lingering rows, rollup
// level, "already moved to Dhor") works unchanged against maktab state.
// The Dhor POOL lives in this blob: maktab-owned, never
// students.baseline_selection, so it can't become a fourth PJ input.
//
// Unlike the PJ's own handlers these are teacher-gated on BOTH sides: a
// teacher legitimately reads and writes a student's maktab position
// while logging them. A student may read their own (their maktab
// journal shows what the maktab recorded) but never write it — the
// maktab owns this, not them.
// ============================================================

const MAKTAB_POSITION_MAX = 50000; // same ceiling as the PJ blob

async function handleGetMaktabPosition(request, env, auth) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id') || auth.id;
  if (!isTeacherOrAbove(auth) && studentId !== auth.id) return { error: 'Not authorized', status: 403 };
  const row = await env.DB.prepare(
    'SELECT position_json, last_dhor_json, updated_at FROM maktab_position WHERE student_id = ?'
  ).bind(studentId).first();
  return { data: row || { position_json: null, last_dhor_json: null, updated_at: null } };
}

async function handleSaveMaktabPosition(request, env, auth) {
  if (!isTeacherOrAbove(auth)) return { error: 'Not authorized', status: 403 };
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  const { student_id, position_json, last_dhor_json } = body || {};
  // Explicit student_id required, exactly as maktab log saves demand it —
  // never defaulting to auth.id, which would write the teacher's own row.
  if (!student_id) return { error: 'student_id is required', status: 400 };
  for (const [name, value] of [['position_json', position_json], ['last_dhor_json', last_dhor_json]]) {
    if (value == null) continue;
    if (typeof value !== 'string' || value.length > MAKTAB_POSITION_MAX) {
      return { error: `${name} must be a JSON string under ${MAKTAB_POSITION_MAX} bytes`, status: 400 };
    }
    try { JSON.parse(value); } catch (e) { return { error: `${name} is not valid JSON`, status: 400 }; }
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO maktab_position (student_id, position_json, last_dhor_json, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(student_id) DO UPDATE SET
       position_json = COALESCE(excluded.position_json, maktab_position.position_json),
       last_dhor_json = COALESCE(excluded.last_dhor_json, maktab_position.last_dhor_json),
       updated_at = excluded.updated_at`
  ).bind(student_id, position_json ?? null, last_dhor_json ?? null, now).run();
  return { data: { saved: true } };
}

export { handleGetMaktabPosition, handleSaveMaktabPosition };
