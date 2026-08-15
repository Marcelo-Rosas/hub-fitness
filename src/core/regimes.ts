/** Motor de regimes de armazenagem (Anexo V / HANDOFF v2). Não alimenta DRE. */

export type Regime = 'alpha' | 'beta' | 'gamma' | 'delta';
export type InterfaceBase = 'skid' | 'no_base';
/** KIT = unidade lógica de venda/recebimento; PARTE = carton/volume físico. */
export type SkuKind = 'kit' | 'part';
export type PartRole =
  | 'estrutura'
  | 'painel'
  | 'weight_stack'
  | 'acessorio'
  | 'unidade'
  | 'spare';

export interface SkuAsn {
  sku: string;
  supplier: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  grossWeightKg: number;
  interfaceBase: InterfaceBase;
  /** Limite de empilhamento declarado (Delta). */
  stackLimit?: number;
  /** Volumes por kit (Beta Impulse kit-linking). */
  volumesPerKit?: number;
  /** SKU master confirma; classifier só sugere. */
  regimeOverride?: Regime;
  /** Cadastro: KIT lógico vs PARTE (caixa/volume). */
  skuKind?: SkuKind;
  /** SKU do kit pai quando skuKind=part. */
  parentSku?: string;
  partRole?: PartRole;
  /** Índice 1-based do carton no kit (BOX n OF N). */
  cartonIndex?: number;
  /** CBM declarado no packing list (m³); se ausente, usa cubagem calculada. */
  cbmDeclaredM3?: number;
}

/** Cubagem m³ a partir de L×W×H em mm. */
export function computeCbmM3(s: Pick<SkuAsn, 'lengthMm' | 'widthMm' | 'heightMm'>): number {
  return (s.lengthMm / 1000) * (s.widthMm / 1000) * (s.heightMm / 1000);
}

/** Preferência: CBM declarado do BL; senão L×W×H. */
export function resolveCbmM3(s: SkuAsn): number {
  if (typeof s.cbmDeclaredM3 === 'number' && Number.isFinite(s.cbmDeclaredM3)) {
    return s.cbmDeclaredM3;
  }
  return computeCbmM3(s);
}

/** Geometria baía porta-paletes (NBR 17150-2 / estudo BRIGHTWAY). */
export const RACK = {
  beamClearMm: 2300,
  depthMm: 1000,
  clearXMm: 75,
  clearYMm: 150,
  profileMm: 130,
  uprightMm: 6000,
  minOverhangMm: 50,
  /** Pitch Alpha: altura caixa + clearY + perfil ≈ 850 mm → 8 níveis. */
  alphaPitchMm: 850,
} as const;

export const PBR_PAYLOAD_KG = 800;

export function footprintM2(s: Pick<SkuAsn, 'lengthMm' | 'widthMm'>): number {
  return (s.lengthMm / 1000) * (s.widthMm / 1000);
}

function fitsEnvelope(s: SkuAsn): boolean {
  const overhang = (s.widthMm - RACK.depthMm) / 2;
  const fitsDepth = overhang >= RACK.minOverhangMm && s.widthMm <= 1150;
  const fitsLength = s.lengthMm + 2 * RACK.clearXMm <= RACK.beamClearMm;
  return fitsDepth && fitsLength;
}

/**
 * Classifica SKU por BASE (skid vs no_base), não por parede.
 * Ordem travada: override → alpha → gamma (skid oversized) → delta → beta.
 */
export function classifySku(s: SkuAsn): Regime {
  if (s.regimeOverride) return s.regimeOverride;

  const fits = fitsEnvelope(s);

  if (s.interfaceBase === 'skid') {
    return fits ? 'alpha' : 'gamma';
  }

  // no_base: Delta antes de qualquer lógica de envelope (esteira oversized + stack_limit)
  if ((s.stackLimit ?? 0) >= 3) return 'delta';

  return 'beta';
}

export interface Consumption {
  positions: number;
  floorM2: number;
}

/**
 * Consumo de capacidade por unidade lógica (após kit-linking quando aplicável).
 * Beta: consolidação PBR heurística (payload 800 kg) — placeholder até BOM.
 */
export function estimateConsumption(
  s: SkuAsn,
  qty: number,
  regime?: Regime,
): Consumption {
  const r = regime ?? classifySku(s);
  const fp = footprintM2(s);

  switch (r) {
    case 'alpha':
      return { positions: qty, floorM2: 0 };
    case 'beta': {
      const perPallet = Math.max(1, Math.floor(PBR_PAYLOAD_KG / Math.max(1, s.grossWeightKg)));
      return { positions: Math.ceil(qty / perPallet), floorM2: 0 };
    }
    case 'gamma':
      // block 2-high
      return { positions: 0, floorM2: (qty * fp) / 2 };
    case 'delta': {
      const stack = Math.max(1, s.stackLimit ?? 3);
      return { positions: 0, floorM2: (qty * fp) / stack };
    }
  }
}

export interface DwellRow {
  regime: Regime;
  dwellDays: number;
}

/** Mediana de dwell por regime; null se sem amostra. */
export function medianDwellDays(
  rows: DwellRow[],
): Record<Regime, number | null> {
  const out: Record<Regime, number | null> = {
    alpha: null,
    beta: null,
    gamma: null,
    delta: null,
  };
  const byRegime: Record<Regime, number[]> = {
    alpha: [],
    beta: [],
    gamma: [],
    delta: [],
  };
  for (const row of rows) {
    if (Number.isFinite(row.dwellDays) && row.dwellDays >= 0) {
      byRegime[row.regime].push(row.dwellDays);
    }
  }
  for (const r of Object.keys(byRegime) as Regime[]) {
    const arr = [...byRegime[r]].sort((a, b) => a - b);
    if (arr.length === 0) {
      out[r] = null;
      continue;
    }
    const mid = Math.floor(arr.length / 2);
    out[r] = arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
  }
  return out;
}

/** Cabeçalho CSV para extração no AG (dwell fecha fora do IDE). */
export const DWELL_CSV_HEADER =
  'embarque,sku,regime,data_entrada,data_saida,dwell_dias';

/**
 * AVISO DE DOMÍNIO: feuYield.alpha * FEUs_mês NÃO é TAM nem market share.
 * Fluxo ≠ estoque sem dwell. Ver capacityLedger.ts.
 */
export const TAM_WARNING =
  'Não usar feuYield.alpha × FEUs/mês como TAM ou market share. Fluxo ≠ estoque sem dwell.';
