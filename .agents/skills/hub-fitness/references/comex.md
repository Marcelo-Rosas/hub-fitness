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

Env: `PUCOMEX_ENV`, `PUCOMEX_CERT_PFX_PATH`, `PUCOMEX_CERT_PASSWORD`, `PUCOMEX_ROLE_TYPE`, `PUCOMEX_REP_CERT_PFX_PATH`, `PUCOMEX_REP_CERT_PASSWORD`, `PUCOMEX_REP_ROLE_TYPE`, `PUCOMEX_LIVE`, `COMEX_OPERATOR_TOKEN`, `COMEX_ALLOWED_EMAILS`, `HUB_TRUST_ACCESS_HEADER` (só o Worker injeta `'true'`; nunca em dev local), `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` (as duas últimas no Worker), `PUCOMEX_PROXY_ALLOW_WRITE`

Sem PFX → modo **DEMO** (sessão local + respostas stub; paths oficiais preservados).

### Dois perfis de credencial (`PucomexClient(profile)`)
- **empresa** (`pucomexClient`): e-CNPJ VECTRA HUB, `PUCOMEX_CERT_PFX_PATH`/`PUCOMEX_CERT_PASSWORD`/`PUCOMEX_ROLE_TYPE` (OPERPORT) + fallback thumbprint Windows. Usado em DUE/DUIMP/CCT/proxy.
- **representante** (`pucomexRepClient`): e-CPF do representante do importador, `PUCOMEX_REP_CERT_PFX_PATH`/`PUCOMEX_REP_CERT_PASSWORD`/`PUCOMEX_REP_ROLE_TYPE` (padrão **IMPEXP**, que só aceita e-CPF). Sem fallback Windows; `PUCOMEX_LIVE=false` também desliga. `PUCOMEX_REP_LABEL` opcional.
- Sessão, throttle de 60 s, agent mTLS e `certError` são independentes por perfil. `/status` traz `representante: { status, session }` (com `certSubject`/`certValidTo`); `POST /pucomex/authenticate` autentica os dois configurados.
- `POST /api/comex/ncm/tratamentos` (TA/LPCO + TTCE) usa o representante quando configurado e cai para a empresa; devolve `perfilUsado`. Motivo: com OPERPORT o `simular-ta/importacao` deu **403 PUCX-ER0201** "Transação não autorizada para esse perfil".
- Container: `PUCOMEX_REP_CERT_PFX_B64_1..3` → `/tmp/pucomex-rep-cert.pfx` (`docker-entrypoint.sh`); Worker repassa `PUCOMEX_REP_*` em `PASSTHROUGH_ENV`.
- TTCE vazio → `ttceDiag` (tipo do arquivo, amostra/gzip/zip se string, chaves, nº de intervalos, intervalos da NCM com `paisesOrigem`, código de país usado). Arquivo string (JSON com BOM) é parseado antes do recorte.

## Trava geral (`src/core/comex/comexGuard.ts`)
- `comexGateway` montado com `app.use('/api/comex', …)` em `registerPucomexRoutes.ts`: **todo** `/api/comex/*` exige autorização, inclusive em DEMO e em dev. Duas vias:
  1. **Principal — identidade do Cloudflare Access.** O Worker (`workers/hub-fitness-proxy/src/accessIdentity.ts`) valida o JWT `Cf-Access-Jwt-Assertion` (JWKS do team `CF_ACCESS_TEAM_DOMAIN`, audience `CF_ACCESS_AUD`) e repassa ao container o header confiável `x-hub-access-email` (minúsculas), sempre removendo a cópia vinda do cliente. Autoriza se o e-mail estiver em `COMEX_ALLOWED_EMAILS` (lista por vírgula; secret: `npx.cmd wrangler secret put COMEX_ALLOWED_EMAILS` na pasta `workers/hub-fitness-proxy`). O container só aceita esse header com `HUB_TRUST_ACCESS_HEADER='true'` — var em `wrangler.jsonc` repassada pelo Worker (`PASSTHROUGH_ENV`). Sem a flag (dev local: Express em `0.0.0.0` e certificado ICP real) o header é ignorado e a lista não conta como configurada; **nunca** setar a flag no `.env` local.
  2. **Fallback (dev local sem Access)** — header `x-comex-token` = `COMEX_OPERATOR_TOKEN`.
