import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  benchmarkWindow,
  clearComexStatCache,
  ComexStatError,
  COMEXSTAT_API,
  resetBenchmarkRateLimit,
} from '../core/comex/comexStatBenchmark';
import {
  clearComexStatMonthlyCache,
  fetchNcmMonthlySeries,
  monthlyCacheSize,
  monthlyWindow,
  seriesTrend,
  type MonthlyPoint,
} from '../core/comex/comexStatMonthly';

const UPDATED = { data: { updated: '2026-11-06', year: '2026', monthNumber: '10' }, success: true };

/** Linhas no formato real da sonda (2026-11-21): valores string, fora de ordem. */
const ROWS_2026 = [
  { year: '2026', monthNumber: '07', metricFOB: '35072438', metricFreight: '6348840', metricCIF: '41483610', metricKG: '17073374' },
  { year: '2026', monthNumber: '03', metricFOB: '31407137', metricFreight: '1949181', metricCIF: '33406209', metricKG: '13208442' },
  { year: '2026', monthNumber: '01', metricFOB: '31261954', metricFreight: '2468181', metricCIF: '33775379', metricKG: '12451510' },
  { year: '2026', monthNumber: '04', metricFOB: '30086158', metricFreight: '1953754', metricCIF: '32092412', metricKG: '12659248' },
  { year: '2026', monthNumber: '06', metricFOB: '29906043', metricFreight: '3291088', metricCIF: '33233349', metricKG: '14039092' },
  { year: '2026', monthNumber: '08', metricFOB: '26930240', metricFreight: '7171925', metricCIF: '34148276', metricKG: '13192845' },
  { year: '2026', monthNumber: '05', metricFOB: '24563577', metricFreight: '2339187', metricCIF: '26939637', metricKG: '9891404' },
  { year: '2026', monthNumber: '10', metricFOB: '24275484', metricFreight: '7194119', metricCIF: '31518089', metricKG: '12695820' },
  { year: '2026', monthNumber: '09', metricFOB: '22616414', metricFreight: '6105301', metricCIF: '28758896', metricKG: '12358259' },
  { year: '2026', monthNumber: '02', metricFOB: '21918392', metricFreight: '1560108', metricCIF: '23514399', metricKG: '10525680' },
];
/** 2025: só novembro (dezembro sem linha → zero na série). */
const ROWS_2025 = [
  { year: '2025', monthNumber: '11', metricFOB: '20000000', metricFreight: '2000000', metricCIF: '22000000', metricKG: '10000000' },
  { year: '2025', monthNumber: '03', metricFOB: '1000', metricFreight: '0', metricCIF: '1000', metricKG: '0' },
];
const ALL_ROWS = [...ROWS_2026, ...ROWS_2025];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/**
 * fetch falso da ComexStat no formato da sonda: período que cruza o ano volta vazio;
 * dentro do ano, devolve as linhas do ano cujo mês cai no período.
 */
function fakeComexStat(rows: Array<Record<string, string>> = ALL_ROWS, opts: { generalStatus?: number; general?: unknown } = {}) {
  const bodies: Array<Record<string, unknown>> = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/general/dates/updated')) return jsonResponse(UPDATED);
    if (url.includes('/general')) {
      const body = JSON.parse(String(init?.body)) as { period: { from: string; to: string } };
      bodies.push(body as unknown as Record<string, unknown>);
      if (opts.generalStatus) return jsonResponse({}, opts.generalStatus);
      if (opts.general) return jsonResponse(opts.general);
      const { from, to } = body.period;
      const sameYear = from.slice(0, 4) === to.slice(0, 4);
      const list = sameYear
        ? rows.filter((r) => {
            const ym = `${r.year}-${r.monthNumber}`;
            return ym >= from && ym <= to;
          })
        : [];
      return jsonResponse({ data: { list }, success: true, message: null, language: 'pt' });
    }
    return jsonResponse({ success: false }, 404);
  });
  return { impl: impl as unknown as typeof fetch, mock: impl, bodies };
}

beforeEach(() => {
  clearComexStatCache();
  clearComexStatMonthlyCache();
  resetBenchmarkRateLimit();
});

describe('monthlyWindow', () => {
  it('12 meses = benchmarkWindow', () => {
    for (const [y, m] of [['2026', '10'], ['2026', '1'], ['2025', '12']] as const) {
      expect(monthlyWindow(y, m, 12)).toEqual(benchmarkWindow(y, m));
    }
  });
  it('24 meses cruza dois anos: outubro/2026 → 2024-11 a 2026-10', () => {
    expect(monthlyWindow('2026', '10', 24)).toEqual({ from: '2024-11', to: '2026-10' });
  });
  it('24 meses terminando em dezembro → janeiro do ano anterior', () => {
    expect(monthlyWindow('2025', '12', 24)).toEqual({ from: '2024-01', to: '2025-12' });
  });
});

