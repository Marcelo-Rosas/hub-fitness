/**
 * Benchmark de preço de importação — API pública ComexStat (MDIC), sem autenticação.
 *
 * Média nacional dos últimos 12 meses fechados para a NCM (e país de origem, quando
 * há código ComexStat): FOB US$/kg e frete/FOB. Serve de referência de valoração
 * aduaneira — a NCM agrega produtos diferentes, então é indício, não prova.
 */

export const COMEXSTAT_API = 'https://api-comexstat.mdic.gov.br';
export const COMEXSTAT_SITE = 'https://comexstat.mdic.gov.br';
export const BENCHMARK_DISCLAIMER = 'a NCM agrega produtos diferentes — a média é referência, não prova.';

export const CACHE_TTL_MS = 24 * 3600 * 1000;
const RATE_LIMIT_PER_MIN = 30;

export interface NcmBenchmark {
  ncm: string;
  /** Código numérico de país ComexStat (ex.: '160' China); null = todos os países. */
  countryCode: string | null;
  countryName: string | null;
  period: { from: string; to: string };
  fobUsd: number;
  kg: number;
  freightUsd: number;
  cifUsd: number;
  usdPerKg: number | null;
  freightPctFob: number | null;
  /** Data de atualização da base ComexStat (YYYY-MM-DD). */
  updatedAt: string;
  allCountries: boolean;
}

export type BenchmarkLevel = 'ok' | 'abaixo' | 'muito_abaixo' | 'acima' | 'sem_dados';

export interface BenchmarkComparison {
  usdPerKg: number | null;
  ratio: number | null;
  freightPctFob: number | null;
  freightRatio: number | null;
  level: BenchmarkLevel;
  messages: string[];
}

/** Janela de 12 meses (YYYY-MM) terminando no último mês fechado. */
export function benchmarkWindow(year: string, monthNumber: string): { from: string; to: string } {
  const y = Number(year);
  const m = Number(monthNumber);
  const pad = (n: number) => String(n).padStart(2, '0');
  const startIndex = y * 12 + (m - 1) - 11;
  const fy = Math.floor(startIndex / 12);
  const fm = (startIndex % 12) + 1;
  return { from: `${fy}-${pad(fm)}`, to: `${y}-${pad(m)}` };
}

/**
 * A API devolve lista vazia quando o período cruza o ano (verificado em 2026-11-17):
 * quebra a janela em trechos dentro de cada ano.
 */
export function splitPeriodByYear(period: { from: string; to: string }): Array<{ from: string; to: string }> {
  const fy = Number(period.from.slice(0, 4));
  const ty = Number(period.to.slice(0, 4));
  const out: Array<{ from: string; to: string }> = [];
  for (let y = fy; y <= ty; y += 1) {
    out.push({ from: y === fy ? period.from : `${y}-01`, to: y === ty ? period.to : `${y}-12` });
  }
  return out;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Erro conhecido do módulo — mensagem pt-BR segura para devolver ao cliente. */
export class ComexStatError extends Error {
  readonly code = 'COMEXSTAT_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ComexStatError';
  }
}

/** Código numérico ComexStat → nome (fallback quando a API não devolve linhas). */
const COUNTRY_NAME_BY_CODE: Record<string, string> = { '160': 'China' };

/** Teto do cache: a chave vem de chamadores anônimos (rota pública). */
export const BENCH_CACHE_MAX = 500;

export type UpdatedInfo = { at: number; updated: string; year: string; month: string };
let updatedCache: UpdatedInfo | null = null;
let updatedInFlight: Promise<UpdatedInfo> | null = null;
const benchCache = new Map<string, { at: number; value: NcmBenchmark }>();
const benchInFlight = new Map<string, Promise<NcmBenchmark>>();
let rateHits: number[] = [];

export function clearComexStatCache(): void {
  updatedCache = null;
  updatedInFlight = null;
  benchCache.clear();
  benchInFlight.clear();
}

export function benchmarkCacheSize(): number {
  return benchCache.size;
}

