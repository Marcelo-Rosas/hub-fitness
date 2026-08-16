import { randomUUID } from 'node:crypto';
import type { SqliteIntranetStore } from './intranetStore';
import { heuristicQuoteScore } from './dossierGaps';

export type QuotePriceType =
  | 'estimativa'
  | 'rfq_fornecedor'
  | 'rfq_confirmado'
  | 'manual';

export type SupplierUpsert = {
  id?: string;
  trade_name: string;
  email?: string;
  city?: string;
  uf?: string;
  source?: string;
};

export type QuoteUpsert = {
  id?: string;
  supplier_id: string;
  account_code?: string;
  category?: string;
  item_description: string;
  unit_price_brl: number;
  freight_monthly_brl: number;
  landed_monthly_brl: number;
  volume_label?: string;
  lead_time_days?: number;
  payment_terms?: string;
  price_type: QuotePriceType;
  price_date?: string;
  sources_json?: unknown;
  matrix_id?: string;
  score_display?: number | null;
  score_label?: string | null;
};

export function upsertSupplier(
  store: SqliteIntranetStore,
  input: SupplierUpsert,
): { id: string; trade_name: string } {
  return store.upsertSupplier({
    id: input.id,
    trade_name: input.trade_name.trim(),
    email: (input.email || '').trim().toLowerCase(),
    city: (input.city || '').trim(),
    uf: (input.uf || '').trim().toUpperCase(),
    source: input.source || 'ingest',
  });
}

export function upsertQuote(
  store: SqliteIntranetStore,
  input: QuoteUpsert,
): { id: string } {
  const id = input.id || randomUUID();
  store.upsertQuote({
    id,
    supplier_id: input.supplier_id,
    account_code: input.account_code || '',
    category: input.category || '',
    item_description: input.item_description,
    unit_price_brl: input.unit_price_brl,
    freight_monthly_brl: input.freight_monthly_brl,
    landed_monthly_brl: input.landed_monthly_brl,
    volume_label: input.volume_label || '',
    lead_time_days: input.lead_time_days ?? null,
    payment_terms: input.payment_terms || '',
    price_type: input.price_type,
    price_date: input.price_date || '',
    sources_json: JSON.stringify(input.sources_json ?? []),
    matrix_id: input.matrix_id || '',
    score_display: input.score_display ?? null,
    score_label: input.score_label ?? null,
  });
  return { id };
}

/** Persiste linhas do Comparador/ingest como estimativa. */
export function persistIngestQuotes(
  store: SqliteIntranetStore,
  rows: Array<{
    supplierName: string;
    supplierState: string;
    contactEmail?: string;
    accountCode?: string;
    materialCategory?: string;
    productDescription: string;
    unitPrice: number;
    shippingCostMonthly: number;
    totalMonthlyWithFreight: number;
    monthlyVolumeUnit?: number;
    deliveryLeadTimeDays?: number;
    paymentTerms?: string;
    isRecommendedWinner?: boolean;
    notes?: string;
    matrixId?: string;
  }>,
): string[] {
  const matrixId = rows[0]?.matrixId || randomUUID();
  const ids: string[] = [];
  for (const row of rows) {
    const name = row.supplierName.replace(/\s*\([A-Z]{2}\)\s*$/, '').trim();
    const uf = row.supplierState || '';
    const supplier = upsertSupplier(store, {
      trade_name: name,
      email: row.contactEmail,
      uf,
      source: 'ingest',
    });
    const heur = heuristicQuoteScore({
      isWinner: !!row.isRecommendedWinner,
      supplierUf: uf,
    });
    const q = upsertQuote(store, {
      supplier_id: supplier.id,
      account_code: row.accountCode,
      category: row.materialCategory,
      item_description: row.productDescription,
      unit_price_brl: row.unitPrice,
      freight_monthly_brl: row.shippingCostMonthly,
      landed_monthly_brl: row.totalMonthlyWithFreight,
      volume_label:
        row.monthlyVolumeUnit != null ? `${row.monthlyVolumeUnit} un / mês` : '',
      lead_time_days: row.deliveryLeadTimeDays,
      payment_terms: row.paymentTerms,
      price_type: 'estimativa',
      sources_json: row.notes ? [row.notes] : [],
      matrix_id: matrixId,
      score_display: heur.score,
      score_label: heur.label,
    });
    ids.push(q.id);
  }
  return ids;
}
