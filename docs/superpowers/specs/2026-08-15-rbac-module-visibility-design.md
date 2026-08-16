# Spec — RBAC visão de módulos + cadastro/alçada

**Data:** 2026-08-15  
**Status:** aprovado (2026-08-15)  
**Contexto:** M19 cadastro de contatos CoA já existe; FR-01 troca identidade board; sócio centraliza atribuições.

## Problema

Sidebar e edição usam ifs esparsos (`comercial`/`compras` escondem M2/M4; M3 edita só cfo/socio). Não há matriz única role × módulo, nem regra clara de quem monta org/cadastro. Cadastro de funcionários pós-contratação é manual no M19 (sem ponte M15).

## Decisões

1. **Funcionários** entram no intranet por **cadastro manual M19** (após contratação). Sem auto do M15 nesta spec.
2. **Dois cadastros** no M19:
   - **Funcionários** = identidade + alçada/login (`employees`).
   - **Cadastro** (`cadastro_contatos`) = pessoa ↔ conta CoA (responsabilidade de linha). Alçada ≠ responsabilidade de conta.
3. **Sócio** realiza cadastros e define atribuições (Árvore / Cargos / Funcionários / Cadastro). CFO não edita org.
4. **Visão sidebar** = matriz estática em código (`MODULE_VISIBILITY`). Sem UI/Postgres para editar matriz na v1.
5. **Edição** = helpers `moduleEdit` (não só esconder menu).
6. Canal e-mail Plan B (aprovação externa) = **fora** desta spec — ver [`2026-08-15-email-rfq-approve-design.md`](./2026-08-15-email-rfq-approve-design.md).

## Matriz de visão (sidebar)

| M | cfo | socio | comite | comercial | compras |
|---|:---:|:---:|:---:|:---:|:---:|
| M1 Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| M2 DRE | ✓ | ✓ | ✓ | — | — |
| M3 Cad. financeiro | ✓ | ✓ | ✓ | — | — |
| M4 Caixa | ✓ | ✓ | ✓ | — | — |
| M5 Fator R | ✓ | ✓ | ✓ | — | — |
| M6 Stress | ✓ | ✓ | ✓ | — | — |
| M7 Ano3 | ✓ | ✓ | ✓ | — | — |
| M8 Spin-off | ✓ | ✓ | ✓ | — | — |
| M9 Governança | ✓ | ✓ | ✓ | — | — |
| M10 Compras | ✓ | ✓ | ✓ | — | ✓ |
| M11 Plano/Mix | ✓ | ✓ | ✓ | — | — |
| M12 Contratos | ✓ | ✓ | ✓ | ✓ | — |
| M13 CRM | ✓ | ✓ | ✓ | ✓ | — |
| M14 CPQ | ✓ | ✓ | ✓ | ✓ | — |
| M15 RH SC | ✓ | ✓ | ✓ | — | — |
| M16 Benchmark | ✓ | ✓ | ✓ | ✓ | — |
| M17 Anexo V | ✓ | ✓ | ✓ | — | — |
| M18 Comex | ✓ | ✓ | ✓ | — | — |
| M19 Intranet | ✓ | ✓ | ✓ | — | ✓ |

Notas:

- `comite` vê módulos financeiros/estratégicos em **leitura** (travas de edição já existentes / helpers).
- `compras` em M19: só superfície de **Fila / pedidos próprios** — sem Árvore, Cargos, Funcionários, Cadastro.
- `comercial` / `compras` não veem M2 nem M4 (já parcialmente implementado; matriz formaliza).

## Matriz de edição

| Capacidade | cfo | socio | comite | comercial | compras |
|---|:---:|:---:|:---:|:---:|:---:|
| Premissas DRE/caixa/mix (M2/M3/M4/M11) | ✓ | ✓ | — | — | — |
| M10 RFQ / pesquisa / sync pós-APPROVED | ✓ | ✓ | — | — | ✓ |
| M19 decidir se `assigned` | ✓ | ✓ | — | — | — |
| M19 Árvore / Cargos / Funcionários / Cadastro | — | ✓ | — | — | — |
| M13/M14 CRM·CPQ | ✓ | ✓ | — | ✓ | — |
| Pitch Mode | — | — | — | ✓ (forçado) | — |
| Inspeção de células | ✓ | ✓ | ✓ | — | — |

Four-eyes: autor do pedido não aprova o próprio. Compras abre; não aprova.

## Visão CFO no M3 (referência)

- Vê M3 no sidebar.
- Edita linhas DRE granular, contas e centros de custo (`canEditFinance`).
- Sócio tem a mesma edição financeira; sócio **também** monta org no M19.
- Compras/comercial não veem M3.

## Arquitetura

```
src/core/rbac/moduleVisibility.ts  → canViewModule(role, moduleId)
src/core/rbac/moduleEdit.ts        → canEditFinance / canEditCompras / canManageOrg / …
Shell.tsx                          → filtra moduleGroups
M19Intranet.tsx                    → tabs org só socio; compras limitado
M3 (e similares)                   → usam helpers, não ifs soltos
```

Sem Nest/Redis. Sem schema novo além do `cadastro_contatos` já criado.

## Fluxo de dados (cadastro)

1. Contratação ocorre fora do planner (processo humano).
2. Sócio abre M19 → Funcionários: nome, e-mail, setor, cargo (job_title), flags.
3. Sócio abre M19 → Cadastro: nome, telefone, e-mail, **conta CoA** (select analíticas).
4. FR-01 / login usa e-mail do `employees` para `x-user-email` e alçada.

## Erros / bordas

- Role sem nenhum M visível → impossível pela matriz (todos têm ao menos M1).
- Deep-link para M oculto → Shell redireciona para primeiro M permitido.
- API M19 org (POST/PATCH setores/cargos/cadastro) deve rejeitar se ator ≠ socio (v1: checar `x-user-email` ∈ employees com job Sócio **ou** role sessão socio). Preferência: alinhar ao e-mail `socio@` / employee Sócio-Fundador.

## Testes

- Unit: cada role → lista ordenada de M ids.
- Unit: `canManageOrg('socio') === true`; demais false.
- Unit: `canViewModule('compras', 'M2') === false`.
- Smoke manual: FR-01 → compras → sidebar sem M2/M4; M19 sem aba Cadastro.

## Fora de escopo

- Matriz editável em runtime / Postgres.
- Sync M15 RH → employees.
- Aprovação por e-mail (Plan B / token).
- Novos roles além de cfo, socio, comite, comercial, compras.

## Critério de aceite

1. Sidebar respeita a matriz para os 5 roles.
2. Só socio edita abas org/cadastro no M19.
3. CFO edita M3; não edita Cadastro M19.
4. Testes unitários da matriz passam.
