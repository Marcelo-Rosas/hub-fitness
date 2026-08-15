# RBAC Module Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the approved role × module visibility and edit matrices from `docs/superpowers/specs/2026-08-15-rbac-module-visibility-design.md`.

**Architecture:** Static TypeScript matrices in `src/core/rbac/`. Shell filters sidebar via `canViewModule`. M19 hides org tabs unless `canManageOrg`. M3 (and similar) use `canEditFinance` instead of ad-hoc role ifs. API org/cadastro routes reject non-sócio actors.

**Tech Stack:** React + Vite, Vitest, Express intranet routes, existing `UserRole` type.

## Global Constraints

- Roles only: `cfo` | `socio` | `comite` | `comercial` | `compras`
- No runtime-editable matrix / Postgres flags
- No M15 → employees sync
- No email Plan B
- Commits only if user asks (default: skip commit steps)

---

### Task 1: moduleVisibility + unit tests

**Files:**
- Create: `src/core/rbac/moduleVisibility.ts`
- Create: `src/__tests__/rbac-module-visibility.test.ts`

**Interfaces:**
- Produces: `ModuleId`, `canViewModule(role: UserRole, moduleId: string): boolean`, `visibleModules(role: UserRole): ModuleId[]`, `firstVisibleModule(role: UserRole): ModuleId`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { canViewModule, visibleModules } from '../core/rbac/moduleVisibility';

describe('moduleVisibility', () => {
  it('compras não vê M2 nem M4', () => {
    expect(canViewModule('compras', 'M2')).toBe(false);
    expect(canViewModule('compras', 'M4')).toBe(false);
  });
  it('compras vê M10 e M19', () => {
    expect(canViewModule('compras', 'M10')).toBe(true);
    expect(canViewModule('compras', 'M19')).toBe(true);
  });
  it('comercial não vê M3', () => {
    expect(canViewModule('comercial', 'M3')).toBe(false);
  });
  it('cfo vê M1..M19 relevantes', () => {
    expect(canViewModule('cfo', 'M2')).toBe(true);
    expect(canViewModule('cfo', 'M19')).toBe(true);
  });
  it('visibleModules(compras) ordenado sem M2', () => {
    const list = visibleModules('compras');
    expect(list).toContain('M1');
    expect(list).not.toContain('M2');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/__tests__/rbac-module-visibility.test.ts`

- [ ] **Step 3: Implement matrix from spec table**

Encode exact ✓/— from spec into `MODULE_VISIBILITY: Record<UserRole, readonly ModuleId[]>`.

- [ ] **Step 4: Run tests — expect PASS**

---

### Task 2: moduleEdit helpers + tests

**Files:**
- Create: `src/core/rbac/moduleEdit.ts`
- Modify: `src/__tests__/rbac-module-visibility.test.ts` (or `rbac-module-edit.test.ts`)

**Interfaces:**
- Produces: `canEditFinance(role)`, `canEditCompras(role)`, `canManageOrg(role)`, `canDecideIntranet(role)`, `canEditCrm(role)`, `canInspectCells(role)` — all `(role: UserRole) => boolean`

- [ ] **Step 1: Failing tests for canManageOrg / canEditFinance**
- [ ] **Step 2: Implement helpers matching edit matrix**
- [ ] **Step 3: Tests PASS**

---

### Task 3: Wire Shell sidebar + deep-link fallback

**Files:**
- Modify: `src/components/Shell.tsx`

**Interfaces:**
- Consumes: `canViewModule`, `firstVisibleModule`

- [ ] **Step 1: Replace ad-hoc M2/M4 filter with `canViewModule(activeRole, item.id)`**
- [ ] **Step 2: If `activeModule` not visible, `setActiveModule(firstVisibleModule(activeRole))`**
- [ ] **Step 3: Manual smoke — FR-01 compras → sem M2/M4**

---

### Task 4: M19 tabs + API guard sócio

**Files:**
- Modify: `src/components/modules/M19Intranet.tsx`
- Modify: `src/core/intranet/registerIntranetRoutes.ts`

**Interfaces:**
- Consumes: `canManageOrg`, `user.role` / `user.email`

- [ ] **Step 1: Hide Árvore/Cargos/Funcionários/Cadastro unless `canManageOrg(activeRole)`; compras/cfo keep Fila**
- [ ] **Step 2: On POST/PATCH/DELETE sectors, job-titles, employees, cadastro — require actor email `socio@hubfitness.com.br` (or employee job Sócio-Fundador); else 403**
- [ ] **Step 3: Smoke — cfo não vê aba Cadastro**

---

### Task 5: M3 uses canEditFinance

**Files:**
- Modify: `src/components/modules/M3CadastroFinanceiro.tsx`

- [ ] **Step 1: Replace `activeRole === 'cfo' || activeRole === 'socio'` with `canEditFinance(activeRole) && !pitchMode`**
- [ ] **Step 2: Confirm comite can open M3 but cannot edit**

---

### Task 6: Spec status + skill note

**Files:**
- Modify: `docs/superpowers/specs/2026-08-15-rbac-module-visibility-design.md` (Status: aprovado)
- Modify: `.agents/skills/hub-fitness/references/compras.md` or add short rbac note in financeiro.md

- [ ] **Step 1: Mark spec aprovado**
- [ ] **Step 2: Document MODULE_VISIBILITY path in skill refs**

---

## Self-review

- Spec coverage: visão, edição, M19 org, API guard, M3, testes — tasks 1–5.
- No Plan B / M15 sync in tasks.
- Types: `UserRole` from `src/types.ts`; `ModuleId` = `M1`…`M19`.
