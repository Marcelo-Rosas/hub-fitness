import type { DreGranularItem, DreMonth, ScenarioDrivers } from '../types';
import { OFFICIAL_TOTALS_24M } from './bpV35Reference';
import type { HubParams } from './params';
import {
  applyCliaToDreItems,
  applyOccupancyToDreItems,
  applyTechOpexToDreItems,
  CLIA_LEDGER_ITEM_ID,
  projectDreFromLedger,
} from './engine';

export interface ScenarioKpis {
  llM7Plus: number;
  m24Cash: number;
  fatorRHint: number;
  capexTotal: number;
}

export interface TornadoBar {
  factor: string;
  downside: number;
  upside: number;
}

export interface ComputeTornadoArgs {
  items: DreGranularItem[];
  baseDrivers: ScenarioDrivers;
  params: HubParams;
}

export const DEFAULT_SCENARIO_DRIVERS: ScenarioDrivers = {
  occupancyRate: 0.75,
  rentFactor: 1,
  cogsVariableFactor: 1,
  hcOpexFactor: 1,
  techOpexActive: false,
};

const RENT_IDS = new Set(['cst-aluguel', 'cst-condominio']);

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function clampScenarioDrivers(d: ScenarioDrivers): ScenarioDrivers {
  return {
    occupancyRate: clamp(d.occupancyRate, 0.05, 1),
    rentFactor: clamp(d.rentFactor, 0.5, 1.5),
    cogsVariableFactor: clamp(d.cogsVariableFactor, 0.5, 1.5),
    hcOpexFactor: clamp(d.hcOpexFactor, 0.5, 1.5),
    techOpexActive: Boolean(d.techOpexActive),
  };
}

/** API validation: returns error string or null. */
export function scenarioDriversValidationError(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return 'drivers obrigatório';
  const d = raw as Record<string, unknown>;
  const nums = ['occupancyRate', 'rentFactor', 'cogsVariableFactor', 'hcOpexFactor'] as const;
  for (const k of nums) {
    if (typeof d[k] !== 'number' || Number.isNaN(d[k] as number)) return `${k} inválido`;
  }
  if (typeof d.techOpexActive !== 'boolean') return 'techOpexActive inválido';
  const occ = d.occupancyRate as number;
  if (occ < 0.05 || occ > 1) return 'occupancyRate fora de 0.05–1.0';
  for (const k of ['rentFactor', 'cogsVariableFactor', 'hcOpexFactor'] as const) {
    const v = d[k] as number;
    if (v < 0.5 || v > 1.5) return `${k} fora de 0.5–1.5`;
  }
  return null;
}

function scale(n: number, factor: number) {
  return Math.round(n * factor);
}

export function applyScenarioDrivers(
  items: DreGranularItem[],
  drivers: ScenarioDrivers,
): DreGranularItem[] {
  const d = clampScenarioDrivers(drivers);
  return items.map((item) => {
    if (item.manualOverride) return item;
    if (item.engineLocked || item.id === CLIA_LEDGER_ITEM_ID) return item;

    if (RENT_IDS.has(item.id) && d.rentFactor !== 1) {
      return {
        ...item,
        monthlyAmountY1: scale(item.monthlyAmountY1, d.rentFactor),
        monthlyAmountY2: scale(item.monthlyAmountY2, d.rentFactor),
      };
    }

    const behavior = item.costBehavior ?? 'fixed';
    if (item.section === 'custo' && behavior === 'variable' && d.cogsVariableFactor !== 1) {
      return {
        ...item,
        monthlyAmountY1: scale(item.monthlyAmountY1, d.cogsVariableFactor),
        monthlyAmountY2: scale(item.monthlyAmountY2, d.cogsVariableFactor),
      };
    }
    if (behavior === 'hc' && d.hcOpexFactor !== 1) {
      return {
        ...item,
        monthlyAmountY1: scale(item.monthlyAmountY1, d.hcOpexFactor),
        monthlyAmountY2: scale(item.monthlyAmountY2, d.hcOpexFactor),
      };
    }
    return item;
  });
}

export function deriveScenarioKpis(dreMonths: DreMonth[], params: HubParams): ScenarioKpis {
  const slice = dreMonths.filter((m) => m.month >= 7 && m.month <= 12);
  const llM7Plus =
    slice.length === 0
      ? 0
      : Math.round(slice.reduce((a, m) => a + m.lucroLiquido, 0) / slice.length);
  const sumLl = dreMonths.reduce((a, m) => a + m.lucroLiquido, 0);
  const m24Cash = Math.round(
    OFFICIAL_TOTALS_24M.saldoCaixaM24CarenciaAluguel +
      (sumLl - OFFICIAL_TOTALS_24M.lucroLiquidoTotal),
  );
  return {
    llM7Plus,
    m24Cash,
    fatorRHint: 0,
    capexTotal: params.capex.total,
  };
}

/** Full ledger→DRE path for one driver set (pure; used by Tornado / A/B). */
export function projectScenario(
  items: DreGranularItem[],
  drivers: ScenarioDrivers,
  params: HubParams,
): DreMonth[] {
  const d = clampScenarioDrivers(drivers);
  const withOcc = applyOccupancyToDreItems(items, params);
  const techParams: HubParams = {
    ...params,
    techOpex: { ...params.techOpex, active: d.techOpexActive },
  };
  const withTech = applyTechOpexToDreItems(withOcc, techParams);
  const withClia = applyCliaToDreItems(withTech, params);
  const driven = applyScenarioDrivers(withClia, d);
  return projectDreFromLedger(driven, d.occupancyRate, params);
}

function llM7From(items: DreGranularItem[], drivers: ScenarioDrivers, params: HubParams): number {
  return deriveScenarioKpis(projectScenario(items, drivers, params), params).llM7Plus;
}

export function computeTornadoBars(args: ComputeTornadoArgs): TornadoBar[] {
  const { items, params } = args;
  const base = clampScenarioDrivers(args.baseDrivers);
  const baseLl = llM7From(items, base, params);

  const axis = (
    factor: string,
    down: ScenarioDrivers,
    up: ScenarioDrivers,
  ): TornadoBar => ({
    factor,
    downside: llM7From(items, down, params) - baseLl,
    upside: llM7From(items, up, params) - baseLl,
  });

  return [
    axis(
      'Ocupação (±20%)',
      { ...base, occupancyRate: base.occupancyRate - 0.2 },
      { ...base, occupancyRate: base.occupancyRate + 0.2 },
    ),
    axis(
      'Aluguel (±10%)',
      { ...base, rentFactor: base.rentFactor * 1.1 },
      { ...base, rentFactor: base.rentFactor * 0.9 },
    ),
    axis(
      'COGS variável (±10%)',
      { ...base, cogsVariableFactor: base.cogsVariableFactor * 1.1 },
      { ...base, cogsVariableFactor: base.cogsVariableFactor * 0.9 },
    ),
    axis(
      'HC / OPEX (±10%)',
      { ...base, hcOpexFactor: base.hcOpexFactor * 1.1 },
      { ...base, hcOpexFactor: base.hcOpexFactor * 0.9 },
    ),
    axis(
      'Tech OPEX (on/off)',
      { ...base, techOpexActive: true },
      { ...base, techOpexActive: false },
    ),
  ];
}
