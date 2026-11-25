# M18 Comex — acesso pela identidade do Cloudflare Access

Data: 2026-11-25 · Tamanho: mudança pequena

## Intenção
O operador (hoje só o dono) precisa entrar no M18 sem colar token. O site já exige login do
Cloudflare Access; o Comex passa a confiar nessa identidade em vez do `COMEX_OPERATOR_TOKEN`
colado no navegador (que some, é regenerado por engano e trava o acesso).

## Metas / não-metas / anti-metas
- Meta: abrir o M18 logado no Access → Comex funciona direto, sem painel de token.
- Meta: só e-mails autorizados no servidor usam rotas mTLS/disco.
- Não-meta: login próprio, passkey, papéis/permissões por usuário.
- Anti-meta: qualquer caminho em que o cliente consiga se passar por outro e-mail (header forjado).
- Anti-meta: e-mail real do operador no repositório (repo público) — só em secret.

## Abordagens consideradas
- **A. Identidade do Cloudflare Access (escolhida pelo usuário).** Zero passo extra; reusa login existente.
- B. Passkey/WebAuthn: 1 toque, mas exige cadastro, persistência de chaves (SQLite efêmero) e recuperação. Login duplicado.
- C. Token salvo no localStorage (estado atual): ainda há segredo para guardar e colar por navegador.

## Desenho
1. **Worker (`workers/hub-fitness-proxy/src/index.ts`)**
   - Sempre remove do request do cliente `x-hub-access-email` (entra em `SPOOFABLE`).
   - Lê `Cf-Access-Jwt-Assertion`; valida RS256 contra JWKS
     `https://<CF_ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs` (cache em memória), `aud` = `CF_ACCESS_AUD`,
     `iss` = `https://<CF_ACCESS_TEAM_DOMAIN>`, `exp`/`nbf`.
   - Válido → seta `x-hub-access-email: <email minúsculo>`. Inválido/ausente → não seta (não bloqueia o site;
     o bloqueio é do gateway Comex).
   - Novas vars: `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`. Sem elas → nunca seta o header.
2. **Gateway (`src/core/comex/comexGuard.ts`)**
   - Autorizado se: `x-hub-access-email` ∈ `COMEX_ALLOWED_EMAILS` (lista por vírgula, case-insensitive)
     **ou** `x-comex-token` válido (fallback para dev local, sem Access).
   - Nenhum dos dois configurado no servidor → 503 `COMEX_OPERATOR_TOKEN_UNSET` (mantém fail-closed).
   - Recusa → 401 `COMEX_OPERATOR_TOKEN_REQUIRED` (mesmos códigos; front já trata).
   - `isValidComexOperatorToken` (usado em `/api/gemini/comex-ai`) passa a aceitar as duas vias.
   - `comexGuardStatus(req)` acrescenta `accessEmailConfigured`, `authorized` e `via: 'access' | 'token' | null`.
     Nunca devolve a lista de e-mails.
3. **Container/Worker env:** `COMEX_ALLOWED_EMAILS` como secret, repassado em `PASSTHROUGH_ENV`.
4. **Front (`M18Comex.tsx`)**: painel de token só aparece se `/status` disser `authorized=false` ou se uma rota
   for recusada. Com Access válido o painel nunca aparece.

## Restrições
- Container só é alcançável pelo Worker (Durable Object) → header setado pelo Worker é confiável.
- Repo público: domínio da equipe e AUD não são segredos, mas ficam como vars; e-mails só em secret.
- Deploy do Worker reinicia o container → sem `DATABASE_URL`, apaga SQLite (avisar antes).

## Deixado ao implementador
- Validar JWT com WebCrypto nativo ou `jose` (preferir o que já existir nas deps do Worker).
- TTL do cache JWKS (sugestão 1 h, refaz ao ver `kid` desconhecido).

## Precisa do usuário antes do deploy
- Domínio da equipe Zero Trust (`<algo>.cloudflareaccess.com`) e AUD da aplicação Access do hub.
- Gravar secret `COMEX_ALLOWED_EMAILS` com o próprio e-mail.
