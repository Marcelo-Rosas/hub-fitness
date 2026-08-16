# Inventário hardcodes + gaps de DB — todos os módulos (M1–M19)

**Data:** 2026-08-15  
**Método:** grep UI `M*.tsx` + schemas Supabase Operator/Client/intranet + audit 2026-08-14  
**Skill:** hub-fitness (visão cross-domínio)

## Legenda

| Símbolo | Significado |
|---------|-------------|
| 🔴 | Hardcode crítico (número de negócio / alçada / KPI mentiroso) |
| 🟠 | Copy/seed petrificado (BP v3.5 na UI) |
| 🟡 | Default aceitável se marcado estimativa/demo |
| ✅ DB | Tabela existe e módulo (pelo menos em parte) usa |
| ❌ DB | Falta tabela / módulo só TS/memória |
| ⚠️ DB | Tabela Operator/Client existe mas **não** ligada ao módulo |

---

## Mapa por módulo

| M | Hardcodes principais (ainda no código) | DB hoje | Falta no banco |
|---|----------------------------------------|---------|----------------|
| **M1** Dashboard | 🟠 Copy CAPEX/galpão R$ 83,8k→43,2k; labels Payback ainda em texto | ❌ séries só Context/engine | `scenario_snapshots` / params versionados Operator |
| **M2** DRE | 🔴 PDF `capexTotal: 207300`; breakdown M7 com PL `7000` literal | ❌ ledger em memória Context | Operator `ledger_lines` ou Client DRE sync |
| **M3** Cad. financeiro | Melhor: edita CoA/ledger vivo; ainda usa `planoDeContasData` seed | ⚠️ CoA em TS | Operator/Client `chart_of_accounts` CRUD persistido |
| **M3** Receita VAS (legado) | 🟠 KPI `R$ 91,50` | ❌ | absorvido por M14/params |
| **M4** Caixa | 🟠 Label Payback `+R$ 52,1k` / `-R$ 5,8k` (marcos já derivados em parte) | ❌ | cash series persistida |
| **M5** Fator R | 🟠 KPI `R$ 68.4k`; copy `+R$ 2.200` | ❌ | `fiscal_phases` Operator |
| **M6** Cenários | 🟠 CAPEX WMS R$ 0 / Logcomex copy; tabela CCTV R$ 0 | ❌ | `scenario_defs` |
| **M7** Ano3 | 🔴 CAPEX steps R$ 180k / 400k+400k; 4PL +101,5k; forklift 4800; Y3 tabela 3,6M | ⚠️ `params.year3` parcial | `expansion_plan` DB |
| **M8** Spin-off | 🔴 `rbt12Year5 = 4810000`; NPV/caixa literais | ❌ | projeção RBT12 engine-only + snapshot |
| **M9** Governança | 🔴 Checklist todo `true` + refs 205.200 / 63.000 / 2968 / PL 7k–11k | ❌ | `governance_checks` derivados |
| **M10** Compras | 🔴 Insights R$ 52/58/42,50/39,90; `score: 85` local; ingest score 92/86/80; volume qty 1 | ❌ quotes | **`intranet_suppliers` + `intranet_quotes`** (spec Plan B) |
| **M11** Plano Contas | 🟠 Copy CAPEX 207.300 / Fator 28,4% / R$ 16,45/pos; PL sim 18500 | ⚠️ catálogo TS | CoA DB |
| **M11** Mix | 🔴 `totalCapacity = 2968`; `pos88 = 2612`; MC/ticket P1–P5 literais; OPEX 143k/164k/120k | ❌ | capacity + mix profiles DB |
| **M12** Contratos SLA | 🟡 defaults NF 150k / loss 1800 | ❌ | `contracts` Operator existe ⚠️ **não ligado** |
| **M13** CRM | 🔴 Pipeline seed MaxFitness/… revenues 18500/15000; MC 52,50; setup 2500 | ❌ | `crm_deals` Client (não provisionado no runtime app) |
| **M14** CPQ | 🔴 `totalCapacityKonnen = 2968`; pisos 22,50 / 25 / 1400 / 0,75; meta M7 205.2k | ⚠️ price_categories Operator | ligar CPQ → `price_category_items` |
| **M15** RH | 🔴 HC custos 25k–51k; PL +7k/+11k/+15k; economia DAS ~270k; peril 960 | ❌ | `hr_roles` / payroll catalog Operator |
| **M16** Benchmark | 🟡 Forte CIF via params (melhor); SANCO piso 1400 ainda copy | ⚠️ params | tabela benchmark versionada |
| **M17** Anexo V | 🟠 CAPEX 207.300; Ad Valorem ~205/mês; Konnen calibração | ❌ regimes em TS | `regime_params` |
| **M18** Comex | 🟡 NCM default `9506.91.00`; catalogs portos/ATIT TS | ✅ `comex_*` Client SQLite/PG | clients Operator p/ dogfood filter |
| **M19** Intranet | 🔴 gaps `1 un`; seed UUID personas; sem token/notify | ✅ org/requests/outbox/cadastro | **tokens**, **suppliers**, **quotes**, **ops_real_started** |

