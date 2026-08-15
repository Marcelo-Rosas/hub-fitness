# Comex / PUCOMEX (M18)

## Shell
**M18** — Portal Comex integrado ao [Portal Único Siscomex](https://docs.portalunico.siscomex.gov.br/)

## Auth oficial
Fonte: [Introdução API pública](https://docs.portalunico.siscomex.gov.br/introducao-api-publica/)

1. mTLS com certificado ICP-Brasil A1/A3 (PFX no servidor)
2. `POST {base}/portal/api/autenticar` + header `Role-Type` (HUB default: **DEPOSIT**)
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

Env: `PUCOMEX_ENV`, `PUCOMEX_CERT_PFX_PATH`, `PUCOMEX_CERT_PASSWORD`, `PUCOMEX_ROLE_TYPE`, `PUCOMEX_LIVE`

Sem PFX → modo **DEMO** (sessão local + respostas stub; paths oficiais preservados).

## Persistência (metadado, ADR-003)
- DDL Client: `supabase/client/migrations/20260814120000_comex_metadata.sql`
  - `comex_field_defs` — campos do projeto (CRUD)
  - `comex_processes` — `code` + `client_slug` + **`payload jsonb`**
  - `comex_documents` — path + **`meta jsonb`**, FK opcional ao processo
- Sem colunas de negócio no schema. Sem `tenant_id`.
- Runtime local (sem `DATABASE_URL`): SQLite `data/comex.sqlite` via `node:sqlite`
- Indexador: `COMEX_DOCS_ROOT` (default `D:\Comex`) agrupa BL/DI/PI/Packing List pelo número `\d{2}BRZ\d{7}`
- **Populagem:** PDF é a fonte da verdade. `POST /api/comex/documents/ingest` (upload) e index+extract gravam JSON no `payload`. Deep Research **não** substitui BL/DI/PI/PL.
- UI M18 renderiza form/grade a partir de `field_defs`

## Arquivos
- `src/core/comex/pucomexClient.ts` — mTLS + sessão
- `src/core/comex/comexStore.ts` — sqlite/pg
- `src/core/comex/docsIndexer.ts` — D:\Comex
- `src/core/comex/registerPucomexRoutes.ts` — Express
- `src/core/comex/environments.ts`, `endpoints.ts`
- `src/components/modules/M18Comex.tsx`
- `.env.example` (bloco PUCOMEX + COMEX_DOCS_ROOT)

## Rotas HUB
- `GET /api/comex/pucomex/status`
- `GET /api/comex/pucomex/catalog`
- `POST /api/comex/pucomex/authenticate`
- `POST /api/comex/due|duimp|cct/consult`
- `POST /api/comex/ncm/consult`, `/catalogo/consult`
- `POST /api/comex/pucomex/proxy` — path genérico oficial
- CRUD `/api/comex/field-defs` — metadado de campos
- CRUD `/api/comex/processes` — payload jsonb
- `POST /api/comex/processes/:id/extract` — PDF → JSON pelos `field_defs` (heurística; Gemini se houver chave)
- `POST /api/comex/documents/ingest` — upload PDF → classifica BL/DI/PI/PL → JSON → popular processo
- `POST /api/comex/documents/index` — varre D:\Comex (`extract: true` popula payload)
- `GET /api/comex/documents/:id/file`

## Dados ADR-003
- Processos DUIMP por importador → **Client DB**
- Auth e-CNPJ hub + CT → **Operator**
- Tabelas portos/ATIT: assets app (Tabadu: [domínio](https://docs.portalunico.siscomex.gov.br/pages/tabelas_dominio/))

## Travas
- Ad Valorem DRE = NF serviço, não CIF carga
- Konnen = dogfood
- Não acoplar Freight LogiTwenty
