import React, { useState, useMemo } from 'react';
import { parseOfficialCSVs } from '../../data/officialData';
import { computeTechOpexMonthly, plAdditionalForMonth } from '../../core/engine';
import { M2DreVarianceChart } from '../M2DreVarianceChart';
import { usePlanner } from '../../context/PlannerContext';
import { DreSection } from '../../types';
import {
  FileSpreadsheet,
  BarChart3,
  Info,
  Layers,
  Search,
  ChevronDown,
  ChevronRight,
  CircleHelp,
} from 'lucide-react';
import { ModuleHeader } from '../ModuleHeader';

const SECTION_META: Record<
  DreSection,
  { label: string; badgeClass: string; headerClass: string; stickyHeaderClass: string; accent: string }
> = {
  receita: {
    label: 'RECEITAS',
    badgeClass: 'bg-emerald-950 text-emerald-300 border border-emerald-800',
    headerClass: 'bg-emerald-950/50 text-emerald-300',
    stickyHeaderClass: 'bg-[#0B1F1A]',
    accent: 'text-emerald-400',
  },
  custo: {
    label: 'CUSTOS (COGS)',
    badgeClass: 'bg-rose-950 text-rose-300 border border-rose-800',
    headerClass: 'bg-rose-950/50 text-rose-300',
    stickyHeaderClass: 'bg-[#1A0B0F]',
    accent: 'text-rose-400',
  },
  despesa: {
    label: 'DESPESAS (OPEX)',
    badgeClass: 'bg-amber-950 text-amber-300 border border-amber-800',
    headerClass: 'bg-amber-950/50 text-amber-300',
    stickyHeaderClass: 'bg-[#1A1508]',
    accent: 'text-amber-400',
  },
};

const SECTION_ORDER: DreSection[] = ['receita', 'custo', 'despesa'];

const AccountHint: React.FC<{ text?: string }> = ({ text }) => {
  if (!text) return null;
  return (
    <span className="relative inline-flex group/hint ml-1.5 align-middle shrink-0">
      <button
        type="button"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-slate-500 text-slate-400 hover:text-amber-300 hover:border-amber-400 cursor-help"
        aria-label="Explicação da conta"
      >
        <CircleHelp className="w-3.5 h-3.5" />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-72 -translate-x-1/2 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-[11px] font-normal leading-relaxed text-slate-200 shadow-xl opacity-0 group-hover/hint:opacity-100 transition-opacity">
        {text}
      </span>
    </span>
  );
};

