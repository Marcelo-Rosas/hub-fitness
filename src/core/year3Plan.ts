/** Plano de expansão Ano 3 (M25–M36). Premissas numéricas em HubParams.year3. */
import type { HubParams } from './params';
import { deriveCashMilestones } from './cashMilestones';

export const YEAR3_EXPANSION_PLAN: Array<{
  month: number;
  galpaoB: number;
  expansionCapex: number;
}> = [
  { month: 25, galpaoB: 0, expansionCapex: 0 },
  { month: 26, galpaoB: 200, expansionCapex: 0 },
  { month: 27, galpaoB: 400, expansionCapex: 0 },
  { month: 28, galpaoB: 600, expansionCapex: 0 },
  { month: 29, galpaoB: 800, expansionCapex: 400_000 },
  { month: 30, galpaoB: 950, expansionCapex: 0 },
  { month: 31, galpaoB: 1_000, expansionCapex: 400_000 },
  { month: 32, galpaoB: 1_100, expansionCapex: 0 },
  { month: 33, galpaoB: 1_200, expansionCapex: 0 },
  { month: 34, galpaoB: 1_200, expansionCapex: 0 },
  { month: 35, galpaoB: 1_200, expansionCapex: 0 },
  { month: 36, galpaoB: 1_200, expansionCapex: 0 },
];

/** Projeção baseline Y3 (sem delta de empilhadeira) — para footer/Shell. */
export function projectYear3Baseline(params: HubParams, include4pl = true) {
  const y3 = params.year3;
  let cash = include4pl ? y3.startingCashM24With4pl : y3.startingCashM24Without4pl;
  const points = YEAR3_EXPANSION_PLAN.map((step) => {
    const fluxo = y3.baseMonthlyNetCash - step.expansionCapex;
    cash += fluxo;
    return { month: `M${step.month}`, monthNum: step.month, saldo: cash, fluxo };
  });
  const milestones = deriveCashMilestones(points);
  return {
    points,
    valley: milestones.valley,
    mitigated: milestones.valley.saldo >= y3.liquidityCushionAlert,
  };
}
