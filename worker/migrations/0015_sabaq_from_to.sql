-- Migration 0015: replaces sabaq_log's surah/ayah_from/ayah_to trio with
-- sabaq_from/sabaq_to -- each a combined "surah:ayah" text string (e.g.
-- "114:6"). A sabaq entry can now span multiple surahs directly (from and
-- to can name different surahs), which the old trio (one surah column
-- shared by both ayah numbers) couldn't represent at all. Explicitly
-- dropping the old columns and their code, not leaving them deprecated in
-- place (different from sabaq_dhor_log's zone precedent -- confirmed in
-- chat this one should be a clean removal).
--
-- No inline trailing comments on any line below, on purpose -- that exact
-- pattern broke migration 0010's and 0011's runners before.
ALTER TABLE sabaq_log ADD COLUMN sabaq_from TEXT;
ALTER TABLE sabaq_log ADD COLUMN sabaq_to TEXT;
ALTER TABLE sabaq_log DROP COLUMN surah;
ALTER TABLE sabaq_log DROP COLUMN ayah_from;
ALTER TABLE sabaq_log DROP COLUMN ayah_to;
