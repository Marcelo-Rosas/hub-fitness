# M6 Mix & Cenários Unificado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One M6 route (“Mix & Cenários”) with Mix preview→Commit (receita + COGS variable), live Tornado from preview, M11→M6 redirect, CoA tab read-only.

**Architecture:** Approach 1 — thin shell `M6MixCenarios.tsx` reuses `M6Cenarios` + M11 panels. Pure `applyMixPreview` on ledger base before occupancy/tech/CLIA/drivers. Dual persist: drivers autosave; Mix Commit diffs only. No new SQL migration.

**Tech Stack:** React/Vite, PlannerContext, Vitest, Express Operator finance API (existing), RBAC `moduleVisibility` / `canEditFinance`.

**Spec:** [`docs/superpowers/specs/2026-08-16-m6-mix-cenarios-unificado-design.md`](../specs/2026-08-16-m6-mix-cenarios-unificado-design.md)

## Global Constraints

- CAPEX R$ 207.300 — no invent
- Ad Valorem 0,10% on service NF only (never CIF)
- No `tenant_id` on Client DB (ADR-003)
- Score = heuristic label, never “IA confidence”
- Do **not** break ScenarioDrivers autosave / `finance.scenario_defs`
- Mix scales only receita (ex-CLIA/4PL) + `custo`+`variable`; never HC/fixed
- Anti-compound: `scale = activeRatio / committedMixRatio` on **base** ledger
- Ship: git push + Railway fresh build (no Wrangler/migration unless Worker/SQL touched — none expected)

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/mixPreview.ts` | `BLEND_ALVO_MC_POS`, `weightedMcPosFromMix`, `applyMixPreview`, `diffMixPreview`, `MIX_DIRTY_EPS` |
| `src/core/mixPreview.test.ts` | Unit TDD for preview / anti-compound / diff |
| `src/context/PlannerContext.tsx` | Wire preview into pipeline; `commitMixPreview` / `discardMixPreview`; deprecate direct slider→write |
| `src/components/modules/M6MixCenarios.tsx` | Shell tabs + badge + URL `tab` sync |
| `src/components/modules/M11MixPanel.tsx` | Extract Mix UI from `M11SimuladorMix` (sliders, Commit/Discard) — **or** keep inline extract in Task 3 |
| `src/components/modules/M11SimuladorMix.tsx` | Become thin re-export / panel source; remove standalone apply-on-sync |
| `src/components/modules/M11Enquadramento.tsx` / `M11BoardMemo.tsx` | Optional extract; OK to keep JSX sections imported via props from shell |
| `src/components/modules/M11PlanoDeContas.tsx` | `readOnly?: boolean` |
| `src/components/modules/M6Cenarios.tsx` | Show Mix-pendente badge when `isMixDirty` |
| `src/App.tsx` | M6→shell; M11→redirect preserve query |
| `src/components/Shell.tsx` | Sidebar: M6 in Financeiro; drop M11 |
| `src/core/rbac/moduleVisibility.ts` | `canViewModule('M11')` → M6; drop M11 from sidebar lists |
| `src/__tests__/rbac-module-visibility.test.ts` | Redirect compat tests |
| `docs/superpowers/plans/2026-08-15-hardcode-db-backlog.md` | Point Next at this ship |

**Reuse:**
- `PlannerContext` pipeline (~`applyOccupancy` → tech → CLIA → `applyScenarioDrivers`)
- `persistJson` + `scheduleFinancePersist` for Commit PUTs
- `INITIAL_GRANULAR_DRE_ITEMS` fixtures in tests

**Handoff IDE Agent:** execute Tasks 1→6 in order; stop after each Commit for review gate if using subagent-driven-development.

---

### Task 1: Pure `applyMixPreview` + tests (TDD)

**Files:**
- Create: `src/core/mixPreview.ts`
- Create: `src/core/mixPreview.test.ts`

**Interfaces:**
- Produces:
  - `BLEND_ALVO_MC_POS = 74.15`
  - `MIX_DIRTY_EPS = 0.001`
  - `weightedMcPosFromMix(mix: ClientMixWeights): number`
  - `mixRatioFromMc(weightedMcPos: number): number` → `weightedMcPos / BLEND_ALVO_MC_POS`
  - `applyMixPreview(base: DreGranularItem[], scale: number): DreGranularItem[]`
  - `diffMixPreview(preview: DreGranularItem[], base: DreGranularItem[]): DreGranularItem[]`
  - `isMixRatioDirty(activeRatio: number, committedRatio: number): boolean`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  applyMixPreview,
  diffMixPreview,
  isMixRatioDirty,
  mixRatioFromMc,
  weightedMcPosFromMix,
  BLEND_ALVO_MC_POS,
} from './mixPreview';
import type { DreGranularItem } from '../types';

const base: DreGranularItem[] = [
  {
    id: 'rec-a',
    section: 'receita',
    type: 'fixo',
    category: 'x',
    name: 'Armaz',
    monthlyAmountY1: 1000,
    monthlyAmountY2: 1100,
    active: true,
  },
  {
    id: 'rec-4pl-ct',
    section: 'receita',
    type: 'fixo',
    category: 'x',
    name: '4PL',
    monthlyAmountY1: 500,
    monthlyAmountY2: 500,
    active: true,
  },
  {
    id: 'cst-var',
    section: 'custo',
    type: 'fixo',
    category: 'x',
    name: 'CV',
    monthlyAmountY1: 200,
    monthlyAmountY2: 200,
    active: true,
    costBehavior: 'variable',
  },
  {
    id: 'cst-hc',
    section: 'despesa',
    type: 'fixo',
    category: 'x',
    name: 'HC',
    monthlyAmountY1: 400,
    monthlyAmountY2: 400,
    active: true,
    costBehavior: 'hc',
  },
  {
    id: 'cst-fix',
    section: 'custo',
    type: 'fixo',
    category: 'x',
    name: 'Fix',
    monthlyAmountY1: 300,
    monthlyAmountY2: 300,
    active: true,
    costBehavior: 'fixed',
  },
];

describe('mixPreview', () => {
  it('weightedMcPos Blend Alvo ≈ 74.15', () => {
    expect(weightedMcPosFromMix({ p1: 20, p2: 30, p4: 25, p5: 25 })).toBeCloseTo(BLEND_ALVO_MC_POS, 1);
  });

  it('scales receita + variable custo; skips 4PL, hc, fixed', () => {
    const out = applyMixPreview(base, 1.1);
    expect(out.find((i) => i.id === 'rec-a')!.monthlyAmountY1).toBe(1100);
    expect(out.find((i) => i.id === 'cst-var')!.monthlyAmountY1).toBe(220);
    expect(out.find((i) => i.id === 'rec-4pl-ct')!.monthlyAmountY1).toBe(500);
    expect(out.find((i) => i.id === 'cst-hc')!.monthlyAmountY1).toBe(400);
    expect(out.find((i) => i.id === 'cst-fix')!.monthlyAmountY1).toBe(300);
  });

  it('anti-compound: scale 1 returns same amounts', () => {
    const out = applyMixPreview(base, 1);
    expect(out.find((i) => i.id === 'rec-a')!.monthlyAmountY1).toBe(1000);
  });

  it('diffMixPreview returns only changed ids', () => {
    const preview = applyMixPreview(base, 1.1);
    const changed = diffMixPreview(preview, base);
    expect(changed.map((c) => c.id).sort()).toEqual(['cst-var', 'rec-a']);
  });

  it('isMixRatioDirty', () => {
    expect(isMixRatioDirty(1.1, 1)).toBe(true);
    expect(isMixRatioDirty(1.0000001, 1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/core/mixPreview.test.ts
```

