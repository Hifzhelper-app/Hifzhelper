import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import { handleGetMaktabSettings, handleSaveMaktabSettings, readMaktabSettings } from '../worker/src/maktabSettings.js';
import { fileURLToPath } from 'url';
// repo-relative: tests/ lives inside the repo, so the root is one up.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

let pass = 0, fail = 0;
function check(label, cond) { if (cond) pass++; else { fail++; console.log('FAIL:', label); } }
const read = (p) => fs.readFileSync(ROOT + p, 'utf8');

// ---- run migration 0020 exactly as the D1 console would ----
const db = new DatabaseSync(':memory:');
const mig = read('worker/migrations/0020_maktab_settings.sql');
const statements = mig.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
  .split(';').map(x => x.trim()).filter(Boolean);
check('0020 is exactly 2 statements (table + defaults row)', statements.length === 2);
for (const st of statements) db.exec(st);
db.exec("ALTER TABLE maktab_settings ADD COLUMN timezone TEXT");
db.exec("ALTER TABLE maktab_settings ADD COLUMN term_from TEXT");
db.exec("ALTER TABLE maktab_settings ADD COLUMN teaching_days TEXT");   // V3.98.0
db.exec("ALTER TABLE maktab_settings ADD COLUMN term_to TEXT");   // V3.80.0 (migration 0025)   // V3.78.0 (migration 0022)

const DB = { prepare(sql) { return {
  bind(...args) { return {
    async run(){ db.prepare(sql).run(...args); return { meta: {} }; },
    async first(){ return db.prepare(sql).get(...args) ?? null; },
    async all(){ return { results: db.prepare(sql).all(...args) }; },
  }; },
  async first(){ return db.prepare(sql).get() ?? null; },
  async all(){ return { results: db.prepare(sql).all() }; },
}; } };
const env = { DB };
const ADMIN = { id: 'ADM1', role: 'admin' };
const TEACHER = { id: 'TCH1', role: 'teacher' };
const STUDENT = { id: 'STU1', role: 'student' };
const post = (b) => ({ json: async () => b, url: 'https://x/' });
const get = () => ({ url: 'https://x/' });

// ---- the row always exists, with the agreed defaults ----
{
  const r = (await handleGetMaktabSettings(get(), env, ADMIN)).data;
  check('defaults: 13line / 3 / 30 / empty name',
    r.mushaf === '13line' && r.maktab_day_min === 3 && r.absence_flag_days === 30 && r.name === '');
  check('no "not configured" branch is ever needed — the row exists immediately', !!r);
}

// ---- single-row CHECK actually holds ----
{
  let threw = false;
  try { db.exec('INSERT INTO maktab_settings (id) VALUES (2)'); } catch (e) { threw = true; }
  check('CHECK (id = 1) rejects a second settings row', threw);
}

// ---- THE asymmetric gate ----
{
  const s = await handleGetMaktabSettings(get(), env, STUDENT);
  check('read: student → 403', s.status === 403);
  const t = await handleGetMaktabSettings(get(), env, TEACHER);
  check('read: TEACHER allowed — their cards need the mushaf', !t.error && t.data.mushaf === '13line');
  const a = await handleGetMaktabSettings(get(), env, ADMIN);
  check('read: admin allowed', !a.error);

  const tw = await handleSaveMaktabSettings(post({ mushaf: '15line_madani' }), env, TEACHER);
  check('write: TEACHER → 403 (the case isTeacherOrAbove would get WRONG)', tw.status === 403);
  const sw = await handleSaveMaktabSettings(post({ mushaf: '15line_madani' }), env, STUDENT);
  check('write: student → 403', sw.status === 403);
  const aw = await handleSaveMaktabSettings(post({ mushaf: '15line_madani' }), env, ADMIN);
  check('write: admin allowed, returns the updated row', !aw.error && aw.data.mushaf === '15line_madani');
  check('write: teacher\'s rejected attempt did NOT change anything',
    db.prepare('SELECT mushaf FROM maktab_settings WHERE id = 1').get().mushaf === '15line_madani');
}

