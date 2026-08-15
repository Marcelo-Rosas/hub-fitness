import { describe, it, expect } from 'vitest';
import { deriveCashMilestones } from './cashMilestones';
import { OFFICIAL_CASHFLOW_SERIES } from './bpV35Reference';

describe('deriveCashMilestones', () => {
  it('marca vale no menor saldo e payback no primeiro saldo ≥ 0', () => {
    const series = OFFICIAL_CASHFLOW_SERIES.map((c) => ({
      month: c.month,
      monthNum: c.monthNum,
      saldo: c.saldoAcumuladoPuro,
      fluxo: c.fluxoLiquidoPuro,
    }));
    const m = deriveCashMilestones(series, { rentOnMonthNum: 7 });
    expect(m.valley.month).toBe('M5');
    expect(m.valley.saldo).toBe(-316690);
    expect(m.payback?.month).toBe('M6');
    expect(m.payback?.saldo).toBe(52116);
    expect(m.capex?.month).toBe('M0');
    expect(m.rentOnMonthNum).toBe(7);
  });

  it('não assume M31 — vale = argmin da série', () => {
    const series = [
      { month: 'M29', monthNum: 29, saldo: 770_000 },
      { month: 'M30', monthNum: 30, saldo: 837_000 },
      { month: 'M31', monthNum: 31, saldo: 504_000 },
      { month: 'M32', monthNum: 32, saldo: 571_000 },
    ];
    expect(deriveCashMilestones(series).valley.month).toBe('M31');
  });
});
