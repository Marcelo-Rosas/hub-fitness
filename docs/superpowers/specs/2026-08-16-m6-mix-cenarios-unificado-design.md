# Spec — M6 unificado: Mix & Cenários (P2 Mix→COGS + shell)

**Data:** 2026-08-16  
**Status:** aprovado (2026-08-16) — **shell/abas/redirect M11 revogados** em [`2026-08-17-knowledge-base-m6-m11-design.md`](./2026-08-17-knowledge-base-m6-m11-design.md). Pipeline Mix preview→Commit e Tornado **continuam**.  
**URL:** `https://hub.vectracargo.com.br`  
**Approach:** 1 — Shell fino (`M6MixCenarios` + painéis reutilizados)

**Contexto:** ScenarioDrivers (P0+P1) e Phase 5 CoA/ledger já shipped. Mix (M11) e Cenários (M6) ainda são rotas separadas; `applyMixToGlobalModel` muta ledger no gesto do slider (side effect). Esta spec unifica a rota e trava **preview → Commit** para Mix (+ COGS variable).

**Specs relacionadas:**
- `2026-08-16-scenario-drivers-design.md` (drivers / Tornado live)
- `2026-08-16-finance-coa-ledger-design.md` (M3 SSOT ledger/CoA)

## Problema

1. **Dois módulos** para um bloco analítico do BP v3.5 (“Cenários e mix”).
2. **Mix grava no ledger sem confirmação** — viola simulação ≠ cadastro; undo caro.
3. **Semântica dividida** — drivers = preview+autosave; Mix = write imediato.
4. **CoA editável em M11** compete com M3 (dois editores).

## Decisões (brainstorming)

| # | Decisão |
|---|---|
| 1 | Mix→COGS **B**: preview local → botão Commit; sem PUT até Commit |
| 2 | Rota canônica **M6**; M11 → redirect M6; CoA = aba (já travado placement B) |
| 3 | v1 **sem** aba Custos & Despesas bottom-up (v1.1); custos via ScenarioDrivers na Matriz |
| 4 | Aba Plano de Contas = **somente leitura**; CRUD CoA/CC só no **M3** |
| 5 | Persistência **dual**: drivers autosave cenário; Mix só Commit ledger |
| 6 | Preview Mix **alimenta** Matriz/Tornado/KPI live + badge “Mix pendente” |
| 7 | Implementação **Approach 1** (shell fino; reuso `M6Cenarios` + painéis M11) |
| 8 | Sidebar: M6 em **Financeiro**, label “Mix & Cenários”; remove item M11 |
| 9 | Redirect M11 preserva query params (`tab`, etc.) via `history.replaceState` |

## Fora de escopo (v1)

- Aba editor bottom-up de custos/despesas (v1.1)
- Rewrite monólito / deletar arquivos `M11*`
- Unificar Commit Mix + drivers num único botão
- Ad Valorem CPQ / CAPEX por cenário
- Snapshot ledger por cenário
- Migration SQL nova (não necessária)

## Abas v1

| # | Tab id | Conteúdo | Fonte UI | Edição |
|---|---|---|---|---|
| 1 | `mix` | Sliders P1/P2/P4/P5 + preview + Commit / Descartar | Painel Mix de `M11SimuladorMix` | Sliders + Commit se `canEditFinance` |
| 2 | `matriz` | Drivers + A/B + Tornado live + badge Mix pendente | `M6Cenarios` | Drivers autosave (já shipped) |
| 3 | `enquadramento` | Matriz técnica + proxies | Tab M11 | RO |
| 4 | `board_memo` | Leitura Board | Tab M11 | RO |
| 5 | `plano_contas` | Árvore CoA + flags | `M11PlanoDeContas` readOnly | RO |

## Arquitetura

### Pipeline (ordem fixa)

```
ledgerBaseItems                      // SSOT M3 / Operator (sem engines)
  → applyMixPreview(base, scale)     // NOVO — receita + custo variable
  → applyOccupancyToDreItems
  → applyTechOpexToDreItems
  → applyCliaToDreItems
  → applyScenarioDrivers(drivers)    // autosave cenário (shipped)
  → projectDreFromLedger(occ)
  → deriveScenarioKpis / Tornado / Fator R display
```

**Importante:** Mix opera sobre **base crua** (`ledgerBaseItems` / state `granularDreItems` pré-engine), não sobre o output já driver-ajustado.

### Anti-compound

- `activeRatio = weightedMcPos(activeMix) / 74.15` (Blend Alvo)
- `committedMixRatio` (default `1`; após Commit = ratio aplicado)
- `scale = activeRatio / committedMixRatio` aplicado aos valores **atuais** do ledger base
- `isMixDirty = abs(activeRatio - committedMixRatio) > ε`
- Após Commit: grava preview no ledger + `committedMixRatio = activeRatio` + `isMixDirty = false`
- Edição M3 posterior atualiza a base; próximo preview usa o mesmo `scale` relativo

