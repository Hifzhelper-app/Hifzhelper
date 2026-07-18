-- Hifzhelper — D1 schema
-- One D1 database per maktab (per CONVENTIONS.md / the D1 decision in chat).
-- Field names match SCHEMA.md exactly — see CONVENTIONS.md principle 5
-- (schema parity). If a field needs to change, change SCHEMA.md first.

CREATE TABLE students (
  id            TEXT PRIMARY KEY,      -- random code, not sequential (e.g. K7M2QX) — used to log in
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student','teacher')),
  pin_hash      TEXT,                  -- set on first login, not at creation; never store raw PIN
  created_date  TEXT NOT NULL,         -- YYYY-MM-DD
  active        INTEGER NOT NULL DEFAULT 1  -- 1 = yes, 0 = no (SQLite has no native boolean)
);

CREATE TABLE entries (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id            TEXT NOT NULL REFERENCES students(id),
  date                  TEXT NOT NULL,   -- YYYY-MM-DD
  sabaq_surah           INTEGER,         -- 1-114
  sabaq_ayah_from        INTEGER,
  sabaq_ayah_to          INTEGER,
  sabaq_lines           INTEGER,
  sabaq_quarter         INTEGER,         -- 1-4, computed from rub' boundary data (see data.js)
  sabaq_tajweed         TEXT,            -- comma-separated tags
  sabaqdhor_zone        TEXT,            -- computed juz' list at save time, e.g. "Juz' 29, 30"
  sabaqdhor_tajweed     TEXT,
  sabaqdhor_mistakes    INTEGER,         -- optional, may be NULL
  dhor_from             INTEGER,         -- segment unit — see dhor_ref for which scale
  dhor_to               INTEGER,
  dhor_ref              TEXT CHECK (dhor_ref IN ('waterval','uthmani')),  -- which reference dhor_from/to are expressed in
  dhor_tajweed          TEXT,
  dhor_mistakes         INTEGER,
  dhor_minutes          INTEGER,         -- time is only tracked on dhor, not sabaq/sabaq dhor
  reflection            TEXT,            -- tadabbur
  student_comment       TEXT,
  teacher_feedback      TEXT,
  UNIQUE (student_id, date)              -- one row per student per day; save = upsert on this pair
);
CREATE INDEX idx_entries_student_date ON entries(student_id, date DESC);

CREATE TABLE attendance (
  student_id  TEXT NOT NULL REFERENCES students(id),
  date        TEXT NOT NULL,   -- YYYY-MM-DD
  status      TEXT NOT NULL CHECK (status IN ('present','absent','haidh','predicted-haidh')),
  PRIMARY KEY (student_id, date)
);

CREATE TABLE position (
  student_id      TEXT PRIMARY KEY REFERENCES students(id),  -- one row per student, updated in place
  position_json   TEXT,   -- { activeJuz, studyOrder: [...], juz: { "30": {...}, ... } }
  last_dhor_json  TEXT,   -- { "<segment-unit>": "<last-revised-date>", ... }
  updated_at      TEXT    -- ISO timestamp, for debugging/sync
);
