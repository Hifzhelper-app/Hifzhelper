// ============================================================
// verify_syntax.mjs — V3.82.1: every shipped frontend script must PARSE.
//
// Born from a real breakage: V3.80.0's rename left a // comment INLINE
// in app.js's single-line SCREENS_BUILT object, swallowing every entry
// after it — the file failed to parse and the whole app died at load,
// yet 29 harnesses stayed green because they string-slice regions and
// never parse the files whole. This gate closes that class: node --check
// on every js/*.js and shared/*.js (classic scripts; the worker's ESM
// files are already parsed whole by every miniflare harness).
// ============================================================

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
let pass = 0, fail = 0;

const files = [];
for (const dir of ['js', 'shared']) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) continue;
  for (const f of fs.readdirSync(full)) {
    if (f.endsWith('.js')) files.push(path.join(dir, f));
  }
}

for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], { encoding: 'utf8' });
  if (r.status === 0) { pass++; }
  else { fail++; console.log('FAIL: does not parse:', f, '\n' + (r.stderr || '').split('\n').slice(0, 3).join('\n')); }
}

if (files.length < 10) { fail++; console.log('FAIL: suspiciously few files found — the walker is broken, not the code'); }

console.log(`${pass} passed, ${fail} failed (${files.length} scripts parsed)`);
process.exit(fail ? 1 : 0);
