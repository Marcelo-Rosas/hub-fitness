# HUB-FITNESS · Supabase (ADR-003)

**Decisão:** database-per-client. Sem `tenant_id`. Ver [ADR-003](../docs/adr/ADR-003-database-per-client.md).

## Layout

| Caminho | Papel |
|---|---|
| `migrations/` | **Operator DB** (`hub-fitness-operator`) |
| `client/provision_client_db.sql` | Schema padrão **Client DB** (idempotente) |
| `client/migrations/` | Migrations extras aplicadas em N Client DBs |
| `scripts/apply-client-migrations.mjs` | Runner multi-DB |

## Operator DB

```bash
npx supabase start          # local
npx supabase db reset       # aplica supabase/migrations/*
```

Aceite: tabelas `clients`, `billing_records`, `v_capacity_rollup` existem; Konnen seed com `is_dogfood=true` e `rack_budget_positions=2968`.

Registrar FDW (somente leitura) após Client DB existir:

```sql
SELECT public.register_client_fdw(
  'konnen', 'db.xxx.supabase.co', 5432,
  'postgres', 'fdw_readonly', '***'
);
```

`recompute_billing_for_period(...)` grava **só** em `billing_records` do Operator.

## Client DB

1. Crie um projeto Supabase por consumidor (ex.: `hub-fitness-client-konnen`).
2. Copie `scripts/clients.example.json` → `scripts/clients.json`.
3. Instale `pg` e rode o runner:

```bash
npm i -D pg
npm run db:provision-clients
```

Aceite: `assert_no_tenant_id()` / runner falha se houver `tenant_id`.

Reset local de um Client DB (projeto separado):

```bash
# no projeto client, migrations = cópia de client/migrations
npx supabase db reset
```

## Auth

- **Client users** → Auth do Client DB (`client_profiles` + `app_metadata.role`).
- **Operator users** → Auth do Operator DB (`operator_profiles`).
- Agregação Operator → `service_role` / FDW user **read-only** por Client DB.

## Travas de negócio

- CAPEX R$ 207.300 e 2.968 posições = infraestrutura HUB-FITNESS.
- Konnen = cliente #0 dogfood, não cliente-alvo / âncora de BE.
