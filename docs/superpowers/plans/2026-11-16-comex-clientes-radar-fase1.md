# M18 Comex — Fase 1: trava geral, token, clientes, despachantes e limite do Radar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Travar todo `/api/comex/*` com o token de operador, gerar o token pela tela, cadastrar clientes importadores e despachantes em tabelas próprias, ligar cada processo a um `cliente_id` e avisar o uso do limite do Radar.

**Architecture:** Express + store dual (SQLite `node:sqlite` local / Postgres via `DATABASE_URL`) em `src/core/comex/`. Um gateway único em `/api/comex` aplica a trava estrita com lista de rotas livres. O cálculo do Radar é um módulo puro (`radarUsage.ts`) usado pela rota e pela tela. React no `M18Comex.tsx` com painéis novos e um `comexFetch` que injeta o header.

**Tech Stack:** TypeScript, Express 4, React 18 + Tailwind, `node:sqlite`, `pg`, Vitest 3.

**Spec:** [docs/superpowers/specs/2026-11-16-comex-clientes-radar-design.md](../specs/2026-11-16-comex-clientes-radar-design.md)

## Global Constraints

- Header do token: `x-comex-token`; env do servidor: `COMEX_OPERATOR_TOKEN`.
- Rotas **livres** (sem token): `GET /api/comex/pucomex/status`, `GET /api/comex/pucomex/catalog`, `POST /api/comex/benchmark`. Todo o resto de `/api/comex/*` exige token.
- Sem `COMEX_OPERATOR_TOKEN` no servidor → rotas travadas respondem **503** `COMEX_OPERATOR_TOKEN_UNSET` **sempre** (inclusive DEMO). Token ausente/errado → **401** `COMEX_OPERATOR_TOKEN_REQUIRED`.
- O servidor **nunca** recebe/grava o token por rota HTTP.
- Sem `tenant_id`. Sem certificado de cliente em lugar nenhum.
- Radar: base padrão FOB (`fob_value_usd`); `COMEX_RADAR_BASIS=fob|cif` (cif → `cif_value_usd`); janela `COMEX_RADAR_WINDOW=rolling|calendar` (padrão `rolling` = 6 meses que terminam na data de referência). Faixas: `< 0.8` ok · `0.8–1.0` atencao · `> 1.0` estouro. Aviso, **nunca** bloqueio.
- Data de referência do processo: `payload.duimp_registered_at` → `payload.eta_date` → `created_at` (primeiros 10 chars, `YYYY-MM-DD`).
- Só processos `payload.type === 'importacao'` contam no Radar.
- Processo **novo** exige `cliente_id`; antigos ficam `NULL` ("sem cliente").
- UI e mensagens em pt-BR. Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Token com espaço/quebra colado na tela** → deve funcionar igual (trim no front e no servidor). Teste na Task 2.
2. **Banco SQLite já existente sem a coluna `cliente_id`** (dev local com `data/comex.sqlite` antigo) → `ensureReady` adiciona a coluna sem perder dados. Teste na Task 3.
3. **Processo com FOB vazio, texto ("12.000,50") ou negativo** → conta 0 e entra em `missingValue`; texto pt-BR é convertido. Teste na Task 4.
4. **Excluir cliente com processos ligados** → recusa 409 em vez de deixar processos órfãos. Teste na Task 5.
5. **CNPJ digitado com máscara (60.450.605 / 60.450.605/0001-00)** → normalizado só dígitos; raiz = 8 primeiros; CNPJ completo opcional mas, se vier, 14 dígitos. Teste na Task 3.

---

### Task 0: Commitar o trabalho pendente da trava PUCOMEX

**Files:** já modificados no working tree (`comexGuard.ts`, `pucomexClient.ts`, `registerPucomexRoutes.ts`, `M18Comex.tsx`, `comexOperatorToken.ts`, `types/comex.ts`, `docker-entrypoint.sh`, `.env.example`, worker, docs, spec deste plano).

- [ ] **Step 1:** `npx vitest run src/__tests__/comex-pucomex-guard.test.ts` → 8 passed.
- [ ] **Step 2: Commit**

