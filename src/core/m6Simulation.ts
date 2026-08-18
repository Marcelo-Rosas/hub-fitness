import type { DreGranularItem, Scenario, ScenarioDrivers } from '../types';
import type { HubParams } from './params';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../data/initialData';
import { applyMixPreview } from './mixPreview';
import { computeTechOpexMonthly } from './engine';
import {
  computeTornadoBars,
  deriveScenarioKpis,
  pickComparatorScenarios,
  projectScenario,
  type ScenarioKpis,
  type TornadoBar,
} from './scenarioDrivers';

export const M6_HORIZON_MONTHS = 24;

export function llMonthlyAvgFromTotal(total24m: number): number {
  return Math.round(total24m / M6_HORIZON_MONTHS);
}

/** Ledger efetivo do M6: base ou preview Mix (receita + COGS variável). */
export function resolveM6LedgerItems(
  ledgerBaseItems: DreGranularItem[],
  mixScale: number,
  isMixDirty: boolean,
): DreGranularItem[] {
  const base = ledgerBaseItems.length ? ledgerBaseItems : INITIAL_GRANULAR_DRE_ITEMS;
  if (!isMixDirty) return base;
  return applyMixPreview(base, mixScale);
}

export interface M6V35V36Row {
  techOpexMonthly: number;
  llTotal24m: number;
  llMonthlyAvg: number;
  m24Cash: number;
}

export interface M6SimulationInput {
  ledgerBaseItems: DreGranularItem[];
  /** Ledger já resolvido (ex.: previewMixItems do Context). */
  effectiveLedgerItems?: DreGranularItem[];
  mixScale?: number;
  isMixDirty?: boolean;
  scenarios: Scenario[];
  activeScenarioId: string;
  params: HubParams;
}

export interface M6SimulationBundle {
  ledgerItems: DreGranularItem[];
  activeDrivers: ScenarioDrivers;
  left: Scenario;
  right: Scenario;
  leftKpis: ScenarioKpis;
  rightKpis: ScenarioKpis;
  tornadoBars: TornadoBar[];
  v35: M6V35V36Row;
  v36: M6V35V36Row;
  v36LlDelta: number;
  v36LlAvgDelta: number;
  v36CashDelta: number;
  deltaOccupancyPp: number;
  deltaLL24m: number;
  deltaLlAvgPerMonth: number;
  deltaCash: number;
}

function kpisForDrivers(
  ledgerItems: DreGranularItem[],
  drivers: ScenarioDrivers,
  params: HubParams,
): ScenarioKpis {
  return deriveScenarioKpis(projectScenario(ledgerItems, drivers, params), params);
}

function v35V36Row(
  ledgerItems: DreGranularItem[],
  drivers: ScenarioDrivers,
  params: HubParams,
  techOn: boolean,
): M6V35V36Row {
  const techParams: HubParams = {
    ...params,
    techOpex: { ...params.techOpex, active: techOn },
  };
  const kpis = kpisForDrivers(ledgerItems, { ...drivers, techOpexActive: techOn }, techParams);
  return {
    techOpexMonthly: techOn ? computeTechOpexMonthly(techParams) : 0,
    llTotal24m: kpis.llTotal24m,
    llMonthlyAvg: llMonthlyAvgFromTotal(kpis.llTotal24m),
    m24Cash: kpis.m24Cash,
  };
}

/** SSOT: A/B, v3.5×v3.6 live e Tornado compartilham o mesmo ledger + drivers. */
export function computeM6SimulationBundle(input: M6SimulationInput): M6SimulationBundle {
  const mixScale = input.mixScale ?? 1;
  const isMixDirty = input.isMixDirty ?? false;
  const ledgerItems =
    input.effectiveLedgerItems ??
    resolveM6LedgerItems(input.ledgerBaseItems, mixScale, isMixDirty);
  const { left, right } = pickComparatorScenarios(input.scenarios, input.activeScenarioId);
  const activeScenario =
    input.scenarios.find((s) => s.id === input.activeScenarioId) ?? input.scenarios[0];
  const activeDrivers = activeScenario.drivers;

  const leftKpis = kpisForDrivers(ledgerItems, left.drivers, input.params);
  const rightKpis = kpisForDrivers(ledgerItems, right.drivers, input.params);

  const tornadoBars = computeTornadoBars({
    items: ledgerItems,
    baseDrivers: activeDrivers,
    params: input.params,
  });

  const v35 = v35V36Row(ledgerItems, activeDrivers, input.params, false);
  const v36 = v35V36Row(ledgerItems, activeDrivers, input.params, true);
  const v36LlDelta = v36.llTotal24m - v35.llTotal24m;
  const v36CashDelta = v36.m24Cash - v35.m24Cash;

  const deltaLL24m = rightKpis.llTotal24m - leftKpis.llTotal24m;
  const deltaCash = rightKpis.m24Cash - leftKpis.m24Cash;

  return {
    ledgerItems,
    activeDrivers,
    left,
    right,
    leftKpis,
    rightKpis,
    tornadoBars,
    v35,
    v36,
    v36LlDelta,
    v36LlAvgDelta: llMonthlyAvgFromTotal(v36LlDelta),
    v36CashDelta,
    deltaOccupancyPp: (right.drivers.occupancyRate - left.drivers.occupancyRate) * 100,
    deltaLL24m,
    deltaLlAvgPerMonth: llMonthlyAvgFromTotal(deltaLL24m),
    deltaCash,
  };
}
