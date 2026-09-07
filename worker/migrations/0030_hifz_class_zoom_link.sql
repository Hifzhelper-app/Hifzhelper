-- Hifzhelper V4.2.15.7 — shared Hifz class Zoom link.
-- Admin configures one class link in Maktab Settings. The authenticated
-- Maktab Journal and Personal Journal surface it in the top auth band.
-- Nullable so existing maktabs retain the exact current behaviour until
-- an admin explicitly supplies a link.

ALTER TABLE maktab_settings ADD COLUMN zoom_link TEXT;