- Livres (`COMEX_PUBLIC_ROUTES`): `GET /api/comex/pucomex/status`, `GET /api/comex/pucomex/catalog`, `POST /api/comex/benchmark` e `POST /api/comex/stats/monthly` (dados públicos ComexStat, cota 30/min).
- Nem `COMEX_ALLOWED_EMAILS` (com a flag) nem `COMEX_OPERATOR_TOKEN` no servidor → 503 `COMEX_OPERATOR_TOKEN_UNSET` (também em DEMO). E-mail fora da lista e token ausente/errado → 401 `COMEX_OPERATOR_TOKEN_REQUIRED`. Token comparado por SHA-256 + `timingSafeEqual`.
- `/status` devolve `guard` com `operatorTokenRequired`, `operatorTokenConfigured`, `accessEmailConfigured`, `authorized` e `via` (`'access'` | `'token'` | `null`). O M18 só mostra o painel do token quando `guard.authorized` é `false` (ou o gateway recusou); antes do `/status` carregar mostra "Verificando acesso…"; se o `/status` falhar, sem token salvo = painel. `accessEmailConfigured` só é `true` com lista **e** flag.
- **Deploy:** `CF_ACCESS_TEAM_DOMAIN` e `CF_ACCESS_AUD` são `vars` em `workers/hub-fitness-proxy/wrangler.jsonc`, e `wrangler deploy` aplica as vars do jsonc — os valores reais têm de estar no jsonc, senão o que foi configurado no painel da Cloudflare é sobrescrito (vazio = via Access desligada).
- Login do app é mock (forjável, repo público) → **não** serve de autorização.
- Gerador no M18 (`src/components/modules/ComexOperatorTokenPanel.tsx`, lógica em `comexOperatorToken.ts`): botões **Gerar** e **Salvar**. O token fica no `localStorage` do navegador (antes `sessionStorage` → painel voltava a cada aba/visita; migração automática). Aviso de restart/SQLite só aparece após Salvar (junto do comando); recusa do gateway mostra "cole o token gravado, não gere outro". Salvar valida o formato (`^[A-Za-z0-9_-]{16,}$`), copia o TOKEN para a área de transferência e mostra o comando `cd workers\hub-fitness-proxy; Get-Clipboard | npx.cmd wrangler secret put COMEX_OPERATOR_TOKEN` (rodar na raiz do repo; o token não vai no comando). **O servidor nunca recebe o token por HTTP**; o secret é gravado pelo próprio comando (Cloudflare ou `.env` local).
- **Aviso operacional:** gravar/trocar o secret só vale após reiniciar o container (deploy); sem `DATABASE_URL`, reiniciar APAGA o SQLite (processos, clientes, despachantes). Fixe o token uma vez, antes de cadastrar clientes reais, e ligue o Postgres antes do uso real.
- `POST /api/gemini/comex-ai` só consulta o NCM no Portal (mTLS) quando o request está autorizado (e-mail do Access em `COMEX_ALLOWED_EMAILS` ou `x-comex-token` válido); sem autorização roda só com o Gemini.
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
- Faixas: < 80% ok · 80–100% atenção · > 100% estouro. Teto padrão: `limitada_50k` = US$ 50 mil, `limitada_150k` = US$ 150 mil; `expressa` (S.A. aberta, empresa pública, economia mista — IN 1.984/2020) e `ilimitada` → `sem_limite`. Radar Limitado = impossibilidade de DUIMP no cronograma da Receita → aviso "vai por DI" no cadastro e no processo. Datas do cadastro validadas como AAAA-MM-DD; "hoje" do Radar no fuso America/Sao_Paulo.
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
- `src/components/modules/ComexOperatorTokenPanel.tsx` — gerador de token (fallback)
- `workers/hub-fitness-proxy/src/accessIdentity.ts` — valida JWT do Cloudflare Access e gera `x-hub-access-email`
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
- CRUD `/api/comex/processes` — payload jsonb; `POST` exige `cliente_id`; `POST` e `PUT` devolvem `radar`
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

