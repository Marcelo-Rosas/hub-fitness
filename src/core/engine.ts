import type { HubParams } from './params';
import { defaultParams } from './params';
import type { DreGranularItem, DreMonth } from '../types';
import {
  FORTE_ENTREPOSTO_30D,
  FORTE_DTC_20D,
  FORTE_AUDIT_DELTAS,
  FORTE_BENCHMARK_META,
} from '../data/benchmarkData';
import { OFFICIAL_DRE_MONTHS, OFFICIAL_TOTALS_24M } from './bpV35Reference';

export interface CliaTakeRateResult {
  feuPerMonth: number;
  perFeuMin: number;
  perFeuMax: number;
  takeRateMin: number;
  takeRateMax: number;
  auditSavings: number;
  netClientCostMax: number;
}

export type CliaSensitivityRow = CliaTakeRateResult;

export interface ThreePlPerPalletBreakdown {
  desovaProrata: number;
  storageMonthly: number;
  handlingAssumed: number;
  adValoremAssumed: number;
  totalPerPallet: number;
}

export interface ForteDerived {
  entrepostoTotal: number;
  dtcTotal: number;
  entrepostoPctCif: number;
  dtcPctCif: number;
  costPerPalletEntreposto30d: number;
  auditTargetTotal: number;
  costPerDayEntreposto: number;
  costPerDayDtc: number;
}

function effectiveHandlingMarkup(p: HubParams, feuCount: number): number {
  const { clia } = p.pricing;
  if (feuCount >= clia.volumeDiscountThresholdFeu) {
    return clia.handlingMarkupPctHighVolume;
  }
  return clia.handlingMarkupPct;
}

/** Aluguel = área m² × R$/m² (Y2 aplica IGPM). */
export function computeRentMonthly(params: HubParams, year: 1 | 2): number {
  const base = params.rent.areaM2 * params.rent.pricePerM2;
  return year === 1 ? base : Math.round(base * (1 + params.rent.igpmPct));
}

/** Condomínio = R$/m² condomínio × área (Y2 aplica IGPM). */
export function computeCondominiumMonthly(params: HubParams, year: 1 | 2): number {
  const base = params.rent.areaM2 * params.rent.condominiumPerM2;
  return year === 1 ? base : Math.round(base * (1 + params.rent.igpmPct));
}

export interface OccupancyMonthly {
  areaM2: number;
  pricePerM2: number;
  condominiumPerM2: number;
  rentY1: number;
  rentY2: number;
  condoY1: number;
  condoY2: number;
  totalY1: number;
  totalY2: number;
}

export function computeOccupancyMonthly(params: HubParams = defaultParams): OccupancyMonthly {
  const rentY1 = computeRentMonthly(params, 1);
  const rentY2 = computeRentMonthly(params, 2);
  const condoY1 = computeCondominiumMonthly(params, 1);
  const condoY2 = computeCondominiumMonthly(params, 2);
  return {
    areaM2: params.rent.areaM2,
    pricePerM2: params.rent.pricePerM2,
    condominiumPerM2: params.rent.condominiumPerM2,
    rentY1,
    rentY2,
    condoY1,
    condoY2,
    totalY1: rentY1 + condoY1,
    totalY2: rentY2 + condoY2,
  };
}

/** Contas de ocupação sempre saem do engine — nunca de valor chutado na DRE. */
export function applyOccupancyToDreItems(
  items: DreGranularItem[],
  params: HubParams,
): DreGranularItem[] {
  const occ = computeOccupancyMonthly(params);
  const areaLabel = occ.areaM2.toLocaleString('pt-BR');
  const condoLabel = occ.condominiumPerM2.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return items.map((item) => {
    if (item.manualOverride) return item;
    if (isRentAnalyticLine(item)) {
      return {
        ...item,
        monthlyAmountY1: occ.rentY1,
        monthlyAmountY2: occ.rentY2,
        notes: `${areaLabel} m² × R$ ${occ.pricePerM2}/m² = R$ ${occ.rentY1.toLocaleString('pt-BR')}/mês. M1–M6 = R$ 0 (Carência Aluguel). M13+ aplica IGPM ${params.rent.igpmPct * 100}%.`,
        composition: [
          {
            id: 'desp-alug-base',
            name: `Locação ${areaLabel} m²`,
            formula: `${occ.areaM2} m² × R$ ${occ.pricePerM2}/m²`,
            monthlyAmountY1: occ.rentY1,
            monthlyAmountY2: occ.rentY2,
          },
        ],
      };
    }
    if (isCondoAnalyticLine(item)) {
      return {
        ...item,
        monthlyAmountY1: occ.condoY1,
        monthlyAmountY2: occ.condoY2,
        notes: `R$ ${condoLabel}/m² × ${areaLabel} m². Independente do aluguel (R$ ${occ.pricePerM2}/m²).`,
        composition: [
          {
            id: 'desp-cond',
            name: `Condomínio R$ ${condoLabel}/m²`,
            formula: `R$ ${condoLabel}/m² × ${occ.areaM2} m²`,
            monthlyAmountY1: occ.condoY1,
            monthlyAmountY2: occ.condoY2,
          },
        ],
      };
    }
    return item;
  });
}

