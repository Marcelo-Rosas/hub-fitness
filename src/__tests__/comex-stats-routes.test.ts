import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { comexGateway, COMEX_PUBLIC_ROUTES } from '../core/comex/comexGuard';
import {
  clearComexStatCache,
  resetBenchmarkRateLimit,
  takeBenchmarkSlot,
} from '../core/comex/comexStatBenchmark';
import { clearComexStatMonthlyCache } from '../core/comex/comexStatMonthly';
import { registerComexStatsRoutes } from '../core/comex/registerComexStatsRoutes';
import { registerPucomexRoutes } from '../core/comex/registerPucomexRoutes';

const ENV_KEYS = ['COMEX_OPERATOR_TOKEN'] as const;
const saved: Record<string, string | undefined> = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

const UPDATED = { data: { updated: '2026-11-06', year: '2026', monthNumber: '10' }, success: true };
const ROWS = [
  { year: '2026', monthNumber: '07', metricFOB: '35072438', metricFreight: '6348840', metricCIF: '41483610', metricKG: '17073374' },
  { year: '2026', monthNumber: '03', metricFOB: '31407137', metricFreight: '1949181', metricCIF: '33406209', metricKG: '13208442' },
  { year: '2025', monthNumber: '11', metricFOB: '20000000', metricFreight: '2000000', metricCIF: '22000000', metricKG: '10000000' },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const bodies: Array<Record<string, unknown>> = [];
const okFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes('/general/dates/updated')) return jsonResponse(UPDATED);
  const body = JSON.parse(String(init?.body)) as { period: { from: string; to: string } };
  bodies.push(body as unknown as Record<string, unknown>);
  const { from, to } = body.period;
  const list =
    from.slice(0, 4) === to.slice(0, 4)
      ? ROWS.filter((r) => `${r.year}-${r.monthNumber}` >= from && `${r.year}-${r.monthNumber}` <= to)
      : [];
  return jsonResponse({ data: { list }, success: true });
}) as typeof fetch;

/** fetch injetado no register; cada teste troca o comportamento. */
let current: typeof fetch = okFetch;
const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => current(input, init)) as unknown as typeof fetch;

let baseUrl = '';
let fullUrl = '';
let server: ReturnType<express.Express['listen']>;
let fullServer: ReturnType<express.Express['listen']>;

async function listen(app: express.Express) {
  const s = app.listen(0);
  await new Promise((r) => s.once('listening', r));
  return { s, url: `http://127.0.0.1:${(s.address() as AddressInfo).port}` };
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/comex', comexGateway);
  registerComexStatsRoutes(app, { fetchImpl });
  ({ s: server, url: baseUrl } = await listen(app));

  const full = express();
  full.use(express.json());
  registerPucomexRoutes(full);
  ({ s: fullServer, url: fullUrl } = await listen(full));
});

beforeEach(() => {
  process.env.COMEX_OPERATOR_TOKEN = 't';
  current = okFetch;
  bodies.length = 0;
  clearComexStatCache();
  clearComexStatMonthlyCache();
  resetBenchmarkRateLimit();
});

afterAll(() => {
  server?.close();
  fullServer?.close();
  resetBenchmarkRateLimit();
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const post = (body: unknown, url = baseUrl) =>
  fetch(`${url}/api/comex/stats/monthly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/comex/stats/monthly', () => {
  it('400 com NCM inválida (sem token: rota pública, também via registerPucomexRoutes)', async () => {
    for (const url of [baseUrl, fullUrl]) {
      const res = await post({ ncmCode: '9506' }, url);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/8 dígitos/);
    }
    expect(bodies).toHaveLength(0);
  });

  it('400 com months fora de 12/24', async () => {
    const res = await post({ ncmCode: '95069100', months: 6 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/12 ou 24/);
  });

  it('200 sem token: série de 12 meses (padrão), tendência e todos os países', async () => {
    const res = await post({ ncmCode: '9506.91.00' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    const { series, trend } = json.data;
    expect(series.ncm).toBe('95069100');
    expect(series.countryCode).toBeNull();
    expect(series.months).toHaveLength(12);
    expect(series.period).toEqual({ from: '2025-11', to: '2026-10' });
    expect(series.months[0]).toMatchObject({ ym: '2025-11', fobUsd: 20000000 });
    expect(trend).toHaveProperty('fobPct');
    expect(trend.recent).toEqual({ from: '2026-08', to: '2026-10' });
    expect((bodies[0] as { monthDetail: boolean }).monthDetail).toBe(true);
    expect((bodies[0] as { filters: unknown[] }).filters).toHaveLength(1);
  });

  it('24 meses e país pelo rótulo (China → 160)', async () => {
    const res = await post({ ncmCode: '95069100', months: 24, country: 'China (CN)' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.series.months).toHaveLength(24);
    expect(json.data.series.countryCode).toBe('160');
    expect((bodies[0] as { filters: unknown[] }).filters[1]).toEqual({ filter: 'country', values: [160] });
  });

  it('429 sem vaga na cota compartilhada do ComexStat', async () => {
    for (let i = 0; i < 30; i += 1) takeBenchmarkSlot();
    const res = await post({ ncmCode: '95069100' });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/Muitas consultas/);
    expect(bodies).toHaveLength(0);
  });

  it('502: erro próprio do módulo sai com a mensagem; erro inesperado sai genérico', async () => {
    current = (async () => jsonResponse({}, 500)) as unknown as typeof fetch;
    const known = await post({ ncmCode: '95069100' });
    expect(known.status).toBe(502);
    expect((await known.json()).error).toMatch(/ComexStat respondeu HTTP 500/);

    clearComexStatCache();
    const spyErr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    current = (async () => {
      throw new Error('connect ECONNREFUSED 10.0.0.7:443 detalhe interno');
    }) as unknown as typeof fetch;
    const unknown = await post({ ncmCode: '95069100' });
    expect(unknown.status).toBe(502);
    const msg = (await unknown.json()).error as string;
    expect(msg).not.toMatch(/ECONNREFUSED|10\.0\.0\.7/);
    expect(msg).toMatch(/ComexStat/);
    expect(spyErr).toHaveBeenCalled();
    spyErr.mockRestore();
  });

  it('só POST /api/comex/stats/monthly é público entre as rotas stats', async () => {
    const stats = COMEX_PUBLIC_ROUTES.filter((r) => r.path.includes('/stats'));
    expect(stats).toEqual([{ method: 'POST', path: '/api/comex/stats/monthly' }]);
    const r = await fetch(`${baseUrl}/api/comex/stats/monthly`);
    expect(r.status).toBe(401);
    const other = await fetch(`${baseUrl}/api/comex/stats/outra`, { method: 'POST' });
    expect(other.status).toBe(401);
  });
});
