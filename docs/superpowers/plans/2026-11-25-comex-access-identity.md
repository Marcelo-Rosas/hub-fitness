# M18 Comex — acesso pela identidade do Cloudflare Access — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Operador logado no Cloudflare Access usa o M18 Comex sem colar token.

**Architecture:** O Worker valida o JWT do Access (`Cf-Access-Jwt-Assertion`) com WebCrypto e repassa ao container um header confiável `x-hub-access-email` (sempre removendo a cópia do cliente). O gateway Comex autoriza se esse e-mail estiver em `COMEX_ALLOWED_EMAILS` ou, como fallback local, se `x-comex-token` for válido. O front só mostra o painel de token quando `/status` diz `authorized=false`.

**Tech Stack:** Cloudflare Workers + Containers, Express, React, Vitest (raiz, `environment: node`).

**Spec:** `docs/superpowers/specs/2026-11-25-comex-access-identity-design.md`

## Global Constraints
- Header confiável: `x-hub-access-email` (minúsculo). Worker SEMPRE remove o do cliente.
- Vars do Worker: `CF_ACCESS_TEAM_DOMAIN` (ex. `xxx.cloudflareaccess.com`, sem `https://`), `CF_ACCESS_AUD`. Sem qualquer uma → nunca seta o header.
- Secret: `COMEX_ALLOWED_EMAILS` (lista por vírgula, comparação case-insensitive, trim). Repassado em `PASSTHROUGH_ENV`.
- Códigos de erro inalterados: 503 `COMEX_OPERATOR_TOKEN_UNSET` (nem lista nem token configurados), 401 `COMEX_OPERATOR_TOKEN_REQUIRED`.
- Nenhum e-mail real no repositório (repo público). `/status` nunca devolve a lista de e-mails.
- Sem dependências novas (WebCrypto nativo; Node 20 tem `globalThis.crypto.subtle`).

## Review Focus
- JWT com `aud` como array (Access manda array) → aceitar se contém `CF_ACCESS_AUD`. Teste na Task 1.
- `kid` desconhecido (rotação de chave) → refaz fetch do JWKS uma vez antes de recusar. Teste na Task 1.
- Cliente envia `x-hub-access-email` forjado sem JWT → Worker remove; gateway sozinho confia no header, então o teste da Task 2 cobre "e-mail fora da lista = 401" e a Task 3 cobre a remoção.
- E-mail com maiúsculas/espaços na lista ou no JWT → normalizar. Teste na Task 2.
- JWT expirado (`exp` < agora) ou `iss` de outra equipe → null. Teste na Task 1.

---

### Task 1: Verificação do JWT do Access (módulo puro)

**Files:**
- Create: `workers/hub-fitness-proxy/src/accessIdentity.ts`
- Test: `src/__tests__/worker-access-identity.test.ts`

**Interfaces:**
- Produces:
  - `type JwksFetcher = (url: string) => Promise<{ keys: JsonWebKey[] }>`
  - `verifyAccessJwt(token: string, opts: { teamDomain: string; aud: string; now?: number; fetchJwks?: JwksFetcher }): Promise<string | null>` → e-mail minúsculo ou `null`. Nunca lança.
  - `clearJwksCache(): void` (testes)

- [ ] **Step 1: Write the failing tests** — gerar par RSA com `crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5', modulusLength:2048, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'}, true, ['sign','verify'])`, exportar JWK público com `kid:'k1'`, assinar JWT RS256 em base64url. `teamDomain='equipe.cloudflareaccess.com'`, `aud='AUD123'`, iss=`https://equipe.cloudflareaccess.com`.
  - `válido → 'op@exemplo.com'` (payload `email:'Op@Exemplo.com'`, `aud:['AUD123']`, `exp` futuro)
  - `aud diferente → null`
  - `iss de outra equipe → null`
  - `exp no passado → null`
  - `assinatura adulterada (payload trocado) → null`
  - `alg diferente de RS256 no header → null`
  - `kid desconhecido: 1º fetch sem a chave, 2º com → válido; fetchJwks chamado 2x`
  - `token malformado ('abc') → null`
  - `fetchJwks lança → null`
  - fetcher recebe `https://equipe.cloudflareaccess.com/cdn-cgi/access/certs`

