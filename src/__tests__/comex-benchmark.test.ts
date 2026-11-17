import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BENCH_CACHE_MAX,
  benchmarkCacheSize,
  benchmarkWindow,
  clearComexStatCache,
  ComexStatError,
  compareProcessToBenchmark,
  COMEXSTAT_API,
  fetchNcmBenchmark,
  resetBenchmarkRateLimit,
  splitPeriodByYear,
  type NcmBenchmark,
} from '../core/comex/comexStatBenchmark';
import { DEFAULT_COMEX_FIELD_DEFS } from '../core/comex/fieldDefsSeed';
import { registerPucomexRoutes } from '../core/comex/registerPucomexRoutes';

const UPDATED = { data: { updated: '2026-11-06', year: '2026', monthNumber: '10' }, success: true };
const GENERAL = {
  data: {
    list: [
      { year: '2025', country: 'China', metricFOB: '200000000', metricFreight: '28000000', metricCIF: '228000000', metricKG: '90000000' },
      { year: '2026', country: 'China', metricFOB: '11117865', metricFreight: '1180474', metricCIF: '12705152', metricKG: '3759523' },
    ],
  },
  success: true,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/**
 * fetch falso da ComexStat: datas + /general. Guarda os corpos enviados.
 * Como a API real, um período que cruza o ano volta vazio; dentro do ano,
 * devolve só as linhas daquele ano.
 */
function fakeComexStat(general: unknown = GENERAL, updated: unknown = UPDATED) {
  const bodies: unknown[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/general/dates/updated')) return jsonResponse(updated);
    if (url.includes('/general')) {
      const body = JSON.parse(String(init?.body)) as { period: { from: string; to: string } };
      bodies.push(body);
      const g = general as { data?: { list?: Array<{ year: string }> } };
      if (!g?.data?.list) return jsonResponse(general);
      const y = body.period.from.slice(0, 4);
      const list = y === body.period.to.slice(0, 4) ? g.data.list.filter((r) => r.year === y) : [];
      return jsonResponse({ ...g, data: { list } });
    }
    return jsonResponse({ success: false }, 404);
  });
  return { impl: impl as unknown as typeof fetch, mock: impl, bodies };
}

beforeEach(() => {
  clearComexStatCache();
  resetBenchmarkRateLimit();
});

describe('benchmarkWindow — 12 meses terminando no último mês fechado', () => {
  it('outubro/2026 → 2025-11 a 2026-10', () => {
    expect(benchmarkWindow('2026', '10')).toEqual({ from: '2025-11', to: '2026-10' });
  });
  it('virada de ano: janeiro/2026 → 2025-02 a 2026-01', () => {
    expect(benchmarkWindow('2026', '1')).toEqual({ from: '2025-02', to: '2026-01' });
  });
  it('dezembro → janeiro do mesmo ano', () => {
    expect(benchmarkWindow('2025', '12')).toEqual({ from: '2025-01', to: '2025-12' });
  });
});

describe('splitPeriodByYear — a API não aceita período que cruza o ano', () => {
  it('quebra 2025-11..2026-10 em dois trechos', () => {
    expect(splitPeriodByYear({ from: '2025-11', to: '2026-10' })).toEqual([
      { from: '2025-11', to: '2025-12' },
      { from: '2026-01', to: '2026-10' },
    ]);
  });
  it('mesmo ano → um trecho', () => {
    expect(splitPeriodByYear({ from: '2025-01', to: '2025-12' })).toEqual([{ from: '2025-01', to: '2025-12' }]);
  });
});

