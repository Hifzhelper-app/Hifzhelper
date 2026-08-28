-- ============================================================
-- 0025_term_dates.sql — V3.80.0 (ADDITIVE, two lines).
-- The current term: the DEFAULT attendance period ("the easiest way to
-- set term dates" — user, 2026-08-28). Set on Maktab Settings' General
-- card. NULL = no term set: the attendance page falls back to the last
-- 4 weeks. Run in the D1 console BEFORE deploying the V3.80.0 worker.
-- ============================================================
ALTER TABLE maktab_settings ADD COLUMN term_from TEXT;
ALTER TABLE maktab_settings ADD COLUMN term_to TEXT;
