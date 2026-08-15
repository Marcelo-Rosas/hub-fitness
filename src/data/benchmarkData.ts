/**
 * Benchmark externo editável — Forte Logística (2026) + SANCO TCO.
 * Fixture: SIMULAÇÃO DE ENTREPOSTO - VECTRA CARGO - 2026.xlsx (operador Forte Logística).
 */

export interface BenchmarkLineItem {
  block: string;
  rubric: string;
  reference: string;
  value: number;
}

export interface ForteBenchmarkTab {
  id: 'entreposto30d' | 'dtc20d';
  label: string;
  estadiaDays: number;
  cifFeu: number;
  lines: BenchmarkLineItem[];
  total: number;
  pctCif: number;
}

export interface ForteAuditDelta {
  label: string;
  deltaPerFeu: number;
}

export interface SancoTcoLine {
  item: string;
  sancoInhouse: number;
  tplFitness: number;
}

export const FORTE_BENCHMARK_META = {
  source: 'Forte Logística',
  year: 2026,
  container: "CNTR 40'",
  cifFeu: 332_800,
  usdRate: 5.46,
  palletsPerFeu: 22,
} as const;

export const FORTE_ENTREPOSTO_30D: ForteBenchmarkTab = {
  id: 'entreposto30d',
  label: 'Entreposto c/ desova · estadia 30 dias',
  estadiaDays: 30,
  cifFeu: 332_800,
  lines: [
    { block: 'Armazenagem', rubric: '1º período (10d)', reference: '0,104% CIF', value: 346.11 },
    { block: 'Armazenagem', rubric: '2º período (20d, ao dia)', reference: '0,060%/dia', value: 3_993.6 },
    { block: 'Armazenagem', rubric: 'Seguro (3 períodos)', reference: '0,104%/período', value: 1_038.34 },
    { block: 'Serviços', rubric: 'DTC NVT/ITJ → FORTE', reference: 'por CNTR', value: 808.02 },
    { block: 'Serviços', rubric: 'Seguro transporte', reference: '0,062%', value: 206.34 },
    { block: 'Serviços', rubric: 'Desova + posicionamento', reference: 'por CNTR', value: 933.13 },
    { block: 'Serviços', rubric: 'Handling In/Out', reference: '2 × 140', value: 280 },
    { block: 'Serviços', rubric: 'Devolução CNTR', reference: 'por CNTR', value: 521.3 },
    { block: 'Serviços', rubric: 'Carregamento mecanizado', reference: 'por veículo', value: 495.24 },
    { block: 'Serviços', rubric: 'Picking + separação ref.', reference: '10 pallets/100 cx', value: 454.88 },
    { block: 'Serviços', rubric: 'Taxa adm. (lote) + emergencial', reference: '—', value: 647.79 },
  ],
  total: 9_728.63,
  pctCif: 0.02923,
};

export const FORTE_DTC_20D: ForteBenchmarkTab = {
  id: 'dtc20d',
  label: 'DTC c/ desova · estadia 20 dias',
  estadiaDays: 20,
  cifFeu: 332_800,
  lines: [
    { block: 'Armazenagem', rubric: '1º período (10d)', reference: '0,104%', value: 346.11 },
    { block: 'Armazenagem', rubric: '2º período (10d, ao dia)', reference: '0,041%/dia', value: 1_364.48 },
    { block: 'Armazenagem', rubric: 'Seguro (2 períodos)', reference: '0,104%', value: 692.22 },
    { block: 'Serviços', rubric: 'DTC + seguro transporte', reference: '—', value: 1_014.36 },
    { block: 'Serviços', rubric: 'Desova + posicionamento', reference: '—', value: 933.13 },
    { block: 'Serviços', rubric: 'Handling In/Out', reference: '2 × 140', value: 280 },
    { block: 'Serviços', rubric: 'Devolução CNTR', reference: '—', value: 531.3 },
    { block: 'Serviços', rubric: 'Carregamento + taxa adm. + emerg.', reference: '—', value: 715.57 },
  ],
  total: 5_881.06,
  pctCif: 0.01767,
};

export const FORTE_AUDIT_DELTAS: ForteAuditDelta[] = [
  { label: '2º período: 0,060%/dia vs 0,041%/dia (20d)', deltaPerFeu: 1_264.64 },
  { label: 'Taxa adm.: R$ 557,79/lote vs R$ 130,33/CNTR', deltaPerFeu: 427.46 },
  { label: 'Devolução CNTR: 521,30 vs 531,30', deltaPerFeu: 10 },
  { label: 'Seguro cobrado por período cheio p/ estadia parcial', deltaPerFeu: 346.11 },
];

export const SANCO_TCO_BREAKDOWN: SancoTcoLine[] = [
  { item: 'Locação Galpão & IPTU', sancoInhouse: 35_000, tplFitness: 18_500 },
  { item: 'Mão de Obra & WMS SaaS', sancoInhouse: 28_500, tplFitness: 12_400 },
  { item: 'Insumos, Energia & Seguro', sancoInhouse: 9_800, tplFitness: 5_100 },
  { item: 'Gestão, SLA & Contingências', sancoInhouse: 10_568.8, tplFitness: 7_271.9 },
];

export const SANCO_VAS_BENCHMARK = [
  { service: 'Armazenagem quinzenal', unit: 'R$/palete/quinzena', floor: 22.5 },
  { service: 'Handling In/Out', unit: 'R$/volume', floor: 25 },
  { service: 'Desunitização FCL 40', unit: 'R$/contêiner', floor: 1_400 },
  { service: 'Etiquetagem EAN', unit: 'R$/unidade', floor: 0.75 },
  { service: 'Ad Valorem', unit: '% NF', floor: 0.1 },
];

export const FORTE_TABS = [FORTE_ENTREPOSTO_30D, FORTE_DTC_20D] as const;
