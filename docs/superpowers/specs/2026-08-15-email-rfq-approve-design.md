# Spec — Plan B: aprovação RFQ por e-mail (token)

**Data:** 2026-08-15 (rev. auditoria matrizes + ledger cotações)  
**Status:** rascunho (aguardando review humano)  
**Contexto:** M19 aprova só com login + `x-user-email`. Outbox hoje só dispara `WORKFLOW.APPROVED` (e-mail ao fornecedor). Assignee não recebe aviso no SUBMIT. Spec RBAC marcou Plan B como fora de escopo — esta spec fecha o canal **e** trava divergência de preços (Gemini/estimativa vs RFQ).

**URL pública de referência:** `https://hub.vectracargo.com.br` (`APP_URL`).

## Problema

Aprovador (ex. Sócio) precisa decidir RFQ fora do app (e-mail / mobile). Sem link assinado, a fila só vive no M19. Pitch e operação real exigem paridade de decisão no e-mail **e** no M19.

**Problema colateral (observado 2026-08-15):** valores do Comparador/M19 **divergem** da matriz de pesquisa; `score` parece “qualidade do modelo” mas é **hardcode** no ingest; RFQ pode ser aprovado com preço `null`. Sem ledger de fornecedor/cotação, alçada não audita origem do número.

## Decisões

1. **Canais iguais:** assignee decide via **e-mail (token)** **ou** login M19. Mesmo `executeStepDecision`.
2. **UI do link = paridade M19:** brief comercial + 3 botões — **Aprovar** / **Pedir correção** / **Rejeitar** + campo motivo (obrigatório em correção/rejeição). Inclui banner de dossiê incompleto quando aplicável.
3. **Token opaco** (não JWT): raw só no e-mail; DB guarda `sha256`. TTL **48h**, **one-shot** (`used_at`).
4. **Notify:** outbox `ASSIGNMENT.NOTIFY` no SUBMIT/RESUBMIT; envio via mesmo pipeline do fornecedor (`INTRANET_EMAIL_LIVE` + `RESEND_API_KEY` → live; senão simulated).
5. **Abordagem 1** (Express HTML em `/approve/:token`) — não Worker CF, não JWT stateless.
6. **Regra canônica de volume (alçada):** avaliação de “volume operacional” no dossiê **só** a partir do **3º mês de operação real**. Operação real = flag manual do **Sócio** (`ops_real_started` + `ops_real_started_at`). Antes do flag, ou nos meses 1–2 após o start: volume `1 un` / vazio **não** entra em `gaps`. Preço unitário, landed e prazo continuam avaliados sempre.
7. **Ledger canônico fornecedor + cotação** (SQLite operator): toda linha do Comparador e todo RFQ **apontam** para `quote_id`. Preço Gemini/pesquisa = `price_type=estimativa` e **não** vira verdade de alçada até RFQ/`price_type=rfq_confirmado`. `score` deixa de fingir confiança do LLM — vira fórmula explícita (ou some do brief até recalibrar).
8. **Ordem de build:** (0) tabelas + auditoria/gaps volume, (1) token e-mail Plan B. Token sem ledger = alçada continua cega.

## Anexo A — Avaliação real das matrizes (2026-08-15)

Fontes: pack `compras-research-fitas-pet.json`, folhas RFQ exemplo (stretch/palete/empilhadeira/fitas), RFQs **live** em `hub.vectracargo.com.br` (só 2 na base Railway no momento da auditoria). Código: `src/ingest/mapPacks.ts` (`score: isWinner ? 92 : state === 'SC' ? 86 : 80`).

### Matriz 1 — Pesquisa Fitas PET (estimativa pack)

| Fornecedor | UF | unit | frete/mês | landed | price_type |
|------------|:--:|-----:|----------:|-------:|------------|
| Polifita Embalagens (recomendado pack) | SC | 148,50 | 32 | 180,50 | estimativa |
| Mosca Embalagens | PR | 139,00 | 48 | 187,00 | estimativa |
| Cyklop do Brasil | SP | 134,00 | 62 | 196,00 | estimativa |

### Matriz 2 — RFQ-2026-001 live (IN_REVIEW) — Mosplast

| Campo | Valor |
|-------|------:|
| unit_price | **182,50** |
| freight_monthly | 35 |
| landed_monthly | **217,50** |
| score UI | **86** |
| volume | 1 un / mês |

**Divergência:** Mosplast **não** está na matriz 1. Landed 217,50 ≠ nenhum landed do pack (180,50 / 187 / 196). Score 86 = hardcode SC no ingest, **não** output Gemini.

### Matriz 3 — RFQ-2026-002 live (APPROVED) — Mosplast

| Campo | Valor |
|-------|------:|
| unit / frete / landed / score | **todos null** |
| volume | 1 un / mês |
| email_status | simulated |

**Divergência crítica:** aprovado **sem** dossiê comercial. Confirma risco de alçada cega (mesmo com banner só em 001).

### Matriz 4 — Folha RFQ Fitas PET (exemplo)