```bash
git add -A src/core/comex src/components/modules/M18Comex.tsx src/components/modules/comexOperatorToken.ts src/types/comex.ts src/__tests__/comex-pucomex-guard.test.ts docker-entrypoint.sh .env.example workers/hub-fitness-proxy/src/index.ts workers/hub-fitness-proxy/wrangler.jsonc .agents/skills/hub-fitness/references/comex.md docs/superpowers
git commit -m "fix(comex): trava rotas do certificado, valida PFX e Role-Type OPERPORT"
```

---

### Task 1: Gateway estrito em `/api/comex`

**Files:**
- Modify: `src/core/comex/comexGuard.ts`
- Modify: `src/core/comex/registerPucomexRoutes.ts` (registrar gateway no início de `registerPucomexRoutes`; remover `requireComexOperator` por rota, agora redundante)
- Test: `src/__tests__/comex-pucomex-guard.test.ts`

**Interfaces:**
- Produces: `requireComexOperatorStrict(req, res, next): void` · `COMEX_PUBLIC_ROUTES: ReadonlyArray<{ method: string; path: string }>` · `comexGateway(req, res, next): void` (libera se `method+path` ∈ públicas, senão strict) · `comexGuardStatus()` passa a retornar `{ operatorTokenRequired: true, operatorTokenConfigured: boolean }`.

- [ ] **Step 1: Ajustar/escrever testes** (substituir o teste "DEMO sem token configurado: passa livre")

```ts
it('DEMO sem COMEX_OPERATOR_TOKEN: rotas travadas dão 503', async () => {
  for (const [m, p] of [['GET','/api/comex/processes'],['POST','/api/comex/pucomex/proxy'],['GET','/api/comex/field-defs']]) {
    const res = await fetch(`${baseUrl}${p}`, { method: m, headers: { 'Content-Type': 'application/json' }, body: m === 'GET' ? undefined : '{}' });
    expect(res.status, p).toBe(503);
  }
});
it('rotas públicas passam sem token', async () => {
  expect((await fetch(`${baseUrl}/api/comex/pucomex/catalog`)).status).toBe(200);
});
it('token com espaço/CRLF no header e no env é aceito', async () => {
  process.env.COMEX_OPERATOR_TOKEN = ' abc123\r\n';
  const res = await fetch(`${baseUrl}/api/comex/pucomex/catalog`);
  expect(res.status).toBe(200);
  const ok = await post('/api/comex/pucomex/proxy', { path: '/x' }, { 'x-comex-token': 'abc123 ' });
  expect(ok.status).toBe(200);
});
```
Os testes existentes que usam token configurado continuam valendo.

- [ ] **Step 2:** `npx vitest run src/__tests__/comex-pucomex-guard.test.ts` → FAIL (503 esperado, veio 200).
- [ ] **Step 3: Implementar** `requireComexOperatorStrict` (mesmo corpo de `requireComexOperator` sem o ramo `if (!live) return next()`), `COMEX_PUBLIC_ROUTES` com as 3 rotas livres, `comexGateway` e `app.use('/api/comex', comexGateway)` como **primeira** linha de `registerPucomexRoutes` (comparar `req.method` e `req.baseUrl + req.path`). Remover `requireComexOperator` das rotas e o export antigo se não houver mais uso. `.env.example`: comentário de `COMEX_OPERATOR_TOKEN` passa a dizer "obrigatório para usar o M18 (dev e produção)".
- [ ] **Step 4:** mesmo comando → PASS.
- [ ] **Step 5: Commit** `feat(comex): trava geral estrita em /api/comex`

---

### Task 2: `comexFetch`, gerador de token e portão da tela

**Files:**
- Modify: `src/components/modules/comexOperatorToken.ts`
- Create: `src/components/modules/ComexOperatorTokenPanel.tsx`
- Modify: `src/components/modules/M18Comex.tsx`, `src/components/modules/ComexFieldDefsPanel.tsx`, `src/components/PdfDocumentIngestPanel.tsx` (toda chamada `/api/comex/*` via `comexFetch`)
- Test: `src/__tests__/comex-operator-token.test.ts`

