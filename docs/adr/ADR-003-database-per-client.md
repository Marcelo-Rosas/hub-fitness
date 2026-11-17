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

## Adendo (2026-11-16) — exceção consciente: Comex da comissária

As tabelas `comex_*` (`comex_processes`, `comex_documents`, `comex_field_defs`, `comex_clients`, `comex_brokers`) são **cadastro da comissária (VECTRA)**, não de um consumidor 3PL.

- Ficam no diretório de migrations do Client DB (`supabase/client/migrations/`), mas rodam num **único banco** que atende **vários clientes importadores**.
- O vínculo entre processo e importador é `comex_processes.cliente_id` → `comex_clients.id`. Não há `tenant_id` nem banco por importador.
- Isso é **exceção** ao database-per-client. Não se aplica a `orders`, `stock` e demais tabelas 3PL, que seguem a regra acima.
- O isolamento entre clientes Comex é feito pela aplicação (filtro por `cliente_id`) e pela trava `COMEX_OPERATOR_TOKEN`. Não é database-level.
- Motivo (spec 2026-11-16, §6): um cliente só-Comex não cabe no modelo de banco provisionado por cliente (`database_ref NOT NULL` da tabela `clients` do Operator). Por isso o cadastro fica numa tabela própria do store Comex.
