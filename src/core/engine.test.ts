import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from './advisor/prompt';
import { defaultParams } from './params';
import {
  computeCliaTakeRate,
  computeCliaSpineMonthly,
  computeForteDerived,
  computeRentMonthly,
  computeCondominiumMonthly,
  applyOccupancyToDreItems,
  applyScenarioPreset,
  applyTechOpexToDreItems,
  applyTechOpexToDreMonths,
  computeTechOpexMonthly,
  computeWmsProprioImpact,
  expandCompositionFilhas,
  applyCliaToDreItems,
  projectDreFromLedger,
  fatorRFolhaMensalFromLedger,
  fixedOpexMonthlyFromLedger,
  computeFatorRSeries,
  isLedgerItemLocked,
  canPostToAccount,
  isAccountInUse,
  SC_V36_WMS_PROPRIO,
  TECH_OPEX_ACCOUNT_ID,
} from './engine';
import { FORTE_ENTREPOSTO_30D, FORTE_DTC_20D } from '../data/benchmarkData';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../data/initialData';
import { OFFICIAL_TOTALS_24M } from './bpV35Reference';
import { applyScenarioDrivers } from './scenarioDrivers';
import type { ScenarioDrivers } from '../types';

function beWithin(actual: number, expected: number, tolerancePct: number) {
  const diff = Math.abs(actual - expected) / expected;
  expect(diff).toBeLessThanOrEqual(tolerancePct);
}

describe('buildSystemPrompt', () => {
  it('não contém valores monetários determinísticos do BP', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).not.toMatch(/4[\s.]?805[\s.]?700/);
    expect(prompt).not.toMatch(/570[\s.]?842/);
    expect(prompt).not.toMatch(/22[\s,]50/);
    expect(prompt).not.toMatch(/765[\s.]?446/);
  });
});

describe('Forte benchmark fixture', () => {
  it('totais batem com planilha Forte 2026', () => {
    const sumEntreposto = FORTE_ENTREPOSTO_30D.lines.reduce((a, l) => a + l.value, 0);
    const sumDtc = FORTE_DTC_20D.lines.reduce((a, l) => a + l.value, 0);
    beWithin(sumEntreposto, 9_728.63, 0.001);
    beWithin(sumDtc, 5_881.06, 0.001);
  });

  it('percentuais CIF corretos', () => {
    const d = computeForteDerived(defaultParams);
    beWithin(d.entrepostoPctCif, 0.02923, 0.001);
    beWithin(d.dtcPctCif, 0.01767, 0.001);
  });
});

describe('CLIA take rate', () => {
  it('1 FEU take rate mínimo ≈ R$ 890,72', () => {
    const r = computeCliaTakeRate(defaultParams, 1);
    beWithin(r.takeRateMin, 890.72, 0.01);
  });

  it('2 FEU take rate máx ≈ R$ 2.091,34', () => {
    const r = computeCliaTakeRate(defaultParams, 2);
    beWithin(r.takeRateMax, 2_091.34, 0.01);
  });

  it('spine M12 ≈ R$ 6.274 (3 clientes × 2 FEU)', () => {
    const spine = computeCliaSpineMonthly(12, defaultParams);
    beWithin(spine, 6_274, 0.02);
  });
});

describe('official DRE fixture', () => {
  it('tetos consolidados BP v3.5 no fixture', () => {
    expect(OFFICIAL_TOTALS_24M.receitaTotal).toBe(4_805_700);
    expect(OFFICIAL_TOTALS_24M.lucroLiquidoTotal).toBe(570_842);
    expect(OFFICIAL_TOTALS_24M.saldoCaixaM24CarenciaAluguel).toBe(765_446);
  });
});

describe('computeForteDerived', () => {
  it('custo/palete entreposto 30d ≈ R$ 442', () => {
    const d = computeForteDerived(defaultParams);
    beWithin(d.costPerPalletEntreposto30d, 442, 0.01);
  });
});

