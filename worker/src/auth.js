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
