import { describe, it, expect } from 'vitest';
import { INITIAL_PAYROLL_ROLES } from '../data/payrollRoles';
import {
  availablePayrollCatalogEntries,
  findPayrollCatalogEntry,
  payrollCargoCatalog,
  payrollRoleFromCatalogEntry,
} from './payrollCargoCatalog';
import { PAYROLL_COA } from './payrollRoles';

describe('payrollCargoCatalog', () => {
  it('lists annex cargos with CoA 5.2.01.01 and prolabore template', () => {
    const all = payrollCargoCatalog();
    expect(all.length).toBeGreaterThanOrEqual(7);
    expect(all.every((e) => e.accountCode.startsWith('5.2.01.'))).toBe(true);
    expect(all.find((e) => e.accountCode === PAYROLL_COA.prolabore)).toBeTruthy();
    expect(all.find((e) => e.cbo === '4141-40')?.salarioMediana).toBe(2025);
  });

  it('available excludes CBOs already in payrollRoles', () => {
    const avail = availablePayrollCatalogEntries(INITIAL_PAYROLL_ROLES);
    expect(avail.some((e) => e.cbo === '7822-20')).toBe(false);
    expect(avail.some((e) => e.cbo === '7823-10')).toBe(true);
    expect(avail.some((e) => e.accountCode === PAYROLL_COA.prolabore)).toBe(false);
  });

  it('payrollRoleFromCatalogEntry maps account and pisos', () => {
    const motorista = findPayrollCatalogEntry('annex:7823-10')!;
    const role = payrollRoleFromCatalogEntry(motorista, 'pr-test');
    expect(role.accountCode).toBe(PAYROLL_COA.salarios);
    expect(role.cc).toBe('CC 003');
    expect(role.salarioCct).toBe(1845);
    expect(role.hc).toBe(1);
  });
});
