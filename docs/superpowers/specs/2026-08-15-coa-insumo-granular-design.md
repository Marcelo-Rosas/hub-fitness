# Design — CoA por insumo + card Comparador

**Status:** aprovado via “Go” (2026-08-15)  
**Decisão de código:** opção **A** (analíticas flat nível 4)

## Objetivo

Pesquisa M10 = **1 conta analítica = 1 insumo = 3 fornecedores**. Comparador mostra Prazo + custo mensal correto.

## CoA (delta) — 1 conta = 1 insumo

| Código | Conta |
|---|---|
| 5.1.01.01 | Filme Stretch PEBD |
| 5.1.01.02 | Plástico Bolha |
| 5.1.01.03 | Fitas de Arquear PET |
| 5.1.01.04 | Cantoneiras Rígidas |
| 5.1.01.05 | Etiquetas Térmicas WMS |
| 5.1.01.06 | Ribbons |
| 5.1.01.07 | Fita Lacre / Stretch Tape |
| 5.1.01.08 | EPIs |
| 5.1.01.09 | Uniformes |
| 5.1.01.10 | Paletes PBR HT Madeira |
| 5.1.01.11 | Paletes Plástico PEAD |
| 5.1.05.01 | Locação Empilhadeiras / OPEX Frota |

Espelho Ativo `1.1.03.01`…`.11` (+ limpeza `.12`). PL: sintética `3.1`.

## Card Comparador

Ordem: descrição → Preço Unitário → Volume Mensal → Frete Mensal → **Prazo de Entrega (dias)** → Custo Total Mensal.  
Custo: `unit×volume + frete`; ignorar `landed_cost_* = 0` do Gemini.

## Volume

Prompt CoA exige `monthly_volume_hypothesis: { qty, basis }`. Sem motor interno — hipótese explícita na pesquisa.
