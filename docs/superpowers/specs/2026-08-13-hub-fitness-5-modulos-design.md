# HUB-FITNESS — 5 módulos de produto + ADR-003

**Status:** Aceito (plano Skills + 5 Domínios) · 2026-08-13  
**Contexto:** Planner 3PL fitness (Itajaí). Database-per-client (ADR-003). Skill de contexto mínimo por domínio (padrão cargo-flow-navigator).

## Travas

- Ad Valorem = 0,10% sobre **NF de serviço**, nunca sobre CIF de carga no DRE
- CAPEX R$ 207.300 travado
- Konnen = dogfood / calibração — não âncora comercial de BE
- Sem `tenant_id` em Client DBs
- Comex densid/CIF alimentam pitch e CLIA; **não** inflar `rec-advalorem`

## Decisão: cinco núcleos + transversais

| Módulo | Shell | Dados (ADR-003) | Ponte |
|---|---|---|---|
| Financeiro | M2, M3, M4, M5, M11, M15 | Operator: billing, tax, Fator R, rollup | B billing |
| Comercial | M13, M14, M16 | Operator: clients, contracts, price_* | B comercial |
| Logística | M17, M12 | Client: products/regime, WMS; Operator: capacidade | A + C |
| Compras | M10 | Client: orders, invoices, supply | A purchase |
| Comex | **M18** | Client: DUIMP/processos por importador; Operator: auth CT + portos/ATIT | A aduaneiro |

**Transversais:** Executivo (M1, M9) e Estratégia (M6–M8).

## Shell

- Remover grupo “Operacional”
- Grupos: Executivo · Financeiro · Comercial · Logística · Compras · Comex · Estratégia
- M10 → Compras; M12+M17 → Logística; M18 → Comex

## Comex (M18) — escopo desta entrega

Preservar conceito do ComexView de referência:

1. Card status PUCOMEX (stub)
2. KPIs processos / FOB USD / CIF BRL
3. Aba Processos CRUD (consumidores 3PL; NCM 9506)
4. Aba Portos (subset SC: Navegantes/Itapoá/Santos + CN)
5. Aba Cidades ATIT (subset)
6. Consulta DU-E / DUIMP / CCT (API stub)
7. Auditoria NCM Gemini (rota stub / Gemini se key)
8. Docs API PUCOMEX (links)

**Fora:** e-CNPJ produção, Serpro live, vínculo Freight TMS LogiTwenty.

## Skill

`.agents/skills/hub-fitness/` com `SKILL.md` + `references/{financeiro,comercial,logistica,compras,comex,bridges,adr-003}.md`.

## Critério de aceite

- Sidebar com 5 núcleos + transversais; M18 navegável
- Spec + skill + stubs API presentes
- Sem mudança CAPEX / Ad Valorem NF / ADR-003
