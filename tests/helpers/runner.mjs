import { spawnSync } from 'node:child_process';

export function runHarness(file, { timeout = 30000 } = {}) {
  const result = spawnSync(process.execPath, [file], { encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024 });
  const output = (result.stdout || '') + (result.stderr || '');
  const summaries = [...output.matchAll(/^(\d+) passed, (\d+) failed\s*$/gm)];
  const summary = summaries.at(-1);
  const passed = summary ? Number(summary[1]) : 0;
  const failed = summary ? Number(summary[2]) : 0;
  const reasons = [];
  if (result.error) reasons.push(result.error.message);
  if (result.signal) reasons.push(`terminated by ${result.signal}`);
  if (result.status !== 0) reasons.push(`exit status ${result.status}`);
  if (summaries.length !== 1) reasons.push(`expected one result summary, received ${summaries.length}`);
  if (summary && passed + failed === 0) reasons.push('no checks reported');
  if (failed) reasons.push(`${failed} failed checks`);
  // Never accept a stale success line if subsequent code fails.
  if (/^FAIL(?:\b|:)/m.test(output) && !failed) reasons.push('failure output contradicts summary');
  return { passed, failed, ok: reasons.length === 0, reasons, output };
}
