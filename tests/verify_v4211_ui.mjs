#!/usr/bin/env node
// V4.2.11 — term attendance register + Female/Haaidha registration + teacher auto-promotion.
// Dependency-free structural pins.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const html = read('index.html');
const css = read('css/detail-pages.css');
const adminCss = read('css/admin.css');
const page = read('js/maktabAttendancePage.js');
const api = read('js/api.js');
const admin = read('js/adminPage.js');
const haidhPage = read('js/haidhDetailScreen.js');
const workerAtt = read('worker/src/maktabAttendance.js');
const workerAttendance = read('worker/src/attendance.js');
const workerAdmin = read('worker/src/admin.js');
const workerIndex = read('worker/src/index.js');
const sw = read('js/sw.js');

check('Attendance screen uses register host rather than the old day-card host class',
  /class="mkregister-host screen-cap" id="mkweekCols"/.test(html));
check('register API route is wired front to back',
  /apiGetMaktabRegister/.test(api) && /\/maktab\/attendance-register/.test(api)
  && /handleMaktabRegister/.test(workerIndex) && /export async function handleMaktabRegister/.test(workerAtt));
check('register groups teaching-day columns beneath merged Maktab-week headings',
  /rowspan="2">Student/.test(page) && /colspan="\$\{count\}"/.test(page)
  && /mkregisterWeekLabel|mkregWeekLabel/.test(page) && /`Week \$\{mkregShortDate\(a\)\}/.test(page) && /Mon/.test(page) && /Tue/.test(page));
check('register presents one student roster and clicking a name opens individual attendance',
  /class="mkregister-student"/.test(page) && /openMaktabAttendancePage\(student, data\.today\)/.test(page));
check('present is a green tick, haidh is the shared haidh icon, and blank remains the absence visual',
  /iconHtml\('check'\)/.test(page) && /iconHtml\('haidh'\)/.test(page)
  && /mkregister-status-present/.test(css) && /color: var\(--color-success\)/.test(css)
  && /mkregister-status-haidh[\s\S]*#FFD400/.test(css));
check('student column and two header rows are sticky and weekly groups are separated',
  /mkregister-student-cell[\s\S]*position: sticky; left: 0/.test(css)
  && /mkregister-week-head[\s\S]*position: sticky; top: 0/.test(css)
  && /mkregister-day-head[\s\S]*top: 34px/.test(css)
  && /mkregister-week-start[\s\S]*border-left: 3px/.test(css));
check('register backend spans the selected/current term and uses configured teaching days',
  /SELECT id, name, term_from, term_to FROM maktab_terms/.test(workerAtt)
  && /teachingDaysOf\(settings\)/.test(workerAtt)
  && /for \(let mon = registerMondayOf\(from\); mon <= to;/.test(workerAtt));
check('Female and conditional Haaidha controls exist in Register a student',
  /id="admin_new_female"/.test(admin) && /id="admin_new_haidh_wrap"/.test(admin)
  && /id="admin_new_haidh"/.test(admin) && /wrap\.classList\.toggle\('hidden', !femaleEl\.checked\)/.test(admin));
check('registration API carries gender/track_haidh and worker stores them without a migration',
  /gender: p\.gender \|\| null, track_haidh: !!p\.track_haidh/.test(api)
  && /gender, track_haidh\) VALUES/.test(workerAdmin)
  && /const trackHaidh = gender === 'F'/.test(workerAdmin));
check('mobile registration styling keeps Female/Haaidha together',
  /\.admin-mobile-register-profile/.test(adminCss) && /\.admin-register-check/.test(adminCss));
check('teacher-confirmed haidh promotes the student to Female + Haaidha',
  /UPDATE students SET gender = 'F', track_haidh = 1/.test(workerAttendance)
  && /if \(body\.status === 'haidh'\)[\s\S]*promoteHaaidhaFromTeacherMark/.test(workerAttendance)
  && /if \(status === 'haidh'\)[\s\S]*promoteHaaidhaFromTeacherMark/.test(workerAttendance));
check('predicted haidh does not itself trigger the promotion helper',
  /Predictions do NOT promote/.test(workerAttendance)
  && !/body\.status === 'predicted-haidh'[\s\S]{0,180}promoteHaaidhaFromTeacherMark/.test(workerAttendance));
check('teacher Maktab attendance can show the Haidh calendar before first promotion, while PJ remains gated',
  /const teacherMaktabEdit = typeof logCtxIsMaktab/.test(haidhPage)
  && /!\(d\.track_haidh \|\| teacherMaktabEdit\)/.test(haidhPage));
check('V4.2.11 page/cache keys agree',
  /js\/app\.js\?v=4\.2\.11/.test(html) && /CACHE_NAME = 'hifzhelper-v4\.2\.11'/.test(sw));
check('only served files edited in this release carry V4.2.11 headers among the pinned set',
  /^\/\* Hifzhelper build 4\.2\.11 \| css\/admin\.css \*\//.test(adminCss)
  && /^\/\* Hifzhelper build 4\.2\.11 \| css\/detail-pages\.css \*\//.test(css)
  && /^\/\* Hifzhelper build 4\.2\.11 \| js\/adminPage\.js \*\//.test(admin)
  && /^\/\* Hifzhelper build 4\.2\.11 \| js\/api\.js \*\//.test(api)
  && /^\/\* Hifzhelper build 4\.2\.11 \| js\/haidhDetailScreen\.js \*\//.test(haidhPage)
  && /^\/\* Hifzhelper build 4\.2\.11 \| js\/maktabAttendancePage\.js \*\//.test(page)
  && /^\/\* Hifzhelper build 4\.2\.11 \| js\/sw\.js \*\//.test(sw));
check('no new migration was introduced for gender/track_haidh',
  fs.readdirSync(path.join(ROOT, 'worker/migrations')).sort().at(-1).startsWith('0029_'));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
