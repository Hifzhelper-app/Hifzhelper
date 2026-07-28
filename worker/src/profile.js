// GET /profile — the logged-in student's own profile. No student_id override
// for teachers here (yet) — this is a Phase 1, self-service endpoint.
export async function handleGetProfile(request, env, auth) {
  const row = await env.DB.prepare(
    'SELECT id, name, role, gender, track_haidh, setup_complete, journal_name, mushaf, ' +
    'baseline_mode, baseline_selection, target_mistakes_per_juz, target_minutes_per_juz, target_frequency_days ' +
    'FROM students WHERE id = ?'
  ).bind(auth.id).first();
  if (!row) return { error: 'Student not found', status: 404 };
  // baseline_selection is stored as a JSON string — parse it back to a real
  // array for the client rather than making every caller do it.
  if (row.baseline_selection != null) {
    try { row.baseline_selection = JSON.parse(row.baseline_selection); }
    catch (e) { row.baseline_selection = null; }
  }
  return { data: row };
}

// Only these two are real, active choices right now — Hybrid is shown in
// the Setup screen UI but disabled/unselectable, so the server never needs
// to accept it as a value until that actually gets built (V3.7.0).
const VALID_MUSHAF = ['13line', '15line_madani'];
const VALID_BASELINE_MODE = ['surah', 'juz'];

// POST /profile — a student sets up (or later edits) their own name/gender/
// haidh preference/journal name/mushaf choice/history baseline/default
// targets, and marks setup as complete. Every field is optional on each
// call (partial updates allowed) except that completing setup requires
// name to be present at least once.
//
// V3.8.0: two independent cards (Profile, Hifz Setup) both save through
// this same endpoint — each just sends the subset of fields it owns, and
// both may set setup_complete:true (saving either card is enough to mark
// setup complete, not just one specific one).
export async function handleSaveProfile(request, env, auth) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }

  if (body.gender != null && !['M', 'F'].includes(body.gender)) {
    return { error: 'gender must be M or F', status: 400 };
  }
  if (body.track_haidh != null && ![0, 1, true, false].includes(body.track_haidh)) {
    return { error: 'track_haidh must be boolean', status: 400 };
  }
  if (body.mushaf != null && !VALID_MUSHAF.includes(body.mushaf)) {
    return { error: `mushaf must be one of: ${VALID_MUSHAF.join(', ')}`, status: 400 };
  }
  if (body.baseline_mode != null && !VALID_BASELINE_MODE.includes(body.baseline_mode)) {
    return { error: `baseline_mode must be one of: ${VALID_BASELINE_MODE.join(', ')}`, status: 400 };
  }
  if (body.baseline_selection != null) {
    if (!Array.isArray(body.baseline_selection) || !body.baseline_selection.every(n => Number.isInteger(n))) {
      return { error: 'baseline_selection must be an array of integers', status: 400 };
    }
  }
  for (const key of ['target_mistakes_per_juz', 'target_minutes_per_juz', 'target_frequency_days']) {
    if (body[key] != null && (!Number.isInteger(body[key]) || body[key] < 0)) {
      return { error: `${key} must be a non-negative integer`, status: 400 };
    }
  }

  const current = await env.DB.prepare(
    'SELECT name, gender, track_haidh, journal_name, mushaf, baseline_mode, baseline_selection, ' +
    'target_mistakes_per_juz, target_minutes_per_juz, target_frequency_days FROM students WHERE id = ?'
  ).bind(auth.id).first();
  if (!current) return { error: 'Student not found', status: 404 };

  const name = body.name != null ? body.name : current.name;
  const gender = body.gender != null ? body.gender : current.gender;
  const trackHaidh = body.track_haidh != null ? (body.track_haidh ? 1 : 0) : current.track_haidh;
  const journalName = body.journal_name != null ? body.journal_name : current.journal_name;
  const mushaf = body.mushaf != null ? body.mushaf : current.mushaf;
  const baselineMode = body.baseline_mode != null ? body.baseline_mode : current.baseline_mode;
  const baselineSelection = body.baseline_selection != null
    ? JSON.stringify(body.baseline_selection)
    : current.baseline_selection;
  const targetMistakes = body.target_mistakes_per_juz != null ? body.target_mistakes_per_juz : current.target_mistakes_per_juz;
  const targetMinutes = body.target_minutes_per_juz != null ? body.target_minutes_per_juz : current.target_minutes_per_juz;
  const targetFrequency = body.target_frequency_days != null ? body.target_frequency_days : current.target_frequency_days;
  const setupComplete = body.setup_complete ? 1 : 0;

  await env.DB.prepare(
    'UPDATE students SET name = ?, gender = ?, track_haidh = ?, journal_name = ?, mushaf = ?, ' +
    'baseline_mode = ?, baseline_selection = ?, target_mistakes_per_juz = ?, target_minutes_per_juz = ?, ' +
    'target_frequency_days = ?, setup_complete = CASE WHEN ? = 1 THEN 1 ELSE setup_complete END WHERE id = ?'
  ).bind(
    name, gender, trackHaidh, journalName, mushaf,
    baselineMode, baselineSelection, targetMistakes, targetMinutes, targetFrequency,
    setupComplete, auth.id
  ).run();

  return { data: { saved: true } };
}
