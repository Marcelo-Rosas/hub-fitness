import { describe, it, expect } from 'vitest';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../data/initialData';
import { defaultParams } from './params';
import { applyMixPreview, BLEND_ALVO_MC_POS } from './mixPreview';
import {
  composeContract,
  defaultContractCtx,
  fatorRComposed,
} from './contracts';
import {
  fatorRFolhaMensalFromLedger,
  computeFatorRSeries,
  ledgerAmount24m,
  summarizeLiveDre,
} from './engine';
import { projectScenario } from './scenarioDrivers';
import { OFFICIAL_TOTALS_24M } from './bpV35Reference';
import type { DreSection } from '../types';

describe('composeContract', () => {
  const ctx = defaultContractCtx(INITIAL_GRANULAR_DRE_ITEMS, defaultParams);

  it('B_CHEIO flat24 receita anchor', () => {
    expect(composeContract('B_CHEIO', ctx).flat24!.receita).toBe(5_211_204);
  });

  it('B carência-aware: âncoras seed', () => {
    const b = composeContract('B_CHEIO', ctx);
    expect(b.flat24!.receita).toBe(5_211_204);
    expect(b.flat24!.custos).toBe(1_712_460);
    expect(b.flat24!.despesas).toBe(2_846_796);
  });

  it('granular Σ ledgerAmount24m === flat24 (mesma fonte)', () => {
    const g = (sec: DreSection) =>
      INITIAL_GRANULAR_DRE_ITEMS.filter((i) => i.active && i.section === sec).reduce(
        (a, i) => a + ledgerAmount24m(i, defaultParams),
        0,
      );
    const b = composeContract('B_CHEIO', ctx).flat24!;
    expect(g('receita')).toBe(b.receita);
    expect(g('despesa')).toBe(b.despesas);
  });

  it('A live === pipeline do context (incl. mix dirty)', () => {
    const scale = 1.2;
    const months = projectScenario(
      applyMixPreview(INITIAL_GRANULAR_DRE_ITEMS, scale),
      ctx.drivers,
      defaultParams,
    );
    const live = summarizeLiveDre(months);
    const a = composeContract('A_PROJETADO', {
      base: INITIAL_GRANULAR_DRE_ITEMS,
      mixScale: scale,
      drivers: ctx.drivers,
      params: defaultParams,
    });
    expect(a.sum24!.receita).toBe(live.receitaTotal);
    expect(a.sum24!.lucro).toBe(live.lucroLiquidoTotal);
  });

  it('E_SEMIFIXO_BE monthly anchor + BE ~65%', () => {
    const monthly = composeContract('E_SEMIFIXO_BE', ctx).monthly!;
    expect(monthly).toBe(143_104);
    const bePct = (monthly / BLEND_ALVO_MC_POS / 2968) * 100;
    expect(bePct).toBeCloseTo(65.0, 0);
  });

  it('C_CANONICO short-circuits to OFFICIAL_TOTALS', () => {
    expect(composeContract('C_CANONICO', ctx).anchors).toBe(OFFICIAL_TOTALS_24M);
    expect(composeContract('C_CANONICO', ctx).anchors!.receitaTotal).toBe(4_805_700);
  });

  it('A_PROJETADO sum24 equals reduce of months', () => {
    const a = composeContract('A_PROJETADO', ctx);
    expect(a.sum24!.receita).toBe(
      a.months!.reduce((s, m) => s + m.receitaServicos, 0),
    );
    expect(a.sum24!.lucro).toBe(
      a.months!.reduce((s, m) => s + m.lucroLiquido, 0),
    );
  });

  it('D_TRAILING12 rbt12 equals last 12 months receita', () => {
    const months = projectScenario(INITIAL_GRANULAR_DRE_ITEMS, ctx.drivers, defaultParams);
    const d = composeContract('D_TRAILING12', ctx);
    expect(d.rbt12).toBe(months.slice(-12).reduce((s, m) => s + m.receitaServicos, 0));
  });
});

describe('fatorRComposed', () => {
  const ctx = defaultContractCtx(INITIAL_GRANULAR_DRE_ITEMS, defaultParams);

  it('matches numerador base × 12 ÷ D trailing-12', () => {
    const r = fatorRComposed(ctx, 24);
    const num = fatorRFolhaMensalFromLedger(INITIAL_GRANULAR_DRE_ITEMS, defaultParams, 24) * 12;
    const den = composeContract('D_TRAILING12', ctx).rbt12!;
    expect(r).toBeCloseTo((num / den) * 100, 2);
  });

  it('stays within BP v3.5 band tolerance', () => {
    const r = fatorRComposed(ctx, 24);
    expect(r).toBeGreaterThanOrEqual(27.8);
    expect(r).toBeLessThanOrEqual(29.5);
  });

  it('M24 da série === fatorRComposed (single-source)', () => {
    const months = projectScenario(INITIAL_GRANULAR_DRE_ITEMS, ctx.drivers, defaultParams);
    const s = computeFatorRSeries(INITIAL_GRANULAR_DRE_ITEMS, months, defaultParams);
    expect(s[23].fatorRJanela).toBe(fatorRComposed(ctx, 24));
  });
});