**Interfaces:**
- Consumes: gateway da Task 1 (401/503 com `code`).
- Produces: `generateOperatorToken(): string` (64 hex, `crypto.getRandomValues` 32 bytes) · `buildWranglerSecretCommand(token: string): string` · `comexFetch(path: string, init?: RequestInit): Promise<Response>` (adiciona `x-comex-token` com token trimado; `Content-Type: application/json` só se `init.body` for string) · `openComexDocument(docId: string): Promise<void>` (busca `/api/comex/documents/:id/file` via `comexFetch`, abre `URL.createObjectURL(blob)` em nova aba) · `<ComexOperatorTokenPanel onSaved={() => void} configuredOnServer={boolean} />`.

- [ ] **Step 1: Testes**

```ts
import { generateOperatorToken, buildWranglerSecretCommand } from '../components/modules/comexOperatorToken';
it('gera 64 hex e nunca repete', () => {
  const a = generateOperatorToken(); const b = generateOperatorToken();
  expect(a).toMatch(/^[0-9a-f]{64}$/); expect(a).not.toBe(b);
});
it('comando wrangler usa npx.cmd e aspas simples', () => {
  expect(buildWranglerSecretCommand('ab12')).toBe("$token = 'ab12'; $token | npx.cmd wrangler secret put COMEX_OPERATOR_TOKEN");
});
it('setComexOperatorToken faz trim', () => { /* stub sessionStorage em globalThis; setComexOperatorToken(' x \r\n'); expect(getComexOperatorToken()).toBe('x') */ });
```

- [ ] **Step 2:** `npx vitest run src/__tests__/comex-operator-token.test.ts` → FAIL.
- [ ] **Step 3: Implementar** funções em `comexOperatorToken.ts` (trim em `setComexOperatorToken`). Painel: campo mascarado + botão mostrar/ocultar, **Gerar** (preenche com `generateOperatorToken()`), **Salvar** (`setComexOperatorToken`, `navigator.clipboard.writeText(buildWranglerSecretCommand(token))`, mostra o comando e o aviso "cole só o comando, sem o `PS C:\>` da frente"; se `configuredOnServer` for false, texto "Depois de rodar o comando, reinicie/deploy e recarregue"). M18: substituir `fetch('/api/comex…` por `comexFetch`; o link `href=/api/comex/documents/${doc.id}/file` vira botão `openComexDocument`; se `getComexOperatorToken()` vazio **ou** qualquer resposta vier 401/503 com `code` de token, renderizar só o painel do token no lugar do conteúdo do M18 (status do PUCOMEX continua visível). Remover o bloco de campo de token criado antes (substituído pelo painel).
- [ ] **Step 4:** testes PASS + `npx tsc --noEmit -p .` sem erros novos (o erro pré-existente em `src/core/payrollRoles.ts` permanece).
- [ ] **Step 5: Verificação manual:** `npm run dev` com `COMEX_OPERATOR_TOKEN` no `.env` → M18 sem token mostra só o painel; Gerar+Salvar com o valor do `.env` → lista de processos carrega; abrir PDF de documento funciona.
- [ ] **Step 6: Commit** `feat(m18): gerador de token e chamadas comex autenticadas`

---

### Task 3: Tabelas `comex_clients` / `comex_brokers` + `cliente_id` + campos novos

**Files:**
- Create: `supabase/client/migrations/20261116120000_comex_clients_brokers.sql`
- Create: `src/core/comex/comexRegistry.ts` (normalização/validação pura)
- Modify: `src/core/comex/comexStore.ts` (schema SQLite, interface `ComexStore`, `SqliteComexStore`, `PgComexStore`, `hydrateProcess`)
- Modify: `src/core/comex/fieldDefsSeed.ts`, `src/types/comex.ts`
- Test: `src/__tests__/comex-clients-store.test.ts`

