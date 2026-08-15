-- ADR-003 · Operator DB core (HUB-FITNESS)
-- Sem tenant_id. Isolamento de consumidores = database-per-client.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Cadastro comercial (operador)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  legal_name      text NOT NULL,
  trade_name      text,
  document_cnpj   text,
  is_dogfood      boolean NOT NULL DEFAULT false,
  database_ref    text NOT NULL,
  fdw_schema      text,
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('provisioning', 'active', 'suspended', 'churned')),
  rack_budget_positions integer NOT NULL DEFAULT 0,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.clients IS
  'Consumidores 3PL. Konnen = cliente #0 dogfood (is_dogfood=true), não âncora comercial.';

CREATE TABLE IF NOT EXISTS public.contracts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  code            text NOT NULL,
  starts_on       date NOT NULL,
  ends_on         date,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'active', 'expired', 'cancelled')),
  currency        text NOT NULL DEFAULT 'BRL',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, code)
);

CREATE TABLE IF NOT EXISTS public.price_table_kinds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text
);

CREATE TABLE IF NOT EXISTS public.price_categories (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_table_kind_id uuid NOT NULL REFERENCES public.price_table_kinds(id),
  code                text NOT NULL,
  name                text NOT NULL,
  UNIQUE (price_table_kind_id, code)
);

CREATE TABLE IF NOT EXISTS public.price_category_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_category_id   uuid NOT NULL REFERENCES public.price_categories(id) ON DELETE CASCADE,
  sku_code            text,
  description         text NOT NULL,
  unit                text NOT NULL DEFAULT 'posição',
  unit_price_cents    integer NOT NULL CHECK (unit_price_cents >= 0),
  effective_from      date NOT NULL DEFAULT CURRENT_DATE,
  effective_to        date
);

CREATE TABLE IF NOT EXISTS public.tax_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  name            text NOT NULL,
  rate_bps        integer NOT NULL CHECK (rate_bps >= 0),
  notes           text
);

CREATE TABLE IF NOT EXISTS public.billing_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  period_ym           char(7) NOT NULL,
  source_event_count  integer NOT NULL DEFAULT 0,
  amount_cents        integer NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency            text NOT NULL DEFAULT 'BRL',
  status              text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'issued', 'paid', 'void')),
  computed_at         timestamptz NOT NULL DEFAULT now(),
  payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (client_id, period_ym)
);

COMMENT ON TABLE public.billing_records IS
  'Calculado no Operator a partir de eventos lidos (FDW/service_role) dos Client DBs. Nunca escrito no Client DB.';

CREATE TABLE IF NOT EXISTS public.operator_profiles (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  role        text NOT NULL DEFAULT 'operator_viewer'
              CHECK (role IN ('operator_admin', 'operator_billing', 'operator_viewer')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_swarm (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key   text NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'idle',
  last_run_at timestamptz,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    uuid,
  action      text NOT NULL,
  entity      text NOT NULL,
  entity_id   text,
  client_id   uuid REFERENCES public.clients(id),
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed: Konnen dogfood (#0) — não cliente-alvo comercial
INSERT INTO public.clients (slug, legal_name, trade_name, is_dogfood, database_ref, fdw_schema, rack_budget_positions, notes)
VALUES (
  'konnen',
  'Konnen Importadora (dogfood)',
  'Konnen',
  true,
  'hub-fitness-client-konnen',
  'fdw_konnen',
  2968,
  'Cliente #0 calibração. CAPEX R$ 207.300 / 2.968 posições são infraestrutura HUB-FITNESS, não âncora de BE.'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tax_rates (code, name, rate_bps, notes) VALUES
  ('DAS_ANEXO_III', 'DAS Simples Anexo III', 600, '6,00% — Fator R ≥ 28%'),
  ('AD_VALOREM', 'Ad Valorem sobre NF serviço', 10, '0,10% sobre NF de serviço, nunca CIF carga')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.price_table_kinds (code, name) VALUES
  ('STORAGE', 'Armazenagem / posição'),
  ('VAS', 'Value Added Services'),
  ('HANDLING', 'Movimentação / desova')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS (papéis operador — sem tenant)
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_table_kinds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_category_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_swarm ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_operator_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('operator_admin', 'operator_billing', 'operator_viewer'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_operator_writer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('operator_admin', 'operator_billing'),
    false
  );
$$;

DROP POLICY IF EXISTS clients_select_staff ON public.clients;
CREATE POLICY clients_select_staff ON public.clients
  FOR SELECT TO authenticated USING (public.is_operator_staff());

DROP POLICY IF EXISTS clients_write_admin ON public.clients;
CREATE POLICY clients_write_admin ON public.clients
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'operator_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'operator_admin');

DROP POLICY IF EXISTS contracts_staff ON public.contracts;
CREATE POLICY contracts_staff ON public.contracts
  FOR SELECT TO authenticated USING (public.is_operator_staff());

DROP POLICY IF EXISTS contracts_write ON public.contracts;
CREATE POLICY contracts_write ON public.contracts
  FOR ALL TO authenticated
  USING (public.is_operator_writer())
  WITH CHECK (public.is_operator_writer());

DROP POLICY IF EXISTS price_kinds_read ON public.price_table_kinds;
CREATE POLICY price_kinds_read ON public.price_table_kinds
  FOR SELECT TO authenticated USING (public.is_operator_staff());

DROP POLICY IF EXISTS price_cats_read ON public.price_categories;
CREATE POLICY price_cats_read ON public.price_categories
  FOR SELECT TO authenticated USING (public.is_operator_staff());

DROP POLICY IF EXISTS price_items_read ON public.price_category_items;
CREATE POLICY price_items_read ON public.price_category_items
  FOR SELECT TO authenticated USING (public.is_operator_staff());

DROP POLICY IF EXISTS tax_rates_read ON public.tax_rates;
CREATE POLICY tax_rates_read ON public.tax_rates
  FOR SELECT TO authenticated USING (public.is_operator_staff());

DROP POLICY IF EXISTS billing_staff ON public.billing_records;
CREATE POLICY billing_staff ON public.billing_records
  FOR SELECT TO authenticated USING (public.is_operator_staff());

DROP POLICY IF EXISTS billing_write ON public.billing_records;
CREATE POLICY billing_write ON public.billing_records
  FOR ALL TO authenticated
  USING (public.is_operator_writer())
  WITH CHECK (public.is_operator_writer());

DROP POLICY IF EXISTS profiles_self ON public.operator_profiles;
CREATE POLICY profiles_self ON public.operator_profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_operator_staff());

DROP POLICY IF EXISTS agent_read ON public.agent_swarm;
CREATE POLICY agent_read ON public.agent_swarm
  FOR SELECT TO authenticated USING (public.is_operator_staff());

DROP POLICY IF EXISTS audit_read ON public.audit_log;
CREATE POLICY audit_read ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_operator_staff());
