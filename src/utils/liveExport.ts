import type { DreGranularItem, DreMonth } from '../types';
import { coaMaeFilha, summarizeLiveDre, type LiveDreTotals } from '../core/engine';

/** Sem fallback CSV freeze. Sem meses → vazio (nunca OFFICIAL_DRE_24M). */
export function liveMonths(dreMonths: DreMonth[] | undefined): DreMonth[] {
  if (!dreMonths?.length) return [];
  return dreMonths.slice(0, 24);
}

export const LIVE_EXPORT_SEAL = 'LEDGER LIVE · finance.ledger_lines (Operator)';

export const DRE_MONTH_HEADERS = [
  'Mês',
  'Receita Serviços (R$)',
  'DAS (R$)',
  'Custos COGS (R$)',
  'Despesas OPEX (R$)',
  'Lucro Líquido (R$)',
] as const;

export const LEDGER_HEADERS = [
  'Conta Mãe',
  'Conta Filha',
  'Centro de Custo',
  'Seção',
  'Nome',
  'Mensal Ano 1 (R$)',
  'Mensal Ano 2 (R$)',
  'Status',
] as const;

export type DreYearSlice = {
  receita: number;
  das: number;
  custos: number;
  despesas: number;
  lucro: number;
};

export function dreYearSlices(months: DreMonth[]): { y1: DreYearSlice; y2: DreYearSlice } {
  const sum = (slice: DreMonth[]): DreYearSlice => ({
    receita: slice.reduce((a, m) => a + m.receitaServicos, 0),
    das: slice.reduce((a, m) => a + m.das6Percent, 0),
    custos: slice.reduce((a, m) => a + m.custosOperacionais, 0),
    despesas: slice.reduce((a, m) => a + m.despesasOperacionais, 0),
    lucro: slice.reduce((a, m) => a + m.lucroLiquido, 0),
  });
  return { y1: sum(months.slice(0, 12)), y2: sum(months.slice(12, 24)) };
}

export type LiveDreExport = {
  months: DreMonth[];
  totals: LiveDreTotals;
  years: { y1: DreYearSlice; y2: DreYearSlice };
  monthHeaders: typeof DRE_MONTH_HEADERS;
  monthRows: (string | number)[][];
  ledgerHeaders: typeof LEDGER_HEADERS;
  ledgerRows: (string | number)[][];
  seal: string;
};

export function buildLiveDreExport(
  dreMonths: DreMonth[] | undefined,
  granularItems: DreGranularItem[] = [],
): LiveDreExport {
  const months = liveMonths(dreMonths);
  const totals = summarizeLiveDre(months);
  const years = dreYearSlices(months);
  const monthRows: (string | number)[][] = months.map((m) => [
    m.label,
    m.receitaServicos,
    m.das6Percent,
    m.custosOperacionais,
    m.despesasOperacionais,
    m.lucroLiquido,
  ]);
  monthRows.push([
    'TOTAL_24M',
    totals.receitaTotal,
    totals.dasTotal,
    totals.custosOperacionaisTotal,
    totals.despesasOperacionaisTotal,
    totals.lucroLiquidoTotal,
  ]);
  monthRows.push(['Y1_M1_M12', years.y1.receita, years.y1.das, years.y1.custos, years.y1.despesas, years.y1.lucro]);
  monthRows.push(['Y2_M13_M24', years.y2.receita, years.y2.das, years.y2.custos, years.y2.despesas, years.y2.lucro]);
  const ledgerRows: (string | number)[][] = granularItems.map((item) => {
    const { mae, filha } = coaMaeFilha(item.accountCode);
    return [
      mae || '—',
      filha || item.accountCode || '—',
      item.costCenterId || '—',
      item.section,
      item.name,
      item.monthlyAmountY1,
      item.monthlyAmountY2,
      item.active ? 'Ativo' : 'Inativo',
    ];
  });
  return {
    months,
    totals,
    years,
    monthHeaders: DRE_MONTH_HEADERS,
    monthRows,
    ledgerHeaders: LEDGER_HEADERS,
    ledgerRows,
    seal: LIVE_EXPORT_SEAL,
  };
}

export function formatBrlCell(n: number): string {
  return `R$ ${n.toLocaleString('pt-BR')}`;
}

/** Mesmas células do CSV, só formatadas p/ PDF — um payload, dois arquivos. */
export function pdfMonthTable(pack: LiveDreExport): { headers: string[]; rows: string[][] } {
  return {
    headers: [...pack.monthHeaders],
    rows: pack.monthRows.map((row) =>
      row.map((cell, i) => (i === 0 ? String(cell) : formatBrlCell(Number(cell)))),
    ),
  };
}

export function pdfLedgerTable(pack: LiveDreExport): { headers: string[]; rows: string[][] } {
  return {
    headers: [...pack.ledgerHeaders],
    rows: pack.ledgerRows.map((row) =>
      row.map((cell, i) => (i === 5 || i === 6 ? formatBrlCell(Number(cell)) : String(cell))),
    ),
  };
}

/** CSV DRE live: meses + ledger. Mesmo payload do PDF. */
export function renderLiveDreCsv(
  dreMonths: DreMonth[],
  scenarioName: string,
  granularItems: DreGranularItem[] = [],
): { csv: string; pack: LiveDreExport } {
  const pack = buildLiveDreExport(dreMonths, granularItems);
  const BOM = '\uFEFF';
  let csv = BOM;
  csv += `"HUB-SIM · DRE LIVE"\n`;
  csv += `"${pack.seal}"\n`;
  csv += `"Cenário: ${scenarioName.replace(/"/g, '""')}"\n`;
  csv += `"Receita 24m:;${pack.totals.receitaTotal}"\n`;
  csv += `"Lucro Líquido 24m:;${pack.totals.lucroLiquidoTotal}"\n`;
  csv += `"Data: ${new Date().toLocaleDateString('pt-BR')}"\n\n`;
  csv += `1. DRE MÊS A MÊS\n`;
  csv += pack.monthHeaders.join(';') + '\n';
  pack.monthRows.forEach((row) => {
    csv += row.join(';') + '\n';
  });
  csv += `\n2. LEDGER MÃE/FILHA\n`;
  csv += pack.ledgerHeaders.join(';') + '\n';
  pack.ledgerRows.forEach((row) => {
    csv += row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';') + '\n';
  });
  return { csv, pack };
}
