import type { DreGranularItem, DreMonth, DreSection, HubParams, ScenarioDrivers } from '../types';
import { OFFICIAL_TOTALS_24M } from './bpV35Reference';
import {
  fatorRFolhaMensalFromLedger,
  semiFixedOpexMonthlyFromLedger,
} from './engine';
import { applyMixPreview } from './mixPreview';
import { DEFAULT_SCENARIO_DRIVERS, projectScenario } from './scenarioDrivers';

export type ContractId =
  | 'A_PROJETADO'
  | 'B_CHEIO'
  | 'C_CANONICO'
  | 'D_TRAILING12'
  | 'E_SEMIFIXO_BE';

export type Stage = 'mix' | 'occupancy' | 'tech' | 'clia' | 'drivers' | 'project';

export type ContractAgg = 'sum24' | 'flat24' | 'trailing12' | 'monthlySemifixo';

export interface CompositionPreset {
  stages: Stage[];
  agg: ContractAgg;
}

export const CONTRACT_PRESET: Record<ContractId, CompositionPreset> = {
  A_PROJETADO: { stages: ['mix', 'occupancy', 'tech', 'clia', 'drivers', 'project'], agg: 'sum24' },
  D_TRAILING12: { stages: ['mix', 'occupancy', 'tech', 'clia', 'drivers', 'project'], agg: 'trailing12' },
  B_CHEIO: { stages: [], agg: 'flat24' },
  E_SEMIFIXO_BE: { stages: [], agg: 'monthlySemifixo' },
  C_CANONICO: { stages: [], agg: 'sum24' },
};

export const CONTRACT_META: Record<ContractId, { label: string; formula: string }> = {
  A_PROJETADO: { label: 'PROJETADO c/ ramp + carência', formula: 'pipeline 0–5 → Σ24' },
  D_TRAILING12: { label: 'TRAILING-12 live', formula: 'pipeline 0–5 → Σ receita últimos 12m' },
  B_CHEIO: { label: 'PLENO Y1×12 + Y2×12', formula: 'Σ linhas ativas, sem pipeline' },
  E_SEMIFIXO_BE: { label: 'SEMIFIXO (BE)', formula: 'fixos + hc + MO terc.; exclui CV/insumos' },
  C_CANONICO: { label: 'CANÔNICO BP v3.5', formula: 'âncoras congeladas (não compõe)' },
};

export interface ContractCtx {
  base: DreGranularItem[];
  mixScale: number;
  drivers: ScenarioDrivers;
  params: HubParams;
}

export interface ContractSum24 {
  receita: number;
  custos: number;
  despesas: number;
  das: number;
  lucro: number;
}

export interface ContractFlat24 {
  receita: number;
  custos: number;
  despesas: number;
}

export interface ContractResult {
  months?: DreMonth[];
  sum24?: ContractSum24;
  flat24?: ContractFlat24;
  rbt12?: number;
  monthly?: number;
  anchors?: typeof OFFICIAL_TOTALS_24M;
}

function sum24FromMonths(months: DreMonth[]): ContractSum24 {
  return {
    receita: months.reduce((a, m) => a + m.receitaServicos, 0),
    custos: months.reduce((a, m) => a + m.custosOperacionais, 0),
    despesas: months.reduce((a, m) => a + m.despesasOperacionais, 0),
    das: months.reduce((a, m) => a + m.das6Percent, 0),
    lucro: months.reduce((a, m) => a + m.lucroLiquido, 0),
  };
}

function flat24FromLedger(base: DreGranularItem[]): ContractFlat24 {
  const sumSection = (section: DreSection) =>
    base
      .filter((i) => i.active && i.section === section)
      .reduce((acc, i) => acc + i.monthlyAmountY1 * 12 + i.monthlyAmountY2 * 12, 0);
  return {
    receita: sumSection('receita'),
    custos: sumSection('custo'),
    despesas: sumSection('despesa'),
  };
}

function pipelineMonths(ctx: ContractCtx, preset: CompositionPreset): DreMonth[] {
  const mixed = preset.stages.includes('mix')
    ? applyMixPreview(ctx.base, ctx.mixScale)
    : ctx.base;
  return projectScenario(mixed, ctx.drivers, ctx.params);
}

export function composeContract(id: ContractId, ctx: ContractCtx): ContractResult {
  if (id === 'C_CANONICO') return { anchors: OFFICIAL_TOTALS_24M };

  const preset = CONTRACT_PRESET[id];

  if (preset.agg === 'flat24') {
    return { flat24: flat24FromLedger(ctx.base) };
  }

  if (preset.agg === 'monthlySemifixo') {
    return { monthly: semiFixedOpexMonthlyFromLedger(ctx.base) };
  }

  const months = pipelineMonths(ctx, preset);

  if (preset.agg === 'trailing12') {
    const window = months.slice(-12);
    const rbt12 = window.reduce((a, m) => a + m.receitaServicos, 0);
    return { months, rbt12 };
  }

  return { months, sum24: sum24FromMonths(months) };
}

/** Fator R = numerador base (flags) ÷ D_TRAILING12.rbt12. Single-source. */
export function fatorRComposed(ctx: ContractCtx, monthNum = 24): number {
  const folha12m = fatorRFolhaMensalFromLedger(ctx.base, ctx.params, monthNum) * 12;
  const rbt12 = composeContract('D_TRAILING12', ctx).rbt12 ?? 0;
  if (rbt12 === 0) return ctx.params.fiscal.fatorRFloor;
  return Number(((folha12m / rbt12) * 100).toFixed(2));
}

export function defaultContractCtx(
  base: DreGranularItem[],
  params: HubParams,
  drivers: ScenarioDrivers = DEFAULT_SCENARIO_DRIVERS,
  mixScale = 1,
): ContractCtx {
  return { base, mixScale, drivers, params };
}
