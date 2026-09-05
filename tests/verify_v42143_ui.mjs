#!/usr/bin/env node
// V4.2.14.3 — Attendance tick-first roster ordering correction.
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
const sortStart = attendance.indexOf('function mkregMondayOf');
const sortEnd = attendance.indexOf('// V4.2.11.1+', sortStart);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(attendance.slice(sortStart, sortEnd), ctx);
const d = '2026-09-05';
const weeks = [{ monday:'2026-08-31', columns:[{date:'2026-08-31'},{date:'2026-09-01'},{date:'2026-09-02'},{date:'2026-09-03'}] }];

const screenshotLike = [
  { id:'tick100a', name:'Hajira', attendance_percent:100, attendance_active_days:7, cells:{'2026-08-31':'present','2026-09-01':'present','2026-09-02':'present','2026-09-03':'present'} },
  { id:'tick100b', name:'Adeebah', attendance_percent:100, attendance_active_days:1, cells:{'2026-09-03':'present'} },
  { id:'haidh100a', name:'Fajeria', attendance_percent:100, attendance_active_days:0, cells:{'2026-08-31':'haidh','2026-09-01':'haidh','2026-09-02':'haidh','2026-09-03':'haidh'} },
  { id:'tick80a', name:'Aadila', attendance_percent:80, attendance_active_days:4, cells:{'2026-09-01':'present','2026-09-02':'present','2026-09-03':'present'} },
  { id:'haidh80', name:'Laila', attendance_percent:80, attendance_active_days:0, cells:{'2026-09-01':'haidh','2026-09-02':'haidh','2026-09-03':'haidh'} },
  { id:'abs100', name:'Blank 100', attendance_percent:100, attendance_active_days:0, cells:{'2026-08-31':'absent','2026-09-01':'absent','2026-09-02':'absent','2026-09-03':'absent'} },
];
const ids = ctx.mkregSortStudents(screenshotLike, d, weeks).map(s => s.id);

check('V4.2.14.3 tick-before-Haidh guarantee remains preserved', ids.indexOf('tick100b') < ids.indexOf('haidh100a') && ids.indexOf('tick80a') < ids.indexOf('haidh100a'));
check('V4.2.14.5 strengthens the active band so more current-week ticks outrank a higher percentage', ids.indexOf('tick80a') < ids.indexOf('tick100b'));
check('Haidh-only students remain above absent/unresolved-only students', ids.indexOf('haidh80') < ids.indexOf('abs100'));
check('predicted Haidh is a Haidh-only weekly state when there are no current-week ticks', ctx.mkregStudentWeekBand({cells:{'2026-09-01':'predicted-haidh'}}, ['2026-09-01']) === 1);
check('cell data directly drives the current-week activity/Haidh bands', ctx.mkregStudentWeekBand({cells:{'2026-09-01':'present'}}, ['2026-09-01']) === 0 && ctx.mkregStudentWeekBand({cells:{}}, ['2026-09-01']) === 2);
check('Maktab Summary sort code is untouched by this Attendance correction', !/maktabSummary/.test(attendance));
check('served Attendance file carries the latest V4.2.14.5 last-edit header', /^\/\* Hifzhelper build 4\.2\.14\.5 \| js\/maktabAttendancePage\.js \*\//.test(attendance));
const versions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
check('page and service-worker cache keys carry forward together to V4.2.14.5', versions.length > 0 && versions.every(v => v === '4.2.14.5') && /CACHE_NAME = 'hifzhelper-v4\.2\.14\.5'/.test(sw));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
