# Logística

## Shell
M17 Simulador Anexo V · M12 Contratos & SLAs (operacional galpão)

## Dados
- **Client DB:** products, regime Alpha–Delta, reservations, stock
- **Operator:** capacity rollup, feuYield (leitura agregada)

## Arquivos-chave
- `src/core/regimes.ts`, `feuYield.ts`, `capacityLedger.ts`
- `src/components/modules/M17SimuladorAnexoV.tsx`
- `src/data/fixtures/brightwaySample.ts`, `impulseSample.ts`
- Spec: `docs/superpowers/specs/2026-08-13-regimes-capacidade-design.md`

## Travas
- Budgets: 2968 rack positions · 255 m² floor
- `palletsPerFeu: 22` (CLIA) paralelo a `feuYieldByRegime`
- Fluxo ≠ estoque sem dwell; proibido % market share

## Pontes
A (plan×physical) · C (SKU×regime)
