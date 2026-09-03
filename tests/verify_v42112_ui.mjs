#!/usr/bin/env node
// V4.2.11.2 — Attendance register/header/menu refinement.
// Dependency-free structural pins for the user-requested UI contract.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const html = read('index.html');
const css = read('css/detail-pages.css');
const page = read('js/maktabAttendancePage.js');
const haidh = read('js/haidhDetailScreen.js');
const auth = read('js/auth.js');
const worker = read('worker/src/maktabAttendance.js');
const sw = read('js/sw.js');

check('term arrows and term/date label are removed from the Attendance screen',
  !/id="mkweekPrevBtn"/.test(html) && !/id="mkweekNextBtn"/.test(html) && !/id="mkweekLabel"/.test(html));
check('merged weekly headers omit the word Week',
  /return a === b \? mkregShortDate\(a\) : `\$\{mkregShortDate\(a\)\} – \$\{mkregShortDate\(b\)\}`/.test(page)
  && !/`Week \$\{mkregShortDate/.test(page));
check('day-header row has a strong bottom separator including the two row-spanning sticky headers',
  /\.mkregister-day-head \{[\s\S]*border-bottom: 3px solid var\(--color-ink-soft\) !important/.test(css)
  && /\.mkregister-student-head, \.mkregister-percent-head \{ border-bottom: 3px solid/.test(css));
check('Present uses a bold lime TEXT tick',
  /mkregister-status-present" aria-hidden="true">✓<\/span>/.test(page)
  && /\.mkregister-status-present \{ color: #78BE3F; font-size: 22px; font-weight: 900/.test(css));
check('Haidh uses plain dark-pink H / light-pink h text with no icon pill',
  /mkregister-status-haidh-confirmed" aria-hidden="true">H<\/span>/.test(page)
  && /mkregister-status-haidh-predicted" aria-hidden="true">h<\/span>/.test(page)
  && /mkregister-status-haidh-confirmed \{ color: var\(--color-haidh\);[^}]*font-weight: 800/.test(css)
  && /mkregister-status-haidh-predicted \{ color: var\(--color-haidh\);[^}]*font-weight: 400/.test(css)
  && !/iconHtml\('haidh'\)/.test(page));
check('Attendance % is the second column and is returned per student',
  /mkregister-student-head" rowspan="2">[\s\S]*Student[\s\S]*<\/th><th class="mkregister-percent-head" rowspan="2">Attendance %<\/th>/.test(page)
  && /attendance_percent: summary\.percent/.test(worker));
check('Attendance % and the individual page share one attendance-period summary helper',
  /export function summarizeAttendancePeriod\(/.test(worker)
  && /const periodSummary = summarizeAttendancePeriod\(allMaktabDays, derived\.statuses, from, to\)/.test(worker)
  && /const summary = summarizeAttendancePeriod\(maktabDays, derived\.statuses, from, to\)/.test(worker));
check('current Maktab week remains auto-focused with both sticky identity columns accounted for',
  /const percentHead = host\.querySelector\('\.mkregister-percent-head'\)/.test(page)
  && /stickyWidth = \(studentHead \? studentHead\.offsetWidth : 0\) \+ \(percentHead \? percentHead\.offsetWidth : 0\)/.test(page));
check('individual Attendance removes the separate page title and puts Attendance + student in the white header',
  !/class="att-page-title/.test(html)
  && /`Attendance — \$\{logCtxStudentName\(\)\}`/.test(haidh));
check('individual Attendance header is capped to the same desktop width as its cards',
  /#screen-attendancePage > \.juz-tracker-header-row[\s\S]*@media \(min-width: 768px\)[\s\S]*width: 50%/.test(css));
check('admin primary menu order is Home, Maktab, Attendance, Student Management, Maktab Settings, Calendar',
  /if\(isTeachingProfile\(\)\) g1\.push\(MAKTAB_SUMMARY_NAV_ITEM\);[\s\S]*g1\.push\(MAKTAB_ATTENDANCE_NAV_ITEM\);[\s\S]*g1\.push\(ADMIN_NAV_ITEM, MAKTAB_SETTINGS_NAV_ITEM\);[\s\S]*g1\.push\(MAKTAB_CALENDAR_NAV_ITEM\);/.test(auth));
check('Attendance and Calendar are not duplicated in the later personal-tools group',
  /!\['home', 'sih', 'juzTracker', 'attendancePage'\]\.includes\(x\.id\)/.test(auth)
  && !/g3\.push\(MAKTAB_CALENDAR_NAV_ITEM\)/.test(auth));
check('V4.2.11.2 page/cache contract remains valid after V4.2.14',
  /js\/app\.js\?v=4\.2\.14/.test(html) && /CACHE_NAME = 'hifzhelper-v4\.2\.14'/.test(sw));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
