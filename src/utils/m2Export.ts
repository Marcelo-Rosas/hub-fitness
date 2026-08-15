import { DreGranularItem, DreMonth, Scenario } from '../types';
import { exportToPDF } from './exportHandlers';
import { OFFICIAL_DRE_24M } from '../data/initialData';

export function exportM2ToExcel(
  granularItems: DreGranularItem[],
  months: DreMonth[],
  scenario: Scenario,
  sensitivityFactor: number
) {
  const months24 = (months && months.length >= 24 ? months.slice(0, 24) : OFFICIAL_DRE_24M);
  const mult = 1 + sensitivityFactor / 100;
  const BOM = '\uFEFF';

  let csvContent = `${BOM}DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO (DRE) - HUB-FITNESS 3PL\n`;
  csvContent += `Cenário Ativo:;${scenario.name} (${scenario.occupancyRate}% Ocupação)\n`;
  csvContent += `Sensibilidade Aplicada:;${sensitivityFactor}%\n`;
  csvContent += `Data de Emissão:;${new Date().toLocaleDateString('pt-BR')}\n\n`;

  // --- SEÇÃO 1: RESUMO MÊS A MÊS (M1 A M24) ---
  csvContent += `1. VISÃO DETALHADA MÊS A MÊS (M1 A M24)\n`;
  csvContent += `Mês;Receita Bruta;DAS (6%);Custos Op. (COGS);Despesas Op. (OPEX);Lucro Líquido\n`;

  months24.forEach((m) => {
    const rec = sensitivityFactor === 0 ? m.receitaServicos : Math.round(m.receitaServicos * mult);
    const das = sensitivityFactor === 0 ? m.das6Percent : Math.round(m.das6Percent * mult);
    const cus = sensitivityFactor === 0 ? m.custosOperacionais : Math.round(m.custosOperacionais * mult);
    const des = sensitivityFactor === 0 ? m.despesasOperacionais : Math.round(m.despesasOperacionais * (sensitivityFactor < 0 ? 1 : mult));
    const luc = sensitivityFactor === 0 ? m.lucroLiquido : (rec - das - cus - des);

    csvContent += `${m.label};R$ ${rec.toLocaleString('pt-BR')};(R$ ${das.toLocaleString('pt-BR')});(R$ ${cus.toLocaleString('pt-BR')});(R$ ${des.toLocaleString('pt-BR')});R$ ${luc.toLocaleString('pt-BR')}\n`;
  });

  csvContent += `\n\n2. PLANO DE CONTAS & DRE GRANULAR\n`;
  csvContent += `Código Contábil;Centro de Custo;Seção;Tipo;Categoria;Nome da Linha;Valor Mensal Ano 1;Valor Mensal Ano 2;Status;Notas\n`;

  granularItems.forEach((item) => {
    csvContent += `"${item.accountCode || 'N/A'}";"${item.costCenterId || 'CC 001'}";"${item.section.toUpperCase()}";"${item.type}";"${item.category}";"${item.name}";R$ ${item.monthlyAmountY1.toLocaleString('pt-BR')};R$ ${item.monthlyAmountY2.toLocaleString('pt-BR')};"${item.active ? 'Ativo' : 'Inativo'}";"${item.notes || ''}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `DRE_Demonstrativo_Resultado_Exercício_${scenario.id}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportM2ToPdf(
  granularItems: DreGranularItem[],
  months: DreMonth[],
  scenario: Scenario,
  sensitivityFactor: number
) {
  const months24 = (months && months.length >= 24 ? months.slice(0, 24) : OFFICIAL_DRE_24M);
  const mult = 1 + sensitivityFactor / 100;
  
  const totalRev = months24.reduce((a, b) => a + (sensitivityFactor === 0 ? b.receitaServicos : Math.round(b.receitaServicos * mult)), 0);
  const totalLL = months24.reduce((a, b) => {
    if (sensitivityFactor === 0) return a + b.lucroLiquido;
    const rec = Math.round(b.receitaServicos * mult);
    const das = Math.round(b.das6Percent * mult);
    const cus = Math.round(b.custosOperacionais * mult);
    const des = Math.round(b.despesasOperacionais * (sensitivityFactor < 0 ? 1 : mult));
    return a + (rec - das - cus - des);
  }, 0);

  const tableHeaders = ['Mês', 'Receita (R$)', 'DAS 6% (R$)', 'Custos COGS (R$)', 'Despesas OPEX (R$)', 'Lucro Líquido (R$)'];
  const tableData = months24.map((m) => {
    const rec = sensitivityFactor === 0 ? m.receitaServicos : Math.round(m.receitaServicos * mult);
    const das = sensitivityFactor === 0 ? m.das6Percent : Math.round(m.das6Percent * mult);
    const cus = sensitivityFactor === 0 ? m.custosOperacionais : Math.round(m.custosOperacionais * mult);
    const des = sensitivityFactor === 0 ? m.despesasOperacionais : Math.round(m.despesasOperacionais * (sensitivityFactor < 0 ? 1 : mult));
    const luc = sensitivityFactor === 0 ? m.lucroLiquido : (rec - das - cus - des);

    return [
      m.label,
      `R$ ${rec.toLocaleString('pt-BR')}`,
      `R$ (${das.toLocaleString('pt-BR')})`,
      `R$ (${cus.toLocaleString('pt-BR')})`,
      `R$ (${des.toLocaleString('pt-BR')})`,
      `R$ ${luc.toLocaleString('pt-BR')}`,
    ];
  });

  exportToPDF({
    title: 'Demonstrativo do Resultado do Exercício (M2 DRE Granular)',
    subtitle: `Relatório Mês a Mês (M1-M24) | Sensibilidade: ${sensitivityFactor}%`,
    scenarioName: scenario.name,
    moduleCode: 'M2',
    filename: `DRE_M2_${scenario.id}`,
    kpis: [
      { label: 'Receita 24m', value: `R$ ${totalRev.toLocaleString('pt-BR')}` },
      { label: 'Lucro Líquido 24m', value: `R$ ${totalLL.toLocaleString('pt-BR')}` },
      { label: 'Sensibilidade', value: `${sensitivityFactor}%` },
      { label: 'Ocupação Base', value: `${scenario.occupancyRate}%` },
    ],
    tableHeaders,
    tableData,
    notes: [
      'Relatório DRE Granular exportado com base nos lançamentos contábeis reais do BP v3.5.',
      'Selo de Auditabilidade e Governança HUB-SIM.',
    ],
  });
}
