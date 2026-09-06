/* Hifzhelper tooling regression: one-time Production -> Development D1 seed */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const script = fs.readFileSync(path.join(root, 'worker/tools/seed-dev-from-prod-once.sh'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'worker/tools/SEED-DEV-README.md'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'worker/package.json'), 'utf8'));
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');

const checks = [];
function check(name, ok) { checks.push({ name, ok: Boolean(ok) }); }

check('uses production DB binding', script.includes('PROD_DB="hifzhelper-maktab1"'));
check('uses development DB binding', script.includes('DEV_DB="hifzhelper-maktab1-dev"'));
check('production and development DB names are guarded from equality', script.includes('Production and Development database names are identical'));

for (const table of ['attendance','maktab_sabaq_log','maktab_sabaq_dhor_log','maktab_dhor_log','maktab_position']) {
  check(`copies ${table}`, script.includes(`"${table}"`));
}

check('does not include students in copied TABLES', !/TABLES=\([\s\S]*?"students"[\s\S]*?\)/m.test(script));
check('requires local project Wrangler', script.includes('worker/node_modules') || script.includes('node_modules/.bin/wrangler'));
check('requires exact destructive confirmation', script.includes('SEED DEVELOPMENT'));
check('creates development backup before clear', script.indexOf('Backing up current Development') < script.indexOf('Replacing Development operational history'));
check('has automatic rollback', script.includes('Attempting automatic rollback') && script.includes('restore_development'));
check('checks referenced users before seed', script.includes('User preflight passed') && script.includes('Referenced Production user IDs missing from Development'));
check('checks user name and role too', script.includes('name/role differs'));
check('verifies post-seed row counts', script.includes('Post-seed row-count verification passed'));
check('verifies foreign keys', script.includes('Foreign-key verification passed'));
check('uses remote D1 explicitly', script.includes('--remote'));
check('uses env-specific Wrangler operations', script.includes('--env "$env_name"'));
check('exports data without schema', script.includes('--no-schema'));
check('README says this is one-time', /one-time/i.test(readme));
check('README says macOS Terminal', readme.includes('macOS Terminal'));
check('README says students are not copied', readme.includes('does not') && readme.includes('students'));
check('npm script is wired', pkg.scripts?.['seed:dev-from-prod-once'] === 'bash tools/seed-dev-from-prod-once.sh');
check('rollback backups are gitignored', gitignore.includes('worker/.seed-backups/'));

let passed = 0;
for (const c of checks) {
  if (c.ok) { console.log(`PASS: ${c.name}`); passed++; }
  else console.error(`FAIL: ${c.name}`);
}
console.log(`\n${passed}/${checks.length} checks passed`);
process.exit(passed === checks.length ? 0 : 1);
