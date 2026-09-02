#!/usr/bin/env node
// V4.2.13 — attendance/Haidh derivation audit regression.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import {
  deriveStudentAttendance,
  deriveProbableHaidhDates,
  summarizeAttendancePeriod,
  handleAttendancePage,
  handleMaktabRegister,
} from '../worker/src/maktabAttendance.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass=0, fail=0;
const check=(label,cond)=>{ if(cond) pass++; else { fail++; console.log('FAIL:',label); } };

// ---- pure state-model proofs ----
const ammarahDays=['2026-08-25','2026-08-26','2026-08-27','2026-08-31','2026-09-01','2026-09-02'];
const ammarah=deriveStudentAttendance(
  ammarahDays,
  new Set(['2026-08-31','2026-09-02']),
  ['2026-08-25','2026-08-26','2026-08-27'],
  'hanafi',30,'2026-09-03',[],[]
);
check('Ammarah pattern: later log terminates earlier Haidh assumption',
  ammarah.statuses['2026-08-31']==='present' && ammarah.statuses['2026-09-01']==='absent' && ammarah.statuses['2026-09-02']==='present');
check('probable calendar run stops before the return log and never resumes afterward',
  ammarah.probableHaidhDates.includes('2026-08-30') && !ammarah.probableHaidhDates.includes('2026-09-01'));

const absentStop=deriveProbableHaidhDates(['2026-08-25'], new Set(), ['2026-08-28'], 'hanafi');
check('explicit teacher Absent terminates probable Haidh instead of only overriding one date',
  absentStop.includes('2026-08-27') && !absentStop.includes('2026-08-29'));

const newRun=deriveStudentAttendance(
  ['2026-08-25','2026-08-31','2026-09-01','2026-09-02'],
  new Set(['2026-08-31']), ['2026-08-25','2026-09-01'], 'hanafi',30,'2026-09-03',[],[]
);
check('a confirmed mark after a stopping log can start a fresh Haidh run',
  newRun.statuses['2026-08-31']==='present' && newRun.statuses['2026-09-01']==='haidh' && newRun.statuses['2026-09-02']==='probable-haidh');

const calendarProbable=deriveProbableHaidhDates(['2026-08-27'], new Set(), [], 'hanafi');
check('probable Haidh is calendar-day state and includes non-Maktab/weekend dates',
  calendarProbable.includes('2026-08-28') && calendarProbable.includes('2026-08-29') && calendarProbable.includes('2026-08-30'));

const prediction=deriveStudentAttendance(
  ['2026-09-01','2026-09-02'], new Set(), [], 'hanafi',30,'2026-09-03',[],['2026-09-01']
);
check('a prediction keeps its exact-date legacy state but cannot seed extra probable Haidh',
  prediction.statuses['2026-09-01']==='haidh' && prediction.statuses['2026-09-02']==='absent' && !prediction.probableHaidhDates.length);

const counts=summarizeAttendancePeriod(
  ['2026-09-01','2026-09-02','2026-09-03','2026-09-04'],
  {'2026-09-01':'present','2026-09-02':'haidh','2026-09-03':'probable-haidh','2026-09-04':'absent'},
  '2026-09-01','2026-09-04'
);
check('reporting separates active, Haidh/probable and absent while keeping attendance percentage',
  counts.active_days===1 && counts.haidh_days===2 && counts.probable_haidh_days===1 && counts.absent_dates.length===1 && counts.percent===75);

const unresolved=summarizeAttendancePeriod(
  ['2026-09-01','2026-09-02'], {'2026-09-01':'present'}, '2026-09-01','2026-09-02'
);
check('unresolved current day is excluded from the denominator rather than counted as Present',
  unresolved.periodDays.length===1 && unresolved.active_days===1 && unresolved.percent===100);

const streakUnresolved=deriveStudentAttendance(['2026-09-01','2026-09-02'],new Set(),[],'hanafi',2,'2026-09-02',[],[]);
const streakLoggedToday=deriveStudentAttendance(['2026-09-01','2026-09-02'],new Set(['2026-09-02']),[],'hanafi',2,'2026-09-02',[],[]);
check('unlogged today does not prematurely extend the no-log warning streak', streakUnresolved.noLogStreak===1 && !streakUnresolved.flagged);
check('a real log today still resets the no-log warning streak immediately', streakLoggedToday.noLogStreak===0);

// ---- active UI contract ----
const attJs=read('js/haidhDetailScreen.js');
const regJs=read('js/maktabAttendancePage.js');
check('individual Attendance UI reports active and Haidh separately',
  /activeDays/.test(attJs) && /Haidh/.test(attJs) && /% attendance/.test(attJs) && !/Present on \$\{d\.present_days\}/.test(attJs));
check('register distinguishes probable Haidh from confirmed Haidh',
  /status === 'probable-haidh'/.test(regJs) && /Probable Haidh/.test(regJs));
check('calendar range evidence explicitly excludes probable Haidh',
  /status === 'haidh' \|\| \(status === 'predicted-haidh' && prev <= today\)/.test(attJs));

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
db.exec(`INSERT INTO students (id,name,role,active,track_haidh,haidh_ruling) VALUES ('L','Logger','student',1,0,'hanafi'),('A','Ammarah','student',1,1,'hanafi'),('P','Probable','student',1,1,'hanafi')`);
// Aug 31 is BEFORE the displayed term and is the stop evidence the old register query clipped away.
db.exec(`INSERT INTO maktab_sabaq_log (student_id,date) VALUES ('L','2026-09-01'),('L','2026-09-02'),('A','2026-08-31')`);
db.exec(`INSERT INTO attendance (student_id,date,status) VALUES ('A','2026-08-25','haidh'),('P','2026-09-01','haidh')`);
const stmt=(sql,args)=>({
 async run(){const r=db.prepare(sql).run(...args);return {meta:{last_row_id:Number(r.lastInsertRowid)}};},
 async first(){return db.prepare(sql).get(...args)??null;},
 async all(){return {results:db.prepare(sql).all(...args)};},
});
const env={DB:{prepare(sql){return Object.assign(stmt(sql,[]),{bind(...args){return stmt(sql,args);}});}}};
const auth={id:'T',role:'teacher'};
const page=(await handleAttendancePage({url:'https://x/attendance/page?student_id=A&from=2026-09-01&to=2026-09-03'},env,auth)).data;
const register=(await handleMaktabRegister({url:'https://x/maktab/attendance-register?term_id=1'},env,auth)).data;
const row=register.students.find(s=>s.id==='A');
const probableRow=register.students.find(s=>s.id==='P');
check('pre-term log stop evidence is respected by individual page', page.absent_dates.includes('2026-09-01') && !page.probable_haidh_dates.includes('2026-09-01'));
check('register uses the same full historical stop evidence as individual page', row && row.cells['2026-09-01']==='' && row.attendance_percent===page.percent);
check('calendar receives probable calendar days before the stopping log, including non-Maktab days',
  page.probable_haidh_dates.includes('2026-08-30') && !page.probable_haidh_dates.includes('2026-09-01'));
check('term register paints probable Haidh on a teaching day even when that date is not a qualifying Maktab day',
  probableRow && probableRow.cells['2026-09-03']==='probable-haidh');
check('endpoint reporting exposes active/Haidh/absence counts without relabelling Haidh as present',
  Number.isInteger(page.active_days) && Number.isInteger(page.haidh_days) && Number.isInteger(page.probable_haidh_days) && Array.isArray(page.absent_dates));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
