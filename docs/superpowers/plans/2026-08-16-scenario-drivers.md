# ScenarioDrivers (P0+P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** M6 scenarios drive occupancy + rent/COGS/HC/tech factors through `applyScenarioDrivers` into the live DRE, with Tornado/KPIs derived (no literals), persisted in Operator `finance.scenario_defs`.

**Architecture:** Extend ledger items with `costBehavior`; add `ScenarioDrivers` on each scenario; pipeline applies drivers after rent/CLIA/tech and before `projectDreFromLedger`; Express CRUD on private schema `finance`; M6 sliders + live Tornado.

**Tech Stack:** TypeScript, Vitest, React (`PlannerContext`, `M6Cenarios`), Express + `pg`, Supabase Operator migrations.

**Spec:** [`docs/superpowers/specs/2026-08-16-scenario-drivers-design.md`](../specs/2026-08-16-scenario-drivers-design.md)

## Global Constraints

- CAPEX lock **R$ 207.300** — scenarios never change CAPEX
- Ad Valorem **0,10%** on service NF only — do not “fix” CPQ 20.520 in this plan
- No `tenant_id` on Client DB; Operator schema `finance` private (no anon GRANT)
- Ship loop: commit/push + apply migration Operator + Railway deploy (+ Wrangler only if Worker touched)
- P2 Mix→COGS **out of scope**
- CoA / ledger tables **out of scope** (Phase 5)

## File map

| File | Responsibility |
|---|---|
| `src/types.ts` | `CostBehavior`, `ScenarioDrivers`, extend `DreGranularItem` + `Scenario` |
| `src/core/scenarioDrivers.ts` | validate, apply, derive KPIs, tornado axes (new, keep `engine.ts` thinner) |
| `src/core/engine.ts` | export/re-export if needed; tech active from drivers via Context |
| `src/core/scenarioDrivers.test.ts` | unit tests (new) |
| `src/data/initialData.ts` | `costBehavior` on seed lines; `drivers` on `INITIAL_SCENARIOS` |
| `supabase/migrations/20260816140000_finance_scenario_defs.sql` | schema + table + seed |
| `src/core/operator/scenarioCatalog.ts` | PG list/upsert/delete/seed-if-empty |
| `src/core/operator/registerOperatorRoutes.ts` | REST scenarios |
| `src/context/PlannerContext.tsx` | pipeline + load/save scenarios |
| `src/components/modules/M6Cenarios.tsx` | drivers UI + live A/B + Tornado |

---

### Task 1: Types + seed `costBehavior` + default drivers

**Files:**
- Modify: `src/types.ts`
- Modify: `src/data/initialData.ts`
- Test: `src/core/scenarioDrivers.test.ts` (created in Task 2; Task 1 ends with `npm run lint`)

**Interfaces:**
- Produces: `CostBehavior`, `ScenarioDrivers`, `DEFAULT_SCENARIO_DRIVERS`, `Scenario.drivers`, `DreGranularItem.costBehavior`

- [ ] **Step 1: Extend types**

In `src/types.ts`, add and extend:

```ts
export type CostBehavior = 'variable' | 'fixed' | 'hc';

export interface ScenarioDrivers {
  occupancyRate: number;
  rentFactor: number;
  cogsVariableFactor: number;
  hcOpexFactor: number;
  techOpexActive: boolean;
}

export interface DreGranularItem {
  // ...existing fields...
  /** Omit = fixed. Used by applyScenarioDrivers. */
  costBehavior?: CostBehavior;
}

export interface Scenario {
  // ...existing fields...
  /** Source of truth for occupancy + stress factors. */
  drivers: ScenarioDrivers;
  /** Mirror of drivers.occupancyRate — keep in sync when writing. */
  occupancyRate: number;
}
```

- [ ] **Step 2: Tag seed ledger in `initialData.ts`**

Set on each `INITIAL_GRANULAR_DRE_ITEMS` row:

