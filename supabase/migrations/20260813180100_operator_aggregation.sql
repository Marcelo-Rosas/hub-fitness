-- ADR-003 · Operator aggregation (FDW read-only + rollups)
-- Operator NUNCA escreve em Client DB.

CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- Servidor FDW genérico (reapontado por cliente via register_client_fdw)
-- Credenciais reais ficam em secrets / ALTER USER MAPPING — nunca no repo.

CREATE OR REPLACE FUNCTION public.register_client_fdw(
  p_client_slug text,
  p_host text,
  p_port integer,
  p_dbname text,
  p_fdw_user text,
  p_fdw_password text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_server text := 'fdw_srv_' || regexp_replace(p_client_slug, '[^a-z0-9_]', '_', 'g');
  v_schema text := 'fdw_' || regexp_replace(p_client_slug, '[^a-z0-9_]', '_', 'g');
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clients c WHERE c.slug = p_client_slug
  ) THEN
    RAISE EXCEPTION 'client slug % not found in operator.clients', p_client_slug;
  END IF;

  EXECUTE format(
    'CREATE SERVER IF NOT EXISTS %I FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host %L, port %L, dbname %L)',
    v_server, p_host, p_port::text, p_dbname
  );

  EXECUTE format(
    'CREATE USER MAPPING IF NOT EXISTS FOR CURRENT_USER SERVER %I OPTIONS (user %L, password %L)',
    v_server, p_fdw_user, p_fdw_password
  );

  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema);

  -- Import mínimo somente-leitura (capacidade + billing inputs)
  EXECUTE format('DROP FOREIGN TABLE IF EXISTS %I.reservations CASCADE', v_schema);
  EXECUTE format('DROP FOREIGN TABLE IF EXISTS %I.allocations CASCADE', v_schema);
  EXECUTE format('DROP FOREIGN TABLE IF EXISTS %I.orders CASCADE', v_schema);
  EXECUTE format('DROP FOREIGN TABLE IF EXISTS %I.supply_events CASCADE', v_schema);

  EXECUTE format(
    'IMPORT FOREIGN SCHEMA public LIMIT TO (reservations, allocations, orders, supply_events)
     FROM SERVER %I INTO %I',
    v_server, v_schema
  );

  -- Revoga escrita no schema FDW (defesa em profundidade)
  EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA %I FROM PUBLIC', v_schema);
  EXECUTE format(
    'GRANT SELECT ON ALL TABLES IN SCHEMA %I TO authenticated, service_role',
    v_schema
  );

  UPDATE public.clients
     SET fdw_schema = v_schema,
         database_ref = p_dbname,
         updated_at = now()
   WHERE slug = p_client_slug;

  RETURN v_schema;
END;
$$;

COMMENT ON FUNCTION public.register_client_fdw IS
  'Registra FDW somente-leitura para um Client DB. Billing e DRE leem daqui; nunca escrevem de volta.';

-- Rollup de capacidade (união lógica via clients.fdw_schema — views concretas por cliente)
-- Stub seguro sem FDW configurado: usa rack_budget do cadastro operator.
CREATE OR REPLACE VIEW public.v_capacity_rollup
WITH (security_invoker = true)
AS
SELECT
  c.id AS client_id,
  c.slug,
  c.trade_name,
  c.is_dogfood,
  c.rack_budget_positions AS budget_positions,
  2968 AS hub_infrastructure_positions,
  c.status
FROM public.clients c
WHERE c.status IN ('active', 'provisioning');

COMMENT ON VIEW public.v_capacity_rollup IS
  'Capacidade consolidada. 2.968 posições = infraestrutura HUB-FITNESS; budgets por cliente em clients.rack_budget_positions.';

-- Control Tower: placeholder que lista clientes; detalhe de orders via FDW por schema
CREATE OR REPLACE VIEW public.v_control_tower_clients
WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.slug,
  c.legal_name,
  c.is_dogfood,
  c.fdw_schema,
  c.status,
  c.updated_at
FROM public.clients c;

-- Billing: upsert a partir de contagem de supply_events (chamado por job service_role)
CREATE OR REPLACE FUNCTION public.recompute_billing_for_period(
  p_client_id uuid,
  p_period_ym char(7),
  p_event_count integer,
  p_amount_cents integer,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.billing_records AS br (
    client_id, period_ym, source_event_count, amount_cents, payload, computed_at, status
  ) VALUES (
    p_client_id, p_period_ym, p_event_count, p_amount_cents, p_payload, now(), 'draft'
  )
  ON CONFLICT (client_id, period_ym) DO UPDATE
    SET source_event_count = EXCLUDED.source_event_count,
        amount_cents = EXCLUDED.amount_cents,
        payload = EXCLUDED.payload,
        computed_at = now()
  RETURNING id INTO v_id;

  INSERT INTO public.audit_log (actor_id, action, entity, entity_id, client_id, detail)
  VALUES (
    auth.uid(),
    'billing.recompute',
    'billing_records',
    v_id::text,
    p_client_id,
    jsonb_build_object('period_ym', p_period_ym, 'amount_cents', p_amount_cents)
  );

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.recompute_billing_for_period IS
  'Escreve APENAS em Operator.billing_records. Fonte: leitura FDW/service_role do Client DB.';
