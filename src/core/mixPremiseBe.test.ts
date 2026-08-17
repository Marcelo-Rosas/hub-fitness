import { describe, it, expect } from 'vitest';
import { mixRowBePcts } from './mixPremiseBe';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../data/initialData';
import { INITIAL_PAYROLL_ROLES } from '../data/payrollRoles';
import { defaultParams } from './params';

describe('mixRowBePcts', () => {
  const cap = defaultParams.capacity.totalPositions;
  const args = {
    mcPos: 52.5,
    items: INITIAL_GRANULAR_DRE_ITEMS,
    payrollRoles: INITIAL_PAYROLL_ROLES,
    capacity: cap,
  };

  it('returns three live modes and they differ when pisos differ', () => {
    const be = mixRowBePcts(args);
    expect(be.cct).toBeGreaterThan(0);
    expect(be.mediana).toBeGreaterThan(0);
    expect(be.caged).toBeGreaterThan(0);
  });

  it('does not equal freeze Original/Enxuto/Realista for P1', () => {
    const be = mixRowBePcts(args);
    expect(be.cct).not.toBe(105.2);
    expect(be.mediana).not.toBe(77);
    expect(be.caged).not.toBe(91.8);
  });
});
