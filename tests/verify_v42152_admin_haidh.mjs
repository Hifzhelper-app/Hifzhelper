#!/usr/bin/env node
// V4.2.15.2 — Student Management Haidh pill backend persistence/prediction regression.
import { createDatabase, d1Database } from './helpers/database.mjs';
import { handleListUsers, handleUpdateUser } from '../worker/src/admin.js';

let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const db = createDatabase();
db.exec(`
  INSERT INTO students (id,name,role,active,created_date,gender,track_haidh)
    VALUES ('S1','Amina','student',1,'2026-01-01','F',0);
  INSERT INTO attendance (student_id,date,status) VALUES ('S1','2026-08-15','haidh');
  INSERT INTO attendance (student_id,date,status) VALUES ('S1','2026-08-30','predicted-haidh');
`);
const env = { DB:d1Database(db) };
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
