# Inventário de hardcodes — HUB-FITNESS

**Data:** 2026-08-14  
**Status:** auditoria (sem refatoração neste arquivo)  
**Contexto:** o projeto migrou para **metadado + regras de cálculo** (Comex `field_defs`/`payload`, Operator/Client ADR-003, intranet cadastro, `HubParams`). Grande parte do planner ainda é **BP v3.5 petrificado em TS/UI**.

## Princípio-alvo

| Camada | Deve viver | Não deve viver |
|---|---|---|
| Premissas numéricas | `HubParams` / tabela Operator `params` versionada | Literal em `M*.tsx` |
| Séries DRE/caixa | Engine + ledger | `officialData` como KPI de tela |
| Marcos (vale, payback) | `deriveCashMilestones(series)` | `month === 'M31'` / `y={-5846}` |
| Catálogos | DB / CRUD / API | Arrays TS “oficiais” |
| Personas / alçada | `intranet.employees` | `MOCK_BOARD_USERS` + seed como identidade |
| Dogfood | `clients.is_dogfood` | Dropdown CRM/CPQ como lead |

---

## P0 — Cálculo vivo ignora params (crítico)

| Onde | Hardcode | Problema | Correção |
|---|---|---|---|
| `src/core/engine.ts` · `projectDreFromLedger` | Rampas `0.6+0.4*(m/6)` etc.; **`das = baseRev * 0.06`**; splits `0.04` / `0.035` / `0.925` | `params.pricing.dasPct` e rampas **existem e são ignorados** | Consumir `params.pricing.dasPct` + `params.ramp.*`; splits em `params.fiscal` |
| `src/context/PlannerContext.tsx` · Fator R | PL adicional `7000` / `11000` / `15000`; force baseline `28.40` | Duplica `params.fiscal`; mascara drift do ledger | Só `hubParams.fiscal`; clamp só em modo “auditoria BP” |
| `PlannerContext` · `applyFatorRTrigger` | `novoProLabore = 18500 + ajuste` com mesmos PL | Gatilho UI desconectado de params | `params.fiscal.plBaseMonthly` + `plAdditionalByPhase` |
| `PlannerContext` · `createNewScenario` | `capexTotal: 207300`; LL/caixa/Fator R por heurística linear | Cenário novo ≠ engine | Projetar via engine + ledger + occupancy |
| `src/core/engine.ts` · benchmarks | `handlingAssumed = 50`, `adValoremAssumed = 15.1`, `desovaForte = 933.13` | Benchmark fora de pricing | Derivar de `params.pricing` / fixtures versionadas |
| `src/core/params.ts` · `defaultParams` | CAPEX via oficial, `adValoremPct: 0.001`, `dasPct: 0.06`, CLIA, rent, etc. | OK se **único** SSOT; vira problema quando UI/engine não consomem | Manter SSOT; migrar depois para tabela Operator versionada |

---

## P0 — Marcos narrativos (Vale / Payback) sem classificação

| Onde | Hardcode | Problema | Correção |
|---|---|---|---|
| `M7Ano3Expansao.tsx` | `isValley: item.month === 'M31'` | Label fixo — Vale majorado (não é `argmin` do saldo) | `isValley = argmin(accumulatedCash)` (+ opcional: só se CAPEX ou fluxo &lt; 0) |
| `M7Ano3Expansao.tsx` · Y3 | `baseMonthlyNetCash = 67000`; receita `300000`; CAPEX `400000` em M29/M31; `galpaoA: 2612`; start `835488` / `733988`; forklift `4800`; alerta `>= 300000` | Ano 3 desacoplado de M24 / capacidade / params | `expansion_plan` + params; 2612 = `totalPositions × occ`; start cash do ledger M24 |
| `M1Dashboard.tsx` | Copy Vale M5 / Payback M6; `y={-207300}`; `y={-5846}`; label Payback `+R$ 52.116` | Gráfico mente se premissa muda | `deriveCashMilestones(cashflowSeries)` |
| `M4Caixa.tsx` | KPIs M5/M6/M7 fixos; ReferenceLines `x="M5"\|"M6"\|"M7"`; cards CAPEX / saldos | BP v3.5 petrificado | Milestones derivados; carência = `params.rent.carenciaAluguelMeses` |
| `Shell.tsx` footer | `RBT12: R$ 2.45M (Alvo T1)`; `Vale M31: Mitigado` | KPI fake ao lado de Fator R live | RBT12 = Σ12m DRE; Vale = flag do cenário M7 / ledger |

