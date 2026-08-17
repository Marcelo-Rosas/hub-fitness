import { describe, it, expect } from 'vitest';
import type { DreMonth } from '../types';
import { summarizeLiveDre } from './engine';
import { OFFICIAL_TOTALS_24M } from './bpV35Reference';

function month(partial: Partial<DreMonth> & Pick<DreMonth, 'month'>): DreMonth {
  return {
    label: `M${partial.month}`,
    receitaServicos: 0,
    das6Percent: 0,
    irpj: 0,
    csll: 0,
    pisCofinsCppIss: 0,
    custosOperacionais: 0,
    despesasOperacionais: 0,
    lucroLiquido: 0,
    ...partial,
  };
}

describe('summarizeLiveDre — contrato DRE live (ledger → months)', () => {
  it('KPI 24m = soma das linhas, não fixture CSV', () => {
    const months = [
      month({ month: 1, receitaServicos: 131_119, custosOperacionais: 47_929, despesasOperacionais: 58_366, das6Percent: 7_867, lucroLiquido: 16_957 }),
      month({ month: 2, receitaServicos: 144_231, custosOperacionais: 51_124, despesasOperacionais: 60_034, das6Percent: 8_654, lucroLiquido: 24_420 }),
    ];
    const t = summarizeLiveDre(months);
    expect(t.receitaTotal).toBe(131_119 + 144_231);
    expect(t.lucroLiquidoTotal).toBe(16_957 + 24_420);
    expect(t.receitaTotal).not.toBe(OFFICIAL_TOTALS_24M.receitaTotal);
    expect(t.lucroLiquidoTotal).not.toBe(OFFICIAL_TOTALS_24M.lucroLiquidoTotal);
  });

  it('margem = LL / receita live, nunca 11,9% petrificado', () => {
    const months = [
      month({ month: 1, receitaServicos: 5_014_524, lucroLiquido: 227_342 }),
    ];
    const t = summarizeLiveDre(months);
    expect(t.margemLiquidaPercent).toBeCloseTo((227_342 / 5_014_524) * 100, 5);
    expect(t.margemLiquidaPercent).not.toBeCloseTo(11.9, 1);
  });
});
