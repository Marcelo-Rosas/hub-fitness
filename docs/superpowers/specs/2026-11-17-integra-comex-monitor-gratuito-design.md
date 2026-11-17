# Monitor gratuito de alterações (Integra Comex · visibilidade pública) — desenho

**Status:** rascunho para aprovação · **Data:** 2026-11-17 · **Módulo:** M18 Comex

## 1. Objetivo

O HUB avisa no processo quando algo muda no CE-Mercante, na DI, na LI ou na DUIMP, sem custo e sem contrato com o SERPRO.

O operador deixa de abrir o Mercante e o Portal Único só para "ver se mexeu". Ele só abre quando o HUB avisa.

É a etapa 1 da integração Integra Comex:
- **Etapa 2:** cliente pago montado contra a homologação.
- **Etapa 3:** contratação do perfil Operador.

## 2. Fatos verificados

**Swagger.** Baixei de `/{contexto}/v2/api-docs` em 2026-11-17.

**Chamadas reais.** Fiz chamadas no mesmo dia, sem autenticação. Todas responderam.

| Documento | Endpoint (GET, sem autenticação) | Lote máx. | Resposta |
|---|---|---|---|
| CE-Mercante | `https://siscomex-carga.estaleiro.serpro.gov.br/siscarga-api/ce/data-ultima-atualizacao?nr=…&nr=…` | 50 | `[{numero, dataAtualizacao}]` |
| Escala | `…/siscarga-api/escala/data-ultima-atualizacao?nr=…` | 50 | idem (testado: `19000007952` → `2019-01-28T18:09:25`) |
| Manifesto | `…/siscarga-api/manifesto/data-ultima-atualizacao?nr=…` | 50 | idem |
| DI | `https://siscomex-di.estaleiro.serpro.gov.br/siscomex-di-api/declaracoes-importacao/data-ultima-atualizacao?nr=…` | 50 | idem |
| LI | `https://siscomex-li.estaleiro.serpro.gov.br/siscomex-li-api/licencas-importacao/data-ultima-atualizacao?nr=…` | 50 | idem; nada achado → **404** `SILI-4004 "Nenhuma LI encontrada"` |
| DTA (trânsito) | `https://siscomex-transito.estaleiro.serpro.gov.br/transito-consulta-atualizacao/transito/data-ultima-atualizacao?nr=…` | 50 | idem |
| DUIMP | `https://pro-integra-pub-pucomex-dimp.estaleiro.serpro.gov.br/duimp-integracomex-pub/api/duimp/atualizacao?duimp=…&duimp=…` | **100** | `{code, message, multiStatus:[{numero, dataAtualizacao, versaoVigente, code, message}]}`; nada achado → **404** com `multiStatus` |

**O que a API devolve e o que não devolve:**
- A API **não diz o que mudou**, só **quando** mudou. Para saber o conteúdo, é preciso a consulta paga (etapa 2/3) ou abrir o sistema.
- Ela **não valida números**. Devolve só os que encontrou: o número inválido e o número sem dado são a mesma coisa (`[]`).
- A cobertura começa em 2017. Operação anterior volta vazia até sofrer nova alteração.
- `dataAtualizacao` vem **sem fuso** (`2019-01-28T18:09:25`). Vamos tratar como horário de Brasília.
- O swagger do LI diz `basePath /li-consulta-atualizacao`, mas o caminho que responde é `/siscomex-li-api/…`. O erro devolve `path` interno. Usar o que responde.
- O SERPRO pede "uso racional": nada de consulta contínua em intervalo curto.

**Limitação importante:** o BL **não** é o número do CE-Mercante. O CE tem 15 dígitos (ex.: `131905000018565`) e vem do agente de carga ou do armador no Mercante. Por isso o processo precisa de um campo próprio.

## 3. Escopo

**Dentro:**
1. Campos novos no processo (metadado):
   - `ce_mercante_number`: "Nº CE-Mercante", texto, 15 dígitos.
   - `di_number`: "Nº DI", texto, 10 dígitos (aceita `25/1234567-8`).
   - `li_numbers`: "Nº LI (separe por vírgula)", texto.
   - A DUIMP usa o `declaration_number` existente quando `type = importacao` e o valor bate com `^\d{2}BR\d{11}$`.
