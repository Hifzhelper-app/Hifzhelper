-- Migration 0008: whatsapp_number column, for self-registration (V3.3.3)
-- and admin editing. Purpose is disambiguation between similarly-named
-- students, not identity verification — no uniqueness constraint, plain
-- nullable text, no format validation (numbers vary by country/format).

ALTER TABLE students ADD COLUMN whatsapp_number TEXT;
