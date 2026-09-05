#!/usr/bin/env node
// V4.2.14.4 — selectable dates on Quick Log and Quick Attendance.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const summary = read('js/maktabSummary.js');
const day = read('js/maktabDay.js');
const css = read('css/journal-table.css');
const html = read('index.html');
const sw = read('js/sw.js');

check('Quick Log renders a real selectable date input',
  /type="date" id="\$\{id\}" class="maktab-quick-date-input"/.test(summary)
  && /maktabQuickDateControl\('maktabQuickLogDate', date, 'Quick Log date'\)/.test(summary)
  && /wireCustomDateDisplay\('maktabQuickLogDate'\)/.test(summary));

check('Quick Log date change updates the state date and reloads exact-day Summary data',
  /async function maktabQuickChangeDate\(nextDate\)[\s\S]{0,420}state\.date = nextDate/.test(summary)
  && /apiMaktabSummary\(nextDate\)/.test(summary)
  && /maktabQuickEntryMapForDate\(data, state\.student\.id\)/.test(summary));

check('Quick Log never leaves old-date existing rows visible while a date reload is in flight',
  /state\.entriesByType = \{ sabaq: \[\], sabaqDhor: \[\], dhor: \[\] \};[\s\S]{0,120}maktabQuickRenderBody\(\)/.test(summary));

check('Quick Log date change requires confirmation again and has stale-request protection',
  /confirmBox\.checked = false/.test(summary)
  && /dateLoadToken/.test(summary)
  && /token !== state\.dateLoadToken/.test(summary));

check('Quick Log Save and Detail continue to use the currently selected state date',
  /payload = \{ student_id: state\.student\.id, date: state\.date, sabaq_from:/.test(summary)
  && /payload = \{ student_id: state\.student\.id, date: state\.date, from_surah:/.test(summary)
  && /payload = \{ student_id: state\.student\.id, date: state\.date, segment_from:/.test(summary)
  && /openMaktabDay\([\s\S]{0,260}snapshot\.date, snapshot\.type\)/.test(summary));

check('Quick Attendance renders the same native/selectable date pattern',
  /type="date" id="maktabQuickAttendanceDate" class="maktab-quick-date-input"/.test(day)
  && /wireCustomDateDisplay\('maktabQuickAttendanceDate'\)/.test(day));

check('Quick Attendance date change re-resolves the normalized row instead of carrying the old choice',
  /function maktabQuickAttendanceApplyDate\(nextDate\)[\s\S]{0,500}state\.date = nextDate/.test(day)
  && /state\.attendanceRows \|\| \[\]\)\.find\(r => r && r\.date === nextDate\)/.test(day)
  && /state\.choice = maktabQuickAttendanceChoice\(state\.currentStatus\)/.test(day));

check('Quick Attendance recomputes future semantics and activity lock on the selected date',
  /state\.future = nextDate > maktabTodayISO\(\)/.test(day)
  && /state\.lockedByActivity = state\.currentStatus === 'activity'/.test(day)
  && /haidhBtn\.textContent = state\.future \? 'Predict Haidh' : 'Haidh'/.test(day)
  && /absentBtn\.textContent = state\.future \? 'Plan absent' : 'Absent'/.test(day));

check('Quick Attendance Save and Detail use the newly selected date',
  /apiSetAttendanceFor\(state\.student\.id, state\.date, status\)/.test(day)
  && /openMaktabAttendancePage\(snapshot\.student, snapshot\.date\)/.test(day));

check('both quick-action date controls keep the common 42px pill height',
  /\.maktab-quick-date-control \{[\s\S]{0,180}height: 42px/.test(css)
  && /\.maktab-quick-date-control \.custom-date-wrap \{[\s\S]{0,100}height: 42px/.test(css)
  && /\.maktab-quick-date-input,[\s\S]{0,180}height: 42px/.test(css));

const versions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
check('V4.2.14.4 feature remains present while page/cache carry forward to V4.2.14.5',
  versions.length > 0 && versions.every(v => v === '4.2.14.5')
  && /CACHE_NAME = 'hifzhelper-v4\.2\.14\.5'/.test(sw));

check('only the quick-action served files edited in this release carry V4.2.14.4 headers',
  /^\/\* Hifzhelper build 4\.2\.14\.4 \| js\/maktabSummary\.js \*\//.test(summary)
  && /^\/\* Hifzhelper build 4\.2\.14\.4 \| js\/maktabDay\.js \*\//.test(day)
  && /^\/\* Hifzhelper build 4\.2\.14\.4 \| css\/journal-table\.css \*\//.test(css));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