describe('fetchNcmBenchmark', () => {
  it('soma as linhas, converte strings e monta o corpo com NCM e país', async () => {
    const f = fakeComexStat();
    const b = await fetchNcmBenchmark({ ncm: '95069100', countryCode: '160', fetchImpl: f.impl });
    expect(b.fobUsd).toBe(211117865);
    expect(b.kg).toBe(93759523);
    expect(b.freightUsd).toBe(29180474);
    expect(b.cifUsd).toBe(240705152);
    expect(b.usdPerKg).toBeCloseTo(2.2517, 3);
    expect(b.freightPctFob).toBeCloseTo(0.1382, 3);
    expect(b.period).toEqual({ from: '2025-11', to: '2026-10' });
    expect(b.updatedAt).toBe('2026-11-06');
    expect(b.allCountries).toBe(false);
    expect(b.countryName).toBe('China');
    expect(b.countryCode).toBe('160');
    const body = f.bodies[0] as { flow: string; period: unknown; filters: Array<{ filter: string; values: unknown[] }> };
    expect(body.flow).toBe('import');
    // A API devolve vazio quando o período cruza o ano: uma consulta por ano.
    expect(f.bodies.map((x) => (x as { period: unknown }).period)).toEqual([
      { from: '2025-11', to: '2025-12' },
      { from: '2026-01', to: '2026-10' },
    ]);
    expect(body.filters).toEqual([
      { filter: 'ncm', values: ['95069100'] },
      { filter: 'country', values: [160] },
    ]);
    expect(String(f.mock.mock.calls[1][0])).toBe(`${COMEXSTAT_API}/general?language=pt`);
  });

  it('sem país: média de todos os países, sem filtro de país', async () => {
    const f = fakeComexStat();
    const b = await fetchNcmBenchmark({ ncm: '95069100', countryCode: null, fetchImpl: f.impl });
    expect(b.allCountries).toBe(true);
    expect(b.countryName).toBeNull();
    const body = f.bodies[0] as { filters: Array<{ filter: string }> };
    expect(body.filters.map((x) => x.filter)).toEqual(['ncm']);
  });

  it('kg/FOB zerados → usdPerKg e freightPctFob null', async () => {
    const f = fakeComexStat({ data: { list: [] }, success: true });
    const b = await fetchNcmBenchmark({ ncm: '95069100', countryCode: '160', fetchImpl: f.impl });
    expect(b.fobUsd).toBe(0);
    expect(b.usdPerKg).toBeNull();
    expect(b.freightPctFob).toBeNull();
  });

  it('cache de 24 h: segunda chamada não vai à API; expira depois de 24 h', async () => {
    const f = fakeComexStat();
    let t = 1_000_000;
    const now = () => t;
    await fetchNcmBenchmark({ ncm: '95069100', countryCode: '160', fetchImpl: f.impl, now });
    await fetchNcmBenchmark({ ncm: '95069100', countryCode: '160', fetchImpl: f.impl, now });
    expect(f.bodies).toHaveLength(2); // dois trechos (um por ano), uma vez só
    expect(f.mock).toHaveBeenCalledTimes(3);
    t += 24 * 3600 * 1000 + 1;
    await fetchNcmBenchmark({ ncm: '95069100', countryCode: '160', fetchImpl: f.impl, now });
    expect(f.bodies).toHaveLength(4);
  });

  it('cache limitado: remove expirados e respeita o teto (mais antigo sai)', async () => {
    const f = fakeComexStat({ data: { list: [] }, success: true });
    let t = 1_000_000;
    const now = () => t;
    // Entrada que vai expirar.
    await fetchNcmBenchmark({ ncm: '00000000', countryCode: null, fetchImpl: f.impl, now });
    t += 24 * 3600 * 1000 + 1;
    for (let i = 1; i <= BENCH_CACHE_MAX + 10; i += 1) {
      await fetchNcmBenchmark({ ncm: String(i).padStart(8, '0'), countryCode: null, fetchImpl: f.impl, now });
    }
    expect(benchmarkCacheSize()).toBe(BENCH_CACHE_MAX);
    const before = f.bodies.length;
    // A mais antiga (00000001) foi despejada → vai de novo à API; a mais nova vem do cache.
    await fetchNcmBenchmark({ ncm: String(BENCH_CACHE_MAX + 10).padStart(8, '0'), countryCode: null, fetchImpl: f.impl, now });
    expect(f.bodies.length).toBe(before);
    await fetchNcmBenchmark({ ncm: '00000001', countryCode: null, fetchImpl: f.impl, now });
    expect(f.bodies.length).toBeGreaterThan(before);
  });

  it('chamadas simultâneas iguais compartilham a mesma consulta', async () => {
    const f = fakeComexStat();
    const [a, b] = await Promise.all([
      fetchNcmBenchmark({ ncm: '95069100', countryCode: '160', fetchImpl: f.impl }),
      fetchNcmBenchmark({ ncm: '95069100', countryCode: '160', fetchImpl: f.impl }),
    ]);
    expect(a).toBe(b);
    expect(f.bodies).toHaveLength(2); // um POST por ano, uma vez só
  });

  it('lista vazia com país → nome legível pelo código (160 → China)', async () => {
    const f = fakeComexStat({ data: { list: [] }, success: true });
    const b = await fetchNcmBenchmark({ ncm: '95069100', countryCode: '160', fetchImpl: f.impl });
    expect(b.countryName).toBe('China');
  });

  it('erros próprios são ComexStatError', async () => {
    const impl = vi.fn(async () => jsonResponse({}, 503)) as unknown as typeof fetch;
    await expect(fetchNcmBenchmark({ ncm: '95069100', countryCode: '160', fetchImpl: impl })).rejects.toBeInstanceOf(
      ComexStatError,
    );
  });

  it('HTTP de erro → Error em pt-BR', async () => {
    const impl = vi.fn(async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    await expect(fetchNcmBenchmark({ ncm: '95069100', countryCode: '160', fetchImpl: impl })).rejects.toThrow(
      /ComexStat/,
    );
  });

  it('success:false → Error em pt-BR', async () => {
    const f = fakeComexStat({ success: false, message: 'limite' });
    await expect(fetchNcmBenchmark({ ncm: '95069100', countryCode: '160', fetchImpl: f.impl })).rejects.toThrow(
      /ComexStat recusou/,
    );
  });
});

describe('compareProcessToBenchmark', () => {
  const bench = {
    usdPerKg: 2.25,
    freightPctFob: 0.138,
  } as NcmBenchmark;
  const RESSALVA = /a NCM agrega produtos diferentes — a média é referência, não prova/;

  it('ok perto da média, com frete/FOB e ressalva', () => {
    const c = compareProcessToBenchmark({ fobUsd: 22500, kg: 10000, freightUsd: 2760 }, bench);
    expect(c.level).toBe('ok');
    expect(c.usdPerKg).toBeCloseTo(2.25);
    expect(c.ratio).toBeCloseTo(1);
    expect(c.freightPctFob).toBeCloseTo(0.1227, 3);
    expect(c.freightRatio).toBeCloseTo(0.889, 2);
    expect(c.messages.some((m) => RESSALVA.test(m))).toBe(true);
  });

  it('abaixo (< 0,8)', () => {
    expect(compareProcessToBenchmark({ fobUsd: 15000, kg: 10000 }, bench).level).toBe('abaixo');
  });

  it('muito abaixo (< 0,5) → risco de valoração', () => {
    const c = compareProcessToBenchmark({ fobUsd: 10000, kg: 10000 }, bench);
    expect(c.level).toBe('muito_abaixo');
    expect(c.messages.join(' ')).toMatch(/valoração aduaneira/);
    expect(c.messages.some((m) => RESSALVA.test(m))).toBe(true);
  });

  it('acima (> 2) → informativo', () => {
    const c = compareProcessToBenchmark({ fobUsd: 50000, kg: 10000 }, bench);
    expect(c.level).toBe('acima');
    expect(c.messages.join(' ')).toMatch(/maior valor agregado/);
  });

  it('limites: 0,8 é ok, 2 é ok', () => {
    const b2 = { usdPerKg: 2, freightPctFob: null } as NcmBenchmark;
    expect(compareProcessToBenchmark({ fobUsd: 16000, kg: 10000 }, b2).level).toBe('ok');
    expect(compareProcessToBenchmark({ fobUsd: 40000, kg: 10000 }, b2).level).toBe('ok');
  });

  it('sem kg ou sem FOB → sem_dados', () => {
    expect(compareProcessToBenchmark({ fobUsd: 10000 }, bench).level).toBe('sem_dados');
    expect(compareProcessToBenchmark({ fobUsd: 0, kg: 100 }, bench).level).toBe('sem_dados');
    const c = compareProcessToBenchmark({ fobUsd: 10000, kg: 0 }, bench);
    expect(c.level).toBe('sem_dados');
    expect(c.ratio).toBeNull();
    expect(c.messages.some((m) => RESSALVA.test(m))).toBe(true);
  });

  it('média sem preço/kg → sem_dados', () => {
    const c = compareProcessToBenchmark({ fobUsd: 10000, kg: 100 }, { usdPerKg: null, freightPctFob: null } as NcmBenchmark);
    expect(c.level).toBe('sem_dados');
  });
});

describe('seed de processo — peso bruto para o preço/kg', () => {
  it('gross_weight_kg numérico logo depois do FOB', () => {
    const proc = DEFAULT_COMEX_FIELD_DEFS.filter((d) => d.entity === 'process');
    const peso = proc.find((d) => d.field_key === 'gross_weight_kg');
    const fob = proc.find((d) => d.field_key === 'fob_value_usd')!;
    expect(peso).toMatchObject({ label: 'Peso bruto (kg)', data_type: 'number', widget: 'number' });
    expect(peso!.sort_order!).toBeGreaterThan(fob.sort_order!);
    expect(peso!.sort_order!).toBeLessThan(120);
  });
});

describe('POST /api/comex/benchmark', () => {
  let baseUrl = '';
  let server: ReturnType<express.Express['listen']>;
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerPucomexRoutes(app);
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    server?.close();
    vi.restoreAllMocks();
  });

  /** Intercepta só as chamadas à ComexStat; o resto (o próprio servidor) segue real. */
  function mockComexStat() {
    const f = fakeComexStat();
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
      String(input).startsWith(COMEXSTAT_API) ? f.impl(input, init) : realFetch(input, init),
    );
    return f;
  }

  const post = (body: unknown) =>
    realFetch(`${baseUrl}/api/comex/benchmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('400 com NCM inválida', async () => {
    mockComexStat();
    const res = await post({ ncmCode: '9506' });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/8 dígitos/);
  });

  it('200 sem token: benchmark + comparação (país China pelo rótulo)', async () => {
    const f = mockComexStat();
    const res = await post({ ncmCode: '9506.91.00', country: 'China (CN)', fobUsd: 10000, kg: 10000, freightUsd: 1000 });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.benchmark.ncm).toBe('95069100');
    expect(json.data.benchmark.allCountries).toBe(false);
    expect(json.data.comparison.level).toBe('muito_abaixo');
    const body = f.bodies[0] as { filters: Array<{ filter: string; values: unknown[] }> };
    expect(body.filters[1]).toEqual({ filter: 'country', values: [160] });
  });

  it('país sem mapeamento → todos os países; sem FOB → comparison null', async () => {
    const f = mockComexStat();
    const res = await post({ ncmCode: '95069100', country: 'DE' });
    const json = await res.json();
    expect(json.data.benchmark.allCountries).toBe(true);
    expect(json.data.comparison).toBeNull();
    expect((f.bodies[0] as { filters: unknown[] }).filters).toHaveLength(1);
  });

  it('502: erro próprio do módulo sai com a mensagem; erro inesperado sai genérico', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
      String(input).startsWith(COMEXSTAT_API) ? Promise.resolve(jsonResponse({}, 500)) : realFetch(input, init),
    );
    const known = await post({ ncmCode: '95069100', country: 'CN' });
    expect(known.status).toBe(502);
    expect((await known.json()).error).toMatch(/ComexStat respondeu HTTP 500/);

    clearComexStatCache();
    const spyErr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
      String(input).startsWith(COMEXSTAT_API)
        ? Promise.reject(new Error('connect ECONNREFUSED 10.0.0.7:443 detalhe interno'))
        : realFetch(input, init),
    );
    const unknown = await post({ ncmCode: '95069100', country: 'CN' });
    expect(unknown.status).toBe(502);
    const msg = (await unknown.json()).error as string;
    expect(msg).not.toMatch(/ECONNREFUSED|10\.0\.0\.7/);
    expect(msg).toMatch(/ComexStat/);
    expect(spyErr).toHaveBeenCalled();
    spyErr.mockRestore();
  });

  it('429 acima de 30 chamadas/min', async () => {
    mockComexStat();
    for (let i = 0; i < 30; i += 1) {
      const ok = await post({ ncmCode: '95069100', country: 'CN' });
      expect(ok.status).toBe(200);
    }
    const res = await post({ ncmCode: '95069100', country: 'CN' });
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toMatch(/Muitas consultas/);
  });
});
