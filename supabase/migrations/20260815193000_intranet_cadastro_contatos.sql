-- Cadastro de contatos (nome, cargo=CoA, telefone, e-mail) no schema intranet.

CREATE TABLE IF NOT EXISTS intranet.cadastro_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL,
  account_code text NOT NULL,
  account_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cadastro_contatos_email_account_uid UNIQUE (email, account_code)
);

CREATE INDEX IF NOT EXISTS cadastro_contatos_account_idx
  ON intranet.cadastro_contatos (account_code);

GRANT ALL ON TABLE intranet.cadastro_contatos TO postgres, service_role;
