-- V3.88.0: HOLIDAY DUPLICATES (user's screenshot, 2026-08-29). The
-- V3.87.0 loaders checked-then-inserted (TOCTOU): two quick presses
-- raced past the check, and the table had no unique constraint to stop
-- the second. Three-layer fix; this migration is layers 1 + 2:
-- 1) delete the existing duplicate rows, keeping the oldest of each
--    (type, date, label) group;
DELETE FROM maktab_calendar WHERE id NOT IN (
  SELECT MIN(id) FROM maktab_calendar
  GROUP BY type, date_from, date_to, COALESCE(label, '')
);
-- 2) a UNIQUE expression index so the database itself refuses repeats
--    forever (plain UNIQUE treats NULL labels as distinct, hence the
--    COALESCE).
CREATE UNIQUE INDEX idx_maktab_calendar_unique
  ON maktab_calendar (type, date_from, date_to, COALESCE(label, ''));
