import { describe, it, expect } from 'vitest';
import {
  applyMixPreview,
  diffMixPreview,
  isMixRatioDirty,
  mixBePct,
  mixBePositions,
  mixBeSlackPp,
  mixRatioFromMc,
  mixStructureCostMonthlyFromLedger,
  occupiedPositionsFromRate,
  occupancyRateFromOccupied,
  weightedMcPosFromMix,
  BLEND_ALVO_MC_POS,
} from './mixPreview';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../data/initialData';
import type { DreGranularItem } from '../types';

const base: DreGranularItem[] = [
  {
    id: 'rec-a',
    section: 'receita',
    type: 'fixo',
    category: 'x',
    name: 'Armaz',
    monthlyAmountY1: 1000,
    monthlyAmountY2: 1100,
    active: true,
  },
  {
    id: 'rec-4pl-ct',
    section: 'receita',
    type: 'fixo',
    category: 'x',
    name: '4PL',
    monthlyAmountY1: 500,
    monthlyAmountY2: 500,
    active: true,
  },
  {
    id: 'cst-var',
    section: 'custo',
    type: 'fixo',
    category: 'x',
    name: 'CV',
    monthlyAmountY1: 200,
    monthlyAmountY2: 200,
    active: true,
    costBehavior: 'variable',
  },
  {
    id: 'cst-hc',
    section: 'despesa',
    type: 'fixo',
    category: 'x',
    name: 'HC',
    monthlyAmountY1: 400,
    monthlyAmountY2: 400,
    active: true,
    costBehavior: 'hc',
  },
  {
    id: 'cst-fix',
    section: 'custo',
    type: 'fixo',
    category: 'x',
    name: 'Fix',
    monthlyAmountY1: 300,
    monthlyAmountY2: 300,
    active: true,
    costBehavior: 'fixed',
  },
];

describe('mixPreview', () => {
  it('weightedMcPos Blend Alvo ≈ 74.15', () => {
    expect(weightedMcPosFromMix({ p1: 20, p2: 30, p4: 25, p5: 25 })).toBeCloseTo(
      BLEND_ALVO_MC_POS,
      1,
    );
  });

  it('scales receita + variable custo; skips 4PL, hc, fixed', () => {
    const out = applyMixPreview(base, 1.1);
    expect(out.find((i) => i.id === 'rec-a')!.monthlyAmountY1).toBe(1100);
    expect(out.find((i) => i.id === 'cst-var')!.monthlyAmountY1).toBe(220);
    expect(out.find((i) => i.id === 'rec-4pl-ct')!.monthlyAmountY1).toBe(500);
    expect(out.find((i) => i.id === 'cst-hc')!.monthlyAmountY1).toBe(400);
    expect(out.find((i) => i.id === 'cst-fix')!.monthlyAmountY1).toBe(300);
  });

  it('anti-compound: scale 1 returns same amounts', () => {
    const out = applyMixPreview(base, 1);
    expect(out.find((i) => i.id === 'rec-a')!.monthlyAmountY1).toBe(1000);
  });

  it('diffMixPreview returns only changed ids', () => {
    const preview = applyMixPreview(base, 1.1);
    const changed = diffMixPreview(preview, base);
    expect(changed.map((c) => c.id).sort()).toEqual(['cst-var', 'rec-a']);
  });

  it('isMixRatioDirty', () => {
    expect(isMixRatioDirty(1.1, 1)).toBe(true);
    expect(isMixRatioDirty(1.0000001, 1)).toBe(false);
  });

  it('mixRatioFromMc divides by Blend Alvo', () => {
    expect(mixRatioFromMc(BLEND_ALVO_MC_POS)).toBeCloseTo(1, 5);
  });

  it('75% occupancy on 2968 positions is 2226', () => {
    expect(occupiedPositionsFromRate(0.75, 2968)).toBe(2226);
  });

  it('2968 occupied is occupancy 1.0 (not SANCO piso)', () => {
    expect(occupancyRateFromOccupied(2968, 2968)).toBe(1);
  });

  it('clamps occupancy to scenario band 0.05–1.0', () => {
    expect(occupancyRateFromOccupied(0, 2968)).toBe(0.05);
    expect(occupancyRateFromOccupied(99999, 2968)).toBe(1);
  });

  it('Blend Alvo BE at R$ 143k is 65% of capacity, not occupancy', () => {
    expect(mixBePositions(143_000, BLEND_ALVO_MC_POS)).toBe(1929);
    expect(mixBePct(143_000, BLEND_ALVO_MC_POS, 2968)).toBe(65);
  });

  it('slack is occupancy minus BE (76% vs 65% ≠ same card)', () => {
    expect(mixBeSlackPp(76, 65)).toBe(11);
  });

  it('structure cost includes HC so Mix BE is not ~34%', () => {
    const cost = mixStructureCostMonthlyFromLedger(INITIAL_GRANULAR_DRE_ITEMS);
    const be = mixBePct(cost, BLEND_ALVO_MC_POS, 2968);
    expect(cost).toBeGreaterThan(100_000);
    expect(be).toBeGreaterThan(50);
    expect(be).toBeLessThan(80);
  });
});
