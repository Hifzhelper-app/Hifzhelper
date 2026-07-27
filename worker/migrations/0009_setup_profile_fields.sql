-- V3.7.0: fields for the Setup screen's profile section. Gender/track_haidh/
-- setup_complete already existed (migration 0004) — these two are new.
ALTER TABLE students ADD COLUMN journal_name TEXT;
ALTER TABLE students ADD COLUMN mushaf TEXT CHECK (mushaf IN ('13line', '15line_madani'));
