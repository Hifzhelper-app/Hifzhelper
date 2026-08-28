import { DatabaseSync } from 'node:sqlite';
import { handleSaveSabaq, handleUpdateSabaq } from '../worker/src/sabaqLog.js';
import { handleSaveSabaqDhor } from '../worker/src/sabaqDhorLog.js';
import { handleSaveDhor } from '../worker/src/dhorLog.js';
import { fileURLToPath } from 'url';
// repo-relative: tests/ lives inside the repo, so the root is one up.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

let pass = 0, fail = 0;
function check(label, cond) { if (cond) pass++; else { fail++; console.log('FAIL:', label); } }

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE students (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
    pin_hash TEXT, created_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE attendance (student_id TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL,
    PRIMARY KEY (student_id, date));
  CREATE TABLE sabaq_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, date TEXT NOT NULL,
    entered_by TEXT NOT NULL, sabaq_from TEXT, sabaq_to TEXT, tajweed_tags TEXT, tajweed_tag_ids TEXT, line_count INTEGER, page_count INTEGER,
    student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT,
    teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT,
    student_comment_private INTEGER NOT NULL DEFAULT 0, teacher_feedback_visibility TEXT NOT NULL DEFAULT 'all',
    is_duplicate INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
  CREATE TABLE sabaq_dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, date TEXT NOT NULL,
    entered_by TEXT NOT NULL, zone TEXT, tajweed_tags TEXT, tajweed_tag_ids TEXT, mistakes INTEGER,
    from_surah INTEGER, from_ayah INTEGER, to_surah INTEGER, to_ayah INTEGER,
    student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT,
    teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT,
    student_comment_private INTEGER NOT NULL DEFAULT 0, teacher_feedback_visibility TEXT NOT NULL DEFAULT 'all',
    is_duplicate INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
  CREATE TABLE dhor_log (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, date TEXT NOT NULL,
    entered_by TEXT NOT NULL, segment_from INTEGER, segment_to INTEGER, ref TEXT, tajweed_tags TEXT, tajweed_tag_ids TEXT,
    mistakes INTEGER, duration_seconds INTEGER, lap_times TEXT,
    student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT,
    teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT,
    student_comment_private INTEGER NOT NULL DEFAULT 0, teacher_feedback_visibility TEXT NOT NULL DEFAULT 'all',
    is_duplicate INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
  INSERT INTO students (id, name, role, created_date) VALUES ('STU1','S','student','2026-01-01');
`);

const DB = { prepare(sql) { return { bind(...args) { return {
  async run() { const info = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(info.lastInsertRowid) } }; },
  async first() { return db.prepare(sql).get(...args) ?? null; },
  async all() { return { results: db.prepare(sql).all(...args) }; },
}; } }; } };
const env = { DB };
const auth = { id: 'STU1', role: 'student' };
const req = (body) => ({ json: async () => body, url: 'https://x/?' });
const row = (table, id) => db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);

// ---- A: fresh save WITH a note lands note+flag+stamps (all 3 logs) ----
{
  const r1 = await handleSaveSabaq(req({ date: '2026-08-01', sabaq_from: '2:1', sabaq_to: '2:3',
    student_comment: 'went well', student_comment_private: true }), env, auth);
  const s = row('sabaq_log', r1.data.id);
  check('A1 sabaq: note landed', s.student_comment === 'went well');
  check('A2 sabaq: flag landed as 1', s.student_comment_private === 1);
  check('A3 sabaq: stamped by/at', s.student_comment_by === 'STU1' && !!s.student_comment_at);

  const r2 = await handleSaveSabaqDhor(req({ date: '2026-08-01', zone: 'A',
    student_comment: 'zone note', student_comment_private: false }), env, auth);
  const sd = row('sabaq_dhor_log', r2.data.id);
  check('A4 sabaqDhor: note landed', sd.student_comment === 'zone note');
  check('A5 sabaqDhor: explicit false flag lands as 0', sd.student_comment_private === 0);

  const r3 = await handleSaveDhor(req({ date: '2026-08-01', segment_from: 1, segment_to: 1, ref: 'waterval',
    student_comment: 'dhor note', student_comment_private: true }), env, auth);
  const d = row('dhor_log', r3.data.id);
  check('A6 dhor: note landed', d.student_comment === 'dhor note');
  check('A7 dhor: flag landed as 1', d.student_comment_private === 1);
}

// ---- B: fresh save WITHOUT a note -> clean row, no stamps ----
{
  const r = await handleSaveSabaq(req({ date: '2026-08-02', sabaq_from: '3:1', sabaq_to: '3:3',
    student_comment: null, student_comment_private: true }), env, auth);
  const s = row('sabaq_log', r.data.id);
  check('B1: no note -> comment null', s.student_comment === null);
  check('B2: no note -> NO by/at stamps (note-only trigger)', s.student_comment_by === null && s.student_comment_at === null);
  check('B3: flag stays DB default 0 (nothing to protect)', s.student_comment_private === 0);
}

// ---- C: duplicate detection UNAFFECTED by differing notes ----
{
  const r1 = await handleSaveSabaq(req({ date: '2026-08-03', sabaq_from: '4:1', sabaq_to: '4:3',
    student_comment: 'first note', student_comment_private: true }), env, auth);
  check('C1: first save inserted', !!r1.data.id);
  const r2 = await handleSaveSabaq(req({ date: '2026-08-03', sabaq_from: '4:1', sabaq_to: '4:3',
    student_comment: 'a COMPLETELY different note', student_comment_private: false }), env, auth);
  check('C2: identical content + different note -> STILL flagged duplicate, not inserted', r2.data.isDuplicate === true && !r2.data.id);
  const r3 = await handleSaveSabaq(req({ date: '2026-08-03', sabaq_from: '4:1', sabaq_to: '4:3',
    student_comment: 'forced note', student_comment_private: true, force: true }), env, auth);
  const s3 = row('sabaq_log', r3.data.id);
  check('C3: forced duplicate still gets its note', s3.student_comment === 'forced note' && s3.is_duplicate === 1);
}

// ---- D: edit path regression -- still works exactly as before ----
{
  const r = await handleSaveSabaq(req({ date: '2026-08-04', sabaq_from: '5:1', sabaq_to: '5:3' }), env, auth);
  await handleUpdateSabaq(req({ id: r.data.id, student_comment: 'added later', student_comment_private: true }), env, auth);
  const s = row('sabaq_log', r.data.id);
  check('D1: edit-path note add still works', s.student_comment === 'added later' && s.student_comment_private === 1);
}

// ---- E: frontend default (jsdom, real commentPrivacy.js) ----
{
  const { JSDOM } = await import('jsdom');
  const fs = await import('fs');
  const src = fs.readFileSync(ROOT + 'js/commentPrivacy.js', 'utf8');
  const dom = new JSDOM('<!DOCTYPE html><body><div id="blk"></div></body>', { runScripts: 'dangerously' });
  const sc = dom.window.document.createElement('script');
  sc.textContent = src + ';window.renderCommentBlock = renderCommentBlock; window.readCommentBlock = readCommentBlock;';
  dom.window.document.body.appendChild(sc);

  dom.window.renderCommentBlock('blk', null);
  check('E1: NEW entry -> Private checkbox CHECKED (the (b) default)',
    dom.window.document.querySelector('.cb-private-checkbox').checked === true);
  check('E2: readCommentBlock reflects it', dom.window.readCommentBlock('blk').student_comment_private === true);

  dom.window.renderCommentBlock('blk', { student_comment: 'old', student_comment_private: 0 });
  check('E3: EXISTING public entry stays UNCHECKED (rows left as-is)',
    dom.window.document.querySelector('.cb-private-checkbox').checked === false);

  dom.window.renderCommentBlock('blk', { student_comment: 'old2', student_comment_private: 1 });
  check('E4: EXISTING private entry stays checked',
    dom.window.document.querySelector('.cb-private-checkbox').checked === true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
