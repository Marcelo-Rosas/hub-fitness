# M18 Comex — Clientes, Radar e operação como representante — Design

**Status:** Fase 1 implementada · 2026-11-16
**Relacionados:** [integração PUCOMEX](2026-08-13-pucomex-integracao-m18.md) · [skill comex](../../../.agents/skills/hub-fitness/references/comex.md) · [ADR-003](../../adr/ADR-003-database-per-client.md)

## 1. Intenção e porquê

A VECTRA quer vender **serviço de desembaraço aduaneiro** (comissária / 4PL): não importa,
não é trading, não compra nem revende. O importador é o cliente, com Radar próprio
(ex.: RM ACADEMIA LTDA, CNPJ raiz 60.450.605, Radar *Limitada até US$ 50 mil*,
Importador/Exportador, IN RFB 1.984/2020).

A VECTRA é cadastrada pelo cliente no Portal Único como **representante externa** e faz
todo o processo pelo HUB, sem abrir o Portal, **exceto o registro da declaração
(DI/DUIMP)**, que exige despachante aduaneiro com e-CPF próprio. O despachante será um
**parceiro externo ainda não definido**.

Receita da VECTRA = honorário por processo (NFS-e) → já modelado no painel 4PL / DRE.

## 2. Objetivos

1. Cadastro de **clientes importadores** em tabela própria (`cliente_id`), com dados do Radar e da representação.
2. Cadastro de **despachantes parceiros** (sem certificado por enquanto).
3. Todo processo Comex pertence a um cliente (`cliente_id`).
4. **Controle do limite do Radar**: somar o valor dos processos do cliente no período e avisar antes de estourar.
5. **Esteira do processo** na tela: etapas, quem executa, o que está bloqueado.
6. **Gerador de token de operador** no M18 (botões Gerar e Salvar).
7. **Benchmark ComexStat** (API pública MDIC) por NCM/país, para conferir preço e frete do processo.

## 3. Não-objetivos (agora)

- Registrar DI/DUIMP pelo HUB (depende do despachante parceiro e do e-CPF dele).
- Cofre de certificados (A1 de cliente ou de despachante). Certificado do cliente **nunca** será pedido.
- Consulta automática da habilitação Radar no Portal (dados digitados do print/tela do Portal).
- Migrar o Comex inteiro para Postgres persistente (problema separado; ver §8).
- Fases 3 e 4 da esteira (Catálogo de Produtos e rascunho de DUIMP) — só o espaço na esteira.

## 4. Anti-objetivos (seria fracasso mesmo funcionando)

- Pedir ou guardar o certificado A1 (e-CNPJ) do cliente.
- O servidor aceitar um token de operador vindo da tela quando nenhum existe (quem chega primeiro vira dono).
- Misturar clientes de Comex com a tabela `clients` do 3PL (Operator DB), que exige banco provisionado por cliente.
- Bloquear a criação de processo por causa do limite do Radar (é aviso, não trava: o limite real é da Receita).

## 5. Restrições

- App público, repo público, login mock forjável → autorização das rotas sensíveis só por `COMEX_OPERATOR_TOKEN` (já implementado em `comexGuard.ts`).
- Runtime Comex: Postgres se `DATABASE_URL`, senão SQLite no container (efêmero — some a cada deploy).
- Perfil `IMPEXP` no Portal aceita **só e-CPF** (tabela oficial em `environments.ts`). Representar o cliente provavelmente exige o **e-CPF** do Marcelo, não o e-CNPJ VECTRA HUB (`OPERPORT`). A validar com o despachante parceiro.
- Travas do projeto: Ad Valorem DRE = NF de serviço; Konnen = dogfood; não acoplar Freight LogiTwenty.

## 6. Abordagens consideradas

| | Abordagem | Prós | Contras |
|---|---|---|---|
| A | Cadastros como entidades de metadado (`comex_field_defs` + `payload jsonb`) | Rápido, coerente com processos | Regras do Radar (soma, período) ficam em jsonb sem tipo; dados herdam efemeridade |
| **B** | **Tabelas próprias tipadas (`comex_clients`, `comex_brokers`) no store Comex, `cliente_id` em `comex_processes`** | Regras do Radar com colunas reais; FK clara; isolado do 3PL | Migration + rotas novas |
| C | Linhas na tabela `clients` do Operator DB | Reaproveita cadastro 3PL | `database_ref NOT NULL` exige banco provisionado; cliente só-Comex não cabe |

**Escolhida: B** (decisão do Marcelo: "tabela própria do cliente_id, não do operador").

## 7. Design

### 7.1 Dados