- [ ] **Step 3: Implement `src/core/mixPreview.ts`**

```ts
import type { ClientMixWeights, DreGranularItem } from '../types';

export const BLEND_ALVO_MC_POS = 74.15;
export const MIX_DIRTY_EPS = 0.001;

export function weightedMcPosFromMix(mix: ClientMixWeights): number {
  const w1 = mix.p1 / 100;
  const w2 = mix.p2 / 100;
  const w4 = mix.p4 / 100;
  const w5 = mix.p5 / 100;
  return Number((w1 * 52.5 + w2 * 78.0 + w4 * 67.0 + w5 * 94.0).toFixed(2));
}

export function mixRatioFromMc(weightedMcPos: number): number {
  return weightedMcPos / BLEND_ALVO_MC_POS;
}

export function isMixRatioDirty(activeRatio: number, committedRatio: number): boolean {
  return Math.abs(activeRatio - committedRatio) > MIX_DIRTY_EPS;
}

export function applyMixPreview(base: DreGranularItem[], scale: number): DreGranularItem[] {
  if (Math.abs(scale - 1) < MIX_DIRTY_EPS) return base.map((i) => ({ ...i }));
  return base.map((item) => {
    if (item.engineLocked) return item;
    if (item.section === 'receita' && item.id !== 'rec-4pl-ct') {
      return {
        ...item,
        monthlyAmountY1: Math.round(item.monthlyAmountY1 * scale),
        monthlyAmountY2: Math.round(item.monthlyAmountY2 * scale),
      };
    }
    if (item.section === 'custo' && item.costBehavior === 'variable') {
      return {
        ...item,
        monthlyAmountY1: Math.round(item.monthlyAmountY1 * scale),
        monthlyAmountY2: Math.round(item.monthlyAmountY2 * scale),
      };
    }
    return item;
  });
}

export function diffMixPreview(
  preview: DreGranularItem[],
  base: DreGranularItem[],
): DreGranularItem[] {
  const byId = new Map(base.map((b) => [b.id, b]));
  return preview.filter((p) => {
    const b = byId.get(p.id);
    if (!b) return true;
    return p.monthlyAmountY1 !== b.monthlyAmountY1 || p.monthlyAmountY2 !== b.monthlyAmountY2;
  });
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/core/mixPreview.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/core/mixPreview.ts src/core/mixPreview.test.ts
git commit -m "$(cat <<'EOF'
feat(finance): add pure applyMixPreview helpers for Mix→COGS.

EOF
)"
```

