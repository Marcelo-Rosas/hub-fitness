/**
 * SSOT smoke financeiro: CoA ↔ ledger ↔ engine ↔ Operator live.
 * Unit internals ficam em src/core/*.test.ts. Este arquivo = persistência entre contratos.
 */
import { describe, it, expect } from 'vitest';
import type { DreGranularItem, DreMonth } from '../../src/types';
import {
  applyOccupancyToDreItems,
  canPostToAccount,
  coaSyntheticParent,
  ledgerAmount24m,
  occupancyAmountForMonth,
  projectDreFromLedger,
  summarizeLiveDre,
  OCCUPANCY_SYNTHETIC_CODE,
  RENT_ANALYTIC_CODE,
} from '../../src/core/engine';
import { defaultParams } from '../../src/core/params';
import { applyScenarioDrivers, DEFAULT_SCENARIO_DRIVERS } from '../../src/core/scenarioDrivers';
import { ledgerToRow, rowToLedger } from '../../src/core/operator/financeMappers';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../../src/data/initialData';
import { PLANO_DE_CONTAS_ITEMS } from '../../src/data/planoDeContasData';
import { OFFICIAL_TOTALS_24M } from '../../src/core/bpV35Reference';

const LIVE = process.env.SMOKE_LIVE_URL ?? 'https://hub.vectracargo.com.br';

function desp(partial: Partial<DreGranularItem> & Pick<DreGranularItem, 'id'>): DreGranularItem {
  return {
    section: 'despesa',
    type: 'fixo',
    category: 'Ocupação',
    name: partial.name ?? partial.id,
    monthlyAmountY1: 0,
    monthlyAmountY2: 0,
    active: true,
    ...partial,
  };
}

function month(partial: Partial<DreMonth> & Pick<DreMonth, 'month'>): DreMonth {
  return {
    label: `M${partial.month}`,
    receitaServicos: 0,
    das6Percent: 0,
    irpj: 0,
    csll: 0,
    pisCofinsCppIss: 0,
    custosOperacionais: 0,
    despesasOperacionais: 0,
    lucroLiquido: 0,
    ...partial,
  };
}

describe('smoke CoA 5.2.02 → DRE', () => {
  it('conta sintética 5.2.02 não recebe lançamento', () => {
    expect(canPostToAccount({ type: 'Sintética' })).toBe(false);
    expect(OCCUPANCY_SYNTHETIC_CODE).toBe('5.2.02');
    expect(RENT_ANALYTIC_CODE).toBe('5.2.02.01');
    expect(coaSyntheticParent('5.2.02.01')).toBe('5.2.02');
    expect(coaSyntheticParent('5.2.02')).toBe('5.2.02');
  });

  it('carência 6m zera 5.2.02.01 mesmo sem id cst-aluguel (edit M3)', () => {
    const months = projectDreFromLedger(
      [
        desp({
          id: 'dre-item-manual-rent',
          name: 'Aluguel M3',
          accountCode: '5.2.02.01',
          monthlyAmountY1: 60_000,
          monthlyAmountY2: 63_000,
        }),
        desp({
          id: 'cst-admin',
          name: 'Admin',
          accountCode: '5.2.03.01',
          monthlyAmountY1: 10_000,
          monthlyAmountY2: 10_000,
        }),
      ],
      0.75,
    );
    expect(months[0].despesasOperacionais).toBeLessThan(20_000);
    expect(months[5].despesasOperacionais).toBeLessThan(20_000);
    expect(months[6].despesasOperacionais).toBe(70_000);
  });

  it('5.2.02.02 condomínio não entra na carência de aluguel', () => {
    const months = projectDreFromLedger(
      [
        desp({
          id: 'cst-condominio',
          accountCode: '5.2.02.02',
          monthlyAmountY1: 6_500,
          monthlyAmountY2: 6_825,
        }),
      ],
      0.75,
    );
    expect(months[0].despesasOperacionais).toBe(6_500);
    expect(months[6].despesasOperacionais).toBe(6_500);
  });

  it('24m de 5.2.02.01 = 6×Y1 + 12×Y2 (não 12+12)', () => {
    const rent = desp({
      id: 'cst-aluguel',
      accountCode: '5.2.02.01',
      monthlyAmountY1: 60_000,
      monthlyAmountY2: 63_000,
    });
    expect(ledgerAmount24m(rent, defaultParams)).toBe(6 * 60_000 + 12 * 63_000);
    expect(ledgerAmount24m(rent, defaultParams)).not.toBe(12 * 60_000 + 12 * 63_000);
  });

  it('IPTU 5.2.02.03 e energia 5.2.02.04 cheios em M1', () => {
    const months = projectDreFromLedger(
      [
        desp({ id: 'dre-iptu', accountCode: '5.2.02.03', monthlyAmountY1: 2_000, monthlyAmountY2: 2_000 }),
        desp({ id: 'dre-energia', accountCode: '5.2.02.04', monthlyAmountY1: 3_000, monthlyAmountY2: 3_000 }),
      ],
      0.75,
    );
    expect(months[0].despesasOperacionais).toBe(5_000);
    expect(months[6].despesasOperacionais).toBe(5_000);
  });
});