---

## P0 — Seeds usados como verdade de tela

| Onde | Exemplos | Correção |
|---|---|---|
| `src/data/officialData.ts` | CAPEX `207300`; série M0–M24; strings payback `"M5…"`, `"M6…"`; capacidade `2968` | Fixture de regressão / BP reference; UI **deriva** mês/valor |
| `src/data/initialData.ts` | VAS qty `2612`; Ad Valorem UI `price: 0.10` vs engine `0.001`; DRE granular snapshots; cenários `capexTotal: 207300` | Bootstrap; runtime recalc via engine |
| `M2Dre.tsx` | Breakdown M7 COGS/OPEX literais; PDF `capexTotal: 207300` | Agregar `granularDreItems` no mês 7 |
| `M5FatorR.tsx` | Banda `28.0–28.7`; copy DAS 6%; stress Anexo V inventado na UI | `params.fiscal` + tabela anexos; stress via engine |
| `M11SimuladorMix.tsx` | OPEX fixos; `pos88 = 2612`; BE vs 75% | `hubParams.capacity` + OPEX do ledger |
| `M11PlanoDeContas.tsx` / `planoDeContasData.ts` | Copy CAPEX 207.300, Fator R 28,4%, DAS 6% | Bind a `hubParams` |
| `M15RhBenchmark.tsx` | HC/salários/PL adicional / economia DAS ~R$ 270k | Catálogo RH + sync ledger `5.2.01.*` / `plAdditionalByPhase` |

---

## P1 — Domínio Comex / Compras / Intranet / Auth / ADR-003

### Comex

| Onde | Hardcode | Correção |
|---|---|---|
| `M18Comex.tsx` / `comexCatalogs.ts` | NCM default `9506.91.00`; Konnen no catálogo; portos SC | Defaults em params; clientes de Operator (`is_dogfood`) |
| `pdfExtract.ts` | Força NCM fitness → `9506.91.00`; normaliza Konnen | Mapear por CNPJ/`clients`; sem default de marca |
| `server.ts` `/api/gemini/comex-ai` | Fallback II 20%, PIS 2.1%, COFINS 9.65%, canal Verde | Fallback “sem Portal”; alíquotas só live/tabela Operator |
| `fieldDefsSeed.ts` | Bootstrap `comex_field_defs` | OK one-shot; SSOT = CRUD M18 |

### Compras

| Onde | Hardcode | Correção |
|---|---|---|
| `initialData.ts` suppliers/quotes | Ecopack, Águia, preços, ICMS | Tabela suppliers Operator / Client jsonb |
| `formCatalogs.ts` RFQ | Insumos/volumes; SP como “Galpão Principal” | Listas Operator; hub = Itajaí/Navegantes SC |
| `M10AssistenteCompras.tsx` | Insights com R$ 52/58, Scheffer, frete BR-376 | Insights de ingest/advisor; UI só renderiza |
| `examples/compras-*.json` | Clones Deep Research | Manter `example: true` / `demo_pack` |

### Intranet

| Onde | Hardcode | Correção |
|---|---|---|
| `intranetStore.ts` / migration Operator | UUIDs `a000…`/`c000…`; personas + e-mails | Seed one-shot; prod = employees + UI admin |
| `formCatalogs.ts` | `INTRANET_SECTOR_CATALOG` / `DECISION_ROLE_CATALOG` (string ≠ UUID) | Remover paralelo; carregar `/api/intranet/sectors` |

### Auth

| Onde | Hardcode | Correção |
|---|---|---|
| `server.ts` + `PlannerContext` | `MOCK_BOARD_USERS` + `hub2026` duplicado | Dev-only; prod → Auth + e-mail = `intranet.employees` |
| `LoginScreen.tsx` | Prefill senha `hub2026` | Remover default em build produção |
| `server.ts` `/api/auth/me` | Sempre retorna CFO | Sessão real / header mock alinhado ao login |

### ADR-003 / Konnen

| Onde | Hardcode | Correção |
|---|---|---|
| CRM/Comex catalogs | “Konnen (dogfood)” selecionável | Filtrar `is_dogfood` fora de CRM/CPQ |
| `M14CpqPropostas.tsx` | `totalCapacityKonnen = 2968` | Renomear `hubRackBudget` (capacidade do **hub**) |
| `M17SimuladorAnexoV.tsx` | Banner Konnen + BL Impulse fixo | Pack calibração marcado; não BE comercial |

