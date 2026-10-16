#!/usr/bin/env node
// V4.2.15.1 — Admin registration can initialise Haidh setup + predictions.
import { createDatabase, d1Database } from './helpers/database.mjs';
import { handleRegisterStudent } from '../worker/src/admin.js';

let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

function makeEnv(){
  const db = createDatabase();
  return { env:{ DB:d1Database(db) }, db };
}

const valid = makeEnv();
const validRequest = new Request('https://x/admin/register-student', {
  method:'POST', headers:{'content-type':'application/json'},
  body: JSON.stringify({
    name:'Aisha Example', whatsapp_number:'+27123456789', force:false,
    gender:'F', track_haidh:true, haidh_ruling:'hanafi',
    haidh_cycle_length:28, haidh_period_length:7, haidh_next_expected:'2026-09-20'
  })
});
const result = await handleRegisterStudent(validRequest, valid.env, { id:'ADMIN', role:'admin' });
check('valid Haaidha registration succeeds', !!result.data && !result.error && result.data.track_haidh === true);
const student = valid.db.prepare('SELECT * FROM students WHERE id = ?').get(result.data?.id || '');
check('registration persists all Haidh setup fields on the student',
  student && student.gender === 'F' && student.track_haidh === 1 && student.haidh_ruling === 'hanafi'
  && student.haidh_cycle_length === 28 && student.haidh_period_length === 7 && student.haidh_next_expected === '2026-09-20');
const predictions = valid.db.prepare("SELECT date,status FROM attendance WHERE student_id = ? ORDER BY date").all(result.data?.id || '');
check('registration creates the same four planned Haidh periods as Personal Journal setup',
  predictions.length === 28 && predictions.every(r => r.status === 'predicted-haidh'));
check('first predicted period starts one cycle before next expected and later cycles include next expected',
  predictions[0]?.date === '2026-08-23' && predictions.some(r => r.date === '2026-09-20'));

const invalid = makeEnv();
const invalidRequest = new Request('https://x/admin/register-student', {
  method:'POST', headers:{'content-type':'application/json'},
  body: JSON.stringify({
    name:'Invalid Cycle', gender:'F', track_haidh:true, haidh_ruling:'hanafi',
    haidh_cycle_length:20, haidh_period_length:7, haidh_next_expected:'2026-09-20'
  })
});
const rejected = await handleRegisterStudent(invalidRequest, invalid.env, { id:'ADMIN', role:'admin' });
check('too-short purity/cycle setup is rejected by shared rule', rejected.status === 400 && /at least 22 days/.test(rejected.error || ''));
check('invalid Haidh setup leaves no partial student or prediction rows',
  invalid.db.prepare('SELECT COUNT(*) AS n FROM students').get().n === 0
  && invalid.db.prepare('SELECT COUNT(*) AS n FROM attendance').get().n === 0);

const male = makeEnv();
const maleRequest = new Request('https://x/admin/register-student', {
  method:'POST', headers:{'content-type':'application/json'},
  body: JSON.stringify({ name:'Male Example', gender:'M', track_haidh:true })
});
const maleResult = await handleRegisterStudent(maleRequest, male.env, { id:'ADMIN', role:'admin' });
const maleStudent = male.db.prepare('SELECT * FROM students WHERE id = ?').get(maleResult.data?.id || '');
check('track_haidh is never enabled for a non-female registration',
  maleStudent && maleStudent.track_haidh === 0 && maleStudent.haidh_ruling === 'hanafi'
  && male.db.prepare('SELECT COUNT(*) AS n FROM attendance').get().n === 0);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
