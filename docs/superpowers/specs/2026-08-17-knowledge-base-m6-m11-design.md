# Spec — Base de conhecimento + M6 rota única + M11 Plano de Contas

**Data:** 2026-08-17  
**Status:** rascunho (aguarda review humano)  
**URL:** `https://hub.vectracargo.com.br`

**Mocks:** `public/assets/m6_rota_unica.png`, `public/assets/kb_base_conhecimento.png`

**Substitui (shell):** decisões 2, 4, 8, 9 e a tabela “Abas v1” de [`2026-08-16-m6-mix-cenarios-unificado-design.md`](./2026-08-16-m6-mix-cenarios-unificado-design.md). Pipeline Mix preview→Commit, Tornado live e dual persistência **permanecem**.

**Specs relacionadas:**
- `2026-08-16-m6-mix-cenarios-unificado-design.md` (Commit Mix / `applyMixPreview`)
- `2026-08-16-scenario-drivers-design.md` (drivers / Tornado)
- `2026-08-15-rbac-module-visibility-design.md` (matriz visão)

## Problema

1. **M6 tem cinco abas.** Mix, Matriz, Enquadramento, Board Memo e Plano de Contas competem na mesma rota. Trabalho (simular) mistura com aula (critério, memo) e com catálogo CoA.
2. **M11 é alias de M6.** `RedirectM11ToM6` + `canViewModule` resolve M11 como M6. Plano de Contas some do sidebar.
3. **Chrome poluído.** TopBar empilha Cenário, Novo, Comparar, IA, PDF Global, Relatório M6, Guia, Pitch, Exportar. ModuleHeader e M6 repetem PDF/CSV/IA. Guia é aula no chrome.
4. **Premissas mostram proxy.** Células `P1_Estocador`, `Blend_alvo_20_30_25_25`, `6000_M12_12000_M24`. Header local já diz CCT/Mediana/CAGED, mas valor ainda lê freeze Original/Enxuto/Realista.
5. **Aula no módulo.** Banners Fator R / DAS / CCT e as abas Enquadramento / Board Memo ensinam em vez de operar.

## Decisões (brainstorming)

| # | Decisão |
|---|---|
| 1 | **M6 = uma rota.** Mix + Matriz no mesmo scroll. Sem tab bar. |
| 2 | **Enquadramento e Board Memo** saem do M6 e viram **artigos KB** (layout de leitura). |
| 3 | **M11 = Plano de Contas** no sidebar Financeiro. Mata `RedirectM11ToM6`. `canViewModule` **não** alias M11→M6. |
| 4 | **KB** = módulo de rota (`ModuleId` `'KB'`). Catálogo **git** `src/data/knowledgeBase/`. Sem tabela Operator / CMS. Ship = commit. |
| 5 | **Aula** (banners, Guia, Enquadramento, Board Memo) → KB. **Alerta operacional** (P5 &lt; 20%, monocliente, Mix pendente, RFQ) **fica** no módulo. |
| 6 | **`?` no header do módulo** abre KB daquele `moduleId`. Some se não houver artigo visível / não-stub. |
| 7 | Artigos KB **filtrados por RBAC** do `moduleId` do artigo (`canViewModule`). KB no sidebar some se zero artigos visíveis. |
| 8 | Mix: duas composições (perfil + cargos). Pills de piso **só label**, sem R$ e sem id de campo (`cct_sc_2024_26`). Cards KPI leem os dois eixos. |
| 9 | Tabela mestra: **label humano** + **4PL M12 / 4PL M24**. JSON interno pode guardar snake_case. UI nunca. |
| 10 | BE da mestra / cards = **folha live** (`cct` / `mediana` / `caged`). Proibido relabel freeze Original/Enxuto/Realista. |
| 11 | Blends Alvo / Conservador / Agressivo moram **na mesma página M6**, junto do Tornado (não banner escuro de 6 cards no topo). Monocliente = vetado, não aplica. |
| 12 | TopBar magro. Guia some. Comparar some (Tornado já está no M6). PDF Global / Relatório M6 somem (Exportar cobre). |
| 13 | CoA no M11 = **somente leitura**. CRUD conta/CC/linha = **M3** (inalterado). |
| 14 | P0 = rotas + chrome + mestra + KB shell com artigos M6. P1 = colher banners aula M1–M19 restantes + artigo M15. |

