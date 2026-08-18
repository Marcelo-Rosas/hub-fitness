import type { PayrollRole } from '../types';
import { PAYROLL_COA } from '../core/payrollRoles';
import { annexByCbo } from './payrollLogisticsAnnex';

const analista = annexByCbo('2527-15');
const emp = annexByCbo('7822-20');
const conf = annexByCbo('4142-15');

const auxLog = annexByCbo('4141-40');

/** Galpão HUB-FITNESS. Pisos 3 refs; HC único. Empilhadeira sem NR-16 default. */
export const INITIAL_PAYROLL_ROLES: PayrollRole[] = [
  {
    id: 'pr-coord',
    cargo: 'Coordenador Logístico / Supervisor WMS',
    detail: 'Gestão operacional, inventários e interface 4PL · CBO analista (sem piso CCT)',
    cc: 'CC 001',
    cbo: analista.cbo,
    accountCode: PAYROLL_COA.salarios,
    salarioCct: analista.salarioCct,
    salarioMediana: analista.salarioMediana,
    salarioCaged: analista.salarioCaged,
    contractKind: 'clt',
    perilPct: 0,
    hc: 1,
  },
  {
    id: 'pr-admin',
    cargo: 'Assistente Admin / SAC / Faturamento NF-e',
    detail: 'Emissão de conhecimentos, agendamento e atendimento B2B/B2C · CBO 4141-40',
    cc: 'CC 001',
    cbo: auxLog.cbo,
    accountCode: PAYROLL_COA.salarios,
    salarioCct: auxLog.salarioCct,
    salarioMediana: auxLog.salarioMediana,
    salarioCaged: auxLog.salarioCaged,
    contractKind: 'clt',
    perilPct: 0,
    hc: 2,
  },
  {
    id: 'pr-empilhadeira',
    cargo: 'Operador de Empilhadeira Retrátil KONNEN (>500 kg)',
    detail: 'Operação em altura (8,5 m) · NR-11 · peril só se área inflamável',
    cc: 'CC 002',
    cbo: emp.cbo,
    accountCode: PAYROLL_COA.salarios,
    salarioCct: emp.salarioCct,
    salarioMediana: emp.salarioMediana,
    salarioCaged: emp.salarioCaged,
    contractKind: 'clt',
    perilPct: 0,
    hc: 2,
  },
  {
    id: 'pr-conferente',
    cargo: 'Conferente / Auxiliar de Armazém / Etiquetagem',
    detail: 'Recebimento, picking fracionado e kitting e-commerce',
    cc: 'CC 002',
    cbo: conf.cbo,
    accountCode: PAYROLL_COA.salarios,
    salarioCct: conf.salarioCct,
    salarioMediana: conf.salarioMediana,
    salarioCaged: conf.salarioCaged,
    contractKind: 'clt',
    perilPct: 0,
    hc: 3,
  },
  {
    id: 'pr-pl',
    cargo: 'Pró-Labore Sócios Executivos (Base Regular)',
    detail: 'Diretoria de Operações e Direção Comercial / CFO',
    cc: 'CC 005',
    accountCode: PAYROLL_COA.prolabore,
    salarioCct: 5500,
    salarioMediana: 5500,
    salarioCaged: 5500,
    contractKind: 'prolabore',
    perilPct: 0,
    hc: 2,
  },
];
