import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runHarness } from './helpers/runner.mjs';
const dir = mkdtempSync(join(tmpdir(), 'hifz-runner-'));
let passed = 0;
try {
  for (const [name, source, ok] of [
    ['success', "console.log('2 passed, 0 failed')", true],
    ['reported failure', "console.log('2 passed, 1 failed')", false],
    ['crash after summary', "console.log('2 passed, 0 failed'); throw Error('late crash')", false],
    ['nonzero exit', "console.log('2 passed, 0 failed'); process.exit(1)", false],
    ['no summary', "console.log('24/25 checks passed')", false],
    ['empty summary', "console.log('0 passed, 0 failed')", false],
    ['duplicate summary', "console.log('2 passed, 0 failed\\n2 passed, 0 failed')", false],
    ['contradictory output', "console.log('FAIL: broken\\n2 passed, 0 failed')", false],
    ['timeout', 'setInterval(() => {}, 1000)', false],
  ]) {
    const file = join(dir, name + '.cjs');
    writeFileSync(file, source);
    assert.equal(runHarness(file, { timeout: name === 'timeout' ? 100 : 5000 }).ok, ok, name);
    passed++;
  }
  console.log(`${passed} passed, 0 failed`);
} finally { rmSync(dir, { recursive: true, force: true }); }
