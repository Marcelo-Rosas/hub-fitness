#!/usr/bin/env node
/**
 * ADR-003 — aplica schema Client DB em N databases.
 * Uso:
 *   node supabase/scripts/apply-client-migrations.mjs
 *   CLIENTS_FILE=./supabase/scripts/clients.json node ...
 *
 * Requer: npm i pg (dev) — connection string DATABASE_URL por cliente.
 * Critério: falha se existir coluna tenant_id após apply.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const clientsFile =
  process.env.CLIENTS_FILE || path.join(__dirname, 'clients.json');
const provisionPath = path.join(root, 'supabase/client/provision_client_db.sql');
const migrationsDir = path.join(root, 'supabase/client/migrations');

function loadClients() {
  if (!fs.existsSync(clientsFile)) {
    const example = path.join(__dirname, 'clients.example.json');
    console.error(
      `Arquivo ${clientsFile} não encontrado.\nCopie ${example} → clients.json e preencha as URLs.`
    );
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(clientsFile, 'utf8'));
}

function sqlFiles() {
  const files = [];
  if (fs.existsSync(provisionPath)) files.push(provisionPath);
  if (fs.existsSync(migrationsDir)) {
    for (const name of fs.readdirSync(migrationsDir).sort()) {
      if (!name.endsWith('.sql')) continue;
      const full = path.join(migrationsDir, name);
      // provision já cobre o core; skip migration idêntica se for a mesma cópia
      if (path.resolve(full) === path.resolve(provisionPath)) continue;
      const provisionSql = fs.readFileSync(provisionPath, 'utf8');
      const migSql = fs.readFileSync(full, 'utf8');
      if (migSql === provisionSql) continue;
      files.push(full);
    }
  }
  return files;
}

async function assertNoTenantId(client, slug) {
  const { rows } = await client.query(`
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'tenant_id'
  `);
  if (rows.length > 0) {
    throw new Error(
      `[${slug}] ADR-003 FAIL: tenant_id em ${rows.map((r) => r.table_name).join(', ')}`
    );
  }
}

async function applyOne(entry) {
  const { slug, databaseUrl } = entry;
  if (!slug || !databaseUrl) {
    throw new Error('Cada cliente precisa de slug + databaseUrl');
  }
  console.log(`\n→ Client DB: ${slug}`);
  const client = new pg.Client({ connectionString: databaseUrl, ssl: entry.ssl === false ? false : undefined });
  await client.connect();
  try {
    for (const file of sqlFiles()) {
      const sql = fs.readFileSync(file, 'utf8');
      console.log(`  apply ${path.relative(root, file)}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
    await assertNoTenantId(client, slug);
    console.log(`  ✓ OK · sem tenant_id · ${slug}`);
  } finally {
    await client.end();
  }
}

async function main() {
  const { clients } = loadClients();
  if (!Array.isArray(clients) || clients.length === 0) {
    console.error('clients[] vazio');
    process.exit(1);
  }
  for (const entry of clients) {
    await applyOne(entry);
  }
  console.log('\nTodos os Client DBs provisionados (ADR-003).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
