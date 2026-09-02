#!/usr/bin/env node
// V4.2.10 — log-detail student search + name pill + SDhor empty-state alignment.
// Dependency-free structural pins.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const html = read('index.html');
const detailCss = read('css/detail-pages.css');
const journalCss = read('css/journal-table.css');
const logJs = read('js/logDetailScreen.js');
const sdJs = read('js/sabaqDhorPage.js');
const sw = read('js/sw.js');

check('shared log-detail student search exists above the three-card rail',
  /id="logDetailStudentSearch"[\s\S]*id="logDetailStudentSearchInput"[\s\S]*id="logDetailStudentSearchResults"[\s\S]*id="logDetailRail"/.test(html));
check('search is teaching-only and hidden for read-only/PJ contexts',
  /const canSearch = typeof logCtxIsMaktab[\s\S]*logCtxIsMaktab\(\)[\s\S]*logCtxReadOnly\(\)/.test(logJs)
  && /wrap\.classList\.toggle\('hidden', !canSearch\)/.test(logJs));
check('search reuses the in-memory Maktab roster with a defensive summary fallback',
  /maktabRosterCache/.test(logJs)
  && /apiMaktabSummary\(date\)/.test(logJs));
check('student search matches name or unique id and switches student',
  /String\(stu\.name \|\| ''\)[\s\S]*String\(stu\.id \|\| ''\)/.test(logJs)
  && /await openMaktabDay\(stu, date, initialCard\)/.test(logJs));
check('student switch preserves whichever Sabaq/SDhor/Dhor card is active',
  /function logDetailCurrentCard\(\)[\s\S]*LOG_DETAIL_CARD_ORDER\[idx\]/.test(logJs));
check('active Maktab student name uses the soft-blue pill treatment',
  /\.maktab-name-text \{[\s\S]*background: var\(--color-accent-soft[\s\S]*border-radius: 999px/.test(journalCss));
check('empty-state Juz and quarter controls share an explicit 42px height',
  /\.sdq-field select \{[\s\S]*height: 42px;/.test(detailCss)
  && /#sdq_quarter_switch \{[^}]*height: 42px;/.test(detailCss));
check('empty-state confirmation checkbox is inside the same selector row',
  /class="checkbox-box sdq-confirm-box"[\s\S]*id="sdq_confirm"/.test(sdJs)
  && /\.sdq-row \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\) 44px/.test(detailCss)
  && /\.sdq-confirm-box \{[^}]*align-self: end;[^}]*height: 42px;/.test(detailCss));
check('picker remains shrink-safe and full-span inside the sections group',
  /\.sdq-picker \{ grid-column: 1 \/ -1; min-width: 0;/.test(detailCss)
  && /\.sdq-row \{[\s\S]*min-width: 0;/.test(detailCss));
check('V4.2.10 page/cache keys agree',
  /js\/app\.js\?v=4\.2\.10/.test(html)
  && /CACHE_NAME = 'hifzhelper-v4\.2\.10'/.test(sw));
check('only edited served files checked here carry V4.2.10 headers',
  /^\/\* Hifzhelper build 4\.2\.10 \| css\/detail-pages\.css \*\//.test(detailCss)
  && /^\/\* Hifzhelper build 4\.2\.10 \| css\/journal-table\.css \*\//.test(journalCss)
  && /^\/\* Hifzhelper build 4\.2\.10 \| js\/logDetailScreen\.js \*\//.test(logJs)
  && /^\/\* Hifzhelper build 4\.2\.10 \| js\/sabaqDhorPage\.js \*\//.test(sdJs)
  && /^\/\* Hifzhelper build 4\.2\.10 \| js\/sw\.js \*\//.test(sw));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
