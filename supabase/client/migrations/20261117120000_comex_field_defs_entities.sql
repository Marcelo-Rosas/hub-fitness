-- ADR-003 · Client DB — comex_field_defs para cadastros de cliente/despachante (M18)
-- Mesmo SQL de db/neon/0002_field_defs_entities.sql. Idempotente.

ALTER TABLE public.comex_field_defs ADD COLUMN IF NOT EXISTS ui_group text;

ALTER TABLE public.comex_field_defs DROP CONSTRAINT IF EXISTS comex_field_defs_entity_check;
ALTER TABLE public.comex_field_defs ADD CONSTRAINT comex_field_defs_entity_check
  CHECK (entity IN ('process','document','client','broker'));
