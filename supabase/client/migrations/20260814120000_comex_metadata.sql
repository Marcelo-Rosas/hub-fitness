-- ADR-003 · Client DB — Comex metadado (M18)
-- Campos de projeto vivem em comex_field_defs + payload/meta jsonb.
-- Sem colunas de negócio hardcoded. Sem tenant_id.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.comex_field_defs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity        text NOT NULL CHECK (entity IN ('process', 'document')),
  field_key     text NOT NULL,
  label         text NOT NULL,
  data_type     text NOT NULL
                CHECK (data_type IN ('text', 'number', 'date', 'enum', 'boolean', 'json')),
  required      boolean NOT NULL DEFAULT false,
  enum_options  jsonb NOT NULL DEFAULT '[]'::jsonb,
  widget        text NOT NULL DEFAULT 'text',
  ui_list       boolean NOT NULL DEFAULT false,
  ui_form       boolean NOT NULL DEFAULT true,
  consult_key   boolean NOT NULL DEFAULT false,
  kpi           text,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity, field_key)
);

CREATE TABLE IF NOT EXISTS public.comex_processes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  client_slug   text,
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comex_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id    uuid REFERENCES public.comex_processes(id) ON DELETE SET NULL,
  doc_type      text NOT NULL,
  file_name     text NOT NULL,
  file_path     text NOT NULL UNIQUE,
  size_bytes    bigint,
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comex_documents_process_idx
  ON public.comex_documents (process_id);
CREATE INDEX IF NOT EXISTS comex_documents_type_idx
  ON public.comex_documents (doc_type);

CREATE OR REPLACE FUNCTION public.touch_comex_process_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comex_processes_touch ON public.comex_processes;
CREATE TRIGGER comex_processes_touch
  BEFORE UPDATE ON public.comex_processes
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_comex_process_updated_at();

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['comex_field_defs', 'comex_processes', 'comex_documents']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_client_member())',
      t || '_select', t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (COALESCE(auth.jwt()->''app_metadata''->>''role'', '''') IN (''client_admin'',''client_ops''))
         WITH CHECK (COALESCE(auth.jwt()->''app_metadata''->>''role'', '''') IN (''client_admin'',''client_ops''))',
      t || '_write', t
    );
  END LOOP;
END $$;

SELECT public.assert_no_tenant_id();
