import type { AccountItem } from '../../data/planoDeContasData';
import { PLANO_DE_CONTAS_ITEMS } from '../../data/planoDeContasData';
import type { CatalogOption } from '../../data/formCatalogs';
import type { MaterialCategory } from '../../types';

/** Contas de compras pesquisáveis (analíticas de insumos + OPEX máquinas). */
export function comprasCoaOptions(): CatalogOption[] {
  return PLANO_DE_CONTAS_ITEMS.filter(
    (a) =>
      a.type === 'Analítica' &&
      (a.code.startsWith('5.1.01.') || a.code.startsWith('5.1.05.')),
  ).map((a) => ({
    value: a.code,
    label: `${a.code} · ${a.name}`,
  }));
}

/** Contas analíticas do plano — select de “cargo” no cadastro intranet. */
export function cadastroCoaOptions(): CatalogOption[] {
  return PLANO_DE_CONTAS_ITEMS.filter((a) => a.type === 'Analítica')
    .map((a) => ({
      value: a.code,
      label: `${a.code} · ${a.name}`,
    }))
    .sort((a, b) => a.value.localeCompare(b.value, 'pt-BR'));
}

export function accountByCode(code: string): AccountItem | undefined {
  return PLANO_DE_CONTAS_ITEMS.find((a) => a.code === code);
}

const COA_TO_CATEGORY: Record<string, MaterialCategory> = {
  '5.1.01.01': 'Filme Stretch',
  '5.1.01.02': 'Plástico Bolha',
  '5.1.01.03': 'Fitas PET',
  '5.1.01.04': 'Cantoneiras',
  '5.1.01.05': 'Etiquetas WMS',
  '5.1.01.06': 'Ribbons',
  '5.1.01.07': 'Fita Lacre',
  '5.1.01.08': 'EPIs',
  '5.1.01.09': 'Uniformes',
  '5.1.01.10': 'Paletes PBR HT Madeira',
  '5.1.01.11': 'Paletes Plástico PEAD',
  '5.1.05.01': 'Locação Empilhadeiras',
};

/** Mapeia conta CoA → categoria (1 conta = 1 insumo). */
export function materialCategoryHint(code: string): MaterialCategory {
  if (COA_TO_CATEGORY[code]) return COA_TO_CATEGORY[code];
  if (code.startsWith('5.1.05')) return 'Locação Empilhadeiras';
  if (code === '5.1.01') return 'Filme Stretch';
  return 'Outros AG';
}

/** Inverso: categoria → conta CoA (seed / legado sem accountCode). */
export function accountCodeForCategory(category: string): string | undefined {
  const hit = Object.entries(COA_TO_CATEGORY).find(([, cat]) => cat === category);
  if (hit) return hit[0];
  if (category === 'Paletes PBR HT / Plástico' || category === 'Paletes (legado)') return '5.1.01.10';
  if (category === 'Fitas & Cantoneiras') return '5.1.01.03';
  return undefined;
}

export function formatCoaFilterLabel(code: string): string {
  const acc = accountByCode(code);
  return acc ? `${acc.code} · ${acc.name}` : code;
}

/** Resolve accountCode da cotação (explícito ou legado via categoria). */
export function resolveQuoteAccountCode(q: {
  accountCode?: string;
  materialCategory?: string;
}): string | undefined {
  const direct = q.accountCode?.trim();
  if (direct) return direct;
  if (q.materialCategory) return accountCodeForCategory(q.materialCategory);
  return undefined;
}

/** Volume: HUB sem histórico de compras — schema fixo, sem narrativa inventada. */
export const VOLUME_NO_HISTORY = {
  historical_data: false as const,
  status: 'sem_dados_historicos' as const,
};

