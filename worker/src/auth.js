import { generateUniqueId } from './utils.js';

// Login: unique ID + 4-digit PIN (see the auth decision in chat).
// Two things a 4-digit PIN needs, since it only has 10,000 possibilities:
//  1. The ID itself must be random/non-guessable (it's the actual entropy).
//  2. Failed attempts must be rate-limited (see LOCKOUT_* below).
// Neither of those is optional hardening — without them a 4-digit PIN alone
// is trivially brute-forceable.

const LOCKOUT_THRESHOLD = 5;      // wrong attempts before locking
const LOCKOUT_MINUTES = 15;       // how long a lockout lasts
const TOKEN_TTL_HOURS = 12;       // how long a login session lasts

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Stored as "salt:hashHex". The pepper (env.HH_PEPPER) is a Worker secret,
// not stored in D1 at all — so a leaked database alone isn't enough to brute
// force PINs offline; the attacker would also need the Worker's secret.
async function hashPin(pin, salt, pepper) {
  return await sha256Hex(`${salt}:${pin}:${pepper}`);
}

async function verifyPin(pin, storedHash, pepper) {
  const [salt, hash] = (storedHash || '').split(':');
  if (!salt || !hash) return false;
  const computed = await hashPin(pin, salt, pepper);
  return computed === hash;
}

// Compact HMAC-signed token: base64(payload json).base64(signature).
// Stateless on purpose — verifying a request doesn't need a D1 lookup, which
// matters given the burst-usage pattern (many logins in a short window).
async function signToken(payload, secret) {
  const body = btoa(JSON.stringify(payload));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
  return `${body}.${sig}`;
}

export async function verifyToken(token, secret) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expectedSigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expectedSig = btoa(String.fromCharCode(...new Uint8Array(expectedSigBuffer)));
  if (expectedSig !== sig) return null; // tampered or wrong secret
  let payload;
  try { payload = JSON.parse(atob(body)); } catch (e) { return null; }
  if (!payload.exp || Date.now() > payload.exp) return null; // expired
  return payload; // { id, role, exp }
}

// Pulls the token out of "Authorization: Bearer <token>" and verifies it.
// Returns { id, role } or null — callers treat null as "not logged in".
export async function authenticate(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  return await verifyToken(token, env.HH_AUTH_SECRET);
}

export async function handleLogin(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  const { id, pin } = body || {};
  if (!id || !pin || !/^\d{4}$/.test(pin)) {
    return { error: 'id and a 4-digit pin are required', status: 400 };
  }

  const row = await env.DB.prepare(
    'SELECT id, name, role, pin_hash, active, failed_attempts, locked_until FROM students WHERE id = ?'
  ).bind(id).first();

  if (!row || !row.active) return { error: 'Invalid ID or PIN', status: 401 }; // deliberately vague — don't reveal which part was wrong

  if (row.locked_until && Date.now() < new Date(row.locked_until).getTime()) {
    return { error: `Too many attempts. Try again after ${row.locked_until}.`, status: 429 };
  }

  // First login: no PIN set yet — whatever they submit becomes their PIN.
  if (!row.pin_hash) {
    const salt = randomSalt();
    const hash = await hashPin(pin, salt, env.HH_PEPPER);
    await env.DB.prepare('UPDATE students SET pin_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?')
      .bind(`${salt}:${hash}`, id).run();
    const token = await signToken({ id: row.id, role: row.role, exp: Date.now() + TOKEN_TTL_HOURS * 3600 * 1000 }, env.HH_AUTH_SECRET);
    return { data: { token, name: row.name, role: row.role, firstLogin: true } };
  }

  const ok = await verifyPin(pin, row.pin_hash, env.HH_PEPPER);
  if (!ok) {
    const attempts = (row.failed_attempts || 0) + 1;
    if (attempts >= LOCKOUT_THRESHOLD) {
      const until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
      await env.DB.prepare('UPDATE students SET failed_attempts = ?, locked_until = ? WHERE id = ?').bind(attempts, until, id).run();
      return { error: `Too many attempts. Locked until ${until}.`, status: 429 };
    }
    await env.DB.prepare('UPDATE students SET failed_attempts = ? WHERE id = ?').bind(attempts, id).run();
    return { error: 'Invalid ID or PIN', status: 401 };
  }

  await env.DB.prepare('UPDATE students SET failed_attempts = 0, locked_until = NULL WHERE id = ?').bind(id).run();
  const token = await signToken({ id: row.id, role: row.role, exp: Date.now() + TOKEN_TTL_HOURS * 3600 * 1000 }, env.HH_AUTH_SECRET);
  return { data: { token, name: row.name, role: row.role, firstLogin: false } };
}

// Normalizes a name for duplicate comparison — trimmed, lowercased, so
// "Umme " and "umme" compare equal. Exported so admin.js's registration
// path uses the exact same comparison (CONVENTIONS.md #2).
export function normalizeName(n) {
  return (n || '').trim().toLowerCase();
}
// Normalizes a WhatsApp number for duplicate comparison — digits only, so
// "+966 555-123456" and "966555123456" compare equal regardless of the
// formatting the student happened to type (see chat: item 1, V3.4).
export function normalizeWhatsapp(w) {
  return (w || '').replace(/\D/g, '');
}

