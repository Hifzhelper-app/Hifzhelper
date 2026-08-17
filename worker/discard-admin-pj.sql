-- ============================================================
-- discard-admin-pj.sql — one-time data cleanup, NOT a migration.
--
-- Purpose: the admin account becomes the maktab teacher and keeps NO
-- personal journal (decided 2026-08-17). This removes its PJ data and
-- nothing else. Its row in `students` STAYS, and so does its role — it
-- still has to register users and change maktab settings. Losing its
-- history and losing its rights are different things.
--
-- WHY THIS IS NOT A MIGRATION FILE. Migrations here are numbered schema
-- files, and a delivered one is not necessarily a run one (that gap caused
-- a real login outage before). A one-off deletion of one account's rows is
-- data, not schema: it should be run deliberately, once, with eyes on the
-- output — not left sitting in worker/migrations/ where it might be run
-- twice, or never, or against the wrong database.
--
-- WHERE: the D1 console for hifzhelper-maktab1 ONLY. Not the personal
-- deployment, which diverged at V3.56 and has its own admin row.
--
-- WHEN: AFTER V3.68.0 and V3.69.0 are deployed and confirmed working.
-- Before (i) shipped, maktab mode read the TEACHER's own pool and profile;
-- if any of that is still live, deleting this account's baseline_selection
-- and position changes maktab behaviour and the cause will be misread as a
-- new bug. Deploy first, confirm, then run this.
--
-- IRREVERSIBLE. There is no undo and no backup step here. Run STEP 1 and
-- read it before running anything else.
-- ============================================================

-- ------------------------------------------------------------
-- STEP 0 — find the id. Do NOT guess it.
-- The repo calls this account "ADMIN-01" in prose only; that is a label,
-- never a literal id (ids are random codes like K7M2QX). Run this and take
-- the id from the output.
-- ------------------------------------------------------------
SELECT id, name, role, active FROM students WHERE role = 'admin';


-- ------------------------------------------------------------
-- STEP 1 — DRY RUN. Substitute the id below, run this whole block, and
-- read every number before going further. This is the blast radius.
-- If any count looks wrong — especially if sabaq/dhor counts are larger
-- than you expect — STOP: you may have the wrong id.
-- ------------------------------------------------------------
SELECT 'sabaq_log'      AS tbl, COUNT(*) AS rows_to_delete FROM sabaq_log      WHERE student_id = 'PUT_ADMIN_ID_HERE'
UNION ALL SELECT 'sabaq_dhor_log', COUNT(*) FROM sabaq_dhor_log WHERE student_id = 'PUT_ADMIN_ID_HERE'
UNION ALL SELECT 'dhor_log',       COUNT(*) FROM dhor_log       WHERE student_id = 'PUT_ADMIN_ID_HERE'
UNION ALL SELECT 'reflections',    COUNT(*) FROM reflections    WHERE student_id = 'PUT_ADMIN_ID_HERE'
UNION ALL SELECT 'attendance',     COUNT(*) FROM attendance     WHERE student_id = 'PUT_ADMIN_ID_HERE'
UNION ALL SELECT 'plans',          COUNT(*) FROM plans          WHERE student_id = 'PUT_ADMIN_ID_HERE'
UNION ALL SELECT 'position',       COUNT(*) FROM position       WHERE student_id = 'PUT_ADMIN_ID_HERE';
-- D1 rejects very long UNION ALL chains (~8 terms) — this is 7, deliberately.


-- ------------------------------------------------------------
-- STEP 2 — the deletion. Run one statement at a time in the D1 console,
-- same discipline as the migrations.
--
-- NOTE `plans`: this was missing from the table list quoted in TODO.md and
-- is included here. It is the PJ's upcoming-plans queue (still live for
-- Sabaq and Sabaq Dhor; Dhor moved to the pure-queue model). Leaving it
-- would strand orphan plan rows pointing at deleted logs.
--
-- NOT touched, deliberately:
--   students            — the account itself stays, with its role
--   maktab_*            — maktab data belongs to the maktab, not to this
--                         account's personal journal
--   maktab_position     — the maktab pool, keyed per STUDENT; the admin
--                         has no maktab_position row of its own to lose
-- ------------------------------------------------------------
DELETE FROM sabaq_log      WHERE student_id = 'PUT_ADMIN_ID_HERE';
DELETE FROM sabaq_dhor_log WHERE student_id = 'PUT_ADMIN_ID_HERE';
DELETE FROM dhor_log       WHERE student_id = 'PUT_ADMIN_ID_HERE';
DELETE FROM reflections    WHERE student_id = 'PUT_ADMIN_ID_HERE';
DELETE FROM attendance     WHERE student_id = 'PUT_ADMIN_ID_HERE';
DELETE FROM plans          WHERE student_id = 'PUT_ADMIN_ID_HERE';
DELETE FROM position       WHERE student_id = 'PUT_ADMIN_ID_HERE';

-- The profile-level PJ state on the students row itself. Everything here
-- is personal-journal data; nothing here is a permission or an identity.
-- `mushaf` is included because the maktab reads its OWN mushaf from
-- maktab_settings (V3.65.0), so the admin's personal one is now unused —
-- and this also clears the known-wrong stored position and the stray
-- haidh mark that have been flagged in TODO.md for weeks.
UPDATE students SET
  baseline_selection     = NULL,
  setup_complete         = 0,
  journal_name           = NULL,
  mushaf                 = NULL,
  track_haidh            = 0,
  dhor_granularity       = NULL,
  dhor_quantity          = NULL,
  dhor_frequency         = NULL,
  dhor_days_of_week      = NULL,
  haidh_cycle_length     = NULL,
  haidh_period_length    = NULL,
  haidh_next_expected    = NULL,
  haidh_ruling           = NULL
WHERE id = 'PUT_ADMIN_ID_HERE';
-- NOT cleared on this row: id, name, role, pin_hash, created_date, active,
-- failed_attempts, locked_until, gender, target_* (harmless defaults).
-- Clearing pin_hash would lock you out until a first-login PIN reset.


-- ------------------------------------------------------------
-- STEP 3 — verify. Every count must be 0, and the account must still be
-- there with role 'admin' and active = 1. If the last row is missing or
-- its role changed, something went wrong — do not log out until it reads
-- correctly, or you may not be able to get back in.
-- ------------------------------------------------------------
SELECT 'sabaq_log'      AS tbl, COUNT(*) AS remaining FROM sabaq_log      WHERE student_id = 'PUT_ADMIN_ID_HERE'
UNION ALL SELECT 'sabaq_dhor_log', COUNT(*) FROM sabaq_dhor_log WHERE student_id = 'PUT_ADMIN_ID_HERE'
UNION ALL SELECT 'dhor_log',       COUNT(*) FROM dhor_log       WHERE student_id = 'PUT_ADMIN_ID_HERE'
UNION ALL SELECT 'reflections',    COUNT(*) FROM reflections    WHERE student_id = 'PUT_ADMIN_ID_HERE'
UNION ALL SELECT 'attendance',     COUNT(*) FROM attendance     WHERE student_id = 'PUT_ADMIN_ID_HERE'
UNION ALL SELECT 'plans',          COUNT(*) FROM plans          WHERE student_id = 'PUT_ADMIN_ID_HERE'
UNION ALL SELECT 'position',       COUNT(*) FROM position       WHERE student_id = 'PUT_ADMIN_ID_HERE';

SELECT id, name, role, active FROM students WHERE id = 'PUT_ADMIN_ID_HERE';