// ---- validation ----
{
  const bad = async (body) => (await handleSaveMaktabSettings(post(body), env, ADMIN)).status;
  check('validation: unknown mushaf rejected', await bad({ mushaf: 'hybrid' }) === 400);
  check('validation: zero/negative threshold rejected', await bad({ maktab_day_min: 0 }) === 400);
  check('validation: non-integer threshold rejected', await bad({ maktab_day_min: 2.5 }) === 400);
  check('validation: zero absence days rejected', await bad({ absence_flag_days: 0 }) === 400);
  check('validation: over-long name rejected', await bad({ name: 'x'.repeat(61) }) === 400);
  check('validation: empty body rejected', await bad({}) === 400);

  const ok = await handleSaveMaktabSettings(post({ name: '  Madrasah Nur  ', maktab_day_min: 5, absence_flag_days: 14 }), env, ADMIN);
  check('save: name trimmed, numbers stored', ok.data.name === 'Madrasah Nur' && ok.data.maktab_day_min === 5 && ok.data.absence_flag_days === 14);
  check('save: a partial update leaves other fields alone', ok.data.mushaf === '15line_madani');
  check('save: updated_at stamped', !!db.prepare('SELECT updated_at FROM maktab_settings WHERE id = 1').get().updated_at);
}

// ---- the shared reader other modules will use ----
{
  const s = await readMaktabSettings(env);
  check('readMaktabSettings returns the live row', s.maktab_day_min === 5 && s.mushaf === '15line_madani');
}

// ================= FRONTEND =================
{
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  w.eval(`
    var fetches = 0;
    var SETTINGS = { mushaf: '15line_madani', maktab_day_min: 5, absence_flag_days: 14, name: 'Madrasah Nur' };
    function apiGetMaktabSettings(){ fetches++; return Promise.resolve(SETTINGS); }
    function apiGetProfile(){ return Promise.resolve({ mushaf: '13line', baseline_selection: [1,2,3] }); }
    function apiFetch(){ return Promise.resolve([]); }
    function makeLogClient(){ return { get(){}, save(){}, update(){}, remove(){} }; }
    var apiSabaq = {}, apiSabaqDhor = {}, apiDhor = {};
    function apiGetDhorDefaultEntry(){} function apiMaktabDhorDefault(){}
  `);
  w.eval(read('js/logContext.js'));

  const pj = JSON.parse(await w.eval('logProfile().then(p => JSON.stringify(p))'));
  check('frontend PJ mode: still the student\'s own profile, untouched',
    pj.mushaf === '13line' && pj.baseline_selection.length === 3 && w.eval('fetches') === 0);

  w.eval("setMaktabLogContext({ id: 'STU2', name: 'Umme' }, '2026-08-16')");
  const mk = JSON.parse(await w.eval('logProfile().then(p => JSON.stringify(p))'));
  check('frontend maktab: mushaf comes from the SETTING, not the 13-line interim', mk.mushaf === '15line_madani');
  check('frontend maktab: pool still empty until (h) fills it', mk.baseline_selection.length === 0);

  await w.eval('logProfile()');
  await w.eval('logProfile()');
  check('frontend: settings cached — one fetch, not one per card render', w.eval('fetches') === 1);
  w.eval('invalidateMaktabSettings()');
  await w.eval('logProfile()');
  check('frontend: saving invalidates the cache so the change takes effect', w.eval('fetches') === 2);

  w.eval("SETTINGS = null; invalidateMaktabSettings(); apiGetMaktabSettings = () => Promise.reject(new Error('down'))");
  const fallback = JSON.parse(await w.eval('loadMaktabSettings(true).then(s => JSON.stringify(s))'));
  check('frontend: a failed settings read falls back to defaults, never blocks logging',
    fallback.mushaf === '13line' && fallback.maktab_day_min === 3);
}

// ---- source: the interim constant is gone ----
{
  const src = read('js/logContext.js');
  // comments may still NAME the retired constant — that's the history
  // trail this repo keeps deliberately. Only code must be free of it.
  const code = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  check('source: MAKTAB_MUSHAF_INTERIM retired from CODE, exactly as designed', !/MAKTAB_MUSHAF_INTERIM/.test(code));
  check('source: the pool carrier clears with the context',
    /LOG_CTX_POOL = \[\];[\s\S]{0,80}?\/\/.*pool/i.test(src) || /LOG_CTX_POOL = \[\];/.test(src.split('function clearLogContext')[1] || ''));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
