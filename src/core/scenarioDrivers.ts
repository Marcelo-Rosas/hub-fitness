import type { DreGranularItem, ScenarioDrivers } from '../types';
import { CLIA_LEDGER_ITEM_ID } from './engine';

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