2. Um módulo puro `integraComexPublic.ts` (cliente + normalização) e um verificador `comexTracking.ts`.
3. Uma tabela `comex_tracking` (SQLite e Postgres, mesmo padrão dual do `comexStore`).
4. Uma verificação agendada dentro do container, mais o botão **Verificar agora**.
5. Na interface:
   - selo "Alterado" na lista de processos;
   - cartão "Acompanhamento Siscomex" no modal do processo, com o botão **Marcar como visto**.

**Fora:**
- Consultas pagas (CE completo, DI completa).
- Notificação por e-mail ou WhatsApp. Fica para depois, reaproveitando o outbox da intranet.
- Escala e manifesto: o CE já cobre o que interessa ao importador.
- DTA: não há campo hoje.
- DU-E: não há endpoint público.

## 4. Modelo de dados

```sql
CREATE TABLE IF NOT EXISTS comex_tracking (
  id TEXT PRIMARY KEY,
  process_id TEXT NOT NULL REFERENCES comex_processes(id) ON DELETE CASCADE,
  doc_kind TEXT NOT NULL CHECK (doc_kind IN ('ce','di','li','duimp')),
  doc_number TEXT NOT NULL,              -- só dígitos (DUIMP: 25BR + 11 dígitos)
  remote_updated_at TEXT,                -- dataAtualizacao atual (ISO, America/Sao_Paulo)
  previous_remote_updated_at TEXT,       -- valor anterior, para mostrar "mudou de X para Y"
  version INTEGER,                       -- versaoVigente (só DUIMP)
  found INTEGER NOT NULL DEFAULT 0,      -- 1 depois que a API devolveu o número uma vez
  checked_at TEXT,                       -- última verificação (nossa)
  changed_at TEXT,                       -- quando detectamos a mudança (nossa)
  seen_at TEXT,                          -- quando o operador marcou como visto
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (process_id, doc_kind, doc_number)
);
CREATE INDEX IF NOT EXISTS comex_tracking_kind_idx ON comex_tracking (doc_kind, doc_number);
```

**Regras da tabela:**
- "Alterado" = `changed_at IS NOT NULL AND (seen_at IS NULL OR seen_at < changed_at)`.
- **Sincronia com o processo:** ao salvar um processo, os números dos campos viram linhas em `comex_tracking` (upsert). As linhas cujo número saiu do processo são apagadas.
- O histórico completo de mudanças fica fora do escopo. Guardamos só a atual e a anterior.

## 5. Verificação

`runTrackingCheck({ fetchImpl?, now? })`:

1. **Seleção.** Pega as linhas de processos **ativos**, ou seja, `status` diferente de `desembaracado` e de `cancelado`.
2. **Lotes.** Agrupa por `doc_kind` e faz lotes de 50 (DUIMP: 100). Uma chamada por lote.
3. **Atualização de cada número devolvido:**
   - Primeira vez que aparece: `found = 1`, grava `remote_updated_at` e **não** marca mudança. Exceção: CE e DUIMP marcam "apareceu no sistema", que é um sinal útil (CE registrado, DUIMP registrada).
   - `dataAtualizacao` diferente da gravada: copia a antiga para `previous_remote_updated_at`, grava a nova e põe `changed_at = now`.
   - Igual: só atualiza `checked_at`.
4. **Número não devolvido.** Atualiza `checked_at`. Se `found = 0` há mais de 7 dias, mostra o aviso "Número não encontrado no Siscomex — confira se está correto". A API não valida números, então esta é a única pista de erro de digitação.
5. **Erros.**
   - **404 de LI ou DUIMP** = nada encontrado. Não é erro.
   - **5xx ou timeout:** grava `last_error` e tenta na próxima rodada.
   - **Sem nova tentativa imediata**, por causa do uso racional.

**Agendamento:**
- **Onde roda:** `setInterval` no container, no padrão do `startOutboxDispatcher`. Com `sleepAfter = "720h"` o container fica de pé.
- **Frequência:** a cada **30 min**, só de **segunda a sexta, das 7h às 20h** (America/Sao_Paulo).
- **Botão Verificar agora:** limite de 1 por processo a cada 5 min.
- **Concorrência:** uma trava em memória evita duas rodadas ao mesmo tempo (`max_instances = 1`).
- **Volume esperado:** com menos de 50 processos ativos, cada rodada faz no máximo 4 chamadas, uma por tipo.

**Normalização** (em `integraComexPublic.ts`, puro e testável):

