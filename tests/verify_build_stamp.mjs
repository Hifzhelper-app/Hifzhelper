// ============================================================
// V4.2.5 — THE VERSION SAFETY NET (user's request, 2026-09-02).
//
// The user asked for versioning that guarantees a refreshed file, after a
// mobile screen showed old styling. Three separate things must agree, and
// nothing checked that they did:
//   1. every asset linked from index.html carries a ?v= tag
//   2. every one of those tags is the SAME version
//   3. that version matches CACHE_NAME in js/sw.js
//   4. every css/js file carries a build header naming that same version
//
// Why this matters more than it looks: Claude's release step rewrote only
// the PREVIOUS version string (sed s/?v=OLD/?v=NEW/g), so a tag that ever
// drifted would be skipped SILENTLY and that file would never refresh
// again. This turns that silent drift into a failed test before release.
// The header also answers "which build is actually deployed?" by opening
// the file, rather than by inference from behaviour.
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (label, cond, extra = '') => { if (cond) pass++; else { fail++; console.log('FAIL:', label, extra); } };

const html = read('index.html');
const sw = read('js/sw.js');

// ---- 1: every linked asset is versioned ----
const assets = [...html.matchAll(/(?:href|src)="((?:css|js|shared)\/[^"]+?)"/g)].map(m => m[1]);
const unversioned = assets.filter(a => !/\?v=/.test(a));
check('every css/js asset in index.html carries a ?v= tag', unversioned.length === 0, unversioned.join(', '));

// ---- 2: all the same version ----
const tags = [...new Set([...html.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]))];
check('every ?v= tag names the SAME version (a drifted tag would never refresh again)',
  tags.length === 1, tags.join(' / '));
const VERSION = tags[0];

// ---- 3: the service worker agrees ----
const cacheName = (sw.match(/const CACHE_NAME = 'hifzhelper-v([0-9.]+)'/) || [])[1];
check('CACHE_NAME in js/sw.js matches the asset version', cacheName === VERSION, `sw=${cacheName} html=${VERSION}`);

// ---- 4: every file carries a build header naming it ----
const files = [];
for (const dir of ['css', 'js', 'shared']) {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (/\.(css|js)$/.test(f)) files.push(`${dir}/${f}`);
  }
}
const missing = [], wrong = [];
for (const f of files) {
  const first = read(f).split('\n')[0];
  const m = first.match(/^\/\* Hifzhelper build ([0-9.]+) \| (.+) \*\/$/);
  if (!m) { missing.push(f); continue; }
  if (m[1] !== VERSION) wrong.push(`${f}=${m[1]}`);
  else if (m[2] !== f) wrong.push(`${f} names ${m[2]}`);
}
check('every css/js file starts with a build header', missing.length === 0, missing.join(', '));
check('every build header names the current version and its own path', wrong.length === 0, wrong.join(', '));

// ---- 5: the service worker's precache list is not stale ----
// It listed ?v=3.67.0 for months — URLs nothing requests, so the precache
// cached files nobody asked for and offline support was quietly broken.
const swTags = [...new Set([...sw.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]))];
check('the service worker precache list carries the CURRENT version, not a stale one',
  swTags.length === 0 || (swTags.length === 1 && swTags[0] === VERSION), swTags.join(' / '));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
