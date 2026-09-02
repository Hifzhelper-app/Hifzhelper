// ============================================================
// Hifzhelper — admin endpoints
// Every handler here is gated to role === 'admin' — nothing here is
// reachable by a student or teacher token, even if they guess the path.
// ============================================================

import { generateUniqueId } from './utils.js';
import { nextDisambiguatedName, findDuplicateMatch } from './auth.js';

function requireAdmin(auth) {
  if (!auth || auth.role !== 'admin') return { error: 'Not authorized', status: 403 };
  return null;
}

// GET /admin/users — list every student (any role), for the admin screen.
// Never returns pin_hash.
export async function handleListUsers(request, env, auth) {
  const denied = requireAdmin(auth);
  if (denied) return denied;
  const { results } = await env.DB.prepare(
    'SELECT id, name, role, active, created_date, gender, setup_complete, whatsapp_number, group_id FROM students ORDER BY created_date DESC'
  ).all();
  return { data: results };
}

// POST /admin/reset-pin — body: { id }. Clears pin_hash and any lockout
// state, so the student goes through the normal first-login flow again
// (whatever PIN they type next becomes their new one).
export async function handleResetPin(request, env, auth) {
  const denied = requireAdmin(auth);
  if (denied) return denied;
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  if (!body.id) return { error: 'id is required', status: 400 };

  const row = await env.DB.prepare('SELECT id FROM students WHERE id = ?').bind(body.id).first();
  if (!row) return { error: 'Student not found', status: 404 };

  await env.DB.prepare(
    'UPDATE students SET pin_hash = NULL, failed_attempts = 0, locked_until = NULL WHERE id = ?'
  ).bind(body.id).run();
  return { data: { reset: true } };
}

// POST /admin/change-role — body: { id, role }.
export async function handleChangeRole(request, env, auth) {
  const denied = requireAdmin(auth);
  if (denied) return denied;
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  if (!body.id) return { error: 'id is required', status: 400 };
  if (!['student', 'teacher', 'admin'].includes(body.role)) {
    return { error: 'role must be student, teacher, or admin', status: 400 };
  }

  const row = await env.DB.prepare('SELECT id FROM students WHERE id = ?').bind(body.id).first();
  if (!row) return { error: 'Student not found', status: 404 };

  await env.DB.prepare('UPDATE students SET role = ? WHERE id = ?').bind(body.role, body.id).run();
  return { data: { saved: true } };
}

// POST /admin/update-user — body: { id, name?, whatsapp_number?, active? }.
// Partial update — only touches whichever fields are actually present,
// same pattern as the log tables' PATCH endpoints.
export async function handleUpdateUser(request, env, auth) {
  const denied = requireAdmin(auth);
  if (denied) return denied;
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  if (!body.id) return { error: 'id is required', status: 400 };

  const row = await env.DB.prepare('SELECT id FROM students WHERE id = ?').bind(body.id).first();
  if (!row) return { error: 'Student not found', status: 404 };

  const setClauses = [];
  const values = [];
  if (body.name != null) {
    if (!body.name.trim()) return { error: 'name cannot be empty', status: 400 };
    setClauses.push('name = ?');
    values.push(body.name.trim());
  }
  if (body.whatsapp_number != null) {
    setClauses.push('whatsapp_number = ?');
    values.push(body.whatsapp_number.trim() || null);
  }
  if (body.active != null) {
    setClauses.push('active = ?');
    values.push(body.active ? 1 : 0);
    // Deactivating automatically resets the PIN too (V3.4.3) — mirrors
    // handleResetPin's own reset, so a later reactivation always starts
    // the student on a fresh first-login flow rather than silently
    // keeping whatever PIN was set before deactivation.
    if (!body.active) {
      setClauses.push('pin_hash = NULL', 'failed_attempts = 0', 'locked_until = NULL');
    }
  }
  // V3.78.0 (item 8): the group, assigned on the student's admin card.
  // null clears; otherwise the id must be a real, non-retired group.
  if (body.group_id !== undefined) {
    if (body.group_id === null || body.group_id === '') {
      setClauses.push('group_id = NULL');
    } else {
      const gid = Number(body.group_id);
      if (!Number.isInteger(gid)) return { error: 'group_id must be a group id or null', status: 400 };
      const g = await env.DB.prepare('SELECT id, retired FROM maktab_groups WHERE id = ?').bind(gid).first();
      if (!g) return { error: 'Group not found', status: 404 };
      if (g.retired) return { error: 'That group is retired', status: 400 };
      setClauses.push('group_id = ?');
      values.push(gid);
    }
  }
  if (setClauses.length === 0) return { error: 'No valid fields to update', status: 400 };
  values.push(body.id);
  await env.DB.prepare(`UPDATE students SET ${setClauses.join(', ')} WHERE id = ?`).bind(...values).run();
  return { data: { saved: true } };
}

