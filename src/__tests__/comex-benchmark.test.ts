import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  benchmarkWindow,
  clearComexStatCache,
  compareProcessToBenchmark,
  COMEXSTAT_API,
  fetchNcmBenchmark,
  resetBenchmarkRateLimit,
  type NcmBenchmark,
} from '../core/comex/comexStatBenchmark';
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

/** fetch falso da ComexStat: datas + /general. Guarda os corpos enviados. */
function fakeComexStat(general: unknown = GENERAL, updated: unknown = UPDATED) {
  const bodies: unknown[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/general/dates/updated')) return jsonResponse(updated);
    if (url.includes('/general')) {
      bodies.push(JSON.parse(String(init?.body)));
      return jsonResponse(general);
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
    expect(body.period).toEqual({ from: '2025-11', to: '2026-10' });
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
    expect(f.bodies).toHaveLength(1);
    expect(f.mock).toHaveBeenCalledTimes(2);
    t += 24 * 3600 * 1000 + 1;
    await fetchNcmBenchmark({ ncm: '95069100', countryCode: '160', fetchImpl: f.impl, now });
    expect(f.bodies).toHaveLength(2);
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
