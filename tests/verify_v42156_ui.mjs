#!/usr/bin/env node
// V4.2.15.6 — Student Attendance Haidh Settings + mobile roll-up +
// Student Summary Log column + User Management rename.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const html = read('index.html');
const haidh = read('js/haidhDetailScreen.js');
const day = read('js/maktabDay.js');
const api = read('js/api.js');
const auth = read('js/auth.js');
const css = read('css/detail-pages.css');
const worker = read('worker/src/maktabAttendance.js');
const workerIndex = read('worker/src/index.js');
const sw = read('js/sw.js');

check('Student Attendance has a Haidh Settings card at the bottom with shared host + save action',
  /id="attHaidhSettingsCard"/.test(html)
  && /id="attHaidhSettingsHost"/.test(html)
  && /id="attHaidhSettingsSave"/.test(html)
  && html.indexOf('id="attHaidhSettingsCard"') > html.indexOf('id="attHaidhBlock"'));

check('Attendance Haidh Settings reuses the exact registration/User Management component',
  /adminRegistrationHaidhSetupMarkup\('att_edit'/.test(haidh)
  && /adminRegistrationProfileError\(profile\)/.test(haidh)
  && /renderSwitch\('att_edit_haidh_ruling_switch'/.test(haidh)
  && /wireSwitch\('att_edit_haidh_ruling_switch'/.test(haidh));

check('Attendance Haidh Settings clears stale student UI before the first await',
  /settingsCard\.classList\.add\('hidden'\)/.test(haidh)
  && /settingsHost\.innerHTML = ''/.test(haidh));

check('Attendance page payload exposes the existing Haidh setup fields',
  /SELECT id, gender, haidh_ruling, track_haidh, haidh_cycle_length, haidh_period_length, haidh_next_expected/.test(worker)
  && /haidh_cycle_length: student\.haidh_cycle_length/.test(worker)
  && /haidh_next_expected: student\.haidh_next_expected/.test(worker));

check('Attendance-scoped Haidh Settings save route is wired end-to-end',
  /function apiSaveAttendanceHaidhSettings\(studentId, profile\)/.test(api)
  && /'\/attendance\/haidh-settings'/.test(api)
  && /export async function handleAttendanceHaidhSettings/.test(worker)
  && /handleAttendanceHaidhSettings/.test(workerIndex)
  && /path === '\/attendance\/haidh-settings'/.test(workerIndex));

check('Haidh Settings save keeps shared biological validation and regenerates predictions',
  /haidhOfficialMaxDuration\(ruling\)/.test(worker)
  && /haidhMinCycleFrequency\(period\)/.test(worker)
  && /DELETE FROM attendance WHERE student_id = \? AND status = 'predicted-haidh'/.test(worker)
  && /ON CONFLICT\(student_id, date\) DO NOTHING/.test(worker));

check('mobile collapsed Attendance column is structurally removed and its icon moves into the Student header',
  /mkregister-student-head-inner[\s\S]{0,520}mkregister-percent-toggle-collapsed/.test(read('js/maktabAttendancePage.js'))
  && /mkregister-grid:not\(\.mkregister-percent-open\) \.mkregister-percent-head,[\s\S]{0,160}\.mkregister-percent-cell[\s\S]{0,180}display: none !important/.test(css)
  && /mkregister-grid\.mkregister-percent-open \.mkregister-percent-head[\s\S]{0,180}width: 68px/.test(css));

check('Student Summary no longer contains the redundant Maktab Summary button',
  !/id="studentSummaryMaktabSummaryBtn"/.test(html)
  && !/studentSummaryMaktabSummaryBtn/.test(day));

check('Student Summary has a dedicated narrow fifth Log action column',
  /class="journal-header-row student-summary-grid-header"/.test(html)
  && /id="studentSummaryQuickLogBtn"/.test(html)
  && /class="ss-col-log"/.test(html)
  && /student-summary-grid-header > \*:nth-child\(5\)[^{]*\{ flex: 0 0 10%; \}/.test(css));

check('Student Summary Log header uses the supplied circle-plus and opens the existing shared Quick Log',
  /quickOpenBtn\.innerHTML = iconHtml\('circlePlus'\)/.test(day)
  && /quickOpenBtn\.onclick = \(\) => maktabOpenQuickLog\(/.test(day)
  && /student, quickDate, 'sabaq', entriesByType\.sabaq/.test(day));

check('Student Summary data rows include the aligned fifth action cell and empty states span five columns',
  /actionTd\.className = 'journal-cell student-summary-log-cell'/.test(day)
  && /colspan="5"/.test(day));

check('visible Student Management wording is renamed to User Management',
  /<h2>User Management<\/h2>/.test(html)
  && /const ADMIN_NAV_ITEM = \{ id: 'admin', label: 'User Management', icon: 'admin' \};/.test(auth)
  && !/<h2>Student Management<\/h2>/.test(html));

const versions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
check('page asset keys and service-worker cache are aligned after later overlays',
  versions.length > 0 && versions.every(v => v === '4.2.15.8')
  && /CACHE_NAME = 'hifzhelper-v4\.2\.15\.8'/.test(sw));

check('only actually edited representative files carry the V4.2.15.6 last-edit header',
  /^\/\* Hifzhelper build 4\.2\.15\.6 \| js\/api\.js \*\//.test(api)
  && /^\/\* Hifzhelper build 4\.2\.15\.6 \| js\/haidhDetailScreen\.js \*\//.test(haidh)
  && /^\/\* Hifzhelper build 4\.2\.15\.6 \| js\/maktabDay\.js \*\//.test(day)
  && /^\/\* Hifzhelper build 4\.2\.15\.8 \| js\/auth\.js \*\//.test(auth)
  && /^\/\* Hifzhelper build 4\.2\.15\.7 \| css\/detail-pages\.css \*\//.test(css)
  && /^\/\* Hifzhelper build 4\.2\.15\.7 \| js\/maktabAttendancePage\.js \*\//.test(read('js/maktabAttendancePage.js')));

check('V4.2.15.6 itself required no migration; V4.2.15.7 adds only the Zoom-link migration',
  /ALTER TABLE maktab_settings ADD COLUMN zoom_link TEXT/.test(read('worker/migrations/0030_hifz_class_zoom_link.sql')));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