Suppliers com `unit_price_brl: 0` / landed 0 — template PREENCHER. Não é cotação real.

### Matriz 5 — Folhas Stretch + Palete + Empilhadeira (exemplo)

Mesmo padrão: preços 0, notes “não usar seed/pesquisa no DRE”. Deep-research example também zera stretch.

### Veredito auditoria

| Sintoma | Causa raiz | Não é |
|---------|------------|--------|
| Score 86 “bonito” | Hardcode UF/vencedor em `mapPacks` | Confiança do modelo |
| Preço RFQ ≠ pesquisa | Ingest/Comparador gera outra linha; pack ≠ supplier enviado | Só “alucinação” Gemini |
| Pack diz Polifita 180,50; RFQ Mosplast 217,50 | Fornecedor/preço **outro** no fluxo M10 | Erro de aritmética 148+32 |
| APPROVED sem preço | Payload incompleto + APPROVE permitido | Falha Resend |

**Conclusão:** há mistura de **estimativa LLM/pack**, **números editados no Comparador** e **score cosmético**. Sem tabela de cotações versionadas, o board não distingue. Plan B deve **persistir** a matriz antes do token.

## Decisão de dados — `suppliers` + `quotes`

### `intranet_suppliers`

| Coluna | Notas |
|--------|--------|
| `id` | PK |
| `trade_name`, `legal_name?`, `email`, `cnpj?`, `city`, `uf` | |
| `contact_phone?`, `website?` | |
| `source` | `ingest` \| `manual` \| `gemini_research` |
| `created_at`, `updated_at` | |

### `intranet_quotes`

| Coluna | Notas |
|--------|--------|
| `id` | PK (= `quote_id` no payload RFQ) |
| `supplier_id` | FK |
| `account_code?`, `category`, `item_description` | |
| `unit_price_brl`, `freight_monthly_brl`, `landed_monthly_brl` | |
| `volume_label`, `lead_time_days`, `payment_terms?` | |
| `price_type` | `estimativa` \| `rfq_fornecedor` \| `rfq_confirmado` \| `manual` |
| `price_date?`, `sources_json` | rastreio anti-alucinação |
| `matrix_id?` | agrupa as N linhas de uma rodada Comparador |
| `score_display?` | se mantido: documentar fórmula; senão null |
| `research_pack_hash?` | opcional |
| `created_at` | |

### Regras

- SUBMIT RFQ exige `payload.quote_id` existente **ou** cria quote `price_type=manual` a partir do payload na hora (audit trail).  
- Brief M19/HTML mostra `price_type` + origem.  
- Gap preço: se `price_type=estimativa`, banner “estimativa — preferir Pedir correção / RFQ confirmado” (além dos gaps atuais).  
- `APPROVE` com `unit_price`/`landed` null → **bloqueado** (400), exceto se Sócio override explícito (fora v1: só bloquear).  
- Score: remover hardcode UF da UI de alçada **ou** renomear para “score heurístico SC/SP” no label — nunca “confiança IA”.

## Fora de escopo (v1)


- Magic link de login no app SPA  
- Aprovação por WhatsApp  
- Multi-step token por cada step futuro (v1 = 1 assignment ativa)  
- UI pra editar matriz RBAC  
- Troca de stack (continua Express + SQLite operator)

## Arquitetura

```
M10/API SUBMIT
  → approvalService: request + assignment + audit
  → mint token (raw → e-mail; hash → DB)
  → outbox ASSIGNMENT.NOTIFY { to, approveUrl, code, brief… }

Dispatcher (~3s)
  → sendAssigneeNotifyEmail (Resend | simulated)
  → outbox PROCESSED

Assignee
  A) GET  /approve/:token  → HTML (brief + 3 ações)
     POST /approve/:token  → { action, reason?, expectedVersion }
       → resolve assignee pelo token
       → executeStepDecision(...)
       → marca token used_at
  B) M19 logado → POST /api/intranet/requests/:id/{approve|reject|request-changes}
       (inalterado; se decidir antes, token fica órfão → GET mostra “já decidido”)

APPROVED → outbox WORKFLOW.APPROVED → e-mail fornecedor (existente)
```

Base dos links: `process.env.APP_URL` (prod: `https://hub.vectracargo.com.br`).

## Dados

### `intranet_approval_tokens`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | text PK | |
| `token_hash` | text UNIQUE | sha256 hex do raw |
| `request_id` | text FK | |
| `assignment_id` | text FK | |
| `assignee_employee_id` | text | denormalizado p/ audit |
| `expires_at` | text ISO | created + 48h |
| `used_at` | text ISO nullable | one-shot |
| `created_at` | text ISO | |

Raw token: ≥32 bytes `crypto.randomBytes`, encoding URL-safe base64/hex.

### Flag operação real

Persistência operator (SQLite key-value ou colunas em settings / `hub_ops_flags`):

- `ops_real_started` boolean (default false)  
- `ops_real_started_at` ISO nullable — setado **no momento** em que o Sócio liga o flag (não editável retroativo na v1, salvo religar após desligar = novo timestamp)

