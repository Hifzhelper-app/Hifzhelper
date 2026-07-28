-- V3.8.0: History baseline (Hifz Setup card, section 2) and default ring
-- targets (section 3). These are deliberately separate from `position`
-- (which holds DERIVED/computed state from actual dhor sessions) — the
-- baseline is a one-time, self-reported historical fact ("I'd already
-- memorised this before using the app"), not the same kind of data.
-- Deeper integration with position_json's activeJuz/studyOrder (for
-- whenever the rings feature is actually built) is a deliberate follow-up,
-- not attempted here — this migration only stores the raw baseline
-- correctly.
ALTER TABLE students ADD COLUMN baseline_mode TEXT CHECK (baseline_mode IN ('surah', 'juz'));
ALTER TABLE students ADD COLUMN baseline_selection TEXT; -- JSON array of numbers (surah 1-114, or juz' 1-30, per baseline_mode)

ALTER TABLE students ADD COLUMN target_mistakes_per_juz INTEGER NOT NULL DEFAULT 2;
ALTER TABLE students ADD COLUMN target_minutes_per_juz INTEGER NOT NULL DEFAULT 40;
ALTER TABLE students ADD COLUMN target_frequency_days INTEGER NOT NULL DEFAULT 30; -- "once/month" stored as a day-count, for later ring-recency math
