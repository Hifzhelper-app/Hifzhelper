// ============================================================
// verify_v3830_merge.mjs — V3.83.0: (k) THE MERGE, one-way maktab → PJ.
//
// The truth principle (user, 2026-08-28), pinned test by test:
//   - her OWN read = the merged journal (PJ + maktab, interleaved);
//   - maktab rows arrive read-only by construction (id nulled →
//     maktab_log_id) with provenance (teacher_name) and source:'maktab';
//   - PERSONAL rows carry source:'personal' — they are the marked ones;
//   - a teacher's named-student read stays the PURE PJ read (the
//     three-inputs channel — no double-counting the maktab's record);
//   - duplicates are SHOWN, never collapsed;
//   - privacy is the same applyPrivacy pass (teachers_only redacted);
//   - PJ dhor prepop's "continue from last" spans both tables; the
//     maktab variant gains NOTHING from PJ.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { JSDOM } from 'jsdom';
import { handleGetSabaq } from '../worker/src/sabaqLog.js';
import { handleGetDhor } from '../worker/src/dhorLog.js';
import { handleGetSabaqDhor } from '../worker/src/sabaqDhorLog.js';
import { computeDefaultDhorEntry } from '../worker/src/dhorSchedule.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let pass = 0, fail = 0;
const check = (l, c, x = '') => { if (c) pass++; else { fail++; console.log('FAIL:', l, x); } };

