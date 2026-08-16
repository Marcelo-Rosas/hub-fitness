/**
 * Leitura Operator (contracts + price_category_items).
 * Sem DATABASE_URL ou tabela vazia/erro → lista vazia (UI faz fallback).
 */
import type { PriceCategoryItemLike } from './resolvePriceFloors';

export type OperatorContractRow = {
  id: string;
  client_id: string;
  code: string;
  starts_on: string;
  ends_on: string | null;
  status: string;
  currency: string;
  client_slug?: string | null;
  client_trade_name?: string | null;
  is_dogfood?: boolean | null;
};

type PgPool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

let sharedPool: PgPool | null = null;
let lastOperatorError: string | null = null;

async function getPool(connectionString: string): Promise<PgPool> {
  if (sharedPool) return sharedPool;
  const pgMod = (await import('pg')) as {
    default?: { Pool: new (c: Record<string, unknown>) => PgPool };
    Pool?: new (c: Record<string, unknown>) => PgPool;
  };
  const Pool = pgMod.default?.Pool ?? pgMod.Pool;
  if (!Pool) throw new Error('pg.Pool indisponível');
  sharedPool = new Pool({
    connectionString,
    ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    max: 3,
    connectionTimeoutMillis: 12_000,
  });
  return sharedPool;
}

function connectionString(): string | null {
  // Operator first — never force Comex DATABASE_URL onto Operator reads.
  const url = process.env.OPERATOR_DATABASE_URL || process.env.DATABASE_URL;
  return url && String(url).trim() ? String(url).trim() : null;
}

export async function listPriceCategoryItems(): Promise<PriceCategoryItemLike[]> {
  const url = connectionString();
  if (!url) return [];
  try {
    const db = await getPool(url);
    const result = await db.query(`
      SELECT
        pci.sku_code,
        pci.description,
        pci.unit_price_cents,
        pc.code AS category_code,
        ptk.code AS kind_code
      FROM public.price_category_items pci
      JOIN public.price_categories pc ON pc.id = pci.price_category_id
      JOIN public.price_table_kinds ptk ON ptk.id = pc.price_table_kind_id
      WHERE pci.effective_to IS NULL OR pci.effective_to >= CURRENT_DATE
      ORDER BY pci.description
    `);
    return result.rows.map((row) => ({
      sku_code: row.sku_code == null ? null : String(row.sku_code),
      description: row.description == null ? null : String(row.description),
      unit_price_cents: Number(row.unit_price_cents),
      category_code: row.category_code == null ? null : String(row.category_code),
      kind_code: row.kind_code == null ? null : String(row.kind_code),
    }));
  } catch (err) {
    lastOperatorError = err instanceof Error ? err.message : String(err);
    console.warn('[operator] listPriceCategoryItems failed:', lastOperatorError);
    return [];
  }
}

export function operatorConnectionProbe(): {
  configured: boolean;
  usingOperatorKey: boolean;
  lastError: string | null;
} {
  return {
    configured: Boolean(connectionString()),
    usingOperatorKey: Boolean(process.env.OPERATOR_DATABASE_URL?.trim()),
    lastError: lastOperatorError,
  };
}

export async function listContracts(): Promise<OperatorContractRow[]> {
  const url = connectionString();
  if (!url) return [];
  try {
    const db = await getPool(url);
    const result = await db.query(`
      SELECT
        c.id::text AS id,
        c.client_id::text AS client_id,
        c.code,
        c.starts_on::text AS starts_on,
        c.ends_on::text AS ends_on,
        c.status,
        c.currency,
        cl.slug AS client_slug,
        cl.trade_name AS client_trade_name,
        cl.is_dogfood
      FROM public.contracts c
      LEFT JOIN public.clients cl ON cl.id = c.client_id
      ORDER BY c.starts_on DESC NULLS LAST, c.code
    `);
    return result.rows.map((row) => ({
      id: String(row.id),
      client_id: String(row.client_id),
      code: String(row.code),
      starts_on: String(row.starts_on),
      ends_on: row.ends_on == null ? null : String(row.ends_on),
      status: String(row.status),
      currency: String(row.currency || 'BRL'),
      client_slug: row.client_slug == null ? null : String(row.client_slug),
      client_trade_name: row.client_trade_name == null ? null : String(row.client_trade_name),
      is_dogfood: Boolean(row.is_dogfood),
    }));
  } catch (err) {
    console.warn('[operator] listContracts failed:', err instanceof Error ? err.message : err);
    return [];
  }
}
