-- Migration 0020: Maktab settings (V3.65.0 — maktab delivery (g)).
-- Four settings for THIS maktab, confirmed in chat 2026-08-16:
--   mushaf          — ONE mushaf; every student in the maktab follows it.
--                     Retires MAKTAB_MUSHAF_INTERIM in js/logContext.js.
--   maktab_day_min  — a date is a "maktab day" once this many DISTINCT
--                     students have any maktab log. Was going to be a
--                     worker env var; moved here so it changes without a
--                     redeploy.
--   absence_flag_days — consecutive maktab days with no log before a
--                     student is flagged for teacher attention. Same
--                     reasoning; the user called 30 "arbitrary, subject
--                     to change", which is the argument for a setting.
--   name            — the maktab's name, shown in the summary header.
--
-- ONE ROW, not a key/value table: these are four known, differently-
-- typed settings for one maktab (one D1 per maktab, standing
-- architecture), so key/value would buy nothing but casting and
-- absent-row handling at every read. The CHECK pins it to a single row
-- so a second one can't be inserted by accident, and the INSERT below
-- means the row ALWAYS exists — application code never needs a "not
-- configured yet" branch, the same reasoning migration 0018 used for
-- haidh_ruling's NOT NULL DEFAULT.
--
-- Defaults: 13line is the user's stated interim mushaf; 3 and 30 are the
-- numbers already agreed in the maktab design.
--
-- Apply ONE STATEMENT AT A TIME in the D1 console (the console only
-- executes the first statement of a multi-statement paste — the
-- migration 0003 saga). Run on hifzhelper-maktab1 ONLY: the personal
-- deployment stopped at V3.56.0 and never gets maktab tables.
-- Purely additive; nothing reads this until (g)'s worker code deploys.

CREATE TABLE maktab_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mushaf TEXT NOT NULL DEFAULT '13line' CHECK (mushaf IN ('13line','15line_madani')),
  maktab_day_min INTEGER NOT NULL DEFAULT 3 CHECK (maktab_day_min >= 1),
  absence_flag_days INTEGER NOT NULL DEFAULT 30 CHECK (absence_flag_days >= 1),
  name TEXT NOT NULL DEFAULT '',
  updated_at TEXT
);

INSERT INTO maktab_settings (id) VALUES (1);
