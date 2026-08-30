// Shared logic for the four independent logs (sabaq_log, sabaq_dhor_log,
// dhor_log, reflections). All four share the same shape for student_id/
// date/entered_by, comment/feedback attribution, is_duplicate, created_at —
// this file is the one place that shape is implemented (CONVENTIONS.md
// principle 2), so the four per-table modules stay thin wrappers that just
// supply their own field list and validation.

import { isValidDate } from './utils.js';

// Checks whether an existing row for this student/date has identical values
// across `fields` (the table's own content columns, not student_id/date/
// entered_by/comments/is_duplicate/created_at — those don't count toward
// "is this the same content logged twice").
async function isDuplicate(env, table, studentId, date, fields, values) {
  const whereClauses = fields.map(f => `${f} IS ?`).join(' AND ');
  const row = await env.DB.prepare(
    `SELECT id FROM ${table} WHERE student_id = ? AND date = ? AND ${whereClauses} LIMIT 1`
  ).bind(studentId, date, ...values).first();
  return !!row;
}

// Inserts a new row. Never upserts — V2 has no per-day cap, so every save
// is a new row, not an update to an existing one (a real behavior change
// from V1.x, where entries were capped and saving meant upsert-by-date).
// Returns { id, isDuplicate }.
// V3.45.15: new `force` parameter, confirmed in chat -- previously this
// always inserted regardless of duplicate status, just setting the flag
// afterward, which meant a caller could never actually offer "confirm
// before saving, cancel to abort" -- by the time any response reached the
// frontend, the row already existed. Now, when a duplicate is found and
// `force` isn't set, this returns `{ isDuplicate: true }` WITHOUT
// inserting at all -- id is deliberately absent (not null) so callers can
// tell "nothing was inserted" apart from "inserted, and it happened to be
// flagged as a duplicate" (the old, still-supported behavior when force
// is explicitly true). `force` only ever skips the frontend's own
// confirmation step; is_duplicate is still correctly recorded on the row
// exactly as before either way, since that's a fact about the content,
// not about whether the user was asked about it.
async function insertLog(env, table, studentId, date, enteredBy, fields, values, force = false) {
  const dup = await isDuplicate(env, table, studentId, date, fields, values);
  if(dup && !force) return { isDuplicate: true };
  const now = new Date().toISOString();
  const columns = ['student_id', 'date', 'entered_by', ...fields, 'is_duplicate', 'created_at'];
  const placeholders = columns.map(() => '?').join(',');
  const result = await env.DB.prepare(
    `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`
  ).bind(studentId, date, enteredBy, ...values, dup ? 1 : 0, now).run();
  return { id: result.meta.last_row_id, isDuplicate: dup };
}

// Attendance is shared across all three activity logs (sabaq_log,
// sabaq_dhor_log, dhor_log) -- any ONE of them existing for a date is
// enough to justify 'present' there. So when a log moves off a date
// (an edit) or is deleted, that date's attendance can only be
// reverted if none of the three tables still has a row for
// student+date -- a blind delete would be wrong whenever a student
// has more than one log on the same day.
// Called AFTER the triggering mutation (the UPDATE that moved the
// row, or the DELETE) has already happened, so the row in question
// is naturally excluded from this check just by no longer being at
// this date, or no longer existing at all -- no separate "exclude
// this one" parameter needed.
// 2026-08-15, confirmed in chat: reverts to no row at all (unset),
// never to 'absent' -- this function only knows a log stopped being
// at this date, not that the student was actually absent that day
// (the log may simply have been a date correction). Unset is also
// the same state the date would already be in if the log had never
// landed there. If a log had briefly overwritten a genuine haidh
// mark ("sabaq always wins" already does this on every save), that
// haidh mark is NOT restored here -- there's no stored history, just
// one status column that was already destructively overwritten.
// Accepted, not a bug: unset is the honest outcome given the schema.
async function releaseAttendanceIfNoActivity(env, studentId, date) {
  const stillActive = await env.DB.prepare(
    `SELECT 1 FROM sabaq_log WHERE student_id = ? AND date = ?
     UNION ALL SELECT 1 FROM sabaq_dhor_log WHERE student_id = ? AND date = ?
     UNION ALL SELECT 1 FROM dhor_log WHERE student_id = ? AND date = ?
     LIMIT 1`
  ).bind(studentId, date, studentId, date, studentId, date).first();
  if (stillActive) return; // another log still justifies present here
  await env.DB.prepare(
    'DELETE FROM attendance WHERE student_id = ? AND date = ?'
  ).bind(studentId, date).run();
}

