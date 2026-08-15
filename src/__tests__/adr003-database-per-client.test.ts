import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function collectSql(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...collectSql(full));
    else if (name.endsWith('.sql')) out.push(full);
  }
  return out;
}

describe('ADR-003 database-per-client', () => {
  const sqlFiles = [
    ...collectSql(path.join(root, 'supabase/migrations')),
    ...collectSql(path.join(root, 'supabase/client')),
  ];

  it('tem schema Operator + Client', () => {
    expect(sqlFiles.length).toBeGreaterThan(0);
    expect(
      fs.existsSync(path.join(root, 'supabase/client/provision_client_db.sql'))
    ).toBe(true);
  });

  it('não declara coluna tenant_id no DDL', () => {
    const offenders: string[] = [];
    for (const file of sqlFiles) {
      const sql = fs.readFileSync(file, 'utf8');
      // permite menções em comentários / assert_no_tenant_id
      const lines = sql.split('\n').filter((l) => {
        const t = l.trim();
        if (t.startsWith('--')) return false;
        if (/assert_no_tenant_id|column_name = 'tenant_id'|ADR-003/.test(t)) return false;
        return /\btenant_id\b/.test(t);
      });
      if (lines.length) offenders.push(`${path.relative(root, file)}: ${lines[0].trim()}`);
    }
    expect(offenders).toEqual([]);
  });

  it('não referencia get_my_tenant_id()', () => {
    for (const file of sqlFiles) {
      const sql = fs.readFileSync(file, 'utf8');
      expect(sql.includes('get_my_tenant_id')).toBe(false);
    }
  });

  it('provision Client inclui tabelas do handoff', () => {
    const sql = fs.readFileSync(
      path.join(root, 'supabase/client/provision_client_db.sql'),
      'utf8'
    );
    for (const table of [
      'orders',
      'order_lines',
      'commercial_invoices',
      'commercial_invoice_containers',
      'commercial_invoice_items',
      'order_payments',
      'packages',
      'reservations',
      'allocations',
      'supply_events',
      'committed_orders',
      'inbound_divergences',
      'products',
      'stock_movements',
      'shipping_documents',
      'label_templates',
      'damage_types',
      'item_damages',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
  });

  it('Operator tem clients + billing_records e seed Konnen dogfood', () => {
    const sql = fs.readFileSync(
      path.join(root, 'supabase/migrations/20260813180000_operator_core.sql'),
      'utf8'
    );
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.clients');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.billing_records');
    expect(sql).toContain("slug, legal_name, trade_name, is_dogfood");
    expect(sql).toContain("'konnen'");
    expect(sql).toContain('2968');
  });

  it('Comex Client é metadado (payload jsonb) sem colunas de negócio', () => {
    const sql = fs.readFileSync(
      path.join(root, 'supabase/client/migrations/20260814120000_comex_metadata.sql'),
      'utf8'
    );
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.comex_field_defs');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.comex_processes');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.comex_documents');
    expect(sql).toContain('payload       jsonb');
    expect(sql).toContain('client_slug');
    expect(sql.includes('declaration_number')).toBe(false);
  });
});
