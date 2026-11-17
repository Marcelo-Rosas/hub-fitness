import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PgComexStore, SqliteComexStore } from '../core/comex/comexStore';
import {
  LOCKED_ENUM_VALUES,
  lockedOptionsError,
  validateRecordAgainstDefs,
} from '../core/comex/comexRegistry';
import { DEFAULT_COMEX_FIELD_DEFS } from '../core/comex/fieldDefsSeed';
import type { ComexFieldDef } from '../types/comex';

const def = (over: Partial<ComexFieldDef>): ComexFieldDef => ({
  id: over.field_key || 'x',
  entity: 'client',
  field_key: 'x',
  label: 'X',
  data_type: 'text',
  required: false,
  enum_options: [],
  widget: 'text',
  ui_list: false,
  ui_form: true,
  consult_key: false,
  kpi: null,
  sort_order: 0,
  ui_group: null,
  ...over,
});

describe('validateRecordAgainstDefs', () => {
  const defs = [
    def({ field_key: 'legal_name', label: 'Razão social', required: true }),
    def({
      field_key: 'radar_status',
      label: 'Situação',
      data_type: 'enum',
      widget: 'select',
      enum_options: [
        { value: 'habilitada', label: 'Habilitada' },
        { value: 'suspensa', label: 'Suspensa' },
      ],
    }),
    def({
      field_key: 'rep_certificate',
      label: 'Certificado',
      data_type: 'text',
      widget: 'select',
      enum_options: [{ value: 'e-CPF Marcelo', label: 'e-CPF Marcelo' }],
    }),
    def({ field_key: 'broker_id', label: 'Despachante', widget: 'broker', required: true }),
  ];

  it('obrigatório ausente → mensagem com o rótulo', () => {
    expect(validateRecordAgainstDefs({ legal_name: '  ', broker_id: 'b' }, defs)).toMatch(/Razão social/);
    expect(validateRecordAgainstDefs({ legal_name: 'ACME', broker_id: 'b' }, defs)).toBeNull();
  });

  it('enum fechado recusa valor fora das opções e aceita vazio', () => {
    expect(validateRecordAgainstDefs({ legal_name: 'A', radar_status: 'xyz' }, defs)).toMatch(/Situação/);
    expect(validateRecordAgainstDefs({ legal_name: 'A', radar_status: 'suspensa' }, defs)).toBeNull();
    expect(validateRecordAgainstDefs({ legal_name: 'A', radar_status: null }, defs)).toBeNull();
  });

  it('lista aberta aceita valor novo', () => {
    expect(validateRecordAgainstDefs({ legal_name: 'A', rep_certificate: 'e-CNPJ Novo' }, defs)).toBeNull();
  });

  it('widget broker é ignorado (opções dinâmicas)', () => {
    expect(validateRecordAgainstDefs({ legal_name: 'A' }, defs)).toBeNull();
  });
});

describe('valores travados', () => {
  it('radar_modality e rep_status travados com os valores dos CHECKs', () => {
    expect(LOCKED_ENUM_VALUES.client.radar_modality).toEqual(['expressa', 'limitada_50k', 'limitada_150k', 'ilimitada']);
    expect(LOCKED_ENUM_VALUES.client.rep_status).toEqual(['pendente', 'ativa', 'vencida', 'revogada']);
  });

  it('lockedOptionsError: muda rótulo/ordem ok; muda valores → erro', () => {
    const opts = [...LOCKED_ENUM_VALUES.client.rep_status].reverse().map((v) => ({ value: v, label: v.toUpperCase() }));
    expect(lockedOptionsError({ entity: 'client', field_key: 'rep_status', data_type: 'enum', enum_options: opts })).toBeNull();
    expect(
      lockedOptionsError({
        entity: 'client',
        field_key: 'rep_status',
        data_type: 'enum',
        enum_options: [...opts, { value: 'nova', label: 'Nova' }],
      }),
    ).toMatch(/Radar/);
    expect(lockedOptionsError({ entity: 'client', field_key: 'notes', data_type: 'text', enum_options: [] })).toBeNull();
  });
});

describe('seed de cliente/despachante', () => {
  it('cobre as colunas editáveis com grupos', () => {
    const client = DEFAULT_COMEX_FIELD_DEFS.filter((d) => d.entity === 'client');
    expect(client.map((d) => d.field_key)).toEqual([
      'cnpj_root',
      'cnpj',
      'legal_name',
      'trade_name',
      'radar_status',
      'radar_modality',
      'radar_limit_usd',
      'radar_operations',
      'radar_legal_basis',
      'radar_checked_at',
      'rep_status',
      'rep_certificate',
      'rep_role_type',
      'rep_valid_from',
      'rep_valid_to',
      'broker_id',
      'notes',
    ]);
    expect(client.every((d) => ['Empresa', 'Radar', 'Representação', 'Despachante'].includes(String(d.ui_group)))).toBe(true);
    const modality = client.find((d) => d.field_key === 'radar_modality')!;
    expect(modality.enum_options?.map((o) => o.value)).toEqual(LOCKED_ENUM_VALUES.client.radar_modality);
    expect(client.find((d) => d.field_key === 'rep_role_type')?.enum_options?.[0]).toEqual({
      value: 'IMPEXP',
      label: 'IMPEXP — Declarante importador/exportador',
    });
    expect(client.find((d) => d.field_key === 'broker_id')?.widget).toBe('broker');
    const broker = DEFAULT_COMEX_FIELD_DEFS.filter((d) => d.entity === 'broker');
    expect(broker.map((d) => d.field_key)).toEqual(['name', 'cpf', 'rfb_registry', 'email', 'phone', 'active']);
    expect(broker.find((d) => d.field_key === 'active')?.data_type).toBe('boolean');
  });
});