// The exact upsert every handleSave* (dhorLog.js/sabaqLog.js/
// sabaqDhorLog.js) already runs inline on a fresh save -- factored out
// so the edit path (a log's date changing TO here) can reuse the same
// unconditional "sabaq always wins" rule instead of a 4th copy of the
// SQL. Deliberately NOT used to replace those three existing inline
// upserts (2026-08-15, confirmed in chat, Claude's own call) -- same
// SQL now exists in 4 places instead of 1, which cuts against this
// file's own single-source-of-truth principle, but touching three
// already-correct worker files that don't need to change for this fix
// was judged the wrong trade against this project's deploy-risk
// caution (manual, non-atomic, file-by-file).
async function markAttendancePresent(env, studentId, date) {
  await env.DB.prepare(
    `INSERT INTO attendance (student_id, date, status) VALUES (?, ?, 'present')
     ON CONFLICT(student_id, date) DO UPDATE SET status = 'present'`
  ).bind(studentId, date).run();
}

// Generic partial update — updates only whichever fields are present in
// `updates`, leaving everything else on the row untouched. Handles both
// correcting a mistake in the entry's own content (surah, mistakes, etc.)
// and adding/updating a comment (which also stamps who/when) — the same
// mechanism either way. The app can't enforce honesty about whether an
// edit reflects what actually happened; that's on the user. A confirmation
// before overwriting existing data is a frontend concern, not enforced here.
// 2026-08-15, confirmed in chat: gained `trackAttendance` (default false).
// reflections.js imports and calls this SAME function for Tadabbur, and
// reflections are deliberately NOT part of the attendance rule -- so this
// can't be unconditional. Only dhorLog.js/sabaqLog.js/sabaqDhorLog.js pass
// true; reflections.js's calls are untouched and keep their current,
// correct (attendance-blind) behaviour automatically.
async function updateLog(env, table, id, studentId, updates, authId, contentFields, trackAttendance = false) {
  const row = await env.DB.prepare(`SELECT student_id, date FROM ${table} WHERE id = ?`).bind(id).first();
  if (!row) return { error: 'Not found', status: 404 };
  if (row.student_id !== studentId) return { error: 'Not authorized', status: 403 };

  // V3.77.0 (j, rode along as scheduled 2026-08-17): a bad date used to be
  // BOTH stored (through the contentFields branch below) AND silently skip
  // the attendance sync (dateChanging false). Refuse it instead.
  if ('date' in updates && !isValidDate(updates.date)) return { error: 'date must be YYYY-MM-DD', status: 400 };

  const oldDate = row.date;
  const dateChanging = trackAttendance && 'date' in updates && updates.date !== oldDate;

  const setClauses = [];
  const values = [];
  const now = new Date().toISOString();
  for (const [field, value] of Object.entries(updates)) {
    if (field === 'student_comment' || field === 'teacher_feedback') {
      setClauses.push(`${field} = ?`, `${field}_by = ?`, `${field}_at = ?`);
      values.push(value, authId, now);
    } else if (field === 'student_comment_private' || field === 'teacher_feedback_visibility') {
      // privacy companions — set alongside their comment, not stamped themselves
      setClauses.push(`${field} = ?`);
      values.push(field === 'student_comment_private' ? (value ? 1 : 0) : value);
    } else if (contentFields.includes(field)) {
      setClauses.push(`${field} = ?`);
      values.push(value);
    }
  }
  if (setClauses.length === 0) return { error: 'No valid fields to update', status: 400 };
  values.push(id);
  await env.DB.prepare(`UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = ?`).bind(...values).run();
  // V3.97.0 (l) RE-SYNC, not frozen (user's call): if this is a MAKTAB
  // row that has already been archived into her table, the copy is
  // patched to match — one targeted statement keyed on maktab_log_id,
  // harmless when no copy exists. Same SET list: the content columns
  // are shared by construction.
  if (ARCHIVE_INTO[table]) {
    await env.DB.prepare(`UPDATE ${ARCHIVE_INTO[table]} SET ${setClauses.join(', ')} WHERE maktab_log_id = ?`).bind(...values).run();
  }

  if (dateChanging) {
    await markAttendancePresent(env, studentId, updates.date);
    await releaseAttendanceIfNoActivity(env, studentId, oldDate);
  }

  return { data: { saved: true } };
}

// 2026-08-15, confirmed in chat: gained `trackAttendance` (default
// false), same reasoning and same reflections.js exemption as
// updateLog above.
async function deleteLog(env, table, id, studentId, trackAttendance = false) {
  const row = await env.DB.prepare(`SELECT student_id, date FROM ${table} WHERE id = ?`).bind(id).first();
  if (!row) return { error: 'Not found', status: 404 };
  if (row.student_id !== studentId) return { error: 'Not authorized', status: 403 };
  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  // V3.97.0 (l): THE DELETE PATH — the one the spec warns gets
  // forgotten. An archived copy surviving a deleted maktab record
  // would leave her journal asserting something the maktab no longer
  // says; the copy dies with the original.
  if (ARCHIVE_INTO[table]) {
    await env.DB.prepare(`DELETE FROM ${ARCHIVE_INTO[table]} WHERE maktab_log_id = ?`).bind(id).run();
  }
  if (trackAttendance) await releaseAttendanceIfNoActivity(env, studentId, row.date);
  return { data: { deleted: true } };
}

