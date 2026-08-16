import { describe, it, expect } from 'vitest';
import { defaultParams } from '../core/params';
import { plAdditionalForMonth } from '../core/engine';
import {
  buildConsistencyMatrix,
  buildPreErpChecklist,
  occupancyPositions,
  rentM13Monthly,
  m7RevenueCeiling,
  formatFatorRBand,
  plPhaseBands,
} from '../core/governanceMatrix';
import { INITIAL_GRANULAR_DRE_ITEMS, INITIAL_VAS_DRIVERS, INITIAL_SCENARIOS } from '../data/initialData';
import type { DreMonth } from '../types';

const dreMonths: DreMonth[] = Array.from({ length: 24 }, (_, i) => ({
  month: i + 1,
  label: `M${i + 1}`,
  receitaServicos: i + 1 >= 7 ? 214_238 : 100_000 + i * 20_000,
  das6Percent: 0,
  irpj: 0,
  csll: 0,
  pisCofinsCppIss: 0,
  custosOperacionais: 50_000,
  despesasOperacionais: 80_000,
  lucroLiquido: 10_000,
}));

describe('Phase 4 — capacity / fiscal helpers', () => {
  it('occupancy 88% deriva de totalPositions × galpaoAOccupancy (não literal 2612)', () => {
    const pos = occupancyPositions(defaultParams);
    expect(pos).toBe(Math.round(defaultParams.capacity.totalPositions * defaultParams.year3.galpaoAOccupancy));
    expect(pos).toBe(2612);
  });

  it('m7 ceiling escala o M7 oficial com capacity (não inventa ticket)', () => {
    expect(m7RevenueCeiling(defaultParams)).toBe(214_238);
    const scaled = m7RevenueCeiling({
      ...defaultParams,
      capacity: { ...defaultParams.capacity, totalPositions: 5936 },
    });
    expect(scaled).toBe(428_476);
  });

  it('rent M13 = base × (1+IGPM) from params', () => {
    expect(rentM13Monthly(defaultParams)).toBe(63_000);
  });

  it('PL bands from hubParams.fiscal.plAdditionalByPhase', () => {
    const bands = plPhaseBands(defaultParams);
    expect(bands[0]).toEqual({ fromMonth: 4, amount: 7_000, totalPl: 25_500 });
    expect(plAdditionalForMonth(defaultParams, 7)).toBe(7_000);
    expect(plAdditionalForMonth(defaultParams, 13)).toBe(15_000);
  });

  it('fator R band formatter uses fiscal min/max', () => {
    expect(formatFatorRBand(defaultParams)).toContain('28,01');
    expect(formatFatorRBand(defaultParams)).toContain('28,70');
  });
});

describe('Phase 4 — M9 consistency / checklist not all-true', () => {
  const baseInput = {
    hubParams: defaultParams,
    dreMonths,
    activeScenario: INITIAL_SCENARIOS[0],
    fatorR: 28.4,
    vasDrivers: INITIAL_VAS_DRIVERS,
    granularDreItems: INITIAL_GRANULAR_DRE_ITEMS,
    activeMix: { p5: 25 },
  };

  it('matriz passa com estado canônico', () => {
    const { rows, hasCritical } = buildConsistencyMatrix(baseInput);
    expect(hasCritical).toBe(false);
    expect(rows.every((r) => r.status === 'passed')).toBe(true);
  });

  it('fator R fora da banda → critical (não hardcoded true)', () => {
    const { rows, hasCritical } = buildConsistencyMatrix({ ...baseInput, fatorR: 22 });
    expect(hasCritical).toBe(true);
    expect(rows.find((r) => r.id === 'fator-r-num')?.status).toBe('critical');
  });

  it('Ad Valorem ≠ 0,10% → critical', () => {
    const bad = {
      ...baseInput,
      hubParams: {
        ...defaultParams,
        pricing: { ...defaultParams.pricing, adValoremPct: 0.005 },
      },
    };
    const { rows } = buildConsistencyMatrix(bad);
    expect(rows.find((r) => r.id === 'm7-adval')?.status).toBe('critical');
  });

  it('pré-ERP checklist falha quando P5 < 20%', () => {
    const checks = buildPreErpChecklist({ ...baseInput, activeMix: { p5: 10 } });
    const veto = checks.find((c) => c.id === 'vetos');
    expect(veto?.passed).toBe(false);
    expect(checks.some((c) => !c.passed)).toBe(true);
  });

  it('pré-ERP checklist não é tudo true por construção quando VAS vazio', () => {
    const { rows } = buildConsistencyMatrix({ ...baseInput, vasDrivers: [] });
    expect(rows.find((r) => r.id === 'vas-core')?.status).toBe('critical');
  });
});
