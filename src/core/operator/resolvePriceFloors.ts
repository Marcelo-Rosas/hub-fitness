/** Map Operator `price_category_items` → pisos SANCO; fallback = hubParams.pricing.floors. */

export type FloorBundle = {
  storage: number;
  handling: number;
  deunitization: number;
  labeling: number;
  adValoremPct: number;
  source: 'operator' | 'params';
};

export type PriceCategoryItemLike = {
  sku_code?: string | null;
  description?: string | null;
  unit_price_cents: number;
  kind_code?: string | null;
  category_code?: string | null;
};

export type FloorFallback = {
  storage: number;
  handling: number;
  deunitization: number;
  labeling: number;
  adValoremPct: number;
};

function matchKey(item: PriceCategoryItemLike): string {
  return [item.sku_code, item.description, item.kind_code, item.category_code]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Quando há itens Operator com sku/descrição reconhecível, sobrescreve o piso correspondente.
 * Sem hits → source `params` (não inventa preço).
 */
export function resolvePriceFloors(
  items: PriceCategoryItemLike[],
  fallback: FloorFallback,
): FloorBundle {
  const out: FloorBundle = {
    storage: fallback.storage,
    handling: fallback.handling,
    deunitization: fallback.deunitization,
    labeling: fallback.labeling,
    adValoremPct: fallback.adValoremPct,
    source: 'params',
  };
  if (!items.length) return out;

  let hits = 0;
  for (const item of items) {
    if (item.unit_price_cents == null || Number.isNaN(Number(item.unit_price_cents))) continue;
    const price = Number(item.unit_price_cents) / 100;
    const key = matchKey(item);
    if (/floor-arm|armazen|storage|posi[cç][aã]o/.test(key)) {
      out.storage = price;
      hits += 1;
    } else if (/floor-mov|handling|moviment/.test(key)) {
      out.handling = price;
      hits += 1;
    } else if (/floor-des|desova|desunit|unload|container|fcl/.test(key)) {
      out.deunitization = price;
      hits += 1;
    } else if (/floor-eti|etiquet|label|kitting/.test(key)) {
      out.labeling = price;
      hits += 1;
    }
  }
  if (hits > 0) out.source = 'operator';
  return out;
}
