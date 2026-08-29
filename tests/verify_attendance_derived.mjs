import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import { deriveStudentAttendance, loadMaktabDays, handleMaktabAttendance } from '../worker/src/maktabAttendance.js';
import { handleSaveMaktabSabaq } from '../worker/src/maktabLog.js';
import { fileURLToPath } from 'url';
// repo-relative: tests/ lives inside the repo, so the root is one up.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

let pass = 0, fail = 0;
function check(label, cond) { if (cond) pass++; else { fail++; console.log('FAIL:', label); } }
const read = (p) => fs.readFileSync(ROOT + p, 'utf8');
const runMig = (db, f) => { for (const st of read('worker/migrations/' + f).split('\n').filter(l => !l.trim().startsWith('--')).join('\n').split(';').map(x => x.trim()).filter(Boolean)) db.exec(st); };

// ================= PURE RULES =================
const days = (...d) => d;
{
  // present beats everything
  let r = deriveStudentAttendance(days('2026-08-01'), ['2026-08-01'], ['2026-08-01'], 'hanafi', 30);
  check('a log on a haidh day → present (log always wins)', r.statuses['2026-08-01'] === 'present');

  r = deriveStudentAttendance(days('2026-08-01'), [], ['2026-08-01'], 'hanafi', 30);
  check('marked haidh, no log → haidh', r.statuses['2026-08-01'] === 'haidh');

  r = deriveStudentAttendance(days('2026-08-01'), [], [], 'hanafi', 30);
  check('maktab day, no log, no haidh → absent', r.statuses['2026-08-01'] === 'absent');
}

// ---- propagation: CALENDAR days, not maktab days ----
{
  // haidh marked 01 only. Maktab meets 02, 05, 09, 11, 15. Hanafi max 10:
  // the run covers 01..10, so 02/05/09 are haidh, 11 and 15 are absent.
  const md = days('2026-08-02', '2026-08-05', '2026-08-09', '2026-08-11', '2026-08-15');
  const r = deriveStudentAttendance(md, [], ['2026-08-01'], 'hanafi', 30);
  check('propagation: continues on later maktab days with no log',
    r.statuses['2026-08-02'] === 'haidh' && r.statuses['2026-08-05'] === 'haidh' && r.statuses['2026-08-09'] === 'haidh');
  check('propagation: stops at the hanafi max of 10 CALENDAR days → absent after',
    r.statuses['2026-08-11'] === 'absent' && r.statuses['2026-08-15'] === 'absent');

  // shafii = 15 days from the 01, i.e. 01..15 inclusive — so the 15th is
  // still covered and absence starts on the 16th. (First draft of this
  // check expected the 15th to be absent; the code was right and the
  // expectation was off by the inclusive start day.)
  const shafii = deriveStudentAttendance(md.concat('2026-08-16'), [], ['2026-08-01'], 'shafii', 30);
  check('propagation: shafii covers 15 days — the 11th and 15th are haidh, the 16th absent',
    shafii.statuses['2026-08-11'] === 'haidh' && shafii.statuses['2026-08-15'] === 'haidh'
    && shafii.statuses['2026-08-16'] === 'absent');
}

// ---- THE case that distinguishes calendar days from maktab days ----
{
  // haidh 01; the maktab then does not meet for a fortnight; next maktab
  // day is the 20th. Under the WRONG rule (counting maktab days) the
  // allowance is untouched and the 20th would still read haidh. Under
  // the correct calendar rule she is long past her max → absent.
  const r = deriveStudentAttendance(days('2026-08-20'), [], ['2026-08-01'], 'hanafi', 30);
  check('DISTINGUISHING CASE: a gap in maktab days still consumes the allowance → absent',
    r.statuses['2026-08-20'] === 'absent');

  // and the inverse: a dense run inside the window is still haidh
  const dense = deriveStudentAttendance(days('2026-08-02','2026-08-03','2026-08-04'), [], ['2026-08-01'], 'hanafi', 30);
  check('inverse: maktab days inside the window are all haidh',
    Object.values(dense.statuses).every(v => v === 'haidh'));
}

// ---- consecutive marks form one run, measured from its START ----
{
  // marks on 01,02,03 are one run starting 01 → hanafi covers to the 10th
  const r = deriveStudentAttendance(days('2026-08-09', '2026-08-12'), [], ['2026-08-01','2026-08-02','2026-08-03'], 'hanafi', 30);
  check('a consecutive run is measured from its start, not its last mark',
    r.statuses['2026-08-09'] === 'haidh' && r.statuses['2026-08-12'] === 'absent');
}

// ---- the attention flag: MAKTAB days, resets on any log ----
{
  const md = days('2026-08-01','2026-08-02','2026-08-03','2026-08-04','2026-08-05');
  let r = deriveStudentAttendance(md, [], [], 'hanafi', 5);
  check('flag: fires at exactly the configured count', r.noLogStreak === 5 && r.flagged === true);
  r = deriveStudentAttendance(md, [], [], 'hanafi', 6);
  check('flag: does not fire one short', r.noLogStreak === 5 && r.flagged === false);
  r = deriveStudentAttendance(md, ['2026-08-03'], [], 'hanafi', 3);
  check('flag: any log resets the streak', r.noLogStreak === 2 && r.flagged === false);
  r = deriveStudentAttendance(md, ['2026-08-05'], [], 'hanafi', 1);
  check('flag: a log on the latest maktab day → streak 0', r.noLogStreak === 0 && r.flagged === false);
}

