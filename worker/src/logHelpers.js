// Shared logic for the four independent logs (sabaq_log, sabaq_dhor_log,
// dhor_log, reflections). All four share the same shape for student_id/
// date/entered_by, comment/feedback attribution, is_duplicate, created_at —
// this file is the one place that shape is implemented (CONVENTIONS.md
// principle 2), so the four per-table modules stay thin wrappers that just
// supply their own field list and validation.

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
async function insertLog(env, table, studentId, date, enteredBy, fields, values) {
  const dup = await isDuplicate(env, table, studentId, date, fields, values);
  const now = new Date().toISOString();
  const columns = ['student_id', 'date', 'entered_by', ...fields, 'is_duplicate', 'created_at'];
  const placeholders = columns.map(() => '?').join(',');
  const result = await env.DB.prepare(
    `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`
  ).bind(studentId, date, enteredBy, ...values, dup ? 1 : 0, now).run();
  return { id: result.meta.last_row_id, isDuplicate: dup };
}

// Generic partial update — updates only whichever fields are present in
// `updates`, leaving everything else on the row untouched. Handles both
// correcting a mistake in the entry's own content (surah, mistakes, etc.)
// and adding/updating a comment (which also stamps who/when) — the same
// mechanism either way. The app can't enforce honesty about whether an
// edit reflects what actually happened; that's on the user. A confirmation
// before overwriting existing data is a frontend concern, not enforced here.
async function updateLog(env, table, id, studentId, updates, authId, contentFields) {
  const row = await env.DB.prepare(`SELECT student_id FROM ${table} WHERE id = ?`).bind(id).first();
  if (!row) return { error: 'Not found', status: 404 };
  if (row.student_id !== studentId) return { error: 'Not authorized', status: 403 };

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
  return { data: { saved: true } };
}

async function deleteLog(env, table, id, studentId) {
  const row = await env.DB.prepare(`SELECT student_id FROM ${table} WHERE id = ?`).bind(id).first();
  if (!row) return { error: 'Not found', status: 404 };
  if (row.student_id !== studentId) return { error: 'Not authorized', status: 403 };
  await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
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

export { isDuplicate, insertLog, updateLog, deleteLog, getLogs, linkPlanIfProvided };
