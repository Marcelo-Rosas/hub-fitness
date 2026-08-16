import { describe, it, expect } from 'vitest';
import {
  accountToRow,
  rowToAccount,
  costCenterToRow,
  rowToCostCenter,
  ledgerToRow,
  rowToLedger,
  needsSeed,
  accountInUse,
  costBehaviorValidationError,
} from './financeMappers';
import { PLANO_DE_CONTAS_ITEMS, COST_CENTERS } from '../../data/planoDeContasData';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../../data/initialData';

describe('financeMappers', () => {
  it('AccountItem round-trips including group→grp', () => {
    const a = PLANO_DE_CONTAS_ITEMS[0];
    expect(rowToAccount(accountToRow(a))).toEqual(a);
  });

  it('AccountItem with Fator R flags round-trips', () => {
    const a = PLANO_DE_CONTAS_ITEMS.find((x) => x.isFatorRNumerator)!;
    expect(a).toBeTruthy();
    expect(rowToAccount(accountToRow(a))).toEqual(a);
  });

  it('CostCenter round-trips', () => {
    const c = COST_CENTERS[0];
    expect(rowToCostCenter(costCenterToRow(c))).toEqual(c);
  });

  it('DreGranularItem round-trips composition + costBehavior', () => {
    const item = INITIAL_GRANULAR_DRE_ITEMS.find((i) => i.composition?.length)!;
    expect(item.costBehavior).toBeTruthy();
    expect(rowToLedger(ledgerToRow(item))).toEqual(item);
  });

  it('Fator R flags round-trip on ledger', () => {
    const hc = INITIAL_GRANULAR_DRE_ITEMS.find((i) => i.id === 'cst-pessoal-clt-pl')!;
    expect(hc.isFatorRNumerator).toBe(true);
    expect(rowToLedger(ledgerToRow(hc)).isFatorRNumerator).toBe(true);
    const mo = INITIAL_GRANULAR_DRE_ITEMS.find((i) => i.id === 'cst-mo-terceirizada')!;
    expect(mo.isFatorRExcluded).toBe(true);
    expect(rowToLedger(ledgerToRow(mo)).isFatorRExcluded).toBe(true);
  });

  it('rejects invalid cost_behavior', () => {
    expect(costBehaviorValidationError('semi')).toMatch(/inválido/);
    expect(costBehaviorValidationError('variable')).toBeNull();
  });

  it('needsSeed only when empty', () => {
    expect(needsSeed({ accounts: 0, costCenters: 5, ledger: 5 })).toEqual({
      accounts: true,
      costCenters: false,
      ledger: false,
    });
  });

  it('accountInUse detects ledger refs', () => {
    expect(accountInUse(['4.1.01.01', null], '4.1.01.01')).toBe(true);
    expect(accountInUse(['4.1.01.01'], '9.9.99.99')).toBe(false);
  });
});
