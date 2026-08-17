import { describe, it, expect } from 'vitest';
import {
  applyScenarioDrivers,
  clampScenarioDrivers,
  computeTornadoBars,
  DEFAULT_SCENARIO_DRIVERS,
  deriveScenarioKpis,
} from './scenarioDrivers';
import type { DreGranularItem, ScenarioDrivers } from '../types';
import { projectDreFromLedger } from './engine';
import { defaultParams } from './params';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../data/initialData';

const baseDrivers: ScenarioDrivers = {
  occupancyRate: 0.75,
  rentFactor: 1,
  cogsVariableFactor: 1,
  hcOpexFactor: 1,
  techOpexActive: false,
};

function item(partial: Partial<DreGranularItem> & Pick<DreGranularItem, 'id' | 'section'>): DreGranularItem {
  return {
    type: 'fixo',
    category: 't',
    name: partial.id,
    monthlyAmountY1: 1000,
    monthlyAmountY2: 2000,
    active: true,
    costBehavior: 'fixed',
    ...partial,
  };
}

describe('applyScenarioDrivers', () => {
  it('scales only variable COGS by cogsVariableFactor', () => {
    const items = [
      item({ id: 'v', section: 'custo', costBehavior: 'variable', monthlyAmountY1: 1000, monthlyAmountY2: 2000 }),
      item({ id: 'f', section: 'custo', costBehavior: 'fixed', monthlyAmountY1: 1000, monthlyAmountY2: 2000 }),
      item({ id: 'h', section: 'despesa', costBehavior: 'hc', monthlyAmountY1: 1000, monthlyAmountY2: 2000 }),
    ];
    const out = applyScenarioDrivers(items, { ...baseDrivers, cogsVariableFactor: 1.2 });
    expect(out.find((i) => i.id === 'v')!.monthlyAmountY1).toBe(1200);
    expect(out.find((i) => i.id === 'v')!.monthlyAmountY2).toBe(2400);
    expect(out.find((i) => i.id === 'f')!.monthlyAmountY1).toBe(1000);
    expect(out.find((i) => i.id === 'h')!.monthlyAmountY1).toBe(1000);
  });

  it('rentFactor scales aluguel and condominio', () => {
    const items = [
      item({ id: 'cst-aluguel', section: 'despesa', monthlyAmountY1: 60000, monthlyAmountY2: 63000 }),
      item({ id: 'cst-condominio', section: 'despesa', monthlyAmountY1: 6500, monthlyAmountY2: 6500 }),
      item({ id: 'other', section: 'despesa', costBehavior: 'hc', monthlyAmountY1: 1000, monthlyAmountY2: 1000 }),
    ];
    const out = applyScenarioDrivers(items, { ...baseDrivers, rentFactor: 0.9 });
    expect(out.find((i) => i.id === 'cst-aluguel')!.monthlyAmountY1).toBe(54000);
    expect(out.find((i) => i.id === 'cst-condominio')!.monthlyAmountY1).toBe(5850);
    expect(out.find((i) => i.id === 'other')!.monthlyAmountY1).toBe(1000);
  });

  it('rentFactor scales M3 occupancy lines by CoA even without cst-* ids', () => {
    const items = [
      item({
        id: 'dre-item-manual-rent',
        section: 'despesa',
        accountCode: '5.2.02.01',
        monthlyAmountY1: 80000,
        monthlyAmountY2: 84000,
      }),
      item({
        id: 'dre-item-manual-condo',
        section: 'despesa',
        accountCode: '5.2.02.02',
        monthlyAmountY1: 6500,
        monthlyAmountY2: 6500,
      }),
      item({
        id: 'dre-item-iptu',
        section: 'despesa',
        accountCode: '5.2.02.03',
        monthlyAmountY1: 2000,
        monthlyAmountY2: 2000,
      }),
    ];
    const out = applyScenarioDrivers(items, { ...baseDrivers, rentFactor: 0.9 });
    expect(out.find((i) => i.id === 'dre-item-manual-rent')!.monthlyAmountY1).toBe(72000);
    expect(out.find((i) => i.id === 'dre-item-manual-condo')!.monthlyAmountY1).toBe(5850);
    expect(out.find((i) => i.id === 'dre-item-iptu')!.monthlyAmountY1).toBe(2000);
  });

  it('hcOpexFactor scales hc only', () => {
    const items = [
      item({ id: 'cst-pessoal-clt-pl', section: 'despesa', costBehavior: 'hc', monthlyAmountY1: 10000, monthlyAmountY2: 10000 }),
      item({ id: 'cst-depreciacao', section: 'despesa', costBehavior: 'fixed', monthlyAmountY1: 5000, monthlyAmountY2: 5000 }),
    ];
    const out = applyScenarioDrivers(items, { ...baseDrivers, hcOpexFactor: 1.1 });
    expect(out.find((i) => i.id === 'cst-pessoal-clt-pl')!.monthlyAmountY1).toBe(11000);
    expect(out.find((i) => i.id === 'cst-depreciacao')!.monthlyAmountY1).toBe(5000);
  });

  it('skips engineLocked and manualOverride', () => {
    const items = [
      item({
        id: 'rec-4pl-ct',
        section: 'receita',
        engineLocked: true,
        monthlyAmountY1: 6274,
        monthlyAmountY2: 9845,
      }),
      item({
        id: 'cst-insumos',
        section: 'custo',
        costBehavior: 'variable',
        manualOverride: true,
        monthlyAmountY1: 1000,
        monthlyAmountY2: 1000,
      }),
    ];
    const out = applyScenarioDrivers(items, {
      ...baseDrivers,
      cogsVariableFactor: 1.5,
      rentFactor: 0.5,
    });
    expect(out[0].monthlyAmountY1).toBe(6274);
    expect(out[1].monthlyAmountY1).toBe(1000);
  });

  it('identity factors leave amounts unchanged', () => {
    const items = [item({ id: 'v', section: 'custo', costBehavior: 'variable' })];
    const out = applyScenarioDrivers(items, baseDrivers);
    expect(out[0].monthlyAmountY1).toBe(1000);
  });
});

