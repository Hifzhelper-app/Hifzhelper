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
check('page release key is V4.2.9.1',
  /js\/app\.js\?v=4\.2\.9\.1/.test(html));
check('service-worker cache key is V4.2.9.1',
  /CACHE_NAME = 'hifzhelper-v4\.2\.9\.1'/.test(sw));
check('only corrected CSS and service worker carry the 4.2.9.1 served-file headers in this patch',
  /^\/\* Hifzhelper build 4\.2\.9\.1 \| css\/admin\.css \*\//.test(css)
  && /^\/\* Hifzhelper build 4\.2\.9\.1 \| js\/sw\.js \*\//.test(sw));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
