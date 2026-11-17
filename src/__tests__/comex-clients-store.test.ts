import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteComexStore, PgComexStore, createComexStore } from '../core/comex/comexStore';
import { normalizeClientInput, defaultRadarLimit, slugify, isValidYmd, todayYmd, declarationRouteNote } from '../core/comex/comexRegistry';
import type { ComexClientInput } from '../types/comex';

describe('comexRegistry', () => {
  it('normaliza CNPJ com máscara', () => {
    const n = normalizeClientInput({
      cnpj_root: '60.450.605',
      cnpj: '60.450.605/0001-00',
      legal_name: 'RM ACADEMIA LTDA',
      radar_modality: 'limitada_50k',
    } as ComexClientInput);
    expect(n.cnpj_root).toBe('60450605');
    expect(n.cnpj).toBe('60450605000100');
    expect(n.radar_limit_usd).toBe(50000);
  });

  it('recusa raiz ≠ 8 dígitos e CNPJ completo ≠ 14 ou com raiz diferente', () => {
    expect(() => normalizeClientInput({ cnpj_root: '1234567', legal_name: 'X' } as ComexClientInput)).toThrow(/CNPJ/);
    expect(() =>
      normalizeClientInput({ cnpj_root: '60450605', cnpj: '6045060500010', legal_name: 'X' } as ComexClientInput),
    ).toThrow(/CNPJ/);
    expect(() =>
      normalizeClientInput({ cnpj_root: '60450605', cnpj: '11222333000181', legal_name: 'X' } as ComexClientInput),
    ).toThrow(/CNPJ/);
  });

  it('limite padrão por modalidade e slug', () => {
    expect(defaultRadarLimit('limitada_50k')).toBe(50000);
    expect(defaultRadarLimit('limitada_150k')).toBe(150000);
    expect(defaultRadarLimit('expressa')).toBeNull();
    expect(defaultRadarLimit('ilimitada')).toBeNull();
    expect(defaultRadarLimit(null)).toBeNull();
    expect(slugify('RM Academia Ltda.')).toBe('rm-academia-ltda');
    expect(slugify('Ação & Cia')).toBe('acao-cia');
  });

  it('aviso de DI só para Radar Limitado', () => {
    expect(declarationRouteNote('limitada_50k')).toMatch(/segue por DI/);
    expect(declarationRouteNote('limitada_150k')).toMatch(/segue por DI/);
    expect(declarationRouteNote('ilimitada')).toBeNull();
    expect(declarationRouteNote('expressa')).toBeNull();
    expect(declarationRouteNote(null)).toBeNull();
  });

  it('valida datas AAAA-MM-DD do cadastro', () => {
    const base = { cnpj_root: '60450605', legal_name: 'X' };
    const ok = normalizeClientInput({
      ...base,
      radar_checked_at: '2026-11-16',
      rep_valid_from: ' 2026-01-01 ',
      rep_valid_to: '',
    } as ComexClientInput);
    expect(ok.radar_checked_at).toBe('2026-11-16');
    expect(ok.rep_valid_from).toBe('2026-01-01');
    expect(ok.rep_valid_to).toBeNull();
    expect(() => normalizeClientInput({ ...base, radar_checked_at: '16/11/2026' } as ComexClientInput)).toThrow(
      /Data de conferência do Radar inválida/,
    );
    expect(() => normalizeClientInput({ ...base, rep_valid_from: '2026-02-30' } as ComexClientInput)).toThrow(
      /Início da representação inválido/,
    );
    expect(() => normalizeClientInput({ ...base, rep_valid_to: 'abc' } as ComexClientInput)).toThrow(
      /Fim da representação inválido/,
    );
  });

  it('isValidYmd aceita só datas reais', () => {
    expect(isValidYmd('2024-02-29')).toBe(true);
    expect(isValidYmd('2026-02-29')).toBe(false);
    expect(isValidYmd('2026-13-01')).toBe(false);
    expect(isValidYmd('2026-1-01')).toBe(false);
  });

  it('todayYmd usa o fuso de Brasília (America/Sao_Paulo)', () => {
    // 2026-11-17 01:30 UTC = 2026-11-16 22:30 em Brasília
    expect(todayYmd(new Date('2026-11-17T01:30:00Z'))).toBe('2026-11-16');
    // 2026-11-17 03:00 UTC = 2026-11-17 00:00 em Brasília
    expect(todayYmd(new Date('2026-11-17T03:00:00Z'))).toBe('2026-11-17');
  });
});