export function buildCoaResearchPrompt(input: {
  account: AccountItem;
  amplifyNote?: string;
}): string {
  const scope = `${input.account.name}${input.account.notes ? ` — ${input.account.notes}` : ''}`;
  const amplify = input.amplifyNote?.trim()
    ? `

AMPLIAÇÃO POR REPROVAÇÃO / CORREÇÃO
A alçada reprovou ou pediu correção com a observação abaixo. Amplie a pesquisa para sanar o ponto (novos fornecedores, landed cost Itajaí, ICMS, SLA, volume):
"""
${input.amplifyNote.trim()}
"""
`
    : '';

  const category = materialCategoryHint(input.account.code);
  const hintCode = input.account.code;

  return `Você é analista sênior de compras e tributação logística (ICMS + CIF/FOB) para ARMAZÉM GERAL / 3PL no Sul do Brasil (HUB-FITNESS, Galpão A Itajaí/Navegantes·SC).

MISSÃO
Pesquisar fornecedores e condições comerciais (2024–2026, fontes citáveis) para UM ÚNICO INSUMO do Plano de Contas abaixo. Destino de TODAS as cotações: Itajaí/Navegantes (SC). Frete CIF só para SP é irrelevante. Landed cost = preço + frete até o Galpão A + ICMS. Eixo SC → PR → SP. Konnen = dogfood, não âncora comercial. CAPEX de racks já definido — não pesquisar porta-paletes como CAPEX.

CONTA CONTÁBIL (origem da demanda — 1 conta = 1 insumo)
- Código: ${input.account.code}
- Nome: ${input.account.name}
- Tipo: ${input.account.type} · Natureza ${input.account.nature}
- Escopo desta rodada: ${scope}
${amplify}
VOLUME (script estruturado — OBRIGATÓRIO)
O HUB-FITNESS NÃO tem dados históricos de compras. NÃO inventar narrativa de consumo (paletes/mês, metros/cinta, kg, etc.).
Usar EXATAMENTE este objeto em cada item:
"monthly_volume_hypothesis": { "qty": 1, "historical_data": false, "status": "sem_dados_historicos" }
- qty pode ser 1 (placeholder) até haver histórico real.
- Proibido campo "basis" com texto inventado.

ENTREGÁVEL (obrigatório — Comparador = 3 cards do mesmo SKU)
- domain "compras"
- accounting_hint "${hintCode}"
- category de todo item = "${category}"
- EXATAMENTE 1 item (SKU representativo DESTA conta somente — não misturar outros insumos)
- EXATAMENTE 3 suppliers (preferir 1 SC + 1 PR + 1 SP)
- Campos: unit_price_brl, frete até Itajaí (shipping_cost_monthly_brl_to_itajai ou freight_cost_brl), lead_time_days_to_itajai, icms_rate_pct, fonte
- Se RFQ incompleto: "example": true e unit_price_brl 0
- Não inventar BL/DI/PI/Packing List
- NÃO devolver mais de 3 cotações no total`;
}

/** Garante 1 item · no máx. \`maxQuotes\` ofertas — NÃO mistura SKUs de items diferentes. */
export function clampComprasResearchPack(
  pack: Record<string, unknown>,
  maxQuotes = 3,
): Record<string, unknown> {
  const items = Array.isArray(pack.items) ? [...(pack.items as Record<string, unknown>[])] : [];
  if (!items.length) return pack;

  const primary =
    items.find(
      (it) =>
        (Array.isArray(it.suppliers) && it.suppliers.length > 0) ||
        (Array.isArray(it.quotes) && it.quotes.length > 0) ||
        (Array.isArray(it.companies) && it.companies.length > 0),
    ) || items[0];

  const item: Record<string, unknown> = { ...primary };
  if (Array.isArray(primary.suppliers) && primary.suppliers.length) {
    item.suppliers = (primary.suppliers as unknown[]).slice(0, maxQuotes);
    delete item.quotes;
    delete item.companies;
  } else if (Array.isArray(primary.quotes) && primary.quotes.length) {
    item.quotes = (primary.quotes as unknown[]).slice(0, maxQuotes);
    delete item.suppliers;
    delete item.companies;
  } else if (Array.isArray(primary.companies) && primary.companies.length) {
    item.companies = (primary.companies as unknown[]).slice(0, maxQuotes);
    delete item.suppliers;
    delete item.quotes;
  }

  return { ...pack, items: [item] };
}
