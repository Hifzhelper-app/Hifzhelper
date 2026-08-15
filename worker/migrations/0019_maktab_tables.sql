-- Migration 0019: Maktab log tables (V3.57.0 — maktab delivery (c)).
-- The first maktab-specific schema. Three tables mirroring the three PJ
-- activity logs' CURRENT live shape (0005 base + 0006 privacy/rename/
-- lap_times + 0013 line/page counts + 0014 sabaq-dhor ayah range + 0015
-- sabaq_from/to — assembled from the full migration history, not the
-- stale 0005 snapshot), each plus two provenance columns:
--   teacher_id   — the confirming teacher (teachers are students-table
--                  rows; no separate teachers table).
--   teacher_name — a snapshot at save time, deliberately denormalized:
--                  provenance should read as it was when confirmed, even
--                  if the teacher's row is later renamed or deactivated.
-- One agreed default divergence from the PJ: teacher_feedback_visibility
-- defaults to 'teachers_only' here (PJ default is 'all') — same CHECK
-- enum, same applyPrivacy semantics, different default.
-- entered_by is kept (the ALL-PJ-columns rule): who made the API call —
-- equals teacher_id on a normal save, but they're different facts.
-- No teacher_id != student_id CHECK on purpose: the no-self-recitation
-- rule is about who CONFIRMS (an auth concern, enforced server-side in
-- delivery (d)), and a CHECK would also block a legitimate future admin
-- data-correction path.
-- Purely additive — no existing table touched; nothing reads these until
-- delivery (d), so running this any time is safe.
--
-- Apply ONE STATEMENT AT A TIME in the D1 console — the console only
-- executes the first statement of a multi-statement paste (see
-- TESTING.md / the migration 0003 saga). Run on BOTH DBs (maktab1 +
-- personal). No inline trailing comments on any statement line below,
-- on purpose — that exact pattern broke migration 0010's and 0011's
-- runners before.

CREATE TABLE maktab_sabaq_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL REFERENCES students(id),
  date TEXT NOT NULL,
  entered_by TEXT NOT NULL REFERENCES students(id),
  teacher_id TEXT NOT NULL REFERENCES students(id),
  teacher_name TEXT NOT NULL,
  sabaq_from TEXT,
  sabaq_to TEXT,
  tajweed_tags TEXT,
  line_count INTEGER,
  page_count INTEGER,
  student_comment TEXT,
  student_comment_by TEXT REFERENCES students(id),
  student_comment_at TEXT,
  student_comment_private INTEGER NOT NULL DEFAULT 0,
  teacher_feedback TEXT,
  teacher_feedback_by TEXT REFERENCES students(id),
  teacher_feedback_at TEXT,
  teacher_feedback_visibility TEXT NOT NULL DEFAULT 'teachers_only' CHECK (teacher_feedback_visibility IN ('all','teachers_only','private')),
  is_duplicate INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE maktab_sabaq_dhor_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL REFERENCES students(id),
  date TEXT NOT NULL,
  entered_by TEXT NOT NULL REFERENCES students(id),
  teacher_id TEXT NOT NULL REFERENCES students(id),
  teacher_name TEXT NOT NULL,
  zone TEXT,
  tajweed_tags TEXT,
  mistakes INTEGER,
  from_surah INTEGER,
  from_ayah INTEGER,
  to_surah INTEGER,
  to_ayah INTEGER,
  student_comment TEXT,
  student_comment_by TEXT REFERENCES students(id),
  student_comment_at TEXT,
  student_comment_private INTEGER NOT NULL DEFAULT 0,
  teacher_feedback TEXT,
  teacher_feedback_by TEXT REFERENCES students(id),
  teacher_feedback_at TEXT,
  teacher_feedback_visibility TEXT NOT NULL DEFAULT 'teachers_only' CHECK (teacher_feedback_visibility IN ('all','teachers_only','private')),
  is_duplicate INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE maktab_dhor_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT NOT NULL REFERENCES students(id),
  date TEXT NOT NULL,
  entered_by TEXT NOT NULL REFERENCES students(id),
  teacher_id TEXT NOT NULL REFERENCES students(id),
  teacher_name TEXT NOT NULL,
  segment_from INTEGER,
  segment_to INTEGER,
  ref TEXT CHECK (ref IN ('waterval','uthmani')),
  tajweed_tags TEXT,
  mistakes INTEGER,
  duration_seconds INTEGER,
  lap_times TEXT,
  student_comment TEXT,
  student_comment_by TEXT REFERENCES students(id),
  student_comment_at TEXT,
  student_comment_private INTEGER NOT NULL DEFAULT 0,
  teacher_feedback TEXT,
  teacher_feedback_by TEXT REFERENCES students(id),
  teacher_feedback_at TEXT,
  teacher_feedback_visibility TEXT NOT NULL DEFAULT 'teachers_only' CHECK (teacher_feedback_visibility IN ('all','teachers_only','private')),
  is_duplicate INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