describe('Comex store — clientes e despachantes', () => {
  let store: SqliteComexStore;
  beforeEach(async () => {
    store = new SqliteComexStore(':memory:');
    await store.ensureReady();
  });

  it('CRUD cliente + processo ligado + delete recusado', async () => {
    const c = await store.upsertClient({
      cnpj_root: '60450605',
      legal_name: 'RM ACADEMIA LTDA',
      radar_modality: 'limitada_50k',
    } as ComexClientInput);
    expect(c.slug).toBe('rm-academia-ltda');
    expect(c.rep_status).toBe('pendente');
    expect(c.radar_limit_usd).toBe(50000);
    const p = await store.createProcess({ cliente_id: c.id, payload: { type: 'importacao' } });
    expect(p.cliente_id).toBe(c.id);
    expect(p.client_slug).toBe('rm-academia-ltda');
    expect(p.payload.client_name).toBe('RM ACADEMIA LTDA');
    expect(await store.deleteClient(c.id)).toBe('has_processes');
    expect(await store.deleteClient('nao-existe')).toBe('not_found');
    expect((await store.listClients()).length).toBe(1);
    expect((await store.getClient(c.id))?.legal_name).toBe('RM ACADEMIA LTDA');
  });

  it('slug duplicado ganha sufixo e cliente sem processo é excluído', async () => {
    const a = await store.upsertClient({ cnpj_root: '11111111', legal_name: 'Alfa Fit' } as ComexClientInput);
    const b = await store.upsertClient({ cnpj_root: '22222222', legal_name: 'Alfa Fit' } as ComexClientInput);
    const c = await store.upsertClient({ cnpj_root: '33333333', legal_name: 'Alfa Fit' } as ComexClientInput);
    expect([a.slug, b.slug, c.slug]).toEqual(['alfa-fit', 'alfa-fit-2', 'alfa-fit-3']);
    expect(await store.deleteClient(c.id)).toBe('ok');
  });

  it('upsert com id atualiza sem trocar o slug; cnpj_root duplicado é recusado', async () => {
    const a = await store.upsertClient({ cnpj_root: '11111111', legal_name: 'Alfa Fit' } as ComexClientInput);
    const a2 = await store.upsertClient({ id: a.id, cnpj_root: '11111111', legal_name: 'Alfa Fit Brasil' } as ComexClientInput);
    expect(a2.id).toBe(a.id);
    expect(a2.slug).toBe('alfa-fit');
    expect(a2.legal_name).toBe('Alfa Fit Brasil');
    await expect(
      store.upsertClient({ cnpj_root: '11111111', legal_name: 'Outra' } as ComexClientInput),
    ).rejects.toThrow(/CNPJ/);
  });

  it('cliente_id desconhecido lança erro em pt-BR; update copia slug e nome', async () => {
    await expect(store.createProcess({ cliente_id: 'zzz' })).rejects.toThrow(/Cliente/);
    const legacy = await store.createProcess({ payload: { type: 'importacao' } });
    expect(legacy.cliente_id).toBeNull();
    const c = await store.upsertClient({ cnpj_root: '11111111', legal_name: 'Alfa Fit' } as ComexClientInput);
    const up = await store.updateProcess(legacy.id, { cliente_id: c.id });
    expect(up?.cliente_id).toBe(c.id);
    expect(up?.client_slug).toBe('alfa-fit');
    expect(up?.payload.client_name).toBe('Alfa Fit');
    await expect(store.updateProcess(legacy.id, { cliente_id: 'zzz' })).rejects.toThrow(/Cliente/);
  });

  it('broker em uso não é excluído', async () => {
    const b = await store.upsertBroker({ name: 'Despachante Silva' });
    expect(b.certificate_status).toBe('pendente');
    expect(b.active).toBe(true);
    const c = await store.upsertClient({
      cnpj_root: '11111111',
      legal_name: 'Alfa Fit',
      broker_id: b.id,
    } as ComexClientInput);
    expect(c.broker_id).toBe(b.id);
    expect(await store.deleteBroker(b.id)).toBe('in_use');
    expect(await store.deleteBroker('x')).toBe('not_found');
    await store.deleteClient(c.id);
    expect(await store.deleteBroker(b.id)).toBe('ok');
    expect((await store.listBrokers()).length).toBe(0);
  });

  it('SQLite antigo sem cliente_id ganha a coluna sem perder processos', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'comex-old-'));
    const file = path.join(dir, 'old.sqlite');
    const old = new DatabaseSync(file);
    old.exec(`
      CREATE TABLE comex_processes (
        id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, client_slug TEXT,
        payload TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO comex_processes (id, code, client_slug, payload, created_at, updated_at)
      VALUES ('p1', 'COMEX-2026-001', NULL, '{"type":"importacao"}', '2026-01-01', '2026-01-01');
    `);
    old.close();
    const s = new SqliteComexStore(file);
    await s.ensureReady();
    const list = await s.listProcesses();
    expect(list).toHaveLength(1);
    expect(list[0].cliente_id).toBeNull();
    await s.ensureReady(); // idempotente
  });

  it('seed traz eta_date, duimp_registered_at, cif_value_usd e client_name fora do form', async () => {
    const defs = await store.listFieldDefs('process');
    expect(defs.find((d) => d.field_key === 'eta_date')?.data_type).toBe('date');
    expect(defs.find((d) => d.field_key === 'duimp_registered_at')?.data_type).toBe('date');
    const cifUsd = defs.find((d) => d.field_key === 'cif_value_usd');
    expect(cifUsd?.data_type).toBe('number');
    expect(cifUsd?.kpi).toBeNull();
    expect(defs.find((d) => d.field_key === 'client_name')?.ui_form).toBe(false);
  });
});

