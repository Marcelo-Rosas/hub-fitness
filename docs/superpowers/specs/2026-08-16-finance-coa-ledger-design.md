# Spec — Phase 5: CoA + ledger + cost centers em `finance` (M3/M11)

**Data:** 2026-08-16  
**Status:** aprovado (2026-08-16)  
**Contexto:** Backlog hardcode Phase 5. ScenarioDrivers já abriu schema `finance` + `scenario_defs`. M3/M11 CoA e ledger DRE ainda são só memória (`PLANO_DE_CONTAS_ITEMS`, `COST_CENTERS`, `INITIAL_GRANULAR_DRE_ITEMS`) — F5 perde edições.

**Relacionada:** [`2026-08-16-scenario-drivers-design.md`](./2026-08-16-scenario-drivers-design.md) (mesmo schema; `costBehavior` compatível).

**URL:** `https://hub.vectracargo.com.br`

## Problema

1. Cadastro financeiro M3 não sobrevive reload.
2. Plano de contas / CC editados no M11 não são fonte de verdade Operator.
3. Sem persistência, ScenarioDrivers stressa um ledger que não é o “oficial” do board após edições humanas.

## Decisões (brainstorming)

| # | Decisão |
|---|---|
| 1 | Persistir **ledger + chart_accounts + cost_centers** (opção B). |
| 2 | Schema **`finance`** (já existe); sem `tenant_id`; sem expor na Data API. |
| 3 | **Autosave** debounced (~300ms) em cada CRUD (padrão ScenarioDrivers). |
| 4 | Seed **boot-if-empty** a partir do TS; depois nunca overwrite silencioso. |
| 5 | Abordagem **1**: três tabelas + catalog Express + `GET .../finance/bundle`. |

## Fora de escopo

- P2 Mix→COGS (M11).
- Histórico/versionamento de lançamentos.
- Offline queue / sync conflict.
- PostgREST / RLS para `anon`/`authenticated`.
- Mudar CAPEX 207.300 ou Ad Valorem 0,10%.

## Arquitetura

```
boot GET /api/operator/finance/bundle
  → empty? seed PLANO_DE_CONTAS + COST_CENTERS + INITIAL_GRANULAR
  → PlannerContext: chartOfAccounts, costCenters, ledgerBaseItems
CRUD M3/M11 → local state + debounce → PUT/POST/DELETE
pipeline DRE (inalterado):
  ledgerBase → occupancy → tech(drivers) → CLIA
  → applyScenarioDrivers → projectDreFromLedger
```

**Separação de papéis:**

| Camada | Fonte de verdade |
|---|---|
| Cadastro (valores Y1/Y2, contas, CC) | `finance.*` Operator |
| Stress de cenário | `finance.scenario_defs.drivers` |
| Fórmulas engine (rent/CLIA/tech) | `hubParams` + apply* em runtime |

Linhas `engineLocked` (ex. CLIA): id/meta persistem; amounts seguem recalculo do engine no pipeline (igual hoje).

## Schema

Mesmo padrão de grants de `intranet` / `scenario_defs` (só `postgres` + `service_role`).

### `finance.chart_accounts`

| Coluna | Tipo | Nota |
|---|---|---|
| `code` | text PK | ex. `4.1.01.01` |
| `name` | text NOT NULL | |
| `level` | int 1–4 | |
| `grp` | text NOT NULL | ATIVO / PASSIVO / … (evita reserved word `group`) |
| `nature` | text | Devedora \| Credora |
| `type` | text | Sintética \| Analítica |
| flags Fator R / DAS / CAPEX | boolean | mapear `AccountItem` |
| `cost_center_id` | text nullable | soft ref |
| `notes` | text | |
| `sort_order` | int | |
| `updated_at` | timestamptz | |

### `finance.cost_centers`

| Coluna | Tipo |
|---|---|
| `id` | text PK (`CC 001`) |
| `name`, `description`, `scope`, `recommended_kpi` | text |
| `updated_at` | timestamptz |