## Auditoria NCM — dados reais do Portal (2026-11-17)
- NCM: tabela pública `GET /classif/api/publico/nomenclatura/download/json?perfil=PUBLICO` (sem certificado, cache 24 h) — o Portal NÃO tem consulta por código (`src/core/comex/ncmTable.ts`).
- `POST /api/comex/ncm/tratamentos` {ncmCode, country, clienteId?} (atrás da trava):
  - LPCO/anuentes: `POST /talpco/api/ext/simular-ta/importacao` autenticado, `fundamentoLegal: "NAO_SE_APLICA"`, `condicaoMercadoria: "NOVA"`, país ISO2. Ex.: 9506.91.00 China → INMETRO "Requer LPCO" (I00014/I00207/I00041, impede desembaraço) + ANVISA alerta (RDC 977/2025).
  - Tributário: TTCE em lote por capítulo (`/ttce/api/ext/importacao/ncm-capitulos/{cap}/hash` → `.../tratamentos-tributarios?data&hash`), país numérico Siscomex (CN=160). Traz tributos/regimes/fundamentos (Ex-tarifário em destaque) — **sem alíquotas**.
  - Documentos pelo Radar do cliente (Limitado → DI) + LPCO exigido.
- Alíquotas: simulador da Receita (`www4.receita.fazenda.gov.br/simulador/`) tem captcha → só link, sem automação. Simulador público de TA do Portal usa reCAPTCHA na tela → o HUB usa a versão autenticada documentada.

## Benchmark ComexStat (MDIC) — preço/kg e frete/FOB (2026-11-17)
- `src/core/comex/comexStatBenchmark.ts`: API pública `https://api-comexstat.mdic.gov.br` (sem auth). `GET /general/dates/updated` → último mês fechado; janela de 12 meses; `POST /general?language=pt` com `flow:"import"`, filtros `ncm` + `country` (código numérico ComexStat, CN=160 via `ISO2_TO_SISCOMEX`; sem mapeamento → todos os países). Valores vêm como **string**.
- **Pegadinha:** período que cruza o ano (ex.: `2025-11`→`2026-10`) volta `list: []` — o módulo quebra a janela em um POST por ano e soma as linhas.
- Cache em memória 24 h (data de atualização + `ncm|país|to`). `compareProcessToBenchmark` (puro): razão US$/kg processo ÷ média — `<0,5` muito abaixo (risco de valoração/subfaturamento), `<0,8` abaixo, `>2` acima (informativo), sem FOB/kg → `sem_dados`. Sempre com a ressalva: a NCM agrega produtos diferentes — média é referência, não prova.
- `POST /api/comex/benchmark` {ncmCode, country?, fobUsd?, kg?, freightUsd?} → `{benchmark, comparison|null}` — **pública** (`COMEX_PUBLIC_ROUTES`), limite global 30/min (429).
- UI: `NcmBenchmarkCard.tsx` na Auditoria NCM (FOB do formulário + peso opcional) e no modal do processo (NCM + FOB; peso `gross_weight_kg`; país pelo UN/LOCODE do porto de origem; frete se existir `freight_value_usd`). Só informativo.
- Ex. real (9506.91.00, China, 11/2025–10/2026): US$ 1,95/kg, frete ≈ 15% do FOB.

