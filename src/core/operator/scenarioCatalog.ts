/**
 * finance.scenario_defs — Operator PG. Fallback vazio → caller usa INITIAL_SCENARIOS.
 */
import type { Scenario, ScenarioDrivers } from '../../types';
import { INITIAL_SCENARIOS } from '../../data/initialData';
import { scenarioDriversValidationError, clampScenarioDrivers } from '../scenarioDrivers';

export type ScenarioDefRow = {
  id: string;
  name: string;
  isBaseline: boolean;
  status: Scenario['status'];
  drivers: ScenarioDrivers;
  notes?: string;
  mitigationStrategy?: string;
  sortOrder: number;
};

type PgPool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

let sharedPool: PgPool | null = null;
let lastError: string | null = null;

async function getPool(connectionString: string): Promise<PgPool> {
  if (sharedPool) return sharedPool;
  const pgMod = (await import('pg')) as {
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

export function scenarioCatalogProbe(): {
  configured: boolean;
  lastError: string | null;
} {
  return {
    configured: Boolean(connectionString()),
    lastError,
  };
}

function parseDrivers(raw: unknown): ScenarioDrivers | null {
  const err = scenarioDriversValidationError(raw);
  if (err) return null;
  return clampScenarioDrivers(raw as ScenarioDrivers);
}

function mapRow(row: Record<string, unknown>): ScenarioDefRow | null {
  const drivers = parseDrivers(row.drivers);
  if (!drivers) return null;
  const status = String(row.status || 'ok');
  if (status !== 'ok' && status !== 'warning' && status !== 'critical') return null;
  return {
    id: String(row.id),
    name: String(row.name),
    isBaseline: Boolean(row.is_baseline),
    status,
    drivers,
    notes: row.notes == null ? undefined : String(row.notes),
    mitigationStrategy:
      row.mitigation_strategy == null ? undefined : String(row.mitigation_strategy),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function rowToScenario(row: ScenarioDefRow): Scenario {
  return {
    id: row.id,
    name: row.name,
    isBaseline: row.isBaseline,
    occupancyRate: row.drivers.occupancyRate,
    drivers: row.drivers,
    llM7Plus: 0,
    capexTotal: 207_300,
    m24Cash: 0,
    fatorR: 0,
    status: row.status,
    notes: row.notes,
    mitigationStrategy: row.mitigationStrategy,
  };
}

async function ensureSeed(db: PgPool): Promise<void> {
  const count = await db.query(`SELECT COUNT(*)::int AS n FROM finance.scenario_defs`);
  const n = Number(count.rows[0]?.n ?? 0);
  if (n > 0) return;
  for (const [i, sc] of INITIAL_SCENARIOS.entries()) {
    await db.query(
      `INSERT INTO finance.scenario_defs
        (id, name, is_baseline, status, drivers, notes, mitigation_strategy, sort_order)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [
        sc.id,
        sc.name,
        sc.isBaseline,
        sc.status,
        JSON.stringify(sc.drivers),
        sc.notes ?? null,
        sc.mitigationStrategy ?? null,
        i,
      ],
    );
  }
}

export async function listScenarioDefs(): Promise<ScenarioDefRow[]> {
  const url = connectionString();
  if (!url) return [];
  try {
    const db = await getPool(url);
    await ensureSeed(db);
    const result = await db.query(`
      SELECT id, name, is_baseline, status, drivers, notes, mitigation_strategy, sort_order
      FROM finance.scenario_defs
      ORDER BY sort_order, id
    `);
    lastError = null;
    return result.rows.map(mapRow).filter((r): r is ScenarioDefRow => r != null);
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.warn('[operator] listScenarioDefs failed:', lastError);
    return [];
  }
}

export async function upsertScenarioDef(input: {
  id: string;
  name: string;
  isBaseline?: boolean;
  status?: Scenario['status'];
  drivers: ScenarioDrivers;
  notes?: string | null;
  mitigationStrategy?: string | null;
  sortOrder?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const verr = scenarioDriversValidationError(input.drivers);
  if (verr) return { ok: false, error: verr };
  const url = connectionString();
  if (!url) return { ok: false, error: 'OPERATOR_DATABASE_URL ausente' };
  try {
    const db = await getPool(url);
    const drivers = clampScenarioDrivers(input.drivers);
    await db.query(
      `INSERT INTO finance.scenario_defs
        (id, name, is_baseline, status, drivers, notes, mitigation_strategy, sort_order, updated_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8, now())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         is_baseline = EXCLUDED.is_baseline,
         status = EXCLUDED.status,
         drivers = EXCLUDED.drivers,
         notes = EXCLUDED.notes,
         mitigation_strategy = EXCLUDED.mitigation_strategy,
         sort_order = EXCLUDED.sort_order,
         updated_at = now()`,
      [
        input.id,
        input.name,
        input.isBaseline ?? false,
        input.status ?? 'ok',
        JSON.stringify(drivers),
        input.notes ?? null,
        input.mitigationStrategy ?? null,
        input.sortOrder ?? 0,
      ],
    );
    lastError = null;
    return { ok: true };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return { ok: false, error: lastError };
  }
}

export async function deleteScenarioDef(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = connectionString();
  if (!url) return { ok: false, error: 'OPERATOR_DATABASE_URL ausente' };
  try {
    const db = await getPool(url);
    const existing = await db.query(
      `SELECT is_baseline FROM finance.scenario_defs WHERE id = $1`,
      [id],
    );
    if (!existing.rows.length) return { ok: false, error: 'cenário não encontrado' };
    if (existing.rows[0].is_baseline) return { ok: false, error: 'baseline não deletável' };
    await db.query(`DELETE FROM finance.scenario_defs WHERE id = $1`, [id]);
    return { ok: true };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    return { ok: false, error: lastError };
  }
}