```
comex_clients
  id (cliente_id) uuid PK
  cnpj_root text NOT NULL            -- 8 dígitos (tela do Radar mostra só a raiz)
  cnpj text                          -- 14 dígitos, opcional
  legal_name text NOT NULL
  trade_name text
  slug text UNIQUE                   -- compat. com comex_processes.client_slug
  radar_status text                  -- habilitada | suspensa | desabilitada | nao_habilitada
  radar_modality text                -- expressa | limitada_50k | limitada_150k | ilimitada
  radar_limit_usd numeric            -- derivado da modalidade, editável
  radar_operations text              -- ex.: IMPORTADOR/EXPORTADOR
  radar_legal_basis text
  radar_checked_at date              -- quando o Marcelo conferiu no Portal
  rep_status text                    -- pendente | ativa | vencida | revogada
  rep_certificate text               -- quem nos representa: "e-CPF Marcelo" | "e-CNPJ VECTRA HUB"
  rep_role_type text                 -- Role-Type usado no Portal
  rep_valid_from date, rep_valid_to date
  broker_id uuid → comex_brokers NULL
  notes text
  created_at, updated_at

comex_brokers
  id uuid PK
  name text NOT NULL, cpf text, rfb_registry text
  email text, phone text
  certificate_status text DEFAULT 'pendente'   -- sem PFX nesta fase
  active boolean DEFAULT true
  created_at, updated_at

comex_processes  + cliente_id uuid → comex_clients NULL
```

- DDL nova em `supabase/client/migrations/` ao lado de `comex_metadata.sql`, espelhada no SQLite de `comexStore.ts` (mesmo padrão dual sqlite/pg).
- `client_slug` existente é mantido; ao vincular `cliente_id`, o slug do cliente é copiado (compatibilidade).
- Sem `tenant_id`.
- **Obrigatoriedade** (*decisão Claude*): processo **novo** exige `cliente_id` (servidor e tela). Coluna continua `NULL` para os antigos, que aparecem como "sem cliente" com botão para vincular. Sem migração automática por `client_name` (texto livre, alto risco de vínculo errado). O campo `client_name` sai do formulário e passa a ser preenchido a partir do cliente. O padrão `COMEX_CLIENT_SLUG` deixa de ser usado em processo novo.

### 7.2 Limite do Radar

- Valor somado por processo de **importação** do cliente: FOB em US$ do `payload` (campo `kpi='fob'`). Exportação não conta.
- **Data do processo** (nova, *decisão Claude*): `radar_date` = data de registro da DUIMP se houver; senão data prevista de chegada (`eta_date`, novo campo em `comex_field_defs`); senão `created_at`. Os dois campos novos entram no seed.
- **Janela** (*decisão Claude*): os 6 meses que **terminam** na data de referência. No cadastro do cliente e em `radar-usage`, a referência é hoje. Ao salvar um processo, a referência é o `radar_date` dele (soma inclui o próprio processo). Alternativa "semestre civil" é global: `COMEX_RADAR_WINDOW=rolling|calendar` (padrão `rolling`).
- Faixas: < 80% ok · 80–100% atenção · > 100% estouro. Mostrado no cadastro do cliente, no topo do processo e no momento de salvar um processo novo (aviso, não bloqueio).
- **Base FOB × CIF** (*decisão Claude*): padrão FOB US$. Para permitir CIF, novo campo `cif_value_usd` no seed (o `cif_value_brl` atual continua só como pitch). Base escolhida por `COMEX_RADAR_BASIS=fob|cif`; processo sem o valor da base conta 0 e gera aviso "valor faltando".
- **A validar com o despachante/tributarista** (IN RFB 1.984/2020): base de cálculo e janela. Até lá, a tela mostra "regra a validar".
- ~~Ponte com o painel 4PL~~ — **removida do escopo** (*decisão Claude*): o painel 4PL é simulação do plano, sem vínculo por cliente; ligar os dois fica para depois.

### 7.3 Esteira do processo (UI)

```
RM ACADEMIA LTDA · Radar Limitada · usado US$ 38.200 / 50.000 (6 meses) ⚠
Processo IMP-2026-014 · Spin bikes 9506.91.00 · FOB US$ 12.000
[✓] Docs PI/PL  [✓] NCM  [ ] Catálogo  [—] LPCO  [✓] BL  [ ] Rascunho DUIMP
[🔒 Registro DUIMP — aguardando despachante]  [ ] Tributos  [ ] Canal  [ ] Entrega
```

Etapas, executor e o que já existe:

| # | Etapa | Executor | Nesta fase |
|---|---|---|---|
| 1 | Cliente + aviso Radar | VECTRA | **Novo** |
| 2 | PI / Packing List (PDF→JSON) | VECTRA | Existe (ingest) |
| 3 | NCM + atributos | VECTRA | Existe (consulta NCM) |
| 4 | Catálogo de Produtos + exportador estrangeiro | VECTRA | Etapa manual (marcar feito) |
| 5 | LPCO (se exigido) | VECTRA | Etapa manual |
| 6 | BL / embarque | VECTRA | Existe (ingest BL) |
| 7 | Rascunho DUIMP | VECTRA | Etapa manual |
| 8 | Registro DUIMP | Despachante | Bloqueada sem `broker_id` |
| 9 | Tributos | Despachante/VECTRA | Etapa manual |
| 10 | Canal / desembaraço / entrega | VECTRA | Existe (consulta DUIMP) |
| 11 | Honorário NFS-e → DRE 4PL | VECTRA | Etapa manual |