---

### Task 2: Wire PlannerContext pipeline + Commit/Discard

**Files:**
- Modify: `src/context/PlannerContext.tsx`
- Test: extend `src/core/mixPreview.test.ts` **or** add `src/context/mixPreviewContext.logic` — prefer keep pure helpers; Context smoke via existing engine tests if any. Add one unit that documents `scale = active/committed` using helpers only (already Task 1). Manual checklist below.

**Interfaces:**
- Consumes: Task 1 helpers
- Produces on context value:
  - `committedMixRatio: number`
  - `committedMixWeights: ClientMixWeights`
  - `isMixDirty: boolean`
  - `previewMixItems: DreGranularItem[]`
  - `commitMixPreview: () => void`
  - `discardMixPreview: () => void`
  - Keep `applyMixToGlobalModel` as **deprecated alias** calling `commitMixPreview` after setting mix (or remove call sites in Task 3)

**Pipeline change (critical):**

Current:

```
granularDreItems → occupancy → tech → clia → drivers → projectDre
```

Target:

```
ledgerBase = granularDreItems (state)
scale = mixRatioFromMc(weightedMcPosFromMix(activeMix)) / committedMixRatio
previewMixItems = applyMixPreview(ledgerBase, scale)
pipelineInput = isMixDirty ? previewMixItems : ledgerBase
pipelineInput → occupancy → tech → clia → drivers → projectDre
```

