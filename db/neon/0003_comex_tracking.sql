-- M18 Comex · acompanhamento Siscomex (Integra Comex, consulta pública gratuita).
-- Uma linha por documento do processo (CE-Mercante, DI, LI, DUIMP).
-- Idempotente: o PgComexStore.ensureReady roda o mesmo SQL a cada boot.

CREATE TABLE IF NOT EXISTS comex_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES comex_processes(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS comex_tracking_kind_idx ON comex_tracking (doc_kind, doc_number);