**Interfaces:**
- Produces (types em `src/types/comex.ts`):
  - `ComexRadarModality = 'expressa' | 'limitada_50k' | 'limitada_150k' | 'ilimitada'`
  - `ComexClientRecord { id; cnpj_root; cnpj: string|null; legal_name; trade_name: string|null; slug; radar_status: string|null; radar_modality: ComexRadarModality|null; radar_limit_usd: number|null; radar_operations: string|null; radar_legal_basis: string|null; radar_checked_at: string|null; rep_status: 'pendente'|'ativa'|'vencida'|'revogada'; rep_certificate: string|null; rep_role_type: string|null; rep_valid_from: string|null; rep_valid_to: string|null; broker_id: string|null; notes: string|null; created_at; updated_at }`
  - `ComexClientInput = Omit<ComexClientRecord, 'id'|'slug'|'created_at'|'updated_at'> & { id?: string }` (campos opcionais exceto `cnpj_root`, `legal_name`)
  - `ComexBrokerRecord { id; name; cpf: string|null; rfb_registry: string|null; email: string|null; phone: string|null; certificate_status: 'pendente'; active: boolean; created_at; updated_at }`
  - `ComexProcessRecord` ganha `cliente_id: string | null`.
- Produces (`comexRegistry.ts`): `normalizeClientInput(input: ComexClientInput): ComexClientInput` (lança `Error` pt-BR em inválido) · `defaultRadarLimit(m: ComexRadarModality|null): number|null` (`limitada_50k`→50000, `limitada_150k`→150000, demais→null) · `slugify(legalName: string): string`.
- Produces (`ComexStore`): `listClients()`, `getClient(id)`, `upsertClient(input): Promise<ComexClientRecord>`, `deleteClient(id): Promise<'ok'|'not_found'|'has_processes'>`, `listBrokers()`, `upsertBroker(input)`, `deleteBroker(id): Promise<'ok'|'not_found'|'in_use'>`; `createProcess`/`updateProcess` aceitam `cliente_id?: string|null` (ao gravar `cliente_id`, copia `client.slug` para `client_slug` e `client.legal_name` para `payload.client_name`).

- [ ] **Step 1: Testes** (`new SqliteComexStore(':memory:')` + `ensureReady()`)

```ts
it('normaliza CNPJ com máscara', () => {
  const n = normalizeClientInput({ cnpj_root: '60.450.605', cnpj: '60.450.605/0001-00', legal_name: 'RM ACADEMIA LTDA', radar_modality: 'limitada_50k' } as ComexClientInput);
  expect(n.cnpj_root).toBe('60450605'); expect(n.cnpj).toBe('60450605000100'); expect(n.radar_limit_usd).toBe(50000);
});
it('recusa raiz ≠ 8 dígitos e CNPJ completo ≠ 14 ou com raiz diferente', () => { /* expect(() => normalizeClientInput(...)).toThrow(/CNPJ/) x3 */ });
it('CRUD cliente + processo ligado + delete recusado', async () => {
  const c = await store.upsertClient({ cnpj_root: '60450605', legal_name: 'RM ACADEMIA LTDA', radar_modality: 'limitada_50k' } as ComexClientInput);
  expect(c.slug).toBe('rm-academia-ltda'); expect(c.rep_status).toBe('pendente');
  const p = await store.createProcess({ cliente_id: c.id, payload: { type: 'importacao' } });
  expect(p.cliente_id).toBe(c.id); expect(p.client_slug).toBe('rm-academia-ltda'); expect(p.payload.client_name).toBe('RM ACADEMIA LTDA');
  expect(await store.deleteClient(c.id)).toBe('has_processes');
});
it('broker em uso não é excluído', async () => { /* cliente com broker_id → deleteBroker → 'in_use' */ });
it('SQLite antigo sem cliente_id ganha a coluna sem perder processos', async () => {
  // cria arquivo temp com o SQLITE_SCHEMA antigo (sem cliente_id) + 1 processo via DatabaseSync,
  // abre SqliteComexStore no mesmo arquivo, ensureReady(), listProcesses() → 1 item com cliente_id null
});
it('seed traz eta_date, duimp_registered_at, cif_value_usd e client_name fora do form', async () => {
  const defs = await store.listFieldDefs('process');
  expect(defs.find(d => d.field_key === 'eta_date')?.data_type).toBe('date');
  expect(defs.find(d => d.field_key === 'duimp_registered_at')?.data_type).toBe('date');
  expect(defs.find(d => d.field_key === 'cif_value_usd')?.data_type).toBe('number');
  expect(defs.find(d => d.field_key === 'client_name')?.ui_form).toBe(false);
});
```