Fator R: folha via `fatorRFolhaMensalFromLedger(granularDreItems, …)`; RBT12 from `dreMonths` (already preview-aware if pipeline uses preview).

- [ ] **Step 1: Add state + memos in PlannerContext**

```ts
const [committedMixRatio, setCommittedMixRatio] = useState(1);
const [committedMixWeights, setCommittedMixWeights] = useState<ClientMixWeights>({
  p1: 20, p2: 30, p4: 25, p5: 25, presetName: 'Blend Alvo (20/30/25/25)',
});

const activeRatio = mixRatioFromMc(weightedMcPosFromMix(activeMix));
const isMixDirty = isMixRatioDirty(activeRatio, committedMixRatio);
const scale = committedMixRatio === 0 ? 1 : activeRatio / committedMixRatio;
const previewMixItems = useMemo(
  () => applyMixPreview(granularDreItems, scale),
  [granularDreItems, scale],
);
const pipelineBase = isMixDirty ? previewMixItems : granularDreItems;
// then occupancy/tech/clia/drivers from pipelineBase — NOT from raw granular for projection
```

- [ ] **Step 2: Implement `commitMixPreview`**

```ts
const commitMixPreview = () => {
  if (pitchMode || !canEditFinance(/* activeRole */)) {
    setBlockedValueAttempt(/* … */);
    return;
  }
  const changed = diffMixPreview(previewMixItems, granularDreItems);
  setGranularDreItems(previewMixItems);
  setCommittedMixRatio(activeRatio);
  setCommittedMixWeights(activeMix);
  addAuditLog('Simulador de Mix', 'Mix Aplicado', `${changed.length} linhas; ratio ${activeRatio.toFixed(4)}`);
  for (const item of changed) {
    scheduleFinancePersist(`ledger:${item.id}`, () =>
      persistJson(`ledger ${item.name}`, `/api/operator/finance/ledger/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(/* existing ledger upsert body shape */),
      }),
    );
  }
};
```

Mirror the PUT body already used in `updateDreGranularItem` / ledger upsert in the same file.

- [ ] **Step 3: Implement `discardMixPreview`**

```ts
const discardMixPreview = () => {
  setActiveMix(committedMixWeights);
};
```

- [ ] **Step 4: Replace `applyMixToGlobalModel` body**

Either call `setActiveMix` + `commitMixPreview`, or make it throw/console deprecate and update callers in Task 3 only.

- [ ] **Step 5: Export new fields on context value + type `PlannerContextType`**

- [ ] **Step 6: Sanity — vitest helpers still green + `npx tsc --noEmit` on touched files**

```bash
npx vitest run src/core/mixPreview.test.ts src/core/engine.test.ts src/core/scenarioDrivers.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/context/PlannerContext.tsx
git commit -m "$(cat <<'EOF'
feat(finance): wire Mix preview pipeline and commitMixPreview.

