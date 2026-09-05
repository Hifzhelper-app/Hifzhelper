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
const sortStart = attendance.indexOf('function mkregFirstNameKey');
const sortEnd = attendance.indexOf('// V4.2.11.1+', sortStart);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(attendance.slice(sortStart, sortEnd), ctx);
const d = '2026-09-04';

const screenshotLike = [
  { id:'tick100a', name:'Hajira', attendance_percent:100, attendance_active_days:7, attendance_haidh_days:0, cells:{ [d]:'present' } },
  { id:'tick100b', name:'Adeebah', attendance_percent:100, attendance_active_days:1, attendance_haidh_days:6, cells:{ [d]:'present' } },
  { id:'haidh100a', name:'Fajeria', attendance_percent:100, attendance_active_days:0, attendance_haidh_days:7, cells:{ [d]:'haidh' } },
  { id:'haidh100b', name:'Farzana', attendance_percent:100, attendance_active_days:0, attendance_haidh_days:7, cells:{ [d]:'haidh' } },
  { id:'tick80a', name:'Aadila', attendance_percent:80, attendance_active_days:4, attendance_haidh_days:0, cells:{ [d]:'present' } },
  { id:'tick80b', name:'Famida', attendance_percent:80, attendance_active_days:3, attendance_haidh_days:0, cells:{ [d]:'absent' } },
  { id:'haidh80', name:'Laila', attendance_percent:80, attendance_active_days:0, attendance_haidh_days:4, cells:{ [d]:'haidh' } },
  { id:'abs100', name:'Blank 100', attendance_percent:100, attendance_active_days:0, attendance_haidh_days:0, cells:{ [d]:'absent' } },
];
const ids = ctx.mkregSortStudents(screenshotLike, d).map(s => s.id);

check('every student with at least one tick is above every Haidh-only student, regardless of percentage', ids.indexOf('tick80a') < ids.indexOf('haidh100a') && ids.indexOf('tick80b') < ids.indexOf('haidh100a'));
check('active/logged band keeps decreasing Attendance percentage', ids.indexOf('tick100a') < ids.indexOf('tick80a') && ids.indexOf('tick100b') < ids.indexOf('tick80a'));
check('equal active-band percentages keep decreasing active/logged-day count', ids.indexOf('tick80a') < ids.indexOf('tick80b'));
check('Haidh-only students are above absent/unresolved-only students even when absent percentage is higher', ids.indexOf('haidh80') < ids.indexOf('abs100'));
check('predicted Haidh counts as the Haidh-only band when there are no ticks', ctx.mkregStudentBand({attendance_active_days:0, attendance_haidh_days:0, attendance_predicted_haidh_days:3, cells:{}}) === 1);
check('cell data is a defensive fallback when aggregate counts are absent', ctx.mkregStudentBand({cells:{a:'present'}}) === 0 && ctx.mkregStudentBand({cells:{a:'predicted-haidh'}}) === 1);
check('Maktab Summary sort code is untouched by this Attendance correction', !/maktabSummary/.test(attendance));
check('served Attendance file carries the V4.2.14.3 last-edit header', /^\/\* Hifzhelper build 4\.2\.14\.3 \| js\/maktabAttendancePage\.js \*\//.test(attendance));
const versions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
check('page and service-worker cache keys carry forward together to V4.2.14.4', versions.length > 0 && versions.every(v => v === '4.2.14.4') && /CACHE_NAME = 'hifzhelper-v4\.2\.14\.4'/.test(sw));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
