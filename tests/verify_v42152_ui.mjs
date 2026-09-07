#!/usr/bin/env node
// V4.2.15.2 — Attendance popup/sorting/swipe + Student Management Haidh + Student Summary header.
// Dependency-free structural + behavioural regression.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const html = read('index.html');
const day = read('js/maktabDay.js');
const haidh = read('js/haidhDetailScreen.js');
const attendance = read('js/maktabAttendancePage.js');
const detailCss = read('css/detail-pages.css');
const haidhCss = read('css/haidh.css');
const admin = read('js/adminPage.js');
const adminCss = read('css/admin.css');
const worker = read('worker/src/admin.js');
const sw = read('js/sw.js');

check('Quick Attendance is a popup that physically reuses the real Student Attendance calendar block',
  /overlay\.id = 'maktabQuickAttendanceSheet'/.test(day)
  && /getElementById\('attHaidhBlock'\)/.test(day)
  && /maktabQuickAttendanceCalendarHost'\)\.appendChild\(block\)/.test(day)
  && /renderHaidhDetailScreen\(\{ maktab: true, date: selectedDate \}\)/.test(day));

check('Quick Attendance supports a single date or start/end range without inventing another selector engine',
  /function maktabQuickAttendanceBounds\(\)[\s\S]{0,180}haidhPendingRangeBounds\(\)/.test(day)
  && /one tap may be saved as a single day/.test(day)
  && /tap 1 = start, tap 2 = end/.test(haidh));

check('Quick Attendance Haidh Save uses the exact shared authoritative markRange path',
  /if\(state\.mode === 'haidh'\)[\s\S]{0,180}await client\.markRange\(bounds\[0\], bounds\[1\]\)/.test(day));

check('Quick Attendance can mark selected dates absent but refuses to overwrite logged activity',
  /data-mqa-mode="absent"[\s\S]{0,80}>Mark Absent</.test(day)
  && /haidhCalAttendance\[d\] === 'activity'/.test(day)
  && /await client\.setDay\(d, 'absent'\)/.test(day));

check('Quick Attendance popup has a Save icon and Detail navigates to the full Student Attendance page',
  /id="maktabQuickAttendanceSave"[\s\S]{0,120}iconHtml\('save'\)/.test(day)
  && /id="maktabQuickAttendanceDetail"[\s\S]{0,160}iconHtml\('detail'\)[\s\S]{0,80}<span>Detail<\/span>/.test(day)
  && /maktabQuickAttendanceDetail[\s\S]{0,520}showScreen\('attendancePage', \{ maktab: true, date: snapshot\.date \}\)/.test(day));

check('full Student Attendance tap-to-clear behaviour remains unchanged outside the popup',
  /quickAttendanceOpen[\s\S]{0,260}!quickAttendanceOpen[\s\S]{0,260}haidhCalClient\(\)\.clear\(dateISO\)/.test(haidh));

