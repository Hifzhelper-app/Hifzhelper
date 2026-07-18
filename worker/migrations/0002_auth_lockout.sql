-- Migration 0002: login lockout tracking
-- Needed for the login rate-limiting discussed earlier (5 wrong PINs -> temporary
-- lockout) but not yet reflected in schema.sql / SCHEMA.md. Flagging this as a
-- new addition, not something silently folded into the original schema.

ALTER TABLE students ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN locked_until TEXT;  -- ISO timestamp; NULL = not locked
