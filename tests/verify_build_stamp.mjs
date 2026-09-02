// ============================================================
// V4.2.5 — THE VERSION SAFETY NET (user's request, 2026-09-02).
//
// The user asked for versioning that guarantees a refreshed file, after a
// mobile screen showed old styling. Four separate things are checked, and
// nothing checked that they did:
//   1. every asset linked from index.html carries a ?v= tag
//   2. every one of those tags is the SAME version
//   3. that version matches CACHE_NAME in js/sw.js
//   4. every css/js file carries a build header naming the LAST release
//      that actually edited that file (it may be older than the page release)
//
// V4.2.8.2 rule correction: the ?v= query is the PAGE/CACHE release key and
// still moves together. A file's own top build header is different: it records
// the last release that edited THAT FILE, so untouched assets keep their older
// header. This prevents a tiny patch from pretending 40+ untouched files changed.
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

// ---- 4: every file carries a LAST-EDIT build header naming itself ----
const files = [];
for (const dir of ['css', 'js', 'shared']) {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (/\.(css|js)$/.test(f)) files.push(`${dir}/${f}`);
  }
}
const versionParts = (v) => String(v).split('.').map(n => Number(n) || 0);
const compareVersion = (a, b) => {
  const aa = versionParts(a), bb = versionParts(b);
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
    const d = (aa[i] || 0) - (bb[i] || 0);
    if (d) return d;
  }
  return 0;
};
const missing = [], wrong = [];
for (const f of files) {
  const first = read(f).split('\n')[0];
  const m = first.match(/^\/\* Hifzhelper build ([0-9.]+) \| (.+) \*\/$/);
  if (!m) { missing.push(f); continue; }
  if (m[2] !== f) wrong.push(`${f} names ${m[2]}`);
  else if (compareVersion(m[1], VERSION) > 0) wrong.push(`${f}=${m[1]} is newer than page ${VERSION}`);
}
check('every css/js file starts with a build header', missing.length === 0, missing.join(', '));
check('every build header names its own path and is not newer than the page release', wrong.length === 0, wrong.join(', '));

// ---- 5: the service worker's precache list is not stale ----
// It listed ?v=3.67.0 for months — URLs nothing requests, so the precache
// cached files nobody asked for and offline support was quietly broken.
const swTags = [...new Set([...sw.matchAll(/\?v=([0-9.]+)/g)].map(m => m[1]))];
check('the service worker precache list carries the CURRENT version, not a stale one',
  swTags.length === 0 || (swTags.length === 1 && swTags[0] === VERSION), swTags.join(' / '));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
