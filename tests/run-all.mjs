#!/usr/bin/env node
// Runs every harness in this folder and reports one total.
//   node tests/run-all.mjs
// Exit code is non-zero if any harness fails, so it can gate a delivery.

import { readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const files = readdirSync(HERE)
  .filter(f => /^verify_.*\.(mjs|js)$/.test(f))
  .sort();

let totalPass = 0, totalFail = 0, broken = [];
for (const f of files) {
  let out = '';
  try {
    out = execFileSync('node', [path.join(HERE, f)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '');
  }
  const m = out.match(/(\d+) passed, (\d+) failed/);
  if (!m) {
    broken.push(f);
    console.log(`${f.padEnd(30)} DID NOT REPORT — see below`);
    console.log(out.split('\n').filter(l => l && !/Warning|trace-warnings|ExperimentalWarning/.test(l)).slice(0, 6).map(l => '    ' + l).join('\n'));
    continue;
  }
  const [, p, fl] = m;
  totalPass += Number(p); totalFail += Number(fl);
  console.log(`${f.padEnd(30)} ${p} passed, ${fl} failed`);
  if (Number(fl)) {
    console.log(out.split('\n').filter(l => l.startsWith('FAIL:')).map(l => '    ' + l).join('\n'));
  }
}

console.log(`\nTOTAL: ${totalPass} passed, ${totalFail} failed across ${files.length} harnesses`);
if (broken.length) console.log(`BROKEN (no result line): ${broken.join(', ')}`);
process.exit(totalFail || broken.length ? 1 : 0);
