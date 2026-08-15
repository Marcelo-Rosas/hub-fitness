# Intranet Operator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parametrizar o Operator no schema Postgres `intranet` (não exposto na Data API) e substituir o atalho M19 por cadastro hierárquico + FSM + outbox, com RFQ resolvendo o aprovador na árvore.

**Architecture:** Express chama um `approvalService` transacional. Identidade = `intranet.employees` pelo e-mail da sessão. `orgResolver` sobe `sectors.parent_id` até achar `can_approve_eff`. Dispatcher no mesmo processo consome `outbox_events` e só então chama Resend. Frontend Vite nunca lê o schema `intranet`.

**Tech Stack:** Vite + React 19 + Express (`server.ts`) + TypeScript + `node:sqlite` (dev) + Supabase Postgres 15+ (Operator) + Resend (opcional).

**Spec:** [docs/superpowers/specs/2026-08-14-intranet-operator-design.md](../specs/2026-08-14-intranet-operator-design.md)

## Global Constraints

- Sem `tenant_id` em qualquer DDL (ADR-003)
- Sem NestJS, Redis, Next.js, CDC/WAL, Prisma
- `supabase/config.toml` `[api].schemas` permanece `["public", "graphql_public"]` — nunca incluir `intranet`
- Sem `GRANT` de `intranet` para `anon` / `authenticated`
- `VITE_*` só URL + publishable key; `SUPABASE_SECRET_KEY` só servidor
- Ad Valorem 0,10% sobre NF de serviço; CAPEX R$ 207.300; Konnen = dogfood
- UI em pt-BR; dropdowns de catálogo = `SearchableSelect`
- Não misturar este cadastro com a matriz salarial do M15
- Commit só se o usuário pedir

## File map

| Path | Responsabilidade |
|---|---|
| `.env.example` | `VITE_SUPABASE_*`, `SUPABASE_SECRET_KEY`, `SUPABASE_SCHEMA_INTRANET`, `INTRANET_*` |
| `supabase/config.toml` | Data API só `public` |
| `supabase/migrations/20260814160000_intranet_schema.sql` | `CREATE SCHEMA intranet` + tabelas + RLS + seed |
| `supabase/client/migrations/20260814140000_intranet_approvals.sql` | **apagar** (intranet não é Client) |
| `src/types/intranet.ts` | tipos FSM, org, request |
| `src/core/intranet/fsm.ts` | transições puras |
| `src/core/intranet/orgResolver.ts` | perms efetivas + walk da árvore |
| `src/core/intranet/intranetStore.ts` | sqlite + (depois) pg com `search_path=intranet` |
| `src/core/intranet/approvalService.ts` | submit / decide / cancel; grava outbox; **não** Resend |
| `src/core/intranet/outboxDispatcher.ts` | poll + `sendSupplierRfqEmail` |
| `src/core/intranet/registerIntranetRoutes.ts` | REST; ator da sessão |
| `src/core/intranet/sendSupplierEmail.ts` | já existe; só dispatcher chama |
| `src/components/modules/M19Intranet.tsx` | abas Fila / Árvore / Cargos / Funcionários |
| `src/components/modules/M10AssistenteCompras.tsx` | preview alçada; sem dropdown Decisor |
| `src/context/PlannerContext.tsx` | mock `compras@hubfitness.com.br` |
| `src/__tests__/intranet-rfq.test.ts` | TDD motor + resolver |
| `.agents/skills/hub-fitness/references/compras.md` | atualizar após o código |

---

### Task 1: Parametrizar env e superfície Supabase

**Files:**
- Modify: `.env.example`
- Modify: `supabase/config.toml` (só comentar que `intranet` não entra em `schemas`)
- Test: grep no repo por `VITE_SUPABASE_SECRET` (não deve existir)

- [x] **Step 1:** Em `.env.example`, após o bloco Comex, deixar explícito:

