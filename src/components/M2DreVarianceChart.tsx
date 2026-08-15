import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from 'recharts';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../data/initialData';
import { DreGranularItem, Scenario } from '../types';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Layers,
  Sparkles,
  GitCompare,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface M2DreVarianceChartProps {
  granularDreItems: DreGranularItem[];
  activeScenario: Scenario;
}

export const M2DreVarianceChart: React.FC<M2DreVarianceChartProps> = ({
  granularDreItems,
  activeScenario,
}) => {
  const [chartTab, setChartTab] = useState<'comparison' | 'monthly' | 'itemBreakdown'>('comparison');

  // Occupancy factor
  const occFactor = activeScenario.occupancyRate / 0.75;

  // --- 1. BASELINE CALCULATIONS ---
  const baselineActiveReceitasY1 = INITIAL_GRANULAR_DRE_ITEMS
    .filter((i) => i.active && i.section === 'receita')
    .reduce((a, b) => a + b.monthlyAmountY1, 0);
  const baselineActiveReceitasY2 = INITIAL_GRANULAR_DRE_ITEMS
    .filter((i) => i.active && i.section === 'receita')
    .reduce((a, b) => a + b.monthlyAmountY2, 0);

  const baselineActiveCustosY1 = INITIAL_GRANULAR_DRE_ITEMS
    .filter((i) => i.active && i.section === 'custo')
    .reduce((a, b) => a + b.monthlyAmountY1, 0);
  const baselineActiveCustosY2 = INITIAL_GRANULAR_DRE_ITEMS
    .filter((i) => i.active && i.section === 'custo')
    .reduce((a, b) => a + b.monthlyAmountY2, 0);

  const baselineActiveDespesasY1 = INITIAL_GRANULAR_DRE_ITEMS
    .filter((i) => i.active && i.section === 'despesa')
    .reduce((a, b) => a + b.monthlyAmountY1, 0);
  const baselineActiveDespesasY2 = INITIAL_GRANULAR_DRE_ITEMS
    .filter((i) => i.active && i.section === 'despesa')
    .reduce((a, b) => a + b.monthlyAmountY2, 0);

  // Annualized Baseline
  const baselineRev24m = (baselineActiveReceitasY1 + baselineActiveReceitasY2) * 12;
  const baselineCustos24m = (baselineActiveCustosY1 + baselineActiveCustosY2) * 12;
  const baselineDespesas24m = (baselineActiveDespesasY1 + baselineActiveDespesasY2) * 12;
  const baselineLucro24m = baselineRev24m * 0.94 - (baselineCustos24m + baselineDespesas24m);

  // --- 2. CURRENT MODIFIED CALCULATIONS ---
  const currentActiveReceitasY1 = granularDreItems
    .filter((i) => i.active && i.section === 'receita')
    .reduce((a, b) => a + b.monthlyAmountY1, 0);
  const currentActiveReceitasY2 = granularDreItems
    .filter((i) => i.active && i.section === 'receita')
    .reduce((a, b) => a + b.monthlyAmountY2, 0);

  const currentActiveCustosY1 = granularDreItems
    .filter((i) => i.active && i.section === 'custo')
    .reduce((a, b) => a + b.monthlyAmountY1, 0);
  const currentActiveCustosY2 = granularDreItems
    .filter((i) => i.active && i.section === 'custo')
    .reduce((a, b) => a + b.monthlyAmountY2, 0);

  const currentActiveDespesasY1 = granularDreItems
    .filter((i) => i.active && i.section === 'despesa')
    .reduce((a, b) => a + b.monthlyAmountY1, 0);
  const currentActiveDespesasY2 = granularDreItems
    .filter((i) => i.active && i.section === 'despesa')
    .reduce((a, b) => a + b.monthlyAmountY2, 0);

  // Annualized Current (incorporating occupancy)
  const currentRev24m = Math.round((currentActiveReceitasY1 + currentActiveReceitasY2) * 12 * occFactor);
  const currentCustos24m = Math.round((currentActiveCustosY1 + currentActiveCustosY2) * 12 * occFactor);
  const currentDespesas24m = Math.round((currentActiveDespesasY1 + currentActiveDespesasY2) * 12);
  const currentLucro24m = currentRev24m * 0.94 - (currentCustos24m + currentDespesas24m);

  // --- 3. VARIANCE DELTAS ---
  const revDiff = currentRev24m - baselineRev24m;
  const revPct = baselineRev24m > 0 ? (revDiff / baselineRev24m) * 100 : 0;

  const custosDiff = currentCustos24m - baselineCustos24m;
  const custosPct = baselineCustos24m > 0 ? (custosDiff / baselineCustos24m) * 100 : 0;

  const despesasDiff = currentDespesas24m - baselineDespesas24m;
  const despesasPct = baselineDespesas24m > 0 ? (despesasDiff / baselineDespesas24m) * 100 : 0;

  const lucroDiff = currentLucro24m - baselineLucro24m;
  const lucroPct = baselineLucro24m > 0 ? (lucroDiff / Math.abs(baselineLucro24m)) * 100 : 0;

  // --- 4. DATASETS FOR RECHARTS ---
  // Bar chart dataset by category & year
  const sectionComparisonData = [
    {
      name: 'Receita Y1',
      Baseline: baselineActiveReceitasY1 * 12,
      Modificado: Math.round(currentActiveReceitasY1 * 12 * occFactor),
    },
    {
      name: 'Receita Y2',
      Baseline: baselineActiveReceitasY2 * 12,
      Modificado: Math.round(currentActiveReceitasY2 * 12 * occFactor),
    },
    {
      name: 'COGS/Custos Y1',
      Baseline: baselineActiveCustosY1 * 12,
      Modificado: Math.round(currentActiveCustosY1 * 12 * occFactor),
    },
    {
      name: 'COGS/Custos Y2',
      Baseline: baselineActiveCustosY2 * 12,
      Modificado: Math.round(currentActiveCustosY2 * 12 * occFactor),
    },
    {
      name: 'OPEX/Despesas Y1',
      Baseline: baselineActiveDespesasY1 * 12,
      Modificado: currentActiveDespesasY1 * 12,
    },
    {
      name: 'OPEX/Despesas Y2',
      Baseline: baselineActiveDespesasY2 * 12,
      Modificado: currentActiveDespesasY2 * 12,
    },
  ];

  // 24-Month Monthly Trend Dataset
  const monthlyTrendData = [];
  for (let m = 1; m <= 24; m++) {
    const isY1 = m <= 12;
    let baseRevM = isY1 ? baselineActiveReceitasY1 : baselineActiveReceitasY2;
    let currRevM = isY1 ? currentActiveReceitasY1 : currentActiveReceitasY2;

    if (m <= 6) {
      baseRevM = baseRevM * (0.6 + 0.4 * (m / 6));
      currRevM = currRevM * (0.6 + 0.4 * (m / 6)) * occFactor;
    } else {
      currRevM = currRevM * occFactor;
    }

    let baseExpM = (isY1 ? baselineActiveCustosY1 : baselineActiveCustosY2) + (isY1 ? baselineActiveDespesasY1 : baselineActiveDespesasY2);
    let currExpM = (isY1 ? currentActiveCustosY1 : currentActiveCustosY2) * occFactor + (isY1 ? currentActiveDespesasY1 : currentActiveDespesasY2);

    monthlyTrendData.push({
      month: `M${m}`,
      'Receita Baseline': Math.round(baseRevM),
      'Receita Modificada': Math.round(currRevM),
      'Custos Baseline': Math.round(baseExpM),
      'Custos Modificados': Math.round(currExpM),
      'Delta Lucro': Math.round(currRevM - currExpM - (baseRevM - baseExpM)),
    });
  }

  // Find items modified or added by user
  const modifiedItemsList = granularDreItems.map((item) => {
    const baselineItem = INITIAL_GRANULAR_DRE_ITEMS.find((b) => b.id === item.id);
    if (!baselineItem) {
      return {
        ...item,
        status: 'Novo Item Adicionado',
        varY1: item.monthlyAmountY1,
      };
    }
    const diffY1 = item.monthlyAmountY1 - baselineItem.monthlyAmountY1;
    const isStatusChanged = item.active !== baselineItem.active;
    return {
      ...item,
      status: isStatusChanged
        ? item.active
          ? 'Reativado pelo Usuário'
          : 'Desativado pelo Usuário'
        : diffY1 > 0
        ? `Aumento +R$ ${diffY1.toLocaleString('pt-BR')}/mês`
        : diffY1 < 0
        ? `Redução -R$ ${Math.abs(diffY1).toLocaleString('pt-BR')}/mês`
        : 'Inalterado em relação ao Baseline',
      varY1: diffY1,
      isChanged: diffY1 !== 0 || isStatusChanged,
    };
  });

  const changedItemsOnly = modifiedItemsList.filter((i) => i.isChanged || !INITIAL_GRANULAR_DRE_ITEMS.some((b) => b.id === i.id));

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5">
      {/* HEADER & SWITCHER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <GitCompare className="w-3 h-3 text-amber-700" /> Análise de Variância (Baseline vs Modificado)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">3PL Logistics Planner</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">
            Gráfico de Desvio e Variância Orçamentária
          </h2>
          <p className="text-xs text-slate-500">
            Comparação em tempo real entre as premissas originais do Plano de Negócios e as edições granulares ativas.
          </p>
        </div>

        {/* View mode tabs */}
        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs font-bold border border-slate-200">
          <button
            onClick={() => setChartTab('comparison')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              chartTab === 'comparison'
                ? 'bg-[#1F3864] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Barras por Seção</span>
          </button>

          <button
            onClick={() => setChartTab('monthly')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              chartTab === 'monthly'
                ? 'bg-[#1F3864] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Tendência Mensal 24m</span>
          </button>

          <button
            onClick={() => setChartTab('itemBreakdown')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              chartTab === 'itemBreakdown'
                ? 'bg-[#1F3864] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Alterações ({changedItemsOnly.length})</span>
          </button>
        </div>
      </div>

      {/* VARIANCE SUMMARY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Receita Card */}
        <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl flex flex-col justify-between">
          <div className="text-[11px] font-bold text-emerald-900 flex items-center justify-between">
            <span>Variância em Receita (24m)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 font-mono text-lg font-black text-emerald-950">
            {revDiff >= 0 ? '+' : ''}R$ {revDiff.toLocaleString('pt-BR')}
          </div>
          <div className="text-[10px] mt-1 font-semibold flex items-center gap-1">
            <span
              className={`px-1.5 py-0.5 rounded ${
                revDiff >= 0 ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
              }`}
            >
              {revPct >= 0 ? '+' : ''}
              {revPct.toFixed(1)}% vs Baseline
            </span>
            <span className="text-slate-500 font-sans">
              (Modificado: R$ {(currentRev24m / 1000000).toFixed(2)}M)
            </span>
          </div>
        </div>

        {/* Custos / COGS Card */}
        <div className="bg-orange-50/70 border border-orange-200 p-3.5 rounded-xl flex flex-col justify-between">
          <div className="text-[11px] font-bold text-orange-900 flex items-center justify-between">
            <span>Variância em COGS/Custos (24m)</span>
            <TrendingDown className="w-4 h-4 text-orange-600" />
          </div>
          <div className="mt-2 font-mono text-lg font-black text-orange-950">
            {custosDiff >= 0 ? '+' : ''}R$ {custosDiff.toLocaleString('pt-BR')}
          </div>
          <div className="text-[10px] mt-1 font-semibold flex items-center gap-1">
            <span
              className={`px-1.5 py-0.5 rounded ${
                custosDiff <= 0 ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
              }`}
            >
              {custosPct >= 0 ? '+' : ''}
              {custosPct.toFixed(1)}% vs Baseline
            </span>
            <span className="text-slate-500 font-sans">
              (Modificado: R$ {(currentCustos24m / 1000000).toFixed(2)}M)
            </span>
          </div>
        </div>

        {/* OPEX / Despesas Card */}
        <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-xl flex flex-col justify-between">
          <div className="text-[11px] font-bold text-blue-900 flex items-center justify-between">
            <span>Variância em OPEX/Despesas (24m)</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 font-mono text-lg font-black text-blue-950">
            {despesasDiff >= 0 ? '+' : ''}R$ {despesasDiff.toLocaleString('pt-BR')}
          </div>
          <div className="text-[10px] mt-1 font-semibold flex items-center gap-1">
            <span
              className={`px-1.5 py-0.5 rounded ${
                despesasDiff <= 0 ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
              }`}
            >
              {despesasPct >= 0 ? '+' : ''}
              {despesasPct.toFixed(1)}% vs Baseline
            </span>
            <span className="text-slate-500 font-sans">
              (Modificado: R$ {(currentDespesas24m / 1000000).toFixed(2)}M)
            </span>
          </div>
        </div>

        {/* Impacto no Lucro Líquido Card */}
        <div
          className={`p-3.5 rounded-xl border flex flex-col justify-between ${
            lucroDiff >= 0
              ? 'bg-emerald-100/60 border-emerald-300 text-emerald-950'
              : 'bg-rose-100/60 border-rose-300 text-rose-950'
          }`}
        >
          <div className="text-[11px] font-bold flex items-center justify-between">
            <span>Impacto no Lucro Líquido (24m)</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="mt-2 font-mono text-lg font-black">
            {lucroDiff >= 0 ? '+' : ''}R$ {Math.round(lucroDiff).toLocaleString('pt-BR')}
          </div>
          <div className="text-[10px] mt-1 font-semibold flex items-center gap-1">
            <span
              className={`px-1.5 py-0.5 rounded font-bold ${
                lucroDiff >= 0 ? 'bg-emerald-300 text-emerald-950' : 'bg-rose-300 text-rose-950'
              }`}
            >
              {lucroPct >= 0 ? '+' : ''}
              {lucroPct.toFixed(1)}% no Resultado
            </span>
            <span className="opacity-80 font-sans">
              (Atual: R$ {(currentLucro24m / 1000000).toFixed(2)}M)
            </span>
          </div>
        </div>
      </div>

      {/* CHART CONTENT AREA */}
      {chartTab === 'comparison' && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Projeção Financeira Anualizada: Baseline Oficial vs Valores Modificados</span>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-slate-400 rounded"></div> Baseline
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 bg-[#1F3864] rounded"></div> Valores Atualizados
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectionComparisonData} margin={{ top: 10, right: 20, left: 20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#475569' }}
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
                  contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }} />
                <Bar dataKey="Baseline" fill="#94A3B8" radius={[4, 4, 0, 0]} name="Baseline Inicial (Oficial)" />
                <Bar dataKey="Modificado" fill="#1F3864" radius={[4, 4, 0, 0]} name="Atualmente Modificado pelo Usuário" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {chartTab === 'monthly' && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Curva de Evolução Mensal M1 a M24: Receita e Custos (Baseline x Modificado)</span>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrendData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#475569' }}
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, '']}
                  contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }} />
                <Line type="monotone" dataKey="Receita Baseline" stroke="#94A3B8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="Receita Modificada" stroke="#10B981" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Custos Baseline" stroke="#CBD5E1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="Custos Modificados" stroke="#EF4444" strokeWidth={2.5} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {chartTab === 'itemBreakdown' && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Itens com Alteração Registrada em Relação ao Baseline ({changedItemsOnly.length} alterações)</span>
          </div>

          {changedItemsOnly.length === 0 ? (
            <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              Nenhum item foi modificado em relação ao Baseline oficial. Todos os valores correspondem ao plano de negócios inicial.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Seção</th>
                    <th className="py-2.5 px-3">Item DRE Granular</th>
                    <th className="py-2.5 px-3 font-mono text-right">Valor Atual Y1</th>
                    <th className="py-2.5 px-3">Observação / Impacto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {changedItemsOnly.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-bold">
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[10px]">
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 uppercase text-[10px] font-bold">
                        {item.section}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{item.name}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-right text-slate-900">
                        R$ {item.monthlyAmountY1.toLocaleString('pt-BR')}/mês
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-500">{item.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