- Estado de cada etapa no `payload.pipeline` do processo: `{ etapa: { status: 'pendente'|'feito'|'na'|'bloqueado', at, by, note } }`.
- Etapas "existe" marcam feito automaticamente quando o dado correspondente existe (doc ingerido, NCM preenchido, consulta OK).

### 7.4 Gerador de token de operador

- Botão **Gerar**: `crypto.getRandomValues` 32 bytes → hex, no navegador.
- Botão **Salvar**: grava em `sessionStorage` (já usado pelo header `x-comex-token`), copia para a área de transferência e mostra o comando pronto:
  `$token = '<valor>'; $token | npx.cmd wrangler secret put COMEX_OPERATOR_TOKEN` (com aviso de não colar o prompt `PS C:\>` junto).
- O servidor **não** recebe nem grava o token por essa tela. Registro = secret na Cloudflare (ou `.env` local).
- Valor mascarado por padrão, com botão mostrar/ocultar.

### 7.5 Benchmark ComexStat (MDIC)

API pública sem autenticação: `https://api-comexstat.mdic.gov.br` (OpenAPI em `/docs/doc.yaml`). Testado em 2026-11-16: dados até 2026-10.

- Rota HUB `POST /api/comex/benchmark` → chama `POST /general` com `flow=import`, filtro `ncm` (+ `country` opcional), `details: ['country']` ou `['state','urf']`, métricas `metricFOB, metricKG, metricFreight, metricCIF`. Cache em memória 24h (dados mensais; limites de execução da API).
- No processo: **US$/kg FOB** do processo × média do país de origem nos últimos 12 meses; **frete/FOB** do processo × média. Aviso quando fora de faixa (ex.: < 50% da média → risco de valoração aduaneira).
- Exemplo real (NCM 9506.91.00, 2025): China US$ 211,1 mi FOB / 93,8 mil t → **US$ 2,25/kg**; frete ≈ **13,8% do FOB**; Itajaí é a URF nº 1 dessa NCM vinda da China.
- Ressalva exibida na tela: a NCM agrega produtos muito diferentes (halteres a esteiras), então a média é referência, não prova.
- Substitui o "chute" do Gemini na aba Auditoria NCM IA como fonte de números (o Gemini pode continuar comentando).
- Não é rota do certificado → sem `requireComexOperator`.

### 7.6 Rotas novas

| Rota | Trava |
|---|---|
| CRUD `/api/comex/clients` | `requireComexOperator` (dados de terceiros) |
| `GET /api/comex/clients/:id/radar-usage` | `requireComexOperator` |
| CRUD `/api/comex/brokers` | `requireComexOperator` |
| `PATCH /api/comex/processes/:id/pipeline` | `requireComexOperator` |
| `POST /api/comex/benchmark` | livre (dado público), rate limit simples |

**Trava geral (decisão do Marcelo, 2026-11-16):** **todo** `/api/comex/*` exige `x-comex-token`, inclusive em DEMO e em dev — processos, field-defs, ingest, documentos, clientes, despachantes. Livres só: `GET /api/comex/pucomex/status`, `GET /api/comex/pucomex/catalog` e `POST /api/comex/benchmark`.

- Nova trava `requireComexOperatorStrict`: sem `COMEX_OPERATOR_TOKEN` no servidor → **503 sempre** (não libera em DEMO). As rotas do certificado passam a usá-la também.
- `GET /api/comex/documents/:id/file` é aberto via `<a href>` (sem header) → servir por `fetch` com header + `blob` na tela, ou link assinado de curta duração (escolha do construtor).
- M18: todas as chamadas `/api/comex/*` usam `comexOperatorHeaders()`; sem token salvo, a tela mostra só o gerador/campo de token.
- `.env.example` e testes (`comex-pucomex-guard.test.ts`) atualizados para o comportamento estrito.

## 8. Fica para o construtor / pendências

- **Minha decisão (Claude):** janela móvel de 6 meses como padrão; limiar de aviso 80%; cache ComexStat 24h; etapas no `payload.pipeline` (sem tabela nova).
- **Pendente de fonte externa:** base de cálculo do limite Radar e Role-Type do representante (`IMPEXP` com e-CPF?). Exibir como "a validar" até confirmação.
- **Persistência:** sem `DATABASE_URL` em produção, cadastros somem a cada deploy. Recomendado ligar Postgres antes de cadastrar clientes reais.
- **ADR-003:** `comex_*` vive no diretório de migrations do Client DB mas roda num único banco com vários clientes. Registrar a exceção (Comex = cadastro da comissária, não do cliente) num adendo ao ADR.
- ~~Trava nas rotas de processos/field-defs/ingest~~ → incluída (§7.6, trava geral).
- **Deploy:** com a trava geral, o M18 em produção só funciona depois do secret `COMEX_OPERATOR_TOKEN` gravado na Cloudflare.

## 9. Fases

1. Trava geral estrita + gerador de token (primeiro: o resto depende dele); tabelas + rotas + telas de clientes e despachantes; `cliente_id` no processo; limite do Radar.
2. Esteira do processo + benchmark ComexStat.
3. Catálogo de Produtos via API (quando o live autenticar).
4. Rascunho DUIMP → pacote para o despachante.
