-- Migration 0005: V2 independent-logs redesign.
-- Replaces the single `entries` table with four independent logs — Sabaq,
-- Sabaq Dhor, and Dhor no longer share one row (see CHANGELOG V2.0 / the
-- V2 design discussion for why: they have genuinely independent lifespans,
-- entered by different people at different times, and need real per-
-- session history, not a single overwritten row).
--
-- students / attendance / position are UNCHANGED — nothing here touches them.
--
-- No data migration from the old `entries` table — per the "delete
-- everything, start fresh" decision, since nothing real exists in it yet.

DROP TABLE IF EXISTS entries;

CREATE TABLE sabaq_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL REFERENCES students(id),
  date TEXT NOT NULL,
  entered_by TEXT NOT NULL REFERENCES students(id),
  surah INTEGER,
  ayah_from INTEGER,
  ayah_to INTEGER,
  tajweed_tags TEXT,
  student_comment TEXT,
  student_comment_by TEXT REFERENCES students(id),
  student_comment_at TEXT,
  teacher_feedback TEXT,
  teacher_feedback_by TEXT REFERENCES students(id),
  teacher_feedback_at TEXT,
  is_duplicate INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sabaq_log_student_date ON sabaq_log(student_id, date DESC);

CREATE TABLE sabaq_dhor_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL REFERENCES students(id),
  date TEXT NOT NULL,
  entered_by TEXT NOT NULL REFERENCES students(id),
  zone TEXT,
  tajweed_tags TEXT,
  mistakes INTEGER,
  student_comment TEXT,
  student_comment_by TEXT REFERENCES students(id),
  student_comment_at TEXT,
  teacher_feedback TEXT,
  teacher_feedback_by TEXT REFERENCES students(id),
  teacher_feedback_at TEXT,
  is_duplicate INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sabaq_dhor_log_student_date ON sabaq_dhor_log(student_id, date DESC);

CREATE TABLE dhor_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL REFERENCES students(id),
  date TEXT NOT NULL,
  entered_by TEXT NOT NULL REFERENCES students(id),
  segment_from INTEGER,
  segment_to INTEGER,
  ref TEXT CHECK (ref IN ('waterval','uthmani')),
  tajweed_tags TEXT,
  mistakes INTEGER,
  minutes INTEGER,
  student_comment TEXT,
  student_comment_by TEXT REFERENCES students(id),
  student_comment_at TEXT,
  teacher_feedback TEXT,
  teacher_feedback_by TEXT REFERENCES students(id),
  teacher_feedback_at TEXT,
  is_duplicate INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_dhor_log_student_date ON dhor_log(student_id, date DESC);

CREATE TABLE reflections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL REFERENCES students(id),
  date TEXT NOT NULL,
  entered_by TEXT NOT NULL REFERENCES students(id),
  reflection TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_reflections_student_date ON reflections(student_id, date DESC);