```
# Browser (Vite) — nunca secret
VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."

# Express — Operator
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_SECRET_KEY="sb_secret_..."
SUPABASE_SCHEMA_INTRANET="intranet"
# DATABASE_URL="postgresql://postgres:...@db.YOUR_PROJECT.supabase.co:5432/postgres"

# Intranet
# INTRANET_DB_PATH="data/intranet.sqlite"
# INTRANET_EMAIL_LIVE="false"
```

- [x] **Step 2:** Confirmar `[api] schemas = ["public", "graphql_public"]` em `supabase/config.toml`. Adicionar comentário: `# intranet = schema privado; não listar aqui`.

- [x] **Step 3:** Verificar que `.env` local já tem `VITE_SUPABASE_URL` + publishable e que `SUPABASE_SECRET_KEY` **não** tem prefixo `VITE_`. Não commitar `.env`.

---

### Task 2: Tipos + FSM pura (TDD)

**Files:**
- Modify: `src/types/intranet.ts`
- Create: `src/core/intranet/fsm.ts`
- Modify: `src/__tests__/intranet-rfq.test.ts`

**Interfaces:**

```ts
export type ApprovalStatus =
  | 'DRAFT' | 'IN_REVIEW' | 'CHANGES_REQUESTED'
  | 'APPROVED' | 'REJECTED' | 'CANCELED';

export type DecisionAction = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';

export function canTransition(
  from: ApprovalStatus,
  event: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'RESUBMIT' | 'CANCEL',
): boolean;

export function nextStatus(
  from: ApprovalStatus,
  event: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'RESUBMIT' | 'CANCEL',
  opts: { isLastStep: boolean },
): ApprovalStatus;
```

- [x] **Step 1:** Teste falha: `DRAFT + SUBMIT → IN_REVIEW`; `IN_REVIEW + APPROVE last → APPROVED`; `APPROVED + APPROVE` inválido; `CANCEL` recusado em `APPROVED`.

- [x] **Step 2:** Rodar `npx vitest run src/__tests__/intranet-rfq.test.ts` — FAIL.

- [x] **Step 3:** Implementar `fsm.ts` mínimo.

- [x] **Step 4:** Vitest PASS.

---

### Task 3: orgResolver (TDD)

**Files:**
- Create: `src/core/intranet/orgResolver.ts`
- Modify: `src/__tests__/intranet-rfq.test.ts`

**Interfaces:**

```ts
export function effectivePerms(input: {
  can_request: boolean;
  can_approve: boolean;
  can_request_override: boolean | null;
  can_approve_override: boolean | null;
}): { can_request: boolean; can_approve: boolean };

export function resolveApprover(input: {
  requesterId: string;
  sectors: Array<{ id: string; parent_id: string | null; head_employee_id: string | null }>;
  employees: Array<{
    id: string; sector_id: string; is_active: boolean;
    can_request: boolean; can_approve: boolean;
    can_request_override: boolean | null; can_approve_override: boolean | null;
  }>;
}): { employeeId: string; sectorId: string } | { error: 'SEM_ALCADIA' | 'SEM_PERMISSAO' };
```

- [x] **Step 1:** Testes com seed em memória: Compras (assistente request on / approve off) → sobe para FIN (CFO approve on). Override CFO `can_approve=false` → sobe para DIR (Sócio). Four-eyes: requester não entra na lista. `can_request_eff=false` → `SEM_PERMISSAO`.

- [x] **Step 2:** Vitest FAIL, implementar, PASS.

---

### Task 4: DDL Operator `intranet` (não Client)

**Files:**
- Delete: `supabase/client/migrations/20260814140000_intranet_approvals.sql`
- Create: `supabase/migrations/20260814160000_intranet_schema.sql` (localmente: `npx supabase migration new intranet_schema` e colar o SQL; não usar MCP `apply_migration` para iterar)
- Modify: `src/__tests__/adr003-database-per-client.test.ts` (já varre `supabase/migrations` — garantir que o SQL novo não tem `tenant_id`)

