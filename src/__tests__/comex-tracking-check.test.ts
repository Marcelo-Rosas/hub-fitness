import { afterEach, describe, expect, it, vi } from 'vitest';
import { SqliteComexStore } from '../core/comex/comexStore';
import {
  isInTrackingWindow,
  nextTrackingCheckAt,
  runTrackingCheck,
  startTrackingScheduler,
  summarizeTracking,
  trackingStatus,
} from '../core/comex/comexTracking';
import { INTEGRA_ENDPOINTS } from '../core/comex/integraComexPublic';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type Answers = Partial<Record<'ce' | 'di' | 'li' | 'duimp', Record<string, string> | 'erro'>>;

/** fetch falso do Integra Comex: responde por tipo a partir de um mapa número → data. */
function fakeIntegra(answers: Answers) {
  const urls: string[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    const kind = (Object.keys(INTEGRA_ENDPOINTS) as Array<keyof typeof INTEGRA_ENDPOINTS>).find((k) =>
      url.startsWith(INTEGRA_ENDPOINTS[k].url),
    )!;
    const a = answers[kind];
    if (a === 'erro') return new Response('fora', { status: 502 });
    const asked = new URL(url).searchParams.getAll(INTEGRA_ENDPOINTS[kind].param);
    const found = asked.filter((n) => a?.[n]);
    if (kind === 'duimp') {
      const multiStatus = found.map((n) => ({ numero: n, dataAtualizacao: a![n], versaoVigente: 2, code: 200 }));
      return jsonResponse({ code: found.length ? 200 : 404, multiStatus }, found.length ? 200 : 404);
    }
    if (kind === 'li' && !found.length) return jsonResponse({ code: 'SILI-4004' }, 404);
    return jsonResponse(found.map((n) => ({ numero: n, dataAtualizacao: a![n] })));
  });
  return { impl: impl as unknown as typeof fetch, mock: impl, urls };
}

const CE = '131905000018565';
const DI = '2512345678';
const LI = '2598765432';
const DUIMP = '25BR00000123456';

async function setup(payload: Record<string, unknown> = {}) {
  const store = new SqliteComexStore(':memory:');
  await store.ensureReady();
  const proc = await store.createProcess({
    payload: {
      type: 'importacao',
      status: 'aguardando_di',
      ce_mercante_number: CE,
      di_number: DI,
      li_numbers: LI,
      declaration_number: DUIMP,
      ...payload,
    },
  });
  const byKind = async () => Object.fromEntries((await store.listTracking(proc.id)).map((r) => [r.doc_kind, r]));
  return { store, proc, byKind };
}

const at = (iso: string) => () => new Date(iso);

