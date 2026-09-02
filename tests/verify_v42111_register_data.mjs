#!/usr/bin/env node
// V4.2.11.1 — attendance-register data + current-week positioning regression.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { handleMaktabRegister, handleAttendancePage } from '../worker/src/maktabAttendance.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const page = read('js/maktabAttendancePage.js');
check('current term register focuses the current Maktab week after paint',
  /function mkregFocusCurrentWeek\(host, data\)/.test(page)
  && /const monday = mkregMondayOf\(data\.today\)/.test(page)
  && /w\.monday === monday/.test(page)
  && /scroll\.scrollLeft = Math\.max\(0, target\.offsetLeft - stickyWidth - 3\)/.test(page)
  && /requestAnimationFrame\(focusCurrentWeek\)/.test(page));
check('historical or future terms are not forcibly repositioned',
  /if\(data\.today < data\.from \|\| data\.today > data\.to\) return;/.test(page));
check('attendance page source header advances because this served file changed again in V4.2.11.3',
  /^\/\* Hifzhelper build 4\.2\.11\.3 \| js\/maktabAttendancePage\.js \*\//.test(page));

const iso = d => d.toISOString().slice(0, 10);
const shift = (base, n) => { const d = new Date(base + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const today = iso(new Date());
const thisMon = (() => { const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return iso(d); })();
const tue = shift(thisMon, 1);

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
db.exec(`INSERT INTO maktab_settings (id, maktab_day_min, teaching_days, timezone) VALUES (1,1,'["mon","tue","wed","thu"]','UTC')`);
db.prepare(`INSERT INTO maktab_terms (name, term_from, term_to) VALUES ('Current term', ?, ?)`).run(shift(thisMon, -7), shift(thisMon, 13));
db.exec(`INSERT INTO students (id,name,role,active) VALUES ('S1','Present Student','student',1),('S2','Haidh Student','student',1),('S3','Blank Student','student',1)`);
db.prepare(`INSERT INTO maktab_sabaq_log (student_id,date) VALUES ('S1',?)`).run(thisMon);
db.prepare(`INSERT INTO attendance (student_id,date,status) VALUES ('S2',?,'haidh')`).run(tue);

const stmt = (sql, args) => ({
  async run(){ const r = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(r.lastInsertRowid) } }; },
  async first(){ return db.prepare(sql).get(...args) ?? null; },
  async all(){ return { results: db.prepare(sql).all(...args) }; },
});
const env = { DB: { prepare(sql){ return Object.assign(stmt(sql, []), { bind(...args){ return stmt(sql, args); } }); } } };
const result = (await handleMaktabRegister({ url: 'https://x/maktab/attendance-register' }, env, { id:'T1', role:'teacher' })).data;
const s1 = result.students.find(s => s.id === 'S1');
const s2 = result.students.find(s => s.id === 'S2');
const currentWeek = result.weeks.find(w => w.monday === thisMon);
check('register endpoint returns real log-derived present data', s1 && s1.cells[thisMon] === 'present');
check('register endpoint returns confirmed Haidh data', s2 && s2.cells[tue] === 'haidh');
check('register payload contains the current Maktab week', currentWeek && currentWeek.columns.length > 0);

const own = (await handleAttendancePage({ url: `https://x/attendance/page?student_id=S1&from=${shift(thisMon, -7)}&to=${shift(thisMon, 13)}` }, env, { id:'T1', role:'teacher' })).data;
check('register Attendance % is exactly the individual Attendance-page percentage',
  s1 && s1.attendance_percent === own.percent
  && s1.attendance_present_days === own.present_days
  && s1.attendance_maktab_days === own.maktab_days);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
