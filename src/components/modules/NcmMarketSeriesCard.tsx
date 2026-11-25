import React, { useEffect, useState } from 'react';
import { ExternalLink, TrendingUp } from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BENCHMARK_DISCLAIMER, COMEXSTAT_SITE } from '../../core/comex/comexStatBenchmark';
import type { NcmMonthlySeries, SeriesMonths, SeriesTrend } from '../../core/comex/comexStatMonthly';
import { HUB_CHART, hubTick, hubTooltipStyle } from '../charts/hubChartTheme';
import { comexFetch } from './comexOperatorToken';

const usd = (n: number, digits = 2) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits });
/** Valor compacto em US$ (mi/mil): NCM de pouco volume não vira "US$ 0 mi". */
const usdCompact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `US$ ${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1e3) return `US$ ${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return usd(n, 0);
};
/** Tick do eixo FOB: mesma escala (mi ou mil) em todos os ticks, conforme o maior valor. */
const fobTick = (max: number) => (v: number) =>
  max >= 1e6
    ? `${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
    : `${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const signedPct = (n: number) => `${n > 0 ? '+' : ''}${pct(n)}`;
const ymLabel = (s: string) => {
  const [y, m] = s.split('-');
  return `${m}/${y.slice(2)}`;
};

const TrendValue: React.FC<{ label: string; value: number | null }> = ({ label, value }) => (
  <div>
    <div className="text-slate-500">{label}</div>
    <div
      className={`font-bold ${
        value == null ? 'text-slate-400' : value >= 0 ? 'text-emerald-700' : 'text-rose-700'
      }`}
    >
      {value == null ? '—' : signedPct(value)}
    </div>
  </div>
);

/**
 * Painel de mercado ComexStat (MDIC): importações mensais da NCM no Brasil —
 * FOB por mês (barras) e US$/kg (linha), 12 ou 24 meses, com tendência 3×3.
 */
export const NcmMarketSeriesCard: React.FC<{
  ncmCode: string;
  /** Rótulo "China (CN)" ou ISO2; sem código ComexStat → todos os países. */
  country?: string | null;
}> = ({ ncmCode, country }) => {
  const ncm = ncmCode.replace(/\D/g, '');
  const [months, setMonths] = useState<SeriesMonths>(12);
  const [series, setSeries] = useState<NcmMonthlySeries | null>(null);
  const [trend, setTrend] = useState<SeriesTrend | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // NCM/país novo: descarta a série anterior (só a troca 12/24 mantém os dados esmaecidos).
  useEffect(() => {
    setSeries(null);
    setTrend(null);
  }, [ncm, country]);

  useEffect(() => {
    if (ncm.length !== 8) {
      setSeries(null);
      setTrend(null);
      setError(null);
      return;
    }
    let alive = true;
    // Debounce: o NCM pode mudar a cada tecla.
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      comexFetch('/api/comex/stats/monthly', {
        method: 'POST',
        body: JSON.stringify({ ncmCode: ncm, country: country || undefined, months }),
      })
        .then(async (r) => {
          const isJson = (r.headers.get('content-type') || '').includes('application/json');
          if (!isJson) throw new Error(`O servidor respondeu HTTP ${r.status}.`);
          return r.json();
        })
        .then((j) => {
          if (!alive) return;
          if (j?.success) {
            setSeries(j.data.series as NcmMonthlySeries);
            setTrend(j.data.trend as SeriesTrend);
          } else {
            setSeries(null);
            setTrend(null);
            setError(j?.error || 'Falha ao consultar o ComexStat.');
          }
        })
        .catch((e: unknown) => {
          if (!alive) return;
          setSeries(null);
          setTrend(null);
          setError(e instanceof TypeError ? 'Falha de rede ao consultar o ComexStat.' : (e as Error).message);
        })
        .finally(() => alive && setLoading(false));
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [ncm, country, months]);

  if (ncm.length !== 8) return null;

  const allCountries = series ? series.countryCode == null : true;

  return (
    <div className="p-4 bg-slate-50 rounded-xl border text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h4 className="font-bold flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5 text-indigo-500" /> Mercado mês a mês
          <span className="font-normal text-slate-500"> · ComexStat · MDIC</span>
        </h4>
        <div className="inline-flex rounded-lg border bg-white overflow-hidden" role="group" aria-label="Janela da série">
          {([12, 24] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonths(m)}
              aria-pressed={months === m}
              className={`px-2 py-1 font-semibold ${
                months === m ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {m} meses
            </button>
          ))}
        </div>
      </div>

      {loading && !series ? (
        <p className="text-slate-500">Consultando as importações mensais da NCM…</p>
      ) : error ? (
        <p className="text-amber-800">Não foi possível consultar: {error}</p>
      ) : series ? (
        <div className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <div className="text-slate-500">FOB no período</div>
              <div className="font-bold text-slate-800">{usdCompact(series.totals.fobUsd)}</div>
            </div>
            <div>
              <div className="text-slate-500">US$/kg médio</div>
              <div className="font-bold text-slate-800">
                {series.totals.usdPerKg != null ? usd(series.totals.usdPerKg) : '—'}
              </div>
            </div>
            <TrendValue label="FOB (3m vs. 3m ant.)" value={trend?.fobPct ?? null} />
            <TrendValue label="US$/kg (3m vs. 3m ant.)" value={trend?.usdPerKgPct ?? null} />
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series.months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={HUB_CHART.grid} vertical={false} />
                <XAxis dataKey="ym" tick={hubTick} tickFormatter={ymLabel} interval="preserveStartEnd" />
                <YAxis
                  yAxisId="fob"
                  tick={hubTick}
                  width={48}
                  tickFormatter={fobTick(Math.max(0, ...series.months.map((p) => p.fobUsd)))}
                />
                <YAxis
                  yAxisId="ppk"
                  orientation="right"
                  tick={hubTick}
                  width={40}
                  tickFormatter={(v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                />
                <Tooltip
                  contentStyle={hubTooltipStyle}
                  labelFormatter={(l) => ymLabel(String(l))}
                  formatter={(value, name) => {
                    const v = Number(value);
                    return name === 'US$/kg' ? [usd(v), name] : [usdCompact(v), name];
                  }}
                />
                <Bar yAxisId="fob" dataKey="fobUsd" name="FOB" fill={HUB_CHART.stroke} radius={[3, 3, 0, 0]} />
                <Line
                  yAxisId="ppk"
                  type="monotone"
                  dataKey="usdPerKg"
                  name="US$/kg"
                  stroke={HUB_CHART.rent}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <p className="text-[11px] text-slate-500">
            Importações do Brasil · NCM {series.ncm} ·{' '}
            {allCountries ? 'todos os países' : `origem código ${series.countryCode}`} · {ymLabel(series.period.from)} a{' '}
            {ymLabel(series.period.to)} · base atualizada em {series.updatedAt || '—'}
            {allCountries && country ? ' (país sem código ComexStat mapeado)' : ''}. Barras: FOB (US$, eixo
            esquerdo); linha: US$/kg (eixo direito). Atenção: {BENCHMARK_DISCLAIMER}
          </p>
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
