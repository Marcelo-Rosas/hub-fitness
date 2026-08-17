# Smoke — HUB-FITNESS

**Pasta:** `tests/smoke/` (`*.smoke.test.ts` por domínio).  
**Gate:** `npm run test:smoke`  
**Live:** `https://hub.vectracargo.com.br` (`SMOKE_LIVE_URL`). **Nunca** `127.0.0.1` no gate.

Unit/TDD → `src/**/*.test.ts`. Live HTTP **não** mora em `src/__tests__`.

| Arquivo | Contratos |
|---|---|
| `finance-contracts.smoke.test.ts` | CoA 5.2.02, mapper, KPIs, M3 cria+edita, CSV↔PDF sync, Operator GET/POST/PUT/DELETE, Mix Blend Alvo + piso CCT BE, KB git catalog + M11 CoA |
| `compras-research.smoke.test.ts` | POST live `/api/gemini/compras-research` 5.1.01.03 |

Fallback Gemini **sem HTTP:** `pickComprasResearchFallback` em `src/core/compras/comprasResearchPack.ts` (teste em `compras-pesquisa-e2e.test.ts`).

---

## Persistência M3 → tabelas → DRE (2026-08-17)

Única escrita humana de lançamento = **M3 Cadastro**. Plano também em **M11**. Fonte Operator: schema `finance` (sem `tenant_id`, sem Data API).

```
M3 Salvar
  → PlannerContext add/updateDreGranularItem | addChartAccount
  → debounce persistJson
  → POST/PUT /api/operator/finance/ledger | /accounts
  → financeCatalog.upsert* → PG Operator
       finance.chart_accounts  (mãe/filha CoA)
       finance.ledger_lines    (valor Y1/Y2 + account_code)
  → boot GET /api/operator/finance/bundle
  → pipeline: occupancy → tech → CLIA → ScenarioDrivers → projectDreFromLedger
  → dreMonths + granularDreItems derivados
```

**Não persiste no DRE:** `composition` JSON (Tower fee, markup…) — detalhe de fórmula na linha, não filha de tabela. VAS M14/`M3ReceitaVas` não alimenta ledger.

| Ação M3 | Tabela | Chave | O que muda |
|---|---|---|---|
| + Nova conta analítica | `finance.chart_accounts` | `code` PK | nome, level 4, type Analítica |
| + Nova linha com valor | `finance.ledger_lines` | `id` PK | `monthly_amount_y1/y2`, `account_code` |
| Editar linha existente | `finance.ledger_lines` | mesmo `id` | PUT upsert; `manual_override=true` |
| Editar nome da conta | `finance.chart_accounts` | mesmo `code` | PUT upsert |
| Apagar conta | `chart_accounts` | — | 409 se ledger usa o código |

Soft ref: `ledger_lines.account_code` → `chart_accounts.code` (índice, sem FK). 1 mãe sintética : N analíticas (prefixo `4.1.04` → `4.1.04.*`). 1 analítica : N linhas ledger. Composition **com** `accountCode` (CLIA 4.1.04.01–04) = filha na tabela/CSV/PDF. Composition **sem** código (mix P1–P5) = fórmula, não CoA.

### Smoke deste contrato

1. **Cria** analítica `4.1.04.98` + linha `smoke-m3-4pl-98` Y1=R$ 1.500 → grupo mãe `4.1.04` + DRE M7 +R$ 1.500. Mapper account+ledger round-trip.
2. **Edita** semente `rec-armazenagem` (`4.1.01.01`) Y1 +R$ 2.000 → mapper PUT + DRE M7 +R$ 2.000.
3. **Live** POST conta+linha, PUT Y1=2.500, GET bundle confirma, **DELETE** ledger depois conta (cleanup). Não edita semente de produção.
4. **CSV+PDF** mesmo `buildLiveDreExport`: TOTAL_24M = `summarizeLiveDre`; cria/edita aparece no CSV e nas células PDF. Sem meses → vazio, nunca freeze 4.805.700.

