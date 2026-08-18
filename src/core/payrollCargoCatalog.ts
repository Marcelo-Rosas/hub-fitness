import type { PayrollRole } from '../types';
import { LOGISTICS_ANNEX_CARGOS, type LogisticsAnnexCargo } from '../data/payrollLogisticsAnnex';
import { PLANO_DE_CONTAS_ITEMS } from '../data/planoDeContasData';
import { PAYROLL_COA } from './payrollRoles';

export interface PayrollCargoCatalogEntry {
  catalogId: string;
  cargo: string;
  detail: string;
  cbo?: string;
  accountCode: string;
  accountName: string;
  cc: string;
  salarioCct: number | null;
  salarioMediana: number;
  salarioCaged: number;
  contractKind: 'clt' | 'prolabore';
  perilPct: number;
  defaultHc: number;
  mixGalpao: boolean;
}

const COA_PROLABORE_TEMPLATE: Omit<PayrollCargoCatalogEntry, 'catalogId'> = {
  cargo: 'Pró-Labore Sócios Executivos (Base Regular)',
  detail: 'Conta 5.2.01.02 · retirada regular mensal · numerador Fator R',
  accountCode: PAYROLL_COA.prolabore,
  accountName: 'Pró-labore (Sócios - Regular)',
  cc: 'CC 005',
  salarioCct: 5500,
  salarioMediana: 5500,
  salarioCaged: 5500,
  contractKind: 'prolabore',
  perilPct: 0,
  defaultHc: 2,
  mixGalpao: false,
};

function coaAccountName(code: string): string {
  return PLANO_DE_CONTAS_ITEMS.find((a) => a.code === code)?.name ?? code;
}

function ccForAnnexCargo(row: LogisticsAnnexCargo): string {
  if (row.mixGalpao) return 'CC 002';
  if (row.cbo.startsWith('782')) return 'CC 003';
  return 'CC 001';
}

function detailFromAnnex(row: LogisticsAnnexCargo): string {
  const certs = row.certificados.length ? row.certificados.join(' · ') : 'Sem certificado obrigatório';
  return `${row.jornadaSemanal} · CBO ${row.cbo} · ${certs}`;
}

function entryFromAnnex(row: LogisticsAnnexCargo): PayrollCargoCatalogEntry {
  const accountCode = PAYROLL_COA.salarios;
  return {
    catalogId: `annex:${row.cbo}`,
    cargo: row.descricao,
    detail: detailFromAnnex(row),
    cbo: row.cbo,
    accountCode,
    accountName: coaAccountName(accountCode),
    cc: ccForAnnexCargo(row),
    salarioCct: row.salarioCct,
    salarioMediana: row.salarioMediana,
    salarioCaged: row.salarioCaged,
    contractKind: 'clt',
    perilPct: 0,
    defaultHc: 1,
    mixGalpao: row.mixGalpao,
  };
}

/** Plano de contas de cargos = anexo logística SC + templates CoA 5.2.01.* */
export function payrollCargoCatalog(): PayrollCargoCatalogEntry[] {
  const annex = LOGISTICS_ANNEX_CARGOS.map(entryFromAnnex);
  const prolabore: PayrollCargoCatalogEntry = {
    catalogId: `coa:${PAYROLL_COA.prolabore}`,
    ...COA_PROLABORE_TEMPLATE,
    accountName: coaAccountName(PAYROLL_COA.prolabore),
  };
  return [...annex, prolabore];
}

export function payrollCatalogLabel(entry: PayrollCargoCatalogEntry): string {
  return `${entry.cargo} · ${entry.accountCode} · ${entry.cc}`;
}

/** Cargos do catálogo ainda não presentes na tabela (match por CBO ou conta pró-labore). */
export function availablePayrollCatalogEntries(roles: PayrollRole[]): PayrollCargoCatalogEntry[] {
  const usedCbos = new Set(roles.map((r) => r.cbo).filter(Boolean));
  const hasProlabore = roles.some((r) => r.accountCode === PAYROLL_COA.prolabore);
  return payrollCargoCatalog().filter((e) => {
    if (e.contractKind === 'prolabore') return !hasProlabore;
    if (!e.cbo) return true;
    return !usedCbos.has(e.cbo);
  });
}

export function payrollRoleFromCatalogEntry(
  entry: PayrollCargoCatalogEntry,
  roleId: string,
): PayrollRole {
  return {
    id: roleId,
    cargo: entry.cargo,
    detail: entry.detail,
    cc: entry.cc,
    cbo: entry.cbo,
    accountCode: entry.accountCode,
    salarioCct: entry.salarioCct,
    salarioMediana: entry.salarioMediana,
    salarioCaged: entry.salarioCaged,
    contractKind: entry.contractKind,
    perilPct: entry.perilPct,
    hc: entry.defaultHc,
  };
}

export function findPayrollCatalogEntry(catalogId: string): PayrollCargoCatalogEntry | undefined {
  return payrollCargoCatalog().find((e) => e.catalogId === catalogId);
}
