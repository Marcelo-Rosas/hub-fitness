import React, { useMemo, useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { ModuleHeader } from '../ModuleHeader';
import { classifySku, estimateConsumption, resolveCbmM3, TAM_WARNING, type Regime } from '../../core/regimes';
import { computeCapacityLedger, type RegimeMix } from '../../core/capacityLedger';
import { BRIGHTWAY_SAMPLE } from '../../data/fixtures/brightwaySample';
import {
  IMPULSE_SAMPLE,
  IMPULSE_BL_06BRZ2311010_META,
  IMPULSE_BL_LINES,
  type ImpulsePackingSku,
} from '../../data/fixtures/impulseSample';
import { AlertTriangle, Layers, Package, Ship } from 'lucide-react';

const ALL_FIXTURES = [...BRIGHTWAY_SAMPLE, ...IMPULSE_SAMPLE];
const REGIMES: Regime[] = ['alpha', 'beta', 'gamma', 'delta'];
const bl = IMPULSE_BL_06BRZ2311010_META;

const fmt = (n: number, d = 1) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

export const M17SimuladorAnexoV: React.FC = () => {
  const { hubParams } = usePlanner();
  const [mix, setMix] = useState<RegimeMix>({ ...hubParams.capacity.regimeMix });
  const [feusPerMonth, setFeusPerMonth] = useState(226);
  const [dwell, setDwell] = useState<Record<Regime, string>>({
    alpha: '',
    beta: '',
    gamma: '',
    delta: '',
  });

  const mixSum = mix.alpha + mix.beta + mix.gamma + mix.delta;

  const classified = useMemo(
    () =>
      ALL_FIXTURES.map((s) => {
        const regime = classifySku(s);
        const cons = estimateConsumption(s, 1, regime);
        const cbm = resolveCbmM3(s);
        return { ...s, regime, cons, cbm };
      }),
    [],
  );

  const dwellByRegime = useMemo(() => {
    const parsed: Partial<Record<Regime, number | null>> = {};
    let any = false;
    for (const r of REGIMES) {
      const raw = dwell[r].trim();
      if (raw === '') {
        parsed[r] = null;
      } else {
        any = true;
        const n = Number(raw.replace(',', '.'));
        parsed[r] = Number.isFinite(n) ? n : null;
      }
    }
    return any ? parsed : undefined;
  }, [dwell]);

  const ledger = useMemo(
    () =>
      computeCapacityLedger({
        mix,
        budgets: {
          rackBudgetPositions: hubParams.capacity.rackBudgetPositions,
          floorBudgetM2: hubParams.capacity.floorBudgetM2,
        },
        feuYield: hubParams.capacity.feuYieldByRegime,
        feusPerMonth,
        dwellByRegime,
      }),
    [mix, feusPerMonth, dwellByRegime, hubParams.capacity],
  );

  const setMixPct = (key: Regime, pct: number) => {
    setMix((prev) => ({ ...prev, [key]: Math.max(0, Math.min(1, pct / 100)) }));
  };

  const rackKpi =
    ledger.kind === 'stock'
      ? `${fmt(ledger.rackOccupancyPct, 1)}%`
      : 'Dwell pendente';
  const floorKpi =
    ledger.kind === 'stock'
      ? `${fmt(ledger.floorOccupancyPct, 1)}%`
      : 'Dwell pendente';

  return (
    <div className="space-y-6">
      <ModuleHeader
        moduleId="M17"
        title="Simulador Anexo V · Regimes de Capacidade"
        subtitle="Motor supplier-aware (base/skid). Mix e feuYield são hipóteses — não alimentam DRE nem geram market share."
        kpis={[
          {
            label: 'Budget Rack',
            value: hubParams.capacity.rackBudgetPositions.toLocaleString('pt-BR'),
            subtext: 'posições Alpha+Beta',
            badge: 'RACK',
            highlightColor: 'emerald',
          },
          {
            label: 'Budget Piso',
            value: `${hubParams.capacity.floorBudgetM2} m²`,
            subtext: '~15% Zona B (Gamma+Delta)',
            badge: 'PISO',
            highlightColor: 'blue',
          },
          {
            label: 'Ocupação Rack',
            value: rackKpi,
            subtext:
              ledger.kind === 'stock'
                ? `${fmt(ledger.stockPositions, 0)} pos estoque médio`
                : 'Informe dwell (dias) por regime',
            badge: 'KPI',
            highlightColor: ledger.kind === 'stock' ? 'emerald' : 'amber',
          },
          {
            label: 'Ocupação Piso',
            value: floorKpi,
            subtext:
              ledger.kind === 'stock'
                ? `${fmt(ledger.stockFloorM2, 1)} m² estoque médio`
                : 'Sem dwell = envelope only',
            badge: 'KPI',
            highlightColor: ledger.kind === 'stock' ? 'indigo' : 'amber',
          },
        ]}
      />

      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950 flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold mb-1">Travas · pitch e auditoria</p>
          <ul className="list-disc pl-4 space-y-0.5 text-amber-900/90">
            <li>Ad Valorem = 0,10% sobre NF de serviço (~R$ 205/mês) — não sobre CIF</li>
            <li>CAPEX R$ 207.300 · Konnen = dataset de calibração, não âncora comercial</li>
            <li>{TAM_WARNING}</li>
            <li>Mix e feuYield são hipóteses até SKU master / dwell do AG</li>
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-900 text-white px-4 py-3 text-xs flex flex-wrap gap-x-6 gap-y-2 items-start">
        <div className="flex items-center gap-2 text-emerald-400 font-bold">
          <Ship className="w-4 h-4" />
          Impulse BL {bl.packingListId}
        </div>
        <div className="text-slate-300">
          <span className="text-slate-500">Ordenante</span> Konnen ·{' '}
          <span className="text-slate-500">Consignatária</span> Garra Trade ·{' '}
          <span className="text-slate-500">Porto</span> {bl.portDischarge}
        </div>
        <div className="font-mono text-emerald-300">
          {bl.totals.sets} sets · {bl.totals.cartons} CTNS · {bl.totals.feu}×40HC ·{' '}
          {fmt(bl.totals.grossKg, 1)} kg GW · {fmt(bl.totals.cbm, 3)} CBM ·{' '}
          {fmt(bl.totals.setsPerFeu, 1)} sets/FEU
        </div>
        <div className="text-slate-400 font-mono">
          CNTR {bl.containers[0].id} ({bl.containers[0].sets} sets) · {bl.containers[1].id} (
          {bl.containers[1].sets} sets) · {IMPULSE_BL_LINES.length} SKUs produto
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-1 bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Mix de regimes (HIPÓTESE)</h3>
          </div>
          <p className="text-[11px] text-slate-500">
            Soma atual: {(mixSum * 100).toFixed(0)}%{' '}
            {Math.abs(mixSum - 1) > 0.01 && (
              <span className="text-rose-600 font-bold">· ajustar para 100%</span>
            )}
          </p>
          {REGIMES.map((r) => (
            <label key={r} className="block text-xs space-y-1">
              <div className="flex justify-between font-mono uppercase">
                <span>{r}</span>
                <span>{(mix[r] * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(mix[r] * 100)}
                onChange={(e) => setMixPct(r, Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
            </label>
          ))}

          <label className="block text-xs space-y-1 pt-2 border-t border-slate-100">
            <span className="font-bold text-slate-700">FEUs / mês (fluxo)</span>
            <input
              type="number"
              min={0}
              value={feusPerMonth}
              onChange={(e) => setFeusPerMonth(Number(e.target.value) || 0)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 font-mono text-sm"
            />
          </label>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-700">Dwell (dias) · opcional</p>
            <p className="text-[10px] text-slate-500">
              Preencha os 4 regimes para ver estoque médio. Parcial = envelope only.
            </p>
            {REGIMES.map((r) => (
              <label key={r} className="flex items-center gap-2 text-xs">
                <span className="w-12 font-mono uppercase text-slate-500">{r}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="—"
                  value={dwell[r]}
                  onChange={(e) => setDwell((d) => ({ ...d, [r]: e.target.value }))}
                  className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 font-mono"
                />
              </label>
            ))}
          </div>

          {ledger.kind === 'envelope' && (
            <div className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-3 font-mono space-y-1">
              <div>fluxo teórico rack: {fmt(ledger.theoreticalMonthlyPositions, 0)} pos/mês</div>
              <div>fluxo teórico piso: {fmt(ledger.theoreticalMonthlyFloorM2, 1)} m²/mês</div>
              <div className="text-amber-700">≠ estoque (falta dwell)</div>
            </div>
          )}
        </div>

        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-900 text-white">
            <Package className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold">
              Cadastro · BRIGHTWAY + Impulse ({ALL_FIXTURES.length} linhas · KIT + PARTE)
            </h3>
          </div>
          <div className="overflow-x-auto max-h-130">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2 px-2">Tipo</th>
                  <th className="py-2 px-2">SKU</th>
                  <th className="py-2 px-2">Kit pai</th>
                  <th className="py-2 px-2">Papel</th>
                  <th className="py-2 px-2">Descrição</th>
                  <th className="py-2 px-2">Fornecedor</th>
                  <th className="py-2 px-2 text-right font-mono">Sets</th>
                  <th className="py-2 px-2">Base</th>
                  <th className="py-2 px-2">Regime</th>
                  <th className="py-2 px-2 text-right font-mono">Comp. mm</th>
                  <th className="py-2 px-2 text-right font-mono">Larg. mm</th>
                  <th className="py-2 px-2 text-right font-mono">Alt. mm</th>
                  <th className="py-2 px-2 text-right font-mono">CBM m³</th>
                  <th className="py-2 px-2 text-right font-mono">Vol</th>
                  <th className="py-2 px-2 text-right font-mono">kg</th>
                  <th className="py-2 px-2 text-right font-mono">pos</th>
                  <th className="py-2 px-2 text-right font-mono">m²</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {classified.map((row) => {
                  const impulse = row as typeof row & Partial<ImpulsePackingSku>;
                  const kind = row.skuKind ?? 'kit';
                  return (
                    <tr
                      key={row.sku}
                      className={
                        kind === 'part' ? 'bg-slate-50/80 hover:bg-slate-100/80' : 'hover:bg-slate-50/80'
                      }
                    >
                      <td className="py-2 px-2">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                            kind === 'kit'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {kind === 'kit' ? 'KIT' : 'PARTE'}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-bold text-slate-900 whitespace-nowrap">{row.sku}</td>
                      <td className="py-2 px-2 text-slate-500">{row.parentSku ?? '—'}</td>
                      <td className="py-2 px-2 text-slate-600">
                        {row.partRole ?? (kind === 'kit' ? 'kit' : '—')}
                      </td>
                      <td className="py-2 px-2 text-slate-600 max-w-30 truncate">
                        {impulse.description ?? '—'}
                      </td>
                      <td className="py-2 px-2 text-slate-600">{row.supplier}</td>
                      <td className="py-2 px-2 text-right">
                        {kind === 'kit' && impulse.setsInShipment != null && impulse.setsInShipment > 0
                          ? impulse.setsInShipment
                          : '—'}
                      </td>
                      <td className="py-2 px-2">{row.interfaceBase}</td>
                      <td className="py-2 px-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            row.regime === 'alpha'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.regime === 'beta'
                                ? 'bg-blue-100 text-blue-800'
                                : row.regime === 'gamma'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-violet-100 text-violet-900'
                          }`}
                        >
                          {row.regime}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">{row.lengthMm}</td>
                      <td className="py-2 px-2 text-right">{row.widthMm}</td>
                      <td className="py-2 px-2 text-right">{row.heightMm}</td>
                      <td className="py-2 px-2 text-right font-bold text-slate-800">{fmt(row.cbm, 3)}</td>
                      <td className="py-2 px-2 text-right">{row.volumesPerKit ?? 1}</td>
                      <td className="py-2 px-2 text-right">{row.grossWeightKg}</td>
                      <td className="py-2 px-2 text-right">{row.cons.positions}</td>
                      <td className="py-2 px-2 text-right">{fmt(row.cons.floorM2, 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-slate-100 text-[10px] text-slate-500 bg-slate-50">
            Cubagem = L×W×H (mm→m) ou CBM declarado do BL no KIT (soma dos cartons). Impulse
            multi-volume: BOX1/2 estrutura · BOX3 painéis · weight stack = partes. feuYield α{' '}
            {hubParams.capacity.feuYieldByRegime.alpha.positionsPerFeu} · β{' '}
            {hubParams.capacity.feuYieldByRegime.beta.positionsPerFeu} · fonte {bl.packingListId}
          </div>
        </div>
      </div>
    </div>
  );
};
