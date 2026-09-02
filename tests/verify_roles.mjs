import { DatabaseSync } from 'node:sqlite';
import { isTeacherOrAbove } from '../worker/src/utils.js';
import { handleGetSabaq, handleSaveSabaq } from '../worker/src/sabaqLog.js';
import { handleGetSabaqDhor, handleSaveSabaqDhor } from '../worker/src/sabaqDhorLog.js';
import { handleGetDhor, handleSaveDhor } from '../worker/src/dhorLog.js';
import { handleGetReflections, handleSaveReflection } from '../worker/src/reflections.js';
import { handleGetPlans } from '../worker/src/plans.js';
import { handleGetPosition } from '../worker/src/position.js';
import { handleGetAttendance, handleSetAttendance } from '../worker/src/attendance.js';

let pass = 0, fail = 0;
function check(label, cond) { if (cond) pass++; else { fail++; console.log('FAIL:', label); } }

// ---------- helper unit checks ----------
check('helper: teacher → true', isTeacherOrAbove({ id: 'T', role: 'teacher' }) === true);
check('helper: admin → true', isTeacherOrAbove({ id: 'A', role: 'admin' }) === true);
check('helper: student → false', isTeacherOrAbove({ id: 'S', role: 'student' }) === false);
check('helper: null → false', isTeacherOrAbove(null) === false);
check('helper: undefined → false', isTeacherOrAbove(undefined) === false);
check('helper: unknown role → false', isTeacherOrAbove({ id: 'X', role: 'superuser' }) === false);
check('helper: missing role → false', isTeacherOrAbove({ id: 'X' }) === false);

