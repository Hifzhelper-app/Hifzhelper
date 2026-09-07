// V4.2.15.3 — Daily Maktab Report: activity-only date filter + native file share.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond, extra = '') => { if(cond) pass++; else { fail++; console.log('FAIL:', label, extra); } };

const html = read('index.html');
const src = read('js/maktabDailyReport.js');
const css = read('css/daily-report.css');
const sw = read('js/sw.js');

check('Maktab Summary header exposes the Daily Report action beside Attendance',
  /class="maktab-summary-actions"[\s\S]{0,500}id="maktabSummaryAttendanceBtn"[\s\S]{0,500}id="maktabSummaryDailyReportBtn"/.test(html));

check('Daily Report has its own native date input and reloads through the existing Summary endpoint',
  /type="date" id="maktabDailyReportDate"/.test(src)
  && /wireCustomDateDisplay\('maktabDailyReportDate'\)/.test(src)
  && /await apiMaktabSummary\(date\)/.test(src));

check('report is explicitly activity-only across Sabaq, Sabaq Dhor and Dhor',
  /\['sabaq','sabaqDhor','dhor'\]\.some\(type => \(byStudent\[type\]\[stu\.id\] \|\| \[\]\)\.length > 0\)/.test(src));

check('preview keeps the Maktab Summary information columns and row numbering',
  /<th class="report-no">#<\/th><th class="report-student">Student<\/th><th>Sabaq<\/th><th>Sabaq Dhor<\/th><th>Dhor<\/th>/.test(src)
  && /num\.textContent = String\(index \+ 1\)/.test(src)
  && /maktabCellHtml\(type, entries\)/.test(src));

check('shared report is a generated PNG File sent through the native Web Share API',
  /new File\(\[blob\], filename, \{ type:'image\/png' \}\)/.test(src)
  && /navigator\.canShare\(\{ files:\[file\] \}\)/.test(src)
  && /navigator\.share\(\{ title, text:title, files:\[file\] \}\)/.test(src));

check('browser without native file sharing still lets the teacher save the same PNG',
  /maktabDailyReportDownload\(blob, filename\)/.test(src)
  && /a\.download = filename/.test(src));

check('share image visually retains sage/mauve table headers and the blue student-name pill',
  /--palette-sage/.test(src)
  && /--color-table-header-log|#D4929A/.test(src)
  && /--color-accent-soft/.test(src)
  && /maktabDailyReportRoundedRect\(ctx, pillX, pillY/.test(src));

// Drive the activity filter, rather than only scanning it.
const context = {
  document: { getElementById(){ return null; } },
  maktabSummaryCompareName(a,b){ return String(a.name).localeCompare(String(b.name)); }
};
vm.createContext(context);
vm.runInContext(src, context);
const sample = {
  students:[{id:'c',name:'Cee'},{id:'b',name:'Bee'},{id:'a',name:'Aye'}],
  sabaq:[{student_id:'b'}],
  sabaq_dhor:[],
  dhor:[{student_id:'a'}]
};
const rows = vm.runInContext('maktabDailyReportRows(__sample)', Object.assign(context, { __sample: sample }));
check('functional filter excludes no-log students and alphabetises the logged band',
  rows.length === 2 && rows[0].student.id === 'a' && rows[1].student.id === 'b');

check('new assets carry V4.2.15.3 last-edit headers',
  /^\/\* Hifzhelper build 4\.2\.15\.3 \| js\/maktabDailyReport\.js \*\//.test(src)
  && /^\/\* Hifzhelper build 4\.2\.15\.3 \| css\/daily-report\.css \*\//.test(css));

const pageVersions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
const cacheVersion = (sw.match(/CACHE_NAME = 'hifzhelper-v([0-9.]+)'/) || [])[1];
check('later page/cache overlays stay aligned and service-worker precache still includes both V4.2.15.3 report assets',
  pageVersions.length > 0 && !!cacheVersion && pageVersions.every(v => v === cacheVersion)
  && new RegExp('daily-report\\.css\\?v=' + cacheVersion.replace(/\./g,'\\.')).test(sw)
  && new RegExp('maktabDailyReport\\.js\\?v=' + cacheVersion.replace(/\./g,'\\.')).test(sw));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
