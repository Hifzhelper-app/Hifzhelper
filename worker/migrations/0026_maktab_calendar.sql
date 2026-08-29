-- V3.87.0: the MAKTAB CALENDAR (user spec, 2026-08-28).
-- Terms: MULTIPLE named terms replace the single General pair and DRIVE
-- ATTENDANCE (the default period is the term containing today). The old
-- maktab_settings.term_from/term_to columns stay in place (SQLite drops
-- need a rebuild) but are no longer read; the existing pair is migrated
-- in as a first term so nothing is lost.
CREATE TABLE maktab_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  term_from TEXT NOT NULL,
  term_to TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO maktab_terms (name, term_from, term_to)
  SELECT 'Term 1', term_from, term_to FROM maktab_settings
  WHERE term_from IS NOT NULL AND term_to IS NOT NULL;

-- Calendar entries: INFORMATION ONLY (no attendance coupling). Islamic
-- significant days (pre-loaded predictions, adjustable after actual moon
-- sightings) and public holidays (dates only — label stays NULL for
-- holidays per the user).
CREATE TABLE maktab_calendar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  label TEXT,
  type TEXT NOT NULL CHECK (type IN ('islamic', 'holiday')),
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_maktab_calendar_dates ON maktab_calendar (date_from, date_to);
