import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import {
  handleGetMaktabSabaq, handleSaveMaktabSabaq, handleUpdateMaktabSabaq, handleDeleteMaktabSabaq,
  handleSaveMaktabSabaqDhor, handleSaveMaktabDhor, handleGetMaktabDhor,
} from '../worker/src/maktabLog.js';
import { fileURLToPath } from 'url';
// repo-relative: tests/ lives inside the repo, so the root is one up.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

let pass = 0, fail = 0;
function check(label, cond) { if (cond) pass++; else { fail++; console.log('FAIL:', label); } }

const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE students (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
  pin_hash TEXT, created_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE attendance (student_id TEXT NOT NULL, date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present','absent','haidh','predicted-haidh')),
    PRIMARY KEY (student_id, date));
  INSERT INTO students (id,name,role,created_date) VALUES
    ('STU1','Student One','student','2026-01-01'),
    ('TCH1','Ustadh Ahmed','teacher','2026-01-01'),
    ('TCH2','Ustadh Bilal','teacher','2026-01-01'),
    ('ADM1','Admin One','admin','2026-01-01');`);

// real 0019 tables, from the real migration file
const mig = fs.readFileSync(ROOT + 'worker/migrations/0019_maktab_tables.sql', 'utf8');
const noComments = mig.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
for (const st of noComments.split(';').map(s => s.trim()).filter(Boolean)) db.exec(st);
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


const DB = { prepare(sql) { return { bind(...args) { return {
  async run() { const info = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(info.lastInsertRowid) } }; },
  async first() { return db.prepare(sql).get(...args) ?? null; },
  async all() { return { results: db.prepare(sql).all(...args) }; },
}; } }; } };
const env = { DB };
const STUDENT = { id: 'STU1', role: 'student' };
const TCH1 = { id: 'TCH1', role: 'teacher' };
const TCH2 = { id: 'TCH2', role: 'teacher' };
const ADMIN = { id: 'ADM1', role: 'admin' };
const post = (b) => ({ json: async () => b, url: 'https://x/?' });
const get = (qs) => ({ url: `https://x/?${qs}` });
const del = (id) => ({ url: `https://x/?id=${id}` });
const row = (t, id) => db.prepare(`SELECT * FROM ${t} WHERE id = ?`).get(id);

// ---- role matrix: writes are teacher+ only ----
{
  const r = await handleSaveMaktabSabaq(post({ student_id: 'STU1', date: '2026-08-15', sabaq_from: '2:1', sabaq_to: '2:5' }), env, STUDENT);
  check('save: student → 403', r.status === 403);
  const r2 = await handleSaveMaktabSabaq(post({ student_id: 'STU1', date: '2026-08-15', sabaq_from: '2:1', sabaq_to: '2:5' }), env, TCH1);
  check('save: teacher → allowed', !!r2.data.id);
  const r3 = await handleSaveMaktabSabaq(post({ student_id: 'STU1', date: '2026-08-16', sabaq_from: '2:6', sabaq_to: '2:10' }), env, ADMIN);
  check('save: admin → allowed', !!r3.data.id);
  const s = row('maktab_sabaq_log', r2.data.id);
  check('teacher_id = confirming teacher', s.teacher_id === 'TCH1');
  check('teacher_name snapshot landed', s.teacher_name === 'Ustadh Ahmed');
  check('entered_by = caller too (different fact, same value on normal save)', s.entered_by === 'TCH1');
  check('visibility defaulted to teachers_only', s.teacher_feedback_visibility === 'teachers_only');
}

// ---- self-recitation blocked, admin included ----
{
  const r = await handleSaveMaktabSabaq(post({ student_id: 'TCH1', date: '2026-08-15', sabaq_from: '3:1', sabaq_to: '3:5' }), env, TCH1);
  check('self-recitation: teacher logging self → 403', r.status === 403);
  const r2 = await handleSaveMaktabSabaq(post({ student_id: 'ADM1', date: '2026-08-15', sabaq_from: '3:1', sabaq_to: '3:5' }), env, ADMIN);
  check('self-recitation: admin logging self → 403 too', r2.status === 403);
  const r3 = await handleSaveMaktabSabaq(post({ student_id: 'TCH1', date: '2026-08-15', sabaq_from: '3:1', sabaq_to: '3:5' }), env, TCH2);
  check('teacher-as-student: ANOTHER teacher logging TCH1 → allowed', !!r3.data.id);
  const r4 = await handleSaveMaktabSabaq(post({ date: '2026-08-15', sabaq_from: '3:1', sabaq_to: '3:5' }), env, TCH1);
  check('save without student_id → 400 (never defaults to auth.id)', r4.status === 400);
}

// ---- duplicates: content-only comparison, across different teachers ----
{
  const a = await handleSaveMaktabDhor(post({ student_id: 'STU1', date: '2026-08-17', segment_from: 1, segment_to: 2, ref: 'waterval' }), env, TCH1);
  check('dhor save ok', !!a.data.id);
  const b = await handleSaveMaktabDhor(post({ student_id: 'STU1', date: '2026-08-17', segment_from: 1, segment_to: 2, ref: 'waterval' }), env, TCH2);
  check('same content, DIFFERENT teacher → still flagged duplicate, not inserted', b.data.isDuplicate === true && !b.data.id);
  const c = await handleSaveMaktabDhor(post({ student_id: 'STU1', date: '2026-08-17', segment_from: 1, segment_to: 2, ref: 'waterval', force: true }), env, TCH2);
  check('force honoured, row flagged', !!c.data.id && row('maktab_dhor_log', c.data.id).is_duplicate === 1);
}

// ---- haidh overwrite: targeted, log wins ----
{
  db.exec(`INSERT INTO attendance VALUES ('STU1','2026-08-20','haidh')`);
  await handleSaveMaktabSabaqDhor(post({ student_id: 'STU1', date: '2026-08-20', zone: 'B' }), env, TCH1);
  const att = db.prepare(`SELECT status FROM attendance WHERE student_id='STU1' AND date='2026-08-20'`).get();
  check('haidh mark overwritten to present on maktab save', att.status === 'present');

  db.exec(`INSERT INTO attendance VALUES ('STU1','2026-08-21','absent')`);
  await handleSaveMaktabSabaqDhor(post({ student_id: 'STU1', date: '2026-08-21', zone: 'C' }), env, TCH1);
  check('absent row NOT touched (targeted at haidh only)',
    db.prepare(`SELECT status FROM attendance WHERE student_id='STU1' AND date='2026-08-21'`).get().status === 'absent');

  await handleSaveMaktabSabaqDhor(post({ student_id: 'STU1', date: '2026-08-22', zone: 'D' }), env, TCH1);
  check('no PJ attendance row CREATED by a maktab save (unlike PJ saves)',
    db.prepare(`SELECT 1 FROM attendance WHERE student_id='STU1' AND date='2026-08-22'`).get() === undefined);
}

// ---- notes: stamping ----
{
  const r = await handleSaveMaktabSabaq(post({ student_id: 'STU1', date: '2026-08-23', sabaq_from: '4:1', sabaq_to: '4:5',
    student_comment: 'flowed from my PJ', student_comment_private: false,
    teacher_feedback: 'recited well', teacher_feedback_visibility: 'all' }), env, TCH1);
  const s = row('maktab_sabaq_log', r.data.id);
  check('student note stamped to the STUDENT', s.student_comment === 'flowed from my PJ' && s.student_comment_by === 'STU1');
  check('teacher note stamped to the TEACHER', s.teacher_feedback === 'recited well' && s.teacher_feedback_by === 'TCH1');
  check('explicit visibility honoured', s.teacher_feedback_visibility === 'all');

  const r2 = await handleSaveMaktabSabaq(post({ student_id: 'STU1', date: '2026-08-24', sabaq_from: '4:6', sabaq_to: '4:9' }), env, TCH1);
  const s2 = row('maktab_sabaq_log', r2.data.id);
  check('note-less save: no stamps, clean row', s2.student_comment === null && s2.student_comment_by === null && s2.teacher_feedback_by === null);
}

// ---- GET: student reads own only; privacy applied ----
{
  const own = await handleGetMaktabSabaq(get('student_id=STU1'), env, STUDENT);
  check('GET: student reading own maktab logs → allowed', !own.error && Array.isArray(own.data));
  const foreign = await handleGetMaktabSabaq(get('student_id=TCH1'), env, STUDENT);
  check('GET: student reading someone else → 403', foreign.status === 403);
  const teach = await handleGetMaktabSabaq(get('student_id=STU1'), env, TCH2);
  check('GET: any teacher reads anyone → allowed', !teach.error);

  // privacy: teachers_only feedback hidden from the student, visible to a teacher
  const hidden = own.data.find(r => r.date === '2026-08-24'); // note-less row had no feedback... use 08-15 row? That one has no feedback either.
  const visRow = (await handleGetMaktabDhor(get('student_id=STU1'), env, STUDENT));
  // Add a teachers_only feedback row explicitly:
  const r = await handleSaveMaktabSabaq(post({ student_id: 'STU1', date: '2026-08-25', sabaq_from: '5:1', sabaq_to: '5:3',
    teacher_feedback: 'needs tajweed work', teacher_feedback_visibility: 'teachers_only' }), env, TCH1);
  const ownAfter = await handleGetMaktabSabaq(get('student_id=STU1'), env, STUDENT);
  const rowStudent = ownAfter.data.find(x => x.id === r.data.id);
  check('teachers_only feedback HIDDEN from the student on GET', rowStudent.teacher_feedback === null);
  const teachAfter = await handleGetMaktabSabaq(get('student_id=STU1'), env, TCH2);
  const rowTeacher = teachAfter.data.find(x => x.id === r.data.id);
  check('teachers_only feedback VISIBLE to another teacher', rowTeacher.teacher_feedback === 'needs tajweed work');
}

// ---- update: any teacher; provenance immutable; date editable ----
{
  const r = await handleSaveMaktabSabaq(post({ student_id: 'STU1', date: '2026-08-26', sabaq_from: '6:1', sabaq_to: '6:3' }), env, TCH1);
  const upd = await handleUpdateMaktabSabaq(post({ id: r.data.id, sabaq_to: '6:5', date: '2026-08-27',
    teacher_id: 'TCH2', teacher_name: 'HACKED' }), env, TCH2);
  check('update by a DIFFERENT teacher → allowed', !!upd.data);
  const s = row('maktab_sabaq_log', r.data.id);
  check('content + date updated', s.sabaq_to === '6:5' && s.date === '2026-08-27');
  check('teacher_id/teacher_name IMMUTABLE (provenance kept)', s.teacher_id === 'TCH1' && s.teacher_name === 'Ustadh Ahmed');
  const updStudent = await handleUpdateMaktabSabaq(post({ id: r.data.id, sabaq_to: '6:9' }), env, STUDENT);
  check('update by a student → 403', updStudent.status === 403);
}

// ---- delete: teacher+ only, any teacher ----
{
  const r = await handleSaveMaktabSabaq(post({ student_id: 'STU1', date: '2026-08-28', sabaq_from: '7:1', sabaq_to: '7:3' }), env, TCH1);
  const dS = await handleDeleteMaktabSabaq(del(r.data.id), env, STUDENT);
  check('delete by student → 403', dS.status === 403);
  const dT = await handleDeleteMaktabSabaq(del(r.data.id), env, TCH2);
  check('delete by a different teacher → allowed', !!dT.data);
  check('row gone, no attendance side effects (derived model)', row('maktab_sabaq_log', r.data.id) === undefined);
}

// ---- dhor lap_times round-trip ----
{
  const r = await handleSaveMaktabDhor(post({ student_id: 'STU1', date: '2026-08-29', segment_from: 3, segment_to: 4, ref: 'uthmani', lap_times: [120, 95] }), env, TCH1);
  check('lap_times stored as JSON string', typeof row('maktab_dhor_log', r.data.id).lap_times === 'string');
  const g = await handleGetMaktabDhor(get('student_id=STU1'), env, TCH1);
  const gr = g.data.find(x => x.id === r.data.id);
  check('lap_times parsed back on GET', Array.isArray(gr.lap_times) && gr.lap_times[0] === 120);
  const bad = await handleSaveMaktabDhor(post({ student_id: 'STU1', date: '2026-08-29', ref: 'NOT_A_REF' }), env, TCH1);
  check('dhor validation still enforced (bad ref → 400)', bad.status === 400);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
