-- Migration 0016: V3.36, confirmed in chat -- Hybrid removed entirely
-- (never actually did anything distinct from 13line -- traced and
-- confirmed, its ref logic fell through to the same 'waterval' branch
-- 13line uses). Replaced with a real 15line_indopak mushaf option,
-- using its own verified page/line dataset (shared/data.js's
-- AYAH_LINE_INDOPAK) for Sabaq's Lines/Pages, not Madina's.
--
-- New indopak_terminology column: only meaningful when mushaf is
-- 15line_indopak, storing which Dhor/Sabaq Dhor terminology the student
-- picked -- quarter_half (13line convention) or maqra_rub_hizb (Madani
-- convention). Defaults to quarter_half. NULL for every other mushaf.
--
-- No stored students currently have mushaf = 'hybrid' (confirmed
-- inactive, no real users), but defensively migrating any that exist
-- to 13line rather than leaving a now-invalid value in place.
--
-- No inline trailing comments on any line below, on purpose -- that
-- exact pattern broke migration 0010's and 0011's runners before.
ALTER TABLE students ADD COLUMN indopak_terminology TEXT;
UPDATE students SET mushaf = '13line' WHERE mushaf = 'hybrid';
