# ADR-003 — Database-per-client (não multi-tenant)

**Status:** Aceito · 2026-08-13  
**Contexto:** HUB-FITNESS 3PL (operador) + N consumidores (clientes de armazém)

## Decisão

**Não** multi-tenant em um único Postgres. Cada consumidor = **projeto/DB próprio** + **users próprios**. Isolamento = **database-level**.

| Papel | Database | Conteúdo |
|---|---|---|
| Operador | Operator DB (`hub-fitness-operator`) | clients, contracts, preços, tax_rates, billing_records, users operador, agent_swarm, audit_log, views consolidadas |
| Consumidor | Client DB (`hub-fitness-client-<slug>`) | orders…item_damages, products, stock, users do cliente |
| Dogfood | Client DB #0 | **Konnen** = cliente #0 de calibração — **não** é âncora comercial / cliente-alvo |

## Consequências

1. **Remover** `tenant_id`, RLS “por tenant” e `get_my_tenant_id()` do schema 3PL.
2. **Client DB:** RLS só para papéis *dentro* do DB do cliente (`auth.uid()` / `app_metadata.role`), nunca filtro de tenant.
3. **Operator DB:** agrega via `service_role` + FDW **somente leitura** nos Client DBs; `billing_records` é escrito só no Operator.
4. **CAPEX R$ 207.300 · 2.968 posições · nomenclatura HUB-FITNESS** permanecem intactos.
5. Provisioning: `supabase/client/provision_client_db.sql` + runner `supabase/scripts/apply-client-migrations.mjs`.

## Critério de aceite

- `supabase db reset` (ou apply do provision) em Client DB **sem** coluna `tenant_id`.
- Operator DB agrega capacidade + billing **sem** `INSERT/UPDATE/DELETE` em Client DB.
