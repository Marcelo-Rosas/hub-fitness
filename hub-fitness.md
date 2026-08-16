# HUB-FITNESS — Regras canônicas

Documento vivo. Agentes e humanos: **ler antes de ship**. Novas regras → acrescentar aqui + espelhar em `.cursor/rules/hub-fitness.mdc` se for sempre-aplicar.

**Produto:** planner 3PL fitness (Itajaí/Navegantes) — Vite/React + Express (`server.ts`) + Railway + Worker Cloudflare (`hub.vectracargo.com.br`).  
**Não é** TMS Vectra Cargo.

---

## 0. Ship discipline (não acumular)

**Sempre fechar o ciclo na mesma sessão/PR.** Não deixar fila de “depois”.

| Artefato | Ação obrigatória quando muda |
|----------|------------------------------|
| Código / docs / testes | `git commit` + `git push` (merge em `main` se em branch) |
| Worker proxy | `cd workers/hub-fitness-proxy && npm run deploy` (Wrangler) |
| Schema Operator | migration em `supabase/migrations/` **e** apply remoto (MCP/`apply_migration` ou CLI linkado) |
| Railway app | deploy fresh do commit (não só `redeploy` de build velho) |

**Proibido:**

- Merge/push sem Wrangler se `workers/hub-fitness-proxy/**` mudou  
- Merge/push sem apply se `supabase/migrations/**` mudou  
- Deixar migration só no repo / só no remoto (drift)  
- Empilhar 3+ mudanças shipáveis “pra depois”

**Ordem tipica:** testes → commit → push → Railway (commit novo) → Wrangler (se Worker) → Supabase apply (se SQL) → health `https://hub.vectracargo.com.br/api/health`.

---

## 1. Números travados (não inventar)

| Premissa | Valor | Notas |
|----------|------:|-------|
| CAPEX BP | R$ 207.300 | Só muda com decisão explícita humana |
| Ad Valorem | 0,10% | Sobre **NF de serviço**, nunca CIF carga |
| Hub capacity | `hubParams.capacity.totalPositions` | Não hardcode `2968` em UI nova |
| Score RFQ | heurística | Nunca rotular como “confiança IA” |

UI/copy: bind a `hubParams` / milestones / engine — não petrificar BP v3.5 em `M*.tsx`.

---

## 2. ADR-003 (dados)

- Operator = Postgres Supabase (cadastro, price_*, `intranet.*`)  
- Client = database-per-client — **sem `tenant_id`**  
- Runtime: intranet/comex = **SQLite** até wiring; M12/M14 leem Operator via **`OPERATOR_DATABASE_URL`**  
- **Nunca** apontar `DATABASE_URL` (Comex) para o Operator — misturar quebra ADR-003  
- Schema `intranet` = **privado** — não listar em `[api].schemas` Data API  
- Konnen = dogfood Client #0 — não âncora comercial / BE

---

## 3. Alçada / Plan B (M10–M19)

- `APPROVE` com unit/landed null → **bloqueado** (`PRECO_INCOMPLETO`)  
- Toda RFQ → `payload.quote_id` (ledger `intranet.quotes` / SQLite espelho)  
- `price_type`: `estimativa` ≠ verdade de alçada até RFQ confirmado  
- Volume gap só com `ops_real_started` + ≥ ~2 meses (3º mês ops)  
- Token e-mail: opaco, hash no DB, TTL 48h, one-shot; HTML `/approve/:token`  
- Notify: outbox `ASSIGNMENT.NOTIFY` no mesmo pipeline Resend/simulado  

---

## 4. Auth / demo

- Prefill senha `hub2026` **só DEV** (`NODE_ENV !== 'production'`)  
- `/api/auth/me` espelha sessão / `x-user-email` — não hardcode CFO  
- Logins seed: `compras@` / `cfo@` / `socio@` + domínio `hubfitness.com.br`

---

## 5. Cloudflare Worker

- Path: `workers/hub-fitness-proxy/`  
- Config: `wrangler.jsonc` (`ORIGIN_URL` → Railway)  
- Domínio: `hub.vectracargo.com.br`  
- Após mudança: **sempre** `npm run deploy` (não acumular)

---

## 6. Supabase migrations

- Arquivos: `supabase/migrations/*.sql` (imperativo)  
- Apply remoto no projeto Operator ativo **na mesma entrega**  
- Novas tabelas `intranet.*`: RLS + policy `service_role`  
- `SECURITY DEFINER` em `public`: **REVOKE EXECUTE de `anon`**; billing/FDW só `service_role`  
- Não usar `apply_migration` para iterar local à toa — arquivos no repo são SSOT do histórico

---

## 7. Anti-patterns

- Skill `cargo-flow-navigator` / domínio Vectra no hub-fitness  
- Ad Valorem sobre CIF no DRE  
- `tenant_id` em Client  
- Insights/KPIs inventados (M10 bullets fixos, checklist M9 tudo `true`)  
- Commit de `.env` / secrets  
- “Só documentei, apply depois”

---

## Changelog deste arquivo

| Data | Mudança |
|------|---------|
| 2026-08-15 | Criação: ship discipline + canônicos pós Plan B / hardcode purge |
