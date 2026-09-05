#!/usr/bin/env node
// V4.2.14.2 compatibility — independent ordering + Student Summary quick actions; V4.2.14.3 tick-first correction.
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


const attSortStart = attendance.indexOf('function mkregFirstNameKey');
const attSortEnd = attendance.indexOf('// V4.2.11.1+', attSortStart);
const attSortSource = attendance.slice(attSortStart, attSortEnd);
const attCtx = {};
vm.createContext(attCtx);
vm.runInContext(attSortSource, attCtx);
const sortDate = '2026-09-04';
const attendanceSample = [
  { id:'A', name:'Amina Active 80', attendance_percent:80, attendance_active_days:4, attendance_haidh_days:0, attendance_predicted_haidh_days:0, cells:{ [sortDate]:'present' } },
  { id:'B', name:'Bilqees Active 100', attendance_percent:100, attendance_active_days:1, attendance_haidh_days:2, attendance_predicted_haidh_days:0, cells:{ [sortDate]:'haidh' } },
  { id:'C', name:'Celine Haidh Only', attendance_percent:100, attendance_active_days:0, attendance_haidh_days:7, attendance_predicted_haidh_days:0, cells:{ [sortDate]:'haidh' } },
  { id:'D', name:'Dina Predicted Only', attendance_percent:100, attendance_active_days:0, attendance_haidh_days:0, attendance_predicted_haidh_days:4, cells:{ [sortDate]:'predicted-haidh' } },
  { id:'E', name:'Emaan Absent Only', attendance_percent:100, attendance_active_days:0, attendance_haidh_days:0, attendance_predicted_haidh_days:0, cells:{ [sortDate]:'absent' } },
];
const attendanceOrdered = attCtx.mkregSortStudents(attendanceSample, sortDate).map(s => s.id);
check('Attendance uses active/logged, then Haidh-only, then absent/unresolved roster bands',
  /function mkregStudentBand\(student\)/.test(attendance)
  && /mkregActiveDays\(student\) > 0/.test(attendance)
  && /mkregHaidhDays\(student\) > 0/.test(attendance)
  && JSON.stringify(attendanceOrdered) === JSON.stringify(['B','A','C','D','E']));

check('Attendance percentage and active-day count still descend inside the active/logged band',
  /const pct = mkregAttendancePercent\(b\) - mkregAttendancePercent\(a\)/.test(attendance)
  && /const active = mkregActiveDays\(b\) - mkregActiveDays\(a\)/.test(attendance)
  && JSON.stringify(attendanceOrdered.slice(0, 2)) === JSON.stringify(['B','A']));

check('Attendance H/h stays about 25 percent smaller and uses the agreed grey, not calendar pink',
  /mkregister-status-haidh-confirmed \{ color: var\(--color-ink-soft\); font-size: 14px/.test(css)
  && /mkregister-status-haidh-predicted \{ color: var\(--color-ink-soft\); font-size: 14px/.test(css));

const versions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
check('V4.2.14.3 page assets and service-worker cache key agree',
  versions.length > 0 && versions.every(v => v === '4.2.14.3')
  && /CACHE_NAME = 'hifzhelper-v4\.2\.14\.3'/.test(sw));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
