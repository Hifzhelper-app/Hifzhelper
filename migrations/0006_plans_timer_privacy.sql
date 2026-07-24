-- Migration 0006: plans, timer/lap, privacy controls.
-- All additive (ADD COLUMN / RENAME COLUMN) — no table rebuilds needed,
-- unlike 0003's UNIQUE-constraint change.

CREATE TABLE plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL REFERENCES students(id),
  entered_by TEXT NOT NULL REFERENCES students(id),
  plan_type TEXT NOT NULL CHECK (plan_type IN ('dhor','sabaq','sabaq_dhor')),
  target_date TEXT NOT NULL,
  segment_from INTEGER,
  segment_to INTEGER,
  ref TEXT CHECK (ref IN ('waterval','uthmani')),
  surah INTEGER,
  ayah_from INTEGER,
  ayah_to INTEGER,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','completed','skipped')),
  completed_log_id INTEGER,
  completed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_plans_student_date ON plans(student_id, target_date);

-- Timer/lap support: dhor_log's time field moves from whole minutes to
-- seconds-level precision (renamed for clarity), plus a JSON array of true
-- per-section lap durations, same pattern as tajweed_tags (a variable-length
-- list as one column, not numbered columns or a separate table).
ALTER TABLE dhor_log RENAME COLUMN minutes TO duration_seconds;
ALTER TABLE dhor_log ADD COLUMN lap_times TEXT;

-- Privacy: student_comment gets its own private flag (it's the student's own
-- performance self-assessment, not a note-to-teacher — distinct from
-- teacher_feedback, which gets a three-tier visibility instead, since
-- multiple teachers viewing one student is a real, current scenario, not
-- just future Phase 2 planning.
ALTER TABLE sabaq_log ADD COLUMN student_comment_private INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sabaq_log ADD COLUMN teacher_feedback_visibility TEXT NOT NULL DEFAULT 'all'
  CHECK (teacher_feedback_visibility IN ('all','teachers_only','private'));

ALTER TABLE sabaq_dhor_log ADD COLUMN student_comment_private INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sabaq_dhor_log ADD COLUMN teacher_feedback_visibility TEXT NOT NULL DEFAULT 'all'
  CHECK (teacher_feedback_visibility IN ('all','teachers_only','private'));

ALTER TABLE dhor_log ADD COLUMN student_comment_private INTEGER NOT NULL DEFAULT 0;
ALTER TABLE dhor_log ADD COLUMN teacher_feedback_visibility TEXT NOT NULL DEFAULT 'all'
  CHECK (teacher_feedback_visibility IN ('all','teachers_only','private'));

-- Reflections (tadabbur) get the same private toggle as student_comment —
-- both are the student's own writing, distinct from teacher_feedback.
ALTER TABLE reflections ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0;
