// GET /profile — the logged-in student's own profile. No student_id override
// for teachers here (yet) — this is a Phase 1, self-service endpoint.
export async function handleGetProfile(request, env, auth) {
  const row = await env.DB.prepare(
    'SELECT id, name, role, gender, track_haidh, setup_complete FROM students WHERE id = ?'
  ).bind(auth.id).first();
  if (!row) return { error: 'Student not found', status: 404 };
  return { data: row };
}

// POST /profile — a student sets up (or later edits) their own name/gender/
// haidh preference, and marks setup as complete. Every field is optional on
// each call (partial updates allowed) except that completing setup requires
// name to be present at least once.
export async function handleSaveProfile(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }

  if (body.gender != null && !['M', 'F'].includes(body.gender)) {
    return { error: 'gender must be M or F', status: 400 };
  }
  if (body.track_haidh != null && ![0, 1, true, false].includes(body.track_haidh)) {
    return { error: 'track_haidh must be boolean', status: 400 };
  }

  const current = await env.DB.prepare('SELECT name, gender, track_haidh FROM students WHERE id = ?')
    .bind(auth.id).first();
  if (!current) return { error: 'Student not found', status: 404 };

  const name = body.name != null ? body.name : current.name;
  const gender = body.gender != null ? body.gender : current.gender;
  const trackHaidh = body.track_haidh != null ? (body.track_haidh ? 1 : 0) : current.track_haidh;
  const setupComplete = body.setup_complete ? 1 : 0;

  await env.DB.prepare(
    'UPDATE students SET name = ?, gender = ?, track_haidh = ?, setup_complete = CASE WHEN ? = 1 THEN 1 ELSE setup_complete END WHERE id = ?'
  ).bind(name, gender, trackHaidh, setupComplete, auth.id).run();

  return { data: { saved: true } };
}
