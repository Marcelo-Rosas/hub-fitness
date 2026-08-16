/**
 * finance.chart_accounts / cost_centers / ledger_lines — Operator PG.
 * Empty tables → seed from TS; never truncate.
 */
import { PLANO_DE_CONTAS_ITEMS, COST_CENTERS, type AccountItem, type CostCenter } from '../../data/planoDeContasData';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../../data/initialData';
import type { DreGranularItem } from '../../types';
import {
  accountToRow,
  costBehaviorValidationError,
  costCenterToRow,
  ledgerToRow,
  needsSeed,
  rowToAccount,
  rowToCostCenter,
  rowToLedger,
  type ChartAccountRow,
  type CostCenterRow,
  type LedgerLineRow,
} from './financeMappers';

type PgPool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

let sharedPool: PgPool | null = null;
let lastError: string | null = null;

async function getPool(connectionString: string): Promise<PgPool> {
  if (sharedPool) return sharedPool;
  const pgMod = (await import('pg')) as unknown as {
    default?: { Pool: new (c: Record<string, unknown>) => PgPool };
    Pool?: new (c: Record<string, unknown>) => PgPool;
  };
  const Pool = pgMod.default?.Pool ?? pgMod.Pool;
  if (!Pool) throw new Error('pg.Pool indisponível');
  const isSupabase = /supabase\.co|pooler\.supabase/i.test(connectionString);
  const cleaned = connectionString
    .replace(/([?&])sslmode=[^&]*/gi, '$1')
    .replace(/[?&]$/, '')
    .replace(/\?&/, '?');
  sharedPool = new Pool({
    connectionString: cleaned,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
    max: 3,
    connectionTimeoutMillis: 12_000,
  });
  return sharedPool;
}

function connectionString(): string | null {
  const url = process.env.OPERATOR_DATABASE_URL || process.env.DATABASE_URL;
  return url && String(url).trim() ? String(url).trim() : null;
}

export function financeCatalogProbe(): {
  configured: boolean;
  lastError: string | null;
} {
  return {
    configured: Boolean(connectionString()),
    lastError,
  };
}

function asChartRow(row: Record<string, unknown>): ChartAccountRow {
  return {
    code: String(row.code),
    name: String(row.name),
    level: Number(row.level),
    grp: String(row.grp),
    nature: String(row.nature),
    type: String(row.type),
    is_critical_fator_r: Boolean(row.is_critical_fator_r),
    is_fator_r_numerator: Boolean(row.is_fator_r_numerator),
    is_fator_r_excluded: Boolean(row.is_fator_r_excluded),
    is_das_tax: Boolean(row.is_das_tax),
    is_capex: Boolean(row.is_capex),
    cost_center_id: row.cost_center_id == null ? null : String(row.cost_center_id),
    notes: row.notes == null ? '' : String(row.notes),
    sort_order: Number(row.sort_order ?? 0),
  };
}

function asCcRow(row: Record<string, unknown>): CostCenterRow {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description == null ? '' : String(row.description),
    scope: row.scope == null ? '' : String(row.scope),
    recommended_kpi: row.recommended_kpi == null ? '' : String(row.recommended_kpi),
  };
}

function asLedgerRow(row: Record<string, unknown>): LedgerLineRow {
  return {
    id: String(row.id),
    section: String(row.section),
    item_type: String(row.item_type),
    category: row.category == null ? '' : String(row.category),
    name: String(row.name),
    monthly_amount_y1: Number(row.monthly_amount_y1 ?? 0),
    monthly_amount_y2: Number(row.monthly_amount_y2 ?? 0),
    active: Boolean(row.active),
    is_percentage_of_revenue: Boolean(row.is_percentage_of_revenue),
    percentage_value: row.percentage_value == null ? null : Number(row.percentage_value),
    account_code: row.account_code == null ? null : String(row.account_code),
    cost_center_id: row.cost_center_id == null ? null : String(row.cost_center_id),
    cost_behavior: row.cost_behavior == null ? null : String(row.cost_behavior),
    engine_locked: Boolean(row.engine_locked),
    manual_override: Boolean(row.manual_override),
    composition: row.composition ?? [],
    notes: row.notes == null ? '' : String(row.notes),
  };
}