SQL mínimo (Postgres):

```sql
CREATE SCHEMA IF NOT EXISTS intranet;

GRANT USAGE ON SCHEMA intranet TO postgres, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA intranet TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA intranet GRANT ALL ON TABLES TO postgres, service_role;
-- NÃO grant anon/authenticated

CREATE TABLE intranet.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  parent_id uuid REFERENCES intranet.sectors(id) ON DELETE RESTRICT,
  head_employee_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE intranet.job_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  can_request boolean NOT NULL DEFAULT false,
  can_approve boolean NOT NULL DEFAULT false
);

CREATE TABLE intranet.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  sector_id uuid NOT NULL REFERENCES intranet.sectors(id),
  job_title_id uuid NOT NULL REFERENCES intranet.job_titles(id),
  reports_to uuid REFERENCES intranet.employees(id),
  can_request_override boolean,
  can_approve_override boolean,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE intranet.sectors
  ADD CONSTRAINT sectors_head_fk
  FOREIGN KEY (head_employee_id) REFERENCES intranet.employees(id) DEFERRABLE INITIALLY DEFERRED;

-- requests, assignments, decisions, audit_logs, outbox_events, workflow_defs
-- payload / configuration / state_* em jsonb
-- status TEXT com CHECK alinhado ao FSM
-- version integer NOT NULL DEFAULT 1

ALTER TABLE intranet.requests ENABLE ROW LEVEL SECURITY;
-- repetir RLS em todas as tabelas intranet.*
-- policy service_role: FOR ALL TO service_role USING (true) WITH CHECK (true)
-- sem policy para anon
```

Seed (mesma transação, `SET CONSTRAINTS ALL DEFERRED`):

- Setores: `DIR` (raiz), `FIN`, `COM`, `LOG`, `CML`, `CMX` filhos de DIR
- Cargos e toggles conforme spec
- Employees: e-mails do board + `compras@hubfitness.com.br`

- [x] **Step 1:** Apagar migration Client da intranet.

- [x] **Step 2:** Escrever DDL Operator. `npx vitest run src/__tests__/adr003-database-per-client.test.ts` PASS (zero `tenant_id`).

- [x] **Step 3:** Não adicionar `intranet` em Exposed schemas do Dashboard.

---

### Task 5: Store sqlite + approvalService + outbox

**Files:**
- Rewrite: `src/core/intranet/intranetStore.ts`
- Create: `src/core/intranet/approvalService.ts`
- Create: `src/core/intranet/outboxDispatcher.ts`
- Keep: `src/core/intranet/sendSupplierEmail.ts`

**Interfaces:**

```ts
export async function submit(input: {
  requesterEmail: string;
  title: string;
  payload: Record<string, unknown>;
}): Promise<{ request: IntranetRequestRecord } | { error: string }>;

export async function executeStepDecision(input: {
  requestId: string;
  actorEmail: string;
  action: DecisionAction;
  reason: string;
  expectedVersion: number;
}): Promise<{ request: IntranetRequestRecord } | { error: string }>;
```

Regras: uma transação = mutação + decision + assignment + audit + outbox. `executeStepDecision` **não** importa Resend. Dispatcher: `setInterval` 3s, claim `PENDING`, `WORKFLOW.APPROVED` → `sendSupplierRfqEmail`. Sem `INTRANET_EMAIL_LIVE` → `email_status=simulated`.

- [x] **Step 1:** Teste: SUBMIT do assistente cria assignment no CFO; APPROVE com `expectedVersion` velha falha; APPROVE ok gera 1 outbox e **zero** fetch a `api.resend.com` no service.

- [x] **Step 2:** Implementar store (WAL sqlite; `:memory:` nos testes) + service + dispatcher.

- [x] **Step 3:** Vitest PASS.

---

### Task 6: Rotas Express + login mock