export const SC_V36_WMS_PROPRIO = 'sc-v36-wms-proprio';
export const TECH_OPEX_ACCOUNT_ID = 'cst-opex-tech';
export const CLIA_LEDGER_ITEM_ID = 'rec-4pl-ct';
export const RENT_LEDGER_ITEM_ID = 'cst-aluguel';
export const CONDO_LEDGER_ITEM_ID = 'cst-condominio';
/** Sintética de ocupação — rollup DRE; não recebe lançamento. */
export const OCCUPANCY_SYNTHETIC_CODE = '5.2.02';
/** Analítica de aluguel — única linha com carência hubParams.rent.carenciaAluguelMeses. */
export const RENT_ANALYTIC_CODE = '5.2.02.01';
export const CONDO_ANALYTIC_CODE = '5.2.02.02';

export function isOccupancyCoa(accountCode?: string): boolean {
  if (!accountCode) return false;
  return accountCode === OCCUPANCY_SYNTHETIC_CODE || accountCode.startsWith(`${OCCUPANCY_SYNTHETIC_CODE}.`);
}

export function isRentAnalyticLine(item: Pick<DreGranularItem, 'id' | 'accountCode'>): boolean {
  return item.id === RENT_LEDGER_ITEM_ID || item.accountCode === RENT_ANALYTIC_CODE;
}

export function isCondoAnalyticLine(item: Pick<DreGranularItem, 'id' | 'accountCode'>): boolean {
  return item.id === CONDO_LEDGER_ITEM_ID || item.accountCode === CONDO_ANALYTIC_CODE;
}

export function isRentOrCondoLine(item: Pick<DreGranularItem, 'id' | 'accountCode'>): boolean {
  return isRentAnalyticLine(item) || isCondoAnalyticLine(item);
}

/** Pai sintético de 4 níveis: 5.2.02.01 → 5.2.02. */
export function coaSyntheticParent(accountCode?: string): string | undefined {
  if (!accountCode) return undefined;
  const parts = accountCode.split('.');
  if (parts.length <= 3) return accountCode;
  return parts.slice(0, 3).join('.');
}

export function occupancyAmountForMonth(
  items: DreGranularItem[],
  month: number,
  params: HubParams = defaultParams,
): number {
  return items
    .filter(
      (item) =>
        item.active &&
        (isOccupancyCoa(item.accountCode) || isRentAnalyticLine(item) || isCondoAnalyticLine(item)),
    )
    .reduce((acc, item) => acc + ledgerAmountForMonth(item, month, params), 0);
}

/** Valor da linha no mês (Y1/Y2 + carência 5.2.02.01). Sem rampa/ocupação de receita. */
export function ledgerAmountForMonth(
  item: DreGranularItem,
  month: number,
  params: HubParams = defaultParams,
): number {
  if (!item.active) return 0;
  const y = month <= 12 ? item.monthlyAmountY1 : item.monthlyAmountY2;
  if (isRentAnalyticLine(item) && month <= params.rent.carenciaAluguelMeses) return 0;
  return y;
}

export function ledgerAmount24m(item: DreGranularItem, params: HubParams = defaultParams): number {
  let total = 0;
  for (let m = 1; m <= 24; m++) total += ledgerAmountForMonth(item, m, params);
  return total;
}

export function isLedgerItemLocked(item: Pick<DreGranularItem, 'id' | 'engineLocked'>): boolean {
  return item.engineLocked === true || item.id === CLIA_LEDGER_ITEM_ID;
}

export function canPostToAccount(account: { type: string } | undefined | null): boolean {
  return account?.type === 'Analítica';
}

export function isAccountInUse(accountCode: string, items: DreGranularItem[]): boolean {
  return items.some((item) => item.accountCode === accountCode);
}

