import { describe, it, expect, beforeEach } from 'vitest';
import {
  dossierGaps,
  heuristicQuoteScore,
  isVolumeEvaluationActive,
  missingCommercialForApprove,
} from '../core/intranet/dossierGaps';
import { persistIngestQuotes } from '../core/intranet/quoteLedger';
import { SqliteIntranetStore, resetIntranetStoreForTests } from '../core/intranet/intranetStore';

describe('dossierGaps + ops volume', () => {
  it('flag off → sem gap volume mesmo com 1 un', () => {
    const gaps = dossierGaps(
      {
        unit_price: 40,
        landed_monthly: 6000,
        lead_time_days: 3,
        volume: '1 un / mês',
      },
      { ops_real_started: false, ops_real_started_at: null },
    );
    expect(gaps).not.toContain('volume operacional');
    expect(gaps).toEqual([]);
  });

  it('flag on + 90d → gap volume em 1 un', () => {
    const started = new Date('2026-01-01T00:00:00.000Z');
    const now = new Date('2026-04-01T00:00:00.000Z');
    expect(
      isVolumeEvaluationActive(
        { ops_real_started: true, ops_real_started_at: started.toISOString() },
        now,
      ),
    ).toBe(true);
    const gaps = dossierGaps(
      {
        unit_price: 40,
        landed_monthly: 6000,
        lead_time_days: 3,
        volume: '1 un / mês',
      },
      { ops_real_started: true, ops_real_started_at: started.toISOString() },
      now,
    );
    expect(gaps).toContain('volume operacional');
  });

  it('missingCommercialForApprove true sem preço', () => {
    expect(missingCommercialForApprove({ unit_price: null, landed_monthly: 100 })).toBe(true);
    expect(missingCommercialForApprove({ unit_price: 10, landed_monthly: 100 })).toBe(false);
  });

  it('heuristicQuoteScore rotula explicitamente', () => {
    expect(heuristicQuoteScore({ isWinner: true, supplierUf: 'SP' }).label).toMatch(/heurística/);
    expect(heuristicQuoteScore({ isWinner: false, supplierUf: 'SC' }).score).toBe(86);
  });
});

describe('quoteLedger persist', () => {
  beforeEach(() => {
    resetIntranetStoreForTests();
  });

  it('upsert supplier+quote from ingest-shaped row', () => {
    const store = new SqliteIntranetStore(':memory:');
    const ids = persistIngestQuotes(store, [
      {
        supplierName: 'Mosplast (SC)',
        supplierState: 'SC',
        contactEmail: 'vendas@mosplast.example',
        accountCode: '5.1.01.03',
        materialCategory: 'Filme Stretch',
        productDescription: 'Filme Stretch 500mm',
        unitPrice: 182.5,
        shippingCostMonthly: 0,
        totalMonthlyWithFreight: 217.5,
        monthlyVolumeUnit: 1,
        deliveryLeadTimeDays: 5,
        isRecommendedWinner: true,
        notes: 'pack',
      },
    ]);
    expect(ids).toHaveLength(1);
    const q = store.getQuote(ids[0]);
    expect(q).toBeTruthy();
    expect(q!.price_type).toBe('estimativa');
    expect(q!.unit_price_brl).toBe(182.5);
    expect(q!.score_label).toMatch(/heurística/);
    expect(store.getOpsRealFlags().ops_real_started).toBe(false);
    store.setOpsRealStarted(true, '2026-01-15T00:00:00.000Z');
    expect(store.getOpsRealFlags()).toEqual({
      ops_real_started: true,
      ops_real_started_at: '2026-01-15T00:00:00.000Z',
    });
  });
});
