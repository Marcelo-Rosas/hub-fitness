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
} from 'recharts';
import { ShieldCheck } from 'lucide-react';
import { ModuleHeader } from '../ModuleHeader';
import { parseOfficialCSVs, OFFICIAL_TOTALS_24M } from '../../data/officialData';
import { deriveCashMilestones, formatBrlSigned } from '../../core/cashMilestones';
import { defaultParams } from '../../core/params';
import { HubAreaGradient, HubChartCard } from '../charts/HubChartCard';
import { HUB_CHART, HubChartLegendPill, hubTick, hubTooltipStyle, hubYAxisK, markerLabel } from '../charts/hubChartTheme';

export const M4Caixa: React.FC = () => {
  const { cashflowSeries } = parseOfficialCSVs();
  const [flowType, setFlowType] = useState<'puro' | 'carenciaAluguel'>('puro');

  const chartData = cashflowSeries.map((c) => ({
    month: c.month,
    monthNum: c.monthNum,
    saldoPuro: c.saldoAcumuladoPuro,
    saldoCarenciaAluguel: c.saldoAcumuladoCarenciaAluguel,
    selectedSaldo:
      flowType === 'puro' ? c.saldoAcumuladoPuro : c.saldoAcumuladoCarenciaAluguel,
  }));

  const milestones = deriveCashMilestones(
    cashflowSeries.map((c) => ({
      month: c.month,
      monthNum: c.monthNum,
      saldo: flowType === 'puro' ? c.saldoAcumuladoPuro : c.saldoAcumuladoCarenciaAluguel,
      fluxo: flowType === 'puro' ? c.fluxoLiquidoPuro : c.fluxoLiquidoCarenciaAluguel,
    })),
    { rentOnMonthNum: defaultParams.rent.carenciaAluguelMeses + 1 },
  );

  const capex = defaultParams.capex.total;
  const m24FinalCash =
    flowType === 'puro'
      ? OFFICIAL_TOTALS_24M.saldoCaixaM24Puro
      : OFFICIAL_TOTALS_24M.saldoCaixaM24CarenciaAluguel;
  const rentOn = `M${defaultParams.rent.carenciaAluguelMeses + 1}`;

  return (
    <div className="space-y-6">
      {/* UNIFIED MODULE HEADER */}
      <ModuleHeader
        moduleId="M4"
        title="Fluxo de Caixa & Milestones Financeiros (24M)"
        subtitle="Linha do tempo M0–M24 com Vale e Payback derivados da série (não hardcoded)."
        kpis={[
          {
            label: 'CAPEX Inicial (M0)',
            value: `R$ ${capex.toLocaleString('pt-BR')}`,
            subtext: 'Investimento inicial 100% autofinanciado',
            badge: 'INVESTIMENTO',
            highlightColor: 'amber',
          },
          {
            label: `Saldo Final M24 (${flowType === 'puro' ? 'Puro' : 'Carência Aluguel'})`,
            value: `R$ ${m24FinalCash.toLocaleString('pt-BR')}`,
            subtext: flowType === 'puro' ? 'Base 02_Fluxo_Caixa.csv Puro' : 'Com benefício de carência predial',
            badge: 'SALDO M24',
            highlightColor: 'emerald',
          },
          {
            label: 'Ponto de Virada (Payback)',
            value: milestones.payback
              ? `${milestones.payback.month} (${formatBrlSigned(milestones.payback.saldo)})`
              : '—',
            subtext: flowType === 'puro' ? 'Fluxo Operacional Puro' : 'Com Carência M1–M6',
            badge: 'PAYBACK ★',
            highlightColor: 'indigo',
          },
          {
            label: `Vale da Morte (${milestones.valley.month})`,
            value: formatBrlSigned(milestones.valley.saldo),
            subtext: 'Menor caixa acumulado na série selecionada',
            badge: 'PONTO MÍNIMO',
            highlightColor: 'rose',
          },
        ]}
      />

      {/* STRATEGIC TOGGLE & AUDIT BANNER */}
      <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Alinhamento com 02_Fluxo_Caixa.csv & BP v3.5
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Escolha a projeção para alternar o realce do Payback no gráfico:
            </p>
          </div>
        </div>

        {/* TOGGLE BUTTONS */}
        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold">
          <button
            onClick={() => setFlowType('puro')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              flowType === 'puro'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            [ Fluxo Puro (Payback M6) ]
          </button>
          <button
            onClick={() => setFlowType('carenciaAluguel')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
              flowType === 'carenciaAluguel'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            [ Com Carência Aluguel (Payback M5) ]
          </button>
        </div>
      </div>

      <HubChartCard
        title={
          <span>
            📈 Curva de Saldo de Caixa Acumulado ({flowType === 'puro' ? 'Fluxo Puro M0–M24' : 'Com Carência M1–M6'})
          </span>
        }
        subtitle="Marcadores Obrigatórios: M0 CAPEX | M5 Vale da Morte | M6 Payback Puro | M7 Aluguel ON"
        badge={flowType === 'puro' ? 'Puro: Payback M6 (+R$ 52,1k)' : 'Carência Aluguel: Payback M5 (-R$ 5,8k)'}
        legend={
          <>
            <HubChartLegendPill tone="rose">
              {milestones.capex?.month ?? 'M0'} · CAPEX ({formatBrlSigned(milestones.capex?.saldo ?? -capex)})
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
                <HubAreaGradient id="m4CashGrad" />
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
                dataKey="selectedSaldo"
                stroke={HUB_CHART.stroke}
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#m4CashGrad)"
              />
            </AreaChart>
        </ResponsiveContainer>
      </HubChartCard>

      {/* MILESTONES SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            {milestones.capex?.month ?? 'M0'} · CAPEX Inicial
          </div>
          <div className="text-xl font-black text-rose-600 font-mono mt-1">
            −R$ {capex.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Investimento em WMS, porta-paletes e infraestrutura</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            {milestones.valley.month} · Vale da Morte
          </div>
          <div className="text-xl font-black text-amber-600 font-mono mt-1">
            {formatBrlSigned(milestones.valley.saldo)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Menor exposição de caixa na série</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            {milestones.payback?.month ?? '—'} · Payback
          </div>
          <div className="text-xl font-black text-emerald-600 font-mono mt-1">
            {milestones.payback ? formatBrlSigned(milestones.payback.saldo) : '—'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Primeiro saldo acumulado ≥ 0</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase">M24 · Liquidez Final</div>
          <div className="text-xl font-black text-cyan-700 font-mono mt-1">
            +R$ {m24FinalCash.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Acumulado líquido de 24 meses de operação</div>
        </div>
      </div>
    </div>
  );
};
