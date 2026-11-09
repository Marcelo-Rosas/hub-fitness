import React, { useMemo, useState } from 'react';
import { usePlanner } from '../context/PlannerContext';
import { fatorRFolhaMensalFromLedger } from '../core/engine';
import {
  baseAnualFromDre,
  breakevenClientesCredito,
  computeReformaSeries,
  DEFAULT_REFORMA,
  OBRIGACOES_REFORMA,
  type ReformaParams,
  type ResultadoRegime,
} from '../core/taxReform';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../data/initialData';

const brl = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`;
const pct = (f: number, d = 1) => `${(f * 100).toFixed(d).replace('.', ',')}%`;

/** Série da reforma a partir do DRE ao vivo (Ano 2 como operação em cruzeiro). */
export function useReformaSeries(p: ReformaParams = DEFAULT_REFORMA) {
  const { dreMonths, ledgerBaseItems, hubParams } = usePlanner();
  return useMemo(() => {
    const ledger = ledgerBaseItems.length ? ledgerBaseItems : INITIAL_GRANULAR_DRE_ITEMS;
    const folha = dreMonths.map((m) => fatorRFolhaMensalFromLedger(ledger, hubParams, m.month));
    const base = baseAnualFromDre(dreMonths, folha);
    return {
      base,
      series: computeReformaSeries(base, p),
      be2027: breakevenClientesCredito(base, 2027, p),
      be2033: breakevenClientesCredito(base, 2033, p),
    };
  }, [dreMonths, ledgerBaseItems, hubParams, p]);
}

const REGIMES: { key: 'simples' | 'hibrido' | 'presumido'; label: string; cor: string }[] = [
  { key: 'simples', label: 'Simples (por dentro)', cor: 'text-slate-900' },
  { key: 'hibrido', label: 'Simples híbrido', cor: 'text-emerald-800' },
  { key: 'presumido', label: 'Lucro Presumido', cor: 'text-rose-800' },
];

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint: string;
}> = ({ label, value, min, max, step, onChange, hint }) => (
  <label className="block p-3 bg-slate-50 border border-slate-200 rounded-lg">
    <div className="flex justify-between text-[11px] font-bold text-slate-700">
      <span>{label}</span>
      <span className="font-mono text-blue-900">{pct(value)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full mt-1"
    />
    <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>
  </label>
);

export const ReformaTributariaPanel: React.FC = () => {
  const [p, setP] = useState<ReformaParams>(DEFAULT_REFORMA);
  const { base, series, be2027, be2033 } = useReformaSeries(p);
  const set = (k: keyof ReformaParams) => (v: number) => setP((prev) => ({ ...prev, [k]: v }));

  const s2027 = series[0];
  const melhor = (r: (typeof series)[number]) =>
    REGIMES.reduce((best, x) => (r[x.key].lucroLiquido > r[best.key].lucroLiquido ? x : best), REGIMES[0]);
  const rec2027 = melhor(s2027);
  const ganho2027 = s2027.hibrido.lucroLiquido - s2027.simples.lucroLiquido;

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
      <div>
        <h3 className="text-sm font-bold text-slate-900">🏛️ Cenário Reforma Tributária (EC 132 / LC 214) — 2027 a 2033</h3>
        <p className="text-xs text-slate-500">
          Operação do Ano 2 do plano (receita {brl(base.receita)}/ano, Anexo {base.anexo}, DAS {pct(base.das / base.receita)})
          submetida ao regime de cada ano. Custo para o cliente igual nos três regimes: diferença de lucro é só tributária.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Slider label="Clientes que creditam IBS/CBS" value={p.clientesCreditoPct} min={0} max={1} step={0.05}
          onChange={set('clientesCreditoPct')} hint="HIPÓTESE · ICP academias Simples não credita; só Real/Presumido/híbrido" />
        <Slider label="Insumos com crédito" value={p.insumosCreditaveisPct} min={0} max={1} step={0.05}
          onChange={set('insumosCreditaveisPct')} hint="HIPÓTESE · % de custos+despesas fora folha" />
        <Slider label="CBS referência" value={p.cbsRef} min={0.07} max={0.1} step={0.001}
          onChange={set('cbsRef')} hint="Estimativa · calibrada pelo Senado" />
        <Slider label="IBS referência" value={p.ibsRef} min={0.15} max={0.2} step={0.001}
          onChange={set('ibsRef')} hint="Estimativa · estadual + municipal" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`p-3 rounded-lg border ${ganho2027 >= 0 ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'}`}>
          <div className="text-[10px] uppercase font-bold text-slate-600">Melhor regime em 2027</div>
          <div className="text-lg font-black">{rec2027.label}</div>
          <div className="text-[11px] text-slate-600">
            Híbrido vs Simples: {ganho2027 >= 0 ? '+' : ''}{brl(ganho2027)}/ano
          </div>
        </div>
        <div className="p-3 rounded-lg border bg-slate-50 border-slate-200">
          <div className="text-[10px] uppercase font-bold text-slate-600">Empate do híbrido (clientes creditantes)</div>
          <div className="text-lg font-black font-mono">
            {be2027 == null ? 'nunca' : pct(be2027, 0)} <span className="text-xs font-normal">(2027)</span> ·{' '}
            {be2033 == null ? 'nunca' : pct(be2033, 0)} <span className="text-xs font-normal">(2033)</span>
          </div>
          <div className="text-[11px] text-slate-600">Acima disso o híbrido rende mais que o Simples puro</div>
        </div>
        <div className="p-3 rounded-lg border bg-slate-50 border-slate-200">
          <div className="text-[10px] uppercase font-bold text-slate-600">Academia no Simples: custo por R$ 100 de serviço</div>
          <div className="text-lg font-black font-mono">
            R$ 100 vs R${' '}
            {(100 + series[0].hibrido.creditoClientePor100).toFixed(2).replace('.', ',')} (2027) · R${' '}
            {(100 + series[6].hibrido.creditoClientePor100).toFixed(2).replace('.', ',')} (2033)
          </div>
          <div className="text-[11px] text-slate-600">
            Hub no Simples (tributo embutido) vs 3PL no regime regular (IBS/CBS por fora, sem crédito para quem é
            Simples). Aproximação: assume mesmo preço-base.
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-1.5 pr-2">Ano</th>
              <th className="py-1.5 pr-2">Fase</th>
              {REGIMES.map((r) => (
                <th key={r.key} className="py-1.5 px-2 text-right">{r.label}<br /><span className="font-normal">lucro · carga</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {series.map((row) => {
              const best = melhor(row).key;
              const cell = (x: ResultadoRegime) => (
                <>
                  <div className="font-mono font-bold">{brl(x.lucroLiquido)}</div>
                  <div className="font-mono text-[10px] text-slate-500">{pct(x.cargaPctReceita)}</div>
                </>
              );
              return (
                <tr key={row.fase.ano} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2 font-bold">{row.fase.ano}</td>
                  <td className="py-1.5 pr-2 text-slate-500">{row.fase.nota}</td>
                  {REGIMES.map((r) => (
                    <td key={r.key} className={`py-1.5 px-2 text-right ${r.cor} ${best === r.key ? 'bg-emerald-50' : ''}`}>
                      {cell(row[r.key])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-[10px] text-slate-500 mt-1">
          Carga = tributos + IBS/CBS absorvido de clientes que não creditam − créditos de insumos, sobre a receita.
          Presumido usa presunção 32%, INSS patronal 27,8% sobre folha e ISS 5% (hipóteses). Lucro negativo reflete o
          resultado do Ano 2 do plano com DAS correto.
        </p>
      </div>

      <div>
        <h4 className="text-xs font-bold text-slate-900 mb-2">📋 Exigências e decisões imediatas</h4>
        <ul className="space-y-1.5">
          {OBRIGACOES_REFORMA.map((o) => (
            <li key={o.id} className="text-xs flex gap-2">
              <span
                className={`shrink-0 text-[9.5px] font-bold px-1.5 py-0.5 rounded h-fit ${
                  o.confianca === 'lei'
                    ? 'bg-emerald-100 text-emerald-900'
                    : o.confianca === 'regulamento'
                      ? 'bg-blue-100 text-blue-900'
                      : 'bg-amber-100 text-amber-900'
                }`}
              >
                {o.confianca === 'validar' ? 'VALIDAR CONTADOR' : o.confianca.toUpperCase()}
              </span>
              <span>
                <strong>{o.quando}:</strong> {o.item} <span className="text-slate-500">— {o.impacto}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