async function ensureFinanceSeeded(db: PgPool): Promise<void> {
  const a = await db.query(`SELECT COUNT(*)::int AS n FROM finance.chart_accounts`);
  const c = await db.query(`SELECT COUNT(*)::int AS n FROM finance.cost_centers`);
  const l = await db.query(`SELECT COUNT(*)::int AS n FROM finance.ledger_lines`);
  const seed = needsSeed({
    accounts: Number(a.rows[0]?.n ?? 0),
    costCenters: Number(c.rows[0]?.n ?? 0),
    ledger: Number(l.rows[0]?.n ?? 0),
  });

  if (seed.accounts) {
    for (const [i, acc] of PLANO_DE_CONTAS_ITEMS.entries()) {
      const row = accountToRow(acc, i);
      await db.query(
        `INSERT INTO finance.chart_accounts
          (code, name, level, grp, nature, type,
           is_critical_fator_r, is_fator_r_numerator, is_fator_r_excluded,
           is_das_tax, is_capex, cost_center_id, notes, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (code) DO NOTHING`,
        [
          row.code,
          row.name,
          row.level,
          row.grp,
          row.nature,
          row.type,
          row.is_critical_fator_r,
          row.is_fator_r_numerator,
          row.is_fator_r_excluded,
          row.is_das_tax,
          row.is_capex,
          row.cost_center_id,
          row.notes,
          row.sort_order,
        ],
      );
    }
  }

  if (seed.costCenters) {
    for (const cc of COST_CENTERS) {
      const row = costCenterToRow(cc);
      await db.query(
        `INSERT INTO finance.cost_centers (id, name, description, scope, recommended_kpi)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.name, row.description, row.scope, row.recommended_kpi],
      );
    }
  }

  if (seed.ledger) {
    for (const item of INITIAL_GRANULAR_DRE_ITEMS) {
      const row = ledgerToRow(item);
      await db.query(
        `INSERT INTO finance.ledger_lines
          (id, section, item_type, category, name,
           monthly_amount_y1, monthly_amount_y2, active,
           is_percentage_of_revenue, percentage_value,
           account_code, cost_center_id, cost_behavior,
           engine_locked, manual_override, composition, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          row.section,
          row.item_type,
          row.category,
          row.name,
          row.monthly_amount_y1,
          row.monthly_amount_y2,
          row.active,
          row.is_percentage_of_revenue,
          row.percentage_value,
          row.account_code,
          row.cost_center_id,
          row.cost_behavior,
          row.engine_locked,
          row.manual_override,
          JSON.stringify(row.composition ?? []),
          row.notes,
        ],
      );
    }
  }
}

export type FinanceBundle = {
  accounts: AccountItem[];
  costCenters: CostCenter[];
  ledger: DreGranularItem[];
};

export async function listFinanceBundle(): Promise<FinanceBundle | null> {
  const url = connectionString();
  if (!url) return null;
  try {
    const db = await getPool(url);
    await ensureFinanceSeeded(db);
    const [accRes, ccRes, ledRes] = await Promise.all([
      db.query(`SELECT * FROM finance.chart_accounts ORDER BY sort_order, code`),
      db.query(`SELECT * FROM finance.cost_centers ORDER BY id`),
      db.query(`SELECT * FROM finance.ledger_lines ORDER BY id`),
    ]);
    lastError = null;
    return {
      accounts: accRes.rows.map((r) => rowToAccount(asChartRow(r))),
      costCenters: ccRes.rows.map((r) => rowToCostCenter(asCcRow(r))),
      ledger: ledRes.rows.map((r) => rowToLedger(asLedgerRow(r))),
    };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.warn('[operator] listFinanceBundle failed:', lastError);
    return null;
  }
}

export async function upsertAccount(
  account: AccountItem,
  sortOrder = 0,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (account.type !== 'Sintética' && account.type !== 'Analítica') {
    return { ok: false, error: 'type inválido' };
  }
  const url = connectionString();
  if (!url) return { ok: false, error: 'OPERATOR_DATABASE_URL ausente' };
  try {
    const db = await getPool(url);
    const row = accountToRow(account, sortOrder);
    await db.query(
      `INSERT INTO finance.chart_accounts
        (code, name, level, grp, nature, type,
         is_critical_fator_r, is_fator_r_numerator, is_fator_r_excluded,
         is_das_tax, is_capex, cost_center_id, notes, sort_order, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now())
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         level = EXCLUDED.level,
         grp = EXCLUDED.grp,
         nature = EXCLUDED.nature,
         type = EXCLUDED.type,
         is_critical_fator_r = EXCLUDED.is_critical_fator_r,
         is_fator_r_numerator = EXCLUDED.is_fator_r_numerator,
         is_fator_r_excluded = EXCLUDED.is_fator_r_excluded,
         is_das_tax = EXCLUDED.is_das_tax,
         is_capex = EXCLUDED.is_capex,
         cost_center_id = EXCLUDED.cost_center_id,
         notes = EXCLUDED.notes,
         sort_order = EXCLUDED.sort_order,
         updated_at = now()`,
      [
        row.code,
        row.name,
        row.level,
        row.grp,
        row.nature,
        row.type,
        row.is_critical_fator_r,
        row.is_fator_r_numerator,
        row.is_fator_r_excluded,
        row.is_das_tax,
        row.is_capex,
        row.cost_center_id,
        row.notes,
        row.sort_order,
      ],
    );
    lastError = null;
    return { ok: true };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return { ok: false, error: lastError };
  }
}