## Fora de escopo

- CMS / tabela Operator para artigos.
- Reescrever `GlobalOnboardingGuide` em P0 (só tira o botão; colheita = P1).
- Mix→COGS bottom-up (v1.1 da spec 2026-08-16).
- Alterar CAPEX R$ 207.300 ou Ad Valorem 0,10% NF serviço.
- Frota (`payrollFleetAnnex.csv`) dentro do Mix.
- Comercial ver M6/M11 (continua sem).
- Unificar Commit Mix + drivers num botão.

## Rotas

| URL | Superfície | Tabs? |
|---|---|---|
| `?module=M6` | Mix (perfil + folha) + cards + gráficos + blends + Tornado + premissas | Não |
| `?module=M11` | Plano de Contas (`M11PlanoDeContas`) tela cheia | Abas internas do CoA (plan / rules / Fator R / export) — **não** as abas antigas do Mix |
| `?module=KB` | Índice KB (artigos visíveis, agrupados por módulo) | Não |
| `?module=KB&article=<id>` | Artigo | Não |

### Redirects legados (uma vez)

| De | Para |
|---|---|
| `?module=M6&tab=mix` | `?module=M6` |
| `?module=M6&tab=matriz` | `?module=M6` |
| `?module=M6&tab=enquadramento` | `?module=KB&article=m6-enquadramento` |
| `?module=M6&tab=board_memo` | `?module=KB&article=m6-board-memo` |
| `?module=M6&tab=plano_contas` | `?module=M11` |
| `?module=M11` (hoje redirect Mix) | **fica M11** — Plano de Contas |

Query `tab` no M6 após P0: ignorar, não reintroduzir tab bar.

## Sidebar

Grupo **Financeiro**, ordem:

1. M2 DRE Granular 24m
2. M3 Cadastro financeiro
3. M4 Fluxo de Caixa
4. M5 Fator R & Tributos
5. M6 Mix & Cenários
6. **M11 Plano de Contas** (item novo)
7. M15 RH & Custos SC

Grupo **Referência** (novo):

- KB Base de conhecimento — só se `visibleArticles(role).length > 0`

M11 **volta** ao sidebar. Label: “Plano de Contas”. Ícone existente `BookOpen` (ou equivalente já no Shell).

## Chrome

### TopBar — fica visível

- Toggle sidebar
- Dropdown cenário ativo
- Overflow `...` (Novo cenário, Pitch Mode, Assistente CFO IA)
- Exportar (PDF módulo, CSV, Drive, link 72h)
- User / role

### TopBar — sai

- Comparar
- Relatório PDF Global
- Relatório {módulo}
- Guia & Onboarding

### Header M6

- Título “Mix & Cenários” + `?` (KB do módulo M6).
- Sem faixa “HUB-SIM · 3PL LOGISTICS PLANNER”.
- Sem botões PDF/CSV/Relatório/IA nesse banner (Exportar no TopBar).
- Sem card branco introdutório duplicando o título.
- Badge “Mix pendente” permanece se `isMixDirty`.

## M6 — uma página (ordem de scroll)

