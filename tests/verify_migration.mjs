import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import { fileURLToPath } from 'url';
// repo-relative: tests/ lives inside the repo, so the root is one up.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

let pass = 0, fail = 0;
function check(label, cond) { if (cond) pass++; else { fail++; console.log('FAIL:', label); } }

const db = new DatabaseSync(':memory:');

// ---- students table (current shape, post-0007) — FK target ----
db.exec(`CREATE TABLE students (id TEXT PRIMARY KEY, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','teacher','admin')),
  pin_hash TEXT, created_date TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
  INSERT INTO students (id,name,role,created_date) VALUES
  ('STU1','S','student','2026-01-01'), ('TCH1','T','teacher','2026-01-01');`);

// ---- build the PJ tables by REPLAYING the real migration files ----
// (0005 creates them; 0006/0013/0014/0015 evolve them — the authoritative
// current shape, not a hand-typed copy.)
function splitStatements(sql) {
  // Strip comment lines FIRST, then split on ';' — comment prose is
  // allowed to contain semicolons (0011/0017 already do, applied fine
  // in production; the first draft of this harness split before
  // stripping and cut inside the 0019 header comment).
  const noComments = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  return noComments.split(';').map(s => s.trim()).filter(Boolean);
}
function runMigration(path, only = null) {
  for (const st of splitStatements(fs.readFileSync(path, 'utf8'))) {
    if (only && !only(st)) continue;
    db.exec(st);
  }
}
const M = ROOT + 'worker/migrations/';
runMigration(M + '0005_v2_independent_logs.sql', st => /sabaq_log|sabaq_dhor_log|dhor_log|reflections/.test(st) && st.startsWith('CREATE TABLE'));
runMigration(M + '0006_plans_timer_privacy.sql', st => /ALTER TABLE (sabaq_log|sabaq_dhor_log|dhor_log|reflections)/.test(st));
runMigration(M + '0013_sabaq_line_page_count.sql');
runMigration(M + '0014_sabaq_dhor_ayah_range.sql');
runMigration(M + '0015_sabaq_from_to.sql');

// ---- run 0019 EXACTLY as the D1 console would: one statement at a time ----
const migStatements = splitStatements(fs.readFileSync(M + '0019_maktab_tables.sql', 'utf8'));
check('0019 contains exactly 3 statements (one-at-a-time friendly)', migStatements.length === 3);
let stErr = null;
for (const st of migStatements) { try { db.exec(st); } catch (e) { stErr = e.message; } }
check('0019 statements all execute cleanly', stErr === null);

// ---- column-by-column comparison ----
const cols = (t) => Object.fromEntries(db.prepare(`PRAGMA table_info(${t})`).all().map(r => [r.name, r]));
const PAIRS = [
  ['sabaq_log', 'maktab_sabaq_log'],
  ['sabaq_dhor_log', 'maktab_sabaq_dhor_log'],
  ['dhor_log', 'maktab_dhor_log'],
];
for (const [pj, mk] of PAIRS) {
  const p = cols(pj), m = cols(mk);
  const missing = Object.keys(p).filter(c => !(c in m));
  check(`${mk}: carries ALL ${pj} columns (missing: ${missing.join(',') || 'none'})`, missing.length === 0);
  const typeMismatch = Object.keys(p).filter(c => c in m && m[c].type !== p[c].type);
  check(`${mk}: matching types (mismatch: ${typeMismatch.join(',') || 'none'})`, typeMismatch.length === 0);
  const extras = Object.keys(m).filter(c => !(c in p));
  check(`${mk}: exactly the 2 agreed extras (got: ${extras.join(',')})`,
    extras.length === 2 && extras.includes('teacher_id') && extras.includes('teacher_name'));
  check(`${mk}: teacher_id NOT NULL`, m.teacher_id.notnull === 1);
  check(`${mk}: teacher_name NOT NULL`, m.teacher_name.notnull === 1);
  check(`${mk}: visibility default is 'teachers_only' (PJ's is ${p.teacher_feedback_visibility.dflt_value})`,
    m.teacher_feedback_visibility.dflt_value === "'teachers_only'" && p.teacher_feedback_visibility.dflt_value === "'all'");
}

// ---- behavioural: defaults + CHECKs actually enforced ----
{
  db.exec(`INSERT INTO maktab_sabaq_log (student_id, date, entered_by, teacher_id, teacher_name, sabaq_from, sabaq_to, created_at)
           VALUES ('STU1','2026-08-15','TCH1','TCH1','T','2:1','2:3','now')`);
  const r = db.prepare('SELECT * FROM maktab_sabaq_log').get();
  check('insert without visibility -> lands as teachers_only (default proven)', r.teacher_feedback_visibility === 'teachers_only');
  check('insert without private flag -> 0', r.student_comment_private === 0);

  let threw = false;
  try { db.exec(`INSERT INTO maktab_dhor_log (student_id, date, entered_by, teacher_id, teacher_name, ref, created_at)
                 VALUES ('STU1','2026-08-15','TCH1','TCH1','T','NOT_A_REF','now')`); } catch (e) { threw = true; }
  check('dhor ref CHECK enforced', threw);

  threw = false;
  try { db.exec(`INSERT INTO maktab_sabaq_log (student_id, date, entered_by, teacher_id, teacher_name, teacher_feedback_visibility, created_at)
                 VALUES ('STU1','2026-08-15','TCH1','TCH1','T','everyone','now')`); } catch (e) { threw = true; }
  check('visibility CHECK enforced', threw);

  threw = false;
  try { db.exec(`INSERT INTO maktab_sabaq_log (student_id, date, entered_by, teacher_name, created_at)
                 VALUES ('STU1','2026-08-15','TCH1','T','now')`); } catch (e) { threw = true; }
  check('teacher_id NOT NULL enforced', threw);
}

// ---- PJ tables untouched by 0019 (purely additive) ----
{
  db.exec(`INSERT INTO sabaq_log (student_id, date, entered_by, sabaq_from, sabaq_to, created_at)
           VALUES ('STU1','2026-08-15','STU1','2:1','2:3','now')`);
  const r = db.prepare('SELECT teacher_feedback_visibility FROM sabaq_log').get();
  check('PJ default still all — untouched by 0019', r.teacher_feedback_visibility === 'all');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
