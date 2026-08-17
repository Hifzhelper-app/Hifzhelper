// ============================================================
// verify_pool.mjs — delivery (i)'s server-side Dhor pool merge.
//
// WHY THIS EXISTS
// Before V3.68.0 the pool grew via a SECOND request fired from
// js/dhorPage.js after the log save: not awaited, error swallowed
// (`.catch(() => {})`), and own-only, so in maktab mode it grew the
// TEACHER's pool. Both faults are gone by construction now — the merge
// happens inside the same request that writes the row, for the same
// studentId — and this harness holds that shape in place.
//
// THE PROPERTY THAT MATTERS MOST AND IS EASIEST TO BREAK LATER:
// removing juz from the pool is a LEGITIMATE action (Hifz Setup, the juz
// tracker, maktab student setup all do it deliberately). The merge must
// only ever ADD what was just logged — never re-assert, never "repair",
// never resurrect what someone removed on purpose. An earlier design
// that made the pool a derived union was withdrawn precisely because it
// would have made removal impossible. The removal tests below are the
// guard on that.
//
// Technique: a D1-shaped stub over node:sqlite (built into Node 22)
// driving the REAL mergeDhorUnitsIntoPool.
// ============================================================

import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mergeDhorUnitsIntoPool } from '../worker/src/dhorSchedule.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  if (cond) pass++; else { fail++; console.log('FAIL:', label, extra); }
};