export const M2Dre: React.FC = () => {
  const { granularDreItems, hubParams, dreMonths, activeScenario } = usePlanner();
  const { totals24M } = parseOfficialCSVs();
  const condoY1 = Math.round(hubParams.rent.areaM2 * hubParams.rent.condominiumPerM2);
  const rentY1 = Math.round(hubParams.rent.areaM2 * hubParams.rent.pricePerM2);
  const techOpexY1 = computeTechOpexMonthly(hubParams);
  const plAdicM7 = plAdditionalForMonth(hubParams, 7);
  const depreciacaoY1 =
    granularDreItems.find((i) => i.id === 'cst-depreciacao')?.monthlyAmountY1 ??
    Math.round(hubParams.capex.total / 56);

  const [activeTab, setActiveTab] = useState<'sintetico' | 'granular' | 'variancia'>('sintetico');
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState<'all' | DreSection>('all');
  const [expandedSections, setExpandedSections] = useState<Record<DreSection, boolean>>({
    receita: true,
    custo: true,
    despesa: true,
  });
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});

  // M7 structure: COGS vs OPEX separated (BP v3.5 = R$ 178.609)
  const m7CustoBreakdown = [
    { category: 'Custo Variável por Posição', value: 35505 },
    { category: 'Mão de Obra Terceirizada (Chapa/Desova)', value: 12000 },
    { category: 'OPEX Máquinas (Diesel/Manutenção)', value: 4400 },
  ];
  const m7DespesaBreakdown = [
    { category: 'Pessoal CLT + Pró-labore Regular', value: 49500 },
    { category: 'Pró-labore Adicional (Fator R)', value: plAdicM7 },
    { category: 'Depreciação CAPEX', value: depreciacaoY1 },
    { category: `Aluguel Galpão A (pós-carência)`, value: rentY1 },
    { category: `Condomínio logístico (R$ ${hubParams.rent.condominiumPerM2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/m² × ${hubParams.rent.areaM2.toLocaleString('pt-BR')} m²)`, value: condoY1 },
    ...(techOpexY1 > 0
      ? [{ category: 'OPEX Tech (Logcomex + Cloud WMS)', value: techOpexY1 }]
      : []),
  ];
  const m7CustoTotal = m7CustoBreakdown.reduce((a, b) => a + b.value, 0);
  const m7DespesaTotal = m7DespesaBreakdown.reduce((a, b) => a + b.value, 0);
  const m7TotalCostSum = m7CustoTotal + m7DespesaTotal; // R$ 178.609

  const filteredGranularItems = useMemo(() => {
    return granularDreItems.filter((item) => {
      if (sectionFilter !== 'all' && item.section !== sectionFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const hay = `${item.name} ${item.accountCode ?? ''} ${item.costCenterId ?? ''} ${item.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [granularDreItems, sectionFilter, searchTerm]);

  const groupedGranular = useMemo(() => {
    return SECTION_ORDER.map((section) => {
      const items = filteredGranularItems.filter((i) => i.section === section);
      const total24 = items.reduce(
        (acc, item) => acc + item.monthlyAmountY1 * 12 + item.monthlyAmountY2 * 12,
        0
      );
      return { section, items, total24 };
    });
  }, [filteredGranularItems]);

  const toggleSection = (section: DreSection) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleAccount = (id: string) => {
    setExpandedAccounts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatBRL = (value: number) =>
    value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      {/* MODULE HEADER WITH OFFICIAL CONSOLIDATED METRICS */}
      <ModuleHeader
        moduleId="M2"
        title="DRE Demonstrativo do Resultado (24 Meses)"
        subtitle="Consolidado contábil oficial M1 ao M24 extraído de 01_DRE_24_meses.csv com amparo no Simples Nacional Anexo III."
        kpis={[
          {
            label: 'Receita Bruta 24m',
            value: `R$ ${totals24M.receitaTotal.toLocaleString('pt-BR')}`,
            subtext: 'Somatório oficial 24 meses M1–M24',
            badge: 'RECEITA TOTAL',
            highlightColor: 'slate',
          },
          {
            label: 'Custos & OpEx 24m',
            value: `R$ ${totals24M.custosETotasOp.toLocaleString('pt-BR')}`,
            subtext: 'Custos variáveis + despesas + tributos',
            badge: 'CUSTOS TOTAL',
            highlightColor: 'amber',
          },
          {
            label: 'Lucro Líquido 24m',
            value: `R$ ${totals24M.lucroLiquidoTotal.toLocaleString('pt-BR')}`,
            subtext: 'Margem Líquida Efetiva 11,9%',
            badge: 'LUCRO LÍQUIDO ★',
            highlightColor: 'emerald',
          },
          {
            label: 'Fator R Simples',
            value: '28,4%',
            subtext: 'Alíquota favorecida Anexo III (6%)',
            badge: 'FISCAL',
            highlightColor: 'indigo',
          },
        ]}
      />

      {/* NAVIGATION TABS (SINTÉTICO | GRANULAR | VARIANCIA) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-2 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('sintetico')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'sintetico'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Visão Sintética (24M)</span>
          </button>

          <button
            onClick={() => setActiveTab('granular')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'granular'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Plano de Contas Granular</span>
          </button>

          <button
            onClick={() => setActiveTab('variancia')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'variancia'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Análise de Variância Orçamentária</span>
          </button>
        </div>

        {/* M7 Cost Structure Tooltip Indicator — COGS vs OPEX separated */}
        <div className="relative group flex items-center gap-2 bg-slate-800/90 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700/80 text-xs font-medium cursor-help">
          <Info className="w-4 h-4 text-emerald-400" />
          <span>Estrutura M7: R$ {m7TotalCostSum.toLocaleString('pt-BR')}/mês</span>
          <div className="absolute right-0 top-full mt-2 w-88 bg-slate-950 text-slate-200 p-4 rounded-xl border border-slate-700 shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-50 text-[11px] space-y-3">
            <div className="font-bold text-emerald-400 border-b border-slate-800 pb-1.5 flex justify-between">
              <span>Detalhamento M7 (BP v3.5)</span>
              <span>R$ {m7TotalCostSum.toLocaleString('pt-BR')}</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between font-bold text-rose-300 uppercase tracking-wide text-[10px]">
                <span>Custos (COGS)</span>
                <span>R$ {m7CustoTotal.toLocaleString('pt-BR')}</span>
              </div>
              <div className="space-y-1 font-mono">
                {m7CustoBreakdown.map((item) => (
                  <div key={item.category} className="flex justify-between items-center text-[10px]">
                    <span className="font-sans text-slate-300">{item.category}</span>
                    <span className="font-bold text-rose-200">R$ {item.value.toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 border-t border-slate-800 pt-2">
              <div className="flex justify-between font-bold text-amber-300 uppercase tracking-wide text-[10px]">
                <span>Despesas (OPEX)</span>
                <span>R$ {m7DespesaTotal.toLocaleString('pt-BR')}</span>
              </div>
              <div className="space-y-1 font-mono">
                {m7DespesaBreakdown.map((item) => (
                  <div key={item.category} className="flex justify-between items-center text-[10px]">
                    <span className="font-sans text-slate-300">{item.category}</span>
                    <span className="font-bold text-amber-200">R$ {item.value.toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[9px] text-slate-400 font-sans border-t border-slate-800 pt-1.5">
              Custos = COGS direto. Despesas = OPEX fixo/governança (inclui Fator R).
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: VISÃO SINTÉTICA DRE 24 MESES */}
      {activeTab === 'sintetico' && (
        <div className="space-y-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto max-h-150">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-950 text-white font-bold border-b border-slate-800 shadow-md">
                  <tr>
                    <th className="py-3.5 px-4 sticky left-0 z-30 bg-slate-950 border-r border-slate-800 font-sans uppercase tracking-wider text-[11px]">
                      Mês DRE
                    </th>
                    <th className="py-3.5 px-4 text-right font-mono uppercase tracking-wider text-[11px]">Receita Bruta (R$)</th>
                    <th className="py-3.5 px-4 text-right font-mono uppercase tracking-wider text-[11px]">Custos Var. (R$)</th>
                    <th className="py-3.5 px-4 text-right font-mono uppercase tracking-wider text-[11px]">Lucro Bruto (R$)</th>
                    <th className="py-3.5 px-4 text-right font-mono uppercase tracking-wider text-[11px]">Despesas Op. (R$)</th>
                    <th className="py-3.5 px-4 text-right font-mono uppercase tracking-wider text-[11px]">Pró-Labore (R$)</th>
                    <th className="py-3.5 px-4 text-right font-mono uppercase tracking-wider text-[11px]">DAS Simples (R$)</th>
                    <th className="py-3.5 px-4 text-right font-mono uppercase tracking-wider text-[11px] text-emerald-400">Lucro Líquido (R$)</th>
                    <th className="py-3.5 px-4 text-right font-mono uppercase tracking-wider text-[11px]">Margem %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-200">
                  {dreMonths.map((m, idx) => {
                    const isEven = idx % 2 === 0;
                    const isProfitable = m.lucroLiquido >= 0;
                    const lucroBruto = m.receitaServicos - m.custosOperacionais - m.das6Percent;
                    const margem = m.receitaServicos === 0 ? 0 : (m.lucroLiquido / m.receitaServicos) * 100;

                    return (
                      <tr
                        key={m.label}
                        className={`transition-colors ${
                          isEven ? 'bg-slate-900' : 'bg-slate-800/50'
                        } hover:bg-slate-800`}
                      >
                        <td className="py-3 px-4 font-bold font-sans text-white sticky left-0 z-10 bg-slate-950 border-r border-slate-800">
                          {m.label}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-100 font-bold">
                          R$ {m.receitaServicos.toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          R$ {m.custosOperacionais.toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-200 font-bold">
                          R$ {lucroBruto.toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          R$ {m.despesasOperacionais.toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">—</td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          R$ {m.das6Percent.toLocaleString('pt-BR')}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-black ${
                            isProfitable ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          R$ {m.lucroLiquido.toLocaleString('pt-BR')}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-bold ${
                            isProfitable ? 'text-emerald-300' : 'text-rose-300'
                          }`}
                        >
                          {margem.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* TOTAL CONSOLIDATED 24M ROW */}
                <tfoot className="sticky bottom-0 z-20 bg-slate-950 text-white font-bold font-mono border-t-2 border-emerald-500 shadow-2xl">
                  <tr>
                    <td className="py-4 px-4 sticky left-0 z-30 bg-slate-950 border-r border-slate-800 font-sans text-emerald-400 text-sm font-black">
                      TOTAL 24M (M1–M24)
                    </td>
                    <td className="py-4 px-4 text-right text-white font-black text-sm">
                      R$ {dreMonths.reduce((a, m) => a + m.receitaServicos, 0).toLocaleString('pt-BR')}
                    </td>
                    <td colSpan={5} className="py-4 px-4 text-center text-slate-400 font-sans text-xs">
                      Custos + Despesas Op + DAS = R${' '}
                      {dreMonths.reduce((a, m) => a + m.custosOperacionais + m.despesasOperacionais + m.das6Percent, 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-4 px-4 text-right text-emerald-400 font-black text-base">
                      R$ {dreMonths.reduce((a, m) => a + m.lucroLiquido, 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-4 px-4 text-right text-emerald-300 font-black text-sm">
                      11,9%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PLANO DE CONTAS GRANULAR */}
      {activeTab === 'granular' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 flex-1 min-w-60">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Buscar conta contábil ou centro de custo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs outline-none bg-transparent"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSectionFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  sectionFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setSectionFilter('receita')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  sectionFilter === 'receita' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Receitas
              </button>
              <button
                onClick={() => setSectionFilter('custo')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  sectionFilter === 'custo' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Custos
              </button>
              <button
                onClick={() => setSectionFilter('despesa')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                  sectionFilter === 'despesa' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Despesas
              </button>
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-240 text-left border-collapse">
                <colgroup>
                  <col style={{ width: '36%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '13.33%' }} />
                  <col style={{ width: '13.33%' }} />
                  <col style={{ width: '13.34%' }} />
                </colgroup>
                <thead className="sticky top-0 z-20 bg-slate-950 text-white font-bold">
                  <tr>
                    <th className="py-3 px-4 text-left text-[11px] uppercase tracking-wider">
                      Conta / Categoria
                    </th>
                    <th className="py-3 px-3 text-center text-[11px] uppercase tracking-wider">
                      Centro de Custo
                    </th>
                    <th className="py-3 px-3 text-center text-[11px] uppercase tracking-wider">Tipo</th>
                    <th className="py-3 px-3 text-right font-mono text-[11px] uppercase tracking-wider">
                      Mensal Ano 1
                    </th>
                    <th className="py-3 px-3 text-right font-mono text-[11px] uppercase tracking-wider">
                      Mensal Ano 2
                    </th>
                    <th className="py-3 px-3 text-right font-mono text-[11px] uppercase tracking-wider text-emerald-400">
                      Total 24M
                    </th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {groupedGranular.map(({ section, items, total24 }) => {
                    const meta = SECTION_META[section];
                    const isExpanded = expandedSections[section];
                    const compositionCount = items.reduce((n, i) => n + (i.composition?.length ?? 0), 0);

                    return (
                      <React.Fragment key={section}>
                        <tr className={`${meta.headerClass} border-y border-white/10`}>
                          <td className="py-2.5 px-4">
                            <button
                              type="button"
                              onClick={() => toggleSection(section)}
                              className="flex items-center gap-2 font-sans font-black text-[12px] uppercase tracking-wide cursor-pointer hover:opacity-90"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 shrink-0" />
                              )}
                              <span>{meta.label}</span>
                              <span className="text-[10px] font-bold opacity-70 normal-case tracking-normal">
                                ({items.length} {items.length === 1 ? 'conta' : 'contas'}
                                {compositionCount > 0 ? ` · ${compositionCount} itens` : ''})
                              </span>
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-center text-[10px] font-bold uppercase tracking-wide opacity-50">
                            —
                          </td>
                          <td className="py-2.5 px-3 text-center text-[10px] font-bold uppercase tracking-wide opacity-50">
                            —
                          </td>
                          <td className="py-2.5 px-3 text-right text-[10px] font-bold uppercase tracking-wide opacity-70">
                            Subtotal
                          </td>
                          <td className="py-2.5 px-3 text-right text-[10px] font-bold uppercase tracking-wide opacity-70">
                            24 meses
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono text-sm font-black ${meta.accent}`}>
                            {items.length ? `R$ ${formatBRL(total24)}` : 'R$ 0'}
                          </td>
                        </tr>

                        {isExpanded && items.length === 0 && (
                          <tr className="bg-slate-900">
                            <td colSpan={6} className="py-6 text-center text-slate-500 text-xs">
                              Nenhuma conta de {meta.label.toLowerCase()} para os filtros selecionados.
                            </td>
                          </tr>
                        )}

                        {isExpanded &&
                          items.map((item, idx) => {
                            const lineTotal24 = item.monthlyAmountY1 * 12 + item.monthlyAmountY2 * 12;
                            const rowBg = idx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/40';
                            const hasComp = (item.composition?.length ?? 0) > 0;
                            const isOpen = expandedAccounts[item.id] ?? true;

                            return (
                              <React.Fragment key={item.id}>
                                <tr className={`${rowBg} hover:bg-slate-800 transition-colors border-t border-slate-800/60`}>
                                  <td className="py-3 px-4 font-sans text-white">
                                    <div className="flex items-start gap-2">
                                      {hasComp ? (
                                        <button
                                          type="button"
                                          onClick={() => toggleAccount(item.id)}
                                          className="mt-0.5 text-slate-400 hover:text-white cursor-pointer"
                                          aria-label={isOpen ? 'Recolher composição' : 'Expandir composição'}
                                        >
                                          {isOpen ? (
                                            <ChevronDown className="w-3.5 h-3.5" />
                                          ) : (
                                            <ChevronRight className="w-3.5 h-3.5" />
                                          )}
                                        </button>
                                      ) : (
                                        <span className="w-3.5" />
                                      )}
                                      <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                                        <span className="font-semibold text-[13px] leading-snug">{item.name}</span>
                                        {item.accountCode && (
                                          <span className="font-mono text-[10px] text-slate-500">{item.accountCode}</span>
                                        )}
                                        <AccountHint text={item.notes} />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-center text-slate-300 font-sans text-[12px] tabular-nums">
                                    {item.costCenterId ?? '—'}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <span className={`inline-block min-w-20 px-2 py-0.5 rounded text-[10px] font-bold ${meta.badgeClass}`}>
                                      {section.toUpperCase()}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono text-[13px] tabular-nums text-slate-100">
                                    R$ {formatBRL(item.monthlyAmountY1)}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono text-[13px] tabular-nums text-slate-100">
                                    R$ {formatBRL(item.monthlyAmountY2)}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono text-[13px] tabular-nums font-bold text-emerald-400">
                                    R$ {formatBRL(lineTotal24)}
                                  </td>
                                </tr>

                                {hasComp &&
                                  isOpen &&
                                  item.composition!.map((comp) => {
                                    const comp24 = comp.monthlyAmountY1 * 12 + comp.monthlyAmountY2 * 12;
                                    return (
                                      <tr
                                        key={comp.id}
                                        className="bg-slate-950/70 border-t border-slate-800/40 text-slate-300"
                                      >
                                        <td className="py-2 px-4">
                                          <div className="pl-9 flex items-center gap-1 min-w-0">
                                            <span className="text-[12px] leading-snug">{comp.name}</span>
                                            <AccountHint text={comp.formula} />
                                          </div>
                                        </td>
                                        <td className="py-2 px-3 text-center text-[11px] text-slate-500">
                                          {item.costCenterId ?? '—'}
                                        </td>
                                        <td className="py-2 px-3 text-center text-[10px] uppercase tracking-wide text-slate-500">
                                          item
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-[12px] tabular-nums text-slate-300">
                                          R$ {formatBRL(comp.monthlyAmountY1)}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-[12px] tabular-nums text-slate-300">
                                          R$ {formatBRL(comp.monthlyAmountY2)}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono text-[12px] tabular-nums text-slate-400">
                                          R$ {formatBRL(comp24)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </React.Fragment>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ANÁLISE DE VARIANCIA ORÇAMENTÁRIA (ISOLADA) */}
      {activeTab === 'variancia' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-white space-y-2">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Análise Isolada de Variância Orçamentária
            </h3>
            <p className="text-xs text-slate-400">
              Comparativo entre o orçamento base da diretoria e as realizações simuladas no modelo financeiro.
            </p>
          </div>

          <M2DreVarianceChart
            granularDreItems={granularDreItems}
            activeScenario={activeScenario}
          />
        </div>
      )}
    </div>
  );
};