EOF
)"
```

---

### Task 3: Shell `M6MixCenarios` + Mix panel Commit/Discard

**Files:**
- Create: `src/components/modules/M6MixCenarios.tsx`
- Modify: `src/components/modules/M11SimuladorMix.tsx` (stop calling `applyMixToGlobalModel` on sync; use Context preview; expose panels **or** move tab bodies into shell)
- Modify: `src/components/modules/M6Cenarios.tsx` (badge)

**Pragmatic split (allowed):** Keep enquadramento/board JSX inside `M11SimuladorMix` exported as named panels:

```ts
// M11SimuladorMix.tsx
export function M11MixSimulatorPanel() { /* sliders + KPIs + Commit/Discard */ }
export function M11EnquadramentoPanel() { /* … */ }
export function M11BoardMemoPanel() { /* … */ }
```

Shell:

```tsx
export const M6MixCenarios: React.FC = () => {
  const { isMixDirty } = usePlanner();
  const [tab, setTab] = useState<M6Tab>(readTabFromUrl() ?? 'mix');
  // sync tab ↔ ?tab=
  return (
    <div>
      {isMixDirty && <badge>⚠ Mix pendente</badge>}
      <tabs … />
      {tab === 'mix' && <M11MixSimulatorPanel />}
      {tab === 'matriz' && <M6Cenarios embed />}
      {tab === 'enquadramento' && <M11EnquadramentoPanel />}
      {tab === 'board_memo' && <M11BoardMemoPanel />}
      {tab === 'plano_contas' && <M11PlanoDeContas readOnly />}
    </div>
  );
};
```

- [ ] **Step 1: Create shell with 5 tabs; URL `tab` sync** (`mix` | `matriz` | `enquadramento` | `board_memo` | `plano_contas`)

Map legacy `simulator` → `mix` when reading URL.

- [ ] **Step 2: Refactor Mix panel**

- Local sliders write `updateActiveMix` only (no ledger write)
- Buttons: **Aplicar ao Cadastro** → `commitMixPreview()`; **Descartar** → `discardMixPreview()`
- Hide/disable when `!canEditFinance` or pitchMode
- Remove old “Sincronizar mix com DRE…” that called `applyMixToGlobalModel` immediately — replace with Commit

- [ ] **Step 3: M6Cenarios badge**

If `isMixDirty`, show amber chip near header: `⚠ Mix pendente`

Optional prop `embed?: boolean` to hide duplicate ModuleHeader chrome when inside shell (avoid double headers). Prefer shell owns ModuleHeader once.

- [ ] **Step 4: Manual UI check local** (`npm run dev`) — sliders dirty Tornado without Network PUT ledger

- [ ] **Step 5: Commit**

```bash
git add src/components/modules/M6MixCenarios.tsx src/components/modules/M11SimuladorMix.tsx src/components/modules/M6Cenarios.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add M6 Mix & Cenários shell with preview Commit.

EOF
)"
```

---

### Task 4: App redirect + Shell sidebar + RBAC

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Shell.tsx`
- Modify: `src/core/rbac/moduleVisibility.ts`
- Modify: `src/__tests__/rbac-module-visibility.test.ts`
- Modify: `src/components/TopBar.tsx` if it hardcodes M6 label

- [ ] **Step 1: App.tsx**

```tsx
case 'M6':
  return <M6MixCenarios />;
case 'M11': {
  const params = new URLSearchParams(window.location.search);
  params.set('module', 'M6');
  if (params.get('tab') === 'simulator') params.set('tab', 'mix');
  window.history.replaceState(null, '', `?${params.toString()}`);
  // also setActiveModule('M6') via effect inside a tiny RedirectM11 component
  return <RedirectM11ToM6 />;
}
```

`RedirectM11ToM6`: `useEffect(() => setActiveModule('M6'), [])` + render `<M6MixCenarios />`.

- [ ] **Step 2: Shell sidebar**

Financeiro items:

```ts
{ id: 'M2', … },
{ id: 'M3', … },
{ id: 'M4', … },
{ id: 'M5', … },
{ id: 'M6', label: 'Mix & Cenários', icon: Sliders }, // or GitCompare
{ id: 'M15', … },
```

Estratégia: only M7, M8 (remove M6).

- [ ] **Step 3: moduleVisibility**

```ts
export function canViewModule(role: UserRole, moduleId: string): boolean {
  if (moduleId === 'M11') return canViewModule(role, 'M6'); // careful: don't recurse — inline
  …
}
```

Better:

```ts
const resolved = moduleId === 'M11' ? 'M6' : moduleId;
return list.includes(resolved as ModuleId);
```

Remove `'M11'` from `ALL` array used for sidebar visibility lists **or** keep in type but filter sidebar only (Shell already drops M11 item). Keep `M11` in `ModuleId` union for deep links.

- [ ] **Step 4: Tests**

```ts
it('M11 deep-link resolves view like M6', () => {
  expect(canViewModule('cfo', 'M11')).toBe(true);
  expect(canViewModule('comercial', 'M11')).toBe(false);
  expect(canViewModule('comercial', 'M6')).toBe(false);
});
```