// ---------- fixture ----------
const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE students (id TEXT PRIMARY KEY, name TEXT, role TEXT, mushaf TEXT, baseline_selection TEXT, created_at TEXT);
  CREATE TABLE sabaq_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT, entered_by TEXT, sabaq_from TEXT, sabaq_to TEXT, tajweed_tag_ids TEXT, line_count INTEGER, page_count INTEGER, student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT, student_comment_private INTEGER DEFAULT 0, teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT, teacher_feedback_visibility TEXT DEFAULT 'all', is_duplicate INTEGER DEFAULT 0, created_at TEXT, maktab_log_id INTEGER, maktab_teacher TEXT);
  CREATE UNIQUE INDEX idx_sabaq_log_mkid ON sabaq_log (maktab_log_id);
  CREATE TABLE maktab_sabaq_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT, entered_by TEXT, teacher_id TEXT, teacher_name TEXT, sabaq_from TEXT, sabaq_to TEXT, tajweed_tag_ids TEXT, line_count INTEGER, page_count INTEGER, student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT, student_comment_private INTEGER DEFAULT 0, teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT, teacher_feedback_visibility TEXT DEFAULT 'teachers_only', is_duplicate INTEGER DEFAULT 0, created_at TEXT);
  CREATE TABLE sabaq_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT, entered_by TEXT, from_surah INTEGER, from_ayah INTEGER, to_surah INTEGER, to_ayah INTEGER, tajweed_tag_ids TEXT, mistakes INTEGER, student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT, student_comment_private INTEGER DEFAULT 0, teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT, teacher_feedback_visibility TEXT DEFAULT 'all', is_duplicate INTEGER DEFAULT 0, created_at TEXT, maktab_log_id INTEGER, maktab_teacher TEXT);
  CREATE UNIQUE INDEX idx_sabaq_dhor_log_mkid ON sabaq_dhor_log (maktab_log_id);
  CREATE TABLE maktab_sabaq_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT, entered_by TEXT, teacher_id TEXT, teacher_name TEXT, from_surah INTEGER, from_ayah INTEGER, to_surah INTEGER, to_ayah INTEGER, tajweed_tag_ids TEXT, mistakes INTEGER, student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT, student_comment_private INTEGER DEFAULT 0, teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT, teacher_feedback_visibility TEXT DEFAULT 'teachers_only', is_duplicate INTEGER DEFAULT 0, created_at TEXT);
  CREATE TABLE dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT, entered_by TEXT, segment_from INTEGER, segment_to INTEGER, ref TEXT, tajweed_tag_ids TEXT, mistakes INTEGER, duration_seconds INTEGER, lap_times TEXT, student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT, student_comment_private INTEGER DEFAULT 0, teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT, teacher_feedback_visibility TEXT DEFAULT 'all', is_duplicate INTEGER DEFAULT 0, created_at TEXT, maktab_log_id INTEGER, maktab_teacher TEXT);
  CREATE UNIQUE INDEX idx_dhor_log_mkid ON dhor_log (maktab_log_id);
  CREATE TABLE maktab_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, date TEXT, entered_by TEXT, teacher_id TEXT, teacher_name TEXT, segment_from INTEGER, segment_to INTEGER, ref TEXT, tajweed_tag_ids TEXT, mistakes INTEGER, duration_seconds INTEGER, lap_times TEXT, student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT, student_comment_private INTEGER DEFAULT 0, teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT, teacher_feedback_visibility TEXT DEFAULT 'teachers_only', is_duplicate INTEGER DEFAULT 0, created_at TEXT);
  CREATE TABLE plans (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT, plan_type TEXT, status TEXT, target_date TEXT, created_at TEXT);
  INSERT INTO students VALUES ('S1','Umme','student','13line','[]','2026-01-01'), ('T1','Teacher','teacher',NULL,NULL,'2026-01-01');

  INSERT INTO sabaq_log (student_id,date,entered_by,sabaq_from,sabaq_to,student_comment,student_comment_private,created_at)
    VALUES ('S1','2026-08-20','S1','2:10','2:20','my own note',1,'2026-08-20T10:00:00Z');
  INSERT INTO sabaq_log (student_id,date,entered_by,sabaq_from,sabaq_to,created_at)
    VALUES ('S1','2026-08-26','S1','2:31','2:40','2026-08-26T10:00:00Z');
  INSERT INTO maktab_sabaq_log (student_id,date,entered_by,teacher_id,teacher_name,sabaq_from,sabaq_to,teacher_feedback,teacher_feedback_by,teacher_feedback_visibility,created_at)
    VALUES ('S1','2026-08-24','T1','T1','Ustadha A','2:21','2:30','needs madd work','T1','teachers_only','2026-08-24T09:00:00Z');
  -- the DUPLICATE day: she logged it AND the maktab did — both must show
  INSERT INTO maktab_sabaq_log (student_id,date,entered_by,teacher_id,teacher_name,sabaq_from,sabaq_to,teacher_feedback_visibility,created_at)
    VALUES ('S1','2026-08-26','T1','T1','Ustadha A','2:31','2:40','teachers_only','2026-08-26T09:30:00Z');

  INSERT INTO dhor_log (student_id,date,entered_by,segment_from,segment_to,ref,lap_times,created_at)
    VALUES ('S1','2026-08-20','S1',1,2,'waterval','[60,70]','2026-08-20T10:00:00Z');
  INSERT INTO maktab_dhor_log (student_id,date,entered_by,teacher_id,teacher_name,segment_from,segment_to,ref,lap_times,teacher_feedback_visibility,created_at)
    VALUES ('S1','2026-08-25','T1','T1','Ustadha A',5,8,'waterval','[300]','teachers_only','2026-08-25T09:00:00Z');

  INSERT INTO maktab_sabaq_dhor_log (student_id,date,entered_by,teacher_id,teacher_name,from_surah,from_ayah,to_surah,to_ayah,teacher_feedback_visibility,created_at)
    VALUES ('S1','2026-08-25','T1','T1','Ustadha A',78,1,80,42,'teachers_only','2026-08-25T09:10:00Z');