export function applyCliaToDreItems(
  items: DreGranularItem[],
  params: HubParams = defaultParams,
): DreGranularItem[] {
  const y1 = computeCliaSpineMonthly(12, params);
  const y2 = computeCliaSpineMonthly(24, params);
  return items.map((item) => {
    if (item.id !== CLIA_LEDGER_ITEM_ID) return item;
    return {
      ...item,
      engineLocked: true,
      monthlyAmountY1: y1,
      monthlyAmountY2: y2,
      active: true,
    };
  });
}

/** Interpola rampa M1–M6: start + (end-start)*(m/6). */
export function rampFactor(start: number, end: number, month: number, rampMonths = 6): number {
  if (month > rampMonths) return end;
  return start + (end - start) * (month / rampMonths);
}

export function plAdditionalForMonth(params: HubParams, monthNum: number): number {
  let amount = 0;
  for (const phase of params.fiscal.plAdditionalByPhase) {
    if (monthNum >= phase.fromMonth) amount = phase.amount;
  }
  return amount;
}

/**
 * Folha mensal elegível ao numerador do Fator R a partir do ledger base.
 * Usa flags isFatorRNumerator / isFatorRExcluded; fallback: costBehavior=hc sem excluded.
 * PL adicional usa degrau hubParams (não Y1 flat do ledger).
 */
export function fatorRFolhaMensalFromLedger(
  items: DreGranularItem[],
  params: HubParams,
  monthNum: number,
): number {
  const baseHc = items
    .filter(
      (item) =>
        item.active &&
        item.id !== 'cst-pl-adicional' &&
        item.isFatorRExcluded !== true &&
        (item.isFatorRNumerator === true ||
          (item.isFatorRNumerator == null && item.costBehavior === 'hc')),
    )
    .reduce((acc, item) => acc + item.monthlyAmountY1, 0);
  return baseHc + plAdditionalForMonth(params, monthNum);
}

/** Despesas + custos fixos ativos (break-even Mix). Exclui PL adicional gatilho. */
export function fixedOpexMonthlyFromLedger(items: DreGranularItem[]): number {
  return items
    .filter(
      (i) =>
        i.active &&
        i.id !== 'cst-pl-adicional' &&
        (i.costBehavior === 'fixed' || i.costBehavior == null) &&
        (i.section === 'despesa' || i.section === 'custo') &&
        i.type === 'fixo',
    )
    .reduce((acc, i) => acc + i.monthlyAmountY1, 0);
}

export function projectDreFromLedger(
  items: DreGranularItem[],
  occupancyRate: number,
  params: HubParams = defaultParams,
): DreMonth[] {
  const baselineOccupancy = params.ramp.baselineOccupancy;
  const occFactor = baselineOccupancy === 0 ? 1 : occupancyRate / baselineOccupancy;
  const sum = (section: DreGranularItem['section'], year: 1 | 2) =>
    items
      .filter((i) => i.active && i.section === section)
      .reduce((a, b) => a + (year === 1 ? b.monthlyAmountY1 : b.monthlyAmountY2), 0);

  const activeReceitasY1 = sum('receita', 1);
  const activeReceitasY2 = sum('receita', 2);
  const activeCustosY1 = sum('custo', 1);
  const activeCustosY2 = sum('custo', 2);

  const months: DreMonth[] = [];
  for (let m = 1; m <= 24; m++) {
    const isY1 = m <= 12;
    let baseRev = isY1 ? activeReceitasY1 : activeReceitasY2;
    if (m <= 6) {
      const r = params.ramp.revenueRampM1M6;
      baseRev = baseRev * rampFactor(r.start, r.end, m) * occFactor;
    } else {
      baseRev = baseRev * occFactor;
    }

    let baseCusto = isY1 ? activeCustosY1 : activeCustosY2;
    if (m <= 6) {
      const r = params.ramp.costRampM1M6;
      baseCusto = baseCusto * rampFactor(r.start, r.end, m) * occFactor;
    } else {
      baseCusto = baseCusto * occFactor;
    }

    let occupancyDesp = 0;
    let otherDesp = 0;
    for (const item of items) {
      if (!item.active || item.section !== 'despesa') continue;
      const amt = ledgerAmountForMonth(item, m, params);
      if (isOccupancyCoa(item.accountCode) || isRentAnalyticLine(item) || isCondoAnalyticLine(item)) {
        occupancyDesp += amt;
      } else {
        otherDesp += amt;
      }
    }
    if (m <= 6) {
      const r = params.ramp.expenseRampM1M6;
      otherDesp = otherDesp * rampFactor(r.start, r.end, m);
    }
    const baseDespesa = occupancyDesp + otherDesp;

    const das = baseRev * params.pricing.dasPct;
    months.push({
      month: m,
      label: `M${m}`,
      receitaServicos: Math.round(baseRev),
      das6Percent: Math.round(das),
      irpj: Math.round(das * params.fiscal.dasIrpjShare),
      csll: Math.round(das * params.fiscal.dasCsllShare),
      pisCofinsCppIss: Math.round(das * params.fiscal.dasPisCofinsCppIssShare),
      custosOperacionais: Math.round(baseCusto),
      despesasOperacionais: Math.round(baseDespesa),
      lucroLiquido: Math.round(baseRev - das - baseCusto - baseDespesa),
    });
  }
  return months;
}

