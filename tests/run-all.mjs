#!/usr/bin/env node
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runHarness } from './helpers/runner.mjs';

const directory = new URL('./', import.meta.url);
const files = readdirSync(directory).filter(f => /^verify_.*\.(mjs|js)$/.test(f)).sort();
if (!files.length) throw new Error('No test harnesses found');
let passed = 0, failed = 0;
const unsuccessful = [];
for (const file of files) {
  const result = runHarness(fileURLToPath(new URL(file, directory)));
  passed += result.passed;
  failed += result.failed;
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${file}: ${result.passed} passed, ${result.failed} failed`);
  if (!result.ok) {
    unsuccessful.push(file);
    console.log(`  ${result.reasons.join('; ')}`);
    console.log(result.output.trim());
  }
}
console.log(`\n${unsuccessful.length ? 'FAILED' : 'PASSED'}: ${files.length - unsuccessful.length}/${files.length} harnesses successful; ${passed} passed checks, ${failed} reported failed checks; ${unsuccessful.length} unsuccessful harnesses.`);
if (unsuccessful.length) console.log(`Unsuccessful: ${unsuccessful.join(', ')}`);
process.exitCode = unsuccessful.length ? 1 : 0;
