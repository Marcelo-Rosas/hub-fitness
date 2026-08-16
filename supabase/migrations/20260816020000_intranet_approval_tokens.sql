-- Operator: tokens opacos de aprovação por e-mail (Plan B fase 1)
-- request/assignment PKs no Operator são uuid (ver 20260814160000).
CREATE TABLE IF NOT EXISTS intranet.approval_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  request_id UUID NOT NULL REFERENCES intranet.requests(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES intranet.assignments(id) ON DELETE CASCADE,
  assignee_employee_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS approval_tokens_request_idx
  ON intranet.approval_tokens(request_id);
CREATE INDEX IF NOT EXISTS approval_tokens_assignee_idx
  ON intranet.approval_tokens(assignee_employee_id);
