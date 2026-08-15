# Regimes de capacidade + Simulador Anexo V (M17)

Contrato: HANDOFF v2. Motor de 4 regimes + ledger triplo no HUB-SIM. DRE oficial, CLIA e `palletsPerFeu` intactos.

## Travas

- Ad Valorem = 0,10% sobre NF de serviço (~R$ 205/mês Y1), nunca sobre CIF da carga
- CAPEX R$ 207.300 travado
- Konnen ≠ âncora comercial (dataset de calibração)
- Fluxo ≠ estoque sem dwell; proibido % de market share
- Tecadi desmente “único heavy-duty”; somos únicos *especializados fitness*
- Ticket R$ 91,50 é saída (receita÷posições), não entrada a decompor
- `palletsPerFeu: 22` permanece (CLIA/desova); `feuYieldByRegime` entra em paralelo
- ISS 3% = nota; engine só DAS 6%

## Ordem `classifySku`

1. `regimeOverride`
2. skid + cabe no envelope → **alpha**
3. skid + não cabe → **gamma**
4. no_base + `stackLimit ≥ 3` → **delta** (mesmo se oversized)
5. no_base → **beta**

Geometria: `beamClearMm: 2300`, `depthMm: 1000`, clearX 75, clearY 150, minOverhang 50, upright 6000.

## Budgets

- `rackBudgetPositions: 2968`
- `floorBudgetM2: 255` (~15% Zona B)
- Não usar denominador 2523

## Glossário

| Nome | Significado |
|---|---|
| **HUB-FITNESS** | Operador 3PL / infraestrutura (docs e pitch) |
| **KONNEN** (código legado) | Naming histórico de racks/galpão no UI — não renomear neste sprint |
| **Konnen (empresa)** | Importadora do grupo; dataset de calibração + cliente potencial, nunca âncora de BE |

## Pitch investidor

Gap + densidade (25,9 t/FEU) + pipeline mapeado. Hipóteses declaradas: dwell, mix, % share, contrato. Sem percentual de mercado inventado em paletes.

## Escopo

**In:** `regimes.ts`, `capacityLedger`, params estendidos, M17, fixtures mínimos, testes.

**Out:** WMS operacional, API Logcomex, TAM fechado, rename KONNEN, alteração DRE/Ad Valorem/CAPEX.