describe('store de field_defs (cliente/despachante)', () => {
  it('repassa entity real e grava ui_group', async () => {
    const store = new SqliteComexStore(':memory:');
    await store.ensureReady();
    const client = await store.listFieldDefs('client');
    expect(client.length).toBe(17);
    expect(client.every((d) => d.entity === 'client')).toBe(true);
    expect(client.find((d) => d.field_key === 'radar_status')?.ui_group).toBe('Radar');
    const broker = await store.listFieldDefs('broker');
    expect(broker.every((d) => d.entity === 'broker')).toBe(true);
    const saved = await store.upsertFieldDef({
      entity: 'client',
      field_key: 'notes',
      label: 'Notas',
      data_type: 'text',
      ui_group: 'Outros',
    });
    expect(saved.ui_group).toBe('Outros');
    expect((await store.listFieldDefs('client')).find((d) => d.field_key === 'notes')?.ui_group).toBe('Outros');
  });

  it('seed não sobrescreve edição feita pelo painel', async () => {
    const store = new SqliteComexStore(':memory:');
    await store.ensureReady();
    const m = (await store.listFieldDefs('client')).find((d) => d.field_key === 'radar_modality')!;
    await store.upsertFieldDef({ ...m, label: 'Modalidade Radar', sort_order: 999 });
    const p = (await store.listFieldDefs('process')).find((d) => d.field_key === 'notes')!;
    await store.upsertFieldDef({ ...p, label: 'Observações do processo' });
    await store.ensureReady();
    const after = (await store.listFieldDefs('client')).find((d) => d.field_key === 'radar_modality')!;
    expect(after.label).toBe('Modalidade Radar');
    expect(after.sort_order).toBe(999);
    expect((await store.listFieldDefs('process')).find((d) => d.field_key === 'notes')?.label).toBe(
      'Observações do processo',
    );
  });

  it('SQLite antigo sem ui_group ganha a coluna', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'comex-uig-'));
    const file = path.join(dir, 'old.sqlite');
    const old = new DatabaseSync(file);
    old.exec(`
      CREATE TABLE comex_field_defs (
        id TEXT PRIMARY KEY, entity TEXT NOT NULL, field_key TEXT NOT NULL, label TEXT NOT NULL,
        data_type TEXT NOT NULL, required INTEGER NOT NULL DEFAULT 0, enum_options TEXT NOT NULL DEFAULT '[]',
        widget TEXT NOT NULL DEFAULT 'text', ui_list INTEGER NOT NULL DEFAULT 0, ui_form INTEGER NOT NULL DEFAULT 1,
        consult_key INTEGER NOT NULL DEFAULT 0, kpi TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, UNIQUE (entity, field_key)
      );
      INSERT INTO comex_field_defs (id, entity, field_key, label, data_type, created_at)
      VALUES ('f1', 'process', 'type', 'Tipo antigo', 'enum', '2026-01-01');
    `);
    old.close();
    const s = new SqliteComexStore(file);
    await s.ensureReady();
    const type = (await s.listFieldDefs('process')).find((d) => d.field_key === 'type')!;
    expect(type.label).toBe('Tipo antigo');
    expect(type.ui_group).toBeNull();
    expect((await s.listFieldDefs('client')).find((d) => d.field_key === 'legal_name')?.ui_group).toBe('Empresa');
    await s.ensureReady(); // idempotente
  });

  it('Pg ensureReady adiciona ui_group, troca o CHECK de entity e semeia sem sobrescrever', async () => {
    const store = new PgComexStore('postgres://fake');
    const seen: string[] = [];
    (store as unknown as { pool: unknown }).pool = {
      query: async (sql: string) => {
        seen.push(sql.replace(/\s+/g, ' '));
        return { rows: [] };
      },
    };
    await store.ensureReady();
    expect(seen.some((s) => s.includes('ADD COLUMN IF NOT EXISTS ui_group text'))).toBe(true);
    expect(seen.some((s) => s.includes('DROP CONSTRAINT IF EXISTS comex_field_defs_entity_check'))).toBe(true);
    expect(seen.some((s) => s.includes("CHECK (entity IN ('process','document','client','broker'))"))).toBe(true);
    const inserts = seen.filter((s) => s.startsWith('INSERT INTO comex_field_defs'));
    expect(inserts.length).toBe(DEFAULT_COMEX_FIELD_DEFS.length);
    expect(inserts.every((s) => s.includes('DO NOTHING'))).toBe(true);
  });
});
