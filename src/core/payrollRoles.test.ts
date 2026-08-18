import { describe, it, expect } from 'vitest';
import { INITIAL_PAYROLL_ROLES } from '../data/payrollRoles';
import { LOGISTICS_ANNEX_CARGOS } from '../data/payrollLogisticsAnnex';
import {
  MIX_COST_MODE_LABELS,
  PAYROLL_COA,
  PAYROLL_SIMPLES_PACK_PCT,
  deletePayrollRole,
  derivePayrollCharges,
  emptyPayrollRole,
  patchPayrollRoleField,
  payrollAmount,
  payrollEncargosPerHc,
  payrollEncargosTotal,
  payrollHcTotal,
  payrollSalario,
  payrollTotal,
  upsertPayrollRole,
} from './payrollRoles';
import { mixNonHcOpexFromLedger, computeMinViableBe, BLEND_ALVO_MIX } from './mixPreview';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../data/initialData';

describe('payrollRoles SC — 3 pisos, 1 HC', () => {
  it('UI labels are CCT / mediana / CAGED meanings, not Enxuto/Original', () => {
    expect(MIX_COST_MODE_LABELS.cct).toBe('Piso CCT (conservador)');
    expect(MIX_COST_MODE_LABELS.mediana).toBe('Mediana SC (equilibrado)');
    expect(MIX_COST_MODE_LABELS.caged).toBe('Média CAGED (competitivo)');
  });

  it('Simples pack is 27.44%; CoA maps NFr to 5.2.01.*', () => {
    expect(Number(PAYROLL_SIMPLES_PACK_PCT.toFixed(4))).toBe(0.2744);
    expect(PAYROLL_COA.salarios).toBe('5.2.01.01');
    expect(PAYROLL_COA.periculosidade).toBe('5.2.01.09');
    expect(PAYROLL_COA.prolaboreFatorR).toBe('5.2.01.03');
  });

  it('same HC across modes; empilhadeira peril default 0', () => {
    expect(payrollHcTotal(INITIAL_PAYROLL_ROLES)).toBe(10);
    const emp = INITIAL_PAYROLL_ROLES.find((r) => r.id === 'pr-empilhadeira');
    expect(emp?.perilPct).toBe(0);
    expect(derivePayrollCharges(emp!, 'mediana').periculosidade).toBeNull();
  });

  it('galpão conferente/empilhadeira pisos come from logistics annex', () => {
    const conf = INITIAL_PAYROLL_ROLES.find((r) => r.id === 'pr-conferente')!;
    const emp = INITIAL_PAYROLL_ROLES.find((r) => r.id === 'pr-empilhadeira')!;
    expect(payrollSalario(conf, 'cct')).toBe(2283);
    expect(payrollSalario(conf, 'mediana')).toBe(2268);
    expect(payrollSalario(emp, 'cct')).toBe(1801);
    expect(LOGISTICS_ANNEX_CARGOS.some((c) => c.cbo === '7823-10' && !c.mixGalpao)).toBe(true);
  });

  it('HC scales folha; admin pisos differ by mode (4141-40 annex)', () => {
    const admin = INITIAL_PAYROLL_ROLES.find((r) => r.id === 'pr-admin')!;
    expect(admin.salarioCct).toBe(1801);
    expect(admin.salarioMediana).toBe(2025);
    expect(admin.salarioCaged).toBe(2050);
    expect(payrollEncargosPerHc(admin, 'cct')).toBe(494);
    expect(payrollEncargosTotal(admin, 'cct')).toBe(988);
    const hc2 = payrollAmount(admin, 'cct');
    const hc3 = payrollAmount({ ...admin, hc: 3 }, 'cct');
    expect(hc3).toBeGreaterThan(hc2);
    expect(hc3).toBe(Math.round((hc2 / admin.hc) * 3));
    expect(hc2).toBe(admin.salarioCct! * admin.hc + payrollEncargosTotal(admin, 'cct'));
  });

  it('patchPayrollRoleField updates HC on latest row state', () => {
    const admin = INITIAL_PAYROLL_ROLES.find((r) => r.id === 'pr-admin')!;
    const once = patchPayrollRoleField(INITIAL_PAYROLL_ROLES, admin.id, 'hc', '3');
    const row = once.find((r) => r.id === admin.id)!;
    expect(row.hc).toBe(3);
    expect(payrollAmount(row, 'mediana')).not.toBe(payrollAmount(admin, 'mediana'));
  });

  it('upsert/delete changes CCT total', () => {
    const extra = emptyPayrollRole('pr-new');
    extra.salarioCct = 1000;
    extra.salarioMediana = 1000;
    extra.salarioCaged = 1000;
    extra.hc = 1;
    const before = payrollTotal(INITIAL_PAYROLL_ROLES, 'cct');
    const added = upsertPayrollRole(INITIAL_PAYROLL_ROLES, extra);
    expect(payrollTotal(added, 'cct')).toBe(before + payrollTotal([extra], 'cct'));
    expect(payrollTotal(deletePayrollRole(added, 'pr-new'), 'cct')).toBe(before);
  });

  it('Mix BE uses payroll CCT + OPEX sem folha, not 0.85 scalar', () => {
    const opex = mixNonHcOpexFromLedger(INITIAL_GRANULAR_DRE_ITEMS);
    const cct = computeMinViableBe({
      items: INITIAL_GRANULAR_DRE_ITEMS,
      mix: BLEND_ALVO_MIX,
      capacity: 2968,
      costMode: 'cct',
      payrollRoles: INITIAL_PAYROLL_ROLES,
    });
    expect(cct.costMonthly).toBe(opex + payrollTotal(INITIAL_PAYROLL_ROLES, 'cct'));
    expect(cct.costMonthly).not.toBe(Math.round(124104 * 0.85));
  });
});
