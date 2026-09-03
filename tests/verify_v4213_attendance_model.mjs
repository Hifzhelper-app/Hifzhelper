#!/usr/bin/env node
// V4.2.14 compatibility audit — V4.2.13 probable propagation is intentionally
// retired in favour of one confirmed/predicted/activity timeline.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import {
  deriveStudentAttendance,
  summarizeAttendancePeriod,
  handleAttendancePage,
  handleMaktabRegister,
} from '../worker/src/maktabAttendance.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass=0, fail=0;
const check=(label,cond)=>{ if(cond) pass++; else { fail++; console.log('FAIL:',label); } };

// ---- pure state-model proofs ----
const days=['2026-08-25','2026-08-26','2026-08-27','2026-08-31','2026-09-01','2026-09-02'];
const stopped=deriveStudentAttendance(
  days,
  new Set(['2026-08-31','2026-09-02']),
  ['2026-08-25','2026-08-26','2026-08-27'],
  'hanafi',30,'2026-09-03',[],[]
);
check('later Maktab activity terminates the earlier Haidh episode and wins that day',
  stopped.statuses['2026-08-31']==='present' && stopped.statuses['2026-09-01']==='absent' && stopped.statuses['2026-09-02']==='present');
check('V4.2.14 exposes no third/probable Haidh state', !('probableHaidhDates' in stopped));

const absentStop=deriveStudentAttendance(
  ['2026-08-25','2026-08-26','2026-08-27','2026-08-28','2026-08-29'],
  new Set(), ['2026-08-25','2026-08-26','2026-08-27','2026-08-28','2026-08-29'],
  'hanafi',30,'2026-09-03',['2026-08-28'],[]
);
check('explicit teacher Absent stops the episode and stale confirmed rows cannot resume it',
  absentStop.statuses['2026-08-27']==='haidh' && absentStop.statuses['2026-08-28']==='absent' && absentStop.statuses['2026-08-29']==='absent');

const prediction=deriveStudentAttendance(
  ['2026-09-01','2026-09-02'], new Set(), [], 'hanafi',30,'2026-09-03',[],['2026-09-01']
);
check('a past prediction remains predicted until explicitly confirmed',
  prediction.statuses['2026-09-01']==='predicted-haidh' && prediction.statuses['2026-09-02']==='absent');

const counts=summarizeAttendancePeriod(
  ['2026-09-01','2026-09-02','2026-09-03','2026-09-04'],
  {'2026-09-01':'present','2026-09-02':'haidh','2026-09-03':'predicted-haidh','2026-09-04':'absent'},
  '2026-09-01','2026-09-04'
);
check('reporting separates active, confirmed/predicted Haidh and absent',
  counts.active_days===1 && counts.confirmed_haidh_days===1 && counts.predicted_haidh_days===1
  && counts.haidh_days===2 && counts.absent_dates.length===1 && counts.percent===75);

const unresolved=summarizeAttendancePeriod(
  ['2026-09-01','2026-09-02'], {'2026-09-01':'present'}, '2026-09-01','2026-09-02'
);
check('unresolved current/future state stays out of the denominator', unresolved.periodDays.length===1 && unresolved.percent===100);

const streakUnresolved=deriveStudentAttendance(['2026-09-01','2026-09-02'],new Set(),[],'hanafi',2,'2026-09-02',[],[]);
const streakLoggedToday=deriveStudentAttendance(['2026-09-01','2026-09-02'],new Set(['2026-09-02']),[],'hanafi',2,'2026-09-02',[],[]);
check('unlogged today does not prematurely extend no-log warning streak', streakUnresolved.noLogStreak===1 && !streakUnresolved.flagged);
check('a real log today resets no-log warning streak', streakLoggedToday.noLogStreak===0);

// ---- active UI contract ----
const attJs=read('js/haidhDetailScreen.js');
const regJs=read('js/maktabAttendancePage.js');
const summaryJs=read('js/maktabSummary.js');
check('individual Attendance UI no longer carries probable Haidh', !/probable[-_ ]haidh/i.test(attJs));
check('calendar consumes explicit activity and keeps predictions distinct',
  /row\.status === 'activity'/.test(attJs) && /haidh-cal-day-activity/.test(attJs) && /status === 'predicted-haidh'/.test(attJs));