- [ ] **Step 5: Run**

```bash
npx vitest run src/__tests__/rbac-module-visibility.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/Shell.tsx src/core/rbac/moduleVisibility.ts src/__tests__/rbac-module-visibility.test.ts
git commit -m "$(cat <<'EOF'
feat(nav): route M11 to unified M6 and move sidebar entry.

EOF
)"
```

---

### Task 5: CoA readOnly + copy polish

**Files:**
- Modify: `src/components/modules/M11PlanoDeContas.tsx`
- Modify: any leftover “Módulo M11” strings in panels → “M6 · Mix”

- [ ] **Step 1: Add prop**

```tsx
export const M11PlanoDeContas: React.FC<{ readOnly?: boolean }> = ({ readOnly = false }) => {
```

When `readOnly`: hide create/edit/delete/simulator mutation controls; keep tree + flag badges.

- [ ] **Step 2: Shell passes `readOnly`**

- [ ] **Step 3: Commit**

```bash
git add src/components/modules/M11PlanoDeContas.tsx src/components/modules/M6MixCenarios.tsx
git commit -m "$(cat <<'EOF'
feat(ui): make M6 CoA tab read-only; CRUD stays on M3.

EOF
)"
```

---

### Task 6: Ship + smoke + backlog pointer

**Files:**
- Modify: `docs/superpowers/plans/2026-08-15-hardcode-db-backlog.md` (Next → this plan done)
- Optional: `.superpowers/sdd/progress.md` if used

- [ ] **Step 1: Full vitest slice**

```bash
npx vitest run src/core/mixPreview.test.ts src/core/engine.test.ts src/core/scenarioDrivers.test.ts src/core/operator/financeMappers.test.ts src/__tests__/rbac-module-visibility.test.ts
```

- [ ] **Step 2: Push + Railway fresh deploy** (commit `a843d8f`-style loop)

```bash
git push origin HEAD
# Railway agent / dashboard: deploy latest main (new build, not redeploy-old)
```

- [ ] **Step 3: Smoke live** (`https://hub.vectracargo.com.br`)

Checklist:
1. Sidebar: “Mix & Cenários” under Financeiro; no M11
2. `?module=M11&tab=enquadramento` → M6 + enquadramento
3. Mix sliders → badge + Tornado move; Network **no** ledger PUT until Commit
4. Commit → PUTs only changed lines; reload keeps amounts; badge clear
5. Discard → badge clear; Tornado back
6. CoA tab: no edit controls
7. Drivers still autosave scenarios

- [ ] **Step 4: Mark backlog Next**

In `2026-08-15-hardcode-db-backlog.md`:

```md
**Now:** M6 Mix & Cenários unificado shipped (spec 2026-08-16).
**Next:** Ad Valorem CPQ / v1.1 custos bottom-up / Ponte B — se pedido.
```

- [ ] **Step 5: Final docs commit if backlog edited**

```bash
git add docs/superpowers/plans/2026-08-15-hardcode-db-backlog.md
git commit -m "$(cat <<'EOF'
docs: mark M6 Mix & Cenários unified plan as shipped next pointer.

EOF
)"
git push origin HEAD
```

---

## Self-review (plan)

- Spec coverage: preview B, shell A, tabs, CoA RO, dual persist, anti-compound, diff Commit, redirect+tab, RBAC, badge, ship — all tasked
- No placeholders / TBD
- Types: `ClientMixWeights`, `DreGranularItem`, tab ids match spec
- No migration/Worker tasks (correct)
- `applyMixToGlobalModel` removed from slider path in Task 3

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-08-16-m6-mix-cenarios-unificado.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task + review gates (`superpowers:subagent-driven-development`)
2. **Inline Execution** — this session with `executing-plans`, checkpoints between tasks

**Which approach?**
