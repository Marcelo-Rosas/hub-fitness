import type { MixCostMode, PayrollRole } from '../types';

export const PAYROLL_CLT_RATES = {
  fgts: 0.08,
  decimo: 0.0833,
  ferias: 0.1111,
} as const;

/** Pack Simples (FGTS + 13º + férias). INSS/RAT/Sistema S não entram — vão no DAS. */
export const PAYROLL_SIMPLES_PACK_PCT =
  PAYROLL_CLT_RATES.fgts + PAYROLL_CLT_RATES.decimo + PAYROLL_CLT_RATES.ferias;

export const MIX_COST_MODES: MixCostMode[] = ['cct', 'mediana', 'caged'];

export const MIX_COST_MODE_LABELS: Record<MixCostMode, string> = {
  cct: 'Piso CCT (conservador)',
  mediana: 'Mediana SC (equilibrado)',
  caged: 'Média CAGED (competitivo)',
};

/** NFr handoff → CoA vivo HUB (5.2.01.*). */
export const PAYROLL_COA = {
  salarios: '5.2.01.01',
  prolabore: '5.2.01.02',
  prolaboreFatorR: '5.2.01.03',
  ferias: '5.2.01.04',
  decimo: '5.2.01.05',
  fgts: '5.2.01.06',
  beneficios: '5.2.01.08',
  periculosidade: '5.2.01.09',
} as const;

export type PayrollChargeCell = number | null | 'isento';

export interface PayrollChargeBreakdown {
  salarioBase: number;
  periculosidade: PayrollChargeCell;
  fgts: PayrollChargeCell;
  decimo: PayrollChargeCell;
  ferias: PayrollChargeCell;
  totalEncargos: PayrollChargeCell;
  custoHc: number;
}

export function payrollSalario(role: PayrollRole, mode: MixCostMode): number {
  if (mode === 'cct') return role.salarioCct ?? role.salarioMediana;
  if (mode === 'caged') return role.salarioCaged;
  return role.salarioMediana;
}

export function derivePayrollCharges(
  role: PayrollRole,
  mode: MixCostMode = 'mediana',
): PayrollChargeBreakdown {
  const salarioBase = payrollSalario(role, mode);
  if (role.contractKind === 'prolabore') {
    return {
      salarioBase,
      periculosidade: 'isento',
      fgts: null,
      decimo: null,
      ferias: null,
      totalEncargos: null,
      custoHc: salarioBase,
    };
  }
  const peril = Math.round(salarioBase * role.perilPct);
  const chargeBase = salarioBase + peril;
  const fgts = Math.round(chargeBase * PAYROLL_CLT_RATES.fgts);
  const decimo = Math.round(chargeBase * PAYROLL_CLT_RATES.decimo);
  const ferias = Math.round(chargeBase * PAYROLL_CLT_RATES.ferias);
  const totalEncargos = fgts + decimo + ferias;
  return {
    salarioBase,
    periculosidade: peril === 0 ? null : peril,
    fgts,
    decimo,
    ferias,
    totalEncargos,
    custoHc: salarioBase + peril + totalEncargos,
  };
}

export function payrollAmount(role: PayrollRole, mode: MixCostMode): number {
  return Math.round(derivePayrollCharges(role, mode).custoHc * role.hc);
}

/** Pack Simples por HC (FGTS+13º+férias). null = pró-labore isento. */
export function payrollEncargosPerHc(role: PayrollRole, mode: MixCostMode): number | null {
  const enc = derivePayrollCharges(role, mode).totalEncargos;
  if (enc === null) return null;
  return enc;
}

/** Encargos da linha = pack × HC. */
export function payrollEncargosTotal(role: PayrollRole, mode: MixCostMode): number {
  const per = payrollEncargosPerHc(role, mode);
  if (per === null) return 0;
  return Math.round(per * role.hc);
}

export function payrollEncargosGrandTotal(roles: PayrollRole[], mode: MixCostMode): number {
  return roles.reduce((acc, r) => acc + payrollEncargosTotal(r, mode), 0);
}

/** Parse HC / salário from table inputs (≥ 0). */
export function parsePayrollNumeric(raw: string): number {
  const n = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function patchPayrollRoleField(
  roles: PayrollRole[],
  roleId: string,
  field: keyof PayrollRole,
  raw: string,
): PayrollRole[] {
  const role = roles.find((r) => r.id === roleId);
  if (!role) return roles;
  const numericFields = new Set<keyof PayrollRole>([
    'salarioCct',
    'salarioMediana',
    'salarioCaged',
    'perilPct',
    'hc',
  ]);
  const next: PayrollRole = numericFields.has(field)
    ? { ...role, [field]: parsePayrollNumeric(raw) }
    : { ...role, [field]: raw };
  return upsertPayrollRole(roles, next);
}

export function payrollTotal(roles: PayrollRole[], mode: MixCostMode): number {
  return roles.reduce((acc, r) => acc + payrollAmount(r, mode), 0);
}

export function payrollHcTotal(roles: PayrollRole[]): number {
  return roles.reduce((acc, r) => acc + r.hc, 0);
}

export function payrollHcLabel(role: PayrollRole): string {
  const n = role.hc;
  if (n === 0) return '0 HC';
  const label = Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR');
  if (role.contractKind === 'prolabore') return `${label} Sócios`;
  return `${label} HC`;
}

export function payrollCcTone(cc: string): 'slate' | 'blue' | 'amber' {
  if (cc.includes('002')) return 'blue';
  if (cc.includes('005')) return 'amber';
  return 'slate';
}

export function emptyPayrollRole(id: string): PayrollRole {
  return {
    id,
    cargo: 'Novo cargo',
    detail: 'Benchmark SC · proposta RH',
    cc: 'CC 002',
    accountCode: PAYROLL_COA.salarios,
    salarioCct: 0,
    salarioMediana: 0,
    salarioCaged: 0,
    contractKind: 'clt',
    perilPct: 0,
    hc: 1,
  };
}

export function upsertPayrollRole(roles: PayrollRole[], next: PayrollRole): PayrollRole[] {
  const idx = roles.findIndex((r) => r.id === next.id);
  if (idx === -1) return [...roles, next];
  return roles.map((r) => (r.id === next.id ? next : r));
}

export function deletePayrollRole(roles: PayrollRole[], id: string): PayrollRole[] {
  return roles.filter((r) => r.id !== id);
}
