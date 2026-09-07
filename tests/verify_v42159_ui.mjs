#!/usr/bin/env node
// V4.2.15.9 — transparent Maktab Log action rail + unified selector polish +
// Attendance Save label + Student Summary unified Log Quick Action.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const html = read('index.html');
const sw = read('js/sw.js');
const day = read('js/maktabDay.js');
const summary = read('js/maktabSummary.js');
const journalCss = read('css/journal-table.css');
const haidhCss = read('css/haidh.css');

const versions = [...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]);
check('served asset versions and service-worker cache are aligned on V4.2.15.9',
  versions.length > 0 && versions.every(v => v === '4.2.15.9')
  && /CACHE_NAME = 'hifzhelper-v4\.2\.15\.9'/.test(sw));

check('Maktab Summary has no visible Log header cell',
  !/maktab-log-head/.test(html)
  && !/<span>Log<\/span>/.test(html.slice(html.indexOf('maktab-summary-headers'), html.indexOf('maktabSummaryBody'))));

check('Maktab Summary desktop Log rail is transparent and outside the white data table chrome',
  /#screen-maktabSummary \.journal-wrap \{[\s\S]{0,180}background: transparent;[\s\S]{0,100}border: 0;/.test(journalCss)
  && /td\.maktab-mobile-log-col \{[\s\S]{0,120}background: transparent;[\s\S]{0,80}border-bottom: 0;/.test(journalCss)
  && !/\.maktab-summary-headers > \*:nth-child\(6\)/.test(journalCss));

check('row Log action remains circle-plus + Log and always opens unified Quick Log',
  /mobileLogBtn\.innerHTML = `<span class="maktab-mobile-log-icon">\$\{iconHtml\('circlePlus'\)\}<\/span><span>Log<\/span>`/.test(summary)
  && /maktabOpenQuickLog\(student, date, 'sabaq', entriesByType\.sabaq, entriesByType, \{ combined: true \}\)/.test(summary));

check('unified Sabaq/Sabaq Dhor/Dhor selector has dark outline and green active highlight',
  /\.maktab-quick-log-card \.maktab-quick-type-switch \{[\s\S]{0,180}border: 2px solid var\(--palette-evergreen/.test(journalCss)
  && /\.maktab-quick-log-card \.maktab-quick-type-switch button\.on \{[\s\S]{0,140}background: var\(--palette-evergreen/.test(journalCss)
  && /color: #fff;/.test(journalCss));

check('Attendance Quick Action Save now uses the same icon plus label pattern as Detail',
  /id="maktabQuickAttendanceSave"[^>]*><span class="maktab-quick-attendance-save-icon">\$\{iconHtml\('save'\)\}<\/span><span>Save<\/span><\/button>/.test(day)
  && /\.maktab-quick-attendance-save \{[\s\S]{0,160}flex-direction: column;/.test(haidhCss)
  && /\.maktab-quick-attendance-save-icon \{[\s\S]{0,120}width: 50px;[\s\S]{0,60}height: 50px;/.test(haidhCss));

check('Student Summary activity headings are display-only and no longer individual Quick Log targets',
  !/data-ss-quick-type/.test(html)
  && !/quickLogButtons/.test(day));

check('Student Summary circle-plus forces the single unified selector on desktop/tablet too',
  /quickOpenBtn\.onclick = \(\) => maktabOpenQuickLog\([\s\S]{0,260}\{ combined: true, afterSave: \(\) => renderStudentSummaryScreen\(\) \}/.test(day));

check('last-edit headers changed only in product files actually edited for V4.2.15.9',
  /^<!-- Hifzhelper build 4\.2\.15\.9 \| index\.html -->/m.test(html)
  && /^\/\* Hifzhelper build 4\.2\.15\.9 \| js\/sw\.js \*\//.test(sw)
  && /^\/\* Hifzhelper build 4\.2\.15\.9 \| js\/maktabDay\.js \*\//.test(day)
  && /^\/\* Hifzhelper build 4\.2\.15\.9 \| css\/journal-table\.css \*\//.test(journalCss)
  && /^\/\* Hifzhelper build 4\.2\.15\.9 \| css\/haidh\.css \*\//.test(haidhCss)
  && /^\/\* Hifzhelper build 4\.2\.15\.8 \| js\/maktabSummary\.js \*\//.test(summary)
  && /^\/\* Hifzhelper build 4\.2\.15\.7 \| css\/detail-pages\.css \*\//.test(read('css/detail-pages.css'))
  && /^\/\* Hifzhelper build 4\.2\.15\.8 \| worker\/src\/maktabCalendar\.js \*\//.test(read('worker/src/maktabCalendar.js')));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
