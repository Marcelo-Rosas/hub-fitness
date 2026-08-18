import React, { useState, useMemo, useEffect } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { RAW_MIX_DATA_JSON } from '../../data/mixSimulatorData';
import {
  format4plCell,
  mixProfileKind,
  mixProfileLabel,
  parse4plCt,
  parseBrNumber,
} from '../../core/mixLabels';
import { mixRowBePcts } from '../../core/mixPremiseBe';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../../data/initialData';
import { canEditFinance } from '../../core/rbac/moduleEdit';
import {
  occupiedPositionsFromRate,
  occupancyRateFromOccupied,
  mixBeSlackPp,
  mixBePct,
  mixBePositions,
  computeMinViableBe,
  MIX_OCCUPANCY_MIN,
  MIX_CCT_FACTOR,
  MIX_CAGED_FACTOR,
} from '../../core/mixPreview';
import { semiFixedOpexMonthlyFromLedger } from '../../core/engine';
import { ContractChip } from '../ContractChip';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Zap,
  TrendingUp,
  ShieldAlert,
  BarChart3,
  Layers,
  RotateCcw,
  Search,
  Users,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { MixCostMode, PayrollRole } from '../../types';
import {
  availablePayrollCatalogEntries,
  findPayrollCatalogEntry,
  payrollCatalogLabel,
  payrollRoleFromCatalogEntry,
} from '../../core/payrollCargoCatalog';
import {
  MIX_COST_MODE_LABELS,
  PAYROLL_SIMPLES_PACK_PCT,
  payrollAmount,
  payrollEncargosGrandTotal,
  payrollEncargosPerHc,
  payrollEncargosTotal,
  payrollTotal,
} from '../../core/payrollRoles';
import { HubChartCard } from '../charts/HubChartCard';
import { HUB_CHART, HubChartLegendPill, hubTick, hubTooltipStyle } from '../charts/hubChartTheme';

const PAYROLL_BENCHMARK_GROUPS = [
  { field: 'salarioCct' as const, mode: 'cct' as const, label: 'CCT' },
  { field: 'salarioMediana' as const, mode: 'mediana' as const, label: 'Mediana SC' },
  { field: 'salarioCaged' as const, mode: 'caged' as const, label: 'CAGED' },
];

