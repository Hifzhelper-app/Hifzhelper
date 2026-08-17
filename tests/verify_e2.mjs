import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import { computeDefaultDhorEntry } from '../worker/src/dhorSchedule.js';
import { handleMaktabDhorDefault, handleSaveMaktabDhor } from '../worker/src/maktabLog.js';
import { fileURLToPath } from 'url';
// repo-relative: tests/ lives inside the repo, so the root is one up.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

let pass = 0, fail = 0;
function check(label, cond) { if (cond) pass++; else { fail++; console.log('FAIL:', label); } }

// ================= WORKER: dhor-default variant =================
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE students (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
  pin_hash TEXT, created_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
  mushaf TEXT, baseline_selection TEXT, dhor_granularity TEXT, dhor_quantity INTEGER, dhor_frequency TEXT, dhor_days_of_week TEXT);
  CREATE TABLE attendance (student_id TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL, PRIMARY KEY (student_id, date));
  CREATE TABLE plans (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, entered_by TEXT NOT NULL,
    plan_type TEXT NOT NULL, target_date TEXT NOT NULL, segment_from INTEGER, segment_to INTEGER, ref TEXT,
    surah INTEGER, ayah_from INTEGER, ayah_to INTEGER, notes TEXT, status TEXT NOT NULL DEFAULT 'planned',
    completed_log_id INTEGER, completed_at TEXT, created_at TEXT NOT NULL);
  CREATE TABLE dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, date TEXT NOT NULL,
    entered_by TEXT NOT NULL, segment_from INTEGER, segment_to INTEGER, ref TEXT, created_at TEXT NOT NULL);
  INSERT INTO students (id,name,role,created_date,mushaf,baseline_selection) VALUES
    ('STU1','Zayd','student','2026-01-01','13line', '[1,2,3,4]'),
    ('TCH1','Ustadh','teacher','2026-01-01',NULL,NULL);`);
// V3.65.0/V3.66.0: the maktab dhor prepop now reads the maktab settings
// (mushaf) and maktab_position (pool) instead of the student's own row,
// so this DB needs those tables too.
for (const f of ['0019_maktab_tables.sql', '0020_maktab_settings.sql', '0021_maktab_position.sql']) {
  const mig = fs.readFileSync(ROOT + 'worker/migrations/' + f, 'utf8');
  const noC = mig.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  for (const st of noC.split(';').map(s => s.trim()).filter(Boolean)) db.exec(st);
}

// D1 allows .first()/.all()/.run() directly on a prepared statement with
// no .bind() when the SQL has no parameters — the worker uses that form
// (readMaktabSettings, the summary roster, the maktab settings read in
// dhorSchedule). The stub must offer it too.
const DB = { prepare(sql) { return {
  bind(...args) { return {
    async run() { const i = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(i.lastInsertRowid) } }; },
    async first() { return db.prepare(sql).get(...args) ?? null; },
    async all() { return { results: db.prepare(sql).all(...args) }; },
  }; },
  async run() { const i = db.prepare(sql).run(); return { meta: { last_row_id: Number(i.lastInsertRowid) } }; },
  async first() { return db.prepare(sql).get() ?? null; },
  async all() { return { results: db.prepare(sql).all() }; },
}; } };
const env = { DB };
const TCH1 = { id: 'TCH1', role: 'teacher' };
const post = (b) => ({ json: async () => b, url: 'https://x/?' });
const get = (qs) => ({ url: `https://x/?${qs}` });
const todayISO = new Date().toISOString().slice(0, 10);

{
  // a PJ plan for today + PJ dhor history — the MAKTAB variant must see NEITHER
  db.prepare(`INSERT INTO plans (student_id, entered_by, plan_type, target_date, segment_from, segment_to, status, created_at)
              VALUES ('STU1','STU1','dhor',?,9,12,'planned','now')`).run(todayISO);
  db.exec(`INSERT INTO dhor_log (student_id, date, entered_by, segment_from, segment_to, ref, created_at)
           VALUES ('STU1','2026-08-10','STU1',5,8,'waterval','now')`);

  const pj = await computeDefaultDhorEntry(env, 'STU1');
  check('PJ caller (no opts): today_plan wins, byte-for-byte old behaviour', pj.source === 'today_plan' && pj.plans.length === 1);

  const mk = (await handleMaktabDhorDefault(get('student_id=STU1'), env, TCH1)).data;
  check('maktab variant: ignores PJ plans entirely', mk.source !== 'today_plan');
  check('maktab variant: with no maktab dhor history, starts from the pool start (not PJ log 5-8)',
    mk.source !== 'none' ? mk.segment_from !== 9 : true);

  // V3.66.0: the pool is now MAKTAB-owned (maktab_position), not the
  // student's baseline_selection — so with no maktab pool there is
  // deliberately no prepop at all.
  check('maktab variant: no maktab pool → none (never borrows her PJ pool)', mk.source === 'none');

  // seed the maktab pool + its own history: the variant must then follow
  // BOTH, and still ignore the PJ's plan and PJ dhor log.
  db.prepare("INSERT INTO maktab_position (student_id, position_json, updated_at) VALUES ('STU1', ?, 'now')")
    .run(JSON.stringify({ baselineSelection: [1, 2, 3, 4, 5, 6, 7, 8] }));
  await handleSaveMaktabDhor(post({ student_id: 'STU1', date: '2026-08-14', segment_from: 1, segment_to: 4, ref: 'waterval' }), env, TCH1);
  const mk2 = (await handleMaktabDhorDefault(get('student_id=STU1'), env, TCH1)).data;
  check('maktab variant: advances from MAKTAB history through the MAKTAB pool',
    mk2.source === 'continue_last' && mk2.segment_from >= 5 && mk2.segment_to <= 8);
  check('maktab variant: still ignores the PJ plan for today', mk2.source !== 'today_plan');
  const s403 = await handleMaktabDhorDefault(get('student_id=STU1'), env, { id: 'STU1', role: 'student' });
  check('maktab variant: student → 403', s403.status === 403);
}