describe('fetchNcmMonthlySeries', () => {
  it('um POST por ano com monthDetail, série contínua ordenada e meses vazios = 0', async () => {
    const f = fakeComexStat();
    const s = await fetchNcmMonthlySeries({ ncm: '9506.91.00', countryCode: null, months: 12, fetchImpl: f.impl });
    expect(s.ncm).toBe('95069100');
    expect(s.countryCode).toBeNull();
    expect(s.period).toEqual({ from: '2025-11', to: '2026-10' });
    expect(s.updatedAt).toBe('2026-11-06');
    expect(f.bodies.map((b) => b.period)).toEqual([
      { from: '2025-11', to: '2025-12' },
      { from: '2026-01', to: '2026-10' },
    ]);
    const body = f.bodies[0];
    expect(body.flow).toBe('import');
    expect(body.monthDetail).toBe(true);
    expect(body.details).toEqual([]);
    expect(body.filters).toEqual([{ filter: 'ncm', values: ['95069100'] }]);
    expect(String(f.mock.mock.calls[1][0])).toBe(`${COMEXSTAT_API}/general?language=pt`);

    expect(s.months.map((m) => m.ym)).toEqual([
      '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
      '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
    ]);
    const dez = s.months[1];
    expect(dez).toEqual({ ym: '2025-12', fobUsd: 0, kg: 0, freightUsd: 0, cifUsd: 0, usdPerKg: null, freightPctFob: null });
    const jul = s.months.find((m) => m.ym === '2026-07')!;
    expect(jul.fobUsd).toBe(35072438);
    expect(jul.kg).toBe(17073374);
    expect(jul.freightUsd).toBe(6348840);
    expect(jul.cifUsd).toBe(41483610);
    expect(jul.usdPerKg).toBeCloseTo(35072438 / 17073374, 6);
    expect(jul.freightPctFob).toBeCloseTo(6348840 / 35072438, 6);
  });

  it('totais somam a série', async () => {
    const f = fakeComexStat();
    const s = await fetchNcmMonthlySeries({ ncm: '95069100', countryCode: null, months: 12, fetchImpl: f.impl });
    const fob = ROWS_2026.reduce((a, r) => a + Number(r.metricFOB), 0) + 20000000;
    const kg = ROWS_2026.reduce((a, r) => a + Number(r.metricKG), 0) + 10000000;
    expect(s.totals.fobUsd).toBe(fob);
    expect(s.totals.kg).toBe(kg);
    expect(s.totals.usdPerKg).toBeCloseTo(fob / kg, 6);
  });

  it('linhas repetidas do mesmo mês são somadas', async () => {
    const dup = [...ALL_ROWS, { year: '2026', monthNumber: '07', metricFOB: '100', metricFreight: '10', metricCIF: '110', metricKG: '50' }];
    const f = fakeComexStat(dup);
    const s = await fetchNcmMonthlySeries({ ncm: '95069100', countryCode: null, months: 12, fetchImpl: f.impl });
    expect(s.months.find((m) => m.ym === '2026-07')!.fobUsd).toBe(35072538);
  });

  it('kg/FOB zerados no mês → usdPerKg e freightPctFob null', async () => {
    const f = fakeComexStat();
    const s = await fetchNcmMonthlySeries({ ncm: '95069100', countryCode: null, months: 24, fetchImpl: f.impl });
    const mar25 = s.months.find((m) => m.ym === '2025-03')!;
    expect(mar25.fobUsd).toBe(1000);
    expect(mar25.usdPerKg).toBeNull();
    expect(mar25.freightPctFob).toBe(0);
  });

  it('24 meses: três trechos e 24 pontos; país vira filtro numérico', async () => {
    const f = fakeComexStat();
    const s = await fetchNcmMonthlySeries({ ncm: '95069100', countryCode: '160', months: 24, fetchImpl: f.impl });
    expect(s.months).toHaveLength(24);
    expect(s.months[0].ym).toBe('2024-11');
    expect(s.countryCode).toBe('160');
    expect(f.bodies.map((b) => b.period)).toEqual([
      { from: '2024-11', to: '2024-12' },
      { from: '2025-01', to: '2025-12' },
      { from: '2026-01', to: '2026-10' },
    ]);
    expect(f.bodies[0].filters).toEqual([
      { filter: 'ncm', values: ['95069100'] },
      { filter: 'country', values: [160] },
    ]);
  });

  it('código de país não numérico é ignorado', async () => {
    const f = fakeComexStat();
    const s = await fetchNcmMonthlySeries({ ncm: '95069100', countryCode: 'CN', months: 12, fetchImpl: f.impl });
    expect(s.countryCode).toBeNull();
    expect(f.bodies[0].filters).toHaveLength(1);
  });

  it('cache de 24 h por NCM/país/janela; expira depois de 24 h', async () => {
    const f = fakeComexStat();
    let t = 1_000_000;
    const now = () => t;
    await fetchNcmMonthlySeries({ ncm: '95069100', countryCode: null, months: 12, fetchImpl: f.impl, now });
    await fetchNcmMonthlySeries({ ncm: '95069100', countryCode: null, months: 12, fetchImpl: f.impl, now });
    expect(f.bodies).toHaveLength(2);
    expect(monthlyCacheSize()).toBe(1);
    // Janela diferente é outra chave.
    await fetchNcmMonthlySeries({ ncm: '95069100', countryCode: null, months: 24, fetchImpl: f.impl, now });
    expect(f.bodies).toHaveLength(5);
    t += 24 * 3600 * 1000 + 1;
    await fetchNcmMonthlySeries({ ncm: '95069100', countryCode: null, months: 12, fetchImpl: f.impl, now });
    expect(f.bodies).toHaveLength(7);
  });

  it('chamadas simultâneas iguais compartilham a mesma consulta', async () => {
    const f = fakeComexStat();
    const [a, b] = await Promise.all([
      fetchNcmMonthlySeries({ ncm: '95069100', countryCode: null, months: 12, fetchImpl: f.impl }),
      fetchNcmMonthlySeries({ ncm: '95069100', countryCode: null, months: 12, fetchImpl: f.impl }),
    ]);
    expect(a).toBe(b);
    expect(f.bodies).toHaveLength(2);
  });

  it('HTTP de erro → ComexStatError em pt-BR', async () => {
    const f = fakeComexStat(ALL_ROWS, { generalStatus: 500 });
    const p = fetchNcmMonthlySeries({ ncm: '95069100', countryCode: null, months: 12, fetchImpl: f.impl });
    await expect(p).rejects.toBeInstanceOf(ComexStatError);
    await expect(
      fetchNcmMonthlySeries({ ncm: '95069100', countryCode: null, months: 12, fetchImpl: f.impl }),
    ).rejects.toThrow(/ComexStat respondeu HTTP 500/);
  });

  it('ComexStat pendurado → ComexStatError por timeout e libera a consulta em andamento', async () => {
    const hang = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
        }),
    ) as unknown as typeof fetch;
    const opts = { ncm: '95069100', countryCode: null, months: 12 as const, fetchImpl: hang, timeoutMs: 20 };
    await expect(fetchNcmMonthlySeries(opts)).rejects.toThrow(/não respondeu a tempo/);
    const f = fakeComexStat();
    const s = await fetchNcmMonthlySeries({ ...opts, fetchImpl: f.impl });
    expect(s.months).toHaveLength(12);
  });

  it('success:false → ComexStatError', async () => {
    const f = fakeComexStat(ALL_ROWS, { general: { success: false } });
    await expect(
      fetchNcmMonthlySeries({ ncm: '95069100', countryCode: null, months: 12, fetchImpl: f.impl }),
    ).rejects.toBeInstanceOf(ComexStatError);
  });
});