// DELETE /admin/users?id=X — deliberately does NOT cascade-delete a
// student's history. D1 already enforces the foreign key constraints on
// attendance/position/sabaq_log/sabaq_dhor_log/dhor_log/reflections/plans
// (confirmed directly during the 0007 migration's own table rebuild) — so
// this will naturally fail with a clear error if the student has ANY
// existing records, rather than silently destroying their whole history.
// Only a student with zero activity can be deleted this way.
export async function handleDeleteUser(request, env, auth) {
  const denied = requireAdmin(auth);
  if (denied) return denied;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return { error: 'id query param is required', status: 400 };

  const row = await env.DB.prepare('SELECT id FROM students WHERE id = ?').bind(id).first();
  if (!row) return { error: 'Student not found', status: 404 };

  try {
    await env.DB.prepare('DELETE FROM students WHERE id = ?').bind(id).run();
  } catch (e) {
    return { error: 'Cannot delete — this student has existing records (journal entries, attendance, position, etc.). This is a deliberate safety measure to prevent accidental data loss.', status: 409 };
  }
  return { data: { deleted: true } };
}

// POST /admin/register-student — body: { name, whatsapp_number?, force?, gender?, track_haidh? }.
// Creates a new student with an app-generated unique ID, no PIN yet — same
// first-login flow as every other account. Runs the same duplicate check
// as self-registration (V3.4/V3.4.2, see findDuplicateMatch in auth.js) —
// a warning only, never a block; unlike self-registration, this returns
// the matched student's own ID (safe here since admin already sees every
// student via /admin/users), so the admin panel can offer a direct Reset
// PIN or deactivate action instead of routing through email. force:true
// bypasses surfacing the match and auto-numbers the new record's name to
// keep it distinguishable (same helper/behavior as self-registration).
// POST /admin/create-teaching-profile — body: { id } (a STUDENT's id).
// V3.77.0 (j) Account separation. A person who teaches holds TWO unlinked
// accounts: her PJ (student) account and a teaching account with no
// journal at all. The teaching id is DERIVED — PJ id + 'TEACHER' — so she
// has one code to remember (user, 2026-08-17). The row starts with no PIN;
// she sets it on first login exactly as every student does (separate PIN,
// user's call). Nothing links the two rows in the data: the suffix is a
// convention, not a foreign key, and the worker never compares them.
// Guards: source must exist, be active, and be a student; the derived id
// must not exist yet; a teaching account cannot be derived from.
export const TEACHING_ID_SUFFIX = 'TEACHER';
export function teachingIdFor(studentId) { return String(studentId) + TEACHING_ID_SUFFIX; }
export async function handleCreateTeachingProfile(request, env, auth) {
  const denied = requireAdmin(auth);
  if (denied) return denied;
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  const sourceId = body && body.id ? String(body.id).trim() : '';
  if (!sourceId) return { error: 'id is required', status: 400 };

  const source = await env.DB.prepare('SELECT id, name, role, active FROM students WHERE id = ?').bind(sourceId).first();
  if (!source) return { error: 'Not found', status: 404 };
  if (source.role !== 'student') return { error: 'A teaching profile is created from a STUDENT account', status: 400 };
  if (!source.active) return { error: 'That student account is inactive', status: 400 };

  const id = teachingIdFor(sourceId);
  const existing = await env.DB.prepare('SELECT id FROM students WHERE id = ?').bind(id).first();
  if (existing) return { error: `A teaching profile already exists for ${source.name} (${id})`, status: 409 };

  const name = `${source.name} (Teacher)`;
  const today = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    'INSERT INTO students (id, name, role, created_date, active) VALUES (?, ?, ?, ?, 1)'
  ).bind(id, name, 'teacher', today).run();

  return { data: { id, name, role: 'teacher', derived_from: sourceId } };
}

export async function handleRegisterStudent(request, env, auth) {
  const denied = requireAdmin(auth);
  if (denied) return denied;
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  if (!body.name || !body.name.trim()) return { error: 'name is required', status: 400 };

  const trimmedName = body.name.trim();
  const whatsapp = body.whatsapp_number ? body.whatsapp_number.trim() : null;
  const gender = body.gender == null ? null : String(body.gender);
  if (gender != null && !['M', 'F'].includes(gender)) return { error: 'gender must be M or F', status: 400 };
  const trackHaidh = gender === 'F' && body.track_haidh === true ? 1 : 0;

  const match = await findDuplicateMatch(env, trimmedName, whatsapp);
  if (match && !body.force) return { data: { matched: true, matchedId: match.id, matchedActive: match.active } };

  const finalName = match ? await nextDisambiguatedName(env, trimmedName) : trimmedName;

  const id = await generateUniqueId(env);
  const today = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    'INSERT INTO students (id, name, role, created_date, active, whatsapp_number, gender, track_haidh) VALUES (?, ?, ?, ?, 1, ?, ?, ?)'
  ).bind(id, finalName, 'student', today, whatsapp, gender, trackHaidh).run();

  return { data: { id, name: finalName, gender, track_haidh: !!trackHaidh, matchedId: match ? match.id : undefined, matchedActive: match ? match.active : undefined } };
}
