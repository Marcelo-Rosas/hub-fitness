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
| DRE live (M2) | `finance.ledger_lines` → `projectDreFromLedger` → `dreMonths` | CoA 1:N linhas; 1 série 24m : N KPIs/tabela/rodapé | `summarizeLiveDre`, M2 cards + tabela |
| Cadastro M3 | mesmas `ledger_lines` + `chart_accounts` + `cost_centers` | conta 1:N linhas; CC 1:N linhas | M3 CRUD |
| BP v3.5 freeze | `officialData.ts` / CSV seed | fixture 1:1 totais | M1 snapshot, `summarizeOfficialDre`, testes de teto |

Planilha CSV **não** alimenta M2 depois do ledger existir. Drift card×tabela = bug de contrato.

## Ponte
B billing — eventos físicos/comerciais viram `billing_records` no Operator.
