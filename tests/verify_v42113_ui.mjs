#!/usr/bin/env node
// V4.2.11.3 — one shared log-detail date + current-day attendance ordering.
// Dependency-free structural + small dynamic pins.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const html = read('index.html');
const css = read('css/detail-pages.css');
const log = read('js/logDetailScreen.js');
const ctx = read('js/logContext.js');
const att = read('js/maktabAttendancePage.js');
const sabaq = read('js/sabaqPage.js');
const sd = read('js/sabaqDhorPage.js');
const dhor = read('js/dhorPage.js');
const sw = read('js/sw.js');

check('one shared date sits to the left of the existing student search',
  /id="logDetailContextRow"[\s\S]*id="logDetailSharedDate"[\s\S]*id="logDetailStudentSearch"[\s\S]*id="logDetailRail"/.test(html)
  && /\.log-detail-context-row \{[\s\S]*display: flex/.test(css));
check('the three per-card dates remain mounted but are hidden in normal mode',
  (html.match(/card-date-row log-detail-card-date-source hidden/g) || []).length === 3
  && /\.log-detail-card-date-source\.hidden \{ display: none !important; \}/.test(css));
check('shared date mirrors to all three source inputs',
  /LOG_DETAIL_DATE_INPUT_IDS = \['sabaq_date', 'sabaqDhor_date', 'dhor_date'\]/.test(log)
  && /LOG_DETAIL_DATE_INPUT_IDS\.forEach/.test(log)
  && /input\.addEventListener\('change', \(\) => applyLogDetailSharedDate\(input\.value, true\)\)/.test(log));
check('Maktab context date is updated so student switching preserves the shared day',
  /function setLogCtxDate\(date\)/.test(ctx)
  && /if\(updateContext && typeof setLogCtxDate === 'function'\) setLogCtxDate\(value\)/.test(log)
  && /const date = \(typeof logCtxDate === 'function' && logCtxDate\(\)\)/.test(log));
check('all three new-entry/reset paths follow the visible shared date',
  /logDetailSelectedDate/.test(sabaq) && /logDetailSelectedDate/.test(sd) && /logDetailSelectedDate/.test(dhor));
check('Dhor Plan remains visible after its old date row is retired',
  /class="dhor-shared-date-plan-row"[\s\S]*id="dhorViewPlanBtn"/.test(html));

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(att, sandbox);
const d = '2026-09-02';
const rows = [
  { id:'5', name:'Zara Noor', cells:{ [d]:'haidh' } },
  { id:'2', name:'Amina Khan', cells:{} },
  { id:'4', name:'Bilal Khan', cells:{ [d]:'present' } },
  { id:'1', name:'Aadil Noor', cells:{ [d]:'present' } },
  { id:'3', name:'Fatima Noor', cells:{ [d]:'haidh' } },
];
const ordered = sandbox.mkregSortStudents(rows, d).map(r => r.name);
check('attendance order is log first, then Haidh, then remaining students',
  JSON.stringify(ordered) === JSON.stringify(['Aadil Noor','Bilal Khan','Fatima Noor','Zara Noor','Amina Khan']));
check('a log outranks Haidh because register cells already resolve log as Present',
  /if\(status === 'present'\) return 0;[\s\S]*if\(status === 'haidh'\) return 1;/.test(att));
check('status groups sort alphabetically by first name',
  /ak\.first\.localeCompare\(bk\.first\)/.test(att));
check('register applies the order using the current Maktab date',
  /mkregSortStudents\(data\.students \|\| \[\], data\.today\)/.test(att));
check('V4.2.11.3 behavior remains intact under the V4.2.12.1 page/cache key',
  /js\/app\.js\?v=4\.2\.12\.1/.test(html) && /CACHE_NAME = 'hifzhelper-v4\.2\.12\.1'/.test(sw));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
