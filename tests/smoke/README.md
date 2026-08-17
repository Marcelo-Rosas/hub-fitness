# Smoke — HUB-FITNESS

**Pasta:** `tests/smoke/` (`*.smoke.test.ts` por domínio).  
**Gate:** `npm run test:smoke`  
**Live:** `https://hub.vectracargo.com.br` (`SMOKE_LIVE_URL`). **Nunca** `127.0.0.1` no gate.

Unit/TDD → `src/**/*.test.ts`. Live HTTP **não** mora em `src/__tests__`.

| Arquivo | Contratos |
|---|---|
| `finance-contracts.smoke.test.ts` | CoA 5.2.02, mapper, KPIs, Operator GET |
| `compras-research.smoke.test.ts` | POST live `/api/gemini/compras-research` 5.1.01.03 |

Fallback Gemini **sem HTTP:** `pickComprasResearchFallback` em `src/core/compras/comprasResearchPack.ts` (teste em `compras-pesquisa-e2e.test.ts`).

## Corrida 2026-08-17

```
npx vitest run
Test Files  19 passed
Tests       165 passed
```

Smoke live: health, scenarios, finance bundle, POST compras-research 5.1.01.03 (3 Fitas PET).

## Supabase

Operator: 11 migrations aplicadas. Sem SQL novo nesta correção.

## Ship

1. `npm run test:smoke`
2. commit + push `main`
3. Railway `up` cwd
4. Wrangler só se Worker mudou
5. `apply_migration` só se SQL novo
6. Atualizar esta seção
