-- ADR-003 · Client DB schema (idempotent)
-- Um database = um consumidor. ZERO colunas/políticas de tenant multi-tenant.
-- Isolamento = database-level. RLS = papéis internos do cliente.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Guard: falha se alguém reintroduzir tenant_id neste DB
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_no_tenant_id()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'tenant_id';

  IF v_count > 0 THEN
    RAISE EXCEPTION 'ADR-003 violation: public.tenant_id columns found (%) — database-per-client forbids tenant_id', v_count;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Identidade do cliente (users deste DB)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_profiles (
  user_id     uuid PRIMARY KEY,
  full_name   text,
  role        text NOT NULL DEFAULT 'client_viewer'
              CHECK (role IN ('client_admin', 'client_ops', 'client_viewer')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Catálogo & estoque
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku             text NOT NULL UNIQUE,
  name            text NOT NULL,
  regime          text CHECK (regime IN ('alpha', 'beta', 'gamma', 'delta') OR regime IS NULL),
  length_mm       integer,
  width_mm        integer,
  height_mm       integer,
  weight_kg       numeric(12,3),
  stack_limit     integer,
  base_type       text CHECK (base_type IN ('skid', 'no_base') OR base_type IS NULL),
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id              bigserial PRIMARY KEY,
  product_id      uuid NOT NULL REFERENCES public.products(id),
  movement_type   text NOT NULL CHECK (movement_type IN ('in', 'out', 'adjust', 'damage')),
  qty             numeric(14,3) NOT NULL,
  ref_type        text,
  ref_id          uuid,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  notes           text
);

CREATE TABLE IF NOT EXISTS public.damage_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  severity    text NOT NULL DEFAULT 'medium'
);

CREATE TABLE IF NOT EXISTS public.item_damages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid REFERENCES public.products(id),
  damage_type_id  uuid NOT NULL REFERENCES public.damage_types(id),
  qty             numeric(14,3) NOT NULL DEFAULT 1,
  reported_at     timestamptz NOT NULL DEFAULT now(),
  notes           text
);

-- ---------------------------------------------------------------------------
-- Capacidade / alocação
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid REFERENCES public.products(id),
  positions       integer NOT NULL CHECK (positions > 0),
  status          text NOT NULL DEFAULT 'held'
                  CHECK (status IN ('held', 'committed', 'released', 'expired')),
  starts_at       timestamptz NOT NULL DEFAULT now(),
  ends_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.allocations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  uuid REFERENCES public.reservations(id),
  product_id      uuid REFERENCES public.products(id),
  positions       integer NOT NULL CHECK (positions > 0),
  location_code   text,
  allocated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.committed_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_ref    text,
  positions       integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'open',
  committed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inbound_divergences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committed_order_id uuid REFERENCES public.committed_orders(id),
  expected_qty    numeric(14,3),
  received_qty    numeric(14,3),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supply_events (
  id              bigserial PRIMARY KEY,
  event_type      text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Pedidos / comercial / expedição
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    text NOT NULL UNIQUE,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'confirmed', 'picking', 'shipped', 'cancelled')),
  ordered_at      timestamptz NOT NULL DEFAULT now(),
  ship_by         date,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.order_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id      uuid REFERENCES public.products(id),
  sku             text NOT NULL,
  qty             numeric(14,3) NOT NULL CHECK (qty > 0),
  unit_price_cents integer
);

CREATE TABLE IF NOT EXISTS public.order_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount_cents    integer NOT NULL CHECK (amount_cents >= 0),
  method          text,
  paid_at         timestamptz,
  status          text NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS public.packages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid REFERENCES public.orders(id),
  tracking_code   text,
  weight_kg       numeric(12,3),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.commercial_invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  text NOT NULL UNIQUE,
  issued_at       date NOT NULL DEFAULT CURRENT_DATE,
  currency        text NOT NULL DEFAULT 'USD',
  total_cents     bigint NOT NULL DEFAULT 0,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.commercial_invoice_containers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_invoice_id uuid NOT NULL REFERENCES public.commercial_invoices(id) ON DELETE CASCADE,
  container_code  text NOT NULL,
  feu_factor      numeric(6,2) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.commercial_invoice_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_invoice_id uuid NOT NULL REFERENCES public.commercial_invoices(id) ON DELETE CASCADE,
  container_id    uuid REFERENCES public.commercial_invoice_containers(id),
  sku             text NOT NULL,
  description     text,
  qty             numeric(14,3) NOT NULL,
  unit_value_cents bigint
);

CREATE TABLE IF NOT EXISTS public.shipping_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid REFERENCES public.orders(id),
  doc_type        text NOT NULL,
  doc_number      text,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.label_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  name            text NOT NULL,
  body            text NOT NULL,
  active          boolean NOT NULL DEFAULT true
);

-- ---------------------------------------------------------------------------
-- RLS intra-cliente (sem tenant)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'client_profiles','products','stock_movements','damage_types','item_damages',
    'reservations','allocations','committed_orders','inbound_divergences','supply_events',
    'orders','order_lines','order_payments','packages',
    'commercial_invoices','commercial_invoice_containers','commercial_invoice_items',
    'shipping_documents','label_templates'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.is_client_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'service_role'
    OR auth.uid() IS NOT NULL;
$$;

-- Políticas genéricas: membros autenticados deste DB leem; writers conforme role
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products','stock_movements','damage_types','item_damages',
    'reservations','allocations','committed_orders','inbound_divergences','supply_events',
    'orders','order_lines','order_payments','packages',
    'commercial_invoices','commercial_invoice_containers','commercial_invoice_items',
    'shipping_documents','label_templates'
  ]
  LOOP
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

DROP POLICY IF EXISTS client_profiles_self ON public.client_profiles;
CREATE POLICY client_profiles_self ON public.client_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_client_member());

-- service_role bypassa RLS por padrão no Supabase — Operator agrega só com SELECT via FDW/user read-only.

SELECT public.assert_no_tenant_id();
