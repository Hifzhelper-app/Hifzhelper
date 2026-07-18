// The position/last-dhor JSON blobs are computed client-side (the frontend
// already has all the juz'/rub' logic in shared/data.js + app.js) and stored
// here as-is. This Worker validates that they're at least well-formed JSON
// and under a sane size, but does NOT re-derive the progress logic server-side.
//
// That's a real scope choice, not an oversight: fully re-deriving juz'/quarter/
// zone calculations server-side (defense in depth against a tampered client)
// would mean porting all of app.js's progress logic into the Worker too. Worth
// doing eventually if this needs to be hardened against a malicious client,
// but for a maktab's own students that's not the current threat model.

const MAX_BLOB_SIZE = 50_000; // bytes — generous for 30 juz' of state, guards against abuse

export async function handleGetPosition(request, env, auth) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get('student_id') || auth.id;

  if (auth.role !== 'teacher' && studentId !== auth.id) {
    return { error: 'Not authorized to view this student', status: 403 };
  }

  const row = await env.DB.prepare('SELECT position_json, last_dhor_json, updated_at FROM position WHERE student_id = ?')
    .bind(studentId).first();

  return { data: row || { position_json: null, last_dhor_json: null, updated_at: null } };
}

export async function handleSavePosition(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }

  const { position_json, last_dhor_json } = body || {};
  for (const [name, value] of [['position_json', position_json], ['last_dhor_json', last_dhor_json]]) {
    if (value == null) continue;
    if (typeof value !== 'string' || value.length > MAX_BLOB_SIZE) {
      return { error: `${name} must be a JSON string under ${MAX_BLOB_SIZE} bytes`, status: 400 };
    }
    try { JSON.parse(value); } catch (e) { return { error: `${name} is not valid JSON`, status: 400 }; }
  }

  const studentId = auth.id; // a student only ever writes their own position
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO position (student_id, position_json, last_dhor_json, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(student_id) DO UPDATE SET
       position_json = COALESCE(excluded.position_json, position.position_json),
       last_dhor_json = COALESCE(excluded.last_dhor_json, position.last_dhor_json),
       updated_at = excluded.updated_at`
  ).bind(studentId, position_json ?? null, last_dhor_json ?? null, now).run();

  return { data: { saved: true } };
}