- `variable`: `cst-cv-posicao`, `cst-mo-terceirizada`, `cst-insumos`
- `hc`: `cst-pessoal-clt-pl`, `cst-pl-adicional`
- `fixed` (explicit): `cst-opex-maquinas`, `cst-depreciacao`, `cst-aluguel`, `cst-condominio`, all `receita` rows, and tech line when present

- [ ] **Step 3: Add drivers to `INITIAL_SCENARIOS`**

```ts
const d = (partial: Partial<ScenarioDrivers> & Pick<ScenarioDrivers, 'occupancyRate'>): ScenarioDrivers => ({
  rentFactor: 1,
  cogsVariableFactor: 1,
  hcOpexFactor: 1,
  techOpexActive: false,
  ...partial,
});

// sc-baseline: drivers: d({ occupancyRate: 0.75 })
// sc-v36: drivers: d({ occupancyRate: 0.75, techOpexActive: true })
// sc-pessimistic: drivers: d({ occupancyRate: 0.35 })
// sc-optimistic: drivers: d({ occupancyRate: 0.90 })
// keep occupancyRate mirror === drivers.occupancyRate
```

- [ ] **Step 4: Lint**

Run: `npm run lint`  
Expected: PASS (or only pre-existing errors unrelated)

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/data/initialData.ts
git commit -m "$(cat <<'EOF'
feat(finance): add ScenarioDrivers and costBehavior types

EOF
)"
```

---

### Task 2: `applyScenarioDrivers` + validation (TDD)

**Files:**
- Create: `src/core/scenarioDrivers.ts`
- Create: `src/core/scenarioDrivers.test.ts`
- Modify: `src/core/engine.ts` only if re-export needed (prefer import from `scenarioDrivers`)

**Interfaces:**
- Consumes: `DreGranularItem`, `ScenarioDrivers` from `types`
- Produces:
  - `DEFAULT_SCENARIO_DRIVERS`
  - `clampScenarioDrivers(d: ScenarioDrivers): ScenarioDrivers`
  - `assertScenarioDrivers(d: unknown): ScenarioDrivers` (throws / returns error shape for API)
  - `applyScenarioDrivers(items: DreGranularItem[], drivers: ScenarioDrivers): DreGranularItem[]`
  - constants `RENT_LEDGER_IDS = ['cst-aluguel','cst-condominio']` (or import ids from engine)

- [ ] **Step 1: Write failing tests**

```ts
// src/core/scenarioDrivers.test.ts
import { describe, it, expect } from 'vitest';
import { applyScenarioDrivers, clampScenarioDrivers } from './scenarioDrivers';
import type { DreGranularItem, ScenarioDrivers } from '../types';

const baseDrivers: ScenarioDrivers = {
  occupancyRate: 0.75,
  rentFactor: 1,
  cogsVariableFactor: 1,
  hcOpexFactor: 1,
  techOpexActive: false,
};

function item(partial: Partial<DreGranularItem> & Pick<DreGranularItem, 'id' | 'section'>): DreGranularItem {
  return {
    type: 'fixo',
    category: 't',
    name: partial.id,
    monthlyAmountY1: 1000,
    monthlyAmountY2: 2000,
    active: true,
    costBehavior: 'fixed',
    ...partial,
  };
}

