# Financeiro

## Shell
M2 DRE · M3 Cadastro · M4 Caixa · M5 Fator R · M6 Mix+Matriz (uma rota) · M11 Plano de Contas (RO; CRUD=M3) · M15 RH SC · KB (git, artigos M6 P0)

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
- **RBAC:** visão sidebar = `src/core/rbac/moduleVisibility.ts`; edição M3 = `canEditFinance` (`cfo`/`socio`). Spec: `docs/superpowers/specs/2026-08-15-rbac-module-visibility-design.md`. Mix/KB/M11: `docs/superpowers/specs/2026-08-17-knowledge-base-m6-m11-design.md`.

## Contratos de dados (1 fonte → N consumidores)

| Contrato | Fonte (Operator) | Cardinalidade | Consumidores |
|---|---|---|---|
| DRE live (M2) | `finance.ledger_lines` → `projectDreFromLedger` → `dreMonths` | CoA 1:N linhas; ocupação **5.2.02** 1:N `5.2.02.*`; CLIA **4.1.04** 1:N `4.1.04.01–04` (composition com código = filha na tabela); aluguel **5.2.02.01** carência 6m | `summarizeLiveDre`, M2 cards + tabela + granular 24m |
| Cadastro M3 | mesmas `ledger_lines` + `chart_accounts` + `cost_centers` | só **Analítica** lança; 5.2.02 sintética bloqueada | M3 CRUD |
| VAS / pisos SANCO | `vasDrivers` (memória; M14) | **não** alimenta ledger/DRE | `M3ReceitaVas` / M14 |
| Cargos / folha SC | `payrollRoles` (`PlannerContext`; seed `src/data/payrollRoles.ts`) | 1 cargo → 3 **pisos** (CCT / mediana / CAGED) × 1 HC; pack Simples **27,44%**; peril só se flag | Mix BE · M15 — **proibido** Enxuto/Original/Realista e `ROLES` no JSX. Frota = `payrollFleetAnnex.csv` (fora Mix) |
| BP v3.5 freeze | `officialData.ts` / CSV seed | fixture 1:1 totais | M1 snapshot, `summarizeOfficialDre`, testes de teto |

Planilha CSV freeze **não** alimenta M2 depois do ledger existir. Download CSV/PDF = `buildLiveDreExport` (ledger live). Drift card×tabela×CSV×PDF = bug de contrato.

## Persistência entre contratos

SSOT: `tests/smoke/finance-contracts.smoke.test.ts` + `npm run test:smoke`. Relatório: `tests/smoke/README.md`.
VAS/SANCO não entra no DRE (catálogo CPQ). Edição DRE = M3 Cadastro → ledger.

## Ponte
B billing — eventos físicos/comerciais viram `billing_records` no Operator.