**Files:**
- Modify: `src/core/intranet/registerIntranetRoutes.ts`
- Modify: `server.ts` (já registra rotas; bootstrap dispatcher após listen)
- Modify: `src/context/PlannerContext.tsx` + `server.ts` `MOCK_BOARD_USERS` — adicionar `compras@hubfitness.com.br` / role que consiga abrir M10 (`cfo` não; usar um id `compras` **ou** mapear o assistente com `can_request` e manter login como usuário extra com `role` que não trave M10)

Decisão de login: adicionar `UserRole` `'compras'` **só se** o Shell já deixar M10 editável. Mais simples na v1: o mock `compras@` usa `role: 'cfo'` **proibido** (quebraria four-eyes). Preferir estender `UserRole` com `'compras'` e em `PlannerContext` tratar `compras` como `canEdit` em M10, sem acesso a M2/M4.

Rotas:

- `GET /api/intranet/org-tree`
- `GET /api/intranet/resolve-approver`
- CRUD `sectors` | `job-titles` | `employees`
- `POST /api/intranet/requests` (SUBMIT)
- `POST /api/intranet/requests/:id/{approve,reject,request-changes,resubmit,cancel}`
- Body de decisão: `{ expectedVersion, reason }` — ator = e-mail da sessão (`/api/auth/me` ou o mesmo mock do login), **não** `actorRole` do client como fonte de verdade

- [x] **Step 1:** Reescrever rotas. Aprovar não chama `sendSupplierRfqEmail`.

- [x] **Step 2:** Smoke: `npx tsx` script ou vitest de integração no store (sem HTTP se flaky).

---

### Task 7: UI M19 + M10

**Files:**
- Modify: `src/components/modules/M19Intranet.tsx`
- Modify: `src/components/modules/M10AssistenteCompras.tsx`

M19 abas: Fila | Árvore | Cargos | Funcionários.

- Árvore: setores aninhados; pessoas no nó; switch Solicitar/Aprovar no funcionário (override) e no cargo (template)
- Cargos/funcionários: `SearchableSelect` para setor/cargo
- Fila: só assignment do e-mail logado (ou suplente do setor com `can_approve_eff`)
- Ações: Aprovar / Pedir correção (reason obrigatório) / Rejeitar; banner se 409 de versão

M10: remover dropdown Decisor; `GET /api/intranet/resolve-approver` mostra “Alçada resolvida: nome · cargo · setor”; botão Enviar para aprovação.

- [x] **Step 1:** Implementar UI. Reiniciar `npm run dev` (rotas Express não entram por HMR).

- [x] **Step 2:** Manual: login `compras@` → M10 RFQ → ver alçada CFO → enviar → login `cfo@` → M19 Fila → aprovar → outbox simulated.

---

### Task 8: Skills + memória

**Files:**
- Modify: `.agents/skills/hub-fitness/references/compras.md`
- Modify: `.agents/skills/hub-fitness/references/adr-003.md` (uma linha: intranet = schema Operator, não Client)
- Modify: `memory/YYYY-MM-DD.md` (home do agente)

- [x] **Step 1:** Documentar schema `intranet`, rotas, four-eyes, flag de e-mail.

---

## Ordem e aceite

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

**Aceite:**

- `npx vitest run src/__tests__/intranet-rfq.test.ts src/__tests__/adr003-database-per-client.test.ts` verde
- Data API `/rest/v1/` com publishable key **não** lista tabelas `intranet.*`
- SUBMIT do assistente não escolhe decisor; assignment cai no CFO (seed)
- APPROVE não dispara HTTP Resend sem `INTRANET_EMAIL_LIVE=true`
- Nenhuma coluna `tenant_id`

## Execução

Dois modos depois deste arquivo:

1. **Subagent-driven** — um subagente por Task, review entre tasks (`superpowers:subagent-driven-development`)
2. **Inline** — esta sessão, `superpowers:executing-plans`, checkpoints entre tasks
