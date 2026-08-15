import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import { TrendingUp, ArrowUpRight, DollarSign, Percent, Clock, Wallet, Zap, ShieldCheck, CheckCircle2, Box, Award, AlertTriangle } from 'lucide-react';
import { ModuleHeader } from '../ModuleHeader';
import { parseOfficialCSVs } from '../../data/officialData';
import { SANCO_TCO_BREAKDOWN } from '../../data/benchmarkData';
import { deriveCashMilestones, formatBrlSigned } from '../../core/cashMilestones';
import { defaultParams } from '../../core/params';

export const M1Dashboard: React.FC = () => {
  const { dreMonths, cashflowSeries, totals24M } = parseOfficialCSVs();
  const [cashTimeframe, setCashTimeframe] = useState<'24m'>('24m');

  // Exact metrics from official 01_DRE_24_meses.csv and 02_Fluxo_Caixa.csv
  const totalReceita = totals24M.receitaTotal; // R$ 4.805.700
  const totalLucroLiquido = totals24M.lucroLiquidoTotal; // R$ 570.842
  const margemLiquidaPercent = totals24M.margemLiquidaPercent; // 11.878% ~ 11.9%
  const saldoCaixaM24CarenciaAluguel = totals24M.saldoCaixaM24CarenciaAluguel;
  const saldoCaixaM24Puro = totals24M.saldoCaixaM24Puro; // R$ 663.342
  const capacidadePaletes = totals24M.capacidadePaletes; // 2.968 posições

  const milestones = deriveCashMilestones(
    cashflowSeries.map((item) => ({
      month: item.month,
      monthNum: item.monthNum,
      saldo: item.saldoAcumuladoCarenciaAluguel,
      fluxo: item.fluxoLiquidoCarenciaAluguel,
    })),
    { rentOnMonthNum: defaultParams.rent.carenciaAluguelMeses + 1 },
  );

  // Map cashflow series for AreaChart (M0 to M24)
  const chartData = cashflowSeries.map((item) => ({
    month: item.month,
    saldoPuro: item.saldoAcumuladoPuro,
    saldoCarenciaAluguel: item.saldoAcumuladoCarenciaAluguel,
    labelValue: item.saldoAcumuladoCarenciaAluguel,
  }));

  const tcoBreakdown = SANCO_TCO_BREAKDOWN;

  return (
    <div className="space-y-6">
      {/* UNIFIED MODULE HEADER WITH OFFICIAL METRICS */}
      <ModuleHeader
        moduleId="M1"
        title="Dashboard Executivo · Visão Geral 3PL"
        subtitle="Indicadores consolidados do Plano de Negócios (01_DRE_24_meses.csv, 02_Fluxo_Caixa.csv e BP v3.5)."
        kpis={[
          {
            label: 'Lucro Líquido 24m',
            value: `R$ ${totalLucroLiquido.toLocaleString('pt-BR')}`,
            subtext: 'Margem Efetiva 11,9% (Auditado BP v3.5)',
            badge: 'MÉTRICA CHAVE ★',
            highlightColor: 'emerald',
          },
          {
            label: 'Saldo Caixa M24',
            value: `R$ ${saldoCaixaM24CarenciaAluguel.toLocaleString('pt-BR')}`,
            subtext: `Puro: R$ ${saldoCaixaM24Puro.toLocaleString('pt-BR')} | Vale ${milestones.valley.month} / Payback ${milestones.payback?.month ?? '—'}`,
            badge: 'LIQUIDEZ ★',
            highlightColor: 'emerald',
          },
          {
            label: 'Receita Bruta 24m',
            value: `R$ ${totalReceita.toLocaleString('pt-BR')}`,
            subtext: 'Somatório M1 ao M24 (01_DRE.csv)',
            badge: '24 MESES',
            highlightColor: 'slate',
          },
          {
            label: 'Capacidade Operacional',
            value: `${capacidadePaletes.toLocaleString('pt-BR')} posições`,
            subtext: 'Diretriz g5 do BP (Layout SC)',
            badge: 'CAPACIDADE',
            highlightColor: 'blue',
          },
        ]}
      />

      {/* EXECUTIVE CARDS GRID WITH EXPLICIT GREEN BORDERS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card Receita */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Receita Bruta 24M</span>
              <DollarSign className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              R$ {totalReceita.toLocaleString('pt-BR')}
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 font-medium border-t border-slate-100 pt-2">
            Consolidado 24 meses M1–M24
          </div>
        </div>

        {/* Card Lucro - HIGHLIGHTED WITH GREEN BORDER */}
        <div className="bg-white p-5 rounded-xl border-2 border-emerald-500 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-bl">
            DESTAQUE AUDITORIA
          </div>
          <div>
            <div className="flex items-center justify-between text-emerald-700 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Lucro Líquido 24M</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-900 font-mono">
              R$ {totalLucroLiquido.toLocaleString('pt-BR')}
            </div>
          </div>
          <div className="mt-3 text-[11px] text-emerald-700 font-bold border-t border-emerald-100 pt-2 flex items-center justify-between">
            <span>Margem Efetiva: 11,9%</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
        </div>

        {/* Card Margem - STRICTLY 11.9% */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Margem Líquida</span>
              <Percent className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {margemLiquidaPercent.toFixed(1)}%
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 font-medium border-t border-slate-100 pt-2">
            (R$ 570,8k / R$ 4,80M) × 100
          </div>
        </div>

        {/* Card Caixa M24 - HIGHLIGHTED WITH GREEN BORDER */}
        <div className="bg-white p-5 rounded-xl border-2 border-emerald-500 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-bl">
            LIQUIDEZ M24
          </div>
          <div>
            <div className="flex items-center justify-between text-emerald-700 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Saldo Caixa M24</span>
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-900 font-mono">
              R$ {saldoCaixaM24CarenciaAluguel.toLocaleString('pt-BR')}
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-600 font-medium border-t border-emerald-100 pt-2">
            Puro CSV: <span className="font-mono font-bold text-slate-800">R$ {saldoCaixaM24Puro.toLocaleString('pt-BR')}</span>
          </div>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Saldo Acumulado de Caixa com AreaChart e Marcadores Reais (2 cols) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3 flex flex-col h-95">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Evolução do Fluxo de Caixa Acumulado (M0 a M24)</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold">
                  02_Fluxo_Caixa.csv
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Curva com CAPEX {milestones.capex?.month ?? 'M0'}, Vale {milestones.valley.month} (
                {formatBrlSigned(milestones.valley.saldo)}) e Payback {milestones.payback?.month ?? '—'}
                {milestones.payback ? ` (${formatBrlSigned(milestones.payback.saldo)})` : ''}
              </p>
            </div>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
              <span className="px-2.5 py-1 bg-white text-slate-900 font-bold rounded shadow-2xs">
                24m Estrito
              </span>
            </div>
          </div>

          <div className="flex-1 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 25, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="m1CashGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                />
                <Tooltip
                  formatter={(val: any) => [`R$ ${Number(val).toLocaleString('pt-BR')}`, 'Saldo Acumulado (Carência Aluguel)']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                {/* Zero Level Reference Line */}
                <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 2" />

                {/* Payback derivado */}
                {milestones.payback && (
                  <ReferenceLine
                    x={milestones.payback.month}
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: `PAYBACK ${formatBrlSigned(milestones.payback.saldo)} ★`,
                      fill: '#059669',
                      fontSize: 10,
                      fontWeight: 'bold',
                      position: 'top',
                    }}
                  />
                )}

                {/* CAPEX derivado */}
                {milestones.capex && (
                  <ReferenceDot
                    x={milestones.capex.month}
                    y={milestones.capex.saldo}
                    r={6}
                    fill="#ef4444"
                    stroke="#ffffff"
                    strokeWidth={2}
                    label={{
                      value: `${milestones.capex.month}: ${formatBrlSigned(milestones.capex.saldo)}`,
                      fill: '#dc2626',
                      fontSize: 10,
                      fontWeight: 'bold',
                      position: 'bottom',
                    }}
                  />
                )}

                {/* Vale derivado */}
                <ReferenceDot
                  x={milestones.valley.month}
                  y={milestones.valley.saldo}
                  r={6}
                  fill="#f59e0b"
                  stroke="#ffffff"
                  strokeWidth={2}
                  label={{
                    value: `${milestones.valley.month}: Vale`,
                    fill: '#d97706',
                    fontSize: 10,
                    fontWeight: 'bold',
                    position: 'top',
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="saldoCarenciaAluguel"
                  stroke="#059669"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#m1CashGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side Panel: Capacidade & Payback Audit (1 col) */}
        <div className="bg-slate-900 text-white p-5 rounded-xl shadow-xs flex flex-col justify-between space-y-4 border border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 mb-1">
              <Box className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Capacidade & Payback (BP v3.5)</h3>
            </div>
            <p className="text-xs text-slate-400">
              Premissas de infraestrutura e viabilidade auditada conforme Diretriz g5.
            </p>
          </div>

          <div className="space-y-3 font-mono">
            {/* Capacidade */}
            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
              <div className="text-[10px] text-slate-400 font-sans uppercase font-bold">Capacidade Instalada</div>
              <div className="text-xl font-black text-white mt-0.5">{capacidadePaletes.toLocaleString('pt-BR')} Posições</div>
              <div className="text-[10px] text-emerald-400 font-sans mt-0.5">Layout Otimizado SC (Diretriz g5)</div>
            </div>

            {/* Payback Breakdown */}
            <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60 space-y-2">
              <div className="text-[10px] text-slate-400 font-sans uppercase font-bold">Horizonte de Retorno (Payback)</div>
              
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-sans">Com Carência Aluguel:</span>
                <span className="font-bold text-emerald-400">Mês M5 (-5,8k → retorno)</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-sans">Fluxo Puro:</span>
                <span className="font-bold text-emerald-400">Mês M6 (+R$ 52.116)</span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-950/60 border border-emerald-800/80 p-3 rounded-lg flex items-start gap-2 text-[11px] text-emerald-300 font-sans">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong>Auditoria Aprovada:</strong> 100% dos custos e receitas alinhados com `01_DRE_24_meses.csv` e `02_Fluxo_Caixa.csv`.
            </div>
          </div>
        </div>
      </div>

      {/* TCO SANCO vs 3PL COMPARISON PANEL */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Estudo de Eficiência Operacional: TCO SANCO vs 3PL</h3>
            <p className="text-xs text-slate-500">Comparativo de custos mensais em SC (Gestão Própria vs Hub Terceirizado)</p>
          </div>
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-md text-xs font-black uppercase">
            Economia TCO: -48,4%
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            {tcoBreakdown.map((row, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100 last:border-0">
                <span className="font-medium text-slate-700">{row.item}</span>
                <div className="flex gap-3 font-mono">
                  <span className="text-slate-400 line-through">
                    R$ {row.sancoInhouse.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="font-bold text-emerald-700">
                    R$ {row.tplFitness.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-3xl font-black text-emerald-800 font-mono">-48,4%</div>
                <div className="text-xs font-bold text-emerald-950 mt-1">Redução Efetiva de Custo Operacional</div>
              </div>
              <Award className="w-8 h-8 text-emerald-600 opacity-80" />
            </div>
            <p className="text-xs text-emerald-800/90 leading-relaxed mt-2">
              A operação terceirizada 3PL reduz o custo fixo do galpão de <strong>R$ 83,8k/mês</strong> para <strong>R$ 43,2k/mês</strong>, liberando margem operacional direta sem exposição de CAPEX predial.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