export function computeTechOpexMonthly(params: HubParams = defaultParams): number {
  if (!params.techOpex.active) return 0;
  return params.techOpex.logcomexMonthly + params.techOpex.wmsCloudMonthly;
}

export function applyScenarioPreset(params: HubParams, scenarioId: string): HubParams {
  const isV36 = scenarioId === SC_V36_WMS_PROPRIO;
  return {
    ...params,
    wms: { proprietary: isV36 },
    techOpex: { ...params.techOpex, active: isV36 },
  };
}

/** DAS não muda: Simples incide sobre receita, não sobre lucro. */
export function applyTechOpexToDreMonths(months: DreMonth[], params: HubParams): DreMonth[] {
  const opex = computeTechOpexMonthly(params);
  if (opex === 0) return months;
  return months.map((m) => ({
    ...m,
    despesasOperacionais: m.despesasOperacionais + opex,
    lucroLiquido: m.lucroLiquido - opex,
  }));
}

export function applyTechOpexToDreItems(
  items: DreGranularItem[],
  params: HubParams,
): DreGranularItem[] {
  const existing = items.find((item) => item.id === TECH_OPEX_ACCOUNT_ID);
  if (existing?.manualOverride) return items;
  const without = items.filter((item) => item.id !== TECH_OPEX_ACCOUNT_ID);
  if (!params.techOpex.active) return without;

  const logcomex = params.techOpex.logcomexMonthly;
  const cloud = params.techOpex.wmsCloudMonthly;
  const total = logcomex + cloud;

  const line: DreGranularItem = {
    id: TECH_OPEX_ACCOUNT_ID,
    section: 'despesa',
    type: 'fixo',
    category: 'Tecnologia',
    name: 'OPEX Tech (Logcomex + Cloud WMS)',
    monthlyAmountY1: total,
    monthlyAmountY2: total,
    active: true,
    accountCode: '5.2.03.03',
    costCenterId: 'CC 001',
    notes: 'Custo fixo. DAS inalterado (incide sobre receita). Não substitui o CV R$ 16,45/pos. CAPEX de software = 0 (WMS próprio); CCTV permanece no CAPEX 207.300 até cotação.',
    composition: [
      {
        id: 'desp-tech-logcomex',
        name: 'Assinatura Logcomex (API / Insights)',
        formula: 'params.techOpex.logcomexMonthly',
        monthlyAmountY1: logcomex,
        monthlyAmountY2: logcomex,
      },
      {
        id: 'desp-tech-cloud',
        name: 'Infra cloud WMS proprietário',
        formula: 'params.techOpex.wmsCloudMonthly',
        monthlyAmountY1: cloud,
        monthlyAmountY2: cloud,
      },
    ],
  };

  return [...without, line];
}

export interface WmsProprioImpact {
  techOpexMonthly: number;
  techOpex24m: number;
  capexTotal: number;
  capexDeltaVsV35: number;
  saldoM0: number;
  lucroAno1: number;
  lucroAno2: number;
  lucro24m: number;
  llM7Plus: number;
  saldoM24CarenciaAluguel: number;
  dasUnchanged: true;
  wmsSoftwareCash: number;
}

