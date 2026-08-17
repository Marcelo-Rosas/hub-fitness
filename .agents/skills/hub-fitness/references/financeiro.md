# Financeiro

## Shell
M2 DRE · M3 Cadastro · M4 Caixa · M5 Fator R · M11 Plano de Contas/Mix · M15 RH SC

## Dados (Operator DB)
`billing_records`, tax/Fator R, DRE consolidado, rollup de capacidade — nunca escrita em Client DB.

## Arquivos-chave
- `src/components/modules/M2Dre.tsx`, `M3CadastroFinanceiro.tsx`, `M4Caixa.tsx`, `M5FatorR.tsx`
- `src/context/PlannerContext.tsx` (dreMonths, hubParams)
- `src/data/officialData.ts`, `initialData.ts`

## Travas
- Ad Valorem = 0,10% sobre NF de serviço (~R$ 205/mês Y1)
- CAPEX R$ 207.300 (via `hubParams.capex.total`)
- ISS 3% = nota; **DAS** = `params.pricing.dasPct` (default 6%) — engine não usa literal
- Marcos caixa (Vale/Payback) = `deriveCashMilestones(series)` — ver `docs/audits/2026-08-14-hardcodes-inventory.md`
- Conta analítica M3: dropdown filtrado por Grupo do plano
- **RBAC:** visão sidebar = `src/core/rbac/moduleVisibility.ts`; edição M3 = `canEditFinance` (`cfo`/`socio`). Spec: `docs/superpowers/specs/2026-08-15-rbac-module-visibility-design.md`.

## Contratos de dados (1 fonte → N consumidores)

| Contrato | Fonte (Operator) | Cardinalidade | Consumidores |
|---|---|---|---|
| DRE live (M2) | `finance.ledger_lines` → `projectDreFromLedger` → `dreMonths` | CoA 1:N linhas; ocupação **5.2.02** (sintética) 1:N analíticas `5.2.02.*`; aluguel **5.2.02.01** com carência 6m | `summarizeLiveDre`, M2 cards + tabela + granular 24m |
| Cadastro M3 | mesmas `ledger_lines` + `chart_accounts` + `cost_centers` | só **Analítica** lança; 5.2.02 sintética bloqueada | M3 CRUD |
| VAS / pisos SANCO | `vasDrivers` (memória; M14) | **não** alimenta ledger/DRE | `M3ReceitaVas` / M14 |
| BP v3.5 freeze | `officialData.ts` / CSV seed | fixture 1:1 totais | M1 snapshot, `summarizeOfficialDre`, testes de teto |

Planilha CSV **não** alimenta M2 depois do ledger existir. Drift card×tabela = bug de contrato.

## Persistência entre contratos (checklist manual)

1. **M3 Cadastro** (não VAS): editar Y1 de `5.2.02.01` → PUT `/api/operator/finance/ledger/:id` → reload → mesmo valor.
2. **M2 sintético M7**: linha ocupação = rollup `5.2.02.*` (carência já passou) = soma ledger, não `hubParams.rent`.
3. **M2 granular 24m** de aluguel = `6×Y1 + 12×Y2`. Pai sintético `5.2.02` soma as analíticas.
4. **M3 VAS / SANCO**: mudar preço **não** muda DRE (catálogo CPQ). Receita kitting = linha ledger `4.1.02.01`.
5. **M6 rentFactor**: linha M3 com `accountCode` 5.2.02.01/02 (mesmo sem id `cst-*`) escala; IPTU 5.2.02.03 não.
6. Reload planner: `chart_accounts` + `ledger_lines` + `scenario_defs` batem com M2 `dreMonths`.

## Ponte
B billing — eventos físicos/comerciais viram `billing_records` no Operator.