check('register renders plain confirmed H and predicted h text',
  /mkregister-status-haidh-confirmed[^>]*[^]*?>H<\/span>/.test(regJs)
  && /mkregister-status-haidh-predicted[^>]*[^]*?>h<\/span>/.test(regJs));
check('Maktab Summary has no pink Haidh note/raw attendance fallback',
  !/td\.textContent = 'Haidh'/.test(summaryJs) && !/data\.attendance/.test(summaryJs));

// ---- endpoint parity + historical stop evidence ----
const db=new DatabaseSync(':memory:');
db.exec(`
 CREATE TABLE students (id TEXT PRIMARY KEY,name TEXT,role TEXT,active INTEGER DEFAULT 1,track_haidh INTEGER DEFAULT 0,haidh_ruling TEXT DEFAULT 'hanafi');
 CREATE TABLE maktab_settings (id INTEGER PRIMARY KEY,mushaf TEXT,maktab_day_min INTEGER DEFAULT 1,absence_flag_days INTEGER DEFAULT 30,name TEXT,timezone TEXT,term_from TEXT,term_to TEXT,teaching_days TEXT);
 CREATE TABLE attendance (student_id TEXT,date TEXT,status TEXT,PRIMARY KEY(student_id,date));
 CREATE TABLE maktab_sabaq_log (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id TEXT,date TEXT);
 CREATE TABLE maktab_sabaq_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id TEXT,date TEXT);
 CREATE TABLE maktab_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT,student_id TEXT,date TEXT);
 CREATE TABLE maktab_terms (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,term_from TEXT NOT NULL,term_to TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
db.exec(`INSERT INTO maktab_settings (id,maktab_day_min,absence_flag_days,teaching_days,timezone) VALUES (1,1,30,'["mon","tue","wed","thu"]','UTC')`);
db.exec(`INSERT INTO maktab_terms (id,name,term_from,term_to) VALUES (1,'Audit Term','2026-09-01','2026-09-03')`);
db.exec(`INSERT INTO students (id,name,role,active,track_haidh,haidh_ruling) VALUES ('L','Logger','student',1,0,'hanafi'),('A','Ammarah','student',1,1,'hanafi'),('P','Predicted','student',1,1,'hanafi')`);
// Make each displayed date a qualifying Maktab day. Ammarah's 31 Aug log is
// stop evidence before the displayed term, proving normalization is historical.
db.exec(`INSERT INTO maktab_sabaq_log (student_id,date) VALUES ('L','2026-09-01'),('L','2026-09-02'),('L','2026-09-03'),('A','2026-08-31')`);
db.exec(`INSERT INTO attendance (student_id,date,status) VALUES ('A','2026-08-25','haidh'),('A','2026-09-01','haidh'),('P','2026-09-02','predicted-haidh')`);
const stmt=(sql,args)=>({
 async run(){const r=db.prepare(sql).run(...args);return {meta:{last_row_id:Number(r.lastInsertRowid)}};},
 async first(){return db.prepare(sql).get(...args)??null;},
 async all(){return {results:db.prepare(sql).all(...args)};},
});
const env={DB:{prepare(sql){return Object.assign(stmt(sql,[]),{bind(...args){return stmt(sql,args);}});}}};
const auth={id:'T',role:'teacher'};
const page=(await handleAttendancePage({url:'https://x/attendance/page?student_id=A&from=2026-09-01&to=2026-09-03'},env,auth)).data;
const register=(await handleMaktabRegister({url:'https://x/maktab/attendance-register?term_id=1'},env,auth)).data;
const aRow=register.students.find(s=>s.id==='A');
const pRow=register.students.find(s=>s.id==='P');
check('pre-term activity stop suppresses stale resumed confirmed Haidh on the individual page', page.absent_dates.includes('2026-09-01'));
check('register uses the same normalized stop evidence (Absent is blank by contract)', aRow && aRow.cells['2026-09-01']==='');
check('an explicit prediction remains predicted in the register', pRow && pRow.cells['2026-09-02']==='predicted-haidh');
check('page exposes predicted dates/counts and no probable field',
  Array.isArray(page.predicted_haidh_dates) && Number.isInteger(page.predicted_haidh_days) && !('probable_haidh_dates' in page));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
