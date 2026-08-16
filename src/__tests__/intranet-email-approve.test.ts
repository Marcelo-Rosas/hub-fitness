import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import {
  SqliteIntranetStore,
  resetIntranetStoreForTests,
  setIntranetStoreForTests,
} from '../core/intranet/intranetStore';
import { executeStepDecision, resubmit, submit } from '../core/intranet/approvalService';
import {
  APPROVAL_TOKEN_TTL_MS,
  generateRawToken,
  hashApprovalToken,
  lookupApprovalToken,
} from '../core/intranet/approvalTokens';
import { dispatchOutboxOnce } from '../core/intranet/outboxDispatcher';
import { registerApproveRoutes, resetApproveRateLimitForTests } from '../core/intranet/registerApproveRoutes';

function payloadOk(extra: Record<string, unknown> = {}) {
  return {
    item: 'Filme Stretch 500mm',
    volume: '150 un / mês',
    state: 'SC',
    payment: '30/60',
    unit_price: 41,
    freight_monthly: 200,
    landed_monthly: 6350,
    lead_time_days: 3,
    ...extra,
  };
}

function rawFromNotify(store: SqliteIntranetStore, index = 0): string {
  const notifies = store.listOutbox().filter((e) => e.event_type === 'ASSIGNMENT.NOTIFY');
  const url = String(notifies[index]!.payload.approveUrl || '');
  return url.split('/approve/')[1]!;
}

