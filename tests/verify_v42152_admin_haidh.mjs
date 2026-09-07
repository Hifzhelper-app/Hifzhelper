#!/usr/bin/env node
// V4.2.15.2 — Student Management Haidh pill backend persistence/prediction regression.
import { DatabaseSync } from 'node:sqlite';
import { handleListUsers, handleUpdateUser } from '../worker/src/admin.js';

let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE students (
    id TEXT PRIMARY KEY, name TEXT, role TEXT, active INTEGER, created_date TEXT,
    gender TEXT, setup_complete INTEGER DEFAULT 0, whatsapp_number TEXT, group_id INTEGER,
    track_haidh INTEGER DEFAULT 0, haidh_ruling TEXT, haidh_cycle_length INTEGER,
    haidh_period_length INTEGER, haidh_next_expected TEXT
  );
  CREATE TABLE attendance (
    student_id TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL,
    PRIMARY KEY(student_id, date)
  );
  CREATE TABLE maktab_groups (id INTEGER PRIMARY KEY, retired INTEGER DEFAULT 0);
  INSERT INTO students (id,name,role,active,created_date,gender,track_haidh)
    VALUES ('S1','Amina','student',1,'2026-01-01','F',0);
  INSERT INTO attendance (student_id,date,status) VALUES ('S1','2026-08-15','haidh');
  INSERT INTO attendance (student_id,date,status) VALUES ('S1','2026-08-30','predicted-haidh');
`);

const makeStmt = (sql, args = []) => ({
  _sql: sql, _args: args,
  bind(...next){ return makeStmt(sql, next); },
  async run(){ const r = db.prepare(sql).run(...args); return { success:true, meta:{ changes:r.changes, last_row_id:Number(r.lastInsertRowid || 0) } }; },
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
const auth = { id:'ADMIN', role:'admin' };

const before = (await handleListUsers({url:'https://x/admin/users'}, env, auth)).data[0];
check('admin list exposes Haidh setup fields even when setup is incomplete',
  Object.prototype.hasOwnProperty.call(before, 'track_haidh')
  && Object.prototype.hasOwnProperty.call(before, 'haidh_ruling')
  && Object.prototype.hasOwnProperty.call(before, 'haidh_next_expected'));

const req = { async json(){ return {
  id:'S1', gender:'F', track_haidh:true, haidh_ruling:'hanafi',
  haidh_cycle_length:30, haidh_period_length:7, haidh_next_expected:'2026-10-01'
}; }};
const saved = await handleUpdateUser(req, env, auth);
check('Haidh profile update succeeds through the existing admin update endpoint', saved.data && saved.data.saved === true);

const row = db.prepare('SELECT * FROM students WHERE id = ?').get('S1');
check('completed profile fields are stored on the student',
  row.gender === 'F' && row.track_haidh === 1 && row.haidh_ruling === 'hanafi'
  && row.haidh_cycle_length === 30 && row.haidh_period_length === 7 && row.haidh_next_expected === '2026-10-01');

const predicted = db.prepare("SELECT date,status FROM attendance WHERE student_id='S1' AND status='predicted-haidh' ORDER BY date").all();
check('saving replaces the old prediction set with four configured prediction periods',
  predicted.length === 28 && predicted[0].date === '2026-09-01');

const confirmed = db.prepare("SELECT status FROM attendance WHERE student_id='S1' AND date='2026-08-15'").get();
check('saving Haidh settings does not delete confirmed Haidh history', confirmed && confirmed.status === 'haidh');

const listed = (await handleListUsers({url:'https://x/admin/users'}, env, auth)).data[0];
check('subsequent Student Management load receives the completed profile',
  listed.track_haidh === 1 && listed.haidh_cycle_length === 30 && listed.haidh_period_length === 7 && listed.haidh_next_expected === '2026-10-01');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
