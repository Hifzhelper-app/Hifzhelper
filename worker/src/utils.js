// Shared response helpers + validation.
// Per CONVENTIONS.md principle 4 (validate at the boundary): every handler
// that writes to D1 should run its input through the relevant validate*
// function here before touching the database — never trust the frontend's
// shape blindly, even though we wrote the frontend too.

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // tighten to your real frontend origin once it has one
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS'
    }
  });
}

// Per CONVENTIONS.md principle 3 (no silent fallbacks): every error path
// returns a real status code and message — never an empty 200 that looks
// like "no data yet".
export function error(message, status = 400) {
  return json({ error: message }, status);
}

export function isValidDate(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

export function isInRange(n, min, max) {
  const v = Number(n);
  return Number.isFinite(v) && v >= min && v <= max;
}

// Validates the shape of an incoming entry POST body before it ever touches D1.
// Every field is optional (per the "nothing compulsory" requirement) EXCEPT
// date, which anchors the row. Anything present is range-checked.
export function validateEntryBody(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (!isValidDate(body.date)) return 'date must be YYYY-MM-DD';
  if (body.sabaq_surah != null && !isInRange(body.sabaq_surah, 1, 114)) return 'sabaq_surah out of range';
  if (body.sabaq_ayah_from != null && !isInRange(body.sabaq_ayah_from, 1, 286)) return 'sabaq_ayah_from out of range';
  if (body.sabaq_ayah_to != null && !isInRange(body.sabaq_ayah_to, 1, 286)) return 'sabaq_ayah_to out of range';
  if (body.sabaq_quarter != null && !isInRange(body.sabaq_quarter, 1, 4)) return 'sabaq_quarter out of range';
  if (body.dhor_ref != null && !['waterval', 'uthmani'].includes(body.dhor_ref)) return 'dhor_ref must be waterval or uthmani';
  if (body.dhor_from != null && !isInRange(body.dhor_from, 1, 240)) return 'dhor_from out of range';
  if (body.dhor_to != null && !isInRange(body.dhor_to, 1, 240)) return 'dhor_to out of range';
  return null; // null = valid
}

export function validateAttendanceBody(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (!isValidDate(body.date)) return 'date must be YYYY-MM-DD';
  if (!['present', 'absent', 'haidh', 'predicted-haidh'].includes(body.status)) return 'invalid status';
  return null;
}
