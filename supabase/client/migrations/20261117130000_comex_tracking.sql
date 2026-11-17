-- ADR-003 · Client DB — acompanhamento Siscomex (M18, Integra Comex consulta pública)
-- Mesmo SQL de db/neon/0003_comex_tracking.sql. Idempotente.

CREATE TABLE IF NOT EXISTS public.comex_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES public.comex_processes(id) ON DELETE CASCADE,
  doc_kind text NOT NULL CHECK (doc_kind IN ('ce','di','li','duimp')),
  doc_number text NOT NULL,                -- só dígitos (DUIMP: 25BR + 11 dígitos)
  remote_updated_at text,                  -- dataAtualizacao atual (sem fuso; horário de Brasília)
  previous_remote_updated_at text,         -- valor anterior
  version integer,                         -- versaoVigente (só DUIMP)
  found boolean NOT NULL DEFAULT false,    -- true depois que a API devolveu o número uma vez
  checked_at timestamptz,                  -- última verificação (nossa)
  changed_at timestamptz,                  -- quando detectamos a mudança (nossa)
  seen_at timestamptz,                     -- quando o operador marcou como visto
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (process_id, doc_kind, doc_number)
);
CREATE INDEX IF NOT EXISTS comex_tracking_kind_idx ON public.comex_tracking (doc_kind, doc_number);

ALTER TABLE public.comex_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comex_tracking_select ON public.comex_tracking;
CREATE POLICY comex_tracking_select ON public.comex_tracking
  FOR SELECT TO authenticated USING (public.is_client_member());
DROP POLICY IF EXISTS comex_tracking_write ON public.comex_tracking;
CREATE POLICY comex_tracking_write ON public.comex_tracking
  FOR ALL TO authenticated
  USING (COALESCE(auth.jwt()->'app_metadata'->>'role', '') IN ('client_admin','client_ops'))
  WITH CHECK (COALESCE(auth.jwt()->'app_metadata'->>'role', '') IN ('client_admin','client_ops'));
