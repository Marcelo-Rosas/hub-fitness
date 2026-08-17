---
name: hub-fitness
description: >
  Skill de contexto mínimo para o projeto hub-fitness (HUB-FITNESS 3PL Fitness Planner).
  Use SEMPRE ao trabalhar em módulos, pontes ADR-003, DRE, regimes, Comex ou schema Operator/Client.
  Ativa em: HUB-FITNESS, hub-fitness, M1–M19, Fator R, Anexo V, regimes Alpha–Delta,
  Comex, PUCOMEX, DUIMP, Konnen dogfood, database-per-client, Ponte A/B/C, Ad Valorem.
  Objetivo: carregar só o reference do domínio tocado.
---

# HUB-FITNESS — Skill de Contexto Otimizado

## Visão Geral

**Empresa:** HUB-FITNESS — 3PL especializado fitness (Itajaí / Navegantes, SC)  
**Stack:** Vite + React 19 + TypeScript + Tailwind 4 + Express (`server.ts`) + Gemini + Supabase (ADR-003)  
**Produto:** Planner financeiro/comercial/logístico + scaffold Comex; não é TMS Vectra Cargo

## Mapa módulo → reference

Leia **somente** o arquivo do domínio da tarefa:

| Domínio / Tarefa | Arquivo |
|---|---|
| DRE, Fator R, billing, M2–M5, M11, M15 | `references/financeiro.md` |
| CRM, CPQ, clusters, M13–M14, M16 | `references/comercial.md` |
| Regimes, M17, M12 SLA, capacidade | `references/logistica.md` |
| Fornecedores, ASN, M10, M19 intranet, BL Impulse | `references/compras.md` |
| PUCOMEX, DUIMP, portos, M18, NCM 9506 | `references/comex.md` |
| Pontes PLAN×PHYSICAL / PHYSICAL×COMMERCIAL / SKU×REGIME | `references/bridges.md` |
| Operator vs Client DB, sem tenant_id | `references/adr-003.md` |

**Regra:** no máximo 1 reference por tarefa (mais bridges/adr-003 se a tarefa cruzar fronteira de dados).

## Convenções (não perguntar)

- **Canônico vivo:** `hub-fitness.md` (raiz) + `.cursor/rules/hub-fitness.mdc` — ship = `test:smoke` + commit/push + Wrangler + migrations, sem acumular
- Smoke: `tests/smoke/finance-contracts.smoke.test.ts` — `npm run test:smoke`
- Módulos: `src/components/modules/M*.tsx` + `App.tsx` switch + `Shell.tsx` grupos
- Estado planner: `src/context/PlannerContext.tsx`
- Core: `src/core/` (regimes, capacityLedger, advisor)
- API: Express em `server.ts` (`/api/...`)
- Moeda UI: BRL com `toLocaleString('pt-BR')`
- Konnen (empresa) = Client DB #0 dogfood — não âncora BE
- CAPEX travado R$ 207.300; Ad Valorem 0,10% sobre NF de serviço

## Anti-patterns

- Não reusar skill `cargo-flow-navigator` (outro domínio)
- Não inventar market share sem dwell
- Não aplicar Ad Valorem sobre CIF de carga no DRE
- Não introduzir `tenant_id` em Client DB
- Não acumular: código sem push, Worker sem Wrangler, SQL sem apply remoto
