-- Migration 0003: support up to two entries per day (entry_number 1 or 2).
-- SQLite can't ALTER a UNIQUE constraint directly, so this rebuilds the
-- entries table: create new shape, copy existing rows in as entry_number=1,
-- drop the old table, rename the new one into place, recreate the index.

CREATE TABLE entries_new (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id            TEXT NOT NULL REFERENCES students(id),
  date                  TEXT NOT NULL,
  entry_number          INTEGER NOT NULL DEFAULT 1 CHECK (entry_number IN (1, 2)),
  sabaq_surah           INTEGER,
  sabaq_ayah_from        INTEGER,
  sabaq_ayah_to          INTEGER,
  sabaq_lines           INTEGER,
  sabaq_quarter         INTEGER,
  sabaq_tajweed         TEXT,
  sabaqdhor_zone        TEXT,
  sabaqdhor_tajweed     TEXT,
  sabaqdhor_mistakes    INTEGER,
  dhor_from             INTEGER,
  dhor_to               INTEGER,
  dhor_ref              TEXT CHECK (dhor_ref IN ('waterval','uthmani')),
  dhor_tajweed          TEXT,
  dhor_mistakes         INTEGER,
  dhor_minutes          INTEGER,
  reflection            TEXT,
  student_comment       TEXT,
  teacher_feedback      TEXT,
  UNIQUE (student_id, date, entry_number)
);

INSERT INTO entries_new (
  id, student_id, date, entry_number, sabaq_surah, sabaq_ayah_from, sabaq_ayah_to,
  sabaq_lines, sabaq_quarter, sabaq_tajweed, sabaqdhor_zone, sabaqdhor_tajweed,
  sabaqdhor_mistakes, dhor_from, dhor_to, dhor_ref, dhor_tajweed, dhor_mistakes,
  dhor_minutes, reflection, student_comment, teacher_feedback
)
SELECT
  id, student_id, date, 1, sabaq_surah, sabaq_ayah_from, sabaq_ayah_to,
  sabaq_lines, sabaq_quarter, sabaq_tajweed, sabaqdhor_zone, sabaqdhor_tajweed,
  sabaqdhor_mistakes, dhor_from, dhor_to, dhor_ref, dhor_tajweed, dhor_mistakes,
  dhor_minutes, reflection, student_comment, teacher_feedback
FROM entries;

DROP TABLE entries;
ALTER TABLE entries_new RENAME TO entries;

CREATE INDEX idx_entries_student_date ON entries(student_id, date DESC);