describe('applyScenarioDrivers', () => {
  it('scales only variable COGS by cogsVariableFactor', () => {
    const items = [
      item({ id: 'v', section: 'custo', costBehavior: 'variable', monthlyAmountY1: 1000, monthlyAmountY2: 2000 }),
      item({ id: 'f', section: 'custo', costBehavior: 'fixed', monthlyAmountY1: 1000, monthlyAmountY2: 2000 }),
      item({ id: 'h', section: 'despesa', costBehavior: 'hc', monthlyAmountY1: 1000, monthlyAmountY2: 2000 }),
    ];
    const out = applyScenarioDrivers(items, { ...baseDrivers, cogsVariableFactor: 1.2 });
    expect(out.find((i) => i.id === 'v')!.monthlyAmountY1).toBe(1200);
    expect(out.find((i) => i.id === 'v')!.monthlyAmountY2).toBe(2400);
    expect(out.find((i) => i.id === 'f')!.monthlyAmountY1).toBe(1000);
    expect(out.find((i) => i.id === 'h')!.monthlyAmountY1).toBe(1000);
  });

  it('rentFactor scales aluguel and condominio', () => {
    const items = [
      item({ id: 'cst-aluguel', section: 'despesa', monthlyAmountY1: 60000, monthlyAmountY2: 63000 }),
      item({ id: 'cst-condominio', section: 'despesa', monthlyAmountY1: 6500, monthlyAmountY2: 6500 }),
      item({ id: 'other', section: 'despesa', costBehavior: 'hc', monthlyAmountY1: 1000, monthlyAmountY2: 1000 }),
    ];
    const out = applyScenarioDrivers(items, { ...baseDrivers, rentFactor: 0.9 });
    expect(out.find((i) => i.id === 'cst-aluguel')!.monthlyAmountY1).toBe(54000);
    expect(out.find((i) => i.id === 'cst-condominio')!.monthlyAmountY1).toBe(5850);
    expect(out.find((i) => i.id === 'other')!.monthlyAmountY1).toBe(1000);
  });

  it('hcOpexFactor scales hc only', () => {
    const items = [
      item({ id: 'cst-pessoal-clt-pl', section: 'despesa', costBehavior: 'hc', monthlyAmountY1: 10000, monthlyAmountY2: 10000 }),
      item({ id: 'cst-depreciacao', section: 'despesa', costBehavior: 'fixed', monthlyAmountY1: 5000, monthlyAmountY2: 5000 }),
    ];
    const out = applyScenarioDrivers(items, { ...baseDrivers, hcOpexFactor: 1.1 });
    expect(out.find((i) => i.id === 'cst-pessoal-clt-pl')!.monthlyAmountY1).toBe(11000);
    expect(out.find((i) => i.id === 'cst-depreciacao')!.monthlyAmountY1).toBe(5000);
  });

  it('skips engineLocked and manualOverride', () => {
    const items = [
      item({
        id: 'rec-4pl-ct',
        section: 'receita',
        engineLocked: true,
        monthlyAmountY1: 6274,
        monthlyAmountY2: 9845,
      }),
      item({
        id: 'cst-insumos',
        section: 'custo',
        costBehavior: 'variable',
        manualOverride: true,
        monthlyAmountY1: 1000,
        monthlyAmountY2: 1000,
      }),
    ];
    const out = applyScenarioDrivers(items, {
      ...baseDrivers,
      cogsVariableFactor: 1.5,
      rentFactor: 0.5,
    });
    expect(out[0].monthlyAmountY1).toBe(6274);
    expect(out[1].monthlyAmountY1).toBe(1000);
  });

  it('identity factors leave amounts unchanged', () => {
    const items = [item({ id: 'v', section: 'custo', costBehavior: 'variable' })];
    const out = applyScenarioDrivers(items, baseDrivers);
    expect(out[0].monthlyAmountY1).toBe(1000);
  });
});

