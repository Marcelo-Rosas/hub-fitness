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
import { ShieldCheck, Wallet, ArrowUpRight, TrendingUp, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ModuleHeader } from '../ModuleHeader';
import { parseOfficialCSVs, OFFICIAL_TOTALS_24M } from '../../data/officialData';
import { deriveCashMilestones, formatBrlSigned } from '../../core/cashMilestones';
import { defaultParams } from '../../core/params';

/** Rótulo curto no topo da ReferenceLine, com offset vertical para evitar sobreposição. */
const markerLabel =
  (text: string, fill: string, dy: number) =>
  (props: { viewBox?: { x?: number; y?: number; width?: number; height?: number } }) => {
    const x = props.viewBox?.x;
    if (x == null) return null;
    const w = Math.max(42, text.length * 6.2 + 12);
    return (
      <g transform={`translate(${x}, ${dy})`}>
        <rect x={-w / 2} y={-11} width={w} height={16} rx={4} fill="#fff" stroke={fill} strokeWidth={1} opacity={0.96} />
        <text textAnchor="middle" y={1} fill={fill} fontSize={9} fontWeight={700}>
          {text}
        </text>
      </g>
    );
  };

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

      {/* MAIN CASH AREA CHART WITH BLUE/CYAN GRADIENT & STRATEGIC MARKERS */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>📈 Curva de Saldo de Caixa Acumulado ({flowType === 'puro' ? 'Fluxo Puro M0–M24' : 'Com Carência M1–M6'})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Marcadores Obrigatórios: M0 CAPEX | M5 Vale da Morte | M6 Payback Puro | M7 Aluguel ON
            </p>
          </div>
          <span className="px-3 py-1 bg-cyan-100 text-cyan-900 border border-cyan-300 rounded-full text-xs font-mono font-black">
            {flowType === 'puro' ? 'Puro: Payback M6 (+R$ 52,1k)' : 'Carência Aluguel: Payback M5 (-R$ 5,8k)'}
          </span>
        </div>

        <div className="h-100 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 56, right: 24, left: 10, bottom: 8 }}>
              <defs>
                <linearGradient id="cyanBlueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={flowType === 'puro' ? '#0284c7' : '#059669'} stopOpacity={0.45} />
                  <stop offset="95%" stopColor={flowType === 'puro' ? '#06b6d4' : '#10b981'} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis
                tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: '#64748b' }}
              />
              <Tooltip
                formatter={(val: any) => [`R$ ${Number(val).toLocaleString('pt-BR')}`, 'Saldo Acumulado']}
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
              />

              <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 2" />

              {milestones.capex && (
                <ReferenceLine
                  x={milestones.capex.month}
                  stroke="#ef4444"
                  strokeWidth={2}
                  label={markerLabel(`${milestones.capex.month} CAPEX`, '#dc2626', 14)}
                />
              )}
              <ReferenceLine
                x={milestones.valley.month}
                stroke="#f59e0b"
                strokeWidth={2.5}
                label={markerLabel(`${milestones.valley.month} Vale`, '#d97706', 14)}
              />
              {milestones.payback && (
                <ReferenceLine
                  x={milestones.payback.month}
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  label={markerLabel(`${milestones.payback.month} Payback`, '#0369a1', 34)}
                />
              )}
              <ReferenceLine
                x={rentOn}
                stroke="#6366f1"
                strokeWidth={1.5}
                strokeDasharray="2 2"
                label={markerLabel(`${rentOn} Aluguel ON`, '#4f46e5', 54)}
              />

              <Area
                type="monotone"
                dataKey="selectedSaldo"
                stroke={flowType === 'puro' ? '#0284c7' : '#059669'}
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#cyanBlueGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legenda dos marcadores (texto completo fora do plot) */}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="px-2 py-1 rounded-md text-[10px] font-bold border border-rose-200 bg-rose-50 text-rose-700">
            {milestones.capex?.month ?? 'M0'} · CAPEX ({formatBrlSigned(milestones.capex?.saldo ?? -capex)})
          </span>
          <span className="px-2 py-1 rounded-md text-[10px] font-bold border border-amber-200 bg-amber-50 text-amber-800">
            {milestones.valley.month} · Vale da Morte ({formatBrlSigned(milestones.valley.saldo)})
          </span>
          <span className="px-2 py-1 rounded-md text-[10px] font-bold border border-sky-200 bg-sky-50 text-sky-800">
            {milestones.payback?.month ?? '—'} · Payback
            {milestones.payback ? ` (${formatBrlSigned(milestones.payback.saldo)})` : ''}
          </span>
          <span className="px-2 py-1 rounded-md text-[10px] font-bold border border-indigo-200 bg-indigo-50 text-indigo-800">
            {rentOn} · Aluguel ON / fim da carência
          </span>
        </div>
      </div>

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