1. **Composição de perfil de cliente** — sliders P1/P2/P4/P5; soma 100%. Preview Mix inalterado (`applyMixPreview` / Commit / Descartar).
2. **Composição de cargos e salários** — pills `cct` / `mediana` / `caged` com `MIX_COST_MODE_LABELS`; tabela HC × piso; total folha. Default `mixCostMode = 'mediana'`. Pack Simples 27,44%. Periculosidade default 0.
3. **Cards KPI** — MC ponderada, ticket ponderado, BE do piso ativo, LL 100%, LL 88% (se já existir), 4PL M12 / M24. Recalculam se mix **ou** piso muda.
4. **Gráfico BE** — barras agrupadas por perfil + mix. Séries = CCT / Mediana / CAGED. Visual de barras = o de hoje (não redesenhar tipo).
5. **Gráfico MC vs ticket** — barras originais (cyan MC, slate ticket).
6. **Matriz / Tornado** — pills Blend Alvo / Conservador / Agressivo (aplica pesos no mix do cenário; Commit Mix continua explícito). Monocliente mostra vetado, não aplica. Drivers + Tornado live (`M6Cenarios` embed sem `ModuleHeader` extra).
7. **Tabela premissas** — ver secção abaixo.
8. **Alertas operacionais** — P5 &lt; 20%, monocliente, Mix pendente. Sem banner aula.

`M6MixCenarios` deixa de ser tab shell. Compõe `M11SimuladorMix` (painel simulador só) + `M6Cenarios` (`embed`) na mesma coluna.

## KB

### Catálogo git

```
src/data/knowledgeBase/
  types.ts
  index.ts                 // lista + helpers
  articles/m6-enquadramento.ts
  articles/m6-board-memo.ts
  articles/m6-pisos.ts     // aula que sai dos banners Mix (CCT / mediana / CAGED / SITRAROIT)
```

Um **arquivo por artigo**, não um arquivo por módulo. M6 tem três artigos em P0. Agrupamento no índice = `moduleId`.

```ts
type KbSource = { label: string; url: string };

type KbArticle = {
  id: string;                 // slug URL, ex. 'm6-enquadramento'
  moduleId: ModuleId;         // RBAC + grupo no índice
  title: string;
  stub: boolean;              // true → não lista; não habilita ?
  sections: { heading: string; body: string }[];
  sources: KbSource[];        // URL real; nunca id de campo
};
```

Corpo = texto. Sem sliders, Tornado, coluna BE live, CRUD CoA.

### P0 — conteúdo que sai das abas

**`m6-enquadramento`:** critérios P1 / P2 / P4 / P5 (ticket, VAS, SLA, Ad Valorem). Labels humanos (`P5 Premium`, não `P5_Premium`). Sem coluna BE/MC live — esses números ficam na mestra M6.

**`m6-board-memo`:** leitura ao board (viabilidade, veto monocliente, pós-carência M7). Prosa. Números de freeze BP v3.5 podem citar-se como premissa documentada, com fonte; não são widgets.

**`m6-pisos`:** três pisos (CCT / mediana / CAGED), pack 27,44%, DAS vs lançamento analítico, empilhadeira NR-11 / NR-16. Fontes: SITRAROIT × SEVEÍCULOS (Mediador), CAGED, NR-16 / CLT 193–194. Proibido mostrar `cct_sc_2024_26` na UI.

### `?` e índice

- `ModuleHeader` (e header magro M6) ganha `?` discreto se existir **≥1** artigo `stub: false` com `moduleId` do módulo **e** `canViewModule(role, moduleId)`.
- Clique: `?module=KB&article=<primeiro>` se um só; senão `?module=KB` com grupo do módulo aberto.
- M6 tem três artigos → índice filtrado em M6.
- M11 em P0: sem artigo → sem `?`. P1 colhe aula CoA se houver.

### RBAC KB

- `ModuleId` inclui `'KB'`.
- `MODULE_VISIBILITY`: **todos os roles logados** têm `'KB'` (cfo, socio, comite, comercial, compras).
- Artigo visível ⇔ `!stub && canViewModule(role, article.moduleId)`.
- `comercial` / `compras` em P0: zero artigos M6 visíveis → item KB **não renderiza**.
- `comite` vê artigos M6 (vê M6) em leitura.

## M11 Plano de Contas

- Rota própria. Reusa `M11PlanoDeContas` com `readOnly={true}` (catálogo). Não é mais aba do Mix; o RO é a regra do módulo, não efeito colateral do embed.
- CRUD de conta, centro de custo e linha DRE = **M3**. CTA no M11: “editar no Cadastro financeiro (M3)”. Mutação CoA no M11 = bug.
- Validador Fator R **fica** no M11 (ferramenta, não aula).
- Teste RBAC: `canViewModule('comercial', 'M11') === false` (hoje o alias fazia M11 seguir M6; o resultado para comercial continua false, mas a **razão** muda: M11 está na matriz, não é alias).

