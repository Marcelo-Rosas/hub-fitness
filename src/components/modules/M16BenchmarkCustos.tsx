import React, { useMemo, useState } from 'react';
import { usePlanner } from '../../context/PlannerContext';
import { ModuleHeader } from '../ModuleHeader';
import {
  FORTE_TABS,
  FORTE_AUDIT_DELTAS,
  FORTE_BENCHMARK_META,
  SANCO_TCO_BREAKDOWN,
  SANCO_VAS_BENCHMARK,
} from '../../data/benchmarkData';
import {
  computeCliaSensitivity,
  computeForteDerived,
  compute3plPerPallet,
  computeDesovaMarkupPrice,
} from '../../core/engine';
import { Scale, Ship, Warehouse, BarChart3 } from 'lucide-react';

type BenchmarkTab = 'sanco' | 'forte-entreposto' | 'forte-dtc' | 'comparativo';

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`;

export const M16BenchmarkCustos: React.FC = () => {
  const { hubParams } = usePlanner();
  const [activeTab, setActiveTab] = useState<BenchmarkTab>('sanco');

  const forteDerived = useMemo(() => computeForteDerived(hubParams), [hubParams]);
  const tpl3pl = useMemo(() => compute3plPerPallet(hubParams), [hubParams]);
  const cliaSensitivity = useMemo(() => computeCliaSensitivity(hubParams, 5), [hubParams]);
  const desovaMarkup = useMemo(() => computeDesovaMarkupPrice(hubParams), [hubParams]);

  const tabs: { id: BenchmarkTab; label: string }[] = [
    { id: 'sanco', label: 'SANCO · TCO & Pisos' },
    { id: 'forte-entreposto', label: 'Forte · Entreposto 30d' },
    { id: 'forte-dtc', label: 'Forte · DTC 20d' },
    { id: 'comparativo', label: 'Comparativo 3PL × Forte × CLIA' },
  ];

  const forteTab =
    activeTab === 'forte-dtc' ? FORTE_TABS[1] : FORTE_TABS[0];

  const sancoTotal = SANCO_TCO_BREAKDOWN.reduce((a, r) => a + r.sancoInhouse, 0);
  const tplTotal = SANCO_TCO_BREAKDOWN.reduce((a, r) => a + r.tplFitness, 0);

  return (
    <div className="space-y-6">
      <ModuleHeader
        moduleId="M16"
        title="Benchmark de Custos · SANCO & Forte Logística"
        subtitle="Referência editável via params — Forte Logística 2026 (CNTR 40' · CIF R$ 332,8k). Entreposto value-driven vs 3PL physics-driven."
        kpis={[
          {
            label: 'Forte Entreposto 30d',
            value: `R$ ${fmt(forteDerived.entrepostoTotal)}`,
            subtext: `${fmtPct(forteDerived.entrepostoPctCif)} CIF · R$ ${fmt(forteDerived.costPerPalletEntreposto30d)}/palete`,
            badge: 'ENTREPOSTO',
            highlightColor: 'blue',
          },
          {
            label: 'Forte DTC 20d',
            value: `R$ ${fmt(forteDerived.dtcTotal)}`,
            subtext: `${fmtPct(forteDerived.dtcPctCif)} CIF`,
            badge: 'DTC',
            highlightColor: 'slate',
          },
          {
            label: '3PL Nacionalizado',
            value: `R$ ${fmt(tpl3pl.totalPerPallet)}/palete`,
            subtext: `≈ ${(forteDerived.costPerPalletEntreposto30d / tpl3pl.totalPerPallet).toFixed(1)}× mais barato que entreposto`,
            badge: 'HUB-SIM',
            highlightColor: 'emerald',
          },
          {
            label: 'Alvo Auditoria Tarifária',
            value: `R$ ${fmt(hubParams.pricing.clia.auditTargetPerFeu)}/FEU`,
            subtext: 'Tower fee R$ 450 paga com <1 CNTR auditado',
            badge: 'CLIA',
            highlightColor: 'amber',
          },
        ]}
      />

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === t.id
                ? 'bg-[#1F3864] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'sanco' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-[#1F3864]" />
              <h3 className="text-sm font-bold text-slate-900">TCO Mensal · SANCO In-house vs 3PL Hub</h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600">
                  <th className="py-2 px-3 text-left">Rubica</th>
                  <th className="py-2 px-3 text-right">SANCO</th>
                  <th className="py-2 px-3 text-right">3PL Hub</th>
                </tr>
              </thead>
              <tbody>
                {SANCO_TCO_BREAKDOWN.map((row) => (
                  <tr key={row.item} className="border-t border-slate-100">
                    <td className="py-2 px-3">{row.item}</td>
                    <td className="py-2 px-3 text-right font-mono">R$ {fmt(row.sancoInhouse)}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-700">R$ {fmt(row.tplFitness)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 font-bold bg-slate-50">
                  <td className="py-2 px-3">Total mensal</td>
                  <td className="py-2 px-3 text-right font-mono text-rose-700">R$ {fmt(sancoTotal)}</td>
                  <td className="py-2 px-3 text-right font-mono text-emerald-800">R$ {fmt(tplTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">Pisos Tarifários SANCO (CPQ / M14)</h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600">
                  <th className="py-2 px-3 text-left">Serviço</th>
                  <th className="py-2 px-3 text-left">Unidade</th>
                  <th className="py-2 px-3 text-right">Piso (R$)</th>
                </tr>
              </thead>
              <tbody>
                {SANCO_VAS_BENCHMARK.map((row) => (
                  <tr key={row.service} className="border-t border-slate-100">
                    <td className="py-2 px-3">{row.service}</td>
                    <td className="py-2 px-3 text-slate-500">{row.unit}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">{row.floor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-500 p-3 border-t">
              Desova revenda CLIA (markup {fmtPct(hubParams.pricing.clia.handlingMarkupPct)}):{' '}
              <strong>R$ {fmt(desovaMarkup)}</strong> — abaixo do piso SANCO R$ 1.400.
            </p>
          </div>
        </div>
      )}

      {(activeTab === 'forte-entreposto' || activeTab === 'forte-dtc') && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ship className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">{forteTab.label}</h3>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {FORTE_BENCHMARK_META.source} · CIF R$ {fmt(FORTE_BENCHMARK_META.cifFeu)} · USD {FORTE_BENCHMARK_META.usdRate}
            </span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                <th className="py-2 px-3 text-left">Bloco</th>
                <th className="py-2 px-3 text-left">Rubrica</th>
                <th className="py-2 px-3 text-left">Ref.</th>
                <th className="py-2 px-3 text-right">Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              {forteTab.lines.map((line, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-2 px-3 text-slate-500">{line.block}</td>
                  <td className="py-2 px-3">{line.rubric}</td>
                  <td className="py-2 px-3 font-mono text-slate-500">{line.reference}</td>
                  <td className="py-2 px-3 text-right font-mono">{fmt(line.value)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-bold bg-blue-50">
                <td colSpan={3} className="py-2 px-3">
                  TOTAL ({fmtPct(forteTab.pctCif)} CIF)
                </td>
                <td className="py-2 px-3 text-right font-mono text-blue-900">R$ {fmt(forteTab.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'comparativo' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Entreposto 30d / palete</div>
              <div className="text-xl font-black font-mono text-blue-800 mt-1">
                R$ {fmt(forteDerived.costPerPalletEntreposto30d)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Value-driven (% CIF)</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-emerald-200">
              <div className="text-[10px] font-bold text-emerald-700 uppercase">3PL nacionalizado / palete</div>
              <div className="text-xl font-black font-mono text-emerald-800 mt-1">
                R$ {fmt(tpl3pl.totalPerPallet)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Desova {fmt(tpl3pl.desovaProrata)} + arm. {fmt(tpl3pl.storageMonthly)} + handling {fmt(tpl3pl.handlingAssumed)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-amber-200">
              <div className="text-[10px] font-bold text-amber-700 uppercase">Ratio entreposto / 3PL</div>
              <div className="text-xl font-black font-mono text-amber-900 mt-1">
                {(forteDerived.costPerPalletEntreposto30d / tpl3pl.totalPerPallet).toFixed(1)}×
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Nacionalização parcial + hub</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#1F3864]" />
              <h3 className="text-sm font-bold">Sensibilidade Take Rate CLIA (1–5 FEU/mês)</h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600">
                  <th className="py-2 px-3 text-center">FEU/mês</th>
                  <th className="py-2 px-3 text-right">Take rate mín</th>
                  <th className="py-2 px-3 text-right">Take rate máx</th>
                  <th className="py-2 px-3 text-right">Economia auditoria</th>
                  <th className="py-2 px-3 text-right">Custo líq. cliente (máx − audit.)</th>
                </tr>
              </thead>
              <tbody>
                {cliaSensitivity.map((row) => (
                  <tr key={row.feuPerMonth} className="border-t border-slate-100">
                    <td className="py-2 px-3 text-center font-bold">{row.feuPerMonth}</td>
                    <td className="py-2 px-3 text-right font-mono">R$ {fmt(row.takeRateMin)}</td>
                    <td className="py-2 px-3 text-right font-mono">R$ {fmt(row.takeRateMax)}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-700">R$ {fmt(row.auditSavings)}</td>
                    <td className={`py-2 px-3 text-right font-mono font-bold ${row.netClientCostMax < 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      R$ {fmt(row.netClientCostMax)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h4 className="text-xs font-bold text-amber-900 mb-2">Inconsistências Forte (alvo auditoria)</h4>
            <ul className="text-xs text-amber-900 space-y-1">
              {FORTE_AUDIT_DELTAS.map((d) => (
                <li key={d.label}>
                  {d.label}: <strong>Δ R$ {fmt(d.deltaPerFeu)}/FEU</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
