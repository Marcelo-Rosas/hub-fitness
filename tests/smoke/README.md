# Smoke financeiro — HUB-FITNESS

**SSOT de asserts:** `finance-contracts.smoke.test.ts` (um arquivo).  
**Gate:** `npm run test:smoke`  
**Live default:** `https://hub.vectracargo.com.br` (`SMOKE_LIVE_URL` override).

Unit/TDD de módulo **não** mora aqui → `src/**/*.test.ts`.

## Contratos cobertos

| Bloco | O que trava |
|---|---|
| CoA 5.2.02 → DRE | sintética sem lançamento; carência 6m em `5.2.02.01`; condo/IPTU/energia cheios M1; 24m = 6×Y1+12×Y2 |
| Mapper → engine | PUT round-trip; `manualOverride` sobrevive `applyOccupancy`; seed só Analítica |
| Drivers | `rentFactor` por CoA `.01`/`.02`; IPTU `.03` intocado |
| KPI live | `summarizeLiveDre` ≠ freeze CSV 11,9% |
| Operator live | `/api/health`, `/api/operator/scenarios` ≥4, bundle 5.2.02 Sintética + ledger analíticas |

## Corrida 2026-08-17

```
npx vitest run tests/smoke
✓ tests/smoke/finance-contracts.smoke.test.ts (14)
  live GET /api/health
  live GET /api/operator/scenarios ≥ 4
  live GET /api/operator/finance/bundle (5.2.02 Sintética; 5.2.02.01/02 no ledger)
```

**14/14 PASS.** Commit gate ok.

Suite completa `npx vitest run`: 163 pass / 1 fail `compras-pesquisa-e2e` live Gemini (`POST /api/gemini/compras-research` `res.ok=false`) — **fora** deste smoke; não bloqueia DRE/CoA.

## Supabase

Operator `qrmdgvxrdvapdvmmktkj`: 11 migrations já aplicadas (última `ledger_fator_r_flags`). **Sem SQL novo** nesta entrega. Re-apply = drift de histórico.

## Ship

1. `npm run test:smoke`
2. commit + push `main`
3. Railway `up` cwd (build novo)
4. Wrangler só se Worker mudou
5. `apply_migration` só se `supabase/migrations/**` mudou
6. Atualizar **esta** seção com data + PASS/FAIL
