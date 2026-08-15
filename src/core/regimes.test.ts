import { describe, expect, it } from 'vitest';
import {
  classifySku,
  computeCbmM3,
  estimateConsumption,
  medianDwellDays,
  resolveCbmM3,
  TAM_WARNING,
  type SkuAsn,
} from './regimes';
import { BRIGHTWAY_SAMPLE } from '../data/fixtures/brightwaySample';
import {
  IMPULSE_SAMPLE,
  IMPULSE_BL_LINES,
  IMPULSE_BL_CADASTRO,
  IMPULSE_BL_06BRZ2311010_META,
} from '../data/fixtures/impulseSample';
import { deriveFeuYieldFromFixtures } from './feuYield';

const bySku = (sku: string): SkuAsn => {
  const all = [...BRIGHTWAY_SAMPLE, ...IMPULSE_SAMPLE];
  const found = all.find((s) => s.sku === sku);
  if (!found) throw new Error(`SKU ${sku} não encontrado nos fixtures`);
  return found;
};

describe('classifySku', () => {
  it('TN01 skid 1620×1120 → alpha', () => {
    expect(classifySku(bySku('TN01'))).toBe('alpha');
  });

  it('TS114 skid oversized → gamma', () => {
    expect(classifySku(bySku('TS114'))).toBe('gamma');
  });

  it('Impulse selectorized no_base → beta', () => {
    expect(classifySku(bySku('IT9503'))).toBe('beta');
    expect(classifySku(bySku('IF9301'))).toBe('beta');
  });

  it('weight stack Impulse 4 volumes → beta', () => {
    expect(classifySku(bySku('IF93WS-295'))).toBe('beta');
    expect(bySku('IF93WS-295').volumesPerKit).toBe(4);
    expect(bySku('IF93WS-295').skuKind).toBe('kit');
  });

  it('BL 06BRZ2311010 tem 269 sets nas linhas KIT', () => {
    const sumSets = IMPULSE_BL_LINES.reduce((a, s) => a + s.setsInShipment, 0);
    expect(sumSets).toBe(IMPULSE_BL_06BRZ2311010_META.totals.sets);
  });

  it('IT9503 explode em KIT + 3 PARTES (estrutura/estrutura/painel)', () => {
    const kit = bySku('IT9503');
    expect(kit.skuKind).toBe('kit');
    const parts = IMPULSE_BL_CADASTRO.filter((s) => s.parentSku === 'IT9503');
    expect(parts).toHaveLength(3);
    expect(parts.map((p) => p.partRole)).toEqual(['estrutura', 'estrutura', 'painel']);
    const sumCbm = parts.reduce((a, p) => a + (p.cbmDeclaredM3 ?? 0), 0);
    expect(kit.cbmDeclaredM3).toBeCloseTo(sumCbm, 3);
  });

  it('cubagem calculada L×W×H e resolveCbmM3', () => {
    const tn = bySku('TN01');
    expect(computeCbmM3(tn)).toBeCloseTo(1.62 * 1.12 * 0.57, 5);
    expect(resolveCbmM3(tn)).toBeGreaterThan(0);
  });

  it('esteira no_base + stackLimit 5 (oversized) → delta', () => {
    expect(classifySku(bySku('TREADMILL-COMM'))).toBe('delta');
  });

  it('regimeOverride vence classifier', () => {
    expect(
      classifySku({
        ...bySku('TN01'),
        regimeOverride: 'beta',
      }),
    ).toBe('beta');
  });
});

describe('estimateConsumption', () => {
  it('alpha qty=N → N posições', () => {
    expect(estimateConsumption(bySku('TN01'), 16, 'alpha')).toEqual({
      positions: 16,
      floorM2: 0,
    });
  });

  it('gamma 2-high → footprint/2', () => {
    const s = bySku('TS114');
    const fp = (2.32 * 1.6) / 2;
    expect(estimateConsumption(s, 1, 'gamma').floorM2).toBeCloseTo(fp, 5);
    expect(estimateConsumption(s, 1, 'gamma').positions).toBe(0);
  });

  it('delta → footprint/stackLimit', () => {
    const s = bySku('TREADMILL-COMM');
    const expected = (2.2 * 0.9) / 5;
    expect(estimateConsumption(s, 1, 'delta').floorM2).toBeCloseTo(expected, 5);
  });

  it('beta consolida por payload PBR', () => {
    const s = bySku('PS300');
    // 800/66.3 ≈ 12 por palete; 24 un → 2 pos
    expect(estimateConsumption(s, 24, 'beta').positions).toBe(2);
  });
});

describe('medianDwellDays', () => {
  it('retorna mediana por regime e null sem amostra', () => {
    const m = medianDwellDays([
      { regime: 'alpha', dwellDays: 10 },
      { regime: 'alpha', dwellDays: 20 },
      { regime: 'alpha', dwellDays: 30 },
      { regime: 'beta', dwellDays: 13 },
    ]);
    expect(m.alpha).toBe(20);
    expect(m.beta).toBe(13);
    expect(m.gamma).toBeNull();
    expect(m.delta).toBeNull();
  });
});

describe('feuYield fixtures', () => {
  it('deriva yields finitos e documenta aviso TAM', () => {
    const y = deriveFeuYieldFromFixtures();
    expect(y.alpha.positionsPerFeu).toBeGreaterThan(0);
    expect(y.alpha.positionsPerFeu).toBeLessThan(50); // não 111 mágico
    expect(y.beta.positionsPerFeu).toBeGreaterThan(0);
    expect(y.gamma.floorM2PerFeu).toBeGreaterThan(0);
    expect(y.delta.floorM2PerFeu).toBeGreaterThan(0);
    expect(TAM_WARNING).toMatch(/dwell/i);
  });
});