- [ ] **Step 2:** `npx vitest run src/__tests__/comex-clients-store.test.ts` → FAIL.
- [ ] **Step 3: Implementar.** Migration Postgres: as duas tabelas do §7.1 do spec (`uuid` + `gen_random_uuid()`, `CHECK` de `rep_status` e `radar_modality`, `UNIQUE(cnpj_root)`, `slug UNIQUE`) + `ALTER TABLE comex_processes ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES comex_clients(id) ON DELETE RESTRICT` + índice. SQLite: mesmas tabelas em `SQLITE_SCHEMA` (TEXT); `ensureReady` checa `PRAGMA table_info(comex_processes)` e roda `ALTER TABLE comex_processes ADD COLUMN cliente_id TEXT` se faltar. Slug duplicado → sufixo `-2`, `-3`. Seed: `eta_date` (date, "Chegada prevista", sort 125), `duimp_registered_at` (date, "Registro DUIMP", sort 126), `cif_value_usd` (number, "CIF US$", sort 141); `client_name` com `ui_form: false`. `createComexStore` warning cita também a migration nova.
- [ ] **Step 4:** testes PASS + `npx vitest run src/__tests__/comex-metadata-store.test.ts` continua PASS.
- [ ] **Step 5: Commit** `feat(comex): cadastro de clientes e despachantes + cliente_id no processo`

---

### Task 4: Cálculo do uso do Radar (módulo puro)

**Files:**
- Create: `src/core/comex/radarUsage.ts`
- Test: `src/__tests__/comex-radar-usage.test.ts`

**Interfaces:**
- Consumes: `ComexClientRecord`, `ComexProcessRecord` (Task 3).
- Produces:
  - `type RadarLevel = 'ok' | 'atencao' | 'estouro' | 'sem_limite'`
  - `interface RadarUsage { clientId: string; basis: 'fob'|'cif'; window: 'rolling'|'calendar'; windowFrom: string; windowTo: string; limitUsd: number|null; usedUsd: number; pct: number|null; level: RadarLevel; counted: string[]; missingValue: string[] }` (`counted`/`missingValue` = `code` dos processos)
  - `processRadarDate(p: ComexProcessRecord): string` (`YYYY-MM-DD`)
  - `parseUsd(v: unknown): number | null` (aceita number, "12000", "12.000,50", "12,000.50"; vazio/negativo/NaN → null)
  - `computeRadarUsage(client, processes, opts: { refDate: string; basis?: 'fob'|'cif'; window?: 'rolling'|'calendar' }): RadarUsage` — `basis`/`window` padrão vêm de `COMEX_RADAR_BASIS`/`COMEX_RADAR_WINDOW`, senão `fob`/`rolling`.
- Regras: só `cliente_id === client.id` e `payload.type === 'importacao'`; rolling = `radarDate > refDate − 6 meses` **e** `<= refDate`; calendar = mesmo semestre civil de `refDate` (jan–jun / jul–dez) **e** `<= refDate`; valor nulo → conta 0 e entra em `missingValue`; `limitUsd = client.radar_limit_usd ?? defaultRadarLimit(client.radar_modality)`; sem limite → `pct: null`, `level: 'sem_limite'`; senão faixas do Global Constraints.

- [ ] **Step 1: Testes** (cliente `limitada_50k`, `refDate: '2026-11-16'`)