describe('smoke persistência mapper → engine', () => {
  it('PUT ledger round-trip preserva 5.2.02.01 e carência', () => {
    const edited = desp({
      id: 'cst-aluguel',
      accountCode: '5.2.02.01',
      monthlyAmountY1: 80_000,
      monthlyAmountY2: 84_000,
      manualOverride: true,
    });
    const restored = rowToLedger(ledgerToRow(edited));
    expect(restored.accountCode).toBe('5.2.02.01');
    expect(restored.manualOverride).toBe(true);
    const months = projectDreFromLedger([restored], 0.75);
    expect(months[0].despesasOperacionais).toBe(0);
    expect(months[6].despesasOperacionais).toBe(80_000);
    expect(months[12].despesasOperacionais).toBe(84_000);
  });

  it('M3 override sobrevive applyOccupancy e entra no DRE', () => {
    const edited = desp({
      id: 'dre-item-manual-rent',
      accountCode: '5.2.02.01',
      monthlyAmountY1: 90_000,
      monthlyAmountY2: 94_500,
      manualOverride: true,
    });
    const condo = desp({
      id: 'cst-condominio',
      accountCode: '5.2.02.02',
      monthlyAmountY1: 6_500,
      monthlyAmountY2: 6_825,
    });
    const afterOcc = applyOccupancyToDreItems([edited, condo], defaultParams);
    expect(afterOcc.find((i) => i.id === 'dre-item-manual-rent')!.monthlyAmountY1).toBe(90_000);
    const condoLive = afterOcc.find((i) => i.id === 'cst-condominio')!.monthlyAmountY1;
    const months = projectDreFromLedger(afterOcc, 0.75);
    expect(occupancyAmountForMonth(afterOcc, 1, defaultParams)).toBe(condoLive);
    expect(occupancyAmountForMonth(afterOcc, 7, defaultParams)).toBe(90_000 + condoLive);
    expect(months[0].despesasOperacionais).toBe(condoLive);
    expect(months[6].despesasOperacionais).toBe(90_000 + condoLive);
  });

  it('seed ledger: toda conta é Analítica e sobrevive mapper PUT', () => {
    for (const item of INITIAL_GRANULAR_DRE_ITEMS) {
      expect(item.accountCode, item.id).toBeTruthy();
      const acc = PLANO_DE_CONTAS_ITEMS.find((a) => a.code === item.accountCode);
      expect(acc, `${item.id} ${item.accountCode}`).toBeTruthy();
      expect(acc!.type, `${item.accountCode}`).toBe('Analítica');
      expect(canPostToAccount(acc)).toBe(true);
      const restored = rowToLedger(ledgerToRow(item));
      expect(restored.accountCode).toBe(item.accountCode);
      expect(restored.monthlyAmountY1).toBe(item.monthlyAmountY1);
      expect(restored.monthlyAmountY2).toBe(item.monthlyAmountY2);
      expect(restored.section).toBe(item.section);
      expect(restored.costBehavior ?? null).toBe(item.costBehavior ?? null);
    }
  });

  it('rentFactor escala 5.2.02.01/02 por CoA; IPTU 5.2.02.03 não', () => {
    const items = [
      desp({
        id: 'dre-item-manual-rent',
        accountCode: '5.2.02.01',
        monthlyAmountY1: 80_000,
        monthlyAmountY2: 84_000,
      }),
      desp({
        id: 'dre-item-manual-condo',
        accountCode: '5.2.02.02',
        monthlyAmountY1: 6_500,
        monthlyAmountY2: 6_500,
      }),
      desp({
        id: 'dre-item-iptu',
        accountCode: '5.2.02.03',
        monthlyAmountY1: 2_000,
        monthlyAmountY2: 2_000,
      }),
    ];
    const out = applyScenarioDrivers(items, { ...DEFAULT_SCENARIO_DRIVERS, rentFactor: 0.9 });
    expect(out.find((i) => i.id === 'dre-item-manual-rent')!.monthlyAmountY1).toBe(72_000);
    expect(out.find((i) => i.id === 'dre-item-manual-condo')!.monthlyAmountY1).toBe(5_850);
    expect(out.find((i) => i.id === 'dre-item-iptu')!.monthlyAmountY1).toBe(2_000);
  });
});

