import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import { handleGetMaktabPosition, handleSaveMaktabPosition, handleSaveMaktabDhor } from '../worker/src/maktabLog.js';
import { computeDefaultDhorEntry } from '../worker/src/dhorSchedule.js';
import { fileURLToPath } from 'url';
// repo-relative: tests/ lives inside the repo, so the root is one up.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

let pass = 0, fail = 0;
function check(label, cond) { if (cond) pass++; else { fail++; console.log('FAIL:', label); } }
const read = (p) => fs.readFileSync(ROOT + p, 'utf8');
const runMig = (db, file) => {
  for (const st of read('worker/migrations/' + file).split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
    .split(';').map(x => x.trim()).filter(Boolean)) db.exec(st);
};

const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE students (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
  pin_hash TEXT, created_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
  mushaf TEXT, baseline_selection TEXT, track_haidh INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE attendance (student_id TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL, PRIMARY KEY (student_id, date));
  CREATE TABLE plans (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, entered_by TEXT NOT NULL,
    plan_type TEXT NOT NULL, target_date TEXT NOT NULL, segment_from INTEGER, segment_to INTEGER, ref TEXT,
    status TEXT NOT NULL DEFAULT 'planned', created_at TEXT NOT NULL);
  CREATE TABLE dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, date TEXT NOT NULL,
    entered_by TEXT NOT NULL, segment_from INTEGER, segment_to INTEGER, ref TEXT, created_at TEXT NOT NULL);
  INSERT INTO students (id,name,role,created_date,mushaf,baseline_selection) VALUES
    ('STU1','Umme','student','2026-01-01','15line_madani','[1,2,3,4,5,6,7,8]'),
    ('TCH1','Ustadh','teacher','2026-01-01',NULL,NULL);`);
runMig(db, '0019_maktab_tables.sql');
runMig(db, '0020_maktab_settings.sql');
runMig(db, '0021_maktab_position.sql');

const DB = { prepare(sql) { return {
  bind(...args) { return {
    async run(){ const i = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(i.lastInsertRowid) } }; },
    async first(){ return db.prepare(sql).get(...args) ?? null; },
    async all(){ return { results: db.prepare(sql).all(...args) }; },
  }; },
  async first(){ return db.prepare(sql).get() ?? null; },
  async all(){ return { results: db.prepare(sql).all() }; },
}; } };
const env = { DB };
const TCH = { id: 'TCH1', role: 'teacher' };
const STU = { id: 'STU1', role: 'student' };
const post = (b) => ({ json: async () => b, url: 'https://x/' });
const get = (qs) => ({ url: 'https://x/?' + (qs || '') });

// ---- migration shape ----
{
  const cols = db.prepare("PRAGMA table_info(maktab_position)").all().map(c => c.name).sort();
  const pjCols = ['student_id', 'position_json', 'last_dhor_json', 'updated_at'].sort();
  check('0021 mirrors the PJ position table exactly', JSON.stringify(cols) === JSON.stringify(pjCols));
}

// ---- endpoints + gating ----
{
  const s = await handleSaveMaktabPosition(post({ student_id: 'STU1', position_json: '{"baselineSelection":[1,2,3,4]}' }), env, STU);
  check('save: student → 403 (the maktab owns this, not her)', s.status === 403);
  const noId = await handleSaveMaktabPosition(post({ position_json: '{}' }), env, TCH);
  check('save: student_id REQUIRED — never defaults to the teacher', noId.status === 400);
  const bad = await handleSaveMaktabPosition(post({ student_id: 'STU1', position_json: 'not json' }), env, TCH);
  check('save: invalid JSON rejected', bad.status === 400);

  const ok = await handleSaveMaktabPosition(post({ student_id: 'STU1', position_json: '{"baselineSelection":[1,2,3,4],"previousJuz":1}' }), env, TCH);
  check('save: teacher allowed', !!ok.data.saved);
  check('save: wrote the STUDENT\'s row, not the teacher\'s',
    !!db.prepare("SELECT 1 FROM maktab_position WHERE student_id='STU1'").get()
    && !db.prepare("SELECT 1 FROM maktab_position WHERE student_id='TCH1'").get());

  const r = (await handleGetMaktabPosition(get('student_id=STU1'), env, TCH)).data;
  check('read: teacher gets the blob', JSON.parse(r.position_json).previousJuz === 1);
  const own = (await handleGetMaktabPosition(get('student_id=STU1'), env, STU)).data;
  check('read: a student may read her OWN maktab position', !!own.position_json);
  const foreign = await handleGetMaktabPosition(get('student_id=TCH1'), env, STU);
  check('read: a student may not read someone else\'s', foreign.status === 403);

  const missing = (await handleGetMaktabPosition(get('student_id=TCH1'), env, TCH)).data;
  check('read: no row yet → nulls, not an error', missing.position_json === null);
}

// ---- THE server-side fourth-input fix ----
{
  // PJ: pool [1..8] in 15line_madani on her own row. Maktab: pool [1..4]
  // via maktab_position, mushaf 13line via settings. Same student.
  db.exec("UPDATE maktab_settings SET mushaf='13line' WHERE id=1");
  db.exec(`INSERT INTO maktab_dhor_log (student_id, date, entered_by, teacher_id, teacher_name, segment_from, segment_to, ref, created_at)
           VALUES ('STU1','2026-08-10','TCH1','TCH1','Ustadh',1,1,'waterval','now')`);
  db.exec(`INSERT INTO dhor_log (student_id, date, entered_by, segment_from, segment_to, ref, created_at)
           VALUES ('STU1','2026-08-10','STU1',1,1,'uthmani','now')`);

  const pj = await computeDefaultDhorEntry(env, 'STU1');
  check('PJ prepop: still reads her OWN pool and mushaf (unchanged)', pj.source === 'continue_last' && pj.ref === 'uthmani');

  const mk = await computeDefaultDhorEntry(env, 'STU1', { table: 'maktab_dhor_log', includePlans: false });
  check('maktab prepop: uses the MAKTAB mushaf, not hers', mk.ref === 'waterval');
  check('maktab prepop: rotates the MAKTAB pool, not her PJ pool',
    mk.source === 'continue_last' && mk.segment_to <= 4);

  // empty maktab pool → nothing prepopulates, rather than borrowing hers
  db.exec("UPDATE maktab_position SET position_json='{}' WHERE student_id='STU1'");
  const empty = await computeDefaultDhorEntry(env, 'STU1', { table: 'maktab_dhor_log', includePlans: false });
  check('maktab prepop: empty maktab pool → none (never falls back to the PJ pool)', empty.source === 'none');
  const pjStill = await computeDefaultDhorEntry(env, 'STU1');
  check('PJ prepop: unaffected by the maktab pool being empty', pjStill.source === 'continue_last');
}

// ================= FRONTEND: position routing + setup maths =================
{
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(`<!DOCTYPE html><body>
    <div id="maktabSetupName"></div><div id="maktabSetupBody"></div></body>`, { runScripts: 'dangerously', url: 'https://x/' });
  const w = dom.window;
  w.eval(`
    var saved = [], getCalls = [];
    function quarterUnitId(juz, q){ return (juz - 1) * 4 + q; }
    function showScreen(){ return Promise.resolve(); }
    var CONFIRM = true; window.confirm = (m) => { window.lastConfirm = m; return CONFIRM; };
    var POS = { position_json: JSON.stringify({ baselineSelection: [1,2,3,4, 5,6,7,8] }) };
    function apiGetMaktabPosition(id){ getCalls.push(id); return Promise.resolve(POS); }
    function apiSaveMaktabPosition(id, pj){ saved.push({ id, blob: JSON.parse(pj) }); return Promise.resolve({ saved: true }); }
    function apiGetPosition(){ return Promise.resolve({ position_json: JSON.stringify({ previousJuz: 9 }) }); }
    function apiSavePosition(pj){ saved.push({ id: 'PJ', blob: JSON.parse(pj) }); return Promise.resolve({}); }
    function logCtxIsMaktab(){ return MAKTAB; }
    function logCtxStudentId(){ return 'STU1'; }
    var MAKTAB = false;
  `);
  w.eval(read('js/position.js'));
  w.eval(read('js/maktabSetup.js'));

  // position routing
  let p = JSON.parse(await w.eval('loadPosition().then(x => JSON.stringify(x))'));
  check('position PJ mode: reads the PJ row', p.previousJuz === 9);
  w.eval('MAKTAB = true');
  p = JSON.parse(await w.eval('loadPosition().then(x => JSON.stringify(x))'));
  check('position maktab mode: reads the MAKTAB row (was skipped entirely in V3.64.0)',
    Array.isArray(p.baselineSelection) && p.baselineSelection.length === 8);
  w.eval('saved = []');
  await w.eval('savePosition({ previousJuz: 3, sabaqTo: {surah:1,ayah:1}, activeJuz: 4 })');
  const wrote = JSON.parse(w.eval('JSON.stringify(saved[0])'));
  check('position maktab mode: WRITES the student\'s maktab row, not the teacher\'s PJ',
    wrote.id === 'STU1' && wrote.blob.previousJuz === 3);
  check('position: derived fields still stripped before storing',
    !('sabaqTo' in wrote.blob) && !('activeJuz' in wrote.blob));

  // setup maths
  check('setup: a juz is complete only when all FOUR units are pooled',
    JSON.stringify(w.eval('JSON.stringify(maktabCompletedJuzFromPool([1,2,3,4, 5,6,7]))')) === JSON.stringify('[1]'));
  check('setup: quarter units for a juz are (j-1)*4+1..*4',
    w.eval('JSON.stringify(maktabJuzUnits(3))') === '[9,10,11,12]');

  // render + save: replace, not merge
  // NB: `let` at the top of an eval'd script is scoped to that eval, so
  // assigning maktabSetupStudent from a later eval would create a
  // different variable and the function would still see null. (In the
  // real app these load as <script> tags, where it's a normal global.)
  // Going through the module's own entry point is both correct and a
  // better test.
  await w.eval("openMaktabStudentSetup({ id: 'STU1', name: 'Umme' })");
  await w.eval('renderMaktabSetupScreen()');
  const boxes = w.document.querySelectorAll('#maktabSetupGrid input[data-juz]');
  check('setup: 30 ajzaa rendered', boxes.length === 30);
  check('setup: juz 1 and 2 pre-ticked from the pool', boxes[0].checked && boxes[1].checked && !boxes[2].checked);

  w.eval('saved = []');
  boxes[1].checked = false;            // untick juz 2
  boxes[4].checked = true;             // tick juz 5
  await w.eval('saveMaktabStudentSetup([1,2,3,4,5,6,7,8])');
  const blob = JSON.parse(w.eval('JSON.stringify(saved[0].blob)'));
  check('setup: pool REPLACED, not merged — unticked juz 2 is gone',
    JSON.stringify(blob.baselineSelection) === JSON.stringify([1,2,3,4,17,18,19,20]));
  check('setup: the confirm NAMES what is being removed, not a bare "are you sure"',
    /Juz 2\b/.test(w.eval('lastConfirm')));

  w.eval('CONFIRM = false; saved = []');
  await w.eval('saveMaktabStudentSetup([1,2,3,4])');
  check('setup: cancelling the confirm writes nothing', w.eval('saved.length') === 0);
}

// ---- source: the V3.64.0 skips are properly retired ----
{
  const src = read('js/position.js');
  const code = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  check('source: position no longer no-ops in maktab mode', !/logPositionEnabled\(\)/.test(code));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