- [ ] **Step 2:** `npx.cmd vitest run src/__tests__/worker-access-identity.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implement** — decodificar header/payload base64url; exigir `alg==='RS256'`; achar JWK por `kid` no cache (Map por teamDomain, TTL 1 h); se ausente, refetch uma vez; `crypto.subtle.importKey('jwk', …, {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['verify'])` e `verify` sobre `header.payload`. Checar `iss`, `aud` (string ou array), `exp`/`nbf` em segundos vs `now ?? Date.now()`. Fetcher padrão: `fetch(url).then(r => r.json())`. Tudo em try/catch → `null`.

- [ ] **Step 4:** mesmo comando → PASS.

- [ ] **Step 5: Commit** `feat(worker): verifica JWT do Cloudflare Access (accessIdentity)`

### Task 2: Gateway Comex aceita identidade do Access

**Files:**
- Modify: `src/core/comex/comexGuard.ts`, `src/core/comex/registerPucomexRoutes.ts:163`, `src/types/comex.ts:234-237`
- Test: `src/__tests__/comex-pucomex-guard.test.ts` (adicionar `COMEX_ALLOWED_EMAILS` a `ENV_KEYS`)

**Interfaces:**
- Produces:
  - `export const ACCESS_EMAIL_HEADER = 'x-hub-access-email'`
  - `comexAuthVia(req: Pick<Request,'headers'>): 'access' | 'token' | null`
  - `isValidComexOperatorToken(req)` passa a ser `comexAuthVia(req) !== null` (mantém nome; usado por `comexAiNcm.ts`)
  - `comexGuardStatus(req: Pick<Request,'headers'>)` → `{ operatorTokenRequired: true, operatorTokenConfigured: boolean, accessEmailConfigured: boolean, authorized: boolean, via: 'access'|'token'|null }`
  - `ComexGuardStatus` em `src/types/comex.ts` ganha os três campos novos.

- [ ] **Step 1: Write the failing tests** (rota protegida = `GET /api/comex/processes`):
  - `COMEX_ALLOWED_EMAILS=' Op@Exemplo.com ,b@x.com'` + header `x-hub-access-email: op@exemplo.com` → 200
  - mesma lista + header `intruso@x.com` → 401 `COMEX_OPERATOR_TOKEN_REQUIRED`
  - só `COMEX_ALLOWED_EMAILS`, sem header nem token → 401 (não 503)
  - nenhum configurado → 503 `COMEX_OPERATOR_TOKEN_UNSET` (teste existente continua)
  - token válido sem lista → 200 (testes existentes continuam)
  - `GET /api/comex/pucomex/status` com e-mail autorizado → `guard.authorized===true`, `guard.via==='access'`, `guard.accessEmailConfigured===true`, e o JSON não contém `b@x.com`

- [ ] **Step 2:** `npx.cmd vitest run src/__tests__/comex-pucomex-guard.test.ts` → novos FAIL.

- [ ] **Step 3: Implement** — `allowedEmails()` lê e normaliza a lista; `comexAuthVia` testa e-mail primeiro, depois token (`safeEqual` existente). `requireComexOperatorStrict`: 503 se nem lista nem token configurados; 401 se `comexAuthVia` null. Status passa `req` para `comexGuardStatus(req)`.

- [ ] **Step 4:** mesmo comando + `npx.cmd vitest run src/__tests__` → PASS.

- [ ] **Step 5: Commit** `feat(m18): gateway Comex aceita e-mail do Cloudflare Access`

### Task 3: Worker repassa a identidade

**Files:**
- Modify: `workers/hub-fitness-proxy/src/index.ts`, `workers/hub-fitness-proxy/wrangler.jsonc` (vars `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` vazias com comentário)
- Test: `src/__tests__/worker-access-identity.test.ts` (adicionar)

**Interfaces:**
- Consumes: `verifyAccessJwt` (Task 1)
- Produces: `export async function applyAccessIdentity(incoming: Headers, upstream: Headers, env: { CF_ACCESS_TEAM_DOMAIN?: string; CF_ACCESS_AUD?: string }, verify = verifyAccessJwt): Promise<void>` exportada de `accessIdentity.ts`.

- [ ] **Step 1: Write the failing tests:**
  - upstream com `x-hub-access-email: forjado@x.com` e sem JWT → header removido
  - env sem `CF_ACCESS_AUD` → não chama `verify`, header ausente
  - JWT válido (verify stub → `'op@exemplo.com'`) → upstream tem `x-hub-access-email: op@exemplo.com`
  - verify → null → header ausente

- [ ] **Step 2:** rodar → FAIL.

- [ ] **Step 3: Implement** `applyAccessIdentity`; em `index.ts`: `x-hub-access-email` entra em `SPOOFABLE`; no `fetch`, após `buildUpstreamHeaders`, `await applyAccessIdentity(request.headers, headers, env)`. `Env` ganha `CF_ACCESS_TEAM_DOMAIN?`, `CF_ACCESS_AUD?`, `COMEX_ALLOWED_EMAILS?`; `COMEX_ALLOWED_EMAILS` entra em `PASSTHROUGH_ENV`.

- [ ] **Step 4:** testes PASS + `cd workers\hub-fitness-proxy; npx.cmd tsc --noEmit` sem erros.

- [ ] **Step 5: Commit** `feat(worker): repassa e-mail do Access ao container (x-hub-access-email)`

### Task 4: Front esconde o painel quando autorizado + docs

**Files:**
- Modify: `src/components/modules/M18Comex.tsx:169`, `.agents/skills/hub-fitness/references/comex.md` (seção Trava geral), `.env.example` (documentar `COMEX_ALLOWED_EMAILS`, sem e-mail real)

- [ ] **Step 1: Implement** — `needsToken = tokenRejected || (guard ? !guard.authorized : !getComexOperatorToken())`. Status carrega antes de decidir (guard null + sem token = painel, como hoje).
- [ ] **Step 2:** `npx.cmd vitest run` → tudo PASS; `npx.cmd tsc --noEmit -p .` sem erros novos nos arquivos tocados.
- [ ] **Step 3: Commit** `feat(m18): painel de token só aparece sem identidade autorizada`

### Task 5: Deploy (manual, com o usuário)
- [ ] Usuário fornece domínio da equipe e AUD → preencher `wrangler.jsonc`.
- [ ] Usuário confirma estado do `DATABASE_URL` (deploy reinicia o container; sem ele, SQLite é apagado).
- [ ] `cd workers\hub-fitness-proxy; npx.cmd wrangler secret put COMEX_ALLOWED_EMAILS` (usuário digita o próprio e-mail).
- [ ] Deploy e teste: abrir `hub.vectracargo.com.br` → M18 sem painel de token.
