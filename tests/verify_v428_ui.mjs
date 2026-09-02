#!/usr/bin/env node
// V4.2.8 — items 68 + 72, plus the user's same-width name-pill trial.
// Static/structural pins only: no jsdom dependency, so this harness can run
// even in a bare checkout before the broader test dependencies are present.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond, extra = '') => { if(cond) pass++; else { fail++; console.log('FAIL:', label, extra); } };

const summaryJs = read('js/maktabSummary.js');
const maktabJournalJs = read('js/maktabJournal.js');
const journalCss = read('css/journal-table.css');
const sdJs = read('js/sabaqDhorPage.js');
const detailCss = read('css/detail-pages.css');

check('68: mobile summary values use a 96px + remaining-space GRID, not the old flex line',
  /grid-template-columns: 96px minmax\(0, 1fr\);/.test(journalCss)
  && /\.maktab-summary-table \.journal-cell \{[\s\S]*display: grid;/.test(journalCss)
  && !/\.maktab-summary-table \.journal-cell \{[\s\S]{0,180}display: flex;/.test(journalCss));
check('68: value track is shrink-safe and normal wrapping is restored',
  /\.maktab-summary-table \.journal-cell \{[\s\S]*min-width: 0;[\s\S]*white-space: normal;/.test(journalCss));
check('68: +N stays with the value as one mobile grid item, scoped to Summary only',
  /td\.innerHTML = `<span class="maktab-summary-cell-value">\${maktabCellHtml\(type, byStudent\[type\]\[stu\.id\]\)}<\/span>`;/.test(summaryJs)
  && /td\.innerHTML = maktabCellHtml\(type, days\[date\]\[type\]\);/.test(maktabJournalJs));

check('name pills: every summary pill fills the same name-cell width',
  /\.maktab-student-name \.maktab-name-pill \{[\s\S]*display: block;[\s\S]*width: 100%;/.test(journalCss));
check('name pills: long names are visually ellipsised, not allowed to stretch the pill',
  /\.maktab-student-name \.maktab-name-pill \{[\s\S]*overflow: hidden;[\s\S]*white-space: nowrap;[\s\S]*text-overflow: ellipsis;/.test(journalCss));
check('name pills: full name remains available in the real render and skeleton render',
  (summaryJs.match(/\.title = stu\.name;/g) || []).length >= 2);
check('name pills: mobile reserves the attendance-icon corner instead of letting the full-width pill run underneath it',
  /\.maktab-summary-table \.maktab-student-name \{[\s\S]*padding: 0 52px 6px 0;/.test(journalCss));

check('72: old quarter select and Use button are gone',
  !/id="sdq_apply"|class="secondary sdq-apply"|>Use</.test(sdJs)
  && !/<select id="sdq_quarter">/.test(sdJs));
check('72: quarter position is a shared 1|2|3|4 switch with hidden value',
  /id="sdq_quarter" value="1"/.test(sdJs)
  && /id="sdq_quarter_switch"/.test(sdJs)
  && /Array\.from\(\{ length: 4 \}/.test(sdJs)
  && /wireSwitch\('sdq_quarter_switch'/.test(sdJs));
check('72: the picker has its own right-hand checkbox',
  /class="checkbox-box"><input type="checkbox" id="sdq_confirm"/.test(sdJs));
check('72: ticking the picker contributes structuralQuarterBounds directly to the existing save composite',
  /const picked = sdqConfirm && sdqConfirm\.checked \? sdqBounds\(\) : null;/.test(sdJs)
  && /fromSurah: picked\.startSurah/.test(sdJs)
  && /toSurah: picked\.endSurah/.test(sdJs));
check('72: a successful save clears the picker confirmation before the preserving re-render (no duplicate-save carryover)',
  /const sdqConfirm = document\.getElementById\('sdq_confirm'\);\n    if\(sdqConfirm\) sdqConfirm\.checked = false;\n    await renderSabaqDhorScreen\(\);/.test(sdJs));
check('72/67: picker controls are min-width guarded and no longer span the whole shared grid',
  /\.sdq-picker \{ grid-column: 1; min-width: 0;/.test(detailCss)
  && /\.sdq-field select \{\n  min-width: 0;/.test(detailCss)
  && /#sdq_quarter_switch \{ width: 100%; min-width: 0; \}/.test(detailCss));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