/** Overlay v3.6 sobre totais BP v3.5. CAPEX não cai R$ 17k — CCTV não cotado. */
export function computeWmsProprioImpact(params: HubParams = defaultParams): WmsProprioImpact {
  const monthly = params.techOpex.logcomexMonthly + params.techOpex.wmsCloudMonthly;
  const extra24m = monthly * 24;
  return {
    techOpexMonthly: monthly,
    techOpex24m: extra24m,
    capexTotal: OFFICIAL_TOTALS_24M.capexInicial,
    capexDeltaVsV35: 0,
    saldoM0: OFFICIAL_TOTALS_24M.saldoCaixaM0,
    lucroAno1: OFFICIAL_TOTALS_24M.lucroLiquidoAno1 - monthly * 12,
    lucroAno2: OFFICIAL_TOTALS_24M.lucroLiquidoAno2 - monthly * 12,
    lucro24m: OFFICIAL_TOTALS_24M.lucroLiquidoTotal - extra24m,
    llM7Plus: OFFICIAL_TOTALS_24M.llM7Plus - monthly,
    saldoM24CarenciaAluguel: OFFICIAL_TOTALS_24M.saldoCaixaM24CarenciaAluguel - extra24m,
    dasUnchanged: true,
    wmsSoftwareCash: 0,
  };
}

/** Take rate CLIA por cliente/mês para n FEU */
export function computeCliaTakeRate(
  params: HubParams,
  feuPerMonth: number,
): CliaTakeRateResult {
  const { clia } = params.pricing;
  const markup = effectiveHandlingMarkup(params, feuPerMonth);
  const storageRev = clia.storageMarkupPct * clia.cifFeu;
  const perFeuMin =
    storageRev + clia.dtaFee + markup * clia.handlingBaseLow;
  const perFeuMax =
    storageRev + clia.dtaFee + markup * clia.handlingBaseHigh;
  const takeRateMin = clia.towerFee + feuPerMonth * perFeuMin;
  const takeRateMax = clia.towerFee + feuPerMonth * perFeuMax;
  const auditSavings = feuPerMonth * clia.auditTargetPerFeu;

  return {
    feuPerMonth,
    perFeuMin,
    perFeuMax,
    takeRateMin,
    takeRateMax,
    auditSavings,
    netClientCostMax: takeRateMax - auditSavings,
  };
}

export function computeCliaSensitivity(
  params: HubParams,
  maxFeu = 5,
): CliaSensitivityRow[] {
  return Array.from({ length: maxFeu }, (_, i) =>
    computeCliaTakeRate(params, i + 1),
  );
}

/** Spine CLIA mensal (M5+ ramp até M24) — alinha banda BP R$ 6k M12 */
export function computeCliaSpineMonthly(
  monthNum: number,
  params: HubParams = defaultParams,
): number {
  const { cliaSpine } = params;
  if (monthNum < cliaSpine.rampStartMonth) return 0;

  const rampEnd = 12;
  const t = Math.min(
    1,
    (monthNum - cliaSpine.rampStartMonth) / (rampEnd - cliaSpine.rampStartMonth),
  );
  const clients =
    monthNum >= 12
      ? cliaSpine.clientsAtM12 +
        ((monthNum - 12) / 12) * (cliaSpine.clientsAtM24 - cliaSpine.clientsAtM12)
      : 1 + t * (cliaSpine.clientsAtM12 - 1);
  const feuPerClient =
    monthNum >= 12
      ? cliaSpine.feuPerClientAtM12 +
        ((monthNum - 12) / 12) * (cliaSpine.feuPerClientAtM24 - cliaSpine.feuPerClientAtM12)
      : 1 + t * (cliaSpine.feuPerClientAtM12 - 1);

  const perClient = computeCliaTakeRate(params, feuPerClient).takeRateMax;
  return Math.round(clients * perClient);
}

export function computeForteDerived(
  params: HubParams = defaultParams,
): ForteDerived {
  const pallets = params.capacity.palletsPerFeu;
  const cif = params.pricing.clia.cifFeu;
  const entrepostoTotal = FORTE_ENTREPOSTO_30D.lines.reduce((a, l) => a + l.value, 0);
  const dtcTotal = FORTE_DTC_20D.lines.reduce((a, l) => a + l.value, 0);

  return {
    entrepostoTotal,
    dtcTotal,
    entrepostoPctCif: entrepostoTotal / cif,
    dtcPctCif: dtcTotal / cif,
    costPerPalletEntreposto30d: entrepostoTotal / pallets,
    auditTargetTotal: FORTE_AUDIT_DELTAS.reduce((a, d) => a + d.deltaPerFeu, 0),
    costPerDayEntreposto: entrepostoTotal / FORTE_ENTREPOSTO_30D.estadiaDays,
    costPerDayDtc: dtcTotal / FORTE_DTC_20D.estadiaDays,
  };
}

