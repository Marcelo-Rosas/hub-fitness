import React, { useState, useMemo, useEffect } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { RAW_MIX_DATA_JSON, PROFILE_PRESETS } from '../../data/mixSimulatorData';
import { M11PlanoDeContas } from './M11PlanoDeContas';
import { fixedOpexMonthlyFromLedger } from '../../core/engine';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../../data/initialData';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  Sparkles,
  Zap,
  TrendingUp,
  ShieldAlert,
  BarChart3,
  DollarSign,
  PieChart,
  Layers,
  Info,
  ArrowUpRight,
  RotateCcw,
  Search,
  Filter,
  BookOpen,
  FileText,
  Target,
  Users,
  AlertOctagon,
  Check,
  Scale,
  Building,
  Lock,
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
import { HubChartCard } from '../charts/HubChartCard';
import { HUB_CHART, HubChartLegendPill, hubTick, hubTooltipStyle } from '../charts/hubChartTheme';

export const M11SimuladorMix: React.FC<{
  embedPanel?: 'simulator' | 'enquadramento' | 'board_memo' | 'plano_contas';
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
  } = usePlanner();

  const canCommit = (activeRole === 'cfo' || activeRole === 'socio') && !pitchMode;

  // Navigation tab state (ignored when embedPanel set by M6 shell)
  const [localTab, setLocalTab] = useState<'simulator' | 'enquadramento' | 'board_memo' | 'plano_contas'>('simulator');
  const activeTab = embedPanel ?? localTab;
  const setActiveTab = setLocalTab;
  const embedded = !!embedPanel;

  // Local weights for smooth slider interaction
  const [mixWeights, setMixWeights] = useState({
    p1: activeMix.p1 ?? 20,
    p2: activeMix.p2 ?? 30,
    p4: activeMix.p4 ?? 25,
    p5: activeMix.p5 ?? 25,
  });

  const [activePresetKey, setActivePresetKey] = useState<string>('blend_alvo');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [appliedNotification, setAppliedNotification] = useState<string | null>(null);

  const totalMixSum = mixWeights.p1 + mixWeights.p2 + mixWeights.p4 + mixWeights.p5;

  // Preview path: keep Context activeMix in sync (Tornado / Fator R live)
  useEffect(() => {
    updateActiveMix({
      p1: mixWeights.p1,
      p2: mixWeights.p2,
      p4: mixWeights.p4,
      p5: mixWeights.p5,
      presetName: activePresetKey,
    });
    // Intentionally omit updateActiveMix — identity changes every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixWeights.p1, mixWeights.p2, mixWeights.p4, mixWeights.p5, activePresetKey]);

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
    const safeMc = weightedMcPos > 0 ? weightedMcPos : 1;

    const ledger = ledgerBaseItems.length ? ledgerBaseItems : INITIAL_GRANULAR_DRE_ITEMS;
    const custosRealistas = fixedOpexMonthlyFromLedger(ledger);
    const custosOriginais = Math.round(custosRealistas * 1.15);
    const custosEnxutos = Math.round(custosRealistas * 0.85);

    const bePositionsOriginal = custosOriginais / safeMc;
    const bePositionsEnxuto = custosEnxutos / safeMc;
    const bePositionsRealista = custosRealistas / safeMc;

    const bePctOriginal = Number(((bePositionsOriginal / totalCapacity) * 100).toFixed(1));
    const bePctEnxuto = Number(((bePositionsEnxuto / totalCapacity) * 100).toFixed(1));
    const bePctRealista = Number(((bePositionsRealista / totalCapacity) * 100).toFixed(1));

    const ll100Original = Math.round(totalCapacity * weightedMcPos - custosOriginais);
    const ll100Enxuto = Math.round(totalCapacity * weightedMcPos - custosEnxutos);
    const ll100Realista = Math.round(totalCapacity * weightedMcPos - custosRealistas);

    const pos88 = Math.round(totalCapacity * hubParams.year3.galpaoAOccupancy);
    const ll88Original = Math.round(pos88 * weightedMcPos - custosOriginais);
    const ll88Enxuto = Math.round(pos88 * weightedMcPos - custosEnxutos);
    const ll88Realista = Math.round(pos88 * weightedMcPos - custosRealistas);

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
      pos88,
      custosOriginais,
      custosEnxutos,
      custosRealistas,
      bePctOriginal,
      bePctEnxuto,
      bePctRealista,
      ll100Original,
      ll100Enxuto,
      ll100Realista,
      ll88Original,
      ll88Enxuto,
      ll88Realista,
      triggers,
    };
  }, [mixWeights, hubParams, ledgerBaseItems]);

  // Handler to load preset
  const handleSelectPreset = (key: string) => {
    const preset = PROFILE_PRESETS[key];
    if (preset) {
      setActivePresetKey(key);
      const newWeights = { p1: preset.p1, p2: preset.p2, p4: preset.p4, p5: preset.p5 };
      setMixWeights(newWeights);
      updateActiveMix({ ...newWeights, presetName: preset.presetName });
    }
  };

  // Commit Mix → ledger (preview until here)
  const handleApplyToGlobalModel = () => {
    commitMixPreview({
      p1: mixWeights.p1,
      p2: mixWeights.p2,
      p4: mixWeights.p4,
      p5: mixWeights.p5,
      presetName: activePresetKey,
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
        r.Perfil.toLowerCase().includes(term) ||
        r.Gatilho.toLowerCase().includes(term) ||
        r.Cap_regra.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  // Chart Data for Recharts
  const chartBreakEvenData = useMemo(() => {
    return [
      { name: 'P1 Estocador', Original: 105.2, Enxuto: 77.0, Realista: 91.8 },
      { name: 'P2 Franquias', Original: 70.8, Enxuto: 51.8, Realista: 61.8 },
      { name: 'P4 Academias', Original: 82.5, Enxuto: 60.3, Realista: 71.9 },
      { name: 'P5 Premium', Original: 58.8, Enxuto: 43.0, Realista: 51.3 },
      {
        name: 'Simulação Atual',
        Original: calculations.bePctOriginal,
        Enxuto: calculations.bePctEnxuto,
        Realista: calculations.bePctRealista,
      },
    ];
  }, [calculations]);

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
    const oK = Math.round(calculations.custosOriginais / 1000);
    const eK = Math.round(calculations.custosEnxutos / 1000);
    const rK = Math.round(calculations.custosRealistas / 1000);
    csvContent += `Perfil,MC_pos_R$,Ticket_R$,BE_Original_${oK}k_pct,BE_Enxuto_${eK}k_pct,BE_Realista_${rK}k_pct,LL_100pct_Realista,4PL_CT_R$mes,Mix_Recomendado,Cap_Regra,Gatilho\n`;
    RAW_MIX_DATA_JSON.forEach((row) => {
      csvContent += `"${row.Perfil}","${row['MC_pos_R$']}","${row['Ticket_R$']}","${row['BE_Original_164k_pct']}","${row['BE_Enxuto_120k_pct']}","${row['BE_Realista_143k_pct']}","${row['LL_100pct_Realista']}","${row['4PL_CT_por_cliente_R$mes']}","${row['Mix_recomendado']}","${row['Cap_regra']}","${row['Gatilho']}"\n`;
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
    <div className="space-y-6">
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

      {embedded && activeTab === 'simulator' && (
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

      {/* VIEW TABS BAR */}
      {!embedded && (
      <div className="flex items-center gap-2 bg-slate-200/80 p-1.5 rounded-xl border border-slate-300/80">
        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'simulator'
              ? 'bg-white text-blue-900 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sliders className="w-4 h-4 text-blue-700" />
          <span>Simulador Interativo & Cenários</span>
        </button>

        <button
          onClick={() => setActiveTab('enquadramento')}
          className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'enquadramento'
              ? 'bg-white text-blue-900 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Target className="w-4 h-4 text-emerald-700" />
          <span>Critérios Técnicos de Enquadramento</span>
        </button>

        <button
          onClick={() => setActiveTab('board_memo')}
          className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'board_memo'
              ? 'bg-white text-blue-900 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4 text-amber-600" />
          <span>Leitura Técnica ao Board Executivo</span>
        </button>

        <button
          onClick={() => setActiveTab('plano_contas')}
          className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'plano_contas'
              ? 'bg-white text-blue-900 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4 text-emerald-600" />
          <span>Plano de Contas PCASP</span>
        </button>
      </div>
      )}

      {/* TAB 1: INTERACTIVE SIMULATOR */}
      {activeTab === 'simulator' && (
        <>
          {/* PRESETS SELECTOR BAR */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Blends Pró-Formatados & Blends de Mercado
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Selecione uma predefinição auditada para carregar os pesos no simulador
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {Object.entries(PROFILE_PRESETS).map(([key, preset]) => {
                const isSelected = activePresetKey === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleSelectPreset(key)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-600 border-blue-400 text-white shadow-md ring-2 ring-blue-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="text-[10px] font-bold uppercase opacity-80">{preset.label}</div>
                      <div className="text-xs font-black mt-1 font-mono">
                        {preset.p1}/{preset.p2}/{preset.p4}/{preset.p5}
                      </div>
                    </div>
                    {key.includes('monocliente') && (
                      <span className="mt-2 text-[9px] font-bold bg-rose-500/30 text-rose-300 px-1.5 py-0.5 rounded border border-rose-400/30 w-fit">
                        Vetado
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* INTERACTIVE SLIDERS & LIVE CALCULATION CARDS GRID */}
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
                    setActivePresetKey('custom');
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
                    setActivePresetKey('custom');
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
                    setActivePresetKey('custom');
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
                    setActivePresetKey('custom');
                  }}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>MC: R$ 94,00/pos</span>
                  <span>Ticket: R$ 110,45</span>
                  <span className="text-emerald-800 font-bold">Cap: mín 25%</span>
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

                {/* BE Realista */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Break-Even (Realista)
                  </span>
                  <div
                    className={`text-2xl font-black font-mono mt-1 ${
                      calculations.bePctRealista <= 75 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {calculations.bePctRealista}%
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    meta safe &lt;= {calculations.targetOccPct}% ({Math.round((calculations.totalCapacity * calculations.bePctRealista) / 100)} pos)
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

                {/* Lucro Líquido 88% Realista */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Lucro Líq. (88% Ocup.)
                  </span>
                  <div className="text-xl font-black text-emerald-900 font-mono mt-1">
                    R$ {calculations.ll88Realista.toLocaleString('pt-BR')}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Custo Realista R${Math.round(calculations.custosRealistas / 1000)}k
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

          {/* COMPARATIVE VISUAL CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HubChartCard
              title={
                <span className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-sky-700" />
                  Ponto de Equilíbrio (Break-Even %) por Perfil & Mix
                </span>
              }
              subtitle="Barras por perfil — mesmo chrome da curva de caixa M4."
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
                    <th className="py-2.5 px-3 text-right">
                      BE Orig ({Math.round(calculations.custosOriginais / 1000)}k)
                    </th>
                    <th className="py-2.5 px-3 text-right">
                      BE Enx ({Math.round(calculations.custosEnxutos / 1000)}k)
                    </th>
                    <th className="py-2.5 px-3 text-right">
                      BE Real ({Math.round(calculations.custosRealistas / 1000)}k)
                    </th>
                    <th className="py-2.5 px-3 text-right">LL 100% Realist</th>
                    <th className="py-2.5 px-3 text-right">4PL CT (R$/m)</th>
                    <th className="py-2.5 px-3">Regra Cap</th>
                    <th className="py-2.5 px-3">Gatilho de Risco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800 font-mono text-[11px]">
                  {filteredJsonData.map((row, idx) => {
                    const isBlend = row.Perfil.toLowerCase().includes('blend');
                    const isMono = row.Perfil.toLowerCase().includes('monocliente');

                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-blue-50/60 transition-colors ${
                          isBlend
                            ? 'bg-blue-50/30 font-semibold'
                            : isMono
                            ? 'bg-rose-50/20'
                            : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-sans font-bold text-slate-900 flex items-center gap-1.5">
                          {isMono && (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded text-[9px] uppercase font-bold">
                              Vetado
                            </span>
                          )}
                          <span>{row.Perfil}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-800 font-bold">
                          R$ {row['MC_pos_R$']}
                        </td>
                        <td className="py-2.5 px-3 text-right text-blue-900 font-medium">
                          R$ {row['Ticket_R$']}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {row.BE_Original_164k_pct}%
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-700">
                          {row.BE_Enxuto_120k_pct}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-900">
                          {row.BE_Realista_143k_pct}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                          {row.LL_100pct_Realista !== '—' ? `R$ ${Number(row.LL_100pct_Realista).toLocaleString('pt-BR')}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700">
                          {row['4PL_CT_por_cliente_R$mes']}
                        </td>
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
      )}

      {/* TAB 2: TECHNICAL ENQUADRAMENTO MATRIX & PROXIES */}
      {activeTab === 'enquadramento' && (
        <div className="space-y-6">
          {/* MATRIZ DE ENQUADRAMENTO TÉCNICO COMPLETA */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  Matriz Executiva Atualizada
                </span>
                <h2 className="text-lg font-black text-white mt-1">
                  Matriz de Perfis, Definição Técnica & Critérios de Enquadramento
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Classificação baseada em complexidade operacional e comportamento de estoque para eliminar subjetividade comercial.
                </p>
              </div>
              <Target className="w-8 h-8 text-emerald-400 shrink-0" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-800 font-bold text-[10px] uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 w-36">Perfil</th>
                    <th className="py-3 px-4">Definição Técnica & Critérios de Enquadramento</th>
                    <th className="py-3 px-4 text-right w-24">MC/Pos (R$)</th>
                    <th className="py-3 px-4 text-right w-28">
                      BE Real ({Math.round(calculations.custosRealistas / 1000)}k)
                    </th>
                    <th className="py-3 px-4 w-72">Gatilho de Risco & Ação Executiva</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800 text-xs">
                  {/* P5 Premium */}
                  <tr className="bg-emerald-50/20 hover:bg-emerald-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5 text-emerald-900 font-extrabold text-sm">
                        <span className="w-3 h-3 rounded-full bg-emerald-600 shrink-0"></span>
                        <span>P5_Premium</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                        Âncora de Margem
                      </span>
                    </td>
                    <td className="py-3.5 px-4 space-y-1 text-slate-700">
                      <div className="font-bold text-slate-900">
                        Cliente de alta complexidade operacional ou valor agregado (não necessariamente alto volume).
                      </div>
                      <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-emerald-200">
                        <span className="font-bold text-emerald-900 block mb-1">Critérios (Basta atender a 1):</span>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                          <li>Ticket médio &gt; R$ 100/posição</li>
                          <li>Exige VAS técnico (kitting, montagem, teste físico)</li>
                          <li>SLA de logística reversa &lt; 24h</li>
                          <li>Ad Valorem &gt; 0,15%</li>
                          <li>Equipamentos / carga pesada &gt; 500kg/unidade</li>
                        </ul>
                      </div>
                      <p className="text-[10px] font-bold text-emerald-800 italic">
                        Nota: Premium é definido pela densidade de margem por posição, não pelo faturamento total.
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-800 text-sm">
                      R$ 94,00
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                      51,3%
                    </td>
                    <td className="py-3.5 px-4 text-xs space-y-1">
                      <div className="font-bold text-rose-900">Risco: &lt; 20% do mix.</div>
                      <div className="text-slate-700">
                        <span className="font-bold">Ação:</span> Perda estrutural de margem. Se cair abaixo, acionar revisão imediata de preço ou substituição por P2/P4 com VAS atrelado.
                      </div>
                    </td>
                  </tr>

                  {/* P2 Franquias */}
                  <tr className="bg-blue-50/20 hover:bg-blue-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5 text-blue-900 font-extrabold text-sm">
                        <span className="w-3 h-3 rounded-full bg-blue-600 shrink-0"></span>
                        <span>P2_Franquias</span>
                      </div>
                      <span className="text-[10px] text-blue-700 font-semibold block mt-0.5">
                        Estabilizador Volume
                      </span>
                    </td>
                    <td className="py-3.5 px-4 space-y-1 text-slate-700">
                      <div className="font-bold text-slate-900">
                        Rede com contrato centralizado e distribuição capilar padronizada.
                      </div>
                      <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-blue-200">
                        <span className="font-bold text-blue-900 block mb-1">Critérios Obrigatórios:</span>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                          <li>Contrato master assinado com CNPJ raiz</li>
                          <li>Entrega mensal em &ge; 5 endereços distintos</li>
                          <li>Pedido recorrente com padrão SKU fixo</li>
                          <li>Faturamento mensal previsível (&plusmn;15%)</li>
                        </ul>
                      </div>
                      <p className="text-[10px] font-bold text-rose-800 italic">
                        Exclusão: Franqueado comprando isoladamente sem contrato master = P4 ou P1.
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-blue-900 text-sm">
                      R$ 78,00
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-800 text-sm">
                      61,8%
                    </td>
                    <td className="py-3.5 px-4 text-xs space-y-1">
                      <div className="font-bold text-amber-900">Risco: &gt; 40% concentração geográfica.</div>
                      <div className="text-slate-700">
                        <span className="font-bold">Ação:</span> Monitorar CEPs de destino. Diversificar regiões para evitar travamento logístico regionalizado.
                      </div>
                    </td>
                  </tr>

                  {/* P4 B2B Academias */}
                  <tr className="bg-amber-50/20 hover:bg-amber-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5 text-amber-900 font-extrabold text-sm">
                        <span className="w-3 h-3 rounded-full bg-amber-600 shrink-0"></span>
                        <span>P4_B2B Academias</span>
                      </div>
                      <span className="text-[10px] text-amber-800 font-semibold block mt-0.5">
                        Volume Sazonal / Cíclico
                      </span>
                    </td>
                    <td className="py-3.5 px-4 space-y-1 text-slate-700">
                      <div className="font-bold text-slate-900">
                        Pessoa Jurídica com compra corporativa cíclica/sazonal.
                      </div>
                      <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-amber-200">
                        <span className="font-bold text-amber-900 block mb-1">Critérios Obrigatórios:</span>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                          <li>CNPJ ativo com CNAE compatível (Academias / Fitness)</li>
                          <li>Compra em lote (&ge; 10 posições por pedido)</li>
                          <li>Sazonalidade identificável (semestral / virada de ano)</li>
                          <li>Sem exigência de VAS técnico complexo</li>
                        </ul>
                      </div>
                      <p className="text-[10px] text-slate-600 italic">
                        Diferencia-se do P2 pela ausência de contrato master e pela alta ciclicidade.
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-amber-900 text-sm">
                      R$ 67,00
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-800 text-sm">
                      71,9%
                    </td>
                    <td className="py-3.5 px-4 text-xs space-y-1">
                      <div className="font-bold text-amber-900">Risco: &gt; 35% do mix.</div>
                      <div className="text-slate-700">
                        <span className="font-bold">Ação:</span> Risco cíclico B2B. Exigir contrato com cláusula de take-or-pay ou VAS atrelado para estabilizar receita.
                      </div>
                    </td>
                  </tr>

                  {/* P1 Estocador */}
                  <tr className="bg-slate-100 hover:bg-slate-200/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5 text-slate-900 font-extrabold text-sm">
                        <span className="w-3 h-3 rounded-full bg-slate-600 shrink-0"></span>
                        <span>P1_Estocador</span>
                      </div>
                      <span className="text-[10px] text-slate-600 font-semibold block mt-0.5">
                        Preenchedor Tático
                      </span>
                    </td>
                    <td className="py-3.5 px-4 space-y-1 text-slate-700">
                      <div className="font-bold text-slate-900">
                        Cliente de baixa rotatividade e baixo valor agregado. Ocupa espaço sem gerar fluxo.
                      </div>
                      <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-300">
                        <span className="font-bold text-slate-900 block mb-1">Critérios Comportamentais (Fase Inicial / Sem WMS):</span>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                          <li>Giro de estoque &lt; 2x/mês (inferido via idade do saldo)</li>
                          <li>Solicitações de movimentação &lt; 3 por mês</li>
                          <li>Ausência total de contratação de VAS</li>
                          <li>Ticket efetivo &lt; R$ 60/posição após descontos</li>
                          <li>Reclamações frequentes sobre preço, nunca sobre SLA</li>
                        </ul>
                      </div>
                      <p className="text-[10px] font-bold text-slate-800 italic">
                        Teste Prático: Se o cliente paga armazenagem mas raramente solicita picking/expedição, é Estocador.
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm">
                      R$ 52,50
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-700 text-sm">
                      91,8%
                    </td>
                    <td className="py-3.5 px-4 text-xs space-y-1">
                      <div className="font-bold text-rose-900">Risco: &gt; 25% do mix.</div>
                      <div className="text-slate-700">
                        <span className="font-bold">Ação:</span> Gatilho de Churn + revisão de preço. Se o Break-Even subir &gt; 75%, eliminar P1 agressivamente (é lastro tóxico pós-M7).
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* DETALHAMENTO DE PROXIES COMPORTAMENTAIS E IDENTIFICAÇÃO DE ESTOCADORES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Proxy 1 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase">
                <Users className="w-4 h-4 text-blue-700" />
                <span>Proxy 1 · Contato Operacional</span>
              </div>
              <h3 className="text-sm font-black text-slate-900">Frequência de Contato com Operação</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Estocadores conversam exclusivamente com o setor financeiro (para contestar tarifas ou negociar prazos), enquanto clientes Premium (P5) e Franquias (P2) interagem diariamente com a equipe operacional para otimizar expedições e SLAs.
              </p>
            </div>

            {/* Proxy 2 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase">
                <BarChart3 className="w-4 h-4 text-amber-700" />
                <span>Proxy 2 · Idade do Saldo</span>
              </div>
              <h3 className="text-sm font-black text-slate-900">Permanência em Estoque &gt; 45 Dias</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Se mais de 60% do saldo mantido pelo cliente estiver estocado há mais de 45 dias sem previsão de expedição nos próximos 15 dias, classifique preventivamente como P1 Estocador antes da virada de M7.
              </p>
            </div>

            {/* Proxy 3 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs uppercase">
                <Scale className="w-4 h-4 text-emerald-700" />
                <span>Proxy 3 · Sensibilidade a Preço</span>
              </div>
              <h3 className="text-sm font-black text-slate-900">Sensibilidade a Preço vs. SLA</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Estocadores (P1) negociam centavos na diária de armazenagem e aceitam prazos lentos. Clientes P5 e P2 priorizam rigor de SLA e aceitam pagar um prêmio pela qualidade logística e serviços agregados (VAS).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BOARD EXECUTIVE MEMO */}
      {activeTab === 'board_memo' && (
        <div className="space-y-6">
          {/* BOARD MEMO CONTAINER */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white px-3 py-1 rounded-full">
                  Documento Oficial do Board
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-2">
                  Leitura Técnica ao Board Executivo — BP 3PL Fitness v3.5
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Análise cruzada de perfis de clientes, sustentabilidade financeira e mitigações de risco pós-carência (M7)
                </p>
              </div>
              <FileText className="w-10 h-10 text-slate-400 shrink-0" />
            </div>

            {/* SECTION 1: MATRIZ DE PERFIS */}
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-700" />
                <span>1. Matriz de Perfis de Cliente: Viabilidade e Risco</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                A análise classifica cada perfil não apenas pela margem bruta, mas pela sua capacidade de
                sustentar a estrutura de custos fixos (especialmente após o término da carência do aluguel
                em M7, quando inicia a cobrança de R${' '}
                {Math.round(calculations.custosRealistas / 1000)}k realista) e respeitar as travas de
                governança do BP v3.5.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-emerald-950">P5 Premium (R$ 94,00/pos)</span>
                    <span className="font-mono font-bold text-emerald-800">BE 51,3%</span>
                  </div>
                  <p className="text-xs text-emerald-900">
                    <span className="font-bold">Âncora de Margem.</span> Único perfil que gera lucro robusto (&gt;R$ 135k) e reduz drasticamente o ponto de equilíbrio. Essencial para subsidiar a operação base. Se ceder &lt;20%, acionar gatilho de perda estrutural.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-blue-950">P2 Franquias (R$ 78,00/pos)</span>
                    <span className="font-mono font-bold text-blue-800">BE 61,8%</span>
                  </div>
                  <p className="text-xs text-blue-900">
                    <span className="font-bold">Estabilizador de Volume.</span> Bom ticket e MC saudável. Gera receita 4PL Control Tower (R$ 2k/cliente). Base ideal para compor volume sem destruir margem.
                  </p>
                </div>

                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-amber-950">P4 Academias (R$ 67,00/pos)</span>
                    <span className="font-mono font-bold text-amber-800">BE 71,9%</span>
                  </div>
                  <p className="text-xs text-amber-900">
                    <span className="font-bold">Volume Sazonal/Cíclico.</span> MC intermediário. Útil para preencher capacidade ociosa, mas perigoso como base única. Requer contrato take-or-pay ou VAS atrelado.
                  </p>
                </div>

                <div className="p-4 bg-slate-100 rounded-xl border border-slate-300 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-slate-950">P1 Estocador (R$ 52,50/pos)</span>
                    <span className="font-mono font-bold text-slate-800">BE 91,8%</span>
                  </div>
                  <p className="text-xs text-slate-800">
                    <span className="font-bold">Preenchedor Tático.</span> Margem baixa. Só viável para ocupar o "fundo de armazém" ou cross-dock rápido. Se o Break-Even do armazém subir acima de 75%, eliminar P1 agressivamente.
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 2: BLENDS ESTRATÉGICOS */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-700" />
                <span>
                  2. Análise dos Blends Estratégicos vs. Meta do BP v3.5 (
                  {calculations.totalCapacity.toLocaleString('pt-BR')} Posições)
                </span>
              </h3>

              <div className="space-y-2 text-xs text-slate-700 leading-relaxed">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="font-extrabold text-slate-900 text-sm">
                    Blend Alvo (20/30/25/25) — O Cenário Canônico de Equilíbrio
                  </div>
                  <p className="mt-1">
                    • <span className="font-bold">MC Médio Ponderado:</span> R$ 74,15/pos | <span className="font-bold">Segurança:</span> Break-Even Realista de 65,0% oferece <span className="font-bold text-emerald-700">10 p.p. de folga</span> em relação ao limite de 75% (M7+).<br />
                    • <span className="font-bold">Lucratividade:</span> Lucro Líquido Realista de R$ 77.077/mês (a 100% ocupação) sustenta o payback e o Fator R.<br />
                    • <span className="font-bold">Upside 4PL:</span> Receita Control Tower evolui de R$ 6k/mês (M12) para R$ 12k/mês (M24).
                  </p>
                </div>

                <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-300">
                  <div className="font-extrabold text-amber-950 text-sm">
                    Blend Conservador (25/30/30/15) — Alerta Vermelho de Sobrevivência
                  </div>
                  <p className="mt-1 text-amber-900">
                    Com apenas 15% de P5 Premium, o Lucro Líquido despenca para R$ 53.539/mês e o Break-Even sobe para 73,0%. A folga de segurança encolhe para apenas <span className="font-bold">2 p.p.</span> Qualquer oscilação ou perda de cliente em M7 pode empurrar o armazém para o vermelho.
                  </p>
                </div>

                <div className="p-3.5 bg-blue-50/80 rounded-xl border border-blue-300">
                  <div className="font-extrabold text-blue-950 text-sm">
                    Blend Agressivo (10/30/20/40) — Escala Madura (M19-M24)
                  </div>
                  <p className="mt-1 text-blue-900">
                    Margem expandida para R$ 79,65/pos, reduzindo o Break-Even para 57,3% e elevando o Lucro Líquido para R$ 92.504/mês. Requer alta maturidade comercial e certificação técnica VAS.
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 3: VETADOS */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <h3 className="text-sm font-black uppercase tracking-wider text-rose-900 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-600" />
                <span>3. Perfis VETADOS: Riscos Inegociáveis ao Board</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-900">
                  <div className="font-bold uppercase text-[11px] text-rose-800">1. Monocliente P1 Estocador</div>
                  <p className="mt-1">
                    <span className="font-bold">Inviabilidade Matemática:</span> Break-Even de 91,8% supera a meta limite de 75%. Operação nasceria inadimplente com os custos fixos de M7.
                  </p>
                </div>

                <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-900">
                  <div className="font-bold uppercase text-[11px] text-rose-800">2. Monocliente P5 ou P4</div>
                  <p className="mt-1">
                    <span className="font-bold">Risco de Concentração:</span> Viola a regra de diversificação (máx 25% por cliente). A perda de um único cliente quebraria o fluxo de caixa do BP v3.5.
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 4: RECOMMENDATIONS */}
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>4. Recomendações Práticas e DIretrizes de Governança ao Board</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">1. KPI de Mix Mensal no Monitoramento Fator R</span>
                  <p className="text-slate-600">
                    Incluir no Dashboard Mensal de Fator R uma linha de "Mix por Perfil Real vs. Contratado". Desvios &gt; 5 p.p. devem disparar reunião de revisão comercial em até 10 dias úteis.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">2. Cláusulas Contratuais (Take-or-Pay & Churn)</span>
                  <p className="text-slate-600">
                    Contratos P4 e P1 devem ter vigência curta ou cláusula de reajuste por ocupação. Se o cliente P1 comportar-se como "lastro tóxico" e o Break-Even geral ameaçar 75%, aplicar substituição.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">3. Remuneração Comercial Ponderada por MC</span>
                  <p className="text-slate-600">
                    Equipe comercial deve ter meta mínima obrigatória de P5 (mín 25%). Bônus variável ponderado pela Margem de Contribuição gerada, e não pelo volume bruto.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-900 block">4. Gatilho de Contingência de Sublocação</span>
                  <p className="text-slate-600">
                    Se o Blend Conservador persistir por &gt;2 meses consecutivos após M7, acionar automaticamente o plano de sublocação de 30% da área útil do galpão para reduzir custo fixo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PLANO DE CONTAS REFERENCIAL */}
      {activeTab === 'plano_contas' && <M11PlanoDeContas readOnly={embedded} />}
    </div>
  );
};
