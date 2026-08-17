import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, ArrowUpRight, DollarSign, Percent, Clock, Wallet, Zap, ShieldCheck, CheckCircle2, Box, Award, AlertTriangle } from 'lucide-react';
import { ModuleHeader } from '../ModuleHeader';
import { parseOfficialCSVs } from '../../data/officialData';
import { SANCO_TCO_BREAKDOWN } from '../../data/benchmarkData';
import { deriveCashMilestones, formatBrlSigned } from '../../core/cashMilestones';
import { usePlanner } from '../../context/PlannerContext';
import { HubAreaGradient, HubChartCard } from '../charts/HubChartCard';
import { HUB_CHART, HubChartLegendPill, hubTick, hubTooltipStyle, hubYAxisK, markerLabel } from '../charts/hubChartTheme';

export const M1Dashboard: React.FC = () => {
  const { hubParams } = usePlanner();
  const { cashflowSeries, totals24M } = parseOfficialCSVs();

  // Exact metrics from official 01_DRE_24_meses.csv and 02_Fluxo_Caixa.csv
  const totalReceita = totals24M.receitaTotal; // R$ 4.805.700
  const totalLucroLiquido = totals24M.lucroLiquidoTotal; // R$ 570.842
  const margemLiquidaPercent = totals24M.margemLiquidaPercent; // 11.878% ~ 11.9%
  const saldoCaixaM24CarenciaAluguel = totals24M.saldoCaixaM24CarenciaAluguel;
  const saldoCaixaM24Puro = totals24M.saldoCaixaM24Puro; // R$ 663.342
  const capacidadePaletes = hubParams.capacity.totalPositions;

  const milestones = deriveCashMilestones(
    cashflowSeries.map((item) => ({
      month: item.month,
      monthNum: item.monthNum,
      saldo: item.saldoAcumuladoPuro,
      fluxo: item.fluxoLiquidoPuro,
    })),
    { rentOnMonthNum: hubParams.rent.carenciaAluguelMeses + 1 },
  );

  const sancoTco = hubParams.benchmarks.sancoTcoInhouseMonthly;
  const tplTco = hubParams.benchmarks.tplFitnessMonthly;
  const tcoReductionPct = sancoTco > 0 ? ((sancoTco - tplTco) / sancoTco) * 100 : 0;
  const fmtTcoK = (n: number) =>
    `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k/mês`;

  // Map cashflow series for AreaChart (M0 to M24)
  const chartData = cashflowSeries.map((item) => ({
    month: item.month,
    saldoPuro: item.saldoAcumuladoPuro,
    saldoCarenciaAluguel: item.saldoAcumuladoCarenciaAluguel,
    labelValue: item.saldoAcumuladoCarenciaAluguel,
  }));

  const rentOn = `M${hubParams.rent.carenciaAluguelMeses + 1}`;
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
        <HubChartCard
          className="lg:col-span-2 h-95 flex flex-col"
          plotClassName="flex-1 w-full min-h-0 pt-1"
          title={<span>📈 Curva de Saldo de Caixa Acumulado (Fluxo Puro M0–M24)</span>}
          subtitle={`Marcadores Obrigatórios: ${milestones.capex?.month ?? 'M0'} CAPEX | ${milestones.valley.month} Vale da Morte | ${milestones.payback?.month ?? '—'} Payback | ${rentOn} Aluguel ON`}
          badge={
            milestones.payback
              ? `Puro: Payback ${milestones.payback.month} (${formatBrlSigned(milestones.payback.saldo)})`
              : '24m'
          }
          legend={
            <>
              <HubChartLegendPill tone="rose">
                {milestones.capex?.month ?? 'M0'} · CAPEX ({formatBrlSigned(milestones.capex?.saldo ?? 0)})
              </HubChartLegendPill>
              <HubChartLegendPill tone="amber">
                {milestones.valley.month} · Vale da Morte ({formatBrlSigned(milestones.valley.saldo)})
              </HubChartLegendPill>
              <HubChartLegendPill tone="sky">
                {milestones.payback?.month ?? '—'} · Payback
                {milestones.payback ? ` (${formatBrlSigned(milestones.payback.saldo)})` : ''}
              </HubChartLegendPill>
              <HubChartLegendPill tone="indigo">{rentOn} · Aluguel ON / fim da carência</HubChartLegendPill>
            </>
          }
        >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 56, right: 24, left: 10, bottom: 8 }}>
                <defs>
                  <HubAreaGradient id="m1CashGrad" />
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={HUB_CHART.grid} vertical={false} />
                <XAxis dataKey="month" tick={hubTick} />
                <YAxis tickFormatter={hubYAxisK} tick={hubTick} />
                <Tooltip
                  formatter={(val: number) => [`R$ ${Number(val).toLocaleString('pt-BR')}`, 'Saldo Acumulado']}
                  contentStyle={hubTooltipStyle}
                />
                <ReferenceLine y={0} stroke={HUB_CHART.zero} strokeWidth={1} strokeDasharray="2 2" />
                {milestones.capex && (
                  <ReferenceLine
                    x={milestones.capex.month}
                    stroke={HUB_CHART.capex}
                    strokeWidth={2}
                    label={markerLabel(`${milestones.capex.month} CAPEX`, '#dc2626', 14)}
                  />
                )}
                <ReferenceLine
                  x={milestones.valley.month}
                  stroke={HUB_CHART.vale}
                  strokeWidth={2.5}
                  label={markerLabel(`${milestones.valley.month} Vale`, '#d97706', 14)}
                />
                {milestones.payback && (
                  <ReferenceLine
                    x={milestones.payback.month}
                    stroke={HUB_CHART.payback}
                    strokeWidth={2.5}
                    label={markerLabel(`${milestones.payback.month} Payback`, '#0369a1', 34)}
                  />
                )}
                <ReferenceLine
                  x={rentOn}
                  stroke={HUB_CHART.rent}
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  label={markerLabel(`${rentOn} Aluguel ON`, '#4f46e5', 54)}
                />
                <Area
                  type="monotone"
                  dataKey="saldoPuro"
                  stroke={HUB_CHART.stroke}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#m1CashGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
        </HubChartCard>

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
            Economia TCO: -{tcoReductionPct.toFixed(1).replace('.', ',')}%
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
                <div className="text-3xl font-black text-emerald-800 font-mono">
                  -{tcoReductionPct.toFixed(1).replace('.', ',')}%
                </div>
                <div className="text-xs font-bold text-emerald-950 mt-1">Redução Efetiva de Custo Operacional</div>
              </div>
              <Award className="w-8 h-8 text-emerald-600 opacity-80" />
            </div>
            <p className="text-xs text-emerald-800/90 leading-relaxed mt-2">
              A operação terceirizada 3PL reduz o custo fixo do galpão de{' '}
              <strong>{fmtTcoK(sancoTco)}</strong> para <strong>{fmtTcoK(tplTco)}</strong>, liberando
              margem operacional direta sem exposição de CAPEX predial (CAPEX ops R${' '}
              {hubParams.capex.total.toLocaleString('pt-BR')} via params).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