---

## P1 — Capacity / regimes (hipóteses travadas)

| Onde | Exemplos | Correção |
|---|---|---|
| `params.ts` capacity | `targetOccupancy: 0.75`, mix `0.7/0.2/0.08/0.02`, `palletsPerFeu: 22`, `floorBudgetM2: 255` | SSOT; M7/M11 consomem |
| `feuYield.ts` / fixtures | Units/FEU por regime | Config por cliente / SKU master |
| `mixSimulatorData.ts` | Gatilho `M24 = 2612 pos` | Derivar de capacity × occupancy |

---

## Mapa rápido dos valores mais repetidos

| Valor | Papel | Status |
|---|---|---|
| CAPEX **207.300** | M0 / depreciação / copy | Params/oficial OK; UI/seeds ainda literais |
| Ad Valorem **0,10% / 0.001** | Seguro NF serviço (nunca CIF) | Params OK; UI às vezes `0.10` |
| DAS **6%** | Tributo DRE | **Crítico:** params tem, engine usa `* 0.06` literal |
| Fator R **28,x** | Regime | Params + clamp Context |
| **2612** pos | ~88% × 2968 | Hardcode M7/M11/VAS |
| Vale **M5** / **M31** | Narrativa liquidez | Hardcode de mês |
| **67k / 400k / 300k** | Y3 M7 | Só no módulo |
| **hub2026** | Auth mock | Bundle + server |

---

## O que pode continuar hardcoded (com cuidado)

- Paths oficiais PUCOMEX, regex BL `\d{2}BRZ\d{7}`
- Seeds one-shot (`fieldDefsSeed`, org intranet) **se** CRUD for SSOT depois
- Fixtures de teste / packs `example: true`
- `defaultParams` como **única** fonte numérica no código (até virar tabela Operator)
- IDs de contas ledger (`CLIA_LEDGER_ITEM_ID`, etc.) — constantes de ligação, não premissas de negócio

---

## Roadmap de correção (ordem sugerida)

1. **Engine** — DAS + rampas lêem `HubParams` — **FEITO 2026-08-14** (`projectDreFromLedger(params)`, `rampFactor`, shares fiscais).
2. **`deriveCashMilestones(series)`** — M1 / M4 / M7 / Shell — **FEITO 2026-08-14** (`src/core/cashMilestones.ts`).
3. **M7** — vale derivado + `HubParams.year3` + `YEAR3_EXPANSION_PLAN` — **FEITO 2026-08-14** (CAPEX steps ainda no plano TS; scalars em params).
4. **Context Fator R / `createNewScenario`** — **FEITO 2026-08-14** (`plAdditionalForMonth`, CAPEX de params; removido clamp 28.40 baseline).
5. **Comex-ai fallback + Konnen ADR-003 na UI.**
6. **Auth mock** fora do bundle de produção.
7. **Catálogos** (RFQ, suppliers, setores) → Operator/API.

**Padrão a replicar:** Comex (`field_defs` + `payload jsonb` + regras no servidor) para params financeiros, milestones, expansion Y3 e suppliers.

### Progresso P0 (2026-08-14)

| Item | Status |
|---|---|
| Engine `dasPct` / rampas / carência de params | ✅ |
| `deriveCashMilestones` + testes | ✅ |
| M1 / M4 marcos derivados da série | ✅ |
| M7 `isValley` = argmin (não `=== M31`) | ✅ |
| Shell RBT12 + Vale Y3 vivos | ✅ |
| Fator R / createNewScenario via params | ✅ |
| Comex-ai / Konnen / auth / catálogos | ⏳ pendente |

---

## Aceite de uma refatoração “anti-hardcode”

- Mudar `params.pricing.dasPct` altera DRE sem editar `engine.ts` literais.
- Mudar CAPEX/ocupação move Vale/Payback sem editar `M1`/`M4`/`M7` labels.
- Footer Shell RBT12 e Vale M31 batem com séries vivas.
- Konnen não aparece como lead comercial; capacidade do hub não se chama Konnen.
- `npx vitest run` (engine + adr003 + intranet) verde; Ad Valorem permanece 0,10% sobre NF de serviço; CAPEX travado R$ 207.300 até decisão explícita de mudar o BP.
