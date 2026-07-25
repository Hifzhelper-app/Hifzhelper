// ============================================================
// Hifzhelper — admin endpoints
// Every handler here is gated to role === 'admin' — nothing here is
// reachable by a student or teacher token, even if they guess the path.
// ============================================================

function requireAdmin(auth) {
  if (!auth || auth.role !== 'admin') return { error: 'Not authorized', status: 403 };
  return null;
}

const ID_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function randomId(length = 6) {
  let id = '';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) id += ID_CHARSET[bytes[i] % ID_CHARSET.length];
  return id;
}

// Generates a unique student ID, checking against real collisions rather
// than assuming the random draw is unique — the ID space is large enough
// that a collision is very unlikely, but "very unlikely" isn't the same
// as "impossible," and this is cheap to check properly (CONVENTIONS.md
// principle 3 — no silent assumptions where a real check is this cheap).
async function generateUniqueId(env) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = randomId(6);
    const existing = await env.DB.prepare('SELECT id FROM students WHERE id = ?').bind(candidate).first();
    if (!existing) return candidate;
  }
  throw new Error('Could not generate a unique ID after 20 attempts');
}

// GET /admin/users — list every student (any role), for the admin screen.
// Never returns pin_hash.
export async function handleListUsers(request, env, auth) {
  const denied = requireAdmin(auth);
  if (denied) return denied;
  const { results } = await env.DB.prepare(
    'SELECT id, name, role, active, created_date, gender, setup_complete FROM students ORDER BY created_date DESC'
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

// POST /admin/update-user — body: { id, name }. Extensible later for
// whatsapp_number once that column exists (V3.3.3) — same partial-update
// shape as the log tables' PATCH endpoints.
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

// POST /admin/register-student — body: { name }. Creates a new student
// with an app-generated unique ID, no PIN yet — same first-login flow as
// every other account. Returns the new ID so the admin can hand it to
// the actual student.
export async function handleRegisterStudent(request, env, auth) {
  const denied = requireAdmin(auth);
  if (denied) return denied;
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  if (!body.name || !body.name.trim()) return { error: 'name is required', status: 400 };

  const id = await generateUniqueId(env);
  const today = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    'INSERT INTO students (id, name, role, created_date, active) VALUES (?, ?, ?, ?, 1)'
  ).bind(id, body.name.trim(), 'student', today).run();

  return { data: { id, name: body.name.trim() } };
}
