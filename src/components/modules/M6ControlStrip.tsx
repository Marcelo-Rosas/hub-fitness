import React, { useId, useMemo, useState } from 'react';
import { GitBranch, Layers, Users } from 'lucide-react';
import { usePlanner } from '../../context/PlannerContext';
import { canEditFinance } from '../../core/rbac/moduleEdit';
import { occupiedPositionsFromRate } from '../../core/mixPreview';
import { MIX_COST_MODE_LABELS, MIX_COST_MODES } from '../../core/payrollRoles';
import type { MixCostMode } from '../../types';
import { PROFILE_PRESETS } from '../../data/mixSimulatorData';

const BLEND_KEYS = ['blend_alvo', 'blend_conservador', 'blend_agressivo'] as const;

type ControlTab = 'cenario' | 'blend' | 'folha';

const TAB_META: Record<
  ControlTab,
  { label: string; hint: string; icon: React.ComponentType<{ className?: string }> }
> = {
  cenario: {
    label: 'Cenário',
    hint: 'Motor de projeção e Tornado',
    icon: GitBranch,
  },
  blend: {
    label: 'Blend',
    hint: 'Composição P1/P2/P4/P5',
    icon: Layers,
  },
  folha: {
    label: 'Folha',
    hint: 'Piso de custo SC',
    icon: Users,
  },
};

