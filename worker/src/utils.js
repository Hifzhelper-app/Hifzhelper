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
// V3.76.2: an optional machine-readable code rides alongside the message,
// so a client can branch on WHICH rule refused without matching prose.
export function error(message, status = 400, code) {
  return json(code ? { error: message, code } : { error: message }, status);
}

// V3.78.0: "today" by the MAKTAB's clock. With the timezone set, every
// date boundary the worker decides — haidh confirmed vs predicted, the
// superseded-prediction window — falls on the maktab's calendar day for
// every user everywhere. Unset → UTC, the pre-V3.78.0 behaviour, until the
// admin picks a zone. en-CA formats as YYYY-MM-DD directly.
export async function maktabTodayISO(env) {
  let tz = null;
  try {
    const row = await env.DB.prepare('SELECT timezone FROM maktab_settings WHERE id = 1').first();
    tz = row && row.timezone ? row.timezone : null;
  } catch (e) { tz = null; }
  if (tz) {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()); }
    catch (e) { /* bad stored zone: fall through to UTC rather than throw */ }
  }
  return new Date().toISOString().slice(0, 10);
}

export function isValidDate(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

export function isInRange(n, min, max) {
  const v = Number(n);
  return Number.isFinite(v) && v >= min && v <= max;
}

// V3.55.0 (2026-08-15, confirmed in chat — maktab delivery (a)):
// roles are a strict hierarchy, student < teacher < admin, NOT
// independent flags — an admin is a teacher with additional authority.
// Every "teacher-only" permission gate in the worker goes through this
// helper rather than a literal role === 'teacher' check, so an admin
// passes them all. The one thing this is NOT for: admin-only gates
// (admin.js's requireAdmin) — the hierarchy runs one way, and those
// stay a literal role === 'admin'.
export function isTeacherOrAbove(auth) {
  return !!auth && (auth.role === 'teacher' || auth.role === 'admin');
}

export function validateAttendanceBody(body) {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object';
  if (!isValidDate(body.date)) return 'date must be YYYY-MM-DD';
  // V3.98.0: 'predicted-absent' — the teacher's forward-looking marker
  // for a student who has informed the maktab. Never excuses (user).
  if (!['present', 'absent', 'haidh', 'predicted-haidh', 'predicted-absent'].includes(body.status)) return 'invalid status';
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
