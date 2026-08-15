import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Line,
  ComposedChart,
  Area,
} from 'recharts';
import {
  Layers,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Building2,
  Sparkles,
  Truck,
  Sliders,
  DollarSign,
  RotateCcw,
  ShieldCheck,
  ArrowRight,
  TrendingDown,
  Info,
} from 'lucide-react';
import { ModuleHeader } from '../ModuleHeader';
import { usePlanner } from '../../context/PlannerContext';
import { YEAR3_EXPANSION_PLAN } from '../../core/year3Plan';
import { deriveCashMilestones } from '../../core/cashMilestones';

interface ForkliftOption {
  id: string;
  name: string;
  description: string;
  monthlyCost: number;
  isCapexPurchase?: boolean;
  capexAmount?: number;
  badge: string;
}

export const M7Ano3Expansao: React.FC = () => {
  const { addAuditLog, hubParams } = usePlanner();
  const y3 = hubParams.year3;
  const forkliftBaseline = y3.forkliftMonthlyBaseline;

  const FORKLIFT_PRESETS: ForkliftOption[] = [
    {
      id: 'baseline',
      name: 'Locação Standard (2x Elétricas 2.5t)',
      description: '2 unidades elétricas padrão 2.5t - Baseline do Estudo v3.5',
      monthlyCost: forkliftBaseline,
      badge: 'Base v3.5',
    },
    {
      id: 'heavy_duty',
      name: 'Locação Heavy-Duty (Li-Ion + Reserva)',
      description: 'Baterias de Lítio com carga rápida e 1 unidade de reserva em pico',
      monthlyCost: 7200,
      badge: 'Alta Performance',
    },
    {
      id: 'economic',
      name: 'Locação Econômica (Semi-Novas)',
      description: 'Frota semi-nova revisada com contrato de manutenção preventiva',
      monthlyCost: 3500,
      badge: 'Economia OPEX',
    },
    {
      id: 'capex_purchase',
      name: 'Aquisição Direta CAPEX (Compra Própria)',
      description: 'Compra de 2 empilhadeiras em M25 (R$ 180k) + R$ 1.200/mês manutenção',
      monthlyCost: 1200,
      isCapexPurchase: true,
      capexAmount: 180000,
      badge: 'CAPEX Inicial',
    },
    {
      id: 'custom',
      name: 'Ajuste Personalizado (Manual)',
      description: 'Defina manualmente o valor do custo mensal das empilhadeiras',
      monthlyCost: forkliftBaseline,
      badge: 'Customizado',
    },
  ];

  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('baseline');
  const [customMonthlyCost, setCustomMonthlyCost] = useState<number>(forkliftBaseline);
  const [include4PLTower, setInclude4PLTower] = useState<boolean>(true);

  const selectedPreset = useMemo(() => {
    return FORKLIFT_PRESETS.find((p) => p.id === selectedOptionId) || FORKLIFT_PRESETS[0];
  }, [selectedOptionId, forkliftBaseline]);

  const effectiveMonthlyCost = useMemo(() => {
    if (selectedOptionId === 'custom') {
      return customMonthlyCost;
    }
    return selectedPreset.monthlyCost;
  }, [selectedOptionId, customMonthlyCost, selectedPreset]);

  const isCapexPurchase = selectedPreset.isCapexPurchase || false;
  const capexPurchaseAmount = isCapexPurchase ? selectedPreset.capexAmount || 180000 : 0;

  const startingCashM24 = include4PLTower ? y3.startingCashM24With4pl : y3.startingCashM24Without4pl;
  const galpaoA = Math.round(hubParams.capacity.totalPositions * y3.galpaoAOccupancy);

  const year3Data = useMemo(() => {
    const monthlyDelta = forkliftBaseline - effectiveMonthlyCost;
    const monthlyNetCash = y3.baseMonthlyNetCash + monthlyDelta;

    const data = [];
    let currentCash = startingCashM24;

    for (const item of YEAR3_EXPANSION_PLAN) {
      const initialForkliftCapex = item.month === 25 && isCapexPurchase ? capexPurchaseAmount : 0;
      const totalCapexOutflow = item.expansionCapex + initialForkliftCapex;
      const netMonthlyCashFlow = monthlyNetCash - totalCapexOutflow;
      currentCash += netMonthlyCashFlow;

      data.push({
        month: `M${item.month}`,
        mIndex: item.month,
        galpaoA,
        galpaoB: item.galpaoB,
        totalCapacity: galpaoA + item.galpaoB,
        grossRevenue: y3.monthlyGrossRevenue,
        forkliftCost: effectiveMonthlyCost,
        expansionCapex: item.expansionCapex,
        forkliftCapex: initialForkliftCapex,
        netCashFlow: netMonthlyCashFlow,
        accumulatedCash: currentCash,
        isFinal: item.month === 36,
      });
    }

    const valleyMonth = deriveCashMilestones(
      data.map((d) => ({ month: d.month, monthNum: d.mIndex, saldo: d.accumulatedCash, fluxo: d.netCashFlow })),
    ).valley.month;

    return data.map((d) => ({ ...d, isValley: d.month === valleyMonth }));
  }, [
    effectiveMonthlyCost,
    isCapexPurchase,
    capexPurchaseAmount,
    startingCashM24,
    forkliftBaseline,
    y3,
    galpaoA,
  ]);

  const finalM36Cash = year3Data[year3Data.length - 1].accumulatedCash;
  const valleyRow = year3Data.find((d) => d.isValley);
  const valleyCash = valleyRow?.accumulatedCash || 0;
  const valleyLabel = valleyRow?.month || '—';
  const totalAnnualForkliftCost = effectiveMonthlyCost * 12 + (isCapexPurchase ? capexPurchaseAmount : 0);
  const baselineAnnualForkliftCost = forkliftBaseline * 12;
  const forkliftCostDelta = totalAnnualForkliftCost - baselineAnnualForkliftCost;

  const baselineM36Cash = year3Data[year3Data.length - 1].accumulatedCash + forkliftCostDelta;
  const m36CashDelta = finalM36Cash - baselineM36Cash;

  const handlePresetSelect = (id: string) => {
    setSelectedOptionId(id);
    const target = FORKLIFT_PRESETS.find((p) => p.id === id);
    if (target) {
      if (id !== 'custom') {
        setCustomMonthlyCost(target.monthlyCost);
      }
      addAuditLog('Simulação Custo Empilhadeiras', '-', `${target.name} (${target.badge})`);
    }
  };

  return (
    <div className="space-y-6">
      {/* UNIFIED MODULE HEADER */}
      <ModuleHeader
        moduleId="M7"
        title="Ano 3 & Rampa de Expansão (Galpão B)"
        subtitle="Simulador de expansão de capacidade (2.612 a 3.812 posições) com rampa de M25 a M36 e impactor de custo de empilhadeiras no fluxo de caixa."
        kpis={[
          {
            label: 'Capacidade Total M36',
            value: '3.812 Posições',
            subtext: 'Galpão A (2.612) + Galpão B (1.200)',
            badge: 'GALPÃO B',
            highlightColor: 'emerald',
          },
          {
            label: 'Caixa Acumulado M36',
            value: `R$ ${(finalM36Cash / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`,
            subtext: `Valley ${valleyLabel}: R$ ${(valleyCash / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`,
            badge: 'CAIXA Y3',
            highlightColor: 'indigo',
          },
          {
            label: 'Custo Empilhadeiras Y3',
            value: `R$ ${totalAnnualForkliftCost.toLocaleString('pt-BR')}`,
            subtext: `R$ ${effectiveMonthlyCost.toLocaleString('pt-BR')}/mês`,
            badge: 'OPEX M7',
            highlightColor: 'amber',
          },
          {
            label: 'CAPEX Expansão Galpão B',
            value: 'R$ 800.000',
            subtext: 'Investimento em M29 e M31 (R$ 400k + R$ 400k)',
            badge: 'CAPEX',
            highlightColor: 'slate',
          },
        ]}
      />

      {/* Forklift Cost Selector Panel */}
      <div className="bg-linear-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Seletor de Custo das Empilhadeiras & Frota</span>
                <Sliders className="w-4 h-4 text-emerald-400" />
              </h2>
              <p className="text-xs text-slate-300">
                Altere o modelo de locação/aquisição para recalcular o impacto no caixa do Ano 3
              </p>
            </div>
          </div>

          {/* 4PL Toggle Control */}
          <label className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg cursor-pointer text-xs transition-all">
            <input
              type="checkbox"
              checked={include4PLTower}
              onChange={(e) => setInclude4PLTower(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
            <span className="font-semibold text-slate-200">Incluir 4PL Control Tower (+R$ 101,5k Caixa M24)</span>
          </label>
        </div>

        {/* Preset Cards Selector Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {FORKLIFT_PRESETS.map((preset) => {
            const isSelected = selectedOptionId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset.id)}
                className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  isSelected
                    ? 'bg-blue-600/30 border-emerald-400 shadow-lg ring-1 ring-emerald-400 text-white'
                    : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/80 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-900/80 text-emerald-300 border border-slate-700">
                      {preset.badge}
                    </span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <div className="text-xs font-bold text-white leading-snug mt-1">{preset.name}</div>
                  <div className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-baseline justify-between font-mono">
                  <span className="text-[10px] text-slate-400">Custo/mês:</span>
                  <span className="text-sm font-black text-emerald-400">
                    R$ {preset.monthlyCost.toLocaleString('pt-BR')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom Input & Fine Tuning */}
        <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="text-xs font-semibold text-slate-300 whitespace-nowrap">
              Ajuste Fino Custo Mensal (OPEX):
            </div>
            <input
              type="range"
              min="2000"
              max="12000"
              step="100"
              value={effectiveMonthlyCost}
              onChange={(e) => {
                setSelectedOptionId('custom');
                setCustomMonthlyCost(Number(e.target.value));
              }}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-700 rounded-lg"
            />
          </div>

          <div className="flex items-center gap-3 justify-end font-mono">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg">
              <span className="text-xs text-slate-400">R$</span>
              <input
                type="number"
                step="100"
                value={effectiveMonthlyCost}
                onChange={(e) => {
                  setSelectedOptionId('custom');
                  setCustomMonthlyCost(Number(e.target.value) || 0);
                }}
                className="w-24 bg-transparent text-sm font-bold text-emerald-400 focus:outline-none"
              />
              <span className="text-xs text-slate-400">/mês</span>
            </div>

            <button
              onClick={() => handlePresetSelect('baseline')}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded bg-slate-700/50 hover:bg-slate-700 transition-colors"
              title="Resetar para o padrão v3.5 (R$ 4.800/mês)"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recalculated Impact Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Saldo de Caixa Acumulado Final (M36 / Ano 3) */}
        <div
          className="bg-linear-to-br from-emerald-900 to-teal-950 p-4 rounded-xl border border-emerald-500/30 text-white shadow-md relative overflow-hidden"
        >
          <div className="absolute top-2 right-2 p-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg">
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            Saldo Caixa M36 (Fim Ano 3)
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-white">
            R$ {finalM36Cash.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] font-semibold mt-2 flex items-center gap-1 text-emerald-200">
            {m36CashDelta >= 0 ? (
              <span className="text-emerald-300 font-bold flex items-center gap-0.5">
                <TrendingUp className="w-3.5 h-3.5" /> +R$ {m36CashDelta.toLocaleString('pt-BR')} vs. Base
              </span>
            ) : (
              <span className="text-amber-300 font-bold flex items-center gap-0.5">
                <TrendingDown className="w-3.5 h-3.5" /> -R$ {Math.abs(m36CashDelta).toLocaleString('pt-BR')} vs. Base
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Vale de Caixa (derivado) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 flex items-center justify-between">
            <span>Vale de Caixa em {valleyLabel}</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className={`text-2xl font-black font-mono mt-1 ${valleyCash < y3.liquidityCushionCritical ? 'text-rose-600' : 'text-amber-900'}`}>
            R$ {valleyCash.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-slate-600 font-semibold mt-1">
            {valleyCash >= y3.liquidityCushionAlert ? (
              <span className="text-emerald-700 font-bold">✓ Colchão de liquidez preservado</span>
            ) : (
              <span className="text-amber-700 font-bold">⚠ {valleyLabel} requer monitoramento de capital</span>
            )}
          </div>
        </div>

        {/* Card 3: Custo Anual Empilhadeiras Y3 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">Custo Total Frota (Ano 3)</div>
          <div className="text-xl font-black text-slate-900 font-mono mt-1">
            R$ {totalAnnualForkliftCost.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-slate-600 font-semibold mt-1">
            {forkliftCostDelta === 0 ? (
              <span className="text-slate-500">Alinhado com baseline (R$ 57,6k/ano)</span>
            ) : forkliftCostDelta < 0 ? (
              <span className="text-emerald-600 font-bold">
                Economia de R$ {Math.abs(forkliftCostDelta).toLocaleString('pt-BR')}/ano
              </span>
            ) : (
              <span className="text-rose-600 font-bold">
                Acréscimo de R$ {forkliftCostDelta.toLocaleString('pt-BR')}/ano
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Autofinanciamento Galpão B */}
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-emerald-950 shadow-xs">
          <div className="text-xs font-bold uppercase text-emerald-800">Status Expansão Galpão B</div>
          <div className="text-xl font-black font-mono mt-1 text-emerald-950">
            3.812 Posições
          </div>
          <div className="text-[11px] text-emerald-800 font-semibold mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>100% Autofinanciado sem dívida</span>
          </div>
        </div>
      </div>

      {/* Recalculated Cash Curve Chart vs Capacity */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Trajetória Recalculada do Saldo de Caixa Acumulado (Ano 3: M25 a M36)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Caixa (eixo esquerdo, R$) + capacidade em degraus (eixo direito, posições) — impacto de empilhadeiras e CAPEX Galpão B
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
              Capacidade = linha em degrau
            </span>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded font-mono font-bold text-xs border border-emerald-200">
              M36 Final: R$ {finalM36Cash.toLocaleString('pt-BR')}
            </span>
          </div>
        </div>

        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={year3Data} margin={{ top: 10, right: 16, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: '#059669' }}
                tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                label={{
                  value: 'Caixa (R$)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 4,
                  style: { fontSize: 10, fill: '#059669', fontWeight: 600 },
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[2000, 4200]}
                tick={{ fontSize: 11, fill: '#4f46e5' }}
                tickFormatter={(val) => `${val}`}
                label={{
                  value: 'Posições',
                  angle: 90,
                  position: 'insideRight',
                  offset: 4,
                  style: { fontSize: 10, fill: '#4f46e5', fontWeight: 600 },
                }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                }}
                formatter={(value: any, name: string) => {
                  if (name.includes('Caixa') || name.includes('CAPEX') || name.includes('Fluxo')) {
                    return [`R$ ${Number(value).toLocaleString('pt-BR')}`, name];
                  }
                  return [`${Number(value).toLocaleString('pt-BR')} posições`, name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: 8 }} />
              <ReferenceLine
                yAxisId="left"
                x={valleyLabel}
                stroke="#f43f5e"
                strokeWidth={2}
                strokeDasharray="4 4"
                label={{ value: `🚨 Vale ${valleyLabel}`, fill: '#f43f5e', fontSize: 11, fontWeight: 'bold' }}
              />

              {/* Capacidade: degrau (step) — melhor metáfora visual para saltos discretos de galpão */}
              <Line
                yAxisId="right"
                type="stepAfter"
                dataKey="totalCapacity"
                name="Capacidade Total (Galpão A + B)"
                stroke="#4f46e5"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#4f46e5', stroke: '#fff', strokeWidth: 1.5 }}
                activeDot={{ r: 5 }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="accumulatedCash"
                name="Saldo de Caixa Acumulado (R$)"
                fill="#10b981"
                stroke="#059669"
                fillOpacity={0.18}
                strokeWidth={3}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="netCashFlow"
                name="Fluxo Líquido Mensal (R$)"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3, fill: '#2563eb' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Month-by-Month Cash Flow Table for Year 3 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              📋 Extrato Mês a Mês do Ano 3 (M25 a M36) com Recálculo de Empilhadeiras
            </h3>
            <p className="text-xs text-slate-500">
              Detalhamento de movimentação financeira, CAPEX e Saldo Final de Caixa
            </p>
          </div>
          <div className="text-xs font-mono font-bold text-slate-700 bg-white px-3 py-1.5 rounded border border-slate-200">
            Custo Empilhadeiras: R$ {effectiveMonthlyCost.toLocaleString('pt-BR')}/mês
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700 font-mono">
            <thead className="bg-slate-100 text-slate-800 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3">Mês</th>
                <th className="p-3 text-right">Posições (A+B)</th>
                <th className="p-3 text-right">Receita Bruta</th>
                <th className="p-3 text-right">Custo Empilhadeiras</th>
                <th className="p-3 text-right">CAPEX Expansão</th>
                <th className="p-3 text-right">Fluxo Líquido Mês</th>
                <th className="p-3 text-right font-bold text-slate-900">Saldo Caixa Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {year3Data.map((row) => {
                const isValleyRow = row.isValley;
                const isFinalRow = row.isFinal;

                return (
                  <tr
                    key={row.month}
                    className={`hover:bg-slate-50 transition-colors ${
                      isValleyRow
                        ? 'bg-amber-50/80 font-semibold'
                        : isFinalRow
                        ? 'bg-emerald-50/80 font-bold'
                        : ''
                    }`}
                  >
                    <td className="p-3 font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{row.month}</span>
                      {isValleyRow && (
                        <span className="text-[10px] bg-amber-200 text-amber-900 font-sans px-1.5 py-0.5 rounded border border-amber-300">
                          Vale
                        </span>
                      )}
                      {isFinalRow && (
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 font-sans px-1.5 py-0.5 rounded border border-emerald-300">
                          Fechamento Y3
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">{row.totalCapacity.toLocaleString('pt-BR')} pos</td>
                    <td className="p-3 text-right text-emerald-700">R$ {row.grossRevenue.toLocaleString('pt-BR')}</td>
                    <td className="p-3 text-right text-slate-900">
                      R$ {row.forkliftCost.toLocaleString('pt-BR')}
                      {row.forkliftCapex > 0 && (
                        <span className="block text-[9px] text-amber-700">
                          +CAPEX R$ {row.forkliftCapex.toLocaleString('pt-BR')}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right text-rose-700">
                      {row.expansionCapex > 0 ? `R$ ${row.expansionCapex.toLocaleString('pt-BR')}` : '-'}
                    </td>
                    <td className={`p-3 text-right font-bold ${row.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {row.netCashFlow >= 0 ? '+' : ''}R$ {row.netCashFlow.toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3 text-right font-black text-slate-950 text-sm">
                      R$ {row.accumulatedCash.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-900 text-white font-bold text-xs">
              <tr>
                <td className="p-3">TOTAL / FIM Y3</td>
                <td className="p-3 text-right">3.812 pos</td>
                <td className="p-3 text-right text-emerald-400">R$ 3.600.000</td>
                <td className="p-3 text-right text-slate-300">R$ {totalAnnualForkliftCost.toLocaleString('pt-BR')}</td>
                <td className="p-3 text-right text-rose-300">R$ 800.000</td>
                <td className="p-3 text-right text-emerald-400">+R$ {(finalM36Cash - startingCashM24).toLocaleString('pt-BR')}</td>
                <td className="p-3 text-right text-emerald-400 font-black text-sm">
                  R$ {finalM36Cash.toLocaleString('pt-BR')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