/** Grava no cache removendo expirados e, no teto, os mais antigos (ordem de inserção do Map). */
function storeBenchmark(key: string, value: NcmBenchmark, at: number): void {
  for (const [k, v] of benchCache) {
    if (at - v.at > CACHE_TTL_MS) benchCache.delete(k);
  }
  benchCache.delete(key);
  while (benchCache.size >= BENCH_CACHE_MAX) {
    const oldest = benchCache.keys().next().value;
    if (oldest === undefined) break;
    benchCache.delete(oldest);
  }
  benchCache.set(key, { at, value });
}

export function resetBenchmarkRateLimit(): void {
  rateHits = [];
}

/** Limite global simples (memória): true se ainda cabe uma chamada no último minuto. */
export function takeBenchmarkSlot(now: number = Date.now()): boolean {
  rateHits = rateHits.filter((t) => now - t < 60_000);
  if (rateHits.length >= RATE_LIMIT_PER_MIN) return false;
  rateHits.push(now);
  return true;
}

/** Lê o JSON da ComexStat; HTTP de erro, corpo inválido ou success:false → ComexStatError. */
export async function readComexStatJson(res: Response, what: string): Promise<{ data?: unknown; success?: boolean }> {
  if (!res.ok) throw new ComexStatError(`ComexStat respondeu HTTP ${res.status} ao consultar ${what}.`);
  let json: { data?: unknown; success?: boolean };
  try {
    json = (await res.json()) as { data?: unknown; success?: boolean };
  } catch {
    throw new ComexStatError(`ComexStat devolveu resposta inválida ao consultar ${what}.`);
  }
  if (!json || json.success === false) throw new ComexStatError(`ComexStat recusou a consulta de ${what}.`);
  return json;
}

/** Último mês fechado da base ComexStat (cache 24 h, consultas simultâneas compartilhadas). */
export async function loadComexStatUpdated(doFetch: typeof fetch, now: () => number): Promise<UpdatedInfo> {
  if (updatedCache && now() - updatedCache.at <= CACHE_TTL_MS) return updatedCache;
  if (!updatedInFlight) {
    updatedInFlight = (async () => {
      const res = await doFetch(`${COMEXSTAT_API}/general/dates/updated`, { headers: { Accept: 'application/json' } });
      const json = await readComexStatJson(res, 'a data de atualização');
      const d = (json.data || {}) as { updated?: string; year?: string; monthNumber?: string };
      if (!d.year || !d.monthNumber) throw new ComexStatError('ComexStat não informou o último mês fechado.');
      updatedCache = { at: now(), updated: String(d.updated || ''), year: String(d.year), month: String(d.monthNumber) };
      return updatedCache;
    })().finally(() => {
      updatedInFlight = null;
    });
  }
  return updatedInFlight;
}