describe('PgComexStore.ensureReady — sondagem da migration nova', () => {
  const probes = ['SELECT cliente_id FROM comex_processes', 'SELECT 1 FROM comex_clients', 'SELECT 1 FROM comex_brokers'];

  for (const probe of probes) {
    it(`falha quando "${probe}" é rejeitada`, async () => {
      const store = new PgComexStore('postgres://fake');
      const seen: string[] = [];
      (store as unknown as { pool: unknown }).pool = {
        query: async (sql: string) => {
          seen.push(sql);
          if (sql.startsWith(probe)) throw new Error('relation/column does not exist');
          return { rows: [] };
        },
      };
      await expect(store.ensureReady()).rejects.toThrow(/does not exist/);
      expect(seen.some((s) => s.startsWith(probe))).toBe(true);
    });
  }

  it('createComexStore cai para sqlite quando a migration não foi aplicada', async () => {
    const prev = { url: process.env.DATABASE_URL, db: process.env.COMEX_DB_PATH };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'comex-fb-'));
    process.env.DATABASE_URL = 'postgres://fake';
    process.env.COMEX_DB_PATH = path.join(dir, 'fb.sqlite');
    const spy = vi.spyOn(PgComexStore.prototype, 'ensureReady').mockRejectedValue(new Error('column "cliente_id" does not exist'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const s = await createComexStore();
      expect(s.driver).toBe('sqlite');
      expect(warn.mock.calls[0][0]).toContain('20261116120000_comex_clients_brokers.sql');
    } finally {
      spy.mockRestore();
      warn.mockRestore();
      if (prev.url === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = prev.url;
      if (prev.db === undefined) delete process.env.COMEX_DB_PATH; else process.env.COMEX_DB_PATH = prev.db;
    }
  });
});

describe('diagnóstico do store', () => {
  it('redactDbError tira URL e senha', async () => {
    const { redactDbError } = await import('../core/comex/comexStore');
    const msg = redactDbError(
      'connect failed postgresql://hub_app:npg_ABC123@host/hub?sslmode=require password=xyz npg_Zz9',
    );
    expect(msg).not.toMatch(/npg_ABC123|npg_Zz9|xyz|hub_app:/);
    expect(msg).toContain('postgresql://***');
  });

  it('DATABASE_URL mal formatado vira motivo legível e cai no sqlite', async () => {
    const mod = await import('../core/comex/comexStore');
    const prev = { url: process.env.DATABASE_URL, path: process.env.COMEX_DB_PATH };
    process.env.DATABASE_URL = "psql 'postgresql://u:npg_x@h/db'";
    process.env.COMEX_DB_PATH = ':memory:';
    try {
      const store = await mod.createComexStore();
      expect(store.driver).toBe('sqlite');
      expect(mod.getStoreFallbackReason()).toMatch(/não começa com postgresql/);
    } finally {
      if (prev.url === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = prev.url;
      if (prev.path === undefined) delete process.env.COMEX_DB_PATH; else process.env.COMEX_DB_PATH = prev.path;
    }
  });
});
