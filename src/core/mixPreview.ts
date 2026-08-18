import type { ClientMixWeights, DreGranularItem, MixCostMode, PayrollRole } from '../types';
import { payrollTotal } from './payrollRoles';

export type { MixCostMode };

export const BLEND_ALVO_MC_POS = 74.15;
export const MIX_DIRTY_EPS = 0.001;
export const MIX_CCT_FACTOR = 0.85;
export const MIX_CAGED_FACTOR = 1.15;
export const BLEND_ALVO_MIX: ClientMixWeights = { p1: 20, p2: 30, p4: 25, p5: 25 };
export const BLEND_CONSERVADOR_MIX: ClientMixWeights = { p1: 25, p2: 30, p4: 30, p5: 15 };
/** Same band as ScenarioDrivers.occupancyRate. Mix owns occupied positions. */
export const MIX_OCCUPANCY_MIN = 0.05;
export const MIX_OCCUPANCY_MAX = 1;

export function occupiedPositionsFromRate(rate: number, capacity: number): number {
  const r = Math.min(MIX_OCCUPANCY_MAX, Math.max(MIX_OCCUPANCY_MIN, rate));
  return Math.round(capacity * r);
}

export function occupancyRateFromOccupied(occupied: number, capacity: number): number {
  if (capacity <= 0) return MIX_OCCUPANCY_MIN;
  const raw = occupied / capacity;
  return Math.min(MIX_OCCUPANCY_MAX, Math.max(MIX_OCCUPANCY_MIN, raw));
}

/** Fixed OPEX + folha/PL base. MC/pos already nets variable COGS. Exclui PL adicional. */
export function mixStructureCostMonthlyFromLedger(items: DreGranularItem[]): number {
  return items
    .filter(
      (i) =>
        i.active &&
        i.id !== 'cst-pl-adicional' &&
        (i.section === 'despesa' || i.section === 'custo') &&
        i.type === 'fixo' &&
        (i.costBehavior === 'fixed' || i.costBehavior === 'hc' || i.costBehavior == null),
    )
    .reduce((acc, i) => acc + i.monthlyAmountY1, 0);
}

/** OPEX fixo sem folha HC — pessoal vem da tabela de cargos. */
export function mixNonHcOpexFromLedger(items: DreGranularItem[]): number {
  return items
    .filter(
      (i) =>
        i.active &&
        i.id !== 'cst-pl-adicional' &&
        (i.section === 'despesa' || i.section === 'custo') &&
        i.type === 'fixo' &&
        (i.costBehavior === 'fixed' || i.costBehavior == null),
    )
    .reduce((acc, i) => acc + i.monthlyAmountY1, 0);
}

export function mixBePositions(costMonthly: number, mcPos: number): number {
  const safeMc = mcPos > 0 ? mcPos : 1;
  return Math.round(costMonthly / safeMc);
}

export function mixBePct(costMonthly: number, mcPos: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Number(((mixBePositions(costMonthly, mcPos) / capacity) * 100).toFixed(1));
}

/** Occupancy minus BE, in percentage points. Positive = above break-even. */
export function mixBeSlackPp(occupancyPct: number, bePct: number): number {
  return Number((occupancyPct - bePct).toFixed(1));
}

export function mixCostForMode(structureCost: number, mode: MixCostMode): number {
  if (mode === 'cct') return Math.round(structureCost * MIX_CCT_FACTOR);
  if (mode === 'caged') return Math.round(structureCost * MIX_CAGED_FACTOR);
  return structureCost;
}

export function computeMinViableBe(args: {
  items: DreGranularItem[];
  mix: ClientMixWeights;
  capacity: number;
  costMode: MixCostMode;
  payrollRoles?: PayrollRole[];
}): {
  mcPos: number;
  structureCost: number;
  costMonthly: number;
  bePositions: number;
  bePct: number;
  minViableOccupancy: number;
  minViablePositions: number;
} {
  const mcPos = weightedMcPosFromMix(args.mix);
  const opex = mixNonHcOpexFromLedger(args.items);
  const costMonthly = args.payrollRoles?.length
    ? opex + payrollTotal(args.payrollRoles, args.costMode)
    : mixCostForMode(mixStructureCostMonthlyFromLedger(args.items), args.costMode);
  const structureCost = args.payrollRoles?.length
    ? opex + payrollTotal(args.payrollRoles, 'mediana')
    : mixStructureCostMonthlyFromLedger(args.items);
  const bePositions = mixBePositions(costMonthly, mcPos);
  const bePct = mixBePct(costMonthly, mcPos, args.capacity);
  return {
    mcPos,
    structureCost,
    costMonthly,
    bePositions,
    bePct,
    minViableOccupancy: bePct / 100,
    minViablePositions: bePositions,
  };
}

export function weightedMcPosFromMix(mix: ClientMixWeights): number {
  const w1 = mix.p1 / 100;
  const w2 = mix.p2 / 100;
  const w4 = mix.p4 / 100;
  const w5 = mix.p5 / 100;
  return Number((w1 * 52.5 + w2 * 78.0 + w4 * 67.0 + w5 * 94.0).toFixed(2));
}

export function mixRatioFromMc(weightedMcPos: number): number {
  return weightedMcPos / BLEND_ALVO_MC_POS;
}

export function isMixRatioDirty(activeRatio: number, committedRatio: number): boolean {
  return Math.abs(activeRatio - committedRatio) > MIX_DIRTY_EPS;
}

export function applyMixPreview(base: DreGranularItem[], scale: number): DreGranularItem[] {
  if (Math.abs(scale - 1) < MIX_DIRTY_EPS) return base.map((i) => ({ ...i }));
  return base.map((item) => {
    if (item.engineLocked) return item;
    if (item.section === 'receita' && item.id !== 'rec-4pl-ct') {
      return {
        ...item,
        monthlyAmountY1: Math.round(item.monthlyAmountY1 * scale),
        monthlyAmountY2: Math.round(item.monthlyAmountY2 * scale),
      };
    }
    if (item.section === 'custo' && item.costBehavior === 'variable') {
      return {
        ...item,
        monthlyAmountY1: Math.round(item.monthlyAmountY1 * scale),
        monthlyAmountY2: Math.round(item.monthlyAmountY2 * scale),
      };
    }
    return item;
  });
}

export function diffMixPreview(
  preview: DreGranularItem[],
  base: DreGranularItem[],
): DreGranularItem[] {
  const byId = new Map(base.map((b) => [b.id, b]));
  return preview.filter((p) => {
    const b = byId.get(p.id);
    if (!b) return true;
    return p.monthlyAmountY1 !== b.monthlyAmountY1 || p.monthlyAmountY2 !== b.monthlyAmountY2;
  });
}
