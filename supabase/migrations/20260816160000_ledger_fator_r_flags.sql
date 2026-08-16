-- Ledger line flags for Fator R numerador / exclusão (BP v3.5)
ALTER TABLE finance.ledger_lines
  ADD COLUMN IF NOT EXISTS is_fator_r_numerator boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_fator_r_excluded boolean NOT NULL DEFAULT false;

UPDATE finance.ledger_lines SET is_fator_r_numerator = true
WHERE id IN ('cst-pessoal-clt-pl', 'cst-pl-adicional');

UPDATE finance.ledger_lines SET is_fator_r_excluded = true
WHERE id = 'cst-mo-terceirizada';