const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE students (id TEXT PRIMARY KEY, baseline_selection TEXT);
         CREATE TABLE maktab_position (student_id TEXT PRIMARY KEY, position_json TEXT, last_dhor_json TEXT, updated_at TEXT);`);

const env = { DB: { prepare(sql) {
  return {
    bind(...a) { this.a = a; return this; },
    async first() { try { return db.prepare(sql).get(...(this.a || [])) ?? null; } catch (e) { return null; } },
    async run() { return db.prepare(sql).run(...(this.a || [])); },
  };
} } };

const pjPool = (id) => JSON.parse(db.prepare('SELECT baseline_selection FROM students WHERE id=?').get(id).baseline_selection || '[]');
const mkBlob = (id) => JSON.parse(db.prepare('SELECT position_json FROM maktab_position WHERE student_id=?').get(id).position_json);

// waterval: 4 quarter-markers per juz, so juz N -> markers (N-1)*4+1..+4.
// juz 2 = 5..8, juz 1 = 1..4.

// ---------- personal journal ----------
db.prepare('INSERT INTO students VALUES (?,?)').run('S1', '[]');

await mergeDhorUnitsIntoPool(env, 'S1', 5, 8, 'waterval');
check('PJ: logging juz 2 adds its four quarters', JSON.stringify(pjPool('S1')) === '[5,6,7,8]', JSON.stringify(pjPool('S1')));

await mergeDhorUnitsIntoPool(env, 'S1', 5, 8, 'waterval');
check('PJ: re-logging the same portion is idempotent', JSON.stringify(pjPool('S1')) === '[5,6,7,8]');

await mergeDhorUnitsIntoPool(env, 'S1', 1, 4, 'waterval');
check('PJ: a second juz merges and the pool stays sorted', JSON.stringify(pjPool('S1')) === '[1,2,3,4,5,6,7,8]', JSON.stringify(pjPool('S1')));

// ---------- removal is legitimate and must survive ----------
db.prepare('UPDATE students SET baseline_selection=? WHERE id=?').run('[1,2,3,4]', 'S1');
await mergeDhorUnitsIntoPool(env, 'S1', 1, 4, 'waterval');
check('PJ: logging juz 1 does NOT resurrect the removed juz 2', JSON.stringify(pjPool('S1')) === '[1,2,3,4]', JSON.stringify(pjPool('S1')));

db.prepare('UPDATE students SET baseline_selection=? WHERE id=?').run('[]', 'S1');
check('PJ: the pool can be emptied entirely', pjPool('S1').length === 0);
await mergeDhorUnitsIntoPool(env, 'S1', 5, 8, 'waterval');
check('PJ: re-logging a removed juz adds back that juz and nothing else', JSON.stringify(pjPool('S1')) === '[5,6,7,8]', JSON.stringify(pjPool('S1')));

// ---------- maktab: the STUDENT's blob, never the teacher's row ----------
db.prepare('INSERT INTO students VALUES (?,?)').run('TEACHER', '[]');
db.prepare('INSERT INTO maktab_position VALUES (?,?,?,?)')
  .run('S2', JSON.stringify({ baselineSelection: [1, 2, 3, 4], rollup: { x: 1 } }), '{"keep":true}', 'then');

await mergeDhorUnitsIntoPool(env, 'S2', 5, 8, 'waterval', { maktab: true });
check('maktab: merges into the student position blob', JSON.stringify(mkBlob('S2').baselineSelection) === '[1,2,3,4,5,6,7,8]', JSON.stringify(mkBlob('S2').baselineSelection));
check('maktab: other keys in the blob survive the merge', JSON.stringify(mkBlob('S2').rollup) === '{"x":1}');
check('maktab: last_dhor_json is not clobbered',
  db.prepare('SELECT last_dhor_json FROM maktab_position WHERE student_id=?').get('S2').last_dhor_json === '{"keep":true}');
check('maktab: the teacher\'s own PJ pool is untouched — the whole point', pjPool('TEACHER').length === 0);

await mergeDhorUnitsIntoPool(env, 'S3', 5, 8, 'waterval', { maktab: true });
check('maktab: upserts cleanly for a student with no position row yet', JSON.stringify(mkBlob('S3').baselineSelection) === '[5,6,7,8]');

// ---------- a pool failure must never destroy a committed log row ----------
let threw = false;
try { await mergeDhorUnitsIntoPool(env, 'S1', null, null, 'waterval'); } catch (e) { threw = true; }
check('a null segment is a no-op, never an exception', !threw);

const brokenEnv = { DB: { prepare() { throw new Error('simulated DB fault'); } } };
threw = false;
try { await mergeDhorUnitsIntoPool(brokenEnv, 'S1', 5, 8, 'waterval'); } catch (e) { threw = true; }
check('a DB fault is swallowed — the log row is already committed, so throwing would turn a good save into a 500', !threw);

// ---------- the client-side merge really is gone ----------
const dhorPage = read('js/dhorPage.js');
check('js/dhorPage.js no longer writes the pool itself', !/apiSaveProfile\s*\(/.test(dhorPage));
check('js/dhorPage.js has no fire-and-forget pool catch left', !/baseline_selection[^\n]*catch\(\s*\(\)\s*=>/.test(dhorPage));

// ---------- the one routed pool writer ----------
const ctx = read('js/logContext.js');
check('logContext exposes a single pool writer', /async function logSavePool\(/.test(ctx));
check('logSavePool routes on maktab mode', /logSavePool[\s\S]{0,900}logCtxIsMaktab\(\)/.test(ctx));
check('logSavePool writes the maktab blob under the same key maktabSetup uses', /logSavePool[\s\S]{0,900}baselineSelection/.test(ctx));
for (const f of ['js/sabaqPage.js', 'js/sabaqDhorPage.js', 'js/juzTrackerScreen.js']) {
  const src = read(f);
  check(`${f} writes the pool through logSavePool, not apiSaveProfile`,
    /logSavePool\(/.test(src) && !/apiSaveProfile\(/.test(src));
}

// ---------- the dead maktab log clients stay dead ----------
const api = read('js/api.js');
for (const dead of ['apiMaktabSabaq', 'apiMaktabSabaqDhor', 'apiMaktabDhor']) {
  check(`${dead} is not redefined (it was the token-deciding form of a student-scoped endpoint)`,
    !new RegExp(`(const|function)\\s+${dead}\\b`).test(api));
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
