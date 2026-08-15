# Prompt — Deep Research: insumos de Armazém Geral (HUB-FITNESS)

**Só para pesquisa de mercado de insumos** (stretch, paletes, fitas, EPIs, locação).  
**Pesquisa no M10** = conta do Plano (`5.1.01*`) → gera prompt escopado → Gemini/Deep Research. Este arquivo continua o prompt-mãe completo. Retorno JSON cola na mesma aba Pesquisa.

## O que este prompt NÃO faz

Documentos operacionais **não** vêm de Deep Research. A fonte da verdade é o PDF:

| Tipo | Fluxo |
|---|---|
| Insumos / fornecedores | Deep Research → JSON → M10 popular |
| **BL, DI, PI, Packing List** (e correlatos) | **Upload PDF → JSON → popular processo** (M18) |

Em M18: soltar o PDF (ou indexar `D:\Comex`). O sistema classifica o tipo, extrai campos e grava o `payload`. Sem CSV e sem form como caminho principal.

---

## Prompt (copiar a partir daqui)

```
Você é um analista sênior de compras e tributação logística (ICMS interestadual + CIF/FOB) especializado em operação de ARMAZÉM GERAL (AG) / 3PL no Sul do Brasil.

MISSÃO
Fazer pesquisa profunda, com fontes citáveis (2024–2026), dos insumos PRINCIPAIS consumidos numa operação de Armazém Geral de alto cubo (porta-paletes 8,5 m, empilhadeira retrátil >500 kg, paletização inbound/outbound, kitting B2C e desova de contêiner).

O resultado alimenta um banco de dados. Cada afirmação de preço, alíquota, lead time ou condição de frete precisa de fonte (site do fabricante/distribuidor, edital, tabela pública, notícia setorial, sindicato, ANEEL, SEFAZ, NBR). Se o preço for estimativa de mercado, marcar explicitamente "ESTIMATIVA" e dar faixa (min–máx).

CONTEXTO DA OPERAÇÃO (travas — não inventar outro cenário)
- Operador: HUB-FITNESS, 3PL especializado em fitness & sportswear.
- Tipo: Armazém Geral + 3PL (não e-commerce puro, não CD de varejo alimentar).
- Base física: Galpão A, Itajaí / Navegantes, SC. Corredor BR-116 / BR-376. Portos: Navegantes, Itapoá; Santos só como origem de carga, NÃO como destino de compra de insumos.
- Capacidade: ~2.968 posições palete (infraestrutura do operador). CAPEX de racks já definido — NÃO pesquisar compra de porta-paletes como insumo recorrente.
- Carga típica: equipamentos fitness / sportswear, SKUs skid e no-base, alguns oversized, paletes PBR 1,20 × 1,00 m, unitização heavy-duty.
- Regime fiscal do operador: Simples Nacional Anexo III (DAS 6%). INSS patronal NÃO entra como encargo CLT separado. ICMS de COMPRA de insumos: mapear alíquota interestadual 12% (Sul/Sudeste) vs interna 17–18% conforme UF do fornecedor.
- Destino de TODAS as cotações: Itajaí/Navegantes (SC). Frete CIF “para o Estado de SP” é IRRELEVANTE e deve ser descartado como vencedor. Landed cost = preço + frete até o Galpão A + ICMS destacado (quando aplicável).
- Eixo de fornecedores a priorizar: SC (local) → PR (Curitiba / Ponta Grossa) → SP (somente se landed cost em SC ganhar).
- Konnen (importadora do grupo) é dataset de calibração / dogfood — NÃO tratar como âncora comercial nem como fornecedor-alvo de insumos.

O QUE PESQUISAR (categorias obrigatórias)

1) FILME STRETCH / UNITIZAÇÃO
   - Filme stretch manual e automático PEBD (500 mm, 20–25 µm, bobina ~3–4 kg; machine stretch 17–23 µm se houver).
   - Filme stretch pigmentado (azul) para ocultação.
   - Volume de referência: ~140–150 bobinas/mês (ajustar se a fonte sugerir consumo por palete expedido; documentar a hipótese: bobinas/palete).
   - Fornecedores no eixo SC–PR–SP (ex.: conversores PEBD, MBB/Polycamp, regionais de Brusque/Joinville/Curitiba). Validar se ainda existem e se atendem SC.

2) PALETES
   - Palete PBR madeira HT (tratamento fitossanitário NIMF-15 / HT) 1,20 × 1,00 m.
   - Palete plástico PEAD (pool vs compra).
   - Locação / pooling (Chep, Brambles, regionais) com R$/mês.
   - Lote inicial ~300 un + reposição quinzenal. Comparar Ecopack (PR), SB Pallet (SP), Águia Pallets (SC) e equivalentes reais encontrados.

3) FITAS, CANTONEIRAS, LACRE
   - Fita de arquear PET 16–19 mm alta tenacidade.
   - Cantoneira de papelão/plástico para heavy-duty.
   - Fita lacre / stretch tape / etiquetas de lacre.
   - Consumo: amarrações de equipamentos + kitting B2C.

4) ETIQUETAS & IDENTIFICAÇÃO (WMS)
   - Etiquetas térmicas Zebra / GS1-128 (posições palete + volumes).
   - Ribbon cera/resina.
   - Consumo por posição + por expedição.

5) EPIs & UNIFORMES (NR-11 / NR-16 / operação em altura 8,5 m)
   - Capacete, luva, bota, colete, óculos, protetor auricular.
   - Cinto/talabarte se aplicável a retrátil em altura.
   - Uniforme operacional. Reposição mensal para ~8 operacionais CLT + 2 sócios fora desta conta.

6) MOVIMENTAÇÃO (OPEX, não CAPEX de compra de máquina)
   - Locação full-service empilhadeira retrátil elétrica >500 kg, operação 8,5 m, bateria lítio preferencial, SLA técnico ≤4 h no Vale do Itajaí / Itajaí-Navegantes.
   - Transpaleteira elétrica.
   - Peças / franquia de manutenção se NÃO inclusa no full-service.
   - NÃO vender “CIF SP” como vantagem. Atendimento técnico em SC é critério eliminatório.

7) ENERGIA & UTILIDADES (se houver dado público)
   - Tarifa trifásica SC (Celesc / Mercado Livre ACL) para recarga de baterias + iluminação LED de galpão.
   - Ordem de grandeza R$/kWh e demanda. Marcar ESTIMATIVA.

8) OUTROS INSUMOS DE AG que o 3PL típico consome e que ainda NÃO listamos
   - Stretch hood, filme bolha, cantoneira de EPS, fita adesira packing, lacre de container, dessecante, paleteiras manuais, filme VCI (se fitness/metal), material de limpeza de pátio, coletores, fardos, stretch net.
   - Incluir SOMENTE se for recorrente em AG/3PL de equipamentos (não mercearia).

PARA CADA SKU / ITEM, PREENCHER (JSON)

Gerar um único JSON UTF-8 válido neste envelope (obrigatório para ingestão no Planner, sem CSV):

{
  "domain": "compras",
  "items": [ { ...objeto abaixo... } ]
}

Cada item:

{
  "category": "Filme Stretch | Paletes PBR HT / Plastico | Fitas & Cantoneiras | Etiquetas WMS | EPIs | Locacao Empilhadeiras | Energia Trifasica | Outros AG",
  "item_name": "",
  "sku_spec": "dimensão, micragem, norma, certificação (HT, NR, NBR)",
  "unit_of_measure": "bobina | un | kg | rolo | mês/equipamento | kWh",
  "monthly_volume_hypothesis": { "qty": 0, "basis": "ex.: 0,4 bobina/palete expedido × 350 paletes" },
  "suppliers": [
    {
      "legal_name": "",
      "trade_name": "",
      "cnpj": "se público",
      "city": "",
      "uf": "SC|PR|SP|outro",
      "website": "",
      "phone": "",
      "email": "",
      "specialty": "",
      "freight_type_quoted": "CIF|FOB|a confirmar",
      "freight_covers_itajai_sc": true,
      "lead_time_days_to_itajai": 0,
      "payment_terms": "",
      "icms_rate_pct": 0,
      "unit_price_brl": 0,
      "price_date": "AAAA-MM",
      "price_type": "tabela|cotacao_publica|estimativa",
      "shipping_cost_monthly_brl_to_itajai": 0,
      "landed_cost_monthly_brl": 0,
      "moq": "",
      "notes": "",
      "sources": ["url1", "url2"]
    }
  ],
  "recommended_for_hub_sc": {
    "supplier_trade_name": "",
    "reason": "landed cost no Galpão A + lead time + ICMS + SLA técnico",
    "discarded_sp_cif_trap": "true se alguém oferece CIF só para SP"
  },
  "accounting_hint": "conta sugerida (ex. 5.1.01.01 stretch, 5.1.01.02 fitas, 5.1.01.03 EPI, locação empilhadeira OPEX)",
  "risks": "desabastecimento, HT, NR-16, variação resina PE, diesel no FOB"
}

REGRAS DE RANQUEAMENTO
- Vencedor = menor landed cost no Galpão A (Itajaí/SC), sujeito a lead time ≤5 dias úteis e (para empilhadeiras) SLA técnico em SC.
- Nunca eleger fornecedor só porque o CIF é barato em SP.
- Preferir 3 fornecedores por categoria (SC, PR, SP) quando existirem.
- ICMS: SP saída interestadual típica 12% para SC (confirmar); interna SP 18% só se a venda fosse intra-SP — não é o caso.
- Separar OPEX (locação, insumos) de CAPEX (não listar racks KONNEN, WMS, CCTV).

TAMBÉM ENTREGAR (além do JSON)
A) Tabela markdown resumo: categoria | item | vencedor SC-landed | R$/un | R$/mês landed | UF | CIF/FOB | fonte.
B) Hipóteses de consumo (paletes expedidos/mês, bobinas/palete) explícitas.
C) Lacunas: o que não achou preço público e precisa de RFQ.
D) Lista de URLs / PDFs usados.

NÃO FAZER
- Não assumir entregas ou CD em São Paulo.
- Não inflar volume com “market share”.
- Não tratar Konnen como cliente-âncora nem como fabricante de insumo.
- Não misturar Ad Valorem sobre CIF de carga; insumos são compra do operador.
- Não devolver prosa longa sem JSON. Prosa só em A–D, curta.
```
