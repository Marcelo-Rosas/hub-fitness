import { OFFICIAL_TOTALS_24M, SANCO_VAS_FLOORS } from './bpV35Reference';
import { deriveFeuYieldFromFixtures, type FeuYieldByRegime } from './feuYield';
import type { RegimeMix } from './capacityLedger';

export interface HubParams {
  capacity: {
    totalPositions: number;
    targetOccupancy: number;
    /** COMPAT: alimenta CLIA/desova — não remover. */
    palletsPerFeu: number;
    /** HIPÓTESE — só simulador/ledger; não alimenta DRE. */
    regimeMix: RegimeMix;
    /** HIPÓTESE derivada de fixtures — NÃO multiplicar por FEUs/mês como TAM. */
    feuYieldByRegime: FeuYieldByRegime;
    rackBudgetPositions: number;
    floorBudgetM2: number;
  };
  pricing: {
    storageHalfMonth: number;
    handling: number;
    deunitization: number;
    labeling: number;
    adValoremPct: number;
    dasPct: number;
    floors: {
      storage: number;
      handling: number;
      deunitization: number;
      labeling: number;
      adValoremPct: number;
    };
    clia: {
      cifFeu: number;
      /** Markup CLIA sobre CIF (ex.: 0,0008 = +0,08% CIF ≈ R$ 266,24/FEU) */
      storageMarkupPct: number;
      dtaFee: number;
      towerFee: number;
      handlingMarkupPct: number;
      handlingBaseLow: number;
      handlingBaseHigh: number;
      auditTargetPerFeu: number;
      volumeDiscountThresholdFeu: number;
      handlingMarkupPctHighVolume: number;
    };
  };
  ramp: {
    baselineOccupancy: number;
    revenueRampM1M6: { start: number; end: number };
    costRampM1M6: { start: number; end: number };
    expenseRampM1M6: { start: number; end: number };
  };
  fiscal: {
    fatorRFloor: number;
    fatorRMin: number;
    fatorRMax: number;
    plBaseMonthly: number;
    plAdditionalByPhase: { fromMonth: number; amount: number }[];
    /** Frações do DAS (Somam 1). */
    dasIrpjShare: number;
    dasCsllShare: number;
    dasPisCofinsCppIssShare: number;
  };
  capex: {
    total: number;
    contribution: number;
  };
  year3: {
    baseMonthlyNetCash: number;
    monthlyGrossRevenue: number;
    forkliftMonthlyBaseline: number;
    startingCashM24With4pl: number;
    startingCashM24Without4pl: number;
    liquidityCushionAlert: number;
    liquidityCushionCritical: number;
    /** Ocupação operacional Galpão A no Ano 3 (ex.: 0,88 → ~2612 pos). */
    galpaoAOccupancy: number;
  };
  wms: {
    /** true = software próprio (sweat equity); caixa de licença = 0 */
    proprietary: boolean;
  };
  techOpex: {
    active: boolean;
    logcomexMonthly: number;
    wmsCloudMonthly: number;
  };
  rent: {
    baseMonthly: number;
    carenciaAluguelMeses: number;
    igpmPct: number;
    areaM2: number;
    pricePerM2: number;
    condominiumPerM2: number;
  };
  cliaSpine: {
    rampStartMonth: number;
    clientsAtM12: number;
    feuPerClientAtM12: number;
    clientsAtM24: number;
    feuPerClientAtM24: number;
  };
  benchmarks: {
    sancoTcoInhouseMonthly: number;
    tplFitnessMonthly: number;
  };
  /** Site físico da operação — fonte de destino RFQ / frete / ICMS (não catálogo de formulário). */
  site: {
    warehouseCode: string;
    warehouseName: string;
    city: string;
    municipality: string;
    uf: 'SC';
    country: 'BR';
  };
}

function floorPrice(serviceId: string): number {
  return SANCO_VAS_FLOORS.find((f) => f.id === serviceId)?.floorPrice ?? 0;
}

