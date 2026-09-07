#!/usr/bin/env node
// V4.2.15.6 — attendance-scoped Haidh Settings backend regression.
import { DatabaseSync } from 'node:sqlite';
import { handleAttendanceHaidhSettings } from '../worker/src/maktabAttendance.js';

let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE students (
    id TEXT PRIMARY KEY, name TEXT, role TEXT, gender TEXT, track_haidh INTEGER DEFAULT 0,
    haidh_ruling TEXT, haidh_cycle_length INTEGER, haidh_period_length INTEGER, haidh_next_expected TEXT
  );
  CREATE TABLE attendance (
    student_id TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL,
    PRIMARY KEY(student_id, date)
  );
  INSERT INTO students (id,name,role,gender,track_haidh) VALUES
    ('S1','Amina','student','F',0), ('S2','Bilqees','student','F',0), ('T1','Teacher','teacher',NULL,0);
  INSERT INTO attendance (student_id,date,status) VALUES
    ('S1','2026-08-15','haidh'), ('S1','2026-08-30','predicted-haidh');
`);

const makeStmt = (sql, args = []) => ({
  _sql: sql, _args: args,
  bind(...next){ return makeStmt(sql, next); },
  async run(){ const r = db.prepare(sql).run(...args); return { success:true, meta:{ changes:r.changes } }; },
  async first(){ return db.prepare(sql).get(...args) ?? null; },
  async all(){ return { results: db.prepare(sql).all(...args) }; },
});
const env = { DB: {
  prepare(sql){ return makeStmt(sql); },
  async batch(stmts){
    db.exec('BEGIN');
    try { for(const st of stmts) db.prepare(st._sql).run(...st._args); db.exec('COMMIT'); }
    catch(e){ db.exec('ROLLBACK'); throw e; }
    return stmts.map(() => ({ success:true }));
  }
}};

const req = (body) => ({ async json(){ return body; } });
const teacher = { id:'T1', role:'teacher' };
const student2 = { id:'S2', role:'student' };

const saved = await handleAttendanceHaidhSettings(req({
  student_id:'S1', haidh_ruling:'hanafi', haidh_cycle_length:30,
  haidh_period_length:7, haidh_next_expected:'2026-10-01'
}), env, teacher);
check('teacher can save Haidh settings for the selected student on Attendance', saved.data && saved.data.saved === true && saved.data.student_id === 'S1');

const s1 = db.prepare('SELECT * FROM students WHERE id=?').get('S1');
check('save promotes the selected profile to female + Haaidha and stores all setup fields',
  s1.gender === 'F' && s1.track_haidh === 1 && s1.haidh_ruling === 'hanafi'
  && s1.haidh_cycle_length === 30 && s1.haidh_period_length === 7 && s1.haidh_next_expected === '2026-10-01');

const predictions = db.prepare("SELECT date FROM attendance WHERE student_id='S1' AND status='predicted-haidh' ORDER BY date").all();
check('save replaces predictions with four configured periods from the same next-expected model',
  predictions.length === 28 && predictions[0].date === '2026-09-01');

check('confirmed Haidh history is preserved while predictions are replaced',
  db.prepare("SELECT status FROM attendance WHERE student_id='S1' AND date='2026-08-15'").get()?.status === 'haidh');

const denied = await handleAttendanceHaidhSettings(req({
  student_id:'S1', haidh_ruling:'hanafi', haidh_cycle_length:30,
  haidh_period_length:7, haidh_next_expected:'2026-10-01'
}), env, student2);
check('a student cannot use the Attendance settings endpoint to edit another student', denied.status === 403);

const own = await handleAttendanceHaidhSettings(req({
  haidh_ruling:'shafii', haidh_cycle_length:25, haidh_period_length:5, haidh_next_expected:'2026-10-10'
}), env, student2);
check('the same endpoint safely supports a student saving only her own settings', own.data && own.data.student_id === 'S2' && own.data.haidh_ruling === 'shafii');

const invalid = await handleAttendanceHaidhSettings(req({
  student_id:'S1', haidh_ruling:'hanafi', haidh_cycle_length:18,
  haidh_period_length:7, haidh_next_expected:'2026-10-01'
}), env, teacher);
check('shared minimum-purity validation rejects an impossible cycle/duration combination', invalid.status === 400 && /at least/.test(invalid.error || ''));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
