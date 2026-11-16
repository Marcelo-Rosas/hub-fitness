# Comex / PUCOMEX (M18)

## Shell
**M18** — Portal Comex integrado ao [Portal Único Siscomex](https://docs.portalunico.siscomex.gov.br/)

## Auth oficial
Fonte: [Introdução API pública](https://docs.portalunico.siscomex.gov.br/introducao-api-publica/)

1. mTLS com certificado ICP-Brasil A1/A3 (PFX no servidor)
2. `POST {base}/portal/api/autenticar` + header `Role-Type` (HUB default: **OPERPORT** — perfil habilitado da VECTRA HUB; `DEPOSIT` só após habilitação de depositário na RFB)
3. Resposta headers: `Set-Token` (JWT) + `X-CSRF-Token` (60 min, renovado a cada request)
4. Demais calls: headers `Authorization` + `X-CSRF-Token`
5. **Não** reautenticar a cada request — intervalo mínimo 60s entre `autenticar`

## Ambientes
Fonte: [Ambientes](https://docs.portalunico.siscomex.gov.br/ambientes/)

| id | URL |
|---|---|
| `validacao` | https://val.portalunico.siscomex.gov.br |
| `producao` | https://portalunico.siscomex.gov.br |
| `homologacao` | https://hom.pucomex.serpro.gov.br (restrito) |

Env: `PUCOMEX_ENV`, `PUCOMEX_CERT_PFX_PATH`, `PUCOMEX_CERT_PASSWORD`, `PUCOMEX_ROLE_TYPE`, `PUCOMEX_LIVE`, `COMEX_OPERATOR_TOKEN`, `PUCOMEX_PROXY_ALLOW_WRITE`

Sem PFX → modo **DEMO** (sessão local + respostas stub; paths oficiais preservados).

## Trava geral (`src/core/comex/comexGuard.ts`)
- `comexGateway` montado com `app.use('/api/comex', …)` em `registerPucomexRoutes.ts`: **todo** `/api/comex/*` exige header `x-comex-token` = `COMEX_OPERATOR_TOKEN`, inclusive em DEMO e em dev.
- Livres (`COMEX_PUBLIC_ROUTES`): `GET /api/comex/pucomex/status`, `GET /api/comex/pucomex/catalog`. `POST /api/comex/benchmark` consta na lista, mas a rota ainda não existe (Fase 2).
- Sem `COMEX_OPERATOR_TOKEN` no servidor → 503 `COMEX_OPERATOR_TOKEN_UNSET` (também em DEMO). Header ausente ou errado → 401 `COMEX_OPERATOR_TOKEN_REQUIRED`. Comparação por SHA-256 + `timingSafeEqual`.
- Login do app é mock (forjável, repo público) → **não** serve de autorização.
- Gerador no M18 (`src/components/modules/ComexOperatorTokenPanel.tsx`, lógica em `comexOperatorToken.ts`): botões **Gerar** e **Salvar**. O token fica só no `sessionStorage` da aba. Salvar mostra o comando `$token = '…'; $token | npx.cmd wrangler secret put COMEX_OPERATOR_TOKEN`. **O servidor nunca recebe o token por HTTP**; o secret é gravado pelo próprio comando (Cloudflare ou `.env` local).
- Proxy: só `GET`; escrita exige `PUCOMEX_PROXY_ALLOW_WRITE=true`. Path absoluto/`//` recusado.
- `/status` expõe `status.certError` (PFX testado com `tls.createSecureContext`; "mac verify failure" = senha errada ou .pfx corrompido) e `guard`.
- `autenticar` respeita 60s mesmo com `force` e deduplica chamadas simultâneas.

## Persistência (metadado, ADR-003)
- DDL Client: `supabase/client/migrations/20260814120000_comex_metadata.sql`
  - `comex_field_defs` — campos do projeto (CRUD)
  - `comex_processes` — `code` + `client_slug` + **`payload jsonb`**
  - `comex_documents` — path + **`meta jsonb`**, FK opcional ao processo
- DDL Client (clientes/despachantes): `supabase/client/migrations/20261116120000_comex_clients_brokers.sql` — `comex_clients`, `comex_brokers` e `comex_processes.cliente_id` (FK, `NULL` nos legados). RLS: leitura para membros, escrita para `client_admin`/`client_ops`. Espelho SQLite em `comexStore.ts`.
- Os demais cadastros seguem metadado genérico (`payload jsonb`). Sem `tenant_id`.
- Runtime local (sem `DATABASE_URL`): SQLite `data/comex.sqlite` via `node:sqlite`. Em produção sem `DATABASE_URL`, clientes e despachantes somem a cada deploy (container efêmero).
- Indexador: `COMEX_DOCS_ROOT` (default `D:\Comex`) agrupa BL/DI/PI/Packing List pelo número `\d{2}BRZ\d{7}`
- **Populagem:** PDF é a fonte da verdade. `POST /api/comex/documents/ingest` (upload) e index+extract gravam JSON no `payload`. Deep Research **não** substitui BL/DI/PI/PL.
- UI M18 renderiza form/grade a partir de `field_defs`

## Clientes e despachantes (Fase 1)
- `comex_clients` = importador atendido pela VECTRA. Campos: `cnpj_root` (8 dígitos, único), `cnpj`, `legal_name`, `slug`; Radar: `radar_status`, `radar_modality` (`expressa` | `limitada_50k` | `limitada_150k` | `ilimitada`), `radar_limit_usd`; representação: `rep_status` (`pendente` | `ativa` | `vencida` | `revogada`), `rep_certificate`, `rep_role_type`, validade; `broker_id`.
- `comex_brokers` = despachante parceiro. Sem certificado nesta fase (`certificate_status`).
- Processo novo exige `cliente_id`; processos antigos ficam sem cliente. `client_slug` é copiado do cliente.
- Erros: CNPJ raiz repetido → 409; excluir cliente com processos → 409; excluir despachante em uso → 409.
- Certificado do cliente **nunca** é pedido nem guardado.

## Regra do Radar (`src/core/comex/radarUsage.ts`)
- Só aviso, nunca bloqueio. Regra **a validar** com despachante/tributarista (IN RFB 1.984/2020).
- Soma só processos de importação (`payload.type === 'importacao'`) do cliente.
- Data do processo: `duimp_registered_at` → `eta_date` → `created_at`.
- Base: `COMEX_RADAR_BASIS=fob` (padrão, campo `fob_value_usd`) ou `cif` (`cif_value_usd`). Processo sem o valor conta 0 e aparece em `missingValue`.
- Janela: `COMEX_RADAR_WINDOW=rolling` (padrão) = 6 meses que terminam na data de referência (início exclusivo, fim inclusivo). `calendar` = semestre civil da referência.
- Faixas: < 80% ok · 80–100% atenção · > 100% estouro. Sem limite (`expressa`, `ilimitada`) → `sem_limite`.
- Limite padrão: `limitada_50k` = US$ 50.000; `limitada_150k` = US$ 150.000. `radar_limit_usd` sobrescreve.

## Arquivos
- `src/core/comex/pucomexClient.ts` — mTLS + sessão
- `src/core/comex/comexStore.ts` — sqlite/pg
- `src/core/comex/comexGuard.ts` — trava geral
- `src/core/comex/registerComexClientRoutes.ts` — clientes, despachantes, radar-usage
- `src/core/comex/radarUsage.ts` — regra do Radar (pura, usada também no front)
- `src/core/comex/docsIndexer.ts` — D:\Comex
- `src/core/comex/registerPucomexRoutes.ts` — Express
- `src/core/comex/environments.ts`, `endpoints.ts`
- `src/components/modules/M18Comex.tsx`
- `src/components/modules/ComexOperatorTokenPanel.tsx` — gerador de token
- `src/components/modules/ComexClientsPanel.tsx`
- `.env.example` (bloco PUCOMEX + COMEX_DOCS_ROOT + COMEX_RADAR_*)

## Rotas HUB
- `GET /api/comex/pucomex/status`
- `GET /api/comex/pucomex/catalog`
- `POST /api/comex/pucomex/authenticate`
- `POST /api/comex/due|duimp|cct/consult`
- `POST /api/comex/ncm/consult`, `/catalogo/consult`
- `POST /api/comex/pucomex/proxy` — path genérico oficial
- CRUD `/api/comex/field-defs` — metadado de campos
- CRUD `/api/comex/processes` — payload jsonb; `POST` exige `cliente_id` e devolve `radar`
- CRUD `/api/comex/clients` — importadores (`PUT /:id`, `DELETE /:id`)
- `GET /api/comex/clients/:id/radar-usage?ref=YYYY-MM-DD` — uso do limite Radar (padrão: hoje)
- CRUD `/api/comex/brokers` — despachantes (`PUT /:id`, `DELETE /:id`)
- `POST /api/comex/processes/:id/extract` — PDF → JSON pelos `field_defs` (heurística; Gemini se houver chave)
- `POST /api/comex/documents/ingest` — upload PDF → classifica BL/DI/PI/PL → JSON → popular processo
- `POST /api/comex/documents/index` — varre D:\Comex (`extract: true` popula payload)
- `GET /api/comex/documents/:id/file`

## Dados ADR-003
- Processos DUIMP → **Client DB** (`comex_processes`), ligados ao importador por `cliente_id`. Exceção: as tabelas `comex_*` são cadastro da comissária (VECTRA) e atendem vários clientes num banco só. Ver adendo no ADR-003.
- Auth e-CNPJ hub + CT → **Operator**
- Tabelas portos/ATIT: assets app (Tabadu: [domínio](https://docs.portalunico.siscomex.gov.br/pages/tabelas_dominio/))

## Travas
- Ad Valorem DRE = NF serviço, não CIF carga
- Konnen = dogfood
- Não acoplar Freight LogiTwenty