```ts
it('soma FOB dos importações na janela móvel', () => { // P1 2026-06-01 FOB 20000, P2 2026-10-01 FOB 21000, P3 2026-05-16 FOB 9999 (fora: = ref−6m), P4 exportacao 50000
  const u = computeRadarUsage(client, [p1,p2,p3,p4], { refDate: '2026-11-16' });
  expect(u.usedUsd).toBe(41000); expect(u.pct).toBeCloseTo(0.82); expect(u.level).toBe('atencao'); expect(u.windowFrom).toBe('2026-05-16'); expect(u.windowTo).toBe('2026-11-16');
});
it('estouro acima de 100% e ok abaixo de 80%', () => { /* 50001 → 'estouro'; 39999 → 'ok' */ });
it('data: duimp_registered_at > eta_date > created_at', () => { /* processRadarDate */ });
it('parseUsd entende pt-BR e rejeita lixo', () => {
  expect(parseUsd('12.000,50')).toBe(12000.5); expect(parseUsd('12,000.50')).toBe(12000.5);
  expect(parseUsd('')).toBeNull(); expect(parseUsd('-5')).toBeNull(); expect(parseUsd('abc')).toBeNull();
});
it('FOB faltando entra em missingValue', () => { /* processo sem fob_value_usd → counted inclui o code, missingValue inclui o code, usedUsd 0 */ });
it('semestre civil e base CIF', () => { /* window 'calendar' ref 2026-11-16 → windowFrom '2026-07-01'; basis 'cif' soma cif_value_usd */ });
it('modalidade ilimitada → sem_limite', () => { /* level 'sem_limite', pct null */ });
```