describe('ocupação — aluguel e condomínio', () => {
  it('aluguel = 2.500 m² × R$ 24', () => {
    expect(computeRentMonthly(defaultParams, 1)).toBe(60_000);
    expect(computeRentMonthly(defaultParams, 2)).toBe(63_000);
  });

  it('condomínio = R$ 2,60/m² × 2.500 m²', () => {
    expect(computeCondominiumMonthly(defaultParams, 1)).toBe(6_500);
    expect(computeCondominiumMonthly(defaultParams, 2)).toBe(6_825);
  });

  it('não usa 2,5% do aluguel (R$ 1.500)', () => {
    expect(computeCondominiumMonthly(defaultParams, 1)).not.toBe(1_500);
    expect(computeCondominiumMonthly(defaultParams, 1)).not.toBe(
      Math.round(computeRentMonthly(defaultParams, 1) * 0.025),
    );
  });

  it('DRE granular de ocupação sobrescreve valor chutado', () => {
    const patched = applyOccupancyToDreItems(
      [
        {
          id: 'cst-condominio',
          section: 'despesa',
          type: 'fixo',
          category: 'Ocupação',
          name: 'Condomínio Logístico',
          monthlyAmountY1: 1_500,
          monthlyAmountY2: 1_575,
          active: true,
        },
      ],
      defaultParams,
    );
    expect(patched[0].monthlyAmountY1).toBe(6_500);
    expect(patched[0].monthlyAmountY2).toBe(6_825);
  });
});

describe('cenário v3.6-wms-proprio', () => {
  const v36Params = applyScenarioPreset(defaultParams, SC_V36_WMS_PROPRIO);

  it('OPEX tech = Logcomex 2.500 + cloud 500', () => {
    expect(computeTechOpexMonthly(defaultParams)).toBe(0);
    expect(computeTechOpexMonthly(v36Params)).toBe(3_000);
  });

  it('DAS permanece igual; líquido cai R$ 3.000', () => {
    const overlay = applyTechOpexToDreMonths(
      [
        {
          month: 7,
          label: 'M7',
          receitaServicos: 205_200,
          das6Percent: 12_312,
          irpj: 492,
          csll: 431,
          pisCofinsCppIss: 11_389,
          custosOperacionais: 63_905,
          despesasOperacionais: 133_704,
          lucroLiquido: 14_279,
        },
      ],
      v36Params,
    );
    expect(overlay[0].das6Percent).toBe(12_312);
    expect(overlay[0].despesasOperacionais).toBe(136_704);
    expect(overlay[0].lucroLiquido).toBe(11_279);
  });

  it('totais 24m = v3.5 menos R$ 72.000, CAPEX inalterado', () => {
    const impact = computeWmsProprioImpact(v36Params);
    expect(impact.lucro24m).toBe(498_842);
    expect(impact.lucroAno1).toBe(284_090);
    expect(impact.lucroAno2).toBe(214_752);
    expect(impact.llM7Plus).toBe(11_279);
    expect(impact.saldoM24CarenciaAluguel).toBe(693_446);
    expect(impact.capexTotal).toBe(207_300);
    expect(impact.capexDeltaVsV35).toBe(0);
    expect(impact.saldoM0).toBe(59_700);
    expect(impact.wmsSoftwareCash).toBe(0);
    expect(impact.dasUnchanged).toBe(true);
  });

  it('injeta linha granular de OPEX tech', () => {
    const items = applyTechOpexToDreItems([], v36Params);
    expect(items[0].id).toBe(TECH_OPEX_ACCOUNT_ID);
    expect(items[0].monthlyAmountY1).toBe(3_000);
  });
});

