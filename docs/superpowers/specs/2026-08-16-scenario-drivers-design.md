# Spec — ScenarioDrivers (P0+P1): M6 × motor DRE × `finance.scenario_defs`

**Data:** 2026-08-16  
**Status:** aprovado (2026-08-16)  
**Contexto:** Análise CFO/receita mostrou cruise ledger↔engine ok, mas M6/M11 não cruzam custo/despesa de forma interativa. Tornado M6 usa literais. `Scenario` só carrega `occupancyRate` + KPIs seed. Mix (M11) escala só receita.

**URL:** `https://hub.vectracargo.com.br`

## Problema

1. **Tornado mentiroso** — barras hardcoded em `M6Cenarios.tsx`; não refletem ledger/`hubParams`.
2. **Cenário raso** — stress = quase só ocupação; aluguel, COGS variável e HC/OPEX não têm alavanca de cenário.
3. **KPIs seed** — `llM7Plus` / `m24Cash` em `INITIAL_SCENARIOS` podem divergir do `projectDreFromLedger` live.
4. **Sem persistência** — cenários só memória; audit M1/M6 pediu `scenario_defs` no Operator.

## Decisões (brainstorming)

| # | Decisão |
|---|---|
| 1 | Escopo **P0 + P1** (não P2 Mix→COGS nesta spec). |
| 2 | Persistência **Operator Postgres** nesta entrega. |
| 3 | Schema **`finance`** (privado, padrão `intranet`). |
| 4 | Migration desta entrega: **só** `finance.scenario_defs` (+ seed). CoA/ledger = Phase 5 separado, mesmo schema depois. |
| 5 | Marcação de comportamento: campo **`costBehavior`** no item de ledger (`DreGranularItem`). |
| 6 | Abordagem **1**: `applyScenarioDrivers` no pipeline **antes** de `projectDreFromLedger`; drivers no JSON do cenário. |

## Fora de escopo

- M11 Mix empurrando COGS (P2 futuro — mesmo `applyScenarioDrivers`).
- Tabelas CoA / `ledger_lines` / CRUD M3 persistido (Phase 5).
- Fila offline / sync conflict quando Operator down.
- CAPEX por cenário (lock **R$ 207.300** via `hubParams.capex.total`).
- Correção Ad Valorem CPQ R$ 20.520 vs ledger R$ 205 (bug separado).
- Snapshot completo do ledger por cenário.

## Arquitetura

### Pipeline (ordem fixa)

```
granularDreItems (seed/M3 memória; + costBehavior)
  → applyOccupancyToDreItems(hubParams)     // rent/condo base
  → applyTechOpexToDreItems(hubParams)      // se drivers.techOpexActive
  → applyCliaToDreItems(hubParams)
  → applyScenarioDrivers(items, drivers)    // NOVO
  → projectDreFromLedger(items, drivers.occupancyRate, hubParams)
  → deriveScenarioKpis(dreMonths, …)        // llM7Plus, m24Cash, fatorR display
```

**Fonte única de ocupação:** `drivers.occupancyRate`. Campo legado `Scenario.occupancyRate` vira espelho (lido/escrito junto) para não quebrar callers; UI e API só editam `drivers`.

**Tech OPEX:** ao ativar cenário, Context seta `hubParams.techOpex.active = drivers.techOpexActive` (substitui bifurcar `applyScenarioPreset` por id). v3.6 seed = `true`.

**Dupla escala (intencional):** `cogsVariableFactor` / `hcOpexFactor` / `rentFactor` ajustam **níveis do ledger**; depois `projectDreFromLedger` ainda aplica `occFactor` (e rampas) sobre totais de receita/custo. Factor ≠ ocupação: factor = stress de preço/estrutura; ocupação = volume.

### `ScenarioDrivers`

```ts
type ScenarioDrivers = {
  occupancyRate: number;       // 0.05–1.0
  rentFactor: number;          // 0.5–1.5; default 1.0
  cogsVariableFactor: number;  // 0.5–1.5; default 1.0
  hcOpexFactor: number;        // 0.5–1.5; default 1.0
  techOpexActive: boolean;     // default false
};
```

API/UI: valores fora do range → **400** / clamp na UI. Factors `1.0` = identidade (DRE igual ao baseline atual, dentro de `Math.round`).

### `applyScenarioDrivers` (regras)

| Driver | Alvo | Não alvos |
|---|---|---|
| `rentFactor` | ids `cst-aluguel`, `cst-condominio` (Y1 e Y2) | resto |
| `cogsVariableFactor` | `section === 'custo'` **e** `costBehavior === 'variable'` | `fixed`, receita, despesa, locked |
| `hcOpexFactor` | `costBehavior === 'hc'` (pessoal CLT/PL, PL adicional) | depreciação, aluguel, condo, tech, custos |
| — | `engineLocked` / `manualOverride` / CLIA | nunca multiplicar |

Receita **não** é multiplicada por factors de custo/despesa; ocupação continua no `projectDreFromLedger` via `occFactor` (receita + custo agregados do ledger já driver-ajustado).

### `costBehavior` no ledger (seed)

| Valor | Uso |
|---|---|
| `variable` | CV posição, MO terceirizada, insumos |
| `fixed` | default; máquinas; depreciação; rent/condo pós-applyOccupancy; tech; **todas receitas** |
| `hc` | `cst-pessoal-clt-pl`, `cst-pl-adicional` |
| omitido | trata como `fixed` |

Phase 5 (futuro) persiste o mesmo campo nas linhas de ledger.

