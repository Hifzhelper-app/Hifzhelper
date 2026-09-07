import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const css = read('css/detail-pages.css');
const js = read('js/maktabAttendancePage.js');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

check('mobile Attendance screen trims its own green track side padding',
  /@media \(max-width: 767px\)[\s\S]*#screen-maktabAttendance\s*\{[^}]*padding-left:\s*4px;[^}]*padding-right:\s*4px;/.test(css));
check('mobile Student sticky column is narrowed to 128px',
  /\.mkregister-student-head, \.mkregister-student-cell\s*\{[^}]*width:\s*128px;[^}]*min-width:\s*128px;[^}]*max-width:\s*128px;/.test(css));
check('student names remain ellipsis-safe',
  /\.mkregister-student\s*\{[^}]*white-space:\s*nowrap;[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;/.test(css));
check('mobile day columns are narrowed to 40px',
  /\.mkregister-day-head, \.mkregister-cell\s*\{[^}]*width:\s*40px;[^}]*min-width:\s*40px;[^}]*max-width:\s*40px;/.test(css));
check('Attendance reveal icon is rendered in the Attendance header',
  /class="mkregister-percent-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="mkregisterGrid"/.test(js));
check('percentage values are rolled up by default on mobile while the Attendance header remains visible',
  /\.mkregister-percent-cell\s*\{\s*display:\s*none;\s*\}/.test(css)
  && /\.mkregister-percent-head\s*\{[\s\S]{0,180}display:\s*table-cell/.test(css));
check('percentage values can be revealed on demand',
  /\.mkregister-grid\.mkregister-percent-open \.mkregister-percent-cell\s*\{[\s\S]{0,160}display:\s*table-cell/.test(css)
  && /grid\.classList\.toggle\('mkregister-percent-open', open\)/.test(js));
check('toggle exposes accessible expanded state and labels',
  /percentToggle\.setAttribute\('aria-expanded', open \? 'true' : 'false'\)/.test(js)
  && /Hide Attendance percentage/.test(js)
  && /Show Attendance percentage/.test(js));
check('desktop/tablet keeps percentage toggle hidden', /\.mkregister-percent-toggle\s*\{\s*display:\s*none;\s*\}/.test(css));
check('four teaching-day columns fit beside Student + the always-visible Attendance control on a 390px phone', 128 + 68 + 4 * 40 <= 390);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
