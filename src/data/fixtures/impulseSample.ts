import type { PartRole, SkuAsn } from '../../core/regimes';

/**
 * Packing List Impulse BL 06BRZ2311010 (INV H231573).
 * Fonte: Downloads/BL 06BRZ2311010 PACKING LIST (2).pdf
 * Ordenante: KONNEN · Consignatária: Garra Trade · Porto: Navegantes · 2×40HC
 *
 * Cadastro: 1 KIT (set) + N PARTES (cartons). Máquinas selectorized:
 * BOX1/2 estrutura, BOX3 painéis; weight stacks complementam o kit (4 CTN).
 * Dimensões L×W×H estimadas do CBM do carton (packlist sem mm).
 */

export const IMPULSE_BL_06BRZ2311010_META = {
  packingListId: 'BL-06BRZ2311010',
  invNo: 'H231573',
  supplier: 'Impulse (Qingdao) Health Tech Co.,Ltd.',
  orderBy: 'KONNEN COMERCIO DE FERRAMENTAS LTDA',
  consignee: 'GARRA TRADE IMPORTACAO E EXPORTACAO LTDA',
  portDischarge: 'NAVEGANTES',
  vessel: 'KOTA CEPAT 0061W',
  etd: '2023-11-27',
  eta: '2023-11-30',
  containers: [
    {
      id: 'TCLU1879947',
      type: '40HC',
      sets: 130,
      cartons: 350,
      netKg: 13_546.3,
      grossKg: 15_174.5,
      cbm: 63.643,
    },
    {
      id: 'APHU6756141',
      type: '40HC',
      sets: 139,
      cartons: 429,
      netKg: 17_252.6,
      grossKg: 18_850.3,
      cbm: 64.382,
    },
  ],
  totals: {
    sets: 269,
    cartons: 779,
    netKg: 30_798.9,
    grossKg: 34_024.8,
    cbm: 128.025,
    feu: 2,
    setsPerFeu: 134.5,
    cartonsPerFeu: 389.5,
    kgPerFeu: 17_012.4,
  },
} as const;

export interface ImpulsePackingSku extends SkuAsn {
  description: string;
  /** Sets neste embarque (só no KIT). */
  setsInShipment: number;
  packingListId: string;
}

function dimsFromCbm(cbm: number): Pick<SkuAsn, 'lengthMm' | 'widthMm' | 'heightMm'> {
  const k = Math.cbrt(cbm / (1.2 * 0.85 * 1.0));
  return {
    lengthMm: Math.max(200, Math.round(1.2 * k * 1000)),
    widthMm: Math.max(200, Math.round(0.85 * k * 1000)),
    heightMm: Math.max(150, Math.round(1.0 * k * 1000)),
  };
}

function partRoleFor(sku: string, index: number, total: number): PartRole {
  if (/WS|WEIGHT STACK/i.test(sku)) return 'weight_stack';
  if (total === 1) return 'unidade';
  if (total === 2) return index === 0 ? 'estrutura' : 'estrutura';
  if (total === 3) {
    if (index === 0 || index === 1) return 'estrutura';
    return 'painel';
  }
  if (total === 4) {
    if (index < 2) return 'estrutura';
    if (index === 2) return 'painel';
    return 'acessorio';
  }
  if (index < 2) return 'estrutura';
  if (index === 2) return 'painel';
  return 'acessorio';
}

/**
 * Explode 1 set Impulse em KIT + PARTES (1 carton = 1 parte).
 * KIT usa dims do maior carton; cubagem do kit = soma dos CBMs declarados.
 */
