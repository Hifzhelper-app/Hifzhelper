-- Stable cross-application links survive a later reviewed students.id rekey.
CREATE TABLE academy_profile_links (
 academy_user_id TEXT PRIMARY KEY NOT NULL,
 student_id TEXT UNIQUE NOT NULL REFERENCES students(id),
 source_revision INTEGER NOT NULL DEFAULT 0 CHECK(source_revision>=0),
 pin_reset_version INTEGER NOT NULL DEFAULT 0 CHECK(pin_reset_version>=0)
);
-- Resetting a PIN revokes old Hifz sessions without sharing Academy credentials.
ALTER TABLE students ADD COLUMN credential_epoch INTEGER NOT NULL DEFAULT 0 CHECK(credential_epoch>=0);
