-- Migration 0011: Dhor rolling-schedule settings + Haidh prediction
-- settings, both additive (students gets 7 new columns, no table
-- rebuilds) — both belong to the same "Setup screen redesign" delivery
-- so are grouped in one migration rather than split needlessly.

-- Dhor schedule (Setup rows 9-11): what the rolling 7-day plan generator
-- (worker/src/dhorSchedule.js) reads to decide what to generate and when.
-- NULL across the board until the student actually saves this section —
-- generation is a no-op (clear error, not a silent guess) until it's set.
-- CHECK (col IN (...)) already permits NULL on its own here (same style
-- as migrations 0009/0010's mushaf/baseline_mode) — SQLite treats a NULL
-- IN (...) result as passing a CHECK, not failing it, so no separate
-- "IS NULL OR" clause is needed.
ALTER TABLE students ADD COLUMN dhor_granularity TEXT CHECK (dhor_granularity IN ('juz','half','quarter'));
ALTER TABLE students ADD COLUMN dhor_quantity INTEGER; -- how many of the above unit, per session
ALTER TABLE students ADD COLUMN dhor_frequency TEXT CHECK (dhor_frequency IN ('daily','twice'));
ALTER TABLE students ADD COLUMN dhor_days_of_week TEXT; -- JSON array, e.g. ["mon","wed","fri"]

-- Haidh prediction (Setup row 13): persisted purely so Setup can
-- redisplay the student's last-entered values — the actual prediction
-- logic is unchanged, existing `/attendance/predict` (worker/src/
-- attendance.js, live since migration 0001) still does the real work.
-- next_expected (not the endpoint's own `lastStart`) is what the
-- Setup row asks the student for directly; the frontend computes
-- lastStart = next_expected - cycle_length before calling that endpoint,
-- so the existing backend needed no changes at all for this.
ALTER TABLE students ADD COLUMN haidh_cycle_length INTEGER;
ALTER TABLE students ADD COLUMN haidh_period_length INTEGER;
ALTER TABLE students ADD COLUMN haidh_next_expected TEXT; -- YYYY-MM-DD
