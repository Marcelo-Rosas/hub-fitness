/**
 * Smoke M6: cada alavanca de simulação move A/B, v3.5×v3.6 live e Tornado (mesmo SSOT).
 */
import { describe, it, expect } from 'vitest';
import type { ScenarioDrivers } from '../../src/types';
import { defaultParams } from '../../src/core/params';
import {
  computeM6SimulationBundle,
  llMonthlyAvgFromTotal,
  resolveM6LedgerItems,
} from '../../src/core/m6Simulation';
import {
  DEFAULT_SCENARIO_DRIVERS,
  deriveScenarioKpis,
  projectScenario,
} from '../../src/core/scenarioDrivers';
import {
  applyMixPreview,
  BLEND_ALVO_MC_POS,
  BLEND_CONSERVADOR_MIX,
  computeMinViableBe,
  mixRatioFromMc,
  weightedMcPosFromMix,
} from '../../src/core/mixPreview';
import { INITIAL_GRANULAR_DRE_ITEMS, INITIAL_SCENARIOS } from '../../src/data/initialData';
import { INITIAL_PAYROLL_ROLES } from '../../src/data/payrollRoles';
import { MIX_COST_MODES } from '../../src/core/payrollRoles';

const BASE_ITEMS = INITIAL_GRANULAR_DRE_ITEMS;
const PARAMS = defaultParams;

function bundle(activeScenarioId: string, drivers?: Partial<ScenarioDrivers>, mix?: { dirty: boolean; scale: number }) {
  const scenario = INITIAL_SCENARIOS.find((s) => s.id === activeScenarioId)!;
  const mergedDrivers: ScenarioDrivers = { ...scenario.drivers, ...drivers };
  const scenarios = INITIAL_SCENARIOS.map((s) =>
    s.id === activeScenarioId ? { ...s, drivers: mergedDrivers, occupancyRate: mergedDrivers.occupancyRate } : s,
  );
  return computeM6SimulationBundle({
    ledgerBaseItems: BASE_ITEMS,
    scenarios,
    activeScenarioId,
    params: PARAMS,
    isMixDirty: mix?.dirty ?? false,
    mixScale: mix?.scale ?? 1,
  });
}