async function withApproveServer(
  store: SqliteIntranetStore,
  fn: (base: string) => Promise<void>,
): Promise<void> {
  setIntranetStoreForTests(store);
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  registerApproveRoutes(app);
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  const base = `http://127.0.0.1:${addr.port}`;
  try {
    await fn(base);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe('approvalTokens', () => {
  beforeEach(() => {
    resetIntranetStoreForTests();
    resetApproveRateLimitForTests();
  });

  it('mint stores hash only (raw never in DB)', async () => {
    const store = new SqliteIntranetStore(':memory:');
    const created = await submit(store, {
      requesterEmail: 'compras@hubfitness.com.br',
      title: 'RFQ',
      payload: payloadOk(),
      supplier_name: 'Ecopack',
      supplier_email: 'contato@ecopackmadeiras.com.br',
    });
    if ('error' in created) throw new Error(created.error);

    const tokens = store.listApprovalTokensForRequest(created.request.id);
    expect(tokens).toHaveLength(1);
    const raw = rawFromNotify(store);
    expect(tokens[0]!.token_hash).toBe(hashApprovalToken(raw));
    expect(tokens[0]!.token_hash).not.toBe(raw);
    expect(JSON.stringify(tokens[0])).not.toContain(raw);
  });

  it('TTL and one-shot via lookup helpers', async () => {
    const store = new SqliteIntranetStore(':memory:');
    const created = await submit(store, {
      requesterEmail: 'compras@hubfitness.com.br',
      title: 'RFQ',
      payload: payloadOk(),
      supplier_name: 'Ecopack',
      supplier_email: 'contato@ecopackmadeiras.com.br',
    });
    if ('error' in created) throw new Error(created.error);
    const raw = rawFromNotify(store);

    const past = new Date(Date.now() + APPROVAL_TOKEN_TTL_MS + 1000);
    expect(lookupApprovalToken(store, raw, past)).toEqual({ ok: false, reason: 'EXPIRED' });

    const ok = lookupApprovalToken(store, raw);
    expect(ok.ok).toBe(true);
    if (!ok.ok) throw new Error('expected ok');
    store.markApprovalTokenUsed(ok.token.id);
    expect(lookupApprovalToken(store, raw)).toEqual({ ok: false, reason: 'USED' });
  });

  it('opaque token is not JWT', () => {
    const raw = generateRawToken();
    expect(raw.split('.')).toHaveLength(1);
    expect(raw.length).toBeGreaterThanOrEqual(40);
  });

  it('expires_at ≈ now + 48h', async () => {
    const store = new SqliteIntranetStore(':memory:');
    const created = await submit(store, {
      requesterEmail: 'compras@hubfitness.com.br',
      title: 'RFQ',
      payload: payloadOk(),
      supplier_name: 'Ecopack',
      supplier_email: 'contato@ecopackmadeiras.com.br',
    });
    if ('error' in created) throw new Error(created.error);
    const tok = store.listApprovalTokensForRequest(created.request.id)[0]!;
    const createdAt = Date.parse(tok.created_at);
    const expires = Date.parse(tok.expires_at);
    expect(expires - createdAt).toBeGreaterThanOrEqual(APPROVAL_TOKEN_TTL_MS - 2000);
    expect(expires - createdAt).toBeLessThanOrEqual(APPROVAL_TOKEN_TTL_MS + 2000);
  });
});

describe('ASSIGNMENT.NOTIFY outbox', () => {
  beforeEach(() => {
    resetIntranetStoreForTests();
  });

  it('SUBMIT creates NOTIFY; dispatcher sends assignee mail', async () => {
    const store = new SqliteIntranetStore(':memory:');
    const created = await submit(store, {
      requesterEmail: 'compras@hubfitness.com.br',
      title: 'RFQ Stretch',
      payload: payloadOk(),
      supplier_name: 'Ecopack Madeiras',
      supplier_email: 'contato@ecopackmadeiras.com.br',
    });
    if ('error' in created) throw new Error(created.error);

    const notify = store.listOutbox().find((e) => e.event_type === 'ASSIGNMENT.NOTIFY');
    expect(notify?.status).toBe('PENDING');
    expect(String(notify?.payload.to)).toBe('cfo@hubfitness.com.br');
    expect(String(notify?.payload.approveUrl)).toContain('/approve/');

    const sendAssignee = vi.fn(async () => ({ ok: true, mode: 'simulated' as const }));
    const sendSupplier = vi.fn(async () => ({ ok: true, mode: 'simulated' as const }));
    await dispatchOutboxOnce(store, sendSupplier, sendAssignee);
    expect(sendAssignee).toHaveBeenCalledTimes(1);
    expect(sendSupplier).not.toHaveBeenCalled();
    expect(store.listOutbox()[0]!.status).toBe('PROCESSED');
  });

  it('RESUBMIT invalidates old token and mints new NOTIFY', async () => {
    const store = new SqliteIntranetStore(':memory:');
    const created = await submit(store, {
      requesterEmail: 'compras@hubfitness.com.br',
      title: 'RFQ',
      payload: payloadOk(),
      supplier_name: 'Ecopack',
      supplier_email: 'contato@ecopackmadeiras.com.br',
    });
    if ('error' in created) throw new Error(created.error);

    const rejected = await executeStepDecision(store, {
      requestId: created.request.id,
      actorEmail: 'cfo@hubfitness.com.br',
      action: 'REQUEST_CHANGES',
      reason: 'ajustar volume',
      expectedVersion: created.request.version,
    });
    if ('error' in rejected) throw new Error(rejected.error);

    const again = await resubmit(store, {
      requestId: created.request.id,
      actorEmail: 'compras@hubfitness.com.br',
      expectedVersion: rejected.request.version,
    });
    if ('error' in again) throw new Error(again.error);

    const tokens = store.listApprovalTokensForRequest(created.request.id);
    expect(tokens).toHaveLength(2);
    expect(tokens[0]!.used_at).toBeTruthy();
    expect(tokens[1]!.used_at).toBeNull();
    const notifies = store.listOutbox().filter((e) => e.event_type === 'ASSIGNMENT.NOTIFY');
    expect(notifies.length).toBeGreaterThanOrEqual(2);
  });
});

describe('email approve HTTP path', () => {
  beforeEach(() => {
    resetIntranetStoreForTests();
    resetApproveRateLimitForTests();
  });

  afterEach(() => {
    resetIntranetStoreForTests();
  });

  it('POST APPROVE via token marks used; PRECO_INCOMPLETO still applies', async () => {
    const store = new SqliteIntranetStore(':memory:');
    const incomplete = await submit(store, {
      requesterEmail: 'compras@hubfitness.com.br',
      title: 'RFQ',
      payload: {
        item: 'X',
        volume: '1 un / mês',
        unit_price: null,
        landed_monthly: null,
      },
      supplier_name: 'Ecopack',
      supplier_email: 'contato@ecopackmadeiras.com.br',
    });
    if ('error' in incomplete) throw new Error(incomplete.error);
    const rawIncomplete = rawFromNotify(store, 0);

    await withApproveServer(store, async (base) => {
      const blocked = await fetch(`${base}/approve/${rawIncomplete}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'APPROVE',
          expectedVersion: String(incomplete.request.version),
          reason: '',
        }),
      });
      expect(blocked.status).toBe(400);
      const blockedText = await blocked.text();
      expect(blockedText).toMatch(/Preço incompleto|preço unitário|landed/i);
      expect(store.getRequest(incomplete.request.id)?.status).toBe('IN_REVIEW');
      expect(store.listApprovalTokensForRequest(incomplete.request.id)[0]!.used_at).toBeNull();

      const ok = await submit(store, {
        requesterEmail: 'compras@hubfitness.com.br',
        title: 'RFQ OK',
        payload: payloadOk(),
        supplier_name: 'Ecopack',
        supplier_email: 'contato@ecopackmadeiras.com.br',
      });
      if ('error' in ok) throw new Error(ok.error);
      const rawOk = rawFromNotify(store, 1);

      const approved = await fetch(`${base}/approve/${rawOk}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'APPROVE',
          expectedVersion: String(ok.request.version),
          reason: '',
        }),
      });
      expect(approved.status).toBe(200);
      expect(await approved.text()).toMatch(/aprovada/i);
      expect(store.getRequest(ok.request.id)?.status).toBe('APPROVED');
      expect(store.listApprovalTokensForRequest(ok.request.id)[0]!.used_at).toBeTruthy();

      const reuse = await fetch(`${base}/approve/${rawOk}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'APPROVE',
          expectedVersion: String(ok.request.version + 1),
          reason: '',
        }),
      });
      expect(reuse.status).toBe(409);
    });
  });

  it('GET HTML shows brief + three actions; volume gap absent with flag off', async () => {
    const store = new SqliteIntranetStore(':memory:');
    const created = await submit(store, {
      requesterEmail: 'compras@hubfitness.com.br',
      title: 'RFQ',
      payload: payloadOk({ volume: '1 un / mês' }),
      supplier_name: 'Ecopack',
      supplier_email: 'contato@ecopackmadeiras.com.br',
    });
    if ('error' in created) throw new Error(created.error);
    const raw = rawFromNotify(store);

    await withApproveServer(store, async (base) => {
      const res = await fetch(`${base}/approve/${raw}`);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('Aprovar');
      expect(text).toContain('Pedir correção');
      expect(text).toContain('Rejeitar');
      expect(text).toContain('Preço unitário');
      expect(text).not.toMatch(/volume operacional/i);
    });
  });
});
