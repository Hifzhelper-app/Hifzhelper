-- ============================================================
-- 0024_group_descriptions.sql — V3.79.0 (ADDITIVE, one line).
-- The group description: info-only, shown on the Groups card of Maktab
-- Settings and NOWHERE else (user, 2026-08-28). NULL = none.
-- Run in the D1 console BEFORE deploying the V3.79.0 worker.
-- ============================================================
ALTER TABLE maktab_groups ADD COLUMN description TEXT;
