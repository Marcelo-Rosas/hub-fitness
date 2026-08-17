import { describe, it, expect } from 'vitest';
import type { DreGranularItem } from '../types';
import {
  applyOccupancyToDreItems,
  canPostToAccount,
  coaSyntheticParent,
  ledgerAmount24m,
  occupancyAmountForMonth,
  projectDreFromLedger,
  OCCUPANCY_SYNTHETIC_CODE,
  RENT_ANALYTIC_CODE,
} from './engine';
import { defaultParams } from './params';
import { ledgerToRow, rowToLedger } from './operator/financeMappers';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../data/initialData';
import { PLANO_DE_CONTAS_ITEMS } from '../data/planoDeContasData';

function desp(partial: Partial<DreGranularItem> & Pick<DreGranularItem, 'id'>): DreGranularItem {
  return {
    section: 'despesa',
    type: 'fixo',
    category: 'Ocupação',
    name: partial.name ?? partial.id,
    monthlyAmountY1: 0,
    monthlyAmountY2: 0,
    active: true,
    ...partial,
  };
}

describe('contrato CoA ocupação 5.2.02 → DRE', () => {
  it('conta sintética 5.2.02 não recebe lançamento', () => {
    expect(canPostToAccount({ type: 'Sintética' })).toBe(false);
    expect(OCCUPANCY_SYNTHETIC_CODE).toBe('5.2.02');
    expect(RENT_ANALYTIC_CODE).toBe('5.2.02.01');
  });

  it('carência 6m zera 5.2.02.01 mesmo sem id cst-aluguel (edit M3)', () => {
    const months = projectDreFromLedger(
      [
        desp({
          id: 'dre-item-manual-rent',
          name: 'Aluguel M3',
          accountCode: '5.2.02.01',
          monthlyAmountY1: 60_000,
          monthlyAmountY2: 63_000,
        }),
        desp({
          id: 'cst-admin',
          name: 'Admin',
          accountCode: '5.2.03.01',
          monthlyAmountY1: 10_000,
          monthlyAmountY2: 10_000,
        }),
      ],
      0.75,
    );
    expect(months[0].despesasOperacionais).toBeLessThan(20_000);
    expect(months[5].despesasOperacionais).toBeLessThan(20_000);
    expect(months[6].despesasOperacionais).toBe(70_000);
  });

  it('5.2.02.02 condomínio não entra na carência de aluguel', () => {
    const months = projectDreFromLedger(
      [
        desp({
          id: 'cst-condominio',
          accountCode: '5.2.02.02',
          monthlyAmountY1: 6_500,
          monthlyAmountY2: 6_825,
        }),
      ],
      0.75,
    );
    expect(months[0].despesasOperacionais).toBe(6_500);
    expect(months[6].despesasOperacionais).toBe(6_500);
  });

  it('24m de 5.2.02.01 = 6×Y1 + 12×Y2 (não 12+12)', () => {
    const rent = desp({
      id: 'cst-aluguel',
      accountCode: '5.2.02.01',
      monthlyAmountY1: 60_000,
      monthlyAmountY2: 63_000,
    });
    expect(ledgerAmount24m(rent, defaultParams)).toBe(6 * 60_000 + 12 * 63_000);
    expect(ledgerAmount24m(rent, defaultParams)).not.toBe(12 * 60_000 + 12 * 63_000);
  });

  it('PUT ledger round-trip preserva 5.2.02.01 e carência no engine', () => {
    const edited = desp({
      id: 'cst-aluguel',
      accountCode: '5.2.02.01',
      monthlyAmountY1: 80_000,
      monthlyAmountY2: 84_000,
      manualOverride: true,
    });
    const restored = rowToLedger(ledgerToRow(edited));
    expect(restored.accountCode).toBe('5.2.02.01');
    expect(restored.manualOverride).toBe(true);
    const months = projectDreFromLedger([restored], 0.75);
    expect(months[0].despesasOperacionais).toBe(0);
    expect(months[6].despesasOperacionais).toBe(80_000);
    expect(months[12].despesasOperacionais).toBe(84_000);
  });

  it('IPTU 5.2.02.03 e energia 5.2.02.04 cheios em M1 (sem carência, sem rampa)', () => {
    const months = projectDreFromLedger(
      [
        desp({
          id: 'dre-iptu',
          accountCode: '5.2.02.03',
          monthlyAmountY1: 2_000,
          monthlyAmountY2: 2_000,
        }),
        desp({
          id: 'dre-energia',
          accountCode: '5.2.02.04',
          monthlyAmountY1: 3_000,
          monthlyAmountY2: 3_000,
        }),
      ],
      0.75,
    );
    expect(months[0].despesasOperacionais).toBe(5_000);
    expect(months[6].despesasOperacionais).toBe(5_000);
  });

  it('M3 override de aluguel sobrevive applyOccupancy e entra no DRE', () => {
    const edited = desp({
      id: 'dre-item-manual-rent',
      accountCode: '5.2.02.01',
      monthlyAmountY1: 90_000,
      monthlyAmountY2: 94_500,
      manualOverride: true,
    });
    const condo = desp({
      id: 'cst-condominio',
      accountCode: '5.2.02.02',
      monthlyAmountY1: 6_500,
      monthlyAmountY2: 6_825,
    });
    const afterOcc = applyOccupancyToDreItems([edited, condo], defaultParams);
    expect(afterOcc.find((i) => i.id === 'dre-item-manual-rent')!.monthlyAmountY1).toBe(90_000);
    const condoLive = afterOcc.find((i) => i.id === 'cst-condominio')!.monthlyAmountY1;
    const months = projectDreFromLedger(afterOcc, 0.75);
    expect(occupancyAmountForMonth(afterOcc, 1, defaultParams)).toBe(condoLive);
    expect(occupancyAmountForMonth(afterOcc, 7, defaultParams)).toBe(90_000 + condoLive);
    expect(months[0].despesasOperacionais).toBe(condoLive);
    expect(months[6].despesasOperacionais).toBe(90_000 + condoLive);
  });

  it('seed ledger: toda conta é Analítica no CoA e sobrevive mapper PUT', () => {
    for (const item of INITIAL_GRANULAR_DRE_ITEMS) {
      expect(item.accountCode, item.id).toBeTruthy();
      const acc = PLANO_DE_CONTAS_ITEMS.find((a) => a.code === item.accountCode);
      expect(acc, `${item.id} ${item.accountCode}`).toBeTruthy();
      expect(acc!.type, `${item.accountCode}`).toBe('Analítica');
      expect(canPostToAccount(acc)).toBe(true);
      const restored = rowToLedger(ledgerToRow(item));
      expect(restored.accountCode).toBe(item.accountCode);
      expect(restored.monthlyAmountY1).toBe(item.monthlyAmountY1);
      expect(restored.monthlyAmountY2).toBe(item.monthlyAmountY2);
      expect(restored.section).toBe(item.section);
      expect(restored.costBehavior ?? null).toBe(item.costBehavior ?? null);
    }
  });

  it('coaSyntheticParent de analítica de ocupação é 5.2.02', () => {
    expect(coaSyntheticParent('5.2.02.01')).toBe('5.2.02');
    expect(coaSyntheticParent('5.2.02')).toBe('5.2.02');
  });
});
