/** Marcos de caixa derivados de uma série — UI só renderiza. */

export interface CashSeriesPoint {
  month: string;
  monthNum: number;
  saldo: number;
  fluxo?: number;
}

export interface CashMilestones {
  valley: CashSeriesPoint;
  payback: CashSeriesPoint | null;
  capex: CashSeriesPoint | null;
  rentOnMonthNum: number | null;
}

export function deriveCashMilestones(
  series: CashSeriesPoint[],
  opts?: { rentOnMonthNum?: number },
): CashMilestones {
  if (!series.length) {
    throw new Error('deriveCashMilestones: série vazia');
  }

  let valley = series[0];
  for (const p of series) {
    if (p.saldo < valley.saldo) valley = p;
  }

  const payback = series.find((p) => p.monthNum > 0 && p.saldo >= 0) ?? null;

  let capex: CashSeriesPoint | null = null;
  for (const p of series) {
    if (p.fluxo == null) continue;
    if (!capex || p.fluxo < (capex.fluxo ?? 0)) capex = p;
  }
  if (!capex) {
    const m0 = series.find((p) => p.monthNum === 0);
    capex = m0 ?? null;
  }

  return {
    valley,
    payback,
    capex,
    rentOnMonthNum: opts?.rentOnMonthNum ?? null,
  };
}

export function formatBrlSigned(n: number): string {
  const abs = Math.abs(n).toLocaleString('pt-BR');
  return n < 0 ? `−R$ ${abs}` : `+R$ ${abs}`;
}
