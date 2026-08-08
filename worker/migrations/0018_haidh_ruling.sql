-- Migration 0018: Haidh fiqh ruling (V3.39)
-- Which of the two supported rulings governs this student's max haidh
-- duration -- Hanafi (10 days) or Shafi'i (15 days). Defaults to 'hanafi'
-- so every existing and new row always has a concrete value (confirmed in
-- chat: not a required/blocking choice, defaults silently) -- application
-- code never needs a null-handling branch for this.
ALTER TABLE students ADD COLUMN haidh_ruling TEXT NOT NULL DEFAULT 'hanafi' CHECK (haidh_ruling IN ('hanafi','shafii'));
