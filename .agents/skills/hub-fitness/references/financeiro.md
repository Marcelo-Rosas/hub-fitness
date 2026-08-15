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

## Ponte
B billing — eventos físicos/comerciais viram `billing_records` no Operator.