export async function deleteAccount(
  code: string,
): Promise<{ ok: true } | { ok: false; error: string; status?: number; code?: string }> {
  const url = connectionString();
  if (!url) return { ok: false, error: 'OPERATOR_DATABASE_URL ausente' };
  try {
    const db = await getPool(url);
    const refs = await db.query(
      `SELECT account_code FROM finance.ledger_lines WHERE account_code = $1 LIMIT 1`,
      [code],
    );
    if (refs.rows.length > 0) {
      return { ok: false, error: 'ACCOUNT_IN_USE', status: 409, code: 'ACCOUNT_IN_USE' };
    }
    await db.query(`DELETE FROM finance.chart_accounts WHERE code = $1`, [code]);
    return { ok: true };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return { ok: false, error: lastError };
  }
}

export async function upsertCostCenter(
  cc: CostCenter,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = connectionString();
  if (!url) return { ok: false, error: 'OPERATOR_DATABASE_URL ausente' };
  try {
    const db = await getPool(url);
    const row = costCenterToRow(cc);
    await db.query(
      `INSERT INTO finance.cost_centers (id, name, description, scope, recommended_kpi, updated_at)
       VALUES ($1,$2,$3,$4,$5, now())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         scope = EXCLUDED.scope,
         recommended_kpi = EXCLUDED.recommended_kpi,
         updated_at = now()`,
      [row.id, row.name, row.description, row.scope, row.recommended_kpi],
    );
    return { ok: true };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return { ok: false, error: lastError };
  }
}

export async function deleteCostCenter(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = connectionString();
  if (!url) return { ok: false, error: 'OPERATOR_DATABASE_URL ausente' };
  try {
    const db = await getPool(url);
    await db.query(`DELETE FROM finance.cost_centers WHERE id = $1`, [id]);
    return { ok: true };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return { ok: false, error: lastError };
  }
}

export async function upsertLedgerLine(
  item: DreGranularItem,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const verr = costBehaviorValidationError(item.costBehavior ?? null);
  if (verr) return { ok: false, error: verr };
  if (!['receita', 'custo', 'despesa'].includes(item.section)) {
    return { ok: false, error: 'section inválida' };
  }
  if (typeof item.monthlyAmountY1 !== 'number' || typeof item.monthlyAmountY2 !== 'number') {
    return { ok: false, error: 'Y1/Y2 devem ser numéricos' };
  }
  const url = connectionString();
  if (!url) return { ok: false, error: 'OPERATOR_DATABASE_URL ausente' };
  try {
    const db = await getPool(url);
    const row = ledgerToRow(item);
    await db.query(
      `INSERT INTO finance.ledger_lines
        (id, section, item_type, category, name,
         monthly_amount_y1, monthly_amount_y2, active,
         is_percentage_of_revenue, percentage_value,
         account_code, cost_center_id, cost_behavior,
         engine_locked, manual_override, composition, notes, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17, now())
       ON CONFLICT (id) DO UPDATE SET
         section = EXCLUDED.section,
         item_type = EXCLUDED.item_type,
         category = EXCLUDED.category,
         name = EXCLUDED.name,
         monthly_amount_y1 = EXCLUDED.monthly_amount_y1,
         monthly_amount_y2 = EXCLUDED.monthly_amount_y2,
         active = EXCLUDED.active,
         is_percentage_of_revenue = EXCLUDED.is_percentage_of_revenue,
         percentage_value = EXCLUDED.percentage_value,
         account_code = EXCLUDED.account_code,
         cost_center_id = EXCLUDED.cost_center_id,
         cost_behavior = EXCLUDED.cost_behavior,
         engine_locked = EXCLUDED.engine_locked,
         manual_override = EXCLUDED.manual_override,
         composition = EXCLUDED.composition,
         notes = EXCLUDED.notes,
         updated_at = now()`,
      [
        row.id,
        row.section,
        row.item_type,
        row.category,
        row.name,
        row.monthly_amount_y1,
        row.monthly_amount_y2,
        row.active,
        row.is_percentage_of_revenue,
        row.percentage_value,
        row.account_code,
        row.cost_center_id,
        row.cost_behavior,
        row.engine_locked,
        row.manual_override,
        JSON.stringify(row.composition ?? []),
        row.notes,
      ],
    );
    return { ok: true };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return { ok: false, error: lastError };
  }
}

export async function deleteLedgerLine(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = connectionString();
  if (!url) return { ok: false, error: 'OPERATOR_DATABASE_URL ausente' };
  try {
    const db = await getPool(url);
    await db.query(`DELETE FROM finance.ledger_lines WHERE id = $1`, [id]);
    return { ok: true };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return { ok: false, error: lastError };
  }
}
