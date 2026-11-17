import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ExternalLink } from 'lucide-react';
import {
  BENCHMARK_DISCLAIMER,
  COMEXSTAT_SITE,
  compareProcessToBenchmark,
  type BenchmarkLevel,
  type NcmBenchmark,
} from '../../core/comex/comexStatBenchmark';
import { comexFetch } from './comexOperatorToken';

const LEVEL_STYLE: Record<BenchmarkLevel, { label: string; cls: string }> = {
  ok: { label: 'Dentro da média', cls: 'bg-emerald-100 text-emerald-800' },
  abaixo: { label: 'Abaixo da média', cls: 'bg-amber-100 text-amber-800' },
  muito_abaixo: { label: 'Muito abaixo — risco de valoração', cls: 'bg-rose-100 text-rose-800' },
  acima: { label: 'Acima da média', cls: 'bg-sky-100 text-sky-800' },
  sem_dados: { label: 'Sem dados para comparar', cls: 'bg-slate-100 text-slate-600' },
};

const usd = (n: number, digits = 2) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const ym = (s: string) => {
  const [y, m] = s.split('-');
  return `${m}/${y}`;
};

/**
 * Referência de preço ComexStat (MDIC): média US$/kg e frete/FOB da NCM nos
 * últimos 12 meses; com FOB e peso, compara o processo. Só informativo.
 */
export const NcmBenchmarkCard: React.FC<{
  ncmCode: string;
  /** Rótulo "China (CN)" ou ISO2; sem código ComexStat → todos os países. */
  country?: string | null;
  fobUsd?: number | null;
  kg?: number | null;
  freightUsd?: number | null;
  compact?: boolean;
}> = ({ ncmCode, country, fobUsd, kg, freightUsd, compact }) => {
  const ncm = ncmCode.replace(/\D/g, '');
  const [bench, setBench] = useState<NcmBenchmark | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ncm.length !== 8) {
      setBench(null);
      setError(null);
      return;
    }
    let alive = true;
    // Debounce: no modal o NCM muda a cada tecla.
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      comexFetch('/api/comex/benchmark', {
        method: 'POST',
        body: JSON.stringify({ ncmCode: ncm, country: country || undefined }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (!alive) return;
          if (j?.success) setBench(j.data.benchmark as NcmBenchmark);
          else {
            setBench(null);
            setError(j?.error || 'Falha ao consultar o ComexStat.');
          }
        })
        .catch(() => alive && setError('Falha de rede ao consultar o ComexStat.'))
        .finally(() => alive && setLoading(false));
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [ncm, country]);

  const comparison = useMemo(
    () => (bench && fobUsd && kg ? compareProcessToBenchmark({ fobUsd, kg, freightUsd }, bench) : null),
    [bench, fobUsd, kg, freightUsd],
  );

  if (ncm.length !== 8) return null;

  return (
    <div className={`${compact ? 'p-3' : 'p-4'} bg-slate-50 rounded-xl border text-xs`}>
      <h4 className="font-bold mb-2 flex items-center gap-1">
        <BarChart3 className="w-3.5 h-3.5 text-indigo-500" /> Referência de preço
        <span className="font-normal text-slate-500"> · ComexStat · MDIC</span>
      </h4>
      {loading && !bench ? (
        <p className="text-slate-500">Consultando a média nacional de importação…</p>
      ) : error ? (
        <p className="text-amber-800">Não foi possível consultar: {error}</p>
      ) : bench ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-slate-500">Média FOB</div>
              <div className="font-bold text-slate-800">
                {bench.usdPerKg != null ? `${usd(bench.usdPerKg)}/kg` : '—'}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Frete/FOB médio</div>
              <div className="font-bold text-slate-800">
                {bench.freightPctFob != null ? pct(bench.freightPctFob) : '—'}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            NCM {bench.ncm} · {bench.allCountries ? 'todos os países' : `origem ${bench.countryName ?? bench.countryCode}`}{' '}
            · {ym(bench.period.from)} a {ym(bench.period.to)} · {(bench.kg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} t
            importadas
            {bench.allCountries && country ? ' (país sem código ComexStat mapeado)' : ''}
          </p>
          {comparison ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full font-bold ${LEVEL_STYLE[comparison.level].cls}`}>
                  {LEVEL_STYLE[comparison.level].label}
                </span>
                {comparison.usdPerKg != null ? (
                  <span className="text-slate-700">
                    Processo: {usd(comparison.usdPerKg)}/kg
                    {comparison.freightPctFob != null ? ` · frete/FOB ${pct(comparison.freightPctFob)}` : ''}
                  </span>
                ) : null}
              </div>
              <ul className="space-y-0.5 text-slate-600">
                {comparison.messages.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500">
              Informe FOB e peso (kg) para comparar o processo. Atenção: {BENCHMARK_DISCLAIMER}
            </p>
          )}
        </div>
      ) : null}
      <a
        href={COMEXSTAT_SITE}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-indigo-700 font-semibold hover:underline"
      >
        <ExternalLink className="w-3.5 h-3.5" /> Abrir o ComexStat
      </a>
    </div>
  );
};
