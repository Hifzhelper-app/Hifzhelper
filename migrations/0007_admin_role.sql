-- Migration 0007: admin role support + bootstrap ADMIN-01 account.
-- SQLite can't ALTER a CHECK constraint in place, so this rebuilds the
-- students table (same pattern as migration 0003): create new shape with
-- 'admin' added to the allowed roles, copy existing rows across, drop old,
-- rename new. Apply ONE STATEMENT AT A TIME in the D1 console — the console
-- only executes the first statement of a multi-statement paste (see
-- TESTING.md / the migration 0003 saga for why).

CREATE TABLE students_new (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('student','teacher','admin')),
  pin_hash        TEXT,
  created_date    TEXT NOT NULL,
  active          INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TEXT,
  gender          TEXT CHECK (gender IN ('M','F')),
  track_haidh     INTEGER NOT NULL DEFAULT 0,
  setup_complete  INTEGER NOT NULL DEFAULT 0
);

INSERT INTO students_new (id, name, role, pin_hash, created_date, active, failed_attempts, locked_until, gender, track_haidh, setup_complete)
SELECT id, name, role, pin_hash, created_date, active, failed_attempts, locked_until, gender, track_haidh, setup_complete
FROM students;

DROP TABLE students;

ALTER TABLE students_new RENAME TO students;

-- Bootstrap admin — seeded here (a versioned migration), not a manual
-- console edit, per the "no manual database changes" principle. No
-- pin_hash set: ABCDEFG goes through the same first-login flow as every
-- other account (whoever logs in first with pin 1234 sets it as the real PIN).
INSERT INTO students (id, name, role, created_date, active)
VALUES ('ABCDEFG', 'ADMIN-01', 'admin', '2026-07-25', 1);
