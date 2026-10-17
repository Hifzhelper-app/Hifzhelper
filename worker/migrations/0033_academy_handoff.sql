-- Source epochs prevent an older delivery from replacing a newer credential.
ALTER TABLE academy_profile_links ADD COLUMN source_credential_epoch INTEGER NOT NULL DEFAULT 0 CHECK(source_credential_epoch>=0);
-- Only a digest of a short-lived, PKCE-bound, single-use sign-in code is stored.
CREATE TABLE academy_signin_tickets (
 code_hash TEXT PRIMARY KEY NOT NULL,
 student_id TEXT NOT NULL REFERENCES students(id),
 code_challenge TEXT NOT NULL,
 credential_epoch INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX academy_signin_tickets_expiry ON academy_signin_tickets(expires_at);