describe('ledger DRE ao vivo', () => {
  it('DAS é 6% da receita projetada', () => {
    const months = projectDreFromLedger(
      [
        {
          id: 'rec-1',
          section: 'receita',
          type: 'servico',
          category: 'Teste',
          name: 'Receita',
          monthlyAmountY1: 100_000,
          monthlyAmountY2: 100_000,
          active: true,
        },
      ],
      0.75,
    );
    expect(months[11].receitaServicos).toBe(100_000);
    expect(months[11].das6Percent).toBe(6_000);
  });

  it('DAS lê params.pricing.dasPct (não literal 0.06)', () => {
    const months = projectDreFromLedger(
      [
        {
          id: 'rec-1',
          section: 'receita',
          type: 'servico',
          category: 'Teste',
          name: 'Receita',
          monthlyAmountY1: 100_000,
          monthlyAmountY2: 100_000,
          active: true,
        },
      ],
      0.75,
      { ...defaultParams, pricing: { ...defaultParams.pricing, dasPct: 0.05 } },
    );
    expect(months[11].das6Percent).toBe(5_000);
  });

  it('carência zera aluguel em M1–M6', () => {
    const months = projectDreFromLedger(
      [
        {
          id: 'cst-aluguel',
          section: 'despesa',
          type: 'fixo',
          category: 'Ocupação',
          name: 'Aluguel',
          monthlyAmountY1: 60_000,
          monthlyAmountY2: 63_000,
          active: true,
        },
        {
          id: 'cst-fixa',
          section: 'despesa',
          type: 'fixo',
          category: 'Admin',
          name: 'Fixa',
          monthlyAmountY1: 10_000,
          monthlyAmountY2: 10_000,
          active: true,
        },
      ],
      0.75,
    );
    expect(months[0].despesasOperacionais).toBeLessThan(60_000);
    expect(months[11].despesasOperacionais).toBe(70_000);
  });

  it('ocupação não sobrescreve linha com manualOverride', () => {
    const patched = applyOccupancyToDreItems(
      [
        {
          id: 'cst-condominio',
          section: 'despesa',
          type: 'fixo',
          category: 'Ocupação',
          name: 'Condomínio Logístico',
          monthlyAmountY1: 1_500,
          monthlyAmountY2: 1_575,
          active: true,
          manualOverride: true,
        },
      ],
      defaultParams,
    );
    expect(patched[0].monthlyAmountY1).toBe(1_500);
  });

  it('CLIA permanece fórmula viva', () => {
    const patched = applyCliaToDreItems(
      [
        {
          id: 'rec-4pl-ct',
          section: 'receita',
          type: 'servico',
          category: '4PL',
          name: 'CLIA',
          monthlyAmountY1: 1,
          monthlyAmountY2: 1,
          active: true,
          engineLocked: true,
        },
      ],
      defaultParams,
    );
    expect(patched[0].monthlyAmountY1).toBe(computeCliaSpineMonthly(12, defaultParams));
    expect(isLedgerItemLocked(patched[0])).toBe(true);
    expect(patched[0].composition?.map((c) => c.accountCode)).toEqual([
      '4.1.04.01',
      '4.1.04.02',
      '4.1.04.03',
      '4.1.04.04',
    ]);
    const filhas = expandCompositionFilhas(patched);
    expect(filhas).toHaveLength(4);
    expect(filhas.reduce((a, i) => a + i.monthlyAmountY1, 0)).toBe(patched[0].monthlyAmountY1);
  });

  it('conta sintética não lança valor', () => {
    expect(canPostToAccount({ type: 'Sintética' })).toBe(false);
    expect(canPostToAccount({ type: 'Analítica' })).toBe(true);
  });

  it('bloqueia exclusão de conta em uso', () => {
    expect(
      isAccountInUse('5.2.02.01', [
        {
          id: 'cst-aluguel',
          section: 'despesa',
          type: 'fixo',
          category: 'Ocupação',
          name: 'Aluguel',
          monthlyAmountY1: 60_000,
          monthlyAmountY2: 63_000,
          active: true,
          accountCode: '5.2.02.01',
        },
      ]),
    ).toBe(true);
  });
});