| Tipo | Regra | Aviso de formato no formulário |
|---|---|---|
| CE | só dígitos, 15 | quando o número não tem 15 dígitos |
| DI | só dígitos, 10 | quando o número não tem 10 dígitos |
| LI | só dígitos, 10, lista separada por vírgula | quando algum número não tem 10 dígitos |
| DUIMP | maiúsculas, `^\d{2}BR\d{11}$` | quando o número não segue o padrão |

O aviso de formato **não bloqueia** o salvamento.

## 6. Rotas

Todas passam pelo `comexGateway`: exigem `x-comex-token` e não são públicas.

- `GET /api/comex/tracking?process_id=…` → linhas do processo.
- `GET /api/comex/tracking/summary` → `{ [process_id]: { changed: n, notFound: n, lastCheck } }`, para os selos da lista.
- `POST /api/comex/tracking/check` com `{ process_id? }` → roda a verificação (de um processo ou de todos) e devolve as linhas atualizadas. Responde 429 em pt-BR acima do limite.
- `POST /api/comex/tracking/:id/seen` → grava `seen_at = now`.

## 7. Interface

**Lista de processos (M18):**
- Selo âmbar **"Alterado"** quando algum documento mudou e não foi visto.
- Selo cinza **"Não encontrado"** pelo aviso de 7 dias.
- Ao passar o mouse, o selo mostra a mudança. Exemplo: "CE 131905000018565 alterado em 17/11 14:20".

**Modal do processo**, cartão **"Acompanhamento Siscomex"**:

| Documento | Nº | Última alteração no Siscomex | Situação | Ação |
|---|---|---|---|---|
| CE-Mercante | 1319…565 | 17/11/2026 14:20 (antes: 12/11 09:02) | **Alterado** | Marcar como visto |
| DUIMP | 25BR…456 v2 | 16/11/2026 10:11 | Sem mudança | — |

Os textos fixos do cartão:
- **Nota:** "O Siscomex informa só **quando** mudou, não **o quê**. Abra o Mercante ou o Portal Único para ver o detalhe." O cartão traz links para os dois sistemas.
- **Rodapé:** "Verificado às HH:MM · próxima verificação ~HH:MM · fonte: SERPRO Integra Comex (consulta pública gratuita)".
- **Botão:** "Verificar agora".

## 8. Testes (Vitest, TDD)

- **Normalização:** formatos válidos e inválidos dos 4 tipos; DI com máscara; lista de LI.
- **Cliente:**
  - monta a querystring com `nr` repetido e com `duimp`;
  - quebra em lotes de 50 e de 100;
  - trata o 404 de LI e de DUIMP como vazio;
  - trata 5xx como erro.
- **Verificador** (com fetch mockado):
  - primeira aparição;
  - mudança de data;
  - sem mudança;
  - aviso de não encontrado após 7 dias;
  - processo desembaraçado é ignorado;
  - janela de horário respeitada;
  - trava de concorrência.
- **Store:** sincronia dos números ao salvar o processo (insere, mantém, apaga); regra de "alterado" com `seen_at`.
- **Rotas:** 401 sem token; 429 no "verificar agora"; `seen`.
- **Ambiente:** o mesmo da suíte atual, `npx vitest run` + `npx tsc --noEmit -p .`. Só as falhas antigas são aceitas.

## 9. Riscos e decisões em aberto

1. **CE-Mercante na mão.** O operador precisa digitar o número do CE, que não está no BL.
   - **Mitigação:** dica no campo: "15 dígitos — pedir ao agente de carga ou ver no Mercante".
   - **Futuro:** a consulta paga "CE por parâmetros" está no roadmap do SERPRO e acharia o CE pelo BL.
2. **Fuso da data.** Assumimos Brasília. Se aparecer diferença, ajustamos no normalizador. Só afeta a exibição, porque a comparação é por igualdade de texto.
3. **Saída de rede do container.** Os testes de hoje foram feitos da máquina local. Falta confirmar que o container no Cloudflare alcança `*.estaleiro.serpro.gov.br`. A ComexStat (gov.br) já funciona de lá.
4. **Mudança de API sem aviso.** Os endpoints são públicos e sem contrato, então não há garantia de estabilidade. Para isso, o erro aparece no cartão e não quebra o processo.

## 10. Entrega

- **Branch:** `feat/integra-comex-monitor`, um PR.
- **Deploy:** igual aos anteriores. Não precisa de secret novo nem de conta SERPRO.
- **Documentação:** atualizar `.agents/skills/hub-fitness/references/comex.md` com a seção "Integra Comex — consulta pública".