// Redacts fields the requester shouldn't see, based on each row's own
// privacy settings — never a row-level hide, always field-level, so the
// entry's existence/date is still visible even when its private content
// isn't. `hasFeedback` = true for sabaq_log/sabaq_dhor_log/dhor_log (which
// have student_comment_private + teacher_feedback_visibility); reflections
// only has is_private instead, since it has no teacher_feedback concept.
function applyPrivacy(rows, studentId, requesterId, hasFeedback) {
  const isOwner = requesterId === studentId;
  for (const row of rows) {
    if (hasFeedback) {
      if (row.student_comment_private && !isOwner) {
        row.student_comment = null;
      }
      if (row.teacher_feedback_visibility && row.teacher_feedback_visibility !== 'all') {
        if (isOwner) {
          // students never see teachers_only or private feedback — it's
          // feedback about them, not necessarily meant for them.
          row.teacher_feedback = null;
        } else if (row.teacher_feedback_visibility === 'private' && row.teacher_feedback_by !== requesterId) {
          // a different teacher than the one who wrote it
          row.teacher_feedback = null;
        }
        // 'teachers_only' stays visible to any teacher — only 'private'
        // restricts to the specific author.
      }
    } else {
      if (row.is_private && !isOwner) {
        row.reflection = null;
      }
    }
  }
  return rows;
}

async function getLogs(env, table, studentId, since, requesterId, hasFeedback) {
  let query = `SELECT * FROM ${table} WHERE student_id = ?`;
  const params = [studentId];
  if (since) { query += ' AND date >= ?'; params.push(since); }
  query += ' ORDER BY date DESC, created_at DESC';
  const { results } = await env.DB.prepare(query).bind(...params).all();
  applyPrivacy(results, studentId, requesterId, hasFeedback);
  return { data: results };
}

// ============================================================
// V3.83.0 — (k) THE MERGE: union at read time, ONE-WAY maktab → PJ.
//
// The student's own read of her journal returns her PJ rows PLUS the
// maktab's rows for her, interleaved by date. The truth principle
// (user, 2026-08-28) shapes every detail here:
//   - Each side owns its truth. Maktab rows arrive with source:'maktab',
//     their id NULLED and moved to maktab_log_id — so any PJ write path
//     that forgets to check source fails LOUDLY on a null id instead of
//     silently editing whichever PJ row shared the number. Ownership
//     governs writes; her surfaces may only read these rows.
//   - PJ rows carry source:'personal' — in her journal THEY are the
//     marked ones (the maktab record is the spine; hers is the addition).
//   - provenance = teacher_name, already snapshotted on every maktab row.
//   - Privacy is the SAME applyPrivacy pass the maktab endpoints already
//     run for a student reading her own maktab journal: as owner she
//     sees her comments; teachers_only/private feedback stays redacted.
//   - Duplicates (she logged it AND the maktab did) are SHOWN, never
//     collapsed — the user's explicit call: seeing the duplication is
//     how she learns what the maktab covers.
// This function is used ONLY for an own-read (studentId === auth.id).
// A teacher reading PJ rows by ?student_id= keeps the PURE PJ read —
// that is the three-inputs channel (sabaq frontier / haidh / notes) and
// mixing maktab rows back into it would double-count the maktab's own
// record. The maktab side gains NOTHING from this merge.
// ============================================================
// ============================================================
// V3.97.0 (l) THE ARCHIVE. Maktab rows older than 60 days are
// PHYSICALLY COPIED into her table — "hifz is a solo journey with the
// maktab helping during certain periods; even when one loses
// connection the journey continues, so the journal can always be
// used." Idempotent by construction: INSERT OR IGNORE behind 0028's
// unique index, guarded by the NOT-IN key. Bounded (LIMIT 500 per
// pass) and triggered opportunistically on her own merged read — no
// cron; after the first pass the marginal work is near zero. The
// maktab tables are NEVER moved or emptied.
// ============================================================
const ARCHIVE_COLS = {
  sabaq_log: ['student_id', 'date', 'entered_by', 'sabaq_from', 'sabaq_to', 'tajweed_tag_ids', 'line_count', 'page_count', 'student_comment', 'student_comment_by', 'student_comment_at', 'student_comment_private', 'teacher_feedback', 'teacher_feedback_by', 'teacher_feedback_at', 'teacher_feedback_visibility', 'is_duplicate', 'created_at'],
  sabaq_dhor_log: ['student_id', 'date', 'entered_by', 'from_surah', 'from_ayah', 'to_surah', 'to_ayah', 'tajweed_tag_ids', 'mistakes', 'student_comment', 'student_comment_by', 'student_comment_at', 'student_comment_private', 'teacher_feedback', 'teacher_feedback_by', 'teacher_feedback_at', 'teacher_feedback_visibility', 'is_duplicate', 'created_at'],
  dhor_log: ['student_id', 'date', 'entered_by', 'segment_from', 'segment_to', 'ref', 'tajweed_tag_ids', 'mistakes', 'duration_seconds', 'lap_times', 'student_comment', 'student_comment_by', 'student_comment_at', 'student_comment_private', 'teacher_feedback', 'teacher_feedback_by', 'teacher_feedback_at', 'teacher_feedback_visibility', 'is_duplicate', 'created_at'],
};
// the maktab table each PJ table archives FROM, and the reverse (for re-sync)
const ARCHIVE_FROM = { sabaq_log: 'maktab_sabaq_log', sabaq_dhor_log: 'maktab_sabaq_dhor_log', dhor_log: 'maktab_dhor_log' };
const ARCHIVE_INTO = { maktab_sabaq_log: 'sabaq_log', maktab_sabaq_dhor_log: 'sabaq_dhor_log', maktab_dhor_log: 'dhor_log' };