describe('smoke DRE live KPIs (não CSV)', () => {
  it('KPI 24m = soma das linhas, não fixture CSV', () => {
    const months = [
      month({
        month: 1,
        receitaServicos: 131_119,
        custosOperacionais: 47_929,
        despesasOperacionais: 58_366,
        das6Percent: 7_867,
        lucroLiquido: 16_957,
      }),
      month({
        month: 2,
        receitaServicos: 144_231,
        custosOperacionais: 51_124,
        despesasOperacionais: 60_034,
        das6Percent: 8_654,
        lucroLiquido: 24_420,
      }),
    ];
    const t = summarizeLiveDre(months);
    expect(t.receitaTotal).toBe(131_119 + 144_231);
    expect(t.lucroLiquidoTotal).toBe(16_957 + 24_420);
    expect(t.receitaTotal).not.toBe(OFFICIAL_TOTALS_24M.receitaTotal);
    expect(t.lucroLiquidoTotal).not.toBe(OFFICIAL_TOTALS_24M.lucroLiquidoTotal);
  });

  it('margem = LL / receita live, nunca 11,9% petrificado', () => {
    const months = [month({ month: 1, receitaServicos: 5_014_524, lucroLiquido: 227_342 })];
    const t = summarizeLiveDre(months);
    expect(t.margemLiquidaPercent).toBeCloseTo((227_342 / 5_014_524) * 100, 5);
    expect(t.margemLiquidaPercent).not.toBeCloseTo(11.9, 1);
  });
});

describe('smoke live Operator', () => {
  it(
    'GET /api/health',
    async () => {
      const res = await fetch(`${LIVE}/api/health`);
      expect(res.ok).toBe(true);
      const body = (await res.json()) as { ok?: boolean; status?: string };
      expect(body.ok === true || body.status === 'ok' || res.status === 200).toBe(true);
    },
    20_000,
  );

  it(
    'GET /api/operator/scenarios ≥ 4',
    async () => {
      const res = await fetch(`${LIVE}/api/operator/scenarios`);
      expect(res.ok).toBe(true);
      const body = (await res.json()) as { success: boolean; scenarios: unknown[] };
      expect(body.success).toBe(true);
      expect(body.scenarios.length).toBeGreaterThanOrEqual(4);
    },
    20_000,
  );

  it(
    'GET /api/operator/finance/bundle: 5.2.02 sintética + ledger analíticas',
    async () => {
      const res = await fetch(`${LIVE}/api/operator/finance/bundle`);
      expect(res.ok).toBe(true);
      const body = (await res.json()) as {
        success: boolean;
        accounts: Array<{ code: string; type: string }>;
        ledger: Array<{ id: string; accountCode?: string }>;
      };
      expect(body.success).toBe(true);
      const occ = body.accounts.find((a) => a.code === '5.2.02');
      expect(occ?.type).toBe('Sintética');
      const rent = body.ledger.find((l) => l.accountCode === '5.2.02.01' || l.id === 'cst-aluguel');
      const condo = body.ledger.find((l) => l.accountCode === '5.2.02.02' || l.id === 'cst-condominio');
      expect(rent).toBeTruthy();
      expect(condo).toBeTruthy();
      expect(body.ledger.some((l) => l.accountCode === '5.2.02')).toBe(false);
    },
    20_000,
  );
});
