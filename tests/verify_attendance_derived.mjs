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

// ---- V4.2.14: no probable propagation; predictions are explicit state ----
{
  const md = days('2026-08-02', '2026-08-05', '2026-08-09', '2026-08-11', '2026-08-15');
  const r = deriveStudentAttendance(md, [], ['2026-08-01'], 'hanafi', 30);
  check('confirmed Day 1 does not invent probable Haidh on later Maktab days',
    md.every(d => r.statuses[d] === 'absent') && !('probableHaidhDates' in r));

  const predicted = deriveStudentAttendance(
    md, [], ['2026-08-01'], 'hanafi', 30, null, [], ['2026-08-02','2026-08-05','2026-08-09']
  );
  check('explicit predictions remain predicted on their exact dates',
    predicted.statuses['2026-08-02'] === 'predicted-haidh'
    && predicted.statuses['2026-08-05'] === 'predicted-haidh'
    && predicted.statuses['2026-08-09'] === 'predicted-haidh');
  check('predictions do not propagate beyond their stored dates',
    predicted.statuses['2026-08-11'] === 'absent' && predicted.statuses['2026-08-15'] === 'absent');

  const shafii = deriveStudentAttendance(md.concat('2026-08-16'), [], ['2026-08-01'], 'shafii', 30);
  check('ruling field does not restore old Shafii/probable propagation',
    shafii.statuses['2026-08-11'] === 'absent' && shafii.statuses['2026-08-15'] === 'absent'
    && shafii.statuses['2026-08-16'] === 'absent');
}

// ---- activity/absence precedence and exact-date truth ----
{
  const r = deriveStudentAttendance(days('2026-08-20'), [], ['2026-08-01'], 'hanafi', 30);
  check('a distant Maktab day is absent unless explicitly confirmed/predicted', r.statuses['2026-08-20'] === 'absent');

  const dense = deriveStudentAttendance(days('2026-08-02','2026-08-03','2026-08-04'), [], ['2026-08-01'], 'hanafi', 30);
  check('nearby Maktab days are not silently converted to Haidh', Object.values(dense.statuses).every(v => v === 'absent'));
}

// ---- consecutive confirmed marks stay confirmed only where stored ----
{
  const r = deriveStudentAttendance(days('2026-08-02','2026-08-03','2026-08-09','2026-08-12'), [], ['2026-08-01','2026-08-02','2026-08-03'], 'hanafi', 30);
  check('stored confirmed dates remain confirmed', r.statuses['2026-08-02'] === 'haidh' && r.statuses['2026-08-03'] === 'haidh');
  check('a confirmed run does not create a probable tail', r.statuses['2026-08-09'] === 'absent' && r.statuses['2026-08-12'] === 'absent');
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
  db.exec("ALTER TABLE maktab_settings ADD COLUMN teaching_days TEXT");   // V3.98.0
db.exec("ALTER TABLE maktab_settings ADD COLUMN term_from TEXT");
db.exec("ALTER TABLE maktab_settings ADD COLUMN term_to TEXT"); } catch (e) { /* fixture may lack the table or already have it */ }   // V3.80.0: 0025 rides the same try
runMig(db, '0026_maktab_calendar.sql');   // V3.87.0: terms + calendar tables
runMig(db, '0027_calendar_dedupe.sql');


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

// ---- V4.2.14 write path: activity ends a stored Haidh/prediction run ----
{
  db.exec("INSERT OR REPLACE INTO attendance VALUES ('S1','2026-08-25','haidh')");
  db.exec("INSERT OR REPLACE INTO attendance VALUES ('S1','2026-08-26','haidh')");
  db.exec("INSERT OR REPLACE INTO attendance VALUES ('S1','2026-08-27','predicted-haidh')");
  db.exec("INSERT OR REPLACE INTO attendance VALUES ('S1','2026-09-20','predicted-haidh')");
  const saved = await log('S1', '2026-08-25');
  const same = db.prepare("SELECT status FROM attendance WHERE student_id='S1' AND date='2026-08-25'").get();
  const stale = db.prepare("SELECT date FROM attendance WHERE student_id='S1' AND date IN ('2026-08-26','2026-08-27')").all();
  const later = db.prepare("SELECT status FROM attendance WHERE student_id='S1' AND date='2026-09-20'").get();
  check('v4214 save: a Maktab log overwrites same-day stored Haidh with activity/present evidence', !!(saved.data && saved.data.id) && same && same.status === 'present');
  check('v4214 save: stale remainder is cleared without deleting a later prediction cycle', stale.length === 0 && later && later.status === 'predicted-haidh');
}

// ---- gating ----
{
  const s = await handleMaktabAttendance(get('date=2026-08-02'), env, { id: 'S1', role: 'student' });
  check('endpoint: student → 403', s.status === 403);
  const bad = await handleMaktabAttendance(get(''), env, TCH);
  check('endpoint: missing date → 400', bad.status === 400);
}

// ============================================================
// V4.0.2 — TODAY IS UNRESOLVED (user, 2026-09-01). A day still in
// progress must not mark anyone absent; only a teacher's explicit
// mark can put a status on it. The fault this covers made a
// student's PERCENTAGE dip through the day and recover when she
// logged — the stats were wrong, not just the journal's wording.
// ============================================================
{
  const TODAY = '2026-09-01';
  const week = ['2026-08-31', TODAY];
  let r = deriveStudentAttendance(week, [], [], 'hanafi', 30, TODAY);
  check('v402: yesterday still derives absent', r.statuses['2026-08-31'] === 'absent');
  check('v402: TODAY with no log yields NO status — the day has not finished', r.statuses[TODAY] === undefined);

  r = deriveStudentAttendance(week, [TODAY], [], 'hanafi', 30, TODAY);
  check('v402: a log on today still reads present', r.statuses[TODAY] === 'present');

  r = deriveStudentAttendance(week, [], [], 'hanafi', 30, TODAY, [TODAY]);
  check("v402: a TEACHER'S explicit absent mark stands on today", r.statuses[TODAY] === 'absent');

  r = deriveStudentAttendance(week, [], [TODAY], 'hanafi', 30, TODAY);
  check('v402: haidh on today still wins over the unresolved rule', r.statuses[TODAY] === 'haidh');

  const days = Object.values(deriveStudentAttendance(week, [], [], 'hanafi', 30, TODAY).statuses);
  check('v402: only resolved days carry a status, so today cannot drag the percentage',
    days.length === 1 && days[0] === 'absent');

  r = deriveStudentAttendance(week, [], [], 'hanafi', 30);
  check('v402: with no today passed, nothing is filtered (the pure function stays honest)',
    r.statuses[TODAY] === 'absent');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
