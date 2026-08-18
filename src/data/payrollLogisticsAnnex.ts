/**
 * Anexo logística/transporte SC — proposta RH (F01–F07).
 * NÃO alimenta Mix BE. Mix usa só `payrollRoles` do galpão.
 * Pisos = input até extrato Mediador (SITRAROIT × SEVEÍCULOS / SETCESC).
 */
export const PAYROLL_ANNEX_META = {
  setor: 'Logística e Transporte',
  uf: 'Santa Catarina',
  dataReferencia: '2026-08-18',
  sindicatoItajai: 'SITRAROIT × SEVEÍCULOS',
  regimeAnexo: 'Lucro Presumido — NÃO usar no HUB-FITNESS',
  fontes: {
    F01: 'Portal Salário / CAGED (MTE) — médias CBO/CNAE Brasil e SC · Ago/2026',
    F02: 'CCT SETCESC / categoria carga-logística SC · 2024/2026',
    F03: 'Mediador MTE – MR027992/2024 · pisos regionais · Mai/2024',
    F04: 'NR-16 + Lei 12.619/2012 — periculosidade 30%',
    F05: 'CLT arts. 193/194',
    F06: 'Lei 8.212/91 + Dec. 3.048/99 — pack LP (fora do Mix)',
    F07: 'Resolução CONTRAN 168/2004 — cursos motorista',
  },
} as const;

export interface LogisticsAnnexCargo {
  descricao: string;
  cbo: string;
  jornadaSemanal: string;
  periculosidade: 'Não' | 'Condicional';
  certificados: string[];
  salarioCct: number | null;
  salarioMediana: number;
  salarioCaged: number;
  mixGalpao: boolean;
}

export const LOGISTICS_ANNEX_CARGOS: LogisticsAnnexCargo[] = [
  {
    descricao: 'Auxiliar de Logística',
    cbo: '4141-40',
    jornadaSemanal: '44h',
    periculosidade: 'Não',
    certificados: ['Ensino Médio completo'],
    salarioCct: 1801,
    salarioMediana: 2025,
    salarioCaged: 2050,
    mixGalpao: false,
  },
  {
    descricao: 'Conferente de Carga',
    cbo: '4142-15',
    jornadaSemanal: '44h',
    periculosidade: 'Não',
    certificados: ['Ensino Médio completo'],
    salarioCct: 2283,
    salarioMediana: 2268,
    salarioCaged: 2350,
    mixGalpao: true,
  },
  {
    descricao: 'Motorista de Coleta/Entrega',
    cbo: '7823-10',
    jornadaSemanal: '44h',
    periculosidade: 'Condicional',
    certificados: ['CNH categoria D', 'Curso MOPP (se carga perigosa)', 'Exame toxicológico'],
    salarioCct: 1845,
    salarioMediana: 2244,
    salarioCaged: 2400,
    mixGalpao: false,
  },
  {
    descricao: 'Motorista de Viagem (Carreta/Bi-Trem)',
    cbo: '7825-05',
    jornadaSemanal: '44h',
    periculosidade: 'Condicional',
    certificados: ['CNH categoria E', 'Curso MOPP (se carga perigosa)', 'Exame toxicológico'],
    salarioCct: 2556,
    salarioMediana: 3000,
    salarioCaged: 3200,
    mixGalpao: false,
  },
  {
    descricao: 'Operador de Empilhadeira',
    cbo: '7822-20',
    jornadaSemanal: '44h',
    periculosidade: 'Não',
    certificados: ['NR-11 (Operador de Empilhadeira)', 'Ensino Médio completo'],
    salarioCct: 1801,
    salarioMediana: 2469,
    salarioCaged: 2550,
    mixGalpao: true,
  },
  {
    descricao: 'Analista de Logística',
    cbo: '2527-15',
    jornadaSemanal: '44h',
    periculosidade: 'Não',
    certificados: ['Graduação em Logística, Administração ou Engenharia'],
    salarioCct: null,
    salarioMediana: 3200,
    salarioCaged: 3650,
    mixGalpao: true,
  },
];

export function annexByCbo(cbo: string): LogisticsAnnexCargo {
  const row = LOGISTICS_ANNEX_CARGOS.find((c) => c.cbo === cbo);
  if (!row) throw new Error(`Anexo logística: CBO ${cbo} ausente`);
  return row;
}
