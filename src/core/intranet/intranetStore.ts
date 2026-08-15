import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type {
  ApprovalStatus,
  IntranetCadastroContatoRecord,
  IntranetEmployeeRecord,
  IntranetJobTitleRecord,
  IntranetOutboxRecord,
  IntranetRequestRecord,
  IntranetSectorRecord,
} from '../../types/intranet';

const SQLITE_SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS sectors (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES sectors(id),
  head_employee_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS job_titles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  can_request INTEGER NOT NULL DEFAULT 0,
  can_approve INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  sector_id TEXT NOT NULL REFERENCES sectors(id),
  job_title_id TEXT NOT NULL REFERENCES job_titles(id),
  reports_to TEXT REFERENCES employees(id),
  can_request_override INTEGER,
  can_approve_override INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS workflow_defs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  configuration TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  workflow_definition_id TEXT,
  requester_employee_id TEXT NOT NULL,
  from_sector_id TEXT,
  to_sector_id TEXT,
  title TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  current_step INTEGER NOT NULL DEFAULT 1,
  total_steps INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  supplier_name TEXT,
  supplier_email TEXT,
  email_status TEXT,
  email_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id),
  assigned_employee_id TEXT NOT NULL,
  assigned_sector_id TEXT NOT NULL,
  step_number INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  actor_employee_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  actor_employee_id TEXT,
  event TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS outbox_events (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  processed_at TEXT
);
CREATE TABLE IF NOT EXISTS cadastro_contatos (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS cadastro_contatos_email_account
  ON cadastro_contatos(email, account_code);
`;

export const ORG_IDS = {
  dir: 'a0000000-0000-4000-8000-000000000001',
  fin: 'a0000000-0000-4000-8000-000000000002',
  com: 'a0000000-0000-4000-8000-000000000003',
  log: 'a0000000-0000-4000-8000-000000000004',
  cml: 'a0000000-0000-4000-8000-000000000005',
  cmx: 'a0000000-0000-4000-8000-000000000006',
  jobSocio: 'b0000000-0000-4000-8000-000000000001',
  jobCfo: 'b0000000-0000-4000-8000-000000000002',
  jobAssist: 'b0000000-0000-4000-8000-000000000003',
  jobVp: 'b0000000-0000-4000-8000-000000000004',
  jobComite: 'b0000000-0000-4000-8000-000000000005',
  empSocio: 'c0000000-0000-4000-8000-000000000001',
  empCfo: 'c0000000-0000-4000-8000-000000000002',
  empCompras: 'c0000000-0000-4000-8000-000000000003',
  empComercial: 'c0000000-0000-4000-8000-000000000004',
  empComite: 'c0000000-0000-4000-8000-000000000005',
  wfRfq: 'd0000000-0000-4000-8000-000000000001',
};

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
  return v === 1 || v === true || v === '1';
}

function asBoolOrNull(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  return asBool(v);
}

function hydrateRequest(row: Record<string, unknown>): IntranetRequestRecord {
  return {
    id: String(row.id),
    code: String(row.code),
    title: String(row.title),
    status: row.status as ApprovalStatus,
    version: Number(row.version),
    payload: parseJson(row.payload, {}),
    supplier_name: row.supplier_name ? String(row.supplier_name) : null,
    supplier_email: row.supplier_email ? String(row.supplier_email) : null,
    requester_employee_id: String(row.requester_employee_id),
    requester_email: row.requester_email ? String(row.requester_email) : undefined,
    from_sector_id: row.from_sector_id ? String(row.from_sector_id) : null,
    to_sector_id: row.to_sector_id ? String(row.to_sector_id) : null,
    current_step: Number(row.current_step),
    total_steps: Number(row.total_steps),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    assigned_employee_id: row.assigned_employee_id ? String(row.assigned_employee_id) : null,
    assigned_employee_email: row.assigned_employee_email ? String(row.assigned_employee_email) : null,
    assigned_employee_name: row.assigned_employee_name ? String(row.assigned_employee_name) : null,
    assigned_sector_id: row.assigned_sector_id ? String(row.assigned_sector_id) : null,
    assigned_sector_name: row.assigned_sector_name ? String(row.assigned_sector_name) : null,
    email_status: (row.email_status as IntranetRequestRecord['email_status']) || null,
    email_error: row.email_error ? String(row.email_error) : null,
    last_decision_reason: row.last_decision_reason ? String(row.last_decision_reason) : null,
    last_decision_action: row.last_decision_action ? String(row.last_decision_action) : null,
  };
}

function hydrateEmployee(row: Record<string, unknown>): IntranetEmployeeRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    full_name: String(row.full_name),
    sector_id: String(row.sector_id),
    job_title_id: String(row.job_title_id),
    reports_to: row.reports_to ? String(row.reports_to) : null,
    can_request_override: asBoolOrNull(row.can_request_override),
    can_approve_override: asBoolOrNull(row.can_approve_override),
    is_active: asBool(row.is_active),
    job_title_name: row.job_title_name ? String(row.job_title_name) : undefined,
    sector_code: row.sector_code ? String(row.sector_code) : undefined,
    sector_name: row.sector_name ? String(row.sector_name) : undefined,
  };
}

const REQUEST_SELECT = `
SELECT r.*,
  req.email AS requester_email,
  a.assigned_employee_id,
  a.assigned_sector_id,
  ae.email AS assigned_employee_email,
  ae.full_name AS assigned_employee_name,
  s.name AS assigned_sector_name,
  (
    SELECT d.reason FROM decisions d
    WHERE d.request_id = r.id
    ORDER BY d.created_at DESC LIMIT 1
  ) AS last_decision_reason,
  (
    SELECT d.action FROM decisions d
    WHERE d.request_id = r.id
    ORDER BY d.created_at DESC LIMIT 1
  ) AS last_decision_action
FROM requests r
LEFT JOIN employees req ON req.id = r.requester_employee_id
LEFT JOIN assignments a ON a.request_id = r.id AND a.is_active = 1
LEFT JOIN employees ae ON ae.id = a.assigned_employee_id
LEFT JOIN sectors s ON s.id = a.assigned_sector_id
`;

export class SqliteIntranetStore {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec(SQLITE_SCHEMA);
    this.seedIfEmpty();
  }

  withTx<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        /* already rolled back */
      }
      throw err;
    }
  }

  private seedIfEmpty(): void {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM sectors').get() as { n: number };
    if (Number(row.n) > 0) return;
    const t = nowIso();
    const { dir, fin, com, log, cml, cmx, jobSocio, jobCfo, jobAssist, jobVp, jobComite, empSocio, empCfo, empCompras, empComercial, empComite, wfRfq } = ORG_IDS;
    this.db.exec('BEGIN');
    this.db.prepare('INSERT INTO sectors (id, code, name, parent_id, created_at) VALUES (?, ?, ?, ?, ?)').run(dir, 'DIR', 'Diretoria', null, t);
    this.db.prepare('INSERT INTO sectors (id, code, name, parent_id, created_at) VALUES (?, ?, ?, ?, ?)').run(fin, 'FIN', 'Financeiro', dir, t);
    this.db.prepare('INSERT INTO sectors (id, code, name, parent_id, created_at) VALUES (?, ?, ?, ?, ?)').run(com, 'COM', 'Compras', fin, t);
    this.db.prepare('INSERT INTO sectors (id, code, name, parent_id, created_at) VALUES (?, ?, ?, ?, ?)').run(log, 'LOG', 'Logística', dir, t);
    this.db.prepare('INSERT INTO sectors (id, code, name, parent_id, created_at) VALUES (?, ?, ?, ?, ?)').run(cml, 'CML', 'Comercial', dir, t);
    this.db.prepare('INSERT INTO sectors (id, code, name, parent_id, created_at) VALUES (?, ?, ?, ?, ?)').run(cmx, 'CMX', 'Comex', dir, t);
    this.db.prepare('INSERT INTO job_titles (id, name, can_request, can_approve) VALUES (?, ?, ?, ?)').run(jobSocio, 'Sócio-Fundador', 0, 1);
    this.db.prepare('INSERT INTO job_titles (id, name, can_request, can_approve) VALUES (?, ?, ?, ?)').run(jobCfo, 'CFO / Controller', 1, 1);
    this.db.prepare('INSERT INTO job_titles (id, name, can_request, can_approve) VALUES (?, ?, ?, ?)').run(jobAssist, 'Assistente de Compras', 1, 0);
    this.db.prepare('INSERT INTO job_titles (id, name, can_request, can_approve) VALUES (?, ?, ?, ?)').run(jobVp, 'VP de Negócios', 1, 0);
    this.db.prepare('INSERT INTO job_titles (id, name, can_request, can_approve) VALUES (?, ?, ?, ?)').run(jobComite, 'Comitê de Risco', 0, 0);
    this.db.prepare(
      'INSERT INTO employees (id, email, full_name, sector_id, job_title_id, reports_to, can_request_override, can_approve_override, is_active) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 1)',
    ).run(empSocio, 'socio@hubfitness.com.br', 'Carlos Eduardo', dir, jobSocio, null);
    this.db.prepare(
      'INSERT INTO employees (id, email, full_name, sector_id, job_title_id, reports_to, can_request_override, can_approve_override, is_active) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 1)',
    ).run(empCfo, 'cfo@hubfitness.com.br', 'Dr. Roberto Mendes', fin, jobCfo, empSocio);
    this.db.prepare(
      'INSERT INTO employees (id, email, full_name, sector_id, job_title_id, reports_to, can_request_override, can_approve_override, is_active) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 1)',
    ).run(empCompras, 'compras@hubfitness.com.br', 'Ana Souza', com, jobAssist, empCfo);
    this.db.prepare(
      'INSERT INTO employees (id, email, full_name, sector_id, job_title_id, reports_to, can_request_override, can_approve_override, is_active) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 1)',
    ).run(empComercial, 'comercial@hubfitness.com.br', 'Fernando Silva', cml, jobVp, empSocio);
    this.db.prepare(
      'INSERT INTO employees (id, email, full_name, sector_id, job_title_id, reports_to, can_request_override, can_approve_override, is_active) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 1)',
    ).run(empComite, 'comite@hubfitness.com.br', 'Juliana Paes', dir, jobComite, empSocio);
    this.db.prepare('UPDATE sectors SET head_employee_id = ? WHERE id = ?').run(empSocio, dir);
    this.db.prepare('UPDATE sectors SET head_employee_id = ? WHERE id = ?').run(empCfo, fin);
    this.db.prepare('UPDATE sectors SET head_employee_id = ? WHERE id = ?').run(empCompras, com);
    this.db.prepare('INSERT INTO workflow_defs (id, name, version, configuration) VALUES (?, ?, 1, ?)').run(
      wfRfq,
      'RFQ Compras',
      JSON.stringify({ total_steps: 1 }),
    );
    this.db.exec('COMMIT');
  }

  listSectors(): IntranetSectorRecord[] {
    const rows = this.db.prepare('SELECT * FROM sectors ORDER BY code').all() as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      parent_id: row.parent_id ? String(row.parent_id) : null,
      head_employee_id: row.head_employee_id ? String(row.head_employee_id) : null,
    }));
  }

  listJobTitles(): IntranetJobTitleRecord[] {
    const rows = this.db.prepare('SELECT * FROM job_titles ORDER BY name').all() as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      can_request: asBool(row.can_request),
      can_approve: asBool(row.can_approve),
    }));
  }

  listEmployees(): IntranetEmployeeRecord[] {
    const rows = this.db
      .prepare(
        `SELECT e.*, j.name AS job_title_name, j.can_request AS job_can_request, j.can_approve AS job_can_approve,
                s.code AS sector_code, s.name AS sector_name
         FROM employees e
         JOIN job_titles j ON j.id = e.job_title_id
         JOIN sectors s ON s.id = e.sector_id
         ORDER BY e.full_name`,
      )
      .all() as Record<string, unknown>[];
    return rows.map(hydrateEmployee);
  }

  resolverEmployees(): Array<IntranetEmployeeRecord & { can_request: boolean; can_approve: boolean }> {
    const rows = this.db
      .prepare(
        `SELECT e.*, j.can_request AS can_request, j.can_approve AS can_approve
         FROM employees e
         JOIN job_titles j ON j.id = e.job_title_id`,
      )
      .all() as Record<string, unknown>[];
    return rows.map((row) => ({
      ...hydrateEmployee(row),
      can_request: asBool(row.can_request),
      can_approve: asBool(row.can_approve),
    }));
  }

  getEmployeeByEmail(email: string): (IntranetEmployeeRecord & { can_request: boolean; can_approve: boolean }) | null {
    const row = this.db
      .prepare(
        `SELECT e.*, j.name AS job_title_name, j.can_request AS can_request, j.can_approve AS can_approve,
                s.code AS sector_code, s.name AS sector_name
         FROM employees e
         JOIN job_titles j ON j.id = e.job_title_id
         JOIN sectors s ON s.id = e.sector_id
         WHERE lower(e.email) = lower(?)`,
      )
      .get(email) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      ...hydrateEmployee(row),
      can_request: asBool(row.can_request),
      can_approve: asBool(row.can_approve),
    };
  }

  getEmployee(id: string): IntranetEmployeeRecord | null {
    const row = this.db
      .prepare(
        `SELECT e.*, j.name AS job_title_name, s.code AS sector_code, s.name AS sector_name
         FROM employees e
         JOIN job_titles j ON j.id = e.job_title_id
         JOIN sectors s ON s.id = e.sector_id
         WHERE e.id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? hydrateEmployee(row) : null;
  }

  upsertSector(input: { id?: string; code: string; name: string; parent_id: string | null }): IntranetSectorRecord {
    const id = input.id || randomUUID();
    const existing = this.db.prepare('SELECT id FROM sectors WHERE id = ?').get(id) as { id: string } | undefined;
    if (existing) {
      this.db.prepare('UPDATE sectors SET code = ?, name = ?, parent_id = ? WHERE id = ?').run(
        input.code,
        input.name,
        input.parent_id,
        id,
      );
    } else {
      this.db.prepare('INSERT INTO sectors (id, code, name, parent_id, created_at) VALUES (?, ?, ?, ?, ?)').run(
        id,
        input.code,
        input.name,
        input.parent_id,
        nowIso(),
      );
    }
    return this.listSectors().find((s) => s.id === id)!;
  }

  upsertJobTitle(input: { id?: string; name: string; can_request: boolean; can_approve: boolean }): IntranetJobTitleRecord {
    const id = input.id || randomUUID();
    const existing = this.db.prepare('SELECT id FROM job_titles WHERE id = ?').get(id) as { id: string } | undefined;
    if (existing) {
      this.db.prepare('UPDATE job_titles SET name = ?, can_request = ?, can_approve = ? WHERE id = ?').run(
        input.name,
        input.can_request ? 1 : 0,
        input.can_approve ? 1 : 0,
        id,
      );
    } else {
      this.db.prepare('INSERT INTO job_titles (id, name, can_request, can_approve) VALUES (?, ?, ?, ?)').run(
        id,
        input.name,
        input.can_request ? 1 : 0,
        input.can_approve ? 1 : 0,
      );
    }
    return this.listJobTitles().find((j) => j.id === id)!;
  }

  upsertEmployee(input: {
    id?: string;
    email: string;
    full_name: string;
    sector_id: string;
    job_title_id: string;
    reports_to?: string | null;
    can_request_override?: boolean | null;
    can_approve_override?: boolean | null;
    is_active?: boolean;
  }): IntranetEmployeeRecord {
    const id = input.id || randomUUID();
    const existing = this.db.prepare('SELECT id FROM employees WHERE id = ?').get(id) as { id: string } | undefined;
    const ovReq = input.can_request_override === undefined ? undefined : input.can_request_override;
    const ovAppr = input.can_approve_override === undefined ? undefined : input.can_approve_override;
    if (existing) {
      this.db
        .prepare(
          `UPDATE employees SET email = ?, full_name = ?, sector_id = ?, job_title_id = ?, reports_to = ?,
            can_request_override = ?, can_approve_override = ?, is_active = ? WHERE id = ?`,
        )
        .run(
          input.email,
          input.full_name,
          input.sector_id,
          input.job_title_id,
          input.reports_to ?? null,
          ovReq === undefined || ovReq === null ? null : ovReq ? 1 : 0,
          ovAppr === undefined || ovAppr === null ? null : ovAppr ? 1 : 0,
          input.is_active === false ? 0 : 1,
          id,
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO employees (id, email, full_name, sector_id, job_title_id, reports_to, can_request_override, can_approve_override, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.email,
          input.full_name,
          input.sector_id,
          input.job_title_id,
          input.reports_to ?? null,
          ovReq === undefined || ovReq === null ? null : ovReq ? 1 : 0,
          ovAppr === undefined || ovAppr === null ? null : ovAppr ? 1 : 0,
          input.is_active === false ? 0 : 1,
        );
    }
    return this.getEmployee(id)!;
  }

  nextRequestCode(): string {
    const year = new Date().getFullYear();
    const prefix = `RFQ-${year}-`;
    const rows = this.db.prepare('SELECT code FROM requests').all() as { code: string }[];
    let max = 0;
    for (const row of rows) {
      if (!row.code.startsWith(prefix)) continue;
      const n = Number(row.code.slice(prefix.length));
      if (Number.isFinite(n) && n > max) max = n;
    }
    return `${prefix}${String(max + 1).padStart(3, '0')}`;
  }

  insertRequest(input: {
    requester_employee_id: string;
    from_sector_id: string;
    to_sector_id: string;
    title: string;
    payload: Record<string, unknown>;
    supplier_name?: string | null;
    supplier_email?: string | null;
    status: ApprovalStatus;
  }): IntranetRequestRecord {
    const id = randomUUID();
    const code = this.nextRequestCode();
    const t = nowIso();
    this.db
      .prepare(
        `INSERT INTO requests (
          id, code, workflow_definition_id, requester_employee_id, from_sector_id, to_sector_id,
          title, payload, current_step, total_steps, status, version, supplier_name, supplier_email, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, 1, ?, ?, ?, ?)`,
      )
      .run(
        id,
        code,
        ORG_IDS.wfRfq,
        input.requester_employee_id,
        input.from_sector_id,
        input.to_sector_id,
        input.title,
        JSON.stringify(input.payload),
        input.status,
        input.supplier_name ?? null,
        input.supplier_email ?? null,
        t,
        t,
      );
    return this.getRequest(id)!;
  }

  insertAssignment(input: {
    request_id: string;
    assigned_employee_id: string;
    assigned_sector_id: string;
    step_number: number;
  }): void {
    this.db
      .prepare(
        `INSERT INTO assignments (id, request_id, assigned_employee_id, assigned_sector_id, step_number, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
      )
      .run(randomUUID(), input.request_id, input.assigned_employee_id, input.assigned_sector_id, input.step_number, nowIso());
  }

  deactivateAssignments(requestId: string): void {
    this.db.prepare('UPDATE assignments SET is_active = 0 WHERE request_id = ?').run(requestId);
  }

  insertDecision(input: { request_id: string; actor_employee_id: string; action: string; reason: string }): void {
    this.db
      .prepare(
        'INSERT INTO decisions (id, request_id, actor_employee_id, action, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(randomUUID(), input.request_id, input.actor_employee_id, input.action, input.reason || null, nowIso());
  }

  insertAudit(input: {
    request_id: string | null;
    actor_employee_id: string | null;
    event: string;
    detail?: Record<string, unknown>;
  }): void {
    this.db
      .prepare(
        'INSERT INTO audit_logs (id, request_id, actor_employee_id, event, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        randomUUID(),
        input.request_id,
        input.actor_employee_id,
        input.event,
        JSON.stringify(input.detail || {}),
        nowIso(),
      );
  }

  insertOutbox(input: { request_id: string; event_type: string; payload: Record<string, unknown> }): void {
    this.db
      .prepare(
        `INSERT INTO outbox_events (id, request_id, event_type, payload, status, attempts, created_at)
         VALUES (?, ?, ?, ?, 'PENDING', 0, ?)`,
      )
      .run(randomUUID(), input.request_id, input.event_type, JSON.stringify(input.payload), nowIso());
  }

  updateRequest(id: string, patch: { status: ApprovalStatus; version: number; email_status?: string | null }): void {
    this.db
      .prepare('UPDATE requests SET status = ?, version = ?, email_status = COALESCE(?, email_status), updated_at = ? WHERE id = ?')
      .run(patch.status, patch.version, patch.email_status ?? null, nowIso(), id);
  }

  getRequest(id: string): IntranetRequestRecord | null {
    const row = this.db.prepare(`${REQUEST_SELECT} WHERE r.id = ?`).get(id) as Record<string, unknown> | undefined;
    return row ? hydrateRequest(row) : null;
  }

  listRequests(filter?: {
    status?: string;
    inboxEmployeeId?: string;
    requesterEmployeeId?: string;
  }): IntranetRequestRecord[] {
    let sql = REQUEST_SELECT + ' WHERE 1=1';
    const params: string[] = [];
    if (filter?.status) {
      sql += ' AND r.status = ?';
      params.push(filter.status);
    }
    if (filter?.inboxEmployeeId) {
      sql += ' AND a.assigned_employee_id = ? AND a.is_active = 1';
      params.push(filter.inboxEmployeeId);
    }
    if (filter?.requesterEmployeeId) {
      sql += ' AND r.requester_employee_id = ?';
      params.push(filter.requesterEmployeeId);
    }
    sql += ' ORDER BY r.updated_at DESC';
    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(hydrateRequest);
  }

  listOutbox(): IntranetOutboxRecord[] {
    const rows = this.db.prepare('SELECT * FROM outbox_events ORDER BY created_at').all() as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      request_id: row.request_id ? String(row.request_id) : null,
      event_type: String(row.event_type),
      payload: parseJson(row.payload, {}),
      status: row.status as IntranetOutboxRecord['status'],
      attempts: Number(row.attempts),
      last_error: row.last_error ? String(row.last_error) : null,
    }));
  }

  claimPendingOutbox(): IntranetOutboxRecord | null {
    const row = this.db
      .prepare(`SELECT * FROM outbox_events WHERE status = 'PENDING' ORDER BY created_at LIMIT 1`)
      .get() as Record<string, unknown> | undefined;
    if (!row) return null;
    const result = this.db
      .prepare(`UPDATE outbox_events SET status = 'PROCESSING', attempts = attempts + 1 WHERE id = ? AND status = 'PENDING'`)
      .run(String(row.id));
    if (!result.changes) return null;
    const claimed = this.db.prepare('SELECT * FROM outbox_events WHERE id = ?').get(String(row.id)) as Record<string, unknown>;
    return {
      id: String(claimed.id),
      request_id: claimed.request_id ? String(claimed.request_id) : null,
      event_type: String(claimed.event_type),
      payload: parseJson(claimed.payload, {}),
      status: 'PROCESSING',
      attempts: Number(claimed.attempts),
      last_error: null,
    };
  }

  finishOutbox(id: string, ok: boolean, error?: string): void {
    this.db
      .prepare(
        `UPDATE outbox_events SET status = ?, last_error = ?, processed_at = ? WHERE id = ?`,
      )
      .run(ok ? 'PROCESSED' : 'FAILED', error ?? null, nowIso(), id);
  }

  setRequestEmail(id: string, email_status: string, email_error: string | null): void {
    this.db
      .prepare('UPDATE requests SET email_status = ?, email_error = ?, updated_at = ? WHERE id = ?')
      .run(email_status, email_error, nowIso(), id);
  }

  listCadastroContatos(): IntranetCadastroContatoRecord[] {
    this.ensureCadastroTable();
    const rows = this.db
      .prepare(
        `SELECT * FROM cadastro_contatos ORDER BY account_code ASC, full_name ASC`,
      )
      .all() as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      full_name: String(row.full_name),
      phone: String(row.phone || ''),
      email: String(row.email),
      account_code: String(row.account_code),
      account_name: String(row.account_name),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }));
  }

  private ensureCadastroTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cadastro_contatos (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL,
        account_code TEXT NOT NULL,
        account_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS cadastro_contatos_email_account
        ON cadastro_contatos(email, account_code);
    `);
  }

  upsertCadastroContato(input: {
    id?: string;
    full_name: string;
    phone?: string;
    email: string;
    account_code: string;
    account_name: string;
  }): IntranetCadastroContatoRecord {
    this.ensureCadastroTable();
    const id = input.id || randomUUID();
    const now = nowIso();
    const email = input.email.toLowerCase().trim();
    const fullName = input.full_name.trim();
    const phone = (input.phone || '').trim();
    const accountCode = input.account_code.trim();
    const accountName = input.account_name.trim();
    if (!fullName || !email || !accountCode) {
      throw new Error('NOME_EMAIL_CONTA_OBRIGATORIOS');
    }
    const existing = this.db.prepare('SELECT id, created_at FROM cadastro_contatos WHERE id = ?').get(id) as
      | { id: string; created_at: string }
      | undefined;
    if (existing) {
      this.db
        .prepare(
          `UPDATE cadastro_contatos
           SET full_name = ?, phone = ?, email = ?, account_code = ?, account_name = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(fullName, phone, email, accountCode, accountName, now, id);
    } else {
      this.db
        .prepare(
          `INSERT INTO cadastro_contatos
            (id, full_name, phone, email, account_code, account_name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, fullName, phone, email, accountCode, accountName, now, now);
    }
    return this.listCadastroContatos().find((c) => c.id === id)!;
  }

  deleteCadastroContato(id: string): boolean {
    this.ensureCadastroTable();
    const result = this.db.prepare('DELETE FROM cadastro_contatos WHERE id = ?').run(id);
    return Number(result.changes) > 0;
  }
}

let singleton: SqliteIntranetStore | null = null;

export function getIntranetStore(): SqliteIntranetStore {
  if (!singleton) {
    const dbPath = process.env.INTRANET_DB_PATH || 'data/intranet.sqlite';
    singleton = new SqliteIntranetStore(dbPath);
  }
  return singleton;
}

export function resetIntranetStoreForTests(): void {
  singleton = null;
}
