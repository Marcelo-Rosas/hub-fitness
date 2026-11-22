/**
 * Série mensal de importação por NCM — API pública ComexStat (MDIC), sem autenticação.
 *
 * Painel de mercado: quanto o Brasil importa da NCM mês a mês (FOB, kg, frete, CIF,
 * US$/kg e frete/FOB) nos últimos 12 ou 24 meses fechados, opcionalmente por país.
 * Reaproveita a base do benchmark (data de atualização, split por ano, erros, cota).
 */

import {
  BENCH_CACHE_MAX,
  CACHE_TTL_MS,
  COMEXSTAT_API,
  loadComexStatUpdated,
  readComexStatJson,
  splitPeriodByYear,
} from './comexStatBenchmark';

export type SeriesMonths = 12 | 24;
export const SERIES_MONTHS: ReadonlyArray<SeriesMonths> = [12, 24];

export interface MonthlyPoint {
  /** Mês no formato YYYY-MM. */
  ym: string;
  fobUsd: number;
  kg: number;
  freightUsd: number;
  cifUsd: number;
  usdPerKg: number | null;
  freightPctFob: number | null;
}

export interface NcmMonthlySeries {
  ncm: string;
  /** Código numérico de país ComexStat (ex.: '160' China); null = todos os países. */
  countryCode: string | null;
  period: { from: string; to: string };
  /** Data de atualização da base ComexStat (YYYY-MM-DD). */
  updatedAt: string;
  months: MonthlyPoint[];
  totals: Omit<MonthlyPoint, 'ym'>;
}

