// V4.2.9.1 — Student Management mobile cascade correction.
// The first V4.2.9 shipped the intended card rules, but two stronger/generic
// selectors could still win on phone width. This patch pins the specificity
// needed to keep the header hidden and the field row as a grid.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if (cond) pass++; else { fail++; console.log('FAIL:', label); } };

const css = read('css/admin.css');
const html = read('index.html');
const sw = read('js/sw.js');

check('mobile header hide beats the later generic .admin-table display rule',
  /@media \(max-width: 767px\)[\s\S]*\.admin-table\.admin-table-head \{ display: none; \}/.test(css));
check('mobile field row explicitly beats the generic table-row block rule',
  /\.admin-table tr\.admin-row-fields \{\n    display: grid;/.test(css));
check('the four-row card grid remains present',
  /'name name name name name name'[\s\S]*'id id id wa wa wa'[\s\S]*'role role group group status status'/.test(css));
const pageVersion = (html.match(/js\/app\.js\?v=([0-9.]+)/) || [])[1] || '';
const cacheVersion = (sw.match(/CACHE_NAME = 'hifzhelper-v([0-9.]+)'/) || [])[1] || '';
const parts = v => v.split('.').map(Number);
const atLeast4291 = v => { const a = parts(v), b = [4,2,9,1]; for(let i=0;i<4;i++){ if((a[i]||0)!==(b[i]||0)) return (a[i]||0)>(b[i]||0); } return true; };
check('page release key is V4.2.9.1 or later', atLeast4291(pageVersion));
check('service-worker cache key follows the page release', cacheVersion === pageVersion);
check('the corrected CSS and service worker still carry headers from V4.2.9.1 or later',
  /^\/\* Hifzhelper build 4\.2\.9(?:\.[1-9][0-9]*)? \| css\/admin\.css \*\//.test(css)
  && /^\/\* Hifzhelper build 4\.2\.9(?:\.[1-9][0-9]*)? \| js\/sw\.js \*\//.test(sw));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