`);
const DB = { prepare(sql) { return { bind(...args) { return {
  async run() { const info = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(info.lastInsertRowid) } }; },
  async first() { return db.prepare(sql).get(...args) ?? null; },
  async all() { return { results: db.prepare(sql).all(...args) }; },
}; } }; } };
const env = { DB };
const S1 = { id: 'S1', role: 'student' };
const T1 = { id: 'T1', role: 'teacher' };
const req = (u) => new Request('https://x' + u);

// ---------- the merged own-read ----------
{
  const r = await handleGetSabaq(req('/sabaq'), env, S1);
  const rows = r.data;
  check('merge: her own /sabaq holds all four rows, interleaved date DESC',
    rows.length === 4 && rows.map(x => x.date).join(' ') === '2026-08-26 2026-08-26 2026-08-24 2026-08-20',
    JSON.stringify(rows.map(x => [x.date, x.source])));
  check('merge: same-date order is created_at DESC (her later entry above the maktab\'s)',
    rows[0].source === 'personal' && rows[1].source === 'maktab');
  const mk = rows.find(x => x.date === '2026-08-24');
  check('merge: a maktab row is read-only by construction — id NULL, maktab_log_id set, provenance riding along',
    mk.source === 'maktab' && mk.id === null && mk.maktab_log_id === 1 && mk.teacher_name === 'Ustadha A');
  check('merge: PJ rows keep their real ids and carry source personal',
    rows.filter(x => x.source === 'personal').every(x => Number.isInteger(x.id)));
  check('privacy: teachers_only feedback on a maktab row is REDACTED for her', mk.teacher_feedback === null);
  check('privacy: her own private comment stays visible to HER',
    rows.find(x => x.date === '2026-08-20').student_comment === 'my own note');
  check('duplicates: the twice-logged day shows BOTH rows, never collapsed',
    rows.filter(x => x.date === '2026-08-26').length === 2
    && rows.filter(x => x.date === '2026-08-26' && x.sabaq_from === '2:31').length === 2);
}
{ // since spans both sides
  const r = await handleGetSabaq(req('/sabaq?since=2026-08-24'), env, S1);
  check('merge: since= filters BOTH sides (3 rows, the 08-20 pair gone)',
    r.data.length === 3 && r.data.every(x => x.date >= '2026-08-24'));
}
{ // the teacher's named-student read: PURE PJ
  const r = await handleGetSabaq(req('/sabaq?student_id=S1'), env, T1);
  check('purity: a teacher\'s ?student_id read is the PURE PJ — 2 rows, no maktab rows, ids intact',
    r.data.length === 2 && r.data.every(x => Number.isInteger(x.id)) && !r.data.some(x => x.source === 'maktab'),
    JSON.stringify(r.data.map(x => [x.date, x.source])));
  check('purity: her private comment is redacted from the teacher on that channel, as always',
    r.data.find(x => x.date === '2026-08-20').student_comment === null);
}
{ // dhor: merged + lap_times parsed on both sides
  const r = await handleGetDhor(req('/dhor'), env, S1);
  check('dhor: merged own-read, maktab row read-only, laps parsed to arrays on BOTH sides',
    r.data.length === 2 && r.data[0].source === 'maktab' && r.data[0].id === null
    && Array.isArray(r.data[0].lap_times) && r.data[0].lap_times[0] === 300
    && Array.isArray(r.data[1].lap_times) && r.data[1].lap_times.length === 2);
}
{ // sabaq-dhor: merged too
  const r = await handleGetSabaqDhor(req('/sabaq-dhor'), env, S1);
  check('sabaq-dhor: merged own-read with the maktab row present and marked',
    r.data.length === 1 && r.data[0].source === 'maktab' && r.data[0].from_surah === 78);
}

// ---------- prepop spans the merge ----------
{
  db.prepare("UPDATE students SET baseline_selection = ? WHERE id = 'S1'").run(JSON.stringify([1,2,3,4,5,6,7,8]));
  const r = await computeDefaultDhorEntry(env, 'S1');
  // DECISIVE: her last dhor overall is the MAKTAB's full juz 2 (5-8), so
  // continue-from-last wraps to juz 1 (1-4). The stale PJ row (1-2, a
  // half) would instead have produced 3-4 — the assertion below passes
  // ONLY when the union is really consulted.
  check('prepop: her PJ "continue from last" follows the MAKTAB dhor — full-juz rotation wraps to 1-4, not the stale PJ half',
    r.source === 'continue_last' && r.segment_from === 1 && r.segment_to === 4, JSON.stringify(r));
  // the maktab variant's own query must have stayed single-table
  const sched = read('worker/src/dhorSchedule.js');
  check('prepop: the union is scoped to dhor_log only — the maktab variant gains NOTHING from PJ',
    /table === 'dhor_log'\n\s*\? await env\.DB\.prepare\(\n\s*`SELECT segment_from, segment_to FROM \(/.test(sched)
    && /UNION ALL\n\s*SELECT segment_from, segment_to, date, created_at FROM maktab_dhor_log/.test(sched));
}