// ================= FRONTEND: haidh maths + toggle =================
// V3.64.0: every day-view RENDERING check that used to live here is gone
// with the hand-built cards it tested. The maktab day view is now the PJ
// day view opened with a context, so its rendering is the PJ's own and is
// covered by verify_context.mjs (context routing, notes block, name row)
// plus the PJ's existing harnesses. What remains here is what is still
// genuinely maktab-only code: the haidh gap maths, the toggle semantics,
// and the mark flow's branches.
const { JSDOM } = await import('jsdom');
const read = (p) => fs.readFileSync(ROOT + p, 'utf8');

function makeDayDom(scenario) {
  const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  w.eval(`
    var HAIDH_GAP_OFFICIAL = 15;
    var confirmCalls = [], confirmAnswer = true;
    window.confirm = (msg) => { confirmCalls.push(msg); return confirmAnswer; };
    window.alert = () => {};
    var attendanceSets = [], cleared = [];
    function maktabTodayISO(){ return '2026-08-16'; }
    function logCtxIsMaktab(){ return false; }
    function iconHtml(){ return ''; }
    var SCENARIO = ${JSON.stringify(scenario)};
    function apiGetAttendanceFor(id){ return Promise.resolve(SCENARIO.attendance || []); }
    function apiSetAttendanceFor(id, date, status){ attendanceSets.push({ id, date, status }); return Promise.resolve({}); }
    function apiClearAttendanceFor(id, date){ cleared.push({ id, date }); return Promise.resolve({}); }
  `);
  w.eval(read('js/maktabDay.js'));
  return w;
}

// ---- pure: haidh gap ----
{
  const w = makeDayDom({});
  const gap = (rows) => w.eval(`maktabHaidhGapDays(${JSON.stringify(rows)}, '2026-08-16')`);
  check('gap: no prior haidh → null', gap([]) === null && gap([{ date: '2026-08-20', status: 'haidh' }]) === null);
  check('gap: counts from the LAST prior haidh day', gap([
    { date: '2026-07-01', status: 'haidh' }, { date: '2026-08-10', status: 'haidh' }, { date: '2026-08-12', status: 'present' },
  ]) === 6);
  check('gap: predicted-haidh counts too', gap([{ date: '2026-08-14', status: 'predicted-haidh' }]) === 2);
}

// ---- V3.63.0: toggle semantics — off clears, on marks the SHOWN date ----
{
  const w = makeDayDom({ attendance: [{ date: '2026-08-01', status: 'haidh' }] });
  w.eval('var cleared = []; function apiClearAttendanceFor(id, date){ cleared.push({ id, date }); return Promise.resolve({ deleted: true }); }');
  await w.eval("maktabToggleHaidh('STU1', '2026-08-01', true)");
  await new Promise(r => setTimeout(r, 0));
  check('toggle OFF: clears that date back to unset (never writes absent)',
    w.eval('cleared[0]').date === '2026-08-01' && w.eval('attendanceSets.length') === 0);
}
{
  const w = makeDayDom({ attendance: [] });
  w.eval('function apiClearAttendanceFor(){ return Promise.resolve({}); }');
  await w.eval("maktabToggleHaidh('STU1', '2026-08-01', false)");
  await new Promise(r => setTimeout(r, 0));
  check('toggle ON: marks the DATE ON SCREEN, not today (V3.61.0 picker regression)',
    w.eval('attendanceSets[0]').date === '2026-08-01' && w.eval('attendanceSets[0]').status === 'haidh');
}

// ---- haidh flow: gap guard, both confirm answers ----
{
  const w = makeDayDom({ attendance: [{ date: '2026-08-10', status: 'haidh' }] });
  await w.eval('maktabMarkHaidhFlow("STU1")');
  await new Promise(r => setTimeout(r, 0));
  check('haidh flow: gap 6 < 15 → confirm() with the EXACT agreed wording',
    w.eval('confirmCalls[0]') === '15 days has not passed since the last haidh day. Ok to mark as Haidh, cancel to mark absent');
  check('haidh flow: OK → haidh written', w.eval('attendanceSets[0]').status === 'haidh');
  w.eval('confirmAnswer = false');
  await w.eval('maktabMarkHaidhFlow("STU1")');
  await new Promise(r => setTimeout(r, 0));
  check('haidh flow: Cancel → absent written', w.eval('attendanceSets[1]').status === 'absent');
}
{
  const w = makeDayDom({ attendance: [{ date: '2026-01-01', status: 'haidh' }] });
  await w.eval('maktabMarkHaidhFlow("STU1")');
  await new Promise(r => setTimeout(r, 0));
  check('haidh flow: gap ≥ 15 → no confirm, straight to haidh',
    w.eval('confirmCalls.length') === 0 && w.eval('attendanceSets[0]').status === 'haidh');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