export const M11SimuladorMix: React.FC<{
  embedPanel?: 'simulator';
}> = ({ embedPanel }) => {
  const {
    activeRole,
    pitchMode,
    activeMix,
    updateActiveMix,
    commitMixPreview,
    discardMixPreview,
    isMixDirty,
    committedMixWeights,
    hubParams,
    ledgerBaseItems,
    previewMixItems,
    activeScenario,
    activeScenarioId,
    updateScenarioDrivers,
    mixCostMode,
    payrollRoles,
    upsertPayrollRole,
    patchPayrollRoleById,
    deletePayrollRole,
  } = usePlanner();

  const canCommit = (activeRole === 'cfo' || activeRole === 'socio') && !pitchMode;
  const canEditOcc = canEditFinance(activeRole) && !pitchMode;
  const occupancyRate = activeScenario.drivers.occupancyRate;


  const embedded = !!embedPanel;

  // Local weights for smooth slider interaction
  const [mixWeights, setMixWeights] = useState({
    p1: activeMix.p1 ?? 20,
    p2: activeMix.p2 ?? 30,
    p4: activeMix.p4 ?? 25,
    p5: activeMix.p5 ?? 25,
  });

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [appliedNotification, setAppliedNotification] = useState<string | null>(null);
  const [addCargoCatalogId, setAddCargoCatalogId] = useState('');
  const mestraLedger = useMemo(() => {
    const base = ledgerBaseItems.length ? ledgerBaseItems : INITIAL_GRANULAR_DRE_ITEMS;
    return isMixDirty && previewMixItems.length ? previewMixItems : base;
  }, [ledgerBaseItems, isMixDirty, previewMixItems]);

  const totalMixSum = mixWeights.p1 + mixWeights.p2 + mixWeights.p4 + mixWeights.p5;

  // Preview path: keep Context activeMix in sync (Tornado / Fator R live)
  useEffect(() => {
    updateActiveMix({
      p1: mixWeights.p1,
      p2: mixWeights.p2,
      p4: mixWeights.p4,
      p5: mixWeights.p5,
    });
    // Intentionally omit updateActiveMix — identity changes every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixWeights.p1, mixWeights.p2, mixWeights.p4, mixWeights.p5]);

  useEffect(() => {
    setMixWeights((prev) => {
      if (
        prev.p1 === activeMix.p1 &&
        prev.p2 === activeMix.p2 &&
        prev.p4 === activeMix.p4 &&
        prev.p5 === activeMix.p5
      ) {
        return prev;
      }
      return {
        p1: activeMix.p1,
        p2: activeMix.p2,
        p4: activeMix.p4,
        p5: activeMix.p5,
      };
    });
  }, [activeMix.p1, activeMix.p2, activeMix.p4, activeMix.p5]);

  // Calculated weighted metrics based on active slider weights
  const calculations = useMemo(() => {
    const w1 = mixWeights.p1 / 100;
    const w2 = mixWeights.p2 / 100;
    const w4 = mixWeights.p4 / 100;
    const w5 = mixWeights.p5 / 100;

    const weightedMcPos = w1 * 52.5 + w2 * 78.0 + w4 * 67.0 + w5 * 94.0;
    const weightedTicket = w1 * 68.95 + w2 * 94.45 + w4 * 83.45 + w5 * 110.45;

    // 4PL CT Revenue per month
    const ct4plM12 = w1 * 0 + w2 * 2000 + w4 * 1500 + w5 * 2500;
    const ct4plM24 = ct4plM12 * 2; // Scales at M24

    const totalCapacity = hubParams.capacity.totalPositions;
    const targetOccPct = hubParams.capacity.targetOccupancy * 100;
    const occupiedPositions = occupiedPositionsFromRate(occupancyRate, totalCapacity);
    const occPct = Math.round(occupancyRate * 100);

    const ledger = mestraLedger;
    const custosRealistas = semiFixedOpexMonthlyFromLedger(ledger);
    const custosOriginais = Math.round(custosRealistas * MIX_CAGED_FACTOR);
    const custosEnxutos = Math.round(custosRealistas * MIX_CCT_FACTOR);
    const bePctRealista = mixBePct(custosRealistas, weightedMcPos, totalCapacity);
    const bePctOriginal = mixBePct(custosOriginais, weightedMcPos, totalCapacity);
    const bePctEnxuto = mixBePct(custosEnxutos, weightedMcPos, totalCapacity);
    const bePositionsRealista = mixBePositions(custosRealistas, weightedMcPos);
    const ll100Realista = Math.round(totalCapacity * weightedMcPos - custosRealistas);
    const llOccRealista = Math.round(occupiedPositions * weightedMcPos - custosRealistas);
    const beSlackRealista = mixBeSlackPp(occPct, bePctRealista);

    const mixForBe = { p1: mixWeights.p1, p2: mixWeights.p2, p4: mixWeights.p4, p5: mixWeights.p5 };
    const beCaged = computeMinViableBe({
      items: ledger,
      mix: mixForBe,
      capacity: totalCapacity,
      costMode: 'caged',
      payrollRoles,
    });
    const beCct = computeMinViableBe({
      items: ledger,
      mix: mixForBe,
      capacity: totalCapacity,
      costMode: 'cct',
      payrollRoles,
    });
    const beMediana = computeMinViableBe({
      items: ledger,
      mix: mixForBe,
      capacity: totalCapacity,
      costMode: 'mediana',
      payrollRoles,
    });
    const minViable =
      mixCostMode === 'caged' ? beCaged : mixCostMode === 'cct' ? beCct : beMediana;
    const custosCaged = beCaged.costMonthly;
    const custosCct = beCct.costMonthly;
    const custosMediana = beMediana.costMonthly;
    const bePositionsMediana = beMediana.bePositions;
    const bePctCaged = beCaged.bePct;
    const bePctMediana = beMediana.bePct;
    const beSlackPp = mixBeSlackPp(occPct, minViable.bePct);

    const ll100Caged = Math.round(totalCapacity * weightedMcPos - custosCaged);
    const ll100Cct = Math.round(totalCapacity * weightedMcPos - custosCct);
    const ll100Mediana = Math.round(totalCapacity * weightedMcPos - custosMediana);

    const llOccCaged = Math.round(occupiedPositions * weightedMcPos - custosCaged);
    const llOccCct = Math.round(occupiedPositions * weightedMcPos - custosCct);
    const llOccMediana = Math.round(occupiedPositions * weightedMcPos - custosMediana);
    const ll100Selected = Math.round(totalCapacity * weightedMcPos - minViable.costMonthly);
    const llOccSelected = Math.round(occupiedPositions * weightedMcPos - minViable.costMonthly);

    // Triggers and Warnings
    const triggers: { type: 'danger' | 'warning' | 'info'; text: string }[] = [];

    if (mixWeights.p1 > 25) {
      triggers.push({
        type: 'danger',
        text: '⚠️ P1 Estocador > 25%: Ativa gatilho de Churn + VAS obrigatório + revisão de preço.',
      });
    }
    if (mixWeights.p2 > 40) {
      triggers.push({
        type: 'warning',
        text: '⚠️ P2 Franquias > 40%: Risco de alta concentração geográfica.',
      });
    }
    if (mixWeights.p4 > 35) {
      triggers.push({
        type: 'warning',
        text: '⚠️ P4 Academias > 35%: Risco de ciclicidade do setor B2B fitness.',
      });
    }
    if (mixWeights.p5 < 20) {
      triggers.push({
        type: 'danger',
        text: '🚨 P5 Premium < 20%: Perda de margem estrutural do armazém.',
      });
    }
    if (bePctRealista > targetOccPct) {
      triggers.push({
        type: 'danger',
        text: `🚨 BE Realista (${bePctRealista}%) acima da meta limite de ${targetOccPct}% de ocupação!`,
      });
    }

    // Monoclient check
    if (mixWeights.p1 >= 100 || mixWeights.p2 >= 100 || mixWeights.p4 >= 100 || mixWeights.p5 >= 100) {
      triggers.push({
        type: 'danger',
        text: '🚫 VETADO POR GOVERNANÇA: Concentração monocliente viola política de diversificação (máx 25% por cliente).',
      });
    }

    return {
      weightedMcPos: Number(weightedMcPos.toFixed(2)),
      weightedTicket: Number(weightedTicket.toFixed(2)),
      ct4plM12: Math.round(ct4plM12),
      ct4plM24: Math.round(ct4plM24),
      totalCapacity,
      targetOccPct,
      occupiedPositions,
      occPct,
      occupancyRate,
      custosCaged,
      custosCct,
      custosMediana,
      bePositionsMediana,
      bePositionsCct: beCct.bePositions,
      bePositionsSelected: minViable.bePositions,
      bePctCaged,
      bePctCct: beCct.bePct,
      bePctMediana,
      bePctSelected: minViable.bePct,
      custosSelected: minViable.costMonthly,
      beSlackPp,
      beSlackRealista,
      custosOriginais,
      custosEnxutos,
      custosRealistas,
      bePctOriginal,
      bePctEnxuto,
      bePctRealista,
      bePositionsRealista,
      ll100Realista,
      llOccRealista,
      costMode: mixCostMode,
      payrollMonthly: payrollTotal(payrollRoles, mixCostMode),
      ll100Caged,
      ll100Cct,
      ll100Mediana,
      llOccCaged,
      llOccCct,
      llOccMediana,
      ll100Selected,
      llOccSelected,
      triggers,
    };
  }, [mixWeights, hubParams, mestraLedger, occupancyRate, mixCostMode, payrollRoles]);

  const patchPayrollField = (roleId: string, field: keyof PayrollRole, raw: string) => {
    patchPayrollRoleById(roleId, field, raw);
  };

  const addableCargos = useMemo(
    () => availablePayrollCatalogEntries(payrollRoles),
    [payrollRoles],
  );

  useEffect(() => {
    if (addCargoCatalogId && !addableCargos.some((e) => e.catalogId === addCargoCatalogId)) {
      setAddCargoCatalogId(addableCargos[0]?.catalogId ?? '');
    }
  }, [addableCargos, addCargoCatalogId]);

  const handleAddPayrollRole = () => {
    const entry = findPayrollCatalogEntry(addCargoCatalogId);
    if (!entry) return;
    upsertPayrollRole(payrollRoleFromCatalogEntry(entry, `pr-${Date.now()}`));
    setAddCargoCatalogId('');
  };

  // Commit Mix → ledger (preview until here)
  const handleApplyToGlobalModel = () => {
    commitMixPreview({
      p1: mixWeights.p1,
      p2: mixWeights.p2,
      p4: mixWeights.p4,
      p5: mixWeights.p5,
      presetName: activeMix.presetName,
    });
    setAppliedNotification(
      `⚡ Mix commitado no cadastro. MC R$ ${calculations.weightedMcPos.toFixed(2)}/pos.`,
    );
    setTimeout(() => setAppliedNotification(null), 5000);
  };

  const handleDiscardMix = () => {
    discardMixPreview();
    setMixWeights({
      p1: committedMixWeights.p1,
      p2: committedMixWeights.p2,
      p4: committedMixWeights.p4,
      p5: committedMixWeights.p5,
    });
  };

  // Filtered raw json table
  const filteredJsonData = useMemo(() => {
    if (!searchTerm.trim()) return RAW_MIX_DATA_JSON;
    const term = searchTerm.toLowerCase();
    return RAW_MIX_DATA_JSON.filter(
      (r) =>
        mixProfileLabel(r.Perfil).toLowerCase().includes(term) ||
        r.Gatilho.toLowerCase().includes(term) ||
        r.Cap_regra.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  // Chart Data for Recharts
  const chartBreakEvenData = useMemo(() => {
    const cap = hubParams.capacity.totalPositions;
    const { custosOriginais, custosEnxutos, custosRealistas } = calculations;
    const beOf = (mcPos: number) => ({
      Original: mixBePct(custosOriginais, mcPos, cap),
      Enxuto: mixBePct(custosEnxutos, mcPos, cap),
      Realista: mixBePct(custosRealistas, mcPos, cap),
    });
    const p1 = beOf(52.5);
    const p2 = beOf(78);
    const p4 = beOf(67);
    const p5 = beOf(94);
    return [
      { name: 'P1 Estocador', ...p1 },
      { name: 'P2 Franquias', ...p2 },
      { name: 'P4 Academias', ...p4 },
      { name: 'P5 Premium', ...p5 },
      {
        name: 'Simulação Atual',
        Original: calculations.bePctOriginal,
        Enxuto: calculations.bePctEnxuto,
        Realista: calculations.bePctRealista,
      },
    ];
  }, [calculations, hubParams.capacity.totalPositions]);

  const chartMarginData = useMemo(() => {
    return [
      { perfil: 'P1 Estocador', MC: 52.5, Ticket: 68.95 },
      { perfil: 'P2 Franquias', MC: 78.0, Ticket: 94.45 },
      { perfil: 'P4 Academias', MC: 67.0, Ticket: 83.45 },
      { perfil: 'P5 Premium', MC: 94.0, Ticket: 110.45 },
      { perfil: 'Simulação Atual', MC: calculations.weightedMcPos, Ticket: calculations.weightedTicket },
    ];
  }, [calculations]);

  // Download CSV export handler
  const exportToCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    const cap = hubParams.capacity.totalPositions;
    csvContent +=
      'Perfil,MC_pos_R$,Ticket_R$,BE_CCT_pct,BE_Mediana_pct,BE_CAGED_pct,LL_100pct_ocup,4PL_M12,4PL_M24,Cap_Regra,Gatilho\n';
    RAW_MIX_DATA_JSON.forEach((row) => {
      const be = mixRowBePcts({
        mcPos: parseBrNumber(row['MC_pos_R$']),
        items: mestraLedger,
        payrollRoles,
        capacity: cap,
      });
      const pl = parse4plCt(row['4PL_CT_por_cliente_R$mes'], row.Perfil);
      csvContent += `"${mixProfileLabel(row.Perfil)}","${row['MC_pos_R$']}","${row['Ticket_R$']}","${be.cct}","${be.mediana}","${be.caged}","${row['LL_100pct_Realista']}","${format4plCell(pl.m12)}","${format4plCell(pl.m24)}","${row['Cap_regra']}","${row['Gatilho']}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Simulador_Mix_Clientes_HUB_FITNESS.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {/* Toast Notification Banner */}
      {appliedNotification && (
        <div className="bg-emerald-900 text-white p-4 rounded-xl shadow-lg border border-emerald-700 flex items-center justify-between animate-in fade-in slide-in-from-top">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-emerald-300 animate-pulse shrink-0" />
            <span className="text-xs md:text-sm font-bold">{appliedNotification}</span>
          </div>
          <button
            onClick={() => setAppliedNotification(null)}
            className="text-emerald-200 hover:text-white font-bold text-sm px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* HEADER SECTION */}
      {!embedded && (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 px-2.5 py-0.5 rounded-full border border-blue-200">
              {embedded ? 'M6 · Mix' : 'Módulo M11'}
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Modelagem Estratégica & Diretrizes do Board BP v3.5
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
            <Sliders className="w-6 h-6 text-blue-700" />
            <span>Simulador de Mix de Clientes & Critérios de Enquadramento</span>
          </h1>
          <p className="text-xs text-slate-600 mt-0.5 max-w-3xl">
            Simulador reativo de composições de carteira 3PL, critérios técnicos de enquadramento comercial, proxies comportamentais de identificação e diretrizes estratégicas para o Board Executivo do BP v3.5.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
          <button
            onClick={exportToCsv}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-300 transition-all cursor-pointer"
            title="Exportar dados para Excel (.csv)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Excel (.csv)</span>
          </button>

          <button
            onClick={handleDiscardMix}
            disabled={!isMixDirty || pitchMode}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              isMixDirty && !pitchMode
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            }`}
            title="Descartar preview do Mix"
          >
            <span>Descartar preview</span>
          </button>

          <button
            onClick={handleApplyToGlobalModel}
            disabled={totalMixSum !== 100 || !canCommit}
            className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
              totalMixSum === 100 && canCommit
                ? 'bg-blue-800 hover:bg-blue-900 text-white shadow-blue-200'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
            title="Aplicar Mix ao cadastro (Commit)"
          >
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span>Aplicar ao Cadastro</span>
          </button>
        </div>
      </div>
      )}

      {embedded && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={exportToCsv}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-300 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Excel (.csv)</span>
          </button>
          <button
            onClick={handleDiscardMix}
            disabled={!isMixDirty || pitchMode}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs border transition-all cursor-pointer ${
              isMixDirty && !pitchMode
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            }`}
          >
            Descartar preview
          </button>
          <button
            onClick={handleApplyToGlobalModel}
            disabled={totalMixSum !== 100 || !canCommit}
            className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all cursor-pointer ${
              totalMixSum === 100 && canCommit
                ? 'bg-blue-800 hover:bg-blue-900 text-white'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
            Aplicar ao Cadastro
          </button>
        </div>
      )}

      <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* SLIDERS PANEL (5 COLUMNS) */}
            <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    <span>Composição do Mix (% do total)</span>
                  </h2>
                  <p className="text-[11px] text-slate-500">Ajuste os percentuais das carteiras</p>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                    totalMixSum === 100
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}
                >
                  Soma: {totalMixSum}% {totalMixSum === 100 ? '✓ Ok' : '⚠️ deve ser 100%'}
                </div>
              </div>

              {/* Slider 1: P1 Estocador */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                    <span>P1 · Estocador</span>
                  </div>
                  <div className="font-mono font-black text-slate-900 text-sm">
                    {mixWeights.p1}%
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={mixWeights.p1}
                  onChange={(e) => {
                    setMixWeights((prev) => ({ ...prev, p1: Number(e.target.value) }));
                  }}
                  className="w-full accent-slate-700 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>MC: R$ 52,50/pos</span>
                  <span>Ticket: R$ 68,95</span>
                  <span className="text-amber-700 font-bold">Cap: máx 20%</span>
                </div>
              </div>

              {/* Slider 2: P2 Franquias */}
              <div className="space-y-2 bg-blue-50/60 p-3.5 rounded-xl border border-blue-200">
                <div className="flex justify-between items-center text-xs">
                  <div className="font-bold text-blue-950 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                    <span>P2 · Franquias</span>
                  </div>
                  <div className="font-mono font-black text-blue-900 text-sm">
                    {mixWeights.p2}%
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={mixWeights.p2}
                  onChange={(e) => {
                    setMixWeights((prev) => ({ ...prev, p2: Number(e.target.value) }));
                  }}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>MC: R$ 78,00/pos</span>
                  <span>Ticket: R$ 94,45</span>
                  <span className="text-blue-700 font-bold">Cap: máx 35%</span>
                </div>
              </div>

              {/* Slider 3: P4 B2B Academias */}
              <div className="space-y-2 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
                <div className="flex justify-between items-center text-xs">
                  <div className="font-bold text-amber-950 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                    <span>P4 · B2B Academias</span>
                  </div>
                  <div className="font-mono font-black text-amber-900 text-sm">
                    {mixWeights.p4}%
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={mixWeights.p4}
                  onChange={(e) => {
                    setMixWeights((prev) => ({ ...prev, p4: Number(e.target.value) }));
                  }}
                  className="w-full accent-amber-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>MC: R$ 67,00/pos</span>
                  <span>Ticket: R$ 83,45</span>
                  <span className="text-amber-800 font-bold">Cap: máx 30%</span>
                </div>
              </div>

              {/* Slider 4: P5 Premium */}
              <div className="space-y-2 bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
                <div className="flex justify-between items-center text-xs">
                  <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                    <span>P5 · Premium</span>
                  </div>
                  <div className="font-mono font-black text-emerald-900 text-sm">
                    {mixWeights.p5}%
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={mixWeights.p5}
                  onChange={(e) => {
                    setMixWeights((prev) => ({ ...prev, p5: Number(e.target.value) }));
                  }}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>MC: R$ 94,00/pos</span>
                  <span>Ticket: R$ 110,45</span>
                  <span className="text-emerald-800 font-bold">Cap: mín 25%</span>
                </div>
              </div>

              <div className="space-y-2 bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200">
                <div className="flex justify-between items-center text-xs">
                  <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Posições ocupadas (Mix → Tornado)</span>
                  </div>
                  <div className="font-mono font-black text-indigo-900 text-sm">
                    {calculations.occupiedPositions.toLocaleString('pt-BR')} /{' '}
                    {calculations.totalCapacity.toLocaleString('pt-BR')}
                  </div>
                </div>
                <input
                  type="range"
                  min={occupiedPositionsFromRate(MIX_OCCUPANCY_MIN, calculations.totalCapacity)}
                  max={calculations.totalCapacity}
                  step={1}
                  disabled={!canEditOcc}
                  value={calculations.occupiedPositions}
                  onChange={(e) =>
                    updateScenarioDrivers(activeScenarioId, {
                      occupancyRate: occupancyRateFromOccupied(
                        Number(e.target.value),
                        calculations.totalCapacity,
                      ),
                    })
                  }
                  className="w-full accent-indigo-700 cursor-pointer disabled:opacity-50"
                />
                <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                  <span>{calculations.occPct}% ocupação</span>
                  <span>Ticket Mix (não piso SANCO)</span>
                  <span className="text-indigo-800 font-bold">100% = {calculations.totalCapacity.toLocaleString('pt-BR')} pos</span>
                </div>
              </div>

              {/* Quick Normalizer Button */}
              {totalMixSum !== 100 && (
                <button
                  onClick={() => {
                    if (totalMixSum === 0) {
                      setMixWeights({ p1: 20, p2: 30, p4: 25, p5: 25 });
                      return;
                    }
                    const factor = 100 / totalMixSum;
                    setMixWeights({
                      p1: Math.round(mixWeights.p1 * factor),
                      p2: Math.round(mixWeights.p2 * factor),
                      p4: Math.round(mixWeights.p4 * factor),
                      p5: Math.round(mixWeights.p5 * factor),
                    });
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Normalizar Automático para 100%</span>
                </button>
              )}
            </div>

            {/* METRICS CARDS & COMPLIANCE TRIGGERS (7 COLUMNS) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Top Indicator Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* MC/pos */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    MC Média Ponderada
                  </span>
                  <div className="text-2xl font-black text-slate-900 font-mono mt-1">
                    R$ {calculations.weightedMcPos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">por posição palete/mês</span>
                </div>

                {/* Ticket Médio */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Ticket Médio Ponderado
                  </span>
                  <div className="text-2xl font-black text-blue-900 font-mono mt-1">
                    R$ {calculations.weightedTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">faturamento por posição</span>
                </div>

                {/* BE Realista (contrato E) */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Break-Even Realista
                    </span>
                    <ContractChip id="E_SEMIFIXO_BE" />
                  </div>
                  <div
                    className={`text-2xl font-black font-mono mt-1 ${
                      calculations.bePctRealista <= 75 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {calculations.bePctRealista.toLocaleString('pt-BR')}%
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    meta safe ≤ {calculations.targetOccPct}% ({calculations.bePositionsRealista.toLocaleString('pt-BR')}{' '}
                    pos) · Mix ocupa {calculations.occPct}% · folga{' '}
                    {calculations.beSlackRealista >= 0 ? '+' : ''}
                    {calculations.beSlackRealista.toLocaleString('pt-BR')} pp
                    <span className="block text-slate-400">
                      Custo R${Math.round(calculations.custosRealistas / 1000)}k · RH ref.{' '}
                      {MIX_COST_MODE_LABELS[calculations.costMode]}{' '}
                      {calculations.bePctSelected.toLocaleString('pt-BR')}%
                    </span>
                  </span>
                </div>

                {/* Lucro Líquido 100% Realista */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Lucro Líq. (100% Ocup.)
                  </span>
                  <div className="text-xl font-black text-emerald-800 font-mono mt-1">
                    R$ {calculations.ll100Realista.toLocaleString('pt-BR')}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Custo Realista R${Math.round(calculations.custosRealistas / 1000)}k
                  </span>
                </div>

                {/* Lucro Líquido ocupação atual */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Lucro Líq. ({calculations.occPct}% · {calculations.occupiedPositions.toLocaleString('pt-BR')} pos)
                  </span>
                  <div className="text-xl font-black text-emerald-900 font-mono mt-1">
                    R$ {calculations.llOccRealista.toLocaleString('pt-BR')}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Mesma ocupação do Tornado / A/B
                  </span>
                </div>

                {/* 4PL Revenue */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Receita 4PL Control Tower
                  </span>
                  <div className="text-xl font-black text-indigo-900 font-mono mt-1">
                    R$ {calculations.ct4plM12.toLocaleString('pt-BR')}/m
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    M12: R${calculations.ct4plM12.toLocaleString('pt-BR')} | M24: R${calculations.ct4plM24.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Compliance & Risk Triggers Box */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Validação de Travas de Compliance & Gatilhos de Risco
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">Auditoria Automática</span>
                </div>

                {calculations.triggers.length > 0 ? (
                  <div className="space-y-2">
                    {calculations.triggers.map((tr, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2.5 ${
                          tr.type === 'danger'
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{tr.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Mix em total conformidade! Todos os limites operacionais e de diversificação foram atendidos com folga de margem.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Cargos e salários · benchmark logístico SC
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  disabled={!canEditOcc || addableCargos.length === 0}
                  value={addCargoCatalogId}
                  onChange={(e) => setAddCargoCatalogId(e.target.value)}
                  className="max-w-[min(22rem,70vw)] h-8 px-2 text-[11px] border border-slate-600 bg-slate-800 text-white rounded-lg cursor-pointer disabled:opacity-40"
                  aria-label="Cargo do plano de contas"
                >
                  <option value="">
                    {addableCargos.length === 0
                      ? 'Todos os cargos do catálogo já incluídos'
                      : 'Plano de contas de cargos…'}
                  </option>
                  {addableCargos.map((entry) => (
                    <option key={entry.catalogId} value={entry.catalogId}>
                      {payrollCatalogLabel(entry)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!canEditOcc || !addCargoCatalogId}
                  onClick={handleAddPayrollRole}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar cargo
                </button>
              </div>
            </div>
            <p className="px-4 py-2 text-[11px] text-slate-600 bg-slate-50 border-b border-slate-200 leading-relaxed">
              <strong className="text-slate-800">Piso bruto</strong> = benchmark R$/HC (sem encargos).{' '}
              <strong className="text-slate-800">Encargos</strong> = pack Simples{' '}
              {(PAYROLL_SIMPLES_PACK_PCT * 100).toFixed(1)}% (FGTS+13º+férias) × HC.{' '}
              <strong className="text-slate-800">Folha</strong> = (piso + encargos/HC) × HC. INSS/RAT no DAS.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse min-w-240">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 align-bottom" rowSpan={2}>
                      Cargo
                    </th>
                    <th className="py-2 px-3 align-bottom" rowSpan={2}>
                      CC
                    </th>
                    <th className="py-2 px-3 text-right font-mono align-bottom" rowSpan={2}>
                      HC
                    </th>
                    {PAYROLL_BENCHMARK_GROUPS.map((g) => (
                      <th
                        key={g.mode}
                        colSpan={3}
                        className="py-2 px-2 text-center font-sans border-l border-slate-200 bg-slate-50/80"
                      >
                        {g.label}
                      </th>
                    ))}
                    <th className="py-2 px-3 w-10" rowSpan={2} />
                  </tr>
                  <tr>
                    {PAYROLL_BENCHMARK_GROUPS.flatMap((g) => [
                      <th
                        key={`${g.mode}-piso`}
                        className="py-1.5 px-2 text-right font-mono text-[10px] border-l border-slate-200"
                      >
                        Piso bruto
                        <span className="block font-normal text-slate-500">R$/HC</span>
                      </th>,
                      <th key={`${g.mode}-enc`} className="py-1.5 px-2 text-right font-mono text-[10px]">
                        Encargos
                        <span className="block font-normal text-slate-500">pack × HC</span>
                      </th>,
                      <th key={`${g.mode}-folha`} className="py-1.5 px-2 text-right font-mono text-[10px]">
                        Folha
                        <span className="block font-normal text-slate-500">mês</span>
                      </th>,
                    ])}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {payrollRoles.map((role) => (
                    <tr key={role.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <input
                          disabled={!canEditOcc}
                          value={role.cargo}
                          onChange={(e) => patchPayrollField(role.id, 'cargo', e.target.value)}
                          className="w-full bg-transparent font-semibold text-slate-900 outline-none"
                        />
                        <input
                          disabled={!canEditOcc}
                          value={role.detail}
                          onChange={(e) => patchPayrollField(role.id, 'detail', e.target.value)}
                          className="w-full bg-transparent text-[10px] text-slate-500 outline-none"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          disabled={!canEditOcc}
                          value={role.cc}
                          onChange={(e) => patchPayrollField(role.id, 'cc', e.target.value)}
                          className="w-20 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 font-mono"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          disabled={!canEditOcc}
                          value={role.hc}
                          onChange={(e) => patchPayrollField(role.id, 'hc', e.target.value)}
                          className="w-14 bg-slate-50 border border-slate-200 rounded px-2 py-1 font-mono text-right"
                        />
                      </td>
                      {PAYROLL_BENCHMARK_GROUPS.map((g) => {
                        const encPerHc = payrollEncargosPerHc(role, g.mode);
                        const encTotal = payrollEncargosTotal(role, g.mode);
                        const folha = payrollAmount(role, g.mode);
                        return (
                          <React.Fragment key={`${role.id}-${g.mode}-${role.hc}`}>
                            <td className="py-2 px-2 text-right border-l border-slate-100">
                              <input
                                type="number"
                                disabled={!canEditOcc}
                                value={role[g.field] ?? 0}
                                onChange={(e) => patchPayrollField(role.id, g.field, e.target.value)}
                                className="w-18 bg-amber-50 border border-amber-200 rounded px-2 py-1 font-mono text-right"
                              />
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-slate-700">
                              {encPerHc === null ? (
                                <span className="text-slate-400">—</span>
                              ) : (
                                <>
                                  {encTotal.toLocaleString('pt-BR')}
                                  <span className="block text-[10px] text-slate-500">
                                    {encPerHc.toLocaleString('pt-BR')}/HC
                                  </span>
                                </>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-semibold text-slate-900">
                              {folha.toLocaleString('pt-BR')}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          disabled={!canEditOcc}
                          onClick={() => deletePayrollRole(role.id)}
                          className="text-rose-600 disabled:opacity-40 cursor-pointer"
                          title="Excluir cargo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-mono font-bold">
                    <td className="py-2 px-3 font-sans" colSpan={3}>
                      Totais mensais
                    </td>
                    {PAYROLL_BENCHMARK_GROUPS.flatMap((g) => [
                      <td key={`${g.mode}-piso-t`} className="py-2 px-2 text-right border-l border-slate-700">
                        <span className="text-[10px] font-normal text-slate-400">—</span>
                      </td>,
                      <td key={`${g.mode}-enc-t`} className="py-2 px-2 text-right">
                        {payrollEncargosGrandTotal(payrollRoles, g.mode).toLocaleString('pt-BR')}
                      </td>,
                      <td key={`${g.mode}-folha-t`} className="py-2 px-2 text-right">
                        {payrollTotal(payrollRoles, g.mode).toLocaleString('pt-BR')}
                      </td>,
                    ])}
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* COMPARATIVE VISUAL CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HubChartCard
              title={
                <span className="flex items-center gap-2 flex-wrap">
                  <BarChart3 className="w-4 h-4 text-sky-700" />
                  Ponto de Equilíbrio (Break-Even %) por Perfil & Mix
                  <ContractChip id="E_SEMIFIXO_BE" />
                </span>
              }
              subtitle="Contrato E — Original (+15%) · Enxuto (−15%) · Realista (semifixo ledger)."
              badge={`${calculations.totalCapacity.toLocaleString('pt-BR')} pos.`}
              plotClassName="h-64 w-full pt-2"
              legend={
                <>
                  <HubChartLegendPill tone="slate">
                    Original (R${Math.round(calculations.custosOriginais / 1000)}k)
                  </HubChartLegendPill>
                  <HubChartLegendPill tone="sky">
                    Enxuto (R${Math.round(calculations.custosEnxutos / 1000)}k)
                  </HubChartLegendPill>
                  <HubChartLegendPill tone="indigo">
                    Realista (R${Math.round(calculations.custosRealistas / 1000)}k)
                  </HubChartLegendPill>
                </>
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartBreakEvenData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={HUB_CHART.grid} />
                  <XAxis dataKey="name" tick={hubTick} />
                  <YAxis unit="%" domain={[0, 120]} tick={hubTick} />
                  <Tooltip formatter={(val) => [`${Number(val ?? 0)}%`, 'Break-Even']} contentStyle={hubTooltipStyle} />
                  <Bar dataKey="Original" fill={HUB_CHART.strokeMuted} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Enxuto" fill={HUB_CHART.strokeAlt} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Realista" fill={HUB_CHART.stroke} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </HubChartCard>

            <HubChartCard
              title={
                <span className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-sky-700" />
                  Margem de Contribuição vs. Ticket Médio (R$/pos)
                </span>
              }
              subtitle="Posição palete/mês — cyan = MC · slate = ticket."
              badge="R$/pos"
              plotClassName="h-64 w-full pt-2"
              legend={
                <>
                  <HubChartLegendPill tone="sky">Margem Contribuição (MC)</HubChartLegendPill>
                  <HubChartLegendPill tone="slate">Ticket Médio</HubChartLegendPill>
                </>
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartMarginData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={HUB_CHART.grid} />
                  <XAxis dataKey="perfil" tick={hubTick} />
                  <YAxis unit=" R$" domain={[0, 130]} tick={hubTick} />
                  <Tooltip formatter={(val) => [`R$ ${Number(val ?? 0)}`, 'Valor/Mês']} contentStyle={hubTooltipStyle} />
                  <Bar dataKey="MC" fill={HUB_CHART.stroke} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Ticket" fill={HUB_CHART.strokeMuted} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </HubChartCard>
          </div>

          {/* Board Memo — Blend Alvo (F2: valores live do simulador) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-black text-slate-900">Board Memo — Viabilidade do Blend</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                §2 Blend Alvo dinâmico · Conservador/Agressivo = referência estática BP v3.5
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
              <div className="font-extrabold text-slate-900 text-sm">
                Blend Alvo (20/30/25/25) — Cenário Canônico de Equilíbrio
              </div>
              <p className="mt-1">
                • <span className="font-bold">MC Médio Ponderado:</span> R${' '}
                {calculations.weightedMcPos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/pos |{' '}
                <span className="font-bold">Segurança:</span> Break-Even Realista de{' '}
                {calculations.bePctRealista.toLocaleString('pt-BR')}% oferece{' '}
                <span className="font-bold text-emerald-700">
                  {Math.max(0, calculations.targetOccPct - calculations.bePctRealista).toLocaleString('pt-BR')} p.p. de
                  folga
                </span>{' '}
                vs limite {calculations.targetOccPct}% (M7+).
                <br />• <span className="font-bold">Lucratividade:</span> Lucro Líquido Realista de R${' '}
                {calculations.ll100Realista.toLocaleString('pt-BR')}/mês (a 100% ocupação) sustenta payback e Fator R.
                <br />• <span className="font-bold">Upside 4PL:</span> Control Tower R${' '}
                {calculations.ct4plM12.toLocaleString('pt-BR')}/m (M12) → R${' '}
                {calculations.ct4plM24.toLocaleString('pt-BR')}/m (M24).
              </p>
            </div>

            <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-300 text-xs text-slate-700 leading-relaxed">
              <div className="font-extrabold text-amber-950 text-sm">
                Blend Conservador (25/30/30/15) <span className="font-normal text-amber-800">(referência estática v3.5)</span>
              </div>
              <p className="mt-1">
                BE Realista 73,0% · LL 100% R$ 53.539/mês · exige VAS robusto para compensar queda de Premium.
              </p>
            </div>

            <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-300 text-xs text-slate-700 leading-relaxed">
              <div className="font-extrabold text-emerald-950 text-sm">
                Blend Agressivo (10/30/20/40){' '}
                <span className="font-normal text-emerald-800">(referência estática v3.5)</span>
              </div>
              <p className="mt-1">
                BE Realista 57,3% · LL 100% R$ 92.504/mês · alta alavancagem P5; monitorar concentração Premium.
              </p>
            </div>
          </div>

          {/* MASTER DATA TABLE - RAW JSON DATASET */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full uppercase">
                    Tabela Mestra de Premissas
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    12 Registros do Dataset Oficial
                  </span>
                </div>
                <h2 className="text-sm font-bold text-white mt-0.5">
                  Planilha de Perfis, Blends Pró-Formatados e Monoclientes
                </h2>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar perfil ou gatilho..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-700 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Perfil / Blend</th>
                    <th className="py-2.5 px-3 text-right">MC pos (R$)</th>
                    <th className="py-2.5 px-3 text-right">Ticket (R$)</th>
                    <th className="py-2.5 px-3 text-right">BE CCT</th>
                    <th className="py-2.5 px-3 text-right">BE Mediana</th>
                    <th className="py-2.5 px-3 text-right">BE CAGED</th>
                    <th className="py-2.5 px-3 text-right">LL 100% ocup.</th>
                    <th className="py-2.5 px-3 text-right">4PL M12</th>
                    <th className="py-2.5 px-3 text-right">4PL M24</th>
                    <th className="py-2.5 px-3">Regra Cap</th>
                    <th className="py-2.5 px-3">Gatilho de Risco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800 font-mono text-[11px]">
                  {filteredJsonData.map((row, idx) => {
                    const label = mixProfileLabel(row.Perfil);
                    const kind = mixProfileKind(row.Perfil);
                    const be = mixRowBePcts({
                      mcPos: parseBrNumber(row['MC_pos_R$']),
                      items: mestraLedger,
                      payrollRoles,
                      capacity: hubParams.capacity.totalPositions,
                    });
                    const pl = parse4plCt(row['4PL_CT_por_cliente_R$mes'], row.Perfil);

                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-blue-50/60 transition-colors ${
                          kind === 'blend'
                            ? 'bg-blue-50/30 font-semibold'
                            : kind === 'vetado'
                            ? 'bg-rose-50/20'
                            : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-900 flex items-center gap-1.5">
                          {kind === 'vetado' && (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded text-[9px] uppercase font-bold">
                              Vetado
                            </span>
                          )}
                          <span>{label}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-800 font-bold">
                          R$ {row['MC_pos_R$']}
                        </td>
                        <td className="py-2.5 px-3 text-right text-blue-900 font-medium">
                          R$ {row['Ticket_R$']}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">{be.cct}%</td>
                        <td className="py-2.5 px-3 text-right text-emerald-700">{be.mediana}%</td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-900">{be.caged}%</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                          {row.LL_100pct_Realista !== '—'
                            ? `R$ ${Number(row.LL_100pct_Realista).toLocaleString('pt-BR')}`
                            : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700">{format4plCell(pl.m12)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-700">{format4plCell(pl.m24)}</td>
                        <td className="py-2.5 px-3 font-sans text-[10px] font-bold text-slate-600">
                          {row.Cap_regra}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-[10px] text-slate-600">
                          {row.Gatilho}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
    </div>
  );
};
