import type { HubParams } from '../params';
import { defaultParams } from '../params';
import {
  computeKpis,
  computeCliaSensitivity,
  computeForteDerived,
  compute3plPerPallet,
  summarizeOfficialDre,
  diffVsOfficialPct,
} from '../engine';
import { OFFICIAL_TOTALS_24M, OFFICIAL_DRE_MONTHS, OFFICIAL_CASHFLOW_SERIES } from '../bpV35Reference';
import { SANCO_TCO_BREAKDOWN, SANCO_VAS_BENCHMARK, FORTE_TABS } from '../../data/benchmarkData';
import type { DreMonth, DreGranularItem, VasDriver, Scenario } from '../../types';

export interface AdvisorContextInput {
  module?: string;
  scenarioName?: string;
  prompt?: string;
  params?: HubParams;
  activeScenario?: Partial<Scenario>;
  dreMonths?: DreMonth[];
  granularDreItems?: DreGranularItem[];
  vasDrivers?: VasDriver[];
  fatorR?: number;
  occupancyRate?: number;
}

export function buildAdvisorContext(input: AdvisorContextInput) {
  const params = input.params ?? defaultParams;
  const dre = input.dreMonths ?? [];
  const official = summarizeOfficialDre();

  const receitaTotal24m = dre.length
    ? dre.reduce((a, m) => a + m.receitaServicos, 0)
    : official.receitaTotal;
  const lucroLiquido24m = dre.length
    ? dre.reduce((a, m) => a + m.lucroLiquido, 0)
    : official.lucroLiquidoTotal;

  const kpis = computeKpis(params);
  const forte = computeForteDerived(params);
  const tpl3pl = compute3plPerPallet(params);

  return {
    params,
    scenario: input.activeScenario ?? {},
    fatorR: input.fatorR,
    occupancyRate: input.occupancyRate ?? params.capacity.targetOccupancy,
    dre: dre.map((m) => ({
      month: m.label,
      receita: m.receitaServicos,
      custos: m.custosOperacionais,
      despesas: m.despesasOperacionais,
      liquido: m.lucroLiquido,
    })),
    officialDreReference: OFFICIAL_DRE_MONTHS.map((m) => ({
      month: m.month,
      receita: m.receitaServicos,
      liquido: m.lucroLiquido,
    })),
    cash: OFFICIAL_CASHFLOW_SERIES.map((c) => ({
      month: c.month,
      fluxoPuro: c.fluxoLiquidoPuro,
      fluxoCarenciaAluguel: c.fluxoLiquidoCarenciaAluguel,
      saldoPuro: c.saldoAcumuladoPuro,
      saldoCarenciaAluguel: c.saldoAcumuladoCarenciaAluguel,
    })),
    granular: input.granularDreItems ?? [],
    vasDrivers: input.vasDrivers ?? [],
    kpis: {
      ...kpis,
      receitaTotal24m,
      lucroLiquido24m,
    },
    benchmarks: {
      sanco: { tco: SANCO_TCO_BREAKDOWN, vasFloors: SANCO_VAS_BENCHMARK },
      forte: {
        meta: { cifFeu: params.pricing.clia.cifFeu, palletsPerFeu: params.capacity.palletsPerFeu },
        tabs: FORTE_TABS.map((t) => ({ id: t.id, label: t.label, total: t.total, pctCif: t.pctCif })),
        derived: forte,
      },
      comparativo3pl: {
        tplPerPallet: tpl3pl,
        ratioVsEntreposto: forte.costPerPalletEntreposto30d / tpl3pl.totalPerPallet,
      },
    },
    clia: {
      sensitivity: computeCliaSensitivity(params, 5),
      spineM12: kpis.cliaSpineM12,
      spineM24: kpis.cliaSpineM24,
      pricing: params.pricing.clia,
    },
    deltasVsOfficial: {
      receitaPct: diffVsOfficialPct(receitaTotal24m, OFFICIAL_TOTALS_24M.receitaTotal),
      lucroPct: diffVsOfficialPct(lucroLiquido24m, OFFICIAL_TOTALS_24M.lucroLiquidoTotal),
      homologado:
        Math.abs(receitaTotal24m - OFFICIAL_TOTALS_24M.receitaTotal) /
          OFFICIAL_TOTALS_24M.receitaTotal <
        0.01,
    },
    module: input.module,
    scenarioName: input.scenarioName,
    userPrompt: input.prompt,
  };
}