describe('clampScenarioDrivers', () => {
  it('clamps occupancy and factors to ranges', () => {
    const c = clampScenarioDrivers({
      occupancyRate: 2,
      rentFactor: 0.1,
      cogsVariableFactor: 9,
      hcOpexFactor: 1,
      techOpexActive: true,
    });
    expect(c.occupancyRate).toBe(1);
    expect(c.rentFactor).toBe(0.5);
    expect(c.cogsVariableFactor).toBe(1.5);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/core/scenarioDrivers.test.ts`  
Expected: FAIL (module missing)

- [ ] **Step 3: Implement `scenarioDrivers.ts`**

```ts
import type { DreGranularItem, ScenarioDrivers } from '../types';
import { CLIA_LEDGER_ITEM_ID } from './engine';

export const DEFAULT_SCENARIO_DRIVERS: ScenarioDrivers = {
  occupancyRate: 0.75,
  rentFactor: 1,
  cogsVariableFactor: 1,
  hcOpexFactor: 1,
  techOpexActive: false,
};

const RENT_IDS = new Set(['cst-aluguel', 'cst-condominio']);

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function clampScenarioDrivers(d: ScenarioDrivers): ScenarioDrivers {
  return {
    occupancyRate: clamp(d.occupancyRate, 0.05, 1),
    rentFactor: clamp(d.rentFactor, 0.5, 1.5),
    cogsVariableFactor: clamp(d.cogsVariableFactor, 0.5, 1.5),
    hcOpexFactor: clamp(d.hcOpexFactor, 0.5, 1.5),
    techOpexActive: Boolean(d.techOpexActive),
  };
}

/** API validation: returns error string or null. */
export function scenarioDriversValidationError(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return 'drivers obrigatório';
  const d = raw as Record<string, unknown>;
  const nums = ['occupancyRate', 'rentFactor', 'cogsVariableFactor', 'hcOpexFactor'] as const;
  for (const k of nums) {
    if (typeof d[k] !== 'number' || Number.isNaN(d[k] as number)) return `${k} inválido`;
  }
  if (typeof d.techOpexActive !== 'boolean') return 'techOpexActive inválido';
  const occ = d.occupancyRate as number;
  if (occ < 0.05 || occ > 1) return 'occupancyRate fora de 0.05–1.0';
  for (const k of ['rentFactor', 'cogsVariableFactor', 'hcOpexFactor'] as const) {
    const v = d[k] as number;
    if (v < 0.5 || v > 1.5) return `${k} fora de 0.5–1.5`;
  }
  return null;
}

function scale(n: number, factor: number) {
  return Math.round(n * factor);
}

export function applyScenarioDrivers(
  items: DreGranularItem[],
  drivers: ScenarioDrivers,
): DreGranularItem[] {
  const d = clampScenarioDrivers(drivers);
  return items.map((item) => {
    if (item.manualOverride) return item;
    if (item.engineLocked || item.id === CLIA_LEDGER_ITEM_ID) return item;

    if (RENT_IDS.has(item.id) && d.rentFactor !== 1) {
      return {
        ...item,
        monthlyAmountY1: scale(item.monthlyAmountY1, d.rentFactor),
        monthlyAmountY2: scale(item.monthlyAmountY2, d.rentFactor),
      };
    }

    const behavior = item.costBehavior ?? 'fixed';
    if (item.section === 'custo' && behavior === 'variable' && d.cogsVariableFactor !== 1) {
      return {
        ...item,
        monthlyAmountY1: scale(item.monthlyAmountY1, d.cogsVariableFactor),
        monthlyAmountY2: scale(item.monthlyAmountY2, d.cogsVariableFactor),
      };
    }
    if (behavior === 'hc' && d.hcOpexFactor !== 1) {
      return {
        ...item,
        monthlyAmountY1: scale(item.monthlyAmountY1, d.hcOpexFactor),
        monthlyAmountY2: scale(item.monthlyAmountY2, d.hcOpexFactor),
      };
    }
    return item;
  });
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/core/scenarioDrivers.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/scenarioDrivers.ts src/core/scenarioDrivers.test.ts
git commit -m "$(cat <<'EOF'
feat(finance): apply ScenarioDrivers to ledger lines

EOF
)"
```

---

### Task 3: `deriveScenarioKpis` + Tornado helper (TDD)

**Files:**
- Modify: `src/core/scenarioDrivers.ts`
- Modify: `src/core/scenarioDrivers.test.ts`

**Interfaces:**
- Consumes: `DreMonth[]`, `HubParams`, `projectDreFromLedger`, full pipeline inputs
- Produces:
  - `deriveScenarioKpis(dreMonths: DreMonth[], params: HubParams): { llM7Plus: number; m24Cash: number; fatorRHint: number; capexTotal: number }`
  - `computeTornadoBars(args): { factor: string; downside: number; upside: number }[]`

**KPI formulas (lock):**

- `llM7Plus` = round(mean `lucroLiquido` for months 7–12)
- `m24Cash` = round(`OFFICIAL_TOTALS_24M.saldoCaixaM24CarenciaAluguel` + (sumLL_scenario − `OFFICIAL_TOTALS_24M.lucroLiquidoTotal`))  
  — delta-anchored so baseline≈official when DRE≈official; stress scenarios move cash with LL
- `capexTotal` = `params.capex.total`
- `fatorRHint` = leave as passthrough from caller or compute later in Context (optional in helper)

- [ ] **Step 1: Failing tests for KPIs + tornado**

```ts
import { projectDreFromLedger } from './engine';
import { defaultParams } from './params';
import { deriveScenarioKpis, computeTornadoBars, applyScenarioDrivers } from './scenarioDrivers';
import { INITIAL_GRANULAR_DRE_ITEMS } from '../data/initialData';

it('deriveScenarioKpis llM7Plus is mean of M7–M12', () => {
  const months = projectDreFromLedger(INITIAL_GRANULAR_DRE_ITEMS, 0.75, defaultParams);
  const k = deriveScenarioKpis(months, defaultParams);
  const slice = months.filter((m) => m.month >= 7 && m.month <= 12);
  const mean = Math.round(slice.reduce((a, m) => a + m.lucroLiquido, 0) / slice.length);
  expect(k.llM7Plus).toBe(mean);
  expect(k.capexTotal).toBe(defaultParams.capex.total);
});

it('tornado rent ±10% moves LL without hardcoded magnitudes', () => {
  const bars = computeTornadoBars({
    items: INITIAL_GRANULAR_DRE_ITEMS,
    baseDrivers: { ...DEFAULT_SCENARIO_DRIVERS, occupancyRate: 0.75 },
    params: defaultParams,
  });
  const rent = bars.find((b) => b.factor.includes('Aluguel') || b.factor.includes('rent'));
  expect(rent).toBeTruthy();
  expect(rent!.downside).not.toBe(0);
  expect(rent!.upside).not.toBe(0);
  // magnitudes come from engine — must not equal old hardcodes
  expect(Math.abs(rent!.downside)).not.toBe(35000);
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement helpers**

`computeTornadoBars`: for each axis, clone drivers, apply ± delta (occ ±0.20 absolute capped by clamp; factors ×0.9/×1.1), run `applyScenarioDrivers` → `projectDreFromLedger`, Δ `llM7Plus` vs base. Tech axis: flip `techOpexActive` and include tech line via same path Context will use (caller may pass `withTech` items). Keep helper pure: accept already tech-patched items OR accept `params` and call `applyTechOpexToDreItems` inside when `techOpexActive`.

- [ ] **Step 4: PASS + commit**

```bash
git add src/core/scenarioDrivers.ts src/core/scenarioDrivers.test.ts
git commit -m "$(cat <<'EOF'
feat(finance): derive scenario KPIs and live Tornado bars

EOF
)"
```

---

### Task 4: Migration `finance.scenario_defs`

**Files:**
- Create: `supabase/migrations/20260816140000_finance_scenario_defs.sql`

**Interfaces:**
- Produces: schema `finance`, table `scenario_defs`, seed 4 rows

- [ ] **Step 1: Write migration**

Mirror `intranet` grants. Seed JSON drivers per spec table. `is_baseline` true only on `sc-baseline`.

Include `updated_at` trigger optional (or set in API on PUT).

- [ ] **Step 2: Apply on Operator remote (same delivery as code ship)**

Use Supabase MCP `apply_migration` on project Operator (`qrmdgvxrdvapdvmmktkj`) **or** CLI with linked project — do **not** leave SQL only in git.

- [ ] **Step 3: Commit migration file** (apply may be after API exists; at latest Task 8)

```bash
git add supabase/migrations/20260816140000_finance_scenario_defs.sql
git commit -m "$(cat <<'EOF'
chore(db): add finance.scenario_defs for ScenarioDrivers

EOF
)"
```

---

### Task 5: Operator catalog + routes

**Files:**
- Create: `src/core/operator/scenarioCatalog.ts`
- Modify: `src/core/operator/registerOperatorRoutes.ts`
- Verify: `server.ts` already calls `registerOperatorRoutes`

**Interfaces:**
- Produces:
  - `listScenarios(): Promise<ScenarioRow[]>`
  - `upsertScenario(row): Promise<void>`
  - `deleteScenario(id): Promise<{ ok: boolean; error?: string }>`
  - `ensureScenarioSeed(): Promise<void>`
- Row shape maps to `Scenario` + `drivers` jsonb

- [ ] **Step 1: Implement catalog** using same `getPool` pattern as `operatorCatalog.ts` (extract shared pool helper **only if** copy-paste pain; YAGNI otherwise — duplicate thin pool get is OK for one file).

SQL: `SELECT id, name, is_baseline, status, drivers, notes, mitigation_strategy, sort_order FROM finance.scenario_defs ORDER BY sort_order, id`

On empty list → insert seed from `INITIAL_SCENARIOS` drivers.

- [ ] **Step 2: Routes**

```ts
app.get('/api/operator/scenarios', async (_req, res) => { ... });
app.post('/api/operator/scenarios', async (req, res) => { ... });
app.put('/api/operator/scenarios/:id', async (req, res) => {
  const err = scenarioDriversValidationError(req.body?.drivers);
  if (err) return res.status(400).json({ success: false, error: err });
  ...
});
app.delete('/api/operator/scenarios/:id', async (req, res) => { ... });
```

Auth: reuse the same request identity pattern as other Operator/intranet mutating routes if present (`x-user-email` / session role). If no role on request yet, still validate drivers server-side and allow mutation (parity with current read-only Operator routes); enforce `canEditFinance` on the client UI in Task 7.

- [ ] **Step 3: Smoke locally** with Operator URL set: `GET /api/operator/scenarios` → `success: true`, ≥4 items

- [ ] **Step 4: Commit**

```bash
git add src/core/operator/scenarioCatalog.ts src/core/operator/registerOperatorRoutes.ts
git commit -m "$(cat <<'EOF'
feat(api): CRUD Operator finance.scenario_defs

EOF
)"
```

---

### Task 6: Wire `PlannerContext` pipeline

**Files:**
- Modify: `src/context/PlannerContext.tsx`
- Modify: any callers of `createNewScenario` / `duplicateScenario` to set `drivers`

**Interfaces:**
- Consumes: `applyScenarioDrivers`, `deriveScenarioKpis`, `list` via `fetch('/api/operator/scenarios')`
- Produces: `dreMonths` from full pipeline; `activeScenario` KPIs refreshed from derive; `updateScenarioDrivers(id, partial)`

- [ ] **Step 1: Pipeline order**

```ts
const occupancyDreItems = applyOccupancyToDreItems(granularDreItems, hubParams);
const techParams = {
  ...hubParams,
  techOpex: {
    ...hubParams.techOpex,
    active: activeScenario.drivers.techOpexActive,
  },
};
const techDreItems = applyTechOpexToDreItems(occupancyDreItems, techParams);
const cliaDreItems = applyCliaToDreItems(techDreItems, hubParams);
const drivenItems = applyScenarioDrivers(cliaDreItems, activeScenario.drivers);
const dreMonths = projectDreFromLedger(
  drivenItems,
  activeScenario.drivers.occupancyRate,
  hubParams,
);
```

Remove reliance on `applyScenarioPreset(activeScenarioId)` for tech **or** make preset no-op when drivers present.

- [ ] **Step 2: Boot load scenarios**

`useEffect` GET `/api/operator/scenarios` → map to `Scenario[]` (mirror `occupancyRate`); on failure keep `INITIAL_SCENARIOS`, set `scenariosSource: 'seed' | 'operator'`.

- [ ] **Step 3: Persist drivers**

`updateScenarioDrivers` updates local state + debounced PUT; sync `occupancyRate` mirror.

- [ ] **Step 4: Refresh display KPIs**

When `dreMonths` or active scenario changes, set derived `llM7Plus` / `m24Cash` / `capexTotal` onto active scenario view (or compute in `useMemo` `activeScenarioView` without mutating seed).

- [ ] **Step 5: Fix `createNewScenario` / `duplicateScenario`** to copy `drivers` and set `occupancyRate` from `drivers.occupancyRate`.

- [ ] **Step 6: `npm run test` + `npm run lint` — PASS

- [ ] **Step 7: Commit**

```bash
git add src/context/PlannerContext.tsx
git commit -m "$(cat <<'EOF'
feat(planner): drive DRE from ScenarioDrivers pipeline

EOF
)"
```

---

### Task 7: M6 UI — sliders, A/B live, Tornado live

**Files:**
- Modify: `src/components/modules/M6Cenarios.tsx`
- Use: `canEditFinance` from `src/core/rbac/moduleEdit.ts`
- Use: `computeTornadoBars` from `scenarioDrivers.ts`

- [ ] **Step 1: Delete hardcoded `tornadoData` array** (the ±125000 literals)

- [ ] **Step 2: Drivers panel** bound to `activeScenario.drivers`; disabled if `!canEditFinance(activeRole)`

- [ ] **Step 3: A/B table** use derived KPIs from two scenarios (recompute each via small helper that runs pipeline for scenario B without switching global active — pure function `projectScenario(items, drivers, params)`)

- [ ] **Step 4: Tornado chart** data = `computeTornadoBars(...)`

- [ ] **Step 5: Badge** seed vs operator from Context

- [ ] **Step 6: Manual smoke** — change rentFactor → M2 LL moves; Tornado bars non-zero and change if rent base changes

- [ ] **Step 7: Commit**

```bash
git add src/components/modules/M6Cenarios.tsx
git commit -m "$(cat <<'EOF'
feat(M6): live ScenarioDrivers sliders and Tornado

EOF
)"
```

---

### Task 8: Ship

- [ ] **Step 1:** Ensure migration applied on Operator remote
- [ ] **Step 2:** Push `main` (or PR then merge)
- [ ] **Step 3:** Railway deploy new commit
- [ ] **Step 4:** Smoke `GET https://hub.vectracargo.com.br/api/operator/scenarios`
- [ ] **Step 5:** Mark spec status already `aprovado`; update backlog audit row M6 if desired
- [ ] **Step 6:** Wrangler — **skip** unless Worker files changed

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| P0 Tornado live | 3, 7 |
| P1 ScenarioDrivers apply | 2, 6 |
| costBehavior seed | 1 |
| finance.scenario_defs | 4 |
| API CRUD | 5 |
| Planner pipeline order | 6 |
| M6 UI + RBAC | 7 |
| Fallback seed | 6 |
| CAPEX lock | 3 (capex from params) |
| No Mix P2 | — (omitted) |
| Ship apply+deploy | 8 |

## Type consistency

- `ScenarioDrivers` / `CostBehavior` defined Task 1; used Tasks 2–7
- Occupancy source: `drivers.occupancyRate` only in pipeline Task 6
- Rent ids: `cst-aluguel`, `cst-condominio` match engine constants
