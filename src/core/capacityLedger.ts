import type { Regime } from './regimes';
import type { FeuYieldByRegime } from './feuYield';

export interface RegimeMix {
  alpha: number;
  beta: number;
  gamma: number;
  delta: number;
}

export interface CapacityBudgets {
  rackBudgetPositions: number;
  floorBudgetM2: number;
}

export interface CapacityLedgerInput {
  mix: RegimeMix;
  budgets: CapacityBudgets;
  feuYield: FeuYieldByRegime;
  /** FEUs/mês no nicho (fluxo). Sem dwell não vira estoque. */
  feusPerMonth?: number;
  /** Dwell mediano (dias) por regime. Ausente → kind envelope. */
  dwellByRegime?: Partial<Record<Regime, number | null>>;
}

export interface CapacityEnvelope {
  kind: 'envelope';
  rackBudgetPositions: number;
  floorBudgetM2: number;
  /** Consumo teórico se 1 mês de fluxo ocupasse 100% sem dwell (não é estoque). */
  theoreticalMonthlyPositions: number;
  theoreticalMonthlyFloorM2: number;
}

export interface CapacityStock {
  kind: 'stock';
  rackBudgetPositions: number;
  floorBudgetM2: number;
  stockPositions: number;
  stockFloorM2: number;
  rackOccupancyPct: number;
  floorOccupancyPct: number;
}

export type CapacityLedgerResult = CapacityEnvelope | CapacityStock;

function hasCompleteDwell(
  dwell?: Partial<Record<Regime, number | null>>,
): dwell is Record<Regime, number> {
  if (!dwell) return false;
  const regimes: Regime[] = ['alpha', 'beta', 'gamma', 'delta'];
  return regimes.every((r) => {
    const v = dwell[r];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0;
  });
}

function monthlyFlow(
  mix: RegimeMix,
  feus: number,
  yieldBy: FeuYieldByRegime,
): { positions: number; floorM2: number } {
  const positions =
    feus * mix.alpha * yieldBy.alpha.positionsPerFeu +
    feus * mix.beta * yieldBy.beta.positionsPerFeu;
  const floorM2 =
    feus * mix.gamma * yieldBy.gamma.floorM2PerFeu +
    feus * mix.delta * yieldBy.delta.floorM2PerFeu;
  return { positions, floorM2 };
}

/**
 * Ledger triplo (rack + piso Gamma + piso Delta).
 * Sem dwell → envelope only (nunca marketSharePct).
 * Com dwell → estoque médio = fluxo × dwell/30.
 */
export function computeCapacityLedger(input: CapacityLedgerInput): CapacityLedgerResult {
  const feus = input.feusPerMonth ?? 0;
  const flow = monthlyFlow(input.mix, feus, input.feuYield);
  const { rackBudgetPositions, floorBudgetM2 } = input.budgets;

  if (!hasCompleteDwell(input.dwellByRegime)) {
    return {
      kind: 'envelope',
      rackBudgetPositions,
      floorBudgetM2,
      theoreticalMonthlyPositions: Math.round(flow.positions * 10) / 10,
      theoreticalMonthlyFloorM2: Math.round(flow.floorM2 * 10) / 10,
    };
  }

  const d = input.dwellByRegime;
  const stockPositions =
    feus * input.mix.alpha * input.feuYield.alpha.positionsPerFeu * (d.alpha / 30) +
    feus * input.mix.beta * input.feuYield.beta.positionsPerFeu * (d.beta / 30);
  const stockFloorM2 =
    feus * input.mix.gamma * input.feuYield.gamma.floorM2PerFeu * (d.gamma / 30) +
    feus * input.mix.delta * input.feuYield.delta.floorM2PerFeu * (d.delta / 30);

  return {
    kind: 'stock',
    rackBudgetPositions,
    floorBudgetM2,
    stockPositions: Math.round(stockPositions * 10) / 10,
    stockFloorM2: Math.round(stockFloorM2 * 10) / 10,
    rackOccupancyPct:
      rackBudgetPositions > 0
        ? Math.round((stockPositions / rackBudgetPositions) * 1000) / 10
        : 0,
    floorOccupancyPct:
      floorBudgetM2 > 0 ? Math.round((stockFloorM2 / floorBudgetM2) * 1000) / 10 : 0,
  };
}
