-- ADR-003 · Client DB — Comex clientes e despachantes (M18 · Radar/Representação)
-- Cadastro de clientes (importadores) com habilitação no Radar e representação
-- por procuração; despachantes. processo ganha cliente_id (NULL p/ legados).
-- Sem tenant_id.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.comex_brokers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  cpf                 text,
  rfb_registry        text,
  email               text,
  phone               text,
  certificate_status  text NOT NULL DEFAULT 'pendente',   -- sem PFX nesta fase
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comex_clients (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj_root          text NOT NULL,                       -- 8 dígitos
  cnpj               text,                                -- 14 dígitos, opcional
  legal_name         text NOT NULL,
  trade_name         text,
  slug               text NOT NULL,                       -- compat. com comex_processes.client_slug
  radar_status       text,                                -- habilitada | suspensa | desabilitada | nao_habilitada
  radar_modality     text CHECK (radar_modality IS NULL
                       OR radar_modality IN ('expressa', 'limitada_50k', 'limitada_150k', 'ilimitada')),
  radar_limit_usd    numeric,                             -- derivado da modalidade, editável
  radar_operations   text,                                -- ex.: IMPORTADOR/EXPORTADOR
  radar_legal_basis  text,
  radar_checked_at   date,                                -- quando foi conferido no Portal
  rep_status         text NOT NULL DEFAULT 'pendente'
                       CHECK (rep_status IN ('pendente', 'ativa', 'vencida', 'revogada')),
  rep_certificate    text,                                -- quem nos representa
  rep_role_type      text,                                -- Role-Type usado no Portal
  rep_valid_from     date,
  rep_valid_to       date,
  broker_id          uuid REFERENCES public.comex_brokers(id) ON DELETE RESTRICT,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comex_clients_cnpj_root_key UNIQUE (cnpj_root),
  CONSTRAINT comex_clients_slug_key UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS comex_clients_broker_idx
  ON public.comex_clients (broker_id);

ALTER TABLE public.comex_processes
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.comex_clients(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS comex_processes_cliente_idx
  ON public.comex_processes (cliente_id);

CREATE OR REPLACE FUNCTION public.touch_comex_registry_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comex_clients_touch ON public.comex_clients;
CREATE TRIGGER comex_clients_touch
  BEFORE UPDATE ON public.comex_clients
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_comex_registry_updated_at();

DROP TRIGGER IF EXISTS comex_brokers_touch ON public.comex_brokers;
CREATE TRIGGER comex_brokers_touch
  BEFORE UPDATE ON public.comex_brokers
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_comex_registry_updated_at();

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['comex_clients', 'comex_brokers']
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
