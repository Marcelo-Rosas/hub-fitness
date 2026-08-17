import { DreGranularItem, DreMonth, Scenario } from '../types';
import { exportDre24mCSV, exportDre24mPDF } from './exportHandlers';
import { liveMonths } from './liveExport';

function monthsWithSensitivity(months: DreMonth[], sensitivityFactor: number): DreMonth[] {
  const base = liveMonths(months);
  if (sensitivityFactor === 0) return base;
  const mult = 1 + sensitivityFactor / 100;
  return base.map((m) => {
    const rec = Math.round(m.receitaServicos * mult);
    const das = Math.round(m.das6Percent * mult);
    const cus = Math.round(m.custosOperacionais * mult);
    const des = Math.round(m.despesasOperacionais * (sensitivityFactor < 0 ? 1 : mult));
    return {
      ...m,
      receitaServicos: rec,
      das6Percent: das,
      custosOperacionais: cus,
      despesasOperacionais: des,
      lucroLiquido: rec - das - cus - des,
    };
  });
}

function scenarioLabel(scenario: Scenario, sensitivityFactor: number): string {
  const base = scenario.name.replace(/\s+/g, '_');
  return sensitivityFactor === 0 ? base : `${base}_sens${sensitivityFactor}`;
}

/** CSV M2 = mesmo payload do PDF (ledger live, sem freeze BP). */
export function exportM2ToExcel(
  granularItems: DreGranularItem[],
  months: DreMonth[],
  scenario: Scenario,
  sensitivityFactor: number,
) {
  exportDre24mCSV(
    monthsWithSensitivity(months, sensitivityFactor),
    scenarioLabel(scenario, sensitivityFactor),
    granularItems,
  );
}

export function exportM2ToPdf(
  granularItems: DreGranularItem[],
  months: DreMonth[],
  scenario: Scenario,
  sensitivityFactor: number,
) {
  exportDre24mPDF(
    monthsWithSensitivity(months, sensitivityFactor),
    scenarioLabel(scenario, sensitivityFactor),
    granularItems,
  );
}
