# Hardcodes + DB gaps — Implementation Plan (M1–M19 backlog)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Executar fixes mapeados e ainda pendentes nos audits `2026-08-14-hardcodes-inventory.md` e `2026-08-15-all-modules-hardcodes-db-gaps.md`, mais fase 0 da spec Plan B (ledger cotações).

**Architecture:** Prioridade por risco de alçada/pitch. Cada fase entrega software testável. Não misturar token e-mail (Plan B fase 1) até ledger existir. Financeiro: preferir ligar UI a `hubParams`/engine em vez de inventar tabelas novas nesta onda.

**Tech Stack:** Express + SQLite intranet, Vite/React, Vitest, Supabase migrations Operator.

**Sources:**  
- `docs/audits/2026-08-14-hardcodes-inventory.md` (pendentes § progresso)  
- `docs/audits/2026-08-15-all-modules-hardcodes-db-gaps.md`  
- `docs/superpowers/specs/2026-08-15-email-rfq-approve-design.md` (decisões 6–8)

## Global Constraints

- ADR-003: intranet/quotes no **Operator** (SQLite local + migration Postgres); sem `tenant_id` em Client.  
- Ad Valorem permanece 0,10% sobre NF serviço.  
- CAPEX BP 207.300 só muda com decisão explícita — tirar literais de UI, não inventar outro CAPEX.  
- Score UI: nunca rotular como confiança IA.  
- APPROVE com preço null = bloqueado.  
- Volume gap só com `ops_real_started` e ≥2 meses.

---

## File map (Fase 0)

| File | Role |
|------|------|
| `src/core/intranet/quoteLedger.ts` | upsert supplier/quote; price_type |
| `src/core/intranet/dossierGaps.ts` | gaps puros + ops flag |
| `src/core/intranet/intranetStore.ts` | tables suppliers/quotes/ops_flags |
| `supabase/migrations/20260816010000_intranet_quotes_ledger.sql` | Postgres mirror |
| `src/ingest/mapPacks.ts` | score label/heurística; persist quotes on ingest path |
| `src/core/intranet/approvalService.ts` | quote_id; block approve sem preço |
| `src/components/modules/M19Intranet.tsx` | usar dossierGaps; toggle ops; price_type |
| `src/components/modules/M10AssistenteCompras.tsx` | remover insights hardcoded |
| `src/__tests__/quote-ledger.test.ts` | TDD ledger + gaps + approve guard |

---

## Phase 0 — Quote ledger + alçada íntegra (M10/M19)

### Task 0.1 — Schema SQLite + migration

- [x] Add `suppliers`, `quotes`, `ops_flags` (or key-value) to `intranetStore` ensure  
- [x] Migration Operator SQL  
- [ ] Commit

### Task 0.2 — `dossierGaps` + ops flag

- [x] Failing tests: flag off → no volume gap on `1 un`; flag on + 90d → volume gap  
- [x] Implement helper + store get/set ops (socio-only route later)  
- [x] Wire M19 brief  
- [ ] Commit

### Task 0.3 — Quote ledger upsert

- [x] Failing tests: upsert supplier+quote from ingest-shaped row  
- [x] Implement `quoteLedger.ts`  
- [x] Hook mapPacks / research ingest path to persist estimativa  
- [ ] Commit

### Task 0.4 — Score + APPROVE guard + M10 insights

- [x] Change score to explicit heuristic name OR null in alçada brief; stop implying IA  
- [x] `executeStepDecision(APPROVE)` rejects if unit/landed null  
- [x] Replace M10 hardcoded insight bullets with data-driven or remove  
- [x] Tests green  
- [ ] Commit

---

## Phase 1 — Plan B email token (após Phase 0)

Spec: `2026-08-15-email-rfq-approve-design.md` (tokens, NOTIFY, HTML `/approve/:token`).

- [x] Plan detalhado separado ou tasks abaixo no mesmo doc  
- [x] Tables tokens (`approval_tokens` SQLite + `intranet.approval_tokens` migration)  
- [x] Mint on SUBMIT/RESUBMIT (hash-only DB; opaque raw ≥32 bytes; TTL 48h)  
- [x] Outbox `ASSIGNMENT.NOTIFY` + dispatcher + `sendAssigneeNotifyEmail`  
- [x] Routes GET/POST `/approve/:token` (parity M19 brief + 3 ações; dossierGaps; PRECO_INCOMPLETO)  
- [x] Vitest: `intranet-email-approve.test.ts` + ajustes `intranet-rfq.test.ts`  
- [ ] Commit

---

## Phase 2 — Wire Operator price/contracts (M12/M14)

- [x] M14 pisos from `price_category_items` (fallback params)  
- [x] Rename `totalCapacityKonnen` → hub capacity from params  
- [x] M12 read `contracts` when present  
- [x] Tests / manual check

---

## Phase 3 — Auth + Comex leftovers (audit 14/08 pendente)

- [x] Prefill `hub2026` only in DEV  
- [x] `/api/auth/me` mirrors session email  
- [x] Comex-ai fallback sem alíquotas inventadas como “Portal”  
- [x] Filter Konnen dogfood from CRM/CPQ selectors

---

## Phase 4 — Copy/KPI purge financeiro (M1 M2 M5 M7 M8 M9 M11 M15)

- [x] Replace remaining literal CAPEX/Payback/PL strings with params/milestones/formatters  
- [x] M9 checklist computed not all `true`  
- [x] M11 Mix capacity from `hubParams.capacity`  
- [x] M15 PL bands from `hubParams.fiscal`  
- [x] Vitest + smoke UI

---

## Phase 5 — Persist CoA/ledger (M3)

- [ ] Decide SQLite vs Operator table for chart + ledger lines  
- [ ] Persist M3 CRUD; load on boot  
- [ ] Spec/plan curto se faltar design

---

## Already done (skip)

- Engine `dasPct` / rampas / carência  
- `deriveCashMilestones` + M1/M4/M7 valley argmin + Shell RBT12  
- Fator R / createNewScenario via params (core)  
- RBAC module visibility + cadastro_contatos  

---

## Execution order

**Now:** Phase 1 Plan B done (token e-mail) — commit/push quando pedido.  
**Next session:** Phase 5 (CoA/ledger M3) ou deploy Railway se pedido.  
**Phases 2–4:** already done.