export function compute3plPerPallet(params: HubParams = defaultParams): ThreePlPerPalletBreakdown {
  const { pricing, capacity } = params;
  const desovaProrata = pricing.deunitization / capacity.palletsPerFeu;
  const storageMonthly = pricing.storageHalfMonth * 2;
  const handlingAssumed = 50;
  const adValoremAssumed = 15.1;

  return {
    desovaProrata,
    storageMonthly,
    handlingAssumed,
    adValoremAssumed,
    totalPerPallet: desovaProrata + storageMonthly + handlingAssumed + adValoremAssumed,
  };
}

export function computeDesovaMarkupPrice(params: HubParams = defaultParams): number {
  const desovaForte = 933.13;
  return desovaForte * (1 + params.pricing.clia.handlingMarkupPct);
}

export interface DreTotals24m {
  receitaTotal: number;
  lucroLiquidoTotal: number;
}

/** BP v3.5 CSV freeze — seed/auditoria only. Not the live DRE contract. */
export function summarizeOfficialDre(): DreTotals24m {
  return {
    receitaTotal: OFFICIAL_TOTALS_24M.receitaTotal,
    lucroLiquidoTotal: OFFICIAL_TOTALS_24M.lucroLiquidoTotal,
  };
}

/** Live DRE contract: 1 source (ledger → projectDreFromLedger) → N consumers (M2 cards, table, footer). */
export interface LiveDreTotals {
  receitaTotal: number;
  custosOperacionaisTotal: number;
  despesasOperacionaisTotal: number;
  dasTotal: number;
  lucroBrutoTotal: number;
  lucroLiquidoTotal: number;
  margemLiquidaPercent: number;
}

export function summarizeLiveDre(months: DreMonth[]): LiveDreTotals {
  const receitaTotal = months.reduce((a, m) => a + m.receitaServicos, 0);
  const custosOperacionaisTotal = months.reduce((a, m) => a + m.custosOperacionais, 0);
  const despesasOperacionaisTotal = months.reduce((a, m) => a + m.despesasOperacionais, 0);
  const dasTotal = months.reduce((a, m) => a + m.das6Percent, 0);
  const lucroLiquidoTotal = months.reduce((a, m) => a + m.lucroLiquido, 0);
  const lucroBrutoTotal = receitaTotal - custosOperacionaisTotal - dasTotal;
  const margemLiquidaPercent = receitaTotal === 0 ? 0 : (lucroLiquidoTotal / receitaTotal) * 100;
  return {
    receitaTotal,
    custosOperacionaisTotal,
    despesasOperacionaisTotal,
    dasTotal,
    lucroBrutoTotal,
    lucroLiquidoTotal,
    margemLiquidaPercent,
  };
}

export function diffVsOfficialPct(actual: number, official: number): number {
  if (official === 0) return 0;
  return ((actual - official) / official) * 100;
}

export interface EngineKpis {
  receita24m: number;
  lucro24m: number;
  saldoM24CarenciaAluguel: number;
  saldoM24Puro: number;
  cliaSpineM12: number;
  cliaSpineM24: number;
  forteEntrepostoPerPallet: number;
  tpl3plPerPallet: number;
  costRatio3plVsEntreposto: number;
  occupancy: OccupancyMonthly;
  techOpexMonthly: number;
  wmsProprietary: boolean;
}

export function computeKpis(params: HubParams = defaultParams): EngineKpis {
  const dre = summarizeOfficialDre();
  const forte = computeForteDerived(params);
  const tpl = compute3plPerPallet(params);
  const extra24m = computeTechOpexMonthly(params) * 24;

  return {
    receita24m: dre.receitaTotal,
    lucro24m: dre.lucroLiquidoTotal - extra24m,
    saldoM24CarenciaAluguel: OFFICIAL_TOTALS_24M.saldoCaixaM24CarenciaAluguel - extra24m,
    saldoM24Puro: OFFICIAL_TOTALS_24M.saldoCaixaM24Puro - extra24m,
    cliaSpineM12: computeCliaSpineMonthly(12, params),
    cliaSpineM24: computeCliaSpineMonthly(24, params),
    forteEntrepostoPerPallet: forte.costPerPalletEntreposto30d,
    tpl3plPerPallet: tpl.totalPerPallet,
    costRatio3plVsEntreposto: forte.costPerPalletEntreposto30d / tpl.totalPerPallet,
    occupancy: computeOccupancyMonthly(params),
    techOpexMonthly: computeTechOpexMonthly(params),
    wmsProprietary: params.wms.proprietary,
  };
}

export { FORTE_BENCHMARK_META, FORTE_AUDIT_DELTAS };
