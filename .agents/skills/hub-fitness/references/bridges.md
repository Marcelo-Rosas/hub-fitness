# Pontes A / B / C

## A — PLAN × PHYSICAL
Preservar/adaptar Vectra Dock: plano operacional ↔ eventos físicos (recebimento, desova, posições).  
HUB: Compras ASN + Comex DUIMP → Logística stock/regime.

## B — PHYSICAL × COMMERCIAL
Construir: eventos de capacidade/dwell + contratos → `billing_records` Operator (Financeiro).  
Não escrever billing no Client DB.

## C — SKU × REGIME
Construir: cadastro produto (Client) × classifySku Alpha–Delta × capacity ledger.  
Já iniciado em M17 / `src/core/regimes.ts`.

## Ordem sugerida (GSD)
1. Skill + Shell + M18 scaffold (feito nesta entrega)
2. Ponte B campos de contrato / billing
3. Ponte A RPCs physical
4. PUCOMEX live (Comex)
5. Ponte C refinamentos dwell/market
