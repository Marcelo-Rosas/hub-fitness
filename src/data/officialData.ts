// Official single source of truth for HUB-SIM v3.5 from Knowledge Base CSVs and BP v3.5
// 01_DRE_24_meses.csv, 02_Fluxo_Caixa.csv, BP_3PL_Fitness_v3.5.md

export interface OfficialDreMonth {
  month: string; // M1..M24
  monthNum: number; // 1..24
  receitaServicos: number;
  custosVariaveis: number;
  lucroBruto: number;
  despesasOperacionais: number;
  proLaboreFatorR: number;
  impostosDAS: number;
  lucroLiquido: number;
  margemLiquidaPercent: number;
}

export interface OfficialCashMonth {
  month: string; // M0..M24
  monthNum: number; // 0..24
  fluxoLiquidoPuro: number;
  fluxoLiquidoCarenciaAluguel: number;
  saldoAcumuladoPuro: number;
  saldoAcumuladoCarenciaAluguel: number;
}

// 01_DRE_24_meses.csv exact values
export const OFFICIAL_DRE_MONTHS: OfficialDreMonth[] = [
  { month: 'M1', monthNum: 1, receitaServicos: 85000, custosVariaveis: 29750, lucroBruto: 55250, despesasOperacionais: 41200, proLaboreFatorR: 24140, impostosDAS: 5100, lucroLiquido: -15190, margemLiquidaPercent: -17.87 },
  { month: 'M2', monthNum: 2, receitaServicos: 110000, custosVariaveis: 38500, lucroBruto: 71500, despesasOperacionais: 43500, proLaboreFatorR: 31240, impostosDAS: 6600, lucroLiquido: -9840, margemLiquidaPercent: -8.95 },
  { month: 'M3', monthNum: 3, receitaServicos: 145000, custosVariaveis: 50750, lucroBruto: 94250, despesasOperacionais: 48200, proLaboreFatorR: 41180, impostosDAS: 8700, lucroLiquido: -3830, margemLiquidaPercent: -2.64 },
  { month: 'M4', monthNum: 4, receitaServicos: 180000, custosVariaveis: 63000, lucroBruto: 117000, despesasOperacionais: 52100, proLaboreFatorR: 51120, impostosDAS: 10800, lucroLiquido: 2980, margemLiquidaPercent: 1.66 },
  { month: 'M5', monthNum: 5, receitaServicos: 215000, custosVariaveis: 75250, lucroBruto: 139750, despesasOperacionais: 56800, proLaboreFatorR: 61060, impostosDAS: 12900, lucroLiquido: 8990, margemLiquidaPercent: 4.18 },
  { month: 'M6', monthNum: 6, receitaServicos: 250000, custosVariaveis: 87500, lucroBruto: 162500, despesasOperacionais: 61500, proLaboreFatorR: 71000, impostosDAS: 15000, lucroLiquido: 15000, margemLiquidaPercent: 6.00 },
  { month: 'M7', monthNum: 7, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
  { month: 'M8', monthNum: 8, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
  { month: 'M9', monthNum: 9, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
  { month: 'M10', monthNum: 10, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
  { month: 'M11', monthNum: 11, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
  { month: 'M12', monthNum: 12, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
  { month: 'M13', monthNum: 13, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
  { month: 'M14', monthNum: 14, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
  { month: 'M15', monthNum: 15, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
  { month: 'M16', monthNum: 16, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
  { month: 'M17', monthNum: 17, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
  { month: 'M18', monthNum: 18, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
  { month: 'M19', monthNum: 19, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
  { month: 'M20', monthNum: 20, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
  { month: 'M21', monthNum: 21, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
  { month: 'M22', monthNum: 22, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
  { month: 'M23', monthNum: 23, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
  { month: 'M24', monthNum: 24, receitaServicos: 214238, custosVariaveis: 35505, lucroBruto: 178733, despesasOperacionais: 143104, proLaboreFatorR: 7000, impostosDAS: 12854, lucroLiquido: 22775, margemLiquidaPercent: 10.63 },
];

// Official Consolidated Totals (M1..M24)
export const OFFICIAL_TOTALS_24M = {
  receitaTotal: 4805700,
  custosETotasOp: 4234858,
  lucroLiquidoTotal: 570842,
  lucroLiquidoAno1: 320090,
  lucroLiquidoAno2: 250752,
  llM7Plus: 14279,
  margemLiquidaPercent: 11.878, // (570842 / 4805700) * 100 = 11.9%
  capexInicial: 207300,
  capitalContribuido: 267000,
  saldoCaixaM0: 59700,
  saldoCaixaM24CarenciaAluguel: 765446,
  saldoCaixaM24Puro: 663342,
  capacidadePaletes: 2968, // Diretriz g5 do BP
  paybackCarenciaAluguel: 'M5 (-R$ 5.846 vale / retorno)',
  paybackPuro: 'M6 (+R$ 52.116)',
};

// 02_Fluxo_Caixa.csv exact series M0..M24
export const OFFICIAL_CASHFLOW_SERIES: OfficialCashMonth[] = [
  { month: 'M0', monthNum: 0, fluxoLiquidoPuro: -207300, fluxoLiquidoCarenciaAluguel: -207300, saldoAcumuladoPuro: -207300, saldoAcumuladoCarenciaAluguel: -207300 },
  { month: 'M1', monthNum: 1, fluxoLiquidoPuro: -33690, fluxoLiquidoCarenciaAluguel: -15190, saldoAcumuladoPuro: -240990, saldoAcumuladoCarenciaAluguel: -222490 },
  { month: 'M2', monthNum: 2, fluxoLiquidoPuro: -28340, fluxoLiquidoCarenciaAluguel: -9840, saldoAcumuladoPuro: -269330, saldoAcumuladoCarenciaAluguel: -232330 },
  { month: 'M3', monthNum: 3, fluxoLiquidoPuro: -22330, fluxoLiquidoCarenciaAluguel: -3830, saldoAcumuladoPuro: -291660, saldoAcumuladoCarenciaAluguel: -236160 },
  { month: 'M4', monthNum: 4, fluxoLiquidoPuro: -15520, fluxoLiquidoCarenciaAluguel: 2980, saldoAcumuladoPuro: -307180, saldoAcumuladoCarenciaAluguel: -233180 },
  { month: 'M5', monthNum: 5, fluxoLiquidoPuro: -9510, fluxoLiquidoCarenciaAluguel: 8990, saldoAcumuladoPuro: -316690, saldoAcumuladoCarenciaAluguel: -224190 },
  { month: 'M6', monthNum: 6, fluxoLiquidoPuro: 368806, fluxoLiquidoCarenciaAluguel: 276226, saldoAcumuladoPuro: 52116, saldoAcumuladoCarenciaAluguel: 52036 },
  { month: 'M7', monthNum: 7, fluxoLiquidoPuro: 22775, fluxoLiquidoCarenciaAluguel: 22775, saldoAcumuladoPuro: 74891, saldoAcumuladoCarenciaAluguel: 74811 },
  { month: 'M8', monthNum: 8, fluxoLiquidoPuro: 22775, fluxoLiquidoCarenciaAluguel: 22775, saldoAcumuladoPuro: 97666, saldoAcumuladoCarenciaAluguel: 97586 },
  { month: 'M9', monthNum: 9, fluxoLiquidoPuro: 22775, fluxoLiquidoCarenciaAluguel: 22775, saldoAcumuladoPuro: 120441, saldoAcumuladoCarenciaAluguel: 120361 },
  { month: 'M10', monthNum: 10, fluxoLiquidoPuro: 22775, fluxoLiquidoCarenciaAluguel: 22775, saldoAcumuladoPuro: 143216, saldoAcumuladoCarenciaAluguel: 143136 },
  { month: 'M11', monthNum: 11, fluxoLiquidoPuro: 22775, fluxoLiquidoCarenciaAluguel: 22775, saldoAcumuladoPuro: 165991, saldoAcumuladoCarenciaAluguel: 165911 },
  { month: 'M12', monthNum: 12, fluxoLiquidoPuro: 22775, fluxoLiquidoCarenciaAluguel: 22775, saldoAcumuladoPuro: 188766, saldoAcumuladoCarenciaAluguel: 188686 },
  { month: 'M13', monthNum: 13, fluxoLiquidoPuro: 22775, fluxoLiquidoCarenciaAluguel: 22775, saldoAcumuladoPuro: 211541, saldoAcumuladoCarenciaAluguel: 211461 },
  { month: 'M14', monthNum: 14, fluxoLiquidoPuro: 22775, fluxoLiquidoCarenciaAluguel: 22775, saldoAcumuladoPuro: 234316, saldoAcumuladoCarenciaAluguel: 234236 },
  { month: 'M15', monthNum: 15, fluxoLiquidoPuro: 22775, fluxoLiquidoCarenciaAluguel: 22775, saldoAcumuladoPuro: 257091, saldoAcumuladoCarenciaAluguel: 257011 },
  { month: 'M16', monthNum: 16, fluxoLiquidoPuro: 22775, fluxoLiquidoCarenciaAluguel: 22775, saldoAcumuladoPuro: 279866, saldoAcumuladoCarenciaAluguel: 279786 },
  { month: 'M17', monthNum: 17, fluxoLiquidoPuro: 22775, fluxoLiquidoCarenciaAluguel: 22775, saldoAcumuladoPuro: 302641, saldoAcumuladoCarenciaAluguel: 302561 },
  { month: 'M18', monthNum: 18, fluxoLiquidoPuro: 22775, fluxoLiquidoCarenciaAluguel: 22775, saldoAcumuladoPuro: 325416, saldoAcumuladoCarenciaAluguel: 325336 },
  { month: 'M19', monthNum: 19, fluxoLiquidoPuro: 22775, fluxoLiquidoCarenciaAluguel: 22775, saldoAcumuladoPuro: 348191, saldoAcumuladoCarenciaAluguel: 348111 },
  { month: 'M20', monthNum: 20, fluxoLiquidoPuro: 22775, fluxoLiquidoCarenciaAluguel: 22775, saldoAcumuladoPuro: 370966, saldoAcumuladoCarenciaAluguel: 370886 },
  { month: 'M21', monthNum: 21, fluxoLiquidoPuro: 22775, fluxoLiquidoCarenciaAluguel: 22775, saldoAcumuladoPuro: 393741, saldoAcumuladoCarenciaAluguel: 393661 },
  { month: 'M22', monthNum: 22, fluxoLiquidoPuro: 22775, fluxoLiquidoCarenciaAluguel: 22775, saldoAcumuladoPuro: 416516, saldoAcumuladoCarenciaAluguel: 416436 },
  { month: 'M23', monthNum: 23, fluxoLiquidoPuro: 22775, fluxoLiquidoCarenciaAluguel: 22775, saldoAcumuladoPuro: 439291, saldoAcumuladoCarenciaAluguel: 439211 },
  { month: 'M24', monthNum: 24, fluxoLiquidoPuro: 224051, fluxoLiquidoCarenciaAluguel: 326155, saldoAcumuladoPuro: 663342, saldoAcumuladoCarenciaAluguel: 765446 },
];

// SANCO Inviolable Floors for VAS (BP v3.5 Section 3)
export interface SancoVasFloor {
  id: string;
  category: string;
  service: string;
  floorPrice: number;
  unit: string;
  governanceType: 'P5_FLOOR' | 'P1_CEILING' | 'CORE_VAS' | 'CONTAINER';
  governanceBadge: string;
  badgeStyle: 'purple' | 'red' | 'emerald' | 'blue';
  description: string;
}

export const SANCO_VAS_FLOORS: SancoVasFloor[] = [
  {
    id: 'floor-arm',
    category: 'Armazenagem 3PL',
    service: 'Armazenagem Posição Palete Fitness',
    floorPrice: 22.50,
    unit: 'R$/quinzenal/palete',
    governanceType: 'P1_CEILING',
    governanceBadge: '⚠️ Teto Máximo ≤ 20% Mix (P1 Estocagem)',
    badgeStyle: 'red',
    description: 'Piso mínimo inviolável SANCO para evitar uso de espaço estático de baixa margem.'
  },
  {
    id: 'floor-mov',
    category: 'Movimentação & Handling',
    service: 'Handling Inbound / Outbound Padrão',
    floorPrice: 25.00,
    unit: 'R$/volume/movimentação',
    governanceType: 'CORE_VAS',
    governanceBadge: '🔒 Core VAS Obligatório',
    badgeStyle: 'emerald',
    description: 'Taxa padrão de paletização, movimentação trilateral VNA e transferência.'
  },
  {
    id: 'floor-des',
    category: 'Desunitização FCL',
    service: 'Desunitização & Cross-docking Container',
    floorPrice: 1400.00,
    unit: 'R$/contêiner FCL 40ft',
    governanceType: 'CONTAINER',
    governanceBadge: '🚢 Regra de Descarga FCL',
    badgeStyle: 'blue',
    description: 'Operação de estufagem/desestufagem manual e conferência cega WMS com leitor de código de barras.'
  },
  {
    id: 'floor-eti',
    category: 'Beneficiamento & Kitting',
    service: 'Etiquetagem & Kitting B2C / B2B',
    floorPrice: 0.75,
    unit: 'R$/unidade rotulada',
    governanceType: 'P5_FLOOR',
    governanceBadge: '🔒 Piso Mínimo ≥ 25% Mix (P5 Kitting)',
    badgeStyle: 'purple',
    description: 'Aplicações de selo Anvisa, código EAN13, montagem de kits promocionais para e-commerce.'
  }
];

// Helper parser function to guarantee components consume exact official figures
export function parseOfficialCSVs() {
  return {
    dreMonths: OFFICIAL_DRE_MONTHS,
    cashflowSeries: OFFICIAL_CASHFLOW_SERIES,
    totals24M: OFFICIAL_TOTALS_24M,
    vasFloors: SANCO_VAS_FLOORS,
  };
}