describe('clampScenarioDrivers', () => {
  it('clamps occupancy and factors to ranges', () => {
    const c = clampScenarioDrivers({
      occupancyRate: 2,
      rentFactor: 0.1,
      cogsVariableFactor: 9,
      hcOpexFactor: 1,
      techOpexActive: true,
    });
    expect(c.occupancyRate).toBe(1);
    expect(c.rentFactor).toBe(0.5);
    expect(c.cogsVariableFactor).toBe(1.5);
  });
});

describe('deriveScenarioKpis', () => {
  it('llM7Plus is mean of M7–M12', () => {
    const months = projectDreFromLedger(INITIAL_GRANULAR_DRE_ITEMS, 0.75, defaultParams);
    const k = deriveScenarioKpis(months, defaultParams);
    const slice = months.filter((m) => m.month >= 7 && m.month <= 12);
    const mean = Math.round(slice.reduce((a, m) => a + m.lucroLiquido, 0) / slice.length);
    expect(k.llM7Plus).toBe(mean);
    expect(k.capexTotal).toBe(defaultParams.capex.total);
  });
});

describe('computeTornadoBars', () => {
  it('rent ±10% moves LL without hardcoded magnitudes', () => {
    const bars = computeTornadoBars({
      items: INITIAL_GRANULAR_DRE_ITEMS,
      baseDrivers: { ...DEFAULT_SCENARIO_DRIVERS, occupancyRate: 0.75 },
      params: defaultParams,
    });
    const rent = bars.find((b) => b.factor.includes('Aluguel') || b.factor.includes('rent'));
    expect(rent).toBeTruthy();
    expect(rent!.downside).not.toBe(0);
    expect(rent!.upside).not.toBe(0);
    expect(Math.abs(rent!.downside)).not.toBe(35000);
  });
});
