#!/usr/bin/env node
// V4.2.11.4 — confirmed/probable Haidh distinction + neutral attendance icon.
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
const journalCss = read('css/journal-table.css');
const haidh = read('js/haidhDetailScreen.js');
const haidhCss = read('css/haidh.css');
const worker = read('worker/src/maktabAttendance.js');
const html = read('index.html');
const sw = read('js/sw.js');

check('summary attendance icon is always neutral and has no marked-state class',
  /btn\.className = 'maktab-haidh-check';/.test(summary)
  && !/maktab-haidh-check' \+ \(haidhByStudent/.test(summary)
  && !/\.maktab-haidh-check\.marked[\s\S]*#FFD400/.test(journalCss));
check('small pink Haidh text is retained only for an explicit confirmed Haidh row',
  /haidhByStudent\[stu\.id\] === 'haidh'/.test(summary)
  && /td\.textContent = 'Haidh'/.test(summary)
  && !/\(d && d\.status === 'haidh'\)/.test(summary));
check('attendance page returns propagated dates separately as probable Haidh',
  /const probable_haidh_dates = allMaktabDays\.filter/.test(worker)
  && /derived\.statuses\[date\] === 'haidh'/.test(worker)
  && /!explicitHaidhDateSet\.has\(date\)/.test(worker)
  && /absent_dates, haidh_ranges, probable_haidh_dates/.test(worker));
check('calendar merges probable dates without overwriting explicit stored marks',
  /attPageData\.probable_haidh_dates/.test(haidh)
  && /if\(!nextAttendance\[date\]\) nextAttendance\[date\] = 'probable-haidh'/.test(haidh));
check('probable calendar cells are visibly distinct and labelled',
  /haidh-cal-day-probable/.test(haidh)
  && /Probable Haidh/.test(haidh)
  && /\.haidh-cal-day-probable[\s\S]*border: 2px dashed var\(--color-haidh\)/.test(haidhCss)
  && /\.haidh-cal-day-probable::after[\s\S]*content: '\?'/.test(haidhCss));
check('tapping probable Haidh starts confirmation instead of deleting a nonexistent row',
  /status && status !== 'probable-haidh' && haidhRangeStart == null/.test(haidh));
check('register uses the same derived Haidh truth so probable Haidh is not blank/absent',
  /else if \(derived\.statuses\[c\.date\] === 'haidh'\) status = 'haidh'/.test(worker));
check('V4.2.12 page/cache keys agree',
  /js\/app\.js\?v=4\.2\.12/.test(html) && /CACHE_NAME = 'hifzhelper-v4\.2\.12'/.test(sw));

// Dynamic proof: an explicit Haidh on Monday propagates to Tuesday when
// another student logs Tuesday, so Tuesday is a real Maktab day. The
// individual page must call it probable and the register must keep it
// excused rather than rendering blank=absent.
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
db.exec(`INSERT INTO students (id,name,role,active,track_haidh,haidh_ruling) VALUES ('S1','Logger','student',1,0,'hanafi'),('S2','Tasneem V','student',1,1,'hanafi')`);
db.exec(`INSERT INTO maktab_sabaq_log (student_id,date) VALUES ('S1','2026-08-31'),('S1','2026-09-01')`);
db.exec(`INSERT INTO attendance (student_id,date,status) VALUES ('S2','2026-08-31','haidh')`);
const stmt = (sql, args) => ({
  async run(){ const r=db.prepare(sql).run(...args); return {meta:{last_row_id:Number(r.lastInsertRowid)}}; },
  async first(){ return db.prepare(sql).get(...args) ?? null; },
  async all(){ return {results:db.prepare(sql).all(...args)}; },
});
const env={ DB:{ prepare(sql){ return Object.assign(stmt(sql,[]),{bind(...args){return stmt(sql,args);}}); } } };
const auth={id:'T1',role:'teacher'};
const page=(await handleAttendancePage({url:'https://x/attendance/page?student_id=S2&from=2026-08-31&to=2026-09-03'},env,auth)).data;
const register=(await handleMaktabRegister({url:'https://x/maktab/attendance-register'},env,auth)).data;
const row=register.students.find(s=>s.id==='S2');
check('dynamic: propagated Tuesday is returned as probable, not a stored confirmation',
  page.probable_haidh_dates.includes('2026-09-01') && !page.haidh_ranges.some(r=>r.from==='2026-09-01'));
check('dynamic: probable Tuesday stays excused in the register', row && row.cells['2026-09-01']==='haidh');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