### KPIs de cenário

**Fonte de verdade:** funções puras sobre `dreMonths` (+ série de caixa existente no Context/engine).  
**Não** persistir `llM7Plus` / `m24Cash` / `fatorR` / `capexTotal` como verdade no Postgres. Coluna `kpis_cache jsonb` **omitida** nesta v1 (recalc sempre).

`capexTotal` na UI de cenário = sempre `hubParams.capex.total` (207.300), não driver.

## Schema Operator

Padrão `intranet`: schema privado; **não** em `[api].schemas`; GRANT só `postgres` + `service_role`.

```sql
CREATE SCHEMA IF NOT EXISTS finance;
-- GRANT USAGE/ALL + DEFAULT PRIVILEGES → postgres, service_role

CREATE TABLE finance.scenario_defs (
  id text PRIMARY KEY,
  name text NOT NULL,
  is_baseline boolean NOT NULL DEFAULT false,
  status text NOT NULL CHECK (status IN ('ok', 'warning', 'critical')),
  drivers jsonb NOT NULL,
  notes text,
  mitigation_strategy text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Seed** (migration ou boot-if-empty): cenários atuais (`sc-baseline`, `sc-v36-wms-proprio`, `sc-pessimistic`, `sc-optimistic`) com drivers:

| id | occupancyRate | rentFactor | cogsVariableFactor | hcOpexFactor | techOpexActive |
|---|---:|---:|---:|---:|:---:|
| `sc-baseline` | 0.75 | 1.0 | 1.0 | 1.0 | false |
| `sc-v36-wms-proprio` | 0.75 | 1.0 | 1.0 | 1.0 | **true** |
| `sc-pessimistic` | 0.35 | 1.0 | 1.0 | 1.0 | false |
| `sc-optimistic` | 0.90 | 1.0 | 1.0 | 1.0 | false |

App: no máximo um `is_baseline = true` (enforce na API). Baseline **não** deletável.

## API Express (Operator)

Via `OPERATOR_DATABASE_URL` (mesmo client PG Operator).

| Método | Path | Notas |
|---|---|---|
| `GET` | `/api/operator/scenarios` | lista `sort_order`; se vazio → seed insert → lista |
| `POST` | `/api/operator/scenarios` | criar/duplicar (body: name, drivers, opcional copyFrom) |
| `PUT` | `/api/operator/scenarios/:id` | upsert meta + drivers; valida ranges |
| `DELETE` | `/api/operator/scenarios/:id` | bloqueia se `is_baseline` |

Mutação: gate `canEditFinance` (cfo/socio) quando auth de request existir; alinhado a outras rotas Operator mutáveis.

**Fallback:** GET falha → Context usa `INITIAL_SCENARIOS` + drivers default; badge “seed local”. Edits nessa sessão **não** enfileiram offline (v1).

## UI — M6

- Lista + cenário ativo.
- Painel sliders/drivers (debounce ~150ms → PUT se editável).
- Comparador A/B: dois cenários; deltas LL M7+ / caixa M24 / receita cruise **só** do engine.
- **Tornado live:** eixos fixos = ocupação (±20%), rent (±10%), cogs variável (±10%), HC (±10%), tech OPEX (cenário com `techOpexActive` invertido vs base do comparador). Valor = Δ LL M7+ vs drivers do cenário âncora (default = baseline). **Zero literais** no array tornado.
- Duplicar/criar: POST.
- Read-only: `comite` (vê M6, não PUT).

M11: **inalterado** nesta spec (P2).

## RBAC

- Visão M6: matriz existente (`moduleVisibility`) — cfo / socio / comite.
- Edit drivers/CRUD: `canEditFinance` (cfo / socio).

## Testes

1. `applyScenarioDrivers`: cogs 1.2 sobe só `variable`; fixed/hc/CLIA intactos.
2. `rentFactor` 0.9 reduz aluguel **e** condomínio.
3. `hcOpexFactor` sobe pessoal/PL; depreciação intocada.
4. Factors 1.0 + occ baseline → DRE cruise igual ao pré-change (tolerância round).
5. Occupancy 0.35 vs 0.75 → receita/custo/LL pioram no sentido esperado.
6. Helper Tornado: ±rent produz downside/upside a partir da mesma base (sem hardcode de magnitude).
7. Validação API: factor 2.0 → 400.

## Aceite

1. Tornado M6 sem literais; muda se ledger/params mudam.
2. Sliders custo/despesa alteram `dreMonths` (visível em M2).
3. `finance.scenario_defs` no Operator remoto; GET pós-deploy devolve seed.
4. PUT persiste; reload recupera drivers.
5. Operator down → fallback seed; planner sobe.
6. Ship: commit/push + **apply migration** Operator + deploy Railway (+ Wrangler só se Worker tocado).

## Ordem de build sugerida

1. Tipos `ScenarioDrivers` + `costBehavior` + seed ledger tags.
2. `applyScenarioDrivers` + `deriveScenarioKpis` + testes engine.
3. Migration `finance.scenario_defs` + seed SQL.
4. Rotas Operator + wire `PlannerContext` pipeline.
5. Refator M6 (sliders, A/B live, Tornado live).
6. Apply remoto + deploy + smoke GET `/api/operator/scenarios`.

## Relação com Phase 5

Esta spec **abre** o schema `finance`. Phase 5 (CoA/ledger) adiciona tabelas no **mesmo** schema; não recria `scenario_defs`. Ledger persistido deve carregar `costBehavior` compatível com esta spec.