Atualizar `MODULE_VISIBILITY`: M11 permanece na lista finance (cfo/socio/comite). Remover `resolved = moduleId === 'M11' ? 'M6'`.

Atualizar teste `M11 deep-link view resolves like M6` → dois asserts independentes (`M6` e `M11`).

## Tabela mestra (UI)

JSON `RAW_MIX_DATA_JSON` pode manter `Perfil` snake_case e `4PL_CT_por_cliente_R$mes` compacto. **Renderer** traduz.

### Perfil

| JSON | Label | Tipo |
|---|---|---|
| `P1_Estocador` | P1 Estocador | Perfil |
| `P2_Franquias` | P2 Franquias | Perfil |
| `P4_B2B_Academias` | P4 B2B Academias | Perfil |
| `P5_Premium` | P5 Premium | Perfil |
| `Blend_alvo_20_30_25_25` | Blend Alvo 20/30/25/25 | Blend |
| `Blend_conservador_25_30_30_15` | Blend Conservador 25/30/30/15 | Blend |
| `Blend_agressivo_10_30_20_40` | Blend Agressivo 10/30/20/40 | Blend |
| `Monocliente_P5` | P5 Premium + badge Vetado | Vetado |
| `Monocliente_P1` | P1 Estocador + badge Vetado | Vetado |
| `Monocliente_P4` | P4 B2B Academias + badge Vetado | Vetado |
| `Cenario_BASE_M12_realista` | Base M12 | Marco |
| `Cenario_BASE_M24_realista` | Base M24 | Marco |

### 4PL

Parse `6000_M12_12000_M24` → M12 = R$ 6.000, M24 = R$ 12.000.  
Número simples (ex. `2000`) → as duas colunas iguais.  
`0` → em-dash.  
Base M12: M24 = em-dash. Base M24: M12 = em-dash.

| Linha | 4PL M12 | 4PL M24 |
|---|---|---|
| P1 Estocador | — | — |
| P2 Franquias | R$ 2.000 | R$ 2.000 |
| P4 B2B Academias | R$ 1.500 | R$ 1.500 |
| P5 Premium | R$ 2.500 | R$ 2.500 |
| Blend Alvo | R$ 6.000 | R$ 12.000 |
| Blend Conservador | R$ 5.000 | R$ 10.000 |
| Blend Agressivo | R$ 10.000 | R$ 20.000 |
| Base M12 | R$ 6.000 | — |
| Base M24 | — | R$ 12.000 |

### Colunas visíveis

Perfil · MC/pos · Ticket · BE CCT · BE Mediana · BE CAGED · LL 100% ocup. · 4PL M12 · 4PL M24 · Cap · Gatilho

Sai: `LL 100% Realist`, `BE ORIG (86K)`, `BE ENX (63K)`, `BE REAL (75K)`, coluna única `4PL CT (R$/M)` crua.

BE CCT/Mediana/CAGED = `payrollTotal` do modo × regra de BE já usada nos cards (posições / custo). **Não** copiar `BE_Original_164k_pct` / `BE_Enxuto_120k_pct` / `BE_Realista_143k_pct` para essas colunas.

## Arquitetura

```
Shell
  Financeiro: M2 M3 M4 M5 M6 M11 M15
  Referência: KB (se artigos visíveis)

App
  M6  → M6MixCenarios        // mix + tornado, sem tabs
  M11 → M11PlanoDeContas     // sem redirect
  KB  → KnowledgeBasePage    // índice / artigo

src/data/knowledgeBase/      // SSOT artigos
src/core/kb/                 // visibleArticles, articleById, moduleHasArticle
src/core/mixLabels.ts        // Perfil JSON → label; parse 4PL
```

Pipeline DRE (inalterado nesta spec):

