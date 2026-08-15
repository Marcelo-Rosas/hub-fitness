# Spec — Intranet Operator (alçada + RFQ)

**Data:** 2026-08-14  
**Status:** aprovado para execução  
**Plano:** [docs/superpowers/plans/2026-08-14-intranet-operator.md](../plans/2026-08-14-intranet-operator.md)

## Problema

O M19 atual é um atalho `pending → approved|rejected` com e-mail Resend no mesmo HTTP. Não há rascunho, correção, versão, auditoria nem outbox. O decisor é um dropdown de papel de board (`cfo`/`socio`), não o organograma.

## Decisões

1. Motor no Express atual. Sem Nest, Redis, Next, CDC.
2. Postgres schema **`intranet`** no **Operator**. Não expor na Data API. Sem `tenant_id`.
3. Solicitante e decisor saem do **cadastro**: setor (árvore) + cargo (toggles) + funcionário (override).
4. SUBMIT **calcula** o aprovador subindo a árvore. Four-eyes: o autor não aprova o próprio pedido.
5. Aprovação grava outbox; Resend só no dispatcher (`INTRANET_EMAIL_LIVE`).
6. M15 permanece folha/Fator R. Este cadastro é permissão, não salário.
7. Vite: só publishable key. Secret só no servidor.

## Superfície de dados

```
Operator Postgres
  public     → Data API (clients, billing, …)
  intranet   → Express / service_role (não em api.schemas)
```

Local sem Postgres: SQLite `data/intranet.sqlite` (mesmo modelo, sem schema Postgres).

## FSM

`DRAFT → IN_REVIEW → APPROVED | REJECTED | CHANGES_REQUESTED → IN_REVIEW`  
`CANCEL` de qualquer estado não terminal.

## Permissão efetiva

```
can_request_eff = employee.can_request_override ?? job_title.can_request
can_approve_eff = employee.can_approve_override ?? job_title.can_approve
```

## Fora de escopo

SLA/escalonamento, segundo workflow, CMS, WebSockets, segundo projeto Client Konnen (ADR-003 continua separado), e-mail real sem flag.
