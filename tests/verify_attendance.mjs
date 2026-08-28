import { DatabaseSync } from 'node:sqlite';
import { handleSaveDhor, handleUpdateDhor, handleDeleteDhor } from '../worker/src/dhorLog.js';
import { handleSaveSabaq, handleUpdateSabaq, handleDeleteSabaq } from '../worker/src/sabaqLog.js';
import { handleSaveSabaqDhor, handleUpdateSabaqDhor, handleDeleteSabaqDhor } from '../worker/src/sabaqDhorLog.js';
import { handleUpdateReflection, handleDeleteReflection } from '../worker/src/reflections.js';

let pass = 0, fail = 0;
function check(label, cond) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL:', label); }
}

// ---- real schema, taken directly from the migrations ----
const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE students (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student','teacher','admin')),
    pin_hash TEXT, created_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE attendance (
    student_id TEXT NOT NULL REFERENCES students(id),
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present','absent','haidh','predicted-haidh')),
    PRIMARY KEY (student_id, date)
  );
  CREATE TABLE sabaq_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, date TEXT NOT NULL,
    entered_by TEXT NOT NULL, sabaq_from TEXT, sabaq_to TEXT, tajweed_tags TEXT, tajweed_tag_ids TEXT,
    line_count INTEGER, page_count INTEGER,
    student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT,
    teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT,
    student_comment_private INTEGER, teacher_feedback_visibility TEXT,
    is_duplicate INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
  );
  CREATE TABLE sabaq_dhor_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, date TEXT NOT NULL,
    entered_by TEXT NOT NULL, zone TEXT, tajweed_tags TEXT, tajweed_tag_ids TEXT, mistakes INTEGER,
    from_surah INTEGER, from_ayah INTEGER, to_surah INTEGER, to_ayah INTEGER,
    student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT,
    teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT,
    student_comment_private INTEGER, teacher_feedback_visibility TEXT,
    is_duplicate INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
  );
  CREATE TABLE dhor_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, date TEXT NOT NULL,
    entered_by TEXT NOT NULL, segment_from INTEGER, segment_to INTEGER,
    ref TEXT, tajweed_tags TEXT, tajweed_tag_ids TEXT, mistakes INTEGER, duration_seconds INTEGER, lap_times TEXT,
    student_comment TEXT, student_comment_by TEXT, student_comment_at TEXT,
    teacher_feedback TEXT, teacher_feedback_by TEXT, teacher_feedback_at TEXT,
    student_comment_private INTEGER, teacher_feedback_visibility TEXT,
    is_duplicate INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
  );
  CREATE TABLE reflections (
    id INTEGER PRIMARY KEY AUTOINCREMENT, student_id TEXT NOT NULL, date TEXT NOT NULL,
    entered_by TEXT NOT NULL, reflection TEXT, is_private INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  INSERT INTO students (id, name, role, created_date) VALUES ('STU1', 'Student One', 'student', '2026-01-01');
`);

// ---- minimal D1-shaped wrapper around node:sqlite ----
const DB = {
  prepare(sql) {
    return {
      bind(...args) {
        return {
          async run() {
            const stmt = db.prepare(sql);
            const info = stmt.run(...args);
            return { meta: { last_row_id: info.lastInsertRowid != null ? Number(info.lastInsertRowid) : undefined } };
          },
          async first() {
            const stmt = db.prepare(sql);
            return stmt.get(...args) ?? null;
          },
          async all() {
            const stmt = db.prepare(sql);
            return { results: stmt.all(...args) };
          },
        };
      },
    };
  },
};
const env = { DB };
const auth = { id: 'STU1', role: 'student' };

function req(body) { return { json: async () => body, url: 'https://x/?' }; }
function delReq(id) { return { url: `https://x/?id=${id}` }; }

function attendance(date) {
  return db.prepare('SELECT status FROM attendance WHERE student_id = ? AND date = ?').get('STU1', date)?.status ?? null;
}

(async () => {
  // ============================================================
  // A: editing a date with a sibling entry on the old date keeps
  //    the old date present, and marks the new date present too
  // ============================================================
  {
    const sabaq = await handleSaveSabaq(req({ date: '2026-08-01', sabaq_from: '2:1', sabaq_to: '2:5' }), env, auth);
    const dhor = await handleSaveDhor(req({ date: '2026-08-01', segment_from: 1, segment_to: 2, ref: 'waterval' }), env, auth);
    check('A0: both saved', sabaq.data.id && dhor.data.id);
    check('A1: 08-01 present after both saves', attendance('2026-08-01') === 'present');

    await handleUpdateDhor(req({ id: dhor.data.id, date: '2026-08-05' }), env, auth);
    check('A2: 08-01 STILL present (sabaq sibling remains)', attendance('2026-08-01') === 'present');
    check('A3: 08-05 now present (moved-to date)', attendance('2026-08-05') === 'present');
  }

  // ============================================================
  // B: editing the ONLY entry on a date reverts that date to unset
  // ============================================================
  {
    const s = await handleSaveSabaq(req({ date: '2026-08-10', sabaq_from: '3:1', sabaq_to: '3:10' }), env, auth);
    check('B1: 08-10 present after save', attendance('2026-08-10') === 'present');
    await handleUpdateSabaq(req({ id: s.data.id, date: '2026-08-12' }), env, auth);
    check('B2: 08-10 reverted to UNSET (no sibling)', attendance('2026-08-10') === null);
    check('B3: 08-12 present (moved-to date)', attendance('2026-08-12') === 'present');
  }

  // ============================================================
  // C: deleting one of two same-day entries keeps the date present
  // ============================================================
  {
    const s = await handleSaveSabaq(req({ date: '2026-08-15', sabaq_from: '4:1', sabaq_to: '4:10' }), env, auth);
    const sd = await handleSaveSabaqDhor(req({ date: '2026-08-15', zone: 'A', mistakes: 1 }), env, auth);
    check('C0: both saved', s.data.id && sd.data.id);
    await handleDeleteSabaqDhor(delReq(sd.data.id), env, auth);
    check('C1: 08-15 STILL present (sabaq sibling remains)', attendance('2026-08-15') === 'present');
  }

  // ============================================================
  // D: deleting the ONLY entry on a date reverts it to unset
  // ============================================================
  {
    const d = await handleSaveDhor(req({ date: '2026-08-20', segment_from: 1, segment_to: 1, ref: 'uthmani' }), env, auth);
    check('D0: saved', d.data.id);
    await handleDeleteDhor(delReq(d.data.id), env, auth);
    check('D1: 08-20 reverted to UNSET (no sibling)', attendance('2026-08-20') === null);
  }

  // ============================================================
  // E: editing a log ONTO a day already marked haidh overwrites it
  //    to present -- "log wins", same rule as a fresh save
  // ============================================================
  {
    db.prepare(`INSERT INTO attendance (student_id, date, status) VALUES ('STU1','2026-08-25','haidh')`).run();
    check('E0: 08-25 starts haidh', attendance('2026-08-25') === 'haidh');
    const s = await handleSaveSabaq(req({ date: '2026-08-24', sabaq_from: '5:1', sabaq_to: '5:10' }), env, auth);
    await handleUpdateSabaq(req({ id: s.data.id, date: '2026-08-25' }), env, auth);
    check('E1: 08-25 now present (log overwrote haidh)', attendance('2026-08-25') === 'present');
  }

  // ============================================================
  // F: reflections (Tadabbur) never touch attendance -- confirms
  //    the trackAttendance opt-in default actually holds
  // ============================================================
  {
    db.exec(`INSERT INTO reflections (student_id, date, entered_by, reflection, created_at)
             VALUES ('STU1', '2026-08-30', 'STU1', 'a reflection', '2026-08-30T00:00:00Z')`);
    const refl = db.prepare(`SELECT id FROM reflections WHERE date = '2026-08-30'`).get();
    check('F0: 08-30 has NO attendance row (reflection never marks present)', attendance('2026-08-30') === null);

    await handleUpdateReflection(req({ id: refl.id, date: '2026-08-31' }), env, auth);
    check('F1: reflection date-edit creates NO attendance row on 08-31', attendance('2026-08-31') === null);
    check('F2: 08-30 still untouched', attendance('2026-08-30') === null);

    await handleDeleteReflection(delReq(refl.id), env, auth);
    check('F3: reflection delete -- still no attendance rows appeared', attendance('2026-08-31') === null && attendance('2026-08-30') === null);
  }

  // ============================================================
  // G: editing a log WITHOUT changing its date doesn't touch
  //    attendance at all (dateChanging must require an actual change)
  // ============================================================
  {
    const s = await handleSaveSabaq(req({ date: '2026-09-01', sabaq_from: '6:1', sabaq_to: '6:10' }), env, auth);
    check('G0: 09-01 present', attendance('2026-09-01') === 'present');
    // manually flip it to haidh to prove a no-date-change edit doesn't touch it
    db.prepare(`UPDATE attendance SET status='haidh' WHERE student_id='STU1' AND date='2026-09-01'`).run();
    await handleUpdateSabaq(req({ id: s.data.id, sabaq_from: '7:1', sabaq_to: '7:10' }), env, auth); // no date field at all
    check('G1: non-date edit left attendance exactly as it was (still haidh)', attendance('2026-09-01') === 'haidh');
  }

  // ============================================================
  // H: a malformed date on update is rejected by isValidDate --
  //    no attendance side effect, and it doesn't crash
  // ============================================================
  {
    const s = await handleSaveSabaq(req({ date: '2026-09-05', sabaq_from: '8:1', sabaq_to: '8:10' }), env, auth);
    let threw = false;
    let result;
    try { result = await handleUpdateSabaq(req({ id: s.data.id, date: 'not-a-date' }), env, auth); }
    catch (e) { threw = true; }
    check('H0: malformed date does not throw', !threw);
    check('H1: 09-05 attendance untouched (no bogus sync attempted)', attendance('2026-09-05') === 'present');
    check('H2: no attendance row created for the garbage "date"', attendance('not-a-date') === null);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
