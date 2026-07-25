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
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS'
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

export function validateAttendanceBody(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (!isValidDate(body.date)) return 'date must be YYYY-MM-DD';
  if (!['present', 'absent', 'haidh', 'predicted-haidh'].includes(body.status)) return 'invalid status';
  return null;
}

// Shared unique-ID generation (CONVENTIONS.md principle 2 — single source
// of truth). Used by both admin-created students and self-registration —
// same format, same collision-checking, one place to change either.
const ID_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function randomId(length = 6) {
  let id = '';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) id += ID_CHARSET[bytes[i] % ID_CHARSET.length];
  return id;
}

export async function generateUniqueId(env) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = randomId(6);
    const existing = await env.DB.prepare('SELECT id FROM students WHERE id = ?').bind(candidate).first();
    if (!existing) return candidate;
  }
  throw new Error('Could not generate a unique ID after 20 attempts');
}
