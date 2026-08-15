import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type {
  ComexDocumentRecord,
  ComexFieldDef,
  ComexFieldDefInput,
  ComexProcessRecord,
} from '../../types/comex';
import { DEFAULT_COMEX_FIELD_DEFS } from './fieldDefsSeed';

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS comex_field_defs (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  data_type TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 0,
  enum_options TEXT NOT NULL DEFAULT '[]',
  widget TEXT NOT NULL DEFAULT 'text',
  ui_list INTEGER NOT NULL DEFAULT 0,
  ui_form INTEGER NOT NULL DEFAULT 1,
  consult_key INTEGER NOT NULL DEFAULT 0,
  kpi TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (entity, field_key)
);
CREATE TABLE IF NOT EXISTS comex_processes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  client_slug TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS comex_documents (
  id TEXT PRIMARY KEY,
  process_id TEXT,
  doc_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  size_bytes INTEGER,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (process_id) REFERENCES comex_processes(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS comex_documents_process_idx ON comex_documents (process_id);
`;

export interface ComexStore {
  driver: 'sqlite' | 'postgres';
  ensureReady(): Promise<void>;
  listFieldDefs(entity?: string): Promise<ComexFieldDef[]>;
  upsertFieldDef(input: ComexFieldDefInput & { id?: string }): Promise<ComexFieldDef>;
  deleteFieldDef(id: string): Promise<boolean>;
  listProcesses(): Promise<ComexProcessRecord[]>;
  getProcess(id: string): Promise<ComexProcessRecord | null>;
  createProcess(input: {
    code?: string;
    client_slug?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<ComexProcessRecord>;
  updateProcess(
    id: string,
    patch: { code?: string; client_slug?: string | null; payload?: Record<string, unknown> },
  ): Promise<ComexProcessRecord | null>;
  deleteProcess(id: string): Promise<boolean>;
  listDocuments(processId?: string | null): Promise<ComexDocumentRecord[]>;
  getDocument(id: string): Promise<ComexDocumentRecord | null>;
  upsertDocument(input: {
    id?: string;
    process_id?: string | null;
    doc_type: string;
    file_name: string;
    file_path: string;
    size_bytes?: number | null;
    meta?: Record<string, unknown>;
  }): Promise<ComexDocumentRecord>;
  linkDocument(id: string, processId: string | null): Promise<ComexDocumentRecord | null>;
  deleteDocument(id: string): Promise<boolean>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw && typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string' || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function asBool(v: unknown): boolean {
  return v === true || v === 1 || v === '1';
}

function hydrateField(row: Record<string, unknown>): ComexFieldDef {
  return {
    id: String(row.id),
    entity: row.entity === 'document' ? 'document' : 'process',
    field_key: String(row.field_key),
    label: String(row.label),
    data_type: (row.data_type as ComexFieldDef['data_type']) || 'text',
    required: asBool(row.required),
    enum_options: parseJson(row.enum_options, []),
    widget: (row.widget as ComexFieldDef['widget']) || 'text',
    ui_list: asBool(row.ui_list),
    ui_form: row.ui_form === undefined ? true : asBool(row.ui_form),
    consult_key: asBool(row.consult_key),
    kpi: row.kpi ? String(row.kpi) : null,
    sort_order: Number(row.sort_order || 0),
  };
}

function hydrateProcess(row: Record<string, unknown>, docs: ComexDocumentRecord[] = []): ComexProcessRecord {
  return {
    id: String(row.id),
    code: String(row.code),
    client_slug: row.client_slug ? String(row.client_slug) : null,
    payload: parseJson(row.payload, {}),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    documents: docs,
  };
}

function hydrateDocument(row: Record<string, unknown>): ComexDocumentRecord {
  return {
    id: String(row.id),
    process_id: row.process_id ? String(row.process_id) : null,
    doc_type: String(row.doc_type),
    file_name: String(row.file_name),
    file_path: String(row.file_path),
    size_bytes: row.size_bytes == null ? null : Number(row.size_bytes),
    meta: parseJson(row.meta, {}),
    created_at: String(row.created_at),
  };
}

function nextProcessCode(existing: { code: string }[]): string {
  const year = new Date().getFullYear();
  const prefix = `COMEX-${year}-`;
  let max = 0;
  for (const row of existing) {
    if (!row.code.startsWith(prefix)) continue;
    const n = Number(row.code.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export class SqliteComexStore implements ComexStore {
  driver = 'sqlite' as const;
  private db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');
  }

  async ensureReady(): Promise<void> {
    this.db.exec(SQLITE_SCHEMA);
    for (const def of DEFAULT_COMEX_FIELD_DEFS) {
      await this.upsertFieldDef(def);
    }
  }

  async listFieldDefs(entity?: string): Promise<ComexFieldDef[]> {
    const rows = entity
      ? (this.db
          .prepare('SELECT * FROM comex_field_defs WHERE entity = ? ORDER BY sort_order, field_key')
          .all(entity) as Record<string, unknown>[])
      : (this.db
          .prepare('SELECT * FROM comex_field_defs ORDER BY entity, sort_order, field_key')
          .all() as Record<string, unknown>[]);
    return rows.map(hydrateField);
  }

  async upsertFieldDef(input: ComexFieldDefInput & { id?: string }): Promise<ComexFieldDef> {
    const existing = input.id
      ? (this.db.prepare('SELECT * FROM comex_field_defs WHERE id = ?').get(input.id) as
          | Record<string, unknown>
          | undefined)
      : (this.db
          .prepare('SELECT * FROM comex_field_defs WHERE entity = ? AND field_key = ?')
          .get(input.entity, input.field_key) as Record<string, unknown> | undefined);
    const id = String(existing?.id || input.id || randomUUID());
    const row = {
      id,
      entity: input.entity,
      field_key: input.field_key,
      label: input.label,
      data_type: input.data_type,
      required: input.required ? 1 : 0,
      enum_options: JSON.stringify(input.enum_options || []),
      widget: input.widget || 'text',
      ui_list: input.ui_list ? 1 : 0,
      ui_form: input.ui_form === false ? 0 : 1,
      consult_key: input.consult_key ? 1 : 0,
      kpi: input.kpi ?? null,
      sort_order: input.sort_order ?? 0,
      created_at: String(existing?.created_at || nowIso()),
    };
    this.db
      .prepare(
        `INSERT INTO comex_field_defs
          (id, entity, field_key, label, data_type, required, enum_options, widget, ui_list, ui_form, consult_key, kpi, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(entity, field_key) DO UPDATE SET
          label=excluded.label, data_type=excluded.data_type, required=excluded.required,
          enum_options=excluded.enum_options, widget=excluded.widget, ui_list=excluded.ui_list,
          ui_form=excluded.ui_form, consult_key=excluded.consult_key, kpi=excluded.kpi, sort_order=excluded.sort_order`,
      )
      .run(
        row.id,
        row.entity,
        row.field_key,
        row.label,
        row.data_type,
        row.required,
        row.enum_options,
        row.widget,
        row.ui_list,
        row.ui_form,
        row.consult_key,
        row.kpi,
        row.sort_order,
        row.created_at,
      );
    return hydrateField(row);
  }

  async deleteFieldDef(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM comex_field_defs WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async listProcesses(): Promise<ComexProcessRecord[]> {
    const procs = this.db
      .prepare('SELECT * FROM comex_processes ORDER BY updated_at DESC')
      .all() as Record<string, unknown>[];
    const docs = await this.listDocuments();
    const byProc = new Map<string, ComexDocumentRecord[]>();
    for (const doc of docs) {
      if (!doc.process_id) continue;
      const list = byProc.get(doc.process_id) || [];
      list.push(doc);
      byProc.set(doc.process_id, list);
    }
    return procs.map((row) => hydrateProcess(row, byProc.get(String(row.id)) || []));
  }

  async getProcess(id: string): Promise<ComexProcessRecord | null> {
    const row = this.db.prepare('SELECT * FROM comex_processes WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    const docs = await this.listDocuments(id);
    return hydrateProcess(row, docs);
  }

  async createProcess(input: {
    code?: string;
    client_slug?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<ComexProcessRecord> {
    const existing = this.db.prepare('SELECT code FROM comex_processes').all() as { code: string }[];
    const id = randomUUID();
    const ts = nowIso();
    const code = input.code || nextProcessCode(existing);
    this.db
      .prepare(
        'INSERT INTO comex_processes (id, code, client_slug, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(id, code, input.client_slug ?? process.env.COMEX_CLIENT_SLUG ?? null, JSON.stringify(input.payload || {}), ts, ts);
    return (await this.getProcess(id))!;
  }

  async updateProcess(
    id: string,
    patch: { code?: string; client_slug?: string | null; payload?: Record<string, unknown> },
  ): Promise<ComexProcessRecord | null> {
    const current = await this.getProcess(id);
    if (!current) return null;
    const code = patch.code ?? current.code;
    const client_slug = patch.client_slug === undefined ? current.client_slug : patch.client_slug;
    const payload = patch.payload ?? current.payload;
    this.db
      .prepare(
        'UPDATE comex_processes SET code = ?, client_slug = ?, payload = ?, updated_at = ? WHERE id = ?',
      )
      .run(code, client_slug, JSON.stringify(payload), nowIso(), id);
    return this.getProcess(id);
  }

  async deleteProcess(id: string): Promise<boolean> {
    this.db.prepare('UPDATE comex_documents SET process_id = NULL WHERE process_id = ?').run(id);
    const result = this.db.prepare('DELETE FROM comex_processes WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async listDocuments(processId?: string | null): Promise<ComexDocumentRecord[]> {
    const rows =
      processId === undefined
        ? (this.db.prepare('SELECT * FROM comex_documents ORDER BY file_name').all() as Record<string, unknown>[])
        : processId === null
          ? (this.db
              .prepare('SELECT * FROM comex_documents WHERE process_id IS NULL ORDER BY file_name')
              .all() as Record<string, unknown>[])
          : (this.db
              .prepare('SELECT * FROM comex_documents WHERE process_id = ? ORDER BY file_name')
              .all(processId) as Record<string, unknown>[]);
    return rows.map(hydrateDocument);
  }

  async getDocument(id: string): Promise<ComexDocumentRecord | null> {
    const row = this.db.prepare('SELECT * FROM comex_documents WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? hydrateDocument(row) : null;
  }

  async upsertDocument(input: {
    id?: string;
    process_id?: string | null;
    doc_type: string;
    file_name: string;
    file_path: string;
    size_bytes?: number | null;
    meta?: Record<string, unknown>;
  }): Promise<ComexDocumentRecord> {
    const existing = this.db
      .prepare('SELECT * FROM comex_documents WHERE file_path = ?')
      .get(input.file_path) as Record<string, unknown> | undefined;
    const id = String(existing?.id || input.id || randomUUID());
    const created_at = String(existing?.created_at || nowIso());
    const process_id = input.process_id === undefined ? (existing?.process_id as string | null) ?? null : input.process_id;
    this.db
      .prepare(
        `INSERT INTO comex_documents (id, process_id, doc_type, file_name, file_path, size_bytes, meta, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(file_path) DO UPDATE SET
          process_id=excluded.process_id, doc_type=excluded.doc_type, file_name=excluded.file_name,
          size_bytes=excluded.size_bytes, meta=excluded.meta`,
      )
      .run(
        id,
        process_id,
        input.doc_type,
        input.file_name,
        input.file_path,
        input.size_bytes ?? null,
        JSON.stringify(input.meta || {}),
        created_at,
      );
    return (await this.getDocument(id))!;
  }

  async linkDocument(id: string, processId: string | null): Promise<ComexDocumentRecord | null> {
    const result = this.db.prepare('UPDATE comex_documents SET process_id = ? WHERE id = ?').run(processId, id);
    if (!result.changes) return null;
    return this.getDocument(id);
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM comex_documents WHERE id = ?').run(id);
    return result.changes > 0;
  }
}

type PgPool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

export class PgComexStore implements ComexStore {
  driver = 'postgres' as const;
  private pool: PgPool | null = null;
  constructor(private connectionString: string) {}

  private async db(): Promise<PgPool> {
    if (this.pool) return this.pool;
    const pgMod = (await import('pg')) as { default?: { Pool: new (c: { connectionString: string }) => PgPool }; Pool?: new (c: { connectionString: string }) => PgPool };
    const Pool = pgMod.default?.Pool ?? pgMod.Pool;
    if (!Pool) throw new Error('pg.Pool indisponível');
    this.pool = new Pool({ connectionString: this.connectionString });
    return this.pool;
  }

  async ensureReady(): Promise<void> {
    const db = await this.db();
    await db.query('SELECT 1 FROM comex_field_defs LIMIT 1');
    for (const def of DEFAULT_COMEX_FIELD_DEFS) {
      await this.upsertFieldDef(def);
    }
  }

  async listFieldDefs(entity?: string): Promise<ComexFieldDef[]> {
    const db = await this.db();
    const result = entity
      ? await db.query(
          'SELECT * FROM comex_field_defs WHERE entity = $1 ORDER BY sort_order, field_key',
          [entity],
        )
      : await db.query('SELECT * FROM comex_field_defs ORDER BY entity, sort_order, field_key');
    return result.rows.map(hydrateField);
  }

  async upsertFieldDef(input: ComexFieldDefInput & { id?: string }): Promise<ComexFieldDef> {
    const db = await this.db();
    const id = input.id || randomUUID();
    const { rows } = await db.query(
      `INSERT INTO comex_field_defs
        (id, entity, field_key, label, data_type, required, enum_options, widget, ui_list, ui_form, consult_key, kpi, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (entity, field_key) DO UPDATE SET
        label=EXCLUDED.label, data_type=EXCLUDED.data_type, required=EXCLUDED.required,
        enum_options=EXCLUDED.enum_options, widget=EXCLUDED.widget, ui_list=EXCLUDED.ui_list,
        ui_form=EXCLUDED.ui_form, consult_key=EXCLUDED.consult_key, kpi=EXCLUDED.kpi, sort_order=EXCLUDED.sort_order
       RETURNING *`,
      [
        id,
        input.entity,
        input.field_key,
        input.label,
        input.data_type,
        input.required === true,
        JSON.stringify(input.enum_options || []),
        input.widget || 'text',
        input.ui_list === true,
        input.ui_form !== false,
        input.consult_key === true,
        input.kpi ?? null,
        input.sort_order ?? 0,
      ],
    );
    return hydrateField(rows[0]);
  }

  async deleteFieldDef(id: string): Promise<boolean> {
    const db = await this.db();
    const { rows } = await db.query('DELETE FROM comex_field_defs WHERE id = $1 RETURNING id', [id]);
    return rows.length > 0;
  }

  async listProcesses(): Promise<ComexProcessRecord[]> {
    const db = await this.db();
    const procs = await db.query('SELECT * FROM comex_processes ORDER BY updated_at DESC');
    const docs = await this.listDocuments();
    const byProc = new Map<string, ComexDocumentRecord[]>();
    for (const doc of docs) {
      if (!doc.process_id) continue;
      const list = byProc.get(doc.process_id) || [];
      list.push(doc);
      byProc.set(doc.process_id, list);
    }
    return procs.rows.map((row) => hydrateProcess(row, byProc.get(String(row.id)) || []));
  }

  async getProcess(id: string): Promise<ComexProcessRecord | null> {
    const db = await this.db();
    const { rows } = await db.query('SELECT * FROM comex_processes WHERE id = $1', [id]);
    if (!rows[0]) return null;
    const docs = await this.listDocuments(id);
    return hydrateProcess(rows[0], docs);
  }

  async createProcess(input: {
    code?: string;
    client_slug?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<ComexProcessRecord> {
    const db = await this.db();
    const existing = await db.query('SELECT code FROM comex_processes');
    const code = input.code || nextProcessCode(existing.rows as { code: string }[]);
    const { rows } = await db.query(
      `INSERT INTO comex_processes (code, client_slug, payload)
       VALUES ($1,$2,$3::jsonb) RETURNING *`,
      [code, input.client_slug ?? process.env.COMEX_CLIENT_SLUG ?? null, JSON.stringify(input.payload || {})],
    );
    return hydrateProcess(rows[0], []);
  }

  async updateProcess(
    id: string,
    patch: { code?: string; client_slug?: string | null; payload?: Record<string, unknown> },
  ): Promise<ComexProcessRecord | null> {
    const current = await this.getProcess(id);
    if (!current) return null;
    const db = await this.db();
    const { rows } = await db.query(
      `UPDATE comex_processes
       SET code = $2, client_slug = $3, payload = $4::jsonb
       WHERE id = $1 RETURNING *`,
      [
        id,
        patch.code ?? current.code,
        patch.client_slug === undefined ? current.client_slug : patch.client_slug,
        JSON.stringify(patch.payload ?? current.payload),
      ],
    );
    return rows[0] ? hydrateProcess(rows[0], current.documents || []) : null;
  }

  async deleteProcess(id: string): Promise<boolean> {
    const db = await this.db();
    const { rows } = await db.query('DELETE FROM comex_processes WHERE id = $1 RETURNING id', [id]);
    return rows.length > 0;
  }

  async listDocuments(processId?: string | null): Promise<ComexDocumentRecord[]> {
    const db = await this.db();
    const result =
      processId === undefined
        ? await db.query('SELECT * FROM comex_documents ORDER BY file_name')
        : processId === null
          ? await db.query('SELECT * FROM comex_documents WHERE process_id IS NULL ORDER BY file_name')
          : await db.query('SELECT * FROM comex_documents WHERE process_id = $1 ORDER BY file_name', [processId]);
    return result.rows.map(hydrateDocument);
  }

  async getDocument(id: string): Promise<ComexDocumentRecord | null> {
    const db = await this.db();
    const { rows } = await db.query('SELECT * FROM comex_documents WHERE id = $1', [id]);
    return rows[0] ? hydrateDocument(rows[0]) : null;
  }

  async upsertDocument(input: {
    id?: string;
    process_id?: string | null;
    doc_type: string;
    file_name: string;
    file_path: string;
    size_bytes?: number | null;
    meta?: Record<string, unknown>;
  }): Promise<ComexDocumentRecord> {
    const db = await this.db();
    const { rows } = await db.query(
      `INSERT INTO comex_documents (id, process_id, doc_type, file_name, file_path, size_bytes, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       ON CONFLICT (file_path) DO UPDATE SET
        process_id = COALESCE(EXCLUDED.process_id, comex_documents.process_id),
        doc_type = EXCLUDED.doc_type,
        file_name = EXCLUDED.file_name,
        size_bytes = EXCLUDED.size_bytes,
        meta = EXCLUDED.meta
       RETURNING *`,
      [
        input.id || randomUUID(),
        input.process_id ?? null,
        input.doc_type,
        input.file_name,
        input.file_path,
        input.size_bytes ?? null,
        JSON.stringify(input.meta || {}),
      ],
    );
    return hydrateDocument(rows[0]);
  }

  async linkDocument(id: string, processId: string | null): Promise<ComexDocumentRecord | null> {
    const db = await this.db();
    const { rows } = await db.query(
      'UPDATE comex_documents SET process_id = $2 WHERE id = $1 RETURNING *',
      [id, processId],
    );
    return rows[0] ? hydrateDocument(rows[0]) : null;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const db = await this.db();
    const { rows } = await db.query('DELETE FROM comex_documents WHERE id = $1 RETURNING id', [id]);
    return rows.length > 0;
  }
}

let storePromise: Promise<ComexStore> | null = null;

export function defaultSqlitePath(): string {
  return process.env.COMEX_DB_PATH || path.join(process.cwd(), 'data', 'comex.sqlite');
}

export async function createComexStore(): Promise<ComexStore> {
  if (process.env.DATABASE_URL) {
    const pgStore = new PgComexStore(process.env.DATABASE_URL);
    try {
      await pgStore.ensureReady();
      return pgStore;
    } catch (err) {
      console.warn(
        '[comex] Postgres indisponível — sqlite local. Aplique supabase/client/migrations/20260814120000_comex_metadata.sql',
        err instanceof Error ? err.message : err,
      );
    }
  }
  const sqlite = new SqliteComexStore(defaultSqlitePath());
  await sqlite.ensureReady();
  return sqlite;
}

export function getComexStore(): Promise<ComexStore> {
  if (!storePromise) storePromise = createComexStore();
  return storePromise;
}

export function resetComexStoreForTests(): void {
  storePromise = null;
}

export function consultValueFromProcess(
  process: ComexProcessRecord,
  fieldDefs: ComexFieldDef[],
): { number: string; version: string; kind: 'duimp' | 'due' } | null {
  const consultField = fieldDefs.find((f) => f.entity === 'process' && f.consult_key);
  const raw = consultField
    ? process.payload[consultField.field_key]
    : process.payload.declaration_number || process.payload.duimp_number;
  const number = String(raw || '').trim();
  if (!number) return null;
  const version = String(process.payload.duimp_version || '1');
  const kind = String(process.payload.type || 'importacao') === 'exportacao' ? 'due' : 'duimp';
  return { number, version, kind };
}
