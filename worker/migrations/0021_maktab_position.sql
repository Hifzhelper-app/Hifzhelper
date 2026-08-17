-- Migration 0021: Maktab position (V3.66.0 — maktab delivery (h)).
-- Mirrors the PJ `position` table exactly (migration 0001), for the same
-- reason the three maktab log tables mirror their PJ counterparts: the
-- PJ's OWN computation functions then read it unchanged. User, 2026-08-16:
-- "sabaq dhor needs to copy the logic from the PJ" -- and that logic is
-- entirely position-driven (previousJuz gives the lingering rows,
-- sabaqDhorRollup the display granularity, and the pool says what has
-- already moved to Dhor).
--
-- V3.64.0 disabled position in maktab mode because /position is
-- auth-token-keyed: calling it would have read, and savePosition would
-- have OVERWRITTEN, the TEACHER's own row while they logged a student.
-- This table is what lets those calls be re-enabled safely.
--
-- The Dhor POOL lives in position_json here, NOT in
-- students.baseline_selection. That is the whole point: the maktab sets
-- its own pool (via the student setup screen, marking completed ajzaa),
-- so it never becomes a fourth PJ input, and a student's own PJ pool is
-- left untouched. See the three-inputs rule in the maktab design entry.
--
-- Apply ONE STATEMENT AT A TIME in the D1 console. Run on
-- hifzhelper-maktab1 ONLY. Purely additive.

CREATE TABLE maktab_position (
  student_id TEXT PRIMARY KEY REFERENCES students(id),
  position_json TEXT,
  last_dhor_json TEXT,
  updated_at TEXT
);
