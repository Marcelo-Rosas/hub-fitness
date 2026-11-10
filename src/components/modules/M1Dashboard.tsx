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
import { TrendingUp, DollarSign, Percent, Box, Award, AlertTriangle } from 'lucide-react';
import { ModuleHeader } from '../ModuleHeader';
import { OFFICIAL_TOTALS_24M } from '../../data/officialData';
import { saldoCaixaAoVivo } from '../../core/scenarioDrivers';
import { SUBLIMITE_ICMS_ISS } from '../../core/simplesNacional';
import { SANCO_TCO_BREAKDOWN } from '../../data/benchmarkData';
import { deriveCashMilestones, formatBrlSigned } from '../../core/cashMilestones';
import { usePlanner } from '../../context/PlannerContext';
import { HubAreaGradient, HubChartCard } from '../charts/HubChartCard';
import { HUB_CHART, HubChartLegendPill, hubTick, hubTooltipStyle, hubYAxisK, markerLabel } from '../charts/hubChartTheme';

export const M1Dashboard: React.FC = () => {
  const { hubParams, dreMonths } = usePlanner();

  // DRE ao vivo (DAS progressivo LC 123 + 4PL). BP v3.5 fica só como referência histórica:
  // usava DAS 6% fixo e o total declarado (R$ 570.842) não fecha com a soma mensal (R$ 408.060).
  const cashflowSeries = saldoCaixaAoVivo(dreMonths);
  const totalReceita = dreMonths.reduce((a, m) => a + m.receitaServicos, 0);
  const totalLucroLiquido = dreMonths.reduce((a, m) => a + m.lucroLiquido, 0);
  const margemLiquidaPercent = totalReceita ? (totalLucroLiquido / totalReceita) * 100 : 0;
  const saldoCaixaM24CarenciaAluguel = cashflowSeries.at(-1)?.saldoCarenciaAluguel ?? 0;
  const saldoCaixaM24Puro = cashflowSeries.at(-1)?.saldoPuro ?? 0;
  const bpLL = OFFICIAL_TOTALS_24M.lucroLiquidoTotal;
  const pctTxt = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
  const kTxt = (v: number) => `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  const capacidadePaletes = hubParams.capacity.totalPositions;

  // Indicadores fiscais do DRE ao vivo (Simples Nacional).
  const comSimples = dreMonths.filter((m) => m.simples);
  const fatorRs = comSimples.map((m) => m.simples!.fatorR);
  const fatorRMin = fatorRs.length ? Math.min(...fatorRs) : 0;
  const fatorRM24 = fatorRs.at(-1) ?? 0;
  const mesesAnexoV = comSimples.filter((m) => m.simples!.anexo === 'V').length;
  const fatorROk = mesesAnexoV === 0;
  const rbt12Pico = Math.max(0, ...comSimples.map((m) => m.simples!.rbt12));
  const folgaSublimite = SUBLIMITE_ICMS_ISS - rbt12Pico;
  const folgaPct = folgaSublimite / SUBLIMITE_ICMS_ISS;
  const totalDas = dreMonths.reduce((a, m) => a + m.das6Percent, 0);
  const dasEfetivoPct = totalReceita ? (totalDas / totalReceita) * 100 : 0;
  const aliqM24 = comSimples.at(-1)?.simples!.aliquotaEfetiva ?? 0;

  const milestones = deriveCashMilestones(
    cashflowSeries.map((item) => ({
      month: item.month,
      monthNum: item.monthNum,
      saldo: item.saldoPuro,
      fluxo: item.fluxoPuro,
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
    saldoPuro: item.saldoPuro,
    saldoCarenciaAluguel: item.saldoCarenciaAluguel,
    labelValue: item.saldoCarenciaAluguel,
  }));

  const rentOn = `M${hubParams.rent.carenciaAluguelMeses + 1}`;
  const tcoBreakdown = SANCO_TCO_BREAKDOWN;

  return (
    <div className="space-y-6">
      {/* UNIFIED MODULE HEADER WITH OFFICIAL METRICS */}
      <ModuleHeader
        moduleId="M1"
        title="Dashboard Executivo · Visão Geral 3PL"
        subtitle="DRE ao vivo do cenário ativo — DAS progressivo (LC 123), Fator R e receita 4PL. Caixa = fluxo do BP v3.5 ajustado pela diferença de lucro mês a mês."
        kpis={[
          {
            label: 'Lucro Líquido 24m',
            value: `R$ ${totalLucroLiquido.toLocaleString('pt-BR')}`,
            subtext: `Margem ${pctTxt(margemLiquidaPercent)} · BP v3.5 declarava R$ ${bpLL.toLocaleString("pt-BR")}`,
            badge: 'AO VIVO',
            highlightColor: totalLucroLiquido >= 0 ? 'emerald' : 'rose',
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
            subtext: 'Somatório M1–M24 do DRE ao vivo',
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

      {/* INDICADORES FISCAIS (Simples Nacional) — não repetem os KPIs do cabeçalho */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`bg-white p-5 rounded-xl border-2 ${fatorROk ? 'border-emerald-500' : 'border-rose-500'} shadow-xs flex flex-col justify-between`}>
          <div>
            <div className={`flex items-center justify-between mb-1 ${fatorROk ? 'text-emerald-700' : 'text-rose-700'}`}>
              <span className="text-xs font-bold uppercase tracking-wider">Fator R (mín. 24m)</span>
              <Percent className="w-4 h-4" />
            </div>
            <div className={`text-2xl font-black font-mono ${fatorROk ? 'text-emerald-900' : 'text-rose-900'}`}>{pctTxt(fatorRMin * 100)}</div>
          </div>
          <div className="mt-3 text-[11px] text-slate-600 font-medium border-t border-slate-100 pt-2">
            {fatorROk ? 'Anexo III em todos os meses' : `Anexo V em ${mesesAnexoV} mês(es)`} · piso 28% · M24 {pctTxt(fatorRM24 * 100)}
          </div>
        </div>
        <div className={`bg-white p-5 rounded-xl border-2 ${folgaSublimite <= 0 ? 'border-rose-500' : folgaPct < 0.1 ? 'border-amber-500' : 'border-emerald-500'} shadow-xs flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between text-slate-600 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">RBT12 pico</span>
              <DollarSign className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">{kTxt(rbt12Pico)}</div>
          </div>
          <div className="mt-3 text-[11px] text-slate-600 font-medium border-t border-slate-100 pt-2">
            {folgaSublimite > 0 ? `Folga até sublimite R$ 3,6 mi: ${kTxt(folgaSublimite)} (${pctTxt(folgaPct * 100)})` : `Acima do sublimite R$ 3,6 mi em ${kTxt(-folgaSublimite)}: ICMS/ISS fora do DAS`}
          </div>
        </div>
        <div className={'bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between'}>
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">DAS efetivo 24m</span>
              <Percent className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">{pctTxt(dasEfetivoPct)}</div>
          </div>
          <div className="mt-3 text-[11px] text-slate-600 font-medium border-t border-slate-100 pt-2">
            {kTxt(totalDas)} de DAS · progressivo LC 123 · M24 {pctTxt(aliqM24 * 100)}
          </div>
        </div>
        <div className={'bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between'}>
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Margem Líquida</span>
              <TrendingUp className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">{pctTxt(margemLiquidaPercent)}</div>
          </div>
          <div className="mt-3 text-[11px] text-slate-600 font-medium border-t border-slate-100 pt-2">
            ({kTxt(totalLucroLiquido)} / {kTxt(totalReceita)}) × 100
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
              <h3 className="text-xs font-bold uppercase tracking-wider">Capacidade & Payback (ao vivo)</h3>
            </div>
            <p className="text-xs text-slate-400">
              Infraestrutura (Diretriz g5) e marcos de caixa do cenário ativo.
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
                <span className="text-slate-300 font-sans">Vale da Morte:</span>
                <span className="font-bold text-amber-400">{milestones.valley.month} ({formatBrlSigned(milestones.valley.saldo)})</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-sans">Payback (fluxo puro):</span>
                <span className={`font-bold ${milestones.payback ? "text-emerald-400" : "text-rose-400"}`}>
                  {milestones.payback ? `${milestones.payback.month} (${formatBrlSigned(milestones.payback.saldo)})` : "Não ocorre em 24m"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-amber-950/60 border border-amber-800/80 p-3 rounded-lg flex items-start gap-2 text-[11px] text-amber-200 font-sans">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>Auditoria fiscal 11/2026:</strong> BP v3.5 (LL R$ {bpLL.toLocaleString("pt-BR")}) usava DAS 6% fixo e
              o total não fecha com a soma mensal (R$ 408.060). Números acima recalculados com DAS progressivo + 4PL.
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