---

## M impactados

| M | Lê | Escreve | Efeito de cria/edita M3 |
|---|---|---|---|
| **M3** Cadastro | `ledgerBaseItems`, `chartOfAccounts` | ledger + CoA | origem |
| **M11** Plano | `chartOfAccounts`, `dreMonths` | CoA (M11) | nova analítica aparece; DRE Fator R se receita muda |
| **M2** DRE | `granularDreItems`, `dreMonths`, `chartOfAccounts` | — | grupo mãe/filha + KPIs 24m + tabela + variância |
| **M5** Fator R | `dreMonths`, `ledgerBaseItems` | — | RBT12 / folha se receita ou folha muda |
| **M6** Cenários | `ledgerBaseItems` | drivers (outra tabela) | tornado / Δ LL sobre ledger novo |
| **M11 Mix** | `ledgerBaseItems` | mix (memória/commit) | break-even / MC usam OPEX do ledger |
| **M9** Governança | `dreMonths`, `granularDreItems` | — | export / checks 4.1.04.01 |
| **M13** CRM | `dreMonths[0]` | — | receita M1 alvo |
| **M14** CPQ | `dreMonths[6]` | — | receita M7 alvo |
| Header / PDF / CSV | `dreMonths` + `granularDreItems` | — | **mesmo** `buildLiveDreExport` → CSV e PDF |

**Não puxa ledger live (UI freeze BP):** **M1** Dashboard gráficos, **M4** Caixa série oficial. Export CSV/PDF desses M usa DRE live. **M7** Ano 3 = plano próprio. **M10/M19** compras/intranet. **M3 VAS** ≠ DRE (catálogo CPQ).

---

### CSV ↔ PDF (2026-08-17)

Um payload: `src/utils/liveExport.ts` (`buildLiveDreExport`). Sem fallback `OFFICIAL_DRE_24M`.

1. Edita M3 → `dreMonths` + ledger mudam.
2. Download CSV (header, TopBar, modal) = meses + TOTAL_24M + Y1/Y2 + seção ledger mãe/filha.
3. Download PDF = mesmas células (BRL) + tabela ledger extra.
4. Selo: `LEDGER LIVE · finance.ledger_lines (Operator)`.

Smoke: cria `4.1.04.98` e edita `rec-armazenagem` → CSV contém código/Y1; PDF table = `formatBrlCell` dos mesmos números.

### Mix Blend Alvo + piso CCT (BE mínimo viável)

`computeMinViableBe` usa **folha da tabela de cargos SC** (M15) + OPEX sem HC. Pills **Piso CCT / Mediana SC / Média CAGED**. HC único; 3 colunas = 3 pisos.

| Mix | Folha CCT | Custo total CCT | BE CCT |
|---|---:|---:|---|
| Blend Alvo 20/30/25/25 | (piso × HC) | R$ 110.139 | **1.485 pos (50,0%)** |
| Blend Conservador 25/30/30/15 | mesma folha | R$ 110.139 | **1.557 pos (52,5%)** |

Alvo mediana 50,8% · CAGED 51,3%. Empilhadeira **sem** NR-16 default. Frota 10 motoristas = `src/data/payrollFleetAnnex.csv` (fora Mix).

## Corrida

```
npm run test:smoke   # 2026-08-17
Test Files  2 passed
Tests       25 passed
```

Inclui live POST `4.1.04.98` + PUT 2500 + DELETE cleanup + CSV↔PDF sync + Mix Blend Alvo piso CCT BE. Atualizar esta seção após cada gate.

## Supabase

Operator: 11 migrations. Sem SQL novo neste smoke.

## Ship

1. `npm run test:smoke`
2. commit + push `main`
3. Railway `up` cwd
4. Wrangler só se Worker mudou
5. `apply_migration` só se SQL novo
6. Atualizar esta seção
