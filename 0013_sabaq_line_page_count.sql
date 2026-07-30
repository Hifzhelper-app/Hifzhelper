-- Migration 0013: adds line_count and page_count to sabaq_log.
-- Computed client-side from ayah_from/ayah_to via getLines13ForAyahRange
-- or getLines15ForAyahRange (shared/data.js, built in V3.9.1/V3.9.4, not
-- wired into any UI until this delivery) depending on the student's
-- mushaf, then shown editable so the student can correct the estimate.
--
-- No inline trailing comments on any line below, on purpose — that exact
-- pattern broke migration 0010's and 0011's runners before.
ALTER TABLE sabaq_log ADD COLUMN line_count INTEGER;
ALTER TABLE sabaq_log ADD COLUMN page_count INTEGER;
