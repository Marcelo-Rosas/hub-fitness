-- Intranet Operator (schema privado). Sem tenant_id (ADR-003).
-- Não expor em [api].schemas. Sem GRANT a anon/authenticated.

CREATE SCHEMA IF NOT EXISTS intranet;

GRANT USAGE ON SCHEMA intranet TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA intranet TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA intranet GRANT ALL ON TABLES TO postgres, service_role;

CREATE TABLE intranet.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  parent_id uuid REFERENCES intranet.sectors(id) ON DELETE RESTRICT,
  head_employee_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE intranet.job_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  can_request boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false
);

CREATE TABLE intranet.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  sector_id uuid NOT NULL REFERENCES intranet.sectors(id),
  job_title_id uuid NOT NULL REFERENCES intranet.job_titles(id),
  reports_to uuid REFERENCES intranet.employees(id),
  can_request_override boolean,
  can_approve_override boolean,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE intranet.sectors
  ADD CONSTRAINT sectors_head_fk
  FOREIGN KEY (head_employee_id) REFERENCES intranet.employees(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE intranet.workflow_defs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE intranet.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  workflow_definition_id uuid REFERENCES intranet.workflow_defs(id),
  requester_employee_id uuid NOT NULL REFERENCES intranet.employees(id),
  from_sector_id uuid REFERENCES intranet.sectors(id),
  to_sector_id uuid REFERENCES intranet.sectors(id),
  title text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_step integer NOT NULL DEFAULT 1,
  total_steps integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELED')),
  version integer NOT NULL DEFAULT 1,
  supplier_name text,
  supplier_email text,
  email_status text,
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE intranet.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES intranet.requests(id) ON DELETE CASCADE,
  assigned_employee_id uuid NOT NULL REFERENCES intranet.employees(id),
  assigned_sector_id uuid NOT NULL REFERENCES intranet.sectors(id),
  step_number integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE intranet.decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES intranet.requests(id) ON DELETE CASCADE,
  actor_employee_id uuid NOT NULL REFERENCES intranet.employees(id),
  action text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE intranet.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES intranet.requests(id) ON DELETE SET NULL,
  actor_employee_id uuid REFERENCES intranet.employees(id),
  event text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE intranet.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES intranet.requests(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX intranet_requests_status_idx ON intranet.requests (status, updated_at DESC);
CREATE INDEX intranet_assignments_active_idx ON intranet.assignments (assigned_employee_id, is_active);
CREATE INDEX intranet_outbox_pending_idx ON intranet.outbox_events (status, created_at);

ALTER TABLE intranet.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE intranet.job_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE intranet.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE intranet.workflow_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE intranet.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE intranet.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE intranet.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE intranet.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE intranet.outbox_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY sectors_service_role ON intranet.sectors FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY job_titles_service_role ON intranet.job_titles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY employees_service_role ON intranet.employees FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY workflow_defs_service_role ON intranet.workflow_defs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY requests_service_role ON intranet.requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY assignments_service_role ON intranet.assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY decisions_service_role ON intranet.decisions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY audit_logs_service_role ON intranet.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY outbox_events_service_role ON intranet.outbox_events FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT ALL ON ALL TABLES IN SCHEMA intranet TO postgres, service_role;

-- Seed: COM é filho de FIN para a alçada RFQ (assistente → CFO → Sócio).
BEGIN;
SET CONSTRAINTS ALL DEFERRED;

INSERT INTO intranet.sectors (id, code, name, parent_id) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'DIR', 'Diretoria', NULL),
  ('a0000000-0000-4000-8000-000000000002', 'FIN', 'Financeiro', 'a0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000003', 'COM', 'Compras', 'a0000000-0000-4000-8000-000000000002'),
  ('a0000000-0000-4000-8000-000000000004', 'LOG', 'Logística', 'a0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000005', 'CML', 'Comercial', 'a0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000006', 'CMX', 'Comex', 'a0000000-0000-4000-8000-000000000001');

INSERT INTO intranet.job_titles (id, name, can_request, can_approve) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'Sócio-Fundador', false, true),
  ('b0000000-0000-4000-8000-000000000002', 'CFO / Controller', true, true),
  ('b0000000-0000-4000-8000-000000000003', 'Assistente de Compras', true, false),
  ('b0000000-0000-4000-8000-000000000004', 'VP de Negócios', true, false),
  ('b0000000-0000-4000-8000-000000000005', 'Comitê de Risco', false, false),
  ('b0000000-0000-4000-8000-000000000006', 'Coordenador de Logística', true, false),
  ('b0000000-0000-4000-8000-000000000007', 'Analista Comex', true, false);

INSERT INTO intranet.employees (id, email, full_name, sector_id, job_title_id, reports_to) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'socio@hubfitness.com.br', 'Carlos Eduardo',
    'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', NULL),
  ('c0000000-0000-4000-8000-000000000002', 'cfo@hubfitness.com.br', 'Dr. Roberto Mendes',
    'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000003', 'compras@hubfitness.com.br', 'Ana Souza',
    'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003',
    'c0000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-000000000004', 'comercial@hubfitness.com.br', 'Fernando Silva',
    'a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000004',
    'c0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000005', 'comite@hubfitness.com.br', 'Juliana Paes',
    'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005',
    'c0000000-0000-4000-8000-000000000001');

UPDATE intranet.sectors SET head_employee_id = 'c0000000-0000-4000-8000-000000000001'
  WHERE id = 'a0000000-0000-4000-8000-000000000001';
UPDATE intranet.sectors SET head_employee_id = 'c0000000-0000-4000-8000-000000000002'
  WHERE id = 'a0000000-0000-4000-8000-000000000002';
UPDATE intranet.sectors SET head_employee_id = 'c0000000-0000-4000-8000-000000000003'
  WHERE id = 'a0000000-0000-4000-8000-000000000003';
UPDATE intranet.sectors SET head_employee_id = 'c0000000-0000-4000-8000-000000000004'
  WHERE id = 'a0000000-0000-4000-8000-000000000005';

INSERT INTO intranet.workflow_defs (id, name, version, configuration) VALUES
  ('d0000000-0000-4000-8000-000000000001', 'RFQ Compras', 1, '{"total_steps":1}'::jsonb);

COMMIT;
