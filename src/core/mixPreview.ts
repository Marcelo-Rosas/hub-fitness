import type { ClientMixWeights, DreGranularItem } from '../types';

export const BLEND_ALVO_MC_POS = 74.15;
export const MIX_DIRTY_EPS = 0.001;

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