## Série mensal ComexStat — painel de mercado (2026-11-21)
- `src/core/comex/comexStatMonthly.ts`: `monthlyWindow(ano, mês, 12|24)` (12 = `benchmarkWindow`); `fetchNcmMonthlySeries` faz um `POST /general` por ano com `monthDetail:true`, `details:[]`. Linhas vêm com `year` + `monthNumber` ("07"), valores **string** e **fora de ordem** — o módulo soma por mês, ordena e preenche meses sem linha com zero. `usdPerKg`/`freightPctFob` null com divisor 0. Cache próprio 24 h (`ncm|país|meses|to`, teto 500, dedupe). `seriesTrend` (puro): últimos 3 meses vs. 3 anteriores (FOB e US$/kg).
- Reusa do benchmark: `loadComexStatUpdated`, `readComexStatJson`, `splitPeriodByYear`, `ComexStatError` e a **mesma cota** `takeBenchmarkSlot` (30/min somando as duas rotas). Testes limpam com `clearComexStatCache()` + `clearComexStatMonthlyCache()`.
- `POST /api/comex/stats/monthly` {ncmCode, country?, months?=12|24} → `{series, trend}` — **pública** (`COMEX_PUBLIC_ROUTES`), em `registerComexStatsRoutes.ts` (registrada em `registerPucomexRoutes` após o gateway). 400 NCM/months inválidos, 429 sem cota, 502 erro ComexStat (mensagem própria; erro inesperado → genérico).
- UI: `NcmMarketSeriesCard.tsx` (recharts: barras FOB/mês + linha US$/kg em eixo secundário, seletor 12/24, tendência) na Auditoria NCM abaixo do `NcmBenchmarkCard`. Fora do modal do processo.
- Próxima etapa: recortes por porto/URF, país e UF/município com `details` diferentes sobre o mesmo módulo.

## Integra Comex — consulta pública (2026-11-17)
- Gratuita, sem autenticação: SERPRO devolve só **quando** o documento mudou (`dataAtualizacao`, sem fuso = Brasília), não **o quê**. Não valida números: inválido e sem dado são iguais (só volta o que achou). Cobertura desde 2017. Spec: `docs/superpowers/specs/2026-11-17-integra-comex-monitor-gratuito-design.md`.
- `src/core/comex/integraComexPublic.ts` (puro, usado também no front): normaliza CE (15 díg.), DI (10, aceita `25/1234567-8`), LI (lista por vírgula, 10), DUIMP (`^\d{2}BR\d{11}$`); `formatWarning` (não bloqueia); `fetchLastUpdates(kind, numbers)` em lotes de 50 (`nr` repetido) / DUIMP 100 (`duimp=`, resposta `multiStatus` com `versaoVigente`). 404 de LI/DUIMP = vazio; 5xx/timeout 15 s = `IntegraComexError`.
- **Pegadinha:** LI responde em `/siscomex-li-api/licencas-importacao/...`, não no basePath do swagger (`/li-consulta-atualizacao`).
- BL ≠ CE-Mercante: o CE (15 díg.) vem do agente de carga/Mercante → campo próprio `ce_mercante_number`; também `di_number`, `li_numbers`. DUIMP = `declaration_number` quando `type=importacao`.
- Tabela `comex_tracking` (SQLite + Postgres `db/neon/0003_comex_tracking.sql`, criada no `ensureReady`): uma linha por documento. `createProcess`/`updateProcess` do store sincronizam (só números de formato válido; apaga os que saíram; falha não quebra o salvamento).
- `src/core/comex/comexTracking.ts`: `runTrackingCheck` ignora status `desembaracado`/`cancelado`; 1ª aparição grava data (CE/DUIMP também marcam "Alterado" = registrado); data diferente → guarda anterior + `changed_at`; não achado há >7 dias → "Não encontrado"; erro por tipo em `last_error`; trava de concorrência em memória. "Alterado" = `changed_at` e (`seen_at` nulo ou anterior).
- Agendador no `server.ts`: 30 min, seg–sex 7h–20h (America/Sao_Paulo). `COMEX_TRACKING_DISABLED=1` desliga; nunca roda em testes. SERPRO pede uso racional: sem retry imediato.
- Rotas (atrás do token): `GET /api/comex/tracking?process_id=`, `GET /api/comex/tracking/summary`, `POST /api/comex/tracking/check` {process_id?} (1 por processo/5 min → 429), `POST /api/comex/tracking/:id/seen`.
- UI: `ComexTrackingCard.tsx` no modal do processo + `TrackingBadge` na lista (âmbar "Alterado", cinza "Não encontrado").
- Pendente: confirmar que o container Cloudflare alcança `*.estaleiro.serpro.gov.br`.