API: só `requireSocio` pode PATCH. UI: toggle em M19 (aba org / faixa Fila).

### Helper dossiê (compartilhado M19 + HTML)

Extrair lógica de `RfqCommercialBrief` gaps para função pura, ex. `dossierGaps(payload, opsFlags, now)`:

- Sempre: falta preço unitário / landed / prazo  
- Volume (`!volume` ou `/1\s*un/i`): **somente se** `ops_real_started` e `now >= ops_real_started_at + 2 meses` (início do 3º mês)

## Componentes / arquivos (alvo)

| Peça | Onde |
|------|------|
| Schema + ensure table | `intranetStore` + migrations tokens **e** `suppliers`/`quotes` + ops flags |
| Mint / consume token | `src/core/intranet/approvalTokens.ts` (novo) |
| Quote ledger | `src/core/intranet/quoteLedger.ts` (novo) — upsert supplier/quote no ingest + SUBMIT |
| Hook SUBMIT/RESUBMIT | `approvalService.ts` — quote_id + mint + NOTIFY; RESUBMIT invalida tokens |
| Outbox handler | `outboxDispatcher.ts` — case `ASSIGNMENT.NOTIFY` |
| E-mail assignee | `sendAssigneeNotifyEmail` em `sendSupplierEmail.ts` ou módulo irmão |
| Rotas HTML | `registerApproveRoutes.ts` — GET/POST `/approve/:token` |
| HTML template | string server-side (mobile-first), visual alinhado ao card M19 |
| Toggle ops | M19 + rota PATCH socio |
| Score / gaps | `dossierGaps` pura + label score; bloquear APPROVE sem preço |
| Testes | `intranet-email-approve.test.ts` + `quote-ledger.test.ts` |

## Contratos HTTP

### `GET /approve/:token`

- 200 HTML se token válido, não usado, não expirado, request `IN_REVIEW`, assignment ativa  
- 404 inválido  
- 410 expirado  
- 409 já usado / já decidido (mostra status atual)

### `POST /approve/:token`

Body JSON ou form:

```json
{
  "action": "APPROVE" | "REJECT" | "REQUEST_CHANGES",
  "reason": "string?",
  "expectedVersion": 1
}
```

- REJECT / REQUEST_CHANGES sem `reason` trim → 400  
- Sucesso → HTML confirmação (ou redirect 303 para GET com flash)  
- Erros FSM/version → mesmos códigos da API JSON, renderizados em HTML

Sem header `x-user-email`: actor = employee do token.

### Notify e-mail

Assunto: `[HUB] RFQ {code} aguarda sua alçada`  
Corpo: brief curto + CTA único `approveUrl`  
Simulated: outbox OK + log; opcional expor URL no payload outbox p/ debug M19.

## Erros (resumo)

| Caso | Resposta |
|------|----------|
| Hash miss | 404 |
| `expires_at < now` | 410 |
| `used_at` set / status ≠ IN_REVIEW | 409 |
| VERSION_CONFLICT | 409 + “atualize a página” |
| Motivo faltando | 400 |
| M19 já decidiu | GET 409; POST 409 |
| RESUBMIT | tokens anteriores `used_at` ou expires forçado; mint novo + NOTIFY |

## Segurança

- Só hash no DB; raw ≥32 bytes  
- Sem sessão na rota `/approve`  
- Rate limit POST por IP (ex. ~30/min)  
- Token não aparece em `GET inbox`  
- Audit: decisão via token registra meta `channel: email_token`  
- Só assignee da assignment ativa consome (employee_id do token deve bater com assignment)

## Testes de aceite

1. SUBMIT cria token hash + outbox `ASSIGNMENT.NOTIFY`  
2. Simulated mail / payload contém URL `/approve/{raw}`  
3. GET HTML mostra brief + 3 botões; warning volume **ausente** com flag off e volume `1 un`  
4. Flag on + `ops_real_started_at` há ≥2 meses + `1 un` → warning volume presente  
5. POST APPROVE → request APPROVED; token `used_at`; fornecedor outbox como hoje  
6. POST REJECT sem motivo → 400; com motivo → REJECTED  
7. POST REQUEST_CHANGES → CHANGES_REQUESTED  
8. Reuso token / expiry 48h / M19 decide antes → 409/410 conforme tabela  
9. RESUBMIT invalida token antigo e emite novo NOTIFY  
10. Ingest/Comparador persiste N linhas em `intranet_quotes` + `intranet_suppliers` com `price_type=estimativa`  
11. RFQ SUBMIT grava `payload.quote_id`; brief mostra price_type  
12. APPROVE com unit/landed null → 400  
13. Label score não afirma “confiança IA” (heurística ou oculto)  
14. Replay auditoria Anexo A: quote Polifita 180,50 ≠ RFQ Mosplast 217,50 convivem como linhas **distintas** no ledger

## Não-objetivos de UX

- Não embutir SPA React no e-mail  
- Não exigir login Google no link  
- Não enviar o raw token em webhooks públicos além do e-mail do assignee