function explodeKit(
  sku: string,
  description: string,
  sets: number,
  cartonGrossKg: number[],
  cartonCbm: number[],
): ImpulsePackingSku[] {
  const volumesPerKit = cartonGrossKg.length;
  const grossWeightKg = Math.round(cartonGrossKg.reduce((a, b) => a + b, 0) * 10) / 10;
  const cbmTotal = cartonCbm.reduce((a, b) => a + b, 0);
  const maxIdx = cartonCbm.indexOf(Math.max(...cartonCbm));
  const kitDims = dimsFromCbm(cartonCbm[maxIdx]);

  const kitRow: ImpulsePackingSku = {
    sku,
    description,
    supplier: 'Impulse Qingdao',
    ...kitDims,
    grossWeightKg,
    interfaceBase: 'no_base',
    volumesPerKit,
    skuKind: 'kit',
    setsInShipment: sets,
    cbmDeclaredM3: Math.round(cbmTotal * 1000) / 1000,
    packingListId: IMPULSE_BL_06BRZ2311010_META.packingListId,
  };

  if (volumesPerKit <= 1) {
    return [kitRow];
  }

  const parts: ImpulsePackingSku[] = cartonGrossKg.map((gw, i) => {
    const cbm = cartonCbm[i];
    const role = partRoleFor(sku, i, volumesPerKit);
    return {
      sku: `${sku}-P${i + 1}`,
      description: `${description} · BOX ${i + 1}/${volumesPerKit} (${role})`,
      supplier: 'Impulse Qingdao',
      ...dimsFromCbm(cbm),
      grossWeightKg: gw,
      interfaceBase: 'no_base',
      volumesPerKit: 1,
      skuKind: 'part',
      parentSku: sku,
      partRole: role,
      cartonIndex: i + 1,
      setsInShipment: 0,
      cbmDeclaredM3: cbm,
      packingListId: IMPULSE_BL_06BRZ2311010_META.packingListId,
    };
  });

  return [kitRow, ...parts];
}

type KitSpec = [string, string, number, number[], number[]];

const KIT_SPECS: KitSpec[] = [
  ['ECU7', 'upright bike light commercial', 17, [78.5], [0.375]],
  ['PS300', 'COMMERCIAL INDOOR GROUP CYCLE', 32, [66.3], [0.316]],
  ['IT9503', 'ARM CURL', 8, [49.7, 72.2, 19.3], [0.273, 0.353, 0.27]],
  ['IT9504', 'PECTORAL', 2, [50.2, 97.9, 24.0], [0.273, 0.666, 0.27]],
  ['IT9512', 'SHOULDER PRESS', 17, [49.3, 93.0, 21.0], [0.273, 0.544, 0.27]],
  ['IT9517', 'SEATED DIP', 5, [49.0, 103.0, 20.8], [0.273, 0.929, 0.27]],
  ['IT9520', 'WEIGHT ASSISTED CHIN/DIP COMBO', 12, [49.5, 130.6, 17.2], [0.273, 0.549, 0.27]],
  ['IT95WS-200', '200 LBS WEIGHT STACK', 8, [22.9, 22.9, 22.9, 18.4], [0.006, 0.006, 0.006, 0.005]],
  ['IT95WS-235', '235 LBS WEIGHT STACK', 26, [34.5, 34.5, 34.5, 1.3], [0.008, 0.008, 0.008, 0.005]],
  ['IT95WS-295', '295 LBS WEIGHT STACK', 17, [34.5, 34.5, 34.5, 27.7], [0.008, 0.008, 0.008, 0.007]],
  ['SL7005', 'Incline press', 2, [77.0, 76.8, 52.5], [0.343, 0.243, 0.206]],
  ['SL7008', 'Rear kick', 1, [63.0, 70.5, 35.2], [0.254, 0.289, 0.213]],
  ['SL7031', 'Shoulder press', 1, [88.5, 76.7], [0.639, 0.305]],
  ['SL7034', 'Hack squat', 1, [144.0, 107.0], [0.673, 1.205]],
  ['SL7036', 'Abdominal', 1, [75.8, 75.0], [0.49, 0.46]],
  ['SL7039', 'Standing press', 1, [91.5, 82.4, 37.9], [0.722, 0.305, 0.391]],
  ['SL7045', 'Vertical knee raise/dip stand', 1, [84.8], [0.588]],
  ['FE9701', 'CHEST PRESS', 5, [63.3, 109.2, 22.3], [0.269, 0.412, 0.285]],
  ['FE9704', 'PECTORAL', 2, [62.8, 110.0, 24.2], [0.269, 0.617, 0.285]],
  ['FEWS-235', '235 LBS WEIGHT STACK', 2, [34.5, 34.5, 34.5, 1.3], [0.008, 0.008, 0.008, 0.005]],
  ['FEWS-295', '295 LBS WEIGHT STACK', 5, [34.5, 34.5, 34.5, 27.7], [0.008, 0.008, 0.008, 0.007]],
  ['IFP1707', 'Leverage Squat/Calf', 10, [125.5], [0.589]],
  ['ECE5', 'elliptical light commercial', 4, [162.2], [0.977]],
  ['IT9510', 'LEG PRESS', 2, [49.5, 126.0, 47.2, 21.3], [0.273, 0.868, 0.151, 0.27]],
  ['IT9515', '(REVERSE) FLY', 3, [58.4, 79.2, 17.5], [0.328, 0.296, 0.27]],
  ['IT9529', 'Multi Press', 2, [49.6, 120.6, 20.5], [0.273, 0.612, 0.27]],
  ['IF9301', 'CHEST PRESS', 13, [43.0, 59.0, 16.0], [0.251, 0.315, 0.132]],
  ['IF9302', 'LAT', 4, [42.0, 62.0, 13.5], [0.251, 0.284, 0.19]],
  ['IF9308', 'Abductor / Adductor', 2, [41.8, 67.7, 16.2], [0.251, 0.299, 0.19]],
  ['IF9324', 'DELTOID RAISED', 3, [41.5, 45.3, 14.4], [0.251, 0.179, 0.19]],
  ['IF9329', 'Multi press', 2, [42.1, 81.5, 16.2], [0.251, 0.383, 0.132]],
  ['IF9330', 'DAP', 8, [131.6, 47.4], [0.449, 0.159]],
  ['IF93WS-200', '200 LBS WEIGHT STACK', 16, [22.9, 22.9, 22.9, 18.4], [0.006, 0.006, 0.006, 0.005]],
  ['IF93WS-235', '235 LBS WEIGHT STACK', 7, [34.5, 34.5, 34.5, 1.3], [0.008, 0.008, 0.008, 0.005]],
  ['IF93WS-295', '295 LBS WEIGHT STACK', 22, [34.5, 34.5, 34.5, 27.7], [0.008, 0.008, 0.008, 0.007]],
  ['IF9315', 'PEC FLY/ REAR DELT', 5, [51.7, 68.5, 13.0], [0.251, 0.316, 0.132]],
];

