#!/usr/bin/env node
// V4.2.14.5 — current-week activity-first Attendance roster ordering.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const attendance = read('js/maktabAttendancePage.js');
const html = read('index.html');
const sw = read('js/sw.js');
const start = attendance.indexOf('function mkregMondayOf');
const end = attendance.indexOf('// V4.2.11.1+', start);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(attendance.slice(start, end), ctx);

const today = '2026-09-05';
const weeks = [
  { monday:'2026-08-24', columns:[{date:'2026-08-25'},{date:'2026-08-26'},{date:'2026-08-27'}] },
  { monday:'2026-08-31', columns:[{date:'2026-08-31'},{date:'2026-09-01'},{date:'2026-09-02'},{date:'2026-09-03'}] },
  { monday:'2026-09-07', columns:[{date:'2026-09-07'},{date:'2026-09-08'},{date:'2026-09-09'},{date:'2026-09-10'}] },
];
const currentDates = weeks[1].columns.map(c => c.date);

const students = [
  { id:'active4_80', name:'Aadila Four', attendance_percent:80, attendance_active_days:6, cells:{
    '2026-08-31':'present','2026-09-01':'present','2026-09-02':'present','2026-09-03':'present'
  }},
  { id:'active3_100', name:'Zahra Three', attendance_percent:100, attendance_active_days:8, cells:{
    '2026-08-31':'haidh','2026-09-01':'present','2026-09-02':'present','2026-09-03':'present'
  }},
  { id:'active1_100', name:'Adeebah One', attendance_percent:100, attendance_active_days:4, cells:{
    '2026-08-31':'haidh','2026-09-01':'haidh','2026-09-02':'haidh','2026-09-03':'present'
  }},
  { id:'haidh100', name:'Fajeria Haidh', attendance_percent:100, attendance_active_days:5, cells:{
    '2026-08-31':'haidh','2026-09-01':'haidh','2026-09-02':'haidh','2026-09-03':'haidh'
  }},
  { id:'absent100', name:'Historical Hundred', attendance_percent:100, attendance_active_days:9, cells:{
    '2026-08-31':'absent','2026-09-01':'absent','2026-09-02':'absent','2026-09-03':'absent'
  }},
];
const ids = ctx.mkregSortStudents(students, today, weeks).map(s => s.id);

check('the week containing today is the sort week even when today is Friday/weekend-adjacent',
  JSON.stringify(ctx.mkregWeekDates(weeks, today)) === JSON.stringify(currentDates));
check('current-week active/logged days are counted only from Present cells',
  ctx.mkregActiveDaysForDates(students[0], currentDates) === 4
  && ctx.mkregActiveDaysForDates(students[1], currentDates) === 3
  && ctx.mkregActiveDaysForDates(students[2], currentDates) === 1);
check('primary sort is current-week active-day count descending, not Attendance percentage',
  JSON.stringify(ids.slice(0, 3)) === JSON.stringify(['active4_80','active3_100','active1_100']));
check('an 80 percent student with four current-week ticks outranks a 100 percent student with three ticks',
  ids.indexOf('active4_80') < ids.indexOf('active3_100'));
check('a student with one current-week tick outranks a 100 percent Haidh-only student',
  ids.indexOf('active1_100') < ids.indexOf('haidh100'));
check('with zero current-week ticks, Haidh-only outranks absent/unresolved-only',
  ids.indexOf('haidh100') < ids.indexOf('absent100'));

const tied = [
  { id:'pct80', name:'Pct Eighty', attendance_percent:80, attendance_active_days:7, cells:{'2026-09-01':'present','2026-09-02':'present'} },
  { id:'pct100', name:'Pct Hundred', attendance_percent:100, attendance_active_days:2, cells:{'2026-09-01':'present','2026-09-02':'present'} },
];
check('Attendance percentage is only a tie-breaker when current-week active-day counts are equal',
  ctx.mkregSortStudents(tied, today, weeks)[0].id === 'pct100');
check('render path passes the week model into the sort',
  /mkregSortStudents\(data\.students \|\| \[\], data\.today, weeks\)/.test(attendance));
check('Maktab Attendance served file carries the V4.2.14.5 last-edit header',
  /^\/\* Hifzhelper build 4\.2\.14\.5 \| js\/maktabAttendancePage\.js \*\//.test(attendance));
const versions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
check('page and service-worker cache versions agree at V4.2.14.5',
  versions.length > 0 && versions.every(v => v === '4.2.14.5')
  && /CACHE_NAME = 'hifzhelper-v4\.2\.14\.5'/.test(sw));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
