# Spec — Plan B: aprovação RFQ por e-mail (token)

**Data:** 2026-08-15  
**Status:** rascunho (aguardando review humano)  
**Contexto:** M19 aprova só com login + `x-user-email`. Outbox hoje só dispara `WORKFLOW.APPROVED` (e-mail ao fornecedor). Assignee não recebe aviso no SUBMIT. Spec RBAC marcou Plan B como fora de escopo — esta spec fecha o canal.

**URL pública de referência:** `https://hub.vectracargo.com.br` (`APP_URL`).

## Problema

Aprovador (ex. Sócio) precisa decidir RFQ fora do app (e-mail / mobile). Sem link assinado, a fila só vive no M19. Pitch e operação real exigem paridade de decisão no e-mail **e** no M19.

## Decisões

1. **Canais iguais:** assignee decide via **e-mail (token)** **ou** login M19. Mesmo `executeStepDecision`.
2. **UI do link = paridade M19:** brief comercial + 3 botões — **Aprovar** / **Pedir correção** / **Rejeitar** + campo motivo (obrigatório em correção/rejeição). Inclui banner de dossiê incompleto quando aplicável.
3. **Token opaco** (não JWT): raw só no e-mail; DB guarda `sha256`. TTL **48h**, **one-shot** (`used_at`).
4. **Notify:** outbox `ASSIGNMENT.NOTIFY` no SUBMIT/RESUBMIT; envio via mesmo pipeline do fornecedor (`INTRANET_EMAIL_LIVE` + `RESEND_API_KEY` → live; senão simulated).
5. **Abordagem 1** (Express HTML em `/approve/:token`) — não Worker CF, não JWT stateless.
6. **Regra canônica de volume (alçada):** avaliação de “volume operacional” no dossiê **só** a partir do **3º mês de operação real**. Operação real = flag manual do **Sócio** (`ops_real_started` + `ops_real_started_at`). Antes do flag, ou nos meses 1–2 após o start: volume `1 un` / vazio **não** entra em `gaps`. Preço unitário, landed e prazo continuam avaliados sempre.

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
| Schema + ensure table | `intranetStore` + `supabase/migrations/…_approval_tokens.sql` (+ flag se precisar migration) |
| Mint / consume token | `src/core/intranet/approvalTokens.ts` (novo) |
| Hook SUBMIT/RESUBMIT | `approvalService.ts` — após assignment, mint + outbox NOTIFY; RESUBMIT invalida tokens abertos da request |
| Outbox handler | `outboxDispatcher.ts` — case `ASSIGNMENT.NOTIFY` |
| E-mail assignee | `sendAssigneeNotifyEmail` em `sendSupplierEmail.ts` ou módulo irmão |
| Rotas HTML | `registerIntranetRoutes.ts` ou `registerApproveRoutes.ts` — GET/POST `/approve/:token` |
| HTML template | string server-side (mobile-first), visual alinhado ao card M19 (sem chrome SPA) |
| Toggle ops | M19 + rota PATCH socio |
| Testes | `src/__tests__/intranet-email-approve.test.ts` (+ gaps volume) |

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

## Não-objetivos de UX

- Não embutir SPA React no e-mail  
- Não exigir login Google no link  
- Não enviar o raw token em webhooks públicos além do e-mail do assignee