export function formatHubSiteDestination(site: HubParams['site']): string {
  return `${site.uf} — ${site.warehouseName} · ${site.municipality}`;
}

export const defaultParams: HubParams = {
  capacity: {
    totalPositions: OFFICIAL_TOTALS_24M.capacidadePaletes,
    targetOccupancy: 0.75,
    palletsPerFeu: 22,
    // HIPÓTESE — calibrar com SKU master / dwell AG
    regimeMix: { alpha: 0.7, beta: 0.2, gamma: 0.08, delta: 0.02 },
    feuYieldByRegime: deriveFeuYieldFromFixtures(),
    rackBudgetPositions: OFFICIAL_TOTALS_24M.capacidadePaletes,
    floorBudgetM2: 255,
  },
  pricing: {
    storageHalfMonth: floorPrice('floor-arm'),
    handling: floorPrice('floor-mov'),
    deunitization: floorPrice('floor-des'),
    labeling: floorPrice('floor-eti'),
    adValoremPct: 0.001,
    dasPct: 0.06,
    floors: {
      storage: floorPrice('floor-arm'),
      handling: floorPrice('floor-mov'),
      deunitization: floorPrice('floor-des'),
      labeling: floorPrice('floor-eti'),
      adValoremPct: 0.001,
    },
    clia: {
      cifFeu: 332_800,
      storageMarkupPct: 0.0008,
      dtaFee: 100,
      towerFee: 450,
      handlingMarkupPct: 0.266,
      handlingBaseLow: 280,
      handlingBaseHigh: 1_708.37,
      auditTargetPerFeu: 2_038.21,
      volumeDiscountThresholdFeu: 4,
      handlingMarkupPctHighVolume: 0.2,
    },
  },
  ramp: {
    baselineOccupancy: 0.75,
    revenueRampM1M6: { start: 0.6, end: 1.0 },
    costRampM1M6: { start: 0.7, end: 1.0 },
    expenseRampM1M6: { start: 0.85, end: 1.0 },
  },
  fiscal: {
    fatorRFloor: 28.4,
    fatorRMin: 28.01,
    fatorRMax: 28.7,
    plBaseMonthly: 18_500,
    plAdditionalByPhase: [
      { fromMonth: 4, amount: 7_000 },
      { fromMonth: 12, amount: 11_000 },
      { fromMonth: 13, amount: 15_000 },
    ],
    dasIrpjShare: 0.04,
    dasCsllShare: 0.035,
    dasPisCofinsCppIssShare: 0.925,
  },
  capex: {
    total: OFFICIAL_TOTALS_24M.capexInicial,
    contribution: OFFICIAL_TOTALS_24M.capexInicial,
  },
  year3: {
    baseMonthlyNetCash: 67_000,
    monthlyGrossRevenue: 300_000,
    forkliftMonthlyBaseline: 4_800,
    startingCashM24With4pl: 835_488,
    startingCashM24Without4pl: 733_988,
    liquidityCushionAlert: 300_000,
    liquidityCushionCritical: 250_000,
    galpaoAOccupancy: 0.88,
  },
  wms: {
    proprietary: false,
  },
  techOpex: {
    active: false,
    logcomexMonthly: 2_500,
    wmsCloudMonthly: 500,
  },
  rent: {
    baseMonthly: 60_000,
    carenciaAluguelMeses: 6,
    igpmPct: 0.05,
    areaM2: 2_500,
    pricePerM2: 24,
    condominiumPerM2: 2.6,
  },
  cliaSpine: {
    rampStartMonth: 5,
    clientsAtM12: 3,
    feuPerClientAtM12: 2,
    clientsAtM24: 3,
    feuPerClientAtM24: 4,
  },
  benchmarks: {
    sancoTcoInhouseMonthly: 83_868.8,
    tplFitnessMonthly: 43_271.9,
  },
  site: {
    warehouseCode: 'GALPAO-A',
    warehouseName: 'Galpão A',
    city: 'Itajaí',
    municipality: 'Itajaí / Navegantes',
    uf: 'SC',
    country: 'BR',
  },
};
