# ADR-003 Database-per-client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or implement tasks sequentially. Steps use checkbox syntax for tracking.

**Goal:** Provisionar Operator DB + Client DB sem `tenant_id`, com runner multi-DB e views de agregação somente-leitura.

**Architecture:** Dois tipos de projeto Supabase. Client DB contém domínio operacional WMS/comercial do consumidor. Operator DB contém cadastro comercial, preços, billing e FDW/foreign tables apontando para Client DBs. Isolamento = um database por cliente.

**Tech Stack:** PostgreSQL 15+ / Supabase CLI, `postgres_fdw`, Node ESM runner (`pg`), SQL idempotente.

## Global Constraints

- Sem `tenant_id` / `get_my_tenant_id()` no schema 3PL
- CAPEX R$ 207.300 · 2.968 posições inalterados
- Konnen = cliente #0 (dogfood), não âncora comercial
- Nomenclatura infraestrutura = HUB-FITNESS
- Operator nunca escreve em Client DB

---

### Task 1: Operator core schema

**Files:**
- Create: `supabase/migrations/20260813180000_operator_core.sql`
- Create: `supabase/config.toml`

- [x] **Step 1:** Criar tabelas operator (clients, contracts, price_*, tax_rates, billing_records, agent_swarm, audit_log) sem tenant_id
- [x] **Step 2:** RLS por role operador (`app_metadata.role in ('operator_admin','operator_billing')`)

### Task 2: Client provision + migrations

**Files:**
- Create: `supabase/client/provision_client_db.sql`
- Create: `supabase/client/migrations/20260813180000_client_core.sql`

- [x] **Step 1:** DDL de todas as tabelas listadas no handoff, sem tenant_id
- [x] **Step 2:** RLS intra-cliente (authenticated + service_role); zero política “tenant”

### Task 3: Runner multi-DB

**Files:**
- Create: `supabase/scripts/apply-client-migrations.mjs`
- Create: `supabase/scripts/clients.example.json`
- Modify: `package.json` (scripts db:*)

- [x] **Step 1:** Runner aplica provision + migrations em N connection strings
- [x] **Step 2:** Fail-fast se detectar coluna `tenant_id`

### Task 4: Agregação Operator (FDW + billing)

**Files:**
- Create: `supabase/migrations/20260813180100_operator_aggregation.sql`

- [x] **Step 1:** Extensão postgres_fdw + helper `register_client_fdw(...)`
- [x] **Step 2:** Views `v_capacity_rollup`, `v_control_tower_orders`, billing sync job stub (somente INSERT no Operator)

### Task 5: Docs + aceite

**Files:**
- Create: `docs/adr/ADR-003-database-per-client.md`
- Create: `supabase/README.md`

- [x] **Step 1:** Documentar reset Client / Operator e critério sem tenant_id