// ================= AGAINST THE REAL DB =================
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE students (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
  pin_hash TEXT, created_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, haidh_ruling TEXT NOT NULL DEFAULT 'hanafi');
  CREATE TABLE attendance (student_id TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL, PRIMARY KEY (student_id, date));
  INSERT INTO students (id,name,role,created_date) VALUES
    ('S1','A','student','2026-01-01'), ('S2','B','student','2026-01-01'),
    ('S3','C','student','2026-01-01'), ('T1','T','teacher','2026-01-01'), ('T2','T2','teacher','2026-01-01');`);
runMig(db, '0019_maktab_tables.sql');
runMig(db, '0020_maktab_settings.sql');

// V3.78.0 fixture upgrade: the columns/tables migration 0022 adds and the
// worker now reads (0022 itself is proven whole in verify_v3780).
  db.exec("ALTER TABLE maktab_sabaq_log ADD COLUMN tajweed_tag_ids TEXT");
  db.exec("ALTER TABLE maktab_sabaq_dhor_log ADD COLUMN tajweed_tag_ids TEXT");
  db.exec("ALTER TABLE maktab_dhor_log ADD COLUMN tajweed_tag_ids TEXT");
  db.exec("CREATE TABLE IF NOT EXISTS maktab_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, retired INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT '')");
  try { db.exec("ALTER TABLE students ADD COLUMN group_id INTEGER"); } catch (e) { /* fixture already has it */ }
  try { db.exec("ALTER TABLE maktab_settings ADD COLUMN timezone TEXT");
db.exec("ALTER TABLE maktab_settings ADD COLUMN term_from TEXT");
db.exec("ALTER TABLE maktab_settings ADD COLUMN term_to TEXT"); } catch (e) { /* fixture may lack the table or already have it */ }   // V3.80.0: 0025 rides the same try
runMig(db, '0026_maktab_calendar.sql');   // V3.87.0: terms + calendar tables


const DB = { prepare(sql) { return {
  bind(...args) { return {
    async run(){ const i = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(i.lastInsertRowid) } }; },
    async first(){ return db.prepare(sql).get(...args) ?? null; },
    async all(){ return { results: db.prepare(sql).all(...args) }; },
  }; },
  async first(){ return db.prepare(sql).get() ?? null; },
  async all(){ return { results: db.prepare(sql).all() }; },
}; } };
const env = { DB };
const TCH = { id: 'T1', role: 'teacher' };
const post = (b) => ({ json: async () => b, url: 'https://x/' });
const get = (qs) => ({ url: 'https://x/?' + qs });
const log = (sid, date) => handleSaveMaktabSabaq(post({ student_id: sid, date, sabaq_from: '2:1', sabaq_to: '2:2' }), env, TCH);

// ---- the N threshold boundary ----
{
  await log('S1', '2026-08-01');
  await log('S2', '2026-08-01');            // 2 students — below the default 3
  await log('S1', '2026-08-02');
  await log('S2', '2026-08-02');
  await log('S3', '2026-08-02');            // 3 students — a maktab day

  const md = await loadMaktabDays(env, 3);
  check('threshold: N-1 students is NOT a maktab day; N is',
    md.length === 1 && md[0] === '2026-08-02');

  const r1 = (await handleMaktabAttendance(get('date=2026-08-01'), env, TCH)).data;
  check('below threshold: isMaktabDay false and every status null — nobody is absent on a day the maktab did not run',
    r1.isMaktabDay === false && Object.values(r1.attendance).every(a => a.status === null));

  const r2 = (await handleMaktabAttendance(get('date=2026-08-02'), env, TCH)).data;
  check('at threshold: logged students present', r2.attendance.S1.status === 'present' && r2.attendance.S3.status === 'present');

  // lower the threshold and the same data yields a different answer
  db.exec('UPDATE maktab_settings SET maktab_day_min = 2 WHERE id = 1');
  const md2 = await loadMaktabDays(env, 2);
  check('threshold comes from the SETTING, not a constant', md2.length === 2);
  db.exec('UPDATE maktab_settings SET maktab_day_min = 3 WHERE id = 1');
}

// ---- absent + haidh through the real endpoint ----
{
  db.exec("INSERT INTO attendance VALUES ('S1','2026-08-02','haidh')");
  // S1 logged that day, so the log still wins even with a mark present
  let r = (await handleMaktabAttendance(get('date=2026-08-02'), env, TCH)).data;
  check('endpoint: a log beats a haidh mark', r.attendance.S1.status === 'present');

  // a fourth maktab day where only S2/S3 log: S1 has no log and no mark
  await log('S2', '2026-08-20'); await log('S3', '2026-08-20');
  // a third DISTINCT student on the day, so it clears the threshold —
  // logged by another teacher, since a teacher may not log themself.
  const t = await handleSaveMaktabSabaq(post({ student_id: 'T1', date: '2026-08-20', sabaq_from: '3:1', sabaq_to: '3:2' }), env, { id: 'T2', role: 'teacher' });
  check('setup: third distinct student logged for the day', !!(t.data && t.data.id));
  r = (await handleMaktabAttendance(get('date=2026-08-20'), env, TCH)).data;
  check('endpoint: no log, no haidh, on a maktab day → absent', r.attendance.S1.status === 'absent');
  check('endpoint: the haidh mark from 08-02 does NOT still cover 08-20 (calendar max exceeded)',
    r.attendance.S1.status === 'absent');
}

// ---- gating ----
{
  const s = await handleMaktabAttendance(get('date=2026-08-02'), env, { id: 'S1', role: 'student' });
  check('endpoint: student → 403', s.status === 403);
  const bad = await handleMaktabAttendance(get(''), env, TCH);
  check('endpoint: missing date → 400', bad.status === 400);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
