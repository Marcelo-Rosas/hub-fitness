-- finance CoA + cost centers + ledger lines (Phase 5)
-- Grants: postgres + service_role only (no anon/authenticated Data API)
-- Account flags map AccountItem in src/data/planoDeContasData.ts
-- (isCriticalFatorR / isFatorRNumerator / isFatorRExcluded / isDasTax / isCapex)

CREATE TABLE IF NOT EXISTS finance.chart_accounts (
  code text PRIMARY KEY,
  name text NOT NULL,
  level int NOT NULL CHECK (level BETWEEN 1 AND 4),
  grp text NOT NULL,
  nature text NOT NULL,
  type text NOT NULL,
  is_critical_fator_r boolean NOT NULL DEFAULT false,
  is_fator_r_numerator boolean NOT NULL DEFAULT false,
  is_fator_r_excluded boolean NOT NULL DEFAULT false,
  is_das_tax boolean NOT NULL DEFAULT false,
  is_capex boolean NOT NULL DEFAULT false,
  cost_center_id text,
  notes text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance.cost_centers (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT '',
  recommended_kpi text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance.ledger_lines (
  id text PRIMARY KEY,
  section text NOT NULL CHECK (section IN ('receita', 'custo', 'despesa')),
  item_type text NOT NULL,
  category text NOT NULL DEFAULT '',
  name text NOT NULL,
  monthly_amount_y1 numeric NOT NULL DEFAULT 0,
  monthly_amount_y2 numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  is_percentage_of_revenue boolean NOT NULL DEFAULT false,
  percentage_value numeric,
  account_code text,
  cost_center_id text,
  cost_behavior text CHECK (cost_behavior IS NULL OR cost_behavior IN ('variable', 'fixed', 'hc')),
  engine_locked boolean NOT NULL DEFAULT false,
  manual_override boolean NOT NULL DEFAULT false,
  composition jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_lines_account_code_idx
  ON finance.ledger_lines (account_code)
  WHERE account_code IS NOT NULL;

REVOKE ALL ON TABLE finance.chart_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE finance.cost_centers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE finance.ledger_lines FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE finance.chart_accounts TO postgres, service_role;
GRANT ALL ON TABLE finance.cost_centers TO postgres, service_role;
GRANT ALL ON TABLE finance.ledger_lines TO postgres, service_role;
