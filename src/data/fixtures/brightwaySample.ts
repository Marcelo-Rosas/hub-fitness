import type { SkuAsn } from '../../core/regimes';
import { computeCbmM3 } from '../../core/regimes';

/** Fixtures mínimos BRIGHTWAY (handoff / estudo engenharia). 1 caixa madeira = 1 KIT. */
function brightwayKit(
  sku: string,
  lengthMm: number,
  widthMm: number,
  heightMm: number,
  grossWeightKg: number,
): SkuAsn {
  return {
    sku,
    supplier: 'BRIGHTWAY',
    lengthMm,
    widthMm,
    heightMm,
    grossWeightKg,
    interfaceBase: 'skid',
    skuKind: 'kit',
    volumesPerKit: 1,
    cbmDeclaredM3: Math.round(computeCbmM3({ lengthMm, widthMm, heightMm }) * 1000) / 1000,
  };
}

export const BRIGHTWAY_SAMPLE: SkuAsn[] = [
  brightwayKit('TN01', 1620, 1120, 570, 185),
  brightwayKit('TN27', 1620, 1120, 570, 207),
  brightwayKit('TN91', 1620, 1120, 570, 315),
  brightwayKit('TB56', 1620, 1120, 570, 279),
  brightwayKit('TS114', 2320, 1600, 700, 607),
  brightwayKit('TS100', 2270, 970, 650, 520),
  brightwayKit('TB15', 2690, 1120, 600, 472),
];