### `finance.ledger_lines`

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | text PK | ex. `rec-armazenagem` |
| `section` | text | receita \| custo \| despesa |
| `item_type` | text | map `DreGranularItem.type` |
| `category`, `name` | text | |
| `monthly_amount_y1`, `monthly_amount_y2` | numeric | |
| `active` | bool | |
| `account_code` | text soft | |
| `cost_center_id` | text soft | |
| `cost_behavior` | text nullable | `variable` \| `fixed` \| `hc` |
| `engine_locked`, `manual_override` | bool | |
| `composition` | jsonb | array composition lines |
| `notes` | text | |
| `updated_at` | timestamptz | |

Sem FK rígida ledger→account (delete guard no service via `isAccountInUse`).

## API

Base: Express + `OPERATOR_DATABASE_URL` (mesmo client PG Operator).

| Método | Path | Comportamento |
|---|---|---|
| `GET` | `/api/operator/finance/bundle` | lista 3 entidades; se qualquer tabela crítica vazia → seed TS → lista |
| `POST` | `/api/operator/finance/accounts` | cria |
| `PUT` | `/api/operator/finance/accounts/:code` | upsert |
| `DELETE` | `/api/operator/finance/accounts/:code` | 409 se ledger usa código |
| `POST/PUT/DELETE` | `/api/operator/finance/cost-centers` / `:id` | CRUD CC |
| `POST/PUT/DELETE` | `/api/operator/finance/ledger` / `:id` | CRUD linha DRE |

Validação: tipo Analítica para postagem; `cost_behavior` enum; Y1/Y2 numéricos.

Mutação: gate `canEditFinance` no client; server valida payload (paridade ScenarioDrivers).

**Fallback:** GET falha → Context usa seeds TS; `financeSource: 'seed'`; edits não enfileiram offline.

## Exemplos práticos (aceitação mental)

1. Editar `rec-armazenagem` Y1 99 000 → 105 000 → F5 → 105 000.
2. Criar conta `4.1.01.06` Analítica → aparece no dropdown M3 após reload.
3. `DELETE 4.1.01.01` com ledger apontando → 409.
4. Operator down → app sobe; badge seed; refresh perde edits da sessão.
5. `cost_behavior=variable` em insumos sobrevive round-trip; M6 `cogsVariableFactor` ainda escala só essas linhas.

## Context / UI

- `PlannerContext`: boot bundle; wire add/update/delete existentes para API; export `financeSource`.
- M3 / M11: sem redesign — só persistência + badge fonte.
- Debounce ~300ms por entidade id/code.

## Testes

1. Mapper AccountItem / CostCenter / DreGranularItem ↔ row round-trip (incl. composition + costBehavior).
2. Seed-if-empty: segunda GET não duplica rows.
3. Delete account in use → erro estruturado.
4. cost_behavior inválido → 400.
5. Smoke: ledger seed + DEFAULT drivers → cruise Y1 estável (tolerância round).

## Aceite

1. Persistência M3 ledger após reload.
2. CoA nova visível pós-reload.
3. 409 em delete conta usada.
4. Fallback seed se Operator down.
5. Ship: commit/push + apply migration Operator + Railway (+ Wrangler só se Worker).
6. `costBehavior` round-trip ok com ScenarioDrivers.

## Ordem de build

1. Migration DDL (sem seed SQL gigante obrigatório — seed no boot a partir do TS ok).
2. `financeCatalog.ts` + rotas em `registerOperatorRoutes`.
3. Mappers + testes.
4. Wire `PlannerContext` boot + autosave.
5. Badge M3/M11.
6. Apply remoto + deploy + smoke bundle.

## Relação com ScenarioDrivers

Não alterar `scenario_defs`. Ledger persistido **deve** carregar `cost_behavior` para `applyScenarioDrivers` continuar correto. Engine-locked CLIA permanece recalculado no pipeline.
