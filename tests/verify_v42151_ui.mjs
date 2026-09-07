#!/usr/bin/env node
// V4.2.15.1 — Attendance UI sorting/navigation + Student Management Haidh setup.
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
const attendance = read('js/maktabAttendancePage.js');
const summary = read('js/maktabSummary.js');
const detailCss = read('css/detail-pages.css');
const journalCss = read('css/journal-table.css');
const settingsCss = read('css/settings.css');
const adminCss = read('css/admin.css');
const admin = read('js/adminPage.js');
const api = read('js/api.js');
const worker = read('worker/src/admin.js');
const sw = read('js/sw.js');

check('Maktab Summary and Attendance use matching explicit green rectangular cross-navigation buttons',
  /class="maktab-cross-nav-btn maktab-summary-attendance-link" id="maktabSummaryAttendanceBtn"/.test(html)
  && /class="maktab-cross-nav-btn mkregister-summary-link" id="mkweekMaktabSummaryBtn"/.test(html)
  && /\.maktab-cross-nav-btn\s*\{[\s\S]{0,450}border-radius: var\(--radius-sm\)[\s\S]{0,180}background: var\(--palette-evergreen\)/.test(journalCss)
  && !/\.maktab-cross-nav-btn\s*\{[\s\S]{0,450}border-radius:\s*999/.test(journalCss));

check('the two cross-navigation buttons go to the requested opposite summary screen',
  /maktabSummaryAttendanceBtn\.addEventListener\('click', \(\) => showScreen\('maktabAttendance'\)\)/.test(summary)
  && /mkweekMaktabSummaryBtn\.addEventListener\('click', \(\) => showScreen\('maktabSummary'\)\)/.test(attendance));

check('Attendance rows are sequentially numbered and manual re-sorting renumbers them',
  /students\.map\(\(s, rowIndex\) =>/.test(attendance)
  && /class="mkregister-row-number"[^>]*>\$\{rowIndex \+ 1\}<\/span>/.test(attendance)
  && /number\.textContent = String\(index \+ 1\)/.test(attendance));

check('Student and Attendance headers both expose chevron sort controls',
  /data-sort-key="name"[\s\S]{0,220}mkregister-sort-chevron/.test(attendance)
  && /data-sort-key="attendance"[\s\S]{0,220}mkregister-sort-chevron/.test(attendance)
  && /\.mkregister-sort-btn[\s\S]{0,480}cursor: pointer/.test(detailCss));

const sortStart = attendance.indexOf('function mkregMondayOf');
const sortEnd = attendance.indexOf('// V4.2.11.1+', sortStart);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(attendance.slice(sortStart, sortEnd), ctx);
const today = '2026-09-07';
const weeks = [{ monday:'2026-09-07', columns:[{date:'2026-09-07'},{date:'2026-09-08'},{date:'2026-09-09'},{date:'2026-09-10'}] }];
const sample = [
  {id:'active3z', name:'Zainab Active', attendance_percent:100, cells:{'2026-09-07':'present','2026-09-08':'present','2026-09-09':'present'}},
  {id:'active4m', name:'Maryam Four', attendance_percent:70, cells:{'2026-09-07':'present','2026-09-08':'present','2026-09-09':'present','2026-09-10':'present'}},
  {id:'active3a', name:'Aisha Active', attendance_percent:40, cells:{'2026-09-07':'present','2026-09-08':'present','2026-09-09':'present'}},
  {id:'haidhz', name:'Zahra Haidh', attendance_percent:100, cells:{'2026-09-07':'haidh','2026-09-08':'haidh'}},
  {id:'haidhA', name:'Amina Haidh', attendance_percent:83, cells:{'2026-09-07':'predicted-haidh'}},
  {id:'absz', name:'Zubeida Absent', attendance_percent:100, cells:{'2026-09-07':'absent'}},
  {id:'absa', name:'Aaliyah Absent', attendance_percent:17, cells:{'2026-09-07':'absent'}},
];
const defaultIds = ctx.mkregSortStudents(sample, today, weeks).map(s => s.id);
check('default first level remains current-week active-day count descending',
  defaultIds[0] === 'active4m' && defaultIds.indexOf('active3a') < defaultIds.indexOf('haidhA'));
check('V4.2.15.1 changes ONLY the active-count tie-breaker to alphabetical, not Attendance %',
  defaultIds.indexOf('active3a') < defaultIds.indexOf('active3z'));
check('default zero-activity bands remain Haidh alphabetically, then absent alphabetically',
  defaultIds.slice(3).join(',') === 'haidhA,haidhz,absa,absz');

const nameAsc = ctx.mkregSortStudents(sample, today, weeks, 'name', 'asc').map(s => s.name);
const nameDesc = ctx.mkregSortStudents(sample, today, weeks, 'name', 'desc').map(s => s.name);
check('manual Student chevron sorts alphabetically in both directions',
  nameAsc[0] === 'Aaliyah Absent' && nameAsc.at(-1) === 'Zubeida Absent'
  && nameDesc[0] === 'Zubeida Absent' && nameDesc.at(-1) === 'Aaliyah Absent');

const attDesc = ctx.mkregSortStudents(sample, today, weeks, 'attendance', 'desc', '2026-09-07', '2026-09-10').map(s => s.id);
const attAsc = ctx.mkregSortStudents(sample, today, weeks, 'attendance', 'asc', '2026-09-07', '2026-09-10').map(s => s.id);
check('manual Attendance sort is term-wide active-day count first, then Attendance percentage',
  attDesc[0] === 'active4m'
  && attDesc.indexOf('active3z') < attDesc.indexOf('active3a')
  && attAsc[0] === 'absa');
check('manual Attendance reverse state reverses numeric keys while alphabet breaks exact ties',
  attAsc.indexOf('active3a') < attAsc.indexOf('active3z')
  && /return mkregCompareNames\(a, b\);/.test(attendance));

check('Personal Journal Haaidha confirmation is forced onto the same heading row as the text',
  /<label class="haidh-heading-check">\s*<h2>Haaidha<\/h2>\s*<input type="checkbox" id="haaidha_checkbox">/.test(html)
  && /#section-haidh\.detail-page \.haidh-heading-check\s*\{[\s\S]{0,150}display: inline-flex[\s\S]{0,120}align-items: center/.test(settingsCss));

check('Student Management Haaidha selection reveals the Personal-Journal-style Haidh setup controls',
  /function adminRegistrationHaidhSetupMarkup\(prefix, options\)[\s\S]{0,1100}Hanafi[\s\S]{0,180}Shafi'i[\s\S]{0,420}Haidh cycle frequency \(days\)[\s\S]{0,300}How many haidh days per cycle[\s\S]{0,300}Next expected haidh day/.test(admin)
  && /haidhEl\.addEventListener\('change', sync\)/.test(admin)
  && /setup\.classList\.toggle\('hidden', !open\)/.test(admin)
  && /admin-register-check admin-register-haidh-check hidden[^>]*><span>Haaidha<\/span><input type="checkbox" id="admin_new_haidh">/.test(admin));

check('registration Haidh validation uses the same shared max-duration and purity-frequency rules',
  /haidhOfficialMaxDuration\(profile\.haidh_ruling/.test(admin)
  && /haidhMinCycleFrequency\(profile\.haidh_period_length\)/.test(admin)
  && /haidhOfficialMaxDuration\(haidhRuling\)/.test(worker)
  && /haidhMinCycleFrequency\(haidhPeriodLength\)/.test(worker));

check('registration API carries the full Haidh setup and backend stores it with prediction rows',
  /haidh_ruling: p\.haidh_ruling/.test(api)
  && /haidh_cycle_length: p\.haidh_cycle_length/.test(api)
  && /haidh_period_length: p\.haidh_period_length/.test(api)
  && /haidh_next_expected: p\.haidh_next_expected/.test(api)
  && /INSERT INTO students \(id, name, role, created_date, active, whatsapp_number, gender, track_haidh, haidh_ruling, haidh_cycle_length, haidh_period_length, haidh_next_expected\)/.test(worker)
  && /INSERT INTO attendance \(student_id, date, status\) VALUES \(\?, \?, 'predicted-haidh'\)/.test(worker));

const v42151PageVersions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
const v42151CacheVersion = (sw.match(/CACHE_NAME = 'hifzhelper-v([0-9.]+)'/) || [])[1];
check('later overlays keep page/cache aligned while V4.2.15.2 re-edited files retain their last-edit headers',
  v42151PageVersions.length > 0 && !!v42151CacheVersion && v42151PageVersions.every(v => v === v42151CacheVersion)
  && /^\/\* Hifzhelper build 4\.2\.15\.2 \| js\/maktabAttendancePage\.js \*\//.test(attendance)
  && /^\/\* Hifzhelper build 4\.2\.15\.2 \| js\/adminPage\.js \*\//.test(admin)
  && /^\/\* Hifzhelper build 4\.2\.15\.2 \| css\/admin\.css \*\//.test(adminCss));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