---

## Bancos existentes (resumo)

### Operator (Postgres)

`clients`, `contracts`, `price_table_kinds`, `price_categories`, `price_category_items`, `tax_rates`, `billing_records`, `operator_profiles`, `agent_swarm`, `audit_log`  
+ schema **`intranet.*`**: sectors, job_titles, employees, workflow_defs, requests, assignments, decisions, audit_logs, outbox_events, cadastro_contatos

### Client (Postgres / SQLite comex)

`client_profiles`, `products`, stock/orders/invoices… (WMS-ish)  
`comex_field_defs`, `comex_processes`, `comex_documents`

### Runtime app hoje

- Planner: **React Context + TS seeds** (quase nenhum módulo financeiro grava Operator)  
- Intranet: **SQLite** `data/intranet.sqlite`  
- Comex: **SQLite** `data/comex.sqlite`

---

## Top gaps DB (priorizados)

| # | Gap | Módulos | Por quê |
|---|-----|---------|---------|
| 1 | `intranet_suppliers` + `intranet_quotes` | M10, M19 | Divergência preço / score fake / APPROVE sem dossiê |
| 2 | `intranet_approval_tokens` + NOTIFY | M19 | Plan B e-mail |
| 3 | `ops_real_started(_at)` | M19 | Regra volume M3+ |
| 4 | CoA / ledger persistido | M2, M3, M11 | Cadastro vivo some no refresh se só Context |
| 5 | Ligar M14 → `price_category_items` | M14, M16 | Pisos SANCO já modelados no Operator, UI ignora |
| 6 | Ligar M12 → `contracts` | M12 | Tabela vazia de uso |
| 7 | CRM/CPQ Client tables wired | M13, M14 | Seed TS |
| 8 | `HubParams` → tabela Operator versionada | M1–M9, M17 | SSOT ainda é `params.ts` |
| 9 | Auth real vs `MOCK_BOARD` | todos | Produção pitch ainda demo |

---

## Já melhorou desde 2026-08-14 (não reabrir)

- Engine lê `dasPct` / rampas / carência de params  
- `deriveCashMilestones` em M1/M4/M7/Shell (núcleo)  
- Fator R / createNewScenario via params  
- M19 cadastro_contatos + RBAC matriz código  

Copy e KPIs literais **ainda** infestam M1/M2/M7–M9/M11/M14/M15 — milestones derivados ≠ texto limpo.

---

## Ordem sugerida (produto)

1. **M10/M19 ledger cotações** (spec Plan B fase 0)  
2. **Plan B token e-mail**  
3. Wire **M14 ↔ price_*** Operator  
4. Persist **CoA/ledger** (M3)  
5. Limpar copy P0 restante M7/M9/M11/M15  
6. Auth fora de mock no deploy prod  

Fonte viva deste arquivo: grep 2026-08-15 + schemas em `supabase/`.
