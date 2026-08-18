# Spec — Contratos Declarados (Composition Presets A–E)

**Data:** 2026-08-18  
**Status:** aprovado  
**Contexto:** Blocos M2/M5/M11/governança/M6 liam agregações diferentes (cards live vs tabela plena vs BE payroll vs Fator R ad hoc). Divergência cross-bloco era possível estruturalmente.

**URL:** `https://hub.vectracargo.com.br`

## Problema

1. **M2 cards** = `summarizeLiveDre(dreMonths)` (pipeline A) mas subtítulo dizia "mesmo contrato da tabela".
2. **M2 tabela granular** = `ledgerAmount24m` (pleno B-like com carência por mês).
3. **M2 Fator R card** = literal `28,4%` estático.
4. **M5 sim +15%** = `fatorR * 0.947` (hardcoded).
5. **M11 BE** = `computeMinViableBe` + payroll table (CCT/Mediana/CAGED) ≠ memo BP 143k/65%.
6. **Fator R** = numerador base OK (P0) mas denominador inconsistente (Context trailing vs M5 M1–12).

## Decisão M11 — Opção A (semiFixed ledger)

| Papel | Fonte |
|---|---|
| **BE do Mix (M11)** | Contrato **E** = `semiFixedOpexMonthlyFromLedger` (ledger SSOT) |
| **Payroll table (M15)** | Benchmark RH (pisos CCT/Mediana/CAGED) — **não** entra no BE |
| **M3 ledger** | SSOT contábil; folha agregada em `cst-pessoal-clt-pl` + degraus PL |

**Implicação:** Smoke BE re-âncora ~48,9% (payroll) → ~65% (semiFixed). Documentar no commit Task 5/6.

## Taxonomia — Presets de composição

Contrato = `{ stages, agg }`. `composeContract(id, ctx)` reusa pipeline existente.

| ID | Label | Stages | Agg | Consumidores |
|---|---|---|---|---|
| **A_PROJETADO** | PROJETADO c/ ramp + carência | mix→occupancy→tech→clia→drivers→project | sum24 | M2 cards, M6 KPI/Tornado, gov lucro |
| **B_CHEIO** | PLENO Y1×12 + Y2×12 | — | flat24 | M2 tabela granular |
| **C_CANONICO** | CANÔNICO BP v3.5 | — | short-circuit | Variância vs CSV; `OFFICIAL_TOTALS_24M` |
| **D_TRAILING12** | TRAILING-12 live | mix→…→project | trailing12 | Fator R denominador; M2 barra; gov-5 |
| **E_SEMIFIXO_BE** | SEMIFIXO (BE) | — | monthlySemifixo | M11 BE; memo board |

### Estágio 0 (mix)

`applyMixPreview(base, mixScale)` — já em `src/core/mixPreview.ts`. M6 unificado passa `mixScale = active/committed`.

### Pipeline estágios 1–5

Reutiliza `projectScenario` (`scenarioDrivers.ts`): occupancy → tech → clia → drivers → `projectDreFromLedger`.

### Fator R (single-source)

```ts
fatorRComposed(ctx, monthNum) =
  fatorRFolhaMensalFromLedger(ctx.base, params, monthNum) × 12
  ÷ composeContract('D_TRAILING12', ctx).rbt12
```

- **Numerador:** `ledgerBaseItems` (pré-pipeline, pré-drivers). Só `isFatorRNumerator === true` (P1 lock).
- **Numerador Y1/Y2:** mês ≤12 → Y1; mês ≥13 → Y2 (alinhamento BP M24 folha).
- **Denominador:** últimos 12 meses de receita do contrato D (pipeline completo).

## Âncoras (seed `INITIAL_GRANULAR_DRE_ITEMS`)

| Contrato | Métrica | Valor |
|---|---|---|
| B_CHEIO | receita flat24 | **5.211.204** |
| E_SEMIFIXO_BE | monthly | **143.104** |
| E_SEMIFIXO_BE | BE % (MC 74,15 / 2968 pos) | **≈ 65,0%** |
| D + numerador | Fator R composed M24 | **27,8–29,5%** (banda BP 28,01–28,70) |
| C_CANONICO | receita 24m | **4.805.700** (`OFFICIAL_TOTALS_24M`) |

### E — definição `semiFixedOpexMonthlyFromLedger`

Soma `monthlyAmountY1` de linhas **ativas** em `custo` ou `despesa` onde:

- `costBehavior === 'fixed'` **ou** `costBehavior === 'hc'`, **ou**
- `id === 'cst-mo-terceirizada'`

**Exclui:** CV/posição, insumos, receita. **Inclui:** MO terceirizada, PL adicional, folha CLT ledger.

### E′ — `fixedOpexMonthlyFromLedger` (legado)

Fixos + HC **sem** MO terc. **sem** PL adicional. **Não** usar no BE do Mix após Opção A.

## Hard locks (intocados)

- CAPEX R$ 207.300
- Ad Valorem 0,10% sobre NF de serviço (never CIF)
- Sem migration SQL / Worker nesta entrega
- M6 preview→Commit: `ContractCtx.mixScale` contempla mix dirty

## UI — ContractChip

Chip derivado de `CONTRACT_META[id]` (label + tooltip fórmula). Um chip por bloco numérico.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/core/contracts.ts` | `composeContract`, `fatorRComposed`, presets |
| `src/core/contracts.test.ts` | Âncoras + cross-preset |
| `src/core/engine.ts` | `semiFixedOpexMonthlyFromLedger`, Y1/Y2 numerador |
| `src/core/mixPreview.ts` | `applyMixPreview` (existente) |
| `src/context/PlannerContext.tsx` | Task 2: `fatorR = fatorRComposed(...)` |
| `src/components/ContractChip.tsx` | Task 3 |

## Fora de escopo desta spec (tasks 2–6)

- Rewire M2/M5/M11 UI
- Cleanup `ModuleReportGenerator` / `Shell` literais
- Smoke re-âncoras BE (Task 6, após M11 Opção A)

## Ordem de implementação

1. `contracts.ts` + engine helpers + testes (Task 1)
2. PlannerContext `fatorRComposed` (Task 2)
3. M2 + ContractChip (Task 3)
4. M5 +15% (Task 4)
5. M11 semiFixed (Task 5)
6. M6/gov chips + smoke + ship (Task 6)
