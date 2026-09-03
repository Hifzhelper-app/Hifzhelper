#!/usr/bin/env node
// V4.2.11.1 — Student Management polish + Haidh calendar alignment/state reset.
// Dependency-free structural pins.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const html = read('index.html');
const css = read('css/admin.css');
const admin = read('js/adminPage.js');
const detailCss = read('css/detail-pages.css');
const haidh = read('js/haidhDetailScreen.js');
const register = read('js/maktabAttendancePage.js');
const sw = read('js/sw.js');

check('Register button is forest green globally without changing the success token',
  /button\.secondary\.admin-register-btn[\s\S]*background: var\(--palette-evergreen\)[\s\S]*border-color: var\(--palette-evergreen\)/.test(css));
check('mobile Register button explicitly remains forest green',
  /\.admin-mobile-register-actions \.admin-register-btn[\s\S]*background: var\(--palette-evergreen\)[\s\S]*border-color: var\(--palette-evergreen\)/.test(css));
check('blank group options display None',
  /<option value="">None<\/option>/.test(admin) && /\{ id: '', name: 'None' \}/.test(admin));
check('No group wording is gone from Student Management source', !/No group/i.test(admin));
check('blank group still uses an empty value rather than a data-model change',
  /<option value="">None<\/option>/.test(admin) && /\{ id: '', name: 'None' \}/.test(admin));

check('Attendance Haidh calendar uses the full card width, including the selection-count pill',
  /#attHaidhBlock > \.screen-content[\s\S]*width: 100%[\s\S]*padding: 0/.test(detailCss)
  && /#attHaidhBlock \.haidh-cal-nav,[\s\S]*#attHaidhBlock \.haidh-range-bar[\s\S]*width: 100%/.test(detailCss));
check('Haidh calendar week starts Monday and month offset is Monday-based',
  /\['M','T','W','T','F','S','S'\]/.test(haidh)
  && /\(firstOfMonth\.getDay\(\) \+ 6\) % 7/.test(haidh));
check('Attendance clears and hides the previous student Haidh calendar before async loading',
  /async function renderAttendancePage\(param\)\{[\s\S]*resetHaidhCalendarVisualState\(\);[\s\S]*await Promise\.all/.test(haidh)
  && /function resetHaidhCalendarVisualState\(\)[\s\S]*classList\.add\('hidden'\)[\s\S]*grid\.innerHTML = ''/.test(haidh));
check('fresh student visit defers Haidh reveal until that student marks are loaded',
  /loadAttendancePeriod\(\{ deferHaidhReveal: true \}\)/.test(haidh)
  && /loadHaidhCalAttendance\(renderGeneration\)/.test(haidh)
  && /renderGeneration !== haidhCalRenderGeneration/.test(haidh)
  && /attHaidhBlock'\)\.classList\.remove\('hidden'\)/.test(haidh));

check('current term Attendance register focuses the current Maktab week rather than the oldest week',
  /function mkregFocusCurrentWeek\(host, data\)/.test(register)
  && /const monday = mkregMondayOf\(data\.today\)/.test(register)
  && /w\.monday === monday/.test(register)
  && /scroll\.scrollLeft = Math\.max\(0, target\.offsetLeft - stickyWidth - 3\)/.test(register));

check('page/cache keys have advanced together beyond the V4.2.11.1 patch',
  /js\/app\.js\?v=4\.2\.13\.1/.test(html) && /CACHE_NAME = 'hifzhelper-v4\.2\.13\.1'/.test(sw));
check('served files actually edited by this patch carry 4.2.11.1 headers',
  /^\/\* Hifzhelper build 4\.2\.11\.1 \| css\/admin\.css \*\//.test(css)
  && /^\/\* Hifzhelper build 4\.2\.13\.1 \| css\/detail-pages\.css \*\//.test(detailCss)
  && /^\/\* Hifzhelper build 4\.2\.11\.1 \| js\/adminPage\.js \*\//.test(admin)
  && /^\/\* Hifzhelper build 4\.2\.13 \| js\/haidhDetailScreen\.js \*\//.test(haidh)
  && /^\/\* Hifzhelper build 4\.2\.13\.1 \| js\/maktabAttendancePage\.js \*\//.test(register)
  && /^\/\* Hifzhelper build 4\.2\.13\.1 \| js\/sw\.js \*\//.test(sw));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
