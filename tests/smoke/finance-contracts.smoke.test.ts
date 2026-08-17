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
  coaMaeFilha,
  groupLedgerBySyntheticParent,
  ledgerAmount24m,
  occupancyAmountForMonth,
  projectDreFromLedger,
  summarizeLiveDre,
  OCCUPANCY_SYNTHETIC_CODE,
  RENT_ANALYTIC_CODE,
} from '../../src/core/engine';
import { defaultParams } from '../../src/core/params';
import { applyScenarioDrivers, DEFAULT_SCENARIO_DRIVERS } from '../../src/core/scenarioDrivers';
import { ledgerToRow, rowToLedger, accountToRow, rowToAccount } from '../../src/core/operator/financeMappers';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../../src/data/initialData';
import { PLANO_DE_CONTAS_ITEMS } from '../../src/data/planoDeContasData';
import type { AccountItem } from '../../src/data/planoDeContasData';
import { OFFICIAL_TOTALS_24M } from '../../src/core/bpV35Reference';
import {
  LIVE_EXPORT_SEAL,
  buildLiveDreExport,
  formatBrlCell,
  pdfLedgerTable,
  pdfMonthTable,
  renderLiveDreCsv,
} from '../../src/utils/liveExport';

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
    expect(coaMaeFilha('4.1.04.01')).toEqual({ mae: '4.1.04', filha: '4.1.04.01' });
    expect(coaMaeFilha('5.2.02')).toEqual({ mae: '5.2.02', filha: undefined });
    const groups = groupLedgerBySyntheticParent([
      desp({ id: 'rent', accountCode: '5.2.02.01' }),
      desp({ id: 'condo', accountCode: '5.2.02.02' }),
      desp({ id: 'clia', accountCode: '4.1.04.01' }),
    ]);
    expect(groups.map((g) => g.parentCode)).toEqual(['5.2.02', '4.1.04']);
    expect(groups[0].items.map((i) => i.id)).toEqual(['rent', 'condo']);
    expect(groups[1].items.map((i) => i.accountCode)).toEqual(['4.1.04.01']);
  });

  it('linha nova M3 (ledger) entra no 1:N da mãe do plano, composition não é filha CoA', () => {
    const clia = INITIAL_GRANULAR_DRE_ITEMS.find((i) => i.id === 'rec-4pl-ct')!;
    expect(clia.accountCode).toBe('4.1.04.01');
    expect(PLANO_DE_CONTAS_ITEMS.find((a) => a.code === '4.1.04')?.type).toBe('Sintética');
    const nova = desp({
      id: 'dre-item-nova-clia',
      section: 'receita',
      name: 'Nova receita 4PL',
      accountCode: '4.1.04.02',
      monthlyAmountY1: 1_000,
      monthlyAmountY2: 1_000,
    });
    const groups = groupLedgerBySyntheticParent([clia, nova]);
    expect(groups).toHaveLength(1);
    expect(groups[0].parentCode).toBe('4.1.04');
    expect(groups[0].items.map((i) => i.id)).toEqual(['rec-4pl-ct', 'dre-item-nova-clia']);
    expect(groups[0].items.every((i) => !i.composition || i.id === 'rec-4pl-ct')).toBe(true);
    expect(clia.composition?.some((c) => c.id === 'rec-clia-tower')).toBe(true);
    expect(groups[0].items.some((i) => i.id === 'rec-clia-tower')).toBe(false);
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

const SMOKE_COA: AccountItem = {
  code: '4.1.04.98',
  name: 'SMOKE M3 receita 4PL (apagar)',
  level: 4,
  group: 'RECEITAS',
  nature: 'Credora',
  type: 'Analítica',
  costCenterId: 'CC 001',
  notes: 'Smoke M3 cria+edita — cleanup DELETE',
};

function smokeLedger(y1: number): DreGranularItem {
  return {
    id: 'smoke-m3-4pl-98',
    section: 'receita',
    type: 'servico',
    category: '4PL Upside',
    name: 'SMOKE linha M3 4.1.04.98',
    monthlyAmountY1: y1,
    monthlyAmountY2: y1,
    active: true,
    accountCode: SMOKE_COA.code,
    costCenterId: 'CC 001',
    costBehavior: 'fixed',
    manualOverride: true,
  };
}

describe('smoke M3 cria conta+valor e edita existente', () => {
  it('nova analítica round-trip + lançamento com valor entra na mãe 4.1.04 e no DRE M7', () => {
    expect(PLANO_DE_CONTAS_ITEMS.find((a) => a.code === '4.1.04')?.type).toBe('Sintética');
    expect(canPostToAccount(SMOKE_COA)).toBe(true);
    const persistedAcc = rowToAccount(accountToRow(SMOKE_COA));
    expect(persistedAcc.code).toBe('4.1.04.98');
    expect(persistedAcc.type).toBe('Analítica');

    const created = smokeLedger(1_500);
    const restored = rowToLedger(ledgerToRow(created));
    expect(restored.accountCode).toBe('4.1.04.98');
    expect(restored.monthlyAmountY1).toBe(1_500);
    expect(restored.manualOverride).toBe(true);

    const clia = INITIAL_GRANULAR_DRE_ITEMS.find((i) => i.id === 'rec-4pl-ct')!;
    const groups = groupLedgerBySyntheticParent([clia, restored]);
    expect(groups).toHaveLength(1);
    expect(groups[0].parentCode).toBe('4.1.04');
    expect(groups[0].items.map((i) => i.accountCode)).toEqual(['4.1.04.01', '4.1.04.98']);

    const before = projectDreFromLedger(INITIAL_GRANULAR_DRE_ITEMS, 0.75);
    const after = projectDreFromLedger([...INITIAL_GRANULAR_DRE_ITEMS, restored], 0.75);
    expect(after[6].receitaServicos - before[6].receitaServicos).toBe(1_500);
  });

  it('editar linha existente (Armazenagem Y1) altera DRE e sobrevive mapper PUT', () => {
    const seed = INITIAL_GRANULAR_DRE_ITEMS.find((i) => i.id === 'rec-armazenagem')!;
    expect(seed.accountCode).toBe('4.1.01.01');
    const edited = {
      ...seed,
      monthlyAmountY1: seed.monthlyAmountY1 + 2_000,
      manualOverride: true,
    };
    const restored = rowToLedger(ledgerToRow(edited));
    expect(restored.id).toBe('rec-armazenagem');
    expect(restored.monthlyAmountY1).toBe(seed.monthlyAmountY1 + 2_000);
    expect(restored.accountCode).toBe('4.1.01.01');

    const before = projectDreFromLedger(INITIAL_GRANULAR_DRE_ITEMS, 0.75);
    const ledger = INITIAL_GRANULAR_DRE_ITEMS.map((i) => (i.id === edited.id ? restored : i));
    const after = projectDreFromLedger(ledger, 0.75);
    expect(after[6].receitaServicos - before[6].receitaServicos).toBe(2_000);
    expect(coaMaeFilha(restored.accountCode)).toEqual({ mae: '4.1.01', filha: '4.1.01.01' });
  });
});

describe('smoke CSV + PDF sync (mesmo payload live)', () => {
  it('CSV TOTAL_24M = summarizeLiveDre = células PDF', () => {
    const months = projectDreFromLedger(INITIAL_GRANULAR_DRE_ITEMS, 0.75);
    const { csv, pack } = renderLiveDreCsv(months, 'Base', INITIAL_GRANULAR_DRE_ITEMS);
    const live = summarizeLiveDre(months.slice(0, 24));
    expect(pack.seal).toBe(LIVE_EXPORT_SEAL);
    expect(pack.totals.receitaTotal).toBe(live.receitaTotal);
    expect(pack.totals.lucroLiquidoTotal).toBe(live.lucroLiquidoTotal);
    expect(pack.years.y1.receita + pack.years.y2.receita).toBe(live.receitaTotal);
    expect(csv).toContain(LIVE_EXPORT_SEAL);
    expect(csv).toContain('TOTAL_24M');
    expect(csv).toContain(String(live.receitaTotal));
    expect(csv).toContain(String(live.lucroLiquidoTotal));
    expect(csv).not.toContain('BASE BP CONGELADA');

    const totalRow = pack.monthRows.find((row) => row[0] === 'TOTAL_24M')!;
    expect(totalRow[1]).toBe(live.receitaTotal);
    expect(totalRow[5]).toBe(live.lucroLiquidoTotal);

    const pdf = pdfMonthTable(pack);
    const pdfTotal = pdf.rows.find((row) => row[0] === 'TOTAL_24M')!;
    expect(pdfTotal[1]).toBe(formatBrlCell(live.receitaTotal));
    expect(pdfTotal[5]).toBe(formatBrlCell(live.lucroLiquidoTotal));

    const y1Row = pack.monthRows.find((row) => row[0] === 'Y1_M1_M12')!;
    expect(y1Row[1]).toBe(pack.years.y1.receita);
    expect(pdf.rows.find((row) => row[0] === 'Y1_M1_M12')![1]).toBe(formatBrlCell(pack.years.y1.receita));
  });

  it('cria linha M3 → CSV e PDF mostram conta, Y1 e DRE M7', () => {
    const created = smokeLedger(1_500);
    const ledger = [...INITIAL_GRANULAR_DRE_ITEMS, created];
    const before = projectDreFromLedger(INITIAL_GRANULAR_DRE_ITEMS, 0.75);
    const after = projectDreFromLedger(ledger, 0.75);
    expect(after[6].receitaServicos - before[6].receitaServicos).toBe(1_500);

    const { csv, pack } = renderLiveDreCsv(after, 'Base', ledger);
    expect(csv).toContain('4.1.04.98');
    expect(csv).toContain('SMOKE linha M3 4.1.04.98');
    const led = pack.ledgerRows.find((row) => String(row[1]).includes('4.1.04.98'));
    expect(led?.[5]).toBe(1_500);
    expect(pack.monthRows[6][1]).toBe(after[6].receitaServicos);

    const pdfLed = pdfLedgerTable(pack);
    const pdfLine = pdfLed.rows.find((row) => row[1].includes('4.1.04.98'));
    expect(pdfLine?.[5]).toBe(formatBrlCell(1_500));
    expect(pdfMonthTable(pack).rows[6][1]).toBe(formatBrlCell(after[6].receitaServicos));
  });

  it('editar armazenagem Y1 → CSV ledger e TOTAL_24M acompanham', () => {
    const seed = INITIAL_GRANULAR_DRE_ITEMS.find((i) => i.id === 'rec-armazenagem')!;
    const edited = { ...seed, monthlyAmountY1: seed.monthlyAmountY1 + 2_000, manualOverride: true };
    const ledger = INITIAL_GRANULAR_DRE_ITEMS.map((i) => (i.id === edited.id ? edited : i));
    const before = projectDreFromLedger(INITIAL_GRANULAR_DRE_ITEMS, 0.75);
    const after = projectDreFromLedger(ledger, 0.75);
    expect(after[6].receitaServicos - before[6].receitaServicos).toBe(2_000);

    const { csv, pack } = renderLiveDreCsv(after, 'Base', ledger);
    const led = pack.ledgerRows.find((row) => String(row[1]).includes('4.1.01.01'));
    expect(led?.[5]).toBe(edited.monthlyAmountY1);
    expect(csv).toContain(String(edited.monthlyAmountY1));
    expect(pack.totals.receitaTotal).toBe(summarizeLiveDre(after.slice(0, 24)).receitaTotal);
    expect(pack.totals.receitaTotal).not.toBe(OFFICIAL_TOTALS_24M.receitaTotal);
  });

  it('sem dreMonths CSV/PDF vazios — nunca freeze 4.805.700', () => {
    const { csv, pack } = renderLiveDreCsv([], 'Base', []);
    expect(pack.months).toHaveLength(0);
    expect(pack.totals.receitaTotal).toBe(0);
    expect(csv).not.toContain(String(OFFICIAL_TOTALS_24M.receitaTotal));
    expect(buildLiveDreExport(undefined, []).monthRows.filter((row) => row[0] !== 'TOTAL_24M' && row[0] !== 'Y1_M1_M12' && row[0] !== 'Y2_M13_M24')).toHaveLength(0);
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

  it(
    'POST conta+linha 4.1.04.98, PUT valor, DELETE cleanup',
    async () => {
      const headers = { 'Content-Type': 'application/json' };
      const created = smokeLedger(1_500);
      const edited = smokeLedger(2_500);
      try {
        const accRes = await fetch(`${LIVE}/api/operator/finance/accounts`, {
          method: 'POST',
          headers,
          body: JSON.stringify(SMOKE_COA),
        });
        expect(accRes.ok, await accRes.text()).toBe(true);

        const postLed = await fetch(`${LIVE}/api/operator/finance/ledger`, {
          method: 'POST',
          headers,
          body: JSON.stringify(created),
        });
        expect(postLed.ok, await postLed.text()).toBe(true);

        const afterCreate = await fetch(`${LIVE}/api/operator/finance/bundle`);
        expect(afterCreate.ok).toBe(true);
        const createdBody = (await afterCreate.json()) as {
          accounts: Array<{ code: string; type: string }>;
          ledger: Array<{ id: string; accountCode?: string; monthlyAmountY1?: number }>;
        };
        expect(createdBody.accounts.find((a) => a.code === SMOKE_COA.code)?.type).toBe('Analítica');
        const line = createdBody.ledger.find((l) => l.id === created.id);
        expect(line?.accountCode).toBe(SMOKE_COA.code);
        expect(line?.monthlyAmountY1).toBe(1_500);

        const putLed = await fetch(`${LIVE}/api/operator/finance/ledger/${encodeURIComponent(created.id)}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(edited),
        });
        expect(putLed.ok, await putLed.text()).toBe(true);

        const afterEdit = await fetch(`${LIVE}/api/operator/finance/bundle`);
        const editedBody = (await afterEdit.json()) as {
          ledger: Array<{ id: string; monthlyAmountY1?: number }>;
        };
        expect(editedBody.ledger.find((l) => l.id === created.id)?.monthlyAmountY1).toBe(2_500);
      } finally {
        await fetch(`${LIVE}/api/operator/finance/ledger/${encodeURIComponent(created.id)}`, { method: 'DELETE' });
        await fetch(`${LIVE}/api/operator/finance/accounts/${encodeURIComponent(SMOKE_COA.code)}`, { method: 'DELETE' });
      }
    },
    45_000,
  );
});
