#!/usr/bin/env node
// V4.2.8.2 cumulative UI pins — items 68 + 72 plus the mobile-summary follow-up patches.
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
check('68 mobile correction: stacked cells override the higher-specificity desktop 7/21/24% column widths',
  /@media \(max-width: 767px\)[\s\S]*\.maktab-summary-table td:nth-child\(n\) \{ width: 100%; \}/.test(journalCss));
check('68: +N stays with the value as one mobile grid item, scoped to Summary only',
  /td\.innerHTML = `<span class="maktab-summary-cell-value">\${maktabCellHtml\(type, byStudent\[type\]\[stu\.id\]\)}<\/span>`;/.test(summaryJs)
  && /td\.innerHTML = maktabCellHtml\(type, days\[date\]\[type\]\);/.test(maktabJournalJs));

check('name pills: every summary pill fills the same name-cell width',
  /\.maktab-student-name \.maktab-name-pill \{[\s\S]*display: block;[\s\S]*width: 100%;/.test(journalCss));
check('name pills: long names are visually ellipsised, not allowed to stretch the pill',
  /\.maktab-student-name \.maktab-name-pill \{[\s\S]*overflow: hidden;[\s\S]*white-space: nowrap;[\s\S]*text-overflow: ellipsis;/.test(journalCss));
check('name pills: full name remains available in the real render and skeleton render',
  (summaryJs.match(/\.title = stu\.name;/g) || []).length >= 2);
check('4.2.8.2: mobile top line is a name + attendance sibling grid, not an absolute icon over the name cell',
  /\.maktab-summary-table tr:not\(\.maktab-group-gap\) \{[\s\S]*display: grid;[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto;/.test(journalCss)
  && /\.maktab-summary-table td\.maktab-haidh-col \{[\s\S]*position: static;[\s\S]*grid-column: 2;[\s\S]*grid-row: 1;/.test(journalCss)
  && /\.maktab-summary-table \.maktab-student-name \{[\s\S]*grid-column: 1;[\s\S]*grid-row: 1;/.test(journalCss)
  && !/padding: 0 52px 6px 0/.test(journalCss));
check('4.2.8.2: all three mobile log cells span underneath both top-line columns',
  /\.maktab-summary-table \.journal-cell \{[\s\S]*grid-column: 1 \/ -1;/.test(journalCss));
check('4.2.8.2: instant-name paint wraps attendance SVG in the same sizing class (no giant naked SVG flash)',
  /attendanceGhost\.className = 'maktab-haidh-check maktab-summary-skeleton-attendance';/.test(summaryJs)
  && /haidhTd\.appendChild\(attendanceGhost\);/.test(summaryJs)
  && !/haidhTd\.innerHTML = typeof iconHtml/.test(summaryJs));
check('4.2.8.2: existing summary navigation targets remain distinct',
  /nameTd\.addEventListener\('click',[\s\S]{0,220}openStudentSummaryPage/.test(summaryJs)
  && /btn\.addEventListener\('click',[\s\S]{0,220}openMaktabAttendancePage/.test(summaryJs)
  && /td\.addEventListener\('click',[\s\S]{0,260}openMaktabDay\([^\n]+date, type\)/.test(summaryJs));

check('72: old quarter select and Use button are gone',
  !/id="sdq_apply"|class="secondary sdq-apply"|>Use</.test(sdJs)
  && !/<select id="sdq_quarter">/.test(sdJs));
check('72: quarter position is a shared 1|2|3|4 switch with hidden value',
  /id="sdq_quarter" value="1"/.test(sdJs)
  && /id="sdq_quarter_switch"/.test(sdJs)
  && /Array\.from\(\{ length: 4 \}/.test(sdJs)
  && /wireSwitch\('sdq_quarter_switch'/.test(sdJs));
check('72: the picker has its own right-hand checkbox',
  /class="checkbox-box(?: [^"]*)?"><input type="checkbox" id="sdq_confirm"/.test(sdJs));
check('72: ticking the picker contributes structuralQuarterBounds directly to the existing save composite',
  /const picked = sdqConfirm && sdqConfirm\.checked \? sdqBounds\(\) : null;/.test(sdJs)
  && /fromSurah: picked\.startSurah/.test(sdJs)
  && /toSurah: picked\.endSurah/.test(sdJs));
check('72: a successful save clears the picker confirmation before the preserving re-render (no duplicate-save carryover)',
  /const sdqConfirm = document\.getElementById\('sdq_confirm'\);\n    if\(sdqConfirm\) sdqConfirm\.checked = false;\n    await renderSabaqDhorScreen\(\);/.test(sdJs));
check('72/67: picker controls remain min-width guarded after later alignment refinements',
  /\.sdq-picker \{ grid-column: 1(?: \/ -1)?; min-width: 0;/.test(detailCss)
  && /\.sdq-field select \{\n  min-width: 0;/.test(detailCss)
  && /#sdq_quarter_switch \{[^}]*width: 100%; min-width: 0;/.test(detailCss));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