### `applyMixPreview` (regras)

| Alvo | Condição |
|---|---|
| Escala Y1/Y2 | `section === 'receita'` e `!engineLocked` e `id !== 'rec-4pl-ct'` |
| Escala Y1/Y2 | `section === 'custo'` e `costBehavior === 'variable'` e `!engineLocked` |
| Não escala | `hc`, custos/despesas `fixed`, CLIA/engineLocked, 4PL CT |

### Context API (delta)

| API | Papel |
|---|---|
| `activeMix` / `updateActiveMix` | Sliders (existente) |
| `committedMixRatio` | Último ratio commitado |
| `isMixDirty` | Preview ≠ commitado |
| `previewMixItems` | Resultado `applyMixPreview` |
| `effectiveLedgerForProjection` | Base ou preview → entra no pipeline |
| `commitMixPreview()` | Diff → PUT só linhas alteradas → audit → sync ratio |
| `discardMixPreview()` | Restaura sliders ao mix equivalente ao ratio commitado |
| `applyMixToGlobalModel` | Depreca → alias / remove callers (vira Commit) |

### Persistência (dual)

| Ação | Semântica | Persistência | Audit |
|---|---|---|---|
| Ajustar driver | Preview + autosave ~300ms | `PUT /api/operator/scenarios/:id` | Último valor vence |
| Ajustar Mix (slider) | Preview local | Nenhum | Nenhum |
| Commit Mix | Explícito | `PUT .../ledger/:id` × N (só diff) | “Mix Aplicado” + qtd linhas |
| Descartar Mix | Local | Nenhum | Opcional |

**Commit — só linhas alteradas:**

```ts
const changedItems = previewMixItems.filter((p) => {
  const base = ledgerBaseItems.find((b) => b.id === p.id);
  return (
    !!base &&
    (p.monthlyAmountY1 !== base.monthlyAmountY1 ||
      p.monthlyAmountY2 !== base.monthlyAmountY2)
  );
});
```

### Fator R (preview-aware)

| Componente | Fonte | Razão |
|---|---|---|
| Numerador (folha HC) | `ledgerBaseItems` + `fatorRFolhaMensalFromLedger` | Mix não escala HC |
| Denominador (RBT12) | `dreMonths` do pipeline com `effectiveLedgerForProjection` | Receita sente Mix preview |

Mover sliders **altera Fator R exibido** sem Commit (denominador). Numerador estável.

### Shell / redirect / RBAC

- `App.tsx`: `M6` → `M6MixCenarios`; `M11` → preserva query (`module=M6`, mantém `tab`) + `setActiveModule('M6')`
- Sidebar: remove M11; M6 label “Mix & Cenários”, grupo **Financeiro** (após M5); Estratégia = M7 + M8
- `canViewModule('M11')` → compat se pode ver M6
- Commit / discard: `canEditFinance` && !pitchMode
- Comercial/compras: sem M6 (inalterado)
- Arquivos `M11*` permanecem como painéis na v1

### CoA read-only

Aba `plano_contas` exibe código, nome, nível, grupo, natureza, tipo e flags (`isFatorRNumerator`, `isFatorRExcluded`, `isDasTax`, `isCapex`, etc.). Sem CRUD. CTA implícito: editar no M3.

## Aceite

1. Sidebar: um item “Mix & Cenários” (M6) em Financeiro; M11 ausente
2. `?module=M11&tab=enquadramento` → M6 + aba enquadramento
3. Sliders Mix movem Tornado/KPI/Fator R (denominador) sem PUT ledger; badge Mix pendente
4. Commit → só diff Y1/Y2 → Operator + audit; dirty limpa
5. Discard → limpa badge / restaura ratio commitado
6. Drivers continuam autosave em `scenario_defs`
7. CoA aba RO; CRUD só M3
8. Pitch / sem `canEditFinance` → Commit bloqueado + banner

## Testes

- Unit: `applyMixPreview` — receita + variable; HC/fixo/CLIA intactos; anti-compound
- Unit: diff Commit = subset de linhas
- Unit: Fator R folha=base, RBT12=path preview (mock)
- Unit: RBAC `M11`↔`M6`; comercial sem M6
- Smoke: dirty→Tornado→Commit→reload; Discard; deep-link tab

## Ship

- Sem migration Worker/SQL nova
- Commit(s) atômicos + push `main` + Railway fresh build

## v1.1 (documentado, não implementar agora)

Aba Custos & Despesas = editor bottom-up com mesmo contrato preview→Commit, overrides temporários sobre `ledgerBaseItems`, Commit conjunto ou botão dedicado — sem retrabalho do pipeline v1.