function blendShortLabel(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

function activeBlendKey(mix: { p1: number; p2: number; p4: number; p5: number }): string | null {
  for (const key of BLEND_KEYS) {
    const p = PROFILE_PRESETS[key];
    if (mix.p1 === p.p1 && mix.p2 === p.p2 && mix.p4 === p.p4 && mix.p5 === p.p5) return key;
  }
  return null;
}

/**
 * Folha de controle M6: tabs Cenário / Blend / Folha + drivers de estresse.
 */
export const M6ControlStrip: React.FC = () => {
  const {
    scenarios,
    activeScenarioId,
    setActiveScenarioId,
    activeScenario,
    updateScenarioDrivers,
    hubParams,
    activeRole,
    activeMix,
    updateActiveMix,
    mixCostMode,
    setMixCostMode,
  } = usePlanner();

  const [tab, setTab] = useState<ControlTab>('cenario');
  const baseId = useId();

  const canEdit = canEditFinance(activeRole);
  const d = activeScenario.drivers;
  const cap = hubParams.capacity.totalPositions;
  const occPct = (d.occupancyRate * 100).toFixed(0);
  const occPos = occupiedPositionsFromRate(d.occupancyRate, cap);

  const blendKey = activeBlendKey(activeMix);
  const tabCaptions = useMemo(
    () => ({
      cenario: activeScenario.name,
      blend: blendKey ? blendShortLabel(PROFILE_PRESETS[blendKey].label) : 'Personalizado',
      folha: MIX_COST_MODE_LABELS[mixCostMode],
    }),
    [activeScenario.name, blendKey, mixCostMode],
  );

  const optionCard = (selected: boolean) =>
    `text-left rounded-lg border px-3 py-2.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F3864]/40 focus-visible:ring-offset-1 ${
      selected
        ? 'border-[#1F3864] bg-[#1F3864]/5 shadow-xs ring-1 ring-[#1F3864]/15'
        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
    }`;

  return (
    <section
      className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden"
      aria-label="Premissas de cenário, blend e folha"
    >
      <div
        role="tablist"
        aria-label="Seções de premissa"
        className="flex border-b border-slate-200 bg-slate-50/70 px-1 pt-1 gap-0.5 overflow-x-auto"
      >
        {(Object.keys(TAB_META) as ControlTab[]).map((key) => {
          const meta = TAB_META[key];
          const Icon = meta.icon;
          const selected = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`${baseId}-tab-${key}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${key}`}
              onClick={() => setTab(key)}
              className={`group relative flex min-w-[7.5rem] flex-1 flex-col items-start px-3 py-2.5 rounded-t-lg border-b-2 transition-colors cursor-pointer ${
                selected
                  ? 'border-[#1F3864] bg-white text-[#1F3864]'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/60'
              }`}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${selected ? 'text-[#1F3864]' : 'text-slate-400'}`} />
                {meta.label}
              </span>
              <span
                className={`mt-0.5 max-w-full truncate text-xs font-semibold ${
                  selected ? 'text-slate-800' : 'text-slate-500 group-hover:text-slate-700'
                }`}
                title={tabCaptions[key]}
              >
                {tabCaptions[key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="px-3 py-3 min-h-[4.25rem]">
        {tab === 'cenario' && (
          <div
            role="tabpanel"
            id={`${baseId}-panel-cenario`}
            aria-labelledby={`${baseId}-tab-cenario`}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2"
          >
            {scenarios.map((s) => {
              const selected = s.id === activeScenarioId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveScenarioId(s.id)}
                  className={optionCard(selected)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 leading-snug">{s.name}</span>
                    {s.isBaseline && (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        Oficial
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500 leading-relaxed">
                    Ocupação {(s.drivers.occupancyRate * 100).toFixed(0)}% · Aluguel ×
                    {s.drivers.rentFactor.toFixed(2)}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {tab === 'blend' && (
          <div
            role="tabpanel"
            id={`${baseId}-panel-blend`}
            aria-labelledby={`${baseId}-tab-blend`}
            className="grid grid-cols-1 md:grid-cols-3 gap-2"
          >
            {BLEND_KEYS.map((key) => {
              const preset = PROFILE_PRESETS[key];
              const selected = blendKey === key;
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
                  className={optionCard(selected)}
                >
                  <div className="text-xs font-bold text-slate-900">{blendShortLabel(preset.label)}</div>
                  <div className="mt-0.5 font-mono text-[10px] font-semibold text-indigo-800">
                    {preset.p1}/{preset.p2}/{preset.p4}/{preset.p5}
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-500 leading-relaxed line-clamp-2">
                    {preset.description}
                  </p>
                </button>
              );
            })}
            <div className="rounded-lg border border-dashed border-rose-200 bg-rose-50/50 px-3 py-2.5">
              <div className="text-xs font-bold text-rose-900">Monocliente</div>
              <p className="mt-1 text-[10px] text-rose-800 leading-relaxed">
                Vetado por governança — concentração acima de 25% por cliente.
              </p>
            </div>
          </div>
        )}

        {tab === 'folha' && (
          <div
            role="tabpanel"
            id={`${baseId}-panel-folha`}
            aria-labelledby={`${baseId}-tab-folha`}
            className="grid grid-cols-1 md:grid-cols-3 gap-2"
          >
            {MIX_COST_MODES.map((mode) => {
              const selected = mixCostMode === mode;
              const hints: Record<MixCostMode, string> = {
                cct: 'Piso conservador — convenção SITRAROIT × SEVEÍCULOS.',
                mediana: 'Referência equilibrada para BE e LL do Mix.',
                caged: 'Competitivo — média de mercado CAGED/Portal Salário.',
              };
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setMixCostMode(mode)}
                  className={optionCard(selected)}
                >
                  <div className="text-xs font-bold text-slate-900">{MIX_COST_MODE_LABELS[mode]}</div>
                  <p className="mt-1.5 text-[10px] text-slate-500 leading-relaxed">{hints[mode]}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/40 px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Drivers de estresse
          </span>
          {!canEdit && (
            <span className="text-[10px] font-medium text-amber-800">Somente leitura</span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 text-[11px]">
          <div className="md:col-span-3 rounded-lg border border-[#1F3864]/15 bg-white px-2.5 py-2 shadow-2xs">
            <div className="font-semibold text-[#1F3864]">Ocupação Mix {occPct}%</div>
            <div className="font-mono text-slate-700 tabular-nums">
              {occPos.toLocaleString('pt-BR')} / {cap.toLocaleString('pt-BR')} pos
            </div>
          </div>
          <label className="md:col-span-2 space-y-1">
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
              className="w-full h-1.5 accent-[#1F3864] disabled:opacity-50"
            />
          </label>
          <label className="md:col-span-2 space-y-1">
            <span className="font-semibold text-slate-700">COGS ×{d.cogsVariableFactor.toFixed(2)}</span>
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
              className="w-full h-1.5 accent-[#1F3864] disabled:opacity-50"
            />
          </label>
          <label className="md:col-span-2 space-y-1">
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
              className="w-full h-1.5 accent-[#1F3864] disabled:opacity-50"
            />
          </label>
          <label className="md:col-span-3 flex items-center gap-2 font-semibold text-slate-700 self-center min-h-[2.25rem]">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={d.techOpexActive}
              onChange={(e) =>
                updateScenarioDrivers(activeScenarioId, { techOpexActive: e.target.checked })
              }
              className="rounded border-slate-300 text-[#1F3864] focus:ring-[#1F3864]/30"
            />
            Tech OPEX (Logcomex + cloud)
          </label>
        </div>
      </div>
    </section>
  );
};
