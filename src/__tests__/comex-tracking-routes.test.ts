import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { comexGateway, COMEX_PUBLIC_ROUTES } from '../core/comex/comexGuard';
import { getComexStore, resetComexStoreForTests } from '../core/comex/comexStore';
import { resetTrackingStateForTests } from '../core/comex/comexTracking';
import { registerComexTrackingRoutes, resetTrackingCheckRateLimit } from '../core/comex/registerComexTrackingRoutes';
import { registerPucomexRoutes } from '../core/comex/registerPucomexRoutes';

const ENV_KEYS = ['COMEX_OPERATOR_TOKEN', 'COMEX_DB_PATH', 'DATABASE_URL'] as const;
const saved: Record<string, string | undefined> = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

const CE = '131905000018565';
const fetchImpl = vi.fn(async () =>
  new Response(JSON.stringify([{ numero: CE, dataAtualizacao: '2026-11-17T14:20:00' }]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }),
) as unknown as typeof fetch;

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
  registerComexTrackingRoutes(app, { fetchImpl });
  ({ s: server, url: baseUrl } = await listen(app));

  const full = express();
  full.use(express.json());
  registerPucomexRoutes(full);
  ({ s: fullServer, url: fullUrl } = await listen(full));
});

beforeEach(() => {
  process.env.COMEX_OPERATOR_TOKEN = 't';
  process.env.COMEX_DB_PATH = ':memory:';
  delete process.env.DATABASE_URL;
  resetComexStoreForTests();
  resetTrackingCheckRateLimit();
  resetTrackingStateForTests();
});

afterAll(() => {
  server?.close();
  fullServer?.close();
  resetComexStoreForTests();
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const api = (method: string, p: string, body?: unknown, headers: Record<string, string> = { 'x-comex-token': 't' }) =>
  fetch(`${baseUrl}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function mkProcess() {
  const store = await getComexStore();
  return store.createProcess({ payload: { type: 'importacao', status: 'aguardando_di', ce_mercante_number: CE } });
}

describe('rotas /api/comex/tracking', () => {
  it('não são públicas: 401 sem token (também montadas pelo registerPucomexRoutes)', async () => {
    expect(COMEX_PUBLIC_ROUTES.some((r) => r.path.includes('tracking'))).toBe(false);
    for (const [m, p] of [
      ['GET', '/api/comex/tracking?process_id=x'],
      ['GET', '/api/comex/tracking/summary'],
      ['POST', '/api/comex/tracking/check'],
      ['POST', '/api/comex/tracking/x/seen'],
    ] as const) {
      expect((await api(m, p, m === 'POST' ? {} : undefined, {})).status).toBe(401);
      const r = await fetch(`${fullUrl}${p}`, { method: m, headers: { 'Content-Type': 'application/json' } });
      expect(r.status).toBe(401);
    }
    const ok = await fetch(`${fullUrl}/api/comex/tracking/summary`, { headers: { 'x-comex-token': 't' } });
    expect(ok.status).toBe(200);
  });

  it('lista as linhas do processo com situação', async () => {
    const p = await mkProcess();
    const j = await (await api('GET', `/api/comex/tracking?process_id=${p.id}`)).json();
    expect(j.success).toBe(true);
    expect(j.data).toHaveLength(1);
    expect(j.data[0]).toMatchObject({ doc_kind: 'ce', doc_number: CE, status: 'aguardando' });
    expect((await api('GET', '/api/comex/tracking')).status).toBe(400);
  });

  it('verificar agora: roda e devolve as linhas; 429 em pt-BR na segunda em menos de 5 min', async () => {
    const p = await mkProcess();
    const r1 = await api('POST', '/api/comex/tracking/check', { process_id: p.id });
    const j1 = await r1.json();
    expect(r1.status).toBe(200);
    expect(j1.data[0]).toMatchObject({ status: 'alterado', remote_updated_at: '2026-11-17T14:20:00' });
    const r2 = await api('POST', '/api/comex/tracking/check', { process_id: p.id });
    expect(r2.status).toBe(429);
    expect((await r2.json()).error).toMatch(/Aguarde/);
    // outro processo não é afetado
    const store = await getComexStore();
    const other = await store.createProcess({ payload: { status: 'aguardando_di', ce_mercante_number: '131905000018566' } });
    expect((await api('POST', '/api/comex/tracking/check', { process_id: other.id })).status).toBe(200);
  });

  it('summary conta alterados; seen limpa o alterado', async () => {
    const p = await mkProcess();
    await api('POST', '/api/comex/tracking/check', { process_id: p.id });
    let sum = (await (await api('GET', '/api/comex/tracking/summary')).json()).data;
    expect(sum[p.id].changed).toBe(1);
    expect(sum[p.id].changes[0]).toMatchObject({ doc_kind: 'ce', doc_number: CE });
    const rowId = (await (await api('GET', `/api/comex/tracking?process_id=${p.id}`)).json()).data[0].id;
    const seen = await api('POST', `/api/comex/tracking/${rowId}/seen`);
    expect(seen.status).toBe(200);
    expect((await seen.json()).data.status).toBe('sem_mudanca');
    sum = (await (await api('GET', '/api/comex/tracking/summary')).json()).data;
    expect(sum[p.id].changed).toBe(0);
    expect((await api('POST', '/api/comex/tracking/nao-existe/seen')).status).toBe(404);
  });
});