describe('smoke M6 simulation SSOT', () => {
  it('resolveM6LedgerItems aplica preview Mix só quando dirty', () => {
    const scaled = applyMixPreview(BASE_ITEMS, 1.08);
    expect(resolveM6LedgerItems(BASE_ITEMS, 1.08, false)).toBe(BASE_ITEMS);
    expect(resolveM6LedgerItems(BASE_ITEMS, 1.08, true)).toEqual(scaled);
  });

  it('llMonthlyAvgFromTotal = soma / 24', () => {
    expect(llMonthlyAvgFromTotal(570_842)).toBe(23_785);
  });

  it.each(
    INITIAL_SCENARIOS.filter((s) => !s.isBaseline).map((s) => [s.id, s.name] as const),
  )('cenário %s altera LL 24m A/B vs baseline', (id) => {
    const b = bundle(id);
    expect(b.rightKpis.llTotal24m).not.toBe(b.leftKpis.llTotal24m);
    expect(b.deltaLL24m).not.toBe(0);
    expect(b.tornadoBars.length).toBe(5);
    expect(b.tornadoBars.every((bar) => Number.isFinite(bar.downside) && Number.isFinite(bar.upside))).toBe(true);
  });

  const driverCases: Array<[string, Partial<ScenarioDrivers>]> = [
    ['rent ×1.15', { rentFactor: 1.15 }],
    ['COGS var ×1.12', { cogsVariableFactor: 1.12 }],
    ['HC/OPEX ×1.1', { hcOpexFactor: 1.1 }],
    ['Tech OPEX on', { techOpexActive: true }],
    ['ocupação 55%', { occupancyRate: 0.55 }],
  ];

  it.each(driverCases)('driver %s move Tornado, A/B direita e v3.5×v3.6 live', (_label, partial) => {
    const base = bundle('sc-baseline');
    const stressed = bundle('sc-baseline', partial);

    expect(stressed.rightKpis.llTotal24m).not.toBe(base.rightKpis.llTotal24m);
    expect(stressed.tornadoBars).not.toEqual(base.tornadoBars);

    const techOnly = partial.techOpexActive === true && Object.keys(partial).length === 1;
    if (techOnly) {
      // v3.5×v3.6 = structural tech off vs on — colunas fixas; tech entra via A/B/Tornado
      expect(stressed.v35.llTotal24m).toBe(base.v35.llTotal24m);
      expect(stressed.v36.llTotal24m).toBe(base.v36.llTotal24m);
      expect(stressed.v36.techOpexMonthly).toBeGreaterThan(stressed.v35.techOpexMonthly);
    } else {
      expect(stressed.v35.llTotal24m).not.toBe(base.v35.llTotal24m);
      expect(stressed.v36.llTotal24m).not.toBe(base.v36.llTotal24m);
    }

    if (partial.techOpexActive) {
      expect(stressed.v36LlDelta).toBe(stressed.v36.llTotal24m - stressed.v35.llTotal24m);
    }
  });

  it('Mix dirty escala receita → LL 24m, Tornado e v3.5×v3.6', () => {
    const conservadorMc = weightedMcPosFromMix(BLEND_CONSERVADOR_MIX);
    const scale = mixRatioFromMc(conservadorMc);
    const clean = bundle('sc-baseline', undefined, { dirty: false, scale: 1 });
    const dirty = bundle('sc-baseline', undefined, { dirty: true, scale });

    expect(scale).not.toBeCloseTo(1, 2);
    expect(dirty.rightKpis.llTotal24m).not.toBe(clean.rightKpis.llTotal24m);
    expect(dirty.v35.llTotal24m).not.toBe(clean.v35.llTotal24m);
    expect(dirty.tornadoBars).not.toEqual(clean.tornadoBars);
  });

  it('Tornado âncora = LL 24m do cenário ativo (mesmo pipeline)', () => {
    const b = bundle('sc-baseline', { rentFactor: 1.05 });
    const activeKpis = deriveScenarioKpis(
      projectScenario(b.ledgerItems, b.activeDrivers, PARAMS),
      PARAMS,
    );
    const rentBar = b.tornadoBars.find((x) => x.factor.includes('Aluguel'))!;
    const downDrivers = { ...b.activeDrivers, rentFactor: b.activeDrivers.rentFactor * 1.1 };
    const downKpis = deriveScenarioKpis(
      projectScenario(b.ledgerItems, downDrivers, PARAMS),
      PARAMS,
    );
    expect(rentBar.downside).toBe(downKpis.llTotal24m - activeKpis.llTotal24m);
  });

  it('matriz cenário × driver: valores finitos e v35/v36 coerentes', () => {
    for (const scenario of INITIAL_SCENARIOS) {
      for (const [, partial] of driverCases) {
        const b = bundle(scenario.id, partial);
        expect(Number.isFinite(b.leftKpis.llTotal24m)).toBe(true);
        expect(Number.isFinite(b.rightKpis.llTotal24m)).toBe(true);
        expect(Number.isFinite(b.v35.llTotal24m)).toBe(true);
        expect(Number.isFinite(b.v36.llTotal24m)).toBe(true);
        expect(b.v36.llTotal24m - b.v35.llTotal24m).toBe(b.v36LlDelta);
        expect(b.v36.m24Cash - b.v35.m24Cash).toBe(b.v36CashDelta);
      }
    }
  });

  it('folha (mixCostMode) altera BE M11 mas não LL 24m engine do M6', () => {
    const b = bundle('sc-baseline');
    const capacity = PARAMS.capacity.totalPositions;
    const bes = MIX_COST_MODES.map((mode) =>
      computeMinViableBe({
        items: b.ledgerItems,
        mix: BLEND_CONSERVADOR_MIX,
        capacity,
        costMode: mode,
        payrollRoles: INITIAL_PAYROLL_ROLES,
      }).bePct,
    );
    expect(new Set(bes).size).toBeGreaterThan(1);

    const kpisByMode = MIX_COST_MODES.map(() =>
      bundle('sc-baseline').rightKpis.llTotal24m,
    );
    expect(new Set(kpisByMode).size).toBe(1);
  });

  it('baseline MC ratio = 1 no seed Blend Alvo', () => {
    expect(mixRatioFromMc(BLEND_ALVO_MC_POS)).toBeCloseTo(1, 3);
  });

  it('DEFAULT_SCENARIO_DRIVERS bate seed baseline', () => {
    const baseline = INITIAL_SCENARIOS.find((s) => s.isBaseline)!;
    expect(baseline.drivers.occupancyRate).toBe(DEFAULT_SCENARIO_DRIVERS.occupancyRate);
  });
});
