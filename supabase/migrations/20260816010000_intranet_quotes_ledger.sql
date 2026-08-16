-- Operator: ledger de fornecedores + cotações (Plan B fase 0)
CREATE TABLE IF NOT EXISTS intranet.suppliers (
  id TEXT PRIMARY KEY,
  trade_name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  uf TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'ingest',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS intranet.quotes (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL REFERENCES intranet.suppliers(id),
  account_code TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  item_description TEXT NOT NULL,
  unit_price_brl NUMERIC NOT NULL DEFAULT 0,
  freight_monthly_brl NUMERIC NOT NULL DEFAULT 0,
  landed_monthly_brl NUMERIC NOT NULL DEFAULT 0,
  volume_label TEXT NOT NULL DEFAULT '',
  lead_time_days INTEGER,
  payment_terms TEXT NOT NULL DEFAULT '',
  price_type TEXT NOT NULL,
  price_date TEXT NOT NULL DEFAULT '',
  sources_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  matrix_id TEXT NOT NULL DEFAULT '',
  score_display NUMERIC,
  score_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotes_matrix_idx ON intranet.quotes(matrix_id);
CREATE INDEX IF NOT EXISTS quotes_supplier_idx ON intranet.quotes(supplier_id);

CREATE TABLE IF NOT EXISTS intranet.ops_flags (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
