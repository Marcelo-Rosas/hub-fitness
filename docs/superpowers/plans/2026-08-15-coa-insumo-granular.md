# CoA Insumo Granular + Card Comparador — Implementation Plan

> **For agentic workers:** implement task-by-task. Checkboxes track progress.

**Goal:** Conta analítica = 1 insumo; pesquisa retorna 3 fornecedores; card com Prazo e custo ≠ 0.

**Architecture:** Fonte CoA em `planoDeContasData.ts`; M10 mapeia via `researchFromCoa.ts`; ingest em `mapPacks.ts`; UI card em `M10AssistenteCompras.tsx`.

**Tech Stack:** TypeScript, React, Vitest, Express Gemini route.

## Global Constraints

- Travas HUB-FITNESS: Ad Valorem 0,10% NF serviço; CAPEX R$ 207.300; Konnen dogfood; sem `tenant_id`.
- Destino cotações: Itajaí/SC; eixo SC→PR→SP.
- UI pt-BR.

---

### Task 1: CoA + tipos MaterialCategory

- [ ] Expandir `MaterialCategory` (`Fitas PET`, `Cantoneiras`; manter aliases).
- [ ] Reescrever bloco `5.1.01.*` + `5.1.05` + estoque `1.1.03.06` + `3.1`.
- [ ] Smoke: lista códigos sem orphan (exceto intencional).

### Task 2: DRE + research map

- [ ] `initialData.ts`: composition por conta; `5.1.05.01` válido.
- [ ] `researchFromCoa.ts`: hint 1:1; clamp 3 quotes; volume basis no prompt.
- [ ] `compras.md` update.

### Task 3: Ingest custo + lead time no quote

- [ ] `mapPacks.ts`: landed 0 → recalc; `deliveryLeadTimeDays` no `SupplierQuote` se precisar.
- [ ] Test unitário landed/prazo.

### Task 4: Card UI + E2E

- [ ] Card: Prazo; custo display.
- [ ] Atualizar `compras-pesquisa-e2e.test.ts` para `5.1.01.02` = Fitas PET.
- [ ] Vitest pass.
