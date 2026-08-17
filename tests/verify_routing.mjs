import { fileURLToPath } from 'url';
// ============================================================
// verify_routing.mjs — the "whose data?" guard.
//
// WHY THIS EXISTS
// One bug class has recurred five times in this project: code running
// in maktab mode calling an endpoint that resolves the target student
// from the AUTH TOKEN, and so reading or writing the TEACHER's own
// journal while they log a student. Every instance was found by hand,
// after shipping. Two eyeball passes over the same code missed three
// sites between them (the History rails' delete path, both Dhor pool
// writes, the juz tracker).
//
// So this does it mechanically instead:
//   1. classify every api client in js/api.js by whether the CALL names
//      a student (?student_id=) or lets the token decide;
//   2. find every call site of the token-deciding ones;
//   3. fail if any sits in a module that can execute while a maktab
//      context is active, unless it is an EXPLICITLY justified
//      exception below.
//
// THE ONE ASSUMPTION IT CANNOT CHECK: MAKTAB_REACHABLE. That list says
// which modules run in maktab mode, and it is maintained by hand. If a
// maktab screen ever starts calling a module not on the list, this scan
// goes quiet about it. Keep the list honest.
// ============================================================

import fs from 'fs';
import path from 'path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
function check(label, cond) { if (cond) pass++; else { fail++; console.log('FAIL:', label); } }

// Modules that can execute while logCtxIsMaktab() is true.
const MAKTAB_REACHABLE = new Set([
  'sabaqPage.js', 'sabaqDhorPage.js', 'dhorPage.js', 'position.js',
  'commentPrivacy.js', 'logDetailScreen.js', 'juzTrackerScreen.js',
  'maktabDay.js', 'maktabSummary.js', 'maktabJournal.js',
  'maktabSetup.js', 'maktabSettings.js', 'app.js', 'session-timer.js',
]);

// Endpoints whose "whose?" question is not about a student at all.
// Endpoints whose "whose?" question is not about one student at all:
// auth/admin, and the maktab reads that are keyed by DATE and return
// every student (summary, derived attendance, settings).
const NOT_STUDENT_SCOPED = [
  /^\/auth/, /^\/admin/,
  /^\/maktab\/settings/, /^\/maktab\/summary/, /^\/maktab\/attendance/,
];

// Call sites that ARE own-only clients but are correct as they stand.
// Each needs a reason; an unexplained entry here is how the guard rots.
const JUSTIFIED = {
  'app.js:apiGetProfile': 'bootApp identity check — runs at login, always PJ mode, never inside a maktab context',
  'position.js:apiGetPosition': 'inside the logCtxIsMaktab() ternary — the PJ branch of a routed call',
  'position.js:apiSavePosition': 'inside the logCtxIsMaktab() ternary — the PJ branch of a routed call',
  'dhorPage.js:apiGetUpcomingDhorQueue': 'wrapped in the logPlansEnabled() guard — the maktab has no plans concept',
};

// ---------- 1. classify the clients ----------
const api = read('js/api.js');
const clients = {};
// Chunk on function boundaries rather than brace-matching. The first
// draft required a closing brace on its own line, which silently missed
// every ONE-LINE client — including apiSaveProfile, one of the exact
// sites this scan exists to catch. A guard that reports clean while
// missing the target is worse than no guard.
const chunks = api.split(/\n(?=function api[A-Za-z]+\s*\()/);
for (const chunk of chunks) {
  const head = chunk.match(/^function (api[A-Za-z]+)\s*\(/);
  if (!head) continue;
  const paths = [...chunk.matchAll(/apiFetch\(\s*'([^']+)'/g)].map(x => x[1]);
  if (!paths.length) continue;
  clients[head[1]] = { path: paths[0], namesStudent: /student_id/.test(chunk) };
}
for (const m of api.matchAll(/const (api[A-Za-z]+) = makeLogClient\('([^']+)'\)/g)) {
  clients[m[1]] = { path: m[2], namesStudent: false };
}

const ownOnly = Object.entries(clients)
  .filter(([, v]) => !v.namesStudent && !NOT_STUDENT_SCOPED.some(re => re.test(v.path)))
  .map(([k]) => k);

check('scan found the api clients at all', Object.keys(clients).length >= 20);
check('scan identified own-only clients', ownOnly.length >= 10);

// ---------- 2. find every call site ----------
const violations = [];
for (const file of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'))) {
  if (file === 'api.js' || file === 'logContext.js') continue;      // the definitions themselves
  if (!MAKTAB_REACHABLE.has(file)) continue;                        // PJ-only module
  const lines = read('js/' + file).split('\n');
  lines.forEach((line, i) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    for (const fn of ownOnly) {
      if (!new RegExp(`\\b${fn}\\s*[.(,)]`).test(line)) continue;
      if (JUSTIFIED[`${file}:${fn}`]) return;
      violations.push({ file, line: i + 1, fn, text: line.trim().slice(0, 80) });
    }
  });
}

// ---------- 3. report ----------
if (violations.length) {
  console.log(`\n${violations.length} own-only call sites reachable in maktab mode:\n`);
  const byFn = {};
  for (const v of violations) (byFn[v.fn] = byFn[v.fn] || []).push(v);
  for (const [fn, vs] of Object.entries(byFn)) {
    console.log(`  ${fn} (${vs.length})`);
    for (const v of vs) console.log(`      ${v.file}:${v.line}  ${v.text}`);
  }
  console.log('');
}

// The guard proper. Until delivery (i) lands this is EXPECTED to fail —
// it is measuring the debt, not asserting it is gone. After (i) the
// expected count drops to 0 and any regression fails the suite.
const EXPECTED_UNROUTED = Number(process.env.EXPECTED_UNROUTED ?? 16);
check(`unrouted call sites: ${violations.length} (expected ${EXPECTED_UNROUTED})`,
  violations.length === EXPECTED_UNROUTED);

// Sanity: the justified list must not rot into a dumping ground.
check('every justified exception carries a reason',
  Object.values(JUSTIFIED).every(r => typeof r === 'string' && r.length > 25));
check('justified exceptions still exist in the code they excuse',
  Object.keys(JUSTIFIED).every(k => {
    const [file, fn] = k.split(':');
    return fs.existsSync(path.join(ROOT, 'js', file)) && read('js/' + file).includes(fn);
  }));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
