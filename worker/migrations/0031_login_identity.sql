-- Separate the sign-in alias from the journal's permanent profile key.
-- First preserve existing personal links; the reviewed Academy rekey is
-- a separate, atomic data operation (worker/tools/academy-identity.mjs).
ALTER TABLE students ADD COLUMN login_id TEXT;
ALTER TABLE students ADD COLUMN academy_managed INTEGER NOT NULL DEFAULT 0
  CHECK (academy_managed IN (0, 1));
UPDATE students SET login_id = id;
CREATE UNIQUE INDEX students_login_id ON students(login_id);

-- The cutover guard aborts the whole batch if a reviewed profile changed.
CREATE TABLE academy_identity_guards (
  guard_id TEXT PRIMARY KEY,
  accepted INTEGER NOT NULL CHECK (accepted = 1)
);
CREATE TABLE academy_identity_migrations (
  migration_id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL,
  environment TEXT NOT NULL,
  mapping_json TEXT NOT NULL
);

-- Historical/standalone registration remains compatible until Academy
-- provisioning replaces it. An omitted alias always starts as that row's ID.
CREATE TRIGGER students_initial_login_id AFTER INSERT ON students
WHEN NEW.login_id IS NULL
BEGIN
  UPDATE students SET login_id = NEW.id WHERE id = NEW.id;
END;
CREATE TRIGGER students_login_id_nonempty_insert BEFORE INSERT ON students
WHEN NEW.login_id IS NOT NULL AND length(trim(NEW.login_id)) = 0
BEGIN
  SELECT RAISE(ABORT, 'login_id must not be empty');
END;
CREATE TRIGGER students_login_id_nonempty_update BEFORE UPDATE OF login_id ON students
WHEN NEW.login_id IS NULL OR length(trim(NEW.login_id)) = 0
BEGIN
  SELECT RAISE(ABORT, 'login_id must not be empty');
END;
