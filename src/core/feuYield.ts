import { classifySku, estimateConsumption, type Regime } from './regimes';
import { BRIGHTWAY_SAMPLE } from '../data/fixtures/brightwaySample';
import {
  IMPULSE_SAMPLE,
  IMPULSE_BL_06BRZ2311010_META,
} from '../data/fixtures/impulseSample';

export interface FeuYieldByRegime {
  alpha: { positionsPerFeu: number };
  beta: { positionsPerFeu: number };
  gamma: { floorM2PerFeu: number };
  delta: { floorM2PerFeu: number };
}

/**
 * HIPÓTESE calibrada nos fixtures.
 * Beta usa sets/FEU reais do BL Impulse 06BRZ2311010 (134,5).
 * NÃO multiplicar por 226 FEUs/mês como TAM.
 */
export function deriveFeuYieldFromFixtures(): FeuYieldByRegime {
  const all = [...BRIGHTWAY_SAMPLE, ...IMPULSE_SAMPLE];
  const byRegime: Record<Regime, typeof all> = {
    alpha: [],
    beta: [],
    gamma: [],
    delta: [],
  };
  for (const s of all) {
    byRegime[classifySku(s)].push(s);
  }

  const alphaUnitsPerFeu = 16;
  const alphaSku = byRegime.alpha[0];
  const alphaPos = alphaSku
    ? estimateConsumption(alphaSku, alphaUnitsPerFeu, 'alpha').positions
    : 16;

  const betaSku =
    byRegime.beta.find((s) => s.sku === 'IT9503') ??
    byRegime.beta.find((s) => (s.volumesPerKit ?? 0) >= 3) ??
    byRegime.beta[0];
  const betaSetsPerFeu = IMPULSE_BL_06BRZ2311010_META.totals.setsPerFeu;
  const betaPos = betaSku
    ? estimateConsumption(betaSku, betaSetsPerFeu, 'beta').positions
    : 31;

  const gammaSku = byRegime.gamma[0];
  const gammaUnits = 4;
  const gammaM2 = gammaSku
    ? estimateConsumption(gammaSku, gammaUnits, 'gamma').floorM2
    : 10.5;

  const deltaSku = byRegime.delta[0];
  const deltaUnits = 8;
  const deltaM2 = deltaSku
    ? estimateConsumption(deltaSku, deltaUnits, 'delta').floorM2
    : 6.7;

  return {
    alpha: { positionsPerFeu: Math.round(alphaPos) },
    beta: { positionsPerFeu: Math.round(betaPos) },
    gamma: { floorM2PerFeu: Math.round(gammaM2 * 10) / 10 },
    delta: { floorM2PerFeu: Math.round(deltaM2 * 10) / 10 },
  };
}