- [ ] **Step 2:** `npx vitest run src/__tests__/comex-radar-usage.test.ts` → FAIL.
- [ ] **Step 3: Implementar** em `radarUsage.ts` (aritmética de mês com `Date.UTC`; fim de mês: 31/08 − 6 meses = 28/02 ou 29/02).
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(comex): calculo do uso do limite Radar`

---

### Task 5: Rotas de clientes, despachantes, radar-usage e processo com cliente

**Files:**
- Create: `src/core/comex/registerComexClientRoutes.ts` (chamado de dentro de `registerPucomexRoutes`, depois do gateway)
- Modify: `src/core/comex/registerPucomexRoutes.ts` (POST/PUT processes)
- Test: `src/__tests__/comex-clients-routes.test.ts` (app Express em porta 0, `COMEX_DB_PATH=':memory:'` + `resetComexStoreForTests()`, `COMEX_OPERATOR_TOKEN='t'`, header em todas as chamadas)

**Interfaces:**
- Consumes: store (Task 3), `computeRadarUsage` (Task 4), gateway (Task 1).
- Produces (rotas; erros `{ success:false, error }` pt-BR):
  - `GET /api/comex/clients` → `{ success, data: ComexClientRecord[] }`
  - `POST /api/comex/clients` · `PUT /api/comex/clients/:id` → `{ success, data }`; inválido → 400; `cnpj_root` duplicado → 409
  - `DELETE /api/comex/clients/:id` → 200 · 404 · 409 (`has_processes`)
  - `GET /api/comex/clients/:id/radar-usage?ref=YYYY-MM-DD` → `{ success, data: RadarUsage }` (ref padrão = hoje)
  - `GET|POST /api/comex/brokers` · `PUT|DELETE /api/comex/brokers/:id` (DELETE em uso → 409)
  - `POST /api/comex/processes`: exige `cliente_id` existente (400 `"Selecione o cliente importador"` / 404) → `{ success, data, radar: RadarUsage }` com `refDate = processRadarDate(novo)`
  - `PUT /api/comex/processes/:id`: aceita `cliente_id` (troca vínculo); resposta inclui `radar` se o processo tiver cliente.
  - `GET /api/comex/processes` inclui `cliente_id` em cada item.

- [ ] **Step 1: Testes**

```ts
it('cria cliente, processo ligado e devolve radar', async () => {
  const c = await (await api('POST','/api/comex/clients',{ cnpj_root:'60.450.605', legal_name:'RM ACADEMIA LTDA', radar_modality:'limitada_50k' })).json();
  const p = await (await api('POST','/api/comex/processes',{ cliente_id: c.data.id, payload:{ type:'importacao', fob_value_usd: 45000, eta_date:'2026-11-01' } })).json();
  expect(p.radar.level).toBe('atencao'); expect(p.radar.usedUsd).toBe(45000);
});
it('processo sem cliente_id → 400', async () => { expect((await api('POST','/api/comex/processes',{ payload:{} })).status).toBe(400); });
it('cliente com processo não é excluído (409)', async () => { /* ... */ });
it('cnpj_root duplicado → 409', async () => { /* ... */ });
it('sem token → 401 em /clients e /brokers', async () => { /* fetch sem header */ });
```

- [ ] **Step 2:** `npx vitest run src/__tests__/comex-clients-routes.test.ts` → FAIL.
- [ ] **Step 3: Implementar.** Todas as rotas `async` com `try/catch` → `sendError(res, 500, msg)` (não deixar rejeição sem resposta). Erro de `normalizeClientInput` → 400; violação de unicidade (`UNIQUE`) → 409.
- [ ] **Step 4:** PASS + `npx vitest run` geral (só os 5 smoke pré-existentes falham).
- [ ] **Step 5: Commit** `feat(comex): rotas de clientes, despachantes e radar`

---

### Task 6: Telas de clientes/despachantes e cliente no processo

**Files:**
- Create: `src/components/modules/ComexClientsPanel.tsx` (lista + formulário de clientes; seção despachantes)
- Create: `src/components/modules/RadarUsageBadge.tsx`
- Modify: `src/components/modules/M18Comex.tsx` (nova sub-aba "Clientes"; modal do processo)

**Interfaces:**
- Consumes: rotas da Task 5, `comexFetch` (Task 2), `RadarUsage` (Task 4).
- Produces: `<ComexClientsPanel onChanged={() => void} />` · `<RadarUsageBadge usage={RadarUsage} compact?={boolean} />` (verde ok, âmbar atencao, vermelho estouro, cinza sem_limite; texto `usado US$ 38.200 / 50.000 (6 meses)` e, se `missingValue.length`, "N processo(s) sem valor"; rodapé fixo "regra a validar com despachante/tributarista").

- [ ] **Step 1: Implementar painel de clientes:** formulário com os campos do §7.1 do spec agrupados (Empresa · Radar · Representação · Despachante). `radar_modality` em select; ao trocar, preenche `radar_limit_usd` com `defaultRadarLimit` (editável). `rep_certificate` com sugestão "e-CPF Marcelo" e `rep_role_type` padrão `IMPEXP` com nota "a validar". Lista com `RadarUsageBadge compact` por cliente (via `/radar-usage`). Despachantes: lista + form simples; `certificate_status` só leitura "pendente".
- [ ] **Step 2: Modal do processo:** primeiro campo = select obrigatório de cliente (lista de `/clients`); campo `client_name` não aparece (seed `ui_form:false`). Ao salvar, se `radar.level` ∈ `atencao|estouro`, mostrar `RadarUsageBadge` no modal antes de fechar (não bloqueia). Lista de processos: coluna Cliente usa o cliente ligado; processos sem `cliente_id` mostram selo "sem cliente" + ação "Vincular" (abre o modal).
- [ ] **Step 3: Verificação:** `npx tsc --noEmit -p .` sem erros novos; `npm run dev` → cadastrar RM ACADEMIA LTDA (60.450.605, Limitada até US$ 50 mil, IMPORTADOR/EXPORTADOR, IN RFB 1.984/2020) → criar processo importação FOB 45.000 com chegada prevista neste mês → badge âmbar 90%; excluir o cliente → mensagem de 409.
- [ ] **Step 4: Commit** `feat(m18): telas de clientes, despachantes e aviso do Radar`

---

### Task 7: Documentação

**Files:**
- Modify: `.agents/skills/hub-fitness/references/comex.md` (seções: trava geral, rotas novas, tabelas `comex_clients`/`comex_brokers`, regra do Radar e envs)
- Modify: `.env.example` (`COMEX_RADAR_BASIS="fob"`, `COMEX_RADAR_WINDOW="rolling"`)
- Modify: `docs/superpowers/specs/2026-11-16-comex-clientes-radar-design.md` (Status: "Fase 1 implementada")
- Modify: `docs/adr/ADR-003-database-per-client.md` (adendo: tabelas `comex_*` são cadastro da comissária — vários clientes num banco só, ligados por `cliente_id`; exceção consciente ao database-per-client)

- [ ] **Step 1:** editar os três arquivos.
- [ ] **Step 2: Commit** `docs(comex): fase 1 clientes e radar`
