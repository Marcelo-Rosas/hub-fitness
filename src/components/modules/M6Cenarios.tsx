import React, { useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { GitCompare, Plus, Copy, AlertTriangle, CheckCircle, ArrowRightLeft, Sparkles } from 'lucide-react';
import { ModuleHeader } from '../ModuleHeader';
import { computeWmsProprioImpact } from '../../core/engine';
import { defaultParams } from '../../core/params';
import { OFFICIAL_TOTALS_24M } from '../../data/officialData';

export const M6Cenarios: React.FC = () => {
  const { scenarios, activeScenarioId, setActiveScenarioId, duplicateScenario } = usePlanner();

  const baseline = scenarios.find((s) => s.isBaseline) || scenarios[0];
  const pessimistic = scenarios.find((s) => s.id === 'sc-pessimistic') || scenarios[1] || scenarios[0];

  const deltaOccupancy = (pessimistic.occupancyRate - baseline.occupancyRate) * 100;
  const deltaLL = pessimistic.llM7Plus - baseline.llM7Plus;
  const deltaCash = pessimistic.m24Cash - baseline.m24Cash;

  const v36 = computeWmsProprioImpact(defaultParams);
  const v36LlDelta = v36.llM7Plus - baseline.llM7Plus;
  const v36CashDelta = v36.saldoM24CarenciaAluguel - baseline.m24Cash;

  // Sensitivity Tornado Chart Data
  const tornadoData = [
    { factor: 'Ocupação (±20%)', downside: -125000, upside: 145000 },
    { factor: 'Preço Armaz. Heavy (±15%)', downside: -68000, upside: 72000 },
    { factor: 'Aluguel Galpão A (±10%)', downside: -35000, upside: 38000 },
    { factor: 'Mix P5 Kitting (±10%)', downside: -42000, upside: 51000 },
    { factor: 'Prolabore / Fator R (±10%)', downside: -22000, upside: 24000 },
  ];

  return (
    <div className="space-y-6">
      {/* UNIFIED MODULE HEADER */}
      <ModuleHeader
        moduleId="M6"
        title="Matriz de Cenários & Análise Tornado"
        subtitle="Comparativo A/B de cenários (Otimista, Base, Estressado), cálculo de deltas operacionais e gráfico Tornado de sensibilidade."
        kpis={[
          {
            label: 'Cenários Ativos',
            value: `${scenarios.length} Modéis`,
            subtext: `Ativo: ${scenarios.find(s => s.id === activeScenarioId)?.name}`,
            badge: 'CENÁRIOS',
            highlightColor: 'indigo',
          },
          {
            label: 'Delta Ocupação (Pessimista)',
            value: `${deltaOccupancy.toFixed(0)}%`,
            subtext: `Comparado à base (${(baseline.occupancyRate * 100).toFixed(0)}%)`,
            badge: 'ESTRESSE',
            highlightColor: 'rose',
          },
          {
            label: 'Impacto Lucro M7+',
            value: `R$ ${(deltaLL / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`,
            subtext: 'Variação no lucro líquido estabilizado',
            badge: 'DELTA LL',
            highlightColor: 'amber',
          },
          {
            label: 'Delta Caixa M24',
            value: `R$ ${(deltaCash / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`,
            subtext: 'Diferença de saldo em 24 meses',
            badge: 'DELTA CAIXA',
            highlightColor: 'slate',
          },
        ]}
        actions={
          <button
            onClick={() => duplicateScenario(activeScenarioId)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicar Cenário</span>
          </button>
        }
      />

      {/* Comparison Table A/B */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Comparador A/B: Realista v3.5 vs Pessimista 35%</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Deltas (Δ) Recalculados em Tempo Real</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse font-mono">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-3 px-4 font-sans">Métrica de Impacto</th>
                <th className="py-3 px-4 text-right bg-emerald-50 text-emerald-900">Realista v3.5 (Oficial)</th>
                <th className="py-3 px-4 text-right bg-rose-50 text-rose-900">Pessimista 35% Ocupação</th>
                <th className="py-3 px-4 text-right font-bold">Variação Delta (Δ)</th>
                <th className="py-3 px-4 text-center">Status de Risco</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {/* Row 1: Ocupação */}
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-sans font-semibold text-slate-900">Taxa de Ocupação M7+</td>
                <td className="py-3 px-4 text-right font-bold text-emerald-800 bg-emerald-50/40">75%</td>
                <td className="py-3 px-4 text-right font-bold text-rose-800 bg-rose-50/40">35%</td>
                <td className="py-3 px-4 text-right font-black text-rose-600">
                  {deltaOccupancy.toFixed(0)} pp
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                    🔴 Crítico
                  </span>
                </td>
              </tr>

              {/* Row 2: LL M7+ */}
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-sans font-semibold text-slate-900">Lucro Líquido Mensal M7+</td>
                <td className="py-3 px-4 text-right font-bold text-emerald-800 bg-emerald-50/40">
                  R$ {baseline.llM7Plus.toLocaleString('pt-BR')}
                </td>
                <td className="py-3 px-4 text-right font-bold text-rose-800 bg-rose-50/40">
                  (R$ {Math.abs(pessimistic.llM7Plus).toLocaleString('pt-BR')})
                </td>
                <td className="py-3 px-4 text-right font-black text-rose-600">
                  (R$ {Math.abs(deltaLL).toLocaleString('pt-BR')})
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                    🔴 Deficit Operacional
                  </span>
                </td>
              </tr>

              {/* Row 3: Caixa M24 */}
              <tr className="hover:bg-slate-50">
                <td className="py-3 px-4 font-sans font-semibold text-slate-900">Caixa Final Acumulado M24</td>
                <td className="py-3 px-4 text-right font-bold text-emerald-800 bg-emerald-50/40">
                  R$ {baseline.m24Cash.toLocaleString('pt-BR')}
                </td>
                <td className="py-3 px-4 text-right font-bold text-rose-800 bg-rose-50/40">
                  R$ {pessimistic.m24Cash.toLocaleString('pt-BR')}
                </td>
                <td className="py-3 px-4 text-right font-black text-amber-600">
                  (R$ {Math.abs(deltaCash).toLocaleString('pt-BR')})
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                    🟡 Piso 150k Preservado
                  </span>
                </td>
              </tr>

              {/* Row 4: Mitigação Sugerida */}
              <tr className="bg-slate-50 font-sans">
                <td className="py-3 px-4 font-semibold text-slate-900">Plano de Mitigação Exigido</td>
                <td className="py-3 px-4 text-right text-slate-400">— (Operação Normal)</td>
                <td colSpan={2} className="py-3 px-4 text-amber-900 font-semibold text-xs leading-relaxed">
                  Sublocar 30% da área útil do Galpão A + Renegociar aluguel base com carência estendida.
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="px-2.5 py-1 bg-amber-200 text-amber-900 rounded font-bold text-[10px]">
                    🟡 Plano B Ativo
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-300" />
            <h3 className="text-xs font-bold uppercase tracking-wider">v3.5 oficial vs v3.6 WMS próprio + Logcomex</h3>
          </div>
          <span className="text-xs text-indigo-300 font-mono">DAS inalterado · CAPEX 207.300 (CCTV não cotado)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse font-mono">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-3 px-4 font-sans">Métrica</th>
                <th className="py-3 px-4 text-right">v3.5</th>
                <th className="py-3 px-4 text-right bg-indigo-50 text-indigo-900">v3.6 WMS próprio</th>
                <th className="py-3 px-4 text-right">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-3 px-4 font-sans font-semibold">OPEX Tech / mês</td>
                <td className="py-3 px-4 text-right">R$ 0</td>
                <td className="py-3 px-4 text-right bg-indigo-50/40 font-bold">R$ {v36.techOpexMonthly.toLocaleString('pt-BR')}</td>
                <td className="py-3 px-4 text-right text-rose-600">+R$ {v36.techOpexMonthly.toLocaleString('pt-BR')}</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-semibold">CAPEX</td>
                <td className="py-3 px-4 text-right">R$ {OFFICIAL_TOTALS_24M.capexInicial.toLocaleString('pt-BR')}</td>
                <td className="py-3 px-4 text-right bg-indigo-50/40 font-bold">R$ {v36.capexTotal.toLocaleString('pt-BR')}</td>
                <td className="py-3 px-4 text-right text-slate-500">R$ 0 (CCTV não cotado)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-semibold">Lucro líquido M7+</td>
                <td className="py-3 px-4 text-right">R$ {OFFICIAL_TOTALS_24M.llM7Plus.toLocaleString('pt-BR')}</td>
                <td className="py-3 px-4 text-right bg-indigo-50/40 font-bold">R$ {v36.llM7Plus.toLocaleString('pt-BR')}</td>
                <td className="py-3 px-4 text-right text-rose-600">(R$ {Math.abs(v36LlDelta).toLocaleString('pt-BR')})</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-semibold">Lucro 24m</td>
                <td className="py-3 px-4 text-right">R$ {OFFICIAL_TOTALS_24M.lucroLiquidoTotal.toLocaleString('pt-BR')}</td>
                <td className="py-3 px-4 text-right bg-indigo-50/40 font-bold">R$ {v36.lucro24m.toLocaleString('pt-BR')}</td>
                <td className="py-3 px-4 text-right text-rose-600">(R$ {v36.techOpex24m.toLocaleString('pt-BR')})</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-semibold">Caixa M24 (carência)</td>
                <td className="py-3 px-4 text-right">R$ {OFFICIAL_TOTALS_24M.saldoCaixaM24CarenciaAluguel.toLocaleString('pt-BR')}</td>
                <td className="py-3 px-4 text-right bg-indigo-50/40 font-bold">R$ {v36.saldoM24CarenciaAluguel.toLocaleString('pt-BR')}</td>
                <td className="py-3 px-4 text-right text-rose-600">(R$ {Math.abs(v36CashDelta).toLocaleString('pt-BR')})</td>
              </tr>
              <tr className="bg-slate-50 font-sans">
                <td className="py-3 px-4 font-semibold" colSpan={4}>
                  WMS software = R$ 0 (sweat equity). Logcomex + cloud são custo novo, aditivo. DAS continua 6% sobre receita. Não usar R$ 190.300 de CAPEX nem economia fiscal de 9% sobre OPEX.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Tornado Chart Section */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">🌪️ Gráfico Tornado: Sensibilidade Financeira no Lucro 24m</h3>
          <p className="text-xs text-slate-500">Mede o impacto individual de variações nas premissas principais do modelo v3.5</p>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={tornadoData} margin={{ top: 10, right: 30, left: 120, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="factor" tick={{ fontSize: 11, fill: '#334155' }} />
              <Tooltip formatter={(val: any) => `R$ ${Number(val).toLocaleString('pt-BR')}`} />
              <Bar dataKey="downside" name="Impacto Negativo" fill="#f43f5e" radius={[4, 0, 0, 4]} />
              <Bar dataKey="upside" name="Impacto Positivo" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
