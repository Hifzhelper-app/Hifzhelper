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
const haidh = read('js/haidhDetailScreen.js');

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

check('V4.2.15.2 Attendance quick action carries the selected Summary date into the reused calendar popup',
  /const selectedDate = date \|\| maktabTodayISO\(\)/.test(day)
  && /renderHaidhDetailScreen\(\{ maktab: true, date: selectedDate \}\)/.test(day));

check('the shared Attendance calendar keeps its native month/day selection instead of a second Quick Attendance date control',
  !/maktabQuickAttendanceDate/.test(day)
  && /onHaidhCalDayTap\(dateISO\)/.test(haidh));

check('the shared Attendance calendar keeps activity precedence and range Haidh semantics',
  /status === 'activity' && haidhRangeStart == null/.test(haidh)
  && /haidhCalClient\(\)\.markRange\(bounds\[0\], bounds\[1\]\)/.test(haidh));

check('the shared Attendance calendar supports the existing Absent range action',
  /for\(let d = bounds\[0\]; d <= bounds\[1\]; d = haidhAddDaysISO\(d, 1\)\)/.test(haidh)
  && /client\.setDay\(d, 'predicted-absent'\)/.test(haidh));

check('both quick-action date controls keep the common 42px pill height',
  /\.maktab-quick-date-control \{[\s\S]{0,180}height: 42px/.test(css)
  && /\.maktab-quick-date-control \.custom-date-wrap \{[\s\S]{0,100}height: 42px/.test(css)
  && /\.maktab-quick-date-input,[\s\S]{0,180}height: 42px/.test(css));

const versions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
const cacheVersion = (sw.match(/CACHE_NAME = 'hifzhelper-v([0-9.]+)'/) || [])[1];
check('V4.2.14.4 Quick Log date feature remains present while page/cache carry forward together',
  versions.length > 0 && !!cacheVersion && versions.every(v => v === cacheVersion));

check('quick-action files retain their last-edit headers while the later Attendance popup edits carry current headers',
  /^\/\* Hifzhelper build 4\.2\.15\.8 \| js\/maktabSummary\.js \*\//.test(summary)
  && /^\/\* Hifzhelper build 4\.2\.15\.6 \| js\/maktabDay\.js \*\//.test(day)
  && /^\/\* Hifzhelper build 4\.2\.15\.8 \| css\/journal-table\.css \*\//.test(css));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