describe('runTrackingCheck', () => {
  it('primeira aparição: grava a data; só CE e DUIMP marcam mudança', async () => {
    const { store, byKind } = await setup();
    const f = fakeIntegra({
      ce: { [CE]: '2026-11-12T09:02:00' },
      di: { [DI]: '2026-11-13T10:00:00' },
      li: { [LI]: '2026-11-14T11:00:00' },
      duimp: { [DUIMP]: '2026-11-16T10:11:00' },
    });
    const r = await runTrackingCheck({ store, fetchImpl: f.impl, now: at('2026-11-17T17:20:00.000Z') });
    expect(r.ran).toBe(true);
    expect(f.mock).toHaveBeenCalledTimes(4); // uma chamada por tipo
    const rows = await byKind();
    for (const k of ['ce', 'di', 'li', 'duimp']) {
      expect(rows[k].found).toBe(true);
      expect(rows[k].checked_at).toBe('2026-11-17T17:20:00.000Z');
      expect(rows[k].previous_remote_updated_at).toBeNull();
    }
    expect(rows.ce.remote_updated_at).toBe('2026-11-12T09:02:00');
    expect(rows.ce.changed_at).toBe('2026-11-17T17:20:00.000Z');
    expect(rows.duimp.changed_at).toBe('2026-11-17T17:20:00.000Z');
    expect(rows.duimp.version).toBe(2);
    expect(rows.di.changed_at).toBeNull();
    expect(rows.li.changed_at).toBeNull();
    expect(r.changed).toBe(2);
  });

  it('mudança de data: guarda a anterior e marca changed_at; sem mudança só atualiza checked_at', async () => {
    const { store, byKind } = await setup();
    await runTrackingCheck({
      store,
      fetchImpl: fakeIntegra({ di: { [DI]: '2026-11-13T10:00:00' }, li: { [LI]: '2026-11-14T11:00:00' } }).impl,
      now: at('2026-11-17T12:00:00.000Z'),
    });
    await runTrackingCheck({
      store,
      fetchImpl: fakeIntegra({ di: { [DI]: '2026-11-17T09:30:00' }, li: { [LI]: '2026-11-14T11:00:00' } }).impl,
      now: at('2026-11-17T13:00:00.000Z'),
    });
    const rows = await byKind();
    expect(rows.di.remote_updated_at).toBe('2026-11-17T09:30:00');
    expect(rows.di.previous_remote_updated_at).toBe('2026-11-13T10:00:00');
    expect(rows.di.changed_at).toBe('2026-11-17T13:00:00.000Z');
    expect(rows.li.changed_at).toBeNull();
    expect(rows.li.checked_at).toBe('2026-11-17T13:00:00.000Z');
    expect(rows.li.previous_remote_updated_at).toBeNull();
  });

  it('não encontrado há mais de 7 dias vira aviso', async () => {
    const { store, byKind } = await setup();
    const created = new Date((await byKind()).ce.created_at).getTime();
    await runTrackingCheck({ store, fetchImpl: fakeIntegra({}).impl, now: () => new Date(created + 3600_000) });
    let rows = await byKind();
    expect(rows.ce.found).toBe(false);
    expect(rows.ce.checked_at).not.toBeNull();
    expect(rows.ce.last_error).toBeNull();
    expect(trackingStatus(rows.ce, new Date(created + 3600_000))).toBe('aguardando');
    const eightDays = new Date(created + 8 * 24 * 3600_000);
    expect(trackingStatus(rows.ce, eightDays)).toBe('nao_encontrado');
    rows = await byKind();
    const sum = summarizeTracking(Object.values(rows), eightDays);
    expect(Object.values(sum)[0].notFound).toBe(4);
  });

  it('5xx grava last_error naquele tipo e segue com os outros', async () => {
    const { store, byKind } = await setup();
    const r = await runTrackingCheck({
      store,
      fetchImpl: fakeIntegra({ ce: 'erro', di: { [DI]: '2026-11-13T10:00:00' } }).impl,
      now: at('2026-11-17T12:00:00.000Z'),
    });
    expect(r.errors).toHaveLength(1);
    const rows = await byKind();
    expect(rows.ce.last_error).toMatch(/HTTP 502/);
    expect(trackingStatus(rows.ce, new Date('2026-11-17T12:00:00.000Z'))).toBe('erro');
    expect(rows.di.found).toBe(true);
    expect(rows.di.last_error).toBeNull();
  });

  it('processo desembaraçado ou cancelado é ignorado', async () => {
    const { store } = await setup({ status: 'desembaracado' });
    await store.createProcess({ payload: { status: 'cancelado', ce_mercante_number: '131905000018566' } });
    const f = fakeIntegra({});
    const r = await runTrackingCheck({ store, fetchImpl: f.impl, now: at('2026-11-17T12:00:00.000Z') });
    expect(f.mock).not.toHaveBeenCalled();
    expect(r.checked).toBe(0);
  });

  it('processId limita a um processo', async () => {
    const { store, proc } = await setup();
    await store.createProcess({ payload: { status: 'aguardando_di', ce_mercante_number: '131905000018566' } });
    const f = fakeIntegra({});
    const r = await runTrackingCheck({ store, fetchImpl: f.impl, processId: proc.id, now: at('2026-11-17T12:00:00.000Z') });
    expect(r.checked).toBe(4);
    expect(f.urls.find((u) => u.startsWith(INTEGRA_ENDPOINTS.ce.url))).toContain(`nr=${CE}`);
    expect(f.urls.join(' ')).not.toContain('131905000018566');
  });

  it('trava de concorrência: segunda rodada simultânea não roda', async () => {
    const { store } = await setup();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow = vi.fn(async () => {
      await gate;
      return jsonResponse([]);
    }) as unknown as typeof fetch;
    const first = runTrackingCheck({ store, fetchImpl: slow, now: at('2026-11-17T12:00:00.000Z') });
    const second = await runTrackingCheck({ store, fetchImpl: slow, now: at('2026-11-17T12:00:00.000Z') });
    expect(second.ran).toBe(false);
    expect(second.reason).toBe('em_andamento');
    release();
    expect((await first).ran).toBe(true);
    // liberou a trava
    expect((await runTrackingCheck({ store, fetchImpl: fakeIntegra({}).impl })).ran).toBe(true);
  });
});

