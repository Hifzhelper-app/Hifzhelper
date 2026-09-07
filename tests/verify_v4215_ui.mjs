#!/usr/bin/env node
// V4.2.15 — Maktab Summary numbering + Attendance navigation + Quick Log prepopulation.
// Dependency-free structural pins.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const html = read('index.html');
const summary = read('js/maktabSummary.js');
const day = read('js/maktabDay.js');
const css = read('css/journal-table.css');
const haidh = read('js/haidhDetailScreen.js');
const sw = read('js/sw.js');

check('Maktab Summary renders a sequential row number beside each attendance icon',
  /sortedStudents\.forEach\(\(stu, rowIndex\) =>/.test(summary)
  && /rowNumber\.textContent = String\(rowIndex \+ 1\)/.test(summary)
  && /rowMeta\.appendChild\(rowNumber\)[\s\S]{0,1100}rowMeta\.appendChild\(btn\)/.test(summary));

check('Maktab Summary top row has an Attendance button that opens the Attendance summary',
  /id="maktabSummaryAttendanceBtn"/.test(html)
  && /maktabSummaryAttendanceBtn\.innerHTML = iconHtml\('attendance'\) \+ '<span>Attendance<\/span>'/.test(summary)
  && /maktabSummaryAttendanceBtn\.addEventListener\('click', \(\) => showScreen\('maktabAttendance'\)\)/.test(summary));

check('Sabaq Quick Log reuses Sabaq-history frontier/default prepopulation',
  /apiGetMaktabSabaq\(studentId\)/.test(summary)
  && /computeActualSabaqFrontier\(sabaqRows, ref\)/.test(summary)
  && /nextSabaqDefaults\(frontier, ref, dhorRows\.length > 0\)/.test(summary)
  && /sabaq: \{ from:maktabQuickCloneVerse\(sabaqDefaults\.from\), to:maktabQuickCloneVerse\(sabaqDefaults\.to\) \}/.test(summary));

check('Sabaq Dhor Quick Log reuses quarter-derived rows plus manual From/To',
  /computeSabaqDhorRows\(decoratedPosition, ref, 'quarters', baselineSelection\)/.test(summary)
  && /maktab-quick-sd-row-pill/.test(summary)
  && /class="mql-sd-row-cb"/.test(summary)
  && /maktabQuickVerseField\('from', 'From'\)/.test(summary)
  && /maktabQuickVerseField\('to', 'To'\)/.test(summary));

check('Quick Log Detail uses the detail icon+label beside the date and opens the full card',
  /maktab-quick-date-row[\s\S]{0,500}id="maktabQuickLogDetails"[\s\S]{0,200}iconHtml\('detail'\)[\s\S]{0,120}<span>Detail<\/span>/.test(summary)
  && /maktabQuickLogDetails[\s\S]{0,350}openMaktabDay/.test(summary)
  && /\.maktab-quick-detail-icon \{[\s\S]{0,180}width: 42px;[\s\S]{0,80}height: 42px/.test(css));

check('per-student Attendance action opens the quick popup powered by the established Attendance calendar',
  /function maktabOpenQuickAttendance\(student, date\)/.test(day)
  && /maktabQuickAttendanceCalendarHost'\)\.appendChild\(block\)/.test(day)
  && /maktabOpenQuickAttendance\(stu, date\)/.test(summary));

check('existing Attendance calendar retains start/end selection plus Haidh and Absent writes',
  /tap 1 = start, tap 2 = end/.test(haidh)
  && /if\(haidhRangeStart == null\)[\s\S]{0,220}haidhRangeStart = dateISO[\s\S]{0,180}haidhRangeEnd = dateISO/.test(haidh)
  && /haidhCalClient\(\)\.markRange\(bounds\[0\], bounds\[1\]\)/.test(haidh)
  && /client\.setDay\(d, 'predicted-absent'\)/.test(haidh));

const versions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
check('V4.2.15 functionality remains on the later V4.2.15.2 page/cache overlay',
  versions.length > 0 && versions.every(v => v === '4.2.15.2')
  && /CACHE_NAME = 'hifzhelper-v4\.2\.15\.2'/.test(sw));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