// Given a base name, counts existing students whose name is that name or
// "that name N" already, and returns the next disambiguating suffix to use
// (V3.4.1) — "John Smith" existing alone means the next one becomes
// "John Smith 2", a third becomes "John Smith 3", and so on. Exported so
// admin.js's registration path uses identical numbering.
export async function nextDisambiguatedName(env, trimmedName) {
  const norm = normalizeName(trimmedName);
  const { results } = await env.DB.prepare(
    'SELECT name FROM students WHERE LOWER(TRIM(name)) = ? OR LOWER(TRIM(name)) LIKE ?'
  ).bind(norm, norm + ' %').all();
  return results.length ? `${trimmedName} ${results.length + 1}` : trimmedName;
}

// Checks for an existing student — active OR inactive — that collides
// with the given name/whatsapp: name+whatsapp together when a whatsapp was
// actually given (the strongest signal), or name ALONE when no whatsapp
// was given at all (V3.4.2). V3.4.3: now searches inactive students too
// (previously active-only), so a match against a retired journal can
// still be surfaced rather than silently missed. Returns
// { id, active } for a match, or null.
export async function findDuplicateMatch(env, trimmedName, whatsapp) {
  const normName = normalizeName(trimmedName);
  if (whatsapp) {
    const normWhatsapp = normalizeWhatsapp(whatsapp);
    if (!normWhatsapp) return null;
    const candidates = await env.DB.prepare(
      'SELECT id, whatsapp_number, active FROM students WHERE LOWER(TRIM(name)) = ? AND whatsapp_number IS NOT NULL'
    ).bind(normName).all();
    const match = (candidates.results || []).find(row => normalizeWhatsapp(row.whatsapp_number) === normWhatsapp);
    return match ? { id: match.id, active: !!match.active } : null;
  }
  const row = await env.DB.prepare(
    'SELECT id, active FROM students WHERE LOWER(TRIM(name)) = ? LIMIT 1'
  ).bind(normName).first();
  return row ? { id: row.id, active: !!row.active } : null;
}

// POST /auth/register — public, no token required. Creates a student
// account (self-registration always creates students only — teacher/
// admin accounts stay an admin-only action, never self-service). name is
// required; whatsapp_number is optional (its purpose is disambiguating
// similarly-named students, not identity verification, so nothing here
// enforces it). No PIN set — same first-login flow as every other account.
//
// Duplicate guard (V3.4/V3.4.2): see findDuplicateMatch() above for the
// matching rule. On a match, nothing is created yet — the frontend shows
// a choice (Cancel/Continue/Reset PIN, form stays editable), and re-calls
// this with force:true to create anyway regardless of what's currently in
// the fields — force only skips SURFACING the warning; the match check
// itself still runs against whatever was actually submitted, so editing
// the name/WhatsApp before continuing naturally becomes a normal
// registration if it no longer collides with anything. On a force-created
// match, the new record's name gets an auto-appended disambiguating
// number (V3.4.1) since two students can otherwise be indistinguishable
// in any admin-facing list except by their random ID.
export async function handleRegister(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return { error: 'Invalid JSON body', status: 400 }; }
  if (!body.name || !body.name.trim()) return { error: 'name is required', status: 400 };

  const trimmedName = body.name.trim();
  const whatsapp = body.whatsapp_number ? body.whatsapp_number.trim() : null;

  const match = await findDuplicateMatch(env, trimmedName, whatsapp);
  if (match && !body.force) return { data: { matched: true, matchedActive: match.active } };

  const finalName = match ? await nextDisambiguatedName(env, trimmedName) : trimmedName;

  const id = await generateUniqueId(env);
  const today = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    'INSERT INTO students (id, name, role, created_date, active, whatsapp_number) VALUES (?, ?, ?, ?, 1, ?)'
  ).bind(id, finalName, 'student', today, whatsapp).run();

  return { data: { id, name: finalName, matched: !!match, matchedActive: match ? match.active : undefined } };
}

// GET /auth/lookup?id=XXX — public, no token. Lets the frontend personalize
// the login screen when a unique ID arrives via the URL path (V3.4, items
// 3/6/7/10): returns just the name and whether a PIN has been set yet, never
// anything else. A nonexistent ID and an inactive account both come back as
// a plain 404 — same "don't reveal more than necessary" posture as the
// login endpoint's deliberately-vague error.
export async function handleLookup(request, env) {
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').trim();
  if (!id) return { error: 'id is required', status: 400 };
  const row = await env.DB.prepare('SELECT name, pin_hash, active FROM students WHERE id = ?').bind(id).first();
  if (!row || !row.active) return { error: 'Not found', status: 404 };
  return { data: { name: row.name, hasPin: !!row.pin_hash } };
}
