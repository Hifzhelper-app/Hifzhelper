-- ============================================================
-- 0023_clear_tajweed_words.sql — V3.78.0, delivery 3 (DESTRUCTIVE).
-- Clears the old tajweed_tags WORD columns on all six log tables. The
-- only irreversible step in the delivery: after this, a word that matched
-- no tag in 0022's conversion is gone for good (user's call: dropped).
--
-- ⚠ DO NOT run with 0022. Run it ONLY after 0022 + the V3.78.0 deploy,
-- once converted tags have been seen on a real entry (open an old entry
-- with tags and check the picker shows them). Until it runs, the word
-- column sits untouched as the fallback record.
-- ============================================================
UPDATE sabaq_log             SET tajweed_tags = NULL WHERE tajweed_tags IS NOT NULL;
UPDATE sabaq_dhor_log        SET tajweed_tags = NULL WHERE tajweed_tags IS NOT NULL;
UPDATE dhor_log              SET tajweed_tags = NULL WHERE tajweed_tags IS NOT NULL;
UPDATE maktab_sabaq_log      SET tajweed_tags = NULL WHERE tajweed_tags IS NOT NULL;
UPDATE maktab_sabaq_dhor_log SET tajweed_tags = NULL WHERE tajweed_tags IS NOT NULL;
UPDATE maktab_dhor_log       SET tajweed_tags = NULL WHERE tajweed_tags IS NOT NULL;
