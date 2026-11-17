-- M18 Comex · comex_field_defs passa a descrever também os cadastros de
-- cliente importador e despachante (formulários 100% metadado).
-- Idempotente: o PgComexStore.ensureReady roda o mesmo SQL a cada boot.

ALTER TABLE comex_field_defs ADD COLUMN IF NOT EXISTS ui_group text;

ALTER TABLE comex_field_defs DROP CONSTRAINT IF EXISTS comex_field_defs_entity_check;
ALTER TABLE comex_field_defs ADD CONSTRAINT comex_field_defs_entity_check
  CHECK (entity IN ('process','document','client','broker'));