export interface SeriesTrend {
  /** Variação do FOB somado (últimos 3 meses vs. 3 anteriores); null sem base. */
  fobPct: number | null;
  /** Variação do US$/kg médio (últimos 3 meses vs. 3 anteriores); null sem base. */
  usdPerKgPct: number | null;
  recent: { from: string; to: string } | null;
  previous: { from: string; to: string } | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Janela de N meses (YYYY-MM) terminando no último mês fechado. 12 = benchmarkWindow. */
export function monthlyWindow(year: string, monthNumber: string, months: SeriesMonths): { from: string; to: string } {
  const y = Number(year);
  const m = Number(monthNumber);
  const startIndex = y * 12 + (m - 1) - (months - 1);
  const fy = Math.floor(startIndex / 12);
  const fm = (startIndex % 12) + 1;
  return { from: `${fy}-${pad(fm)}`, to: `${y}-${pad(m)}` };
}

/** Todos os meses YYYY-MM de from a to, inclusive. */
function monthsBetween(period: { from: string; to: string }): string[] {
  const idx = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
  const out: string[] = [];
  for (let i = idx(period.from); i <= idx(period.to); i += 1) {
    out.push(`${Math.floor(i / 12)}-${pad((i % 12) + 1)}`);
  }
  return out;
}

function point(ym: string, fobUsd: number, kg: number, freightUsd: number, cifUsd: number): MonthlyPoint {
  return {
    ym,
    fobUsd,
    kg,
    freightUsd,
    cifUsd,
    usdPerKg: kg > 0 ? fobUsd / kg : null,
    freightPctFob: fobUsd > 0 ? freightUsd / fobUsd : null,
  };
}

const monthlyCache = new Map<string, { at: number; value: NcmMonthlySeries }>();
const monthlyInFlight = new Map<string, Promise<NcmMonthlySeries>>();

export function clearComexStatMonthlyCache(): void {
  monthlyCache.clear();
  monthlyInFlight.clear();
}

export function monthlyCacheSize(): number {
  return monthlyCache.size;
}

/** Grava no cache removendo expirados e, no teto, os mais antigos (mesmo padrão do benchmark). */
function storeMonthly(key: string, value: NcmMonthlySeries, at: number): void {
  for (const [k, v] of monthlyCache) {
    if (at - v.at > CACHE_TTL_MS) monthlyCache.delete(k);
  }
  monthlyCache.delete(key);
  while (monthlyCache.size >= BENCH_CACHE_MAX) {
    const oldest = monthlyCache.keys().next().value;
    if (oldest === undefined) break;
    monthlyCache.delete(oldest);
  }
  monthlyCache.set(key, { at, value });
}

export async function fetchNcmMonthlySeries(opts: {
  ncm: string;
  countryCode: string | null;
  months: SeriesMonths;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): Promise<NcmMonthlySeries> {
  const doFetch = opts.fetchImpl ?? globalThis.fetch;
  const now = opts.now ?? Date.now;
  const ncm = opts.ncm.replace(/\D/g, '');
  const countryCode = opts.countryCode && /^\d+$/.test(opts.countryCode) ? opts.countryCode : null;
  const months: SeriesMonths = opts.months === 24 ? 24 : 12;

  const updated = await loadComexStatUpdated(doFetch, now);
  const period = monthlyWindow(updated.year, updated.month, months);
  const key = `${ncm}|${countryCode ?? '*'}|${months}|${period.to}`;
  const hit = monthlyCache.get(key);
  if (hit && now() - hit.at <= CACHE_TTL_MS) return hit.value;

  // Chamadas simultâneas iguais compartilham a mesma consulta.
  const pending = monthlyInFlight.get(key);
  if (pending) return pending;
  const p = loadSeries({ ncm, countryCode, period, updatedAt: updated.updated, doFetch })
    .then((value) => {
      storeMonthly(key, value, now());
      return value;
    })
    .finally(() => monthlyInFlight.delete(key));
  monthlyInFlight.set(key, p);
  return p;
}

async function loadSeries(args: {
  ncm: string;
  countryCode: string | null;
  period: { from: string; to: string };
  updatedAt: string;
  doFetch: typeof fetch;
}): Promise<NcmMonthlySeries> {
  const { ncm, countryCode, period, updatedAt, doFetch } = args;
  const filters: Array<{ filter: string; values: unknown[] }> = [{ filter: 'ncm', values: [ncm] }];
  if (countryCode) filters.push({ filter: 'country', values: [Number(countryCode)] });

  const sums = new Map<string, { fob: number; kg: number; freight: number; cif: number }>();
  for (const ym of monthsBetween(period)) sums.set(ym, { fob: 0, kg: 0, freight: 0, cif: 0 });

  // Sequencial: a API tem limite de execução; período que cruza o ano volta vazio.
  for (const segment of splitPeriodByYear(period)) {
    const res = await doFetch(`${COMEXSTAT_API}/general?language=pt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        flow: 'import',
        monthDetail: true,
        period: segment,
        filters,
        details: [],
        metrics: ['metricFOB', 'metricKG', 'metricFreight', 'metricCIF'],
      }),
    });
    const json = await readComexStatJson(res, `importações mensais da NCM ${ncm}`);
    const list = ((json.data as { list?: unknown[] } | undefined)?.list ?? []) as Array<Record<string, unknown>>;
    for (const row of list) {
      const ym = `${String(row.year ?? '')}-${pad(Number(row.monthNumber))}`;
      const acc = sums.get(ym);
      if (!acc) continue; // fora da janela pedida
      acc.fob += num(row.metricFOB);
      acc.kg += num(row.metricKG);
      acc.freight += num(row.metricFreight);
      acc.cif += num(row.metricCIF);
    }
  }

  const monthsOut: MonthlyPoint[] = [];
  let fob = 0;
  let kg = 0;
  let freight = 0;
  let cif = 0;
  for (const [ym, s] of sums) {
    monthsOut.push(point(ym, s.fob, s.kg, s.freight, s.cif));
    fob += s.fob;
    kg += s.kg;
    freight += s.freight;
    cif += s.cif;
  }
  const { ym: _ym, ...totals } = point('', fob, kg, freight, cif);

  return { ncm, countryCode, period, updatedAt, months: monthsOut, totals };
}

/** Variação dos últimos 3 meses vs. os 3 anteriores (FOB somado e US$/kg médio). Puro. */
export function seriesTrend(months: ReadonlyArray<MonthlyPoint>): SeriesTrend {
  if (months.length < 6) return { fobPct: null, usdPerKgPct: null, recent: null, previous: null };
  const last6 = months.slice(-6);
  const prev = last6.slice(0, 3);
  const recent = last6.slice(3);
  const sum = (xs: MonthlyPoint[], k: 'fobUsd' | 'kg') => xs.reduce((a, x) => a + x[k], 0);
  const fobPrev = sum(prev, 'fobUsd');
  const fobRecent = sum(recent, 'fobUsd');
  const kgPrev = sum(prev, 'kg');
  const kgRecent = sum(recent, 'kg');
  const ppkPrev = kgPrev > 0 ? fobPrev / kgPrev : null;
  const ppkRecent = kgRecent > 0 ? fobRecent / kgRecent : null;
  return {
    fobPct: fobPrev > 0 ? fobRecent / fobPrev - 1 : null,
    usdPerKgPct: ppkPrev != null && ppkPrev > 0 && ppkRecent != null ? ppkRecent / ppkPrev - 1 : null,
    recent: { from: recent[0].ym, to: recent[2].ym },
    previous: { from: prev[0].ym, to: prev[2].ym },
  };
}
