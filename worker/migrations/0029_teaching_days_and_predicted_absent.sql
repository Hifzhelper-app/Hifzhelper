-- V3.98.0 — the maktab Attendance screen.
--
-- 1) TEACHING DAYS (user's choice of the three column strategies): the
--    screen's columns can't come from derived "maktab days", because a
--    maktab day is derived from logging activity and no future date has
--    any. A configured weekday set drives the columns instead. Seeded
--    Mon-Thu (this maktab's pattern); the code falls back to the same
--    set when the column is NULL.
ALTER TABLE maktab_settings ADD COLUMN teaching_days TEXT;
UPDATE maktab_settings SET teaching_days = '["mon","tue","wed","thu"]' WHERE id = 1 AND teaching_days IS NULL;

-- 2) PREDICTED ABSENT: a student who has informed the maktab in advance.
--    attendance.status carries a CHECK constraint, and SQLite cannot
--    alter one in place — so the table is rebuilt, the 0007 pattern.
--    NOTE (user, 2026-08-31): informing the maktab is courtesy, not
--    excusal. 'predicted-absent' is a FORWARD-LOOKING planning marker
--    only; it never enters the attendance derivation or the stats, and
--    once its day passes the derivation governs as it always has.
CREATE TABLE attendance_new (
  student_id  TEXT NOT NULL REFERENCES students(id),
  date        TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('present','absent','haidh','predicted-haidh','predicted-absent')),
  PRIMARY KEY (student_id, date)
);
INSERT INTO attendance_new (student_id, date, status)
  SELECT student_id, date, status FROM attendance;
DROP TABLE attendance;
ALTER TABLE attendance_new RENAME TO attendance;
