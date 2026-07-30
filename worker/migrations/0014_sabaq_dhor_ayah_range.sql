-- Migration 0014: adds structured from/to ayah fields to sabaq_dhor_log.
-- Replaces the free-text `zone` field as the actual saved range -- zone
-- was always meant to be computed automatically (see this table's own
-- code comment, unchanged since it was written), never built until this
-- delivery. `zone` itself is left in place, still nullable, no longer
-- written to by the frontend going forward.
--
-- No inline trailing comments on any line below, on purpose -- that exact
-- pattern broke migration 0010's and 0011's runners before.
ALTER TABLE sabaq_dhor_log ADD COLUMN from_surah INTEGER;
ALTER TABLE sabaq_dhor_log ADD COLUMN from_ayah INTEGER;
ALTER TABLE sabaq_dhor_log ADD COLUMN to_surah INTEGER;
ALTER TABLE sabaq_dhor_log ADD COLUMN to_ayah INTEGER;
