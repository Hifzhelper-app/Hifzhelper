#!/usr/bin/env node
// V4.2.9 — Student Management mobile refinement + global page rename.
// Static/structural only so it runs without jsdom.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond, extra = '') => { if(cond) pass++; else { fail++; console.log('FAIL:', label, extra); } };

const html = read('index.html');
const auth = read('js/auth.js');
const css = read('css/admin.css');

check('global rename: page heading is Student Management',
  /id="screen-admin"[\s\S]{0,900}<h2>Student Management<\/h2>/.test(html) && !/<h2>Admin<\/h2>/.test(html));
check('global rename: menu/home tile nav label is Student Management',
  /const ADMIN_NAV_ITEM = \{ id: 'admin', label: 'Student Management', icon: 'admin' \};/.test(auth));
check('heading: desktop keeps its established header while mobile copies Attendance styling',
  /id="screen-admin"[\s\S]{0,900}<div class="card-header-row admin-header-row">/.test(html)
  && /@media \(max-width: 767px\)[\s\S]*#screen-admin \.admin-header-row \{[\s\S]*display: flex;[\s\S]*background: var\(--color-surface\);[\s\S]*border-radius: var\(--radius-md\);/.test(css));
check('search placeholder is the concise word Search',
  /id="admin_search" placeholder="Search"/.test(html) && !/Search by ID or name/.test(html));
check('mobile: legacy table header is not rendered',
  /@media \(max-width: 767px\)[\s\S]*\.admin-table-head \{ display: none; \}/.test(css));
check('mobile: old white table underlay is visually removed',
  /@media \(max-width: 767px\)[\s\S]*\.admin-wrap \{[\s\S]*background: transparent;[\s\S]*border: 0;[\s\S]*max-height: none;[\s\S]*overflow: visible;/.test(css));
check('mobile row 1: name spans the card and has no caption',
  /'name name name name name name'/.test(css)
  && /td\[data-label="Name"\]::before \{ display: none; \}/.test(css)
  && /td\[data-label="Name"\] \.admin-inline \{[\s\S]*font-size: 17px;[\s\S]*font-weight: 700;/.test(css));
check('mobile row 2: Unique ID and WhatsApp share one row',
  /'id id id wa wa wa'/.test(css)
  && /\.admin-row-fields \.admin-cell-id \{ grid-area: id;/.test(css)
  && /td\[data-label="WhatsApp"\] \{ grid-area: wa; \}/.test(css));
check('mobile row 3: Role, Group and Status share one row',
  /'role role group group status status'/.test(css));
check('mobile row 4: Reset PIN is green and actions order reset/delete/copy/share',
  /\[data-reset-pin\] \{[\s\S]*order: 1;[\s\S]*background: var\(--color-success\);/.test(css)
  && /\[data-delete\] \{ order: 2; \}/.test(css)
  && /\[data-copy-url\] \{ order: 3; \}/.test(css)
  && /\[data-share-url\] \{ order: 4; \}/.test(css));
check('desktop table remains: table header markup and 80% desktop width rule still exist',
  /class="admin-table admin-table-head"/.test(read('js/adminPage.js'))
  && /@media \(min-width: 768px\)[\s\S]*\.admin-toolbar, \.admin-table-head, \.admin-wrap, \.admin-status-line \{ width: 80%;/.test(css));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
