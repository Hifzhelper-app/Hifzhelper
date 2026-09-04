#!/usr/bin/env node
// V4.2.12.1 — Quick Log compact-card refinement + Maktab Summary ordering.
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond, extra='') => { if(cond) pass++; else { fail++; console.log('FAIL:', label, extra); } };

const js = read('js/maktabSummary.js');
const css = read('css/journal-table.css');
const html = read('index.html');
const sw = read('js/sw.js');

check('desktop Quick Log header keeps type and student name on one aligned line',
  /maktab-quick-kind/.test(js)
  && /maktab-quick-heading[\s\S]*maktab-quick-student/.test(js)
  && /grid-template-columns: auto minmax\(0, 1fr\)/.test(css));
check('Quick Log date is a shared second row in Wed 02 Sep form',
  /maktab-quick-date-row/.test(js)
  && /return `\$\{days\[d\.getDay\(\)\]\} \$\{String\(d\.getDate\(\)\)\.padStart\(2, '0'\)\} \$\{months\[d\.getMonth\(\)\]\}`/.test(js));
check('Dhor Juz selector and Juz Portion switch share one non-overlapping row',
  /maktab-quick-dhor-primary-row/.test(js)
  && /id="mql_dhor_juz"/.test(js)
  && /data-unit="quarter"[^>]*>Quarter</.test(js)
  && /data-unit="half"[^>]*>Half</.test(js)
  && /data-unit="full"[^>]*>Juz</.test(js)
  && /maktab-quick-log-card \.maktab-quick-unit-pill[\s\S]{0,220}position: static/.test(css));
check('Dhor Portion number has its own row and confirmation moves beside Save + Detail',
  /maktab-quick-dhor-position-row/.test(js)
  && /id="mql_dhor_position"/.test(js)
  && /maktabQuickConfirmControl\(\)/.test(js)
  && /grid-template-columns: minmax\(86px, \.8fr\) minmax\(120px, 1\.35fr\) auto/.test(css));
check('Confirm, Save and Detail share the same 42px action height',
  /maktab-quick-confirm-action[\s\S]{0,160}height: 42px/.test(css)
  && /maktab-quick-actions \.maktab-quick-save[\s\S]{0,160}height: 42px/.test(css)
  && /maktab-quick-details[\s\S]{0,120}min-height: 42px/.test(css));

check('phone uses one combined Quick Log card with a three-type selector',
  /maktabQuickIsMobile\(\)/.test(js)
  && /data-mql-type="sabaq"[^>]*>Sabaq</.test(js)
  && /data-mql-type="sabaqDhor"[^>]*>Sabaq Dhor</.test(js)
  && /data-mql-type="dhor"[^>]*>Dhor</.test(js));
check('phone row whitespace opens combined Quick Log instead of requiring a narrow cell tap',
  /if\(maktabQuickIsMobile\(\)\)[\s\S]{0,430}maktabOpenQuickLog\(student, date, 'sabaq'/.test(js));
check('mobile type switches keep independent drafts for all three log types',
  /drafts:\s*\{[\s\S]{0,220}sabaq:\s*\{ from:null, to:null \}[\s\S]{0,120}sabaqDhor:\s*\{ from:null, to:null \}[\s\S]{0,120}dhor:\s*\{ juz:null, unit:'quarter', position:1 \}/.test(js));

// Execute the actual shipped sort helpers without evaluating the UI file.
const sortStart = js.indexOf('function maktabSummaryNameKey');
const sortEnd = js.indexOf('function maktabSummaryWireDate', sortStart);
const sortSource = js.slice(sortStart, sortEnd);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(sortSource, ctx);
const students = [
  {id:'N1', name:'Aaron Plain', group_name:'Group Z'},
  {id:'H2', name:'Clara Haidh', group_name:'Group A'},
  {id:'L3', name:'Zara Logged', group_name:'Group B'},
  {id:'L1', name:'Bella Logged', group_name:'Group A'},
  {id:'H1', name:'Bea Haidh', group_name:'Group Z'},
  {id:'L2', name:'Adam Logged', group_name:'Group A'},
  {id:'P1', name:'Dina Predicted', group_name:'Group A'},
  {id:'N2', name:'Dave Plain', group_name:'Group A'},
  {id:'LU', name:'Uma Ungrouped', group_name:''},
];
const byStudent = { sabaq:{L3:[{}], L1:[{}], L2:[{}], LU:[{}]}, sabaqDhor:{}, dhor:{} };
const haidh = { H1:'haidh', H2:'haidh', L2:'haidh', P1:'predicted-haidh' };
const ordered = ctx.maktabSummarySortedStudents(students, byStudent, haidh).map(s => s.name);
check('Summary order is logs by Group then first name, confirmed Haidh alphabetically, then remainder alphabetically',
  JSON.stringify(ordered) === JSON.stringify([
    'Adam Logged','Bella Logged','Zara Logged','Uma Ungrouped',
    'Bea Haidh','Clara Haidh',
    'Aaron Plain','Dave Plain','Dina Predicted'
  ]), ordered.join(' | '));
check('a log outranks confirmed Haidh and predicted Haidh is not promoted to the confirmed band',
  ordered.indexOf('Adam Logged') < ordered.indexOf('Bea Haidh')
  && ordered.indexOf('Dina Predicted') > ordered.indexOf('Clara Haidh'));
check('render uses the sorted roster and only groups the logged band',
  /const sortedStudents = maktabSummarySortedStudents/.test(js)
  && /band === 0 && prevBand === 0 && groupKey !== prevGroup/.test(js)
  && /wireMaktabSummarySearch\(sortedStudents, date\)/.test(js));

check('page/cache release key is 4.2.14.1',
  [...html.matchAll(/\?v=([0-9.]+)/g)].every(m => m[1] === '4.2.14.1')
  && /CACHE_NAME = 'hifzhelper-v4\.2\.14\.1'/.test(sw));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
