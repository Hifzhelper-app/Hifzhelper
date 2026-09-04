#!/usr/bin/env node
// V4.2.14.1 supersession of the V4.2.11.4 probable-Haidh UI contract.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { handleAttendancePage, handleMaktabRegister } from '../worker/src/maktabAttendance.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const summary = read('js/maktabSummary.js');
const haidh = read('js/haidhDetailScreen.js');
const haidhCss = read('css/haidh.css');
const register = read('js/maktabAttendancePage.js');
const registerCss = read('css/detail-pages.css');
const worker = read('worker/src/maktabAttendance.js');
const html = read('index.html');
const sw = read('js/sw.js');

check('summary attendance icon remains neutral navigation', /btn\.className = 'maktab-haidh-check';/.test(summary));
check('pink Haidh note and raw-summary attendance fallback are both removed',
  !/td\.textContent = 'Haidh'/.test(summary) && !/data\.attendance/.test(summary));
check('worker exposes predicted rather than probable Haidh',
  /predicted_haidh_dates/.test(worker) && /predicted_haidh_days/.test(worker) && !/probable_haidh_dates/.test(worker));
check('calendar loads only confirmed, predicted and activity states',
  /row\.status === 'haidh' \|\| row\.status === 'predicted-haidh' \|\| row\.status === 'activity'/.test(haidh)
  && !/probable-haidh/.test(haidh));
check('calendar keeps confirmed dark pink and predicted light pink',
  /\.haidh-cal-day-confirmed[\s\S]*background: var\(--color-haidh\)/.test(haidhCss)
  && /\.haidh-cal-day-planned[\s\S]*background: var\(--color-haidh-soft\)/.test(haidhCss));
check('calendar paints Maktab activity light green and activity wins',
  /haidh-cal-day-activity/.test(haidh) && /\.haidh-cal-day-activity[\s\S]*var\(--color-activity-soft\)/.test(haidhCss));
check('past predictions do not auto-confirm in the calendar',
  /status === 'predicted-haidh'[\s\S]*haidh-cal-day-planned/.test(haidh)
  && !/predicted-haidh' && !isFuture/.test(haidh));
check('register uses plain pink H/h text, not check icons or pills',
  />H<\/span>/.test(register) && />h<\/span>/.test(register)
  && /mkregister-status-haidh-confirmed/.test(registerCss) && /mkregister-status-haidh-predicted/.test(registerCss)
  && !/mkregister-status-haidh[^-]/.test(register));
check('V4.2.14.1 page/cache keys agree',
  /js\/app\.js\?v=4\.2\.14\.1/.test(html) && /CACHE_NAME = 'hifzhelper-v4\.2\.14\.1'/.test(sw));

// Dynamic proof: explicit prediction is exact-date state; a confirmed day does
// not propagate. A log on the predicted date wins in the register.
const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE students (id TEXT PRIMARY KEY, name TEXT, role TEXT, active INTEGER DEFAULT 1, track_haidh INTEGER DEFAULT 0, haidh_ruling TEXT DEFAULT 'hanafi');
  CREATE TABLE maktab_settings (id INTEGER PRIMARY KEY, mushaf TEXT, maktab_day_min INTEGER DEFAULT 1, absence_flag_days INTEGER DEFAULT 30, name TEXT, timezone TEXT, term_from TEXT, term_to TEXT, teaching_days TEXT);
  CREATE TABLE attendance (student_id TEXT, date TEXT, status TEXT, PRIMARY KEY (student_id, date));
  CREATE TABLE maktab_sabaq_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT);
  CREATE TABLE maktab_sabaq_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT);
  CREATE TABLE maktab_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT);
  CREATE TABLE maktab_terms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, term_from TEXT NOT NULL, term_to TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
db.exec(`INSERT INTO maktab_settings (id,maktab_day_min,absence_flag_days,teaching_days,timezone) VALUES (1,1,30,'["mon","tue","wed","thu"]','UTC')`);
db.exec(`INSERT INTO maktab_terms (name,term_from,term_to) VALUES ('Term','2026-08-31','2026-09-03')`);
db.exec(`INSERT INTO students (id,name,role,active,track_haidh,haidh_ruling) VALUES ('S1','Logger','student',1,0,'hanafi'),('S2','Tasneem V','student',1,1,'hanafi'),('S3','Activity','student',1,1,'hanafi')`);
db.exec(`INSERT INTO maktab_sabaq_log (student_id,date) VALUES ('S1','2026-08-31'),('S1','2026-09-01'),('S1','2026-09-02'),('S3','2026-09-01')`);
db.exec(`INSERT INTO attendance (student_id,date,status) VALUES ('S2','2026-08-31','haidh'),('S2','2026-09-01','predicted-haidh'),('S3','2026-09-01','predicted-haidh')`);
const stmt = (sql, args) => ({
  async run(){ const r=db.prepare(sql).run(...args); return {meta:{last_row_id:Number(r.lastInsertRowid)}}; },
  async first(){ return db.prepare(sql).get(...args) ?? null; },
  async all(){ return {results:db.prepare(sql).all(...args)}; },
});
const env={ DB:{ prepare(sql){ return Object.assign(stmt(sql,[]),{bind(...args){return stmt(sql,args);}}); } } };
const auth={id:'T1',role:'teacher'};
const page=(await handleAttendancePage({url:'https://x/attendance/page?student_id=S2&from=2026-08-31&to=2026-09-03'},env,auth)).data;
const registerData=(await handleMaktabRegister({url:'https://x/maktab/attendance-register'},env,auth)).data;
const row2=registerData.students.find(s=>s.id==='S2');
const row3=registerData.students.find(s=>s.id==='S3');
check('dynamic: explicit Tuesday prediction remains predicted, not confirmed',
  page.predicted_haidh_dates.includes('2026-09-01') && !page.haidh_ranges.some(r=>r.from==='2026-09-01'));
check('dynamic: confirmed Monday does not invent Haidh on Wednesday', !page.predicted_haidh_dates.includes('2026-09-02') && page.absent_dates.includes('2026-09-02'));
check('dynamic: register shows exact prediction as predicted-haidh', row2 && row2.cells['2026-09-01']==='predicted-haidh');
check('dynamic: Maktab log wins over a prediction', row3 && row3.cells['2026-09-01']==='present');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
