-- Finance Operator (schema privado). Sem tenant_id (ADR-003).
-- Não expor em [api].schemas. Sem GRANT a anon/authenticated.
-- CoA/ledger = Phase 5 (mesmo schema depois).

CREATE SCHEMA IF NOT EXISTS finance;

GRANT USAGE ON SCHEMA finance TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA finance TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA finance GRANT ALL ON TABLES TO postgres, service_role;

CREATE TABLE IF NOT EXISTS finance.scenario_defs (
  id text PRIMARY KEY,
  name text NOT NULL,
  is_baseline boolean NOT NULL DEFAULT false,
  status text NOT NULL CHECK (status IN ('ok', 'warning', 'critical')),
  drivers jsonb NOT NULL,
  notes text,
  mitigation_strategy text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO finance.scenario_defs (id, name, is_baseline, status, drivers, notes, mitigation_strategy, sort_order)
VALUES
  (
    'sc-baseline',
    'Realista v3.5 (Oficial)',
    true,
    'ok',
    '{"occupancyRate":0.75,"rentFactor":1,"cogsVariableFactor":1,"hcOpexFactor":1,"techOpexActive":false}'::jsonb,
    'Cenário base validado pela auditoria spine v3.5.',
    NULL,
    0
  ),
  (
    'sc-v36-wms-proprio',
    'v3.6 WMS Próprio + Logcomex',
    false,
    'ok',
    '{"occupancyRate":0.75,"rentFactor":1,"cogsVariableFactor":1,"hcOpexFactor":1,"techOpexActive":true}'::jsonb,
    'WMS sweat equity. OPEX tech via drivers.techOpexActive.',
    NULL,
    1
  ),
  (
    'sc-pessimistic',
    'Pessimista 35% Ocupação',
    false,
    'critical',
    '{"occupancyRate":0.35,"rentFactor":1,"cogsVariableFactor":1,"hcOpexFactor":1,"techOpexActive":false}'::jsonb,
    'Risco de deficit operacional a partir do M7 sem mitigação.',
    'Sublocar 30% da área útil + renegociar aluguel base com carência.',
    2
  ),
  (
    'sc-optimistic',
    'Otimista Expansão +20%',
    false,
    'ok',
    '{"occupancyRate":0.90,"rentFactor":1,"cogsVariableFactor":1,"hcOpexFactor":1,"techOpexActive":false}'::jsonb,
    'Antecipa locação de posições no galpão B com margem expandida.',
    NULL,
    3
  )
ON CONFLICT (id) DO NOTHING;
