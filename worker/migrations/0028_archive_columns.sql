-- V3.97.0 (l) THE ARCHIVE: her log tables gain the archive columns —
-- maktab_log_id links a copied row to its maktab original (and is the
-- exactness key for the union: a maktab row already copied is excluded
-- from the live read, so nothing ever shows twice); maktab_teacher is
-- the provenance snapshot so the copy still names its teacher after
-- maktab access is gone. The UNIQUE indexes make archiving idempotent
-- at the database (NULLs exempt, so personal rows are unaffected).
ALTER TABLE sabaq_log ADD COLUMN maktab_log_id INTEGER;
ALTER TABLE sabaq_log ADD COLUMN maktab_teacher TEXT;
ALTER TABLE sabaq_dhor_log ADD COLUMN maktab_log_id INTEGER;
ALTER TABLE sabaq_dhor_log ADD COLUMN maktab_teacher TEXT;
ALTER TABLE dhor_log ADD COLUMN maktab_log_id INTEGER;
ALTER TABLE dhor_log ADD COLUMN maktab_teacher TEXT;
CREATE UNIQUE INDEX idx_sabaq_log_mkid ON sabaq_log (maktab_log_id);
CREATE UNIQUE INDEX idx_sabaq_dhor_log_mkid ON sabaq_dhor_log (maktab_log_id);
CREATE UNIQUE INDEX idx_dhor_log_mkid ON dhor_log (maktab_log_id);