check('Attendance register remains current-week focused but is freely horizontally swipeable to past/future weeks',
  /requestAnimationFrame\(focusCurrentWeek\)/.test(attendance)
  && /\.mkregister-scroll\s*\{[\s\S]{0,160}overflow: auto[\s\S]{0,180}touch-action: pan-x pan-y/.test(detailCss));

check('later V4.2.15.4 keeps both chevrons but makes them two-way and moves reset-to-default to the dedicated Sort pill',
  /TWO-WAY only/.test(attendance)
  && /mkregisterSortDirection = mkregisterSortDirection === firstDirection \? secondDirection : firstDirection/.test(attendance)
  && /function mkregResetSort\(host, data\)[\s\S]{0,120}mkregisterSortKey = 'default'/.test(attendance)
  && /id="mkregisterDefaultSortBtn"/.test(html));

const sortStart = attendance.indexOf('function mkregMondayOf');
const sortEnd = attendance.indexOf('// V4.2.11.1+', sortStart);
const sortCtx = {};
vm.createContext(sortCtx);
vm.runInContext(attendance.slice(sortStart, sortEnd), sortCtx);
const weeks = [
  { monday:'2026-08-31', columns:[{date:'2026-08-31'},{date:'2026-09-01'},{date:'2026-09-02'},{date:'2026-09-03'}] },
  { monday:'2026-09-07', columns:[{date:'2026-09-07'},{date:'2026-09-08'},{date:'2026-09-09'},{date:'2026-09-10'}] },
];
const students = [
  {id:'A', name:'Amina', attendance_percent:80, cells:{'2026-08-31':'present','2026-09-01':'present','2026-09-02':'present','2026-09-03':'present','2026-09-07':'present'}},
  {id:'B', name:'Bilqees', attendance_percent:100, cells:{'2026-09-07':'present','2026-09-08':'present','2026-09-09':'present'}},
  {id:'C', name:'Celine', attendance_percent:70, cells:{'2026-08-31':'present','2026-09-01':'present','2026-09-07':'present','2026-09-08':'present','2026-09-09':'present'}},
  {id:'H', name:'Haifa', attendance_percent:100, cells:{'2026-09-07':'haidh','2026-09-08':'haidh'}},
  {id:'Z', name:'Zara', attendance_percent:100, cells:{'2026-09-07':'absent'}},
];
const defaultIds = sortCtx.mkregSortStudents(students, '2026-09-07', weeks).map(s => s.id);
check('default ordering is unchanged: current-week active-day count, alphabetical ties, then Haidh, then absent',
  defaultIds.join(',') === 'B,C,A,H,Z');
const termDesc = sortCtx.mkregSortStudents(students, '2026-09-07', weeks, 'attendance', 'desc', '2026-08-31', '2026-09-10').map(s => s.id);
const termAsc = sortCtx.mkregSortStudents(students, '2026-09-07', weeks, 'attendance', 'asc', '2026-08-31', '2026-09-10').map(s => s.id);
check('manual Attendance sort uses term-wide active days first and Attendance % second',
  termDesc.slice(0,3).join(',') === 'A,C,B' && termAsc.slice(0,3).join(',') === 'H,Z,B');

check('Student Management uses the Attendance-style header on all widths',
  /id="screen-admin"[\s\S]{0,600}<div class="juz-tracker-header-row screen-cap admin-header-row">/.test(html)
  && /#screen-admin \.admin-header-row \{[\s\S]{0,320}display:flex[\s\S]{0,260}background:var\(--color-surface\)[\s\S]{0,260}border-radius:var\(--radius-md\)/.test(adminCss));

check('Student Management has a clickable Haidh Settings pill with grey incomplete and active completed states',
  /<th>Haidh Settings<\/th>/.test(admin)
  && /admin-haidh-pill\$\{adminHaidhSetupComplete\(u\) \? ' is-complete' : ''\}/.test(admin)
  && /data-haidh-settings="\$\{u\.id\}">Haidh<\/button>/.test(admin)
  && /\.admin-haidh-pill[^}]*opacity:\.65/.test(adminCss)
  && /\.admin-haidh-pill\.is-complete[^}]*background:var\(--palette-evergreen\)[^}]*opacity:1/.test(adminCss));

check('Haidh pill reuses the same Haidh setup component and shared validation as registration',
  /function adminRegistrationHaidhSetupMarkup\(prefix, options\)/.test(admin)
  && /adminOpenHaidhSettings[\s\S]{0,1300}adminRegistrationHaidhSetupMarkup\('admin_edit'/.test(admin)
  && /const problem = adminRegistrationProfileError\(profile\)/.test(admin));

check('admin API list/update exposes and persists the existing Haidh profile fields with prediction regeneration',
  /SELECT id, name, role[\s\S]{0,240}track_haidh, haidh_ruling, haidh_cycle_length, haidh_period_length, haidh_next_expected/.test(worker)
  && /DELETE FROM attendance WHERE student_id = \? AND status = 'predicted-haidh'/.test(worker)
  && /env\.DB\.batch\(\[updateStmt, \.\.\.predictionStatements\]\)/.test(worker));

check('Student Summary keeps the Attendance-style header + Ajzaa navigation; later V4.2.15.6 removes the redundant Maktab Summary button',
  /id="screen-studentSummary"[\s\S]{0,800}<div class="juz-tracker-header-row screen-cap student-summary-header-row">/.test(html)
  && /id="studentSummaryAjzaaBtn"/.test(html)
  && !/id="studentSummaryMaktabSummaryBtn"/.test(html)
  && /ajzaaBtn\.onclick = \(\) => openMaktabStudentSetup\(\{ id: logCtxStudentId\(\), name: logCtxStudentName\(\) \}\)/.test(day));

const v42152PageVersions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
const v42152CacheVersion = (sw.match(/CACHE_NAME = 'hifzhelper-v([0-9.]+)'/) || [])[1];
check('V4.2.15.2 behaviour survives later page/cache overlays and its touched files retain their last-edit headers',
  v42152PageVersions.length > 0 && !!v42152CacheVersion && v42152PageVersions.every(v => v === v42152CacheVersion)
  && /^\/\* Hifzhelper build 4\.2\.15\.6 \| js\/maktabDay\.js \*\//.test(day)
  && /^\/\* Hifzhelper build 4\.2\.15\.7 \| js\/maktabAttendancePage\.js \*\//.test(attendance)
  && /^\/\* Hifzhelper build 4\.2\.15\.7 \| css\/haidh\.css \*\//.test(haidhCss));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
