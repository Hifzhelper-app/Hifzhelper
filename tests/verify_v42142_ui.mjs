#!/usr/bin/env node
// V4.2.14.2 compatibility — ordering + Student Summary quick actions; cache carried through V4.2.14.5.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const html = read('index.html');
const day = read('js/maktabDay.js');
const summary = read('js/maktabSummary.js');
const attendance = read('js/maktabAttendancePage.js');
const css = read('css/detail-pages.css');
const sw = read('js/sw.js');

check('Student Summary no longer uses a separate journal/activity icon quick action',
  !/id="studentSummaryActivityBtn"/.test(html)
  && !/document\.getElementById\('studentSummaryActivityBtn'\)/.test(day));

check('Student Summary exposes Sabaq, Sabaq Dhor and Dhor labels as quick-action buttons',
  /data-ss-quick-type="sabaq"[^>]*>Sabaq<\/button>/.test(html)
  && /data-ss-quick-type="sabaqDhor"[^>]*>Sabaq Dhor<\/button>/.test(html)
  && /data-ss-quick-type="dhor"[^>]*>Dhor<\/button>/.test(html));

check('Student Summary activity labels call the exact shared Maktab Summary Quick Log function',
  /btn\.onclick = \(\) => maktabOpenQuickLog\([\s\S]{0,260}student, quickDate, type, entriesByType\[type\] \|\| \[\], entriesByType/.test(day));

check('Student Summary quick log uses the carried date and refreshes the Student Summary after Save',
  /const quickDate = logCtxDate\(\) \|\| maktabTodayISO\(\)/.test(day)
  && /afterSave: \(\) => renderStudentSummaryScreen\(\)/.test(day));

check('Student Summary Attendance remains a separate quick action beside the name',
  /id="studentSummaryAttendanceBtn"/.test(html)
  && /attBtn\.onclick = \(\) => maktabOpenQuickAttendance\(student, quickDate/.test(day));

check('Activity quick-action buttons fill the existing activity header cells without a new pill row',
  /#screen-studentSummary \.ss-quick-log-head \{ padding: 0; \}/.test(css)
  && /#screen-studentSummary \.ss-quick-log-btn \{[\s\S]*width: 100%;[\s\S]*min-height: 36px;[\s\S]*background: transparent/.test(css));

check('Maktab Summary ordering is logged band first then unlogged band',
  /function maktabSummarySortBand\(student, byStudent\)\{[\s\S]{0,180}maktabSummaryHasLog\(student\.id, byStudent\) \? 0 : 1/.test(summary)
  && /const band = maktabSummarySortBand\(a, byStudent\) - maktabSummarySortBand\(b, byStudent\)/.test(summary));

check('Maktab Summary sorts alphabetically inside each band',
  /return band \|\| maktabSummaryCompareName\(a, b\)/.test(summary)
  && /aa\.first\.localeCompare\(bb\.first/.test(summary));


const attSortStart = attendance.indexOf('function mkregMondayOf');
const attSortEnd = attendance.indexOf('// V4.2.11.1+', attSortStart);
const attSortSource = attendance.slice(attSortStart, attSortEnd);
const attCtx = {};
vm.createContext(attCtx);
vm.runInContext(attSortSource, attCtx);
const sortDate = '2026-09-05';
const sortWeeks = [{ monday:'2026-08-31', columns:[{date:'2026-08-31'},{date:'2026-09-01'},{date:'2026-09-02'},{date:'2026-09-03'}] }];
const attendanceSample = [
  { id:'A', name:'Amina Active 80', attendance_percent:80, attendance_active_days:4, cells:{'2026-08-31':'present','2026-09-01':'present','2026-09-02':'present','2026-09-03':'present'} },
  { id:'B', name:'Bilqees Active 100', attendance_percent:100, attendance_active_days:1, cells:{'2026-09-03':'present'} },
  { id:'C', name:'Celine Haidh Only', attendance_percent:100, attendance_active_days:0, cells:{'2026-08-31':'haidh','2026-09-01':'haidh','2026-09-02':'haidh','2026-09-03':'haidh'} },
  { id:'D', name:'Dina Predicted Only', attendance_percent:100, attendance_active_days:0, cells:{'2026-08-31':'predicted-haidh','2026-09-01':'predicted-haidh'} },
  { id:'E', name:'Emaan Absent Only', attendance_percent:100, attendance_active_days:0, cells:{'2026-08-31':'absent','2026-09-01':'absent','2026-09-02':'absent','2026-09-03':'absent'} },
];
const attendanceOrdered = attCtx.mkregSortStudents(attendanceSample, sortDate, sortWeeks).map(s => s.id);
check('Attendance keeps active/logged, then Haidh-only, then absent/unresolved roster precedence',
  /function mkregStudentWeekBand\(student, dates\)/.test(attendance)
  && JSON.stringify(attendanceOrdered) === JSON.stringify(['A','B','C','D','E']));

check('Attendance now uses current-week active-day count before Attendance percentage',
  /const weeklyActive = mkregActiveDaysForDates\(b, sortDates\) - mkregActiveDaysForDates\(a, sortDates\)/.test(attendance)
  && attendanceOrdered[0] === 'A' && attendanceOrdered[1] === 'B');

check('Attendance H/h stays about 25 percent smaller and uses the agreed grey, not calendar pink',
  /mkregister-status-haidh-confirmed \{ color: var\(--color-ink-soft\); font-size: 14px/.test(css)
  && /mkregister-status-haidh-predicted \{ color: var\(--color-ink-soft\); font-size: 14px/.test(css));

const versions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
check('current page assets and service-worker cache key agree at V4.2.14.5',
  versions.length > 0 && versions.every(v => v === '4.2.14.5')
  && /CACHE_NAME = 'hifzhelper-v4\.2\.14\.5'/.test(sw));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
