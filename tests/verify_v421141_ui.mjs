#!/usr/bin/env node
// V4.2.14.1 — Quick Log mobile alignment + Quick Attendance actions.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const summary = read('js/maktabSummary.js');
const day = read('js/maktabDay.js');
const journalCss = read('css/journal-table.css');
const detailCss = read('css/detail-pages.css');
const haidh = read('js/haidhDetailScreen.js');
const html = read('index.html');
const sw = read('js/sw.js');

check('Quick Log type selector stays in normal flow and has the common 42px control height',
  /\.maktab-quick-log-card \.maktab-quick-type-switch \{[\s\S]*position: static;[\s\S]*min-height: 42px/.test(journalCss)
  && /\.maktab-quick-log-card \.maktab-quick-type-switch button \{[\s\S]*height: 42px/.test(journalCss));

check('Dhor places Juz selector beside Juz Portion, then Portion number on its own row',
  /maktab-quick-dhor-primary-row/.test(summary)
  && /id="mql_dhor_juz"/.test(summary)
  && /id="mql_dhor_unit" aria-label="Juz portion"/.test(summary)
  && /maktab-quick-dhor-position-row/.test(summary)
  && /id="mql_dhor_position" aria-label="Portion number"/.test(summary));

check('Quick Log Juz, Juz Portion and Portion Number controls share the same height without absolute overlap',
  /\.maktab-quick-log-card \.maktab-quick-unit-pill,[\s\S]*\.maktab-quick-log-card \.maktab-quick-position-pill \{[\s\S]*position: static;[\s\S]*min-height: 42px/.test(journalCss)
  && /\.modal-card \.maktab-quick-dhor-primary-row select \{[\s\S]*height: 42px/.test(journalCss));

check('Confirm and Save remain matching actions while Detail is promoted beside the date',
  /maktabQuickConfirmControl\(\)/.test(summary)
  && /id="maktabQuickLogSave"/.test(summary)
  && /maktab-quick-date-row[\s\S]{0,500}id="maktabQuickLogDetails"/.test(summary)
  && /\.maktab-quick-confirm-action \{[\s\S]*height: 42px/.test(journalCss)
  && /\.maktab-quick-actions \.maktab-quick-save \{[\s\S]*height: 42px/.test(journalCss)
  && /\.maktab-quick-detail-icon \{[\s\S]{0,180}height: 42px/.test(journalCss));

check('Maktab Summary attendance icon now opens the existing Attendance calendar directly',
  /maktabOpenQuickAttendance\(stu, date\)/.test(summary)
  && /aria-label', 'Attendance for '/.test(summary));

check('Student Summary attendance icon opens the same Attendance calendar on its context date',
  /studentSummaryAttendanceBtn/.test(day)
  && /maktabOpenQuickAttendance\(student, (?:logCtxDate\(\)|quickDate)/.test(day));

check('V4.2.15.2 keeps the established Student Attendance calendar as the Quick Attendance popup engine',
  /function maktabOpenQuickAttendance\(student, date\)/.test(day)
  && /getElementById\('attHaidhBlock'\)/.test(day)
  && /maktabQuickAttendanceCalendarHost'\)\.appendChild\(block\)/.test(day)
  && /renderHaidhDetailScreen\(\{ maktab: true, date: selectedDate \}\)/.test(day));

check('the established calendar owns Haidh/Absent range semantics and activity precedence',
  /tap 1 = start, tap 2 = end/.test(haidh)
  && /haidhCalClient\(\)\.markRange\(bounds\[0\], bounds\[1\]\)/.test(haidh)
  && /client\.setDay\(d, 'predicted-absent'\)/.test(haidh)
  && /Maktab activity is logged on this date and takes precedence over Haidh/.test(haidh));

check('the Attendance popup Detail action preserves the route to the full Student Attendance page',
  /maktabQuickAttendanceDetail[\s\S]{0,500}showScreen\('attendancePage', \{ maktab: true, date: snapshot\.date \}\)/.test(day));

check('Attendance register H/h is about 25 percent smaller than V4.2.14',
  /mkregister-status-haidh-confirmed \{[^}]*font-size: 14px/.test(detailCss)
  && /mkregister-status-haidh-predicted \{[^}]*font-size: 14px/.test(detailCss));

const servedVersions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
const swVersion = (sw.match(/CACHE_NAME = 'hifzhelper-v([0-9.]+)'/) || [])[1];
check('V4.2.14.1 cache-consistency contract remains true on later overlays',
  servedVersions.length > 0 && !!swVersion && servedVersions.every(v => v === swVersion));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