// ---------- the frontend: marker + write-guards ----------
const journalSrc = read('js/journal.js');
const dhorSrc = read('js/dhorPage.js');
{
  const dom = new JSDOM('<!DOCTYPE html><body></body>', { runScripts: 'dangerously' });
  const w = dom.window;
  w.eval("function describeDhorSegment(){ return 'seg'; } var dhorCurrentRef = 'waterval';");
  const a = journalSrc.indexOf('function journalCellShorthand');
  w.eval(journalSrc.slice(a, journalSrc.indexOf('// 2026-08-05, confirmed in chat: replaces the earlier press-and-hold')));
  check('marker: a PERSONAL entry\'s cell text carries pj-personal',
    /class="journal-cell-text pj-personal"/.test(w.eval(`journalCellShorthand('sabaq', [{ sabaq_from: '2:1', sabaq_to: '2:5', source: 'personal' }])`)));
  check('marker: a MAKTAB entry\'s cell text is UNMARKED (the maktab is the spine)',
    !/pj-personal/.test(w.eval(`journalCellShorthand('sabaq', [{ sabaq_from: '2:1', sabaq_to: '2:5', source: 'maktab' }])`)));
}
check('guard: a maktab-topped cell opens the entries popup, never the editor',
  /if\(day\[type\]\[0\]\.source === 'maktab'\) openEntriesPopup\(type, day\[type\], date\);\n\s*else openEntryForEdit\(/.test(journalSrc));
check('guard: openEntryForEdit refuses maktab rows outright',
  /if\(entry && entry\.source === 'maktab'\) return;/.test(journalSrc));
check('popup: maktab rows render as plain provenance rows, personal rows as pj-personal edit buttons',
  /journal-popup-maktab/.test(journalSrc) && /railEscape\(e\.teacher_name \|\| 'Maktab'\)/.test(journalSrc)
  && /class="journal-popup-entry pj-personal" data-index/.test(journalSrc));
check('rail: the edit button is withheld from maktab rows',
  /EDIT_HANDLERS\[type\] && r\.source !== 'maktab' \? `<button type="button" class="history-entry-edit-btn"/.test(dhorSrc));
check('rail: personal rows carry the marker class',
  /history-entry-content\$\{r\.source === 'personal' \? ' pj-personal' : ''\}/.test(dhorSrc));
{
  const css = read('css/journal-table.css');
  check('css: the VERDICT marker (V3.91.0) — lavender fill, NO left border; the B/C staging retired with the verdict',
    /\.pj-personal \{\n  background: var\(--palette-lavender, #E3DADE\);/.test(css)
    && !/border-left: 3px solid var\(--accent/.test(css)
    && !/OPTION B — uncomment/.test(css) && /journal-popup-teacher/.test(css));
}

// ============================================================
// V3.97.0 (l) THE ARCHIVE — the full lifecycle, driven end to end
// ============================================================
{
  // uses the harness's shared env/db (fresh ids well clear of the fixture's)
  const { getMergedLogs, updateLog, deleteLog } = await import('../worker/src/logHelpers.js');
  const iso = (daysAgo) => { const d = new Date(Date.now() - daysAgo * 864e5); return d.toISOString().slice(0, 10); };
  // the shared fixture already holds S1 rows from the merge drives —
  // measure everything RELATIVE to this baseline
  const baseRows = (await getMergedLogs(env, 'sabaq_log', 'maktab_sabaq_log', 'S1', null, 'S1', true)).data.length;
  const baseMk = db.prepare('SELECT COUNT(*) AS c FROM maktab_sabaq_log').get().c;
  // one OLD maktab row (70d), one RECENT (10d), one OLD personal row
  db.prepare("INSERT INTO maktab_sabaq_log (id, student_id, date, entered_by, teacher_name, sabaq_from, sabaq_to, created_at) VALUES (501, 'S1', ?, 'T1', 'Apa Zainab', '2:1', '2:5', '2026-01-01T00:00:00Z')").run(iso(70));
  db.prepare("INSERT INTO maktab_sabaq_log (id, student_id, date, entered_by, teacher_name, sabaq_from, sabaq_to, created_at) VALUES (502, 'S1', ?, 'T1', 'Apa Zainab', '2:6', '2:9', '2026-01-02T00:00:00Z')").run(iso(10));
  db.prepare("INSERT INTO sabaq_log (student_id, date, entered_by, sabaq_from, sabaq_to, created_at) VALUES ('S1', ?, 'S1', '99:1', '99:2', '2026-01-03T00:00:00Z')").run(iso(70));

  const read = async () => (await getMergedLogs(env, 'sabaq_log', 'maktab_sabaq_log', 'S1', null, 'S1', true)).data;
  let rows = await read();
  const copies = () => db.prepare('SELECT * FROM sabaq_log WHERE maktab_log_id IS NOT NULL').all();
  check('archive: the OLD maktab row is COPIED on her read (opportunistic trigger); the RECENT one is not',
    copies().length === 1 && copies()[0].maktab_log_id === 501 && copies()[0].maktab_teacher === 'Apa Zainab');
  check('archive: EXACTNESS — every row shows exactly once (copy replaces the live old row; recent row live; personal row personal)',
    rows.length === baseRows + 3
    && rows.filter(r => r.maktab_log_id === 501).length === 1
    && rows.filter(r => r.maktab_log_id === 502).length === 1
    && rows.filter(r => r.source === 'personal' && r.sabaq_from === '99:1').length === 1);   // a marker the fixture cannot collide with
  check('archive: the copy presents EXACTLY like a live maktab row — id nulled, teacher provenance carried',
    rows.find(r => r.maktab_log_id === 501).id === null
    && rows.find(r => r.maktab_log_id === 501).teacher_name === 'Apa Zainab');
  const before = copies().length;
  await read(); await read();
  check('archive: IDEMPOTENT — repeat reads copy nothing again', copies().length === before);

  // RE-SYNC on EDIT: the teacher amends the archived original
  await updateLog(env, 'maktab_sabaq_log', 501, 'S1', { sabaq_to: '2:7' }, 'T1', ['sabaq_to']);
  check('archive: a maktab EDIT patches the archived copy to match (re-sync, not frozen)',
    db.prepare('SELECT sabaq_to FROM sabaq_log WHERE maktab_log_id = 501').get().sabaq_to === '2:7');
  // RE-SYNC on DELETE — the path the spec flags as the one that gets forgotten
  await deleteLog(env, 'maktab_sabaq_log', 501, 'S1');
  check('archive: a maktab DELETE removes the copy — her journal never asserts what the maktab no longer says',
    copies().length === 0
    && (await read()).filter(r => r.maktab_log_id === 501).length === 0);
  check('archive: the maktab tables are never emptied by archiving itself (only the explicit delete removed 501; 502 stands)',
    db.prepare('SELECT COUNT(*) AS c FROM maktab_sabaq_log').get().c === baseMk + 1
    && db.prepare('SELECT id FROM maktab_sabaq_log WHERE id = 502').get() != null);
  // a personal edit stays personal: no unique-index interference
  check('archive: personal rows are untouched by the machinery (maktab_log_id NULL, still source personal)',
    (await read()).find(r => r.source === 'personal').maktab_log_id == null);
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