// ---------- real schema ----------
const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE students (id TEXT PRIMARY KEY, name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student','teacher','admin')),
    pin_hash TEXT, created_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE attendance (student_id TEXT NOT NULL, date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present','absent','haidh','predicted-haidh')),
    PRIMARY KEY (student_id, date));
  CREATE TABLE sabaq_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, date TEXT NOT NULL,
    entered_by TEXT NOT NULL, sabaq_from TEXT, sabaq_to TEXT, tajweed_tags TEXT, tajweed_tag_ids TEXT, line_count INTEGER, page_count INTEGER,
    student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT,
    teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT,
    student_comment_private INTEGER, teacher_feedback_visibility TEXT,
    is_duplicate INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, maktab_log_id INTEGER, maktab_teacher TEXT);
  CREATE UNIQUE INDEX idx_sabaq_log_mkid ON sabaq_log (maktab_log_id);
  CREATE TABLE sabaq_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, date TEXT NOT NULL,
    entered_by TEXT NOT NULL, zone TEXT, tajweed_tags TEXT, tajweed_tag_ids TEXT, mistakes INTEGER,
    from_surah INTEGER, from_ayah INTEGER, to_surah INTEGER, to_ayah INTEGER,
    student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT,
    teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT,
    student_comment_private INTEGER, teacher_feedback_visibility TEXT,
    is_duplicate INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, maktab_log_id INTEGER, maktab_teacher TEXT);
  CREATE UNIQUE INDEX idx_sabaq_dhor_log_mkid ON sabaq_dhor_log (maktab_log_id);
  CREATE TABLE dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, date TEXT NOT NULL,
    entered_by TEXT NOT NULL, segment_from INTEGER, segment_to INTEGER, ref TEXT, tajweed_tags TEXT, tajweed_tag_ids TEXT,
    mistakes INTEGER, duration_seconds INTEGER, lap_times TEXT,
    student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT,
    teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT,
    student_comment_private INTEGER, teacher_feedback_visibility TEXT,
    is_duplicate INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, maktab_log_id INTEGER, maktab_teacher TEXT);
  CREATE UNIQUE INDEX idx_dhor_log_mkid ON dhor_log (maktab_log_id);
  CREATE TABLE reflections (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, date TEXT NOT NULL,
    entered_by TEXT NOT NULL, reflection TEXT, is_private INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
  CREATE TABLE plans (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, entered_by TEXT NOT NULL,
    plan_type TEXT NOT NULL, target_date TEXT NOT NULL, segment_from INTEGER, segment_to INTEGER, ref TEXT,
    surah INTEGER, ayah_from INTEGER, ayah_to INTEGER, notes TEXT, status TEXT NOT NULL DEFAULT 'planned',
    completed_log_id INTEGER, completed_at TEXT, created_at TEXT NOT NULL);
  CREATE TABLE position (student_id TEXT PRIMARY KEY, position_json TEXT, last_dhor_json TEXT, updated_at TEXT);
  INSERT INTO students (id, name, role, created_date) VALUES
    ('STU1','Student One','student','2026-01-01'),
    ('STU2','Student Two','student','2026-01-01'),
    ('TCH1','Teacher One','teacher','2026-01-01'),
    ('ADM1','Admin One','admin','2026-01-01');
`);

// V3.83.0 (k): the merged own-read unions the maktab log tables, so the
// fixture must have them (empty is fine — the union of nothing changes
// no role outcome, which is exactly what this harness checks).
db.exec(`
  CREATE TABLE maktab_sabaq_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT, entered_by TEXT, teacher_id TEXT, teacher_name TEXT, sabaq_from TEXT, sabaq_to TEXT, tajweed_tag_ids TEXT, line_count INTEGER, page_count INTEGER, student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT, student_comment_private INTEGER DEFAULT 0, teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT, teacher_feedback_visibility TEXT DEFAULT 'teachers_only', is_duplicate INTEGER DEFAULT 0, created_at TEXT);
  CREATE TABLE maktab_sabaq_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT, entered_by TEXT, teacher_id TEXT, teacher_name TEXT, from_surah INTEGER, from_ayah INTEGER, to_surah INTEGER, to_ayah INTEGER, tajweed_tag_ids TEXT, mistakes INTEGER, student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT, student_comment_private INTEGER DEFAULT 0, teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT, teacher_feedback_visibility TEXT DEFAULT 'teachers_only', is_duplicate INTEGER DEFAULT 0, created_at TEXT);
  CREATE TABLE maktab_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT, entered_by TEXT, teacher_id TEXT, teacher_name TEXT, segment_from INTEGER, segment_to INTEGER, ref TEXT, tajweed_tag_ids TEXT, mistakes INTEGER, duration_seconds INTEGER, lap_times TEXT, student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT, student_comment_private INTEGER DEFAULT 0, teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT, teacher_feedback_visibility TEXT DEFAULT 'teachers_only', is_duplicate INTEGER DEFAULT 0, created_at TEXT);
`);

const DB = { prepare(sql) { return { bind(...args) { return {
  async run() { const info = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(info.lastInsertRowid) } }; },
  async first() { return db.prepare(sql).get(...args) ?? null; },
  async all() { return { results: db.prepare(sql).all(...args) }; },
}; } }; } };
const env = { DB };

const STUDENT = { id: 'STU1', role: 'student' };
const TEACHER = { id: 'TCH1', role: 'teacher' };
const ADMIN   = { id: 'ADM1', role: 'admin' };
const TARGET  = 'STU2'; // "another student's" data

const getReq = (qs) => ({ url: `https://x/?${qs}` });
const postReq = (body) => ({ json: async () => body, url: 'https://x/?' });

// ---------- GET-side gates: `!isTeacherOrAbove(auth) && studentId !== auth.id → 403` ----------
const GETS = [
  ['sabaq',      (a) => handleGetSabaq(getReq(`student_id=${TARGET}`), env, a)],
  ['sabaqDhor',  (a) => handleGetSabaqDhor(getReq(`student_id=${TARGET}`), env, a)],
  ['dhor',       (a) => handleGetDhor(getReq(`student_id=${TARGET}`), env, a)],
  ['reflections',(a) => handleGetReflections(getReq(`student_id=${TARGET}`), env, a)],
  ['plans',      (a) => handleGetPlans(getReq(`student_id=${TARGET}`), env, a)],
  ['position',   (a) => handleGetPosition(getReq(`student_id=${TARGET}`), env, a)],
  ['attendance', (a) => handleGetAttendance(getReq(`student_id=${TARGET}`), env, a)],
];
for (const [name, fn] of GETS) {
  const s = await fn(STUDENT), t = await fn(TEACHER), a = await fn(ADMIN);
  check(`GET ${name}: student reading another student → 403`, s.status === 403);
  check(`GET ${name}: teacher → allowed (no 403)`, t.status !== 403 && !t.error);
  check(`GET ${name}: admin → allowed, same as teacher (THE behaviour change)`, a.status !== 403 && !a.error);
}

