#!/usr/bin/env node
// V4.2.9.2 — mobile-only Student Management registration card.
// Static/structural so it runs without jsdom.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond) => { if(cond) pass++; else { fail++; console.log('FAIL:', label); } };

const js = read('js/adminPage.js');
const css = read('css/admin.css');
const html = read('index.html');
const sw = read('js/sw.js');

check('mobile registration is a purpose-built card, not the desktop table row',
  /adminIsMobile\(\)[\s\S]*admin-mobile-register-card/.test(js)
  && /if\(!adminIsMobile\(\)\)\{[\s\S]*admin-row-new/.test(js));
check('mobile card heading says Register a student',
  /class="admin-mobile-register-heading"[\s\S]*<strong>Register a student<\/strong>/.test(js));
check('mobile card contains Name and WhatsApp number inputs',
  /id="admin_new_name" placeholder="Name"/.test(js)
  && /id="admin_new_whatsapp" placeholder="WhatsApp number"/.test(js));
check('mobile card contains Role, Group and Status controls',
  /class="admin-mobile-register-options"[\s\S]*id="admin_new_role"[\s\S]*id="admin_new_group"[\s\S]*id="admin_new_active" checked/.test(js));
check('mobile Register button is a dedicated final action',
  /class="admin-mobile-register-actions"[\s\S]*id="adminRegisterBtn">Register<\/button>/.test(js)
  && /\.admin-mobile-register-actions \.admin-register-btn \{[\s\S]*background: var\(--color-success\);/.test(css));
check('mobile card CSS is contained inside the phone breakpoint',
  /@media \(max-width: 767px\)[\s\S]*\.admin-mobile-register-card \{[\s\S]*background: var\(--color-surface\);/.test(css));
check('desktop registration row is retained',
  /if\(!adminIsMobile\(\)\)\{[\s\S]*tr\.className = 'admin-row admin-row-fields admin-row-new'/.test(js));
check('newly registered account is pinned and mobile search is cleared',
  /adminJustCreatedId = result\.id;[\s\S]*if\(adminIsMobile\(\)\)[\s\S]*search\.value = ''/.test(js)
  && /if\(adminJustCreatedId\)[\s\S]*filtered = \[filtered\[idx\]\]/.test(js));
check('mobile status choice is applied after registration while desktop defaults active',
  /const active = activeEl \? activeEl\.checked : true/.test(js)
  && /if\(!active\) fields\.active = false/.test(js));
const pageVersion = (html.match(/js\/app\.js\?v=([0-9.]+)/) || [])[1] || '';
const cacheVersion = (sw.match(/CACHE_NAME = 'hifzhelper-v([0-9.]+)'/) || [])[1] || '';
const atLeast = (v, floor) => {
  const a = String(v).split('.').map(Number), b = String(floor).split('.').map(Number);
  for(let i = 0; i < Math.max(a.length, b.length); i++){
    const d = (a[i] || 0) - (b[i] || 0);
    if(d) return d > 0;
  }
  return true;
};
check('page/cache release key is not older than V4.2.9.2',
  pageVersion === cacheVersion && atLeast(pageVersion, '4.2.9.2'));
check('V4.2.9.2 edited source files retain their last-edit headers after later releases',
  /^\/\* Hifzhelper build 4\.2\.9\.2 \| css\/admin\.css \*\//.test(css)
  && /^\/\* Hifzhelper build 4\.2\.9\.2 \| js\/adminPage\.js \*\//.test(js));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