/** Todas as linhas KIT+PARTE do BL. */
export const IMPULSE_BL_CADASTRO: ImpulsePackingSku[] = KIT_SPECS.flatMap((spec) =>
  explodeKit(...spec),
);

/** Só KITs (para totais de sets / feuYield). */
export const IMPULSE_BL_LINES: ImpulsePackingSku[] = IMPULSE_BL_CADASTRO.filter(
  (s) => s.skuKind === 'kit',
);

export const IMPULSE_SPARE_PARTS: ImpulsePackingSku = {
  sku: 'SPARE-PARTS',
  description: 'Spare parts consolidated (6 CTNS)',
  supplier: 'Impulse Qingdao',
  ...dimsFromCbm(1.669 / 6),
  grossWeightKg: Math.round((545 / 6) * 1000) / 1000,
  interfaceBase: 'no_base',
  volumesPerKit: 1,
  skuKind: 'part',
  partRole: 'spare',
  setsInShipment: 0,
  cbmDeclaredM3: Math.round((1.669 / 6) * 1000) / 1000,
  packingListId: IMPULSE_BL_06BRZ2311010_META.packingListId,
};

export const IMPULSE_DELTA_OPS_PHOTO: ImpulsePackingSku = {
  sku: 'TREADMILL-COMM',
  description: 'Commercial treadmill (ops photo · stack_limit 5 · fora do BL)',
  supplier: 'Impulse Qingdao',
  lengthMm: 2200,
  widthMm: 900,
  heightMm: 450,
  grossWeightKg: 110,
  interfaceBase: 'no_base',
  stackLimit: 5,
  skuKind: 'kit',
  volumesPerKit: 1,
  setsInShipment: 0,
  cbmDeclaredM3: 0.891,
  packingListId: 'OPS-PHOTO',
};

/** Sample motor/M17: cadastro completo KIT+PARTE + spare + Delta. */
export const IMPULSE_SAMPLE: SkuAsn[] = [
  ...IMPULSE_BL_CADASTRO,
  IMPULSE_SPARE_PARTS,
  IMPULSE_DELTA_OPS_PHOTO,
];