async function archiveOldMaktab(env, pjTable, maktabTable, studentId) {
  const cols = ARCHIVE_COLS[pjTable];
  if (!cols) return;
  const colList = cols.join(', ');
  const mColList = cols.map(c => `m.${c}`).join(', ');
  await env.DB.prepare(
    `INSERT OR IGNORE INTO ${pjTable} (${colList}, maktab_log_id, maktab_teacher)
     SELECT ${mColList}, m.id, m.teacher_name FROM ${maktabTable} m
     WHERE m.student_id = ?1 AND m.date < date('now', '-60 day')
       AND m.id NOT IN (SELECT maktab_log_id FROM ${pjTable} WHERE student_id = ?1 AND maktab_log_id IS NOT NULL)
     LIMIT 500`
  ).bind(studentId).run();
}

async function getMergedLogs(env, pjTable, maktabTable, studentId, since, requesterId, hasFeedback) {
  await archiveOldMaktab(env, pjTable, maktabTable, studentId);   // V3.97.0: opportunistic, idempotent, bounded
  const clause = since ? ' AND date >= ?2' : '';
  const bind = since ? [studentId, since] : [studentId];
  const [pj, mk] = await Promise.all([
    env.DB.prepare(`SELECT * FROM ${pjTable} WHERE student_id = ?1${clause}`).bind(...bind).all(),
    // V3.97.0 EXACTNESS: a maktab row already archived is EXCLUDED from
    // the live read — its copy represents it. No cutoff arithmetic, no
    // window where a row shows twice or disappears, whenever archiving runs.
    env.DB.prepare(`SELECT * FROM ${maktabTable} WHERE student_id = ?1${clause}
      AND id NOT IN (SELECT maktab_log_id FROM ${pjTable} WHERE student_id = ?1 AND maktab_log_id IS NOT NULL)`).bind(...bind).all(),
  ]);
  const rows = [];
  for (const r of pj.results) {
    if (r.maktab_log_id != null) {
      // an ARCHIVED copy presents exactly like a live maktab row —
      // teacher provenance, id nulled (read-only by construction, the
      // (k) pattern) — so the UI needs no new case at all.
      r.teacher_name = r.maktab_teacher;
      r.id = null; r.source = 'maktab';
    } else {
      r.source = 'personal';
    }
    rows.push(r);
  }
  for (const r of mk.results) { r.maktab_log_id = r.id; r.id = null; r.source = 'maktab'; rows.push(r); }
  rows.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at || '').localeCompare(a.created_at || ''));
  applyPrivacy(rows, studentId, requesterId, hasFeedback);
  return { data: rows };
}

// If a save was made against a plan (the student ticked off a planned
// session with full detail, rather than just the quick checkbox), this
// links the new log row back to that plan and marks it completed.
// Silently no-ops if planId is falsy or doesn't belong to this student —
// linking a plan is a bonus, not something that should fail the save itself.
async function linkPlanIfProvided(env, planId, studentId, logId) {
  if (!planId) return;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE plans SET status = 'completed', completed_log_id = ?, completed_at = ?
     WHERE id = ? AND student_id = ?`
  ).bind(logId, now, planId, studentId).run();
}

export { isDuplicate, insertLog, updateLog, deleteLog, getLogs, getMergedLogs, linkPlanIfProvided, applyPrivacy };