const pt = (ym: string, fobUsd: number, kg: number): MonthlyPoint => ({
  ym,
  fobUsd,
  kg,
  freightUsd: 0,
  cifUsd: fobUsd,
  usdPerKg: kg > 0 ? fobUsd / kg : null,
  freightPctFob: fobUsd > 0 ? 0 : null,
});

describe('seriesTrend — últimos 3 meses vs. 3 anteriores', () => {
  it('variação de FOB e de US$/kg', () => {
    const months = [
      pt('2026-05', 100, 100),
      pt('2026-06', 100, 100),
      pt('2026-07', 100, 100),
      pt('2026-08', 150, 100),
      pt('2026-09', 150, 100),
      pt('2026-10', 150, 100),
    ];
    const t = seriesTrend(months);
    expect(t.fobPct).toBeCloseTo(0.5, 6);
    expect(t.usdPerKgPct).toBeCloseTo(0.5, 6);
    expect(t.recent).toEqual({ from: '2026-08', to: '2026-10' });
    expect(t.previous).toEqual({ from: '2026-05', to: '2026-07' });
  });
  it('usa só os 6 últimos meses', () => {
    const months = [pt('2026-04', 999999, 1), ...['05', '06', '07'].map((m) => pt(`2026-${m}`, 200, 100)), ...['08', '09', '10'].map((m) => pt(`2026-${m}`, 100, 100))];
    const t = seriesTrend(months);
    expect(t.fobPct).toBeCloseTo(-0.5, 6);
    expect(t.usdPerKgPct).toBeCloseTo(-0.5, 6);
  });
  it('menos de 6 meses → null', () => {
    expect(seriesTrend([pt('2026-10', 1, 1)])).toEqual({ fobPct: null, usdPerKgPct: null, recent: null, previous: null });
  });
  it('base zerada → null (sem divisão por zero)', () => {
    const months = [...['05', '06', '07'].map((m) => pt(`2026-${m}`, 0, 0)), ...['08', '09', '10'].map((m) => pt(`2026-${m}`, 100, 10))];
    const t = seriesTrend(months);
    expect(t.fobPct).toBeNull();
    expect(t.usdPerKgPct).toBeNull();
  });
});
