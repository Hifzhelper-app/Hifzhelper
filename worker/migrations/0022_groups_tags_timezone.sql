-- ============================================================
-- 0022_groups_tags_timezone.sql — V3.78.0, delivery 3 (ADDITIVE ONLY).
-- Groups, tajweed tags as ID-referenced rows, and the maktab timezone.
-- The DESTRUCTIVE step — clearing the old tajweed_tags word columns — is
-- deliberately NOT here: it is 0023, to be run only after converted tags
-- have been seen on a real entry (user's call, 2026-08-27).
--
-- Run in the D1 console BEFORE deploying the V3.78.0 worker.
-- ============================================================

-- ---------- tajweed tags: an admin-managed list, referenced by ID ----------
-- Rename propagates because entries hold the id; retire replaces delete so
-- a tag on historical entries never dangles.
CREATE TABLE tajweed_tags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  major       INTEGER NOT NULL DEFAULT 0,   -- 1 = major (blocks the mistakes ring closing)
  retired     INTEGER NOT NULL DEFAULT 0,   -- 1 = not offered for new entries; old entries keep showing it
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed with the eleven defaults the picker has always offered
-- (shared/data.js TAJWEED_DEFAULTS, same names, same major flags). Seeded
-- FIRST so the conversion below can join on them.
INSERT INTO tajweed_tags (name, major) VALUES
  ('Substitution', 1),
  ('Omission', 1),
  ('Addition', 1),
  ('Ghunnah', 0),
  ('Qalqalah', 0),
  ('Madd', 0),
  ('Idgham', 0),
  ('Ikhfa', 0),
  ('Noon Sakinah', 0),
  ('Meem Sakinah', 0),
  ('Waqf', 0);

-- The new ID column on all six log tables. CSV of tajweed_tags.id values,
-- same shape the word column had, so every read/write path changes one
-- field name. The old tajweed_tags word column stays untouched until 0023.
ALTER TABLE sabaq_log            ADD COLUMN tajweed_tag_ids TEXT;
ALTER TABLE sabaq_dhor_log       ADD COLUMN tajweed_tag_ids TEXT;
ALTER TABLE dhor_log             ADD COLUMN tajweed_tag_ids TEXT;
ALTER TABLE maktab_sabaq_log     ADD COLUMN tajweed_tag_ids TEXT;
ALTER TABLE maktab_sabaq_dhor_log ADD COLUMN tajweed_tag_ids TEXT;
ALTER TABLE maktab_dhor_log      ADD COLUMN tajweed_tag_ids TEXT;

-- ---------- one-way conversion: words -> ids ----------
-- Splits each row's CSV of words, joins each word (trimmed) to the seeded
-- tag names, and writes back a CSV of ids in the words' original order.
-- A word matching NO tag is DROPPED (user's call, 2026-08-27) — custom
-- browser-stored tags are not imported and their words go with them.
-- Rows with no tags get NULL, not an empty string.

WITH RECURSIVE split(id, word, rest) AS (
  SELECT id, '', tajweed_tags || ',' FROM sabaq_log WHERE tajweed_tags IS NOT NULL AND tajweed_tags != ''
  UNION ALL
  SELECT id, trim(substr(rest, 1, instr(rest, ',') - 1)), substr(rest, instr(rest, ',') + 1)
  FROM split WHERE rest != ''
),
mapped AS (
  SELECT s.id AS row_id, t.id AS tag_id
  FROM split s JOIN tajweed_tags t ON t.name = s.word
  WHERE s.word != ''
),
agg AS (SELECT row_id, group_concat(tag_id) AS ids FROM mapped GROUP BY row_id)
UPDATE sabaq_log SET tajweed_tag_ids = (SELECT ids FROM agg WHERE agg.row_id = sabaq_log.id)
WHERE id IN (SELECT row_id FROM agg);

WITH RECURSIVE split(id, word, rest) AS (
  SELECT id, '', tajweed_tags || ',' FROM sabaq_dhor_log WHERE tajweed_tags IS NOT NULL AND tajweed_tags != ''
  UNION ALL
  SELECT id, trim(substr(rest, 1, instr(rest, ',') - 1)), substr(rest, instr(rest, ',') + 1)
  FROM split WHERE rest != ''
),
mapped AS (
  SELECT s.id AS row_id, t.id AS tag_id
  FROM split s JOIN tajweed_tags t ON t.name = s.word
  WHERE s.word != ''
),
agg AS (SELECT row_id, group_concat(tag_id) AS ids FROM mapped GROUP BY row_id)
UPDATE sabaq_dhor_log SET tajweed_tag_ids = (SELECT ids FROM agg WHERE agg.row_id = sabaq_dhor_log.id)
WHERE id IN (SELECT row_id FROM agg);

WITH RECURSIVE split(id, word, rest) AS (
  SELECT id, '', tajweed_tags || ',' FROM dhor_log WHERE tajweed_tags IS NOT NULL AND tajweed_tags != ''
  UNION ALL
  SELECT id, trim(substr(rest, 1, instr(rest, ',') - 1)), substr(rest, instr(rest, ',') + 1)
  FROM split WHERE rest != ''
),
mapped AS (
  SELECT s.id AS row_id, t.id AS tag_id
  FROM split s JOIN tajweed_tags t ON t.name = s.word
  WHERE s.word != ''
),
agg AS (SELECT row_id, group_concat(tag_id) AS ids FROM mapped GROUP BY row_id)
UPDATE dhor_log SET tajweed_tag_ids = (SELECT ids FROM agg WHERE agg.row_id = dhor_log.id)
WHERE id IN (SELECT row_id FROM agg);

WITH RECURSIVE split(id, word, rest) AS (
  SELECT id, '', tajweed_tags || ',' FROM maktab_sabaq_log WHERE tajweed_tags IS NOT NULL AND tajweed_tags != ''
  UNION ALL
  SELECT id, trim(substr(rest, 1, instr(rest, ',') - 1)), substr(rest, instr(rest, ',') + 1)
  FROM split WHERE rest != ''
),
mapped AS (
  SELECT s.id AS row_id, t.id AS tag_id
  FROM split s JOIN tajweed_tags t ON t.name = s.word
  WHERE s.word != ''
),
agg AS (SELECT row_id, group_concat(tag_id) AS ids FROM mapped GROUP BY row_id)
UPDATE maktab_sabaq_log SET tajweed_tag_ids = (SELECT ids FROM agg WHERE agg.row_id = maktab_sabaq_log.id)
WHERE id IN (SELECT row_id FROM agg);

WITH RECURSIVE split(id, word, rest) AS (
  SELECT id, '', tajweed_tags || ',' FROM maktab_sabaq_dhor_log WHERE tajweed_tags IS NOT NULL AND tajweed_tags != ''
  UNION ALL
  SELECT id, trim(substr(rest, 1, instr(rest, ',') - 1)), substr(rest, instr(rest, ',') + 1)
  FROM split WHERE rest != ''
),
mapped AS (
  SELECT s.id AS row_id, t.id AS tag_id
  FROM split s JOIN tajweed_tags t ON t.name = s.word
  WHERE s.word != ''
),
agg AS (SELECT row_id, group_concat(tag_id) AS ids FROM mapped GROUP BY row_id)
UPDATE maktab_sabaq_dhor_log SET tajweed_tag_ids = (SELECT ids FROM agg WHERE agg.row_id = maktab_sabaq_dhor_log.id)
WHERE id IN (SELECT row_id FROM agg);

WITH RECURSIVE split(id, word, rest) AS (
  SELECT id, '', tajweed_tags || ',' FROM maktab_dhor_log WHERE tajweed_tags IS NOT NULL AND tajweed_tags != ''
  UNION ALL
  SELECT id, trim(substr(rest, 1, instr(rest, ',') - 1)), substr(rest, instr(rest, ',') + 1)
  FROM split WHERE rest != ''
),
mapped AS (
  SELECT s.id AS row_id, t.id AS tag_id
  FROM split s JOIN tajweed_tags t ON t.name = s.word
  WHERE s.word != ''
),
agg AS (SELECT row_id, group_concat(tag_id) AS ids FROM mapped GROUP BY row_id)
UPDATE maktab_dhor_log SET tajweed_tag_ids = (SELECT ids FROM agg WHERE agg.row_id = maktab_dhor_log.id)
WHERE id IN (SELECT row_id FROM agg);

-- ---------- groups: same shape as tags, one per student ----------
-- Names live in Maktab Settings; assignment on the student's admin card;
-- one group per student = a column, not a join table (user, 2026-08-26).
-- Retire, not delete: a retired group's students keep pointing at a row
-- that still has a name.
CREATE TABLE maktab_groups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  retired     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE students ADD COLUMN group_id INTEGER REFERENCES maktab_groups(id);

-- ---------- the maktab timezone ----------
-- Fifth setting (decided 2026-08-17). Everyone sees maktab time (user,
-- 2026-08-27). NULL = not set: today's device/UTC behaviour continues
-- until the admin picks a zone, rather than this migration guessing one.
ALTER TABLE maktab_settings ADD COLUMN timezone TEXT;