describe('fatorRFolhaMensalFromLedger', () => {
  it('soma só linhas com isFatorRNumerator explícito', () => {
    const folha = fatorRFolhaMensalFromLedger(INITIAL_GRANULAR_DRE_ITEMS, defaultParams, 4);
    expect(folha).toBe(49_500 + 7_000);
  });

  it('ignora hc sem flag isFatorRNumerator', () => {
    const items = INITIAL_GRANULAR_DRE_ITEMS.map((i) =>
      i.id === 'cst-pessoal-clt-pl' ? { ...i, isFatorRNumerator: undefined } : i,
    );
    const folha = fatorRFolhaMensalFromLedger(items, defaultParams, 4);
    expect(folha).toBe(7_000);
  });

  it('MO terceirizada ENTRA quando excluded=false e numerator=true (regressão)', () => {
    const withMo = INITIAL_GRANULAR_DRE_ITEMS.map((i) =>
      i.id === 'cst-mo-terceirizada'
        ? { ...i, isFatorRNumerator: true, isFatorRExcluded: false }
        : i,
    );
    const folha = fatorRFolhaMensalFromLedger(withMo, defaultParams, 4);
    expect(folha).toBeGreaterThan(49_500 + 7_000);
  });

  it('M13+ numerador usa Y2 nas linhas elegíveis', () => {
    const m4 = fatorRFolhaMensalFromLedger(INITIAL_GRANULAR_DRE_ITEMS, defaultParams, 4);
    const m24 = fatorRFolhaMensalFromLedger(INITIAL_GRANULAR_DRE_ITEMS, defaultParams, 24);
    expect(m24).toBeGreaterThan(m4);
  });

  it('hcOpexFactor infla folha no pipeline — Fator R deve usar ledger base (P0)', () => {
    const drivers: ScenarioDrivers = {
      occupancyRate: 0.75,
      rentFactor: 1,
      cogsVariableFactor: 1,
      hcOpexFactor: 1.3,
      techOpexActive: false,
    };
    const baseFolha = fatorRFolhaMensalFromLedger(INITIAL_GRANULAR_DRE_ITEMS, defaultParams, 7);
    const driven = applyScenarioDrivers(INITIAL_GRANULAR_DRE_ITEMS, drivers);
    const pipelineFolha = fatorRFolhaMensalFromLedger(driven, defaultParams, 7);
    expect(pipelineFolha).toBeGreaterThan(baseFolha);
    expect(fatorRFolhaMensalFromLedger(INITIAL_GRANULAR_DRE_ITEMS, defaultParams, 7)).toBe(baseFolha);
  });
});

describe('computeFatorRSeries', () => {
  it('M1: janela = 1 mês (instantâneo só no primeiro mês)', () => {
    const months = projectDreFromLedger(INITIAL_GRANULAR_DRE_ITEMS, 0.75);
    const [r1] = computeFatorRSeries(INITIAL_GRANULAR_DRE_ITEMS, months, defaultParams);
    expect(r1.folhaJanela).toBe(r1.folhaMes);
    expect(r1.rbtJanela).toBe(months[0].receitaServicos);
  });

  it('M12 cumulativo; M13+ vira trailing-12 rolante', () => {
    const months = projectDreFromLedger(INITIAL_GRANULAR_DRE_ITEMS, 0.75);
    const s = computeFatorRSeries(INITIAL_GRANULAR_DRE_ITEMS, months, defaultParams);
    expect(s[11].folhaJanela).toBe(s.slice(0, 12).reduce((a, r) => a + r.folhaMes, 0));
    expect(s[12].folhaJanela).toBe(s.slice(1, 13).reduce((a, r) => a + r.folhaMes, 0));
    expect(s[23].folhaJanela).toBe(804_000);
  });
});

describe('fixedOpexMonthlyFromLedger', () => {
  it('inclui custo+despesa fixos + HC, exclui PL adicional', () => {
    const total = fixedOpexMonthlyFromLedger(INITIAL_GRANULAR_DRE_ITEMS);
    // 49.500 (CLT) + 4.400 (máquinas) + 3.704 (deprec) + 60.000 (aluguel) + 6.500 (condomínio)
    expect(total).toBe(124_104);
    const comPlAdicional = fixedOpexMonthlyFromLedger(
      INITIAL_GRANULAR_DRE_ITEMS.map((i) =>
        i.id === 'cst-pl-adicional' ? { ...i, monthlyAmountY1: 99_000 } : i,
      ),
    );
    expect(comPlAdicional).toBe(total);
  });

  it('exclui linhas variable do seed', () => {
    const comMo = fixedOpexMonthlyFromLedger(
      INITIAL_GRANULAR_DRE_ITEMS.map((i) =>
        i.id === 'cst-mo-terceirizada'
          ? { ...i, type: 'fixo' as const, costBehavior: 'fixed' as const }
          : i,
      ),
    );
    expect(comMo).toBe(124_104 + 12_000);
  });
});