export async function fetchNcmBenchmark(opts: {
  ncm: string;
  countryCode: string | null;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): Promise<NcmBenchmark> {
  const doFetch = opts.fetchImpl ?? globalThis.fetch;
  const now = opts.now ?? Date.now;
  const ncm = opts.ncm.replace(/\D/g, '');
  const countryCode = opts.countryCode && /^\d+$/.test(opts.countryCode) ? opts.countryCode : null;

  const updated = await loadComexStatUpdated(doFetch, now);
  const period = benchmarkWindow(updated.year, updated.month);
  const key = `${ncm}|${countryCode ?? '*'}|${period.to}`;
  const hit = benchCache.get(key);
  if (hit && now() - hit.at <= CACHE_TTL_MS) return hit.value;

  // Chamadas simultâneas iguais compartilham a mesma consulta.
  const pending = benchInFlight.get(key);
  if (pending) return pending;
  const p = loadBenchmark({ ncm, countryCode, period, updatedAt: updated.updated, doFetch })
    .then((value) => {
      storeBenchmark(key, value, now());
      return value;
    })
    .finally(() => benchInFlight.delete(key));
  benchInFlight.set(key, p);
  return p;
}

async function loadBenchmark(args: {
  ncm: string;
  countryCode: string | null;
  period: { from: string; to: string };
  updatedAt: string;
  doFetch: typeof fetch;
}): Promise<NcmBenchmark> {
  const { ncm, countryCode, period, updatedAt, doFetch } = args;
  const filters: Array<{ filter: string; values: unknown[] }> = [{ filter: 'ncm', values: [ncm] }];
  if (countryCode) filters.push({ filter: 'country', values: [Number(countryCode)] });
  const list: Array<Record<string, unknown>> = [];
  // Sequencial: a API tem limite de execução.
  for (const segment of splitPeriodByYear(period)) {
    const res = await doFetch(`${COMEXSTAT_API}/general?language=pt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        flow: 'import',
        monthDetail: false,
        period: segment,
        filters,
        details: ['country'],
        metrics: ['metricFOB', 'metricKG', 'metricFreight', 'metricCIF'],
      }),
    });
    const json = await readComexStatJson(res, `importações da NCM ${ncm}`);
    list.push(...(((json.data as { list?: unknown[] } | undefined)?.list ?? []) as Array<Record<string, unknown>>));
  }

  let fobUsd = 0;
  let kg = 0;
  let freightUsd = 0;
  let cifUsd = 0;
  for (const row of list) {
    fobUsd += num(row.metricFOB);
    kg += num(row.metricKG);
    freightUsd += num(row.metricFreight);
    cifUsd += num(row.metricCIF);
  }
  const countryName = countryCode
    ? ((list.find((r) => typeof r.country === 'string')?.country as string | undefined) ??
      COUNTRY_NAME_BY_CODE[countryCode] ??
      null)
    : null;

  return {
    ncm,
    countryCode,
    countryName,
    period,
    fobUsd,
    kg,
    freightUsd,
    cifUsd,
    usdPerKg: kg > 0 ? fobUsd / kg : null,
    freightPctFob: fobUsd > 0 ? freightUsd / fobUsd : null,
    updatedAt,
    allCountries: !countryCode,
  };
}

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

/** Compara o processo (FOB, peso, frete) com a média ComexStat. Puro. */
export function compareProcessToBenchmark(
  proc: { fobUsd?: number | null; kg?: number | null; freightUsd?: number | null },
  bench: Pick<NcmBenchmark, 'usdPerKg' | 'freightPctFob'>,
): BenchmarkComparison {
  const fob = Number(proc.fobUsd) || 0;
  const kg = Number(proc.kg) || 0;
  const freight = Number(proc.freightUsd) || 0;
  const ressalva = `Atenção: ${BENCHMARK_DISCLAIMER}`;

  const freightPctFob = fob > 0 && freight > 0 ? freight / fob : null;
  const freightRatio =
    freightPctFob != null && bench.freightPctFob != null && bench.freightPctFob > 0
      ? freightPctFob / bench.freightPctFob
      : null;

  if (fob <= 0 || kg <= 0 || bench.usdPerKg == null || bench.usdPerKg <= 0) {
    return {
      usdPerKg: fob > 0 && kg > 0 ? fob / kg : null,
      ratio: null,
      freightPctFob,
      freightRatio,
      level: 'sem_dados',
      messages: ['Sem FOB e peso do processo (ou sem média na ComexStat) — comparação indisponível.', ressalva],
    };
  }

  const usdPerKg = fob / kg;
  const ratio = usdPerKg / bench.usdPerKg;
  const messages: string[] = [];
  let level: BenchmarkLevel;
  if (ratio < 0.5) {
    level = 'muito_abaixo';
    messages.push(
      `Preço/kg em ${pct(ratio)} da média nacional — risco de valoração aduaneira (suspeita de subfaturamento). Reúna fatura, contrato e comprovantes de pagamento.`,
    );
  } else if (ratio < 0.8) {
    level = 'abaixo';
    messages.push(`Preço/kg em ${pct(ratio)} da média nacional — abaixo da referência; tenha a justificativa comercial à mão.`);
  } else if (ratio > 2) {
    level = 'acima';
    messages.push(
      `Preço/kg em ${pct(ratio)} da média nacional — pode ser produto de maior valor agregado (informativo).`,
    );
  } else {
    level = 'ok';
    messages.push(`Preço/kg em ${pct(ratio)} da média nacional — dentro da faixa de referência.`);
  }
  if (freightRatio != null) {
    messages.push(
      `Frete/FOB do processo ${pct(freightPctFob!)} vs. média ${pct(bench.freightPctFob!)}.`,
    );
  }
  messages.push(ressalva);
  return { usdPerKg, ratio, freightPctFob, freightRatio, level, messages };
}
