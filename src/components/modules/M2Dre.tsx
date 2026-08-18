import React, { useState, useMemo } from 'react';
import {
  computeTechOpexMonthly,
  plAdditionalForMonth,
  occupancyAmountForMonth,
  isRentAnalyticLine,
  OCCUPANCY_SYNTHETIC_CODE,
  coaSyntheticParent,
  groupLedgerBySyntheticParent,
  expandCompositionFilhas,
  ledgerAmount24m,
} from '../../core/engine';
import { M2DreVarianceChart } from '../M2DreVarianceChart';
import { usePlanner } from '../../context/PlannerContext';
import { composeContract, defaultContractCtx } from '../../core/contracts';
import { ContractChip } from '../ContractChip';
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
import { CoaMaeFilha } from '../CoaMaeFilha';

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
  const {
    granularDreItems,
    ledgerBaseItems,
    hubParams,
    dreMonths,
    fatorR,
    activeScenario,
    chartOfAccounts,
  } = usePlanner();

  const activeDrivers = activeScenario.drivers;

  const contractCtx = useMemo(
    () => defaultContractCtx(ledgerBaseItems, hubParams, activeDrivers, 1),
    [ledgerBaseItems, hubParams, activeDrivers],
  );
  const aContract = useMemo(() => composeContract('A_PROJETADO', contractCtx), [contractCtx]);
  const bContract = useMemo(() => composeContract('B_CHEIO', contractCtx), [contractCtx]);
  const dContract = useMemo(() => composeContract('D_TRAILING12', contractCtx), [contractCtx]);

  const sum24 = aContract.sum24 ?? {
    receita: 0,
    custos: 0,
    despesas: 0,
    das: 0,
    lucro: 0,
  };
  const margemA =
    sum24.receita === 0 ? 0 : Number(((sum24.lucro / sum24.receita) * 100).toFixed(1));
  const { fatorRMin, fatorRMax } = hubParams.fiscal;
  const rbt12 = dContract.rbt12 ?? 0;
  const dentroDaBanda = fatorR >= fatorRMin && fatorR <= fatorRMax;
  const flat24 = bContract.flat24;

  const y1Of = (id: string) =>
    granularDreItems.find((i) => i.id === id && i.active)?.monthlyAmountY1 ?? 0;
  const techOpexY1 = computeTechOpexMonthly(hubParams);
  const plAdicM7 = plAdditionalForMonth(hubParams, 7);
  const depreciacaoY1 =
    y1Of('cst-depreciacao') || Math.round(hubParams.capex.total / 56);
  const occupancyM7 = occupancyAmountForMonth(granularDreItems, 7, hubParams);

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
    { category: 'Custo Variável por Posição', value: y1Of('cst-cv-posicao') },
    { category: 'Mão de Obra Terceirizada (Chapa/Desova)', value: y1Of('cst-mo-terceirizada') },
    { category: 'OPEX Máquinas (Diesel/Manutenção)', value: y1Of('cst-opex-maquinas') },
  ];
  const m7DespesaBreakdown = [
    { category: 'Pessoal CLT + Pró-labore Regular', value: y1Of('cst-pessoal-clt-pl') },
    { category: 'Pró-labore Adicional (Fator R)', value: plAdicM7 },
    { category: 'Depreciação CAPEX', value: depreciacaoY1 },
    {
      category: `Ocupação ${OCCUPANCY_SYNTHETIC_CODE} (aluguel pós-carência + facilities)`,
      value: occupancyM7,
    },
    ...(techOpexY1 > 0
      ? [{ category: 'OPEX Tech (Logcomex + Cloud WMS)', value: techOpexY1 }]
      : []),
  ];
  const m7CustoTotal = m7CustoBreakdown.reduce((a, b) => a + b.value, 0);
  const m7DespesaTotal = m7DespesaBreakdown.reduce((a, b) => a + b.value, 0);
  const m7TotalCostSum = m7CustoTotal + m7DespesaTotal; // R$ 178.609

  const filteredGranularItems = useMemo(() => {
    return expandCompositionFilhas(granularDreItems).filter((item) => {
      if (sectionFilter !== 'all' && item.section !== sectionFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const hay = `${item.name} ${item.accountCode ?? ''} ${coaSyntheticParent(item.accountCode) ?? ''} ${item.costCenterId ?? ''} ${item.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [granularDreItems, sectionFilter, searchTerm]);

  const groupedGranular = useMemo(() => {
    return SECTION_ORDER.map((section) => {
      const items = filteredGranularItems.filter((i) => i.section === section);
      const groups = groupLedgerBySyntheticParent(items);
      const total24 = items.reduce((acc, item) => acc + ledgerAmount24m(item, hubParams), 0);
      return { section, groups, total24 };
    });
  }, [filteredGranularItems, hubParams]);

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
        subtitle="Consolidado live M1–M24 a partir de finance.ledger_lines (Operator) → engine. CSV e PDF saem do mesmo payload."
        kpis={[
          {
            label: 'Receita Bruta 24m',
            value: `R$ ${sum24.receita.toLocaleString('pt-BR')}`,
            subtext: 'Contrato A — pipeline Σ24 (projetado c/ ramp + carência)',
            badge: 'RECEITA TOTAL',
            suffix: <ContractChip id="A_PROJETADO" />,
            highlightColor: 'slate',
          },
          {
            label: 'Custos & OpEx 24m',
            value: `R$ ${(sum24.custos + sum24.despesas + sum24.das).toLocaleString('pt-BR')}`,
            subtext: 'Custos + despesas + DAS (contrato A)',
            badge: 'CUSTOS TOTAL',
            suffix: <ContractChip id="A_PROJETADO" />,
            highlightColor: 'amber',
          },
          {
            label: 'Lucro Líquido 24m',
            value: `R$ ${sum24.lucro.toLocaleString('pt-BR')}`,
            subtext: `Margem líquida ${margemA.toFixed(1).replace('.', ',')}%`,
            badge: 'LUCRO LÍQUIDO ★',
            suffix: <ContractChip id="A_PROJETADO" />,
            highlightColor: 'emerald',
          },
          {
            label: 'Fator R Simples',
            value: `${fatorR.toFixed(2).replace('.', ',')}%`,
            subtext: `Banda alvo ${fatorRMin.toFixed(2).replace('.', ',')}–${fatorRMax.toFixed(2).replace('.', ',')}%`,
            badge: 'FISCAL',
            suffix: <ContractChip id="D_TRAILING12" />,
            highlightColor: 'indigo',
          },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
        <span className="text-xs font-bold text-indigo-950">Fator R fiscal</span>
        <ContractChip id="D_TRAILING12" />
        <span className="font-mono font-bold text-indigo-900">{fatorR.toFixed(2).replace('.', ',')}%</span>
        <span className="text-xs text-slate-600">
          RBT12: R$ {rbt12.toLocaleString('pt-BR')}
        </span>
        <span
          className={`px-2 py-0.5 rounded text-xs font-bold ${
            dentroDaBanda
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {dentroDaBanda
            ? `✓ Banda ${fatorRMin.toFixed(1).replace('.', ',')}–${fatorRMax.toFixed(1).replace('.', ',')}%`
            : `⚠ Fora da banda (${fatorR < fatorRMin ? `<${fatorRMin.toFixed(1).replace('.', ',')}%` : `>${fatorRMax.toFixed(1).replace('.', ',')}%`})`}
        </span>
      </div>

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
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-800">Visão Sintética M1–M24</h3>
            <ContractChip id="A_PROJETADO" />
          </div>
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
                      R$ {sum24.receita.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-4 px-4 text-right text-slate-200 font-black text-sm">
                      R$ {sum24.custos.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-4 px-4 text-right text-slate-200 font-black text-sm">
                      R$ {(sum24.receita - sum24.custos - sum24.das).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-4 px-4 text-right text-slate-200 font-black text-sm">
                      R$ {sum24.despesas.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-4 px-4 text-right text-slate-400">—</td>
                    <td className="py-4 px-4 text-right text-slate-200 font-black text-sm">
                      R$ {sum24.das.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-4 px-4 text-right text-emerald-400 font-black text-base">
                      R$ {sum24.lucro.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-4 px-4 text-right text-emerald-300 font-black text-sm">
                      {margemA.toFixed(1)}%
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Plano de Contas Granular</h3>
              {flat24 && (
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Receita plena 24m (B): R$ {flat24.receita.toLocaleString('pt-BR')}
                </p>
              )}
            </div>
            <ContractChip id="B_CHEIO" />
          </div>
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
                  {groupedGranular.map(({ section, groups, total24 }) => {
                    const meta = SECTION_META[section];
                    const isExpanded = expandedSections[section];
                    const visibleItems = groups.flatMap((g) => g.items);
                    const compositionCount = visibleItems.reduce((n, i) => n + (i.composition?.length ?? 0), 0);

                    const renderItem = (
                      item: (typeof visibleItems)[number],
                      idx: number,
                      nested: boolean,
                    ) => {
                      const lineTotal24 = ledgerAmount24m(item, hubParams);
                      const rowBg = idx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/40';
                      const hasComp = (item.composition?.length ?? 0) > 0;
                      const isOpen = expandedAccounts[item.id] ?? true;
                      return (
                        <React.Fragment key={item.id}>
                          <tr className={`${rowBg} hover:bg-slate-800 transition-colors border-t border-slate-800/60`}>
                            <td className="py-3 px-4 font-sans text-white">
                              <div className={`flex items-start gap-2 ${nested ? 'pl-6' : ''}`}>
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
                                  <CoaMaeFilha accountCode={item.accountCode} show="pair" />
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
                              const comp24 = isRentAnalyticLine(item)
                                ? ledgerAmount24m(
                                    { ...item, monthlyAmountY1: comp.monthlyAmountY1, monthlyAmountY2: comp.monthlyAmountY2 },
                                    hubParams,
                                  )
                                : comp.monthlyAmountY1 * 12 + comp.monthlyAmountY2 * 12;
                              return (
                                <tr
                                  key={comp.id}
                                  className="bg-slate-950/70 border-t border-slate-800/40 text-slate-300"
                                >
                                  <td className="py-2 px-4">
                                    <div className={`pl-9 flex items-center gap-1.5 min-w-0 flex-wrap ${nested ? 'ml-6' : ''}`}>
                                      <span className="text-[12px] leading-snug">{comp.name}</span>
                                      <AccountHint text={comp.formula} />
                                      {comp.accountCode ? <CoaMaeFilha accountCode={comp.accountCode} show="pair" /> : null}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-center text-[11px] text-slate-500">
                                    {item.costCenterId ?? '—'}
                                  </td>
                                  <td className="py-2 px-3 text-center text-[10px] uppercase tracking-wide text-slate-500">
                                    fórmula
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
                    };

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
                                ({visibleItems.length} {visibleItems.length === 1 ? 'conta' : 'contas'}
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
                            {visibleItems.length ? `R$ ${formatBRL(total24)}` : 'R$ 0'}
                          </td>
                        </tr>

                        {isExpanded && visibleItems.length === 0 && (
                          <tr className="bg-slate-900">
                            <td colSpan={6} className="py-6 text-center text-slate-500 text-xs">
                              Nenhuma conta de {meta.label.toLowerCase()} para os filtros selecionados.
                            </td>
                          </tr>
                        )}

                        {isExpanded &&
                          groups.map((group) => {
                            const hasMae = Boolean(group.parentCode);
                            const parentAcc = chartOfAccounts.find((a) => a.code === group.parentCode);
                            const groupOpen = expandedAccounts[`coa:${group.parentCode}`] ?? true;
                            const isOcc = group.parentCode === OCCUPANCY_SYNTHETIC_CODE;
                            const group24 = group.items.reduce((acc, item) => acc + ledgerAmount24m(item, hubParams), 0);
                            const groupY1 = group.items.reduce((a, i) => a + i.monthlyAmountY1, 0);
                            const groupY2 = group.items.reduce((a, i) => a + i.monthlyAmountY2, 0);
                            return (
                              <React.Fragment key={group.parentCode || group.items[0]?.id || section}>
                                {hasMae && (
                                  <tr
                                    className={
                                      isOcc
                                        ? 'bg-amber-950/40 border-t border-amber-900/40'
                                        : 'bg-slate-800/80 border-t border-slate-700/60'
                                    }
                                  >
                                    <td className="py-3 px-4 font-sans text-white">
                                      <button
                                        type="button"
                                        onClick={() => toggleAccount(`coa:${group.parentCode}`)}
                                        className="flex items-center gap-2 cursor-pointer flex-wrap"
                                      >
                                        {groupOpen ? (
                                          <ChevronDown className={`w-3.5 h-3.5 ${isOcc ? 'text-amber-300' : 'text-cyan-300'}`} />
                                        ) : (
                                          <ChevronRight className={`w-3.5 h-3.5 ${isOcc ? 'text-amber-300' : 'text-cyan-300'}`} />
                                        )}
                                        <span className="font-semibold text-[13px]">
                                          {parentAcc?.name ?? group.parentCode}
                                        </span>
                                        <CoaMaeFilha accountCode={group.parentCode} show="mae" />
                                      </button>
                                    </td>
                                    <td className="py-3 px-3 text-center text-slate-400 text-[12px]">
                                      {parentAcc?.costCenterId ?? group.items[0]?.costCenterId ?? '—'}
                                    </td>
                                    <td className="py-3 px-3 text-center">
                                      <span
                                        className={`inline-block min-w-20 px-2 py-0.5 rounded text-[10px] font-bold border ${
                                          isOcc
                                            ? 'border-amber-700 text-amber-200'
                                            : 'border-cyan-800 text-cyan-200'
                                        }`}
                                      >
                                        SINTÉTICA
                                      </span>
                                    </td>
                                    <td className="py-3 px-3 text-right font-mono text-[13px] tabular-nums text-slate-100">
                                      R$ {formatBRL(groupY1)}
                                    </td>
                                    <td className="py-3 px-3 text-right font-mono text-[13px] tabular-nums text-slate-100">
                                      R$ {formatBRL(groupY2)}
                                    </td>
                                    <td className="py-3 px-3 text-right font-mono text-[13px] tabular-nums font-bold text-emerald-400">
                                      R$ {formatBRL(group24)}
                                    </td>
                                  </tr>
                                )}
                                {(!hasMae || groupOpen) &&
                                  group.items.map((item, idx) => renderItem(item, idx, hasMae))}
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