```
ledgerBaseItems
  → applyMixPreview
  → applyOccupancy / tech / CLIA
  → applyScenarioDrivers
  → projectDreFromLedger
```

Folha Mix: `payrollRoles` + `mixCostMode` (já no Context). Não reintroduzir Enxuto/Original/Realista.

## Testes

1. **Rotas:** `canViewModule('cfo','M11')` true; `canViewModule('cfo','M6')` true; **não** há alias. `canViewModule('comercial','M6')` e `('comercial','M11')` false.
2. **Redirect:** helper de query `tab=plano_contas` → M11; `tab=enquadramento` → artigo KB.
3. **KB RBAC:** `visibleArticles('comercial')` não contém `moduleId === 'M6'`. `visibleArticles('cfo')` contém os três P0. Artigo stub omitido.
4. **`?`:** módulo sem artigo visível → botão ausente.
5. **Mestra:** nenhuma célula renderizada contém `P1_Estocador`, `Blend_alvo_`, `_M12_`, `cct_sc_`. 4PL Blend Alvo = dois números.
6. **BE:** alterar `mixCostMode` muda card BE **e** coluna correspondente; valores ≠ freeze 105,2 / 77 / 91,8 só por relabel.
7. **Pills:** DOM das pills de piso não contém `R$`.
8. **Smoke:** `finance-contracts.smoke.test.ts` — Blend Alvo + piso CCT/mediana/caged (totais já travados na folha); mais: M11 reachable; KB article M6 cita SITRAROIT, não snake_case de campo.
9. **Chrome:** teste de presença opcional — TopBar não renderiza “Guia & Onboarding” nem “Comparar”.

## Aceite

1. Sidebar: Mix & Cenários (M6) **e** Plano de Contas (M11). Sem aba bar no M6.
2. `?module=M11` abre CoA, não Mix.
3. Enquadramento / Board Memo só na KB. M6 `?` chega lá.
4. Tornado e sliders de mix na mesma página; preview Mix ainda não PUT até Commit.
5. Tabela: nomes humanos; 4PL duas colunas; zero proxy na célula.
6. Pills de piso sem R$. Cards mudam com mix e com piso.
7. Alerta P5 &lt; 20% permanece no M6. Banner aula Mix some.
8. TopBar sem Guia / Comparar / PDF Global / Relatório M6.
9. `comercial` não vê M6, M11, nem artigos M6 no KB.
10. Sem migration Operator. Ship = `npm run test:smoke` + commit/push + Railway.

## P0 / P1

**P0 (esta entrega):** rotas + redirects + sidebar + chrome TopBar + M6 página única + mestra/labels/4PL/BE live + pills + KB shell + 3 artigos M6 + `?` + testes/smoke acima.

**P1:** colher banners aula restantes (M1–M19, M15) para `src/data/knowledgeBase/articles/`; apagar ou esvaziar `GlobalOnboardingGuide`; artigo M11 se a aula CoA sair do catálogo.

## Ordem de build

1. `mixLabels` + testes de label/4PL (TDD).
2. Renderer da mestra + BE live (não freeze). Pills sem R$.
3. Matar tab shell M6; fundir Mix + `M6Cenarios` embed. Blends no bloco Tornado.
4. Restaurar M11 no `App` / Shell / `canViewModule`; redirects `tab=*`.
5. Catálogo KB + página + `?` + RBAC. Migrar copy Enquadramento / Board Memo / pisos.
6. TopBar magro; esconder Guia.
7. Smoke + `references/financeiro.md` (M11 = CoA; M6 = Mix+Matriz; KB).

## Relação com spec 2026-08-16 unificado

| Tópico | 2026-08-16 | Esta spec |
|---|---|---|
| Mix preview→Commit | vale | vale |
| Tornado live / drivers | vale | vale |
| CoA CRUD só M3 | vale | vale (M11 é o catálogo RO) |
| M11 redirect M6 | vale | **revogado** |
| 5 abas M6 | vale | **revogado** |
| CoA como aba M6 | vale | **revogado** — rota M11 |
| Enquadramento / Board Memo abas | vale | **revogado** — KB |
