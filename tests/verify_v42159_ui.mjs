#!/usr/bin/env node
// V4.2.15.11 — transparent Maktab Log action rail + unified selector polish +
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
// Release identity and last-edit headers are checked centrally by verify_build_stamp.mjs.

check('Maktab Summary has no visible Log header cell',
  /class="journal-header-cell maktab-log-head" aria-hidden="true"><\/div>/.test(html)
  && !/<span>Log<\/span>/.test(html.slice(html.indexOf('maktab-summary-headers'), html.indexOf('maktabSummaryBody'))));

check('Maktab Summary desktop Log column is white with a compact horizontal action',
  /@media \(min-width: 768px\) \{[\s\S]*td\.maktab-mobile-log-col \{\s*background: var\(--color-surface, #fff\);/.test(journalCss)
  && /#screen-maktabSummary \.maktab-mobile-log-action \{\s*flex-direction: row;/.test(journalCss));

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

// Release identity and last-edit headers are checked centrally by verify_build_stamp.mjs.

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
