# Compras

## Shell
- **M10** Assistente de Compras & Fornecedores (RFQ)
- **M19** Intranet · Alçada (Fila / Árvore / Cargos / Funcionários)

## Fluxo M10 (header)
1. **Pesquisa** — pick CoA analítica (`5.1.01.01`…`.06`, `5.1.05.01`) → **1 conta = 1 insumo** → `POST /api/gemini/compras-research` → **3 fornecedores** → Comparador  
2. **Comparador** — 3 cards / conta (Preço, Volume, Frete, **Prazo**, Custo total)  
3. **Avaliação Tributária** — ICMS / CIF-FOB  
4. **Aprovação · RFQ & Pedidos** — SUBMIT motor intranet (COM → FIN → DIR)  
5. Secundárias: Catálogo · Mapeado vs DRE  

**CoA insumos (1 conta = 1 insumo):**  
`.01` Stretch · `.02` Bolha · `.03` Fitas PET · `.04` Cantoneiras · `.05` Etiquetas · `.06` Ribbons · `.07` Lacre · `.08` EPIs · `.09` Uniformes · `.10` Paletes madeira · `.11` Paletes PEAD · `5.1.05.01` Locação empilhadeiras.

**Volume:** script fixo `monthly_volume_hypothesis: { qty: 1, historical_data: false, status: "sem_dados_historicos" }`. Sem narrativa `basis`. Comparador mostra só “Sem dados históricos de compras”.

**Fallback pesquisa `5.1.01.03`:** `compras-research-fitas-pet.json` (estimativa c/ preço). Folha RFQ preço 0 = `compras-rfq-fitas-pet.json` (aba 4) — não entra no Comparador.

**Comparador CTA:** sem RFQ → botão verde **Enviar para aprovação** (POST `/api/intranet/requests`). `IN_REVIEW` → Aguardando. `APPROVED` → Sync DRE. Login `compras@hubfitness.com.br` (precisa alçada). Não confundir badge “RECOMENDADO VENCEDOR” com Sync DRE.

**M19 fila (aprovador):** card mostra dossiê comercial do `payload` — CoA, volume, preço unitário, frete, landed, prazo→SC, destino, score. Sem preço/prazo/volume operacional → banner “dossiê incompleto” → preferir Pedir correção.

**M19 Cadastro:** tabela `cadastro_contatos` (nome, telefone, e-mail, `account_code`/`account_name`). Cargo = select analíticas do Plano de Contas (`GET /api/intranet/coa-options`, 122 contas). CRUD `/api/intranet/cadastro` — **só socio** (`canManageOrg` + API `requireSocio`).

**RBAC sidebar:** `src/core/rbac/moduleVisibility.ts` + `moduleEdit.ts`. Compras vê M1/M10/M19 (Fila só). Spec/plan: `docs/superpowers/specs/2026-08-15-rbac-module-visibility-design.md`.

**Aprovado** → badge; libera Sync DRE Granular + inclusão no catálogo se faltar.  
**Reprovado / correção** → observação entra no prompt (Ampliar pesquisa).  
Poll: `GET /api/intranet/requests?mine=1`.

## Fluxo RFQ / alçada
1. **FR-01** ou login troca **e-mail** (não só o papel UI). `compras@` pede; `cfo@` aprova; se autor foi `cfo@`, alçada = `socio@` (Carlos Eduardo) por four-eyes.
2. RFQ **não** escolhe decisor. `GET /api/intranet/resolve-approver` mostra a alçada (seed: CFO no Financeiro se autor = compras).
3. **Enviar para aprovação** faz SUBMIT: o motor sobe `sectors.parent_id` (COM → FIN → DIR) e grava assignment.
4. FR-01 → **CFO** (ou Sócio se RFQ veio do CFO) → M19 Fila → Aprovar / Pedir correção / Rejeitar (`expectedVersion`).
5. APPROVE grava `outbox_events` `WORKFLOW.APPROVED`. Resend só no dispatcher, e só com `INTRANET_EMAIL_LIVE=true` + `RESEND_API_KEY`. Sem flag: `email_status=simulated`.

## Dados
- Schema Postgres **`intranet`** no **Operator** (`supabase/migrations/20260814160000_intranet_schema.sql`). Não entra em `[api].schemas`. Sem `GRANT` a `anon`/`authenticated`. Sem `tenant_id`.
- Runtime local: SQLite `data/intranet.sqlite` (mesmo modelo, sem schema Postgres).
- Intranet **não** vive em Client DB (ADR-003).
- Permissão efetiva: `override ?? cargo`. Este cadastro **não** é a matriz salarial do M15.
- Catálogos UI: `src/data/formCatalogs.ts` — **Categoria do insumo filtra Descrição do produto** (`productsForCategory`) em RFQ e cotação manual.
- Prompt CoA: `src/core/compras/researchFromCoa.ts` · UI: `src/components/ComprasPesquisaPanel.tsx`

## Arquivos-chave
- `src/components/modules/M10AssistenteCompras.tsx`
- `src/components/modules/M19Intranet.tsx`
- `src/core/intranet/` (`fsm`, `orgResolver`, `approvalService`, `outboxDispatcher`, `intranetStore`)
- Fixtures BL Impulse: `src/data/fixtures/impulseSample.ts` (BL `06BRZ2311010`)

## Notas
- Comex (DUIMP/NCM) alimenta supply; Compras consome ASN/SKU
- Konnen dogfood pode aparecer como fornecedor/importador de calibração — não BE comercial
- Ad Valorem do DRE permanece 0,10% sobre NF de serviço (não CIF)
- Não grava ingestão com `example: true`, preço 0 ou palete volume ≥300. BL/DI/PI/Packing List = PDF em M18.
- Rotas Express não entram por HMR do Vite — reiniciar `npm run dev` após mudar `registerIntranetRoutes.ts` / `server.ts`.

## Ponte
A purchase spine → Logística (produtos/regime)