describe('janela de horário (America/Sao_Paulo, seg–sex 7h–20h)', () => {
  it('respeita dia útil e horário de Brasília', () => {
    // 2026-11-17 é terça. 10:00Z = 07:00 em Brasília (UTC-3).
    expect(isInTrackingWindow(new Date('2026-11-17T10:00:00Z'))).toBe(true);
    expect(isInTrackingWindow(new Date('2026-11-17T09:59:00Z'))).toBe(false); // 06:59
    expect(isInTrackingWindow(new Date('2026-11-17T22:59:00Z'))).toBe(true); // 19:59
    expect(isInTrackingWindow(new Date('2026-11-17T23:00:00Z'))).toBe(false); // 20:00
    expect(isInTrackingWindow(new Date('2026-11-21T15:00:00Z'))).toBe(false); // sábado
    expect(isInTrackingWindow(new Date('2026-11-22T15:00:00Z'))).toBe(false); // domingo
  });

  it('próxima verificação pula para a próxima janela', () => {
    const next = nextTrackingCheckAt(new Date('2026-11-17T22:50:00Z'), 30 * 60_000); // 19:50 terça
    expect(next.toISOString()).toBe('2026-11-18T10:00:00.000Z'); // quarta 07:00
    const sameDay = nextTrackingCheckAt(new Date('2026-11-17T15:00:00Z'), 30 * 60_000);
    expect(sameDay.toISOString()).toBe('2026-11-17T15:30:00.000Z');
  });
});

describe('startTrackingScheduler', () => {
  const saved = process.env.COMEX_TRACKING_DISABLED;
  afterEach(() => {
    vi.useRealTimers();
    if (saved === undefined) delete process.env.COMEX_TRACKING_DISABLED;
    else process.env.COMEX_TRACKING_DISABLED = saved;
  });

  it('nunca roda em testes nem com COMEX_TRACKING_DISABLED=1', () => {
    const getStore = vi.fn();
    expect(startTrackingScheduler({ getStore })).toBeNull();
    process.env.COMEX_TRACKING_DISABLED = '1';
    expect(startTrackingScheduler({ getStore, allowInTests: true })).toBeNull();
    expect(getStore).not.toHaveBeenCalled();
  });

  it('fora da janela não consulta; dentro da janela roda', async () => {
    delete process.env.COMEX_TRACKING_DISABLED;
    vi.useFakeTimers();
    const { store } = await setup();
    const f = fakeIntegra({});
    let now = new Date('2026-11-21T15:00:00Z'); // sábado
    const stop = startTrackingScheduler({
      getStore: async () => store,
      fetchImpl: f.impl,
      intervalMs: 1000,
      now: () => now,
      allowInTests: true,
    })!;
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.mock).not.toHaveBeenCalled();
    now = new Date('2026-11-17T15:00:00Z'); // terça 12:00
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.mock).toHaveBeenCalled();
    stop();
  });
});
