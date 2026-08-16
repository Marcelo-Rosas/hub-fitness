# Phase 5 CoA + Ledger + Cost Centers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Persist CoA, cost centers, and DRE ledger lines in Operator `finance.*` so M3/M11 edits survive reload and feed ScenarioDrivers.

**Architecture:** Three tables (`chart_accounts`, `cost_centers`, `ledger_lines`) + `financeCatalog.ts` Express API (mirror `scenarioCatalog.ts`) + `GET /bundle` seed-if-empty from TS + PlannerContext boot/autosave debounce ~300ms + source badge on M3/M11.

**Tech Stack:** PostgreSQL Operator (`qrmdgvxrdvapdvmmktkj`), Express (`registerOperatorRoutes`), React/Vite PlannerContext, Vitest, `pg`.

**Spec:** [`docs/superpowers/specs/2026-08-16-finance-coa-ledger-design.md`](../specs/2026-08-16-finance-coa-ledger-design.md)

## Global Constraints

- CAPEX R$ 207.300 — no invent
- Ad Valorem 0,10% on service NF only
- No `tenant_id` on Client DB (ADR-003); Operator tables also omit tenant for now
- Score = heuristic label, never “IA confidence”
- Do not alter `finance.scenario_defs` or ScenarioDrivers pipeline order
- `cost_behavior` must round-trip for `applyScenarioDrivers`
- Engine-locked CLIA: persist meta; amounts recalculated in pipeline
- Ship loop: git push + apply migration Operator + Railway (+ Wrangler only if Worker)

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260816150000_finance_coa_ledger.sql` | DDL 3 tables + grants |
| `src/core/operator/financeMappers.ts` | AccountItem / CostCenter / DreGranularItem ↔ row |
| `src/core/operator/financeCatalog.ts` | PG CRUD + seed-if-empty + delete-in-use guard |
| `src/core/operator/registerOperatorRoutes.ts` | Mount `/api/operator/finance/*` |
| `src/core/operator/financeMappers.test.ts` | Round-trip + validation helpers |
| `src/core/operator/financeCatalog.test.ts` | Pure helpers (seed decide, in-use check) if extracted |
| `src/context/PlannerContext.tsx` | Boot bundle; autosave CRUD; `financeSource` |
| `src/components/modules/M3CadastroFinanceiro.tsx` | Badge fonte |
| `src/components/modules/M11Contabilidade.tsx` | Badge fonte |
| `docs/superpowers/plans/2026-08-15-hardcode-db-backlog.md` | Mark Phase 5 done after ship |

Reuse patterns from:
- `src/core/operator/scenarioCatalog.ts`
- `supabase/migrations/20260816140000_finance_scenario_defs.sql`
- PlannerContext scenario boot/save (~lines with `scenariosSource`, debounce)

---

> **Status execução (2026-08-16):** Tasks 1–6 **complete** em `main` (`90ba2f1` → `56d5548` → `5d80f25`). Migration Operator aplicada; Railway deploy `5d80f25`. Desvio: flags CoA = `AccountItem` real; badge M11 em `M11PlanoDeContas.tsx`.

### Task 1: Migration DDL

**Files:**
- Create: `supabase/migrations/20260816150000_finance_coa_ledger.sql`

**Interfaces:**
- Produces: empty tables `finance.chart_accounts`, `finance.cost_centers`, `finance.ledger_lines` with grants matching `scenario_defs`

- [x] **Step 1: Write migration**

```sql
-- finance CoA + cost centers + ledger lines (Phase 5)
-- Grants: postgres + service_role only (no anon/authenticated Data API)

CREATE TABLE IF NOT EXISTS finance.chart_accounts (
  code text PRIMARY KEY,
  name text NOT NULL,
  level int NOT NULL CHECK (level BETWEEN 1 AND 4),
  grp text NOT NULL,
  nature text NOT NULL,
  type text NOT NULL,
  is_fator_r boolean NOT NULL DEFAULT false,
  is_das boolean NOT NULL DEFAULT false,
  is_capex boolean NOT NULL DEFAULT false,
  cost_center_id text,
  notes text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance.cost_centers (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  scope text NOT NULL DEFAULT '',
  recommended_kpi text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance.ledger_lines (
  id text PRIMARY KEY,
  section text NOT NULL CHECK (section IN ('receita', 'custo', 'despesa')),
  item_type text NOT NULL,
  category text NOT NULL DEFAULT '',
  name text NOT NULL,
  monthly_amount_y1 numeric NOT NULL DEFAULT 0,
  monthly_amount_y2 numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  account_code text,
  cost_center_id text,
  cost_behavior text CHECK (cost_behavior IS NULL OR cost_behavior IN ('variable', 'fixed', 'hc')),
  engine_locked boolean NOT NULL DEFAULT false,
  manual_override boolean NOT NULL DEFAULT false,
  composition jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ledger_lines_account_code_idx
  ON finance.ledger_lines (account_code)
  WHERE account_code IS NOT NULL;

REVOKE ALL ON TABLE finance.chart_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE finance.cost_centers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE finance.ledger_lines FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE finance.chart_accounts TO postgres, service_role;
GRANT ALL ON TABLE finance.cost_centers TO postgres, service_role;
GRANT ALL ON TABLE finance.ledger_lines TO postgres, service_role;
```

Map `AccountItem` flags exactly — check `src/types.ts` for field names (`isFatorR`, `isDAS`, `isCAPEX`, `group` → column `grp`).

- [x] **Step 2: Commit**

```bash
git add supabase/migrations/20260816150000_finance_coa_ledger.sql
git commit -m "$(cat <<'EOF'
Add finance CoA, cost centers, and ledger_lines tables.

EOF
)"
```

---

### Task 2: Mappers + unit tests (TDD)

**Files:**
- Create: `src/core/operator/financeMappers.ts`
- Create: `src/core/operator/financeMappers.test.ts`
- Read: `src/types.ts` (`AccountItem`, `CostCenter`, `DreGranularItem`, `CompositionLine`)
- Read: `src/data/initialData.ts` sample rows for fixtures

**Interfaces:**
- Produces:
  - `accountToRow(a: AccountItem): ChartAccountRow`
  - `rowToAccount(r: ChartAccountRow): AccountItem`
  - `costCenterToRow` / `rowToCostCenter`
  - `ledgerToRow` / `rowToLedger`
  - `assertCostBehavior(v: unknown): 'variable'|'fixed'|'hc'|null` throws/returns error string on invalid

- [x] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  accountToRow, rowToAccount,
  costCenterToRow, rowToCostCenter,
  ledgerToRow, rowToLedger,
} from './financeMappers';
import { PLANO_DE_CONTAS_ITEMS, COST_CENTERS, INITIAL_GRANULAR_DRE_ITEMS } from '../../data/initialData';

describe('financeMappers', () => {
  it('AccountItem round-trips including group→grp', () => {
    const a = PLANO_DE_CONTAS_ITEMS[0];
    expect(rowToAccount(accountToRow(a))).toEqual(a);
  });

  it('CostCenter round-trips', () => {
    const c = COST_CENTERS[0];
    expect(rowToCostCenter(costCenterToRow(c))).toEqual(c);
  });

  it('DreGranularItem round-trips composition + costBehavior', () => {
    const item = INITIAL_GRANULAR_DRE_ITEMS.find((i) => i.composition?.length)!;
    const withBehavior = { ...item, costBehavior: 'variable' as const };
    expect(rowToLedger(ledgerToRow(withBehavior))).toEqual(withBehavior);
  });
});
```

- [x] **Step 2: Run — expect fail**

```bash
npx vitest run src/core/operator/financeMappers.test.ts
```

- [x] **Step 3: Implement mappers**

Handle:
- `group` ↔ `grp`
- `composition` jsonb parse (array default `[]`)
- numeric Y1/Y2 → Number
- omit undefined `costBehavior` ↔ null column

- [x] **Step 4: Run — expect pass**

```bash
npx vitest run src/core/operator/financeMappers.test.ts
```

- [x] **Step 5: Commit**

```bash
git add src/core/operator/financeMappers.ts src/core/operator/financeMappers.test.ts
git commit -m "$(cat <<'EOF'
Add finance entity mappers with round-trip tests.

EOF
)"
```

---

### Task 3: `financeCatalog.ts` + routes

**Files:**
- Create: `src/core/operator/financeCatalog.ts`
- Modify: `src/core/operator/registerOperatorRoutes.ts`
- Optional test: extract `needsSeed(counts)` / `accountInUse(rows, code)` pure helpers + unit test

**Interfaces:**
- Consumes: mappers; `PLANO_DE_CONTAS_ITEMS`, `COST_CENTERS`, `INITIAL_GRANULAR_DRE_ITEMS`
- Produces:
  - `listFinanceBundle(): Promise<{ accounts, costCenters, ledger } | null>`
  - `ensureFinanceSeeded(): Promise<void>` — if any of 3 tables empty, insert TS seeds
  - `upsertAccount` / `deleteAccount` (throw `{ status:409, code:'ACCOUNT_IN_USE' }` if ledger refs code)
  - `upsertCostCenter` / `deleteCostCenter`
  - `upsertLedgerLine` / `deleteLedgerLine`
  - validate `cost_behavior` → 400 message

Pool/getPool: **copy pattern from `scenarioCatalog.ts`** (shared Pool ok per-module or extract later — YAGNI: duplicate thin getPool like scenarios).

- [x] **Step 1: Implement catalog**

Seed logic:

```ts
async function ensureFinanceSeeded(pool): Promise<void> {
  const { rows: a } = await pool.query('SELECT count(*)::int AS n FROM finance.chart_accounts');
  const { rows: c } = await pool.query('SELECT count(*)::int AS n FROM finance.cost_centers');
  const { rows: l } = await pool.query('SELECT count(*)::int AS n FROM finance.ledger_lines');
  if (a[0].n > 0 && c[0].n > 0 && l[0].n > 0) return;
  // insert missing only (if accounts empty insert CoA; etc.) — prefer: if ANY empty, seed THAT table from TS; never truncate
}
```

`GET /bundle` = ensure seed → return all three lists mapped.

`DELETE /accounts/:code`:

```sql
SELECT 1 FROM finance.ledger_lines WHERE account_code = $1 LIMIT 1
```

If hit → respond 409 JSON `{ error: 'ACCOUNT_IN_USE', code }`.

- [x] **Step 2: Register routes** (same auth/middleware style as `/api/operator/scenarios`)

```
GET    /api/operator/finance/bundle
POST   /api/operator/finance/accounts
PUT    /api/operator/finance/accounts/:code
DELETE /api/operator/finance/accounts/:code
POST   /api/operator/finance/cost-centers
PUT    /api/operator/finance/cost-centers/:id
DELETE /api/operator/finance/cost-centers/:id
POST   /api/operator/finance/ledger
PUT    /api/operator/finance/ledger/:id
DELETE /api/operator/finance/ledger/:id
```

- [x] **Step 3: Smoke locally if Operator URL present** (optional) — or defer to Task 6

- [x] **Step 4: Commit**

```bash
git add src/core/operator/financeCatalog.ts src/core/operator/registerOperatorRoutes.ts
git commit -m "$(cat <<'EOF'
Add finance catalog API and Operator routes for CoA/ledger.

EOF
)"
```

---

### Task 4: Wire PlannerContext boot + autosave

**Files:**
- Modify: `src/context/PlannerContext.tsx`
- Read: existing scenario boot (`scenariosSource`, debounce `saveScenario`) as template

**Interfaces:**
- Consumes: `GET /api/operator/finance/bundle` + mutation endpoints
- Produces: `financeSource: 'operator' | 'seed'`; chart/CC/ledger state hydrated from bundle

- [x] **Step 1: Boot effect**

On mount (alongside scenarios):
1. `fetch('/api/operator/finance/bundle')`
2. OK → set `chartOfAccounts`, `costCenters`, `ledgerBaseItems` (or whatever state names exist today for INITIAL_*) + `financeSource='operator'`
3. Fail/empty → keep TS initials + `financeSource='seed'`

Do **not** wipe in-flight local edits if boot races — only apply if still at initial fingerprint OR first load flag.

- [x] **Step 2: Autosave wrappers**

For each existing mutator (`addAccount`, `updateAccount`, `deleteAccount`, CC CRUD, ledger CRUD):
1. Update React state (unchanged UX)
2. If `financeSource !== 'operator'` → skip network
3. Else debounce ~300ms keyed by entity id/code → PUT/POST
4. Delete → DELETE; on 409 account → toast/alert + revert or keep (prefer: keep local, show error “conta em uso”)

Gate: reuse `canEditFinance` if present (same as scenarios).

- [x] **Step 3: Export `financeSource` on context value**

- [x] **Step 4: Manual sanity** — `npx tsc --noEmit` or project typecheck script

- [x] **Step 5: Commit**

```bash
git add src/context/PlannerContext.tsx
git commit -m "$(cat <<'EOF'
Wire PlannerContext finance bundle boot and autosave.

EOF
)"
```

---

### Task 5: Badge M3 / M11

**Files:**
- Modify: `src/components/modules/M3CadastroFinanceiro.tsx`
- Modify: `src/components/modules/M11Contabilidade.tsx`

**Interfaces:**
- Consumes: `financeSource` from `usePlanner()`

- [x] **Step 1: Add small source chip** next to ModuleHeader title/subtitle (match ScenarioDrivers / M6 pattern if any):

- `operator` → “Fonte: Operator”
- `seed` → “Fonte: seed local”

No layout redesign.

- [x] **Step 2: Commit**

```bash
git add src/components/modules/M3CadastroFinanceiro.tsx src/components/modules/M11Contabilidade.tsx
git commit -m "$(cat <<'EOF'
Show finance Operator vs seed source on M3 and M11.

EOF
)"
```

---

### Task 6: Apply migration + ship + smoke

**Files:**
- Modify: `docs/superpowers/plans/2026-08-15-hardcode-db-backlog.md` (check Phase 5)

- [x] **Step 1: Apply migration on Operator remote**

Prefer Supabase MCP `apply_migration` on project `qrmdgvxrdvapdvmmktkj` with SQL body from Task 1, **or** `supabase db push` if linked. Confirm `list_migrations` / `\dt finance.*`.

- [x] **Step 2: Push git + Railway deploy** (new commit build)

```bash
git push origin HEAD
# Railway: deploy latest commit for hub-fitness service
```

No Wrangler unless `workers/hub-fitness-proxy/**` changed (should not).

- [x] **Step 3: Smoke live**

1. `GET https://hub.vectracargo.com.br/api/operator/finance/bundle` → 200 with accounts length ≈ CoA seed
2. Second GET → same counts (no duplicate)
3. UI: edit ledger Y1 → F5 → value persists
4. Create CoA analytical → reload → still there
5. DELETE used account → 409
6. M6 cruise still sane (ledger + DEFAULT drivers)

- [x] **Step 4: Mark backlog Phase 5 done + commit docs**

```bash
git add docs/superpowers/plans/2026-08-15-hardcode-db-backlog.md
git commit -m "$(cat <<'EOF'
Mark hardcode backlog Phase 5 CoA/ledger complete.

EOF
)"
git push
```

---

## Self-Review

1. **Spec coverage:** migration, catalog, mappers, Context, badges, ship, costBehavior, 409, seed-if-empty, fallback — covered. P2 Mix out of scope.
2. **Placeholder scan:** no TBD left; concrete SQL/API paths.
3. **Type consistency:** `grp` column ↔ `group` field; `cost_behavior` ↔ `costBehavior`; same enum as ScenarioDrivers.
4. **YAGNI:** no versioning, no FK hard, no Worker, no CoA UI redesign.

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-08-16-finance-coa-ledger.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task + review between tasks  
2. **Inline** — execute tasks in this session with executing-plans

Which approach?