// ---------- POST-side gates: `isTeacherOrAbove(auth) && body.student_id ? body.student_id : auth.id` ----------
// A student passing student_id for someone else gets it silently ignored → row lands on THEIR OWN id.
// A teacher/admin passing it → row lands on the TARGET.
async function whoGotTheRow(table, dateKey) {
  return db.prepare(`SELECT student_id FROM ${table} WHERE date = ?`).get(dateKey)?.student_id ?? null;
}
const POSTS = [
  ['sabaq',      'sabaq_log',      (a, d) => handleSaveSabaq(postReq({ student_id: TARGET, date: d, sabaq_from: '2:1', sabaq_to: '2:3' }), env, a)],
  ['sabaqDhor',  'sabaq_dhor_log', (a, d) => handleSaveSabaqDhor(postReq({ student_id: TARGET, date: d, zone: 'A' }), env, a)],
  ['dhor',       'dhor_log',       (a, d) => handleSaveDhor(postReq({ student_id: TARGET, date: d, segment_from: 1, segment_to: 1, ref: 'waterval' }), env, a)],
  ['reflection', 'reflections',    (a, d) => handleSaveReflection(postReq({ student_id: TARGET, date: d, reflection: 'x' }), env, a)],
];
let day = 1;
for (const [name, table, fn] of POSTS) {
  const dS = `2026-09-${String(day++).padStart(2,'0')}`;
  const dT = `2026-09-${String(day++).padStart(2,'0')}`;
  const dA = `2026-09-${String(day++).padStart(2,'0')}`;
  await fn(STUDENT, dS); await fn(TEACHER, dT); await fn(ADMIN, dA);
  check(`POST ${name}: student's student_id ignored → row on STU1 (own id)`, await whoGotTheRow(table, dS) === 'STU1');
  check(`POST ${name}: teacher's student_id honoured → row on STU2`, await whoGotTheRow(table, dT) === TARGET);
  check(`POST ${name}: admin's student_id NOW honoured → row on STU2 (THE behaviour change)`, await whoGotTheRow(table, dA) === TARGET);
}

// attendance POST (handleSetAttendance) — same pattern
{
  await handleSetAttendance(postReq({ student_id: TARGET, date: '2026-10-01', status: 'absent' }), env, STUDENT);
  await handleSetAttendance(postReq({ student_id: TARGET, date: '2026-10-02', status: 'absent' }), env, TEACHER);
  await handleSetAttendance(postReq({ student_id: TARGET, date: '2026-10-03', status: 'absent' }), env, ADMIN);
  const who = (d) => db.prepare('SELECT student_id FROM attendance WHERE date = ?').get(d)?.student_id ?? null;
  check('POST attendance: student → own id', who('2026-10-01') === 'STU1');
  check('POST attendance: teacher → STU2', who('2026-10-02') === TARGET);
  check('POST attendance: admin → STU2 (THE behaviour change)', who('2026-10-03') === TARGET);
}

// ---------- unchanged: a student can still read/write THEIR OWN data ----------
{
  const own = await handleGetSabaq(getReq(`student_id=STU1`), env, STUDENT);
  check('student reading own data still allowed', own.status !== 403 && !own.error);
  const noParam = await handleGetSabaq(getReq(''), env, STUDENT);
  check('student with no student_id param → own data, allowed', noParam.status !== 403 && !noParam.error);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
