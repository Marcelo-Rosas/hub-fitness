import { describe, expect, it } from 'vitest';
import { computeCapacityLedger } from './capacityLedger';
import { deriveFeuYieldFromFixtures } from './feuYield';
import { projectDreFromLedger } from './engine';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../data/initialData';

const budgets = { rackBudgetPositions: 2968, floorBudgetM2: 255 };
const mix = { alpha: 0.7, beta: 0.2, gamma: 0.08, delta: 0.02 };
const feuYield = deriveFeuYieldFromFixtures();

describe('computeCapacityLedger', () => {
  it('sem dwell → kind envelope, sem stock nem marketShare', () => {
    const r = computeCapacityLedger({
      mix,
      budgets,
      feuYield,
      feusPerMonth: 226,
    });
    expect(r.kind).toBe('envelope');
    if (r.kind === 'envelope') {
      expect(r.rackBudgetPositions).toBe(2968);
      expect(r.floorBudgetM2).toBe(255);
      expect(r.theoreticalMonthlyPositions).toBeGreaterThan(0);
    }
    expect(r).not.toHaveProperty('marketSharePct');
    expect(r).not.toHaveProperty('stockPositions');
  });

  it('com dwell completo → kind stock e KPIs finitos', () => {
    const r = computeCapacityLedger({
      mix,
      budgets,
      feuYield,
      feusPerMonth: 226,
      dwellByRegime: { alpha: 18, beta: 13, gamma: 36, delta: 28 },
    });
    expect(r.kind).toBe('stock');
    if (r.kind === 'stock') {
      expect(r.stockPositions).toBeGreaterThan(0);
      expect(r.stockFloorM2).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(r.rackOccupancyPct)).toBe(true);
      expect(Number.isFinite(r.floorOccupancyPct)).toBe(true);
    }
    expect(r).not.toHaveProperty('marketSharePct');
  });

  it('dwell parcial (null) → envelope', () => {
    const r = computeCapacityLedger({
      mix,
      budgets,
      feuYield,
      feusPerMonth: 100,
      dwellByRegime: { alpha: 18, beta: null, gamma: 36, delta: 28 },
    });
    expect(r.kind).toBe('envelope');
  });
});

describe('DRE intocado pelo ledger', () => {
  it('projectDreFromLedger ainda roda com seed', () => {
    const months = projectDreFromLedger(INITIAL_GRANULAR_DRE_ITEMS, 0.75);
    expect(months).toHaveLength(24);
    expect(months[6].receitaServicos).toBeGreaterThan(0);
  });
});
