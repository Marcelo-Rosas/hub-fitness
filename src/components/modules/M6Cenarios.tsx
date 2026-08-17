import React, { useMemo } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { GitCompare, Copy, Sparkles } from 'lucide-react';
import { ModuleHeader } from '../ModuleHeader';
import { HubChartCard } from '../charts/HubChartCard';
import { HUB_CHART, HubChartLegendPill, hubTick, hubTooltipStyle, hubYAxisK } from '../charts/hubChartTheme';
import { computeWmsProprioImpact } from '../../core/engine';
import {
  computeTornadoBars,
  deriveScenarioKpis,
  pickComparatorScenarios,
  projectScenario,
} from '../../core/scenarioDrivers';
import { canEditFinance } from '../../core/rbac/moduleEdit';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../../data/initialData';
import { PROFILE_PRESETS } from '../../data/mixSimulatorData';
import { OFFICIAL_TOTALS_24M } from '../../data/officialData';
import { occupiedPositionsFromRate } from '../../core/mixPreview';

export const M6Cenarios: React.FC<{ embed?: boolean }> = ({ embed = false }) => {
  const {
    scenarios,
    scenariosSource,
    activeScenarioId,
    setActiveScenarioId,
    activeScenario,
    duplicateScenario,
    updateScenarioDrivers,
    ledgerBaseItems,
    previewMixItems,
    isMixDirty,
    hubParams,
    activeRole,
    activeMix,
    updateActiveMix,
  } = usePlanner();

  const canEdit = canEditFinance(activeRole);
  const base = ledgerBaseItems.length ? ledgerBaseItems : INITIAL_GRANULAR_DRE_ITEMS;
  const ledgerItems = isMixDirty && previewMixItems.length ? previewMixItems : base;

  const { left, right } = useMemo(
    () => pickComparatorScenarios(scenarios, activeScenarioId),
    [scenarios, activeScenarioId],
  );

  const leftKpis = useMemo(() => {
    const months = projectScenario(ledgerItems, left.drivers, hubParams);
    return deriveScenarioKpis(months, hubParams);
  }, [ledgerItems, left.drivers, hubParams]);

  const rightKpis = useMemo(() => {
    const months = projectScenario(ledgerItems, right.drivers, hubParams);
    return deriveScenarioKpis(months, hubParams);
  }, [ledgerItems, right.drivers, hubParams]);

  const deltaOccupancy = (right.drivers.occupancyRate - left.drivers.occupancyRate) * 100;
  const deltaLL = rightKpis.llM7Plus - leftKpis.llM7Plus;
  const deltaCash = rightKpis.m24Cash - leftKpis.m24Cash;

  const v36 = computeWmsProprioImpact(hubParams);
  const v36LlDelta = v36.llM7Plus - leftKpis.llM7Plus;
  const v36CashDelta = v36.saldoM24CarenciaAluguel - leftKpis.m24Cash;

  const tornadoData = useMemo(
    () =>
      computeTornadoBars({
        items: ledgerItems,
        baseDrivers: activeScenario.drivers,
        params: hubParams,
      }),
    [ledgerItems, activeScenario.drivers, hubParams],
  );

  const d = activeScenario.drivers;

  return (
    <div className="space-y-6">
      {isMixDirty && (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
          ⚠ Mix pendente — Tornado/KPI refletem preview (não commitado no cadastro).
        </div>
      )}
      {!embed && (
      <ModuleHeader
        moduleId="M6"
        title="Matriz de Cenários & Análise Tornado"
        subtitle="Ocupação vem do Mix (posições × ticket perfil). Aqui: aluguel, COGS, HC, tech e Tornado live."
        kpis={[
          {
            label: 'Cenários',
            value: `${scenarios.length}`,
            subtext: `Ativo: ${activeScenario.name} · ${scenariosSource === 'operator' ? 'Operator' : 'seed local'}`,
            badge: scenariosSource === 'operator' ? 'OPERATOR' : 'SEED',
            highlightColor: 'indigo',
          },
          {
            label: 'Delta Ocupação',
            value: `${deltaOccupancy.toFixed(0)} pp`,
            subtext: `Ativo vs ${left.name}`,
            badge: 'ESTRESSE',
            highlightColor: 'rose',
          },
          {
            label: 'Impacto LL M7+',
            value: `R$ ${(deltaLL / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`,
            subtext: 'Δ engine live',
            badge: 'DELTA LL',
            highlightColor: 'amber',
          },
          {
            label: 'Delta Caixa M24',
            value: `R$ ${(deltaCash / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`,
            subtext: 'Âncora oficial + Δ LL',
            badge: 'DELTA CAIXA',
            highlightColor: 'slate',
          },
        ]}
        actions={
          <button
            type="button"
            onClick={() => duplicateScenario(activeScenarioId)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicar Cenário</span>
          </button>
        }
      />
      )}

      {embed && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Blends pró-formatados
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {(['blend_alvo', 'blend_conservador', 'blend_agressivo'] as const).map((key) => {
              const preset = PROFILE_PRESETS[key];
              const selected =
                activeMix.p1 === preset.p1 &&
                activeMix.p2 === preset.p2 &&
                activeMix.p4 === preset.p4 &&
                activeMix.p5 === preset.p5;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    updateActiveMix({
                      p1: preset.p1,
                      p2: preset.p2,
                      p4: preset.p4,
                      p5: preset.p5,
                      presetName: preset.presetName,
                    })
                  }
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer ${
                    selected
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
            <span className="px-3 py-1.5 text-xs font-bold rounded-lg border border-rose-200 bg-rose-50 text-rose-800">
              Monocliente · Vetado
            </span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveScenarioId(s.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${
                s.id === activeScenarioId
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1 rounded-lg border border-indigo-200 bg-indigo-50/70 p-2.5">
            <span className="font-semibold text-indigo-950">
              Ocupação Mix ({(d.occupancyRate * 100).toFixed(0)}%)
            </span>
            <p className="text-[11px] text-indigo-900 font-mono">
              {occupiedPositionsFromRate(d.occupancyRate, hubParams.capacity.totalPositions).toLocaleString(
                'pt-BR',
              )}{' '}
              / {hubParams.capacity.totalPositions.toLocaleString('pt-BR')} pos
            </p>
            <p className="text-[10px] text-slate-600">
              SSOT na aba Mix & Receitas (ticket perfil). Aqui só aluguel / COGS / HC / tech.
            </p>
          </div>
          <label className="space-y-1">
            <span className="font-semibold text-slate-700">Aluguel ×{d.rentFactor.toFixed(2)}</span>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.01}
              disabled={!canEdit}
              value={d.rentFactor}
              onChange={(e) =>
                updateScenarioDrivers(activeScenarioId, { rentFactor: Number(e.target.value) })
              }
              className="w-full"
            />
          </label>
          <label className="space-y-1">
            <span className="font-semibold text-slate-700">COGS var. ×{d.cogsVariableFactor.toFixed(2)}</span>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.01}
              disabled={!canEdit}
              value={d.cogsVariableFactor}
              onChange={(e) =>
                updateScenarioDrivers(activeScenarioId, {
                  cogsVariableFactor: Number(e.target.value),
                })
              }
              className="w-full"
            />
          </label>
          <label className="space-y-1">
            <span className="font-semibold text-slate-700">HC/OPEX ×{d.hcOpexFactor.toFixed(2)}</span>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.01}
              disabled={!canEdit}
              value={d.hcOpexFactor}
              onChange={(e) =>
                updateScenarioDrivers(activeScenarioId, { hcOpexFactor: Number(e.target.value) })
              }
              className="w-full"
            />
          </label>
          <label className="flex items-center gap-2 font-semibold text-slate-700 pt-5">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={d.techOpexActive}
              onChange={(e) =>
                updateScenarioDrivers(activeScenarioId, { techOpexActive: e.target.checked })
              }
            />
            Tech OPEX (Logcomex + cloud)
          </label>
        </div>
        {!canEdit && (
          <p className="text-[11px] text-amber-700">Leitura: só cfo/socio editam drivers.</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Comparador A/B: {left.name} vs {right.name} (engine)
            </h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse font-mono">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-3 px-4 font-sans">Métrica</th>
                <th className="py-3 px-4 text-right bg-emerald-50 text-emerald-900">{left.name}</th>
                <th className="py-3 px-4 text-right bg-rose-50 text-rose-900">{right.name}</th>
                <th className="py-3 px-4 text-right font-bold">Δ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-3 px-4 font-sans font-semibold">Ocupação</td>
                <td className="py-3 px-4 text-right">{(left.drivers.occupancyRate * 100).toFixed(0)}%</td>
                <td className="py-3 px-4 text-right">{(right.drivers.occupancyRate * 100).toFixed(0)}%</td>
                <td className="py-3 px-4 text-right">{deltaOccupancy.toFixed(0)} pp</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-semibold">LL M7+</td>
                <td className="py-3 px-4 text-right">R$ {leftKpis.llM7Plus.toLocaleString('pt-BR')}</td>
                <td className="py-3 px-4 text-right">R$ {rightKpis.llM7Plus.toLocaleString('pt-BR')}</td>
                <td className="py-3 px-4 text-right">R$ {deltaLL.toLocaleString('pt-BR')}</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-semibold">Caixa M24</td>
                <td className="py-3 px-4 text-right">R$ {leftKpis.m24Cash.toLocaleString('pt-BR')}</td>
                <td className="py-3 px-4 text-right">R$ {rightKpis.m24Cash.toLocaleString('pt-BR')}</td>
                <td className="py-3 px-4 text-right">R$ {deltaCash.toLocaleString('pt-BR')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-300" />
            <h3 className="text-xs font-bold uppercase tracking-wider">v3.5 vs v3.6 WMS (CAPEX lock)</h3>
          </div>
          <span className="text-xs text-indigo-300 font-mono">
            CAPEX R$ {hubParams.capex.total.toLocaleString('pt-BR')}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse font-mono">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-3 px-4 font-sans">Métrica</th>
                <th className="py-3 px-4 text-right">v3.5</th>
                <th className="py-3 px-4 text-right bg-indigo-50">v3.6</th>
                <th className="py-3 px-4 text-right">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-3 px-4 font-sans font-semibold">OPEX Tech / mês</td>
                <td className="py-3 px-4 text-right">R$ 0</td>
                <td className="py-3 px-4 text-right">R$ {v36.techOpexMonthly.toLocaleString('pt-BR')}</td>
                <td className="py-3 px-4 text-right">+R$ {v36.techOpexMonthly.toLocaleString('pt-BR')}</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-semibold">LL M7+</td>
                <td className="py-3 px-4 text-right">R$ {OFFICIAL_TOTALS_24M.llM7Plus.toLocaleString('pt-BR')}</td>
                <td className="py-3 px-4 text-right">R$ {v36.llM7Plus.toLocaleString('pt-BR')}</td>
                <td className="py-3 px-4 text-right">R$ {v36LlDelta.toLocaleString('pt-BR')}</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-sans font-semibold">Caixa M24</td>
                <td className="py-3 px-4 text-right">
                  R$ {OFFICIAL_TOTALS_24M.saldoCaixaM24CarenciaAluguel.toLocaleString('pt-BR')}
                </td>
                <td className="py-3 px-4 text-right">
                  R$ {v36.saldoM24CarenciaAluguel.toLocaleString('pt-BR')}
                </td>
                <td className="py-3 px-4 text-right">R$ {v36CashDelta.toLocaleString('pt-BR')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <HubChartCard
        title="Tornado live — Δ LL M7+"
        subtitle="Sensibilidade vs Mix + drivers do cenário ativo (engine, zero literais)."
        badge="Δ LL M7+"
        plotClassName="h-72 w-full pt-2"
        legend={
          <>
            <HubChartLegendPill tone="rose">Downside</HubChartLegendPill>
            <HubChartLegendPill tone="sky">Upside</HubChartLegendPill>
          </>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={tornadoData} margin={{ top: 10, right: 30, left: 140, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={HUB_CHART.grid} vertical={false} />
              <XAxis type="number" tickFormatter={hubYAxisK} tick={hubTick} />
              <YAxis type="category" dataKey="factor" tick={{ fontSize: 11, fill: HUB_CHART.tick }} width={130} />
              <Tooltip
                formatter={(val) => `R$ ${Number(val ?? 0).toLocaleString('pt-BR')}`}
                contentStyle={hubTooltipStyle}
              />
              <Bar dataKey="downside" name="Downside" fill={HUB_CHART.downside} radius={[4, 0, 0, 4]} />
              <Bar dataKey="upside" name="Upside" fill={HUB_CHART.upside} radius={[0, 4, 4, 0]} />
            </BarChart>
        </ResponsiveContainer>
      </HubChartCard>
    </div>
  );
};
